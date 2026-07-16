/* ===== PWA: service worker + подсказка установки (Android/десктоп) ===== */
(function pwaInit(){
  if(location.protocol !== 'https:') return; // локальный file:// — пропуск
  if('serviceWorker' in navigator){
    try{ navigator.serviceWorker.register('/sw.js'); }catch(e){}
  }
  let deferred = null;
  window.addEventListener('beforeinstallprompt', ev => {
    ev.preventDefault();
    deferred = ev;
    try{
      if(localStorage.getItem('oko-pwa-hint')) return;
      setTimeout(()=>{
        if(!deferred || typeof showPopup !== 'function') return;
        showPopup({
          ico: 'phone',
          title: 'OKO на главный экран',
          body: 'Установи OKO как приложение: значок на рабочем столе, полный экран, работает быстрее.',
          actions: [
            {label:'Установить', onclick: ()=>{ try{ deferred.prompt(); }catch(e){} deferred = null; }},
            {label:'Позже', ghost:true}
          ]
        });
        try{ localStorage.setItem('oko-pwa-hint','1'); }catch(e){}
      }, 120000);
    }catch(e){}
  });
})();
