import express from "express";
import rateLimit from "express-rate-limit";
import Adhesion from "../models/Adhesion.js";
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
const RE_CP    = /^\d{5}$/;
const RE_TEL   = /^[\d\s\+\-\.\(\)]{7,20}$/;

const TYPE_LABELS = {
  individuel:  "Individuel — 10 €/an",
  famille:     "Famille — 20 €/an",
  bienfaiteur: "Membre bienfaiteur — montant libre",
};

const TYPE_COTISATIONS = {
  individuel:  "10 €/an",
  famille:     "20 €/an",
  bienfaiteur: "montant libre (votre générosité !)",
};

// POST /api/adhesion
router.post("/", RATE_FORM, async (req, res) => {
  const { nom, prenom, email, telephone, adresse, codePostal, ville, typeAdhesion, motivation } = req.body;

  const errors = [];
  if (!nom?.trim()        || nom.trim().length < 2)                  errors.push("Nom invalide");
  if (!prenom?.trim()     || prenom.trim().length < 2)               errors.push("Prénom invalide");
  if (!email?.trim()      || !RE_EMAIL.test(email.trim()))           errors.push("Email invalide");
  if (!telephone?.trim()  || !RE_TEL.test(telephone.trim()))         errors.push("Téléphone invalide");
  if (!adresse?.trim()    || adresse.trim().length < 5)              errors.push("Adresse invalide");
  if (!codePostal?.trim() || !RE_CP.test(codePostal.trim()))         errors.push("Code postal invalide (5 chiffres)");
  if (!ville?.trim()      || ville.trim().length < 2)                errors.push("Ville invalide");
  if (!typeAdhesion || !["individuel", "famille", "bienfaiteur"].includes(typeAdhesion))
    errors.push("Type d'adhésion invalide");
  if (errors.length) return res.status(400).json({ success: false, errors });

  const refId     = genId();
  const typeLabel = TYPE_LABELS[typeAdhesion];
  const cotis     = TYPE_COTISATIONS[typeAdhesion];
  const ADMIN_EMAIL = process.env.MAIL_TO || "rale.asso@gmail.com";

  const s = {
    nom:        esc(nom.trim()),
    prenom:     esc(prenom.trim()),
    email:      esc(email.trim()),
    telephone:  esc(telephone.trim()),
    adresse:    esc(adresse.trim()),
    codePostal: esc(codePostal.trim()),
    ville:      esc(ville.trim()),
    typeLabel:  esc(typeLabel),
    motivation: esc(motivation?.trim() || ""),
  };

  try {
    await Adhesion.create({
      refId,
      nom:         nom.trim(),
      prenom:      prenom.trim(),
      email:       email.trim(),
      telephone:   telephone.trim(),
      adresse:     adresse.trim(),
      codePostal:  codePostal.trim(),
      ville:       ville.trim(),
      typeAdhesion,
      motivation:  motivation?.trim() || "",
      statut:      "en_attente",
    });
  } catch (e) {
    console.error("Sauvegarde adhésion MongoDB :", e.message);
  }

  const ts = new Date().toISOString();

  // E-mail à l'équipe RALE
  await mail({
    to:      ADMIN_EMAIL,
    subject: `[RALE] Nouvelle demande d'adhésion — ${prenom} ${nom}`,
    replyTo: email.trim(),
    text:    `Réf. : ${refId}\nNom : ${prenom} ${nom}\nEmail : ${email}\nTél : ${telephone}\nAdresse : ${adresse}, ${codePostal} ${ville}\nType : ${typeLabel}\nDate : ${new Date(ts).toLocaleString("fr-FR")}${motivation ? `\n\nMotivation :\n${motivation}` : ""}`,
    html: tpl("Nouvelle demande d'adhésion", `
      <h2 style="color:#1B5E78;margin:0 0 20px;">Demande d'adhésion reçue</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#1e2a30;">
        <tr style="background:#f0f5f7;">
          <td style="padding:10px 14px;font-weight:600;width:150px;">Référence</td>
          <td style="padding:10px 14px;font-family:monospace;">${refId}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Nom complet</td>
          <td style="padding:10px 14px;">${s.prenom} ${s.nom}</td></tr>
        <tr style="background:#f0f5f7;">
          <td style="padding:10px 14px;font-weight:600;">Email</td>
          <td style="padding:10px 14px;"><a href="mailto:${s.email}" style="color:#1B5E78;">${s.email}</a></td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Téléphone</td>
          <td style="padding:10px 14px;"><a href="tel:${s.telephone}" style="color:#1B5E78;">${s.telephone}</a></td></tr>
        <tr style="background:#f0f5f7;">
          <td style="padding:10px 14px;font-weight:600;">Adresse</td>
          <td style="padding:10px 14px;">${s.adresse}, ${s.codePostal} ${s.ville}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Type</td>
          <td style="padding:10px 14px;"><strong style="color:#3A8C6E;">${s.typeLabel}</strong></td></tr>
        <tr style="background:#f0f5f7;">
          <td style="padding:10px 14px;font-weight:600;">Date</td>
          <td style="padding:10px 14px;">${new Date(ts).toLocaleString("fr-FR")}</td></tr>
      </table>
      ${s.motivation ? `
        <h3 style="color:#1B5E78;margin:24px 0 10px;font-size:15px;">Motivation :</h3>
        <div style="background:#f0f5f7;padding:14px 16px;border-radius:8px;font-size:14px;line-height:1.7;">${s.motivation}</div>
      ` : ""}
      <div style="margin:20px 0 0;background:#fff8e1;border-left:4px solid #E07B39;padding:14px 16px;border-radius:0 8px 8px 0;font-size:14px;color:#5a6e78;">
        ⚡ <strong>Action requise :</strong> Contacter le candidat pour finaliser l'adhésion et régler la cotisation (${cotis}).
      </div>
    `),
  });

  // Confirmation au candidat
  await mail({
    to:      email.trim(),
    subject: "[RALE] Votre demande d'adhésion a bien été reçue",
    text:    `Bonjour ${prenom},\n\nVotre demande d'adhésion en tant que "${typeLabel}" a bien été reçue (réf. ${refId}).\nCotisation : ${cotis}\n\nNotre équipe vous contactera sous 5 à 7 jours ouvrés.\n\nPour toute question : 07 49 96 63 33\n\nCordialement,\nL'équipe de l'Association RALE`,
    html: tpl("Demande d'adhésion reçue — RALE", `
      <h2 style="color:#1B5E78;margin:0 0 16px;">Bonjour ${s.prenom},</h2>
      <p style="color:#1e2a30;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Nous avons bien reçu votre demande d'adhésion à l'Association RALE en tant que
        <strong>${s.typeLabel}</strong>. Bienvenue dans notre communauté !
      </p>
      <div style="background:#f0f5f7;border-left:4px solid #3A8C6E;padding:14px 20px;border-radius:0 8px 8px 0;margin:0 0 20px;">
        <p style="margin:0 0 4px;color:#5a6e78;font-size:12px;text-transform:uppercase;letter-spacing:.5px;font-weight:600;">Référence</p>
        <p style="margin:0 0 8px;color:#1B5E78;font-size:20px;font-weight:700;font-family:monospace;">${refId}</p>
        <p style="margin:0;color:#3A8C6E;font-size:14px;">Cotisation : <strong>${cotis}</strong></p>
      </div>
      <h3 style="color:#1B5E78;margin:0 0 10px;font-size:15px;">Prochaines étapes :</h3>
      <ol style="color:#1e2a30;font-size:15px;line-height:1.9;margin:0 0 20px;padding-left:20px;">
        <li>Notre équipe examinera votre dossier sous <strong>5 à 7 jours ouvrés</strong></li>
        <li>Vous recevrez un appel ou un email pour finaliser l'adhésion</li>
        <li>Le règlement de la cotisation interviendra lors de ce contact</li>
      </ol>
      <p style="color:#1e2a30;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Pour toute question : <a href="tel:+33749966333" style="color:#1B5E78;font-weight:600;">07 49 96 63 33</a>
        (mar. &amp; jeu. 14h–18h, sam. 10h–13h).
      </p>
      <p style="color:#5a6e78;font-size:14px;margin:0;">
        Cordialement,<br><strong style="color:#1e2a30;">L'équipe de l'Association RALE</strong>
      </p>
    `),
  });

  return res.json({ success: true, message: "Demande d'adhésion reçue ! Nous vous contacterons sous 5 à 7 jours.", id: refId });
});

export default router;
