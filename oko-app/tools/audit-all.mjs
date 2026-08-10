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
import { CLEAN_START, CLOSE_OVERLAYS, OVERLAY_VISIBLE, RESET_ALL } from './clean-start.mjs';

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

/* --------------------------------------------------------------- детектор

   Принимает признак «экран в самом верху»: часть проверок имеет смысл только
   там. Прокрученный экран обязан заезжать под липкую шапку — ловить это как
   дефект значит завалить отчёт сотней выдуманных замечаний, что и случилось
   в раундах 40 и 41. */
const детектор = (сверху0, конец, ширина) => `(() => {
  const ВЕРХ = ${сверху0 ? 'true' : 'false'};
  const КОНЕЦ = ${конец ? 'true' : 'false'};
  const out = { переполнение: 0, обрезано: [], разрывы: [], подШапкой: [], пусто: false,
                наложения: [], фейк: [], эмодзи: [] };
  /* Ширину окна берём ту, что задал прогон, а НЕ innerWidth.

     Две ловушки сразу. Во-первых, scrollWidth документа тут бесполезен:
     у корня overflow-x:hidden, и он рапортует ноль, что бы ни торчало.
     Во-вторых, innerWidth врёт ровно в том случае, ради которого проверка и
     нужна: широкий элемент раздвигает область просмотра, innerWidth
     вырастает вместе с ним, и переполнение «исчезает». Самопроверка это
     поймала — подсаженный элемент шириной 510 при окне 390 не находился.
     Поэтому эталон ширины приходит снаружи. */
  const VW = ${+ширина || 0} || innerWidth;
  out.переполнение = 0;

  /* Видимость меряем ПО ВСЕЙ ЦЕПОЧКЕ предков.

     Раньше смотрели только сам элемент — и в отчёт лезли кнопки из закрытых
     панелей: у кнопки opacity 1, а у панели над ней 0. Так набралось 220
     «наложений» из 220: одни и те же sp-qr-btn и mp-mv-x на каждом экране.
     display и visibility наследуются вычисленным стилем, а opacity — нет,
     её и добираем обходом вверх. Смещение трансформом ловится сразу:
     getBoundingClientRect его уже учёл. */
  const прозрачен = el => {
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden') return true;
      if (+cs.opacity < 0.05) return true;
      if (cs.contentVisibility === 'hidden') return true;
    }
    return false;
  };
  /* Элемент виден, только если он попадает в окно КАЖДОГО своего обрезающего
     предка, а не просто в окно браузера.

     На этом детектор врал. Экран-вкладка начинается под шапкой, на y = 65, и
     всё, что уехало выше при прокрутке, браузер обрезает — но
     getBoundingClientRect по-прежнему возвращает старые координаты. Чип
     баланса, укатившийся на y = 13, формально лежал в окне и формально был
     «перекрыт шапкой». Отсюда брались «наложения» на вкладке мини-аппов,
     в играх и в академии: ни одного видимого элемента, три замечания. */
  const вКадре = el => {
    const r = el.getBoundingClientRect();
    for (let q = el.parentElement; q && q !== document.body; q = q.parentElement) {
      const cs = getComputedStyle(q);
      if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const b = q.getBoundingClientRect();
      if (b.width < 1 || b.height < 1) continue;
      if (r.bottom <= b.top + 1 || r.top >= b.bottom - 1) return false;
      if (r.right <= b.left + 1 || r.left >= b.right - 1) return false;
    }
    return true;
  };
  const видим = el => {
    if (прозрачен(el)) return false;
    const r = el.getBoundingClientRect();
    if (!(r.width > 3 && r.height > 3 && r.bottom > 0 && r.top < innerHeight)) return false;
    return вКадре(el);
  };
  /* Пальцем до элемента не добраться, если он сам или любой предок выключен
     из попадания. Проверять такое на перекрытие бессмысленно. */
  const мимоПальца = el => {
    for (let p = el; p && p !== document.documentElement; p = p.parentElement) {
      if (getComputedStyle(p).pointerEvents === 'none') return true;
      if (p.hasAttribute && (p.hasAttribute('inert') || p.getAttribute('aria-hidden') === 'true')) return true;
    }
    return false;
  };

  /* Что человек СЕЙЧАС видит.

     Поверх вкладки может стоять полноэкранная панель: клипы, шторка
     партнёрской программы, мини-апп. Тогда всё, что под ней, человеку
     недоступно — и мерить его нельзя: получаются «наложения» вида
     «кнопка темы закрыта лентой клипов», хотя закрыта она правильно.
     Ищем самый верхний крупный позиционированный слой, который не является
     самим экраном и не лежит внутри него. Нашли — аудируем только его. */
  const активный = document.querySelector('main > .screen.active');
  const поверх = (() => {
    let лучший = null, макс = -1;
    document.querySelectorAll('body *').forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'absolute') return;
      if (активный && (el === активный || el.contains(активный) || активный.contains(el))) return;
      if (!видим(el)) return;
      /* Прозрачная подложка не закрывает ничего: #pp2Nav — пустой div с
         pointer-events:none во весь экран, и он ловился как «панель поверх»
         на 37 экранах из 63, а следом каждый такой экран объявлялся пустым. */
      if (мимоПальца(el)) return;
      if (!(el.textContent || '').trim()) return;
      const r = el.getBoundingClientRect();
      if (r.width * r.height < innerWidth * innerHeight * 0.55) return;
      const z = parseInt(cs.zIndex, 10) || 0;
      if (z >= макс) { макс = z; лучший = el; }
    });
    return лучший;
  })();
  out.поверх = поверх
    ? (поверх.id ? '#' + поверх.id
      : поверх.tagName.toLowerCase() + '.' + String(поверх.className).trim().split(/\\s+/)[0])
    : '';
  const виден = el => !поверх || поверх.contains(el);

  /* шапка приложения — под неё ничего не должно уезжать */
  const шапка = document.querySelector('header, .app-head, #okoHead, .hd');
  const низШапки = шапка && видим(шапка) && виден(шапка) ? шапка.getBoundingClientRect().bottom : 0;

  const ЭМОДЗИ = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}]/u;
  const ФЕЙК = /(\\d+[.,]?\\d*\\s*(к|k|м|m)\\s*(подписчик|просмотр|охват))|(\\+\\d{2,}%\\s*к\\s)|(проверено на \\d+)/i;

  const пусто = [];
  document.querySelectorAll('body *').forEach(el => {
    if (el.ownerSVGElement || !видим(el) || !виден(el)) return;
    const cs = getComputedStyle(el);
    const r  = el.getBoundingClientRect();
    const свой = el.children.length === 0;
    const txt = (el.textContent || '').trim();

    /* Что-то торчит за правым краем. Считаем только неклипнутое: элемент,
       обрезанный своим контейнером, за край не вылезает. */
    if (r.right > VW + 2 && r.width < VW * 3)
      out.переполнение = Math.max(out.переполнение, Math.round(r.right - VW));

    if (свой && txt) {
      пусто.push(1);

      /* обрезание: содержимое шире ячейки и спрятано */
      const намеренно = cs.textOverflow === 'ellipsis' || cs.webkitLineClamp !== 'none';
      if (!намеренно && el.scrollWidth > el.clientWidth + 1 && cs.overflow !== 'visible')
        if (out.обрезано.length < 8) out.обрезано.push(txt.slice(0, 38));

      /* Обрезано сверху.

         Жалоба Даниэля «сверху обрезается» — про это: экран только открылся,
         прокрутка в нуле, а верхняя строка уже наполовину за верхним краем
         своего контейнера. Прокруткой её не достать, вверх идти некуда.

         Прежняя формулировка проверки («текст залез под шапку») в этой
         вёрстке недостижима: шапка — обычный flex-сосед, панели рисуются
         поверх неё. Она давала 141 и 104 выдуманных замечания и ни одного
         настоящего, потому что ловила заголовки внутри самой шапки и
         нормальную прокрутку под липкий слой. */
      if (ВЕРХ) {
        for (let q = el.parentElement; q && q !== document.body; q = q.parentElement) {
          const qs = getComputedStyle(q);
          if (qs.overflowY === 'visible' && qs.overflow === 'visible') continue;
          if (q.scrollTop > 1) break;                 /* прокручено — не в счёт */
          const b = q.getBoundingClientRect();
          if (b.height < 40) continue;
          if (r.top < b.top - 1 && r.bottom > b.top + 1) {
            if (out.подШапкой.length < 6) out.подШапкой.push(txt.slice(0, 30));
          }
          break;
        }
      }

      /* эмодзи в интерфейсе */
      if (ЭМОДЗИ.test(txt) && !el.closest('.emj-grid, .emj-list, [data-emoji-content]'))
        if (out.эмодзи.length < 6) out.эмодзи.push(txt.slice(0, 24));

      /* выдуманные метрики */
      if (ФЕЙК.test(txt))
        if (out.фейк.length < 6) out.фейк.push(txt.slice(0, 44));

      /* Перенос посреди слова — замер по настоящим строкам.

         Технические строки рвать МОЖНО: реф-ссылка, адрес кошелька, хеш,
         код платежа. Для них в проекте есть класс .oko-breakable, и ловить
         их как дефект — врать: разрыв там сделан нарочно, иначе строка
         вылезет за карточку. Отдельно отсеиваем то, что выглядит как ссылка
         или код, даже если класс забыли повесить. */
      const шир = el.offsetWidth || Math.round(r.width);
      const техническая = el.closest('.oko-breakable, .wal-addr, .ads-rv-link, .wal-recv-link, .w2-qr-link, .pp-qr-url, .pp2-qr-link, .ps-sharelink, .ps-soc-pub-url')
        || /https?:\\/\\/|[?&][a-z_]+=|^[A-Z0-9-]{10,}$|@[a-z0-9_]{3,}/i.test(txt.trim());
      if (!техническая &&
          (cs.wordBreak === 'break-all' || cs.overflowWrap === 'anywhere') && шир < 240) {
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

  /* Наложение: до кнопки не дотянуться пальцем, потому что сверху чужой узел.

     Настоящий дефект здесь редок, а ложных срабатываний легко набрать сотни —
     раунды 40 и 41 дали 196 и 220, и настоящих среди них не было ни одного.
     Поэтому три отсева и строгий замер:

       • кнопка из закрытой панели не в счёт — она уже отсеяна видимостью
         по цепочке предков (панель с opacity 0) и рамкой окна;
       • кнопка, выключенная из попадания (pointer-events, inert, aria-hidden),
         не в счёт: её никто и не собирался нажимать;
       • перекрытие считается настоящим, только если чужой узел лежит НАД
         ВСЕЙ кнопкой. Мерим пять точек — центр и четыре вдавленных угла.
         Один-два перекрытых угла — это соседняя карточка или тень, палец
         всё равно попадёт. */
  const своё = (el, кто) => !кто || кто === el || el.contains(кто) || кто.contains(el)
    || кто.closest('button, [role="button"], .prow, .pp2-row') === el
    || el.closest('button, [role="button"]') === кто.closest('button, [role="button"]');

  /* Плавающий слой — шапка или нижнее меню — перекрывает содержимое по ходу
     прокрутки, и это норма: докрутил, и кнопка вышла из-под него. Дефект тут
     ровно один — когда крутить больше некуда, а кнопка всё ещё под меню.
     Поэтому шапку не считаем никогда, а нижнее меню — только на последнем
     шаге прокрутки. Без этого правила каждая липкая шапка приносила по
     несколько выдуманных наложений на экран. */
  const плавает = el => {
    for (let q = el; q && q !== document.documentElement; q = q.parentElement) {
      const ps = getComputedStyle(q).position;
      if (ps === 'fixed' || ps === 'sticky') return q;
    }
    return null;
  };

  document.querySelectorAll('button, [role="button"], .prow, .pp2-row').forEach(el => {
    if (out.наложения.length >= 5) return;
    if (!видим(el) || !виден(el) || мимоПальца(el)) return;
    const экран = el.closest('.screen');
    if (экран && !экран.classList.contains('active')) return;
    const r = el.getBoundingClientRect();
    if (r.left < 0 || r.top < 0 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) return;
    const dx = Math.min(6, r.width / 3), dy = Math.min(6, r.height / 3);
    const точки = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + dx, r.top + dy], [r.right - dx, r.top + dy],
      [r.left + dx, r.bottom - dy], [r.right - dx, r.bottom - dy]
    ];
    let чужой = null;
    for (const [x, y] of точки) {
      const кто = document.elementFromPoint(x, y);
      if (своё(el, кто)) return;          /* хоть одна точка своя — попадём */
      чужой = чужой || кто;
    }
    const пл = плавает(чужой);
    if (пл && !плавает(el)) {
      const пр = пл.getBoundingClientRect();
      const сверхуЛи = пр.top + пр.height / 2 < r.top + r.height / 2;
      if (сверхуЛи) return;               /* шапка: прокрутил — и открылось */
      if (!КОНЕЦ) return;                 /* нижнее меню: крутить ещё есть куда */
    }
    out.наложения.push(((el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 24) || el.className) +
      ' ← ' + чужой.tagName.toLowerCase() + '.' + String(чужой.className).trim().split(/\\s+/)[0]);
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
      await p.evaluate(RESET_ALL).catch(() => {});
      await p.evaluate(`(()=>{ try{ showTab('profile'); }catch(e){} })()`).catch(() => {});
      await p.waitForTimeout(200);
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
      let переполнение = 0, пустых = 0, поверх = '';

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
        const пр = await p.evaluate(детектор(s === 0, s === шагов - 1, m.w)).catch(() => null);
        if (!пр) continue;
        переполнение = Math.max(переполнение, пр.переполнение);
        if (пр.пусто) пустых++;
        if (!s && пр.поверх) поверх = пр.поверх;
        ['обрезано','разрывы','подШапкой','наложения','фейк','эмодзи'].forEach(k => пр[k].forEach(v => собрано[k].add(v)));
      }

      /* Панель поверх вкладки — не дефект сама по себе, но замеры относятся
         к ней, а не к экрану из карты. Пишем это прямо, чтобы отчёт не
         выдавал чужой экран за проверенный. */
      if (поверх) зам.поверх = поверх;
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

/* --- Одинаковые кадры: значит переход не сработал ---
   Считаем только совпадения ВНУТРИ одного режима: один и тот же экран в
   320 и в 1440 совпасть не может, а вот два разных маршрута с одинаковым
   кадром — это два несработавших перехода. Группы выписываем поимённо,
   иначе число «46 повторов» нечего чинить. */
let повторов = 0;
const группы = [];
if (СНИМАТЬ) {
  const имена = new Map(маршруты.map(r => [r.id, r.имя]));
  const кадры = new Map();
  for (const f of (await fs.readdir(OUT)).filter(f => f.endsWith('.png'))) {
    const режим = f.split('__')[0];
    const h = режим + ':' + crypto.createHash('md5').update(await fs.readFile(path.join(OUT, f))).digest('hex');
    if (!кадры.has(h)) кадры.set(h, []);
    кадры.get(h).push(f);
  }
  for (const [h, g] of кадры) {
    if (g.length < 2) continue;
    повторов += g.length;
    группы.push({
      режим: h.split(':')[0],
      экраны: g.map(f => {
        const id = f.split('__')[1].replace('.png', '');
        return id + ' ' + (имена.get(id) || '');
      })
    });
  }
  отчёт.одинаковые = группы;
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
группы.slice(0, 14).forEach(g => console.log(`║   [${g.режим}] ${g.экраны.join('  ==  ').slice(0, 110)}`));
console.log(`╚ отчёт: ${path.join(OUT, 'report.json')}`);
