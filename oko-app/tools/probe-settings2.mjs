/* ============================================================================
   OKO · ПРОБНИК РАЗДЕЛА «НАСТРОЙКИ И БЕЗОПАСНОСТЬ» (oko-settings2.js)
   ----------------------------------------------------------------------------
   Обходит ВСЕ панели настроек в трёх вьюпортах и двух темах:
     • нет горизонтального переполнения страницы
     • нет обрезанного текста (без осознанного многоточия)
     • на каждом экране есть работающая кнопка «назад»
     • нет переносов посреди слова (word-break:break-all вне .oko-breakable)
     • ничего не заезжает под шапку Telegram и под нижнюю зону
   Отдельно: переключает КАЖДЫЙ тумблер и возвращает обратно, а также
   проверяет, что строка пароля и код-пароля НЕ появляются ни в DOM,
   ни в localStorage.

   Запуск:
     python3 -m http.server 8199 --bind 127.0.0.1   (из oko-app/prototype)
     node oko-app/tools/probe-settings2.mjs [--round N]
   ============================================================================ */
import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => { const [k, ...v] = s.trim().split(/\s+/); return [k, v.join(' ') || true]; })
);

const BASE = args.base || 'http://127.0.0.1:8199/index.html';
const ROUND = String(args.round || '1');
const OUT = path.resolve('oko-app/tools');
/* --noshots: прогон только замеров, без скриншотов — быстрее на загруженной машине */
const NOSHOTS = !!args.noshots;

/* Секреты-маркеры: их не должно оказаться ни в DOM, ни в localStorage. */
const PROBE_PW = 'Pr0be-Pass-9137!zZ';
const PROBE_PW_NEW = 'Qx7-Probe-New-4821!';
const PROBE_PIN = '4729';

const TG_HEADER = 56;
const TG_BOTTOM = 34;

const VIEWPORTS = [
  { id: 'phone', label: 'Телефон 390×844', width: 390, height: 844, mobile: true },
  { id: 'narrow', label: 'Узкий Android 360×740', width: 360, height: 740, mobile: true },
  { id: 'desk', label: 'ПК 1440×900', width: 1440, height: 900, mobile: false },
];
const THEMES = ['dark', 'light'];

/* Все панели раздела. shots: снимать ли скрин в этом прогоне. */
const PANELS = [
  { id: 'root', name: 'Корень настроек' },
  { id: 'profile', name: 'Профиль' },
  { id: 'accounts', name: 'Аккаунты на устройстве' },
  { id: 'account', name: 'Аккаунт и вход' },
  { id: 'security', name: 'Безопасность' },
  { id: 'sessions', name: 'Устройства и сессии' },
  { id: 'notif', name: 'Уведомления' },
  { id: 'notifChannels', name: 'Каналы уведомлений' },
  { id: 'notifChannel', name: 'Канал: Сообщения', ctx: { k: 'msg' } },
  { id: 'privacy', name: 'Приватность' },
  { id: 'blocked', name: 'Чёрный список' },
  { id: 'data', name: 'Данные и память' },
  { id: 'export', name: 'Экспорт своих данных' },
  { id: 'theme', name: 'Внешний вид' },
  { id: 'a11y', name: 'Доступность' },
  { id: 'lang', name: 'Язык и формат' },
  { id: 'help', name: 'Помощь и обратная связь' },
  { id: 'about', name: 'О приложении' },
  { id: 'legal', name: 'Юридические документы' },
  { id: 'danger', name: 'Удаление аккаунта' },
];

