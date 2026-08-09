/* =============================================================================
   OKO · oko-chat2.js — ЧАТЫ УРОВНЯ TELEGRAM (слой поверх ядра)
   -----------------------------------------------------------------------------
   Эталоны, с которых снят функционал: Telegram (реакции, свайп-ответ, закреп,
   разделитель непрочитанного, поиск по чату, пересылка, мультивыбор, папки),
   Instagram (палитра реакций у пузыря), ВКонтакте (ветки обсуждения),
   YouTube/TikTok (комментарии к записи канала).

   Файл НИЧЕГО не переписывает в ядре: только chain-патчи глобальных функций
   (index.html + app.js), делегированные слушатели и один инлайновый <style>.

   Что НЕ трогаем принципиально:
     • #micBtn / #sendBtn и запись голосовых-кружков — это oko-rec.js;
     • панель эмодзи у поля — oko-emoji.js;
     • oko-v2.*, oko-reels, oko-growth, oko-back, oko-ai, oko-market,
       oko-social, oko-tg — чужая зона.

   Жёсткие правила проекта, соблюдённые здесь:
     • НОЛЬ демо-данных: ни одного выдуманного человека, реакции или «прочитано»;
     • никаких ложных подтверждений — кнопка либо делает дело, либо честно
       объясняет, почему пока не может;
     • эмодзи допустимы ТОЛЬКО как контент реакций, весь интерфейс — SVG из
       спрайта index.html;
     • безопасные зоны — только var(--oko-safe-*);
     • из любого состояния есть выход: крестик, тап вне, Escape, «назад».
   ========================================================================== */
