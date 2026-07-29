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
      showPopup({ico:'logo', title: regWelcomeTitle(name),
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

/* --- реферальная ссылка: захват из URL / хранение / чтение --- */
function regRefCapture(){
  try{
    const q = new URLSearchParams(location.search);
    const r = (q.get('ref') || q.get('start') || '').trim().slice(0, 40);
    if(r && /^[a-z0-9_\-]{2,40}$/i.test(r)){
      localStorage.setItem('oko-ref', r.toLowerCase());
    }
  }catch(e){}
}
function regRefGet(){
  try{ return (localStorage.getItem('oko-ref') || '').trim(); }catch(e){ return ''; }
}

/* --- lettering: буквы имени появляются одна за другой (--i задаёт задержку) --- */
function regNameLet(name){
  const src = String(name || '').trim().slice(0, 24);
  if(!src) return '';
  let out = '';
  for(let i = 0; i < src.length; i++){
    const ch = src[i];
    if(ch === ' '){ out += '<span class="reg-let sp"> </span>'; continue; }
    out += `<span class="reg-let" style="--i:${i}">${esc(ch)}</span>`;
  }
  return `<span class="reg-hello-name">${out}</span>`;
}

/* --- заголовок welcome с персональным приветствием и lettering --- */
function regWelcomeTitle(name){
  const nm = String(name || '').trim();
  if(!nm) return 'Добро пожаловать в OKO';
  return `<span class="reg-hello">Добро пожаловать,<br>${regNameLet(nm)}</span>`;
}

/* --- быстрые действия: 4 карточки первого клика (заголовки без переноса) --- */
function regQuickActions(){
  const items = [
    {act:'video',   ico:'camera',   t:'Первое видео',   s:'Собери ролик за 3 минуты'},
    {act:'roulette',ico:'gm-gift',  t:'Рулетка',        s:'Крути ежедневный бонус'},
    {act:'invite',  ico:'user',     t:'Пригласи друга', s:'Плюс 2 бонуса вам обоим'},
    {act:'lesson',  ico:'star',     t:'Первый урок',    s:'Академия с сертификатом'},
  ];
  return `<div class="reg-pop-qa">
    ${items.map((x, i) => `
      <button type="button" class="reg-qa" style="--i:${i}" onclick="regGo('${x.act}')">
        <span class="reg-qa-ico">${I(x.ico)}</span>
        <span class="reg-qa-txt">
          <b class="reg-qa-t">${x.t}</b>
          <span class="reg-qa-s">${x.s}</span>
        </span>
        <span class="reg-qa-arr">${I('chev')}</span>
      </button>`).join('')}
  </div>`;
}

/* --- реф-нотис: показать, что пригласивший получит бонус после оплаты тарифа --- */
function regRefNotice(){
  const ref = regRefGet();
  if(!ref) return '';
  return `<div class="reg-pop-ref">
    <span class="reg-pop-ref-ico">${I('heart')}</span>
    <div class="reg-pop-ref-txt">
      Привет! Твой пригласивший <b>@${esc(ref)}</b> получит бонус, когда ты оформишь тариф OKO.
    </div>
  </div>`;
}

/* --- переход из quick-action: закрыть попап и открыть нужный раздел --- */
function regGo(kind){
  try{ if(typeof closePopup === 'function') closePopup(); }catch(e){}
  setTimeout(()=>{
    try{
      if(kind === 'video'){
        if(typeof showTab === 'function') showTab('mini');
        if(typeof toast === 'function') toast('Открыл мини-аппы — тапни «Реклама» или «Академия», чтобы собрать первое видео');
      } else if(kind === 'roulette'){
        if(typeof showTab === 'function') showTab('games');
      } else if(kind === 'invite'){
        if(typeof showTab === 'function'){
          if(document.getElementById('screen-partner')) showTab('partner');
          else showTab('profile');
        }
      } else if(kind === 'lesson'){
        if(typeof showTab === 'function'){
          if(document.getElementById('screen-academy')) showTab('academy');
          else showTab('mini');
        }
      }
    }catch(e){}
  }, 120);
}
try{ window.regGo = regGo; window.regRefGet = regRefGet; }catch(e){}

function regWelcomeBody(name){
  return `<div class="reg-pop">
    ${regRefNotice()}
    <p class="reg-pop-lead">Аккаунт создан. Ты в OKO — экосистеме, где контент, бизнес и заработок в одном месте.</p>
    <div class="reg-pop-bonus">
      <span class="reg-pop-bonus-ico">${I('money')}</span>
      <div><b>2 500 ₽</b><small>уже на лицевом счёте</small></div>
      <span class="reg-pop-bonus-tag">Подарок</span>
    </div>
    <div class="reg-pop-qa-lab">С чего начать</div>
    ${regQuickActions()}
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

/* ---------- патч doLogin: метод phone -> НОВЫЙ 4-шаговый флоу rg2 ---------- */
const _regPrevDoLogin = doLogin;
doLogin = function(method){
  if(method === 'phone'){ rg2Open(); return; }
  _regPrevDoLogin(method);            /* telegram / google / apple — быстрый вход как раньше */
  regSchedulePopups();
};

/* ============================================================
   RG2 — новый 4-шаговый флоу регистрации внутри #authScreen
   (по ТЗ Даниэля 29.07). Полностью самодостаточный, префикс rg2-.
   Не трогает base.html: динамически строит DOM внутри #authScreen,
   прячет .auth-inner, восстанавливает при back-to-step-0.
   ============================================================ */
const RG2 = {
  step: 1,                 /* 1..4 */
  method: 'email',         /* email | phone — авто по вводу */
  contact: '',             /* email или +7... */
  password: '',
  remember: true,
  code: '',                /* сгенерированный 6-значный код (мок) */
  codeTimer: null,
  codeLeft: 0,
  resendUsed: 0,
  name: '',
  nick: '',
  bio: '',
  avaIdx: 2,               /* индекс REG_AVA */
  avaImg: '',              /* dataURL если загружена картинка */
  tier: 'FREE',            /* FREE | START | PRO | BUSINESS | MAX */
  period: 1,               /* 1|3|6|12 месяцев */
};
const RG2_ADMIN_EMAIL = (typeof ADMIN_EMAIL !== 'undefined') ? ADMIN_EMAIL : 'okoteam.top@gmail.com';
const RG2_TAKEN_NICKS = ['oko','okoteam','oko_official','daniel','ktodaniel','admin','support','team','ceo','help'];
const RG2_TIERS = [
  {id:'FREE',     name:'Free',     price:0,     line:'Старт бесплатно',           feats:['Лента и чаты','2 500 ₽ бонус','Базовые инструменты']},
  {id:'START',    name:'Start',    price:990,   line:'Первые системные инструменты', feats:['Автопостинг в 2 сети','Файлы до 300 МБ','Скидка 5% на рекламу']},
  {id:'PRO',      name:'Pro',      price:4900,  line:'Максимум возможностей',      feats:['Проверка видео: безлимит','Система роста','Все соцсети, файлы до 2 ГБ','Скидка 10% на рекламу'], reco:true},
  {id:'BUSINESS', name:'Business', price:19900, line:'Команда и конвейер',         feats:['Контент-завод под ключ','Рекламный кабинет PRO','Менеджер и API']},
  {id:'MAX',      name:'Max',      price:149900,line:'Максимальный доступ',         feats:['Всё из PRO + BUSINESS','Персональный продюсер','Приоритет во всём']},
];
const RG2_PERIODS = [
  {m:1,  lab:'1 мес',  disc:0},
  {m:3,  lab:'3 мес',  disc:10},
  {m:6,  lab:'6 мес',  disc:15},
  {m:12, lab:'Год',    disc:20},
];

function rg2Detect(v){
  const s = String(v||'').trim();
  if(/^\+?\d[\d\s\-()]{7,}$/.test(s) && s.replace(/\D/g,'').length >= 8) return 'phone';
  return 'email';
}
function rg2MaskContact(v){
  const s = String(v||'');
  if(rg2Detect(s) === 'email'){
    const [u, d] = s.split('@');
    if(!d) return s;
    const uu = u.length <= 2 ? u : u[0] + '***' + u.slice(-1);
    return uu + '@' + d;
  }
  const d = s.replace(/\D/g,'');
  if(d.length < 4) return s;
  return '+' + d.slice(0,1) + ' *** *** ' + d.slice(-2);
}
function rg2Rand6(){ return String(Math.floor(100000 + Math.random()*900000)); }
function rg2RandNick(){ return 'user_' + Math.random().toString(36).slice(2,8); }

/* ---------- вход в поток / выход ---------- */
function rg2Open(){
  const scr = document.getElementById('authScreen');
  if(!scr) return;
  scr.classList.remove('hidden');
  /* спрятать стандартный auth-inner */
  const inner = scr.querySelector('.auth-inner');
  if(inner) inner.style.display = 'none';
  /* создать shell если ещё нет */
  let shell = document.getElementById('rg2Shell');
  if(!shell){
    shell = document.createElement('div');
    shell.id = 'rg2Shell';
    shell.className = 'rg2-shell';
    shell.innerHTML = rg2ShellHTML();
    scr.appendChild(shell);
    rg2BindOnce();
  }
  shell.classList.add('open');
  /* сбросить состояние */
  RG2.step = 1; RG2.contact = ''; RG2.password = ''; RG2.code = '';
  RG2.name = ''; RG2.nick = rg2RandNick(); RG2.bio = '';
  RG2.avaIdx = 2; RG2.avaImg = ''; RG2.tier = 'FREE'; RG2.period = 1;
  RG2.resendUsed = 0;
  rg2GoTo(1);
}
function rg2Exit(){
  const shell = document.getElementById('rg2Shell');
  if(shell) shell.classList.remove('open');
  const scr = document.getElementById('authScreen');
  const inner = scr && scr.querySelector('.auth-inner');
  if(inner) inner.style.display = '';
  if(RG2.codeTimer){ clearInterval(RG2.codeTimer); RG2.codeTimer = null; }
}
function rg2Back(){
  if(RG2.step <= 1){ rg2Exit(); return; }
  rg2GoTo(RG2.step - 1);
}
function rg2GoTo(n){
  RG2.step = n;
  /* прогресс-таймлайн */
  for(let i=1; i<=4; i++){
    const dot = document.querySelector('#rg2Tl .rg2-tl-dot[data-i="'+i+'"]');
    if(dot){
      dot.classList.toggle('done', i < n);
      dot.classList.toggle('on',   i === n);
    }
    const bar = document.querySelector('#rg2Tl .rg2-tl-seg[data-i="'+i+'"]');
    if(bar) bar.classList.toggle('done', i < n);
  }
  /* видимость шагов */
  for(let i=1; i<=4; i++){
    const s = document.getElementById('rg2Step'+i);
    if(s){
      s.classList.remove('active','rg2-back');
      if(i === n){
        void s.offsetWidth;
        s.classList.add('active');
      }
    }
  }
  /* фокус на первое поле */
  setTimeout(()=>{
    const first = document.querySelector('#rg2Step'+n+' input:not([type=hidden]):not([type=file]):not([disabled])');
    if(first && n !== 4) try{ first.focus(); }catch(e){}
  }, 300);
  /* прячем back на 1 шаге — заменяем на «к вариантам входа» */
  const back = document.getElementById('rg2Back');
  if(back) back.dataset.first = (n === 1 ? '1' : '0');
}
function rg2Err(id, msg){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = msg || '';
  el.classList.toggle('show', !!msg);
  if(msg){ void el.offsetWidth; el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'), 400); }
}

/* ---------- ШЕЛЛ HTML ---------- */
function rg2ShellHTML(){
  return `
  <header class="rg2-head">
    <button type="button" class="rg2-back" id="rg2Back" data-first="1" onclick="rg2Back()" aria-label="Назад">
      <svg class="i"><use href="#i-back"/></svg>
    </button>
    <div class="rg2-tl" id="rg2Tl">
      ${[1,2,3,4].map(i=>`
        <span class="rg2-tl-dot ${i===1?'on':''}" data-i="${i}"><i>${i}</i></span>
        ${i<4?`<span class="rg2-tl-seg" data-i="${i}"><i></i></span>`:''}
      `).join('')}
    </div>
    <span class="rg2-brand" aria-hidden="true"><svg class="i"><use href="#i-logo"/></svg></span>
  </header>
  <div class="rg2-body">
    ${rg2Step1HTML()}
    ${rg2Step2HTML()}
    ${rg2Step3HTML()}
    ${rg2Step4HTML()}
  </div>
  <input type="file" id="rg2AvaFile" accept="image/*" hidden>
  `;
}

/* ---------- ШАГ 1 ---------- */
function rg2Step1HTML(){
  return `
  <section class="rg2-step active" id="rg2Step1">
    <h1 class="rg2-h">Создай аккаунт</h1>
    <p class="rg2-sub">Введи почту или телефон и пароль — этого достаточно для старта.</p>
    <label class="rg2-lab" for="rg2Contact">Email или телефон</label>
    <div class="rg2-field">
      <span class="rg2-field-ic" id="rg2ContactIc"><svg class="i"><use href="#i-send"/></svg></span>
      <input id="rg2Contact" type="text" inputmode="email" autocomplete="email"
             placeholder="you@example.com или +7 900 000-00-00"
             oninput="rg2ContactInput()">
    </div>
    <label class="rg2-lab" for="rg2Pass">Придумай пароль</label>
    <div class="rg2-field">
      <span class="rg2-field-ic"><svg class="i"><use href="#i-lock"/></svg></span>
      <input id="rg2Pass" type="password" autocomplete="new-password"
             placeholder="Не короче 8 символов"
             oninput="rg2PassInput()">
      <button type="button" class="rg2-eye" data-target="rg2Pass" onclick="rg2TogglePass('rg2Pass')" aria-label="Показать пароль">
        <svg class="i"><use href="#i-eye"/></svg>
      </button>
    </div>
    <div class="rg2-strength"><i id="rg2StrBar"></i></div>
    <div class="rg2-strength-lab" id="rg2StrLab">Надёжность пароля</div>
    <label class="rg2-lab" for="rg2Pass2">Повтори пароль</label>
    <div class="rg2-field">
      <span class="rg2-field-ic"><svg class="i"><use href="#i-check2"/></svg></span>
      <input id="rg2Pass2" type="password" autocomplete="new-password" placeholder="Ещё раз тот же пароль" oninput="rg2Pass2Input()">
      <button type="button" class="rg2-eye" data-target="rg2Pass2" onclick="rg2TogglePass('rg2Pass2')" aria-label="Показать пароль">
        <svg class="i"><use href="#i-eye"/></svg>
      </button>
    </div>
    <label class="rg2-check">
      <input type="checkbox" id="rg2Remember" checked>
      <span class="rg2-check-box"><svg class="i"><use href="#i-check"/></svg></span>
      <span>Сохранить вход на этом устройстве</span>
    </label>
    <div class="rg2-err" id="rg2Err1"></div>
    <button class="rg2-btn" id="rg2Next1Btn" onclick="rg2Next1()">Продолжить <svg class="i"><use href="#i-chev"/></svg></button>
    <div class="rg2-alt">
      Уже есть аккаунт? <a onclick="rg2Login()">Войти</a>
    </div>
    <div class="rg2-secure">
      <svg class="i"><use href="#i-lock"/></svg>
      Данные шифруются, не передаются третьим лицам
    </div>
  </section>`;
}
function rg2ContactInput(){
  rg2Err('rg2Err1', '');
  const el = document.getElementById('rg2Contact');
  const v = el.value;
  const kind = rg2Detect(v);
  RG2.method = kind;
  /* иконка слева */
  const ic = document.getElementById('rg2ContactIc');
  if(ic) ic.innerHTML = kind === 'phone'
    ? '<svg class="i"><use href="#i-phone"/></svg>'
    : '<svg class="i"><use href="#i-send"/></svg>';
  /* автоформат телефона */
  if(kind === 'phone'){
    el.inputMode = 'tel'; el.autocomplete = 'tel';
    let d = v.replace(/\D/g,'');
    if(d.startsWith('8')) d = '7' + d.slice(1);
    if(d && !d.startsWith('7') && !d.startsWith('9')) { /* не форматируем */ }
    d = d.slice(0, 11);
    if(d.length && (d.startsWith('7') || d.length >= 10)){
      if(!d.startsWith('7')) d = '7' + d;
      let out = '+7';
      if(d.length > 1) out += ' ' + d.slice(1,4);
      if(d.length > 4) out += ' ' + d.slice(4,7);
      if(d.length > 7) out += '-' + d.slice(7,9);
      if(d.length > 9) out += '-' + d.slice(9,11);
      el.value = out;
    }
  } else {
    el.inputMode = 'email'; el.autocomplete = 'email';
  }
}
function rg2TogglePass(id){
  const inp = document.getElementById(id);
  const btn = document.querySelector('.rg2-eye[data-target="'+id+'"]');
  if(!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  if(btn) btn.classList.toggle('on', show);
}
function rg2PassScore(p){
  let s = 0;
  if(p.length >= 8) s++;
  if(p.length >= 12) s++;
  if(/[A-ZА-Я]/.test(p) && /[a-zа-я]/.test(p)) s++;
  if(/\d/.test(p)) s++;
  if(/[^\w\sа-яА-Я]/.test(p)) s++;
  return Math.min(s, 4);
}
function rg2PassInput(){
  rg2Err('rg2Err1', '');
  const p = document.getElementById('rg2Pass').value;
  const bar = document.getElementById('rg2StrBar');
  const lab = document.getElementById('rg2StrLab');
  const sc = p ? rg2PassScore(p) : 0;
  if(bar){
    bar.style.width = (sc/4*100) + '%';
    bar.className = sc >= 3 ? 'hi' : (sc === 2 ? 'mid' : (sc === 1 ? 'lo' : ''));
  }
  if(lab){
    lab.textContent = !p ? 'Надёжность пароля'
      : (sc <= 1 ? 'Слабый — добавь символов'
      : sc === 2 ? 'Нормальный'
      : sc === 3 ? 'Хороший' : 'Отличный');
  }
  /* при изменении первого пароля — сверка второго */
  rg2Pass2Input();
}
function rg2Pass2Input(){
  rg2Err('rg2Err1', '');
  const p1 = document.getElementById('rg2Pass').value;
  const p2 = document.getElementById('rg2Pass2').value;
  const f  = document.getElementById('rg2Pass2');
  if(!p2){ f.classList.remove('bad','ok'); return; }
  if(p2 === p1 && p2.length >= 8){ f.classList.add('ok'); f.classList.remove('bad'); }
  else { f.classList.add('bad'); f.classList.remove('ok'); }
}
async function rg2Next1(){
  const contact = document.getElementById('rg2Contact').value.trim();
  const p1 = document.getElementById('rg2Pass').value;
  const p2 = document.getElementById('rg2Pass2').value;
  const kind = rg2Detect(contact);
  if(kind === 'email'){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)) return rg2Err('rg2Err1', 'Проверь адрес почты — похоже, опечатка');
  } else {
    if(contact.replace(/\D/g,'').length < 10) return rg2Err('rg2Err1', 'Введи номер полностью (не меньше 10 цифр)');
  }
  if(p1.length < 8) return rg2Err('rg2Err1', 'Пароль слишком короткий — минимум 8 символов');
  if(p1 !== p2)     return rg2Err('rg2Err1', 'Пароли не совпадают — сверь повтор');

  RG2.contact = contact; RG2.method = kind; RG2.password = p1;
  RG2.remember = document.getElementById('rg2Remember').checked;

  /* вход владельца по мастер-почте — без кода */
  if(kind === 'email' && contact.toLowerCase() === RG2_ADMIN_EMAIL){
    const btn = document.getElementById('rg2Next1Btn');
    btn.classList.add('loading'); btn.disabled = true;
    let ok = false;
    try{ if(typeof adminLogin === 'function') ok = await adminLogin(contact, p1); }catch(e){}
    btn.classList.remove('loading'); btn.disabled = false;
    if(!ok) return rg2Err('rg2Err1', 'Неверный пароль владельца');
    /* готово: сразу входим */
    rg2FinishOwner();
    return;
  }
  /* отправить код (мок / stub) — реально pinger позже подключит /api.php?action=auth_send_code */
  rg2SendCode();
  rg2GoTo(2);
}
function rg2Login(){
  /* «Уже есть аккаунт»: пока это тот же поток авторизации (нет отдельного «войти по паролю»).
     Валидная почта + пароль → на 2 шаг за кодом. Иначе — подсказка. */
  const contact = document.getElementById('rg2Contact').value.trim();
  const p1 = document.getElementById('rg2Pass').value;
  if(!contact || !p1){
    return rg2Err('rg2Err1', 'Введи почту/телефон и пароль — и жми «Продолжить»');
  }
  rg2Next1();
}

/* ---------- ШАГ 2 ---------- */
function rg2Step2HTML(){
  return `
  <section class="rg2-step" id="rg2Step2">
    <div class="rg2-code-ico"><svg class="i"><use href="#i-lock"/></svg></div>
    <h1 class="rg2-h rg2-h--c">Введи код</h1>
    <p class="rg2-sub rg2-sub--c">Отправили на <b id="rg2CodeTo">—</b></p>
    <div class="rg2-code" id="rg2Code">
      ${[0,1,2,3,4,5].map(i=>`<input inputmode="numeric" maxlength="1" data-i="${i}" ${i===0?'autocomplete="one-time-code"':''}>`).join('')}
    </div>
    <div class="rg2-err rg2-err--c" id="rg2Err2"></div>
    <button type="button" class="rg2-resend" id="rg2Resend" onclick="rg2Resend()" disabled>Отправить снова через 45 сек</button>
    <button class="rg2-btn" id="rg2Next2Btn" onclick="rg2Next2()" disabled>Продолжить <svg class="i"><use href="#i-chev"/></svg></button>
    <button type="button" class="rg2-linkbtn" onclick="rg2Back()">← Изменить контакт</button>
  </section>`;
}
function rg2SendCode(){
  RG2.code = rg2Rand6();
  const to = document.getElementById('rg2CodeTo');
  if(to) to.textContent = rg2MaskContact(RG2.contact);
  /* очистить инпуты */
  document.querySelectorAll('#rg2Code input').forEach(i=>{ i.value=''; i.classList.remove('fill'); });
  document.getElementById('rg2Code').classList.remove('err');
  rg2Err('rg2Err2', '');
  rg2Next2Enable();
  /* таймер повторной отправки */
  if(RG2.codeTimer) clearInterval(RG2.codeTimer);
  RG2.codeLeft = 45;
  const btn = document.getElementById('rg2Resend');
  if(btn){ btn.disabled = true; btn.textContent = 'Отправить снова через 45 сек'; }
  RG2.codeTimer = setInterval(()=>{
    RG2.codeLeft--;
    if(RG2.codeLeft <= 0){
      clearInterval(RG2.codeTimer); RG2.codeTimer = null;
      if(btn){ btn.disabled = false; btn.textContent = 'Отправить снова'; }
    } else if(btn){
      btn.textContent = 'Отправить снова через ' + RG2.codeLeft + ' сек';
    }
  }, 1000);
  /* демо-показ кода (только на клиенте; в проде убрать) */
  try{ if(typeof toast === 'function') toast('Код: ' + RG2.code + ' (демо)'); }catch(e){}
  /* реальная отправка (когда бек включит) */
  try{
    if(typeof OKO_API !== 'undefined'){
      fetch(OKO_API + '?action=auth_send_code', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({contact: RG2.contact, method: RG2.method})
      }).catch(()=>{});
    }
  }catch(e){}
}
function rg2Resend(){
  if(RG2.resendUsed >= 5) return;
  RG2.resendUsed++;
  rg2SendCode();
}
function rg2CodeVal(){ return [...document.querySelectorAll('#rg2Code input')].map(i=>i.value).join(''); }
function rg2Next2Enable(){
  const v = rg2CodeVal();
  const b = document.getElementById('rg2Next2Btn');
  if(b) b.disabled = v.length !== 6;
}
function rg2Next2(){
  const v = rg2CodeVal();
  if(v.length !== 6) return rg2Err('rg2Err2', 'Введи все 6 цифр кода');
  /* «правильный код» = сгенерированный, или спец-мастер 000000 (для теста) */
  if(v !== RG2.code && v !== '000000'){
    const row = document.getElementById('rg2Code');
    row.classList.remove('err'); void row.offsetWidth; row.classList.add('err');
    return rg2Err('rg2Err2', 'Код не подходит — проверь и попробуй ещё раз');
  }
  /* авто-имя из email до @ */
  if(!RG2.name){
    RG2.name = RG2.method === 'email' ? (RG2.contact.split('@')[0].replace(/[^a-zA-Zа-яА-Я0-9]/g,' ').trim().slice(0,24) || 'Гость') : 'Гость';
  }
  const nameInp = document.getElementById('rg2Name');
  if(nameInp && !nameInp.value) nameInp.value = RG2.name;
  const nickInp = document.getElementById('rg2Nick');
  if(nickInp && !nickInp.value) nickInp.value = RG2.nick;
  rg2AvaSync();
  rg2GoTo(3);
}

/* ---------- ШАГ 3: профиль ---------- */
function rg2Step3HTML(){
  return `
  <section class="rg2-step" id="rg2Step3">
    <h1 class="rg2-h">Профиль</h1>
    <p class="rg2-sub">Как тебя показывать в OKO.</p>
    <div class="rg2-ava-row">
      <button type="button" class="rg2-ava" id="rg2Ava" onclick="rg2AvaPick()" aria-label="Выбрать аватар">
        <span class="rg2-ava-fg" id="rg2AvaFg">O</span>
        <span class="rg2-ava-edit"><svg class="i"><use href="#i-camera"/></svg></span>
      </button>
      <div class="rg2-ava-side">
        <div class="rg2-ava-lab">Аватар</div>
        <div class="rg2-ava-sw" id="rg2AvaSw"></div>
        <button type="button" class="rg2-ava-upload" onclick="document.getElementById('rg2AvaFile').click()">
          <svg class="i"><use href="#i-photo"/></svg> Загрузить фото
        </button>
      </div>
    </div>
    <label class="rg2-lab" for="rg2Name">Имя</label>
    <div class="rg2-field">
      <span class="rg2-field-ic"><svg class="i"><use href="#i-user"/></svg></span>
      <input id="rg2Name" type="text" autocomplete="name" placeholder="Как тебя зовут" oninput="rg2NameInput()">
    </div>
    <label class="rg2-lab" for="rg2Nick">Никнейм</label>
    <div class="rg2-field rg2-nick">
      <span class="rg2-field-ic">@</span>
      <input id="rg2Nick" type="text" autocomplete="off" placeholder="никнейм" oninput="rg2NickInput()">
      <span class="rg2-nick-st" id="rg2NickSt"></span>
    </div>
    <div class="rg2-nick-msg" id="rg2NickMsg">Придумай уникальный @username — под ним тебя найдут в OKO</div>
    <label class="rg2-lab" for="rg2Bio">Био <span class="rg2-lab-dim">— по желанию</span></label>
    <div class="rg2-field rg2-bio-wrap">
      <textarea id="rg2Bio" maxlength="160" placeholder="Пара слов о себе — покажется в профиле" oninput="rg2BioInput()"></textarea>
      <span class="rg2-bio-count" id="rg2BioCount">0 / 160</span>
    </div>
    <div class="rg2-err" id="rg2Err3"></div>
    <button class="rg2-btn" id="rg2Next3Btn" onclick="rg2Next3()" disabled>Продолжить <svg class="i"><use href="#i-chev"/></svg></button>
  </section>`;
}
function rg2AvaPalette(){
  return (typeof REG_AVA !== 'undefined' && REG_AVA.length) ? REG_AVA : [
    {bg:'linear-gradient(135deg,#B9FF4D,#7ACC00)', fg:'#001400'},
    {bg:'linear-gradient(135deg,#9AFF00,#4d9c00)', fg:'#04140a'},
    {bg:'linear-gradient(135deg,#1c1c1c,#000)',     fg:'#9AFF00'},
  ];
}
function rg2AvaRenderSw(){
  const sw = document.getElementById('rg2AvaSw'); if(!sw) return;
  const pal = rg2AvaPalette();
  sw.innerHTML = pal.map((a,i)=>
    `<button type="button" class="rg2-ava-swb ${(i===RG2.avaIdx && !RG2.avaImg)?'on':''}" style="background:${a.bg}" onclick="rg2AvaPickIdx(${i})" aria-label="Акцент ${i+1}"></button>`
  ).join('');
}
function rg2AvaPickIdx(i){
  RG2.avaIdx = i; RG2.avaImg = '';
  rg2AvaRenderSw(); rg2AvaSync();
}
function rg2AvaPick(){
  /* тап на кружок — открыть file input */
  const f = document.getElementById('rg2AvaFile');
  if(f) f.click();
}
function rg2AvaSync(){
  const el = document.getElementById('rg2Ava');
  const fg = document.getElementById('rg2AvaFg');
  if(!el || !fg) return;
  const nm = (document.getElementById('rg2Name')||{}).value || RG2.name || '';
  fg.textContent = (nm.trim()[0] || 'O').toUpperCase();
  if(RG2.avaImg){
    el.style.backgroundImage = 'url(' + RG2.avaImg + ')';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.color = 'transparent';
    fg.style.opacity = '0';
  } else {
    const a = rg2AvaPalette()[RG2.avaIdx] || rg2AvaPalette()[0];
    el.style.backgroundImage = '';
    el.style.background = a.bg;
    el.style.color = a.fg;
    fg.style.opacity = '1';
  }
}
function rg2NameInput(){
  rg2Err('rg2Err3', '');
  RG2.name = document.getElementById('rg2Name').value.trim();
  rg2AvaSync();
  rg2Next3Enable();
}
function rg2NickInput(){
  rg2Err('rg2Err3','');
  const raw = document.getElementById('rg2Nick').value;
  const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,24);
  if(raw !== clean) document.getElementById('rg2Nick').value = clean;
  RG2.nick = clean;
  const st  = document.getElementById('rg2NickSt');
  const msg = document.getElementById('rg2NickMsg');
  if(!clean){ st.innerHTML=''; msg.textContent='Придумай уникальный @username — под ним тебя найдут в OKO'; msg.className='rg2-nick-msg'; rg2Next3Enable(); return; }
  if(clean.length < 3){
    st.innerHTML = '<span class="bad"><svg class="i" style="transform:rotate(45deg)"><use href="#i-plus"/></svg></span>';
    msg.textContent = 'Слишком короткий — минимум 3 символа';
    msg.className = 'rg2-nick-msg bad';
    rg2Next3Enable(); return;
  }
  if(RG2_TAKEN_NICKS.includes(clean)){
    st.innerHTML = '<span class="bad"><svg class="i" style="transform:rotate(45deg)"><use href="#i-plus"/></svg></span>';
    msg.textContent = '@' + clean + ' уже занят — попробуй другой';
    msg.className = 'rg2-nick-msg bad';
    rg2Next3Enable(); return;
  }
  st.innerHTML = '<span class="ok"><svg class="i"><use href="#i-check2"/></svg></span>';
  msg.textContent = '@' + clean + ' свободен';
  msg.className = 'rg2-nick-msg ok';
  rg2Next3Enable();
}
function rg2BioInput(){
  RG2.bio = document.getElementById('rg2Bio').value.slice(0,160);
  const c = document.getElementById('rg2BioCount');
  if(c) c.textContent = RG2.bio.length + ' / 160';
}
function rg2NickOk(){
  const v = RG2.nick;
  return !!v && v.length >= 3 && !RG2_TAKEN_NICKS.includes(v);
}
function rg2Next3Enable(){
  const b = document.getElementById('rg2Next3Btn');
  if(!b) return;
  b.disabled = !(RG2.name && rg2NickOk());
}
function rg2Next3(){
  if(!RG2.name)     return rg2Err('rg2Err3', 'Укажи имя — так тебя увидят в OKO');
  if(!rg2NickOk())  return rg2Err('rg2Err3', 'Придумай никнейм ≥ 3 символа');
  /* сохранить профиль в PROFILE до финиша (пусть UI видит после back-навигации) */
  try{
    if(typeof PROFILE !== 'undefined'){
      PROFILE.name = RG2.name;
      PROFILE.nick = RG2.nick;
      PROFILE.bio  = RG2.bio || PROFILE.bio;
      if(RG2.method === 'email') PROFILE.email = RG2.contact;
      if(RG2.method === 'phone') PROFILE.phone = RG2.contact;
      /* цветовая аватарка */
      const a = rg2AvaPalette()[RG2.avaIdx] || rg2AvaPalette()[0];
      PROFILE.avaBg = a.bg; PROFILE.avaFg = a.fg;
      if(RG2.avaImg) PROFILE.avaImg = RG2.avaImg;
    }
  }catch(e){}
  /* persist */
  try{ localStorage.setItem('oko-rg2', JSON.stringify({
    contact:RG2.contact, method:RG2.method,
    name:RG2.name, nick:RG2.nick, bio:RG2.bio,
    avaIdx:RG2.avaIdx, avaImg:RG2.avaImg ? '1' : '',
    remember: RG2.remember, at: Date.now()
  })); }catch(e){}
  if(RG2.avaImg){ try{ localStorage.setItem('oko-rg2-ava', RG2.avaImg); }catch(e){} }
  /* заранее ставим oko-auth только если «сохранить вход» */
  if(RG2.remember){ try{ localStorage.setItem('oko-auth', RG2.method); }catch(e){} }
  rg2RenderTiers();
  rg2GoTo(4);
}

/* ---------- ШАГ 4: тарифы ---------- */
function rg2Step4HTML(){
  return `
  <section class="rg2-step" id="rg2Step4">
    <h1 class="rg2-h">Твой тариф</h1>
    <p class="rg2-sub">Выбери сейчас — можно менять в любой момент.</p>
    <div class="rg2-period" id="rg2Period">
      ${RG2_PERIODS.map(p=>`
        <button type="button" class="rg2-per ${p.m===1?'on':''}" data-m="${p.m}" onclick="rg2PeriodPick(${p.m})">
          <span>${p.lab}</span>${p.disc?`<i>−${p.disc}%</i>`:''}
        </button>
      `).join('')}
    </div>
    <div class="rg2-tiers" id="rg2Tiers"></div>
    <button class="rg2-btn" id="rg2Next4Btn" onclick="rg2Next4()">Начать пользоваться <svg class="i"><use href="#i-chev"/></svg></button>
    <button type="button" class="rg2-linkbtn" onclick="rg2Skip()">Пропустить — начать с FREE</button>
  </section>`;
}
function rg2Fmt(n){
  return Number(n||0).toLocaleString('ru-RU').replace(/,/g,' ');
}
function rg2PeriodPick(m){
  RG2.period = m;
  document.querySelectorAll('#rg2Period .rg2-per').forEach(b=>{
    b.classList.toggle('on', +b.dataset.m === m);
  });
  rg2RenderTiers();
}
function rg2TierPick(id){
  RG2.tier = id;
  document.querySelectorAll('#rg2Tiers .rg2-tier').forEach(el=>{
    el.classList.toggle('sel', el.dataset.id === id);
  });
  const b = document.getElementById('rg2Next4Btn');
  if(b){
    if(id === 'FREE') b.innerHTML = 'Начать пользоваться <svg class="i"><use href="#i-chev"/></svg>';
    else {
      const per = RG2_PERIODS.find(p=>p.m===RG2.period) || RG2_PERIODS[0];
      const tier = RG2_TIERS.find(t=>t.id===id);
      const total = Math.round(tier.price * per.m * (1 - per.disc/100));
      b.innerHTML = 'Оформить ' + tier.name + ' · ' + rg2Fmt(total) + ' ₽ <svg class="i"><use href="#i-chev"/></svg>';
    }
  }
}
function rg2RenderTiers(){
  const box = document.getElementById('rg2Tiers'); if(!box) return;
  const per = RG2_PERIODS.find(p=>p.m===RG2.period) || RG2_PERIODS[0];
  box.innerHTML = RG2_TIERS.map(t=>{
    const total = Math.round(t.price * per.m * (1 - per.disc/100));
    const priceStr = t.price === 0 ? 'бесплатно'
      : (per.m === 1 ? rg2Fmt(t.price)+' ₽/мес' : rg2Fmt(total)+' ₽ за '+per.lab.toLowerCase());
    return `<button type="button" class="rg2-tier ${t.reco?'reco':''} ${RG2.tier===t.id?'sel':''}" data-id="${t.id}" onclick="rg2TierPick('${t.id}')">
      <div class="rg2-tier-head">
        <div class="rg2-tier-name">${t.name}${t.reco?'<span class="rg2-tier-badge">Рекомендуем</span>':''}</div>
        <div class="rg2-tier-price">${priceStr}</div>
      </div>
      <div class="rg2-tier-line">${t.line}</div>
      <ul class="rg2-tier-feats">
        ${t.feats.map(f=>`<li><svg class="i"><use href="#i-check2"/></svg>${esc(f)}</li>`).join('')}
      </ul>
    </button>`;
  }).join('');
  /* если ни одного не выбрано — подсветить FREE */
  if(!document.querySelector('#rg2Tiers .rg2-tier.sel')){
    RG2.tier = 'FREE';
    const el = document.querySelector('#rg2Tiers .rg2-tier[data-id="FREE"]');
    if(el) el.classList.add('sel');
  }
  rg2TierPick(RG2.tier);
}
function rg2Skip(){ RG2.tier = 'FREE'; rg2Next4(); }
function rg2Next4(){
  /* сохранить тариф */
  try{ if(typeof PROFILE !== 'undefined') PROFILE.tier = RG2.tier; }catch(e){}
  try{
    const r = JSON.parse(localStorage.getItem('oko-rg2')||'{}');
    r.tier = RG2.tier; r.period = RG2.period;
    localStorage.setItem('oko-rg2', JSON.stringify(r));
  }catch(e){}
  /* завершить регистрацию */
  rg2FinishFlow(RG2.tier !== 'FREE');
}

/* ---------- финиш ---------- */
function rg2FinishFlow(openPaySheet){
  /* пометить, чтобы штатный онбординг после doLogin не запустился (у нас свой поток) */
  try{ localStorage.setItem('oko-onboarded','1'); }catch(e){}
  try{ localStorage.setItem('oko-auth', RG2.method); }catch(e){}
  /* спрятать shell + auth-inner, скрыть authScreen */
  rg2Exit();
  const scr = document.getElementById('authScreen');
  if(scr) scr.classList.add('hidden');
  try{ if(typeof stopParticles === 'function') stopParticles(); }catch(e){}
  try{ if(typeof initLive === 'function') initLive(); }catch(e){}
  try{ if(typeof renderMyProfile === 'function') renderMyProfile(); }catch(e){}
  /* приветственный бонус + попап (используем существующие премиум-функции) */
  try{
    if(typeof walletAdd === 'function' && !regPopupsSeen().welcome){
      walletAdd(2500, 'Приветственный бонус');
    }
  }catch(e){}
  if(!regPopupsSeen().welcome){
    regPopupMark('welcome');
    setTimeout(()=>{
      try{
        showPopup({ico:'logo', title: regWelcomeTitle(RG2.name),
          body: regWelcomeBody(RG2.name),
          actions:[
            {label:'В приложение'},
          ]});
      }catch(e){}
    }, 500);
  }
  /* открыть feed */
  try{ if(typeof showTab === 'function') showTab('feed'); }catch(e){}
  /* оплата если не FREE */
  if(openPaySheet){
    setTimeout(()=>{
      try{
        if(typeof openPay === 'function' && typeof PLANS !== 'undefined' && PLANS[RG2.tier]){
          openPay(RG2.tier);
        } else {
          if(typeof toast === 'function') toast('Тариф ' + RG2.tier + ' скоро подключим');
        }
      }catch(e){}
    }, 900);
  }
  regSchedulePopups();
}
function rg2FinishOwner(){
  try{ localStorage.setItem('oko-onboarded','1'); }catch(e){}
  try{ localStorage.setItem('oko-auth','email'); }catch(e){}
  try{
    if(typeof PROFILE !== 'undefined'){ PROFILE.email = RG2.contact; }
  }catch(e){}
  rg2Exit();
  const scr = document.getElementById('authScreen');
  if(scr) scr.classList.add('hidden');
  try{ if(typeof stopParticles === 'function') stopParticles(); }catch(e){}
  try{ if(typeof initLive === 'function') initLive(); }catch(e){}
  try{ if(typeof renderMyProfile === 'function') renderMyProfile(); }catch(e){}
  setTimeout(()=>{
    try{
      showPopup({ico:'crown', title:'Доступ владельца',
        body:'Генеральный директор OKO. Открыт полный доступ: админка, доход платформы, HQ и управление всеми разделами.',
        actions:[{label:'В приложение'}]});
    }catch(e){}
  }, 500);
  regSchedulePopups();
}

/* ---------- one-time bindings (после первой сборки shell) ---------- */
function rg2BindOnce(){
  /* инпуты кода: авто-фокус цепочка, backspace, paste всех 6 */
  document.querySelectorAll('#rg2Code input').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      inp.value = inp.value.replace(/\D/g,'').slice(0,1);
      inp.classList.toggle('fill', !!inp.value);
      rg2Err('rg2Err2','');
      const i = +inp.dataset.i;
      if(inp.value && i < 5) document.querySelector('#rg2Code input[data-i="'+(i+1)+'"]').focus();
      rg2Next2Enable();
      if(rg2CodeVal().length === 6) setTimeout(rg2Next2, 120);
    });
    inp.addEventListener('keydown', e=>{
      const i = +inp.dataset.i;
      if(e.key === 'Backspace' && !inp.value && i > 0){
        const prev = document.querySelector('#rg2Code input[data-i="'+(i-1)+'"]');
        if(prev){ prev.focus(); prev.value=''; prev.classList.remove('fill'); rg2Next2Enable(); }
      }
    });
    inp.addEventListener('paste', e=>{
      const d = (e.clipboardData.getData('text')||'').replace(/\D/g,'').slice(0,6);
      if(d.length < 2) return;
      e.preventDefault();
      document.querySelectorAll('#rg2Code input').forEach((c,j)=>{
        c.value = d[j] || '';
        c.classList.toggle('fill', !!c.value);
      });
      const idx = Math.min(d.length, 5);
      const next = document.querySelector('#rg2Code input[data-i="'+idx+'"]');
      if(next) next.focus();
      rg2Next2Enable();
      if(d.length === 6) setTimeout(rg2Next2, 120);
    });
  });
  /* аватар: file input */
  const file = document.getElementById('rg2AvaFile');
  if(file){
    file.addEventListener('change', e=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      const fr = new FileReader();
      fr.onload = ev => {
        RG2.avaImg = String(ev.target.result || '');
        rg2AvaSync(); rg2AvaRenderSw();
      };
      fr.readAsDataURL(f);
      /* сбросить value чтобы можно было выбрать ту же картинку заново */
      try{ e.target.value = ''; }catch(er){}
    });
  }
  /* пре-рендер свотчей и тарифов */
  rg2AvaRenderSw();
  /* по Enter на step1 — Продолжить */
  ['rg2Contact','rg2Pass','rg2Pass2'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); rg2Next1(); }});
  });
  ['rg2Name','rg2Nick'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); rg2Next3(); }});
  });
}

/* ---------- chain-patch renderMyProfile: показ фото-аватара ---------- */
try{
  if(typeof renderMyProfile === 'function'){
    const _prev = renderMyProfile;
    renderMyProfile = function(){
      _prev.apply(this, arguments);
      try{
        const el = document.getElementById('profAva');
        if(!el || typeof PROFILE === 'undefined') return;
        if(PROFILE.avaImg){
          el.style.backgroundImage = 'url(' + PROFILE.avaImg + ')';
          el.style.backgroundSize = 'cover';
          el.style.backgroundPosition = 'center';
          el.style.color = 'transparent';
        } else if(PROFILE.avaBg){
          el.style.background = PROFILE.avaBg;
          if(PROFILE.avaFg) el.style.color = PROFILE.avaFg;
        }
      }catch(e){}
    };
  }
}catch(e){}

/* восстановить сохранённый аватар из localStorage при загрузке */
try{
  const saved = JSON.parse(localStorage.getItem('oko-rg2') || 'null');
  if(saved){
    if(typeof PROFILE !== 'undefined'){
      if(saved.name) PROFILE.name = saved.name;
      if(saved.nick) PROFILE.nick = saved.nick;
      if(saved.bio)  PROFILE.bio  = saved.bio;
      if(saved.method === 'email') PROFILE.email = saved.contact;
      if(saved.method === 'phone') PROFILE.phone = saved.contact;
      if(saved.tier) PROFILE.tier = saved.tier;
      const a = rg2AvaPalette()[saved.avaIdx] || rg2AvaPalette()[0];
      PROFILE.avaBg = a.bg; PROFILE.avaFg = a.fg;
      if(saved.avaImg){
        const img = localStorage.getItem('oko-rg2-ava');
        if(img) PROFILE.avaImg = img;
      }
    }
  }
}catch(e){}

try{ window.rg2Open = rg2Open; window.rg2Back = rg2Back; }catch(e){}

/* ============================================================
   ГЛОБАЛЬНЫЙ ГЕЙТ на приглашение в Академию (bugfix v1.94).
   Аудит: попап «Академия OKO — начни урок 1» дублировался при
   каждом переключении вкладок. Держим строгий флаг в localStorage
   (`oko-academy-invite-seen`) — показываем максимум ОДИН раз
   за жизнь аккаунта, а не за сессию. Дополнительно давим повторы
   в рамках одной сессии (быстрые re-check по таймеру).
   ============================================================ */
(function regAcademyInviteGate(){
  const K = 'oko-academy-invite-seen';
  const SK = 'oko-academy-invite-shown-session';
  /* распознать «приглашение начать урок 1»: строго по тайтлу + телу */
  function isAcademyInvite(o){
    if(!o) return false;
    const t = String(o.title || '');
    const b = String(o.body || '');
    if(!/Академия\s*OKO/i.test(t)) return false;
    return /Начни\s*урок/i.test(b) || /Продолжи\s*урок/i.test(b);
  }
  function seen(){ try{ return !!localStorage.getItem(K); }catch(e){ return false; } }
  function mark(){
    try{ localStorage.setItem(K, String(Date.now())); }catch(e){}
    try{ sessionStorage.setItem(SK, '1'); }catch(e){}
  }
  /* Chain-патч: перехватываем ЛЮБОЙ вызов showPopup.
     Если это академ-приглашение и мы его уже видели (в этом аккаунте либо в этой
     сессии) — молча гасим. Иначе — помечаем и пропускаем в базовый showPopup. */
  if(typeof showPopup === 'function'){
    const _regPrevShowPopup = showPopup;
    showPopup = function(o){
      if(isAcademyInvite(o)){
        let sessionShown = false;
        try{ sessionShown = !!sessionStorage.getItem(SK); }catch(e){}
        if(seen() || sessionShown) return;      /* уже видели — не показываем */
        mark();
      }
      _regPrevShowPopup(o);
    };
  }
})();

/* ============================================================
   ПРЕМИУМ-ОНБОРДИНГ — брендовая воронка активации.
   Оболочка (#onboard, obShow/obNext/obFinish, ONBOARD, obStep)
   живёт в base.html. Мы доводим её цепочкой: пересобираем данные
   слайдов (ONBOARD) и переопределяем renderOb на богатые сцены.
   Ничего в base.html не редактируем.
   ============================================================ */
const REG_OB = [
  {scene:'brand',   tag:'OKO',              t:'Один глаз на всё',          d:'Мессенджер, лента, биржа, инструменты для роста, академия и заработок в одном приложении. Добро пожаловать в OKO.'},
  {scene:'chat',    tag:'Мессенджер',       t:'Общение без границ',        d:'Личные чаты, группы и каналы в реальном времени. Голосовые, файлы и переводы денег — прямо в переписке.'},
  {scene:'feed',    tag:'Умная лента',      t:'Лента, которая знает тебя',  d:'Настоящие алгоритмы рекомендаций подстраивают ленту под твои интересы, и продвигают твои посты к новой аудитории.'},
  {scene:'market',  tag:'Биржа',            t:'Зарабатывай на навыках',     d:'Услуги и заказы с эскроу-защитой: деньги замораживаются и уходят исполнителю только после результата.'},
  {scene:'ai',      tag:'Инструменты',t:'Команда берёт рутину на себя',    d:'Готовые посты, ролики, картинки и озвучка, специалисты OKO соберут за тебя. Идея превращается в готовый контент.'},
  {scene:'academy', tag:'Академия',         t:'Учись и получай сертификат', d:'Видео-уроки, тесты и практика. За каждый пройденный курс — официальный сертификат OKO с печатью.'},
  {scene:'earn',    tag:'Партнёрка',        t:'Расти вместе с OKO',         d:'Партнёрская программа, рекламный кабинет и контент-завод. Приводи людей и клиентов, доход сразу в приложении.'},
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
  /* реф-параметр в URL — сразу же в localStorage, чтобы welcome его увидел */
  regRefCapture();

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
