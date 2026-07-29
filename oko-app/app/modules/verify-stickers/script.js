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
    pending:  { cls:'pending', ico:'clock',    t:'На рассмотрении',  s:'Модерация проверяет аккаунт и активность, обычно до 24 часов' },
    approved: { cls:'ok',      ico:'verified', t:'Верифицирован',    s:'Аккаунт подтверждён, галочка видна в профиле, ленте и чатах' },
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
        body:'Для верификации нужен активный тариф PRO или BUSINESS либо подтверждённый официальный бизнес. Оформи PRO, и подай заявку снова.',
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
/* Каждый стикер — самодостаточная SVG-иллюстрация в фирменном языке OKO:
   строго чёрный + лайм #9AFF00 (никаких системных «цветных» эмодзи), градиенты,
   белые блики, тёмный кейлайн (читается в тёмной И светлой теме), сигнатурная искра.
   Плавает прозрачно (в сообщении) и на тайле (в гриде). Реакции — компактная
   штриховая версия того же набора (I('heart') …); стикеры — премиум-заливка. */
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
    <linearGradient id="${u}o" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4f8f00"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#e4ff9e"/></linearGradient>
    <linearGradient id="${u}c" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#c6ff70"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs>
    <path d="M52 5 C61 26 84 34 79 61 C75 85 61 96 50 96 C37 96 21 87 21 63 C21 49 31 45 33 34 C43 43 45 31 40 22 C51 27 54 16 52 5 Z" fill="url(#${u}o)" stroke="#0a1403" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M51 46 C58 56 62 62 58 74 C55 86 47 88 43 82 C38 74 43 67 45 61 C47 56 51 54 51 46 Z" fill="url(#${u}c)"/>`;
  case 'heart': return `<defs>
    <linearGradient id="${u}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6ff8f"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient></defs>
    <path d="M50 88 C16 63 6 45 6 29 C6 15 18 7 31 7 C41 7 47 13 50 20 C53 13 59 7 69 7 C82 7 94 15 94 29 C94 45 84 63 50 88 Z" fill="url(#${u}r)" stroke="#0a1403" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M27 19 C21 22 16 28 16 36" stroke="#f4ffd6" stroke-width="6" fill="none" stroke-linecap="round" opacity=".8"/>`;
  case 'thumb': return `<defs>
    <linearGradient id="${u}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6ff70"/><stop offset=".55" stop-color="#9AFF00"/><stop offset="1" stop-color="#5fa800"/></linearGradient></defs>
    <rect x="20" y="46" width="16" height="40" rx="4.5" fill="#6cba12"/>
    <rect x="23" y="49" width="5" height="34" rx="2.5" fill="#b6ff5e" opacity=".65"/>
    <path d="M40 46 C40 46 46 44 49 38 C52 32 51 24 54 18 C56 14 63 14 64 21 C65 28 61 38 61 42 H80 C86 42 88 48 85 53 C88 56 87 62 83 64 C86 68 83 74 79 75 C81 80 77 86 71 86 H50 C44 86 40 82 40 76 Z" fill="url(#${u}t)"/>
    <path d="M46 50 C48 47 51 43 53 38" stroke="#eaffc0" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".7"/>`;
  case 'laugh': return `<defs>
    <radialGradient id="${u}f" cx=".4" cy=".33" r=".78"><stop offset="0" stop-color="#eaffb8"/><stop offset=".55" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></radialGradient></defs>
    <circle cx="50" cy="50" r="43" fill="url(#${u}f)" stroke="#0a1403" stroke-width="1.4"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="1.6" opacity=".28"/>
    <path d="M22 43 Q31 32 41 43" stroke="#0a1403" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M59 43 Q69 32 78 43" stroke="#0a1403" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M25 57 Q50 90 75 57 Z" fill="#0a1403"/>
    <path d="M28 58 Q50 68 72 58 Z" fill="#eaffc0"/>
    <path d="M13 52 q-5 8 0 14 q5 -5 0 -14 z" fill="#c6ff70"/>
    <path d="M87 52 q5 8 0 14 q-5 -5 0 -14 z" fill="#c6ff70"/>`;
  case 'wow': return `<defs>
    <radialGradient id="${u}w" cx=".4" cy=".33" r=".8"><stop offset="0" stop-color="#eaffb8"/><stop offset=".55" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></radialGradient></defs>
    <circle cx="50" cy="50" r="43" fill="url(#${u}w)" stroke="#0a1403" stroke-width="1.4"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="1.6" opacity=".3"/>
    <path d="M24 34 Q33 28 42 33" stroke="#0a1403" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M58 33 Q67 28 76 34" stroke="#0a1403" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="34" cy="47" rx="7" ry="9" fill="#0a1403"/>
    <ellipse cx="66" cy="47" rx="7" ry="9" fill="#0a1403"/>
    <circle cx="31.5" cy="44" r="2.4" fill="#eaffc0"/><circle cx="63.5" cy="44" r="2.4" fill="#eaffc0"/>
    <ellipse cx="50" cy="72" rx="9.5" ry="12.5" fill="#0a1403"/>`;
  case 'star': return `<defs>
    <linearGradient id="${u}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaffb8"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient></defs>
    <path d="M50 5 L62 37 L96 38 L69 59 L79 92 L50 72 L21 92 L31 59 L4 38 L38 37 Z" fill="url(#${u}s)" stroke="#0a1403" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M50 16 L58 39 L46 39 Z" fill="#fff" opacity=".4"/>
    <path d="M81 20 l1.9 4.8 4.8 1.9 -4.8 1.9 -1.9 4.8 -1.9 -4.8 -4.8 -1.9 4.8 -1.9 z" fill="#f4ffd6" opacity=".95"/>`;
  case 'crown': return `<defs>
    <linearGradient id="${u}k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient></defs>
    <path d="M13 76 L18 32 L37 55 L50 24 L63 55 L82 32 L87 76 Z" fill="url(#${u}k)" stroke="#0a1403" stroke-width="1.8" stroke-linejoin="round"/>
    <rect x="15" y="76" width="70" height="14" rx="4" fill="#4f8f00"/>
    <rect x="15" y="76" width="70" height="5" rx="2.5" fill="#fff" opacity=".28"/>
    <circle cx="18" cy="30" r="5" fill="#f4ffd6"/><circle cx="82" cy="30" r="5" fill="#f4ffd6"/><circle cx="50" cy="22" r="5.5" fill="#f4ffd6"/>
    <circle cx="30" cy="83" r="4" fill="#0a1403"/><circle cx="50" cy="83" r="4.5" fill="#0a1403"/><circle cx="70" cy="83" r="4" fill="#0a1403"/>`;
  case 'rocket': return `<defs>
    <linearGradient id="${u}q" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient>
    <linearGradient id="${u}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#9AFF00"/></linearGradient></defs>
    <path d="M40 66 L28 84 L40 78 Z" fill="#4f8f00"/>
    <path d="M60 66 L72 84 L60 78 Z" fill="#4f8f00"/>
    <path d="M44 72 Q50 96 50 96 Q50 96 56 72 Z" fill="url(#${u}m)"/>
    <path d="M50 6 C64 22 68 44 64 70 L36 70 C32 44 36 22 50 6 Z" fill="url(#${u}q)" stroke="#0a1403" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M50 6 C57 22 59 44 57 70 L50 70 Z" fill="#fff" opacity=".18"/>
    <circle cx="50" cy="38" r="10" fill="#0a1403" stroke="#eaffb8" stroke-width="2.6"/>
    <circle cx="50" cy="38" r="5" fill="#c6ff70"/>
    <path d="M39 22 l1.8 4.6 4.6 1.8 -4.6 1.8 -1.8 4.6 -1.8 -4.6 -4.6 -1.8 4.6 -1.8 z" fill="#f4ffd6" opacity=".85"/>`;
  case 'bolt': return `<defs>
    <linearGradient id="${u}z" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient></defs>
    <path d="M58 4 L24 55 L45 55 L40 96 L78 41 L54 41 Z" fill="url(#${u}z)" stroke="#efffcf" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M55 14 L34 50 L48 50 L44 78" stroke="#fff" stroke-width="2.4" opacity=".55" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`;
  case 'sad': return `<defs>
    <radialGradient id="${u}j" cx=".4" cy=".33" r=".8"><stop offset="0" stop-color="#eaffb8"/><stop offset=".55" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></radialGradient></defs>
    <circle cx="50" cy="50" r="43" fill="url(#${u}j)" stroke="#0a1403" stroke-width="1.4"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="1.6" opacity=".28"/>
    <path d="M24 40 Q33 46 41 41" stroke="#0a1403" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <path d="M59 41 Q67 46 76 40" stroke="#0a1403" stroke-width="4.5" fill="none" stroke-linecap="round"/>
    <circle cx="35" cy="52" r="4.5" fill="#0a1403"/><circle cx="65" cy="52" r="4.5" fill="#0a1403"/>
    <path d="M34 76 Q50 64 66 76" stroke="#0a1403" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M34 58 q-5 8 0 13 q5 -5 0 -13 z" fill="#c6ff70"/>`;
  case 'check': return `<defs>
    <radialGradient id="${u}v" cx=".4" cy=".33" r=".82"><stop offset="0" stop-color="#eaffb8"/><stop offset=".55" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></radialGradient></defs>
    <circle cx="50" cy="50" r="43" fill="url(#${u}v)" stroke="#0a1403" stroke-width="1.4"/>
    <circle cx="50" cy="50" r="43" fill="none" stroke="#fff" stroke-width="1.6" opacity=".3"/>
    <path d="M28 53 L44 69 L74 35" stroke="#f4ffd6" stroke-width="10" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/>
    <path d="M28 52 L44 68 L74 34" stroke="#0a1403" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
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
  else if(s) vsStickerSpark(); /* лёгкий лайм-салют для бренд-стикеров (без лагов) */
};

/* WOW при отправке бренд-стикера: короткий залп лайм-искр у нижнего края ленты.
   Только transform/opacity (GPU), считанные частицы, авто-удаление — не тормозит. */
function vsStickerSpark(){
  try{
    const host = document.getElementById('msgs'); if(!host) return;
    const r = host.getBoundingClientRect();
    if(r.width < 10 || r.height < 10) return;
    const box = document.createElement('div');
    box.className = 'vs-spark';
    /* эпицентр — где появляется отправленный стикер (низ, ближе к правому краю) */
    const cx = r.left + r.width * 0.72, cy = r.top + r.height - 66;
    box.style.cssText = `left:${cx}px;top:${cy}px`;
    const n = 7, star = '<svg viewBox="0 0 100 100"><path d="M50 8 L60 40 L92 50 L60 60 L50 92 L40 60 L8 50 L40 40 Z" fill="#9AFF00"/></svg>';
    let h = '';
    for(let k = 0; k < n; k++){
      const ang = (k / n) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 34 + Math.random() * 30;
      const dx = Math.round(Math.cos(ang) * dist);
      const dy = Math.round(Math.sin(ang) * dist) - 10; /* лёгкий подъём вверх */
      const sz = Math.round(7 + Math.random() * 7);
      const dur = (0.5 + Math.random() * 0.25).toFixed(2);
      h += `<i style="--dx:${dx}px;--dy:${dy}px;width:${sz}px;height:${sz}px;animation-duration:${dur}s">${star}</i>`;
    }
    box.innerHTML = h;
    document.body.appendChild(box);
    setTimeout(()=>box.remove(), 900);
  }catch(e){}
}

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
  if(!Array.isArray(VS_TON.wish)) VS_TON.wish = [];
  if(typeof VS_TON.balance !== 'number' || isNaN(VS_TON.balance)) VS_TON.balance = 0;
  if(!VS_TON.addr){
    const al = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789-_';
    let s = 'UQ'; for(let i=0;i<46;i++) s += al[Math.floor(Math.random()*al.length)];
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
    <linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient>
    <linearGradient id="${u}d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8f6ff"/><stop offset=".5" stop-color="#7fd8ff"/><stop offset="1" stop-color="#2b9fe0"/></linearGradient></defs>
    <ellipse cx="50" cy="66" rx="26" ry="27" fill="none" stroke="url(#${u}g)" stroke-width="10"/>
    <ellipse cx="50" cy="66" rx="26" ry="27" fill="none" stroke="#eaffb8" stroke-width="2" opacity=".5"/>
    <path d="M34 30 L50 8 L66 30 L50 44 Z" fill="url(#${u}d)" stroke="#eafaff" stroke-width="2" stroke-linejoin="round"/>
    <path d="M34 30 H66 M50 8 L42 30 M50 8 L58 30 M42 30 L50 44 M58 30 L50 44" stroke="#eafaff" stroke-width="1.4" opacity=".8" fill="none"/>
    <path d="M40 32 l1.8 4.4 4.4 1.8 -4.4 1.8 -1.8 4.4 -1.8 -4.4 -4.4 -1.8 4.4 -1.8 z" fill="#fff" opacity=".9"/>`;
  if(a==='trophy') return `<defs>
    <linearGradient id="${u}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></linearGradient></defs>
    <rect x="38" y="72" width="24" height="10" rx="3" fill="#4f8f00"/>
    <rect x="30" y="82" width="40" height="10" rx="4" fill="#6cba12"/>
    <rect x="30" y="82" width="40" height="4" rx="2" fill="#fff" opacity=".25"/>
    <path d="M28 16 H72 V38 C72 55 62 66 50 66 C38 66 28 55 28 38 Z" fill="url(#${u}g)" stroke="#eaffb8" stroke-width="2"/>
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
    <linearGradient id="${u}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6ff70"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></linearGradient></defs>
    <path d="M42 12 H58 V40 L74 78 C77 86 71 92 63 92 H37 C29 92 23 86 26 78 L42 40 Z" fill="rgba(154,255,0,.14)" stroke="#eaffc0" stroke-width="3" stroke-linejoin="round"/>
    <path d="M35 56 L65 56 L73 76 C76 84 70 88 63 88 H37 C30 88 24 84 27 76 Z" fill="url(#${u}p)"/>
    <ellipse cx="50" cy="57" rx="15" ry="4" fill="#c6ff70" opacity=".7"/>
    <circle cx="44" cy="72" r="4" fill="#fff" opacity=".55"/><circle cx="57" cy="78" r="3" fill="#fff" opacity=".45"/><circle cx="50" cy="68" r="2.4" fill="#fff" opacity=".6"/>
    <rect x="40" y="6" width="20" height="9" rx="3" fill="#6cba12"/>
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
let VS_SEND_AMT = 1, VS_SEND_ADDR = '';
function vsAddrValid(a){
  a = String(a||'').trim();
  /* user-friendly (UQ/EQ/kQ/0Q + base64url, 48) или raw 0:hex64 */
  if(/^[UEk0]Q[A-Za-z0-9_-]{46}$/.test(a)) return true;
  if(/^-?[0-9]:[0-9a-fA-F]{64}$/.test(a)) return true;
  return false;
}
function vsOpenSendTon(){ if(!(VS_SEND_AMT>0)) VS_SEND_AMT = 1; VS_SEND_ADDR = ''; vsRenderSendTon(); openSheet('vs-ton-sendton'); }
function vsRenderSendTon(){
  const v = document.getElementById('vsSendTonView'); if(!v) return;
  const bal = vsTonFmt(VS_TON.balance);
  const amt = VS_SEND_AMT;
  const rub = Math.round(amt*VS_TON_RATE);
  const rubStr = (typeof fmtMoney==='function') ? fmtMoney(rub) : rub+' ₽';
  const maxv = Math.round(VS_TON.balance*100)/100;
  const raw = [0.5, 1, 5, maxv > 0 ? maxv : 10];
  const seen = {};
  const chips = raw.filter(a=> a>0 && !seen[a] && (seen[a]=1));
  const chipsH = chips.map(a=>
    `<button class="${amt===a?'on':''}" onclick="vsSetSendAmt(${a})">${a===maxv && maxv>0 ? 'МАКС' : vsTonFmt(a)+' TON'}</button>`).join('');
  v.innerHTML = `
    <div class="vs-sendton-bal">${vsGemMark(16)} Баланс <b>${bal} TON</b></div>
    <label class="vs-field-lbl" for="vsSendAddr">Адрес получателя</label>
    <div class="vs-addr-input">
      <input id="vsSendAddr" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder="UQ… адрес TON-кошелька" value="${esc(VS_SEND_ADDR)}" oninput="vsSendValidate()">
      <button type="button" class="vs-addr-paste" onclick="vsPasteAddr()" title="Вставить">${I('copy')}</button>
    </div>
    <div class="vs-addr-err" id="vsSendErr"></div>
    <div class="vs-topup-big" style="margin-top:6px">${vsGemMark(28)}<b>${vsTonFmt(amt)}</b> TON</div>
    <div class="vs-topup-rub">≈ ${rubStr}</div>
    <div class="vs-topup-chips">${chipsH}</div>
    <div class="vs-buy-note"><svg class="i"><use href="#i-lock"/></svg> Прототип: перевод списывает TON с локального кошелька и попадает в историю. Реальные переводы в сети TON подключатся в релизе через TON Connect.</div>
    <button class="btn vs-ton" id="vsSendBtn" style="width:100%;margin-top:6px" onclick="vsDoSendTon()"><svg class="i"><use href="#i-send"/></svg> Отправить ${vsTonFmt(amt)} TON</button>`;
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
  VS_SEND_ADDR = a;
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
  VS_SEND_AMT = 1; VS_SEND_ADDR = '';
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
      <button class="btn vs-ton" style="flex:1" onclick="vsCopyAddr()"><svg class="i"><use href="#i-copy"/></svg> Копировать</button>
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
    const wishItems = (VS_TON.wish||[]).map(vsGiftById).filter(Boolean);
    const wishSec = wishItems.length ? `<div class="vs-wish-sec">
      <div class="vs-wish-head"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" fill="currentColor"/></svg><span>Твой вишлист</span><i>${wishItems.length}</i><small>другие увидят и подарят</small></div>
      <div class="vs-wish-row">${wishItems.map(g=>`<div class="vs-wish-item vs-rar-${vsRarity(g)}" role="button" tabindex="0" onclick="vsOpenBuy('${g.id}')" title="${esc(g.name)}">${vsGiftSvg(g.art,40)}<b>${esc(g.name)}</b><small>${vsGemMark(10)} ${vsTonFmt(g.price)}</small><span class="vs-wish-x" onclick="event.stopPropagation();vsWishToggle('${g.id}')" role="button" aria-label="Убрать">${I('close')||'×'}</span></div>`).join('')}</div>
    </div>` : '';
    body = wishSec + `<div class="vs-gshop">${VS_GIFTS.map(vsShopCard).join('')}</div>`;
  } else {
    body = owned.length
      ? `<div class="vs-gshop">${owned.map(k=>vsMineCard(k, VS_TON.owned[k])).join('')}</div>`
      : `<div class="vs-mine-empty">${vsGiftSvg('crystal',64)}<b>Коллекция пуста</b><span>Купи подарок в магазине — и подари другу прямо в чат</span><button class="btn vs-ton" style="margin-top:12px" onclick="vsTonTab('shop')"><svg class="i"><use href="#i-plus"/></svg> В магазин</button></div>`;
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
  const rar = vsRarity(g);
  const wish = vsWishHas(g.id);
  return `<div class="vs-gcard vs-rar-${rar}${locked?' vs-locked':''}${g.premium?' vs-nft':''}" role="button" tabindex="0" onclick="vsOpenBuy('${g.id}')">
    <span class="vs-rar-chip vs-rar-${rar}">${VS_RARITY_LABEL[rar]}</span>
    <span class="vs-wish-tog${wish?' on':''}" onclick="event.stopPropagation();vsWishToggle('${g.id}')" role="button" aria-label="В вишлист"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" fill="currentColor"/></svg></span>
    <div class="vs-gcard-art">${vsGiftSvg(g.art,72)}${g.premium?`<span class="vs-nft-shine"></span>`:''}${g.premium?`<span class="vs-gcard-pro"><svg class="i"><use href="#i-crown"/></svg></span>`:''}${own?`<span class="vs-gcard-own">×${own}</span>`:''}${locked?`<span class="vs-gcard-lock"><svg class="i"><use href="#i-lock"/></svg></span>`:''}</div>
    <div class="vs-gcard-name">${esc(g.name)}</div>
    <div class="vs-gcard-price">${vsGemMark(12)} ${vsTonFmt(g.price)}</div>
  </div>`;
}
function vsMineCard(id, n){
  const g = vsGiftById(id); if(!g) return '';
  const rar = vsRarity(g);
  return `<div class="vs-gcard vs-rar-${rar}" role="button" tabindex="0" onclick="vsOpenGift('${id}')">
    <span class="vs-rar-chip vs-rar-${rar}">${VS_RARITY_LABEL[rar]}</span>
    <div class="vs-gcard-art">${vsGiftSvg(g.art,72)}<span class="vs-gcard-own">×${n}</span></div>
    <div class="vs-gcard-name">${esc(g.name)}</div>
    <div class="vs-gcard-price vs-mine-send"><svg class="i"><use href="#i-send"/></svg> Отправить</div>
  </div>`;
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
  const rar = vsRarity(g);
  const wish = vsWishHas(g.id);
  const wishBtn = `<button class="btn ghost vs-wish-btn${wish?' on':''}" style="width:100%;margin-top:8px" onclick="vsWishToggle('${g.id}')"><svg viewBox="0 0 24 24" aria-hidden="true" width="15" height="15"><path d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" fill="currentColor"/></svg> ${wish?'В вишлисте':'В вишлист'}</button>`;
  const act = locked
    ? `<button class="btn" style="width:100%;margin-top:6px" onclick="vsGiftLock()"><svg class="i"><use href="#i-crown"/></svg> Открыть в PRO</button>`
    : `<button class="btn vs-ton" style="width:100%;margin-top:6px" onclick="vsBuyGift('${g.id}')">${vsGemMark(15)} Купить за ${vsTonFmt(g.price)} TON</button>`;
  v.dataset.gid = g.id;
  v.innerHTML = `
    <div class="vs-buy-art vs-rar-${rar}${g.premium?' vs-nft':''}">${vsGiftSvg(g.art,120)}${g.premium?`<span class="vs-nft-shine"></span>`:''}${g.premium?`<span class="vs-buy-pro"><svg class="i"><use href="#i-crown"/></svg> PRO</span>`:''}</div>
    <div class="vs-buy-rar"><span class="vs-rar-chip vs-rar-${rar}">${VS_RARITY_LABEL[rar]}</span></div>
    <h2 class="vs-buy-name">${esc(g.name)}${own?`<span class="vs-buy-owned">в коллекции ×${own}</span>`:''}</h2>
    <div class="vs-buy-price">${vsGemMark(20)}<b>${vsTonFmt(g.price)}</b> TON <small>≈ ${rub}</small></div>
    <div class="vs-buy-supply"><div class="vs-buy-sbar"><i style="width:${pct}%"></i></div><span>Выпущено ${g.sold.toLocaleString('ru-RU')} · осталось ${left.toLocaleString('ru-RU')} из ${g.supply.toLocaleString('ru-RU')}</span></div>
    <div class="vs-buy-note"><svg class="i"><use href="#i-lock"/></svg> Прототип: покупка списывает TON с локального кошелька. Настоящие NFT-подарки TON — в релизе.</div>
    ${act}
    ${locked?'':wishBtn}`;
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
    <button class="btn vs-ton" style="width:100%;margin-top:6px" onclick="vsDoTopup()"><svg class="i"><use href="#i-plus"/></svg> Пополнить на ${vsTonFmt(VS_TON_TOPUP)} TON</button>`;
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
    <button class="btn vs-ton" style="width:100%" ${n<=0?'disabled':''} onclick="vsOpenSend('${g.id}')"><svg class="i"><use href="#i-send"/></svg> Подарить другу</button>
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
    <div class="vs-send-note">
      <label class="vs-field-lbl" for="vsSendNote">Поздравление <span class="vs-send-opt">необязательно · до 120</span></label>
      <textarea id="vsSendNote" maxlength="120" placeholder="С днём рождения, друг!" oninput="VS_SEND_NOTE=this.value;vsSendNoteCount()">${esc(VS_SEND_NOTE||'')}</textarea>
      <div class="vs-send-count" id="vsSendCount">${(VS_SEND_NOTE||'').length} / 120</div>
    </div>
    <div class="vs-send-list">${chats.map(c=>{
      const ava = c.avaIcon ? `<svg class="i"><use href="#i-${c.avaIcon}"/></svg>` : esc(String(c.ava||c.name[0]||'O'));
      const cid = String(c.id).replace(/[^A-Za-z0-9_-]/g,'');
      return `<button class="vs-send-row" onclick="vsSendGift('${vsSendGiftId}','${cid}')"><span class="vs-send-ava">${ava}</span><span class="vs-send-name">${esc(c.name)}</span><svg class="i vs-send-go"><use href="#i-send"/></svg></button>`;
    }).join('')}</div>`;
}
function vsSendNoteCount(){
  const el = document.getElementById('vsSendCount');
  if(el) el.textContent = ((VS_SEND_NOTE||'').length) + ' / 120';
}
function vsSendGift(giftId, chatId){
  const g = vsGiftById(giftId);
  if(!g || (VS_TON.owned[giftId]||0) <= 0){ toast('Подарка нет в коллекции'); return; }
  const c = (typeof CHATS !== 'undefined' ? CHATS : []).find(x=>String(x.id).replace(/[^A-Za-z0-9_-]/g,'')===String(chatId));
  if(!c){ toast('Чат не найден'); return; }
  const note = String(VS_SEND_NOTE||'').trim().slice(0,120);
  VS_TON.owned[giftId]--; if(VS_TON.owned[giftId] <= 0) delete VS_TON.owned[giftId];
  VS_TON.tx.unshift({ t:'send', ton:0, why:'Подарок «'+g.name+'» → '+c.name, at:Date.now() });
  if(VS_TON.tx.length > 200) VS_TON.tx.length = 200;
  vsTonSave();
  const tm = (typeof nowT === 'function') ? nowT() : '';
  c.msgs = c.msgs || [];
  const msg = { in:0, t:tm, kind:'gift', gift:giftId };
  if(note) msg.note = note;
  c.msgs.push(msg);
  c.preview = 'Ты: Подарок · ' + g.name; c.time = tm;
  VS_SEND_NOTE = '';
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
    const rar = vsRarity(g);
    const noteHtml = m.note ? `<div class="vs-giftmsg-note">${esc(m.note)}</div>` : '';
    const repeatBtn = m.in ? '' : `<button class="vs-giftmsg-act" onclick="event.stopPropagation();vsResend(${idx})"><svg class="i"><use href="#i-send"/></svg> Повторить</button>`;
    const openHint = `<span class="vs-giftmsg-tap">${m.in?'нажми, чтобы открыть':'превью подарка'}</span>`;
    return `<div class="msg gift-msg ${m.in?'in':'out'}" style="align-self:${m.in?'flex-start':'flex-end'}"><div class="vs-giftmsg vs-rar-${rar}" onclick="vsUnwrap(${idx})">${vsGiftSvg(g.art,88)}<div class="vs-giftmsg-cap"><b>${vsGemMark(11)} Подарок <i class="vs-giftmsg-rar vs-rar-${rar}">${VS_RARITY_LABEL[rar]}</i></b><span>${esc(g.name)}</span></div>${noteHtml}${openHint}${repeatBtn}</div>${time}</div>`;
  }
  return _prevMsgHtmlVs(m, idx);
};

