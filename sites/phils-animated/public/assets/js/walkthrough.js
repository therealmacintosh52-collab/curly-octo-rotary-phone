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
  var frames = section.querySelectorAll(".arrival-frame");
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
      var last = i === captions.length - 1;
      /* A short dead zone between captions lets the text clear the frame
         before the next image arrives — but keep it tight. */
      captions[i].classList.toggle(
        "on", p >= start - 0.015 && (last || p < start + slot - 0.018));
    }
  }

  /* ---------------- reduced motion ----------------
     No scrubbing, no pinning: the CSS unpins the stage and stacks the captions.
     A video just gets its controls back so it can be watched deliberately. */
  if (reduced) {
    if (video) { video.controls = true; video.removeAttribute("data-scrub"); }
    Array.prototype.forEach.call(frames, function (f) { f.style.opacity = 1; f.style.position = "relative"; });
    Array.prototype.forEach.call(captions, function (c) { c.classList.add("on"); });
    return;
  }

  /* ---------------- video: scrub by scroll ---------------- */
  var scrub = null;
  if (video) {
    scrub = {
      duration: 0,
      inPoint: parseFloat(video.dataset.in || 0) || 0,
      outPoint: parseFloat(video.dataset.out || 0) || 0,
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
      /* Trim happens here rather than in an encoder: scroll maps to the
         chosen window of the file, so the in/out points can be adjusted
         without touching the video. */
      var end = scrub.outPoint > 0 ? Math.min(scrub.outPoint, video.duration) : video.duration;
      scrub.inPoint = Math.max(0, Math.min(scrub.inPoint, end - 0.1));
      scrub.duration = Math.max(0, end - scrub.inPoint);
      scrub.ready = scrub.duration > 0;
      scrub.current = scrub.inPoint;
      stage.classList.add("has-video");
      update();
    });

    /* If the file never loads — offline, bad path, codec the browser refuses —
       the stage keeps the captions and the vignette rather than a black hole. */
    video.addEventListener("error", function () {
      stage.classList.add("media-failed");
    });
  }

  /* Stills: one frame per caption. Each holds, then cross-fades into the next
     over the last fifth of its slot. The move and the grade below are the same
     ones the exported film uses, so the scroll version and the video read as
     one piece of footage rather than two different edits.

     Each entry is [scale, x%, y%] at the head of the shot and at its tail.
     No two neighbours move the same way — a reel of identical slow zooms is
     what makes a photo montage look like a screensaver. The translate is
     applied after the scale, so it costs scale × x%; keep that under the
     (scale − 1) / 2 overhang or the frame slides off its own edge. */
  var MOVES = [
    { a: [1.04,   0,  0], b: [1.16,   4,  1], g: [1.14, 1.00, 1.10] },  /* arrive  */
    { a: [1.05,   0, -2], b: [1.20,   0,  2], g: [0.90, 0.96, 1.00] },  /* the door */
    { a: [1.24,   9,  0], b: [1.24,  -9,  0], g: [1.08, 0.95, 1.08] },  /* step in */
    { a: [1.22,   0,  0], b: [1.02,   0,  0], g: [1.06, 1.08, 0.94] },  /* the floor */
    { a: [1.04,   0,  0], b: [1.22,   0, -3], g: [1.14, 0.98, 1.16] },  /* the work */
    { a: [1.14,   0, -4], b: [1.10,   2,  4], g: [0.93, 1.02, 1.16] },  /* fleet   */
    { a: [1.06,   0, -2], b: [1.16,   0,  3], g: [0.99, 0.96, 1.20] }   /* diesel  */
  ];
  /* Gentle head and tail, constant velocity through the middle. A full
     ease-in-out makes every frame stop dead on the dissolve. */
  function glide(t) {
    var s = t * t * t * (t * (t * 6 - 15) + 10);
    return 0.34 * s + 0.66 * t;
  }

  Array.prototype.forEach.call(frames, function (f, i) {
    var m = MOVES[i % MOVES.length];
    f.style.filter = "brightness(" + m.g[0] + ") contrast(" + m.g[1] + ") saturate(" + m.g[2] + ")";
  });

  function paintFrames(p) {
    if (!frames.length) return;
    var slot = 1 / frames.length;
    for (var i = 0; i < frames.length; i++) {
      var local = (p - i * slot) / slot;          /* -inf … 1+ within this frame */
      var opacity = 0;
      if (local >= 0 && local <= 1) opacity = local > 0.8 ? (1 - local) / 0.2 : 1;
      else if (local > 1 && local <= 1.2) opacity = 0;
      else if (local < 0 && local > -0.2) opacity = 1 + local / 0.2;
      if (i === frames.length - 1 && local > 0.8) opacity = 1;   /* hold the last */
      frames[i].style.opacity = Math.max(0, Math.min(1, opacity));

      var m = MOVES[i % MOVES.length];
      var e = glide(Math.max(0, Math.min(1, local)));
      var sc = m.a[0] + (m.b[0] - m.a[0]) * e;
      var tx = m.a[1] + (m.b[1] - m.a[1]) * e;
      var ty = m.a[2] + (m.b[2] - m.a[2]) * e;
      frames[i].style.transform =
        "scale(" + sc.toFixed(4) + ") translate(" + tx.toFixed(2) + "%," + ty.toFixed(2) + "%)";
    }
  }

  var queued = false;
  function update() {
    queued = false;
    var p = progress();
    paintCaptions(p);
    paintFrames(p);
    stage.style.setProperty("--zoom", (1 + p * (scrub || frames.length ? 0.04 : 0.18)).toFixed(4));
    if (scrub && scrub.ready) scrub.target = scrub.inPoint + p * scrub.duration;
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

  window.__arrival = { progress: progress, update: update, scrub: scrub,
                       captions: captions, frames: frames };
})();
