/* Motion layer for Phil's Auto — progressive enhancement only.
   No library. Nothing here is required for the page to work or convert. */
(function () {
  "use strict";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- scroll progress rail (kept even under reduced motion) ---------- */
  var rail = document.createElement("div");
  rail.className = "progress";
  document.body.appendChild(rail);
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      rail.style.transform = "scaleX(" + (h > 0 ? window.scrollY / h : 0) + ")";
      var bar = document.querySelector(".callbar");
      if (bar) bar.classList.toggle("show", window.scrollY > window.innerHeight * 0.45);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (reduced) return;

  /* ---- split the hero headline into masked lines ---------------------- */
  var h1 = document.querySelector(".hero h1");
  if (h1) {
    var html = h1.innerHTML.split(/<br\s*\/?>/i);
    if (html.length > 1) {
      h1.innerHTML = html
        .map(function (line, i) {
          return '<span class="line" style="--i:' + i + '"><span>' + line + "</span></span>";
        })
        .join("");
    }
  }
  var points = document.querySelectorAll(".hero-points li");
  Array.prototype.forEach.call(points, function (li, i) { li.style.setProperty("--i", i); });

  /* ---- reveal on scroll ------------------------------------------------ */
  var targets = document.querySelectorAll(
    "section .sec-head, .card, .review, .step, .stat, .split > div, .faq details, " +
    ".cta-band, .table-scroll, .photo, .tag-row, .map-frame, .hours, .listed .wrap > *"
  );
  Array.prototype.forEach.call(targets, function (el) {
    if (el.closest(".hero")) return;              // hero has its own entrance
    el.setAttribute("data-rise", "");
  });

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // Stagger by position within the parent so a grid lands as a wave.
        var siblings = el.parentElement ? Array.prototype.slice.call(el.parentElement.children) : [];
        var idx = Math.max(0, siblings.indexOf(el));
        el.style.setProperty("--d", Math.min(idx, 6) * 70 + "ms");
        el.classList.add("in");
        io.unobserve(el);
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
  );
  Array.prototype.forEach.call(document.querySelectorAll("[data-rise]"), function (el) { io.observe(el); });

  /* Fail open. An animation layer must never be the reason someone cannot read
     the page: anything already past the fold, or still hidden a few seconds in,
     gets revealed whether or not the observer fired. */
  function sweep() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-rise]:not(.in)"), function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.98) el.classList.add("in");
    });
  }
  window.addEventListener("scroll", sweep, { passive: true });
  window.addEventListener("resize", sweep);
  setTimeout(sweep, 2500);
  window.addEventListener("pageshow", sweep);

  /* ---- count up the numbers in the stat band --------------------------- */
  function countUp(el) {
    var text = el.textContent.trim();
    var match = text.match(/^([\d.]+)(.*)$/);
    if (!match) return;
    var end = parseFloat(match[1]);
    var decimals = (match[1].split(".")[1] || "").length;
    var suffix = match[2];
    var start = performance.now();
    var dur = 900;
    (function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = (end * eased).toFixed(decimals) + suffix;
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }
  var statObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countUp(e.target);
        statObserver.unobserve(e.target);
      });
    },
    { threshold: 0.6 }
  );
  Array.prototype.forEach.call(document.querySelectorAll(".stat b"), function (b) { statObserver.observe(b); });
})();
