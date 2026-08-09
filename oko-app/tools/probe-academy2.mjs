/* ============================================================================
   OKO · ПРОБНИК АКАДЕМИИ (oko-academy2.js)

   Обходит ВСЕ экраны Академии в трёх вьюпортах (390×844, 360×740, 1440×900):
   каталог, поиск, страница курса, уроки (по два в каждом курсе), тест,
   практика, мини-игра, прогресс, сертификаты, закладки, офлайн, админ-панель.

   На каждом экране автоматически проверяет:
     • нет горизонтального переполнения страницы
     • нет блоков, вылезающих за правый край
     • нет обрезанного текста (реальная ширина больше видимой, без «…»)
     • есть работающая кнопка «назад» (шапка oko-back или своя .ac-back)
     • нет переносов посреди слова (word-break:break-all вне .oko-breakable)
     • ничего не заезжает под нижний бар и под шапку

   Запуск:
     python3 -m http.server 8199 --bind 127.0.0.1   (из oko-app/prototype)
     node oko-app/tools/probe-academy2.mjs [--round N] [--only 390]

   Скриншоты: oko-app/tools/academy2-*.png
   Отчёт:     oko-app/tools/academy2-report.json
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);

const BASE  = args.base || 'http://127.0.0.1:8199/index.html';
const ROUND = String(args.round || '1');
const OUT   = path.resolve('oko-app/tools');
const SHOTS = !(args.noshots);
/* Скриншоты по умолчанию снимаем на телефоне: остальные вьюпорты нужны для
   замеров, а лишние кадры в перегруженной песочнице стоят минут. */
const SHOT_VP = (args.shots && args.shots !== true) ? String(args.shots) : 'phone';

const VIEWPORTS = [
  { id: 'phone',   label: 'Телефон 390',  width: 390,  height: 844, mobile: true  },
  { id: 'narrow',  label: 'Узкий 360',    width: 360,  height: 740, mobile: true  },
  { id: 'tablet',  label: 'Планшет 820',  width: 820,  height: 1180, mobile: false },
  { id: 'desktop', label: 'ПК 1440',      width: 1440, height: 900, mobile: false },
];

/* Скрипт до загрузки страницы: пропуск авторизации (как в audit.mjs). */
const INIT = `
  window.okoSkipAuth = function(){
    try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
    var a=document.getElementById('authScreen'); if(a){a.classList.add('hidden'); a.style.display='none';}
    var s=document.getElementById('splash');     if(s){s.classList.add('gone');   s.style.display='none';}
    var o=document.getElementById('onboard');    if(o){o.classList.add('hidden'); o.style.display='none';}
  };
  try{
    localStorage.setItem('oko-onboard-done','1');
    localStorage.setItem('oko-stories-seen','1');
    localStorage.setItem('oko-tour-done','1');
    localStorage.setItem('oko-tour','1');
    localStorage.setItem('oko-owner','1');           /* админ-панель курса — только владельцу */
    localStorage.setItem('oko-onboarded','1');
    localStorage.setItem('oko-onb2-intro', JSON.stringify({done:true, skipped:true}));
    /* Оба премиум-направления открываем как купленные — иначе за гейт не пройти
       и половину экранов Академии просто не увидеть. Первое направление
       («Медийность», 45 уроков) проходим целиком: нужны экраны «курс пройден»,
       выдача сертификата и низ урока без «следующего». */
    var lessons = {};
    for(var i = 0; i < 45; i++)
      lessons[i] = { video:true, slides:true, test:true, testScore:90, task:true,
                     taskText:'Ответ ученика для проверки вёрстки экрана практики.',
                     game:true, gameWrong:0, slideMax:99, cert:null, mastered:true };
    localStorage.setItem('oko-academy', JSON.stringify({
      lessons: lessons, certs: [], owned:{media:true, marketing:true, ai:true},
      streak:{last:'', days:4, best:6}
    }));
  }catch(e){}
`;

