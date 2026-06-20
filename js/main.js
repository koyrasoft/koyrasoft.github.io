/**
 * Koyrasoft — Template engine (JSON-driven, bilingual FR/EN)
 */

const SUPPORTED_LANGS = ["fr", "en"];
const DEFAULT_LANG = "fr";
const STORAGE_KEY = "koyrasoft-lang";

let siteData = null;
let currentLang = DEFAULT_LANG;

function detectLanguage() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("lang");
  if (fromUrl && SUPPORTED_LANGS.includes(fromUrl)) return fromUrl;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGS.includes(stored)) return stored;

  const browser = navigator.language?.slice(0, 2).toLowerCase();
  if (browser && SUPPORTED_LANGS.includes(browser)) return browser;

  return DEFAULT_LANG;
}

function getLangData() {
  return siteData?.[currentLang] ?? {};
}

function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function populateFields(data) {
  document.querySelectorAll("[data-field]").forEach((el) => {
    const value = getNestedValue(data, el.dataset.field);
    if (value === undefined) return;

    const suffix = el.dataset.fieldSuffix;
    if (suffix && (el.tagName === "A" || el.tagName === "BUTTON")) {
      el.innerHTML = `${value} <span>${suffix}</span>`;
    } else {
      el.textContent = value;
    }
  });

  document.querySelectorAll("[data-placeholder]").forEach((el) => {
    const value = getNestedValue(data, el.dataset.placeholder);
    if (value !== undefined) el.placeholder = value;
  });
}

function updateMeta(data) {
  if (data.meta?.title) document.title = data.meta.title;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && data.meta?.description) desc.content = data.meta.description;
  document.documentElement.lang = currentLang;

  const ogTitle = document.querySelector('meta[property="og:title"]');
  const ogDesc = document.querySelector('meta[property="og:description"]');
  const ogLocale = document.querySelector('meta[property="og:locale"]');
  if (ogTitle && data.meta?.title) ogTitle.content = data.meta.title;
  if (ogDesc && data.meta?.description) ogDesc.content = data.meta.description;
  if (ogLocale) ogLocale.content = currentLang === "fr" ? "fr_FR" : "en_US";
}

function renderNavigation(data) {
  const navLinks = document.getElementById("navLinks");
  const mobileNavLinks = document.getElementById("mobileNavLinks");
  const footerNav = document.getElementById("footerNav");
  if (!data.navigation) return;

  const links = data.navigation
    .map((item) => `<a href="${item.href}" data-nav="${item.href.replace("#", "")}">${item.label}</a>`)
    .join("");

  if (navLinks) navLinks.innerHTML = links;
  if (mobileNavLinks) mobileNavLinks.innerHTML = links;
  if (footerNav) footerNav.innerHTML = links;
}

function renderTrustPills(data) {
  const container = document.getElementById("trustPills");
  if (!container || !data.hero?.trustPills) return;

  container.innerHTML = data.hero.trustPills
    .map((pill) => `<span class="trust-pill">${pill}</span>`)
    .join("");
}

function renderHeroMetrics(data) {
  const container = document.getElementById("heroMetrics");
  if (!container || !data.hero?.metrics) return;

  container.innerHTML = data.hero.metrics
    .map(
      (m) => `
      <div class="metric">
        <strong>${m.value}</strong>
        <span>${m.label}</span>
      </div>`
    )
    .join("");
}

function renderServices(data) {
  const grid = document.getElementById("servicesGrid");
  if (!grid || !data.services) return;

  grid.innerHTML = data.services
    .map(
      (s) => `
      <article class="service-card">
        <div class="icon">${s.icon || "◆"}</div>
        <h3>${s.title}</h3>
        <p>${s.description}</p>
      </article>`
    )
    .join("");
}

function renderDigitalServices(data) {
  const grid = document.getElementById("digitalServicesGrid");
  if (!grid || !data.digitalServices) return;

  grid.innerHTML = data.digitalServices
    .map(
      (s) => `
      <article class="digital-card">
        <div class="digital-card__icon">${s.icon || "◆"}</div>
        <h3>${s.title}</h3>
        <p>${s.description}</p>
      </article>`
    )
    .join("");
}

