/* ===== REGISTRATION: полная регистрация + системные попапы (префикс reg-) ===== */

/* ---------- состояние ---------- */
const REG = {
  step: 1,
  method: 'email',          // email | phone
  contact: '',
  code: '',
  codeTimer: null,
  codeLeft: 0,
  nickState: null,          // null | 'wait' | 'ok' | 'bad'
  nickTimer: null,
  interests: new Set(),
  adult: true,
  avaIdx: 0,                // выбранный акцент аватара
};
/* палитра аватара: строго бренд (чёрный + лайм), но с разнообразием тона.
   fg — цвет инициала, подобран под читаемость на каждом фоне. */
const REG_AVA = [
  {bg:'linear-gradient(135deg,#B9FF4D,#7ACC00)', fg:'#001400'},
  {bg:'linear-gradient(135deg,#EAFF9C,#9AFF00)', fg:'#1a2a00'},
  {bg:'linear-gradient(135deg,#9AFF00,#4d9c00)', fg:'#04140a'},
  {bg:'linear-gradient(135deg,#1c1c1c,#000)',     fg:'#9AFF00'},
  {bg:'linear-gradient(135deg,#38471f,#12180b)',  fg:'#B9FF4D'},
  {bg:'linear-gradient(135deg,#f2f6ec,#cfe3b3)',  fg:'#3d7a00'},
];
const REG_OWNER_EMAIL = (typeof ADMIN_EMAIL !== 'undefined') ? ADMIN_EMAIL : 'okoteam.top@gmail.com';
const REG_TAKEN = ['oko','okoteam','oko_official','daniel','ktodaniel','admin','support','team','ceo','help'];
const REG_INTERESTS = [
  {id:'ai',        label:'Нейросети', ico:'bolt'},
  {id:'content',   label:'Контент',   ico:'camera'},
  {id:'business',  label:'Бизнес',    ico:'briefcase'},
  {id:'marketing', label:'Маркетинг', ico:'megaphone'},
  {id:'games',     label:'Игры',      ico:'play'},
  {id:'crypto',    label:'Крипта',    ico:'money'},
];

/* ---------- localStorage: одноразовые попапы + данные регистрации ---------- */
function regPopupsSeen(){ try{ return JSON.parse(localStorage.getItem('oko-reg-popups')) || {}; }catch(e){ return {}; } }
function regPopupMark(k){ const s = regPopupsSeen(); s[k] = 1; try{ localStorage.setItem('oko-reg-popups', JSON.stringify(s)); }catch(e){} }
function regSave(data){ try{ localStorage.setItem('oko-registration', JSON.stringify(data)); }catch(e){} }

/* ---------- открытие / закрытие / навигация ---------- */
function regOpen(){
  if(!document.getElementById('regView')) return;
  REG.step = 1; REG.code = ''; REG.nickState = null; REG.interests.clear(); REG.adult = true; REG.avaIdx = 0;
  ['regContact','regPass','regName','regNick','regBirth'].forEach(id=>{ const el = document.getElementById(id); if(el) el.value = ''; });
  document.getElementById('regTerms').checked = false;
  document.getElementById('regAgeWarn').classList.remove('show');
  document.getElementById('regNickSt').innerHTML = '';
  document.getElementById('regNickMsg').textContent = '';
  regMethodSet(REG.method);
  regPassMeter();
  regRenderInts();
  regAvaRender();
  regUpdateFinish();
  regShowStep(1);
  document.getElementById('regView').classList.add('open');
  setTimeout(()=>{ const i = document.getElementById('regContact'); if(i) i.focus(); }, 340);
}
function regClose(){
  document.getElementById('regView').classList.remove('open');
  if(REG.codeTimer){ clearInterval(REG.codeTimer); REG.codeTimer = null; }
}
function regBack(){
  if(REG.step === 1){ regClose(); return; }
  regShowStep(REG.step - 1);
  if(REG.step === 2) regCodeFocus(0);
}
function regShowStep(n){
  const back = (typeof REG.step === 'number' && n < REG.step); // направление перехода
  REG.step = n;
  [1,2,3].forEach(i=>{
    const el = document.getElementById('regStep'+i);
    el.classList.remove('active','reg-back');
    if(i === n){ void el.offsetWidth; if(back) el.classList.add('reg-back'); el.classList.add('active'); } // рестарт + направление
  });
  document.getElementById('regBar').style.width = (n/3*100).toFixed(1) + '%';
  document.getElementById('regStepNum').textContent = 'Шаг ' + n + ' из 3';
  document.getElementById('regView').querySelector('.reg-body').scrollTop = 0;
}
function regErrShow(id, msg){ const el = document.getElementById(id); el.textContent = msg; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); }
function regErrHide(id){ const el = document.getElementById(id); el.classList.remove('show'); el.textContent = ''; }

