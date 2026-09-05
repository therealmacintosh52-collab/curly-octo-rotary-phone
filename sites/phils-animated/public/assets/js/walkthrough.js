/* Arrival sequence.
 *
 * With a video: scroll position drives the playhead, so the walk-in happens at
 * the speed the visitor scrolls. With the Street View panorama or the address
 * panel instead: same captions, same slow push.
 *
 * Exposed as window.__arrival for testing.
 */
(function () {
  "use strict";

  var section = document.querySelector(".arrival");
  if (!section) return;
  var stage = section.querySelector(".arrival-stage");
  var captions = section.querySelectorAll(".arrival-caption");
  var video = section.querySelector("video[data-scrub]");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Progress through the section, 0 → 1. */
  function progress() {
    var rect = section.getBoundingClientRect();
    var total = section.offsetHeight - window.innerHeight;
    return Math.min(1, Math.max(0, -rect.top / (total || 1)));
  }

  function paintCaptions(p) {
    if (!captions.length) return;
    var slot = 1 / captions.length;
    for (var i = 0; i < captions.length; i++) {
      var start = i * slot;
      captions[i].classList.toggle("on", p >= start - 0.02 && p < start + slot - 0.04);
    }
  }

  /* ---------------- reduced motion ----------------
     No scrubbing, no pinning: the CSS unpins the stage and stacks the captions.
     A video just gets its controls back so it can be watched deliberately. */
  if (reduced) {
    if (video) { video.controls = true; video.removeAttribute("data-scrub"); }
    Array.prototype.forEach.call(captions, function (c) { c.classList.add("on"); });
    return;
  }

  /* ---------------- video: scrub by scroll ---------------- */
  var scrub = null;
  if (video) {
    scrub = {
      duration: 0,
      target: 0,
      current: 0,
      ready: false,
      /* Seeking every scroll event overwhelms mobile decoders, so the playhead
         chases the target instead of snapping to it. */
      tick: function () {
        if (!scrub.ready) return;
        scrub.current += (scrub.target - scrub.current) * 0.18;
        if (Math.abs(scrub.target - scrub.current) < 0.004) scrub.current = scrub.target;
        try {
          if (typeof video.fastSeek === "function") video.fastSeek(scrub.current);
          else video.currentTime = scrub.current;
        } catch (e) { /* a seek before the buffer is ready is not worth reporting */ }
      },
    };

    video.addEventListener("loadedmetadata", function () {
      scrub.duration = video.duration || 0;
      scrub.ready = scrub.duration > 0;
      stage.classList.add("has-video");
      update();
    });

    /* If the file never loads — offline, bad path, codec the browser refuses —
       the stage keeps the captions and the vignette rather than a black hole. */
    video.addEventListener("error", function () {
      stage.classList.add("media-failed");
    });
  }

  var queued = false;
  function update() {
    queued = false;
    var p = progress();
    paintCaptions(p);
    stage.style.setProperty("--zoom", (1 + p * (scrub ? 0.04 : 0.18)).toFixed(4));
    if (scrub && scrub.ready) scrub.target = p * scrub.duration;
    stage.classList.toggle("done", p > 0.985);
  }

  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  if (scrub) {
    (function loop() {
      scrub.tick();
      requestAnimationFrame(loop);
    })();
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update);
  update();

  window.__arrival = { progress: progress, update: update, scrub: scrub, captions: captions };
})();
