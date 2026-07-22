/* ===== STORIES-PLUS (sp-): сторис уровня Instagram/Telegram =====
   base.html не тронут — только chain-патчи ядра (openStoryCreate / createTextStory /
   addStory / showStory / closeStory / renderStories / storyNav) + свои вьюхи из overlay.html.

   Возможности:
   1) Вьювер: transform-based сегментные полоски (без layout), тап-переключение,
      удержание-пауза, свайп между авторами, строка ответа, быстрые реакции,
      счётчик просмотров, «кто посмотрел», состояние «просмотрено», закрытие.
   2) Редактор: текст/фото, 6 бренд-градиентов, размер/выравнивание текста,
      набор бренд-стикеров (SVG) с выбором и позицией, live-предпросмотр 9:16.
   3) Персист своих текст-сторис в localStorage (переживают перезагрузку).
   4) Кружки в ленте группируются по автору, бейдж-счётчик, состояние ring.

   Тайминг слайда полностью на модуле (spTimer) — это даёт точную паузу-по-удержанию,
   синхронную с CSS-анимацией полоски (класс sp-paused ставит animation-play-state). */

/* ---------- состояние (персист настроек редактора + своих сторис) ---------- */
const SP = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-stories-plus'))||{}; }catch(e){ return {}; } })();
SP.ed = Object.assign({bg:1, size:'m', align:'center', sticker:false, pos:'br', stk:'logo'}, SP.ed||{});
function spSave(){ try{ localStorage.setItem('oko-stories-plus', JSON.stringify({ed:SP.ed})); }catch(e){} }

/* 6 бренд-градиентов + цвет текста под каждый (яркий лайм требует тёмный текст) */
const SP_BGS = [
  {bg:'linear-gradient(135deg,#B9FF4D 0%,#9AFF00 45%,#3f6b00 100%)', fg:'#0b1400'},
  {bg:'linear-gradient(160deg,#131f04 0%,#060606 55%,#0e1a03 100%)', fg:'#fff'},
  {bg:'linear-gradient(150deg,#0a1a10 0%,#050505 60%,#08240e 100%)', fg:'#fff'},
  {bg:'linear-gradient(155deg,#233a00 0%,#0b1400 55%,#000 100%)',    fg:'#fff'},
  {bg:'linear-gradient(160deg,#050505 0%,#101010 45%,#2c5000 100%)', fg:'#fff'},
  {bg:'linear-gradient(145deg,#1c1c1c 0%,#000 60%,#131f04 100%)',    fg:'#fff'},
];
/* набор бренд-стикеров (существующие символы ядра) */
const SP_STK = ['logo','star','fire','heart','bolt','crown'];

/* длительность слайда, мс — единая точка для полоски и таймера */
const SP_DUR = 4000;

/* ---------- свои SVG-иконки выравнивания (штрих как у ядра) ---------- */
(function spIcons(){
  const defs = document.querySelector('svg defs'); if(!defs) return;
  const mk = (id, html)=>{
    if(document.getElementById(id)) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id', id); s.setAttribute('viewBox','0 0 100 100');
    s.innerHTML = html; defs.appendChild(s);
  };
  mk('i-sp-al','<path d="M14 25h72M14 50h42M14 75h58"/>');
  mk('i-sp-ac','<path d="M14 25h72M29 50h42M21 75h58"/>');
  mk('i-sp-ar','<path d="M14 25h72M44 50h42M28 75h58"/>');
})();

/* ---------- мок-зрители (в духе демо-контента) ---------- */
const SP_POOL = [
  ['МВ','Марк Волков'],['АК','Алина Крид'],['ИС','Игорь Савин'],['НК','Настя Ким'],
  ['ЛГ','Лера Голд'],['ТА','Тимур Ахметов'],['ПГ','Паша Гринёв'],['ОВ','Оля Верес'],
  ['КМ','Кирилл Мороз'],['СБ','Соня Белова'],['ДР','Денис Рублёв'],['ЖС','Жанна Сотник'],
];
const SP_TIMES = ['только что','1 мин назад','3 мин назад','8 мин назад','14 мин назад','27 мин назад',
  '41 мин назад','1 ч назад','2 ч назад','3 ч назад','5 ч назад','9 ч назад'];