/* ---------- шаг 1: контакт + пароль ---------- */
function regMethodSet(m){
  REG.method = m;
  document.getElementById('regSegEmail').classList.toggle('on', m === 'email');
  document.getElementById('regSegPhone').classList.toggle('on', m === 'phone');
  const inp = document.getElementById('regContact');
  const lab = document.getElementById('regContactLab');
  if(m === 'email'){
    lab.textContent = 'Электронная почта';
    inp.type = 'email'; inp.inputMode = 'email'; inp.autocomplete = 'email';
    inp.placeholder = 'you@example.com';
  } else {
    lab.textContent = 'Номер телефона';
    inp.type = 'tel'; inp.inputMode = 'tel'; inp.autocomplete = 'tel';
    inp.placeholder = '+7 900 000-00-00';
  }
  inp.value = ''; regErrHide('regErr1');
}
function regContactInput(){
  regErrHide('regErr1');
  if(REG.method !== 'phone') return;
  const inp = document.getElementById('regContact');
  let d = inp.value.replace(/\D/g, '');
  if(d.startsWith('8')) d = '7' + d.slice(1);
  if(d && !d.startsWith('7')) d = '7' + d;
  d = d.slice(0, 11);
  let out = '';
  if(d.length){ out = '+7'; }
  if(d.length > 1) out += ' ' + d.slice(1, 4);
  if(d.length > 4) out += ' ' + d.slice(4, 7);
  if(d.length > 7) out += '-' + d.slice(7, 9);
  if(d.length > 9) out += '-' + d.slice(9, 11);
  inp.value = out;
}
function regTogglePass(){
  const inp = document.getElementById('regPass');
  const btn = document.querySelector('#regView .reg-eye');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.classList.toggle('on', show);
}
function regPassScore(p){
  let s = 0;
  if(p.length >= 6) s++;
  if(p.length >= 10) s++;
  if(/[A-ZА-Я]/.test(p) && /[a-zа-я]/.test(p)) s++;
  if(/\d/.test(p)) s++;
  if(/[^\w\sа-яА-Я]/.test(p)) s++;
  return Math.min(s, 4);
}
function regPassMeter(){
  regErrHide('regErr1');
  const p = document.getElementById('regPass').value;
  const bar = document.getElementById('regStrBar');
  const lab = document.getElementById('regStrLab');
  const sc = p ? regPassScore(p) : 0;
  bar.style.width = (sc/4*100) + '%';
  bar.className = sc >= 3 ? 'hi' : (sc === 2 ? 'mid' : '');
  lab.textContent = !p ? 'Надёжность пароля' : (sc <= 1 ? 'Слабый пароль' : sc === 2 ? 'Нормальный пароль' : sc === 3 ? 'Хороший пароль' : 'Отличный пароль');
}
async function regNext1(){
  const contact = document.getElementById('regContact').value.trim();
  const pass = document.getElementById('regPass').value;
  if(REG.method === 'email'){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)) return regErrShow('regErr1', 'Похоже, в почте опечатка — проверь адрес');
  } else {
    if(contact.replace(/\D/g, '').length < 11) return regErrShow('regErr1', 'Введи номер полностью — 11 цифр с +7');
  }
  if(pass.length < 6) return regErrShow('regErr1', 'Пароль слишком короткий — минимум 6 символов');
  REG.contact = contact;

  /* вход владельца: okoteam.top@gmail.com -> adminLogin из ядра */
  if(REG.method === 'email' && contact.toLowerCase() === REG_OWNER_EMAIL){
    const btn = document.getElementById('regBtn1');
    btn.classList.add('loading'); btn.textContent = 'Проверяю доступ…';
    let ok = false;
    try{ if(typeof adminLogin === 'function') ok = await adminLogin(contact, pass); }catch(e){}
    btn.classList.remove('loading'); btn.innerHTML = 'Продолжить ' + I('chev');
    if(!ok) return regErrShow('regErr1', 'Неверный пароль владельца');
    regSave({owner:true, contact, method:'email', at: Date.now()});
    regClose();
    _regPrevDoLogin('owner');
    if(typeof renderMyProfile === 'function') try{ renderMyProfile(); }catch(e){}
    setTimeout(()=>{
      showPopup({ico:'crown', title:'Доступ владельца',
        body:'Генеральный директор OKO. Открыт полный доступ: админка, доход платформы, HQ и управление всеми разделами.',
        actions:[{label:'В приложение'}]});
    }, 650);
    regSchedulePopups();
    return;
  }
  regSendCode();
  regShowStep(2);
}

