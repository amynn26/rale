import express   from "express";
import rateLimit from "express-rate-limit";
import QRCode    from "qrcode";
import Donation  from "../models/Donation.js";
import { genId, esc, tpl, mail } from "../config/mailer.js";

const router = express.Router();

const RATE_INTENT = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { success: false, error: "Trop de tentatives. Réessayez dans une heure." },
});

const RE_EMAIL = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// Génère la chaîne EPC QR code (standard SEPA — compatible toutes banques françaises)
function buildEpcString({ bic, name, iban, amountEur, reference }) {
  return [
    "BCD",
    "002",
    "1",
    "SCT",
    bic.replace(/\s/g, ""),
    name.slice(0, 70),
    iban.replace(/\s/g, ""),
    `EUR${Number(amountEur).toFixed(2)}`,
    "CHAR",
    reference.slice(0, 35),
    `Don Association RALE ${reference}`.slice(0, 70),
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────
// POST /api/donation/intent
//
// Enregistre une intention de don (virement ou chèque),
// génère un QR Code EPC pour virement SEPA, envoie les
// instructions par email au donateur et à l'admin.
// ──────────────────────────────────────────────────────────────
router.post("/intent", RATE_INTENT, async (req, res) => {
  const { amountCents, donorName, donorEmail, methode } = req.body;

  const cents = parseInt(amountCents, 10);
  if (!cents || cents < 100 || cents > 1_000_000) {
    return res.status(400).json({ success: false, error: "Montant invalide (1 € à 10 000 €)." });
  }

  const name      = (donorName  || "").trim().slice(0, 200);
  const email     = (donorEmail || "").trim().toLowerCase().slice(0, 200);
  const methodeOk = ["virement", "cheque"].includes(methode) ? methode : "virement";

  if (!name || name.length < 2) {
    return res.status(400).json({ success: false, error: "Le nom est requis (2 caractères minimum)." });
  }
  if (!email || !RE_EMAIL.test(email)) {
    return res.status(400).json({ success: false, error: "Une adresse email valide est requise." });
  }

  const montant    = cents / 100;
  const montantStr = montant.toFixed(2).replace(".", ",");
  const netStr     = Math.round(montant * 0.34).toFixed(0);
  const refId      = `DON-${genId().slice(0, 8).toUpperCase()}`;

  const IBAN        = (process.env.ASSO_IBAN || "").trim();
  const BIC         = (process.env.ASSO_BIC  || "").trim();
  const BENEFICIARY = "ASSOCIATION RALE";
  const ADMIN_EMAIL = process.env.MAIL_TO || "rale.asso@gmail.com";

  const nameParts = name.split(/\s+/);
  const prenom    = esc(nameParts[0] || "");
  const nom       = esc(nameParts.slice(1).join(" ") || "");

  // ── Enregistrement MongoDB ─────────────────────────────────
  try {
    await Donation.create({
      refId,
      methode:  methodeOk,
      montant,
      donateur: {
        prenom: nameParts[0]?.slice(0, 100) || "",
        nom:    nameParts.slice(1).join(" ")?.slice(0, 100) || "",
        email,
      },
      statut: "en_attente",
    });
  } catch (e) {
    console.error("Sauvegarde don MongoDB :", e.message);
  }

  // ── QR Code EPC (virement uniquement) ──────────────────────
  let qrCodeDataUrl = null;
  if (methodeOk === "virement" && IBAN && BIC && !IBAN.includes("XXXX")) {
    try {
      const epcStr = buildEpcString({
        bic:       BIC,
        name:      BENEFICIARY,
        iban:      IBAN,
        amountEur: montant,
        reference: refId,
      });
      qrCodeDataUrl = await QRCode.toDataURL(epcStr, {
        errorCorrectionLevel: "M",
        scale:  5,
        margin: 2,
        color:  { dark: "#1B5E78", light: "#FFFFFF" },
      });
    } catch (e) {
      console.warn("Génération QR Code EPC :", e.message);
    }
  }

  // ── Blocs HTML pour l'email ────────────────────────────────
  const blocVirement = `
    <h3 style="color:#1B5E78;margin:0 0 14px;font-size:16px;">Coordonnées pour votre virement</h3>
    <div style="background:#f0f5f7;border-radius:10px;padding:20px;margin:0 0 16px;font-size:14px;color:#1e2a30;">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:7px 0;font-weight:600;width:160px;color:#5a6e78;">Bénéficiaire</td>
            <td style="padding:7px 0;font-weight:700;">ASSOCIATION RALE</td></tr>
        <tr><td style="padding:7px 0;font-weight:600;color:#5a6e78;">IBAN</td>
            <td style="padding:7px 0;font-family:monospace;letter-spacing:1px;">${esc(IBAN) || "— (non configuré)"}</td></tr>
        <tr><td style="padding:7px 0;font-weight:600;color:#5a6e78;">BIC / SWIFT</td>
            <td style="padding:7px 0;font-family:monospace;">${esc(BIC) || "— (non configuré)"}</td></tr>
        <tr><td style="padding:7px 0;font-weight:600;color:#5a6e78;">Montant</td>
            <td style="padding:7px 0;font-weight:700;color:#3A8C6E;">${montantStr} €</td></tr>
        <tr style="background:#e8f4f8;"><td style="padding:9px;font-weight:700;color:#1B5E78;border-radius:6px 0 0 6px;">Référence <em>(obligatoire)</em></td>
            <td style="padding:9px;font-family:monospace;font-weight:800;color:#1B5E78;font-size:17px;letter-spacing:1px;">${esc(refId)}</td></tr>
      </table>
    </div>
    <div style="background:#fff8e1;border-left:4px solid #E07B39;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 20px;font-size:13px;color:#5a6e78;">
      <strong>Important :</strong> Indiquez impérativement <strong>${esc(refId)}</strong>
      dans le libellé de votre virement. Sans cette référence, nous ne pourrons pas identifier votre don.
    </div>
    ${qrCodeDataUrl ? `
    <div style="text-align:center;margin:0 0 20px;">
      <p style="color:#5a6e78;font-size:13px;margin:0 0 12px;font-weight:600;">
        Paiement rapide par QR Code
      </p>
      <img src="${qrCodeDataUrl}" alt="QR Code virement SEPA" style="width:180px;height:180px;border-radius:8px;display:block;margin:0 auto 8px;"/>
      <p style="color:#8a9ba8;font-size:12px;margin:0;">Scannez avec votre appli bancaire (BNP, Crédit Agricole, Société Générale, La Banque Postale…)</p>
    </div>` : ""}`;

  const blocCheque = `
    <h3 style="color:#1B5E78;margin:0 0 14px;font-size:16px;">Envoyez votre chèque</h3>
    <div style="background:#f0f5f7;border-radius:10px;padding:20px;margin:0 0 16px;font-size:14px;color:#1e2a30;">
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:7px 0;font-weight:600;width:160px;color:#5a6e78;">À l'ordre de</td>
            <td style="padding:7px 0;font-weight:700;">ASSOCIATION RALE</td></tr>
        <tr><td style="padding:7px 0;font-weight:600;color:#5a6e78;">Montant</td>
            <td style="padding:7px 0;font-weight:700;color:#3A8C6E;">${montantStr} €</td></tr>
        <tr><td style="padding:7px 0;font-weight:600;color:#5a6e78;">Adresse</td>
            <td style="padding:7px 0;">Association RALE<br>6 Chemin des écoliers<br>78270 Bonnières-sur-Seine</td></tr>
        <tr style="background:#e8f4f8;"><td style="padding:9px;font-weight:700;color:#1B5E78;border-radius:6px 0 0 6px;">Au dos du chèque <em>(obligatoire)</em></td>
            <td style="padding:9px;font-family:monospace;font-weight:800;color:#1B5E78;font-size:17px;letter-spacing:1px;">${esc(refId)}</td></tr>
      </table>
    </div>
    <div style="background:#fff8e1;border-left:4px solid #E07B39;padding:12px 16px;border-radius:0 8px 8px 0;margin:0 0 20px;font-size:13px;color:#5a6e78;">
      <strong>Important :</strong> Notez <strong>${esc(refId)}</strong> au dos du chèque.
    </div>`;

  // ── Email au donateur ──────────────────────────────────────
  await mail({
    to:      email,
    subject: `[RALE] Instructions pour votre don de ${montantStr} € — Réf. ${refId}`,
    text: methodeOk === "virement"
      ? `Merci ${name} pour votre intention de don de ${montantStr} € à l'Association RALE.\n\nVirement bancaire :\nBénéficiaire : ASSOCIATION RALE\nIBAN : ${IBAN}\nBIC : ${BIC}\nMontant : ${montantStr} €\nRéférence (OBLIGATOIRE) : ${refId}\n\nDéduction fiscale : votre don de ${montantStr} € ne vous coûtera que ${netStr} € (66 % de réduction, art. 200 CGI). Un reçu fiscal vous sera envoyé à réception.\n\nL'équipe RALE — 07 49 96 63 33`
      : `Merci ${name} pour votre intention de don de ${montantStr} € à l'Association RALE.\n\nChèque à l'ordre de : ASSOCIATION RALE\nMontant : ${montantStr} €\nAdresse : Association RALE, 6 Chemin des écoliers, 78270 Bonnières-sur-Seine\nÀ inscrire au dos (OBLIGATOIRE) : ${refId}\n\nDéduction fiscale : votre don de ${montantStr} € ne vous coûtera que ${netStr} € (66 % de réduction, art. 200 CGI). Un reçu fiscal vous sera envoyé à réception.\n\nL'équipe RALE — 07 49 96 63 33`,
    html: tpl(`Instructions — Don ${montantStr} € — Réf. ${refId}`, `
      <h2 style="color:#3A8C6E;margin:0 0 16px;">Merci infiniment, ${prenom} !</h2>
      <div style="text-align:center;background:#f0f5f7;border-radius:12px;padding:20px;margin:0 0 20px;">
        <p style="color:#1B5E78;font-size:36px;font-weight:800;margin:0;">${montantStr} €</p>
        <p style="color:#3A8C6E;font-size:14px;margin:8px 0 0;">Votre intention de don</p>
      </div>
      <p style="color:#1e2a30;font-size:15px;line-height:1.7;margin:0 0 20px;">
        Votre soutien est précieux pour l'Association RALE et les familles
        que nous accompagnons. Voici comment finaliser votre don :
      </p>
      ${methodeOk === "virement" ? blocVirement : blocCheque}
      <div style="background:#f0f5f7;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
        <p style="margin:0;color:#5a6e78;font-size:14px;line-height:1.6;">
          <strong>Déduction fiscale :</strong> Votre don est déductible à hauteur de
          <strong>66 % de votre impôt sur le revenu</strong> (art. 200 du CGI).
          Votre don de <strong>${montantStr} €</strong> ne vous coûtera en réalité que <strong>${netStr} €</strong>.
          Un reçu fiscal officiel vous sera adressé dès réception de votre paiement.
        </p>
      </div>
      <p style="color:#5a6e78;font-size:14px;margin:0;">
        Une question ? Contactez-nous au
        <a href="tel:+33749966333" style="color:#1B5E78;">07 49 96 63 33</a>
        ou à <a href="mailto:rale.asso@gmail.com" style="color:#1B5E78;">rale.asso@gmail.com</a><br><br>
        Avec toute notre gratitude,<br>
        <strong style="color:#1e2a30;">L'équipe de l'Association RALE</strong>
      </p>
    `),
  });

  // ── Email à l'admin ────────────────────────────────────────
  await mail({
    to:      ADMIN_EMAIL,
    subject: `[RALE] Nouvelle intention de don : ${montantStr} € — ${name} (${methodeOk === "virement" ? "Virement" : "Chèque"})`,
    text:    `Don enregistré.\nMontant : ${montantStr} €\nDonateur : ${name}\nEmail : ${email}\nMéthode : ${methodeOk}\nRéférence : ${refId}\nStatut : en attente de réception`,
    html: tpl("Nouvelle intention de don", `
      <h2 style="color:#3A8C6E;margin:0 0 20px;">Nouvelle intention de don</h2>
      <div style="text-align:center;background:linear-gradient(135deg,#3A8C6E,#1B5E78);border-radius:12px;padding:28px;margin:0 0 24px;">
        <p style="color:rgba(255,255,255,.7);margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Montant attendu</p>
        <p style="color:#fff;font-size:46px;font-weight:800;margin:0;line-height:1;">${montantStr} €</p>
        <p style="color:rgba(255,255,255,.8);margin:8px 0 0;font-size:14px;">${methodeOk === "virement" ? "🏦 Virement bancaire" : "📬 Chèque postal"}</p>
      </div>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#1e2a30;">
        <tr style="background:#f0f5f7;"><td style="padding:10px 14px;font-weight:600;width:150px;">Donateur</td>
          <td style="padding:10px 14px;">${prenom} ${nom}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Email</td>
          <td style="padding:10px 14px;"><a href="mailto:${esc(email)}" style="color:#1B5E78;">${esc(email)}</a></td></tr>
        <tr style="background:#f0f5f7;"><td style="padding:10px 14px;font-weight:600;">Méthode</td>
          <td style="padding:10px 14px;">${methodeOk === "virement" ? "Virement bancaire" : "Chèque"}</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Référence</td>
          <td style="padding:10px 14px;font-family:monospace;font-weight:700;color:#1B5E78;font-size:15px;">${esc(refId)}</td></tr>
        <tr style="background:#f0f5f7;"><td style="padding:10px 14px;font-weight:600;">Statut</td>
          <td style="padding:10px 14px;color:#E07B39;font-weight:600;">⏳ En attente de réception</td></tr>
        <tr><td style="padding:10px 14px;font-weight:600;">Date</td>
          <td style="padding:10px 14px;">${new Date().toLocaleString("fr-FR")}</td></tr>
      </table>
      <div style="background:#f0f5f7;border-left:4px solid #3A8C6E;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0 0;font-size:13px;color:#5a6e78;">
        Les instructions de paiement ont été envoyées au donateur. Confirmez la réception
        dans votre tableau de bord admin une fois le virement/chèque reçu.
      </div>
    `),
  });

  return res.json({
    success:      true,
    refId,
    methode:      methodeOk,
    montant,
    iban:         IBAN,
    bic:          BIC,
    beneficiary:  BENEFICIARY,
    qrCodeDataUrl,
  });
});

export default router;