function spGrowViews(st, n){
  st.spViewers = st.spViewers || [];
  st.spVwReacts = st.spVwReacts || {};
  const used = new Set(st.spViewers);
  const free = SP_POOL.map((_, i)=>i).filter(i=>!used.has(i));
  while(n-- > 0 && free.length){
    const k = free.splice(Math.floor(Math.random()*free.length), 1)[0];
    st.spViewers.unshift(k);
    if(Math.random() < .35) st.spVwReacts[k] = ['heart','fire','thumb'][Math.floor(Math.random()*3)];
  }
}
function spEnsureViews(st, grow){
  if(!st.spViewers) spGrowViews(st, 3 + Math.floor(Math.random()*3));
  else if(grow && Math.random() < .75) spGrowViews(st, 1 + Math.floor(Math.random()*2));
  return st.spViewers.length;
}

/* ---------- группировка сторис по автору ---------- */
function spKey(st){ return st.my ? '@me' : st.name; }
function spGroups(){
  const groups = [], by = {};
  (typeof STORIES !== 'undefined' ? STORIES : []).forEach((st, i)=>{
    if(st.add){ groups.push({add:true, name:st.name}); return; }
    const k = spKey(st);
    if(by[k]) by[k].idx.push(i);
    else { const g = {key:k, idx:[i]}; by[k] = g; groups.push(g); }
  });
  return groups;
}
function spGroupOf(idx){ return spGroups().find(x=>!x.add && x.idx.indexOf(idx) >= 0); }
function spOpenGroup(keyEnc){
  const key = decodeURIComponent(keyEnc||'');
  const g = spGroups().find(x=>!x.add && x.key === key);
  if(!g) return;
  const idx = g.idx.find(i=>!STORIES[i].seen);
  openStory(idx === undefined ? g.idx[0] : idx);
}

/* кружки в ленте: один автор — один кружок, бейдж с числом историй */
if(typeof renderStories === 'function'){
  const _spPrevRenderStories = renderStories;
  renderStories = function(){
    const row = document.getElementById('storiesRow');
    if(!row) return _spPrevRenderStories();
    row.innerHTML = spGroups().map(g=>{
      if(g.add) return `<div class="story add" onclick="openStoryCreate()"><div class="ring"><div class="ava">${I('plus')}</div></div><small>${esc(g.name||'Твоя')}</small></div>`;
      const st = STORIES[g.idx[0]];
      const seen = g.idx.every(i=>STORIES[i].seen);
      const ava = st.src ? `<div class="ava" style="background-image:url(${st.src});background-size:cover"></div>`
        : st.avaIcon ? `<div class="ava lime">${I(st.avaIcon)}</div>` : `<div class="ava">${esc(st.ava)}</div>`;
      const cnt = g.idx.length > 1 ? `<b class="sp-cnt">${g.idx.length}</b>` : '';
      return `<div class="story ${seen?'seen':''}" id="story-${g.idx[0]}" data-spg="${encodeURIComponent(g.key)}" onclick="spOpenGroup(this.dataset.spg)"><div class="ring" style="position:relative">${ava}${cnt}</div><small>${esc(st.name)}</small></div>`;
    }).join('');
  };
}

/* ---------- вьювер: элементы-декораторы + жесты ---------- */
let spLastIdx = -1;

function spViewerEls(){
  const v = document.getElementById('storyViewer'); if(!v) return null;
  let bars = document.getElementById('spBars');
  if(!bars){
    bars = document.createElement('div'); bars.id = 'spBars'; bars.className = 'sp-bars';
    v.appendChild(bars);
    const foot = document.createElement('div'); foot.id = 'spFoot'; foot.className = 'sp-foot';
    v.appendChild(foot);
    spBindGestures(v);          /* жесты вешаем один раз */
    v.style.setProperty('--sp-dur', (SP_DUR/1000) + 's');
  }
  return {v, bars, foot: document.getElementById('spFoot')};
}

