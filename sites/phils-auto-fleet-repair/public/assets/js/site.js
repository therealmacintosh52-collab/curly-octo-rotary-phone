/* Client site — minimal progressive-enhancement JS.
   Shared by every client build (build.py copies public/assets verbatim), so
   nothing in here may name a specific business. Contact details come from
   data- attributes on the markup. */
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

  /* --- Motion control ------------------------------------------------
     Wired first, because it has to work on exactly the machines where the
     rest of this file does nothing. An OS-level "reduce motion" setting is
     honoured by default; this only offers the choice to override it. */
  var docEl = document.documentElement;
  var mtBtn = document.getElementById("motionToggle");
  var mtLabel = document.getElementById("motionLabel");
  if (mtBtn) {
    var on = docEl.getAttribute("data-motion") === "full" ||
      (!docEl.classList.contains("quiet") && docEl.getAttribute("data-motion") !== "off");
    if (mtLabel) { mtLabel.textContent = on ? "Turn off animations" : "Turn on animations"; }
    mtBtn.setAttribute("aria-pressed", on ? "true" : "false");
    mtBtn.addEventListener("click", function () {
      var next = docEl.getAttribute("data-motion") === "full" ? "off" : "full";
      try { localStorage.setItem("motion", next); } catch (e) {}
      location.reload();   /* the hidden state is written pre-paint */
    });
  }

  /* --- Reveal on scroll ---------------------------------------------
     The page's head script (REVEAL_BOOT in build.py) owns the selector
     list and hands it over as window.__rv, so the hidden state written into
     the head and the elements observed here can never disagree. Anything already on screen is revealed
     by the first callback. A pass on load catches anything the observer
     missed, because a section left at opacity 0 is far worse than a
     section that simply did not animate. */
  if (window.__rv && docEl.classList.contains("reveal")) {
    var sel = window.__rv.join(",");
    var targets = Array.prototype.slice.call(document.querySelectorAll(sel));

    /* Reveals anything whose top has crossed the trigger line, then drops it
       from the list, so the work shrinks to nothing as the page is read and
       this is cheap enough to run on every scroll event unthrottled.

       Only `top` is checked, deliberately. An element that scrolled clear of
       the viewport between two samples has crossed the line too; also
       requiring `bottom > 0` stranded whole sections whenever someone
       flicked quickly, pressed End, or landed on a #hash. */
    function sweep() {
      var vh = window.innerHeight || docEl.clientHeight;
      for (var i = targets.length - 1; i >= 0; i--) {
        if (targets[i].getBoundingClientRect().top < vh * 0.92) {
          targets[i].classList.add("rv-in");
          targets.splice(i, 1);
        }
      }
      return targets.length;
    }

    /* Three independent triggers, because each fails in a different place
       and a section left at opacity 0 is unacceptable: the observer, which
       is the efficient path; raw scroll events, untied to
       requestAnimationFrame; and a guard that polls until everything is
       revealed and then stops itself. */
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        for (var n = 0; n < entries.length; n++) {
          if (entries[n].isIntersecting) {
            entries[n].target.classList.add("rv-in");
            io.unobserve(entries[n].target);
          }
        }
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
      targets.slice().forEach(function (e) { io.observe(e); });
    }
    window.addEventListener("scroll", sweep, { passive: true });
    window.addEventListener("resize", sweep, { passive: true });
    window.addEventListener("load", sweep);
    var guard = setInterval(function () { if (!sweep()) { clearInterval(guard); } }, 350);
    setTimeout(function () { clearInterval(guard); }, 20000);
    sweep();
  }

  /* --- Numbers count up when they arrive -----------------------------
     The final value is already in the HTML, so with no JS, under reduced
     motion, or if anything here throws, the real number is what shows. Only
     a value that starts with a digit (optionally after a currency symbol)
     is touched, which leaves "Locally owned", "A11y" and "ES" alone. */
  function countUp(el) {
    var m = /^([$£€]?)(\d[\d,]*(?:\.\d+)?)([\s\S]*)$/.exec(el.textContent.trim());
    if (!m) return;
    var pre = m[1], raw = m[2], post = m[3];
    var dec = (raw.split(".")[1] || "").length;
    var grouped = raw.indexOf(",") > -1;
    var target = parseFloat(raw.replace(/,/g, ""));
    if (!isFinite(target) || target <= 0) return;

    function paint(v) {
      var t = dec ? v.toFixed(dec) : String(Math.round(v));
      if (grouped) t = t.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      el.textContent = pre + t + post;
    }
    var t0 = null, dur = 850;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      paint(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) { requestAnimationFrame(frame); }
      else { el.textContent = pre + raw + post; }   /* restore exactly */
    }
    requestAnimationFrame(frame);
  }

  if (docEl.classList.contains("reveal") && "requestAnimationFrame" in window) {
    var nums = document.querySelectorAll(".stat b,.inc b,.statband-inner b");
    if (nums.length) {
      var nio = new IntersectionObserver(function (es) {
        for (var i2 = 0; i2 < es.length; i2++) {
          if (es[i2].isIntersecting) { countUp(es[i2].target); nio.unobserve(es[i2].target); }
        }
      }, { threshold: 0.6 });
      for (var q = 0; q < nums.length; q++) { nio.observe(nums[q]); }
    }
  }

  /* --- Header tightens, call bar arrives -----------------------------
     Both are cosmetic. The call bar starts off-screen only in CSS that is
     reverted under reduced motion, so the number is always reachable. */
  var hdr = document.querySelector(".site-header");
  var bar = document.querySelector(".callbar");
  if (hdr || bar) {
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.pageYOffset || document.documentElement.scrollTop;
        if (hdr) { hdr.classList.toggle("shrunk", y > 60); }
        if (bar) { bar.classList.toggle("up", y > 260); }
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* --- Gallery lightbox ---------------------------------------------
     Opens a .masonry figure full size. Nothing is required in the markup
     beyond the figure itself, and with no JS the images stay perfectly
     usable in place. */
  var wall = document.querySelector(".masonry");
  if (wall) {
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", "Image viewer");
    box.innerHTML = '<button type="button" class="lightbox-close" aria-label="Close viewer">&#10005;</button><img alt="">';
    document.body.appendChild(box);
    var shot = box.querySelector("img");
    var opener = null;

    function shut() {
      box.classList.remove("open");
      shot.removeAttribute("src");
      if (opener && opener.focus) { opener.focus(); }
    }
    wall.addEventListener("click", function (e) {
      var img = e.target.closest && e.target.closest(".mas-item img");
      if (!img) return;
      opener = img;
      shot.src = img.currentSrc || img.src;
      shot.alt = img.alt || "";
      box.classList.add("open");
      box.querySelector(".lightbox-close").focus();
    });
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.closest(".lightbox-close")) shut();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box.classList.contains("open")) shut();
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

    /* The phone number belongs to the page, not to this file. */
    function callback(msg) {
      var tel = form.dataset.phone;
      return tel ? msg + " Prefer to talk? Call " + tel + "." : msg;
    }

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
        var mail = form.dataset.mailto;
        if (!mail) { say(callback("We could not open your email app."), "err"); return; }
        window.location.href =
          "mailto:" + mail +
          "?subject=" + encodeURIComponent("Website quote request") +
          "&body=" + encodeURIComponent(lines.join("\n"));
        say(callback("Opening your email app so you can send this request."), "ok");
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
        say(callback("Thanks — we got it. We'll call you back with next steps."), "ok");
        track("generate_lead", { form_id: form.id || "quote" });
      }).catch(function () {
        say(callback("That didn't go through, sorry."), "err");
      }).finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || "Send request"; }
      });
    });
  });
})();
