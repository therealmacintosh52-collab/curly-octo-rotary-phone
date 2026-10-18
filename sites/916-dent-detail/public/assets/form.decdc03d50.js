(function(){
'use strict';
var MAXP=4,LONG=1600;
function $(s,c){return (c||document).querySelector(s)}
[].slice.call(document.querySelectorAll('form[data-quote]')).forEach(init);
function init(form){
var summary=$('.summary',form.parentNode),ok=$('.ok',form.parentNode),btn=$('button[type=submit]',form);
var endpoint=form.getAttribute('action')||'';
var unconnected=endpoint.indexOf('{{')===0||!endpoint;
form.setAttribute('novalidate','');
var pre=null;try{pre=new URLSearchParams(location.search).get('for')}catch(e){}
var need=$('#need',form);if(need&&(pre==='fleet'||pre==='dealer'))need.value='dealer';
form.addEventListener('submit',function(e){
e.preventDefault();
if(unconnected||btn.disabled)return;
var hp=$('[name=website]',form);if(hp&&hp.value){done();return}
var bad=validate(form,summary);if(bad.length){return}
send(form,endpoint,btn,summary,ok);
});
[].slice.call(form.querySelectorAll('[required]')).forEach(function(el){
el.addEventListener('input',function(){if(el.getAttribute('aria-invalid')==='true'&&ready(el))el.removeAttribute('aria-invalid')});
});
var f=$('input[type=file]',form);
if(f)f.addEventListener('change',function(){var n=f.files?f.files.length:0,h=$('.file-msg',form);if(h)h.textContent=n>MAXP?'Only the first '+MAXP+' photos are sent.':(n?n+' photo'+(n>1?'s':'')+' selected.':'')});
function done(){form.hidden=true;ok.classList.add('on');ok.setAttribute('tabindex','-1');ok.focus()}
}
function ready(el){
var v=(el.value||'').trim();
if(el.type==='tel')return v.replace(/\D/g,'').length>=10;
return v.length>0;
}
function validate(form,summary){
var bad=[];
[].slice.call(form.querySelectorAll('[required]')).forEach(function(el){
if(ready(el)){el.removeAttribute('aria-invalid')}else{el.setAttribute('aria-invalid','true');bad.push(el)}
});
summary.innerHTML='';
if(bad.length){
var h=document.createElement('p');h.innerHTML='<strong>Error:</strong> please fix '+bad.length+(bad.length>1?' fields':' field')+' before sending.';
var ul=document.createElement('ul');
bad.forEach(function(el){var li=document.createElement('li'),a=document.createElement('a');a.href='#'+el.id;a.textContent=(document.querySelector('label[for="'+el.id+'"]')||{}).textContent||el.name;a.addEventListener('click',function(ev){ev.preventDefault();el.focus()});li.appendChild(a);ul.appendChild(li)});
summary.appendChild(h);summary.appendChild(ul);summary.classList.add('on');summary.setAttribute('tabindex','-1');summary.focus();
}else{summary.classList.remove('on')}
return bad;
}
function shrink(file){
return new Promise(function(res){
if(!/^image\//.test(file.type)||!window.createImageBitmap){return res(file)}
createImageBitmap(file).then(function(bm){
var s=Math.min(1,LONG/Math.max(bm.width,bm.height));
if(s===1&&file.size<1500000){return res(file)}
var c=document.createElement('canvas');c.width=Math.round(bm.width*s);c.height=Math.round(bm.height*s);
c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
c.toBlob(function(b){res(b?new File([b],file.name.replace(/\.\w+$/,'')+'.jpg',{type:'image/jpeg'}):file)},'image/jpeg',0.85);
}).catch(function(){res(file)});
});
}
function send(form,endpoint,btn,summary,ok){
btn.disabled=true;btn.setAttribute('aria-busy','true');
var fd=new FormData(form),files=fd.getAll('photos').filter(function(f){return f&&f.size}).slice(0,MAXP);
fd.delete('photos');
Promise.all(files.map(shrink)).then(function(out){
out.forEach(function(f){fd.append('photos',f,f.name||'photo.jpg')});
return fetch(endpoint,{method:'POST',body:fd,headers:{Accept:'application/json'}});
}).then(function(r){
if(!r.ok)throw new Error('status '+r.status);
form.hidden=true;summary.classList.remove('on');ok.classList.add('on');ok.setAttribute('tabindex','-1');ok.focus();
}).catch(function(){
summary.innerHTML='';var p=document.createElement('p');p.innerHTML='<strong>Error:</strong> ';p.appendChild(document.createTextNode(form.getAttribute('data-fallback')||'That did not send. Please text or call instead, or try again.'));summary.appendChild(p);
summary.classList.add('on');summary.setAttribute('tabindex','-1');summary.focus();
btn.disabled=false;btn.removeAttribute('aria-busy');
});
}
})();