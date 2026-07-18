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

/* ---------- САМОИНИЦИАЛИЗАЦИЯ ---------- */
(function vsInit(){
  /* демо: официальный канал OKO в ленте тоже с галочкой */
  try{ if(typeof VERIFIED !== 'undefined') VERIFIED.add('OKO · Официальный'); }catch(e){}
  vsInsertProw();
  vsInitNpost();
  /* первые рендеры ядра прошли до патчей — дорисовать бейджи в текущем DOM */
  vsDecorateAll();
})();
