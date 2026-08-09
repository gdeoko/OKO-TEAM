/* ============================================================================
   OKO REELS — настоящий вертикальный видео-плеер (Instagram Reels / TikTok /
   YouTube Shorts), заменяет старый «сторис под видом клипов» (.far-* / #faReels).

   Правка Даниэля: «клипы не должны быть как лента сторис, а как лента Reels
   в Инстаграм или в Тикток или шортс в Ютубе».

   Что изменилось против старого плеера:
     • в слайде ЕСТЬ настоящий <video> (object-fit:cover), а не градиент с
       гигантским заголовком — длинные подписи больше не разваливаются на экран;
     • листание — нативный scroll-snap (y mandatory + snap-stop:always),
       а не JS-transform;
     • активность слайда определяет IntersectionObserver (0.6), а не CSS-таймер;
     • прогресс — тонкая БЕЗ сегментов полоса по currentTime активного видео;
     • счётчика «2/37» и сегментов сторис нет вообще;
     • виртуализация: смонтированы только текущий слайд ±2.

   Обычный скрипт (не ES-модуль). Грузится ПОСЛЕ app.js. Всё в IIFE и try/catch.
   Стили — инъекцией <style>, префикс .okr- (со старыми .far-* не конфликтует).
   Старая оболочка #faReels прячется (display:none), но не удаляется.

   Публичное API: window.okoReels = { open, close, source, refresh, isOpen }
   Переопределяет: window.faReelsOpen / faReelsOpenFirst / faReelsClose /
                   faReelsList / okoOpenClips + тап по видео в ленте.
   ============================================================================ */
