/* ===== ADS: рекламный кабинет (префикс ads-) ===== */

const ADS_LS = 'oko-ads';
const ADS_CPM = 28;               /* ₽ за 1000 показов */
const ADS_POST_BASE = 9000;       /* id постов рекламы в ленте */
const ADS_STATUS = {
  mod:  {l:'Модерация'},
  act:  {l:'Активна'},
  pause:{l:'Пауза'},
  rej:  {l:'Отклонена'},
  done: {l:'Завершена'}
};
/* стоп-слова ИИ-модератора: наркотики / казино / оружие / скам / пирамиды + синонимы */
const ADS_STOPWORDS = [
  'наркот','героин','кокаин','марихуан','мефедрон','спайс','закладк',
  'казино','букмекер','ставки на спорт','азартн','гэмблинг','слоты на деньги',
  'оружи','пистолет','боеприпас','гранат',
  'скам','лохотрон','развод на деньги','фальшив','подделк',
  'пирамид','быстрый заработок без вложений','гарантия дохода','хайп-проект'
];

let ADS = {
  seq: 3,
  camps: [
    {id:1, name:'OKO Академия — поток №4', text:'Контент-завод за 7 дней: 30 роликов в месяц на автомате. Старт 20 июля, осталось 14 мест из 50.',
     cta:'Подписаться', link:'https://oko.app/academy', geo:'РФ', interests:['контент','маркетинг'], ages:['18-24','25-34'],
     budget:3000, spent:1268.4, imps:45320, clicks:1121, status:'act',
     ab:{tb:'30 роликов в месяц без монтажёра и съёмок', ka:.019, kb:.031, a:{i:22660,c:427}, b:{i:22660,c:694}},
     hist:[120,180,150,240,210,320,280,360,300,410,380,460,420,510,470,560,530,610], created: Date.now()-2*864e5},
    {id:2, name:'Партнёрка OKO — 15% с оборота', text:'Приводи авторов и получай 15% с их подписки + 5% со второй линии. Выплаты сразу на лицевой счёт.',
     cta:'Подробнее', link:'https://oko.app/partners', geo:'СНГ', interests:['бизнес','маркетинг'], ages:['25-34','35-44'],
     budget:1500, spent:1500, imps:53570, clicks:1547, status:'done',
     hist:[520,610,580,660,700,640,720,690,750,710,680,730,700,660,610,540,420,260], created: Date.now()-9*864e5},
  ]
};

function adsSave(){ try{ localStorage.setItem(ADS_LS, JSON.stringify(ADS)); }catch(e){} }
function adsLoad(){
  try{
    const raw = localStorage.getItem(ADS_LS);
    if(raw){ const d = JSON.parse(raw); if(d && Array.isArray(d.camps)) ADS = d; }
  }catch(e){}
}

/* ---------- дни: аналитика по дням (7 суток, [{i,c}] где i=показы c=клики) ---------- */
function adsDayKey(){ return Math.floor(Date.now()/864e5); }
function adsSeedDays(c){
  /* распределяем накопленные показы/клики по 7 дням правдоподобными весами */
  const w = c.status==='done' ? [.28,.26,.24,.22,0,0,0] : [0,0,.06,.12,.2,.28,.34];
  let li = 0; w.forEach((k,i)=>{ if(k>0) li = i; });
  c.days = w.map(k=>({i:Math.round(c.imps*k), c:Math.round(c.clicks*k)}));
  let ri = c.imps, rc = c.clicks;
  c.days.forEach((d,i)=>{ if(i!==li){ ri-=d.i; rc-=d.c; } });
  c.days[li] = {i:Math.max(0,ri), c:Math.max(0,rc)};
}
function adsRollDays(c){
  const today = adsDayKey();
  let diff = today - (c.dstamp || today);
  if(diff>0){
    if(diff>7) diff = 7;
    for(let i=0;i<diff;i++){ c.days.shift(); c.days.push({i:0,c:0}); }
  }
  c.dstamp = today;
}
function adsMigrate(){
  ADS.camps.forEach(c=>{
    if(!Array.isArray(c.days) || c.days.length!==7) adsSeedDays(c);
    if(c.ab){ c.ab.a = c.ab.a || {i:0,c:0}; c.ab.b = c.ab.b || {i:0,c:0}; }
    adsRollDays(c);
  });
}

/* ---------- метрики / рендер ---------- */
function adsCtr(c){ return c.imps ? (c.clicks / c.imps * 100) : 0; }
function adsCpcTxt(c){
  const cpc = c.clicks ? c.spent/c.clicks : 0;
  return cpc ? (cpc<10 ? cpc.toFixed(2) : fmtN(Math.round(cpc)))+' ₽' : '—';
}

