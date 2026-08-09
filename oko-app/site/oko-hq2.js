/* ============================================================================
   OKO · oko-hq2.js — ШТАБ OKO (HQ) + АДМИНКА ВЛАДЕЛЬЦА
   ----------------------------------------------------------------------------
   Задача файла: довести два раздела владельца до состояния «готово к запуску».

   1. ШТАБ OKO — экран команды ИИ-агентов. Каждый агент честно рассказывает:
      кто он, что умеет, что вернёт и ЧЕГО НЕ ХВАТАЕТ, чтобы он заработал
      (какой именно ключ и где его взять). Никаких выдуманных процентов
      загрузки, «рендер 72%» и прочего театра.

   2. АДМИНКА ВЛАДЕЛЬЦА — пользователи, оплаты, тарифы, контент, модерация,
      фича-флаги, экспорт. Все счётчики берутся из реального состояния
      приложения; то, что живёт на сервере и сервер не отдал — прочерк.

   ПРИНЦИПЫ (правки Даниэля, действуют навсегда):
     • Ноль демо-данных. Пусто — это empty-state, а не фейк.
     • Никаких ложных подтверждений: кнопка либо делает дело, либо честно
       говорит, что произойдёт и чего не хватает.
     • Только SVG-иконки из общего спрайта, никаких эмодзи.
     • Безопасные зоны только через var(--oko-safe-*).
     • Текст не обрезается и не рвётся посреди слова.
     • Из любого экрана есть выход: «назад», Escape, тап вне, системная назад.

   Файл самодостаточный: грузится ПОСЛЕ ядра, стили кладёт одним <style>,
   ядро (index.html / app.js / app.css) не переписывает. Обработчики повешены
   делегированием по data-h2act — глобальные функции не плодятся.
   ============================================================================ */
