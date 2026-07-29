/* ===== CALLS: два движка звонков =====
   Префикс cl-. Оба поверх ядра, base.html не тронут.
   1) Групповая конференция (Zoom-like) — админ инициирует в чате/группе/канале.
   2) Личный звонок (аудио/видео) — с getUserMedia, PIP собеседника, анимацией колец.
   Экспорт: window.callStartConf(chatId, isAdmin), window.callStartPersonal(userId, isVideo).
   Chain-patch: старый window.startCall(video) → callStartPersonal(currentChat.id, video). */

(function(){
'use strict';

/* ---------------- маленькие утилиты ---------------- */
const $ = (id)=>document.getElementById(id);
const CL_I = (name)=>`<svg class="cl-i"><use href="#cl-i-${name}"/></svg>`;
const clEsc = (s)=> (typeof esc==='function' ? esc(s) : String(s==null?'':s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])));
const clFmtSec = (n)=>{ n=Math.max(0,n|0); const m=String((n/60)|0).padStart(2,'0'), s=String(n%60).padStart(2,'0'); return m+':'+s; };
const clToast = (t)=>{ const d=document.createElement('div'); d.className='cl-toast'; d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(),2700); };

/* локальное хранилище — политики звонков в чатах (админ-настройки) */
const CL_LS = 'oko-calls-v1';
const CL = (()=>{ try{ return JSON.parse(localStorage.getItem(CL_LS))||{}; }catch(_){ return {}; } })();
if(!CL.policy || typeof CL.policy!=='object') CL.policy = {}; /* {chatId:{mic:1,cam:1,chat:1,share:1}} */
function clSave(){ try{ localStorage.setItem(CL_LS, JSON.stringify({policy:CL.policy})); }catch(_){} }
function clGetPolicy(chatId){
  const p = CL.policy[chatId] || {};
  return { mic: p.mic!==0, cam: p.cam!==0, chat: p.chat!==0, share: p.share!==0 };
}
function clSetPolicy(chatId, key, val){
  const p = CL.policy[chatId] = CL.policy[chatId] || {};
  p[key] = val ? 1 : 0; clSave();
}

/* ---------------- имена/аватар из ядра ---------------- */
function clChatById(id){
  try{ if(typeof CHATS==='undefined') return null; return CHATS.find(c=>String(c.id)===String(id)) || null; }catch(_){ return null; }
}
function clAvaLetter(name){ return (String(name||'O').trim()[0]||'O').toUpperCase(); }

/* ===================================================================
   1) ГРУППОВАЯ КОНФЕРЕНЦИЯ (Zoom-like)
   =================================================================== */
const CL_DEMO_NAMES = ['Даниэль','Аня','Марк','Кира','Артём','Соня','Лев','Настя','Тимур','Диана'];
let confState = null;
let confTimer = null;
let confTick = null;
let confPillTimer = null;

function clMakeDemoParts(hostName){
  /* 5–8 демо-участников + сам «я» первым */
  const pool = CL_DEMO_NAMES.filter(n=>n!==hostName);
  const cnt = 5 + Math.floor(Math.random()*4);
  const out = [{id:'me', name:'Вы', ava:'Я', role:'host', mic:true, cam:false, hand:false, speaking:false, muted:false, self:true}];
  for(let i=0;i<cnt;i++){
    const nm = pool[Math.floor(Math.random()*pool.length)] || ('Гость '+(i+1));
    out.push({
      id:'p'+i, name:nm, ava:clAvaLetter(nm),
      role: i===0 ? 'co' : '', mic: Math.random()>.3, cam: Math.random()>.7,
      hand:false, speaking:false, muted:false
    });
  }
  return out;
}

/**
 * Открыть общий созвон.
 * @param {*} chatId       — id чата (для политики)
 * @param {boolean} isAdmin — есть ли у меня админ-права (mic/cam/chat/kick)
 * @param {object} opts    — { chatName, participants }
 */
