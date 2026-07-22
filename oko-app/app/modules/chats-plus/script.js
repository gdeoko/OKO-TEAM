/* ===== CHATS-PLUS: доработки мессенджера ПОВЕРХ ядра (префикс cp-) =====
   base.html не тронут — только chain-патчи функций ядра и DOM-проходы.
   1) Статусы сообщений: галочки у исходящих (одна = отправлено, две = доставлено,
      две зелёные = прочитано). Мок: «прочитано» через 2–5 с, если чат онлайн.
   2) Поиск по сообщениям: лупа в шапке конва -> строка поиска, подсветка,
      счётчик «N из M», стрелки раньше/позже.
   3) Реальный закреп: пин-бар над лентой, тап скроллит к сообщению, крестик снимает.
   4) Скорость голосовых x1/x1.5/x2 (chain togglePlay/playVnote), персист.
   5) Свайп-ответ: горизонтальный свайп вправо >40px -> replyTo (без конфликта
      со скроллом: жест берём только при |dx|>|dy|*2). */

const CP = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-chats-plus'))||{}; }catch(e){ return {}; } })();
if(CP.speed!==1.5 && CP.speed!==2) CP.speed = 1;
if(!Array.isArray(CP.recentEmoji)) CP.recentEmoji = [];
if(!Array.isArray(CP.recentOko)) CP.recentOko = [];   /* недавние фирменные OKO-эмодзи (ключи) */
if(!CP.panelTab) CP.panelTab = 'emoji';
if(!CP.access || typeof CP.access!=='object') CP.access = {};     /* {chatId:{type,price}} — овнерские настройки доступа */
if(!CP.unlocked || typeof CP.unlocked!=='object') CP.unlocked = {}; /* {chatId:1} — купленный доступ к платному чату */
function cpSave(){ try{ localStorage.setItem('oko-chats-plus', JSON.stringify({speed:CP.speed, recentEmoji:CP.recentEmoji.slice(0,24), recentOko:CP.recentOko.slice(0,24), panelTab:CP.panelTab, access:CP.access, unlocked:CP.unlocked})); }catch(e){} }
const cpMsgsEl = () => document.getElementById('msgs');
const cpEsc = t => (typeof esc==='function' ? esc(t) : String(t==null?'':t));

/* ================= 1. СТАТУСЫ СООБЩЕНИЙ ================= */
const CP_ST_TITLE = {sent:'Отправлено', delivered:'Доставлено', read:'Прочитано'};

function cpPaintStatuses(){
  if(typeof currentChat==='undefined' || !currentChat) return;
  const el = cpMsgsEl(); if(!el) return;
  const kids = el.children, msgs = currentChat.msgs || [];
  for(let i=0; i<msgs.length && i<kids.length; i++){
    const m = msgs[i];
    if(!m || m.in || m.kind==='sys') continue;
    const t = kids[i].querySelector('.t');
    if(!t) continue; /* vnote и пр. без строки времени */
    t.classList.add('cp-t');
    const st = m.cpSt || (currentChat.online ? 'read' : 'delivered');
    let sp = t.querySelector('.cp-st');
    if(!sp){
      const old = t.querySelector('svg'); if(old) old.remove(); /* родная одиночная check2 */
      sp = document.createElement('span'); sp.className = 'cp-st';
      t.appendChild(sp);
    }
    if(sp.dataset.st !== st){
      const had = !!sp.dataset.st;
      sp.dataset.st = st;
      sp.title = CP_ST_TITLE[st] || '';
      sp.innerHTML = st==='sent' ? I('check') : I('check2');
      if(had){ sp.classList.remove('cp-pop'); void sp.offsetWidth; sp.classList.add('cp-pop'); }
    }
  }
}
function cpPaintIf(chat){ if(typeof currentChat!=='undefined' && currentChat===chat) cpPaintStatuses(); }

/* мок-жизнь статусов: sent -> delivered (~1 c) -> read (2–5 c, если чат онлайн) */
if(typeof pushMsg === 'function'){
  const _cpPrevPushMsg = pushMsg;
  pushMsg = function(m){
    _cpPrevPushMsg.apply(this, arguments);
    if(!m || m.in || m.kind==='sys' || typeof currentChat==='undefined' || !currentChat) return;
    const chat = currentChat;
    m.cpSt = 'sent'; cpPaintIf(chat);
    setTimeout(()=>{ if(m.cpSt==='sent'){ m.cpSt='delivered'; cpPaintIf(chat); } }, 600 + Math.random()*600);
    if(chat.online)
      setTimeout(()=>{ m.cpSt='read'; cpPaintIf(chat); }, 2000 + Math.random()*3000);
  };
}

/* ================= 2. ПОИСК ПО СООБЩЕНИЯМ ================= */
let cpMarks = [], cpCur = -1;