/* сводка: живые анимированные счётчики (count-up с easeOut на входе и на каждом тике) */
const ADS_SUM = [
  {k:'sp',  l:'потрачено', unit:'₽', fmt:v=>fmtN(Math.round(v))},
  {k:'im',  l:'показы',              fmt:v=>fmtN(Math.round(v))},
  {k:'cl',  l:'клики',               fmt:v=>fmtN(Math.round(v))},
  {k:'ctr', l:'ctr',       unit:'%', fmt:v=>v.toFixed(1)}
];
const adsSumState = {};   /* k -> {cur, raf} */
function adsSumTotals(){
  const t = ADS.camps.reduce((a,c)=>({sp:a.sp+c.spent, im:a.im+c.imps, cl:a.cl+c.clicks}), {sp:0,im:0,cl:0});
  t.ctr = t.im ? (t.cl/t.im*100) : 0;
  return t;
}
function adsCountTo(s, target){
  const el = document.querySelector(`#adsSummary .v[data-sk="${s.k}"]`); if(!el) return;
  const st = adsSumState[s.k] || (adsSumState[s.k] = {cur:0, raf:0});
  cancelAnimationFrame(st.raf);
  const unit = s.unit ? ` <small>${s.unit}</small>` : '';
  const paint = v => { el.innerHTML = s.fmt(v)+unit; };
  if(Math.abs(target-st.cur) < 1e-4){ st.cur = target; paint(target); return; }
  const from = st.cur, t0 = performance.now(), dur = 640;
  const step = now=>{
    const k = Math.min(1, (now-t0)/dur), e = 1-Math.pow(1-k,3);
    st.cur = from + (target-from)*e; paint(st.cur);
    if(k<1) st.raf = requestAnimationFrame(step); else { st.cur = target; paint(target); }
  };
  st.raf = requestAnimationFrame(step);
}
function adsSummaryReset(){ Object.values(adsSumState).forEach(s=>{ cancelAnimationFrame(s.raf); s.cur = 0; }); }
function adsRenderSummary(){
  const box = document.getElementById('adsSummary'); if(!box) return;
  if(box.children.length !== ADS_SUM.length){
    box.innerHTML = ADS_SUM.map(s=>
      `<div class="stat"><div class="v" data-sk="${s.k}">0${s.unit?` <small>${s.unit}</small>`:''}</div><div class="l">${s.l}</div></div>`
    ).join('');
  }
  const t = adsSumTotals();
  ADS_SUM.forEach(s=>adsCountTo(s, t[s.k]));
}

function adsCampActs(c){
  if(c.status==='mod')  return `<div class="ads-modwait">${I('clock')}ИИ-агент проверяет объявление…</div>`;
  if(c.status==='act')  return `<div class="ads-camp-acts">
      <button class="btn sm" onclick="adsTopup(${c.id})">${I('plus')}Пополнить</button>
      <button class="btn sm ghost" onclick="adsPause(${c.id})">${I('pause')}Пауза</button>
      <button class="btn sm ghost stop" onclick="adsStop(${c.id})">${I('flag')}Стоп</button></div>`;
  if(c.status==='pause')return `<div class="ads-camp-acts">
      <button class="btn sm" onclick="adsResume(${c.id})">${I('play')}Возобновить</button>
      <button class="btn sm ghost" onclick="adsTopup(${c.id})">${I('plus')}Бюджет</button>
      <button class="btn sm ghost stop" onclick="adsStop(${c.id})">${I('flag')}Стоп</button></div>`;
  return `<div class="ads-camp-acts">
      <button class="btn sm ghost stop" onclick="adsDelete(${c.id})">${I('trash')}Удалить</button></div>`;
}