window.callStartConf = function(chatId, isAdmin, opts){
  opts = opts || {};
  const chat = clChatById(chatId);
  if(!chat && !opts.chatName){ clToast('Чат не найден'); return; }
  clStopPersonalCall(true); /* нельзя параллельно с личным */

  confState = {
    chatId: chatId, isAdmin: !!isAdmin,
    chatName: opts.chatName || (chat && chat.name) || 'Общий созвон',
    sec: 0, mic: true, cam: false, share: false, side: false, speakerPin: null,
    policy: clGetPolicy(chatId),
    parts: (opts.participants && opts.participants.length) ? opts.participants : clMakeDemoParts()
  };

  $('cl-conf-name').textContent = confState.chatName;
  $('cl-conf-time').textContent = '00:00';
  $('cl-conf').classList.add('on');
  $('cl-conf').setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';

  clHidePill();
  clRenderConfTiles();
  clUpdateConfButtons();

  /* таймер */
  clearInterval(confTimer);
  confTimer = setInterval(()=>{
    confState.sec++;
    const t = clFmtSec(confState.sec);
    const el = $('cl-conf-time'); if(el) el.textContent = t;
    const p = $('cl-pill-time'); if(p) p.textContent = t;
  }, 1000);

  /* симуляция «кто говорит» / поднятые руки */
  clearInterval(confTick);
  confTick = setInterval(clTickSpeakers, 1400);

  /* блокировка backButton — свернуть */
  if(typeof nvPush==='function') nvPush('cl:conf', ()=>clConfMin());
};

function clRenderConfTiles(){
  const stage = $('cl-conf-stage'); if(!stage) return;
  const parts = confState.parts;
  stage.classList.toggle('dense', parts.length >= 9);
  stage.classList.toggle('speaker', !!confState.speakerPin);

  const tileHtml = (p, size)=>{
    const speaking = p.speaking && p.mic && !p.muted;
    const showVideo = p.cam && !p.self;
    const flags = [];
    if(!p.mic || p.muted) flags.push(`<span class="muted" title="Микрофон выключен">${CL_I('mic-off')}</span>`);
    else if(speaking) flags.push(`<span class="on" title="Говорит">${CL_I('wave')}</span>`);
    if(!p.cam) flags.push(`<span title="Камера выключена">${CL_I('cam-off')}</span>`);
    const role = p.role==='host' ? `<span class="cl-role">${CL_I('crown')}</span>` :
                 p.role==='co'   ? `<span class="cl-role">${CL_I('shield')}</span>` : '';
    const hand = p.hand ? `<span class="cl-tile-hand" title="Просит слово">${CL_I('hand')}</span>` : '';
    return `<div class="cl-tile ${speaking?'speaking':''} ${confState.speakerPin===p.id?'pinned':''}"
                 data-id="${p.id}" onclick="__cl_tileTap('${p.id}',event)" oncontextmenu="return __cl_tileCtx('${p.id}',event)">
      ${showVideo ? `<video class="cl-tile-vid" playsinline autoplay muted></video>` : ''}
      ${!showVideo ? `<div class="cl-tile-ava">${clEsc(p.ava||'?')}</div>` : ''}
      <div class="cl-tile-name">${role}${clEsc(p.name)}</div>
      ${flags.length ? `<div class="cl-tile-flag">${flags.join('')}</div>` : ''}
      ${hand}
    </div>`;
  };

  if(confState.speakerPin){
    const pin = parts.find(p=>p.id===confState.speakerPin);
    const rest = parts.filter(p=>p.id!==confState.speakerPin);
    stage.innerHTML = (pin?tileHtml(pin):'')
      + `<div class="cl-strip">${rest.map(p=>tileHtml(p)).join('')}</div>`;
  } else {
    stage.innerHTML = parts.map(p=>tileHtml(p)).join('');
  }
  $('cl-conf-count').textContent = parts.length;
  const n = $('cl-conf-partn'); if(n) n.textContent = String(parts.length);
}

