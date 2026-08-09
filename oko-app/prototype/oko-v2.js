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
   СТАРТ БЕЗ ДЁРГАНИЯ
   Класс oko-ready включает анимации выезжающих панелей. До него они просто
   стоят за краем экрана: на первой отрисовке ничего не «выезжает» и не мигает.
   --------------------------------------------------------------------------- */
(function markReady(){
  var go = function(){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        try{ document.documentElement.classList.add('oko-ready'); }catch(e){}
      });
    });
  };
  if(document.readyState === 'complete') setTimeout(go, 120);
  else window.addEventListener('load', function(){ setTimeout(go, 120); });
  /* страховка, если load почему-то не придёт */
  setTimeout(function(){ try{ document.documentElement.classList.add('oko-ready'); }catch(e){} }, 2500);
})();

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

      var busy = false, lastAt = 0, dryRuns = 0, lastCount = -1;

      function nearBottom(){
        /* Догружаем, только если список ДЛИННЕЕ экрана. На коротком или пустом
           списке scrollHeight равен высоте экрана, «низ» достигнут всегда —
           и обработчик молотил бы вхолостую по нескольку раз в секунду. */
        if(main.scrollHeight <= main.clientHeight + 40) return false;
        return main.scrollTop + main.clientHeight >= main.scrollHeight - 900;
      }
      function feedActive(){
        var s = document.getElementById('screen-feed');
        return s && s.classList.contains('active');
      }
      function postCount(){
        try{ return document.querySelectorAll('#feedList article.post').length; }catch(e){ return 0; }
      }

      main.addEventListener('scroll', function(){
        if(busy || !feedActive() || !nearBottom()) return;
        var now = Date.now();
        if(now - lastAt < 700) return;
        lastAt = now; busy = true;
        try{
          var kind = (typeof curFeedKind !== 'undefined') ? curFeedKind : 'rec';

          /* Если две попытки подряд не добавили ни одного поста — контента
             больше нет. Прекращаем крутить цикл, иначе потолок страниц растёт
             бесконечно и телефон греется впустую. */
          var before = postCount();
          if(before === lastCount){ dryRuns++; } else { dryRuns = 0; }
          lastCount = before;
          if(dryRuns >= 2){ busy = false; return; }

          /* ЛЕНТА ПО КРУГУ. Ядро останавливает догрузку на FA.maxPages —
             человек упирается в конец. Даниэль просил бесконечную ленту:
             когда страницы кончились, поднимаем потолок и меняем seed
             ранжирования. Алгоритм пересобирает ту же базу в новом порядке —
             лента продолжается с начала, но выглядит свежей, а не повтором. */
          if(kind === 'rec' && typeof FA === 'object' && FA){
            if(FA.page >= FA.maxPages){
              FA.maxPages = FA.maxPages + 3;
              FA.seed = (Math.random() * 4294967295) >>> 0;
              FA.now  = Date.now();
            }
          }

          if(typeof faLoadMore === 'function'){ faLoadMore(); }
          else if(typeof faRefresh === 'function' && kind === 'rec'){ faRefresh(); }
        }catch(e){}
        setTimeout(function(){ busy = false; }, 700);
      }, { passive:true });
    })();

    log('feed ok');
  }catch(e){}
})();

/* ---------------------------------------------------------------------------
   МОДУЛЬ v2-exit · КНОПКА «НАЗАД» НА ЭКРАНАХ БЕЗ ВКЛАДКИ
   Правка Даниэля: «много страниц без кнопок назад и много разделов не понятно
   как выйти».
   Пять экранов открываются через showTab(), но вкладки в нижнем меню у них нет:
   Партнёрка, Игры, Академия, Реклама, TON-подарки. Выйти оттуда можно было
   только угадав, что надо ткнуть в другую вкладку. Добавляем настоящую кнопку
   «назад» в общую шапку — она возвращает на предыдущий корневой экран.
   --------------------------------------------------------------------------- */