/* ---- init-скрипт: пропуск авторизации + эмуляция Telegram ---- */
function initScript(tg, width, height) {
  return `
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
    ${tg ? `
    (function(){
      var handlers = {};
      window.Telegram = { WebApp: {
        initData: 'query_id=OKOPROBE&user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
        initDataUnsafe: { user: { id: 1, first_name: 'Даниэль', username: 'ktodaniel' } },
        version: '8.0', platform: 'android', colorScheme: 'dark',
        isExpanded: true, isFullscreen: false,
        viewportHeight: ${height - TG_HEADER}, viewportStableHeight: ${height - TG_HEADER},
        safeAreaInset: { top: 0, bottom: ${TG_BOTTOM}, left: 0, right: 0 },
        contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        themeParams: {},
        ready(){}, expand(){}, close(){},
        requestFullscreen(){ window.__okoFullscreenRequested = true; },
        exitFullscreen(){}, disableVerticalSwipes(){}, enableVerticalSwipes(){},
        lockOrientation(){}, unlockOrientation(){},
        setHeaderColor(){}, setBackgroundColor(){}, setBottomBarColor(){},
        onEvent(n,f){ (handlers[n]=handlers[n]||[]).push(f); }, offEvent(){},
        HapticFeedback:{impactOccurred(){},notificationOccurred(){},selectionChanged(){}},
        BackButton:{isVisible:false,show(){this.isVisible=true;},hide(){this.isVisible=false;},onClick(){},offClick(){}},
        MainButton:{show(){},hide(){},setText(){},onClick(){}},
        CloudStorage:{getItem(k,cb){cb&&cb(null,null);},setItem(k,v,cb){cb&&cb(null,true);}},
      }};
    })();` : ''}
  `;
}

/* ---- Детектор дефектов вёрстки внутри #st2View ---- */
const PROBE = `(() => {
  const out = { overflowX:0, offRight:[], clipped:[], midWordBreak:[], underTop:[], underBottom:[],
                back:null, empty:true, title:'', h:0 };
  const VW = window.innerWidth, VH = window.innerHeight;
  const BOT = ${TG_BOTTOM};
  const tg = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);
  const de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);

  const view = document.getElementById('st2View');
  if(!view || !view.classList.contains('open')){ out.notOpen = true; return out; }

  const label = el => {
    const id = el.id ? '#'+el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.'+el.className.trim().split(/\\s+/).slice(0,3).join('.') : '';
    return el.tagName.toLowerCase()+id+cls;
  };
  const visible = el => {
    const cs = getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||cs.opacity==='0') return false;
    const r = el.getBoundingClientRect();
    if(r.width<=0||r.height<=0) return false;
    if(r.left>=VW-1||r.right<=1) return false;
    return true;
  };

  /* кнопка «назад»: есть, видима, кликабельна */
  const back = document.getElementById('st2Back');
  if(back){
    const r = back.getBoundingClientRect();
    const cs = getComputedStyle(back);
    out.back = { present:true, visible: r.width>8 && r.height>8 && cs.display!=='none' && cs.visibility!=='hidden',
                 top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) };
  } else out.back = { present:false, visible:false };

  const t = document.getElementById('st2Title');
  out.title = t ? (t.textContent||'').trim() : '';

  const body = document.getElementById('st2Body');
  const activePanel = body ? (body.querySelector('.st2-panel:last-child') || body.firstElementChild) : null;
  const text = activePanel ? (activePanel.innerText||'').trim() : '';
  out.empty = text.length < 20;
  out.h = activePanel ? activePanel.scrollHeight : 0;

  const scope = activePanel || view;
  const all = Array.from(scope.querySelectorAll('*')).slice(0, 3000);
  for(const el of all){
    if(el.ownerSVGElement) continue;
    if(!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    let inScroller = false;
    for(let p = el.parentElement, d = 0; p && d < 6; p = p.parentElement, d++){
      const pcs = getComputedStyle(p);
      if(pcs.overflowX==='auto'||pcs.overflowX==='scroll'){ inScroller = true; break; }
    }
    if(!inScroller && r.right > VW + 1 && r.width < VW*1.6)
      out.offRight.push({ el: label(el), right: Math.round(r.right), vw: VW });

    const txt = (el.textContent||'').trim();
    if(txt && el.children.length === 0){
      const intentional = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if(!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible')
        out.clipped.push({ el: label(el), text: txt.slice(0,48), sw: el.scrollWidth, cw: el.clientWidth });
      /* перенос посреди слова: break-all у обычного текста */
      if(cs.wordBreak === 'break-all' && !el.closest('.oko-breakable') && /[А-Яа-яA-Za-z]{4,}/.test(txt))
        out.midWordBreak.push({ el: label(el), text: txt.slice(0,40), wordBreak: cs.wordBreak });
    }
    if(cs.position==='fixed'||cs.position==='sticky'){
      if(r.top < -1 && r.bottom > 2) out.underTop.push({ el: label(el), top: Math.round(r.top) });
      const fullBleed = r.top <= 1 && r.bottom >= VH - 1;
      if(tg && !fullBleed && r.bottom > VH - BOT + 1 && r.top < VH - 2 &&
         cs.zIndex !== 'auto' && +cs.zIndex > 40)
        out.underBottom.push({ el: label(el), bottom: Math.round(r.bottom) });
    }
  }

  /* шапка не должна уезжать выше нуля */
  const head = view.querySelector('.sv-head');
  if(head){
    const hr = head.getBoundingClientRect();
    out.headTop = Math.round(hr.top);
    if(hr.top < -1) out.underTop.push({ el:'.sv-head', top: Math.round(hr.top) });
  }

  const dedupe = a => { const s = new Set(); return a.filter(x => { const k = JSON.stringify(x); if(s.has(k)) return false; s.add(k); return true; }); };
  out.offRight = dedupe(out.offRight).slice(0,10);
  out.clipped = dedupe(out.clipped).slice(0,10);
  out.midWordBreak = dedupe(out.midWordBreak).slice(0,10);
  out.underTop = dedupe(out.underTop).slice(0,10);
  out.underBottom = dedupe(out.underBottom).slice(0,10);
  return out;
})()`;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.error('[probe]', ...a);

