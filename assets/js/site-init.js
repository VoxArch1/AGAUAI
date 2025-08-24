// AGAUAI site bootstrap:
// - Load form config, set endpoint globally
// - Create honeypot input
// - Auto-attach spam guards
// - Append footer Site Map (if footer found; else create one)
(function () {
  function fetchJSON(url) {
    return fetch(url, { cache: "no-store" }).then(function (r) { return r.json(); });
  }

  function ensureFooter() {
    var footer = document.querySelector("footer");
    if (!footer) {
      footer = document.createElement("footer");
      footer.setAttribute("aria-label", "Site footer");
      footer.style.marginTop = "4rem";
      footer.style.padding = "2rem 1rem";
      footer.style.opacity = "0.9";
      document.body.appendChild(footer);
    }
    return footer;
  }

  function addSiteMap(footer) {
    if (document.querySelector("[data-agauai-sitemap]")) return;
    var wrap = document.createElement("nav");
    wrap.setAttribute("data-agauai-sitemap", "true");
    wrap.setAttribute("aria-label", "Site map");
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = "repeat(auto-fit,minmax(140px,1fr))";
    wrap.style.gap = "0.5rem 1rem";
    wrap.style.fontSize = "0.95rem";
    wrap.style.lineHeight = "1.6";

    var pages = [
      ["Home", "index.html"],
      ["Solidarity Visa", "visa.html"],
      ["Appeals", "appeals.html"],
      ["The Gathering 2026", "agauai2026.html"],
      ["What is AGAUAI?", "what_is_AGAUAI.html"],
      ["Build With Us", "build-with-us.html"],
      ["Gallery", "gallery.html"],
      ["Roast Us", "roast.html"],
      ["AI Hub", "ai-hub.html"],
      ["Propose", "propose.html"]
    ];
    pages.forEach(function (p) {
      var a = document.createElement("a");
      a.href = p[1];
      a.textContent = p[0];
      a.rel = "nofollow";
      wrap.appendChild(a);
    });
    var heading = document.createElement("h3");
    heading.textContent = "Site Map";
    heading.style.margin = "0 0 0.5rem 0";
    footer.appendChild(heading);
    footer.appendChild(wrap);
  }

  function addHoneypotToForms(honeypotName) {
    var forms = Array.prototype.slice.call(document.querySelectorAll("form[action]"));
    forms.forEach(function (form) {
      if (form.querySelector('[name="' + honeypotName + '"]')) return;
      var hpWrap = document.createElement("div");
      hpWrap.style.position = "absolute";
      hpWrap.style.left = "-10000px";
      var input = document.createElement("input");
      input.type = "text";
      input.name = honeypotName;
      input.autocomplete = "off";
      input.tabIndex = -1;
      hpWrap.appendChild(input);
      form.appendChild(hpWrap);
      if (window.AGAUAI_attachFormGuards) {
        window.AGAUAI_attachFormGuards(form, window.AGAUAI_FORM_GUARD);
      }
    });
  }

  function lazyAllMedia() {
    ["img", "iframe"].forEach(function (sel) {
      document.querySelectorAll(sel + ":not([loading])").forEach(function (el) {
        el.setAttribute("loading", "lazy");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    fetchJSON("./config/forms.json").then(function (cfg) {
      window.AGAUAI_FORM_GUARD = cfg.guards || {};
      window.AGAUAI_FORMS_ENDPOINT = (cfg.endpoints && cfg.endpoints.default) || null;

      addHoneypotToForms((cfg.guards && cfg.guards.honeypotName) || "website");
      lazyAllMedia();

      var footer = ensureFooter();
      addSiteMap(footer);
    }).catch(function () {
      lazyAllMedia();
      var footer = ensureFooter();
      addSiteMap(footer);
    });
  });
})();
