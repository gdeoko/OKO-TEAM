/* ===== TOUR: интерактивный тур по приложению (префикс tr-) =====
   1) авто-старт один раз после первого входа (флаг localStorage 'oko-tour'),
      ручной запуск — строка «Тур по OKO» в профиле;
   2) спотлайт вокруг реального элемента (дыра box-shadow по getBoundingClientRect),
      карточка с текстом + стрелка, точки-прогресс, Далее/Пропустить;
   3) перед шагом — showTab нужной вкладки, ожидание рендера, пересчёт; resize-safe;
   4) финал — попап «Готово! 2 500 ₽ уже на счёте — попробуй продвижение». */

const TR_KEY = 'oko-tour';

/* ---------- двуязычие тура: EN, когда язык интерфейса английский ---------- */
/* берём язык из i18n-ядра (LANG); helper — на каждый видимый текст тура */
function trT(ru, en){ return (typeof LANG !== 'undefined' && LANG === 'en') ? en : ru; }

/* Каждый шаг двуязычен: title/text — {ru,en}. Рендер выбирает язык по LANG. */
const TR_STEPS = [
  {tab:'feed', sel:'nav#tabs', ico:'compass',
   title:{ru:'Нижняя навигация', en:'Bottom navigation'},
   text:{ru:'Пять разделов всегда под рукой: Лента, Чаты, Мини-аппы, Кошелёк и Профиль. Переключайся одним касанием — всё OKO живёт здесь.',
         en:'Five sections always within reach: Feed, Chats, Hub, Wallet and Profile. Switch with a single tap — all of OKO lives here.'},
   pad:4, round:'14px'},
  {tab:'feed', sel:'#screen-feed .feed-tabs', ico:'feed',
   title:{ru:'Лента и алгоритмы', en:'Feed & algorithms'},
   text:{ru:'«Подписки» — посты твоих авторов, «Рекомендации» — умный подбор по интересам. Чем больше реакций ставишь, тем точнее лента подстраивается под тебя.',
         en:'“Following” shows posts from your authors, “For you” is a smart pick by interest. The more you react, the better the feed tunes to you.'},
   pad:6, round:'16px'},
  {tab:'wallet', sel:'#screen-wallet .wal-hero', ico:'money',
   title:{ru:'Кошелёк — баланс на всё', en:'Wallet — one balance for everything'},
   text:{ru:'Один лицевой счёт на всё: тарифы, продвижение, биржа с эскроу-защитой, игры и переводы в чатах. Пополняй картой или криптой, выводи заработанное.',
         en:'One account for it all: plans, promotion, the escrow-protected marketplace, games and chat transfers. Top up by card or crypto, withdraw what you earn.'},
   pad:6, round:'18px', clamp:true},
  {tab:'mini', sel:'#maGrid .svc-grid', ico:'bolt',
   title:{ru:'Мини-аппы', en:'Mini-apps'},
   text:{ru:'Сервисы как приложения — без установки: Академия с сертификатами, Игры, Биржа услуг, реклама и проверка видео. Всё открывается в один тап.',
         en:'Services like apps — no install: Academy with certificates, Games, the services marketplace, ads and video checks. Everything opens in one tap.'},
   pad:6, round:'18px', clamp:true},
  {tab:'feed', sel:'#screen-feed .fab', ico:'plus',
   title:{ru:'Создавай посты', en:'Create posts'},
   text:{ru:'Лаймовая кнопка — новый пост: текст, фото, видео или опрос. Опубликуй и сразу продвинь его за счёт стартового бонуса на счёте.',
         en:'The lime button starts a new post: text, photo, video or poll. Publish and promote it right away with your starter bonus.'},
   pad:8, round:'50%'},
  {tab:'profile', sel:'#screen-profile .profile-top', ico:'user',
   title:{ru:'Профиль и настройки', en:'Profile & settings'},
   text:{ru:'Твоя страница: тариф, статистика и достижения. Ниже — темы, уведомления, конфиденциальность и строка «Тур по OKO», если захочешь повторить подсказки.',
         en:'Your page: plan, stats and achievements. Below — themes, notifications, privacy and the “OKO tour” row if you want to replay these tips.'},
   pad:6, round:'18px'},
];
/* безопасно достать текст шага в текущем языке (совместимо со строкой, если вдруг) */
function trStepStr(v){ return (v && typeof v === 'object') ? trT(v.ru, v.en) : (v || ''); }

