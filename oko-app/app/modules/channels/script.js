/* ================= CHANNELS: платные каналы / курсы + управление (префикс ch) =================
   Реальные каналы как в Telegram + монетизация OKO.
   1) Создание: обычный / платный (N ₽/мес) / курс (видео-уроки внутри), название, описание,
      аватар (буква/иконка), сменяемый фон-градиент.
   2) Платный доступ: превью с paywall + «Подписаться за N ₽/мес» → walletCharge → комиссия
      OKO 10% через okoEarn, владелец получает N минус 10%.
   3) Управление (глубина Telegram): Тип / Обсуждения / Реакции / Админы / Подписчики /
      Статистика (canvas) / Чёрный список / Настройки / Фон-аватар. Реалистичные мок-данные.
   4) Курсы: канал-курс с видео-уроками и прогрессом; пользователь создаёт и продаёт (комиссия 10%).
   5) Входы: «Канал» в меню создания чата (перехват pickChatKind) + строка «Мои каналы» в профиле.
   Единый fullscreen #chView с внутренним стеком страниц chNav (nvPush + step → «назад» работает).
   Персист: localStorage oko-channels. Все стили с префиксом ch-. */

(function(){
'use strict';

const CH_FEE = 0.10;                 // комиссия OKO с продаж каналов/курсов
const CH_LESSON_URL = null;          // видео-уроки — заглушка-плеер (реальный URL Академии подключается отдельно)

/* фирменные градиенты-фоны (сменяемый фон канала) */
const CH_BGS = [
  'linear-gradient(135deg,#0a0a0a 0%,#1a2b00 55%,#9AFF00 140%)', // чёрный → лайм
  'linear-gradient(135deg,#141414,#2a2a2a)',                     // графит
  'linear-gradient(135deg,#0d2818,#0a0a0a 70%)',                 // тёмно-зелёный → чёрный
  'linear-gradient(135deg,#12240a,#050a02)',                     // глубокий лист-зелёный → почти чёрный
  'linear-gradient(135deg,#043024,#07160f)',                     // тёмный изумруд (замена off-brand синего/тиловый)
  'linear-gradient(135deg,#1a2b00,#000)',                        // лайм-тон → чёрный (замена off-brand пурпура)
  'linear-gradient(135deg,#6fd400,#3a7a00)',                     // яркий зелёный
  'linear-gradient(135deg,#111,#000)',                           // почти чёрный
  'linear-gradient(135deg,#2e4d0a,#0d1a00)',                     // олива (замена off-brand фиолетового)
  'linear-gradient(135deg,#1a1a1a,#0a1400)',                     // уголь → тёмно-зелёный (замена off-brand коричневого)
];
const CH_AV_BGS = [   // legacy: плоские цвета аватара (оставлены для совместимости, НЕ используются в рендере)
  '#9AFF00','#e8e8e8','#9AFF00','#f0c000','#00c8ff','#ff4da6','#0a0a0a','#9AFF00','#b98cff','#ff9a3c'
];
/* Процедурные фирменные аватары: только чёрный + лайм/зелёное семейство (никаких off-brand цветов).
   g/c — тёмная тема (градиент-фон / цвет глифа), gl/cl — светлая тема (тайлы не должны быть
   чёрными кляксами на белых карточках → в светлой теме все тайлы светлые/лаймовые).
   Индекс = bg канала или хэш ника. */
const CH_AV_GRADS = [
  {g:'linear-gradient(135deg,#c8ff5e,#9AFF00 52%,#6fd400)', c:'#0a0a0a', gl:'linear-gradient(135deg,#c8ff5e,#9AFF00 52%,#7ad400)', cl:'#0a1400'}, // яркий лайм
  {g:'linear-gradient(135deg,#2c2c2c,#0d0d0d)',            c:'#9AFF00', gl:'linear-gradient(135deg,#e9f5d2,#cfe9a4)',            cl:'#2e4d00'}, // графит → светлый лайм
  {g:'linear-gradient(135deg,#9AFF00,#3a7a00)',            c:'#0a0a0a', gl:'linear-gradient(135deg,#b6f56a,#6fc400)',            cl:'#0a1400'}, // лайм → зелёный
  {g:'linear-gradient(135deg,#eaffcf,#b6f56a)',            c:'#1e3a00', gl:'linear-gradient(135deg,#f2ffe0,#d3f2a6)',            cl:'#2e4d00'}, // бледный лайм
  {g:'linear-gradient(135deg,#14330a,#0a0a0a)',            c:'#9AFF00', gl:'linear-gradient(135deg,#d9efb5,#add86e)',            cl:'#274500'}, // тёмн.зелёный → светлый
  {g:'linear-gradient(135deg,#7ad400,#1f4d00)',            c:'#eaffcf', gl:'linear-gradient(135deg,#9ee84a,#5fae10)',            cl:'#0a1400'}, // средний зелёный
  {g:'linear-gradient(135deg,#0a0a0a,#1a1a1a)',            c:'#9AFF00', gl:'linear-gradient(135deg,#eef8db,#c6e792)',            cl:'#2b4a00'}, // чёрный → светлый лайм
  {g:'linear-gradient(135deg,#b6f56a,#7ad000)',            c:'#0a0a0a', gl:'linear-gradient(135deg,#c6f584,#8fd82e)',            cl:'#0a1400'}, // мягкий лайм
  {g:'linear-gradient(135deg,#1f3d00,#0d1a00)',            c:'#b6f56a', gl:'linear-gradient(135deg,#dcefb0,#b3da70)',            cl:'#2a4700'}, // тёмная олива → светлая
  {g:'linear-gradient(135deg,#8fe600,#2e5c00)',            c:'#f2ffe0', gl:'linear-gradient(135deg,#a9e85a,#5fa614)',            cl:'#0f2600'}, // зелёный
];
/* стиль процедурного аватара по индексу (bg канала) или по хэшу строки (участник).
   Отдаём CSS-переменные (--av-g/--av-c тёмная, --av-gl/--av-cl светлая); фон рисует CSS
   через var() → тема переключается чисто в CSS, без ре-рендера. */
function chAvGrad(i){ return CH_AV_GRADS[((+i||0)%CH_AV_GRADS.length+CH_AV_GRADS.length)%CH_AV_GRADS.length]; }
function chHashIdx(s){ s=String(s||'x'); let h=0; for(let k=0;k<s.length;k++) h=(h*31+s.charCodeAt(k))|0; return Math.abs(h)%CH_AV_GRADS.length; }
function chAvVars(g){ return `--av-g:${g.g};--av-c:${g.c};--av-gl:${g.gl};--av-cl:${g.cl}`; }
function chAvGradStyle(i){ return chAvVars(chAvGrad(i)); }
function chAvSeedStyle(s){ return chAvVars(CH_AV_GRADS[chHashIdx(s)]); }
const CH_ICONS = ['megaphone','bolt','fire','rocket','star','crown','globe','compass'];

/* ---------- состояние ---------- */
let CH = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-channels'))||null; }catch(e){ return null; } })();
function chSave(){ try{ localStorage.setItem('oko-channels', JSON.stringify(CH)); }catch(e){} }

function chSeed(){
  const mine = [
    { id:'ch-own-1', name:'OKO Инсайды', desc:'Личный канал: как я строю бизнес внутри OKO. Разборы, цифры, кейсы — без воды.',
      icon:'bolt', bg:0, type:'free', price:0, verified:true, subs:2140, reactions:true, discussions:true,
      admins:[{name:'Марина К.',nick:'marina_k'}], gross:0,
      members:chMockMembers(6), black:[],
      posts:[
        {txt:'Запустил платный канал внутри OKO — за первую неделю 68 подписчиков по 299 ₽. Расклад по цифрам ниже.', likes:184, views:5120, when:'2 ч', media:'poll'},
        {txt:'Правило, которое изменило мой контент: снимай не «что умеешь», а «что у аудитории болит».', likes:97, views:3040, when:'вчера'},
      ]},
    { id:'ch-own-2', name:'Клуб роста · PRO', desc:'Закрытый платный клуб: ежедневные задания, живые разборы, чат участников и доступ к базе шаблонов. Первые 100 участников — по спец-цене.',
      icon:'crown', bg:5, kind:'club', access:'closed', type:'paid', price:299, verified:true, subs:342, reactions:true, discussions:true,
      admins:[{name:'Игорь В.',nick:'igor_v'},{name:'Алина Р.',nick:'alina_r'}], gross:61200,
      members:chMockMembers(9), black:[{name:'Спам-бот 24',nick:'spam24'}],
      posts:[
        {txt:'Разбор недели: как участник клуба сделал 214 000 ₽ на одном запуске. Полная воронка внутри.', likes:220, views:1980, when:'4 ч', media:'circle-play'},
        {txt:'Задание дня: собери оффер по формуле «результат + срок + гарантия». Скидывай в чат клуба.', likes:88, views:1240, when:'сегодня'},
      ]},
    { id:'ch-own-3', name:'Reels под ключ · курс', desc:'Авторский видео-курс: от идеи до вирусного ролика. 8 уроков, шаблоны, разбор твоих работ. Доступ навсегда.',
      icon:'rocket', bg:3, type:'course', price:1490, verified:false, subs:57, reactions:true, discussions:false,
      admins:[], gross:76140,
      members:chMockMembers(5), black:[],
      lessons:[
        {id:'l1', title:'Введение: как устроен вирус', dur:'6:20'},
        {id:'l2', title:'Хук за 3 секунды', dur:'8:05'},
        {id:'l3', title:'Сценарий по формуле AIDA', dur:'7:40'},
        {id:'l4', title:'Съёмка на телефон: свет и звук', dur:'9:15'},
        {id:'l5', title:'Монтаж и караоке-субтитры', dur:'11:30'},
        {id:'l6', title:'Музыка и звуковые акценты', dur:'6:50'},
        {id:'l7', title:'Публикация и алгоритмы', dur:'8:20'},
        {id:'l8', title:'Разбор ошибок и рост канала', dur:'10:10'},
      ],
      posts:[]},
  ];
  const disc = [
    { id:'ch-disc-1', name:'Трафик и деньги', desc:'Платный канал про платный трафик: связки, креативы, окупаемость. Каждую неделю — свежая рабочая связка с цифрами и скринами кабинета.',
      icon:'fire', bg:4, type:'paid', price:199, verified:true, subs:8420, reactions:true, discussions:true, owner:'Артём Долев', ownerNick:'artem_traffic',
      posts:[
        {txt:'Связка недели: Reels → бот → прогрев → продажа курса. ROI 340%. Полная схема и креативы для подписчиков.', likes:0, views:0, when:'1 ч', media:'poll'},
        {txt:'Разбор: почему твои креативы не окупаются — 5 ошибок на конкретных примерах.', likes:0, views:0, when:'вчера'},
        {txt:'Обновил таблицу связок за месяц: 12 рабочих, 4 выгоревших. Смотри в закрепе.', likes:0, views:0, when:'2 дня'},
      ]},
    { id:'ch-disc-2', name:'Нейро-дизайн PRO', desc:'Платный канал по AI-дизайну: Midjourney, nano-banana, обложки, оформление профиля. Промпты и исходники прикладываю к каждому посту.',
      icon:'star', bg:8, type:'paid', price:249, verified:true, subs:5310, reactions:true, discussions:true, owner:'Kate Design', ownerNick:'kate_design',
      posts:[
        {txt:'10 промптов для обложек в фирменном стиле — забирай, тестируй, адаптируй под свой бренд.', likes:0, views:0, when:'3 ч', media:'photo'},
        {txt:'Как за 5 минут собрать оформление профиля, которое продаёт. Разбор + исходники.', likes:0, views:0, when:'вчера'},
      ]},
    { id:'ch-disc-3', name:'Python с нуля · курс', desc:'Пошаговый видео-курс программирования: 10 уроков от переменных до первого бота. Практика после каждого урока, поддержка в чате.',
      icon:'compass', bg:2, type:'course', price:990, verified:false, subs:1204, reactions:true, discussions:true, owner:'Дмитрий Код', ownerNick:'dmitry_code',
      lessons:[
        {id:'l1', title:'Установка и первая программа', dur:'7:00'},
        {id:'l2', title:'Переменные и типы данных', dur:'9:30'},
        {id:'l3', title:'Условия и циклы', dur:'11:00'},
        {id:'l4', title:'Функции', dur:'10:20'},
        {id:'l5', title:'Списки и словари', dur:'12:10'},
        {id:'l6', title:'Работа с файлами', dur:'8:40'},
        {id:'l7', title:'Модули и библиотеки', dur:'9:00'},
        {id:'l8', title:'API и запросы', dur:'13:15'},
        {id:'l9', title:'Первый Telegram-бот', dur:'15:40'},
        {id:'l10', title:'Деплой и что дальше', dur:'10:05'},
      ],
      posts:[]},
    { id:'ch-disc-4', name:'OKO Новости', desc:'Официальный канал обновлений OKO: релизы, фичи, розыгрыши. Бесплатно для всех.',
      icon:'megaphone', bg:6, kind:'channel', access:'open', type:'free', price:0, verified:true, subs:48200, reactions:true, discussions:false, owner:'Команда OKO', ownerNick:'okonews',
      posts:[
        {txt:'Вышли платные каналы и курсы: создавай, продавай, зарабатывай. Комиссия OKO всего 10%.', likes:1240, views:41000, when:'1 ч', media:'circle-play'},
        {txt:'Розыгрыш PRO-подписки среди активных авторов недели. Условия внутри.', likes:820, views:33000, when:'вчера'},
      ]},
    { id:'ch-disc-5', name:'Инсайдеры OKO', desc:'Закрытый бесплатный канал для активных участников: ранний доступ к новым фичам, закрытые созвоны с командой и прямое влияние на дорожную карту. Вступление — по заявке, бесплатно.',
      icon:'star', bg:2, kind:'channel', access:'closed', type:'free', price:0, verified:true, subs:1870, reactions:true, discussions:true, owner:'Команда OKO', ownerNick:'oko_insiders',
      posts:[
        {txt:'Открыли ранний доступ к рекламному кабинету для инсайдеров. Тестируйте и пишите фидбек в обсуждениях.', likes:0, views:0, when:'2 ч', media:'photo'},
        {txt:'Созвон с командой в пятницу 19:00 МСК. Разберём дорожную карту и ответим на вопросы.', likes:0, views:0, when:'вчера'},
      ]},
  ];
  return { v:2, seq:0, pseq:0, mine, disc, sub:{}, prog:{}, likes:{}, cmt:{} };
}
if(!CH || !CH.v){ CH = chSeed(); chSave(); }
CH.sub = CH.sub||{}; CH.prog = CH.prog||{}; CH.likes = CH.likes||{}; CH.votes = CH.votes||{}; CH.notify = CH.notify||{};
CH.cmt = CH.cmt||{}; CH.pseq = CH.pseq||0;   // cmt: комментарии по стабильному id поста; pseq: счётчик id постов
/* стабильный id поста (не зависит от позиции в массиве — лайки/голоса/комменты не «съезжают» после публикации) */
function chPostId(p){ if(p && !p.id){ p.id = 'p'+(++CH.pseq); } return p ? p.id : ''; }
function chEnsurePostIds(c){ (c&&c.posts||[]).forEach(chPostId); }
/* миграция v1→v2: нормализуем оси доступ/оплата, не теряя каналы пользователя */
(function chMigrate(){
  try{
    (CH.mine||[]).forEach(c=>{ chNormalize(c); chEnsurePostIds(c); });
    (CH.disc||[]).forEach(c=>{ chNormalize(c); chEnsurePostIds(c); });
    if((CH.v||1) < 2){
      // добавляем витринные примеры новых осей, если их ещё нет
      const seed = chSeed();
      (seed.disc||[]).forEach(s=>{ if(!CH.disc.some(x=>x.id===s.id)) CH.disc.push(chNormalize(s)); });
      CH.v = 2;
    }
    chSave();
  }catch(e){}
})();

function chMockMembers(n){
  const pool = [
    ['Марина Ковалёва','marina_k'],['Игорь Власов','igor_v'],['Алина Романова','alina_r'],
    ['Сергей Данилов','sergey_d'],['Катя SMM','katya_smm'],['Олег Петров','oleg_p'],
    ['Настя Ким','nastya_kim'],['Роман Гуров','roman_g'],['Лена Соболь','lena_s'],['Артём Лис','artem_l']
  ];
  const days=['5 мин','1 ч','сегодня','вчера','2 дня','неделю'];
  return pool.slice(0,n).map((p,i)=>({name:p[0], nick:p[1], joined:days[i%days.length]}));
}

/* ---------- хелперы ---------- */
const chI = (n,cls)=> (typeof I==='function') ? I(n,cls) : `<svg class="i"><use href="#i-${n}"/></svg>`;
function chEsc(t){ return (typeof esc==='function') ? esc(t) : String(t==null?'':t); }
function chFmtN(n){ return (typeof fmtN==='function') ? fmtN(n) : (n>=1000?(n/1000).toFixed(1).replace('.0','')+'к':n); }
function chChannel(id){ return CH.mine.find(c=>c.id===id) || CH.disc.find(c=>c.id===id) || null; }
function chIsMine(c){ return CH.mine.some(x=>x.id===c.id); }

/* ---- две независимые оси: ДОСТУП (открытый/закрытый) + ОПЛАТА (бесплатно/платно) ----
   плюс вид продукта kind: channel | club | course. gated = нужна витрина для не-участника. */
function chNormalize(c){
  if(!c) return c;
  if(c.kind==null) c.kind = (c.type==='course') ? 'course' : (c.club ? 'club' : 'channel');
  if(c.price==null) c.price = (c.type==='free') ? 0 : (c.price||0);
  if(c.access==null) c.access = (c.type==='paid' || c.type==='course' || c.kind!=='channel' || (c.price||0)>0) ? 'closed' : 'open';
  if(c.reactions==null) c.reactions = true;
  if(c.discussions==null) c.discussions = (c.kind!=='course');
  if(c.kind==='course' && !c.lessons) c.lessons = [{id:'l1',title:'Вводный урок',dur:'5:00'}];
  // --- расширенные настройки управления (глубина Telegram) ---
  if(c.autopost==null)    c.autopost    = true;                               // авто-постинг новых постов в ленту рекомендаций
  if(c.slowmode==null)    c.slowmode    = 0;                                  // медленный режим, сек (0 = выкл)
  if(c.whoPost==null)     c.whoPost     = 'admins';                           // кто может писать: admins | subs
  if(c.privSubs==null)    c.privSubs    = (c.access==='closed'?'admins':'all'); // кто видит список подписчиков: all | subs | admins
  if(c.privFwd==null)     c.privFwd     = true;                               // разрешить пересылку/сохранение постов
  if(c.privHistory==null) c.privHistory = 'visible';                          // история для новых: visible | hidden
  if(c.archived==null)    c.archived    = false;                             // канал в архиве
  if(c.pinned===undefined) c.pinned     = null;                              // id закреплённого поста (закреп)
  if(!Array.isArray(c.invites)) c.invites = [];                              // пригласительные ссылки
  if(c.chatBgUrl===undefined) c.chatBgUrl = null;                            // свой фон чата (data URL)
  if(c.website===undefined)   c.website   = '';                              // сайт-ссылка (PRO)
  if(c.verifyRequested===undefined) c.verifyRequested = false;               // заявка на верификацию
  if(c.kind==='channel' && c.commentsOn===undefined) c.commentsOn = true;    // комменты к постам (админ вкл/выкл)
  // гранулярные права администраторов (как в Telegram): доп-миграция старых записей
  if(Array.isArray(c.admins)) c.admins.forEach(a=>{ if(a && !a.rights) a.rights = chDefaultRights(); });
  // legacy-поле type держим синхронным — вдруг читает внешний код
  c.type = c.kind==='course' ? 'course' : ((c.price||0)>0 ? 'paid' : 'free');
  return c;
}
function chGated(c){ return !!c && (c.kind==='course' || c.access==='closed' || (c.price||0)>0); }
function chPaid(c){ return (c.price||0)>0; }
function chKindLabel(c){ return c.kind==='course'?'Курс':c.kind==='club'?'Клуб':c.kind==='sgroup'?'Супергруппа':c.kind==='chat'?'Чат':'Канал'; }
function chPriceUnit(c){ return c.kind==='course'?'':'/мес'; }
function chIsSubbed(c){ return chIsMine(c) || !!CH.sub[c.id] || !chGated(c); }
/* краткая подпись типа: «Закрытый · Платно 299 ₽/мес» */
function chTypeLabel(t){ return t==='paid'?'Платный':t==='course'?'Курс':'Обычный'; } // legacy
function chAccessLine(c){
  const parts = [c.access==='closed'?'Закрытый':'Открытый'];
  if(c.kind==='course') parts.push(chPaid(c)?c.price+' ₽':'бесплатно');
  else parts.push(chPaid(c)?('Платно '+c.price+' ₽'+chPriceUnit(c)):'Бесплатно');
  return parts.join(' · ');
}
/* компактная подпись для строк-настроек (без слова «Платно» — цена и так его подразумевает),
   чтобы значение помещалось на 390px без обрезки */
function chAccessLineShort(c){
  const access = c.access==='closed'?'Закрытый':'Открытый';
  if(c.kind==='course') return 'Курс · '+(chPaid(c)?c.price+' ₽':'бесплатно');
  return access+' · '+(chPaid(c)?(c.price+' ₽'+chPriceUnit(c)):'бесплатно');
}
/* SVG-бейджи для карточки/витрины */
function chBadges(c){
  let h='';
  if(c.access==='closed') h+=`<span class="ch-tag closed">${chI('lock')}Закрытый</span>`;
  if(c.kind==='course') h+=`<span class="ch-tag course">${chI('circle-play')}Курс</span>`;
  else if(c.kind==='club') h+=`<span class="ch-tag club">${chI('crown')}Клуб</span>`;
  if(chPaid(c)) h+=`<span class="ch-tag paid">${c.kind==='course'?c.price+' ₽':'Платно '+c.price+' ₽'+chPriceUnit(c)}</span>`;
  else if(c.access==='closed') h+=`<span class="ch-tag free">Бесплатно</span>`;
  return h;
}
function chAvStyle(c){ return `background:${CH_BGS[c.bg||0]};`; }
function chAvInner(c,cls,lock){
  const lk = lock ? `<span class="ch-avlock">${chI('lock')}</span>` : '';
  if(c.avatar){
    return `<div class="ch-av ${cls||''}" style="${chAvPhoto(c)}">${lk}</div>`;
  }
  const content = c.icon ? chI(c.icon) : chEsc((c.name[0]||'K').toUpperCase());
  return `<div class="ch-av ${cls||''}" style="${chAvGradStyle(c.bg||0)}">${content}${lk}</div>`;
}
function chCourseProg(c){
  if(c.kind!=='course' || !c.lessons) return 0;
  const done = (CH.prog[c.id]||[]).length;
  return Math.round(done/c.lessons.length*100);
}
function chBadge(c){ return c.verified ? `<svg class="i fill" style="width:0.95em;height:0.95em;vertical-align:-0.12em;margin-left:1px;color:var(--lime)"><use href="#i-verified"/></svg>` : ''; }
function chSlug(s){ return String(s||'').toLowerCase().replace(/[^a-zа-я0-9_]/gi,'').replace(/ё/g,'е').slice(0,18) || 'channel'; }
function chNick(c){ if(!c.nick) c.nick = chSlug(c.name); return c.nick; }
/* url(...) для фото-аватара/обложки, если владелец загрузил картинку */
function chAvPhoto(c){ return c.avatar ? `background-image:url(${c.avatar});background-size:cover;background-position:center;color:transparent` : ''; }

/* ===== Telegram-grade управление: сгруппированные списки, строки-контролы, пикеры ===== */
/* группа строк в одной карточке с разделителями (как настройки Telegram/iOS) */
function chList(rows){ return `<div class="ch-list">${(rows||[]).filter(Boolean).join('')}</div>`; }
function chLF(txt){ return `<div class="ch-lf">${txt}</div>`; }
/* строка-переход: иконка + заголовок(+подпись) + значение справа + шеврон/копи */
function chNavRow(ic, label, val, onclick, o){
  o = o||{};
  const rv = (val!=null && val!=='') ? `<span class="ch-rv-t${o.lime?' lime':''}">${val}</span>` : '';
  const tail = o.copy ? chI('copy') : (o.noChev ? '' : chI('chev'));
  return `<button class="ch-row${o.danger?' danger':''}" onclick="${onclick}">
    ${ic?`<span class="ch-row-ic${o.danger?' danger':''}">${chI(ic)}</span>`:''}
    <span class="ch-row-main"><b>${label}</b>${o.sub?`<small>${o.sub}</small>`:''}</span>
    <span class="ch-row-val">${rv}${tail}</span>
  </button>`;
}
/* строка-ссылка: URL занимает всю ширину под заголовком (не обрезается на 390px как боковое значение) */
function chLinkRow(ic, label, url, onclick){
  return `<button class="ch-row" onclick="${onclick}">
    ${ic?`<span class="ch-row-ic">${chI(ic)}</span>`:''}
    <span class="ch-row-main"><b>${label}</b><small class="ch-url">${chEsc(url)}</small></span>
    <span class="ch-row-val">${chI('copy')}</span>
  </button>`;
}
/* строка-тумблер: клик переключает состояние (surgical, без полного ре-рендера) */
function chTglRow(ic, label, sub, on, onclick){
  return `<button class="ch-row" onclick="${onclick}">
    ${ic?`<span class="ch-row-ic">${chI(ic)}</span>`:''}
    <span class="ch-row-main"><b>${label}</b>${sub?`<small>${sub}</small>`:''}</span>
    <span class="switch ${on?'on':''}"><i></i></span>
  </button>`;
}
/* значение-подписи для настроек */
function chNotifyOn(c){ return CH.notify[c.id]!==false; }
function chSlowLabel(s){ s=+s||0; return s===0?'выкл':(s<60?s+' сек':(s/60)+' мин'); }
function chWhoPostLabel(c){ return c.whoPost==='subs'?'Все подписчики':'Только админы'; }
function chPrivSubsLabel(c){ return c.privSubs==='all'?'Все':c.privSubs==='subs'?'Подписчики':'Только админы'; }
function chPrivHistLabel(c){ return c.privHistory==='hidden'?'Скрыта':'Видна'; }
/* публичная ссылка канала — реальный домен OKO в стиле @id */
function chPublicLink(c){ return 'okoteam.top/@'+chNick(c); }

/* ---- закрепы (pinned) ---- */
/* id закреплённого поста, если он всё ещё существует (самоочистка от «висячих» ссылок) */
function chPinnedId(c){ if(!c||!c.pinned) return null; return (c.posts||[]).some(p=>chPostId(p)===c.pinned) ? c.pinned : null; }

/* ---- гранулярные права администратора (как в Telegram) ---- */
const CH_RIGHTS = [
  ['post','megaphone','Публикация постов','Создавать и отправлять записи в канал'],
  ['edit','edit','Редактирование','Изменять и удалять любые посты'],
  ['pin','pin','Закреплять сообщения','Управлять закреплённой записью'],
  ['ban','lock','Блокировка участников','Банить и разблокировать людей'],
  ['invite','forward','Приглашения','Создавать пригласительные ссылки'],
  ['addAdmins','crown','Назначение админов','Добавлять новых администраторов']
];
function chDefaultRights(){ return {post:true, edit:true, pin:true, ban:true, invite:true, addAdmins:false}; }
function chRightsSummary(a){
  const r=(a&&a.rights)||{}, keys=CH_RIGHTS.map(x=>x[0]);
  const on=keys.filter(k=>r[k]).length;
  return on>=keys.length ? 'Полные права' : (on===0 ? 'Права ограничены' : on+' из '+keys.length+' прав');
}

/* быстрый тумблер булевого поля канала — переключаем класс на месте, без chRender */
window.chTgl = function(id, key, el){
  const c = chChannel(id); if(!c) return;
  c[key] = !c[key]; chSave();
  if(el){ const sw = el.querySelector('.switch'); if(sw) sw.classList.toggle('on', !!c[key]); }
  if(key==='discussions') toast(c[key]?'Обсуждения включены':'Обсуждения выключены');
  else if(key==='reactions') toast(c[key]?'Реакции включены':'Реакции выключены');
  else if(key==='autopost') toast(c[key]?'Авто-постинг включён':'Авто-постинг выключен');
  else if(key==='archived') toast(c[key]?'Канал в архиве':'Канал возвращён из архива');
};
/* уведомления подписчика (по-канальная тишина) */
window.chToggleNotify = function(id, el){
  const c = chChannel(id); if(!c) return;
  const nowOn = CH.notify[id]!==false;
  CH.notify[id] = nowOn ? false : true; chSave();
  if(el){
    const sw = el.querySelector('.switch');
    if(sw){ sw.classList.toggle('on', !nowOn); }
    else { el.classList.toggle('on', !nowOn); const sp = el.querySelector('span'); if(sp) sp.textContent = (!nowOn)?'Уведомления':'Без звука'; }
  }
  toast(nowOn?'Уведомления выключены':'Уведомления включены');
};

/* универсальный выбор из вариантов (как action sheet Telegram) */
function chChooser(title, body, options){
  if(typeof showPopup!=='function'){ return; }
  showPopup({ title, body, actions: options.concat([{label:'Отмена', ghost:true}]) });
}
window.chPickSlow = function(id){
  const c = chChannel(id); if(!c) return;
  chChooser('Медленный режим', 'Минимальный интервал между сообщениями участников', [0,10,30,60,300,900].map(s=>({
    label: chSlowLabel(s), onclick:()=>{ c.slowmode=s; chSave(); chRender(); toast('Медленный режим: '+chSlowLabel(s)); }
  })));
};
window.chPickWhoPost = function(id){
  const c = chChannel(id); if(!c) return;
  chChooser('Кто может писать', 'Кому разрешено публиковать в канале', [
    {label:'Только админы', onclick:()=>{ c.whoPost='admins'; chSave(); chRender(); }},
    {label:'Все подписчики', onclick:()=>{ c.whoPost='subs'; chSave(); chRender(); }},
  ]);
};
window.chPickPrivSubs = function(id){
  const c = chChannel(id); if(!c) return;
  chChooser('Кто видит подписчиков', 'Видимость списка участников канала', [
    {label:'Все', onclick:()=>{ c.privSubs='all'; chSave(); chRender(); }},
    {label:'Подписчики', onclick:()=>{ c.privSubs='subs'; chSave(); chRender(); }},
    {label:'Только админы', onclick:()=>{ c.privSubs='admins'; chSave(); chRender(); }},
  ]);
};
window.chPickPrivHist = function(id){
  const c = chChannel(id); if(!c) return;
  chChooser('История для новых', 'Что видят только что вступившие подписчики', [
    {label:'Видна вся история', onclick:()=>{ c.privHistory='visible'; chSave(); chRender(); }},
    {label:'Скрыта до вступления', onclick:()=>{ c.privHistory='hidden'; chSave(); chRender(); }},
  ]);
};

/* поделиться каналом (нативный share → иначе копирование ссылки) */
window.chShareChannel = function(id){
  const c = chChannel(id); if(!c) return;
  const link = chPublicLink(c);
  try{
    if(navigator.share){ navigator.share({title:c.name, text:'Канал в OKO', url:'https://'+link}).catch(()=>{}); }
    else if(navigator.clipboard){ navigator.clipboard.writeText(link); }
  }catch(e){}
  toast('Ссылка на канал скопирована');
};
/* меню «Ещё» — action sheet для владельца и подписчика */
window.chMoreMenu = function(id){
  const c = chChannel(id); if(!c) return;
  const mine = chIsMine(c);
  const acts = [
    {label:'Поделиться', onclick:()=>chShareChannel(id)},
    {label:'Скопировать ссылку', onclick:()=>chCopyLink(id)},
  ];
  if(mine){
    acts.push({label:'Управление каналом', onclick:()=>chGo('manage',id)});
    acts.push({label:'Статистика', onclick:()=>chGo('mStats',id)});
  } else {
    acts.push({label: chNotifyOn(c)?'Выключить уведомления':'Включить уведомления', onclick:()=>chToggleNotify(id)});
    acts.push({label:'Пожаловаться', onclick:()=>toast('Жалоба отправлена на модерацию')});
    if(chGated(c)) acts.push({label: chPaid(c)?'Отменить подписку':'Покинуть канал', ghost:true, onclick:()=>chUnsub(id)});
  }
  acts.push({label:'Закрыть', ghost:true});
  if(typeof showPopup==='function') showPopup({ico:'more', title:chEsc(c.name), body:'@'+chEsc(chNick(c)), actions:acts});
};

/* канал публикует пост → он попадает и в ленту рекомендаций (как Instagram) */
let CH_FEED_SEQ = 900000;
function chPushToFeed(c, post){
  if(typeof POSTS==='undefined' || !POSTS.rec) return;
  const id = ++CH_FEED_SEQ;
  post._feedId = id;
  POSTS.rec.unshift({
    id, ava:(c.name[0]||'K').toUpperCase(), avaIcon:c.icon||null, avaImg:c.avatar||null,
    name:c.name, sub:(c.kind==='club'?'клуб':c.kind==='course'?'курс':'канал')+' · '+chFmtN(c.subs||0), body:post.txt||'',
    media: post.img ? null : (post.media==='circle-play'?'0:30':post.media==='poll'?'опрос':null),
    img: post.img||null, likes:post.likes||0, views:post.views||1,
    liked:false, saved:false, reposts:0, comments:[], chOrigin:c.id, chKind:c.kind||'channel'
  });
  if(typeof renderFeed==='function' && typeof curFeedKind!=='undefined' && curFeedKind==='rec'){ try{ renderFeed('rec'); }catch(e){} }
}
/* чтение картинки с устройства → сжатие в dataURL (persist-safe) */
function chReadImage(file, maxW, quality, cb){
  if(!file || !/^image\//.test(file.type)){ toast('Выберите изображение'); return; }
  const rd = new FileReader();
  rd.onload = e=>{
    const img = new Image();
    img.onload = ()=>{
      const sc = Math.min(1, maxW/img.width);
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width*sc); cv.height = Math.round(img.height*sc);
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      let out; try{ out = cv.toDataURL('image/jpeg', quality); }catch(err){ out = e.target.result; }
      cb(out);
    };
    img.onerror = ()=>toast('Не удалось прочитать изображение');
    img.src = e.target.result;
  };
  rd.onerror = ()=>toast('Ошибка чтения файла');
  rd.readAsDataURL(file);
}
/* невидимый file-input, вызывается по кнопке */
function chPickFile(onFile){
  const inp = document.createElement('input');
  inp.type='file'; inp.accept='image/*'; inp.style.display='none';
  inp.onchange = ()=>{ const f=inp.files&&inp.files[0]; if(f) onFile(f); inp.remove(); };
  document.body.appendChild(inp); inp.click();
}

/* ================= НАВИГАЦИЯ ВЬЮХИ (внутренний стек страниц) ================= */
let chNav = [];   // [{page, arg}]
let chListFilter = {q:'', kind:'all'};   // поиск+фильтр по списку каналов

function chOpen(page, arg){
  const v = document.getElementById('chView');
  if(!v) return;
  const fresh = !v.classList.contains('open');
  if(fresh) chNav = [];
  chNav.push({page:page||'list', arg:arg||null});
  chRender();
  if(fresh){
    v.classList.add('open');
    if(typeof nvPush==='function') nvPush('view:channels', chClose, chStep);
  }
}
function chGo(page, arg){ chOpen(page, arg); }   // deeper navigation (view already open)
function chStep(){ if(chNav.length>1){ chNav.pop(); chRender(); return true; } return false; }
function chBack(){ if(chNav.length>1){ chNav.pop(); chRender(); } else chClose(); }
function chClose(){
  const v = document.getElementById('chView');
  if(v) v.classList.remove('open');
  chNav = [];
  if(typeof nvPop==='function') nvPop('view:channels');
}

/* ---------- роутер рендера ---------- */
function chRender(){
  const top = chNav[chNav.length-1] || {page:'list'};
  const body = document.getElementById('chBody');
  const titleEl = document.getElementById('chHeadTitle');
  const tools = document.getElementById('chHeadTools');
  if(!body) return;
  tools.innerHTML = '';
  /* сохраняем позицию прокрутки при повторном рендере той же страницы (лайк/голос/фильтр) */
  const sig = top.page+':'+(top.arg && typeof top.arg==='object' ? JSON.stringify(top.arg) : (top.arg==null?'':top.arg));
  const keepScroll = (chRender._sig === sig);
  const prevScroll = keepScroll ? body.scrollTop : 0;
  let out = {title:'Каналы', html:''};
  switch(top.page){
    case 'list':    out = chPageList(); break;
    case 'create':  out = chPageCreate(); break;
    case 'catalog': out = chPageCatalog(); break;
    case 'channel': out = chPageChannel(top.arg); break;
    case 'lesson':  out = chPageLesson(top.arg); break;
    case 'compose': out = chPageCompose(top.arg); break;
    case 'addLesson': out = chPageAddLesson(top.arg); break;
    case 'manage':  out = chPageManage(top.arg); break;
    case 'mType':   out = chPageMType(top.arg); break;
    case 'mSubs':   out = chPageMSubs(top.arg); break;
    case 'mAdmins': out = chPageMAdmins(top.arg); break;
    case 'mAdminRights': out = chPageMAdminRights(top.arg); break;
    case 'mBlack':  out = chPageMBlack(top.arg); break;
    case 'mStats':  out = chPageMStats(top.arg); break;
    case 'mAppear': out = chPageMAppear(top.arg); break;
    case 'mSettings': out = chPageMSettings(top.arg); break;
    case 'mInvites': out = chPageMInvites(top.arg); break;
    default: out = chPageList();
  }
  titleEl.textContent = out.title;
  if(out.tools) tools.innerHTML = out.tools;
  body.innerHTML = out.html;
  body.scrollTop = keepScroll ? prevScroll : 0;
  chRender._sig = sig;
  if(out.after) try{ out.after(); }catch(e){}
}

/* ================= СТРАНИЦА: МОИ КАНАЛЫ ================= */
function chPageList(){
  const subbed = CH.disc.filter(c=>CH.sub[c.id]);
  const discover = CH.disc.filter(c=>!CH.sub[c.id]);
  const card = (c,ctx)=>{
    const subbed = chIsSubbed(c);
    const prog = c.kind==='course' ? chCourseProg(c) : null;
    const sub = c.kind==='course'
      ? `${chI('circle-play')} ${c.lessons?c.lessons.length:0} уроков${prog!=null&&subbed?` · ${prog}%`:''}`
      : `${chI('users')} ${chFmtN(c.subs||0)} подписчиков`;
    const locked = chGated(c) && !subbed;
    let right = '';
    if(ctx!=='mine'){
      if(subbed) right = `<span class="ch-tag free">${chI('check')}доступ</span>`;
      else if(chPaid(c)) right = `<span class="ch-price-pill">${c.price} ₽${chPriceUnit(c)}</span>`;
      else if(c.access==='closed') right = `<span class="ch-price-pill dim-pill">${chI('lock')}заявка</span>`;
    }
    return `<div class="ch-card" onclick="chGo('channel','${c.id}')">
      ${chAvInner(c, locked?'locked':'', locked)}
      <div class="ch-cbody">
        <div class="ch-cname"><span style="min-width:0;flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${chEsc(c.name)}</span>${chBadge(c)}</div>
        <div class="ch-csub">${sub}</div>
        <div class="ch-cbadges">${chBadges(c)}</div>
      </div>
      ${right}</div>`;
  };
  let html = `<button class="ch-create-cta" onclick="chGo('create')">
      <span class="ch-cc-ic">${chI('plus')}</span>
      <span><b>Создать канал</b><small>Канал, клуб или видео-курс · открытый/закрытый, платный/бесплатный</small></span>
    </button>`;
  html += `<div class="ch-sec-h">${chI('crown')} Мои каналы</div>`;
  html += CH.mine.length ? CH.mine.map(c=>card(c,'mine')).join('')
    : `<div class="ch-empty">Пока нет своих каналов. Создай первый — и начни зарабатывать.</div>`;
  if(subbed.length){
    html += `<div class="ch-sec-h">${chI('bookmark')} Мои подписки</div>`;
    html += subbed.map(c=>card(c,'sub')).join('');
  }
  html += `<div class="ch-sec-h">${chI('compass')} Рекомендуем · каналы, клубы и курсы</div>`;
  html += discover.map(c=>card(c,'disc')).join('');
  return {title:'Каналы', html};
}

/* ================= СТРАНИЦА: КАТАЛОГ ПЛАТНЫХ КАНАЛОВ/КЛУБОВ/КУРСОВ =================
   Полноэкранная витрина только закрытого/платного контента. Фильтры: ниша, цена,
   формат, сортировка. Правка Даниэля 29.07 — «список с фильтрами по всем закрытым
   платным каналам/клубам/курсам». Данные — из CH.disc + CH.mine (не свои). */
const CH_NICHES = [
  {k:'all',  name:'Все'},
  {k:'smm',  name:'SMM и трафик'},
  {k:'biz',  name:'Бизнес и продажи'},
  {k:'psy',  name:'Психология'},
  {k:'des',  name:'Дизайн и AI'},
  {k:'fin',  name:'Финансы'},
  {k:'edu',  name:'Образование'},
  {k:'life', name:'Стиль жизни'},
];
function chNiche(c){
  if(c.niche) return c.niche;
  const s = ((c.name||'')+' '+(c.desc||'')).toLowerCase();
  if(/(smm|reels|traffic|трафик|блог|инстаг|тикток|аудит|видео|reels)/.test(s)) return 'smm';
  if(/(бизнес|продаж|деньг|доход|запуск|воронк|прибыл|роста|инсайд)/.test(s)) return 'biz';
  if(/(психолог|отношен|самооценк|терап|тревог|эмоц)/.test(s)) return 'psy';
  if(/(дизайн|нейро|midjourney|ai|обложк|интерфейс|figma|graphic)/.test(s)) return 'des';
  if(/(финанс|инвест|акции|крипт|бюджет|ipo|фондов)/.test(s)) return 'fin';
  if(/(курс|учеб|обучен|уроки|школ|мастер|python|программ)/.test(s)) return 'edu';
  return 'life';
}
/* мок-рейтинг: стабильный по id, чтобы одна и та же карточка всегда 4.6/4.8/… */
function chRating(c){
  const s = String(c.id||c.name||''); let h=0; for(let i=0;i<s.length;i++) h=(h*33+s.charCodeAt(i))|0;
  return (40 + Math.abs(h)%15) / 10;  // 4.0 … 5.4 → нормируем
}
function chRatingN(c){ const r = chRating(c); return Math.min(5, +r.toFixed(1)); }

const CH_CAT = {niche:'all', price:'any', kind:'any', sort:'top'};
function chPageCatalog(){
  const all = ((CH.disc||[]).concat((CH.mine||[]).filter(c=>false)))  /* только чужие */
    .filter(c=>chGated(c));   /* только закрытое/платное — как просил Даниэль */
  const priceMax = {any:Infinity, '500':500, '1000':1000, '2500':2500, '5000':5000};
  const list = all.filter(c=>{
    if(CH_CAT.niche!=='all' && chNiche(c)!==CH_CAT.niche) return false;
    if(CH_CAT.kind!=='any' && (c.kind||'channel')!==CH_CAT.kind) return false;
    const pm = priceMax[CH_CAT.price] ?? Infinity;
    if((c.price||0) > pm) return false;
    return true;
  }).sort((a,b)=>{
    if(CH_CAT.sort==='new')   return (b.subs||0)*0.1 - (a.subs||0)*0.1 + (Math.random()-0.5);  // мок: без даты — рандом
    if(CH_CAT.sort==='cheap') return (a.price||0) - (b.price||0);
    if(CH_CAT.sort==='rating')return chRating(b)  - chRating(a);
    return (b.subs||0) - (a.subs||0);  // top
  });

  const niches = CH_NICHES.map(n=>`<button class="ch-cat-chip ${CH_CAT.niche===n.k?'on':''}" onclick="chCatSet('niche','${n.k}')">${chEsc(n.name)}</button>`).join('');
  const prices = [['any','Любая'],['500','до 500 ₽'],['1000','до 1000 ₽'],['2500','до 2500 ₽'],['5000','до 5000 ₽']]
    .map(([k,l])=>`<button class="ch-cat-chip ${CH_CAT.price===k?'on':''}" onclick="chCatSet('price','${k}')">${l}</button>`).join('');
  const kinds = [['any','Все'],['channel','Каналы'],['club','Клубы'],['course','Курсы']]
    .map(([k,l])=>`<button class="ch-cat-chip ${CH_CAT.kind===k?'on':''}" onclick="chCatSet('kind','${k}')">${l}</button>`).join('');
  const sorts = [['top','Топ'],['new','Новые'],['cheap','Дешевле'],['rating','Рейтинг']]
    .map(([k,l])=>`<button class="ch-cat-chip ${CH_CAT.sort===k?'on':''}" onclick="chCatSet('sort','${k}')">${l}</button>`).join('');

  const cards = list.map(c=>{
    const paid = chPaid(c);
    const priceHtml = paid
      ? `<span class="ch-catx-price">${c.price} ₽${chPriceUnit(c)}</span>`
      : `<span class="ch-catx-price free">Бесплатно</span>`;
    const rating = chRatingN(c);
    const stars = `<span class="ch-catx-star">${chI('star')}${rating.toFixed(1)}</span>`;
    const kindTag = c.kind==='course'?'Курс':c.kind==='club'?'Клуб':'Канал';
    return `<button class="ch-catx-card" onclick="chGo('channel','${c.id}')">
      <div class="ch-catx-hero" style="background:${CH_BGS[c.bg||0]}">
        <span class="ch-catx-kind">${chI(c.kind==='course'?'circle-play':c.kind==='club'?'crown':'megaphone')}${kindTag}</span>
        ${priceHtml}
      </div>
      <div class="ch-catx-body">
        <div class="ch-catx-name">${chEsc(c.name)}${chBadge(c)}</div>
        <div class="ch-catx-sub">${chEsc(c.owner||'@'+chNick(c))}</div>
        <div class="ch-catx-meta">${stars}<span>${chI('users')}${chFmtN(c.subs||0)}</span></div>
      </div>
    </button>`;
  }).join('');

  const empty = list.length ? '' : `<div class="ch-empty">По фильтрам ничего не нашлось. Сбрось фильтры и попробуй снова.</div>`;
  const html = `
    <div class="ch-cat-hint">${chI('bookmark')} Каталог платных каналов, клубов и курсов OKO. Комиссия платформы 10% — авторы получают остальное.</div>
    <div class="ch-cat-filter">
      <div class="ch-cat-lab">Ниша</div>
      <div class="ch-cat-chips">${niches}</div>
      <div class="ch-cat-lab">Цена</div>
      <div class="ch-cat-chips">${prices}</div>
      <div class="ch-cat-lab">Формат</div>
      <div class="ch-cat-chips">${kinds}</div>
      <div class="ch-cat-lab">Сортировка</div>
      <div class="ch-cat-chips">${sorts}</div>
    </div>
    <div class="ch-cat-count">${list.length} ${list.length%10===1&&list.length%100!==11?'канал':'каналов'}</div>
    <div class="ch-catx-grid">${cards}</div>
    ${empty}`;
  return {title:'Каталог', html};
}
window.chCatSet = function(k,v){ CH_CAT[k]=v; chRender(); };

/* ================= СТРАНИЦА: СОЗДАНИЕ (правки Даниэля 29.07) =================
   Единый мастер: чат / супергруппа / канал / клуб / курс. TG-parity: ава+обложка
   можно грузить с устройства прямо в создании, PRO-фичи (ссылка на сайт, галочка
   верификации, кастомный фон чата) размечены значком PRO и открываются с START+. */
const chDraft = {
  kind:'channel', access:'open', name:'', desc:'',
  price:0, bg:0, chatBg:null, chatBgUrl:null,
  icon:'megaphone', useIcon:false,
  cover:null, avatar:null,
  website:'', verified:false
};
function chIsPro(){ try{ return (typeof okoIsPremium==='function') && okoIsPremium(); }catch(e){ return false; } }
function chFreeBgs(){ return CH_BGS.slice(0,5); }  /* FREE — только 5 стандартных */
function chAllowedBgs(){ return chIsPro() ? CH_BGS : chFreeBgs(); }
function chPageCreate(){
  const d = chDraft;
  const kinds = [
    ['channel','megaphone','Канал','Лента постов для аудитории. Пишет только админ, юзеры — в комментарии, если админ разрешил.'],
    ['sgroup','users','Супергруппа','Как в Telegram: до 200 000 участников, темы, роли, модерация.'],
    ['club','crown','Клуб','Закрытое комьюнити по подписке: посты, чат и бонусы участникам.'],
    ['course','circle-play','Видео-курс','Уроки с прогрессом. Продажа за фикс-цену, доступ навсегда.'],
  ];
  const lockAccess = d.kind==='course';   // курс всегда закрытый
  const lockPaid = d.kind==='course';     // курс всегда платный
  const paid = (d.price||0)>0;
  const kl = chKindLabel(d).toLowerCase();
  const pro = chIsPro();
  const bgs = chAllowedBgs();
  const proTag = pro ? '' : ' <span class="ch-pro-tag" title="PRO">PRO</span>';
  const html = `
    <div class="ch-sec-h">${chI('bolt')} Что создаём</div>
    <div class="ch-type-grid">${kinds.map(([t,ic,tt,ds])=>`
      <button class="ch-type-card ${d.kind===t?'on':''}" onclick="chPickKind('${t}')">
        <span class="ch-tc-ic">${chI(ic)}</span>
        <span style="flex:1;min-width:0"><b>${tt}</b><small>${ds}</small></span>
        <span class="ch-tc-check">${chI('check')}</span>
      </button>`).join('')}</div>

    <div class="ch-sec-h">${chI('lock')} Доступ</div>
    <div class="ch-choice2${lockAccess?' locked':''}">
      <button class="ch-ch2 ${d.access==='open'?'on':''}" ${lockAccess?'disabled':''} onclick="chDraftAccess('open')">${chI('globe')}<b>Открытый</b><small>Виден и читается всем</small></button>
      <button class="ch-ch2 ${d.access==='closed'?'on':''}" ${lockAccess?'disabled':''} onclick="chDraftAccess('closed')">${chI('lock')}<b>Закрытый</b><small>Доступ по подписке/оплате</small></button>
    </div>
    ${lockAccess?`<div class="ch-owner-note">Курс всегда закрытый — уроки открываются после покупки.</div>`:''}

    <div class="ch-sec-h">${chI('money')} Оплата</div>
    <div class="ch-choice2${lockPaid?' locked':''}">
      <button class="ch-ch2 ${!paid?'on':''}" ${lockPaid?'disabled':''} onclick="chDraftPaid(false)">${chI('check')}<b>Бесплатно</b><small>Без платы за доступ</small></button>
      <button class="ch-ch2 ${paid?'on':''}" ${lockPaid?'disabled':''} onclick="chDraftPaid(true)">${chI('card')}<b>Платно</b><small>${d.kind==='course'?'Разовая цена':'Подписка ₽/мес'}</small></button>
    </div>

    <label class="ch-lab">Название · ${kl}</label>
    <input class="ch-input" id="chDName" maxlength="42" placeholder="Например: Клуб роста PRO" value="${chEsc(d.name)}" oninput="chDraft.name=this.value;chSyncCreateBtn()">

    <label class="ch-lab">Описание${(d.access==='closed'||paid)?' — видно на витрине':''}</label>
    <textarea class="ch-ta" id="chDDesc" rows="3" maxlength="240" placeholder="О чём канал, что получит подписчик…" oninput="chDraft.desc=this.value">${chEsc(d.desc)}</textarea>

    <div id="chPriceBlock" style="display:${paid?'block':'none'}">
      <label class="ch-lab">${d.kind==='course'?'Цена курса (разовая)':'Цена подписки в месяц'}</label>
      <div class="ch-price-row">
        <input class="ch-input" id="chDPrice" inputmode="numeric" value="${d.price}" oninput="chDraft.price=+this.value.replace(/\\D/g,'')||0;chSyncPriceChips()">
        <span class="ch-unit">₽${chPriceUnit(d)}</span>
      </div>
      <div class="ch-price-chips" id="chPriceChips">${chPriceChips()}</div>
      <div class="ch-owner-note">Ты получишь <b id="chNetHint">${chNet(d.price)} ₽</b> с каждой продажи, OKO удержит комиссию 10%.</div>
    </div>

    <label class="ch-lab">Аватар</label>
    <div class="ch-avatar-row">
      <div class="ch-avatar-prev" style="${d.avatar?('background-image:url('+d.avatar+');background-size:cover;background-position:center'):chAvGradStyle(d.bg)}">
        ${!d.avatar ? (d.useIcon?chI(d.icon):chEsc((d.name[0]||'A').toUpperCase())) : ''}
      </div>
      <div class="ch-avatar-actions">
        <button class="ch-photo-btn" onclick="chDraftPickAvatar()">${chI('camera')} ${d.avatar?'Сменить фото':'Загрузить фото'}</button>
        ${d.avatar?`<button class="ch-photo-btn del" onclick="chDraftClearAvatar()" title="Убрать">${chI('trash')}</button>`:''}
      </div>
    </div>

    <label class="ch-lab">Значок <span style="font-weight:400;color:var(--dim)">— если без фото</span></label>
    <div class="ch-letter-row" id="chIconRow">
      <button class="ch-lt ${!d.useIcon?'on':''}" onclick="chDraft.useIcon=false;chRender()" title="Первая буква названия"><span style="font:800 18px/1 var(--font-display);color:var(--lime)">A</span></button>
      ${CH_ICONS.map(ic=>`<button class="ch-lt ${d.useIcon&&d.icon===ic?'on':''}" onclick="chDraft.useIcon=true;chDraft.icon='${ic}';chRender()">${chI(ic)}</button>`).join('')}
    </div>

    <label class="ch-lab">Фон обложки</label>
    <div class="ch-appear-prev" id="chBgPrev" style="${d.cover?('background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.5)),url('+d.cover+');background-size:cover;background-position:center'):('background:'+CH_BGS[d.bg])}">
      <div class="ch-ap-ava" style="${d.avatar?('background-image:url('+d.avatar+');background-size:cover;background-position:center'):chAvGradStyle(d.bg)}">${d.avatar?'':(d.useIcon?chI(d.icon):chEsc((d.name[0]||'K').toUpperCase()))}</div>
      <div class="ch-ap-name">${chEsc(d.name||'Новый '+kl)}</div>
    </div>
    <div class="ch-cover-actions">
      <button class="ch-photo-btn" onclick="chDraftPickCover()">${chI('photo')} ${d.cover?'Сменить обложку':'Загрузить обложку'}</button>
      ${d.cover?`<button class="ch-photo-btn del" onclick="chDraftClearCover()" title="Убрать">${chI('trash')}</button>`:''}
    </div>
    <div class="ch-swatches">${bgs.map((g,i)=>`<div class="ch-sw ${d.bg===i?'on':''}" style="background:${g}" onclick="chDraft.bg=${i};chRender()"></div>`).join('')}</div>
    ${!pro?`<div class="ch-owner-note">Показаны 5 стандартных фонов. Дополнительные фоны — на тарифе <b>START+</b>.</div>`:''}

    <label class="ch-lab">Фон чата ${!pro?proTag:''}<span style="font-weight:400;color:var(--dim)"> — за лентой сообщений</span></label>
    <div class="ch-swatches">
      <div class="ch-sw ch-sw-none ${d.chatBg==null && !d.chatBgUrl?'on':''}" onclick="chDraft.chatBg=null;chDraft.chatBgUrl=null;chRender()" title="Без фона">${chI('check2')}</div>
      ${bgs.map((g,i)=>`<div class="ch-sw ${d.chatBg===i && !d.chatBgUrl?'on':''}" style="background:${g}" onclick="chDraft.chatBg=${i};chDraft.chatBgUrl=null;chRender()"></div>`).join('')}
      ${d.chatBgUrl?`<div class="ch-sw on" style="background-image:url(${d.chatBgUrl});background-size:cover" title="Свой фон">${chI('check2')}</div>`:''}
    </div>
    ${pro?`<button class="ch-photo-btn ch-mt-6" onclick="chDraftPickChatBg()">${chI('photo')} ${d.chatBgUrl?'Сменить свой фон':'Свой фон из файла'}</button>`:`<div class="ch-owner-note">Загрузка собственного фона чата доступна на тарифе <b>START+</b>.</div>`}

    <label class="ch-lab">Ссылка на сайт ${proTag}<span style="font-weight:400;color:var(--dim)"> — кнопка в шапке канала</span></label>
    <input class="ch-input" id="chDSite" ${pro?'':'disabled'} placeholder="https://okoteam.top" value="${chEsc(d.website||'')}" oninput="chDraft.website=this.value.trim()">

    <label class="ch-check-row"><input type="checkbox" ${d.verified?'checked':''} ${pro?'':'disabled'} onchange="chDraft.verified=this.checked;chRender()">
      <span>Заявка на верификацию ${proTag}<small>Синяя галочка — модерация OKO проверит канал вручную</small></span>
    </label>

    ${d.kind==='sgroup' || d.kind==='chat' ? `<div class="ch-owner-note">${chI('users')} При росте свыше <b>1000 участников</b> потребуется тариф <b>START+</b>. Платные каналы этим ограничением не связаны.</div>`:''}

    <div style="height:18px"></div>
    <button class="btn" id="chCreateBtn" onclick="chCreateChannel()" ${d.name.trim()?'':'disabled style="opacity:.5"'}>${chI('plus')} Создать ${kl}</button>
    <div style="height:10px"></div>`;
  return {title:'Новый '+kl, html};
}

/* --- пикеры для черновика --- */
window.chDraftPickAvatar = function(){
  chPickFile(f=>chReadImage(f, 512, 0.82, url=>{ chDraft.avatar=url; chDraft.useIcon=false; chRender(); }));
};
window.chDraftClearAvatar = function(){ chDraft.avatar=null; chRender(); };
window.chDraftPickCover = function(){
  chPickFile(f=>chReadImage(f, 1200, 0.72, url=>{ chDraft.cover=url; chRender(); }));
};
window.chDraftClearCover = function(){ chDraft.cover=null; chRender(); };
window.chDraftPickChatBg = function(){
  if(!chIsPro()){ toast('Свой фон — на тарифе START+'); return; }
  chPickFile(f=>chReadImage(f, 1200, 0.72, url=>{ chDraft.chatBgUrl=url; chDraft.chatBg=null; chRender(); }));
};
function chPriceChips(){
  const opts = chDraft.kind==='course' ? [490,990,1490,2900] : [99,199,299,499];
  return opts.map(p=>`<button class="${chDraft.price===p?'on':''}" onclick="chDraft.price=${p};chSyncPriceChips();chSyncPriceInput()">${p} ₽</button>`).join('');
}
function chNet(p){ return Math.round((p||0)*(1-CH_FEE)); }
window.chPickKind = function(k){
  chDraft.kind = k;
  if(k==='channel'){ chDraft.access='open'; }
  else if(k==='chat'){ chDraft.access='open'; chDraft.price=0; }
  else if(k==='sgroup'){ chDraft.access='open'; chDraft.price=0; }
  else if(k==='club'){ chDraft.access='closed'; if(!chDraft.price) chDraft.price=299; }
  else if(k==='course'){ chDraft.access='closed'; if(!chDraft.price || chDraft.price<490) chDraft.price=990; }
  chRender();
};
window.chDraftAccess = function(a){ chDraft.access=a; chRender(); };
window.chDraftPaid = function(p){
  if(p){ if(!chDraft.price) chDraft.price = chDraft.kind==='course'?990:299; if(chDraft.access==='open') chDraft.access='closed'; }
  else { chDraft.price = 0; }
  chRender();
};
window.chSyncPriceChips = function(){
  const el = document.getElementById('chPriceChips'); if(el) el.innerHTML = chPriceChips();
  const h = document.getElementById('chNetHint'); if(h) h.textContent = chNet(chDraft.price)+' ₽';
};
window.chSyncPriceInput = function(){ const el = document.getElementById('chDPrice'); if(el) el.value = chDraft.price; };
window.chSyncCreateBtn = function(){
  const b = document.getElementById('chCreateBtn'); if(!b) return;
  const ok = chDraft.name.trim().length>0;
  b.disabled = !ok; b.style.opacity = ok?'':'0.5';
  const prev = document.querySelector('#chBgPrev .ch-ap-name'); if(prev) prev.textContent = chDraft.name||'Новый канал';
};
window.chCreateChannel = function(){
  const d = chDraft, name = d.name.trim();
  if(!name){ toast('Введите название'); return; }
  CH.seq = (CH.seq||0)+1;
  const isChatLike = (d.kind==='chat' || d.kind==='sgroup');
  const c = chNormalize({
    id:'ch-my-'+CH.seq, name, nick:chSlug(name), desc:d.desc.trim()||(isChatLike?'Добро пожаловать в чат!':'Добро пожаловать!'),
    icon: d.useIcon ? d.icon : null, bg:d.bg,
    chatBg:(d.chatBg==null?null:d.chatBg), chatBgUrl:(d.chatBgUrl||null),
    cover:d.cover||null, avatar:d.avatar||null,
    kind:d.kind, access:d.access, price:(d.price||0),
    website:d.website||'', verifyRequested:!!d.verified, verified:false,
    subs:1, reactions:true, discussions:d.kind!=='course',
    /* для чата/супергруппы юзеры пишут всегда; для канала — только админы */
    whoPost: (d.kind==='chat' || d.kind==='sgroup') ? 'subs' : 'admins',
    /* для канала админ может вкл/выкл комментарии; по умолчанию — вкл */
    commentsOn: (d.kind==='channel') ? true : undefined,
    admins:[], gross:0, members:[{name:PROFILE.name, nick:PROFILE.nick, joined:'сейчас'}], black:[],
    posts:[{
      txt: isChatLike
        ? 'Чат создан. Пригласи первых участников и задай тон общения.'
        : 'Канал создан. Первый пост задаёт тон — расскажи, что будет полезного для подписчиков.',
      likes:0, views:1, when:'сейчас'
    }],
    lessons: d.kind==='course' ? [{id:'l1', title:'Вводный урок', dur:'5:00'}] : undefined,
  });
  CH.mine.unshift(c);
  chSave();
  chMirrorToChats(c);  // канал/чат появляется в мессенджере
  // сброс черновика
  chDraft.kind='channel'; chDraft.access='open'; chDraft.name=''; chDraft.desc=''; chDraft.price=0;
  chDraft.bg=0; chDraft.chatBg=null; chDraft.chatBgUrl=null; chDraft.useIcon=false; chDraft.icon='megaphone';
  chDraft.cover=null; chDraft.avatar=null; chDraft.website=''; chDraft.verified=false;
  const kl = chKindLabel(c).toLowerCase();
  if(typeof showPopup==='function'){
    showPopup({ico:'check', title:chKindLabel(c)+' создан',
      body:`«${chEsc(c.name)}» готов. ${chPaid(c)?'Настрой доступ и приглашай первых подписчиков — они платят, ты зарабатываешь.':c.access==='closed'?'Закрытый доступ включён — принимай заявки на вступление.':'Публикуй посты и расти аудиторию.'}`,
      actions:[{label:'Открыть', onclick:()=>{ chNav=[{page:'list'}]; chGo('channel',c.id); }},{label:'К списку', ghost:true, onclick:()=>{ chNav=[{page:'list'}]; chRender(); }}]});
  } else { chNav=[{page:'list'}]; chGo('channel',c.id); }
};

/* канал/чат/супергруппа → запись в CHATS (мессенджер), чтобы был «настоящим».
   kind в CHATS: направляем канал/клуб/курс как 'channel' (лента постов), чат — 'direct'
   (личный по функциональности, но с managed=true), супергруппу — 'group'.
   Для юзера чат и канал выглядят одинаково — разница в правах: в канале пишет только
   админ (writeAll=false), в чате/супергруппе пишут все (writeAll=true). */
function chMirrorToChats(c){
  if(typeof CHATS==='undefined') return;
  if(CHATS.some(x=>x.chId===c.id)) return;
  const chatsKind = c.kind==='sgroup' ? 'group' : c.kind==='chat' ? 'group' : 'channel';
  const kIcon    = c.kind==='sgroup' ? 'users' : c.kind==='chat' ? 'users' : 'megaphone';
  const writeAll = (c.kind==='chat' || c.kind==='sgroup');
  CHATS.unshift({
    id:'chan_'+c.id, chId:c.id, name:c.name, kind:chatsKind, managed:true, writeAll:writeAll,
    ava:(c.name[0]||'K').toUpperCase(), avaIcon: c.icon||null, avaImg:c.avatar||null, kindIcon:kIcon,
    subs:chFmtN(c.subs||0), nick:c.nick,
    preview: c.kind==='course'?'Видео-курс':c.kind==='club'?'Закрытый клуб':c.kind==='sgroup'?'Супергруппа':c.kind==='chat'?'Чат создан':chPaid(c)?'Платный канал':c.access==='closed'?'Закрытый канал':'Канал создан',
    time:(typeof nowT==='function'?nowT():'сейчас'), unread:0, online:false,
    msgs:[{kind:'sys', body:`${chKindLabel(c)} «${c.name}» — открой в «Мои каналы» для управления`}],
    openChannel:c.id
  });
  if(typeof renderChatList==='function') try{ renderChatList(); }catch(e){}
}

/* ================= СТРАНИЦА: ПРОСМОТР КАНАЛА ================= */
function chPageChannel(id){
  const c = chChannel(id);
  if(!c) return {title:'Канал', html:'<div class="ch-empty">Канал не найден</div>'};
  const mine = chIsMine(c);
  const subbed = chIsSubbed(c);
  const bgStyle = c.cover
    ? `background:linear-gradient(180deg,rgba(0,0,0,.15),rgba(0,0,0,.5)),url(${c.cover});background-size:cover;background-position:center`
    : `background:${CH_BGS[c.bg||0]}`;
  const cover = `
    <div class="ch-cover${c.cover?' has-photo':''}" style="${bgStyle}">
      ${mine?`<button class="ch-cv-edit" onclick="chGo('mAppear','${c.id}')" title="Оформление">${chI('camera')}</button>`:''}
      ${chAvInner(c,'big')}
      <div class="ch-cv-name">${chEsc(c.name)}${chBadge(c)}</div>
      <div class="ch-cv-id">@${chEsc(chNick(c))}</div>
      <div class="ch-cv-badges">${chBadges(c)}</div>
      <div class="ch-cv-sub">${chAccessLine(c)}${mine?' · вы владелец':''}</div>
      <div class="ch-cv-stats">
        <div><b>${chFmtN(c.subs||0)}</b><small>подписчиков</small></div>
        ${c.kind==='course'?`<div><b>${c.lessons?c.lessons.length:0}</b><small>уроков</small></div>`:`<div><b>${c.posts?c.posts.length:0}</b><small>постов</small></div>`}
        <div><b>${c.access==='closed'?'закрытый':'открытый'}</b><small>доступ</small></div>
      </div>
    </div>`;

  // не участник закрытого/платного/курса → ВИТРИНА (paywall / gate)
  if(!subbed){
    const paid = chPaid(c);
    const benefits = c.kind==='course'
      ? ['Полный доступ ко всем '+(c.lessons?c.lessons.length:0)+' видео-урокам','Практика и разбор твоих работ','Доступ навсегда, смотри в своём темпе','Чат поддержки с автором']
      : c.kind==='club'
      ? ['Закрытые посты, разборы и материалы клуба','Живое комьюнити и чат участников','Еженедельные задания и обратная связь','Отмена подписки в любой момент']
      : ['Все закрытые посты и разборы','Новые материалы регулярно','Доступ в закрытое обсуждение','Отмена доступа в любой момент'];
    const gTitle = c.kind==='course'?'Открой доступ к курсу': c.kind==='club'?'Вступи в клуб': 'Закрытый канал';
    const priceHtml = paid
      ? `<div class="ch-pw-price">${c.price} ₽<span>${c.kind==='course'?' разово':' / мес'}</span></div>`
      : `<div class="ch-pw-price">Бесплатно<span> · по заявке</span></div>`;
    const ctaLabel = c.kind==='course' ? `Купить курс за ${c.price} ₽`
      : paid ? `Оформить доступ · ${c.price} ₽/мес`
      : `Оформить доступ бесплатно`;
    const note = paid
      ? 'Оплата с кошелька OKO · безопасно · комиссия сервиса 10%'
      : 'Бесплатное вступление — доступ откроется сразу';
    return {title:c.name, html: cover + `
      <div class="ch-desc">${chEsc(c.desc)}</div>
      <div class="ch-paywall">
        <div class="ch-pw-blur">
          ${(c.posts&&c.posts.length?c.posts:[{txt:'Закрытый материал для участников…'},{txt:'Здесь публикуются приватные разборы и бонусы.'}]).slice(0,2).map(p=>
            `<div class="ch-post"><div class="ch-post-txt">${chEsc(p.txt)}</div></div>`).join('')}
        </div>
        <div class="ch-pw-body">
          <div class="ch-pw-lock">${chI('lock')}</div>
          <h3>${gTitle}</h3>
          <p>${chEsc(c.owner?('Автор: '+c.owner):'Оформи доступ, чтобы видеть все материалы')}</p>
          ${priceHtml}
          <ul class="ch-pw-benefits">${benefits.map(b=>`<li>${chI('check')}<span>${b}</span></li>`).join('')}</ul>
          <button class="btn" onclick="chSubscribe('${c.id}')">${chI(c.kind==='course'?'circle-play':paid?'card':'check')} ${ctaLabel}</button>
          <p style="font-size:11px;color:var(--dim);margin-top:9px">${note}</p>
        </div>
      </div>`};
  }

  // участник / владелец / открытый бесплатный
  let html = cover;
  html += `<div class="ch-desc">${chEsc(c.desc)}</div>`;

  if(mine){
    html += `<div class="ch-owner-bar">
      <button class="btn" onclick="chGo('${c.kind==='course'?'addLesson':'compose'}','${c.id}')">${chI('plus')} ${c.kind==='course'?'Добавить урок':'Опубликовать пост'}</button>
      <button class="btn ghost" onclick="chGo('manage','${c.id}')">${chI('bolt')} Управление</button>
    </div>`;
  } else {
    const authorName = c.owner || (c.admins&&c.admins[0]&&c.admins[0].name) || c.name;
    const authorNick = c.ownerNick || chNick(c);
    html += `<div class="ch-owner-bar">
      <button class="btn ghost" onclick="chDM('${chEsc(authorName)}','${chEsc(authorNick)}')">${chI('send')} Написать автору</button>
      ${chGated(c)?`<button class="btn ghost" onclick="chUnsub('${c.id}')">${chI('check')} ${chPaid(c)?'Подписка':'Доступ'}</button>`:''}
    </div>`;
  }

  /* ряд быстрых действий (как шапка канала в Telegram): уведомления · поделиться · ещё */
  html += `<div class="ch-actrow">
    <button class="ch-act ${chNotifyOn(c)?'on':''}" onclick="chToggleNotify('${c.id}',this)">${chI('bell')}<span>${chNotifyOn(c)?'Уведомления':'Без звука'}</span></button>
    <button class="ch-act" onclick="chShareChannel('${c.id}')">${chI('share')}<span>Поделиться</span></button>
    <button class="ch-act" onclick="chMoreMenu('${c.id}')">${chI('more')}<span>Ещё</span></button>
  </div>`;

  if(c.kind==='course'){
    const prog = chCourseProg(c);
    const done = (CH.prog[c.id]||[]).length;
    html += `<div class="ch-prog-top">
      <div class="ch-pt-row"><b>Прогресс курса</b><span class="ch-pt-pct">${prog}%</span></div>
      <div class="ch-prog-bar"><i style="width:${prog}%"></i></div>
      <div style="color:var(--dim);font-size:11.5px;margin-top:8px">${done} из ${c.lessons.length} уроков пройдено</div>
    </div>`;
    html += `<div class="ch-sec-h">${chI('circle-play')} Уроки</div>`;
    html += c.lessons.map((l,i)=>{
      const isDone = (CH.prog[c.id]||[]).includes(l.id);
      return `<div class="ch-lesson ${isDone?'done':''}" onclick="chGo('lesson',{c:'${c.id}',l:'${l.id}'})">
        <span class="ch-ls-n">${isDone?chI('check'):(i+1)}</span>
        <span class="ch-ls-b"><b>${chEsc(l.title)}</b><small>${chI('clock')} ${l.dur}${isDone?' · пройден':''}</small></span>
        <span class="ch-ls-play">${chI('circle-play')}</span>
      </div>`;
    }).join('');
  } else {
    chEnsurePostIds(c);
    if(!mine) chCountViews(c);   // просмотры тикают, когда пост читает подписчик (раз за сессию)
    // закреплённый пост — отдельным блоком сверху (как в Telegram), без дублирования в общей ленте
    const pinId = chPinnedId(c);
    const pinPost = pinId ? (c.posts||[]).find(p=>chPostId(p)===pinId) : null;
    if(pinPost) html += chPostHtml(c, pinPost, -1, true);
    html += `<div class="ch-sec-h">${chI('feed')} ${c.kind==='club'?'Лента клуба':'Посты'}</div>`;
    const rest = (c.posts||[]).filter(p=>chPostId(p)!==pinId);
    const posts = rest.length ? rest.map((p,i)=>chPostHtml(c,p,i)).join('')
      : (pinPost ? '' : `<div class="ch-empty">Постов пока нет</div>`);
    html += (c.chatBg!=null && posts)
      ? `<div class="ch-feed" style="background:${CH_BGS[c.chatBg]}">${posts}</div>`
      : posts;
  }
  html += `<div style="height:8px"></div>`;
  const tools = mine ? `<button onclick="chGo('manage','${c.id}')" title="Управление">${chI('bolt')}</button>` : '';
  return {title:c.name, html, tools};
}
/* ---- просмотры: считаем один раз за сессию на каждый пост, читаемый подписчиком ---- */
const chViewed = {};   // pid -> true (в пределах сессии)
function chCountViews(c){
  let ch=false;
  (c.posts||[]).forEach(p=>{ const pid=chPostId(p); if(pid && !chViewed[pid]){ chViewed[pid]=true; p.views=(p.views||0)+1; ch=true; } });
  if(ch) chSave();
}
function chPostHtml(c,p,i,pinned){
  const pid = chPostId(p);
  const mine = chIsMine(c);
  const liked = !!CH.likes[pid];
  const likes = (p.likes||0)+(liked?1:0);
  const cmts = CH.cmt[pid]||[];
  const open = !!chOpenCmt[pid];
  return `<div class="ch-post${pinned?' pinned':''}">
    ${pinned?`<div class="ch-pin-lab">${chI('pin')}<span>Закреплённое</span>${mine?`<button class="ch-pin-off" onclick="chUnpin('${c.id}')">Открепить</button>`:''}</div>`:''}
    <div class="ch-post-h">${chAvInner(c,'mini')}<b class="ch-ph-name">${chEsc(c.name)}</b><small>${chEsc(p.when||'')}</small></div>
    <div class="ch-post-txt">${chEsc(p.txt)}</div>
    ${p.img?`<div class="ch-post-media photo" style="background-image:url(${p.img})"></div>`
      :p.media==='poll'?chPollHtml(c,p,i)
      :p.media?`<div class="ch-post-media" style="background:${CH_BGS[c.bg||0]}">${chI(p.media)}${p.media==='circle-play'?'<span class="ch-pm-dur">видео</span>':''}</div>`:''}
    <div class="ch-post-acts">
      ${c.reactions?`<button class="${liked?'on':''}" onclick="chLike('${c.id}','${pid}')" aria-label="Нравится">${chI('heart')}${likes}</button>`:''}
      ${c.discussions?`<button class="${open?'on':''}" onclick="chToggleCmt('${c.id}','${pid}')" aria-label="Комментарии">${chI('comment')}${cmts.length||'Обсудить'}</button>`:''}
      ${mine&&!pinned?`<button class="ch-pin-btn" onclick="chPin('${c.id}','${pid}')" aria-label="Закрепить">${chI('pin')}<span>Закрепить</span></button>`:''}
      <span class="ch-views">${chI('eye')}${chFmtN(p.views||0)}</span>
    </div>
    ${c.discussions&&open?chCommentsHtml(c,pid,cmts):''}
  </div>`;
}
/* закрепить / открепить пост (доступно владельцу) */
window.chPin = function(id,pid){
  const c = chChannel(id); if(!c || !chIsMine(c)) return;
  c.pinned = pid; chSave(); chRender();
  toast('Пост закреплён вверху канала');
};
window.chUnpin = function(id){
  const c = chChannel(id); if(!c) return;
  c.pinned = null; chSave(); chRender();
  toast('Пост откреплён');
};
/* блок комментариев под постом (живой: пишем, лайкаем, сохраняется) */
function chCommentsHtml(c,pid,cmts){
  const rows = cmts.length ? cmts.map((m,k)=>{
    const clk = !!(m.likedBy);
    return `<div class="ch-cmt">
      <div class="ch-cmt-av" style="${chAvSeedStyle(m.nick||m.name)}">${chEsc((m.name[0]||'U').toUpperCase())}</div>
      <div class="ch-cmt-b">
        <div class="ch-cmt-top"><b>${chEsc(m.name)}</b><small>${chEsc(m.when||'')}</small></div>
        <div class="ch-cmt-txt">${chEsc(m.txt)}</div>
      </div>
      <button class="ch-cmt-like ${clk?'on':''}" onclick="chCmtLike('${c.id}','${pid}',${k})" aria-label="Нравится">${chI('heart')}<span>${(m.likes||0)+(clk?1:0)||''}</span></button>
    </div>`;
  }).join('') : `<div class="ch-cmt-empty">Комментариев пока нет — будь первым.</div>`;
  return `<div class="ch-comments">
    <div class="ch-cmt-list">${rows}</div>
    <div class="ch-cmt-form">
      <input class="ch-cmt-input" id="chCmt_${pid}" maxlength="300" placeholder="Комментарий…" onkeydown="if(event.key==='Enter')chSendCmt('${c.id}','${pid}')">
      <button class="ch-cmt-send" onclick="chSendCmt('${c.id}','${pid}')" aria-label="Отправить">${chI('send')}</button>
    </div>
  </div>`;
}
/* состояние раскрытых комментариев (в пределах сессии, чтобы не мигало при ре-рендере) */
const chOpenCmt = {};
window.chToggleCmt = function(cid,pid){ chOpenCmt[pid] = !chOpenCmt[pid]; chRender(); };
window.chSendCmt = function(cid,pid){
  const inp = document.getElementById('chCmt_'+pid); if(!inp) return;
  const txt = (inp.value||'').trim(); if(!txt){ return; }
  CH.cmt[pid] = CH.cmt[pid]||[];
  CH.cmt[pid].push({ name:PROFILE.name, nick:PROFILE.nick, txt, when:'сейчас', likes:0 });
  chOpenCmt[pid] = true; chSave(); chRender();
};
window.chCmtLike = function(cid,pid,k){
  const arr = CH.cmt[pid]; if(!arr||!arr[k]) return;
  arr[k].likedBy = !arr[k].likedBy; chSave(); chRender();
};
/* живой опрос под постом (голос сохраняется) */
function chPollHtml(c,p,i){
  const pid = chPostId(p);
  const opts = (p.poll&&p.poll.opts) || ['Уже применяю','Возьму в работу'];
  const key = pid;
  const voted = CH.votes[key];
  const base = (p.poll&&p.poll.base) || [Math.max(3,(p.views||40)%60+12), Math.max(2,(p.views||30)%40+7)];
  const counts = opts.map((_,k)=> base[k%base.length] + (voted===k?1:0));
  const total = counts.reduce((a,b)=>a+b,0)||1;
  const q = (p.poll&&p.poll.q) || 'А ты как?';
  return `<div class="ch-poll">
    <div class="ch-poll-q">${chI('poll')} ${chEsc(q)}</div>
    ${opts.map((o,k)=>{
      const pct = Math.round(counts[k]/total*100);
      return `<button class="ch-poll-opt${voted!=null?' voted':''}${voted===k?' mine':''}" ${voted!=null?'disabled':''} onclick="chVote('${c.id}','${pid}',${k})">
        <span class="ch-po-fill" style="width:${voted!=null?pct:0}%"></span>
        <span class="ch-po-t">${chEsc(o)}</span>
        ${voted!=null?`<span class="ch-po-p">${pct}%</span>`:''}
      </button>`;
    }).join('')}
    <div class="ch-poll-total">${voted!=null?chFmtN(total)+' голосов':'Нажми, чтобы проголосовать'}</div>
  </div>`;
}
window.chVote = function(id,pid,k){
  const c = chChannel(id); if(!c) return;
  CH.votes[pid] = k; chSave(); chRender();
};
window.chLike = function(id,pid){
  const c = chChannel(id); if(!c||!c.reactions) return;
  CH.likes[pid] = !CH.likes[pid];
  chSave(); chRender();
};

/* ---------- подписка / покупка (деньги) ---------- */
window.chSubscribe = function(id){
  const c = chChannel(id); if(!c) return;
  // бесплатный закрытый (или открытый) → вступление без оплаты
  if(!chPaid(c)){
    CH.sub[id]=1; c.subs=(c.subs||0)+1; chSave();
    if(typeof showPopup==='function'){
      showPopup({ico:'check', title:'Доступ открыт',
        body:`Ты вступил в «${chEsc(c.name)}» бесплатно. Все материалы теперь доступны.`,
        actions:[{label:'Открыть', onclick:()=>chRender()}]});
    } else toast('Вы вступили в канал');
    chRender(); return;
  }
  const price = c.price||0;
  if(typeof walletCharge!=='function'){ toast('Кошелёк недоступен'); return; }
  const why = (c.kind==='course'?'Покупка курса: ':c.kind==='club'?'Подписка на клуб: ':'Подписка на канал: ')+c.name;
  if(!walletCharge(price, why)) return;              // сам покажет «недостаточно средств»
  if(typeof okoEarn==='function') okoEarn(price*CH_FEE, 'Комиссия каналов 10%');
  CH.sub[id]=1; c.subs=(c.subs||0)+1; c.gross=(c.gross||0)+price; chSave();
  const net = Math.round(price*(1-CH_FEE));
  if(typeof showPopup==='function'){
    showPopup({ico:'check', title: c.kind==='course'?'Курс открыт':'Доступ оформлен',
      body:`Списано ${price} ₽ с кошелька. Автору начислено ${net} ₽, комиссия OKO 10% (${Math.round(price*CH_FEE)} ₽). ${c.kind==='course'?'Все уроки доступны навсегда.':'Доступ активен на месяц.'}`,
      actions:[{label:c.kind==='course'?'К урокам':'Открыть', onclick:()=>chRender()}]});
  } else { toast('Доступ открыт'); }
  chRender();
};
window.chUnsub = function(id){
  const c = chChannel(id); if(!c) return;
  if(typeof showPopup!=='function'){ delete CH.sub[id]; if(c.subs)c.subs--; chSave(); chRender(); return; }
  showPopup({ico:'flag', title:'Отменить доступ?',
    body:`Ты потеряешь доступ к «${chEsc(c.name)}». ${chPaid(c)?'Подписку можно оформить снова в любой момент.':'Вступить снова можно в любой момент.'}`,
    actions:[{label:'Отменить доступ', onclick:()=>{ delete CH.sub[id]; if(c.subs)c.subs--; chSave(); toast('Доступ отменён'); chRender(); }},{label:'Оставить', ghost:true}]});
};

/* ================= СТРАНИЦА: УРОК ================= */
function chPageLesson(arg){
  const c = chChannel(arg&&arg.c);
  if(!c || !c.lessons) return {title:'Урок', html:'<div class="ch-empty">Урок не найден</div>'};
  const idx = c.lessons.findIndex(l=>l.id===arg.l);
  const l = c.lessons[idx];
  if(!l) return {title:'Урок', html:'<div class="ch-empty">Урок не найден</div>'};
  const isDone = (CH.prog[c.id]||[]).includes(l.id);
  const next = c.lessons[idx+1];
  const html = `
    <div class="ch-player" style="background:${CH_BGS[c.bg||0]}">
      <div class="ch-play-btn" onclick="toast('Видео-плеер урока — подключается к Академии OKO')">${chI('play')}</div>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span class="ch-tag course">Урок ${idx+1}/${c.lessons.length}</span>
      <small style="color:var(--dim);font-size:12px">${chI('clock')} ${l.dur}</small>
    </div>
    <h2 style="font:800 20px/1.2 var(--font-display);letter-spacing:.01em;margin:8px 0 10px">${chEsc(l.title)}</h2>
    <div class="ch-desc">В этом уроке разбираем «${chEsc(l.title)}» по шагам: теория, живой пример и практическое задание. После просмотра отметь урок пройденным — прогресс курса обновится.</div>
    <button class="btn ${isDone?'ghost':''}" onclick="chToggleLesson('${c.id}','${l.id}')">${chI(isDone?'check':'check2')} ${isDone?'Урок пройден':'Отметить пройденным'}</button>
    ${next?`<div style="height:10px"></div><button class="btn ghost" onclick="chGo('lesson',{c:'${c.id}',l:'${next.id}'})">${chI('forward')} Следующий урок · ${chEsc(next.title)}</button>`:''}
    <div style="height:10px"></div>`;
  return {title:'Урок '+(idx+1), html};
}
window.chToggleLesson = function(cid, lid){
  CH.prog[cid] = CH.prog[cid]||[];
  const i = CH.prog[cid].indexOf(lid);
  if(i<0){ CH.prog[cid].push(lid); toast('Урок пройден — прогресс обновлён'); }
  else { CH.prog[cid].splice(i,1); }
  chSave(); chRender();
};

/* ================= СТРАНИЦА: ПУБЛИКАЦИЯ ПОСТА (владелец) ================= */
const chCompose = {txt:'', media:null, img:null, poll:''};
function chPageCompose(id){
  const c = chChannel(id);
  if(!c || !chIsMine(c)) return {title:'Публикация', html:'<div class="ch-empty">Нет доступа</div>'};
  const kinds = [
    ['none','feed','Текст'],
    ['photo','photo','Фото'],
    ['circle-play','circle-play','Видео'],
    ['poll','poll','Опрос'],
  ];
  const html = `
    <div class="ch-compose-head">${chAvInner(c,'mini')}<div><b>${chEsc(c.name)}</b><small>@${chEsc(chNick(c))} · публикация от вас</small></div></div>
    <textarea class="ch-ta" id="chCompTxt" rows="4" maxlength="600" placeholder="Что нового? Поделись пользой с подписчиками…" oninput="chCompose.txt=this.value;chCompSync()">${chEsc(chCompose.txt)}</textarea>
    <div class="ch-compose-kinds">${kinds.map(([m,ic,lab])=>`
      <button class="ch-ck ${((chCompose.media||'none')===m)?'on':''}" onclick="chCompKind('${m}')">${chI(ic)}<span>${lab}</span></button>`).join('')}</div>
    ${chCompose.media==='photo'?`
      <div class="ch-compose-photo" onclick="chCompPickPhoto('${id}')" style="${chCompose.img?`background-image:url(${chCompose.img})`:''}">
        ${chCompose.img?`<span class="ch-cp-change">${chI('camera')} Заменить</span>`:`${chI('camera')}<small>Загрузить фото поста</small>`}
      </div>`:''}
    ${chCompose.media==='poll'?`
      <label class="ch-lab">Варианты ответа (через запятую)</label>
      <input class="ch-input" id="chCompPoll" placeholder="Уже применяю, Возьму в работу" value="${chEsc(chCompose.poll)}" oninput="chCompose.poll=this.value">`:''}
    <div style="height:16px"></div>
    <button class="btn" id="chCompBtn" onclick="chPublishPost('${id}')" ${chCompose.txt.trim()||chCompose.img?'':'disabled style="opacity:.5"'}>${chI('send')} Опубликовать</button>
    <div class="ch-owner-note">Пост появится в канале и в ленте рекомендаций OKO — алгоритм покажет его новой аудитории.</div>`;
  return {title:'Новый пост', html};
}
window.chCompKind = function(m){ chCompose.media = (m==='none'?null:m); if(m!=='photo') chCompose.img=null; chRender(); };
window.chCompSync = function(){
  const b=document.getElementById('chCompBtn'); if(!b) return;
  const ok = chCompose.txt.trim().length>0 || !!chCompose.img;
  b.disabled=!ok; b.style.opacity=ok?'':'0.5';
};
window.chCompPickPhoto = function(id){
  chPickFile(f=>chReadImage(f, 1000, 0.72, url=>{ chCompose.img=url; chRender(); }));
};
window.chPublishPost = function(id){
  const c = chChannel(id); if(!c || !chIsMine(c)) return;
  const txt = chCompose.txt.trim();
  if(!txt && !chCompose.img){ toast('Добавьте текст или фото'); return; }
  const post = { txt, likes:0, views:1, when:'сейчас' };
  if(chCompose.media==='photo' && chCompose.img) post.img = chCompose.img;
  else if(chCompose.media==='circle-play') post.media='circle-play';
  else if(chCompose.media==='poll'){
    post.media='poll';
    const opts = chCompose.poll.split(',').map(s=>s.trim()).filter(Boolean);
    if(opts.length>=2) post.poll = {q:txt||'А ты как?', opts:opts.slice(0,4)};
  }
  c.posts = c.posts||[]; c.posts.unshift(post);
  chPushToFeed(c, post);
  chSave();
  chCompose.txt=''; chCompose.media=null; chCompose.img=null; chCompose.poll='';
  toast('Пост опубликован — он уже в ленте рекомендаций');
  chStep();  // назад к каналу
};

/* ================= СТРАНИЦА: ДОБАВИТЬ УРОК (владелец курса) ================= */
const chLessonDraft = {title:'', dur:'5:00'};
function chPageAddLesson(id){
  const c = chChannel(id);
  if(!c || !chIsMine(c)) return {title:'Урок', html:'<div class="ch-empty">Нет доступа</div>'};
  if(!c.lessons) c.lessons=[];
  const html = `
    <div class="ch-owner-note" style="margin-bottom:10px">Урок №${c.lessons.length+1} курса «${chEsc(c.name)}». Видео подключится из Академии OKO.</div>
    <label class="ch-lab">Название урока</label>
    <input class="ch-input" id="chLsTitle" maxlength="80" placeholder="Например: Хук за 3 секунды" value="${chEsc(chLessonDraft.title)}" oninput="chLessonDraft.title=this.value;chLsSync()">
    <label class="ch-lab">Длительность</label>
    <div class="ch-price-row">
      <input class="ch-input" id="chLsDur" placeholder="8:30" value="${chEsc(chLessonDraft.dur)}" oninput="chLessonDraft.dur=this.value" style="max-width:120px">
      <span class="ch-unit">мин:сек</span>
    </div>
    <div style="height:16px"></div>
    <button class="btn" id="chLsBtn" onclick="chAddLesson('${id}')" ${chLessonDraft.title.trim()?'':'disabled style="opacity:.5"'}>${chI('plus')} Добавить урок</button>
    ${c.lessons.length?`<div class="ch-sec-h">${chI('circle-play')} Уроки курса (${c.lessons.length})</div>
      ${c.lessons.map((l,i)=>`<div class="ch-lesson" style="cursor:default"><span class="ch-ls-n">${i+1}</span><span class="ch-ls-b"><b>${chEsc(l.title)}</b><small>${chI('clock')} ${l.dur}</small></span><button class="ch-m-act" onclick="chDelLesson('${id}','${l.id}')" title="Удалить">${chI('trash')}</button></div>`).join('')}`:''}`;
  return {title:'Новый урок', html};
}
window.chLsSync = function(){ const b=document.getElementById('chLsBtn'); if(!b) return; const ok=chLessonDraft.title.trim().length>0; b.disabled=!ok; b.style.opacity=ok?'':'0.5'; };
window.chAddLesson = function(id){
  const c = chChannel(id); if(!c) return;
  const title = chLessonDraft.title.trim(); if(!title){ toast('Введите название урока'); return; }
  c.lessons = c.lessons||[];
  c.lessons.push({ id:'l'+(Date.now()), title, dur:(chLessonDraft.dur||'5:00').trim() });
  chSave(); chLessonDraft.title=''; chLessonDraft.dur='5:00';
  toast('Урок добавлен'); chRender();
};
window.chDelLesson = function(id,lid){
  const c = chChannel(id); if(!c||!c.lessons) return;
  c.lessons = c.lessons.filter(l=>l.id!==lid);
  if(CH.prog[id]) CH.prog[id] = CH.prog[id].filter(x=>x!==lid);
  chSave(); chRender();
};

/* ================= ЛИЧНЫЕ СООБЩЕНИЯ (написать человеку, как в Telegram) ================= */
window.chDM = function(name,nick){
  if(typeof CHATS==='undefined' || typeof openConv!=='function'){ toast('Мессенджер недоступен'); return; }
  let chat = CHATS.find(x=>x.kind==='direct' && x.dmNick===nick);
  if(!chat){
    chat = {
      id:'dm_'+nick+'_'+Date.now(), dmNick:nick, ava:(name[0]||'U').toUpperCase(), name,
      kind:'direct', kindIcon:null, managed:false, writeAll:true,
      preview:'Личный чат', time:(typeof nowT==='function'?nowT():'сейчас'), unread:0, online:true,
      msgs:[{kind:'sys', body:'Начните личную переписку с '+name}]
    };
    CHATS.unshift(chat);
    if(typeof renderChatList==='function') try{ renderChatList(); }catch(e){}
  }
  chClose();
  if(typeof showTab==='function') showTab('chats');
  try{ openConv(chat.id); }catch(e){ toast('Открываю чаты'); }
};

/* ================= СТРАНИЦА: УПРАВЛЕНИЕ (хаб) ================= */
function chPageManage(id){
  const c = chChannel(id);
  if(!c || !chIsMine(c)) return {title:'Управление', html:'<div class="ch-empty">Нет доступа</div>'};
  const course = c.kind==='course';

  // шапка: аватар, имя, @id, счётчики
  let html = `<div class="ch-manage-hub">${chAvInner(c,'big')}
    <div style="text-align:center;margin-bottom:14px">
      <div style="font:800 19px/1.1 var(--font-display);display:flex;align-items:center;gap:6px;justify-content:center">${chEsc(c.name)}${chBadge(c)}</div>
      <div style="color:var(--dim);font-size:12px;margin-top:4px">@${chEsc(chNick(c))} · ${chFmtN(c.subs||0)} подписчиков</div>
    </div></div>`;

  // быстрые действия
  html += `<div class="ch-actrow" style="margin-bottom:16px">
    <button class="ch-act" onclick="chGo('${course?'addLesson':'compose'}','${id}')">${chI('plus')}<span>${course?'Урок':'Пост'}</span></button>
    <button class="ch-act" onclick="chShareChannel('${id}')">${chI('share')}<span>Поделиться</span></button>
    <button class="ch-act" onclick="chGo('mStats','${id}')">${chI('poll')}<span>Статистика</span></button>
  </div>`;

  // доход владельца (платный/курс)
  if(chPaid(c)){
    const gross = c.gross||0, net = Math.round(gross*(1-CH_FEE)), fee = gross-net;
    html += `<div class="ch-earn">
      <small class="ch-earn-lab">Доход канала к выводу</small>
      <div class="ch-earn-sum">${net.toLocaleString('ru-RU').replace(/,/g,' ')} <span>₽</span></div>
      <div class="ch-earn-calc">
        <div><span>Продажи ${c.kind==='course'?'курса':'подписок'}</span><b>${gross.toLocaleString('ru-RU').replace(/,/g,' ')} ₽</b></div>
        <div class="fee"><span>Комиссия OKO 10%</span><b>− ${fee.toLocaleString('ru-RU').replace(/,/g,' ')} ₽</b></div>
        <div class="total"><span>К выводу</span><b>${net.toLocaleString('ru-RU').replace(/,/g,' ')} ₽</b></div>
      </div>
      <button class="btn" onclick="chWithdraw('${id}')" ${net>0?'':'disabled style="opacity:.5"'}>${chI('money')} Вывести на кошелёк</button>
    </div>`;
  }

  // ---- ОСНОВНОЕ ----
  html += `<div class="ch-sec-h">${chI('bolt')} Основное</div>`;
  html += chList([
    chNavRow('megaphone','Тип и доступ', chAccessLineShort(c), `chGo('mType','${id}')`),
    chNavRow('photo','Оформление', '', `chGo('mAppear','${id}')`, {sub:'Аватар, обложка, описание'}),
  ]);

  // ---- ССЫЛКА И ПРИГЛАШЕНИЯ ----
  html += `<div class="ch-sec-h">${chI('globe')} Ссылка и приглашения</div>`;
  html += chList([
    chLinkRow('globe','Публичная ссылка', chPublicLink(c), `chCopyLink('${id}')`),
    chNavRow('share','Пригласительные ссылки', (c.invites.length?c.invites.length+'':'создать'), `chGo('mInvites','${id}')`),
  ]);

  // ---- МОНЕТИЗАЦИЯ ----
  html += `<div class="ch-sec-h">${chI('money')} Монетизация</div>`;
  const monRows = [
    chTglRow('card','Платный доступ',
      course?'Курс всегда платный':(chPaid(c)?('Цена '+c.price+' ₽'+chPriceUnit(c)):'Включить и задать цену'),
      chPaid(c), course?`toast('Курс всегда платный')`:`chToggleAccess('${id}','paid')`)
  ];
  if(chPaid(c)){
    monRows.push(chNavRow('bolt','Цена и комиссия', c.price+' ₽'+chPriceUnit(c), `chGo('mType','${id}')`, {sub:'вам '+chNet(c.price)+' ₽ · OKO 10%'}));
  }
  html += chList(monRows);
  html += chLF('OKO удерживает комиссию 10% с каждой продажи. Остальное — ваш доход к выводу на кошелёк.');

  // ---- ПУБЛИКАЦИИ ----
  html += `<div class="ch-sec-h">${chI('feed')} Публикации</div>`;
  const pubRows = [
    chTglRow('rocket','Авто-постинг в рекомендации','Новые посты попадают в ленту OKO', c.autopost, `chTgl('${id}','autopost',this)`),
    chTglRow('heart','Реакции','Лайки под постами', c.reactions, `chTgl('${id}','reactions',this)`),
  ];
  if(!course){
    pubRows.push(chTglRow('comment','Обсуждения','Комментарии к постам', c.discussions, `chTgl('${id}','discussions',this)`));
    pubRows.push(chNavRow('clock','Медленный режим', chSlowLabel(c.slowmode), `chPickSlow('${id}')`));
    pubRows.push(chNavRow('user','Кто может писать', chWhoPostLabel(c), `chPickWhoPost('${id}')`));
  }
  html += chList(pubRows);

  // ---- УЧАСТНИКИ ----
  html += `<div class="ch-sec-h">${chI('users')} Участники</div>`;
  html += chList([
    chNavRow('crown','Администраторы и права', (c.admins?c.admins.length:0)+'', `chGo('mAdmins','${id}')`),
    chNavRow('user','Подписчики', chFmtN(c.subs||0), `chGo('mSubs','${id}')`),
    chNavRow('lock','Чёрный список', (c.black?c.black.length:0)+'', `chGo('mBlack','${id}')`),
  ]);

  // ---- ПРИВАТНОСТЬ ----
  html += `<div class="ch-sec-h">${chI('lock')} Приватность</div>`;
  html += chList([
    chNavRow('users','Кто видит подписчиков', chPrivSubsLabel(c), `chPickPrivSubs('${id}')`),
    chTglRow('forward','Пересылка и сохранение', c.privFwd?'Разрешены':'Запрещены', c.privFwd, `chTgl('${id}','privFwd',this)`),
    chNavRow('feed','История для новых', chPrivHistLabel(c), `chPickPrivHist('${id}')`),
  ]);

  // ---- УВЕДОМЛЕНИЯ ----
  html += `<div class="ch-sec-h">${chI('bell')} Уведомления</div>`;
  html += chList([
    chTglRow('bell','Уведомления о канале', chNotifyOn(c)?'Звук включён':'Без звука', chNotifyOn(c), `chToggleNotify('${id}',this)`),
  ]);

  // ---- СТАТИСТИКА ----
  html += `<div class="ch-sec-h">${chI('poll')} Статистика</div>`;
  html += chList([
    chNavRow('poll','Аналитика канала','', `chGo('mStats','${id}')`, {sub:'Охваты · вовлечённость'}),
  ]);

  // ---- ОПАСНАЯ ЗОНА ----
  html += `<div class="ch-sec-h">${chI('flag')} Опасная зона</div>`;
  html += chList([
    chTglRow('bookmark', c.archived?'В архиве':'Архивировать', 'Скрыть из списков, не удаляя', c.archived, `chTgl('${id}','archived',this)`),
    chNavRow('trash','Удалить канал','Действие необратимо', `chDeleteChannel('${id}')`, {danger:true, noChev:true}),
  ]);
  html += `<div style="height:10px"></div>`;
  return {title:'Управление', html};
}
window.chWithdraw = function(id){
  const c = chChannel(id); if(!c) return;
  const gross = c.gross||0, net = Math.round(gross*(1-CH_FEE));
  if(net<=0){ toast('Пока нечего выводить — продаж не было'); return; }
  if(typeof walletAdd==='function') walletAdd(net, 'Доход канала: '+c.name);
  if(typeof okoEarn==='function') okoEarn(gross-net, 'Комиссия каналов 10%');
  c.gross = 0; chSave();
  toast('+'+net.toLocaleString('ru-RU').replace(/,/g,' ')+' ₽ зачислено на кошелёк');
  chRender();
};
window.chDeleteChannel = function(id){
  const c = chChannel(id); if(!c) return;
  const act = ()=>{
    CH.mine = CH.mine.filter(x=>x.id!==id); chSave();
    if(typeof CHATS!=='undefined'){ const k=CHATS.findIndex(x=>x.chId===id); if(k>=0){ CHATS.splice(k,1); if(typeof renderChatList==='function') renderChatList(); } }
    chUpdateProwCount();
    toast('Канал удалён'); chNav=[{page:'list'}]; chRender();
  };
  if(typeof showPopup==='function') showPopup({ico:'trash', title:'Удалить канал?',
    body:`«${chEsc(c.name)}» и все его материалы будут удалены безвозвратно.`,
    actions:[{label:'Удалить', onclick:act},{label:'Отмена', ghost:true}]});
  else act();
};

/* ---------- Тип, доступ и цена ---------- */
function chPageMType(id){
  const c = chChannel(id); if(!c) return {title:'Тип', html:''};
  const kinds = [
    ['channel','megaphone','Канал','Лента постов для аудитории'],
    ['club','crown','Клуб','Закрытое комьюнити по подписке'],
    ['course','circle-play','Курс','Видео-уроки внутри с прогрессом'],
  ];
  const lockAccess = c.kind==='course';
  const lockPaid = c.kind==='course';
  const paid = chPaid(c);
  const html = `
    <div class="ch-owner-note" style="margin-bottom:10px">Настрой продукт и доступ. Две независимые оси: <b>доступ</b> (открытый/закрытый) и <b>оплата</b> (бесплатно/платно). Изменения применяются сразу.</div>

    <div class="ch-sec-h">${chI('bolt')} Вид</div>
    <div class="ch-seg">${kinds.map(([t,ic,tt,d])=>`
      <button class="ch-type-card ${c.kind===t?'on':''}" onclick="chSetKind('${id}','${t}')">
        <span class="ch-tc-ic">${chI(ic)}</span>
        <span style="flex:1;min-width:0"><b>${tt}</b><small>${d}</small></span>
        <span class="ch-tc-check">${chI('check')}</span>
      </button>`).join('')}</div>

    <div class="ch-sec-h">${chI('lock')} Доступ</div>
    <div class="ch-choice2${lockAccess?' locked':''}">
      <button class="ch-ch2 ${c.access==='open'?'on':''}" ${lockAccess?'disabled':''} onclick="chSetAccess('${id}','open')">${chI('globe')}<b>Открытый</b><small>Виден и читается всем</small></button>
      <button class="ch-ch2 ${c.access==='closed'?'on':''}" ${lockAccess?'disabled':''} onclick="chSetAccess('${id}','closed')">${chI('lock')}<b>Закрытый</b><small>Витрина + доступ по заявке/оплате</small></button>
    </div>
    ${lockAccess?`<div class="ch-owner-note">Курс всегда закрытый.</div>`:''}

    <div class="ch-sec-h">${chI('money')} Оплата</div>
    <div class="ch-choice2${lockPaid?' locked':''}">
      <button class="ch-ch2 ${!paid?'on':''}" ${lockPaid?'disabled':''} onclick="chSetPaid('${id}',false)">${chI('check')}<b>Бесплатно</b><small>Без платы за доступ</small></button>
      <button class="ch-ch2 ${paid?'on':''}" ${lockPaid?'disabled':''} onclick="chSetPaid('${id}',true)">${chI('card')}<b>Платно</b><small>${c.kind==='course'?'Разовая цена':'Подписка ₽/мес'}</small></button>
    </div>
    ${paid?`
      <label class="ch-lab">${c.kind==='course'?'Цена курса (разовая)':'Цена подписки в месяц'}</label>
      <div class="ch-price-row">
        <input class="ch-input" id="chTPrice" inputmode="numeric" value="${c.price}" oninput="chSetPrice('${id}',this.value)">
        <span class="ch-unit">₽${chPriceUnit(c)}</span>
      </div>
      <div class="ch-price-chips" id="chPriceChips2">${[c.kind==='course'?[490,990,1490,2900]:[99,199,299,499]][0].map(p=>`<button class="${c.price===p?'on':''}" onclick="chSetPrice('${id}',${p});chRender()">${p} ₽</button>`).join('')}</div>
      <div class="ch-owner-note">С каждой продажи ты получаешь <b>${chNet(c.price)} ₽</b>, OKO — 10% (${Math.round(c.price*CH_FEE)} ₽).</div>`:''}`;
  return {title:'Тип и доступ', html};
}
window.chSetKind = function(id,t){
  const c = chChannel(id); if(!c) return;
  c.kind = t;
  if(t==='course'){ c.access='closed'; if(!chPaid(c)) c.price = c.price||990; if(!c.lessons) c.lessons=[{id:'l1',title:'Вводный урок',dur:'5:00'}]; c.discussions=false; }
  else if(t==='club'){ c.access='closed'; if(!chPaid(c)) c.price = c.price||299; }
  chNormalize(c); chSave(); chRender();
  toast('Вид изменён на «'+chKindLabel(c)+'»');
};
window.chSetAccess = function(id,a){
  const c = chChannel(id); if(!c) return;
  c.access = a; chNormalize(c); chSave(); chRender();
  toast(a==='closed'?'Канал закрыт — включена витрина':'Канал открыт для всех');
};
window.chSetPaid = function(id,p){
  const c = chChannel(id); if(!c) return;
  if(p){ if(!c.price) c.price = c.kind==='course'?990:299; if(c.access==='open') c.access='closed'; }
  else { c.price = 0; }
  chNormalize(c); chSave(); chRender();
  toast(p?'Платный доступ включён':'Доступ теперь бесплатный');
};
window.chSetPrice = function(id,v){
  const c = chChannel(id); if(!c) return;
  c.price = +String(v).replace(/\D/g,'')||0; chNormalize(c); chSave();
  const hint = document.querySelector('#chBody .ch-owner-note b'); // мягко, без перерисовки инпута
  if(hint) hint.textContent = chNet(c.price)+' ₽';
};

/* ---------- Подписчики ---------- */
function chPageMSubs(id){
  const c = chChannel(id); if(!c) return {title:'Подписчики', html:''};
  const m = c.members||[];
  const html = `
    <div class="ch-kpi" style="grid-template-columns:repeat(2,1fr)">
      <div class="ch-kpi-t">${chI('users')}<b>${chFmtN(c.subs||0)}</b><small>всего</small></div>
      <div class="ch-kpi-t">${chI('rocket')}<b>+${Math.max(1,Math.round((c.subs||0)*0.04))}</b><small>за неделю</small></div>
    </div>
    <div class="ch-sec-h">${chI('user')} Активные участники</div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:4px 13px">
    ${m.length? m.map(p=>`
      <div class="ch-member">
        <div class="ch-av mini" style="${chAvSeedStyle(p.nick||p.name)}">${chEsc((p.name[0]||'U').toUpperCase())}</div>
        <div class="ch-m-b"><b>${chEsc(p.name)}${p.name===PROFILE.name?' <span class="ch-m-role owner">вы</span>':''}</b><small>@${chEsc(p.nick)} · вступил ${p.joined||'недавно'}</small></div>
        ${p.name!==PROFILE.name?`<button class="ch-m-act send" title="Написать" onclick="chDM('${chEsc(p.name)}','${chEsc(p.nick)}')">${chI('send')}</button>
        <button class="ch-m-act" title="В чёрный список" onclick="chBanMember('${id}','${chEsc(p.nick)}')">${chI('lock')}</button>`:''}
      </div>`).join('') : '<div class="ch-empty" style="border:none">Список участников пуст</div>'}
    </div>
    <div class="ch-owner-note">Показаны активные участники. Полный список синхронизируется с бэкендом при подключении Supabase.</div>`;
  return {title:'Подписчики', html};
}
window.chBanMember = function(id,nick){
  const c = chChannel(id); if(!c) return;
  const idx = (c.members||[]).findIndex(p=>p.nick===nick);
  if(idx<0) return;
  const m = c.members[idx];
  c.members.splice(idx,1);
  c.black = c.black||[]; c.black.unshift({name:m.name, nick:m.nick});
  if(c.subs) c.subs--;
  chSave(); chRender();
  toast(m.name+' в чёрном списке');
};

/* ---------- Администраторы ---------- */
function chPageMAdmins(id){
  const c = chChannel(id); if(!c) return {title:'Админы', html:''};
  const a = c.admins||[];
  const html = `
    <div class="ch-owner-note" style="margin-bottom:12px">Назначай администраторов и тонко настраивай их права — как в Telegram. Нажми на админа, чтобы открыть права. Владелец (ты) всегда имеет полный доступ.</div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:4px 13px">
      <div class="ch-member">
        <div class="ch-av mini" style="${chAvGradStyle(c.bg||0)}">${chEsc((PROFILE.name[0]||'O').toUpperCase())}</div>
        <div class="ch-m-b"><b>${chEsc(PROFILE.name)}</b><small>@${chEsc(PROFILE.nick)} · создатель</small></div>
        <span class="ch-m-role owner">владелец</span>
      </div>
      ${a.map((p,idx)=>`
      <div class="ch-member ch-member-tap" onclick="chGo('mAdminRights',{c:'${id}',i:${idx}})">
        <div class="ch-av mini" style="${chAvSeedStyle(p.nick||p.name)}">${chEsc((p.name[0]||'A').toUpperCase())}</div>
        <div class="ch-m-b"><b>${chEsc(p.name)}</b><small>${chRightsSummary(p)} · @${chEsc(p.nick)}</small></div>
        <span class="ch-m-chev">${chI('chev')}</span>
      </div>`).join('')}
    </div>
    <button class="ch-add-btn" onclick="chAddAdmin('${id}')">${chI('plus')} Назначить администратора</button>`;
  return {title:'Администраторы', html};
}
window.chRemoveAdmin = function(id,nick){
  const c = chChannel(id); if(!c) return;
  c.admins = (c.admins||[]).filter(p=>p.nick!==nick); chSave(); chRender();
  toast('Администратор разжалован');
};
window.chAddAdmin = function(id){
  const c = chChannel(id); if(!c) return;
  const cand = (c.members||[]).filter(p=>p.name!==PROFILE.name && !(c.admins||[]).some(a=>a.nick===p.nick));
  if(!cand.length){ toast('Нет участников для назначения'); return; }
  const p = cand[0];
  c.admins = c.admins||[]; c.admins.push({name:p.name, nick:p.nick, rights:chDefaultRights()}); chSave();
  toast(p.name+' назначен администратором');
  chGo('mAdminRights',{c:id, i:c.admins.length-1});   // сразу открываем настройку прав (как в Telegram)
};

/* ---------- Права конкретного администратора ---------- */
function chPageMAdminRights(arg){
  const c = chChannel(arg&&arg.c); if(!c || !chIsMine(c)) return {title:'Права', html:'<div class="ch-empty">Нет доступа</div>'};
  const p = (c.admins||[])[arg&&arg.i]; if(!p) return {title:'Права', html:'<div class="ch-empty">Администратор не найден</div>'};
  if(!p.rights) p.rights = chDefaultRights();
  let html = `<div class="ch-manage-hub" style="text-align:center">
      <div class="ch-av big" style="${chAvSeedStyle(p.nick||p.name)}">${chEsc((p.name[0]||'A').toUpperCase())}</div>
      <div style="font:800 18px/1.1 var(--font-display);margin-top:10px">${chEsc(p.name)}</div>
      <div style="color:var(--dim);font-size:12px;margin-top:4px">@${chEsc(p.nick)} · администратор</div>
    </div>`;
  html += `<div class="ch-sec-h">${chI('crown')} Права администратора</div>`;
  html += chList(CH_RIGHTS.map(([k,ic,t,d])=>chTglRow(ic,t,d,!!p.rights[k],`chToggleRight('${arg.c}',${arg.i},'${k}',this)`)));
  html += chLF('Точная настройка прав — как в Telegram. Отключённые права недоступны этому администратору; остальные модераторы не затрагиваются.');
  html += `<div class="ch-sec-h">${chI('flag')} Управление</div>`;
  html += chList([ chNavRow('trash','Разжаловать администратора','Снять все права', `chRemoveAdminAt('${arg.c}',${arg.i})`, {danger:true, noChev:true}) ]);
  html += `<div style="height:10px"></div>`;
  return {title:'Права администратора', html};
}
/* переключить одно право (surgical, без полного ре-рендера — как chTgl) */
window.chToggleRight = function(id,i,key,el){
  const c = chChannel(id); if(!c) return;
  const p = (c.admins||[])[i]; if(!p) return;
  p.rights = p.rights || chDefaultRights();
  p.rights[key] = !p.rights[key]; chSave();
  if(el){ const sw = el.querySelector('.switch'); if(sw) sw.classList.toggle('on', !!p.rights[key]); }
  toast(p.rights[key]?'Право выдано':'Право отозвано');
};
window.chRemoveAdminAt = function(id,i){
  const c = chChannel(id); if(!c) return;
  const p = (c.admins||[])[i]; if(!p) return;
  const act = ()=>{ c.admins.splice(i,1); chSave(); if(chNav.length>1) chNav.pop(); chRender(); toast('Администратор разжалован'); };
  if(typeof showPopup==='function') showPopup({ico:'trash', title:'Разжаловать администратора?',
    body:`«${chEsc(p.name)}» потеряет все права администратора канала.`,
    actions:[{label:'Разжаловать', onclick:act},{label:'Отмена', ghost:true}]});
  else act();
};

/* ---------- Чёрный список ---------- */
function chPageMBlack(id){
  const c = chChannel(id); if(!c) return {title:'Чёрный список', html:''};
  const b = c.black||[];
  const html = `
    <div class="ch-owner-note" style="margin-bottom:12px">Заблокированные не видят канал и не могут подписаться. Разблокировка возвращает доступ.</div>
    ${b.length?`<div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:4px 13px">
      ${b.map(p=>`<div class="ch-member">
        <div class="ch-av mini" style="background:var(--raised);color:var(--danger)">${chI('lock')}</div>
        <div class="ch-m-b"><b>${chEsc(p.name)}</b><small>@${chEsc(p.nick)}</small></div>
        <button class="ch-m-act" style="color:var(--lime)" title="Разблокировать" onclick="chUnban('${id}','${chEsc(p.nick)}')">${chI('check')}</button>
      </div>`).join('')}
    </div>`:'<div class="ch-empty">Чёрный список пуст — канал чистый</div>'}`;
  return {title:'Чёрный список', html};
}
window.chUnban = function(id,nick){
  const c = chChannel(id); if(!c) return;
  const idx = (c.black||[]).findIndex(p=>p.nick===nick);
  if(idx<0) return;
  const p = c.black[idx]; c.black.splice(idx,1);
  c.members = c.members||[]; c.members.push({name:p.name, nick:p.nick, joined:'сейчас'});
  if(c.subs!=null) c.subs++;
  chSave(); chRender(); toast(p.name+' разблокирован');
};

/* ---------- Статистика (canvas) ---------- */
function chPageMStats(id){
  const c = chChannel(id); if(!c) return {title:'Статистика', html:''};
  const subs = c.subs||0;
  const reach = Math.round(subs*3.4)+1200;
  const er = (4 + (id.length%4))+'.'+((subs%9))+'%';
  const html = `
    <div class="ch-kpi">
      <div class="ch-kpi-t">${chI('users')}<b>${chFmtN(subs)}</b><small>подписчиков</small></div>
      <div class="ch-kpi-t">${chI('eye')}<b>${chFmtN(reach)}</b><small>охват/нед</small></div>
      <div class="ch-kpi-t">${chI('heart')}<b>${er}</b><small>вовлечённость</small></div>
      <div class="ch-kpi-t">${chI('rocket')}<b>+${Math.max(1,Math.round(subs*0.04))}</b><small>прирост/нед</small></div>
    </div>
    <div class="ch-canvas-wrap">
      <div class="ch-cw-h">Рост подписчиков · 14 дней <span>+${Math.max(1,Math.round(subs*0.09))}</span></div>
      <canvas id="chStatLine" width="600" height="260"></canvas>
    </div>
    <div class="ch-canvas-wrap">
      <div class="ch-cw-h">Охват по дням недели <span>пик: сб</span></div>
      <canvas id="chStatBars" width="600" height="260"></canvas>
    </div>
    <div class="ch-donut">
      <canvas id="chStatDonut" width="192" height="192"></canvas>
      <div class="ch-donut-leg">
        <div><i style="background:#9AFF00"></i>Из рекомендаций<b>46%</b></div>
        <div><i style="background:#6fd400"></i>По ссылке<b>31%</b></div>
        <div><i style="background:#3a7a00"></i>Поиск OKO<b>15%</b></div>
        <div><i style="background:var(--border)"></i>Другое<b>8%</b></div>
      </div>
    </div>
    ${chPaid(c)?`<div class="ch-canvas-wrap"><div class="ch-cw-h">Выручка · 6 мес <span>${(c.gross||0).toLocaleString('ru-RU').replace(/,/g,' ')} ₽</span></div><canvas id="chStatRev" width="600" height="260"></canvas></div>`:''}
    <div class="ch-owner-note">Данные прототипа сгенерированы детерминированно по параметрам канала. С подключением Supabase — реальная аналитика.</div>`;
  return {title:'Статистика', html, after:()=>chDrawStats(c, subs, reach)};
}
function chSeeded(seed){ let s=seed%2147483647; if(s<=0)s+=2147483646; return ()=>{ s=s*16807%2147483647; return (s-1)/2147483646; }; }
function chDrawStats(c, subs, reach){
  const acc = '#9AFF00', dim = 'rgba(154,255,0,.14)';
  const gridCol = getComputedStyle(document.documentElement).getPropertyValue('--border')||'#333';
  const rnd = chSeeded((c.id.length*31 + subs)||7);
  // --- линия роста ---
  (function(){
    const cv = document.getElementById('chStatLine'); if(!cv) return;
    const ctx = cv.getContext('2d'), W=cv.width, H=cv.height, pad=14;
    const pts=[]; let base=subs*0.82;
    for(let i=0;i<14;i++){ base += subs*0.013*(0.6+rnd()); pts.push(base); }
    const mn=Math.min(...pts), mx=Math.max(...pts);
    const x=i=>pad+(W-pad*2)*i/(pts.length-1);
    const y=v=>H-pad-(H-pad*2)*(v-mn)/((mx-mn)||1);
    ctx.clearRect(0,0,W,H);
    ctx.strokeStyle=gridCol; ctx.lineWidth=1; ctx.globalAlpha=.5;
    for(let g=0;g<=3;g++){ const yy=pad+(H-pad*2)*g/3; ctx.beginPath(); ctx.moveTo(pad,yy); ctx.lineTo(W-pad,yy); ctx.stroke(); }
    ctx.globalAlpha=1;
    let t=0; (function anim(){
      t=Math.min(1,t+0.05); const n=Math.max(1,Math.floor((pts.length-1)*t));
      ctx.clearRect(0,0,W,H);
      ctx.strokeStyle=gridCol; ctx.globalAlpha=.5; ctx.lineWidth=1;
      for(let g=0;g<=3;g++){ const yy=pad+(H-pad*2)*g/3; ctx.beginPath(); ctx.moveTo(pad,yy); ctx.lineTo(W-pad,yy); ctx.stroke(); }
      ctx.globalAlpha=1;
      const grad=ctx.createLinearGradient(0,pad,0,H); grad.addColorStop(0,dim); grad.addColorStop(1,'rgba(154,255,0,0)');
      ctx.beginPath(); ctx.moveTo(x(0),y(pts[0]));
      for(let i=1;i<=n;i++) ctx.lineTo(x(i),y(pts[i]));
      ctx.lineTo(x(n),H-pad); ctx.lineTo(x(0),H-pad); ctx.closePath(); ctx.fillStyle=grad; ctx.fill();
      ctx.beginPath(); ctx.moveTo(x(0),y(pts[0]));
      for(let i=1;i<=n;i++) ctx.lineTo(x(i),y(pts[i]));
      ctx.strokeStyle=acc; ctx.lineWidth=2.6; ctx.lineJoin='round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(x(n),y(pts[n]),4.2,0,7); ctx.fillStyle=acc; ctx.fill();
      if(t<1) requestAnimationFrame(anim);
    })();
  })();
  // --- бары охвата ---
  (function(){
    const cv=document.getElementById('chStatBars'); if(!cv) return;
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height, pad=14;
    const days=['пн','вт','ср','чт','пт','сб','вс']; const vals=days.map(()=>0.4+rnd()*0.6); vals[5]=1;
    const bw=(W-pad*2)/days.length*0.62, gap=(W-pad*2)/days.length;
    let t=0;(function anim(){
      t=Math.min(1,t+0.06); ctx.clearRect(0,0,W,H);
      vals.forEach((v,i)=>{
        const h=(H-pad*2-16)*v*t; const bx=pad+gap*i+(gap-bw)/2; const by=H-pad-16-h;
        const g=ctx.createLinearGradient(0,by,0,by+h); g.addColorStop(0,acc); g.addColorStop(1,'#3a7a00');
        ctx.fillStyle=i===5?acc:g; ctx.globalAlpha=i===5?1:.85;
        const r=6; ctx.beginPath();
        ctx.moveTo(bx,by+h); ctx.lineTo(bx,by+r); ctx.arcTo(bx,by,bx+r,by,r); ctx.lineTo(bx+bw-r,by); ctx.arcTo(bx+bw,by,bx+bw,by+r,r); ctx.lineTo(bx+bw,by+h); ctx.closePath(); ctx.fill();
        ctx.globalAlpha=1;
      });
      if(t<1) requestAnimationFrame(anim);
    })();
  })();
  // --- пончик источников ---
  (function(){
    const cv=document.getElementById('chStatDonut'); if(!cv) return;
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height, cx=W/2, cy=H/2, R=W/2-8, r=R*0.6;
    const segs=[[0.46,'#9AFF00'],[0.31,'#6fd400'],[0.15,'#3a7a00'],[0.08,gridCol]];
    let t=0;(function anim(){
      t=Math.min(1,t+0.05); ctx.clearRect(0,0,W,H);
      let a=-Math.PI/2;
      segs.forEach(([v,col])=>{
        const ang=v*Math.PI*2*t; ctx.beginPath(); ctx.moveTo(cx,cy);
        ctx.arc(cx,cy,R,a,a+ang); ctx.closePath(); ctx.fillStyle=col; ctx.fill(); a+=ang;
      });
      ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--surface')||'#111'; ctx.fill();
      if(t<1) requestAnimationFrame(anim);
    })();
  })();
  // --- выручка (если платный) ---
  (function(){
    const cv=document.getElementById('chStatRev'); if(!cv) return;
    const ctx=cv.getContext('2d'), W=cv.width, H=cv.height, pad=14;
    const w=[0.4,0.55,0.6,0.72,0.85,1]; const bw=(W-pad*2)/6*0.6, gap=(W-pad*2)/6;
    let t=0;(function anim(){
      t=Math.min(1,t+0.06); ctx.clearRect(0,0,W,H);
      w.forEach((v,i)=>{
        const h=(H-pad*2)*v*t; const bx=pad+gap*i+(gap-bw)/2; const by=H-pad-h;
        const g=ctx.createLinearGradient(0,by,0,by+h); g.addColorStop(0,'#9AFF00'); g.addColorStop(1,'#2a5a00');
        ctx.fillStyle=g; ctx.globalAlpha=i===5?1:.8;
        ctx.fillRect(bx,by,bw,h); ctx.globalAlpha=1;
      });
      if(t<1) requestAnimationFrame(anim);
    })();
  })();
}

/* ---------- Фон и аватар ---------- */
function chPageMAppear(id){
  const c = chChannel(id); if(!c || !chIsMine(c)) return {title:'Оформление', html:'<div class="ch-empty">Нет доступа</div>'};
  const prevBg = c.cover
    ? `background:linear-gradient(180deg,rgba(0,0,0,.1),rgba(0,0,0,.45)),url(${c.cover});background-size:cover;background-position:center`
    : `background:${CH_BGS[c.bg||0]}`;
  const avStyle = c.avatar
    ? `background-image:url(${c.avatar});background-size:cover;background-position:center`
    : chAvGradStyle(c.bg||0);
  const html = `
    <div class="ch-appear-prev" style="${prevBg}">
      <div class="ch-ap-ava" style="${avStyle}">${c.avatar?'':(c.icon?chI(c.icon):chEsc((c.name[0]||'K').toUpperCase()))}</div>
      <div class="ch-ap-name">${chEsc(c.name)}<span class="ch-ap-id">@${chEsc(chNick(c))}</span></div>
    </div>

    <div class="ch-photo-row">
      <button class="ch-photo-btn" onclick="chUploadCover('${id}')">${chI('photo')} ${c.cover?'Сменить обложку':'Загрузить обложку'}</button>
      ${c.cover?`<button class="ch-photo-btn del" onclick="chClearCover('${id}')" title="Убрать">${chI('trash')}</button>`:''}
    </div>
    <div class="ch-photo-row">
      <button class="ch-photo-btn" onclick="chUploadAvatar('${id}')">${chI('camera')} ${c.avatar?'Сменить аватар':'Загрузить аватар'}</button>
      ${c.avatar?`<button class="ch-photo-btn del" onclick="chClearAvatar('${id}')" title="Убрать">${chI('trash')}</button>`:''}
    </div>

    <label class="ch-lab">Название канала</label>
    <input class="ch-input" id="chNameEdit" maxlength="42" value="${chEsc(c.name)}" oninput="chSetName('${id}',this.value)">
    <label class="ch-lab">Адрес канала (@id)</label>
    <div class="ch-price-row">
      <span class="ch-unit" style="font-size:15px">@</span>
      <input class="ch-input" id="chNickEdit" maxlength="18" value="${chEsc(chNick(c))}" oninput="chSetNick('${id}',this.value)" style="flex:1">
    </div>
    <label class="ch-lab">Описание</label>
    <textarea class="ch-ta" id="chDescEdit" rows="3" maxlength="240" placeholder="О чём канал, что получит подписчик…" oninput="chSetDesc('${id}',this.value)">${chEsc(c.desc||'')}</textarea>

    <label class="ch-lab">Фон-градиент${c.cover?' (под обложкой)':''}</label>
    <div class="ch-swatches">${CH_BGS.map((g,i)=>`<div class="ch-sw ${c.bg===i?'on':''}" style="background:${g}" onclick="chSetBg('${id}',${i})"></div>`).join('')}</div>

    <label class="ch-lab">Фон чата <span style="font-weight:400;color:var(--dim)">— за постами канала</span></label>
    <div class="ch-swatches">
      <div class="ch-sw ch-sw-none ${c.chatBg==null?'on':''}" onclick="chSetChatBg('${id}',null)" title="Без фона">${chI('check2')}</div>
      ${CH_BGS.map((g,i)=>`<div class="ch-sw ${c.chatBg===i?'on':''}" style="background:${g}" onclick="chSetChatBg('${id}',${i})"></div>`).join('')}
    </div>

    <label class="ch-lab">Значок (если без фото-аватара)</label>
    <div class="ch-letter-row">
      <button class="ch-lt ${!c.icon?'on':''}" onclick="chSetIcon('${id}','')" title="Первая буква"><span style="font:800 18px/1 var(--font-display);color:var(--lime)">${(c.name[0]||'K').toUpperCase()}</span></button>
      ${CH_ICONS.map(ic=>`<button class="ch-lt ${c.icon===ic?'on':''}" onclick="chSetIcon('${id}','${ic}')">${chI(ic)}</button>`).join('')}
    </div>
    <div class="ch-owner-note">Обложка, аватар, фон чата, название, адрес и описание отображаются на странице канала, в карточке и в мессенджере. Всё сохраняется сразу.</div>`;
  return {title:'Оформление', html};
}
window.chSetDesc = function(id,v){ const c=chChannel(id); if(!c) return; c.desc = String(v).slice(0,240); chSave(); };
window.chSetChatBg = function(id,i){ const c=chChannel(id); if(!c) return; c.chatBg = (i==null?null:+i); chSave(); chRender(); };
window.chSetBg = function(id,i){ const c=chChannel(id); if(!c) return; c.bg=i; chSave(); chSyncMirror(c); chRender(); };
window.chSetIcon = function(id,ic){ const c=chChannel(id); if(!c) return; c.icon=ic||null; chSave(); chSyncMirror(c); chRender(); };
window.chSetName = function(id,v){
  const c=chChannel(id); if(!c) return;
  c.name = String(v).slice(0,42) || 'Канал'; chSave(); chSyncMirror(c);
  const pn=document.querySelector('#chBody .ch-ap-name'); if(pn && pn.childNodes[0]){ pn.childNodes[0].nodeValue = c.name; }
};
window.chSetNick = function(id,v){
  const c=chChannel(id); if(!c) return;
  c.nick = chSlug(v); chSave(); chSyncMirror(c);
  const el=document.getElementById('chNickEdit'); if(el && el.value!==c.nick) el.value=c.nick;
  const pid=document.querySelector('#chBody .ch-ap-id'); if(pid) pid.textContent='@'+c.nick;
};
window.chUploadCover = function(id){ const c=chChannel(id); if(!c) return; chPickFile(f=>chReadImage(f,1000,0.7,url=>{ c.cover=url; chSave(); chRender(); toast('Обложка обновлена'); })); };
window.chClearCover = function(id){ const c=chChannel(id); if(!c) return; c.cover=null; chSave(); chRender(); };
window.chUploadAvatar = function(id){ const c=chChannel(id); if(!c) return; chPickFile(f=>chReadImage(f,300,0.8,url=>{ c.avatar=url; chSave(); chSyncMirror(c); chRender(); toast('Аватар обновлён'); })); };
window.chClearAvatar = function(id){ const c=chChannel(id); if(!c) return; c.avatar=null; chSave(); chSyncMirror(c); chRender(); };
function chSyncMirror(c){
  if(typeof CHATS==='undefined') return;
  const x = CHATS.find(k=>k.chId===c.id); if(!x) return;
  x.avaIcon = c.icon||null; x.ava=(c.name[0]||'K').toUpperCase();
  x.name = c.name; x.avaImg = c.avatar||null; x.nick = chNick(c);
  if(typeof renderChatList==='function') try{ renderChatList(); }catch(e){}
}

/* ---------- Настройки (тумблеры) ---------- */
function chPageMSettings(id){
  const c = chChannel(id); if(!c) return {title:'Настройки', html:''};
  const row = (ic,t,d,on,fn)=>`
    <button class="ch-toggle-row" onclick="${fn}">
      <span class="ch-tr-ic">${chI(ic)}</span>
      <span class="ch-tr-b"><b>${t}</b><small>${d}</small></span>
      <span class="switch ${on?'on':''}"><i></i></span>
    </button>`;
  const lockAccess = c.kind==='course';
  const html = `
    <div class="ch-sec-h">${chI('lock')} Доступ</div>
    ${row('lock','Закрытый доступ', lockAccess?'Курс всегда закрытый':'Витрина и вход по заявке/оплате', c.access==='closed', lockAccess?`toast('Курс всегда закрытый')`:`chToggleAccess('${id}')`)}
    ${row('card','Платный доступ', chPaid(c)?('Цена '+c.price+' ₽'+chPriceUnit(c)):'Включи и задай цену', chPaid(c), `chToggleAccess('${id}','paid')`)}
    <div class="ch-sec-h">${chI('comment')} Взаимодействие</div>
    ${row('comment','Обсуждения','Подписчики комментируют посты канала', c.discussions, `chToggle('${id}','discussions')`)}
    ${row('heart','Реакции','Лайки и эмодзи под постами', c.reactions, `chToggle('${id}','reactions')`)}
    <div class="ch-sec-h">${chI('megaphone')} Тип и цена</div>
    <button class="ch-mrow" onclick="chGo('mType','${id}')">
      <span class="ch-mr-ic">${chI('bolt')}</span>
      <span class="ch-mr-b"><b>Тип, доступ и цена</b><small>${chAccessLine(c)}</small></span>
      <span class="ch-mr-val">${chI('chev')}</span>
    </button>
    <div class="ch-sec-h">${chI('share')} Ссылка на канал</div>
    <button class="ch-mrow" onclick="chCopyLink('${id}')">
      <span class="ch-mr-ic">${chI('globe')}</span>
      <span class="ch-mr-b"><b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${chEsc(chPublicLink(c))}</b><small>Публичная ссылка-приглашение</small></span>
      <span class="ch-mr-val">${chI('copy')}</span>
    </button>`;
  return {title:'Настройки', html};
}
window.chToggle = function(id,key){
  const c = chChannel(id); if(!c) return; c[key]=!c[key]; chSave(); chRender();
  toast((key==='discussions'?'Обсуждения ':'Реакции ')+(c[key]?'включены':'выключены'));
};
/* быстрый тумблер доступа/оплаты прямо из настроек */
window.chToggleAccess = function(id, which){
  const c = chChannel(id); if(!c) return;
  if(which==='paid'){
    if(c.kind==='course'){ toast('Курс всегда платный'); return; }
    if(chPaid(c)){ c.price = 0; }
    else { c.price = c.kind==='course'?990:299; c.access='closed'; toast('Задай цену в «Тип и доступ»'); }
  } else {
    if(c.kind==='course'){ toast('Курс всегда закрытый'); return; }
    c.access = (c.access==='closed') ? 'open' : 'closed';
  }
  chNormalize(c); chSave(); chRender();
};
window.chCopyLink = function(id){
  const c = chChannel(id); if(!c) return;
  const link = chPublicLink(c);
  try{ navigator.clipboard && navigator.clipboard.writeText(link); }catch(e){}
  toast('Ссылка скопирована: '+link);
};

/* ---------- Приглашения / ссылки-инвайты ---------- */
function chPageMInvites(id){
  const c = chChannel(id); if(!c || !chIsMine(c)) return {title:'Приглашения', html:'<div class="ch-empty">Нет доступа</div>'};
  let html = `<div class="ch-sec-h">${chI('globe')} Публичная ссылка</div>`;
  html += chList([
    chNavRow('globe', chPublicLink(c), '', `chCopyLink('${id}')`, {copy:true, lime:true, sub:'Любой откроет канал по этой ссылке'})
  ]);
  html += `<div class="ch-sec-h">${chI('share')} Пригласительные ссылки</div>`;
  const rows = (c.invites||[]).map((v,i)=>
    chNavRow('forward', v.link, '', `chCopyInvite('${id}',${i})`, {copy:true, sub:(v.limit?('лимит '+v.limit+' входов · '):'')+'создана '+(v.when||'недавно')}));
  rows.push(`<button class="ch-row" onclick="chNewInvite('${id}')">
    <span class="ch-row-ic">${chI('plus')}</span>
    <span class="ch-row-main"><b style="color:var(--lime)">Создать новую ссылку</b></span>
  </button>`);
  html += chList(rows);
  html += chLF('Пригласительные ссылки работают даже для закрытого канала — делись ими где угодно. Каждая ведёт напрямую в канал.');
  return {title:'Приглашения', html};
}
window.chNewInvite = function(id){
  const c = chChannel(id); if(!c) return;
  c.invites = c.invites||[];
  const code = Math.random().toString(36).slice(2,10);
  c.invites.unshift({ link:'okoteam.top/+'+code, when:'сейчас', limit:0 });
  chSave(); chRender(); toast('Пригласительная ссылка создана');
};
window.chCopyInvite = function(id,i){
  const c = chChannel(id); if(!c || !c.invites || !c.invites[i]) return;
  try{ navigator.clipboard && navigator.clipboard.writeText(c.invites[i].link); }catch(e){}
  toast('Ссылка скопирована: '+c.invites[i].link);
};

/* ================= ВХОДЫ ================= */
/* 1) профиль: строка «Мои каналы» */
function chInsertProfileRow(){
  if(document.getElementById('chProfileRow')) return;
  const card = document.querySelector('#screen-profile .card');
  if(!card) return;
  const row = document.createElement('button');
  row.className = 'prow'; row.id = 'chProfileRow'; row.onclick = ()=>chOpen('list');
  row.innerHTML = `${chI('megaphone')} Мои каналы <span id="chProwCount">${CH.mine.length}</span> <span class="chev">${chI('chev')}</span>`;
  const anchor = card.querySelector('.prow[onclick="openEdit()"]');
  if(anchor) anchor.insertAdjacentElement('afterend', row);
  else card.appendChild(row);
}
function chUpdateProwCount(){ const el=document.getElementById('chProwCount'); if(el) el.textContent = CH.mine.length; }

/* 2) перехват создания канала/чата/супергруппы из меню «+» в чатах:
      pickChatKind('channel'|'chat'|'sgroup'|'group') → единый мастер chPageCreate */
if(typeof pickChatKind==='function'){
  const _prevPickChatKind = pickChatKind;
  pickChatKind = function(kind){
    if(kind==='channel' || kind==='sgroup' || kind==='chat' || kind==='group'){
      if(typeof closeSheet==='function') closeSheet();
      const target = kind==='group' ? 'sgroup' : kind;   // старую «Группу» тянем в супергруппу
      chDraft.kind = target;
      chPickKind(target);
      chOpen('create');
      return;
    }
    return _prevPickChatKind.apply(this, arguments);
  };
}

/* 2b) заменяем содержимое sheet-new-chat: теперь 3 варианта — Чат / Канал / Супергруппа */
function chPatchNewChatSheet(){
  const sheet = document.getElementById('sheet-new-chat'); if(!sheet) return;
  if(sheet.dataset.chPatched === '1') return;
  const heading = sheet.querySelector('h3');
  const form = sheet.querySelector('#newChatForm');
  const items = [
    {kind:'chat',    ic:'users',     t:'Чат',         s:'Общение группой. Пишут все участники, до 200 на FREE.'},
    {kind:'sgroup',  ic:'crown',     t:'Супергруппа', s:'До 200 000 участников, роли, темы, модерация — как в Telegram.'},
    {kind:'channel', ic:'megaphone', t:'Канал',       s:'Лента постов, пишет только админ. Юзеры — в комментариях.'},
    {kind:'direct',  ic:'user',      t:'Личный чат',  s:'Диалог один на один.'}
  ];
  const btnsHtml = items.map(it=>`
    <button class="sheet-item" onclick="pickChatKind('${it.kind}')">
      <svg class="i"><use href="#i-${it.ic}"/></svg>
      <span>${it.t}<small>${it.s}</small></span>
    </button>`).join('');
  /* убираем старые кнопки, подставляем новые перед формой */
  const old = sheet.querySelectorAll('.sheet-item'); old.forEach(b=>b.remove());
  if(form) sheet.insertBefore(document.createRange().createContextualFragment(btnsHtml), form);
  else sheet.insertAdjacentHTML('beforeend', btnsHtml);
  if(heading) heading.textContent = 'Создать';
  sheet.dataset.chPatched = '1';
}
try{ chPatchNewChatSheet(); }catch(e){}

/* 3) открытие канала-зеркала из списка чатов → наша вьюха */
if(typeof openConv==='function'){
  const _prevOpenConvCh = openConv;
  openConv = function(id){
    const c = (typeof CHATS!=='undefined') && CHATS.find(x=>x.id===id);
    if(c && c.openChannel){ chOpen('channel', c.openChannel); return; }
    return _prevOpenConvCh.apply(this, arguments);
  };
}

/* строку в профиле обновлять при перерисовке профиля */
if(typeof renderMyProfile==='function'){
  const _prevRMPch = renderMyProfile;
  renderMyProfile = function(){ _prevRMPch.apply(this, arguments); chInsertProfileRow(); chUpdateProwCount(); };
}

/* 3b) чип «Каталог» первым в фильтрах чатов — открывает витрину платного контента */
function chInsertCatalogChip(){
  const folders = document.getElementById('folders'); if(!folders) return;
  if(folders.querySelector('.ch-cat-open-chip')) return;
  const b = document.createElement('button');
  b.className = 'ch-cat-open-chip';
  b.innerHTML = chI('star') + '<span>Каталог</span>';
  b.title = 'Каталог платных каналов, клубов и курсов';
  b.addEventListener('click', e=>{ e.preventDefault(); chOpen('catalog'); });
  folders.insertBefore(b, folders.firstChild);
}
if(typeof renderFolders==='function'){
  const _prevRF = renderFolders;
  renderFolders = function(){ _prevRF.apply(this, arguments); try{ chInsertCatalogChip(); }catch(e){} };
}

/* 4) посты каналов в ленте рекомендаций: помечаем источником-каналом + открываем канал по тапу.
   Ранжирование по активности уже делает ядро (feedScore: лайки/комменты/репосты/просмотры). */
function chDecorateFeed(){
  const list = document.getElementById('feedList'); if(!list || typeof POSTS==='undefined') return;
  const map = {};
  (POSTS.rec||[]).concat(POSTS.sub||[]).forEach(p=>{ if(p && p.chOrigin) map[String(p.id)] = p; });
  list.querySelectorAll('.post[data-pid]').forEach(card=>{
    const p = map[card.getAttribute('data-pid')]; if(!p) return;
    const ava = card.querySelector('.ava');
    if(ava && !ava.dataset.chDone){
      ava.dataset.chDone = '1';
      if(p.avaImg){ ava.style.backgroundImage='url('+p.avaImg+')'; ava.style.backgroundSize='cover'; ava.style.backgroundPosition='center'; ava.textContent=''; }
      else if(p.avaIcon){ ava.innerHTML = chI(p.avaIcon); ava.classList.add('ch-feed-ava'); }
      ava.style.cursor='pointer';
      ava.addEventListener('click', function(e){ e.stopPropagation(); chOpen('channel', p.chOrigin); });
    }
    const nameEl = card.querySelector('.name');
    if(nameEl && !nameEl.querySelector('.ch-src-chip')){
      const chip = document.createElement('span');
      chip.className = 'chip ch-src-chip';
      chip.innerHTML = chI(p.chKind==='course'?'circle-play':p.chKind==='club'?'crown':'megaphone') + (p.chKind==='course'?'Курс':p.chKind==='club'?'Клуб':'Канал');
      chip.style.cursor='pointer';
      chip.addEventListener('click', function(e){ e.stopPropagation(); chOpen('channel', p.chOrigin); });
      nameEl.appendChild(chip);
    }
  });
}
if(typeof renderFeed==='function'){
  const _prevRenderFeedCh = renderFeed;
  renderFeed = function(){ const r=_prevRenderFeedCh.apply(this, arguments); try{ chDecorateFeed(); }catch(e){} return r; };
}

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
(function chInitCat(){
  /* доп-каталожные каналы для витрины (появляются один раз, если их ещё нет) */
  const CAT_SEED = [
    {id:'ch-cat-1', name:'Психология без воды', desc:'Практическая психология: самооценка, отношения, тревожность. Разборы, техники, поддержка сообщества.', icon:'star', bg:2, kind:'club', access:'closed', type:'paid', price:490, verified:true, subs:3210, reactions:true, discussions:true, owner:'Марина Ковалёва', ownerNick:'marina_psy', niche:'psy', posts:[]},
    {id:'ch-cat-2', name:'Финансы для новичка', desc:'Инвестиции с нуля: акции, облигации, ETF. Живая аналитика и разбор портфелей подписчиков.', icon:'bolt', bg:5, kind:'channel', access:'closed', type:'paid', price:399, verified:false, subs:1840, reactions:true, discussions:true, owner:'Игорь Финансист', ownerNick:'igor_fin', niche:'fin', posts:[]},
    {id:'ch-cat-3', name:'AI-дизайн PRO 2.0', desc:'Продвинутый курс по Midjourney, Sora, Runway и nano-banana. 12 уроков, шаблоны, промпты, живой чат авторов.', icon:'star', bg:8, kind:'course', access:'closed', type:'course', price:2490, verified:true, subs:412, reactions:true, discussions:true, owner:'Kate Design', ownerNick:'kate_ai', niche:'des', posts:[], lessons:[{id:'l1',title:'AI-workflow',dur:'8:00'},{id:'l2',title:'Midjourney базы',dur:'12:00'}]},
    {id:'ch-cat-4', name:'Отдел продаж за 30 дней', desc:'Клуб предпринимателей: скрипты, воронки, найм менеджеров. Работаем на цифры и результат.', icon:'crown', bg:0, kind:'club', access:'closed', type:'paid', price:1490, verified:true, subs:920, reactions:true, discussions:true, owner:'Роман Гуров', ownerNick:'roman_sales', niche:'biz', posts:[]},
    {id:'ch-cat-5', name:'Стиль жизни без спешки', desc:'Медитации, йога, режим сна. Мягкие практики для тех, кто выгорел на дедлайнах.', icon:'compass', bg:3, kind:'channel', access:'closed', type:'paid', price:299, verified:false, subs:2140, reactions:true, discussions:true, owner:'Лена Соболь', ownerNick:'lena_slow', niche:'life', posts:[]},
    {id:'ch-cat-6', name:'Английский разговорный', desc:'Живой английский без учебников. Мини-курс из 10 уроков + чат для практики с носителями.', icon:'globe', bg:7, kind:'course', access:'closed', type:'course', price:1290, verified:true, subs:1560, reactions:true, discussions:true, owner:'Emma Speak', ownerNick:'emma_en', niche:'edu', posts:[], lessons:[{id:'l1',title:'Small talk',dur:'6:00'}]},
  ];
  try{
    (CH.disc||[]).forEach(c=>{ if(!c.niche) c.niche = chNiche(c); });
    (CH.mine||[]).forEach(c=>{ if(!c.niche) c.niche = chNiche(c); });
    CAT_SEED.forEach(s=>{ if(!CH.disc.some(x=>x.id===s.id)) CH.disc.push(chNormalize(s)); });
    chSave();
  }catch(e){}
})();
(function chInit(){
  // недостающий символ шестерёнки (в ядре нет i-gear) — добавляем в стиле бренда
  try{
    const defs = document.querySelector('svg defs');
    if(defs && !document.getElementById('i-gear')){
      const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
      s.setAttribute('id','i-gear'); s.setAttribute('viewBox','0 0 100 100');
      s.innerHTML = '<circle cx="50" cy="50" r="12"/><path d="M50 20V32M50 68V80M20 50H32M68 50H80M29 29l8.5 8.5M62.5 62.5 71 71M71 29l-8.5 8.5M37.5 62.5 29 71"/>';
      defs.appendChild(s);
    }
  }catch(e){}
  chInsertProfileRow();
  try{ chInsertCatalogChip(); }catch(e){}
  // зеркалим существующие свои каналы в мессенджер (после перезагрузки)
  CH.mine.forEach(c=>chMirrorToChats(c));
})();

/* экспорт в глобальную область (onclick в разметке) */
window.chOpen = chOpen; window.chGo = chGo; window.chBack = chBack; window.chClose = chClose;
window.chDraft = chDraft; window.chRender = chRender;
/* черновики композера/урока используются в inline-обработчиках (глобальная область) — экспортируем */
window.chCompose = chCompose; window.chLessonDraft = chLessonDraft;

})();