/* Загрузка страницы: сначала ждём commit, потом DOM. Машина бывает занята
   параллельными прогонами других агентов — таймауты держим щедрыми. */
async function launch() {
  return chromium.launch({
    executablePath: process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
  });
}

/* Каждый прогон — своя копия браузера: после нескольких контекстов подряд
   Chromium в этой среде перестаёт догружать 5-мегабайтный бандл. */
async function openApp(opts) {
  var lastErr = null;
  for (var attempt = 1; attempt <= 3; attempt++) {
    var browser = null;
    try {
      browser = await launch();
      const ctx = await browser.newContext({
        viewport: { width: opts.width, height: opts.height },
        isMobile: !!opts.mobile,
        hasTouch: !!opts.mobile,
        colorScheme: opts.theme || 'dark',
        locale: 'ru-RU',
      });
      const page = await ctx.newPage();
      page.setDefaultTimeout(45000);
      page.setDefaultNavigationTimeout(90000);
      const errors = [];
      page.on('pageerror', e => errors.push(String((e && e.message) || e)));
      await page.addInitScript(initScript(!!opts.tg, opts.width, opts.height));
      await page.goto(BASE, { waitUntil: 'commit', timeout: 90000 });
      await page.waitForFunction(
        () => typeof window.st2Open === 'function' && !!window.OKO_SETTINGS2,
        null, { timeout: 60000 });
      await sleep(700);
      await page.evaluate(() => { try { okoSkipAuth(); showTab('profile'); } catch (e) { } });
      /* Слой роста (oko-growth) показывает промо-окна поверх интерфейса и
         перехватывает клики. Для замеров настроек их гасим — это не правка
         продукта, а условие чистого прогона. */
      await page.addStyleTag({ content: '.okg-scrim,[data-okg="modal"],#onb2Intro,.onb2-scrim{display:none!important}' });
      await sleep(300);
      return { browser, ctx, page, errors };
    } catch (e) {
      lastErr = e;
      log('повтор загрузки (' + attempt + '):', String(e.message || e).slice(0, 90));
      try { if (browser) await browser.close(); } catch (e2) { }
      await sleep(1200);
    }
  }
  throw lastErr;
}

async function openPanel(page, id, ctx) {
  await page.evaluate(([pid, pctx]) => {
    if (typeof st2Open !== 'function') return;
    st2Open();
    if (pid !== 'root') st2Push(pid, pctx || {});
  }, [id, ctx || null]);
  await sleep(420);
  /* Панель приезжает анимацией: под нагрузкой rAF плывёт, и замер мог поймать
     ещё сдвинутый слой. Ждём, пока останется один экран и он встанет на место. */
  await page.waitForFunction(() => {
    const view = document.getElementById('st2View');
    if (!view || !view.classList.contains('open')) return false;
    /* сама вьюха выезжает справа за 0.3s — ждём, пока встанет в кадр */
    const vr = view.getBoundingClientRect();
    if (vr.right > window.innerWidth + 2) return false;
    const body = document.getElementById('st2Body');
    if (!body) return false;
    const list = body.querySelectorAll('.st2-panel');
    if (list.length !== 1) return false;
    const r = list[0].getBoundingClientRect(), h = body.getBoundingClientRect();
    return Math.abs(r.left - h.left) < 2;
  }, null, { timeout: 15000 }).catch(() => { });
  await sleep(120);
}