function adsRenderList(){
  const box = document.getElementById('adsList'); if(!box) return;
  if(!ADS.camps.length){
    box.innerHTML = `<div class="card ads-empty">${I('megaphone')}Кампаний пока нет — создай первую, объявление попадёт в ленту OKO</div>`;
    return;
  }
  box.innerHTML = ADS.camps.map((c,i)=>`
    <div class="card ads-camp" data-cid="${c.id}" style="animation-delay:${i*.05}s">
      <div class="ads-camp-top">
        <div class="ads-camp-name">${esc(c.name)}</div>
        <span class="ads-st ${c.status}">${ADS_STATUS[c.status].l}</span>
      </div>
      <div class="ads-camp-txt">${esc(c.text)}</div>
      <div class="ads-metrics">
        <div class="ads-m"><b data-m="imps">${fmtN(c.imps)}</b><span>показы</span></div>
        <div class="ads-m"><b data-m="clicks">${fmtN(c.clicks)}</b><span>клики</span></div>
        <div class="ads-m hot"><b data-m="ctr">${adsCtr(c).toFixed(1)}%</b><span>ctr</span></div>
        <div class="ads-m"><b data-m="spent">${fmtN(Math.round(c.spent))}<i class="ads-cur">₽</i></b><span>из ${fmtN(c.budget)}<i class="ads-cur">₽</i></span></div>
      </div>
      <div class="ads-budget-bar"><i data-m="bar" style="width:${Math.min(100, c.spent/c.budget*100)}%"></i></div>
      <canvas class="ads-spark" id="adsSpark${c.id}"></canvas>
      <button class="ads-stats-toggle ${adsOpenStats.has(c.id)?'open':''}" onclick="adsToggleStats(${c.id})">
        ${I('poll')}Статистика${c.ab?`<em class="ads-abmark">A/B</em>`:''}<i>${I('chev')}</i></button>
      ${adsOpenStats.has(c.id) ? adsStatsBlock(c) : ''}
      ${c.status==='rej' && c.reason ? `<div class="ads-reason">${I('flag')}<span>Отклонено ИИ-модератором: ${esc(c.reason)}. Бюджет возвращён на лицевой счёт.</span></div>` : ''}
      ${adsCampActs(c)}
    </div>`).join('');
  requestAnimationFrame(()=>ADS.camps.forEach(c=>{
    adsDrawSpark(c);
    if(adsOpenStats.has(c.id)) adsDrawDays(c);
  }));
}

/* ---------- разворот «Статистика»: бар-чарт по дням + CTR-линия + A/B ---------- */
const adsOpenStats = new Set();
function adsToggleStats(id){
  if(adsOpenStats.has(id)) adsOpenStats.delete(id); else adsOpenStats.add(id);
  adsRenderList();
}
function adsSub7(c){
  const d7 = c.days || [];
  const ti = d7.reduce((s,d)=>s+d.i,0), tc = d7.reduce((s,d)=>s+d.c,0);
  return `за 7 дней: <b>${fmtN(ti)}</b> показов · <b>${fmtN(tc)}</b> кликов · CPC <b>${adsCpcTxt(c)}</b>`;
}
function adsStatsBlock(c){
  return `<div class="ads-stats">
    <canvas class="ads-days" id="adsDays${c.id}"></canvas>
    <div class="ads-legend">
      <span><i class="lg-imp"></i>показы</span>
      <span><i class="lg-clk"></i>клики</span>
      <span><i class="lg-ctr"></i>CTR</span>
    </div>
    <div class="ads-stats-sub" data-m="sub7">${adsSub7(c)}</div>
    ${c.ab ? `<div class="ads-ab" data-m="ab">${adsAbInner(c)}</div>` : ''}
  </div>`;
}

/* победитель A/B: минимум 400 показов на вариант и отрыв CTR > 10% */
function adsAbWinner(c){
  if(!c.ab) return null;
  const a = c.ab.a, b = c.ab.b;
  if(a.i < 400 || b.i < 400) return null;
  const ca = a.c/a.i, cb = b.c/b.i;
  if(Math.abs(ca-cb) < Math.min(ca,cb)*.1) return null;
  return ca > cb ? 'a' : 'b';
}
function adsAbInner(c){
  const win = adsAbWinner(c);
  const row = (k, title)=>{
    const v = c.ab[k], o = c.ab[k==='a'?'b':'a'];
    const ctr = v.i ? v.c/v.i*100 : 0, octr = o.i ? o.c/o.i*100 : 0;
    const w = Math.max(ctr, octr) ? ctr/Math.max(ctr, octr)*100 : 0;
    return `<div class="ads-ab-row ${win===k?'win':''}">
      <span class="ads-ab-tag">${k.toUpperCase()}</span>
      <div class="ads-ab-mid">
        <div class="ads-ab-t">${esc(title)}</div>
        <div class="ads-ab-bar"><i style="width:${w}%"></i></div>
      </div>
      <div class="ads-ab-num"><b>${ctr.toFixed(2)}%</b><span>${fmtN(v.i)} пок.</span></div>
      ${win===k ? `<span class="ads-ab-win" title="лидер">${I('crown')}</span>` : ''}
    </div>`;
  };
  return `<div class="ads-ab-h">${I('bolt')}A/B тест заголовка
      ${win ? `<span class="ads-ab-done">победитель найден</span>` : `<span class="ads-ab-run">идёт тест</span>`}</div>
    ${row('a', c.name)}${row('b', c.ab.tb)}`;
}

