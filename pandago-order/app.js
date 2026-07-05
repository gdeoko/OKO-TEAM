/* ═══════════════════════════════════════════════════════════════
   PandaGo Order Site · Frontend Logic
   Стиль: светлый (#1db954 / #fff / #f5f5f5)
   Все данные из реального прайса pandago-PRICE_new.xlsx
   Формула цены: (USD_price + USD_delivery) × 95₽ (курс)
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── SVG ICON POOL ── */
const ICONS = {
  quad:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 12h8M6 15l-3 3M18 15l3 3M6 8c0-1.5 1-3 3-3h6c2 0 3 1.5 3 3v4H6V8z"/><circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/></svg>',
  moto:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M14 17H8l-2-5h8l2 5zM14 12l2-5h3M8 12L6 7"/></svg>',
  jet:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M4 13l3-7 5 3 5-3 3 7M8 6l2 3M14 6l-2 3"/></svg>',
  buggy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 13l2-4h14l2 4v4h-3M3 13v4h3M9 17h6"/><circle cx="6" cy="17" r="2"/><circle cx="18" cy="17" r="2"/><path d="M5 9l1-3h12l1 3"/></svg>',
  snow:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 17h2l3-5h10l3 5h2M6 12V7h12v5M9 17v-3M15 17v-3"/></svg>',
  equip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 10v6M4.22 4.22l4.24 4.24m7.08 7.08l4.24 4.24M1 12h6m10 0h6M4.22 19.78l4.24-4.24m7.08-7.08l4.24-4.24"/></svg>',
  cash:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
  bank:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>',
  crypto:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>',
  any:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
  msk:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 22V4a1 1 0 011-1h10a1 1 0 011 1v18M8 22v-5M16 22v-5M9 7h1M14 7h1M9 11h1M14 11h1M2 22h20"/></svg>',
  spb:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M6 21v-6M18 21v-6M4 15h16l-2-8H6l-2 8zM12 3v4"/></svg>',
  south: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  pin:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  tg:    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.5 4.5L2.5 12l6.5 2 2 6.5L21.5 4.5zM10 15l-1.5-5 10-4.5L10 15z"/></svg>',
  calc:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="14" y2="14"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  shield:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  price: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>',
  b2b:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 12h.01M15 12h.01M9 15h.01M15 15h.01M9 18h.01M15 18h.01"/></svg>',
  info:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  chat:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
  star:  '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
};

