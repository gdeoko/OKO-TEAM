/* ============================================================
   МОДУЛЬ verify-stickers (vs-)
   1) Верификация аккаунта (синяя галочка): строка в профиле,
      sheet со статусом и условиями, заявка -> модерация -> бейдж.
   2) Галочки у имён в профиле / ленте / списке чатов (chain-патчи).
   3) Премиум-стикеры «TON Crystal» (пак pack:'ton', гейт PRO/BUSINESS),
      дождь кристаллов при отправке, стикер к новому посту.
   ============================================================ */

/* ---------- 1. ВЕРИФИКАЦИЯ ---------- */
let VS_VERIFY = { status: 'none', name: null }; /* none | pending | approved */
function vsSave(){ try{ localStorage.setItem('oko-verify', JSON.stringify(VS_VERIFY)); }catch(e){} }
(function vsRestore(){
  try{
    const d = JSON.parse(localStorage.getItem('oko-verify') || 'null');
    if(d && d.status){
      VS_VERIFY = d;
      if(d.status === 'pending') VS_VERIFY.status = 'none'; /* заявка не переживает перезагрузку */
      if(d.status === 'approved'){
        if(typeof VERIFIED !== 'undefined'){ VERIFIED.add(PROFILE.name); if(d.name) VERIFIED.add(d.name); }
      }
    }
  }catch(e){}
  /* синхронизация: если аккаунт уже в VERIFIED (галочка у имени),
     статус верификации не может быть «нет» — иначе противоречие в UI */
  if(VS_VERIFY.status === 'none' && typeof VERIFIED !== 'undefined' && VERIFIED.has(PROFILE.name)){
    VS_VERIFY = { status: 'approved', name: PROFILE.name };
    vsSave();
  }
})();

function vsBadgeHtml(){
  return `<span class="vs-badge" title="Верифицированный аккаунт"><svg viewBox="0 0 100 100" aria-hidden="true"><use href="#i-verified"/></svg></span>`;
}
function vsPremiumOk(){
  return /PRO|BUSINESS/.test(PROFILE.tier || '') || (typeof isOwner === 'function' && isOwner());
}

/* строка «Верификация» в карточке настроек профиля (перед админкой) */
function vsInsertProw(){
  if(document.getElementById('vsProwVerify')) return;
  const anchor = document.getElementById('prowAdmin');
  if(!anchor || !anchor.parentNode) return;
  const b = document.createElement('button');
  b.className = 'prow'; b.id = 'vsProwVerify';
  b.onclick = vsOpenVerify;
  b.innerHTML = `<svg class="i"><use href="#i-verified"/></svg> Верификация <span class="vs-chip" id="vsProwChip" style="margin-left:auto">нет</span> <span class="chev" style="margin-left:0"><svg class="i"><use href="#i-chev"/></svg></span>`;
  anchor.parentNode.insertBefore(b, anchor);
  vsUpdateProw();
}
function vsUpdateProw(){
  const c = document.getElementById('vsProwChip'); if(!c) return;
  const st = VS_VERIFY.status;
  c.className = 'vs-chip' + (st === 'approved' ? ' on' : st === 'pending' ? ' wait' : '');
  c.style.marginLeft = 'auto';
  c.textContent = st === 'approved' ? 'есть' : st === 'pending' ? 'проверка' : 'нет';
}

function vsOpenVerify(){ vsRenderVerify(); openSheet('vs-verify'); }
function vsRenderVerify(){
  const v = document.getElementById('vsVerifyView'); if(!v) return;
  const st = VS_VERIFY.status;
  const meta = {
    none:     { cls:'',        ico:'user',     t:'Не верифицирован', s:'Синяя галочка подтверждает подлинность аккаунта для всех в OKO' },
    pending:  { cls:'pending', ico:'clock',    t:'На рассмотрении',  s:'Модерация проверяет аккаунт и активность — обычно до 24 часов' },
    approved: { cls:'ok',      ico:'verified', t:'Верифицирован',    s:'Аккаунт подтверждён — галочка видна в профиле, ленте и чатах' },
  }[st];
  const conds = `
    <div class="vs-cond">${I('crown')}<div>Тариф PRO или BUSINESS<small>Активная подписка на момент подачи и проверки заявки</small></div></div>
    <div class="vs-cond">${I('bolt')}<div>Живой аккаунт<small>30+ дней в OKO, регулярные посты и реальная активность</small></div></div>
    <div class="vs-cond">${I('briefcase')}<div>Либо официальный бизнес<small>Подтверждение юрлица или ИП документами — без требования к тарифу</small></div></div>`;
  const action = st === 'none'
    ? `<button class="btn" style="width:100%;margin-top:14px" onclick="vsApply()"><svg class="i"><use href="#i-verified"/></svg> Подать заявку</button>`
    : st === 'pending'
    ? `<div class="vs-progress"><i></i></div><button class="btn ghost" style="width:100%;opacity:.65" disabled>Проверяем аккаунт…</button>`
    : `<button class="btn ghost" style="width:100%;margin-top:14px" onclick="closeSheet()">Отлично</button>`;
  v.innerHTML = `
    <div class="vs-vcard ${meta.cls}">
      <div class="vs-vic">${I(meta.ico)}</div>
      <div><b>${meta.t}${st==='approved' ? vsBadgeHtml() : ''}</b><small>${meta.s}</small></div>
    </div>
    <h2 class="section-h" style="margin:0 0 2px">Условия</h2>
    ${conds}
    ${action}`;
}

