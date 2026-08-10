/* ============================================================================
   OKO · ПОЛНЫЙ АУДИТ ПО КАРТЕ ЭКРАНОВ

   Отличия от прежнего audit.mjs, из-за которых он пропускал дефекты:

   1. Ходит по routes.json — карте, которую построил map-routes.mjs, а не по
      списку из 24 маршрутов, написанному руками. Экранов в приложении больше
      сотни, включая меню и подстраницы внутри разделов.

   2. Смотрит ВЕСЬ экран, а не первую его высоту. Прежний аудит снимал кадр
      видимой области и мерил только её — всё, что ниже сгиба, не проверялось
      вообще. Здесь экран прокручивается до конца шагами, и замер делается на
      каждом шаге.

   3. Перенос посреди слова ищется замером по строчным боксам через Range
      (сменилась ли строка между двумя буквами одного слова), а не прикидкой
      ширины канвасом. Прикидка давала 18 ложных срабатываний из 18 и при этом
      пропускала настоящие.

   4. Ширину меряет offsetWidth, а не getBoundingClientRect: у прямоугольника
      ширина считается ПОСЛЕ transform, и панель, пойманная в середине выезда,
      кажется уже, чем она есть.

   5. Одинаковые кадры на разных экранах — отдельная находка: значит переход
      не сработал и замеры недействительны.

   Запуск:
     node oko-app/tools/audit-all.mjs --round 40
     node oko-app/tools/audit-all.mjs --round 40 --only 390     — одна ширина
     node oko-app/tools/audit-all.mjs --round 40 --from 50 --to 90
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { CLEAN_START, CLOSE_OVERLAYS, OVERLAY_VISIBLE } from './clean-start.mjs';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);
const РАУНД = args.round || '40';
const БАЗА  = args.base || 'http://127.0.0.1:8199/index.html';
const OUT   = `oko-app/tools/audit-out/round-${РАУНД}`;
const СНИМАТЬ = !args.noshots;

const РЕЖИМЫ = [
  { id: '320', w: 320, h: 720, tg: false },
  { id: '390', w: 390, h: 844, tg: false },
  { id: 'tg',  w: 390, h: 788, tg: true  },
  { id: '1440', w: 1440, h: 900, tg: false },
].filter(m => !args.only || args.only === true || String(args.only).split(',').includes(m.id));

/* --------------------------------------------------------------- детектор */
const ПРОВЕРКА = `(() => {
  const out = { переполнение: 0, обрезано: [], разрывы: [], подШапкой: [], пусто: false,
                наложения: [], фейк: [], эмодзи: [] };
  const VW = innerWidth;
  out.переполнение = Math.max(0, document.documentElement.scrollWidth - VW);

  const видим = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 3 && r.height > 3 && r.bottom > 0 && r.top < innerHeight;
  };

  /* шапка приложения — под неё ничего не должно уезжать */
  const шапка = document.querySelector('header, .app-head, #okoHead, .hd');
  const низШапки = шапка && видим(шапка) ? шапка.getBoundingClientRect().bottom : 0;

  const ЭМОДЗИ = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}]/u;
  const ФЕЙК = /(\\d+[.,]?\\d*\\s*(к|k|м|m)\\s*(подписчик|просмотр|охват))|(\\+\\d{2,}%\\s*к\\s)|(проверено на \\d+)/i;

  const пусто = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.ownerSVGElement || !видим(el)) return;
    const cs = getComputedStyle(el);
    const r  = el.getBoundingClientRect();
    const свой = el.children.length === 0;
    const txt = (el.textContent || '').trim();

    if (свой && txt) {
      пусто.push(1);

      /* обрезание: содержимое шире ячейки и спрятано */
      const намеренно = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if (!намеренно && el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible')
        if (out.обрезано.length < 8) out.обрезано.push(txt.slice(0, 38));

      /* под шапкой */
      if (низШапки && r.top < низШапки - 1 && r.bottom > 2)
        if (out.подШапкой.length < 6) out.подШапкой.push(txt.slice(0, 30));

      /* эмодзи в интерфейсе */
      if (ЭМОДЗИ.test(txt) && !el.closest('.emj-grid, .emj-list, [data-emoji-content]'))
        if (out.эмодзи.length < 6) out.эмодзи.push(txt.slice(0, 24));

      /* выдуманные метрики */
      if (ФЕЙК.test(txt))
        if (out.фейк.length < 6) out.фейк.push(txt.slice(0, 44));

      /* перенос посреди слова — замер по настоящим строкам */
      const шир = el.offsetWidth || Math.round(r.width);
      if ((cs.wordBreak === 'break-all' || cs.overflowWrap === 'anywhere') && шир < 240) {
        const слово = txt.split(/\\s+/).reduce((a, w) => w.length > a.length ? w : a, '');
        if (слово.length >= 6) {
          const cv = document.createElement('canvas'), g = cv.getContext('2d');
          g.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
          if (g.measureText(слово).width > Math.max(el.clientWidth, шир) + 1) {
            const n = el.firstChild;
            if (n && n.nodeType === 3) {
              const rng = document.createRange(), t = n.nodeValue || '';
              let низ = null, пред = '';
              for (let k = 0; k < t.length; k++) {
                const ch = t[k];
                rng.setStart(n, k); rng.setEnd(n, k + 1);
                const rc = rng.getClientRects();
                if (!rc.length) { пред = ch; continue; }
                const b2 = Math.round(rc[0].bottom);
                if (низ !== null && b2 > низ + 2 &&
                    /[\\wа-яёА-ЯЁ]/.test(пред) && /[\\wа-яёА-ЯЁ]/.test(ch)) {
                  if (out.разрывы.length < 6)
                    out.разрывы.push(t.slice(Math.max(0, k - 8), k) + '|' + t.slice(k, k + 8));
                  break;
                }
                низ = b2; пред = ch;
              }
            }
          }
        }
      }
    }
  });

  /* наложение: центр кнопки перекрыт чужим узлом */
  document.querySelectorAll('button, [role="button"], .prow, .pp2-row').forEach(el => {
    if (!видим(el) || out.наложения.length >= 5) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return;
    const сверху = document.elementFromPoint(cx, cy);
    if (!сверху || сверху === el || el.contains(сверху) || сверху.contains(el)) return;
    /* вложенные кнопки — не дефект */
    if (сверху.closest('button, [role="button"]') === el) return;
    out.наложения.push(((el.textContent || '').trim().slice(0, 24) || el.className) +
      ' ← ' + сверху.tagName.toLowerCase() + '.' + String(сверху.className).trim().split(/\\s+/)[0]);
  });

  out.пусто = пусто.length < 3;
  return out;
})()`;