function clUpdateConfButtons(){
  if(!confState) return;
  const s = confState;
  const meMic = s.mic && (s.isAdmin || s.policy.mic);
  const meCam = s.cam && (s.isAdmin || s.policy.cam);
  const meShare = s.share && (s.isAdmin || s.policy.share);
  const set = (id, on, icon)=>{ const b=$(id); if(!b) return; b.classList.toggle('on', !!on); b.querySelector('use').setAttribute('href','#cl-i-'+icon); };
  set('cl-conf-mic',   meMic,   meMic ? 'mic' : 'mic-off');
  set('cl-conf-cam',   meCam,   meCam ? 'cam' : 'cam-off');
  set('cl-conf-share', meShare, 'share');
  set('cl-conf-part',  s.side,  'users');
  const meObj = s.parts.find(p=>p.self); if(meObj){ meObj.mic = meMic; meObj.cam = meCam; }

  /* заблокированные ядром политики */
  const lockBtn = (id, allowed)=>{ const b=$(id); if(!b) return; b.style.opacity = allowed ? '' : '.35'; b.style.pointerEvents = allowed ? '' : 'none'; };
  lockBtn('cl-conf-mic',   s.isAdmin || s.policy.mic);
  lockBtn('cl-conf-cam',   s.isAdmin || s.policy.cam);
  lockBtn('cl-conf-share', s.isAdmin || s.policy.share);
  lockBtn('cl-conf-chat',  s.isAdmin || s.policy.chat);

  /* меню (шестерёнка) только у админа */
  const g = $('cl-conf-gear'); if(g) g.style.display = s.isAdmin ? '' : 'none';
}

function clTickSpeakers(){
  if(!confState || !$('cl-conf').classList.contains('on')) return;
  const active = confState.parts.filter(p=>p.mic && !p.muted);
  const shouldSpeak = active[Math.floor(Math.random()*active.length)];
  confState.parts.forEach(p=>{ p.speaking = p===shouldSpeak; });
  /* случайно поднять/опустить руку у не-админа */
  if(Math.random() < .12){
    const cand = confState.parts.filter(p=>!p.self && p.role!=='host');
    const pick = cand[Math.floor(Math.random()*cand.length)];
    if(pick){ pick.hand = !pick.hand; }
  }
  clRenderConfTiles();
}

/* --- взаимодействия по тайлу --- */
window.__cl_tileTap = function(pid, ev){
  ev && ev.stopPropagation && ev.stopPropagation();
  if(!confState) return;
  /* короткое нажатие: pin/unpin (speaker-view) */
  if(!ev._longpress){
    confState.speakerPin = confState.speakerPin===pid ? null : pid;
    clRenderConfTiles();
  }
};
window.__cl_tileCtx = function(pid, ev){
  ev && ev.preventDefault && ev.preventDefault();
  clOpenPartMenu(pid, ev);
  return false;
};

/* long-press на mobile → меню админа по участнику */
document.addEventListener('touchstart', (e)=>{
  const tile = e.target.closest && e.target.closest('#cl-conf-stage .cl-tile');
  if(!tile) return;
  const pid = tile.getAttribute('data-id');
  tile._lpT = setTimeout(()=>{ tile._lp = 1; clOpenPartMenu(pid, e); }, 460);
}, {passive:true});
document.addEventListener('touchend', (e)=>{
  const tile = e.target.closest && e.target.closest('#cl-conf-stage .cl-tile');
  if(!tile) return; clearTimeout(tile._lpT);
  if(tile._lp){ tile._lp = 0; e.preventDefault && e.preventDefault(); }
}, {passive:false});

