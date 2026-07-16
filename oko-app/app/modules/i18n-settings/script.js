/* ================= I18N-SETTINGS: язык интерфейса RU/EN + авто-перевод чатов =================
   Префикс st-. Опирается на i18n-ядро core-ext: LANG, regT, t, onLangChange, setLang, regTitle. */

/* ---------- состояние модуля ---------- */
const ST_STATE = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-i18n-settings'))||{}; }catch(e){ return {}; } })();
if(typeof ST_STATE.auto !== 'boolean') ST_STATE.auto = false;
function stSave(){ try{ localStorage.setItem('oko-i18n-settings', JSON.stringify(ST_STATE)); }catch(e){} }

/* ---------- словарь хрома (регистрация в i18n-ядре) ---------- */
regT({
  /* вкладки нижней навигации */
  'st.nav.feed':    {ru:'Лента',        en:'Feed'},
  'st.nav.chats':   {ru:'Чаты',         en:'Chats'},
  'st.nav.mini':    {ru:'Мини-аппы',    en:'Hub'},
  'st.nav.wallet':  {ru:'Кошелёк',      en:'Wallet'},
  'st.nav.profile': {ru:'Профиль',      en:'Profile'},
  /* заголовки экранов (TITLES) */
  'st.title.feed':    {ru:'Лента',       en:'Feed'},
  'st.title.chats':   {ru:'Чаты',        en:'Chats'},
  'st.title.mini':    {ru:'Мини-аппы',   en:'Hub'},
  'st.title.partner': {ru:'Партнёрка',   en:'Partner Hub'},
  'st.title.profile': {ru:'Профиль',     en:'Profile'},
  'st.title.wallet':  {ru:'Кошелёк',     en:'Wallet'},
  'st.title.games':   {ru:'Игры',        en:'Games'},
  'st.title.academy': {ru:'Академия',    en:'Academy'},
  'st.title.ads':     {ru:'Реклама',     en:'Ads'},
  /* статичные заголовки и кнопки */
  'st.h.services':    {ru:'Сервисы OKO',           en:'OKO Services'},
  'st.h.servicesSub': {ru:'Мессенджер, лента, биржа и ИИ-инструменты', en:'Messenger, feed, marketplace & AI tools'},
  'st.h.partner':     {ru:'Партнёрский кабинет',   en:'Partner Hub'},
  'st.h.plans':       {ru:'Тарифы',                en:'Plans'},
  'st.w.account':     {ru:'Лицевой счёт',          en:'Account'},
  'st.w.topup':       {ru:'Пополнить',             en:'Top up'},
  'st.w.withdraw':    {ru:'Вывести',               en:'Withdraw'},
  'st.w.history':     {ru:'История',               en:'History'},
  'st.w.spending':    {ru:'Расходы по категориям', en:'Spending by category'},
  'st.w.ops':         {ru:'История операций',      en:'Transaction history'},
  'st.w.fAll':        {ru:'Все',                   en:'All'},
  'st.w.fIn':         {ru:'Пополнения',            en:'Deposits'},
  'st.w.fOut':        {ru:'Списания',              en:'Charges'},
  /* строки профиля */
  'st.p.theme':       {ru:'Светлая тема',          en:'Light theme'},
  'st.p.profile':     {ru:'Профиль',               en:'Profile'},
  'st.p.notif':       {ru:'Уведомления',           en:'Notifications'},
  'st.p.privacy':     {ru:'Конфиденциальность',    en:'Privacy'},
  'st.p.progress':    {ru:'Прогресс сборки',       en:'Build progress'},
  'st.p.admin':       {ru:'Админка OKO',           en:'OKO Admin'},
  'st.p.logout':      {ru:'Выйти',                 en:'Log out'},
  /* плейсхолдеры поиска */
  'st.ph.gsearch':    {ru:'Люди, каналы, услуги, посты', en:'People, channels, services, posts'},
  'st.ph.search':     {ru:'Поиск',                 en:'Search'},
  /* собственные строки модуля */
  'st.row.lang':      {ru:'Язык · Language',       en:'Language'},
  'st.row.auto':      {ru:'Авто-перевод чатов',    en:'Auto-translate chats'},
  'st.sheet.title':   {ru:'Язык · Language',       en:'Language'},
  'st.sheet.note':    {ru:'Интерфейс переключается мгновенно. Контент пользователей остаётся на языке оригинала — включи авто-перевод чатов в профиле.',
                       en:'The interface switches instantly. User content stays in its original language — enable chat auto-translation in your profile.'},
  'st.opt.ruSub':     {ru:'Основной язык OKO',     en:'Default OKO language'},
  'st.opt.enSub':     {ru:'Интерфейс на английском', en:'English interface'},
  'st.badge':         {ru:'Переведено · OKO AI',   en:'Translated · OKO AI'},
  'st.toast.autoOn':  {ru:'Авто-перевод включён — входящие переводит OKO AI', en:'Auto-translation on — incoming messages translated by OKO AI'},
  'st.toast.autoOff': {ru:'Авто-перевод выключен', en:'Auto-translation off'}
});

