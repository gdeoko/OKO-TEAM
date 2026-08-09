/* Проверка сигналов удержания: считаются секунды, досмотры, повторы и
   ранний отвал; формула ранжирования их учитывает. */
import { chromium } from 'playwright-core';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await c.addInitScript(`window.okoSkipAuth=function(){try{localStorage.setItem('oko-auth','tg')}catch(e){};var a=document.getElementById('authScreen');if(a){a.classList.add('hidden');a.style.display='none'}var s=document.getElementById('splash');if(s){s.classList.add('gone');s.style.display='none'}var o=document.getElementById('onboard');if(o){o.classList.add('hidden');o.style.display='none'}};try{localStorage.setItem('oko-onboard-done','1');localStorage.setItem('oko-stories-seen','1');localStorage.setItem('oko-tour-done','1');localStorage.setItem('oko-tour','1')}catch(e){}`);
const p = await c.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).slice(0, 180)));
await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1800);

const out = {};
out.apiEsть = await p.evaluate(`!!(window.okoWatch && okoWatch.stats && okoWatch.notInterested && okoWatch.summary)`);
out.формулаПропатчена = await p.evaluate(`!!(typeof feedScore === 'function' && feedScore.__okoSig)`);

/* Синтетическое видео: проверяем, что счётчики реально набегают. */
out.трекинг = await p.evaluate(`(async () => {
  const wrap = document.createElement('div');
  wrap.setAttribute('data-post-id', 'test-clip-1');
  const v = document.createElement('video');
  v.muted = true; v.loop = false; v.playsInline = true;
  /* короткое валидное mp4 не нужно — хватит canvas-потока */
  const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32;
  const ctx = cv.getContext('2d');
  let t = 0;
  const iv = setInterval(() => { t++; ctx.fillStyle = t % 2 ? '#0f0' : '#000'; ctx.fillRect(0,0,32,32); }, 60);
  v.srcObject = cv.captureStream(20);
  wrap.appendChild(v); document.body.appendChild(wrap);
  await new Promise(r => setTimeout(r, 120));   /* даём наблюдателю подцепить узел */
  await v.play().catch(()=>{});
  await new Promise(r => setTimeout(r, 2600));
  v.pause();
  clearInterval(iv);
  await new Promise(r => setTimeout(r, 1500));  /* дождаться отложенного сохранения */
  const st = window.okoWatch.stats('test-clip-1');
  wrap.remove();
  return st ? { показы: st.shows, секунды: +st.sec.toFixed(1), отвал: st.drop } : 'нет статистики';
})()`);

out.неИнтересно = await p.evaluate(`(() => {
  try{ window.okoWatch.notInterested('test-clip-2', 'content', 'Кто-то'); }catch(e){ return 'ошибка: ' + e; }
  const st = window.okoWatch.stats('test-clip-2');
  return st ? { отвал: st.drop, показы: st.shows } : 'нет статистики';
})()`);

out.сводка = await p.evaluate(`window.okoWatch.summary()`);
out.сохраняется = await p.evaluate(`!!localStorage.getItem('oko-watch-v1')`);
out.ошибки = [...new Set(errs)];
console.log(JSON.stringify(out, null, 2));
await b.close();
