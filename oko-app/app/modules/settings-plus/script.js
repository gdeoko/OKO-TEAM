/* ===== SETTINGS-PLUS (st2-): «Настройки» как полноценный раздел =====
   Строка в профиле (шестерёнка) -> fullscreen #st2View (nvPush):
   Аккаунт / Уведомления / Приватность / Данные / Сессии / Опасная зона.
   Всё персистится в localStorage 'oko-settings2'. */

/* ---------- состояние + персист ---------- */
const ST2 = {
  nick: null,                       /* override ника (синк с PROFILE) */
  email: 'okoteam.top@gmail.com',
  phone: '+7 999 123-45-67',
  notif: {msg:true, feed:true, market:true, academy:true, marketing:false},
  priv:  {write:'all', online:true, read:true},   /* write: all|contacts */
  killed: [],                       /* id завершённых мок-сессий */
  lastClear: 0,                     /* ts последней очистки кэша */
};
(function st2Load(){
  try{
    const s = JSON.parse(localStorage.getItem('oko-settings2') || 'null');
    if(!s) return;
    if(s.notif) Object.assign(ST2.notif, s.notif);
    if(s.priv)  Object.assign(ST2.priv,  s.priv);
    ['nick','email','phone','lastClear'].forEach(k=>{ if(s[k] !== undefined) ST2[k] = s[k]; });
    if(Array.isArray(s.killed)) ST2.killed = s.killed;
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
  SETTINGS.privacy.dm     = ST2.priv.write === 'contacts';
}
function st2PullCore(){
  if(typeof SETTINGS === 'undefined') return;
  ST2.notif.msg       = SETTINGS.notif.msg;
  ST2.notif.marketing = SETTINGS.notif.news;
  ST2.priv.online     = SETTINGS.privacy.online;
  ST2.priv.read       = SETTINGS.privacy.read;
  ST2.priv.write      = SETTINGS.privacy.dm ? 'contacts' : 'all';
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

/* ---------- рендер вьюхи ---------- */
function st2Nick(){ return (typeof PROFILE !== 'undefined' && PROFILE.nick) ? PROFILE.nick : (ST2.nick || 'ktodaniel'); }
function st2Sw(on){ return `<span class="switch ${on ? 'on' : ''}"><i></i></span>`; }

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
  body.innerHTML = `
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
      <div class="prow" style="cursor:default">Кто может писать
        <span class="st2-seg" id="st2Seg">
          <button class="${ST2.priv.write === 'all' ? 'on' : ''}" onclick="st2SetWrite('all')">Все</button>
          <button class="${ST2.priv.write === 'contacts' ? 'on' : ''}" onclick="st2SetWrite('contacts')">Контакты</button>
        </span></div>
      <button class="prow" onclick="st2Tgl('priv','online',this)">Показывать «в сети» ${st2Sw(ST2.priv.online)}</button>
      <button class="prow" onclick="st2Tgl('priv','read',this)">Отчёты о прочтении ${st2Sw(ST2.priv.read)}</button>
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

/* ---------- switch-и и сегмент ---------- */
function st2Tgl(group, k, btn){
  ST2[group][k] = !ST2[group][k];
  st2Save(); st2PushCore();
  const sw = btn && btn.querySelector('.switch');
  if(sw) sw.classList.toggle('on', ST2[group][k]);
}
function st2SetWrite(v){
  ST2.priv.write = v;
  st2Save(); st2PushCore();
  const seg = document.getElementById('st2Seg');
  if(seg){
    const b = seg.querySelectorAll('button');
    b[0].classList.toggle('on', v === 'all');
    b[1].classList.toggle('on', v === 'contacts');
  }
  toast(v === 'all' ? 'Писать могут все' : 'Писать могут только контакты');
}

/* ---------- попап с инпутом (значение читаем из замыкания: popup закрывается ДО onclick) ---------- */
function st2Attr(t){ return esc(t).replace(/"/g, '&quot;'); }
let _st2Inp = null;
function st2Prompt(o){ /* {ico,title,note,val,ph,saveLabel,danger,err,save(v)} */
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
    setTimeout(()=>{ try{ _st2Inp.focus(); _st2Inp.select(); }catch(e){} }, 60);
    _st2Inp.addEventListener('keydown', e => { if(e.key === 'Enter' && ok) ok.click(); });
  }
}

/* ---------- Аккаунт: ник (синк PROFILE), почта, телефон ---------- */
function st2EditNick(err){
  st2Prompt({
    ico:'edit', title:'Смена ника', err: err,
    note:'3–16 символов: латиница, цифры, подчёркивание. Ник обновится в профиле, ленте и чатах.',
    val: st2Nick(), ph:'nickname',
    save(v){
      v = v.replace(/^@/, '');
      if(!/^[a-z0-9_]{3,16}$/i.test(v)) return st2EditNick('Недопустимый ник — проверь формат');
      ST2.nick = v; st2Save();
      if(typeof PROFILE !== 'undefined'){
        PROFILE.nick = v;
        if(typeof renderMyProfile === 'function') renderMyProfile();
      }
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
  const L = ['OKO — выгрузка данных аккаунта', 'Дата: ' + new Date().toLocaleString('ru-RU'), ''];
  L.push('=== ПРОФИЛЬ ===', 'Имя: ' + p.name, 'Ник: @' + p.nick, 'Тариф: ' + p.tier,
         'Почта: ' + ST2.email, 'Телефон: ' + ST2.phone, 'О себе: ' + (p.bio || '—'), '');
  L.push('=== НАСТРОЙКИ ===',
         'Уведомления: ' + JSON.stringify(ST2.notif),
         'Приватность: ' + JSON.stringify(ST2.priv), '');
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

  /* персистентный ник -> PROFILE (обратный синк при загрузке) */
  if(ST2.nick && typeof PROFILE !== 'undefined' && PROFILE.nick !== ST2.nick){
    PROFILE.nick = ST2.nick;
    if(typeof renderMyProfile === 'function') renderMyProfile();
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
})();
