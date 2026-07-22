/* ===== TG-WEBAPP: интеграция с Telegram Mini App (@okoappbot) =====
   Скрипт telegram-web-app.js подгружается динамически и опционально:
   вне Telegram (или офлайн) приложение работает как обычно.
   Режим: FULLSCREEN (Bot API 8.0) + учёт safe-area, чтобы шапка
   не уезжала под статус-бар телефона. */
(function tgWebAppInit(){
  /* СИНХРОНИЗАЦИЯ ВЫСОТЫ: убирает «пустоту» при скролле — высота приложения
     жёстко равна видимой области (visualViewport), а не 100dvh, который
     в Telegram-фуллскрине может считаться неверно. Работает и вне Telegram. */
  let _okoLastH = 0, _okoVhRaf = 0, _okoResizeOff = 0;
  function _okoApplyVh(){
    _okoVhRaf = 0;
    try{
      const h = Math.round((window.visualViewport && window.visualViewport.height) || window.innerHeight);
      if(!h || h === _okoLastH) return;   // не трогаем DOM, если высота не изменилась — убирает лишние reflow/моргание
      _okoLastH = h;
      document.documentElement.style.height = h + 'px';
      document.body.style.height = h + 'px';
      const app = document.getElementById('app');
      if(app) app.style.height = h + 'px';
    }catch(e){}
  }
  /* rAF-троттлинг: при открытии клавиатуры visualViewport шлёт десятки resize/сек —
     раньше каждый писал высоту в 3 элемента => лаг/дёрганье. Теперь один пересчёт за кадр.
     На время всплеска ресайза ставим декоративные анимации на паузу (класс перф-слоя). */
  function okoSyncVh(){
    try{
      const root = document.documentElement;
      if(root && !root.classList.contains('oko-scrolling')) root.classList.add('oko-scrolling');
      if(_okoResizeOff) clearTimeout(_okoResizeOff);
      _okoResizeOff = setTimeout(function(){ _okoResizeOff = 0; try{ document.documentElement.classList.remove('oko-scrolling'); }catch(e){} }, 180);
    }catch(e){}
    if(_okoVhRaf) return;
    _okoVhRaf = (window.requestAnimationFrame || window.setTimeout)(_okoApplyVh, 16);
  }
  window.addEventListener('resize', okoSyncVh);
  window.addEventListener('orientationchange', ()=>setTimeout(okoSyncVh, 120));
  if(window.visualViewport) window.visualViewport.addEventListener('resize', okoSyncVh);
  _okoApplyVh();
  setTimeout(_okoApplyVh, 400); setTimeout(_okoApplyVh, 1500);

  function applySafeArea(tg){
    try{
      const sa = tg.safeAreaInset || {top:0,bottom:0,left:0,right:0};
      const ca = tg.contentSafeAreaInset || {top:0,bottom:0,left:0,right:0};
      const top = (sa.top||0) + (ca.top||0);
      const bottom = Math.max(sa.bottom||0, 0);
      const app = document.getElementById('app');
      if(app){
        app.style.paddingTop = top + 'px';
        /* НИЖНИЙ safe-area НЕ пихаем в #app — иначе его паддинг показывает #000
           между composer/nav (--surface) и нижним баром Telegram => «тень снизу».
           Отдаём инсет в CSS-переменную, а её используют nav и composer (оба --surface),
           так низ становится сплошным --surface до самого бара Telegram. */
        app.style.paddingBottom = '0px';
      }
      try{ document.documentElement.style.setProperty('--oko-safe-bottom', bottom + 'px'); }catch(_){}
      ['authScreen','onboard','splash'].forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.style.paddingTop = top + 'px';
      });
    }catch(e){}
  }
  /* цвета Telegram-хрома (шапка, фон, нижний бар/home-indicator) — строго под тему приложения,
     чтобы в светлой теме снизу/сверху НЕ было чёрных полос («тёмная тень снизу»). */
  function okoTgColors(tg){
    try{
      const light = document.documentElement.getAttribute('data-theme') === 'light';
      /* ТОЧНОЕ соответствие CSS-токенам (иначе шов/«тень» сверху и снизу):
         dark  --bg:#000  --surface:#0d0d0d ; light --bg:#fff --surface:#f7f9f4.
         Хедер и общий фон = --bg (шапка приложения лежит на --bg);
         нижний бар = --surface (на вкладках это nav, в чате — композер, оба --surface). */
      const surf = light ? '#f7f9f4' : '#0d0d0d';
      const bg   = light ? '#ffffff' : '#000000';
      if(tg.setHeaderColor) tg.setHeaderColor(bg);
      if(tg.setBackgroundColor) tg.setBackgroundColor(bg);
      if(tg.setBottomBarColor){ try{ tg.setBottomBarColor(surf); }catch(e){} }
    }catch(e){}
  }
  /* перекрашивать хром Telegram при переключении темы в приложении */
  try{
    new MutationObserver(()=>{
      const tg = window.Telegram && window.Telegram.WebApp;
      if(tg && tg.initData) okoTgColors(tg);
    }).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
  }catch(e){}
  function apply(){
    const tg = window.Telegram && window.Telegram.WebApp;
    if(!tg || !tg.initData) return; // не в Telegram
    try{
      tg.ready();
      tg.expand();
      if(tg.requestFullscreen){ try{ tg.requestFullscreen(); }catch(e){} }
      okoTgColors(tg);  // цвета Telegram-хрома под тему приложения (иначе в светлой теме снизу чёрная полоса)
      if(tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if(tg.lockOrientation){ try{ tg.lockOrientation('portrait'); }catch(e){} }
      applySafeArea(tg);
      if(tg.onEvent){
        tg.onEvent('viewportChanged', okoSyncVh);
        tg.onEvent('safeAreaChanged', ()=>{applySafeArea(tg); okoSyncVh();});
        tg.onEvent('contentSafeAreaChanged', ()=>{applySafeArea(tg); okoSyncVh();});
        tg.onEvent('fullscreenChanged', ()=>{applySafeArea(tg); okoSyncVh();});
      }
      const u = tg.initDataUnsafe && tg.initDataUnsafe.user;
      if(u && u.first_name){
        PROFILE.name = u.first_name + (u.last_name ? ' ' + u.last_name : '');
        if(u.username) PROFILE.nick = u.username;
        try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
        const auth = document.getElementById('authScreen');
        if(auth) auth.style.display = 'none';
        if(typeof renderMyProfile === 'function') renderMyProfile();
      }
    }catch(e){}
  }
  const s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.onload = apply;
  s.onerror = function(){}; // офлайн/вне TG — молча
  document.head.appendChild(s);
})();
