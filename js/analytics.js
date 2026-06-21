/**
 * Koyrasoft — Compteur de visiteurs invisible (aucun affichage public)
 */
(function () {
  const VISITOR_KEY = "koyrasoft_vid";
  const SESSION_PREFIX = "koyrasoft_tracked_";

  function isAdminPage() {
    return /admin\.html$/i.test(window.location.pathname);
  }

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

  function getVisitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : "v-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function trackVisit() {
    if (isAdminPage()) return;

    const scriptUrl = getAnalyticsUrl();
    if (!scriptUrl) return;

    const sessionKey = SESSION_PREFIX + window.location.pathname;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    const params = new URLSearchParams({
      action: "track",
      page: window.location.pathname || "/",
      visitorId: getVisitorId(),
      referrer: document.referrer || "",
      lang: document.documentElement.lang || "fr",
    });

    const url = `${scriptUrl}?${params.toString()}`;

    const img = new Image();
    img.referrerPolicy = "no-referrer-when-downgrade";
    img.src = url;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", trackVisit);
  } else {
    trackVisit();
  }
})();
