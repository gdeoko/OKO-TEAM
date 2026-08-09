/* ============================================================================
   probe-channels2.mjs — пробник раздела «Каналы» (слой oko-channels2.js).

   Обходит все состояния раздела в трёх вьюпортах (390x844, 360x740, 1440x900)
   и на каждом шаге проверяет:
     • нет горизонтального переполнения страницы;
     • нет текста, обрезанного БЕЗ многоточия;
     • нет переносов посреди слова (ширину слова меряем по
       Math.max(clientWidth, rect.width) — у строчных элементов clientWidth = 0);
     • из экрана есть выход (кнопка «назад» видима и кликабельна);
     • ничего не заезжает под шапку Telegram и под нижнее меню;
     • нет NaN / undefined / Infinity / [object Object] в тексте;
     • нет выдуманных данных (звёзды рейтинга, «N отзывов», «охват/нед»,
       «вовлечённость», проценты источников трафика);
     • нет ошибок JS и необработанных промисов.

   Замеры делаются ПОСЛЕ окончания анимаций (document.getAnimations() пуст),
   иначе ловится промежуточная геометрия.

   Запуск:  node oko-app/tools/probe-channels2.mjs [--url http://127.0.0.1:8199]
   Отчёт:   oko-app/tools/probe-channels2.json (+ скриншоты при --shots)
   ============================================================================ */

import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_JSON = path.join(HERE, 'probe-channels2.json');
const OUT_SHOTS = path.join(HERE, 'channels2-shots');

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf('--' + k);
  return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : d;
};
const URL_BASE = String(arg('url', 'http://127.0.0.1:8199'));
/* --only 01-list,41-follow,… — прогнать лишь часть сценария на свежей странице.
   Нужно, когда длинный обход упирается в лимиты окружения, а проверить надо
   конкретные состояния. */
const ONLY = arg('only', null);
const SHOTS = !!arg('shots', false);
const CHROME = process.env.OKO_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

/* Telegram-режим: шапка над вебвью и полоса домашнего индикатора снизу */
const TG_HEADER = 56;
const TG_BOTTOM = 34;

const MODES = [
  { id: 'phone',   name: 'Телефон 390x844',   width: 390,  height: 844, telegram: true  },
  { id: 'narrow',  name: 'Узкий Android 360', width: 360,  height: 740, telegram: true  },
  { id: 'desktop', name: 'ПК 1440x900',       width: 1440, height: 900, telegram: false }
];