/* ── CATALOG DATA (реальный прайс, курс 95₽) ── */
/* Формула: rub = ceil((usd + ship) * 95 / 1000) * 1000 */
const CATALOG = {
  quad: [
    {name:'CFmoto CFORCE 1000 MV',            usd:12500, ship:1820, rub:1361000},
    {name:'CFmoto CFORCE 800 HO EPS LTD',     usd:11785, ship:1715, rub:1283000},
    {name:'LONCIN XWOLF 1000 MUD',            usd:11310, ship:1855, rub:1251000},
    {name:'LONCIN XWOLF 1000',                usd:10955, ship:1785, rub:1210000},
    {name:'LONCIN XWOLF 700L MUD',            usd:6600,  ship:1600, rub:779000},
    {name:'LONCIN XWOLF 700L',                usd:6215,  ship:1550, rub:738000},
    {name:'LONCIN XWOLF 500L',                usd:5285,  ship:1450, rub:640000},
    {name:'Polaris Sportsman XP 1000 S',      usd:15420, ship:2050, rub:1660000},
    {name:'Polaris Sportsman 570',            usd:8012,  ship:1400, rub:894000},
    {name:'Yamaha Grizzly 700',               usd:12100, ship:1810, rub:1323000},
    {name:'Yamaha Kodiak 700',                usd:9640,  ship:1690, rub:1076000},
    {name:'Honda TRX520',                     usd:9250,  ship:1660, rub:1037000},
    {name:'Kawasaki Brute Force 750',         usd:10420, ship:1770, rub:1163000},
    {name:'Segway Snarler AT6 LT',            usd:6890,  ship:1580, rub:805000},
    {name:'CFmoto CFORCE 450',                usd:5250,  ship:1440, rub:636000},
  ],
  moto: [
    {name:'Sur-Ron Light Bee X',              usd:2051,  ship:263,  rub:220000},
    {name:'Sur-Ron Ultra Bee',                usd:4002,  ship:385,  rub:417000},
    {name:'Sur-Ron Storm Bee',                usd:5414,  ship:543,  rub:566000},
    {name:'Talaria Sting TL5500',             usd:3450,  ship:340,  rub:361000},
    {name:'Talaria XXX',                      usd:3820,  ship:365,  rub:398000},
    {name:'KTM EXC 250',                      usd:7900,  ship:520,  rub:800000},
    {name:'KTM EXC-F 350',                    usd:9250,  ship:530,  rub:930000},
    {name:'Yamaha WR250F',                    usd:7420,  ship:510,  rub:754000},
    {name:'Yamaha YZ250F',                    usd:8100,  ship:515,  rub:819000},
    {name:'Honda CRF 250L',                   usd:5980,  ship:470,  rub:613000},
    {name:'Honda CRF 450R',                   usd:9450,  ship:540,  rub:950000},
    {name:'Kawasaki KX 250',                  usd:8250,  ship:518,  rub:833000},
    {name:'Kawasaki KLX 250',                 usd:5850,  ship:465,  rub:600000},
    {name:'GR8 F250 (эндуро)',                usd:2150,  ship:340,  rub:237000},
    {name:'Kews K16 NC450',                   usd:1980,  ship:335,  rub:220000},
    {name:'Kews K16 EC300 (2-такт)',          usd:1750,  ship:315,  rub:196000},
    {name:'NIU RQi Sport',                    usd:2820,  ship:295,  rub:296000},
    {name:'Super Soco TSX',                   usd:3120,  ship:305,  rub:326000},
    {name:'Super Soco TC Max',                usd:2950,  ship:295,  rub:309000},
    {name:'Zero SR/S',                        usd:19900, ship:720,  rub:1959000},
    {name:'Zero SR/F',                        usd:21200, ship:740,  rub:2084000},
    {name:'BMW G310GS',                       usd:5450,  ship:490,  rub:565000},
    {name:'CFmoto 800MT',                     usd:8850,  ship:590,  rub:897000},
    {name:'CFmoto 450SR',                     usd:5150,  ship:470,  rub:534000},
    {name:'CFmoto 650NK',                     usd:6250,  ship:490,  rub:641000},
    {name:'Voge 500DS',                       usd:5150,  ship:470,  rub:534000},
    {name:'Benelli TRK 502X',                 usd:5850,  ship:490,  rub:603000},
  ],
  jet: [
    {name:'Sea-Doo RXP-X 325',                usd:30579, ship:1470, rub:3045000},
    {name:'Sea-Doo GTX Limited 300',          usd:36474, ship:1680, rub:3625000},
    {name:'Sea-Doo Fish Pro Trophy',          usd:26923, ship:1750, rub:2724000},
    {name:'Sea-Doo GTI 170',                  usd:17948, ship:1365, rub:1835000},
    {name:'Sea-Doo GTI 130',                  usd:16960, ship:1332, rub:1738000},
    {name:'Sea-Doo GTR 230',                  usd:18950, ship:1490, rub:1942000},
    {name:'Sea-Doo Wake 170',                 usd:16820, ship:1450, rub:1736000},
    {name:'Sea-Doo Spark 3up',                usd:8950,  ship:1290, rub:973000},
    {name:'Kawasaki Ultra 310LX',             usd:22850, ship:1620, rub:2325000},
    {name:'Kawasaki Ultra 160LX',             usd:16250, ship:1490, rub:1685000},
    {name:'Kawasaki STX-160',                 usd:12820, ship:1370, rub:1348000},
    {name:'Kawasaki Jet Ski SX-R 1500',       usd:14520, ship:1420, rub:1514000},
    {name:'Yamaha VX Deluxe',                 usd:11820, ship:1340, rub:1253000},
    {name:'Yamaha VX Cruiser HO',             usd:14620, ship:1420, rub:1524000},
    {name:'Yamaha FX Cruiser SVHO',           usd:22450, ship:1590, rub:2284000},
    {name:'Yamaha GP1800R HO',                usd:16820, ship:1460, rub:1737000},
    {name:'Yamaha EX Sport',                  usd:10182, ship:1440, rub:1104000},
    {name:'Yamaha SuperJet',                  usd:10450, ship:1310, rub:1122000},
    {name:'Yamaha WaveRunner EX Deluxe',      usd:9820,  ship:1290, rub:1056000},
    {name:'BRP Sea-Doo Switch Cruise',        usd:24850, ship:1810, rub:2533000},
    {name:'BRP Sea-Doo Switch Sport',         usd:21500, ship:1750, rub:2214000},
  ],
  buggy: [
    {name:'Desertcross 1000-3',               usd:null, ship:null, rub:null},
    {name:'Workcross 1000 HVAC',              usd:null, ship:null, rub:null},
    {name:'CFmoto UForce 800 Tracker',        usd:null, ship:null, rub:null},
    {name:'Tezza ATV 200 (2026)',             usd:null, ship:null, rub:null},
    {name:'BRP Can-Am MAVERICK R MAX X RS',   usd:null, ship:null, rub:null},
    {name:'Grizzly ATV 250cc (2026)',         usd:null, ship:null, rub:null},
  ],
  snow: [
    {name:'Yamaha VK Professional II',        usd:null, ship:null, rub:null},
    {name:'BRP Ski-Doo Skandic',              usd:null, ship:null, rub:null},
    {name:'BRP Lynx 49 Ranger',               usd:null, ship:null, rub:null},
    {name:'Polaris 850 Indy XC 137',          usd:null, ship:null, rub:null},
    {name:'Другая модель (уточнить)',         usd:null, ship:null, rub:null},
  ],
  equip: [
    {name:'CNC Molding Machine',              usd:null, ship:13300, rub:1264000},
    {name:'Infinite IN3015 CNC Milling',      usd:null, ship:16100, rub:1530000},
    {name:'Mikron UME 560 CNC Milling',       usd:null, ship:22050, rub:2095000},
    {name:'Industrial 5-Axis CNC Router',     usd:null, ship:14800, rub:1406000},
    {name:'CNC Lathe Machine',                usd:null, ship:11200, rub:1064000},
    {name:'Промышленный лазерный резак',      usd:null, ship:15500, rub:1473000},
    {name:'Плазменная резка ЧПУ',             usd:null, ship:10800, rub:1026000},
    {name:'Гидравлический пресс',             usd:null, ship:9500,  rub:903000},
    {name:'Токарный станок с ЧПУ',            usd:null, ship:11800, rub:1121000},
    {name:'Другое оборудование (индивидуально)', usd:null, ship:null, rub:null},
  ],
};

const CAT_LABELS = {
  quad:  {t:'Квадроцикл',    s:'ATV, спорт, утилитарные', icon:ICONS.quad},
  moto:  {t:'Мотоцикл',      s:'Кросс, эндуро, электро', icon:ICONS.moto},
  jet:   {t:'Гидроцикл',     s:'Sea-Doo, Kawasaki, Yamaha', icon:ICONS.jet},
  buggy: {t:'Багги',         s:'UTV, спорт', icon:ICONS.buggy},
  snow:  {t:'Снегоход',      s:'Полярные, кроссовые', icon:ICONS.snow},
  equip: {t:'Оборудование',  s:'CNC, промышленное, B2B', icon:ICONS.equip},
};

