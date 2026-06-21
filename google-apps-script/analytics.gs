/**
 * Koyrasoft — Analytics & compteur de visiteurs (Google Apps Script)
 *
 * INSTALLATION :
 * 1. https://script.google.com → coller analytics.gs (un seul fichier)
 * 2. Exécuter setup() → autoriser Google Sheets
 * 3. Déployer → Gérer les déploiements → Modifier :
 *    · Exécuter en tant que : MOI
 *    · Accès : TOUT LE MONDE  (pas « Utilisateurs avec un compte Google »)
 * 4. Test : {URL}/exec?action=ping → doit afficher du JSON sans connexion
 *
 * PIN admin : modifiable via setup() ou dans Propriétés du script (ADMIN_PIN)
 */

const ADMIN_PIN_DEFAULT = "koyra2026";
const MAX_VISIT_LOG = 500;
const SCRIPT_VERSION = "2026-06-22-v5";
const OWNER_EMAIL = "koyra.com@gmail.com";

/** ID du Google Sheet créé par setup() — secours si les propriétés du script sont vides. */
const SPREADSHEET_ID = "1gF-mA0787YEEQvXsnT5vjUS_03B2-vyZoVRnbgJd6GI";

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ADMIN_PIN")) {
    props.setProperty("ADMIN_PIN", ADMIN_PIN_DEFAULT);
  }

  saveSpreadsheetId_(SPREADSHEET_ID);
  const ss = ensureSpreadsheet_();
  shareSheetWithOwner_(ss);
  const url = ss.getUrl();
  Logger.log("Setup OK");
  Logger.log("ADMIN_PIN = " + props.getProperty("ADMIN_PIN"));
  Logger.log("Spreadsheet URL = " + url);
  return url;
}

/** Exécuter cette fonction pour afficher l’URL du Google Sheet dans les journaux. */
function showSpreadsheetUrl() {
  const url = openSpreadsheet_().getUrl();
  Logger.log("Ouvrir : " + url);
  return url;
}

/** Partage le Sheet avec koyra.com@gmail.com — exécuter si « fichier introuvable ». */
function fixSheetAccess() {
  const ss = ensureSpreadsheet_();
  shareSheetWithOwner_(ss);
  const url = ss.getUrl();
  Logger.log("Sheet partagé avec " + OWNER_EMAIL);
  Logger.log("URL = " + url);
  try {
    MailApp.sendEmail(
      OWNER_EMAIL,
      "Koyrasoft Analytics — lien Google Sheet",
      "Ouvrez vos statistiques :\n" + url
    );
    Logger.log("Email envoyé à " + OWNER_EMAIL);
  } catch (err) {
    Logger.log("Email non envoyé : " + err);
  }
  return url;
}

function shareSheetWithOwner_(ss) {
  try {
    ss.addEditor(OWNER_EMAIL);
  } catch (err) {
    Logger.log("Partage Sheet : " + err);
  }
}

/** Supprime l’ID enregistré et recrée un nouveau Google Sheet (si l’ancien est perdu). */
function resetSpreadsheet() {
  PropertiesService.getScriptProperties().deleteProperty("SPREADSHEET_ID");
  const url = setup();
  Logger.log("Nouveau sheet créé : " + url);
  return url;
}

/** Crée le Google Sheet — à exécuter uniquement depuis l’éditeur Apps Script. */
function ensureSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  const id = getSpreadsheetId_();

  if (id) {
    try {
      const ss = SpreadsheetApp.openById(id);
      if (!ss.getSheetByName("Stats")) initSheets_(ss);
      saveSpreadsheetId_(ss.getId());
      return ss;
    } catch (err) {
      Logger.log("Sheet introuvable, recréation… " + err);
      props.deleteProperty("SPREADSHEET_ID");
    }
  }

  const ss = SpreadsheetApp.create("Koyrasoft Analytics");
  saveSpreadsheetId_(ss.getId());
  initSheets_(ss);
  shareSheetWithOwner_(ss);
  Logger.log("Google Sheet créé : " + ss.getUrl());
  return ss;
}