function adsRRect(x, px, py, pw, ph, r){
  if(ph < .5) return;
  r = Math.min(r, pw/2, ph);
  x.beginPath();
  x.moveTo(px, py+ph); x.lineTo(px, py+r);
  x.arcTo(px, py, px+r, py, r); x.lineTo(px+pw-r, py);
  x.arcTo(px+pw, py, px+pw, py+r, r); x.lineTo(px+pw, py+ph);
  x.closePath(); x.fill();
}
function adsDrawDays(c){
  const cv = document.getElementById('adsDays'+c.id); if(!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 300, h = cv.clientHeight || 132;
  cv.width = w*dpr; cv.height = h*dpr;
  const x = cv.getContext('2d'); x.scale(dpr,dpr); x.clearRect(0,0,w,h);
  const days = (c.days && c.days.length===7) ? c.days : [...Array(7)].map(()=>({i:0,c:0}));
  const light = document.documentElement.getAttribute('data-theme')==='light';
  const txt   = light ? 'rgba(20,24,12,.55)' : 'rgba(255,255,255,.45)';
  const ctrCol= light ? '#1a1d16' : '#ffffff';
  const padT = 8, padB = 16, padS = 6;
  const ih = h-padT-padB, iw = (w-padS*2)/7;
  const maxI = Math.max(...days.map(d=>d.i), 1);
  const maxC = Math.max(...days.map(d=>d.c), 1);
  const names = ['вс','пн','вт','ср','чт','пт','сб'];
  const now = new Date();
  x.strokeStyle = light ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.07)';
  x.lineWidth = 1; x.beginPath(); x.moveTo(2, h-padB+.5); x.lineTo(w-2, h-padB+.5); x.stroke();
  days.forEach((d,i)=>{
    const cx = padS + i*iw + iw/2;
    const bw = Math.max(4, Math.min(11, iw*.22));
    x.fillStyle = 'rgba(154,255,0,.85)';
    adsRRect(x, cx-bw-1.5, h-padB - d.i/maxI*ih, bw, d.i/maxI*ih, 2);
    x.fillStyle = 'rgba(255,176,32,.85)';
    adsRRect(x, cx+1.5, h-padB - d.c/maxC*ih, bw, d.c/maxC*ih, 2);
    const dt = new Date(now.getTime() - (6-i)*864e5);
    x.fillStyle = i===6 ? '#9AFF00' : txt;
    x.font = '600 8.5px Montserrat, sans-serif'; x.textAlign = 'center';
    x.fillText(i===6 ? 'сегодня' : names[dt.getDay()], cx, h-4);
  });
  const ctrs = days.map(d=>d.i ? d.c/d.i*100 : 0);
  const maxCtr = Math.max(...ctrs, .01);
  const pY = v => h-padB-4 - v/maxCtr*(ih-14);
  x.globalAlpha = .8; x.strokeStyle = ctrCol; x.lineWidth = 1.4; x.setLineDash([4,3]);
  x.beginPath();
  ctrs.forEach((v,i)=>{ const cx = padS+i*iw+iw/2; i ? x.lineTo(cx, pY(v)) : x.moveTo(cx, pY(v)); });
  x.stroke(); x.setLineDash([]);
  ctrs.forEach((v,i)=>{ const cx = padS+i*iw+iw/2;
    x.beginPath(); x.arc(cx, pY(v), 2, 0, Math.PI*2); x.fillStyle = ctrCol; x.fill(); });
  x.globalAlpha = 1;
}

/* ---------- пополнение бюджета кампании ---------- */
function adsTopup(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c) return;
  showPopup({ico:'card', title:'Пополнить бюджет',
    body:`«${esc(c.name)}»: потрачено <b>${fmtMoney(c.spent)}</b> из <b>${fmtMoney(c.budget)}</b>.<br>
      Сумма спишется с лицевого счёта (${fmtMoney(WALLET.balance)}).
      <div class="ads-topup">
        <button class="ads-chip" onclick="adsTopupDo(${c.id},500)">+500 ₽</button>
        <button class="ads-chip" onclick="adsTopupDo(${c.id},1000)">+1 000 ₽</button>
      </div>`,
    actions:[{label:'Отмена', ghost:true}]});
}
function adsTopupDo(id, sum){
  const c = ADS.camps.find(x=>x.id===id); if(!c) return;
  closePopup();
  if(!walletCharge(sum, 'Пополнение кампании: '+c.name)) return;
  okoEarn(sum, 'Рекламный кабинет');
  c.budget += sum;
  if(c.status==='done' && c.spent < c.budget){ c.status = 'act'; adsPushToFeed(c); }
  adsSave(); adsRender();
  toast('Бюджет кампании +'+fmtN(sum)+' ₽ — открутка продолжается');
}