function clOpenPartMenu(pid, ev){
  if(!confState) return;
  const menu = $('cl-conf-menu'); if(!menu) return;
  const p = confState.parts.find(x=>x.id===pid); if(!p) return;
  const isMe = !!p.self;
  const canAdmin = confState.isAdmin && !isMe;

  const items = [
    `<div class="cl-menu-hd">${clEsc(p.name)}</div>`,
    `<button class="cl-menu-item" onclick="__cl_pinPart('${pid}')">${CL_I(confState.speakerPin===pid?'x':'users')}<span>${confState.speakerPin===pid?'Убрать из фокуса':'Показать крупно'}</span></button>`,
  ];
  if(canAdmin){
    items.push(`<div class="cl-menu-sep"></div>`);
    items.push(`<button class="cl-menu-item" onclick="__cl_toggleMute('${pid}')">${CL_I(p.muted?'mic':'mic-off')}<span>${p.muted?'Разрешить микрофон':'Выключить микрофон'}</span></button>`);
    items.push(`<button class="cl-menu-item" onclick="__cl_toggleCam('${pid}')">${CL_I(p.cam?'cam-off':'cam')}<span>${p.cam?'Выключить камеру':'Разрешить камеру'}</span></button>`);
    if(p.hand){
      items.push(`<button class="cl-menu-item" onclick="__cl_lowerHand('${pid}')">${CL_I('hand')}<span>Опустить руку</span></button>`);
    }
    items.push(`<div class="cl-menu-sep"></div>`);
    items.push(`<button class="cl-menu-item danger" onclick="__cl_kick('${pid}')">${CL_I('x')}<span>Удалить из звонка</span></button>`);
  }
  menu.innerHTML = items.join('');

  /* позиционируем возле точки клика */
  let x=20, y=100;
  if(ev){
    if(ev.clientX!=null){ x = ev.clientX; y = ev.clientY; }
    else if(ev.touches && ev.touches[0]){ x = ev.touches[0].clientX; y = ev.touches[0].clientY; }
  }
  const rect = document.body.getBoundingClientRect();
  x = Math.min(x, rect.width - 240); y = Math.min(y, rect.height - 260);
  menu.style.left = Math.max(8,x) + 'px';
  menu.style.top  = Math.max(8,y) + 'px';
  menu.classList.add('on'); menu.setAttribute('aria-hidden','false');
  setTimeout(()=>{ document.addEventListener('click', clClosePartMenu, {once:true}); }, 30);
}
function clClosePartMenu(){ const m=$('cl-conf-menu'); if(m){ m.classList.remove('on'); m.setAttribute('aria-hidden','true'); } }
window.__cl_pinPart = function(pid){ confState.speakerPin = confState.speakerPin===pid?null:pid; clClosePartMenu(); clRenderConfTiles(); };
window.__cl_toggleMute = function(pid){ const p=confState.parts.find(x=>x.id===pid); if(!p) return; p.muted=!p.muted; if(p.muted) p.mic=false; else p.mic=true; clClosePartMenu(); clRenderConfTiles(); clToast(p.muted?'Микрофон выключен для '+p.name:'Микрофон разрешён для '+p.name); };
window.__cl_toggleCam = function(pid){ const p=confState.parts.find(x=>x.id===pid); if(!p) return; p.cam=!p.cam; clClosePartMenu(); clRenderConfTiles(); };
window.__cl_lowerHand = function(pid){ const p=confState.parts.find(x=>x.id===pid); if(!p) return; p.hand=false; clClosePartMenu(); clRenderConfTiles(); };
window.__cl_kick = function(pid){
  const p=confState.parts.find(x=>x.id===pid); if(!p) return;
  confState.parts = confState.parts.filter(x=>x.id!==pid);
  clClosePartMenu(); clRenderConfTiles(); clToast(p.name+' удалён из звонка');
};

/* --- боковая панель участников --- */
function clOpenSide(){
  confState.side = true; const s = $('cl-conf-side'); if(!s) return;
  const body = $('cl-side-body');
  body.innerHTML = confState.parts.map(p=>{
    const speaking = p.speaking && p.mic && !p.muted;
    return `<button class="cl-prow" onclick="__cl_openMenuFromSide('${p.id}',event)">
      <div class="cl-pava">${clEsc(p.ava||'?')}</div>
      <div class="cl-pbody"><b>${clEsc(p.name)}${p.self?' (вы)':''}</b>
        <small>${p.role==='host'?'владелец':p.role==='co'?'админ':(speaking?'говорит…':'в звонке')}</small></div>
      <div class="cl-pflag">
        <span class="${p.mic&&!p.muted ? (speaking?'on':'') : 'muted'}">${CL_I(p.mic&&!p.muted?'mic':'mic-off')}</span>
        <span class="${p.cam?'on':''}">${CL_I(p.cam?'cam':'cam-off')}</span>
      </div></button>`;
  }).join('');
  s.classList.add('on'); s.setAttribute('aria-hidden','false');
  clUpdateConfButtons();
}
function clCloseSide(){ confState.side=false; const s=$('cl-conf-side'); if(s){ s.classList.remove('on'); s.setAttribute('aria-hidden','true'); } clUpdateConfButtons(); }
window.__cl_openMenuFromSide = function(pid, ev){ clOpenPartMenu(pid, ev); };

