/* ===== STORIES-PLUS (sp-): сторис-редактор, просмотры, реакции, мультисторис =====
   base.html не тронут — только chain-патчи ядра (openStoryCreate / createTextStory /
   addStory / showStory / closeStory / renderStories) + свои вьюхи из overlay.html.
   1) Полноценный редактор текст-сторис: 6 бренд-градиентов свотчами, размер и
      выравнивание текста, live-предпросмотр 9:16, стикер-глаз OKO по углам.
   2) Просмотры своих сторис: счётчик-глаз в вьювере + шторка «кто посмотрел»
      (мок-имена в духе демо-контента, список растёт со временем).
   3) Быстрые реакции на чужие сторис (сердце/огонь/палец) с летящей анимацией.
   4) Прогресс-сегменты мультисторис: у автора с >1 историей — полоски сверху с
      тап-переключением; кружки в ленте группируются по автору (бейдж-счётчик). */

/* ---------- состояние (персист только настроек редактора) ---------- */
const SP = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-stories-plus'))||{}; }catch(e){ return {}; } })();
SP.ed = Object.assign({bg:1, size:'m', align:'center', sticker:false, pos:'br'}, SP.ed||{});
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

/* ---------- декор вьювера: сегменты, счётчик, реакции, стили редактора ---------- */
let spLastIdx = -1;

function spViewerEls(){
  const v = document.getElementById('storyViewer'); if(!v) return null;
  let bars = document.getElementById('spBars');
  if(!bars){
    bars = document.createElement('div'); bars.id = 'spBars'; bars.className = 'sp-bars';
    v.appendChild(bars);
    const foot = document.createElement('div'); foot.id = 'spFoot'; foot.className = 'sp-foot';
    v.appendChild(foot);
  }
  return {v, bars, foot: document.getElementById('spFoot')};
}

function spDecorate(){
  const els = spViewerEls(); if(!els) return;
  const st = typeof STORIES !== 'undefined' && STORIES[curStory];
  if(!st || st.add) return;
  els.v.classList.remove('sp-paused');

  /* 4. прогресс-сегменты мультисторис (у автора >1 истории) */
  const g = spGroups().find(x=>!x.add && x.key === spKey(st));
  if(g && g.idx.length > 1){
    els.v.classList.add('sp-multi');
    const cur = g.idx.indexOf(curStory);
    els.bars.innerHTML = g.idx.map((idx, k)=>
      `<button class="sp-seg ${k < cur ? 'done' : k === cur ? 'act' : ''}" onclick="spJump(${idx},event)" title="История ${k+1}"><i><b></b></i></button>`).join('');
  } else {
    els.v.classList.remove('sp-multi');
    els.bars.innerHTML = '';
  }
  /* дожать «просмотрено» на сгруппированном кружке */
  if(g){
    const ring = document.getElementById('story-'+g.idx[0]);
    if(ring && g.idx.every(i=>STORIES[i].seen)) ring.classList.add('seen');
  }

  /* 1. стили из редактора: цвет текста, размер, выравнивание, стикер */
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
        card.insertAdjacentHTML('beforeend', `<div class="sp-sticker sp-pos-${st.sp.pos||'br'}">${I('logo')}</div>`);
    }
  }

  /* 2/3. низ вьювера: свои — счётчик глаз, чужие — быстрые реакции */
  const grow = spLastIdx !== curStory;
  spLastIdx = curStory;
  if(st.my){
    const n = spEnsureViews(st, grow);
    els.foot.innerHTML = `<button class="sp-eye" onclick="spOpenViewers(event)">${I('eye')}<span>${n}</span>${I('chev')}</button>`;
  } else {
    els.foot.innerHTML = `<div class="sp-reacts">` + ['heart','fire','thumb'].map(ic=>
      `<button class="sp-react ${st.spReacted===ic?'on':''}" onclick="spReact('${ic}',event)" title="Отправить реакцию">${I(ic)}</button>`).join('') + `</div>`;
  }
}

function spJump(idx, ev){
  if(ev) ev.stopPropagation();
  if(typeof curStory === 'undefined' || !STORIES[idx]) return;
  curStory = idx; showStory();
}

