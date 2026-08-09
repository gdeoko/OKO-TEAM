/* ============================================================================
   OKO — РОДНЫЕ ВОЗМОЖНОСТИ TELEGRAM MINI APP

   Ядро уже делает главное: expand(), выход из fullscreen, цвета хрома,
   disableVerticalSwipes, lockOrientation и все события безопасных зон.
   Здесь — то, чего не хватало, и что в Telegram работает лучше любого
   самодельного аналога:

     1. Подтверждение закрытия, пока идёт важное. Смахнул вниз во время
        записи голосового, звонка или недописанного сообщения — и мини-апп
        просто закрывался, а работа пропадала. Теперь Telegram сначала
        переспросит. Как только занятость кончилась — подтверждение снимается,
        чтобы не мешать обычному выходу.

     2. Родная главная кнопка (MainButton). Telegram рисует её сам, внизу,
        высоким контрастом — люди узнают её и жмут охотнее, чем нарисованную
        нами. Отдаём ей главное действие экрана; второстепенные остаются
        обычными кнопками внутри страницы.

     3. CloudStorage. localStorage живёт на одном устройстве: сменил телефон —
        и профиль, тема, прогресс онбординга начинаются с нуля. Telegram даёт
        облачное хранилище на аккаунт. Синхронизируем то, что не жалко и что
        реально нужно на новом устройстве.

     4. Родной шеринг. Ссылку на канал, объявление или партнёрскую программу
        отправляем через Telegram, а не «скопировано в буфер, теперь найди
        чат сам». Вне Telegram остаётся честный запасной путь.

   Всё под защитой: вне Telegram модуль молчит и ничего не ломает.
   ============================================================================ */