const REVIEWS = [
  {n:'Артём',      r:'Квадроциклы, Тюмень',        t:'Взял два CFmoto 1000 для перепродажи. Цена вышла на 18% ниже чем у дилеров. Всё чётко: договор, сроки, документы. Уже заказал третий.',      ini:'А'},
  {n:'Дмитрий',    r:'Гидроциклы, Сочи',           t:'Долго боялся возить сам, казалось сложно. Ребята разложили всё по цифрам, объяснили как работает таможня. За 32 дня получил Sea-Doo под ключ.',   ini:'Д'},
  {n:'Елена',      r:'ИП, СПб',                    t:'Мужу на 40 лет заказали Sur-Ron. Волновалась за сроки, приехало точно в день, когда обещали. Даже раньше. Мужа удивили, себе руки пожали.',        ini:'Е'},
  {n:'Максим',     r:'Автосалон, Казань',          t:'Работаем с ребятами полтора года. Возим для салона крупные партии. Ни одного срыва, все документы для постановки на учёт готовы к моменту получения.', ini:'М'},
  {n:'Игорь',      r:'Оборудование, Пермь',        t:'Заказывал CNC станок для цеха. Крупногабарит, думал будет ад. Оказалось всё прозрачно: приёмка на заводе с фото, отслеживание маршрута, доставка до цеха.', ini:'И'},
  {n:'Роман',      r:'Мотоциклы, Ростов',          t:'Три раза брал у других, три раза попадал на доплаты в процессе. Здесь цена финальная, вся сумма зафиксирована в договоре. Больше никуда не пойду.',   ini:'Р'},
  {n:'Александр',  r:'B2B, Екатеринбург',          t:'Регулярно возим партии электротехники. За два года ни одной задержки на границе. Ребята знают все нюансы растаможки по нашей категории.',           ini:'А'},
  {n:'Ирина',      r:'Квадроциклы, Краснодар',     t:'В технике разбираюсь плохо, но менеджер спокойно всё разложил по полочкам. Помог выбрать модель под задачу, предложил разумный вариант. Спасибо за человеческий подход.', ini:'И'},
];

const FAQ_ITEMS = [
  {q:'Сколько идёт техника из Китая?',
   a:'Средний срок 30 дней от оплаты до вашей двери. Быстрая логистика через Монголию, без задержек на границе. Для крупногабарита и оборудования срок согласуется отдельно.'},
  {q:'Входит ли таможня в цену?',
   a:'Да, всё под ключ. В финальной цене уже: закупка на фабрике, логистика Гуанчжоу и Москва, таможенное оформление, пошлины, сертификация и доставка до вашего адреса. В процессе доплат не будет, всё зафиксировано в договоре.'},
  {q:'Какие гарантии что груз доедет?',
   a:'Работаем по договору. Стоимость и сроки фиксируются до отправки. Ответственность за груз на всех этапах на нас. За 6 лет 2400+ успешных поставок. Каждый груз застрахован.'},
  {q:'Как формируется цена?',
   a:'Прозрачно и по позициям: закупка у поставщика, логистика (по весу и объёму), таможенное оформление, доставка до двери. Раскладываем всё по цифрам, видите куда идёт каждый рубль.'},
  {q:'Работаете с юридическими лицами?',
   a:'Да, работаем и с физлицами, и с ИП, и с ООО. Для юрлиц оформляем полный пакет документов: договор, счёт, ТТН, документы для постановки на учёт (для техники подлежащей регистрации).'},
  {q:'Что если техника окажется бракованной?',
   a:'Приёмка на фабрике идёт через нашего представителя, до отправки проверяем комплектацию и внешний вид. Заводская гарантия сохраняется. Если возникает проблема, помогаем с гарантийным обращением к производителю.'},
  {q:'Можно ли привезти что-то не из каталога?',
   a:'Да. В каталоге популярные позиции, но мы возим практически любую технику и оборудование из Китая. Опишите задачу, найдём поставщика и посчитаем стоимость под ключ.'},
];

/* ═══════════════════════════════════════════════════════════════
   INIT & UTILITIES
   ═══════════════════════════════════════════════════════════════ */

function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

/* ─── HEADER / NAV ─── */
function initHeader() {
  const ham = $('#ham');
  const mobnav = $('#mobnav');
  if (!ham || !mobnav) return;
  ham.addEventListener('click', () => {
    mobnav.classList.toggle('open');
    document.body.style.overflow = mobnav.classList.contains('open') ? 'hidden' : '';
  });
}
window.closeMob = function() {
  const m = $('#mobnav');
  if (m) m.classList.remove('open');
  document.body.style.overflow = '';
};

/* ─── LIVE STATS ─── */
function initLive() {
  const upd = () => {
    const today = $('#liveToday');
    const now = $('#liveNow');
    if (today) today.textContent = 8 + Math.floor(Math.random() * 8);
    if (now)   now.textContent   = 2 + Math.floor(Math.random() * 6);
  };
  upd();
  setInterval(upd, 45000);
}

/* ─── FAQ ─── */
function initFaq() {
  const list = $('#faqList');
  if (!list) return;
  const plus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
  list.innerHTML = FAQ_ITEMS.map((it, i) => `
    <div class="faq-item" data-i="${i}">
      <div class="faq-q">${it.q}<span class="faq-arr">${plus}</span></div>
      <div class="faq-a"><div class="faq-a-i">${it.a}</div></div>
    </div>`).join('');
  list.querySelectorAll('.faq-q').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.parentElement;
      const isOpen = item.classList.contains('open');
      list.querySelectorAll('.faq-item.open').forEach(i => {
        i.classList.remove('open');
        const a = i.querySelector('.faq-a');
        if (a) a.style.maxHeight = '0';
      });
      if (!isOpen) {
        item.classList.add('open');
        const a = item.querySelector('.faq-a');
        if (a) a.style.maxHeight = a.scrollHeight + 'px';
      }
    });
  });
}