function renderProjects(data) {
  const list = document.getElementById("projectsList");
  if (!list || !data.projects) return;

  list.innerHTML = data.projects
    .map((project) => {
      const highlights = (project.highlights || [])
        .map((item) => `<li>${item}</li>`)
        .join("");
      const modules = (project.modules || [])
        .map((item) => `<span class="project-module">${item}</span>`)
        .join("");
      const tags = (project.tags || [])
        .map((tag) => `<span class="project-tag">${tag}</span>`)
        .join("");
      const screenshots = (project.screenshots || [])
        .map(
          (shot) => `
          <figure class="project-shot">
            <div class="phone-frame">
              <img src="${shot.src}" alt="${shot.caption}" loading="lazy" width="280" height="560">
            </div>
            <figcaption>${shot.caption}</figcaption>
          </figure>`
        )
        .join("");

      const logoClass = project.logoClass ? ` ${project.logoClass}` : "";
      const visitLabel = data.sections?.projects?.visitWebsite || "Visit website →";
      const websiteLink = project.website
        ? `<a class="project-card__link" href="${project.website}" target="_blank" rel="noopener noreferrer">${visitLabel}</a>`
        : "";

      return `
      <article class="project-card" id="project-${project.id}">
        <div class="project-card__content">
          <div class="project-card__header">
            <img class="project-card__logo${logoClass}" src="${project.logo}" alt="${project.name}" width="56" height="56" loading="lazy">
            <div>
              <div class="project-card__meta">
                <span class="project-card__category">${project.category}</span>
                <span class="project-card__year">${project.year}</span>
              </div>
              <h3>${project.name}</h3>
              <p class="project-card__tagline">${project.tagline}</p>
            </div>
          </div>
          <p class="project-card__desc">${project.description}</p>
          ${highlights ? `<ul class="project-card__highlights">${highlights}</ul>` : ""}
          ${modules ? `<div class="project-card__modules">${modules}</div>` : ""}
          ${tags ? `<div class="project-card__tags">${tags}</div>` : ""}
          ${websiteLink}
        </div>
        <div class="project-card__gallery">${screenshots}</div>
      </article>`;
    })
    .join("");
}

function renderFeaturedProject(data) {
  const el = document.getElementById("heroFeatured");
  const fp = data.featuredProject;
  if (!el || !fp) return;

  el.hidden = false;
  el.href = fp.href || "#projects";
  el.innerHTML = `
    <span class="hero-featured__badge">${fp.label}</span>
    <img class="hero-featured__logo" src="${fp.logo}" alt="" width="40" height="40" loading="lazy">
    <span class="hero-featured__body">
      <strong>${fp.name}</strong>
      <span>${fp.description}</span>
    </span>
    <span class="hero-featured__arrow">→</span>
  `;
}

function renderValues(data) {
  const grid = document.getElementById("valuesGrid");
  if (!grid || !data.values) return;

  grid.innerHTML = data.values
    .map(
      (v) => `
      <article class="value-card">
        <div class="value-card__icon">${v.icon || "◆"}</div>
        <h3>${v.title}</h3>
        <p>${v.description}</p>
      </article>`
    )
    .join("");
}

function renderTechStack(data) {
  const stack = document.getElementById("techStack");
  if (!stack || !data.techStack) return;

  const items = data.techStack.map((t) => `<span class="tech-pill">${t}</span>`).join("");
  stack.innerHTML = `<div class="tech-marquee__track">${items}${items}</div>`;
}

function renderShowcaseVisual(data) {
  const visual = document.getElementById("showcaseVisual");
  const s = data.sections?.solutions;
  if (!visual || !s?.showcaseImage) return;

  visual.innerHTML = `
    <div class="showcase-phone">
      <img src="${s.showcaseImage}" alt="${s.showcaseImageAlt || ""}" loading="lazy" width="280" height="560">
    </div>
  `;
}