/* --- настройки владельца (mic/cam/chat/share для всех) --- */
function clOpenSettings(){
  if(!confState || !confState.isAdmin) return;
  const body = $('cl-settings-body');
  const p = confState.policy;
  const row = (k, title, sub)=>{
    return `<button class="cl-toggle" onclick="__cl_flipPolicy('${k}')">
      <span style="flex:1"><b>${title}</b><small>${sub}</small></span>
      <span class="cl-sw ${p[k]?'on':''}"><i></i></span>
    </button>`;
  };
  body.innerHTML =
    row('mic', 'Разрешить микрофон всем', 'Иначе включать смогут только админы') +
    row('cam', 'Разрешить камеру всем', 'Участники смогут вещать видео') +
    row('share', 'Разрешить демо экрана', 'Демонстрация экрана участникам') +
    row('chat', 'Разрешить чат в созвоне', 'Иначе чат только для админов');
  const sh = $('cl-conf-settings'); sh.classList.add('on'); sh.setAttribute('aria-hidden','false');
}
function clCloseSettings(){ const sh=$('cl-conf-settings'); if(sh){ sh.classList.remove('on'); sh.setAttribute('aria-hidden','true'); } }
window.__cl_flipPolicy = function(k){
  if(!confState) return;
  const v = !confState.policy[k]; confState.policy[k] = v;
  clSetPolicy(confState.chatId, k, v);
  clOpenSettings();
  clUpdateConfButtons();
  clToast((v?'Разрешено: ':'Запрещено: ')+({mic:'микрофон',cam:'камера',share:'демо экрана',chat:'чат'}[k]||k));
};

/* --- реакции --- */
function clFlyReaction(){
  const box = $('cl-conf-reactions'); if(!box) return;
  box.setAttribute('aria-hidden','false');
  for(let i=0;i<3;i++){
    const f = document.createElement('div'); f.className='cl-react-fly';
    f.innerHTML = CL_I('heart');
    f.style.left = (30 + Math.random()* (box.clientWidth-60)) + 'px';
    f.style.setProperty('--tx', (Math.random()*80-40) + 'px');
    f.style.animationDelay = (i*0.12)+'s';
    box.appendChild(f); setTimeout(()=>f.remove(), 2600);
  }
}

/* --- свернуть / завершить --- */
function clConfMin(){
  const el = $('cl-conf'); if(!el) return;
  el.classList.remove('on'); el.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  clShowPill(confState && confState.chatName || 'Созвон');
  if(typeof nvPop==='function') nvPop('cl:conf');
}
function clConfRestore(){
  const el = $('cl-conf'); if(!el || !confState) return;
  el.classList.add('on'); el.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  clHidePill();
  if(typeof nvPush==='function') nvPush('cl:conf', ()=>clConfMin());
}
function clConfEnd(){
  clearInterval(confTimer); clearInterval(confTick);
  const el = $('cl-conf'); if(el){ el.classList.remove('on'); el.setAttribute('aria-hidden','true'); }
  clCloseSide(); clCloseSettings(); clClosePartMenu(); clHidePill();
  document.body.style.overflow = '';
  const sec = confState ? confState.sec : 0;
  const chatId = confState && confState.chatId;
  confState = null;
  if(typeof nvPop==='function') nvPop('cl:conf');
  /* системное сообщение в ленту чата */
  try{
    if(typeof currentChat!=='undefined' && currentChat && String(currentChat.id)===String(chatId) && typeof pushMsg==='function'){
      pushMsg({in:0, t:(typeof nowT==='function'?nowT():''), kind:'sys', body:'Созвон завершён · '+clFmtSec(sec)});
    }
  }catch(_){}
}

/* ===================================================================
   2) ЛИЧНЫЙ ЗВОНОК (аудио/видео)
   =================================================================== */
let persState = null;
let persStream = null;
let persTimer = null;

/**
 * Начать личный звонок.
 * @param {*} userId  — id собеседника (для лога/имени)
 * @param {boolean} isVideo — видеозвонок?
 * @param {object} opts — { name, ava, avaUrl }
 */
