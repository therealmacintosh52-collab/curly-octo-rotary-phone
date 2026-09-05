/* Drives the arrival sequence from scroll position. No library.
   Under reduced motion the CSS already stacks the captions, so this exits. */
(function () {
  "use strict";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var section = document.querySelector(".arrival");
  if (!section) return;
  var stage = section.querySelector(".arrival-stage");
  var captions = section.querySelectorAll(".arrival-caption");
  if (!captions.length) return;

  var ticking = false;
  function update() {
    ticking = false;
    var rect = section.getBoundingClientRect();
    var total = section.offsetHeight - window.innerHeight;
    var p = Math.min(1, Math.max(0, -rect.top / (total || 1)));

    // Slow push toward the building across the whole sequence.
    stage.style.setProperty("--zoom", (1 + p * 0.18).toFixed(4));

    // One caption at a time, with a gap between so they never overlap.
    var slot = 1 / captions.length;
    for (var i = 0; i < captions.length; i++) {
      var start = i * slot;
      var on = p >= start - 0.02 && p < start + slot - 0.04;
      captions[i].classList.toggle("on", on);
    }

    // Once the sequence is finished, hand the panorama back to the visitor.
    stage.classList.toggle("done", p > 0.985);
  }

  window.addEventListener(
    "scroll",
    function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );
  window.addEventListener("resize", update);
  update();
})();