let trIdx = 0, trOpen = false, trFirstPlace = true, trRzT = null;

function trSeen(){ try{ return !!localStorage.getItem(TR_KEY); }catch(e){ return true; } }
function trMark(){ try{ localStorage.setItem(TR_KEY, '1'); }catch(e){} }

/* ---------- DOM оверлея ---------- */
function trBuild(){
  if(document.getElementById('trOverlay')) return;
  const el = document.createElement('div');
  el.id = 'trOverlay';
  el.innerHTML = `
    <div class="tr-hole tr-jump" id="trHole"></div>
    <div class="tr-card tr-jump" id="trCard">
      <div class="tr-arr up hide" id="trArr"></div>
      <div class="tr-body" id="trBody"></div>
      <div class="tr-foot">
        <div class="tr-dots" id="trDots"></div>
        <div class="tr-btns">
          <button class="tr-skip" id="trSkip" onclick="trSkip()">${trT('Пропустить','Skip')}</button>
          <button class="btn tr-next" id="trNext" onclick="trNext()">${trT('Далее','Next')}</button>
        </div>
      </div>
    </div>`;
  /* тап по тёмному фону — мягкий намёк на карточку (ничего не закрываем) */
  el.addEventListener('click', e => {
    if(e.target !== el) return;
    const c = document.getElementById('trCard');
    if(c){ c.style.transform = 'translateX(-50%) scale(1.02)'; setTimeout(()=>{ c.style.transform = 'translateX(-50%)'; }, 140); }
  });
  document.body.appendChild(el);
}

/* ---------- запуск / завершение ---------- */
function trStart(manual){
  if(trOpen) return;
  if(!manual && trSeen()) return;
  if(!manual && trBusy()){ setTimeout(trMaybeAuto, 2600); return; }  /* попап успел открыться — позже */
  if(manual && typeof closePopup === 'function') closePopup();       /* ручной запуск — дорогу туру */
  trMark();                       /* «показан один раз» — даже если пропустили */
  trBuild();
  trOpen = true; trFirstPlace = true; trIdx = 0;
  const ov = document.getElementById('trOverlay');
  requestAnimationFrame(()=>ov.classList.add('tr-on'));
  if(typeof nvPush === 'function')
    nvPush('view:tour', function(){ trClose(); },
      function(){ if(trIdx > 0){ trGo(trIdx - 1); return true; } return false; });
  trGo(0);
}
function trClose(){
  if(!trOpen) return;
  trOpen = false;
  const ov = document.getElementById('trOverlay');
  if(ov){ ov.classList.remove('tr-on'); setTimeout(()=>ov.remove(), 340); }
  if(typeof nvPop === 'function') nvPop('view:tour');
  setTimeout(trFlushQ, 600);      /* показать отложенные на время тура попапы */
}

/* ---------- попапы других модулей НЕ перебивают тур: очередь на потом ---------- */
const trPopupQ = [];
function trFlushQ(){
  if(!trPopupQ.length || trOpen) return;
  if(document.getElementById('okoPopup')){ setTimeout(trFlushQ, 4000); return; }
  const o = trPopupQ.shift();
  if(typeof showPopup === 'function') showPopup(o);
  if(trPopupQ.length) setTimeout(trFlushQ, 6000);
}
function trSkip(){ trClose(); if(typeof toast === 'function') toast(trT('Тур можно вернуть: Профиль → «Тур по OKO»','You can reopen the tour: Profile → “OKO tour”')); }
function trNext(){ if(trIdx < TR_STEPS.length - 1) trGo(trIdx + 1); else trFinish(); }
function trFinish(){
  trClose();
  setTimeout(trDonePopup, 380);
}
function trDonePopup(){
  const bal = (typeof WALLET !== 'undefined' && WALLET && typeof fmtMoney === 'function')
    ? trT(` Сейчас на балансе — ${fmtMoney(WALLET.balance)}.`, ` Your balance is now ${fmtMoney(WALLET.balance)}.`) : '';
  if(typeof showPopup !== 'function'){ if(typeof toast === 'function') toast(trT('Тур завершён','Tour complete')); return; }
  showPopup({ico:'rocket', title:trT('Готово!','All set!'),
    body:trT('2 500 ₽ уже на счёте — попробуй продвижение: запусти первую кампанию в рекламном кабинете или продвинь пост из ленты.',
             '2,500 ₽ is already in your account — try promotion: launch your first campaign in Ads Manager or boost a post from the feed.') + bal,
    actions:[
      {label:trT('Попробовать продвижение','Try promotion'), onclick:()=>{
        if(typeof showTab !== 'function') return;
        if(document.getElementById('screen-ads')) showTab('ads'); else showTab('wallet');
      }},
      {label:trT('Позже','Later'), ghost:true},
    ]});
}

