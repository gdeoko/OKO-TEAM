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
  'linear-gradient(135deg,#0a0a0a 0%,#1a2b00 55%,#9AFF00 140%)',
  'linear-gradient(135deg,#141414,#2a2a2a)',
  'linear-gradient(135deg,#0d2818,#0a0a0a 70%)',
  'linear-gradient(135deg,#1a1200,#3a2600)',
  'linear-gradient(135deg,#001a2b,#003a4d)',
  'linear-gradient(135deg,#2b0018,#4d0033)',
  'linear-gradient(135deg,#6fd400,#3a7a00)',
  'linear-gradient(135deg,#111,#000)',
  'linear-gradient(135deg,#26004d,#12002b)',
  'linear-gradient(135deg,#4d2600,#1a0d00)',
];
const CH_AV_BGS = [   // фон аватара под индекс фона (контрастный лайм/светлый)
  '#9AFF00','#e8e8e8','#9AFF00','#f0c000','#00c8ff','#ff4da6','#0a0a0a','#9AFF00','#b98cff','#ff9a3c'
];
const CH_ICONS = ['megaphone','bolt','fire','rocket','star','crown','globe','compass'];

/* ---------- состояние ---------- */
let CH = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-channels'))||null; }catch(e){ return null; } })();
function chSave(){ try{ localStorage.setItem('oko-channels', JSON.stringify(CH)); }catch(e){} }

function chSeed(){
  const mine = [
    { id:'ch-own-1', name:'OKO Инсайды', desc:'Личный канал: как я строю бизнес на нейросетях внутри OKO. Разборы, цифры, кейсы — без воды.',
      icon:'bolt', bg:0, type:'free', price:0, verified:true, subs:2140, reactions:true, discussions:true,
      admins:[{name:'Марина К.',nick:'marina_k'}], gross:0,
      members:chMockMembers(6), black:[],
      posts:[
        {txt:'Запустил платный канал внутри OKO — за первую неделю 68 подписчиков по 299 ₽. Расклад по цифрам ниже.', likes:184, views:5120, when:'2 ч', media:'poll'},
        {txt:'Правило, которое изменило мой контент: снимай не «что умеешь», а «что у аудитории болит».', likes:97, views:3040, when:'вчера'},
      ]},
    { id:'ch-own-2', name:'Клуб роста · PRO', desc:'Закрытый платный клуб: ежедневные задания, живые разборы, чат участников и доступ к базе шаблонов. Первые 100 участников — по спец-цене.',
      icon:'crown', bg:5, type:'paid', price:299, verified:true, subs:342, reactions:true, discussions:true,
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
      icon:'megaphone', bg:6, type:'free', price:0, verified:true, subs:48200, reactions:true, discussions:false, owner:'Команда OKO', ownerNick:'okonews',
      posts:[
        {txt:'Вышли платные каналы и курсы: создавай, продавай, зарабатывай. Комиссия OKO всего 10%.', likes:1240, views:41000, when:'1 ч', media:'circle-play'},
        {txt:'Розыгрыш PRO-подписки среди активных авторов недели. Условия внутри.', likes:820, views:33000, when:'вчера'},
      ]},
  ];
  return { v:1, seq:0, mine, disc, sub:{}, prog:{}, likes:{} };
}
if(!CH || !CH.v){ CH = chSeed(); chSave(); }
CH.sub = CH.sub||{}; CH.prog = CH.prog||{}; CH.likes = CH.likes||{}; CH.votes = CH.votes||{};

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
function chIsSubbed(c){ return chIsMine(c) || c.type==='free' || !!CH.sub[c.id]; }
function chTypeLabel(t){ return t==='paid'?'Платный':t==='course'?'Курс':'Обычный'; }
function chAvStyle(c){ return `background:${CH_BGS[c.bg||0]};`; }
function chAvColor(c){ return CH_AV_BGS[c.bg||0]==='#0a0a0a' ? 'color:#9AFF00' : ''; }
function chAvInner(c,cls){
  if(c.avatar){
    return `<div class="ch-av ${cls||''}" style="${chAvPhoto(c)}"></div>`;
  }
  const style = `background:${CH_AV_BGS[c.bg||0]||'#9AFF00'}`;
  const dark = (CH_AV_BGS[c.bg||0]==='#0a0a0a');
  const content = c.icon ? chI(c.icon) : chEsc((c.name[0]||'K').toUpperCase());
  return `<div class="ch-av ${cls||''}" style="${style}${dark?';color:#9AFF00':''}">${content}</div>`;
}
function chCourseProg(c){
  if(c.type!=='course' || !c.lessons) return 0;
  const done = (CH.prog[c.id]||[]).length;
  return Math.round(done/c.lessons.length*100);
}
function chBadge(c){ return c.verified ? `<svg class="i fill" style="width:0.95em;height:0.95em;vertical-align:-0.12em;margin-left:1px;color:var(--lime)"><use href="#i-verified"/></svg>` : ''; }
function chSlug(s){ return String(s||'').toLowerCase().replace(/[^a-zа-я0-9_]/gi,'').replace(/ё/g,'е').slice(0,18) || 'channel'; }
function chNick(c){ if(!c.nick) c.nick = chSlug(c.name); return c.nick; }
/* url(...) для фото-аватара/обложки, если владелец загрузил картинку */
function chAvPhoto(c){ return c.avatar ? `background-image:url(${c.avatar});background-size:cover;background-position:center;color:transparent` : ''; }

