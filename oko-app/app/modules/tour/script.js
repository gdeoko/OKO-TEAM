/* ===== TOUR: сторис Даниэля + интерактивный тур (префикс tr-) =====
   Первый заход после регистрации:
     1) STORIES — Instagram-style сторис от Даниэля (5 карточек: продукт,
        тарифы, партнёрка, академия, штаб). Тап по правой половине — вперёд,
        по левой — назад, удержание — пауза, свайп вниз / крест — закрыть.
     2) TOUR — интерактивный тур: спотлайт вокруг реального элемента
        (дыра box-shadow по getBoundingClientRect), карточка с текстом +
        стрелка, точки-прогресс, Далее/Пропустить.
     3) FINAL — попап «Готово! 2 500 ₽ уже на счёте — попробуй продвижение».
   Единый ключ persistent-state: `oko-tour-done` (сохраняем back-compat со
   старым ключом `oko-tour`). Строгий одноразовый гейт: если ключ выставлен,
   ни сторис, ни тур автоматически больше не запускаются. */

const TR_KEY = 'oko-tour-done';
const TR_KEY_LEGACY = 'oko-tour';
const TR_STORIES_KEY = 'oko-stories-seen';

/* ---------- двуязычие тура: EN, когда язык интерфейса английский ---------- */
/* берём язык из i18n-ядра (LANG); helper — на каждый видимый текст тура */
function trT(ru, en){ return (typeof LANG !== 'undefined' && LANG === 'en') ? en : ru; }

/* ---------- 5 сторис Даниэля (первый заход) ---------- */
/* Каждая история двуязычна. Визуал строим сами (без внешних картинок) —
   бренд-градиенты, тонкая грид-сетка, крупная типографика Bebas Neue,
   иконка бренда — только SVG из спрайта (#i-*). */
const TR_STORIES = [
  {key:'product', ico:'logo', tone:'lime',
   tag:{ru:'Продукт', en:'Product'},
   title:{ru:'OKO — экосистема, где всё в одном', en:'OKO — everything in one place'},
   body:{ru:'Мессенджер, лента, биржа, кошелёк, академия и партнёрка. Один аккаунт — целый мир для роста и заработка.',
         en:'Messenger, feed, marketplace, wallet, academy and partner program. One account — a whole ecosystem for growth and income.'},
   meta:{ru:'Даниэль · основатель OKO', en:'Daniel · founder of OKO'}},
  {key:'plans', ico:'crown', tone:'dark',
   tag:{ru:'Тарифы', en:'Plans'},
   title:{ru:'Три плана — под любые задачи', en:'Three plans — for every need'},
   body:{ru:'Free для старта, PRO для роста и BUSINESS для команд. Первые 2 500 ₽ на балансе — тратятся на любые тарифы и продвижение.',
         en:'Free to start, PRO to grow and BUSINESS for teams. First 2,500 ₽ on your balance covers any plan or promotion.'},
   meta:{ru:'Даниэль · тарифы OKO', en:'Daniel · OKO plans'}},
  {key:'partner', ico:'heart', tone:'lime',
   tag:{ru:'Партнёрка', en:'Partners'},
   title:{ru:'Приводи людей — расти вместе', en:'Bring people in — grow together'},
   body:{ru:'До 30% с оплат приглашённых, бессрочно. Промо-материалы, QR, дип-линки и прозрачная история начислений — всё в кабинете.',
         en:'Up to 30% of your invitees’ payments, forever. Promo assets, QR, deep links and a transparent payout log — all in one dashboard.'},
   meta:{ru:'Даниэль · партнёрская программа', en:'Daniel · partner program'}},
  {key:'academy', ico:'star', tone:'dark',
   tag:{ru:'Академия', en:'Academy'},
   title:{ru:'Учись и получай сертификат', en:'Study and get certified'},
   body:{ru:'Полноформатные курсы: видео, слайды, тест и практика. За каждое направление — официальный сертификат OKO с печатью и подписью.',
         en:'Full-format courses: video, slides, tests and practice. Every track ends with an official OKO certificate — stamp and signature included.'},
   meta:{ru:'Даниэль · академия OKO', en:'Daniel · OKO academy'}},
  {key:'hq', ico:'compass', tone:'lime',
   tag:{ru:'Штаб', en:'HQ'},
   title:{ru:'Штаб — твой контроль', en:'HQ — your control room'},
   body:{ru:'Профиль, статистика, темы, конфиденциальность и уведомления. Начни отсюда — и вернись сюда, чтобы включить повтор сторис и тура.',
         en:'Profile, stats, themes, privacy and notifications. Start here — and come back to replay stories or the tour anytime.'},
   meta:{ru:'Даниэль · штаб OKO', en:'Daniel · OKO HQ'}},
];

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