/* 3. реакция на чужую сторис: подсветка + летящая анимация + тост */
function spReact(ic, ev){
  if(ev) ev.stopPropagation();
  const st = typeof STORIES !== 'undefined' && STORIES[curStory];
  if(!st) return;
  st.spReacted = ic;
  document.querySelectorAll('#spFoot .sp-react').forEach(b=>b.classList.remove('on'));
  const btn = ev && ev.currentTarget;
  if(btn) btn.classList.add('on');
  if(btn && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    const r = btn.getBoundingClientRect();
    for(let k = 0; k < 5; k++){
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
  toast('Реакция отправлена');
}

/* 2. шторка «кто посмотрел» (сторис на паузе, поверх вьювера) */
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
  try{ clearTimeout(storyTimer); }catch(e){}
  const v = document.getElementById('storyViewer');
  if(v) v.classList.add('sp-paused');
  if(typeof nvPush === 'function') nvPush('view:sp-viewers', spCloseViewers);
}
function spCloseViewers(){
  const wrap = document.getElementById('spVwWrap');
  if(!wrap || !wrap.classList.contains('open')) return;
  wrap.classList.remove('open');
  if(typeof nvPop === 'function') nvPop('view:sp-viewers');
  const v = document.getElementById('storyViewer');
  if(v && v.classList.contains('open')) showStory(); /* продолжить текущий слайд заново */
}

/* ---------- 1. редактор текст-сторис ---------- */
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
  if(stk) stk.className = 'sp-ed-sticker sp-pos-' + (SP.ed.pos || 'br');
  const sw = document.getElementById('spEdSwatches');
  if(sw && !sw.children.length)
    sw.innerHTML = SP_BGS.map((b, i)=>`<button class="sp-sw" style="background:${b.bg}" onclick="spEdBg(${i})" title="Фон ${i+1}"></button>`).join('');
  if(sw) Array.from(sw.children).forEach((b, i)=>b.classList.toggle('on', i === SP.ed.bg));
  document.querySelectorAll('#spEdSizes button').forEach(b=>b.classList.toggle('on', b.dataset.v === SP.ed.size));
  document.querySelectorAll('#spEdAligns button').forEach(b=>b.classList.toggle('on', b.dataset.v === SP.ed.align));
  const tb = document.getElementById('spEdStkBtn');
  if(tb) tb.classList.toggle('on', !!SP.ed.sticker);
}
function spEdBg(i){ SP.ed.bg = i; spSave(); spEdApply(); }
function spEdSize(v){ SP.ed.size = v; spSave(); spEdApply(); }
function spEdAlign(v){ SP.ed.align = v; spSave(); spEdApply(); }
function spToggleSticker(){ SP.ed.sticker = !SP.ed.sticker; spSave(); spEdApply(); }
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
  if(inp) inp.click(); else toast('Фото недоступно');
}
function spPublish(){
  const el = document.getElementById('spEdText');
  const txt = (el ? el.innerText : '').replace(/\s+/g,' ').trim();
  if(!txt){ toast('Напиши текст истории'); return; }
  if(typeof addStory !== 'function') return;
  const cfg = SP_BGS[SP.ed.bg] || SP_BGS[1];
  addStory({text:txt, bg:cfg.bg,
    sp:{size:SP.ed.size, align:SP.ed.align, sticker:!!SP.ed.sticker, pos:SP.ed.pos, fg:cfg.fg}});
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
    _spPrevAddStory(data);   /* splice + closeSheet + renderStories (уже сгруппированный) + toast */
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
    _spPrevCloseStory();
    spLastIdx = -1;
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
    text:'Сторис-редактор уже здесь: градиенты бренда, размер текста и стикер-глаз. Жми плюс в ленте.',
    bg:'linear-gradient(160deg,#050505 0%,#101010 45%,#2c5000 100%)',
    sp:{size:'m', align:'center', sticker:true, pos:'br', fg:'#fff'}});
  put('Марк Волков', {spSeed:true, ava:'МВ', name:'Марк Волков',
    text:'Вторая часть кейса кофейни: до и после цветокора. Исходник против финала — разница в один вечер работы.',
    bg:'linear-gradient(150deg,#151f08 0%,#070707 55%,#0c1f14 100%)'});
}

/* ---------- самоинициализация ---------- */
(function spInit(){
  try{
    spSeed();
    if(typeof renderStories === 'function' && document.getElementById('storiesRow')) renderStories();
    spEdApply(); /* свотчи и состояние контролов готовы до первого открытия */
  }catch(e){ console.warn('stories-plus init:', e); }
})();