function adsDrawSpark(c){
  const cv = document.getElementById('adsSpark'+c.id); if(!cv) return;
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth || 300, h = cv.clientHeight || 44;
  cv.width = w*dpr; cv.height = h*dpr;
  const x = cv.getContext('2d'); x.scale(dpr,dpr); x.clearRect(0,0,w,h);
  const d = (c.hist && c.hist.length>1) ? c.hist : [0,0];
  const max = Math.max(...d, 1), min = Math.min(...d);
  const px = i => 2 + i*(w-4)/(d.length-1);
  const py = v => h-4 - (v-min)/(max-min || 1)*(h-10);
  const grad = x.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'rgba(154,255,0,.28)'); grad.addColorStop(1,'rgba(154,255,0,0)');
  x.beginPath(); x.moveTo(px(0), h);
  d.forEach((v,i)=>x.lineTo(px(i), py(v)));
  x.lineTo(px(d.length-1), h); x.closePath(); x.fillStyle = grad; x.fill();
  x.beginPath();
  d.forEach((v,i)=> i ? x.lineTo(px(i), py(v)) : x.moveTo(px(i), py(v)));
  x.strokeStyle = '#9AFF00'; x.lineWidth = 1.6; x.lineJoin = 'round'; x.lineCap = 'round'; x.stroke();
  const lv = d[d.length-1];
  x.beginPath(); x.arc(px(d.length-1), py(lv), 2.6, 0, Math.PI*2);
  x.fillStyle = '#9AFF00'; x.shadowColor = 'rgba(154,255,0,.8)'; x.shadowBlur = 6; x.fill();
}

function adsRender(){ adsRenderSummary(); adsRenderList(); }

/* обновление цифр на месте (тикер), без пересборки DOM — не сбивает нажатия */
function adsTickUI(){
  adsRenderSummary();
  ADS.camps.forEach(c=>{
    const el = document.querySelector(`.ads-camp[data-cid="${c.id}"]`); if(!el) return;
    const set = (k,v)=>{ const n = el.querySelector(`[data-m="${k}"]`); if(n) n.textContent = v; };
    set('imps', fmtN(c.imps)); set('clicks', fmtN(c.clicks));
    set('ctr', adsCtr(c).toFixed(1)+'%');
    const sp = el.querySelector('[data-m="spent"]'); if(sp) sp.innerHTML = fmtN(Math.round(c.spent))+'<i class="ads-cur">₽</i>';
    const bar = el.querySelector('[data-m="bar"]'); if(bar) bar.style.width = Math.min(100, c.spent/c.budget*100)+'%';
    adsDrawSpark(c);
    if(adsOpenStats.has(c.id)){
      adsDrawDays(c);
      const sub = el.querySelector('[data-m="sub7"]'); if(sub) sub.innerHTML = adsSub7(c);
      const ab = el.querySelector('[data-m="ab"]'); if(ab) ab.innerHTML = adsAbInner(c);
    }
  });
}

/* ---------- создание кампании ---------- */
let adsDraft = {cta:'Подробнее', geo:'РФ'};

function adsOpenCreate(){
  adsDraft = {cta:'Подробнее', geo:'РФ', ab:false, reach:0};
  ['adsInpTitle','adsInpText','adsInpLink','adsInpTitleB'].forEach(id=>{ const e = document.getElementById(id); if(e) e.value=''; });
  const abChip = document.getElementById('adsAbChip'); if(abChip) abChip.classList.remove('on');
  const abInp = document.getElementById('adsInpTitleB'); if(abInp) abInp.style.display = 'none';
  document.querySelectorAll('#adsCtaChips .ads-chip').forEach((b,i)=>b.classList.toggle('on', i===0));
  document.querySelectorAll('#adsGeoChips .ads-chip').forEach((b,i)=>b.classList.toggle('on', i===0));
  document.querySelectorAll('#adsIntChips .ads-chip').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('#adsAgeChips .ads-chip').forEach(b=>b.classList.toggle('on', b.dataset.v==='25-34'));
  const bi = document.getElementById('adsInpBudget'); if(bi) bi.value = '1000';
  adsStep(1); openSheet('ads-create');
}

function adsStep(n){
  if(n>1){
    const title = document.getElementById('adsInpTitle').value.trim();
    const text  = document.getElementById('adsInpText').value.trim();
    if(!title){ toast('Добавь заголовок объявления'); return; }
    if(!text){ toast('Добавь текст объявления'); return; }
    if(adsDraft.ab && !document.getElementById('adsInpTitleB').value.trim()){
      toast('Добавь вариант B заголовка или выключи A/B тест'); return;
    }
  }
  for(let i=1;i<=3;i++) document.getElementById('adsStep'+i).style.display = (i===n?'block':'none');
  document.querySelectorAll('#adsSteps i').forEach((d,i)=>d.classList.toggle('on', i<n));
  if(n===2) adsCalcReach();
  if(n===3) adsCalcForecast();
}

