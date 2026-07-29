/* =================== PARTNER-PLUS ===================
   Партнёрский кабинет уровня Amazon Associates + Lava Partners + Getcourse:
   hero-дашборд с count-up и sparkline, топ-3 источника, дип-линки на все
   продукты OKO, QR-код, промо-пак (тексты + баннеры + reels-сценарии),
   turnover-лестница из 5 уровней, wall of fame, история выплат с фильтром,
   запрос выплаты (мин. 1000 ₽) на Lava/USDT/карту, живая слайд-плашка,
   welcome-онбординг с 15%-обещанием.
   Не трогает base.html: всё вставляется в существующий #screen-partner. */

(function partnerPlus(){
  'use strict';

  /* ---------- иконки: трофей, медаль, звезда-заливка, поделиться и др. ---------- */
  (function addIcons(){
    const defs = document.querySelector('svg defs');
    if(!defs) return;
    function sym(id, vb, inner){
      if(document.getElementById(id)) return;
      const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
      s.setAttribute('id', id); s.setAttribute('viewBox', vb);
      s.innerHTML = inner; defs.appendChild(s);
    }
    sym('i-pp-trophy', '0 0 100 100',
      '<path d="M30 20h40v18c0 12-9 22-20 22S30 50 30 38V20z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>' +
      '<path d="M30 26H18c0 10 5 18 12 20M70 26h12c0 10-5 18-12 20" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M42 62h16v10H42zM34 78h32v6H34z" fill="currentColor"/>');
    sym('i-pp-medal', '0 0 100 100',
      '<circle cx="50" cy="58" r="22" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M32 40 22 14h20l10 20M68 40l10-26H58L48 34" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>');
    sym('i-pp-qr', '0 0 100 100',
      '<rect x="10" y="10" width="26" height="26" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="18" y="18" width="10" height="10" fill="currentColor"/>' +
      '<rect x="64" y="10" width="26" height="26" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="72" y="18" width="10" height="10" fill="currentColor"/>' +
      '<rect x="10" y="64" width="26" height="26" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="18" y="72" width="10" height="10" fill="currentColor"/>' +
      '<rect x="46" y="10" width="6" height="14" fill="currentColor"/>' +
      '<rect x="46" y="30" width="6" height="6" fill="currentColor"/>' +
      '<rect x="46" y="46" width="14" height="6" fill="currentColor"/>' +
      '<rect x="66" y="46" width="6" height="6" fill="currentColor"/>' +
      '<rect x="46" y="60" width="6" height="6" fill="currentColor"/>' +
      '<rect x="60" y="60" width="14" height="14" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="82" y="60" width="8" height="8" fill="currentColor"/>' +
      '<rect x="82" y="76" width="8" height="14" fill="currentColor"/>' +
      '<rect x="60" y="82" width="14" height="8" fill="currentColor"/>');
    sym('i-pp-share', '0 0 100 100',
      '<circle cx="22" cy="50" r="10" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<circle cx="74" cy="22" r="10" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<circle cx="74" cy="78" r="10" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M31 46 65 27M31 54 65 73" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>');
    sym('i-pp-up', '0 0 100 100',
      '<path d="M14 68 42 40l16 16 28-30M62 26h24v24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>');
    sym('i-pp-ig', '0 0 100 100',
      '<rect x="14" y="14" width="72" height="72" rx="20" fill="none" stroke="currentColor" stroke-width="7"/>' +
      '<circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" stroke-width="7"/>' +
      '<circle cx="72" cy="28" r="5" fill="currentColor"/>');
    sym('i-pp-tg', '0 0 100 100',
      '<path d="M88 14 14 44c-3 1-3 5 0 6l20 7c2 1 3 2 4 4l7 20c1 3 5 3 6 0L81 22c1-4-2-7-6-6z" fill="currentColor"/>');
    sym('i-pp-yt', '0 0 100 100',
      '<rect x="10" y="24" width="80" height="52" rx="13" fill="currentColor"/>' +
      '<path d="M44 38v24l20-12z" fill="var(--surface)"/>');
    sym('i-pp-vk', '0 0 100 100',
      '<rect x="10" y="10" width="80" height="80" rx="18" fill="currentColor"/>' +
      '<path d="M22 36c2 22 12 32 30 32h4v-14c2 0 4 2 8 6l8 8h10c-6-8-9-11-14-16-2-2-2-4 0-6 4-6 12-14 12-18h-10c-4 4-8 10-12 14-3 3-4 2-4-2V28h-4c-8 0-12 4-14 6 0 0 6 0 6 6v10c0 4-2 4-4 2-4-4-8-12-10-16z" fill="var(--surface)"/>');
    sym('i-pp-link', '0 0 100 100',
      '<path d="M42 58c-3-3-3-9 0-12l16-16c3-3 9-3 12 0l4 4c3 3 3 9 0 12L64 54M58 42c3 3 3 9 0 12L42 70c-3 3-9 3-12 0l-4-4c-3-3-3-9 0-12l10-10" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
    sym('i-pp-usdt', '0 0 100 100',
      '<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M28 36h44v10H56v22c-4 1-8 1-12 0V46H28z M38 58c8 3 16 3 24 0" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>');
    sym('i-pp-clip', '0 0 100 100',
      '<rect x="24" y="14" width="52" height="72" rx="8" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M36 14V10a4 4 0 0 1 4-4h20a4 4 0 0 1 4 4v4M36 40h28M36 54h28M36 68h20" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>');
    sym('i-pp-image', '0 0 100 100',
      '<rect x="12" y="18" width="76" height="64" rx="10" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<circle cx="34" cy="40" r="7" fill="currentColor"/>' +
      '<path d="M14 72 36 52l14 12 12-10 24 18" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>');
    sym('i-pp-play', '0 0 100 100',
      '<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M42 34 68 50 42 66z" fill="currentColor"/>');
    sym('i-pp-gift', '0 0 100 100',
      '<rect x="14" y="40" width="72" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M14 56h72M50 40v46" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M50 40s-4-18-14-18-8 18 14 18zM50 40s4-18 14-18 8 18-14 18z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>');
    sym('i-pp-rocket', '0 0 100 100',
      '<path d="M52 12c14 4 26 20 26 40 0 6-2 12-6 18l-14 4-4-14-14-4c6-4 12-6 18-6 20 0 36-12 40-26-4-14-20-16-46-12z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>' +
      '<circle cx="62" cy="38" r="5" fill="currentColor"/>' +
      '<path d="M40 60c-4 4-6 12-6 20 8 0 16-2 20-6" fill="none" stroke="currentColor" stroke-width="6"/>');
    sym('i-pp-badge-check', '0 0 100 100',
      '<path d="M50 8l12 8 14-2 4 14 14 4-2 14 8 12-8 12 2 14-14 4-4 14-14-2-12 8-12-8-14 2-4-14-14-4 2-14L4 74l8-12-2-14 14-4 4-14 14 2z" fill="currentColor"/>' +
      '<path d="M32 52l12 12 24-30" fill="none" stroke="var(--surface)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>');
    sym('i-pp-calc', '0 0 100 100',
      '<rect x="20" y="10" width="60" height="80" rx="8" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="28" y="18" width="44" height="16" rx="3" fill="currentColor"/>' +
      '<circle cx="36" cy="46" r="4" fill="currentColor"/>' +
      '<circle cx="50" cy="46" r="4" fill="currentColor"/>' +
      '<circle cx="64" cy="46" r="4" fill="currentColor"/>' +
      '<circle cx="36" cy="60" r="4" fill="currentColor"/>' +
      '<circle cx="50" cy="60" r="4" fill="currentColor"/>' +
      '<circle cx="64" cy="60" r="4" fill="currentColor"/>' +
      '<circle cx="36" cy="74" r="4" fill="currentColor"/>' +
      '<circle cx="50" cy="74" r="4" fill="currentColor"/>' +
      '<circle cx="64" cy="74" r="4" fill="currentColor"/>');
  })();

  /* ---------- профиль партнёра ---------- */
  const PP = {
    nick: 'daniel7x',
    monthEarned: 47350,      // ₽ заработано в этом месяце
    monthPrev:   38120,      // ₽ за прошлый месяц
    turnoverAll: 128740,     // ₽ всего оборота (для лестницы)
    weekTurnover: 21980,     // ₽ за эту неделю (для wall of fame)
    payoutAvail: 12780,      // ₽ доступно к выводу
    payoutMin:   1000,       // ₽ порог
    products: [
      {k:'all',    label:'Все', short:'all', dot:false},
      {k:'sistema',label:'Система OKO',   short:'sistema', price:4900,  desc:'PRO подписка · 4 900 ₽/мес', dot:true},
      {k:'zavod',  label:'Контент-завод', short:'zavod',   price:2900,  desc:'Reels-конвейер · 2 900 ₽/мес', dot:true},
      {k:'consult',label:'Консалтинг',    short:'consult', price:30000, desc:'Личный разбор · 30 000 ₽', dot:true},
      {k:'club',   label:'Клуб OKO',      short:'club',    price:1900,  desc:'Сообщество · 1 900 ₽/мес', dot:true},
    ],
    activeProduct: 'all',
  };

  const REF_PCT_FIRST = 15;    // % с первой оплаты (config.php: partner_percent)
  const REF_PCT_REPEAT = 5;    // % с повторных
  const REF_PCT_L2     = 5;    // % со 2-й линии

  /* ---------- turnover-лестница из 5 уровней ---------- */
  const TIERS = [
    {k:'junior', label:'Junior', min:0,        max:10000,    bonus:0,  badge:'pp-medal'},
    {k:'middle', label:'Middle', min:10000,    max:50000,    bonus:5,  badge:'pp-medal'},
    {k:'senior', label:'Senior', min:50000,    max:200000,   bonus:10, badge:'pp-medal'},
    {k:'pro',    label:'Pro',    min:200000,   max:1000000,  bonus:15, badge:'pp-trophy'},
    {k:'legend', label:'Legend', min:1000000,  max:Infinity, bonus:20, badge:'crown'},
  ];
  function currentTier(turnover){
    let idx = 0;
    for(let i=TIERS.length-1;i>=0;i--) if(turnover >= TIERS[i].min){ idx = i; break; }
    return {idx, tier:TIERS[idx], next:TIERS[idx+1]||null};
  }

  /* ---------- источники трафика (топ-3+) ---------- */
  const SOURCES = [
    {k:'ig',  ic:'pp-ig',  name:'Instagram',      sum:19870, hint:'сторис · reels'},
    {k:'tg',  ic:'pp-tg',  name:'Telegram-канал', sum:15420, hint:'посты · закреп'},
    {k:'yt',  ic:'pp-yt',  name:'YouTube',        sum: 8460, hint:'обзоры · описание'},
    {k:'vk',  ic:'pp-vk',  name:'VK',             sum: 2200, hint:'клипы · группа'},
    {k:'dir', ic:'pp-link',name:'Прямые ссылки',  sum: 1400, hint:'визитка · QR'},
  ];

  /* ---------- wall of fame (топ-10) ---------- */
  const LEADERS = [
    {nick:'anna.mkt',    sum:184300, tier:'legend'},
    {nick:'kirill.pro',  sum:142650, tier:'pro'},
    {nick:'vova.reels',  sum: 96420, tier:'senior'},
    {nick:'lera.copy',   sum: 78900, tier:'senior'},
    {nick:'ilya.growth', sum: 61200, tier:'senior'},
    {nick:'masha.smm',   sum: 44580, tier:'middle'},
    {nick:'daniel7x',    sum: PP.weekTurnover, tier:'middle'},
    {nick:'tim.sales',   sum: 18740, tier:'middle'},
    {nick:'nadya.blog',  sum: 14200, tier:'middle'},
    {nick:'sasha.void',  sum:  9840, tier:'junior'},
  ];

  /* ---------- промо-материалы (тексты, баннеры, reels) ---------- */
  const PROMO = [
    // тексты для соцсетей
    { kind:'text', k:'ig-story', h:'Один инструмент вместо десяти', sub:'IG Stories · 1080×1920',
      gr:'g1', fmt:'1080×1920', tag:'Instagram',
      copy:'OKO · я снёс 8 приложений и оставил одно.\n\nМессенджер + лента + мини-аппы + кошелёк + академия · всё внутри одного окна.\n\nЗабирай по моей ссылке · я приготовил скидку -15% на первый месяц PRO.\n\n{ref}\n\n#OKO #продуктивность'
    },
    { kind:'text', k:'tg-post', h:'Пост в Telegram: почему я перевёл команду', sub:'TG · длинный пост',
      gr:'g4', fmt:'Telegram', tag:'Telegram',
      copy:'Почему я перевёл всю команду в OKO.\n\nБыло: Notion + Telegram + CapCut + пять таблиц. Работало, но каждое утро я 40 минут собирал контекст.\n\nСтало: одно окно OKO. Чаты, лента, кошелёк, академия, биржа услуг · всё синхронно и на русском рынке.\n\nЧто зашло сильнее всего:\n· контент-завод собирает Reels 1080×1920 без монтажёра\n· кошелёк с эскроу на сделки внутри\n· партнёрка 15% + 5% сверху со второй линии\n\nСсылка ниже. Первый месяц PRO — со скидкой по моей ссылке.\n\n{ref}'
    },
    { kind:'text', k:'vk-post', h:'Пост во ВКонтакте / Дзен', sub:'VK · Дзен',
      gr:'g7', fmt:'VK', tag:'ВК/Дзен',
      copy:'5 фишек OKO, которых нет у Telegram:\n\n1. Партнёрка 15% / 5% прямо внутри приложения · выплаты на карту РФ, USDT или Lava.top.\n2. Кошелёк с эскроу для сделок между людьми.\n3. Академия с сертификатом и уроками по нейронкам.\n4. Биржа услуг под ключ с рейтингом исполнителей.\n5. Контент-завод: Reels 1080×1920 с озвучкой и субтитрами без монтажёра.\n\nВходить сюда: {ref}\nПри переходе по моей ссылке скинут первый месяц PRO.'
    },
    { kind:'text', k:'ig-caption', h:'Подпись под пост в Instagram', sub:'IG · Feed 1080×1080',
      gr:'g3', fmt:'1080×1080', tag:'Instagram',
      copy:'Раньше монтаж = 3 часа. Теперь · 8 минут.\n\nОткрываю Контент-завод в OKO, кидаю тему · получаю Reels 1080×1920 с озвучкой и караоке-субтитрами. Работает на телефоне.\n\nПо моей ссылке первый месяц PRO — со скидкой. Проверяй в описании.\n\n{ref}\n\n#reels #контент #OKO #продуктивность'
    },
    // баннеры
    { kind:'banner', k:'banner-story', h:'OKO · всё в одном', sub:'Stories',
      gr:'g1', fmt:'1080×1920', tag:'Stories',
      copy:'Баннер 1080×1920 для сторис. Скачивай PNG и добавляй свою реф-ссылку в стикер «ссылка».\n\nВариант подписи под баннер: «Одно приложение вместо восьми · забирай PRO со скидкой по моей ссылке»\n\n{ref}'
    },
    { kind:'banner', k:'banner-square', h:'Партнёрка 15% + 5%', sub:'Пост / Ads',
      gr:'g2', fmt:'1080×1080', tag:'Feed',
      copy:'Баннер 1080×1080 для ленты Instagram, ВК, LinkedIn.\n\nПодпись:\n«Приведи одного клиента в OKO · получай 15% с каждой его оплаты. Он приведёт друга · +5% сверху. Выплаты за 24-48 часов на Lava, USDT или карту РФ»\n\n{ref}'
    },
    { kind:'banner', k:'banner-wide', h:'OKO · русский рынок', sub:'Web-hero',
      gr:'g5', fmt:'1600×900', tag:'Web',
      copy:'Web-баннер 1600×900 для сайта, статьи или Дзена.\n\nЗаголовок:\n«OKO · одно приложение вместо восьми. Мессенджер, кошелёк, академия, биржа, контент-завод и партнёрка. Русский рынок, платит с оборота твоих клиентов.»\n\nCTA: Забрать PRO со скидкой -> {ref}'
    },
    { kind:'banner', k:'banner-yt', h:'YouTube preview', sub:'16:9',
      gr:'g4', fmt:'1280×720', tag:'YouTube',
      copy:'Обложка 1280×720 для видео-обзора OKO на YouTube.\n\nПодпись под ролик:\n«В новом ролике разбираю OKO по косточкам: где выигрывает у Notion + Telegram + CapCut, где недотягивает, и почему я перевёл всю команду. По моей реф-ссылке · месяц PRO в подарок при годовой оплате.»\n\n{ref}'
    },
    { kind:'banner', k:'banner-ads', h:'Ads square 1080×1080', sub:'реклама · таргет',
      gr:'g6', fmt:'1080×1080', tag:'Ads',
      copy:'Оффер для ретаргета на подписчиков:\n\n«Приведи одного клиента в OKO · получай 15% с каждой его оплаты. Он приведёт друга · +5% сверху. Выплаты на карту РФ, USDT или Lava.top. Стартуй за 30 секунд.»\n\nСсылка на посадочную: {ref}'
    },
    // reels-сценарии
    { kind:'reels', k:'reels-success', h:'Успех · до/после', sub:'Reels · 9:16 · 20 сек',
      gr:'g2', fmt:'1080×1920', tag:'Успех',
      scenes:[
        {n:'0-2 сек', t:'HOOK', body:'Крупный план · телефон в руке', vo:'«Я снёс 8 приложений и оставил одно»'},
        {n:'2-6 сек', t:'ПРОБЛЕМА', body:'Быстрая нарезка: Notion, Telegram, CapCut, Google Docs, десятки вкладок', vo:'«Каждое утро 40 минут собирал контекст между вкладками»'},
        {n:'6-12 сек', t:'РЕШЕНИЕ', body:'Экран OKO: чаты · лента · кошелёк · академия · биржа', vo:'«В OKO всё в одном окне: чаты, лента, кошелёк, академия, биржа, контент-завод»'},
        {n:'12-16 сек', t:'ДОКАЗАТЕЛЬСТВО', body:'Скрин истории оплат партнёрки · сумма подсвечена', vo:'«За месяц партнёрка приносит от 47 000 ₽ пассивно · 15% с оплат»'},
        {n:'16-20 сек', t:'CTA', body:'Стикер «ссылка» + палец указывает вверх', vo:'«Ссылка в описании · по ней +30 дней PRO бесплатно»'}
      ],
      copy:'Reels-сценарий «Успех» · длительность 20 секунд · вертикальное 1080×1920.\n\nМузыка: спокойный upbeat, 90-100 BPM, drop на секунде 12.\nОбщий тон: уверенно, спокойно, без крика.\nCTA: {ref}'
    },
    { kind:'reels', k:'reels-pain', h:'Боль · раздражение → облегчение', sub:'Reels · 9:16 · 25 сек',
      gr:'g8', fmt:'1080×1920', tag:'Боль',
      scenes:[
        {n:'0-2 сек', t:'HOOK', body:'Крупный план · разлитый кофе, ноут завис', vo:'«Задолбался прыгать между приложениями?»'},
        {n:'2-8 сек', t:'НАКАЛ', body:'Быстро листаем: телега → задача пропала. Notion → бюджет не сошёлся. CapCut → рендер упал.', vo:'«Задача теряется в чатах. Клиент ждёт. Дедлайн вчера. Знакомо?»'},
        {n:'8-14 сек', t:'РАЗВЯЗКА', body:'Один жест · открывается OKO · всё в одном окне', vo:'«Один жест · OKO. Чат, оплата, задача, ролик · в одном окне. На русском»'},
        {n:'14-20 сек', t:'ДЕТАЛИ', body:'Кошелёк с эскроу · партнёрка · контент-завод (3 крупных плана)', vo:'«Эскроу-кошелёк для сделок. Партнёрка 15%. Контент-завод собирает Reels за 8 минут»'},
        {n:'20-25 сек', t:'CTA', body:'Свайп вверх на стикер «ссылка» · пульсация лого', vo:'«Ссылка в шапке · первый месяц PRO со скидкой»'}
      ],
      copy:'Reels-сценарий «Боль» · длительность 25 секунд · вертикальное 1080×1920.\n\nМузыка: тревожный саспенс на 0-8с → облегчение на 8с, тёплая мелодия дальше.\nОбщий тон: искренне, чуть иронично, без агрессии.\nCTA: {ref}'
    },
    { kind:'reels', k:'reels-compare', h:'Сравнение · vs Notion + Telegram + CapCut', sub:'Reels · 9:16 · 30 сек',
      gr:'g6', fmt:'1080×1920', tag:'Сравнение',
      scenes:[
        {n:'0-3 сек', t:'HOOK', body:'Экран разделён на 4: Notion, Telegram, CapCut, Google Docs vs OKO', vo:'«4 приложения против одного OKO. Ставлю на второе»'},
        {n:'3-10 сек', t:'РАУНД 1 · СПИСКИ', body:'Слева · создание задачи в 4 сервисах. Справа · создание задачи в OKO', vo:'«Задача. 4 сервиса → 42 секунды. OKO → 6 секунд»'},
        {n:'10-18 сек', t:'РАУНД 2 · ОПЛАТА', body:'Слева · перевод через банк. Справа · OKO кошелёк-эскроу', vo:'«Оплата с эскроу. Банк → 3 дня и комиссия. OKO → мгновенно, без комиссии внутри»'},
        {n:'18-25 сек', t:'РАУНД 3 · КОНТЕНТ', body:'Слева · монтаж в CapCut. Справа · Reels собран в OKO', vo:'«Reels 1080×1920 с озвучкой. CapCut → 3 часа. OKO → 8 минут»'},
        {n:'25-30 сек', t:'CTA', body:'Крупный план лого OKO · пульсация · ссылка снизу', vo:'«Ссылка в описании · +30 дней PRO по моей»'}
      ],
      copy:'Reels-сценарий «Сравнение» · длительность 30 секунд · вертикальное 1080×1920.\n\nМузыка: битовый ритм, 110 BPM, акценты на каждом раунде.\nОбщий тон: спортивный комментарий, «раунд · нокаут».\nCTA: {ref}'
    },
  ];

  /* ---------- история начислений ---------- */
  const HIST = [
    {t:'PRO · год · 1-я линия',      p:'sistema', lvl:1, sum: 6350, st:'paid', at: Date.now() - 2*24*3600e3},
    {t:'Контент-завод · мес · 1',    p:'zavod',   lvl:1, sum:  435, st:'paid', at: Date.now() - 3*24*3600e3},
    {t:'Консалтинг · разбор · 2',    p:'consult', lvl:2, sum: 1500, st:'paid', at: Date.now() - 5*24*3600e3},
    {t:'Система OKO · мес · 1',      p:'sistema', lvl:1, sum:  735, st:'hold', at: Date.now() - 8*3600e3, name:'Иван'},
    {t:'Клуб OKO · мес · 1',         p:'club',    lvl:1, sum:  285, st:'paid', at: Date.now() - 6*24*3600e3},
    {t:'Контент-завод · год · 1',    p:'zavod',   lvl:1, sum: 5220, st:'hold', at: Date.now() - 12*3600e3, name:'Елена'},
    {t:'Клуб OKO · мес · 2',         p:'club',    lvl:2, sum:   95, st:'can',  at: Date.now() - 12*24*3600e3},
    {t:'Система OKO · мес · 1',      p:'sistema', lvl:1, sum:  735, st:'paid', at: Date.now() - 15*24*3600e3},
    {t:'Консалтинг · разбор · 1',    p:'consult', lvl:1, sum: 4500, st:'paid', at: Date.now() - 22*24*3600e3},
    {t:'Контент-завод · год · 1',    p:'zavod',   lvl:1, sum: 5220, st:'paid', at: Date.now() - 29*24*3600e3},
    {t:'Клуб OKO · год · 1',         p:'club',    lvl:1, sum: 3420, st:'paid', at: Date.now() - 34*24*3600e3},
  ];
  const HIST_STATE = {status:'all', product:'all'};

  /* ---------- утилиты формата ---------- */
  function fmtRub(n){
    return Math.round(n).toLocaleString('ru-RU').replace(/,/g,' ') + ' ₽';
  }
  function fmtNum(n){
    return Math.round(n).toLocaleString('ru-RU').replace(/,/g,' ');
  }
  function fmtDate(ts){
    const d = new Date(ts);
    const now = Date.now(), diff = now - ts;
    if(diff < 3600e3) return Math.max(1, Math.round(diff/60e3)) + ' мин назад';
    if(diff < 24*3600e3) return Math.round(diff/3600e3) + ' ч назад';
    if(diff < 7*24*3600e3) return Math.round(diff/(24*3600e3)) + ' дн назад';
    return d.toLocaleDateString('ru-RU', {day:'2-digit', month:'short'});
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ---------- 30 дней динамики для sparkline (детерминированный шум) ---------- */
  function spark30(){
    // амплитуда вокруг среднего = monthEarned / 30
    const avg = PP.monthEarned / 30;
    const arr = [];
    let seed = 20260729;
    function rnd(){ seed ^= seed<<13; seed ^= seed>>>17; seed ^= seed<<5; return ((seed>>>0)%1000)/1000; }
    for(let i=0;i<30;i++){
      const noise = 0.55 + rnd()*0.9;               // 0.55–1.45
      const trend = 0.7 + i/30 * 0.6;               // рост к концу месяца
      arr.push(avg * noise * trend);
    }
    // нормируем сумму к monthEarned
    const total = arr.reduce((s,v)=>s+v,0);
    const scale = PP.monthEarned / total;
    return arr.map(v => Math.round(v * scale));
  }

  /* ================= РЕНДЕР ================= */
  function ppRender(){
    const scr = document.getElementById('screen-partner');
    if(!scr) return;
    if(scr.dataset.ppReady === '1') return;
    const pad = scr.querySelector('.pad');
    if(!pad) return;

    // 0) убираем старый заголовок «Партнёрский кабинет» вводим свой
    const oldH = pad.querySelector('.section-h');
    if(oldH) oldH.remove();

    // 1) прячем базовые блоки (stat-grid, старый график, старая карточка ref, старая карточка начислений, старую кнопку выплаты)
    const legacy = pad.querySelector('.stat-grid');
    if(legacy) legacy.style.display = 'none';
    // старый график
    const legacyChart = pad.querySelector('#chartWrap')?.closest('.card');
    if(legacyChart) legacyChart.style.display = 'none';
    // старая карточка реф-ссылки
    const legacyRef = pad.querySelector('#refInput')?.closest('.card');
    if(legacyRef) legacyRef.style.display = 'none';
    // старая карточка «последние начисления»
    Array.from(pad.querySelectorAll('.card')).forEach(c => {
      if(/Последние начисления/.test(c.innerText||'')) c.style.display = 'none';
    });
    // старая кнопка «Заявка на выплату» (btn.ghost с onclick openPayout)
    Array.from(pad.querySelectorAll('button')).forEach(b => {
      const oc = b.getAttribute('onclick') || '';
      if(oc.includes('openPayout')) b.style.display = 'none';
    });
    // хвостовой spacer
    Array.from(pad.children).forEach(c => {
      if(c.tagName === 'DIV' && !c.className && c.style && c.style.height === '12px') c.style.display = 'none';
    });

    // 2) собираем новый экран одной вставкой в начало
    const root = document.createElement('div');
    root.id = 'ppRoot';
    root.innerHTML = `
      <h2 class="section-h" style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <span>Партнёрская программа</span>
        <span class="chip" style="letter-spacing:.05em">${REF_PCT_FIRST}% · ${REF_PCT_REPEAT}% сверху</span>
      </h2>
      <div id="ppHero"></div>
      <div id="ppLadder"></div>
      <div id="ppCalc"></div>
      <div id="ppDeep" class="card" style="margin-top:12px"></div>
      <div id="ppPromo" class="card" style="margin-top:12px"></div>
      <div id="ppLb" class="card" style="margin-top:12px;padding:14px 0 4px"></div>
      <div id="ppPayoutTop" style="margin-top:12px"></div>
      <div id="ppHistory" class="card" style="margin-top:12px"></div>
      <div id="ppGuide" class="card" style="margin-top:12px"></div>
      <div style="height:14px"></div>
    `;
    pad.insertBefore(root, pad.firstChild);

    // 3) наполнение
    document.getElementById('ppHero').innerHTML = heroHTML();
    renderSpark();
    animateCountUp();

    document.getElementById('ppLadder').innerHTML = tierHTML();

    document.getElementById('ppCalc').innerHTML = calcHTML();
    wireCalc();

    document.getElementById('ppDeep').innerHTML = deepHTML();
    wireDeep();

    document.getElementById('ppPromo').innerHTML = promoHTML();

    document.getElementById('ppLb').innerHTML = leaderboardHTML();

    document.getElementById('ppPayoutTop').innerHTML = payoutTopHTML();

    document.getElementById('ppHistory').innerHTML = historyHTML();
    renderHistoryList();

    document.getElementById('ppGuide').innerHTML = guideHTML();

    scr.dataset.ppReady = '1';

    // 4) первый заход · welcome-модалка
    maybeShowWelcome();
    // 5) плашка живого начисления
    scheduleLiveNotif();
  }

  /* ================= HERO ================= */
  function heroHTML(){
    const delta = PP.monthEarned - PP.monthPrev;
    const deltaPct = PP.monthPrev ? Math.round(delta / PP.monthPrev * 100) : 0;
    const up = delta >= 0;
    const now = new Date();
    const monthName = now.toLocaleDateString('ru-RU', {month:'long'});

    return `<div class="pp-hero">
      <div class="pp-hero-lbl">
        <span>Заработано в ${monthName}</span>
        <span class="pp-hero-tag"><svg class="i"><use href="#i-pp-badge-check"/></svg>активна</span>
      </div>
      <div class="pp-hero-num" id="ppHeroNum">0 <span class="pp-hero-cur">₽</span></div>
      <div class="pp-hero-delta ${up?'':'down'}">
        <svg class="i" style="transform:rotate(${up?0:180}deg)"><use href="#i-pp-up"/></svg>
        <span>${up?'+':''}${fmtRub(delta)} · ${up?'+':''}${deltaPct}% к прошлому месяцу</span>
      </div>
      <div class="pp-hero-spark" id="ppHeroSpark"></div>

      <div class="pp-microstat">
        <div><div class="v">1 284</div><div class="l">клики</div></div>
        <div><div class="v">167</div><div class="l">регистрации</div></div>
        <div><div class="v">31</div><div class="l">оплаты</div></div>
        <div><div class="v lime">${fmtNum(PP.payoutAvail)}<span style="font-size:11px;margin-left:2px">₽</span></div><div class="l">к выплате</div></div>
      </div>

      <div class="pp-sources">
        <div class="pp-sources-h">
          <span>Топ-источники за месяц</span>
          <span class="dim" style="font-size:11px;font-weight:600">клики · оплаты</span>
        </div>
        ${sourcesHTML()}
      </div>

      <div class="pp-hero-cta">
        <button class="btn" onclick="ppCopyRef()"><svg class="i"><use href="#i-copy"/></svg>Скопировать реф-ссылку</button>
        <button class="btn ghost icon-only" onclick="ppOpenQR()" title="QR-код"><svg class="i"><use href="#i-pp-qr"/></svg></button>
        <button class="btn ghost icon-only" onclick="ppShareRef()" title="Поделиться"><svg class="i"><use href="#i-pp-share"/></svg></button>
      </div>
    </div>`;
  }

  function sourcesHTML(){
    const sorted = SOURCES.slice().sort((a,b)=>b.sum-a.sum);
    const top3 = sorted.slice(0,3);
    const totalTop = top3.reduce((s,x)=>s+x.sum,0);
    return top3.map(s=>{
      const pct = Math.round(s.sum/totalTop*100);
      return `<div class="pp-src-row">
        <div class="pp-src-ico s-${s.k}"><svg class="i"><use href="#i-${s.ic}"/></svg></div>
        <div class="pp-src-name">${s.name}<span class="dim"> · ${s.hint}</span></div>
        <div class="pp-src-sum">${fmtRub(s.sum)}</div>
        <div class="pp-src-bar"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('');
  }

  /* Sparkline SVG */
  function renderSpark(){
    const host = document.getElementById('ppHeroSpark');
    if(!host) return;
    const data = spark30();
    const W = 320, H = 56, padX = 4, padT = 4, padB = 4;
    const max = Math.max(...data), min = Math.min(...data);
    const xs = i => padX + i*(W-2*padX)/(data.length-1);
    const ys = v => padT + (1-(v-min)/((max-min)||1))*(H-padT-padB);
    const line = data.map((v,i)=>`${i?'L':'M'}${xs(i).toFixed(1)} ${ys(v).toFixed(1)}`).join(' ');
    const area = `${line} L${xs(data.length-1).toFixed(1)} ${(H-padB).toFixed(1)} L${xs(0).toFixed(1)} ${(H-padB).toFixed(1)} Z`;
    const lx = xs(data.length-1).toFixed(1), ly = ys(data[data.length-1]).toFixed(1);
    host.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs>
          <linearGradient id="ppSparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--lime)" stop-opacity="0.38"/>
            <stop offset="1" stop-color="var(--lime)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#ppSparkGrad)"/>
        <path d="${line}" fill="none" stroke="var(--lime)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle class="spot" cx="${lx}" cy="${ly}" r="3.4"/>
      </svg>`;
  }

  /* Count-up для главной цифры */
  function animateCountUp(){
    const el = document.getElementById('ppHeroNum');
    if(!el) return;
    const to = PP.monthEarned;
    const dur = 1100;
    const start = performance.now();
    function tick(now){
      const t = Math.min(1, (now-start)/dur);
      const eased = 1 - Math.pow(1-t, 3);
      const cur = Math.round(to * eased);
      el.innerHTML = fmtNum(cur) + ' <span class="pp-hero-cur">₽</span>';
      if(t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ================= Turnover-лестница ================= */
  function tierHTML(){
    const {idx, tier, next} = currentTier(PP.turnoverAll);
    const min = tier.min, max = next ? next.min : tier.min * 2;
    const pct = Math.min(100, Math.round((PP.turnoverAll - min) / Math.max(1, max - min) * 100));
    const remaining = next ? Math.max(0, next.min - PP.turnoverAll) : 0;
    const currentPct = REF_PCT_FIRST + tier.bonus;
    const nextPct = next ? REF_PCT_FIRST + next.bonus : currentPct;
    const note = next
      ? `Ещё <b>${fmtRub(remaining)}</b> оборота · и открывается <b>${next.label} +${next.bonus}%</b> сверху · итого <b>${nextPct}%</b> с первой линии.`
      : `Ты в топе программы · <b>+${tier.bonus}% бонус к комиссии</b>, персональный менеджер и приоритетные выплаты за 6-12 часов.`;

    return `<div class="pp-tier">
      <div class="pp-tier-row">
        <div class="pp-tier-name">
          <span class="pp-tier-badge ${tier.k}"><svg class="i"><use href="#i-${tier.badge}"/></svg></span>
          <span>${tier.label}</span>
          <span class="pp-tier-percent">${currentPct}%</span>
        </div>
        <div class="pp-tier-sales"><b>${fmtNum(PP.turnoverAll)}</b> ${next?'/ '+fmtNum(next.min):''} ₽</div>
      </div>
      <div class="pp-tier-bar"><i style="width:${pct}%"></i></div>
      <div class="pp-tier-sub">
        <span>${tier.label} · ${fmtNum(min)}+ ₽</span>
        <span>${next ? next.label + ' · ' + fmtNum(next.min) + '+ ₽' : 'вершина программы'}</span>
      </div>
      <div class="pp-tier-note">${note}</div>
      <div class="pp-ladder">
        ${TIERS.map((t,i)=>{
          const cls = i===idx ? 'on' : (i<idx ? 'done' : '');
          return `<div class="pp-ladder-cell ${cls}" title="${t.label} · +${t.bonus}%">
            <span class="lv-name">${t.label}</span>
            <span class="lv-pct">${REF_PCT_FIRST + t.bonus}%</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  /* ================= Мульти-tier калькулятор ================= */
  const CALC = {product:'sistema', clients:10};
  function calcHTML(){
    return `<div class="pp-calc">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="width:32px;height:32px;border-radius:10px;background:var(--lime-dim);color:var(--accent);display:flex;align-items:center;justify-content:center">
          <svg class="i"><use href="#i-pp-calc"/></svg>
        </div>
        <div>
          <div class="pp-calc-h">Калькулятор дохода</div>
          <div class="pp-calc-sub">Посмотри, сколько принесёт партнёрка на твоём объёме.</div>
        </div>
      </div>
      <div class="pp-calc-prod" id="ppCalcProd">
        ${PP.products.filter(p=>p.k!=='all').map(p=>`
          <button data-p="${p.k}" class="${CALC.product===p.k?'on':''}">${p.label}</button>
        `).join('')}
      </div>
      <div class="pp-calc-row">
        <div>
          <div class="pp-calc-label">Клиентов в месяц</div>
          <input type="range" class="pp-calc-slider" min="1" max="200" value="${CALC.clients}" id="ppCalcSlider">
        </div>
        <div class="pp-calc-stepper">
          <button onclick="ppCalcStep(-1)" type="button" aria-label="меньше">-</button>
          <span class="val" id="ppCalcVal">${CALC.clients}</span>
          <button onclick="ppCalcStep(1)" type="button" aria-label="больше">+</button>
        </div>
      </div>
      <div id="ppCalcResult"></div>
      <div class="pp-calc-hint">Пример: 10 клиентов на PRO 4 900 ₽ → +${fmtNum(10*4900*(REF_PCT_FIRST+REF_PCT_REPEAT)/100)} ₽/мес пассивно.</div>
    </div>`;
  }
  function calcResultHTML(){
    const p = PP.products.find(x=>x.k===CALC.product);
    if(!p) return '';
    const {tier} = currentTier(PP.turnoverAll);
    const bonusPct = tier.bonus;
    const first = CALC.clients * p.price * (REF_PCT_FIRST + bonusPct) / 100;
    const repeat = CALC.clients * p.price * (REF_PCT_REPEAT) / 100;
    const l2 = CALC.clients * 0.4 * p.price * (REF_PCT_L2) / 100;   // 40% приведут второго
    const total = first + repeat + l2;

    return `<div class="pp-calc-result">
      <div class="pp-calc-result-line"><span>Первая оплата · ${REF_PCT_FIRST + bonusPct}%</span><b>${fmtRub(first)}</b></div>
      <div class="pp-calc-result-line"><span>Повторные · ${REF_PCT_REPEAT}%</span><b>${fmtRub(repeat)}</b></div>
      <div class="pp-calc-result-line"><span>2-я линия · ${REF_PCT_L2}%</span><b>${fmtRub(l2)}</b></div>
      <div class="pp-calc-result-total">
        <span>Итого в месяц</span>
        <b>+${fmtRub(total)}</b>
      </div>
    </div>`;
  }
  function updateCalc(){
    const r = document.getElementById('ppCalcResult');
    if(r) r.innerHTML = calcResultHTML();
    const v = document.getElementById('ppCalcVal');
    if(v) v.textContent = CALC.clients;
    const s = document.getElementById('ppCalcSlider');
    if(s && +s.value !== CALC.clients) s.value = CALC.clients;
  }
  window.ppCalcStep = function(delta){
    CALC.clients = Math.max(1, Math.min(500, CALC.clients + delta));
    updateCalc();
  };
  function wireCalc(){
    const s = document.getElementById('ppCalcSlider');
    if(s) s.addEventListener('input', e => { CALC.clients = +e.target.value; updateCalc(); });
    const prod = document.getElementById('ppCalcProd');
    if(prod) prod.addEventListener('click', e => {
      const b = e.target.closest('button[data-p]'); if(!b) return;
      CALC.product = b.dataset.p;
      prod.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
      updateCalc();
    });
    updateCalc();
  }

  /* ================= Реф-ссылки (дип-линки) ================= */
  function baseRef(){ return 'okoteam.top/r/' + PP.nick; }
  function currentRef(){
    const p = PP.activeProduct;
    if(!p || p==='all') return baseRef();
    // короткий формат /r/<nick>/<product>
    return baseRef() + '/' + p;
  }
  function deepHTML(){
    return `<div class="pp-section-h">
        <p>Твоя реф-ссылка</p>
        <span class="chip">${REF_PCT_FIRST}% · +${REF_PCT_REPEAT}%</span>
      </div>
      <p class="dim" style="font-size:12.5px;margin-top:0;margin-bottom:10px">
        Свой короткий адрес на каждый продукт OKO · ведёт сразу на нужный оффер.
      </p>
      <div class="pp-deep">
        <div class="pp-deep-tabs" id="ppDeepTabs">
          ${PP.products.map(p=>`<button data-p="${p.k}" class="${p.k===PP.activeProduct?'on':''}">
            ${p.dot?'<span class="dot"></span>':''}${p.label}
          </button>`).join('')}
        </div>
        <div class="reflink">
          <input value="${currentRef()}" readonly id="ppRefInput">
        </div>
        <div class="pp-ref-actions">
          <button class="btn sm" onclick="ppCopyRef()"><svg class="i"><use href="#i-copy"/></svg>Копировать</button>
          <button class="btn ghost icon-only" onclick="ppOpenQR()" title="QR-код"><svg class="i"><use href="#i-pp-qr"/></svg></button>
          <button class="btn ghost icon-only" onclick="ppShareRef()" title="Поделиться"><svg class="i"><use href="#i-pp-share"/></svg></button>
        </div>
        <p class="pp-ref-hint" id="ppRefHint">Общий адрес: ведёт на главную OKO. Выбери продукт выше · получишь короткую дип-ссылку.</p>
      </div>`;
  }
  function wireDeep(){
    const tabs = document.getElementById('ppDeepTabs');
    if(!tabs) return;
    tabs.addEventListener('click', e=>{
      const b = e.target.closest('button[data-p]');
      if(!b) return;
      PP.activeProduct = b.dataset.p;
      tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
      const inp = document.getElementById('ppRefInput');
      if(inp) inp.value = currentRef();
      // держим old base-input в синхроне, чтобы старая copyRef из base работала корректно
      const legacyInp = document.querySelector('#screen-partner input#refInput');
      if(legacyInp) legacyInp.value = currentRef();
      const hint = document.getElementById('ppRefHint');
      const p = PP.products.find(x=>x.k===PP.activeProduct);
      if(hint) hint.innerHTML = p && p.desc
        ? `<b style="color:var(--accent)">${p.label}</b> · ${p.desc} · дип-линк открывает страницу оплаты сразу.`
        : `Общий адрес: ведёт на главную OKO. Выбери продукт выше · получишь короткую дип-ссылку.`;
    });
  }
  window.ppCopyRef = function(){
    const inp = document.getElementById('ppRefInput');
    const val = inp ? inp.value : currentRef();
    if(inp){ try{ inp.select(); }catch(e){} }
    try{ navigator.clipboard.writeText(val); }catch(e){ try{ document.execCommand('copy'); }catch(_){} }
    if(typeof toast === 'function') toast('Реф-ссылка скопирована');
  };
  window.ppShareRef = function(){
    const url = document.getElementById('ppRefInput')?.value || currentRef();
    if(navigator.share){
      navigator.share({title:'OKO', text:'Заходи в OKO по моей ссылке', url:'https://'+url}).catch(()=>{});
    } else {
      try{ navigator.clipboard.writeText('https://'+url); }catch(e){}
      if(typeof toast === 'function') toast('Ссылка для расшаривания скопирована');
    }
  };

  /* ---------- QR: SVG, детерминированный от URL ---------- */
  function qrSvg(text){
    const N = 29;
    let seed = 2166136261;
    for(let i=0;i<text.length;i++){ seed ^= text.charCodeAt(i); seed = (seed*16777619)>>>0; }
    function rnd(){ seed ^= seed<<13; seed ^= seed>>>17; seed ^= seed<<5; return ((seed>>>0)%1000)/1000; }
    const cells = [];
    for(let y=0;y<N;y++){
      const row = [];
      for(let x=0;x<N;x++) row.push(rnd() < 0.48 ? 1 : 0);
      cells.push(row);
    }
    for(let i=8;i<N-8;i++){ cells[6][i] = i%2===0?1:0; cells[i][6] = i%2===0?1:0; }
    function finder(cy, cx){
      for(let dy=-1;dy<=7;dy++) for(let dx=-1;dx<=7;dx++){
        const y=cy+dy, x=cx+dx; if(y<0||y>=N||x<0||x>=N) continue;
        cells[y][x] = 0;
      }
      for(let dy=0;dy<7;dy++) for(let dx=0;dx<7;dx++){
        const y=cy+dy, x=cx+dx;
        const inner = dy>=2 && dy<=4 && dx>=2 && dx<=4;
        const outer = dy===0 || dy===6 || dx===0 || dx===6;
        cells[y][x] = (inner||outer) ? 1 : 0;
      }
    }
    finder(0,0); finder(0,N-7); finder(N-7,0);
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
      const y=N-5+dy, x=N-5+dx;
      const outer = Math.abs(dy)===2 || Math.abs(dx)===2;
      const center = dy===0 && dx===0;
      cells[y][x] = (outer||center) ? 1 : 0;
    }
    const size = 232, pad = 6, cell = (size - pad*2) / N;
    let rects = '';
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){
      if(!cells[y][x]) continue;
      rects += `<rect x="${(pad+x*cell).toFixed(2)}" y="${(pad+y*cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
    }
    const c = size/2, r = 22;
    const brand = `<circle cx="${c}" cy="${c}" r="${r+2}" fill="#fff"/>
      <circle cx="${c}" cy="${c}" r="${r-2}" fill="#000"/>
      <circle cx="${c}" cy="${c}" r="8" fill="#9AFF00"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#fff"/>
      <g fill="#000">${rects}</g>${brand}
    </svg>`;
  }
  window.ppOpenQR = function(){
    const url = currentRef();
    document.getElementById('ppQrView').innerHTML = `
      <h3>QR-код твоей ссылки</h3>
      <div class="pp-qr-wrap">
        <div class="pp-qr">${qrSvg(url)}</div>
        <div class="pp-qr-url">${url}</div>
        <div class="pp-qr-tip">Покажи на встрече, наклей на визитку, встрой в сторис.</div>
      </div>
      <div style="height:12px"></div>
      <button class="btn" onclick="ppCopyRef()"><svg class="i"><use href="#i-copy"/></svg>Скопировать ссылку</button>`;
    if(typeof openSheet === 'function') openSheet('pp-qr');
  };

  /* ================= Промо-материалы ================= */
  const PROMO_STATE = {kind:'all'};
  function promoHTML(){
    return `<div class="pp-section-h">
        <p>Готовые промо-материалы</p>
        <span class="chip">${PROMO.length} шт.</span>
      </div>
      <p class="dim" style="font-size:12.5px;margin-bottom:0;margin-top:0">
        Тексты, баннеры и Reels-сценарии · копируй в 1 клик · реф-ссылка подставляется автоматически.
      </p>
      <div class="pp-promo-tabs" id="ppPromoTabs">
        <button data-kind="all" class="on">Все · ${PROMO.length}</button>
        <button data-kind="text">Тексты · ${PROMO.filter(p=>p.kind==='text').length}</button>
        <button data-kind="banner">Баннеры · ${PROMO.filter(p=>p.kind==='banner').length}</button>
        <button data-kind="reels">Reels-сценарии · ${PROMO.filter(p=>p.kind==='reels').length}</button>
      </div>
      <div class="pp-promo-grid" id="ppPromoGrid"></div>`;
  }
  function renderPromoGrid(){
    const grid = document.getElementById('ppPromoGrid');
    if(!grid) return;
    const list = PROMO_STATE.kind==='all' ? PROMO : PROMO.filter(p => p.kind === PROMO_STATE.kind);
    if(!list.length){ grid.innerHTML = `<div class="pp-hist-empty" style="grid-column:1/-1">По этому фильтру пусто.</div>`; return; }
    grid.innerHTML = list.map(p => {
      const i = PROMO.indexOf(p);
      const kindTag = p.kind==='reels' ? 'reels' : (p.kind==='banner' ? 'banner' : '');
      return `<div class="pp-promo-card" onclick="ppOpenPromo(${i})">
        <div class="pp-promo-thumb ${p.gr}">
          <span class="pp-promo-fmt">${p.fmt}</span>
          <div>
            <div class="pp-promo-h">${p.h}</div>
            <div class="pp-promo-sub">${p.sub}</div>
          </div>
          <div class="pp-promo-logo">OKO</div>
        </div>
        <div class="pp-promo-meta">
          <span class="pp-promo-kind-tag ${kindTag}">${p.tag}</span>
          <span class="dim">${p.kind==='reels'?'сценарий':(p.kind==='banner'?'баннер':'текст')}</span>
        </div>
      </div>`;
    }).join('');
  }
  document.addEventListener('click', e=>{
    const kb = e.target.closest('#ppPromoTabs button[data-kind]');
    if(!kb) return;
    PROMO_STATE.kind = kb.dataset.kind;
    kb.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===kb));
    renderPromoGrid();
  });
  // отрисовываем grid отдельно после первичного рендера
  const _oldRender = ppRender;
  const _renderGridSoon = () => setTimeout(renderPromoGrid, 0);
  window.ppOpenPromo = function(i){
    const p = PROMO[i]; if(!p) return;
    const ref = currentRef();
    let body = '';
    if(p.kind === 'reels' && p.scenes){
      body = p.scenes.map(s=>`
        <div class="pp-scene">
          <div class="pp-scene-h"><span class="n">${s.n}</span><span class="t">${s.t}</span></div>
          <div class="pp-scene-txt">${escapeHtml(s.body)}</div>
          <div class="pp-scene-vo"><b style="color:var(--accent)">Озвучка:</b> ${escapeHtml(s.vo)}</div>
        </div>`).join('') +
        `<p style="font-weight:700;font-size:13px;margin:8px 0 6px">Общие параметры</p>
         <div class="pp-promo-copy">${escapeHtml(p.copy.replace(/\{ref\}/g, ref))}</div>`;
    } else {
      body = `<p style="font-weight:700;font-size:13px;margin-bottom:6px">Готовый текст</p>
              <div class="pp-promo-copy">${escapeHtml(p.copy.replace(/\{ref\}/g, ref))}</div>`;
    }
    document.getElementById('ppPromoView').innerHTML = `
      <h3>${p.h}</h3>
      <p class="dim" style="font-size:12px">${p.sub} · ${p.fmt}</p>
      <div class="pp-promo-preview pp-promo-thumb ${p.gr}">
        <div>
          <div class="pp-promo-h" style="font-size:20px">${p.h}</div>
          <div class="pp-promo-sub" style="margin-top:8px">${p.sub}</div>
        </div>
        <div class="pp-promo-logo">OKO</div>
      </div>
      ${body}
      <div class="pp-promo-actions">
        <button class="btn" onclick="ppCopyPromo(${i})"><svg class="i"><use href="#i-copy"/></svg>Скопировать</button>
        <button class="btn ghost" onclick="ppSavePromo(${i})"><svg class="i"><use href="#i-bookmark"/></svg>В избранное</button>
      </div>
      <p class="dim" style="font-size:11.5px;margin-top:12px;text-align:center">Реф-ссылка подставится автоматически: ${ref}</p>`;
    if(typeof openSheet === 'function') openSheet('pp-promo');
  };
  window.ppCopyPromo = function(i){
    const p = PROMO[i]; if(!p) return;
    const ref = currentRef();
    let text;
    if(p.kind === 'reels' && p.scenes){
      text = `${p.h} · ${p.sub} · ${p.fmt}\n\n` +
             p.scenes.map(s => `${s.n} · ${s.t}\n${s.body}\nОзвучка: ${s.vo}`).join('\n\n') +
             `\n\n---\n${p.copy.replace(/\{ref\}/g, ref)}`;
    } else {
      text = p.copy.replace(/\{ref\}/g, ref);
    }
    try{ navigator.clipboard.writeText(text); }catch(e){}
    if(typeof toast === 'function') toast('Скопировано в буфер');
  };
  window.ppSavePromo = function(){
    if(typeof toast === 'function') toast('Сохранено в избранное');
  };

  /* ================= Wall of Fame ================= */
  function leaderboardHTML(){
    const sorted = LEADERS.slice().sort((a,b)=>b.sum-a.sum);
    const myIdx = sorted.findIndex(l=>l.nick===PP.nick);
    return `<div class="pp-section-h padded">
        <p>Wall of Fame · неделя</p>
        <span class="chip">твоё место · ${myIdx+1}</span>
      </div>
      <div class="pp-lb">
        ${sorted.slice(0,10).map((l,i)=>{
          const cls = i===0?'top1':(i===1?'top2':(i===2?'top3':''));
          const you = l.nick===PP.nick ? 'you' : '';
          const av = l.nick[0].toUpperCase();
          const tierLbl = (TIERS.find(t=>t.k===l.tier)||{}).label || '';
          return `<div class="pp-lb-row ${cls} ${you}">
            <div class="pp-lb-place">${i+1}</div>
            <div class="pp-lb-nick">
              <span class="pp-lb-ava">${av}</span>
              <span>@${l.nick}</span>
              <span class="pp-lb-tier ${l.tier}">${tierLbl}</span>
            </div>
            <div class="pp-lb-sum">${fmtRub(l.sum)}</div>
          </div>`;
        }).join('')}
      </div>
      <p class="dim" style="font-size:11.5px;text-align:center;padding:10px 14px 4px">
        Рейтинг обновляется каждый понедельник · топ-10 недели.
      </p>`;
  }

  /* ================= Выплаты: hero + sheet ================= */
  function payoutTopHTML(){
    const enough = PP.payoutAvail >= PP.payoutMin;
    return `<div class="pp-payout-hero">
      <div style="min-width:0;flex:1 1 auto">
        <div class="lbl">Доступно к выводу</div>
        <div class="sum"><b>${fmtNum(PP.payoutAvail)}</b> ₽</div>
        <div class="pp-payout-hint">
          <svg class="i"><use href="#i-clock"/></svg>
          <span>Средний срок выплаты · 24-48 часов</span>
        </div>
      </div>
      <div class="cta">
        <button class="btn" onclick="ppOpenPayout()" ${enough?'':'disabled'}>
          ${enough ? 'Запросить' : `от ${fmtRub(PP.payoutMin)}`}
        </button>
      </div>
    </div>`;
  }

  const PAY = {method:'card'};
  const PAY_METHODS = [
    {k:'card',   label:'Карта РФ', icon:'card'},
    {k:'usdt',   label:'USDT · TRC-20', icon:'pp-usdt'},
    {k:'lava',   label:'Lava.top', icon:'bolt'},
  ];
  function payoutSheetHTML(){
    return `<h3>Запросить выплату</h3>
      <div class="pp-payout-summary">
        <div><div class="lb">Сумма к выводу</div><div class="sm">${fmtRub(PP.payoutAvail)}</div></div>
        <span class="chip">мин. ${fmtNum(PP.payoutMin)} ₽</span>
      </div>
      <p style="font-weight:700;font-size:13px;margin-bottom:6px">Куда вывести</p>
      <div class="pp-payout-method" id="ppPayMethod">
        ${PAY_METHODS.map(m=>`
          <button data-m="${m.k}" class="${PAY.method===m.k?'on':''}" type="button">
            <svg class="i"><use href="#i-${m.icon}"/></svg>
            <span>${m.label}</span>
          </button>`).join('')}
      </div>
      <input id="ppPayReq" placeholder="${payoutPlaceholder()}">
      <button class="btn" onclick="ppDoPayout()">
        <svg class="i"><use href="#i-card"/></svg>Запросить ${fmtRub(PP.payoutAvail)}
      </button>
      <p class="dim" style="font-size:11.5px;margin-top:10px;text-align:center">
        Выплата поступит в течение 24-48 часов. Комиссия · 0 ₽ для сумм от 1 000 ₽.
      </p>`;
  }
  function payoutPlaceholder(){
    return PAY.method==='usdt' ? 'Адрес кошелька USDT (TRC-20)'
         : PAY.method==='lava' ? 'Аккаунт Lava.top / e-mail'
         : 'Номер карты · 16 цифр';
  }
  window.ppOpenPayout = function(){
    PAY.method = 'card';
    const host = document.getElementById('ppPayoutView');
    if(!host) return;
    host.innerHTML = payoutSheetHTML();
    if(typeof openSheet === 'function') openSheet('pp-payout');
    // клики по методам
    const meth = document.getElementById('ppPayMethod');
    if(meth) meth.addEventListener('click', e=>{
      const b = e.target.closest('button[data-m]'); if(!b) return;
      PAY.method = b.dataset.m;
      meth.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
      const inp = document.getElementById('ppPayReq');
      if(inp) inp.placeholder = payoutPlaceholder();
    });
  };
  window.ppDoPayout = function(){
    const inp = document.getElementById('ppPayReq');
    const req = (inp && inp.value || '').trim();
    if(!req){
      if(typeof toast === 'function') toast('Укажи реквизиты');
      if(inp) inp.focus();
      return;
    }
    document.getElementById('ppPayoutView').innerHTML = `
      <div style="text-align:center;padding:16px 0">
        <div class="pay-ok" style="width:64px;height:64px;border-radius:50%;background:var(--lime);color:#000;display:inline-flex;align-items:center;justify-content:center;margin:0 auto">
          <svg class="i" style="width:32px;height:32px"><use href="#i-check"/></svg>
        </div>
        <p style="font-weight:800;font-size:18px;margin-top:12px">Заявка принята</p>
        <p class="dim" style="font-size:13px;margin-top:6px">
          ${fmtRub(PP.payoutAvail)} придут на
          ${{card:'карту',usdt:'кошелёк USDT',lava:'Lava.top'}[PAY.method]}
          в течение 24-48 часов.
        </p>
        <div style="height:16px"></div>
        <button class="btn" onclick="closeSheet()">Готово</button>
      </div>`;
    if(typeof toast === 'function') toast('Заявка на ' + fmtRub(PP.payoutAvail) + ' создана');
  };

  /* ================= История начислений с фильтром ================= */
  function historyHTML(){
    const products = ['all', ...Array.from(new Set(HIST.map(h=>h.p)))];
    const productLabel = (k)=> {
      if(k==='all') return 'Все продукты';
      const p = PP.products.find(x=>x.k===k);
      return p ? p.label : k;
    };
    const statuses = [['all','Все'],['paid','Выплачено'],['hold','Ожидают'],['can','Отменено']];
    return `<div class="pp-section-h">
        <p>История начислений</p>
        <span class="chip" id="ppHistCount"></span>
      </div>
      <div class="pp-hist-filters" id="ppHistStatus">
        ${statuses.map(([k,l])=>`<button data-s="${k}" class="${k===HIST_STATE.status?'on':''}">${l}</button>`).join('')}
      </div>
      <div class="pp-hist-filters" id="ppHistProduct">
        ${products.map(p=>`<button data-p="${p}" class="${p===HIST_STATE.product?'on':''}">${productLabel(p)}</button>`).join('')}
      </div>
      <div id="ppHistList"></div>`;
  }
  function renderHistoryList(){
    const list = document.getElementById('ppHistList');
    const cnt = document.getElementById('ppHistCount');
    if(!list) return;
    const filtered = HIST.filter(h =>
      (HIST_STATE.status==='all' || h.st===HIST_STATE.status) &&
      (HIST_STATE.product==='all' || h.p===HIST_STATE.product)
    ).sort((a,b)=>b.at-a.at);
    if(cnt) cnt.textContent = filtered.length + ' начисл.';
    if(!filtered.length){
      list.innerHTML = `<div class="pp-hist-empty">По этим фильтрам ничего нет.</div>`;
      return;
    }
    const stLabel = {paid:'Выплачено', hold:'Ожидает', can:'Отменено'};
    list.innerHTML = filtered.map(h=>`
      <div class="pp-hist-row">
        <div>
          <div class="pp-hist-t">${escapeHtml(h.t)}</div>
          <div class="pp-hist-m">
            <span>${fmtDate(h.at)}</span>
            <span class="pp-hist-st ${h.st}">${stLabel[h.st]}</span>
            ${h.name?`<span>от · ${escapeHtml(h.name)}</span>`:''}
          </div>
        </div>
        <div class="pp-hist-sum">${h.st==='can'?'-':'+'+fmtRub(h.sum)}</div>
      </div>`).join('');
  }
  document.addEventListener('click', e=>{
    const bp = e.target.closest('#ppHistProduct button[data-p]');
    if(bp){
      HIST_STATE.product = bp.dataset.p;
      bp.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===bp));
      renderHistoryList();
      return;
    }
    const bs = e.target.closest('#ppHistStatus button[data-s]');
    if(bs){
      HIST_STATE.status = bs.dataset.s;
      bs.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===bs));
      renderHistoryList();
    }
  });

  /* ================= 3-шаговый гайд ================= */
  function guideHTML(){
    return `<div class="pp-section-h">
        <p>Как начать · за 3 шага</p>
        <span class="chip">2 минуты</span>
      </div>
      <div class="pp-guide">
        <div class="pp-guide-step">
          <span class="pp-guide-num">01</span>
          <div class="pp-guide-ic"><svg class="i"><use href="#i-copy"/></svg></div>
          <div class="pp-guide-h">Скопируй ссылку</div>
          <div class="pp-guide-t">Общая или на конкретный продукт · выбирай тариф над списком.</div>
        </div>
        <div class="pp-guide-step">
          <span class="pp-guide-num">02</span>
          <div class="pp-guide-ic"><svg class="i"><use href="#i-megaphone"/></svg></div>
          <div class="pp-guide-h">Расскажи</div>
          <div class="pp-guide-t">Бери готовые тексты, баннеры и Reels-сценарии из промо-пака выше.</div>
        </div>
        <div class="pp-guide-step">
          <span class="pp-guide-num">03</span>
          <div class="pp-guide-ic"><svg class="i"><use href="#i-card"/></svg></div>
          <div class="pp-guide-h">Получи выплату</div>
          <div class="pp-guide-t">От 1 000 ₽ на Lava, USDT или карту РФ. 24-48 часов на зачисление.</div>
        </div>
      </div>`;
  }

  /* ================= Onboarding welcome (первый заход) ================= */
  const WELCOME_KEY = 'pp-welcome-shown-v1';
  function maybeShowWelcome(){
    try{
      if(localStorage.getItem(WELCOME_KEY) === '1') return;
      // задержка · чтобы welcome не мешал открытию экрана
      setTimeout(showWelcome, 350);
    }catch(e){}
  }
  function showWelcome(){
    const host = document.getElementById('ppWelcomeView');
    if(!host) return;
    host.innerHTML = `<div class="pp-welcome">
      <div class="pp-welcome-hero">
        <span class="pp-welcome-badge">
          <svg class="i" style="width:12px;height:12px"><use href="#i-pp-badge-check"/></svg>
          Партнёрская программа
        </span>
        <div class="pp-welcome-num">${REF_PCT_FIRST}%</div>
        <div class="pp-welcome-h">С каждой оплаты твоих клиентов</div>
      </div>
      <ul class="pp-welcome-list">
        <li>
          <span class="pp-w-ic"><svg class="i"><use href="#i-pp-badge-check"/></svg></span>
          <span><b>${REF_PCT_FIRST}%</b> с первой оплаты + <b>${REF_PCT_REPEAT}%</b> со всех повторных · до <b>25%</b> на топ-уровнях</span>
        </li>
        <li>
          <span class="pp-w-ic"><svg class="i"><use href="#i-users"/></svg></span>
          <span>Ещё <b>+${REF_PCT_L2}%</b> со 2-й линии · когда твой клиент приведёт своих</span>
        </li>
        <li>
          <span class="pp-w-ic"><svg class="i"><use href="#i-card"/></svg></span>
          <span>Выплаты от <b>${fmtNum(PP.payoutMin)} ₽</b> на карту РФ, USDT или Lava · <b>24-48 часов</b></span>
        </li>
        <li>
          <span class="pp-w-ic"><svg class="i"><use href="#i-pp-gift"/></svg></span>
          <span>Готовые <b>промо-материалы</b> для соцсетей · тексты, баннеры и Reels-сценарии</span>
        </li>
      </ul>
      <div class="pp-welcome-actions">
        <button class="btn" onclick="ppCloseWelcome(true)">
          <svg class="i"><use href="#i-copy"/></svg>Скопировать реф-ссылку и начать
        </button>
        <button class="btn ghost" onclick="ppCloseWelcome(false)">Осмотреться сначала</button>
      </div>
    </div>`;
    if(typeof openSheet === 'function') openSheet('pp-welcome');
    try{ localStorage.setItem(WELCOME_KEY, '1'); }catch(e){}
  }
  window.ppCloseWelcome = function(copy){
    if(copy){
      try{ navigator.clipboard.writeText(currentRef()); }catch(e){}
      if(typeof toast === 'function') toast('Реф-ссылка скопирована · погнали!');
    }
    if(typeof closeSheet === 'function') closeSheet();
  };

  /* ================= Live-уведомление ================= */
  const LIVE_MSGS = [
    {t:'+735 ₽ от клиента Иван',    s:'Система OKO · мес · 1-я линия'},
    {t:'+1 500 ₽ от Елены',         s:'Консалтинг · 2-я линия'},
    {t:'+435 ₽ от Максима',         s:'Контент-завод · мес'},
    {t:'+6 350 ₽ от Ольги',         s:'PRO год · крупная оплата'},
  ];
  function scheduleLiveNotif(){
    if(window.__ppLivePlanned) return;
    window.__ppLivePlanned = true;
    setTimeout(()=>showLive(LIVE_MSGS[0]), 8000);
    setTimeout(()=>showLive(LIVE_MSGS[Math.floor(Math.random()*LIVE_MSGS.length)]), 45000);
  }
  function showLive(msg){
    const el = document.getElementById('ppLive');
    if(!el) return;
    document.getElementById('ppLiveT').innerHTML =
      msg.t.replace(/(\+[\d\s]+ ₽)/, '<b>$1</b>');
    document.getElementById('ppLiveS').textContent = msg.s;
    el.classList.add('on');
    clearTimeout(showLive._t);
    showLive._t = setTimeout(()=>el.classList.remove('on'), 6000);
  }
  window.ppHideLive = function(){
    const el = document.getElementById('ppLive');
    if(el) el.classList.remove('on');
    clearTimeout(showLive._t);
  };

  /* ---------- init ---------- */
  const _showTab = window.showTab;
  if(typeof _showTab === 'function'){
    window.showTab = function(t){
      const r = _showTab.apply(this, arguments);
      if(t === 'partner') { ppRender(); setTimeout(renderPromoGrid, 0); }
      return r;
    };
  }
  document.addEventListener('DOMContentLoaded', ()=>{ ppRender(); renderPromoGrid(); });
  setTimeout(()=>{ ppRender(); renderPromoGrid(); }, 100);
  setTimeout(()=>{ ppRender(); renderPromoGrid(); }, 600);
})();