/* --- persistent-state: единый ключ «тур пройден» + back-compat со старым --- */
function trSeen(){
  try{
    if(localStorage.getItem(TR_KEY)) return true;
    /* миграция старого ключа: если пользователь уже видел тур раньше — уважаем */
    if(localStorage.getItem(TR_KEY_LEGACY)){
      try{ localStorage.setItem(TR_KEY, '1'); }catch(e){}
      return true;
    }
    return false;
  }catch(e){ return true; }
}
function trMark(){ try{ localStorage.setItem(TR_KEY, '1'); }catch(e){} }
function trStoriesSeen(){ try{ return !!localStorage.getItem(TR_STORIES_KEY); }catch(e){ return true; } }
function trStoriesMark(){ try{ localStorage.setItem(TR_STORIES_KEY, '1'); }catch(e){} }

/* ============================================================
   INSTAGRAM STORIES: сторис Даниэля (5 карточек, первый заход)
   ============================================================ */
let TS = { open:false, idx:0, timer:null, start:0, dur:5400, pausedAt:0, pausedFor:0, holdT:null,
           touchX:0, touchY:0, touchT:0 };

function trStoriesBuild(){
  if(document.getElementById('trStories')) return;
  const el = document.createElement('div');
  el.id = 'trStories';
  el.setAttribute('role','dialog');
  el.setAttribute('aria-label', trT('Сторис OKO','OKO stories'));
  el.innerHTML = `
    <div class="ts-bars" id="tsBars"></div>
    <div class="ts-head">
      <div class="ts-author">
        <span class="ts-ava"><svg class="i"><use href="#i-logo"/></svg></span>
        <div class="ts-author-b">
          <b>Даниэль</b>
          <small id="tsAuthorSub">${trT('основатель OKO','founder of OKO')}</small>
        </div>
      </div>
      <button class="ts-close" id="tsClose" aria-label="${trT('Закрыть','Close')}" onclick="trStoriesClose()">
        <svg class="i" style="transform:rotate(45deg)"><use href="#i-plus"/></svg>
      </button>
    </div>
    <div class="ts-stage" id="tsStage"></div>
    <div class="ts-nav">
      <button class="ts-hit ts-hit-l" aria-label="${trT('Назад','Previous')}" onclick="trStoriesPrev()"></button>
      <button class="ts-hit ts-hit-r" aria-label="${trT('Дальше','Next')}" onclick="trStoriesNext()"></button>
    </div>
    <div class="ts-cta" id="tsCta">
      <button class="btn" onclick="trStoriesFinish()"><span id="tsCtaLabel">${trT('Пропустить сторис','Skip stories')}</span></button>
    </div>`;
  document.body.appendChild(el);

  /* удержание — пауза (mouse + touch) */
  el.addEventListener('mousedown', trStoriesHoldStart);
  el.addEventListener('mouseup',   trStoriesHoldEnd);
  el.addEventListener('mouseleave',trStoriesHoldEnd);
  el.addEventListener('touchstart', function(e){
    const t = e.touches[0]; if(t){ TS.touchX = t.clientX; TS.touchY = t.clientY; TS.touchT = Date.now(); }
    trStoriesHoldStart();
  }, {passive:true});
  el.addEventListener('touchend', function(e){
    trStoriesHoldEnd();
    const t = e.changedTouches[0]; if(!t) return;
    const dx = t.clientX - TS.touchX, dy = t.clientY - TS.touchY, dt = Date.now() - TS.touchT;
    /* свайп вниз > 90px за 500 мс — закрыть сторис */
    if(dy > 90 && Math.abs(dy) > Math.abs(dx) * 1.2 && dt < 500) trStoriesClose();
  }, {passive:true});
}

