/* ===== TG-WEBAPP: интеграция с Telegram Mini App (@okoappbot) =====
   Скрипт telegram-web-app.js подгружается динамически и опционально:
   вне Telegram (или офлайн) приложение работает как обычно. */
(function tgWebAppInit(){
  function apply(){
    const tg = window.Telegram && window.Telegram.WebApp;
    if(!tg || !tg.initData) return; // не в Telegram
    try{
      tg.ready();
      tg.expand();
      if(tg.setHeaderColor) tg.setHeaderColor('#000000');
      if(tg.setBackgroundColor) tg.setBackgroundColor('#000000');
      if(tg.disableVerticalSwipes) tg.disableVerticalSwipes();
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