/* --------------------------------------------------------------- init-скрипт */
function initScript(mode) {
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
      /* чистый старт раздела: ноль каналов, оставшихся от прошлых прогонов.
         Скрипт выполняется ДО скриптов страницы, поэтому ядро пересоберёт
         каталог с нуля — второй загрузки страницы не требуется. */
      localStorage.removeItem('oko-channels');
    }catch(e){}
    ${mode.telegram ? `
    (function(){
      window.Telegram = { WebApp: {
        initData: 'query_id=OKOPROBE&user=%7B%22id%22%3A1%7D&auth_date=1&hash=x',
        initDataUnsafe: { user: { id: 1, first_name: 'Даниэль', last_name: 'Ильясов', username: 'ktodaniel' } },
        version: '8.0', platform: 'android', colorScheme: 'dark',
        isExpanded: true, isFullscreen: false,
        viewportHeight: ${mode.height - TG_HEADER}, viewportStableHeight: ${mode.height - TG_HEADER},
        safeAreaInset: { top: 0, bottom: ${TG_BOTTOM}, left: 0, right: 0 },
        contentSafeAreaInset: { top: 0, bottom: 0, left: 0, right: 0 },
        themeParams: {},
        ready(){}, expand(){}, close(){},
        requestFullscreen(){ window.__okoFullscreenRequested = true; },
        exitFullscreen(){},
        onEvent(){}, offEvent(){},
        setHeaderColor(){}, setBackgroundColor(){}, enableClosingConfirmation(){},
        disableVerticalSwipes(){}, enableVerticalSwipes(){},
        HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
        BackButton: { show(){}, hide(){}, onClick(){}, offClick(){} },
        MainButton: { show(){}, hide(){}, setText(){}, onClick(){}, offClick(){}, setParams(){} },
        CloudStorage: { getItem(k,cb){ cb&&cb(null,null); }, setItem(k,v,cb){ cb&&cb(null,true); } },
        openLink(){}, openTelegramLink(){}, shareURL(){}, showPopup(){}, showAlert(){}
      }};
    })();` : ''}
  `;
}

/* -------------------------------------------------------- детектор в странице */
const DETECT = `(() => {
  const out = {
    overflowX: 0, offRight: [], clipped: [], midWordBreak: [],
    underTop: [], underBottom: [], badNumbers: [], fakeData: [],
    hasExit: false, emptyBody: false, title: '', bodyText: ''
  };
  const VW = window.innerWidth, VH = window.innerHeight;
  const TOP = ${TG_HEADER}, BOT = ${TG_BOTTOM};
  const tg = !!(window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData);

  const de = document.documentElement;
  out.overflowX = Math.max(0, de.scrollWidth - de.clientWidth);

  const label = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  const visible = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    if (r.left >= VW - 1 || r.right <= 1) return false;
    if (r.top >= VH - 1 || r.bottom <= 1) return false;
    return true;
  };

  /* Раздел закрыт (шаг «выход») — проверять его внутренности бессмысленно:
     панель уехала за правый край и намеренно недоступна. */
  const view = document.getElementById('chView');
  out.viewOpen = !!(view && view.classList.contains('open'));

  /* ---- выход из экрана: кнопка «назад» в шапке раздела ---- */
  const back = document.querySelector('#chView .ch-back');
  if (back && out.viewOpen) {
    const r = back.getBoundingClientRect();
    out.hasExit = r.width > 20 && r.height > 20 && r.top >= -1 && r.left >= -1 && r.right <= VW + 1;
    out.exitBox = { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) };
  } else if (!out.viewOpen) {
    out.hasExit = true;   /* раздел закрыт — выход уже состоялся */
  }

  const chBody = document.getElementById('chBody');
  const titleEl = document.getElementById('chHeadTitle');
  out.title = titleEl ? (titleEl.textContent || '').trim() : '';
  if (chBody && out.viewOpen) {
    const t = (chBody.innerText || '').trim();
    out.bodyText = t.slice(0, 200);
    out.emptyBody = t.length < 12;
  }

  /* ---- сканируем внутренности раздела «Каналы» + открытый попап ---- */
  const roots = out.viewOpen ? [view] : [];

  const popEl = document.getElementById('okoPopup');
  if (popEl) roots.push(popEl);
  out.popup = popEl ? (popEl.querySelector('h3') || {}).textContent || '' : null;

  const seen = new Set();
  const all = [];
  for (const root of roots) for (const el of root.querySelectorAll('*')) {
    if (all.length > 4000) break;
    if (seen.has(el)) continue; seen.add(el); all.push(el);
  }

  for (const el of all) {
    if (el.ownerSVGElement) continue;
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);

    /* ряды чипов ездят внутри себя — выход за край для них штатный */
    let inScroller = false;
    for (let p = el.parentElement, d = 0; p && d < 6; p = p.parentElement, d++) {
      const pcs = getComputedStyle(p);
      if (pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') { inScroller = true; break; }
    }

    if (!inScroller && r.right > VW + 1 && r.width < VW * 1.6)
      out.offRight.push({ el: label(el), right: Math.round(r.right), vw: VW });

    const txt = (el.textContent || '').trim();
    if (txt && el.children.length === 0) {
      /* многоточие/клэмп — осознанное сокращение, не дефект */
      const intentional = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if (!intentional && el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible')
        out.clipped.push({ el: label(el), text: txt.slice(0, 48), sw: el.scrollWidth, cw: el.clientWidth });

      /* ПЕРЕНОС ПОСРЕДИ СЛОВА.
         У строчных элементов clientWidth всегда 0 — меряем по
         Math.max(clientWidth, rect.width), иначе получим сотни ложных. */
      const boxW = Math.max(el.clientWidth, r.width);
      const words = txt.split(/\\s+/).filter(w => w.length >= 6 && /^[А-Яа-яЁёA-Za-z-]+$/.test(w));
      const breakAll = cs.wordBreak === 'break-all' || cs.overflowWrap === 'break-word' && cs.wordBreak === 'break-all';
      if (breakAll && words.length && boxW > 0 && !el.closest('.oko-breakable, .cx2-brk')) {
        out.midWordBreak.push({ el: label(el), text: txt.slice(0, 40), boxW: Math.round(boxW), reason: 'word-break:break-all' });
      }
      /* слово физически не влезает в свою строку и элемент многострочный */
      if (!breakAll && boxW > 0 && words.length) {
        const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4 || 16;
        const lines = Math.round(r.height / lh);
        if (lines > 1 && cs.hyphens === 'none' && el.scrollWidth > boxW + 2 && longest.length > 12)
          out.midWordBreak.push({ el: label(el), text: longest, boxW: Math.round(boxW), reason: 'слово не влезает' });
      }

      /* NaN / undefined / Infinity / [object Object] в отрисованных числах */
      if (/\\b(NaN|undefined|null|Infinity|-Infinity)\\b|\\[object Object\\]/.test(txt))
        out.badNumbers.push({ el: label(el), text: txt.slice(0, 60) });
    }

    if (cs.position === 'fixed' || cs.position === 'sticky') {
      if (r.top < -1 && r.bottom > 2) out.underTop.push({ el: label(el), top: Math.round(r.top) });
      const fullBleed = r.top <= 1 && r.bottom >= VH - 1;
      if (tg && !fullBleed && r.bottom > VH - BOT + 1 && r.top < VH - 2 &&
          cs.zIndex !== 'auto' && +cs.zIndex > 40)
        out.underBottom.push({ el: label(el), bottom: Math.round(r.bottom) });
    }
  }

  /* ---- маркеры выдуманных данных ---- */
  const scope = document.getElementById('chView');
  if (scope && scope.classList.contains('open')) {
    const text = (scope.innerText || '');
    /* Ищем ЗНАЧЕНИЯ без источника данных, а не сами слова: честный текст
       «вовлечённость появится с бэкендом» — это норма, а «вовлечённость 4.0%»
       на пустом канале — выдумка. */
    const FAKE = [
      [/охват\\s*\\/\\s*нед/i,                          'охват за неделю без источника данных'],
      [/\\d[\\d.,]*\\s*%\\s*\\n?\\s*вовлечённость/i,       'вовлечённость в процентах без охвата'],
      [/прирост\\s*\\/\\s*нед/i,                        'прирост за неделю без истории'],
      [/\\+\\s*\\d+\\s*\\n?\\s*за неделю/i,               'прирост за неделю без истории'],
      [/из рекомендаций\\s*\\n?\\s*\\d+\\s*%/i,           'выдуманные источники подписчиков'],
      [/по ссылке\\s*\\n?\\s*\\d+\\s*%/i,                 'выдуманные источники подписчиков'],
      [/\\d+\\s*отзыв(ов|а)?\\s+(канала|клуба|курса)/i,  'выдуманное число отзывов'],
      [/пик:\\s*сб/i,                                   'выдуманный пик охвата'],
      [/учеников проходят курс прямо сейчас/i,          'выдуманные ученики'],
      [/жалоба отправлена/i,                            'ложное подтверждение отправки жалобы'],
      [/данные прототипа сгенерированы/i,               'признание в сгенерированных данных'],
      [/в этом уроке разбираем/i,                       'сочинённое описание урока']
    ];
    for (const [re, why] of FAKE) if (re.test(text)) out.fakeData.push(why);
    /* структурные остатки старого рендера */
    if (scope.querySelector('.ch-reviews, .ch-rv-bars')) out.fakeData.push('блок выдуманного рейтинга .ch-reviews');
    if (scope.querySelector('#chStatLine, #chStatBars, #chStatDonut, #chStatRev'))
      out.fakeData.push('графики статистики из генератора случайных чисел');
    if (scope.querySelector('.ch-kpi-t')) out.fakeData.push('KPI-плитки ядра со сгенерированными числами');
    if (scope.querySelector('.ch-students-now')) out.fakeData.push('строка «N учеников проходят курс»');
    /* эмодзи в интерфейсе раздела */
    const EMOJI = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}]/u;
    if (EMOJI.test(text)) out.fakeData.push('эмодзи в интерфейсе');
  }

  const dedupe = a => { const s = new Set(); return a.filter(x => { const k = JSON.stringify(x); if (s.has(k)) return false; s.add(k); return true; }); };
  out.offRight = dedupe(out.offRight).slice(0, 10);
  out.clipped = dedupe(out.clipped).slice(0, 10);
  out.midWordBreak = dedupe(out.midWordBreak).slice(0, 10);
  out.underTop = dedupe(out.underTop).slice(0, 10);
  out.underBottom = dedupe(out.underBottom).slice(0, 10);
  out.badNumbers = dedupe(out.badNumbers).slice(0, 10);
  out.fakeData = Array.from(new Set(out.fakeData));
  return out;
})()`;

/* ---------------------------------------------------------------- сценарий */
/* Каждый шаг: имя + код, который приводит раздел в нужное состояние. */
/* хелперы, доступные внутри страницы во всех шагах */
const HELPERS = `
  var POP = '#okoPopup';
  function popBtn(re){
    var el = document.querySelector(POP);
    if(!el) return null;
    var list = Array.prototype.slice.call(el.querySelectorAll('button'));
    for(var i=0;i<list.length;i++) if(re.test(list[i].textContent)) return list[i];
    return null;
  }
  function popClick(re){ var b = popBtn(re); if(b) b.click(); return !!b; }
  function popClose(){ if(typeof closePopup==='function') closePopup(); }
  function my(){ return chCore.CH.mine[0]; }
  /* сброс внутреннего стека страниц: как если бы человек закрыл раздел и зашёл
     заново. Заодно гасим попап, оставшийся от предыдущего шага. */
  /* прокрутить нужный элемент в кадр, чтобы его было видно на скриншоте */
  function see(sel){ var e=document.querySelector(sel); if(e) e.scrollIntoView({block:'center'}); }
  function reopen(page, arg){ popClose(); try{ chClose(); }catch(e){} chOpen(page, arg); }
