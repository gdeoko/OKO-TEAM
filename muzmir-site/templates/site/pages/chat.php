<?php
/** Чат поддержки с ИИ-помощником «Музыкальный Мир»: лента сообщений, вложения фото/видео,
 *  подсказки-чипы, история в localStorage + на сервере (api/v1/chat.php). */
$u = current_user();

ob_start(); ?>
<section class="chat-screen">
  <div class="chat-wrap">
    <div class="chat-head">
      <a class="aw-back" href="<?= url('/') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
      <div class="chat-title">
        <span class="chat-ava" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.8a8.3 8.3 0 0 1-8.5 8.2 8.9 8.9 0 0 1-3.8-.8l-5.2 1.2 1.2-4.9a8.1 8.1 0 0 1-1.2-4.2A8.3 8.3 0 0 1 12 3.5a8.3 8.3 0 0 1 9 8.3z"/></svg>
        </span>
        <span>
          <b>Помощник «Музыкальный Мир»</b>
          <i><span class="chat-dot" aria-hidden="true"></span>онлайн, отвечает сразу</i>
        </span>
      </div>
    </div>

    <div class="chat-log" id="chatLog" aria-live="polite">
      <?php /* Первое сообщение помощника - всегда приветствие + подсказки-чипы */ ?>
      <div class="msg agent">
        <div class="msg-b">
          <b class="msg-name">Помощник «Музыкальный Мир»</b>
          <p>Здравствуйте! Я помощник Культурного центра «Музыкальный Мир». Подскажу по конкурсам, заявкам, результатам и наградам - выберите вопрос или напишите свой.</p>
          <div class="chat-chips">
            <button type="button" class="chat-chip" data-q="Как подать заявку?">Как подать заявку</button>
            <button type="button" class="chat-chip" data-q="Сколько стоит участие?">Стоимость участия</button>
            <button type="button" class="chat-chip" data-q="Где посмотреть мои результаты?">Мои результаты</button>
            <button type="button" class="chat-chip" data-q="Как заказать награды?">Заказать награды</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="chat-inputbar">
    <div class="chat-inputbar-in">
      <button type="button" class="chat-attach" id="chatAttach" aria-label="Прикрепить фото или видео" title="Прикрепить фото или видео">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 0 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.48-8.48"/></svg>
      </button>
      <input type="file" id="chatFile" accept="image/*,video/*" hidden>
      <textarea id="chatText" rows="1" maxlength="2000" placeholder="Напишите сообщение..." aria-label="Сообщение в чат поддержки"></textarea>
      <button type="button" class="chat-send" id="chatSend" aria-label="Отправить сообщение" title="Отправить">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.4 20.4l17.5-7.5a1 1 0 0 0 0-1.84L3.4 3.56a1 1 0 0 0-1.4.94l.01 4.9c0 .5.37.92.86.98L14 12 2.87 13.62a1 1 0 0 0-.86.98L2 19.46a1 1 0 0 0 1.4.94z"/></svg>
      </button>
    </div>
  </div>
</section>

<style>
/* Плавающая VK-кнопка не нужна на экране чата */
#chatFab{display:none !important}

.chat-screen{padding-top:14px}
.chat-wrap{max-width:720px;margin:0 auto;padding:0 14px 190px}

.chat-head{margin-bottom:14px}
.chat-title{display:flex;align-items:center;gap:12px;margin-top:10px;padding:12px 14px;border-radius:18px;
  background:var(--glass-card);border:1px solid var(--glass-brd2);
  backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3)}
.chat-ava{flex:0 0 44px;width:44px;height:44px;border-radius:50%;background:var(--grad-gold);color:var(--gold-fg);
  display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-btn)}
.chat-ava svg{width:22px;height:22px}
.chat-title b{display:block;font-size:.95rem;line-height:1.2}
.chat-title i{display:flex;align-items:center;gap:6px;font-style:normal;font-size:.78rem;color:var(--muted);margin-top:2px}
.chat-dot{width:8px;height:8px;border-radius:50%;background:var(--mint);box-shadow:0 0 0 3px rgba(47,143,91,.18)}