/* ─── REVIEWS ─── */
function initReviews() {
  const track = $('#revTrack');
  if (!track) return;
  const items = [...REVIEWS, ...REVIEWS];
  const stars = ICONS.star.repeat(5);
  track.innerHTML = items.map(r => `
    <div class="rev-card">
      <div class="rev-stars">${stars}</div>
      <div class="rev-text">«${r.t}»</div>
      <div class="rev-author">
        <div class="rev-ava">${r.ini}</div>
        <div>
          <div class="rev-name">${r.n}</div>
          <div class="rev-role">${r.r}</div>
        </div>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════════════════════════
   CALCULATOR (hybrid mode: pick / know)
   ═══════════════════════════════════════════════════════════════ */

const Calc = {
  state: {
    mode:    'pick',
    step:    0,
    cat:     null,
    model:   null,
    region:  null,
    pay:     null,
    search:  '',
    contact: { name:'', phone:'', tg:'', email:'' },
  },

  init() {
    this.render();
  },

  mode(m) {
    Object.assign(this.state, {
      mode: m,
      step: 0,
      cat: null,
      model: null,
      region: null,
      pay: null,
      search: '',
    });
    $$('.calc-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === m);
    });
    this.render();
  },

  pickFromCatalog(cat, name) {
    this.mode('know');
    this.state.cat = cat;
    this.state.model = (CATALOG[cat] || []).find(m => m.name === name) || null;
    this.state.step = 1;
    this.render();
    const el = $('#calculator');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  step(n) { this.state.step = n; this.render(); },
  next()  { if (this.canNext()) { this.state.step++; this.render(); } },
  back()  { if (this.state.step > 0) { this.state.step--; this.render(); } },

  canNext() {
    const s = this.state.step;
    if (this.state.mode === 'pick') {
      if (s === 0) return !!this.state.cat;
      if (s === 1) return !!this.state.pay;
      if (s === 2) return this.contactValid();
    } else {
      if (s === 0) return !!this.state.cat;
      if (s === 1) return !!this.state.model;
      if (s === 2) return !!this.state.region && !!this.state.pay;
      if (s === 3) return this.contactValid();
    }
    return false;
  },

  contactValid() {
    const c = this.state.contact;
    return c.name.trim().length >= 2 &&
           (c.phone.trim().length >= 6 || c.tg.trim().length >= 2 || c.email.trim().length >= 5);
  },

  totalSteps() { return this.state.mode === 'pick' ? 3 : 4; },

  render() {
    const box  = $('#calcSteps');
    const prog = $('#calcProg');
    if (!box || !prog) return;

    const total = this.totalSteps();
    const s = this.state.step;

    // progress dots
    let dots = '';
    for (let i = 0; i <= total; i++) {
      const cls = i < s ? 'done' : (i === s ? 'active' : '');
      dots += `<div class="calc-dot ${cls}"></div>`;
    }
    prog.innerHTML = dots;

    if (this.state.mode === 'pick') {
      if (s === 0) return this.renderPickCategory(box);
      if (s === 1) return this.renderPickPayment(box);
      if (s === 2) return this.renderContact(box);
      if (s === 3) return this.renderSuccess(box);
    } else {
      if (s === 0) return this.renderCategoryKnow(box);
      if (s === 1) return this.renderModelPick(box);
      if (s === 2) return this.renderRegionPay(box);
      if (s === 3) return this.renderContact(box);
      if (s === 4) return this.renderSuccess(box);
    }
  },

  renderPickCategory(box) {
    const cats = ['quad', 'moto', 'jet', 'buggy', 'snow', 'equip'];
    box.innerHTML = `
      <div class="calc-step active">
        <div class="calc-step-h"><span class="calc-num">1</span>Какую технику <span class="g">подобрать</span>?</div>
        <div class="calc-grid">
          ${cats.map(k => {
            const c = CAT_LABELS[k];
            const sel = this.state.cat === k ? 'selected' : '';
            return `<button class="calc-tile ${sel}" onclick="Calc.setCat('${k}')">
              <div class="calc-tile-i">${c.icon}</div>
              <div class="calc-tile-t">${c.t}</div>
              <div class="calc-tile-s">${c.s}</div>
            </button>`;
          }).join('')}
        </div>
        ${this.renderNav()}
      </div>`;
  },

  renderCategoryKnow(box) {
    const cats = ['quad', 'moto', 'jet', 'buggy', 'snow', 'equip'];
    box.innerHTML = `
      <div class="calc-step active">
        <div class="calc-step-h"><span class="calc-num">1</span>Выберите <span class="g">категорию</span></div>
        <div class="calc-grid">
          ${cats.map(k => {
            const c = CAT_LABELS[k];
            const sel = this.state.cat === k ? 'selected' : '';
            return `<button class="calc-tile ${sel}" onclick="Calc.setCat('${k}')">
              <div class="calc-tile-i">${c.icon}</div>
              <div class="calc-tile-t">${c.t}</div>
            </button>`;
          }).join('')}
        </div>
        ${this.renderNav()}
      </div>`;
  },

  renderPickPayment(box) {
    const cat = CAT_LABELS[this.state.cat];
    const pays = [
      {k:'cash',   t:'Наличные',      s:'При получении',       icon:ICONS.cash},
      {k:'bank',   t:'Безналичный',   s:'ИП / ООО, счёт',      icon:ICONS.bank},
      {k:'crypto', t:'Крипта',        s:'USDT / TRC-20',       icon:ICONS.crypto},
      {k:'any',    t:'Обсудим',       s:'Расскажу при звонке', icon:ICONS.any},
    ];
    box.innerHTML = `
      <div class="calc-step active">
        <div class="calc-step-h"><span class="calc-num">2</span>Как <span class="g">удобно платить</span>?</div>
        <div class="calc-summary">Категория: <b>${cat.t}</b></div>
        <div class="calc-grid">
          ${pays.map(p => {
            const sel = this.state.pay === p.k ? 'selected' : '';
            return `<button class="calc-tile ${sel}" onclick="Calc.setPay('${p.k}')">
              <div class="calc-tile-i">${p.icon}</div>
              <div class="calc-tile-t">${p.t}</div>
              <div class="calc-tile-s">${p.s}</div>
            </button>`;
          }).join('')}
        </div>
        ${this.renderNav()}
      </div>`;
  },

  renderModelPick(box) {
    const list = CATALOG[this.state.cat] || [];
    const q = (this.state.search || '').toLowerCase().trim();
    const filtered = q ? list.filter(m => m.name.toLowerCase().includes(q)) : list;

    box.innerHTML = `
      <div class="calc-step active">
        <div class="calc-step-h"><span class="calc-num">2</span>Найдите <span class="g">вашу модель</span></div>
        <div class="calc-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input class="calc-search" placeholder="CFmoto, Sea-Doo, Sur-Ron..." value="${this.state.search || ''}" oninput="Calc.setSearch(this.value)">
        </div>
        <div class="calc-list">
          ${filtered.length === 0
            ? '<div class="calc-list-empty">Нужной модели пока нет в списке. Напишите нам, привезём под заказ.</div>'
            : filtered.map(m => {
                const sel = this.state.model && this.state.model.name === m.name ? 'selected' : '';
                const priceHtml = m.rub
                  ? `<div class="calc-list-price">от ${fmt(m.rub)} ₽</div>`
                  : `<div class="calc-list-price req">по запросу</div>`;
                const safeName = m.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');
                return `<div class="calc-list-item ${sel}" onclick="Calc.setModel('${safeName}')"><div class="calc-list-name">${m.name}</div>${priceHtml}</div>`;
              }).join('')}
        </div>
        ${this.state.model ? this.renderPriceCard() : ''}
        ${this.renderNav()}
      </div>`;
  },

  renderPriceCard() {
    const m = this.state.model;
    if (!m || !m.rub) {
      return `<div class="calc-price">
        <div class="calc-price-l">Стоимость</div>
        <div class="calc-price-v" style="font-size:20px">Цена по запросу</div>
        <div class="calc-price-hint">Модель уникальная, рассчитаем индивидуально после заявки.</div>
      </div>`;
    }
    return `<div class="calc-price">
      <div class="calc-price-l">Ориентир под ключ</div>
      <div class="calc-price-v">от ${fmt(m.rub)} ₽</div>
      <div class="calc-price-hint">Включает закупку, логистику Гуанчжоу и Москва, таможню и доставку до двери. Точная цифра после подтверждения наличия у поставщика.</div>
    </div>`;
  },

  renderRegionPay(box) {
    const regions = [
      {k:'msk',   t:'Москва / МО',       icon:ICONS.msk},
      {k:'spb',   t:'Санкт-Петербург',   icon:ICONS.spb},
      {k:'south', t:'Юг РФ',             icon:ICONS.south},
      {k:'other', t:'Другой регион',     icon:ICONS.pin},
    ];
    const pays = [
      {k:'cash',   t:'Наличные',    icon:ICONS.cash},
      {k:'bank',   t:'Безналичный', icon:ICONS.bank},
      {k:'crypto', t:'Крипта USDT', icon:ICONS.crypto},
      {k:'any',    t:'Обсудим',     icon:ICONS.any},
    ];
    box.innerHTML = `
      <div class="calc-step active">
        <div class="calc-step-h"><span class="calc-num">3</span>Регион и <span class="g">оплата</span></div>
        <div class="calc-lbl">Куда доставить</div>
        <div class="calc-grid" style="margin-bottom:16px">
          ${regions.map(r => {
            const sel = this.state.region === r.k ? 'selected' : '';
            return `<button class="calc-tile ${sel}" style="padding:14px 8px" onclick="Calc.setRegion('${r.k}')">
              <div class="calc-tile-i">${r.icon}</div>
              <div class="calc-tile-t" style="font-size:12px">${r.t}</div>
            </button>`;
          }).join('')}
        </div>
        <div class="calc-lbl">Как удобно платить</div>
        <div class="calc-grid">
          ${pays.map(p => {
            const sel = this.state.pay === p.k ? 'selected' : '';
            return `<button class="calc-tile ${sel}" style="padding:14px 8px" onclick="Calc.setPay('${p.k}')">
              <div class="calc-tile-i">${p.icon}</div>
              <div class="calc-tile-t" style="font-size:12px">${p.t}</div>
            </button>`;
          }).join('')}
        </div>
        ${this.renderNav()}
      </div>`;
  },

  renderContact(box) {
    const c = this.state.contact;
    let summary = '';
    if (this.state.mode === 'know' && this.state.model) {
      const priceStr = this.state.model.rub
        ? `от <b>${fmt(this.state.model.rub)} ₽</b> под ключ`
        : 'цена по запросу';
      summary = `<div class="calc-summary"><b>${this.state.model.name}</b> · ${priceStr}</div>`;
    } else if (this.state.mode === 'pick' && this.state.cat) {
      const cat = CAT_LABELS[this.state.cat];
      summary = `<div class="calc-summary"><b>${cat.t}</b> · подберём под задачу</div>`;
    }
    const stepNum = this.state.mode === 'pick' ? 3 : 4;
    box.innerHTML = `
      <div class="calc-step active">
        <div class="calc-step-h"><span class="calc-num">${stepNum}</span>Куда прислать <span class="g">расчёт</span>?</div>
        ${summary}
        <label class="calc-lbl">Как к вам обращаться *</label>
        <input class="calc-inp" placeholder="Ваше имя" value="${this.esc(c.name)}" oninput="Calc.setContact('name',this.value)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label class="calc-lbl">Телефон</label>
            <input class="calc-inp" placeholder="+7 999 ..." value="${this.esc(c.phone)}" oninput="Calc.setContact('phone',this.value)">
          </div>
          <div>
            <label class="calc-lbl">Telegram</label>
            <input class="calc-inp" placeholder="@username" value="${this.esc(c.tg)}" oninput="Calc.setContact('tg',this.value)">
          </div>
        </div>
        <label class="calc-lbl">Email <span class="calc-lbl-note">(пришлём расчёт красиво)</span></label>
        <input class="calc-inp" placeholder="you@example.com" value="${this.esc(c.email)}" oninput="Calc.setContact('email',this.value)">
        <div style="font-size:11.5px;color:var(--text3);line-height:1.6;margin-top:4px">Оставьте хотя бы один способ связи. Расчёт пришлём в течение 15 минут.</div>
        ${this.renderNav(true)}
      </div>`;
  },

  renderSuccess(box) {
    box.innerHTML = `
      <div class="calc-step active calc-ok">
        <div class="calc-ok-i">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="calc-ok-h">Заявка принята!</div>
        <div class="calc-ok-t">Расчёт пришлём в течение 15 минут.<br>Хотите обсудить прямо сейчас, напишите в Telegram.</div>
        <a href="https://t.me/pandaGO_media" target="_blank" rel="noopener" class="btn-primary">
          ${ICONS.tg}
          Написать в Telegram
        </a>
      </div>`;
  },

  renderNav(isSubmit) {
    const canGo = this.canNext();
    const btnText = isSubmit
      ? `Отправить заявку <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`
      : `Дальше <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`;
    const backBtn = this.state.step > 0
      ? `<button class="calc-back" onclick="Calc.back()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>Назад</button>`
      : '<div></div>';
    const action = isSubmit ? 'Calc.submit()' : 'Calc.next()';
    return `<div class="calc-nav">${backBtn}<button class="calc-next" ${canGo ? '' : 'disabled'} onclick="${action}">${btnText}</button></div>`;
  },

  esc(s) { return String(s || '').replace(/"/g, '&quot;'); },
  setCat(k)    { this.state.cat = k; this.state.model = null; this.render(); },
  setPay(k)    { this.state.pay = k; this.render(); },
  setRegion(k) { this.state.region = k; this.render(); },
  setSearch(v) { this.state.search = v; this.render(); },
  setModel(name) {
    this.state.model = (CATALOG[this.state.cat] || []).find(m => m.name === name) || null;
    this.render();
  },
  setContact(k, v) { this.state.contact[k] = v; this.render(); },

  async submit() {
    if (!this.contactValid()) return;
    const c = this.state.contact;
    const contact = c.tg ? c.tg : (c.email ? c.email : c.phone);
    const service = this.state.model ? this.state.model.name : (CAT_LABELS[this.state.cat] ? CAT_LABELS[this.state.cat].t : 'Подбор техники');
    const priceRub = this.state.model && this.state.model.rub ? this.state.model.rub : null;

    const parts = [
      this.state.mode === 'pick' ? 'Помочь подобрать' : 'Уже выбрал модель',
      this.state.cat   ? `Категория: ${CAT_LABELS[this.state.cat].t}` : '',
      this.state.model ? `Модель: ${this.state.model.name}` : '',
      priceRub         ? `Ориентир: от ${fmt(priceRub)} ₽ под ключ` : '',
      this.state.region ? `Регион: ${this.state.region}` : '',
      this.state.pay    ? `Оплата: ${this.state.pay}` : '',
      c.name  ? `Имя: ${c.name}` : '',
      c.phone ? `Тел: ${c.phone}` : '',
      c.tg    ? `TG: ${c.tg}` : '',
      c.email ? `Email: ${c.email}` : '',
    ].filter(Boolean).join(' · ');

    try {
      await fetch('api.php?action=newLead', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          name: c.name, contact, service, msg: parts,
          phone: c.phone, tg: c.tg, email: c.email
        })
      });
    } catch (e) { /* silent, backend not yet deployed */ }

    this.state.step = this.state.mode === 'pick' ? 3 : 4;
    this.render();
  }
};