const ГЕОМЕТРИЯ = `(() => {
  const scr = document.querySelector('main > .screen.active');
  const прокрутка = el => el && el.scrollHeight > el.clientHeight + 4;
  let ц = scr;
  if (!прокрутка(ц)) {
    ц = [...document.querySelectorAll('main .screen.active *, .open')]
      .find(e => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible') || scr;
  }
  if (!ц) return { высота: 0, окно: innerHeight };
  return { высота: ц.scrollHeight, окно: ц.clientHeight, top: ц.scrollTop };
})()`;

/* ------------------------------------------------------------------ прогон */
const карта = JSON.parse(await fs.readFile(args.routes || 'oko-app/tools/routes.json', 'utf-8'));
const ОТ = +(args.from || 0), ДО = +(args.to || карта.length);
const маршруты = карта.slice(ОТ, ДО);
await fs.mkdir(OUT, { recursive: true });

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});

const отчёт = { раунд: РАУНД, экранов: маршруты.length, режимы: [] };
let всегоЗамечаний = 0;

for (const m of РЕЖИМЫ) {
  const c = await b.newContext({ viewport: { width: m.w, height: m.h }, isMobile: m.w < 900, hasTouch: m.w < 900 });
  await c.addInitScript(CLEAN_START);
  if (m.tg) await c.addInitScript(`window.Telegram={WebApp:{initData:'',initDataUnsafe:{},version:'7.0',platform:'android',colorScheme:'dark',themeParams:{},isExpanded:true,viewportHeight:${m.h},viewportStableHeight:${m.h},safeAreaInset:{top:0,bottom:0,left:0,right:0},contentSafeAreaInset:{top:56,bottom:0,left:0,right:0},expand(){},ready(){},close(){},onEvent(){},offEvent(){},sendData(){},HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},BackButton:{show(){},hide(){},onClick(){},offClick(){}},MainButton:{show(){},hide(){},setText(){},onClick(){},offClick(){},setParams(){}},CloudStorage:{getItem(k,cb){cb&&cb(null,null)},setItem(k,v,cb){cb&&cb(null,true)}},disableVerticalSwipes(){},enableClosingConfirmation(){},requestFullscreen(){}}};`);
  const p = await c.newPage();
  const ошибки = [];
  p.on('pageerror', e => ошибки.push(String(e).split('\n')[0].slice(0, 120)));
  p.on('dialog', d => d.dismiss().catch(() => {}));

  await p.goto(БАЗА, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2600);
  await p.evaluate('okoSkipAuth()');

  const режимОтчёт = { режим: m.id, экраны: [] };
  console.log(`\n═══ режим ${m.id} (${m.w}×${m.h}${m.tg ? ', telegram' : ''}) ═══`);

  for (const r of маршруты) {
    ошибки.length = 0;
    const зам = { id: r.id, имя: r.имя, замечания: [] };
    try {
      /* сброс и проход маршрута с нуля */
      for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(50); }
      await p.evaluate(`(()=>{ try{ if(window.okoSocial&&okoSocial.isOpen&&okoSocial.isOpen()) okoSocial.close(); }catch(e){}
        try{ if(typeof closeConv==='function') closeConv(); }catch(e){}
        try{ if(typeof closeSheet==='function') closeSheet(); }catch(e){}
        try{ if(typeof closeMa==='function') closeMa(); }catch(e){} })()`).catch(() => {});
      await p.waitForTimeout(150);
      for (const шаг of r.путь) { await p.evaluate(шаг).catch(() => {}); await p.waitForTimeout(650); }

      await p.evaluate(CLOSE_OVERLAYS).catch(() => {});
      await p.evaluate(`(() => new Promise(res => { let n = 0; const t = () => { n++;
        let run = 0; try { run = document.getAnimations().filter(a => a.playState === 'running').length; } catch(e){}
        if (!run || n > 18) return res(n); setTimeout(t, 40); }; t(); }))()`).catch(() => {});

      const подмена = await p.evaluate(OVERLAY_VISIBLE).catch(() => '');
      if (подмена) зам.замечания.push('экран подменён: ' + подмена);

      /* --- проходим экран сверху донизу --- */
      const г = await p.evaluate(ГЕОМЕТРИЯ).catch(() => ({ высота: 0, окно: m.h }));
      const шагов = Math.max(1, Math.min(12, Math.ceil((г.высота || m.h) / Math.max(200, (г.окно || m.h) * 0.85))));
      const собрано = { обрезано: new Set(), разрывы: new Set(), подШапкой: new Set(), наложения: new Set(), фейк: new Set(), эмодзи: new Set() };
      let переполнение = 0, пустых = 0;

      for (let s = 0; s < шагов; s++) {
        if (s) {
          await p.evaluate(`(() => { const scr = document.querySelector('main > .screen.active');
            let ц = scr;
            if (!(ц && ц.scrollHeight > ц.clientHeight + 4))
              ц = [...document.querySelectorAll('main .screen.active *, .open')]
                .find(e => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== 'visible') || scr;
            if (ц) ц.scrollTop = Math.round(ц.clientHeight * 0.85) * ${s};
          })()`).catch(() => {});
          await p.waitForTimeout(320);
        }
        const пр = await p.evaluate(ПРОВЕРКА).catch(() => null);
        if (!пр) continue;
        переполнение = Math.max(переполнение, пр.переполнение);
        if (пр.пусто) пустых++;
        ['обрезано','разрывы','подШапкой','наложения','фейк','эмодзи'].forEach(k => пр[k].forEach(v => собрано[k].add(v)));
      }

      if (переполнение > 1) зам.замечания.push('горизонтальное переполнение ' + переполнение + 'px');
      if (пустых === шагов) зам.замечания.push('экран пустой');
      Object.entries(собрано).forEach(([k, v]) => {
        if (v.size) зам.замечания.push(k + ': ' + [...v].slice(0, 4).join(' | '));
      });
      const своиОшибки = [...new Set(ошибки)].filter(e => !/api\.php|ERR_CONNECTION|Failed to load resource/i.test(e));
      if (своиОшибки.length) зам.замечания.push('ошибка JS: ' + своиОшибки[0]);

      if (СНИМАТЬ) {
        await p.evaluate(`(()=>{const scr=document.querySelector('main > .screen.active'); if(scr) scr.scrollTop=0;})()`).catch(() => {});
        await p.waitForTimeout(200);
        const f = path.join(OUT, `${m.id}__${r.id}.png`);
        await p.screenshot({ path: f, timeout: 12000 }).catch(() => {});
      }
    } catch (e) {
      зам.замечания.push('падение: ' + String(e).slice(0, 90));
    }
    режимОтчёт.экраны.push(зам);
    всегоЗамечаний += зам.замечания.length;
    if (зам.замечания.length) console.log(`  ${r.id} ${r.имя.slice(0, 44).padEnd(46)} ${зам.замечания.length}`);
  }
  отчёт.режимы.push(режимОтчёт);
  await c.close();
}
await b.close();

