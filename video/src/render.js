const { chromium } = require('playwright-core'); const fs=require('fs');
const FPS=30; const shots=JSON.parse(process.argv[2]);
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage({viewport:{width:1920,height:1080}});
 p.on('pageerror',e=>console.log('pageerror:',e.message));
 await p.goto('file://'+__dirname+'/scene.html'); await p.evaluate(()=>window.ready);
 const durs=await p.evaluate(()=>window.SHOTS);
 for(const i of shots){const n=Math.round(durs[i]*FPS);const dir=`frames/s${i}`;fs.mkdirSync(dir,{recursive:true});const t0=Date.now();
  for(let k=0;k<n;k++){const f=`${dir}/f${String(k).padStart(5,'0')}.jpg`;if(fs.existsSync(f))continue;await p.evaluate(([i,t])=>window.renderFrame(i,t),[i,k/FPS]);await p.screenshot({path:f,type:'jpeg',quality:94});
   if(k%60===0)console.log(`shot ${i} ${k}/${n} ${((Date.now()-t0)/1000).toFixed(0)}s`);}
  console.log(`shot ${i} done`);}
 await b.close();
})();