function trStoriesStart(cb){
  if(TS.open) return;
  trStoriesBuild();
  TS.open = true; TS.idx = 0; TS.pausedFor = 0; TS.pausedAt = 0;
  TS._onDone = cb || null;
  const ov = document.getElementById('trStories');
  requestAnimationFrame(function(){ ov.classList.add('ts-on'); });
  if(typeof nvPush === 'function')
    nvPush('view:stories', function(){ trStoriesClose(); },
      function(){ if(TS.idx > 0){ trStoriesGo(TS.idx - 1); return true; } return false; });
  trStoriesRenderBars();
  trStoriesGo(0);
}
function trStoriesRenderBars(){
  const bars = document.getElementById('tsBars');
  if(!bars) return;
  bars.innerHTML = TR_STORIES.map((_, i)=>{
    const cls = i < TS.idx ? 'done' : (i === TS.idx ? 'live' : '');
    return `<span class="ts-bar ${cls}"><i></i></span>`;
  }).join('');
}
function trStoriesGo(i){
  if(!TS.open) return;
  if(i < 0){ i = 0; }
  if(i > TR_STORIES.length - 1){ trStoriesFinish(); return; }
  TS.idx = i;
  const s = TR_STORIES[i];
  const stage = document.getElementById('tsStage');
  const authorSub = document.getElementById('tsAuthorSub');
  const ctaLabel = document.getElementById('tsCtaLabel');
  if(!stage) return;
  const isLast = i === TR_STORIES.length - 1;
  const tone = s.tone === 'lime' ? 'lime' : 'dark';
  stage.className = 'ts-stage ts-tone-' + tone;
  stage.innerHTML = `
    <div class="ts-slide" data-i="${i}">
      <div class="ts-grid"></div>
      <div class="ts-halo"></div>
      <div class="ts-ico-big">${typeof I === 'function' ? I(s.ico) : ''}</div>
      <div class="ts-content">
        <span class="ts-tag">${trStepStr(s.tag)}</span>
        <h2 class="ts-title">${trStepStr(s.title)}</h2>
        <p class="ts-text">${trStepStr(s.body)}</p>
      </div>
      <div class="ts-foot"><span class="ts-dot"></span><span class="ts-meta">${trStepStr(s.meta)}</span></div>
    </div>`;
  if(authorSub) authorSub.textContent = trStepStr(s.meta);
  if(ctaLabel) ctaLabel.textContent = isLast
    ? trT('Начать тур по OKO','Start OKO tour')
    : trT('Пропустить сторис','Skip stories');
  trStoriesRenderBars();
  trStoriesTimerStart();
}
function trStoriesTimerStart(){
  trStoriesTimerStop();
  TS.start = Date.now(); TS.pausedFor = 0;
  const bar = document.querySelector('#tsBars .ts-bar.live > i');
  if(bar){ bar.style.transition = 'none'; bar.style.width = '0%';
    /* force reflow, затем плавная заливка по длительности */
    void bar.offsetWidth;
    bar.style.transition = 'width ' + TS.dur + 'ms linear';
    bar.style.width = '100%';
  }
  TS.timer = setTimeout(trStoriesNext, TS.dur);
}
function trStoriesTimerStop(){
  if(TS.timer){ clearTimeout(TS.timer); TS.timer = null; }
}
function trStoriesNext(){ if(TS.idx < TR_STORIES.length - 1) trStoriesGo(TS.idx + 1); else trStoriesFinish(); }
function trStoriesPrev(){ if(TS.idx > 0) trStoriesGo(TS.idx - 1); else trStoriesGo(0); }
function trStoriesHoldStart(){
  if(!TS.open) return;
  /* удержание > 180 мс = пауза (короткий тап = переключение) */
  TS.holdT = setTimeout(function(){
    if(!TS.timer) return;
    TS.pausedAt = Date.now();
    clearTimeout(TS.timer); TS.timer = null;
    const bar = document.querySelector('#tsBars .ts-bar.live > i');
    if(bar){
      const cs = getComputedStyle(bar);
      const w = cs.width;
      bar.style.transition = 'none'; bar.style.width = w;
    }
    const ov = document.getElementById('trStories'); if(ov) ov.classList.add('ts-paused');
  }, 180);
}
function trStoriesHoldEnd(){
  if(TS.holdT){ clearTimeout(TS.holdT); TS.holdT = null; }
  if(!TS.open || TS.timer) return;
  if(!TS.pausedAt) return;
  const ov = document.getElementById('trStories'); if(ov) ov.classList.remove('ts-paused');
  /* продолжить с того же места */
  const elapsed = TS.pausedAt - TS.start;
  const left = Math.max(400, TS.dur - elapsed);
  TS.start = Date.now() - (TS.dur - left);
  TS.pausedAt = 0;
  const bar = document.querySelector('#tsBars .ts-bar.live > i');
  if(bar){
    const cs = getComputedStyle(bar);
    const cur = parseFloat(cs.width) || 0;
    const total = parseFloat(cs.getPropertyValue('width'));
    /* дозаливка bar до 100% за оставшееся время */
    void bar.offsetWidth;
    bar.style.transition = 'width ' + left + 'ms linear';
    bar.style.width = '100%';
  }
  TS.timer = setTimeout(trStoriesNext, left);
}
function trStoriesClose(){
  if(!TS.open) return;
  TS.open = false;
  trStoriesTimerStop();
  const ov = document.getElementById('trStories');
  if(ov){ ov.classList.remove('ts-on'); setTimeout(function(){ ov.remove(); }, 320); }
  if(typeof nvPop === 'function') nvPop('view:stories');
  /* закрыли крестиком / свайпом — сторис считаем показанными, но тур НЕ запускаем */
  trStoriesMark();
  const cb = TS._onDone; TS._onDone = null;
}
function trStoriesFinish(){
  if(!TS.open) return;
  TS.open = false;
  trStoriesTimerStop();
  const ov = document.getElementById('trStories');
  if(ov){ ov.classList.remove('ts-on'); setTimeout(function(){ ov.remove(); }, 320); }
  if(typeof nvPop === 'function') nvPop('view:stories');
  trStoriesMark();
  const cb = TS._onDone; TS._onDone = null;
  /* Дошли до конца — сразу запускаем интерактивный тур */
  if(typeof cb === 'function') setTimeout(cb, 240);
  else setTimeout(function(){ trStart(false); }, 240);
}