window.callStartPersonal = function(userId, isVideo, opts){
  opts = opts || {};
  const chat = clChatById(userId);
  const name = opts.name || (chat && chat.name) || (typeof currentChat!=='undefined' && currentChat && currentChat.name) || 'Собеседник';
  const ava  = opts.ava  || (chat && chat.ava)  || clAvaLetter(name);

  if(confState){ clToast('Сейчас идёт общий созвон'); return; }
  clStopPersonalCall(true);

  persState = { userId, video:!!isVideo, name, ava, mic:true, spk:true, cam:!!isVideo, sec:0, connected:false };

  const el = $('cl-personal'); if(!el){ console.warn('[calls] overlay #cl-personal not found'); return; }
  el.classList.remove('video','video-remote');
  el.classList.toggle('video', !!isVideo);
  $('cl-pers-name').textContent = name;
  $('cl-pers-status').textContent = isVideo ? 'Видеозвонок · соединение…' : 'Аудиозвонок · соединение…';
  $('cl-pers-ava').textContent = ava;

  clUpdatePersButtons();
  el.classList.add('on'); el.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden';
  clHidePill();

  if(typeof nvPush==='function') nvPush('cl:pers', ()=>clPersMin());

  /* PIP: моё видео при видеозвонке */
  const pip = $('cl-pers-pip');
  if(isVideo){ pip.hidden = false; clStartUserMedia(true); }
  else       { pip.hidden = true;  clStartUserMedia(false); }

  /* «соединение» → «в сети» через 1.8с, стартуем таймер */
  setTimeout(()=>{
    if(!persState) return;
    persState.connected = true;
    $('cl-pers-status').textContent = clFmtSec(persState.sec);
    clearInterval(persTimer);
    persTimer = setInterval(()=>{
      if(!persState) return;
      persState.sec++;
      const t = clFmtSec(persState.sec);
      $('cl-pers-status').textContent = t;
      const p = $('cl-pill-time'); if(p) p.textContent = t;
    }, 1000);
    /* мок анимации «говорит» */
    el.classList.add('talking');
  }, 1800);
};

async function clStartUserMedia(withVideo){
  try{
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ clPipFallback(); return; }
    if(persStream){ try{ persStream.getTracks().forEach(t=>t.stop()); }catch(_){} persStream = null; }
    const st = await navigator.mediaDevices.getUserMedia({ video: withVideo ? {facingMode:'user'} : false, audio: true });
    if(!persState){ st.getTracks().forEach(t=>t.stop()); return; }
    persStream = st;
    const selfV = $('cl-pers-self');
    if(withVideo && selfV){
      selfV.srcObject = st;
      selfV.play && selfV.play().catch(()=>{});
      $('cl-pers-pip').classList.add('has-video');
    } else {
      $('cl-pers-pip').classList.remove('has-video');
    }
  }catch(err){
    clPipFallback();
  }
}
function clPipFallback(){
  const pip = $('cl-pers-pip'); if(!pip) return;
  pip.classList.remove('has-video');
  const fb = $('cl-pers-self-fb'); if(fb) fb.textContent = 'Разреши доступ к камере';
}
function clStopUserMedia(){
  if(persStream){ try{ persStream.getTracks().forEach(t=>t.stop()); }catch(_){} persStream = null; }
  const selfV = $('cl-pers-self'); if(selfV) selfV.srcObject = null;
  const pip = $('cl-pers-pip'); if(pip) pip.classList.remove('has-video');
}

function clUpdatePersButtons(){
  if(!persState) return;
  const s = persState;
  const set = (id, on, icon)=>{ const b=$(id); if(!b) return; b.classList.toggle('on', !!on); b.querySelector('use').setAttribute('href','#cl-i-'+icon); };
  set('cl-pers-mic', s.mic, s.mic?'mic':'mic-off');
  set('cl-pers-spk', s.spk, s.spk?'spk':'spk-off');
  set('cl-pers-cam', s.cam, s.cam?'cam':'cam-off');
  /* flip и cam видны только при видеозвонке */
  $('cl-pers-cam').style.display  = s.video ? '' : 'none';
  $('cl-pers-flip').style.display = s.video ? '' : 'none';
}