.chat-log{display:flex;flex-direction:column;gap:12px}
.msg{display:flex;max-width:86%}
.msg .msg-b{padding:11px 14px;border-radius:18px;font-size:.92rem;line-height:1.45;word-break:break-word;min-width:0}
.msg p{margin:0;white-space:pre-line}
.msg p + p{margin-top:6px}
.msg-name{display:block;font-size:.72rem;letter-spacing:.02em;color:var(--gold-ink);margin-bottom:4px}
[data-theme="dark"] .msg-name{color:var(--gold)}
.msg time{display:block;font-size:.68rem;color:var(--muted);margin-top:5px;text-align:right}

.msg.agent{align-self:flex-start}
.msg.agent .msg-b{background:var(--glass-card);border:1px solid var(--glass-brd2);border-bottom-left-radius:6px;
  backdrop-filter:blur(12px) saturate(1.25);-webkit-backdrop-filter:blur(12px) saturate(1.25);box-shadow:var(--shadow-soft)}
.msg.agent a{color:var(--royal);font-weight:600}
[data-theme="dark"] .msg.agent a{color:var(--gold)}

.msg.user{align-self:flex-end;justify-content:flex-end}
.msg.user .msg-b{background:var(--grad-gold);color:var(--gold-fg);border:1px solid rgba(255,255,255,.35);
  border-bottom-right-radius:6px;box-shadow:var(--shadow-btn)}
.msg.user time{color:rgba(27,21,51,.6)}
.msg.user a{color:var(--gold-fg);text-decoration:underline}

.msg .msg-media{display:block;max-width:100%;border-radius:12px;margin:2px 0}
.msg img.msg-media{max-height:280px;object-fit:cover}
.msg video.msg-media{max-height:280px;width:100%}

.chat-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.chat-chip{border:1px solid var(--glass-brd2);background:var(--glass-card);color:var(--text);
  padding:8px 12px;border-radius:999px;font-size:.8rem;font-weight:600;cursor:pointer;font-family:inherit;
  transition:transform .15s ease,box-shadow .15s ease}
.chat-chip:hover{transform:translateY(-1px);box-shadow:var(--shadow-soft)}
.chat-chip:active{transform:scale(.97)}

/* Индикатор «печатает» */
.msg.typing .msg-b{display:flex;gap:5px;align-items:center;padding:14px 16px}
.msg.typing .td{width:7px;height:7px;border-radius:50%;background:var(--muted);opacity:.5;animation:chatTd 1.1s infinite}
.msg.typing .td:nth-child(2){animation-delay:.18s}
.msg.typing .td:nth-child(3){animation-delay:.36s}
@keyframes chatTd{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}

/* Поле ввода - закреплено над нижним меню */
.chat-inputbar{position:fixed;left:0;right:0;bottom:calc(90px + env(safe-area-inset-bottom,0px));z-index:850;
  padding:0 12px;pointer-events:none}
.chat-inputbar-in{pointer-events:auto;max-width:720px;margin:0 auto;display:flex;align-items:center;gap:6px;
  padding:6px 6px 6px 8px;border-radius:26px;background:var(--glass-card);border:1px solid var(--glass-brd2);
  backdrop-filter:blur(16px) saturate(1.35);-webkit-backdrop-filter:blur(16px) saturate(1.35);
  box-shadow:0 14px 40px rgba(21,34,76,.18)}
#chatText{flex:1;min-width:0;resize:none;border:0;outline:0;background:transparent;color:var(--text);
  font-family:var(--ff-body);font-size:.95rem;line-height:1.35;padding:8px 4px;max-height:118px;align-self:center}
#chatText::placeholder{color:var(--muted)}
.chat-attach,.chat-send{flex:0 0 42px;width:42px;height:42px;border-radius:50%;border:0;cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:transform .15s ease,box-shadow .2s ease;align-self:center}
.chat-attach{background:transparent;color:var(--muted)}
.chat-attach:hover{color:var(--gold-ink)}
.chat-send{background:var(--grad-gold);color:var(--gold-fg);box-shadow:0 6px 16px rgba(199,147,34,.42)}
.chat-send:hover{box-shadow:0 8px 20px rgba(199,147,34,.55)}
.chat-send:active,.chat-attach:active{transform:scale(.9)}
.chat-send[disabled]{opacity:.55;cursor:default}
.chat-attach svg{width:20px;height:20px}
.chat-send svg{width:20px;height:20px;margin-left:1px}

