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

  /* --- Full-screen video hero (homepage) ------------------------------
     Reveals the headline only once the video is really playing. If the
     browser refuses autoplay (iOS Low Power Mode, data saver) or nothing
     plays within 3 s, it shows the poster frame and the headline instead,
     and the first tap anywhere retries playback. The shop chose to play
     the loop regardless of the OS reduced-motion setting.              */
  var hero = document.querySelector("[data-video-hero]");
  var video = hero && hero.querySelector("video");
  var overlayHeader = document.querySelector(".site-header--overlay");
  if (hero && video) {
    var revealed = false;
    var guard = null;

    function fallback() {
      if (revealed) return;
      revealed = true;
      if (video.dataset.poster) video.setAttribute("poster", video.dataset.poster);
      hero.classList.add("is-fallback");
    }
    /* click, touchend and keydown count as user activation everywhere
       (pointerdown does not on touch screens), so retry on those until
       playback actually starts. */
    var gestures = ["click", "touchend", "keydown"];
    var gestureTarget = null;
    function waitForGesture(target) {
      if (gestureTarget) return;
      gestureTarget = target;
      hero.classList.add("is-blocked");
      gestures.forEach(function (ev) { target.addEventListener(ev, retryOnGesture); });
    }
    function stopRetrying() {
      if (!gestureTarget) return;
      gestures.forEach(function (ev) { gestureTarget.removeEventListener(ev, retryOnGesture); });
      gestureTarget = null;
    }
    function retryOnGesture() {
      var p = video.play();
      if (p && typeof p.then === "function") { p.then(stopRetrying).catch(function () {}); }
    }
    function mediaFailed() {
      /* the file itself could not be loaded or decoded: nothing to retry */
      fallback();
      hero.classList.remove("is-blocked");
      stopRetrying();
    }
    video.addEventListener("error", mediaFailed);
    var lastSource = video.querySelector("source:last-of-type");
    if (lastSource) lastSource.addEventListener("error", mediaFailed);

    video.addEventListener("playing", function () {
      revealed = true;
      if (guard) { clearTimeout(guard); guard = null; }
      hero.classList.remove("is-blocked");
      hero.classList.add("is-playing");
      stopRetrying();
    });

    /* The autoplay policy checks the property, not just the attribute. */
    video.muted = true;
    video.defaultMuted = true;
    function tryPlay() {
      if (hero.classList.contains("is-playing")) return;
      var attempt = video.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(function () {
          if (video.error) return;
          fallback();
          waitForGesture(document);
        });
      }
    }
    guard = setTimeout(fallback, 3000);
    tryPlay();
    /* Embedded viewers and background tabs sometimes hold the first attempt
       back, so try again whenever the video or the page becomes ready. */
    video.addEventListener("canplay", tryPlay);
    window.addEventListener("pageshow", tryPlay);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) tryPlay();
      }).observe(hero);
    }

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        if (hero.classList.contains("is-playing")) video.pause();
      } else if (hero.classList.contains("is-playing")) {
        video.play().catch(function () {});
      } else {
        tryPlay();
      }
    });
  }

  /* Transparent header over the hero; normal white header once scrolled past it. */
  if (overlayHeader) {
    if (hero && "IntersectionObserver" in window) {
      var watcher = new IntersectionObserver(function (entries) {
        overlayHeader.classList.toggle("is-scrolled", !entries[0].isIntersecting);
      }, { rootMargin: "-" + overlayHeader.offsetHeight + "px 0px 0px 0px", threshold: 0 });
      watcher.observe(hero);
    } else {
      overlayHeader.classList.add("is-scrolled");
    }
  }

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