(function okoHq2(){
'use strict';

if(window.__okoHq2Ready) return;
window.__okoHq2Ready = true;

/* ==========================================================================
   0. МЕЛКИЕ ХЕЛПЕРЫ
   ========================================================================== */

/* Своё экранирование — не зависим от порядка загрузки ядра. */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function ic(name, cls){
  return '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}
function say(msg){
  try{ if(typeof window.toast === 'function'){ window.toast(msg); return; } }catch(e){}
}
function fn(name){ return (typeof window[name] === 'function') ? window[name] : null; }
function arr(x){ return Array.isArray(x) ? x : []; }

/* --------------------------------------------------------------------------
   Доступ к состоянию ядра.
   Важно: ядро объявляет ADMIN, PLANS, PROFILE и прочее через const/let на
   верхнем уровне классического скрипта. Такие имена НЕ становятся свойствами
   window — читать их можно только как обычные идентификаторы, поэтому здесь
   для каждого свой аккуратный геттер с проверкой typeof.
   -------------------------------------------------------------------------- */
function gADMIN(){    try{ return (typeof ADMIN !== 'undefined' && ADMIN) ? ADMIN : null; }catch(e){ return null; } }
function gPROFILE(){  try{ return (typeof PROFILE !== 'undefined' && PROFILE) ? PROFILE : null; }catch(e){ return null; } }
function gPLANS(){    try{ return (typeof PLANS !== 'undefined' && PLANS) ? PLANS : null; }catch(e){ return null; } }
function gPERIODS(){  try{ return (typeof PAY_PERIODS !== 'undefined' && PAY_PERIODS) ? PAY_PERIODS : []; }catch(e){ return []; } }
function gPOSTS(){    try{ return (typeof POSTS !== 'undefined' && POSTS) ? POSTS : null; }catch(e){ return null; } }
function gCHATS(){    try{ return (typeof CHATS !== 'undefined' && CHATS) ? CHATS : []; }catch(e){ return []; } }
function gLISTINGS(){ try{ return (typeof LISTINGS !== 'undefined' && LISTINGS) ? LISTINGS : []; }catch(e){ return []; } }
function gREVENUE(){  try{ return (typeof OKO_REVENUE !== 'undefined' && OKO_REVENUE) ? OKO_REVENUE : []; }catch(e){ return []; } }
function gWALLET(){   try{ return (typeof WALLET !== 'undefined' && WALLET) ? WALLET : null; }catch(e){ return null; } }
function gCOURSES(){  try{ return (typeof AC_COURSES !== 'undefined' && AC_COURSES) ? AC_COURSES : []; }catch(e){ return []; } }
function gADS(){      try{ return (typeof ADS !== 'undefined' && ADS) ? ADS : null; }catch(e){ return null; } }
function gSB(){       try{ return (typeof sb !== 'undefined') ? sb : null; }catch(e){ return null; } }
function gHQSTATE(){  try{ return (typeof HQ_STATE !== 'undefined' && HQ_STATE) ? HQ_STATE : null; }catch(e){ return null; } }
function gHQADREV(){  try{ return (typeof HQ_ADREV !== 'undefined' && HQ_ADREV) ? HQ_ADREV : null; }catch(e){ return null; } }
function gHQMOD(){    try{ return (typeof HQ_MOD !== 'undefined' && HQ_MOD) ? HQ_MOD : null; }catch(e){ return null; } }
function gHQREPORTS(){try{ return (typeof HQ_REPORTS !== 'undefined' && HQ_REPORTS) ? HQ_REPORTS : []; }catch(e){ return []; } }
/* Каналы живут внутри своего IIFE и наружу не видны — считаем из хранилища. */
function gChannels(){
  try{
    var c = JSON.parse(localStorage.getItem('oko-channels'));
    if(!c) return 0;
    return arr(c.mine).length + arr(c.disc).length;
  }catch(e){ return 0; }
}

/* Число для интерфейса. Ни при каких данных не должно получиться
   NaN / undefined / Infinity — вместо них честный прочерк. */
function num(v){
  var n = Number(v);
  if(!isFinite(n)) return '—';
  return n.toLocaleString('ru-RU');
}
/* Деньги. Тот же контракт: не число — прочерк, а не «NaN ₽». */
function money(v){
  var n = Number(v);
  if(!isFinite(n)) return '—';
  var f = fn('fmtMoney');
  if(f){ try{ return f(n); }catch(e){} }
  return Math.round(n).toLocaleString('ru-RU') + ' ₽';
}
function hm(d){
  d = d instanceof Date ? d : new Date(d);
  if(isNaN(d.getTime())) return '—';
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function when(at){
  var d = new Date(at); if(isNaN(d.getTime())) return '—';
  var n = new Date();
  if(d.toDateString() === n.toDateString()) return 'сегодня ' + hm(d);
  if(d.toDateString() === new Date(n.getTime() - 864e5).toDateString()) return 'вчера ' + hm(d);
  return String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0') + ' ' + hm(d);
}
function uid(p){ return (p || 'h2') + '-' + Date.now().toString(36) + '-' + Math.floor(Math.random()*1e6).toString(36); }

/* Владелец ли смотрит. Раздел существует только для PROFILE.role === 'owner'. */
function isOwnerNow(){
  var f = fn('isOwner');
  if(f){ try{ return !!f(); }catch(e){} }
  var p = gPROFILE();
  return !!(p && p.role === 'owner');
}

/* ==========================================================================
   1. СОСТОЯНИЕ ШТАБА (персист oko-hq2)
   Здесь живут ТОЛЬКО реальные записи: задачи, которые владелец поставил
   руками, и журнал того, что действительно произошло. Ничего не сеется.
   ========================================================================== */
var LSK = 'oko-hq2';
var S = (function load(){
  var d = {v:1, tasks:[], log:[], flags:{}, integ:{}, checkedAt:0, checkNote:''};
  try{
    var raw = JSON.parse(localStorage.getItem(LSK));
    if(raw && typeof raw === 'object'){
      d.tasks = arr(raw.tasks); d.log = arr(raw.log);
      d.flags = (raw.flags && typeof raw.flags === 'object') ? raw.flags : {};
      d.integ = (raw.integ && typeof raw.integ === 'object') ? raw.integ : {};
      d.checkedAt = Number(raw.checkedAt) || 0;
      d.checkNote = String(raw.checkNote || '');
    }
  }catch(e){}
  return d;
})();
function save(){ try{ localStorage.setItem(LSK, JSON.stringify(S)); }catch(e){} }

/* Запись в ленту отчётов штаба. Пишется только по факту действия. */
function logAdd(agentId, text){
  S.log.unshift({id:uid('lg'), at:Date.now(), agent:agentId || null, text:String(text||'')});
  if(S.log.length > 200) S.log.length = 200;
  save();
}

/* --------------------------------------------------------------------------
   1b. РАЗБОР ОСТАТКОВ ДЕМО-ДАННЫХ, которые ядро успело записать в браузер.
   Модуль admin-hq в app.js однократно засеивал «доход OKO» и очередь
   рекламной модерации выдуманными записями и сохранял их в localStorage.
   Правило «ноль демо-данных» действует и для уже сохранённого — чистим один
   раз и помечаем, чтобы не трогать реальные операции, которые появятся позже.
   -------------------------------------------------------------------------- */
(function purgeSeededDemo(){
  var HS = gHQSTATE();
  if(!HS || HS.hq2Purged) return;

  /* демо-выручка (32 записи сидера admin-hq) */
  try{
    var rev = gREVENUE();
    if(HS.revSeeded && Array.isArray(rev)){
      rev.length = 0;
      localStorage.setItem('oko-revenue', JSON.stringify(rev));
    }
  }catch(e){}

  /* демо-очередь рекламной модерации */
  try{ var ad = gHQADREV(); if(Array.isArray(ad)) ad.length = 0; }catch(e){}
  try{ HS.adRev = []; }catch(e){}

  /* демо-счётчики модератора */
  try{
    var m = gHQMOD();
    if(m){ m.spam = 0; m.scam = 0; m.adult = 0; m.drugs = 0; m.checked = 0; HS.mod = m; }
  }catch(e){}

  HS.hq2Purged = 1;
  var sv = fn('hqSave'); if(sv){ try{ sv(); }catch(e){} }
})();

/* Живые таймеры старого штаба (случайный лог, случайный «онлайн»,
   «real-time метрики») больше не нужны — новый рендер их не заводит,
   но если ядро успело запустить, гасим. */
(function stopLegacyTimers(){
  ['hqStopLog','hqStopFeed','hqStopRt'].forEach(function(n){
    var f = fn(n); if(f){ try{ f(); }catch(e){} }
  });
})();

/* ==========================================================================
   2. ИНТЕГРАЦИИ: что именно нужно, чтобы агент перестал быть заготовкой
   Ключи в коде НЕ хранятся — здесь только имена переменных окружения и
   адрес, где владелец их берёт.
   ========================================================================== */
var INTEG = {
  llm:    {n:'Языковая модель',        key:'ANTHROPIC_API_KEY или GEMINI_API_KEY',
           where:'console.anthropic.com → API Keys, либо aistudio.google.com → Get API key'},
  db:     {n:'База Supabase',          key:'SUPABASE_URL + SUPABASE_ANON_KEY',
           where:'supabase.com → проект OKO → Project Settings → API'},
  bot:    {n:'Telegram-бот',           key:'TELEGRAM_BOT_TOKEN',
           where:'@BotFather → /mybots → @okoappbot → API Token'},
  flow:   {n:'Очередь задач n8n',      key:'N8N_WEBHOOK_URL',
           where:'свой n8n → нода Webhook → Production URL'},
  img:    {n:'Генерация изображений',  key:'GEMINI_API_KEY',
           where:'aistudio.google.com → Get API key'},
  media:  {n:'Рендер-ферма и S3',      key:'S3_ACCESS_KEY + S3_SECRET_KEY',
           where:'панель Timeweb → S3-хранилище → Ключи доступа'},
  social: {n:'API площадок',           key:'VK_TOKEN / TG_CHANNEL_TOKEN / YT_OAUTH',
           where:'кабинеты разработчика VK, Telegram и YouTube'},
  pay:    {n:'Платежи Lava.top',       key:'LAVA_API_KEY',
           where:'lava.top → Настройки → API'}
};

/* Подключение считается доказанным только тем, что видно из браузера.
   Всё остальное — «не подключено», потому что серверные ключи в приложение
   не приезжают и врать про них нельзя. */
function integOn(k){
  if(S.integ && S.integ[k] === true) return true;      /* подтверждено проверкой сервера */
  if(k === 'bot'){
    try{
      var tg = window.Telegram && window.Telegram.WebApp;
      return !!(tg && tg.initData && String(tg.initData).length > 0);
    }catch(e){ return false; }
  }
  if(k === 'db') return !!gSB();
  return false;
}
function integLabel(k){ return (INTEG[k] && INTEG[k].n) || k; }

/* Проверка подключений через backend. Настоящий запрос: что ответил сервер,
   то и показываем — включая ошибку. Ничего не додумываем. */
function checkIntegrations(){
  var box = document.getElementById('h2CheckOut');
  if(box) box.innerHTML = '<span class="h2-muted">Проверяю ' + esc(location.origin || 'сервер') + '…</span>';

  var url = 'api.php?action=integrations&t=' + Date.now();
  var done = false;
  var timer = setTimeout(function(){
    if(done) return; done = true;
    finish(false, 'сервер не ответил за 8 секунд');
  }, 8000);

  function finish(ok, note, data){
    if(!ok){
      S.integ = {};
    } else if(data && typeof data === 'object'){
      var map = {};
      Object.keys(INTEG).forEach(function(k){ if(data[k] === true) map[k] = true; });
      S.integ = map;
    }
    S.checkedAt = Date.now();
    S.checkNote = note;
    save();
    logAdd(null, 'Проверка подключений: ' + note);
    render();
  }

  try{
    fetch(url, {method:'GET', cache:'no-store'}).then(function(r){
      return r.text().then(function(t){ return {status:r.status, ok:r.ok, text:t}; });
    }).then(function(res){
      if(done) return; done = true; clearTimeout(timer);
      if(!res.ok){ finish(false, 'бэкенд ответил ' + res.status + ' — эндпоинт integrations ещё не поднят'); return; }
      var data = null;
      try{ data = JSON.parse(res.text); }catch(e){}
      if(!data || typeof data !== 'object'){ finish(false, 'ответ сервера не разобран как JSON'); return; }
      var on = Object.keys(INTEG).filter(function(k){ return data[k] === true; });
      finish(true, on.length ? ('подключено: ' + on.map(integLabel).join(', ')) : 'сервер ответил, подключений нет');
    }).catch(function(e){
      if(done) return; done = true; clearTimeout(timer);
      finish(false, 'запрос не прошёл (' + String(e && e.message || e).slice(0, 80) + ')');
    });
  }catch(e){
    if(!done){ done = true; clearTimeout(timer); finish(false, 'запрос не удалось отправить'); }
  }
}

/* ==========================================================================
   3. ОТДЕЛЫ И ИИ-ШТАТ OKO
   Роли настоящие — это состав, который запускается вместе с приложением
   (раздел 6 мастер-документа). Задачи, проценты и метрики не выдумываются.
   ========================================================================== */
var ROOMS = [
  {id:'ops', n:'Управление', ic:'crown', c:'#9AFF00',
   d:'Общая картина: деньги, люди, риски. Отсюда раздаются задачи остальным отделам и собирается утренний отчёт владельцу.'},
  {id:'sales', n:'Продажи и удержание', ic:'briefcase', c:'#4aa0ff',
   d:'Онбординг новых, подбор тарифа под нишу, сопровождение платных и работа на возврат ушедших.'},
  {id:'content', n:'Контент-конвейер', ic:'rocket', c:'#facc15',
   d:'Сценарий, рендер, субтитры, обложка, расписание. Здесь работают завод роликов, монтажёр, дизайнер и копирайтер.'},
  {id:'research', n:'Аналитика', ic:'chart', c:'#22d3ee',
   d:'Метрики площадок, разбор конкурентов и правка контент-плана по тому, что реально залетело.'},
  {id:'comms', n:'Поддержка и связь', ic:'chat', c:'#34d399',
   d:'Ответы строго из базы знаний, эскалация живому человеку, автоответы в каналах, разбор комментариев.'},
  {id:'legal', n:'Юридический', ic:'file', c:'#d4af37',
   d:'Оферта, договоры, персональные данные, проверка реквизитов и платёжных условий.'},
  {id:'finance', n:'Финансы', ic:'money', c:'#ff7a3c',
   d:'Учёт доходов и расходов, резерв под налог, сверка эквайринга и выплат партнёрам.'},
  {id:'security', n:'Безопасность', ic:'shield', c:'#a855f7',
   d:'Аптайм, антифрод, автоблок скам-реквизитов, защита аккаунтов от угона.'}
];
function room(id){ for(var i=0;i<ROOMS.length;i++) if(ROOMS[i].id === id) return ROOMS[i]; return null; }

var AGENTS = [
  {id:'ceo', role:'Гендиректор', room:'ops', c:'#9AFF00', ic:'crown',
   about:'Держит общую картину бизнеса и раздаёт работу остальным. Ничего не делает руками — сводит данные и назначает ответственных.',
   can:['Сводка за сутки: выручка, регистрации, отказы, зависшие платежи',
        'Разбор проблемных диалогов и эскалаций поддержки',
        'Постановка задач другим агентам и контроль сроков'],
   gives:'Утренний отчёт в личный чат владельца и список задач на день с ответственными.',
   needs:['llm','db','flow']},

  {id:'assist', role:'Ассистент', room:'ops', c:'#8892a0', ic:'bolt',
   about:'Приёмная штаба. Понимает команды человеческим языком и превращает их в задачи конкретным агентам.',
   can:['Приём задач голосом и текстом из командного чата',
        'Разбор входящих документов и сканов в текст',
        'Напоминания по срокам и повторяющимся делам'],
   gives:'Задача, оформленная и отданная нужному агенту, плюс подтверждение в чат.',
   needs:['llm','flow']},

  {id:'sales', role:'Продажник', room:'sales', c:'#4aa0ff', ic:'briefcase',
   about:'Первый контакт с новым человеком: разбирается в нише, показывает подходящие кейсы и подбирает тариф.',
   can:['Квалификация входящего: ниша, бюджет, задача',
        'Подбор тарифа и расчёт под запрос',
        'Эскалация владельцу всего, что касается скидок и обещаний'],
   gives:'Карточка лида с нишей, задачей и рекомендованным тарифом.',
   needs:['llm','db','bot']},

  {id:'manager', role:'Менеджер', room:'sales', c:'#22d3ee', ic:'users',
   about:'Ведёт тех, кто уже заплатил: следит, чтобы человек дошёл до результата, а не отвалился на второй неделе.',
   can:['Напоминания по шагам плана клиента',
        'Отслеживание застрявших: кто перестал заходить',
        'Сбор обратной связи и передача её в контент и продукт'],
   gives:'Список клиентов в зоне риска с причиной и предложением действия.',
   needs:['llm','db','bot']},

  {id:'factory', role:'Контент-завод', room:'content', c:'#facc15', ic:'rocket',
   about:'Конвейер роликов под ключ: от сценария до публикации по расписанию. Главный «рабочий» штаба.',
   can:['Сценарий ролика под нишу и площадку',
        'Сборка ролика: стоки, озвучка, караоке-субтитры, музыка',
        'Постановка в очередь автопостинга по расписанию'],
   gives:'Готовый вертикальный ролик 1080×1920 в очереди публикации с обложкой и описанием.',
   needs:['llm','media','social']},

  {id:'editor', role:'Монтажёр', room:'content', c:'#a855f7', ic:'clips',
   about:'Докручивает ключевые ролики руками там, где конвейера мало: ритм, цвет, звук, акценты.',
   can:['Пересборка ролика под другой ритм и хронометраж',
        'Цветокоррекция и чистка звука',
        'Синхронизация субтитров с речью'],
   gives:'Финальный экспорт ролика и файл субтитров.',
   needs:['media']},

  {id:'designer', role:'Дизайнер', room:'content', c:'#ff7a3c', ic:'photo',
   about:'Оформление в фирменном стиле: обложки, баннеры, карточки. Работает от бренд-книги OKO, а не «на вкус».',
   can:['Обложки уроков и роликов',
        'Баннеры тарифов и промо',
        'Карточки товаров и услуг для Биржи'],
   gives:'Набор изображений в нужных размерах, готовых к публикации.',
   needs:['img','media']},

  {id:'copy', role:'Копирайтер', room:'content', c:'#ff6bad', ic:'edit',
   about:'Тексты, которые дочитывают: хуки, заголовки, описания, прогревы под конкретную нишу.',
   can:['Хуки и первые три секунды ролика',
        'Заголовки и описания под площадку',
        'Прогревы и офферы под нишу клиента'],
   gives:'Несколько вариантов текста на выбор с пометкой, чем они отличаются.',
   needs:['llm']},

  {id:'analyst', role:'Аналитик', room:'research', c:'#7dd3fc', ic:'chart',
   about:'Смотрит на цифры площадок и говорит, что повторить, а что выбросить. Без него конвейер работает вслепую.',
   can:['Съём метрик по API площадок',
        'Разбор конкурентов и форматов, которые залетели',
        'Правка контент-плана по фактическим просмотрам'],
   gives:'Отчёт «что сработало / что нет» и обновлённый план на неделю.',
   needs:['social','db','llm']},

  {id:'support', role:'Поддержка', room:'comms', c:'#34d399', ic:'chat',
   about:'Отвечает людям круглосуточно строго из базы знаний. Деньги, возвраты и обещания — сразу живому человеку.',
   can:['Ответы по продукту из базы знаний',
        'Эскалация в @okohelp всего, что про деньги и обещания',
        'Фиксация повторяющихся вопросов для правки продукта'],
   gives:'Закрытый диалог либо эскалация с полным контекстом переписки.',
   needs:['llm','db','bot']},

  {id:'legal', role:'Юрист', room:'legal', c:'#d4af37', ic:'file',
   about:'Проверяет тексты и условия до того, как они уйдут людям. Работает по 152-ФЗ и 161-ФЗ.',
   can:['Проверка оферты и договоров',
        'Контроль персональных данных в формах и диалогах',
        'Проверка платёжных реквизитов и условий возврата'],
   gives:'Заключение «чисто / правки» с конкретным списком того, что менять.',
   needs:['llm','pay']}
];

function agent(id){ for(var i=0;i<AGENTS.length;i++) if(AGENTS[i].id === id) return AGENTS[i]; return null; }
function agentRole(id){ var a = agent(id); return a ? a.role : 'Штаб OKO'; }
function agentColor(id){ var a = agent(id); return a ? a.c : 'var(--accent)'; }

/* Чего агенту не хватает прямо сейчас. */
function agentMissing(a){
  return arr(a.needs).filter(function(k){ return !integOn(k); });
}
/* Задачи агента в очереди. */
function agentTasks(id, status){
  return S.tasks.filter(function(t){
    return t.agent === id && (status ? t.status === status : true);
  });
}
/* Состояние: «нужен ключ» / «работает» / «простаивает». */
function agentState(a){
  if(agentMissing(a).length) return 'need';
  return agentTasks(a.id, 'queued').length ? 'work' : 'idle';
}
var ST_LABEL = {need:'нужен ключ', work:'работает', idle:'простаивает'};

/* ==========================================================================
   4. СТИЛИ (один <style>, префикс h2-, обе темы через переменные ядра)
   ========================================================================== */
(function injectCss(){
  if(document.getElementById('oko-hq2-css')) return;
  var css = [
/* ---- общий подвид под шапкой (агент / отдел) ---- */
'#h2View{position:fixed;inset:0;z-index:78;background:var(--bg);display:flex;flex-direction:column;',
'  transform:translateX(100%);transition:transform .28s cubic-bezier(.3,1,.4,1);',
'  max-width:1280px;margin:0 auto;padding-top:var(--oko-safe-top);padding-bottom:var(--oko-safe-bottom);box-sizing:border-box}',
'#h2View.open{transform:none}',
'@media(prefers-reduced-motion:reduce){#h2View{transition:none}}',
'#h2View .sv-head{padding-top:10px}',
'#h2View .sv-body{max-width:1040px;width:100%;margin-inline:auto}',

/* ---- модалка подтверждения (над админкой и подвидом) ---- */
'.h2-modal{position:fixed;inset:0;z-index:210;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:22px}',
'.h2-modal-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:22px 20px;max-width:400px;width:100%;box-shadow:0 18px 60px rgba(0,0,0,.5)}',
'.h2-modal-card h3{font-size:22px;margin-bottom:8px}',
'.h2-modal-card p{color:var(--dim);font-size:13.5px;line-height:1.55;margin-bottom:16px;overflow-wrap:break-word}',
'.h2-modal-acts{display:flex;flex-direction:column;gap:9px}',
/* попапы ядра, вызванные из админки, должны быть НАД ней (у неё z-index 75) */
'#adminView.open ~ #okoPopup{z-index:212}',

/* ---- общий текстовый контракт: перенос только по словам ---- */
'#h2View, #admBody{overflow-wrap:break-word;word-break:normal;-webkit-hyphens:none;hyphens:none}',
'#h2View .h2-wrap, #admBody .h2-wrap{white-space:normal}',

/* ---- карточки ---- */
'.h2-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px;margin-bottom:10px}',
'.h2-h{font-size:12px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.05em;margin:18px 2px 9px;overflow-wrap:break-word}',
'.h2-muted{color:var(--dim);font-size:12.5px;line-height:1.55;overflow-wrap:break-word}',
'.h2-p{font-size:13.5px;line-height:1.6;color:var(--text);overflow-wrap:break-word}',

/* ---- шапка штаба ---- */
'.h2-hero{display:flex;gap:13px;align-items:flex-start;background:linear-gradient(135deg,var(--lime-dim),transparent 70%),var(--surface);',
'  border:1px solid var(--border);border-radius:var(--r-lg);padding:15px;margin-bottom:12px}',
'.h2-hero-ic{width:44px;height:44px;flex:0 0 auto;border-radius:13px;background:var(--lime-dim);color:var(--accent);display:flex;align-items:center;justify-content:center}',
'.h2-hero-ic svg.i{width:24px;height:24px}',
'.h2-hero-b{min-width:0;flex:1}',
'.h2-hero-b h3{font-size:20px;line-height:1.1;margin-bottom:5px;overflow-wrap:break-word}',
'.h2-hero-b p{font-size:12.5px;color:var(--dim);line-height:1.5;overflow-wrap:break-word}',

/* ---- полоса состояния подключений ---- */
'.h2-integ{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
'.h2-ipill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:4px 9px;border-radius:99px;',
'  border:1px solid var(--border);background:var(--raised);color:var(--dim);max-width:100%;overflow-wrap:break-word}',
'.h2-ipill.on{background:var(--lime-dim);border-color:rgba(154,255,0,.35);color:var(--accent)}',
'.h2-ipill svg.i{width:12px;height:12px;flex:0 0 auto}',

/* ---- сетка отделов ---- */
'.h2-rooms{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
'@media(min-width:700px){.h2-rooms{grid-template-columns:repeat(3,minmax(0,1fr))}}',
'@media(min-width:1100px){.h2-rooms{grid-template-columns:repeat(4,minmax(0,1fr))}}',
'.h2-room{display:flex;flex-direction:column;gap:6px;text-align:left;background:var(--surface);border:1px solid var(--border);',
'  border-radius:var(--r-md);padding:12px;min-width:0;transition:border-color .18s,transform .12s}',
'.h2-room:active{transform:scale(.985)}',
'.h2-room:hover{border-color:rgba(154,255,0,.35)}',
'.h2-room-ic{width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center}',
'.h2-room-ic svg.i{width:18px;height:18px}',
'.h2-room b{font-size:13px;font-weight:700;line-height:1.25;overflow-wrap:break-word}',
'.h2-room small{font-size:11px;color:var(--dim);line-height:1.4;overflow-wrap:break-word}',

/* ---- сетка агентов ---- */
'.h2-agents{display:grid;grid-template-columns:repeat(1,minmax(0,1fr));gap:9px}',
'@media(min-width:560px){.h2-agents{grid-template-columns:repeat(2,minmax(0,1fr))}}',
'@media(min-width:1100px){.h2-agents{grid-template-columns:repeat(3,minmax(0,1fr))}}',
'.h2-ag{display:flex;flex-direction:column;gap:8px;text-align:left;background:var(--surface);border:1px solid var(--border);',
'  border-radius:var(--r-md);padding:13px;min-width:0;transition:border-color .18s,transform .12s}',
'.h2-ag:active{transform:scale(.99)}',
'.h2-ag:hover{border-color:rgba(154,255,0,.35)}',
'.h2-ag-top{display:flex;align-items:center;gap:10px;min-width:0}',
'.h2-ava{width:36px;height:36px;flex:0 0 auto;border-radius:11px;display:flex;align-items:center;justify-content:center}',
'.h2-ava svg.i{width:19px;height:19px}',
'.h2-ag-n{min-width:0;flex:1}',
'.h2-ag-n b{display:block;font-size:14px;font-weight:700;line-height:1.2;overflow-wrap:break-word}',
'.h2-ag-n small{display:block;font-size:11px;color:var(--dim);margin-top:2px;overflow-wrap:break-word}',
'.h2-ag-ab{font-size:12px;line-height:1.5;color:var(--dim);overflow-wrap:break-word}',
'.h2-ag-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',

/* ---- бейдж состояния ---- */
'.h2-st{display:inline-flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;letter-spacing:.03em;text-transform:uppercase;',
'  padding:4px 9px;border-radius:99px;border:1px solid transparent;max-width:100%;overflow-wrap:break-word}',
'.h2-st i{width:7px;height:7px;border-radius:50%;flex:0 0 auto;background:currentColor}',
'.h2-st.need{background:rgba(255,180,0,.14);color:#c98a00;border-color:rgba(255,180,0,.3)}',
':root:not([data-theme="light"]) .h2-st.need{color:#ffb400}',
'.h2-st.work{background:var(--lime-dim);color:var(--accent);border-color:rgba(154,255,0,.35)}',
'.h2-st.idle{background:var(--raised);color:var(--dim);border-color:var(--border)}',
'.h2-count{font-size:11px;color:var(--dim);font-weight:600}',

/* ---- список «что умеет» / «что нужно» ---- */
'.h2-list{list-style:none;display:flex;flex-direction:column;gap:7px;margin:0;padding:0}',
'.h2-list li{display:flex;gap:9px;font-size:13px;line-height:1.5;overflow-wrap:break-word}',
'.h2-list li > svg.i{width:15px;height:15px;flex:0 0 auto;margin-top:2px;color:var(--accent)}',
'.h2-need{display:flex;gap:10px;background:var(--raised);border:1px solid var(--border);border-radius:12px;padding:11px;margin-bottom:8px}',
'.h2-need.ok{border-color:rgba(154,255,0,.3);background:var(--lime-dim)}',
'.h2-need-ic{width:28px;height:28px;flex:0 0 auto;border-radius:9px;background:var(--surface);display:flex;align-items:center;justify-content:center;color:var(--dim)}',
'.h2-need.ok .h2-need-ic{color:var(--accent)}',
'.h2-need-ic svg.i{width:15px;height:15px}',
'.h2-need-b{min-width:0;flex:1}',
'.h2-need-b b{display:block;font-size:13px;line-height:1.3;overflow-wrap:break-word}',
'.h2-need-b code{display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;background:var(--surface);',
'  border:1px solid var(--border);border-radius:6px;padding:1px 6px;margin-top:4px;max-width:100%;overflow-wrap:anywhere}',
'.h2-need-b small{display:block;font-size:11.5px;color:var(--dim);margin-top:4px;line-height:1.45;overflow-wrap:break-word}',

/* ---- форма задачи ---- */
'.h2-form{display:flex;flex-direction:column;gap:9px}',
'.h2-form label{font-size:11.5px;font-weight:700;color:var(--dim);text-transform:uppercase;letter-spacing:.04em}',
'.h2-form input,.h2-form textarea{width:100%;background:var(--raised);border:1px solid var(--border);border-radius:11px;',
'  padding:11px 12px;color:var(--text);font-family:var(--font-body);font-size:14px;outline:none;resize:vertical}',
'.h2-form input:focus,.h2-form textarea:focus{border-color:rgba(154,255,0,.5)}',
'.h2-form textarea{min-height:84px}',
'.h2-note{display:flex;gap:9px;background:var(--raised);border:1px solid var(--border);border-left:3px solid var(--accent);',
'  border-radius:10px;padding:11px;font-size:12.5px;line-height:1.55;color:var(--dim);overflow-wrap:break-word}',
'.h2-note svg.i{width:15px;height:15px;flex:0 0 auto;margin-top:2px;color:var(--accent)}',
'.h2-note b{color:var(--text)}',

/* ---- кнопки ---- */
'.h2-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
'.h2-btn{font-size:12.5px;font-weight:700;padding:9px 14px;border-radius:10px;border:1px solid var(--border);',
'  background:var(--raised);color:var(--text);min-height:38px;display:inline-flex;align-items:center;gap:7px;max-width:100%}',
'.h2-btn svg.i{width:15px;height:15px;flex:0 0 auto}',
'.h2-btn.pri{background:var(--lime);color:#0a0a0a;border-color:var(--lime)}',
'.h2-btn.dng{color:var(--danger);border-color:rgba(255,77,77,.35)}',
'.h2-btn:disabled{opacity:.5}',

/* ---- задачи ---- */
'.h2-task{display:flex;gap:10px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:11px;margin-bottom:8px}',
'.h2-task.done{opacity:.68}',
'.h2-task-ic{width:30px;height:30px;flex:0 0 auto;border-radius:9px;background:var(--raised);display:flex;align-items:center;justify-content:center;color:var(--dim)}',
'.h2-task-ic svg.i{width:15px;height:15px}',
'.h2-task-b{min-width:0;flex:1}',
'.h2-task-b b{display:block;font-size:13.5px;line-height:1.35;overflow-wrap:break-word}',
'.h2-task-b p{font-size:12.5px;color:var(--dim);line-height:1.5;margin-top:3px;overflow-wrap:break-word}',
'.h2-task-b small{display:block;font-size:11px;color:var(--dim);margin-top:5px;overflow-wrap:break-word}',

/* ---- лента отчётов ---- */
'.h2-log{display:flex;flex-direction:column;gap:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden}',
'.h2-ll{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid var(--border);font-size:12.5px;line-height:1.5}',
'.h2-ll:last-child{border-bottom:none}',
'.h2-lt{color:var(--dim);font-size:11px;flex:0 0 auto;padding-top:1px;font-variant-numeric:tabular-nums}',
'.h2-lb{min-width:0;flex:1;overflow-wrap:break-word}',
'.h2-lb b{font-weight:700}',

/* ---- пустое состояние ---- */
'.h2-empty{text-align:center;padding:26px 18px;background:var(--surface);border:1px dashed var(--border);border-radius:var(--r-md)}',
'.h2-empty-ic{width:46px;height:46px;margin:0 auto 10px;border-radius:50%;background:var(--raised);color:var(--dim);display:flex;align-items:center;justify-content:center}',
'.h2-empty-ic svg.i{width:22px;height:22px}',
'.h2-empty p{font-size:14px;font-weight:700;margin-bottom:5px;overflow-wrap:break-word}',
'.h2-empty span{display:block;font-size:12.5px;color:var(--dim);line-height:1.55;overflow-wrap:break-word}',

/* ---- KPI-плитки ---- */
'.h2-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
'@media(min-width:700px){.h2-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}',
'@media(min-width:1100px){.h2-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}',
'.h2-kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:12px 13px;min-width:0}',
'.h2-kpi b{display:block;font-family:var(--font-display);font-size:27px;line-height:1.05;color:var(--accent);letter-spacing:.02em;overflow-wrap:break-word}',
'.h2-kpi small{display:block;font-size:11px;color:var(--dim);margin-top:4px;line-height:1.4;overflow-wrap:break-word}',
'.h2-kpi.q b{color:var(--dim)}',

/* ---- строки таблиц админки ---- */
'.h2-row{display:flex;align-items:center;gap:11px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:11px 12px;margin-bottom:8px;min-width:0}',
'.h2-row-ic{width:34px;height:34px;flex:0 0 auto;border-radius:10px;background:var(--raised);color:var(--accent);display:flex;align-items:center;justify-content:center}',
'.h2-row-ic svg.i{width:17px;height:17px}',
'.h2-row-b{min-width:0;flex:1}',
'.h2-row-b b{display:block;font-size:13.5px;font-weight:700;line-height:1.3;overflow-wrap:break-word}',
'.h2-row-b small{display:block;font-size:11.5px;color:var(--dim);margin-top:2px;line-height:1.45;overflow-wrap:break-word}',
'.h2-row-v{flex:0 0 auto;font-size:13px;font-weight:700;color:var(--accent);text-align:right;max-width:45%;overflow-wrap:break-word}',
'.h2-row-v.q{color:var(--dim)}',

/* ---- флаги ---- */
'.h2-flag{display:flex;align-items:flex-start;gap:12px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px}',
'.h2-flag-b{min-width:0;flex:1}',
'.h2-flag-b b{display:block;font-size:13.5px;line-height:1.3;overflow-wrap:break-word}',
'.h2-flag-b small{display:block;font-size:11.5px;color:var(--dim);margin-top:3px;line-height:1.5;overflow-wrap:break-word}',
'.h2-sw{flex:0 0 auto;width:44px;height:26px;border-radius:99px;background:var(--raised);border:1px solid var(--border);position:relative;transition:background .2s,border-color .2s;margin-top:2px}',
'.h2-sw i{position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:var(--dim);transition:transform .2s,background .2s}',
'.h2-sw.on{background:var(--lime-dim);border-color:rgba(154,255,0,.45)}',
'.h2-sw.on i{transform:translateX(18px);background:var(--lime)}',

/* ---- 3D-портал ---- */
'.h2-portal{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:linear-gradient(120deg,var(--lime-dim),transparent 65%),var(--surface);',
'  border:1px solid var(--border);border-radius:var(--r-md);padding:13px;margin-bottom:10px;min-width:0}',
'.h2-portal:hover{border-color:rgba(154,255,0,.4)}',
'.h2-portal-b{min-width:0;flex:1}',
'.h2-portal-b b{display:block;font-size:14px;line-height:1.25;overflow-wrap:break-word}',
'.h2-portal-b small{display:block;font-size:11.5px;color:var(--dim);margin-top:3px;line-height:1.45;overflow-wrap:break-word}',
'.h2-portal > svg.i{width:18px;height:18px;flex:0 0 auto;color:var(--dim)}',

/* ---- вкладки админки: не режем подписи ---- */
'#admTabs .adm-tab{white-space:nowrap}',
''].join('\n');

  var st = document.createElement('style');
  st.id = 'oko-hq2-css';
  st.textContent = css;
  document.head.appendChild(st);
})();

/* ==========================================================================
   5. МОДАЛКА ПОДТВЕРЖДЕНИЯ (своя — над админкой и подвидом)
   Закрывается кнопкой, тапом вне и Escape. Выход есть всегда.
   ========================================================================== */
var modalEl = null;
function modalClose(){
  if(!modalEl) return;
  modalEl.remove(); modalEl = null;
  document.removeEventListener('keydown', modalKey, true);
}
function modalKey(e){ if(e.key === 'Escape'){ e.stopPropagation(); modalClose(); } }
function modalConfirm(o){
  modalClose();
  var el = document.createElement('div');
  el.className = 'h2-modal';
  el.innerHTML = '<div class="h2-modal-card" role="dialog" aria-modal="true">' +
    '<h3>' + esc(o.title || '') + '</h3>' +
    '<p>' + esc(o.text || '') + '</p>' +
    '<div class="h2-modal-acts">' +
      '<button class="h2-btn ' + (o.danger ? 'dng' : 'pri') + '" data-h2act="modal-ok">' + esc(o.ok || 'Продолжить') + '</button>' +
      '<button class="h2-btn" data-h2act="modal-cancel">' + esc(o.cancel || 'Отмена') + '</button>' +
    '</div></div>';
  el.addEventListener('click', function(e){ if(e.target === el) modalClose(); });
  document.body.appendChild(el);
  modalEl = el;
  modalEl.__ok = o.onOk || null;
  document.addEventListener('keydown', modalKey, true);
  var b = el.querySelector('[data-h2act="modal-ok"]'); if(b) b.focus();
}

/* ==========================================================================
   6. ПОДВИД: карточка агента и карточка отдела
   Полноэкранный слой с той же шапкой и той же кнопкой «назад», что и везде.
   Зарегистрирован в navstack — Escape, системная «назад» и Telegram BackButton
   закрывают его штатно.
   ========================================================================== */
var view = null;              /* {kind:'agent'|'room', id} */
function viewEl(){
  var el = document.getElementById('h2View');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'h2View';
  el.innerHTML =
    '<div class="sv-head">' +
      '<button class="ep-cancel" data-h2act="view-close" aria-label="Назад"><svg class="i"><use href="#i-back"/></svg></button>' +
      '<b id="h2Title">Штаб OKO</b>' +
      '<span style="width:38px;flex:0 0 auto"></span>' +
    '</div>' +
    '<div class="sv-body" id="h2Body"></div>';
  document.body.appendChild(el);

  /* Регистрация в общем стеке навигации — тем же способом, что и остальные
     fullscreen-вьюхи ядра: наблюдатель за классом .open. Через наблюдатель,
     а не прямым nvPush, специально: иначе подвид попадает в стек РАНЬШЕ
     админки (её наблюдатель срабатывает микрозадачей позже), и системная
     «назад» закрывала бы админку из-под открытого подвида. */
  try{
    new MutationObserver(syncNv).observe(el, {attributes:true, attributeFilter:['class']});
  }catch(e){}
  return el;
}
function syncNv(){
  var el = document.getElementById('h2View');
  var open = !!(el && el.classList.contains('open'));
  var push = fn('nvPush'), pop = fn('nvPop'), find = fn('nvFind');
  if(open){
    if(push && (!find || !find('view:h2'))){ try{ push('view:h2', viewClose); }catch(e){} }
  } else if(pop){
    try{ pop('view:h2'); }catch(e){}   /* записи нет — тихий no-op */
  }
}
/* Страховка от «зависшего» перехода. На перегруженном телефоне (и в свёрнутой
   вкладке) браузер иногда не доводит transform до конца, и панель остаётся
   висеть за краем экрана — человек видит пустоту вместо экрана. Через 420 мс
   (переход длится 280 мс) снимаем анимацию на один кадр: элемент мгновенно
   встаёт в своё конечное положение, каким бы оно ни было. */
function settleSoon(){
  setTimeout(function(){
    var el = document.getElementById('h2View');
    if(!el) return;
    var tr = '';
    try{ tr = getComputedStyle(el).transform; }catch(e){ return; }
    var atRest = (!tr || tr === 'none' || tr === 'matrix(1, 0, 0, 1, 0, 0)');
    var wantOpen = el.classList.contains('open');
    if(wantOpen === atRest) return;          /* уже там, где должен быть */
    el.style.transition = 'none';
    void el.offsetWidth;                     /* принудительный пересчёт стиля */
    el.style.transition = '';
  }, 420);
}
function viewOpen(kind, id){
  view = {kind:kind, id:id};
  var el = viewEl();
  viewRender();
  el.classList.add('open');
  settleSoon();
}
function viewClose(){
  var el = document.getElementById('h2View');
  if(el){ el.classList.remove('open'); settleSoon(); }
  view = null;
  /* админка под подвидом могла измениться (новая задача) — обновляем */
  if(admOpen()) render();
}
function viewRender(){
  if(!view) return;
  var t = document.getElementById('h2Title'), b = document.getElementById('h2Body');
  if(!t || !b) return;
  if(view.kind === 'agent'){
    var a = agent(view.id);
    if(!a){ viewClose(); return; }
    t.textContent = 'Агент · ' + a.role;
    b.innerHTML = agentPage(a);
  } else {
    var r = room(view.id);
    if(!r){ viewClose(); return; }
    t.textContent = 'Отдел · ' + r.n;
    b.innerHTML = roomPage(r);
  }
  b.scrollTop = 0;
}

/* ---- страница агента ---- */
function agentPage(a){
  var miss = agentMissing(a);
  var st = agentState(a);
  var r = room(a.room);
  var queued = agentTasks(a.id, 'queued');
  var done = agentTasks(a.id, 'done');

  var needRows = arr(a.needs).map(function(k){
    var it = INTEG[k] || {n:k, key:'—', where:'—'};
    var on = integOn(k);
    return '<div class="h2-need' + (on ? ' ok' : '') + '">' +
      '<span class="h2-need-ic">' + ic(on ? 'check2' : 'lock') + '</span>' +
      '<span class="h2-need-b"><b>' + esc(it.n) + (on ? ' — подключено' : ' — не подключено') + '</b>' +
        '<code class="oko-breakable">' + esc(it.key) + '</code>' +
        '<small>Где взять: ' + esc(it.where) + '</small></span>' +
    '</div>';
  }).join('');

  var canRows = arr(a.can).map(function(c){
    return '<li>' + ic('check2') + '<span>' + esc(c) + '</span></li>';
  }).join('');

  var taskRows = queued.length
    ? queued.map(taskRow).join('')
    : emptyBlock('target', 'Задач в очереди нет', 'Поставь задачу ниже — она сохранится в очереди штаба и будет ждать запуска агента.');

  var doneRows = done.length
    ? '<div class="h2-h">Закрытые задачи · ' + done.length + '</div>' + done.slice(0, 12).map(taskRow).join('')
    : '';

  /* Честное объяснение, что произойдёт по кнопке. Никаких «Отправлено». */
  var whatHappens = miss.length
    ? '<b>Что произойдёт.</b> Задача сохранится в очереди штаба на этом устройстве и попадёт в ленту отчётов. ' +
      'Агент её не возьмёт, пока не подключено: ' + esc(miss.map(integLabel).join(', ')) + '. ' +
      'Ключи ставятся на сервере — в приложение они не передаются.'
    : '<b>Что произойдёт.</b> Задача сохранится в очереди штаба и попадёт в ленту отчётов. ' +
      'Отправка в исполнение включится вместе с очередью задач n8n.';

  return '' +
    '<div class="h2-hero">' +
      '<span class="h2-hero-ic" style="color:' + a.c + ';background:' + a.c + '1e">' + ic(a.ic) + '</span>' +
      '<span class="h2-hero-b"><h3>' + esc(a.role) + '</h3>' +
        '<p>' + esc(r ? r.n : 'Штаб OKO') + '</p></span>' +
    '</div>' +
    '<div class="h2-btns" style="margin-top:0">' +
      '<span class="h2-st ' + st + '"><i></i>' + esc(ST_LABEL[st]) + '</span>' +
      '<span class="h2-count">в очереди: ' + queued.length + ' · закрыто: ' + done.length + '</span>' +
    '</div>' +

    '<div class="h2-h">Кто это</div>' +
    '<div class="h2-card"><p class="h2-p">' + esc(a.about) + '</p></div>' +

    '<div class="h2-h">Что умеет</div>' +
    '<div class="h2-card"><ul class="h2-list">' + canRows + '</ul></div>' +

    '<div class="h2-h">Что вернёт</div>' +
    '<div class="h2-card"><p class="h2-p">' + esc(a.gives) + '</p></div>' +

    '<div class="h2-h">Что нужно, чтобы запустить</div>' +
    needRows +
    (miss.length
      ? '<div class="h2-note">' + ic('warning') + '<span>Не хватает: <b>' + esc(miss.map(integLabel).join(', ')) +
        '</b>. Пока этого нет, агент честно стоит и работу не изображает.</span></div>'
      : '<div class="h2-note">' + ic('check2') + '<span>Все нужные подключения на месте. Осталась очередь исполнения — n8n.</span></div>') +

    '<div class="h2-h">Поставить задачу</div>' +
    '<div class="h2-card"><div class="h2-form">' +
      '<label for="h2TaskT">Что сделать</label>' +
      '<input id="h2TaskT" type="text" maxlength="120" placeholder="Например: сводка по выручке за неделю" autocomplete="off">' +
      '<label for="h2TaskB">Детали и ограничения</label>' +
      '<textarea id="h2TaskB" maxlength="1000" placeholder="Ниша, срок, формат результата, чего делать нельзя"></textarea>' +
      '<div class="h2-note">' + ic('info') + '<span>' + whatHappens + '</span></div>' +
      '<div class="h2-btns">' +
        '<button class="h2-btn pri" data-h2act="task-add" data-id="' + esc(a.id) + '">' + ic('plus') + 'Сохранить в очередь</button>' +
      '</div>' +
    '</div></div>' +

    '<div class="h2-h">Очередь агента · ' + queued.length + '</div>' +
    taskRows +
    doneRows;
}

function taskRow(t){
  var isDone = t.status === 'done';
  return '<div class="h2-task' + (isDone ? ' done' : '') + '">' +
    '<span class="h2-task-ic">' + ic(isDone ? 'check2' : 'clock') + '</span>' +
    '<span class="h2-task-b">' +
      '<b>' + esc(t.title) + '</b>' +
      (t.brief ? '<p>' + esc(t.brief) + '</p>' : '') +
      '<small>' + esc(agentRole(t.agent)) + ' · поставлена ' + esc(when(t.at)) +
        (isDone && t.doneAt ? ' · закрыта ' + esc(when(t.doneAt)) : '') + '</small>' +
      (isDone ? '' :
        '<span class="h2-btns">' +
          '<button class="h2-btn" data-h2act="task-done" data-id="' + esc(t.id) + '">' + ic('check2') + 'Закрыть вручную</button>' +
          '<button class="h2-btn dng" data-h2act="task-drop" data-id="' + esc(t.id) + '">' + ic('trash') + 'Снять</button>' +
        '</span>') +
    '</span>' +
  '</div>';
}

/* ---- страница отдела ---- */
function roomPage(r){
  var list = AGENTS.filter(function(a){ return a.room === r.id; });
  var ready = list.filter(function(a){ return !agentMissing(a).length; }).length;
  var ids = list.map(function(a){ return a.id; });
  var queued = S.tasks.filter(function(t){ return t.status === 'queued' && ids.indexOf(t.agent) >= 0; }).length;
  var closed = S.tasks.filter(function(t){ return t.status === 'done' && ids.indexOf(t.agent) >= 0; }).length;
  var reports = S.log.filter(function(l){ return ids.indexOf(l.agent) >= 0; }).length;

  var kpis =
    kpi(String(list.length), 'агентов в отделе') +
    kpi(list.length ? (ready + ' из ' + list.length) : '—', 'готовы к работе') +
    kpi(String(queued), 'задач в очереди') +
    kpi(String(closed), 'задач закрыто') +
    kpi(String(reports), 'записей в ленте');

  var agents = list.length
    ? '<div class="h2-agents">' + list.map(agentCard).join('') + '</div>'
    : emptyBlock('users', 'Агент отдела ещё не запущен',
        'В штате OKO для этого направления пока нет отдельного агента. Задачи по нему ставятся через Гендиректора.');

  return '' +
    '<div class="h2-hero">' +
      '<span class="h2-hero-ic" style="color:' + r.c + ';background:' + r.c + '1e">' + ic(r.ic) + '</span>' +
      '<span class="h2-hero-b"><h3>' + esc(r.n) + '</h3><p>' + esc(r.d) + '</p></span>' +
    '</div>' +
    '<div class="h2-h">Метрики отдела</div>' +
    '<div class="h2-kpis">' + kpis + '</div>' +
    '<div class="h2-note" style="margin-top:10px">' + ic('info') +
      '<span>Цифры считаются по локальному состоянию штаба. Показатели площадок и бэкенда появятся здесь, когда сервер начнёт их отдавать — до тех пор в отчётах прочерк, а не выдуманное число.</span></div>' +
    '<div class="h2-h">Агенты отдела</div>' + agents;
}

function kpi(v, l, quiet){
  return '<div class="h2-kpi' + (quiet ? ' q' : '') + '"><b>' + esc(v) + '</b><small>' + esc(l) + '</small></div>';
}
function emptyBlock(icon, title, text){
  return '<div class="h2-empty"><div class="h2-empty-ic">' + ic(icon) + '</div>' +
    '<p>' + esc(title) + '</p><span>' + esc(text) + '</span></div>';
}

/* ==========================================================================
   7. ЭКРАН ШТАБА (вкладка «Штаб» в админке)
   ========================================================================== */
function agentCard(a){
  var st = agentState(a);
  var q = agentTasks(a.id, 'queued').length;
  var miss = agentMissing(a);
  var sub = miss.length ? ('нужен ключ: ' + miss.map(integLabel).join(', ')) : (room(a.room) ? room(a.room).n : 'Штаб OKO');
  return '<button class="h2-ag" type="button" data-h2act="agent" data-id="' + esc(a.id) + '">' +
    '<span class="h2-ag-top">' +
      '<span class="h2-ava" style="color:' + a.c + ';background:' + a.c + '1e">' + ic(a.ic) + '</span>' +
      '<span class="h2-ag-n"><b>' + esc(a.role) + '</b><small>' + esc(sub) + '</small></span>' +
    '</span>' +
    '<span class="h2-ag-ab">' + esc(a.about) + '</span>' +
    '<span class="h2-ag-foot">' +
      '<span class="h2-st ' + st + '"><i></i>' + esc(ST_LABEL[st]) + '</span>' +
      '<span class="h2-count">задач в очереди: ' + q + '</span>' +
    '</span>' +
  '</button>';
}

function integStrip(){
  var keys = Object.keys(INTEG);
  var pills = keys.map(function(k){
    var on = integOn(k);
    return '<span class="h2-ipill' + (on ? ' on' : '') + '">' + ic(on ? 'check2' : 'lock') + esc(INTEG[k].n) + '</span>';
  }).join('');
  var onN = keys.filter(integOn).length;
  var note = S.checkedAt
    ? 'Последняя проверка: ' + when(S.checkedAt) + ' · ' + S.checkNote
    : 'Проверка бэкенда ещё не запускалась. Серверные ключи в приложение не передаются — статус подтверждается только запросом к серверу.';
  return '<div class="h2-card">' +
    '<div class="h2-row-b" style="margin-bottom:8px"><b>Подключения: ' + onN + ' из ' + keys.length + '</b>' +
      '<small id="h2CheckOut">' + esc(note) + '</small></div>' +
    '<div class="h2-integ">' + pills + '</div>' +
    '<div class="h2-btns"><button class="h2-btn" data-h2act="check">' + ic('refresh') + 'Проверить подключения</button></div>' +
  '</div>';
}

function hqView(){
  var ready = AGENTS.filter(function(a){ return !agentMissing(a).length; }).length;
  var queued = S.tasks.filter(function(t){ return t.status === 'queued'; }).length;
  var closed = S.tasks.filter(function(t){ return t.status === 'done'; }).length;

  var rooms = ROOMS.map(function(r){
    var list = AGENTS.filter(function(a){ return a.room === r.id; });
    return '<button class="h2-room" type="button" data-h2act="room" data-id="' + esc(r.id) + '">' +
      '<span class="h2-room-ic" style="color:' + r.c + ';background:' + r.c + '1e">' + ic(r.ic) + '</span>' +
      '<b>' + esc(r.n) + '</b>' +
      '<small>' + (list.length ? (list.length + ' агент' + plural(list.length, '', 'а', 'ов')) : 'агент не назначен') + '</small>' +
    '</button>';
  }).join('');

  var log = S.log.length
    ? '<div class="h2-log">' + S.log.slice(0, 40).map(logLine).join('') + '</div>'
    : emptyBlock('feed', 'Отчётов пока нет',
        'Сюда попадает то, что действительно произошло: поставленные и закрытые задачи, проверки подключений, переключение флагов. Пусто — значит штаб ещё ничего не делал.');

  return '' +
    '<div class="h2-hero">' +
      '<span class="h2-hero-ic">' + ic('eye') + '</span>' +
      '<span class="h2-hero-b"><h3>Штаб OKO</h3>' +
        '<p>' + AGENTS.length + ' ролей в ' + ROOMS.length + ' отделах. Готовы к работе: ' + ready + ' из ' + AGENTS.length +
        '. Задач в очереди: ' + queued + ', закрыто: ' + closed + '.</p></span>' +
    '</div>' +

    portalCard() +

    '<div class="h2-h">Подключения штаба</div>' +
    integStrip() +

    '<div class="h2-h">Отделы</div>' +
    '<div class="h2-rooms">' + rooms + '</div>' +

    '<div class="h2-h">Агенты · ' + AGENTS.length + '</div>' +
    '<div class="h2-agents">' + AGENTS.map(agentCard).join('') + '</div>' +

    '<div class="h2-h">Лента отчётов' + (S.log.length ? ' · ' + S.log.length : '') + '</div>' +
    log +
    (S.log.length
      ? '<div class="h2-btns"><button class="h2-btn dng" data-h2act="log-clear">' + ic('trash') + 'Очистить ленту</button></div>'
      : '');
}
function plural(n, one, few, many){
  var n10 = n % 10, n100 = n % 100;
  if(n10 === 1 && n100 !== 11) return one;
  if(n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}
function logLine(l){
  var role = l.agent ? agentRole(l.agent) : 'Штаб OKO';
  var c = l.agent ? agentColor(l.agent) : 'var(--accent)';
  return '<div class="h2-ll"><span class="h2-lt">' + esc(when(l.at)) + '</span>' +
    '<span class="h2-lb"><b style="color:' + c + '">' + esc(role) + '</b> — ' + esc(l.text) + '</span></div>';
}

/* 3D-штаб. Higgsfield-зеркало отключено навсегда — ведём на прод okoteam.top.
   Тяжёлый WebGL намеренно НЕ встраивается в мини-апп: открывается отдельной
   вкладкой, приложение при этом остаётся на месте и возврат не нужен. */
function hq3dUrl(){
  try{
    if(/okoteam\.top$/i.test(location.hostname)) return location.origin + '/ai-team';
  }catch(e){}
  return 'https://okoteam.top/ai-team';
}
function open3d(){
  var url = hq3dUrl();
  var ok = false;
  try{
    var tg = window.Telegram && window.Telegram.WebApp;
    if(tg && typeof tg.openLink === 'function'){ tg.openLink(url); ok = true; }
  }catch(e){}
  if(!ok){ try{ ok = !!window.open(url, '_blank', 'noopener'); }catch(e){ ok = false; } }
  say(ok ? 'Открываю 3D-штаб в новой вкладке' : ('3D-штаб: ' + url));
}
/* старый вызов из ядра ведёт на отключённое зеркало — перенаправляем */
try{ window.hqOpen3d = open3d; }catch(e){}

function portalCard(){
  return '<button class="h2-portal" type="button" data-h2act="open3d">' +
    '<span class="h2-hero-ic" style="width:38px;height:38px;border-radius:11px">' + ic('globe') + '</span>' +
    '<span class="h2-portal-b"><b>3D-штаб OKO</b>' +
      '<small>Открывается отдельной вкладкой на ' + esc(hq3dUrl().replace(/^https?:\/\//, '')) +
      '. Тяжёлый WebGL вынесен из мини-аппа, чтобы Telegram-webview не лагал.</small></span>' +
    ic('chev') +
  '</button>';
}

/* ==========================================================================
   8. АДМИНКА ВЛАДЕЛЬЦА
   Полностью свой рендер: старые блоки с выдуманными когортами, A/B-тестами,
   heatmap и «real-time» метриками не вызываются — они рисовали цифры,
   которых нет.
   ========================================================================== */
var TABS = [
  {k:'overview', t:'Обзор'},
  {k:'hq',       t:'Штаб'},
  {k:'users',    t:'Пользователи'},
  {k:'pay',      t:'Оплаты'},
  {k:'plans',    t:'Тарифы'},
  {k:'content',  t:'Контент'},
  {k:'moder',    t:'Модерация'},
  {k:'flags',    t:'Флаги'},
  {k:'export',   t:'Экспорт'}
];
/* старые ключи вкладок из ядра ведут на ближайший живой раздел */
var TAB_ALIAS = {revenue:'pay', finance:'pay', partners:'users', crm:'users', agents:'hq'};

function admOpen(){
  var el = document.getElementById('adminView');
  return !!(el && el.classList.contains('open'));
}
function curTab(){
  var t = (typeof window.admTab === 'string') ? window.admTab : 'overview';
  if(TAB_ALIAS[t]) t = TAB_ALIAS[t];
  for(var i=0;i<TABS.length;i++) if(TABS[i].k === t) return t;
  return 'overview';
}

/* ---------- реальное состояние приложения ---------- */
function stateSnapshot(){
  var A = gADMIN() || {};
  var rev = arr(gREVENUE());
  var w = gWALLET();
  var posts = gPOSTS() || {rec:[], sub:[]};
  var ads = gADS() || {camps:[]};
  return {
    users:    arr(A.users),
    pay:      arr(A.pay),
    partners: arr(A.partners),
    moder:    arr(A.moder),
    flags:    arr(A.flags),
    revenue:  rev,
    revTotal: rev.reduce(function(s,r){ var v = Number(r && r.sum); return s + (isFinite(v) ? v : 0); }, 0),
    wallet:   w,
    ledger:   w ? arr(w.ledger) : [],
    listings: arr(gLISTINGS()),
    posts:    arr(posts.rec).length + arr(posts.sub).length,
    chats:    arr(gCHATS()).length,
    channels: gChannels(),
    courses:  arr(gCOURSES()).length,
    adsPend:  arr(ads.camps).filter(function(c){ return c && c.status === 'mod'; }),
    adsAll:   arr(ads.camps),
    reports:  arr(gHQREPORTS()).filter(function(r){ return r && !r.done; })
  };
}
/* Сервер данных пока не отдаёт: пользователи, платежи, партнёрка и метрики
   площадок живут в Supabase. Пока связи нет — прочерк, а не ноль. */
function serverOn(){ return integOn('db'); }
function q(v){ return serverOn() ? v : '—'; }

/* ---------- ОБЗОР ---------- */
function viewOverview(){
  var s = stateSnapshot();
  var queued = S.tasks.filter(function(t){ return t.status === 'queued'; }).length;

  var banner = serverOn() ? '' :
    '<div class="h2-note">' + ic('warning') +
    '<span><b>Бэкенд не подключён.</b> Пользователи, платежи и метрики площадок живут в Supabase и в приложение сейчас не приходят. ' +
    'Всё, что помечено прочерком — это «сервер не ответил», а не ноль. Проверить связь можно на вкладке «Штаб».</span></div>';

  var tiles =
    kpi(q(String(s.users.length)), 'Пользователей', !serverOn()) +
    kpi(q('—'), 'Активных сегодня', true) +
    kpi(money(s.revTotal), 'Доход OKO · локальный учёт') +
    kpi(s.wallet ? money(s.wallet.balance) : '—', 'Баланс кошелька владельца', !s.wallet) +
    kpi(String(s.moder.length + s.reports.length + s.adsPend.length), 'На модерации') +
    kpi(String(queued), 'Задач в штабе');

  var rows =
    row('users', 'Пользователи', serverOn() ? (s.users.length + ' в списке') : 'сервер не подключён', q(String(s.users.length)), 'tab', 'users') +
    row('card', 'Оплаты', s.ledger.length + ' операций в кошельке владельца', money(s.revTotal), 'tab', 'pay') +
    row('crown', 'Тарифы', Object.keys(gPLANS() || {}).length + ' тарифов в витрине', '', 'tab', 'plans') +
    row('feed', 'Контент', s.posts + ' постов · ' + s.listings.length + ' объявлений · ' + s.channels + ' каналов', '', 'tab', 'content') +
    row('shield', 'Модерация', (s.moder.length + s.reports.length + s.adsPend.length) + ' в очереди', '', 'tab', 'moder') +
    row('eye', 'Штаб OKO', AGENTS.length + ' агентов · ' + queued + ' задач в очереди', '', 'tab', 'hq');

  return banner +
    '<div class="h2-h">Сводка</div>' +
    '<div class="h2-kpis">' + tiles + '</div>' +
    '<div class="h2-h">Разделы</div>' + rows;
}
function row(icon, title, sub, val, act, id){
  return '<button class="h2-row" type="button" style="width:100%;text-align:left"' +
    (act ? ' data-h2act="' + esc(act) + '" data-id="' + esc(id || '') + '"' : '') + '>' +
    '<span class="h2-row-ic">' + ic(icon) + '</span>' +
    '<span class="h2-row-b"><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></span>' +
    (val ? '<span class="h2-row-v' + (val === '—' ? ' q' : '') + '">' + esc(val) + '</span>' : ic('chev')) +
  '</button>';
}

/* ---------- ПОЛЬЗОВАТЕЛИ ---------- */
function viewUsers(){
  var s = stateSnapshot();
  var P = gPROFILE() || {};
  var me = '<div class="h2-row">' +
    '<span class="h2-row-ic">' + ic('crown') + '</span>' +
    '<span class="h2-row-b"><b>' + esc(P.name || 'Владелец') + '</b>' +
      '<small>@' + esc(P.nick || '—') + ' · роль: владелец · тариф ' + esc(P.tier || '—') + '</small></span>' +
    '<span class="h2-row-v">этот аккаунт</span></div>';

  var list = s.users.length
    ? s.users.map(function(u, i){
        var tier = esc(u.tier || '—');
        return '<div class="h2-row">' +
          '<span class="h2-row-ic">' + ic('user') + '</span>' +
          '<span class="h2-row-b"><b>' + esc(u.n || '—') + '</b><small>' + esc(u.h || '') + ' · ' + esc(u.when || '') + '</small></span>' +
          '<span class="h2-row-v">' + tier + '</span></div>';
      }).join('')
    : emptyBlock('users', 'Список пользователей пуст',
        'Аккаунты приходят из Supabase. Пока сервер не подключён, здесь показан только этот аккаунт — выдуманных людей в списке не будет.');

  var partners = s.partners.length
    ? s.partners.map(function(p){
        return '<div class="h2-row">' +
          '<span class="h2-row-ic">' + ic('pp-gift') + '</span>' +
          '<span class="h2-row-b"><b>' + esc(p.n || '—') + '</b><small>' + esc(p.h || '') + ' · ' + num(p.ref) + ' рефералов</small></span>' +
          '<span class="h2-row-v">' + esc(p.earn || '—') + '</span></div>';
      }).join('')
    : emptyBlock('pp-gift', 'Партнёров пока нет',
        'Партнёрские начисления считаются на сервере после вебхука оплаты. Локально их взять неоткуда.');

  return '<div class="h2-h">Владелец</div>' + me +
    '<div class="h2-h">Пользователи' + (s.users.length ? ' · ' + s.users.length : '') + '</div>' + list +
    '<div class="h2-h">Партнёры' + (s.partners.length ? ' · ' + s.partners.length : '') + '</div>' + partners;
}

/* ---------- ОПЛАТЫ ---------- */
function viewPay(){
  var s = stateSnapshot();

  var srv = s.pay.length
    ? s.pay.map(function(p){
        return '<div class="h2-row">' +
          '<span class="h2-row-ic">' + ic('card') + '</span>' +
          '<span class="h2-row-b"><b>' + esc(p.n || '—') + '</b><small>' + esc(p.plan || '') + ' · ' + esc(p.when || '') + '</small></span>' +
          '<span class="h2-row-v">' + esc(p.sum || '—') + '</span></div>';
      }).join('')
    : emptyBlock('card', 'Платежей с сервера нет',
        'Платежи приходят вебхуком Lava.top в Supabase. Пока вебхук не подключён, список пуст — и это честнее, чем выдуманные транзакции.');

  var revRows = s.revenue.length
    ? s.revenue.slice(0, 40).map(function(r){
        return '<div class="h2-row">' +
          '<span class="h2-row-ic">' + ic('money') + '</span>' +
          '<span class="h2-row-b"><b>' + esc(r.src || 'Доход') + '</b><small>' + esc(when(r.at)) + '</small></span>' +
          '<span class="h2-row-v">+' + esc(money(r.sum)) + '</span></div>';
      }).join('')
    : emptyBlock('money', 'Доход ещё не начислялся',
        'Сюда попадают комиссии Биржи, продажи каналов, оплаты рекламы и тарифов — по факту операции внутри приложения.');

  var ledger = s.ledger.length
    ? s.ledger.slice(0, 30).map(function(l){
        var plus = l.t === '+';
        return '<div class="h2-row">' +
          '<span class="h2-row-ic">' + ic(plus ? 'arrow-down' : 'arrow-up') + '</span>' +
          '<span class="h2-row-b"><b>' + esc(l.why || (plus ? 'Пополнение' : 'Списание')) + '</b><small>' + esc(when(l.at)) + '</small></span>' +
          '<span class="h2-row-v' + (plus ? '' : ' q') + '">' + (plus ? '+' : '−') + esc(money(l.sum)) + '</span></div>';
      }).join('')
    : emptyBlock('wallet', 'Операций по кошельку нет',
        'Здесь появятся пополнения и списания кошелька владельца — ровно те, что произошли в приложении.');

  return '<div class="h2-h">Итого</div>' +
    '<div class="h2-kpis">' +
      kpi(money(s.revTotal), 'Доход OKO · локальный учёт') +
      kpi(s.wallet ? money(s.wallet.balance) : '—', 'Баланс кошелька', !s.wallet) +
      kpi(q(String(s.pay.length)), 'Платежей с сервера', !serverOn()) +
    '</div>' +
    '<div class="h2-h">Платежи с сервера</div>' + srv +
    '<div class="h2-h">Доход OKO' + (s.revenue.length ? ' · ' + s.revenue.length : '') + '</div>' + revRows +
    '<div class="h2-h">Кошелёк владельца' + (s.ledger.length ? ' · ' + s.ledger.length : '') + '</div>' + ledger;
}

/* ---------- ТАРИФЫ ---------- */
function viewPlans(){
  var P = gPLANS() || {};
  var periods = arr(gPERIODS());
  var mine = (gPROFILE() && gPROFILE().tier) ? String(gPROFILE().tier) : '';
  var keys = Object.keys(P);

  if(!keys.length){
    return emptyBlock('crown', 'Витрина тарифов пуста', 'Тарифы задаются в ядре приложения. Сейчас список пуст.');
  }

  var rows = keys.map(function(k){
    var p = P[k] || {};
    var mo = Number(p.mo);
    var yearly = '';
    var y = periods.filter(function(x){ return x && x[0] === 12; })[0];
    /* Для бесплатного тарифа годовой расчёт со скидкой — бессмыслица, не пишем. */
    if(y && isFinite(mo) && mo > 0){
      var disc = Number(y[2]) || 0;
      yearly = ' · год ' + money(Math.round(mo * 12 * (1 - disc/100))) + (disc ? ' (−' + disc + '%)' : '');
    }
    var isMine = mine && (mine.toUpperCase() === String(p.name || k).toUpperCase());
    return '<div class="h2-row">' +
      '<span class="h2-row-ic">' + ic('crown') + '</span>' +
      '<span class="h2-row-b"><b>' + esc(p.name || k) + (isMine ? ' · текущий' : '') + '</b>' +
        '<small>' + esc(money(mo)) + ' в месяц' + esc(yearly) + ' · активаций: ' + esc(q('—')) + '</small></span>' +
      '<button class="h2-btn" data-h2act="plan-open" data-id="' + esc(k) + '">Оформление</button>' +
    '</div>';
  }).join('');

  return '<div class="h2-h">Витрина тарифов · ' + keys.length + '</div>' + rows +
    '<div class="h2-note" style="margin-top:10px">' + ic('info') +
      '<span><b>Что делает кнопка.</b> «Оформление» закрывает админку и открывает обычный экран оплаты этого тарифа — тот же, что видит человек. ' +
      'Количество активаций считается на сервере: пока Supabase не подключён, стоит прочерк.</span></div>';
}

/* ---------- КОНТЕНТ ---------- */
function viewContent(){
  var s = stateSnapshot();
  var items = [
    {ic:'feed',      n:'Посты в ленте',      v:s.posts,          go:function(){ goTab('feed'); }},
    {ic:'briefcase', n:'Объявления Биржи',   v:s.listings.length, go:function(){ goMini('market'); }},
    {ic:'megaphone', n:'Каналы',             v:s.channels,        go:function(){ var f = fn('chOpen'); if(f){ closeAdminSafe(); f('list'); } else say('Раздел каналов недоступен'); }},
    {ic:'chat',      n:'Чаты',               v:s.chats,           go:function(){ goTab('chats'); }},
    {ic:'crown',     n:'Курсы Академии',     v:s.courses,         go:function(){ goTab('academy'); }},
    {ic:'megaphone', n:'Рекламные кампании', v:s.adsAll.length,   go:function(){ goTab('ads'); }}
  ];
  var total = items.reduce(function(a, b){ return a + (Number(b.v) || 0); }, 0);

  var rows = items.map(function(it, i){
    return '<button class="h2-row" type="button" style="width:100%;text-align:left" data-h2act="content-go" data-id="' + i + '">' +
      '<span class="h2-row-ic">' + ic(it.ic) + '</span>' +
      '<span class="h2-row-b"><b>' + esc(it.n) + '</b><small>' + (Number(it.v) ? 'открыть раздел' : 'пока пусто — контент создаётся людьми') + '</small></span>' +
      '<span class="h2-row-v' + (Number(it.v) ? '' : ' q') + '">' + esc(num(it.v)) + '</span>' +
    '</button>';
  }).join('');
  CONTENT_GO = items.map(function(it){ return it.go; });

  return '<div class="h2-h">Контент в приложении</div>' + rows +
    (total ? '' : '<div class="h2-note" style="margin-top:10px">' + ic('info') +
      '<span>Контента пока нет ни в одном разделе. Так и должно выглядеть чистое приложение до запуска: демо-постов, демо-объявлений и демо-каналов в OKO не бывает.</span></div>');
}
var CONTENT_GO = [];

/* ---------- МОДЕРАЦИЯ ---------- */
function viewModer(){
  var s = stateSnapshot();

  var mod = s.moder.length
    ? s.moder.map(function(m, i){
        return '<div class="h2-row" style="align-items:flex-start">' +
          '<span class="h2-row-ic">' + ic('flag') + '</span>' +
          '<span class="h2-row-b"><b>' + esc(m.t || '—') + '</b><small>' + esc(m.kind || '') + ' · ' + esc(m.by || '') + '</small>' +
            '<span class="h2-btns">' +
              '<button class="h2-btn pri" data-h2act="mod-ok" data-id="' + i + '">Одобрить</button>' +
              '<button class="h2-btn dng" data-h2act="mod-no" data-id="' + i + '">Отклонить</button>' +
            '</span></span></div>';
      }).join('')
    : '';

  var reps = s.reports.length
    ? s.reports.map(function(r){
        return '<div class="h2-row"><span class="h2-row-ic">' + ic('flag') + '</span>' +
          '<span class="h2-row-b"><b>' + esc((r.kind || 'Жалоба') + ': ' + (r.tgt || '')) + '</b><small>' + esc(r.reason || '') + '</small></span></div>';
      }).join('')
    : '';

  var ads = s.adsPend.length
    ? s.adsPend.map(function(c){
        return '<div class="h2-row" style="align-items:flex-start">' +
          '<span class="h2-row-ic">' + ic('megaphone') + '</span>' +
          '<span class="h2-row-b"><b>' + esc(c.name || 'Кампания') + '</b><small>бюджет ' + esc(money(c.budget)) + ' · ждёт решения владельца</small>' +
            '<span class="h2-btns">' +
              '<button class="h2-btn pri" data-h2act="ad-ok" data-id="' + esc(String(c.id)) + '">Одобрить</button>' +
              '<button class="h2-btn dng" data-h2act="ad-no" data-id="' + esc(String(c.id)) + '">Отклонить</button>' +
            '</span></span></div>';
      }).join('')
    : '';

  var total = s.moder.length + s.reports.length + s.adsPend.length;
  var head = '<div class="h2-kpis">' +
    kpi(String(s.adsPend.length), 'Реклама на проверке') +
    kpi(String(s.reports.length), 'Жалобы людей') +
    kpi(String(s.moder.length), 'Прочая очередь') +
  '</div>';

  if(!total){
    return head + '<div class="h2-h">Очередь модерации</div>' +
      emptyBlock('shield', 'Очередь пуста',
        'Сюда попадают реальные заявки: кампании из рекламного кабинета, жалобы людей и спорные материалы. Автомодерация работает на сервере — её счётчики появятся вместе с Supabase.');
  }
  return head +
    (ads  ? '<div class="h2-h">Реклама на проверке · ' + s.adsPend.length + '</div>' + ads : '') +
    (reps ? '<div class="h2-h">Жалобы людей · ' + s.reports.length + '</div>' + reps : '') +
    (mod  ? '<div class="h2-h">Прочая очередь · ' + s.moder.length + '</div>' + mod : '');
}

/* ---------- ФИЧА-ФЛАГИ ---------- */
/* Флаги реальные: это переключатели готовности подсистем. Значение теперь
   переживает перезагрузку (раньше сбрасывалось). У каждого честно написано,
   что включение даёт и чего для него не хватает. */
var FLAG_NOTE = {
  'Контент-завод': 'Экран конвейера уже в приложении. Реальная сборка роликов включится вместе с рендер-фермой и S3.',
  'Видео-премодератор OKO': 'Нужна языковая модель и разбор видео на сервере. Пока выключено, ролики проверяются вручную.',
  'Telegram Login': 'Работает, когда приложение открыто внутри @okoappbot: initData подписывает Telegram.',
  'Оплата Lava.top': 'Нужен вебхук Lava.top на сервере, иначе тариф не активируется автоматически после оплаты.',
  'Звонки LiveKit': 'Нужен сервер LiveKit и ключи комнаты. Интерфейс звонка уже есть, транспорт — нет.'
};
function flagOn(f, i){
  var k = 'f' + i;
  if(Object.prototype.hasOwnProperty.call(S.flags, k)) return !!S.flags[k];
  return !!f.on;
}
function viewFlags(){
  var s = stateSnapshot();
  if(!s.flags.length){
    return emptyBlock('bolt', 'Флагов нет', 'Список фича-флагов задаётся в ядре приложения.');
  }
  var rows = s.flags.map(function(f, i){
    var on = flagOn(f, i);
    var note = FLAG_NOTE[f.t] || '';
    return '<div class="h2-flag">' +
      '<span class="h2-flag-b"><b>' + esc(f.t || '—') + '</b>' +
        '<small>' + esc(f.d || '') + (note ? ' — ' + esc(note) : '') + '</small></span>' +
      '<button class="h2-sw' + (on ? ' on' : '') + '" role="switch" aria-checked="' + (on ? 'true' : 'false') +
        '" aria-label="' + esc(f.t || 'Флаг') + '" data-h2act="flag" data-id="' + i + '"><i></i></button>' +
    '</div>';
  }).join('');
  return '<div class="h2-h">Фича-флаги · ' + s.flags.length + '</div>' + rows +
    '<div class="h2-note" style="margin-top:10px">' + ic('info') +
      '<span>Флаг переключается локально и сохраняется на этом устройстве. Он управляет тем, что показывает приложение, ' +
      'но не поднимает недостающие сервисы — что именно нужно, написано под каждым флагом.</span></div>';
}

/* ---------- ЭКСПОРТ ---------- */
function viewExport(){
  var s = stateSnapshot();
  return '<div class="h2-h">Выгрузки</div>' +
    '<div class="h2-card">' +
      '<div class="h2-row-b"><b>Сводный отчёт владельца</b>' +
        '<small>Текстовый файл: состав штаба, очередь задач, лента отчётов, доход и контент — ровно то, что есть в приложении.</small></div>' +
      '<div class="h2-btns"><button class="h2-btn pri" data-h2act="exp-txt">' + ic('file') + 'Скачать .txt</button></div>' +
    '</div>' +
    '<div class="h2-card">' +
      '<div class="h2-row-b"><b>Задачи штаба · CSV</b>' +
        '<small>' + S.tasks.length + ' задач. Открывается в таблицах, разделитель — точка с запятой.</small></div>' +
      '<div class="h2-btns"><button class="h2-btn" data-h2act="exp-csv"' + (S.tasks.length ? '' : ' disabled') + '>' +
        ic('download') + 'Скачать .csv</button></div>' +
    '</div>' +
    '<div class="h2-card">' +
      '<div class="h2-row-b"><b>Состояние приложения · JSON</b>' +
        '<small>Дамп локального состояния: штаб, доход, кошелёк, контент. Секретов и ключей в файле нет.</small></div>' +
      '<div class="h2-btns"><button class="h2-btn" data-h2act="exp-json">' + ic('download') + 'Скачать .json</button></div>' +
    '</div>' +
    '<div class="h2-h">Опасная зона</div>' +
    '<div class="h2-card">' +
      '<div class="h2-row-b"><b>Сбросить локальные данные штаба</b>' +
        '<small>Удалит ' + S.tasks.length + ' задач и ' + S.log.length + ' записей ленты на этом устройстве. ' +
        'Настройки приложения, кошелёк и авторизация не трогаются.</small></div>' +
      '<div class="h2-btns"><button class="h2-btn dng" data-h2act="reset">' + ic('trash') + 'Сбросить штаб</button></div>' +
    '</div>' +
    '<div class="h2-note" style="margin-top:10px">' + ic('info') +
      '<span>Выгрузка формируется прямо в браузере и сразу сохраняется файлом. Никуда не отправляется, интернет для неё не нужен.</span></div>';
}

/* ---------- файлы ---------- */
function download(name, text, mime){
  try{
    var url = URL.createObjectURL(new Blob(['﻿' + text], {type: (mime || 'text/plain') + ';charset=utf-8'}));
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    return true;
  }catch(e){ return false; }
}
function stamp(){
  var d = new Date(), p = function(n){ return String(n).padStart(2,'0'); };
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate());
}
function exportTxt(){
  var s = stateSnapshot();
  var L = [];
  L.push('OKO — ОТЧЁТ ВЛАДЕЛЬЦА');
  L.push('Сформирован: ' + when(Date.now()));
  L.push('Источник: локальное состояние приложения. Прочерк = сервер данные не отдал.');
  L.push('==================================================');
  L.push('', 'ШТАБ OKO');
  L.push('Агентов: ' + AGENTS.length + ' · отделов: ' + ROOMS.length);
  AGENTS.forEach(function(a){
    var miss = agentMissing(a);
    L.push('  ' + a.role + ' [' + ST_LABEL[agentState(a)] + '] — очередь: ' + agentTasks(a.id, 'queued').length +
      (miss.length ? ' — не хватает: ' + miss.map(integLabel).join(', ') : ''));
  });
  L.push('', 'ЗАДАЧИ ШТАБА (' + S.tasks.length + ')');
  if(S.tasks.length) S.tasks.forEach(function(t){
    L.push('  [' + (t.status === 'done' ? 'закрыта' : 'в очереди') + '] ' + agentRole(t.agent) + ' — ' + t.title + ' (' + when(t.at) + ')');
  }); else L.push('  пусто');
  L.push('', 'ЛЕНТА ОТЧЁТОВ (' + S.log.length + ')');
  if(S.log.length) S.log.slice(0, 60).forEach(function(l){
    L.push('  ' + when(l.at) + ' · ' + (l.agent ? agentRole(l.agent) : 'Штаб OKO') + ' — ' + l.text);
  }); else L.push('  пусто');
  L.push('', 'ДЕНЬГИ');
  L.push('  Доход OKO (локальный учёт): ' + money(s.revTotal) + ' · операций: ' + s.revenue.length);
  L.push('  Кошелёк владельца: ' + (s.wallet ? money(s.wallet.balance) : '—'));
  L.push('  Платежи с сервера: ' + (serverOn() ? s.pay.length : '—'));
  L.push('', 'КОНТЕНТ');
  L.push('  Посты: ' + s.posts + ' · объявления: ' + s.listings.length + ' · каналы: ' + s.channels +
         ' · чаты: ' + s.chats + ' · курсы: ' + s.courses + ' · кампании: ' + s.adsAll.length);
  L.push('', 'МОДЕРАЦИЯ');
  L.push('  Реклама на проверке: ' + s.adsPend.length + ' · жалобы: ' + s.reports.length + ' · прочее: ' + s.moder.length);
  L.push('', 'ПОДКЛЮЧЕНИЯ');
  Object.keys(INTEG).forEach(function(k){
    L.push('  ' + INTEG[k].n + ': ' + (integOn(k) ? 'подключено' : 'нет — нужен ' + INTEG[k].key));
  });
  L.push('', '==================================================', 'OKO · отчёт сформирован приложением, данные не додумывались');

  var name = 'oko-hq-' + stamp() + '.txt';
  if(download(name, L.join('\n'), 'text/plain')){
    logAdd(null, 'Сформирован отчёт ' + name);
    say('Отчёт сохранён: ' + name);
    render();
  } else say('Не удалось сохранить файл');
}
function csvCell(v){
  var s = String(v == null ? '' : v);
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCsv(){
  if(!S.tasks.length){ say('Задач нет — выгружать нечего'); return; }
  var rows = [['Агент','Отдел','Задача','Детали','Статус','Поставлена','Закрыта']];
  S.tasks.forEach(function(t){
    var a = agent(t.agent), r = a ? room(a.room) : null;
    rows.push([
      a ? a.role : '—', r ? r.n : '—', t.title || '', t.brief || '',
      t.status === 'done' ? 'закрыта' : 'в очереди',
      when(t.at), t.doneAt ? when(t.doneAt) : ''
    ]);
  });
  var name = 'oko-hq-tasks-' + stamp() + '.csv';
  if(download(name, rows.map(function(r){ return r.map(csvCell).join(';'); }).join('\r\n'), 'text/csv')){
    logAdd(null, 'Выгружены задачи штаба (' + S.tasks.length + ') в ' + name);
    say('Файл сохранён: ' + name);
    render();
  } else say('Не удалось сохранить файл');
}
function exportJson(){
  var s = stateSnapshot();
  var data = {
    at: new Date().toISOString(),
    note: 'Локальное состояние приложения OKO. Секретов и ключей здесь нет.',
    hq: {
      agents: AGENTS.map(function(a){
        return {id:a.id, role:a.role, room:a.room, state:agentState(a), missing:agentMissing(a)};
      }),
      rooms: ROOMS.map(function(r){ return {id:r.id, name:r.n}; }),
      tasks: S.tasks, log: S.log
    },
    integrations: Object.keys(INTEG).reduce(function(o, k){ o[k] = integOn(k); return o; }, {}),
    money: {revenueTotal: s.revTotal, revenueOps: s.revenue.length, wallet: s.wallet ? s.wallet.balance : null},
    content: {posts:s.posts, listings:s.listings.length, channels:s.channels, chats:s.chats, courses:s.courses, ads:s.adsAll.length},
    moderation: {ads:s.adsPend.length, reports:s.reports.length, other:s.moder.length}
  };
  var name = 'oko-state-' + stamp() + '.json';
  if(download(name, JSON.stringify(data, null, 2), 'application/json')){
    logAdd(null, 'Выгружено состояние приложения в ' + name);
    say('Файл сохранён: ' + name);
    render();
  } else say('Не удалось сохранить файл');
}

/* ==========================================================================
   9. РЕНДЕР АДМИНКИ
   ========================================================================== */
var VIEWS = {
  overview: viewOverview,
  hq:       hqView,
  users:    viewUsers,
  pay:      viewPay,
  plans:    viewPlans,
  content:  viewContent,
  moder:    viewModer,
  flags:    viewFlags,
  export:   viewExport
};

function render(){
  var tabsEl = document.getElementById('admTabs');
  var bodyEl = document.getElementById('admBody');
  if(!bodyEl) return;

  if(!isOwnerNow()){
    if(tabsEl) tabsEl.innerHTML = '';
    bodyEl.innerHTML = emptyBlock('lock', 'Раздел владельца',
      'Админка и штаб OKO доступны только владельцу приложения.');
    return;
  }

  var t = curTab();
  try{ window.admTab = t; }catch(e){}

  if(tabsEl){
    tabsEl.innerHTML = TABS.map(function(x){
      return '<button class="adm-tab ' + (t === x.k ? 'on' : '') + '" data-h2act="tab" data-id="' + x.k + '">' + esc(x.t) + '</button>';
    }).join('');
    var on = tabsEl.querySelector('.adm-tab.on');
    if(on && on.scrollIntoView){ try{ on.scrollIntoView({block:'nearest', inline:'nearest'}); }catch(e){} }
  }

  var f = VIEWS[t] || viewOverview;
  var html = '';
  try{ html = f(); }
  catch(e){
    html = emptyBlock('warning', 'Раздел не отрисовался',
      'Внутренняя ошибка рендера: ' + String(e && e.message || e).slice(0, 120) + '. Остальные вкладки работают.');
  }
  bodyEl.innerHTML = html;
  bodyEl.scrollTop = 0;
}

/* Забираем рендер админки на себя целиком. Старые обёртки ядра рисовали
   выдуманные когорты, A/B-тесты, heatmap и «real-time» метрики — они больше
   не вызываются. Точка входа admGo/renderAdmin из остального кода сохраняется. */
try{ window.renderAdmin = render; }catch(e){}
try{
  window.admGo = function(k){
    try{ window.admTab = (TAB_ALIAS[k] || k); }catch(e){}
    render();
  };
}catch(e){}

/* Гейт владельца и остановка старых таймеров при закрытии. */
(function patchOpenClose(){
  var prevOpen = fn('openAdmin');
  window.openAdmin = function(){
    if(!isOwnerNow()){
      var g = fn('hqShowGate');
      if(g){ try{ g(); return; }catch(e){} }
      say('Раздел доступен только владельцу');
      return;
    }
    try{ window.admTab = 'overview'; }catch(e){}
    render();
    var el = document.getElementById('adminView');
    if(el) el.classList.add('open');
    /* если ядро вело свой стек навигации — не мешаем ему */
    if(!el && prevOpen){ try{ prevOpen(); }catch(e){} }
  };
  var prevClose = fn('closeAdmin');
  window.closeAdmin = function(){
    viewClose();
    modalClose();
    ['hqStopLog','hqStopFeed','hqStopRt'].forEach(function(n){ var f2 = fn(n); if(f2){ try{ f2(); }catch(e){} } });
    if(prevClose){ try{ prevClose(); return; }catch(e){} }
    var el = document.getElementById('adminView');
    if(el) el.classList.remove('open');
  };
})();
function closeAdminSafe(){ var f = fn('closeAdmin'); if(f){ try{ f(); }catch(e){} } }
function goTab(t){ closeAdminSafe(); var f = fn('showTab'); if(f){ try{ f(t); }catch(e){} } }
function goMini(id){
  closeAdminSafe();
  var st = fn('showTab'); if(st){ try{ st('mini'); }catch(e){} }
  var om = fn('openMa'); if(om){ try{ om(id); }catch(e){} }
}

/* ==========================================================================
   10. ДЕЙСТВИЯ (делегирование по data-h2act)
   ========================================================================== */
function taskAdd(agentId){
  var a = agent(agentId); if(!a) return;
  var ti = document.getElementById('h2TaskT');
  var bi = document.getElementById('h2TaskB');
  var title = ti ? String(ti.value || '').trim() : '';
  var brief = bi ? String(bi.value || '').trim() : '';
  if(!title){
    say('Напиши, что нужно сделать');
    if(ti) ti.focus();
    return;
  }
  S.tasks.unshift({
    id: uid('t'), at: Date.now(), agent: a.id,
    title: title.slice(0, 120), brief: brief.slice(0, 1000),
    status: 'queued', doneAt: 0
  });
  if(S.tasks.length > 300) S.tasks.length = 300;
  var miss = agentMissing(a);
  logAdd(a.id, 'Задача поставлена: «' + title.slice(0, 80) + '»' +
    (miss.length ? ' — ждёт подключения: ' + miss.map(integLabel).join(', ') : ' — ждёт очередь исполнения'));
  save();
  if(ti) ti.value = ''; if(bi) bi.value = '';
  viewRender();
  say(miss.length
    ? ('Задача в очереди. Агент не возьмёт её без: ' + miss.map(integLabel).join(', '))
    : 'Задача сохранена в очереди штаба');
}
function taskFind(id){ for(var i=0;i<S.tasks.length;i++) if(S.tasks[i].id === id) return S.tasks[i]; return null; }
function taskDone(id){
  var t = taskFind(id); if(!t || t.status === 'done') return;
  t.status = 'done'; t.doneAt = Date.now();
  logAdd(t.agent, 'Владелец закрыл задачу вручную: «' + String(t.title).slice(0, 80) + '»');
  save(); viewRender(); render();
  say('Задача помечена закрытой');
}
function taskDrop(id){
  var t = taskFind(id); if(!t) return;
  modalConfirm({
    title:'Снять задачу?', danger:true, ok:'Снять',
    text:'Задача «' + String(t.title).slice(0, 90) + '» будет удалена из очереди. В ленте отчётов останется запись о снятии.',
    onOk:function(){
      var i = S.tasks.indexOf(t);
      if(i >= 0) S.tasks.splice(i, 1);
      logAdd(t.agent, 'Задача снята владельцем: «' + String(t.title).slice(0, 80) + '»');
      save(); viewRender(); render();
      say('Задача снята');
    }
  });
}
function flagToggle(i){
  var s = stateSnapshot();
  var f = s.flags[i]; if(!f) return;
  var k = 'f' + i;
  var next = !flagOn(f, i);
  S.flags[k] = next;
  try{ f.on = next; }catch(e){}
  logAdd(null, 'Фича-флаг «' + String(f.t) + '»: ' + (next ? 'включён' : 'выключен'));
  save(); render();
  say('Флаг «' + f.t + '» ' + (next ? 'включён' : 'выключен') + ' — сохранено на этом устройстве');
}
function modDecide(i, ok){
  var f = fn('admResolve');
  if(f){ try{ f(i, ok ? 1 : 0); }catch(e){} }
  logAdd(null, 'Материал из очереди модерации ' + (ok ? 'одобрен' : 'отклонён') + ' владельцем');
  save(); render();
}
function adDecide(id, ok){
  var f = fn('hqRealAdDecide');
  if(f){
    try{ f(isNaN(Number(id)) ? id : Number(id), ok); }catch(e){}
    logAdd(null, 'Рекламная кампания ' + (ok ? 'одобрена' : 'отклонена') + ' владельцем');
    save(); render();
    return;
  }
  say('Рекламный кабинет недоступен — решение не сохранено');
}
function resetHq(){
  modalConfirm({
    title:'Сбросить штаб?', danger:true, ok:'Сбросить',
    text:'Будут удалены ' + S.tasks.length + ' задач и ' + S.log.length + ' записей ленты на этом устройстве. ' +
         'Кошелёк, настройки и авторизация не трогаются. Отменить нельзя.',
    onOk:function(){
      S.tasks = []; S.log = []; S.flags = {};
      save(); render();
      say('Локальные данные штаба очищены');
    }
  });
}

document.addEventListener('click', function(e){
  var el = e.target && e.target.closest ? e.target.closest('[data-h2act]') : null;
  if(!el) return;
  var act = el.getAttribute('data-h2act');
  var id  = el.getAttribute('data-id');

  switch(act){
    case 'modal-ok':   { var cb = modalEl && modalEl.__ok; modalClose(); if(cb) cb(); break; }
    case 'modal-cancel': modalClose(); break;
    case 'view-close': viewClose(); break;
    case 'tab':        e.preventDefault(); try{ window.admTab = id; }catch(err){} render(); break;
    case 'agent':      viewOpen('agent', id); break;
    case 'room':       viewOpen('room', id); break;
    case 'open3d':     open3d(); break;
    case 'check':      checkIntegrations(); break;
    case 'task-add':   taskAdd(id); break;
    case 'task-done':  taskDone(id); break;
    case 'task-drop':  taskDrop(id); break;
    case 'flag':       flagToggle(Number(id)); break;
    case 'mod-ok':     modDecide(Number(id), true); break;
    case 'mod-no':     modDecide(Number(id), false); break;
    case 'ad-ok':      adDecide(id, true); break;
    case 'ad-no':      adDecide(id, false); break;
    case 'plan-open':  { closeAdminSafe(); var op = fn('openPay'); if(op){ try{ op(id); }catch(err){} } else say('Экран оплаты недоступен'); break; }
    case 'content-go': { var g = CONTENT_GO[Number(id)]; if(typeof g === 'function') g(); break; }
    case 'exp-txt':    exportTxt(); break;
    case 'exp-csv':    exportCsv(); break;
    case 'exp-json':   exportJson(); break;
    case 'reset':      resetHq(); break;
    case 'log-clear':
      modalConfirm({
        title:'Очистить ленту отчётов?', danger:true, ok:'Очистить',
        text:'Будут удалены ' + S.log.length + ' записей. Задачи останутся на месте.',
        onOk:function(){ S.log = []; save(); render(); say('Лента отчётов очищена'); }
      });
      break;
    default: return;
  }
}, false);

/* Escape закрывает подвид штаба раньше, чем ядро закроет всю админку. */
document.addEventListener('keydown', function(e){
  if(e.key !== 'Escape') return;
  if(modalEl) return;                       /* модалка гасит Escape сама */
  if(view){ e.stopPropagation(); viewClose(); }
}, true);

/* ==========================================================================
   11. ПРОФИЛЬ: раздел владельца виден только владельцу
   ========================================================================== */
function syncOwnerUi(){
  var owner = isOwnerNow();
  var admRow = document.getElementById('prowAdmin');
  if(admRow) admRow.style.display = owner ? '' : 'none';

  var hqRow = document.getElementById('hqProwHq');
  if(hqRow){
    hqRow.style.display = owner ? '' : 'none';
    var chip = hqRow.querySelector('.chip');
    if(chip) chip.textContent = AGENTS.length + ' агентов';   /* было жёстко «10 агентов» */
  }
}
(function patchProfile(){
  var prev = fn('renderMyProfile');
  if(!prev) return;
  window.renderMyProfile = function(){
    var r;
    try{ r = prev.apply(this, arguments); }catch(e){}
    try{ syncOwnerUi(); }catch(e){}
    return r;
  };
})();

/* ==========================================================================
   12. СТАРТ
   ========================================================================== */
function boot(){
  try{ syncOwnerUi(); }catch(e){}
  /* если админка уже открыта (перерисовка после hot-reload) — перерисуем */
  if(admOpen()){ try{ render(); }catch(e){} }
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else setTimeout(boot, 0);

/* Небольшая отладочная ручка для пробника (не влияет на интерфейс). */
window.okoHq2 = {
  agents: AGENTS, rooms: ROOMS, integrations: INTEG,
  state: function(){ return S; },
  render: render,
  openAgent: function(id){ viewOpen('agent', id); },
  openRoom: function(id){ viewOpen('room', id); },
  closeView: viewClose,
  tabs: TABS.map(function(t){ return t.k; })
};

})();
