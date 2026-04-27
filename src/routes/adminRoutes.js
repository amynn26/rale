import express    from "express";
import Donation  from "../models/Donation.js";
import Adhesion  from "../models/Adhesion.js";
import Contact   from "../models/Contact.js";
import Newsletter from "../models/Newsletter.js";

const router = express.Router();

function requireAdminKey(req, res, next) {
  const key      = process.env.ADMIN_KEY;
  const provided = req.query.key ||
    (req.headers.authorization || "").replace(/^Bearer\s+/i, "");

  if (!key || key === "changez_cette_cle_maintenant") {
    return res.status(503).json({ error: "ADMIN_KEY non sécurisée — configurez-la dans .env" });
  }
  if (!provided || provided !== key) {
    return res.status(401).json({ error: "Clé API admin invalide." });
  }
  next();
}

router.use(requireAdminKey);

// Échappe le HTML pour éviter XSS dans le tableau de bord
function h(str) {
  if (str == null) return "—";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Tableau de bord HTML ───────────────────────────────────────
router.get("/", async (req, res) => {
  const [donations, adhesions, contacts, newsletter] = await Promise.all([
    Donation.find().sort({ createdAt: -1 }).limit(500).lean(),
    Adhesion.find().sort({ createdAt: -1 }).limit(200).lean(),
    Contact.find().sort({ createdAt: -1 }).limit(200).lean(),
    Newsletter.find().sort({ createdAt: -1 }).limit(500).lean(),
  ]);

  const donsReçus     = donations.filter(d => d.statut === "reçu");
  const totalDons     = donsReçus.reduce((s, d) => s + (d.montant || 0), 0);
  const nbDonsReçus   = donsReçus.length;
  const nbDonsAttente = donations.filter(d => d.statut === "en_attente").length;
  const nbAdhesions   = adhesions.length;
  const nbContacts    = contacts.length;
  const nbNewsletter  = newsletter.filter(n => n.active).length;

  const fmt     = (n) => (n ?? 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => d ? new Date(d).toLocaleString("fr-FR") : "—";

  const statutLabel = {
    en_attente: '<span style="color:#E07B39;font-weight:600;">⏳ En attente</span>',
    "reçu":     '<span style="color:#3A8C6E;font-weight:600;">✅ Reçu</span>',
    annulé:     '<span style="color:#DC2626;font-weight:600;">❌ Annulé</span>',
  };

  const methodeLabel = { virement: "🏦 Virement", cheque: "📬 Chèque" };
  const statutAdh    = { en_attente: "⏳ En attente", validé: "✅ Validé", refusé: "❌ Refusé" };

  const donRows = donations.map(d => `
    <tr id="don-row-${d._id}">
      <td>${fmtDate(d.createdAt)}</td>
      <td>${methodeLabel[d.methode] || h(d.methode)}</td>
      <td style="text-align:right;font-weight:600;color:#3A8C6E;">${d.montant ? fmt(d.montant) + " €" : "—"}</td>
      <td>${h(d.donateur?.prenom)} ${h(d.donateur?.nom)}</td>
      <td>${d.donateur?.email ? `<a href="mailto:${h(d.donateur.email)}">${h(d.donateur.email)}</a>` : "—"}</td>
      <td><code style="font-size:11px;background:#f0f5f7;padding:2px 6px;border-radius:4px;">${h(d.refId)}</code></td>
      <td id="don-statut-${d._id}">${statutLabel[d.statut] || h(d.statut)}</td>
      <td>
        ${d.statut !== "reçu"   ? `<button onclick="majDon('${d._id}','reçu')"   style="margin:2px;padding:4px 10px;background:#3A8C6E;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">✅ Reçu</button>`   : ""}
        ${d.statut !== "annulé" ? `<button onclick="majDon('${d._id}','annulé')" style="margin:2px;padding:4px 10px;background:#DC2626;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">❌ Annuler</button>` : ""}
        ${d.statut !== "en_attente" ? `<button onclick="majDon('${d._id}','en_attente')" style="margin:2px;padding:4px 10px;background:#E07B39;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">⏳ Remettre en attente</button>` : ""}
      </td>
    </tr>`).join("");

  const adhRows = adhesions.map(a => `
    <tr id="adh-row-${a._id}">
      <td>${fmtDate(a.createdAt)}</td>
      <td>${h(a.prenom)} ${h(a.nom)}</td>
      <td><a href="mailto:${h(a.email)}">${h(a.email)}</a></td>
      <td>${h(a.telephone)}</td>
      <td>${h(a.typeAdhesion)}</td>
      <td id="adh-statut-${a._id}">${statutAdh[a.statut] || h(a.statut)}</td>
      <td style="font-size:12px;color:#5a6e78;max-width:220px;">${h(a.motivation) || "—"}</td>
      <td>
        ${a.statut !== "validé"     ? `<button onclick="majAdh('${a._id}','validé')"     style="margin:2px;padding:4px 10px;background:#3A8C6E;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">✅ Valider</button>`     : ""}
        ${a.statut !== "refusé"     ? `<button onclick="majAdh('${a._id}','refusé')"     style="margin:2px;padding:4px 10px;background:#DC2626;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">❌ Refuser</button>`     : ""}
        ${a.statut !== "en_attente" ? `<button onclick="majAdh('${a._id}','en_attente')" style="margin:2px;padding:4px 10px;background:#E07B39;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">⏳ En attente</button>` : ""}
      </td>
    </tr>`).join("");

  const ctRows = contacts.map(c => `
    <tr>
      <td>${fmtDate(c.createdAt)}</td>
      <td>${h(c.prenom)} ${h(c.nom)}</td>
      <td><a href="mailto:${h(c.email)}">${h(c.email)}</a></td>
      <td>${h(c.sujet)}</td>
      <td style="font-size:12px;max-width:300px;word-wrap:break-word;">${h(c.message)}</td>
    </tr>`).join("");

  const nlRows = newsletter.map(n => `
    <tr>
      <td>${fmtDate(n.createdAt)}</td>
      <td>${h(n.prenom)}</td>
      <td><a href="mailto:${h(n.email)}">${h(n.email)}</a></td>
      <td style="text-align:center;">${n.active ? "✅ Actif" : "❌ Désabonné"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Administration — Association RALE</title>
  <style>
    *{box-sizing:border-box}
    body{margin:0;padding:0;background:#f0f5f7;font-family:Arial,Helvetica,sans-serif;color:#1e2a30}
    header{background:#1B5E78;color:#fff;padding:20px 32px;display:flex;align-items:center;justify-content:space-between}
    header h1{margin:0;font-size:20px}
    header span{font-size:13px;opacity:.7}
    .container{max-width:1400px;margin:0 auto;padding:24px 20px}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin:0 0 32px}
    .stat{background:#fff;border-radius:10px;padding:20px;text-align:center;box-shadow:0 1px 6px rgba(0,0,0,.07)}
    .stat .val{font-size:32px;font-weight:800;color:#1B5E78;line-height:1}
    .stat .lbl{font-size:13px;color:#5a6e78;margin:6px 0 0}
    .stat.green .val{color:#3A8C6E}
    .stat.orange .val{color:#E07B39}
    .section{background:#fff;border-radius:10px;box-shadow:0 1px 6px rgba(0,0,0,.07);margin:0 0 32px;overflow:hidden}
    .section-header{background:#1B5E78;color:#fff;padding:14px 20px;font-size:15px;font-weight:600}
    .section-header.green{background:#3A8C6E}
    .section-header.orange{background:#E07B39}
    .section-header.teal{background:#2a7a8e}
    .scroll{overflow-x:auto}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f8fafb;padding:10px 14px;text-align:left;font-weight:600;color:#1B5E78;border-bottom:2px solid #e8eef2;white-space:nowrap}
    td{padding:9px 14px;border-bottom:1px solid #f0f5f7;vertical-align:top}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#fafcfd}
    a{color:#1B5E78}
    code{background:#f0f5f7;padding:2px 5px;border-radius:4px;font-size:11px}
    .empty{padding:20px;text-align:center;color:#5a6e78;font-size:14px}
    .warning{background:#fff8e1;border-left:4px solid #E07B39;padding:12px 16px;margin:0 0 24px;border-radius:0 8px 8px 0;font-size:14px;color:#5a6e78}
  </style>
</head>
<body>
<header>
  <h1>Administration — Association RALE</h1>
  <span>Généré le ${new Date().toLocaleString("fr-FR")}</span>
</header>
<div class="container">

  ${(!process.env.ASSO_IBAN || process.env.ASSO_IBAN.includes("XXXX")) ? `
  <div class="warning">
    <strong>⚠ IBAN non configuré</strong> — Les donateurs reçoivent un IBAN vide.
    Renseignez <code>ASSO_IBAN</code> et <code>ASSO_BIC</code> dans le fichier <code>.env</code>.
  </div>` : ""}

  <div class="stats">
    <div class="stat green">
      <div class="val">${fmt(totalDons)} €</div>
      <div class="lbl">Dons reçus</div>
    </div>
    <div class="stat">
      <div class="val">${nbDonsReçus}</div>
      <div class="lbl">Dons confirmés</div>
    </div>
    <div class="stat orange">
      <div class="val">${nbDonsAttente}</div>
      <div class="lbl">En attente</div>
    </div>
    <div class="stat">
      <div class="val">${nbAdhesions}</div>
      <div class="lbl">Adhésions</div>
    </div>
    <div class="stat">
      <div class="val">${nbContacts}</div>
      <div class="lbl">Messages</div>
    </div>
    <div class="stat">
      <div class="val">${nbNewsletter}</div>
      <div class="lbl">Abonnés newsletter</div>
    </div>
  </div>

  <div class="section">
    <div class="section-header green">Dons &amp; Intentions (${donations.length})</div>
    <div class="scroll">
      ${donations.length ? `<table>
        <thead><tr>
          <th>Date</th><th>Méthode</th><th>Montant</th>
          <th>Donateur</th><th>Email</th><th>Référence</th><th>Statut</th><th>Actions</th>
        </tr></thead>
        <tbody>${donRows}</tbody>
      </table>` : '<div class="empty">Aucun don enregistré.</div>'}
    </div>
  </div>

  <div class="section">
    <div class="section-header">Adhésions (${adhesions.length})</div>
    <div class="scroll">
      ${adhesions.length ? `<table>
        <thead><tr><th>Date</th><th>Nom</th><th>Email</th><th>Téléphone</th><th>Type</th><th>Statut</th><th>Motivation</th><th>Actions</th></tr></thead>
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

<script>
const KEY = new URLSearchParams(location.search).get('key') || '';

const STATUT_DON = {
  en_attente: '<span style="color:#E07B39;font-weight:600;">⏳ En attente</span>',
  'reçu':     '<span style="color:#3A8C6E;font-weight:600;">✅ Reçu</span>',
  annulé:     '<span style="color:#DC2626;font-weight:600;">❌ Annulé</span>',
};
const STATUT_ADH = {
  en_attente: '⏳ En attente',
  validé:     '✅ Validé',
  refusé:     '❌ Refusé',
};

async function majDon(id, statut) {
  if (!confirm('Changer le statut de ce don en "' + statut + '" ?')) return;
  const r = await fetch('/api/admin/donations/' + id + '/statut?key=' + encodeURIComponent(KEY), {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ statut }),
  });
  const d = await r.json();
  if (d.success) location.reload();
  else alert('Erreur : ' + d.error);
}

async function majAdh(id, statut) {
  if (!confirm('Changer le statut de cette adhésion en "' + statut + '" ?')) return;
  const r = await fetch('/api/admin/adhesions/' + id + '/statut?key=' + encodeURIComponent(KEY), {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ statut }),
  });
  const d = await r.json();
  if (d.success) location.reload();
  else alert('Erreur : ' + d.error);
}
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Frame-Options", "DENY");
  res.send(html);
});