/** Ouvre le Google Sheet existant — utilisé par l’application web déployée. */
function openSpreadsheet_() {
  const id = getSpreadsheetId_();
  if (!id) {
    throw new Error(
      "Google Sheet non configuré. Exécutez setup() dans Apps Script, puis redéployez (Exécuter : Moi)."
    );
  }

  try {
    return SpreadsheetApp.openById(id);
  } catch (err) {
    throw new Error(
      "Accès Google Sheet refusé. Redéployez l'application web avec « Exécuter en tant que : Moi » (pas « Utilisateur accédant »)."
    );
  }
}

/** Test depuis l’éditeur : simule l’appel admin (doit réussir avant déploiement). */
function verifyDeployment() {
  const result = getStats_({ pin: ADMIN_PIN_DEFAULT });
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function ping_() {
  const props = PropertiesService.getScriptProperties();
  return {
    ok: true,
    version: SCRIPT_VERSION,
    spreadsheetId: getSpreadsheetId_(),
    hasScriptProperty: Boolean(props.getProperty("SPREADSHEET_ID")),
  };
}

function getSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || SPREADSHEET_ID;
}

function saveSpreadsheetId_(id) {
  PropertiesService.getScriptProperties().setProperty("SPREADSHEET_ID", id);
}

function doGet(e) {
  const action = (e.parameter.action || "").trim();

  if (action === "admin") {
    return serveAdmin_();
  }

  let payload;

  try {
    switch (action) {
      case "track":
        payload = trackVisit_(e.parameter);
        break;
      case "stats":
        payload = getStats_(e.parameter);
        break;
      case "update":
        payload = updateStats_(e.parameter);
        break;
      case "ping":
        payload = ping_();
        break;
      default:
        payload = { ok: true, service: "Koyrasoft Analytics", version: SCRIPT_VERSION };
    }
  } catch (err) {
    payload = { ok: false, error: friendlyError_(err) };
  }

  return respond_(payload, e);
}