function renderCtaPoints(data) {
  const list = document.getElementById("ctaPoints");
  if (!list || !data.ctaPoints) return;

  list.innerHTML = data.ctaPoints.map((p) => `<li>${p}</li>`).join("");
}

function renderStats(data) {
  const grid = document.getElementById("statsGrid");
  if (!grid || !data.stats) return;

  grid.innerHTML = data.stats
    .map(
      (s) => `
      <div class="stat-card">
        <strong>${s.value}</strong>
        <span>${s.label}</span>
      </div>`
    )
    .join("");
}

function renderFooterContact(data) {
  const block = document.getElementById("footerContact");
  const contact = siteData?.contact;
  if (!block || !contact) return;

  const f = data.footer ?? {};
  const facebook = contact.social?.facebook;
  const socialBlock = facebook
    ? `
    <div class="footer-social">
      <h4>${f.socialTitle ?? "Social"}</h4>
      <a href="${facebook}" target="_blank" rel="noopener noreferrer">Facebook</a>
    </div>`
    : "";

  block.innerHTML = `
    <h4>${f.contactTitle ?? "Contact"}</h4>
    <a href="mailto:${contact.email}">${contact.email}</a>
    <a href="tel:${contact.phone.replace(/\s/g, "")}">${contact.phone}</a>
    <p>${contact.address}</p>
    ${socialBlock}
  `;
}

function renderSolutions(data) {
  const stack = document.getElementById("solutionsStack");
  if (!stack || !data.solutions) return;

  stack.innerHTML = data.solutions
    .map(
      (s) => `
      <div class="mini-card">
        <strong>${s.title}</strong>
        <p>${s.description}</p>
      </div>`
    )
    .join("");
}

function renderAbout(data) {
  const grid = document.getElementById("aboutGrid");
  if (!grid || !data.about) return;

  grid.innerHTML = data.about
    .map(
      (item) => `
      <article class="about-card">
        <div class="about-card__icon">${item.icon || "◆"}</div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </article>`
    )
    .join("");
}

function renderCodeCard(data) {
  const card = document.getElementById("codeCard");
  if (!card || !data.codeSnippet) return;

  card.innerHTML = data.codeSnippet.map((line) => `<p>${line}</p>`).join("");
}

function renderProcess(data) {
  const grid = document.getElementById("processGrid");
  if (!grid || !data.process) return;

  grid.innerHTML = data.process
    .map(
      (step) => `
      <div class="step">
        <h3>${step.title}</h3>
        <p>${step.description}</p>
      </div>`
    )
    .join("");
}

function setupLogos() {
  const logos = siteData?.logos;
  if (!logos) return;

  const favicon = document.getElementById("favicon");
  if (favicon && logos.favicon) favicon.href = logos[favicon.dataset.logo || "favicon"];

  document.querySelectorAll("img[data-logo]").forEach((el) => {
    const key = el.dataset.logo;
    if (logos[key]) el.src = logos[key];
  });
}

function setupContact() {
  const emailBtn = document.getElementById("contactEmailBtn");
  const email = siteData?.contact?.email;
  if (emailBtn && email) {
    emailBtn.href = `mailto:${email}`;
    const label = getLangData().sections?.cta?.button ?? email;
    emailBtn.innerHTML = `${label} <span>→</span>`;
  }
}

function updateLangSwitch() {
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    const active = btn.dataset.lang === currentLang;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function renderSite() {
  const data = getLangData();
  populateFields(data);
  updateMeta(data);
  renderNavigation(data);
  renderStats(data);
  renderFeaturedProject(data);
  renderTrustPills(data);
  renderHeroMetrics(data);
  renderCodeCard(data);
  renderAbout(data);
  renderValues(data);
  renderServices(data);
  renderDigitalServices(data);
  renderProjects(data);
  renderSolutions(data);
  renderShowcaseVisual(data);
  renderProcess(data);
  renderTechStack(data);
  renderCtaPoints(data);
  renderFooterContact(data);
  setupContact();
  setupLogos();
  updateLangSwitch();
  initNavSpy();
}

function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang) || !siteData?.[lang]) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  renderSite();

  const url = new URL(window.location.href);
  url.searchParams.set("lang", lang);
  window.history.replaceState({}, "", url);
}