/* ключи TITLES, которые модуль умеет переводить (обновляются только если экран существует) */
const ST_TITLE_KEYS = ['feed','chats','mini','partner','profile','wallet','games','academy','ads'];

/* статичные элементы хрома: селектор -> ключ словаря (переводим только реально существующие) */
const ST_STATIC = [
  {sel:'#maHero h2',                                   key:'st.h.services'},
  {sel:'#maHero p',                                    key:'st.h.servicesSub'},
  {sel:'.svc-h',                                       key:'st.h.services'},
  {sel:'#screen-partner .section-h',                   key:'st.h.partner'},
  {sel:'#screen-profile .section-h',                   key:'st.h.plans'},
  {sel:'#screen-wallet .wal-acc-label',                key:'st.w.account'},
  {sel:'#screen-wallet .wal-act[onclick^="walOpenTopup"]',    key:'st.w.topup'},
  {sel:'#screen-wallet .wal-act[onclick^="walOpenWithdraw"]', key:'st.w.withdraw'},
  {sel:'#screen-wallet .wal-act[onclick^="walScrollHistory"]',key:'st.w.history'},
  {sel:'#screen-wallet .section-h:not(#walHistAnchor)',key:'st.w.spending'},
  {sel:'#walHistAnchor',                               key:'st.w.ops'},
  {sel:'#walFilters [data-f="all"]',                   key:'st.w.fAll'},
  {sel:'#walFilters [data-f="in"]',                    key:'st.w.fIn'},
  {sel:'#walFilters [data-f="out"]',                   key:'st.w.fOut'},
  {sel:'#screen-profile .prow[onclick="toggleTheme()"]',        key:'st.p.theme'},
  {sel:'#screen-profile .prow[onclick="openEdit()"]',           key:'st.p.profile'},
  {sel:"#screen-profile .prow[onclick=\"openSettings('notif')\"]",   key:'st.p.notif'},
  {sel:"#screen-profile .prow[onclick=\"openSettings('privacy')\"]", key:'st.p.privacy'},
  {sel:"#screen-profile .prow[onclick=\"openSheet('progress')\"]",   key:'st.p.progress'},
  {sel:'#prowAdmin',                                   key:'st.p.admin'},
  {sel:'#screen-profile .prow[onclick="doLogout()"]',  key:'st.p.logout'}
];

/* заменить первый значимый текстовый узел элемента (не трогая svg/switch/chev внутри) */
function stSetText(el, txt){
  if(!el) return;
  for(const n of el.childNodes){
    if(n.nodeType === 3 && n.nodeValue.trim()){ n.nodeValue = ' ' + txt + ' '; return; }
  }
}

/* ---------- обработчик смены языка (регистрируется в onLangChange) ---------- */
function stApplyLang(l){
  /* 1. подписи вкладок нижней навигации (текстовый узел после svg) */
  document.querySelectorAll('#tabs>button[data-t]').forEach(b=>{
    const key = 'st.nav.' + b.dataset.t;
    if(I18N[key]) stSetText(b, t(key));
  });
  /* 2. TITLES всех известных экранов — только реально зарегистрированных */
  if(typeof TITLES === 'object'){
    ST_TITLE_KEYS.forEach(k=>{
      if(TITLES[k] !== undefined && I18N['st.title.'+k]) regTitle(k, t('st.title.'+k));
    });
    /* текущий заголовок шапки */
    const act = document.querySelector('main .screen.active');
    const head = document.getElementById('screenTitle');
    if(act && head){
      const k = act.id.replace('screen-','');
      if(TITLES[k]) head.textContent = TITLES[k];
    }
  }
  /* 3. статичные заголовки/кнопки — с проверкой существования */
  ST_STATIC.forEach(o=>{
    document.querySelectorAll(o.sel).forEach(el=>{
      if(el.children.length === 0) el.textContent = t(o.key);
      else stSetText(el, t(o.key));
    });
  });
  /* 4. плейсхолдеры поиска */
  const gs = document.getElementById('gSearchInput'); if(gs) gs.placeholder = t('st.ph.gsearch');
  const cs = document.getElementById('chatSearch');   if(cs) cs.placeholder = t('st.ph.search');
  /* 5. собственные элементы модуля */
  const lt = document.getElementById('stLangText'); if(lt) lt.textContent = t('st.row.lang');
  const lc = document.getElementById('stLangCur');  if(lc) lc.textContent = l==='en' ? 'English' : 'Русский';
  const ar = document.getElementById('stAutoRow');  if(ar) stSetText(ar, t('st.row.auto'));
  const sh = document.getElementById('stLangTitle'); if(sh) sh.textContent = t('st.sheet.title');
  const sn = document.getElementById('stLangNote');  if(sn) sn.textContent = t('st.sheet.note');
  stRenderLangList();
  /* 6. перерисовать открытый чат, чтобы бейджи перевода сменили язык */
  stRerenderChat();
}

