/* ===== TG-WEBAPP: интеграция с Telegram Mini App (@okoappbot) =====
   Скрипт telegram-web-app.js подгружается динамически и опционально:
   вне Telegram (или офлайн) приложение работает как обычно.
   Режим: FULLSCREEN (Bot API 8.0) + учёт safe-area, чтобы шапка
   не уезжала под статус-бар телефона. */
(function tgWebAppInit(){
  function applySafeArea(tg){
    try{
      const sa = tg.safeAreaInset || {top:0,bottom:0,left:0,right:0};
      const ca = tg.contentSafeAreaInset || {top:0,bottom:0,left:0,right:0};
      const top = (sa.top||0) + (ca.top||0);
      const bottom = Math.max(sa.bottom||0, 0);
      const app = document.getElementById('app');
      if(app){
        app.style.paddingTop = top + 'px';
        app.style.paddingBottom = bottom + 'px';
      }
      ['authScreen','onboard','splash'].forEach(id=>{
        const el = document.getElementById(id);
        if(el) el.style.paddingTop = top + 'px';
      });
    }catch(e){}
  }
  function apply(){
    const tg = window.Telegram && window.Telegram.WebApp;
    if(!tg || !tg.initData) return; // не в Telegram
    try{
      tg.ready();
      tg.expand();
      if(tg.requestFullscreen){ try{ tg.requestFullscreen(); }catch(e){} }
      if(tg.setHeaderColor) tg.setHeaderColor('#000000');
      if(tg.setBackgroundColor) tg.setBackgroundColor('#000000');
      if(tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if(tg.lockOrientation){ try{ tg.lockOrientation('portrait'); }catch(e){} }
      applySafeArea(tg);
      if(tg.onEvent){
        tg.onEvent('safeAreaChanged', ()=>applySafeArea(tg));
        tg.onEvent('contentSafeAreaChanged', ()=>applySafeArea(tg));
        tg.onEvent('fullscreenChanged', ()=>applySafeArea(tg));
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