function adsPickCta(btn){
  document.querySelectorAll('#adsCtaChips .ads-chip').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); adsDraft.cta = btn.dataset.v;
}
function adsPickGeo(btn){
  document.querySelectorAll('#adsGeoChips .ads-chip').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); adsDraft.geo = btn.dataset.v; adsCalcReach();
}
function adsToggleMulti(btn){ btn.classList.toggle('on'); adsCalcReach(); }
function adsToggleAb(){
  adsDraft.ab = !adsDraft.ab;
  const chip = document.getElementById('adsAbChip'); if(chip) chip.classList.toggle('on', adsDraft.ab);
  const inp = document.getElementById('adsInpTitleB');
  if(inp){ inp.style.display = adsDraft.ab ? '' : 'none'; if(adsDraft.ab) inp.focus(); }
}
function adsPicked(boxId){
  return [...document.querySelectorAll('#'+boxId+' .ads-chip.on')].map(b=>b.dataset.v);
}

/* живой прогноз охвата */
let adsReachCur = 0, adsReachRaf = 0;
function adsCalcReach(){
  const geoBase = {'РФ':11800000, 'СНГ':26400000, 'Весь мир':92000000}[adsDraft.geo] || 11800000;
  const intShares = {'нейросети':.055,'бизнес':.09,'контент':.08,'маркетинг':.07,'игры':.11,'крипта':.045};
  const ageShares = {'18-24':.21,'25-34':.31,'35-44':.24,'45+':.24};
  const ints = adsPicked('adsIntChips'), ages = adsPicked('adsAgeChips');
  const intK = ints.length ? Math.min(.4, ints.reduce((s,v)=>s+(intShares[v]||0),0)) : .5;
  const ageK = ages.length ? ages.reduce((s,v)=>s+(ageShares[v]||0),0) : 1;
  const target = Math.round(geoBase * intK * ageK);
  adsDraft.reach = target;
  const sub = document.getElementById('adsReachS');
  if(sub) sub.textContent = `${adsDraft.geo} · ${ints.length? ints.length+' интерес(а)' : 'широкая аудитория'} · ${ages.length? ages.join(', ') : 'все возрасты'}`;
  cancelAnimationFrame(adsReachRaf);
  const from = adsReachCur, t0 = performance.now();
  const step = now=>{
    const k = Math.min(1, (now-t0)/450), e = 1-Math.pow(1-k,3);
    adsReachCur = Math.round(from + (target-from)*e);
    const el = document.getElementById('adsReachV');
    if(el) el.textContent = fmtN(adsReachCur);
    if(k<1) adsReachRaf = requestAnimationFrame(step);
  };
  adsReachRaf = requestAnimationFrame(step);
}

function adsSetBudget(v){
  document.getElementById('adsInpBudget').value = v;
  document.querySelectorAll('#adsStep3 .ads-chip').forEach(b=>b.classList.toggle('on', b.textContent.replace(/\s|₽/g,'')==String(v)));
  adsCalcForecast();
}

function adsCalcForecast(){
  const b = Math.max(0, parseInt(document.getElementById('adsInpBudget').value,10) || 0);
  let imps = Math.round(b/ADS_CPM*1000);
  /* охват аудитории ограничивает показы: частота ~2.5 на человека за 7 дней */
  if(adsDraft.reach) imps = Math.min(imps, Math.round(adsDraft.reach*2.5));
  const cLo = Math.max(1, Math.round(imps*.01)), cHi = Math.max(1, Math.round(imps*.04));
  const cpc = imps ? b/((cLo+cHi)/2) : 0;
  const set = (id,v)=>{ const e = document.getElementById(id); if(e) e.innerHTML = v; };
  set('adsFImps',  imps ? `~ ${fmtN(Math.round(imps*.85))} – ${fmtN(Math.round(imps*1.15))}` : '—');
  set('adsFClicks',imps ? `~ ${fmtN(cLo)} – ${fmtN(cHi)}` : '—');
  set('adsFCpc',   imps ? `~ ${cpc<10 ? cpc.toFixed(1) : fmtN(Math.round(cpc))} ₽` : '—');
  set('adsFCharge', b ? fmtMoney(b) : '—');
  const note = document.getElementById('adsBalanceNote');
  if(note) note.innerHTML = `На лицевом счёте: <b>${fmtMoney(WALLET.balance)}</b>${b>WALLET.balance?' — не хватает, пополни кошелёк':''}`;
}

