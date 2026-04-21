import nodemailer from "nodemailer";
import crypto from "crypto";

const IS_PROD = process.env.NODE_ENV === "production";

// ── Génère un identifiant unique court ─────────────────────────
export function genId() {
  return crypto.randomBytes(8).toString("hex").toUpperCase();
}

// ── Échappe les caractères HTML dangereux ──────────────────────
export function esc(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

// ── Gabarit email HTML ─────────────────────────────────────────
export function tpl(title, body) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f5f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f5f7;padding:32px 16px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;width:100%;background:#fff;border-radius:12px;
                  overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
      <tr>
        <td style="background:#1B5E78;padding:28px 32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Association RALE</h1>
          <p style="margin:6px 0 0;color:#a8d4e6;font-size:13px;">Répit pour Autistes et Loisirs Éducatifs</p>
        </td>
      </tr>
      <tr>
        <td style="padding:32px;">${body}</td>
      </tr>
      <tr>
        <td style="background:#f8fafb;padding:18px 32px;border-top:1px solid #e8eef2;text-align:center;">
          <p style="margin:0;color:#8a9ba8;font-size:12px;">
            Association RALE — 6 Chemin des écoliers, 78270 Bonnières-sur-Seine<br>
            <a href="mailto:rale.asso@gmail.com" style="color:#1B5E78;">rale.asso@gmail.com</a>
            &nbsp;·&nbsp;
            <a href="tel:+33749966333" style="color:#1B5E78;">07 49 96 63 33</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Crée le transporteur SMTP ──────────────────────────────────
function makeTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls:    { rejectUnauthorized: IS_PROD },
  });
}

// ── Envoie un email ────────────────────────────────────────────
export async function mail(opts) {
  const t = makeTransporter();
  if (!t) {
    console.log(`⚠  SMTP non configuré — email ignoré : "${opts.subject}"`);
    return false;
  }
  try {
    await t.sendMail({ from: `"Association RALE" <${process.env.SMTP_USER}>`, ...opts });
    console.log(`✉  Email envoyé : "${opts.subject}" → ${opts.to}`);
    return true;
  } catch (err) {
    console.error("✗  Erreur email :", err.message);
    return false;
  }
}