/* ---------- тайминг слайда с поддержкой паузы ---------- */
let spTimer = null, spStart = 0, spRemain = SP_DUR, spPaused = false;
function spStartTimer(){
  clearTimeout(spTimer);
  try{ clearTimeout(storyTimer); }catch(e){}   /* ядро тоже ставит таймер — гасим его */
  spRemain = SP_DUR; spStart = Date.now(); spPaused = false;
  const v = document.getElementById('storyViewer');
  if(v) v.classList.remove('sp-paused');
  spTimer = setTimeout(spAdvance, spRemain);
}
function spPause(){
  if(spPaused) return; spPaused = true;
  clearTimeout(spTimer);
  spRemain = Math.max(0, spRemain - (Date.now() - spStart));
  const v = document.getElementById('storyViewer');
  if(v) v.classList.add('sp-paused');
}
function spResume(){
  if(!spPaused) return; spPaused = false;
  spStart = Date.now();
  clearTimeout(spTimer);
  spTimer = setTimeout(spAdvance, spRemain);
  const v = document.getElementById('storyViewer');
  if(v) v.classList.remove('sp-paused');
}
function spStopTimer(){ clearTimeout(spTimer); spPaused = false; }
function spAdvance(){ if(typeof nextStory === 'function') nextStory(); }

/* ---------- жесты: тап-переключение / удержание-пауза / свайп по авторам ---------- */
let spReplyLock = false;   /* строка ответа в фокусе — жесты и авто-листание стоят */
function spBindGestures(v){
  let sx=0, sy=0, downT=0, hold=null, isHold=false, moved=false, navHandled=false;
  const inUI = (t)=> !!(t && t.closest && t.closest('.sp-foot, .sv-close, #spBars'));

  v.addEventListener('pointerdown', (e)=>{
    if(spReplyLock || inUI(e.target)) return;
    sx = e.clientX; sy = e.clientY; downT = Date.now();
    isHold = false; moved = false; navHandled = false;
    clearTimeout(hold);
    hold = setTimeout(()=>{ isHold = true; spPause(); }, 250);   /* удержание → пауза */
  });
  v.addEventListener('pointermove', (e)=>{
    if(!downT) return;
    if(Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10){ moved = true; clearTimeout(hold); }
  });
  const finish = (e)=>{
    if(!downT) return;
    clearTimeout(hold);
    const dt = Date.now() - downT, dx = e.clientX - sx, dy = e.clientY - sy;
    downT = 0;
    if(spReplyLock || inUI(e.target)) return;
    if(isHold){ spResume(); navHandled = true; return; }
    if(Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3){   /* свайп → смена автора */
      navHandled = true;
      if(dx < 0) spNextAuthor(); else spPrevAuthor();
      return;
    }
    if(dt < 350 && !moved){                                       /* тап → prev/next история */
      navHandled = true;
      if(e.clientX < window.innerWidth * 0.32){ if(typeof prevStory === 'function') prevStory(); }
      else { if(typeof nextStory === 'function') nextStory(); }
    }
  };
  v.addEventListener('pointerup', finish);
  v.addEventListener('pointercancel', ()=>{ clearTimeout(hold); if(isHold) spResume(); downT = 0; });
  /* гасим клик ядра (onclick=storyNav) — навигацию делаем сами в pointerup */
  v.addEventListener('click', (e)=>{ if(navHandled){ navHandled = false; e.stopPropagation(); } }, true);
}

function spNextAuthor(){
  const g = spGroupOf(curStory); if(!g) return;
  const groups = spGroups().filter(x=>!x.add);
  const pos = groups.indexOf(g);
  const nx = groups[pos + 1];
  if(nx){ const t = nx.idx.find(i=>!STORIES[i].seen); curStory = (t===undefined?nx.idx[0]:t); showStory(); }
  else if(typeof closeStory === 'function') closeStory();
}
function spPrevAuthor(){
  const g = spGroupOf(curStory); if(!g) return;
  const groups = spGroups().filter(x=>!x.add);
  const pos = groups.indexOf(g);
  const pv = groups[pos - 1];
  if(pv){ curStory = pv.idx[0]; showStory(); }
  else { curStory = g.idx[0]; showStory(); }   /* уже первый автор — рестарт */
}

