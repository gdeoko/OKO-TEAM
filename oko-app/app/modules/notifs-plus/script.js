/* ===== NOTIFS-PLUS: центр уведомлений уровня TG + iOS/Android system =====
   Полный overlay поверх ядра base.html. Не трогает разметку — только
   перекрывает window.renderNotifs / updateNotifDot и chain-патчит
   openNotifs / closeNotifs / notifTap.

   Механики:
     1) Категории-чипы: Всё / Чаты / Партнёрка / Игры / Академия / Система
     2) Группировка (5 новых лайков → тап раскрывает список, iOS-стиль)
     3) Inline-действия: Ответить (textarea), Принять/Отклонить, Оплатить, Открыть
     4) Свайпы: влево → Отклонить, вправо → Прочитано (iOS Mail)
     5) Live-toast стек сверху экрана (slide-in-out 4s, до 3, «закрыть все»)
     6) Расписание "Не беспокоить" (по умолчанию 22:00–08:00) + иконка луны
     7) Приоритеты: Все / Только важные / Тишина — bell-иконка меняется
     8) Бейдж с числом непрочитанных (>99 → «99+»)
     9) Настройки каналов (звук/вибро/превью/бейдж) — persist в localStorage
    10) Демо-поток: реалистичные примеры и авторы, «X мин назад» */

