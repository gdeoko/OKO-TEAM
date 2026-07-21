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
if(!CP.panelTab) CP.panelTab = 'emoji';
function cpSave(){ try{ localStorage.setItem('oko-chats-plus', JSON.stringify({speed:CP.speed, recentEmoji:CP.recentEmoji.slice(0,24), panelTab:CP.panelTab})); }catch(e){} }
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
    const recent = CP.recentEmoji.length
      ? `<div class="cp-emoji-sec">Недавние</div><div class="cp-emoji-grid">${CP.recentEmoji.map(e=>
          `<button class="cp-emoji" onclick="cpInsertEmoji('${e}')">${e}</button>`).join('')}</div>` : '';
    body.innerHTML = recent + `<div class="cp-emoji-sec">Смайлы и символы</div><div class="cp-emoji-grid">${
      CP_EMOJI.map(e=>`<button class="cp-emoji" onclick="cpInsertEmoji('${e}')">${e}</button>`).join('')}</div>`;
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
function cpInsertEmoji(e){
  const inp = document.getElementById('msgInput'); if(!inp) return;
  const s = inp.selectionStart ?? inp.value.length, en = inp.selectionEnd ?? inp.value.length;
  inp.value = inp.value.slice(0,s) + e + inp.value.slice(en);
  const pos = s + e.length; try{ inp.setSelectionRange(pos,pos); }catch(_){}
  CP.recentEmoji = [e, ...CP.recentEmoji.filter(x=>x!==e)].slice(0,24); cpSave();
  if(typeof syncSendIcon==='function') syncSendIcon();
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
let cpRecMoveH = null, cpRecStartX = null, cpRecArmed = false, cpRecPvTry = null;
const CP_REC_BARS = 34;
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
    `<div class="cp-rec-cancel" id="cpRecCancel"><span class="cp-rec-trash">${I('trash')}</span></div>
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
       <span class="cp-rec-hint"><span class="cp-rec-arrow">${I('chev')}</span>Смахните для отмены</span></div>`;
  document.body.appendChild(o);
  return o;
}
function cpRecShow(){
  const isV = (typeof recMode!=='undefined' && recMode==='vnote');
  const o = cpRecOverlay();
  o.classList.toggle('cp-rec-video', isV);
  o.classList.add('on'); cpRecArmed = false; cpRecStartX = null;
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
      if(typeof recStart==='undefined' || !recStart) return;
      if(cpRecStartX===null) cpRecStartX = e.clientX;
      const dx = e.clientX - cpRecStartX;
      if(dx < 0){
        const t = Math.min(1, -dx/120);
        o.style.setProperty('--cp-cx', (-dx*0.35)+'px');
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
  const o = document.getElementById('cpRec'); if(o){ o.classList.remove('on','cp-rec-arm'); o.style.removeProperty('--cp-cx'); }
  clearInterval(cpRecTimeInt); clearInterval(cpRecPvTry);
  cpRecWaveStop();
  const vid = document.getElementById('cpRecVid'); if(vid){ try{ vid.pause(); }catch(_){} vid.srcObject = null; }
  const sb = document.getElementById('sendBtn');
  if(sb && cpRecMoveH){ sb.removeEventListener('pointermove', cpRecMoveH); cpRecMoveH = null; }
  cpRecStartX = null; cpRecArmed = false;
}
/* аккуратная отмена без правки ядра: сбрасываем recStart -> ядровой pointerup
   не вызовет stopRec (там `if(recStart) stopRec()`), а хвосты чистим сами. */
function cpCancelRec(){
  if(typeof recStart==='undefined' || !recStart) return;
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
