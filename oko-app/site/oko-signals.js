/* ============================================================================
   OKO — СИГНАЛЫ УДЕРЖАНИЯ ДЛЯ ЛЕНТЫ РЕКОМЕНДАЦИЙ

   Даниэль просил смотреть на эталоны и делать лучше. Разбор того, как считают
   рекомендации TikTok, Instagram Reels и YouTube Shorts, даёт один общий
   вывод: решает не число лайков, а ВРЕМЯ ПРОСМОТРА, ДОСМОТР и ПОВТОРНЫЙ
   ПРОСМОТР. Первые 2-3 секунды весят больше всего: если человек не отвалился
   на них, алгоритм считает, что зацепило, и раздаёт шире.

   Что было у нас. В формуле ранжирования стояло:
       score = watch*3 + like*2 + comment*3 + share*5 + save*4 − hide*10
   где `watch` — это... ДЛИТЕЛЬНОСТЬ ролика. То есть длинное видео получало
   преимущество просто за то, что оно длинное, даже если его закрывали на
   первой секунде. Это прямо противоположно тому, как работают эталоны.

   Что делает этот модуль.
     • Ловит каждый <video> в приложении (клипы и видео в ленте) и честно
       считает: сколько секунд реально просмотрено, дошёл ли человек до конца,
       сколько раз пересматривал, отвалился ли в первые три секунды.
     • Хранит по публикации: сумму секунд, число досмотров, число повторов,
       число «отвалов на хуке» и число показов.
     • Пересобирает формулу ранжирования: доля досмотра и повторы поднимают,
       ранний отвал опускает. Пока по публикации нет ни одного просмотра,
       остаётся прежнее поведение — новинки не проваливаются на дно.
     • Добавляет «Не интересно» — прямой отрицательный сигнал, как в TikTok.

   Ничего не выдумывает: все числа — из реальных просмотров этого устройства.
   Пока просмотров нет, никакие метрики не показываются и не сочиняются.
   ============================================================================ */
