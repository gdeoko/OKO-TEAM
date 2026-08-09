/* ============================================================================
   oko-channels2.js — раздел «Каналы» под запуск. Слой поверх ядра (app.js),
   ядро не переписывается: модуль каналов завёрнут в IIFE и отдаёт наружу мост
   window.chCore (модель CH + чистые хелперы). Здесь мы:

   1) КАТАЛОГ И СПИСОК. Живой поиск по названию/@нику/описанию, фильтр по нишам,
      сегменты «Все · Мои · Подписки · Рекомендуем · Архив», подписка и отписка
      прямо из карточки. Пустой каталог честный: объясняет, почему пусто.
   2) НОЛЬ ВЫДУМАННЫХ ЧИСЕЛ. Ядро генерировало рейтинг и количество отзывов из
      хэша id (4.0–5.4 звезды, 40–220 отзывов), охват = подписчики*3.4+1200,
      вовлечённость из длины id, «пик: сб», источники подписчиков 46/31/15/8%,
      графики по seeded-random и стартовые голоса в опросах. Всё это убрано:
      санитайзер гасит фейк в модели, страница статистики переписана на реальные
      числа, а всё, для чего нет источника данных, показывает прочерк и пишет,
      откуда возьмётся.
   3) ЧЕСТНЫЕ ДЕЙСТВИЯ. «Скопировано» — только после реального успеха буфера,
      иначе показываем ссылку для ручного копирования. «Поделиться» — реальный
      navigator.share или копирование. «Пожаловаться» больше не врёт про
      отправку на модерацию. Пригласительные ссылки честно помечены заготовками.
   4) СОЗДАНИЕ. Поле @ника с транслитерацией из названия и живой проверкой
      занятости; занятый ник не даёт создать канал. Новый канал больше не
      получает пост «Канал создан…», которого владелец не писал.
   5) УПРАВЛЕНИЕ. Архив реально прячет канал в отдельную секцию. Удаление —
      с перечислением последствий и очисткой всех связанных ключей (подписки,
      уведомления, прогресс, лайки, комментарии, голоса, зеркало в чатах,
      посты в ленте). Назначение админа — выбор из участников, а не «первый
      попавшийся», и честное объяснение, когда назначать некого.

   Перехват рендера: ядро пишет страницу в #chBody.innerHTML. Внутренние вызовы
   chRender() приватные, обернуть их снаружи нельзя, поэтому мы подменяем
   аксессор innerHTML на самом элементе #chBody — это срабатывает на КАЖДЫЙ
   рендер, синхронно, до восстановления скролла ядром.

   Префиксы: cx2* (функции и состояние), .cx2-* (стили). Ядро и чужие слои
   (oko-social.js держит единую страницу сущности) не трогаем.
   ============================================================================ */

(function(){
'use strict';

/* ---------------------------------------------------------------- мост к ядру */
function core(){ return window.chCore || null; }
function CH(){ var c = core(); return c ? c.CH : null; }
function I(n){ var c = core(); return c ? c.I(n) : '<svg class="i"><use href="#i-'+n+'"/></svg>'; }
function esc(t){ var c = core(); return c ? c.esc(t) : String(t == null ? '' : t); }
/* esc ядра экранирует только & < > — внутри значения атрибута этого мало:
   имя канала с кавычкой рвало бы aria-label и позволяло дописать свой атрибут */
function attr(t){
  return String(t == null ? '' : t).replace(/[&<>"']/g, function(ch){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch];
  });
}
function fmtN(n){ var c = core(); return c ? c.fmtN(n) : String(n); }
function chan(id){ var c = core(); return c ? c.channel(id) : null; }
function isMine(c){ var k = core(); return !!(k && k.isMine(c)); }
function gated(c){ var k = core(); return !!(k && k.gated(c)); }
function paid(c){ var k = core(); return !!(k && k.paid(c)); }
function nickOf(c){ var k = core(); return k ? k.nick(c) : (c && c.nick) || ''; }
function save(){ var c = core(); if(c) c.save(); }
function render(){ var c = core(); if(c) c.render(); }
function kindLabel(c){ var k = core(); return k ? k.kindLabel(c) : 'Канал'; }
function avInner(c, cls, lock){ var k = core(); return k ? k.avInner(c, cls, lock) : ''; }
function badges(c){ var k = core(); return k ? k.badges(c) : ''; }
function badge(c){ var k = core(); return k ? k.badge(c) : ''; }
function postId(p){ var k = core(); return k ? k.postId(p) : (p && p.id) || ''; }
function publicLink(c){ var k = core(); return k ? k.publicLink(c) : ''; }
function niche(c){ var k = core(); return k ? k.niche(c) : 'life'; }
function say(t){ try{ if(typeof toast === 'function') toast(t); }catch(e){} }
function popup(o){ try{ if(typeof showPopup === 'function'){ showPopup(o); return true; } }catch(e){} return false; }
function profile(){ try{ return (typeof PROFILE !== 'undefined' && PROFILE) || {name:'Вы', nick:'me'}; }catch(e){ return {name:'Вы', nick:'me'}; } }

/* все каналы, которые видит человек */
function allChannels(){
  var m = CH(); if(!m) return [];
  return (m.mine || []).concat(m.disc || []);
}
/* подписан ли человек ЯВНО (кнопкой), в отличие от «просто открытый канал» */
function isFollowing(id){ var m = CH(); return !!(m && m.sub && m.sub[id]); }

/* =========================================================================
   САНИТАЙЗЕР МОДЕЛИ — гасим генераторы выдуманных чисел в самом ядре.

   chReviewsN(c) возвращает c.reviews, если это число >= 0, иначе выдаёт
   40..220 из хэша id. Ставим честный 0 (или длину реального списка отзывов) —
   и блок отзывов в ядре сам перестаёт рисоваться (он выходит по total<=0).

   chPollHtml берёт p.poll.base, а если его нет — синтезирует стартовые голоса
   из p.views. Прописываем нули: в опросе видно только реальные голоса.
   ========================================================================= */
function sanitize(){
  var m = CH(); if(!m) return;
  var dirty = false;
  var used = {};
  allChannels().forEach(function(c){
    if(!c) return;
    /* @адрес канала. Слаггер ядра оставлял кириллицу: «OKO Новости» получал
       адрес @okoновости, который нельзя ни набрать, ни положить в ссылку.
       Приводим к латинице транслитерацией и разводим совпадения. */
    var want = normNick(c.nick || '');
    if(!want || want !== String(c.nick || '')) want = normNick(translit(c.nick || c.name)) || 'channel';
    if(want.length < 3) want = (want + '_ch').slice(0, 18);
    if(used[want] && used[want] !== c.id){
      var n = 2;
      while(used[want + n]) n++;
      want = (want + n).slice(0, 18);
    }
    used[want] = c.id;
    if(c.nick !== want){ c.nick = want; dirty = true; }
    var realReviews = Array.isArray(c.reviewsList) ? c.reviewsList.length : 0;
    if(c.reviews !== realReviews){ c.reviews = realReviews; dirty = true; }
    /* «N учеников проходят курс прямо сейчас» — счётчик без источника данных */
    if(c.students_now != null){ delete c.students_now; dirty = true; }
    /* выдуманный средний балл, если его кто-то успел записать */
    if(c.rating != null && !realReviews){ delete c.rating; dirty = true; }
    /* ядро при переводе канала в курс подкладывало «Вводный урок · 5:00»,
       которого автор не создавал. Убираем ровно эту заготовку (свои уроки
       автор добавляет с id вида l<timestamp> — их не трогаем). */
    if(c.kind === 'course' && Array.isArray(c.lessons) && c.lessons.length === 1){
      var l0 = c.lessons[0];
      if(l0 && l0.id === 'l1' && l0.title === 'Вводный урок' && l0.dur === '5:00'){
        c.lessons = []; dirty = true;
      }
    }
    (c.posts || []).forEach(function(p){
      if(!p || p.media !== 'poll') return;
      var opts = (p.poll && p.poll.opts) || ['Уже применяю', 'Возьму в работу'];
      var zeros = opts.map(function(){ return 0; });
      if(!p.poll) p.poll = { opts: opts };
      if(!Array.isArray(p.poll.base) || p.poll.base.some(function(v){ return +v !== 0; })){
        p.poll.base = zeros; dirty = true;
      }
    });
  });
  if(dirty) save();
}

/* =========================================================================
   ЧЕСТНОЕ КОПИРОВАНИЕ. Тост «скопировано» — только после реального успеха.
   Если буфер недоступен (нет разрешения, не защищённый контекст, Telegram
   WebView) — показываем ссылку и даём выделить её руками, а не врём.
   ========================================================================= */
function copyText(text, okMsg){
  var ok = function(){ say(okMsg || 'Скопировано'); };
  var no = function(){ showManualCopy(text); };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(ok, function(){ legacyCopy(text) ? ok() : no(); });
      return;
    }
  }catch(e){}
  if(legacyCopy(text)) ok(); else no();
}
function legacyCopy(text){
  try{
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select(); ta.setSelectionRange(0, ta.value.length);
    var done = document.execCommand && document.execCommand('copy');
    ta.remove();
    return !!done;
  }catch(e){ return false; }
}
function showManualCopy(text){
  var body = 'Скопировать автоматически не вышло — браузер не дал доступ к буферу обмена. '
           + 'Выдели адрес и скопируй вручную:\n\n' + text;
  if(!popup({ ico:'copy', title:'Скопируй вручную', body: body, actions:[{label:'Закрыть', ghost:true}] })){
    say('Буфер обмена недоступен: ' + text);
  }
}

/* =========================================================================
   ТРАНСЛИТЕРАЦИЯ И ПРОВЕРКА @НИКА
   ========================================================================= */
