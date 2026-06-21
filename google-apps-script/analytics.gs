/**
 * Koyrasoft — Analytics & compteur de visiteurs (Google Apps Script)
 *
 * INSTALLATION (obligatoire avant l’admin) :
 * 1. https://script.google.com → coller ce fichier
 * 2. Sélectionner setup → ▶ Exécuter → Autoriser l’accès Google Sheets
 * 3. Déployer → Application Web → Exécuter en tant que : MOI · Accès : Tout le monde
 * 4. Copier l’URL /exec dans data/site.json → analytics.scriptUrl
 *
 * ⚠️ Sans l’étape 2, l’admin affichera une erreur de permission.
 *
 * PIN admin : modifiable via setup() ou dans Propriétés du script (ADMIN_PIN)
 */

const ADMIN_PIN_DEFAULT = "koyra2026";
const MAX_VISIT_LOG = 500;
const SCRIPT_VERSION = "2026-06-22-v3";

/** ID du Google Sheet créé par setup() — secours si les propriétés du script sont vides. */
const SPREADSHEET_ID = "1gF-mA0787YEEQvXsnT5vjUS_03B2-vyZoVRnbgJd6GI";

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("ADMIN_PIN")) {
    props.setProperty("ADMIN_PIN", ADMIN_PIN_DEFAULT);
  }

  saveSpreadsheetId_(SPREADSHEET_ID);
  const ss = ensureSpreadsheet_();
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