/* рендер экрана TON при переходе на вкладку */
const _prevShowTabVs = showTab;
showTab = function(t){
  _prevShowTabVs(t);
  if(t === 'ton') vsRenderTon();
};

/* ============================================================
   6. УЛУЧШЕНИЯ TG/Steam/Discord Gifts:
      rarity, wishlist, personal note, unwrap+sound, quick resend
   ============================================================ */

/* --- редкость: legendary=premium, epic≤6k, rare≤12k, common иначе --- */
const VS_RARITY_LABEL = { common:'ОБЫЧНЫЙ', rare:'РЕДКИЙ', epic:'ЭПИЧЕСКИЙ', legendary:'ЛЕГЕНДАРНЫЙ' };
function vsRarity(g){
  if(!g) return 'common';
  if(g.premium) return 'legendary';
  if(g.supply <= 6000) return 'epic';
  if(g.supply <= 12000) return 'rare';
  return 'common';
}

/* --- вишлист (клиент отмечает желаемое, другие видят и дарят) --- */
function vsWishHas(id){ return (VS_TON.wish||[]).indexOf(id) >= 0; }
function vsWishToggle(id){
  VS_TON.wish = VS_TON.wish || [];
  const i = VS_TON.wish.indexOf(id);
  if(i>=0){ VS_TON.wish.splice(i,1); toast('Убрано из вишлиста'); }
  else { VS_TON.wish.unshift(id); toast('Добавлено в вишлист'); }
  if(VS_TON.wish.length > 30) VS_TON.wish.length = 30;
  vsTonSave();
  const buyV = document.getElementById('vsBuyView');
  if(buyV && buyV.dataset && buyV.dataset.gid === id) vsOpenBuy(id);
  const scr = document.getElementById('screen-ton');
  if(scr && scr.classList.contains('active')) vsRenderTon();
}

