/* ===== SETTINGS-PLUS (st2-): «Настройки» как полноценный раздел =====
   Строка в профиле (шестерёнка) -> fullscreen #st2View (nvPush):
   Аккаунты / Аккаунт / Уведомления / Приватность / Безопасность /
   Оформление / Данные / Сессии / Опасная зона.
   Всё персистится в localStorage 'oko-settings2'. */

/* ---------- состояние + персист ---------- */
const ST2_NOTIF_DEF = () => ({snd:true, vibro:true, badge:true, prev:true});
const ST2_CH = [
  {k:'msg',      title:'Сообщения',      sub:'Чаты, реплаи, упоминания',       ico:'chat'},
  {k:'likes',    title:'Лайки и реакции',sub:'Отклик на посты и сторис',       ico:'heart'},
  {k:'comments', title:'Комментарии',    sub:'Ответы под твоими постами',      ico:'comment'},
  {k:'partners', title:'Партнёрка',      sub:'Начисления и выплаты',           ico:'briefcase'},
  {k:'games',    title:'Игры',           sub:'Ставки, выигрыши, лимиты',       ico:'st2-controller'},
  {k:'academy',  title:'Академия',       sub:'Новые уроки и сертификаты',      ico:'star'},
  {k:'market',   title:'Биржа',          sub:'Заказы, отклики, диспуты',       ico:'briefcase'},
  {k:'marketing',title:'Новости OKO',    sub:'Обновления и предложения',       ico:'megaphone'},
];
const ST2 = {
  nick: null,                       /* override ника (синк с PROFILE) */
  email: 'okoteam.top@gmail.com',
  phone: '+7 999 123-45-67',
  tg:    null,                      /* привязка Telegram: '@nick' */
  notif: {
    msg:true, feed:true, market:true, academy:true, marketing:false,
    likes:true, comments:true, partners:true, games:false,
    quiet:{on:false, from:'23:00', to:'08:00'},
    preview:true, sound:true, vibro:true,
    perCh:{},                       /* per-channel {msg:{snd,vibro,badge,prev}, ...} */
  },
  /* приватность: write (all|following|nobody), phone/photo/status (all|contacts|nobody), online/read — тумблеры */
  priv:  {write:'all', online:true, read:true, phone:'contacts', photo:'all', status:'all',
          calls:'contacts', posts:'all', stories:'all'},
  sec:   {twofa:false, passcode:false, pin:null, secret:null, autolock:'5m'},
  theme: null,                      /* 'dark'|'light'|'system' */
  themeAuto: {on:false, dark:'22:00', light:'07:00'},
  data:  {
    cacheLimit: 500,                /* МБ, 100..2000 */
    autodl: {
      wifi:   {photos:true,  videos:true,  files:true},
      mobile: {photos:true,  videos:false, files:false},
    },
    docsPolicy: 'ask',              /* 'always' | 'ask' | 'never' */
  },
  a11y:  {reduceMotion:false, highContrast:false, bigTaps:false, reduceOpacity:false, fontScale:100 /* 85..135 */},
  loc:   {dateFmt:'auto', hour24:true, weekStart:'auto' /* auto|mon|sun */},
  accounts: [],                     /* [{id,name,nick,tier,role,bio,status,avatar,cover}] */
  activeAcc: null,                  /* id активного аккаунта */
  killed: [],                       /* id завершённых мок-сессий */
  blocked: [],                      /* [имя] — чёрный список (реальный персист) */
  lastClear: 0,                     /* ts последней очистки кэша */
  delAt: 0,                         /* ts запланированного удаления аккаунта */
};
(function st2Load(){
  try{
    const s = JSON.parse(localStorage.getItem('oko-settings2') || 'null');
    if(!s) return;
    if(s.notif){
      Object.assign(ST2.notif, s.notif);
      if(s.notif.perCh) ST2.notif.perCh = s.notif.perCh;
      if(s.notif.quiet) Object.assign(ST2.notif.quiet, s.notif.quiet);
    }
    if(s.priv)  Object.assign(ST2.priv,  s.priv);
    if(s.sec)   Object.assign(ST2.sec,   s.sec);
    if(s.data){
      Object.assign(ST2.data, s.data);
      if(s.data.autodl){
        if(s.data.autodl.wifi)   Object.assign(ST2.data.autodl.wifi,   s.data.autodl.wifi);
        if(s.data.autodl.mobile) Object.assign(ST2.data.autodl.mobile, s.data.autodl.mobile);
      }
    }
    if(s.a11y)      Object.assign(ST2.a11y,      s.a11y);
    if(s.loc)       Object.assign(ST2.loc,       s.loc);
    if(s.themeAuto) Object.assign(ST2.themeAuto, s.themeAuto);
    ['nick','email','phone','tg','lastClear','theme','activeAcc','delAt'].forEach(k=>{ if(s[k] !== undefined) ST2[k] = s[k]; });
    if(Array.isArray(s.killed))   ST2.killed   = s.killed;
    if(Array.isArray(s.accounts)) ST2.accounts = s.accounts;
    if(Array.isArray(s.blocked))  ST2.blocked  = s.blocked;
  }catch(e){}
  /* нормализуем перечёт-каналы */
  ST2_CH.forEach(c => { if(!ST2.notif.perCh[c.k]) ST2.notif.perCh[c.k] = ST2_NOTIF_DEF(); });
})();
function st2Save(){ try{ localStorage.setItem('oko-settings2', JSON.stringify(ST2)); }catch(e){} }

/* ---------- синк с ядром (SETTINGS старых sheet-ов + PROFILE) ---------- */
function st2PushCore(){
  if(typeof SETTINGS === 'undefined') return;
  SETTINGS.notif.msg     = ST2.notif.msg;
  SETTINGS.notif.news    = ST2.notif.marketing;
  SETTINGS.privacy.online = ST2.priv.online;
  SETTINGS.privacy.read   = ST2.priv.read;
  SETTINGS.privacy.dm     = ST2.priv.write !== 'all';
}
function st2PullCore(){
  if(typeof SETTINGS === 'undefined') return;
  ST2.notif.msg       = SETTINGS.notif.msg;
  ST2.notif.marketing = SETTINGS.notif.news;
  ST2.priv.online     = SETTINGS.privacy.online;
  ST2.priv.read       = SETTINGS.privacy.read;
  if(SETTINGS.privacy.dm && ST2.priv.write === 'all') ST2.priv.write = 'following';
  else if(!SETTINGS.privacy.dm) ST2.priv.write = 'all';
  st2Save();
}

/* ---------- мок-сессии ---------- */
function st2Device(){
  const ua = navigator.userAgent || '';
  const os = /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android'
           : /Mac/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : 'Linux';
  const br = /Telegram/i.test(ua) ? 'Telegram' : /Firefox/.test(ua) ? 'Firefox'
           : /Edg\//.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : 'браузер';
  return os + ' · ' + br;
}
const ST2_SES = [
  {id:'cur', dev: st2Device(),        app:'OKO Web',     geo:'',                  cur:true,  mob:/iPhone|Android/.test(navigator.userAgent||'')},
  {id:'s1',  dev:'iPhone 15 Pro',     app:'OKO iOS 1.4', geo:'Москва · 2 ч назад',  mob:true},
  {id:'s2',  dev:'Windows 11 · Chrome', app:'OKO Web',   geo:'Санкт-Петербург · вчера', mob:false},
];
function st2Alive(){ return ST2_SES.filter(s => s.cur || ST2.killed.indexOf(s.id) < 0); }

/* ---------- размер кэша (мок: растёт со временем + реальный localStorage) ---------- */
function st2CacheSize(){
  let ls = 0;
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      ls += k.length + (localStorage.getItem(k) || '').length;
    }
  }catch(e){}
  const since = ST2.lastClear || (Date.now() - 67 * 36e5); /* «установлено ~3 дня назад» */
  const hrs = Math.max(0, (Date.now() - since) / 36e5);
  return Math.min(217, hrs * 2.3) + ls / 1048576 * 8;
}

/* ---------- аккаунты: утилиты ---------- */
function st2AccInit(name){
  return String(name || 'U').trim().split(/\s+/).slice(0, 2).map(w => (w[0]||'').toUpperCase()).join('') || 'U';
}
function st2Hue(s){ let h = 0; s = String(s); for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function st2ActiveAcc(){ return ST2.accounts.find(a => a.id === ST2.activeAcc) || null; }
function st2SyncActiveFromProfile(){
  const a = st2ActiveAcc();
  if(a && typeof PROFILE !== 'undefined'){
    a.name = PROFILE.name; a.nick = PROFILE.nick; a.tier = PROFILE.tier; a.role = PROFILE.role; a.bio = PROFILE.bio;
    a.status = PROFILE.status || null;
    a.avatar = PROFILE.avatar || null;
    a.cover  = PROFILE.cover  || null;
  }
}
/* применить профиль аккаунта на ядро PROFILE (при переключении/инициализации) */
function st2ApplyAccToProfile(a){
  if(!a || typeof PROFILE === 'undefined') return;
  PROFILE.name = a.name; PROFILE.nick = a.nick; PROFILE.tier = a.tier; PROFILE.role = a.role;
  if(a.bio    !== undefined) PROFILE.bio    = a.bio;
  PROFILE.status = a.status || null;
  PROFILE.avatar = a.avatar || null;
  PROFILE.cover  = a.cover  || null;
}

/* ---------- рендер вьюхи ---------- */
function st2Nick(){ return (typeof PROFILE !== 'undefined' && PROFILE.nick) ? PROFILE.nick : (ST2.nick || 'ktodaniel'); }
function st2Sw(on){ return `<span class="switch ${on ? 'on' : ''}"><i></i></span>`; }

/* сегмент-переключатель N вариантов (data-vis-группа) */
function st2Seg(group, key, opts){
  const cur = ST2[group][key];
  return `<span class="st2-seg st2-seg3" data-seg="${group}.${key}">` +
    opts.map(o => `<button data-v="${o[0]}" class="${cur === o[0] ? 'on' : ''}" onclick="st2SetSeg('${group}','${key}','${o[0]}')">${esc(o[1])}</button>`).join('') +
    `</span>`;
}
function st2SetSeg(group, key, val){
  ST2[group][key] = val; st2Save(); st2PushCore();
  const seg = document.querySelector(`.st2-seg[data-seg="${group}.${key}"]`);
  if(seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.getAttribute('data-v') === val));
  const M = {
    'priv.write':    {all:'Писать могут все', following:'Писать могут только подписки', nobody:'Никто не может писать первым'},
    'priv.phone':    {all:'Телефон виден всем', contacts:'Телефон виден контактам', nobody:'Телефон скрыт'},
    'priv.photo':    {all:'Фото видно всем', contacts:'Фото видно контактам', nobody:'Фото профиля скрыто'},
    'priv.status':   {all:'Статус виден всем', contacts:'Статус виден контактам', nobody:'Статус скрыт'},
  };
  const m = M[group + '.' + key]; if(m && m[val]) toast(m[val]);
}

function st2AccHtml(a){
  const active = a.id === ST2.activeAcc;
  const removable = !active && a.role !== 'owner';
  return `<div class="st2-acc ${active ? 'st2-acc-on' : ''}" data-acc="${a.id}">
    <span class="st2-acc-av${a.avatar ? ' has' : ''}" style="--h:${st2Hue(a.nick || a.name)}${a.avatar ? ';background-image:url(' + a.avatar + ')' : ''}">${a.avatar ? '' : esc(st2AccInit(a.name))}</span>
    <div class="st2-acc-b">
      <b>${esc(a.name)}${vBadge ? vBadge(a.name) : ''}</b>
      <small>@${esc(a.nick)} · ${esc(a.tier || 'FREE')}</small>
    </div>
    ${active ? `<span class="chip st2-chip st2-chip-on">${I('check')} активен</span>`
             : `<button class="st2-acc-sw" onclick="st2SwitchAccount('${a.id}')">Войти</button>`}
    ${removable ? `<button class="st2-acc-rm" onclick="st2RemoveAccount('${a.id}')" aria-label="Убрать аккаунт">${I('trash')}</button>` : ''}
  </div>`;
}

function st2SesHtml(s){
  return `<div class="st2-ses" data-st2ses="${s.id}">
    <span class="st2-ses-ico">${I(s.mob ? 'phone' : 'globe')}</span>
    <div class="st2-ses-b">
      <b>${s.cur ? '<span class="st2-dot"></span>' : ''}${esc(s.dev)}</b>
      <small>${esc(s.app)}${s.geo ? ' · ' + esc(s.geo) : ''}</small>
    </div>
    ${s.cur ? '<span class="chip st2-chip">это устройство</span>'
            : `<button class="st2-kill" onclick="st2Kill('${s.id}')">Завершить</button>`}
  </div>`;
}

/* ================= NAV-STACK: панели ================= */
/* каждый вход — {title, render(ctx)->html, after?()} */
const ST2_PANELS = {};
let ST2_STACK = [];

function st2Push(id, ctx){
  const p = ST2_PANELS[id];
  if(!p) return;
  const ent = {id, ctx: ctx || {}, title: (typeof p.title === 'function' ? p.title(ctx || {}) : p.title)};
  ST2_STACK.push(ent);
  st2RenderStack('push');
}
function st2Back(){
  if(ST2_STACK.length > 1){
    ST2_STACK.pop();
    st2RenderStack('pop');
    return;
  }
  st2Close();
}
function st2CurPanel(){ return ST2_STACK[ST2_STACK.length - 1]; }

/* рендер стека: замена содержимого + анимация slide */
function st2RenderStack(dir){
  const body = document.getElementById('st2Body');
  if(!body) return;
  const top = st2CurPanel();
  if(!top) return;
  const p = ST2_PANELS[top.id];
  const html = `<div class="st2-panel-inner">${p.render(top.ctx)}</div>`;

  const title = document.getElementById('st2Title');
  if(title) title.textContent = top.title;
  const bIco = document.getElementById('st2BackIco');
  if(bIco) bIco.style.transform = ST2_STACK.length > 1 ? 'translateX(-2px)' : '';

  const prev = body.firstElementChild;
  const panel = document.createElement('div');
  panel.className = 'st2-panel ' + (dir === 'push' ? 'st2-in' : 'st2-out-left');
  panel.dataset.id = top.id;
  panel.innerHTML = html;
  body.appendChild(panel);

  requestAnimationFrame(()=>{
    panel.classList.remove('st2-in', 'st2-out-left');
    if(prev){
      prev.classList.remove('st2-panel');
      prev.classList.add('st2-panel', dir === 'push' ? 'st2-back-behind' : 'st2-out-right');
    }
  });
  setTimeout(()=>{ if(prev && prev.parentElement) prev.remove(); if(p.after) try{ p.after(top.ctx, panel); }catch(e){} }, 340);
}