function adsLaunch(){
  const name = document.getElementById('adsInpTitle').value.trim();
  const text = document.getElementById('adsInpText').value.trim();
  let link  = document.getElementById('adsInpLink').value.trim();
  const budget = Math.max(0, parseInt(document.getElementById('adsInpBudget').value,10) || 0);
  if(!name || !text){ adsStep(1); return; }
  if(budget < 100){ toast('Минимальный бюджет — 100 ₽'); return; }
  if(link && !/^https?:\/\//i.test(link)) link = 'https://'+link;
  if(!walletCharge(budget, 'Реклама: '+name)) return;
  okoEarn(budget, 'Рекламный кабинет');
  const camp = {
    id: ADS.seq++, name, text, cta: adsDraft.cta, link: link || '',
    geo: adsDraft.geo, interests: adsPicked('adsIntChips'), ages: adsPicked('adsAgeChips'),
    budget, spent: 0, imps: 0, clicks: 0, status: 'mod', hist: [], created: Date.now(),
    days: [...Array(7)].map(()=>({i:0,c:0})), dstamp: adsDayKey()
  };
  const tb = adsDraft.ab ? document.getElementById('adsInpTitleB').value.trim() : '';
  if(tb) camp.ab = {tb, ka: .012+Math.random()*.025, kb: .012+Math.random()*.025, a:{i:0,c:0}, b:{i:0,c:0}};
  ADS.camps.unshift(camp);
  adsSave(); closeSheet(); adsRender();
  toast('Кампания отправлена на модерацию ИИ-агенту');
  setTimeout(()=>adsModerate(camp.id), 3000);
}

/* ---------- ИИ-модерация ---------- */
function adsModerate(id){
  const c = ADS.camps.find(x=>x.id===id);
  if(!c || c.status!=='mod') return;
  const hay = (c.name+' '+c.text).toLowerCase();
  const bad = ADS_STOPWORDS.find(w=>hay.includes(w));
  if(bad){
    c.status = 'rej'; c.reason = 'запрещённая тематика («'+bad+'»)';
    walletAdd(c.budget, 'Возврат: реклама отклонена — '+c.name);
    showPopup({ico:'flag', title:'Реклама отклонена',
      body:`ИИ-модератор нашёл в объявлении «${esc(c.name)}» запрещённую тематику: <b>«${esc(bad)}»</b>.<br><br>Бюджет ${fmtMoney(c.budget)} уже вернулся на лицевой счёт. Исправь текст и запусти заново.`,
      actions:[{label:'Понятно'}]});
  }else{
    c.status = 'act';
    adsPushToFeed(c);
    toast('Кампания «'+c.name+'» прошла модерацию — объявление в ленте');
  }
  adsSave(); adsRender();
}

/* ---------- пост в ленте ---------- */
function adsPostId(id){ return ADS_POST_BASE + id; }

function adsPushToFeed(c){
  const pid = adsPostId(c.id);
  if(POSTS.rec.some(p=>p.id===pid)) return;
  POSTS.rec.unshift({
    id: pid, ava: (PROFILE.name[0]||'O').toUpperCase(), name: PROFILE.name, sub: 'спонсировано',
    body: `<b>${esc(c.name)}</b><br>${esc(c.text)}<div class="ads-post-cta"><button onclick="event.stopPropagation();adsCtaClick(${c.id})">${esc(c.cta)} ${I('chev')}</button></div>`,
    media: null, likes: 0, views: c.imps, liked: false, saved: false, reposts: 0,
    promoted: true, comments: []
  });
  const feedOn = document.getElementById('screen-feed');
  if(feedOn && feedOn.classList.contains('active') && typeof renderFeed==='function') renderFeed(curFeedKind);
}

function adsPullFromFeed(c){
  const pid = adsPostId(c.id);
  const before = POSTS.rec.length;
  POSTS.rec = POSTS.rec.filter(p=>p.id!==pid);
  const feedOn = document.getElementById('screen-feed');
  if(POSTS.rec.length!==before && feedOn && feedOn.classList.contains('active')) renderFeed(curFeedKind);
}

function adsCtaClick(id){
  const c = ADS.camps.find(x=>x.id===id);
  if(!c || c.status!=='act'){ toast('Объявление не активно'); return; }
  c.clicks++;
  adsRollDays(c); c.days[6].c++;
  if(c.ab){
    const tot = c.ab.a.i + c.ab.b.i;
    (tot && Math.random() < c.ab.a.i/tot ? c.ab.a : c.ab.b).c++;
  }
  adsSave();
  toast('Клик засчитан'+(c.link?' — переход: '+c.link.replace(/^https?:\/\//,'').slice(0,34):''));
  if(document.getElementById('screen-ads').classList.contains('active')) adsTickUI();
}

/* ---------- управление кампаниями ---------- */
function adsPause(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c || c.status!=='act') return;
  c.status = 'pause'; adsPullFromFeed(c);
  adsSave(); adsRender(); toast('Кампания на паузе — показы остановлены');
}
function adsResume(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c || c.status!=='pause') return;
  if(c.spent >= c.budget){ c.status = 'done'; adsSave(); adsRender(); toast('Бюджет уже исчерпан'); return; }
  c.status = 'act'; adsPushToFeed(c);
  adsSave(); adsRender(); toast('Кампания снова активна');
}
function adsStop(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c) return;
  showPopup({ico:'flag', title:'Остановить кампанию?',
    body:`«${esc(c.name)}» будет завершена, объявление уйдёт из ленты. Потрачено ${fmtMoney(c.spent)} из ${fmtMoney(c.budget)}.`,
    actions:[
      {label:'Остановить', onclick:()=>{
        c.status = 'done'; adsPullFromFeed(c);
        adsSave(); adsRender(); toast('Кампания завершена');
      }},
      {label:'Отмена', ghost:true}
    ]});
}
function adsDelete(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c) return;
  adsPullFromFeed(c);
  ADS.camps = ADS.camps.filter(x=>x.id!==id);
  adsSave(); adsRender(); toast('Кампания удалена');
}