async function main() {
  const report = {
    round: ROUND, at: new Date().toISOString(), base: BASE,
    viewports: [], toggles: null, secrets: null, shots: [],
    issues: { overflowX: 0, offRight: 0, clipped: 0, midWordBreak: 0, underTop: 0, underBottom: 0, noBack: 0, empty: 0 },
    problems: [],
  };

  const push = (where, kind, detail) => {
    report.issues[kind] = (report.issues[kind] || 0) + 1;
    report.problems.push({ where, kind, detail });
  };

  /* ============ 1. ОБХОД ВСЕХ ПАНЕЛЕЙ ВО ВСЕХ ВЬЮПОРТАХ И ТЕМАХ ============ */
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      log('вьюпорт', vp.id, theme);
      /* Телефонные прогоны идут в режиме Telegram Mini App. */
      const boot = await openApp({ ...vp, theme, tg: vp.mobile });
      const page = boot.page, errors = boot.errors;
      await page.evaluate(t => {
        try { if (typeof st2SetTheme === 'function') st2SetTheme(t); } catch (e) { }
        document.documentElement.dataset.theme = t;
      }, theme);
      await sleep(400);

      const layerOk = await page.evaluate(() => !!window.OKO_SETTINGS2);
      const vpRes = { id: vp.id, label: vp.label, theme, layerLoaded: layerOk, panels: [], pageErrors: [] };

      for (const p of PANELS) {
        const where = `${vp.id}/${theme}/${p.id}`;
        let res;
        try {
          await openPanel(page, p.id, p.ctx);
          res = await page.evaluate(PROBE);
        } catch (e) {
          /* Один сорвавшийся экран не должен рушить весь обход. */
          push(where, 'probeError', String((e && e.message) || e).slice(0, 160));
          continue;
        }

        if (res.notOpen) push(where, 'empty', 'раздел настроек не открылся');
        if (res.overflowX > 1) push(where, 'overflowX', `${res.overflowX}px`);
        res.offRight.forEach(x => push(where, 'offRight', x));
        res.clipped.forEach(x => push(where, 'clipped', x));
        res.midWordBreak.forEach(x => push(where, 'midWordBreak', x));
        res.underTop.forEach(x => push(where, 'underTop', x));
        res.underBottom.forEach(x => push(where, 'underBottom', x));
        if (!res.back || !res.back.present || !res.back.visible) push(where, 'noBack', res.back);
        if (res.empty) push(where, 'empty', res.title);

        vpRes.panels.push({
          id: p.id, name: p.name, title: res.title, height: res.h,
          overflowX: res.overflowX, offRight: res.offRight.length, clipped: res.clipped.length,
          midWordBreak: res.midWordBreak.length, underTop: res.underTop.length,
          underBottom: res.underBottom.length, back: !!(res.back && res.back.visible), empty: res.empty,
        });

        /* Скрины: телефон в тёмной + ПК в светлой — по одному на панель.
           Машину делят параллельные прогоны, поэтому снимок не фатален. */
        const shoot = !NOSHOTS && ((vp.id === 'phone' && theme === 'dark') || (vp.id === 'desk' && theme === 'light'));
        if (shoot) {
          const file = `settings2-${vp.id}-${theme}-${p.id}.png`;
          try {
            await page.screenshot({ path: path.join(OUT, file), timeout: 90000 });
            report.shots.push(file);
          } catch (e) { log('скрин не снялся:', file); }
        }
      }
      vpRes.pageErrors = errors.slice(0, 10);
      if (errors.length) report.problems.push({ where: `${vp.id}/${theme}`, kind: 'pageError', detail: errors.slice(0, 5) });
      report.viewports.push(vpRes);
      await boot.browser.close();
    }
  }

  /* ============ 2. КАЖДЫЙ ТУМБЛЕР: ВКЛ → ВЫКЛ, СОСТОЯНИЕ ВИДНО ============ */
  try {
    log('тумблеры');
    const boot = await openApp({ width: 390, height: 844, mobile: true, tg: true, theme: 'dark' });
    const page = boot.page, errors = boot.errors;

    const togglePanels = ['security', 'privacy', 'notif', 'notifChannel', 'data', 'theme', 'a11y', 'lang'];
    const tog = { checked: 0, flipped: 0, restored: 0, broken: [] };

    for (const pid of togglePanels) {
      try { await openPanel(page, pid, pid === 'notifChannel' ? { k: 'msg' } : null); }
      catch (e) { push('toggles/' + pid, 'probeError', String((e && e.message) || e).slice(0, 160)); continue; }
      const n = await page.evaluate(() => {
        const panel = document.querySelector('#st2Body .st2-panel:last-child');
        return panel ? panel.querySelectorAll('.switch').length : 0;
      });
      for (let i = 0; i < n; i++) {
        const r = await page.evaluate(async (idx) => {
          const panel = document.querySelector('#st2Body .st2-panel:last-child');
          const sws = panel ? panel.querySelectorAll('.switch') : [];
          const sw = sws[idx];
          if (!sw) return { skip: true };
          const before = sw.classList.contains('on');
          const clickTarget = sw.closest('button.prow') || sw;
          clickTarget.click();
          await new Promise(r => setTimeout(r, 260));
          const panel2 = document.querySelector('#st2Body .st2-panel:last-child');
          const sws2 = panel2 ? panel2.querySelectorAll('.switch') : [];
          const sw2 = sws2[idx];
          const mid = sw2 ? sw2.classList.contains('on') : null;
          /* закрываем возможный попап подтверждения — состояние читаем как есть */
          const pop = document.getElementById('okoPopup');
          const hadPopup = !!pop;
          if (pop) { const g = pop.querySelector('[data-pa="0"]'); if (g) g.click(); else if (typeof closePopup === 'function') closePopup(); }
          await new Promise(r => setTimeout(r, 200));
          return { before, mid, hadPopup };
        }, i);
        if (r.skip) continue;
        tog.checked++;
        if (r.mid !== null && r.mid !== r.before) tog.flipped++;
        /* возвращаем обратно */
        const back = await page.evaluate(async (idx) => {
          const panel = document.querySelector('#st2Body .st2-panel:last-child');
          const sws = panel ? panel.querySelectorAll('.switch') : [];
          const sw = sws[idx];
          if (!sw) return null;
          const cur = sw.classList.contains('on');
          const clickTarget = sw.closest('button.prow') || sw;
          clickTarget.click();
          await new Promise(r => setTimeout(r, 260));
          const pop = document.getElementById('okoPopup');
          if (pop) { const g = pop.querySelector('[data-pa="0"]'); if (g) g.click(); else if (typeof closePopup === 'function') closePopup(); }
          await new Promise(r => setTimeout(r, 200));
          const panel2 = document.querySelector('#st2Body .st2-panel:last-child');
          const sws2 = panel2 ? panel2.querySelectorAll('.switch') : [];
          const sw2 = sws2[idx];
          return sw2 ? sw2.classList.contains('on') : null;
        }, i);
        if (back !== null) tog.restored++;
      }
    }
    tog.pageErrors = errors.slice(0, 10);
    if (errors.length) report.problems.push({ where: 'toggles', kind: 'pageError', detail: errors.slice(0, 5) });
    report.toggles = tog;
    await boot.browser.close();
  } catch (e) { push('toggles', 'probeError', String((e && e.message) || e).slice(0, 200)); }

  /* ============ 3. СЕКРЕТЫ: ПАРОЛЬ И PIN НЕ ПОПАДАЮТ В DOM/localStorage ==== */
  try {
    log('секреты');
    const boot = await openApp({ width: 390, height: 844, mobile: true, tg: true, theme: 'dark' });
    const page = boot.page, errors = boot.errors;

    const sec = { steps: [], leaks: [], pinInStorage: null, storedKeys: [] };

    const scan = async (stage) => {
      const r = await page.evaluate(([pw, pwNew, pin]) => {
        const dom = document.documentElement.outerHTML;
        let ls = '';
        const keys = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            keys.push(k);
            ls += k + '=' + (localStorage.getItem(k) || '') + '\n';
          }
        } catch (e) { }
        let secObj = null;
        try { secObj = JSON.parse(localStorage.getItem('oko-settings2') || '{}').sec || null; } catch (e) { }
        return {
          domPw: dom.indexOf(pw) > -1, domPwNew: dom.indexOf(pwNew) > -1,
          lsPw: ls.indexOf(pw) > -1, lsPwNew: ls.indexOf(pwNew) > -1,
          secObj, keys: keys.slice(0, 40),
          liveSec: (typeof ST2 !== 'undefined' && ST2.sec) ? JSON.parse(JSON.stringify(ST2.sec)) : null,
        };
      }, [PROBE_PW, PROBE_PW_NEW, PROBE_PIN]);
      sec.steps.push({ stage, ...r });
      if (r.domPw || r.domPwNew) sec.leaks.push({ stage, where: 'DOM' });
      if (r.lsPw || r.lsPwNew) sec.leaks.push({ stage, where: 'localStorage' });
      return r;
    };

    /* --- 3.1 форма смены пароля --- */
    await openPanel(page, 'security');
    await page.evaluate(() => st2ChangePass());
    await sleep(350);
    await page.fill('#s2PwCur', PROBE_PW);
    await page.fill('#s2PwNew', PROBE_PW_NEW);
    await page.fill('#s2PwRep', PROBE_PW_NEW);
    await sleep(200);
    if (!NOSHOTS) { await page.screenshot({ path: path.join(OUT, 'settings2-secrets-01-password-form.png') }); report.shots.push('settings2-secrets-01-password-form.png'); }
    await scan('password-typed');
    await page.click('#s2PwSave');
    await sleep(400);
    const honest = await page.evaluate(() => {
      const p = document.getElementById('okoPopup');
      return p ? (p.innerText || '').trim().slice(0, 260) : '';
    });
    sec.honestPasswordResult = honest;
    if (!NOSHOTS) { await page.screenshot({ path: path.join(OUT, 'settings2-secrets-02-password-honest.png') }); report.shots.push('settings2-secrets-02-password-honest.png'); }
    await scan('password-submitted');
    await page.evaluate(() => { if (typeof closePopup === 'function') closePopup(); });
    await sleep(250);
    await scan('password-closed');

    /* --- 3.2 код-пароль (PIN) --- */
    await openPanel(page, 'security');
    await page.evaluate(() => st2Passcode());
    await sleep(320);
    await page.fill('#st2PopInp', PROBE_PIN);
    await page.click('#okoPopup [data-pa="1"]');
    await sleep(320);
    await page.fill('#st2PopInp', PROBE_PIN);
    await page.click('#okoPopup [data-pa="1"]');
    await sleep(600);
    const pinState = await page.evaluate((pin) => {
      let raw = '';
      try { raw = localStorage.getItem('oko-settings2') || ''; } catch (e) { }
      let sec = null;
      try { sec = JSON.parse(raw).sec || null; } catch (e) { }
      const hasPinField = !!(sec && Object.prototype.hasOwnProperty.call(sec, 'pin'));
      const values = sec ? Object.keys(sec).map(k => String(sec[k])) : [];
      return {
        passcode: !!(sec && sec.passcode),
        hasPinField,
        pinValueStored: values.indexOf(pin) > -1,
        hasHash: !!(sec && sec.pinHash), hasSalt: !!(sec && sec.pinSalt),
        secKeys: sec ? Object.keys(sec) : [],
        domHasPin: document.documentElement.outerHTML.indexOf('"pin"') > -1,
      };
    }, PROBE_PIN);
    sec.pinInStorage = pinState;
    if (pinState.hasPinField || pinState.pinValueStored) sec.leaks.push({ stage: 'pin', where: 'localStorage' });
    if (!NOSHOTS) { await page.screenshot({ path: path.join(OUT, 'settings2-secrets-03-passcode-on.png') }); report.shots.push('settings2-secrets-03-passcode-on.png'); }

    /* выключаем обратно, чтобы не оставлять состояние */
    await page.evaluate(() => st2Passcode());
    await sleep(250);
    await page.evaluate(() => { const b = document.querySelector('#okoPopup [data-pa="1"]'); if (b) b.click(); });
    await sleep(350);

    /* --- 3.3 секрет 2FA не персистится --- */
    await openPanel(page, 'security');
    const twofaBefore = await page.evaluate(() => !!(typeof ST2 !== 'undefined' && ST2.sec.twofa));
    if (twofaBefore) {
      /* выключим, чтобы пройти сценарий включения с показом ключа */
      await page.evaluate(() => st2TwoFA());
      await sleep(250);
      await page.evaluate(() => { const b = document.querySelector('#okoPopup [data-pa="1"]'); if (b) b.click(); });
      await sleep(400);
    }
    await page.evaluate(() => st2TwoFA());
    await sleep(320);
    const shownKey = await page.evaluate(() => {
      const el = document.querySelector('#okoPopup .st2-2fa-key');
      return el ? el.textContent.trim() : '';
    });
    if (!NOSHOTS) { await page.screenshot({ path: path.join(OUT, 'settings2-secrets-04-2fa-key.png') }); report.shots.push('settings2-secrets-04-2fa-key.png'); }
    await page.evaluate(() => { const b = document.querySelector('#okoPopup [data-pa="1"]'); if (b) b.click(); });
    await sleep(300);
    await page.fill('#st2PopInp', '123456');
    await page.click('#okoPopup [data-pa="1"]');
    await sleep(500);
    const secretPersisted = await page.evaluate((k) => {
      let raw = '';
      try { raw = localStorage.getItem('oko-settings2') || ''; } catch (e) { }
      let s = null;
      try { s = JSON.parse(raw).sec || null; } catch (e) { }
      return {
        hasSecretField: !!(s && Object.prototype.hasOwnProperty.call(s, 'secret')),
        keyInStorage: k ? raw.indexOf(k) > -1 : false,
        keyInDom: k ? document.documentElement.outerHTML.indexOf(k) > -1 : false,
        twofa: !!(s && s.twofa),
      };
    }, shownKey);
    sec.twofaSecret = { shownKeyLen: shownKey.length, ...secretPersisted };
    if (secretPersisted.hasSecretField || secretPersisted.keyInStorage) sec.leaks.push({ stage: '2fa', where: 'localStorage' });

    /* --- 3.4 финальный дамп ключей localStorage --- */
    sec.storedKeys = await page.evaluate(() => {
      const out = [];
      try { for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); } catch (e) { }
      return out;
    });
    sec.settingsDump = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('oko-settings2') || '{}').sec || null; } catch (e) { return null; }
    });
    sec.pageErrors = errors.slice(0, 10);
    if (errors.length) report.problems.push({ where: 'secrets', kind: 'pageError', detail: errors.slice(0, 5) });
    report.secrets = sec;
    if (sec.leaks.length) push('secrets', 'secretLeak', sec.leaks);
    await boot.browser.close();
  } catch (e) { push('secrets', 'probeError', String((e && e.message) || e).slice(0, 200)); }

  /* ============ 4. КНОПКА «НАЗАД» РЕАЛЬНО ВОЗВРАЩАЕТ ============ */
  try {
    log('кнопка «назад»');
    const boot = await openApp({ width: 390, height: 844, mobile: true, tg: true, theme: 'dark' });
    const page = boot.page;
    const nav = [];
    for (const p of PANELS.filter(x => x.id !== 'root')) {
      await openPanel(page, p.id, p.ctx);
      await page.click('#st2Back');
      await sleep(420);
      const state = await page.evaluate(() => ({
        title: (document.getElementById('st2Title') || {}).textContent || '',
        open: !!document.querySelector('#st2View.open'),
        stack: (typeof ST2_STACK !== 'undefined') ? ST2_STACK.length : -1,
      }));
      const ok = state.open && state.stack === 1;
      nav.push({ panel: p.id, backToRoot: ok, ...state });
      if (!ok) push(`back/${p.id}`, 'noBack', state);
    }
    report.backNav = nav;
    await boot.browser.close();
  } catch (e) { push('back', 'probeError', String((e && e.message) || e).slice(0, 200)); }

  report.totalProblems = report.problems.length;
  report.ok = report.totalProblems === 0;
  const file = path.join(OUT, `settings2-report-round-${ROUND}.json`);
  await fs.writeFile(file, JSON.stringify(report, null, 2), 'utf8');

  /* Короткая сводка в консоль. */
  const brief = {
    round: report.round, ok: report.ok, totalProblems: report.totalProblems,
    issues: report.issues,
    toggles: report.toggles,
    secretsLeaks: report.secrets ? report.secrets.leaks.length : null,
    shots: report.shots.length,
  };
  console.log(JSON.stringify(brief, null, 2));
  if (report.problems.length) {
    console.log('\n--- ПРОБЛЕМЫ (первые 40) ---');
    console.log(JSON.stringify(report.problems.slice(0, 40), null, 2));
  }
  console.log('\nОтчёт: ' + file);
  /* Сорвавшаяся секция могла оставить открытый браузер — не держим процесс. */
  process.exit(report.ok ? 0 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
