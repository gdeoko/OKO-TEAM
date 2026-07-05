/* ═══════════════════════════════════════════════════════════════
   PandaGo Order · Данные каталога (реальный прайс)
   Формула: rub = ceil((usd + ship) * RATE / 1000) * 1000
   Источник: pandago-PRICE_new.xlsx, колонка "Спорт инвентарь"
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* Курс расчёта по умолчанию. Актуальное значение админ меняет в панели,
   бэкенд хранит его в data.json (settings.rate). */
export const RATE = 95;

/* Наценка российского дилера для блока сравнения и строки экономии */
export const DEALER_MARKUP = 1.6;

export const CATALOG = {
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
export const CAT_LABELS = {
  quad:  {t:'Квадроцикл',    s:'ATV, спорт, утилитарные'},
  moto:  {t:'Мотоцикл',      s:'Кросс, эндуро, электро'},
  jet:   {t:'Гидроцикл',     s:'Sea-Doo, Kawasaki, Yamaha'},
  buggy: {t:'Багги',         s:'UTV, спорт'},
  snow:  {t:'Снегоход',      s:'Полярные, кроссовые'},
  equip: {t:'Оборудование',  s:'CNC, промышленное, B2B'},
};

export const CAT_ORDER = ['quad', 'moto', 'jet', 'buggy', 'snow', 'equip'];

export const REVIEWS = [
  {n:'Артём',      r:'Квадроциклы, Тюмень',        t:'Взял два CFmoto 1000 для перепродажи. Цена вышла на 18% ниже чем у дилеров. Всё чётко: договор, сроки, документы. Уже заказал третий.',      ini:'А'},
  {n:'Дмитрий',    r:'Гидроциклы, Сочи',           t:'Долго боялся возить сам, казалось сложно. Ребята разложили всё по цифрам, объяснили как работает таможня. За 32 дня получил Sea-Doo под ключ.',   ini:'Д'},
  {n:'Елена',      r:'ИП, СПб',                    t:'Мужу на 40 лет заказали Sur-Ron. Волновалась за сроки, приехало точно в день, когда обещали. Даже раньше. Мужа удивили, себе руки пожали.',        ini:'Е'},
  {n:'Максим',     r:'Автосалон, Казань',          t:'Работаем с ребятами полтора года. Возим для салона крупные партии. Ни одного срыва, все документы для постановки на учёт готовы к моменту получения.', ini:'М'},
  {n:'Игорь',      r:'Оборудование, Пермь',        t:'Заказывал CNC станок для цеха. Крупногабарит, думал будет ад. Оказалось всё прозрачно: приёмка на заводе с фото, отслеживание маршрута, доставка до цеха.', ini:'И'},
  {n:'Роман',      r:'Мотоциклы, Ростов',          t:'Три раза брал у других, три раза попадал на доплаты в процессе. Здесь цена финальная, вся сумма зафиксирована в договоре. Больше никуда не пойду.',   ini:'Р'},
  {n:'Александр',  r:'B2B, Екатеринбург',          t:'Регулярно возим партии электротехники. За два года ни одной задержки на границе. Ребята знают все нюансы растаможки по нашей категории.',           ini:'А'},
  {n:'Ирина',      r:'Квадроциклы, Краснодар',     t:'В технике разбираюсь плохо, но менеджер спокойно всё разложил по полочкам. Помог выбрать модель под задачу, предложил разумный вариант. Спасибо за человеческий подход.', ini:'И'},
];

export const FAQ_ITEMS = [
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

/* Форматирование числа: 1361000 -> "1 361 000" */
export function fmt(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* Цена под ключ в рублях по формуле проекта */
export function priceRub(model, rate = RATE) {
  if (!model || !model.rub) return null;
  if (rate === RATE) return model.rub;
  const usd = (model.usd || 0) + (model.ship || 0);
  if (!usd) return model.rub;
  return Math.ceil(usd * rate / 1000) * 1000;
}

/* Ориентир цены российского дилера, округление вверх до тысяч */
export function dealerRub(rub) {
  if (!rub) return null;
  return Math.ceil(rub * DEALER_MARKUP / 1000) * 1000;
}

export function totalModels() {
  return CAT_ORDER.reduce((n, k) => n + CATALOG[k].length, 0);
}
