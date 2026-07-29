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
      } else if(acView === 'course'){
        apdSetupCollapsibleBlocks();
      } else if(acView === 'lesson'){
        apdInjectLessonExtras();
        // Отложенная инъекция скорости — плеер может ре-рендериться асинхронно
        setTimeout(apdInjectSpeed, 20);
        setTimeout(apdInjectSpeed, 400);
      }
    }catch(e){}
  };
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
     Инициализация: догнать текущее состояние Академии
     ============================================================= */
  function apdBoot(){
    apdWatchCertOverlay();
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