(function(){
  if(typeof NOTIFS==='undefined' || typeof window.renderNotifs!=='function') return;

  /* ================================================================
     STATE + PERSIST
  ================================================================ */
  var LS = 'oko-npx-v2';
  var DEFAULTS = {
    filter:   'all',
    priority: 'all',                 // all | important | silent
    dnd:      { mode:'off', start:'22:00', end:'08:00' }, // off | on | schedule
    channels: { sound:true, vibro:true, preview:true, badge:true },
    read:     {},                    // id -> true (в дополнение к n.unread=false)
    expanded: {}                     // stackKey -> true
  };
  var NPX = (function(){
    try{
      var raw = JSON.parse(localStorage.getItem(LS));
      if(!raw || typeof raw!=='object') return JSON.parse(JSON.stringify(DEFAULTS));
      // merge с дефолтами (миграция)
      return {
        filter:   raw.filter   || DEFAULTS.filter,
        priority: raw.priority || DEFAULTS.priority,
        dnd:      Object.assign({}, DEFAULTS.dnd, raw.dnd||{}),
        channels: Object.assign({}, DEFAULTS.channels, raw.channels||{}),
        read:     raw.read     || {},
        expanded: raw.expanded || {}
      };
    }catch(e){ return JSON.parse(JSON.stringify(DEFAULTS)); }
  })();
  function save(){ try{ localStorage.setItem(LS, JSON.stringify(NPX)); }catch(e){} }

  /* ================================================================
     ХЕЛПЕРЫ
  ================================================================ */
  function _esc(s){
    if(typeof esc==='function') return esc(s==null?'':String(s));
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function _I(n){ return typeof I==='function' ? I(n) : ''; }
  function _toast(m){ if(typeof toast==='function') toast(m); }
  var _uid = 0;
  function nextId(){ return 'n'+(++_uid)+'_'+Date.now().toString(36); }

  /* Категория по иконке / автору. Полностью покрывает демо и живой поток. */
  function catOf(n){
    if(!n) return 'system';
    if(n.cat) return n.cat;
    var who = (n.who||'').toLowerCase();
    var ic  = n.ic || '';
    if(ic==='money' || /партнёрк|партнерк|referral|вывод|выплат/i.test(who)) return 'partner';
    if(/академ|курс|урок|academy|lesson/i.test(who)) return 'academy';
    if(/игр|казино|рулетк|game|дорог/i.test(who))    return 'games';
    if(ic==='chat' || ic==='mic' || /чат|message|сообщ/i.test(who)) return 'chats';
    if(ic==='heart' || ic==='comment' || ic==='star') return 'chats';
    // системные — заявки, подписчики, ролик в топе и т.п.
    return 'system';
  }

  /* Что за inline-действия показать? */
  function actionsFor(n){
    var c = catOf(n);
    var acts = [];
    if(n.ic==='comment' || (c==='chats' && n.ic!=='heart')){
      acts.push({k:'reply', t:'Ответить', ic:'send',   cls:'primary'});
    }
    if(n.ic==='briefcase' || n.ic==='users'){
      acts.push({k:'accept', t:'Принять',   ic:'check', cls:'primary'});
      acts.push({k:'reject', t:'Отклонить', ic:'plus',  cls:'danger', rot:45});
    }
    if(n.ic==='money' && /счёт|счет|оплат|invoice/i.test(n.t||'')){
      acts.push({k:'pay',   t:'Оплатить', ic:'money', cls:'primary'});
    }
    if(n.ic==='rocket' || n.ic==='star'){
      acts.push({k:'open',  t:'Открыть',  ic:'back',  cls:'ghost', rot:180});
    }
    if(n.ic==='heart'){
      acts.push({k:'openPost', t:'Открыть пост', ic:'heart', cls:'ghost'});
    }
    // Если ничего не подошло — универсальное «Открыть»
    if(!acts.length) acts.push({k:'open', t:'Открыть', ic:'back', cls:'ghost', rot:180});
    return acts;
  }

  /* Расписание DND: активен ли режим сейчас? */
  function inSchedule(){
    var d = NPX.dnd; if(!d || d.mode!=='schedule') return false;
    var now = new Date();
    var cur = now.getHours()*60 + now.getMinutes();
    var s = parseHM(d.start), e = parseHM(d.end);
    if(s==null||e==null) return false;
    if(s===e) return false;
    if(s < e) return cur>=s && cur<e;              // 08:00–22:00
    return cur>=s || cur<e;                        // ночное окно 22:00–08:00
  }
  function parseHM(x){
    var m = /^(\d{1,2}):(\d{2})$/.exec(x||''); if(!m) return null;
    var h=+m[1], mn=+m[2]; if(h>23||mn>59) return null; return h*60+mn;
  }
  function dndActive(){
    if(!NPX.dnd) return false;
    if(NPX.dnd.mode==='on') return true;
    if(NPX.dnd.mode==='schedule') return inSchedule();
    return false;
  }
  function isSilent(){ return NPX.priority==='silent' || dndActive(); }

  /* Определяем «важное» уведомление: partner (деньги), заявки, счета,
     топ-охваты. Лайки и подписки — не важные. */
  function isImportant(n){
    var c = catOf(n);
    if(c==='partner') return true;
    if(n.ic==='briefcase') return true;
    if(/счёт|счет|оплат|invoice|вывод/i.test(n.t||'')) return true;
    if(n.ic==='rocket') return true;
    return false;
  }

  /* ================================================================
     ПОДГОТОВКА NOTIFS (id + мета) + ДЕМО-ЗАСЕВ
  ================================================================ */
  function ensureIds(){
    NOTIFS.forEach(function(n){
      if(!n.id) n.id = nextId();
      if(!n.cat) n.cat = catOf(n);
    });
  }
  var SEEDED = false;
  function seedDemo(){
    if(SEEDED) return; SEEDED = true;
    // Дозасев: чтобы все категории имели живой пример.
    var haveCat = {};
    NOTIFS.forEach(function(n){ haveCat[catOf(n)] = true; });
    var add = [];
    if(!haveCat.chats) add.push(
      {ic:'chat',    who:'Маша С.',       t:'написала: «Привет! Ты видел новую сборку?»',           time:'6 мин',  g:'Сегодня', unread:true},
      {ic:'mic',     who:'Костя Р.',      t:'прислал голосовое 0:34',                                time:'22 мин', g:'Сегодня', unread:true}
    );
    if(!haveCat.games) add.push(
      {ic:'rocket',  who:'OKO Игры',      t:'ежедневный бонус +50 монет уже ждёт в Рулетке',         time:'1 ч',    g:'Сегодня', unread:true, cat:'games'},
      {ic:'star',    who:'OKO Дорога',    t:'ты в топ-10 недели — награда +200 монет',               time:'вчера',  g:'Ранее',   unread:false, cat:'games'}
    );
    if(!haveCat.academy) add.push(
      {ic:'star',    who:'Академия OKO',  t:'новый урок «Хук за 3 секунды» открыт для тебя',         time:'35 мин', g:'Сегодня', unread:true, cat:'academy', act:function(){ if(typeof showTab==='function'){ showTab('mini'); if(typeof openMa==='function') openMa('academy'); } }},
      {ic:'star',    who:'Академия OKO',  t:'сертификат «Reels-магистр» готов к скачиванию',         time:'2 ч',    g:'Сегодня', unread:false, cat:'academy'}
    );
    if(!haveCat.partner) add.push(
      {ic:'money',   who:'Партнёрка',     t:'счёт на вывод $124.80 сформирован — оплатим за 24 ч',   time:'18 мин', g:'Сегодня', unread:true}
    );
    // Несколько лайков подряд — покажем группировку
    add.push(
      {ic:'heart',   who:'Оля Т.',        t:'оценила твой пост «Как я убрал 90% ручного монтажа»',   time:'8 мин',  g:'Сегодня', unread:true},
      {ic:'heart',   who:'Никита В.',     t:'оценил твой пост «Как я убрал 90% ручного монтажа»',    time:'11 мин', g:'Сегодня', unread:true},
      {ic:'heart',   who:'Женя А.',       t:'оценил твой пост «Как я убрал 90% ручного монтажа»',    time:'12 мин', g:'Сегодня', unread:true}
    );
    // Заявка в чат/канал — accept/reject
    add.push(
      {ic:'users',   who:'Гриша Л.',      t:'просит вступить в закрытый канал «OKO инсайды»',        time:'14 мин', g:'Сегодня', unread:true, cat:'system'}
    );
    // Достижение
    add.push(
      {ic:'rocket',  who:'OKO',           t:'ты получил ачивку «100 постов» — держи +1000 монет',    time:'25 мин', g:'Сегодня', unread:true, cat:'system'}
    );
    NOTIFS.push.apply(NOTIFS, add);
    ensureIds();
  }

  /* ================================================================
     ЖИВОЙ ПОТОК (dozarazhda дозасев для демо)
  ================================================================ */
  var LIVE_POOL = [
    {ic:'heart',    who:'Даня П.',        t:'оценил твой пост'},
    {ic:'heart',    who:'Соня К.',        t:'оценила твой пост'},
    {ic:'comment',  who:'Ксюша Р.',       t:'ответила: «согласна, беру в работу»'},
    {ic:'comment',  who:'Влад Н.',        t:'прокомментировал: «а по срокам как?»'},
    {ic:'briefcase',who:'Биржа OKO',      t:'новая заявка по услуге «Монтаж Reels»'},
    {ic:'users',    who:'+2 подписчика',  t:'подписались на твой канал'},
    {ic:'money',    who:'Партнёрка',      t:'начисление +$12.40 за оплату PRO'},
    {ic:'money',    who:'Партнёрка',      t:'начисление +$7.90 за оплату START'},
    {ic:'star',     who:'Аня М.',         t:'поставила 5 звёзд за услугу'},
    {ic:'chat',     who:'Иван Т.',        t:'написал: «Можешь глянуть черновик?»'},
    {ic:'mic',      who:'Лера О.',        t:'прислала голосовое 0:47'},
    {ic:'rocket',   who:'OKO',            t:'твой ролик вошёл в топ дня'},
    {ic:'star',     who:'Академия OKO',   t:'урок «Свет за 60 секунд» доступен'},
    {ic:'rocket',   who:'OKO Игры',       t:'сегодняшний куш вырос до 5000 монет'}
  ];
  var liveT = null;
  function livePush(){
    var view = document.getElementById('notifsView'); if(!view) return;
    if(!view.classList.contains('open')) return;
    var p = LIVE_POOL[Math.floor(Math.random()*LIVE_POOL.length)];
    var n = {id:nextId(), ic:p.ic, who:p.who, t:p.t, time:'только что', g:'Сегодня', unread:true, act:function(){}};
    n.cat = catOf(n);
    NOTIFS.unshift(n);
    if(typeof updateNotifDot==='function') updateNotifDot();
    window.renderNotifs();
    var first = document.querySelector('#notifsBody .np-row');
    if(first){
      first.classList.add('np-bounce');
      setTimeout(function(){ first.classList.remove('np-bounce'); }, 800);
    }
  }
  function liveStart(){
    if(liveT) return;
    var tick = function(){
      livePush();
      liveT = setTimeout(tick, 24000 + Math.random()*22000);
    };
    liveT = setTimeout(tick, 18000 + Math.random()*10000);
  }
  function liveStop(){ if(liveT){ clearTimeout(liveT); liveT = null; } }

  /* ================================================================
     LIVE-TOAST-СТЕК (top-of-screen, до 3, 4s auto-close)
  ================================================================ */
  function ensureStack(){
    var st = document.getElementById('np-live-stack');
    if(st) return st;
    st = document.createElement('div');
    st.id = 'np-live-stack';
    document.body.appendChild(st);
    return st;
  }
  function iconTone(ic){
    if(ic==='heart') return 'tone-heart';
    if(ic==='star')  return 'tone-star';
    if(ic==='comment' || ic==='chat' || ic==='mic') return 'tone-comment';
    if(ic==='money') return 'tone-money';
    return '';
  }
  function pushLive(n){
    if(isSilent()) return;                         // тихо
    if(NPX.priority==='important' && !isImportant(n)) return;
    var stack = ensureStack();
    // ограничить до 3
    var live = stack.querySelectorAll('.np-live');
    if(live.length >= 3) removeLive(live[0]);
    // «закрыть все» появляется, когда 2+ живых уведомлений
    ensureAllBtn();

    var el = document.createElement('div');
    el.className = 'np-live';
    var preview = NPX.channels.preview !== false;
    el.innerHTML =
      '<span class="np-live-ic '+iconTone(n.ic)+'"><svg class="i"><use href="#i-'+(n.ic||'bell')+'"/></svg></span>'+
      '<div class="np-live-b">'+
        '<b>'+_esc(n.who||'OKO')+'</b>'+
        (preview
          ? '<span>'+_esc(n.t||'')+'</span>'
          : '<span>Новое уведомление</span>')+
      '</div>'+
      '<button type="button" class="np-live-x" aria-label="Закрыть">'+
        '<svg class="i" style="transform:rotate(45deg)"><use href="#i-plus"/></svg>'+
      '</button>';
    stack.insertBefore(el, stack.firstChild);
    // slide-in
    requestAnimationFrame(function(){ el.classList.add('show'); });
    // auto-close 4s
    var timer = setTimeout(function(){ removeLive(el); }, 4000);
    // тап по телу → открыть центр уведомлений
    el.addEventListener('click', function(ev){
      if(ev.target.closest && ev.target.closest('.np-live-x')){
        ev.preventDefault(); ev.stopPropagation();
        clearTimeout(timer); removeLive(el); return;
      }
      clearTimeout(timer); removeLive(el);
      if(typeof openNotifs==='function') openNotifs();
    });
  }
  function removeLive(el){
    if(!el || !el.parentNode) return;
    el.classList.remove('show'); el.classList.add('hide');
    setTimeout(function(){
      if(el.parentNode) el.parentNode.removeChild(el);
      // если пусто — снять «закрыть все»
      var stack = document.getElementById('np-live-stack');
      if(stack && !stack.querySelector('.np-live')){
        var all = stack.querySelector('.np-live-all');
        if(all) all.parentNode.removeChild(all);
      } else ensureAllBtn();
    }, 240);
  }
  function ensureAllBtn(){
    var stack = document.getElementById('np-live-stack'); if(!stack) return;
    var live = stack.querySelectorAll('.np-live');
    var existing = stack.querySelector('.np-live-all');
    if(live.length >= 2 && !existing){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'np-live-all';
      b.textContent = 'Закрыть все';
      b.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        stack.querySelectorAll('.np-live').forEach(removeLive);
      });
      stack.appendChild(b);
    } else if(live.length < 2 && existing){
      existing.parentNode.removeChild(existing);
    }
  }

  /* ================================================================
     СЧЁТЧИК-БЕЙДЖ ПОВЕРХ #notifDot + СИНХРОНИЗАЦИЯ ИКОНКИ КОЛОКОЛА
  ================================================================ */
  var _baseUpdateDot = window.updateNotifDot;
  window.updateNotifDot = function(){
    var dot = document.getElementById('notifDot'); if(!dot) return;
    var count = NOTIFS.filter(function(x){ return x.unread; }).length;
    if(NPX.priority==='important'){
      count = NOTIFS.filter(function(x){ return x.unread && isImportant(x); }).length;
    }
    dot.classList.add('np-count');
    dot.classList.toggle('on', count>0 && NPX.channels.badge!==false);
    dot.textContent = count>99 ? '99+' : (count>0 ? String(count) : '');
    // расцветка по режиму
    dot.classList.toggle('np-only-imp', NPX.priority==='important');
    dot.classList.toggle('np-silent',   NPX.priority==='silent' || dndActive());
    // сама кнопка-колокол
    var btn = document.querySelector('.notif-btn');
    if(btn){
      btn.classList.toggle('np-mode-silent',    NPX.priority==='silent' || dndActive());
      btn.classList.toggle('np-mode-important', NPX.priority==='important');
      // подмена иконки колокольчика на луну при DND/silent
      var svg = btn.querySelector('svg.i use');
      if(svg){
        var want = (NPX.priority==='silent' || dndActive()) ? '#i-moon' : '#i-bell';
        if(svg.getAttribute('href') !== want) svg.setAttribute('href', want);
      }
    }
    // если бейдж отключён — скрываем полностью
    if(NPX.channels.badge===false){ dot.classList.remove('on'); dot.textContent=''; }
  };

  /* ================================================================
     РЕНДЕР ЦЕНТРА УВЕДОМЛЕНИЙ (полный override)
  ================================================================ */
  function timeMinutes(t){
    t = (t||'').trim();
    if(/только что|сейчас/i.test(t)) return 0;
    var m = t.match(/(\d+)\s*мин/); if(m) return +m[1];
    var h = t.match(/(\d+)\s*ч/);  if(h) return +h[1]*60;
    var d = t.match(/(\d+)\s*д/);  if(d) return +d[1]*1440;
    if(/вчера/i.test(t)) return 1440;
    if(/недел/i.test(t)) return 10080;
    return 99999;
  }

  function renderItem(n, small){
    var cat  = catOf(n);
    var brand = /OKO|Партнёрк|Биржа|подписчик|Академ|Систем/i.test(n.who||'');
    var badgeCls = (['heart','star','comment'].indexOf(n.ic)>-1) ? ' b-'+n.ic : '';
    var icon = brand
      ? '<span class="nt-ic">'+_I(n.ic)+'</span>'
      : '<span class="nt-ava">'+_esc((n.who||'?').trim().charAt(0).toUpperCase())+
        '<i class="nt-badge'+badgeCls+'">'+_I(n.ic)+'</i></span>';

    var acts = actionsFor(n);
    var actHtml = '';
    if(!small && acts.length){
      actHtml = '<span class="np-quick">' + acts.map(function(a){
        var svg = '<svg class="i"'+(a.rot?' style="transform:rotate('+a.rot+'deg)"':'')+'><use href="#i-'+(a.ic||'star')+'"/></svg>';
        return '<span class="np-q '+(a.cls||'')+'" data-a="'+a.k+'">'+svg+' '+_esc(a.t)+'</span>';
      }).join('') + '</span>';
    }
    var replyHtml = '';
    if(!small && acts.some(function(a){ return a.k==='reply'; })){
      replyHtml =
        '<div class="np-reply">'+
          '<textarea placeholder="Ответить '+_esc(n.who||'')+'…"></textarea>'+
          '<div class="np-reply-row">'+
            '<span class="np-q ghost" data-a="reply-cancel">Отмена</span>'+
            '<span class="np-q primary" data-a="reply-send"><svg class="i"><use href="#i-send"/></svg> Отправить</span>'+
          '</div>'+
        '</div>';
    }

    return '<button class="nt-item '+(n.unread?'unread':'')+'" type="button" data-tap="1">'+
      icon+
      '<div class="nt-b">'+
        '<span><b>'+_esc(n.who||'')+'</b> '+_esc(n.t||'')+'</span>'+
        '<small>'+_esc(n.time||'')+'</small>'+
        actHtml + replyHtml +
      '</div>'+
      (n.unread?'<i class="nt-dot"></i>':'')+
    '</button>';
  }

  function renderRow(n, extraCls){
    var html =
      '<div class="np-row '+(extraCls||'')+'" data-id="'+_esc(n.id)+'" data-cat="'+_esc(catOf(n))+'">'+
        '<div class="np-actions-r"><span class="np-act read" data-a="read">'+
          '<svg class="i"><use href="#i-check"/></svg> Прочитано</span></div>'+
        '<div class="np-actions"><span class="np-act del" data-a="del">'+
          '<svg class="i" style="transform:rotate(45deg)"><use href="#i-plus"/></svg> Отклонить</span></div>'+
        '<div class="np-swipe">'+ renderItem(n, false) +'</div>'+
      '</div>';
    return html;
  }
  function renderSubItem(n){
    return '<div class="np-row" data-id="'+_esc(n.id)+'" data-cat="'+_esc(catOf(n))+'">'+
      '<div class="np-swipe">'+ renderItem(n, true) +'</div>'+
    '</div>';
  }

  /* Ключ группировки: категория+иконка+день (только когда >=3 подряд по одной теме) */
  function stackKey(n){ return catOf(n)+':'+n.ic+':'+(n.g||''); }

  function renderAll(){
    ensureIds();
    var body = document.getElementById('notifsBody'); if(!body) return;

    // 1) фильтр по категории и приоритету
    var visible = NOTIFS.filter(function(n){
      if(NPX.filter !== 'all' && catOf(n) !== NPX.filter) return false;
      if(NPX.priority === 'important' && !isImportant(n)) return false;
      return true;
    });

    // 2) сортировка внутри групп по свежести
    var groups = {};
    var order  = [];
    visible.forEach(function(n){
      var g = n.g || 'Ранее';
      if(!groups[g]){ groups[g] = []; order.push(g); }
      groups[g].push(n);
    });
    order.forEach(function(g){
      groups[g].sort(function(a,b){ return timeMinutes(a.time) - timeMinutes(b.time); });
    });

    // 3) сборка HTML со стеками (одинаковые темы >=3 → collapsed)
    var html = '';
    order.forEach(function(g){
      var items = groups[g];
      html += '<p class="nt-group">'+_esc(g)+'</p>';
      // группировка одинаковых
      var i = 0;
      while(i < items.length){
        var n = items[i];
        var key = stackKey(n);
        // соберём подряд идущие с тем же ключом
        var run = [n]; var j = i+1;
        while(j < items.length && stackKey(items[j]) === key){ run.push(items[j]); j++; }
        if(run.length >= 3){
          // делаем группу
          var top = run[0];
          var expanded = !!NPX.expanded[key];
          // клон верхнего с обогащённым текстом
          var topClone = Object.assign({}, top);
          var kind = kindLabel(top);
          topClone.t = 'и ещё '+(run.length-1)+' — '+kind;
          // рендерим стек
          html += renderRow(topClone, 'np-stack'+(expanded?' np-expanded':'')) ;
          // и подстек — все элементы (включая верхний тоже, чтобы клик по стеку раскрывал полный список)
          var sub = run.map(renderSubItem).join('');
          html += '<div class="np-substack" data-stack="'+_esc(key)+'">'+sub+'</div>';
          // сразу после — вставим data-key на .np-row чтобы найти при клике
          i = j;
        } else {
          run.forEach(function(x){ html += renderRow(x); });
          i = j;
        }
      }
    });

    if(!html){
      html =
        '<div class="np-empty">'+
          '<svg class="i"><use href="#i-bell"/></svg>'+
          '<b>Пока тихо</b>'+
          (NPX.filter!=='all'
            ? 'В категории «'+chipLabel(NPX.filter)+'» ничего нет.<br>Попробуй фильтр «Всё».'
            : 'Тут появятся лайки, заявки, начисления и уроки.')+
        '</div>';
    }
    body.innerHTML = html;

    ensureHead();
    ensureSettings();
    bindItems();
    updateChipCounts();
    updateHint();
    if(typeof updateNotifDot==='function') updateNotifDot();
  }

  function kindLabel(n){
    if(n.ic==='heart') return 'лайков к твоим постам';
    if(n.ic==='comment') return 'комментариев';
    if(n.ic==='users') return 'новых подписчиков и заявок';
    if(n.ic==='briefcase') return 'заявок на бирже';
    if(n.ic==='money') return 'начислений партнёрки';
    if(n.ic==='star') return 'оценок и достижений';
    return 'событий';
  }
  function chipLabel(k){
    for(var i=0;i<CATS.length;i++) if(CATS[i].k===k) return CATS[i].t;
    return k;
  }

  /* ================================================================
     ШАПКА: DND-кнопка, кнопка настроек, чипы, hint
  ================================================================ */
  var CATS = [
    {k:'all',      t:'Всё'},
    {k:'chats',    t:'Чаты'},
    {k:'partner',  t:'Партнёрка'},
    {k:'games',    t:'Игры'},
    {k:'academy',  t:'Академия'},
    {k:'system',   t:'Система'}
  ];
  function ensureHead(){
    var view = document.getElementById('notifsView'); if(!view) return;
    var head = view.querySelector('.sv-head');

    // группа кнопок в шапке (DND + Настройки + «Прочитать»)
    if(head && !head.querySelector('.np-headx')){
      var done = head.querySelector('.ep-done');
      var wrap = document.createElement('div');
      wrap.className = 'np-headx';

      // DND
      var dnd = document.createElement('button');
      dnd.type='button'; dnd.className='np-hb'; dnd.title='Тихий режим';
      dnd.setAttribute('aria-label','Тихий режим');
      dnd.innerHTML = '<svg class="i"><use href="#i-moon"/></svg>';
      dnd.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        NPX.dnd.mode = (NPX.dnd.mode==='off' ? 'on' : 'off'); save();
        syncModes();
        _toast(NPX.dnd.mode==='on' ? 'Тихий режим включён' : 'Тихий режим выключен');
      });

      // Настройки-панель (шестерёнка = «⋯»)
      var cog = document.createElement('button');
      cog.type='button'; cog.className='np-hb'; cog.title='Настройки уведомлений';
      cog.setAttribute('aria-label','Настройки уведомлений');
      cog.innerHTML = '<svg class="i"><use href="#i-more"/></svg>';
      cog.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        view.classList.toggle('np-settings-on');
      });

      wrap.appendChild(dnd);
      wrap.appendChild(cog);
      if(done){ head.insertBefore(wrap, done); wrap.appendChild(done); }
      else head.appendChild(wrap);
    }

    // строка-подсказка (появляется если DND/silent активен)
    if(view && !view.querySelector('.np-modehint')){
      var hint = document.createElement('div');
      hint.className = 'np-modehint';
      view.appendChild(hint);
      var body = document.getElementById('notifsBody');
      if(body) view.insertBefore(hint, body);
    }

    // чипы фильтра
    var body = document.getElementById('notifsBody');
    if(body && !view.querySelector('.np-chips')){
      var bar = document.createElement('div');
      bar.className = 'np-chips';
      bar.innerHTML = CATS.map(function(c){
        return '<button type="button" class="np-chip '+(NPX.filter===c.k?'on':'')+
          '" data-k="'+c.k+'">'+_esc(c.t)+
          '<span class="np-chip-c" data-c="'+c.k+'">0</span></button>';
      }).join('');
      bar.addEventListener('click', function(e){
        var b = e.target.closest && e.target.closest('.np-chip'); if(!b) return;
        NPX.filter = b.dataset.k; save();
        bar.querySelectorAll('.np-chip').forEach(function(x){
          x.classList.toggle('on', x.dataset.k===NPX.filter);
        });
        renderAll();
      });
      view.insertBefore(bar, body);
    }
    syncModes();
  }

  function syncModes(){
    var view = document.getElementById('notifsView'); if(!view) return;
    var dndOn = dndActive();
    view.classList.toggle('np-mode-dnd',     dndOn);
    view.classList.toggle('np-mode-silent',  NPX.priority==='silent');
    view.classList.toggle('np-mode-imp',     NPX.priority==='important');
    var btn = view.querySelector('.np-hb[title="Тихий режим"]');
    if(btn) btn.classList.toggle('on', dndOn);
    if(typeof updateNotifDot==='function') updateNotifDot();
  }

  function updateHint(){
    var view = document.getElementById('notifsView'); if(!view) return;
    var hint = view.querySelector('.np-modehint'); if(!hint) return;
    var on = false, txt = '';
    if(NPX.priority==='silent'){ on = true; txt = 'Режим «Тишина» — уведомления только в центре, без всплывающих'; }
    else if(NPX.dnd.mode==='on'){ on = true; txt = 'Тихий режим включён — уведомления придут беззвучно'; }
    else if(NPX.dnd.mode==='schedule' && inSchedule()){
      on = true;
      txt = 'Расписание «Не беспокоить» ('+NPX.dnd.start+'–'+NPX.dnd.end+') — сейчас тихо';
    } else if(NPX.priority==='important'){
      on = true; txt = 'Показываются только важные — деньги, заявки, счета';
    }
    if(on) hint.innerHTML = '<svg class="i"><use href="#i-moon"/></svg><span>'+_esc(txt)+'</span>';
    view.classList.toggle('np-hint-on', on);
  }

  function updateChipCounts(){
    var view = document.getElementById('notifsView'); if(!view) return;
    var counts = { all:0, chats:0, partner:0, games:0, academy:0, system:0 };
    NOTIFS.forEach(function(n){
      if(!n.unread) return;
      counts.all++;
      var c = catOf(n); if(counts[c]!=null) counts[c]++;
    });
    view.querySelectorAll('.np-chip-c').forEach(function(el){
      var k = el.dataset.c;
      var c = counts[k]||0;
      el.textContent = c>99 ? '99+' : String(c);
      el.style.display = c>0 ? 'inline-block' : 'none';
    });
  }

  /* ================================================================
     ПАНЕЛЬ НАСТРОЕК (внутри экрана уведомлений)
  ================================================================ */
  function ensureSettings(){
    var view = document.getElementById('notifsView'); if(!view) return;
    if(view.querySelector('.np-settings')) { syncSettingsUI(); return; }
    var chips = view.querySelector('.np-chips'); if(!chips) return;

    var box = document.createElement('div');
    box.className = 'np-settings';
    box.innerHTML =
      '<div class="np-sec-title">Приоритет</div>'+
      '<div class="np-seg" data-seg="prio">'+
        '<button type="button" data-v="all"><svg class="i"><use href="#i-bell"/></svg> Все</button>'+
        '<button type="button" data-v="important" class="warn"><svg class="i"><use href="#i-star"/></svg> Только важные</button>'+
        '<button type="button" data-v="silent"    class="danger"><svg class="i"><use href="#i-moon"/></svg> Тишина</button>'+
      '</div>'+

      '<div class="np-sec-title">Не беспокоить</div>'+
      '<div class="np-seg" data-seg="dnd">'+
        '<button type="button" data-v="off">Выкл</button>'+
        '<button type="button" data-v="on">Всегда</button>'+
        '<button type="button" data-v="schedule">По расписанию</button>'+
      '</div>'+
      '<div class="np-dnd-row">'+
        '<div class="np-dnd-times">'+
          '<span>С</span>'+
          '<input type="time" class="np-dnd-start" value="'+_esc(NPX.dnd.start)+'">'+
          '<span>до</span>'+
          '<input type="time" class="np-dnd-end"   value="'+_esc(NPX.dnd.end)+'">'+
        '</div>'+
      '</div>'+

      '<div class="np-sec-title">Каналы доставки</div>'+
      '<div class="np-toggles">'+
        toggleRow('sound',   'volume',    'Звук уведомлений',   'Короткий сигнал при новом событии') +
        toggleRow('vibro',   'mic',       'Вибрация',           'Вибро на мобильных, где поддерживается') +
        toggleRow('preview', 'eye',       'Показывать превью',  'Текст уведомления в живом всплывании') +
        toggleRow('badge',   'bell',      'Значок с цифрой',    'Бейдж непрочитанных на иконке колокольчика') +
      '</div>';

    view.insertBefore(box, chips.nextSibling);

    // segment controls
    box.querySelectorAll('.np-seg').forEach(function(seg){
      seg.addEventListener('click', function(e){
        var b = e.target.closest && e.target.closest('button'); if(!b) return;
        var kind = seg.dataset.seg;
        var v = b.dataset.v;
        if(kind==='prio'){ NPX.priority = v; }
        else if(kind==='dnd'){ NPX.dnd.mode = v; }
        save(); syncSettingsUI(); syncModes(); updateHint();
        renderAll();
      });
    });
    // times
    box.querySelector('.np-dnd-start').addEventListener('change', function(e){
      NPX.dnd.start = e.target.value || '22:00'; save(); syncModes(); updateHint();
    });
    box.querySelector('.np-dnd-end').addEventListener('change', function(e){
      NPX.dnd.end = e.target.value || '08:00'; save(); syncModes(); updateHint();
    });
    // toggles
    box.querySelectorAll('.np-sw').forEach(function(sw){
      sw.addEventListener('click', function(){
        var k = sw.dataset.k;
        NPX.channels[k] = !NPX.channels[k]; save();
        sw.classList.toggle('on', !!NPX.channels[k]);
        if(k==='badge' && typeof updateNotifDot==='function') updateNotifDot();
      });
    });

    syncSettingsUI();
  }
  function toggleRow(k, ic, title, sub){
    var on = NPX.channels[k] !== false;
    return ''+
      '<div class="np-toggle">'+
        '<div class="np-toggle-l">'+
          '<svg class="i"><use href="#i-'+_esc(ic)+'"/></svg>'+
          '<div class="np-toggle-t"><b>'+_esc(title)+'</b><small>'+_esc(sub)+'</small></div>'+
        '</div>'+
        '<div class="np-sw '+(on?'on':'')+'" data-k="'+_esc(k)+'" role="switch" aria-checked="'+on+'"></div>'+
      '</div>';
  }
  function syncSettingsUI(){
    var box = document.querySelector('.np-settings'); if(!box) return;
    box.querySelectorAll('.np-seg').forEach(function(seg){
      var kind = seg.dataset.seg;
      var v = kind==='prio' ? NPX.priority : NPX.dnd.mode;
      seg.querySelectorAll('button').forEach(function(b){
        b.classList.toggle('on', b.dataset.v===v);
      });
    });
    var s = box.querySelector('.np-dnd-start'); if(s) s.value = NPX.dnd.start;
    var e = box.querySelector('.np-dnd-end');   if(e) e.value = NPX.dnd.end;
    box.querySelectorAll('.np-sw').forEach(function(sw){
      sw.classList.toggle('on', NPX.channels[sw.dataset.k] !== false);
    });
  }

  /* ================================================================
     БИНДЫ: клики (действия / стек), свайпы
  ================================================================ */
  function findNotifById(id){
    for(var i=0;i<NOTIFS.length;i++) if(NOTIFS[i].id===id) return {n:NOTIFS[i], i:i};
    return null;
  }

  function bindItems(){
    var body = document.getElementById('notifsBody'); if(!body) return;

    // Клики по строкам / действиям / стеку
    body.addEventListener('click', bodyClick, false);

    // Свайпы
    body.querySelectorAll('.np-row').forEach(function(row){
      var swipe = row.querySelector('.np-swipe'); if(!swipe) return;
      if(swipe.__np_bound) return; swipe.__np_bound = true;
      var sx=0, sy=0, dx=0, live=false, lock=null, startOpen='';
      swipe.addEventListener('touchstart', function(e){
        var t = e.touches[0]; sx=t.clientX; sy=t.clientY; dx=0; live=true; lock=null;
        startOpen = row.classList.contains('np-open') ? 'l' : row.classList.contains('np-open-r') ? 'r' : '';
        // закрыть остальные
        document.querySelectorAll('.np-row.np-open,.np-row.np-open-r').forEach(function(r){
          if(r!==row){ r.classList.remove('np-open'); r.classList.remove('np-open-r'); }
        });
      }, {passive:true});
      swipe.addEventListener('touchmove', function(e){
        if(!live) return;
        var t = e.touches[0]; var cx = t.clientX - sx, cy = t.clientY - sy;
        if(lock===null){
          if(Math.abs(cx) < 6 && Math.abs(cy) < 6) return;
          lock = Math.abs(cx) > Math.abs(cy)*1.4 ? 'x' : 'y';
        }
        if(lock!=='x'){ live=false; swipe.style.transform=''; return; }
        var base = 0;
        if(startOpen==='l') base = -140;
        else if(startOpen==='r') base = 140;
        dx = Math.max(-160, Math.min(160, cx + base));
        swipe.style.transform = 'translateX('+dx+'px)';
      }, {passive:true});
      swipe.addEventListener('touchend', function(){
        if(!live) return; live = false;
        swipe.style.transform = '';
        row.classList.remove('np-open'); row.classList.remove('np-open-r');
        if(dx < -70) row.classList.add('np-open');
        else if(dx > 70) row.classList.add('np-open-r');
      });
    });
  }

  function bodyClick(e){
    // если открыт свайп — первый клик закрывает
    var open = document.querySelector('.np-row.np-open, .np-row.np-open-r');
    if(open && !e.target.closest('.np-actions, .np-actions-r, .np-q, textarea, .np-reply-row')){
      var isSame = e.target.closest && e.target.closest('.np-row') === open;
      if(isSame){
        e.preventDefault(); e.stopPropagation();
        open.classList.remove('np-open'); open.classList.remove('np-open-r');
        return;
      }
    }
    var row = e.target.closest && e.target.closest('.np-row'); if(!row) return;

    // клик по свайп-action
    var swAct = e.target.closest && e.target.closest('.np-act');
    if(swAct){
      e.preventDefault(); e.stopPropagation();
      var id = row.dataset.id, r = findNotifById(id);
      if(!r){ row.classList.remove('np-open'); row.classList.remove('np-open-r'); return; }
      if(swAct.dataset.a === 'read'){
        r.n.unread = false;
        window.renderNotifs(); _toast('Отмечено прочитанным');
      } else if(swAct.dataset.a === 'del'){
        NOTIFS.splice(r.i, 1);
        window.renderNotifs(); _toast('Уведомление удалено');
      }
      return;
    }

    // inline-action (np-q)
    var q = e.target.closest && e.target.closest('.np-q');
    if(q){
      e.preventDefault(); e.stopPropagation();
      var id2 = row.dataset.id, rr = findNotifById(id2); if(!rr) return;
      var a = q.dataset.a;
      if(a === 'reply'){
        row.classList.add('np-reply-on');
        var ta = row.querySelector('.np-reply textarea');
        if(ta){ setTimeout(function(){ ta.focus(); }, 60); }
        return;
      }
      if(a === 'reply-cancel'){ row.classList.remove('np-reply-on'); return; }
      if(a === 'reply-send'){
        var text = (row.querySelector('.np-reply textarea')||{}).value || '';
        if(!text.trim()){ _toast('Пустое сообщение'); return; }
        row.classList.remove('np-reply-on');
        rr.n.unread = false;
        window.renderNotifs(); _toast('Ответ отправлен');
        return;
      }
      if(a === 'accept'){
        rr.n.unread = false;
        window.renderNotifs(); _toast('Заявка принята');
        return;
      }
      if(a === 'reject'){
        NOTIFS.splice(rr.i, 1);
        window.renderNotifs(); _toast('Заявка отклонена');
        return;
      }
      if(a === 'pay'){
        rr.n.unread = false;
        if(typeof closeNotifs==='function') closeNotifs();
        if(typeof showTab==='function') showTab('wallet');
        _toast('Открываем оплату');
        return;
      }
      if(a === 'openPost'){
        rr.n.unread = false;
        if(typeof closeNotifs==='function') closeNotifs();
        if(typeof showTab==='function') showTab('feed');
        return;
      }
      if(a === 'open'){
        rr.n.unread = false;
        if(typeof closeNotifs==='function') closeNotifs();
        if(typeof rr.n.act === 'function') rr.n.act();
        return;
      }
    }

    // тап по стеку → раскрыть/свернуть
    if(row.classList.contains('np-stack')){
      var sub = row.nextElementSibling;
      if(sub && sub.classList.contains('np-substack')){
        var key = sub.dataset.stack;
        NPX.expanded[key] = !row.classList.contains('np-expanded');
        save();
        row.classList.toggle('np-expanded', !!NPX.expanded[key]);
        return;
      }
    }

    // обычный тап по кнопке уведомления
    var btn = e.target.closest && e.target.closest('.nt-item');
    if(btn){
      var id3 = row.dataset.id, rrr = findNotifById(id3); if(!rrr) return;
      // если стек — то это уже обработано выше как раскрытие
      if(row.classList.contains('np-stack')) return;
      rrr.n.unread = false;
      if(typeof closeNotifs==='function') closeNotifs();
      if(typeof rrr.n.act === 'function') rrr.n.act();
    }
  }

  /* ================================================================
     ОВЕРРАЙД window.renderNotifs / chain: openNotifs / closeNotifs
  ================================================================ */
  seedDemo();
  window.renderNotifs = renderAll;

  var _open = window.openNotifs;
  window.openNotifs = function(){
    _open.apply(this, arguments);
    ensureHead();
    ensureSettings();
    liveStart();
    if(typeof updateNotifDot==='function') updateNotifDot();
  };
  var _close = window.closeNotifs;
  window.closeNotifs = function(){
    _close.apply(this, arguments);
    liveStop();
    document.querySelectorAll('.np-row.np-open, .np-row.np-open-r').forEach(function(r){
      r.classList.remove('np-open'); r.classList.remove('np-open-r');
    });
  };

  // notifTap — базовый ядра всё ещё вызывается по HTML-атрибуту, но
  // наши элементы больше не имеют onclick="notifTap(i)", так что chain
  // остаётся для совместимости.
  var _tap = window.notifTap;
  window.notifTap = function(){
    var openRow = document.querySelector('.np-row.np-open, .np-row.np-open-r');
    if(openRow){
      openRow.classList.remove('np-open');
      openRow.classList.remove('np-open-r');
      return;
    }
    _tap.apply(this, arguments);
  };

  /* ================================================================
     GLOBAL LIVE-FEED «стука в дверь» (даже если центр закрыт)
     — реалистично показываем всплывающие сверху раз в 45–90 сек
  ================================================================ */
  var globalT = null;
  function globalTick(){
    if(!isSilent() && document.visibilityState !== 'hidden'){
      var p = LIVE_POOL[Math.floor(Math.random()*LIVE_POOL.length)];
      var n = {id:nextId(), ic:p.ic, who:p.who, t:p.t, time:'только что', g:'Сегодня', unread:true, act:function(){}};
      n.cat = catOf(n);
      NOTIFS.unshift(n);
      if(typeof updateNotifDot==='function') updateNotifDot();
      pushLive(n);
      // если центр открыт — обновим список
      var view = document.getElementById('notifsView');
      if(view && view.classList.contains('open')) window.renderNotifs();
    }
    globalT = setTimeout(globalTick, 45000 + Math.random()*45000);
  }
  function startGlobal(){
    if(globalT) return;
    // первый показ — через 12–20 сек после старта, чтобы юзер успел освоиться
    globalT = setTimeout(globalTick, 12000 + Math.random()*8000);
  }

  /* ================================================================
     Периодический ре-чек расписания DND (раз в 60 сек)
  ================================================================ */
  setInterval(function(){
    syncModes();
    updateHint();
    if(typeof updateNotifDot==='function') updateNotifDot();
  }, 60000);

  /* ================================================================
     WEB PUSH (VAPID) — реальные браузер-native уведомления от OKO.
     Экспортируем 3 функции в window: npAskPushPermission / npSubscribeToPush /
     npUnsubscribeFromPush. Стейт хранится в localStorage (npPush).
  ================================================================ */
  var NP_PUSH_LS = 'oko-np-push-v1';
  var NP_PUSH_PROMPT_SESSIONS = 3;         /* показать плашку после N активных сессий */
  var NP_PUSH_SESSION_MIN_MS = 45 * 1000;  /* «активная сессия» = ≥ 45 сек фокуса */
  var NP_PUSH_API_BASE = '';               /* '' → относительный /api.php (тот же хост); при желании — 'https://okoteam.top' */
  /* Публичный VAPID-ключ приложения OKO. Приватный ключ живёт только на VPS в config.php. */
  var NP_VAPID_PUBLIC = 'BEH8Gaj3aU85U-h9rrMVv07KU7-sWP1BoWQd-fvu-Oc6zJWx-pTuumELO-_AsGab26NI9Qk1dk_-dwjXt7s8Zhg';

  function npPushState(){
    try{
      var raw = JSON.parse(localStorage.getItem(NP_PUSH_LS));
      if(!raw || typeof raw!=='object') raw = {};
      raw.sessions   = raw.sessions   || 0;    /* число «активных» сессий */
      raw.asked      = !!raw.asked;            /* уже показывали красивую плашку */
      raw.declined   = !!raw.declined;         /* нажал «Позже» — не давить */
      raw.subscribed = !!raw.subscribed;       /* подписка отправлена на сервер */
      raw.endpoint   = raw.endpoint || '';
      return raw;
    }catch(e){ return {sessions:0,asked:false,declined:false,subscribed:false,endpoint:''}; }
  }
  function npPushSave(s){ try{ localStorage.setItem(NP_PUSH_LS, JSON.stringify(s)); }catch(e){} }

  function npPushSupported(){
    return typeof window!=='undefined' && 'serviceWorker' in navigator &&
           'PushManager' in window && 'Notification' in window &&
           location.protocol === 'https:';
  }

  /* Base64URL → Uint8Array (VAPID applicationServerKey) */
  function npB64UrlToU8(s){
    var pad = '='.repeat((4 - s.length % 4) % 4);
    var base = (s + pad).replace(/-/g,'+').replace(/_/g,'/');
    var raw = atob(base); var u8 = new Uint8Array(raw.length);
    for(var i=0;i<raw.length;i++) u8[i] = raw.charCodeAt(i);
    return u8;
  }
  /* ArrayBuffer → base64 (для отправки подписки на сервер) */
  function npAbToB64(buf){
    if(!buf) return '';
    var bytes = new Uint8Array(buf), s = '';
    for(var i=0;i<bytes.length;i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }

  function npGetEmail(){
    /* попытаемся достать email пользователя, чтобы бэкенд знал, кому слать */
    try{
      if(typeof RG2 !== 'undefined' && RG2.contact && /@/.test(RG2.contact)) return RG2.contact;
      var a = localStorage.getItem('oko-auth-contact');
      if(a && /@/.test(a)) return a;
    }catch(e){}
    return '';
  }

  function npApi(action, payload){
    var url = (NP_PUSH_API_BASE || '') + '/api.php?action=' + encodeURIComponent(action);
    return fetch(url, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      credentials: 'omit',
      body: JSON.stringify(payload||{})
    }).then(function(r){ return r.json().catch(function(){ return {ok:false}; }); });
  }

  /* Показать красивую плашку «Разреши уведомления от OKO».
     Обёртка над showPopup из core-ext (см. showPopup в base). */
  window.npAskPushPermission = function(force){
    var s = npPushState();
    if(!npPushSupported()) return;
    if(!force && (s.asked || s.subscribed)) return;
    if(!force && s.declined) return;
    if(typeof Notification==='undefined') return;
    if(Notification.permission === 'granted'){ npSubscribeToPush(); return; }
    if(Notification.permission === 'denied'){ s.declined = true; npPushSave(s); return; }
    if(typeof showPopup !== 'function') return;

    s.asked = true; npPushSave(s);
    showPopup({
      ico: 'bell',
      title: 'Не пропусти лидов и сообщения',
      body:
        '<div style="text-align:left;font-size:13.5px;line-height:1.55">'+
        'Разреши OKO присылать уведомления прямо в браузер:'+
        '<div style="margin:12px 0;display:flex;flex-direction:column;gap:6px;color:var(--dim);font-size:12.5px">'+
          '<div><svg class="i" style="width:14px;height:14px;color:var(--accent);vertical-align:-2px"><use href="#i-money"/></svg>&nbsp; Новый лид или оплата'+ ' — сразу узнаешь</div>'+
          '<div><svg class="i" style="width:14px;height:14px;color:var(--accent);vertical-align:-2px"><use href="#i-chat"/></svg>&nbsp; Ответ клиента в чате</div>'+
          '<div><svg class="i" style="width:14px;height:14px;color:var(--accent);vertical-align:-2px"><use href="#i-star"/></svg>&nbsp; Ролик залетел или урок открыт</div>'+
        '</div>'+
        '<small style="color:var(--dim)">В любой момент выключишь в настройках уведомлений.</small>'+
        '</div>',
      actions: [
        { label: 'Разрешить', onclick: function(){
            Notification.requestPermission().then(function(perm){
              if(perm === 'granted'){ npSubscribeToPush(); }
              else { var ss = npPushState(); ss.declined = true; npPushSave(ss); _toast('Уведомления не разрешены'); }
            });
          } },
        { label: 'Позже', ghost: true, onclick: function(){
            var ss = npPushState(); ss.declined = true; npPushSave(ss);
          } }
      ]
    });
  };

  /* Оформить web-push-подписку и отправить на бэкенд. */
  window.npSubscribeToPush = function(){
    if(!npPushSupported()) return Promise.resolve({ok:false, error:'unsupported'});
    if(Notification.permission !== 'granted'){
      return Notification.requestPermission().then(function(p){
        if(p !== 'granted') return {ok:false, error:'denied'};
        return doSubscribe();
      });
    }
    return doSubscribe();
    function doSubscribe(){
      return navigator.serviceWorker.ready.then(function(reg){
        return reg.pushManager.getSubscription().then(function(existing){
          if(existing) return existing;
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: npB64UrlToU8(NP_VAPID_PUBLIC)
          });
        });
      }).then(function(sub){
        var j = sub.toJSON ? sub.toJSON() : {
          endpoint: sub.endpoint,
          keys: {
            p256dh: npAbToB64(sub.getKey && sub.getKey('p256dh')),
            auth:   npAbToB64(sub.getKey && sub.getKey('auth'))
          }
        };
        return npApi('push_subscribe', {
          subscription: j,
          email: npGetEmail(),
          ua: navigator.userAgent || ''
        }).then(function(res){
          var s = npPushState();
          s.subscribed = !!(res && res.ok);
          s.endpoint = j.endpoint || '';
          npPushSave(s);
          if(s.subscribed){
            _toast('Уведомления OKO включены');
            syncSettingsUI();
          }
          return res;
        });
      }).catch(function(e){
        _toast('Не удалось подключить push');
        return {ok:false, error:String(e&&e.message||e)};
      });
    }
  };

  /* Отключить web-push (у браузера + на сервере). */
  window.npUnsubscribeFromPush = function(){
    if(!npPushSupported()) return Promise.resolve({ok:true});
    return navigator.serviceWorker.ready.then(function(reg){
      return reg.pushManager.getSubscription().then(function(sub){
        if(!sub) return {ok:true};
        var ep = sub.endpoint;
        return sub.unsubscribe().then(function(){
          return npApi('push_unsubscribe', { endpoint: ep, email: npGetEmail() });
        }).then(function(res){
          var s = npPushState();
          s.subscribed = false; s.endpoint = '';
          npPushSave(s);
          _toast('Push-уведомления выключены');
          syncSettingsUI();
          return res || {ok:true};
        });
      });
    }).catch(function(){ return {ok:false}; });
  };

  /* Слушаем клики по push-уведомлениям и pushsubscriptionchange из SW */
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('message', function(ev){
      var d = ev.data || {};
      if(d.type === 'oko-push-click'){
        try{
          var url = d.url || '/';
          if(url && url !== '/' && typeof showTab === 'function'){
            /* url может быть локальным маршрутом вида '/#tab=chats' — просто фокус, страница сама разберётся */
            if(/#tab=/.test(url)){ var t = url.split('tab=')[1]||''; if(t) showTab(t); }
          }
        }catch(e){}
      }
      if(d.type === 'oko-push-resubscribe'){
        var s = npPushState();
        if(s.subscribed) { try{ window.npSubscribeToPush(); }catch(e){} }
      }
    });
  }

  /* Учёт активных сессий: +1 после NP_PUSH_SESSION_MIN_MS в фокусе,
     через 3 сессии — показываем плашку. */
  (function trackSessions(){
    var s = npPushState();
    if(!npPushSupported()) return;
    if(s.asked || s.subscribed || s.declined) return;

    var counted = false, timer = null;
    function start(){
      if(counted || document.visibilityState==='hidden') return;
      timer = setTimeout(function(){
        counted = true;
        var ss = npPushState();
        ss.sessions = (ss.sessions||0) + 1;
        npPushSave(ss);
        if(ss.sessions >= NP_PUSH_PROMPT_SESSIONS){
          /* небольшая задержка, чтобы плашка не перебивала стартовые попапы */
          setTimeout(function(){ try{ window.npAskPushPermission(false); }catch(e){} }, 6000);
        }
      }, NP_PUSH_SESSION_MIN_MS);
    }
    function stop(){ if(timer){ clearTimeout(timer); timer = null; } }
    document.addEventListener('visibilitychange', function(){
      if(document.visibilityState==='hidden') stop();
      else start();
    });
    start();
  })();

  /* Автоподхват тумблера в панели настроек уведомлений: если пользователь
     разрешил push раньше (Notification.permission === 'granted'), но подписки
     нет (например, VAPID-ключ обновился) — попробуем восстановить тихо. */
  if(npPushSupported() && Notification.permission === 'granted'){
    setTimeout(function(){
      var s = npPushState();
      if(!s.subscribed){ try{ window.npSubscribeToPush(); }catch(e){} }
    }, 3000);
  }

  /* ================================================================
     ТУМБЛЕР «Push-уведомления OKO» в панели настроек модуля.
     Врезаем в конец .np-toggles после первой отрисовки настроек.
  ================================================================ */
  var _ensureSettings = ensureSettings;
  ensureSettings = function(){
    _ensureSettings();
    var box = document.querySelector('.np-settings'); if(!box) return;
    if(box.querySelector('.np-push-row')) { syncPushRow(); return; }
    var toggles = box.querySelector('.np-toggles'); if(!toggles) return;

    var support = npPushSupported();
    var perm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
    var s = npPushState();
    var on = s.subscribed && perm === 'granted';

    var row = document.createElement('div');
    row.className = 'np-toggle np-push-row';
    row.innerHTML =
      '<div class="np-toggle-l">'+
        '<svg class="i"><use href="#i-bell"/></svg>'+
        '<div class="np-toggle-t">'+
          '<b>Push-уведомления OKO</b>'+
          '<small class="np-push-sub">'+ pushSubText(support, perm, on) +'</small>'+
        '</div>'+
      '</div>'+
      '<div class="np-sw '+(on?'on':'')+'" role="switch" aria-checked="'+on+'"></div>';

    /* Тумблер: on → subscribe, off → unsubscribe */
    row.querySelector('.np-sw').addEventListener('click', function(){
      if(!npPushSupported()){ _toast('Твой браузер не поддерживает push'); return; }
      var perm2 = Notification.permission;
      var st = npPushState();
      var isOn = st.subscribed && perm2 === 'granted';
      if(isOn){
        window.npUnsubscribeFromPush();
      } else {
        if(perm2 === 'denied'){
          _toast('Push заблокирован в настройках браузера — включи вручную');
          return;
        }
        if(perm2 === 'default'){
          /* красивая плашка, force=true — игнорим "declined/asked" */
          window.npAskPushPermission(true);
        } else {
          window.npSubscribeToPush();
        }
      }
    });

    toggles.appendChild(row);
    syncPushRow();
  };

  function pushSubText(support, perm, on){
    if(!support) return 'Не поддерживается этим браузером';
    if(perm === 'denied') return 'Заблокировано в настройках браузера';
    if(on) return 'Придут даже если приложение закрыто';
    if(perm === 'granted') return 'Разрешены, но подписка не создана';
    return 'Лиды, оплаты, чаты — прямо на экран';
  }
  function syncPushRow(){
    var row = document.querySelector('.np-push-row'); if(!row) return;
    var support = npPushSupported();
    var perm = (typeof Notification !== 'undefined') ? Notification.permission : 'default';
    var s = npPushState();
    var on = s.subscribed && perm === 'granted';
    var sw = row.querySelector('.np-sw');
    if(sw){
      sw.classList.toggle('on', on);
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
    }
    var sub = row.querySelector('.np-push-sub');
    if(sub) sub.textContent = pushSubText(support, perm, on);
  }

  /* ================================================================
     СТАРТ
  ================================================================ */
  ensureIds();
  // проставим bell-иконку/бейдж сразу после загрузки base.html
  if(typeof updateNotifDot==='function') updateNotifDot();
  // стек-контейнер для живых toast
  ensureStack();
  // запуск глобального демо-потока
  startGlobal();
})();
