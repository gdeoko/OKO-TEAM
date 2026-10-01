// Калибровка границ букв бланка: что сборщик ДУМАЕТ о строке (canvas) против того,
// что браузер РЕАЛЬНО печатает (пиксели). node cal.cjs <html> <выходной префикс>
const {chromium}=require('playwright'); const fs=require('fs');
(async()=>{
 const [f,out]=process.argv.slice(2);
 const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1400,height:2000},deviceScaleFactor:2});
 await p.goto('file://'+f,{waitUntil:'networkidle'});
 await p.waitForSelector("html[data-title-fit='1']",{timeout:9000}).catch(()=>{});
 await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(1500);
 const SELS=['.competition-type','.competition-name','.support-line','.diploma-type','.diploma-degree','.extra-award','.awarded-label','.awarded-name','.awarded-name-script','.field-list','.gratitude-text'];
 const pred=await p.evaluate((SELS)=>{
  const cont=document.querySelector('.content'); let SC=1; const mm=getComputedStyle(cont).transform.match(/matrix\(([\d.]+)/); if(mm) SC=parseFloat(mm[1]);
  function _leaf(el,last){let e=el;for(let d=0;d<6;d++){const k=[].filter.call(e.children,x=>x.getClientRects().length&&x.textContent.trim());if(!k.length)break;e=last?k[k.length-1]:k[0];}return e;}
  function _tn(el){const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT,null),o=[];let n;while((n=w.nextNode())){if(n.nodeValue&&n.nodeValue.trim())o.push(n);}return o;}
  function _base(el,atEnd){const s=document.createElement('span');s.style.cssText='display:inline-block;width:0;height:0;overflow:hidden;vertical-align:baseline';const ns=_tn(el);let y;
   if(!ns.length){if(atEnd)el.appendChild(s);else el.insertBefore(s,el.firstChild);y=s.getBoundingClientRect().top;s.remove();return y;}
   const r=document.createRange();let n,v,i;if(atEnd){n=ns[ns.length-1];v=n.nodeValue;i=v.length;while(i>0&&/\s/.test(v.charAt(i-1)))i--;}else{n=ns[0];v=n.nodeValue;i=0;while(i<v.length&&/\s/.test(v.charAt(i)))i++;}
   r.setStart(n,i);r.setEnd(n,i);r.insertNode(s);y=s.getBoundingClientRect().top;s.remove();el.normalize();return y;}
  function _gl(el){const cs=getComputedStyle(el);const g=document.createElement('canvas').getContext('2d');g.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;let t=el.textContent.trim()||'Ag';if(cs.textTransform==='uppercase')t=t.toUpperCase();const m=g.measureText(t);return {aa:m.actualBoundingBoxAscent,ad:m.actualBoundingBoxDescent};}
  const res={};
  for(const sel of SELS){const el=cont.querySelector(sel); if(!el||!el.textContent.trim()||!el.getClientRects().length) continue;
   const f=_leaf(el,false),l=_leaf(el,true),gf=_gl(f),gl=_gl(l),fs=parseFloat(getComputedStyle(el).fontSize)||0,r=el.getBoundingClientRect();
   res[sel]={top:_base(f,false)-gf.aa*SC,bottom:_base(l,true)+gl.ad*SC,fs:fs,sc:SC,x:r.left,w:r.width,rt:r.top,rb:r.bottom};}
  return res;},SELS);
 await p.addStyleTag({content:'html,body{background:transparent!important} *{background:none!important;background-image:none!important;box-shadow:none!important;text-shadow:none!important;filter:none!important;-webkit-text-fill-color:#000!important;color:#000!important;border-color:transparent!important;outline:none!important} img,svg,canvas,.bottom-block,.logos-row,.header-legal{visibility:hidden!important} *::before,*::after{display:none!important}'});
 const sels=Object.keys(pred);
 for(const [k,sel] of sels.entries()){
   await p.evaluate(([sels,sel])=>{for(const s of sels){const e=document.querySelector('.content '+s);if(e)e.style.visibility=(s===sel)?'visible':'hidden';}},[sels,sel]);
   const d=pred[sel]; const pad=d.fs*d.sc*0.9; const y0=Math.max(0,Math.min(d.top,d.rt)-pad), y1=Math.max(d.bottom,d.rb)+pad;
   d.clip={x:Math.max(0,d.x-20),y:y0,width:d.w+40,height:y1-y0};
   await p.screenshot({path:`${out}_${k}.png`,clip:d.clip,omitBackground:true});
   d.png=`${out}_${k}.png`;
 }
 fs.writeFileSync(out+'.json',JSON.stringify(pred)); await b.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