/* Сброс состояния Академии между маршрутами (без перезагрузки страницы). */
const RESET = `(() => {
  try{ okoSkipAuth(); }catch(e){}
  /* попапы и подсказки соседних модулей (рост, viral) к Академии отношения
     не имеют, но перекрывают экран — убираем перед замером */
  try{ document.querySelectorAll('#okoPopup, .ac-master, #acBurst, .oko-toast, .okg-scrim, .okg-ob, .vr-nudge').forEach(e=>e.remove()); }catch(e){}
  try{ if(window.apdFullClose) apdFullClose(); }catch(e){}
  try{ if(window.apdNotesClose) apdNotesClose(); }catch(e){}
  try{ const f=document.getElementById('ac2Full'); if(f) f.classList.remove('open'); }catch(e){}
  try{ const c=document.getElementById('acCertFull'); if(c) c.classList.remove('open'); }catch(e){}
  try{ if(typeof showTab==='function') showTab('academy'); }catch(e){}
  try{ for(let k=0;k<3;k++){ if(window.acView && window.acView!=='home' && window.acBackHome) acBackHome(); } }catch(e){}
  try{ document.querySelectorAll('main, main > .screen').forEach(s=>{ s.scrollTop = 0; }); }catch(e){}
  return true;
})()`;

/* ---- Детектор дефектов, выполняется в странице ---- */
const PROBE = `(() => {
  const out = { overflowX:0, offRight:[], clipped:[], midWordBreak:[], underBottom:[], underTop:[],
                back:false, backKind:'', empty:false, text:0 };
  const VW = window.innerWidth, VH = window.innerHeight;

  const de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);

  const label = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0,3).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  const visible = el => {
    const cs = getComputedStyle(el);
    if(cs.display==='none' || cs.visibility==='hidden' || cs.opacity==='0') return false;
    const r = el.getBoundingClientRect();
    if(r.width<=0 || r.height<=0) return false;
    if(r.left >= VW-1 || r.right <= 1) return false;
    if(r.top  >= VH-1 || r.bottom <= 1) return false;
    return true;
  };

  /* кнопка «назад»: единая в шапке (oko-back.js) либо своя внутри экрана */
  const hb = Array.from(document.querySelectorAll('button.oko-back')).find(b=>!b.hasAttribute('hidden') && visible(b));
  if(hb){ out.back = true; out.backKind = 'header'; }
  else {
    const ib = Array.from(document.querySelectorAll('#acRoot .ac-back, .ac2-back, .acd-full.open .acd-full-close, .ac2-full.open .ac2-full-close, #acCertFull.open .ac-cert-full-close')).find(visible);
    if(ib){ out.back = true; out.backKind = label(ib); }
  }

  if(!out.back){
    out.backDbg = Array.from(document.querySelectorAll('button.oko-back')).map(b=>{
      const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
      return { hidden:b.hasAttribute('hidden'), d:cs.display, v:cs.visibility, o:cs.opacity,
               rect:[Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
               cls:String(b.className||'') };
    });
  }

  /* область, где сейчас смотрит человек: открытый оверлей или экран Академии */
  const layer = document.querySelector('.ac2-full.open, .acd-full.open, #acCertFull.open')
             || document.getElementById('screen-academy');
  const scope = layer || document.body;
  out.scope = layer ? label(layer) : 'screen-academy';
  const t = (scope.innerText || '').trim();
  out.text = t.length;
  out.empty = t.length < 20;

  /* нижний бар: на него не должно ложиться ничего плавающего.
     Обычный контент живёт внутри main и физически обрезан его границей,
     поэтому проверяем именно fixed/sticky-слои (кнопки, панели, шторки). */
  const bar = document.getElementById('tabs');
  const barRect = (bar && getComputedStyle(bar).display !== 'none' && !layer)
    ? bar.getBoundingClientRect() : null;

  const all = Array.from(scope.querySelectorAll('*')).slice(0, 5000);
  for(const el of all){
    if(el.ownerSVGElement) continue;
    if(el.closest('#okoTgChrome')) continue;
    if(!visible(el)) continue;
    const r  = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    let inScroller = false;
    for(let p = el.parentElement, d = 0; p && d < 6; p = p.parentElement, d++){
      const pcs = getComputedStyle(p);
      if(pcs.overflowX === 'auto' || pcs.overflowX === 'scroll'){ inScroller = true; break; }
    }

    if(!inScroller && r.right > VW + 1 && r.width < VW * 1.6)
      out.offRight.push({ el: label(el), right: Math.round(r.right), vw: VW });

    const txt = (el.textContent || '').trim();
    if(txt && el.children.length === 0){
      const intentional = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if(!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible')
        out.clipped.push({ el: label(el), text: txt.slice(0,48), sw: el.scrollWidth, cw: el.clientWidth });
      /* перенос посреди слова — только .oko-breakable вправе так делать */
      if(cs.wordBreak === 'break-all' && !el.closest('.oko-breakable') && /[А-Яа-яA-Za-z]{4,}/.test(txt))
        out.midWordBreak.push({ el: label(el), text: txt.slice(0,40) });
    }

    if(cs.position === 'fixed' || cs.position === 'sticky'){
      if(r.top < -1 && r.bottom > 2) out.underTop.push({ el: label(el), top: Math.round(r.top) });
      const fullBleed = r.top <= 1 && r.bottom >= VH - 1 && r.left <= 1 && r.right >= VW - 1;
      if(barRect && !fullBleed && r.bottom > barRect.top + 2 && r.top < barRect.bottom - 2)
        out.underBottom.push({ el: label(el), bottom: Math.round(r.bottom), bar: Math.round(barRect.top) });
    }
  }

  /* столкновение плавающих кнопок: две фиксированные кнопки не должны перекрываться */
  const fabs = Array.from(document.querySelectorAll('body button, body .okg-pill')).filter(el=>{
    const cs = getComputedStyle(el);
    return cs.position === 'fixed' && visible(el);
  }).map(el=>({ el: label(el), r: el.getBoundingClientRect() }));
  out.fabOverlap = [];
  for(let i=0;i<fabs.length;i++) for(let j=i+1;j<fabs.length;j++){
    const a = fabs[i].r, b = fabs[j].r;
    const ox = Math.min(a.right,b.right) - Math.max(a.left,b.left);
    const oy = Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top);
    if(ox > 8 && oy > 8) out.fabOverlap.push({ a: fabs[i].el, b: fabs[j].el });
  }

  const dedupe = a => { const s = new Set(); return a.filter(x=>{ const k = JSON.stringify(x); if(s.has(k)) return false; s.add(k); return true; }); };
  ['offRight','clipped','midWordBreak','underBottom','underTop','fabOverlap'].forEach(k=>{ out[k] = dedupe(out[k]).slice(0,10); });
  return out;
})()`;

