(function(){var d=document.documentElement,n=navigator,c=n.connection||{},mm=window.matchMedia;function q(s){return !!(mm&&mm(s).matches)}
var ok=!q('(prefers-reduced-motion: reduce)')&&!c.saveData&&!/(^|-)[23]g/.test(c.effectiveType||'')&&(n.deviceMemory===undefined||n.deviceMemory>2)&&(n.hardwareConcurrency===undefined||n.hardwareConcurrency>2)&&(window.scrollY||0)<window.innerHeight;
if(ok){d.classList.add('scrub');setTimeout(function(){if(!d.classList.contains('live'))d.classList.remove('scrub')},7000)}else{d.classList.add('static')}})();
