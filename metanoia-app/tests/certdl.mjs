// Бланк сертификата действительно скачивается файлом.
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--no-sandbox','--disable-background-networking'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, acceptDownloads:true });
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
p.on('download', d=>console.log('СКАЧАЛОСЬ: ' + d.suggestedFilename()));
await p.route(u => !u.href.startsWith('http://127.0.0.1'), r=>r.abort());
await p.goto('http://127.0.0.1:8777/index.html',{waitUntil:'load'});
await p.evaluate(()=>{ localStorage.clear(); localStorage.setItem('mt_onb','1'); localStorage.setItem('mt_auth','1'); localStorage.setItem('mt_name','Соня'); localStorage.setItem('mt_exam_0', JSON.stringify({pct:95, ts: Date.now()})); });
await p.reload({waitUntil:'load'});
await p.waitForSelector('.splash--hide',{timeout:20000}).catch(()=>{});
await p.waitForTimeout(700);
const итог = await p.evaluate(async ()=>{
  const пауза=(м)=>new Promise(r=>setTimeout(r,м));
  openCertificates(); await пауза(400);
  document.querySelector('#certGrid [data-cert="b1"]').click(); await пауза(600);
  // повторяем шаги функции вручную, чтобы увидеть, где ломается
  const svg = certSVG(currentCert, именаДляСертификата());
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const рез = await new Promise((готово)=>{
    const i = new Image();
    i.onload = ()=>готово('картинка загрузилась ' + i.width + 'x' + i.height);
    i.onerror = (e)=>готово('картинка НЕ загрузилась');
    i.src = url;
    setTimeout(()=>готово('ожидание вышло'), 4000);
  });
  return { длинаSVG: svg.length, естьВнешние: /href=|xlink/.test(svg), результат: рез };
});
console.log('РАЗБОР: ' + JSON.stringify(итог));
await p.evaluate(()=>document.getElementById('certDl').click());
await p.waitForTimeout(3000);
console.log('ТОСТ: ' + (await p.evaluate(()=>(document.getElementById('toast')||{}).textContent||'')));
console.log('ОШИБОК: ' + errs.length); errs.slice(0,3).forEach(e=>console.log(e));
await b.close();
