/* ===== SETTINGS-PLUS (st2-): «Настройки» как полноценный раздел =====
   Строка в профиле (шестерёнка) -> fullscreen #st2View (nvPush):
   Аккаунты / Аккаунт / Уведомления / Приватность / Безопасность /
   Оформление / Данные / Сессии / Опасная зона.
   Всё персистится в localStorage 'oko-settings2'. */

/* ---------- состояние + персист ---------- */
const ST2 = {
  nick: null,                       /* override ника (синк с PROFILE) */
  email: 'okoteam.top@gmail.com',
  phone: '+7 999 123-45-67',
  notif: {msg:true, feed:true, market:true, academy:true, marketing:false},
  /* приватность: write (all|following|nobody), phone/photo/status (all|contacts|nobody), online/read — тумблеры */
  priv:  {write:'all', online:true, read:true, phone:'contacts', photo:'all', status:'all'},
  sec:   {twofa:false, passcode:false, pin:null, secret:null},
  theme: null,                      /* 'dark'|'light'|'system' (null -> подстроится под текущую) */
  accounts: [],                     /* [{id,name,nick,tier,role,bio,status,avatar,cover}] */
  activeAcc: null,                  /* id активного аккаунта */
  killed: [],                       /* id завершённых мок-сессий */
  blocked: [],                      /* [имя] — чёрный список (реальный персист) */
  lastClear: 0,                     /* ts последней очистки кэша */
};
(function st2Load(){
  try{
    const s = JSON.parse(localStorage.getItem('oko-settings2') || 'null');
    if(!s) return;
    if(s.notif) Object.assign(ST2.notif, s.notif);
    if(s.priv)  Object.assign(ST2.priv,  s.priv);
    if(s.sec)   Object.assign(ST2.sec,   s.sec);
    ['nick','email','phone','lastClear','theme','activeAcc'].forEach(k=>{ if(s[k] !== undefined) ST2[k] = s[k]; });
    if(Array.isArray(s.killed))   ST2.killed   = s.killed;
    if(Array.isArray(s.accounts)) ST2.accounts = s.accounts;
    if(Array.isArray(s.blocked))  ST2.blocked  = s.blocked;
  }catch(e){}
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

function st2Render(){
  const body = document.getElementById('st2Body');
  if(!body) return;
  const alive = st2Alive(), others = alive.filter(s => !s.cur);
  const N = [
    ['msg',       'Сообщения и чаты',            'chat'],
    ['feed',      'Лента: реакции и упоминания', 'heart'],
    ['market',    'Биржа: заказы и отклики',     'briefcase'],
    ['academy',   'Академия: новые уроки',       'star'],
    ['marketing', 'Новости и предложения OKO',   'megaphone'],
  ];
  const VIS = [['all','Все'],['contacts','Контакты'],['nobody','Никто']];
  const themeMode = ST2.theme || (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const lang = (typeof LANG !== 'undefined') ? LANG : 'ru';
  body.innerHTML = `
  <div class="st2-sec">
    <div class="st2-h">${I('users')} Аккаунты</div>
    <div class="st2-card" id="st2AccList">
      ${ST2.accounts.map(st2AccHtml).join('')}
      <button class="prow st2-add-acc" onclick="st2AddAccount()">${I('plus')} Добавить аккаунт<span class="chev">${I('chev')}</span></button>
      <button class="prow st2-logout-acc" onclick="st2LogoutAccount()">${I('logout')} Выйти из аккаунта<span class="chev">${I('chev')}</span></button>
    </div>
  </div>
  <div class="st2-sec">
    <div class="st2-h">${I('user')} Аккаунт</div>
    <div class="st2-card">
      <button class="prow" onclick="st2EditNick()">${I('edit')} Ник
        <span class="st2-val">@${esc(st2Nick())}</span><span class="chev">${I('chev')}</span></button>
      <button class="prow" onclick="st2EditEmail()">${I('st2-mail')} Почта
        <span class="st2-val">${esc(ST2.email)}</span><span class="chip st2-chip">${I('check')} подтверждена</span></button>
      <button class="prow" onclick="st2EditPhone()">${I('phone')} Телефон
        <span class="st2-val">${esc(ST2.phone)}</span><span class="chev">${I('chev')}</span></button>
    </div>
  </div>
  <div class="st2-sec">
    <div class="st2-h">${I('bell')} Уведомления</div>
    <div class="st2-card">${N.map(([k, l, ico]) =>
      `<button class="prow" onclick="st2Tgl('notif','${k}',this)">${I(ico)} ${l} ${st2Sw(ST2.notif[k])}</button>`).join('')}
    </div>
  </div>
  <div class="st2-sec">
    <div class="st2-h">${I('lock')} Приватность</div>
    <div class="st2-card">
      <div class="prow st2-prow-col" style="cursor:default">
        <span class="st2-prow-lbl">${I('send')} Кто может писать</span>
        ${st2Seg('priv','write',[['all','Все'],['following','Подписки'],['nobody','Никто']])}</div>
      <div class="prow st2-prow-col" style="cursor:default">
        <span class="st2-prow-lbl">${I('phone')} Кто видит телефон</span>
        ${st2Seg('priv','phone',VIS)}</div>
      <div class="prow st2-prow-col" style="cursor:default">
        <span class="st2-prow-lbl">${I('photo')} Кто видит фото профиля</span>
        ${st2Seg('priv','photo',VIS)}</div>
      <div class="prow st2-prow-col" style="cursor:default">
        <span class="st2-prow-lbl">${I('star')} Кто видит статус</span>
        ${st2Seg('priv','status',VIS)}</div>
      <button class="prow" onclick="st2Tgl('priv','online',this)">${I('eye')} Показывать «в сети» ${st2Sw(ST2.priv.online)}</button>
      <button class="prow" onclick="st2Tgl('priv','read',this)">${I('check2')} Отчёты о прочтении ${st2Sw(ST2.priv.read)}</button>
      <button class="prow" onclick="st2OpenBlocked()">${I('st2-ban')} Чёрный список
        <span class="st2-val" id="st2BlockedVal">${ST2.blocked.length ? ST2.blocked.length + (ST2.blocked.length===1?' человек':(ST2.blocked.length<5?' человека':' человек')) : 'пусто'}</span><span class="chev">${I('chev')}</span></button>
    </div>
  </div>
  <div class="st2-sec">
    <div class="st2-h">${I('st2-shield')} Безопасность</div>
    <div class="st2-card">
      <button class="prow" onclick="st2TwoFA()">${I('st2-shield')} Двухфакторная защита
        <span class="chip st2-chip ${ST2.sec.twofa ? 'st2-chip-on' : ''}">${ST2.sec.twofa ? I('check') + ' включена' : 'выключена'}</span>
        <span class="chev">${I('chev')}</span></button>
      <button class="prow" onclick="st2Passcode(this)">${I('lock')} Код-пароль при входе ${st2Sw(ST2.sec.passcode)}</button>
      <button class="prow" onclick="st2ChangePass()">${I('st2-key')} Сменить пароль<span class="chev">${I('chev')}</span></button>
    </div>
  </div>
  <div class="st2-sec">
    <div class="st2-h">${I('sun')} Оформление</div>
    <div class="st2-card">
      <div class="prow st2-prow-col" style="cursor:default">
        <span class="st2-prow-lbl">${I('moon')} Тема</span>
        <span class="st2-seg st2-seg3" id="st2ThemeSeg">
          <button data-v="dark"   class="${themeMode==='dark'?'on':''}"   onclick="st2SetTheme('dark')">Тёмная</button>
          <button data-v="light"  class="${themeMode==='light'?'on':''}"  onclick="st2SetTheme('light')">Светлая</button>
          <button data-v="system" class="${themeMode==='system'?'on':''}" onclick="st2SetTheme('system')">Система</button>
        </span></div>
      <div class="prow st2-prow-col" style="cursor:default">
        <span class="st2-prow-lbl">${I('globe')} Язык</span>
        <span class="st2-seg st2-seg3" id="st2LangSeg">
          <button data-v="ru" class="${lang==='ru'?'on':''}" onclick="st2SetLang('ru')">Русский</button>
          <button data-v="en" class="${lang==='en'?'on':''}" onclick="st2SetLang('en')">English</button>
        </span></div>
    </div>
  </div>
  <div class="st2-sec">
    <div class="st2-h">${I('st2-db')} Данные</div>
    <div class="st2-card">
      <button class="prow" id="st2CacheRow" onclick="st2ClearCache()">${I('trash')} Очистить кэш
        <span class="st2-val" id="st2CacheVal">${st2CacheSize().toFixed(1)} МБ</span><span class="chev">${I('chev')}</span></button>
      <button class="prow" onclick="st2Download()">${I('file')} Скачать мои данные
        <span class="st2-val">.txt</span><span class="chev">${I('chev')}</span></button>
    </div>
  </div>
  <div class="st2-sec">
    <div class="st2-h">${I('st2-devices')} Сессии</div>
    <div class="st2-card" id="st2SesList">
      ${alive.map(st2SesHtml).join('')}
      ${others.length ? `<button class="st2-killall" onclick="st2KillAll()">Завершить остальные сессии (${others.length})</button>`
                      : '<div class="st2-empty">Других активных сессий нет</div>'}
    </div>
  </div>
  <div class="st2-sec">
    <div class="st2-h" style="color:var(--danger)">${I('trash')} Опасная зона</div>
    <div class="st2-card st2-danger">
      <h4>${I('trash')} Удаление аккаунта</h4>
      <p>Профиль, чаты, кошелёк, сертификаты Академии и вся история будут стёрты безвозвратно. Вернуть аккаунт после удаления невозможно.</p>
      <button class="st2-del" onclick="st2DeleteAsk()">Удалить аккаунт</button>
    </div>
  </div>
  <div class="st2-foot">OKO · настройки хранятся локально на устройстве</div>`;
}

/* ---------- открыть / закрыть (navstack) ---------- */
function st2Open(){
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
  if(typeof nvPop === 'function') nvPop('view:st2');
}

/* ---------- тумблеры ---------- */
function st2Tgl(group, k, btn){
  ST2[group][k] = !ST2[group][k];
  st2Save(); st2PushCore();
  const sw = btn && btn.querySelector('.switch');
  if(sw) sw.classList.toggle('on', ST2[group][k]);
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
      <div class="st2-pin" style="margin-top:10px"><input id="st2PwNew" type="password" placeholder="Новый пароль — минимум 8 символов" autocomplete="off"></div>
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
  if(nv.length < 8)  return st2ChangePass('Новый пароль слишком короткий — минимум 8 символов');
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
    body:'Будут стёрты безвозвратно:<br>· профиль и подписчики<br>· чаты, каналы и сторис<br>· кошелёк и история операций<br>· сертификаты Академии',
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
    note:'Для подтверждения введи свой ник <b>@' + esc(st2Nick()) + '</b>. Действие необратимо.',
    ph:'@' + st2Nick(), saveLabel:'Удалить навсегда',
    save(v){
      if(v.replace(/^@/, '').toLowerCase() !== st2Nick().toLowerCase())
        return st2DeleteConfirm('Ник не совпадает — аккаунт не удалён');
      st2DoDelete();
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
  st2RenderBlocked();
  try{ document.body.classList.add('st2-over'); }catch(e){}   /* поднять шит над #st2View */
  if(typeof openSheet === 'function') openSheet('st2-blocked');
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
})();
