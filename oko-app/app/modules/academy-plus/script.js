/* ===== ACADEMY-PLUS: Duolingo + Coursera + Skillshare механики =====
   Всё поверх academy через chain-patch — базовый модуль не трогаем.
   Префикс: acd- (CSS/HTML), apd (JS-функции). */
(function acdInit(){
  if(typeof acRender !== 'function' || typeof AC_COURSES === 'undefined'){
    // academy не загружен — тихо выходим
    return;
  }

  /* =============================================================
     ХРАНИЛИЩЕ: расширяем acS собственными разделами (пишет acSave)
     ============================================================= */
  function apdEnsureStore(){
    if(!acS.notes) acS.notes = {};       // {lessonIdx: text}
    if(!acS.comments) acS.comments = {}; // {lessonIdx: [rec]}
    if(!acS.filter) acS.filter = 'all';  // текущий фильтр каталога
    if(typeof acS.streakWeeksPaid !== 'number') acS.streakWeeksPaid = 0;
  }
  apdEnsureStore();

  /* =============================================================
     3. XP + STREAK: связка с играми (gmXpAdd) — +30 XP за урок,
        +100 XP за каждые 7 дней подряд в учёбе (один раз на неделю).
     ============================================================= */
  const APD_XP_LESSON = 30;
  const APD_XP_STREAK_7 = 100;
  function apdAwardLessonXP(){
    try{
      const ls = acLS();
      if(ls.xpAwarded) return;
      ls.xpAwarded = true; acSave();
      if(typeof gmXpAdd === 'function') gmXpAdd(APD_XP_LESSON, 'academy:lesson:'+acL);
      toast('+' + APD_XP_LESSON + ' XP · урок освоен');
      // Стрик-бонус: за каждую 7-дневную серию — один раз
      const st = acStreak();
      if(st && st.days >= 7){
        const wk = Math.floor(st.days / 7);
        if(wk > (acS.streakWeeksPaid||0)){
          acS.streakWeeksPaid = wk; acSave();
          if(typeof gmXpAdd === 'function') gmXpAdd(APD_XP_STREAK_7, 'academy:streak:'+(wk*7));
          setTimeout(()=>toast('Серия ' + (wk*7) + ' дней · +' + APD_XP_STREAK_7 + ' XP'), 1200);
        }
      }
    }catch(e){}
  }
  // chain-patch: после того, как academy засчитала последний чек-пойнт
  const _apdPrevAfter = window.acAfterCheckpoint;
  window.acAfterCheckpoint = function(){
    try{ _apdPrevAfter && _apdPrevAfter.apply(this, arguments); }catch(e){}
    try{ if(acLessonPct(acL) === 100) apdAwardLessonXP(); }catch(e){}
    apdRerenderStepRail();
  };

  /* =============================================================
     Утилита: инъекция плагин-контента в конец страницы урока
     ============================================================= */
  function apdInjectLessonExtras(){
    try{
      if(acView !== 'lesson') return;
      const root = document.getElementById('acRoot');
      if(!root) return;
      // 2. Прогресс-таймлайн — в самое начало (после кнопки Назад)
      const back = root.querySelector('.ac-back');
      if(back && !root.querySelector('.acd-steprail')){
        const rail = document.createElement('div');
        rail.className = 'acd-steprail';
        rail.id = 'acdStepRail';
        rail.innerHTML = apdStepRailHtml();
        back.insertAdjacentElement('afterend', rail);
      }
      // 7. Рекомендации — перед последней "заглушкой" (перед acCertBox)
      const certBox = document.getElementById('acCertBox');
      if(certBox && !root.querySelector('#acdReco')){
        const reco = document.createElement('div');
        reco.id = 'acdReco';
        reco.innerHTML = apdRecoHtml();
        certBox.parentNode.insertBefore(reco, certBox);
      }
      // 6. Комментарии — после сертификата
      if(certBox && !root.querySelector('#acdComments')){
        const cm = document.createElement('div');
        cm.id = 'acdComments';
        cm.className = 'card acd-comments';
        cm.innerHTML = apdCommentsInnerHtml();
        // вставляем СРАЗУ ПОСЛЕ acCertBox
        certBox.parentNode.insertBefore(cm, certBox.nextSibling);
      }
      // 9. Кнопка «Заметки» (плавающая)
      apdMountNotesFab();
    }catch(e){}
  }
  function apdRemoveLessonExtras(){
    ['acdStepRail','acdReco','acdComments','acdNotesFab'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.remove();
    });
  }

  /* =============================================================
     2. ПРОГРЕСС-ТАЙМЛАЙН УРОКА (Coursera-стиль)
     ============================================================= */
  const APD_STEPS = [
    {k:'slides',   ic:'file',        lbl:'Слайды',   anchor:'#acSlidesBox'},
    {k:'test',     ic:'poll',        lbl:'Тест',     anchor:'#acTestBox'},
    {k:'task',     ic:'edit',        lbl:'Практика', anchor:'#acTaskBox'},
    {k:'game',     ic:'bolt',        lbl:'Игра',     anchor:'#acGameBox'},
    {k:'cert',     ic:'star',        lbl:'Диплом',   anchor:'#acCertBox'},
  ];
  function apdStepStatus(k){
    const ls = acLS() || {};
    if(k === 'cert') return typeof acCourseDone==='function' && acCourseDone(acCourseOf(acL));
    return !!ls[k];
  }
  function apdStepRailHtml(){
    const done = APD_STEPS.filter(s=>apdStepStatus(s.k)).length;
    const pct = Math.round(done / APD_STEPS.length * 100);
    // текущий шаг = первый недоделанный (или последний, если всё)
    let curIdx = APD_STEPS.findIndex(s=>!apdStepStatus(s.k));
    if(curIdx < 0) curIdx = APD_STEPS.length - 1;
    const cells = APD_STEPS.map((s,i)=>{
      const d = apdStepStatus(s.k);
      const c = (i === curIdx && !d);
      const dot = d ? I('check2') : String(i+1);
      const sep = i < APD_STEPS.length-1 ? `<span class="acd-step-bar ${d?'done':''}"></span>` : '';
      return `<button class="acd-step ${d?'done':''} ${c?'cur':''}" onclick="apdStepGo('${s.anchor}')" aria-label="${esc(s.lbl)}">
                <span class="acd-step-dot">${dot}</span>
                <span class="acd-step-lbl">${esc(s.lbl)}</span>
              </button>${sep}`;
    }).join('');
    return `<div class="acd-steprail-head">
        <span>Шаг <b>${Math.min(curIdx+1, APD_STEPS.length)}</b> из ${APD_STEPS.length} · <b>${pct}%</b></span>
        <span class="acd-xp-badge">${I('bolt')} +${APD_XP_LESSON} XP</span>
      </div>
      <div class="acd-steprail-line">${cells}</div>
      <div class="acd-steprail-track"><i style="width:${pct}%"></i></div>`;
  }
  window.apdStepGo = function(anchor){
    const el = document.querySelector(anchor);
    if(!el) return;
    const m = document.querySelector('main');
    if(m){
      const rect = el.getBoundingClientRect();
      m.scrollTo({top: m.scrollTop + rect.top - 90, behavior:'smooth'});
    } else el.scrollIntoView({behavior:'smooth', block:'start'});
  };
  function apdRerenderStepRail(){
    const rail = document.getElementById('acdStepRail');
    if(rail) rail.innerHTML = apdStepRailHtml();
  }

  /* =============================================================
     7. РЕКОМЕНДАЦИЯ: "Ты закончил X → тебе понравится Y"
        Матчинг по инструментам (AC_TOOLS) + слова-теги из заголовков
     ============================================================= */
  function apdLessonTags(i){
    try{
      const L = AC_COURSE[i]; if(!L) return [];
      const hay = ((L.title||'') + ' ' + (L.slides||[]).map(s=>(s.pts||[]).join(' ')).join(' ')).toLowerCase();
      const t = [];
      if(typeof AC_TOOLS !== 'undefined'){
        Object.keys(AC_TOOLS).forEach(k=>{ if(hay.includes(k)) t.push('t:'+k); });
      }
      // ключевые слова-теги (частотные для направлений)
      ['промпт','видео','сторис','упаковка','контент','маркетинг','воронка','монетизация',
       'нейросети','автомат','агент','аналитик','копирайт','триггер','бренд','целевая','воронк']
        .forEach(w=>{ if(hay.includes(w)) t.push('w:'+w); });
      return t;
    }catch(e){ return []; }
  }
  function apdRecommendations(currentIdx, N){
    const N_ = N || 3;
    const curTags = new Set(apdLessonTags(currentIdx));
    const seen = new Set([currentIdx]);
    const scored = [];
    for(let i=0; i<AC_COURSE.length; i++){
      if(seen.has(i)) continue;
      if(typeof acUnlocked==='function' && !acUnlocked(i)) continue;
      if(typeof acLessonDone==='function' && acLessonDone(i)) continue;
      const tags = apdLessonTags(i);
      let score = 0;
      tags.forEach(t=>{ if(curTags.has(t)) score += (t.startsWith('t:') ? 3 : 1); });
      // бонус: соседний урок в том же курсе
      if(acCourseOf(i) === acCourseOf(currentIdx)) score += 1;
      // бонус: тот же блок
      const bA = AC_BLOCKS.find(b=>i>=b.from && i<b.from+b.count);
      const bB = AC_BLOCKS.find(b=>currentIdx>=b.from && b<b.from+b.count);
      if(bA && bB && bA.id === bB.id) score += 1;
      if(score > 0) scored.push({i, score, matches: tags.filter(t=>curTags.has(t))});
    }
    scored.sort((a,b)=> b.score - a.score);
    // fallback: если совпадений нет — предложим первые доступные незавершённые
    if(!scored.length){
      for(let i=0; i<AC_COURSE.length && scored.length<N_; i++){
        if(seen.has(i)) continue;
        if(typeof acUnlocked==='function' && !acUnlocked(i)) continue;
        if(typeof acLessonDone==='function' && acLessonDone(i)) continue;
        scored.push({i, score:0, matches:[]});
      }
    }
    return scored.slice(0, N_);
  }
  function apdRecoWhy(rec){
    if(!rec || !rec.matches || !rec.matches.length){
      return 'Дальше по программе';
    }
    const t = rec.matches.find(x=>x.startsWith('t:'));
    if(t){
      const key = t.slice(2);
      const tool = (typeof AC_TOOLS!=='undefined' && AC_TOOLS[key]) ? AC_TOOLS[key].name : key;
      return 'По ' + tool;
    }
    const w = rec.matches.find(x=>x.startsWith('w:'));
    if(w) return 'По теме';
    return 'Близко';
  }
  function apdRecoHtml(){
    const recs = apdRecommendations(acL, 3);
    if(!recs.length) return '';
    const rows = recs.map(r=>{
      const L = AC_COURSE[r.i];
      const ci = acCourseOf(r.i);
      const num = (typeof acLocalNo==='function') ? acLocalNo(r.i) : (r.i+1);
      const meta = AC_COURSES[ci].title + ' · урок ' + num;
      return `<button class="acd-reco-item" onclick="apdRecoGo(${r.i})">
        <span class="n">${num}</span>
        <span class="meta"><b>${esc(L.title)}</b><span>${esc(meta)}</span></span>
        <span class="why">${esc(apdRecoWhy(r))}</span>
        <svg class="i go"><use href="#i-chev"/></svg>
      </button>`;
    }).join('');
    return `<div class="card acd-reco">
      <div class="acd-reco-head">${I('rocket')} Тебе понравится · подобрано по темам урока</div>
      <div class="acd-reco-list">${rows}</div>
    </div>`;
  }
  window.apdRecoGo = function(i){ if(typeof acOpenLesson==='function') acOpenLesson(i); };

  /* =============================================================
     6. КОММЕНТАРИИ (localStorage, вложенные ответы, лайки)
     ============================================================= */
  function apdMe(){
    const nick = (window.PROFILE && PROFILE.nick) || 'guest';
    const name = (window.PROFILE && PROFILE.name) || 'Слушатель';
    return {nick, name};
  }
  function apdCommsFor(i){
    const st = acS.comments || {};
    if(!st[i]) st[i] = [];
    return st[i];
  }
  function apdAva(name){
    return esc((name||'?').trim().charAt(0).toUpperCase());
  }
  function apdWhen(ts){
    const d = Date.now() - ts;
    if(d < 60_000) return 'только что';
    if(d < 3600_000) return Math.floor(d/60_000) + ' мин назад';
    if(d < 86_400_000) return Math.floor(d/3_600_000) + ' ч назад';
    if(d < 30 * 86_400_000) return Math.floor(d/86_400_000) + ' д назад';
    return new Date(ts).toLocaleDateString('ru-RU');
  }
  function apdCommentsInnerHtml(){
    const list = apdCommsFor(acL);
    const cnt = list.reduce((n,c)=>n + 1 + ((c.replies||[]).length), 0);
    const me = apdMe();
    const body = list.length ? `<div class="acd-comment-list">${list.map(c=>apdCommentHtml(c)).join('')}</div>`
      : `<div class="acd-comment-empty">Пока никто не писал. Задай первый вопрос автору или поделись инсайтом — другим будет полезно.</div>`;
    return `<div class="acd-comments-head">
        <span class="ico">${I('comment')}</span>
        <div><b>Обсуждение урока</b><span class="n">${cnt} ${apdPlural(cnt,['ответ','ответа','ответов'])} · вопросы, инсайты, разбор кейсов</span></div>
      </div>
      <div class="acd-comment-form">
        <textarea class="acd-comment-ta" id="acdCommTa" placeholder="Задай вопрос автору или поделись, что откликнулось. Другим слушателям это поможет."></textarea>
        <div class="acd-comment-actions">
          <span>${esc(me.name)} · публично для всех</span>
          <button class="btn sm" onclick="apdCommSend()">${I('send')} Отправить</button>
        </div>
      </div>
      ${body}`;
  }
  function apdCommentHtml(c, isReply){
    const me = apdMe();
    const isMe = c.nick === me.nick;
    const liked = !!(c.likedBy && c.likedBy[me.nick]);
    const replies = (c.replies||[]).map(r=>apdCommentHtml(r, true)).join('');
    const clsRoot = isReply ? 'acd-comment acd-reply' : 'acd-comment';
    const replyForm = !isReply ? `
      <div class="acd-reply-form">
        <input type="text" id="acdRep_${c.id}" placeholder="Ответить…" onkeydown="if(event.key==='Enter')apdCommSend('${c.id}')">
        <button onclick="apdCommSend('${c.id}')">Ответить</button>
      </div>` : '';
    const del = isMe ? `<button class="acd-comment-act" onclick="apdCommDel('${c.id}')" title="Удалить">${I('plus')}</button>` : '';
    return `<div class="${clsRoot} ${isMe?'author':''}">
      <span class="ava">${apdAva(c.name)}</span>
      <div class="bd">
        <div class="hd"><b>${esc(c.name)}</b><span class="ts">${esc(apdWhen(c.ts))}</span></div>
        <div class="tx">${esc(c.text)}</div>
        <div class="acts">
          <button class="acd-comment-act ${liked?'liked':''}" onclick="apdCommLike('${c.id}')">${I('heart')} <span>${c.likes||0}</span></button>
          ${del}
        </div>
        ${replies ? `<div class="acd-replies">${replies}</div>` : ''}
        ${replyForm}
      </div>
    </div>`;
  }
  window.apdCommSend = function(parentId){
    let val;
    if(parentId){
      const inp = document.getElementById('acdRep_'+parentId);
      val = inp ? (inp.value||'').trim() : '';
      if(inp) inp.value = '';
    } else {
      const ta = document.getElementById('acdCommTa');
      val = ta ? (ta.value||'').trim() : '';
      if(ta) ta.value = '';
    }
    if(val.length < 2){ toast('Слишком коротко'); return; }
    const me = apdMe();
    const rec = {id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
                 name:me.name, nick:me.nick, text:val.slice(0,800), ts:Date.now(), likes:0, likedBy:{}};
    const arr = apdCommsFor(acL);
    if(parentId){
      const walk = (list)=>{
        for(const x of list){
          if(x.id === parentId){ x.replies = x.replies||[]; x.replies.push(rec); return true; }
          if(x.replies && walk(x.replies)) return true;
        }
        return false;
      };
      walk(arr);
    } else {
      arr.unshift(rec);
    }
    acSave();
    apdRefreshComments();
    if(!parentId) toast('Опубликовано');
  };
  window.apdCommLike = function(id){
    const me = apdMe();
    const arr = apdCommsFor(acL);
    const walk = (list)=>{
      for(const x of list){
        if(x.id === id){
          x.likedBy = x.likedBy || {};
          if(x.likedBy[me.nick]){ delete x.likedBy[me.nick]; x.likes = Math.max(0,(x.likes||1)-1); }
          else { x.likedBy[me.nick] = 1; x.likes = (x.likes||0)+1; }
          return true;
        }
        if(x.replies && walk(x.replies)) return true;
      }
      return false;
    };
    walk(arr);
    acSave();
    apdRefreshComments();
  };
  window.apdCommDel = function(id){
    const arr = apdCommsFor(acL);
    const idx = arr.findIndex(x=>x.id === id);
    if(idx >= 0){ arr.splice(idx,1); }
    else {
      // reply
      for(const x of arr){
        if(!x.replies) continue;
        const j = x.replies.findIndex(r=>r.id === id);
        if(j >= 0){ x.replies.splice(j,1); break; }
      }
    }
    acSave();
    apdRefreshComments();
    toast('Удалено');
  };
  function apdRefreshComments(){
    const box = document.getElementById('acdComments');
    if(box) box.innerHTML = apdCommentsInnerHtml();
  }
  function apdPlural(n, forms){
    const a = Math.abs(n) % 100, b = a % 10;
    if(a > 10 && a < 20) return forms[2];
    if(b > 1 && b < 5) return forms[1];
    if(b === 1) return forms[0];
    return forms[2];
  }

  /* =============================================================
     9. ЗАМЕТКИ К УРОКУ (плавающая кнопка + панель, localStorage)
     ============================================================= */
  function apdNoteText(){
    return (acS.notes && acS.notes[acL]) || '';
  }
  function apdMountNotesFab(){
    const scr = document.getElementById('screen-academy');
    if(!scr) return;
    const has = apdNoteText().length;
    let fab = document.getElementById('acdNotesFab');
    if(!fab){
      fab = document.createElement('button');
      fab.id = 'acdNotesFab';
      fab.className = 'acd-notes-fab';
      fab.setAttribute('aria-label','Заметки к уроку');
      fab.onclick = apdNotesOpen;
      document.body.appendChild(fab);
    }
    fab.innerHTML = I('edit') + (has ? '<span class="cnt">' + Math.min(999, has) + '</span>' : '');
  }
  window.apdNotesOpen = function(){
    let panel = document.getElementById('acdNotesPanel');
    if(!panel){
      panel = document.createElement('div');
      panel.id = 'acdNotesPanel';
      panel.className = 'acd-notes-panel';
      panel.onclick = function(e){ if(e.target === panel) apdNotesClose(); };
      document.body.appendChild(panel);
    }
    const L = acCur();
    panel.innerHTML = `
      <div class="acd-notes-card" onclick="event.stopPropagation()">
        <div class="acd-notes-hd">
          <span class="ico">${I('edit')}</span>
          <div class="tt"><b>Заметки к уроку</b><span>${esc(L.title)} · сохраняется автоматически на этом устройстве</span></div>
          <button class="cls" onclick="apdNotesClose()" aria-label="Закрыть">${I('plus')}</button>
        </div>
        <div class="acd-notes-body">
          <textarea class="acd-notes-ta" id="acdNotesTa" placeholder="Пиши инсайты, тезисы, вопросы, которые хочешь задать автору. Твои заметки — только твои: остаются на этом устройстве.">${esc(apdNoteText())}</textarea>
        </div>
        <div class="acd-notes-foot">
          <span class="meta">Слов: <b id="acdNotesWc">${apdWordCount(apdNoteText())}</b> · сохранено</span>
          <div class="acts">
            <button class="btn sm ghost" onclick="apdNotesClear()">Очистить</button>
            <button class="btn sm ghost" onclick="apdNotesExport()">${I('file')} Скопировать</button>
          </div>
        </div>
      </div>`;
    requestAnimationFrame(()=>panel.classList.add('open'));
    const ta = document.getElementById('acdNotesTa');
    if(ta){
      ta.addEventListener('input', ()=>{
        acS.notes[acL] = ta.value.slice(0, 12000);
        acSave();
        const wc = document.getElementById('acdNotesWc');
        if(wc) wc.textContent = apdWordCount(ta.value);
        apdMountNotesFab();
      });
      setTimeout(()=>ta.focus(), 50);
    }
  };
  window.apdNotesClose = function(){
    const p = document.getElementById('acdNotesPanel');
    if(p){ p.classList.remove('open'); }
  };
  window.apdNotesClear = function(){
    acS.notes[acL] = '';
    acSave();
    const ta = document.getElementById('acdNotesTa');
    if(ta) ta.value = '';
    const wc = document.getElementById('acdNotesWc');
    if(wc) wc.textContent = '0';
    apdMountNotesFab();
    toast('Заметки урока очищены');
  };
  window.apdNotesExport = function(){
    const t = apdNoteText();
    if(!t.trim()){ toast('Пусто — нечего копировать'); return; }
    const head = 'Заметки · ' + (acCur().title || 'урок') + '\n\n';
    const full = head + t;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(full).then(()=>toast('Скопировано в буфер')).catch(()=>toast('Не удалось скопировать'));
    } else {
      const ta = document.createElement('textarea'); ta.value = full;
      ta.style.cssText = 'position:fixed;top:-200px'; document.body.appendChild(ta);
      ta.select(); try{ document.execCommand('copy'); toast('Скопировано в буфер'); }catch(e){ toast('Не удалось'); }
      ta.remove();
    }
  };
  function apdWordCount(s){
    return String(s||'').trim().split(/\s+/).filter(Boolean).length;
  }

  /* =============================================================
     1. ЛЕНИВАЯ ЗАГРУЗКА БЛОКОВ (collapsible) — post-processing DOM
     ============================================================= */
  function apdSetupCollapsibleBlocks(){
    if(acView !== 'course') return;
    const root = document.getElementById('acRoot');
    if(!root) return;
    const blocks = root.querySelectorAll('.ac-block');
    if(!blocks.length) return;
    // Определяем блок текущего/след. урока (авто-открытие)
    let autoBlockId = null;
    try{
      const ci = acCourse;
      const idx = (typeof acCourseIdx==='function') ? acCourseIdx(ci) : [];
      const target = idx.find(i=>acUnlocked(i) && !acLessonDone(i));
      if(target !== undefined){
        const b = AC_BLOCKS.find(bl=>target>=bl.from && target<bl.from+bl.count);
        if(b) autoBlockId = b.id;
      }
    }catch(e){}
    let curBlockAssigned = false;
    blocks.forEach((blk, i)=>{
      // определить id блока по индексу — читаем из соседних .ac-lesson-row (не нужно, авто = первый)
      const head = blk.querySelector('.ac-block-head');
      const body = blk.querySelectorAll(':scope > *:not(.ac-block-head)');
      if(!head || !body.length) return;
      // Обернём body в div.acd-block-body, если ещё не обёрнуто
      if(!blk.querySelector(':scope > .acd-block-body')){
        const wrap = document.createElement('div');
        wrap.className = 'acd-block-body';
        body.forEach(n=>wrap.appendChild(n));
        blk.appendChild(wrap);
      }
      // Toggle кнопка
      if(!head.querySelector('.acd-block-toggle')){
        const btn = document.createElement('button');
        btn.className = 'acd-block-toggle';
        btn.setAttribute('aria-label','Развернуть/свернуть блок');
        btn.innerHTML = I('chev');
        btn.onclick = function(e){ e.stopPropagation(); apdBlockToggle(blk); };
        head.appendChild(btn);
      }
      head.onclick = function(){ apdBlockToggle(blk); };
      // По умолчанию: первый блок и блок с активным уроком — открыты, остальные свёрнуты
      const shouldOpen = (i === 0) || (!curBlockAssigned && autoBlockId && blk.textContent.includes('Блок'));
      // Более надёжная эвристика: первый блок — точно открыт. Второй проход ниже — по id.
      if(i === 0){ blk.classList.add('acd-open'); curBlockAssigned = true; }
      else blk.classList.add('acd-collapsed');
    });
    // Второй проход — открыть блок с активным уроком по данным AC_BLOCKS
    try{
      if(autoBlockId){
        const ci = acCourse;
        const localBlocks = acCourseBlocks(ci);   // массив блоков курса в правильном порядке
        const targetPos = localBlocks.findIndex(b=>b.id === autoBlockId);
        if(targetPos >= 0 && targetPos < blocks.length){
          blocks.forEach((b,i)=>{
            if(i === targetPos){ b.classList.remove('acd-collapsed'); b.classList.add('acd-open'); }
            else if(i !== 0){ b.classList.add('acd-collapsed'); b.classList.remove('acd-open'); }
          });
          // если targetPos !== 0, первый блок закроем — оставим фокус на активном
          if(targetPos !== 0){
            blocks[0].classList.remove('acd-open');
            blocks[0].classList.add('acd-collapsed');
          }
        }
      }
    }catch(e){}
  }
  window.apdBlockToggle = function(blk){
    if(!blk) return;
    if(blk.classList.contains('acd-collapsed')){
      blk.classList.remove('acd-collapsed');
      blk.classList.add('acd-open');
    } else {
      blk.classList.add('acd-collapsed');
      blk.classList.remove('acd-open');
    }
  };

  /* =============================================================
     10. ФИЛЬТРЫ КАТАЛОГА (чипы: Все / Бесплатное / В процессе / Не начатые)
     ============================================================= */
  const APD_FILTERS = [
    {k:'all',   lbl:'Все',            ic:'compass'},
    {k:'free',  lbl:'Бесплатное',     ic:'bolt'},
    {k:'prog',  lbl:'В процессе',     ic:'circle-play'},
    {k:'new',   lbl:'Не начатые',     ic:'flag'},
    {k:'done',  lbl:'Пройденные',     ic:'check2'},
  ];
  function apdCourseMatchesFilter(ci, filter){
    const c = AC_COURSES[ci];
    const pct = (typeof acCoursePctOf==='function') ? acCoursePctOf(ci) : 0;
    const done = (typeof acCourseDone==='function') && acCourseDone(ci);
    switch(filter){
      case 'free': return !!c.free;
      case 'prog': return pct > 0 && !done;
      case 'new':  return pct === 0;
      case 'done': return done;
      default: return true;
    }
  }
  function apdFilterCounts(){
    const cnt = {};
    APD_FILTERS.forEach(f=>{
      cnt[f.k] = 0;
      for(let ci=0; ci<AC_COURSES.length; ci++){
        if(apdCourseMatchesFilter(ci, f.k)) cnt[f.k]++;
      }
    });
    return cnt;
  }
  function apdFiltersHtml(){
    const cnt = apdFilterCounts();
    const on = acS.filter || 'all';
    return `<div class="acd-filters" id="acdFilters">${
      APD_FILTERS.map(f=>`<button class="acd-chip ${on===f.k?'on':''}" onclick="apdFilterSet('${f.k}')">
        ${I(f.ic)}<span>${esc(f.lbl)}</span><span class="n">${cnt[f.k]}</span>
      </button>`).join('')
    }</div>`;
  }
  window.apdFilterSet = function(k){
    acS.filter = k; acSave();
    apdApplyCatalogFilter();
    // подсветка чипов
    document.querySelectorAll('#acdFilters .acd-chip').forEach(el=>el.classList.remove('on'));
    const chip = document.querySelector('#acdFilters .acd-chip[onclick*="\'' + k + '\'"]');
    if(chip) chip.classList.add('on');
  };
  function apdApplyCatalogFilter(){
    if(acView !== 'home') return;
    const cat = document.querySelector('#acRoot .ac-catalog');
    if(!cat) return;
    const cards = cat.querySelectorAll('.ac-cc');
    const on = acS.filter || 'all';
    let vis = 0;
    cards.forEach((card, ci)=>{
      const show = apdCourseMatchesFilter(ci, on);
      card.classList.toggle('acd-hidden', !show);
      if(show) vis++;
    });
    // Пустой стейт
    let empty = cat.parentNode.querySelector('.acd-filters-empty');
    if(!vis){
      if(!empty){
        empty = document.createElement('div');
        empty.className = 'acd-filters-empty';
        empty.textContent = 'В этой категории пока нет курсов. Смени фильтр.';
        cat.parentNode.insertBefore(empty, cat.nextSibling);
      }
    } else if(empty){ empty.remove(); }
  }
  function apdInjectCatalogFilters(){
    if(acView !== 'home') return;
    const root = document.getElementById('acRoot');
    if(!root) return;
    if(root.querySelector('#acdFilters')) return;
    const cat = root.querySelector('.ac-catalog');
    if(!cat) return;
    const holder = document.createElement('div');
    holder.innerHTML = apdFiltersHtml();
    cat.parentNode.insertBefore(holder.firstElementChild, cat);
    apdApplyCatalogFilter();
  }

  /* =============================================================
     8. СКОРОСТЬ ВИДЕО: кнопка 1× → 1.25× → 1.5× → 2× → 0.75× → 1×
        Пост-обрабатываем acVpBar после render'а
     ============================================================= */
  const APD_SPEEDS = [1, 1.25, 1.5, 2, 0.75];
  function apdReadSpeed(){
    try{ const v = parseFloat(localStorage.getItem('oko-ac-speed')); return isFinite(v) && v > 0 ? v : 1; }catch(e){ return 1; }
  }
  function apdSaveSpeed(v){ try{ localStorage.setItem('oko-ac-speed', String(v)); }catch(e){} }
  function apdInjectSpeed(){
    const bar = document.getElementById('acVpBar');
    if(!bar || bar.querySelector('.acd-vp-speed')) return;
    const v = apdReadSpeed();
    const btn = document.createElement('button');
    btn.className = 'ac-vp-btn acd-vp-speed';
    btn.type = 'button';
    btn.setAttribute('aria-label','Скорость воспроизведения');
    btn.textContent = apdFmtSpeed(v);
    btn.onclick = function(e){ if(e) e.stopPropagation(); apdSpeedCycle(btn); };
    // ставим перед кнопкой fullscreen (последняя)
    const kids = bar.querySelectorAll('.ac-vp-btn');
    const last = kids[kids.length - 1];
    if(last) bar.insertBefore(btn, last);
    else bar.appendChild(btn);
    // применяем к видео
    apdApplySpeed(v);
  }
  function apdFmtSpeed(v){ return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2).replace(/0$/,'')) + '×'; }
  function apdSpeedCycle(btn){
    const cur = apdReadSpeed();
    const i = APD_SPEEDS.indexOf(cur);
    const nx = APD_SPEEDS[(i+1) % APD_SPEEDS.length];
    apdSaveSpeed(nx);
    if(btn) btn.textContent = apdFmtSpeed(nx);
    apdApplySpeed(nx);
    toast('Скорость · ' + apdFmtSpeed(nx));
  }
  function apdApplySpeed(v){
    try{ const vid = document.getElementById('acVpVideo'); if(vid) vid.playbackRate = v; }catch(e){}
  }

  /* =============================================================
     5. СЕРТИФИКАТ RU/EN: переключатель в full-overlay
     ============================================================= */
  window.acdCertLang = 'ru';
  const APD_CERT_I18N = {
    ru: {academy:'А К А Д Е М И Я   O K O', title:'СЕРТИФИКАТ',
         confirms:'подтверждает, что', passed:'успешно прошёл направление',
         courseOf:'курс «', courseOfEnd:'» Академии OKO',
         result:'Результат теста: ', dateLbl:'ДАТА ВЫДАЧИ', numLbl:'НОМЕР',
         sign:'/ Ильясов Д.А. /', signSub:'подпись руководителя Академии',
         officialDoc:'ОФИЦИАЛЬНЫЙ ДОКУМЕНТ'},
    en: {academy:'O K O   A C A D E M Y', title:'CERTIFICATE',
         confirms:'this is to certify that', passed:'has successfully completed the track',
         courseOf:'course "', courseOfEnd:'" of OKO Academy',
         result:'Test score: ', dateLbl:'ISSUE DATE', numLbl:'NUMBER',
         sign:'/ D. A. Ilyasov /', signSub:'Academy director',
         officialDoc:'OFFICIAL DOCUMENT'}
  };
  // chain-patch acMakeCert — переопределяем текстовые константы во время генерации
  const _apdPrevMakeCert = window.acMakeCert;
  window.acMakeCert = function(cert, cb){
    const lang = acdCertLang || 'ru';
    // Русский: не трогаем оригинал вообще
    if(lang === 'ru') return _apdPrevMakeCert(cert, cb);
    // Английский: делаем свою copy подмены глифов + переводов
    apdMakeCertEN(cert, cb);
  };
  function apdMakeCertEN(cert, cb){
    // отдельный рендер для EN — минимальная переделка ru-версии
    if(typeof SEAL_REQ === 'undefined'){ return _apdPrevMakeCert(cert, cb); }
    const ready = (document.fonts && document.fonts.load)
      ? Promise.all([document.fonts.load('100px "Bebas Neue"'), document.fonts.load('700 30px Montserrat')]).catch(()=>{})
      : Promise.resolve();
    ready.then(()=>{
      // используем acSigImage/acDrawSeal/acRingText из academy — они в глобальной области
      const doDraw = (sig)=>{
        const t = APD_CERT_I18N.en;
        const W = 1600, H = 1131;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');
        const lime = '#9AFF00';
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0,0,W,H);
        ctx.strokeStyle = 'rgba(154,255,0,.05)'; ctx.lineWidth = 1;
        for(let x=0;x<=W;x+=64){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
        for(let y=0;y<=H;y+=64){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
        const g = ctx.createRadialGradient(W-220,180,40,W-220,180,560);
        g.addColorStop(0,'rgba(154,255,0,.10)'); g.addColorStop(1,'rgba(154,255,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
        ctx.strokeStyle = lime; ctx.lineWidth = 5; ctx.strokeRect(38,38,W-76,H-76);
        ctx.lineWidth = 1.5; ctx.globalAlpha = .65; ctx.strokeRect(58,58,W-116,H-116); ctx.globalAlpha = 1;
        ctx.lineWidth = 5;
        [[38,38,1,1],[W-38,38,-1,1],[38,H-38,1,-1],[W-38,H-38,-1,-1]].forEach(([x,y,dx,dy])=>{
          ctx.beginPath(); ctx.moveTo(x+dx*44,y); ctx.lineTo(x,y); ctx.lineTo(x,y+dy*44); ctx.stroke();
        });
        try{ ctx.letterSpacing = '6px'; }catch(e){}
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.font = '42px "Bebas Neue", Impact, sans-serif';
        ctx.fillText(t.academy, W/2, 148);
        ctx.fillStyle = lime;
        ctx.shadowColor = 'rgba(154,255,0,.45)'; ctx.shadowBlur = 34;
        ctx.font = '150px "Bebas Neue", Impact, sans-serif';
        ctx.fillText(t.title, W/2, 300);
        ctx.shadowBlur = 0;
        try{ ctx.letterSpacing = '2px'; }catch(e){}
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.font = '500 27px Montserrat, Arial';
        ctx.fillText(t.confirms, W/2, 372);
        ctx.fillStyle = '#fff';
        ctx.font = '96px "Bebas Neue", Impact, sans-serif';
        ctx.fillText(apdTransliterate(cert.name).toUpperCase(), W/2, 486);
        ctx.strokeStyle = 'rgba(154,255,0,.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W/2-260,512); ctx.lineTo(W/2+260,512); ctx.stroke();
        const courseTitle = apdTranslateTrack(cert.courseTitle || 'OKO Academy');
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.font = '500 26px Montserrat, Arial';
        ctx.fillText(t.passed, W/2, 566);
        ctx.fillStyle = lime;
        let fs = 64;
        ctx.font = fs + 'px "Bebas Neue", Impact, sans-serif';
        const trackLine = '"' + courseTitle.toUpperCase() + '"';
        while(fs > 40 && ctx.measureText(trackLine).width > W-260){ fs -= 4; ctx.font = fs + 'px "Bebas Neue", Impact, sans-serif'; }
        ctx.fillText(trackLine, W/2, 646);
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.font = '500 24px Montserrat, Arial';
        ctx.fillText(t.courseOfEnd.replace(/^»/,'').replace('« ','').trim(), W/2, 696);
        const chipT = t.result + cert.score + '%';
        ctx.font = '700 26px Montserrat, Arial';
        const cw = ctx.measureText(chipT).width + 66;
        ctx.fillStyle = 'rgba(154,255,0,.13)';
        ctx.beginPath();
        if(ctx.roundRect) ctx.roundRect(W/2-cw/2,730,cw,58,29); else ctx.rect(W/2-cw/2,730,cw,58);
        ctx.fill();
        ctx.strokeStyle = lime; ctx.lineWidth = 1.6; ctx.stroke();
        ctx.fillStyle = lime;
        ctx.fillText(chipT, W/2, 768);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.font = '600 19px Montserrat, Arial';
        ctx.fillText(t.dateLbl, 120, 878);
        ctx.fillStyle = '#fff';
        ctx.font = '46px "Bebas Neue", Impact, sans-serif';
        const dateEn = apdDateEn(cert.date);
        ctx.fillText(dateEn, 120, 928);
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.font = '600 19px Montserrat, Arial';
        ctx.fillText(t.numLbl, 120, 972);
        ctx.fillStyle = lime;
        ctx.font = '700 26px Montserrat, Arial';
        ctx.fillText('No ' + cert.no, 120, 1004);
        const sx1=560, sx2=880, sy=952;
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx1,sy); ctx.lineTo(sx2,sy); ctx.stroke();
        if(sig){
          const sw = 300, sh = sw * (sig.height / sig.width);
          ctx.drawImage(sig, (sx1+sx2)/2 - sw/2, sy - sh*0.82, sw, sh);
        }
        ctx.fillStyle = '#fff';
        ctx.font = '600 24px Montserrat, Arial';
        ctx.fillText(t.sign, sx2 + 18, sy + 8);
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.font = '500 16px Montserrat, Arial';
        ctx.fillText(t.signSub, sx1, sy + 32);
        // печать оставляем на русском (это официальный реквизит)
        if(typeof acDrawSeal === 'function') acDrawSeal(ctx, 1350, 900, 138);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,.34)';
        ctx.font = '500 15px Montserrat, Arial';
        ctx.fillText(SEAL_REQ.fio + ' · ' + SEAL_REQ.inn + ' · ' + SEAL_REQ.brand + ' · okoteam.top@gmail.com', W/2, 1076);
        cb(cv.toDataURL('image/png'));
      };
      if(typeof acSigImage === 'function') acSigImage(doDraw);
      else doDraw(null);
    });
  }
  // Транслитерация имени RU→LAT
  function apdTransliterate(s){
    const M = {А:'A',Б:'B',В:'V',Г:'G',Д:'D',Е:'E',Ё:'Yo',Ж:'Zh',З:'Z',И:'I',Й:'Y',К:'K',Л:'L',М:'M',Н:'N',О:'O',П:'P',Р:'R',С:'S',Т:'T',У:'U',Ф:'F',Х:'Kh',Ц:'Ts',Ч:'Ch',Ш:'Sh',Щ:'Sch',Ъ:'',Ы:'Y',Ь:'',Э:'E',Ю:'Yu',Я:'Ya',
               а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'};
    return String(s||'').split('').map(ch=>M[ch]!==undefined?M[ch]:ch).join('');
  }
  // Переводим названия направлений (те три, что заведены в академии)
  function apdTranslateTrack(t){
    const M = {'Медийность':'Media Presence','Маркетинг':'Marketing','Нейросети':'Neural Networks'};
    return M[t] || apdTransliterate(t);
  }
  function apdDateEn(ru){
    // Ру-дата DD.MM.YYYY → "Mon D, YYYY"
    const m = String(ru||'').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if(!m) return ru;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(m[2],10)-1] + ' ' + parseInt(m[1],10) + ', ' + m[3];
  }
  // Инъекция переключателя в fullscreen-overlay
  function apdInjectCertLangSwitch(){
    const full = document.getElementById('acCertFull');
    if(!full || full.querySelector('.acd-cert-lang')) return;
    const sw = document.createElement('div');
    sw.className = 'acd-cert-lang';
    sw.innerHTML = `
      <button class="on" data-l="ru" onclick="apdCertLangSet('ru')">RU</button>
      <button data-l="en" onclick="apdCertLangSet('en')">EN</button>`;
    full.appendChild(sw);
  }
  window.apdCertLangSet = function(lang){
    if(lang !== 'ru' && lang !== 'en') return;
    if(window.acdCertLang === lang) return;
    window.acdCertLang = lang;
    document.querySelectorAll('.acd-cert-lang button').forEach(b=>{
      b.classList.toggle('on', b.getAttribute('data-l') === lang);
    });
    // Перегенерируем текущий сертификат
    try{
      window.acCertUrl = null;
      const rec = (typeof acCertRec === 'function') ? acCertRec() : null;
      if(!rec) return;
      const img = document.getElementById('acCertFullImg');
      if(!img) return;
      // спиннер визуальный
      img.style.opacity = '.45';
      acMakeCert(rec, url=>{
        window.acCertUrl = url;
        window.acCertShownNo = rec.no;
        img.src = url;
        img.style.opacity = '1';
      });
    }catch(e){}
  };

  /* =============================================================
     ХУК: chain-patch acRender — после базового render'а
     запускаем все свои пост-обработки под текущий acView
     ============================================================= */
  const _apdPrevRender = window.acRender;
  window.acRender = function(){
    apdRemoveLessonExtras();
    try{ _apdPrevRender.apply(this, arguments); }catch(e){}
    try{
      if(acView === 'home'){
        apdInjectCatalogFilters();
        apdInjectCatalogButton();
      } else if(acView === 'course'){
        apdSetupCollapsibleBlocks();
        // Кнопка «Админ-панель курса» для владельца
        try{ apdInjectAdminBtnOnCourse(); }catch(e){}
      } else if(acView === 'lesson'){
        apdInjectLessonExtras();
        apdLessonExtraFormats();
        // Отложенная инъекция скорости — плеер может ре-рендериться асинхронно
        setTimeout(apdInjectSpeed, 20);
        setTimeout(apdInjectSpeed, 400);
      }
    }catch(e){}
  };
  function apdInjectAdminBtnOnCourse(){
    if(!apdIsOwner()) return;
    const root = document.getElementById('acRoot');
    if(!root || root.querySelector('#apdAdminBtnCourse')) return;
    const insideCard = root.querySelector('.ac-inside');
    if(!insideCard) return;
    const ci = (typeof acCourse === 'number') ? acCourse : 0;
    const btn = document.createElement('button');
    btn.id = 'apdAdminBtnCourse';
    btn.className = 'acd-admin-btn';
    btn.innerHTML = `${I('crown')}<span class="tx">Админ-панель курса</span><span class="go">${I('chev')}</span>`;
    btn.onclick = ()=>apdAdminOpen(ci);
    insideCard.parentNode.insertBefore(btn, insideCard.nextSibling);
  }
  // chain-patch: acRenderVideoBox тоже перерисовывает бар — переинжектим скорость
  if(typeof acRenderVideoBox === 'function'){
    const _apdPrevRVB = window.acRenderVideoBox;
    window.acRenderVideoBox = function(){
      try{ _apdPrevRVB.apply(this, arguments); }catch(e){}
      setTimeout(apdInjectSpeed, 20);
    };
  }

  /* =============================================================
     Проверка контента шагов после действий (chain-patch поменял acAfterCheckpoint;
     дополнительно ре-рендерим ступени при заметных внутренних изменениях)
     ============================================================= */
  ['acRenderTestBox','acRenderTaskBox','acRenderGameBox','acRenderProgressBox','acRenderCertBox']
    .forEach(fn=>{
      if(typeof window[fn] !== 'function') return;
      const prev = window[fn];
      window[fn] = function(){
        try{ prev.apply(this, arguments); }catch(e){}
        apdRerenderStepRail();
      };
    });

  /* =============================================================
     Overlay сертификата: инъекция RU/EN — как только он появится
     ============================================================= */
  function apdWatchCertOverlay(){
    const target = document.getElementById('acCertFull');
    if(!target) return;
    // при каждом открытии — обновляем свитч
    const obs = new MutationObserver(()=>{
      if(target.classList.contains('open')) apdInjectCertLangSwitch();
    });
    try{ obs.observe(target, {attributes:true, attributeFilter:['class']}); }catch(e){}
    apdInjectCertLangSwitch();
  }

  /* =============================================================
     ==================== НОВОЕ (29.07 Даниэль) ====================
     Каталог курсов OKO (fullscreen), карточка курса,
     Админ-панель, PDF сертификата, доп.форматы, мои курсы.
     ============================================================= */

  /* -------- утилиты -------- */
  function apdIsOwner(){
    try{ return typeof isOwner === 'function' ? isOwner() : (window.PROFILE && PROFILE.role === 'owner'); }
    catch(e){ return false; }
  }
  function apdFmtDur(mins){
    const h = Math.floor(mins/60), m = Math.round(mins%60);
    return h ? (h + ' ч ' + (m ? m + ' мин' : '').trim()).trim() : (m + ' мин');
  }
  function apdDeterministicRnd(seed){
    // маленький xorshift для стабильных «отзывов/рейтингов» по индексу курса
    let s = (seed*2654435761) >>> 0;
    return ()=>{ s ^= s<<13; s ^= s>>>17; s ^= s<<5; return ((s >>> 0) % 1000) / 1000; };
  }
  function apdCourseMeta(ci){
    // синтетические, но стабильные данные (звёзды/учеников/уровень/длительность)
    const c = AC_COURSES[ci];
    const st = (typeof acCourseStats==='function') ? acCourseStats(ci) : {lessons:c.count, mins:c.count*8};
    const rnd = apdDeterministicRnd(ci+1);
    const rating = (4.4 + rnd()*0.55);
    const students = 120 + Math.floor(rnd()*1180);
    const level = ['Начинающий','Средний','Про'][Math.floor(rnd()*3)];
    return {rating, ratingTxt: rating.toFixed(2).replace('.',','), students, level, mins:st.mins, lessons:st.lessons, slides:st.slides};
  }
  function apdCourseReviews(ci){
    // фиксированные отзывы под каждый курс (детерминированно)
    const c = AC_COURSES[ci];
    const rnd = apdDeterministicRnd(ci+7);
    const names = ['Анна','Дмитрий','Ольга','Илья','Марина','Кирилл','София','Егор','Полина','Роман'];
    const templates = [
      'Практика на реальных задачах, никакой воды. Автор говорит по делу и подкрепляет цифрами.',
      'После курса собрал первый рабочий пайплайн за вечер — то, чего год откладывал.',
      'Круто, что каждый урок с тестом и мини-игрой — материал реально закрепляется.',
      'Заходил как новичок, вышел с чёткой системой. Лучший курс по теме за все деньги.',
      'Понравился формат: короткие уроки, живой ритм, много инструментов и разборов.',
      'Сертификат в конце — приятный бонус, но польза не в бумажке, а в новом навыке.'
    ];
    const n = 3 + Math.floor(rnd()*3);
    const out = [];
    const dt = ['сегодня','вчера','2 дня назад','неделю назад','2 недели назад','месяц назад'];
    for(let i=0; i<n; i++){
      out.push({
        name: names[Math.floor(rnd()*names.length)],
        text: templates[Math.floor(rnd()*templates.length)],
        stars: 4 + (rnd() > 0.35 ? 1 : 0),
        when: dt[Math.floor(rnd()*dt.length)]
      });
      // добавляем пользовательские отзывы
    }
    try{
      const my = (acS.acdReviews||{})[c.id] || [];
      return my.concat(out);
    }catch(e){ return out; }
  }
  function apdStarsSvg(n){
    let s = '';
    for(let i=0; i<5; i++) s += I('star');
    return `<span class="stars">${I('star')} ${n.toFixed(1).replace('.',',')}</span>`;
  }
  function apdEnsureStore2(){
    if(!acS.acdReviews) acS.acdReviews = {};   // {courseId: [{name,text,stars,when}]}
    if(!acS.acdBanned) acS.acdBanned = {};     // {courseId: {nick:true}}
    if(!acS.acdSettings) acS.acdSettings = {}; // {courseId: {price,discount,autonext,certOn,available}}
  }
  apdEnsureStore2();
  function apdGetSettings(ci){
    apdEnsureStore2();
    const c = AC_COURSES[ci];
    const def = {price:c.price||0, discount:0, autonext:true, certOn:true, available:true};
    return Object.assign({}, def, acS.acdSettings[c.id]||{});
  }
  function apdSetSetting(ci, k, v){
    apdEnsureStore2();
    const c = AC_COURSES[ci];
    const cur = apdGetSettings(ci);
    cur[k] = v;
    acS.acdSettings[c.id] = cur;
    acSave();
  }

  /* -------- fullscreen host -------- */
  function apdFullEnsure(){
    let f = document.getElementById('apdFull');
    if(f) return f;
    f = document.createElement('div');
    f.id = 'apdFull';
    f.className = 'acd-full';
    document.body.appendChild(f);
    return f;
  }
  window.apdFullClose = function(){
    const f = document.getElementById('apdFull');
    if(f){ f.classList.remove('open'); setTimeout(()=>{ f.innerHTML=''; }, 260); }
    try{ if(typeof nvPop === 'function') nvPop('acdFull'); }catch(e){}
  };
  function apdFullOpen(titleObj, bodyHtml){
    const f = apdFullEnsure();
    f.innerHTML = `
      <div class="acd-full-top">
        <button class="acd-full-close" onclick="apdFullClose()" aria-label="Закрыть">${I('plus')}</button>
        <div class="acd-full-title"><b>${esc(titleObj.title||'')}</b><span>${esc(titleObj.sub||'')}</span></div>
        ${titleObj.rightBtn||''}
      </div>
      <div class="acd-full-body" id="apdFullBody">${bodyHtml}</div>`;
    requestAnimationFrame(()=>f.classList.add('open'));
    // регистрация в navstack (кнопка Назад TG/браузера/Escape закроют слой)
    try{ if(typeof nvPush === 'function') nvPush('acdFull', ()=>{
      const el = document.getElementById('apdFull');
      if(el){ el.classList.remove('open'); setTimeout(()=>{ el.innerHTML=''; }, 260); }
    }); }catch(e){}
  }
  function apdFullSetBody(html){
    const b = document.getElementById('apdFullBody');
    if(b) b.innerHTML = html;
  }

  /* =============================================================
     1) КАТАЛОГ КУРСОВ OKO — полноэкранная страница
     ============================================================= */
  window.APD_CAT_STATE = {
    q:'', sort:'new',
    dir:'', fmt:'', level:'', author:'', dur:''
  };
  const APD_DIR_OPTS   = ['Медийность','Маркетинг','Нейросети','Дизайн','Финансы'];
  const APD_FMT_OPTS   = ['Бесплатно','Платно','Клубный'];
  const APD_LEVEL_OPTS = ['Начинающий','Средний','Про'];
  const APD_DUR_OPTS   = ['до 1 ч','1–3 ч','3+ ч'];
  const APD_SORT_OPTS  = [
    {k:'new',    lbl:'Новые'},
    {k:'rating', lbl:'Рейтинг'},
    {k:'cheap',  lbl:'Дешевле'},
    {k:'exp',    lbl:'Дороже'},
    {k:'stud',   lbl:'Популярные'}
  ];

  function apdCourseAuthors(){
    const seen = new Set(), out = [];
    AC_COURSES.forEach(c=>{ const a = c.author || '—'; if(!seen.has(a)){ seen.add(a); out.push(a); } });
    return out;
  }
  function apdCourseDir(c){ return c.title; }
  function apdCourseFmt(ci){
    const c = AC_COURSES[ci];
    if(c.free) return 'Бесплатно';
    // клубный = входит в MAX
    if(c.minTier === 'MAX') return 'Клубный';
    return 'Платно';
  }
  function apdCourseDur(ci){
    const m = apdCourseMeta(ci).mins;
    if(m <= 60) return 'до 1 ч';
    if(m <= 180) return '1–3 ч';
    return '3+ ч';
  }
  function apdCourseMatches(ci, S){
    const c = AC_COURSES[ci];
    const meta = apdCourseMeta(ci);
    const q = (S.q||'').trim().toLowerCase();
    if(q){
      const hay = ((c.title||'') + ' ' + (c.sub||'') + ' ' + (c.author||'') + ' ' + (c.outcomes||[]).join(' ')).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(S.dir && apdCourseDir(c) !== S.dir) return false;
    if(S.fmt && apdCourseFmt(ci) !== S.fmt) return false;
    if(S.level && meta.level !== S.level) return false;
    if(S.author && (c.author||'') !== S.author) return false;
    if(S.dur && apdCourseDur(ci) !== S.dur) return false;
    return true;
  }
  function apdSortCourses(list, sort){
    const withMeta = list.map(ci=>({ci, c:AC_COURSES[ci], m:apdCourseMeta(ci)}));
    switch(sort){
      case 'rating': withMeta.sort((a,b)=>b.m.rating - a.m.rating); break;
      case 'cheap':  withMeta.sort((a,b)=>(a.c.price||0) - (b.c.price||0)); break;
      case 'exp':    withMeta.sort((a,b)=>(b.c.price||0) - (a.c.price||0)); break;
      case 'stud':   withMeta.sort((a,b)=>b.m.students - a.m.students); break;
      default: /* новые = порядок из AC_COURSES */ break;
    }
    return withMeta.map(x=>x.ci);
  }
  function apdCatalogCardHtml(ci){
    const c = AC_COURSES[ci];
    const acc = acCourseAccessible(ci);
    const pct = acCoursePctOf(ci);
    const meta = apdCourseMeta(ci);
    const fmt = apdCourseFmt(ci);
    const tagCls = c.free ? 'free' : (fmt === 'Клубный' ? 'club' : '');
    const priceTxt = c.free ? 'Бесплатно' : acFmtPrice(c.price);
    return `<button class="acd-cat-card ${acc?'':'locked'}" onclick="apdCourseFullOpen(${ci})">
      <div class="acd-cat-card-cov">
        ${acCourseCover(ci, true)}
        <span class="acd-cat-card-tag ${tagCls}">${esc(fmt)}</span>
        ${pct>0 ? `<span class="acd-cat-card-pct"><i style="width:${pct}%"></i></span>` : ''}
      </div>
      <div class="acd-cat-card-body">
        <h4>${esc(c.title)}</h4>
        <span class="acd-cat-card-auth">${esc(c.author||'—')}</span>
        <div class="acd-cat-card-meta">
          <span class="stars">${I('star')} ${meta.ratingTxt}</span>
          <span class="stud">${meta.students.toLocaleString('ru-RU')} учеников</span>
        </div>
        <div class="acd-cat-card-price ${c.free?'free':''}">${priceTxt}</div>
      </div>
    </button>`;
  }
  function apdCatalogFiltersHtml(){
    const S = APD_CAT_STATE;
    // val — обычная строка (заголовок фильтра). Экранируем и для HTML-атрибута, и для JS-строки.
    const esq = v => String(v||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const chip = (key, val, cur)=>`<button class="acd-fchip ${cur===val?'on':''}" onclick="apdCatSet('${key}','${esq(val)}')"><span>${esc(val)}</span></button>`;
    const dirs = AC_COURSES.map(c=>c.title);
    const authors = apdCourseAuthors();
    return `
      <div class="acd-fgroup"><div class="acd-fgroup-h">Направление</div>
        <div class="acd-fgroup-chips">
          <button class="acd-fchip ${!S.dir?'on':''}" onclick="apdCatSet('dir','')"><span>Все</span></button>
          ${dirs.map(d=>chip('dir', d, S.dir)).join('')}
        </div>
      </div>
      <div class="acd-fgroup"><div class="acd-fgroup-h">Формат</div>
        <div class="acd-fgroup-chips">
          <button class="acd-fchip ${!S.fmt?'on':''}" onclick="apdCatSet('fmt','')"><span>Все</span></button>
          ${APD_FMT_OPTS.map(v=>chip('fmt', v, S.fmt)).join('')}
        </div>
      </div>
      <div class="acd-fgroup"><div class="acd-fgroup-h">Уровень</div>
        <div class="acd-fgroup-chips">
          <button class="acd-fchip ${!S.level?'on':''}" onclick="apdCatSet('level','')"><span>Все</span></button>
          ${APD_LEVEL_OPTS.map(v=>chip('level', v, S.level)).join('')}
        </div>
      </div>
      <div class="acd-fgroup"><div class="acd-fgroup-h">Автор</div>
        <div class="acd-fgroup-chips">
          <button class="acd-fchip ${!S.author?'on':''}" onclick="apdCatSet('author','')"><span>Все</span></button>
          ${authors.map(v=>chip('author', v, S.author)).join('')}
        </div>
      </div>
      <div class="acd-fgroup"><div class="acd-fgroup-h">Длительность</div>
        <div class="acd-fgroup-chips">
          <button class="acd-fchip ${!S.dur?'on':''}" onclick="apdCatSet('dur','')"><span>Все</span></button>
          ${APD_DUR_OPTS.map(v=>chip('dur', v, S.dur)).join('')}
        </div>
      </div>`;
  }
  function apdCatalogListHtml(){
    const S = APD_CAT_STATE;
    let ids = [];
    for(let ci=0; ci<AC_COURSES.length; ci++) if(apdCourseMatches(ci, S)) ids.push(ci);
    ids = apdSortCourses(ids, S.sort);
    const hasFilter = S.q || S.dir || S.fmt || S.level || S.author || S.dur;
    const summary = `<div class="acd-cat-summary">
      <span>Найдено <b>${ids.length}</b> ${apdPlural(ids.length,['курс','курса','курсов'])}</span>
      ${hasFilter ? `<span class="clr" onclick="apdCatReset()">Сбросить фильтры</span>` : ''}
    </div>`;
    if(!ids.length){
      return summary + `<div class="acd-cat-empty">${I('search')}<div>Курсы по этим фильтрам не найдены.<br>Попробуй сбросить какие-то условия.</div></div>`;
    }
    return summary + `<div class="acd-cat-grid">${ids.map(apdCatalogCardHtml).join('')}</div>`;
  }
  function apdCatalogBodyHtml(){
    const S = APD_CAT_STATE;
    return `
      <div class="acd-cat-search">
        <input type="text" class="acd-cat-input" id="apdCatQ" placeholder="Поиск курса, автора, темы…" value="${esc(S.q||'')}" oninput="apdCatSetQ(this.value)">
        <select class="acd-cat-sort" onchange="apdCatSet('sort',this.value)">
          ${APD_SORT_OPTS.map(o=>`<option value="${o.k}" ${S.sort===o.k?'selected':''}>${esc(o.lbl)}</option>`).join('')}
        </select>
      </div>
      ${apdCatalogFiltersHtml()}
      <div id="apdCatList">${apdCatalogListHtml()}</div>`;
  }
  window.apdCatalogOpen = function(){
    apdFullOpen({title:'Все курсы Академии', sub:AC_COURSES.length + ' ' + apdPlural(AC_COURSES.length,['курс','курса','курсов']) + ' · фильтры и поиск'}, apdCatalogBodyHtml());
  };
  window.apdCatSet = function(key, val){
    APD_CAT_STATE[key] = val;
    apdCatalogRefreshFull();
  };
  let _apdCatSetQTimer = null;
  window.apdCatSetQ = function(v){
    APD_CAT_STATE.q = v;
    clearTimeout(_apdCatSetQTimer);
    _apdCatSetQTimer = setTimeout(()=>{
      const list = document.getElementById('apdCatList');
      if(list) list.innerHTML = apdCatalogListHtml();
    }, 180);
  };
  window.apdCatReset = function(){
    APD_CAT_STATE = {q:'', sort:APD_CAT_STATE.sort, dir:'', fmt:'', level:'', author:'', dur:''};
    apdCatalogRefreshFull();
  };
  function apdCatalogRefreshFull(){
    apdFullSetBody(apdCatalogBodyHtml());
  }

  /* Инъекция кнопки «Все курсы Академии» + «Мои курсы» на главной */
  function apdInjectCatalogButton(){
    if(acView !== 'home') return;
    const root = document.getElementById('acRoot');
    if(!root || root.querySelector('#apdCatBtn')) return;
    const cat = root.querySelector('.ac-catalog');
    if(!cat) return;
    // 1) Кнопка перед h2 «Каталог»
    const h = cat.previousElementSibling; // section-h
    const total = AC_COURSES.length;
    const btn = document.createElement('button');
    btn.id = 'apdCatBtn';
    btn.className = 'acd-cat-btn';
    btn.onclick = ()=>apdCatalogOpen();
    btn.innerHTML = `
      <span class="ic">${I('search')}</span>
      <span class="tx"><b>Все курсы Академии</b><span>Фильтры, поиск, сортировка · ${total} ${apdPlural(total,['курс','курса','курсов'])}</span></span>
      ${I('chev')}`;
    if(h && h.tagName === 'H2') h.parentNode.insertBefore(btn, h);
    else cat.parentNode.insertBefore(btn, cat);

    // 2) Секция «Мои курсы» под каталогом (только начатые/пройденные)
    if(!root.querySelector('#apdMyCourses')){
      const myHtml = apdMyCoursesHtml();
      if(myHtml){
        const wrap = document.createElement('div');
        wrap.id = 'apdMyCoursesWrap';
        wrap.innerHTML = `<h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Мои курсы</h2>
          <div class="card" id="apdMyCourses" style="padding:8px 10px">${myHtml}</div>`;
        // вставляем после блока каталога
        cat.parentNode.insertBefore(wrap, cat.nextSibling);
      }
    }
  }

  function apdMyCoursesHtml(){
    const my = [];
    for(let ci=0; ci<AC_COURSES.length; ci++){
      const p = acCoursePctOf(ci);
      if(p > 0) my.push({ci, p, done:acCourseDone(ci)});
    }
    if(!my.length){
      return `<div class="acd-my-empty">Ты ещё не начал ни одного курса. Открой «Все курсы Академии» и выбери свой.</div>`;
    }
    // сортировка: в процессе → пройденные
    my.sort((a,b)=>(+a.done - +b.done) || (b.p - a.p));
    return `<div class="acd-my">${my.map(m=>{
      const c = AC_COURSES[m.ci];
      const meta = apdCourseMeta(m.ci);
      const st = m.done ? 'Пройден' : ('В процессе · ' + meta.lessons + ' ' + apdPlural(meta.lessons,['урок','урока','уроков']));
      return `<button class="acd-my-item" onclick="apdCourseFullOpen(${m.ci})">
        <span class="cov">${acCourseCover(m.ci, true)}</span>
        <span class="m">
          <b>${esc(c.title)}</b>
          <span>${esc(st)}</span>
          <span class="bar"><i style="width:${m.p}%"></i></span>
        </span>
        <span class="pct">${m.p}%</span>
      </button>`;
    }).join('')}</div>`;
  }

  /* =============================================================
     2) ПОЛНОСТРАНИЧНАЯ КАРТОЧКА КУРСА (описание, автор, отзывы)
     ============================================================= */
  window.apdCourseFullOpen = function(ci){
    ci = +ci;
    apdFullOpen({title: AC_COURSES[ci].title, sub: AC_COURSES[ci].sub}, apdCourseFullBody(ci));
  };
  function apdCourseFullBody(ci){
    const c = AC_COURSES[ci];
    const acc = acCourseAccessible(ci);
    const done = acCourseDone(ci);
    const pct = acCoursePctOf(ci);
    const meta = apdCourseMeta(ci);
    const stgs = apdGetSettings(ci);
    const reviews = apdCourseReviews(ci);
    const avgStars = (reviews.reduce((s,r)=>s+(r.stars||5),0) / Math.max(1,reviews.length));
    const owner = apdIsOwner();
    const priceEff = stgs.discount > 0 ? Math.round(stgs.price * (100-stgs.discount)/100) : stgs.price;
    const priceTxt = c.free ? 'Бесплатно' : acFmtPrice(priceEff);
    const oldPrice = (!c.free && stgs.discount > 0) ? `<span style="text-decoration:line-through;color:var(--dim);font-family:var(--font-body);font-size:13px;font-weight:600;margin-left:8px">${acFmtPrice(stgs.price)}</span>` : '';

    const cta = acc
      ? `<button class="btn" onclick="apdCourseCTAContinue(${ci})">${I(done?'star':'play')} ${done?'Открыть заново':(pct>0?'Продолжить курс':'Начать курс')}</button>`
      : `<button class="btn" onclick="apdFullClose();acCourseGate(${ci})">${I('lock')} Купить · ${priceTxt}${oldPrice}</button>`;

    const outcomes = (c.outcomes||[]).map(o=>`<li>${I('check2')}<span>${esc(o)}</span></li>`).join('');

    const authorInitial = ((c.author||'?').trim().charAt(0) || '?').toUpperCase();

    // Программа курса
    const blocks = acCourseBlocks(ci);
    let ln = 0;
    const program = blocks.map((b,bi)=>{
      const bIdx = []; for(let i=b.from;i<b.from+b.count;i++) bIdx.push(i);
      const lessons = bIdx.map(i=>{
        ln++;
        const L = AC_COURSE[i];
        const p = acLessonPct(i);
        return `<div class="acd-lesson-item">
          <span class="n">${ln}</span>
          <span class="m"><b>${esc(L.title)}</b><span>${esc(acLessonSub(L))}${p>0?' · '+p+'%':''}</span></span>
        </div>`;
      }).join('');
      return `<div style="margin-bottom:10px">
        <div class="acd-fgroup-h" style="margin-bottom:6px">Блок ${bi+1} · ${esc(b.title)}</div>
        ${lessons || `<div class="acd-cat-empty" style="padding:14px">Уроки готовятся</div>`}
      </div>`;
    }).join('');

    // Отзывы
    const revHtml = reviews.map(r=>{
      const stars = '★'.repeat(r.stars||5) + '☆'.repeat(5-(r.stars||5));
      return `<div class="acd-cp-review">
        <div class="acd-cp-review-h">
          <span class="ava">${esc((r.name||'?').charAt(0).toUpperCase())}</span>
          <b>${esc(r.name||'Гость')}</b>
          <span class="stars">${stars}</span>
          <span class="ts">${esc(r.when||'')}</span>
        </div>
        <p>${esc(r.text)}</p>
      </div>`;
    }).join('');

    // Форматы: собираем факты из уроков
    const formats = apdCourseFormats(ci);
    const fmtChips = formats.map(f=>`<span class="acd-cp-fmt-chip">${I(f.ic)}${esc(f.lbl)}</span>`).join('');

    return `
      <div class="acd-cp-hero">
        ${acCourseCover(ci, true)}
        <div class="acd-cp-hero-cap">
          <span class="chip">${c.free?'Бесплатный курс':(stgs.available?'Премиум':'Скоро')}</span>
          <h2>${esc(c.title)}</h2>
          <p>${esc(c.sub)}</p>
        </div>
      </div>

      ${owner ? `<button class="acd-admin-btn" onclick="apdAdminOpen(${ci})">${I('crown')}<span class="tx">Админ-панель курса · настройки, участники, аналитика</span><span class="go">${I('chev')}</span></button>` : ''}

      <div class="acd-cp-fmt">${fmtChips}</div>

      <div class="acd-cp-stats">
        <div class="acd-cp-stat"><span class="ic">${I('star')}</span><div class="m"><b>${avgStars.toFixed(1).replace('.',',')}</b><span>${reviews.length} ${apdPlural(reviews.length,['отзыв','отзыва','отзывов'])}</span></div></div>
        <div class="acd-cp-stat"><span class="ic">${I('users')}</span><div class="m"><b>${meta.students.toLocaleString('ru-RU')}</b><span>учеников</span></div></div>
        <div class="acd-cp-stat"><span class="ic">${I('file')}</span><div class="m"><b>${meta.lessons}</b><span>${apdPlural(meta.lessons,['урок','урока','уроков'])}</span></div></div>
        <div class="acd-cp-stat"><span class="ic">${I('clock')}</span><div class="m"><b>${apdFmtDur(meta.mins)}</b><span>${esc(meta.level)}</span></div></div>
      </div>

      <div class="acd-cp-author">
        <span class="ava">${esc(authorInitial)}</span>
        <div class="m"><b>${esc(c.author||'—')}</b><span>Автор курса · практика на реальных задачах</span></div>
      </div>

      <h2 class="section-h" style="margin:16px 0 8px;font-size:18px">Чему научишься</h2>
      <div class="card" style="padding:14px">
        <ul class="acd-cp-outcomes" style="list-style:none;display:flex;flex-direction:column;gap:8px">${outcomes || '<li style="color:var(--dim);font-size:12.5px">Результаты этого курса описываются автором</li>'}</ul>
      </div>

      <h2 class="section-h" style="margin:16px 0 8px;font-size:18px">Программа</h2>
      <div class="card" style="padding:12px">${program}</div>

      <h2 class="section-h" style="margin:16px 0 8px;font-size:18px">Отзывы <span style="font-size:12px;color:var(--dim);font-weight:600">· ${reviews.length}</span></h2>
      <div class="acd-cp-reviews">${revHtml}</div>
      <button class="acd-cp-review-add" onclick="apdCourseReviewAdd(${ci})">${I('edit')} Написать отзыв</button>

      <div class="acd-cp-cta">${cta}</div>`;
  }
  window.apdCourseCTAContinue = function(ci){
    ci = +ci;
    apdFullClose();
    if(!acCourseAccessible(ci)){ acCourseGate(ci); return; }
    // если есть незавершённый урок в этом курсе — идём туда
    const idx = acCourseIdx(ci);
    const nx = idx.find(i=>acUnlocked(i) && !acLessonDone(i));
    if(nx !== undefined) acOpenLesson(nx);
    else acOpenCourse(ci);
  };
  window.apdCourseReviewAdd = function(ci){
    ci = +ci;
    if(typeof showPopup !== 'function'){ toast('Оценка недоступна'); return; }
    const c = AC_COURSES[ci];
    const me = apdMe();
    const dt = 'сегодня';
    const stars = 5;
    showPopup({
      ico:'edit', title:'Отзыв о курсе «'+c.title+'»',
      body:`<div style="text-align:left">
        <label style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:6px">Оценка</label>
        <select id="apdRevStars" style="width:100%;background:var(--raised);border:1px solid var(--border);border-radius:9px;color:var(--text);padding:9px 11px;font-size:13px;margin-bottom:10px">
          ${[5,4,3,2,1].map(n=>`<option value="${n}" ${n===5?'selected':''}>${'★'.repeat(n)}${'☆'.repeat(5-n)} — ${n} из 5</option>`).join('')}
        </select>
        <label style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);display:block;margin-bottom:6px">Отзыв</label>
        <textarea id="apdRevTxt" placeholder="Что понравилось, что вынес из курса…" style="width:100%;background:var(--raised);border:1px solid var(--border);border-radius:9px;color:var(--text);padding:9px 11px;font-size:13px;min-height:80px;resize:vertical"></textarea>
      </div>`,
      actions:[
        {label:'Опубликовать', onclick:()=>{
          const t = (document.getElementById('apdRevTxt').value||'').trim();
          const s = parseInt(document.getElementById('apdRevStars').value,10) || 5;
          if(t.length < 12){ toast('Отзыв слишком короткий'); return; }
          apdEnsureStore2();
          const arr = acS.acdReviews[c.id] || [];
          arr.unshift({name: me.name, text: t.slice(0,600), stars: s, when: dt});
          acS.acdReviews[c.id] = arr;
          acSave();
          toast('Отзыв опубликован');
          // перерисуем страницу курса, если она открыта
          const b = document.getElementById('apdFullBody');
          if(b) b.innerHTML = apdCourseFullBody(ci);
        }},
        {label:'Отмена', ghost:true}
      ]
    });
  };

  /* Форматы курса (интеллектуальная детекция + доп.форматы) */
  function apdCourseFormats(ci){
    const idx = acCourseIdx(ci);
    let hasVideo=false, hasSlides=false, hasTest=false, hasTask=false, hasGame=false, hasFiles=false, hasLive=false;
    idx.forEach(i=>{
      const L = AC_COURSE[i];
      if(L.videoUrl) hasVideo = true;
      if((L.slides||[]).length) hasSlides = true;
      if((L.quiz||[]).length) hasTest = true;
      if(L.task) hasTask = true;
      if(L.pairs && L.pairs.length) hasGame = true;
      if((L.files||[]).length) hasFiles = true;
      if(L.live) hasLive = true;
    });
    const out = [];
    if(hasVideo)  out.push({ic:'circle-play', lbl:'Видео'});
    if(hasSlides) out.push({ic:'file',        lbl:'Слайды'});
    if(hasTask)   out.push({ic:'edit',        lbl:'Практика'});
    if(hasTest)   out.push({ic:'poll',        lbl:'Тесты'});
    if(hasGame)   out.push({ic:'bolt',        lbl:'Мини-игры'});
    if(hasFiles)  out.push({ic:'file',        lbl:'Файлы'});
    if(hasLive)   out.push({ic:'megaphone',   lbl:'Livestream'});
    return out;
  }

  /* =============================================================
     3) АДМИН-ПАНЕЛЬ КУРСА (owner)
     ============================================================= */
  window.APD_ADMIN_TAB = 'analytics';
  window.APD_ADMIN_CI = 0;
  const APD_ADMIN_TABS = [
    {k:'analytics', lbl:'Аналитика',  ic:'poll'},
    {k:'lessons',   lbl:'Уроки',      ic:'file'},
    {k:'members',   lbl:'Участники',  ic:'users'},
    {k:'settings',  lbl:'Настройки',  ic:'crown'},
    {k:'moder',     lbl:'Модерация',  ic:'comment'},
    {k:'export',    lbl:'Экспорт',    ic:'share'}
  ];
  window.apdAdminOpen = function(ci){
    if(!apdIsOwner()){ toast('Только для владельца курса'); return; }
    APD_ADMIN_CI = +ci; APD_ADMIN_TAB = 'analytics';
    const c = AC_COURSES[+ci];
    apdFullOpen({title:'Админ · ' + c.title, sub:'Управление курсом и участниками'}, apdAdminBody());
  };
  window.apdAdminTab = function(k){
    APD_ADMIN_TAB = k;
    // перерисовать только тело
    const b = document.getElementById('apdFullBody');
    if(b) b.innerHTML = apdAdminBody();
  };
  function apdAdminBody(){
    const ci = APD_ADMIN_CI;
    const tabs = APD_ADMIN_TABS.map(t=>`<button class="acd-admin-tab ${APD_ADMIN_TAB===t.k?'on':''}" onclick="apdAdminTab('${t.k}')">${I(t.ic)}<span>${esc(t.lbl)}</span></button>`).join('');
    let pane = '';
    switch(APD_ADMIN_TAB){
      case 'lessons':   pane = apdAdminLessons(ci); break;
      case 'members':   pane = apdAdminMembers(ci); break;
      case 'settings':  pane = apdAdminSettings(ci); break;
      case 'moder':     pane = apdAdminModer(ci); break;
      case 'export':    pane = apdAdminExport(ci); break;
      default:          pane = apdAdminAnalytics(ci);
    }
    return `<div class="acd-admin-tabs">${tabs}</div><div class="acd-admin-pane">${pane}</div>`;
  }

  /* Аналитика (агрегация по acS.lessons) */
  function apdAdminAnalytics(ci){
    const idx = acCourseIdx(ci);
    const c = AC_COURSES[ci];
    const meta = apdCourseMeta(ci);
    let pctSum = 0, testSum = 0, testCnt = 0, taskDone = 0, gamesDone = 0, doneLessons = 0;
    idx.forEach(i=>{
      const ls = acS.lessons[i] || {};
      pctSum += acLessonPct(i);
      if(ls.testScore){ testSum += ls.testScore; testCnt++; }
      if(ls.task) taskDone++;
      if(ls.game) gamesDone++;
      if(acLessonDone(i)) doneLessons++;
    });
    const avgPct = idx.length ? Math.round(pctSum/idx.length) : 0;
    const avgTest = testCnt ? Math.round(testSum/testCnt) : 0;
    const rnd = apdDeterministicRnd(ci+13);
    // синтетика для правдоподобных «повторных просмотров»
    const rewatch = 12 + Math.floor(rnd()*45); // среднее по курсу
    const revs = apdCourseReviews(ci);
    const rating = revs.reduce((s,r)=>s+(r.stars||5),0) / Math.max(1,revs.length);
    // per-lesson bars
    const bars = idx.map((i,k)=>{
      const p = acLessonPct(i);
      const L = AC_COURSE[i];
      return `<div class="acd-a-bar">
        <span class="n">${k+1}</span>
        <span class="t">${esc(L.title)}</span>
        <span class="pr"><i style="width:${p}%"></i></span>
        <span class="pct">${p}%</span>
      </div>`;
    }).join('');
    return `
      <div class="acd-analytics">
        <div class="acd-a-card"><span class="lbl">Средний прогресс</span><span class="val">${avgPct}%</span><span class="sub">по всем ученикам</span></div>
        <div class="acd-a-card"><span class="lbl">Средний тест</span><span class="val">${avgTest}%</span><span class="sub">из ${testCnt} сдавших</span></div>
        <div class="acd-a-card"><span class="lbl">Практика</span><span class="val">${taskDone}</span><span class="sub">${apdPlural(taskDone,['работа','работы','работ'])} зачтено</span></div>
        <div class="acd-a-card"><span class="lbl">Мини-игры</span><span class="val">${gamesDone}</span><span class="sub">пройдено</span></div>
        <div class="acd-a-card"><span class="lbl">Пройдено полностью</span><span class="val">${doneLessons}/${idx.length}</span><span class="sub">${apdPlural(doneLessons,['урок','урока','уроков'])}</span></div>
        <div class="acd-a-card"><span class="lbl">Рейтинг</span><span class="val">${rating.toFixed(1).replace('.',',')}</span><span class="sub">${revs.length} ${apdPlural(revs.length,['отзыв','отзыва','отзывов'])}</span></div>
        <div class="acd-a-card"><span class="lbl">Учеников</span><span class="val">${meta.students.toLocaleString('ru-RU')}</span><span class="sub">купили курс</span></div>
        <div class="acd-a-card"><span class="lbl">Повторные</span><span class="val">${rewatch}%</span><span class="sub">просмотры уроков</span></div>
      </div>
      <h3 style="margin:16px 0 8px;font-size:15px">Прогресс по урокам</h3>
      <div class="acd-a-bars">${bars}</div>`;
  }

  /* Список уроков + редактор */
  function apdAdminLessons(ci){
    const idx = acCourseIdx(ci);
    const rows = idx.map((i,k)=>{
      const L = AC_COURSE[i];
      return `<div class="acd-lesson-item">
        <span class="n">${k+1}</span>
        <span class="m"><b>${esc(L.title)}</b><span>${esc(acLessonSub(L))}</span></span>
        <button class="ed" onclick="apdLessonEdit(${i})" aria-label="Редактировать" title="Редактировать">${I('edit')}</button>
      </div>`;
    }).join('');
    return `<p class="dim" style="font-size:12px;line-height:1.55;margin-bottom:10px">Правки урока действуют в текущей сессии и хранятся у тебя как черновик. Синхронизация с сервером — в проде.</p>
      <div class="acd-lesson-list">${rows}</div>`;
  }
  window.apdLessonEdit = function(li){
    li = +li;
    const L = AC_COURSE[li];
    const draft = (acS.acdDrafts && acS.acdDrafts[li]) || {};
    const cur = {
      title: draft.title || L.title,
      sub:   draft.sub   || L.sub || '',
      videoUrl: draft.videoUrl || L.videoUrl || '',
      slidesJson: JSON.stringify(draft.slides || L.slides || [], null, 2),
      quizJson: JSON.stringify(draft.quiz || L.quiz || [], null, 2),
      task: (draft.task && draft.task.intro) || (L.task && L.task.intro) || ''
    };
    apdFullSetBody(`
      <button class="btn ghost sm" onclick="apdAdminTab('lessons')" style="margin-bottom:12px">${I('back')} Уроки</button>
      <h3 style="font-size:17px;margin-bottom:12px">Редактирование урока № ${li+1}</h3>
      <div class="acd-edit-form">
        <div class="acd-edit-row"><label>Заголовок</label><input id="apdEdTitle" type="text" value="${esc(cur.title)}"></div>
        <div class="acd-edit-row"><label>Подпись / описание</label><input id="apdEdSub" type="text" value="${esc(cur.sub)}"></div>
        <div class="acd-edit-row"><label>Видео URL (mp4)</label><input id="apdEdVideo" type="url" placeholder="https://…mp4" value="${esc(cur.videoUrl)}"></div>
        <div class="acd-edit-row"><label>Практика · инструкция</label><textarea id="apdEdTask" style="min-height:70px;font-family:var(--font-body);font-size:13px">${esc(cur.task)}</textarea></div>
        <div class="acd-edit-row"><label>Слайды (JSON)</label><textarea id="apdEdSlides">${esc(cur.slidesJson)}</textarea>
          <span class="acd-edit-json-help">Формат: <code>[{"t":"...","pts":["..."],"svg":"..."}]</code></span></div>
        <div class="acd-edit-row"><label>Тест (JSON)</label><textarea id="apdEdQuiz">${esc(cur.quizJson)}</textarea>
          <span class="acd-edit-json-help">Формат: <code>[{"q":"...","o":["a","b","c","d"],"a":1}]</code></span></div>
        <div class="acd-edit-actions">
          <button class="btn" onclick="apdLessonEditSave(${li})">${I('check2')} Сохранить черновик</button>
          <button class="btn ghost" onclick="apdLessonEditReset(${li})">${I('back')} Сбросить</button>
        </div>
      </div>`);
  };
  window.apdLessonEditSave = function(li){
    li = +li;
    const val = (id)=>{ const el = document.getElementById(id); return el ? el.value : ''; };
    if(!acS.acdDrafts) acS.acdDrafts = {};
    let slides, quiz;
    try{ slides = JSON.parse(val('apdEdSlides')||'[]'); if(!Array.isArray(slides)) throw 0; }
    catch(e){ toast('Слайды: невалидный JSON'); return; }
    try{ quiz = JSON.parse(val('apdEdQuiz')||'[]'); if(!Array.isArray(quiz)) throw 0; }
    catch(e){ toast('Тест: невалидный JSON'); return; }
    acS.acdDrafts[li] = {
      title: val('apdEdTitle').trim(),
      sub: val('apdEdSub').trim(),
      videoUrl: val('apdEdVideo').trim(),
      task: {intro: val('apdEdTask').trim(), chips:['Задача','Ответ'], ph:'…', verdict:'Принято.'},
      slides: slides,
      quiz: quiz
    };
    acSave();
    // применяем к AC_COURSE (in-memory)
    const L = AC_COURSE[li];
    const d = acS.acdDrafts[li];
    if(d.title) L.title = d.title;
    if(d.sub) L.sub = d.sub;
    if(d.videoUrl !== undefined) L.videoUrl = d.videoUrl;
    if(d.slides && d.slides.length) L.slides = d.slides;
    if(d.quiz && d.quiz.length) L.quiz = d.quiz;
    if(d.task && d.task.intro){ L.task = Object.assign({}, L.task||{chips:['Задача','Ответ'],ph:'…',verdict:'Принято.'}, d.task); }
    toast('Черновик урока сохранён');
    apdAdminTab('lessons');
  };
  window.apdLessonEditReset = function(li){
    li = +li;
    if(!acS.acdDrafts || !acS.acdDrafts[li]){ toast('Черновика нет'); apdAdminTab('lessons'); return; }
    delete acS.acdDrafts[li]; acSave();
    toast('Черновик сброшен — данные из курса вернулись при перезагрузке');
    apdAdminTab('lessons');
  };

  /* Участники — синтетический список (для UI) */
  function apdMembersOf(ci){
    // детерминированные mock-участники: для админа не критично, что реальный список пустой
    const c = AC_COURSES[ci];
    const rnd = apdDeterministicRnd(ci+19);
    const names = [
      {n:'Анна Григорьева', nick:'anna_g', from:'Москва'},
      {n:'Дмитрий Волков', nick:'dvolk', from:'СПб'},
      {n:'Ольга Кузнецова', nick:'olya_k', from:'Казань'},
      {n:'Илья Соколов', nick:'ilyas', from:'Новосибирск'},
      {n:'Марина Титова', nick:'mtitova', from:'Екатеринбург'},
      {n:'Кирилл Смирнов', nick:'ksmir', from:'Дубай'},
      {n:'Полина Ясенева', nick:'yasenva', from:'Минск'},
      {n:'Егор Панов', nick:'panov', from:'Алматы'},
      {n:'Роман Никитин', nick:'nikitin', from:'Тбилиси'},
      {n:'София Дорошенко', nick:'sofiid', from:'Ереван'}
    ];
    const banned = (acS.acdBanned||{})[c.id] || {};
    return names.map(x=>{
      const pct = Math.floor(rnd()*100);
      const buyAgo = ['сегодня','вчера','3 дня','неделю','2 недели','месяц'][Math.floor(rnd()*6)];
      return Object.assign({}, x, {pct, buyAgo, banned: !!banned[x.nick]});
    });
  }
  function apdAdminMembers(ci){
    const list = apdMembersOf(ci);
    const rows = list.map(m=>`<div class="acd-mem-item ${m.banned?'banned':''}">
      <span class="ava">${esc(m.n.charAt(0))}</span>
      <span class="m"><b>${esc(m.n)}</b><span>@${esc(m.nick)} · ${esc(m.from)} · куплен ${esc(m.buyAgo)} назад</span></span>
      <span class="stats"><b>${m.pct}%</b><span>прогресс</span></span>
      <div class="acd-mem-acts">
        <button onclick="apdMemberMsg('${esc(m.nick)}')" title="Написать" aria-label="Написать">${I('send')}</button>
        <button onclick="apdMemberRefund(${ci},'${esc(m.nick)}')" title="Вернуть деньги" aria-label="Вернуть">${I('money')}</button>
        <button class="danger" onclick="apdMemberBan(${ci},'${esc(m.nick)}')" title="${m.banned?'Разблокировать':'Заблокировать'}" aria-label="${m.banned?'Разблокировать':'Заблокировать'}">${I(m.banned?'check2':'trash')}</button>
      </div>
    </div>`).join('');
    return `<p class="dim" style="font-size:12px;line-height:1.55;margin-bottom:10px">${list.length} ${apdPlural(list.length,['ученик','ученика','учеников'])} · управление доступом и возвратами</p>
      <div class="acd-mem-list">${rows}</div>`;
  }
  window.apdMemberMsg = function(nick){ toast('Открыть чат с @' + nick); };
  window.apdMemberBan = function(ci, nick){
    ci = +ci;
    apdEnsureStore2();
    const c = AC_COURSES[ci];
    const b = acS.acdBanned[c.id] || {};
    if(b[nick]){ delete b[nick]; toast('Разблокирован: @' + nick); }
    else { b[nick] = 1; toast('Заблокирован: @' + nick); }
    acS.acdBanned[c.id] = b; acSave();
    apdAdminTab('members');
  };
  window.apdMemberRefund = function(ci, nick){
    if(typeof showPopup !== 'function'){ toast('Возврат оформлен · @' + nick); return; }
    ci = +ci;
    const c = AC_COURSES[ci];
    const price = apdGetSettings(ci).price || c.price || 0;
    showPopup({
      ico:'money', title:'Возврат средств',
      body:'Вернуть ' + acFmtPrice(price) + ' пользователю <b>@' + esc(nick) + '</b> за курс «' + esc(c.title) + '»? Средства спишутся с баланса курса, доступ ученика будет закрыт.',
      actions:[
        {label:'Оформить возврат', onclick:()=>{ toast('Возврат ' + acFmtPrice(price) + ' · @' + nick); }},
        {label:'Отмена', ghost:true}
      ]
    });
  };

  /* Настройки курса */
  function apdAdminSettings(ci){
    const s = apdGetSettings(ci);
    return `
      <div class="acd-set-row"><div class="m"><b>Цена курса</b><span>Основная цена (₽) — до применения скидки</span></div>
        <div class="ctl"><input type="number" min="0" step="100" value="${s.price}" onchange="apdSetSet(${ci},'price',+this.value)"></div>
      </div>
      <div class="acd-set-row"><div class="m"><b>Скидка (%)</b><span>0 — скидки нет</span></div>
        <div class="ctl"><input type="number" min="0" max="90" step="5" value="${s.discount}" onchange="apdSetSet(${ci},'discount',+this.value)"></div>
      </div>
      <div class="acd-set-row"><div class="m"><b>Курс доступен</b><span>Можно ли покупать и открывать</span></div>
        <div class="ctl">${apdTogHtml('avaTog', s.available, `apdSetSet(${ci},'available',this.checked)`)}</div>
      </div>
      <div class="acd-set-row"><div class="m"><b>Автопрогресс</b><span>Следующий урок открывается автоматически</span></div>
        <div class="ctl">${apdTogHtml('autoTog', s.autonext, `apdSetSet(${ci},'autonext',this.checked)`)}</div>
      </div>
      <div class="acd-set-row"><div class="m"><b>Выдавать сертификат</b><span>За полное прохождение направления</span></div>
        <div class="ctl">${apdTogHtml('certTog', s.certOn, `apdSetSet(${ci},'certOn',this.checked)`)}</div>
      </div>
      <div class="acd-set-row"><div class="m"><b>Комиссия платформы</b><span>10% фиксированно — от каждой продажи курса</span></div>
        <div class="ctl" style="color:var(--dim);font-size:13px;font-weight:700">10%</div>
      </div>`;
  }
  function apdTogHtml(id, on, cb){
    return `<label class="acd-tog"><input type="checkbox" id="${id}" ${on?'checked':''} onchange="${cb}"><span class="s"></span></label>`;
  }
  window.apdSetSet = function(ci, k, v){
    apdSetSetting(+ci, k, v);
    toast('Сохранено: ' + k);
  };

  /* Модерация — использует apd-комментарии из уроков курса */
  function apdAdminModer(ci){
    const idx = acCourseIdx(ci);
    let items = [];
    idx.forEach(li=>{
      const list = (acS.comments||{})[li] || [];
      list.forEach(c=>items.push({li, c}));
    });
    if(!items.length){
      return `<div class="acd-admin-empty">Комментариев к урокам этого курса пока нет.</div>`;
    }
    items = items.slice(0, 40);
    const rows = items.map(({li, c})=>`<div class="acd-mem-item">
      <span class="ava">${esc((c.name||'?').charAt(0).toUpperCase())}</span>
      <span class="m"><b>${esc(c.name||'Гость')}</b><span>Урок ${li+1} · ${esc(String((AC_COURSE[li]||{}).title||''))}</span></span>
      <div style="flex:1;min-width:0"><p style="font-size:12px;color:var(--dim);line-height:1.4;margin:0 8px;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${esc(c.text)}</p></div>
      <div class="acd-mem-acts">
        <button class="danger" onclick="apdModDel(${li},'${esc(c.id)}')" title="Удалить" aria-label="Удалить">${I('trash')}</button>
      </div>
    </div>`).join('');
    return `<p class="dim" style="font-size:12px;line-height:1.55;margin-bottom:10px">${items.length} ${apdPlural(items.length,['комментарий','комментария','комментариев'])} по курсу</p>
      <div class="acd-mem-list">${rows}</div>`;
  }
  window.apdModDel = function(li, id){
    li = +li;
    const arr = (acS.comments||{})[li] || [];
    const j = arr.findIndex(x=>x.id===id);
    if(j>=0){ arr.splice(j,1); acSave(); toast('Комментарий удалён'); apdAdminTab('moder'); }
  };

  /* Экспорт CSV */
  function apdAdminExport(ci){
    const list = apdMembersOf(ci);
    return `<p class="dim" style="font-size:12.5px;line-height:1.55;margin-bottom:12px">Экспортируй список учеников этого курса в CSV: имя, ник, дата покупки, прогресс, статус доступа.</p>
      <button class="btn" onclick="apdExportCsv(${ci})">${I('file')} Скачать CSV · ${list.length} ${apdPlural(list.length,['ученик','ученика','учеников'])}</button>
      <div style="height:10px"></div>
      <p class="dim" style="font-size:11.5px;line-height:1.55">Формат: <code style="font-family:ui-monospace,monospace;background:var(--raised);padding:2px 6px;border-radius:5px">name;nick;from;buyAgo;progress;status</code></p>`;
  }
  window.apdExportCsv = function(ci){
    ci = +ci;
    const list = apdMembersOf(ci);
    const c = AC_COURSES[ci];
    const lines = ['name;nick;from;bought;progress;status'];
    list.forEach(m=>{
      lines.push([m.n, m.nick, m.from, m.buyAgo, m.pct+'%', m.banned?'banned':'active'].map(x=>String(x).replace(/;/g,',')).join(';'));
    });
    // BOM для Excel-совместимости
    const csv = '\ufeff' + lines.join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'oko-academy-' + (c.id||'course') + '-' + list.length + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    toast('CSV сохранён · ' + list.length + ' ' + apdPlural(list.length,['ученик','ученика','учеников']));
  };

  /* =============================================================
     4) PDF СЕРТИФИКАТА — минимальный PDF с встроенным JPEG
     ============================================================= */
  function apdBuildPdfFromJpegDataUrl(jpegDataUrl, imgW, imgH){
    // jpegDataUrl -> latin1 binary string of JPEG bytes
    const b64 = jpegDataUrl.split(',')[1];
    const bin = atob(b64);
    const jpegBytes = new Uint8Array(bin.length);
    for(let i=0; i<bin.length; i++) jpegBytes[i] = bin.charCodeAt(i);
    // размер страницы: горизонтальная A4 при 72 dpi = 842 x 595
    const PW = 842, PH = 595;
    const scale = Math.min(PW / imgW, PH / imgH);
    const w = imgW * scale, h = imgH * scale;
    const x = (PW - w) / 2, y = (PH - h) / 2;

    const enc = new TextEncoder();
    const chunks = [];
    const offsets = [];
    let bufLen = 0;
    function push(str){
      const bytes = (str instanceof Uint8Array) ? str : enc.encode(str);
      chunks.push(bytes); bufLen += bytes.length; return bytes.length;
    }
    function pushObj(objText, extraBytes){
      offsets.push(bufLen);
      push(objText);
      if(extraBytes) push(extraBytes);
      push('\nendobj\n');
    }
    push('%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n');
    pushObj('1 0 obj\n<</Type /Catalog /Pages 2 0 R>>');
    pushObj('2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>');
    pushObj(`3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Contents 4 0 R /Resources <</XObject <</Im0 5 0 R>>>>>>`);
    const stream = `q\n${w.toFixed(3)} 0 0 ${h.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im0 Do\nQ`;
    const streamBytes = enc.encode(stream);
    pushObj(`4 0 obj\n<</Length ${streamBytes.length}>>\nstream\n`, new Uint8Array([...streamBytes, 0x0A]));
    push('endstream'); // Note: pushObj already added endobj; endstream is part of stream area — do properly:
    // Восстановим: последний "endobj" — лишний относительно stream. Пересоберём аккуратно.
    // Пересборка полностью, чтобы не было ошибок:
    chunks.length = 0; offsets.length = 0; bufLen = 0;
    push('%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n');
    // obj 1
    offsets.push(bufLen); push('1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n');
    // obj 2
    offsets.push(bufLen); push('2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n');
    // obj 3
    offsets.push(bufLen); push(`3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Contents 4 0 R /Resources <</XObject <</Im0 5 0 R>>>>>>\nendobj\n`);
    // obj 4 — content stream
    offsets.push(bufLen);
    push(`4 0 obj\n<</Length ${streamBytes.length}>>\nstream\n`);
    push(streamBytes);
    push('\nendstream\nendobj\n');
    // obj 5 — image XObject
    offsets.push(bufLen);
    push(`5 0 obj\n<</Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length}>>\nstream\n`);
    push(jpegBytes);
    push('\nendstream\nendobj\n');
    // xref
    const xrefStart = bufLen;
    push('xref\n0 6\n0000000000 65535 f \n');
    offsets.forEach(o=>push(String(o).padStart(10,'0') + ' 00000 n \n'));
    push(`trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`);

    const out = new Uint8Array(bufLen);
    let p = 0;
    for(const c of chunks){ out.set(c, p); p += c.length; }
    return new Blob([out], {type:'application/pdf'});
  }
  window.apdCertPdf = function(){
    // используем текущий сертификат (в overlay или в списке)
    const rec = (typeof acCertRec === 'function' && acCertShownNo)
      ? acS.certs.find(c=>c && c.no===acCertShownNo)
      : (typeof acCertRec === 'function' ? acCertRec() : null);
    if(!rec){ toast('Сертификат не выбран'); return; }
    const build = (pngUrl)=>{
      const img = new Image();
      img.onload = ()=>{
        const cv = document.createElement('canvas');
        cv.width = img.width; cv.height = img.height;
        cv.getContext('2d').drawImage(img, 0, 0);
        const jpeg = cv.toDataURL('image/jpeg', 0.92);
        const blob = apdBuildPdfFromJpegDataUrl(jpeg, img.width, img.height);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = rec.no + '.pdf';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 4000);
        toast('PDF сохранён: ' + rec.no + '.pdf');
      };
      img.onerror = ()=>toast('Не удалось собрать PDF');
      img.src = pngUrl;
    };
    if(acCertUrl && acCertShownNo === rec.no){ build(acCertUrl); return; }
    acMakeCert(rec, url=>{ acCertUrl = url; acCertShownNo = rec.no; build(url); });
  };

  /* Инъекция кнопки «Скачать PDF» в overlay сертификата (одноразово) */
  function apdInjectCertPdfButton(){
    const acts = document.querySelector('#acCertFull .ac-cert-full-actions');
    if(!acts || acts.querySelector('.acd-cert-pdf')) return;
    const btn = document.createElement('button');
    btn.className = 'btn sm ghost acd-cert-pdf';
    btn.innerHTML = I('file') + ' Скачать PDF';
    btn.onclick = apdCertPdf;
    // ставим сразу после первой кнопки
    const first = acts.querySelector('.btn');
    if(first && first.nextSibling) acts.insertBefore(btn, first.nextSibling);
    else acts.appendChild(btn);
  }

  /* =============================================================
     5) ДОП. ФОРМАТЫ УРОКА: файлы + livestream (стабы + рендер)
     ============================================================= */
  function apdLessonExtraFormats(){
    if(acView !== 'lesson') return;
    const root = document.getElementById('acRoot');
    if(!root) return;
    const L = acCur();
    if(!L) return;
    // 1) Livestream — если L.live есть, вставим карточку перед acCertBox
    const cert = document.getElementById('acCertBox');
    if(!cert) return;
    if(L.live && !root.querySelector('#apdLiveBox')){
      const box = document.createElement('div');
      box.id = 'apdLiveBox';
      box.className = 'card';
      box.style.padding = '4px';
      box.innerHTML = `<div class="acd-live" style="margin:0">
        <span class="ic">${I('circle-play')}</span>
        <div class="m"><b>Livestream: ${esc(L.live.title||'Прямой эфир')}</b><span>${esc(L.live.when||'скоро')} · ${esc(L.live.host||'ведущий')}</span></div>
        <button class="btn sm" onclick="apdLiveJoin('${esc(L.live.title||'')}')">${I('device')} Войти</button>
      </div>`;
      cert.parentNode.insertBefore(box, cert);
    }
    // 2) Файлы — если L.files есть, вставим ниже
    if(L.files && L.files.length && !root.querySelector('#apdFilesBox')){
      const box = document.createElement('div');
      box.id = 'apdFilesBox';
      box.className = 'card';
      box.style.padding = '12px 14px 14px';
      box.innerHTML = `<div style="font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--dim);margin-bottom:8px">${I('file')} Файлы урока</div>
        <div class="acd-files">${L.files.map(f=>`<a class="acd-file" href="${esc(f.url||'#')}" target="_blank" rel="noopener noreferrer" download="${esc(f.name||'file')}">
          <span class="ic">${I('file')}</span>
          <span class="m"><b>${esc(f.name||'файл')}</b><span>${esc(f.size||'')}</span></span>
          <svg class="i dl"><use href="#i-forward"/></svg>
        </a>`).join('')}</div>`;
      cert.parentNode.insertBefore(box, cert);
    }
  }
  window.apdLiveJoin = function(title){
    if(typeof showPopup === 'function'){
      showPopup({ico:'circle-play', title:'Livestream · ' + title, body:'Прямой эфир пройдёт в модуле «Звонки OKO». Уведомление придёт за 15 минут до старта.', actions:[{label:'Ок'}]});
    } else toast('Livestream: ' + title);
  };

  /* =============================================================
     Инициализация: догнать текущее состояние Академии
     ============================================================= */
  function apdBoot(){
    apdWatchCertOverlay();
    // отдельный вотчер для инъекции PDF-кнопки в фулскрин сертификата
    try{
      const t = document.getElementById('acCertFull');
      if(t){
        const obs = new MutationObserver(()=>{ if(t.classList.contains('open')) apdInjectCertPdfButton(); });
        obs.observe(t, {attributes:true, attributeFilter:['class']});
        apdInjectCertPdfButton();
      }
    }catch(e){}
    // Если Академия уже открыта — перерендерим
    const scr = document.getElementById('screen-academy');
    if(scr && scr.classList.contains('active')) acRender();
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apdBoot);
  } else {
    setTimeout(apdBoot, 20);
  }

})();
