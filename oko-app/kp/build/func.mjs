import { chromium } from 'playwright-core';
const M={'phone-se':[375,667,true],'phone-max':[430,932,true],'desk':[1920,1080,false]};
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
for(const dev of Object.keys(M)){
 const [w,h,touch]=M[dev]; const R={dev};
 const ctx=await br.newContext({viewport:{width:w,height:h},isMobile:touch,hasTouch:touch,deviceScaleFactor:1});
 const pg=await ctx.newPage();
 await pg.goto('http://127.0.0.1:8899/index.html',{waitUntil:'domcontentloaded'});
 await pg.waitForTimeout(2800);
 R.boot=await pg.evaluate(()=>({booting:document.body.classList.contains('booting'),
   canvasZ:getComputedStyle(document.getElementById('holo-canvas')).zIndex,
   btnShown:document.getElementById('plEnter').classList.contains('show'),
   eyeReady:!!window.__eyeReady, heroOpacity:getComputedStyle(document.querySelector('.hero-title')).opacity}));
 try{await pg.click('#plEnter',{timeout:6000});R.entered=true;}catch(e){R.entered=false;}
 await pg.waitForTimeout(2600);
 R.after=await pg.evaluate(()=>({booting:document.body.classList.contains('booting'),
   plDone:document.getElementById('preloader').classList.contains('done'),
   canvasZ:getComputedStyle(document.getElementById('holo-canvas')).zIndex,
   heroOpacity:getComputedStyle(document.querySelector('.hero-title')).opacity,
   hasAudio:!!window.__audio, muteBtn:!!document.getElementById('sound-btn')}));
 R.audio=await pg.evaluate(()=>window.__audio&&window.__audio.state?window.__audio.state():null);
 // TARIFFS
 R.tar=await pg.evaluate(async ()=>{const el=document.getElementById('tcarWrap');
   scrollTo(0,el.getBoundingClientRect().top+scrollY-40);await new Promise(r=>setTimeout(r,900));
   return {sy:Math.round(scrollY),dots:[...document.querySelectorAll('#tcarNav .tcar-dot')].map(d=>d.classList.contains('on'))};});
 const box=await pg.evaluate(()=>{const b=document.getElementById('tcarWrap').getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height*0.28};});
 // horizontal swipe
 if(touch){
   await pg.touchscreen.tap(box.x,box.y).catch(()=>{});
   await pg.waitForTimeout(300);
   const before=await pg.evaluate(()=>Math.round(scrollY));
   const cdp=await pg.context().newCDPSession(pg);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+90,y:box.y}]});
   for(let i=1;i<=9;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+90-i*20,y:box.y+i*6}]});await pg.waitForTimeout(16);}
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   await pg.waitForTimeout(900);
   R.swipe={scrollBefore:before,scrollAfter:await pg.evaluate(()=>Math.round(scrollY)),
     dots:await pg.evaluate(()=>[...document.querySelectorAll('#tcarNav .tcar-dot')].map(d=>d.classList.contains('on')))};
 } else {
   const before=await pg.evaluate(()=>Math.round(scrollY));
   await pg.mouse.move(box.x+90,box.y); await pg.mouse.down();
   for(let i=1;i<=9;i++){await pg.mouse.move(box.x+90-i*20,box.y+i*6);await pg.waitForTimeout(16);}
   await pg.mouse.up(); await pg.waitForTimeout(900);
   R.swipe={scrollBefore:before,scrollAfter:await pg.evaluate(()=>Math.round(scrollY)),
     dots:await pg.evaluate(()=>[...document.querySelectorAll('#tcarNav .tcar-dot')].map(d=>d.classList.contains('on')))};
 }
 // accordion click on active tier
 R.acc=await pg.evaluate(async ()=>{
   const tiers=[...document.querySelectorAll('.tier')];
   const act=tiers.find(t=>t.style.pointerEvents==='auto')||tiers[1];
   const q=act.querySelector('.tli-q'); if(!q)return{err:'no tli-q'};
   const r=q.getBoundingClientRect();
   return {ok:true,visible:r.top>0&&r.bottom<innerHeight,top:Math.round(r.top),x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};});
 if(R.acc.ok){
   await pg.mouse.click(R.acc.x,R.acc.y);
   await pg.waitForTimeout(600);
   R.accAfter=await pg.evaluate(()=>{const o=document.querySelector('.tier .tli.open');
     return o?{open:true,mh:o.querySelector('.tli-a').style.maxHeight}:{open:false};});
 }
 // details summary
 R.det=await pg.evaluate(async ()=>{
   const tiers=[...document.querySelectorAll('.tier')];
   const act=tiers.find(t=>t.style.pointerEvents==='auto')||tiers[1];
   const d=act.querySelector('details.tier-detail'); if(!d)return{err:'no details'};
   const s=d.querySelector('summary'); s.scrollIntoView({block:'center'});
   const r=s.getBoundingClientRect();
   return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),wasOpen:d.open};});
 if(!R.det.err){ await pg.mouse.click(R.det.x,R.det.y); await pg.waitForTimeout(500);
   R.detAfter=await pg.evaluate(()=>{const tiers=[...document.querySelectorAll('.tier')];
     const act=tiers.find(t=>t.style.pointerEvents==='auto')||tiers[1];
     return {open:act.querySelector('details.tier-detail').open};}); }
 console.log(JSON.stringify(R));
 await ctx.close();
}
console.log('DONE');
await br.close();