function vsApply(){
  if(VS_VERIFY.status !== 'none') return;
  VS_VERIFY.status = 'pending'; vsSave();
  vsUpdateProw(); vsRenderVerify();
  toast('Заявка отправлена на модерацию');
  setTimeout(()=>{
    if(VS_VERIFY.status !== 'pending') return;
    if(vsPremiumOk()){
      VS_VERIFY.status = 'approved'; VS_VERIFY.name = PROFILE.name; vsSave();
      if(typeof VERIFIED !== 'undefined') VERIFIED.add(PROFILE.name);
      if(typeof showPopup === 'function') showPopup({
        ico:'verified', title:'Аккаунт верифицирован',
        body:`Поздравляем, ${esc(PROFILE.name)}! Синяя галочка теперь рядом с твоим именем — в профиле, ленте и чатах.`,
        actions:[{label:'Красота'}]
      });
      if(typeof renderMyProfile === 'function') renderMyProfile();
      vsDecorateAll();
    } else {
      VS_VERIFY.status = 'none'; vsSave();
      if(typeof showPopup === 'function') showPopup({
        ico:'lock', title:'Заявка отклонена',
        body:'Для верификации нужен активный тариф PRO или BUSINESS либо подтверждённый официальный бизнес. Оформи PRO — и подай заявку снова.',
        actions:[{label:'Оформить PRO', onclick:()=>openPay('PRO')},{label:'Позже', ghost:true}]
      });
    }
    vsUpdateProw(); vsRenderVerify();
  }, 5000);
}

