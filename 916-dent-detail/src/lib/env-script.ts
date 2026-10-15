// Inline <head> script (runs before first paint). Decides the hero mode once, so the
// scroll track height and hidden beats are correct in the very first frame (no CLS, no flash).
// html.js   = JS is running
// html.scrub = full scroll-scrub mode; absent → static frame + fade-in copy
// Static when: prefers-reduced-motion, ≤2 CPU cores, ≤2 GB device memory, or Save-Data.
export const envScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var n=navigator,c=n.connection||{};var low=(n.hardwareConcurrency&&n.hardwareConcurrency<=2)||(n.deviceMemory&&n.deviceMemory<=2)||c.saveData===true;var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(!low&&!rm)d.classList.add('scrub');if(low)d.classList.add('lowend');}catch(e){}})();`;
