(function(){
'use strict';
var r=document.documentElement;
document.addEventListener('focusin',function(e){if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))r.classList.add('kb')});
document.addEventListener('focusout',function(){r.classList.remove('kb')});
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('[data-event]');if(!a)return;
  var dl=window.dataLayer;if(dl&&dl.push)dl.push({event:a.getAttribute('data-event')});
});
var m=document.querySelector('.menu');
if(m)document.addEventListener('keydown',function(e){if(e.key==='Escape'&&m.open){m.open=false;m.querySelector('summary').focus()}});
})();