/* ---------- шаг 2: код подтверждения (мок) ---------- */
function regSendCode(){
  REG.code = String(Math.floor(1000 + Math.random() * 9000));
  document.getElementById('regCodeSub').innerHTML =
    'Мы отправили 4-значный код на <b style="color:var(--text)">' + esc(REG.contact) + '</b>';
  document.querySelectorAll('#regCodeRow input').forEach(i=>{ i.value = ''; i.classList.remove('fill'); });
  document.getElementById('regCodeRow').classList.remove('err');
  regErrHide('regErr2');
  regCodeFocus(0);
  toast('Код подтверждения OKO: ' + REG.code + ' (демо)');
  /* таймер повторной отправки 30 с */
  if(REG.codeTimer) clearInterval(REG.codeTimer);
  REG.codeLeft = 30;
  const btn = document.getElementById('regResendBtn');
  btn.disabled = true;
  btn.textContent = 'Отправить код повторно (30 с)';
  REG.codeTimer = setInterval(()=>{
    REG.codeLeft--;
    if(REG.codeLeft <= 0){
      clearInterval(REG.codeTimer); REG.codeTimer = null;
      btn.disabled = false; btn.textContent = 'Отправить код повторно';
    } else {
      btn.textContent = 'Отправить код повторно (' + REG.codeLeft + ' с)';
    }
  }, 1000);
}
function regResend(){ regSendCode(); }
function regCodeFocus(i){ const inp = document.querySelector('#regCodeRow input[data-i="' + i + '"]'); if(inp){ inp.focus(); inp.select(); } }
function regCodeVal(){ return [...document.querySelectorAll('#regCodeRow input')].map(i=>i.value).join(''); }
function regVerifyCode(){
  const v = regCodeVal();
  if(v.length < 4) return regErrShow('regErr2', 'Введи все 4 цифры кода');
  if(v !== REG.code){
    const row = document.getElementById('regCodeRow');
    row.classList.remove('err'); void row.offsetWidth; row.classList.add('err');
    regErrShow('regErr2', 'Код не подходит — проверь и попробуй ещё раз');
    return;
  }
  toast('Код подтверждён');
  regShowStep(3);
  setTimeout(()=>{ const i = document.getElementById('regName'); if(i) i.focus(); }, 340);
}