/* ---------- 2. ГАЛОЧКИ У ИМЁН (DOM-декораторы + chain-патчи) ---------- */
function vsDecorateProfile(){
  if(typeof VERIFIED === 'undefined') return;
  const el = document.getElementById('profName');
  if(el && VERIFIED.has(PROFILE.name) && !el.querySelector('.vs-badge'))
    el.insertAdjacentHTML('beforeend', vsBadgeHtml());
}
function vsDecorateFeed(){
  if(typeof VERIFIED === 'undefined') return;
  document.querySelectorAll('#feedList .post .head .name').forEach(el=>{
    if(el.querySelector('.vs-badge')) return;
    const tn = el.firstChild;
    if(!tn || tn.nodeType !== Node.TEXT_NODE) return;
    if(VERIFIED.has(tn.textContent.trim())){
      const sp = document.createElement('span');
      sp.className = 'vs-badge'; sp.title = 'Верифицированный аккаунт';
      sp.innerHTML = '<svg viewBox="0 0 100 100" aria-hidden="true"><use href="#i-verified"/></svg>';
      el.insertBefore(sp, tn.nextSibling); /* галочка сразу после имени, до чипов «Реклама/В тренде» */
    }
  });
}
function vsDecorateChats(){
  if(typeof VERIFIED === 'undefined') return;
  document.querySelectorAll('#chatList .chat-item .row1 .name').forEach(el=>{
    if(el.querySelector('.vs-badge')) return;
    const name = Array.from(el.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();
    if(VERIFIED.has(name)) el.insertAdjacentHTML('beforeend', vsBadgeHtml());
  });
}
function vsDecorateAll(){ vsDecorateProfile(); vsDecorateFeed(); vsDecorateChats(); }

const _prevRenderMyProfileVs = renderMyProfile;
renderMyProfile = function(){
  _prevRenderMyProfileVs();
  vsInsertProw(); vsUpdateProw(); vsDecorateProfile();
};
const _prevRenderFeedVs = renderFeed;
renderFeed = function(kind){
  _prevRenderFeedVs(kind);
  vsDecorateFeed();
};
const _prevRenderChatListVs = renderChatList;
renderChatList = function(filter){
  _prevRenderChatListVs(filter === undefined ? '' : filter);
  vsDecorateChats();
};

/* ---------- 3. ПРЕМИУМ-СТИКЕРЫ «TON CRYSTAL» ---------- */
const VS_TON_START = STICKERS.length;
STICKERS.push(
  { ic:'vs-gem',    label:'Кристалл',    hue:200, pack:'ton', premium:true },
  { ic:'vs-coin',   label:'Тонкоин',     hue:200, pack:'ton', premium:true },
  { ic:'vs-rocket', label:'Ту зе мун',   hue:200, pack:'ton', premium:true },
  { ic:'vs-eye',    label:'OKO Crystal', hue:200, pack:'ton', premium:true },
  { ic:'vs-bolt',   label:'Разряд',      hue:200, pack:'ton', premium:true },
);

/* дорогая SVG-графика TON: градиенты, блики, уникальные id на каждый рендер */
let vsUid = 0;
function vsTonSvg(key, size){
  const u = 'vsg' + (vsUid++);
  return `<span class="vs-tstk" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100" aria-hidden="true">${vsTonArt(key, u)}</svg></span>`;
}
function vsTonArt(k, u){
  const defs = `<defs>
    <linearGradient id="${u}a" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8fe3ff"/><stop offset=".5" stop-color="#22b1f2"/><stop offset="1" stop-color="#0069c2"/>
    </linearGradient>
    <linearGradient id="${u}b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d8f4ff"/><stop offset="1" stop-color="#0098EA"/>
    </linearGradient>
    <radialGradient id="${u}c" cx=".35" cy=".3" r=".95">
      <stop offset="0" stop-color="#bdefff"/><stop offset=".55" stop-color="#0098EA"/><stop offset="1" stop-color="#005a99"/>
    </radialGradient>
  </defs>`;
  if(k === 'vs-gem') return defs + `
    <path d="M50 10 L83 40 L50 90 L17 40 Z" fill="url(#${u}a)"/>
    <path d="M17 40 L83 40 L50 90 Z" fill="url(#${u}b)" opacity=".5"/>
    <path d="M50 10 L64 40 L50 90 L36 40 Z" fill="#ffffff" opacity=".22"/>
    <path d="M50 10 L83 40 M50 10 L17 40 M17 40 L83 40 M36 40 L50 90 M64 40 L50 90" stroke="#eafaff" stroke-width="1.6" opacity=".8" fill="none"/>
    <path d="M77 12 l2.6 6.4 6.4 2.6 -6.4 2.6 -2.6 6.4 -2.6 -6.4 -6.4 -2.6 6.4 -2.6 z" fill="#fff" opacity=".95"/>
    <circle cx="24" cy="20" r="2.2" fill="#fff" opacity=".8"/>`;
  if(k === 'vs-coin') return defs + `
    <circle cx="50" cy="50" r="43" fill="url(#${u}c)"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="url(#${u}b)" stroke-width="4"/>
    <circle cx="50" cy="50" r="34" fill="none" stroke="#eafaff" stroke-width="1.4" opacity=".5"/>
    <path d="M33 33 h34 c4.6 0 7.2 5 4.8 8.9 L54.7 71.4 c-2.1 3.5 -7.3 3.5 -9.4 0 L28.2 41.9 C25.8 38 28.4 33 33 33 Z" fill="#fff"/>
    <path d="M50 34 V59" stroke="url(#${u}a)" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M20 40 A34 34 0 0 1 38 15" stroke="#fff" stroke-width="3" opacity=".55" fill="none" stroke-linecap="round"/>`;
  if(k === 'vs-rocket') return defs + `
    <g transform="rotate(35 50 50)">
      <path d="M43 64 Q50 92 50 97 Q50 92 57 64 Z" fill="#9AFF00" opacity=".85"/>
      <path d="M46.5 64 Q50 84 50 88 Q50 84 53.5 64 Z" fill="#fff" opacity=".85"/>
      <path d="M37 52 L23 72 L37 66 Z" fill="url(#${u}b)"/>
      <path d="M63 52 L77 72 L63 66 Z" fill="url(#${u}b)"/>
      <path d="M50 6 C62 20 66 40 63 63 L37 63 C34 40 38 20 50 6 Z" fill="url(#${u}a)"/>
      <path d="M50 6 C56 20 58 40 56.5 63 L50 63 Z" fill="#fff" opacity=".14"/>
      <circle cx="50" cy="35" r="9.5" fill="#06101c" stroke="#eafaff" stroke-width="2.4"/>
      <path d="M50 29 l5 5 -5 8 -5 -8 z" fill="url(#${u}b)"/>
    </g>
    <path d="M15 22 l2.2 5.2 5.2 2.2 -5.2 2.2 -2.2 5.2 -2.2 -5.2 -5.2 -2.2 5.2 -2.2 z" fill="#fff" opacity=".9"/>
    <circle cx="85" cy="76" r="2.4" fill="#8fe3ff" opacity=".9"/>`;
  if(k === 'vs-eye') return defs + `
    <path d="M50 5 L88 29 L88 68 L50 95 L12 68 L12 29 Z" fill="url(#${u}a)" opacity=".26" stroke="url(#${u}b)" stroke-width="2.6"/>
    <path d="M18 50 Q50 24 82 50 Q50 76 18 50 Z" fill="#06101c" stroke="url(#${u}b)" stroke-width="3"/>
    <circle cx="50" cy="50" r="17" fill="none" stroke="#9AFF00" stroke-width="1.4" opacity=".55" stroke-dasharray="4 6"/>
    <circle cx="50" cy="50" r="13" fill="url(#${u}c)"/>
    <circle cx="50" cy="50" r="5.5" fill="#041018"/>
    <circle cx="45.5" cy="45" r="2.8" fill="#fff"/>
    <path d="M83 14 l2.4 5.6 5.6 2.4 -5.6 2.4 -2.4 5.6 -2.4 -5.6 -5.6 -2.4 5.6 -2.4 z" fill="#fff" opacity=".9"/>`;
  /* vs-bolt */
  return defs + `
    <path d="M57 5 L25 55 L45 55 L40 95 L76 41 L54 41 Z" fill="url(#${u}a)" stroke="#dff4ff" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M55 12 L33 50 L47 50 L44 80" stroke="#fff" stroke-width="2.2" opacity=".55" fill="none" stroke-linejoin="round"/>
    <path d="M57 5 L54 41 L76 41 Z" fill="#fff" opacity=".18"/>
    <path d="M18 18 l2.2 5.2 5.2 2.2 -5.2 2.2 -2.2 5.2 -2.2 -5.2 -5.2 -2.2 5.2 -2.2 z" fill="#fff" opacity=".9"/>
    <circle cx="82" cy="80" r="2.4" fill="#8fe3ff" opacity=".9"/>`;
}

/* stickerSvg: TON-стикеры рисуем своей графикой (и в гриде, и в сообщениях) */
const _prevStickerSvgVs = stickerSvg;
stickerSvg = function(s, size){
  if(s && s.pack === 'ton') return vsTonSvg(s.ic, size);
  return _prevStickerSvgVs(s, size);
};

/* грид стикеров: премиум-секция «TON Crystal · PRO» с гейтом */
const _prevOpenStickersVs = openStickers;
openStickers = function(){
  _prevOpenStickersVs();
  const grid = document.getElementById('stickersGrid'); if(!grid) return;
  /* убрать TON-кнопки, отрисованные ядром без гейта и без секции */
  grid.querySelectorAll('.stk-btn').forEach(b=>{
    const m = (b.getAttribute('onclick') || '').match(/sendSticker\((\d+)\)/);
    if(m && +m[1] >= VS_TON_START) b.remove();
  });
  const ok = vsPremiumOk();
  let html = `<div class="vs-stk-head">
    <svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 L86 42 L50 92 L14 42 Z" fill="#2fb3f2" stroke="#bfeaff" stroke-width="5"/><path d="M50 8 L64 42 L50 92 L36 42 Z" fill="#eafaff" opacity=".5"/></svg>
    TON CRYSTAL <span class="vs-pro">${ok ? 'ОТКРЫТО' : 'PRO'}</span></div>`;
  html += STICKERS.map((s, i)=>{
    if(s.pack !== 'ton') return '';
    return ok
      ? `<button class="stk-btn vs-stk" onclick="sendSticker(${i})">${vsTonSvg(s.ic, 58)}<small>${s.label}</small></button>`
      : `<button class="stk-btn vs-stk vs-locked" onclick="vsLockedTap()">${vsTonSvg(s.ic, 58)}<span class="vs-lock">${I('lock')}</span><small>${s.label}</small></button>`;
  }).join('');
  grid.insertAdjacentHTML('beforeend', html);
};

function vsLockedTap(){
  showPopup({
    ico:'lock', title:'Стикеры TON — в подписке PRO',
    body:'Премиум-пак «TON Crystal» с эффектом дождя кристаллов открывается на тарифах PRO и BUSINESS.',
    actions:[{label:'Оформить PRO', onclick:()=>openPay('PRO')},{label:'Позже', ghost:true}]
  });
}

/* отправка: гейт + дождь кристаллов поверх ленты сообщений */
const _prevSendStickerVs = sendSticker;
sendSticker = function(i){
  const s = STICKERS[i];
  if(s && s.pack === 'ton' && !vsPremiumOk()){ closeSheet(); vsLockedTap(); return; }
  _prevSendStickerVs(i);
  if(s && s.pack === 'ton') vsCrystalRain();
};

function vsCrystalRain(){
  const host = document.getElementById('msgs'); if(!host) return;
  const r = host.getBoundingClientRect();
  if(r.width < 10 || r.height < 10) return;
  const box = document.createElement('div');
  box.className = 'vs-rain';
  box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--fy:${Math.round(r.height + 60)}px`;
  const n = 10 + Math.floor(Math.random() * 6); /* 10–15 кристаллов */
  let h = '';
  for(let k = 0; k < n; k++){
    const sz = Math.round(10 + Math.random() * 12);
    const x = (Math.random() * 94).toFixed(1);
    const dur = (1.05 + Math.random() * 0.45).toFixed(2);
    const dl = (Math.random() * 0.35).toFixed(2);
    h += `<i style="left:${x}%;width:${sz}px;height:${sz}px;animation-duration:${dur}s;animation-delay:${dl}s">
      <svg viewBox="0 0 100 100"><path d="M50 8 L86 42 L50 92 L14 42 Z" fill="#2fb3f2" stroke="#bfeaff" stroke-width="5"/><path d="M50 8 L64 42 L50 92 L36 42 Z" fill="#eafaff" opacity=".55"/></svg></i>`;
  }
  box.innerHTML = h;
  document.body.appendChild(box);
  setTimeout(()=>box.remove(), 2100);
}

/* ---------- 4. СТИКЕР К НОВОМУ ПОСТУ (sheet-npost) ---------- */
let vsNpPick = null;
function vsInitNpost(){
  const sheet = document.getElementById('sheet-npost');
  if(!sheet || document.getElementById('vsNpRow')) return;
  const btn = sheet.querySelector('button.btn'); if(!btn) return;
  const w = document.createElement('div'); w.id = 'vsNpRow';
  w.innerHTML = `<div class="vs-np-label">${I('sticker')} Стикер к посту <span class="vs-np-hint">необязательно</span></div><div class="vs-np-strip" id="vsNpStrip"></div>`;
  sheet.insertBefore(w, btn);
  vsRenderNpStrip();
}
function vsRenderNpStrip(){
  const el = document.getElementById('vsNpStrip'); if(!el) return;
  const ok = vsPremiumOk();
  el.innerHTML = STICKERS.map((s, i)=>{
    const locked = s.pack === 'ton' && !ok;
    return `<button class="${vsNpPick === i ? 'on' : ''}${locked ? ' vs-locked' : ''}" title="${s.label}" onclick="${locked ? 'vsLockedTap()' : `vsPickNp(${i})`}">${stickerSvg(s, 34)}</button>`;
  }).join('');
}
function vsPickNp(i){ vsNpPick = (vsNpPick === i ? null : i); vsRenderNpStrip(); }

const _prevCreatePostVs = createPost;
createPost = function(){
  const hadText = !!document.getElementById('npBody').value.trim();
  const pick = vsNpPick;
  _prevCreatePostVs();
  if(!hadText) return; /* ядро не создало пост */
  if(pick != null){
    const p = POSTS.sub[0];
    const s = STICKERS[pick];
    if(p && s && p.name === PROFILE.name){
      p.body += `<br><span class="vs-post-stk">${stickerSvg(s, 22)}<b>${esc(s.label)}</b></span>`;
      renderFeed(typeof curFeedKind !== 'undefined' && curFeedKind ? curFeedKind : 'sub');
    }
    vsNpPick = null; vsRenderNpStrip();
  }
};

/* ---------- САМОИНИЦИАЛИЗАЦИЯ ---------- */
(function vsInit(){
  /* демо: официальный канал OKO в ленте тоже с галочкой */
  try{ if(typeof VERIFIED !== 'undefined') VERIFIED.add('OKO · Официальный'); }catch(e){}
  vsInsertProw();
  vsInitNpost();
  /* первые рендеры ядра прошли до патчей — дорисовать бейджи в текущем DOM */
  vsDecorateAll();
})();