/* Маршруты. step — что выполнить в странице, чтобы попасть на экран. */
function routes(){
  const R = [];
  const go = (id, name, step, wait, post) => R.push({ id, name, step, wait, post });

  go('01-catalog',  'Каталог Академии', `okoSkipAuth(); showTab('academy');`, 1000);
  go('02-search',   'Поиск по Академии', `okoSkipAuth(); showTab('academy'); ac2Search && ac2Search.open('пост');`, 700);
  go('03-bookmarks','Закладки и офлайн', `okoSkipAuth(); showTab('academy'); ac2Search && ac2Search.close && ac2Search.close(); window.ac2OpenLibrary && ac2OpenLibrary();`, 700);

  for(let ci = 0; ci < 3; ci++){
    go(`1${ci}-course`,  `Курс ${ci+1} · страница`, `okoSkipAuth(); showTab('academy'); acOpenCourse(${ci});`, 800);
    go(`1${ci}-cardfull`,`Курс ${ci+1} · карточка`, `okoSkipAuth(); showTab('academy'); apdCourseFullOpen(${ci});`, 800);
  }

  /* по два урока в каждом курсе: первый и середина */
  const lessonsOf = ci => (ci === 0 ? [0, 20] : ci === 1 ? [45, 65] : [91, 110]);
  for(let ci = 0; ci < 3; ci++){
    lessonsOf(ci).forEach((li, k) => {
      go(`2${ci}${k}-lesson`, `Курс ${ci+1} · урок ${li}`, `okoSkipAuth(); showTab('academy'); acOpenLesson(${li});`, 900);
      go(`2${ci}${k}-quiz`,   `Курс ${ci+1} · урок ${li} · тест`,
         `okoSkipAuth(); showTab('academy'); acOpenLesson(${li}); acQuizStart();`, 800);
      go(`2${ci}${k}-game`,   `Курс ${ci+1} · урок ${li} · игра`,
         `okoSkipAuth(); showTab('academy'); acOpenLesson(${li}); typeof acGameStart==='function' && acGameStart();`, 800);
    });
  }

  /* прогресс/сертификат: первое направление пройдено целиком через localStorage */
  go('30-done-course', 'Курс пройден · страница курса',
     `okoSkipAuth(); showTab('academy'); acOpenCourse(0);`, 1100);
  go('31-cert',        'Сертификат · документ',
     `okoSkipAuth(); showTab('academy'); acOpenLesson(0); typeof acIssueCert==='function' && acIssueCert();`, 1800);
  go('32-notes',       'Заметки к уроку',
     `okoSkipAuth(); showTab('academy'); acOpenLesson(0); typeof apdNotesOpen==='function' && apdNotesOpen();`, 700);
  go('33-admin',       'Админ-панель курса',
     `okoSkipAuth(); showTab('academy'); apdAdminOpen(0);`, 900);
  go('34-admin-mem',   'Админ · участники',
     `okoSkipAuth(); showTab('academy'); apdAdminOpen(0); apdAdminTab('members');`, 900);
  /* прокрутка живёт на <section class="screen">, а не на <main> */
  const BOX = `(document.querySelector('main > .screen.active') || document.querySelector('main'))`;
  const toBottom = `(()=>{const s=${BOX}; if(s) s.scrollTop = s.scrollHeight;})()`;
  go('35-lesson-end',  'Урок · низ страницы (переход дальше)',
     `okoSkipAuth(); showTab('academy'); acOpenLesson(1);`, 900, toBottom);
  go('36-lesson-last', 'Последний урок направления',
     `okoSkipAuth(); showTab('academy'); acOpenLesson(44);`, 900, toBottom);
  go('37-toc',         'Урок · оглавление раскрыто',
     `okoSkipAuth(); showTab('academy'); acOpenLesson(50); window.ac2Toc && ac2Toc();`, 800);
  go('38-task',        'Урок · практика',
     `okoSkipAuth(); showTab('academy'); acOpenLesson(0);`, 800,
     `(()=>{const b=document.getElementById('acTaskBox'); const s=${BOX}; if(b&&s) s.scrollTop = s.scrollTop + b.getBoundingClientRect().top - 90;})()`);
  go('39-catalog-end', 'Каталог · низ страницы',
     `okoSkipAuth(); showTab('academy');`, 900, toBottom);
  return R;
}