/** Admin hébergé sur Google — HTML intégré (pas de fichier Admin.html requis). */
function serveAdmin_() {
  return HtmlService.createHtmlOutput(getAdminHtml_())
    .setTitle("Admin — Koyrasoft")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Appelé depuis Admin.html via google.script.run */
function getStatsForAdmin(pin) {
  try {
    return getStats_({ pin: pin });
  } catch (err) {
    return { ok: false, error: friendlyError_(err) };
  }
}

/** Appelé depuis Admin.html via google.script.run */
function updateStatsForAdmin(pin, contactRequests, projectsDelivered, activeClients, notes) {
  try {
    return updateStats_({
      pin: pin,
      contactRequests: contactRequests,
      projectsDelivered: projectsDelivered,
      activeClients: activeClients,
      notes: notes,
    });
  } catch (err) {
    return { ok: false, error: friendlyError_(err) };
  }
}

function friendlyError_(err) {
  const msg = String(err.message || err);

  if (
    msg.indexOf("SpreadsheetApp.create") >= 0 ||
    msg.indexOf("SpreadsheetApp.openById") >= 0 ||
    msg.indexOf("spreadsheets") >= 0 ||
    msg.indexOf("authorization") >= 0 ||
    msg.indexOf("権限") >= 0
  ) {
    return (
      "Déploiement incorrect. Dans Apps Script : Déployer → Gérer → Modifier → " +
      "« Exécuter en tant que : Moi (koyra.com@gmail.com) » · « Accès : Tout le monde » · " +
      "puis Nouvelle version → Déployer. Collez aussi la dernière version de analytics.gs."
    );
  }

  return msg;
}

function trackVisit_(params) {
  const visitorId = (params.visitorId || "").trim();
  const page = (params.page || "/").trim();
  const referrer = (params.referrer || "").trim().slice(0, 500);
  const lang = (params.lang || "").trim().slice(0, 8);

  if (!visitorId || visitorId.length > 64) {
    throw new Error("Invalid visitor id");
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) {
    return { ok: true, skipped: true };
  }

  try {
    const ss = openSpreadsheet_();
    const stats = ss.getSheetByName("Stats");
    const visitors = ss.getSheetByName("Visitors");
    const daily = ss.getSheetByName("Daily");
    const log = ss.getSheetByName("Visits");
    const now = new Date();
    const todayKey = formatDate_(now);

    incrementStat_(stats, "total_views", 1);

    const visitorRow = findVisitorRow_(visitors, visitorId);
    const isNew = visitorRow === -1;

    if (isNew) {
      visitors.appendRow([visitorId, now, now, 1]);
      incrementStat_(stats, "unique_visitors", 1);
      incrementDaily_(daily, todayKey, 1, 1);
    } else {
      visitors.getRange(visitorRow, 3, 1, 2).setValues([[now, Number(visitors.getRange(visitorRow, 4).getValue()) + 1]]);
      incrementDaily_(daily, todayKey, 1, 0);
    }

    log.appendRow([now, page, visitorId, referrer, lang]);
    trimLog_(log, MAX_VISIT_LOG);

    return { ok: true, newVisitor: isNew };
  } catch (err) {
    Logger.log("Track ignoré : " + err);
    return { ok: true, skipped: true };
  } finally {
    lock.releaseLock();
  }
}

function getStats_(params) {
  assertPin_(params.pin);

  const ss = openSpreadsheet_();
  const statsMap = readStatsMap_(ss.getSheetByName("Stats"));
  const daily = readDaily_(ss.getSheetByName("Daily"), 30);
  const recent = readRecentVisits_(ss.getSheetByName("Visits"), 25);
  const todayKey = formatDate_(new Date());

  const viewsToday = daily.find((d) => d.date === todayKey)?.views || 0;
  const weekViews = sumDaily_(daily, 7, "views");
  const monthViews = sumDaily_(daily, 30, "views");

  return {
    ok: true,
    totalViews: Number(statsMap.total_views || 0),
    uniqueVisitors: Number(statsMap.unique_visitors || 0),
    viewsToday,
    viewsWeek: weekViews,
    viewsMonth: monthViews,
    contactRequests: Number(statsMap.contact_requests || 0),
    projectsDelivered: Number(statsMap.projects_delivered || 0),
    activeClients: Number(statsMap.active_clients || 0),
    notes: statsMap.notes || "",
    recentVisits: recent,
    daily,
    spreadsheetUrl: ss.getUrl(),
    updatedAt: new Date().toISOString(),
  };
}

function updateStats_(params) {
  assertPin_(params.pin);

  const ss = openSpreadsheet_();
  const stats = ss.getSheetByName("Stats");

  if (params.contactRequests !== undefined) {
    setStat_(stats, "contact_requests", Number(params.contactRequests) || 0);
  }
  if (params.projectsDelivered !== undefined) {
    setStat_(stats, "projects_delivered", Number(params.projectsDelivered) || 0);
  }
  if (params.activeClients !== undefined) {
    setStat_(stats, "active_clients", Number(params.activeClients) || 0);
  }
  if (params.notes !== undefined) {
    setStat_(stats, "notes", String(params.notes).slice(0, 2000));
  }

  return getStats_(params);
}

function initSheets_(ss) {
  let stats = ss.getSheetByName("Stats");
  if (!stats) stats = ss.insertSheet("Stats");
  stats.clear();
  stats.getRange(1, 1, 1, 2).setValues([["key", "value"]]);
  stats.getRange(2, 1, 7, 2).setValues([
    ["total_views", 0],
    ["unique_visitors", 0],
    ["contact_requests", 0],
    ["projects_delivered", 0],
    ["active_clients", 0],
    ["notes", ""],
    ["created_at", new Date().toISOString()],
  ]);

  let visitors = ss.getSheetByName("Visitors");
  if (!visitors) visitors = ss.insertSheet("Visitors");
  visitors.clear();
  visitors.getRange(1, 1, 1, 4).setValues([["visitor_id", "first_seen", "last_seen", "visits"]]);

  let daily = ss.getSheetByName("Daily");
  if (!daily) daily = ss.insertSheet("Daily");
  daily.clear();
  daily.getRange(1, 1, 1, 3).setValues([["date", "views", "unique"]]);

  let log = ss.getSheetByName("Visits");
  if (!log) log = ss.insertSheet("Visits");
  log.clear();
  log.getRange(1, 1, 1, 5).setValues([["timestamp", "page", "visitor_id", "referrer", "lang"]]);
}

function readStatsMap_(sheet) {
  const data = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < data.length; i++) {
    map[String(data[i][0])] = data[i][1];
  }
  return map;
}