/* ---------- DOM оверлея тура ---------- */
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

/* ---------- запуск / завершение тура ---------- */
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

/* ---------- попапы других модулей НЕ перебивают тур/сторис: очередь на потом ---------- */
const trPopupQ = [];
function trFlushQ(){
  if(!trPopupQ.length || trOpen || TS.open) return;
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

/* ---------- шаг тура: вкладка -> ожидание рендера -> спотлайт ---------- */
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
  if(TS.open){
    if(e.key === 'Escape'){ e.preventDefault(); trStoriesClose(); }
    else if(e.key === 'ArrowRight'){ e.preventDefault(); trStoriesNext(); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); trStoriesPrev(); }
    else if(e.key === 'Enter'){ e.preventDefault(); trStoriesFinish(); }
    return;
  }
  if(!trOpen) return;
  if(e.key === 'Escape'){ e.preventDefault(); trSkip(); }
  else if(e.key === 'ArrowRight'){ e.preventDefault(); trNext(); }
  else if(e.key === 'Enter'){ e.preventDefault(); trNext(); }
  else if(e.key === 'ArrowLeft'){ e.preventDefault(); if(trIdx > 0) trGo(trIdx - 1, -1); }
});

/* ---------- авто-старт: сторис + тур, один раз после первого входа ---------- */
function trBusy(){
  const auth = document.getElementById('authScreen');
  const ob = document.getElementById('onboard');
  const reg = document.getElementById('regView');
  return !!(
    (auth && !auth.classList.contains('hidden')) ||
    (ob && !ob.classList.contains('hidden')) ||
    (reg && reg.classList.contains('open')) ||
    document.getElementById('okoPopup') ||
    document.querySelector('.sheet.open') ||
    TS.open);
}
function trMaybeAuto(){
  if(trOpen || TS.open) return;
  if(typeof authed === 'function' && !authed()) return;  /* ждём логина — патчи ниже */
  if(trBusy()){ setTimeout(trMaybeAuto, 2600); return; } /* занято — попробуем позже */
  /* Первым — сторис Даниэля, если ещё не видели */
  if(!trStoriesSeen()){
    setTimeout(function(){
      if(trBusy()) { setTimeout(trMaybeAuto, 2600); return; }
      trStoriesStart(function(){ setTimeout(function(){ trStart(false); }, 220); });
    }, 650);
    return;
  }
  if(trSeen()) return;
  setTimeout(function(){ if(!trSeen() && !trOpen) trStart(false); }, 650);
}