/* ---------- sheet выбора языка ---------- */
function stRenderLangList(){
  const box = document.getElementById('stLangList');
  if(!box) return;
  const L = (typeof LANG === 'string') ? LANG : 'ru';
  box.innerHTML = [
    ['ru','Русский','РУ','st.opt.ruSub'],
    ['en','English','EN','st.opt.enSub']
  ].map(([code,label,tag,sub])=>`
    <button class="sheet-item st-lang-opt ${L===code?'on':''}" onclick="stPickLang('${code}')">
      <span class="st-lang-tag">${tag}</span>
      <span>${label}<small>${t(sub)}</small></span>
      ${L===code ? `<span class="st-check">${I('check2')}</span>` : ''}
    </button>`).join('');
}
function stOpenLang(){ stRenderLangList(); openSheet('stLang'); }
function stPickLang(l){
  if(l === LANG){ closeSheet(); return; }
  setLang(l);                 // персист (oko-lang) + все onLangChange-хуки, включая stApplyLang
  stRenderLangList();         // галочка перескакивает с анимацией
  setTimeout(closeSheet, 260);
}

/* ---------- авто-перевод чатов ---------- */
function stToggleAuto(){
  ST_STATE.auto = !ST_STATE.auto;
  stSave();
  const sw = document.getElementById('stAutoSwitch');
  if(sw) sw.classList.toggle('on', ST_STATE.auto);
  toast(t(ST_STATE.auto ? 'st.toast.autoOn' : 'st.toast.autoOff'));
  stRerenderChat();
}
function stRerenderChat(){
  if(typeof renderMsgs !== 'function') return;
  if(typeof currentChat === 'undefined' || !currentChat) return;
  const box = document.getElementById('msgs');
  if(!box || !box.children.length) return;
  try{ renderMsgs(); }catch(e){}
}
/* DOM-проход: тонкий бейдж «Переведено · OKO AI» под входящими текстовыми сообщениями */
function stMarkTranslated(){
  if(!ST_STATE.auto) return;
  const box = document.getElementById('msgs');
  if(!box) return;
  box.querySelectorAll('.msg.in').forEach(m=>{
    if(m.dataset.stDone) return;
    if(m.classList.contains('sys') || m.classList.contains('sticker-msg') || m.classList.contains('has-vnote')) return;
    if(m.querySelector('.voice,.filemsg,.photomsg,.pollmsg,.moneymsg')) return; // только текст
    const b = document.createElement('div');
    b.className = 'st-trans';
    b.innerHTML = `${I('globe')}<span>${t('st.badge')}</span>`;
    m.appendChild(b);
    m.dataset.stDone = '1';
  });
}

/* ---------- вставка строк в профиль ---------- */
function stInsertRows(){
  if(document.getElementById('stLangRow')) return;
  const admin = document.getElementById('prowAdmin');
  const card = admin ? admin.parentElement : document.querySelector('#screen-profile .card');
  if(!card) return;

  const langRow = document.createElement('button');
  langRow.className = 'prow'; langRow.id = 'stLangRow';
  langRow.onclick = stOpenLang;
  langRow.innerHTML = `${I('globe')} <span id="stLangText">${t('st.row.lang')}</span>` +
    `<span class="st-cur" id="stLangCur">${LANG==='en'?'English':'Русский'}</span>` +
    `<span class="chev">${I('chev')}</span>`;

  const autoRow = document.createElement('button');
  autoRow.className = 'prow'; autoRow.id = 'stAutoRow';
  autoRow.onclick = stToggleAuto;
  autoRow.innerHTML = `${I('st-translate')} ${t('st.row.auto')} ` +
    `<span class="switch ${ST_STATE.auto?'on':''}" id="stAutoSwitch"><i></i></span>`;

  if(admin){ card.insertBefore(langRow, admin); card.insertBefore(autoRow, admin); }
  else { card.appendChild(langRow); card.appendChild(autoRow); }
}

/* ---------- своя SVG-иконка «перевод» (штрих как у ядра: stroke 7, округлые концы) ---------- */
function stAddIcon(){
  const defs = document.querySelector('svg defs');
  if(!defs || document.getElementById('i-st-translate')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
  s.setAttribute('id','i-st-translate'); s.setAttribute('viewBox','0 0 100 100');
  s.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M14 70 L30 26 L46 70"/><path d="M20 55 h20"/>' +
    '<path d="M60 32 h28"/><path d="M60 46 h28"/><path d="M60 60 h18"/>' +
    '<path d="M84 60 l-7 12"/></g>';
  defs.appendChild(s);
}

/* ---------- самоинициализация ---------- */
(function stInit(){
  stAddIcon();
  stInsertRows();

  /* chain-патч renderMsgs ядра: после каждого рендера — DOM-проход бейджей */
  if(typeof renderMsgs === 'function'){
    const _stPrevRenderMsgs = renderMsgs;
    renderMsgs = function(){
      _stPrevRenderMsgs.apply(this, arguments);
      stMarkTranslated();
    };
  }

  onLangChange(stApplyLang);

  /* язык уже персистится в setLang (oko-lang); при загрузке применяем сохранённый EN напрямую */
  if(LANG === 'en') stApplyLang('en');
})();
