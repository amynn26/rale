/**
 * Serveur Express — Association RALE
 *
 * Endpoints :
 *   GET  /api/health                → Statut du serveur
 *   POST /api/contact               → Formulaire de contact
 *   POST /api/newsletter            → Inscription newsletter
 *   POST /api/adhesion              → Demande d'adhésion
 *   POST /api/webhook/helloasso     → Dons HelloAsso (webhook HMAC)
 *
 * Variables d'environnement → voir .env.example
 */

import "dotenv/config";
import express   from "express";
import cors      from "cors";
import helmet    from "helmet";
import morgan    from "morgan";
import rateLimit from "express-rate-limit";
import path      from "path";
import fs        from "fs";
import { fileURLToPath } from "url";

import connectDB        from "./src/config/db.js";
import contactRoutes    from "./src/routes/contactRoutes.js";
import newsletterRoutes from "./src/routes/newsletterRoutes.js";
import adhesionRoutes   from "./src/routes/adhesionRoutes.js";
import donationRoutes   from "./src/routes/donationRoutes.js";
import webhookRoutes    from "./src/routes/webhookRoutes.js";
import adminRoutes      from "./src/routes/adminRoutes.js";

// ── Connexion MongoDB ──────────────────────────────────────────
connectDB();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app       = express();
const PORT      = process.env.PORT || 3000;
const IS_PROD   = process.env.NODE_ENV === "production";

// ── Sécurité HTTP ──────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: IS_PROD ? undefined : false }));

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:4173"];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(Object.assign(new Error("Origine non autorisée"), { status: 403 }));
  },
  methods: ["GET", "POST"],
}));

app.use(morgan("dev"));

// ── Webhook HelloAsso — DOIT être monté AVANT express.json() ──
// (le webhook a besoin du corps brut pour la vérification HMAC)
app.use("/api/webhook", webhookRoutes);

// ── Parseurs de corps ──────────────────────────────────────────
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// ── Production : servir le build Vite ─────────────────────────
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, { maxAge: IS_PROD ? "1d" : 0 }));
}

// ── Rate limiting global ───────────────────────────────────────
app.use("/api", rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             100,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: "Trop de requêtes. Réessayez dans quelques minutes." },
}));

// ── Routes API ─────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    status:    "ok",
    timestamp: new Date().toISOString(),
    smtp:      Boolean(process.env.SMTP_HOST),
    db:        Boolean(process.env.MONGO_URI),
  });
});

app.use("/api/contact",    contactRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/adhesion",   adhesionRoutes);
app.use("/api/donation",   donationRoutes);
app.use("/api/admin",      adminRoutes);

// ── Production : toutes les routes inconnues → index.html ─────
if (fs.existsSync(distPath)) {
  app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── Gestion d'erreurs globale ──────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  console.error(`Erreur ${status} :`, err.message);
  res.status(status).json({ success: false, error: err.message || "Erreur interne" });
});

// ── Démarrage ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✓  Serveur Association RALE — http://localhost:${PORT}`);
  console.log(`   Mode : ${IS_PROD ? "production" : "développement"}`);
  if (!process.env.SMTP_HOST) {
    console.log(`   ⚠  SMTP non configuré — les emails ne seront pas envoyés.`);
  }
  if (!process.env.MONGO_URI) {
    console.log(`   ⚠  MONGO_URI non configuré — les données ne seront pas persistées.`);
  }
  if (!process.env.HELLOASSO_SECRET) {
    console.log(`   ⚠  HELLOASSO_SECRET absent — les webhooks HelloAsso ne sont PAS vérifiés (risque de fraude).`);
  }
  if (!process.env.ADMIN_KEY) {
    console.log(`   ⚠  ADMIN_KEY absent — le tableau de bord admin (/api/admin) est désactivé.`);
  }
});
