/* Воспроизводим ровно тот детектор, что в обходе кликов, и печатаем не только
   слово, но и узел — чтобы понять, где именно он срабатывает. */
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox'] });
const c = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await c.addInitScript(`window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1')}catch(e){}`);
const p = await c.newPage();
await p.goto('http://127.0.0.1:8199/index.html',{waitUntil:'domcontentloaded'});
await p.waitForTimeout(2000);

const DETECT = `(() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.ownerSVGElement) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const txt = (el.textContent || '').trim();
    if (!txt || el.children.length) continue;
    if (!(cs.wordBreak === 'break-all' || cs.overflowWrap === 'anywhere')) continue;
    if (r.width >= 200) continue;
    const word = txt.split(/\\s+/).reduce((a, w) => w.length > a.length ? w : a, '');
    if (word.length < 6) continue;
    const avail = Math.max(el.clientWidth, Math.round(r.width));
    if (avail <= 4) continue;
    const cv = document.createElement('canvas'), g = cv.getContext('2d');
    g.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    const w = g.measureText(word).width;
    if (w <= avail + 1) continue;
    let path = el.tagName.toLowerCase();
    if (el.className && typeof el.className === 'string') path += '.' + el.className.trim().split(/\\s+/).join('.');
    let par = el.parentElement, chain = [];
    for (let i = 0; par && i < 3; par = par.parentElement, i++) {
      chain.push(par.tagName.toLowerCase() + (par.id ? '#' + par.id : '') + (par.className && typeof par.className === 'string' ? '.' + par.className.trim().split(/\\s+/)[0] : ''));
    }
    out.push({ узел: path, предки: chain.join(' < '), текст: txt.slice(0,50), слово: word, надо: Math.round(w), есть: avail, кегль: cs.fontSize, ow: cs.overflowWrap, wb: cs.wordBreak });
  }
  return out;
})()`;

async function шаг(имя, js) {
  await p.evaluate(js).catch(e => console.log('  шаг упал:', String(e).slice(0,80)));
  await p.waitForTimeout(1000);
  const r = await p.evaluate(DETECT);
  console.log('\n=== ' + имя + ' === найдено: ' + r.length);
  for (const x of r.slice(0, 8)) console.log('   ', JSON.stringify(x));
}

await шаг('профиль', `okoSkipAuth(); showTab('profile')`);
await шаг('моя страница', `(()=>{const b=[...document.querySelectorAll('[data-my]')].find(x=>x.getAttribute('data-my')==='page'); b&&b.click();})()`);
await шаг('создать сущность', `(()=>{ if(window.okoSocial&&okoSocial.isOpen()) okoSocial.close(); const b=[...document.querySelectorAll('[data-my]')].find(x=>x.getAttribute('data-my')==='create'); b&&b.click();})()`);
await шаг('соцсети', `(()=>{ if(window.okoSocial&&okoSocial.isOpen()) okoSocial.close(); showTab('mini'); openMa('socials');})()`);
await b.close();