async function main(){
  const browser = await chromium.launch({
    executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });

  const report = { round: ROUND, at: new Date().toISOString(), viewports: [] };
  const only = args.only && args.only !== true ? String(args.only) : null;
  const R = routes();

  for(const vp of VIEWPORTS){
    if(only && vp.id !== only && String(vp.width) !== only) continue;
    const vRep = { viewport: vp.id, size: `${vp.width}x${vp.height}`, routes: [] };
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      /* песочница делит процессор с другими прогонами: без анимаций страница
         отвечает мгновенно, а замеры вёрстки от этого только точнее */
      reducedMotion: 'reduce',
      isMobile: vp.mobile, hasTouch: vp.mobile,
      userAgent: vp.mobile
        ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
        : undefined,
    });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    /* 3D-знак и three.js жгут процессор через программный GL и к Академии
       отношения не имеют. В песочнице это единственная причина, по которой
       страница отвечает секундами вместо миллисекунд. */
    await page.route('**/oko-eye.glb', r => r.abort());
    await page.route('**/vendor/**', r => r.abort());

    const errs = [];
    const NOISE = /ERR_CONNECTION_RESET|ERR_NAME_NOT_RESOLVED|ERR_BLOCKED|net::ERR_|api\.php|Failed to fetch|404/i;
    page.on('console', m => { if(m.type()==='error'){ const t=m.text().slice(0,180); if(!NOISE.test(t)) errs.push(t); } });
    page.on('pageerror', e => errs.push('PAGEERROR: ' + String(e).slice(0,180)));

    /* Одна загрузка на вьюпорт: app.js весит мегабайты, а песочница делится
       процессором с другими прогонами. Между маршрутами возвращаем Академию
       в исходное состояние скриптом RESET — это и быстрее, и стабильнее. */
    let loaded = false;
    async function ensure(force){
      if(loaded && !force) return;
      await page.goto(BASE, { waitUntil:'domcontentloaded', timeout:120000 });
      await page.waitForTimeout(1500);
      loaded = true;
    }
    for(const route of R){
      const rep = { route: route.id, name: route.name };
      try{
        errs.length = 0;
        await ensure(false);
        try{ await page.evaluate(RESET); }catch(e){ await ensure(true); }
        /* apdFullClose чистит слой отложенно — даём ему договорить, иначе
           следующий маршрут открывает слой и тут же получает пустую разметку */
        await page.waitForTimeout(340);
        try{ await page.evaluate(route.step); }
        catch(e){ rep.stepError = String(e).slice(0,160); }
        await page.waitForTimeout(route.wait || 700);
        /* выезжающие слои анимируются 260 мс; под нагрузкой rAF задерживается,
           и замер мог попасть в середину анимации — ждём, пока трансформ уляжется */
        try{
          await page.waitForFunction(() => {
            const f = document.querySelector('.ac2-full.open');
            return !f || getComputedStyle(f).transform === 'none';
          }, null, { timeout: 6000 });
        }catch(e){}
        if(route.post){
          try{ await page.evaluate(route.post); }catch(e){ rep.postError = String(e).slice(0,120); }
          await page.waitForTimeout(500);
        }
        Object.assign(rep, await page.evaluate(PROBE));
        rep.consoleErrors = errs.slice(0, 5);
        if(SHOTS && (SHOT_VP === 'all' || SHOT_VP === vp.id)){
          const file = path.join(OUT, `academy2-${vp.id}-${route.id}.png`);
          try{ await page.screenshot({ path:file, timeout:15000 }); rep.shot = path.basename(file); }
          catch(e){ rep.shotSkipped = String(e).slice(0,60); }
        }
      }catch(e){ rep.fatal = String(e).slice(0,200); loaded = false; }
      vRep.routes.push(rep);
      const flags = [
        rep.overflowX > 0 ? `overflowX=${rep.overflowX}` : '',
        rep.offRight?.length ? `offRight=${rep.offRight.length}` : '',
        rep.clipped?.length ? `clipped=${rep.clipped.length}` : '',
        rep.midWordBreak?.length ? `midWord=${rep.midWordBreak.length}` : '',
        rep.underBottom?.length ? `underBottom=${rep.underBottom.length}` : '',
        rep.underTop?.length ? `underTop=${rep.underTop.length}` : '',
        rep.fabOverlap?.length ? `fabOverlap=${rep.fabOverlap.length}` : '',
        rep.back === false ? 'NO-BACK' : '',
        rep.empty ? 'EMPTY' : '',
        rep.stepError ? 'STEP-ERR' : '',
        rep.consoleErrors?.length ? `err=${rep.consoleErrors.length}` : '',
        rep.fatal ? 'FATAL' : '',
      ].filter(Boolean).join(' ');
      console.log(`${vp.id.padEnd(8)} ${route.id.padEnd(14)} ${flags || 'ok'}`);
    }
    await ctx.close();
    report.viewports.push(vRep);
  }
  await browser.close();

  let layout = 0, nav = 0, code = 0, empty = 0, step = 0;
  const msgs = new Map();
  for(const v of report.viewports) for(const r of v.routes){
    layout += (r.overflowX > 0 ? 1 : 0) + (r.offRight?.length||0) + (r.clipped?.length||0)
            + (r.midWordBreak?.length||0) + (r.underBottom?.length||0) + (r.underTop?.length||0)
            + (r.fabOverlap?.length||0);
    if(r.back === false) nav++;
    if(r.empty) empty++;
    if(r.stepError || r.fatal) step++;
    for(const e of (r.consoleErrors||[])){ code++; msgs.set(e.slice(0,110), (msgs.get(e.slice(0,110))||0)+1); }
  }
  report.summary = { layout, noBack: nav, empty, stepErrors: step, codeErrors: code,
                     topErrors: [...msgs.entries()].slice(0,8).map(([m,n])=>`${n}× ${m}`) };

  await fs.writeFile(path.join(OUT, 'academy2-report.json'), JSON.stringify(report, null, 2));
  console.log('\nИТОГ ' + JSON.stringify(report.summary, null, 2));
  console.log('отчёт: oko-app/tools/academy2-report.json');
}

main().catch(e => { console.error(e); process.exit(1); });