/* ---------- шаг 3: профиль, ник, возраст, интересы, условия ---------- */
function regNickInput(){
  const raw = document.getElementById('regNick').value;
  const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  if(raw !== clean) document.getElementById('regNick').value = clean;
  const st = document.getElementById('regNickSt');
  const msg = document.getElementById('regNickMsg');
  clearTimeout(REG.nickTimer);
  if(!clean){ REG.nickState = null; st.innerHTML = ''; msg.textContent = ''; msg.className = 'reg-nick-msg'; regUpdateFinish(); return; }
  REG.nickState = 'wait';
  st.innerHTML = '<span class="wait">' + I('clock') + '</span>';
  msg.textContent = 'Проверяю никнейм…'; msg.className = 'reg-nick-msg wait';
  regUpdateFinish();
  REG.nickTimer = setTimeout(()=>{
    const taken = REG_TAKEN.includes(clean) || clean.length < 3;
    REG.nickState = taken ? 'bad' : 'ok';
    if(taken){
      st.innerHTML = '<span class="bad">' + I('plus') + '</span>'; // плюс под 45° = крест
      st.querySelector('svg').style.transform = 'rotate(45deg)';
      msg.textContent = clean.length < 3 ? 'Слишком короткий — минимум 3 символа' : '@' + clean + ' уже занят, попробуй другой';
      msg.className = 'reg-nick-msg bad';
    } else {
      st.innerHTML = '<span class="ok">' + I('check2') + '</span>';
      msg.textContent = '@' + clean + ' свободен';
      msg.className = 'reg-nick-msg ok';
    }
    regUpdateFinish();
  }, 550);
}
function regBirthCheck(){
  const v = document.getElementById('regBirth').value;
  REG.adult = true;
  if(v){
    const b = new Date(v), now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if(m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
    REG.adult = age >= 18;
  }
  document.getElementById('regAgeWarn').classList.toggle('show', !REG.adult && !!v);
}
function regRenderInts(){
  document.getElementById('regInts').innerHTML = REG_INTERESTS.map(x=>
    `<button type="button" class="reg-int ${REG.interests.has(x.id) ? 'on' : ''}" onclick="regToggleInt('${x.id}')">${I(x.ico)}<span>${x.label}</span></button>`
  ).join('');
}
function regToggleInt(id){
  if(REG.interests.has(id)) REG.interests.delete(id); else REG.interests.add(id);
  regRenderInts(); regUpdateFinish();
}
/* ---------- аватар: превью инициала + выбор акцента ---------- */
function regAvaRender(){
  const sw = document.getElementById('regAvaSw');
  if(sw) sw.innerHTML = REG_AVA.map((a,i)=>
    `<button type="button" class="reg-ava-sw ${i===REG.avaIdx?'on':''}" style="background:${a.bg}" aria-label="Акцент аватара ${i+1}" onclick="regAvaPick(${i})"></button>`
  ).join('');
  regAvaSync();
}
function regAvaPick(i){ REG.avaIdx = i; regAvaRender(); }
function regAvaSync(){
  const p = document.getElementById('regAvaPrev');
  if(!p) return;
  const a = REG_AVA[REG.avaIdx] || REG_AVA[0];
  const nm = (document.getElementById('regName')||{}).value || '';
  p.textContent = (nm.trim()[0] || 'O').toUpperCase();
  p.style.background = a.bg; p.style.color = a.fg;
  p.classList.add('set');
}
/* применить выбранный аватар к профилю ядра (#profAva правит только textContent —
   инлайновые стили сохраняются между renderMyProfile) */
function regApplyAva(){
  const a = REG_AVA[REG.avaIdx] || REG_AVA[0];
  const el = document.getElementById('profAva');
  if(el){ el.style.background = a.bg; el.style.color = a.fg; }
  try{ if(typeof PROFILE !== 'undefined'){ PROFILE.avaBg = a.bg; PROFILE.avaFg = a.fg; } }catch(e){}
}
function regUpdateFinish(){
  regErrHide('regErr3');
  regAvaSync();
  const terms = document.getElementById('regTerms');
  const name = document.getElementById('regName');
  const btn = document.getElementById('regFinishBtn');
  if(!terms || !name || !btn) return;
  const ok = terms.checked
    && name.value.trim().length > 0
    && REG.nickState === 'ok'
    && REG.interests.size > 0;
  btn.disabled = !ok;
}
function regLegal(kind){
  if(typeof openLegalDoc === 'function'){ openLegalDoc(kind); return; }
  toast(kind === 'terms' ? 'Условия сервиса откроются в разделе «Документы»' : 'Политика конфиденциальности откроется в разделе «Документы»');
}
function regFinish(){
  const name = document.getElementById('regName').value.trim();
  const nick = document.getElementById('regNick').value.trim();
  if(!name) return regErrShow('regErr3', 'Укажи имя — так тебя увидят в OKO');
  if(REG.nickState !== 'ok') return regErrShow('regErr3', 'Нужен свободный никнейм');
  if(!REG.interests.size) return regErrShow('regErr3', 'Выбери хотя бы один интерес — без него лента будет пустой');
  if(!document.getElementById('regTerms').checked) return regErrShow('regErr3', 'Прими условия сервиса, чтобы продолжить');

  /* профиль ядра + персист */
  PROFILE.name = name;
  PROFILE.nick = nick;
  regSave({
    contact: REG.contact, method: REG.method, name, nick,
    birth: document.getElementById('regBirth').value || null,
    adult: REG.adult,
    interests: [...REG.interests],
    avaIdx: REG.avaIdx,
    at: Date.now(),
  });
  if(typeof renderMyProfile === 'function') try{ renderMyProfile(); }catch(e){}
  regApplyAva();
  /* реально засеять алгоритм ленты: интересы дают стартовый вес сигналов
     (feed-algo и так читает oko-registration.interests, но это делает
     персонализацию видимой сразу с первой сессии) */
  try{ if(typeof faSignal === 'function') REG.interests.forEach(t=>faSignal(t, 8)); }catch(e){}

  regClose();
  _regPrevDoLogin(REG.method); /* оригинальный вход: oko-auth, скрыть auth, initLive, онбординг */

  /* welcome-попап + реальное начисление бонуса — один раз после первой регистрации */
  if(!regPopupsSeen().welcome){
    regPopupMark('welcome');
    try{ if(typeof walletAdd === 'function') walletAdd(2500, 'Приветственный бонус'); }catch(e){}
    setTimeout(()=>{
      showPopup({ico:'logo', title:'Добро пожаловать в OKO',
        body: regWelcomeBody(name),
        actions:[
          {label:'Забрать бонус', onclick:()=>{ if(document.getElementById('screen-wallet') && typeof showTab === 'function') showTab('wallet'); else toast('2 500 ₽ зачислены на лицевой счёт'); }},
          {label:'Позже', ghost:true},
        ]});
    }, 700);
  }
  regSchedulePopups();
}

/* ---------- премиум-тела системных попапов (rich HTML, свои reg-pop-* классы) ---------- */
function regFeatRow(ico, txt){
  return `<div class="reg-pop-feat">${I(ico)}<span>${txt}</span></div>`;
}
function regWelcomeBody(name){
  return `<div class="reg-pop">
    <p class="reg-pop-lead">Аккаунт создан, <b>${esc(name)}</b>. Ты в OKO — экосистеме, где контент, бизнес и заработок в одном месте.</p>
    <div class="reg-pop-bonus">
      <span class="reg-pop-bonus-ico">${I('money')}</span>
      <div><b>2 500 ₽</b><small>уже на лицевом счёте</small></div>
      <span class="reg-pop-bonus-tag">Подарок</span>
    </div>
    <div class="reg-pop-feats">
      ${regFeatRow('rocket','Продвижение постов и каналов')}
      ${regFeatRow('briefcase','Биржа заказов и услуг')}
      ${regFeatRow('play','Игры и ежедневные бонусы')}
    </div>
  </div>`;
}
function regProBody(){
  return `<div class="reg-pop">
    <p class="reg-pop-lead">Максимум возможностей OKO — приоритет, аналитика и сниженная комиссия.</p>
    <div class="reg-pop-feats">
      ${regFeatRow('rocket','Приоритет в ленте и поиске')}
      ${regFeatRow('poll','Расширенная аналитика профиля')}
      ${regFeatRow('megaphone','Кабинет продвижения')}
      ${regFeatRow('money','Сниженная комиссия биржи')}
    </div>
    <div class="reg-pop-price">
      <div><b>от 490 ₽</b><small>в месяц</small></div>
      <span class="reg-pop-save">Выгода 20% при оплате за год</span>
    </div>
  </div>`;
}
function regNotifBody(){
  return `<div class="reg-pop">
    <p class="reg-pop-lead">Узнавай о важном сразу, а не когда откроешь приложение.</p>
    <div class="reg-pop-feats">
      ${regFeatRow('comment','Ответы и сообщения в чатах')}
      ${regFeatRow('briefcase','Отклики и сделки на бирже')}
      ${regFeatRow('money','Начисления партнёрской программы')}
    </div>
  </div>`;
}
try{ window.regWelcomeBody = regWelcomeBody; window.regProBody = regProBody; window.regNotifBody = regNotifBody; }catch(e){}

/* ---------- системные попапы (каждый один раз, oko-reg-popups) ---------- */
let regPopTimers = [];
/* открыта переписка или полноэкранная вьюха (профиль/расширенные настройки)?
   — тогда промо-попап не перекрываем, а откладываем (как для sheet/попапа) */
function regViewBusy(){
  const cb = document.getElementById('convBody');
  if(cb && cb.style.display !== 'none' && cb.offsetParent !== null) return true;
  const st2 = document.getElementById('st2View'); if(st2 && st2.classList.contains('open')) return true;
  const ps  = document.getElementById('psView');  if(ps  && ps.classList.contains('open'))  return true;
  return false;
}
function regSchedulePopups(){
  regPopTimers.forEach(t=>clearTimeout(t)); regPopTimers = [];
  const seen = regPopupsSeen();
  if(!seen.pro)   regPopTimers.push(setTimeout(regPopupPro,   45000));
  if(!seen.notif) regPopTimers.push(setTimeout(regPopupNotif, 90000));
}
function regPopupPro(){
  if(regPopupsSeen().pro) return;
  if(document.getElementById('regView').classList.contains('open')) return;
  /* не перебивать открытый sheet/попап/переписку/полноэкранную вьюху — попробовать позже */
  if(document.querySelector('.sheet.open') || document.getElementById('okoPopup') || regViewBusy()){
    regPopTimers.push(setTimeout(regPopupPro, 20000)); return;
  }
  regPopupMark('pro');
  showPopup({ico:'crown', title:'Открой OKO PRO',
    body: regProBody(),
    actions:[
      {label:'Оформить PRO', onclick:()=>{ if(typeof openPay === 'function') openPay('PRO'); else toast('Тарифы скоро откроются'); }},
      {label:'Позже', ghost:true},
    ]});
}
function regPopupNotif(){
  if(regPopupsSeen().notif) return;
  if(document.getElementById('regView').classList.contains('open')) return;
  if(document.querySelector('.sheet.open') || document.getElementById('okoPopup') || regViewBusy()){
    regPopTimers.push(setTimeout(regPopupNotif, 20000)); return;
  }
  regPopupMark('notif');
  showPopup({ico:'bell', title:'Включи уведомления',
    body: regNotifBody(),
    actions:[
      {label:'Включить', onclick:()=>{
        try{ if(window.Notification && Notification.requestPermission) Notification.requestPermission(); }catch(e){}
        toast('Уведомления включены');
      }},
      {label:'Позже', ghost:true},
    ]});
}

/* ---------- патч doLogin: метод phone -> полная регистрация ---------- */
const _regPrevDoLogin = doLogin;
doLogin = function(method){
  if(method === 'phone'){ regOpen(); return; }
  _regPrevDoLogin(method);            /* telegram / google / apple — быстрый вход как раньше */
  regSchedulePopups();
};

/* ============================================================
   ПРЕМИУМ-ОНБОРДИНГ — брендовая воронка активации.
   Оболочка (#onboard, obShow/obNext/obFinish, ONBOARD, obStep)
   живёт в base.html. Мы доводим её цепочкой: пересобираем данные
   слайдов (ONBOARD) и переопределяем renderOb на богатые сцены.
   Ничего в base.html не редактируем.
   ============================================================ */
const REG_OB = [
  {scene:'brand',   tag:'OKO',              t:'Один глаз на всё',          d:'Мессенджер, лента, биржа, ИИ-инструменты, академия и заработок — в одном приложении. Добро пожаловать в OKO.'},
  {scene:'chat',    tag:'Мессенджер',       t:'Общение без границ',        d:'Личные чаты, группы и каналы в реальном времени. Голосовые, файлы и переводы денег — прямо в переписке.'},
  {scene:'feed',    tag:'Умная лента',      t:'Лента, которая знает тебя',  d:'Настоящие алгоритмы рекомендаций подстраивают ленту под твои интересы — и продвигают твои посты к новой аудитории.'},
  {scene:'market',  tag:'Биржа',            t:'Зарабатывай на навыках',     d:'Услуги и заказы с эскроу-защитой: деньги замораживаются и уходят исполнителю только после результата.'},
  {scene:'ai',      tag:'Нейро-инструменты',t:'ИИ берёт рутину на себя',    d:'Генерация постов, роликов, картинок и озвучки. Идея превращается в готовый контент за секунды.'},
  {scene:'academy', tag:'Академия',         t:'Учись и получай сертификат', d:'Видео-уроки, тесты и практика. За каждый пройденный курс — официальный сертификат OKO с печатью.'},
  {scene:'earn',    tag:'Партнёрка',        t:'Расти вместе с OKO',         d:'Партнёрская программа, рекламный кабинет и контент-завод. Приводи людей и клиентов — доход сразу в приложении.'},
];

/* уникальная сцена под каждый слайд — ни один приём не повторяется */
function regObScene(key){
  switch(key){
    case 'brand':
      return `<div class="reg-ob-scene reg-ob-scene--brand">
        <span class="reg-ob-ring"></span><span class="reg-ob-ring d2"></span><span class="reg-ob-ring d3"></span>
        <span class="reg-ob-orb o1"></span><span class="reg-ob-orb o2"></span><span class="reg-ob-orb o3"></span>
        <span class="reg-ob-logo">${I('logo')}</span>
      </div>`;
    case 'chat':
      return `<div class="reg-ob-scene reg-ob-scene--chat">
        <div class="reg-ob-bub in b1">Видел новую биржу OKO?</div>
        <div class="reg-ob-bub out b2">Да, уже беру первый заказ</div>
        <div class="reg-ob-bub in b3"><span class="reg-ob-typing"><i></i><i></i><i></i></span></div>
      </div>`;
    case 'feed':
      return `<div class="reg-ob-scene reg-ob-scene--feed">
        <div class="reg-ob-card">
          <div class="reg-ob-card-h">
            <span class="reg-ob-mini-ava">Н</span>
            <div><b>Нейро-дайджест</b><span class="reg-ob-rec">${I('compass')} рекомендовано вам</span></div>
          </div>
          <div class="reg-ob-lines"><i></i><i></i><i></i></div>
          <div class="reg-ob-react"><span>${I('heart')} 512</span><span>${I('comment')} 64</span><span>${I('share')}</span></div>
        </div>
      </div>`;
    case 'market':
      return `<div class="reg-ob-scene reg-ob-scene--market">
        <div class="reg-ob-list">
          <div class="reg-ob-list-top">
            <div class="reg-ob-list-img">${I('briefcase')}</div>
            <div class="reg-ob-list-b"><b>Монтаж Reels под ключ</b><small>исполнитель · 4.9 ${I('star')}</small></div>
            <span class="reg-ob-price">2 500 ₽</span>
          </div>
          <span class="reg-ob-escrow">${I('lock')} Сделка защищена эскроу</span>
        </div>
      </div>`;
    case 'ai':
      return `<div class="reg-ob-scene reg-ob-scene--ai">
        <span class="reg-ob-spark s1"></span><span class="reg-ob-spark s2"></span><span class="reg-ob-spark s3"></span>
        <div class="reg-ob-prompt">${I('bolt')}<span>Сделай ролик из статьи…</span></div>
        <div class="reg-ob-gen"><i></i><i></i><i></i></div>
      </div>`;
    case 'academy':
      return `<div class="reg-ob-scene reg-ob-scene--academy">
        <div class="reg-ob-cert">
          <div class="reg-ob-cert-h">${I('star')} Сертификат OKO</div>
          <div class="reg-ob-cert-name">Мастер контента</div>
          <div class="reg-ob-cert-lines"><i></i><i></i></div>
          <div class="reg-ob-seal">${I('check2')}</div>
        </div>
      </div>`;
    case 'earn':
      return `<div class="reg-ob-scene reg-ob-scene--earn">
        <div class="reg-ob-earn-sum"><span class="reg-ob-coin">${I('money')}</span><b>2 500 ₽</b></div>
        <div class="reg-ob-bars"><i></i><i></i><i></i><i></i></div>
      </div>`;
    default:
      return `<div class="reg-ob-scene reg-ob-scene--brand"><span class="reg-ob-logo">${I('logo')}</span></div>`;
  }
}

/* пересобрать данные онбординга ядра под наши 7 слайдов (ONBOARD — const-массив,
   мутируем содержимое, не переназначаем ссылку) */
try{
  if(typeof ONBOARD !== 'undefined' && Array.isArray(ONBOARD)){
    ONBOARD.length = 0;
    REG_OB.forEach(function(x){ ONBOARD.push(x); });
  }
}catch(e){}

/* переопределяем рендер онбординга на премиум-версию */
if(typeof renderOb === 'function'){
  renderOb = function(){
    const list = (typeof ONBOARD !== 'undefined' && ONBOARD.length) ? ONBOARD : REG_OB;
    const n = list.length;
    if(typeof obStep !== 'number' || obStep < 0) obStep = 0;
    if(obStep > n - 1) obStep = n - 1;
    const s = list[obStep] || REG_OB[obStep] || REG_OB[0];
    const stage = document.getElementById('obStage');
    if(!stage) return;
    stage.innerHTML =
      `<div class="reg-ob-top">
         <span class="reg-ob-count-chip">Шаг ${obStep + 1} / ${n}</span>
         <div class="reg-ob-track"><i style="width:${((obStep + 1) / n * 100).toFixed(1)}%"></i></div>
       </div>
       <div class="reg-ob-center">
         <div class="reg-ob" data-step="${obStep}">
           ${regObScene(s.scene)}
           <span class="reg-ob-tag">${esc(s.tag || '')}</span>
           <h2 class="reg-ob-title">${esc(s.t || '')}</h2>
           <p class="reg-ob-desc">${esc(s.d || '')}</p>
         </div>
       </div>`;
    const dots = document.getElementById('obDots');
    if(dots) dots.innerHTML = list.map((_, i)=>`<span class="${i === obStep ? 'on' : ''}"></span>`).join('');
    const nx = document.getElementById('obNext');
    if(nx) nx.innerHTML = (obStep === n - 1 ? 'Начать в OKO' : 'Далее') + I('chev');
  };
}

/* ---------- самоинициализация ---------- */
(function regInit(){
  /* ввод кода: автофокус-цепочка, backspace, вставка всего кода разом */
  document.querySelectorAll('#regCodeRow input').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      inp.value = inp.value.replace(/\D/g, '').slice(0, 1);
      inp.classList.toggle('fill', !!inp.value);
      regErrHide('regErr2');
      const i = +inp.dataset.i;
      if(inp.value && i < 3) regCodeFocus(i + 1);
      if(regCodeVal().length === 4) setTimeout(regVerifyCode, 120);
    });
    inp.addEventListener('keydown', e=>{
      const i = +inp.dataset.i;
      if(e.key === 'Backspace' && !inp.value && i > 0) regCodeFocus(i - 1);
    });
    inp.addEventListener('paste', e=>{
      const d = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 4);
      if(d.length < 2) return;
      e.preventDefault();
      document.querySelectorAll('#regCodeRow input').forEach((c, j)=>{ c.value = d[j] || ''; c.classList.toggle('fill', !!c.value); });
      if(d.length === 4) setTimeout(regVerifyCode, 120);
      else regCodeFocus(Math.min(d.length, 3));
    });
  });
  regRenderInts();
  /* дата рождения не может быть в будущем */
  const bd = document.getElementById('regBirth');
  if(bd){ try{ bd.max = new Date().toISOString().slice(0, 10); }catch(e){} }
  /* если уже вошли (перезагрузка) — планируем одноразовые попапы */
  if(typeof authed === 'function' && authed()) regSchedulePopups();
  /* восстановить выбранный аватар после перезагрузки */
  try{
    const reg = JSON.parse(localStorage.getItem('oko-registration') || 'null');
    if(reg && typeof reg.avaIdx === 'number' && REG_AVA[reg.avaIdx]){
      REG.avaIdx = reg.avaIdx; regApplyAva();
    }
  }catch(e){}
})();
