import express    from "express";
import Donation  from "../models/Donation.js";
import Adhesion  from "../models/Adhesion.js";
import Contact   from "../models/Contact.js";
import Newsletter from "../models/Newsletter.js";

const router = express.Router();

// Middleware d'authentification par clé API
function requireAdminKey(req, res, next) {
  const key = process.env.ADMIN_KEY;
  if (!key) {
    return res.status(503).json({ error: "ADMIN_KEY non configuré sur ce serveur." });
  }
  const provided =
    req.query.key ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!provided || provided !== key) {
    return res.status(401).json({ error: "Clé API admin invalide." });
  }
  next();
}

router.use(requireAdminKey);

// ── Tableau de bord HTML ───────────────────────────────────────
router.get("/", async (req, res) => {
  const [donations, adhesions, contacts, newsletter] = await Promise.all([
    Donation.find().sort({ createdAt: -1 }).limit(200).lean(),
    Adhesion.find().sort({ createdAt: -1 }).limit(200).lean(),
    Contact.find().sort({ createdAt: -1 }).limit(200).lean(),
    Newsletter.find().sort({ createdAt: -1 }).limit(500).lean(),
  ]);

  const totalDons       = donations.filter(d => d.eventType === "Order").reduce((s, d) => s + (d.montant || 0), 0);
  const nbDons          = donations.filter(d => d.eventType === "Order").length;
  const nbAdhesions     = adhesions.length;
  const nbContacts      = contacts.length;
  const nbNewsletter    = newsletter.filter(n => n.active).length;

  const fmt = (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d).toLocaleString("fr-FR") : "—";

  const statut = { en_attente: "⏳ En attente", validé: "✅ Validé", refusé: "❌ Refusé" };

  const donRows = donations.map(d => `
    <tr>
      <td>${fmtDate(d.createdAt)}</td>
      <td><code>${d.eventType || "—"}</code></td>
      <td style="text-align:right;font-weight:600;color:#3A8C6E;">${d.montant ? fmt(d.montant) + " €" : "—"}</td>
      <td>${d.donateur?.prenom || ""} ${d.donateur?.nom || ""}</td>
      <td>${d.donateur?.email ? `<a href="mailto:${d.donateur.email}">${d.donateur.email}</a>` : "—"}</td>
      <td><code style="font-size:11px;">${d.refHelloAsso || "—"}</code></td>
    </tr>`).join("");

  const adhRows = adhesions.map(a => `
    <tr>
      <td>${fmtDate(a.createdAt)}</td>
      <td>${a.prenom} ${a.nom}</td>
      <td><a href="mailto:${a.email}">${a.email}</a></td>
      <td>${a.telephone}</td>
      <td>${a.typeAdhesion}</td>
      <td>${statut[a.statut] || a.statut}</td>
      <td style="font-size:12px;color:#5a6e78;">${a.motivation || "—"}</td>
    </tr>`).join("");

  const ctRows = contacts.map(c => `
    <tr>
      <td>${fmtDate(c.createdAt)}</td>
      <td>${c.prenom} ${c.nom}</td>
      <td><a href="mailto:${c.email}">${c.email}</a></td>
      <td>${c.sujet}</td>
      <td style="font-size:12px;max-width:300px;word-wrap:break-word;">${c.message}</td>
    </tr>`).join("");

  const nlRows = newsletter.map(n => `
    <tr>
      <td>${fmtDate(n.createdAt)}</td>
      <td>${n.prenom}</td>
      <td><a href="mailto:${n.email}">${n.email}</a></td>
      <td style="text-align:center;">${n.active ? "✅ Actif" : "❌ Désabonné"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Administration — Association RALE</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; padding:0; background:#f0f5f7; font-family:Arial,Helvetica,sans-serif; color:#1e2a30; }
    header { background:#1B5E78; color:#fff; padding:20px 32px; display:flex; align-items:center; justify-content:space-between; }
    header h1 { margin:0; font-size:20px; }
    header span { font-size:13px; opacity:.7; }
    .container { max-width:1400px; margin:0 auto; padding:24px 20px; }
    .stats { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:16px; margin:0 0 32px; }
    .stat { background:#fff; border-radius:10px; padding:20px; text-align:center; box-shadow:0 1px 6px rgba(0,0,0,.07); }
    .stat .val { font-size:36px; font-weight:800; color:#1B5E78; line-height:1; }
    .stat .lbl { font-size:13px; color:#5a6e78; margin:6px 0 0; }
    .stat.green .val { color:#3A8C6E; }
    .section { background:#fff; border-radius:10px; box-shadow:0 1px 6px rgba(0,0,0,.07); margin:0 0 32px; overflow:hidden; }
    .section-header { background:#1B5E78; color:#fff; padding:14px 20px; font-size:15px; font-weight:600; }
    .section-header.green { background:#3A8C6E; }
    .section-header.orange { background:#E07B39; }
    .section-header.teal { background:#2a7a8e; }
    .scroll { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { background:#f8fafb; padding:10px 14px; text-align:left; font-weight:600; color:#1B5E78; border-bottom:2px solid #e8eef2; white-space:nowrap; }
    td { padding:9px 14px; border-bottom:1px solid #f0f5f7; vertical-align:top; }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:#fafcfd; }
    a { color:#1B5E78; }
    code { background:#f0f5f7; padding:2px 5px; border-radius:4px; font-size:11px; }
    .empty { padding:20px; text-align:center; color:#5a6e78; font-size:14px; }
    .warning { background:#fff8e1; border-left:4px solid #E07B39; padding:12px 16px; margin:0 0 24px; border-radius:0 8px 8px 0; font-size:14px; color:#5a6e78; }
  </style>
</head>
<body>
<header>
  <h1>Administration — Association RALE</h1>
  <span>Généré le ${new Date().toLocaleString("fr-FR")}</span>
</header>
<div class="container">

  ${!process.env.HELLOASSO_SECRET ? `
  <div class="warning">
    <strong>⚠ Sécurité webhook désactivée</strong> — La variable <code>HELLOASSO_SECRET</code> n'est pas configurée.
    Les webhooks HelloAsso ne sont pas vérifiés. Ajoutez le secret depuis votre espace HelloAsso &gt; Paramètres &gt; Webhooks.
  </div>` : ""}

  <div class="stats">
    <div class="stat green">
      <div class="val">${fmt(totalDons)} €</div>
      <div class="lbl">Total des dons</div>
    </div>
    <div class="stat">
      <div class="val">${nbDons}</div>
      <div class="lbl">Dons reçus</div>
    </div>
    <div class="stat">
      <div class="val">${nbAdhesions}</div>
      <div class="lbl">Adhésions</div>
    </div>
    <div class="stat">
      <div class="val">${nbContacts}</div>
      <div class="lbl">Messages reçus</div>
    </div>
    <div class="stat">
      <div class="val">${nbNewsletter}</div>
      <div class="lbl">Abonnés newsletter</div>
    </div>
  </div>

  <div class="section">
    <div class="section-header green">Dons & Paiements (${donations.length})</div>
    <div class="scroll">
      ${donations.length ? `<table>
        <thead><tr><th>Date</th><th>Événement</th><th>Montant</th><th>Donateur</th><th>Email</th><th>Réf. HelloAsso</th></tr></thead>
        <tbody>${donRows}</tbody>
      </table>` : '<div class="empty">Aucun don enregistré.</div>'}
    </div>
  </div>

  <div class="section">
    <div class="section-header">Adhésions (${adhesions.length})</div>
    <div class="scroll">
      ${adhesions.length ? `<table>
        <thead><tr><th>Date</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Type</th><th>Statut</th><th>Motivation</th></tr></thead>
        <tbody>${adhRows}</tbody>
      </table>` : '<div class="empty">Aucune adhésion enregistrée.</div>'}
    </div>
  </div>

  <div class="section">
    <div class="section-header orange">Messages de contact (${contacts.length})</div>
    <div class="scroll">
      ${contacts.length ? `<table>
        <thead><tr><th>Date</th><th>Nom</th><th>Email</th><th>Sujet</th><th>Message</th></tr></thead>
        <tbody>${ctRows}</tbody>
      </table>` : '<div class="empty">Aucun message reçu.</div>'}
    </div>
  </div>

  <div class="section">
    <div class="section-header teal">Newsletter (${newsletter.length} inscrits, ${nbNewsletter} actifs)</div>
    <div class="scroll">
      ${newsletter.length ? `<table>
        <thead><tr><th>Date</th><th>Prénom</th><th>Email</th><th>Statut</th></tr></thead>
        <tbody>${nlRows}</tbody>
      </table>` : '<div class="empty">Aucun abonné.</div>'}
    </div>
  </div>

</div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ── Endpoints JSON ─────────────────────────────────────────────
router.get("/donations",  async (_req, res) => res.json(await Donation.find().sort({ createdAt: -1 }).lean()));
router.get("/adhesions",  async (_req, res) => res.json(await Adhesion.find().sort({ createdAt: -1 }).lean()));
router.get("/contacts",   async (_req, res) => res.json(await Contact.find().sort({ createdAt: -1 }).lean()));
router.get("/newsletter", async (_req, res) => res.json(await Newsletter.find().sort({ createdAt: -1 }).lean()));

export default router;