/* Кнопки-действия под ответом бота */
.chat-actions{display:flex;flex-wrap:wrap;gap:8px;align-self:flex-start;max-width:86%;margin-top:-4px}
.chat-act{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:999px;font-size:.82rem;
  font-weight:700;text-decoration:none;cursor:pointer;font-family:inherit;border:1px solid var(--gold);
  background:var(--gold-soft);color:var(--gold-ink);transition:transform .15s ease,box-shadow .15s ease}
[data-theme="dark"] .chat-act{color:var(--gold);background:color-mix(in srgb,var(--gold-soft) 34%,transparent)}
.chat-act:hover{transform:translateY(-1px);box-shadow:0 6px 16px rgba(199,147,34,.24)}
.chat-act--review{border-color:transparent;background:var(--grad-gold);color:var(--gold-fg)}
.chat-act--review svg{width:15px;height:15px}
/* Выпадающий список заявок */
.chat-select{-webkit-appearance:none;appearance:none;max-width:100%;padding-right:34px;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23c79322' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat:no-repeat;background-position:right 12px center;background-size:14px}
.chat-select:disabled{opacity:.7;cursor:default}
[data-theme="dark"] .chat-select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e8b950' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")}

/* Виджет отзыва (звёзды + комментарий) */
.chat-review{align-self:stretch;margin-top:4px;padding:16px;border-radius:18px;
  background:var(--glass-card);border:1px solid var(--glass-brd2);
  backdrop-filter:blur(12px) saturate(1.25);-webkit-backdrop-filter:blur(12px) saturate(1.25);
  box-shadow:var(--shadow-soft);display:flex;flex-direction:column;gap:10px}
.chat-review>b{font-size:.92rem;line-height:1.3}
.cr-stars{display:flex;gap:4px;justify-content:center}
.cr-star{background:none;border:0;padding:2px;cursor:pointer;color:var(--line);transition:transform .12s ease,color .12s ease}
.cr-star svg{width:34px;height:34px}
.cr-star.on{color:#F3B01C}
.cr-star:hover{transform:scale(1.12)}
.cr-text{width:100%;border:1.5px solid var(--glass-brd2);border-radius:12px;background:var(--bg);color:var(--text);
  font-family:inherit;font-size:.9rem;padding:10px 12px;resize:none}
.cr-msg{margin:0;text-align:center;color:var(--mint);font-weight:700;font-size:.9rem}

body.mz-kb .chat-inputbar{bottom:calc(10px + env(safe-area-inset-bottom,0px))}
/* ПК: нижнее меню — центрированный док (bottom:16px, ~74px высотой). Поле ввода ставим ВЫШЕ дока. */
@media (min-width:1024px){.chat-inputbar{bottom:calc(104px + env(safe-area-inset-bottom,0px))}}
</style>

<script>
(function(){
  var API   = '<?= url('/api/v1/chat') ?>';
  var CSRF  = '<?= h(csrf_token()) ?>';
  var LSKEY = 'mz-chat-history';
  var log   = document.getElementById('chatLog');
  var ta    = document.getElementById('chatText');
  var btn   = document.getElementById('chatSend');
  var att   = document.getElementById('chatAttach');
  var file  = document.getElementById('chatFile');
  var busy  = false;

  // Пользователь открыл чат - приветственный бейдж/плашка больше не нужны
  try { localStorage.setItem('mz-chat-greeted', '1'); } catch(e){}
  var badge = document.getElementById('chatBadge');
  if (badge) badge.style.display = 'none';

  function esc(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function linkify(s){
    return s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  function fmtTime(ts){
    var d = ts ? new Date(ts) : new Date();
    return ('0'+d.getHours()).slice(-2) + ':' + ('0'+d.getMinutes()).slice(-2);
  }
  function scrollDown(){
    requestAnimationFrame(function(){ window.scrollTo(0, document.documentElement.scrollHeight); });
  }

  function loadHist(){
    try { return JSON.parse(localStorage.getItem(LSKEY) || '[]') || []; } catch(e){ return []; }
  }
  function saveHist(h){
    try { localStorage.setItem(LSKEY, JSON.stringify(h.slice(-80))); } catch(e){}
  }
  var hist = loadHist();
  function pushHist(item){ hist.push(item); saveHist(hist); }

  /* Рендер сообщения. item = {r:'u'|'a', t:текст, f:url файла, k:'image'|'video', ts} */
  function render(item){
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + (item.r === 'u' ? 'user' : 'agent');
    var b = document.createElement('div');
    b.className = 'msg-b';
    var inner = '';
    if (item.r !== 'u') inner += '<b class="msg-name">Помощник «Музыкальный Мир»</b>';
    if (item.f) {
      inner += (item.k === 'video')
        ? '<video class="msg-media" src="' + esc(item.f) + '" controls playsinline preload="metadata"></video>'
        : '<a href="' + esc(item.f) + '" target="_blank" rel="noopener"><img class="msg-media" src="' + esc(item.f) + '" alt="Вложение" loading="lazy"></a>';
    }
    if (item.t) inner += '<p>' + linkify(esc(item.t)) + '</p>';
    inner += '<time>' + fmtTime(item.ts) + '</time>';
    b.innerHTML = inner;
    wrap.appendChild(b);
    log.appendChild(wrap);
    scrollDown();
  }

  hist.forEach(render);
  scrollDown();

  /* ─────────── ОПРОС СЕРВЕРНОЙ ИСТОРИИ ───────────
     Лента рисовалась ТОЛЬКО из localStorage, и серверная история со страницы не
     запрашивалась ни разу. Из-за этого ответ живого оператора, отправленный из
     админки, не доходил до участника никогда: он лежал в chat_messages, а вкладка
     о нём не спрашивала. Человек писал в пустоту и уходил.

     Теперь localStorage — только кэш для мгновенной отрисовки при открытии, а
     источником правды становится сервер: добираем всё, что появилось после
     последнего показанного id. */
  var lastId = 0;
  try { lastId = parseInt(localStorage.getItem(LSKEY + ':lastId') || '0', 10) || 0; } catch(e){}

  function setLastId(v){
    lastId = v;
    try { localStorage.setItem(LSKEY + ':lastId', String(v)); } catch(e){}
  }

  var seenKeys = {};
  hist.forEach(function(it){ if (it && it.sid) seenKeys[it.sid] = true; });

  /* Сообщение уже показано локально? Своё отправленное и ответ бота рисуются сразу,
     а через секунды приходят из истории — без этой сверки переписка задваивалась бы.
     Ищем среди последних записей ту же роль и тот же текст без серверного id. */
  function adoptLocal(role, text, id){
    var r = role === 'user' ? 'u' : 'a';
    var t = (text || '').trim();
    for (var i = hist.length - 1, n = 0; i >= 0 && n < 24; i--, n++) {
      var it = hist[i];
      if (!it || it.sid || it.r !== r) continue;
      if ((it.t || '').trim() === t) { it.sid = id; saveHist(hist); return true; }
    }
    return false;
  }

  function pollHistory(first){
    // Только POST: эндпоинт чата принимает исключительно POST (require_post),
    // а тело читается и как JSON (см. api/v1/_boot.php).
    return fetch(API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({action:'history', since: first ? 0 : lastId, _csrf: CSRF})
      })
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (!d || !d.ok || !d.messages || !d.messages.length) return;
        d.messages.forEach(function(m){
          var id = parseInt(m.id, 10) || 0;
          if (id > lastId) setLastId(id);
          if (seenKeys[id]) return;
          if (m.role !== 'user' && m.role !== 'assistant') return;   // служебные строки не показываем
          var txt = m.text || '', fl = m.file || '';
          if (!txt && !fl) return;
          seenKeys[id] = true;
          if (adoptLocal(m.role, txt, id)) return;                   // это наше же сообщение
          var item = {r: m.role === 'user' ? 'u' : 'a', t: txt, f: fl,
                      ts: m.created_at ? Date.parse(String(m.created_at).replace(' ', 'T')) : Date.now(), sid: id};
          pushHist(item); render(item);
        });
      })
      .catch(function(){ /* сеть моргнула — попробуем на следующем тике */ });
  }

  // Первый опрос сразу, дальше — раз в 6 секунд, пока вкладка видима.
  pollHistory(true);
  setInterval(function(){ if (!document.hidden) pollHistory(false); }, 6000);
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) pollHistory(false); });

  var typingEl = null;
  function showTyping(){
    hideTyping();
    typingEl = document.createElement('div');
    typingEl.className = 'msg agent typing';
    typingEl.innerHTML = '<div class="msg-b"><span class="td"></span><span class="td"></span><span class="td"></span></div>';
    log.appendChild(typingEl);
    scrollDown();
  }
  function hideTyping(){
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  function addAgent(text, actions, image){
    var item = {r:'a', t:text, ts:Date.now()};
    if (image) { item.f = image; item.k = 'image'; }
    pushHist(item); render(item);
    if (actions && actions.length) renderActions(actions);
  }

  /* Кнопки-действия под ответом бота: ссылки на разделы, диплом файлом, отзыв. */
  function renderActions(actions){
    var wrap = document.createElement('div');
    wrap.className = 'chat-actions';
    actions.forEach(function(a){
      if (a.type === 'review') {
        var rb = document.createElement('button');
        rb.type = 'button'; rb.className = 'chat-act chat-act--review';
        rb.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/></svg>' + esc(a.label);
        rb.addEventListener('click', function(){ openReview(); rb.disabled = true; });
        wrap.appendChild(rb);
      } else if (a.type === 'select') {
        // Выпадающий список заявок: по выбору шлём follow-up с номером заявки,
        // после чего бот отвечает уже по этой конкретной заявке.
        var sel = document.createElement('select');
        sel.className = 'chat-act chat-select';
        var ph = document.createElement('option');
        ph.value = ''; ph.textContent = a.label || 'Выберите заявку';
        ph.disabled = true; ph.selected = true;
        sel.appendChild(ph);
        (a.options || []).forEach(function(o){
          var op = document.createElement('option');
          op.value = String(o.value);
          op.textContent = o.label;
          if (o.number != null) op.setAttribute('data-number', String(o.number));
          sel.appendChild(op);
        });
        sel.addEventListener('change', function(){
          var opt = sel.options[sel.selectedIndex];
          var num = (opt && opt.getAttribute('data-number')) || sel.value;
          sel.disabled = true;
          if (num) send('Заявка №' + num);
        });
        wrap.appendChild(sel);
      } else {
        var el = document.createElement('a');
        el.className = 'chat-act'; el.href = a.url;
        if (/^https?:/.test(a.url) && a.url.indexOf(location.host) === -1) { el.target = '_blank'; el.rel = 'noopener'; }
        el.textContent = a.label;
        wrap.appendChild(el);
      }
    });
    log.appendChild(wrap);
    scrollDown();
  }

  /* Виджет отзыва (звёзды + комментарий), как в чат-ботах банков. */
  function openReview(){
    if (document.getElementById('chatReview')) return;
    var box = document.createElement('div');
    box.id = 'chatReview'; box.className = 'chat-review';
    box.innerHTML =
      '<b>Оцените работу Культурного центра «Музыкальный Мир»</b>' +
      '<div class="cr-stars" role="radiogroup" aria-label="Оценка">' +
        [1,2,3,4,5].map(function(n){ return '<button type="button" class="cr-star" data-n="'+n+'" aria-label="'+n+'">'+
          '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z"/></svg></button>'; }).join('') +
      '</div>' +
      '<textarea class="cr-text" rows="2" maxlength="600" placeholder="Что понравилось или что улучшить? (необязательно)"></textarea>' +
      '<button type="button" class="btn btn--primary btn--block cr-send">Отправить отзыв</button>' +
      '<p class="cr-msg" hidden></p>';
    log.appendChild(box); scrollDown();
    var rating = 5, stars = box.querySelectorAll('.cr-star');
    function paint(){ stars.forEach(function(s){ s.classList.toggle('on', (+s.dataset.n) <= rating); }); }
    stars.forEach(function(s){ s.addEventListener('click', function(){ rating = +s.dataset.n; paint(); }); });
    paint();
    box.querySelector('.cr-send').addEventListener('click', function(){
      var txt = box.querySelector('.cr-text').value.trim();
      var msg = box.querySelector('.cr-msg');
      var b = new URLSearchParams();
      b.set('rating', String(rating)); b.set('text', txt || 'Оценка через чат помощника'); b.set('_csrf', CSRF);
      fetch('<?= url('/api/v1/review') ?>', {method:'POST', credentials:'same-origin', body:b})
        .then(function(r){ return r.json().catch(function(){return {};}); })
        .then(function(d){
          if (d && d.ok) { finishReview(box, 'Спасибо! Ваш отзыв отправлен.'); return; }
          // Гость (нужен вход) — не теряем отзыв: отправим как сообщение боту/владельцу.
          send('Отзыв о работе центра: ' + rating + '/5. ' + (txt || ''));
          finishReview(box, 'Спасибо за оценку!');
        })
        .catch(function(){ finishReview(box, 'Спасибо за оценку!'); });
    });
    function finishReview(box, text){
      box.querySelector('.cr-send').disabled = true;
      var m = box.querySelector('.cr-msg'); m.hidden = false; m.textContent = text;
    }
  }

  function send(text){
    text = (text || '').trim();
    if (text === '' || busy) return;
    busy = true; btn.disabled = true;
    var item = {r:'u', t:text, ts:Date.now()};
    pushHist(item); render(item);
    ta.value = ''; resize();
    showTyping();
    fetch(API, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({action:'send', message:text, _csrf:CSRF})
    })
    .then(function(r){ return r.json(); })
    .then(function(d){
      hideTyping();
      // С человеком работает живой оператор (ручной перехват, блокировка бота или
      // бот выключен) — сервер намеренно отдаёт пустой reply. Раньше пустая строка
      // считалась сбоем, и участник получал «Не удалось получить ответ» от имени
      // «Помощника» ровно в тот момент, когда ему уже писал сотрудник центра.
      if (d && d.muted) {
        addAgent('Сотрудник центра подключился к переписке и ответит здесь.');
        pollHistory(false);
        return;
      }
      if (d && (d.reply || d.error)) {
        addAgent(d.reply || d.error, d.actions, d.image);
      } else {
        addAgent('Не удалось получить ответ. Попробуйте ещё раз.');
      }
      pollHistory(false);
    })
    .catch(function(){
      hideTyping();
      addAgent('Нет соединения. Проверьте интернет и попробуйте ещё раз.');
    })
    .finally(function(){ busy = false; btn.disabled = false; });
  }

  /* Авторасширение textarea */
  function resize(){
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }
  ta.addEventListener('input', resize);
  ta.addEventListener('keydown', function(e){
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); }
  });
  btn.addEventListener('click', function(){ send(ta.value); });

  /* Подсказки-чипы: тап отправляет вопрос */
  document.querySelectorAll('.chat-chip').forEach(function(ch){
    ch.addEventListener('click', function(){ send(ch.dataset.q || ch.textContent); });
  });

  /* Вложения: фото/видео до 15 МБ через action=upload */
  att.addEventListener('click', function(){ file.click(); });
  file.addEventListener('change', function(){
    var f = file.files && file.files[0];
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) {
      addAgent('Файл слишком большой - максимум 15 МБ.');
      file.value = ''; return;
    }
    if (busy) { file.value = ''; return; }
    busy = true; btn.disabled = true;
    showTyping();
    var fd = new FormData();
    fd.append('action', 'upload');
    fd.append('_csrf', CSRF);
    fd.append('file', f);
    fetch(API, {method:'POST', credentials:'same-origin', body:fd})
      .then(function(r){ return r.json(); })
      .then(function(d){
        hideTyping();
        if (d && d.ok) {
          var item = {r:'u', f:d.url, k:d.kind, ts:Date.now()};
          pushHist(item); render(item);
          addAgent('Файл получен! Если это по конкурсной заявке - напишите, пожалуйста, номер заявки или вопрос, и Оргкомитет разберётся.');
        } else {
          addAgent((d && d.error) || 'Не удалось загрузить файл.');
        }
      })
      .catch(function(){ hideTyping(); addAgent('Не удалось загрузить файл. Проверьте соединение.'); })
      .finally(function(){ busy = false; btn.disabled = false; file.value = ''; });
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Чат поддержки', $content, [
    'active' => '/chat',
    'meta'   => 'Чат поддержки Культурного центра «Музыкальный Мир»: помощник ответит на вопросы о конкурсах, заявках, результатах и наградах.',
]);