(function(){
'use strict';
if(window.__okoChat2) return; window.__okoChat2 = 1;

/* ===========================================================================
   0. УТИЛИТЫ
   ======================================================================== */
const byId  = id => document.getElementById(id);
const msgsEl = () => byId('msgs');
const conv   = () => byId('convBody');
const E = t => {
  if(typeof esc === 'function') return esc(t);
  return String(t == null ? '' : t).replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
};
const ico = (n, cls) => `<svg class="i ${cls||''}"><use href="#i-${n}"/></svg>`;
const say = m => { try{ if(typeof toast === 'function') toast(m); }catch(e){} };
const chat = () => (typeof currentChat !== 'undefined' ? currentChat : null);
const chats = () => (typeof CHATS !== 'undefined' ? CHATS : []);
const nowT = () => (typeof window.nowT === 'function'
  ? window.nowT() : new Date().toTimeString().slice(0,5));
const quoteOf = m => {
  try{ if(typeof msgQuoteText === 'function') return msgQuoteText(m) || ''; }catch(e){}
  return (m && (m.body || '')) || '';
};

/* Стабильный идентификатор сообщения: индексы в массиве съезжают при удалении,
   поэтому ссылки «ответ на», «закреп» и «ветка» держим по id, а не по номеру. */
let midSeq = 0;
function mid(m){
  if(!m) return '';
  if(!m.ch2id) m.ch2id = 'm' + (++midSeq) + Date.now().toString(36);
  return m.ch2id;
}
function byMid(c, id){
  if(!c || !id) return -1;
  return (c.msgs || []).findIndex(x => x && x.ch2id === id);
}

/* ---- хранилище слоя (папки + активная папка) ---- */
const ST_KEY = 'oko-chat2';
let ST = (function(){
  try{
    const raw = JSON.parse(localStorage.getItem(ST_KEY) || '{}');
    return { folders: Array.isArray(raw.folders) ? raw.folders : [],
             folder: typeof raw.folder === 'string' ? raw.folder : 'all' };
  }catch(e){ return { folders: [], folder: 'all' }; }
})();
function stSave(){
  try{ localStorage.setItem(ST_KEY, JSON.stringify({folders: ST.folders, folder: ST.folder})); }catch(e){}
}

/* ---- права: кто может закреплять / удалять у всех ---- */
function myRoleOwner(){
  try{ return typeof PROFILE !== 'undefined' && PROFILE.role === 'owner'; }catch(e){ return false; }
}
function canPin(c){
  if(!c) return false;
  if(c.kind === 'direct') return true;              /* в личке закрепляют оба */
  return !!(c.owner || c.admin || c.managed) || myRoleOwner();
}
function canDeleteForAll(c, m){
  /* Честно: «удалить у всех» возможно только там, где у чата есть серверная
     сторона (живая комната Supabase) и сообщение наше. */
  return !!(c && c.cid && m && !m.in);
}

/* ===========================================================================
   1. СТИЛИ (один инлайновый <style>, обе темы, только переменные бренда)
   ======================================================================== */
(function css(){
  const s = document.createElement('style');
  s.id = 'oko-chat2-css';
  s.textContent = `
/* ---------- реакции под пузырём ---------- */
.ch2-reacts{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.ch2-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid transparent;
  background:rgba(0,0,0,.18);border-radius:99px;padding:2px 9px;cursor:pointer;
  font:600 11.5px/1.5 var(--font-body,inherit);color:inherit;transition:transform .14s,background .14s,border-color .14s}
.ch2-chip:active{transform:scale(.94)}
.msg.in .ch2-chip{background:var(--lime-dim);color:var(--accent)}
.ch2-chip.on{border-color:var(--lime);background:var(--lime-dim);color:var(--accent)}
.msg.out .ch2-chip.on{background:rgba(0,0,0,.28);color:#000;border-color:rgba(0,0,0,.45)}
.ch2-chip .ch2-em{font-size:13px;line-height:1}
.ch2-chip b{font-weight:700;font-variant-numeric:tabular-nums}

/* ---------- палитра быстрых реакций ---------- */
.ch2-pal{position:fixed;z-index:96;display:flex;gap:2px;padding:5px;border-radius:99px;
  background:var(--raised);border:1px solid var(--border);
  box-shadow:0 14px 34px rgba(0,0,0,.45);opacity:0;transform:scale(.86) translateY(6px);
  transition:opacity .16s ease,transform .18s cubic-bezier(.2,1.2,.4,1);pointer-events:auto}
.ch2-pal.on{opacity:1;transform:none}
.ch2-pal .cp-rp-btn,.ch2-pal .cp-rp-more{width:38px;height:38px;border:0;background:transparent;
  border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;
  font-size:21px;line-height:1;color:var(--text);transition:transform .14s,background .14s}
.ch2-pal .cp-rp-btn:hover,.ch2-pal .cp-rp-btn.hot,
.ch2-pal .cp-rp-more:hover,.ch2-pal .cp-rp-more.hot{background:var(--lime-dim);transform:scale(1.16)}
.ch2-pal .cp-rp-more svg.i{width:19px;height:19px;color:var(--accent)}
.ch2-pal .cp-rp-btn.mine{background:var(--lime-dim);box-shadow:inset 0 0 0 1px var(--lime)}
.ch2-fly{position:fixed;z-index:98;font-size:24px;pointer-events:none;
  animation:ch2Fly .85s cubic-bezier(.2,.8,.3,1) forwards}
@keyframes ch2Fly{0%{opacity:1;transform:translate(-50%,-50%) scale(.7)}
  60%{opacity:1;transform:translate(-50%,-140%) scale(1.5)}
  100%{opacity:0;transform:translate(-50%,-210%) scale(.9)}}

/* ---------- разделитель непрочитанного ---------- */
.msg.ch2-ub{margin-top:42px}
.msg.ch2-ub::before{content:'Непрочитанные сообщения';position:absolute;left:-100vw;right:-100vw;
  top:-36px;height:24px;display:flex;align-items:center;justify-content:center;
  font:700 11px/1 var(--font-body,inherit);letter-spacing:.05em;text-transform:none;
  color:var(--accent);background:var(--lime-dim);
  border-top:1px solid rgba(154,255,0,.32);border-bottom:1px solid rgba(154,255,0,.32);
  pointer-events:none}

/* ---------- кнопка «вниз» со счётчиком ---------- */
#convBody{position:relative}
.ch2-down{position:absolute;right:14px;bottom:var(--ch2-down-b,88px);width:42px;height:42px;
  border-radius:50%;border:1px solid var(--border);background:var(--raised);color:var(--text);
  display:none;align-items:center;justify-content:center;cursor:pointer;z-index:8;
  box-shadow:0 8px 22px rgba(0,0,0,.38);transition:transform .16s,opacity .16s}
.ch2-down.on{display:flex}
.ch2-down:active{transform:scale(.92)}
.ch2-down svg.i{width:19px;height:19px}
.ch2-down .ch2-dn{position:absolute;top:-6px;right:-4px;min-width:19px;height:19px;padding:0 5px;
  border-radius:99px;background:var(--lime);color:#000;font:700 11px/19px var(--font-body,inherit);
  text-align:center;font-variant-numeric:tabular-nums}

/* ---------- полоса ветки обсуждения ---------- */
.ch2-thbar{display:none;align-items:center;gap:10px;padding:7px 14px;flex-shrink:0;
  border-bottom:1px solid var(--border);background:var(--surface)}
.ch2-thbar.on{display:flex}
.ch2-thbar .ch2-th-ic{width:20px;height:20px;color:var(--accent);flex-shrink:0}
.ch2-thbar .ch2-th-ic svg.i{width:20px;height:20px}
.ch2-thbar .ch2-th-txt{flex:1;min-width:0;border-left:2px solid var(--lime);padding-left:9px}
.ch2-thbar .ch2-th-txt b{display:block;font-size:12px;color:var(--accent)}
.ch2-thbar .ch2-th-txt small{display:block;font-size:12px;color:var(--dim);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch2-thbar .ch2-th-x{width:28px;height:28px;flex-shrink:0;color:var(--dim);border:0;
  background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center}
.ch2-thbar .ch2-th-x svg.i{width:17px;height:17px}
.msg.ch2-off{display:none !important}
.ch2-thempty{position:absolute;left:0;right:0;top:44%;transform:translateY(-50%);
  text-align:center;padding:0 26px;color:var(--dim);font-size:13px;line-height:1.5;
  pointer-events:none;z-index:2}
.ch2-thempty svg.i{width:34px;height:34px;color:var(--accent);opacity:.7;margin-bottom:8px}

/* ---------- кнопка «Комментарии» под записью канала ---------- */
.ch2-cmt{display:flex;align-items:center;gap:7px;margin-top:9px;padding:7px 11px;width:100%;
  border:1px solid var(--border);border-radius:11px;background:transparent;cursor:pointer;
  color:var(--accent);font:600 12.5px/1.3 var(--font-body,inherit);text-align:left}
.msg.out .ch2-cmt{border-color:rgba(0,0,0,.28);color:#000}
.ch2-cmt:active{background:var(--lime-dim)}
.ch2-cmt svg.i{width:15px;height:15px;flex-shrink:0}
.ch2-cmt span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ---------- цитата-ответ: кликабельна ---------- */
.msg-quote{cursor:pointer}
.msg-quote span{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msg.ch2-flash{animation:ch2Flash 1.25s ease}
@keyframes ch2Flash{0%,100%{box-shadow:none}
  18%{box-shadow:0 0 0 3px var(--lime)}70%{box-shadow:0 0 0 3px rgba(154,255,0,.18)}}

/* ---------- режим выделения ---------- */
.ch2-selbar{position:absolute;top:0;left:0;right:0;z-index:10;display:none;align-items:center;
  gap:6px;padding:10px 10px 10px 6px;background:var(--surface);
  border-bottom:1px solid var(--border)}
.ch2-selbar.on{display:flex}
.ch2-selbar .ch2-sb-x,.ch2-selbar .ch2-sb-a{width:38px;height:38px;flex-shrink:0;border:0;
  background:transparent;color:var(--text);border-radius:50%;cursor:pointer;
  display:flex;align-items:center;justify-content:center}
.ch2-selbar .ch2-sb-a:disabled{opacity:.32;cursor:default}
.ch2-selbar .ch2-sb-a.danger{color:var(--danger)}
.ch2-selbar .ch2-sb-x:active,.ch2-selbar .ch2-sb-a:active{background:var(--raised)}
.ch2-selbar svg.i{width:19px;height:19px}
.ch2-selbar .ch2-sb-n{flex:1;min-width:0;font:700 14px/1.3 var(--font-body,inherit);color:var(--text);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.msgs.ch2-selmode .msg{cursor:pointer}
.msg .ch2-tick{position:absolute;top:50%;transform:translateY(-50%);width:22px;height:22px;
  border-radius:50%;border:2px solid var(--dim);background:var(--surface);
  display:flex;align-items:center;justify-content:center;pointer-events:none}
.msg.in .ch2-tick{right:-30px}
.msg.out .ch2-tick{left:-30px}
.msg .ch2-tick svg.i{width:12px;height:12px;color:#000;opacity:0}
.msg.ch2-picked .ch2-tick{border-color:var(--lime);background:var(--lime)}
.msg.ch2-picked .ch2-tick svg.i{opacity:1}
.msg.ch2-picked::after{content:'';position:absolute;inset:-4px;border-radius:20px;
  border:2px solid var(--lime);pointer-events:none}
.msgs.ch2-selmode{padding-left:38px;padding-right:38px}

/* ---------- шторка слоя (кто поставил / удалить / переслать / папки) ---------- */
.ch2-sheet{position:fixed;inset:0;z-index:97;display:flex;align-items:flex-end;
  justify-content:center;background:rgba(0,0,0,.55);opacity:0;transition:opacity .18s}
.ch2-sheet.on{opacity:1}
.ch2-card{width:100%;max-width:520px;max-height:min(82vh,720px);display:flex;flex-direction:column;
  background:var(--surface);border:1px solid var(--border);border-bottom:0;
  border-radius:20px 20px 0 0;padding-bottom:calc(10px + var(--oko-safe-bottom,0px));
  transform:translateY(26px);transition:transform .22s cubic-bezier(.2,.9,.3,1)}
.ch2-sheet.on .ch2-card{transform:none}
@media(min-width:900px){
  .ch2-sheet{align-items:center}
  .ch2-card{border-radius:20px;border-bottom:1px solid var(--border);padding-bottom:10px}
}
.ch2-ch{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;flex-shrink:0}
.ch2-ch h4{flex:1;min-width:0;margin:0;font:700 15px/1.3 var(--font-head,inherit);color:var(--text);
  letter-spacing:.01em;overflow-wrap:anywhere}
.ch2-ch .ch2-ch-x{width:34px;height:34px;border:0;background:var(--raised);border-radius:50%;
  color:var(--dim);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ch2-ch .ch2-ch-x svg.i{width:15px;height:15px}
.ch2-cb{overflow-y:auto;padding:0 12px 10px;-webkit-overflow-scrolling:touch}
.ch2-note{padding:8px 16px 12px;color:var(--dim);font-size:12.5px;line-height:1.5;overflow-wrap:anywhere}
.ch2-row{display:flex;align-items:center;gap:11px;width:100%;padding:11px 12px;border:0;
  background:transparent;border-radius:13px;cursor:pointer;text-align:left;color:var(--text);
  font:500 14px/1.35 var(--font-body,inherit)}
.ch2-row:hover,.ch2-row:active{background:var(--raised)}
.ch2-row.danger{color:var(--danger)}
.ch2-row>svg.i,.ch2-row .ch2-r-ic svg.i{width:19px;height:19px;flex-shrink:0}
.ch2-row .ch2-r-ic{width:36px;height:36px;border-radius:50%;background:var(--lime-dim);
  color:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;
  font:700 14px/1 var(--font-head,inherit);overflow:hidden}
.ch2-row .ch2-r-ic .ava{width:36px;height:36px;font-size:14px}
.ch2-row .ch2-r-tx{flex:1;min-width:0}
.ch2-row .ch2-r-tx b{display:block;font-weight:700;font-size:13.5px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.ch2-row .ch2-r-tx small{display:block;color:var(--dim);font-size:12px;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap}
.ch2-row .ch2-r-em{font-size:19px;line-height:1;flex-shrink:0}
.ch2-row .ch2-box{width:22px;height:22px;border-radius:7px;border:2px solid var(--dim);
  flex-shrink:0;display:flex;align-items:center;justify-content:center}
.ch2-row .ch2-box svg.i{width:12px;height:12px;color:#000;opacity:0}
.ch2-row.on .ch2-box{border-color:var(--lime);background:var(--lime)}
.ch2-row.on .ch2-box svg.i{opacity:1}
.ch2-quote{margin:0 16px 10px;padding:8px 11px;border-left:2px solid var(--lime);
  background:var(--raised);border-radius:0 10px 10px 0;color:var(--dim);font-size:12.5px;
  line-height:1.45;max-height:78px;overflow:hidden;overflow-wrap:anywhere}
.ch2-empty{padding:22px 18px;text-align:center;color:var(--dim);font-size:13px;line-height:1.5}
.ch2-inp{width:100%;background:var(--raised);border:1px solid var(--border);border-radius:12px;
  padding:11px 13px;color:var(--text);font-size:14px;outline:none;
  font-family:var(--font-body,inherit)}
.ch2-inp:focus{border-color:var(--lime)}
.ch2-actions{display:flex;gap:9px;padding:10px 16px 4px;flex-shrink:0}
.ch2-btn{flex:1;padding:12px 14px;border-radius:12px;border:1px solid var(--border);
  background:var(--raised);color:var(--text);cursor:pointer;
  font:700 13.5px/1.2 var(--font-body,inherit)}
.ch2-btn.main{background:var(--lime);color:#000;border-color:var(--lime)}
.ch2-btn.danger{color:var(--danger)}
.ch2-btn:active{transform:scale(.985)}
.ch2-grp{padding:12px 16px 5px;color:var(--dim);font:700 11px/1 var(--font-body,inherit);
  letter-spacing:.08em;text-transform:uppercase}

/* ---------- папки ---------- */
.folders .ch2-fnew{color:var(--accent)}
.folders .ch2-fnew svg.i{width:14px;height:14px}
.ch2-fempty{padding:26px 20px;text-align:center;color:var(--dim);font-size:13px;line-height:1.55}
.ch2-fempty svg.i{width:34px;height:34px;color:var(--accent);opacity:.65;margin-bottom:9px}

/* ---------- узкие экраны ---------- */
@media(max-width:400px){
  .ch2-pal .cp-rp-btn,.ch2-pal .cp-rp-more{width:34px;height:34px;font-size:19px}
  .msgs.ch2-selmode{padding-left:32px;padding-right:32px}
  .msg.in .ch2-tick{right:-26px}
  .msg.out .ch2-tick{left:-26px}
}
@media(prefers-reduced-motion:reduce){
  .ch2-pal,.ch2-card,.ch2-sheet{transition:none}
  .ch2-fly,.msg.ch2-flash{animation:none}
}
`;
  document.head.appendChild(s);
})();

/* ===========================================================================
   2. МОДЕЛЬ РЕАКЦИЙ (эмодзи как КОНТЕНТ — интерфейс остаётся на SVG)
   Формат: m.rx = { '👍': {n:2, mine:1, who:['Ты','Имя']} }
   who — ТОЛЬКО реально известные имена, ничего не выдумываем.
   ======================================================================== */
const QUICK = ['👍','❤️','🔥','😂','😮','😢'];
const MORE  = ['🎉','👏','🙏','💯','🤔','😍','⚡','⭐','🤝','😅','🥰','😱','🙌','💪','👀','✅'];
/* мост со старыми SVG-ключами ядра (REACTIONS в index.html) */
const LEGACY = {heart:'❤️', fire:'🔥', thumb:'👍', laugh:'😂', wow:'😮', sad:'😢',
                star:'⭐', crown:'👑'};

function rxOf(m){
  if(!m) return {};
  if(!m.rx){
    m.rx = {};
    /* мягкая миграция со старой модели m.reacts = {svgKey: n} */
    if(m.reacts) Object.keys(m.reacts).forEach(k=>{
      const n = m.reacts[k]|0; if(n <= 0) return;
      const em = LEGACY[k] || k;
      m.rx[em] = {n:n, mine:1, who:['Ты']};
    });
    m.reacts = null;
  }
  return m.rx;
}
function rxToggle(m, em, who, mine){
  const rx = rxOf(m);
  const r = rx[em] || (rx[em] = {n:0, mine:0, who:[]});
  if(mine){
    if(r.mine){ r.mine = 0; r.n = Math.max(0, r.n - 1); r.who = r.who.filter(w => w !== 'Ты'); }
    else      { r.mine = 1; r.n++; r.who.unshift('Ты'); }
  } else {
    r.n++; if(who && r.who.indexOf(who) < 0) r.who.push(who);
  }
  if(r.n <= 0) delete rx[em];
}

/* Рендер чипов под пузырём — переопределяем reactHtml ядра (msgHtml зовёт его
   по имени, поэтому подмена работает без правки ядра). */
window.reactHtml = function(m){
  const rx = rxOf(m);
  const list = Object.keys(rx).filter(k => rx[k] && rx[k].n > 0);
  if(!list.length) return '';
  return '<div class="reacts ch2-reacts">' + list.map(em =>
    `<button type="button" class="react-chip ch2-chip${rx[em].mine ? ' on' : ''}" ` +
    `data-em="${E(em)}" title="Кто поставил реакцию">` +
    `<span class="ch2-em">${E(em)}</span><b>${rx[em].n}</b></button>`).join('') + '</div>';
};

/* Постановка реакции. Принимает и эмодзи, и старый SVG-ключ ядра. */
window.pickReact = function(idx, key){
  const c = chat(); if(!c) return;
  const m = c.msgs[idx]; if(!m) return;
  const em = LEGACY[key] || key;
  rxToggle(m, em, null, true);
  try{ if(typeof closeMsgMenu === 'function') closeMsgMenu(); }catch(e){}
  refresh(idx);
  /* живой чат — транслируем участникам как есть */
  if(c.cid && m.sid && window.liveChannel){
    try{ liveChannel.send({type:'broadcast', event:'reaction',
      payload:{user:(typeof myId !== 'undefined' ? myId : ''), sid:m.sid, r:em}}); }catch(e){}
  }
};

/* Реакция другого участника из живой комнаты — имя берём из реального кэша. */
window.applyLiveReaction = function(sid, r, user){
  if(!sid) return;
  const em = LEGACY[r] || r;
  for(const c of chats()){
    if(!c.cid || !c.msgs) continue;
    const m = c.msgs.find(x => x && x.sid === sid);
    if(!m) continue;
    let who = null;
    try{ if(user && typeof nameCache !== 'undefined' && nameCache[user]) who = nameCache[user]; }catch(e){}
    rxToggle(m, em, who, false);
    if(chat() && chat().id === c.id) refresh(c.msgs.indexOf(m));
    return;
  }
};

function refresh(idx){
  try{ if(typeof refreshMsg === 'function'){ refreshMsg(idx); afterRender(); return; } }catch(e){}
  try{ if(typeof renderMsgs === 'function') renderMsgs(); }catch(e){}
}

/* ---- «кто поставил»: шторка со списком (только реальные имена) ---- */
function openReactors(idx){
  const c = chat(); if(!c) return;
  const m = c.msgs[idx]; if(!m) return;
  const rx = rxOf(m);
  const list = Object.keys(rx).filter(k => rx[k].n > 0);
  const total = list.reduce((a,k) => a + rx[k].n, 0);
  let body = '';
  if(!list.length){
    body = '<div class="ch2-empty">Реакций пока нет.</div>';
  } else {
    list.forEach(em => {
      const r = rx[em];
      body += `<p class="ch2-grp">${E(em)} · ${r.n}</p>`;
      r.who.forEach(w => {
        body += `<div class="ch2-row" role="listitem"><span class="ch2-r-ic">${E((w[0]||'?').toUpperCase())}</span>` +
                `<span class="ch2-r-tx"><b>${E(w)}</b>${w === 'Ты' ? '<small>твоя реакция</small>' : ''}</span>` +
                `<span class="ch2-r-em">${E(em)}</span></div>`;
      });
      const hidden = r.n - r.who.length;
      if(hidden > 0)
        body += `<div class="ch2-note">Ещё ${hidden} — имена придут вместе с профилями участников.</div>`;
    });
  }
  sheet({
    title: total ? ('Реакции · ' + total) : 'Реакции',
    body: body
  });
}

/* ===========================================================================
   3. ПАЛИТРА БЫСТРЫХ РЕАКЦИЙ (6 эмодзи по долгому нажатию)
   Переопределяем функции палитры app.js, оставляя те же имена классов —
   тач-обработчики ядра (drag-to-pick) продолжают работать.
   ======================================================================== */
function palHide(fromNav){
  let p = null;
  try{ if(typeof cpPalette !== 'undefined' && cpPalette) p = cpPalette.el; }catch(e){}
  if(!p) return;
  try{ cpPalette = null; }catch(e){}
  p.classList.remove('on');
  if(p._off) try{ document.removeEventListener('pointerdown', p._off, true); }catch(e){}
  if(p._res){ try{ window.removeEventListener('resize', p._res); }catch(e){}
              try{ window.removeEventListener('orientationchange', p._res); }catch(e){} }
  setTimeout(()=>{ try{ p.remove(); }catch(e){} }, 220);
  if(!fromNav){ try{ if(typeof nvPop === 'function') nvPop('cp:pal'); }catch(e){} }
}
function palShow(msg, idx){
  palHide();
  const c = chat(); if(!c || !msg) return;
  const m = c.msgs[idx]; const rx = rxOf(m || {});
  const p = document.createElement('div');
  p.className = 'ch2-pal cp-react-palette';
  p.setAttribute('role', 'menu');
  p.setAttribute('aria-label', 'Быстрые реакции');
  p.innerHTML = QUICK.map(em =>
      `<button type="button" class="cp-rp-btn${rx[em] && rx[em].mine ? ' mine' : ''}" ` +
      `data-r="${E(em)}" aria-label="Реакция ${E(em)}">${E(em)}</button>`).join('') +
    `<button type="button" class="cp-rp-more" aria-label="Ещё действия">${ico('more')}</button>`;
  document.body.appendChild(p);
  try{ cpPalette = {el:p, msg:msg, idx:idx}; }catch(e){}

  const place = () => {
    const r = msg.getBoundingClientRect();
    const pw = p.offsetWidth, ph = p.offsetHeight;
    const out = msg.classList.contains('out');
    let cx = out ? (r.right - Math.min(r.width, pw)/2 + 8)
                 : (r.left  + Math.min(r.width, pw)/2 - 8);
    p.style.left = Math.max(10, Math.min(window.innerWidth - pw - 10, cx - pw/2)) + 'px';
    let top = r.top - ph - 10, below = false;
    if(top < 68){ top = Math.min(window.innerHeight - ph - 14, r.bottom + 10); below = true; }
    p.style.top = top + 'px';
    p.classList.toggle('cp-rp-below', below);
  };
  requestAnimationFrame(()=>{ place(); p.classList.add('on'); });

  p.addEventListener('click', ev => {
    const b = ev.target.closest('.cp-rp-btn, .cp-rp-more');
    if(!b) return;
    ev.stopPropagation(); ev.preventDefault();
    palPick(b);
  });
  setTimeout(()=>{
    const off = e2 => { if(p.contains(e2.target)) return; palHide();
      document.removeEventListener('pointerdown', off, true); };
    document.addEventListener('pointerdown', off, true);
    p._off = off;
  }, 0);
  const res = () => { try{ if(cpPalette) place(); }catch(e){} };
  window.addEventListener('resize', res);
  window.addEventListener('orientationchange', res);
  p._res = res;
  try{ if(typeof nvPush === 'function') nvPush('cp:pal', ()=>palHide(true)); }catch(e){}
}
function palPick(btn){
  let st = null; try{ st = cpPalette; }catch(e){}
  if(!st) return;
  const idx = st.idx;
  if(btn.classList.contains('cp-rp-more')){
    palHide();
    try{ if(typeof openMsgMenu === 'function') openMsgMenu(idx); }catch(e){}
    return;
  }
  const em = btn.dataset.r;
  fly(btn, em);
  if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
  window.pickReact(idx, em);
  setTimeout(()=>palHide(), 180);
}
function fly(btn, em){
  const r = btn.getBoundingClientRect();
  const f = document.createElement('span');
  f.className = 'ch2-fly'; f.textContent = em;
  f.style.left = (r.left + r.width/2) + 'px';
  f.style.top  = (r.top + r.height/2) + 'px';
  document.body.appendChild(f);
  setTimeout(()=>{ try{ f.remove(); }catch(e){} }, 900);
}
window.cpShowReactPalette = palShow;
window.cpHideReactPalette = palHide;
window.cpPickReactBtn     = palPick;
window.cpFlyReaction      = function(btn, key){ fly(btn, LEGACY[key] || key); };

/* Долгое нажатие мышью/пером: тач уже обслуживает app.js. */
function bindMouseLongPress(){
  const el = msgsEl(); if(!el || el._ch2lp) return; el._ch2lp = 1;
  let t = null, from = null;
  el.addEventListener('pointerdown', e => {
    if(e.pointerType === 'touch') return;
    if(e.button !== 0) return;
    const msg = e.target.closest('.msg');
    if(!msg || msg.classList.contains('sys') || msg.classList.contains('typing')) return;
    if(e.target.closest('button, a, input, textarea, video, .wave')) return;
    if(selMode) return;
    const idx = kidIndex(el, msg); if(idx < 0) return;
    from = {x:e.clientX, y:e.clientY};
    clearTimeout(t);
    t = setTimeout(()=>{ t = null; palShow(msg, idx); }, 380);
  });
  const cancel = e => {
    if(t && from && e && e.clientX != null &&
       (Math.abs(e.clientX - from.x) > 8 || Math.abs(e.clientY - from.y) > 8)){
      clearTimeout(t); t = null;
    }
    if(e && e.type !== 'pointermove'){ clearTimeout(t); t = null; }
  };
  el.addEventListener('pointermove', cancel);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
}
const kidIndex = (parent, node) => Array.prototype.indexOf.call(parent.children, node);

/* ===========================================================================
   4. ОТВЕТ: свайп вправо мышью + цитата, ведущая к оригиналу
   Тач-свайп уже реализован в app.js (cpSwipeInit) — здесь только указатель
   (мышь/перо/тест-раннер), чтобы жест работал и на ПК.
   ======================================================================== */
let pendingReplyMid = null;

if(typeof replyTo === 'function'){
  const prev = replyTo;
  window.replyTo = function(idx){
    const c = chat();
    const m = c && c.msgs[idx];
    pendingReplyMid = m ? mid(m) : null;
    return prev.apply(this, arguments);
  };
}
if(typeof cancelCompose === 'function'){
  const prev = cancelCompose;
  window.cancelCompose = function(){ pendingReplyMid = null; return prev.apply(this, arguments); };
}

function bindMouseSwipe(){
  const el = msgsEl(); if(!el || el._ch2sw) return; el._ch2sw = 1;
  let st = null;
  el.addEventListener('pointerdown', e => {
    if(e.pointerType === 'touch' || e.button !== 0) return;
    if(selMode) return;
    const msg = e.target.closest('.msg');
    if(!msg || msg.classList.contains('sys') || msg.classList.contains('typing')) return;
    if(e.target.closest('button, a, input, textarea, video')) return;
    st = {el:msg, x:e.clientX, y:e.clientY, dx:0, on:false, id:e.pointerId};
  });
  el.addEventListener('pointermove', e => {
    if(!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if(!st.on){
      if(dx > 14 && Math.abs(dx) > Math.abs(dy) * 2){
        st.on = true; st.el.classList.add('cp-sw');
        if(!st.el.querySelector('.cp-sw-ic')){
          const i = document.createElement('span');
          i.className = 'cp-sw-ic'; i.innerHTML = ico('reply');
          st.el.appendChild(i);
        }
        try{ el.setPointerCapture(e.pointerId); }catch(_){}
      } else if(Math.abs(dy) > 14 || dx < -14){ st = null; return; }
    }
    if(st && st.on){
      const d = Math.max(0, Math.min(dx, 76));
      st.dx = d;
      st.el.style.transform = 'translateX(' + d + 'px)';
      const i = st.el.querySelector('.cp-sw-ic');
      if(i) i.style.opacity = Math.min(1, d / 40);
      st.el.classList.toggle('cp-sw-hit', d > 40);
    }
  });
  const end = e => {
    if(!st) return;
    const s = st; st = null;
    const hit = s.on && s.dx > 40;
    const idx = kidIndex(el, s.el);
    s.el.classList.remove('cp-sw', 'cp-sw-hit');
    s.el.classList.add('cp-sw-back');
    s.el.style.transform = '';
    setTimeout(()=>{
      s.el.classList.remove('cp-sw-back');
      const i = s.el.querySelector('.cp-sw-ic'); if(i) i.remove();
    }, 240);
    try{ if(e && e.pointerId != null) el.releasePointerCapture(e.pointerId); }catch(_){}
    const c = chat();
    if(hit && idx >= 0 && c && c.msgs[idx] && c.msgs[idx].kind !== 'sys' &&
       typeof replyTo === 'function') replyTo(idx);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/* Публичный вызов «ответить свайпом» — тот же путь, что и у жеста. */
function swipeReply(idx){
  const c = chat(); if(!c || !c.msgs[idx] || c.msgs[idx].kind === 'sys') return false;
  if(typeof replyTo === 'function'){ replyTo(idx); return true; }
  return false;
}

/* Тап по цитате — прокрутка к оригиналу с подсветкой. */
function jumpToQuoted(idx){
  const c = chat(); if(!c) return;
  const m = c.msgs[idx];
  const target = m && m.reply && m.reply.mid ? byMid(c, m.reply.mid) : -1;
  if(target < 0){ say('Оригинал не найден — сообщение удалили'); return; }
  flashAt(target);
}
function flashAt(i){
  const el = msgsEl(); if(!el) return;
  const node = el.children[i]; if(!node) return;
  node.scrollIntoView({behavior:'smooth', block:'center'});
  node.classList.remove('ch2-flash'); void node.offsetWidth; node.classList.add('ch2-flash');
  setTimeout(()=>node.classList.remove('ch2-flash'), 1400);
}

/* ===========================================================================
   5. ЗАКРЕП: право закреплять + переход к закреплённому
   ======================================================================== */
if(typeof pinMsg === 'function'){
  const prev = pinMsg;
  window.pinMsg = function(idx){
    const c = chat();
    if(c && !canPin(c)){
      try{ if(typeof closeMsgMenu === 'function') closeMsgMenu(); }catch(e){}
      say('Закреплять сообщения здесь может владелец или админ');
      return;
    }
    return prev.apply(this, arguments);
  };
}

/* ===========================================================================
   6. ЧЕСТНЫЕ СТАТУСЫ ПРОЧТЕНИЯ
   Одна галочка = отправлено. Две = прочитано, и ТОЛЬКО когда это правда:
   пришёл ответ собеседника (значит прочитал) в живой комнате или у агента
   поддержки, либо прилетела реальная квитанция чтения. Никаких таймеров.
   ======================================================================== */
window.cpPaintStatuses = function(){
  const c = chat(); if(!c) return;
  const el = msgsEl(); if(!el) return;
  const kids = el.children, msgs = c.msgs || [];
  for(let i = 0; i < msgs.length && i < kids.length; i++){
    const m = msgs[i];
    if(!m || m.in || m.kind === 'sys') continue;
    const t = kids[i].querySelector('.t');
    if(!t) continue;
    t.classList.add('cp-t');
    let sp = t.querySelector('.cp-st');
    if(!sp){
      const old = t.querySelector('svg'); if(old) old.remove();
      sp = document.createElement('span'); sp.className = 'cp-st';
      t.appendChild(sp);
    }
    const st = m.ch2read ? 'read' : 'sent';
    if(sp.dataset.st !== st){
      sp.dataset.st = st;
      sp.title = st === 'read' ? 'Прочитано' : 'Отправлено';
      sp.innerHTML = st === 'read' ? ico('check2') : ico('check');
    }
  }
};
/* Входящее сообщение в чате с реальной второй стороной = наши прочитаны. */
function markReadByIncoming(c){
  if(!c) return;
  const real = !!c.cid || !!c.agent;      /* живая комната или агент поддержки */
  if(!real) return;
  let touched = false;
  (c.msgs || []).forEach(m => { if(m && !m.in && m.kind !== 'sys' && !m.ch2read){ m.ch2read = true; touched = true; } });
  if(touched && chat() && chat().id === c.id) window.cpPaintStatuses();
}

/* ===========================================================================
   7. РАЗДЕЛИТЕЛЬ НЕПРОЧИТАННОГО + КНОПКА «ВНИЗ»
   Никаких новых прямых детей у #msgs: разделитель рисуется псевдоэлементом
   на граничном сообщении, иначе поедут индексы у refreshMsg/поиска/закрепа.
   ======================================================================== */
let downBtn = null;
function buildDown(){
  const body = conv(); if(!body || downBtn) return;
  downBtn = document.createElement('button');
  downBtn.type = 'button';
  downBtn.className = 'ch2-down';
  downBtn.title = 'К последним сообщениям';
  downBtn.setAttribute('aria-label', 'К последним сообщениям');
  downBtn.innerHTML = ico('arrow-down') + '<span class="ch2-dn" hidden></span>';
  downBtn.onclick = () => {
    const el = msgsEl(); if(!el) return;
    el.scrollTo({top: el.scrollHeight, behavior:'smooth'});
    const c = chat(); if(c){ c.ch2new = 0; c.ch2ub = null; }
    setTimeout(()=>{ paintUnread(); syncDown(); }, 380);
  };
  body.appendChild(downBtn);
  const el = msgsEl();
  if(el && !el._ch2scroll){
    el._ch2scroll = 1;
    el.addEventListener('scroll', ()=>{
      const c = chat();
      if(c && el.scrollHeight - el.scrollTop - el.clientHeight < 40) c.ch2new = 0;
      syncDown();
    }, {passive:true});
  }
}
function syncDown(){
  if(!downBtn) return;
  const el = msgsEl(); const c = chat();
  if(!el || !c || !conv() || conv().style.display === 'none'){ downBtn.classList.remove('on'); return; }
  /* поднимаем кнопку над композером и строкой ответа */
  const comp = document.querySelector('#convBody .composer');
  const bar  = byId('composeBar');
  let b = 12 + (comp ? comp.offsetHeight : 60);
  if(bar && bar.classList.contains('open')) b += bar.offsetHeight;
  downBtn.style.setProperty('--ch2-down-b', b + 'px');
  const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
  const n = c.ch2new || 0;
  downBtn.classList.toggle('on', gap > 220 || n > 0);
  const badge = downBtn.querySelector('.ch2-dn');
  if(badge){
    if(n > 0){ badge.hidden = false; badge.textContent = n > 99 ? '99+' : String(n); }
    else badge.hidden = true;
  }
}
function paintUnread(){
  const el = msgsEl(); const c = chat(); if(!el || !c) return;
  [...el.children].forEach(n => n.classList.remove('ch2-ub'));
  const b = c.ch2ub;
  if(b == null || b < 0 || b >= (c.msgs || []).length) return;
  const node = el.children[b];
  if(node && !node.classList.contains('sys')) node.classList.add('ch2-ub');
}

/* ===========================================================================
   8. ВЕТКИ ОБСУЖДЕНИЯ (канал ↔ привязанный чат)
   ======================================================================== */
let pendingThread = null;
let thBar = null;
const thKey = (chan, m) => 'th:' + chan.id + ':' + mid(m);

function buildThreadBar(){
  const head = document.querySelector('#convBody .conv-head');
  if(!head || thBar) return;
  thBar = document.createElement('div');
  thBar.className = 'ch2-thbar';
  thBar.id = 'ch2ThreadBar';
  thBar.innerHTML = `<span class="ch2-th-ic">${ico('comment')}</span>` +
    `<div class="ch2-th-txt"><b>Ветка обсуждения</b><small id="ch2ThreadTxt"></small></div>` +
    `<button type="button" class="ch2-th-x" title="Выйти из ветки" aria-label="Выйти из ветки">${ico('x')}</button>`;
  thBar.querySelector('.ch2-th-x').onclick = e => { e.stopPropagation(); exitThread(); };
  head.insertAdjacentElement('afterend', thBar);
}
function exitThread(){
  const c = chat(); if(c) c.ch2th = null;
  try{ if(typeof renderMsgs === 'function' && chat()){ renderMsgs._chat = null; renderMsgs(); } }catch(e){}
  afterRender();
}
function paintThread(){
  const el = msgsEl(); const c = chat();
  if(!el || !c) return;
  const th = c.ch2th;
  if(thBar) thBar.classList.toggle('on', !!th);
  const old = byId('ch2ThreadEmpty'); if(old) old.remove();
  if(!th){
    el.querySelectorAll('.msg.ch2-off').forEach(n => n.classList.remove('ch2-off'));
    return;
  }
  const txt = byId('ch2ThreadTxt');
  if(txt) txt.textContent = th.title || 'Запись канала';
  let shown = 0;
  const msgs = c.msgs || [];
  [...el.children].forEach((node, i) => {
    const m = msgs[i];
    const inTh = !!(m && m.ch2th === th.key);
    node.classList.toggle('ch2-off', !inTh);
    if(inTh) shown++;
  });
  if(!shown){
    const hint = document.createElement('div');
    hint.className = 'ch2-thempty';
    hint.id = 'ch2ThreadEmpty';
    hint.innerHTML = ico('comment') +
      '<div>В этой ветке пока нет комментариев.<br>Напиши первым — сообщение уйдёт в обсуждение записи.</div>';
    const body = conv(); if(body) body.appendChild(hint);
  }
}
/* Кнопка «Комментарии» под каждой записью канала. */
function paintCommentButtons(){
  const c = chat(); const el = msgsEl();
  if(!c || !el || c.kind !== 'channel') return;
  let linked = null;
  try{ if(typeof okoLinkedChat === 'function') linked = okoLinkedChat(c); }catch(e){}
  if(!linked) return;
  const msgs = c.msgs || [];
  [...el.children].forEach((node, i) => {
    const m = msgs[i];
    if(!m || m.kind === 'sys') return;
    if(node.querySelector('.ch2-cmt')) return;
    const key = thKey(c, m);
    const n = (linked.msgs || []).filter(x => x && x.ch2th === key).length;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ch2-cmt';
    b.innerHTML = ico('comment') + `<span>${n ? 'Комментарии · ' + n : 'Комментарии'}</span>`;
    b.onclick = ev => { ev.stopPropagation(); window.okoOpenComments(c.id, i); };
    node.appendChild(b);
  });
}
/* Публичный вход: открыть обсуждение записи канала. */
window.okoOpenComments = function(chanId, postIdx){
  const ch = chats().find(c => c.id === chanId);
  let linked = null;
  try{ if(typeof okoLinkedChat === 'function') linked = okoLinkedChat(ch); }catch(e){}
  if(!ch || !linked) return false;
  const post = (postIdx != null) ? (ch.msgs || [])[postIdx] : null;
  pendingThread = post
    ? {key: thKey(ch, post), chan: ch.id, title: (quoteOf(post) || 'Запись канала').slice(0, 140)}
    : null;
  try{ if(typeof openConv === 'function') openConv(linked.id); }catch(e){ return false; }
  return true;
};

/* ===========================================================================
   9. РЕЖИМ ВЫДЕЛЕНИЯ НЕСКОЛЬКИХ СООБЩЕНИЙ
   ======================================================================== */
let selMode = false;
let selSet = new Set();
let selBar = null;

function buildSelBar(){
  const body = conv(); if(!body || selBar) return;
  selBar = document.createElement('div');
  selBar.className = 'ch2-selbar';
  selBar.id = 'ch2SelBar';
  selBar.innerHTML =
    `<button type="button" class="ch2-sb-x" data-a="off" title="Отменить выбор" aria-label="Отменить выбор">${ico('x')}</button>` +
    `<span class="ch2-sb-n" id="ch2SelN">Выбрано 0</span>` +
    `<button type="button" class="ch2-sb-a" data-a="copy" title="Копировать" aria-label="Копировать">${ico('copy')}</button>` +
    `<button type="button" class="ch2-sb-a" data-a="pin" title="Закрепить" aria-label="Закрепить">${ico('pin')}</button>` +
    `<button type="button" class="ch2-sb-a" data-a="fwd" title="Переслать" aria-label="Переслать">${ico('forward')}</button>` +
    `<button type="button" class="ch2-sb-a danger" data-a="del" title="Удалить" aria-label="Удалить">${ico('trash')}</button>`;
  selBar.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if(!b) return;
    const a = b.dataset.a;
    if(a === 'off')  return selOff();
    if(a === 'copy') return selCopy();
    if(a === 'pin')  return selPin();
    if(a === 'fwd')  return selForward();
    if(a === 'del')  return selDelete();
  });
  body.insertBefore(selBar, body.firstChild);
}
function selOn(idx){
  const c = chat(); if(!c) return;
  buildSelBar();
  selMode = true;
  selSet = new Set();
  if(idx != null && c.msgs[idx]) selSet.add(c.msgs[idx]);
  const el = msgsEl(); if(el) el.classList.add('ch2-selmode');
  if(selBar) selBar.classList.add('on');
  paintSel();
  try{ if(typeof nvPush === 'function') nvPush('ch2:sel', ()=>selOff(true)); }catch(e){}
}
function selOff(fromNav){
  if(!selMode) return;
  selMode = false; selSet = new Set();
  const el = msgsEl();
  if(el){
    el.classList.remove('ch2-selmode');
    el.querySelectorAll('.msg.ch2-picked').forEach(n => n.classList.remove('ch2-picked'));
    el.querySelectorAll('.ch2-tick').forEach(n => n.remove());
  }
  if(selBar) selBar.classList.remove('on');
  if(!fromNav){ try{ if(typeof nvPop === 'function') nvPop('ch2:sel'); }catch(e){} }
}
function selToggle(idx){
  const c = chat(); if(!c) return;
  const m = c.msgs[idx]; if(!m || m.kind === 'sys') return;
  if(selSet.has(m)) selSet.delete(m); else selSet.add(m);
  if(!selSet.size){ selOff(); return; }
  paintSel();
}
function paintSel(){
  const el = msgsEl(); const c = chat();
  if(!el || !c) return;
  const msgs = c.msgs || [];
  [...el.children].forEach((node, i) => {
    const m = msgs[i];
    const sys = node.classList.contains('sys');
    let tick = node.querySelector('.ch2-tick');
    if(selMode && m && !sys){
      if(!tick){
        tick = document.createElement('span');
        tick.className = 'ch2-tick';
        tick.innerHTML = ico('check');
        node.appendChild(tick);
      }
      node.classList.toggle('ch2-picked', selSet.has(m));
    } else {
      if(tick) tick.remove();
      node.classList.remove('ch2-picked');
    }
  });
  const n = byId('ch2SelN');
  if(n) n.textContent = 'Выбрано ' + selSet.size;
  if(selBar){
    const pin = selBar.querySelector('[data-a="pin"]');
    if(pin) pin.disabled = selSet.size !== 1 || !canPin(chat());
  }
}
function selOrdered(){
  const c = chat(); if(!c) return [];
  return (c.msgs || []).filter(m => selSet.has(m));
}
function selCopy(){
  const txt = selOrdered().map(m => quoteOf(m)).filter(Boolean).join('\n');
  if(!txt){ say('В выбранном нет текста для копирования'); return; }
  try{ navigator.clipboard && navigator.clipboard.writeText(txt); }catch(e){}
  say('Скопировано: ' + selOrdered().length + ' сообщ.');
  selOff();
}
function selPin(){
  const c = chat(); if(!c || selSet.size !== 1) return;
  const m = selOrdered()[0];
  const idx = (c.msgs || []).indexOf(m);
  selOff();
  if(idx >= 0 && typeof pinMsg === 'function') pinMsg(idx);
}
function selForward(){
  const list = selOrdered();
  if(!list.length) return;
  forwardMany(list, chat());
}
function selDelete(){
  const list = selOrdered();
  if(!list.length) return;
  deleteSheet(list, chat());
}

/* ===========================================================================
   10. УДАЛЕНИЕ: у себя / у всех (честно)
   ======================================================================== */
function deleteSheet(list, c){
  if(!c || !list.length) return;
  const many = list.length > 1;
  const forAll = list.every(m => canDeleteForAll(c, m));
  const mine = list.every(m => m && !m.in);
  let body =
    `<button type="button" class="ch2-row danger" data-a="self">${ico('trash')}` +
    `<span class="ch2-r-tx"><b>Удалить у себя</b>` +
    `<small>${many ? 'Пропадут из твоей истории' : 'Пропадёт из твоей истории'}</small></span></button>`;
  if(forAll){
    body += `<button type="button" class="ch2-row danger" data-a="all">${ico('users')}` +
      `<span class="ch2-r-tx"><b>Удалить у всех</b><small>Уйдёт и у собеседников в этой комнате</small></span></button>`;
  }
  const note = forAll ? ''
    : (mine
        ? 'Удалить у всех можно, когда чат живёт на сервере. Этот пока хранится только на твоём устройстве.'
        : 'Чужое сообщение можно убрать только у себя.');
  sheet({
    title: many ? ('Удалить ' + list.length + ' сообщ.?') : 'Удалить сообщение?',
    body: body + (note ? `<div class="ch2-note">${E(note)}</div>` : ''),
    onAct: a => {
      if(a === 'self' || a === 'all') doDelete(list, c, a === 'all');
      return true;
    }
  });
}
function doDelete(list, c, forAll){
  if(!c) return;
  let n = 0;
  list.forEach(m => {
    const i = (c.msgs || []).indexOf(m);
    if(i < 0) return;
    if(forAll && c.cid && m.sid && window.liveChannel){
      try{ liveChannel.send({type:'broadcast', event:'ch2del',
        payload:{user:(typeof myId !== 'undefined' ? myId : ''), sid:m.sid}}); }catch(e){}
    }
    if(c.cpPin === m) c.cpPin = null;
    c.msgs.splice(i, 1); n++;
  });
  selOff();
  const last = (c.msgs || [])[c.msgs.length - 1];
  c.preview = last ? ((last.in ? '' : 'Ты: ') +
    (typeof kindPreview === 'function' ? (kindPreview(last) || '') : (last.body || ''))) : '';
  try{ renderMsgs._n = 0; renderMsgs._chat = null; }catch(e){}
  try{ if(typeof renderMsgs === 'function') renderMsgs(); }catch(e){}
  try{ if(typeof renderChatList === 'function') renderChatList((byId('chatSearch') || {}).value || ''); }catch(e){}
  afterRender();
  say(forAll ? ('Удалено у всех: ' + n) : ('Удалено у себя: ' + n));
}
/* Одиночное удаление из меню сообщения — тот же честный выбор. */
if(typeof deleteMsg === 'function'){
  window.deleteMsg = function(idx){
    const c = chat(); if(!c) return;
    const m = c.msgs[idx]; if(!m) return;
    try{ if(typeof closeMsgMenu === 'function') closeMsgMenu(); }catch(e){}
    deleteSheet([m], c);
  };
}

/* ===========================================================================
   11. ПЕРЕСЫЛКА (одного и нескольких) С ПОДПИСЬЮ «Переслано от …»
   ======================================================================== */
function forwardMany(list, from){
  if(!list.length) return;
  const targets = chats().filter(c => c && (!from || c.id !== from.id) && c.kind !== 'sys');
  if(!targets.length){ say('Нет чатов для пересылки'); return; }
  const rows = targets.map((c, i) => {
    let ava = '';
    try{ ava = (typeof avaHtml === 'function') ? avaHtml(c) : ''; }catch(e){}
    if(!ava) ava = E((c.name || '?')[0].toUpperCase());
    return `<button type="button" class="ch2-row" data-a="to:${i}">` +
      `<span class="ch2-r-ic">${ava}</span>` +
      `<span class="ch2-r-tx"><b>${E(c.name || '')}</b><small>${E(c.preview || '')}</small></span>` +
      `${ico('chev')}</button>`;
  }).join('');
  const q = E(quoteOf(list[0]) || 'сообщение').slice(0, 160);
  sheet({
    title: list.length > 1 ? ('Переслать ' + list.length + ' сообщ.') : 'Переслать в чат',
    quote: q + (list.length > 1 ? ' …' : ''),
    body: rows,
    onAct: a => {
      if(a.indexOf('to:') !== 0) return false;
      const c = targets[+a.slice(3)];
      if(!c) return true;
      doForward(list, from, c);
      return true;
    }
  });
}
function doForward(list, from, target){
  const who = m => m.in ? (m.who || (from && from.name) || 'Автор') : 'Ты';
  const clones = list.map(m => {
    const cl = Object.assign({}, m, {
      in: 0, t: nowT(), edited: false, reacts: null, rx: null, ch2id: null,
      ch2read: false, ch2th: null, cpSt: 'sent',
      fwd: {who: (m.fwd && m.fwd.who) || who(m)}
    });
    delete cl.reply; delete cl.sid;
    return cl;
  });
  selOff();
  try{ if(typeof openConv === 'function') openConv(target.id); }catch(e){}
  setTimeout(()=>{
    clones.forEach(cl => { try{ if(typeof pushMsg === 'function') pushMsg(cl); }catch(e){} });
    afterRender();
    say('Переслано в «' + (target.name || 'чат') + '»');
  }, 90);
}
/* Пересылка одного сообщения из меню — наш общий путь. */
if(typeof forwardMsg === 'function'){
  window.forwardMsg = function(idx){
    const c = chat(); if(!c) return;
    const m = c.msgs[idx]; if(!m) return;
    try{ if(typeof closeMsgMenu === 'function') closeMsgMenu(); }catch(e){}
    forwardMany([m], c);
  };
}

/* ===========================================================================
   12. ПАПКИ ЧАТОВ: Все · Личные · Группы · Каналы · Непрочитанные · свои
   ======================================================================== */
const isMyFolder = f => f === 'unread' || (typeof f === 'string' && f.indexOf('f:') === 0);
const coreFolder = f => isMyFolder(f) ? 'all' : f;

window.renderFolders = function(){
  const box = byId('folders'); if(!box) return;
  const items = [['all','Все',''], ['direct','Личные',''], ['group','Группы',''],
                 ['channel','Каналы',''], ['unread','Непрочитанные','']];
  let managed = 0;
  try{ managed = chats().filter(c => c.managed).length; }catch(e){}
  if(myRoleOwner()) items.push(['managed','Управление','crown']);
  ST.folders.forEach(f => items.push(['f:' + f.id, f.name, 'folder']));

  let unread = 0;
  try{ unread = chats().filter(c => (c.unread || 0) > 0).length; }catch(e){}

  box.innerHTML = items.map(([f, label, icn]) => {
    const on = ST.folder === f ? 'on' : '';
    const cnt = f === 'managed' ? `<span class="cnt">${managed}</span>`
              : (f === 'unread' && unread) ? `<span class="cnt">${unread}</span>` : '';
    return `<button type="button" class="${on}" data-f="${E(f)}">${icn ? ico(icn) : ''}${E(label)}${cnt}</button>`;
  }).join('') +
  `<button type="button" class="ch2-fnew" data-f="__new" title="Своя папка" aria-label="Своя папка">${ico('plus')}Папка</button>`;

  [...box.children].forEach(b => {
    b.onclick = () => {
      const f = b.dataset.f;
      if(f === '__new'){ folderEditor(null); return; }
      window.setFolder(f);
    };
    if(b.dataset.f && b.dataset.f.indexOf('f:') === 0){
      b.oncontextmenu = e => { e.preventDefault(); folderEditor(b.dataset.f.slice(2)); };
      /* долгий тап по своей папке — редактирование */
      let t = null;
      b.addEventListener('pointerdown', ()=>{ clearTimeout(t); t = setTimeout(()=>folderEditor(b.dataset.f.slice(2)), 520); });
      ['pointerup','pointerleave','pointercancel','pointermove'].forEach(ev =>
        b.addEventListener(ev, ()=>clearTimeout(t)));
    }
  });
};
window.setFolder = function(f){
  ST.folder = f; stSave();
  try{ curFolder = coreFolder(f); }catch(e){}
  window.renderFolders();
  try{ if(typeof renderChatList === 'function') renderChatList((byId('chatSearch') || {}).value || ''); }catch(e){}
};
function chatOfItem(node){
  const on = node.getAttribute('onclick') || '';
  const m = on.match(/openConv\((?:'([^']*)'|(-?\d+))\)/);
  if(!m) return null;
  const id = m[1] != null ? m[1] : Number(m[2]);
  return chats().find(c => String(c.id) === String(id)) || null;
}
function filterList(){
  const list = byId('chatList'); if(!list) return;
  const old = byId('ch2FolderEmpty'); if(old) old.remove();
  const f = ST.folder;
  if(!isMyFolder(f)) return;
  const folder = f.indexOf('f:') === 0 ? ST.folders.find(x => x.id === f.slice(2)) : null;
  const ids = folder ? (folder.chats || []).map(String) : null;
  let shown = 0;
  [...list.querySelectorAll('.chat-item')].forEach(it => {
    const c = chatOfItem(it);
    let ok = false;
    if(c) ok = ids ? ids.indexOf(String(c.id)) >= 0 : (c.unread || 0) > 0;
    it.style.display = ok ? '' : 'none';
    if(ok) shown++;
  });
  if(!shown){
    const box = document.createElement('div');
    box.className = 'ch2-fempty';
    box.id = 'ch2FolderEmpty';
    box.innerHTML = ico(ids ? 'folder' : 'check2') +
      (ids ? '<div>В этой папке пока нет чатов.<br>Долгий тап по папке — добавить чаты.</div>'
           : '<div>Непрочитанных нет.<br>Всё разобрано.</div>');
    list.appendChild(box);
  }
}
function folderEditor(id){
  const f = id ? ST.folders.find(x => x.id === id) : null;
  const picked = new Set((f ? f.chats : []).map(String));
  const all = chats();
  const rows = all.map((c, i) =>
    `<button type="button" class="ch2-row${picked.has(String(c.id)) ? ' on' : ''}" data-a="t:${i}">` +
    `<span class="ch2-box">${ico('check')}</span>` +
    `<span class="ch2-r-tx"><b>${E(c.name || '')}</b><small>${E(c.kind === 'channel' ? 'Канал' : c.kind === 'group' ? 'Группа' : 'Личный чат')}</small></span></button>`
  ).join('') || '<div class="ch2-empty">Чатов пока нет.</div>';

  sheet({
    title: f ? 'Папка «' + f.name + '»' : 'Новая папка',
    head: `<div style="padding:0 4px 10px"><input class="ch2-inp" id="ch2FName" maxlength="24" ` +
          `placeholder="Название папки" value="${E(f ? f.name : '')}"></div>`,
    body: rows,
    foot: `<div class="ch2-actions">` +
      (f ? `<button type="button" class="ch2-btn danger" data-a="del">Удалить</button>` : '') +
      `<button type="button" class="ch2-btn main" data-a="save">Сохранить</button></div>`,
    onAct: (a, root) => {
      if(a.indexOf('t:') === 0){
        const c = all[+a.slice(2)];
        const k = String(c.id);
        if(picked.has(k)) picked.delete(k); else picked.add(k);
        const b = root.querySelector(`[data-a="${a}"]`);
        if(b) b.classList.toggle('on', picked.has(k));
        return false;
      }
      if(a === 'del'){
        ST.folders = ST.folders.filter(x => x.id !== id);
        if(ST.folder === 'f:' + id) ST.folder = 'all';
        stSave(); window.setFolder(ST.folder);
        say('Папка удалена');
        return true;
      }
      if(a === 'save'){
        const nm = (root.querySelector('#ch2FName') || {}).value || '';
        const name = nm.trim();
        if(!name){ say('Дай папке название'); return false; }
        if(!picked.size){ say('Отметь хотя бы один чат'); return false; }
        if(f){ f.name = name; f.chats = [...picked]; }
        else ST.folders.push({id: 'u' + Date.now().toString(36), name: name, chats: [...picked]});
        stSave();
        window.setFolder(f ? 'f:' + f.id : 'f:' + ST.folders[ST.folders.length - 1].id);
        say('Папка сохранена');
        return true;
      }
      return false;
    }
  });
}

/* ===========================================================================
   13. ПОИСК ПО СООБЩЕНИЯМ — точнее, чем в ядре
   Переиспользуем строку поиска и счётчик из app.js, но подсвечиваем только
   текст самих сообщений: цифры реакций, время и служебные подписи слоя
   больше не попадают в выдачу.
   ======================================================================== */
const SKIP_SEL = '.t, .cp-st, .cp-speed, .ch2-reacts, .ch2-cmt, .ch2-tick, .cp-fwd-tag, .cp-linkprev';
window.cpSearchRun = function(){
  try{ if(typeof cpClearMarks === 'function') cpClearMarks(); }catch(e){}
  const inp = byId('cpSearchInput');
  const q = ((inp && inp.value) || '').trim().toLowerCase();
  const el = msgsEl();
  const marks = [];
  if(!q || !el){ try{ cpMarks = marks; cpCur = -1; }catch(e){} upCount(); return; }
  el.querySelectorAll('.msg').forEach(msg => {
    if(msg.id === 'typingMsg' || msg.classList.contains('ch2-off')) return;
    const tw = document.createTreeWalker(msg, NodeFilter.SHOW_TEXT, {acceptNode: n => {
      if(!n.nodeValue || n.nodeValue.toLowerCase().indexOf(q) < 0) return NodeFilter.FILTER_REJECT;
      const pe = n.parentElement;
      if(pe && pe.closest(SKIP_SEL)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }});
    const nodes = []; while(tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(node => {
      const text = node.nodeValue, low = text.toLowerCase();
      const frag = document.createDocumentFragment();
      let from = 0, pos;
      while((pos = low.indexOf(q, from)) >= 0){
        frag.appendChild(document.createTextNode(text.slice(from, pos)));
        const mk = document.createElement('mark');
        mk.className = 'cp-mk'; mk.textContent = text.slice(pos, pos + q.length);
        frag.appendChild(mk); marks.push(mk);
        from = pos + q.length;
      }
      frag.appendChild(document.createTextNode(text.slice(from)));
      node.parentNode.replaceChild(frag, node);
    });
  });
  try{ cpMarks = marks; cpCur = marks.length - 1; }catch(e){}
  try{ if(typeof cpFocusMark === 'function') cpFocusMark(true); }catch(e){}
  upCount();
};
function upCount(){
  const c = byId('cpSearchCount'); if(!c) return;
  const inp = byId('cpSearchInput');
  const q = ((inp && inp.value) || '').trim();
  let n = 0, cur = -1;
  try{ n = cpMarks.length; cur = cpCur; }catch(e){}
  c.textContent = !q ? '' : (n ? (cur + 1) + ' из ' + n : 'нет совпадений');
}
window.cpUpdateCount = upCount;
/* строка поиска ядра держит СТАРУЮ ссылку на обработчик — перевешиваем свой */
function rebindSearchInput(){
  const old = byId('cpSearchInput');
  if(!old || old._ch2) return;
  const n = old.cloneNode(true);
  n._ch2 = 1;
  old.parentNode.replaceChild(n, old);
  n.addEventListener('input', ()=>window.cpSearchRun());
  n.addEventListener('keydown', e => {
    if(e.key === 'Enter'){ e.preventDefault();
      try{ if(typeof cpSearchStep === 'function') cpSearchStep(e.shiftKey ? 1 : -1); }catch(_){}
    }
    if(e.key === 'Escape'){ e.preventDefault();
      try{ if(typeof cpCloseSearch === 'function') cpCloseSearch(); }catch(_){}
    }
  });
}
/* Публичный вход в поиск по чату (тот же, что и пункт ⋮-меню). */
function openChatSearch(){
  try{ if(typeof cpOpenSearch === 'function'){ cpOpenSearch(); rebindSearchInput(); return true; } }catch(e){}
  return false;
}

/* ===========================================================================
   14. УНИВЕРСАЛЬНАЯ ШТОРКА СЛОЯ (выход: крестик, тап вне, Escape, «назад»)
   ======================================================================== */
let sheetEl = null;
function sheet(o){
  closeSheet2();
  const wrap = document.createElement('div');
  wrap.className = 'ch2-sheet';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-label', o.title || 'Действия');
  wrap.innerHTML =
    `<div class="ch2-card">` +
      `<div class="ch2-ch"><h4>${E(o.title || '')}</h4>` +
      `<button type="button" class="ch2-ch-x" data-x="1" title="Закрыть" aria-label="Закрыть">${ico('x')}</button></div>` +
      (o.quote ? `<div class="ch2-quote">${o.quote}</div>` : '') +
      (o.head || '') +
      `<div class="ch2-cb">${o.body || ''}</div>` +
      (o.foot || '') +
    `</div>`;
  document.body.appendChild(wrap);
  sheetEl = wrap;
  requestAnimationFrame(()=>wrap.classList.add('on'));

  wrap.addEventListener('click', e => {
    if(e.target === wrap){ closeSheet2(); return; }
    if(e.target.closest('[data-x]')){ closeSheet2(); return; }
    const b = e.target.closest('[data-a]');
    if(!b) return;
    e.preventDefault();
    let close = true;
    if(o.onAct) close = o.onAct(b.dataset.a, wrap) !== false;
    if(close) closeSheet2();
  });
  const esc2 = e => { if(e.key === 'Escape'){ e.preventDefault(); closeSheet2(); } };
  document.addEventListener('keydown', esc2);
  wrap._esc = esc2;
  try{ if(typeof nvPush === 'function') nvPush('ch2:sheet', ()=>closeSheet2(true)); }catch(e){}
  const first = wrap.querySelector('input, button');
  if(first && first.tagName === 'INPUT') setTimeout(()=>{ try{ first.focus(); }catch(e){} }, 90);
}
function closeSheet2(fromNav){
  const w = sheetEl; if(!w) return;
  sheetEl = null;
  if(w._esc) document.removeEventListener('keydown', w._esc);
  w.classList.remove('on');
  setTimeout(()=>{ try{ w.remove(); }catch(e){} }, 200);
  if(!fromNav){ try{ if(typeof nvPop === 'function') nvPop('ch2:sheet'); }catch(e){} }
}

/* ===========================================================================
   15. ДЕЛЕГИРОВАННЫЕ КЛИКИ ПО ЛЕНТЕ
   ======================================================================== */
function bindClicks(){
  const el = msgsEl(); if(!el || el._ch2cl) return; el._ch2cl = 1;
  el.addEventListener('click', e => {
    const msg = e.target.closest('.msg'); if(!msg) return;
    const idx = kidIndex(el, msg);
    /* режим выбора перехватывает всё */
    if(selMode){
      e.preventDefault(); e.stopPropagation();
      if(idx >= 0) selToggle(idx);
      return;
    }
    const chip = e.target.closest('.ch2-chip');
    if(chip){ e.preventDefault(); e.stopPropagation(); if(idx >= 0) openReactors(idx); return; }
    const q = e.target.closest('.msg-quote');
    if(q){ e.preventDefault(); e.stopPropagation(); if(idx >= 0) jumpToQuoted(idx); return; }
  }, true);
}

/* ===========================================================================
   16. ХВОСТ ПОСЛЕ КАЖДОЙ ОТРИСОВКИ ЛЕНТЫ
   ======================================================================== */
let afterBusy = false;
function afterRender(){
  if(afterBusy) return;
  afterBusy = true;
  try{
    buildDown(); buildThreadBar(); buildSelBar();
    bindClicks(); bindMouseSwipe(); bindMouseLongPress();
    paintUnread();
    paintThread();
    paintCommentButtons();
    paintSel();
    syncDown();
  }catch(e){ /* слой полировки не имеет права ронять чат */ }
  afterBusy = false;
}

/* ===========================================================================
   17. CHAIN-ПАТЧИ ЯДРА
   ======================================================================== */
if(typeof renderMsgs === 'function'){
  const prev = renderMsgs;
  window.renderMsgs = function(){
    const c = chat();
    const el = msgsEl();
    const before = c ? (renderMsgs._n || 0) : 0;
    const atBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight < 90) : true;
    const r = prev.apply(this, arguments);
    if(c && c.msgs && c.msgs.length > before && !atBottom && renderMsgs._chat === c.id)
      c.ch2new = (c.ch2new || 0) + (c.msgs.length - before);
    afterRender();
    return r;
  };
  /* переносим служебные поля, на которые опирается ядро */
  window.renderMsgs._n = prev._n; window.renderMsgs._chat = prev._chat;
}
if(typeof openConv === 'function'){
  const prev = openConv;
  window.openConv = function(id){
    selOff();
    const c = chats().find(x => x.id === id);
    if(c){
      const u = c.unread || 0;
      c.ch2ub = u > 0 ? Math.max(0, (c.msgs || []).length - u) : null;
      c.ch2new = 0;
      if(pendingThread) c.ch2th = pendingThread;
      pendingThread = null;
    }
    const r = prev.apply(this, arguments);
    try{ window.renderFolders(); }catch(e){}
    afterRender();
    /* если открыли ветку — прокрутить к её началу */
    const cc = chat();
    if(cc && cc.ch2th){
      const el = msgsEl();
      if(el){ const first = el.querySelector('.msg:not(.ch2-off)');
              if(first) first.scrollIntoView({block:'center'}); }
    }
    return r;
  };
}
if(typeof closeConv === 'function'){
  const prev = closeConv;
  window.closeConv = function(){
    selOff(); closeSheet2(); palHide();
    const c = chat(); if(c){ c.ch2th = null; c.ch2ub = null; c.ch2new = 0; }
    if(downBtn) downBtn.classList.remove('on');
    if(thBar) thBar.classList.remove('on');
    const hint = byId('ch2ThreadEmpty'); if(hint) hint.remove();
    return prev.apply(this, arguments);
  };
}
if(typeof renderChatList === 'function'){
  const prev = renderChatList;
  window.renderChatList = function(){
    const r = prev.apply(this, arguments);
    filterList();
    return r;
  };
}
if(typeof sendText === 'function'){
  const prev = sendText;
  window.sendText = function(){
    const c = chat();
    const before = c ? (c.msgs || []).length : 0;
    const rmid = pendingReplyMid;
    const th = c ? c.ch2th : null;
    const r = prev.apply(this, arguments);
    pendingReplyMid = null;
    if(c && (c.msgs || []).length > before){
      const m = c.msgs[c.msgs.length - 1];
      if(m){
        mid(m);
        if(m.reply && rmid) m.reply.mid = rmid;
        if(th) m.ch2th = th.key;
        if(th || (m.reply && rmid)){
          try{ if(typeof refreshMsg === 'function') refreshMsg(c.msgs.length - 1); }catch(e){}
        }
      }
      c.ch2ub = null;                 /* мы дочитали до конца — линия не нужна */
      c.ch2new = 0;
    }
    afterRender();
    return r;
  };
}
if(typeof pushMsg === 'function'){
  const prev = pushMsg;
  window.pushMsg = function(m){
    const c = chat();
    const r = prev.apply(this, arguments);
    if(m) mid(m);
    if(m && m.in && c) markReadByIncoming(c);
    if(m && !m.in && c) c.ch2ub = null;
    afterRender();
    return r;
  };
}
/* контекстное меню сообщения: эмодзи-реакции сверху + пункт «Выбрать» */
if(typeof openMsgMenu === 'function'){
  const prev = openMsgMenu;
  window.openMsgMenu = function(idx){
    const r = prev.apply(this, arguments);
    try{ enhanceMenu(idx); }catch(e){}
    return r;
  };
}
function enhanceMenu(idx){
  const c = chat(); if(!c) return;
  const m = c.msgs[idx]; if(!m) return;
  const rx = rxOf(m);
  const row = byId('mmReacts');
  if(row){
    row.style.display = 'flex';
    row.classList.add('ch2-pal');
    row.innerHTML = QUICK.concat(MORE.slice(0, 4)).map(em =>
      `<button type="button" class="cp-rp-btn${rx[em] && rx[em].mine ? ' mine' : ''}" ` +
      `data-r="${E(em)}" aria-label="Реакция ${E(em)}">${E(em)}</button>`).join('');
    row.onclick = ev => {
      const b = ev.target.closest('.cp-rp-btn'); if(!b) return;
      ev.stopPropagation();
      window.pickReact(idx, b.dataset.r);
    };
  }
  const acts = byId('mmActions');
  if(acts && !acts.querySelector('[data-ch2="sel"]')){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mm-act';
    b.dataset.ch2 = 'sel';
    b.innerHTML = ico('check2') + '<span>Выбрать</span>';
    b.onclick = () => {
      try{ if(typeof closeMsgMenu === 'function') closeMsgMenu(); }catch(e){}
      selOn(idx);
    };
    acts.appendChild(b);
  }
}

/* ===========================================================================
   18. ЖИВАЯ КОМНАТА: реальные квитанции чтения и удаление у всех
   Подписываемся мягко: если Supabase недоступен, статусы просто остаются
   «отправлено» — врать «прочитано» мы не будем.
   ======================================================================== */
(function live(){
  let tries = 0;
  const t = setInterval(()=>{
    tries++;
    if(tries > 60){ clearInterval(t); return; }
    const ch = window.liveChannel;
    if(!ch || ch._ch2) return;
    ch._ch2 = 1; clearInterval(t);
    try{
      ch.on('broadcast', {event:'ch2read'}, ({payload}) => {
        if(!payload || payload.user === (typeof myId !== 'undefined' ? myId : '')) return;
        const c = chats().find(x => x.cid === payload.cid);
        if(!c) return;
        let touched = false;
        (c.msgs || []).forEach(m => { if(m && !m.in && !m.ch2read){ m.ch2read = true; touched = true; } });
        if(touched && chat() && chat().id === c.id) window.cpPaintStatuses();
      });
      ch.on('broadcast', {event:'ch2del'}, ({payload}) => {
        if(!payload || payload.user === (typeof myId !== 'undefined' ? myId : '')) return;
        for(const c of chats()){
          if(!c.msgs) continue;
          const i = c.msgs.findIndex(x => x && x.sid === payload.sid);
          if(i < 0) continue;
          if(c.cpPin === c.msgs[i]) c.cpPin = null;
          c.msgs.splice(i, 1);
          if(chat() && chat().id === c.id){
            try{ renderMsgs._n = 0; renderMsgs._chat = null; renderMsgs(); }catch(e){}
          }
          break;
        }
      });
      ch.on('broadcast', {event:'reaction'}, ({payload}) => {
        if(!payload || payload.user === (typeof myId !== 'undefined' ? myId : '')) return;
        window.applyLiveReaction(payload.sid, payload.r, payload.user);
      });
    }catch(e){}
  }, 900);
})();
/* при открытии живого чата честно сообщаем комнате, что прочитали */
if(typeof openConv === 'function'){
  const prev = window.openConv;
  window.openConv = function(id){
    const r = prev.apply(this, arguments);
    const c = chat();
    if(c && c.cid && window.liveChannel){
      try{ liveChannel.send({type:'broadcast', event:'ch2read',
        payload:{user:(typeof myId !== 'undefined' ? myId : ''), cid:c.cid}}); }catch(e){}
    }
    return r;
  };
}

/* ===========================================================================
   19. КЛАВИАТУРА: Escape закрывает слои чата
   ======================================================================== */
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  if(sheetEl) return;                       /* у шторки свой обработчик */
  let pal = null; try{ pal = cpPalette; }catch(_){}
  if(pal){ e.preventDefault(); palHide(); return; }
  if(selMode){ e.preventDefault(); selOff(); return; }
  const c = chat();
  if(c && c.ch2th){ e.preventDefault(); exitThread(); return; }
});

/* ===========================================================================
   20. СТАРТ
   ======================================================================== */
function init(){
  try{
    /* убираем мок-статусы, засеянные ядром: правду о прочтении знает только
       реальное событие, а не таймер */
    chats().forEach(c => (c.msgs || []).forEach(m => { if(m){ m.cpSt = null; mid(m); } }));
  }catch(e){}
  buildDown(); buildThreadBar(); buildSelBar();
  bindClicks(); bindMouseSwipe(); bindMouseLongPress();
  rebindSearchInput();
  try{ curFolder = coreFolder(ST.folder); }catch(e){}
  try{ window.renderFolders(); }catch(e){}
  try{ if(typeof renderChatList === 'function') renderChatList((byId('chatSearch') || {}).value || ''); }catch(e){}
  if(chat()) afterRender();
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>setTimeout(init, 0));
else setTimeout(init, 0);
/* ядро строит пин-бар и строку поиска в своём init — досаживаемся следом */
setTimeout(()=>{ rebindSearchInput(); buildThreadBar(); buildSelBar(); buildDown(); }, 400);

/* ===========================================================================
   21. ПУБЛИЧНОЕ API (используется пробником и соседними модулями)
   ======================================================================== */
window.okoChat2 = {
  react:        (idx, em) => window.pickReact(idx, em),
  reactors:     openReactors,
  palette:      (idx) => { const el = msgsEl(); const n = el && el.children[idx]; if(n) palShow(n, idx); },
  swipeReply:   swipeReply,
  jumpToQuoted: jumpToQuoted,
  search:       openChatSearch,
  selectOn:     selOn,
  selectOff:    selOff,
  selectToggle: selToggle,
  selected:     () => selSet.size,
  forward:      (idxs) => { const c = chat(); if(!c) return;
                  forwardMany((idxs || []).map(i => c.msgs[i]).filter(Boolean), c); },
  del:          (idxs) => { const c = chat(); if(!c) return;
                  deleteSheet((idxs || []).map(i => c.msgs[i]).filter(Boolean), c); },
  folder:       (f) => window.setFolder(f),
  folders:      () => ST.folders.slice(),
  newFolder:    () => folderEditor(null),
  thread:       (chanId, postIdx) => window.okoOpenComments(chanId, postIdx),
  exitThread:   exitThread,
  closeSheet:   () => closeSheet2(),
  state:        () => {
    const c = chat();
    return {
      chat: c ? String(c.id) : null,
      selMode: selMode, selected: selSet.size,
      thread: c && c.ch2th ? c.ch2th.key : null,
      unreadLine: c ? c.ch2ub : null,
      folder: ST.folder,
      pinned: !!(c && c.cpPin),
      sheet: !!sheetEl,
      palette: (function(){ try{ return !!cpPalette; }catch(e){ return false; } })()
    };
  }
};

})();
