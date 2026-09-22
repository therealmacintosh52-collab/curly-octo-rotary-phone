/* Stark's Hot Chicken -- progressive enhancement ONLY.
 *
 * Nothing here creates content. Every menu item, price, heat level and answer
 * block is already in the HTML the server sent. This file only adds behaviour
 * on top: nav toggle, menu filtering, scroll reveals.
 *
 * That ordering is the whole point of the build. The reference site renders
 * its menu client-side, and no major AI crawler executes JavaScript -- GPTBot,
 * ClaudeBot and PerplexityBot all read raw HTML once and move on. If this file
 * fails to load, the site still says everything it needs to say.
 */
(function () {
  "use strict";

  // Marks that JS is available. CSS uses this to opt IN to reveal animations,
  // so the no-JS render is never hidden.
  document.documentElement.classList.add("js");

  /* ---- mobile nav ---- */
  var toggle = document.querySelector(".nav-toggle");
  var links = document.getElementById("navLinks");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && links.classList.contains("open")) {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---- menu filter ----
   * Filters the items that are ALREADY on the page. Never fetches, never
   * renders. With JS off the full menu simply stays visible, which is correct.
   */
  var search = document.getElementById("menuSearch");
  var empty = document.getElementById("menuEmpty");
  if (search) {
    var items = [].slice.call(document.querySelectorAll(".item"));
    var sections = [].slice.call(document.querySelectorAll(".menu-sec"));
    var run = function () {
      var q = search.value.trim().toLowerCase();
      var hits = 0;
      items.forEach(function (li) {
        var match = !q || li.textContent.toLowerCase().indexOf(q) !== -1;
        li.hidden = !match;
        if (match) hits++;
      });
      sections.forEach(function (sec) {
        var visible = sec.querySelectorAll(".item:not([hidden])").length;
        sec.hidden = q && visible === 0;
      });
      if (empty) empty.hidden = hits !== 0;
    };
    var t;
    search.addEventListener("input", function () {
      clearTimeout(t);
      t = setTimeout(run, 120);
    });
  }

  /* ---- scroll reveals ----
   * Tag the elements first, then observe. Tagging happens in JS rather than in
   * the HTML so that the markup carries no presentational state.
   */
  var reduced = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!reduced && "IntersectionObserver" in window) {
    var targets = document.querySelectorAll(
      ".section > .wrap > *, .feat-card, .item, .heat-card, .mas-item, .platform-card"
    );
    [].forEach.call(targets, function (el) { el.setAttribute("data-reveal", ""); });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

    [].forEach.call(targets, function (el) { io.observe(el); });
  }

  /* ---- "open now" hint ----
   * Hours run past midnight (closes 00:45 / 01:45), so the window can belong
   * to the PREVIOUS day. Walk yesterday's window too before deciding.
   */
  var HOURS = {
    0: ["11:00", "22:30"],  // Sunday
    1: ["11:00", "00:45"], 2: ["11:00", "00:45"],
    3: ["11:00", "00:45"], 4: ["11:00", "00:45"],
    5: ["11:00", "01:45"], 6: ["11:00", "01:45"]
  };
  function mins(s) { var p = s.split(":"); return +p[0] * 60 + +p[1]; }
  function openNow(now) {
    var d = now.getDay(), t = now.getHours() * 60 + now.getMinutes();
    var today = HOURS[d];
    if (today) {
      var o = mins(today[0]), c = mins(today[1]);
      if (c < o ? (t >= o || t < c) : (t >= o && t < c)) return true;
    }
    // Yesterday's overnight window may still be running.
    var y = HOURS[(d + 6) % 7];
    if (y) {
      var yo = mins(y[0]), yc = mins(y[1]);
      if (yc < yo && t < yc) return true;
    }
    return false;
  }
  var meta = document.querySelector(".hero-meta");
  if (meta) {
    var badge = document.createElement("span");
    badge.className = "open-badge";
    badge.textContent = openNow(new Date()) ? " · Open now" : " · Closed right now";
    meta.appendChild(badge);
  }
})();
