(function(){
'use strict';
var root=document.documentElement,stage=document.querySelector('.hero-stage'),track=document.querySelector('.hero-track');
if(!stage||!track)return;
var fig=stage.querySelector('.hero-media'),pic=fig.querySelector('picture'),img=pic.querySelector('img');
var reduce=matchMedia('(prefers-reduced-motion: reduce)');
var desk=matchMedia('(min-width:900px)').matches;
function off(){root.classList.remove('scrub');root.classList.remove('live')}
if(root.classList.contains('static')&&!reduce.matches){
  var u=img.getAttribute(desk?'data-static-d':'data-static-m');
  if(u){[].slice.call(pic.querySelectorAll('source')).forEach(function(s){s.remove()});img.removeAttribute('srcset');img.src=u}
  return;
}
if(!root.classList.contains('scrub'))return;
var N=+track.getAttribute('data-n'),dir=track.getAttribute('data-frames')+(desk?'d':'m')+'/f';
var frames=[],busy={},active=0,cur=0,started=false,canvas=null,ctx=null,raf=0,failed=false;
function url(i){return dir+(i<10?'0':'')+i+'.avif'}
function pump(){
  if(failed)return;
  var order=[],i;
  for(i=0;i<N;i++){if(!frames[i]&&!busy[i])order.push(i)}
  order.sort(function(a,b){var pa=(a%4===0||a===N-1)?0:1,pb=(b%4===0||b===N-1)?0:1;return pa-pb||Math.abs(a-cur)-Math.abs(b-cur)});
  while(active<4&&order.length){fetchFrame(order.shift())}
}
function fetchFrame(i){
  busy[i]=1;active++;
  var im=new Image();im.decoding='async';
  im.onload=function(){frames[i]=im;active--;if(!canvas)mount();schedule();pump()};
  im.onerror=function(){active--;if(!frames.some(Boolean)){failed=true;off()}else{pump()}};
  im.src=url(i);
}
function near(i){for(var d=0;d<N;d++){if(frames[i-d])return frames[i-d];if(frames[i+d])return frames[i+d]}return null}
function mount(){
  canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
  fig.insertBefore(canvas,fig.querySelector('.hero-scrim'));ctx=canvas.getContext('2d');size()
}
function size(){
  if(!canvas)return;var r=fig.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr)
}
function cover(im,a){
  var cw=canvas.width,ch=canvas.height,s=Math.max(cw/im.width,ch/im.height),w=im.width*s,h=im.height*s;
  var py=desk?0.5:0.72,x=(cw-w)/2,y=(ch-h)*py;
  ctx.globalAlpha=a;ctx.drawImage(im,x,y,w,h)
}
function progress(){
  var r=track.getBoundingClientRect(),span=track.offsetHeight-stage.offsetHeight;
  return span>0?Math.min(1,Math.max(0,-r.top/span)):0
}
function render(){
  raf=0;if(!canvas)return;
  var p=progress(),f=p*(N-1),i=Math.floor(f),a=f-i,A=near(i),B=near(Math.min(i+1,N-1));
  cur=Math.round(f);
  stage.setAttribute('data-step',p<0.3?'1':p<0.6?'2':'3');
  if(!A)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);cover(A,1);
  if(B&&B!==A&&a>0.03)cover(B,a);
  ctx.globalAlpha=1
}
function schedule(){if(!raf)raf=requestAnimationFrame(render)}
function start(){
  if(started)return;started=true;root.classList.add('live');
  stage.setAttribute('data-step',progress()<0.3?'1':progress()<0.6?'2':'3');
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',function(){size();schedule()});
  window.addEventListener('pageshow',function(e){if(e.persisted){schedule()}});
  if(reduce.addEventListener)reduce.addEventListener('change',function(){if(reduce.matches)off()});
  pump()
}
['pointerdown','touchstart','wheel','keydown'].forEach(function(t){window.addEventListener(t,start,{once:true,passive:true})});
window.addEventListener('scroll',start,{once:true,passive:true});
function idle(){('requestIdleCallback' in window)?requestIdleCallback(start,{timeout:2500}):setTimeout(start,1200)}
if(document.readyState==='complete')idle();else window.addEventListener('load',idle);
})();
