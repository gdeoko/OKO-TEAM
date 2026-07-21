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
  return `<span class="vs-stk-art vs-ton" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100" aria-hidden="true">${vsTonArt(key, u)}</svg></span>`;
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

/* ---------- ПРЕМИУМ-АРТ БАЗОВЫХ СТИКЕРОВ (замена плоских кружков-иконок) ---------- */
/* Каждый стикер — самодостаточная многоцветная SVG-иллюстрация уровня emoji-пака:
   градиенты, блики, глубина; плавает прозрачно (в сообщении) и на тайле (в гриде). */
const VS_BASE_ICS = new Set(['logo','fire','heart','thumb','laugh','wow','star','crown','rocket','bolt','sad','check']);
function vsBaseSvg(ic, size){
  const u = 'vsb' + (vsUid++);
  return `<span class="vs-stk-art" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100" aria-hidden="true">${vsBaseArt(ic, u)}</svg></span>`;
}
function vsBaseArt(ic, u){
  switch(ic){
  case 'logo': return `<defs>
    <linearGradient id="${u}l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e7ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient>
    <radialGradient id="${u}d" cx=".5" cy=".5" r=".62"><stop offset="0" stop-color="#16240a"/><stop offset="1" stop-color="#05080a"/></radialGradient></defs>
    <path d="M50 20 C76 20 94 50 94 50 C94 50 76 80 50 80 C24 80 6 50 6 50 C6 50 24 20 50 20 Z" fill="url(#${u}d)" stroke="url(#${u}l)" stroke-width="6" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="18" fill="url(#${u}l)"/>
    <circle cx="50" cy="50" r="8.5" fill="#05080a"/>
    <circle cx="44" cy="44" r="3.4" fill="#f4ffd6"/>
    <path d="M78 24 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4 z" fill="#eaffb0"/>`;
  case 'fire': return `<defs>
    <linearGradient id="${u}o" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3d00"/><stop offset=".5" stop-color="#ff8a00"/><stop offset="1" stop-color="#ffd21e"/></linearGradient>
    <linearGradient id="${u}c" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffe985"/><stop offset="1" stop-color="#fff6cf"/></linearGradient></defs>
    <path d="M52 5 C61 26 84 34 79 61 C75 85 61 96 50 96 C37 96 21 87 21 63 C21 49 31 45 33 34 C43 43 45 31 40 22 C51 27 54 16 52 5 Z" fill="url(#${u}o)"/>
    <path d="M51 46 C58 56 62 62 58 74 C55 86 47 88 43 82 C38 74 43 67 45 61 C47 56 51 54 51 46 Z" fill="url(#${u}c)"/>`;
  case 'heart': return `<defs>
    <linearGradient id="${u}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7d97"/><stop offset=".5" stop-color="#ff2d55"/><stop offset="1" stop-color="#c00f38"/></linearGradient></defs>
    <path d="M50 88 C16 63 6 45 6 29 C6 15 18 7 31 7 C41 7 47 13 50 20 C53 13 59 7 69 7 C82 7 94 15 94 29 C94 45 84 63 50 88 Z" fill="url(#${u}r)"/>
    <path d="M27 19 C21 22 16 28 16 36" stroke="#ffd3dc" stroke-width="6" fill="none" stroke-linecap="round" opacity=".85"/>`;
  case 'thumb': return `<defs>
    <linearGradient id="${u}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6ff70"/><stop offset=".55" stop-color="#9AFF00"/><stop offset="1" stop-color="#5fa800"/></linearGradient></defs>
    <rect x="20" y="46" width="16" height="40" rx="4.5" fill="#6cba12"/>
    <rect x="23" y="49" width="5" height="34" rx="2.5" fill="#b6ff5e" opacity=".65"/>
    <path d="M40 46 C40 46 46 44 49 38 C52 32 51 24 54 18 C56 14 63 14 64 21 C65 28 61 38 61 42 H80 C86 42 88 48 85 53 C88 56 87 62 83 64 C86 68 83 74 79 75 C81 80 77 86 71 86 H50 C44 86 40 82 40 76 Z" fill="url(#${u}t)"/>
    <path d="M46 50 C48 47 51 43 53 38" stroke="#eaffc0" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>`;
  case 'laugh': return `<defs>
    <radialGradient id="${u}f" cx=".4" cy=".33" r=".78"><stop offset="0" stop-color="#fff3ab"/><stop offset=".55" stop-color="#ffcf3a"/><stop offset="1" stop-color="#e79600"/></radialGradient></defs>
    <circle cx="50" cy="50" r="43" fill="url(#${u}f)"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="1.6" opacity=".3"/>
    <path d="M22 43 Q31 31 41 43" stroke="#7a4a00" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M59 43 Q69 31 78 43" stroke="#7a4a00" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M25 57 Q50 90 75 57 Z" fill="#7a2600"/>
    <path d="M27 57 Q50 66 73 57 Z" fill="#fff"/>
    <ellipse cx="50" cy="79" rx="10.5" ry="6.5" fill="#ff5a6a"/>
    <path d="M15 50 q-6 9 0 15 q6 -6 0 -15 z" fill="#7ad0ff"/>
    <path d="M85 50 q6 9 0 15 q-6 -6 0 -15 z" fill="#7ad0ff"/>`;
  case 'wow': return `<defs>
    <radialGradient id="${u}w" cx=".4" cy=".33" r=".8"><stop offset="0" stop-color="#e9fbff"/><stop offset=".55" stop-color="#5ecdf0"/><stop offset="1" stop-color="#1f8fbf"/></radialGradient></defs>
    <circle cx="50" cy="50" r="43" fill="url(#${u}w)"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="1.6" opacity=".35"/>
    <path d="M24 34 Q33 28 42 33" stroke="#0d5a78" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M58 33 Q67 28 76 34" stroke="#0d5a78" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="34" cy="47" rx="7" ry="9" fill="#0a2a38"/>
    <ellipse cx="66" cy="47" rx="7" ry="9" fill="#0a2a38"/>
    <circle cx="31.5" cy="44" r="2.4" fill="#fff"/><circle cx="63.5" cy="44" r="2.4" fill="#fff"/>
    <ellipse cx="50" cy="72" rx="9.5" ry="12.5" fill="#0a2a38"/>`;
  case 'star': return `<defs>
    <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a6"/><stop offset=".5" stop-color="#ffcb2e"/><stop offset="1" stop-color="#e08c00"/></linearGradient></defs>
    <path d="M50 5 L62 37 L96 38 L69 59 L79 92 L50 72 L21 92 L31 59 L4 38 L38 37 Z" fill="url(#${u}s)" stroke="#fff3c0" stroke-width="2" stroke-linejoin="round"/>
    <path d="M50 16 L58 39 L46 39 Z" fill="#fff" opacity=".4"/>
    <path d="M81 20 l1.9 4.8 4.8 1.9 -4.8 1.9 -1.9 4.8 -1.9 -4.8 -4.8 -1.9 4.8 -1.9 z" fill="#fff" opacity=".9"/>`;
  case 'crown': return `<defs>
    <linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe97a"/><stop offset=".5" stop-color="#ffc21e"/><stop offset="1" stop-color="#d98800"/></linearGradient></defs>
    <path d="M13 76 L18 32 L37 55 L50 24 L63 55 L82 32 L87 76 Z" fill="url(#${u}k)" stroke="#fff2b8" stroke-width="2" stroke-linejoin="round"/>
    <rect x="15" y="76" width="70" height="14" rx="4" fill="#e0920a"/>
    <rect x="15" y="76" width="70" height="5" rx="2.5" fill="#fff" opacity=".25"/>
    <circle cx="18" cy="30" r="5" fill="#ff5a6a"/><circle cx="82" cy="30" r="5" fill="#ff5a6a"/><circle cx="50" cy="22" r="5.5" fill="#5ad0ff"/>
    <circle cx="30" cy="83" r="4" fill="#ff3b5c"/><circle cx="50" cy="83" r="4.5" fill="#4fd0ff"/><circle cx="70" cy="83" r="4" fill="#9AFF00"/>`;
  case 'rocket': return `<defs>
    <linearGradient id="${u}q" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9a6ff"/><stop offset=".5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#5b21b6"/></linearGradient>
    <linearGradient id="${u}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd21e"/><stop offset="1" stop-color="#ff5a00"/></linearGradient></defs>
    <path d="M40 66 L28 84 L40 78 Z" fill="#7c3aed"/>
    <path d="M60 66 L72 84 L60 78 Z" fill="#7c3aed"/>
    <path d="M44 72 Q50 96 50 96 Q50 96 56 72 Z" fill="url(#${u}m)"/>
    <path d="M50 6 C64 22 68 44 64 70 L36 70 C32 44 36 22 50 6 Z" fill="url(#${u}q)"/>
    <path d="M50 6 C57 22 59 44 57 70 L50 70 Z" fill="#fff" opacity=".16"/>
    <circle cx="50" cy="38" r="10" fill="#0a0a1e" stroke="#e9d8ff" stroke-width="2.6"/>
    <circle cx="50" cy="38" r="5" fill="#5ad0ff"/>
    <path d="M39 22 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8 z" fill="#fff" opacity=".85"/>`;
  case 'bolt': return `<defs>
    <linearGradient id="${u}z" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient></defs>
    <path d="M58 4 L24 55 L45 55 L40 96 L78 41 L54 41 Z" fill="url(#${u}z)" stroke="#efffcf" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M55 14 L34 50 L48 50 L44 78" stroke="#fff" stroke-width="2.4" opacity=".55" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  case 'sad': return `<defs>
    <radialGradient id="${u}j" cx=".4" cy=".33" r=".8"><stop offset="0" stop-color="#dcecff"/><stop offset=".55" stop-color="#7fb0f5"/><stop offset="1" stop-color="#3f6fd0"/></radialGradient></defs>
    <circle cx="50" cy="50" r="43" fill="url(#${u}j)"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="1.6" opacity=".3"/>
    <path d="M24 40 Q33 46 41 41" stroke="#274a86" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M59 41 Q67 46 76 40" stroke="#274a86" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <circle cx="35" cy="52" r="4.5" fill="#12345f"/><circle cx="65" cy="52" r="4.5" fill="#12345f"/>
    <path d="M34 76 Q50 64 66 76" stroke="#12345f" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M34 58 q-5 8 0 13 q5 -5 0 -13 z" fill="#4fd0ff"/>`;
  case 'check': return `<defs>
    <radialGradient id="${u}v" cx=".4" cy=".33" r=".82"><stop offset="0" stop-color="#c7f7a0"/><stop offset=".55" stop-color="#35c759"/><stop offset="1" stop-color="#178a3c"/></radialGradient></defs>
    <circle cx="50" cy="50" r="43" fill="url(#${u}v)"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="1.6" opacity=".3"/>
    <path d="M28 52 L44 68 L74 34" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  default: return '';
  }
}

/* stickerSvg: рисуем СВОЮ премиум-графику (базовые + TON) — и в гриде, и в сообщениях */
const _prevStickerSvgVs = stickerSvg;
stickerSvg = function(s, size){
  if(!s) return _prevStickerSvgVs(s, size);
  if(s.pack === 'ton') return vsTonSvg(s.ic, size);
  if(VS_BASE_ICS.has(s.ic)) return vsBaseSvg(s.ic, size);
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

/* ============================================================
   5. TON ПОДАРКИ — крипта в стиле Telegram (честная заглушка):
      кошелёк-прототип (адрес+баланс), эмодзи-подарки/кристаллы,
      покупка за TON (пополнение за рубли), владение (коллекция),
      отправка подарка другу в чат, премиум-гейт коллекционных.
   ============================================================ */
const VS_TON_RATE = 320;            /* ₽ за 1 TON — курс прототипа */
let   VS_TON_TAB  = 'shop';         /* shop | mine */
let   VS_TON_TOPUP = 5;             /* выбранное пополнение, TON */
let   vsGiftDetailId = null, vsSendGiftId = null;

let VS_TON = { addr:null, balance:0, connected:false, owned:{}, tx:[] };
function vsTonSave(){ try{ localStorage.setItem('oko-ton', JSON.stringify(VS_TON)); }catch(e){} }
(function vsTonRestore(){
  try{ const d = JSON.parse(localStorage.getItem('oko-ton') || 'null');
    if(d && typeof d === 'object') VS_TON = Object.assign(VS_TON, d);
  }catch(e){}
  if(!VS_TON.owned || typeof VS_TON.owned !== 'object') VS_TON.owned = {};
  if(!Array.isArray(VS_TON.tx)) VS_TON.tx = [];
  if(typeof VS_TON.balance !== 'number' || isNaN(VS_TON.balance)) VS_TON.balance = 0;
  if(!VS_TON.addr){
    const al = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let s = 'UQ'; for(let i=0;i<44;i++) s += al[Math.floor(Math.random()*al.length)];
    VS_TON.addr = s;
    /* честный приветственный баланс прототипа, чтобы механика покупки работала */
    if(VS_TON.balance === 0 && (!VS_TON.tx || !VS_TON.tx.length)){
      VS_TON.balance = 3.5;
      VS_TON.tx = [{ t:'+', ton:3.5, why:'Приветственный TON прототипа', at:Date.now() }];
    }
  }
  vsTonSave();
})();

/* --- каталог подарков (эмодзи-подарки/кристаллы, часть — коллекционные PRO) --- */
const VS_GIFTS = [
  { id:'crystal', name:'Кристалл OKO',   art:'crystal', price:1.2, supply:15000, sold:8420 },
  { id:'star',    name:'Звезда',         art:'star',    price:1.8, supply:20000, sold:14210 },
  { id:'heart',   name:'Сердце-алмаз',   art:'heart',   price:2.4, supply:12000, sold:9310 },
  { id:'potion',  name:'Эликсир',        art:'potion',  price:2.9, supply:9000,  sold:4700 },
  { id:'ring',    name:'Кольцо',         art:'ring',    price:3.5, supply:8000,  sold:5210 },
  { id:'rocket',  name:'Ракета',         art:'rocket',  price:4.2, supply:6000,  sold:3100 },
  { id:'trophy',  name:'Кубок',          art:'trophy',  price:5,   supply:5000,  sold:2980 },
  { id:'medal',   name:'Медальон OKO',   art:'medal',   price:8,   supply:2000,  sold:640,  premium:true },
  { id:'crown',   name:'Корона',         art:'crown',   price:12,  supply:1000,  sold:210,  premium:true },
];
function vsGiftById(id){ for(let i=0;i<VS_GIFTS.length;i++) if(VS_GIFTS[i].id===id) return VS_GIFTS[i]; return null; }
function vsOwnedTotal(){ let n=0; for(const k in VS_TON.owned) n += VS_TON.owned[k]||0; return n; }

/* --- художественный SVG подарка (переиспользуем премиум-арт + свои) --- */
function vsGiftArt(a, u){
  if(a==='crystal') return vsTonArt('vs-gem', u);
  if(a==='heart')   return vsBaseArt('heart', u);
  if(a==='rocket')  return vsBaseArt('rocket', u);
  if(a==='star')    return vsBaseArt('star', u);
  if(a==='crown')   return vsBaseArt('crown', u);
  if(a==='ring') return `<defs>
    <linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe97a"/><stop offset=".5" stop-color="#ffc21e"/><stop offset="1" stop-color="#d98800"/></linearGradient>
    <linearGradient id="${u}d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8f6ff"/><stop offset=".5" stop-color="#7fd8ff"/><stop offset="1" stop-color="#2b9fe0"/></linearGradient></defs>
    <ellipse cx="50" cy="66" rx="26" ry="27" fill="none" stroke="url(#${u}g)" stroke-width="10"/>
    <ellipse cx="50" cy="66" rx="26" ry="27" fill="none" stroke="#fff6d0" stroke-width="2" opacity=".5"/>
    <path d="M34 30 L50 8 L66 30 L50 44 Z" fill="url(#${u}d)" stroke="#eafaff" stroke-width="2" stroke-linejoin="round"/>
    <path d="M34 30 H66 M50 8 L42 30 M50 8 L58 30 M42 30 L50 44 M58 30 L50 44" stroke="#eafaff" stroke-width="1.4" opacity=".8" fill="none"/>
    <path d="M40 32 l1.8 4.4 4.4 1.8 -4.4 1.8 -1.8 4.4 -1.8 -4.4 -4.4 -1.8 4.4 -1.8 z" fill="#fff" opacity=".9"/>`;
  if(a==='trophy') return `<defs>
    <linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe97a"/><stop offset=".5" stop-color="#ffc21e"/><stop offset="1" stop-color="#cf8400"/></linearGradient></defs>
    <rect x="38" y="72" width="24" height="10" rx="3" fill="#b8790a"/>
    <rect x="30" y="82" width="40" height="10" rx="4" fill="#e0920a"/>
    <rect x="30" y="82" width="40" height="4" rx="2" fill="#fff" opacity=".25"/>
    <path d="M28 16 H72 V38 C72 55 62 66 50 66 C38 66 28 55 28 38 Z" fill="url(#${u}g)" stroke="#fff2b8" stroke-width="2"/>
    <path d="M28 22 H16 V30 C16 40 22 46 30 46" fill="none" stroke="url(#${u}g)" stroke-width="6"/>
    <path d="M72 22 H84 V30 C84 40 78 46 70 46" fill="none" stroke="url(#${u}g)" stroke-width="6"/>
    <path d="M50 26 L55 37 L67 38 L58 46 L61 58 L50 51 L39 58 L42 46 L33 38 L45 37 Z" fill="#fff" opacity=".85"/>`;
  if(a==='medal') return `<defs>
    <linearGradient id="${u}r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c6ff70"/><stop offset="1" stop-color="#6cba12"/></linearGradient>
    <radialGradient id="${u}m" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#eaffb8"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></radialGradient></defs>
    <path d="M36 8 L30 44 L50 34 Z" fill="url(#${u}r)"/>
    <path d="M64 8 L70 44 L50 34 Z" fill="#7ec81a"/>
    <circle cx="50" cy="64" r="27" fill="url(#${u}m)" stroke="#eaffb8" stroke-width="3"/>
    <circle cx="50" cy="64" r="20" fill="#0a1403"/>
    <path d="M32 64 Q50 50 68 64 Q50 78 32 64 Z" fill="none" stroke="#c6ff70" stroke-width="3"/>
    <circle cx="50" cy="64" r="7" fill="#9AFF00"/><circle cx="47" cy="61" r="2.4" fill="#0a1403"/>`;
  /* potion */
  return `<defs>
    <linearGradient id="${u}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9a6ff"/><stop offset=".5" stop-color="#8b5cf6"/><stop offset="1" stop-color="#5b21b6"/></linearGradient></defs>
    <path d="M42 12 H58 V40 L74 78 C77 86 71 92 63 92 H37 C29 92 23 86 26 78 L42 40 Z" fill="rgba(180,150,235,.16)" stroke="#e9d8ff" stroke-width="3" stroke-linejoin="round"/>
    <path d="M35 56 L65 56 L73 76 C76 84 70 88 63 88 H37 C30 88 24 84 27 76 Z" fill="url(#${u}p)"/>
    <ellipse cx="50" cy="57" rx="15" ry="4" fill="#c9a6ff" opacity=".7"/>
    <circle cx="44" cy="72" r="4" fill="#fff" opacity=".55"/><circle cx="57" cy="78" r="3" fill="#fff" opacity=".45"/><circle cx="50" cy="68" r="2.4" fill="#fff" opacity=".6"/>
    <rect x="40" y="6" width="20" height="9" rx="3" fill="#b59adf"/>
    <path d="M70 20 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8 z" fill="#fff" opacity=".85"/>`;
}
function vsGiftSvg(art, size){
  const u = 'vsgf' + (vsUid++);
  return `<span class="vs-stk-art" style="width:${size}px;height:${size}px"><svg viewBox="0 0 100 100" aria-hidden="true">${vsGiftArt(art, u)}</svg></span>`;
}
/* маленький значок TON-кристалла (для цен и баланса) */
function vsGemMark(size){
  const s = size || 14;
  return `<span class="vs-gem-mk" style="width:${s}px;height:${s}px"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 L86 42 L50 92 L14 42 Z" fill="#2fb3f2" stroke="#bfeaff" stroke-width="5"/><path d="M50 8 L64 42 L50 92 L36 42 Z" fill="#eafaff" opacity=".5"/></svg></span>`;
}
function vsTonFmt(n){ n = Math.round((+n||0)*100)/100; return n.toLocaleString('ru-RU', {maximumFractionDigits:2}); }
function vsTonAddrShort(){ const a = VS_TON.addr||''; return a.length>12 ? a.slice(0,6)+'…'+a.slice(-4) : a; }
function vsWhen(ts){ try{ const d = new Date(ts); return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }catch(e){ return ''; } }

/* --- символ иконки для тайла хаба (диаманд в бренд-штрихе) --- */
function vsInjectTonSymbol(){
  try{
    if(document.getElementById('i-vs-gem')) return;
    const defs = document.querySelector('svg defs'); if(!defs) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id','i-vs-gem'); s.setAttribute('viewBox','0 0 100 100');
    s.innerHTML = '<path d="M50 12 L82 40 L50 90 L18 40 Z M18 40 H82 M38 40 L50 90 M62 40 L50 90 M50 12 L38 40 M50 12 L62 40" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>';
    defs.appendChild(s);
    /* стрелка «получить» (вниз в лоток) — единый бренд-штрих stroke 7, round */
    if(!document.getElementById('i-vs-recv')){
      const r = document.createElementNS('http://www.w3.org/2000/svg','symbol');
      r.setAttribute('id','i-vs-recv'); r.setAttribute('viewBox','0 0 100 100');
      r.innerHTML = '<path d="M50 14 V64 M30 44 L50 66 L70 44 M20 78 H80" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>';
      defs.appendChild(r);
    }
  }catch(e){}
}

/* ---------- ОТПРАВКА / ПРИЁМ TON (адрес↔адрес) ---------- */
let VS_SEND_AMT = 1;
function vsAddrValid(a){
  a = String(a||'').trim();
  /* user-friendly (UQ/EQ/kQ/0Q + base64url, 48) или raw 0:hex64 */
  if(/^[UEk0]Q[A-Za-z0-9_-]{46}$/.test(a)) return true;
  if(/^-?[0-9]:[0-9a-fA-F]{64}$/.test(a)) return true;
  return false;
}
function vsOpenSendTon(){ if(!(VS_SEND_AMT>0)) VS_SEND_AMT = 1; vsRenderSendTon(); openSheet('vs-ton-sendton'); }
function vsRenderSendTon(){
  const v = document.getElementById('vsSendTonView'); if(!v) return;
  const bal = vsTonFmt(VS_TON.balance);
  const amt = VS_SEND_AMT;
  const rub = Math.round(amt*VS_TON_RATE);
  const rubStr = (typeof fmtMoney==='function') ? fmtMoney(rub) : rub+' ₽';
  const chips = [0.5,1,5, VS_TON.balance>0?Math.round(VS_TON.balance*100)/100:10];
  const seen = {};
  const chipsH = chips.filter(a=>a>0 && !seen[a] && (seen[a]=1)).map((a,idx)=>
    `<button class="${amt===a?'on':''}" onclick="vsSetSendAmt(${a})">${idx===chips.length-1&&a===Math.round(VS_TON.balance*100)/100?'МАКС':vsTonFmt(a)+' TON'}</button>`).join('');
  v.innerHTML = `
    <div class="vs-sendton-bal">${vsGemMark(16)} Баланс <b>${bal} TON</b></div>
    <label class="vs-field-lbl" for="vsSendAddr">Адрес получателя</label>
    <div class="vs-addr-input">
      <input id="vsSendAddr" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder="UQ… адрес TON-кошелька" oninput="vsSendValidate()">
      <button type="button" class="vs-addr-paste" onclick="vsPasteAddr()" title="Вставить">${I('copy')}</button>
    </div>
    <div class="vs-addr-err" id="vsSendErr"></div>
    <div class="vs-topup-big" style="margin-top:6px">${vsGemMark(28)}<b>${vsTonFmt(amt)}</b> TON</div>
    <div class="vs-topup-rub">≈ ${rubStr}</div>
    <div class="vs-topup-chips">${chipsH}</div>
    <div class="vs-buy-note"><svg class="i"><use href="#i-lock"/></svg> Прототип: перевод списывает TON с локального кошелька и попадает в историю. Реальные переводы в сети TON подключатся в релизе через TON Connect.</div>
    <button class="btn" id="vsSendBtn" style="width:100%;margin-top:6px" onclick="vsDoSendTon()"><svg class="i"><use href="#i-send"/></svg> Отправить ${vsTonFmt(amt)} TON</button>`;
  vsSendValidate();
}
function vsSetSendAmt(a){ VS_SEND_AMT = Math.round((+a||0)*100)/100; vsRenderSendTon(); }
function vsPasteAddr(){
  try{
    if(navigator.clipboard && navigator.clipboard.readText){
      navigator.clipboard.readText().then(txt=>{
        const inp = document.getElementById('vsSendAddr');
        if(inp && txt){ inp.value = String(txt).trim(); vsSendValidate(); }
      }).catch(()=>toast('Разреши доступ к буферу обмена'));
    } else toast('Вставь адрес вручную');
  }catch(e){ toast('Вставь адрес вручную'); }
}
function vsSendValidate(){
  const inp = document.getElementById('vsSendAddr');
  const err = document.getElementById('vsSendErr');
  const btn = document.getElementById('vsSendBtn');
  if(!inp || !btn) return true;
  const a = inp.value.trim();
  let msg = '';
  if(a && !vsAddrValid(a)) msg = 'Похоже, адрес неполный — формат TON: UQ… (48 символов)';
  else if(a && a === VS_TON.addr) msg = 'Это адрес твоего же кошелька';
  else if(VS_SEND_AMT > VS_TON.balance) msg = 'Недостаточно TON — пополни кошелёк';
  else if(!(VS_SEND_AMT > 0)) msg = 'Укажи сумму больше нуля';
  if(err){ err.textContent = msg; err.style.display = msg ? 'block' : 'none'; }
  const ok = !!a && vsAddrValid(a) && a !== VS_TON.addr && VS_SEND_AMT > 0 && VS_SEND_AMT <= VS_TON.balance;
  btn.disabled = !ok; btn.classList.toggle('vs-btn-off', !ok);
  return ok;
}
function vsDoSendTon(){
  if(!vsSendValidate()){
    const a = (document.getElementById('vsSendAddr')||{}).value || '';
    if(!a.trim()){ toast('Введи адрес получателя'); }
    return;
  }
  const inp = document.getElementById('vsSendAddr');
  const addr = inp.value.trim();
  const amt = VS_SEND_AMT;
  VS_TON.balance = Math.round((VS_TON.balance - amt)*100)/100;
  VS_TON.tx.unshift({ t:'-', ton:amt, why:'Перевод на '+addr.slice(0,6)+'…'+addr.slice(-4), at:Date.now() });
  if(VS_TON.tx.length > 200) VS_TON.tx.length = 200;
  vsTonSave();
  closeSheet();
  toast('Отправлено · '+vsTonFmt(amt)+' TON');
  VS_SEND_AMT = 1;
  vsTonBurst();
  vsRenderTon();
}

/* --- приём: адрес + декоративный бренд-код --- */
function vsOpenRecv(){ vsRenderRecv(); openSheet('vs-ton-recv'); }
function vsAddrCode(addr, cells){
  /* детерминированная бренд-матрица из адреса (декоративная, не сканируемый QR) */
  const n = cells || 15;
  let seed = 0; for(let i=0;i<addr.length;i++){ seed = (seed*31 + addr.charCodeAt(i)) >>> 0; }
  const rnd = ()=>{ seed = (seed*1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const cx = (n-1)/2, gem = 3; /* центральный вырез под знак */
  let rects = '';
  for(let y=0;y<n;y++) for(let x=0; x<=Math.floor(n/2); x++){
    if(Math.abs(x-cx)<=gem && Math.abs(y-cx)<=gem) continue; /* центр под лого */
    if(rnd() > .52){
      const px = 4 + x*6.2, py = 4 + y*6.2, mx = 4 + (n-1-x)*6.2;
      rects += `<rect x="${px.toFixed(1)}" y="${py.toFixed(1)}" width="4.6" height="4.6" rx="1.4"/>`;
      if(x !== n-1-x) rects += `<rect x="${mx.toFixed(1)}" y="${py.toFixed(1)}" width="4.6" height="4.6" rx="1.4"/>`;
    }
  }
  const corner = (x,y)=>`<rect x="${x}" y="${y}" width="17" height="17" rx="5" fill="none" stroke="currentColor" stroke-width="3.4"/><rect x="${x+5}" y="${y+5}" width="7" height="7" rx="2" fill="currentColor"/>`;
  return `<svg viewBox="0 0 100 100" class="vs-qr-svg" aria-hidden="true">
    <g fill="currentColor">${rects}</g>
    ${corner(4,4)}${corner(79,4)}${corner(4,79)}
  </svg>`;
}
function vsRenderRecv(){
  const v = document.getElementById('vsRecvView'); if(!v) return;
  const a = VS_TON.addr || '';
  v.innerHTML = `
    <div class="vs-qr-wrap">
      <div class="vs-qr">
        <div class="vs-qr-code">${vsAddrCode(a)}</div>
        <div class="vs-qr-gem">${vsGiftSvg('crystal',44)}</div>
      </div>
    </div>
    <div class="vs-recv-title">Твой TON-адрес</div>
    <div class="vs-recv-addr" id="vsRecvAddr">${esc(a)}</div>
    <div class="vs-recv-acts">
      <button class="btn" style="flex:1" onclick="vsCopyAddr()"><svg class="i"><use href="#i-copy"/></svg> Копировать</button>
      <button class="btn ghost" style="flex:1" onclick="vsShareAddr()"><svg class="i"><use href="#i-share"/></svg> Поделиться</button>
    </div>
    <div class="vs-buy-note" style="margin-top:12px"><svg class="i"><use href="#i-lock"/></svg> Отправь этот адрес отправителю, чтобы принять TON. В прототипе входящие переводы приходят через «Пополнить». Реальный приём в сети TON — в релизе.</div>`;
}
function vsShareAddr(){
  const a = VS_TON.addr || '';
  try{
    if(navigator.share){ navigator.share({ title:'Мой TON-адрес OKO', text:a }).catch(()=>{}); return; }
  }catch(e){}
  try{ navigator.clipboard && navigator.clipboard.writeText(a); }catch(e){}
  toast('Адрес скопирован — можно отправить другу');
}

/* ---------- ЭКРАН TON ПОДАРКИ ---------- */
function vsRenderTon(){
  const root = document.getElementById('vsTonRoot'); if(!root) return;
  const bal = vsTonFmt(VS_TON.balance);
  const rub = (typeof fmtMoney==='function') ? fmtMoney(Math.round(VS_TON.balance*VS_TON_RATE)) : Math.round(VS_TON.balance*VS_TON_RATE)+' ₽';
  const owned = Object.keys(VS_TON.owned).filter(k=>VS_TON.owned[k]>0);
  const totalOwned = vsOwnedTotal();
  let body;
  if(VS_TON_TAB === 'shop'){
    body = `<div class="vs-gshop">${VS_GIFTS.map(vsShopCard).join('')}</div>`;
  } else {
    body = owned.length
      ? `<div class="vs-gshop">${owned.map(k=>vsMineCard(k, VS_TON.owned[k])).join('')}</div>`
      : `<div class="vs-mine-empty">${vsGiftSvg('crystal',64)}<b>Коллекция пуста</b><span>Купи подарок в магазине — и подари другу прямо в чат</span><button class="btn" style="margin-top:12px" onclick="vsTonTab('shop')"><svg class="i"><use href="#i-plus"/></svg> В магазин</button></div>`;
  }
  root.innerHTML = `
    <div class="vs-ton-hero">
      <span class="vs-ton-hero-glow"></span>
      <div class="vs-ton-top">
        <span class="vs-ton-badge">${vsGemMark(14)} TON · прототип</span>
        <button class="vs-ton-conn" onclick="vsConnectWallet()"><svg class="i"><use href="#i-lock"/></svg> Кошелёк</button>
      </div>
      <div class="vs-ton-bal">${vsGemMark(28)}<span>${bal}</span></div>
      <div class="vs-ton-rub">≈ ${rub}</div>
      <button class="vs-ton-addr" onclick="vsCopyAddr()">${vsTonAddrShort()} <svg class="i"><use href="#i-copy"/></svg></button>
      <div class="vs-ton-acts">
        <button class="vs-ton-act" onclick="vsOpenSendTon()"><svg class="i"><use href="#i-send"/></svg><span>Отправить</span></button>
        <button class="vs-ton-act ghost" onclick="vsOpenRecv()"><svg class="i"><use href="#i-vs-recv"/></svg><span>Получить</span></button>
        <button class="vs-ton-act ghost" onclick="vsOpenTopup()"><svg class="i"><use href="#i-plus"/></svg><span>Пополнить</span></button>
        <button class="vs-ton-act ghost" onclick="vsOpenHistory()"><svg class="i"><use href="#i-clock"/></svg><span>История</span></button>
      </div>
    </div>
    <div class="vs-ton-tabs">
      <button class="${VS_TON_TAB==='shop'?'on':''}" onclick="vsTonTab('shop')">Магазин</button>
      <button class="${VS_TON_TAB==='mine'?'on':''}" onclick="vsTonTab('mine')">Мои подарки${totalOwned?` <i>${totalOwned}</i>`:''}</button>
    </div>
    ${body}
    <div class="vs-ton-foot"><svg class="i"><use href="#i-lock"/></svg> Честная заглушка: настоящие переводы TON и NFT-подарки подключатся в релизе через TON Connect. Баланс и коллекция хранятся локально на устройстве.</div>`;
}
function vsTonTab(t){ VS_TON_TAB = t; vsRenderTon(); }

function vsShopCard(g){
  const locked = g.premium && !vsPremiumOk();
  const own = VS_TON.owned[g.id] || 0;
  return `<button class="vs-gcard${locked?' vs-locked':''}${g.premium?' vs-nft':''}" onclick="vsOpenBuy('${g.id}')">
    <div class="vs-gcard-art">${vsGiftSvg(g.art,72)}${g.premium?`<span class="vs-nft-shine"></span>`:''}${g.premium?`<span class="vs-gcard-pro"><svg class="i"><use href="#i-crown"/></svg></span>`:''}${own?`<span class="vs-gcard-own">×${own}</span>`:''}${locked?`<span class="vs-gcard-lock"><svg class="i"><use href="#i-lock"/></svg></span>`:''}</div>
    <div class="vs-gcard-name">${esc(g.name)}</div>
    <div class="vs-gcard-price">${vsGemMark(12)} ${vsTonFmt(g.price)}</div>
  </button>`;
}
function vsMineCard(id, n){
  const g = vsGiftById(id); if(!g) return '';
  return `<button class="vs-gcard" onclick="vsOpenGift('${id}')">
    <div class="vs-gcard-art">${vsGiftSvg(g.art,72)}<span class="vs-gcard-own">×${n}</span></div>
    <div class="vs-gcard-name">${esc(g.name)}</div>
    <div class="vs-gcard-price vs-mine-send"><svg class="i"><use href="#i-send"/></svg> Отправить</div>
  </button>`;
}

/* --- покупка --- */
function vsOpenBuy(id){
  const g = vsGiftById(id); if(!g) return;
  const v = document.getElementById('vsBuyView'); if(!v) return;
  const locked = g.premium && !vsPremiumOk();
  const rub = (typeof fmtMoney==='function') ? fmtMoney(Math.round(g.price*VS_TON_RATE)) : Math.round(g.price*VS_TON_RATE)+' ₽';
  const left = Math.max(0, g.supply - g.sold);
  const pct = Math.min(100, Math.round(g.sold*100/g.supply));
  const own = VS_TON.owned[g.id] || 0;
  const act = locked
    ? `<button class="btn" style="width:100%;margin-top:6px" onclick="vsGiftLock()"><svg class="i"><use href="#i-crown"/></svg> Открыть в PRO</button>`
    : `<button class="btn" style="width:100%;margin-top:6px" onclick="vsBuyGift('${g.id}')">${vsGemMark(15)} Купить за ${vsTonFmt(g.price)} TON</button>`;
  v.innerHTML = `
    <div class="vs-buy-art${g.premium?' vs-nft':''}">${vsGiftSvg(g.art,120)}${g.premium?`<span class="vs-nft-shine"></span>`:''}${g.premium?`<span class="vs-buy-pro"><svg class="i"><use href="#i-crown"/></svg> PRO</span>`:''}</div>
    <h2 class="vs-buy-name">${esc(g.name)}${own?`<span class="vs-buy-owned">в коллекции ×${own}</span>`:''}</h2>
    <div class="vs-buy-price">${vsGemMark(20)}<b>${vsTonFmt(g.price)}</b> TON <small>≈ ${rub}</small></div>
    <div class="vs-buy-supply"><div class="vs-buy-sbar"><i style="width:${pct}%"></i></div><span>Выпущено ${g.sold.toLocaleString('ru-RU')} · осталось ${left.toLocaleString('ru-RU')} из ${g.supply.toLocaleString('ru-RU')}</span></div>
    <div class="vs-buy-note"><svg class="i"><use href="#i-lock"/></svg> Прототип: покупка списывает TON с локального кошелька. Настоящие NFT-подарки TON — в релизе.</div>
    ${act}`;
  openSheet('vs-ton-buy');
}
function vsGiftLock(){
  showPopup({ ico:'crown', title:'Коллекционный подарок',
    body:'Подарки с короной — эксклюзив тарифов PRO и BUSINESS. Оформи PRO, и коллекция откроется полностью.',
    actions:[{label:'Оформить PRO', onclick:()=>{ if(typeof openPay==='function') openPay('PRO'); }},{label:'Позже', ghost:true}] });
}
function vsBuyGift(id){
  const g = vsGiftById(id); if(!g) return;
  if(g.premium && !vsPremiumOk()){ closeSheet(); vsGiftLock(); return; }
  if(VS_TON.balance < g.price){
    closeSheet();
    showPopup({ ico:'money', title:'Не хватает TON',
      body:`Для «${esc(g.name)}» нужно ${vsTonFmt(g.price)} TON. Пополни кошелёк TON за рубли — быстро и без комиссии.`,
      actions:[{label:'Пополнить TON', onclick:()=>{ if(typeof closePopup==='function') closePopup(); vsOpenTopup(); }},{label:'Позже', ghost:true}] });
    return;
  }
  VS_TON.balance = Math.round((VS_TON.balance - g.price)*100)/100;
  VS_TON.owned[id] = (VS_TON.owned[id]||0) + 1;
  g.sold = Math.min(g.supply, g.sold + 1);
  VS_TON.tx.unshift({ t:'-', ton:g.price, why:'Покупка · '+g.name, at:Date.now() });
  if(VS_TON.tx.length > 200) VS_TON.tx.length = 200;
  vsTonSave();
  /* комиссия площадки OKO 5% — доход владельца */
  if(typeof okoEarn==='function') okoEarn(Math.round(g.price*VS_TON_RATE*0.05), 'TON-подарки: комиссия');
  closeSheet();
  toast('Подарок в коллекции');
  vsTonBurst();
  vsRenderTon();
}

/* --- пополнение TON за рубли --- */
function vsOpenTopup(){ if(!VS_TON_TOPUP) VS_TON_TOPUP = 5; vsRenderTopup(); openSheet('vs-ton-topup'); }
function vsRenderTopup(){
  const v = document.getElementById('vsTopupView'); if(!v) return;
  const amts = [1,5,10,25];
  const rub = Math.round(VS_TON_TOPUP*VS_TON_RATE);
  const rubStr = (typeof fmtMoney==='function') ? fmtMoney(rub) : rub+' ₽';
  const rateStr = (typeof fmtMoney==='function') ? fmtMoney(VS_TON_RATE) : VS_TON_RATE+' ₽';
  v.innerHTML = `
    <div class="vs-topup-big">${vsGemMark(30)}<b>${vsTonFmt(VS_TON_TOPUP)}</b> TON</div>
    <div class="vs-topup-rub">спишем ${rubStr} с кошелька OKO</div>
    <div class="vs-topup-chips">${amts.map(a=>`<button class="${VS_TON_TOPUP===a?'on':''}" onclick="vsSetTopup(${a})">${a} TON</button>`).join('')}</div>
    <div class="vs-buy-note"><svg class="i"><use href="#i-lock"/></svg> Курс прототипа: 1 TON ≈ ${rateStr}. Настоящий обмен на TON — в релизе.</div>
    <button class="btn" style="width:100%;margin-top:6px" onclick="vsDoTopup()"><svg class="i"><use href="#i-plus"/></svg> Пополнить на ${vsTonFmt(VS_TON_TOPUP)} TON</button>`;
}
function vsSetTopup(a){ VS_TON_TOPUP = a; vsRenderTopup(); }
function vsDoTopup(){
  const rub = Math.round(VS_TON_TOPUP*VS_TON_RATE);
  if(typeof walletCharge === 'function' && walletCharge(rub, 'Покупка TON · '+vsTonFmt(VS_TON_TOPUP)+' TON')){
    VS_TON.balance = Math.round((VS_TON.balance + VS_TON_TOPUP)*100)/100;
    VS_TON.tx.unshift({ t:'+', ton:VS_TON_TOPUP, why:'Пополнение TON', at:Date.now() });
    if(VS_TON.tx.length > 200) VS_TON.tx.length = 200;
    vsTonSave();
    closeSheet();
    toast('Кошелёк TON пополнен');
    vsRenderTon();
  }
  /* при нехватке рублей walletCharge сам покажет тост и уведёт в кошелёк */
}

/* --- деталь подарка из коллекции --- */
function vsOpenGift(id){ vsGiftDetailId = id; vsRenderGift(); openSheet('vs-gift'); }
function vsRenderGift(){
  const v = document.getElementById('vsGiftView'); if(!v) return;
  const g = vsGiftById(vsGiftDetailId); if(!g) return;
  const n = VS_TON.owned[g.id] || 0;
  v.innerHTML = `
    <div class="vs-buy-art">${vsGiftSvg(g.art,120)}</div>
    <h2 class="vs-buy-name">${esc(g.name)}</h2>
    <div class="vs-gift-own"><svg class="i"><use href="#i-check2"/></svg> В коллекции: <b>${n}</b></div>
    <button class="btn" style="width:100%" ${n<=0?'disabled':''} onclick="vsOpenSend('${g.id}')"><svg class="i"><use href="#i-send"/></svg> Подарить другу</button>
    <button class="btn ghost" style="width:100%;margin-top:8px" onclick="vsOpenBuy('${g.id}')"><svg class="i"><use href="#i-plus"/></svg> Купить ещё</button>`;
}

/* --- отправка подарка в чат --- */
function vsOpenSend(id){ vsSendGiftId = id; vsRenderSend(); openSheet('vs-send'); }
function vsRenderSend(){
  const v = document.getElementById('vsSendView'); if(!v) return;
  const g = vsGiftById(vsSendGiftId);
  const chats = (typeof CHATS !== 'undefined' ? CHATS : []).filter(c=>c && c.name && c.kind !== 'channel');
  v.innerHTML = `
    <div class="vs-send-head">${vsGiftSvg(g?g.art:'crystal',44)}<div><b>Кому подарить</b><small>${g?esc(g.name):''} · выбери чат</small></div></div>
    <div class="vs-send-list">${chats.map(c=>{
      const ava = c.avaIcon ? `<svg class="i"><use href="#i-${c.avaIcon}"/></svg>` : esc(String(c.ava||c.name[0]||'O'));
      const cid = String(c.id).replace(/[^A-Za-z0-9_-]/g,'');
      return `<button class="vs-send-row" onclick="vsSendGift('${vsSendGiftId}','${cid}')"><span class="vs-send-ava">${ava}</span><span class="vs-send-name">${esc(c.name)}</span><svg class="i vs-send-go"><use href="#i-send"/></svg></button>`;
    }).join('')}</div>`;
}
function vsSendGift(giftId, chatId){
  const g = vsGiftById(giftId);
  if(!g || (VS_TON.owned[giftId]||0) <= 0){ toast('Подарка нет в коллекции'); return; }
  const c = (typeof CHATS !== 'undefined' ? CHATS : []).find(x=>String(x.id).replace(/[^A-Za-z0-9_-]/g,'')===String(chatId));
  if(!c){ toast('Чат не найден'); return; }
  VS_TON.owned[giftId]--; if(VS_TON.owned[giftId] <= 0) delete VS_TON.owned[giftId];
  VS_TON.tx.unshift({ t:'send', ton:0, why:'Подарок «'+g.name+'» → '+c.name, at:Date.now() });
  if(VS_TON.tx.length > 200) VS_TON.tx.length = 200;
  vsTonSave();
  const tm = (typeof nowT === 'function') ? nowT() : '';
  c.msgs = c.msgs || [];
  c.msgs.push({ in:0, t:tm, kind:'gift', gift:giftId });
  c.preview = 'Ты: Подарок · ' + g.name; c.time = tm;
  closeSheet();
  if(typeof showTab === 'function') showTab('chats');
  if(typeof openConv === 'function') openConv(c.id);
  if(typeof renderChatList === 'function'){ const s = document.getElementById('chatSearch'); renderChatList(s ? s.value : ''); }
  toast('Подарок отправлен: ' + c.name);
}

/* --- история операций TON --- */
function vsOpenHistory(){ vsRenderHist(); openSheet('vs-ton-hist'); }
function vsRenderHist(){
  const v = document.getElementById('vsHistView'); if(!v) return;
  const tx = VS_TON.tx || [];
  v.innerHTML = tx.length
    ? `<div class="vs-hist-list">${tx.map(x=>{
        const cls = x.t==='+' ? 'in' : x.t==='-' ? 'out' : 'send';
        const val = x.t==='send' ? `<svg class="i"><use href="#i-send"/></svg>` : `${x.t==='+'?'+':'−'}${vsTonFmt(x.ton)} TON`;
        return `<div class="vs-hist-row"><div class="vs-hist-why">${esc(x.why)}<small>${vsWhen(x.at)}</small></div><div class="vs-hist-val ${cls}">${val}</div></div>`;
      }).join('')}</div>`
    : `<div class="vs-mine-empty"><b>Пока нет операций</b><span>Пополни кошелёк или купи подарок</span></div>`;
}

function vsCopyAddr(){ try{ navigator.clipboard && navigator.clipboard.writeText(VS_TON.addr||''); }catch(e){} toast('Адрес кошелька скопирован'); }
function vsConnectWallet(){
  showPopup({ ico:'lock', title:'TON Connect',
    body:'Честный прототип: в релизе подключишь Tonkeeper или Wallet в один тап, и подарки станут настоящими NFT в сети TON. Сейчас баланс и коллекция хранятся локально — безопасно и бесплатно.',
    actions:[{label:'Понятно'}] });
}

/* праздничный дождь кристаллов поверх экрана TON при покупке */
function vsTonBurst(){
  const host = document.getElementById('screen-ton'); if(!host) return;
  const r = host.getBoundingClientRect();
  if(r.width < 10 || r.height < 10) return;
  const box = document.createElement('div');
  box.className = 'vs-rain';
  box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;--fy:${Math.round(r.height + 60)}px`;
  const n = 12 + Math.floor(Math.random() * 6);
  let h = '';
  for(let k = 0; k < n; k++){
    const sz = Math.round(11 + Math.random() * 13);
    const x = (Math.random() * 94).toFixed(1);
    const dur = (1.1 + Math.random() * 0.5).toFixed(2);
    const dl = (Math.random() * 0.4).toFixed(2);
    h += `<i style="left:${x}%;width:${sz}px;height:${sz}px;animation-duration:${dur}s;animation-delay:${dl}s"><svg viewBox="0 0 100 100"><path d="M50 8 L86 42 L50 92 L14 42 Z" fill="#2fb3f2" stroke="#bfeaff" stroke-width="5"/><path d="M50 8 L64 42 L50 92 L36 42 Z" fill="#eafaff" opacity=".55"/></svg></i>`;
  }
  box.innerHTML = h;
  document.body.appendChild(box);
  setTimeout(()=>box.remove(), 2300);
}

/* сообщение-подарок в чате */
const _prevMsgHtmlVs = msgHtml;
msgHtml = function(m, idx){
  if(m && m.kind === 'gift'){
    const g = vsGiftById(m.gift) || VS_GIFTS[0];
    const checks = m.in ? '' : (typeof I==='function' ? I('check2') : '');
    const time = `<span class="t">${m.t||''}${checks}</span>`;
    return `<div class="msg gift-msg ${m.in?'in':'out'}" style="align-self:${m.in?'flex-start':'flex-end'}"><div class="vs-giftmsg">${vsGiftSvg(g.art,88)}<div class="vs-giftmsg-cap"><b>${vsGemMark(11)} Подарок</b><span>${esc(g.name)}</span></div></div>${time}</div>`;
  }
  return _prevMsgHtmlVs(m, idx);
};

/* рендер экрана TON при переходе на вкладку */
const _prevShowTabVs = showTab;
showTab = function(t){
  _prevShowTabVs(t);
  if(t === 'ton') vsRenderTon();
};

/* ---------- САМОИНИЦИАЛИЗАЦИЯ ---------- */
(function vsInit(){
  /* демо: официальный канал OKO в ленте тоже с галочкой */
  try{ if(typeof VERIFIED !== 'undefined') VERIFIED.add('OKO · Официальный'); }catch(e){}
  vsInsertProw();
  vsInitNpost();
  /* первые рендеры ядра прошли до патчей — дорисовать бейджи в текущем DOM */
  vsDecorateAll();
  /* TON подарки: иконка-символ, заголовок, тайл в хабе, первый рендер */
  vsInjectTonSymbol();
  try{ if(typeof regTitle === 'function') regTitle('ton', 'TON Подарки'); }catch(e){}
  try{ if(typeof addSvcTile === 'function') addSvcTile({ id:'ton', label:'TON Подарки', ico:'vs-gem', bg:'rgba(0,152,234,.16)', fg:'#3fb6ff', onclick:()=>{ if(typeof showTab==='function') showTab('ton'); } }); }catch(e){}
  const scr = document.getElementById('screen-ton');
  if(scr && scr.classList.contains('active')) vsRenderTon();
})();