// ── Endpoints JSON ─────────────────────────────────────────────
router.get("/donations",  async (_req, res) => res.json(await Donation.find().sort({ createdAt: -1 }).lean()));
router.get("/adhesions",  async (_req, res) => res.json(await Adhesion.find().sort({ createdAt: -1 }).lean()));
router.get("/contacts",   async (_req, res) => res.json(await Contact.find().sort({ createdAt: -1 }).lean()));
router.get("/newsletter", async (_req, res) => res.json(await Newsletter.find().sort({ createdAt: -1 }).lean()));

// ── Mise à jour du statut d'un don ─────────────────────────────
router.post("/donations/:id/statut", async (req, res) => {
  const { statut } = req.body;
  if (!["en_attente", "reçu", "annulé"].includes(statut)) {
    return res.status(400).json({ success: false, error: "Statut invalide." });
  }
  const doc = await Donation.findByIdAndUpdate(req.params.id, { statut }, { new: true }).lean();
  if (!doc) return res.status(404).json({ success: false, error: "Don introuvable." });
  res.json({ success: true, statut: doc.statut });
});

// ── Mise à jour du statut d'une adhésion ───────────────────────
router.post("/adhesions/:id/statut", async (req, res) => {
  const { statut } = req.body;
  if (!["en_attente", "validé", "refusé"].includes(statut)) {
    return res.status(400).json({ success: false, error: "Statut invalide." });
  }
  const doc = await Adhesion.findByIdAndUpdate(req.params.id, { statut }, { new: true }).lean();
  if (!doc) return res.status(404).json({ success: false, error: "Adhésion introuvable." });
  res.json({ success: true, statut: doc.statut });
});

export default router;