function incrementStat_(sheet, key, delta) {
  const row = findStatRow_(sheet, key);
  if (row === -1) {
    sheet.appendRow([key, delta]);
    return;
  }
  const current = Number(sheet.getRange(row, 2).getValue()) || 0;
  sheet.getRange(row, 2).setValue(current + delta);
}

function setStat_(sheet, key, value) {
  const row = findStatRow_(sheet, key);
  if (row === -1) {
    sheet.appendRow([key, value]);
    return;
  }
  sheet.getRange(row, 2).setValue(value);
}

function findStatRow_(sheet, key) {
  const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 0), 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === key) return i + 2;
  }
  return -1;
}

function findVisitorRow_(sheet, visitorId) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const values = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === visitorId) return i + 2;
  }
  return -1;
}

function incrementDaily_(sheet, dateKey, viewsDelta, uniqueDelta) {
  const row = findDailyRow_(sheet, dateKey);
  if (row === -1) {
    sheet.appendRow([dateKey, viewsDelta, uniqueDelta]);
    return;
  }
  const views = Number(sheet.getRange(row, 2).getValue()) || 0;
  const unique = Number(sheet.getRange(row, 3).getValue()) || 0;
  sheet.getRange(row, 2, 1, 2).setValues([[views + viewsDelta, unique + uniqueDelta]]);
}

function findDailyRow_(sheet, dateKey) {
  const last = sheet.getLastRow();
  if (last < 2) return -1;
  const values = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === dateKey) return i + 2;
  }
  return -1;
}

function readDaily_(sheet, limit) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const start = Math.max(2, last - limit + 1);
  const rows = sheet.getRange(start, 1, last - start + 1, 3).getValues();
  return rows.map((r) => ({
    date: String(r[0]),
    views: Number(r[1]) || 0,
    unique: Number(r[2]) || 0,
  }));
}

function readRecentVisits_(sheet, limit) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const start = Math.max(2, last - limit + 1);
  const rows = sheet.getRange(start, 1, last - start + 1, 5).getValues();
  return rows
    .reverse()
    .map((r) => ({
      timestamp: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      page: String(r[1] || ""),
      visitorId: String(r[2] || "").slice(0, 8) + "…",
      referrer: String(r[3] || ""),
      lang: String(r[4] || ""),
    }));
}

function sumDaily_(daily, days, field) {
  const slice = daily.slice(-days);
  return slice.reduce((sum, row) => sum + (Number(row[field]) || 0), 0);
}

function trimLog_(sheet, maxRows) {
  const last = sheet.getLastRow();
  if (last <= maxRows + 1) return;
  sheet.deleteRows(2, last - maxRows - 1);
}

function formatDate_(date) {
  return Utilities.formatDate(date, "Africa/Bamako", "yyyy-MM-dd");
}

function assertPin_(pin) {
  const expected =
    PropertiesService.getScriptProperties().getProperty("ADMIN_PIN") || ADMIN_PIN_DEFAULT;
  if (!pin || String(pin) !== expected) {
    throw new Error("Code PIN incorrect");
  }
}

