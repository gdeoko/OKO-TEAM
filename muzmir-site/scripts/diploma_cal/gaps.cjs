const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:2000}});
for(const f of process.argv.slice(2)){
await p.goto('file://'+f,{waitUntil:'networkidle'});await p.waitForSelector("html[data-title-fit='1']",{timeout:9000}).catch(()=>{});await p.waitForTimeout(1200);
const r=await p.evaluate(()=>{const PX=document.querySelector('.diploma').getBoundingClientRect().width/210;
const n=['.header-legal','.logos-row','.competition-type','.competition-name','.support-line','.diploma-type','.diploma-degree','.extra-award','.awarded-label','.awarded-name','.awarded-name-script','.field-list','.gratitude-text'];
const out=[];for(const s of n){const e=document.querySelector('.content '+s);if(!e)continue;const r=e.getBoundingClientRect();out.push(s+' '+(r.top/PX).toFixed(1)+'-'+(r.bottom/PX).toFixed(1)+' mb='+getComputedStyle(e).marginBottom+' fs='+getComputedStyle(e).fontSize);}
const bb=document.querySelector('.bottom-block').getBoundingClientRect();out.push('bottom-block '+(bb.top/PX).toFixed(1));
const c=document.querySelector('.content');out.push('content tf '+getComputedStyle(c).transform+' padTop '+getComputedStyle(c).paddingTop);return out.join('\n');});
console.log('== '+f+'\n'+r);}await b.close();})();
