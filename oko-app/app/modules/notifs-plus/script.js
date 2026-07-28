/* ===== NOTIFS-PLUS: центр уведомлений ПОВЕРХ ядра =====
   base.html не тронут. Только chain-патчи функций ядра:
     renderNotifs / openNotifs / closeNotifs / notifTap.
   Использует NOTIFS, updateNotifDot, I(), esc(), toast(), showTab(), openMa(). */
(function(){
  if(typeof NOTIFS==='undefined' || typeof window.renderNotifs!=='function') return;

  var LS = 'oko-npx';
  var NPX = (function(){ try{ return JSON.parse(localStorage.getItem(LS))||{}; }catch(e){ return {}; } })();
  if(!NPX.filter) NPX.filter = 'all';
  if(typeof NPX.dnd !== 'boolean') NPX.dnd = false;
  function save(){ try{ localStorage.setItem(LS, JSON.stringify({filter:NPX.filter, dnd:NPX.dnd})); }catch(e){} }

  var CHIPS = [
    {k:'all',           t:'Все'},
    {k:'likes',         t:'Лайки'},
    {k:'comments',      t:'Комменты'},
    {k:'requests',      t:'Заявки'},
    {k:'partner',       t:'Партнёрка'},
    {k:'achievements',  t:'Достижения'}
  ];
  function catOf(n){
    if(!n) return 'other';
    if(n.ic==='heart') return 'likes';
    if(n.ic==='comment') return 'comments';
    if(n.ic==='briefcase') return 'requests';
    if(n.ic==='users') return 'requests';
    if(n.ic==='money' || /Партнёрк/i.test(n.who||'')) return 'partner';
    if(n.ic==='star' || n.ic==='rocket') return 'achievements';
    return 'other';
  }
  function quickFor(cat){
    if(cat==='comments')     return {k:'reply',   t:'Ответить'};
    if(cat==='likes')        return {k:'post',    t:'Открыть пост'};
    if(cat==='requests')     return {k:'book',    t:'Забронировать'};
    if(cat==='partner')      return {k:'history', t:'История'};
    if(cat==='achievements') return {k:'open',    t:'Открыть'};
    return null;
  }
  function saytoast(msg){ if(typeof toast==='function') toast(msg); }

  /* ---------- head: DND-кнопка + строка чипов ---------- */
  function ensureHead(){
    var view = document.getElementById('notifsView'); if(!view) return;
    var head = view.querySelector('.sv-head');
    if(head && !head.querySelector('.npx-dnd-btn')){
      var done = head.querySelector('.ep-done');
      var dnd = document.createElement('button');
      dnd.type = 'button';
      dnd.className = 'npx-dnd-btn';
      dnd.setAttribute('aria-label','Тихий режим');
      dnd.title = 'Тихий режим';
      dnd.innerHTML = '<svg class="i"><use href="#i-moon"/></svg>';
      dnd.addEventListener('click', function(e){
        e.preventDefault(); e.stopPropagation();
        NPX.dnd = !NPX.dnd; save(); syncDnd();
        saytoast(NPX.dnd ? 'Тихий режим включён' : 'Тихий режим выключен');
      });
      if(done){
        var wrap = document.createElement('div');
        wrap.className = 'npx-headx';
        head.insertBefore(wrap, done);
        wrap.appendChild(dnd);
        wrap.appendChild(done);
      } else head.appendChild(dnd);
    }
    var body = document.getElementById('notifsBody');
    if(body && !view.querySelector('.npx-chips')){
      var bar = document.createElement('div');
      bar.className = 'npx-chips';
      bar.innerHTML = CHIPS.map(function(c){
        return '<button type="button" class="npx-chip '+(NPX.filter===c.k?'on':'')+'" data-k="'+c.k+'">'+c.t+'</button>';
      }).join('');
      bar.addEventListener('click', function(e){
        var b = e.target.closest && e.target.closest('.npx-chip'); if(!b) return;
        NPX.filter = b.dataset.k; save();
        bar.querySelectorAll('.npx-chip').forEach(function(x){
          x.classList.toggle('on', x.dataset.k===NPX.filter);
        });
        applyFilter();
      });
      view.insertBefore(bar, body);
    }
    syncDnd();
  }
  function syncDnd(){
    var view = document.getElementById('notifsView'); if(!view) return;
    view.classList.toggle('npx-is-dnd', NPX.dnd);
    var btn = view.querySelector('.npx-dnd-btn');
    if(btn) btn.classList.toggle('on', NPX.dnd);
  }
  function applyFilter(){
    var body = document.getElementById('notifsBody'); if(!body) return;
    body.querySelectorAll('.npx-row').forEach(function(r){
      r.style.display = (NPX.filter==='all' || r.dataset.cat===NPX.filter) ? '' : 'none';
    });
    body.querySelectorAll('.nt-group').forEach(function(g){
      var sib = g.nextElementSibling, has = false;
      while(sib && !sib.classList.contains('nt-group')){
        if(sib.classList.contains('npx-row') && sib.style.display!=='none'){ has = true; break; }
        sib = sib.nextElementSibling;
      }
      g.style.display = has ? '' : 'none';
    });
  }

  /* ---------- обёртка каждого .nt-item свайпом + quick-action ---------- */
  function enhanceItems(){
    var body = document.getElementById('notifsBody'); if(!body) return;
    body.querySelectorAll('button.nt-item').forEach(function(btn){
      if(btn.parentNode && btn.parentNode.classList && btn.parentNode.classList.contains('npx-swipe')) return;
      var m = (btn.getAttribute('onclick')||'').match(/notifTap\((\d+)\)/);
      if(!m) return;
      var i = +m[1];
      var n = NOTIFS[i]; if(!n) return;
      var cat = catOf(n);

      var row = document.createElement('div');
      row.className = 'npx-row';
      row.dataset.cat = cat;
      row.dataset.idx = String(i);

      var actions = document.createElement('div');
      actions.className = 'npx-actions';
      actions.innerHTML =
        '<span class="npx-act read" data-a="read">Прочитано</span>'+
        '<span class="npx-act del"  data-a="del">Удалить</span>';

      var swipe = document.createElement('div');
      swipe.className = 'npx-swipe';

      var parent = btn.parentNode;
      parent.insertBefore(row, btn);
      row.appendChild(actions);
      row.appendChild(swipe);
      swipe.appendChild(btn);

      var q = quickFor(cat);
      if(q){
        var nb = btn.querySelector('.nt-b');
        if(nb && !nb.querySelector('.npx-quick')){
          var qb = document.createElement('span');
          qb.className = 'npx-quick';
          qb.innerHTML = '<span class="npx-q" data-q="'+q.k+'">'+q.t+'</span>';
          nb.appendChild(qb);
        }
      }
      attachRow(row, actions, swipe);
    });
  }

  function attachRow(row, actions, swipe){
    actions.querySelectorAll('.npx-act').forEach(function(el){
      el.addEventListener('click', function(e){
        e.stopPropagation(); e.preventDefault();
        var idx = +row.dataset.idx; var n = NOTIFS[idx]; if(!n) return;
        if(el.dataset.a==='read'){
          n.unread = false;
          if(typeof updateNotifDot==='function') updateNotifDot();
          window.renderNotifs();
          saytoast('Отмечено прочитанным');
        } else if(el.dataset.a==='del'){
          NOTIFS.splice(idx, 1);
          if(typeof updateNotifDot==='function') updateNotifDot();
          window.renderNotifs();
          saytoast('Удалено');
        }
      });
    });

    var q = row.querySelector('.npx-q');
    if(q) q.addEventListener('click', function(e){
      e.stopPropagation(); e.preventDefault();
      var idx = +row.dataset.idx; var n = NOTIFS[idx]; if(!n) return;
      n.unread = false;
      if(typeof updateNotifDot==='function') updateNotifDot();
      if(typeof closeNotifs==='function') closeNotifs();
      var k = q.dataset.q;
      if(k==='reply' || k==='post'){ if(typeof showTab==='function') showTab('feed'); }
      else if(k==='book'){
        if(typeof showTab==='function') showTab('mini');
        if(typeof openMa==='function') openMa('market');
      }
      else if(k==='history'){ if(typeof showTab==='function') showTab('partner'); }
      else if(typeof n.act==='function') n.act();
    });

    var sx=0, sy=0, dx=0, live=false, lock=null;
    swipe.addEventListener('touchstart', function(e){
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY;
      dx = 0; live = true; lock = null;
      document.querySelectorAll('.npx-row.npx-open').forEach(function(r){
        if(r!==row) r.classList.remove('npx-open');
      });
    }, {passive:true});
    swipe.addEventListener('touchmove', function(e){
      if(!live) return;
      var t = e.touches[0];
      var cx = t.clientX - sx, cy = t.clientY - sy;
      if(lock===null){
        if(Math.abs(cx) < 6 && Math.abs(cy) < 6) return;
        lock = Math.abs(cx) > Math.abs(cy)*1.4 ? 'x' : 'y';
      }
      if(lock!=='x'){ live = false; swipe.style.transform = ''; return; }
      var base = row.classList.contains('npx-open') ? -140 : 0;
      dx = Math.max(-160, Math.min(20, cx + base));
      swipe.style.transform = 'translateX('+dx+'px)';
    }, {passive:true});
    swipe.addEventListener('touchend', function(){
      if(!live) return;
      live = false;
      swipe.style.transform = '';
      row.classList.toggle('npx-open', dx < -70);
    });
    swipe.addEventListener('click', function(e){
      if(row.classList.contains('npx-open')){
        e.stopPropagation(); e.preventDefault();
        row.classList.remove('npx-open');
      }
    }, true);
  }

  /* ---------- живой feed: раз в 30–60 сек, только когда экран открыт ---------- */
  var DEMO = [
    {ic:'heart',    who:'Даня П.',        t:'оценил твой пост'},
    {ic:'comment',  who:'Ксюша Р.',       t:'ответила: «согласна, беру в работу»'},
    {ic:'briefcase',who:'Биржа OKO',      t:'новая заявка по услуге «Монтаж Reels»'},
    {ic:'users',    who:'+2 подписчика',  t:'подписались на твой канал'},
    {ic:'money',    who:'Партнёрка',      t:'начисление +$12.40 за оплату PRO'},
    {ic:'star',     who:'Аня М.',         t:'поставила 5 звёзд за услугу'},
    {ic:'heart',    who:'Максим Т.',      t:'оценил твой пост «Правило простое…»'},
    {ic:'rocket',   who:'OKO',            t:'твой ролик вошёл в топ дня'}
  ];
  var liveT = null;
  function livePush(){
    if(NPX.dnd) return;
    var view = document.getElementById('notifsView');
    if(!view || !view.classList.contains('open')) return;
    var p = DEMO[Math.floor(Math.random()*DEMO.length)];
    NOTIFS.unshift({ic:p.ic, who:p.who, t:p.t, time:'только что', g:'Сегодня', unread:true, act:function(){}});
    if(typeof updateNotifDot==='function') updateNotifDot();
    window.renderNotifs();
    var first = document.querySelector('#notifsBody .npx-row');
    if(first){
      first.classList.add('npx-bounce');
      setTimeout(function(){ first.classList.remove('npx-bounce'); }, 800);
    }
  }
  function liveStart(){
    if(liveT) return;
    var tick = function(){
      livePush();
      liveT = setTimeout(tick, 30000 + Math.random()*30000);
    };
    liveT = setTimeout(tick, 30000 + Math.random()*30000);
  }
  function liveStop(){ if(liveT){ clearTimeout(liveT); liveT = null; } }

  /* ---------- chain-патчи ---------- */
  var _render = window.renderNotifs;
  window.renderNotifs = function(){
    _render.apply(this, arguments);
    ensureHead();
    enhanceItems();
    applyFilter();
  };
  var _open = window.openNotifs;
  window.openNotifs = function(){
    _open.apply(this, arguments);
    ensureHead();
    liveStart();
  };
  var _close = window.closeNotifs;
  window.closeNotifs = function(){
    _close.apply(this, arguments);
    liveStop();
    document.querySelectorAll('.npx-row.npx-open').forEach(function(r){
      r.classList.remove('npx-open');
    });
  };
  var _tap = window.notifTap;
  window.notifTap = function(){
    var openRow = document.querySelector('.npx-row.npx-open');
    if(openRow){ openRow.classList.remove('npx-open'); return; }
    _tap.apply(this, arguments);
  };
})();