function respond_(payload, e) {
  const json = JSON.stringify(payload);
  const callback =
    e && e.parameter && e.parameter.callback ? String(e.parameter.callback).trim() : "";

  if (callback && /^[a-zA-Z_$][\w.$]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ")").setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
  }

  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getAdminHtml_() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — Koyrasoft</title>
  <style>
    :root { --bg:#05070d; --card:rgba(255,255,255,.07); --stroke:rgba(255,255,255,.12); --text:#f8fafc; --muted:#a9b4c7; --gold:#d9a22a; --gold-light:#f2c768; }
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Inter,system-ui,sans-serif; background:linear-gradient(180deg,#05070d,#070915); color:var(--text); padding:24px; min-height:100vh; }
    a { color:var(--gold-light); }
    .shell { max-width:1100px; margin:0 auto; }
    .card { background:var(--card); border:1px solid var(--stroke); border-radius:20px; padding:24px; }
    .login { max-width:420px; margin:60px auto 0; }
    .field { display:grid; gap:8px; margin-bottom:16px; }
    .field label { font-size:.82rem; color:var(--muted); font-weight:600; }
    .field input, .field textarea { width:100%; padding:12px 14px; border-radius:12px; border:1px solid var(--stroke); background:rgba(255,255,255,.04); color:var(--text); font:inherit; }
    .field textarea { min-height:100px; resize:vertical; }
    .btn { border:0; border-radius:999px; padding:10px 18px; font-weight:700; cursor:pointer; font-size:.88rem; }
    .btn-primary { background:linear-gradient(135deg,var(--gold-light),#e7e9ee); color:#070707; }
    .btn-ghost { background:rgba(255,255,255,.06); border:1px solid var(--stroke); color:var(--text); }
    .alert { border-radius:12px; padding:12px 14px; margin-bottom:16px; font-size:.88rem; }
    .alert-error { background:rgba(255,107,107,.12); border:1px solid rgba(255,107,107,.35); color:#ffb4b4; }
    .alert-info { background:rgba(60,121,255,.12); border:1px solid rgba(60,121,255,.35); color:#b8d0ff; }
    .header { display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:24px; align-items:center; }
    .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; margin-bottom:24px; }
    .stat { padding:18px; border-radius:16px; background:rgba(255,255,255,.04); border:1px solid var(--stroke); }
    .stat span { display:block; font-size:.78rem; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }
    .stat strong { font-size:1.75rem; font-weight:800; }
    .grid { display:grid; grid-template-columns:1.1fr .9fr; gap:20px; margin-bottom:24px; }
    .form-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .chart-row { display:grid; grid-template-columns:72px 1fr 36px; gap:10px; align-items:center; font-size:.82rem; margin-bottom:8px; }
    .bar-track { height:8px; border-radius:999px; background:rgba(255,255,255,.08); overflow:hidden; }
    .bar-fill { height:100%; background:linear-gradient(90deg,var(--gold),var(--gold-light)); }
    table { width:100%; border-collapse:collapse; font-size:.84rem; }
    th,td { text-align:left; padding:10px 8px; border-bottom:1px solid rgba(255,255,255,.08); }
    th { color:var(--muted); font-size:.76rem; text-transform:uppercase; }
    .meta { color:var(--muted); font-size:.82rem; margin-top:12px; }
    [hidden] { display:none !important; }
    @media (max-width:900px) { .stats { grid-template-columns:repeat(2,1fr); } .grid, .form-grid { grid-template-columns:1fr; } }
    @media (max-width:520px) { .stats { grid-template-columns:1fr; } body { padding:16px; } }
  </style>
</head>
<body>
  <div class="shell">
    <section id="loginView" class="card login">
      <h2>Administration Koyrasoft</h2>
      <p class="meta" style="margin-bottom:16px">Tableau de bord hébergé sur Google Apps Script — aucun problème de connexion.</p>
      <div id="loginError" class="alert alert-error" hidden></div>
      <form id="loginForm">
        <div class="field">
          <label for="pinInput">Code PIN</label>
          <input id="pinInput" type="password" required placeholder="PIN admin">
        </div>
        <button type="submit" class="btn btn-primary">Accéder</button>
      </form>
    </section>

    <section id="dashboardView" hidden>
      <div class="header">
        <div>
          <h1>Statistiques Koyrasoft</h1>
          <p class="meta">Compteur visiteurs + stats métier</p>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn btn-ghost" id="refreshBtn">Actualiser</button>
          <button type="button" class="btn btn-ghost" id="logoutBtn">Déconnexion</button>
          <a class="btn btn-primary" href="https://koyrasoft.github.io/" target="_blank" rel="noopener">Voir le site</a>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><span>Visites totales</span><strong id="statTotalViews">—</strong></div>
        <div class="stat"><span>Visiteurs uniques</span><strong id="statUniqueVisitors">—</strong></div>
        <div class="stat"><span>Aujourd'hui</span><strong id="statViewsToday">—</strong></div>
        <div class="stat"><span>7 jours</span><strong id="statViewsWeek">—</strong></div>
        <div class="stat"><span>30 jours</span><strong id="statViewsMonth">—</strong></div>
        <div class="stat"><span>Demandes contact</span><strong id="statContactRequests">—</strong></div>
        <div class="stat"><span>Projets livrés</span><strong id="statProjectsDelivered">—</strong></div>
        <div class="stat"><span>Clients actifs</span><strong id="statActiveClients">—</strong></div>
      </div>

      <div class="grid">
        <div class="card">
          <h3>Chiffres manuels</h3>
          <div id="formStatus" class="alert alert-info" hidden></div>
          <form id="statsForm">
            <div class="form-grid">
              <div class="field"><label>Demandes contact</label><input id="inputContactRequests" type="number" min="0"></div>
              <div class="field"><label>Projets livrés</label><input id="inputProjectsDelivered" type="number" min="0"></div>
              <div class="field"><label>Clients actifs</label><input id="inputActiveClients" type="number" min="0"></div>
            </div>
            <div class="field"><label>Notes</label><textarea id="inputNotes"></textarea></div>
            <button type="submit" class="btn btn-primary" id="saveBtn">Enregistrer</button>
          </form>
        </div>
        <div class="card">
          <h3>Trafic — 14 jours</h3>
          <div id="chartBars"></div>
        </div>
      </div>

      <div class="card">
        <h3>Dernières visites</h3>
        <div style="overflow-x:auto">
          <table>
            <thead><tr><th>Date</th><th>Page</th><th>Langue</th><th>Visiteur</th><th>Référent</th></tr></thead>
            <tbody id="visitsBody"></tbody>
          </table>
        </div>
        <p class="meta" id="updatedAt"></p>
        <p class="meta" id="sheetLink" hidden>Google Sheet : <a id="sheetUrl" href="#" target="_blank">Ouvrir</a></p>
      </div>
    </section>
  </div>

  <script>
    var currentPin = "";

    function fmt(n) { return new Intl.NumberFormat("fr-FR").format(Number(n) || 0); }
    function fmtDate(iso) {
      if (!iso) return "—";
      return new Intl.DateTimeFormat("fr-FR", { dateStyle:"short", timeStyle:"short", timeZone:"Africa/Bamako" }).format(new Date(iso));
    }

    function showError(el, msg) {
      if (!msg) { el.hidden = true; el.textContent = ""; return; }
      el.hidden = false; el.textContent = msg;
    }

    function renderStats(data) {
      document.getElementById("statTotalViews").textContent = fmt(data.totalViews);
      document.getElementById("statUniqueVisitors").textContent = fmt(data.uniqueVisitors);
      document.getElementById("statViewsToday").textContent = fmt(data.viewsToday);
      document.getElementById("statViewsWeek").textContent = fmt(data.viewsWeek);
      document.getElementById("statViewsMonth").textContent = fmt(data.viewsMonth);
      document.getElementById("statContactRequests").textContent = fmt(data.contactRequests);
      document.getElementById("statProjectsDelivered").textContent = fmt(data.projectsDelivered);
      document.getElementById("statActiveClients").textContent = fmt(data.activeClients);
      document.getElementById("inputContactRequests").value = data.contactRequests || 0;
      document.getElementById("inputProjectsDelivered").value = data.projectsDelivered || 0;
      document.getElementById("inputActiveClients").value = data.activeClients || 0;
      document.getElementById("inputNotes").value = data.notes || "";
      document.getElementById("updatedAt").textContent = "Dernière mise à jour : " + fmtDate(data.updatedAt);
      if (data.spreadsheetUrl) {
        document.getElementById("sheetUrl").href = data.spreadsheetUrl;
        document.getElementById("sheetLink").hidden = false;
      }
      var daily = data.daily || [];
      var max = Math.max.apply(null, daily.map(function(d){ return d.views; }).concat([1]));
      document.getElementById("chartBars").innerHTML = daily.slice(-14).map(function(row) {
        var w = Math.round((row.views / max) * 100);
        return '<div class="chart-row"><span>' + row.date.slice(5) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + w + '%"></div></div><span>' + row.views + '</span></div>';
      }).join("") || '<p class="meta">Aucune donnée.</p>';
      var visits = data.recentVisits || [];
      document.getElementById("visitsBody").innerHTML = visits.length ? visits.map(function(v) {
        return '<tr><td>' + fmtDate(v.timestamp) + '</td><td>' + (v.page||"/") + '</td><td>' + (v.lang||"—") + '</td><td>' + (v.visitorId||"—") + '</td><td>' + (v.referrer ? v.referrer.slice(0,40) : "—") + '</td></tr>';
      }).join("") : '<tr><td colspan="5">Aucune visite.</td></tr>';
      document.getElementById("loginView").hidden = true;
      document.getElementById("dashboardView").hidden = false;
    }

    function loadStats(pin) {
      google.script.run
        .withSuccessHandler(function(data) {
          if (!data.ok) { showError(document.getElementById("loginError"), data.error || "Erreur"); return; }
          currentPin = pin;
          renderStats(data);
        })
        .withFailureHandler(function(err) {
          showError(document.getElementById("loginError"), err.message || String(err));
        })
        .getStatsForAdmin(pin);
    }

    document.getElementById("loginForm").addEventListener("submit", function(e) {
      e.preventDefault();
      showError(document.getElementById("loginError"), "");
      loadStats(document.getElementById("pinInput").value.trim());
    });

    document.getElementById("refreshBtn").addEventListener("click", function() {
      if (currentPin) loadStats(currentPin);
    });

    document.getElementById("logoutBtn").addEventListener("click", function() {
      currentPin = "";
      document.getElementById("dashboardView").hidden = true;
      document.getElementById("loginView").hidden = false;
      document.getElementById("pinInput").value = "";
    });

    document.getElementById("statsForm").addEventListener("submit", function(e) {
      e.preventDefault();
      var status = document.getElementById("formStatus");
      status.hidden = false;
      status.textContent = "Enregistrement…";
      google.script.run
        .withSuccessHandler(function(data) {
          if (!data.ok) { status.textContent = data.error || "Erreur"; return; }
          renderStats(data);
          status.textContent = "Enregistré.";
          setTimeout(function(){ status.hidden = true; }, 2000);
        })
        .withFailureHandler(function(err) {
          status.textContent = err.message || String(err);
        })
        .updateStatsForAdmin(
          currentPin,
          document.getElementById("inputContactRequests").value,
          document.getElementById("inputProjectsDelivered").value,
          document.getElementById("inputActiveClients").value,
          document.getElementById("inputNotes").value.trim()
        );
    });
  </script>
</body>
</html>
`;
}