/* --- персональное поздравление (буфер + счётчик) --- */
var VS_SEND_NOTE = '';

/* --- Web Audio: короткий «спарк» при распаковке (без файлов, без сети) --- */
var vsAudio = null;
function vsAudioCtx(){
  if(vsAudio) return vsAudio;
  try{ vsAudio = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ vsAudio = null; }
  return vsAudio;
}
function vsUnwrapSound(){
  const a = vsAudioCtx(); if(!a) return;
  try{ if(a.state === 'suspended') a.resume(); }catch(e){}
  const now = a.currentTime;
  const notes = [
    { f: 660, t: 0.00 },
    { f: 880, t: 0.07 },
    { f:1175, t: 0.14 },
    { f:1568, t: 0.22 },
    { f:1976, t: 0.32 }
  ];
  notes.forEach(n=>{
    try{
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'triangle'; o.frequency.value = n.f;
      g.gain.setValueAtTime(0, now + n.t);
      g.gain.linearRampToValueAtTime(0.16, now + n.t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0006, now + n.t + 0.28);
      o.connect(g).connect(a.destination);
      o.start(now + n.t); o.stop(now + n.t + 0.30);
    }catch(e){}
  });
}

/* --- анимация распаковки: fullscreen-overlay, confetti + звук --- */
function vsUnwrap(idx){
  if(typeof currentChat === 'undefined' || !currentChat || !currentChat.msgs) return;
  const m = currentChat.msgs[idx]; if(!m || m.kind !== 'gift') return;
  const g = vsGiftById(m.gift) || VS_GIFTS[0];
  const rar = vsRarity(g);
  const who = m.in ? esc(currentChat.name) : 'Тебе';
  const noteH = m.note ? `<div class="vs-uwrap-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.35-7-10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 19 11c0 5.65-7 10-7 10z" fill="currentColor"/></svg><span>${esc(m.note)}</span></div>` : '';
  vsUnwrapClose();
  const wrap = document.createElement('div');
  wrap.className = 'vs-uwrap';
  wrap.innerHTML = `
    <div class="vs-uwrap-back" onclick="vsUnwrapClose()"></div>
    <div class="vs-uwrap-card vs-rar-${rar}">
      <button class="vs-uwrap-x" onclick="vsUnwrapClose()" aria-label="Закрыть">${I('close')||'×'}</button>
      <div class="vs-uwrap-from">${who} · <span class="vs-rar-chip vs-rar-${rar}">${VS_RARITY_LABEL[rar]}</span></div>
      <div class="vs-uwrap-art">${vsGiftSvg(g.art,140)}</div>
      <div class="vs-uwrap-name">${esc(g.name)}</div>
      <div class="vs-uwrap-price">${vsGemMark(14)} ${vsTonFmt(g.price)} TON</div>
      ${noteH}
      <button class="btn vs-ton" style="width:100%;margin-top:14px" onclick="vsUnwrapClose()">Красота</button>
    </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>wrap.classList.add('on'));
  vsUnwrapConfetti(wrap);
  vsUnwrapSound();
}
function vsUnwrapClose(){
  document.querySelectorAll('.vs-uwrap').forEach(el=>{
    el.classList.remove('on');
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 260);
  });
}
function vsUnwrapConfetti(host){
  const layer = document.createElement('div');
  layer.className = 'vs-uwrap-conf';
  const cols = ['#9AFF00','#0098EA','#4fd0ff','#c6ff70','#ffffff','#b57cff'];
  const n = 46; let h = '';
  for(let k=0;k<n;k++){
    const x = (Math.random()*100).toFixed(1);
    const dur = (1.5 + Math.random()*1.3).toFixed(2);
    const dl = (Math.random()*0.35).toFixed(2);
    const rot = Math.round(Math.random()*720 - 360);
    const w = (5 + Math.random()*4).toFixed(0);
    const hgt = (9 + Math.random()*6).toFixed(0);
    const c = cols[k % cols.length];
    h += `<i style="left:${x}%;width:${w}px;height:${hgt}px;background:${c};--r:${rot}deg;animation-duration:${dur}s;animation-delay:${dl}s"></i>`;
  }
  layer.innerHTML = h;
  host.appendChild(layer);
  setTimeout(()=>{ try{ layer.remove(); }catch(e){} }, 3400);
}

/* --- быстрый повтор подарка тому же получателю --- */
function vsResend(idx){
  if(typeof currentChat === 'undefined' || !currentChat || !currentChat.msgs) return;
  const m = currentChat.msgs[idx]; if(!m || m.kind !== 'gift') return;
  const g = vsGiftById(m.gift); if(!g) return;
  const own = VS_TON.owned[g.id] || 0;
  if(own <= 0){
    showPopup({ ico:'plus', title:'Купить и подарить снова?',
      body:`«${esc(g.name)}» в коллекции закончился. Купи ещё один за ${vsTonFmt(g.price)} TON и подари тому же получателю.`,
      actions:[{label:'Купить', onclick:()=>{ if(typeof closePopup==='function') closePopup(); vsOpenBuy(g.id); }},{label:'Позже', ghost:true}] });
    return;
  }
  VS_TON.owned[g.id]--; if(VS_TON.owned[g.id] <= 0) delete VS_TON.owned[g.id];
  const c = currentChat;
  VS_TON.tx.unshift({ t:'send', ton:0, why:'Подарок «'+g.name+'» → '+c.name+' · повтор', at:Date.now() });
  if(VS_TON.tx.length > 200) VS_TON.tx.length = 200;
  vsTonSave();
  const tm = (typeof nowT === 'function') ? nowT() : '';
  c.msgs = c.msgs || [];
  c.msgs.push({ in:0, t:tm, kind:'gift', gift:g.id });
  c.preview = 'Ты: Подарок · ' + g.name; c.time = tm;
  if(typeof renderMsgs === 'function') renderMsgs();
  if(typeof renderChatList === 'function'){ const s = document.getElementById('chatSearch'); renderChatList(s ? s.value : ''); }
  toast('Отправлен снова');
}

/* ============================================================
   7. FRAGMENT-LEVEL: 22+ подарков с NFT-метаданными, 3D-превью,
      история продаж, биржа, аукцион, событие «Новый год»,
      3D-carousel коллекции, fly-to-friend, наборы стикеров,
      TON viewer в истории
   ============================================================ */

/* --- расширяем VS_GIFTS до 22 подарков + NFT-метаданные --- */
VS_GIFTS.push(
  { id:'flame',    name:'Огонёк',      art:'flame',    price:1.5, supply:15000, sold:9120  },
  { id:'diamond',  name:'Алмаз',       art:'diamond',  price:6.0, supply:4000,  sold:2140  },
  { id:'lightning',name:'Молния',      art:'lightning',price:2.2, supply:12000, sold:7480  },
  { id:'moon',     name:'Луна',        art:'moon',     price:3.4, supply:9000,  sold:5330  },
  { id:'sun',      name:'Солнце',      art:'sun',      price:4.1, supply:7000,  sold:4620  },
  { id:'shield',   name:'Щит',         art:'shield',   price:2.8, supply:8000,  sold:5560  },
  { id:'key',      name:'Ключ',        art:'key',      price:3.0, supply:8500,  sold:6320  },
  { id:'skull',    name:'Череп',       art:'skull',    price:5.5, supply:5000,  sold:3260  },
  { id:'phoenix',  name:'Феникс',      art:'phoenix',  price:15,  supply:500,   sold:118,  premium:true },
  { id:'dragon',   name:'Дракон',      art:'dragon',   price:20,  supply:300,   sold:78,   premium:true },
  { id:'giftbox',  name:'Подарок',     art:'giftbox',  price:1.9, supply:20000, sold:12550 },
  { id:'nyeye',    name:'Ёлочный OKO', art:'nyeye',    price:9,   supply:2500,  sold:840,  event:{ id:'ny', label:'НОВЫЙ ГОД', endsAt: Date.now() + 3*86400000 } },
);
/* NFT-метаданные для всех подарков (chain: TON, transferable:true, deterministic contract) */
VS_GIFTS.forEach(function(g, i){
  g.chain = 'TON';
  g.transferable = true;
  /* master-collection адрес — детерминированный, декоративный */
  var hex = '';
  var s = 0; for(var k=0;k<g.id.length;k++) s = (s*31 + g.id.charCodeAt(k)) >>> 0;
  for(var k=0;k<40;k++){ s = (s*1103515245 + 12345) & 0x7fffffff; hex += '0123456789abcdef'[s & 15]; }
  g.contract = 'EQ' + hex.slice(0,44).replace(/[^0-9a-f]/g,'a');
  g.royalty = g.premium ? 7.5 : 5;
});

/* --- новые SVG-арт подарки (расширяем vsGiftArt) --- */
var _vsGiftArtPrev = vsGiftArt;
vsGiftArt = function(a, u){
  if(a==='flame') return '<defs><linearGradient id="'+u+'f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4f8f00"/><stop offset=".6" stop-color="#9AFF00"/><stop offset="1" stop-color="#eaffb8"/></linearGradient></defs>'
    + '<path d="M50 8 C60 24 78 34 74 60 C70 82 60 92 50 92 C40 92 30 82 26 60 C22 34 40 24 50 8 Z" fill="url(#'+u+'f)" stroke="#0a1403" stroke-width="1.6" stroke-linejoin="round"/>'
    + '<path d="M50 32 C56 42 62 52 58 66 C55 78 46 78 42 66 C40 58 46 52 50 32 Z" fill="#fff" opacity=".6"/>'
    + '<circle cx="60" cy="86" r="3" fill="#c6ff70"/>';
  if(a==='diamond') return '<defs><linearGradient id="'+u+'d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e7ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient></defs>'
    + '<path d="M10 34 L30 12 L70 12 L90 34 L50 92 Z" fill="url(#'+u+'d)" stroke="#0a1403" stroke-width="1.8" stroke-linejoin="round"/>'
    + '<path d="M10 34 L90 34 L50 92 Z" fill="#fff" opacity=".22"/>'
    + '<path d="M30 12 L38 34 L50 92 L62 34 L70 12" fill="none" stroke="#f4ffd6" stroke-width="1.6" opacity=".85"/>'
    + '<path d="M10 34 L38 34 M62 34 L90 34" stroke="#f4ffd6" stroke-width="1.6" opacity=".7" fill="none"/>'
    + '<path d="M18 22 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill="#fff" opacity=".9"/>';
  if(a==='lightning') return '<defs><linearGradient id="'+u+'l" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaffb8"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></linearGradient></defs>'
    + '<path d="M62 4 L18 60 L44 60 L36 96 L82 40 L54 40 Z" fill="url(#'+u+'l)" stroke="#0a1403" stroke-width="1.8" stroke-linejoin="round"/>'
    + '<path d="M56 14 L28 54 L46 54 L40 84" stroke="#fff" stroke-width="2.4" opacity=".55" fill="none" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="16" cy="30" r="2.4" fill="#c6ff70" opacity=".9"/>'
    + '<circle cx="88" cy="70" r="2.4" fill="#c6ff70" opacity=".9"/>';
  if(a==='moon') return '<defs><radialGradient id="'+u+'m" cx=".3" cy=".3" r=".8"><stop offset="0" stop-color="#f4ffd6"/><stop offset=".55" stop-color="#c6ff70"/><stop offset="1" stop-color="#5aa300"/></radialGradient></defs>'
    + '<path d="M64 8 A44 44 0 1 0 92 64 A34 34 0 1 1 64 8 Z" fill="url(#'+u+'m)" stroke="#0a1403" stroke-width="1.8" stroke-linejoin="round"/>'
    + '<circle cx="42" cy="42" r="4" fill="#5aa300" opacity=".6"/>'
    + '<circle cx="58" cy="60" r="3" fill="#5aa300" opacity=".55"/>'
    + '<circle cx="34" cy="66" r="2.5" fill="#5aa300" opacity=".5"/>'
    + '<path d="M84 18 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill="#fff" opacity=".95"/>';
  if(a==='sun') return '<defs><radialGradient id="'+u+'s" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#eaffb8"/><stop offset="1" stop-color="#9AFF00"/></radialGradient></defs>'
    + '<g stroke="#9AFF00" stroke-width="4.5" stroke-linecap="round">'
    + '<line x1="50" y1="4" x2="50" y2="18"/><line x1="50" y1="82" x2="50" y2="96"/>'
    + '<line x1="4" y1="50" x2="18" y2="50"/><line x1="82" y1="50" x2="96" y2="50"/>'
    + '<line x1="18" y1="18" x2="28" y2="28"/><line x1="72" y1="72" x2="82" y2="82"/>'
    + '<line x1="82" y1="18" x2="72" y2="28"/><line x1="18" y1="82" x2="28" y2="72"/></g>'
    + '<circle cx="50" cy="50" r="24" fill="url(#'+u+'s)" stroke="#0a1403" stroke-width="1.6"/>'
    + '<circle cx="42" cy="42" r="4" fill="#fff" opacity=".8"/>';
  if(a==='shield') return '<defs><linearGradient id="'+u+'h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></linearGradient></defs>'
    + '<path d="M50 6 L84 18 V52 C84 74 68 88 50 94 C32 88 16 74 16 52 V18 Z" fill="url(#'+u+'h)" stroke="#0a1403" stroke-width="2" stroke-linejoin="round"/>'
    + '<path d="M50 6 L84 18 V52 C84 74 68 88 50 94 Z" fill="#fff" opacity=".16"/>'
    + '<path d="M50 26 L58 46 H80 L62 58 L69 80 L50 68 L31 80 L38 58 L20 46 H42 Z" fill="#0a1403" opacity=".85"/>'
    + '<path d="M50 30 L56 44 L70 46 L58 55 L62 70 L50 62 Z" fill="#c6ff70"/>';
  if(a==='key') return '<defs><linearGradient id="'+u+'k" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaffb8"/><stop offset=".55" stop-color="#9AFF00"/><stop offset="1" stop-color="#5aa300"/></linearGradient></defs>'
    + '<circle cx="30" cy="30" r="20" fill="none" stroke="url(#'+u+'k)" stroke-width="8"/>'
    + '<circle cx="30" cy="30" r="8" fill="#0a1403"/>'
    + '<path d="M42 42 L88 88" stroke="url(#'+u+'k)" stroke-width="8" stroke-linecap="round"/>'
    + '<path d="M70 68 L82 68 L82 78" stroke="url(#'+u+'k)" stroke-width="8" stroke-linecap="round" fill="none"/>'
    + '<path d="M78 78 L88 78" stroke="url(#'+u+'k)" stroke-width="8" stroke-linecap="round"/>'
    + '<path d="M20 20 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 z" fill="#fff" opacity=".8"/>';
  if(a==='skull') return '<defs><radialGradient id="'+u+'k" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#eaffb8"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></radialGradient></defs>'
    + '<path d="M50 8 C74 8 90 26 90 48 C90 60 84 68 78 74 L78 84 C78 88 74 92 68 92 L32 92 C26 92 22 88 22 84 L22 74 C16 68 10 60 10 48 C10 26 26 8 50 8 Z" fill="url(#'+u+'k)" stroke="#0a1403" stroke-width="2" stroke-linejoin="round"/>'
    + '<ellipse cx="34" cy="52" rx="10" ry="12" fill="#0a1403"/>'
    + '<ellipse cx="66" cy="52" rx="10" ry="12" fill="#0a1403"/>'
    + '<circle cx="34" cy="52" r="3" fill="#c6ff70"/>'
    + '<circle cx="66" cy="52" r="3" fill="#c6ff70"/>'
    + '<path d="M42 74 L46 82 L50 74 L54 82 L58 74" stroke="#0a1403" stroke-width="4" fill="none" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<path d="M46 66 L50 72 L54 66 Z" fill="#0a1403"/>';
  if(a==='phoenix') return '<defs><linearGradient id="'+u+'p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eaffb8"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></linearGradient><linearGradient id="'+u+'w" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e4ff9e"/><stop offset="1" stop-color="#5aa300"/></linearGradient></defs>'
    + '<path d="M20 62 C10 42 22 20 40 22 C30 32 34 42 44 40 C34 54 42 66 50 60 C42 72 50 84 60 78 C50 88 62 92 68 84 C74 72 78 60 82 66 C88 54 82 40 72 42 C82 30 76 16 62 22 C56 8 44 8 40 22 Z" fill="url(#'+u+'w)" opacity=".85"/>'
    + '<path d="M50 12 C58 24 66 36 60 54 C55 68 44 68 40 54 C36 40 42 24 50 12 Z" fill="url(#'+u+'p)" stroke="#0a1403" stroke-width="1.6" stroke-linejoin="round"/>'
    + '<circle cx="48" cy="30" r="5" fill="#0a1403"/>'
    + '<circle cx="46" cy="28" r="1.6" fill="#c6ff70"/>'
    + '<path d="M50 60 C55 74 55 84 50 92 C45 84 45 74 50 60 Z" fill="#fff" opacity=".55"/>'
    + '<path d="M20 20 l1.8 4.4 4.4 1.8 -4.4 1.8 -1.8 4.4 -1.8 -4.4 -4.4 -1.8 4.4 -1.8 z" fill="#fff" opacity=".9"/>';
  if(a==='dragon') return '<defs><linearGradient id="'+u+'d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eaffb8"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></linearGradient></defs>'
    + '<path d="M14 82 C10 62 30 50 44 58 C56 40 78 42 82 60 C90 54 92 40 82 32 C68 40 62 30 66 18 C48 22 44 40 50 52 C34 46 20 60 22 74 Z" fill="url(#'+u+'d)" stroke="#0a1403" stroke-width="1.8" stroke-linejoin="round"/>'
    + '<path d="M66 18 L74 8 L70 22" fill="#c6ff70" stroke="#0a1403" stroke-width="1.4"/>'
    + '<circle cx="72" cy="34" r="3.5" fill="#0a1403"/>'
    + '<path d="M76 42 C82 44 88 42 90 38 C86 46 82 48 78 48" fill="#c6ff70"/>'
    + '<path d="M28 76 C32 68 36 74 32 82 M42 84 C46 76 50 82 46 90 M56 86 C60 78 64 84 60 92" stroke="#0a1403" stroke-width="1.4" fill="none"/>'
    + '<path d="M50 52 C56 50 62 54 62 60" stroke="#fff" stroke-width="2" opacity=".55" fill="none"/>';
  if(a==='giftbox') return '<defs><linearGradient id="'+u+'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4ff9e"/><stop offset=".5" stop-color="#9AFF00"/><stop offset="1" stop-color="#4f8f00"/></linearGradient></defs>'
    + '<rect x="12" y="40" width="76" height="52" rx="6" fill="url(#'+u+'g)" stroke="#0a1403" stroke-width="2"/>'
    + '<rect x="8" y="30" width="84" height="18" rx="4" fill="#6cba12" stroke="#0a1403" stroke-width="2"/>'
    + '<rect x="8" y="30" width="84" height="5" rx="2" fill="#fff" opacity=".28"/>'
    + '<rect x="44" y="30" width="12" height="62" fill="#0a1403"/>'
    + '<rect x="45" y="30" width="10" height="62" fill="#c6ff70"/>'
    + '<path d="M50 30 C42 18 26 18 30 30 M50 30 C58 18 74 18 70 30" fill="none" stroke="#0a1403" stroke-width="4"/>'
    + '<path d="M50 30 C42 18 26 18 30 30 M50 30 C58 18 74 18 70 30" fill="none" stroke="#c6ff70" stroke-width="2.4"/>';
  if(a==='nyeye') return '<defs><linearGradient id="'+u+'e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4ff9e"/><stop offset="1" stop-color="#9AFF00"/></linearGradient></defs>'
    + '<path d="M18 30 C34 12 66 12 82 30 C74 20 60 16 50 16 C40 16 26 20 18 30 Z" fill="#c81f2b"/>'
    + '<path d="M18 30 L82 30" stroke="#0a1403" stroke-width="2" fill="none"/>'
    + '<circle cx="72" cy="18" r="6" fill="#fff"/>'
    + '<path d="M18 54 Q50 32 82 54 Q50 78 18 54 Z" fill="url(#'+u+'e)" stroke="#0a1403" stroke-width="2"/>'
    + '<circle cx="50" cy="54" r="16" fill="#0a1403"/>'
    + '<circle cx="50" cy="54" r="12" fill="url(#'+u+'e)"/>'
    + '<circle cx="50" cy="54" r="6" fill="#0a1403"/>'
    + '<circle cx="46" cy="50" r="2.4" fill="#fff"/>'
    + '<circle cx="22" cy="88" r="3" fill="#c81f2b"/><circle cx="50" cy="92" r="3" fill="#4fd0ff"/><circle cx="78" cy="88" r="3" fill="#c6ff70"/>'
    + '<path d="M84 8 l1.8 4.4 4.4 1.8 -4.4 1.8 -1.8 4.4 -1.8 -4.4 -4.4 -1.8 4.4 -1.8 z" fill="#fff" opacity=".9"/>';
  return _vsGiftArtPrev(a, u);
};

/* --- детерминированная история продаж (последние 5 сделок) --- */
function vsPriceHistory(g){
  if(!g) return [];
  var seed = 0; for(var i=0;i<g.id.length;i++) seed = (seed*31 + g.id.charCodeAt(i)) >>> 0;
  function rnd(){ seed = (seed*1103515245 + 12345) & 0x7fffffff; return seed/0x7fffffff; }
  var base = g.price;
  var out = [];
  var now = Date.now();
  var day = 86400000;
  for(var k=0;k<5;k++){
    var delta = (rnd() - 0.42) * 0.45 * base;
    var p = Math.max(0.1, Math.round((base + delta)*100)/100);
    var ago = Math.round((0.4 + rnd() * 2.6 + k*3.2) * day);
    out.push({ price:p, at: now - ago });
  }
  out.sort(function(a,b){ return b.at - a.at; });
  return out;
}
function vsFloorPrice(g){
  var h = vsPriceHistory(g);
  var mn = h.length ? h[0].price : g.price;
  for(var i=0;i<h.length;i++) if(h[i].price < mn) mn = h[i].price;
  return Math.round(mn*100)/100;
}
function vsPriceChange(g){
  var h = vsPriceHistory(g);
  if(h.length < 2) return 0;
  var oldest = h[h.length-1].price;
  var newest = h[0].price;
  return Math.round(((newest - oldest)/oldest) * 1000) / 10; /* %, 1 знак */
}
function vsSparklineSvg(g, w, h){
  var hist = vsPriceHistory(g).slice().reverse();
  var vals = hist.map(function(x){ return x.price; });
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  var range = Math.max(0.001, mx - mn);
  var pad = 2;
  var pts = vals.map(function(v, i){
    var x = (i/(vals.length-1)) * (w-2*pad) + pad;
    var y = h - pad - ((v - mn)/range) * (h - 2*pad);
    return [x, y];
  });
  var d = pts.map(function(p, i){ return (i===0?'M':'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  var areaD = d + ' L' + (w-pad).toFixed(1) + ' ' + (h-pad).toFixed(1) + ' L' + pad + ' ' + (h-pad).toFixed(1) + ' Z';
  var last = pts[pts.length-1];
  return '<svg viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none"><path d="'+areaD+'" fill="rgba(0,152,234,.18)"/>'
    + '<path d="'+d+'" stroke="#4fd0ff" stroke-width="1.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="1.8" fill="#4fd0ff"/></svg>';
}
function vsFriendlyAgo(ts){
  var s = Math.max(0, Math.round((Date.now() - ts)/1000));
  if(s < 60) return s+'с';
  if(s < 3600) return Math.round(s/60)+'м';
  if(s < 86400) return Math.round(s/3600)+'ч';
  return Math.round(s/86400)+'д';
}

/* --- псевдо-owner для NFT --- */
var VS_OWNERS = ['Дарья К.','Иван М.','Артём Н.','Марина Р.','Кирилл Б.','София Т.','Ноа В.','Лев Ж.','Аня О.','Роман С.'];
function vsGiftOwner(g){
  var s = 0; for(var i=0;i<g.id.length;i++) s = (s*31 + g.id.charCodeAt(i)) >>> 0;
  return VS_OWNERS[s % VS_OWNERS.length];
}
function vsMintNumber(g){ return String(g.sold).padStart(5,'0'); }
function vsNftId(g){ return 'OKO-' + g.art.toUpperCase() + '-' + vsMintNumber(g); }

/* --- ссылка «TON viewer» (декоративная — реального выхода в сеть нет) --- */
function vsExplorerLink(kind, ref){
  var base = 'https://tonviewer.com/';
  if(kind === 'tx' && ref) return base + 'transaction/' + encodeURIComponent(ref);
  if(kind === 'addr' && ref) return base + encodeURIComponent(ref);
  return base;
}
function vsFakeTxHash(){
  var hex = '0123456789abcdef', s = '';
  for(var i=0;i<64;i++) s += hex[Math.floor(Math.random()*16)];
  return s;
}

/* --- Обратный отсчёт: HH:MM:SS форматирование --- */
function vsCountdown(endsAt){
  var ms = Math.max(0, endsAt - Date.now());
  var d = Math.floor(ms / 86400000);
  var h = Math.floor((ms % 86400000) / 3600000);
  var m = Math.floor((ms % 3600000) / 60000);
  var s = Math.floor((ms % 60000) / 1000);
  return { d:d, h:h, m:m, s:s, ms:ms };
}
function vsCdCells(cd, size){
  var pad = function(x){ return String(x).padStart(2,'0'); };
  return '<i><b>'+pad(cd.d)+'</b><s>дн</s></i>'
       + '<i><b>'+pad(cd.h)+'</b><s>час</s></i>'
       + '<i><b>'+pad(cd.m)+'</b><s>мин</s></i>'
       + '<i><b>'+pad(cd.s)+'</b><s>сек</s></i>';
}
/* глобальный тикер обратных отсчётов */
var VS_CD_TIMER = null;
function vsStartCdTicker(){
  if(VS_CD_TIMER) return;
  VS_CD_TIMER = setInterval(function(){
    document.querySelectorAll('[data-vs-cd]').forEach(function(el){
      var end = +el.getAttribute('data-vs-cd');
      if(!end) return;
      var cd = vsCountdown(end);
      el.innerHTML = vsCdCells(cd);
      if(cd.ms <= 0){ el.removeAttribute('data-vs-cd'); }
    });
  }, 1000);
}

/* --- события: активные лоты (Новый год и т.п.) --- */
function vsActiveEvents(){
  var out = [];
  VS_GIFTS.forEach(function(g){
    if(g.event && g.event.endsAt > Date.now()) out.push(g);
  });
  return out;
}

/* --- аукцион редкого (одиночный «Дракон») --- */
var VS_AUCTION = {
  giftId: 'dragon',
  currentBid: 42,
  bidders: 7,
  endsAt: Date.now() + 6*3600000 + 24*60000,
  bids: [
    { who:'Дарья К.', amt:42, at: Date.now() - 4*60000 },
    { who:'Артём Н.', amt:37, at: Date.now() - 25*60000 },
    { who:'Кирилл Б.', amt:32, at: Date.now() - 68*60000 },
    { who:'Марина Р.', amt:28, at: Date.now() - 130*60000 },
    { who:'Иван М.', amt:25, at: Date.now() - 210*60000 }
  ]
};
function vsAuctionCard(){
  var g = vsGiftById(VS_AUCTION.giftId); if(!g) return '';
  var cd = vsCountdown(VS_AUCTION.endsAt);
  return '<div class="vs-auction-hero" onclick="vsOpenAuction()">'
    + '<div class="vs-auction-row">'
      + '<div class="vs-auction-art">' + vsGiftSvg(g.art, 60) + '</div>'
      + '<div class="vs-auction-info">'
        + '<span class="vs-auction-tag">' + I('crown') + ' Аукцион</span>'
        + '<div class="vs-auction-name">' + esc(g.name) + '</div>'
        + '<div class="vs-auction-bid">' + vsGemMark(13) + ' Текущая ставка <b>' + vsTonFmt(VS_AUCTION.currentBid) + '</b> TON · ' + VS_AUCTION.bidders + ' участников</div>'
      + '</div>'
    + '</div>'
    + '<div class="vs-auction-cd" data-vs-cd="' + VS_AUCTION.endsAt + '">' + vsCdCells(cd) + '</div>'
  + '</div>';
}
function vsOpenAuction(){
  var v = document.getElementById('vsAuctionView'); if(!v) return;
  var g = vsGiftById(VS_AUCTION.giftId); if(!g) return;
  var cd = vsCountdown(VS_AUCTION.endsAt);
  var rar = vsRarity(g);
  var nextBid = Math.round((VS_AUCTION.currentBid + 5) * 100) / 100;
  var bidsH = VS_AUCTION.bids.map(function(b){
    return '<div class="vs-auc-bid-row"><span>' + esc(b.who) + ' · ' + vsFriendlyAgo(b.at) + ' назад</span><b>' + vsGemMark(11) + ' ' + vsTonFmt(b.amt) + '</b></div>';
  }).join('');
  v.innerHTML = ''
    + '<div class="vs-buy-art vs-rar-' + rar + '">' + vsGiftSvg(g.art, 120) + '<span class="vs-nft-shine"></span></div>'
    + '<div class="vs-buy-rar"><span class="vs-rar-chip vs-rar-' + rar + '">' + VS_RARITY_LABEL[rar] + '</span></div>'
    + '<h2 class="vs-auc-name">' + esc(g.name) + '</h2>'
    + '<div class="vs-auc-cur">Текущая ставка ' + vsGemMark(16) + '<b>' + vsTonFmt(VS_AUCTION.currentBid) + '</b> TON · ' + VS_AUCTION.bidders + ' участников</div>'
    + '<div class="vs-auc-cd-big" data-vs-cd="' + VS_AUCTION.endsAt + '">' + vsCdCells(cd) + '</div>'
    + '<div class="vs-auc-bids"><div class="vs-auc-bids-head">' + I('clock') + ' Последние ставки</div>' + bidsH + '</div>'
    + '<button class="btn vs-auc" style="width:100%" onclick="vsPlaceBid(5)">' + vsGemMark(15) + ' Поставить ' + vsTonFmt(nextBid) + ' TON (+5)</button>'
    + '<div class="vs-buy-note" style="margin-top:10px">' + I('lock') + ' По окончании таймера подарок уйдёт лидеру. Прототип: ставки локальные, реальный аукцион запускается в релизе.</div>';
  openSheet('vs-auction');
}
function vsPlaceBid(delta){
  var g = vsGiftById(VS_AUCTION.giftId); if(!g) return;
  var need = Math.round((VS_AUCTION.currentBid + (delta||5))*100)/100;
  if(VS_TON.balance < need){
    if(typeof showPopup==='function') showPopup({ ico:'money', title:'Не хватает TON',
      body:'Для ставки нужно ' + vsTonFmt(need) + ' TON. Пополни кошелёк и вернись — сумма спишется только если ты станешь победителем.',
      actions:[{label:'Пополнить TON', onclick:function(){ if(typeof closePopup==='function') closePopup(); vsOpenTopup(); }},{label:'Позже', ghost:true}] });
    return;
  }
  VS_AUCTION.currentBid = need;
  VS_AUCTION.bidders++;
  VS_AUCTION.bids.unshift({ who: (typeof PROFILE!=='undefined' && PROFILE.name) || 'Ты', amt: need, at: Date.now() });
  if(VS_AUCTION.bids.length > 8) VS_AUCTION.bids.length = 8;
  vsOpenAuction();
  toast('Ставка ' + vsTonFmt(need) + ' TON принята');
}

/* --- баннер события «Новый год» --- */
function vsEventBanner(){
  var acts = vsActiveEvents(); if(!acts.length) return '';
  var g = acts[0];
  var cd = vsCountdown(g.event.endsAt);
  return '<div class="vs-event-bnr" onclick="vsOpenBuy(\'' + g.id + '\')">'
    + '<div class="vs-event-art">' + vsGiftSvg(g.art, 44) + '</div>'
    + '<div class="vs-event-txt">'
      + '<span class="vs-event-tag">' + esc(g.event.label) + '</span>'
      + '<div class="vs-event-title">' + esc(g.name) + ' · доступен ограниченно</div>'
      + '<div class="vs-event-cd" data-vs-cd="' + g.event.endsAt + '">' + vsCdCells(cd) + '</div>'
    + '</div>'
  + '</div>';
}

/* --- Fly-to-friend анимация подарка --- */
function vsFlyToFriend(art, targetSelector){
  try{
    var host = document.body;
    var w = window.innerWidth, h = window.innerHeight;
    var target = null;
    if(targetSelector){ try{ target = document.querySelector(targetSelector); }catch(e){} }
    var tRect = target ? target.getBoundingClientRect() : null;
    var tx = tRect ? (tRect.left + tRect.width/2) : (w - 50);
    var ty = tRect ? (tRect.top + tRect.height/2) : (h - 50);
    var fly = document.createElement('div');
    fly.className = 'vs-fly';
    fly.style.setProperty('--fx', (w/2) + 'px');
    fly.style.setProperty('--fy', (h/2) + 'px');
    fly.style.setProperty('--tx', tx + 'px');
    fly.style.setProperty('--ty', ty + 'px');
    fly.innerHTML = vsGiftSvg(art, 90);
    host.appendChild(fly);
    /* хвостовые искры */
    var trails = 8;
    for(var k=0;k<trails;k++){
      (function(k){
        setTimeout(function(){
          var t = document.createElement('div');
          t.className = 'vs-fly-trail';
          var pr = k/trails;
          var x = (w/2) + (tx - w/2) * pr;
          var y = (h/2) + (ty - h/2) * pr - Math.sin(pr*Math.PI)*40;
          t.style.left = x + 'px'; t.style.top = y + 'px';
          host.appendChild(t);
          setTimeout(function(){ try{ t.remove(); }catch(e){} }, 700);
        }, 90 + k*70);
      })(k);
    }
    setTimeout(function(){ try{ fly.remove(); }catch(e){} }, 1000);
  }catch(e){}
}

/* --- 3D-carousel коллекции --- */
var VS_CAR_IDX = 0;
function vsOpenCarousel(){
  var owned = Object.keys(VS_TON.owned).filter(function(k){ return VS_TON.owned[k]>0; });
  if(!owned.length){ toast('Коллекция пуста'); return; }
  vsCloseCarousel();
  VS_CAR_IDX = 0;
  var wrap = document.createElement('div');
  wrap.className = 'vs-carousel';
  var items = owned.map(function(id, i){
    var g = vsGiftById(id); if(!g) return '';
    var rar = vsRarity(g);
    return '<div class="vs-carousel-item vs-rar-' + rar + '" data-i="' + i + '">'
      + vsGiftSvg(g.art, 120)
      + '<b>' + esc(g.name) + '</b>'
      + '<span>' + vsGemMark(11) + ' ' + vsTonFmt(g.price) + ' TON · ×' + (VS_TON.owned[id]||0) + '</span>'
    + '</div>';
  }).join('');
  var dots = owned.map(function(_, i){ return '<i class="' + (i===0?'on':'') + '"></i>'; }).join('');
  wrap.innerHTML = ''
    + '<button class="vs-carousel-close" onclick="vsCloseCarousel()" aria-label="Закрыть">' + (I('close')||'×') + '</button>'
    + '<div class="vs-carousel-stage"><div class="vs-carousel-track" id="vsCarTrack">' + items + '</div></div>'
    + '<div class="vs-carousel-nav">'
      + '<button onclick="vsCarStep(-1)" aria-label="Назад">' + I('chev') + '</button>'
      + '<button onclick="vsCarStep(1)" aria-label="Вперёд" style="transform:rotate(180deg)">' + I('chev') + '</button>'
    + '</div>'
    + '<div class="vs-carousel-dots" id="vsCarDots">' + dots + '</div>';
  document.body.appendChild(wrap);
  requestAnimationFrame(function(){ wrap.classList.add('on'); vsCarLayout(); });
  /* autoplay */
  wrap._vsAutoTimer = setInterval(function(){
    if(!wrap.parentNode){ clearInterval(wrap._vsAutoTimer); return; }
    vsCarStep(1);
  }, 3200);
}
function vsCloseCarousel(){
  document.querySelectorAll('.vs-carousel').forEach(function(el){
    if(el._vsAutoTimer) clearInterval(el._vsAutoTimer);
    el.classList.remove('on');
    setTimeout(function(){ try{ el.remove(); }catch(e){} }, 260);
  });
}
function vsCarLayout(){
  var track = document.getElementById('vsCarTrack'); if(!track) return;
  var items = track.querySelectorAll('.vs-carousel-item');
  var n = items.length;
  var angStep = 360 / n;
  var radius = Math.max(180, Math.min(240, 60 * n));
  track.style.transform = 'translateZ(-' + radius + 'px) rotateY(' + (-VS_CAR_IDX * angStep) + 'deg)';
  items.forEach(function(el, i){
    el.style.transform = 'rotateY(' + (i * angStep) + 'deg) translateZ(' + radius + 'px)';
  });
  var dots = document.querySelectorAll('#vsCarDots i');
  dots.forEach(function(d, i){ d.classList.toggle('on', ((i - VS_CAR_IDX) % n + n) % n === 0); });
}
function vsCarStep(dir){
  var track = document.getElementById('vsCarTrack'); if(!track) return;
  var n = track.querySelectorAll('.vs-carousel-item').length; if(!n) return;
  VS_CAR_IDX = (VS_CAR_IDX + dir + n) % n;
  vsCarLayout();
}

/* --- Биржа/Marketplace --- */
function vsOpenMarket(){
  var v = document.getElementById('vsMarketView'); if(!v) return;
  var rows = VS_GIFTS.slice().sort(function(a,b){ return vsFloorPrice(a) - vsFloorPrice(b); }).map(function(g){
    var floor = vsFloorPrice(g);
    var chg = vsPriceChange(g);
    var chgCls = chg >= 0 ? 'up' : '';
    var chgS = (chg >= 0 ? '+' : '') + chg.toFixed(1) + '%';
    var rar = vsRarity(g);
    return '<div class="vs-mrkt-row" onclick="vsOpenOffers(\'' + g.id + '\')">'
      + vsGiftSvg(g.art, 44)
      + '<div class="vs-mrkt-info">'
        + '<div class="vs-mrkt-name">' + esc(g.name) + '<span class="vs-rar-chip vs-rar-' + rar + ' vs-mrkt-rar">' + VS_RARITY_LABEL[rar] + '</span></div>'
        + '<div class="vs-mrkt-floor">Флор ' + vsGemMark(10) + ' <b>' + vsTonFmt(floor) + '</b> · <s class="' + chgCls + '">' + chgS + '</s> · <span>' + (g.supply - g.sold).toLocaleString('ru-RU') + ' в продаже</span></div>'
      + '</div>'
      + '<div class="vs-mrkt-spark">' + vsSparklineSvg(g, 64, 28) + '</div>'
      + '<div class="vs-mrkt-cta">' + I('chev') + '</div>'
    + '</div>';
  }).join('');
  v.innerHTML = ''
    + '<div class="vs-market-head"><div><div class="vs-market-title">FLOOR PRICE · 24H</div><div class="vs-market-sub">Живые ордера покупки/продажи между пользователями</div></div></div>'
    + '<div class="vs-mrkt-list">' + rows + '</div>'
    + '<div class="vs-buy-note" style="margin-top:14px">' + I('lock') + ' Прототип: ордера моковые для демонстрации UX. Полноценная P2P-биржа NFT-подарков — в релизе.</div>';
  openSheet('vs-market');
}
function vsOpenOffers(giftId){
  var v = document.getElementById('vsOffersView'); if(!v) return;
  var g = vsGiftById(giftId); if(!g) return;
  var floor = vsFloorPrice(g);
  /* 4-6 фейковых офферов от других юзеров */
  var seed = 0; for(var i=0;i<g.id.length;i++) seed = (seed*31 + g.id.charCodeAt(i)) >>> 0;
  function rnd(){ seed = (seed*1103515245 + 12345) & 0x7fffffff; return seed/0x7fffffff; }
  var offers = [];
  var n = 4 + Math.floor(rnd() * 3);
  for(var k=0;k<n;k++){
    var who = VS_OWNERS[Math.floor(rnd() * VS_OWNERS.length)];
    var isBid = rnd() > 0.5;
    var mult = isBid ? (0.72 + rnd() * 0.25) : (1.05 + rnd() * 0.35);
    var price = Math.max(0.1, Math.round(g.price * mult * 100) / 100);
    offers.push({ who: who, price: price, kind: isBid ? 'bid' : 'ask' });
  }
  offers.sort(function(a,b){ return b.price - a.price; });
  var bidsH = offers.filter(function(o){ return o.kind==='bid'; }).map(function(o, i){
    return '<div class="vs-off-row"><div class="vs-off-who"><span class="vs-off-ava">' + esc(o.who[0]) + '</span><div>' + esc(o.who) + '<small>Оффер · ' + Math.round((1 - o.price/g.price) * 100) + '% ниже цены</small></div></div>'
      + '<div class="vs-off-price">' + vsGemMark(11) + ' ' + vsTonFmt(o.price) + '</div>'
      + '<div class="vs-off-actions"><button class="vs-off-btn accept" onclick="vsAcceptOffer(\'' + g.id + '\',' + o.price + ')">Принять</button></div></div>';
  }).join('');
  var asksH = offers.filter(function(o){ return o.kind==='ask'; }).map(function(o){
    return '<div class="vs-off-row"><div class="vs-off-who"><span class="vs-off-ava">' + esc(o.who[0]) + '</span><div>' + esc(o.who) + '<small>Ордер на продажу</small></div></div>'
      + '<div class="vs-off-price">' + vsGemMark(11) + ' ' + vsTonFmt(o.price) + '</div>'
      + '<div class="vs-off-actions"><button class="vs-off-btn accept" onclick="vsBuyFromOrder(\'' + g.id + '\',' + o.price + ')">Купить</button></div></div>';
  }).join('');
  v.innerHTML = ''
    + '<div class="vs-off-head">' + vsGiftSvg(g.art, 44) + '<div><b>' + esc(g.name) + '</b><small>Флор ' + vsTonFmt(floor) + ' TON · ' + (g.supply - g.sold).toLocaleString('ru-RU') + ' доступно</small></div></div>'
    + '<div class="vs-price-hist-head" style="margin:6px 0 4px">' + I('clock') + ' ОРДЕРА ПОКУПКИ (BIDS)</div>'
    + (bidsH || '<div class="vs-off-row"><span style="color:var(--dim);font-size:12px;padding:8px 0">Нет активных офферов</span></div>')
    + '<div class="vs-price-hist-head" style="margin:16px 0 4px">' + I('sticker') + ' ОРДЕРА НА ПРОДАЖУ (ASKS)</div>'
    + (asksH || '<div class="vs-off-row"><span style="color:var(--dim);font-size:12px;padding:8px 0">Нет активных ордеров</span></div>')
    + '<div class="vs-buy-note" style="margin-top:14px">' + I('lock') + ' Прототип: биржа моковая. В релизе — P2P-мэтчинг с эскроу в TON.</div>';
  openSheet('vs-offers');
}
function vsAcceptOffer(giftId, price){
  var g = vsGiftById(giftId); if(!g) return;
  var own = VS_TON.owned[giftId] || 0;
  if(own <= 0){ toast('Подарка нет в коллекции'); return; }
  VS_TON.owned[giftId]--; if(VS_TON.owned[giftId] <= 0) delete VS_TON.owned[giftId];
  VS_TON.balance = Math.round((VS_TON.balance + price * 0.95) * 100) / 100; /* -5% комиссия площадки */
  VS_TON.tx.unshift({ t:'+', ton:Math.round(price * 0.95 * 100) / 100, why:'Продажа · '+g.name+' (комиссия 5%)', at:Date.now(), hash:vsFakeTxHash() });
  if(VS_TON.tx.length > 200) VS_TON.tx.length = 200;
  vsTonSave();
  closeSheet();
  toast('Продано за ' + vsTonFmt(price * 0.95) + ' TON');
  vsTonBurst();
  vsRenderTon();
}
function vsBuyFromOrder(giftId, price){
  var g = vsGiftById(giftId); if(!g) return;
  if(VS_TON.balance < price){
    if(typeof showPopup==='function') showPopup({ ico:'money', title:'Не хватает TON',
      body:'Нужно ' + vsTonFmt(price) + ' TON. Пополни кошелёк.', actions:[{label:'Пополнить', onclick:function(){ if(typeof closePopup==='function') closePopup(); vsOpenTopup(); }},{label:'Позже', ghost:true}] });
    return;
  }
  VS_TON.balance = Math.round((VS_TON.balance - price) * 100) / 100;
  VS_TON.owned[giftId] = (VS_TON.owned[giftId] || 0) + 1;
  VS_TON.tx.unshift({ t:'-', ton:price, why:'Покупка с биржи · '+g.name, at:Date.now(), hash:vsFakeTxHash() });
  if(VS_TON.tx.length > 200) VS_TON.tx.length = 200;
  vsTonSave();
  closeSheet();
  toast('Куплено с биржи · ' + g.name);
  vsTonBurst();
  vsRenderTon();
}

/* --- NFT-детали (открываются кликом по «Данные NFT» в шите покупки/подарка) --- */
function vsOpenNft(giftId){
  var v = document.getElementById('vsNftView'); if(!v) return;
  var g = vsGiftById(giftId); if(!g) return;
  var nftId = vsNftId(g);
  var owner = vsGiftOwner(g);
  var isMine = (VS_TON.owned[g.id] || 0) > 0;
  var addr = g.contract;
  var explorerUrl = vsExplorerLink('addr', addr);
  v.innerHTML = ''
    + '<div class="vs-buy-art">' + vsGiftSvg(g.art, 100) + '</div>'
    + '<h2 class="vs-buy-name" style="font-size:18px">' + esc(g.name) + '</h2>'
    + '<div class="vs-nft-rows">'
      + '<div class="vs-nft-row"><span>NFT ID</span><b>' + esc(nftId) + '</b></div>'
      + '<div class="vs-nft-row"><span>Chain</span><b class="ok">TON Mainnet</b></div>'
      + '<div class="vs-nft-row"><span>Стандарт</span><b>TIP-4 / NFT Item</b></div>'
      + '<div class="vs-nft-row"><span>Коллекция</span><b>' + esc(addr.slice(0,6) + '…' + addr.slice(-4)) + '</b></div>'
      + '<div class="vs-nft-row"><span>Владелец</span><b>' + (isMine ? ((typeof PROFILE!=='undefined' && PROFILE.name) || 'Ты') + ' (ты)' : esc(owner)) + '</b></div>'
      + '<div class="vs-nft-row"><span>Минт #</span><b>' + vsMintNumber(g) + ' из ' + g.supply.toLocaleString('ru-RU') + '</b></div>'
      + '<div class="vs-nft-row"><span>Transferable</span><b class="ok">Да</b></div>'
      + '<div class="vs-nft-row"><span>Роялти автору</span><b>' + g.royalty + '%</b></div>'
    + '</div>'
    + '<a class="vs-explorer-btn" href="' + explorerUrl + '" target="_blank" rel="noopener">' + I('share') + ' Открыть в TON viewer</a>'
    + '<div class="vs-buy-note" style="margin-top:10px">' + I('lock') + ' Данные NFT — контракт-заглушка прототипа. В релизе адреса будут настоящими TIP-4-контрактами в сети TON.</div>';
  openSheet('vs-nft');
}

/* --- 3D-preview (drag rotate) --- */
function vs3dInit(host){
  if(!host || host._vs3d) return;
  host._vs3d = true;
  var el = host.querySelector('.vs-3d-inner'); if(!el) return;
  var rx = 8, ry = -14, dragging = false, sx = 0, sy = 0, srx = 0, sry = 0, t = 0;
  var apply = function(){ el.style.transform = 'rotateX(' + rx.toFixed(1) + 'deg) rotateY(' + ry.toFixed(1) + 'deg)'; };
  apply();
  var start = function(e){ dragging = true; var pt = e.touches ? e.touches[0] : e; sx = pt.clientX; sy = pt.clientY; srx = rx; sry = ry; };
  var move = function(e){ if(!dragging) return; var pt = e.touches ? e.touches[0] : e; ry = sry + (pt.clientX - sx) * 0.55; rx = srx - (pt.clientY - sy) * 0.55; apply(); if(e.cancelable && e.touches) e.preventDefault(); };
  var end = function(){ dragging = false; };
  host.addEventListener('mousedown', start);
  host.addEventListener('touchstart', start, {passive:true});
  window.addEventListener('mousemove', move);
  window.addEventListener('touchmove', move, {passive:false});
  window.addEventListener('mouseup', end);
  window.addEventListener('touchend', end);
  /* idle-вращение — тонкая амплитуда */
  var raf = function(){
    if(!host.isConnected) return;
    if(!dragging){ t += 0.008; ry += Math.cos(t) * 0.35; rx = 8 + Math.sin(t*.7) * 3; apply(); }
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

/* ---------- патч vsOpenBuy: 3D-preview, история продаж, NFT-плашка ---------- */
var _vsOpenBuyPrev = vsOpenBuy;
vsOpenBuy = function(id){
  _vsOpenBuyPrev(id);
  var g = vsGiftById(id); if(!g) return;
  var v = document.getElementById('vsBuyView'); if(!v) return;
  var rar = vsRarity(g);
  var floor = vsFloorPrice(g);
  var chg = vsPriceChange(g);
  var chgCls = chg >= 0 ? 'up' : 'dn';
  var chgS = (chg >= 0 ? '+' : '') + chg.toFixed(1) + '%';
  /* заменяем стандартный vs-buy-art на 3D-stage */
  var art = v.querySelector('.vs-buy-art');
  if(art && !art.classList.contains('vs-3d-injected')){
    var inner = art.innerHTML;
    var newArt = '<div class="vs-3d-stage vs-rar-' + rar + '" id="vsBuy3d"><div class="vs-3d-inner"><div class="vs-3d-face"></div>' + inner + '</div></div>'
      + '<div class="vs-3d-hint">' + I('bolt') + ' Крути пальцем — 3D-превью</div>';
    art.outerHTML = newArt;
    var stage = document.getElementById('vsBuy3d');
    if(stage) vs3dInit(stage);
  }
  /* мета-плашка: floor / owners / minted */
  var metaHtml = ''
    + '<div class="vs-meta-grid">'
      + '<div class="vs-meta-cell floor"><b>' + vsGemMark(12) + ' ' + vsTonFmt(floor) + '</b><small>Floor · <span class="' + chgCls + '" style="color:' + (chg>=0?'var(--lime)':'#ff9db0') + '">' + chgS + '</span></small></div>'
      + '<div class="vs-meta-cell owners"><b>' + g.sold.toLocaleString('ru-RU') + ' / ' + g.supply.toLocaleString('ru-RU') + '</b><small>Minted · ' + Math.round(g.sold*100/g.supply) + '%</small></div>'
    + '</div>';
  /* история продаж */
  var hist = vsPriceHistory(g);
  var histH = ''
    + '<div class="vs-price-hist">'
      + '<div class="vs-price-hist-head">' + I('clock') + ' ПОСЛЕДНИЕ ПРОДАЖИ<span class="vs-hist-spark">' + vsSparklineSvg(g, 64, 20) + '</span></div>'
      + '<div class="vs-price-hist-list">'
        + hist.map(function(x, i){
          var prev = hist[i+1] ? hist[i+1].price : x.price;
          var up = x.price > prev, dn = x.price < prev;
          return '<div class="vs-price-hist-row"><span>' + vsFriendlyAgo(x.at) + ' назад · ' + esc(VS_OWNERS[(i + g.id.length) % VS_OWNERS.length]) + '</span>'
            + '<b class="' + (up?'up':dn?'dn':'') + '">' + vsGemMark(10) + ' ' + vsTonFmt(x.price) + '</b></div>';
        }).join('')
      + '</div>'
    + '</div>';
  /* NFT-плашка */
  var nftH = '<div class="vs-nft-card" onclick="vsOpenNft(\'' + g.id + '\')">'
    + '<div class="vs-nft-mark">' + I('lock') + '</div>'
    + '<div class="vs-nft-info"><b>' + esc(vsNftId(g)) + '</b><small>TON · TIP-4 · transferable</small></div>'
    + '<div class="vs-nft-link">Данные ' + I('chev') + '</div>'
  + '</div>';
  /* вставляем мета/историю/NFT перед note+action */
  var note = v.querySelector('.vs-buy-note');
  if(note && !v.querySelector('.vs-meta-grid')){
    var block = document.createElement('div');
    block.innerHTML = metaHtml + histH + nftH;
    while(block.firstChild) note.parentNode.insertBefore(block.firstChild, note);
  }
};

/* ---------- патч vsOpenGift: добавляем 3D-preview, NFT-плашку, оффер-биржу ---------- */
var _vsOpenGiftPrev = vsOpenGift;
vsOpenGift = function(id){
  _vsOpenGiftPrev(id);
  var v = document.getElementById('vsGiftView'); if(!v) return;
  var g = vsGiftById(vsGiftDetailId); if(!g) return;
  var art = v.querySelector('.vs-buy-art');
  if(art && !art.classList.contains('vs-3d-injected')){
    var inner = art.innerHTML;
    art.outerHTML = '<div class="vs-3d-stage" id="vsGift3d"><div class="vs-3d-inner"><div class="vs-3d-face"></div>' + inner + '</div></div>'
      + '<div class="vs-3d-hint">' + I('bolt') + ' Крути пальцем — 3D-превью</div>';
    var stage = document.getElementById('vsGift3d');
    if(stage) vs3dInit(stage);
  }
  /* NFT-плашка + «На биржу» */
  if(!v.querySelector('.vs-nft-card')){
    var extra = document.createElement('div');
    extra.innerHTML = ''
      + '<div class="vs-nft-card" onclick="vsOpenNft(\'' + g.id + '\')">'
        + '<div class="vs-nft-mark">' + I('lock') + '</div>'
        + '<div class="vs-nft-info"><b>' + esc(vsNftId(g)) + '</b><small>TON · TIP-4 · твой NFT</small></div>'
        + '<div class="vs-nft-link">Данные ' + I('chev') + '</div>'
      + '</div>'
      + '<button class="btn ghost" style="width:100%;margin-top:8px" onclick="vsOpenOffers(\'' + g.id + '\')">' + I('sticker') + ' Офферы и биржа</button>';
    v.appendChild(extra);
  }
};

/* ---------- патч vsSendGift: fly-to-friend анимация ---------- */
var _vsSendGiftPrev = vsSendGift;
vsSendGift = function(giftId, chatId){
  var g = vsGiftById(giftId);
  var art = g ? g.art : 'crystal';
  _vsSendGiftPrev(giftId, chatId);
  /* после переключения в чат — запустить fly к иконке кошелька или к аватарке шапки */
  setTimeout(function(){
    vsFlyToFriend(art, '#convAva, .conv-head .ava, [data-icon="chats"]');
  }, 220);
};

/* ---------- патч vsRenderTon: баннер события, аукцион, кнопка биржи, 3D-carousel ---------- */
var _vsRenderTonPrev = vsRenderTon;
vsRenderTon = function(){
  _vsRenderTonPrev();
  var root = document.getElementById('vsTonRoot'); if(!root) return;
  /* Заменяем 4 колонки на 5 (добавляем «Биржа») */
  var actsRow = root.querySelector('.vs-ton-acts');
  if(actsRow && !actsRow.querySelector('.vs-ton-act-market')){
    actsRow.classList.add('vs-acts-5');
    var btn = document.createElement('button');
    btn.className = 'vs-ton-act ghost vs-ton-act-market';
    btn.onclick = vsOpenMarket;
    btn.innerHTML = '<svg class="i"><use href="#i-sticker"/></svg><span>Биржа</span>';
    /* вставляем перед «История» (последний) */
    var last = actsRow.lastElementChild;
    if(last) actsRow.insertBefore(btn, last); else actsRow.appendChild(btn);
  }
  /* Магазин: перед .vs-gshop вставляем баннер события и аукцион */
  if(VS_TON_TAB === 'shop'){
    var gshop = root.querySelector('.vs-gshop');
    if(gshop && !root.querySelector('.vs-event-bnr')){
      var evH = vsEventBanner();
      if(evH){ var wrap = document.createElement('div'); wrap.innerHTML = evH; gshop.parentNode.insertBefore(wrap.firstChild, gshop); }
    }
    if(gshop && !root.querySelector('.vs-auction-hero')){
      var aucH = vsAuctionCard();
      if(aucH){ var wrap2 = document.createElement('div'); wrap2.innerHTML = aucH; gshop.parentNode.insertBefore(wrap2.firstChild, gshop); }
    }
    /* блок наборов стикеров под магазином */
    if(gshop && !root.querySelector('.vs-packs-hero')){
      var pk = document.createElement('div');
      pk.innerHTML = ''
        + '<div class="vs-packs-hero" onclick="vsOpenPacks()">'
          + '<div class="vs-packs-hero-ic">' + I('sticker') + '</div>'
          + '<div class="vs-packs-hero-txt"><b>Наборы стикеров OKO</b><small>Коллекции для чатов · тап в чате открывает палитру</small></div>'
          + '<div class="vs-packs-hero-cta">' + I('chev') + '</div>'
        + '</div>';
      gshop.parentNode.insertBefore(pk.firstChild, gshop.nextSibling);
    }
  } else if(VS_TON_TAB === 'mine'){
    /* коллекция: кнопка «Смотреть в 3D-карусели» */
    var mineEmpty = root.querySelector('.vs-mine-empty');
    if(!mineEmpty && !root.querySelector('.vs-mine-carousel-btn')){
      var carBtn = document.createElement('button');
      carBtn.className = 'vs-mine-carousel-btn';
      carBtn.onclick = vsOpenCarousel;
      carBtn.innerHTML = I('rocket') + ' 3D-карусель коллекции';
      var tabs = root.querySelector('.vs-ton-tabs');
      if(tabs) tabs.parentNode.insertBefore(carBtn, tabs.nextSibling);
    }
  }
  vsStartCdTicker();
};

/* ---------- патч vsRenderHist: TON viewer link ---------- */
var _vsRenderHistPrev = vsRenderHist;
vsRenderHist = function(){
  _vsRenderHistPrev();
  var v = document.getElementById('vsHistView'); if(!v) return;
  var tx = VS_TON.tx || [];
  v.querySelectorAll('.vs-hist-row').forEach(function(row, i){
    if(row.querySelector('.vs-hist-explorer')) return;
    var x = tx[i]; if(!x) return;
    if(!x.hash) x.hash = vsFakeTxHash();
    var why = row.querySelector('.vs-hist-why');
    if(!why) return;
    var link = document.createElement('a');
    link.href = vsExplorerLink('tx', x.hash);
    link.target = '_blank'; link.rel = 'noopener';
    link.className = 'vs-hist-explorer';
    link.innerHTML = I('share') + ' Explorer';
    link.onclick = function(e){ e.stopPropagation(); };
    /* добавляем как small-строку под причиной */
    var small = why.querySelector('small');
    if(small){
      var wrap = document.createElement('div');
      wrap.style.display = 'flex'; wrap.style.gap = '8px'; wrap.style.alignItems = 'center'; wrap.style.marginTop = '4px';
      wrap.appendChild(link);
      why.appendChild(wrap);
    }
  });
};

/* ---------- STICKER PACKS: 4 набора, каждый — 6 стикеров с бренд-артом ---------- */
var VS_STK_PACKS = [
  { id:'neon',   name:'Неон OKO',      price:120, headIco:'bolt',   ics:['bolt','rocket','fire','crown','logo','star'] },
  { id:'winter', name:'Зимний',        price:80,  headIco:'star',   ics:['star','check','heart','wow','laugh','thumb'] },
  { id:'meme',   name:'Мемы',          price:60,  headIco:'laugh',  ics:['laugh','wow','sad','thumb','heart','fire'] },
  { id:'cosmos', name:'Космос',        price:150, headIco:'rocket', ics:['rocket','crown','bolt','logo','star','check'] }
];
function vsPacksOwned(){ return (VS_TON.packs && VS_TON.packs.slice()) || []; }
function vsPacksHas(id){ return vsPacksOwned().indexOf(id) >= 0; }
function vsOpenPacks(){
  var v = document.getElementById('vsPacksView'); if(!v) return;
  var cards = VS_STK_PACKS.map(function(p){
    var preview = p.ics.slice(0,6).map(function(ic){ return vsBaseSvg(ic, 38); }).join('');
    var owned = vsPacksHas(p.id);
    return '<div class="vs-pack-card" onclick="vsOpenPack(\'' + p.id + '\')">'
      + (owned ? '<span class="vs-pack-owned">В коллекции</span>' : '')
      + '<div class="vs-pack-preview">' + preview + '</div>'
      + '<div class="vs-pack-name">' + esc(p.name) + '</div>'
      + '<div class="vs-pack-meta"><span>' + p.ics.length + ' стикеров</span><b>' + vsGemMark(10) + ' ' + vsTonFmt(p.price/320) + '</b></div>'
    + '</div>';
  }).join('');
  v.innerHTML = '<div class="vs-packs-list">' + cards + '</div>'
    + '<div class="vs-buy-note" style="margin-top:14px">' + I('lock') + ' Приобретённые наборы появляются отдельной секцией в палитре стикеров чата — тап на стикер отправляет его собеседнику.</div>';
  openSheet('vs-packs');
}
function vsOpenPack(id){
  var p = null;
  for(var i=0;i<VS_STK_PACKS.length;i++) if(VS_STK_PACKS[i].id===id){ p = VS_STK_PACKS[i]; break; }
  if(!p) return;
  var v = document.getElementById('vsPackView'); if(!v) return;
  var owned = vsPacksHas(id);
  var priceTon = p.price/320;
  var grid = p.ics.map(function(ic){ return '<button>' + vsBaseSvg(ic, 52) + '</button>'; }).join('');
  var actH = owned
    ? '<button class="btn ghost" style="width:100%" onclick="closeSheet()">Уже в коллекции</button>'
    : '<button class="btn vs-ton" style="width:100%" onclick="vsBuyPack(\'' + p.id + '\')">' + vsGemMark(15) + ' Купить за ' + vsTonFmt(priceTon) + ' TON</button>';
  v.innerHTML = ''
    + '<div class="vs-pack-detail-head"><b>' + esc(p.name) + '</b><small>' + p.ics.length + ' фирменных стикеров OKO</small></div>'
    + '<div class="vs-pack-detail-grid">' + grid + '</div>'
    + actH
    + '<div class="vs-buy-note" style="margin-top:10px">' + I('lock') + ' Стикеры этого набора будут доступны в палитре чата в секции «' + esc(p.name) + '».</div>';
  openSheet('vs-pack');
}
function vsBuyPack(id){
  var p = null;
  for(var i=0;i<VS_STK_PACKS.length;i++) if(VS_STK_PACKS[i].id===id){ p = VS_STK_PACKS[i]; break; }
  if(!p) return;
  var priceTon = Math.round((p.price/320) * 100) / 100;
  if(VS_TON.balance < priceTon){
    if(typeof showPopup==='function') showPopup({ ico:'money', title:'Не хватает TON',
      body:'Нужно ' + vsTonFmt(priceTon) + ' TON. Пополни кошелёк.', actions:[{label:'Пополнить', onclick:function(){ if(typeof closePopup==='function') closePopup(); vsOpenTopup(); }},{label:'Позже', ghost:true}] });
    return;
  }
  VS_TON.packs = vsPacksOwned();
  VS_TON.packs.push(p.id);
  VS_TON.balance = Math.round((VS_TON.balance - priceTon) * 100) / 100;
  VS_TON.tx.unshift({ t:'-', ton:priceTon, why:'Набор стикеров · ' + p.name, at:Date.now(), hash:vsFakeTxHash() });
  if(VS_TON.tx.length > 200) VS_TON.tx.length = 200;
  vsTonSave();
  closeSheet();
  toast('Набор «' + p.name + '» в коллекции');
  vsTonBurst();
}

/* ---------- патч openStickers: показать секции купленных пакетов ---------- */
var _vsOpenStickers2 = openStickers;
openStickers = function(){
  _vsOpenStickers2();
  var grid = document.getElementById('stickersGrid'); if(!grid) return;
  var owned = vsPacksOwned();
  owned.forEach(function(pid){
    var p = null;
    for(var i=0;i<VS_STK_PACKS.length;i++) if(VS_STK_PACKS[i].id===pid){ p = VS_STK_PACKS[i]; break; }
    if(!p) return;
    if(grid.querySelector('[data-pack="' + pid + '"]')) return;
    var head = document.createElement('div');
    head.className = 'vs-pack-sec-head'; head.setAttribute('data-pack', pid);
    head.innerHTML = '<svg class="i"><use href="#i-' + p.headIco + '"/></svg>' + esc(p.name).toUpperCase() + '<span class="vs-pack-sec-tag">КУПЛЕНО</span>';
    grid.appendChild(head);
    p.ics.forEach(function(ic){
      var b = document.createElement('button');
      b.className = 'stk-btn';
      b.setAttribute('data-pack-sticker', pid + ':' + ic);
      b.onclick = function(){ vsSendPackSticker(ic, p.name); };
      b.innerHTML = vsBaseSvg(ic, 58) + '<small>' + p.name + '</small>';
      grid.appendChild(b);
    });
  });
};
function vsSendPackSticker(ic, packName){
  if(typeof currentChat === 'undefined' || !currentChat){ toast('Открой чат для отправки'); return; }
  /* добавляем стикер как обычное сообщение с иконкой (используем формат sticker + fake index) */
  closeSheet();
  var idx = -1;
  for(var i=0;i<STICKERS.length;i++) if(STICKERS[i].ic === ic && STICKERS[i].pack !== 'ton'){ idx = i; break; }
  if(idx >= 0){
    if(typeof sendSticker === 'function') sendSticker(idx);
    else if(typeof pushMsg === 'function') pushMsg({in:0, t:(typeof nowT==='function'?nowT():''), kind:'sticker', stk:idx});
  } else {
    /* fallback: как текст */
    if(typeof pushMsg === 'function') pushMsg({in:0, t:(typeof nowT==='function'?nowT():''), kind:'text', text:'Стикер · ' + packName});
  }
  vsStickerSpark();
}

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
  /* короткий заголовок «TON» — не режется на 390px (было «TON Подарки» → «TON Подар…») */
  try{ if(typeof regTitle === 'function') regTitle('ton', 'TON'); }catch(e){}
  /* тайл хаба — фирменный лайм как у всех тайлов (bg/fg по умолчанию: var(--lime-dim)/var(--accent)).
     Синяя айдентика TON остаётся ВНУТРИ экрана TON, но плитка хаба единообразна с сеткой. */
  try{ if(typeof addSvcTile === 'function') addSvcTile({ id:'ton', label:'TON Подарки', ico:'vs-gem', onclick:()=>{ if(typeof showTab==='function') showTab('ton'); } }); }catch(e){}
  const scr = document.getElementById('screen-ton');
  if(scr && scr.classList.contains('active')) vsRenderTon();
  /* глобальный таймер countdown-элементов (событие + аукцион) */
  vsStartCdTicker();
})();