function cpOpenSearch(){
  const bar = document.getElementById('cpSearchBar');
  if(!bar || typeof currentChat==='undefined' || !currentChat) return;
  if(bar.classList.contains('on')){ cpCloseSearch(); return; }
  bar.classList.add('on');
  const inp = document.getElementById('cpSearchInput');
  inp.value = ''; cpUpdateCount();
  setTimeout(()=>inp.focus(), 60);
  if(typeof nvPush==='function') nvPush('cp:msearch', ()=>cpCloseSearch(true));
}
function cpCloseSearch(fromNav){
  const bar = document.getElementById('cpSearchBar');
  if(!bar || !bar.classList.contains('on')) return;
  bar.classList.remove('on');
  const inp = document.getElementById('cpSearchInput');
  if(inp) inp.value = '';
  cpClearMarks(); cpUpdateCount();
  if(!fromNav && typeof nvPop==='function') nvPop('cp:msearch');
}
function cpClearMarks(){
  cpMarks.forEach(mk=>{
    const p = mk.parentNode; if(!p) return; /* лента могла перерендериться */
    p.replaceChild(document.createTextNode(mk.textContent), mk);
    p.normalize();
  });
  cpMarks = []; cpCur = -1;
}
function cpSearchRun(){
  cpClearMarks();
  const inp = document.getElementById('cpSearchInput');
  const q = (inp && inp.value || '').trim().toLowerCase();
  const el = cpMsgsEl();
  if(!q || !el){ cpUpdateCount(); return; }
  el.querySelectorAll('.msg').forEach(msg=>{
    if(msg.id==='typingMsg') return;
    const tw = document.createTreeWalker(msg, NodeFilter.SHOW_TEXT, { acceptNode: n => {
      if(!n.nodeValue || n.nodeValue.toLowerCase().indexOf(q) < 0) return NodeFilter.FILTER_REJECT;
      const pe = n.parentElement;
      if(pe && (pe.closest('.t') || pe.closest('.cp-st') || pe.closest('.cp-speed'))) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    const nodes = []; while(tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(node=>{
      const text = node.nodeValue, low = text.toLowerCase();
      const frag = document.createDocumentFragment();
      let from = 0, pos;
      while((pos = low.indexOf(q, from)) >= 0){
        frag.appendChild(document.createTextNode(text.slice(from, pos)));
        const mk = document.createElement('mark');
        mk.className = 'cp-mk'; mk.textContent = text.slice(pos, pos + q.length);
        frag.appendChild(mk); cpMarks.push(mk);
        from = pos + q.length;
      }
      frag.appendChild(document.createTextNode(text.slice(from)));
      node.parentNode.replaceChild(frag, node);
    });
  });
  cpCur = cpMarks.length - 1; /* стартуем с самого свежего совпадения */
  cpFocusMark(true);
}
function cpFocusMark(instant){
  cpMarks.forEach((m,i)=>m.classList.toggle('cp-cur', i===cpCur));
  const mk = cpMarks[cpCur];
  if(mk) mk.scrollIntoView({behavior: instant ? 'auto' : 'smooth', block:'center'});
  cpUpdateCount();
}
function cpSearchStep(d){
  if(!cpMarks.length) return;
  cpCur = (cpCur + d + cpMarks.length) % cpMarks.length;
  cpFocusMark(false);
}
function cpUpdateCount(){
  const c = document.getElementById('cpSearchCount'); if(!c) return;
  const inp = document.getElementById('cpSearchInput');
  const q = (inp && inp.value || '').trim();
  c.textContent = !q ? '' : (cpMarks.length ? (cpCur+1)+' из '+cpMarks.length : 'нет совпадений');
}
function cpReapplySearch(){
  const bar = document.getElementById('cpSearchBar');
  if(!bar || !bar.classList.contains('on')) return;
  const inp = document.getElementById('cpSearchInput');
  if(inp && inp.value.trim()){ cpMarks = []; cpCur = -1; cpSearchRun(); }
}

/* ================= 3. ЗАКРЕП СООБЩЕНИЯ (реальный пин-бар) ================= */
const _cpPrevPinMsg = (typeof pinMsg === 'function') ? pinMsg : null;
pinMsg = function(idx){
  if(typeof closeMsgMenu==='function') closeMsgMenu();
  if(typeof currentChat==='undefined' || !currentChat) return;
  const m = currentChat.msgs[idx];
  if(!m || m.kind==='sys') return;
  if(currentChat.cpPin === m){ toast('Уже закреплено'); return; }
  currentChat.cpPin = m; /* ссылка на объект — индексы могут съехать при удалении */
  cpUpdatePinBar(true);
  toast('Сообщение закреплено');
};
function cpUpdatePinBar(anim){
  const bar = document.getElementById('cpPinBar'); if(!bar) return;
  const chat = (typeof currentChat!=='undefined') ? currentChat : null;
  const pin = chat && chat.cpPin;
  const idx = pin ? chat.msgs.indexOf(pin) : -1;
  if(idx < 0){
    bar.classList.remove('on');
    if(chat && pin) chat.cpPin = null; /* закреплённое удалили */
    return;
  }
  const txt = document.getElementById('cpPinText');
  if(txt) txt.textContent = ((typeof msgQuoteText==='function' ? msgQuoteText(pin) : pin.body) || 'Сообщение');
  const was = bar.classList.contains('on');
  bar.classList.add('on');
  if(anim && !was){ bar.classList.remove('cp-pin-in'); void bar.offsetWidth; bar.classList.add('cp-pin-in'); }
}
function cpScrollToPinned(){
  const chat = (typeof currentChat!=='undefined') ? currentChat : null;
  if(!chat || !chat.cpPin) return;
  const idx = chat.msgs.indexOf(chat.cpPin);
  const el = cpMsgsEl();
  const kid = el && el.children[idx];
  if(!kid) return;
  kid.scrollIntoView({behavior:'smooth', block:'center'});
  kid.classList.remove('cp-flash'); void kid.offsetWidth; kid.classList.add('cp-flash');
}
function cpUnpin(ev){
  if(ev) ev.stopPropagation();
  if(typeof currentChat!=='undefined' && currentChat) currentChat.cpPin = null;
  cpUpdatePinBar();
  toast('Закреп снят');
}

/* ================= 4. СКОРОСТЬ ГОЛОСОВЫХ x1/x1.5/x2 ================= */
function cpSpeedLabel(){ return 'x' + (CP.speed===1.5 ? '1.5' : CP.speed===2 ? '2' : '1'); }
function cpDecorateVoices(){
  const el = cpMsgsEl(); if(!el) return;
  el.querySelectorAll('.voice').forEach(v=>{
    if(v.querySelector('.cp-speed')) return;
    const b = document.createElement('button');
    b.className = 'cp-speed'; b.title = 'Скорость воспроизведения';
    b.textContent = cpSpeedLabel();
    b.onclick = cpCycleSpeed;
    v.appendChild(b);
  });
}
function cpCycleSpeed(ev){
  if(ev) ev.stopPropagation();
  CP.speed = CP.speed===1 ? 1.5 : CP.speed===1.5 ? 2 : 1;
  cpSave();
  document.querySelectorAll('.cp-speed,.cp-vn-speed').forEach(b=>b.textContent = cpSpeedLabel());
  document.querySelectorAll('.voice .pp').forEach(pp=>{ if(pp._audio) try{ pp._audio.playbackRate = CP.speed; }catch(e){} });
  document.querySelectorAll('.vnote video').forEach(v=>{ try{ v.playbackRate = CP.speed; }catch(e){} });
}
if(typeof togglePlay === 'function'){
  const _cpPrevTogglePlay = togglePlay;
  togglePlay = function(btn){
    _cpPrevTogglePlay.apply(this, arguments);
    if(btn && btn._audio) try{ btn._audio.playbackRate = CP.speed; }catch(e){}
  };
}
if(typeof playVnote === 'function'){
  const _cpPrevPlayVnote = playVnote;
  playVnote = function(el){
    _cpPrevPlayVnote.apply(this, arguments);
    const v = el && el.querySelector && el.querySelector('video');
    if(v) try{ v.playbackRate = CP.speed; }catch(e){}
  };
}

/* ================= 5. СВАЙП-ОТВЕТ ================= */
let cpSw = null;
function cpSwipeInit(){
  const el = cpMsgsEl(); if(!el || el._cpSwipe) return; el._cpSwipe = true;
  el.addEventListener('touchstart', e=>{
    if(e.touches.length !== 1){ cpSw = null; return; }
    const msg = e.target.closest('.msg');
    if(!msg || msg.classList.contains('sys') || msg.classList.contains('typing')){ cpSw = null; return; }
    cpSw = {el:msg, x:e.touches[0].clientX, y:e.touches[0].clientY, dx:0, on:false};
  }, {passive:true});
  el.addEventListener('touchmove', e=>{
    if(!cpSw) return;
    const dx = e.touches[0].clientX - cpSw.x;
    const dy = e.touches[0].clientY - cpSw.y;
    if(!cpSw.on){
      if(dx > 12 && Math.abs(dx) > Math.abs(dy)*2){ /* уверенно горизонтальный, вправо */
        cpSw.on = true;
        cpSw.el.classList.add('cp-sw');
        if(!cpSw.el.querySelector('.cp-sw-ic')){
          const ic = document.createElement('span');
          ic.className = 'cp-sw-ic'; ic.innerHTML = I('reply');
          cpSw.el.appendChild(ic);
        }
      } else if(Math.abs(dy) > 14 || dx < -14){ cpSw = null; return; } /* это скролл — отпускаем */
    }
    if(cpSw && cpSw.on){
      e.preventDefault();
      const d = Math.max(0, Math.min(dx, 76));
      cpSw.dx = d;
      cpSw.el.style.transform = 'translateX(' + d + 'px)';
      const ic = cpSw.el.querySelector('.cp-sw-ic');
      if(ic) ic.style.opacity = Math.min(1, d/40);
      cpSw.el.classList.toggle('cp-sw-hit', d > 40);
    }
  }, {passive:false});
  const end = ()=>{
    if(!cpSw) return;
    const s = cpSw; cpSw = null;
    const hit = s.on && s.dx > 40;
    const idx = Array.prototype.indexOf.call(el.children, s.el);
    s.el.classList.remove('cp-sw');
    s.el.classList.add('cp-sw-back');
    s.el.style.transform = '';
    s.el.classList.remove('cp-sw-hit');
    setTimeout(()=>{
      s.el.classList.remove('cp-sw-back');
      const ic = s.el.querySelector('.cp-sw-ic'); if(ic) ic.remove();
    }, 240);
    if(hit && idx >= 0 && typeof currentChat!=='undefined' && currentChat
       && currentChat.msgs[idx] && currentChat.msgs[idx].kind !== 'sys'
       && typeof replyTo === 'function') replyTo(idx);
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

/* ================= UI-ИНЖЕКЦИЯ (шапка конва, пин-бар, строка поиска) ================= */
function cpBuildUi(){
  const head = document.querySelector('#convBody .conv-head');
  if(!head || document.getElementById('cpSearchBtn')) return;
  /* лупа в шапке — перед кнопками звонков */
  const btn = document.createElement('button');
  btn.className = 'ch-call'; btn.id = 'cpSearchBtn'; btn.title = 'Поиск по сообщениям';
  btn.innerHTML = I('search');
  btn.onclick = cpOpenSearch;
  head.insertBefore(btn, head.querySelector('.ch-call'));
  /* пин-бар */
  const pin = document.createElement('div');
  pin.className = 'cp-pinbar'; pin.id = 'cpPinBar';
  pin.onclick = cpScrollToPinned;
  pin.innerHTML = `<span class="cp-pin-ic">${I('pin')}</span>
    <div class="cp-pin-txt"><b>Закреплённое сообщение</b><small id="cpPinText"></small></div>
    <button class="cp-pin-x" onclick="cpUnpin(event)" title="Открепить">${I('plus')}</button>`;
  head.insertAdjacentElement('afterend', pin);
  /* строка поиска */
  const bar = document.createElement('div');
  bar.className = 'cp-msearch'; bar.id = 'cpSearchBar';
  bar.innerHTML = `<span class="cp-ms-ic">${I('search')}</span>
    <input id="cpSearchInput" placeholder="Поиск по сообщениям" autocomplete="off">
    <span class="cp-ms-count" id="cpSearchCount"></span>
    <button class="cp-ms-nav" onclick="cpSearchStep(-1)" title="Раньше">${I('chev')}</button>
    <button class="cp-ms-nav cp-ms-next" onclick="cpSearchStep(1)" title="Позже">${I('chev')}</button>
    <button class="cp-ms-x" onclick="cpCloseSearch()" title="Закрыть поиск">${I('plus')}</button>`;
  pin.insertAdjacentElement('afterend', bar);
  const inp = bar.querySelector('#cpSearchInput');
  inp.addEventListener('input', cpSearchRun);
  inp.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); cpSearchStep(e.shiftKey ? 1 : -1); }
  });
}

/* ================= CHAIN-ПАТЧИ РЕНДЕРА И НАВИГАЦИИ КОНВА ================= */
if(typeof renderMsgs === 'function'){
  const _cpPrevRenderMsgs = renderMsgs;
  renderMsgs = function(){
    _cpPrevRenderMsgs.apply(this, arguments);
    cpPaintStatuses();
    cpDecorateVoices();
    cpUpdatePinBar();
    cpReapplySearch();
  };
}
if(typeof openConv === 'function'){
  const _cpPrevOpenConv = openConv;
  openConv = function(){
    cpCloseSearch(); /* поиск не тащим между чатами */
    _cpPrevOpenConv.apply(this, arguments);
  };
}
if(typeof closeConv === 'function'){
  const _cpPrevCloseConv = closeConv;
  closeConv = function(){
    cpCloseSearch();
    _cpPrevCloseConv.apply(this, arguments);
  };
}

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
(function cpInit(){
  cpBuildUi();
  cpSwipeInit();
  /* исторические исходящие: онлайн-чат — прочитаны, офлайн — доставлены */
  try{
    (typeof CHATS !== 'undefined' ? CHATS : []).forEach(c=>{
      (c.msgs || []).forEach(m=>{
        if(m && !m.in && m.kind !== 'sys' && !m.cpSt) m.cpSt = c.online ? 'read' : 'delivered';
      });
    });
  }catch(e){}
  /* конва уже открыта (пересборка на лету) — прогнать декор */
  if(typeof currentChat !== 'undefined' && currentChat){
    cpPaintStatuses(); cpDecorateVoices(); cpUpdatePinBar();
  }
})();

/* =======================================================================
   ЧАСТЬ 2 — Telegram+: контекст-меню, стикер/эмодзи-панель у поля,
   красивые голосовые кружочки/волна, экран звонка. Всё поверх ядра
   (base.html не тронут): CSS + chain-патчи + DOM-инъекции по id/классам.
   ======================================================================= */

/* ================= 6. КРАСИВОЕ КОНТЕКСТ-МЕНЮ СООБЩЕНИЯ ================= */
/* База уже наполняет #mmReacts/#mmPreview/#mmActions (Ответить/Копировать/
   Переслать/Редактировать/Закрепить/Удалить). Делаем меню «телеграм-плюс»:
   привязываем к точке нажатия, стеклянная тема, стаггер-анимация реакций,
   разделители/крупные иконки (через CSS), гарантированная прокрутка. */
let cpTapPt = null; /* координаты последнего нажатия по сообщению */
function cpInitMenuAnchor(){
  const el = cpMsgsEl(); if(!el || el._cpMenuPt) return; el._cpMenuPt = true;
  el.addEventListener('pointerdown', e=>{
    const msg = e.target.closest('.msg');
    if(msg && !msg.classList.contains('sys')) cpTapPt = {x:e.clientX, y:e.clientY};
    else cpTapPt = null;
  }, {passive:true});
}
if(typeof openMsgMenu === 'function'){
  const _cpPrevOpenMsgMenu = openMsgMenu;
  openMsgMenu = function(idx){
    _cpPrevOpenMsgMenu.apply(this, arguments);
    cpEnhanceMenu(cpTapPt);
  };
}
if(typeof openPostMenu === 'function'){
  const _cpPrevOpenPostMenu = openPostMenu;
  openPostMenu = function(){ _cpPrevOpenPostMenu.apply(this, arguments); cpEnhanceMenu(null); };
}
function cpEnhanceMenu(pt){
  const inner = document.querySelector('#msgMenu .mm-inner');
  const reacts = document.getElementById('mmReacts');
  if(!inner) return;
  inner.classList.add('cp-mm');
  /* стаггер появления реакций */
  if(reacts && reacts.style.display !== 'none'){
    [...reacts.children].forEach((b,i)=>{ b.style.setProperty('--cp-i', i); });
  }
  /* «якорим» меню к сообщению по вертикали, чтобы палец не перекрывал пункты */
  inner.style.transformOrigin = pt ? (pt.y < window.innerHeight/2 ? 'top center' : 'bottom center') : 'center';
}

/* ================= 7. СТИКЕРЫ + ЭМОДЗИ ПРЯМО У ПОЛЯ (composer) ================= */
const CP_EMOJI = ['😀','😁','😂','🤣','😊','😍','😘','😎','🤩','🥳','😇','🙂','😉','😌','😗','😙',
  '🤔','🤨','😐','😴','😜','😝','🤗','🤭','🙃','😏','😒','😞','😢','😭','😤','😠','😡','🤬','😱','😨',
  '👍','👎','👏','🙏','🤝','💪','🔥','✨','⭐','🌟','💯','✅','❌','⚡','🎉','🎊','🏆','🥇','💎','💰',
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💥','👀','🚀','🌈','☀️','🌙','⚽'];
/* CP_EMOJI выше — устаревший системный набор (оставлен как fallback, НЕ рендерится).
   Ниже — фирменный набор OKO: моно-SVG в стиле бренда (line + минимальная заливка,
   currentColor). Каждый эмодзи = сырой inner-markup, база стиля задаётся на <svg>
   (fill:none stroke:currentColor width:1.8). Заливка через fill=currentColor stroke=none.
   Вставляются в текст как шорткод :oko-KEY: и рендерятся обратно фирменным SVG. */
const CP_OKO_EMOJI = {
  /* --- Смайлы --- */
  happy:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.4" r="1.1" fill="currentColor" stroke="none"/><path d="M8 14.4q4 2.7 8 0"/>',
  laugh:'<circle cx="12" cy="12" r="9"/><path d="M7.4 10.6q1.2-1.3 2.5 0"/><path d="M14.1 10.6q1.2-1.3 2.5 0"/><path d="M7.4 13.4h9.2a4.6 4.6 0 0 1-9.2 0z" fill="currentColor" stroke="none"/>',
  love:'<circle cx="12" cy="12" r="9"/><path d="M9 11.9c-1.5-1.1-2.4-1.9-2.4-2.9 0-.75.6-1.25 1.35-1.25.55 0 1 .3 1.05.6.05-.3.5-.6 1.05-.6.75 0 1.35.5 1.35 1.25 0 1-.9 1.8-2.4 2.9z" fill="currentColor" stroke="none"/><path d="M15 11.9c-1.5-1.1-2.4-1.9-2.4-2.9 0-.75.6-1.25 1.35-1.25.55 0 1 .3 1.05.6.05-.3.5-.6 1.05-.6.75 0 1.35.5 1.35 1.25 0 1-.9 1.8-2.4 2.9z" fill="currentColor" stroke="none"/><path d="M8.3 14.6q3.7 2.6 7.4 0"/>',
  cool:'<circle cx="12" cy="12" r="9"/><rect x="5.6" y="8.8" width="4.7" height="3.3" rx="1.3" fill="currentColor" stroke="none"/><rect x="13.7" y="8.8" width="4.7" height="3.3" rx="1.3" fill="currentColor" stroke="none"/><path d="M10.3 9.6h3.4"/><path d="M8.5 15.2q3.5 1.8 6.4-.4"/>',
  wink:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10.4" r="1.1" fill="currentColor" stroke="none"/><path d="M13.7 10.5q1.2-1.1 2.6 0"/><path d="M8 14.4q4 2.7 8 0"/>',
  tongue:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10.4" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.4" r="1.1" fill="currentColor" stroke="none"/><path d="M8 14.2q4 2.5 8 0"/><path d="M11 15.6h2.6v1c0 1.3-2.6 1.3-2.6 0z" fill="currentColor" stroke="none"/>',
  think:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.6" r="1.1" fill="currentColor" stroke="none"/><path d="M13.6 8.2q1.4-.8 2.6.2"/><path d="M9.2 15.4q2-.9 4 0"/>',
  neutral:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.6" r="1.1" fill="currentColor" stroke="none"/><path d="M8.8 15.2h6.4"/>',
  sad:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.6" r="1.1" fill="currentColor" stroke="none"/><path d="M8.2 16q3.8-2.6 7.6 0"/>',
  cry:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10.4" r="1.05" fill="currentColor" stroke="none"/><circle cx="15" cy="10.4" r="1.05" fill="currentColor" stroke="none"/><path d="M8.4 16.2q3.6-2.4 7.2 0"/><path d="M8.2 12.4q-1.3 1.9-1.3 2.9a1.05 1.05 0 0 0 2.1 0q0-1-.8-2.9z" fill="currentColor" stroke="none"/><path d="M15.8 12.4q1.3 1.9 1.3 2.9a1.05 1.05 0 0 1-2.1 0q0-1 .8-2.9z" fill="currentColor" stroke="none"/>',
  angry:'<circle cx="12" cy="12" r="9"/><path d="M7.3 9.5l2.6 1.1"/><path d="M16.7 9.5l-2.6 1.1"/><circle cx="9.2" cy="11.8" r="1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="11.8" r="1" fill="currentColor" stroke="none"/><path d="M8.6 16.2q3.4-2.4 6.8 0"/>',
  sleepy:'<circle cx="12" cy="12" r="9"/><path d="M7.6 10.6h2.6"/><path d="M13.8 10.6h2.6"/><circle cx="12" cy="15.4" r="1.2"/><path d="M15.6 5.2h2.9l-2.9 2.9h2.9"/>',
  party:'<circle cx="12" cy="12" r="9"/><path d="M7.6 10.8q1.2-1.2 2.4 0"/><path d="M14 10.8q1.2-1.2 2.4 0"/><path d="M8.4 14.4q3.6 2.6 7.2 0"/><path d="M15.5 3.4l3 4.6-4.7-1.7z" fill="currentColor" stroke="none"/><circle cx="6" cy="5.5" r=".7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r=".7" fill="currentColor" stroke="none"/><circle cx="4.5" cy="10" r=".6" fill="currentColor" stroke="none"/>',
  wow:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10.4" r="1.35"/><circle cx="15" cy="10.4" r="1.35"/><ellipse cx="12" cy="15.2" rx="1.7" ry="2.2"/>',
  kiss:'<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10.6" r="1.05" fill="currentColor" stroke="none"/><path d="M13.8 10.6q1.2-1 2.5 0"/><path d="M10.8 15.1c0-1.1 2.2-1.1 2.2 0s-2.2 1.5-2.2 0z"/><path d="M16 6.5c-.6-.8-1.9-.4-1.9.6 0 .9 1.9 2 1.9 2s1.9-1.1 1.9-2c0-1-1.3-1.4-1.9-.6z" fill="currentColor" stroke="none"/>',
  /* --- Жесты --- */
  'thumb-up':'<path d="M8 19.2h8.3a1.7 1.7 0 0 0 1.7-1.35l1.1-5.5a1.5 1.5 0 0 0-1.5-1.85H13l.95-3.7a1.75 1.75 0 0 0-3.3-1.15L8 10.9z"/><rect x="4.6" y="10.9" width="3.4" height="8.3" rx=".9"/>',
  'thumb-down':'<path d="M8 4.8h8.3a1.7 1.7 0 0 1 1.7 1.35l1.1 5.5a1.5 1.5 0 0 1-1.5 1.85H13l.95 3.7a1.75 1.75 0 0 1-3.3 1.15L8 13.1z"/><rect x="4.6" y="4.8" width="3.4" height="8.3" rx=".9"/>',
  clap:'<path d="M8.2 20l-3.4-3.4a1.5 1.5 0 0 1 2.1-2.1l4.1 4.1"/><path d="M10.5 11.4l-1.9-1.9a1.5 1.5 0 0 1 2.1-2.1l5.3 5.3a1.5 1.5 0 0 1-2.1 2.1"/><path d="M13 6.4l-.8 2"/><path d="M16.5 8l-1.6 1.5"/><path d="M17.6 12l-2 .4"/>',
  pray:'<path d="M11.4 18.8c-1.6-.3-2.4-1.4-2.1-3.4l1-8.8c.14-1.25 2-1.15 2 .1v6.5"/><path d="M12.6 18.8c1.6-.3 2.4-1.4 2.1-3.4l-1-8.8c-.14-1.25-2-1.15-2 .1v6.5"/><path d="M9.6 15.4l4.8 0"/>',
  fist:'<path d="M6.6 11.4a1.3 1.3 0 0 1 1.3-1.3h8.2a1.3 1.3 0 0 1 1.3 1.3v4.4a2.5 2.5 0 0 1-2.5 2.5H9a2.5 2.5 0 0 1-2.4-2.5z"/><path d="M8.8 10.1v-1.3"/><path d="M11.2 10.1v-1.6"/><path d="M13.6 10.1v-1.6"/><path d="M16 10.1v-1.3"/><path d="M6.6 13.6H5.3a1.1 1.1 0 0 0 0 2.2h1.3"/>',
  muscle:'<path d="M5 8.5v1.6a1 1 0 0 0 1 1h2.6a4.5 4.5 0 0 1 4.5 4.5v2.4a2 2 0 0 1-2 2H9.2A4.2 4.2 0 0 1 5 15.8"/><path d="M8.6 11.1a5.3 5.3 0 0 1 5 4.9"/>',
  ok:'<circle cx="8.6" cy="15.2" r="3.5"/><path d="M11.3 12.6l1.5-3.5"/><path d="M12.7 13.4l2.7-2.3"/><path d="M13.4 15l3.1-.8"/>',
  wave:'<path d="M9 20.2a4 4 0 0 1-4-4v-2.8a1 1 0 0 1 2 0V15"/><path d="M7 13.7V8.4a1 1 0 0 1 2 0V14"/><path d="M9 14V6.7a1 1 0 0 1 2 0V14"/><path d="M11 14V7.6a1 1 0 0 1 2 0V15"/><path d="M13 15v-3.1a1 1 0 0 1 2 0v3.7a4 4 0 0 1-4 4"/><path d="M16.3 7.4q1.3 1.1 0 3.1"/>',
  'point-up':'<path d="M12 3.6a1.4 1.4 0 0 1 1.4 1.4v6.5"/><path d="M9.4 11.6h4.4a2 2 0 0 1 2 2v2.6a3 3 0 0 1-3 3h-2.2a3.4 3.4 0 0 1-3.4-3.4v-2.4a1.8 1.8 0 0 1 1.8-1.8z"/><path d="M9.2 14.4H8a1 1 0 0 0 0 2h1.2"/>',
  /* --- Символы --- */
  fire:'<path d="M12 3c1 3.2 4.2 4.3 4.2 8.2a4.2 4.2 0 0 1-8.4 0c0-1.6.75-2.7 1.6-3.2.2 1.05 1.05 1.6 1.6 1.6-1.05-2.1.5-4.8 1-6.4z"/><path d="M12 18a2 2 0 0 1-2-2c0-1 1-1.7 1.2-2.6.4.9 1.1 1.2 1.4 2 .3-.5.6-.8.6-1.4.5.5.8 1.3.8 2a2 2 0 0 1-2 2z" fill="currentColor" stroke="none"/>',
  spark:'<path d="M12 4l1.6 5.4 5.4 1.6-5.4 1.6L12 18l-1.6-5.4L5 11l5.4-1.6z" fill="currentColor" stroke="none"/><path d="M18.6 4.4v2.8"/><path d="M17.2 5.8h2.8"/><path d="M5.6 16v2.6"/><path d="M4.3 17.3h2.6"/>',
  star:'<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z"/>',
  hundred:'<path d="M4.8 10.2l1.7-1.1v6.1"/><rect x="8" y="9.1" width="3.9" height="6.1" rx="1.95"/><rect x="13.4" y="9.1" width="3.9" height="6.1" rx="1.95"/><path d="M3.7 17.2h14.8"/><path d="M4.6 18.7h13"/>',
  check:'<path d="M4.8 12.4l4.6 4.6L19.2 6.6"/>',
  cross:'<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
  bolt:'<path d="M13 3l-7 10.4h5l-1 7.6 7-11.2h-5z" fill="currentColor" stroke="none"/>',
  popper:'<path d="M3.8 20.2l4.6-1.8-2.8-2.8z" fill="currentColor" stroke="none"/><path d="M8.4 18.4q3.2-1.7 4.8-5"/><path d="M13.5 6.6l1.4-2.2"/><path d="M16.3 9l2.4-1"/><path d="M15.6 13.2l2.6.4"/><path d="M11.4 5.3l.4-2.3"/><circle cx="18.4" cy="15.4" r=".7" fill="currentColor" stroke="none"/><circle cx="19.4" cy="11.2" r=".6" fill="currentColor" stroke="none"/>',
  trophy:'<path d="M8 4h8v3.2a4 4 0 0 1-8 0z"/><path d="M8 5.2H6a2 2 0 0 0 2 2"/><path d="M16 5.2h2a2 2 0 0 1-2 2"/><path d="M12 11.2v2.6"/><path d="M10 13.8h4v3.2h-4z"/><path d="M8.8 20h6.4"/>',
  medal:'<path d="M9.2 3.2l2.2 5.2"/><path d="M14.8 3.2l-2.2 5.2"/><circle cx="12" cy="15" r="5"/><path d="M12 12.4l.9 1.9 2.1.3-1.5 1.5.35 2.1L12 17.3l-1.85 1-.35-2.1L8.5 14.6l2.1-.3z" fill="currentColor" stroke="none"/>',
  gem:'<path d="M6 5h12l3 4-9 11L3 9z"/><path d="M3 9h18"/><path d="M9 5L6.6 9 12 20"/><path d="M15 5l2.4 4L12 20"/>',
  money:'<path d="M9.2 6h5.6l-1.4 2.4a6 6 0 1 1-2.8 0z"/><path d="M12 12v5"/><path d="M13.7 12.9a2 2 0 0 0-3.1.5c0 1.9 3.1.8 3.1 2.7a2 2 0 0 1-3.1.5"/>',
  rocket:'<path d="M12 3c2.5 2.1 4 5.1 4 8.2l-2 2h-4l-2-2C8 8.1 9.5 5.1 12 3z"/><circle cx="12" cy="9" r="1.5"/><path d="M8 13.4l-2.2 3 3.2-1"/><path d="M16 13.4l2.2 3-3.2-1"/><path d="M10.4 16.2c0 2 1.6 3.4 1.6 3.4s1.6-1.4 1.6-3.4"/>',
  heart:'<path d="M12 20.2S4 14.6 4 9A3.9 3.9 0 0 1 12 6.2 3.9 3.9 0 0 1 20 9c0 5.6-8 11.2-8 11.2z" fill="currentColor" stroke="none"/>',
  'heart-broken':'<path d="M12 20.2S4 14.6 4 9A3.9 3.9 0 0 1 12 6.2 3.9 3.9 0 0 1 20 9c0 5.6-8 11.2-8 11.2z"/><path d="M12 6.4l-1.9 3.1 2.5 2.1-2.1 2.7 1.2 2.4"/>',
  eyes:'<path d="M2.8 11c1.4-1.9 3.2-2.85 4.5-2.85S10.4 9.1 11.8 11c-1.4 1.9-3.2 2.85-4.5 2.85S4.2 12.9 2.8 11z"/><circle cx="7.3" cy="11" r="1.45" fill="currentColor" stroke="none"/><path d="M12.2 11c1.4-1.9 3.2-2.85 4.5-2.85S20.4 9.1 21.8 11c-1.4 1.9-3.2 2.85-4.5 2.85S13.6 12.9 12.2 11z"/><circle cx="16.7" cy="11" r="1.45" fill="currentColor" stroke="none"/>',
  rainbow:'<path d="M3.5 18a8.5 8.5 0 0 1 17 0"/><path d="M6.3 18a5.7 5.7 0 0 1 11.4 0"/><path d="M9.1 18a2.9 2.9 0 0 1 5.8 0"/>',
  sun:'<circle cx="12" cy="12" r="3.9"/><path d="M12 3v2.4"/><path d="M12 18.6V21"/><path d="M3 12h2.4"/><path d="M18.6 12H21"/><path d="M5.6 5.6l1.7 1.7"/><path d="M16.7 16.7l1.7 1.7"/><path d="M18.4 5.6l-1.7 1.7"/><path d="M7.3 16.7l-1.7 1.7"/>',
  moon:'<path d="M18.2 13.6A7 7 0 0 1 9 5.1a7 7 0 1 0 9.2 8.5z"/>',
  crown:'<path d="M4 17l1.6-9 4.1 4.1L12 6l2.3 6.1L18.4 8 20 17z"/><path d="M4.4 17.2h15.2v2.6H4.4z"/>'
};
/* Порядок и группировка для рендера пикера */
const CP_OKO_GROUPS = [
  ['Смайлы', ['happy','laugh','love','cool','wink','tongue','think','neutral','sad','cry','angry','sleepy','party','wow','kiss']],
  ['Жесты', ['thumb-up','thumb-down','clap','pray','fist','muscle','ok','wave','point-up']],
  ['Символы', ['fire','spark','star','hundred','check','cross','bolt','popper','trophy','medal','gem','money','rocket','heart','heart-broken','eyes','rainbow','sun','moon','crown']]
];
/* Единый рендер фирменного SVG-эмодзи (пикер + сообщение). База стиля — на <svg>. */
function cpOkoSvg(key, size){
  const inner = CP_OKO_EMOJI[key]; if(!inner) return '';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
let cpPanelOpen = false;
function cpBuildPanel(){
  const composer = document.querySelector('#convBody .composer');
  if(!composer || document.getElementById('cpSmile')) return;
  /* кнопка-смайл слева */
  const smile = document.createElement('button');
  smile.className = 'tool cp-smile'; smile.id = 'cpSmile'; smile.title = 'Стикеры и эмодзи';
  smile.innerHTML = I('laugh');
  smile.onclick = cpTogglePanel;
  composer.insertBefore(smile, composer.firstChild);
  /* панель над полем ввода (между compose-bar и composer) */
  const panel = document.createElement('div');
  panel.className = 'cp-panel'; panel.id = 'cpPanel';
  const tabs = [['emoji','Эмодзи','laugh'],['stickers','Стикеры','sticker'],['oko','OKO','logo'],['ton','TON','vs-gem']];
  panel.innerHTML =
    `<div class="cp-panel-tabs">${tabs.map(([k,l,ic])=>
      `<button class="cp-tab" data-tab="${k}" onclick="cpPanelTab('${k}')">${cpTabIco(k,ic)}<span>${l}</span></button>`).join('')}</div>
     <div class="cp-panel-body" id="cpPanelBody"></div>`;
  composer.parentNode.insertBefore(panel, composer);
}
function cpTabIco(k, ic){
  if(k==='ton' && typeof vsTonSvg === 'function') return `<span class="cp-tab-ton">${vsTonSvg('vs-gem',18)}</span>`;
  return I(ic);
}
function cpTogglePanel(){ cpPanelOpen ? cpClosePanel() : cpOpenPanel(); }
function cpOpenPanel(){
  const p = document.getElementById('cpPanel'); if(!p) return;
  cpPanelOpen = true; p.classList.add('on');
  document.getElementById('cpSmile') && document.getElementById('cpSmile').classList.add('on');
  const inp = document.getElementById('msgInput'); if(inp) inp.blur(); /* прячем клавиатуру, как в TG */
  cpPanelTab(CP.panelTab || 'emoji');
  if(typeof nvPush==='function') nvPush('cp:panel', ()=>cpClosePanel(true));
}
function cpClosePanel(fromNav){
  const p = document.getElementById('cpPanel'); if(!p || !cpPanelOpen) return;
  cpPanelOpen = false; p.classList.remove('on');
  document.getElementById('cpSmile') && document.getElementById('cpSmile').classList.remove('on');
  if(!fromNav && typeof nvPop==='function') nvPop('cp:panel');
}
function cpPanelTab(tab){
  CP.panelTab = tab; cpSave();
  document.querySelectorAll('#cpPanel .cp-tab').forEach(b=>b.classList.toggle('on', b.dataset.tab===tab));
  const body = document.getElementById('cpPanelBody'); if(!body) return;
  body.scrollTop = 0;
  if(tab==='emoji'){
    try{
      const btn = k => `<button class="cp-emoji cp-emoji-svg" title="${k}" onclick="cpInsertOko('${k}')">${cpOkoSvg(k,28)}</button>`;
      /* недавние (только валидные ключи фирменного набора) */
      const rec = CP.recentOko.filter(k=>CP_OKO_EMOJI[k]);
      const recent = rec.length
        ? `<div class="cp-emoji-sec">Недавние</div><div class="cp-emoji-grid">${rec.map(btn).join('')}</div>` : '';
      const groups = CP_OKO_GROUPS.map(([label,keys])=>
        `<div class="cp-emoji-sec">${label}</div><div class="cp-emoji-grid">${keys.map(btn).join('')}</div>`).join('');
      body.innerHTML = recent + groups;
    }catch(e){ body.innerHTML = `<div class="cp-panel-empty">Эмодзи скоро появятся</div>`; }
    return;
  }
  /* стикер-вкладки: используем ядровые STICKERS/sendSticker/stickerSvg (verify-stickers их расширяет) */
  const list = (typeof STICKERS!=='undefined') ? STICKERS : [];
  const svg = (typeof stickerSvg==='function') ? stickerSvg : (s,z)=>I(s.ic);
  let items = [];
  if(tab==='stickers') items = list.map((s,i)=>({s,i})).filter(x=>!x.s.pack && ['fire','heart','thumb','laugh','wow','sad'].includes(x.s.ic));
  else if(tab==='oko')  items = list.map((s,i)=>({s,i})).filter(x=>!x.s.pack && !['fire','heart','thumb','laugh','wow','sad'].includes(x.s.ic));
  else if(tab==='ton')  items = list.map((s,i)=>({s,i})).filter(x=>x.s.pack==='ton');
  if(!items.length){ body.innerHTML = `<div class="cp-panel-empty">Набор скоро появится</div>`; return; }
  const head = tab==='ton'
    ? `<div class="cp-emoji-sec cp-ton-sec">TON Crystal${(typeof vsPremiumOk==='function' && !vsPremiumOk())?' <b>PRO</b>':''}</div>`
    : tab==='oko' ? `<div class="cp-emoji-sec">Фирменные OKO</div>` : `<div class="cp-emoji-sec">Стикеры</div>`;
  body.innerHTML = head + `<div class="cp-stk-grid">${items.map(({s,i})=>{
    const locked = s.pack==='ton' && typeof vsPremiumOk==='function' && !vsPremiumOk();
    return `<button class="cp-stk ${locked?'cp-stk-lock':''}" onclick="cpSendStk(${i})">${svg(s,60)}${
      locked?`<span class="cp-stk-lockic">${I('lock')}</span>`:''}<small>${s.label}</small></button>`;
  }).join('')}</div>`;
}
/* Вставка фирменного эмодзи: в поле уходит шорткод :oko-KEY:, который при рендере
   сообщения превращается обратно в брендовый SVG (переживает отправку/приём). */
function cpInsertOko(key){
  try{
    if(!CP_OKO_EMOJI[key]) return;
    const inp = document.getElementById('msgInput'); if(!inp) return;
    const token = ':oko-'+key+':';
    const s = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? inp.value.length;
    inp.value = inp.value.slice(0,s) + token + inp.value.slice(en);
    const pos = s + token.length; try{ inp.setSelectionRange(pos,pos); inp.focus(); }catch(_){}
    CP.recentOko = [key, ...CP.recentOko.filter(x=>x!==key)].slice(0,24); cpSave();
    if(typeof syncSendIcon==='function') syncSendIcon();
  }catch(e){}
}
/* Замена шорткодов :oko-KEY: на инлайн-SVG в готовом HTML сообщения. */
function cpRenderOkoTokens(html){
  if(typeof html!=='string' || html.indexOf(':oko-')<0) return html;
  return html.replace(/:oko-([a-z0-9-]+):/g, (m,k)=>
    CP_OKO_EMOJI[k] ? `<span class="cp-oko-emoji" title="${k}">${cpOkoSvg(k,20)}</span>` : m);
}
/* Chain-патч ядрового msgHtml: прогоняем результат через замену шорткодов. */
if(typeof msgHtml === 'function'){
  const _cpPrevMsgHtml = msgHtml;
  msgHtml = function(){
    let out = _cpPrevMsgHtml.apply(this, arguments);
    try{ out = cpRenderOkoTokens(out); }catch(e){}
    return out;
  };
}
/* Обратная совместимость: старый вызов из ядра/др. модулей не должен падать. */
function cpInsertEmoji(e){
  try{
    const inp = document.getElementById('msgInput'); if(!inp) return;
    const s = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? inp.value.length;
    inp.value = inp.value.slice(0,s) + e + inp.value.slice(en);
    const pos = s + e.length; try{ inp.setSelectionRange(pos,pos); }catch(_){}
    CP.recentEmoji = [e, ...CP.recentEmoji.filter(x=>x!==e)].slice(0,24); cpSave();
    if(typeof syncSendIcon==='function') syncSendIcon();
  }catch(_){}
}
function cpSendStk(i){
  if(typeof sendSticker==='function') sendSticker(i); /* verify-stickers сам гейтит TON + дождь кристаллов */
  /* панель оставляем открытой — как в Telegram */
}

/* ================= 8. ГОЛОСОВЫЕ: волна с прогрессом + кружок-плеер ================= */
function cpVoiceProg(voice, p){
  if(!voice) return;
  voice.style.setProperty('--cp-vp', p);
  const bars = voice.querySelectorAll('.wave i'); const n = bars.length; const k = Math.round(p*n);
  bars.forEach((b,i)=>b.classList.toggle('cp-on', i<k));
}
function cpEnhanceVoicePlay(btn){
  const voice = btn.closest('.voice'); if(!voice) return;
  const use = btn.querySelector('use');
  const playing = use && use.getAttribute('href')==='#i-pause';
  voice.classList.toggle('cp-playing', playing);
  if(btn._audio && !btn._audio._cpB){
    btn._audio._cpB = 1;
    btn._audio.addEventListener('timeupdate', ()=>cpVoiceProg(voice, btn._audio.currentTime/(btn._audio.duration||1)));
    btn._audio.addEventListener('play',  ()=>voice.classList.add('cp-playing'));
    btn._audio.addEventListener('pause', ()=>voice.classList.remove('cp-playing'));
    btn._audio.addEventListener('ended', ()=>{ voice.classList.remove('cp-playing'); cpVoiceProg(voice,0); });
  }
}
if(typeof togglePlay === 'function'){
  const _cpPrevTogglePlay2 = togglePlay;
  togglePlay = function(btn){ _cpPrevTogglePlay2.apply(this, arguments); if(btn) cpEnhanceVoicePlay(btn); };
}
/* круглый плеер видео-кружка: кольцо прогресса, центр-иконка, скорость */
function cpDecorateVnotes(){
  const el = cpMsgsEl(); if(!el) return;
  el.querySelectorAll('.vnote').forEach(v=>{
    if(v._cpVn) return; v._cpVn = 1;
    if(!v.querySelector('.cp-vn-ring')){
      v.insertAdjacentHTML('afterbegin',
        `<svg class="cp-vn-ring" viewBox="0 0 100 100"><circle class="cp-vn-tr" cx="50" cy="50" r="47.5"/><circle class="cp-vn-fl" cx="50" cy="50" r="47.5"/></svg>`);
    }
    const vid = v.querySelector('video');
    const fl = v.querySelector('.cp-vn-fl'); const C = 2*Math.PI*47.5;
    if(fl){ fl.style.strokeDasharray = C; fl.style.strokeDashoffset = C; }
    if(!v.querySelector('.cp-vn-play')) v.insertAdjacentHTML('beforeend', `<span class="cp-vn-play">${I('play')}</span>`);
    if(vid){
      if(!v.querySelector('.cp-vn-speed')){
        const b = document.createElement('button'); b.className = 'cp-vn-speed'; b.textContent = cpSpeedLabel();
        b.onclick = e=>{ e.stopPropagation(); cpCycleSpeed(e); };
        v.appendChild(b);
      }
      vid.addEventListener('timeupdate', ()=>{ if(fl){ const p = vid.currentTime/(vid.duration||1); fl.style.strokeDashoffset = C*(1-p); } });
      vid.addEventListener('play',  ()=>{ try{ vid.playbackRate = CP.speed; }catch(_){} v.classList.add('cp-vn-playing'); });
      vid.addEventListener('pause', ()=>v.classList.remove('cp-vn-playing'));
      vid.addEventListener('ended', ()=>{ v.classList.remove('cp-vn-playing'); if(fl) fl.style.strokeDashoffset = C; });
    }
  });
}

/* ================= 9. ЗАПИСЬ: кружок/пульс/таймер + отмена свайпом ================= */
let cpRecMoveH = null, cpRecStartX = null, cpRecStartY = null, cpRecArmed = false, cpRecPvTry = null, cpRecLocked = false;
const CP_REC_BARS = 34;
const CP_LOCK_DIST = 96;   /* свайп вверх до блокировки записи (как в Telegram) */
/* живая волна записи: реальная амплитуда микрофона через Web Audio (как в Telegram) */
let cpRecAC = null, cpRecAn = null, cpRecRAF = 0, cpRecStreamHooked = null;
function cpRecWaveStart(stream){
  if(!stream || cpRecStreamHooked === stream) return;
  const wave = document.getElementById('cpRecWave'); if(!wave) return;
  const AC = window.AudioContext || window.webkitAudioContext; if(!AC) return;
  try{
    cpRecWaveStop();
    cpRecStreamHooked = stream;
    cpRecAC = new AC();
    if(cpRecAC.state === 'suspended') cpRecAC.resume().catch(()=>{});
    const src = cpRecAC.createMediaStreamSource(stream);
    cpRecAn = cpRecAC.createAnalyser();
    cpRecAn.fftSize = 128; cpRecAn.smoothingTimeConstant = 0.72;
    src.connect(cpRecAn);
    const bins = new Uint8Array(cpRecAn.frequencyBinCount);
    const bars = Array.prototype.slice.call(wave.children);
    wave.classList.add('cp-rec-wave-live');
    const half = bars.length / 2;
    /* голос живёт в нижних/средних бинах — растягиваем полезный диапазон на пол-волны */
    const usable = Math.max(4, Math.min(cpRecAn.frequencyBinCount - 1, 30));
    const span = Math.ceil(half);
    const loop = ()=>{
      if(!cpRecAn){ return; }
      cpRecAn.getByteFrequencyData(bins);
      for(let i=0; i<bars.length; i++){
        /* симметрично зеркалим спектр от центра наружу: центр — низ/середина (громче) */
        const d = Math.abs(i + 0.5 - half);
        const b0 = 1 + Math.floor(d / span * usable);
        /* берём максимум по окну из 2 бинов — без «мёртвых» полос на чистых тонах */
        const raw = Math.max(bins[b0] || 0, bins[b0 + 1] || 0) / 255;
        const h = Math.max(0.12, Math.min(1, Math.pow(raw, 0.7) * 1.4));
        bars[i].style.transform = 'scaleY(' + h.toFixed(3) + ')';
      }
      cpRecRAF = requestAnimationFrame(loop);
    };
    cpRecRAF = requestAnimationFrame(loop);
  }catch(_){ cpRecStreamHooked = null; }
}
function cpRecWaveStop(){
  if(cpRecRAF){ cancelAnimationFrame(cpRecRAF); cpRecRAF = 0; }
  cpRecAn = null;
  if(cpRecAC){ try{ cpRecAC.close(); }catch(_){} cpRecAC = null; }
  cpRecStreamHooked = null;
  const wave = document.getElementById('cpRecWave');
  if(wave){
    wave.classList.remove('cp-rec-wave-live');
    Array.prototype.forEach.call(wave.children, b=>{ b.style.transform = ''; });
  }
}
function cpRecOverlay(){
  let o = document.getElementById('cpRec');
  if(o) return o;
  o = document.createElement('div'); o.id = 'cpRec'; o.className = 'cp-rec';
  o.innerHTML =
    `<div class="cp-rec-lock" id="cpRecLock"><span class="cp-rec-lock-ch">${I('chev')}</span><span class="cp-rec-lock-ic">${I('lock')}</span></div>
     <div class="cp-rec-cancel" id="cpRecCancel"><span class="cp-rec-trash">${I('trash')}</span></div>
     <button class="cp-rec-send" id="cpRecSend" title="Отправить">${I('send')}</button>
     <div class="cp-rec-stage">
       <div class="cp-rec-ring"></div><div class="cp-rec-ring cp-rec-ring2"></div>
       <div class="cp-rec-bubble" id="cpRecBubble">
         <video id="cpRecVid" playsinline muted></video>
         <span class="cp-rec-mic">${I('mic')}</span>
       </div>
     </div>
     <div class="cp-rec-wave" id="cpRecWave">${
        Array.from({length: CP_REC_BARS}, ()=>'<i></i>').join('')}</div>
     <div class="cp-rec-info"><span class="cp-rec-dot"></span><span id="cpRecTime">0:00</span>
       <span class="cp-rec-hint"><span class="cp-rec-arrow">${I('chev')}</span>Смахните влево — отмена, вверх — закрепить</span>
       <span class="cp-rec-hint cp-rec-hint-locked">Запись закреплена</span></div>`;
  document.body.appendChild(o);
  const cancelBtn = o.querySelector('#cpRecCancel');
  if(cancelBtn) cancelBtn.onclick = ()=>{ cpCancelRec(); };
  const sendBtn = o.querySelector('#cpRecSend');
  if(sendBtn) sendBtn.onclick = ()=>{ cpRecSendLocked(); };
  return o;
}
function cpRecShow(){
  const isV = (typeof recMode!=='undefined' && recMode==='vnote');
  const o = cpRecOverlay();
  o.classList.toggle('cp-rec-video', isV);
  o.classList.remove('cp-rec-locked','cp-rec-arm');
  o.style.removeProperty('--cp-cx'); o.style.removeProperty('--cp-lk');
  o.classList.add('on'); cpRecArmed = false; cpRecLocked = false; cpRecStartX = null; cpRecStartY = null;
  const vid = document.getElementById('cpRecVid');
  if(vid){ vid.srcObject = null; vid.style.display = isV ? 'block' : 'none'; }
  /* сброс волны в холостой режим (пока микрофон не подключился / нет доступа) */
  cpRecWaveStop();
  /* recStream появляется асинхронно после getUserMedia — ждём и цепляем:
     video-режим -> живое превью камеры; voice-режим -> живая волна микрофона */
  clearInterval(cpRecPvTry);
  {
    let tries = 0;
    cpRecPvTry = setInterval(()=>{
      tries++;
      if(typeof recStream!=='undefined' && recStream){
        if(isV && vid){ try{ vid.srcObject = recStream; vid.play&&vid.play().catch(()=>{}); }catch(_){} }
        else if(!isV){ cpRecWaveStart(recStream); }
        clearInterval(cpRecPvTry);
      }
      if(tries>50) clearInterval(cpRecPvTry);
    }, 60);
  }
  /* таймер зеркалим из ядрового #recTime */
  cpRecTick();
  clearInterval(cpRecTimeInt);
  cpRecTimeInt = setInterval(cpRecTick, 200);
  /* отмена свайпом: слушаем на кнопке записи (у неё pointer capture) */
  const sb = document.getElementById('sendBtn');
  if(sb && !cpRecMoveH){
    cpRecMoveH = e=>{
      if(cpRecLocked) return;
      if(typeof recStart==='undefined' || !recStart) return;
      if(cpRecStartX===null){ cpRecStartX = e.clientX; cpRecStartY = e.clientY; }
      const dx = e.clientX - cpRecStartX;
      const dy = e.clientY - cpRecStartY;
      /* вверх — закрепление записи (руки свободны); влево — отмена. Ведущая ось решает жест. */
      if(dy < -18 && -dy > Math.abs(dx)){
        const t = Math.min(1, -dy / CP_LOCK_DIST);
        o.style.setProperty('--cp-lk', t.toFixed(3));
        o.style.removeProperty('--cp-cx');
        o.classList.remove('cp-rec-arm'); cpRecArmed = false;
        if(t >= 1) cpRecLock();
        return;
      }
      if(dx < 0){
        const t = Math.min(1, -dx/120);
        o.style.setProperty('--cp-cx', (-dx*0.35)+'px');
        o.style.setProperty('--cp-lk', '0');
        o.classList.toggle('cp-rec-arm', t>=1);
        cpRecArmed = t>=1;
        if(cpRecArmed) cpCancelRec();
      }
    };
    sb.addEventListener('pointermove', cpRecMoveH);
  }
}
let cpRecTimeInt = null;
function cpRecTick(){
  const src = document.getElementById('recTime'), dst = document.getElementById('cpRecTime');
  if(src && dst) dst.textContent = src.textContent || '0:00';
}
function cpRecHide(){
  const o = document.getElementById('cpRec'); if(o){ o.classList.remove('on','cp-rec-arm','cp-rec-locked'); o.style.removeProperty('--cp-cx'); o.style.removeProperty('--cp-lk'); }
  clearInterval(cpRecTimeInt); clearInterval(cpRecPvTry);
  cpRecWaveStop();
  const vid = document.getElementById('cpRecVid'); if(vid){ try{ vid.pause(); }catch(_){} vid.srcObject = null; }
  const sb = document.getElementById('sendBtn');
  if(sb && cpRecMoveH){ sb.removeEventListener('pointermove', cpRecMoveH); cpRecMoveH = null; }
  cpRecStartX = null; cpRecStartY = null; cpRecArmed = false; cpRecLocked = false;
}
/* блокировка записи (свайп вверх): запись продолжается без удержания пальца.
   Ядровой pointerup на #sendBtn перехватываем в capture-фазе, чтобы он не вызвал stopRec. */
function cpRecLock(){
  if(cpRecLocked) return;
  cpRecLocked = true;
  const o = document.getElementById('cpRec');
  if(o){ o.classList.add('cp-rec-locked'); o.classList.remove('cp-rec-arm'); o.style.removeProperty('--cp-cx'); o.style.setProperty('--cp-lk','1'); }
  if(typeof toast==='function') toast('Запись закреплена — можно отпустить');
}
function cpRecSendLocked(){
  if(!cpRecLocked) return;
  cpRecLocked = false;
  if(typeof recStart!=='undefined' && recStart && typeof stopRec==='function') stopRec(); /* ядро сформирует и отправит голосовое/кружок */
  else cpRecHide();
}
/* один глобальный перехватчик: пока запись закреплена — гасим ядровой pointerup, чтобы не остановил запись */
if(!window._cpRecUpHook){
  window._cpRecUpHook = 1;
  document.addEventListener('pointerup', e=>{ if(cpRecLocked) e.stopImmediatePropagation(); }, true);
}
/* аккуратная отмена без правки ядра: сбрасываем recStart -> ядровой pointerup
   не вызовет stopRec (там `if(recStart) stopRec()`), а хвосты чистим сами. */
function cpCancelRec(){
  cpRecLocked = false;
  if(typeof recStart==='undefined' || !recStart){ cpRecHide(); return; }
  try{ if(typeof recInt!=='undefined') clearInterval(recInt); }catch(_){}
  try{
    if(typeof mediaRec!=='undefined' && mediaRec && mediaRec.state && mediaRec.state!=='inactive'){
      mediaRec.onstop = ()=>{}; mediaRec.stop();
    }
  }catch(_){}
  try{ if(typeof recStream!=='undefined' && recStream){ recStream.getTracks().forEach(t=>t.stop()); recStream = null; } }catch(_){}
  try{ if(typeof mediaRec!=='undefined') mediaRec = null; }catch(_){}
  recStart = null;
  const mi = document.getElementById('msgInput'); if(mi) mi.style.display = '';
  const rt = document.getElementById('recTimer'); if(rt) rt.style.display = 'none';
  const pv = document.getElementById('recPreview'); if(pv){ pv.style.display = 'none'; pv.srcObject = null; }
  const sb = document.getElementById('sendBtn'); if(sb) sb.classList.remove('rec');
  cpRecHide();
  if(typeof syncSendIcon==='function') syncSendIcon();
  if(typeof toast==='function') toast('Запись отменена');
}
if(typeof startRec === 'function'){
  const _cpPrevStartRec = startRec;
  startRec = function(){ _cpPrevStartRec.apply(this, arguments); cpRecShow(); };
}
if(typeof stopRec === 'function'){
  const _cpPrevStopRec = stopRec;
  stopRec = function(){ _cpPrevStopRec.apply(this, arguments); cpRecHide(); };
}

/* ================= 10. ЭКРАН ЗВОНКА (богатый, обе темы) ================= */
let cpCallStream = null, cpCallPillInt = null;
function cpBuildCall(){
  const scr = document.getElementById('callScreen'); if(!scr || scr._cpDone) return; scr._cpDone = 1;
  /* кнопка сворачивания */
  if(!document.getElementById('cpCallMin')){
    const mn = document.createElement('button');
    mn.className = 'cp-call-min'; mn.id = 'cpCallMin'; mn.title = 'Свернуть';
    mn.innerHTML = I('chev'); mn.onclick = cpCallMin;
    scr.insertBefore(mn, scr.firstChild);
  }
  /* self-preview video внутри рамки */
  const self = document.getElementById('callSelf');
  if(self && !self.querySelector('.cp-self-vid')){
    const v = document.createElement('video'); v.className = 'cp-self-vid'; v.id = 'cpSelfVid';
    v.playsInline = true; v.muted = true; self.insertBefore(v, self.firstChild);
  }
  /* подписи под контролами */
  const labels = {callMic:'Микро', callCam:'Камера', callSpk:'Динамик'};
  Object.entries(labels).forEach(([id,l])=>{
    const b = document.getElementById(id);
    if(b && !b.querySelector('.cp-cl')){ const s = document.createElement('span'); s.className = 'cp-cl'; s.textContent = l; b.appendChild(s); }
  });
  const end = scr.querySelector('.call-btn.end');
  if(end && !end.querySelector('.cp-cl')){ const s = document.createElement('span'); s.className = 'cp-cl cp-cl-end'; s.textContent = 'Сброс'; end.appendChild(s); }
  /* звуковые кольца вокруг аватара */
  const ava = document.getElementById('callAva');
  if(ava && !ava.parentNode.querySelector('.cp-call-aura')){
    ava.insertAdjacentHTML('beforebegin', `<span class="cp-call-aura"></span><span class="cp-call-aura cp-call-aura2"></span>`);
  }
  /* плашка свёрнутого звонка */
  if(!document.getElementById('cpCallPill')){
    const pill = document.createElement('button');
    pill.className = 'cp-callpill'; pill.id = 'cpCallPill';
    pill.innerHTML = `<span class="cp-callpill-ic">${I('phone')}</span><span class="cp-callpill-tx"><b id="cpPillName">Звонок</b><small id="cpPillTime">00:00</small></span><span class="cp-callpill-open">${I('chev')}</span>`;
    pill.onclick = cpCallRestore;
    document.body.appendChild(pill);
  }
}
function cpCallEnhance(video){
  const ava = document.getElementById('callAva');
  const self = document.getElementById('callSelf');
  const selfV = document.getElementById('cpSelfVid');
  cpCallStopStream();
  if(video && self){
    self.style.display = 'flex';
    if(navigator.mediaDevices && navigator.mediaDevices.getUserMedia){
      navigator.mediaDevices.getUserMedia({video:{facingMode:'user'}, audio:false}).then(st=>{
        if(!document.getElementById('callScreen').classList.contains('open')){ st.getTracks().forEach(t=>t.stop()); return; }
        cpCallStream = st;
        if(selfV){ selfV.srcObject = st; selfV.style.display = 'block'; selfV.play&&selfV.play().catch(()=>{}); }
      }).catch(()=>{ if(selfV) selfV.style.display = 'none'; });
    }
  } else if(selfV){ selfV.style.display = 'none'; }
}
function cpCallStopStream(){
  if(cpCallStream){ try{ cpCallStream.getTracks().forEach(t=>t.stop()); }catch(_){} cpCallStream = null; }
  const selfV = document.getElementById('cpSelfVid'); if(selfV){ selfV.srcObject = null; }
}
function cpCallMin(){
  const scr = document.getElementById('callScreen'); if(!scr) return;
  scr.classList.remove('open');
  const pill = document.getElementById('cpCallPill'); if(!pill) return;
  const nm = document.getElementById('cpPillName'); if(nm) nm.textContent = (document.getElementById('callName')||{}).textContent || 'Звонок';
  pill.classList.add('on');
  clearInterval(cpCallPillInt);
  const upd = ()=>{ const t = document.getElementById('cpPillTime');
    if(t && typeof callSec!=='undefined'){ const m=String(Math.floor(callSec/60)).padStart(2,'0'), s=String(callSec%60).padStart(2,'0'); t.textContent = m+':'+s; } };
  upd(); cpCallPillInt = setInterval(upd, 1000);
}
function cpCallRestore(){
  const scr = document.getElementById('callScreen'); if(scr) scr.classList.add('open');
  const pill = document.getElementById('cpCallPill'); if(pill) pill.classList.remove('on');
  clearInterval(cpCallPillInt);
}
function cpCallHidePill(){ const pill = document.getElementById('cpCallPill'); if(pill) pill.classList.remove('on'); clearInterval(cpCallPillInt); }
/* меняем иконку микрофона при выключении (выверенный набор: mic <-> перечёркнут через CSS) */
if(typeof startCall === 'function'){
  const _cpPrevStartCall = startCall;
  startCall = function(video){ cpBuildCall(); _cpPrevStartCall.apply(this, arguments); cpCallEnhance(video); };
}
if(typeof endCall === 'function'){
  const _cpPrevEndCall = endCall;
  endCall = function(){ _cpPrevEndCall.apply(this, arguments); cpCallStopStream(); cpCallHidePill(); };
}

/* ================= РАСШИРЕНИЕ РЕНДЕРА И ИНИЦИАЛИЗАЦИИ ================= */
if(typeof renderMsgs === 'function'){
  const _cpPrevRenderMsgs2 = renderMsgs;
  renderMsgs = function(){
    _cpPrevRenderMsgs2.apply(this, arguments);
    cpDecorateVnotes();
    cpInitMenuAnchor();
  };
}
if(typeof openConv === 'function'){
  const _cpPrevOpenConv2 = openConv;
  openConv = function(){ cpClosePanel(); _cpPrevOpenConv2.apply(this, arguments); cpBuildPanel(); cpInitMenuAnchor(); };
}
if(typeof closeConv === 'function'){
  const _cpPrevCloseConv2 = closeConv;
  closeConv = function(){ cpClosePanel(); _cpPrevCloseConv2.apply(this, arguments); };
}
/* при отправке текста — прячем панель (как TG после ввода) */
if(typeof sendText === 'function'){
  const _cpPrevSendText = sendText;
  sendText = function(){ const had = document.getElementById('msgInput'); _cpPrevSendText.apply(this, arguments); /* панель НЕ трогаем для стикеров, только для текста */ };
}
(function cpInit2(){
  cpBuildPanel();
  cpBuildCall();
  cpInitMenuAnchor();
  if(typeof currentChat !== 'undefined' && currentChat) cpDecorateVnotes();
})();

/* =======================================================================
   ЧАСТЬ 3 — ОТКРЫТЫЕ / ПРИВАТНЫЕ / ПЛАТНЫЕ ЧАТЫ (префикс cp-)
   Тип чата: public (открыт, виден в поиске) | private (по ссылке-приглашению) |
   paid (доступ по подписке). Бейджи/замки в списке и шапке, paywall через
   walletCharge, комиссия OKO 10% через okoEarn, персист в localStorage.
   ======================================================================= */
const CP_FEE = 0.10;

function cpAcc(c){
  if(!c) return {type:'public', price:0};
  const ov = CP.access[c.id];
  const type  = ov && ov.type ? ov.type : (c.cpType || 'public');
  const price = ov ? (ov.price||0) : (c.cpPrice||0);
  return {type, price};
}
function cpCanManage(){ return typeof isOwner==='function' && isOwner(); }
function cpChatUnlocked(c){ return !!(c && CP.unlocked[c.id]); }
function cpChatLocked(c){ const a = cpAcc(c); return a.type==='paid' && !cpChatUnlocked(c); }
function cpChatSlug(c){ return String((c&&(c.nick||c.name))||'chat').toLowerCase().replace(/[^a-zа-я0-9_]/gi,'').replace(/ё/g,'е').slice(0,18) || 'chat'; }

/* демо-чаты: закрытый платный клуб + приватная комната (реальные данные, не заглушки) */
function cpSeedChats(){
  if(typeof CHATS==='undefined' || !Array.isArray(CHATS)) return;
  if(CHATS.some(c=>c.id==='cp-paid')) return;
  CHATS.push({
    id:'cp-paid', ava:'PRO', name:'OKO PRO · Закрытый клуб', kind:'channel', kindIcon:'crown',
    nick:'okopro', cpType:'paid', cpPrice:490, online:true, time:'', unread:0,
    preview:'Доступ по подписке · инсайды и разборы',
    msgs:[
      {kind:'sys', body:'Закрытый клуб OKO PRO — доступ открывается после оплаты'},
      {in:1, t:'09:00', kind:'text', who:'Даниэль', body:'Внутри клуба: живые разборы кейсов, приватные стратегии продвижения и ранний доступ к новым фичам OKO.'},
      {in:1, t:'09:02', kind:'voice', dur:'0:38', seed:5},
      {in:1, t:'09:05', kind:'text', who:'Даниэль', body:'Каждую неделю — новый разбор канала участника с планом роста на 30 дней.'},
    ]});
  CHATS.push({
    id:'cp-priv', ava:'VIP', name:'Приватная комната', kind:'group', kindIcon:'lock',
    nick:'viproom', cpType:'private', online:false, time:'', unread:0,
    preview:'Только по ссылке-приглашению',
    msgs:[
      {kind:'sys', body:'Приватный чат — попасть можно только по ссылке-приглашению'},
      {in:1, t:'вчера', kind:'text', who:'Аня', body:'Скинула инвайт троим, остальным дам ссылку вручную.'},
      {in:1, t:'вчера', kind:'text', who:'Аня', body:'Тут обсуждаем закрытые запуски — ничего наружу.'},
    ]});
}

/* ---- бейджи/замки в списке чатов ---- */
function cpPaintChatBadges(){
  const list = document.getElementById('chatList'); if(!list) return;
  (typeof CHATS!=='undefined'?CHATS:[]).forEach(c=>{
    const a = cpAcc(c);
    if(a.type==='public') return;
    const sel = (typeof c.id==='number') ? 'openConv('+c.id+')' : "openConv('"+c.id+"')";
    const item = list.querySelector('.chat-item[onclick="'+sel+'"]'); if(!item) return;
    const locked = a.type==='paid' && !cpChatUnlocked(c);
    item.classList.toggle('cp-ci-locked', locked);
    /* угловой значок на аватарке */
    const ava = item.querySelector('.ava');
    if(ava){
      let badge = ava.querySelector('.cp-ci-badge');
      if(!badge){ badge = document.createElement('span'); badge.className='cp-ci-badge'; ava.appendChild(badge); }
      badge.className = 'cp-ci-badge cp-ci-'+(locked?'lock':(a.type==='paid'?'ok':a.type));
      badge.innerHTML = a.type==='paid' ? (cpChatUnlocked(c)?I('check'):I('lock')) : I('lock');
    }
    /* ценовой пилл в строке превью */
    const rows = item.querySelectorAll('.row1');
    const row2 = rows[1];
    if(row2){
      let pill = row2.querySelector('.cp-ci-pill');
      if(a.type==='paid' && !cpChatUnlocked(c)){
        if(!pill){ pill = document.createElement('span'); pill.className='cp-ci-pill'; row2.appendChild(pill); }
        pill.innerHTML = I('lock') + (a.price?a.price+' ₽':'PRO');
      } else if(pill){ pill.remove(); }
    }
  });
}

/* ---- paywall для платного чата ---- */
function cpPaywall(c){
  const a = cpAcc(c);
  const fee = Math.round(a.price*CP_FEE), net = a.price - fee;
  if(typeof showPopup!=='function'){ if(typeof toast==='function') toast('Нужен платный доступ'); return; }
  showPopup({ico:'lock', title:'Закрытый чат',
    body:`«${cpEsc(c.name)}» — доступ по подписке.<br><br>Спишется <b>${a.price} ₽</b> с кошелька. Автору — ${net} ₽, комиссия OKO 10% (${fee} ₽). Доступ останется навсегда.`,
    actions:[
      {label:'Оплатить '+a.price+' ₽', onclick:()=>cpBuyAccess(c)},
      {label:'Позже', ghost:true}
    ]});
}
function cpBuyAccess(c){
  const a = cpAcc(c);
  if(typeof walletCharge!=='function'){ if(typeof toast==='function') toast('Кошелёк недоступен'); return; }
  if(!walletCharge(a.price, 'Доступ к чату: '+c.name)) return; /* сам покажет «недостаточно средств» */
  if(typeof okoEarn==='function') okoEarn(a.price*CP_FEE, 'Комиссия платных чатов 10%');
  CP.unlocked[c.id] = 1; cpSave();
  if(typeof toast==='function') toast('Доступ открыт');
  if(typeof renderChatList==='function') renderChatList(((document.getElementById('chatSearch')||{}).value)||'');
  if(typeof openConv==='function') openConv(c.id);
}

/* ---- шапка чата: бейдж типа + кнопка «доступ» ---- */
function cpDecorateConvAccess(){
  const c = (typeof currentChat!=='undefined') ? currentChat : null;
  const head = document.querySelector('#convBody .conv-head'); if(!head || !c) return;
  const a = cpAcc(c);
  /* кнопка доступа в шапке */
  let btn = document.getElementById('cpAccessBtn');
  if(!btn){
    btn = document.createElement('button'); btn.className='ch-call'; btn.id='cpAccessBtn';
    btn.onclick = cpAccessMenu;
    const anchor = document.getElementById('cpSearchBtn') || head.querySelector('.ch-call');
    head.insertBefore(btn, anchor);
  }
  const showBtn = a.type!=='public' || cpCanManage();
  btn.style.display = showBtn ? 'flex' : 'none';
  btn.title = 'Доступ к чату';
  btn.innerHTML = a.type==='paid' ? I('crown') : a.type==='private' ? I('lock') : I('users');
  /* инлайн-бейдж рядом с именем */
  const nameEl = document.getElementById('convName');
  if(nameEl){
    let badge = document.getElementById('cpConvBadge');
    if(a.type==='public'){ if(badge) badge.remove(); }
    else {
      if(!badge){ badge = document.createElement('span'); badge.id='cpConvBadge'; nameEl.appendChild(badge); }
      const label = a.type==='paid' ? (cpChatUnlocked(c) ? 'PRO · доступ открыт' : (a.price?a.price+' ₽':'PRO')) : 'Приватный';
      badge.className = 'cp-conv-badge cp-cb-'+a.type;
      badge.innerHTML = (a.type==='paid'?I('crown'):I('lock')) + '<span>'+label+'</span>';
    }
  }
}
function cpAccessMenu(){
  const c = (typeof currentChat!=='undefined') ? currentChat : null; if(!c) return;
  if(cpCanManage()) cpManage(c); else cpShareInvite(c);
}

/* ---- ссылка-приглашение (приватные/платные) ---- */
function cpShareInvite(c){
  if(typeof showPopup!=='function') return;
  const link = 'https://oko.app/join/'+cpChatSlug(c);
  showPopup({ico:'share', title:'Ссылка-приглашение',
    body:`Отправь ссылку — по ней откроется доступ к «${cpEsc(c.name)}».<div class="cp-invite"><input id="cpInviteInp" readonly value="${link}"><button class="btn sm" onclick="cpCopyInvite()">${I('copy')} Копировать</button></div>`,
    actions:[{label:'Готово'}]});
}
window.cpCopyInvite = function(){
  const i = document.getElementById('cpInviteInp');
  if(i){ i.select && i.select(); try{ navigator.clipboard && navigator.clipboard.writeText(i.value); }catch(e){} }
  if(typeof toast==='function') toast('Ссылка скопирована');
};

/* ---- управление доступом (владелец) ---- */
let cpMg = null;
function cpManage(c){
  const a = cpAcc(c);
  cpMg = {id:c.id, type:a.type, price:a.price||490};
  cpManageRender();
}
function cpMgReadPrice(){
  if(!cpMg) return;
  const p = document.getElementById('cpMgPrice');
  if(p){ const v = +String(p.value).replace(/\D/g,''); if(v) cpMg.price = v; }
}
function cpManageRender(){
  const d = cpMg; if(!d || typeof showPopup!=='function') return;
  const opt = (t,ic,l,s)=>`<button class="cp-mg-opt ${d.type===t?'on':''}" onclick="cpMgSet('${t}')">${I(ic)}<span class="cp-mg-t"><b>${l}</b><small>${s}</small></span>${d.type===t?I('check'):''}</button>`;
  const body = `<div class="cp-mg">
    ${opt('public','users','Открытый','Виден всем и в поиске')}
    ${opt('private','lock','Приватный','Только по ссылке-приглашению')}
    ${opt('paid','crown','Платный','Доступ по подписке, комиссия OKO 10%')}
    ${d.type==='paid' ? `<div class="cp-mg-price"><label>Цена доступа</label><div class="cp-mg-prow"><input id="cpMgPrice" inputmode="numeric" value="${d.price}" oninput="cpMgPriceInput()"><span>₽</span></div><div class="cp-mg-net">Тебе — <b id="cpMgNet">${d.price-Math.round(d.price*CP_FEE)} ₽</b> с каждой продажи, OKO удержит 10%</div></div>` : ''}
  </div>`;
  showPopup({ico:'lock', title:'Доступ к чату', body, actions:[
    {label:'Сохранить', onclick:cpMgSave},
    {label:'Отмена', ghost:true, onclick:()=>{ cpMg=null; }}
  ]});
}
window.cpMgSet = function(t){ cpMgReadPrice(); if(cpMg){ cpMg.type = t; cpManageRender(); } };
window.cpMgPriceInput = function(){
  const p = document.getElementById('cpMgPrice'); if(!p || !cpMg) return;
  const v = +String(p.value).replace(/\D/g,'')||0; cpMg.price = v;
  const net = document.getElementById('cpMgNet'); if(net) net.textContent = (v-Math.round(v*CP_FEE))+' ₽';
};
function cpMgSave(){
  if(!cpMg) return;
  cpMgReadPrice();
  const d = cpMg;
  CP.access[d.id] = {type:d.type, price:d.type==='paid' ? (d.price||0) : 0};
  if(d.type==='paid' && cpCanManage()) CP.unlocked[d.id] = 1; /* владелец не платит за свой чат */
  cpSave(); cpMg = null;
  if(typeof toast==='function') toast('Настройки доступа сохранены');
  if(typeof renderChatList==='function') renderChatList(((document.getElementById('chatSearch')||{}).value)||'');
  cpDecorateConvAccess();
}

/* ---- патчи: гейт входа + перерисовка списка ---- */
if(typeof openConv === 'function'){
  const _cpPrevOpenConv3 = openConv;
  openConv = function(id){
    const c = (typeof CHATS!=='undefined') ? CHATS.find(x=>x.id===id) : null;
    if(c && cpChatLocked(c)){ cpPaywall(c); return; }
    _cpPrevOpenConv3.apply(this, arguments);
    cpDecorateConvAccess();
  };
}
if(typeof renderChatList === 'function'){
  const _cpPrevRenderChatList = renderChatList;
  renderChatList = function(){ _cpPrevRenderChatList.apply(this, arguments); cpPaintChatBadges(); };
}
if(typeof closeConv === 'function'){
  const _cpPrevCloseConv3 = closeConv;
  closeConv = function(){ if(cpRecLocked) cpCancelRec(); _cpPrevCloseConv3.apply(this, arguments); };
}

(function cpInit3(){
  cpSeedChats();
  if(typeof renderChatList==='function') renderChatList(((document.getElementById('chatSearch')||{}).value)||'');
  if(typeof currentChat!=='undefined' && currentChat) cpDecorateConvAccess();
})();