/* --- одинаковые кадры: значит переход не сработал --- */
let повторов = 0;
if (СНИМАТЬ) {
  const кадры = new Map();
  for (const f of (await fs.readdir(OUT)).filter(f => f.endsWith('.png'))) {
    const h = crypto.createHash('md5').update(await fs.readFile(path.join(OUT, f))).digest('hex');
    if (!кадры.has(h)) кадры.set(h, []);
    кадры.get(h).push(f);
  }
  повторов = [...кадры.values()].filter(g => g.length > 1).reduce((n, g) => n + g.length, 0);
}

await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify(отчёт, null, 1));
const поВидам = {};
отчёт.режимы.forEach(m => m.экраны.forEach(э => э.замечания.forEach(z => {
  const k = z.split(':')[0].split(' ')[0];
  поВидам[k] = (поВидам[k] || 0) + 1;
})));
console.log(`\n╔═══ РАУНД ${РАУНД} ═══`);
console.log(`║ экранов проверено: ${маршруты.length} × ${РЕЖИМЫ.length} режима`);
console.log(`║ всего замечаний:   ${всегоЗамечаний}`);
Object.entries(поВидам).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`║   ${k.padEnd(24)} ${v}`));
console.log(`║ одинаковых кадров: ${повторов}${повторов ? '  ← эти экраны не открылись' : ''}`);
console.log(`╚ отчёт: ${path.join(OUT, 'report.json')}`);
