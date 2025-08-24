// AGAUAI forms guard: time-trap + honeypot
(function () {
  function attachGuards(form, cfg) {
    if (!form) return;
    var started = Date.now();
    form.addEventListener("submit", function (e) {
      var elapsed = Date.now() - started;
      var minMs = (cfg && cfg.minSubmitMillis) || 3000;
      if (elapsed < minMs) {
        e.preventDefault();
        alert("Please take a moment before submitting. Thanks!");
        return false;
      }
      if (window.AGAUAI_FORMS_ENDPOINT) {
        form.action = window.AGAUAI_FORMS_ENDPOINT;
      }
    });
  }
  window.AGAUAI_attachFormGuards = attachGuards;
})();