/* ---------- декор вьювера: сегменты, низ (ответ/реакции/просмотры), стили ---------- */
function spDecorate(){
  const els = spViewerEls(); if(!els) return;
  const st = typeof STORIES !== 'undefined' && STORIES[curStory];
  if(!st || st.add){ spStopTimer(); return; }

  /* сегментные полоски автора (всегда через модуль → transform-based) */
  const g = spGroupOf(curStory);
  const seg = g ? g.idx : [curStory];
  const cur = seg.indexOf(curStory);
  els.v.classList.toggle('sp-multi', seg.length > 1);
  els.bars.innerHTML = seg.map((idx, k)=>
    `<button class="sp-seg ${k < cur ? 'done' : k === cur ? 'act' : ''}" onclick="spJump(${idx},event)" title="История ${k+1}"><i><b></b></i></button>`).join('');

  /* дожать «просмотрено» на сгруппированном кружке */
  if(g){
    const ring = document.getElementById('story-'+g.idx[0]);
    if(ring && g.idx.every(i=>STORIES[i].seen)) ring.classList.add('seen');
  }

  /* стили из редактора: цвет текста, размер, выравнивание, стикер */
  const card = document.getElementById('svCard');
  if(card){
    card.style.color = (st.sp && st.sp.fg) ? st.sp.fg : '';
    if(st.sp){
      const p = card.querySelector('p');
      if(p){
        p.style.fontSize = ({s:'14px', m:'18px', l:'23px'})[st.sp.size] || '';
        p.style.textAlign = st.sp.align || 'center';
        if(st.sp.align && st.sp.align !== 'center'){ p.style.maxWidth = '100%'; p.style.width = '100%'; }
        p.style.color = st.sp.fg || '#fff';
        p.style.fontWeight = '600';
      }
      const tm = card.querySelector('.sv-time');
      if(tm && st.sp.fg){ tm.style.color = st.sp.fg; tm.style.opacity = '.62'; }
      if(st.sp.sticker && !card.querySelector('.sp-sticker'))
        card.insertAdjacentHTML('beforeend', `<div class="sp-sticker sp-pos-${st.sp.pos||'br'}">${I(st.sp.stk||'logo')}</div>`);
    }
  }

  /* низ вьювера: свои — счётчик глаз; чужие — строка ответа + быстрые реакции */
  const grow = spLastIdx !== curStory;
  spLastIdx = curStory;
  if(st.my){
    const n = spEnsureViews(st, grow);
    els.foot.innerHTML = `<button class="sp-eye" onclick="spOpenViewers(event)">${I('eye')}<span>${n}</span>${I('chev')}</button>`;
  } else {
    els.foot.innerHTML = `<div class="sp-foot-bar">
      <form class="sp-reply" onsubmit="return spSendReply(event)">
        <input id="spReplyIn" class="sp-reply-in" placeholder="Ответить ${esc((st.name||'').split(' ')[0]||'автору')}…" autocomplete="off" onfocus="spReplyFocus()" onblur="spReplyBlur()">
        <button type="submit" class="sp-reply-send" title="Отправить">${I('send')}</button>
      </form>
      <div class="sp-reacts">` + ['heart','fire','thumb'].map(ic=>
        `<button class="sp-react ${st.spReacted===ic?'on':''}" onclick="spReact('${ic}',event)" title="Реакция">${I(ic)}</button>`).join('') + `</div>
    </div>`;
  }

  spStartTimer();   /* запускаем слайд под управлением модуля */
}

function spJump(idx, ev){
  if(ev) ev.stopPropagation();
  if(typeof curStory === 'undefined' || !STORIES[idx]) return;
  curStory = idx; showStory();
}

/* ---------- строка ответа ---------- */
function spReplyFocus(){ spReplyLock = true; spPause(); }
function spReplyBlur(){ spReplyLock = false; spResume(); }
function spSendReply(ev){
  if(ev) ev.preventDefault();
  const inp = document.getElementById('spReplyIn');
  const val = inp ? inp.value.trim() : '';
  if(!val){ if(inp) inp.blur(); return false; }
  if(inp){ inp.value = ''; inp.blur(); }
  if(typeof toast === 'function') toast('Ответ отправлен');
  spFlyBurst(document.querySelector('.sp-reply-send'), 'heart', 3);
  return false;
}

