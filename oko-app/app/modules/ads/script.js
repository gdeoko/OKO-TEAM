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

/* ---------- метрики / рендер ---------- */
function adsCtr(c){ return c.imps ? (c.clicks / c.imps * 100) : 0; }

function adsRenderSummary(){
  const box = document.getElementById('adsSummary'); if(!box) return;
  const t = ADS.camps.reduce((a,c)=>({sp:a.sp+c.spent, im:a.im+c.imps, cl:a.cl+c.clicks}), {sp:0,im:0,cl:0});
  const ctr = t.im ? (t.cl/t.im*100) : 0;
  box.innerHTML = `
    <div class="stat"><div class="v">${fmtN(Math.round(t.sp))} <small>₽</small></div><div class="l">потрачено</div></div>
    <div class="stat"><div class="v">${fmtN(t.im)}</div><div class="l">показы</div></div>
    <div class="stat"><div class="v">${fmtN(t.cl)}</div><div class="l">клики</div></div>
    <div class="stat"><div class="v">${ctr.toFixed(1)}<small>%</small></div><div class="l">ctr</div></div>`;
}

function adsCampActs(c){
  if(c.status==='mod')  return `<div class="ads-modwait">${I('clock')}ИИ-агент проверяет объявление…</div>`;
  if(c.status==='act')  return `<div class="ads-camp-acts">
      <button class="btn sm ghost" onclick="adsPause(${c.id})">${I('pause')}Пауза</button>
      <button class="btn sm ghost stop" onclick="adsStop(${c.id})">${I('flag')}Остановить</button></div>`;
  if(c.status==='pause')return `<div class="ads-camp-acts">
      <button class="btn sm" onclick="adsResume(${c.id})">${I('play')}Возобновить</button>
      <button class="btn sm ghost stop" onclick="adsStop(${c.id})">${I('flag')}Остановить</button></div>`;
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
        <div class="ads-m"><b data-m="spent">${fmtN(Math.round(c.spent))}₽</b><span>из ${fmtN(c.budget)}₽</span></div>
      </div>
      <div class="ads-budget-bar"><i data-m="bar" style="width:${Math.min(100, c.spent/c.budget*100)}%"></i></div>
      <canvas class="ads-spark" id="adsSpark${c.id}"></canvas>
      ${c.status==='rej' && c.reason ? `<div class="ads-reason">${I('flag')}<span>Отклонено ИИ-модератором: ${esc(c.reason)}. Бюджет возвращён на лицевой счёт.</span></div>` : ''}
      ${adsCampActs(c)}
    </div>`).join('');
  requestAnimationFrame(()=>ADS.camps.forEach(c=>adsDrawSpark(c)));
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
    set('ctr', adsCtr(c).toFixed(1)+'%'); set('spent', fmtN(Math.round(c.spent))+'₽');
    const bar = el.querySelector('[data-m="bar"]'); if(bar) bar.style.width = Math.min(100, c.spent/c.budget*100)+'%';
    adsDrawSpark(c);
  });
}

/* ---------- создание кампании ---------- */
let adsDraft = {cta:'Подробнее', geo:'РФ'};

function adsOpenCreate(){
  adsDraft = {cta:'Подробнее', geo:'РФ'};
  ['adsInpTitle','adsInpText','adsInpLink'].forEach(id=>{ const e = document.getElementById(id); if(e) e.value=''; });
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
  const imps = Math.round(b/ADS_CPM*1000);
  const set = (id,v)=>{ const e = document.getElementById(id); if(e) e.innerHTML = v; };
  set('adsFImps',  imps ? `~ ${fmtN(Math.round(imps*.85))} – ${fmtN(Math.round(imps*1.15))}` : '—');
  set('adsFClicks',imps ? `~ ${fmtN(Math.max(1,Math.round(imps*.01)))} – ${fmtN(Math.round(imps*.04))}` : '—');
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
    budget, spent: 0, imps: 0, clicks: 0, status: 'mod', hist: [], created: Date.now()
  };
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
    const ctr = 0.01 + Math.random()*0.03;                        /* CTR 1–4% */
    const dClicks = Math.round(dImps*ctr);
    const dSpend = dImps/1000*ADS_CPM;
    c.imps += dImps; c.clicks += dClicks;
    c.spent = Math.min(c.budget, c.spent + dSpend);
    c.hist.push(dImps); if(c.hist.length>24) c.hist.shift();
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
  if(t==='ads') adsRender();
};

/* ---------- самоинициализация ---------- */
adsLoad();
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
    ADS.camps.forEach(c=>adsDrawSpark(c));
});