var TRANSLIT = {
  а:'a', б:'b', в:'v', г:'g', д:'d', е:'e', ё:'e', ж:'zh', з:'z', и:'i', й:'y',
  к:'k', л:'l', м:'m', н:'n', о:'o', п:'p', р:'r', с:'s', т:'t', у:'u', ф:'f',
  х:'h', ц:'c', ч:'ch', ш:'sh', щ:'sch', ъ:'', ы:'y', ь:'', э:'e', ю:'yu', я:'ya'
};
function translit(s){
  return String(s || '').toLowerCase().split('').map(function(ch){
    if(TRANSLIT[ch] != null) return TRANSLIT[ch];
    return /[a-z0-9_]/.test(ch) ? ch : (/\s/.test(ch) ? '_' : '');
  }).join('').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
function normNick(s){
  return String(s || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 18);
}
/* занят ли ник (сравниваем со всеми каналами, кроме исключённого id) */
function nickTaken(nick, exceptId){
  nick = normNick(nick);
  if(!nick) return false;
  return allChannels().some(function(c){
    return c && c.id !== exceptId && normNick(c.nick || '') === nick;
  });
}
/* {ok, msg, tone} — единая валидация ника для мастера создания и оформления */
function checkNick(nick, exceptId){
  var n = normNick(nick);
  if(!n) return { ok:false, tone:'dim', msg:'Латиница, цифры и «_», от 3 до 18 символов' };
  if(n.length < 3) return { ok:false, tone:'bad', msg:'Слишком коротко — нужно минимум 3 символа' };
  if(/^\d+$/.test(n)) return { ok:false, tone:'bad', msg:'Ник не может состоять только из цифр' };
  if(nickTaken(n, exceptId)) return { ok:false, tone:'bad', msg:'@' + n + ' уже занят — выбери другой' };
  return { ok:true, tone:'good', msg:'@' + n + ' свободен' };
}

/* =========================================================================
   РЕАЛЬНЫЕ МЕТРИКИ КАНАЛА. Никаких формул «на глазок»: только то, что
   действительно посчитано в модели. Чего нет — того нет.
   ========================================================================= */
function metrics(c){
  var m = CH() || {};
  var posts = (c && c.posts) || [];
  var likes = 0, cmts = 0, views = 0, votes = 0;
  posts.forEach(function(p){
    var pid = postId(p);
    views += (+p.views || 0);
    likes += (+p.likes || 0) + ((m.likes && m.likes[pid]) ? 1 : 0);
    cmts  += ((m.cmt && m.cmt[pid]) || []).length;
    if(m.votes && m.votes[pid] != null) votes += 1;
  });
  return {
    subs: +c.subs || 0,
    posts: posts.length,
    lessons: (c.lessons || []).length,
    views: views,
    likes: likes,
    comments: cmts,
    votes: votes,
    admins: (c.admins || []).length,
    black: (c.black || []).length,
    invites: (c.invites || []).length,
    gross: +c.gross || 0
  };
}

/* =========================================================================
   СОСТОЯНИЕ ЭКРАНОВ СЛОЯ
   ========================================================================= */
var S = {
  q: '',           // поиск в списке каналов
  seg: 'all',      // all | mine | subs | disc | arch
  niche: 'all',    // ниша в списке
  catQ: ''         // поиск в каталоге
};

/* текущая страница внутреннего стека ядра */
function curPage(){
  var c = core();
  var nav = (c && c.nav) || [];
  return nav[nav.length - 1] || { page:'list', arg:null };
}

/* =========================================================================
   СТИЛИ СЛОЯ (один инлайновый <style>, темы через переменные бренда)
   ========================================================================= */
function injectStyles(){
  if(document.getElementById('cx2-styles')) return;
  var st = document.createElement('style');
  st.id = 'cx2-styles';
  st.textContent = [
    /* --- поиск --- */
    '.cx2-search{position:relative;margin:2px 0 12px}',
    '.cx2-search svg.i{position:absolute;left:13px;top:50%;transform:translateY(-50%);width:17px;height:17px;color:var(--dim);pointer-events:none}',
    '.cx2-search input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md,14px);padding:12px 40px 12px 38px;font-size:14.5px;color:var(--text);font-family:inherit;transition:border-color .18s,box-shadow .18s}',
    '.cx2-search input:focus{border-color:var(--lime);outline:none;box-shadow:0 0 0 3px var(--lime-dim,rgba(154,255,0,.14))}',
    '.cx2-search-x{position:absolute;right:5px;top:50%;transform:translateY(-50%);width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:var(--dim);border-radius:10px}',
    '.cx2-search-x svg.i{position:static;transform:none;width:15px;height:15px}',
    '.cx2-search-x:hover{color:var(--text)}',

    /* --- ряды чипов --- */
    '.cx2-chips{display:flex;gap:7px;overflow-x:auto;padding:1px 0 9px;scrollbar-width:none;-webkit-overflow-scrolling:touch}',
    '.cx2-chips::-webkit-scrollbar{display:none}',
    '.cx2-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:99px;background:var(--surface);border:1px solid var(--border);color:var(--dim);font-size:12.5px;font-weight:600;white-space:nowrap;transition:background .16s,color .16s,border-color .16s}',
    '.cx2-chip svg.i{width:14px;height:14px}',
    '.cx2-chip.on{background:var(--lime);border-color:var(--lime);color:#0a0a0a}',
    '.cx2-chip-n{opacity:.66;font-weight:700}',
    '.cx2-chip.on .cx2-chip-n{opacity:.72}',

    /* --- заголовок секции + счётчик --- */
    '.cx2-sec{display:flex;align-items:center;gap:8px;margin:16px 0 9px;font:700 11.5px/1 var(--font-display,inherit);letter-spacing:.08em;text-transform:uppercase;color:var(--dim)}',
    '.cx2-sec svg.i{width:14px;height:14px;color:var(--lime)}',
    '.cx2-sec b{margin-left:auto;font-size:11.5px;font-weight:700;color:var(--dim);letter-spacing:.02em;text-transform:none}',

    /* --- карточка канала ---
       На телефоне действие уезжает во вторую строку: иначе кнопка «Подписаться»
       съедала половину карточки и название резалось до «ОКО Новос…».
       С 640px и шире всё возвращается в одну строку. */
    '.cx2-card{display:flex;flex-direction:column;gap:10px;width:100%;text-align:left;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md,14px);padding:12px;margin-bottom:9px;transition:border-color .16s,transform .12s}',
    '.cx2-card:active{transform:scale(.994)}',
    '.cx2-card:hover{border-color:var(--lime)}',
    '.cx2-card-tap{width:100%;min-width:0;display:flex;align-items:center;gap:12px;text-align:left;background:none;border:0;padding:0;color:inherit;font:inherit}',
    '.cx2-cb{flex:1;min-width:0}',
    '.cx2-cn{display:flex;align-items:center;gap:5px;font-weight:700;font-size:14.5px;color:var(--text);line-height:1.3}',
    '.cx2-cn > span:first-child{min-width:0;overflow-wrap:break-word}',
    '.cx2-cs{display:block;color:var(--dim);font-size:12px;margin-top:4px;line-height:1.4}',
    '.cx2-cs svg.i{width:13px;height:13px;vertical-align:-2px;margin-right:4px}',
    '.cx2-ct{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}',
    '.cx2-ct:empty{display:none}',
    '.cx2-foot{display:flex;align-items:center;gap:8px;justify-content:flex-end}',
    '@media(min-width:640px){',
    '  .cx2-card{flex-direction:row;align-items:center;gap:12px}',
    '  .cx2-card-tap{flex:1}',
    '  .cx2-foot{flex:0 0 auto}',
    '}',

    /* --- кнопка подписки в карточке --- */
    '.cx2-act{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;padding:8px 12px;border-radius:99px;font-size:12.5px;font-weight:700;background:var(--lime);color:#0a0a0a;border:1px solid var(--lime);white-space:nowrap;transition:filter .16s,transform .12s}',
    '.cx2-act:active{transform:scale(.96)}',
    '.cx2-act svg.i{width:14px;height:14px}',
    '.cx2-act.ghost{background:transparent;color:var(--dim);border-color:var(--border)}',
    '.cx2-act.ghost:hover{color:var(--text);border-color:var(--dim)}',
    '.cx2-act.price{background:transparent;color:var(--lime);border-color:var(--lime)}',

    /* --- пустые состояния --- */
    '.cx2-empty{text-align:center;padding:28px 20px;background:var(--surface);border:1px dashed var(--border);border-radius:var(--r-md,14px);margin:8px 0 4px}',
    '.cx2-empty-ic{width:46px;height:46px;margin:0 auto 12px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--raised,rgba(255,255,255,.05));color:var(--lime)}',
    '.cx2-empty-ic svg.i{width:22px;height:22px}',
    '.cx2-empty b{display:block;font-size:15px;color:var(--text);margin-bottom:6px}',
    '.cx2-empty p{font-size:12.8px;line-height:1.55;color:var(--dim);margin:0 auto;max-width:34em}',
    '.cx2-empty .cx2-act{margin-top:14px}',

    /* --- заметка/пояснение --- */
    '.cx2-note{display:flex;gap:9px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md,14px);padding:12px 13px;margin:10px 0;color:var(--dim);font-size:12.3px;line-height:1.55}',
    '.cx2-note svg.i{width:15px;height:15px;flex:0 0 auto;margin-top:1px;color:var(--lime)}',
    '.cx2-note b{color:var(--text);font-weight:700}',
    '.cx2-note.warn svg.i{color:var(--danger,#ff5a5a)}',

    /* --- KPI-плитки статистики --- */
    '.cx2-kpi{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:4px 0 6px}',
    '@media(min-width:640px){.cx2-kpi{grid-template-columns:repeat(4,minmax(0,1fr))}}',
    '.cx2-kpi-t{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md,14px);padding:13px 12px;min-width:0}',
    '.cx2-kpi-t svg.i{width:16px;height:16px;color:var(--lime);display:block;margin-bottom:8px}',
    '.cx2-kpi-t b{display:block;font:800 21px/1.05 var(--font-display,inherit);color:var(--text);overflow-wrap:break-word}',
    '.cx2-kpi-t.dash b{color:var(--dim)}',
    '.cx2-kpi-t small{display:block;color:var(--dim);font-size:11.4px;margin-top:5px;line-height:1.35}',

    /* --- список «чего пока нет» --- */
    '.cx2-pend{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md,14px);padding:4px 13px;margin:8px 0}',
    '.cx2-pend-row{display:flex;align-items:flex-start;gap:10px;padding:11px 0;border-bottom:1px solid var(--border)}',
    '.cx2-pend-row:last-child{border-bottom:none}',
    '.cx2-pend-row svg.i{width:15px;height:15px;color:var(--dim);flex:0 0 auto;margin-top:2px}',
    '.cx2-pend-row div{min-width:0}',
    '.cx2-pend-row b{display:block;font-size:13.2px;color:var(--text);font-weight:600}',
    '.cx2-pend-row small{display:block;font-size:11.8px;color:var(--dim);line-height:1.5;margin-top:3px}',
    '.cx2-pend-row i{flex:0 0 auto;margin-left:auto;font-style:normal;color:var(--dim);font-size:15px;font-weight:800;padding-left:8px}',

    /* --- участники --- */
    '.cx2-people{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md,14px);padding:2px 13px;margin:8px 0}',
    '.cx2-person{display:flex;align-items:center;gap:11px;padding:11px 0;border-bottom:1px solid var(--border)}',
    '.cx2-person:last-child{border-bottom:none}',
    '.cx2-person .ch-av{flex:0 0 auto}',
    '.cx2-pb{flex:1;min-width:0}',
    '.cx2-pb b{display:block;font-size:13.6px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cx2-pb small{display:block;font-size:11.6px;color:var(--dim);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.cx2-pa{flex:0 0 auto;width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:10px;color:var(--dim);border:1px solid var(--border);transition:color .16s,border-color .16s}',
    '.cx2-pa svg.i{width:15px;height:15px}',
    '.cx2-pa:hover{color:var(--text);border-color:var(--dim)}',
    '.cx2-pa.danger:hover{color:var(--danger,#ff5a5a);border-color:var(--danger,#ff5a5a)}',
    '.cx2-role{flex:0 0 auto;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--lime);background:var(--lime-dim,rgba(154,255,0,.12));border-radius:99px;padding:4px 9px}',

    /* --- поле @ника в мастере создания --- */
    '.cx2-nick{display:flex;align-items:center;gap:2px;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md,14px);padding:0 12px;transition:border-color .18s,box-shadow .18s}',
    '.cx2-nick.good{border-color:var(--lime)}',
    '.cx2-nick.bad{border-color:var(--danger,#ff5a5a)}',
    '.cx2-nick span{color:var(--dim);font-size:15px;font-weight:600;flex:0 0 auto}',
    '.cx2-nick input{flex:1;min-width:0;background:none;border:0;outline:none;padding:13px 2px;font-size:15px;color:var(--text);font-family:inherit}',
    '.cx2-nick-msg{font-size:11.8px;line-height:1.45;margin:6px 2px 2px;color:var(--dim)}',
    '.cx2-nick-msg.good{color:var(--lime)}',
    '.cx2-nick-msg.bad{color:var(--danger,#ff5a5a)}',
    '.ch-input.cx2-bad,input.cx2-bad{border-color:var(--danger,#ff5a5a)}',

    /* --- честный блюр витрины без выдуманных постов --- */
    '.cx2-gate{display:flex;flex-direction:column;align-items:center;gap:8px;padding:26px 18px;text-align:center;color:var(--dim);font-size:12.6px;line-height:1.5}',
    '.cx2-gate svg.i{width:24px;height:24px;color:var(--dim);opacity:.7}',

    /* общее: длинные технические строки переносим только по классу */
    '.cx2-brk{overflow-wrap:anywhere;word-break:normal}',

    /* Атрибут hidden обязан выигрывать у наших display:flex/grid — без этого
       фильтр поиска «прятал» карточки, а они оставались на экране. */
    '.cx2-card[hidden],.cx2-sec[hidden],.cx2-chip[hidden],.cx2-search-x[hidden],',
    '.cx2-kpi[hidden],.cx2-foot[hidden],.cx2-note[hidden]{display:none!important}'
  ].join('\n');
  document.head.appendChild(st);
}

/* =========================================================================
   СТРАНИЦА: СПИСОК КАНАЛОВ (поиск + сегменты + ниши + подписка из карточки)
   ========================================================================= */
var SEGS = [
  ['all',  'compass',   'Все'],
  ['mine', 'crown',     'Мои'],
  ['subs', 'bookmark',  'Подписки'],
  ['disc', 'megaphone', 'Рекомендуем'],
  ['arch', 'mk-archive','Архив']
];

function segOf(c){
  if(isMine(c)) return c.archived ? 'arch' : 'mine';
  return isFollowing(c.id) ? 'subs' : 'disc';
}
function matchQuery(c, q){
  if(!q) return true;
  q = q.trim().toLowerCase();
  if(!q) return true;
  var hay = [c.name || '', c.desc || '', c.nick || '', c.owner || '', kindLabel(c)].join(' ').toLowerCase();
  return hay.indexOf(q) >= 0;
}

function pageList(){
  var m = CH();
  if(!m) return { title:'Каналы', html:'<div class="cx2-empty"><b>Каналы недоступны</b><p>Раздел не загрузился. Закрой и открой его снова.</p></div>' };

  var all = allChannels();
  var counts = { all:0, mine:0, subs:0, disc:0, arch:0 };
  all.forEach(function(c){ var s = segOf(c); counts[s]++; if(s !== 'arch') counts.all++; });
  /* архив исчез (последний канал вернули из архива) — не оставляем человека
     на вкладке, которой больше нет */
  if(S.seg === 'arch' && !counts.arch) S.seg = 'all';
  if(!SEGS.some(function(s){ return s[0] === S.seg; })) S.seg = 'all';

  /* ниши считаем по тому, что реально видно в выбранном сегменте */
  var inSeg = all.filter(function(c){
    var s = segOf(c);
    return S.seg === 'all' ? s !== 'arch' : s === S.seg;
  });
  var nicheCount = {};
  inSeg.forEach(function(c){ var n = niche(c); nicheCount[n] = (nicheCount[n] || 0) + 1; });

  /* по нише фильтруем при рендере, по поисковому запросу — уже в DOM
     (см. applyFilter), чтобы поле ввода не пересоздавалось на каждую букву */
  var visible = inSeg.filter(function(c){
    return S.niche === 'all' || niche(c) === S.niche;
  });

  var html = '';

  /* CTA создания — всегда сверху, единственный вход в мастер */
  html += '<button class="ch-create-cta" onclick="cx2Create()">'
        +   '<span class="ch-cc-ic">' + I('plus') + '</span>'
        +   '<span><b>Создать канал</b><small>Канал, клуб или видео-курс — открытый или закрытый, бесплатный или по подписке</small></span>'
        + '</button>';

  /* поиск */
  html += '<div class="cx2-search">' + I('search')
        + '<input type="search" id="cx2Q" placeholder="Название, @ник, описание" value="' + esc(S.q) + '"'
        + ' oninput="cx2Filter(this.value)" onkeydown="if(event.key===\'Escape\'){event.stopPropagation();this.value=\'\';cx2Filter(\'\')}" aria-label="Поиск по каналам">'
        + '<button class="cx2-search-x" type="button" id="cx2QX" onclick="cx2ClearQ()" aria-label="Очистить поиск"'
        + (S.q ? '' : ' hidden') + '>' + I('x') + '</button>'
        + '</div>';

  /* сегменты */
  html += '<div class="cx2-chips" role="tablist" aria-label="Разделы каналов">';
  SEGS.forEach(function(s){
    var k = s[0];
    if(k === 'arch' && !counts.arch) return;
    html += '<button class="cx2-chip' + (S.seg === k ? ' on' : '') + '" role="tab" aria-selected="' + (S.seg === k) + '"'
          + ' onclick="cx2Seg(\'' + k + '\')">' + I(s[1]) + s[2]
          + '<span class="cx2-chip-n">' + counts[k] + '</span></button>';
  });
  html += '</div>';

  /* ниши — только если в сегменте больше одной темы, иначе это шум */
  var nicheKeys = Object.keys(nicheCount);
  if(nicheKeys.length > 1){
    var NICHES = (core() && core().NICHES) || [];
    html += '<div class="cx2-chips" aria-label="Темы каналов">';
    html += '<button class="cx2-chip' + (S.niche === 'all' ? ' on' : '') + '" onclick="cx2Niche(\'all\')">Все темы'
          + '<span class="cx2-chip-n">' + inSeg.length + '</span></button>';
    NICHES.forEach(function(n){
      if(n.k === 'all' || !nicheCount[n.k]) return;
      html += '<button class="cx2-chip' + (S.niche === n.k ? ' on' : '') + '" onclick="cx2Niche(\'' + n.k + '\')">'
            + esc(n.name) + '<span class="cx2-chip-n">' + nicheCount[n.k] + '</span></button>';
    });
    html += '</div>';
  }

  /* Секция и карточки рисуются всегда, «ничего не нашлось» лежит рядом
     скрытым блоком — applyFilter сам решит, что показать. */
  var label = SEGS.filter(function(s){ return s[0] === S.seg; })[0] || SEGS[0];
  html += '<div class="cx2-sec" id="cx2Sec">'
        + I(label[1]) + (label[2] === 'Все' ? 'Все каналы' : label[2])
        + '<b id="cx2Count">' + visible.length + '</b></div>';
  html += visible.map(cardHtml).join('');
  html += '<div id="cx2NoRes" hidden></div>';

  var segEmpty = emptyList(all.length, counts);
  return {
    title: 'Каналы',
    html: html,
    tools: '',
    after: function(){ applyFilter(S.q, 'cx2Sec', 'cx2Count', 'cx2NoRes', 'cx2QX', segEmpty); }
  };
}

/* empty-state именно для поиска — текст зависит от того, что человек набрал */
function emptyQuery(q, onReset){
  return '<div class="cx2-empty">'
    + '<div class="cx2-empty-ic">' + I('search') + '</div>'
    + '<b>Ничего не нашлось</b>'
    + '<p>По запросу «' + esc(q) + '» ничего нет. Проверь написание или сбрось поиск и фильтры.</p>'
    + '<button class="cx2-act ghost" type="button" onclick="' + onReset + '">' + I('refresh') + 'Сбросить</button>'
    + '</div>';
}
function emptyList(total, counts){
  if(S.seg === 'mine'){
    return '<div class="cx2-empty">'
      + '<div class="cx2-empty-ic">' + I('crown') + '</div>'
      + '<b>Своих каналов пока нет</b>'
      + '<p>Создай канал, клуб или видео-курс. Ты сам задаёшь доступ и цену, а посты и подписчики появятся только после того, как ты начнёшь публиковать — накрученных цифр здесь не бывает.</p>'
      + '<button class="cx2-act" type="button" onclick="cx2Create()">' + I('plus') + 'Создать канал</button>'
      + '</div>';
  }
  if(S.seg === 'subs'){
    return '<div class="cx2-empty">'
      + '<div class="cx2-empty-ic">' + I('bookmark') + '</div>'
      + '<b>Подписок пока нет</b>'
      + '<p>Открой «Рекомендуем» и подпишись на то, что интересно. Подписки собираются здесь и присылают уведомления о новых постах.</p>'
      + '<button class="cx2-act ghost" type="button" onclick="cx2Seg(\'disc\')">' + I('compass') + 'Смотреть каналы</button>'
      + '</div>';
  }
  if(S.seg === 'arch'){
    return '<div class="cx2-empty"><div class="cx2-empty-ic">' + I('mk-archive') + '</div>'
      + '<b>Архив пуст</b><p>Сюда попадают твои каналы, которые ты убрал из списков, не удаляя.</p></div>';
  }
  /* «Рекомендуем» / «Все» пусты — честно объясняем, почему */
  return '<div class="cx2-empty">'
    + '<div class="cx2-empty-ic">' + I('compass') + '</div>'
    + '<b>' + (total ? 'В этом разделе пусто' : 'Каталог пока пуст') + '</b>'
    + '<p>Каталог наполняют авторы OKO — выдуманных каналов здесь нет и не будет. '
    + 'Пока опубликованы только официальные каналы команды. Хочешь быть первым в каталоге — создай свой канал.</p>'
    + '<button class="cx2-act" type="button" onclick="cx2Create()">' + I('plus') + 'Создать канал</button>'
    + '</div>';
}

/* карточка канала со своим действием справа */
function cardHtml(c){
  var mine = isMine(c);
  var following = isFollowing(c.id);
  var locked = gated(c) && !mine && !following;
  var mt = metrics(c);

  var line;
  if(c.kind === 'course'){
    line = I('circle-play') + '<span>'
         + (mt.lessons ? mt.lessons + ' ' + plural(mt.lessons, 'урок', 'урока', 'уроков') : 'без уроков')
         + ' · ' + (mt.subs ? fmtN(mt.subs) + ' ' + plural(mt.subs, 'ученик', 'ученика', 'учеников') : 'без учеников')
         + '</span>';
  } else {
    line = I('users') + '<span>' + (mt.subs ? fmtN(mt.subs) + ' ' + plural(mt.subs, 'подписчик', 'подписчика', 'подписчиков') : 'без подписчиков')
         + ' · ' + (mt.posts ? mt.posts + ' ' + plural(mt.posts, 'пост', 'поста', 'постов') : 'без постов') + '</span>';
  }

  var act;
  if(mine){
    act = '<button class="cx2-act ghost" type="button" onclick="event.stopPropagation();chGo(\'manage\',\'' + c.id + '\')" aria-label="Управление каналом ' + attr(c.name) + '">'
        + I('bolt') + 'Управление</button>';
  } else if(following){
    act = '<button class="cx2-act ghost" type="button" onclick="event.stopPropagation();cx2Unfollow(\'' + c.id + '\')" aria-label="Отписаться от ' + attr(c.name) + '">'
        + I('check') + 'Вы подписаны</button>';
  } else if(paid(c)){
    act = '<button class="cx2-act price" type="button" onclick="event.stopPropagation();chGo(\'channel\',\'' + c.id + '\')" aria-label="Открыть витрину ' + attr(c.name) + '">'
        + c.price + ' ₽' + (c.kind === 'course' ? '' : '/мес') + '</button>';
  } else if(gated(c)){
    act = '<button class="cx2-act" type="button" onclick="event.stopPropagation();cx2Follow(\'' + c.id + '\')" aria-label="Вступить в ' + attr(c.name) + '">'
        + I('lock') + 'Вступить</button>';
  } else {
    act = '<button class="cx2-act" type="button" onclick="event.stopPropagation();cx2Follow(\'' + c.id + '\')" aria-label="Подписаться на ' + attr(c.name) + '">'
        + I('plus') + 'Подписаться</button>';
  }

  return '<div class="cx2-card" data-ch="' + c.id + '">'
    + '<button class="cx2-card-tap" type="button" onclick="chGo(\'channel\',\'' + c.id + '\')">'
    +   avInner(c, locked ? 'locked' : '', locked)
    +   '<span class="cx2-cb">'
    +     '<span class="cx2-cn"><span>' + esc(c.name) + '</span>' + badge(c) + '</span>'
    +     '<span class="cx2-cs">' + line + '</span>'
    +     '<span class="cx2-ct">' + badges(c) + '</span>'
    +   '</span>'
    + '</button>'
    + '<div class="cx2-foot">' + act + '</div>'
    + '</div>';
}

function plural(n, one, few, many){
  n = Math.abs(+n || 0) % 100;
  var d = n % 10;
  if(n > 10 && n < 20) return many;
  if(d > 1 && d < 5) return few;
  if(d === 1) return one;
  return many;
}

/* =========================================================================
   СТРАНИЦА: КАТАЛОГ (закрытое и платное) — тот же поиск, ноль фейк-рейтингов
   ========================================================================= */
function pageCatalog(){
  var CAT = (core() && core().CAT) || { niche:'all', price:'any', kind:'any', sort:'top' };
  var all = allChannels().filter(function(c){ return gated(c) && !c.archived; });

  var priceMax = { any: Infinity, '500':500, '1000':1000, '2500':2500, '5000':5000 };
  var list = all.filter(function(c){
    if(CAT.niche !== 'all' && niche(c) !== CAT.niche) return false;
    if(CAT.kind !== 'any' && (c.kind || 'channel') !== CAT.kind) return false;
    var pm = priceMax[CAT.price]; if(pm == null) pm = Infinity;
    if((c.price || 0) > pm) return false;
    return true;   /* поиск накладывается в DOM, чтобы не пересоздавать поле ввода */
  });

  /* сортировка стабильная и объяснимая: никакого Math.random в компараторе */
  list.sort(function(a, b){
    if(CAT.sort === 'cheap') return (a.price || 0) - (b.price || 0) || cmpName(a, b);
    if(CAT.sort === 'free')  return (a.price ? 1 : 0) - (b.price ? 1 : 0) || cmpName(a, b);
    if(CAT.sort === 'name')  return cmpName(a, b);
    return (b.subs || 0) - (a.subs || 0) || cmpName(a, b); // top
  });

  var NICHES = (core() && core().NICHES) || [];
  var nicheCount = {};
  all.forEach(function(c){ var n = niche(c); nicheCount[n] = (nicheCount[n] || 0) + 1; });

  var html = '<div class="cx2-note">' + I('info')
    + '<span>Каталог закрытых и платных каналов, клубов и курсов OKO. Сюда попадает только то, что создали авторы — '
    + 'витрину не наполняют выдуманными карточками. Комиссия платформы 10%, остальное получает автор.</span></div>';

  html += '<div class="cx2-search">' + I('search')
        + '<input type="search" id="cx2CatQ" placeholder="Поиск по каталогу" value="' + esc(S.catQ) + '"'
        + ' oninput="cx2CatFilter(this.value)" onkeydown="if(event.key===\'Escape\'){event.stopPropagation();this.value=\'\';cx2CatFilter(\'\')}" aria-label="Поиск по каталогу">'
        + '<button class="cx2-search-x" type="button" id="cx2CatQX" onclick="cx2CatClear()" aria-label="Очистить поиск"'
        + (S.catQ ? '' : ' hidden') + '>' + I('x') + '</button>'
        + '</div>';

  html += chipRow('Тема', NICHES.filter(function(n){ return n.k === 'all' || nicheCount[n.k]; })
          .map(function(n){ return [n.k, n.name, n.k === 'all' ? all.length : nicheCount[n.k]]; }), CAT.niche, 'niche');
  html += chipRow('Формат', [['any','Все',null],['channel','Каналы',null],['club','Клубы',null],['course','Курсы',null]], CAT.kind, 'kind');
  html += chipRow('Цена', [['any','Любая',null],['500','до 500 ₽',null],['1000','до 1000 ₽',null],['2500','до 2500 ₽',null],['5000','до 5000 ₽',null]], CAT.price, 'price');
  html += chipRow('Сортировка', [['top','По подписчикам',null],['cheap','Сначала дешевле',null],['free','Сначала бесплатные',null],['name','По названию',null]], CAT.sort, 'sort');

  var filtered = all.length !== list.length;
  var catEmpty = filtered
    ? '<div class="cx2-empty"><div class="cx2-empty-ic">' + I('mk-filter') + '</div><b>Под фильтры ничего не подошло</b>'
      + '<p>Сбрось фильтры и посмотри всё, что есть в каталоге сейчас.</p>'
      + '<button class="cx2-act ghost" type="button" onclick="cx2CatReset()">' + I('refresh') + 'Сбросить фильтры</button></div>'
    : '<div class="cx2-empty"><div class="cx2-empty-ic">' + I('bookmark') + '</div><b>В каталоге пока пусто</b>'
      + '<p>Закрытые и платные каналы появятся здесь, как только авторы их опубликуют. Можешь стать первым — создай платный канал, клуб или курс.</p>'
      + '<button class="cx2-act" type="button" onclick="cx2Create()">' + I('plus') + 'Создать</button></div>';

  html += '<div class="cx2-sec" id="cx2CatSec">' + I('bookmark') + 'Найдено<b id="cx2CatCount">' + list.length + '</b></div>';
  html += list.map(cardHtml).join('');
  html += '<div id="cx2CatNoRes" hidden></div>';

  return {
    title: 'Каталог',
    html: html,
    tools: '',
    after: function(){ applyFilter(S.catQ, 'cx2CatSec', 'cx2CatCount', 'cx2CatNoRes', 'cx2CatQX', catEmpty, 'cx2CatReset()'); }
  };
}
function cmpName(a, b){ return String(a.name || '').localeCompare(String(b.name || ''), 'ru'); }
function chipRow(label, items, cur, key){
  var h = '<div class="cx2-sec">' + I('mk-filter') + esc(label) + '</div><div class="cx2-chips">';
  items.forEach(function(it){
    h += '<button class="cx2-chip' + (cur === it[0] ? ' on' : '') + '" onclick="cx2CatSet(\'' + key + '\',\'' + it[0] + '\')">'
       + esc(it[1]) + (it[2] != null ? '<span class="cx2-chip-n">' + it[2] + '</span>' : '') + '</button>';
  });
  return h + '</div>';
}

/* =========================================================================
   СТРАНИЦА: СТАТИСТИКА — только реальные числа, остальное прочерк
   ========================================================================= */
function pageStats(id){
  var c = chan(id);
  if(!c || !isMine(c)) return { title:'Статистика', html:'<div class="cx2-empty"><b>Нет доступа</b><p>Статистику видит только владелец канала.</p></div>' };
  var m = metrics(c);
  var course = c.kind === 'course';

  var kpi = [
    kpiN('users', m.subs, 'подписчик', 'подписчика', 'подписчиков'),
    course ? kpiN('circle-play', m.lessons, 'урок', 'урока', 'уроков')
           : kpiN('feed', m.posts, 'пост', 'поста', 'постов'),
    kpiN('eye', m.views, 'просмотр постов', 'просмотра постов', 'просмотров постов'),
    kpiN('heart', m.likes, 'реакция', 'реакции', 'реакций')
  ];
  var kpi2 = [
    kpiN('comment', m.comments, 'комментарий', 'комментария', 'комментариев'),
    kpiN('poll', m.votes, 'голос в опросах', 'голоса в опросах', 'голосов в опросах'),
    kpiN('crown', m.admins, 'администратор', 'администратора', 'администраторов'),
    kpiN('lock', m.black, 'человек в чёрном списке', 'человека в чёрном списке', 'человек в чёрном списке')
  ];

  var html = '<div class="cx2-note">' + I('info')
    + '<span>Здесь только то, что приложение действительно посчитало на этом устройстве: '
    + '<b>ноль накрученных охватов и процентов</b>. Метрики, для которых нужен серверный лог событий, '
    + 'показаны прочерком — они появятся вместе с бэкендом, а не «примерно».</span></div>';

  html += '<div class="cx2-sec">' + I('chart') + 'Посчитано<b>сейчас</b></div>';
  html += '<div class="cx2-kpi">' + kpi.join('') + '</div>';
  html += '<div class="cx2-kpi">' + kpi2.join('') + '</div>';

  if(paid(c)){
    var fee = (core() && core().FEE) || 0.1;
    var net = Math.round(m.gross * (1 - fee));
    html += '<div class="cx2-sec">' + I('money') + 'Деньги</div>';
    html += '<div class="cx2-kpi">'
      + kpiTile(['card', rub(m.gross), 'выручка, ₽'])
      + kpiTile(['money', rub(net), 'ваш доход, ₽'])
      + '</div>';
    html += '<div class="cx2-note">' + I('info') + '<span>Выручка растёт только от настоящих оплат через кошелёк OKO. '
      + 'Пока продаж не было, здесь честные нули — приложение не рисует «примерный доход».</span></div>';
  }

  /* чего пока нет — и почему */
  html += '<div class="cx2-sec">' + I('clock') + 'Появится с бэкендом</div>';
  html += '<div class="cx2-pend">'
    + pendRow('rocket', 'Охват и прирост по дням', 'Нужен серверный журнал показов: кто и когда открыл пост. Локально приложение хранит только итоговый счётчик просмотров.')
    + pendRow('chart', 'График роста подписчиков', 'Нужна история подписок по датам. Сейчас известно только текущее число подписчиков — рисовать по нему «кривую роста» было бы выдумкой.')
    + pendRow('compass', 'Источники подписчиков', 'Нужно знать, откуда пришёл каждый человек: рекомендации, ссылка, поиск. Эти события фиксирует сервер.')
    + pendRow('heart', 'Вовлечённость в процентах', 'Считается как реакции к охвату. Охвата нет — значит и процента нет.')
    + '</div>';

  html += '<div class="cx2-note">' + I('shield') + '<span>Раньше на этом экране рисовались охват, вовлечённость, '
    + 'источники трафика и графики, посчитанные из длины id канала и генератора случайных чисел. Они удалены.</span></div>';
  html += '<div style="height:10px"></div>';

  return { title:'Статистика', html: html, tools:'' };
}
/* [иконка, значение, подпись]. Значение-число форматируется, строка печатается
   как есть, всё остальное (в т.ч. NaN и Infinity) превращается в честный прочерк. */
function kpiTile(t){
  var val = t[1], out;
  if(typeof val === 'string' && val) out = esc(val);
  else if(typeof val === 'number' && isFinite(val)) out = fmtN(val);
  else out = null;
  return '<div class="cx2-kpi-t' + (out == null ? ' dash' : '') + '">' + I(t[0])
    + '<b>' + (out == null ? '—' : out) + '</b><small>' + esc(t[2]) + '</small></div>';
}
/* плитка со счётчиком и правильным окончанием подписи: «1 подписчик», а не «1 подписчиков» */
function kpiN(ic, n, one, few, many){
  return kpiTile([ic, n, plural(n, one, few, many)]);
}
/* рубли: без «к», с неразрывными пробелами между разрядами */
function rub(n){
  n = Math.round(+n || 0);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function pendRow(ic, title, why){
  return '<div class="cx2-pend-row">' + I(ic) + '<div><b>' + esc(title) + '</b><small>' + esc(why) + '</small></div><i>—</i></div>';
}

/* =========================================================================
   СТРАНИЦА: ПОДПИСЧИКИ — реальный список, без «+N за неделю»
   ========================================================================= */
function pageSubs(id){
  var c = chan(id);
  if(!c || !isMine(c)) return { title:'Подписчики', html:'<div class="cx2-empty"><b>Нет доступа</b><p>Список участников видит только владелец.</p></div>' };
  var m = metrics(c);
  var me = profile();
  var members = c.members || [];

  var html = '<div class="cx2-kpi">'
    + kpiN('users', m.subs, 'подписчик', 'подписчика', 'подписчиков')
    + kpiN('user', members.length, 'в списке участников', 'в списке участников', 'в списке участников')
    + '</div>';

  if(members.length){
    html += '<div class="cx2-sec">' + I('user') + 'Участники<b>' + members.length + '</b></div>';
    html += '<div class="cx2-people">' + members.map(function(p, i){
      var self = p.name === me.name;
      var av = (core() && core().avSeedStyle(p.nick || p.name)) || '';
      return '<div class="cx2-person">'
        + '<div class="ch-av mini" style="' + av + '">' + esc(String(p.name || '?').charAt(0).toUpperCase()) + '</div>'
        + '<div class="cx2-pb"><b>' + esc(p.name || '') + '</b><small>@' + esc(p.nick || '') + (p.joined ? ' · вступил ' + esc(p.joined) : '') + '</small></div>'
        + (self
            ? '<span class="cx2-role">вы</span>'
            /* имя и ник в inline-обработчик НЕ подставляем: апостроф в имени
               порвал бы строку. Передаём индекс участника, остальное берём из модели. */
            : '<button class="cx2-pa" type="button" title="Написать" aria-label="Написать ' + attr(p.name) + '" onclick="cx2DM(\'' + c.id + '\',' + i + ')">' + I('send') + '</button>'
              + '<button class="cx2-pa danger" type="button" title="В чёрный список" aria-label="Заблокировать ' + attr(p.name) + '" onclick="cx2Ban(\'' + c.id + '\',' + i + ')">' + I('lock') + '</button>')
        + '</div>';
    }).join('') + '</div>';
  } else {
    html += '<div class="cx2-empty"><div class="cx2-empty-ic">' + I('users') + '</div>'
      + '<b>Участников пока нет</b><p>Поделись ссылкой на канал — вступившие появятся в этом списке. '
      + 'Приложение не подставляет сюда выдуманных людей.</p>'
      + '<button class="cx2-act ghost" type="button" onclick="chShareChannel(\'' + c.id + '\')">' + I('share') + 'Поделиться каналом</button></div>';
  }

  if(m.black){
    html += '<div class="cx2-note">' + I('lock') + '<span>В чёрном списке ' + m.black + ' '
      + plural(m.black, 'человек', 'человека', 'человек') + '. Управление — в разделе «Чёрный список».</span></div>';
  }
  html += '<div class="cx2-note">' + I('info') + '<span>Пофамильный список участников ведёт сервер. '
    + 'Пока приложение работает без бэкенда, здесь видно только тех, кто есть в локальной модели канала.</span></div>';
  html += '<div style="height:10px"></div>';

  return { title:'Подписчики', html: html, tools:'' };
}

/* =========================================================================
   ПАТЧИ СТРАНИЦ, КОТОРЫЕ РИСУЕТ ЯДРО (точечная правка DOM после рендера)
   ========================================================================= */
function patchPage(body, page){
  var id = (page && typeof page.arg === 'string') ? page.arg : null;
  var c = id ? chan(id) : null;

  switch(page.page){
    case 'channel':   patchChannel(body, c); break;
    case 'create':    patchCreate(body); break;
    case 'compose':   patchCompose(body, c); break;
    case 'lesson':    patchLesson(body, page.arg); break;
    case 'mAppear':   patchAppear(body, c); break;
    case 'manage':    patchManage(body, c); break;
    case 'mInvites':  patchInvites(body, c); break;
    case 'mAdmins':   patchAdmins(body, c); break;
  }
  /* сквозное: множественные числа у опросов + честная подпись «нет голосов» */
  fixPolls(body);
}

/* --- страница канала --- */
function patchChannel(body, c){
  /* блок отзывов ядра — рисуется по выдуманному количеству; после санитайзера
     его быть не должно, но подстраховываемся: без реальных отзывов сносим */
  body.querySelectorAll('.ch-reviews').forEach(function(el){
    var hasReal = c && Array.isArray(c.reviewsList) && c.reviewsList.length;
    if(!hasReal) el.remove();
  });
  /* витрина закрытого канала: ядро подставляет два выдуманных «закрытых поста»
     под блюр, если постов нет. Заменяем честным объяснением. */
  if(c && !(c.posts || []).length){
    var blur = body.querySelector('.ch-pw-blur');
    if(blur){
      blur.innerHTML = '<div class="cx2-gate">' + I('lock')
        + '<span>Автор ещё не опубликовал материалы. Здесь появятся посты канала — '
        + 'заглушек и примеров «как будто контент» мы не показываем.</span></div>';
    }
  }

  /* ВИТРИНА: ядро обещало от имени автора «практику и разбор твоих работ»,
     «чат поддержки», «новые материалы регулярно» — платформа не вправе давать
     такие обещания за автора. Меняем на проверяемые факты о канале. */
  var ben = c && body.querySelector('.ch-pw-benefits');
  if(ben){
    var mt = metrics(c);
    var facts = [];
    if(c.kind === 'course'){
      facts.push(mt.lessons ? mt.lessons + ' ' + plural(mt.lessons, 'урок', 'урока', 'уроков') + ' в курсе'
                            : 'Уроков пока нет — автор ещё наполняет курс');
      facts.push(paid(c) ? 'Оплата разовая, доступ не сгорает' : 'Доступ бесплатный');
    } else {
      facts.push(mt.posts ? mt.posts + ' ' + plural(mt.posts, 'пост', 'поста', 'постов') + ' уже опубликовано'
                          : 'Постов пока нет — канал только запускается');
      facts.push(paid(c) ? 'Подписка ' + c.price + ' ₽ в месяц, отмена в любой момент'
                         : 'Вступление бесплатное, выйти можно в любой момент');
    }
    facts.push(c.discussions ? 'Комментарии к постам включены' : 'Комментарии к постам выключены автором');
    facts.push(mt.subs ? mt.subs + ' ' + plural(mt.subs, 'участник', 'участника', 'участников') + ' уже внутри'
                       : 'Участников пока нет — ты можешь стать первым');
    ben.innerHTML = facts.map(function(f){
      return '<li>' + I('check') + '<span>' + esc(f) + '</span></li>';
    }).join('');
  }

  /* КУРС БЕЗ УРОКОВ. Ядро считало прогресс как done / lessons.length, то есть
     0/0 → на экране появлялся «NaN%». Показываем честный ноль и empty-state. */
  if(c && c.kind === 'course' && !(c.lessons || []).length){
    var pct = body.querySelector('.ch-pt-pct');
    if(pct) pct.textContent = '0%';
    var bar = body.querySelector('.ch-prog-bar i');
    if(bar) bar.style.width = '0%';
    var line = body.querySelector('.ch-prog-top > div:last-child');
    if(line && /из/.test(line.textContent)) line.textContent = 'В курсе пока нет уроков';
    /* пустой список уроков — добавляем объяснение после заголовка секции */
    var heads = body.querySelectorAll('.ch-sec-h');
    var lastHead = heads[heads.length - 1];
    if(lastHead && /Уроки/.test(lastHead.textContent) && !body.querySelector('#cx2NoLessons')){
      var box = document.createElement('div');
      box.id = 'cx2NoLessons';
      box.className = 'cx2-empty';
      box.innerHTML = '<div class="cx2-empty-ic">' + I('circle-play') + '</div>'
        + '<b>Уроков пока нет</b>'
        + '<p>' + (isMine(c)
            ? 'Добавь первый урок — он появится здесь, и у учеников начнёт считаться прогресс.'
            : 'Автор ещё не выложил уроки. Мы не подставляем в курс несуществующие занятия.') + '</p>'
        + (isMine(c) ? '<button class="cx2-act" type="button" onclick="chGo(\'addLesson\',\'' + c.id + '\')">'
            + I('plus') + 'Добавить урок</button>' : '');
      lastHead.parentNode.insertBefore(box, lastHead.nextSibling);
    }
  }
}

/* --- мастер создания: поле @ника с проверкой занятости --- */
function patchCreate(body){
  var name = body.querySelector('#chDName');
  if(!name || body.querySelector('#cx2Nick')) return;
  var d = window.chDraft || {};
  if(d.nick == null) d.nick = '';
  if(!d.nick && d.name) d.nick = normNick(translit(d.name));

  var wrap = document.createElement('div');
  wrap.innerHTML =
      '<label class="ch-lab" for="cx2Nick">Адрес канала — по нему находят и делятся</label>'
    + '<div class="cx2-nick" id="cx2NickBox"><span>@</span>'
    +   '<input id="cx2Nick" maxlength="18" autocomplete="off" autocapitalize="off" spellcheck="false"'
    +   ' placeholder="my_channel" value="' + esc(d.nick) + '" oninput="cx2NickInput(this.value)" aria-describedby="cx2NickMsg">'
    + '</div>'
    + '<div class="cx2-nick-msg" id="cx2NickMsg"></div>';
  /* вставляем сразу после поля названия */
  var ref = name.nextSibling;
  while(wrap.firstChild) name.parentNode.insertBefore(wrap.firstChild, ref);

  /* название печатают — ник подставляем автоматически, пока его не трогали руками */
  if(!name.dataset.cx2Bound){
    name.dataset.cx2Bound = '1';
    name.addEventListener('input', function(){
      var dd = window.chDraft || {};
      if(dd._nickTouched) return;
      dd.nick = normNick(translit(dd.name || name.value));
      var inp = document.getElementById('cx2Nick');
      if(inp) inp.value = dd.nick;
      paintNick();
    });
  }
  paintNick();
}
function paintNick(){
  var d = window.chDraft || {};
  var box = document.getElementById('cx2NickBox');
  var msg = document.getElementById('cx2NickMsg');
  var btn = document.getElementById('chCreateBtn');
  if(!box || !msg) return;
  var r = checkNick(d.nick);
  box.classList.toggle('good', r.tone === 'good');
  box.classList.toggle('bad', r.tone === 'bad');
  msg.className = 'cx2-nick-msg ' + (r.tone === 'dim' ? '' : r.tone);
  msg.textContent = r.msg;
  if(btn){
    var okName = String(d.name || '').trim().length > 0;
    var ok = okName && r.ok;
    btn.disabled = !ok;
    btn.style.opacity = ok ? '' : '0.5';
  }
}

/* --- композер поста: честная подпись про ленту рекомендаций --- */
function patchCompose(body, c){
  var note = body.querySelector('.ch-owner-note');
  if(!note) return;
  note.textContent = (c && c.autopost)
    ? 'Пост появится в канале и в твоей ленте рекомендаций. Показ новой аудитории заработает вместе с серверными рекомендациями — сейчас лента локальная.'
    : 'Авто-постинг в рекомендации выключен в управлении каналом: пост увидят только подписчики канала.';
}

/* --- урок: убираем сочинённое описание «в этом уроке разбираем…» --- */
function patchLesson(body, arg){
  var c = chan(arg && arg.c);
  var l = c && (c.lessons || []).filter(function(x){ return x.id === (arg && arg.l); })[0];
  var d = body.querySelector('.ch-desc');
  if(!d) return;
  if(l && l.desc){ d.textContent = l.desc; return; }
  d.innerHTML = '<span style="color:var(--dim)">Описание к уроку пока не добавлено. '
    + (c && isMine(c) ? 'Ты владелец курса — описание и видео подключаются вместе с Академией OKO.'
                      : 'Автор добавит его позже.') + '</span>';
}

/* --- оформление: проверка занятости @адреса + поле ссылки на сайт ---------
   Ядро меняло @адрес без всякой проверки: два канала могли получить один и тот
   же ник, и ссылка вела бы непонятно куда. Плюс ссылку на сайт можно было
   задать только при создании и только на PRO — здесь она редактируется. */
function patchAppear(body, c){
  if(!c) return;
  var nickInp = body.querySelector('#chNickEdit');
  if(nickInp && !body.querySelector('#cx2AppNickMsg')){
    var msg = document.createElement('div');
    msg.className = 'cx2-nick-msg';
    msg.id = 'cx2AppNickMsg';
    var row = nickInp.closest('.ch-price-row') || nickInp;
    row.parentNode.insertBefore(msg, row.nextSibling);
    nickInp.addEventListener('input', function(){ paintAppearNick(c.id); });
    paintAppearNick(c.id);
  }

  var descTa = body.querySelector('#chDescEdit');
  if(descTa && !body.querySelector('#cx2Site')){
    var wrap = document.createElement('div');
    wrap.innerHTML =
        '<label class="ch-lab" for="cx2Site">Ссылка на сайт <span style="font-weight:400;color:var(--dim)">— кнопкой в шапке канала</span></label>'
      + '<input class="ch-input cx2-brk" id="cx2Site" inputmode="url" placeholder="https://okoteam.top"'
      + ' value="' + esc(c.website || '') + '" oninput="cx2SetSite(\'' + c.id + '\',this.value)">'
      + '<div class="cx2-nick-msg" id="cx2SiteMsg"></div>';
    var ref = descTa.nextSibling;
    while(wrap.firstChild) descTa.parentNode.insertBefore(wrap.firstChild, ref);
    paintSite(c.id);
  }
}
function paintAppearNick(id){
  var c = chan(id); if(!c) return;
  var msg = document.getElementById('cx2AppNickMsg');
  var inp = document.getElementById('chNickEdit');
  if(!msg || !inp) return;
  var r = checkNick(inp.value, id);
  msg.className = 'cx2-nick-msg ' + (r.tone === 'dim' ? '' : r.tone);
  msg.textContent = r.ok ? '@' + normNick(inp.value) + ' — адрес свободен, сохранён' : r.msg;
  /* занятый или короткий адрес в модель не пишется (см. chSetNick) — у канала
     остаётся прежний рабочий, а поле подсвечено красным */
  inp.classList.toggle('cx2-bad', !r.ok);
}
window.cx2SetSite = function(id, v){
  var c = chan(id); if(!c) return;
  var s = String(v || '').trim().slice(0, 200);
  c.website = s;
  save();
  paintSite(id);
};
function paintSite(id){
  var c = chan(id); if(!c) return;
  var msg = document.getElementById('cx2SiteMsg'); if(!msg) return;
  var s = String(c.website || '').trim();
  if(!s){ msg.className = 'cx2-nick-msg'; msg.textContent = 'Не обязательно. Кнопка появится в шапке канала, если указать адрес.'; return; }
  var ok = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i.test(s);
  msg.className = 'cx2-nick-msg ' + (ok ? 'good' : 'bad');
  msg.textContent = ok ? 'Ссылка сохранена' : 'Нужен полный адрес вида https://example.com — иначе кнопка не появится';
}

/* --- управление: честная подпись у архива и удаления --- */
function patchManage(body, c){
  if(!c) return;
  /* шапка хаба: ядро писало «1 подписчиков» — правим окончание по числу */
  body.querySelectorAll('.ch-manage-hub div').forEach(function(d){
    if(d.children.length || !/подписчик/.test(d.textContent)) return;
    var n = +c.subs || 0;
    d.textContent = '@' + nickOf(c) + ' · ' + n + ' ' + plural(n, 'подписчик', 'подписчика', 'подписчиков');
  });

  body.querySelectorAll('.ch-row').forEach(function(row){
    var b = row.querySelector('.ch-row-main b');
    if(!b) return;
    var t = b.textContent.trim();
    if(t === 'Удалить канал'){
      var s = row.querySelector('.ch-row-main small');
      if(s) s.textContent = 'Необратимо: посты, подписки и настройки';
    }
    if(t === 'Оформление'){
      var s3 = row.querySelector('.ch-row-main small');
      if(s3) s3.textContent = 'Аватар, обложка, описание, @адрес, ссылка на сайт';
    }
    if(t === 'Архивировать' || t === 'В архиве'){
      var s2 = row.querySelector('.ch-row-main small');
      if(s2) s2.textContent = c.archived
        ? 'Канал скрыт в разделе «Архив» — вернуть можно этим же тумблером'
        : 'Уберёт канал из списков в отдельный раздел «Архив», не удаляя';
    }
  });
}

/* --- приглашения: честно про то, что ссылка ещё не открывается --- */
function patchInvites(body, c){
  var lf = body.querySelectorAll('.ch-lf');
  if(lf.length){
    lf[lf.length - 1].textContent = 'Код приглашения создаётся и сохраняется прямо сейчас. '
      + 'Переход по ссылке заработает, когда подключим серверную часть приглашений — до этого делись адресом канала выше.';
  }
  body.querySelectorAll('.ch-row .ch-row-main small').forEach(function(s){
    if(/^Любой откроет канал/.test(s.textContent)) s.textContent = 'Адрес канала внутри OKO';
  });
  body.querySelectorAll('.ch-row .ch-row-main b, .ch-row .ch-row-main small').forEach(function(el){
    el.classList.add('cx2-brk');
  });
}

/* --- админы: честное объяснение, если назначать некого --- */
function patchAdmins(body, c){
  if(!c) return;
  var me = profile();
  var cand = (c.members || []).filter(function(p){
    return p.name !== me.name && !(c.admins || []).some(function(a){ return a.nick === p.nick; });
  });
  var btn = body.querySelector('.ch-add-btn');
  if(btn && !cand.length){
    btn.disabled = true;
    btn.style.opacity = '.5';
    var note = document.createElement('div');
    note.className = 'cx2-note';
    note.innerHTML = I('info') + '<span>Администратором можно сделать только участника канала. '
      + 'Сейчас в канале никого, кроме тебя — пригласи людей, и они появятся в списке для назначения.</span>';
    btn.parentNode.insertBefore(note, btn.nextSibling);
  }
}

/* --- опросы: правильные окончания и честная подпись без голосов --- */
function fixPolls(body){
  body.querySelectorAll('.ch-poll-total').forEach(function(el){
    var mm = el.textContent.trim().match(/^(\d+)\s+голосов$/);
    if(!mm) return;
    var n = +mm[1];
    el.textContent = n > 0 ? n + ' ' + plural(n, 'голос', 'голоса', 'голосов') : 'Голосов пока нет';
  });
}

/* =========================================================================
   ПЕРЕХВАТ РЕНДЕРА: подменяем аксессор innerHTML на самом #chBody
   ========================================================================= */
var OWNED = { list: pageList, catalog: pageCatalog, mStats: pageStats, mSubs: pageSubs };
var BUSY = false;

function hookBody(){
  var body = document.getElementById('chBody');
  if(!body || body.__cx2Hooked) return !!(body && body.__cx2Hooked);
  var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if(!desc || !desc.set) return false;

  Object.defineProperty(body, 'innerHTML', {
    configurable: true,
    enumerable: false,
    get: function(){ return desc.get.call(this); },
    set: function(v){
      if(BUSY){ desc.set.call(this, v); return; }
      BUSY = true;
      var el = this;
      try{
        sanitize();
        var page = curPage();
        var own = OWNED[page.page];
        if(own){
          var out = own(page.arg);
          desc.set.call(el, out.html);
          setHead(out.title, out.tools);
          if(out.after) try{ out.after(); }catch(e){}
        } else {
          desc.set.call(el, v);
          try{ patchPage(el, page); }catch(e){}
        }
      }catch(err){
        /* никакая ошибка слоя не должна оставить человека с пустым экраном */
        try{ desc.set.call(el, v); }catch(e2){}
      } finally {
        BUSY = false;
      }
    }
  });
  body.__cx2Hooked = true;
  return true;
}
function setHead(title, tools){
  var t = document.getElementById('chHeadTitle');
  if(t && title) t.textContent = title;
  var tl = document.getElementById('chHeadTools');
  if(tl) tl.innerHTML = tools || '';
}

/* =========================================================================
   ОБРАБОТЧИКИ СЛОЯ (глобальные — вызываются из inline-разметки)
   ========================================================================= */

/* Поиск фильтрует уже отрисованные карточки. Никакого ре-рендера на каждую
   букву: страница перерисовывается только по смене сегмента или фильтра,
   иначе поле ввода теряло бы фокус и каретку после каждого символа. */
function applyFilter(q, secId, countId, noResId, xId, blankHtml, resetCall){
  var body = document.getElementById('chBody'); if(!body) return 0;
  var raw = String(q || '');
  q = raw.trim().toLowerCase();
  var shown = 0;
  body.querySelectorAll('.cx2-card').forEach(function(el){
    var c = chan(el.getAttribute('data-ch'));
    var ok = !c || matchQuery(c, q);
    el.hidden = !ok;
    if(ok) shown++;
  });
  var cnt = document.getElementById(countId); if(cnt) cnt.textContent = shown;
  var sec = document.getElementById(secId); if(sec) sec.hidden = !shown;
  var x   = document.getElementById(xId); if(x) x.hidden = !raw;
  var no  = document.getElementById(noResId);
  if(no){
    no.hidden = !!shown;
    /* «пусто без запроса» приходит один раз при рендере и запоминается на
       элементе — иначе Escape в поле поиска стирал бы объяснение */
    if(blankHtml != null) no.__blank = blankHtml;
    if(!shown) no.innerHTML = raw ? emptyQuery(raw, resetCall || 'cx2Reset()') : (no.__blank || '');
  }
  return shown;
}

window.cx2Filter = function(v){
  S.q = String(v || '');
  applyFilter(S.q, 'cx2Sec', 'cx2Count', 'cx2NoRes', 'cx2QX', null, 'cx2Reset()');
};
window.cx2ClearQ = function(){ S.q = ''; render(); requeueFocus('cx2Q'); };
window.cx2Seg = function(k){ S.seg = k; S.niche = 'all'; render(); };
window.cx2Niche = function(k){ S.niche = k; render(); };
window.cx2Reset = function(){ S.q = ''; S.niche = 'all'; S.seg = 'all'; render(); };
window.cx2Create = function(){ if(typeof chGo === 'function') chGo('create'); };

window.cx2CatFilter = function(v){
  S.catQ = String(v || '');
  applyFilter(S.catQ, 'cx2CatSec', 'cx2CatCount', 'cx2CatNoRes', 'cx2CatQX', null, 'cx2CatReset()');
};
window.cx2CatClear = function(){ S.catQ = ''; render(); requeueFocus('cx2CatQ'); };
window.cx2CatReset = function(){
  S.catQ = '';
  var CAT = core() && core().CAT;
  if(CAT){ CAT.niche = 'all'; CAT.price = 'any'; CAT.kind = 'any'; CAT.sort = 'top'; }
  render();
};
window.cx2CatSet = function(k, v){
  var CAT = core() && core().CAT;
  if(CAT) CAT[k] = v;
  render();
};
/* возвращаем каретку в поле поиска после полного ре-рендера страницы */
function requeueFocus(id){
  requestAnimationFrame(function(){
    var el = document.getElementById(id);
    if(!el) return;
    try{ el.focus({ preventScroll:true }); var n = el.value.length; el.setSelectionRange(n, n); }catch(e){ try{ el.focus(); }catch(e2){} }
  });
}

/* Подписка. Платное идёт только через кошелёк, закрытое-бесплатное — с честным
   предупреждением: канал заявляет «вступление по заявке», а модерация заявок
   появится вместе с сервером, поэтому сейчас доступ открывается сразу. */
window.cx2Follow = function(id){
  var c = chan(id); if(!c) return;
  if(paid(c)){ if(typeof chSubscribe === 'function') chSubscribe(id); return; }

  var grant = function(){
    var m = CH(); if(!m) return;
    if(!m.sub[id]){ m.sub[id] = 1; c.subs = (+c.subs || 0) + 1; save(); }
    say(gated(c) ? 'Вы в канале «' + c.name + '»' : 'Подписка на «' + c.name + '» оформлена');
    render();
  };

  if(gated(c)){
    if(!popup({ ico:'lock', title:'Вступить в закрытый канал?',
      body:'«' + esc(c.name) + '» помечен как закрытый: по замыслу вступление идёт по заявке владельцу. '
         + 'Разбор заявок появится вместе с серверной частью — пока приложение открывает доступ сразу. '
         + 'Мы говорим об этом прямо, чтобы ты не думал, что заявку кто-то одобрил.',
      actions:[{ label:'Вступить', onclick: grant }, { label:'Отмена', ghost:true }] })) grant();
    return;
  }
  grant();
};
window.cx2Unfollow = function(id){
  var c = chan(id); if(!c) return;
  var m = CH(); if(!m) return;
  var lose = gated(c)
    ? 'Ты потеряешь доступ к закрытым материалам «' + esc(c.name) + '». Вернуться можно в любой момент.'
    : 'Новые посты «' + esc(c.name) + '» перестанут приходить. Канал останется в разделе «Рекомендуем».';
  var act = function(){
    if(m.sub[id]){ delete m.sub[id]; if(+c.subs > 0) c.subs = +c.subs - 1; save(); }
    say('Подписка отменена');
    render();
  };
  if(!popup({ ico:'flag', title:'Отписаться?', body: lose,
    actions:[{ label:'Отписаться', onclick: act }, { label:'Остаться', ghost:true }] })) act();
};

/* блокировка участника с подтверждением (ядро банило молча) */
window.cx2DM = function(id, i){
  var c = chan(id); if(!c) return;
  var p = (c.members || [])[i]; if(!p) return;
  if(typeof chDM === 'function') chDM(p.name, p.nick); else say('Мессенджер недоступен');
};
window.cx2Ban = function(id, i){
  var c = chan(id); if(!c) return;
  var p = (c.members || [])[i]; if(!p) return;
  var act = function(){ if(typeof chBanMember === 'function') chBanMember(id, p.nick); };
  if(!popup({ ico:'lock', title:'В чёрный список?',
    body:'«' + esc(p.name) + '» потеряет доступ к каналу и не сможет подписаться снова. Разблокировать можно в разделе «Чёрный список».',
    actions:[{ label:'Заблокировать', onclick: act }, { label:'Отмена', ghost:true }] })) act();
};

/* @ник в мастере создания */
window.cx2NickInput = function(v){
  var d = window.chDraft || {};
  var n = normNick(v);
  d.nick = n; d._nickTouched = true;
  var inp = document.getElementById('cx2Nick');
  if(inp && inp.value !== n) inp.value = n;
  paintNick();
};

/* =========================================================================
   ПЕРЕОПРЕДЕЛЕНИЯ ОБРАБОТЧИКОВ ЯДРА — честные действия
   ========================================================================= */
function overrideHandlers(){

  /* поделиться: реальный share или реальное копирование */
  window.chShareChannel = function(id){
    var c = chan(id); if(!c) return;
    var url = 'https://' + publicLink(c);
    try{
      if(navigator.share){
        navigator.share({ title: c.name, text: kindLabel(c) + ' в OKO', url: url })
          .then(function(){ /* системный лист сам подтвердил — молчим */ })
          .catch(function(){ /* человек закрыл лист — «поделились» не пишем */ });
        return;
      }
    }catch(e){}
    copyText(publicLink(c), 'Ссылка на канал скопирована');
  };

  /* @адрес канала: ядро писало любую строку, в том числе уже занятую другим
     каналом. Теперь в модель попадает только свободный корректный адрес,
     а человек продолжает печатать и видит, что не так. */
  window.chSetNick = function(id, v){
    var c = chan(id); if(!c) return;
    var r = checkNick(v, id);
    if(r.ok){
      c.nick = normNick(v);
      save();
      try{ core().syncMirror(c); }catch(e){}
      var pid = document.querySelector('#chBody .ch-ap-id');
      if(pid) pid.textContent = '@' + c.nick;
    }
    paintAppearNick(id);
  };

  /* копирование адреса и инвайтов — тост только по факту успеха */
  window.chCopyLink = function(id){
    var c = chan(id); if(!c) return;
    copyText(publicLink(c), 'Адрес канала скопирован');
  };
  window.chCopyInvite = function(id, i){
    var c = chan(id); if(!c || !c.invites || !c.invites[i]) return;
    copyText(c.invites[i].link, 'Код приглашения скопирован');
  };
  window.chNewInvite = function(id){
    var c = chan(id); if(!c) return;
    c.invites = c.invites || [];
    var code = inviteCode();
    c.invites.unshift({ link: publicLink(c).replace(/\/@.*$/, '') + '/+' + code, when:'сейчас', limit:0 });
    save(); render();
    say('Код приглашения создан и сохранён');
  };

  /* меню «Ещё»: жалоба больше не врёт про отправку на модерацию */
  window.chMoreMenu = function(id){
    var c = chan(id); if(!c) return;
    var mine = isMine(c);
    /* это меню, а не выбор: все пункты равнозначны, поэтому ни один не красим
       в основную кнопку — иначе шесть лаймовых плашек подряд */
    var acts = [
      { label:'Поделиться', ghost:true, onclick: function(){ window.chShareChannel(id); } },
      { label:'Скопировать адрес', ghost:true, onclick: function(){ window.chCopyLink(id); } }
    ];
    if(mine){
      acts.push({ label:'Управление каналом', ghost:true, onclick: function(){ chGo('manage', id); } });
      acts.push({ label:'Статистика', ghost:true, onclick: function(){ chGo('mStats', id); } });
    } else {
      var on = core().notifyOn(c);
      acts.push({ label: on ? 'Выключить уведомления' : 'Включить уведомления', ghost:true, onclick: function(){ window.chToggleNotify(id); } });
      acts.push({ label:'Пожаловаться', ghost:true, onclick: function(){ cx2Report(c); } });
      if(isFollowing(id)) acts.push({ label: paid(c) ? 'Отменить подписку' : 'Отписаться', ghost:true, onclick: function(){ window.cx2Unfollow(id); } });
    }
    acts.push({ label:'Закрыть', ghost:true });
    popup({ ico:'more', title: esc(c.name), body:'@' + esc(nickOf(c)), actions: acts });
  };

  /* публикация: уважаем выключенный авто-постинг и не обещаем чужую аудиторию */
  var corePublish = window.chPublishPost;
  window.chPublishPost = function(id){
    var c = chan(id); if(!c || typeof corePublish !== 'function') return;
    var auto = c.autopost !== false;
    var realToast = window.toast;
    window.toast = function(msg){
      if(/опубликован/i.test(String(msg))){
        msg = auto
          ? 'Пост опубликован — он в канале и в твоей ленте'
          : 'Пост опубликован в канале. Авто-постинг в рекомендации выключен';
      }
      try{ realToast(msg); }catch(e){}
    };
    try{ corePublish(id); } finally { window.toast = realToast; }

    /* авто-постинг выключен → убираем запись, которую ядро всё равно добавило в ленту */
    if(!auto){
      var p = (c.posts || [])[0];
      try{
        if(p && p._feedId && typeof POSTS !== 'undefined' && POSTS.rec){
          var k = -1;
          for(var i = 0; i < POSTS.rec.length; i++){ if(POSTS.rec[i].id === p._feedId){ k = i; break; } }
          if(k >= 0){
            POSTS.rec.splice(k, 1);
            if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined' && curFeedKind === 'rec') renderFeed('rec');
          }
        }
      }catch(e){}
    }
  };

  /* создание канала: ник с проверкой + без сочинённого первого поста */
  var coreCreate = window.chCreateChannel;
  window.chCreateChannel = function(){
    var d = window.chDraft || {};
    var name = String(d.name || '').trim();
    if(!name){ say('Введите название'); return; }
    if(!d.nick) d.nick = normNick(translit(name));
    var r = checkNick(d.nick);
    if(!r.ok){
      say(r.tone === 'bad' ? r.msg : 'Задай адрес канала: латиница, цифры и «_», от 3 символов');
      var inp = document.getElementById('cx2Nick');
      if(inp) try{ inp.focus(); }catch(e){}
      return;
    }
    var wanted = normNick(d.nick);
    var m = CH();
    var before = m ? (m.mine || []).length : 0;
    if(typeof coreCreate === 'function') coreCreate();
    var after = m ? (m.mine || []).length : 0;
    if(after > before){
      var c = m.mine[0];
      c.nick = wanted;
      /* ядро клало в новый канал пост «Канал создан…», которого владелец не писал */
      c.posts = [];
      c.pinned = null;
      save();
      try{ core().syncMirror(c); }catch(e){}
    }
    d.nick = ''; d._nickTouched = false;
  };

  /* удаление: последствия перечислены, связанные данные вычищены */
  window.chDeleteChannel = function(id){
    var c = chan(id); if(!c) return;
    var m = CH(); if(!m) return;
    var mt = metrics(c);

    var lines = [
      (mt.posts ? mt.posts + ' ' + plural(mt.posts, 'пост', 'поста', 'постов') : 'посты канала')
        + ' вместе с реакциями и комментариями',
      mt.subs
        ? mt.subs + ' ' + plural(mt.subs, 'подписчик', 'подписчика', 'подписчиков') + ' '
          + plural(mt.subs, 'потеряет', 'потеряют', 'потеряют') + ' доступ'
        : 'доступ у подписчиков (сейчас их нет)',
      'настройки, администраторы, чёрный список и пригласительные коды',
      'адрес @' + esc(nickOf(c)) + ' освободится — его сможет занять кто угодно'
    ];
    if(c.kind === 'course' && mt.lessons) lines.splice(1, 0, mt.lessons + ' ' + plural(mt.lessons, 'урок', 'урока', 'уроков') + ' и прогресс учеников');
    if(paid(c) && mt.gross > 0) lines.push('история продаж на ' + rub(mt.gross) + ' ₽ перестанет отображаться');

    var body = '<p>Канал «' + esc(c.name) + '» будет удалён без возможности восстановить.</p>'
             + '<p><b>Что исчезнет:</b></p><ul style="margin:6px 0 0;padding-left:18px;text-align:left">'
             + lines.map(function(l){ return '<li style="margin:4px 0">' + l + '</li>'; }).join('')
             + '</ul><p style="margin-top:10px">Если нужно просто убрать канал из списков — вместо удаления включи «Архивировать».</p>';

    var act = function(){
      /* чистим ВСЁ, что было привязано к каналу, а не только запись в списке */
      var ids = (c.posts || []).map(postId);
      ids.forEach(function(pid){
        if(m.likes) delete m.likes[pid];
        if(m.cmt) delete m.cmt[pid];
        if(m.votes) delete m.votes[pid];
      });
      if(m.sub) delete m.sub[id];
      if(m.notify) delete m.notify[id];
      if(m.prog) delete m.prog[id];
      m.mine = (m.mine || []).filter(function(x){ return x.id !== id; });
      m.disc = (m.disc || []).filter(function(x){ return x.id !== id; });
      save();

      /* зеркало в мессенджере */
      try{
        if(typeof CHATS !== 'undefined'){
          for(var i = CHATS.length - 1; i >= 0; i--) if(CHATS[i].chId === id) CHATS.splice(i, 1);
          if(typeof renderChatList === 'function') renderChatList();
        }
      }catch(e){}
      /* посты канала в ленте рекомендаций */
      try{
        if(typeof POSTS !== 'undefined' && POSTS.rec){
          for(var j = POSTS.rec.length - 1; j >= 0; j--) if(POSTS.rec[j].chOrigin === id) POSTS.rec.splice(j, 1);
          if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined' && curFeedKind === 'rec') renderFeed('rec');
        }
      }catch(e){}
      try{ core().prowCount(); }catch(e){}

      say('Канал «' + c.name + '» удалён');
      core().setNav([{ page:'list' }]);
      render();
    };

    if(!popup({ ico:'trash', title:'Удалить канал?', body: body,
      actions:[{ label:'Удалить навсегда', onclick: act }, { label:'Оставить', ghost:true }] })) act();
  };

  /* назначение админа: выбор из участников, а не «первый попавшийся» */
  window.chAddAdmin = function(id){
    var c = chan(id); if(!c) return;
    var me = profile();
    var cand = (c.members || []).filter(function(p){
      return p.name !== me.name && !(c.admins || []).some(function(a){ return a.nick === p.nick; });
    });
    if(!cand.length){
      popup({ ico:'info', title:'Некого назначить',
        body:'Администратором можно сделать только участника канала. Сейчас в канале никого, кроме тебя. Поделись ссылкой на канал — как только люди вступят, они появятся в этом списке.',
        actions:[{ label:'Поделиться каналом', onclick: function(){ window.chShareChannel(id); } }, { label:'Понятно', ghost:true }] });
      return;
    }
    var acts = cand.slice(0, 8).map(function(p){
      return { label: esc(p.name) + ' · @' + esc(p.nick), onclick: function(){
        c.admins = c.admins || [];
        c.admins.push({ name:p.name, nick:p.nick, rights: core().defaultRights() });
        save();
        say(p.name + ' назначен администратором');
        chGo('mAdminRights', { c:id, i: c.admins.length - 1 });
      }};
    });
    acts.push({ label:'Отмена', ghost:true });
    popup({ ico:'crown', title:'Кого назначить админом', body:'Выбери участника канала — права настроишь на следующем шаге.', actions: acts });
  };

  /* платная подписка: не приписываем начисление автору, которого нет */
  var coreSubscribe = window.chSubscribe;
  window.chSubscribe = function(id){
    var c = chan(id);
    if(!c || typeof coreSubscribe !== 'function') return;
    /* бесплатный вход (в том числе в закрытый канал) — через наш честный путь:
       он предупреждает, что заявку никто не одобрял, её просто некому одобрять */
    if(!paid(c)){ window.cx2Follow(id); return; }
    var realPopup = window.showPopup;
    window.showPopup = function(o){
      try{
        if(o && /Автору начислено/.test(String(o.body || ''))){
          var fee = (core() && core().FEE) || 0.1;
          o.body = 'Списано ' + c.price + ' ₽ с кошелька OKO. Комиссия платформы 10% ('
                 + Math.round(c.price * fee) + ' ₽), остальное учтено как доход канала. '
                 + 'Перевод денег автору проходит на стороне сервера — в приложении это только запись об оплате.';
        }
      }catch(e){}
      return realPopup.apply(this, arguments);
    };
    try{ coreSubscribe(id); } finally { window.showPopup = realPopup; }
  };
}

/* код приглашения: криптостойкий, если браузер умеет, иначе Math.random */
function inviteCode(){
  var ABC = 'abcdefghijkmnpqrstuvwxyz23456789';   // без похожих l/1/o/0
  try{
    var buf = new Uint8Array(8);
    if(window.crypto && window.crypto.getRandomValues){
      window.crypto.getRandomValues(buf);
      return Array.prototype.map.call(buf, function(b){ return ABC[b % ABC.length]; }).join('');
    }
  }catch(e){}
  var s = '';
  for(var i = 0; i < 8; i++) s += ABC[Math.floor(Math.random() * ABC.length)];
  return s;
}

/* честная жалоба: не пишем «отправлено», пока отправлять некуда */
function cx2Report(c){
  popup({ ico:'flag', title:'Пожаловаться на канал',
    body:'Жалобы разбирает модерация OKO. Автоматическая отправка подключается вместе с серверной частью — '
       + 'сейчас приложение не может отправить жалобу, и делать вид, что отправило, не будет. '
       + 'Опиши проблему в «Поддержку OKO» и приложи адрес канала @' + esc(nickOf(c)) + ' — так она точно дойдёт.',
    actions:[
      { label:'Скопировать адрес канала', onclick: function(){ copyText(publicLink(c), 'Адрес канала скопирован'); } },
      { label:'Закрыть', ghost:true }
    ] });
}

/* =========================================================================
   ВЫХОД ПО ESCAPE.
   Кнопка «назад» в шапке раздела работала всегда, а Escape — как повезёт:
   раздел не зарегистрирован в списке слоёв, которые гасит общий обработчик
   (oko-v2), поэтому на подстраницах управления клавиша просто ничего не
   делала. Вешаем свой обработчик: один Escape — один шаг назад, на корне —
   закрытие раздела. Поведение совпадает с кнопкой в шапке.
   ========================================================================= */
function bindEscape(){
  if(window.__cx2Esc) return;
  window.__cx2Esc = true;
  document.addEventListener('keydown', function(ev){
    if(ev.key !== 'Escape' && ev.key !== 'Esc') return;
    var v = document.getElementById('chView');
    if(!v || !v.classList.contains('open')) return;
    /* попап и шторка закрываются своими обработчиками — не перехватываем */
    if(document.getElementById('okoPopup')) return;
    if(document.querySelector('.sheet.open, .sheet-wrap.open')) return;
    /* курсор в поле ввода: первый Escape очищает поле (см. поиск), не выходим */
    var t = ev.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)){
      if(t.value) return;
    }
    ev.preventDefault();
    ev.stopImmediatePropagation();   /* чтобы общий обработчик не сделал второй шаг */
    try{ if(typeof chBack === 'function') chBack(); }catch(e){}
  }, true);
}

/* =========================================================================
   ЗАПУСК
   ========================================================================= */
function boot(){
  if(!core()){ return false; }
  injectStyles();
  sanitize();
  if(!hookBody()) return false;
  overrideHandlers();
  bindEscape();
  /* если раздел уже открыт (горячая перезагрузка слоя) — перерисуем */
  try{
    var v = document.getElementById('chView');
    if(v && v.classList.contains('open')) render();
  }catch(e){}
  return true;
}

function start(){
  if(boot()) return;
  /* ядро могло ещё не выполнить свой IIFE — ждём его несколько кадров */
  var tries = 0;
  var t = setInterval(function(){
    if(boot() || ++tries > 120) clearInterval(t);
  }, 50);
}

if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
else start();

})();
