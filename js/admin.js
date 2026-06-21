/**
 * Koyrasoft — Admin dashboard (stats & compteur visiteurs)
 */

const PIN_SESSION_KEY = "koyrasoft_admin_pin";
const PIN_EXPIRY_KEY = "koyrasoft_admin_pin_exp";
const SESSION_HOURS = 12;

const loginView = document.getElementById("loginView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const configAlert = document.getElementById("configAlert");
const refreshBtn = document.getElementById("refreshBtn");
const logoutBtn = document.getElementById("logoutBtn");
const statsForm = document.getElementById("statsForm");
const saveBtn = document.getElementById("saveBtn");
const formStatus = document.getElementById("formStatus");

function getAnalyticsUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("analyticsUrl");
  if (fromQuery) {
    localStorage.setItem("koyrasoft_analytics_url", fromQuery.trim());
    return fromQuery.trim();
  }

  const fromConfig = (window.KOYRASOFT_SITE?.analytics?.scriptUrl || "").trim();
  if (fromConfig) return fromConfig;

  return (localStorage.getItem("koyrasoft_analytics_url") || "").trim();
}

function getStoredPin() {
  const pin = sessionStorage.getItem(PIN_SESSION_KEY);
  const expiry = Number(sessionStorage.getItem(PIN_EXPIRY_KEY) || 0);
  if (!pin || Date.now() > expiry) {
    clearStoredPin();
    return "";
  }
  return pin;
}

function storePin(pin) {
  sessionStorage.setItem(PIN_SESSION_KEY, pin);
  sessionStorage.setItem(PIN_EXPIRY_KEY, String(Date.now() + SESSION_HOURS * 3600 * 1000));
}

function clearStoredPin() {
  sessionStorage.removeItem(PIN_SESSION_KEY);
  sessionStorage.removeItem(PIN_EXPIRY_KEY);
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(Number(value) || 0);
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Africa/Bamako",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
}

function setLoginError(message) {
  if (!message) {
    loginError.hidden = true;
    loginError.textContent = "";
    return;
  }
  loginError.hidden = false;
  const isDeployError =
    /SpreadsheetApp|spreadsheets|権限|Exécuter en tant|Moi|Déploiement|NetworkError|Connexion impossible|Délai dépassé/i.test(
      message
    );
  if (isDeployError) {
    loginError.innerHTML =
      message +
      "<br><br><strong>Checklist :</strong><ol style='margin:10px 0 0 18px;line-height:1.6'>" +
      "<li>Coller la dernière version de <code>analytics.gs</code></li>" +
      "<li>Exécuter <code>verifyDeployment()</code> dans Apps Script (doit réussir)</li>" +
      "<li>Déployer → Gérer → Modifier → <strong>Exécuter en tant que : Moi</strong></li>" +
      "<li>Nouvelle version → Déployer</li></ol>";
  } else {
    loginError.textContent = message;
  }
}

function setFormStatus(message, isError) {
  if (!message) {
    formStatus.hidden = true;
    formStatus.textContent = "";
    return;
  }
  formStatus.hidden = false;
  formStatus.className = "alert " + (isError ? "alert-error" : "alert-info");
  formStatus.textContent = message;
}

function gasRequest(params) {
  const scriptUrl = getAnalyticsUrl();
  if (!scriptUrl) {
    return Promise.reject(new Error("URL analytics manquante. Ajoutez analytics.scriptUrl dans site.json."));
  }

  return new Promise((resolve, reject) => {
    const callbackName =
      "koyrasoftCb_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const urlParams = new URLSearchParams(params);
    urlParams.set("callback", callbackName);

    const script = document.createElement("script");
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          "Délai dépassé. Vérifiez le déploiement Apps Script : Exécuter « Moi » · Accès « Tout le monde »."
        )
      );
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = (data) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          "Connexion impossible au script Google. Collez la dernière version de analytics.gs, redéployez (Accès : Tout le monde), puis réessayez."
        )
      );
    };

    script.src = `${scriptUrl}?${urlParams.toString()}`;
    document.body.appendChild(script);
  });
}

async function fetchStats(pin) {
  const data = await gasRequest({ action: "stats", pin });

  if (!data.ok) {
    throw new Error(data.error || "Impossible de charger les statistiques.");
  }

  return data;
}

async function saveStats(pin, payload) {
  const data = await gasRequest({
    action: "update",
    pin,
    contactRequests: String(payload.contactRequests),
    projectsDelivered: String(payload.projectsDelivered),
    activeClients: String(payload.activeClients),
    notes: payload.notes,
  });

  if (!data.ok) {
    throw new Error(data.error || "Échec de l'enregistrement.");
  }

  return data;
}