/* совместимая обёртка: полный ре-рендер текущей панели без анимации */
function st2Render(){
  if(!ST2_STACK.length) ST2_STACK = [{id:'root', ctx:{}, title:'Настройки'}];
  const body = document.getElementById('st2Body');
  if(!body) return;
  const top = st2CurPanel();
  const p = ST2_PANELS[top.id];
  body.innerHTML = `<div class="st2-panel st2-active" data-id="${top.id}"><div class="st2-panel-inner">${p.render(top.ctx)}</div></div>`;
  const title = document.getElementById('st2Title');
  if(title) title.textContent = top.title;
  const bIco = document.getElementById('st2BackIco');
  if(bIco) bIco.style.transform = ST2_STACK.length > 1 ? 'translateX(-2px)' : '';
  if(p.after) try{ p.after(top.ctx, body.firstElementChild); }catch(e){}
}

/* ================= ROOT PANEL: группированный список секций ================= */
function st2NavRow(icon, title, sum, target, danger){
  const sumHtml = sum ? `<span class="st2-nav-sum${sum.on?' on':''}">${esc(sum.text||sum)}</span>` : '';
  return `<button class="prow" onclick="st2Push('${target}')">
    <span class="st2-nav-ico${danger?' st2-nav-danger':''}">${I(icon)}</span>
    <span>${esc(title)}</span>${sumHtml}<span class="chev">${I('chev')}</span></button>`;
}
function st2ChSummary(k){ return ST2.notif[k] ? 'вкл' : 'выкл'; }
function st2PrivSum(){
  const m = {all:'Все', contacts:'Контакты', following:'Подписки', nobody:'Никто'};
  return m[ST2.priv.write] || 'Все';
}
function st2ThemeSum(){
  const t = ST2.theme || 'dark';
  return t === 'system' ? 'Система' : (t === 'light' ? 'Светлая' : 'Тёмная');
}
function st2LangSum(){
  const l = (typeof LANG !== 'undefined') ? LANG : 'ru';
  return l === 'en' ? 'English' : (l === 'kk' ? 'Қазақша' : 'Русский');
}
function st2A11ySum(){
  const a = ST2.a11y;
  const flags = [a.reduceMotion&&'motion',a.highContrast&&'contrast',a.bigTaps&&'tap',a.reduceOpacity&&'opacity'].filter(Boolean).length;
  if(!flags && a.fontScale===100) return 'выкл';
  return flags ? flags + ' опц.' : (a.fontScale + '%');
}
function st2DataSum(){ return st2CacheSize().toFixed(1) + ' МБ'; }
function st2DelSum(){ return ST2.delAt ? {text:'через ' + st2DelDays() + ' д', on:false} : null; }

ST2_PANELS.root = {
  title: 'Настройки',
  render(){
    return `
    <label class="st2-search" id="st2Search">
      <span class="st2-search-ic">${I('st2-search')}</span>
      <input id="st2SearchInp" type="search" placeholder="Поиск по настройкам" autocomplete="off" enterkeyhint="search" oninput="st2Search(this.value)">
      <button type="button" class="st2-search-x" onclick="st2SearchClear()" aria-label="Очистить">${I('st2-x')}</button>
    </label>
    <div id="st2SearchResults"></div>
    <div class="st2-grouped" id="st2Groups">
      <div class="st2-grp">
        <div class="st2-grp-cap">${I('user')} Профиль</div>
        ${st2NavRow('user',      'Профиль',         {text:'@'+st2Nick()}, 'profile')}
        ${st2NavRow('users',     'Аккаунты',        (ST2.accounts.length + ' на устройстве'), 'accounts')}
      </div>
      <div class="st2-grp">
        <div class="st2-grp-cap">${I('st2-key')} Аккаунт</div>
        ${st2NavRow('st2-mail',  'Аккаунт и вход',   ST2.email, 'account')}
        ${st2NavRow('st2-shield','Безопасность',    (ST2.sec.twofa?'2FA · вкл':'2FA · выкл'), 'security')}
        ${st2NavRow('st2-devices','Активные сессии', st2Alive().length + ' устр.', 'sessions')}
      </div>
      <div class="st2-grp">
        <div class="st2-grp-cap">${I('lock')} Приватность и уведомления</div>
        ${st2NavRow('lock',      'Приватность',     st2PrivSum(), 'privacy')}
        ${st2NavRow('bell',      'Уведомления',     (ST2.notif.msg?'вкл':'выкл'), 'notif')}
        ${st2NavRow('st2-ban',   'Чёрный список',   (ST2.blocked.length||'пусто') + '', 'blocked')}
      </div>
      <div class="st2-grp">
        <div class="st2-grp-cap">${I('st2-db')} Данные и оформление</div>
        ${st2NavRow('st2-db',    'Данные и хранилище', st2DataSum(), 'data')}
        ${st2NavRow('sun',       'Оформление',      st2ThemeSum(), 'theme')}
        ${st2NavRow('st2-eye',   'Доступность',     st2A11ySum(), 'a11y')}
        ${st2NavRow('globe',     'Язык',            st2LangSum(), 'lang')}
      </div>
      <div class="st2-grp">
        <div class="st2-grp-cap">${I('st2-life')} Помощь и документы</div>
        ${st2NavRow('st2-life',  'Помощь и обратная связь', null, 'help')}
        ${st2NavRow('file',      'Юридические документы',   null, 'legal')}
        ${st2NavRow('logout',    'Выйти из аккаунта',       null, 'logoutAct')}
      </div>
      <div class="st2-grp">
        <div class="st2-grp-cap" style="color:var(--danger)">${I('trash')} Опасная зона</div>
        ${st2NavRow('trash',     'Экспорт и удаление', st2DelSum(), 'danger', true)}
      </div>
    </div>
    <div class="st2-search-empty" id="st2SearchEmpty">${I('st2-search')}<p>Ничего не найдено</p><span>Попробуйте другой запрос</span></div>
    <div class="st2-foot">OKO · настройки хранятся локально · сборка ${st2Ver()}</div>`;
  }
};

/* хук выхода — открывается как «панель», но сразу дёргает st2LogoutAccount и попадает назад */
ST2_PANELS.logoutAct = {
  title:'Выход',
  render(){ return `<div class="st2-panel-desc">Готовим выход…</div>`; },
  after(){ st2LogoutAccount(); setTimeout(()=>{ if(ST2_STACK.length>1){ ST2_STACK.pop(); st2Render(); } }, 30); }
};

/* ================= ПРОФИЛЬ ================= */
ST2_PANELS.profile = {
  title: 'Профиль',
  render(){
    const p = (typeof PROFILE !== 'undefined') ? PROFILE : {name:'—', bio:'', role:'', tier:''};
    return `
    <p class="st2-panel-desc">Как тебя видят другие пользователи OKO. Открытая часть профиля — имя, ник, био и обложка.</p>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('user')} Публичное</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2AvatarMenu()">${I('camera')} Фото профиля<span class="chev">${I('chev')}</span></button>
        <button class="prow" onclick="st2CoverMenu()">${I('st2-image')} Обложка<span class="chev">${I('chev')}</span></button>
        <button class="prow" onclick="st2OpenEdit()">${I('edit')} Имя, био и статус<span class="st2-val">${esc(p.name)}</span><span class="chev">${I('chev')}</span></button>
        <button class="prow" onclick="st2EditNick()">${I('st2-key')} Ник<span class="st2-val">@${esc(st2Nick())}</span><span class="chev">${I('chev')}</span></button>
        <button class="prow" onclick="st2CopyPublic()">${I('share')} Публичная ссылка<span class="st2-val">oko.app/@${esc(st2Nick())}</span><span class="chev">${I('chev')}</span></button>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('crown')} Тариф</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2GoPlans()">${I('crown')} Текущий тариф<span class="st2-val">${esc(p.tier || 'FREE')}</span><span class="chev">${I('chev')}</span></button>
      </div>
    </div>`;
  }
};

/* ================= АККАУНТЫ (список + добавить) ================= */
ST2_PANELS.accounts = {
  title: 'Аккаунты',
  render(){
    return `<p class="st2-panel-desc">На одном устройстве держи несколько аккаунтов OKO — переключайся между ними в один тап.</p>
    <div class="st2-grp" id="st2AccList">
      ${ST2.accounts.map(st2AccHtml).join('')}
      <button class="prow st2-add-acc" onclick="st2AddAccount()">${I('plus')} Добавить аккаунт<span class="chev">${I('chev')}</span></button>
      <button class="prow st2-logout-acc" onclick="st2LogoutAccount()">${I('logout')} Выйти из активного<span class="chev">${I('chev')}</span></button>
    </div>`;
  }
};

/* ================= АККАУНТ И ВХОД ================= */
ST2_PANELS.account = {
  title: 'Аккаунт и вход',
  render(){
    return `<p class="st2-panel-desc">Контакты для входа и привязанные сервисы. Всё, что нужно для восстановления доступа.</p>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-mail')} Контакты</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2EditEmail()">${I('st2-mail')} Почта<span class="st2-val">${esc(ST2.email)}</span><span class="chip st2-chip">${I('check')} подтверждена</span></button>
        <button class="prow" onclick="st2EditPhone()">${I('phone')} Телефон<span class="st2-val">${esc(ST2.phone)}</span><span class="chev">${I('chev')}</span></button>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-link')} Привязки</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2LinkTg()">${I('send')} Telegram<span class="st2-val">${esc(ST2.tg || 'не привязан')}</span><span class="chev">${I('chev')}</span></button>
        <button class="prow" onclick="st2LinkStub('Google')">${I('google')} Google<span class="st2-val">не привязан</span><span class="chev">${I('chev')}</span></button>
        <button class="prow" onclick="st2LinkStub('Apple')">${I('apple')} Apple ID<span class="st2-val">не привязан</span><span class="chev">${I('chev')}</span></button>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-shield')} Защита входа</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2Push('security')">${I('st2-shield')} Двухфакторная защита и пароль<span class="chev">${I('chev')}</span></button>
      </div>
    </div>`;
  }
};

/* ================= БЕЗОПАСНОСТЬ ================= */
ST2_PANELS.security = {
  title: 'Безопасность',
  render(){
    return `<div class="st2-grp">
      <button class="prow" onclick="st2TwoFA()">${I('st2-shield')} Двухфакторная защита
        <span class="chip st2-chip ${ST2.sec.twofa ? 'st2-chip-on' : ''}">${ST2.sec.twofa ? I('check') + ' включена' : 'выключена'}</span><span class="chev">${I('chev')}</span></button>
      <button class="prow" onclick="st2Passcode(this)">${I('lock')} Код-пароль при входе ${st2Sw(ST2.sec.passcode)}</button>
      ${ST2.sec.passcode ? `<div class="prow st2-prow-col" style="cursor:default">
        <span class="st2-prow-lbl">${I('st2-clock')} Автоблокировка</span>
        <span class="st2-seg st2-seg3" id="st2LockSeg">${[['now','Сразу'],['1m','1 мин'],['5m','5 мин'],['1h','1 час']].map(o =>
          `<button data-v="${o[0]}" class="${(ST2.sec.autolock || '5m') === o[0] ? 'on' : ''}" onclick="st2SetAutolock('${o[0]}')">${o[1]}</button>`).join('')}</span></div>` : ''}
      <button class="prow" onclick="st2ChangePass()">${I('st2-key')} Сменить пароль<span class="chev">${I('chev')}</span></button>
      <button class="prow" onclick="st2Push('sessions')">${I('st2-devices')} Активные сессии<span class="st2-val">${st2Alive().length}</span><span class="chev">${I('chev')}</span></button>
    </div>`;
  }
};

/* ================= СЕССИИ ================= */
ST2_PANELS.sessions = {
  title: 'Сессии',
  render(){
    const alive = st2Alive(), others = alive.filter(s => !s.cur);
    return `<p class="st2-panel-desc">Устройства, на которых ты сейчас вошёл в OKO. Заверши любую сессию, если она подозрительна.</p>
    <div class="st2-grp" id="st2SesList">
      ${alive.map(st2SesHtml).join('')}
      ${others.length ? `<button class="st2-killall" onclick="st2KillAll()">Завершить остальные (${others.length})</button>`
                      : '<div class="st2-empty">Других активных сессий нет</div>'}
    </div>`;
  }
};

/* ================= ПРИВАТНОСТЬ ================= */
ST2_PANELS.privacy = {
  title: 'Приватность',
  render(){
    const VIS = [['all','Все'],['contacts','Контакты'],['nobody','Никто']];
    const WRITE = [['all','Все'],['following','Подписки'],['nobody','Никто']];
    return `<p class="st2-panel-desc">Точечно контролируй, кто и как может тебя видеть, слышать и добавлять в чаты.</p>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('eye')} Онлайн и прочтение</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2Tgl('priv','online',this)">${I('eye')} Показывать «в сети» ${st2Sw(ST2.priv.online)}</button>
        <button class="prow" onclick="st2Tgl('priv','read',this)">${I('check2')} Отчёты о прочтении ${st2Sw(ST2.priv.read)}</button>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('send')} Сообщения и звонки</div>
      <div class="st2-grp">
        <div class="prow st2-prow-col" style="cursor:default">
          <span class="st2-prow-lbl">${I('send')} Кто может писать первым</span>
          ${st2Seg('priv','write',WRITE)}
        </div>
        <div class="prow st2-prow-col" style="cursor:default">
          <span class="st2-prow-lbl">${I('phone')} Кто может звонить</span>
          ${st2Seg('priv','calls',VIS)}
        </div>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('user')} Что видно в профиле</div>
      <div class="st2-grp">
        <div class="prow st2-prow-col" style="cursor:default">
          <span class="st2-prow-lbl">${I('phone')} Кто видит телефон</span>
          ${st2Seg('priv','phone',VIS)}
        </div>
        <div class="prow st2-prow-col" style="cursor:default">
          <span class="st2-prow-lbl">${I('photo')} Кто видит фото профиля</span>
          ${st2Seg('priv','photo',VIS)}
        </div>
        <div class="prow st2-prow-col" style="cursor:default">
          <span class="st2-prow-lbl">${I('star')} Кто видит статус</span>
          ${st2Seg('priv','status',VIS)}
        </div>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('feed')} Посты и истории</div>
      <div class="st2-grp">
        <div class="prow st2-prow-col" style="cursor:default">
          <span class="st2-prow-lbl">${I('feed')} Кто видит новые посты</span>
          ${st2Seg('priv','posts',VIS)}
        </div>
        <div class="prow st2-prow-col" style="cursor:default">
          <span class="st2-prow-lbl">${I('camera')} Кто видит истории</span>
          ${st2Seg('priv','stories',VIS)}
        </div>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-ban')} Блокировки</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2Push('blocked')">${I('st2-ban')} Чёрный список
          <span class="st2-val" id="st2BlockedVal">${ST2.blocked.length ? ST2.blocked.length + (ST2.blocked.length===1?' человек':(ST2.blocked.length<5?' человека':' человек')) : 'пусто'}</span><span class="chev">${I('chev')}</span></button>
      </div>
    </div>`;
  }
};