function initLanguageSwitch() {
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => setLanguage(btn.dataset.lang));
  });
}

function initScrollTop() {
  const btn = document.getElementById("scrollTop");
  if (!btn) return;

  const toggle = () => {
    const show = window.scrollY > 500;
    btn.hidden = !show;
  };

  toggle();
  window.addEventListener("scroll", toggle, { passive: true });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function initHeaderScroll() {
  const header = document.getElementById("header");
  if (!header) return;

  const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 24);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

function initScrollReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  const showAll = () => {
    items.forEach((el) => el.classList.add("is-visible"));
  };

  if (!("IntersectionObserver" in window)) {
    showAll();
    return;
  }

  document.documentElement.classList.add("js-reveal-ready");

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
  );

  items.forEach((el) => observer.observe(el));

  // Safety: never leave sections hidden if observer misses them
  setTimeout(showAll, 1200);
}

async function loadSiteData() {
  if (window.KOYRASOFT_SITE) return window.KOYRASOFT_SITE;

  const res = await fetch("data/site.json");
  if (!res.ok) throw new Error("Impossible de charger site.json");
  return res.json();
}

function showLoadError(err) {
  console.error(err);
  document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));

  const main = document.getElementById("main");
  if (!main || document.getElementById("site-load-error")) return;

  const banner = document.createElement("p");
  banner.id = "site-load-error";
  banner.className = "site-load-error";
  banner.textContent =
    currentLang === "en"
      ? "Some content could not be loaded. Refresh the page or open the site via a local server."
      : "Une partie du contenu n'a pas pu être chargée. Rechargez la page.";
  main.prepend(banner);
}

let navSpyObserver = null;

function initNavSpy() {
  if (navSpyObserver) navSpyObserver.disconnect();

  const sections = [...document.querySelectorAll("main section[id]")];
  if (!sections.length) return;

  const setActive = (id) => {
    document.querySelectorAll("[data-nav]").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.nav === id);
    });
  };

  navSpyObserver = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        .forEach((entry) => setActive(entry.target.id));
    },
    { rootMargin: "-40% 0px -45% 0px", threshold: [0, 0.2, 0.5] }
  );

  sections.forEach((section) => navSpyObserver.observe(section));
}

function initNavigation() {
  const toggle = document.getElementById("navToggle");
  const mobileNav = document.getElementById("mobileNav");

  const close = () => {
    mobileNav?.setAttribute("hidden", "");
    toggle?.setAttribute("aria-expanded", "false");
    toggle?.setAttribute("aria-label", "Ouvrir le menu");
    if (toggle) toggle.textContent = "☰";
    document.body.style.overflow = "";
  };

  toggle?.addEventListener("click", () => {
    const isOpen = mobileNav?.hasAttribute("hidden");
    if (isOpen) {
      mobileNav.removeAttribute("hidden");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", "Fermer le menu");
      toggle.textContent = "✕";
      document.body.style.overflow = "hidden";
    } else {
      close();
    }
  });

  mobileNav?.addEventListener("click", (e) => {
    if (e.target.closest("a")) close();
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 760) close();
  });
}

function showFormFeedback(message, isError = false) {
  const feedback = document.getElementById("formFeedback");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle("is-error", isError);
  feedback.hidden = false;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result || "").split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