/* ═══════════════════════════════════════════════════════════════
   CHATBOT WIDGET
   ═══════════════════════════════════════════════════════════════ */

const CW = {
  open: false,
  started: false,
  history: [],

  init() {
    const btn   = $('#cwBtn');
    const close = $('#cwClose');
    const send  = $('#cwSend');
    const input = $('#cwInput');
    if (!btn || !close || !send || !input) return;

    btn.addEventListener('click', () => this.toggle());
    close.addEventListener('click', () => this.close());
    send.addEventListener('click', () => this.userSend());
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.userSend();
    });

    // teaser badge appears after 25s if not opened
    setTimeout(() => {
      if (this.open) return;
      try {
        if (!sessionStorage.getItem('cwSeen')) {
          const badge = $('#cwBadge');
          if (badge) badge.style.display = 'flex';
        }
      } catch (e) {}
    }, 25000);
  },

  toggle() { this.open ? this.close() : this.openIt(); },

  openIt() {
    this.open = true;
    const panel = $('#cwPanel');
    const badge = $('#cwBadge');
    if (panel) panel.classList.add('open');
    if (badge) badge.style.display = 'none';
    try { sessionStorage.setItem('cwSeen', '1'); } catch(e) {}
    if (!this.started) {
      this.started = true;
      this.start();
    }
  },

  close() {
    this.open = false;
    const panel = $('#cwPanel');
    if (panel) panel.classList.remove('open');
  },

  async start() {
    await this.bot('Здравствуйте! Меня зовут Панда, я виртуальный менеджер PandaGo. Помогу разобраться с доставкой техники из Китая и подобрать вариант под вашу задачу.');
    await this.wait(400);
    await this.bot('Что вас интересует?');
    this.quick([
      {t:'Квадроцикл или мотоцикл',    ico:ICONS.quad,  go:'v_quad'},
      {t:'Гидроцикл',                  ico:ICONS.jet,   go:'v_jet'},
      {t:'Багги или снегоход',         ico:ICONS.buggy, go:'v_buggy'},
      {t:'Оборудование для бизнеса',   ico:ICONS.equip, go:'v_equip'},
      {t:'Просто спросить',            ico:ICONS.info,  go:'v_ask'},
    ]);
  },

  async v_quad() {
    await this.user('Квадроцикл или мотоцикл');
    await this.bot('Отличный выбор. В наличии для расчёта <b>CFmoto, LONCIN, Polaris, Yamaha, Honda, Sur-Ron</b> и другие. Что ближе по задаче?');
    this.quick([
      {t:'Для покатушек и хобби',       ico:ICONS.moto,   go:'v_hobby'},
      {t:'Для перепродажи',             ico:ICONS.b2b,    go:'v_resell'},
      {t:'Электро и Sur-Ron',           ico:ICONS.crypto, go:'v_electro'},
      {t:'Открыть калькулятор',         ico:ICONS.calc,   go:'v_calc'},
    ]);
  },

  async v_jet() {
    await this.user('Гидроцикл');
    await this.bot('Гидро наша топ-категория. Возим напрямую <b>Sea-Doo, Kawasaki, Yamaha</b>. Например Sea-Doo GTI 170 от 1 835 000 ₽ под ключ. Sea-Doo Spark 3up от 973 000 ₽. Yamaha VX Deluxe от 1 253 000 ₽.');
    await this.wait(400);
    await this.bot('Хотите точный расчёт под конкретную модель?');
    this.quick([
      {t:'Открыть калькулятор',    ico:ICONS.calc,   go:'v_calc'},
      {t:'Помогите выбрать',       ico:ICONS.info,   go:'v_help'},
      {t:'Сколько идёт по срокам', ico:ICONS.clock,  go:'v_time'},
    ]);
  },

  async v_buggy() {
    await this.user('Багги или снегоход');
    await this.bot('Возим и то, и другое. По багги популярно <b>Desertcross 1000-3, CFmoto UForce, BRP Can-Am Maverick</b>. По снегоходам работаем под задачу, скажите какой регион и стиль катания. Цена под ваш вариант считается индивидуально.');
    this.quick([
      {t:'Помогите подобрать',     ico:ICONS.info,   go:'v_help'},
      {t:'Оставить заявку',        ico:ICONS.calc,   go:'v_calc'},
    ]);
  },

  async v_equip() {
    await this.user('Оборудование для бизнеса');
    await this.bot('С B2B работаем регулярно. Возим <b>CNC-станки, лазерную резку, прессы, промышленную технику</b>. Полный пакет документов для юрлиц. Доставка крупногабарита обычно 40-60 дней.');
    await this.wait(400);
    await this.bot('Что нужно привезти?');
    this.quick([
      {t:'Оставить запрос',        ico:ICONS.calc,   go:'v_calc'},
      {t:'Написать менеджеру',     ico:ICONS.tg,     go:'v_manager'},
    ]);
  },

  async v_ask() {
    await this.user('Просто спросить');
    await this.bot('Спрашивайте. Отвечу на всё что касается доставки из Китая. Или напишите вопрос в свободной форме.');
    this.quick([
      {t:'Сколько идёт по срокам', ico:ICONS.clock,  go:'v_time'},
      {t:'Входит ли таможня',      ico:ICONS.shield, go:'v_customs'},
      {t:'Какие гарантии',         ico:ICONS.shield, go:'v_warranty'},
      {t:'Работаете с юрлицами',   ico:ICONS.b2b,    go:'v_b2b'},
    ]);
  },

  async v_hobby() {
    await this.user('Для покатушек и хобби');
    await this.bot('Для катания топ-3 у нас: <b>CFmoto CFORCE 800 HO</b> (от 1 283 000 ₽), <b>LONCIN XWOLF 700L</b> (от 738 000 ₽) и <b>Yamaha Grizzly 700</b> (от 1 323 000 ₽) под ключ. Все надёжные, ходовые, с гарантией.');
    await this.wait(400);
    await this.bot('Оставите контакт и пришлём расчёт с полной раскладкой цены за 15 минут.');
    this.quick([
      {t:'Открыть калькулятор',    ico:ICONS.calc,   go:'v_calc'},
      {t:'Написать менеджеру',     ico:ICONS.tg,     go:'v_manager'},
    ]);
  },

  async v_resell() {
    await this.user('Для перепродажи');
    await this.bot('Понимаем. Для перепродажи важна маржа, поэтому от 2 единиц оптовые условия, документы для постановки на учёт готовы к получению, при партии 5+ единиц специальная цена. Маржа получается 15-25% к рыночной цене в РФ.');
    await this.wait(400);
    await this.bot('Что планируете возить?');
    this.quick([
      {t:'Квадроциклы (2-5 единиц)', ico:ICONS.quad,   go:'v_calc'},
      {t:'Мотоциклы Sur-Ron',        ico:ICONS.moto,   go:'v_electro'},
      {t:'Обсудить с менеджером',    ico:ICONS.tg,     go:'v_manager'},
    ]);
  },

  async v_electro() {
    await this.user('Электро и Sur-Ron');
    await this.bot('Sur-Ron у нас топ. <b>Light Bee X</b> от 220 000 ₽, <b>Ultra Bee</b> от 417 000 ₽, <b>Storm Bee</b> от 566 000 ₽ под ключ. Также Talaria, NIU, Super Soco. Идут быстро, 20 или 25 дней в среднем.');
    this.quick([
      {t:'Открыть калькулятор',    ico:ICONS.calc,   go:'v_calc'},
      {t:'Оставить заявку',        ico:ICONS.tg,     go:'v_manager'},
    ]);
  },

  async v_time() {
    await this.user('Сколько идёт по срокам');
    await this.bot('Средний срок <b>30 дней</b> от оплаты до вашей двери. Электротехника (Sur-Ron, NIU) идёт быстрее, 20-25 дней. Гидроциклы и крупногабарит 35-45 дней. Оборудование для B2B 40-60 дней. Все сроки фиксируются в договоре.');
    this.quick([
      {t:'Открыть калькулятор',    ico:ICONS.calc,   go:'v_calc'},
      {t:'Оставить заявку',        ico:ICONS.tg,     go:'v_manager'},
    ]);
  },

  async v_customs() {
    await this.user('Входит ли таможня');
    await this.bot('Да, всё под ключ. В финальной цене уже закупка на фабрике, логистика Гуанчжоу и Москва через Монголию, таможня, пошлины, сертификация и доставка до вашего адреса. Все расходы <b>зафиксированы в договоре</b>, доплат в процессе не будет.');
    this.quick([
      {t:'Открыть калькулятор',    ico:ICONS.calc,   go:'v_calc'},
      {t:'Написать менеджеру',     ico:ICONS.tg,     go:'v_manager'},
    ]);
  },

  async v_warranty() {
    await this.user('Какие гарантии');
    await this.bot('Работаем по договору. Стоимость и сроки фиксируются до отправки без изменений в процессе. Ответственность за груз на всех этапах на нас. За 6 лет 2400+ поставок. Приёмка на фабрике через нашего представителя. Заводская гарантия сохраняется.');
    this.quick([
      {t:'Открыть калькулятор',    ico:ICONS.calc,   go:'v_calc'},
      {t:'Написать менеджеру',     ico:ICONS.tg,     go:'v_manager'},
    ]);
  },

  async v_b2b() {
    await this.user('Работаете с юрлицами');
    await this.bot('Да, работаем с ИП и с ООО. Полный пакет документов: договор, счёт, ТТН, документы для постановки на учёт. Возим партиями, помогаем с сертификацией для продажи в РФ. Расчёт по безналу или крипте (USDT).');
    this.quick([
      {t:'Оставить B2B-запрос',    ico:ICONS.b2b,    go:'v_calc'},
      {t:'Обсудить с менеджером',  ico:ICONS.tg,     go:'v_manager'},
    ]);
  },

  async v_help() {
    await this.user('Помогите подобрать');
    await this.bot('Конечно. Откройте калькулятор выше, выберите категорию и режим «Помогите подобрать». Менеджер посмотрит вашу задачу и предложит 2-3 варианта с ценами.');
    this.quick([
      {t:'Открыть калькулятор',    ico:ICONS.calc,   go:'v_calc'},
      {t:'Написать менеджеру',     ico:ICONS.tg,     go:'v_manager'},
    ]);
  },

  async v_calc() {
    await this.user('Открыть калькулятор');
    await this.bot('Открываю. Заполните шаги, увидите ориентировочную цену.');
    setTimeout(() => {
      this.close();
      const el = $('#calculator');
      if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
    }, 700);
  },

  async v_manager() {
    await this.user('Написать менеджеру');
    await this.bot('Открываю Telegram. Живой менеджер ответит в течение нескольких минут.');
    setTimeout(() => window.open('https://t.me/pandaGO_media', '_blank'), 700);
    this.quick([
      {t:'Ещё вопрос', ico:ICONS.info, go:'v_ask'},
    ]);
  },

  async bot(text) {
    const body = $('#cwBody');
    if (!body) return;
    return new Promise(res => {
      const typ = document.createElement('div');
      typ.className = 'cw-typing';
      typ.innerHTML = '<span></span><span></span><span></span>';
      body.appendChild(typ);
      body.scrollTop = body.scrollHeight;
      setTimeout(() => {
        typ.remove();
        const msg = document.createElement('div');
        msg.className = 'cw-msg d';
        msg.innerHTML = text;
        body.appendChild(msg);
        body.scrollTop = body.scrollHeight;
        this.history.push({from:'d', t:text});
        res();
      }, 550 + Math.random() * 300);
    });
  },

  async user(text) {
    const body = $('#cwBody');
    if (!body) return;
    const msg = document.createElement('div');
    msg.className = 'cw-msg u';
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    this.history.push({from:'u', t:text});
    body.querySelectorAll('.cw-quick').forEach(q => q.remove());
    return new Promise(res => setTimeout(res, 150));
  },

  quick(buttons) {
    const body = $('#cwBody');
    if (!body) return;
    const wrap = document.createElement('div');
    wrap.className = 'cw-quick';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'cw-qbtn';
      btn.innerHTML = (b.ico || '') + `<span>${b.t}</span>`;
      btn.onclick = () => {
        wrap.remove();
        if (this[b.go]) this[b.go]();
      };
      wrap.appendChild(btn);
    });
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  },

  async userSend() {
    const input = $('#cwInput');
    if (!input) return;
    const v = input.value.trim();
    if (!v) return;
    await this.user(v);
    input.value = '';
    await this.wait(500);
    const low = v.toLowerCase();
    if (/цен|стоим|скольк.*стои/.test(low)) return this.v_calc();
    if (/срок|быстр|долг|скольк.*ид|идут/.test(low)) return this.v_time();
    if (/таможн|растаможк|пошлин/.test(low)) return this.v_customs();
    if (/гаранти|надёжн|надежн|обман|кинут/.test(low)) return this.v_warranty();
    if (/ооо|ип|юрлиц|юр\.?\s*лиц|b2b|безнал/.test(low)) return this.v_b2b();
    if (/квадр|атв|atv/.test(low)) return this.v_quad();
    if (/гидр|jet|sea.?doo|kawasaki|yamaha/.test(low)) return this.v_jet();
    if (/багг|снегох|снего/.test(low)) return this.v_buggy();
    if (/оборуд|станок|cnc/.test(low)) return this.v_equip();
    await this.bot('Понял. Такие вопросы лучше решать напрямую с менеджером, он ответит за пару минут в Telegram.');
    this.quick([
      {t:'Написать менеджеру',     ico:ICONS.tg,     go:'v_manager'},
      {t:'Открыть калькулятор',    ico:ICONS.calc,   go:'v_calc'},
      {t:'Другой вопрос',          ico:ICONS.info,   go:'v_ask'},
    ]);
  },

  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
};

/* ─── BOOT ─── */
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initLive();
  initFaq();
  initReviews();
  Calc.init();
  CW.init();
});

/* expose to onclick handlers */
window.Calc = Calc;
window.CW = CW;