/* ================= УВЕДОМЛЕНИЯ ================= */
ST2_PANELS.notif = {
  title: 'Уведомления',
  render(){
    const q = ST2.notif.quiet;
    return `<p class="st2-panel-desc">Точно настрой, что отвлекает: звук, вибро, превью и по каким каналам приходят пуши.</p>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('bell')} Общие</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2Tgl('notif','sound',this)">${I('st2-speaker')} Звук ${st2Sw(ST2.notif.sound)}</button>
        <button class="prow" onclick="st2Tgl('notif','vibro',this)">${I('st2-vibrate')} Вибрация ${st2Sw(ST2.notif.vibro)}</button>
        <button class="prow" onclick="st2Tgl('notif','preview',this)">${I('eye')} Превью текста в шторке ${st2Sw(ST2.notif.preview)}</button>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-tune')} Каналы</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2Push('notifChannels')">${I('st2-tune')} Настройки по каналам<span class="st2-val">${ST2_CH.length} шт.</span><span class="chev">${I('chev')}</span></button>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('moon')} Тихие часы</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2QuietTgl(this)">${I('moon')} Не беспокоить${st2QuietChip()}${st2Sw(q.on)}</button>
        <div class="st2-quiet${q.on ? ' open' : ''}" id="st2Quiet"><div class="st2-quiet-in">
          <div class="st2-quiet-times">
            <label class="st2-time"><span>с</span><input type="time" value="${esc(q.from)}" onchange="st2QuietTime('from',this.value)"></label>
            <span class="st2-quiet-arrow">${I('chev')}</span>
            <label class="st2-time"><span>до</span><input type="time" value="${esc(q.to)}" onchange="st2QuietTime('to',this.value)"></label>
          </div>
          <p class="st2-quiet-note">${I('moon')} В эти часы уведомления приходят без звука и вибрации. Расписание повторяется каждый день автоматически.</p>
        </div></div>
      </div>
    </div>`;
  }
};

/* ================= КАНАЛЫ УВЕДОМЛЕНИЙ ================= */
ST2_PANELS.notifChannels = {
  title: 'Каналы уведомлений',
  render(){
    return `<p class="st2-panel-desc">Для каждого канала отдельно: включить/выключить, звук, вибро, бейдж и превью текста.</p>
    <div class="st2-grp">
      ${ST2_CH.map(c => {
        const on = !!ST2.notif[c.k];
        const cnt = st2ChCount(c.k);
        return `<div class="st2-notch" onclick="st2Push('notifChannel',{k:'${c.k}'})">
          <span class="st2-notch-ico">${I(c.ico)}</span>
          <div class="st2-notch-b"><b>${esc(c.title)}</b><small>${esc(c.sub)}${on&&cnt?(' · '+cnt+' опций'):''}</small></div>
          <span class="st2-notch-state ${on?'on':''}">${on?'вкл':'выкл'}</span>
          <span class="chev">${I('chev')}</span>
        </div>`;
      }).join('')}
    </div>`;
  }
};

function st2ChCount(k){
  const s = ST2.notif.perCh[k] || {};
  return Object.values(s).filter(Boolean).length;
}
function st2FindCh(k){ return ST2_CH.find(c => c.k === k); }

ST2_PANELS.notifChannel = {
  title(ctx){ const c = st2FindCh(ctx.k); return c ? c.title : 'Канал'; },
  render(ctx){
    const c = st2FindCh(ctx.k); if(!c) return '';
    const st = ST2.notif.perCh[c.k];
    const globalOn = !!ST2.notif[c.k];
    return `<p class="st2-panel-desc">${esc(c.sub)}. Изменения применяются сразу и хранятся на устройстве.</p>
    <div class="st2-panel-sec">
      <div class="st2-grp">
        <button class="prow" onclick="st2Tgl('notif','${c.k}',this); st2RefreshHeaderState()">${I('bell')} Уведомления канала ${st2Sw(globalOn)}</button>
      </div>
    </div>
    <div class="st2-panel-sec" style="opacity:${globalOn?1:.5};pointer-events:${globalOn?'auto':'none'}">
      <div class="st2-panel-h">${I('st2-tune')} Как оповещать</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2TglCh('${c.k}','snd',this)">${I('st2-speaker')} Звук ${st2Sw(st.snd)}</button>
        <button class="prow" onclick="st2TglCh('${c.k}','vibro',this)">${I('st2-vibrate')} Вибрация ${st2Sw(st.vibro)}</button>
        <button class="prow" onclick="st2TglCh('${c.k}','badge',this)">${I('st2-badge')} Бейдж на иконке ${st2Sw(st.badge)}</button>
        <button class="prow" onclick="st2TglCh('${c.k}','prev',this)">${I('eye')} Превью текста ${st2Sw(st.prev)}</button>
      </div>
    </div>`;
  }
};
function st2TglCh(k, key, btn){
  const s = ST2.notif.perCh[k];
  s[key] = !s[key]; st2Save();
  const sw = btn && btn.querySelector('.switch');
  if(sw) sw.classList.toggle('on', s[key]);
}
function st2RefreshHeaderState(){ /* обновит счётчик при возврате */ }

/* ================= ДАННЫЕ И ХРАНИЛИЩЕ ================= */
ST2_PANELS.data = {
  title: 'Данные и хранилище',
  render(){
    const total = st2CacheSize();
    const parts = st2StorageParts(total);
    return `<p class="st2-panel-desc">Что занимает место, как загружать медиа и когда чистить кэш.</p>
    <div class="st2-storage">
      ${st2PieSvg(parts)}
      <div class="st2-pie-legend">
        ${parts.map(p => `<div class="st2-pie-row"><span class="st2-pie-dot" style="background:${p.color}"></span>${esc(p.label)}<b>${p.v.toFixed(1)} МБ</b></div>`).join('')}
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-grp">
        <button class="prow" id="st2CacheRow" onclick="st2ClearCache()">${I('trash')} Очистить кэш<span class="st2-val" id="st2CacheVal">${total.toFixed(1)} МБ</span><span class="chev">${I('chev')}</span></button>
        <div class="prow st2-prow-col" style="cursor:default">
          <div class="st2-range" style="width:100%">
            <div class="st2-range-h">${I('st2-db')} Максимум кэша<span class="st2-range-v" id="st2CLV">${ST2.data.cacheLimit} МБ</span></div>
            <input type="range" min="100" max="2000" step="50" value="${ST2.data.cacheLimit}" oninput="st2SetCacheLim(this.value)" id="st2CLR" style="--st2-fill:${((ST2.data.cacheLimit-100)/(2000-100)*100)}%">
            <div class="st2-range-ticks"><span>100</span><span>500</span><span>1 ГБ</span><span>2 ГБ</span></div>
          </div>
        </div>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-wifi')} Автозагрузка медиа</div>
      <div class="st2-grp">
        <div class="st2-dl-grid">
          <div></div><div class="st2-dl-head">Wi-Fi</div><div class="st2-dl-head">Моб.</div>
          ${[['photos','Фото','photo'],['videos','Видео','play'],['files','Файлы','file']].map(([k,l,ic])=>`
            <div class="st2-dl-row-h">${I(ic)} ${l}</div>
            <span class="switch ${ST2.data.autodl.wifi[k]?'on':''}" onclick="st2DlTgl('wifi','${k}',this)"><i></i></span>
            <span class="switch ${ST2.data.autodl.mobile[k]?'on':''}" onclick="st2DlTgl('mobile','${k}',this)"><i></i></span>`).join('')}
        </div>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('file')} Загрузки файлов</div>
      <div class="st2-grp">
        ${[['always','Всегда','Скачивать документы сразу'],['ask','Спрашивать','Показывать кнопку скачивания'],['never','Никогда','Только по кнопке скачивания']].map(o =>
          `<button class="prow st2-radio ${ST2.data.docsPolicy===o[0]?'on':''}" onclick="st2SetDocsPolicy('${o[0]}')">
             <span class="st2-radio-mark"></span>
             <div class="st2-radio-b"><b>${o[1]}</b><small>${o[2]}</small></div>
           </button>`).join('')}
      </div>
    </div>`;
  }
};
function st2SetCacheLim(v){
  ST2.data.cacheLimit = +v; st2Save();
  const el = document.getElementById('st2CLV');
  const r  = document.getElementById('st2CLR');
  if(el) el.textContent = v + ' МБ';
  if(r)  r.style.setProperty('--st2-fill', ((v-100)/(2000-100)*100) + '%');
}
function st2DlTgl(net, k, el){
  ST2.data.autodl[net][k] = !ST2.data.autodl[net][k]; st2Save();
  if(el) el.classList.toggle('on', ST2.data.autodl[net][k]);
}
function st2SetDocsPolicy(p){ ST2.data.docsPolicy = p; st2Save(); st2Render(); }

/* «размер» разных категорий кэша — стабильный псевдо-разброс от общего */
function st2StorageParts(total){
  const seed = (ST2.lastClear || 42) % 7;
  const media = Math.max(0.5, total * (0.55 + seed*0.01));
  const docs  = Math.max(0.3, total * 0.18);
  const stick = Math.max(0.2, total * 0.09);
  const other = Math.max(0.1, total - media - docs - stick);
  return [
    {v:media, label:'Медиа (фото, видео)', color:'#9AFF00'},
    {v:docs,  label:'Документы',            color:'#5CD3F4'},
    {v:stick, label:'Стикеры и эмодзи',     color:'#F97AC9'},
    {v:other, label:'Прочее',               color:'#8A94A6'},
  ];
}
function st2PieSvg(parts){
  const total = parts.reduce((s,x)=>s+x.v,0) || 1;
  const R = 42, C = 2*Math.PI*R;
  let off = 0;
  const arcs = parts.map(p => {
    const frac = p.v/total, dash = frac*C;
    const seg = `<circle cx="50" cy="50" r="${R}" fill="none" stroke="${p.color}" stroke-width="12" stroke-dasharray="${dash.toFixed(2)} ${(C-dash).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 50 50)" stroke-linecap="butt"/>`;
    off += dash;
    return seg;
  }).join('');
  return `<svg class="st2-pie st2-pie-anim" viewBox="0 0 100 100" aria-label="Распределение кэша">
    <circle class="st2-pie-bg" cx="50" cy="50" r="42" fill="none" stroke-width="12"/>
    ${arcs}
    <text class="st2-pie-cx" x="50" y="52" text-anchor="middle">${total.toFixed(0)}</text>
    <text class="st2-pie-cu" x="50" y="64" text-anchor="middle">МБ</text>
  </svg>`;
}