/* ---------- строки в профиле: «Сторис Даниэля» и «Тур по OKO» ---------- */
function trAddRow(){
  try{
    const rows = document.querySelectorAll('#screen-profile .prow');
    let logoutRow = null;
    rows.forEach(r => { if((r.getAttribute('onclick') || '').indexOf('doLogout') > -1) logoutRow = r; });
    if(!logoutRow) return;

    /* «Сторис Даниэля» — повторный запуск */
    if(!document.getElementById('trProwStories')){
      const bs = document.createElement('button');
      bs.className = 'prow'; bs.id = 'trProwStories';
      bs.innerHTML = `${I('play')} <span id="trRowStoriesLabel">${trT('Сторис Даниэля','Daniel’s stories')}</span> <span class="chev">${I('chev')}</span>`;
      bs.onclick = ()=>{ trStoriesStart(null); };
      logoutRow.parentNode.insertBefore(bs, logoutRow);
    }
    /* «Тур по OKO» — повторный запуск */
    if(!document.getElementById('trProwTour')){
      const b = document.createElement('button');
      b.className = 'prow'; b.id = 'trProwTour';
      b.innerHTML = `${I('compass')} <span id="trRowLabel">${trT('Тур по OKO','OKO tour')}</span> <span class="chev">${I('chev')}</span>`;
      b.onclick = ()=>trStart(true);
      logoutRow.parentNode.insertBefore(b, logoutRow);
    }
  }catch(e){}
}

/* ---------- самоинициализация ---------- */
(function trInit(){
  trAddRow();

  /* chain-патч showPopup: во время тура/сторис попапы откладываются (см. trFlushQ) */
  if(typeof showPopup === 'function'){
    const _trPrevShowPopup = showPopup;
    showPopup = function(o){
      if(trOpen || TS.open){ trPopupQ.push(o); return; }
      _trPrevShowPopup(o);
    };
  }

  /* перевод строк профиля (i18n ядра, если доступно) */
  if(typeof regT === 'function' && typeof onLangChange === 'function' && typeof t === 'function'){
    regT({'tr.row': {ru:'Тур по OKO', en:'OKO tour'},
          'tr.stories': {ru:'Сторис Даниэля', en:'Daniel’s stories'}});
    onLangChange(function(){
      const l = document.getElementById('trRowLabel');
      if(l) l.textContent = t('tr.row');
      const ls = document.getElementById('trRowStoriesLabel');
      if(ls) ls.textContent = t('tr.stories');
    });
  }

  /* хук на конец онбординга и на вход — сторис/тур стартуют сразу после них */
  if(typeof obFinish === 'function'){
    const _trPrevObFinish = obFinish;
    obFinish = function(){ _trPrevObFinish(); setTimeout(trMaybeAuto, 900); };
  }
  if(typeof doLogin === 'function'){
    const _trPrevDoLogin = doLogin;
    doLogin = function(m){ _trPrevDoLogin(m); setTimeout(trMaybeAuto, 1400); };
  }

  /* уже залогинен (повторный запуск приложения, сторис/тур ещё не показаны) */
  setTimeout(trMaybeAuto, 1600);
})();
