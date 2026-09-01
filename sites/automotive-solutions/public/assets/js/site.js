/* Automotive Solutions by Single — minimal progressive-enhancement JS.
   No libraries, no trackers loaded from anywhere. Everything degrades:
   with JS off the nav links still work and the form still posts normally. */
(function () {
  "use strict";

  var PHONE = "(916) 686-5277";

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
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* --- Current year in footer --- */
  var y = document.querySelectorAll("[data-year]");
  for (var i = 0; i < y.length; i++) { y[i].textContent = new Date().getFullYear(); }

  /* --- Conversion tracking hooks -------------------------------------
     Pushes a dataLayer event (and a gtag event, if gtag is present) on
     calls, directions and form submits, so the shop can count leads in
     GA4 or Google Ads later without anyone editing the markup. Nothing
     is loaded from a third party here — if no analytics tag is installed
     the events simply queue on window.dataLayer and go nowhere. */
  function track(name, params) {
    window.dataLayer = window.dataLayer || [];
    var payload = { event: name };
    for (var k in (params || {})) { if (params.hasOwnProperty(k)) payload[k] = params[k]; }
    window.dataLayer.push(payload);
    if (typeof window.gtag === "function") { window.gtag("event", name, params || {}); }
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.indexOf("tel:") === 0) {
      track("click_to_call", { link_location: a.getAttribute("data-loc") || "page" });
    } else if (href.indexOf("google.com/maps") > -1 || href.indexOf("maps.google") > -1) {
      track("get_directions", { link_location: a.getAttribute("data-loc") || "page" });
    }
  });

  /* --- Quote form ---------------------------------------------------
     Posts to the endpoint in the form's action attribute (FormSubmit by
     default). If the endpoint still holds the placeholder address, it
     degrades to a prefilled mailto: so a lead is never silently dropped. */
  var forms = document.querySelectorAll("form[data-quote-form]");
  Array.prototype.forEach.call(forms, function (form) {
    var status = form.querySelector(".form-status");
    var es = document.documentElement.lang === "es";

    function say(msg, kind) {
      if (!status) { window.alert(msg); return; }
      status.textContent = msg;
      status.className = "form-status show " + kind;
    }

    form.addEventListener("submit", function (e) {
      /* Honeypots: real people never fill these, bots usually do. */
      var hp1 = form.querySelector('input[name="_gotcha"]');
      var hp2 = form.querySelector('input[name="_honey"]');
      if ((hp1 && hp1.value) || (hp2 && hp2.value)) { e.preventDefault(); return; }

      var action = form.getAttribute("action") || "";
      /* The build ships with a placeholder address until the shop's real
         inbox is filled in (SITE["email"] in build.py). Until then the form
         must not pretend to have sent anything. */
      var placeholder = action.indexOf("REPLACE-ME") > -1 || action.indexOf("example.com") > -1;

      if (placeholder) {
        e.preventDefault();
        say(es
          ? "Este formulario aún no está conectado. Por favor llame al " + PHONE + " — con gusto le atendemos."
          : "This form isn't connected to an inbox yet. Please call " + PHONE + " — we'll take care of you.",
          "err");
        return;
      }

      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.setAttribute("data-label", btn.textContent); btn.textContent = es ? "Enviando…" : "Sending…"; }

      fetch(action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" }
      }).then(function (res) {
        if (!res.ok) throw new Error("bad status");
        form.reset();
        say(es
          ? "Gracias — ya lo recibimos. Le llamamos con los siguientes pasos. ¿Es urgente? Llame al " + PHONE + "."
          : "Thanks — we got it. We'll call you back with next steps. Need us sooner? Call " + PHONE + ".", "ok");
        track("generate_lead", { form_id: form.id || "quote" });
      }).catch(function () {
        say(es
          ? "No se pudo enviar. Por favor llame al " + PHONE + " y con gusto le atendemos."
          : "That didn't go through. Please call " + PHONE + " and we'll take care of you.", "err");
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.getAttribute("data-label") || (es ? "Enviar solicitud" : "Send request"); }
      });
    });
  });
})();