/* ---------- реакция на чужую сторис: подсветка + летящая анимация + тост ---------- */
function spReact(ic, ev){
  if(ev) ev.stopPropagation();
  const st = typeof STORIES !== 'undefined' && STORIES[curStory];
  if(!st) return;
  st.spReacted = ic;
  document.querySelectorAll('#spFoot .sp-react').forEach(b=>b.classList.remove('on'));
  const btn = ev && ev.currentTarget;
  if(btn) btn.classList.add('on');
  spFlyBurst(btn, ic, 5);
  if(typeof toast === 'function') toast('Реакция отправлена');
}
/* летящие частицы от кнопки (реакция / ответ) */
function spFlyBurst(btn, ic, count){
  if(!btn || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = btn.getBoundingClientRect();
  for(let k = 0; k < count; k++){
    const f = document.createElement('div');
    f.className = 'sp-fly';
    f.style.left = (r.left + r.width/2 - 13 + (Math.random()*28 - 14)) + 'px';
    f.style.top = (r.top - 8) + 'px';
    f.style.setProperty('--dx', (Math.random()*76 - 38) + 'px');
    f.style.animationDelay = (k*90) + 'ms';
    f.style.animationDuration = (0.85 + Math.random()*0.5) + 's';
    f.innerHTML = I(ic, 'fill');
    document.body.appendChild(f);
    f.addEventListener('animationend', ()=>f.remove());
    setTimeout(()=>f.remove(), 2400); /* страховка */
  }
}

/* ---------- шторка «кто посмотрел» (сторис на паузе, поверх вьювера) ---------- */
function spOpenViewers(ev){
  if(ev) ev.stopPropagation();
  const st = typeof STORIES !== 'undefined' && STORIES[curStory];
  const wrap = document.getElementById('spVwWrap');
  if(!st || !st.my || !wrap) return;
  spEnsureViews(st, false);
  document.getElementById('spVwCount').textContent = st.spViewers.length;
  document.getElementById('spVwList').innerHTML = st.spViewers.length ? st.spViewers.map((pi, j)=>{
    const p = SP_POOL[pi];
    const re = st.spVwReacts && st.spVwReacts[pi];
    return `<div class="sp-vw-item" style="animation-delay:${Math.min(j*45, 400)}ms">
      <div class="ava">${esc(p[0])}</div>
      <div><b>${esc(p[1])}${typeof vBadge==='function' ? vBadge(p[1]) : ''}</b><small>${SP_TIMES[Math.min(j, SP_TIMES.length-1)]}</small></div>
      ${re ? `<span class="sp-vw-re" title="Реакция">${I(re)}</span>` : ''}
    </div>`;
  }).join('') : '<div class="sp-vw-empty">Пока никто не посмотрел</div>';
  wrap.classList.add('open');
  spPause();
  if(typeof nvPush === 'function') nvPush('view:sp-viewers', spCloseViewers);
}
function spCloseViewers(){
  const wrap = document.getElementById('spVwWrap');
  if(!wrap || !wrap.classList.contains('open')) return;
  wrap.classList.remove('open');
  if(typeof nvPop === 'function') nvPop('view:sp-viewers');
  const v = document.getElementById('storyViewer');
  if(v && v.classList.contains('open')) spResume();
}

/* ---------- редактор текст-сторис ---------- */
function spOpenEditor(){
  const ed = document.getElementById('spEditor'); if(!ed) return;
  const txt = document.getElementById('spEdText');
  if(txt) txt.innerText = '';
  spEdApply(); spEdSync();
  ed.classList.add('open');
  setTimeout(()=>{ try{ txt && txt.focus(); }catch(e){} }, 330);
  if(typeof nvPush === 'function') nvPush('view:sp-editor', spCloseEditor);
}
function spCloseEditor(){
  const ed = document.getElementById('spEditor');
  if(!ed || !ed.classList.contains('open')) return;
  ed.classList.remove('open');
  if(typeof nvPop === 'function') nvPop('view:sp-editor');
}
function spEdApply(){
  const card = document.getElementById('spEdCard'); if(!card) return;
  const cfg = SP_BGS[SP.ed.bg] || SP_BGS[1];
  card.style.background = cfg.bg;
  card.style.color = cfg.fg;
  card.className = 'sp-ed-card sp-sz-' + SP.ed.size + ' sp-al-' + SP.ed.align + (SP.ed.sticker ? ' sp-stk' : '');
  const stk = document.getElementById('spEdSticker');
  if(stk){
    stk.className = 'sp-ed-sticker sp-pos-' + (SP.ed.pos || 'br');
    stk.innerHTML = `<svg class="i"><use href="#i-${SP.ed.stk||'logo'}"/></svg>`;
  }
  /* свотчи фонов (одноразовая отрисовка) */
  const sw = document.getElementById('spEdSwatches');
  if(sw && !sw.children.length)
    sw.innerHTML = SP_BGS.map((b, i)=>`<button class="sp-sw" style="background:${b.bg}" onclick="spEdBg(${i})" title="Фон ${i+1}"></button>`).join('');
  if(sw) Array.from(sw.children).forEach((b, i)=>b.classList.toggle('on', i === SP.ed.bg));
  /* выбор стикера (одноразовая отрисовка) */
  const sk = document.getElementById('spEdStickers');
  if(sk && !sk.children.length)
    sk.innerHTML = SP_STK.map(id=>`<button class="sp-stk-pick" data-v="${id}" onclick="spPickSticker('${id}')" title="Стикер"><svg class="i"><use href="#i-${id}"/></svg></button>`).join('');
  if(sk) Array.from(sk.children).forEach(b=>b.classList.toggle('on', SP.ed.sticker && b.dataset.v === SP.ed.stk));
  document.querySelectorAll('#spEdSizes button').forEach(b=>b.classList.toggle('on', b.dataset.v === SP.ed.size));
  document.querySelectorAll('#spEdAligns button').forEach(b=>b.classList.toggle('on', b.dataset.v === SP.ed.align));
  const tb = document.getElementById('spEdStkBtn');
  if(tb) tb.classList.toggle('on', !!SP.ed.sticker);
}
function spEdBg(i){ SP.ed.bg = i; spSave(); spEdApply(); }
function spEdSize(v){ SP.ed.size = v; spSave(); spEdApply(); }
function spEdAlign(v){ SP.ed.align = v; spSave(); spEdApply(); }
function spToggleSticker(){ SP.ed.sticker = !SP.ed.sticker; spSave(); spEdApply(); }
function spPickSticker(id){ SP.ed.stk = id; SP.ed.sticker = true; spSave(); spEdApply(); }
function spCycleSticker(ev){
  if(ev) ev.stopPropagation();
  const order = ['br','bl','tl','tr'];
  SP.ed.pos = order[(order.indexOf(SP.ed.pos) + 1) % order.length] || 'br';
  spSave(); spEdApply();
}
/* совместимость с pickStoryPhoto ядра: он берёт текст из #stStoryText */
function spEdSync(){
  const src = document.getElementById('spEdText');
  const dst = document.getElementById('stStoryText');
  if(src && dst) dst.value = (src.innerText || '').trim();
}
function spPickPhoto(){
  spEdSync();
  const inp = document.getElementById('storyPhotoInput');
  if(inp) inp.click(); else if(typeof toast === 'function') toast('Фото недоступно');
}
function spPublish(){
  const el = document.getElementById('spEdText');
  const txt = (el ? el.innerText : '').replace(/\s+/g,' ').trim();
  if(!txt){ if(typeof toast === 'function') toast('Напиши текст истории'); return; }
  if(typeof addStory !== 'function') return;
  const cfg = SP_BGS[SP.ed.bg] || SP_BGS[1];
  addStory({text:txt, bg:cfg.bg,
    sp:{size:SP.ed.size, align:SP.ed.align, sticker:!!SP.ed.sticker, pos:SP.ed.pos, stk:SP.ed.stk, fg:cfg.fg}});
}

/* ---------- персист своих текст-сторис ---------- */
const SP_STORE = 'oko-sp-mystories';
function spPersist(){
  try{
    if(typeof STORIES === 'undefined') return;
    const mine = STORIES.filter(s=> s.my && !s.spRestored && (!s.src || String(s.src).startsWith('data:')))
      .map(s=>({text:s.text||'', bg:s.bg||'', src:(s.src&&String(s.src).startsWith('data:'))?s.src:'', sp:s.sp||null, ts:s.spTs||Date.now()}))
      .slice(0, 12);
    localStorage.setItem(SP_STORE, JSON.stringify(mine));
  }catch(e){}
}
function spRestore(){
  try{
    const saved = JSON.parse(localStorage.getItem(SP_STORE) || '[]');
    if(!Array.isArray(saved) || !saved.length || typeof STORIES === 'undefined') return;
    const nm = (typeof PROFILE !== 'undefined' && PROFILE.name) ? PROFILE.name : 'Ты';
    /* восстанавливаем в исходном порядке (новые — ближе к началу) */
    saved.slice().reverse().forEach(d=>{
      STORIES.splice(1, 0, {my:true, spRestored:true, spTs:d.ts, name:nm, ava:nm[0],
        text:d.text, bg:d.bg||undefined, src:d.src||undefined, sp:d.sp||undefined});
    });
  }catch(e){}
}

/* ---------- chain-патчи ядра ---------- */
if(typeof openStoryCreate === 'function'){
  const _spPrevOpenStoryCreate = openStoryCreate;
  openStoryCreate = function(){
    if(document.getElementById('spEditor')) spOpenEditor();
    else _spPrevOpenStoryCreate(); /* фолбэк — прежний sheet */
  };
}
if(typeof createTextStory === 'function'){
  const _spPrevCreateTextStory = createTextStory;
  createTextStory = function(){
    const ed = document.getElementById('spEditor');
    if(ed && ed.classList.contains('open')) spPublish();
    else _spPrevCreateTextStory();
  };
}
if(typeof addStory === 'function'){
  const _spPrevAddStory = addStory;
  addStory = function(data){
    _spPrevAddStory(data);   /* splice + closeSheet + renderStories (сгруппированный) + toast */
    try{ if(STORIES[1] && STORIES[1].my) STORIES[1].spTs = Date.now(); }catch(e){}
    spPersist();
    spCloseEditor();
  };
}
if(typeof showStory === 'function'){
  const _spPrevShowStory = showStory; /* поверх патча demo-content (градиент-фон) */
  showStory = function(){
    _spPrevShowStory();
    try{ spDecorate(); }catch(e){ console.warn('stories-plus decorate:', e); }
  };
}
if(typeof closeStory === 'function'){
  const _spPrevCloseStory = closeStory;
  closeStory = function(){
    spStopTimer();
    _spPrevCloseStory();
    spLastIdx = -1; spReplyLock = false;
    const wrap = document.getElementById('spVwWrap');
    if(wrap && wrap.classList.contains('open')){
      wrap.classList.remove('open');
      if(typeof nvPop === 'function') nvPop('view:sp-viewers');
    }
  };
}

/* ---------- демо: вторые истории у авторов (виден мультисторис-режим) ---------- */
function spSeed(){
  if(typeof STORIES === 'undefined' || STORIES.some(s=>s.spSeed)) return;
  const put = (name, story)=>{
    const i = STORIES.findIndex(s=>!s.add && s.name === name);
    if(i >= 0) STORIES.splice(i + 1, 0, story);
  };
  put('OKO', {spSeed:true, avaIcon:'logo', name:'OKO',
    text:'Сторис-редактор уже здесь: градиенты бренда, размер текста и стикеры. Жми плюс в ленте.',
    bg:'linear-gradient(160deg,#050505 0%,#101010 45%,#2c5000 100%)',
    sp:{size:'m', align:'center', sticker:true, pos:'br', stk:'logo', fg:'#fff'}});
  put('Марк Волков', {spSeed:true, ava:'МВ', name:'Марк Волков',
    text:'Вторая часть кейса кофейни: до и после цветокора. Исходник против финала — разница в один вечер работы.',
    bg:'linear-gradient(150deg,#151f08 0%,#070707 55%,#0c1f14 100%)'});
}

/* ---------- самоинициализация ---------- */
(function spInit(){
  try{
    spSeed();
    spRestore();
    if(typeof renderStories === 'function' && document.getElementById('storiesRow')) renderStories();
    spEdApply(); /* свотчи и состояние контролов готовы до первого открытия */
  }catch(e){ console.warn('stories-plus init:', e); }
})();
