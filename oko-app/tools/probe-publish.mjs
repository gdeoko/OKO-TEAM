/* ============================================================================
   Сквозная проверка главного сценария роста, о котором просил Даниэль:
   «чтобы лента рекомендаций росла — клипы 9:16 и 16:9 постили в каналы,
    они попадают в рекомендации».

   Идём точными селекторами соцслоя, а не «по тексту»: на странице канала и
   в форме публикации кнопки называются одинаково («Опубликовать»), и поиск
   по подписи щёлкает не по той.
     #socActPublish        — открыть форму
     [data-a="fmt"]        — выбрать формат (Клип 9:16 / Клип 16:9 / Пост)
     [data-a="pubgo"]      — отправить
   ============================================================================ */
import { chromium } from 'playwright-core';

const PNG1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await c.addInitScript(`
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash'); if(s){s.classList.add('gone'); s.style.display='none';}
    var o=document.getElementById('onboard'); if(o){o.classList.add('hidden'); o.style.display='none';}
  };
  try{
    localStorage.setItem('oko-onboard-done','1');
    localStorage.setItem('oko-stories-seen','1');
    localStorage.setItem('oko-tour-done','1');
    localStorage.setItem('oko-tour','1');
  }catch(e){}
  window.confirm = () => true;
`);
const p = await c.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e).split('\n')[0].slice(0, 160)));

await p.goto('http://127.0.0.1:8199/index.html', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);
await p.evaluate('okoSkipAuth()');

const click = sel => p.evaluate(s => {
  const el = document.querySelector(s);
  if (!el) return false;
  el.click();
  return true;
}, sel);

const counts = () => p.evaluate(`(() => {
  const tabs = [...document.querySelectorAll('.soc-tab')].map(x => x.textContent.replace(/\\s+/g,' ').trim());
  const num = re => { const t = tabs.find(x => re.test(x)); const m = t && t.match(/(\\d+)\\s*$/); return m ? +m[1] : null; };
  return { посты: num(/Посты/), клипы: num(/Клипы/) };
})()`);

const out = { шаги: [] };

/* --- открываем канал OKO --- */
out.ключКанала = await p.evaluate(`(() => {
  for (const k of ['c:oko-channel','x:oko-channel']) {
    try { if (window.okoSocial.entity(k)) { window.okoSocial.open(k); return k; } } catch(e){}
  }
  return null;
})()`);
await p.waitForTimeout(900);
out.шаги.push({ шаг: 'канал открыт', ...(await counts()) });

/* --- публикуем ПОСТ --- */
out.формаОткрыта = await click('#socActPublish');
await p.waitForTimeout(700);
out.естьФорма = await p.evaluate(`!!document.querySelector('#socPubText')`);
await p.evaluate(`(() => {
  const b = [...document.querySelectorAll('#okoSoc [data-a="fmt"]')].find(x => /Пост/.test(x.textContent));
  if (b) b.click();
})()`);
await p.waitForTimeout(300);
await p.evaluate(`(() => {
  const ta = document.querySelector('#socPubText');
  if (ta) { ta.value = 'Проверочный пост канала OKO'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
})()`);
await p.waitForTimeout(200);
out.отправкаПоста = await click('#okoSoc [data-a="pubgo"]');
await p.waitForTimeout(1200);
out.шаги.push({ шаг: 'пост отправлен', ...(await counts()) });

/* --- клип 9:16 БЕЗ медиа: публиковаться не должен --- */
await click('#socActPublish');
await p.waitForTimeout(600);
await p.evaluate(`(() => {
  const b = [...document.querySelectorAll('#okoSoc [data-a="fmt"]')].find(x => /9:16/.test(x.textContent));
  if (b) b.click();
})()`);
await p.waitForTimeout(300);
await p.evaluate(`(() => {
  const ta = document.querySelector('#socPubText');
  if (ta) { ta.value = 'Клип без медиа'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
})()`);
await click('#okoSoc [data-a="pubgo"]');
await p.waitForTimeout(900);
out.шаги.push({ шаг: 'клип 9:16 без медиа (не должен пройти)', ...(await counts()) });

/* --- клип 9:16 С обложкой --- */
await p.evaluate(`(() => {
  const ta = document.querySelector('#socPubText');
  if (ta) { ta.value = 'Проверочный клип 9:16'; ta.dispatchEvent(new Event('input', { bubbles: true })); }
  const inp = document.querySelector('#socPubCover');
  if (inp) {
    /* подставляем обложку так же, как это делает обработчик выбора файла */
    try { window.__okoTestCover && window.__okoTestCover(); } catch(e){}
  }
})()`);
out.обложкаЧерезApi = await p.evaluate(`(() => {
  /* PUB — внутреннее состояние модуля; если оно не наружу, пробуем через
     событие change на скрытом input с подставленным файлом */
  try { if (typeof PUB === 'object' && PUB) { PUB.cover = ${JSON.stringify(PNG1)}; return 'PUB'; } } catch(e){}
  return 'нет доступа к PUB';
})()`);
await p.waitForTimeout(200);
out.отправкаКлипа = await click('#okoSoc [data-a="pubgo"]');
await p.waitForTimeout(1300);
out.шаги.push({ шаг: 'клип 9:16 с обложкой', ...(await counts()) });

/* --- дошло ли до ленты --- */
out.вЛенте = await p.evaluate(`(() => {
  try {
    let n = 0;
    ['rec','sub'].forEach(k => (POSTS[k] || []).forEach(x => { if (/Проверочный/.test(x.body || '')) n++; }));
    return n;
  } catch(e){ return 'нет доступа: ' + e; }
})()`);
out.сохранилось = await p.evaluate(`(() => {
  try {
    const raw = localStorage.getItem('oko-social-v1');
    if (!raw) return 'ключа нет';
    const j = JSON.parse(raw);
    return Object.keys(j.items || {}).length;
  } catch(e){ return 'ошибка: ' + e; }
})()`);

out.ошибки = [...new Set(errs)];
await p.screenshot({ path: 'oko-app/tools/publish-flow.png' });
console.log(JSON.stringify(out, null, 2));
await b.close();
