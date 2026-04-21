import express from "express";
import rateLimit from "express-rate-limit";
import Contact from "../models/Contact.js";
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

const SUJET_LABELS = {
  adhesion:       "Adhésion à l'association",
  benevole:       "Devenir bénévole",
  repit:          "Demande de répit",
  loisirs:        "Inscription aux loisirs éducatifs",
  accompagnement: "Accompagnement & démarches",
  evenement:      "Événement / Atelier",
  partenariat:    "Partenariat professionnel",
  autre:          "Autre",
};

// POST /api/contact
router.post("/", RATE_FORM, async (req, res) => {
  const { nom, prenom, email, telephone, sujet, message } = req.body;

  const errors = [];
  if (!nom?.trim()     || nom.trim().length < 2)       errors.push("Nom invalide (2 caractères minimum)");
  if (!prenom?.trim()  || prenom.trim().length < 2)    errors.push("Prénom invalide (2 caractères minimum)");
  if (!email?.trim()   || !RE_EMAIL.test(email.trim())) errors.push("Adresse email invalide");
  if (!sujet?.trim())                                   errors.push("Sujet requis");
  if (!message?.trim() || message.trim().length < 10)   errors.push("Message trop court (10 caractères minimum)");
  if (errors.length) return res.status(400).json({ success: false, errors });

  const refId      = genId();
  const sujetLabel = SUJET_LABELS[sujet] || sujet;
  const ADMIN_EMAIL = process.env.MAIL_TO || "rale.asso@gmail.com";

  const s = {
    nom:       esc(nom.trim()),
    prenom:    esc(prenom.trim()),
    email:     esc(email.trim()),
    telephone: esc(telephone?.trim() || ""),
    sujet:     esc(sujetLabel),
    message:   esc(message.trim()),
  };

  try {
    await Contact.create({
      refId,
      nom:       nom.trim(),
      prenom:    prenom.trim(),
      email:     email.trim(),
      telephone: telephone?.trim() || "",
      sujet,
      message:   message.trim(),
    });
  } catch (e) {
    console.error("Sauvegarde contact MongoDB :", e.message);
  }

  const ts = new Date().toISOString();

  // E-mail à l'équipe RALE
  await mail({
    to:      ADMIN_EMAIL,
    subject: `[RALE] Nouveau message : ${sujetLabel} — ${prenom} ${nom}`,
    replyTo: email.trim(),
    text:    `ID : ${refId}\nExpéditeur : ${prenom} ${nom}\nEmail : ${email}\nTél : ${telephone || "—"}\nSujet : ${sujetLabel}\nDate : ${new Date(ts).toLocaleString("fr-FR")}\n\n${message}`,
    html: tpl("Nouveau message — RALE", `
      <h2 style="color:#1B5E78;margin:0 0 20px;font-size:20px;">Nouveau message reçu</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#1e2a30;">
        <tr style="background:#f0f5f7;">
          <td style="padding:10px 14px;font-weight:600;width:130px;border-radius:6px 0 0 0;">Référence</td>
          <td style="padding:10px 14px;font-family:monospace;">${refId}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Expéditeur</td>
          <td style="padding:10px 14px;">${s.prenom} ${s.nom}</td></tr>
        <tr style="background:#f0f5f7;">
          <td style="padding:10px 14px;font-weight:600;">Email</td>
          <td style="padding:10px 14px;"><a href="mailto:${s.email}" style="color:#1B5E78;">${s.email}</a></td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Téléphone</td>
          <td style="padding:10px 14px;">${s.telephone || "—"}</td></tr>
        <tr style="background:#f0f5f7;">
          <td style="padding:10px 14px;font-weight:600;">Sujet</td>
          <td style="padding:10px 14px;"><strong>${s.sujet}</strong></td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Date</td>
          <td style="padding:10px 14px;">${new Date(ts).toLocaleString("fr-FR")}</td></tr>
      </table>
      <h3 style="color:#1B5E78;margin:24px 0 10px;font-size:15px;">Message :</h3>
      <div style="background:#f0f5f7;padding:16px;border-radius:8px;font-size:14px;line-height:1.7;white-space:pre-wrap;">${s.message}</div>
      <p style="margin:18px 0 0;font-size:13px;color:#5a6e78;">→ Cliquez sur "Répondre" pour répondre directement à l'expéditeur.</p>
    `),
  });

  // Auto-réponse à l'expéditeur
  await mail({
    to:      email.trim(),
    subject: "[RALE] Votre message a bien été reçu",
    text:    `Bonjour ${prenom},\n\nNous avons bien reçu votre message (réf. ${refId}).\nNotre équipe vous répondra sous 3 à 5 jours ouvrés.\n\nPour toute urgence : 07 49 96 63 33\n\nCordialement,\nL'équipe de l'Association RALE`,
    html: tpl("Accusé de réception — RALE", `
      <h2 style="color:#1B5E78;margin:0 0 16px;">Bonjour ${s.prenom},</h2>
      <p style="color:#1e2a30;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Nous avons bien reçu votre message concernant <strong>${s.sujet}</strong>. Merci de nous avoir contactés.
      </p>
      <div style="background:#f0f5f7;border-left:4px solid #1B5E78;padding:14px 20px;border-radius:0 8px 8px 0;margin:0 0 20px;">
        <p style="margin:0 0 4px;color:#5a6e78;font-size:12px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Numéro de référence</p>
        <p style="margin:0;color:#1B5E78;font-size:20px;font-weight:700;font-family:monospace;">${refId}</p>
      </div>
      <p style="color:#1e2a30;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Notre équipe bénévole traitera votre demande dans les meilleurs délais,
        généralement sous <strong>3 à 5 jours ouvrés</strong>.
      </p>
      <p style="color:#1e2a30;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Pour toute urgence, contactez-nous au
        <a href="tel:+33749966333" style="color:#1B5E78;font-weight:600;">07 49 96 63 33</a>
        (mar. &amp; jeu. 14h–18h, sam. 10h–13h).
      </p>
      <p style="color:#5a6e78;font-size:14px;margin:0;">
        Cordialement,<br><strong style="color:#1e2a30;">L'équipe de l'Association RALE</strong>
      </p>
    `),
  });

  return res.json({ success: true, message: "Message reçu, merci !", id: refId });
});

export default router;