function submitViaGoogleAppsScript(form, scriptUrl, messages) {
  const submitBtn = form.querySelector('[type="submit"]');
  const submitLabel = submitBtn?.innerHTML;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fileInput = form.querySelector("#attachment");
    const file = fileInput?.files?.[0];
    const maxBytes = 10 * 1024 * 1024;

    if (file && file.size > maxBytes) {
      showFormFeedback(messages.fileTooLarge || messages.error, true);
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      if (messages.sending) submitBtn.textContent = messages.sending;
    }

    try {
      const returnParams = new URLSearchParams({ sent: "1", lang: currentLang });
      const returnUrl = `${window.location.origin}${window.location.pathname}?${returnParams.toString()}#contact`;
      const payload = new URLSearchParams();

      payload.set("name", form.name.value.trim());
      payload.set("email", form.email.value.trim());
      payload.set("telephone", form.telephone?.value.trim() || "");
      payload.set("entreprise", form.entreprise?.value.trim() || "");
      payload.set("subject", form.subject.value.trim());
      payload.set("message", form.message.value.trim());
      payload.set("lang", currentLang);
      payload.set("returnUrl", returnUrl);
      payload.set("_honey", form._honey?.value || "");

      if (file) {
        payload.set("fileData", await readFileAsBase64(file));
        payload.set("fileName", file.name);
        payload.set("fileMime", file.type || "application/octet-stream");
      }

      const temp = document.createElement("form");
      temp.method = "POST";
      temp.action = scriptUrl;
      temp.style.display = "none";

      payload.forEach((value, key) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        temp.appendChild(input);
      });

      document.body.appendChild(temp);
      temp.submit();
    } catch {
      showFormFeedback(messages.error || "Error", true);
      if (submitBtn) {
        submitBtn.disabled = false;
        if (submitLabel) submitBtn.innerHTML = submitLabel;
      }
    }
  });
}

function submitViaFormSubmit(form, recipient) {
  form.action = `https://formsubmit.co/${encodeURIComponent(recipient)}`;

  form.addEventListener("submit", () => {
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const subject = form.subject.value.trim();
    const messages = getLangData().form ?? {};
    const projectSubject = subject || messages.defaultSubject || "Contact";
    const returnParams = new URLSearchParams({ sent: "1", lang: currentLang });

    document.getElementById("formSubject").value = `[Koyrasoft] ${projectSubject} — ${name}`;
    document.getElementById("formReplyto").value = email;
    document.getElementById("formCc").value = email;
    document.getElementById("formNext").value =
      `${window.location.origin}${window.location.pathname}?${returnParams.toString()}#contact`;
  });
}

function getFormScriptUrl(contact) {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("gasUrl");
  if (fromQuery) {
    localStorage.setItem("koyrasoft_gas_url", fromQuery);
    return fromQuery.trim();
  }

  const fromConfig = (contact?.formScriptUrl || "").trim();
  if (fromConfig) return fromConfig;

  return (localStorage.getItem("koyrasoft_gas_url") || "").trim();
}

function initContactForm() {
  const form = document.getElementById("contactForm");
  const contact = siteData?.contact ?? window.KOYRASOFT_SITE?.contact;
  const recipient = contact?.email;
  const scriptUrl = getFormScriptUrl(contact);

  if (!form || !recipient) return;
  if (form.dataset.bound === "true") return;
  form.dataset.bound = "true";

  const params = new URLSearchParams(window.location.search);
  const messages = getLangData().form ?? {};

  if (params.get("sent") === "1") {
    showFormFeedback(messages.success ?? "OK");
    params.delete("sent");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  } else if (params.get("error") === "1") {
    showFormFeedback(messages.error ?? "Error", true);
    params.delete("error");
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }

  if (scriptUrl) {
    submitViaGoogleAppsScript(form, scriptUrl, messages);
    console.info("[Koyrasoft] Formulaire → Google Apps Script");
  } else {
    submitViaFormSubmit(form, recipient);
    console.warn(
      "[Koyrasoft] FormSubmit actif — ajoutez contact.formScriptUrl dans site.json avec l’URL /exec de Google Apps Script."
    );
  }
}

async function init() {
  document.getElementById("year").textContent = new Date().getFullYear();

  initNavigation();
  initHeaderScroll();
  initScrollTop();
  initLanguageSwitch();

  try {
    siteData = await loadSiteData();
    currentLang = detectLanguage();
    renderSite();
    initContactForm();
    initScrollReveal();
  } catch (err) {
    showLoadError(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