(function(){
  'use strict';
  if(window.__okoSignalsV1) return;
  window.__okoSignalsV1 = 1;

  var KEY = 'oko-watch-v1';
  var MAX_ENTRIES = 400;      /* больше на устройстве держать незачем */
  var HOOK_SEC = 3;           /* «хук»: отвал раньше — плохой знак */

  var W = load();

  function load(){
    try{
      var j = JSON.parse(localStorage.getItem(KEY));
      if(j && typeof j === 'object' && j.v === 1) return j;
    }catch(e){}
    return { v: 1, items: {} };
  }
  var saveT = null;
  function save(){
    if(saveT) return;
    saveT = setTimeout(function(){
      saveT = null;
      try{
        var keys = Object.keys(W.items);
        if(keys.length > MAX_ENTRIES){
          /* выкидываем самые давние по последнему просмотру */
          keys.sort(function(a, b){ return (W.items[a].at || 0) - (W.items[b].at || 0); });
          keys.slice(0, keys.length - MAX_ENTRIES).forEach(function(k){ delete W.items[k]; });
        }
        localStorage.setItem(KEY, JSON.stringify(W));
      }catch(e){}
    }, 1200);
  }

  function rec(id){
    id = String(id);
    if(!W.items[id]) W.items[id] = { sec: 0, done: 0, rew: 0, drop: 0, shows: 0, at: 0 };
    return W.items[id];
  }

  /* --------------------------------------------------------------------------
     Определяем, к какой публикации относится видео. Плеер клипов и лента
     кладут id по-разному, поэтому смотрим несколько мест подряд.
     -------------------------------------------------------------------------- */
  /* Адрес медиа как запасной ключ. Плеер клипов помечает слайды порядковым
     номером (data-i), а не идентификатором публикации, поэтому по атрибутам
     клип не опознать. Адрес файла стабилен и одинаков в ленте и в плеере —
     этого достаточно, чтобы просмотры одной и той же публикации складывались
     независимо от того, где её посмотрели. */
  function normUrl(u){
    if(!u) return null;
    u = String(u);
    if(u.indexOf('blob:') === 0 || u.indexOf('data:') === 0) return null;  /* локальная запись — не ключ */
    try{
      var a = document.createElement('a');
      a.href = u;
      return 'u:' + a.pathname.replace(/^\/+/, '');
    }catch(e){ return 'u:' + u.split('?')[0]; }
  }

  function idOf(v){
    var el = v;
    for(var d = 0; el && d < 8; el = el.parentElement, d++){
      var a = el.getAttribute && (
        el.getAttribute('data-post-id') ||
        el.getAttribute('data-id') ||
        el.getAttribute('data-pid') ||
        el.getAttribute('data-clip-id')
      );
      if(a) return a;
    }
    return normUrl(v.currentSrc || v.src);
  }

  /* --------------------------------------------------------------------------
     Наблюдение за конкретным видео
     -------------------------------------------------------------------------- */
  function attach(v){
    if(!v || v.__okoSig) return;
    v.__okoSig = 1;

    var id = null, last = 0, acc = 0, counted = false, maxT = 0;

    function begin(){
      id = id || idOf(v);
      if(!id) return;
      var r = rec(id);
      if(!counted){ r.shows++; counted = true; r.at = Date.now(); save(); }
    }

    v.addEventListener('playing', function(){
      begin();
      last = v.currentTime || 0;
    });

    v.addEventListener('timeupdate', function(){
      if(!id) begin();
      if(!id) return;
      var t = v.currentTime || 0;
      /* Прибавляем только естественный ход времени: перемотка вперёд
         не должна засчитываться как просмотр. */
      var dt = t - last;
      if(dt > 0 && dt < 1.5) acc += dt;
      if(t > maxT) maxT = t;
      last = t;
      if(acc >= 1){
        var r = rec(id);
        r.sec += acc;
        r.at = Date.now();
        acc = 0;
        /* Отвал на хуке: посмотрели меньше трёх секунд и ушли — фиксируем
           при уходе (см. pause/hidden ниже), здесь только копим время. */
        save();
      }
    });

    v.addEventListener('ended', function(){
      if(!id) return;
      var r = rec(id);
      r.done++;
      r.at = Date.now();
      save();
    });

    /* Зацикленное видео (клипы играют по кругу) события `ended` не шлёт —
       ловим момент, когда время скакнуло назад к нулю: это повтор. */
    v.addEventListener('seeked', onLoop);
    v.addEventListener('timeupdate', onLoop);
    var prevT = 0;
    function onLoop(){
      var t = v.currentTime || 0;
      if(prevT > 1.2 && t < 0.4 && v.loop){
        if(id){
          var r = rec(id);
          r.done++; r.rew++; r.at = Date.now(); save();
        }
      }
      prevT = t;
    }

    function leave(){
      if(!id) return;
      var r = rec(id);
      if(acc > 0){ r.sec += acc; acc = 0; }
      var dur = v.duration || 0;
      /* Ушёл раньше трёх секунд и не досмотрел — это провал хука. */
      if(maxT > 0 && maxT < HOOK_SEC && (!dur || maxT < dur * 0.9)) r.drop++;
      r.at = Date.now();
      save();
      maxT = 0;
    }
    v.addEventListener('pause', leave);
    v.addEventListener('emptied', leave);
    window.addEventListener('pagehide', leave);
  }

  function scan(root){
    try{
      (root || document).querySelectorAll('video').forEach(attach);
    }catch(e){}
  }
  scan(document);
  try{
    new MutationObserver(function(muts){
      for(var i = 0; i < muts.length; i++){
        var added = muts[i].addedNodes;
        for(var j = 0; j < added.length; j++){
          var n = added[j];
          if(n.nodeType !== 1) continue;
          if(n.tagName === 'VIDEO') attach(n);
          else scan(n);
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }catch(e){}

  /* --------------------------------------------------------------------------
     Публичная статистика
     -------------------------------------------------------------------------- */
  function stats(id){
    if(!id) return null;
    var r = W.items[String(id)];
    if(!r || !r.shows) return null;
    return {
      sec: r.sec,
      avgSec: r.sec / r.shows,
      done: r.done,
      rewatch: r.rew,
      drop: r.drop,
      shows: r.shows,
      completion: r.shows ? Math.min(1, r.done / r.shows) : 0,
      hookLoss: r.shows ? Math.min(1, r.drop / r.shows) : 0
    };
  }

  /* --------------------------------------------------------------------------
     Пересборка формулы ранжирования
     -------------------------------------------------------------------------- */
  function patchScore(){
    if(typeof window.feedScore !== 'function' || window.feedScore.__okoSig) return false;
    var prev = window.feedScore;
    var patched = function(p){
      var base = prev(p);
      if(!p || p.id == null) return base;
      /* Ищем и по идентификатору публикации, и по адресу медиа: в плеере
         клипов просмотр записывается по адресу. */
      var st = stats(p.id) || (p.media ? stats(normUrl(p.media)) : null) ||
               (p.video ? stats(normUrl(p.video)) : null);
      if(!st) return base;   /* нет просмотров — прежнее поведение, новинки не тонут */

      /* Досмотр и повторы — главные положительные сигналы.
         Ранний отвал — главный отрицательный. Веса подобраны так, чтобы
         сигналы удержания могли переставить публикацию, но не перебивали
         свежесть полностью: у ленты остаётся суточный полураспад. */
      var bonus = 0;
      bonus += st.completion * 90;            /* досмотрели до конца */
      bonus += Math.min(st.rewatch, 5) * 25;  /* пересматривали */
      bonus += Math.min(st.avgSec, 30) * 2;   /* сколько реально смотрели */
      bonus -= st.hookLoss * 70;              /* отвалились на первых секундах */

      /* Уже показывали много раз, а смотреть не стали — притапливаем,
         чтобы лента не крутила одно и то же по кругу. */
      if(st.shows >= 3 && st.avgSec < 1.5) bonus -= 60;

      return base + bonus;
    };
    patched.__okoSig = 1;
    window.feedScore = patched;
    return true;
  }
  /* feedScore несколько раз переопределяется по цепочке в ядре — цепляемся
     после того, как все патчи ядра встали. */
  [0, 300, 1200, 3000].forEach(function(d){ setTimeout(patchScore, d); });

  /* --------------------------------------------------------------------------
     «Не интересно» — прямой отрицательный сигнал, как в TikTok
     -------------------------------------------------------------------------- */
  function notInterested(id, topic, author){
    var r = rec(id);
    r.drop += 5; r.shows += 5; r.at = Date.now();
    save();
    try{ if(typeof faSignal === 'function' && topic) faSignal(topic, -6); }catch(e){}
    try{
      if(author && typeof FA !== 'undefined' && FA.authors){
        FA.authors[author] = (FA.authors[author] || 0) - 6;
      }
    }catch(e){}
    try{ if(typeof faRender === 'function') faRender(); }catch(e){}
    try{ if(typeof toast === 'function') toast('Понял — такого будет меньше'); }catch(e){}
  }

  /* --------------------------------------------------------------------------
     Подключаем «Не интересно» ядра к сигналам.
     В меню поста такая кнопка была, но hidePost() просто выкидывал запись из
     локального списка: пост исчезал с экрана и НИЧЕМУ не учил рекомендации —
     завтра приходило такое же. Теперь нажатие ещё и понижает тему и автора.
     -------------------------------------------------------------------------- */
  function hookHide(){
    if(typeof window.hidePost !== 'function' || window.hidePost.__okoSig) return false;
    var prev = window.hidePost;
    var patched = function(id){
      var p = null;
      try{ p = (typeof postById === 'function') ? postById(id) : null; }catch(e){}
      try{ notInterested(id, p && p.topic, p && p.name); }catch(e){}
      return prev.apply(this, arguments);
    };
    patched.__okoSig = 1;
    window.hidePost = patched;
    return true;
  }
  [0, 300, 1200, 3000].forEach(function(d){ setTimeout(hookHide, d); });

  window.okoWatch = {
    stats: stats,
    notInterested: notInterested,
    /* Сводка по всему устройству — пригодится авторам в статистике.
       Только реальные числа, ничего не досочиняем. */
    summary: function(){
      var ids = Object.keys(W.items), sec = 0, done = 0, shows = 0;
      ids.forEach(function(k){ var r = W.items[k]; sec += r.sec; done += r.done; shows += r.shows; });
      return { publications: ids.length, seconds: Math.round(sec), completions: done, shows: shows };
    },
    reset: function(){ W = { v: 1, items: {} }; try{ localStorage.setItem(KEY, JSON.stringify(W)); }catch(e){} }
  };
})();