function renderStats(data) {
  document.getElementById("statTotalViews").textContent = formatNumber(data.totalViews);
  document.getElementById("statUniqueVisitors").textContent = formatNumber(data.uniqueVisitors);
  document.getElementById("statViewsToday").textContent = formatNumber(data.viewsToday);
  document.getElementById("statViewsWeek").textContent = formatNumber(data.viewsWeek);
  document.getElementById("statViewsMonth").textContent = formatNumber(data.viewsMonth);
  document.getElementById("statContactRequests").textContent = formatNumber(data.contactRequests);
  document.getElementById("statProjectsDelivered").textContent = formatNumber(data.projectsDelivered);
  document.getElementById("statActiveClients").textContent = formatNumber(data.activeClients);

  document.getElementById("inputContactRequests").value = data.contactRequests ?? 0;
  document.getElementById("inputProjectsDelivered").value = data.projectsDelivered ?? 0;
  document.getElementById("inputActiveClients").value = data.activeClients ?? 0;
  document.getElementById("inputNotes").value = data.notes || "";

  document.getElementById("updatedAt").textContent = "Dernière mise à jour : " + formatDateTime(data.updatedAt);

  const sheetLink = document.getElementById("sheetLink");
  const sheetUrl = document.getElementById("sheetUrl");
  if (data.spreadsheetUrl && sheetLink && sheetUrl) {
    sheetUrl.href = data.spreadsheetUrl;
    sheetLink.hidden = false;
  } else if (sheetLink) {
    sheetLink.hidden = true;
  }

  renderChart(data.daily || []);
  renderVisits(data.recentVisits || []);
}

function renderChart(daily) {
  const container = document.getElementById("chartBars");
  if (!daily.length) {
    container.innerHTML = '<p class="meta-line">Aucune donnée pour le moment.</p>';
    return;
  }

  const max = Math.max(...daily.map((d) => d.views), 1);

  container.innerHTML = daily
    .slice(-14)
    .map((row) => {
      const width = Math.round((row.views / max) * 100);
      const label = row.date.slice(5);
      return `
        <div class="chart-row">
          <span>${label}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <span>${row.views}</span>
        </div>`;
    })
    .join("");
}

function renderVisits(visits) {
  const tbody = document.getElementById("visitsBody");
  if (!visits.length) {
    tbody.innerHTML = '<tr><td colspan="5">Aucune visite enregistrée.</td></tr>';
    return;
  }

  tbody.innerHTML = visits
    .map(
      (v) => `
      <tr>
        <td>${formatDateTime(v.timestamp)}</td>
        <td>${v.page || "/"}</td>
        <td>${v.lang || "—"}</td>
        <td>${v.visitorId || "—"}</td>
        <td>${v.referrer ? v.referrer.slice(0, 40) : "—"}</td>
      </tr>`
    )
    .join("");
}

async function loadDashboard(pin) {
  const data = await fetchStats(pin);
  renderStats(data);
  showDashboard();
}

function checkConfig() {
  if (getAnalyticsUrl()) {
    configAlert.hidden = true;
    return;
  }
  configAlert.hidden = false;
  configAlert.textContent =
    "Analytics non configuré : déployez google-apps-script/analytics.gs et ajoutez l’URL dans data/site.json → analytics.scriptUrl.";
}

loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoginError("");

  const pin = document.getElementById("pinInput").value.trim();
  if (!pin) {
    setLoginError("Entrez le code PIN.");
    return;
  }

  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try {
    await loadDashboard(pin);
    storePin(pin);
    loginForm.reset();
  } catch (err) {
    setLoginError(err.message || "Connexion impossible.");
  } finally {
    submitBtn.disabled = false;
  }
});

refreshBtn?.addEventListener("click", async () => {
  const pin = getStoredPin();
  if (!pin) return showLogin();

  refreshBtn.disabled = true;
  try {
    await loadDashboard(pin);
    setFormStatus("Statistiques actualisées.", false);
    setTimeout(() => setFormStatus(""), 2500);
  } catch (err) {
    setFormStatus(err.message || "Erreur.", true);
  } finally {
    refreshBtn.disabled = false;
  }
});

logoutBtn?.addEventListener("click", () => {
  clearStoredPin();
  showLogin();
});

statsForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pin = getStoredPin();
  if (!pin) return showLogin();

  saveBtn.disabled = true;
  setFormStatus("Enregistrement…", false);

  try {
    const data = await saveStats(pin, {
      contactRequests: document.getElementById("inputContactRequests").value,
      projectsDelivered: document.getElementById("inputProjectsDelivered").value,
      activeClients: document.getElementById("inputActiveClients").value,
      notes: document.getElementById("inputNotes").value.trim(),
    });
    renderStats(data);
    setFormStatus("Statistiques enregistrées.", false);
  } catch (err) {
    setFormStatus(err.message || "Erreur.", true);
  } finally {
    saveBtn.disabled = false;
  }
});

async function init() {
  checkConfig();

  const pin = getStoredPin();
  if (!pin) {
    showLogin();
    return;
  }

  try {
    await loadDashboard(pin);
  } catch {
    clearStoredPin();
    showLogin();
  }
}

document.addEventListener("DOMContentLoaded", init);