/* ---------- шаг: вкладка -> ожидание рендера -> спотлайт ---------- */
function trGo(i, dir){
  if(!trOpen) return;
  if(i < 0){ i = 0; }
  if(i > TR_STEPS.length - 1){ trFinish(); return; }
  trIdx = i; dir = dir || 1;
  const st = TR_STEPS[i];
  try{
    if(st.tab && typeof showTab === 'function'){
      const scr = document.getElementById('screen-' + st.tab);
      if(scr && !scr.classList.contains('active')) showTab(st.tab);
    }
  }catch(e){}
  trSettle(function(){
    if(!trOpen || trIdx !== i) return;
    const el = document.querySelector(st.sel);
    if(!el){ trGo(i + dir, dir); return; }           /* элемента нет — шаг пропускаем */
    /* показать элемент в вьюпорте (если он в скролле экрана) и дождаться докрутки */
    try{ if(el.closest('.screen')) el.scrollIntoView({block:'nearest'}); }catch(e){}
    requestAnimationFrame(function(){ if(trOpen && trIdx === i) trPlace(el, st); });
  });
}
/* двойной rAF + пауза: вкладка успевает отрисоваться и разложиться */
function trSettle(cb){
  requestAnimationFrame(function(){ requestAnimationFrame(function(){ setTimeout(cb, 170); }); });
}

/* ---------- геометрия: дыра + карточка + стрелка ---------- */
function trPlace(el, st){
  const hole = document.getElementById('trHole');
  const card = document.getElementById('trCard');
  const arr  = document.getElementById('trArr');
  if(!hole || !card) return;
  const vw = window.innerWidth, vh = window.innerHeight;
  const r = el.getBoundingClientRect();
  const pad = st.pad != null ? st.pad : 6;
  let x = Math.max(4, r.left - pad), y = Math.max(4, r.top - pad);
  let w = Math.min(r.width + pad * 2, vw - x - 4);
  let h = r.height + pad * 2;
  if(st.clamp && h > vh * 0.5) h = Math.round(vh * 0.5);   /* высокие блоки — режем дыру */
  if(y + h > vh - 4) h = vh - 4 - y;

  hole.style.left = x + 'px';  hole.style.top = y + 'px';
  hole.style.width = w + 'px'; hole.style.height = h + 'px';
  hole.style.borderRadius = st.round || '16px';

  /* контент карточки (анимация появления перезапускается пересозданием .tr-body) */
  const body = document.getElementById('trBody');
  body.style.animation = 'none'; void body.offsetWidth; body.style.animation = '';
  body.innerHTML = `
    <div class="tr-step-chip">${typeof I === 'function' ? I(st.ico) : ''} ${trT('шаг','step')} ${trIdx + 1} ${trT('из','of')} ${TR_STEPS.length}</div>
    <h3>${trStepStr(st.title)}</h3>
    <p>${trStepStr(st.text)}</p>`;
  document.getElementById('trDots').innerHTML = TR_STEPS.map((_, k) =>
    `<span class="${k === trIdx ? 'on' : ''}" onclick="trGo(${k})"></span>`).join('');
  const next = document.getElementById('trNext');
  next.innerHTML = trIdx === TR_STEPS.length - 1
    ? `${trT('Готово','Done')} ${typeof I === 'function' ? I('check2') : ''}`
    : `${trT('Далее','Next')} ${typeof I === 'function' ? I('chev') : ''}`;

  /* вертикаль: под дырой, если не влезает — над, иначе по центру свободной зоны */
  const ch = card.offsetHeight, gap = 16;
  let top, below = y + h + gap + ch < vh - 12;
  const above = y - gap - ch > 12;
  if(below) top = y + h + gap;
  else if(above) top = y - gap - ch;
  else { top = Math.max(12, Math.min(vh - ch - 12, y + h + gap)); below = true; }
  card.style.top = top + 'px';

  /* стрелка — к центру подсвеченного элемента */
  const cw = card.offsetWidth, cardLeft = (vw - cw) / 2;
  const ax = Math.max(18, Math.min(cw - 32, x + w / 2 - cardLeft - 7));
  arr.className = 'tr-arr ' + (below ? 'up' : 'down');
  arr.style.left = ax + 'px';

  if(trFirstPlace){
    /* первый показ — без анимации подлёта из угла */
    requestAnimationFrame(function(){
      hole.classList.remove('tr-jump'); card.classList.remove('tr-jump');
    });
    trFirstPlace = false;
  }
}

