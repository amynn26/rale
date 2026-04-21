import express    from "express";
import rateLimit  from "express-rate-limit";
import fs         from "fs";
import path       from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_FILE = path.join(__dirname, "../../.helloasso_token.json");
const HA_TOKEN_URL = "https://api.helloasso.com/oauth2/token";

const router = express.Router();

const RATE_CHECKOUT = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: "Trop de tentatives. Réessayez dans une heure." },
});

// ── Persistance du token HelloAsso OAuth2 ──────────────────────────────────
// Le token est sauvegardé sur disque pour survivre aux redémarrages du serveur.
// HelloAsso retourne 409 si on tente de créer un nouveau token client_credentials
// alors qu'un token valide existe encore côté HelloAsso — d'où la persistance.

function loadPersistedToken() {
  try {
    const raw = fs.readFileSync(TOKEN_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return { accessToken: null, refreshToken: null, expiresAt: 0 };
  }
}

function saveToken(data) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(data), "utf8");
  } catch (e) {
    console.warn("HelloAsso : impossible de persister le token :", e.message);
  }
}

let _cache = loadPersistedToken();

async function fetchTokenWithGrant(params) {
  const res = await fetch(HA_TOKEN_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams(params),
  });
  const txt = await res.text();
  if (!res.ok) throw Object.assign(new Error(`HelloAsso OAuth2 ${res.status} : ${txt}`), { status: res.status });
  return JSON.parse(txt);
}

async function getHelloAssoToken() {
  // 1. Token en cache encore valide
  if (_cache.accessToken && Date.now() < _cache.expiresAt) {
    return _cache.accessToken;
  }

  // 2. Refresh token disponible → on l'utilise en priorité
  if (_cache.refreshToken) {
    try {
      const data = await fetchTokenWithGrant({
        client_id:     process.env.HELLOASSO_CLIENT_ID,
        client_secret: process.env.HELLOASSO_CLIENT_SECRET,
        grant_type:    "refresh_token",
        refresh_token: _cache.refreshToken,
      });
      _cache = {
        accessToken:  data.access_token,
        refreshToken: data.refresh_token || _cache.refreshToken,
        expiresAt:    Date.now() + (data.expires_in - 60) * 1000,
      };
      saveToken(_cache);
      return _cache.accessToken;
    } catch (e) {
      console.warn("HelloAsso : refresh_token expiré, fallback client_credentials :", e.message);
      _cache.refreshToken = null;
    }
  }

  // 3. Demande d'un nouveau token via client_credentials
  const data = await fetchTokenWithGrant({
    client_id:     process.env.HELLOASSO_CLIENT_ID,
    client_secret: process.env.HELLOASSO_CLIENT_SECRET,
    grant_type:    "client_credentials",
  });
  _cache = {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt:    Date.now() + (data.expires_in - 60) * 1000,
  };
  saveToken(_cache);
  return _cache.accessToken;
}

// ──────────────────────────────────────────────────────────────────────────
// POST /api/donation/create-checkout
//
// Crée un "checkout intent" HelloAsso et renvoie l'URL de redirection.
// Le frontend redirige ensuite le visiteur vers cette URL pour payer.
// Après paiement, HelloAsso redirige vers APP_URL/?don=merci
// et envoie un webhook à /api/webhook/helloasso (déjà géré).
// ──────────────────────────────────────────────────────────────────────────
router.post("/create-checkout", RATE_CHECKOUT, async (req, res) => {
  const { amountCents, donorName, donorEmail } = req.body;
  const cents = parseInt(amountCents, 10);

  if (!cents || cents < 100 || cents > 1_000_000) {
    return res.status(400).json({ success: false, error: "Montant invalide (1 € à 10 000 €)." });
  }

  const orgSlug = process.env.HELLOASSO_ORG_SLUG;
  if (!orgSlug) {
    return res.status(503).json({ success: false, error: "Paiement non configuré sur ce serveur." });
  }

  try {
    const token = await getHelloAssoToken();

    // HelloAsso exige des URLs HTTPS valides (localhost refusé).
    // En production : APP_URL = https://www.association-rale.fr
    // En développement : définir HELLOASSO_REDIRECT_BASE avec une URL HTTPS
    //   (ex: tunnel ngrok  ou  directement le domaine de prod pour tester)
    const baseUrl = (
      process.env.HELLOASSO_REDIRECT_BASE ||
      process.env.APP_URL ||
      "http://localhost:5173"
    ).replace(/\/$/, "");

    if (!baseUrl.startsWith("https://")) {
      return res.status(503).json({
        success: false,
        error:   "HelloAsso requiert des URLs HTTPS. Définissez HELLOASSO_REDIRECT_BASE dans votre .env.",
      });
    }

    const body = {
      totalAmount:      cents,   // HelloAsso attend les centimes
      initialAmount:    cents,
      itemName:         "Don à l'Association RALE",
      backUrl:          `${baseUrl}/`,
      errorUrl:         `${baseUrl}/`,
      returnUrl:        `${baseUrl}/?don=merci`,   // après paiement réussi
      containsDonation: true,
    };

    // Pré-remplissage optionnel du formulaire HelloAsso (nom / email)
    if (donorName || donorEmail) {
      const parts = (donorName || "").trim().split(/\s+/);
      body.payer = {};
      if (parts[0])                   body.payer.firstName = parts[0];
      if (parts.slice(1).join(" "))   body.payer.lastName  = parts.slice(1).join(" ");
      if (donorEmail)                 body.payer.email     = donorEmail;
    }

    const haRes = await fetch(
      `https://api.helloasso.com/v5/organizations/${encodeURIComponent(orgSlug)}/checkout-intents`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const haData = await haRes.json();

    if (!haRes.ok) {
      console.error("HelloAsso checkout error :", haData);
      return res.status(500).json({ success: false, error: "Erreur lors de la création du paiement HelloAsso." });
    }

    return res.json({ success: true, redirectUrl: haData.redirectUrl });

  } catch (err) {
    console.error("HelloAsso checkout :", err.message);

    // 409 sur le token = HelloAsso a déjà un token actif pour ce client.
    // L'association doit régénérer ses identifiants API dans l'espace HelloAsso,
    // ou attendre l'expiration naturelle du token (~30 min).
    if (err.status === 409) {
      return res.status(503).json({
        success: false,
        error: "Le service de paiement est temporairement indisponible. Veuillez réessayer dans quelques minutes ou nous contacter au 07 49 96 63 33.",
      });
    }

    return res.status(500).json({ success: false, error: "Erreur inattendue. Veuillez réessayer." });
  }
});

export default router;