function clPersMin(){
  const el = $('cl-personal'); if(!el) return;
  el.classList.remove('on'); el.setAttribute('aria-hidden','true');
  document.body.style.overflow = '';
  clShowPill(persState && persState.name || 'Звонок');
  if(typeof nvPop==='function') nvPop('cl:pers');
}
function clPersRestore(){
  const el = $('cl-personal'); if(!el || !persState) return;
  el.classList.add('on'); el.setAttribute('aria-hidden','false');
  document.body.style.overflow = 'hidden'; clHidePill();
  if(typeof nvPush==='function') nvPush('cl:pers', ()=>clPersMin());
}
function clStopPersonalCall(silent){
  clearInterval(persTimer);
  clStopUserMedia();
  const el = $('cl-personal'); if(el){ el.classList.remove('on','video','video-remote','talking'); el.setAttribute('aria-hidden','true'); }
  document.body.style.overflow = '';
  clHidePill();
  const sec = persState ? persState.sec : 0;
  const wasVideo = persState ? persState.video : false;
  persState = null;
  if(typeof nvPop==='function') nvPop('cl:pers');
  if(silent) return;
  /* лог в чат */
  try{
    if(typeof currentChat!=='undefined' && currentChat && typeof pushMsg==='function'){
      pushMsg({in:0, t:(typeof nowT==='function'?nowT():''), kind:'sys',
        body:(wasVideo?'Видеозвонок':'Аудиозвонок')+' · '+(sec>0?clFmtSec(sec):'отменён')});
    }
  }catch(_){}
}

/* ===================================================================
   Плашка «свёрнутого» звонка
   =================================================================== */
function clShowPill(name){
  const pill = $('cl-pill'); if(!pill) return;
  $('cl-pill-name').textContent = name;
  const t = confState ? clFmtSec(confState.sec) : (persState ? clFmtSec(persState.sec) : '00:00');
  $('cl-pill-time').textContent = t;
  pill.classList.add('on'); pill.setAttribute('aria-hidden','false');
  pill.onclick = ()=>{
    if(confState) clConfRestore(); else if(persState) clPersRestore();
  };
}
function clHidePill(){ const p=$('cl-pill'); if(p){ p.classList.remove('on'); p.setAttribute('aria-hidden','true'); } }

/* ===================================================================
   Wiring кнопок оверлеев (single delegation после DOMReady)
   =================================================================== */
function clBind(){
  /* конференция */
  $('cl-conf-end') && ($('cl-conf-end').onclick = clConfEnd);
  $('cl-conf-min') && ($('cl-conf-min').onclick = clConfMin);
  $('cl-conf-mic') && ($('cl-conf-mic').onclick = ()=>{ if(!confState) return; confState.mic=!confState.mic; clUpdateConfButtons(); clRenderConfTiles(); });
  $('cl-conf-cam') && ($('cl-conf-cam').onclick = ()=>{ if(!confState) return; confState.cam=!confState.cam; clUpdateConfButtons(); clRenderConfTiles(); });
  $('cl-conf-share') && ($('cl-conf-share').onclick = ()=>{ if(!confState) return; confState.share=!confState.share; clUpdateConfButtons(); clToast(confState.share?'Демонстрация экрана включена':'Демонстрация экрана выключена'); });
  $('cl-conf-react') && ($('cl-conf-react').onclick = clFlyReaction);
  $('cl-conf-part') && ($('cl-conf-part').onclick = ()=>{ confState && (confState.side ? clCloseSide() : clOpenSide()); });
  $('cl-conf-chat') && ($('cl-conf-chat').onclick = ()=>{ if(!confState) return; if(!(confState.isAdmin||confState.policy.chat)){ clToast('Чат в созвоне отключён владельцем'); return; } clToast('Чат созвона откроется в следующем шаге'); });
  $('cl-conf-gear') && ($('cl-conf-gear').onclick = clOpenSettings);
  $('cl-conf-more') && ($('cl-conf-more').onclick = ()=>{ confState && confState.isAdmin ? clOpenSettings() : clToast('Настройки доступны админам'); });
  $('cl-side-close') && ($('cl-side-close').onclick = clCloseSide);
  $('cl-settings-close') && ($('cl-settings-close').onclick = clCloseSettings);

  /* личный */
  $('cl-pers-end') && ($('cl-pers-end').onclick = ()=>clStopPersonalCall(false));
  $('cl-pers-min') && ($('cl-pers-min').onclick = clPersMin);
  $('cl-pers-mic') && ($('cl-pers-mic').onclick = ()=>{
    if(!persState) return;
    persState.mic = !persState.mic;
    if(persStream){ try{ persStream.getAudioTracks().forEach(t=>t.enabled=persState.mic); }catch(_){} }
    clUpdatePersButtons();
  });
  $('cl-pers-spk') && ($('cl-pers-spk').onclick = ()=>{ if(!persState) return; persState.spk=!persState.spk; clUpdatePersButtons(); });
  $('cl-pers-cam') && ($('cl-pers-cam').onclick = ()=>{
    if(!persState) return;
    persState.cam = !persState.cam;
    if(persStream){ try{ persStream.getVideoTracks().forEach(t=>t.enabled=persState.cam); }catch(_){} }
    if(persState.cam && !persStream){ clStartUserMedia(true); }
    clUpdatePersButtons();
  });
  $('cl-pers-flip') && ($('cl-pers-flip').onclick = ()=>{
    if(!persState || !persStream) return;
    persState._face = persState._face==='environment' ? 'user' : 'environment';
    try{ persStream.getTracks().forEach(t=>t.stop()); }catch(_){}
    persStream = null;
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ return; }
    navigator.mediaDevices.getUserMedia({video:{facingMode:persState._face}, audio:true}).then(st=>{
      if(!persState){ st.getTracks().forEach(t=>t.stop()); return; }
      persStream = st;
      const v = $('cl-pers-self'); if(v){ v.srcObject = st; v.play&&v.play().catch(()=>{}); }
      $('cl-pers-pip').classList.add('has-video');
    }).catch(()=>{ clPipFallback(); });
  });
}

