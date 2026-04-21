import express    from "express";
import rateLimit  from "express-rate-limit";
import Newsletter from "../models/Newsletter.js";
import { genId, esc, tpl, mail } from "../config/mailer.js";

const router = express.Router();

const RATE_FORM = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: "Trop de soumissions. Réessayez dans une heure." },
});

const RE_EMAIL = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

function siteBaseUrl() {
  return (
    process.env.HELLOASSO_REDIRECT_BASE ||
    process.env.APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

// POST /api/newsletter
router.post("/", RATE_FORM, async (req, res) => {
  const { prenom, email } = req.body;

  const errors = [];
  if (!prenom?.trim() || prenom.trim().length < 2) errors.push("Prénom invalide");
  if (!email?.trim()  || !RE_EMAIL.test(email.trim())) errors.push("Adresse email invalide");
  if (errors.length) return res.status(400).json({ success: false, errors });

  const emailLower  = email.trim().toLowerCase();
  const ADMIN_EMAIL = process.env.MAIL_TO || "rale.asso@gmail.com";

  const existing = await Newsletter.findOne({ email: emailLower });
  if (existing) {
    return res.json({ success: true, alreadyExists: true, message: "Vous êtes déjà inscrit(e) à notre newsletter." });
  }

  const refId = genId();
  const s     = { prenom: esc(prenom.trim()), email: esc(email.trim()) };
  const total = (await Newsletter.countDocuments()) + 1;

  let saved;
  try {
    saved = await Newsletter.create({ refId, prenom: prenom.trim(), email: emailLower });
  } catch (e) {
    console.error("Sauvegarde newsletter MongoDB :", e.message);
  }

  const ts          = new Date().toISOString();
  const unsubUrl    = saved?.unsubscribeToken
    ? `${siteBaseUrl()}/api/newsletter/unsubscribe/${saved.unsubscribeToken}`
    : null;

  // Notification admin
  await mail({
    to:      ADMIN_EMAIL,
    subject: `[RALE] Nouvelle inscription newsletter — ${prenom}`,
    text:    `Prénom : ${prenom}\nEmail : ${email}\nDate : ${new Date(ts).toLocaleString("fr-FR")}\nTotal abonnés : ${total}`,
    html: tpl("Nouvelle inscription newsletter", `
      <h2 style="color:#1B5E78;margin:0 0 20px;">Nouvelle inscription newsletter</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#1e2a30;">
        <tr style="background:#f0f5f7;">
          <td style="padding:10px 14px;font-weight:600;width:130px;">Prénom</td>
          <td style="padding:10px 14px;">${s.prenom}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Email</td>
          <td style="padding:10px 14px;"><a href="mailto:${s.email}" style="color:#1B5E78;">${s.email}</a></td></tr>
        <tr style="background:#f0f5f7;">
          <td style="padding:10px 14px;font-weight:600;">Date</td>
          <td style="padding:10px 14px;">${new Date(ts).toLocaleString("fr-FR")}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Total abonnés</td>
          <td style="padding:10px 14px;"><strong>${total}</strong></td></tr>
      </table>
    `),
  });

  // Confirmation à l'abonné avec lien de désabonnement
  await mail({
    to:      email.trim(),
    subject: "[RALE] Bienvenue dans notre newsletter !",
    text:    `Bienvenue ${prenom} !\n\nVotre inscription est confirmée. Vous recevrez nos actualités et événements.\n\n${unsubUrl ? `Pour vous désabonner à tout moment : ${unsubUrl}` : 'Pour vous désabonner, répondez à cet email avec la mention "désabonnement".'}\n\nL'équipe RALE`,
    html: tpl("Bienvenue dans la newsletter RALE", `
      <h2 style="color:#1B5E78;margin:0 0 16px;">Bienvenue, ${s.prenom} !</h2>
      <p style="color:#1e2a30;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Votre inscription à la newsletter de l'Association RALE est confirmée.
        Vous recevrez désormais nos actualités, événements et informations
        sur nos actions en faveur des personnes autistes et de leurs familles.
      </p>
      <div style="background:#3A8C6E;border-radius:10px;padding:20px;text-align:center;margin:0 0 20px;">
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0;">
          Merci de soutenir notre mission !
        </p>
      </div>
      <p style="color:#5a6e78;font-size:13px;line-height:1.6;margin:0;">
        ${unsubUrl
          ? `Pour vous désabonner à tout moment, cliquez ici : <a href="${unsubUrl}" style="color:#1B5E78;">Se désabonner</a>`
          : 'Pour vous désabonner à tout moment, répondez à cet email avec la mention "désabonnement".'}
      </p>
    `),
  });

  return res.json({ success: true, message: "Inscription confirmée ! Merci de votre intérêt.", id: refId });
});

// GET /api/newsletter/unsubscribe/:token
router.get("/unsubscribe/:token", async (req, res) => {
  const { token } = req.params;

  const page = (title, body, color = "#3A8C6E") => `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — Association RALE</title>
  <style>
    body { margin:0; padding:0; background:#f0f5f7; font-family:Arial,Helvetica,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#fff; border-radius:12px; padding:40px; max-width:480px; width:90%; text-align:center; box-shadow:0 2px 16px rgba(0,0,0,.09); }
    .icon { font-size:48px; margin:0 0 16px; }
    h1 { color:${color}; font-size:22px; margin:0 0 12px; }
    p { color:#5a6e78; font-size:15px; line-height:1.7; margin:0 0 24px; }
    a { display:inline-block; background:${color}; color:#fff; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:15px; font-weight:600; }
  </style>
</head>
<body>
  <div class="card">
    ${body}
    <a href="https://www.association-rale.fr">Retour au site</a>
  </div>
</body>
</html>`;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).send(page("Lien invalide", `
      <div class="icon">⚠️</div>
      <h1>Lien invalide</h1>
      <p>Ce lien de désabonnement est incorrect. Vérifiez l'URL ou contactez-nous à <strong>rale.asso@gmail.com</strong>.</p>
    `, "#E07B39"));
  }

  const sub = await Newsletter.findOne({ unsubscribeToken: token });
  if (!sub) {
    return res.status(404).send(page("Lien expiré", `
      <div class="icon">🔍</div>
      <h1>Lien introuvable</h1>
      <p>Ce lien est invalide ou votre adresse a déjà été désabonnée.</p>
    `, "#1B5E78"));
  }

  if (!sub.active) {
    return res.send(page("Déjà désabonné", `
      <div class="icon">✅</div>
      <h1>Déjà désabonné(e)</h1>
      <p>L'adresse <strong>${esc(sub.email)}</strong> ne reçoit plus notre newsletter.</p>
    `));
  }

  await Newsletter.findByIdAndUpdate(sub._id, { active: false });

  console.log(`📭 Désabonnement newsletter : ${sub.email}`);

  return res.send(page("Désabonnement confirmé", `
    <div class="icon">👋</div>
    <h1>Désabonnement confirmé</h1>
    <p>L'adresse <strong>${esc(sub.email)}</strong> a bien été retirée de notre liste.<br>
    Nous espérons vous revoir parmi nous.</p>
  `));
});

export default router;
