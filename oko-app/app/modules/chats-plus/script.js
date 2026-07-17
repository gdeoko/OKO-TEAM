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
function cpSave(){ try{ localStorage.setItem('oko-chats-plus', JSON.stringify({speed:CP.speed})); }catch(e){} }
const cpMsgsEl = () => document.getElementById('msgs');

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
  document.querySelectorAll('.cp-speed').forEach(b=>b.textContent = cpSpeedLabel());
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
