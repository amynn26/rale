import express  from "express";
import crypto   from "crypto";
import Donation from "../models/Donation.js";
import { genId, esc, tpl, mail } from "../config/mailer.js";

const router = express.Router();

const RE_EMAIL = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// POST /api/webhook/helloasso
// IMPORTANT : cette route utilise express.raw() — elle doit être montée
// AVANT express.json() dans server.js pour recevoir le corps brut.
router.post(
  "/helloasso",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    // Vérification de signature HMAC (si secret configuré)
    if (process.env.HELLOASSO_SECRET) {
      const sig      = req.headers["x-helloasso-signature"];
      const expected = crypto
        .createHmac("sha256", process.env.HELLOASSO_SECRET)
        .update(req.body)
        .digest("hex");
      if (sig !== expected) {
        console.warn("⚠  Webhook HelloAsso : signature invalide");
        return res.status(401).json({ error: "Signature invalide" });
      }
    }

    let payload;
    try {
      payload = JSON.parse(req.body.toString());
    } catch {
      return res.status(400).json({ error: "JSON invalide" });
    }

    console.log(`📩 Webhook HelloAsso : ${payload.eventType || "type inconnu"}`);

    const ADMIN_EMAIL = process.env.MAIL_TO || "rale.asso@gmail.com";

    // ── Don / commande réussie ─────────────────────────────────────
    if (payload.eventType === "Order" && payload.data) {
      const order  = payload.data;
      const payer  = order.payer || {};
      const cents  = order.amount?.total ?? 0;
      const amount = (cents / 100).toFixed(2);
      const prenom = esc(payer.firstName || "Donateur");
      const nom    = esc(payer.lastName  || "");
      const email  = payer.email || "";
      const refHA  = esc(String(order.id || "N/A"));

      try {
        await Donation.create({
          refId:        genId(),
          eventType:    payload.eventType,
          montant:      cents / 100,
          donateur:     { prenom: payer.firstName || "", nom: payer.lastName || "", email },
          refHelloAsso: String(order.id || ""),
          rawData:      payload.data,
        });
      } catch (e) {
        console.error("Sauvegarde donation MongoDB :", e.message);
      }

      // Notification admin
      await mail({
        to:      ADMIN_EMAIL,
        subject: `[RALE] Nouveau don : ${amount} € — ${payer.firstName} ${payer.lastName}`,
        text:    `Montant : ${amount} €\nDonateur : ${payer.firstName} ${payer.lastName}\nEmail : ${email || "—"}\nRéférence HelloAsso : ${order.id || "N/A"}`,
        html: tpl("Nouveau don reçu !", `
          <h2 style="color:#3A8C6E;margin:0 0 20px;">Nouveau don reçu !</h2>
          <div style="text-align:center;background:linear-gradient(135deg,#3A8C6E,#1B5E78);border-radius:12px;padding:28px;margin:0 0 24px;">
            <p style="color:rgba(255,255,255,.7);margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Montant reçu</p>
            <p style="color:#fff;font-size:46px;font-weight:800;margin:0;line-height:1;">${amount} €</p>
          </div>
          <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#1e2a30;">
            <tr style="background:#f0f5f7;">
              <td style="padding:10px 14px;font-weight:600;width:150px;">Donateur</td>
              <td style="padding:10px 14px;">${prenom} ${nom}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:600;">Email</td>
              <td style="padding:10px 14px;">${email ? `<a href="mailto:${esc(email)}" style="color:#1B5E78;">${esc(email)}</a>` : "—"}</td></tr>
            <tr style="background:#f0f5f7;">
              <td style="padding:10px 14px;font-weight:600;">Réf. HelloAsso</td>
              <td style="padding:10px 14px;font-family:monospace;">${refHA}</td></tr>
            <tr><td style="padding:10px 14px;font-weight:600;">Date</td>
              <td style="padding:10px 14px;">${new Date().toLocaleString("fr-FR")}</td></tr>
          </table>
        `),
      });

      // E-mail de remerciement au donateur
      if (email && RE_EMAIL.test(email)) {
        await mail({
          to:      email,
          subject: "[RALE] Merci pour votre généreux don !",
          text:    `Merci ${payer.firstName} pour votre don de ${amount} € !\n\nVotre soutien aide les familles que nous accompagnons.\n\nDéduction fiscale : 66 % de votre impôt. Un reçu fiscal vous sera adressé par HelloAsso.\n\nL'équipe RALE`,
          html: tpl("Merci pour votre don !", `
            <h2 style="color:#3A8C6E;margin:0 0 16px;">Merci infiniment, ${prenom} !</h2>
            <div style="text-align:center;background:#f0f5f7;border-radius:12px;padding:20px;margin:0 0 20px;">
              <p style="color:#1B5E78;font-size:36px;font-weight:800;margin:0;">${amount} €</p>
              <p style="color:#3A8C6E;font-size:14px;margin:8px 0 0;">Votre don généreux</p>
            </div>
            <p style="color:#1e2a30;font-size:15px;line-height:1.7;margin:0 0 16px;">
              Votre soutien est précieux pour l'Association RALE et les familles
              d'enfants autistes que nous accompagnons au quotidien.
              Grâce à des personnes comme vous, notre mission continue.
            </p>
            <div style="background:#f0f5f7;border-radius:8px;padding:14px 18px;margin:0 0 20px;">
              <p style="margin:0;color:#5a6e78;font-size:14px;line-height:1.6;">
                <strong>Déduction fiscale :</strong> Votre don est déductible à hauteur de
                <strong>66 % de votre impôt sur le revenu</strong>.
                HelloAsso vous adressera un reçu fiscal automatiquement.
              </p>
            </div>
            <p style="color:#5a6e78;font-size:14px;margin:0;">
              Avec toute notre gratitude,<br>
              <strong style="color:#1e2a30;">L'équipe de l'Association RALE</strong>
            </p>
          `),
        });
      }

      return res.json({ received: true });
    }

    // ── Paiement individuel (succès, refus, remboursement) ────────
    if (payload.eventType === "Payment" && payload.data) {
      const payment = payload.data;
      const state   = payment.state || "";
      const payer   = payment.payer || {};
      const cents   = payment.amount ?? 0;
      const amount  = (cents / 100).toFixed(2);
      const refHA   = String(payment.id || "N/A");

      try {
        await Donation.create({
          refId:        genId(),
          eventType:    `Payment_${state}`,
          montant:      cents / 100,
          donateur:     { prenom: payer.firstName || "", nom: payer.lastName || "", email: payer.email || "" },
          refHelloAsso: refHA,
          rawData:      payload.data,
        });
      } catch (e) {
        console.error("Sauvegarde paiement MongoDB :", e.message);
      }

      // Alerte admin sur les paiements refusés ou remboursés
      if (["Refunded", "Refused", "Cancelled"].includes(state)) {
        const stateLabels = { Refunded: "Remboursé", Refused: "Refusé", Cancelled: "Annulé" };
        const label = stateLabels[state] || state;

        console.warn(`⚠  Paiement ${state} : ${amount} € — réf. ${refHA}`);

        await mail({
          to:      ADMIN_EMAIL,
          subject: `[RALE] Paiement ${label} — ${amount} €`,
          text:    `Un paiement a été ${label.toLowerCase()}.\n\nMontant : ${amount} €\nPayeur : ${payer.firstName || ""} ${payer.lastName || ""}\nEmail : ${payer.email || "—"}\nRéférence HelloAsso : ${refHA}\nStatut : ${state}`,
          html: tpl(`Paiement ${label}`, `
            <h2 style="color:#E07B39;margin:0 0 20px;">Paiement ${label}</h2>
            <div style="background:#fff8e1;border-left:4px solid #E07B39;padding:14px 18px;border-radius:0 8px 8px 0;margin:0 0 20px;font-size:14px;color:#5a6e78;">
              <strong>Statut :</strong> ${label} (${state})
            </div>
            <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;color:#1e2a30;">
              <tr style="background:#f0f5f7;">
                <td style="padding:10px 14px;font-weight:600;width:150px;">Montant</td>
                <td style="padding:10px 14px;font-weight:700;color:#E07B39;">${amount} €</td></tr>
              <tr><td style="padding:10px 14px;font-weight:600;">Payeur</td>
                <td style="padding:10px 14px;">${esc(payer.firstName || "")} ${esc(payer.lastName || "")}</td></tr>
              <tr style="background:#f0f5f7;">
                <td style="padding:10px 14px;font-weight:600;">Email</td>
                <td style="padding:10px 14px;">${payer.email ? `<a href="mailto:${esc(payer.email)}" style="color:#1B5E78;">${esc(payer.email)}</a>` : "—"}</td></tr>
              <tr><td style="padding:10px 14px;font-weight:600;">Réf. HelloAsso</td>
                <td style="padding:10px 14px;font-family:monospace;">${esc(refHA)}</td></tr>
              <tr style="background:#f0f5f7;">
                <td style="padding:10px 14px;font-weight:600;">Date</td>
                <td style="padding:10px 14px;">${new Date().toLocaleString("fr-FR")}</td></tr>
            </table>
          `),
        });
      }

      return res.json({ received: true });
    }

    // ── Autres types d'événements : on sauvegarde pour traçabilité ─
    console.log(`ℹ  Événement HelloAsso non géré : ${payload.eventType}`);
    try {
      await Donation.create({
        refId:     genId(),
        eventType: payload.eventType || "unknown",
        rawData:   payload.data || payload,
      });
    } catch (e) {
      console.error("Sauvegarde événement HelloAsso MongoDB :", e.message);
    }

    return res.json({ received: true });
  }
);

export default router;