(function(){
'use strict';

try{

if(window.__okoReelsV1) return;
window.__okoReelsV1 = 1;

/* ---------------------------------------------------------------------------
   0. Мелкие утилиты (свои, чтобы не зависеть от порядка загрузки ядра)
   --------------------------------------------------------------------------- */
var LS_SOUND = 'oko-reels-sound';   /* '1' | '0' | нет ключа = человек не решал */
var LS_FOLLOW = 'oko-reels-follow'; /* {nick:1} — локальные подписки из плеера */

function esc(s){
  var d = document.createElement('div');
  d.textContent = String(s == null ? '' : s);
  return d.innerHTML;
}
/* значение внутрь HTML-атрибута: & экранируем первым, иначе присланный из
   данных «&quot;» раскроется в живую кавычку и разорвёт атрибут */
function attr(s){
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
/* Мост к ядру. Важно: часть помощников ядро объявляет как top-level const
   (fmtN, postById в index.html). Такие имена живут в глобальной лексической
   области и на window НЕ попадают — window.postById здесь всегда undefined.
   Обычный (не модульный) скрипт видит их по цепочке областей, поэтому
   спрашиваем сначала window, потом голое имя. Имя 'toast' сюда не берём:
   в этом файле есть свой toast и получилась бы бесконечная рекурсия. */
function coreRef(name){
  try{ if(typeof window[name] === 'function') return window[name]; }catch(e){}
  try{
    switch(name){
      case 'fmtN':         if(typeof fmtN === 'function') return fmtN; break;
      case 'postById':     if(typeof postById === 'function') return postById; break;
      case 'likePost':     if(typeof likePost === 'function') return likePost; break;
      case 'toggleSave':   if(typeof toggleSave === 'function') return toggleSave; break;
      case 'openComments': if(typeof openComments === 'function') return openComments; break;
      case 'repost':       if(typeof repost === 'function') return repost; break;
      case 'openPostMenu': if(typeof openPostMenu === 'function') return openPostMenu; break;
      case 'showTab':      if(typeof showTab === 'function') return showTab; break;
    }
  }catch(e){}
  return null;
}
function num(n){
  try{
    var f = coreRef('fmtN');
    if(f) return String(f(n || 0));
  }catch(e){}
  n = n || 0;
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'к' : String(n);
}
function toast(t){
  try{ if(typeof window.toast === 'function'){ window.toast(t); return; } }catch(e){}
  try{ console.log('[reels]', t); }catch(e){}
}
function haptic(kind){
  try{ if(typeof window.okoHaptic === 'function') window.okoHaptic(kind || 'impact'); }catch(e){}
}
function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
function lsSet(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }
function lsJson(k){ try{ return JSON.parse(localStorage.getItem(k) || '{}') || {}; }catch(e){ return {}; } }
function reduceMotion(){
  try{ return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch(e){ return false; }
}
/* иконка из общего спрайта приложения */
function ic(name, cls){
  return '<svg class="okr-i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
}
/* похоже ли значение на ссылку на медиа (а не на «1:24» или «3/5») */
function isUrl(v){
  if(!v) return false;
  v = String(v);
  if(/^\d+[:/]\d+$/.test(v)) return false;                  /* «1:24» и «3/5» — не ссылки */
  return /^(https?:|data:|blob:|\/\/|\/|\.\/)/.test(v) ||
         /\.(mp4|webm|mov|m4v|m3u8|ogv|jpe?g|png|webp|avif|gif)(\?|#|$)/i.test(v);
}
function isVideoUrl(v){
  if(!isUrl(v)) return false;
  if(/\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i.test(String(v))) return false;
  return true;
}
function pick(){
  for(var i = 0; i < arguments.length; i++){
    var v = arguments[i];
    if(v != null && String(v).trim() !== '') return String(v);
  }
  return '';
}

/* ---------------------------------------------------------------------------
   1. ИСТОЧНИК КЛИПОВ
   Порядок: window.CLIPS → посты POSTS.rec/POSTS.sub с media/video → [].
   Модель клипа:
   {id, src, poster, author, nick, avatar, caption, sound,
    likes, comments, saves, liked, saved}
   --------------------------------------------------------------------------- */
function normalize(raw, i){
  if(!raw || typeof raw !== 'object') return null;

  var src = pick(raw.src, raw.video, raw.videoUrl, raw.video_url, raw.url, raw.mp4);
  if(!isVideoUrl(src)) src = '';
  /* media может быть и ссылкой на ролик, и просто длительностью «1:24» */
  if(!src && isVideoUrl(raw.media)) src = String(raw.media);

  var poster = pick(raw.poster, raw.cover, raw.thumb, raw.thumbnail, raw.preview, raw.img, raw.image);
  if(!isUrl(poster)) poster = '';

  var avatar = pick(raw.avatar, raw.avatarUrl, raw.photo, raw.pic);
  if(!isUrl(avatar)) avatar = '';

  var author = pick(raw.author, raw.name, raw.title, 'Автор OKO');
  var letter = pick(raw.ava, author).trim().charAt(0).toUpperCase() || 'O';

  var cmts = raw.comments;
  if(Array.isArray(cmts)) cmts = cmts.length;
  cmts = +cmts || 0;

  return {
    id:       (raw.id != null ? raw.id : 'okr-' + i),
    src:      src,
    poster:   poster,
    author:   author,
    nick:     pick(raw.nick, raw.username, raw.handle, raw.sub, ''),
    avatar:   avatar,
    letter:   letter,
    caption:  pick(raw.caption, raw.body, raw.text, raw.txt, ''),
    sound:    pick(raw.sound, raw.music, raw.audio, 'Оригинальный звук · ' + author),
    likes:    +raw.likes || 0,
    comments: cmts,
    saves:    +raw.saves || 0,
    liked:    !!raw.liked,
    saved:    !!raw.saved,
    topic:    pick(raw.topic, '')
  };
}

function okoClipsSource(){
  try{
    /* 1 — явный внешний массив клипов */
    if(Array.isArray(window.CLIPS)){
      var out = [];
      for(var i = 0; i < window.CLIPS.length; i++){
        var c = normalize(window.CLIPS[i], i);
        if(c) out.push(c);
      }
      return out;
    }

    /* 2 — посты ленты с медиа */
    var P = window.POSTS;
    if(P && (Array.isArray(P.rec) || Array.isArray(P.sub))){
      var seen = {}, res = [], j = 0;

      /* сначала — порядок, в котором лента реально отрисована (живое ранжирование) */
      var dom = document.querySelectorAll('#feedList article.post');
      for(var d = 0; d < dom.length; d++){
        var pid = pidOfCard(dom[d]);
        var p = (pid != null) ? corePost(pid) : null;
        if(p && hasClip(p) && !seen[p.id]){ seen[p.id] = 1; var n1 = normalize(p, j++); if(n1) res.push(n1); }
      }
      /* добор из модели */
      var all = [].concat(Array.isArray(P.rec) ? P.rec : [], Array.isArray(P.sub) ? P.sub : []);
      for(var k = 0; k < all.length; k++){
        var q = all[k];
        if(q && hasClip(q) && !seen[q.id]){ seen[q.id] = 1; var n2 = normalize(q, j++); if(n2) res.push(n2); }
      }
      return res;
    }
  }catch(e){}
  return [];
}

/* пост считается клипом: есть видео-ссылка ИЛИ media-маркер, но НЕ фото-карусель «N/M» */
function hasClip(p){
  try{
    if(isVideoUrl(p.src) || isVideoUrl(p.video) || isVideoUrl(p.videoUrl) || isVideoUrl(p.media)) return true;
    if(p.media && !/^\d+\/\d+$/.test(String(p.media))) return true;   /* «1:24» — видео-тизер */
  }catch(e){}
  return false;
}

/* id поста по карточке ленты */
function pidOfCard(art){
  try{
    var a = art.getAttribute && art.getAttribute('data-pid');
    if(a != null && a !== '') return +a;
    var b = art.querySelector && art.querySelector('.post-more');
    var m = b && (b.getAttribute('onclick') || '').match(/openPostMenu\((\d+)/);
    return m ? +m[1] : null;
  }catch(e){ return null; }
}

/* ---------------------------------------------------------------------------
   2. СТИЛИ (инъекция, префикс .okr-)
   --------------------------------------------------------------------------- */
var CSS = [
/* старая сторис-оболочка выключена, но не удалена */
'#faReels{display:none!important}',

/* Плеер намеренно всегда тёмный — как у Reels, Shorts и TikTok: под видео
   светлая подложка не нужна ни в одной теме. Поэтому чёрный и белый тут
   заданы прямо, а единственный бренд-цвет живёт в переменных: --lime для
   сплошной заливки и --okr-lime-rgb для полупрозрачных слоёв. */
'.okr{--okr-lime-rgb:154,255,0;',
'  position:fixed;left:0;top:0;width:100%;height:100%;z-index:39;background:#000;color:#fff;',
'  font-family:var(--font-body);-webkit-tap-highlight-color:transparent;',
'  display:flex;align-items:center;justify-content:center;contain:layout paint;isolation:isolate}',
'.okr[hidden]{display:none!important}',
'.okr.okr-in{animation:okr-open .26s cubic-bezier(.22,.9,.36,1)}',
'@keyframes okr-open{from{opacity:0;transform:scale(1.02)}to{opacity:1;transform:none}}',

/* сцена: на телефоне — весь экран, на ПК — колонка 9:16 по центру */
'.okr-stage{position:relative;width:100%;height:100%;background:#000;overflow:hidden;',
'  transition:transform .22s cubic-bezier(.22,.9,.36,1)}',
'.okr.okr-dragging .okr-stage{transition:none}',

/* лента слайдов — НАТИВНЫЙ скролл со снапом */
'.okr-scroll{position:absolute;inset:0;overflow-y:auto;overflow-x:hidden;',
'  scroll-snap-type:y mandatory;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;',
'  scrollbar-width:none;-ms-overflow-style:none;outline:none}',
'.okr-scroll::-webkit-scrollbar{width:0;height:0;display:none}',

'.okr-slide{position:relative;width:100%;height:100%;overflow:hidden;background:#000;',
'  scroll-snap-align:start;scroll-snap-stop:always;contain:layout paint}',

/* видео на весь экран */
'.okr-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;background:#000}',
'.okr-poster{position:absolute;inset:0;background-position:center;background-size:cover;background-repeat:no-repeat}',
'.okr-fallback{position:absolute;inset:0;background:linear-gradient(160deg,var(--okr-g1,#16240a),var(--okr-g2,#04060a) 74%)}',
'.okr-fallback::before{content:"";position:absolute;inset:0;',
'  background:radial-gradient(130% 80% at 50% -6%,rgba(var(--okr-lime-rgb),.18),transparent 56%)}',
'.okr-fallback::after{content:"";position:absolute;inset:0;opacity:.45;',
'  background:repeating-linear-gradient(122deg,transparent 0,transparent 26px,rgba(var(--okr-lime-rgb),.03) 27px,transparent 28px)}',
/* мягкий знак «медиа» на пустом кадре — без крупного текста */
'.okr-nomedia{position:absolute;left:50%;top:46%;transform:translate(-50%,-50%);z-index:2;',
'  width:74px;height:74px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
'  color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.22)}',
'.okr-nomedia .okr-i{width:30px;height:30px}',

/* затемнения для читаемости */
'.okr-scrim{position:absolute;left:0;right:0;bottom:0;height:46%;z-index:3;pointer-events:none;',
'  background:linear-gradient(to top,rgba(0,0,0,.82),rgba(0,0,0,.3) 48%,transparent)}',
'.okr-scrim.top{top:0;bottom:auto;height:20%;background:linear-gradient(to bottom,rgba(0,0,0,.55),transparent)}',

/* зона тапа: одиночный — пауза/плей, двойной — лайк */
'.okr-tap{position:absolute;inset:0;z-index:4;border:0;padding:0;margin:0;background:transparent;',
'  cursor:pointer;display:block;color:inherit;font:inherit}',
'.okr-big{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.7);z-index:5;',
'  width:88px;height:88px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
'  color:#fff;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.16);',
'  backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);',
'  opacity:0;pointer-events:none;transition:opacity .16s,transform .16s}',
'.okr-big .okr-i{width:36px;height:36px;fill:currentColor;stroke:none}',
'.okr-slide.okr-show-big .okr-big{opacity:1;transform:translate(-50%,-50%) scale(1)}',

/* двойной тап — сердце в точке касания */
'.okr-heart{position:absolute;z-index:7;pointer-events:none;color:var(--lime);',
'  filter:drop-shadow(0 10px 26px rgba(var(--okr-lime-rgb),.55));',
'  animation:okr-heart .8s cubic-bezier(.2,.9,.3,1.35) forwards}',
'.okr-heart .okr-i{width:104px;height:104px;fill:var(--lime);stroke:none}',
'@keyframes okr-heart{',
'  0%{opacity:0;transform:translate(-50%,-50%) scale(.2) rotate(-16deg)}',
'  24%{opacity:1;transform:translate(-50%,-50%) scale(1.18) rotate(7deg)}',
'  50%{transform:translate(-50%,-50%) scale(.95) rotate(-2deg)}',
'  78%{opacity:1;transform:translate(-50%,-50%) scale(1.04)}',
'  100%{opacity:0;transform:translate(-50%,-50%) scale(1.35) translateY(-18px)}}',

/* ---- правый рельс действий ---- */
'.okr-rail{position:absolute;right:calc(var(--oko-safe-right) + 8px);z-index:6;',
'  bottom:calc(var(--oko-safe-bottom) + 22px);display:flex;flex-direction:column;align-items:center;gap:15px}',
'.okr-act{display:flex;flex-direction:column;align-items:center;gap:4px;background:transparent;',
'  border:0;padding:0;color:#fff;cursor:pointer;font-family:var(--font-body);',
'  transition:transform .12s;-webkit-tap-highlight-color:transparent}',
'.okr-act:active{transform:scale(.88)}',
'.okr-act .okr-bub{display:flex;align-items:center;justify-content:center;width:46px;height:46px;',
'  border-radius:50%;background:rgba(0,0,0,.34);border:1px solid rgba(255,255,255,.13);',
'  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
'  transition:background .18s,border-color .18s}',
'.okr-act .okr-bub .okr-i{width:23px;height:23px;transition:transform .16s}',
'.okr-act b{font-size:11.5px;font-weight:700;letter-spacing:.01em;font-variant-numeric:tabular-nums;',
'  text-shadow:0 2px 8px rgba(0,0,0,.65);line-height:1.1}',
'.okr-act:hover .okr-bub{border-color:rgba(var(--okr-lime-rgb),.42)}',
'.okr-act:hover .okr-bub .okr-i{transform:scale(1.08)}',
'.okr-act:focus-visible .okr-bub{outline:2px solid var(--lime);outline-offset:2px}',
'.okr-act.on .okr-bub{background:rgba(var(--okr-lime-rgb),.16);border-color:rgba(var(--okr-lime-rgb),.5)}',
'.okr-act.on .okr-bub .okr-i{fill:var(--lime);stroke:none;color:var(--lime)}',
'.okr-act.on b{color:var(--lime)}',
'.okr-act.okr-pop .okr-bub .okr-i{animation:okr-pop .42s cubic-bezier(.2,.9,.3,1.5)}',
'@keyframes okr-pop{0%{transform:scale(1)}32%{transform:scale(1.45)}62%{transform:scale(.92)}100%{transform:scale(1)}}',

/* ---- низ слайда: автор, подпись, звук ---- */
'.okr-info{position:absolute;z-index:5;left:calc(var(--oko-safe-left) + 15px);',
'  right:calc(var(--oko-safe-right) + 78px);bottom:calc(var(--oko-safe-bottom) + 18px);',
'  display:flex;flex-direction:column;gap:8px;pointer-events:none}',
'.okr-info>*{pointer-events:auto}',
'.okr-auth{display:flex;align-items:center;gap:9px;min-width:0}',
'.okr-ava{width:36px;height:36px;border-radius:50%;flex:none;overflow:hidden;display:flex;',
'  align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#000;',
'  background:var(--lime);box-shadow:0 3px 12px rgba(var(--okr-lime-rgb),.28)}',
'.okr-ava img{width:100%;height:100%;object-fit:cover;display:block}',
'.okr-who{min-width:0;display:flex;flex-direction:column;gap:1px}',
'.okr-nm{font-size:14px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;',
'  text-overflow:ellipsis;max-width:46vw}',
'.okr-nick{font-size:11px;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.okr-follow{flex:none;font-size:11.5px;font-weight:700;color:#000;background:var(--lime);border:0;',
'  border-radius:99px;padding:6px 13px;cursor:pointer;font-family:var(--font-body);',
'  transition:transform .12s,background .18s,color .18s}',
'.okr-follow:active{transform:scale(.93)}',
'.okr-follow:focus-visible{outline:2px solid var(--lime);outline-offset:2px}',
'.okr-follow.on{color:#fff;background:rgba(255,255,255,.14);box-shadow:inset 0 0 0 1px rgba(255,255,255,.26)}',

'.okr-cap{font-size:13px;line-height:1.5;color:rgba(255,255,255,.93);cursor:pointer;',
'  overflow-wrap:anywhere;word-break:break-word;',
'  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
'.okr-cap.okr-open{display:block;-webkit-line-clamp:unset;max-height:38vh;overflow-y:auto;',
'  overscroll-behavior:contain}',
'.okr-cap .okr-more{color:rgba(255,255,255,.58);font-weight:700}',

'.okr-sound{display:flex;align-items:center;gap:8px;font-size:12px;color:rgba(255,255,255,.86);',
'  min-width:0;max-width:100%}',
'.okr-sound .okr-i{width:14px;height:14px;flex:none;color:var(--lime)}',
'.okr-mqw{flex:1;min-width:0;overflow:hidden;',
'  -webkit-mask-image:linear-gradient(90deg,transparent,#000 10px,#000 calc(100% - 18px),transparent);',
'  mask-image:linear-gradient(90deg,transparent,#000 10px,#000 calc(100% - 18px),transparent)}',
'.okr-mq{display:inline-flex;white-space:nowrap;will-change:transform;',
'  animation:okr-mq 18s linear infinite;animation-play-state:paused}',
'.okr-slide.is-on .okr-mq{animation-play-state:running}',
'.okr-mq i{font-style:normal;padding-right:34px}',
/* название звука влезло целиком — бегущую строку не гоняем, дубль и маску убираем */
'.okr-mq.okr-static{animation:none!important;will-change:auto;max-width:100%}',
'.okr-mq.okr-static i{padding-right:0;overflow:hidden;text-overflow:ellipsis}',
'.okr-mqw.okr-fit{flex:0 1 auto;-webkit-mask-image:none;mask-image:none}',
'@keyframes okr-mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}',
/* мини-эквалайзер */
'.okr-eq{display:inline-flex;align-items:flex-end;gap:2px;height:12px;flex:none}',
'.okr-eq i{width:2.5px;height:100%;border-radius:2px;background:var(--lime);transform-origin:bottom;',
'  transform:scaleY(.3);animation:okr-eq 1s ease-in-out infinite;animation-play-state:paused}',
'.okr-eq i:nth-child(2){animation-delay:.22s}',
'.okr-eq i:nth-child(3){animation-delay:.44s}',
'.okr-slide.is-on .okr-eq i{animation-play-state:running}',
'.okr.okr-paused .okr-slide.is-on .okr-eq i,.okr.okr-paused .okr-slide.is-on .okr-mq{animation-play-state:paused}',
'@keyframes okr-eq{0%,100%{transform:scaleY(.26)}50%{transform:scaleY(1)}}',

/* ---- верх: прогресс + закрыть + звук ---- */
'.okr-chrome{position:absolute;left:0;right:0;top:0;z-index:8;pointer-events:none;',
'  padding:calc(var(--oko-safe-top) + 8px) calc(var(--oko-safe-right) + 12px) 0 calc(var(--oko-safe-left) + 12px)}',
'.okr-prog{height:3px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden}',
'.okr-prog i{display:block;width:100%;height:100%;border-radius:3px;background:var(--lime);',
'  transform-origin:left;transform:scaleX(0);will-change:transform}',
'.okr-prog.okr-idle{opacity:.35}',
'.okr-bar{display:flex;align-items:center;gap:10px;margin-top:9px;pointer-events:auto}',
'.okr-rnd{width:38px;height:38px;flex:none;display:flex;align-items:center;justify-content:center;',
'  border-radius:50%;color:#fff;background:rgba(0,0,0,.36);border:1px solid rgba(255,255,255,.13);',
'  backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer;padding:0;',
'  transition:background .18s,transform .12s}',
'.okr-rnd .okr-i{width:19px;height:19px}',
'.okr-rnd:hover{background:rgba(0,0,0,.55)}',
'.okr-rnd:active{transform:scale(.9)}',
'.okr-rnd:focus-visible{outline:2px solid var(--lime);outline-offset:2px}',
'.okr-sp{flex:1}',

/* ---- стрелки для ПК (лежат ВНЕ колонки 9:16, у правого края экрана) ---- */
'.okr-arrows{position:absolute;right:calc(var(--oko-safe-right) + 20px);top:50%;',
'  transform:translateY(-50%);z-index:10;display:none;flex-direction:column;gap:12px}',
'.okr-arrows .okr-rnd{width:44px;height:44px;background:rgba(255,255,255,.08)}',
'.okr-arrows .okr-rnd .okr-i{width:20px;height:20px}',
'.okr-arrows .okr-rnd[disabled]{opacity:.3;cursor:default}',
'.okr-up .okr-i{transform:rotate(90deg)}',
'.okr-down .okr-i{transform:rotate(-90deg)}',

/* ---- пустое состояние (ниже верхнего хрома: крестик обязан быть кликабельным) ---- */
'.okr-empty{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;',
'  align-items:center;justify-content:center;text-align:center;gap:14px;',
'  padding:calc(var(--oko-safe-top) + 60px) 30px calc(var(--oko-safe-bottom) + 40px);',
'  background:radial-gradient(120% 70% at 50% 8%,rgba(var(--okr-lime-rgb),.13),transparent 58%),#000}',
'.okr-empty-ic{width:78px;height:78px;border-radius:50%;display:flex;align-items:center;justify-content:center;',
'  color:var(--lime);border:1px solid rgba(var(--okr-lime-rgb),.32);background:rgba(var(--okr-lime-rgb),.07)}',
'.okr-empty-ic .okr-i{width:34px;height:34px}',
'.okr-empty h3{font-family:var(--font-display);font-weight:400;letter-spacing:.02em;',
'  font-size:clamp(26px,7vw,34px);line-height:1.05;color:#fff;text-transform:uppercase;margin:2px 0 0}',
'.okr-empty p{font-size:13.5px;line-height:1.55;color:rgba(255,255,255,.62);max-width:30ch;margin:0}',
'.okr-empty button{margin-top:6px;font-family:var(--font-body);font-size:13.5px;font-weight:700;color:#000;',
'  background:var(--lime);border:0;border-radius:99px;padding:12px 26px;cursor:pointer;',
'  box-shadow:0 8px 26px rgba(var(--okr-lime-rgb),.3);transition:transform .12s}',
'.okr-empty button:active{transform:scale(.95)}',
'.okr-empty button:focus-visible{outline:2px solid #fff;outline-offset:3px}',
/* на пустом экране прогресс, звук и стрелки не нужны — остаётся крестик */
'.okr.okr-blank .okr-prog,.okr.okr-blank .okr-snd{display:none}',
'.okr.okr-blank .okr-arrows{display:none!important}',

/* базовая геометрия иконок спрайта */
'.okr-i{width:1.25em;height:1.25em;fill:none;stroke:currentColor;stroke-width:7;',
'  stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;display:block}',
'.okr-i.fill{fill:currentColor;stroke:none}',

/* блокировка фона, пока плеер открыт */
'html.okr-lock,html.okr-lock body{overflow:hidden!important;overscroll-behavior:none}',

/* ---- планшет / ПК: колонка 9:16 по центру на затемнённом фоне ---- */
'@media (min-width:760px) and (min-height:520px){',
'  .okr{background:rgba(0,0,0,.93);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);padding:22px}',
'  .okr-stage{height:min(100%,820px);width:auto;aspect-ratio:9/16;max-width:calc(100vw - 44px);',
'    border-radius:20px;box-shadow:0 34px 90px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.08)}',
/* запасной вариант для браузеров без aspect-ratio */
'  @supports not (aspect-ratio:9/16){',
'    .okr-stage{width:min(calc((100vh - 44px) * 0.5625),430px);height:min(calc(100vh - 44px),764px)}',
'  }',
'  .okr-arrows{display:flex}',
'  .okr-rail{right:10px}',
'  .okr-info{left:16px;right:84px}',
'}',

/* уважение к «меньше движения» */
'@media (prefers-reduced-motion: reduce){',
'  .okr.okr-in{animation:none}',
'  .okr-mq,.okr-eq i{animation:none!important}',
'  .okr-heart{animation-duration:.35s}',
'  .okr-scroll{scroll-behavior:auto}',
'}'
].join('\n');

function injectCss(){
  try{
    if(document.getElementById('okr-css')) return;
    var st = document.createElement('style');
    st.id = 'okr-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }catch(e){}
}

/* ---------------------------------------------------------------------------
   3. СОСТОЯНИЕ
   --------------------------------------------------------------------------- */
var S = {
  open: false,
  clips: [],
  idx: 0,
  root: null,
  stage: null,
  scroll: null,
  progFill: null,
  progWrap: null,
  soundBtn: null,
  upBtn: null,
  downBtn: null,
  io: null,
  keyH: null,
  resizeH: null,
  sound: false,          /* включён ли звук */
  soundDecided: false,   /* человек уже решал про звук */
  wheelLock: 0,
  lastTap: 0, lastX: 0, lastY: 0, tapTimer: 0,
  bigTimer: 0,
  drag: null,
  restoreFocus: null
};

/* бренд-градиенты запасного кадра */
var GRAD = {
  ai:       ['#16240a', '#04060a'],
  content:  ['#1c2708', '#050703'],
  business: ['#122011', '#03060a'],
  marketing:['#231d07', '#060404'],
  games:    ['#0d2216', '#03070a'],
  crypto:   ['#0a1f28', '#04060a']
};
function gradOf(c){
  var g = GRAD[c && c.topic] || null;
  if(!g){
    var keys = Object.keys(GRAD);
    var h = String(c && c.id != null ? c.id : '0');
    var s = 0; for(var i = 0; i < h.length; i++) s += h.charCodeAt(i);
    g = GRAD[keys[s % keys.length]];
  }
  return '--okr-g1:' + g[0] + ';--okr-g2:' + g[1];
}

/* ---------------------------------------------------------------------------
   4. РАЗМЕТКА
   --------------------------------------------------------------------------- */
function buildRoot(){
  if(S.root) return S.root;
  injectCss();

  var r = document.createElement('div');
  r.id = 'okoReels';
  r.className = 'okr';
  r.hidden = true;
  r.setAttribute('role', 'dialog');
  r.setAttribute('aria-modal', 'true');
  r.setAttribute('aria-label', 'Клипы');
  r.setAttribute('aria-hidden', 'true');

  r.innerHTML =
    '<div class="okr-stage">' +
      '<div class="okr-scroll" tabindex="-1"></div>' +
      '<div class="okr-chrome">' +
        '<div class="okr-prog okr-idle"><i></i></div>' +
        '<div class="okr-bar">' +
          '<button class="okr-rnd okr-x" type="button" aria-label="Закрыть клипы">' +
            '<svg class="okr-i" viewBox="0 0 100 100" aria-hidden="true"><path d="M26 26l48 48M74 26L26 74"/></svg>' +
          '</button>' +
          '<span class="okr-sp"></span>' +
          '<button class="okr-rnd okr-snd" type="button" aria-label="Включить звук" aria-pressed="false">' +
            '<svg class="okr-i" viewBox="0 0 100 100" aria-hidden="true">' +
              '<path d="M20 38h14l18-16v56L34 62H20z"/><path class="okr-snd-off" d="M66 38l20 24M86 38L66 62"/>' +
              '<path class="okr-snd-on" d="M66 36a20 20 0 0 1 0 28M76 26a34 34 0 0 1 0 48"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="okr-arrows">' +
      '<button class="okr-rnd okr-up" type="button" aria-label="Предыдущий клип">' + ic('back') + '</button>' +
      '<button class="okr-rnd okr-down" type="button" aria-label="Следующий клип">' + ic('back') + '</button>' +
    '</div>';

  document.body.appendChild(r);

  S.root     = r;
  S.stage    = r.querySelector('.okr-stage');
  S.scroll   = r.querySelector('.okr-scroll');
  S.progWrap = r.querySelector('.okr-prog');
  S.progFill = r.querySelector('.okr-prog i');
  S.soundBtn = r.querySelector('.okr-snd');
  S.upBtn    = r.querySelector('.okr-up');
  S.downBtn  = r.querySelector('.okr-down');

  wire();
  return r;
}

/* внутренности слайда (монтируются только для текущего ±2) */
function slideInner(c){
  var media;
  if(c.src){
    media = '<video class="okr-video" playsinline webkit-playsinline muted loop preload="metadata" ' +
            'disablepictureinpicture disableremoteplayback' +
            (c.poster ? ' poster="' + attr(c.poster) + '"' : '') +
            ' src="' + attr(c.src) + '"></video>';
  }else if(c.poster){
    media = '<div class="okr-poster" style="background-image:url(&quot;' + attr(c.poster) + '&quot;)"></div>';
  }else{
    media = '<div class="okr-fallback"></div><div class="okr-nomedia">' + ic('circle-play') + '</div>';
  }

  var ava = c.avatar
    ? '<span class="okr-ava"><img src="' + attr(c.avatar) + '" alt="" loading="lazy"></span>'
    : '<span class="okr-ava">' + esc(c.letter) + '</span>';

  var following = !!lsJson(LS_FOLLOW)[c.nick || c.author];
  /* «@ник» ставим только если это правда ник, а не подпись вида «2 ч · 1.2к» */
  var nick = '';
  if(c.nick){
    nick = /^@?[\w.\-]{2,32}$/.test(String(c.nick)) ? ('@' + String(c.nick).replace(/^@/, '')) : String(c.nick);
  }
  var snd = c.sound || 'Оригинальный звук';

  return (
    media +
    '<div class="okr-scrim top"></div><div class="okr-scrim"></div>' +

    '<button class="okr-tap" type="button" aria-label="Пауза или воспроизведение"></button>' +
    '<span class="okr-big" aria-hidden="true">' + ic('play', 'fill') + '</span>' +

    '<div class="okr-rail">' +
      '<button class="okr-act okr-a-like' + (c.liked ? ' on' : '') + '" type="button" ' +
        'aria-label="Нравится" aria-pressed="' + (c.liked ? 'true' : 'false') + '">' +
        '<span class="okr-bub">' + ic('heart') + '</span><b class="okr-n-like">' + num(c.likes) + '</b></button>' +
      '<button class="okr-act okr-a-cmt" type="button" aria-label="Комментарии">' +
        '<span class="okr-bub">' + ic('comment') + '</span><b class="okr-n-cmt">' + num(c.comments) + '</b></button>' +
      '<button class="okr-act okr-a-share" type="button" aria-label="Поделиться клипом">' +
        '<span class="okr-bub">' + ic('share') + '</span></button>' +
      '<button class="okr-act okr-a-save' + (c.saved ? ' on' : '') + '" type="button" ' +
        'aria-label="Сохранить" aria-pressed="' + (c.saved ? 'true' : 'false') + '">' +
        '<span class="okr-bub">' + ic('bookmark') + '</span><b class="okr-n-save">' + num(c.saves) + '</b></button>' +
      '<button class="okr-act okr-a-more" type="button" aria-label="Другие действия">' +
        '<span class="okr-bub">' + ic('more') + '</span></button>' +
    '</div>' +

    '<div class="okr-info">' +
      '<div class="okr-auth">' + ava +
        '<span class="okr-who"><span class="okr-nm">' + esc(c.author) + '</span>' +
        (nick ? '<span class="okr-nick">' + esc(nick) + '</span>' : '') + '</span>' +
        '<button class="okr-follow' + (following ? ' on' : '') + '" type="button" ' +
          'aria-pressed="' + (following ? 'true' : 'false') + '" ' +
          'aria-label="' + (following ? 'Отписаться' : 'Подписаться') + '">' +
          (following ? 'Вы подписаны' : 'Подписаться') + '</button>' +
      '</div>' +
      (c.caption
        ? '<div class="okr-cap" role="button" tabindex="0" aria-label="Развернуть описание">' +
            esc(c.caption) + '<span class="okr-more"> ещё</span></div>'
        : '') +
      '<div class="okr-sound">' + ic('mic') +
        '<span class="okr-mqw"><span class="okr-mq"><i>' + esc(snd) + '</i><i>' + esc(snd) + '</i></span></span>' +
        '<span class="okr-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '</div>' +
    '</div>'
  );
}

function emptyHTML(){
  return '<div class="okr-empty">' +
    '<span class="okr-empty-ic">' + ic('circle-play') + '</span>' +
    '<h3>Клипов пока нет</h3>' +
    '<p>Как только авторы выложат первые клипы, они появятся здесь</p>' +
    '<button class="okr-to-feed" type="button">В ленту</button>' +
  '</div>';
}

/* ---------------------------------------------------------------------------
   5. ВИРТУАЛИЗАЦИЯ + ВОСПРОИЗВЕДЕНИЕ
   --------------------------------------------------------------------------- */
var WINDOW_N = 2;   /* текущий ±2 */

function slideAt(i){
  try{ return S.scroll.children[i] || null; }catch(e){ return null; }
}

function mount(i){
  var el = slideAt(i);
  if(!el || el.dataset.mounted === '1') return;
  var c = S.clips[i];
  if(!c) return;
  el.innerHTML = slideInner(c);
  el.dataset.mounted = '1';
  fitMarquee(el);
  var v = el.querySelector('video');
  if(v){
    v.muted = !S.sound;
    v.volume = 1;
    v.addEventListener('timeupdate', onTimeUpdate);
    v.addEventListener('loadedmetadata', onTimeUpdate);
    v.addEventListener('error', function(){
      try{
        /* видео не открылось — падаем на постер/градиент, но без крупного текста */
        v.remove();
        var fb = document.createElement('div');
        fb.className = c.poster ? 'okr-poster' : 'okr-fallback';
        if(c.poster) fb.style.backgroundImage = 'url("' + c.poster + '")';
        el.insertBefore(fb, el.firstChild);
        if(!c.poster){
          var nm = document.createElement('div');
          nm.className = 'okr-nomedia';
          nm.innerHTML = ic('circle-play');
          el.insertBefore(nm, fb.nextSibling);
        }
        /* полосу гасим только если сломался ИМЕННО текущий слайд:
           соседи монтируются заранее и не должны сбивать прогресс */
        if(el.classList.contains('is-on')) setProg(0, true);
      }catch(e2){}
    });
  }
}

/* бегущая строка звука нужна, только если название не влезает целиком */
function fitMarquee(el){
  try{
    var mq = el.querySelector('.okr-mq');
    if(!mq) return;
    requestAnimationFrame(function(){
      try{
        var wrap = mq.parentNode, one = mq.firstElementChild;
        if(!wrap || !one) return;
        var textW = one.offsetWidth - 34;          /* минус хвостовой отступ между копиями */
        if(textW <= wrap.clientWidth){
          mq.classList.add('okr-static');
          wrap.classList.add('okr-fit');       /* без маски — первая буква не должна таять */
          if(mq.children[1]) mq.children[1].remove();
        }
      }catch(e){}
    });
  }catch(e){}
}

function unmount(i){
  var el = slideAt(i);
  if(!el || el.dataset.mounted !== '1') return;
  var v = el.querySelector('video');
  if(v){
    try{ v.pause(); }catch(e){}
    try{ v.removeAttribute('src'); v.load(); }catch(e){}
  }
  el.innerHTML = '';
  el.dataset.mounted = '0';
  el.classList.remove('is-on', 'okr-show-big');
}

function syncWindow(center){
  var n = S.clips.length;
  for(var i = 0; i < n; i++){
    if(Math.abs(i - center) <= WINDOW_N) mount(i);
    else unmount(i);
  }
}

function activeVideo(){
  var el = slideAt(S.idx);
  return el ? el.querySelector('video') : null;
}

/* остановить и разгрузить все видео плеера (закрытие и пересборка списка) */
function stopAllVideo(){
  try{
    var vids = S.scroll ? S.scroll.querySelectorAll('video') : [];
    for(var i = 0; i < vids.length; i++){
      try{ vids[i].pause(); vids[i].removeAttribute('src'); vids[i].load(); }catch(e){}
    }
  }catch(e){}
}

function setActive(i, force){
  if(!S.open) return;
  if(i === S.idx && !force && slideAt(i) && slideAt(i).classList.contains('is-on')) return;
  S.idx = i;
  syncWindow(i);

  var kids = S.scroll.children;
  for(var k = 0; k < kids.length; k++){
    var el = kids[k];
    var v = el.querySelector && el.querySelector('video');
    if(k === i){
      el.classList.add('is-on');
      if(v){
        v.muted = !S.sound;
        var pr = v.play();
        if(pr && pr.catch) pr.catch(function(){ /* автоплей заблокирован — молчим */ });
      }
    }else{
      el.classList.remove('is-on', 'okr-show-big');
      if(v){
        try{ v.pause(); v.currentTime = 0; }catch(e){}
      }
    }
  }
  S.root.classList.remove('okr-paused');
  setProg(0, !activeVideo());
  updateArrows();
}

function onTimeUpdate(ev){
  try{
    var v = ev.currentTarget || ev.target;
    if(v !== activeVideo()) return;
    var d = v.duration;
    if(!d || !isFinite(d) || d <= 0){ setProg(0, true); return; }
    setProg(Math.min(1, v.currentTime / d), false);
  }catch(e){}
}

function setProg(p, idle){
  try{
    if(S.progFill) S.progFill.style.transform = 'scaleX(' + (p || 0) + ')';
    if(S.progWrap) S.progWrap.classList.toggle('okr-idle', !!idle);
  }catch(e){}
}

function togglePlay(){
  var v = activeVideo();
  var el = slideAt(S.idx);
  if(!el) return;
  var big = el.querySelector('.okr-big');
  if(!v){
    /* без видео — просто короткая подсказка иконкой */
    flashBig(el, big, 'play');
    return;
  }
  if(v.paused){
    var pr = v.play(); if(pr && pr.catch) pr.catch(function(){});
    S.root.classList.remove('okr-paused');
    flashBig(el, big, 'play');
  }else{
    try{ v.pause(); }catch(e){}
    S.root.classList.add('okr-paused');
    flashBig(el, big, 'pause');
  }
  haptic('selection');
}

function flashBig(el, big, name){
  try{
    if(big) big.innerHTML = ic(name, 'fill');
    el.classList.add('okr-show-big');
    clearTimeout(S.bigTimer);
    S.bigTimer = setTimeout(function(){
      try{ el.classList.remove('okr-show-big'); }catch(e){}
    }, 400);
  }catch(e){}
}

/* ---------------------------------------------------------------------------
   6. ДЕЙСТВИЯ (лайк/коммент/шер/сейв/ещё/подписка)
   --------------------------------------------------------------------------- */
function corePost(id){
  try{
    var f = coreRef('postById');
    if(f) return f(id) || null;
  }catch(e){}
  return null;
}

function doLike(i, viaDoubleTap){
  var c = S.clips[i]; if(!c) return;
  var el = slideAt(i); if(!el) return;
  var btn = el.querySelector('.okr-a-like');

  if(viaDoubleTap && c.liked) { pulse(btn); return; }   /* двойной тап не снимает лайк */

  var p = corePost(c.id);
  var fLike = p ? coreRef('likePost') : null;
  if(fLike){
    try{ fLike(c.id); }catch(e){}
    c.liked = !!p.liked;
    c.likes = +p.likes || 0;
  }else{
    c.liked = !c.liked;
    c.likes = Math.max(0, c.likes + (c.liked ? 1 : -1));
  }

  if(btn){
    btn.classList.toggle('on', c.liked);
    btn.setAttribute('aria-pressed', c.liked ? 'true' : 'false');
    var n = btn.querySelector('.okr-n-like'); if(n) n.textContent = num(c.likes);
    pulse(btn);
  }
  haptic(c.liked ? 'success' : 'selection');
}

function pulse(btn){
  if(!btn) return;
  btn.classList.remove('okr-pop');
  void btn.offsetWidth;
  btn.classList.add('okr-pop');
}

function doSave(i){
  var c = S.clips[i]; if(!c) return;
  var el = slideAt(i); if(!el) return;
  var btn = el.querySelector('.okr-a-save');
  var p = corePost(c.id);
  var fSave = p ? coreRef('toggleSave') : null;
  if(fSave){
    try{ fSave(c.id); }catch(e){}
    c.saved = !!p.saved;
  }else{
    c.saved = !c.saved;
    toast(c.saved ? 'Сохранено в закладки' : 'Убрано из закладок');
  }
  c.saves = Math.max(0, c.saves + (c.saved ? 1 : -1));
  if(btn){
    btn.classList.toggle('on', c.saved);
    btn.setAttribute('aria-pressed', c.saved ? 'true' : 'false');
    var n = btn.querySelector('.okr-n-save'); if(n) n.textContent = num(c.saves);
    pulse(btn);
  }
  haptic('selection');
}

function doComment(i){
  var c = S.clips[i]; if(!c) return;
  var f = corePost(c.id) ? coreRef('openComments') : null;
  if(f){
    try{ f(c.id); return; }catch(e){}
  }
  toast('Комментарии к этому клипу пока закрыты');
}

function doShare(i){
  var c = S.clips[i]; if(!c) return;
  var url = '';
  try{ url = location.origin + location.pathname + '#clip-' + c.id; }catch(e){}
  if(navigator.share){
    try{
      navigator.share({ title: c.author, text: (c.caption || '').slice(0, 140), url: url })
        .catch(function(){});
      haptic('selection');
      return;
    }catch(e){}
  }
  var fRep = corePost(c.id) ? coreRef('repost') : null;
  if(fRep){
    try{ fRep(c.id); haptic('selection'); return; }catch(e){}
  }
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(url);
      toast('Ссылка на клип скопирована');
      return;
    }
  }catch(e){}
  toast('Поделиться пока недоступно');
}

function doMore(i){
  var c = S.clips[i]; if(!c) return;
  var f = corePost(c.id) ? coreRef('openPostMenu') : null;
  if(f){
    try{ f(c.id); return; }catch(e){}
  }
  toast('Для этого клипа меню недоступно');
}

function doFollow(i, btn){
  var c = S.clips[i]; if(!c || !btn) return;
  var key = c.nick || c.author;
  var map = lsJson(LS_FOLLOW);
  var on = !map[key];
  if(on) map[key] = 1; else delete map[key];
  lsSet(LS_FOLLOW, JSON.stringify(map));
  btn.classList.toggle('on', on);
  btn.textContent = on ? 'Вы подписаны' : 'Подписаться';
  btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  btn.setAttribute('aria-label', on ? 'Отписаться' : 'Подписаться');
  haptic('selection');
  toast(on ? 'Подписались на ' + (c.author || 'автора') : 'Отписались');
}

/* ---------------------------------------------------------------------------
   7. ЗВУК
   --------------------------------------------------------------------------- */
function applySound(){
  try{
    var vids = S.scroll.querySelectorAll('video');
    for(var i = 0; i < vids.length; i++) vids[i].muted = !S.sound;
    if(S.soundBtn){
      S.soundBtn.setAttribute('aria-pressed', S.sound ? 'true' : 'false');
      S.soundBtn.setAttribute('aria-label', S.sound ? 'Выключить звук' : 'Включить звук');
      var on = S.soundBtn.querySelector('.okr-snd-on');
      var off = S.soundBtn.querySelector('.okr-snd-off');
      if(on) on.style.display = S.sound ? '' : 'none';
      if(off) off.style.display = S.sound ? 'none' : '';
    }
  }catch(e){}
}
function setSound(on, remember){
  S.sound = !!on;
  if(remember !== false){ S.soundDecided = true; lsSet(LS_SOUND, S.sound ? '1' : '0'); }
  applySound();
  /* после снятия mute браузер иногда ставит видео на паузу — возвращаем */
  var v = activeVideo();
  if(v && v.paused && !S.root.classList.contains('okr-paused')){
    var pr = v.play(); if(pr && pr.catch) pr.catch(function(){});
  }
}

/* ---------------------------------------------------------------------------
   8. НАВИГАЦИЯ ПО СЛАЙДАМ
   --------------------------------------------------------------------------- */
function goTo(i, instant){
  var n = S.clips.length; if(!n) return;
  i = Math.max(0, Math.min(n - 1, i | 0));
  var h = S.scroll.clientHeight || 1;
  if(instant || reduceMotion()){
    S.scroll.scrollTop = i * h;
    setActive(i, true);
  }else{
    try{ S.scroll.scrollTo({ top: i * h, behavior: 'smooth' }); }
    catch(e){ S.scroll.scrollTop = i * h; setActive(i, true); }
  }
}
function next(){ if(S.idx < S.clips.length - 1) goTo(S.idx + 1); }
function prev(){ if(S.idx > 0) goTo(S.idx - 1); }

function updateArrows(){
  try{
    if(S.upBtn) S.upBtn.disabled = (S.idx <= 0);
    if(S.downBtn) S.downBtn.disabled = (S.idx >= S.clips.length - 1);
  }catch(e){}
}

/* ---------------------------------------------------------------------------
   9. СОБЫТИЯ
   --------------------------------------------------------------------------- */
function wire(){
  var r = S.root;

  /* --- клики по хрому и рельсу (делегат) --- */
  r.addEventListener('click', function(e){
    try{
      var t = e.target;
      if(t.closest('.okr-x')){ close(); return; }
      if(t.closest('.okr-snd')){ setSound(!S.sound, true); return; }
      if(t.closest('.okr-up')){ prev(); return; }
      if(t.closest('.okr-down')){ next(); return; }
      if(t.closest('.okr-to-feed')){
        close();
        try{ var st = coreRef('showTab'); if(st) st('feed'); }catch(e2){}
        return;
      }

      var slide = t.closest('.okr-slide');
      var i = slide ? (+slide.dataset.i) : -1;
      if(i < 0) return;

      if(t.closest('.okr-a-like')){ doLike(i, false); return; }
      if(t.closest('.okr-a-cmt')){ doComment(i); return; }
      if(t.closest('.okr-a-share')){ doShare(i); return; }
      if(t.closest('.okr-a-save')){ doSave(i); return; }
      if(t.closest('.okr-a-more')){ doMore(i); return; }
      var fb = t.closest('.okr-follow');
      if(fb){ doFollow(i, fb); return; }
      var cap = t.closest('.okr-cap');
      if(cap){
        cap.classList.toggle('okr-open');
        cap.setAttribute('aria-label', cap.classList.contains('okr-open') ? 'Свернуть описание' : 'Развернуть описание');
        return;
      }
    }catch(err){}
  });

  /* клавиатура на подписи (доступность) */
  r.addEventListener('keydown', function(e){
    try{
      if((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('okr-cap')){
        e.preventDefault();
        e.target.classList.toggle('okr-open');
      }
    }catch(err){}
  });

  /* --- тап по видео: одиночный = пауза/плей, двойной = лайк --- */
  r.addEventListener('pointerup', function(e){
    try{
      var tap = e.target.closest && e.target.closest('.okr-tap');
      if(!tap) return;
      var slide = tap.closest('.okr-slide');
      var i = slide ? (+slide.dataset.i) : -1;
      if(i < 0) return;

      /* первое касание экрана включает звук, если человек ещё не решал */
      if(!S.soundDecided){
        setSound(true, true);
        toast('Звук включён');
        S.lastTap = 0;
        return;
      }

      var now = Date.now();
      var dx = Math.abs(e.clientX - S.lastX), dy = Math.abs(e.clientY - S.lastY);
      if(now - S.lastTap < 300 && dx < 44 && dy < 44){
        clearTimeout(S.tapTimer);
        S.lastTap = 0;
        popHeart(slide, e.clientX, e.clientY);
        doLike(i, true);
      }else{
        S.lastTap = now; S.lastX = e.clientX; S.lastY = e.clientY;
        clearTimeout(S.tapTimer);
        S.tapTimer = setTimeout(function(){ try{ togglePlay(); }catch(err){} }, 290);
      }
    }catch(err){}
  });

  /* --- свайп вниз на первом слайде = закрыть --- */
  S.scroll.addEventListener('touchstart', function(e){
    try{
      if(e.touches.length !== 1) { S.drag = null; return; }
      S.drag = { y0: e.touches[0].clientY, dy: 0, armed: (S.idx === 0 && S.scroll.scrollTop <= 0) };
    }catch(err){}
  }, { passive: true });

  S.scroll.addEventListener('touchmove', function(e){
    try{
      if(!S.drag || !S.drag.armed) return;
      var dy = e.touches[0].clientY - S.drag.y0;
      if(dy <= 0){ S.drag.dy = 0; S.stage.style.transform = ''; return; }
      if(S.scroll.scrollTop > 0){ S.drag.armed = false; S.stage.style.transform = ''; return; }
      S.drag.dy = dy;
      e.preventDefault();
      S.root.classList.add('okr-dragging');
      var k = Math.min(1, dy / 460);
      S.stage.style.transform = 'translate3d(0,' + (dy * 0.55) + 'px,0) scale(' + (1 - k * 0.06) + ')';
      S.root.style.background = 'rgba(0,0,0,' + (1 - k * 0.45) + ')';
    }catch(err){}
  }, { passive: false });

  function endDrag(){
    try{
      S.root.classList.remove('okr-dragging');
      S.root.style.background = '';
      var d = S.drag; S.drag = null;
      if(!d || !d.armed){ S.stage.style.transform = ''; return; }
      if(d.dy > 110){ S.stage.style.transform = ''; close(); }
      else S.stage.style.transform = '';
    }catch(err){}
  }
  S.scroll.addEventListener('touchend', endDrag, { passive: true });
  S.scroll.addEventListener('touchcancel', endDrag, { passive: true });

  /* --- колесо мыши: один слайд за жест --- */
  S.scroll.addEventListener('wheel', function(e){
    try{
      if(Math.abs(e.deltaY) < 12) return;
      e.preventDefault();
      var now = Date.now();
      if(now < S.wheelLock) return;
      S.wheelLock = now + 480;
      if(e.deltaY > 0) next(); else prev();
    }catch(err){}
  }, { passive: false });

  /* --- IntersectionObserver: активный слайд по видимости, а не по таймеру --- */
  try{
    if('IntersectionObserver' in window){
      S.io = new IntersectionObserver(function(entries){
        try{
          for(var i = 0; i < entries.length; i++){
            var en = entries[i];
            if(en.isIntersecting && en.intersectionRatio >= 0.6){
              var idx = +en.target.dataset.i;
              if(!isNaN(idx)) setActive(idx, false);
            }
          }
        }catch(err){}
      }, { root: S.scroll, threshold: [0, 0.6, 1] });
    }
  }catch(e){}

  /* --- скролл как запасной определитель активного (если IO нет) --- */
  if(!S.io){
    S.scroll.addEventListener('scroll', function(){
      try{
        var h = S.scroll.clientHeight || 1;
        var i = Math.round(S.scroll.scrollTop / h);
        if(i !== S.idx) setActive(i, false);
      }catch(err){}
    }, { passive: true });
  }

  /* --- ресайз / поворот: удержать текущий слайд --- */
  S.resizeH = function(){
    try{
      if(!S.open) return;
      var h = S.scroll.clientHeight || 1;
      S.scroll.scrollTop = S.idx * h;
    }catch(e){}
  };
  window.addEventListener('resize', S.resizeH);
  window.addEventListener('orientationchange', S.resizeH);

  /* --- вкладка ушла в фон — пауза --- */
  document.addEventListener('visibilitychange', function(){
    try{
      if(!S.open) return;
      var v = activeVideo(); if(!v) return;
      if(document.hidden) v.pause();
      else if(!S.root.classList.contains('okr-paused')){
        var pr = v.play(); if(pr && pr.catch) pr.catch(function(){});
      }
    }catch(e){}
  });
}

function popHeart(slide, cx, cy){
  try{
    if(!slide) return;
    var box = slide.getBoundingClientRect();
    var s = document.createElement('span');
    s.className = 'okr-heart';
    s.setAttribute('aria-hidden', 'true');
    s.style.left = (cx - box.left) + 'px';
    s.style.top = (cy - box.top) + 'px';
    s.innerHTML = ic('heart', 'fill');
    slide.appendChild(s);
    setTimeout(function(){ try{ s.remove(); }catch(e){} }, 900);
  }catch(e){}
}

/* ---------------------------------------------------------------------------
   10. КЛАВИАТУРА + ФОКУС-ЛОВУШКА
   --------------------------------------------------------------------------- */
/* Именно a[href], а НЕ [href]: иначе под селектор попадают <use href="#i-…">
   из спрайта иконок. Такие узлы фокус не принимают, но становятся первым и
   последним элементом списка — и ловушка перестаёт срабатывать.
   Видимость меряем по getClientRects(): у SVG нет offsetParent (там undefined,
   а не null), поэтому старая проверка пропускала скрытые стрелки. */
var FOCUSABLE = 'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

function focusables(){
  var out = [];
  try{
    var nodes = S.root.querySelectorAll(FOCUSABLE);
    for(var i = 0; i < nodes.length; i++){
      var n = nodes[i];
      if(!n || typeof n.focus !== 'function' || n.disabled) continue;
      if(!n.getClientRects().length) continue;
      out.push(n);
    }
  }catch(e){}
  return out;
}

function bindKeys(){
  if(S.keyH) return;
  S.keyH = function(e){
    try{
      if(!S.open) return;
      var t = e.target;
      /* не мешаем печатать в шторке комментариев поверх плеера */
      if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      var sheet = document.getElementById('sheet-comments');
      if(sheet && sheet.classList.contains('open')) return;

      /* фокус стоит на подписи — Enter и пробел разворачивают её,
         играть/ставить на паузу этими клавишами тут не нужно */
      if(t && t.classList && t.classList.contains('okr-cap') &&
         (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) return;

      if(e.key === 'Escape'){ e.preventDefault(); close(); return; }
      if(e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'j'){ e.preventDefault(); next(); return; }
      if(e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k'){ e.preventDefault(); prev(); return; }
      if(e.key === ' ' || e.key === 'Spacebar'){ e.preventDefault(); togglePlay(); return; }
      if(e.key === 'm' || e.key === 'M' || e.key === 'ь'){ e.preventDefault(); setSound(!S.sound, true); return; }
      if(e.key === 'l' || e.key === 'L' || e.key === 'д'){ e.preventDefault(); doLike(S.idx, false); return; }

      /* фокус-ловушка */
      if(e.key === 'Tab'){
        var list = focusables();
        if(!list.length){ e.preventDefault(); return; }
        var first = list[0], last = list[list.length - 1];
        var a = document.activeElement;

        /* фокус ушёл из плеера — забираем обратно на нужный край */
        if(!S.root.contains(a)){
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
          return;
        }
        /* фокус внутри, но на элементе вне списка (например .okr-scroll) —
           тоже заворачиваем, иначе следующий Tab уведёт наружу */
        var at = -1;
        for(var q = 0; q < list.length; q++){ if(list[q] === a){ at = q; break; } }
        if(at === -1){ e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }

        if(e.shiftKey && a === first){ e.preventDefault(); last.focus(); return; }
        if(!e.shiftKey && a === last){ e.preventDefault(); first.focus(); return; }
      }
    }catch(err){}
  };
  document.addEventListener('keydown', S.keyH, true);
}
function unbindKeys(){
  try{ if(S.keyH){ document.removeEventListener('keydown', S.keyH, true); S.keyH = null; } }catch(e){}
}

/* ---------------------------------------------------------------------------
   11. ОТКРЫТИЕ / ЗАКРЫТИЕ
   --------------------------------------------------------------------------- */
function open(startId){
  try{
    buildRoot();

    /* звук: восстанавливаем решение человека */
    var pref = lsGet(LS_SOUND);
    S.soundDecided = (pref === '1' || pref === '0');
    S.sound = (pref === '1');

    S.clips = okoClipsSource();

    /* refresh() зовёт open() на живом плеере — гасим то, что уже играет,
       иначе оторванный от DOM <video> может доигрывать звук */
    stopAllVideo();

    /* --- пустое состояние --- */
    if(!S.clips.length){
      /* сначала отпускаем наблюдатель: иначе он держит ссылки на секции,
         которые сейчас уедут из DOM вместе с innerHTML */
      if(S.io) try{ S.io.disconnect(); }catch(e1){}
      S.scroll.innerHTML = '';
      S.idx = 0;
      var e0 = S.root.querySelector('.okr-empty');
      if(e0) e0.remove();
      S.stage.insertAdjacentHTML('beforeend', emptyHTML());
      S.root.classList.add('okr-blank');
      showRoot();
      setProg(0, true);
      var fb = S.root.querySelector('.okr-to-feed');
      if(fb) setTimeout(function(){ try{ fb.focus(); }catch(e){} }, 60);
      return;
    }

    var old = S.root.querySelector('.okr-empty');
    if(old) old.remove();
    S.root.classList.remove('okr-blank');
    if(S.io) try{ S.io.disconnect(); }catch(e1){}

    /* каркас слайдов: все существуют (высота ленты честная), контент — по окну */
    var h = '';
    for(var i = 0; i < S.clips.length; i++){
      h += '<section class="okr-slide" data-i="' + i + '" data-mounted="0" ' +
           'style="' + gradOf(S.clips[i]) + '" aria-label="Клип ' + (i + 1) + ' из ' + S.clips.length + '"></section>';
    }
    S.scroll.innerHTML = h;

    /* стартовый индекс */
    var start = 0;
    if(startId != null){
      for(var k = 0; k < S.clips.length; k++){
        if(String(S.clips[k].id) === String(startId)){ start = k; break; }
      }
    }
    S.idx = start;

    showRoot();
    applySound();

    /* наблюдаем все слайды (элементы лёгкие — пустые секции) */
    if(S.io){
      var kids = S.scroll.children;
      for(var m = 0; m < kids.length; m++) S.io.observe(kids[m]);
    }

    /* стартовая позиция — без анимации */
    syncWindow(start);
    requestAnimationFrame(function(){
      try{
        var hh = S.scroll.clientHeight || 1;
        S.scroll.scrollTop = start * hh;
        setActive(start, true);
        var x = S.root.querySelector('.okr-x');
        if(x) x.focus({ preventScroll: true });
      }catch(e){}
    });
  }catch(e){}
}

function showRoot(){
  try{
    /* refresh() дергает open() на уже открытом плеере — тогда точку возврата
       фокуса не перезаписываем, иначе она уедет на кнопку внутри плеера */
    if(!S.open) S.restoreFocus = document.activeElement;
    S.root.hidden = false;
    S.root.setAttribute('aria-hidden', 'false');
    S.root.classList.add('okr-in');
    setTimeout(function(){ try{ S.root.classList.remove('okr-in'); }catch(e){} }, 300);
    document.documentElement.classList.add('okr-lock');
    S.open = true;
    bindKeys();
    updateArrows();
    /* аппаратный «назад» / кнопка Telegram закрывают плеер */
    try{ if(typeof window.nvPush === 'function') window.nvPush('reels', close); }catch(e){}
    /* старая сторис-оболочка на всякий случай выключена */
    try{
      var oldWrap = document.getElementById('faReels');
      if(oldWrap){ oldWrap.hidden = true; oldWrap.setAttribute('aria-hidden', 'true'); }
    }catch(e){}
  }catch(e){}
}

function close(){
  try{
    if(!S.root) return;
    stopAllVideo();
    if(S.io) try{ S.io.disconnect(); }catch(e){}
    if(S.scroll){ S.scroll.innerHTML = ''; S.scroll.scrollTop = 0; }
    var em = S.root.querySelector('.okr-empty'); if(em) em.remove();

    S.root.hidden = true;
    S.root.setAttribute('aria-hidden', 'true');
    S.root.classList.remove('okr-in', 'okr-paused', 'okr-dragging', 'okr-blank');
    S.root.style.background = '';
    if(S.stage) S.stage.style.transform = '';
    document.documentElement.classList.remove('okr-lock');

    S.open = false;
    S.drag = null;
    clearTimeout(S.tapTimer);
    clearTimeout(S.bigTimer);
    setProg(0, true);
    unbindKeys();

    try{ if(typeof window.nvPop === 'function') window.nvPop('reels'); }catch(e){}
    try{
      if(S.restoreFocus && S.restoreFocus.focus) S.restoreFocus.focus({ preventScroll: true });
    }catch(e){}
    S.restoreFocus = null;
  }catch(e){}
}

/* пересобрать список, не закрывая плеер (например, лента догрузилась) */
function refresh(){
  try{
    if(!S.open) return;
    var curId = S.clips[S.idx] ? S.clips[S.idx].id : null;
    open(curId);
  }catch(e){}
}

/* ---------------------------------------------------------------------------
   12. ПЕРЕОПРЕДЕЛЕНИЕ СТАРОГО ПЛЕЕРА И ТОЧЕК ВХОДА
   --------------------------------------------------------------------------- */
function hideLegacy(){
  try{
    injectCss();
    var w = document.getElementById('faReels');
    if(w){
      w.hidden = true;
      w.setAttribute('aria-hidden', 'true');
      w.style.display = 'none';
    }
  }catch(e){}
}

window.okoReels = {
  open: open,
  close: close,
  refresh: refresh,
  source: okoClipsSource,
  isOpen: function(){ return !!S.open; }
};

/* старые имена → новый плеер */
window.faReelsOpen      = function(pid){ open(pid); };
window.faReelsOpenFirst = function(){ open(null); };
window.faReelsClose     = function(){ close(); };
window.faReelsList      = function(){ try{ return okoClipsSource(); }catch(e){ return []; } };
window.okoOpenClips     = function(){ haptic('impact'); open(null); };

/* тап по видео-области карточки ленты — перехватываем в фазе capture,
   чтобы старый делегат из app.js не открыл сторис-плеер */
document.addEventListener('click', function(e){
  try{
    var t = e.target;
    if(!t || !t.closest) return;
    var media = t.closest('.media');
    if(!media || !media.closest('#feedList')) return;
    var art = media.closest('article.post'); if(!art) return;
    var pid = pidOfCard(art); if(pid == null) return;

    /* открываем, только если этот пост реально клип (карусель фото не трогаем) */
    var list = okoClipsSource();
    var found = false;
    for(var i = 0; i < list.length; i++){ if(String(list[i].id) === String(pid)){ found = true; break; } }
    if(!found) return;

    e.preventDefault();
    e.stopPropagation();
    if(e.stopImmediatePropagation) e.stopImmediatePropagation();
    haptic('impact');
    open(pid);
  }catch(err){}
}, true);

/* прячем старую оболочку сразу и после готовности DOM */
hideLegacy();
if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', function(){ hideLegacy(); buildRoot(); });
}else{
  setTimeout(function(){ try{ hideLegacy(); buildRoot(); }catch(e){} }, 0);
}

}catch(e){
  try{ console.warn('[oko-reels] init failed', e); }catch(_){}
}

})();

/* ============================================================================
   САМОПРОВЕРКА РУКАМИ (после деплоя открыть okoteam.top)

   1.  Вход в клипы. Тапнуть иконку «Клипы» в шапке ленты и тапнуть по
       видео-области карточки поста. В обоих случаях открывается #okoReels,
       а НЕ старый #faReels (в DevTools у #faReels должно быть display:none).
   2.  Сторис-хрома нет. Сверху нет сегментов и нет счётчика «2/37» —
       только крестик слева и одна тонкая лаймовая полоса прогресса.
   3.  Прогресс. Полоса едет ровно по времени видео (не по CSS-таймеру).
       На слайде без видео полоса приглушена и стоит на нуле.
   4.  Листание. Скроллить пальцем: слайды прилипают по одному
       (scroll-snap-stop:always), промежуточных положений нет.
       Активный слайд играет, соседние — на паузе и с нулевым временем.
   5.  Виртуализация. В DevTools: у секций дальше текущей ±2 атрибут
       data-mounted="0" и пустой innerHTML. Прокрутить на 10 слайдов —
       в DOM всё равно максимум 5 смонтированных.
   6.  Тапы. Одиночный тап — пауза/плей с крупной иконкой, гаснет через 400 мс.
       Двойной тап — лайк + лаймовое сердце ровно в точке касания
       (повторный двойной тап лайк НЕ снимает).
   7.  Рельс. Лайк заливается лаймом и пружинит, счётчик растёт; коммент
       открывает штатную шторку ПОВЕРХ плеера (sheet z-index 41 > 39);
       сохранить и «ещё» работают; ничего из рельса не перекрыто подписью.
   8.  Подпись. Длинный текст показан в 2 строки со словом «ещё»,
       тап разворачивает. Текст НЕ заходит под правый рельс.
       Крупного заголовка на весь экран больше нет нигде.
   9.  Звук. Первый вход — видео без звука; первое касание экрана включает
       звук и показывает тост. Кнопка в правом верхнем углу переключает.
       Перезагрузить страницу — состояние звука сохранилось (localStorage
       oko-reels-sound).
   10. Свайп вниз. На ПЕРВОМ слайде потянуть вниз — сцена уезжает и плеер
       закрывается. На втором и дальше свайп вниз просто листает назад.
   11. Пустое состояние. В консоли: window.CLIPS = []; okoReels.open() —
       экран «Клипов пока нет…» + кнопка «В ленту» уводит в ленту.
   12. ПК. Ширина окна > 760px: колонка 9:16 по центру на затемнённом фоне,
       справа стрелки вверх/вниз (крайние — приглушены), колесо мыши листает
       по одному клипу, Escape закрывает.
   13. Клавиатура и доступность. Tab ходит по кнопкам и не уходит за пределы
       плеера; у всех кнопок есть aria-label; Escape закрывает; после закрытия
       фокус возвращается на элемент, с которого вошли.
   14. Темы. Переключить светлую/тёмную — плеер остаётся тёмным (как во всех
       Reels), лайм читается, нигде не появляется белого фона.
   15. Telegram Mini App. Крестик и полоса прогресса не заезжают под шапку
       Telegram, рельс и подпись не заезжают под нижнюю панель
       (var(--oko-safe-top) / var(--oko-safe-bottom)).
   16. Ошибка видео. Подсунуть битый src — слайд падает на постер или на
       фирменный градиент, подпись остаётся внизу мелкой, ничего не ломается.
   17. Строка звука. Короткое название стоит на месте (без дубля и без
       растворённой первой буквы), длинное — едет бегущей строкой.
   18. Мост к ядру. В консоли: window.postById === undefined (так и должно
       быть — ядро объявляет его через top-level const). При этом лайк и
       «сохранить» в плеере меняют тот же пост в ленте, а «комментарии»
       открывают штатную шторку. Если начнёт показывать заглушку-тост —
       кто-то вернул обращение через window.*, чинить в coreRef().
   ============================================================================ */
