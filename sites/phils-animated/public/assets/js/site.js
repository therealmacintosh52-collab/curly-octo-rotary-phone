/* Phil's Auto and Fleet Repair — minimal progressive-enhancement JS */
(function () {
  "use strict";

  /* --- Mobile navigation --- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("primary-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* --- Current year in footer --- */
  var y = document.querySelectorAll("[data-year]");
  for (var i = 0; i < y.length; i++) { y[i].textContent = new Date().getFullYear(); }

  /* --- Conversion tracking hooks -------------------------------------
     Fires a dataLayer event on calls, directions and form submits so the
     shop can measure leads in GA4 / Google Ads without editing markup.  */
  function track(name, params) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: name }, params || {}));
    if (typeof window.gtag === "function") { window.gtag("event", name, params || {}); }
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.indexOf("tel:") === 0) track("click_to_call", { link_location: a.dataset.loc || "page" });
    else if (href.indexOf("maps.google") > -1 || href.indexOf("google.com/maps") > -1) track("get_directions", {});
  });

  /* --- Quote form ---------------------------------------------------
     Posts to the endpoint in the form's action attribute (Formspree,
     Netlify Forms, Basin, or your own handler). If no endpoint has been
     configured yet, it degrades to a prefilled mailto: so leads are never
     silently dropped.  */
  var forms = document.querySelectorAll("form[data-quote-form]");
  Array.prototype.forEach.call(forms, function (form) {
    var status = form.querySelector(".form-status");

    function say(msg, kind) {
      if (!status) { window.alert(msg); return; }
      status.textContent = msg;
      status.className = "form-status show " + kind;
    }

    form.addEventListener("submit", function (e) {
      /* Honeypot: silently drop bot submissions. */
      var hp = form.querySelector('input[name="_gotcha"]');
      if (hp && hp.value) { e.preventDefault(); return; }

      var action = form.getAttribute("action") || "";
      var configured = action && action.indexOf("REPLACE_WITH") === -1;

      if (!configured) {
        e.preventDefault();
        var fd = new FormData(form);
        var lines = [];
        fd.forEach(function (v, k) {
          if (k.charAt(0) !== "_" && String(v).trim()) { lines.push(k + ": " + v); }
        });
        var mail = form.dataset.mailto || "service@philsautofleet.com";
        window.location.href =
          "mailto:" + mail +
          "?subject=" + encodeURIComponent("Website quote request") +
          "&body=" + encodeURIComponent(lines.join("\n"));
        say("Opening your email app so you can send this request. Prefer to talk? Call (209) 647-4953.", "ok");
        return;
      }

      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = "Sending…"; }

      fetch(action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      }).then(function (res) {
        if (!res.ok) throw new Error("bad status");
        form.reset();
        say("Thanks — we got it. We'll call you back with next steps. Need us sooner? Call (209) 647-4953.", "ok");
        track("generate_lead", { form_id: form.id || "quote" });
      }).catch(function () {
        say("That didn't go through. Please call (209) 647-4953 and we'll take care of you.", "err");
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "Send request"; }
      });
    });
  });
})();