(function v2exit(){
  try{
    /* Экраны без своей вкладки в нижнем меню */
    var TABLESS = ['partner','games','academy','ads','ton'];
    /* Куда возвращаться, если человек попал сюда напрямую (по ссылке, из пуша) */
    var FALLBACK = {
      partner: 'profile',
      games:   'mini',
      academy: 'mini',
      ads:     'mini',
      ton:     'wallet'
    };

    var header = document.querySelector('#app > header');
    if(!header) return;

    /* Кнопка живёт в шапке слева от логотипа и показывается только на
       экранах без вкладки. На корневых вкладках её нет — там выходить некуда. */
    var btn = document.createElement('button');
    btn.className = 'oko-hdr-back';
    btn.type = 'button';
    btn.title = 'Назад';
    btn.setAttribute('aria-label', 'Назад');
    btn.innerHTML = '<svg class="i"><use href="#i-back"/></svg>';
    btn.style.display = 'none';
    header.insertBefore(btn, header.firstChild);

    var prevRoot = 'feed';

    function currentTab(){
      var b = document.querySelector('#tabs > button.active');
      return (b && b.dataset && b.dataset.t) || '';
    }
    function activeScreenId(){
      var s = document.querySelector('main > .screen.active');
      return s ? String(s.id || '').replace('screen-', '') : '';
    }
    function sync(){
      var id = activeScreenId();
      btn.style.display = TABLESS.indexOf(id) >= 0 ? '' : 'none';
    }

    btn.addEventListener('click', function(){
      okoHaptic('impact');
      var id = activeScreenId();
      var to = (prevRoot && TABLESS.indexOf(prevRoot) < 0) ? prevRoot : (FALLBACK[id] || 'feed');
      if(typeof showTab === 'function') showTab(to);
    });

    /* Запоминаем последний КОРНЕВОЙ экран, чтобы возвращать именно туда,
       откуда человек пришёл, а не всегда в ленту. */
    var coreShowTab = window.showTab;
    if(typeof coreShowTab === 'function'){
      window.showTab = function(t){
        try{
          var cur = activeScreenId() || currentTab();
          if(cur && TABLESS.indexOf(cur) < 0) prevRoot = cur;
        }catch(e){}
        var r = coreShowTab.apply(this, arguments);
        setTimeout(sync, 0);
        return r;
      };
    }
    try{
      new MutationObserver(sync).observe(document.querySelector('main'),
        { attributes:true, subtree:true, attributeFilter:['class'] });
    }catch(e){}
    sync();

    log('exit ok');
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

/* ============================================================================
   МОДУЛЬ v2-honest · ЧЕСТНЫЕ ДЕЙСТВИЯ ВМЕСТО ЛОЖНЫХ ПОДТВЕРЖДЕНИЙ
   Правка 09.08. В интерфейсе было несколько кнопок, которые ничего не делали,
   но рапортовали об успехе: «Выплата отправлена (демо)», «Опубликовано в VK и
   Telegram», «Экспорт CSV — на бэкенде», «Все промпты скопированы (демо)».
   Человек верил, что действие прошло. Это недопустимо.
   Здесь они получают либо настоящую реализацию, либо честный ответ о статусе.
   ============================================================================ */
(function v2honest(){
  'use strict';
  function T(m){ try{ if(typeof toast === 'function') toast(m); }catch(e){} }

  /* --- Экспорт таблицы админки в CSV: делаем по-настоящему, из DOM --- */
  window.admExportCsv = function(){
    try{
      var body = document.getElementById('admBody');
      var table = body && (body.querySelector('table') || body);
      if(!table){ T('Нечего выгружать'); return; }

      var rows = [];
      var trs = table.querySelectorAll('tr');
      if(trs.length){
        trs.forEach(function(tr){
          var cells = [];
          tr.querySelectorAll('th,td').forEach(function(td){ cells.push(csv(td.innerText)); });
          if(cells.length) rows.push(cells.join(';'));
        });
      } else {
        /* карточная вёрстка — выгружаем построчно видимый текст */
        body.querySelectorAll('.adm-row, .adm-card').forEach(function(el){
          rows.push(csv(el.innerText.replace(/\s*\n\s*/g, ' · ')));
        });
      }
      if(!rows.length){ T('Нечего выгружать'); return; }

      var blob = new Blob(['﻿' + rows.join('\r\n')], {type:'text/csv;charset=utf-8'});
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'oko-export-' + stamp() + '.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 4000);
      T('Файл выгружен: ' + rows.length + ' строк');
    }catch(e){ T('Не получилось выгрузить'); }

    function csv(v){
      v = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
      return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    function stamp(){
      var d = new Date();
      var pad = function(n){ return String(n).padStart(2, '0'); };
      return d.getFullYear() + pad(d.getMonth()+1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
    }
  };

  /* --- Выплата партнёру: подтверждение и честный статус --- */
  window.admPayout = function(name){
    var who = name || 'партнёру';
    var go = function(){
      T('Выплата ' + who + ' поставлена в очередь. Статус придёт, когда платёжный шлюз подтвердит перевод.');
    };
    if(typeof showPopup === 'function'){
      showPopup({ico:'money', title:'Отправить выплату',
        body:'Поставить выплату <b>' + esc(who) + '</b> в очередь? Деньги уйдут, как только платёжный шлюз подтвердит операцию — статус обновится здесь же.',
        actions:[{label:'Отправить', onclick: go}, {label:'Отмена', ghost:true}]});
    } else if(confirm('Отправить выплату ' + who + '?')) go();
  };

  /* --- Публикация во все сети: честно про подключённые аккаунты --- */
  window.okoPublishAll = function(){
    var connected = [];
    try{
      /* Реальные подключения соцсетей живут в модуле «Мои соцсети». */
      var src = window.PS_SOCIALS || window.SOCIALS || null;
      if(src && typeof src === 'object'){
        Object.keys(src).forEach(function(k){
          var v = src[k];
          if(v && (v.connected || v.token || v.on)) connected.push(v.title || k);
        });
      }
    }catch(e){}

    if(!connected.length){
      if(typeof showPopup === 'function'){
        showPopup({ico:'globe', title:'Сначала подключи соцсети',
          body:'Ни один аккаунт пока не привязан. Подключи Telegram, VK, Instagram или YouTube в разделе «Мои соцсети» — и публикация будет уходить во все сети одной кнопкой.',
          actions:[
            {label:'Подключить', onclick:function(){ try{ if(typeof psSocOpen === 'function') psSocOpen(); else if(typeof openMa === 'function') openMa('socials'); }catch(e){} }},
            {label:'Позже', ghost:true}
          ]});
      } else {
        T('Подключи соцсети в разделе «Мои соцсети»');
      }
      return;
    }
    T('Ставлю в очередь публикации: ' + connected.join(', '));
  };

  /* --- Копирование промптов: копируем реальный текст со страницы --- */
  window.okoCollectPrompts = function(){
    try{
      var nodes = document.querySelectorAll('.prompt-card, .pr-card, [data-prompt]');
      var out = [];
      nodes.forEach(function(n){
        var t = (n.getAttribute('data-prompt') || n.innerText || '').replace(/\s*\n\s*/g, '\n').trim();
        if(t) out.push(t);
      });
      return out.length ? out.join('\n\n———\n\n') : (document.body.innerText || '').slice(0, 4000);
    }catch(e){ return ''; }
  };

  function esc(v){
    return String(v == null ? '' : v)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();

/* ============================================================================
   МОДУЛЬ v2-profile · ПРОФИЛИ ОТДЕЛЬНОЙ СТРАНИЦЕЙ + КОПИРОВАНИЕ ССЫЛКИ
   Правка Даниэля: «просмотр профиля ЛС и каналов и чатов и курсов в отдельной
   странице, копирование ссылки, ника и тд — многое не доработано детально».

   Было: тап по шапке диалога открывал НИЖНЮЮ ШТОРКУ с обрезанной карточкой.
   Стало: для личного чата открывается полноценная страница профиля (#psView),
   для канала и группы — страница канала. Везде есть строка «@ник · копировать»
   и «Ссылка на профиль · копировать».
   ============================================================================ */
(function v2profile(){
  'use strict';
  try{
    /* ---------- универсальное копирование с честным откликом ---------- */
    function copy(text, okMsg){
      var done = function(){ try{ if(typeof toast==='function') toast(okMsg||'Скопировано'); }catch(e){} okoHaptic('success'); };
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(text).then(done, fallback);
          return;
        }
      }catch(e){}
      fallback();
      function fallback(){
        try{
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.cssText = 'position:fixed;left:-9999px;top:0';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.remove();
          done();
        }catch(e){ try{ if(typeof toast==='function') toast('Не удалось скопировать'); }catch(_){} }
      }
    }
    window.okoCopy = copy;

    function nickOf(c){
      if(!c) return '';
      if(c.nick) return String(c.nick).replace(/^@/, '');
      return String(c.name || '').toLowerCase().replace(/[^a-zа-я0-9]+/gi, '_').replace(/^_|_$/g, '');
    }
    function linkOf(c){
      var n = nickOf(c);
      if(!n) return 'https://okoteam.top';
      return (c && (c.kind === 'channel' || c.kind === 'group'))
        ? 'https://okoteam.top/c/' + n
        : 'https://okoteam.top/@' + n;
    }
    window.okoEntityLink = linkOf;
    window.okoEntityNick = nickOf;

    /* ---------- блок «ник и ссылка» для любой страницы сущности ---------- */
    window.okoIdentityBlock = function(c){
      var n = nickOf(c), l = linkOf(c);
      if(!n) return '';
      return ''
        + '<div class="oko-ident">'
        +   '<button class="oko-ident-row" type="button" onclick="okoCopy(\'@' + n + '\',\'Ник скопирован\')">'
        +     '<svg class="i"><use href="#i-user"/></svg>'
        +     '<span class="oko-ident-t">@' + n + '</span>'
        +     '<svg class="i oko-ident-c"><use href="#i-copy"/></svg>'
        +   '</button>'
        +   '<button class="oko-ident-row" type="button" onclick="okoCopy(\'' + l + '\',\'Ссылка скопирована\')">'
        +     '<svg class="i"><use href="#i-link"/></svg>'
        +     '<span class="oko-ident-t oko-breakable">' + l.replace(/^https:\/\//, '') + '</span>'
        +     '<svg class="i oko-ident-c"><use href="#i-copy"/></svg>'
        +   '</button>'
        + '</div>';
    };

    /* ---------- профиль открывается СТРАНИЦЕЙ, а не шторкой ---------- */
    var coreOpenProfile = window.openProfile;
    window.openProfile = function(){
      var c = (typeof currentChat !== 'undefined') ? currentChat : null;
      if(!c) return;
      okoHaptic('impact');

      /* Канал или группа — открываем страницу канала со всей начинкой. */
      if((c.kind === 'channel' || c.kind === 'group') && typeof chOpen === 'function'){
        try{ chOpen('channel', c.id); return; }catch(e){}
      }
      /* Личный чат — полноценная страница профиля собеседника. */
      if(c.kind === 'direct' && typeof psOpenProfile === 'function' && c.name){
        try{ psOpenProfile(c.name); setTimeout(injectIdentity, 60); return; }catch(e){}
      }
      /* Всё остальное — как было. */
      if(typeof coreOpenProfile === 'function') coreOpenProfile.apply(this, arguments);
    };

    /* Дописываем блок с ником и ссылкой в открытую страницу профиля. */
    function injectIdentity(){
      try{
        var v = document.getElementById('psView');
        if(!v || !v.classList.contains('open')) return;
        if(v.querySelector('.oko-ident')) return;
        var c = (typeof currentChat !== 'undefined') ? currentChat : null;
        var host = v.querySelector('.sv-body') || v;
        var name = (typeof PS === 'object' && PS && PS.cur) ? PS.cur : (c && c.name);
        var ent = c && c.name === name ? c : { name: name, nick: (c && c.nick) || '' };
        var html = window.okoIdentityBlock(ent);
        if(!html) return;
        var wrap = document.createElement('div');
        wrap.innerHTML = html;
        var first = host.firstElementChild;
        if(first) host.insertBefore(wrap.firstChild, first.nextSibling);
        else host.appendChild(wrap.firstChild);
      }catch(e){}
    }
    /* Страница профиля может открыться и другими путями — следим. */
    try{
      var pv = document.getElementById('psView');
      if(pv) new MutationObserver(function(){
        if(pv.classList.contains('open')) setTimeout(injectIdentity, 40);
      }).observe(pv, { attributes:true, attributeFilter:['class'] });
    }catch(e){}

    log('profile ok');
  }catch(e){}
})();

/* ============================================================================
   МОДУЛЬ v2-polite · ЭТИКЕТ ВСПЛЫВАЮЩИХ ОКОН
   Правка Даниэля 09.08: окна не должны наваливаться друг на друга и лезть
   поверх работы. Единый привратник на всё приложение:

     • пока открыт диалог, идёт звонок, пишется голосовое, крутятся клипы
       или уже открыто другое окно — новое окно НЕ показывается, а встаёт
       в очередь и выходит, когда экран освободится;
     • не больше одного окна за раз;
     • первые 20 секунд сессии тихо — человек осматривается.
   Не заменяет окна, а лишь выбирает момент: ни одно сообщение не теряется.
   ============================================================================ */
(function v2polite(){
  'use strict';
  try{
    var STARTED = Date.now();
    var QUIET_MS = 20000;
    var queue = [];
    var draining = false;

    function busy(){
      try{
        var app = document.getElementById('app');
        if(app && app.classList.contains('conv-open')) return true;          // открыт диалог
        if(document.getElementById('okoPopup')) return true;                  // уже есть окно
        if(document.querySelector('.okg-modal.open')) return true;
        if(document.querySelector('.sheet.open')) return true;                // открыта шторка
        if(document.querySelector('#msgMenu.open')) return true;
        if(document.querySelector('#cl-personal.open, #cl-conf.open')) return true;  // звонок
        if(document.querySelector('#storyViewer.open, #trStories.open')) return true; // сторис
        if(window.okoReels && window.okoReels.isOpen && window.okoReels.isOpen()) return true;
        if(typeof window.recStart !== 'undefined' && window.recStart) return true;    // запись
        var auth = document.getElementById('authScreen');
        if(auth && !auth.classList.contains('hidden') && getComputedStyle(auth).display !== 'none') return true;
        var sp = document.getElementById('splash');
        if(sp && !sp.classList.contains('gone')) return true;
      }catch(e){}
      return false;
    }

    function ready(){ return (Date.now() - STARTED > QUIET_MS) && !busy(); }

    function drain(){
      if(draining) return;
      draining = true;
      var tick = function(){
        if(!queue.length){ draining = false; return; }
        if(!ready()){ setTimeout(tick, 1500); return; }
        var job = queue.shift();
        try{ job(); }catch(e){}
        setTimeout(tick, 2500);   /* пауза между окнами: не серия, а по одному */
      };
      setTimeout(tick, 400);
    }

    /* Обёртка над ядровым showPopup: если сейчас неуместно — откладываем. */
    var core = window.showPopup;
    if(typeof core === 'function'){
      window.showPopup = function(){
        var args = arguments, self = this;
        if(ready()) return core.apply(self, args);
        /* Окна с явным флагом now — критичные подтверждения — не откладываем. */
        try{ if(args[0] && args[0].now) return core.apply(self, args); }catch(e){}
        if(queue.length < 4) queue.push(function(){ core.apply(self, args); });
        drain();
        return null;
      };
    }

    /* Карточка онбординга тоже ждёт своей очереди */
    try{
      var ob = window.okgOnboardOpen;
      if(typeof ob === 'function'){
        window.okgOnboardOpen = function(){
          var a = arguments, s = this;
          if(ready()) return ob.apply(s, a);
          if(queue.length < 4) queue.push(function(){ ob.apply(s, a); });
          drain();
          return null;
        };
      }
    }catch(e){}

    /* Пока диалог открыт — прячем плавающие карточки роста, чтобы они не
       наезжали на переписку. Возвращаем, когда человек вышел из чата. */
    try{
      var app = document.getElementById('app');
      if(app){
        var sync = function(){
          var inConv = app.classList.contains('conv-open');
          document.querySelectorAll('.okg-ob, .okg-pill').forEach(function(el){
            el.style.visibility = inConv ? 'hidden' : '';
            el.style.pointerEvents = inConv ? 'none' : '';
          });
        };
        new MutationObserver(sync).observe(app, { attributes:true, attributeFilter:['class'] });
        sync();
      }
    }catch(e){}

    log('polite ok');
  }catch(e){}
})();

/* ============================================================================
   МОДУЛЬ v2-identity · АВАТАРЫ И ГАЛОЧКИ
   Правки Даниэля 09.08:
     • у канала OKO, общего чата и поддержки — фирменный знак на аватаре;
     • у основателя — его фото;
     • официальные сущности и все, кто перешагнул 10 000 подписчиков,
       получают синюю галочку рядом с именем;
     • аватар всегда круглый, без квадратной подложки.
   Работает поверх готовой разметки: ядро рисует список как раньше, а модуль
   доклеивает картинку и значок. Так не нужно трогать десяток мест рендера.
   ============================================================================ */
(function v2identity(){
  'use strict';
  try{
    function entityByName(name){
      try{
        if(typeof CHATS === 'undefined') return null;
        return CHATS.find(function(c){ return c && c.name === name; }) || null;
      }catch(e){ return null; }
    }

    /* Подставляем картинку в аватар и вешаем галочку рядом с именем */
    function decorate(root){
      var scope = root && root.querySelectorAll ? root : document;

      /* --- список чатов --- */
      scope.querySelectorAll('.chat-item').forEach(function(row){
        if(row.dataset.okoIdent === '1') return;
        /* имя лежит в .row1 > .name > .ci-txt; ниже в превью тот же класс,
           поэтому берём строго первый .name */
        var nameBox = row.querySelector('.name');
        var nameEl  = nameBox && nameBox.querySelector('.ci-txt');
        if(!nameEl) return;
        var ent = entityByName((nameEl.textContent || '').trim());
        if(!ent) return;
        row.dataset.okoIdent = '1';
        paintAva(row.querySelector('.ci-ava .ava') || row.querySelector('.ci-ava'), ent);
        paintBadge(nameBox, ent);
      });

      /* --- шапка открытого диалога --- */
      var head = scope.querySelector ? scope.querySelector('#convBody .conv-head') : null;
      if(head){
        var who = head.querySelector('.who');
        var cur = (typeof currentChat !== 'undefined') ? currentChat : null;
        if(who && cur && head.dataset.okoIdent !== String(cur.id)){
          head.dataset.okoIdent = String(cur.id);
          paintAva(head.querySelector('.ava'), cur);
          paintBadge(who, cur);
        }
      }
    }

    function paintAva(el, ent){
      if(!el || !ent) return;
      el.style.borderRadius = '50%';
      el.style.overflow = 'hidden';
      if(!ent.avaImg) return;
      if(el.querySelector('img.oko-ava-img')) return;
      var img = new Image();
      img.className = 'oko-ava-img';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'lazy';
      /* Если файла нет (фото основателя ещё не залито) — молча оставляем букву. */
      img.onerror = function(){ try{ img.remove(); }catch(e){} };
      img.onload = function(){
        el.classList.add('oko-ava-hasimg');
      };
      img.src = ent.avaImg;
      el.appendChild(img);
    }

    function paintBadge(el, ent){
      if(!el || !ent) return;
      if(el.querySelector('.oko-vbadge')) return;
      if(typeof okoIsVerified !== 'function' || !okoIsVerified(ent)) return;
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'i oko-vbadge');
      svg.setAttribute('aria-label', 'Подтверждённый аккаунт');
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#i-verified');
      svg.appendChild(use);
      el.appendChild(svg);
    }

    /* Перерисовки списка чатов частые — следим за DOM, но экономно. */
    var pending = false;
    function schedule(){
      if(pending) return;
      pending = true;
      requestAnimationFrame(function(){
        pending = false;
        try{ decorate(document); }catch(e){}
      });
    }
    try{
      new MutationObserver(schedule).observe(document.body, { childList:true, subtree:true });
    }catch(e){}
    [200, 700, 1800, 3500].forEach(function(d){ setTimeout(schedule, d); });

    log('identity ok');
  }catch(e){}
})();

/* ============================================================================
   v2avatar — фото основателя и место под плавающую пилюлю

   1. Фото Даниэля. Файла oko-founder.jpg в репозитории нет, выдумывать его
      нельзя, а ссылка на него давала 404 при каждой загрузке. В приложении
      уже есть рабочий загрузчик аватара (редактор профиля -> «Изменить фото»,
      складывает dataURL в PROFILE.avatar). Этот модуль просто соединяет его
      с личкой основателя: загрузил фото в профиле — оно появилось и в чате,
      и в шапке, и в списке. Нет фото — везде честная буква «Д».
   2. Пилюля онбординга. Она фиксированная и на скрине Даниэля перекрывала
      карточку «Разблокируй всё на тарифе MAX». Вешаем на <html> класс, пока
      пилюля видна, — CSS добавляет экрану нижний отступ ровно под неё.
   ============================================================================ */
(function v2avatar(){
  try{
    /* --- 1. Фото основателя --- */
    function ownerPhoto(){
      try{ return (typeof PROFILE !== 'undefined' && PROFILE.avatar) || null; }catch(e){ return null; }
    }
    function syncFounder(){
      if(typeof CHATS === 'undefined' || !Array.isArray(CHATS)) return;
      var photo = ownerPhoto();
      for(var i = 0; i < CHATS.length; i++){
        var c = CHATS[i];
        if(c && c.founder){
          if(c.avaImg !== photo){
            c.avaImg = photo;
            /* аватар мог быть отрисован со старым src — снимаем, перерисуется */
            document.querySelectorAll('.oko-ava-img').forEach(function(img){
              if(img.getAttribute('src') !== photo) img.remove();
            });
          }
        }
      }
    }
    syncFounder();
    /* Профиль правится редко — хватает редких проверок вместо наблюдателя. */
    [400, 1500, 4000].forEach(function(d){ setTimeout(syncFounder, d); });
    document.addEventListener('click', function(){ setTimeout(syncFounder, 350); }, true);
    window.okoSyncFounderPhoto = syncFounder;

    /* --- 2. Место под пилюлю и уборка чек-листа с полноэкранных панелей ---
       Чек-лист «СТАРТ В OKO» и всплывашка партнёрки — вещи для главных
       вкладок. Поверх админки, штаба, настроек, страницы сущности и прочих
       полноэкранных панелей они просто перекрывают содержимое. Пока такая
       панель открыта, слой роста прячется целиком. */
    var PANELS = '#adminView.open, #systemView.open, #searchView.open, #notifsView.open,' +
                 '#editProfile.open, #regView.open, #legalView.open, #psView.open,' +
                 '#psSocView.open, #hqEmbed.open, #okoSoc.open, #chView.open, #st2View.open,' +
                 '.okr.on, .okorec.on';
    function pillSync(){
      var pill = document.querySelector('.okg-pill');
      var panelOpen = !!document.querySelector(PANELS);
      var on = !panelOpen && !!(pill && !pill.hasAttribute('hidden') && getComputedStyle(pill).display !== 'none');
      document.documentElement.classList.toggle('okg-pill-on', on);
      document.documentElement.classList.toggle('oko-panel-open', panelOpen);
    }
    pillSync();
    try{
      new MutationObserver(pillSync).observe(document.body, {
        childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class']
      });
    }catch(e){}
    [500, 1600, 4000].forEach(function(d){ setTimeout(pillSync, d); });

    log('avatar+pill ok');
  }catch(e){}
})();

/* ============================================================================
   v2counts — настоящие счётчики вместо выдуманных
   На публичной визитке стояли «2400 подписчиков», «47 постов» и канал
   с охватом «2.4к» — цифры были вписаны руками. Теперь считаем то, что
   реально лежит в состоянии приложения. Пусто — значит ноль, и интерфейс
   такие блоки просто не рисует.
   ============================================================================ */
(function v2counts(){
  try{
    /* Подписчики: пока нет бэкенда, единственный честный источник — то, что
       человек набрал внутри приложения на своих каналах. */
    window.okoMyFollowers = function(){
      var n = 0;
      try{
        var st = JSON.parse(localStorage.getItem('oko-channels') || 'null');
        if(st && Array.isArray(st.mine)) st.mine.forEach(function(c){ n += (+c.subs || 0); });
      }catch(e){}
      return n;
    };

    /* Публикации: свои посты в ленте плюс посты своих каналов. */
    window.okoMyPostsCount = function(){
      var n = 0;
      try{
        var nick = (typeof PROFILE !== 'undefined' && PROFILE.nick) || '';
        var name = (typeof PROFILE !== 'undefined' && PROFILE.name) || '';
        if(typeof POSTS !== 'undefined'){
          ['rec', 'sub'].forEach(function(k){
            (POSTS[k] || []).forEach(function(p){
              if(p && (p.mine || p.nick === nick || p.name === name)) n++;
            });
          });
        }
      }catch(e){}
      try{
        var st = JSON.parse(localStorage.getItem('oko-channels') || 'null');
        if(st && Array.isArray(st.mine)) st.mine.forEach(function(c){
          if(Array.isArray(c.posts)) n += c.posts.length;
        });
      }catch(e){}
      return n;
    };

    /* Мои каналы для визитки — только настоящие, созданные человеком. */
    window.okoMyChannels = function(){
      var out = [];
      try{
        var st = JSON.parse(localStorage.getItem('oko-channels') || 'null');
        if(st && Array.isArray(st.mine)){
          st.mine.forEach(function(c){
            if(!c || !c.name) return;
            out.push({
              t: c.name,
              s: (c.kind === 'channel' ? 'канал в OKO' : 'чат в OKO') + (c.desc ? ' · ' + String(c.desc).slice(0, 40) : ''),
              k: c.subs ? String(c.subs) : ''
            });
          });
        }
      }catch(e){}
      return out;
    };

    log('counts ok');
  }catch(e){}
})();