/* ---------- живая статистика: тикер раз в 5 секунд ---------- */
function adsTick(){
  let changed = false;
  ADS.camps.forEach(c=>{
    if(c.status!=='act') return;
    changed = true;
    const dImps = 70 + Math.floor(Math.random()*180);            /* показы за тик */
    let dClicks;
    if(c.ab){
      /* A/B: показы делятся ~50/50, клики — по скрытому CTR варианта */
      const ia = Math.round(dImps*(.45+Math.random()*.1)), ib = dImps-ia;
      const ca = Math.round(ia*c.ab.ka*(.7+Math.random()*.6));
      const cb = Math.round(ib*c.ab.kb*(.7+Math.random()*.6));
      c.ab.a.i += ia; c.ab.a.c += ca; c.ab.b.i += ib; c.ab.b.c += cb;
      dClicks = ca + cb;
    }else{
      dClicks = Math.round(dImps*(0.01 + Math.random()*0.03));   /* CTR 1–4% */
    }
    const dSpend = dImps/1000*ADS_CPM;
    c.imps += dImps; c.clicks += dClicks;
    c.spent = Math.min(c.budget, c.spent + dSpend);
    c.hist.push(dImps); if(c.hist.length>24) c.hist.shift();
    adsRollDays(c); c.days[6].i += dImps; c.days[6].c += dClicks;
    const post = POSTS.rec.find(p=>p.id===adsPostId(c.id));
    if(post) post.views = c.imps;
    if(c.spent >= c.budget){
      c.status = 'done'; adsPullFromFeed(c);
      toast('Кампания «'+c.name+'» завершена — бюджет исчерпан');
      if(document.getElementById('screen-ads').classList.contains('active')) adsRender();
    }
  });
  if(!changed) return;
  adsSave();
  if(document.getElementById('screen-ads').classList.contains('active')) adsTickUI();
}

/* ---------- патчи ядра (с сохранением прежнего поведения) ---------- */
const _prevShowTabAds = showTab;
showTab = function(t){
  _prevShowTabAds(t);
  if(t==='ads'){ adsSummaryReset(); adsRender(); }
};

/* ---------- самоинициализация ---------- */
adsLoad();
adsMigrate();
regTitle('ads', 'Реклама');
addSvcTile({id:'ads', label:'Реклама', ico:'megaphone', onclick:()=>showTab('ads')});
if(typeof regT==='function') regT({ads:{ru:'Реклама', en:'Ads'}});
/* активные кампании возвращаются в ленту после перезагрузки */
ADS.camps.forEach(c=>{
  if(c.status==='act') adsPushToFeed(c);
  if(c.status==='mod') setTimeout(()=>adsModerate(c.id), 3000); /* зависшая модерация — допроверить */
});
adsRender();
setInterval(adsTick, 5000);
window.addEventListener('resize', ()=>{
  if(document.getElementById('screen-ads').classList.contains('active'))
    ADS.camps.forEach(c=>{ adsDrawSpark(c); if(adsOpenStats.has(c.id)) adsDrawDays(c); });
});
/* смена темы → перерисовать чарты (цвета текста/CTR-линии адаптивные) */
new MutationObserver(()=>{
  if(document.getElementById('screen-ads').classList.contains('active'))
    ADS.camps.forEach(c=>{ if(adsOpenStats.has(c.id)) adsDrawDays(c); });
}).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