/* ================= ОФОРМЛЕНИЕ ================= */
ST2_PANELS.theme = {
  title: 'Оформление',
  render(){
    const themeMode = ST2.theme || (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    const ta = ST2.themeAuto;
    return `<p class="st2-panel-desc">Тема, авто-переключение по времени суток и настройки шрифта.</p>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('sun')} Тема</div>
      <div class="st2-grp">
        ${[['dark','Тёмная','Классическая ночная тема','moon'],['light','Светлая','Для яркого света и дня','sun'],['system','Системная','Как в настройках устройства','st2-devices']].map(o=>`
          <button class="prow st2-radio ${themeMode===o[0]?'on':''}" onclick="st2SetTheme('${o[0]}')">
            <span class="st2-radio-mark"></span>
            <div class="st2-radio-b"><b>${o[1]}</b><small>${o[2]}</small></div>
            <span class="st2-radio-tag">${I(o[3])}</span>
          </button>`).join('')}
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-clock')} Расписание темы</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2ThemeAutoTgl(this)">${I('st2-clock')} Автоматически по времени ${st2Sw(ta.on)}</button>
        <div class="st2-quiet${ta.on?' open':''}"><div class="st2-quiet-in">
          <div class="st2-quiet-times">
            <label class="st2-time"><span>тёмная</span><input type="time" value="${esc(ta.dark)}" onchange="st2ThemeAutoTime('dark',this.value)"></label>
            <span class="st2-quiet-arrow">${I('chev')}</span>
            <label class="st2-time"><span>светлая</span><input type="time" value="${esc(ta.light)}" onchange="st2ThemeAutoTime('light',this.value)"></label>
          </div>
          <p class="st2-quiet-note">${I('moon')} По умолчанию: 22:00 → тёмная, 07:00 → светлая. Тема переключится сразу и продолжит держать расписание.</p>
        </div></div>
      </div>
    </div>`;
  }
};
function st2ThemeAutoTgl(btn){
  ST2.themeAuto.on = !ST2.themeAuto.on; st2Save();
  const sw = btn && btn.querySelector('.switch');
  if(sw) sw.classList.toggle('on', ST2.themeAuto.on);
  st2ScheduleThemeAuto();
  st2Render();
  toast(ST2.themeAuto.on ? 'Тема автоматически переключается по времени' : 'Авто-расписание темы выключено');
}
function st2ThemeAutoTime(which,val){
  if(!/^\d\d:\d\d$/.test(val || '')) return;
  ST2.themeAuto[which] = val; st2Save();
  st2ScheduleThemeAuto();
}

/* планировщик авто-темы */
let st2AutoTimer = 0;
function st2ScheduleThemeAuto(){
  if(st2AutoTimer){ clearTimeout(st2AutoTimer); st2AutoTimer = 0; }
  if(!ST2.themeAuto.on) return;
  const now = new Date();
  const cur = now.getHours()*60 + now.getMinutes();
  const df = st2QuietMin(ST2.themeAuto.dark), lf = st2QuietMin(ST2.themeAuto.light);
  const inDark = df < lf ? (cur >= df && cur < lf) : (cur >= df || cur < lf);
  const want = inDark ? 'dark' : 'light';
  if(typeof applyTheme === 'function') applyTheme(want); else document.documentElement.dataset.theme = want;
  const next = st2NextThemeSwitch(cur, df, lf);
  st2AutoTimer = setTimeout(st2ScheduleThemeAuto, next*60*1000);
}
function st2NextThemeSwitch(cur, df, lf){
  const cands = [((df - cur)+1440)%1440 || 1440, ((lf - cur)+1440)%1440 || 1440];
  return Math.max(1, Math.min(...cands));
}

/* ================= ДОСТУПНОСТЬ ================= */
ST2_PANELS.a11y = {
  title: 'Доступность',
  render(){
    const a = ST2.a11y;
    return `<p class="st2-panel-desc">Сделай интерфейс удобнее: крупный шрифт, снижение анимаций, высокий контраст, большие кнопки.</p>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('star')} Размер</div>
      <div class="st2-grp">
        <div class="prow st2-prow-col" style="cursor:default">
          <div class="st2-range" style="width:100%">
            <div class="st2-range-h">${I('edit')} Размер шрифта<span class="st2-range-v" id="st2FSV">${a.fontScale}%</span></div>
            <input type="range" min="85" max="135" step="5" value="${a.fontScale}" oninput="st2SetFont(this.value)" id="st2FSR" style="--st2-fill:${((a.fontScale-85)/50*100)}%">
            <div class="st2-range-ticks"><span>Мельче</span><span>Обычно</span><span>Крупнее</span></div>
          </div>
        </div>
        <button class="prow" onclick="st2A11yTgl('bigTaps',this)">${I('st2-hand')} Большие тап-цели ${st2Sw(a.bigTaps)}</button>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('eye')} Восприятие</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2A11yTgl('reduceMotion',this)">${I('st2-motion')} Уменьшить анимации ${st2Sw(a.reduceMotion)}</button>
        <button class="prow" onclick="st2A11yTgl('highContrast',this)">${I('st2-contrast')} Высокий контраст ${st2Sw(a.highContrast)}</button>
        <button class="prow" onclick="st2A11yTgl('reduceOpacity',this)">${I('sun')} Снизить прозрачность ${st2Sw(a.reduceOpacity)}</button>
      </div>
    </div>`;
  }
};
function st2A11yTgl(k, btn){
  ST2.a11y[k] = !ST2.a11y[k]; st2Save();
  const sw = btn && btn.querySelector('.switch');
  if(sw) sw.classList.toggle('on', ST2.a11y[k]);
  st2ApplyA11y();
}
function st2SetFont(v){
  ST2.a11y.fontScale = +v; st2Save();
  const el = document.getElementById('st2FSV');
  const r  = document.getElementById('st2FSR');
  if(el) el.textContent = v + '%';
  if(r)  r.style.setProperty('--st2-fill', ((v-85)/50*100) + '%');
  st2ApplyA11y();
}
function st2ApplyA11y(){
  const a = ST2.a11y;
  const root = document.documentElement;
  root.classList.toggle('st2-a-motion',   a.reduceMotion);
  root.classList.toggle('st2-a-contrast', a.highContrast);
  root.classList.toggle('st2-a-opacity',  a.reduceOpacity);
  root.classList.toggle('st2-a-tap',      a.bigTaps);
  root.style.setProperty('--st2-font-scale', (a.fontScale/100).toFixed(2));
  document.body.style.fontSize = (a.fontScale === 100 ? '' : (a.fontScale/100 * 15) + 'px');
}

/* ================= ЯЗЫК ================= */
ST2_PANELS.lang = {
  title: 'Язык',
  render(){
    const lang = (typeof LANG !== 'undefined') ? LANG : 'ru';
    const L = [
      ['ru','Русский','РУ','Основной язык OKO'],
      ['en','English','EN','English interface'],
      ['kk','Қазақша','ҚАЗ','Қазақша интерфейс'],
    ];
    return `<p class="st2-panel-desc">Язык интерфейса. Контент от пользователей остаётся на языке оригинала.</p>
    <div class="st2-panel-sec">
      <div class="st2-grp">
        ${L.map(o=>`
          <button class="prow st2-radio ${lang===o[0]?'on':''}" onclick="st2SetLang('${o[0]}')">
            <span class="st2-radio-mark"></span>
            <div class="st2-radio-b"><b>${o[1]}</b><small>${o[3]}</small></div>
            <span class="st2-radio-tag">${o[2]}</span>
          </button>`).join('')}
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-clock')} Формат</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2Tgl('loc','hour24',this)">${I('st2-clock')} 24-часовой формат времени ${st2Sw(ST2.loc.hour24)}</button>
        <div class="prow st2-prow-col" style="cursor:default">
          <span class="st2-prow-lbl">${I('st2-clock')} Начало недели</span>
          <span class="st2-seg st2-seg3">
            ${[['auto','Авто'],['mon','Пн'],['sun','Вс']].map(o=>`<button class="${ST2.loc.weekStart===o[0]?'on':''}" onclick="st2SetLoc('weekStart','${o[0]}')">${o[1]}</button>`).join('')}
          </span>
        </div>
      </div>
    </div>`;
  }
};
function st2SetLoc(k,v){ ST2.loc[k] = v; st2Save(); st2Render(); }

/* ================= ПОМОЩЬ И ОБРАТНАЯ СВЯЗЬ ================= */
ST2_PANELS.help = {
  title: 'Помощь и обратная связь',
  render(){
    const faq = [
      ['Как переключиться между аккаунтами?','Открой «Профиль → Аккаунты» и нажми «Войти» рядом с нужным аккаунтом. Аккаунт активен, если рядом стоит зелёная галочка. Переключение мгновенное — фото, ник и чаты меняются автоматически.'],
      ['Куда девался кэш?','Кэш — это оффлайн-копия сообщений, обложек и медиа. Он живёт локально и очищается кнопкой «Очистить кэш» в разделе <b>Данные и хранилище</b>. Свои сообщения при этом не удаляются.'],
      ['Как включить двухфакторную защиту?','Открой «Аккаунт и вход → Безопасность → Двухфакторная защита». Мы сгенерируем ключ, который добавляется в Google Authenticator или 1Password. При каждом входе нужен будет 6-значный код.'],
      ['Что такое «тихие часы»?','Расписание для входящих уведомлений. В указанный интервал пуши приходят без звука и вибрации. Иконка приложения при этом обновляется как обычно.'],
      ['Как удалить аккаунт?','«Опасная зона → Экспорт и удаление». После подтверждения аккаунт помечен на удаление и стирается через 14 дней. В любой момент можно отменить: достаточно войти в этот раздел ещё раз.'],
      ['Где скачать выгрузку данных?','«Опасная зона → Экспорт данных → JSON». Файл содержит профиль, чаты, платежи и настройки. Данные готовятся локально и не отправляются на сервер.'],
    ];
    return `<div class="st2-help-hero">
      <h4>${I('st2-life')} На связи 24/7</h4>
      <p>Ответим за 3–5 минут в чате поддержки OKO. Если это техническая ошибка — приложи скриншот и опиши шаги.</p>
      <button class="st2-help-btn" onclick="st2OpenSupport()">${I('chat')} Открыть чат поддержки</button>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-tune')} Быстрые действия</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2Bugreport()">${I('flag')} Сообщить о баге<span class="chev">${I('chev')}</span></button>
        <button class="prow" onclick="st2OpenSupport()">${I('chat')} Написать поддержке<span class="chev">${I('chev')}</span></button>
        <button class="prow" onclick="st2CopyDiag()">${I('copy')} Скопировать диагностику<span class="chev">${I('chev')}</span></button>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('st2-help-circle')} Частые вопросы</div>
      <div class="st2-faq">
        ${faq.map(f=>`<details><summary>${esc(f[0])}</summary><div class="st2-faq-body">${f[1]}</div></details>`).join('')}
      </div>
    </div>`;
  }
};
function st2OpenSupport(){
  if(typeof openChatByName === 'function'){
    try{ openChatByName('OKO Support'); return; }catch(e){}
  }
  toast('Пишем в поддержку — ответим в течение 5 минут');
}
function st2Bugreport(){
  showPopup({
    ico:'flag', title:'Сообщить о баге',
    body:`<p style="margin-bottom:10px">Опиши, что произошло — приложим версию, устройство и настройки автоматически.</p>
      <div class="st2-pin"><textarea id="st2Bug" placeholder="Что случилось?" style="width:100%;min-height:110px;background:var(--raised);border:1px solid var(--border);border-radius:var(--r-md);padding:12px;font:inherit;color:var(--text);resize:vertical"></textarea></div>`,
    actions:[{label:'Отмена', ghost:true}, {label:'Отправить', onclick(){
      const v = (document.getElementById('st2Bug')||{}).value || '';
      if(v.trim().length < 10){ toast('Слишком коротко — расскажи подробнее'); return; }
      toast('Багрепорт отправлен · отвечает служба поддержки OKO');
    }}],
  });
}
function st2CopyDiag(){
  const d = {
    ver: st2Ver(),
    ua: navigator.userAgent,
    lang: (typeof LANG !== 'undefined') ? LANG : 'ru',
    theme: document.documentElement.dataset.theme,
    online: navigator.onLine,
    cache: st2CacheSize().toFixed(1) + ' МБ',
    ts: new Date().toISOString(),
  };
  const txt = 'OKO · диагностика\n' + Object.entries(d).map(([k,v])=>k+': '+v).join('\n');
  try{
    navigator.clipboard.writeText(txt).then(()=>toast('Диагностика скопирована — пришли в поддержку'));
  }catch(e){ toast('Не удалось скопировать'); }
}

/* ================= ЮР. ДОКУМЕНТЫ ================= */
ST2_PANELS.legal = {
  title: 'Юридические документы',
  render(){
    return `<p class="st2-panel-desc">Официальные документы: подписывая аккаунт и покупая на OKO, ты соглашаешься с ними.</p>
    <div class="st2-grp">
      <button class="prow" onclick="st2OpenDoc('offer')">${I('file')} Публичная оферта<span class="chev">${I('chev')}</span></button>
      <button class="prow" onclick="st2OpenDoc('privacy')">${I('lock')} Политика конфиденциальности<span class="chev">${I('chev')}</span></button>
      <button class="prow" onclick="st2OpenDoc('refund')">${I('money')} Правила возврата и рефанда<span class="chev">${I('chev')}</span></button>
      <button class="prow" onclick="st2OpenDoc('licenses')">${I('star')} Лицензии и открытый код<span class="chev">${I('chev')}</span></button>
    </div>`;
  }
};
function st2OpenDoc(key){
  const map = {offer:'terms', privacy:'privacy', refund:'refund', licenses:'licenses'};
  const k = map[key] || key;
  if(typeof openLegal === 'function'){ try{ openLegal(k); return; }catch(e){} }
  toast('Документ откроется в разделе «Документы»');
}

/* ================= ОПАСНАЯ ЗОНА ================= */
function st2DelDays(){ if(!ST2.delAt) return 0; const left = Math.ceil((ST2.delAt - Date.now())/86400000); return Math.max(0, left); }
ST2_PANELS.danger = {
  title: 'Опасная зона',
  render(){
    const days = st2DelDays();
    return `<p class="st2-panel-desc">Экспорт данных и удаление аккаунта. Удаление действует с задержкой 14 дней — успеешь передумать.</p>
    <div class="st2-panel-sec">
      <div class="st2-panel-h">${I('file')} Экспорт</div>
      <div class="st2-grp">
        <button class="prow" onclick="st2ExportJson()">${I('file')} Скачать данные (JSON)<span class="st2-val">.json</span><span class="chev">${I('chev')}</span></button>
        <button class="prow" onclick="st2Download()">${I('file')} Читаемая выгрузка (TXT)<span class="st2-val">.txt</span><span class="chev">${I('chev')}</span></button>
      </div>
    </div>
    <div class="st2-panel-sec">
      <div class="st2-panel-h" style="color:var(--danger)">${I('trash')} Удаление</div>
      <div class="st2-grp st2-danger">
        <h4 style="padding:6px 8px 0">${I('trash')} Удалить аккаунт</h4>
        <p style="padding:0 8px 6px">Профиль, чаты, кошелёк, сертификаты Академии и вся история будут стёрты безвозвратно. Удаление начинается через 14 дней после подтверждения — за это время его можно отменить.</p>
        ${ST2.delAt ? `<div class="st2-del-status">
            <b>${I('st2-clock')} Аккаунт помечен на удаление</b>
            Автоудаление через ${days} дн. — до ${new Date(ST2.delAt).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
            <button class="st2-del-cancel" onclick="st2CancelDel()">Отменить удаление</button>
          </div>` : `<button class="st2-del" onclick="st2DeleteAsk()" style="margin:10px 8px 6px;width:calc(100% - 16px)">Удалить аккаунт через 14 дней</button>`}
      </div>
    </div>`;
  }
};

/* ================= ЧЁРНЫЙ СПИСОК (панель) ================= */
ST2_PANELS.blocked = {
  title: 'Чёрный список',
  render(){ return `<div id="st2BlockedBody"></div>`; },
  after(){ st2RenderBlocked(); }
};

/* ---------- открыть / закрыть (navstack) ---------- */
function st2Open(){
  ST2_STACK = [{id:'root', ctx:{}, title:'Настройки'}];
  st2Render();
  const v = document.getElementById('st2View');
  if(v && !v.classList.contains('open')){
    v.classList.add('open');
    if(typeof nvPush === 'function') nvPush('view:st2', st2Close);
  }
}
function st2Close(){
  const v = document.getElementById('st2View');
  if(v) v.classList.remove('open');
  ST2_STACK = [];
  if(typeof nvPop === 'function') nvPop('view:st2');
}

/* ---------- версия сборки ---------- */
function st2Ver(){
  const m = document.querySelector('.head-build,.ver-chip,.build-chip');
  if(m) return (m.textContent||'').replace(/[^\d.v]/g,'') || '';
  const t = document.body.textContent.match(/сборка v([\d.]+)/); return t ? 'v'+t[1] : '';
}

/* ---------- профиль-панель: хуки ---------- */
function st2OpenEdit(){ if(typeof openEdit === 'function') openEdit(); }
function st2GoPlans(){
  st2Close();
  if(typeof scrollToPlans === 'function') scrollToPlans();
  else{
    const el = document.querySelector('#screen-profile .plan-cards,#screen-profile .section-h');
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  }
}
function st2CopyPublic(){
  const url = 'https://oko.app/@' + st2Nick();
  try{ navigator.clipboard.writeText(url).then(()=>toast('Ссылка скопирована: ' + url)); }
  catch(e){ toast('Публичная ссылка: ' + url); }
}
function st2LinkTg(err){
  if(ST2.tg){
    showPopup({ico:'send', title:'Отвязать Telegram', body:'Аккаунт <b>'+esc(ST2.tg)+'</b> будет отключён от OKO. Вход через Telegram перестанет работать.',
      actions:[{label:'Отмена', ghost:true},{label:'Отвязать', onclick(){ ST2.tg = null; st2Save(); st2Render(); toast('Telegram отвязан'); }}]});
    const ok = document.querySelector('#okoPopup [data-pa="1"]'); if(ok) ok.classList.add('st2-btn-danger');
    return;
  }
  st2Prompt({
    ico:'send', title:'Привязать Telegram', err: err,
    note:'Укажи @ник в Telegram — привяжем аккаунт после подтверждения через бота @okoappbot.',
    ph:'@nickname', saveLabel:'Привязать',
    save(v){
      v = v.replace(/^@/,'').trim();
      if(!/^[a-zA-Z0-9_]{4,32}$/.test(v)) return st2LinkTg('Ник Telegram: 4–32 латинских, цифры или _');
      ST2.tg = '@'+v; st2Save(); st2Render(); toast('Telegram привязан: @'+v);
    },
  });
}
function st2LinkStub(name){
  showPopup({ico:'plus', title:'Привязать '+name,
    body:'Привязка '+name+' появится после включения OAuth на боевом бэкенде — сейчас интерфейс в сборке.',
    actions:[{label:'Понятно'}]});
}

/* ---------- отмена запланированного удаления ---------- */
function st2CancelDel(){
  ST2.delAt = 0; st2Save(); st2Render();
  toast('Удаление аккаунта отменено');
}

/* ---------- тумблеры ---------- */
function st2Tgl(group, k, btn){
  ST2[group][k] = !ST2[group][k];
  st2Save(); st2PushCore();
  const sw = btn && btn.querySelector('.switch');
  if(sw) sw.classList.toggle('on', ST2[group][k]);
}

/* ---------- живой поиск: индекс всех настроек с прыжком в панель ---------- */
const ST2_SEARCH_INDEX = [
  /* profile */
  ['Профиль','profile','user','Личное · публичное'],
  ['Аватар · фото профиля','profile','camera','Личное'],
  ['Обложка','profile','st2-image','Личное'],
  ['Имя и био','profile','edit','Личное'],
  ['Ник · nickname · username','profile','st2-key','Личное'],
  ['Публичная ссылка · шеринг','profile','share','Личное'],
  ['Тариф · план · подписка','profile','crown','Личное'],
  /* accounts */
  ['Аккаунты · переключение','accounts','users','Профиль'],
  ['Добавить аккаунт','accounts','plus','Профиль'],
  /* account */
  ['Почта · email','account','st2-mail','Аккаунт и вход'],
  ['Телефон','account','phone','Аккаунт и вход'],
  ['Telegram · TG · привязка','account','send','Аккаунт и вход'],
  ['Google · привязка OAuth','account','google','Аккаунт и вход'],
  ['Apple ID · привязка','account','apple','Аккаунт и вход'],
  /* security */
  ['Двухфакторная защита · 2FA · TOTP','security','st2-shield','Безопасность'],
  ['Код-пароль при входе · PIN','security','lock','Безопасность'],
  ['Автоблокировка','security','st2-clock','Безопасность'],
  ['Сменить пароль','security','st2-key','Безопасность'],
  /* sessions */
  ['Активные сессии · устройства','sessions','st2-devices','Безопасность'],
  ['Завершить все сессии','sessions','trash','Безопасность'],
  /* privacy */
  ['Онлайн · последнее посещение','privacy','eye','Приватность'],
  ['Отчёты о прочтении','privacy','check2','Приватность'],
  ['Кто может писать первым','privacy','send','Приватность'],
  ['Кто может звонить','privacy','phone','Приватность'],
  ['Кто видит телефон','privacy','phone','Приватность'],
  ['Кто видит фото профиля','privacy','photo','Приватность'],
  ['Кто видит статус','privacy','star','Приватность'],
  ['Кто видит посты','privacy','feed','Приватность'],
  ['Кто видит истории · сторис','privacy','camera','Приватность'],
  ['Чёрный список · блокировки','blocked','st2-ban','Приватность'],
  /* notif */
  ['Уведомления · пуши','notif','bell','Уведомления'],
  ['Звук уведомлений','notif','st2-speaker','Уведомления'],
  ['Вибрация','notif','st2-vibrate','Уведомления'],
  ['Превью текста','notif','eye','Уведомления'],
  ['Тихие часы · не беспокоить · DND','notif','moon','Уведомления'],
  ['Каналы уведомлений','notifChannels','st2-tune','Уведомления'],
  ['Лайки и реакции','notifChannels','heart','Уведомления'],
  ['Комментарии','notifChannels','comment','Уведомления'],
  ['Партнёрка','notifChannels','briefcase','Уведомления'],
  ['Академия · уроки','notifChannels','star','Уведомления'],
  ['Игры · ставки','notifChannels','st2-controller','Уведомления'],
  /* data */
  ['Данные и хранилище · кэш','data','st2-db','Данные'],
  ['Очистить кэш','data','trash','Данные'],
  ['Лимит кэша','data','st2-db','Данные'],
  ['Автозагрузка медиа Wi-Fi','data','st2-wifi','Данные'],
  ['Автозагрузка на мобильном','data','st2-wifi','Данные'],
  ['Загрузка документов','data','file','Данные'],
  /* theme */
  ['Тема · тёмная · светлая','theme','sun','Оформление'],
  ['Расписание темы · авто · dark mode','theme','st2-clock','Оформление'],
  /* a11y */
  ['Доступность · a11y','a11y','st2-eye','Оформление'],
  ['Размер шрифта','a11y','edit','Оформление'],
  ['Большие тап-цели','a11y','st2-hand','Оформление'],
  ['Уменьшить анимации · motion-reduce','a11y','st2-motion','Оформление'],
  ['Высокий контраст','a11y','st2-contrast','Оформление'],
  ['Снизить прозрачность','a11y','sun','Оформление'],
  /* lang */
  ['Язык · language · русский english қазақша','lang','globe','Язык'],
  ['24-часовой формат времени','lang','st2-clock','Язык'],
  ['Начало недели','lang','st2-clock','Язык'],
  /* help */
  ['Помощь · FAQ · частые вопросы','help','st2-life','Помощь'],
  ['Чат поддержки OKO','help','chat','Помощь'],
  ['Сообщить о баге · багрепорт','help','flag','Помощь'],
  ['Диагностика','help','copy','Помощь'],
  /* legal */
  ['Оферта · публичная','legal','file','Документы'],
  ['Политика конфиденциальности','legal','lock','Документы'],
  ['Возврат · рефанд','legal','money','Документы'],
  ['Лицензии · open source','legal','star','Документы'],
  /* danger */
  ['Экспорт данных JSON','danger','file','Опасная зона'],
  ['Скачать выгрузку','danger','file','Опасная зона'],
  ['Удалить аккаунт · с задержкой 14 дней','danger','trash','Опасная зона'],
];
function st2Search(qv){
  const root = document.getElementById('st2Groups');
  const res  = document.getElementById('st2SearchResults');
  const lab  = document.getElementById('st2Search');
  const empty= document.getElementById('st2SearchEmpty');
  const raw = String(qv || '');
  if(lab) lab.classList.toggle('has', !!raw.trim());
  const q = raw.trim().toLowerCase();
  if(!q){
    if(root) root.style.display = '';
    if(res)  res.innerHTML = '';
    if(empty) empty.style.display = 'none';
    return;
  }
  if(root) root.style.display = 'none';
  const hits = ST2_SEARCH_INDEX.filter(r => (r[0] + ' ' + r[3]).toLowerCase().indexOf(q) > -1).slice(0, 24);
  if(!hits.length){
    if(res)  res.innerHTML = '';
    if(empty) empty.style.display = '';
    return;
  }
  if(empty) empty.style.display = 'none';
  if(!res) return;
  res.innerHTML = `<div class="st2-search-res">${
    hits.map(h => `<button class="prow" onclick="st2SearchGo('${h[1]}')">
      <span class="st2-nav-ico">${I(h[2])}</span>
      <span>${st2SearchHl(h[0], q)}</span>
      <span class="st2-search-res-tag">${esc(h[3])}</span>
      <span class="chev">${I('chev')}</span></button>`).join('')
  }</div>`;
}
function st2SearchHl(s, q){
  const idx = s.toLowerCase().indexOf(q);
  if(idx < 0) return esc(s);
  return esc(s.slice(0,idx)) + '<b style="color:var(--accent)">' + esc(s.slice(idx, idx+q.length)) + '</b>' + esc(s.slice(idx+q.length));
}
function st2SearchGo(id){
  st2SearchClear();
  st2Push(id);
}
function st2SearchClear(){
  const inp = document.getElementById('st2SearchInp');
  if(inp) inp.value = '';
  st2Search('');
  if(inp) try{ inp.focus(); }catch(e){}
}

/* ---------- тихие часы / не беспокоить (расписание беззвучных уведомлений) ---------- */
function st2QuietMin(t){ const m = /^(\d\d):(\d\d)$/.exec(t || ''); return m ? (+m[1] * 60 + +m[2]) : 0; }
function st2QuietActive(){
  const qq = ST2.notif.quiet;
  if(!qq || !qq.on) return false;
  const f = st2QuietMin(qq.from), t = st2QuietMin(qq.to);
  if(f === t) return false;
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes();
  return f < t ? (now >= f && now < t) : (now >= f || now < t);
}
function st2QuietChip(){
  const qq = ST2.notif.quiet;
  if(!qq || !qq.on) return '';
  return st2QuietActive()
    ? `<span class="chip st2-chip st2-chip-on">${I('moon')} сейчас тихо</span>`
    : `<span class="chip st2-chip">${esc(qq.from)}–${esc(qq.to)}</span>`;
}
function st2QuietRefreshChip(){
  const prow = document.querySelector('.prow[onclick="st2QuietTgl(this)"]');
  if(!prow) return;
  const old = prow.querySelector('.chip');
  if(old) old.remove();
  const html = st2QuietChip();
  const sw = prow.querySelector('.switch');
  if(html && sw) sw.insertAdjacentHTML('beforebegin', html);
}
function st2QuietTgl(btn){
  const qq = ST2.notif.quiet;
  qq.on = !qq.on; st2Save();
  const sw = btn && btn.querySelector('.switch');
  if(sw) sw.classList.toggle('on', qq.on);
  const box = document.getElementById('st2Quiet');
  if(box) box.classList.toggle('open', qq.on);
  st2QuietRefreshChip();
  toast(qq.on ? 'Тихие часы: с ' + qq.from + ' до ' + qq.to : 'Тихие часы выключены');
}
function st2QuietTime(which, val){
  if(!/^\d\d:\d\d$/.test(val || '')) return;
  ST2.notif.quiet[which] = val; st2Save();
  st2QuietRefreshChip();
}

/* ---------- автоблокировка (запрос код-пароля после простоя) ---------- */
function st2SetAutolock(v){
  ST2.sec.autolock = v; st2Save();
  const seg = document.getElementById('st2LockSeg');
  if(seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.getAttribute('data-v') === v));
  const M = {now:'сразу', '1m':'через 1 минуту', '5m':'через 5 минут', '1h':'через час'};
  toast('Автоблокировка: ' + (M[v] || v));
}

/* ---------- Оформление: тема / язык ---------- */
function st2ApplyTheme(mode){
  let t = mode;
  if(mode === 'system'){
    t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  if(typeof applyTheme === 'function') applyTheme(t);
  else document.documentElement.dataset.theme = t;
}
function st2SetTheme(mode){
  ST2.theme = mode; st2Save();
  st2ApplyTheme(mode);
  const seg = document.getElementById('st2ThemeSeg');
  if(seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.getAttribute('data-v') === mode));
  toast(mode === 'system' ? 'Тема: как в системе' : (mode === 'light' ? 'Тема: светлая' : 'Тема: тёмная'));
}
function st2SetLang(l){
  if(typeof setLang === 'function') setLang(l);           /* сам покажет toast + прогонит хуки */
  else { try{ localStorage.setItem('oko-lang', l); }catch(e){} }
  const seg = document.getElementById('st2LangSeg');
  if(seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.getAttribute('data-v') === l));
}

