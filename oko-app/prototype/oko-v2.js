/* ============================================================================
   OKO · СЛОЙ ПОЛИРОВКИ v2 (JS)
   Грузится ПОСЛЕ app.js. Только аддитивные модули — ядро не переписываем,
   а оборачиваем и дополняем. Каждый модуль изолирован в IIFE и падает молча,
   чтобы одна ошибка не роняла приложение.

   Модули:
     v2-nav       нижнее меню: без прыжков, память скролла по вкладкам
     v2-dismiss   универсальное закрытие оверлеев: тап вне, Escape, свайп вниз
     v2-back      кнопка «назад» есть везде, ничего не остаётся тупиком
     v2-tg        мост к Telegram: BackButton, haptics, тема
   ============================================================================ */
(function okoV2(){
'use strict';

var log = function(){};   /* включить при отладке: console.log.bind(console,'[oko-v2]') */

/* ---------------------------------------------------------------------------
   МОДУЛЬ v2-nav · НИЖНЕЕ МЕНЮ
   Симптомы у Даниэля: «при клике везде обновляет страницу, меняет позицию,
   прыгает, поднимается, дёргается».
   Причины и что делаем:
     1. Скролл экрана не запоминался — возврат на вкладку показывал верх
        страницы, и это читалось как перезагрузка. -> запоминаем скролл.
     2. Открытая клавиатура при переключении вкладки меняла visualViewport,
        а высота #app пересчитывалась -> бар подпрыгивал. -> снимаем фокус
        с поля ДО переключения.
     3. Активная иконка масштабировалась (scale 1.1) и толкала подпись,
        высота бара «дышала». -> геометрия зафиксирована в oko-v2.css.
   --------------------------------------------------------------------------- */
(function v2nav(){
  try{
    var main = document.querySelector('main');
    if(!main) return;

    var scrollByTab = Object.create(null);
    var currentTab  = 'feed';

    function activeTab(){
      var b = document.querySelector('#tabs > button.active');
      return (b && b.dataset && b.dataset.t) || currentTab;
    }

    /* Оборачиваем ядровой showTab, не заменяя его. */
    var coreShowTab = window.showTab;
    if(typeof coreShowTab !== 'function') return;

    window.showTab = function(t){
      try{
        /* 1. Клавиатура: убираем фокус, иначе visualViewport дёрнет высоту
              ровно в момент смены экрана и бар «прыгнет». */
        var ae = document.activeElement;
        if(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)){
          try{ ae.blur(); }catch(e){}
        }
        /* 2. Запоминаем, где человек остановился на текущей вкладке. */
        scrollByTab[activeTab()] = main.scrollTop;
      }catch(e){}

      var r = coreShowTab.apply(this, arguments);

      try{
        currentTab = t;
        /* 3. Возвращаем скролл там, где человек был. Двойной rAF — чтобы
              новый экран успел получить размеры до записи scrollTop. */
        var y = scrollByTab[t];
        var apply = function(){ try{ main.scrollTop = (y == null ? 0 : y); }catch(e){} };
        requestAnimationFrame(function(){ requestAnimationFrame(apply); });
        /* 4. Тактильный отклик как в нативных приложениях. */
        okoHaptic('selection');
      }catch(e){}
      return r;
    };

    /* Повторный тап по активной вкладке = прокрутка наверх (поведение Telegram) */
    document.addEventListener('click', function(ev){
      var btn = ev.target && ev.target.closest && ev.target.closest('#tabs > button');
      if(!btn) return;
      if(!btn.classList.contains('active')) return;
      try{
        if(main.scrollTop > 4){
          main.scrollTo({ top: 0, behavior: 'smooth' });
          scrollByTab[activeTab()] = 0;
          okoHaptic('impact');
        }
      }catch(e){}
    }, true);

    log('nav ok');
  }catch(e){}
})();

/* ---------------------------------------------------------------------------
   МОДУЛЬ v2-dismiss · УНИВЕРСАЛЬНОЕ ЗАКРЫТИЕ
   Симптом: «в чатах нажимаю на сообщение, выходит плашка где закрепить —
   и оттуда как выйти? По идее нажать в пустое место. И подобных багов куча».
   Делаем один общий механизм на всё приложение:
     • тап по затемнению (вне карточки) закрывает
     • Escape закрывает верхний слой
     • системная кнопка «назад» закрывает верхний слой, а не выходит из приложения
   --------------------------------------------------------------------------- */
(function v2dismiss(){
  try{
    /* Реестр закрываемых слоёв: селектор контейнера -> как закрыть.
       Порядок важен: первым идёт то, что лежит выше по z-index. */
    var LAYERS = [
      { sel: '#msgMenu.open',                close: function(){ callIf('closeMsgMenu'); },  card: '.mm-card, .mm-wrap, .mm-actions, #mmActions, #mmReacts, #mmPreview' },
      { sel: '#sheetOverlay.open',           close: function(){ callIf('closeSheet'); },    card: '.sheet' },
      { sel: '.sheet.open',                  close: function(){ callIf('closeSheet'); },    card: '.sheet' },
      { sel: '#stickerPanel.open',           close: function(){ callIf('closeStickers'); }, card: '#stickerPanel' },
      { sel: '.oko-popover.open',            close: function(){ closeAllPopovers(); },      card: '.oko-popover' }
    ];

    function callIf(name){
      try{ if(typeof window[name] === 'function'){ window[name](); return true; } }catch(e){}
      return false;
    }
    function closeAllPopovers(){
      try{
        document.querySelectorAll('.oko-popover.open').forEach(function(p){ p.classList.remove('open'); });
      }catch(e){}
    }

    /* Верхний открытый слой (тот, который должен закрыться первым) */
    function topLayer(){
      for(var i = 0; i < LAYERS.length; i++){
        var el = document.querySelector(LAYERS[i].sel);
        if(el) return { el: el, def: LAYERS[i] };
      }
      return null;
    }

    /* 1. ТАП ВНЕ КАРТОЧКИ.
       Слушаем pointerdown в фазе всплытия: если точка касания не внутри
       содержательной карточки слоя — закрываем. Именно pointerdown, а не click:
       на мобильных click иногда «съедается» скроллом и меню зависало. */
    document.addEventListener('pointerdown', function(ev){
      var top = topLayer();
      if(!top) return;
      var t = ev.target;
      if(!t || !t.closest) return;
      /* нажали по кнопке действия или внутри карточки — не мешаем */
      if(top.def.card && t.closest(top.def.card)) return;
      /* нажали по самой подложке слоя — закрываем */
      if(t === top.el || top.el.contains(t)){
        top.def.close();
        okoHaptic('impact');
      }
    }, false);

    /* 2. ESCAPE — закрывает верхний слой (десктоп) */
    document.addEventListener('keydown', function(ev){
      if(ev.key !== 'Escape' && ev.key !== 'Esc') return;
      var top = topLayer();
      if(!top) return;
      ev.preventDefault();
      ev.stopPropagation();
      top.def.close();
    }, true);

    /* 3. Экспортируем наружу — пригодится другим модулям и кнопке «назад» */
    window.okoCloseTopLayer = function(){
      var top = topLayer();
      if(!top) return false;
      top.def.close();
      return true;
    };
    window.okoHasOpenLayer = function(){ return !!topLayer(); };

    log('dismiss ok');
  }catch(e){}
})();

/* ---------------------------------------------------------------------------
   МОДУЛЬ v2-back · НИГДЕ НЕ ОСТАЁМСЯ В ТУПИКЕ
   Симптом: «много страниц без кнопок назад и много разделов не понятно как выйти».
   Что делаем:
     • системная/аппаратная «назад» сначала закрывает верхний слой;
     • Telegram BackButton показывается всегда, когда открыт хоть один слой
       или подстраница, и прячется на корневых вкладках;
     • свайп от левого края = назад (как в iOS).
   --------------------------------------------------------------------------- */
(function v2back(){
  try{
    /* Есть ли сейчас что-то, откуда нужно уметь выйти */
    function inSubview(){
      try{
        if(window.okoHasOpenLayer && window.okoHasOpenLayer()) return true;
        var subs = ['#searchView','#notifsView','#adminView','#systemView','#regView',
                    '#legalView','#profileEditor','#storyViewer','#hqEmbed','#callScreen'];
        for(var i = 0; i < subs.length; i++){
          var el = document.querySelector(subs[i]);
          if(el && isVisible(el)) return true;
        }
        var app = document.getElementById('app');
        if(app && app.classList.contains('conv-open')) return true;  /* открыт диалог */
      }catch(e){}
      return false;
    }
    function isVisible(el){
      try{
        if(el.classList.contains('open') || el.classList.contains('show')) return true;
        var cs = getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
      }catch(e){ return false; }
    }

    /* Универсальный «назад»: сначала слой, потом подстраница, потом вкладка */
    window.okoGoBack = function(){
      if(window.okoCloseTopLayer && window.okoCloseTopLayer()) return true;
      /* закрываем открытые подстраницы известными функциями ядра */
      var closers = ['closeSearch','closeNotifs','closeAdmin','closeSystemView',
                     'closeProfileEditor','closeStory','endCall','closeConv'];
      for(var i = 0; i < closers.length; i++){
        try{
          var fn = window[closers[i]];
          if(typeof fn !== 'function') continue;
          var id = ({ closeSearch:'#searchView', closeNotifs:'#notifsView', closeAdmin:'#adminView',
                      closeSystemView:'#systemView', closeStory:'#storyViewer',
                      closeProfileEditor:'#profileEditor', endCall:'#callScreen' })[closers[i]];
          if(id){
            var el = document.querySelector(id);
            if(el && isVisible(el)){ fn(); return true; }
          } else if(closers[i] === 'closeConv'){
            var app = document.getElementById('app');
            if(app && app.classList.contains('conv-open')){ fn(); return true; }
          }
        }catch(e){}
      }
      return false;
    };

    /* Telegram BackButton — держим в актуальном состоянии */
    function syncTgBack(){
      try{
        var tg = window.Telegram && window.Telegram.WebApp;
        if(!tg || !tg.BackButton) return;
        if(inSubview()) tg.BackButton.show(); else tg.BackButton.hide();
      }catch(e){}
    }
    try{
      var tg = window.Telegram && window.Telegram.WebApp;
      if(tg && tg.BackButton && tg.onEvent){
        tg.onEvent('backButtonClicked', function(){
          if(!window.okoGoBack()) { try{ tg.BackButton.hide(); }catch(e){} }
          syncTgBack();
        });
      }
    }catch(e){}

    /* Наблюдаем за DOM — состояние кнопки всегда соответствует экрану */
    try{
      var mo = new MutationObserver(function(){ syncTgBack(); });
      mo.observe(document.documentElement, { attributes:true, subtree:true, attributeFilter:['class','style'] });
    }catch(e){}
    setInterval(syncTgBack, 900);
    syncTgBack();

    /* Свайп от левого края = назад */
    try{
      var sx = 0, sy = 0, tracking = false;
      document.addEventListener('touchstart', function(ev){
        if(!ev.touches || ev.touches.length !== 1) return;
        var t = ev.touches[0];
        tracking = t.clientX <= 26;
        sx = t.clientX; sy = t.clientY;
      }, { passive:true });
      document.addEventListener('touchend', function(ev){
        if(!tracking) return;
        tracking = false;
        var t = ev.changedTouches && ev.changedTouches[0];
        if(!t) return;
        if(t.clientX - sx > 70 && Math.abs(t.clientY - sy) < 60){
          if(window.okoGoBack()) okoHaptic('impact');
        }
      }, { passive:true });
    }catch(e){}

    log('back ok');
  }catch(e){}
})();

/* ---------------------------------------------------------------------------
   МОДУЛЬ v2-eye3d · ЖИВОЙ 3D-ЗНАК НА ЗАПУСКЕ И ВХОДЕ
   Правка Даниэля: «на стартовом окне регистрации убрать ужасное свечение и
   поставить лого 3d glb из нашего КП okoteam.top/kp, и на запуске тоже —
   со всем визуалом, свечением и функционалом».

   Как устроено, чтобы запуск оставался быстрым:
     1. Splash показывает плоский знак МГНОВЕННО — ждать three.js не нужно.
     2. Параллельно лениво подтягивается модуль 3D (three.js кэшируется SW).
     3. Как только первый кадр готов — плоский знак плавно уступает живому 3D.
     4. Если WebGL недоступен, модуль не загрузился или это режим экономии
        трафика — остаётся плоский знак. Экран запуска не ломается никогда.
   --------------------------------------------------------------------------- */
(function v2eye3d(){
  try{
    /* Экономия трафика / очень слабая сеть — 3D не тянем */
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if(conn && (conn.saveData === true || /^(slow-2g|2g)$/.test(conn.effectiveType || ''))) return;
    /* Нет WebGL — нет смысла */
    if(!hasWebGL()) return;
    /* Уважаем «уменьшить движение» */
    if(matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var modPromise = null;
    function loadMod(){
      if(!modPromise) modPromise = import('./oko-eye3d.js');
      return modPromise;
    }

    var mounted = { splash:null, auth:null };

    /* --- Экран запуска --- */
    function mountSplash(){
      var splash = document.getElementById('splash');
      if(!splash || splash.classList.contains('gone')) return;
      var wrap = splash.querySelector('.eye-wrap');
      if(!wrap || wrap.dataset.oko3d) return;
      wrap.dataset.oko3d = '1';

      var host = document.createElement('div');
      host.className = 'oko-eye3d-host';
      wrap.appendChild(host);

      loadMod().then(function(m){
        return m.mountEye(host, {
          spin: 0.22,
          parallax: 0.8,
          onReady: function(){ wrap.classList.add('oko-3d-on'); }
        });
      }).then(function(h){ mounted.splash = h; }).catch(function(){});
    }

    /* --- Экран входа / регистрации --- */
    function mountAuth(){
      var scr = document.getElementById('authScreen');
      if(!scr) return;
      var wrap = scr.querySelector('.auth-logo-wrap');
      if(!wrap || wrap.dataset.oko3d) return;
      wrap.dataset.oko3d = '1';

      var host = document.createElement('div');
      host.className = 'oko-eye3d-host';
      wrap.appendChild(host);

      loadMod().then(function(m){
        return m.mountEye(host, {
          spin: 0.16,
          parallax: 1,
          onReady: function(){ wrap.classList.add('oko-3d-on'); }
        });
      }).then(function(h){ mounted.auth = h; }).catch(function(){});
    }

    /* Экран запуска — сразу. Вход — как только он появится на экране. */
    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', mountSplash);
    } else {
      mountSplash();
    }

    /* Вход показывается не сразу (сначала splash) — ловим момент появления */
    function watchAuth(){
      var scr = document.getElementById('authScreen');
      if(!scr) return;
      var visible = !scr.classList.contains('hidden') && getComputedStyle(scr).display !== 'none';
      if(visible) mountAuth();
    }
    watchAuth();
    try{
      var mo = new MutationObserver(watchAuth);
      var scr0 = document.getElementById('authScreen');
      if(scr0) mo.observe(scr0, { attributes:true, attributeFilter:['class','style'] });
    }catch(e){}
    [400, 1200, 2600, 5000].forEach(function(d){ setTimeout(watchAuth, d); });

    /* Когда вход скрыт (человек вошёл) — освобождаем GPU */
    setInterval(function(){
      try{
        var scr = document.getElementById('authScreen');
        if(!scr || !mounted.auth) return;
        var hidden = scr.classList.contains('hidden') || getComputedStyle(scr).display === 'none';
        if(hidden){ mounted.auth.dispose(); mounted.auth = null; }
      }catch(e){}
    }, 3000);

    /* Splash уходит — снимаем сцену */
    try{
      var sp = document.getElementById('splash');
      if(sp){
        new MutationObserver(function(){
          if(sp.classList.contains('gone') && mounted.splash){
            setTimeout(function(){ try{ mounted.splash.dispose(); mounted.splash = null; }catch(e){} }, 800);
          }
        }).observe(sp, { attributes:true, attributeFilter:['class'] });
      }
    }catch(e){}

    function hasWebGL(){
      try{
        var c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext &&
                  (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')));
      }catch(e){ return false; }
    }

    log('eye3d ok');
  }catch(e){}
})();

/* ---------------------------------------------------------------------------
   МОДУЛЬ v2-feed · ШАПКА ЛЕНТЫ И БЕСКОНЕЧНАЯ ПРОКРУТКА
   Правка Даниэля: «в главной по умолчанию стоит лента рекомендаций. Верхнее меню
   по порядку: рекомендации, подписки, иконка клипы и иконка обновить, в одну
   строку без обрезаний и переносов. И ещё лента она бесконечная должна быть
   по кругу по началу, а так рекомендации должны быть».
   --------------------------------------------------------------------------- */
(function v2feed(){
  try{
    /* --- Иконка «Клипы»: открыть Reels-плеер --- */
    window.okoOpenClips = function(){
      okoHaptic('impact');
      try{
        if(typeof faReelsOpenFirst === 'function'){ faReelsOpenFirst(); return; }
      }catch(e){}
      try{ if(typeof toast === 'function') toast('Клипы появятся, когда авторы опубликуют первые ролики'); }catch(e){}
    };

    /* --- Иконка «Обновить»: пересобрать подборку, с анимацией вращения --- */
    window.okoFeedRefresh = function(btn){
      okoHaptic('impact');
      try{
        if(btn){
          btn.classList.add('ft-spin');
          setTimeout(function(){ try{ btn.classList.remove('ft-spin'); }catch(e){} }, 700);
        }
      }catch(e){}
      try{
        var kind = (typeof curFeedKind !== 'undefined' && curFeedKind) ? curFeedKind : 'rec';
        if(kind === 'rec' && typeof faRefresh === 'function'){ faRefresh(); return; }
        if(kind === 'fyou' && typeof faRefreshFYou === 'function'){ faRefreshFYou(); return; }
        if(typeof renderFeed === 'function') renderFeed(kind);
        var main = document.querySelector('main');
        if(main) main.scrollTo({ top: 0, behavior: 'smooth' });
      }catch(e){}
    };

    /* --- Лента по кругу: докрутил до конца — контент продолжается ---
       Пока рекомендаций больше нет, лента начинает заново, но с перетасовкой,
       чтобы не выглядело как повтор. Никакого «конца ленты» человек не видит. */
    (function infiniteLoop(){
      var main = document.querySelector('main');
      var list = document.getElementById('feedList');
      if(!main || !list) return;

      var busy = false, lastAt = 0;

      function nearBottom(){
        return main.scrollTop + main.clientHeight >= main.scrollHeight - 900;
      }
      function feedActive(){
        var s = document.getElementById('screen-feed');
        return s && s.classList.contains('active');
      }

      main.addEventListener('scroll', function(){
        if(busy || !feedActive() || !nearBottom()) return;
        var now = Date.now();
        if(now - lastAt < 700) return;
        lastAt = now; busy = true;
        try{
          /* 1. Родная догрузка ядра, если есть */
          if(typeof faLoadMore === 'function'){ faLoadMore(); }
          else if(typeof faRefresh === 'function' && curFeedKind === 'rec'){ faRefresh(); }
        }catch(e){}
        setTimeout(function(){ busy = false; }, 700);
      }, { passive:true });
    })();

    log('feed ok');
  }catch(e){}
})();

/* ---------------------------------------------------------------------------
   ОБЩЕЕ · тактильный отклик Telegram (тихо игнорируется вне TG)
   --------------------------------------------------------------------------- */
function okoHaptic(kind){
  try{
    var hf = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback;
    if(!hf) return;
    if(kind === 'selection' && hf.selectionChanged) hf.selectionChanged();
    else if(kind === 'success' && hf.notificationOccurred) hf.notificationOccurred('success');
    else if(kind === 'error' && hf.notificationOccurred) hf.notificationOccurred('error');
    else if(hf.impactOccurred) hf.impactOccurred('light');
  }catch(e){}
}
window.okoHaptic = okoHaptic;

})();
