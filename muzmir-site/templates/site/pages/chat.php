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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>
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
.chat-inputbar{position:fixed;left:0;right:0;bottom:calc(82px + env(safe-area-inset-bottom,0px));z-index:850;
  padding:0 12px;pointer-events:none}
.chat-inputbar-in{pointer-events:auto;max-width:720px;margin:0 auto;display:flex;align-items:flex-end;gap:8px;
  padding:8px;border-radius:22px;background:var(--glass-card);border:1px solid var(--glass-brd2);
  backdrop-filter:blur(16px) saturate(1.35);-webkit-backdrop-filter:blur(16px) saturate(1.35);
  box-shadow:0 14px 40px rgba(21,34,76,.18)}
#chatText{flex:1;min-width:0;resize:none;border:0;outline:0;background:transparent;color:var(--text);
  font-family:var(--ff-body);font-size:.95rem;line-height:1.4;padding:9px 6px;max-height:120px}
#chatText::placeholder{color:var(--muted)}
.chat-attach,.chat-send{flex:0 0 40px;width:40px;height:40px;border-radius:50%;border:0;cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:transform .15s ease}
.chat-attach{background:transparent;color:var(--muted);border:1px solid var(--glass-brd2)}
.chat-attach:hover{color:var(--gold-ink)}
.chat-send{background:var(--grad-gold);color:var(--gold-fg);box-shadow:var(--shadow-btn)}
.chat-send:active,.chat-attach:active{transform:scale(.92)}
.chat-send[disabled]{opacity:.55;cursor:default}
.chat-attach svg,.chat-send svg{width:19px;height:19px}

body.mz-kbd-open .chat-inputbar{bottom:calc(10px + env(safe-area-inset-bottom,0px))}
@media (min-width:1281px){.chat-inputbar{bottom:24px}}
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

  function addAgent(text){
    var item = {r:'a', t:text, ts:Date.now()};
    pushHist(item); render(item);
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
      addAgent((d && (d.reply || d.error)) || 'Не удалось получить ответ. Попробуйте ещё раз.');
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
    'meta'   => 'Чат поддержки КЦ «Музыкальный Мир»: помощник ответит на вопросы о конкурсах, заявках, результатах и наградах.',
]);