/* канал публикует пост → он попадает и в ленту рекомендаций (как Instagram) */
let CH_FEED_SEQ = 900000;
function chPushToFeed(c, post){
  if(typeof POSTS==='undefined' || !POSTS.rec) return;
  const id = ++CH_FEED_SEQ;
  post._feedId = id;
  POSTS.rec.unshift({
    id, ava:(c.name[0]||'K').toUpperCase(), avaIcon:c.icon||null, avaImg:c.avatar||null,
    name:c.name, sub:'канал · '+chFmtN(c.subs||0), body:post.txt||'',
    media: post.img ? null : (post.media==='circle-play'?'0:30':post.media==='poll'?'опрос':null),
    img: post.img||null, likes:post.likes||0, views:post.views||1,
    liked:false, saved:false, reposts:0, comments:[], chOrigin:c.id
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
  let out = {title:'Каналы', html:''};
  switch(top.page){
    case 'list':    out = chPageList(); break;
    case 'create':  out = chPageCreate(); break;
    case 'channel': out = chPageChannel(top.arg); break;
    case 'lesson':  out = chPageLesson(top.arg); break;
    case 'compose': out = chPageCompose(top.arg); break;
    case 'addLesson': out = chPageAddLesson(top.arg); break;
    case 'manage':  out = chPageManage(top.arg); break;
    case 'mType':   out = chPageMType(top.arg); break;
    case 'mSubs':   out = chPageMSubs(top.arg); break;
    case 'mAdmins': out = chPageMAdmins(top.arg); break;
    case 'mBlack':  out = chPageMBlack(top.arg); break;
    case 'mStats':  out = chPageMStats(top.arg); break;
    case 'mAppear': out = chPageMAppear(top.arg); break;
    case 'mSettings': out = chPageMSettings(top.arg); break;
    default: out = chPageList();
  }
  titleEl.textContent = out.title;
  if(out.tools) tools.innerHTML = out.tools;
  body.innerHTML = out.html;
  body.scrollTop = 0;
  if(out.after) try{ out.after(); }catch(e){}
}

/* ================= СТРАНИЦА: МОИ КАНАЛЫ ================= */
function chPageList(){
  const subbed = CH.disc.filter(c=>CH.sub[c.id]);
  const discover = CH.disc.filter(c=>!CH.sub[c.id]);
  const card = (c,ctx)=>{
    const prog = c.type==='course' ? chCourseProg(c) : null;
    const sub = c.type==='course'
      ? `${chI('circle-play')} ${c.lessons?c.lessons.length:0} уроков${prog!=null&&chIsSubbed(c)?` · ${prog}%`:''}`
      : `${chI('users')} ${chFmtN(c.subs||0)} подписчиков`;
    let right = '';
    if(ctx==='mine') right = `<span class="ch-tag ${c.type}">${chTypeLabel(c.type)}</span>`;
    else if(!chIsSubbed(c)) right = `<span class="ch-price-pill">${c.price} ₽${c.type==='paid'?'/мес':''}</span>`;
    else right = `<span class="ch-tag free">${chI('check')} доступ</span>`;
    return `<div class="ch-card" onclick="chGo('channel','${c.id}')">
      ${chAvInner(c,'')}
      <div class="ch-cbody">
        <div class="ch-cname"><span style="overflow:hidden;text-overflow:ellipsis">${chEsc(c.name)}</span>${chBadge(c)}</div>
        <div class="ch-csub">${sub}</div>
      </div>
      ${right}</div>`;
  };
  let html = `<button class="ch-create-cta" onclick="chGo('create')">
      <span class="ch-cc-ic">${chI('plus')}</span>
      <span><b>Создать канал</b><small>Обычный, платный или видео-курс — с монетизацией</small></span>
    </button>`;
  html += `<div class="ch-sec-h">${chI('crown')} Мои каналы</div>`;
  html += CH.mine.length ? CH.mine.map(c=>card(c,'mine')).join('')
    : `<div class="ch-empty">Пока нет своих каналов. Создай первый — и начни зарабатывать.</div>`;
  if(subbed.length){
    html += `<div class="ch-sec-h">${chI('bookmark')} Мои подписки</div>`;
    html += subbed.map(c=>card(c,'sub')).join('');
  }
  html += `<div class="ch-sec-h">${chI('compass')} Рекомендуем · платные и курсы</div>`;
  html += discover.map(c=>card(c,'disc')).join('');
  return {title:'Каналы', html};
}

/* ================= СТРАНИЦА: СОЗДАНИЕ ================= */
const chDraft = {type:'free', name:'', desc:'', price:299, bg:0, icon:'megaphone', useIcon:false, letter:''};
function chPageCreate(){
  const types = [
    ['free','megaphone','Обычный канал','Публикуй посты для подписчиков бесплатно — как в Telegram.'],
    ['paid','lock','Платный канал','Доступ по подписке N ₽/мес. Комиссия OKO 10%, остальное — тебе.'],
    ['course','circle-play','Видео-курс','Уроки внутри канала + прогресс. Продавай за фикс-цену, комиссия 10%.'],
  ];
  const html = `
    <div class="ch-sec-h">${chI('bolt')} Тип канала</div>
    <div class="ch-type-grid">${types.map(([t,ic,tt,d])=>`
      <button class="ch-type-card ${chDraft.type===t?'on':''}" onclick="chPickType('${t}')">
        <span class="ch-tc-ic">${chI(ic)}</span>
        <span style="flex:1;min-width:0"><b>${tt}</b><small>${d}</small></span>
        <span class="ch-tc-check">${chI('check')}</span>
      </button>`).join('')}</div>

    <label class="ch-lab">Название канала</label>
    <input class="ch-input" id="chDName" maxlength="42" placeholder="Например: Клуб роста PRO" value="${chEsc(chDraft.name)}" oninput="chDraft.name=this.value;chSyncCreateBtn()">

    <label class="ch-lab">Описание</label>
    <textarea class="ch-ta" id="chDDesc" rows="3" maxlength="240" placeholder="О чём канал, что получит подписчик…" oninput="chDraft.desc=this.value">${chEsc(chDraft.desc)}</textarea>

    <div id="chPriceBlock" style="display:${chDraft.type==='free'?'none':'block'}">
      <label class="ch-lab">${chDraft.type==='course'?'Цена курса (разовая)':'Цена подписки в месяц'}</label>
      <div class="ch-price-row">
        <input class="ch-input" id="chDPrice" inputmode="numeric" value="${chDraft.price}" oninput="chDraft.price=+this.value.replace(/\\D/g,'')||0;chSyncPriceChips()">
        <span class="ch-unit">₽${chDraft.type==='paid'?' / мес':''}</span>
      </div>
      <div class="ch-price-chips" id="chPriceChips">${chPriceChips()}</div>
      <div class="ch-owner-note">Ты получишь <b id="chNetHint">${chNet(chDraft.price)} ₽</b> с каждой продажи, OKO удержит комиссию 10%.</div>
    </div>

    <label class="ch-lab">Значок канала</label>
    <div class="ch-letter-row" id="chIconRow">
      <button class="ch-lt ${!chDraft.useIcon?'on':''}" onclick="chDraft.useIcon=false;chRender()" title="Первая буква названия"><span style="font:800 18px/1 var(--font-display);color:var(--lime)">A</span></button>
      ${CH_ICONS.map(ic=>`<button class="ch-lt ${chDraft.useIcon&&chDraft.icon===ic?'on':''}" onclick="chDraft.useIcon=true;chDraft.icon='${ic}';chRender()">${chI(ic)}</button>`).join('')}
    </div>

    <label class="ch-lab">Фон канала</label>
    <div class="ch-appear-prev" id="chBgPrev" style="background:${CH_BGS[chDraft.bg]}">
      <div class="ch-ap-ava" style="background:${CH_AV_BGS[chDraft.bg]||'#9AFF00'}${CH_AV_BGS[chDraft.bg]==='#0a0a0a'?';color:#9AFF00':''}">${chDraft.useIcon?chI(chDraft.icon):(chDraft.name[0]||'K').toUpperCase()}</div>
      <div class="ch-ap-name">${chEsc(chDraft.name||'Новый канал')}</div>
    </div>
    <div class="ch-swatches">${CH_BGS.map((g,i)=>`<div class="ch-sw ${chDraft.bg===i?'on':''}" style="background:${g}" onclick="chDraft.bg=${i};chRender()"></div>`).join('')}</div>

    <div style="height:18px"></div>
    <button class="btn" id="chCreateBtn" onclick="chCreateChannel()" ${chDraft.name.trim()?'':'disabled style="opacity:.5"'}>${chI('plus')} Создать канал</button>
    <div style="height:10px"></div>`;
  return {title:'Новый канал', html};
}
function chPriceChips(){
  const opts = chDraft.type==='course' ? [490,990,1490,2900] : [99,199,299,499];
  return opts.map(p=>`<button class="${chDraft.price===p?'on':''}" onclick="chDraft.price=${p};chSyncPriceChips();chSyncPriceInput()">${p} ₽</button>`).join('');
}
function chNet(p){ return Math.round((p||0)*(1-CH_FEE)); }
window.chPickType = function(t){
  chDraft.type = t;
  if(t==='course' && chDraft.price<490) chDraft.price = 990;
  if(t==='paid' && chDraft.price>499) chDraft.price = 299;
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
  const name = chDraft.name.trim();
  if(!name){ toast('Введите название канала'); return; }
  CH.seq = (CH.seq||0)+1;
  const c = {
    id:'ch-my-'+CH.seq, name, nick:chSlug(name), desc:chDraft.desc.trim()||'Добро пожаловать в канал!',
    icon: chDraft.useIcon ? chDraft.icon : null, bg:chDraft.bg, cover:null, avatar:null,
    type:chDraft.type, price: chDraft.type==='free'?0:(chDraft.price||0),
    verified:false, subs:1, reactions:true, discussions:chDraft.type!=='course',
    admins:[], gross:0, members:[{name:PROFILE.name, nick:PROFILE.nick, joined:'сейчас'}], black:[],
    posts:[{txt:'Канал создан. Первый пост задаёт тон — расскажи, что будет полезного для подписчиков.', likes:0, views:1, when:'сейчас'}],
    lessons: chDraft.type==='course' ? [{id:'l1', title:'Вводный урок', dur:'5:00'}] : undefined,
  };
  CH.mine.unshift(c);
  chSave();
  chMirrorToChats(c);  // канал появляется и в мессенджере (реальный, как в TG)
  // сброс черновика
  chDraft.name=''; chDraft.desc=''; chDraft.type='free'; chDraft.price=299; chDraft.bg=0; chDraft.useIcon=false; chDraft.icon='megaphone';
  if(typeof showPopup==='function'){
    showPopup({ico:'check', title:'Канал создан',
      body:`«${chEsc(c.name)}» готов. ${c.type!=='free'?'Настрой доступ и приглашай первых подписчиков — они платят, ты зарабатываешь.':'Публикуй посты и расти аудиторию.'}`,
      actions:[{label:'Открыть канал', onclick:()=>{ chNav=[{page:'list'}]; chGo('channel',c.id); }},{label:'К списку', ghost:true, onclick:()=>{ chNav=[{page:'list'}]; chRender(); }}]});
  } else { chNav=[{page:'list'}]; chGo('channel',c.id); }
};

/* канал → запись в CHATS (мессенджер), чтобы он был «настоящим» */
function chMirrorToChats(c){
  if(typeof CHATS==='undefined') return;
  if(CHATS.some(x=>x.chId===c.id)) return;
  CHATS.unshift({
    id:'chan_'+c.id, chId:c.id, name:c.name, kind:'channel', managed:true, writeAll:false,
    ava:(c.name[0]||'K').toUpperCase(), avaIcon: c.icon||null, kindIcon:'megaphone',
    subs:chFmtN(c.subs||0), nick:c.nick, preview:c.type==='course'?'Видео-курс':c.type==='paid'?'Платный канал':'Канал создан',
    time:(typeof nowT==='function'?nowT():'сейчас'), unread:0, online:false,
    msgs:[{kind:'sys', body:`Канал «${c.name}» — открой в разделе «Мои каналы» для управления`}],
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
      <div class="ch-cv-sub">${chTypeLabel(c.type)}${c.type!=='free'?` · ${c.price} ₽${c.type==='paid'?'/мес':''}`:''}${mine?' · вы владелец':''}</div>
      <div class="ch-cv-stats">
        <div><b>${chFmtN(c.subs||0)}</b><small>подписчиков</small></div>
        ${c.type==='course'?`<div><b>${c.lessons?c.lessons.length:0}</b><small>уроков</small></div>`:`<div><b>${c.posts?c.posts.length:0}</b><small>постов</small></div>`}
        <div><b>${c.reactions?'вкл':'выкл'}</b><small>реакции</small></div>
      </div>
    </div>`;

  // не подписан на платный/курс → paywall
  if(!subbed){
    const benefits = c.type==='course'
      ? ['Полный доступ ко всем '+(c.lessons?c.lessons.length:0)+' видео-урокам','Практика и разбор твоих работ','Доступ навсегда, смотри в своём темпе','Чат поддержки с автором']
      : ['Все закрытые посты и разборы','Новые материалы каждую неделю','Доступ в чат подписчиков','Отмена подписки в любой момент'];
    return {title:c.name, html: cover + `
      <div class="ch-desc">${chEsc(c.desc)}</div>
      <div class="ch-paywall">
        <div class="ch-pw-blur">
          ${(c.posts&&c.posts.length?c.posts:[{txt:'Закрытый материал для подписчиков…'}]).slice(0,2).map(p=>
            `<div class="ch-post"><div class="ch-post-txt">${chEsc(p.txt)}</div></div>`).join('')}
        </div>
        <div class="ch-pw-body">
          <div class="ch-pw-lock">${chI('lock')}</div>
          <h3>${c.type==='course'?'Открой доступ к курсу':'Контент только для подписчиков'}</h3>
          <p>${chEsc(c.owner?('Автор: '+c.owner):'Оформи доступ, чтобы видеть все материалы')}</p>
          <div class="ch-pw-price">${c.price} ₽<span>${c.type==='paid'?' / мес':' разово'}</span></div>
          <ul class="ch-pw-benefits">${benefits.map(b=>`<li>${chI('check')}<span>${b}</span></li>`).join('')}</ul>
          <button class="btn" onclick="chSubscribe('${c.id}')">${chI(c.type==='course'?'circle-play':'lock')} ${c.type==='course'?'Купить курс за '+c.price+' ₽':'Подписаться за '+c.price+' ₽/мес'}</button>
          <p style="font-size:11px;color:var(--dim);margin-top:9px">Оплата с кошелька OKO · безопасно · комиссия сервиса 10%</p>
        </div>
      </div>`};
  }

  // подписан / владелец / бесплатный
  let html = cover;
  html += `<div class="ch-desc">${chEsc(c.desc)}</div>`;

  if(mine){
    html += `<div class="ch-owner-bar">
      <button class="btn" onclick="chGo('${c.type==='course'?'addLesson':'compose'}','${c.id}')">${chI('plus')} ${c.type==='course'?'Добавить урок':'Опубликовать пост'}</button>
      <button class="btn ghost" onclick="chGo('manage','${c.id}')">${chI('bolt')} Управление</button>
    </div>`;
  } else {
    const authorName = c.owner || (c.admins&&c.admins[0]&&c.admins[0].name) || c.name;
    const authorNick = c.ownerNick || chNick(c);
    html += `<div class="ch-owner-bar">
      <button class="btn ghost" onclick="chDM('${chEsc(authorName)}','${chEsc(authorNick)}')">${chI('send')} Написать автору</button>
      ${c.type!=='free'?`<button class="btn ghost" onclick="chUnsub('${c.id}')">${chI('check')} Подписка</button>`:''}
    </div>`;
  }

  if(c.type==='course'){
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
    html += `<div class="ch-sec-h">${chI('feed')} Посты</div>`;
    html += (c.posts&&c.posts.length) ? c.posts.map((p,i)=>chPostHtml(c,p,i)).join('')
      : `<div class="ch-empty">Постов пока нет</div>`;
  }
  html += `<div style="height:8px"></div>`;
  const tools = mine ? `<button onclick="chGo('manage','${c.id}')" title="Управление">${chI('bolt')}</button>` : '';
  return {title:c.name, html, tools};
}
function chPostHtml(c,p,i){
  const liked = !!(CH.likes[c.id]&&CH.likes[c.id][i]);
  const likes = (p.likes||0)+(liked?1:0);
  return `<div class="ch-post">
    <div class="ch-post-h">${chAvInner(c,'mini')}<b>${chEsc(c.name)}</b><small>${p.when||''}</small></div>
    <div class="ch-post-txt">${chEsc(p.txt)}</div>
    ${p.img?`<div class="ch-post-media photo" style="background-image:url(${p.img})"></div>`
      :p.media==='poll'?chPollHtml(c,p,i)
      :p.media?`<div class="ch-post-media" style="background:${CH_BGS[c.bg||0]}">${chI(p.media)}${p.media==='circle-play'?'<span class="ch-pm-dur">видео</span>':''}</div>`:''}
    <div class="ch-post-acts">
      ${c.reactions?`<button class="${liked?'on':''}" onclick="chLike('${c.id}',${i})">${chI('heart')}${likes}</button>`:''}
      ${c.discussions?`<button onclick="toast('Обсуждения включены — комментарии подключатся с бэкендом')">${chI('comment')}Обсудить</button>`:''}
      <span class="ch-views">${chI('eye')}${chFmtN(p.views||0)}</span>
    </div>
  </div>`;
}
/* живой опрос под постом (голос сохраняется) */
function chPollHtml(c,p,i){
  const opts = (p.poll&&p.poll.opts) || ['Уже применяю','Возьму в работу'];
  const key = c.id+':'+i;
  const voted = CH.votes[key];
  const base = (p.poll&&p.poll.base) || [Math.max(3,(p.views||40)%60+12), Math.max(2,(p.views||30)%40+7)];
  const counts = opts.map((_,k)=> base[k%base.length] + (voted===k?1:0));
  const total = counts.reduce((a,b)=>a+b,0)||1;
  const q = (p.poll&&p.poll.q) || 'А ты как?';
  return `<div class="ch-poll">
    <div class="ch-poll-q">${chI('poll')} ${chEsc(q)}</div>
    ${opts.map((o,k)=>{
      const pct = Math.round(counts[k]/total*100);
      return `<button class="ch-poll-opt${voted!=null?' voted':''}${voted===k?' mine':''}" ${voted!=null?'disabled':''} onclick="chVote('${c.id}',${i},${k})">
        <span class="ch-po-fill" style="width:${voted!=null?pct:0}%"></span>
        <span class="ch-po-t">${chEsc(o)}</span>
        ${voted!=null?`<span class="ch-po-p">${pct}%</span>`:''}
      </button>`;
    }).join('')}
    <div class="ch-poll-total">${voted!=null?chFmtN(total)+' голосов':'Нажми, чтобы проголосовать'}</div>
  </div>`;
}
window.chVote = function(id,i,k){
  const c = chChannel(id); if(!c) return;
  CH.votes[id+':'+i] = k; chSave(); chRender();
};
window.chLike = function(id,i){
  const c = chChannel(id); if(!c||!c.reactions) return;
  CH.likes[id] = CH.likes[id]||{};
  CH.likes[id][i] = !CH.likes[id][i];
  chSave(); chRender();
};

/* ---------- подписка / покупка (деньги) ---------- */
window.chSubscribe = function(id){
  const c = chChannel(id); if(!c) return;
  if(c.type==='free'){ CH.sub[id]=1; chSave(); toast('Вы подписались на канал'); chRender(); return; }
  const price = c.price||0;
  if(typeof walletCharge!=='function'){ toast('Кошелёк недоступен'); return; }
  const why = (c.type==='course'?'Покупка курса: ':'Подписка на канал: ')+c.name;
  if(!walletCharge(price, why)) return;              // сам покажет «недостаточно средств»
  if(typeof okoEarn==='function') okoEarn(price*CH_FEE, 'Комиссия каналов 10%');
  CH.sub[id]=1; c.subs=(c.subs||0)+1; chSave();
  const net = Math.round(price*(1-CH_FEE));
  if(typeof showPopup==='function'){
    showPopup({ico:'check', title: c.type==='course'?'Курс открыт':'Подписка оформлена',
      body:`Списано ${price} ₽ с кошелька. Автору начислено ${net} ₽, комиссия OKO 10% (${Math.round(price*CH_FEE)} ₽). ${c.type==='course'?'Все уроки доступны навсегда.':'Доступ активен на месяц.'}`,
      actions:[{label:c.type==='course'?'К урокам':'Читать канал', onclick:()=>chRender()}]});
  } else { toast('Доступ открыт'); }
  chRender();
};
window.chUnsub = function(id){
  const c = chChannel(id); if(!c) return;
  if(typeof showPopup!=='function'){ delete CH.sub[id]; if(c.subs)c.subs--; chSave(); chRender(); return; }
  showPopup({ico:'flag', title:'Отменить доступ?',
    body:`Ты потеряешь доступ к «${chEsc(c.name)}». ${c.type==='paid'?'Подписку можно оформить снова в любой момент.':''}`,
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
  const rows = [
    ['megaphone','Тип канала', chTypeLabel(c.type)+(c.type!=='free'?` · ${c.price} ₽`:''), `chGo('mType','${id}')`],
    ['comment','Обсуждения', c.discussions?'включены':'выключены', `chGo('mSettings','${id}')`],
    ['heart','Реакции', c.reactions?'включены':'выключены', `chGo('mSettings','${id}')`],
    ['users','Администраторы', (c.admins?c.admins.length:0)+'', `chGo('mAdmins','${id}')`],
    ['user','Подписчики', chFmtN(c.subs||0), `chGo('mSubs','${id}')`],
    ['poll','Статистика', 'графики', `chGo('mStats','${id}')`],
    ['lock','Чёрный список', (c.black?c.black.length:0)+'', `chGo('mBlack','${id}')`],
    ['photo','Фон и аватар', 'оформление', `chGo('mAppear','${id}')`],
    ['gear','Настройки', '', `chGo('mSettings','${id}')`],
  ];
  let html = `<div class="ch-manage-hub">${chAvInner(c,'big')}
    <div style="text-align:center;margin-bottom:16px">
      <div style="font:800 18px/1.1 var(--font-display);display:flex;align-items:center;gap:6px;justify-content:center">${chEsc(c.name)}${chBadge(c)}</div>
      <div style="color:var(--dim);font-size:12px;margin-top:4px">${chTypeLabel(c.type)} · ${chFmtN(c.subs||0)} подписчиков</div>
    </div></div>`;

  // доход владельца (платный/курс)
  if(c.type!=='free'){
    const gross = c.gross||0, net = Math.round(gross*(1-CH_FEE)), fee = gross-net;
    html += `<div class="ch-earn">
      <small class="ch-earn-lab">Доход канала к выводу</small>
      <div class="ch-earn-sum">${net.toLocaleString('ru-RU').replace(/,/g,' ')} <span>₽</span></div>
      <div class="ch-earn-calc">
        <div><span>Продажи ${c.type==='course'?'курса':'подписок'}</span><b>${gross.toLocaleString('ru-RU').replace(/,/g,' ')} ₽</b></div>
        <div class="fee"><span>Комиссия OKO 10%</span><b>− ${fee.toLocaleString('ru-RU').replace(/,/g,' ')} ₽</b></div>
        <div class="total"><span>К выводу</span><b>${net.toLocaleString('ru-RU').replace(/,/g,' ')} ₽</b></div>
      </div>
      <button class="btn" onclick="chWithdraw('${id}')" ${net>0?'':'disabled style="opacity:.5"'}>${chI('money')} Вывести на кошелёк</button>
    </div>`;
  }

  html += rows.map(([ic,t,val,fn])=>`
    <button class="ch-mrow" onclick="${fn}">
      <span class="ch-mr-ic">${chI(ic)}</span>
      <span class="ch-mr-b"><b>${t}</b></span>
      <span class="ch-mr-val">${val}${chI('chev')}</span>
    </button>`).join('');
  html += `<div style="height:8px"></div>
    <button class="ch-mrow danger" onclick="chDeleteChannel('${id}')">
      <span class="ch-mr-ic">${chI('trash')}</span>
      <span class="ch-mr-b"><b>Удалить канал</b><small>Действие необратимо</small></span>
    </button>`;
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

/* ---------- Тип канала ---------- */
function chPageMType(id){
  const c = chChannel(id); if(!c) return {title:'Тип', html:''};
  const opts = [
    ['free','megaphone','Обычный','Бесплатный доступ для всех подписчиков'],
    ['paid','lock','Платный','Доступ по подписке за ежемесячную плату'],
    ['course','circle-play','Курс','Видео-уроки внутри канала за фикс-цену'],
  ];
  const html = `
    <div class="ch-owner-note" style="margin-bottom:12px">Смена типа мгновенно меняет способ доступа к каналу. При переходе на платный подписчики продолжат платить, новые — по новой цене.</div>
    <div class="ch-seg">${opts.map(([t,ic,tt,d])=>`
      <button class="ch-type-card ${c.type===t?'on':''}" onclick="chSetType('${id}','${t}')">
        <span class="ch-tc-ic">${chI(ic)}</span>
        <span style="flex:1;min-width:0"><b>${tt}</b><small>${d}</small></span>
        <span class="ch-tc-check">${chI('check')}</span>
      </button>`).join('')}</div>
    ${c.type!=='free'?`
      <label class="ch-lab">${c.type==='course'?'Цена курса':'Цена подписки в месяц'}</label>
      <div class="ch-price-row">
        <input class="ch-input" id="chTPrice" inputmode="numeric" value="${c.price}" oninput="chSetPrice('${id}',this.value)">
        <span class="ch-unit">₽${c.type==='paid'?' / мес':''}</span>
      </div>
      <div class="ch-owner-note">С каждой продажи ты получаешь <b>${chNet(c.price)} ₽</b>, OKO — 10% (${Math.round(c.price*CH_FEE)} ₽).</div>`:''}`;
  return {title:'Тип канала', html};
}
window.chSetType = function(id,t){
  const c = chChannel(id); if(!c) return;
  c.type = t;
  if(t==='free') c.price = 0;
  else if(!c.price){ c.price = t==='course'?990:299; }
  if(t==='course' && !c.lessons) c.lessons=[{id:'l1',title:'Вводный урок',dur:'5:00'}];
  chSave(); chRender();
  toast('Тип изменён на «'+chTypeLabel(t)+'»');
};
window.chSetPrice = function(id,v){
  const c = chChannel(id); if(!c) return;
  c.price = +String(v).replace(/\D/g,'')||0; chSave();
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
        <div class="ch-av mini" style="background:${CH_AV_BGS[(p.nick||'x').length%CH_AV_BGS.length]}">${chEsc((p.name[0]||'U').toUpperCase())}</div>
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
    <div class="ch-owner-note" style="margin-bottom:12px">Администраторы могут публиковать посты, банить участников и модерировать обсуждения. Владелец — ты.</div>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:4px 13px">
      <div class="ch-member">
        <div class="ch-av mini" style="background:${CH_AV_BGS[c.bg||0]||'#9AFF00'}">${chEsc((PROFILE.name[0]||'O').toUpperCase())}</div>
        <div class="ch-m-b"><b>${chEsc(PROFILE.name)}</b><small>@${chEsc(PROFILE.nick)} · создатель</small></div>
        <span class="ch-m-role owner">владелец</span>
      </div>
      ${a.map(p=>`
      <div class="ch-member">
        <div class="ch-av mini" style="background:${CH_AV_BGS[(p.nick||'x').length%CH_AV_BGS.length]}">${chEsc((p.name[0]||'A').toUpperCase())}</div>
        <div class="ch-m-b"><b>${chEsc(p.name)}</b><small>@${chEsc(p.nick)} · администратор</small></div>
        <button class="ch-m-act" title="Разжаловать" onclick="chRemoveAdmin('${id}','${chEsc(p.nick)}')">${chI('trash')}</button>
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
  c.admins = c.admins||[]; c.admins.push({name:p.name, nick:p.nick}); chSave(); chRender();
  toast(p.name+' назначен администратором');
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
    ${c.type!=='free'?`<div class="ch-canvas-wrap"><div class="ch-cw-h">Выручка · 6 мес <span>${(c.gross||0).toLocaleString('ru-RU').replace(/,/g,' ')} ₽</span></div><canvas id="chStatRev" width="600" height="260"></canvas></div>`:''}
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
    : `background:${CH_AV_BGS[c.bg||0]||'#9AFF00'}${CH_AV_BGS[c.bg||0]==='#0a0a0a'?';color:#9AFF00':''}`;
  const html = `
    <div class="ch-appear-prev" style="${prevBg}">
      <div class="ch-ap-ava" style="${avStyle}">${c.avatar?'':(c.icon?chI(c.icon):(c.name[0]||'K').toUpperCase())}</div>
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

    <label class="ch-lab">Фон-градиент${c.cover?' (под обложкой)':''}</label>
    <div class="ch-swatches">${CH_BGS.map((g,i)=>`<div class="ch-sw ${c.bg===i?'on':''}" style="background:${g}" onclick="chSetBg('${id}',${i})"></div>`).join('')}</div>
    <label class="ch-lab">Значок (если без фото-аватара)</label>
    <div class="ch-letter-row">
      <button class="ch-lt ${!c.icon?'on':''}" onclick="chSetIcon('${id}','')" title="Первая буква"><span style="font:800 18px/1 var(--font-display);color:var(--lime)">${(c.name[0]||'K').toUpperCase()}</span></button>
      ${CH_ICONS.map(ic=>`<button class="ch-lt ${c.icon===ic?'on':''}" onclick="chSetIcon('${id}','${ic}')">${chI(ic)}</button>`).join('')}
    </div>
    <div class="ch-owner-note">Обложка, аватар, название и адрес отображаются на странице канала, в карточке и в мессенджере. Всё сохраняется сразу.</div>`;
  return {title:'Оформление', html};
}
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
  const html = `
    ${row('comment','Обсуждения','Подписчики комментируют посты канала', c.discussions, `chToggle('${id}','discussions')`)}
    ${row('heart','Реакции','Лайки и эмодзи под постами', c.reactions, `chToggle('${id}','reactions')`)}
    <div class="ch-sec-h">${chI('share')} Ссылка на канал</div>
    <button class="ch-mrow" onclick="chCopyLink('${id}')">
      <span class="ch-mr-ic">${chI('globe')}</span>
      <span class="ch-mr-b"><b>oko.app/c/${chEsc((c.name||'ch').toLowerCase().replace(/[^a-zа-я0-9]/gi,'').slice(0,14)||'channel')}</b><small>Публичная ссылка-приглашение</small></span>
      <span class="ch-mr-val">${chI('copy')}</span>
    </button>
    <button class="ch-mrow" onclick="chGo('mType','${id}')">
      <span class="ch-mr-ic">${chI('megaphone')}</span>
      <span class="ch-mr-b"><b>Тип и цена</b><small>${chTypeLabel(c.type)}${c.type!=='free'?' · '+c.price+' ₽':''}</small></span>
      <span class="ch-mr-val">${chI('chev')}</span>
    </button>`;
  return {title:'Настройки', html};
}
window.chToggle = function(id,key){
  const c = chChannel(id); if(!c) return; c[key]=!c[key]; chSave(); chRender();
  toast((key==='discussions'?'Обсуждения ':'Реакции ')+(c[key]?'включены':'выключены'));
};
window.chCopyLink = function(id){
  const c = chChannel(id); if(!c) return;
  const link = 'oko.app/c/'+((c.name||'ch').toLowerCase().replace(/[^a-zа-я0-9]/gi,'').slice(0,14)||'channel');
  try{ navigator.clipboard && navigator.clipboard.writeText(link); }catch(e){}
  toast('Ссылка скопирована: '+link);
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

/* 2) перехват создания канала из меню «+ » в чатах: pickChatKind('channel') → наш мастер */
if(typeof pickChatKind==='function'){
  const _prevPickChatKind = pickChatKind;
  pickChatKind = function(kind){
    if(kind==='channel'){
      if(typeof closeSheet==='function') closeSheet();
      chOpen('create');
      return;
    }
    return _prevPickChatKind.apply(this, arguments);
  };
}

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

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
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
  // зеркалим существующие свои каналы в мессенджер (после перезагрузки)
  CH.mine.forEach(c=>chMirrorToChats(c));
})();

/* экспорт в глобальную область (onclick в разметке) */
window.chOpen = chOpen; window.chGo = chGo; window.chBack = chBack; window.chClose = chClose;
window.chDraft = chDraft; window.chRender = chRender;

})();