/* ===================================================================
   Chain-patch существующего startCall() → callStartPersonal()
   =================================================================== */
function clPatchCore(){
  /* блокируем родной callScreen */
  const legacy = $('callScreen'); if(legacy) legacy.style.display = 'none';

  if(typeof window.startCall === 'function'){
    window.startCall = function(video){
      const id = (typeof currentChat!=='undefined' && currentChat) ? currentChat.id : null;
      if(id==null){ return; }
      window.callStartPersonal(id, !!video);
    };
  }
  if(typeof window.endCall === 'function'){
    window.endCall = function(){ if(persState) clStopPersonalCall(false); if(confState) clConfEnd(); };
  }
}

/* ===================================================================
   Инъекция «Начать созвон» в шапку группы/канала
   =================================================================== */
function clInjectStartBtn(){
  const head = document.querySelector('#convBody .conv-head'); if(!head) return;
  const ch = (typeof currentChat!=='undefined' && currentChat) ? currentChat : null;
  const existing = head.querySelector('.cl-conv-start');

  const isGroup = ch && (ch.kind==='group' || ch.kind==='channel');
  const canAdmin = ch && (ch.managed || ch.owner || ch.kind==='channel'); /* демо: managed=admin */

  if(!isGroup || !canAdmin){
    if(existing) existing.remove();
    return;
  }
  if(existing) return;

  const btn = document.createElement('button');
  btn.className = 'cl-conv-start'; btn.type = 'button';
  btn.innerHTML = `<i class="cl-live"></i>Созвон`;
  btn.title = 'Начать общий созвон';
  btn.onclick = ()=>{ callStartConf(ch.id, true, {chatName:ch.name}); };
  /* вставляем между инфо и родными кнопками звонка */
  const firstCall = head.querySelector('.ch-call');
  if(firstCall) head.insertBefore(btn, firstCall);
  else head.appendChild(btn);
}

/* хук на openConv/closeConv для перерисовки кнопки */
function clHookOpenConv(){
  if(typeof window.openConv === 'function' && !window.openConv._clPatched){
    const _prev = window.openConv;
    window.openConv = function(id){ _prev.apply(this, arguments); try{ clInjectStartBtn(); }catch(_){} };
    window.openConv._clPatched = true;
  }
  if(typeof window.closeConv === 'function' && !window.closeConv._clPatched){
    const _prev = window.closeConv;
    window.closeConv = function(){
      /* при выходе из чата — не рвём активный звонок, только чистим кнопку */
      const head = document.querySelector('#convBody .conv-head');
      const b = head && head.querySelector('.cl-conv-start'); if(b) b.remove();
      return _prev.apply(this, arguments);
    };
    window.closeConv._clPatched = true;
  }
}

/* ===================================================================
   INIT
   =================================================================== */
function clInit(){
  clBind();
  clPatchCore();
  clHookOpenConv();
  /* если чат уже открыт при первом заходе */
  try{ clInjectStartBtn(); }catch(_){}
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', clInit);
else clInit();

})();