(function(){
  'use strict';
  if(window.__okoTgV1) return;
  window.__okoTgV1 = 1;

  function tg(){
    var t = window.Telegram && window.Telegram.WebApp;
    return (t && t.initData) ? t : null;
  }
  function ver(min){
    var t = tg(); if(!t || !t.version) return false;
    var a = String(t.version).split('.').map(Number), b = String(min).split('.').map(Number);
    for(var i = 0; i < Math.max(a.length, b.length); i++){
      var x = a[i] || 0, y = b[i] || 0;
      if(x !== y) return x > y;
    }
    return true;
  }

  /* ==========================================================================
     1. Подтверждение закрытия, пока идёт важное
     ========================================================================== */
  var confirmOn = false;
  function busy(){
    try{ if(window.okoRecActive && window.okoRecActive()) return true; }catch(e){}
    /* активный звонок */
    try{
      var call = document.getElementById('callOverlay') || document.querySelector('.call-overlay.on, .call-screen.on');
      if(call && getComputedStyle(call).display !== 'none' && !call.hidden) return true;
    }catch(e){}
    /* недописанное сообщение */
    try{
      var inp = document.getElementById('msgInput');
      if(inp && inp.value && inp.value.trim().length > 1) return true;
    }catch(e){}
    /* незакрытая форма с заполненными полями */
    try{
      var form = document.querySelector('.sheet.open form, .ep-open, .okg-ob:not([hidden])');
      if(form && form.querySelector && form.querySelector('input')){
        var filled = [].some.call(form.querySelectorAll('input, textarea'), function(f){
          return f.value && String(f.value).trim().length > 1;
        });
        if(filled) return true;
      }
    }catch(e){}
    return false;
  }
  function syncClosingConfirm(){
    var t = tg(); if(!t) return;
    var want = busy();
    if(want === confirmOn) return;
    confirmOn = want;
    try{
      if(want && t.enableClosingConfirmation) t.enableClosingConfirmation();
      else if(!want && t.disableClosingConfirmation) t.disableClosingConfirmation();
    }catch(e){}
  }

  /* ==========================================================================
     2. Родная главная кнопка
     Приложение не обязано знать про Telegram: зовёт okoMain.show(...),
     а модуль сам решает — рисовать родную кнопку или ничего не делать
     (вне Telegram главная кнопка экрана и так нарисована в вёрстке).
     ========================================================================== */
  var mainHandler = null;
  var Main = {
    show: function(opts){
      var t = tg(); if(!t || !t.MainButton) return false;
      opts = opts || {};
      var mb = t.MainButton;
      try{
        if(mainHandler && mb.offClick) mb.offClick(mainHandler);
        mainHandler = typeof opts.onClick === 'function' ? function(){
          try{ if(window.okoHaptic) window.okoHaptic('impact'); }catch(e){}
          opts.onClick();
        } : null;
        mb.setParams({
          text: String(opts.text || 'Продолжить').slice(0, 64),
          color: opts.color || '#9AFF00',
          text_color: opts.textColor || '#0a0d05',
          is_active: opts.disabled !== true,
          is_visible: true
        });
        if(mainHandler && mb.onClick) mb.onClick(mainHandler);
        if(opts.progress && mb.showProgress) mb.showProgress(false);
        else if(mb.hideProgress) mb.hideProgress();
      }catch(e){ return false; }
      return true;
    },
    progress: function(on){
      var t = tg(); if(!t || !t.MainButton) return;
      try{ on ? t.MainButton.showProgress(false) : t.MainButton.hideProgress(); }catch(e){}
    },
    hide: function(){
      var t = tg(); if(!t || !t.MainButton) return;
      try{
        if(mainHandler && t.MainButton.offClick) t.MainButton.offClick(mainHandler);
        mainHandler = null;
        t.MainButton.hide();
      }catch(e){}
    }
  };

  /* ==========================================================================
     3. CloudStorage — переезд на новое устройство без потерь
     Синхронизируем только то, что человек ожидает увидеть на новом телефоне:
     тему, язык, прогресс онбординга, свои черновики настроек. Переписку,
     медиа и деньги в облако Telegram не кладём — им там не место.
     ========================================================================== */
  var CLOUD_KEYS = [
    'oko-theme', 'oko-lang', 'oko-onboard-done', 'okg-state',
    'oko-first-seen', 'oko-rec-mode', 'oko-tour-done'
  ];
  var CLOUD_BLOB = 'oko-sync-v1';

  function cloudPush(){
    var t = tg(); if(!t || !t.CloudStorage || !ver('6.9')) return;
    var data = {};
    CLOUD_KEYS.forEach(function(k){
      try{ var v = localStorage.getItem(k); if(v !== null) data[k] = v; }catch(e){}
    });
    var s = '';
    try{ s = JSON.stringify(data); }catch(e){ return; }
    /* CloudStorage ограничен 4096 байтами на ключ — не пытаемся впихнуть больше. */
    if(s.length > 4000) return;
    try{ t.CloudStorage.setItem(CLOUD_BLOB, s, function(){}); }catch(e){}
  }
  function cloudPull(cb){
    var t = tg(); if(!t || !t.CloudStorage || !ver('6.9')){ cb && cb(false); return; }
    try{
      t.CloudStorage.getItem(CLOUD_BLOB, function(err, val){
        if(err || !val){ cb && cb(false); return; }
        var data = null;
        try{ data = JSON.parse(val); }catch(e){}
        if(!data || typeof data !== 'object'){ cb && cb(false); return; }
        var restored = 0;
        Object.keys(data).forEach(function(k){
          if(CLOUD_KEYS.indexOf(k) < 0) return;
          try{
            /* Локальное значение главнее: человек уже что-то настроил здесь. */
            if(localStorage.getItem(k) === null){ localStorage.setItem(k, data[k]); restored++; }
          }catch(e){}
        });
        cb && cb(restored > 0);
      });
    }catch(e){ cb && cb(false); }
  }

  /* ==========================================================================
     4. Родной шеринг
     ========================================================================== */
  function share(url, text){
    var t = tg();
    if(t && t.openTelegramLink){
      var link = 'https://t.me/share/url?url=' + encodeURIComponent(url || '') +
                 (text ? '&text=' + encodeURIComponent(text) : '');
      try{ t.openTelegramLink(link); return true; }catch(e){}
    }
    /* Вне Telegram — системный шеринг, а если и его нет, честно копируем. */
    if(navigator.share){
      try{ navigator.share({ url: url, text: text }); return true; }catch(e){}
    }
    try{
      navigator.clipboard && navigator.clipboard.writeText(url);
      if(typeof toast === 'function') toast('Ссылка скопирована — вставь, куда нужно');
      return true;
    }catch(e){}
    return false;
  }
  /* Подменяем общий шеринг приложения, чтобы внутри Telegram он был родным. */
  function hookShare(){
    if(typeof window.okoShare === 'function' && window.okoShare.__okoTg) return;
    var prev = typeof window.okoShare === 'function' ? window.okoShare : null;
    window.okoShare = function(url, text){
      if(share(url, text)) return true;
      return prev ? prev(url, text) : false;
    };
    window.okoShare.__okoTg = 1;
  }

  /* ==========================================================================
     Публичное API и запуск
     ========================================================================== */
  window.okoMain = Main;
  window.okoTgShare = share;
  window.okoCloudPush = cloudPush;
  window.okoInTelegram = function(){ return !!tg(); };

  function init(){
    hookShare();
    if(!tg()) return;

    cloudPull(function(){});
    /* Пишем в облако редко и только когда что-то поменялось локально. */
    var lastBlob = '';
    setInterval(function(){
      var snap = '';
      try{
        snap = CLOUD_KEYS.map(function(k){ try{ return k + '=' + localStorage.getItem(k); }catch(e){ return ''; } }).join('|');
      }catch(e){}
      if(snap && snap !== lastBlob){ lastBlob = snap; cloudPush(); }
    }, 20000);
    window.addEventListener('pagehide', cloudPush);

    /* Занятость меняется от действий человека — этого хватает, таймер не нужен. */
    ['pointerup', 'keyup', 'input', 'change'].forEach(function(ev){
      document.addEventListener(ev, function(){ setTimeout(syncClosingConfirm, 60); }, true);
    });
    setInterval(syncClosingConfirm, 3000);
    syncClosingConfirm();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(init, 0); });
  else setTimeout(init, 0);
})();