`;

const STEPS = [
  { id: '01-list',      name: 'Список каналов',        code: `okoSkipAuth(); reopen('list');` },
  { id: '02-search',    name: 'Поиск по списку',       code: `cx2Filter('око');` },
  { id: '03-search-no', name: 'Поиск без результата',  code: `cx2Filter('щщщ-нет-такого');` },
  { id: '04-seg-mine',  name: 'Сегмент «Мои»',         code: `cx2ClearQ(); cx2Seg('mine');` },
  { id: '05-seg-subs',  name: 'Сегмент «Подписки»',    code: `cx2Seg('subs');` },
  { id: '06-seg-disc',  name: 'Сегмент «Рекомендуем»', code: `cx2Seg('disc');` },
  { id: '07-catalog',   name: 'Каталог',               code: `cx2Seg('all'); reopen('catalog');` },
  { id: '08-cat-search',name: 'Поиск в каталоге',      code: `cx2CatFilter('инсайд');` },
  { id: '09-cat-filter',name: 'Фильтр каталога',       code: `cx2CatClear(); cx2CatSet('kind','course');` },
  { id: '10-cat-empty', name: 'Каталог: пусто',        code: `cx2CatSet('price','500'); cx2CatSet('kind','club');` },

  { id: '11-create',    name: 'Мастер создания',       code: `cx2CatReset(); reopen('list'); chGo('create');` },
  { id: '12-nick-empty',name: 'Ник: пустой',           code: `var n=document.getElementById('chDName'); n.value='Мой тестовый канал'; chDraft.name=n.value; chSyncCreateBtn(); cx2NickInput(''); see('#cx2Nick');` },
  { id: '13-nick-taken',name: 'Ник занят',             code: `cx2NickInput(chCore.CH.disc[0].nick); see('#cx2Nick');` },
  { id: '14-nick-free', name: 'Ник свободен',          code: `cx2NickInput('moy_kanal'); see('#cx2Nick');` },
  { id: '15-created',   name: 'Канал создан',          code: `chCreateChannel();`, after: `popClose();` },

  { id: '16-my-channel',name: 'Свой канал',            code: `reopen('channel', my().id);` },
  { id: '17-compose',   name: 'Публикация поста',      code: `chGo('compose', my().id);` },
  { id: '18-published', name: 'Пост опубликован',      code: `chCompose.txt='Первый настоящий пост канала: проверяем вёрстку, переносы и сверхдлинноесловодляпроверкипереносов.'; chPublishPost(my().id);` },
  { id: '19-poll',      name: 'Пост-опрос',            code: `chGo('compose', my().id); chCompose.txt='Проверка опроса'; chCompKind('poll'); chCompose.poll='Да, применяю, Пока думаю'; chPublishPost(my().id);` },
  { id: '20-voted',     name: 'Голос в опросе',        code: `reopen('channel', my().id); var b=document.querySelector('.ch-poll-opt'); if(b) b.click();` },
  { id: '20a-like',     name: 'Реакция на пост',       code: `var b=document.querySelector('.ch-post-acts button[aria-label="Нравится"]'); if(b) b.click();` },
  { id: '20b-cmt-open', name: 'Комментарии открыты',   code: `var b=document.querySelector('.ch-post-acts button[aria-label="Комментарии"]'); if(b) b.click(); see('.ch-comments');` },
  { id: '20c-cmt-send', name: 'Комментарий отправлен', code: `var i=document.querySelector('.ch-cmt-input'); if(i){ i.value='Проверяем комментарии: текст подлиннее, чтобы поймать переносы и обрезание.'; chSendCmt(my().id, i.id.replace('chCmt_','')); } see('.ch-comments');` },
  { id: '20d-cmt-like', name: 'Лайк комментария',      code: `var b=document.querySelector('.ch-cmt-like'); if(b) b.click(); see('.ch-comments');` },
  { id: '20e-pin',      name: 'Пост закреплён',        code: `var b=document.querySelector('.ch-pin-btn'); if(b) b.click();` },
  { id: '20f-unpin',    name: 'Пост откреплён',        code: `var b=document.querySelector('.ch-pin-off'); if(b) b.click();` },

  { id: '21-manage',    name: 'Управление',            code: `reopen('channel', my().id); chGo('manage', my().id);` },
  { id: '22-mtype',     name: 'Тип и доступ',          code: `chGo('mType', my().id);` },
  { id: '23-mappear',   name: 'Оформление',            code: `chBack(); chGo('mAppear', my().id);` },
  { id: '23a-nick-busy',name: 'Оформление: ник занят', code: `var t=chCore.CH.disc[0].nick; var i=document.getElementById('chNickEdit'); i.value=t; chSetNick(my().id,t); see('#cx2AppNickMsg');` },
  { id: '23b-nick-ok',  name: 'Оформление: ник ок',    code: `var i=document.getElementById('chNickEdit'); i.value='moy_kanal2'; chSetNick(my().id,'moy_kanal2'); see('#cx2AppNickMsg');` },
  { id: '23c-site-bad', name: 'Оформление: битая ссылка', code: `cx2SetSite(my().id,'не ссылка'); see('#cx2Site');` },
  { id: '23d-site-ok',  name: 'Оформление: ссылка ок', code: `cx2SetSite(my().id,'https://okoteam.top'); see('#cx2Site');` },
  { id: '24-mstats',    name: 'Статистика',            code: `chBack(); chGo('mStats', my().id);` },
  { id: '25-msubs',     name: 'Подписчики',            code: `chBack(); chGo('mSubs', my().id);` },
  { id: '26-madmins',   name: 'Администраторы',        code: `chBack(); chGo('mAdmins', my().id);` },
  { id: '27-addadmin',  name: 'Назначить админа',      code: `chAddAdmin(my().id);`, after: `popClose();` },
  { id: '28-mblack',    name: 'Чёрный список',         code: `popClose(); chGo('mBlack', my().id);` },
  { id: '29-minvites',  name: 'Приглашения',           code: `chBack(); chGo('mInvites', my().id);` },
  { id: '30-invite-new',name: 'Создан инвайт',         code: `chNewInvite(my().id);` },
  { id: '31-paid',      name: 'Платный канал',         code: `chBack(); chGo('mType', my().id); chSetPaid(my().id, true);` },
  { id: '32-paid-stats',name: 'Статистика платного',   code: `chBack(); chGo('mStats', my().id);` },
  { id: '32a-course',   name: 'Канал → курс',          code: `chBack(); chGo('mType', my().id); chSetKind(my().id,'course');` },
  { id: '32b-nolessons',name: 'Курс без уроков',       code: `reopen('channel', my().id);` },
  { id: '32c-addles',   name: 'Добавить урок',         code: `chGo('addLesson', my().id); chLessonDraft.title='Хук за три секунды'; chAddLesson(my().id);` },
  { id: '32d-lesson',   name: 'Урок курса',            code: `var m=my(); reopen('channel', m.id); chGo('lesson',{c:m.id,l:(m.lessons||[])[0].id});` },
  { id: '32e-done',     name: 'Урок пройден',          code: `var m=my(); chToggleLesson(m.id,(m.lessons||[])[0].id);` },
  { id: '32f-back-ch',  name: 'Курс → канал',          code: `reopen('channel', my().id); chGo('mType', my().id); chSetKind(my().id,'channel'); chBack();` },
  { id: '33-archived',  name: 'Канал в архиве',        code: `var m=my(); m.archived=true; chCore.save(); reopen('list'); cx2Seg('arch');` },
  { id: '34-unarchived',name: 'Канал из архива',       code: `var m=my(); m.archived=false; chCore.save(); cx2Seg('mine');` },
  { id: '35-delete',    name: 'Удаление: диалог',      code: `chDeleteChannel(my().id);` },
  { id: '36-deleted',   name: 'Канал удалён',          code: `popClick(/Удалить навсегда/);` },

  { id: '37-official',  name: 'Официальный канал',     code: `reopen('channel','ch-disc-4');` },
  { id: '38-gated',     name: 'Закрытый канал',        code: `reopen('channel','ch-disc-5');` },
  { id: '39-more',      name: 'Меню «Ещё»',            code: `chMoreMenu('ch-disc-5');` },
  { id: '40-report',    name: 'Жалоба',                code: `popClick(/Пожаловаться/);` },
  { id: '41-follow',    name: 'Подписка оформлена',    code: `popClose(); reopen('list'); cx2Follow('ch-disc-4');` },
  { id: '42-unfollow',  name: 'Отписка: диалог',       code: `cx2Unfollow('ch-disc-4');` },
  { id: '43-unfollowed',name: 'Отписка выполнена',     code: `popClick(/Отписаться/);` },
  { id: '44-light',     name: 'Светлая тема',          code: `document.documentElement.setAttribute('data-theme','light'); reopen('list');` },
  { id: '45-light-stat',name: 'Светлая: каталог',      code: `reopen('catalog');` },
  { id: '46-back-exit', name: 'Выход кнопкой назад',   code: `document.documentElement.setAttribute('data-theme','dark'); reopen('channel','ch-disc-4'); document.querySelector('#chView .ch-back').click();` }
];

/* Выполнить код страницы.
   page.evaluate(string) в playwright сначала пробует истолковать строку как
   функцию — и многострочный код, начинающийся с объявления функции, падает с
   «SyntaxError: Unexpected token 'function'». Поэтому передаём исходник
   аргументом и запускаем непрямым eval: полноценная программа, возвращается
   значение последнего выражения. */
function run(page, src) {
  return page.evaluate(s => (0, eval)(s), src);
}

/* Готовность страницы: ядро каналов и слой подняты. */
function ready(page, ms) {
  return page.waitForFunction(
    () => typeof window.chOpen === 'function' && !!window.chCore && typeof window.cx2Filter === 'function',
    null, { timeout: ms || 60000 }
  );
}

/* Один прогон живёт минуты, и вкладка может пересоздать контекст (страница
   докоммитила документ, сработал апдейт воркера и т.п.). Это не дефект раздела,
   поэтому такой шаг не валим, а повторяем один раз на восстановленной странице. */
async function runResilient(page, src, ms, what) {
  try {
    return await withDeadline(run(page, src), ms, what);
  } catch (e) {
    const msg = String(e && e.message || e);
    if (!/Execution context was destroyed|is not defined|Target closed|navigation/i.test(msg)) throw e;
    await ready(page, 60000);
    await page.waitForTimeout(400);
    return withDeadline(run(page, src), ms, what + ' (повтор после перезагрузки)');
  }
}

/* Машина под нагрузкой: один залипший шаг не должен съесть весь прогон.
   Ограничиваем каждое действие своим дедлайном и идём дальше. */
function withDeadline(promise, ms, what) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, reject) => { t = setTimeout(() => reject(new Error('дедлайн ' + ms + 'мс: ' + what)), ms); })
  ]);
}

/* ждём, пока закончатся анимации: иначе ловим промежуточную геометрию */
async function settle(page) {
  await page.waitForTimeout(120);
  try {
    await page.waitForFunction(() => {
      try { return document.getAnimations().filter(a => a.playState === 'running').length === 0; }
      catch (e) { return true; }
    }, null, { timeout: 2500 });
  } catch (e) { /* какая-то бесконечная анимация — мерим как есть */ }
  await page.waitForTimeout(90);
}

async function main() {
  if (SHOTS) await fs.mkdir(OUT_SHOTS, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
  });

  const report = { at: new Date().toISOString(), url: URL_BASE, modes: [], totals: {} };

  for (const mode of MODES) {
    const ctx = await browser.newContext({
      viewport: { width: mode.width, height: mode.height },
      deviceScaleFactor: 1,
      /* Service worker в прогоне не нужен и мешает: ядро перезагружает страницу
         по controllerchange (app.js), а любое изменение service-worker.js на
         диске обновляет SW прямо посреди обхода — шаги падают с «Execution
         context was destroyed». Проверяем раздел, а не кэширование. */
      serviceWorkers: 'block',
      userAgent: mode.telegram
        ? 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36 Telegram-Android/10'
        : undefined
    });
    await ctx.addInitScript(initScript(mode));

    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push({ type: 'pageerror', msg: String(e && e.message || e).slice(0, 240) }));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (/favicon|service-worker|Failed to load resource/i.test(t)) return;
      errors.push({ type: 'console', msg: t.slice(0, 240) });
    });

    /* index.html + app.js весят почти 6 МБ: на загруженной машине штатных
       30 секунд не хватает, поэтому ждём дольше и по факту готовности слоя */
    page.setDefaultTimeout(25000);
    page.setDefaultNavigationTimeout(120000);
    await page.goto(URL_BASE + '/index.html', { waitUntil: 'commit', timeout: 120000 });
    await ready(page, 120000);
    await page.waitForTimeout(600);

    const modeRep = { id: mode.id, name: mode.name, steps: [], errors: [] };

    const plan = ONLY && ONLY !== true
      ? STEPS.filter(st => String(ONLY).split(',').indexOf(st.id) >= 0)
      : STEPS;
    for (const step of plan) {
      const rec = { id: step.id, name: step.name };
      try {
        const before = errors.length;
        await runResilient(page, HELPERS + '\n' + step.code, 20000, 'шаг ' + step.id);
        await settle(page);
        if (step.after) { await runResilient(page, HELPERS + '\n' + step.after, 20000, 'after ' + step.id); await settle(page); }
        const r = await runResilient(page, DETECT, 30000, 'детектор ' + step.id);
        rec.title = r.title;
        rec.issues = [];
        if (r.overflowX > 1) rec.issues.push({ k: 'overflowX', v: r.overflowX });
        if (r.offRight.length) rec.issues.push({ k: 'offRight', v: r.offRight });
        if (r.clipped.length) rec.issues.push({ k: 'clipped', v: r.clipped });
        if (r.midWordBreak.length) rec.issues.push({ k: 'midWordBreak', v: r.midWordBreak });
        if (r.underTop.length) rec.issues.push({ k: 'underTop', v: r.underTop });
        if (r.underBottom.length) rec.issues.push({ k: 'underBottom', v: r.underBottom });
        if (r.badNumbers.length) rec.issues.push({ k: 'badNumbers', v: r.badNumbers });
        if (r.fakeData.length) rec.issues.push({ k: 'fakeData', v: r.fakeData });
        if (!r.hasExit) rec.issues.push({ k: 'noExit', v: r.exitBox || null });
        if (r.emptyBody) rec.issues.push({ k: 'emptyScreen', v: r.bodyText });
        const newErrors = errors.slice(before);
        if (newErrors.length) rec.issues.push({ k: 'js', v: newErrors });
        rec.ok = rec.issues.length === 0;
        if (SHOTS) {
          const f = path.join(OUT_SHOTS, `${mode.id}-${step.id}.png`);
          await withDeadline(page.screenshot({ path: f }), 20000, 'скриншот ' + step.id);
          rec.shot = path.relative(HERE, f);
        }
      } catch (e) {
        rec.ok = false;
        rec.issues = [{ k: 'stepFailed', v: String(e && e.message || e).slice(0, 240) }];
      }
      modeRep.steps.push(rec);
    }

    /* контроль выхода: Escape и системная «назад» */
    try {
      await runResilient(page, HELPERS + `\nreopen('channel','ch-disc-4'); chGo('manage','ch-disc-4');`, 20000, 'escape-подготовка');
      await settle(page);
      await page.keyboard.press('Escape');
      await settle(page);
      const afterEsc = await page.evaluate(() => {
        var v = document.getElementById('chView');
        var t = document.getElementById('chHeadTitle');
        return { open: !!(v && v.classList.contains('open')), title: t ? t.textContent.trim() : '' };
      });
      /* Escape со страницы управления обязан вернуть на страницу канала —
         ровно как кнопка «назад» в шапке, ни больше ни меньше */
      modeRep.escape = afterEsc;
      modeRep.escapeSteppedBack = !!(afterEsc.open && afterEsc.title && afterEsc.title !== 'Управление');
      await runResilient(page, `try{ chClose(); }catch(e){}`, 20000, 'закрытие раздела');
      await settle(page);
      const closed = await page.evaluate(() => !document.getElementById('chView').classList.contains('open'));
      modeRep.closes = closed;
    } catch (e) { modeRep.escape = { error: String(e.message).slice(0, 120) }; }

    modeRep.errors = errors.slice(0, 20);
    modeRep.failed = modeRep.steps.filter(s => !s.ok).length;
    report.modes.push(modeRep);
    await ctx.close();
  }

  await browser.close();

  const flat = report.modes.flatMap(m => m.steps.map(s => ({ mode: m.id, ...s })));
  report.totals = {
    steps: flat.length,
    ok: flat.filter(s => s.ok).length,
    failed: flat.filter(s => !s.ok).length,
    byKind: flat.flatMap(s => (s.issues || []).map(i => i.k))
      .reduce((a, k) => (a[k] = (a[k] || 0) + 1, a), {}),
    jsErrors: report.modes.reduce((n, m) => n + m.errors.length, 0),
    clean: flat.every(s => s.ok) && report.modes.every(m => m.errors.length === 0)
  };

  await fs.writeFile(OUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({
    totals: report.totals,
    failing: flat.filter(s => !s.ok).map(s => ({ mode: s.mode, id: s.id, name: s.name, issues: s.issues })).slice(0, 40)
  }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