/* ---------- попап с инпутом (значение читаем из замыкания: popup закрывается ДО onclick) ---------- */
function st2Attr(t){ return esc(t).replace(/"/g, '&quot;'); }
let _st2Inp = null;
let st2_pwOld = null, st2_pwNew = null;
function st2Prompt(o){ /* {ico,title,note,val,ph,saveLabel,danger,err,mode,save(v)} */
  showPopup({
    ico: o.ico, title: o.title,
    body: `${o.note ? `<p style="margin-bottom:12px">${o.note}</p>` : ''}
      <div class="st2-pin"><input id="st2PopInp" value="${st2Attr(o.val || '')}" placeholder="${st2Attr(o.ph || '')}" autocomplete="off"></div>
      ${o.err ? `<div class="st2-perr">${esc(o.err)}</div>` : ''}`,
    actions: [
      {label:'Отмена', ghost:true},
      {label: o.saveLabel || 'Сохранить', onclick: ()=> o.save(_st2Inp ? _st2Inp.value.trim() : '')},
    ],
  });
  _st2Inp = document.getElementById('st2PopInp');
  const ok = document.querySelector('#okoPopup [data-pa="1"]');
  if(o.danger && ok) ok.classList.add('st2-btn-danger');
  if(_st2Inp){
    if(o.mode === 'num'){ _st2Inp.setAttribute('inputmode', 'numeric'); _st2Inp.setAttribute('maxlength', String(o.max || 6)); }
    setTimeout(()=>{ try{ _st2Inp.focus(); _st2Inp.select(); }catch(e){} }, 60);
    _st2Inp.addEventListener('keydown', e => { if(e.key === 'Enter' && ok) ok.click(); });
  }
}

/* ---------- Аккаунт: ник (синк PROFILE + активный аккаунт), почта, телефон ---------- */
function st2EditNick(err){
  st2Prompt({
    ico:'edit', title:'Смена ника', err: err,
    note:'3–16 символов: латиница, цифры, подчёркивание. Ник обновится в профиле, ленте и чатах.',
    val: st2Nick(), ph:'nickname',
    save(v){
      v = v.replace(/^@/, '');
      if(!/^[a-z0-9_]{3,16}$/i.test(v)) return st2EditNick('Недопустимый ник — проверь формат');
      ST2.nick = v;
      if(typeof PROFILE !== 'undefined'){
        PROFILE.nick = v;
        if(typeof renderMyProfile === 'function') renderMyProfile();
      }
      st2SyncActiveFromProfile(); st2Save();
      st2Render(); toast('Ник обновлён: @' + v);
    },
  });
}
function st2EditEmail(err){
  st2Prompt({
    ico:'st2-mail', title:'Почта', err: err,
    note:'На новый адрес придёт письмо-подтверждение.',
    val: ST2.email, ph:'you@example.com',
    save(v){
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return st2EditEmail('Похоже, в адресе опечатка');
      ST2.email = v; st2Save(); st2Render();
      toast('Письмо-подтверждение отправлено');
    },
  });
}
function st2EditPhone(err){
  st2Prompt({
    ico:'phone', title:'Телефон', err: err,
    note:'Телефон используется для входа и восстановления доступа.',
    val: ST2.phone, ph:'+7 900 000-00-00',
    save(v){
      if(!/^\+?[\d\s()-]{10,18}$/.test(v)) return st2EditPhone('Проверь номер — нужен формат +7 …');
      ST2.phone = v; st2Save(); st2Render();
      toast('Код подтверждения отправлен по SMS');
    },
  });
}

/* ---------- Аккаунты: переключение / добавление / удаление ---------- */
function st2SwitchAccount(id){
  if(id === ST2.activeAcc) return;
  const a = ST2.accounts.find(x => x.id === id);
  if(!a) return;
  st2SyncActiveFromProfile();          /* сохранить текущий стейт перед уходом */
  ST2.activeAcc = id; ST2.nick = a.nick;
  if(typeof PROFILE !== 'undefined'){
    st2ApplyAccToProfile(a);
    if(typeof renderMyProfile === 'function') renderMyProfile();
  }
  st2Save();
  const el = document.querySelector(`[data-acc="${id}"]`);
  if(el){ el.classList.add('st2-acc-flash'); setTimeout(()=> st2Render(), 220); }
  else st2Render();
  toast('Аккаунт: ' + a.name);
}
function st2AddAccount(err){
  st2Prompt({
    ico:'plus', title:'Добавить аккаунт', err: err,
    note:'Войдите в другой аккаунт OKO — введите его ник, данные подтянутся автоматически.',
    ph:'nickname', saveLabel:'Войти',
    save(v){
      v = v.replace(/^@/, '');
      if(!/^[a-z0-9_]{3,16}$/i.test(v)) return st2AddAccount('Недопустимый ник — проверь формат');
      if(ST2.accounts.some(a => (a.nick || '').toLowerCase() === v.toLowerCase()))
        return st2AddAccount('Этот аккаунт уже добавлен');
      const name = v.charAt(0).toUpperCase() + v.slice(1);
      const id = 'acc' + Date.now();
      ST2.accounts.push({id, name, nick:v, tier:'FREE', role:'user', bio:''});
      st2Save();
      st2SwitchAccount(id);
      toast('Вошли как @' + v);
    },
  });
}
function st2RemoveAccount(id){
  const a = ST2.accounts.find(x => x.id === id);
  if(!a || a.id === ST2.activeAcc || a.role === 'owner') return;
  showPopup({
    ico:'trash', title:'Убрать аккаунт?',
    body:`Аккаунт «${esc(a.name)}» (@${esc(a.nick)}) исчезнет из списка на этом устройстве. Сам аккаунт не удаляется — вы сможете войти снова.`,
    actions:[
      {label:'Отмена', ghost:true},
      {label:'Убрать', onclick(){
        ST2.accounts = ST2.accounts.filter(x => x.id !== id);
        st2Save(); st2Render(); toast('Аккаунт убран');
      }},
    ],
  });
  const ok = document.querySelector('#okoPopup [data-pa="1"]');
  if(ok) ok.classList.add('st2-btn-danger');
}

/* ---------- Безопасность: 2FA (честная демо-заглушка), код-пароль, смена пароля ---------- */
function st2GenSecret(){
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let s = '';
  for(let i = 0; i < 16; i++){ if(i && i % 4 === 0) s += ' '; s += A[Math.floor(Math.random() * 32)]; }
  return s;
}
function st2TwoFA(){
  if(ST2.sec.twofa){
    showPopup({
      ico:'st2-shield', title:'Отключить 2FA?',
      body:'Вход снова будет защищён только паролем. Рекомендуем держать двухфакторную защиту включённой.',
      actions:[
        {label:'Отмена', ghost:true},
        {label:'Отключить', onclick(){ ST2.sec.twofa = false; ST2.sec.secret = null; st2Save(); st2Render(); toast('2FA отключена'); }},
      ],
    });
    const ok = document.querySelector('#okoPopup [data-pa="1"]');
    if(ok) ok.classList.add('st2-btn-danger');
    return;
  }
  const secret = st2GenSecret();
  ST2.sec.secret = secret;
  showPopup({
    ico:'st2-shield', title:'Двухфакторная защита',
    body:`<p style="margin-bottom:10px">Откройте приложение-аутентификатор (Google Authenticator, 1Password, OKO&nbsp;Key) и добавьте ключ вручную:</p>
      <div class="st2-2fa-key">${esc(secret)}</div>
      <div class="st2-note"><b>Честно:</b> в этой сборке код подтверждения не сверяется с сервером — рабочая проверка TOTP подключается на боевом бэкенде. Введите любые 6&nbsp;цифр, чтобы завершить демонстрацию.</div>`,
    actions:[
      {label:'Отмена', ghost:true},
      {label:'Ввести код', onclick: ()=> st2TwoFACode()},
    ],
  });
}
function st2TwoFACode(err){
  st2Prompt({
    ico:'st2-shield', title:'Код из приложения', err: err, mode:'num',
    note:'Введите 6-значный код из аутентификатора.',
    ph:'000000', saveLabel:'Включить',
    save(v){
      if(!/^\d{6}$/.test(v)) return st2TwoFACode('Нужно ровно 6 цифр');
      ST2.sec.twofa = true; st2Save(); st2Render();
      toast('Двухфакторная защита включена');
    },
  });
}
function st2Passcode(){
  if(ST2.sec.passcode){
    showPopup({
      ico:'lock', title:'Отключить код-пароль?',
      body:'Приложение перестанет запрашивать код при входе.',
      actions:[
        {label:'Отмена', ghost:true},
        {label:'Отключить', onclick(){ ST2.sec.passcode = false; ST2.sec.pin = null; st2Save(); st2Render(); toast('Код-пароль отключён'); }},
      ],
    });
    const ok = document.querySelector('#okoPopup [data-pa="1"]');
    if(ok) ok.classList.add('st2-btn-danger');
    return;
  }
  st2PinSet1();
}
function st2PinSet1(err){
  st2Prompt({
    ico:'lock', title:'Код-пароль', err: err, mode:'num', max:4,
    note:'Придумайте 4-значный код — он будет запрашиваться при входе в приложение.',
    ph:'4 цифры', saveLabel:'Далее',
    save(v){ if(!/^\d{4}$/.test(v)) return st2PinSet1('Нужно ровно 4 цифры'); st2PinSet2(v); },
  });
}
function st2PinSet2(first, err){
  st2Prompt({
    ico:'lock', title:'Повторите код', err: err, mode:'num', max:4,
    note:'Введите код ещё раз для подтверждения.',
    ph:'4 цифры', saveLabel:'Включить',
    save(v){
      if(v !== first) return st2PinSet2(first, 'Коды не совпадают');
      ST2.sec.passcode = true; ST2.sec.pin = first; st2Save(); st2Render();
      toast('Код-пароль включён');
    },
  });
}
function st2ChangePass(err){
  showPopup({
    ico:'st2-key', title:'Сменить пароль',
    body:`<div class="st2-pin"><input id="st2PwOld" type="password" placeholder="Текущий пароль" autocomplete="off"></div>
      <div class="st2-pin" style="margin-top:10px"><input id="st2PwNew" type="password" placeholder="Новый пароль: минимум 8 символов" autocomplete="off"></div>
      ${err ? `<div class="st2-perr">${esc(err)}</div>` : ''}`,
    actions:[
      {label:'Отмена', ghost:true},
      {label:'Сохранить', onclick: st2ChangePassSave},
    ],
  });
  st2_pwOld = document.getElementById('st2PwOld');
  st2_pwNew = document.getElementById('st2PwNew');
  const ok = document.querySelector('#okoPopup [data-pa="1"]');
  if(st2_pwOld) setTimeout(()=>{ try{ st2_pwOld.focus(); }catch(e){} }, 60);
  if(st2_pwNew && ok) st2_pwNew.addEventListener('keydown', e => { if(e.key === 'Enter') ok.click(); });
}
function st2ChangePassSave(){
  const oldv = st2_pwOld ? st2_pwOld.value : '';
  const nv   = st2_pwNew ? st2_pwNew.value : '';
  if(!oldv)          return st2ChangePass('Введите текущий пароль');
  if(nv.length < 8)  return st2ChangePass('Новый пароль слишком короткий, минимум 8 символов');
  if(nv === oldv)    return st2ChangePass('Новый пароль совпадает со старым');
  toast('Пароль изменён');
}

/* ---------- Данные: очистка кэша с подсчётом + выгрузка .txt ---------- */
let st2Clearing = false;
function st2ClearCache(){
  if(st2Clearing) return;
  st2Clearing = true;
  const row = document.getElementById('st2CacheRow');
  const el = document.getElementById('st2CacheVal');
  if(row) row.classList.add('st2-clearing');
  const from = st2CacheSize(), t0 = performance.now(), dur = 1500;
  (function tick(now){
    const p = Math.min(1, ((now || performance.now()) - t0) / dur);
    if(el) el.textContent = (from * (1 - p * p)).toFixed(1) + ' МБ';
    if(p < 1) return requestAnimationFrame(tick);
    ST2.lastClear = Date.now(); st2Save();
    st2Clearing = false;
    if(row) row.classList.remove('st2-clearing');
    if(el) el.textContent = st2CacheSize().toFixed(1) + ' МБ';
    toast('Кэш очищен · освобождено ' + from.toFixed(1) + ' МБ');
  })();
}
function st2Download(){
  const p = (typeof PROFILE !== 'undefined') ? PROFILE : {name:'—', nick: st2Nick(), tier:'—', bio:''};
  const themeMode = ST2.theme || (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const L = ['OKO — выгрузка данных аккаунта', 'Дата: ' + new Date().toLocaleString('ru-RU'), ''];
  L.push('=== ПРОФИЛЬ ===', 'Имя: ' + p.name, 'Ник: @' + p.nick, 'Тариф: ' + p.tier,
         'Почта: ' + ST2.email, 'Телефон: ' + ST2.phone, 'О себе: ' + (p.bio || '—'), '');
  L.push('=== НАСТРОЙКИ ===',
         'Уведомления: ' + JSON.stringify(ST2.notif),
         'Приватность: ' + JSON.stringify(ST2.priv),
         'Тема: ' + themeMode + ' · Язык: ' + ((typeof LANG !== 'undefined') ? LANG : 'ru'),
         'Двухфакторная защита: ' + (ST2.sec.twofa ? 'вкл' : 'выкл') + ' · Код-пароль: ' + (ST2.sec.passcode ? 'вкл' : 'выкл'), '');
  if(ST2.accounts.length){
    L.push('=== АККАУНТЫ НА УСТРОЙСТВЕ ===');
    ST2.accounts.forEach(a => L.push('  ' + a.name + ' · @' + a.nick + ' · ' + (a.tier || 'FREE') + (a.id === ST2.activeAcc ? ' (активен)' : '')));
    L.push('');
  }
  if(typeof WALLET !== 'undefined'){
    L.push('=== КОШЕЛЁК ===', 'Счёт: ' + WALLET.acc, 'Баланс: ' + WALLET.balance + ' ₽', 'В холде: ' + WALLET.hold + ' ₽');
    (WALLET.ledger || []).slice(0, 30).forEach(e =>
      L.push('  ' + (e.d || '') + '  ' + (e.sum > 0 ? '+' : '') + e.sum + ' ₽  ' + (e.why || '')));
    L.push('');
  }
  L.push('=== СЕССИИ ===');
  st2Alive().forEach(s => L.push('  ' + s.dev + ' · ' + s.app + (s.cur ? ' (текущая)' : ' · ' + s.geo)));
  L.push('', 'Файл сформирован приложением OKO. Данные хранятся локально на устройстве.');
  try{
    const url = URL.createObjectURL(new Blob([L.join('\n')], {type:'text/plain;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url; a.download = 'oko-data-' + st2Nick() + '.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 4000);
    toast('Файл с данными скачан');
  }catch(e){ toast('Не удалось сформировать файл'); }
}

/* ---------- Сессии ---------- */
function st2Kill(id){
  const s = ST2_SES.find(x => x.id === id);
  if(!s) return;
  showPopup({
    ico:'st2-devices', title:'Завершить сессию?',
    body:`Устройство «${esc(s.dev)}» будет отключено от аккаунта. Для входа понадобится пароль.`,
    actions:[
      {label:'Отмена', ghost:true},
      {label:'Завершить', onclick(){
        const el = document.querySelector(`[data-st2ses="${id}"]`);
        if(el) el.classList.add('st2-out');
        ST2.killed.push(id); st2Save();
        setTimeout(()=>{ st2Render(); toast('Сессия завершена'); }, 300);
      }},
    ],
  });
  const ok = document.querySelector('#okoPopup [data-pa="1"]');
  if(ok) ok.classList.add('st2-btn-danger');
}
function st2KillAll(){
  showPopup({
    ico:'st2-devices', title:'Завершить остальные?',
    body:'Все сессии, кроме текущего устройства, будут отключены.',
    actions:[
      {label:'Отмена', ghost:true},
      {label:'Завершить все', onclick(){
        ST2_SES.forEach(s => { if(!s.cur && ST2.killed.indexOf(s.id) < 0) ST2.killed.push(s.id); });
        st2Save(); st2Render(); toast('Остальные сессии завершены');
      }},
    ],
  });
  const ok = document.querySelector('#okoPopup [data-pa="1"]');
  if(ok) ok.classList.add('st2-btn-danger');
}

/* ---------- Опасная зона: двойное подтверждение удаления ---------- */
function st2DeleteAsk(){
  showPopup({
    ico:'trash', title:'Удалить аккаунт?',
    body:'После подтверждения аккаунт перейдёт в режим удаления. Через 14 дней будут стёрты безвозвратно:<br>· профиль и подписчики<br>· чаты, каналы и сторис<br>· кошелёк и история операций<br>· сертификаты Академии<br><br>Отменить удаление можно в любой момент до конца отсчёта.',
    actions:[
      {label:'Отмена', ghost:true},
      {label:'Продолжить', onclick: ()=> st2DeleteConfirm()},
    ],
  });
  const ok = document.querySelector('#okoPopup [data-pa="1"]');
  if(ok) ok.classList.add('st2-btn-danger');
}
function st2DeleteConfirm(err){
  st2Prompt({
    ico:'trash', title:'Последний шаг', danger:true, err: err,
    note:'Для подтверждения введи свой ник <b>@' + esc(st2Nick()) + '</b>. Аккаунт будет помечен на удаление и стёрт через 14 дней.',
    ph:'@' + st2Nick(), saveLabel:'Пометить на удаление',
    save(v){
      if(v.replace(/^@/, '').toLowerCase() !== st2Nick().toLowerCase())
        return st2DeleteConfirm('Ник не совпадает — аккаунт не помечен');
      ST2.delAt = Date.now() + 14*24*3600*1000;
      st2Save(); st2Render();
      toast('Удаление запланировано · осталось 14 дней');
    },
  });
}
function st2DoDelete(){
  try{ localStorage.clear(); }catch(e){}
  toast('Аккаунт удалён. До встречи!');
  document.body.style.transition = 'opacity .5s';
  document.body.style.opacity = '0';
  setTimeout(()=> location.reload(), 650); /* oko-auth стёрт -> загрузка на экран входа */
}

/* JSON-выгрузка: профиль + чаты + платежи + настройки (готовится локально) */
function st2ExportJson(){
  const p = (typeof PROFILE !== 'undefined') ? PROFILE : {};
  const themeMode = ST2.theme || (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const chats = [];
  try{
    if(typeof CHATS !== 'undefined' && Array.isArray(CHATS)){
      CHATS.slice(0, 60).forEach(c => {
        chats.push({name:c.name, kind:c.kind || 'chat', unread:c.unread || 0,
          lastMsg: (c.msgs && c.msgs.length ? String(c.msgs[c.msgs.length-1].t || c.msgs[c.msgs.length-1].text || '').slice(0, 240) : null),
          count: (c.msgs || []).length});
      });
    }
  }catch(e){}
  const wallet = {};
  try{
    if(typeof WALLET !== 'undefined'){
      wallet.account = WALLET.acc; wallet.balance = WALLET.balance; wallet.hold = WALLET.hold;
      wallet.ledger = (WALLET.ledger || []).slice(0, 300).map(e => ({date:e.d, amount:e.sum, note:e.why}));
    }
  }catch(e){}
  const data = {
    format: 'oko-account-export',
    version: 2,
    generatedAt: new Date().toISOString(),
    profile: {name:p.name, nick:st2Nick(), tier:p.tier, role:p.role, bio:p.bio, status:p.status, avatar:!!p.avatar, cover:!!p.cover,
              email:ST2.email, phone:ST2.phone, telegram:ST2.tg},
    accounts: ST2.accounts.map(a => ({id:a.id, name:a.name, nick:a.nick, tier:a.tier, role:a.role,
                                     active: a.id === ST2.activeAcc})),
    settings: {
      notif: ST2.notif, privacy: ST2.priv, security: {twofa:ST2.sec.twofa, passcode:ST2.sec.passcode, autolock:ST2.sec.autolock},
      theme: themeMode, themeAuto: ST2.themeAuto,
      language: (typeof LANG !== 'undefined') ? LANG : 'ru',
      accessibility: ST2.a11y, dataStorage: ST2.data, locale: ST2.loc,
    },
    chats, wallet,
    sessions: st2Alive().map(s => ({device:s.dev, app:s.app, current:!!s.cur, geo:s.geo || null})),
    blocked: ST2.blocked.slice(),
    deleteScheduledAt: ST2.delAt ? new Date(ST2.delAt).toISOString() : null,
  };
  try{
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url; a.download = 'oko-export-' + st2Nick() + '-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 4000);
    toast('JSON-выгрузка скачана · ' + (JSON.stringify(data).length/1024).toFixed(1) + ' КБ');
  }catch(e){ toast('Не удалось сформировать файл'); }
}

/* ================= ПРОФИЛЬ: аватар + обложка (реальная загрузка, canvas-сжатие, персист) ================= */
/* хранилище — в PROFILE.avatar / PROFILE.cover (dataURL) + per-account в ST2.accounts.
   Единый источник аккаунтов — ST2, поэтому фото переключается вместе с аккаунтом. */

/* cover-fit сжатие файла в dataURL нужного размера */
function st2FitImage(file, cw, ch, quality, cb){
  if(!file || !/^image\//.test(file.type)){ toast('Нужен файл изображения'); return; }
  const rd = new FileReader();
  rd.onload = function(){
    const img = new Image();
    img.onload = function(){
      const sw = img.naturalWidth, sh = img.naturalHeight;
      if(!sw || !sh){ toast('Пустое изображение'); return; }
      let cv;
      try{
        cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
        const ctx = cv.getContext('2d');
        const scale = Math.max(cw / sw, ch / sh);          /* cover-fit */
        const dw = sw * scale, dh = sh * scale;
        ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
        cb(cv.toDataURL('image/jpeg', quality));
      }catch(e){ toast('Не удалось обработать фото'); }
    };
    img.onerror = function(){ toast('Не удалось открыть изображение'); };
    img.src = rd.result;
  };
  rd.onerror = function(){ toast('Ошибка чтения файла'); };
  rd.readAsDataURL(file);
}
/* системный выбор файла (переиспользуемый скрытый input) */
let _st2FileCb = null;
function st2PickFile(cb){
  _st2FileCb = cb;
  let inp = document.getElementById('st2FileInput');
  if(!inp){
    inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'st2FileInput'; inp.style.display = 'none';
    inp.addEventListener('change', function(){
      const f = inp.files && inp.files[0]; inp.value = '';
      if(f && _st2FileCb) _st2FileCb(f);
    });
    document.body.appendChild(inp);
  }
  inp.click();
}

/* аватар */
function st2SetAvatar(){
  st2PickFile(f => st2FitImage(f, 512, 512, 0.84, url => {
    if(typeof PROFILE !== 'undefined') PROFILE.avatar = url;
    st2SyncActiveFromProfile(); st2Save();
    st2PaintEditAva(); st2PaintProfile();
    toast('Фото профиля обновлено');
  }));
}
function st2RemoveAvatar(){
  if(typeof PROFILE !== 'undefined') PROFILE.avatar = null;
  st2SyncActiveFromProfile(); st2Save();
  st2PaintEditAva(); st2PaintProfile();
  toast('Фото профиля удалено');
}
function st2AvatarMenu(){
  const has = typeof PROFILE !== 'undefined' && !!PROFILE.avatar;
  showPopup({
    ico:'camera', title:'Фото профиля',
    body:'Загрузите фото с устройства — оно сожмётся и сохранится на этом устройстве. Фото привязано к активному аккаунту.',
    actions: has
      ? [{label:'Загрузить новое', onclick: st2SetAvatar}, {label:'Удалить фото', ghost:true, onclick: st2RemoveAvatar}]
      : [{label:'Загрузить фото', onclick: st2SetAvatar}, {label:'Отмена', ghost:true}],
  });
}
/* обложка */
function st2SetCover(){
  st2PickFile(f => st2FitImage(f, 1080, 420, 0.82, url => {
    if(typeof PROFILE !== 'undefined') PROFILE.cover = url;
    st2SyncActiveFromProfile(); st2Save();
    st2PaintEditCover(); st2PaintProfile();
    toast('Обложка обновлена');
  }));
}
function st2RemoveCover(){
  if(typeof PROFILE !== 'undefined') PROFILE.cover = null;
  st2SyncActiveFromProfile(); st2Save();
  st2PaintEditCover(); st2PaintProfile();
  toast('Обложка удалена');
}
function st2CoverMenu(){
  const has = typeof PROFILE !== 'undefined' && !!PROFILE.cover;
  showPopup({
    ico:'st2-image', title:'Обложка профиля',
    body:'Широкое фото-полотно в шапке профиля. Загрузите изображение — оно сожмётся и сохранится локально.',
    actions: has
      ? [{label:'Загрузить новую', onclick: st2SetCover}, {label:'Убрать обложку', ghost:true, onclick: st2RemoveCover}]
      : [{label:'Загрузить обложку', onclick: st2SetCover}, {label:'Отмена', ghost:true}],
  });
}

/* ---------- покраска аватаров/обложек ---------- */
function st2PaintAvaEl(el, url, letter){
  if(!el) return;
  if(url){
    el.style.backgroundImage = 'url("' + url + '")';
    el.textContent = '';
    el.classList.add('st2-has-photo');
  } else {
    el.style.backgroundImage = '';
    el.classList.remove('st2-has-photo');
    if(letter !== undefined && letter !== null) el.textContent = letter;
  }
}
function st2ProfLetter(){ return (typeof PROFILE !== 'undefined' && PROFILE.name ? PROFILE.name[0] : 'O').toUpperCase(); }
/* профиль (ядро): #profAva + собственная обложка над profile-top */
function st2PaintProfile(){
  const url = (typeof PROFILE !== 'undefined' && PROFILE.avatar) || null;
  st2PaintAvaEl(document.getElementById('profAva'), url, st2ProfLetter());
  st2PaintMyCover();
}
function st2PaintMyCover(){
  const pad = document.querySelector('#screen-profile .pad');
  if(!pad) return;
  const top = pad.querySelector('.profile-top');
  if(!top) return;
  const url = (typeof PROFILE !== 'undefined' && PROFILE.cover) || null;
  let cov = document.getElementById('st2MyCover');
  if(!cov){
    cov = document.createElement('button');
    cov.id = 'st2MyCover'; cov.className = 'st2-mycover';
    cov.setAttribute('aria-label', 'Обложка профиля');
    cov.onclick = st2CoverMenu;
    pad.insertBefore(cov, top);
  }
  cov.classList.toggle('has', !!url);
  cov.style.backgroundImage = url ? 'url("' + url + '")' : '';
  cov.innerHTML = `<span class="st2-mycover-grid"></span>
    <span class="st2-mycover-mark">${I('logo')}</span>
    <span class="st2-mycover-edit">${I('camera')}${url ? 'Сменить обложку' : 'Добавить обложку'}</span>`;
}
/* экран редактирования (ядро #editProfile) */
function st2PaintEditAva(){
  st2PaintAvaEl(document.getElementById('epAva'), (typeof PROFILE !== 'undefined' && PROFILE.avatar) || null, st2ProfLetter());
}
function st2PaintEditCover(){
  const el = document.getElementById('st2EpCover');
  if(!el) return;
  const url = (typeof PROFILE !== 'undefined' && PROFILE.cover) || null;
  el.classList.toggle('has', !!url);
  el.style.backgroundImage = url ? 'url("' + url + '")' : '';
  el.innerHTML = `<span class="ep-cover-mark">${I('logo')}</span>
    <span class="ep-cover-hint">${I('st2-image')}${url ? 'Сменить обложку' : 'Добавить обложку'}</span>`;
}
/* рерайринг кнопок фото ядра + инъекция контрола обложки в #editProfile (один раз) */
function st2WireEditProfile(){
  const avBtn = document.querySelector('#editProfile .ep-avabtn');
  const avLink = document.querySelector('#editProfile .ep-photolink');
  if(avBtn){ avBtn.removeAttribute('onclick'); avBtn.onclick = st2AvatarMenu; }
  if(avLink){ avLink.removeAttribute('onclick'); avLink.onclick = st2AvatarMenu; avLink.textContent = 'Изменить фото'; }
  if(avLink && !document.getElementById('st2EpCover')){
    const lab = document.createElement('label'); lab.className = 'ep-lab'; lab.textContent = 'Обложка профиля'; lab.id = 'st2EpCoverLab';
    const cov = document.createElement('button'); cov.type = 'button'; cov.className = 'ep-cover'; cov.id = 'st2EpCover';
    cov.onclick = st2CoverMenu;
    avLink.insertAdjacentElement('afterend', cov);
    avLink.insertAdjacentElement('afterend', lab);
  }
}

/* ================= ЧЁРНЫЙ СПИСОК / БЛОКИРОВКИ (реальный персист в oko-settings2) ================= */
function st2IsBlocked(name){ return ST2.blocked.indexOf(name) > -1; }
function st2Block(name){
  if(!name || st2IsBlocked(name)) return false;
  ST2.blocked.push(name); st2Save();
  try{ if(typeof psSetFollow === 'function') psSetFollow(name, false); }catch(e){}  /* блок = отписка */
  try{ if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined') renderFeed(curFeedKind); }catch(e){}
  st2SyncBlockedVal();
  return true;
}
function st2Unblock(name){
  const i = ST2.blocked.indexOf(name);
  if(i < 0) return false;
  ST2.blocked.splice(i, 1); st2Save();
  try{ if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined') renderFeed(curFeedKind); }catch(e){}
  st2SyncBlockedVal();
  return true;
}
function st2SyncBlockedVal(){
  const el = document.getElementById('st2BlockedVal');
  if(el) el.textContent = ST2.blocked.length
    ? ST2.blocked.length + (ST2.blocked.length === 1 ? ' человек' : (ST2.blocked.length < 5 ? ' человека' : ' человек'))
    : 'пусто';
}
/* убрать посты заблокированных из ленты */
function st2FilterBlockedFeed(){
  if(!ST2.blocked.length) return;
  const list = document.getElementById('feedList');
  if(!list) return;
  list.querySelectorAll('article.post').forEach(art => {
    const b = art.querySelector('.post-more');
    const m = b && (b.getAttribute('onclick') || '').match(/openPostMenu\((\d+)/);
    const p = (m && typeof postById === 'function') ? postById(+m[1]) : null;
    if(p && p.name && st2IsBlocked(p.name)) art.remove();
  });
}
/* кандидаты на блокировку — реальные люди приложения (из profile-social пула) */
function st2BlockablePeople(){
  let pool = [];
  try{ if(typeof psPeoplePool === 'function') pool = psPeoplePool(); }catch(e){}
  return pool.filter(p => p && p.name && !st2IsBlocked(p.name));
}
function st2BlAva(p){
  if(p && p.avaIcon) return I(p.avaIcon);
  if(p && p.ava && p.ava.length <= 3) return esc(p.ava);
  return esc(st2AccInit((p && p.name) || 'U'));
}
function st2UnblockUI(enc){ const n = decodeURIComponent(enc); if(st2Unblock(n)){ st2RenderBlocked(); toast('Разблокирован: ' + n); } }
function st2BlockUI(enc){ const n = decodeURIComponent(enc); if(st2Block(n)){ st2RenderBlocked(); toast('Заблокирован: ' + n); } }
function st2RenderBlocked(){
  const wrap = document.getElementById('st2BlockedBody');
  if(!wrap) return;
  const blocked = ST2.blocked.slice();
  const pool = st2BlockablePeople();
  const byName = {}; pool.forEach(p => byName[p.name] = p);
  const suggest = pool.slice(0, 16);
  const blRow = name => {
    const p = byName[name] || {name};
    return `<div class="st2-bl-row">
      <span class="st2-bl-av">${st2BlAva(p)}</span>
      <div class="st2-bl-b"><b>${esc(name)}</b><small>в чёрном списке</small></div>
      <button class="st2-bl-un" onclick="st2UnblockUI('${encodeURIComponent(name)}')">Разблокировать</button>
    </div>`;
  };
  const sgRow = p =>
    `<div class="st2-bl-row st2-bl-sg">
      <span class="st2-bl-av">${st2BlAva(p)}</span>
      <div class="st2-bl-b"><b>${esc(p.name)}</b><small>@${esc(p.nick || st2AccInit(p.name).toLowerCase())}</small></div>
      <button class="st2-bl-do" onclick="st2BlockUI('${encodeURIComponent(p.name)}')">${I('st2-ban')} Заблокировать</button>
    </div>`;
  wrap.innerHTML =
    (blocked.length
      ? `<div class="st2-bl-cap">В чёрном списке · ${blocked.length}</div><div class="st2-bl-list">${blocked.map(blRow).join('')}</div>`
      : `<div class="st2-bl-empty">${I('st2-ban')}<p>Чёрный список пуст</p><span>Заблокированные не смогут вам писать и исчезнут из вашей ленты</span></div>`) +
    `<button class="st2-bl-add" onclick="st2BlockManual()">${I('plus')} Заблокировать по @нику</button>` +
    (suggest.length ? `<div class="st2-bl-cap" style="margin-top:6px">Люди из приложения</div><div class="st2-bl-list">${suggest.map(sgRow).join('')}</div>` : '');
}
function st2BlockManual(err){
  st2Prompt({
    ico:'st2-ban', title:'Заблокировать', err: err,
    note:'Введите имя или @ник — пользователь попадёт в чёрный список.',
    ph:'@nickname или Имя', saveLabel:'Заблокировать', danger:true,
    save(v){
      v = v.replace(/^@/, '').trim();
      if(v.length < 2) return st2BlockManual('Слишком короткое имя');
      /* попробуем сопоставить с реальным человеком из пула по нику/имени */
      let match = v;
      try{
        const pool = (typeof psPeoplePool === 'function') ? psPeoplePool() : [];
        const hit = pool.find(p => (p.nick || '').toLowerCase() === v.toLowerCase() || p.name.toLowerCase() === v.toLowerCase());
        if(hit) match = hit.name;
      }catch(e){}
      if(st2IsBlocked(match)) return st2BlockManual('Уже в чёрном списке');
      st2Block(match); st2RenderBlocked(); toast('Заблокирован: ' + match);
    },
  });
}
function st2OpenBlocked(){
  st2Push('blocked');
}

/* ================= ВЫХОД ИЗ АККАУНТА ================= */
function st2LogoutAccount(){
  const others = ST2.accounts.filter(a => a.id !== ST2.activeAcc);
  const cur = st2ActiveAcc();
  showPopup({
    ico:'logout', title:'Выйти из аккаунта?',
    body: others.length
      ? `Вы выйдете из <b>${esc(cur ? cur.name : 'текущего аккаунта')}</b> на этом устройстве и переключитесь на «${esc(others[0].name)}».`
      : 'Вы выйдете из аккаунта и вернётесь на экран входа.',
    actions:[
      {label:'Отмена', ghost:true},
      {label:'Выйти', onclick: st2DoLogoutAccount},
    ],
  });
  const ok = document.querySelector('#okoPopup [data-pa="1"]');
  if(ok) ok.classList.add('st2-btn-danger');
}
function st2DoLogoutAccount(){
  const goneId = ST2.activeAcc;
  const others = ST2.accounts.filter(a => a.id !== goneId);
  if(!others.length){
    if(typeof doLogout === 'function') doLogout();
    else { try{ localStorage.removeItem('oko-auth'); }catch(e){} location.reload(); }
    return;
  }
  ST2.accounts = ST2.accounts.filter(a => a.id !== goneId);
  st2Save();
  st2SwitchAccount(others[0].id);   /* применит профиль + renderMyProfile + persist + toast */
  st2Render();
  toast('Вы вышли из аккаунта');
}

/* ---------- свои SVG-иконки (штрих ядра: stroke 7, округлые концы) ---------- */
function st2AddIcons(){
  const defs = document.querySelector('svg defs');
  if(!defs || document.getElementById('i-gear')) return;
  const mk = (id, inner)=>{
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
    s.setAttribute('id', id); s.setAttribute('viewBox', '0 0 100 100');
    s.innerHTML = inner;
    defs.appendChild(s);
  };
  /* шестерёнка: контур feather-settings, масштаб 24->100 (штрих 1.68*4.167≈7) */
  mk('i-gear', '<g fill="none" stroke="currentColor" stroke-width="1.68" stroke-linecap="round" stroke-linejoin="round" transform="scale(4.1667)">' +
    '<circle cx="12" cy="12" r="3.4"/>' +
    '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></g>');
  /* конверт (почта) */
  mk('i-st2-mail', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="12" y="26" width="76" height="50" rx="9"/><path d="M16 32 L50 58 L84 32"/></g>');
  /* устройства (монитор + телефон) */
  mk('i-st2-devices', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M56 62 H16 a6 6 0 0 1 -6 -6 V26 a6 6 0 0 1 6 -6 H74 a6 6 0 0 1 6 6 v6"/>' +
    '<path d="M28 76 h20 M38 62 v14"/>' +
    '<rect x="62" y="42" width="28" height="46" rx="7"/><path d="M72 78 h8"/></g>');
  /* база данных (цилиндр) */
  mk('i-st2-db', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<ellipse cx="50" cy="24" rx="30" ry="11"/>' +
    '<path d="M20 24 v26 c0 6 13.4 11 30 11 s30-5 30-11 V24"/>' +
    '<path d="M20 50 v26 c0 6 13.4 11 30 11 s30-5 30-11 V50"/></g>');
  /* щит с галочкой (безопасность / 2FA) */
  mk('i-st2-shield', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M50 9 L83 21 V47 C83 68 69 83 50 91 C31 83 17 68 17 47 V21 Z"/>' +
    '<path d="M37 49 l9 10 18-22"/></g>');
  /* ключ (смена пароля) */
  mk('i-st2-key', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="35" cy="37" r="17"/><path d="M47 49 L86 88"/><path d="M76 78 l9 -9"/><path d="M65 67 l9 -9"/></g>');
  /* запрет / бан (чёрный список) */
  mk('i-st2-ban', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="50" cy="50" r="38"/><path d="M24 24 L76 76"/></g>');
  /* картинка / обложка */
  mk('i-st2-image', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="14" y="20" width="72" height="60" rx="9"/><circle cx="36" cy="41" r="7"/>' +
    '<path d="M20 74 L42 52 L58 66 L72 54 L84 64"/></g>');
  /* лупа (поиск по настройкам) */
  mk('i-st2-search', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="43" cy="43" r="27"/><path d="M63 63 L86 86"/></g>');
  /* крестик (очистить поиск) */
  mk('i-st2-x', '<g fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M28 28 L72 72 M72 28 L28 72"/></g>');
  /* часы (автоблокировка) */
  mk('i-st2-clock', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="50" cy="50" r="38"/><path d="M50 28 V50 L66 60"/></g>');
  /* динамик (звук) */
  mk('i-st2-speaker', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M18 38 h14 L52 22 v56 L32 62 H18 Z"/>' +
    '<path d="M64 36 c7 8 7 20 0 28"/><path d="M74 26 c14 15 14 33 0 48"/></g>');
  /* вибрация */
  mk('i-st2-vibrate', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="36" y="22" width="28" height="56" rx="4"/>' +
    '<path d="M14 40 v20 M22 34 v32 M78 34 v32 M86 40 v20"/></g>');
  /* бейдж (кружок с точкой) */
  mk('i-st2-badge', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="14" y="14" width="52" height="52" rx="10"/>' +
    '<circle cx="76" cy="24" r="12" fill="currentColor" stroke="none"/></g>');
  /* контроллер игр */
  mk('i-st2-controller', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M22 66 L14 50 c-3-13 6-24 20-24 h32 c14 0 23 11 20 24 L78 66 c-3 6-11 6-14 1 L58 60 H42 L36 67 c-3 5-11 5-14-1 Z"/>' +
    '<path d="M28 45 h10 M33 40 v10"/><circle cx="66" cy="42" r="3.5" fill="currentColor" stroke="none"/><circle cx="74" cy="49" r="3.5" fill="currentColor" stroke="none"/></g>');
  /* eq / тюнер (каналы) */
  mk('i-st2-tune', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M20 26 h60 M20 50 h60 M20 74 h60"/>' +
    '<circle cx="36" cy="26" r="6" fill="var(--bg,#000)"/><circle cx="66" cy="50" r="6" fill="var(--bg,#000)"/><circle cx="30" cy="74" r="6" fill="var(--bg,#000)"/></g>');
  /* WiFi */
  mk('i-st2-wifi', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 40 c22-22 54-22 76 0"/><path d="M24 54 c14-14 38-14 52 0"/><path d="M36 68 c7-7 21-7 28 0"/>' +
    '<circle cx="50" cy="80" r="4" fill="currentColor" stroke="none"/></g>');
  /* линк (привязка) */
  mk('i-st2-link', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M40 32 h-8 a20 20 0 0 0 0 40 h12"/>' +
    '<path d="M60 68 h8 a20 20 0 0 0 0 -40 h-12"/>' +
    '<path d="M36 50 h28"/></g>');
  /* глаз в круге (a11y) */
  mk('i-st2-eye', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M10 50 c14-24 66-24 80 0 c-14 24-66 24-80 0 Z"/>' +
    '<circle cx="50" cy="50" r="12"/></g>');
  /* motion (стрелка со следом) */
  mk('i-st2-motion', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M18 62 L46 34 L58 46 L84 22"/><path d="M70 22 h14 v14"/></g>');
  /* контраст (половинки круга) */
  mk('i-st2-contrast', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="50" cy="50" r="36"/><path d="M50 14 v72 A36 36 0 0 1 50 14 Z" fill="currentColor" stroke="none"/></g>');
  /* рука/тап */
  mk('i-st2-hand', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M34 48 V22 c0-5 3-9 8-9 s8 4 8 9 v22"/>' +
    '<path d="M50 44 v-6 c0-4 3-7 7-7 s7 3 7 7 v14"/>' +
    '<path d="M64 46 c0-3 3-6 7-6 s7 3 7 7 v18 c0 12-9 22-22 22 h-4 c-10 0-18-6-22-14 L20 56 c-2-4 1-8 5-8 c3 0 5 1 7 4 l4 6"/></g>');
  /* спасательный круг */
  mk('i-st2-life', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="50" cy="50" r="36"/><circle cx="50" cy="50" r="13"/>' +
    '<path d="M25 25 L41 41 M75 25 L59 41 M25 75 L41 59 M75 75 L59 59"/></g>');
  /* «?» в круге */
  mk('i-st2-help-circle', '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="50" cy="50" r="36"/>' +
    '<path d="M40 40 c0-8 6-13 12-13 s12 5 12 12 c0 8-12 10-12 18"/><circle cx="52" cy="70" r="3.5" fill="currentColor" stroke="none"/></g>');
}

/* ---------- строка «Настройки» в профиле ---------- */
function st2InsertRow(){
  if(document.getElementById('st2Row')) return;
  const card = document.querySelector('#screen-profile .card');
  if(!card) return;
  const row = document.createElement('button');
  row.className = 'prow'; row.id = 'st2Row';
  row.onclick = st2Open;
  row.innerHTML = `${I('gear')} Настройки <span class="chev">${I('chev')}</span>`;
  const after = card.querySelector('.prow[onclick="openEdit()"]');
  if(after) after.insertAdjacentElement('afterend', row);
  else card.insertBefore(row, card.firstChild);
}

/* ---------- самоинициализация ---------- */
(function st2Init(){
  st2AddIcons();
  st2InsertRow();
  st2WireEditProfile();

  /* chain renderMyProfile: покрасить свой аватар + собственную обложку (внешний слой) */
  if(typeof renderMyProfile === 'function'){
    const _st2PrevRMP = renderMyProfile;
    renderMyProfile = function(){
      _st2PrevRMP.apply(this, arguments);
      try{ st2PaintProfile(); }catch(e){}
    };
  }
  /* chain openEdit: показать текущее фото/обложку в редакторе */
  if(typeof openEdit === 'function'){
    const _st2PrevOpenEdit = openEdit;
    openEdit = function(){
      _st2PrevOpenEdit.apply(this, arguments);
      try{ st2WireEditProfile(); st2PaintEditAva(); st2PaintEditCover(); }catch(e){}
    };
  }
  /* chain saveProfile: персист профиля (имя/ник/био/статус/фото/обложка) в активный аккаунт */
  if(typeof saveProfile === 'function'){
    const _st2PrevSaveProfile = saveProfile;
    saveProfile = function(){
      _st2PrevSaveProfile.apply(this, arguments);   /* ядро уже обновило PROFILE + вызвало renderMyProfile */
      try{ st2SyncActiveFromProfile(); st2Save(); st2PaintProfile(); }catch(e){}
    };
  }
  /* chain renderFeed: убрать посты заблокированных (внешний слой — после декора profile-social) */
  if(typeof renderFeed === 'function'){
    const _st2PrevRenderFeed = renderFeed;
    renderFeed = function(){
      _st2PrevRenderFeed.apply(this, arguments);
      try{ st2FilterBlockedFeed(); }catch(e){}
    };
  }
  /* chain closeSheet: снять подъём шита чёрного списка над #st2View */
  if(typeof closeSheet === 'function'){
    const _st2PrevCloseSheet = closeSheet;
    closeSheet = function(){
      _st2PrevCloseSheet.apply(this, arguments);
      try{ document.body.classList.remove('st2-over'); }catch(e){}
    };
  }

  /* аккаунты: сид из PROFILE при первом запуске; иначе — применить активный аккаунт */
  if(typeof PROFILE !== 'undefined'){
    /* миграция: сохранённый ранее override ника -> PROFILE (до сида аккаунтов) */
    if(ST2.nick && !ST2.accounts.length && PROFILE.nick !== ST2.nick){
      PROFILE.nick = ST2.nick;
      if(typeof renderMyProfile === 'function') renderMyProfile();
    }
    if(!ST2.accounts.length){
      ST2.accounts = [{id:'owner', name:PROFILE.name, nick:PROFILE.nick, tier:PROFILE.tier, role:PROFILE.role, bio:PROFILE.bio,
                       status:PROFILE.status||null, avatar:PROFILE.avatar||null, cover:PROFILE.cover||null}];
      ST2.activeAcc = 'owner';
      st2Save();
    } else {
      if(!ST2.activeAcc || !ST2.accounts.some(a => a.id === ST2.activeAcc)) ST2.activeAcc = ST2.accounts[0].id;
      const a = st2ActiveAcc();
      if(a){
        st2ApplyAccToProfile(a);
        ST2.nick = a.nick;
        if(typeof renderMyProfile === 'function') renderMyProfile();
        st2Save();
      }
    }
  } else if(ST2.nick){
    /* PROFILE ещё не готов — ничего не делаем, применится при рендере */
  }

  /* мои настройки -> старые sheet-ы ядра; и chain-обратный синк из них */
  st2PushCore();
  if(typeof toggleSetting === 'function'){
    const _st2PrevToggleSetting = toggleSetting;
    toggleSetting = function(group, k){
      _st2PrevToggleSetting(group, k);
      st2PullCore();
      const v = document.getElementById('st2View');
      if(v && v.classList.contains('open')) st2Render();
    };
  }

  /* тема «Система»: применить и слушать смену системной темы */
  if(ST2.theme === 'system') st2ApplyTheme('system');
  try{
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    if(mq){
      const h = ()=>{ if(ST2.theme === 'system') st2ApplyTheme('system'); };
      if(mq.addEventListener) mq.addEventListener('change', h);
      else if(mq.addListener) mq.addListener(h);
    }
  }catch(e){}

  /* при смене языка — перерисовать открытую вьюху (обновить активную кнопку) */
  if(typeof onLangChange === 'function'){
    onLangChange(function(){
      const v = document.getElementById('st2View');
      if(v && v.classList.contains('open')) st2Render();
    });
  }

  /* стартовая покраска аватара/обложки (ядро могло отрисовать профиль до установки чейна) */
  try{ st2PaintProfile(); }catch(e){}

  /* применить сохранённые опции a11y и запустить авто-расписание темы */
  try{ st2ApplyA11y(); }catch(e){}
  try{ if(ST2.themeAuto && ST2.themeAuto.on) st2ScheduleThemeAuto(); }catch(e){}

  /* автоматически стереть аккаунт, если срок 14 дней истёк, пока пользователя не было */
  try{ if(ST2.delAt && ST2.delAt < Date.now()) st2DoDelete(); }catch(e){}
})();