/* resize / поворот — пересчёт текущего шага */
window.addEventListener('resize', function(){
  if(!trOpen) return;
  clearTimeout(trRzT);
  trRzT = setTimeout(function(){ if(trOpen) trGo(trIdx); }, 140);
});

/* клавиатура (десктоп): Esc — пропустить, ←/→ — навигация, Enter — далее */
document.addEventListener('keydown', function(e){
  if(!trOpen) return;
  if(e.key === 'Escape'){ e.preventDefault(); trSkip(); }
  else if(e.key === 'ArrowRight'){ e.preventDefault(); trNext(); }
  else if(e.key === 'Enter'){ e.preventDefault(); trNext(); }
  else if(e.key === 'ArrowLeft'){ e.preventDefault(); if(trIdx > 0) trGo(trIdx - 1, -1); }
});

/* ---------- авто-старт: один раз после первого входа ---------- */
function trBusy(){
  const auth = document.getElementById('authScreen');
  const ob = document.getElementById('onboard');
  const reg = document.getElementById('regView');
  return !!(
    (auth && !auth.classList.contains('hidden')) ||
    (ob && !ob.classList.contains('hidden')) ||
    (reg && reg.classList.contains('open')) ||
    document.getElementById('okoPopup') ||
    document.querySelector('.sheet.open'));
}
function trMaybeAuto(){
  if(trSeen() || trOpen) return;
  if(typeof authed === 'function' && !authed()) return;  /* ждём логина — патчи ниже */
  if(trBusy()){ setTimeout(trMaybeAuto, 2600); return; } /* занято — попробуем позже */
  setTimeout(function(){ if(!trSeen() && !trOpen) trStart(false); }, 650);
}

/* ---------- строка «Тур по OKO» в профиле (JS-ом, перед «Выйти») ---------- */
function trAddRow(){
  try{
    const rows = document.querySelectorAll('#screen-profile .prow');
    let logoutRow = null;
    rows.forEach(r => { if((r.getAttribute('onclick') || '').indexOf('doLogout') > -1) logoutRow = r; });
    if(!logoutRow || document.getElementById('trProwTour')) return;
    const b = document.createElement('button');
    b.className = 'prow'; b.id = 'trProwTour';
    b.innerHTML = `${I('compass')} <span id="trRowLabel">${trT('Тур по OKO','OKO tour')}</span> <span class="chev">${I('chev')}</span>`;
    b.onclick = ()=>trStart(true);
    logoutRow.parentNode.insertBefore(b, logoutRow);
  }catch(e){}
}

/* ---------- самоинициализация ---------- */
(function trInit(){
  trAddRow();

  /* chain-патч showPopup: во время тура попапы откладываются (см. trFlushQ) */
  if(typeof showPopup === 'function'){
    const _trPrevShowPopup = showPopup;
    showPopup = function(o){
      if(trOpen){ trPopupQ.push(o); return; }
      _trPrevShowPopup(o);
    };
  }

  /* перевод строки профиля (i18n ядра, если доступно) */
  if(typeof regT === 'function' && typeof onLangChange === 'function' && typeof t === 'function'){
    regT({'tr.row': {ru:'Тур по OKO', en:'OKO tour'}});
    onLangChange(function(){
      const l = document.getElementById('trRowLabel');
      if(l) l.textContent = t('tr.row');
    });
  }

  /* хук на конец онбординга и на вход — тур стартует сразу после них */
  if(typeof obFinish === 'function'){
    const _trPrevObFinish = obFinish;
    obFinish = function(){ _trPrevObFinish(); setTimeout(trMaybeAuto, 900); };
  }
  if(typeof doLogin === 'function'){
    const _trPrevDoLogin = doLogin;
    doLogin = function(m){ _trPrevDoLogin(m); setTimeout(trMaybeAuto, 1400); };
  }

  /* уже залогинен (повторный запуск приложения, тур ещё не показан) */
  setTimeout(trMaybeAuto, 1600);
})();
