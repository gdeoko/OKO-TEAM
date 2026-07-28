/* ===== ADS: рекламный кабинет (префикс ads-) ===== */

const ADS_LS = 'oko-ads';
const ADS_POST_BASE = 9000;       /* id постов рекламы в ленте */
const ADS_STATUS = {
  mod:  {l:'Модерация'},
  sched:{l:'Запланирована'},
  act:  {l:'Активна'},
  pause:{l:'Пауза'},
  rej:  {l:'Отклонена'},
  done: {l:'Завершена'}
};

/* скидка на продвижение по тарифу подписки: выше тариф — дешевле реклама (до −30% на MAX).
   Скидка = больше показов/кликов за тот же бюджет (ниже стоимость результата), сам бюджет не режется. */
function adsDisc(){
  if(typeof okoHasSub!=='function') return 0;
  if(okoHasSub('MAX'))      return 0.30;
  if(okoHasSub('BUSINESS')) return 0.20;
  if(okoHasSub('PRO'))      return 0.10;
  return 0;
}
function adsTierLabel(){
  if(typeof okoHasSub!=='function') return 'FREE';
  if(okoHasSub('MAX'))      return 'MAX';
  if(okoHasSub('BUSINESS')) return 'BUSINESS';
  if(okoHasSub('PRO'))      return 'PRO';
  if(okoHasSub('START'))    return 'START';
  return 'FREE';
}

/* форматы рекламы: модель по умолчанию, базовые CPM/CPC, метка в ленте */
const ADS_FORMATS = {
  post:    {l:'Продвижение поста',       ico:'megaphone', model:'CPM', cpm:28, cpc:9,  tag:'спонсировано',       aov:490,  desc:'Ваш пост в ленте рекомендаций OKO — со ссылкой и кнопкой действия'},
  channel: {l:'Реклама платного канала', ico:'crown',     model:'CPC', cpm:34, cpc:12, tag:'реклама канала',     aov:590,  desc:'Карточка платного канала с кнопкой «Подписаться» в ленте и поиске'},
  listing: {l:'Объявление Биржи',        ico:'briefcase', model:'CPC', cpm:30, cpc:11, tag:'Биржа · реклама',    aov:1490, desc:'Товар или услуга с Биржи OKO — показ горячей аудитории в ленте и поиске'},
  banner:  {l:'Баннер',                  ico:'photo',     model:'CPM', cpm:22, cpc:7,  tag:'баннер',             aov:690,  desc:'Широкий баннер в шапке ленты и тематических разделов — максимальный охват'},
};
const ADS_MODELS = {
  CPM: {unit:'₽ / 1000 показов', min:12, rec:1, max:3.2},   /* rec/max — множители к базовому cpm формата */
  CPC: {unit:'₽ / клик',         min:3,  rec:1, max:2.8}
};

/* города РФ / СНГ с примерным активным охватом (млн пользователей) */
const ADS_CITIES = {
  'РФ':  [['Москва',3.4],['Санкт-Петербург',1.6],['Новосибирск',.55],['Екатеринбург',.5],['Казань',.46],
          ['Нижний Новгород',.42],['Краснодар',.4],['Самара',.38],['Ростов-на-Дону',.37],['Челябинск',.35],['Уфа',.33],['Красноярск',.3]],
  'СНГ': [['Минск',.72],['Ташкент',.8],['Алматы',.6],['Баку',.5],['Астана',.35],['Ереван',.32],['Тбилиси',.28],['Бишкек',.25],['Кишинёв',.2]]
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
  seq: 3, audSeq: 3, bill: [],
  auds: [
    {id:1, name:'Авторы РФ 25–44', sex:'any', geo:'РФ', cities:[], interests:['контент','маркетинг'], ages:['25-34','35-44'], devs:[], times:[]},
    {id:2, name:'Крипта СНГ', sex:'m', geo:'СНГ', cities:[], interests:['крипта','финансы'], ages:['18-24','25-34'], devs:['ios','android'], times:[]},
  ],
  camps: [
    {id:1, name:'OKO Академия — поток №4', text:'Контент-завод за 7 дней: 30 роликов в месяц на автомате. Старт 20 июля, осталось 14 мест из 50.',
     cta:'Подписаться', link:'https://okoteam.top/academy', fmt:'post', model:'CPM', bid:32,
     geo:'РФ', sex:'any', cities:['Москва','Санкт-Петербург'], interests:['контент','маркетинг'], ages:['18-24','25-34'], devs:['ios','android'], times:[],
     budget:3000, spent:1268.4, imps:45320, clicks:1121, status:'act', demo:true,
     ab:{tb:'30 роликов в месяц без монтажёра и съёмок', ka:.019, kb:.031, a:{i:22660,c:427}, b:{i:22660,c:694}},
     hist:[120,180,150,240,210,320,280,360,300,410,380,460,420,510,470,560,530,610], created: Date.now()-2*864e5},
    {id:2, name:'Партнёрка OKO — 15% с оборота', text:'Приводи авторов и получай 15% с их подписки + 5% со второй линии. Выплаты сразу на лицевой счёт.',
     cta:'Подробнее', link:'https://okoteam.top/partners', fmt:'channel', model:'CPC', bid:14,
     geo:'СНГ', sex:'any', cities:[], interests:['бизнес','маркетинг'], ages:['25-34','35-44'], devs:[], times:[],
     budget:1500, spent:1500, imps:53570, clicks:1547, status:'done', demo:true,
     hist:[520,610,580,660,700,640,720,690,750,710,680,730,700,660,610,540,420,260], created: Date.now()-9*864e5},
  ]
};

/* медиа сериализуем аккуратно: картинки — сжатые data-URL (влезают в localStorage),
   видео / слишком большие картинки — только дескриптор {type,name} (blob-URL после
   перезагрузки невалиден), чтобы не переполнить квоту и не хранить мусор. */
function adsMediaStore(m){
  if(!m) return null;
  if(m.type==='image' && typeof m.src==='string' && m.src.length < 380000)
    return {type:'image', src:m.src, name:m.name||'', w:m.w||0, h:m.h||0};
  return {type:m.type||'image', name:m.name||''};
}
function adsSave(){
  try{
    const out = {
      seq: ADS.seq, audSeq: ADS.audSeq,
      bill: ADS.bill, auds: ADS.auds,
      camps: ADS.camps.map(c=>Object.assign({}, c, {media: adsMediaStore(c.media)}))
    };
    localStorage.setItem(ADS_LS, JSON.stringify(out));
  }catch(e){}
}
function adsLoad(){
  try{
    const raw = localStorage.getItem(ADS_LS);
    if(raw){ const d = JSON.parse(raw); if(d && Array.isArray(d.camps)) ADS = Object.assign(ADS, d); }
  }catch(e){}
}

/* эффективный CPM кампании (для CPC берём из связки ставка/CTR) */
function adsCampCpm(c){
  if(c.model==='CPC'){ const ctr = c.ctrEst || .022; return (c.bid||9)*ctr*1000; }
  return c.bid || (ADS_FORMATS[c.fmt]?.cpm) || 28;
}

/* ---------- дни: аналитика по дням (7 суток, [{i,c}] где i=показы c=клики) ---------- */
function adsDayKey(){ return Math.floor(Date.now()/864e5); }
function adsSeedDays(c){
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
  if(!Array.isArray(ADS.bill)) ADS.bill = [];
  if(!Array.isArray(ADS.auds)) ADS.auds = [];
  ADS.camps.forEach(c=>{
    if(!c.fmt) c.fmt = 'post';
    if(!c.model) c.model = ADS_FORMATS[c.fmt]?.model || 'CPM';
    if(!c.bid) c.bid = ADS_FORMATS[c.fmt]?.[c.model==='CPC'?'cpc':'cpm'] || 28;
    if(!c.sex) c.sex = 'any';
    if(!Array.isArray(c.cities)) c.cities = [];
    if(!Array.isArray(c.devs)) c.devs = [];
    if(!Array.isArray(c.times)) c.times = [];
    if(!Array.isArray(c.days) || c.days.length!==7) adsSeedDays(c);
    if(c.disc==null) c.disc = 0;                 /* скидка тарифа, зафиксированная при запуске */
    if(c.pace==null) c.pace = 0;                 /* дней равномерной открутки (0 = максимум) */
    if(c.dailyCap==null) c.dailyCap = 0;         /* дневной лимит бюджета, ₽ (0 = без лимита) */
    if(c.spentToday==null) c.spentToday = 0;     /* потрачено сегодня (для дневного лимита) */
    if(c.spentDay==null) c.spentDay = adsDayKey();
    if(!c.cvr) c.cvr = +(0.16 + Math.random()*0.18).toFixed(3);   /* доля кликов → целевое действие */
    if(c.aov==null) c.aov = (ADS_FORMATS[c.fmt] && ADS_FORMATS[c.fmt].aov) || 690;   /* средний чек продажи, ₽ */
    if(c.salesRate==null) c.salesRate = +(0.006 + Math.random()*0.007).toFixed(4);   /* доля кликов → оплаченная продажа */
    if(c.ab){ c.ab.a = c.ab.a || {i:0,c:0}; c.ab.b = c.ab.b || {i:0,c:0}; }
    if(c.demo && !c.media) c.media = adsBrandPoster(c);
    adsRollDays(c);
  });
}

/* ---------- метрики / рендер ---------- */
function adsCtr(c){ return c.imps ? (c.clicks / c.imps * 100) : 0; }
/* класс-подсказка заполнения бюджета: >=90% — критично, >=75% — на исходе */
function adsBudgetCls(c){ const r = c.budget ? c.spent/c.budget : 0; return r>=0.9 ? 'crit' : r>=0.75 ? 'warn' : ''; }
/* короткая подсветка числа при живом обновлении (ощущение «метрики дышат») */
function adsFlashEl(el){ if(!el) return; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
function adsCpcTxt(c){
  const cpc = c.clicks ? c.spent/c.clicks : 0;
  return cpc ? (cpc<10 ? cpc.toFixed(2) : fmtN(Math.round(cpc)))+' ₽' : '—';
}

/* сводка: живые анимированные счётчики */
const ADS_SUM = [
  {k:'sp',  l:'потрачено', unit:'₽', fmt:v=>fmtN(Math.round(v))},
  {k:'im',  l:'показы',              fmt:v=>fmtN(Math.round(v))},
  {k:'cl',  l:'клики',               fmt:v=>fmtN(Math.round(v))},
  {k:'ctr', l:'ctr',       unit:'%', fmt:v=>v.toFixed(1)}
];
const adsSumState = {};
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
  const qs = document.getElementById('adsQuickSpent'); if(qs) qs.textContent = fmtN(Math.round(t.sp))+' ₽';
  const qa = document.getElementById('adsQuickAud'); if(qa) qa.textContent = ADS.auds.length;
}

/* вторичный ряд: Изменить + Дублировать (двухколоночная сетка, не переполняет 390px) */
function adsEditDup(c){
  return `<div class="ads-camp-acts2 two">
      <button class="btn sm ghost dup" onclick="adsEdit(${c.id})">${I('edit')}Изменить</button>
      <button class="btn sm ghost dup" onclick="adsDuplicate(${c.id})">${I('copy')}Дублировать</button></div>`;
}
function adsCampActs(c){
  if(c.status==='mod')  return `<div class="ads-modwait">${I('clock')}Модератор OKO проверяет объявление…</div>`;
  if(c.status==='sched')return `<div class="ads-camp-acts">
      <button class="btn sm" onclick="adsStartNow(${c.id})">${I('rocket')}Запустить сейчас</button>
      <button class="btn sm ghost stop" onclick="adsCancelSched(${c.id})">${I('flag')}Отменить</button></div>`+adsEditDup(c);
  if(c.status==='act')  return `<div class="ads-camp-acts">
      <button class="btn sm" onclick="adsTopup(${c.id})">${I('plus')}Пополнить</button>
      <button class="btn sm ghost" onclick="adsPause(${c.id})">${I('pause')}Пауза</button>
      <button class="btn sm ghost stop" onclick="adsStop(${c.id})">${I('flag')}Стоп</button></div>`+adsEditDup(c);
  if(c.status==='pause')return `<div class="ads-camp-acts">
      <button class="btn sm" onclick="adsResume(${c.id})">${I('play')}Возобновить</button>
      <button class="btn sm ghost" onclick="adsTopup(${c.id})">${I('plus')}Бюджет</button>
      <button class="btn sm ghost stop" onclick="adsStop(${c.id})">${I('flag')}Стоп</button></div>`+adsEditDup(c);
  return `<div class="ads-camp-acts">
      <button class="btn sm ghost" onclick="adsEdit(${c.id})">${I('edit')}Изменить</button>
      <button class="btn sm ghost" onclick="adsDuplicate(${c.id})">${I('copy')}Дублировать</button>
      <button class="btn sm ghost stop" onclick="adsDelete(${c.id})">${I('trash')}Удалить</button></div>`;
}

function adsFmtBadge(c){
  const f = ADS_FORMATS[c.fmt] || ADS_FORMATS.post;
  let out = `<span class="ads-fmt-badge">${I(f.ico)}${esc(f.l)}</span><span class="ads-model-badge">${c.model} · ${fmtN(c.bid)} ₽</span>`;
  if(c.disc>0) out += `<span class="ads-disc-badge">${I('fire')}−${Math.round(c.disc*100)}%</span>`;
  if(c.dailyCap>0) out += `<span class="ads-model-badge">${I('clock')}${fmtN(c.dailyCap)} ₽/день</span>`;
  return out;
}
/* дата/время старта запланированной кампании + сколько осталось */
function adsSchedLine(c){
  const at = c.startTs || Date.now();
  const d = new Date(at);
  const dt = d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  const left = at - Date.now();
  let rel = 'скоро';
  if(left > 0){
    const h = Math.floor(left/36e5), m = Math.round(left%36e5/6e4);
    rel = h>=24 ? 'через '+Math.round(h/24)+' дн.' : h>=1 ? 'через '+h+' ч '+m+' мин' : 'через '+Math.max(1,m)+' мин';
  }
  return `<div class="ads-sched-line">${I('clock')}<span>Старт <b>${dt}</b> · ${rel}</span></div>`;
}

function adsRenderList(){
  const box = document.getElementById('adsList'); if(!box) return;
  if(!ADS.camps.length){
    box.innerHTML = `<div class="card ads-empty">${I('megaphone')}Ни одной кампании. Запусти первую — и уже сегодня объявление увидят тысячи людей в ленте OKO</div>`;
    return;
  }
  box.innerHTML = ADS.camps.map((c,i)=>`
    <div class="card ads-camp" data-cid="${c.id}" style="animation-delay:${i*.05}s">
      <div class="ads-camp-top">
        <div class="ads-camp-name">${esc(c.name)}</div>
        <span class="ads-st ${c.status}">${ADS_STATUS[c.status].l}</span>
      </div>
      <div class="ads-camp-tags">${adsFmtBadge(c)}</div>
      ${c.status==='sched' ? adsSchedLine(c) : ''}
      <div class="ads-camp-txt">${esc(c.text)}</div>
      <div class="ads-metrics">
        <div class="ads-m"><b data-m="imps">${fmtN(c.imps)}</b><span>показы</span></div>
        <div class="ads-m"><b data-m="clicks">${fmtN(c.clicks)}</b><span>клики</span></div>
        <div class="ads-m hot"><b data-m="ctr">${adsCtr(c).toFixed(1)}%</b><span>ctr</span></div>
        <div class="ads-m"><b data-m="spent">${fmtN(Math.round(c.spent))}<i class="ads-cur">₽</i></b><span>из ${fmtN(c.budget)}<i class="ads-cur">₽</i></span></div>
      </div>
      <div class="ads-budget-bar"><i data-m="bar" class="${adsBudgetCls(c)}" style="width:${Math.min(100, c.spent/c.budget*100)}%"></i></div>
      <canvas class="ads-spark" id="adsSpark${c.id}"></canvas>
      <button class="ads-stats-toggle ${adsOpenStats.has(c.id)?'open':''}" onclick="adsToggleStats(${c.id})">
        ${I('poll')}Статистика${c.ab?`<em class="ads-abmark">A/B</em>`:''}<i>${I('chev')}</i></button>
      ${adsOpenStats.has(c.id) ? adsStatsBlock(c) : ''}
      ${c.status==='rej' && c.reason ? `<div class="ads-reason">${I('flag')}<span>Отклонено модератором OKO: ${esc(c.reason)}. Бюджет возвращён на лицевой счёт.</span></div>` : ''}
      ${adsCampActs(c)}
    </div>`).join('');
  requestAnimationFrame(()=>ADS.camps.forEach(c=>{
    adsDrawSpark(c);
    if(adsOpenStats.has(c.id)){ adsDrawDays(c); adsSyncFunnel(c, true); }
  }));
}

/* ---------- разворот «Статистика» ---------- */
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
function adsAudLine(c){
  const parts = [];
  parts.push(c.sex==='m'?'муж':c.sex==='f'?'жен':'любой пол');
  parts.push(c.geo);
  if(c.cities && c.cities.length) parts.push(c.cities.slice(0,2).join(', ')+(c.cities.length>2?' +'+(c.cities.length-2):''));
  if(c.ages && c.ages.length) parts.push(c.ages.join('/'));
  if(c.devs && c.devs.length) parts.push(c.devs.map(d=>({ios:'iOS',android:'Android',desktop:'ПК'}[d]||d)).join('/'));
  return parts.join(' · ');
}
function adsStatsBlock(c){
  return `<div class="ads-stats">
    ${adsAdviceBlock(c)}
    <div class="ads-aud-line">${I('users')}${esc(adsAudLine(c))}</div>
    <canvas class="ads-days" id="adsDays${c.id}"></canvas>
    <div class="ads-legend">
      <span><i class="lg-imp"></i>показы</span>
      <span><i class="lg-clk"></i>клики</span>
      <span><i class="lg-ctr"></i>CTR</span>
    </div>
    <div class="ads-stats-sub" data-m="sub7">${adsSub7(c)}</div>
    ${adsFunnel(c)}
    ${adsRoasStrip(c)}
    ${c.ab ? `<div class="ads-ab" data-m="ab">${adsAbInner(c)}</div>` : ''}
  </div>`;
}

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

/* ---------- воронка конверсии: Показы → Клики → Целевые действия ---------- */
function adsConv(c){ return Math.round((c.clicks||0) * (c.cvr || 0.22)); }
const ADS_FN_STAGES = [
  {k:'imps', ic:'eye',  l:'Показы',           col:'#9AFF00'},
  {k:'clk',  ic:'bolt', l:'Клики',            col:'#ffb020'},
  {k:'cv',   ic:'check',l:'Целевые действия', col:'#4da6ff'}
];
function adsFunnel(c){
  let html = `<div class="ads-fn"><div class="ads-fn-h">${I('poll')}Воронка конверсии</div>`;
  ADS_FN_STAGES.forEach((s,i)=>{
    if(i) html += `<div class="ads-fn-drop"><span class="ads-fn-arw">${I('chev')}</span>`+
      `<b data-dr="${i===1?'ctr':'cr'}">0%</b><span>${i===1?'CTR':'в действие'}</span></div>`;
    html += `<div class="ads-fn-row">
      <span class="ads-fn-ic" style="color:${s.col};background:${s.col}1f;border-color:${s.col}55">${I(s.ic)}</span>
      <div class="ads-fn-mid">
        <div class="ads-fn-top"><span class="ads-fn-l">${s.l}</span><b class="ads-fn-v" data-fn="${s.k}">0</b></div>
        <div class="ads-fn-bar"><i data-fn2="${s.k}" style="width:0;background:linear-gradient(90deg,${s.col}3a,${s.col})"></i></div>
      </div></div>`;
  });
  return html + '</div>';
}
/* автономный count-up для одного элемента */
function adsCountEl(el, target){
  const t0 = performance.now(), dur = 700;
  const step = now=>{
    const k = Math.min(1, (now-t0)/dur), e = 1-Math.pow(1-k,3);
    el.textContent = fmtN(Math.round(target*e));
    if(k<1) requestAnimationFrame(step); else el.textContent = fmtN(target);
  };
  requestAnimationFrame(step);
}
function adsSyncFunnel(c, animate){
  const wrap = document.querySelector(`.ads-camp[data-cid="${c.id}"] .ads-fn`); if(!wrap) return;
  const imps = c.imps||0, clk = c.clicks||0, cv = adsConv(c), base = Math.max(imps,1);
  const vals = {imps, clk, cv};
  wrap.querySelectorAll('.ads-fn-v').forEach(el=>{
    const to = vals[el.dataset.fn] || 0;
    if(animate) adsCountEl(el, to); else el.textContent = fmtN(to);
  });
  wrap.querySelectorAll('.ads-fn-bar i').forEach(el=>{
    const frac = Math.max(0, Math.min(1, (vals[el.dataset.fn2]||0)/base));
    el.style.width = Math.max(6, Math.pow(frac, 0.34)*100) + '%';
  });
  wrap.querySelectorAll('.ads-fn-drop b').forEach(el=>{
    if(el.dataset.dr==='ctr') el.textContent = (imps ? clk/imps*100 : 0).toFixed(1)+'%';
    else el.textContent = (clk ? cv/clk*100 : 0).toFixed(0)+'%';
  });
}

/* ---------- продажи / окупаемость (ROAS): деньги, которые приносит реклама ---------- */
function adsAov(c){ return c.aov || (ADS_FORMATS[c.fmt] && ADS_FORMATS[c.fmt].aov) || 690; }
function adsSalesRate(c){ return c.salesRate || 0.009; }
function adsSales(c){ return Math.round((c.clicks||0) * adsSalesRate(c)); }
function adsRevenue(c){ return adsSales(c) * adsAov(c); }
function adsRoas(c){ return c.spent>0 ? adsRevenue(c)/c.spent : 0; }
function adsRoasTxt(r){ return r ? '×'+(r>=10 ? Math.round(r) : r.toFixed(1)) : '×0'; }
function adsRoasCls(c){ const r = adsRoas(c); return r>=2 ? 'good' : (r>0 && r<1 && adsSales(c)>0 ? 'low' : ''); }
function adsRoasStrip(c){
  const sales = adsSales(c), rev = adsRevenue(c), roas = adsRoas(c);
  const w = Math.max(4, Math.min(100, roas/4*100));   /* шкала 0..×4+, отметка безубыточности на ×1 */
  return `<div class="ads-roas ${adsRoasCls(c)}">
    <div class="ads-roas-h">${I('money')}Продажи и окупаемость<span class="ads-roas-aov">средний чек ${fmtN(adsAov(c))} ₽</span></div>
    <div class="ads-roas-grid">
      <div class="ads-roas-c"><b data-r="sales">${fmtN(sales)}</b><span>продажи</span></div>
      <div class="ads-roas-c"><b data-r="rev">${fmtN(rev)}<i class="ads-cur">₽</i></b><span>выручка</span></div>
      <div class="ads-roas-c roas"><b data-r="roas">${adsRoasTxt(roas)}</b><span>окупаемость</span></div>
    </div>
    <div class="ads-roas-bar"><i data-r="bar" style="width:${w}%"></i><em class="ads-roas-be"></em></div>
    <div class="ads-roas-scale"><span>0</span><span>×1 окуп.</span><span>×4+</span></div>
  </div>`;
}
function adsSyncRoas(c){
  const rw = document.querySelector(`.ads-camp[data-cid="${c.id}"] .ads-roas`); if(!rw) return;
  const sales = adsSales(c), rev = adsRevenue(c), roas = adsRoas(c);
  const set = (k,v)=>{ const n = rw.querySelector(`[data-r="${k}"]`); if(n) n.innerHTML = v; };
  set('sales', fmtN(sales)); set('rev', fmtN(rev)+'<i class="ads-cur">₽</i>'); set('roas', adsRoasTxt(roas));
  const bar = rw.querySelector('[data-r="bar"]'); if(bar) bar.style.width = Math.max(4, Math.min(100, roas/4*100))+'%';
  rw.className = 'ads-roas '+adsRoasCls(c);
}

/* ---------- ИИ-оптимизатор: разбирает метрики кампании и даёт действия в один тап ---------- */
function adsAdvice(c){
  if(c.status==='mod' || c.status==='sched' || c.status==='rej') return [];
  const out = [], ctr = adsCtr(c), roas = adsRoas(c), bpct = c.budget ? c.spent/c.budget*100 : 0;
  const win = adsAbWinner(c), noMedia = !c.media || !c.media.src;
  if(win) out.push({tone:'good', ic:'crown', p:2,
    text:`Победил вариант <b>${win.toUpperCase()}</b> A/B-теста. Оставьте только его — весь показ на лидере.`,
    label:'Оставить '+win.toUpperCase(), act:`adsApplyAbWinner(${c.id})`});
  if(roas>=2 && c.status==='act') out.push({tone:'good', ic:'fire', p:1,
    text:`Окупаемость <b>${adsRoasTxt(roas)}</b> — реклама в плюсе. Масштабируйте бюджет, пока держится.`,
    label:'Масштабировать', act:`adsTopup(${c.id})`});
  if(noMedia) out.push({tone:'warn', ic:'photo', p:1,
    text:'Без креатива CTR ниже в 2–3 раза. Добавьте фото или видео к объявлению.',
    label:'Добавить креатив', act:`adsEdit(${c.id})`});
  if(c.imps>2000 && ctr<1) out.push({tone:'warn', ic:'bolt', p:0,
    text:`Низкий CTR <b>${ctr.toFixed(1)}%</b> — обновите заголовок или включите A/B-тест.`,
    label:'Изменить', act:`adsEdit(${c.id})`});
  if(ctr>=3 && bpct>=80 && c.status==='act') out.push({tone:'good', ic:'eye', p:0,
    text:`Сильный CTR <b>${ctr.toFixed(1)}%</b>, а бюджет почти израсходован. Пополните, пока идёт открутка.`,
    label:'Пополнить', act:`adsTopup(${c.id})`});
  if(roas>0 && roas<1 && adsSales(c)>0) out.push({tone:'warn', ic:'poll', p:0,
    text:`Окупаемость ниже <b>×1</b> — расход выше выручки. Снизьте ставку или уточните аудиторию.`,
    label:'Изменить', act:`adsEdit(${c.id})`});
  return out.sort((a,b)=>b.p-a.p).slice(0,3);
}
function adsAdviceBlock(c){
  const list = adsAdvice(c);
  if(!list.length) return `<div class="ads-advice"><div class="ads-advice-h">${I('bolt')}Оптимизатор кампаний</div>
    <div class="ads-advice-empty">${I('check')}Кампания настроена оптимально — критичных улучшений нет.</div></div>`;
  return `<div class="ads-advice"><div class="ads-advice-h">${I('bolt')}Оптимизатор кампаний<span class="ads-advice-n">${list.length}</span></div>`+
    list.map(a=>`<div class="ads-advice-row ${a.tone}">
      <span class="ads-advice-ic">${I(a.ic)}</span>
      <div class="ads-advice-mid"><p>${a.text}</p>
        ${a.act ? `<button class="ads-advice-btn" onclick="event.stopPropagation();${a.act}">${a.label}${I('chev')}</button>` : ''}</div>
    </div>`).join('')+`</div>`;
}
function adsApplyAbWinner(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c || !c.ab) return;
  const win = adsAbWinner(c);
  if(!win){ toast('Победитель ещё не определён — тесту нужно больше показов'); return; }
  if(win==='b') c.name = c.ab.tb;
  c.ab = null;
  adsSyncFeedPost(c);
  adsSave(); adsRender();
  toast('Оставили победивший вариант — весь показ теперь на нём');
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
  adsBill(sum, c.name, 'Пополнение бюджета');
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

/* баннер тарифной скидки на рекламу (или апселл, если тариф низкий) */
function adsRenderTier(){
  const box = document.getElementById('adsTier'); if(!box) return;
  const disc = adsDisc(), tier = adsTierLabel();
  if(disc>0){
    box.className = 'ads-tier on';
    box.onclick = null; box.removeAttribute('role');
    box.innerHTML = `<span class="ads-tier-ic">${I('fire')}</span>
      <div class="ads-tier-mid"><b>Тариф ${tier} · −${Math.round(disc*100)}% на всю рекламу</b>
        <small>Скидка уже применяется: за тот же бюджет — больше показов и кликов.</small></div>`;
  }else{
    box.className = 'ads-tier up';
    box.onclick = adsTierUpsell; box.setAttribute('role','button');
    box.innerHTML = `<span class="ads-tier-ic">${I('crown')}</span>
      <div class="ads-tier-mid"><b>Больше показов за те же деньги</b>
        <small>PRO −10% · BUSINESS −20% · MAX −30% — бюджет тот же, результат больше.</small></div>
      <span class="ads-tier-cta">Открыть${I('chev')}</span>`;
  }
}
function adsTierUpsell(){
  if(typeof okoRequireSub==='function') okoRequireSub('MAX','Реклама дешевле — до −30% на MAX');
}

function adsRender(){ adsRenderTier(); adsRenderSummary(); adsRenderList(); }

function adsTickUI(){
  adsRenderSummary();
  ADS.camps.forEach(c=>{
    const el = document.querySelector(`.ads-camp[data-cid="${c.id}"]`); if(!el) return;
    const set = (k,v)=>{ const n = el.querySelector(`[data-m="${k}"]`); if(n) n.textContent = v; };
    /* растущие метрики — с короткой подсветкой при реальном изменении */
    const setLive = (k,v)=>{ const n = el.querySelector(`[data-m="${k}"]`); if(n && n.textContent!==v){ n.textContent = v; if(c.status==='act') adsFlashEl(n); } };
    setLive('imps', fmtN(c.imps)); setLive('clicks', fmtN(c.clicks));
    set('ctr', adsCtr(c).toFixed(1)+'%');
    const sp = el.querySelector('[data-m="spent"]'); if(sp) sp.innerHTML = fmtN(Math.round(c.spent))+'<i class="ads-cur">₽</i>';
    const bar = el.querySelector('[data-m="bar"]'); if(bar){ bar.style.width = Math.min(100, c.spent/c.budget*100)+'%'; bar.className = adsBudgetCls(c); }
    adsDrawSpark(c);
    if(adsOpenStats.has(c.id)){
      adsDrawDays(c);
      adsSyncFunnel(c, false);
      adsSyncRoas(c);
      const sub = el.querySelector('[data-m="sub7"]'); if(sub) sub.innerHTML = adsSub7(c);
      const ab = el.querySelector('[data-m="ab"]'); if(ab) ab.innerHTML = adsAbInner(c);
      const adv = el.querySelector('.ads-advice'); if(adv) adv.outerHTML = adsAdviceBlock(c);
    }
  });
}

/* ---------- создание кампании ---------- */
let adsDraft = {};
let adsEditId = 0;   /* 0 — создание новой; иначе id редактируемой кампании */
function adsDraftReset(){
  adsDraft = {fmt:'post', model:'CPM', cta:'Подробнее', sex:'any', geo:'РФ', cities:[],
    ab:false, reach:0, media:null, pace:0, start:'now', startAt:0};
}
/* темп открутки: 0 — максимум, N — равномерно за N дней (дневной лимит = бюджет/N) */
function adsPickPace(btn){
  document.querySelectorAll('#adsPaceChips .ads-chip').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); adsDraft.pace = parseInt(btn.dataset.v,10) || 0;
  adsCalcForecast();
}
/* старт: сейчас или запланировать на дату/время */
function adsPickStart(btn){
  document.querySelectorAll('#adsStartChips .ads-chip').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); adsDraft.start = btn.dataset.v;
  const inp = document.getElementById('adsSchedAt');
  if(inp){
    inp.style.display = adsDraft.start==='sched' ? '' : 'none';
    if(adsDraft.start==='sched' && !inp.value){
      const t = new Date(Date.now()+864e5);        /* по умолчанию — завтра, ровный час */
      t.setMinutes(0,0,0);
      inp.value = new Date(t.getTime()-t.getTimezoneOffset()*6e4).toISOString().slice(0,16);
    }
  }
  adsSyncLaunchBtn();
}
function adsLaunchLabel(){
  if(adsEditId) return 'Сохранить';
  return adsDraft.start==='sched' ? 'Запланировать' : 'Запустить';
}
function adsSyncLaunchBtn(){
  const b = document.getElementById('adsLaunchBtn'); if(!b) return;
  const s = b.querySelector('span'); if(s) s.textContent = adsLaunchLabel();
}

/* ---------- медиа креатива (фото / картинка / видео) ---------- */
/* фирменный постер-заглушка для демо-кампаний (самодостаточный SVG data-URL) */
function adsBrandPoster(c){
  const f = ADS_FORMATS[c.fmt] || ADS_FORMATS.post;
  const label = (f.l || 'OKO').toUpperCase();
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>"+
    "<defs><radialGradient id='g' cx='28%' cy='24%' r='90%'>"+
    "<stop offset='0' stop-color='#1c2a0c'/><stop offset='55%' stop-color='#0d1207'/><stop offset='1' stop-color='#050705'/>"+
    "</radialGradient><linearGradient id='l' x1='0' y1='0' x2='1' y2='1'>"+
    "<stop offset='0' stop-color='#9AFF00'/><stop offset='1' stop-color='#6fbf00'/></linearGradient></defs>"+
    "<rect width='640' height='360' fill='url(#g)'/>"+
    "<circle cx='120' cy='300' r='190' fill='#9AFF00' opacity='.06'/>"+
    "<circle cx='540' cy='70' r='140' fill='#9AFF00' opacity='.05'/>"+
    "<g transform='translate(320 150)'><ellipse rx='58' ry='38' fill='none' stroke='url(#l)' stroke-width='9'/>"+
    "<circle r='17' fill='url(#l)'/></g>"+
    "<text x='320' y='250' fill='#9AFF00' font-family='Arial,Helvetica,sans-serif' font-size='24' font-weight='700' letter-spacing='6' text-anchor='middle'>"+label+"</text>"+
    "<text x='320' y='284' fill='#ffffff' opacity='.5' font-family='Arial,Helvetica,sans-serif' font-size='13' letter-spacing='2' text-anchor='middle'>OKO ADS</text>"+
    "</svg>";
  return {type:'image', src:'data:image/svg+xml;utf8,'+encodeURIComponent(svg), name:'Креатив OKO', w:640, h:360};
}

/* HTML медиа для превью и ленты; после перезагрузки без src — аккуратная заглушка */
function adsMediaHtml(m, cls){
  if(!m) return '';
  cls = cls || 'ads-post-media';
  if(m.type==='image' && m.src)
    return `<div class="${cls}"><img src="${m.src}" alt="" loading="lazy"></div>`;
  if(m.type==='video' && m.src)
    return `<div class="${cls} vid"><video src="${m.src}" muted loop autoplay playsinline></video><span class="ads-media-play">${I('play')}</span></div>`;
  const ic = m.type==='video' ? 'circle-play' : 'photo';
  const lbl = m.type==='video' ? 'видео' : 'изображение';
  return `<div class="${cls} ph">${I(ic)}<em>${esc(m.name||lbl)}</em></div>`;
}

function adsRenderMediaZone(){
  const z = document.getElementById('adsMediaZone'); if(!z) return;
  const m = adsDraft.media;
  if(!m){
    z.className = 'ads-media empty';
    z.innerHTML = `<span class="ads-media-ic">${I('photo')}</span>
      <b>Добавьте креатив</b>
      <small>фото, картинка или видео — с медиа CTR выше в 2–3 раза. До 900px, 10 МБ.</small>`;
    return;
  }
  z.className = 'ads-media has';
  z.innerHTML = `${adsMediaHtml(m, 'ads-media-prev')}
    <div class="ads-media-meta"><b>${esc(m.name || (m.type==='video'?'Видео':'Изображение'))}</b>
      <small>${m.type==='video'?'видео':'изображение'}${m.w?` · ${m.w}×${m.h}`:''}</small></div>
    <button type="button" class="ads-media-x" onclick="adsClearMedia()" title="Убрать">${I('trash')}</button>`;
}

function adsPickMedia(kind){
  const id = kind==='photo' ? 'adsFilePhoto' : kind==='video' ? 'adsFileVideo' : 'adsFileImage';
  const inp = document.getElementById(id);
  if(inp){ try{ inp.value=''; }catch(e){} inp.click(); }
}

function adsRevokeDraftMedia(){
  const m = adsDraft.media;
  if(m && m._obj && m.src){ try{ URL.revokeObjectURL(m.src); }catch(e){} }
}

/* сжатие картинки в небольшой data-URL через canvas (влезает в localStorage) */
function adsCompressImage(file, cb){
  let url;
  try{ url = URL.createObjectURL(file); }catch(e){ cb(null); return; }
  const img = new Image();
  img.onload = function(){
    const max = 900;
    let w = img.naturalWidth || 900, h = img.naturalHeight || 600;
    if(Math.max(w,h) > max){ const k = max/Math.max(w,h); w = Math.round(w*k); h = Math.round(h*k); }
    let out = null;
    try{
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, w, h);
      out = cv.toDataURL('image/webp', 0.72);
      if(!out || out.indexOf('data:image/webp')!==0) out = cv.toDataURL('image/jpeg', 0.74);
    }catch(e){ out = null; }
    try{ URL.revokeObjectURL(url); }catch(e){}
    cb(out, w, h);
  };
  img.onerror = function(){ try{ URL.revokeObjectURL(url); }catch(e){} cb(null); };
  img.src = url;
}

function adsMediaChosen(input, kind){
  const file = input && input.files && input.files[0]; if(!file) return;
  const maxMb = kind==='video' ? 10 : 8;
  if(file.size > maxMb*1048576){ toast('Файл больше '+maxMb+' МБ — выберите поменьше'); return; }
  adsRevokeDraftMedia();
  if(kind==='video'){
    let url;
    try{ url = URL.createObjectURL(file); }catch(e){ toast('Не удалось прочитать видео'); return; }
    adsDraft.media = {type:'video', src:url, name:file.name, _obj:true};
    adsRenderMediaZone(); adsRenderPreview();
    toast('Видео прикреплено к креативу');
  }else{
    toast('Обрабатываю изображение…');
    adsCompressImage(file, (src, w, h)=>{
      if(!src){ toast('Не удалось прочитать изображение'); return; }
      adsDraft.media = {type:'image', src, name:file.name, w, h};
      adsRenderMediaZone(); adsRenderPreview();
      toast('Изображение прикреплено к креативу');
    });
  }
}

function adsClearMedia(){
  adsRevokeDraftMedia();
  adsDraft.media = null;
  adsRenderMediaZone(); adsRenderPreview();
}

function adsOpenCreate(){
  adsRevokeDraftMedia();
  adsEditId = 0;
  adsDraftReset();
  const st = document.getElementById('adsSheetTitle'); if(st) st.textContent = 'Новая кампания';
  ['adsInpTitle','adsInpText','adsInpLink','adsInpTitleB'].forEach(id=>{ const e = document.getElementById(id); if(e) e.value=''; });
  document.querySelectorAll('#adsPaceChips .ads-chip').forEach((b,i)=>b.classList.toggle('on', i===0));
  document.querySelectorAll('#adsStartChips .ads-chip').forEach((b,i)=>b.classList.toggle('on', i===0));
  const sa = document.getElementById('adsSchedAt'); if(sa){ sa.style.display='none'; sa.value=''; }
  const abChip = document.getElementById('adsAbChip'); if(abChip) abChip.classList.remove('on');
  const abInp = document.getElementById('adsInpTitleB'); if(abInp) abInp.style.display = 'none';
  document.querySelectorAll('#adsCtaChips .ads-chip').forEach((b,i)=>b.classList.toggle('on', i===0));
  document.querySelectorAll('#adsSexChips .ads-chip').forEach((b,i)=>b.classList.toggle('on', i===0));
  document.querySelectorAll('#adsGeoChips .ads-chip').forEach((b,i)=>b.classList.toggle('on', i===0));
  document.querySelectorAll('#adsIntChips .ads-chip, #adsDevChips .ads-chip, #adsTimeChips .ads-chip').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('#adsAgeChips .ads-chip').forEach(b=>b.classList.toggle('on', b.dataset.v==='25-34'));
  const bi = document.getElementById('adsInpBudget'); if(bi) bi.value = '1000';
  adsRenderFmts();
  adsRenderCities();
  adsRenderSaved();
  adsRenderMediaZone();
  adsSyncModelUI();
  adsSyncLaunchBtn();
  adsStep(1); openSheet('ads-create');
}

/* --- формат --- */
function adsRenderFmts(){
  const box = document.getElementById('adsFmtGrid'); if(!box) return;
  box.innerHTML = Object.entries(ADS_FORMATS).map(([k,f])=>`
    <button class="ads-fmt ${adsDraft.fmt===k?'on':''}" data-v="${k}" onclick="adsPickFmt('${k}')">
      <span class="ads-fmt-ic">${I(f.ico)}</span>
      <span class="ads-fmt-l">${esc(f.l)}</span>
      <span class="ads-fmt-d">${esc(f.desc)}</span>
      <span class="ads-fmt-price">${f.model} · от ${f.model==='CPC'?f.cpc:f.cpm} ₽</span>
    </button>`).join('');
  const tw = document.getElementById('adsFmtTarget');
  if(tw){
    const f = ADS_FORMATS[adsDraft.fmt];
    tw.innerHTML = `<div class="ads-fmt-note">${I('bolt')}<span>Модель по умолчанию — <b>${f.model}</b> (${ADS_MODELS[f.model].unit}). Ставку и бюджет зададите на последнем шаге.</span></div>`;
  }
}
function adsPickFmt(k){
  adsDraft.fmt = k; adsDraft.model = ADS_FORMATS[k].model;
  adsRenderFmts(); adsSyncModelUI();
}

function adsStep(n){
  if(n>2){
    const title = document.getElementById('adsInpTitle').value.trim();
    const text  = document.getElementById('adsInpText').value.trim();
    if(!title){ toast('Добавь заголовок объявления'); return; }
    if(!text){ toast('Добавь текст объявления'); return; }
    if(adsDraft.ab && !document.getElementById('adsInpTitleB').value.trim()){
      toast('Добавь вариант B заголовка или выключи A/B тест'); return;
    }
  }
  for(let i=1;i<=4;i++){ const s = document.getElementById('adsStep'+i); if(s) s.style.display = (i===n?'block':'none'); }
  document.querySelectorAll('#adsSteps i').forEach((d,i)=>d.classList.toggle('on', i<n));
  if(n===2) adsRenderPreview();
  if(n===3) adsCalcReach();
  if(n===4){ adsSyncModelUI(); adsCalcForecast(); }
  const sh = document.getElementById('sheet-ads-create'); if(sh) sh.scrollTop = 0;
}

function adsPickCta(btn){
  document.querySelectorAll('#adsCtaChips .ads-chip').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); adsDraft.cta = btn.dataset.v; adsRenderPreview();
}
function adsPickSex(btn){
  document.querySelectorAll('#adsSexChips .ads-chip').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); adsDraft.sex = btn.dataset.v; adsCalcReach();
}
function adsPickGeo(btn){
  document.querySelectorAll('#adsGeoChips .ads-chip').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); adsDraft.geo = btn.dataset.v; adsDraft.cities = [];
  adsRenderCities(); adsCalcReach();
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

/* --- города --- */
function adsRenderCities(){
  const wrap = document.getElementById('adsCityWrap');
  const box = document.getElementById('adsCityChips');
  if(!wrap || !box) return;
  const list = ADS_CITIES[adsDraft.geo];
  if(!list){ wrap.style.display = 'none'; adsDraft.cities = []; return; }
  wrap.style.display = '';
  box.innerHTML = list.map(([name,r])=>`
    <button class="ads-city ${adsDraft.cities.includes(name)?'on':''}" data-v="${esc(name)}" onclick="adsToggleCity(this)">
      ${I('pin')}${esc(name)}<em>${r>=1?r.toFixed(1):Math.round(r*1000)+'к'}</em></button>`).join('');
  adsCityHint();
}
function adsToggleCity(btn){
  const v = btn.dataset.v;
  const i = adsDraft.cities.indexOf(v);
  if(i<0) adsDraft.cities.push(v); else adsDraft.cities.splice(i,1);
  btn.classList.toggle('on');
  adsCityHint(); adsCalcReach();
}
function adsCityHint(){
  const h = document.getElementById('adsCityHint'); if(!h) return;
  h.textContent = adsDraft.cities.length ? '· '+adsDraft.cities.length+' выбрано' : '· весь регион';
}

/* --- сохранённые аудитории (в шаге 3) --- */
function adsRenderSaved(){
  const row = document.getElementById('adsSavedRow'); if(!row) return;
  if(!ADS.auds.length){ row.innerHTML = ''; row.style.display = 'none'; return; }
  row.style.display = '';
  row.innerHTML = `<div class="ads-saved-h">${I('bookmark')}Сохранённые аудитории</div>
    <div class="ads-saved-chips">${ADS.auds.map(a=>`
      <button class="ads-saved-chip" onclick="adsApplyAud(${a.id})">${esc(a.name)}
        <i onclick="event.stopPropagation();adsDelAud(${a.id})">${I('trash')}</i></button>`).join('')}</div>`;
}
function adsApplyAud(id){
  const a = ADS.auds.find(x=>x.id===id); if(!a) return;
  adsDraft.sex = a.sex; adsDraft.geo = a.geo; adsDraft.cities = [...(a.cities||[])];
  document.querySelectorAll('#adsSexChips .ads-chip').forEach(b=>b.classList.toggle('on', b.dataset.v===a.sex));
  document.querySelectorAll('#adsGeoChips .ads-chip').forEach(b=>b.classList.toggle('on', b.dataset.v===a.geo));
  const app = (box, arr)=>document.querySelectorAll('#'+box+' .ads-chip').forEach(b=>b.classList.toggle('on', (arr||[]).includes(b.dataset.v)));
  app('adsIntChips', a.interests); app('adsAgeChips', a.ages); app('adsDevChips', a.devs); app('adsTimeChips', a.times);
  adsRenderCities(); adsCalcReach();
  toast('Аудитория «'+a.name+'» применена');
}
function adsDelAud(id){
  ADS.auds = ADS.auds.filter(x=>x.id!==id);
  adsSave(); adsRenderSaved(); adsRenderSummary();
  toast('Аудитория удалена');
}
function adsSaveAud(){
  const aud = {
    id: ADS.audSeq++, sex: adsDraft.sex, geo: adsDraft.geo, cities: [...adsDraft.cities],
    interests: adsPicked('adsIntChips'), ages: adsPicked('adsAgeChips'),
    devs: adsPicked('adsDevChips'), times: adsPicked('adsTimeChips')
  };
  aud.name = adsAudName(aud);
  ADS.auds.unshift(aud);
  if(ADS.auds.length>8) ADS.auds.pop();
  adsSave(); adsRenderSaved(); adsRenderSummary();
  toast('Аудитория сохранена');
}
function adsAudName(a){
  const p = [];
  p.push(a.sex==='m'?'муж':a.sex==='f'?'жен':'все');
  p.push(a.cities && a.cities.length ? a.cities[0]+(a.cities.length>1?' +'+(a.cities.length-1):'') : a.geo);
  if(a.interests && a.interests.length) p.push(a.interests[0]);
  return p.join(' · ');
}
function adsShowAuds(){
  if(!ADS.auds.length){ toast('Сохранённых аудиторий пока нет — создай при настройке кампании'); return; }
  showPopup({ico:'bookmark', title:'Сохранённые аудитории',
    body:`<div class="ads-aud-pop">${ADS.auds.map(a=>`
      <div class="ads-aud-pop-row">
        <div><b>${esc(a.name)}</b><small>${esc(adsAudLine(a))}</small></div>
        <button class="ads-chip" onclick="adsDelAud(${a.id});closePopup()">${I('trash')}</button>
      </div>`).join('')}</div>`,
    actions:[{label:'Закрыть'}]});
}

/* --- превью объявления --- */
function adsRenderPreview(){
  const box = document.getElementById('adsPreview'); if(!box) return;
  const title = (document.getElementById('adsInpTitle').value.trim()) || 'Заголовок объявления';
  const text  = (document.getElementById('adsInpText').value.trim()) || 'Текст объявления появится здесь по мере ввода.';
  const f = ADS_FORMATS[adsDraft.fmt];
  box.innerHTML = `<div class="ads-prev-label">${I('eye')}Как увидят в ленте</div>
    <div class="ads-prev-card">
      <div class="ads-prev-top"><span class="ads-prev-ava">${(PROFILE.name[0]||'O').toUpperCase()}</span>
        <div><b>${esc(PROFILE.name)}</b><small>${esc(f.tag)}</small></div></div>
      <div class="ads-prev-title">${esc(title)}</div>
      <div class="ads-prev-text">${esc(text)}</div>
      ${adsMediaHtml(adsDraft.media, 'ads-prev-media')}
      <button class="ads-prev-cta">${esc(adsDraft.cta)} ${I('chev')}</button>
    </div>`;
}

/* живой прогноз охвата */
let adsReachCur = 0, adsReachRaf = 0;
const ADS_REACH_MAX = 92000000;
function adsCalcReach(){
  const geoBase = {'РФ':11800000, 'СНГ':26400000, 'Весь мир':92000000}[adsDraft.geo] || 11800000;
  let base = geoBase;
  if(adsDraft.cities.length && ADS_CITIES[adsDraft.geo]){
    const map = Object.fromEntries(ADS_CITIES[adsDraft.geo]);
    base = adsDraft.cities.reduce((s,c)=>s+(map[c]||0)*1e6, 0);
  }
  const sexK = adsDraft.sex==='m' ? .49 : adsDraft.sex==='f' ? .51 : 1;
  const intShares = {'нейросети':.055,'бизнес':.09,'контент':.08,'маркетинг':.07,'игры':.11,'крипта':.045,'образование':.1,'финансы':.06};
  const ageShares = {'18-24':.21,'25-34':.31,'35-44':.24,'45+':.24};
  const devShares = {'ios':.28,'android':.66,'desktop':.3};
  const timeShares = {'morning':.22,'day':.3,'evening':.34,'night':.14};
  const ints = adsPicked('adsIntChips'), ages = adsPicked('adsAgeChips');
  const devs = adsPicked('adsDevChips'), times = adsPicked('adsTimeChips');
  const intK = ints.length ? Math.min(.4, ints.reduce((s,v)=>s+(intShares[v]||0),0)) : .5;
  const ageK = ages.length ? ages.reduce((s,v)=>s+(ageShares[v]||0),0) : 1;
  const devK = devs.length ? Math.min(1, devs.reduce((s,v)=>s+(devShares[v]||0),0)) : 1;
  const timeK = times.length ? Math.min(1, times.reduce((s,v)=>s+(timeShares[v]||0),0)) : 1;
  const target = Math.max(0, Math.round(base * sexK * intK * ageK * devK * timeK));
  adsDraft.reach = target;
  const sub = document.getElementById('adsReachS');
  if(sub){
    const bits = [];
    bits.push(adsDraft.sex==='m'?'муж':adsDraft.sex==='f'?'жен':'любой пол');
    bits.push(adsDraft.cities.length ? adsDraft.cities.length+' город(а)' : adsDraft.geo);
    bits.push(ints.length? ints.length+' интерес(а)' : 'широкие интересы');
    sub.textContent = bits.join(' · ');
  }
  const bar = document.getElementById('adsReachBar');
  if(bar){ const pct = Math.max(2, Math.min(100, Math.log10(target+1)/Math.log10(ADS_REACH_MAX)*100)); bar.style.width = pct+'%'; }
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

/* --- модель оплаты / ставка --- */
function adsPickModel(btn){
  document.querySelectorAll('#adsModelChips .ads-model-b').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on'); adsDraft.model = btn.dataset.v;
  adsSyncModelUI(); adsCalcForecast();
}
function adsRecBid(){
  const f = ADS_FORMATS[adsDraft.fmt];
  return adsDraft.model==='CPC' ? f.cpc : f.cpm;
}
function adsSyncModelUI(){
  document.querySelectorAll('#adsModelChips .ads-model-b').forEach(b=>b.classList.toggle('on', b.dataset.v===adsDraft.model));
  const rec = adsRecBid();
  const inp = document.getElementById('adsInpBid'); if(inp && (!inp.value || inp.dataset.model!==adsDraft.model)){ inp.value = rec; inp.dataset.model = adsDraft.model; }
  const hint = document.getElementById('adsBidHint'); if(hint) hint.textContent = '· '+ADS_MODELS[adsDraft.model].unit;
  const recL = document.getElementById('adsBidRec'); if(recL) recL.textContent = 'реком. '+rec+' ₽';
  adsBidBar();
}
function adsBidBar(){
  const rec = adsRecBid();
  const m = ADS_MODELS[adsDraft.model];
  const lo = m.min, hi = Math.round(rec*m.max);
  const v = Math.max(0, parseInt(document.getElementById('adsInpBid')?.value,10) || 0);
  const pct = Math.max(0, Math.min(100, (v-lo)/(hi-lo || 1)*100));
  const fill = document.getElementById('adsBidFill'); if(fill) fill.style.width = pct+'%';
  const recPct = Math.max(0, Math.min(100, (rec-lo)/(hi-lo || 1)*100));
  const mark = document.getElementById('adsBidMark'); if(mark) mark.style.left = recPct+'%';
}

function adsSetBudget(v){
  document.getElementById('adsInpBudget').value = v;
  document.querySelectorAll('#adsStep4 .ads-chip').forEach(b=>b.classList.toggle('on', b.textContent.replace(/\s|₽/g,'')==String(v)));
  adsCalcForecast();
}

function adsCalcForecast(){
  const b = Math.max(0, parseInt(document.getElementById('adsInpBudget').value,10) || 0);
  const bid = Math.max(1, parseInt(document.getElementById('adsInpBid').value,10) || adsRecBid());
  adsBidBar();
  const ctrEst = 0.022 + (bid/adsRecBid()-1)*0.006;   /* выше ставка → чуть выше приоритет/CTR */
  const disc = adsDisc();                             /* скидка тарифа → эффективная ставка ниже */
  const effBid = Math.max(1, bid*(1-disc));           /* за тот же бюджет — больше показов/кликов */
  let imps, cLo, cHi, cpm;
  if(adsDraft.model==='CPC'){
    const clicks = Math.round(b/effBid);
    imps = Math.round(clicks/Math.max(.008, ctrEst));
    cLo = Math.max(1, Math.round(clicks*.85)); cHi = Math.max(1, Math.round(clicks*1.15));
    cpm = imps ? b/imps*1000 : 0;
  }else{
    imps = Math.round(b/effBid*1000);
    cLo = Math.max(1, Math.round(imps*.01)); cHi = Math.max(1, Math.round(imps*.04));
    cpm = imps ? b/imps*1000 : effBid;
  }
  if(adsDraft.reach){ const cap = Math.round(adsDraft.reach*2.5); if(imps>cap){ imps = cap; } }
  const cpc = ((cLo+cHi)/2) ? b/((cLo+cHi)/2) : 0;
  const set = (id,v)=>{ const e = document.getElementById(id); if(e) e.innerHTML = v; };
  /* строка скидки тарифа + подсказка дневного лимита */
  const discRow = document.getElementById('adsFDiscRow');
  if(discRow){
    discRow.style.display = disc>0 ? '' : 'none';
    if(disc>0) set('adsFDisc', `−${Math.round(disc*100)}% · ${adsTierLabel()}`);
  }
  const paceHint = document.getElementById('adsPaceHint');
  if(paceHint) paceHint.textContent = adsDraft.pace>0 ? '· ≈ '+fmtN(Math.max(1,Math.round(b/adsDraft.pace)))+' ₽/день' : '· без ограничения скорости';
  set('adsFImps',  imps ? `~ ${fmtN(Math.round(imps*.85))} – ${fmtN(Math.round(imps*1.15))}` : '—');
  set('adsFClicks',imps ? `~ ${fmtN(cLo)} – ${fmtN(cHi)}` : '—');
  set('adsFCpc',   cpc ? `~ ${cpc<10 ? cpc.toFixed(1) : fmtN(Math.round(cpc))} ₽` : '—');
  set('adsFCpm',   cpm ? `~ ${cpm<10 ? cpm.toFixed(1) : fmtN(Math.round(cpm))} ₽` : '—');
  set('adsFCharge', b ? fmtMoney(b) : '—');
  const note = document.getElementById('adsBalanceNote');
  if(note) note.innerHTML = `На лицевом счёте: <b>${fmtMoney(WALLET.balance)}</b>${b>WALLET.balance?' — не хватает, пополни кошелёк':''}`;
}

function adsLaunch(){
  if(adsEditId) return adsSaveEdit();
  const name = document.getElementById('adsInpTitle').value.trim();
  const text = document.getElementById('adsInpText').value.trim();
  let link  = document.getElementById('adsInpLink').value.trim();
  const budget = Math.max(0, parseInt(document.getElementById('adsInpBudget').value,10) || 0);
  const bid = Math.max(1, parseInt(document.getElementById('adsInpBid').value,10) || adsRecBid());
  if(!name || !text){ adsStep(2); return; }
  if(budget < 100){ toast('Минимальный бюджет — 100 ₽'); return; }
  if(link && !/^https?:\/\//i.test(link)) link = 'https://'+link;
  /* запланированный старт: дата/время из поля */
  let startTs = 0, sched = false;
  if(adsDraft.start==='sched'){
    const raw = (document.getElementById('adsSchedAt')||{}).value;
    const t = raw ? new Date(raw).getTime() : 0;
    if(t && t > Date.now()+3e4){ startTs = t; sched = true; }
  }
  if(!walletCharge(budget, 'Реклама: '+name)) return;
  okoEarn(budget, 'Рекламный кабинет');
  adsBill(budget, name, ADS_FORMATS[adsDraft.fmt].l);
  const ctrEst = 0.022 + (bid/adsRecBid()-1)*0.006;
  const camp = {
    id: ADS.seq++, name, text, cta: adsDraft.cta, link: link || '',
    fmt: adsDraft.fmt, model: adsDraft.model, bid, ctrEst: Math.max(.008, ctrEst),
    cvr: +(0.16 + Math.random()*0.18).toFixed(3),
    aov: (ADS_FORMATS[adsDraft.fmt] && ADS_FORMATS[adsDraft.fmt].aov) || 690,
    salesRate: +(0.006 + Math.random()*0.007).toFixed(4),
    disc: adsDisc(), pace: adsDraft.pace||0, dailyCap: adsDraft.pace>0 ? Math.max(1,Math.round(budget/adsDraft.pace)) : 0,
    spentToday: 0, spentDay: adsDayKey(),
    sex: adsDraft.sex, geo: adsDraft.geo, cities: [...adsDraft.cities],
    interests: adsPicked('adsIntChips'), ages: adsPicked('adsAgeChips'),
    devs: adsPicked('adsDevChips'), times: adsPicked('adsTimeChips'),
    media: adsDraft.media ? Object.assign({}, adsDraft.media) : null,
    budget, spent: 0, imps: 0, clicks: 0, status: sched ? 'sched' : 'mod', startTs,
    hist: [], created: Date.now(),
    days: [...Array(7)].map(()=>({i:0,c:0})), dstamp: adsDayKey()
  };
  adsDraft.media = null;   /* креатив передан кампании — не отзываем blob-URL видео */
  const tb = adsDraft.ab ? document.getElementById('adsInpTitleB').value.trim() : '';
  if(tb) camp.ab = {tb, ka: .012+Math.random()*.025, kb: .012+Math.random()*.025, a:{i:0,c:0}, b:{i:0,c:0}};
  ADS.camps.unshift(camp);
  adsSave(); closeSheet(); adsRender();
  if(sched){
    toast('Кампания запланирована на '+new Date(startTs).toLocaleString('ru-RU',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}));
  }else{
    toast('Кампания отправлена на модерацию OKO');
    setTimeout(()=>adsModerate(camp.id), 3000);
  }
}

/* ---------- сохранение изменений существующей кампании ---------- */
function adsSaveEdit(){
  const c = ADS.camps.find(x=>x.id===adsEditId); if(!c){ adsEditId=0; closeSheet(); return; }
  const name = document.getElementById('adsInpTitle').value.trim();
  const text = document.getElementById('adsInpText').value.trim();
  let link  = document.getElementById('adsInpLink').value.trim();
  let budget = Math.max(0, parseInt(document.getElementById('adsInpBudget').value,10) || 0);
  const bid = Math.max(1, parseInt(document.getElementById('adsInpBid').value,10) || adsRecBid());
  if(!name || !text){ adsStep(2); return; }
  if(budget < 100){ toast('Минимальный бюджет — 100 ₽'); return; }
  if(link && !/^https?:\/\//i.test(link)) link = 'https://'+link;
  /* бюджет не может быть ниже уже потраченного; разницу списываем/возвращаем на счёт */
  if(budget < c.spent) budget = Math.ceil(c.spent);
  const d = budget - c.budget;
  if(d > 0){ if(!walletCharge(d, 'Изменение бюджета: '+name)) return; okoEarn(d,'Рекламный кабинет'); adsBill(d, name, 'Пополнение бюджета'); }
  else if(d < 0){ walletAdd(-d, 'Возврат: бюджет кампании уменьшен — '+name); adsBill(d, name, 'Возврат бюджета'); }
  /* применяем поля креатива и таргетинга */
  c.name = name; c.text = text; c.cta = adsDraft.cta; c.link = link || '';
  c.fmt = adsDraft.fmt; c.model = adsDraft.model; c.bid = bid;
  c.aov = (ADS_FORMATS[adsDraft.fmt] && ADS_FORMATS[adsDraft.fmt].aov) || c.aov || 690;
  c.ctrEst = Math.max(.008, 0.022 + (bid/adsRecBid()-1)*0.006);
  c.sex = adsDraft.sex; c.geo = adsDraft.geo; c.cities = [...adsDraft.cities];
  c.interests = adsPicked('adsIntChips'); c.ages = adsPicked('adsAgeChips');
  c.devs = adsPicked('adsDevChips'); c.times = adsPicked('adsTimeChips');
  c.budget = budget;
  c.pace = adsDraft.pace||0; c.dailyCap = c.pace>0 ? Math.max(1,Math.round(budget/c.pace)) : 0;
  if(adsDraft.media !== c.media){
    if(c.media && c.media._obj && c.media.src){ try{ URL.revokeObjectURL(c.media.src); }catch(e){} }
    c.media = adsDraft.media ? Object.assign({}, adsDraft.media) : null;
    adsDraft.media = null;
  }
  const tb = adsDraft.ab ? (document.getElementById('adsInpTitleB').value.trim()) : '';
  if(tb && c.ab){ c.ab.tb = tb; }
  else if(tb && !c.ab){ c.ab = {tb, ka:.012+Math.random()*.025, kb:.012+Math.random()*.025, a:{i:0,c:0}, b:{i:0,c:0}}; }
  else if(!adsDraft.ab){ c.ab = null; }
  /* если завершённой кампании подняли бюджет — снова в открутку */
  if(c.status==='done' && c.spent < c.budget){ c.status = 'act'; adsPushToFeed(c); }
  adsSyncFeedPost(c);
  adsEditId = 0;
  adsSave(); closeSheet(); adsRender();
  toast('Кампания обновлена');
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
    adsBill(-c.budget, c.name, 'Возврат (отклонено модерацией)');
    showPopup({ico:'flag', title:'Реклама отклонена',
      body:`Модератор OKO нашёл в объявлении «${esc(c.name)}» запрещённую тематику: <b>«${esc(bad)}»</b>.<br><br>Бюджет ${fmtMoney(c.budget)} уже вернулся на лицевой счёт. Исправь текст и запусти заново.`,
      actions:[{label:'Понятно'}]});
  }else{
    c.status = 'act';
    adsPushToFeed(c);
    toast('Кампания «'+c.name+'» прошла модерацию — объявление в ленте');
  }
  adsSave(); adsRender();
}

/* ---------- биллинг ---------- */
function adsBill(sum, camp, type){
  ADS.bill.unshift({ts: Date.now(), sum, camp, type});
  if(ADS.bill.length>60) ADS.bill.pop();
}
function adsOpenBilling(){
  adsRenderBilling();
  openSheet('ads-billing');
}
function adsRenderBilling(){
  const totalSpent = ADS.bill.filter(b=>b.sum>0).reduce((s,b)=>s+b.sum,0);
  const totalBack  = -ADS.bill.filter(b=>b.sum<0).reduce((s,b)=>s+b.sum,0);
  const sum = document.getElementById('adsBillSum');
  if(sum) sum.innerHTML = `
    <div class="ads-bill-stat"><div class="v">${fmtN(Math.round(totalSpent))}<small>₽</small></div><div class="l">вложено в рекламу</div></div>
    <div class="ads-bill-stat"><div class="v">${fmtN(Math.round(totalBack))}<small>₽</small></div><div class="l">возвращено</div></div>`;
  const list = document.getElementById('adsBillList');
  if(!list) return;
  if(!ADS.bill.length){ list.innerHTML = `<div class="ads-bill-empty">${I('card')}Операций пока нет. Запусти кампанию — списания появятся здесь.</div>`; return; }
  list.innerHTML = ADS.bill.map(b=>{
    const d = new Date(b.ts);
    const dt = d.toLocaleDateString('ru-RU',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    const back = b.sum<0;
    return `<div class="ads-bill-row">
      <span class="ads-bill-ic ${back?'back':''}">${I(back?'plus':'card')}</span>
      <div class="ads-bill-mid"><b>${esc(b.camp)}</b><small>${esc(b.type)} · ${dt}</small></div>
      <span class="ads-bill-sum ${back?'back':''}">${back?'+':'−'}${fmtN(Math.abs(Math.round(b.sum)))} ₽</span>
    </div>`;
  }).join('');
}

/* ---------- пост в ленте ---------- */
function adsPostId(id){ return ADS_POST_BASE + id; }
function adsPushToFeed(c){
  const pid = adsPostId(c.id);
  if(POSTS.rec.some(p=>p.id===pid)) return;
  const tag = (ADS_FORMATS[c.fmt]||ADS_FORMATS.post).tag;
  POSTS.rec.unshift({
    id: pid, ava: (PROFILE.name[0]||'O').toUpperCase(), name: PROFILE.name, sub: tag,
    body: `<b>${esc(c.name)}</b><br>${esc(c.text)}${adsMediaHtml(c.media, 'ads-post-media')}<div class="ads-post-cta"><button onclick="event.stopPropagation();adsCtaClick(${c.id})">${esc(c.cta)} ${I('chev')}</button></div>`,
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

/* ---------- дублирование: открываем мастер, прекопировав все настройки ---------- */
function adsPrefillFromCamp(c){
  adsRevokeDraftMedia();
  adsDraft = {
    fmt: ADS_FORMATS[c.fmt] ? c.fmt : 'post',
    model: c.model || (ADS_FORMATS[c.fmt]||ADS_FORMATS.post).model,
    cta: c.cta || 'Подробнее',
    sex: c.sex || 'any',
    geo: ADS_CITIES[c.geo] || c.geo==='Весь мир' ? c.geo : 'РФ',
    cities: Array.isArray(c.cities) ? [...c.cities] : [],
    ab: !!c.ab, reach: 0,
    pace: c.pace||0, start: 'now', startAt: 0,
    media: c.media ? Object.assign({}, c.media) : null
  };
  document.querySelectorAll('#adsPaceChips .ads-chip').forEach(b=>b.classList.toggle('on', (parseInt(b.dataset.v,10)||0)===(c.pace||0)));
  document.querySelectorAll('#adsStartChips .ads-chip').forEach((b,i)=>b.classList.toggle('on', i===0));
  const sa = document.getElementById('adsSchedAt'); if(sa){ sa.style.display='none'; sa.value=''; }
  const setVal = (id,v)=>{ const e = document.getElementById(id); if(e) e.value = v==null?'':v; };
  setVal('adsInpTitle', c.name);
  setVal('adsInpText', c.text);
  setVal('adsInpLink', c.link);
  setVal('adsInpTitleB', c.ab ? c.ab.tb : '');
  /* A/B чип и поле варианта B */
  const abChip = document.getElementById('adsAbChip'); if(abChip) abChip.classList.toggle('on', !!c.ab);
  const abInp = document.getElementById('adsInpTitleB'); if(abInp) abInp.style.display = c.ab ? '' : 'none';
  /* одиночные наборы */
  const single = (box,val)=>document.querySelectorAll('#'+box+' .ads-chip').forEach(b=>b.classList.toggle('on', b.dataset.v===val));
  single('adsCtaChips', adsDraft.cta);
  single('adsSexChips', adsDraft.sex);
  single('adsGeoChips', adsDraft.geo);
  /* множественные наборы */
  const multi = (box,arr)=>document.querySelectorAll('#'+box+' .ads-chip').forEach(b=>b.classList.toggle('on', (arr||[]).includes(b.dataset.v)));
  multi('adsIntChips',  c.interests);
  multi('adsAgeChips',  c.ages);
  multi('adsDevChips',  c.devs);
  multi('adsTimeChips', c.times);
  /* модель, ставка, бюджет — прописываем так, чтобы adsSyncModelUI не перетёр */
  const bidInp = document.getElementById('adsInpBid');
  if(bidInp){ bidInp.value = c.bid || adsRecBid(); bidInp.dataset.model = adsDraft.model; }
  const budInp = document.getElementById('adsInpBudget'); if(budInp) budInp.value = c.budget || 1000;
  document.querySelectorAll('#adsStep4 .ads-chip').forEach(b=>b.classList.toggle('on', b.textContent.replace(/\s|₽/g,'')===String(c.budget)));
  document.querySelectorAll('#adsModelChips .ads-model-b').forEach(b=>b.classList.toggle('on', b.dataset.v===adsDraft.model));
  /* рендеры зависимых блоков */
  adsRenderFmts();
  adsRenderCities();
  adsRenderSaved();
  adsRenderMediaZone();
  adsSyncModelUI();
}
function adsDuplicate(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c) return;
  adsEditId = 0;
  const st = document.getElementById('adsSheetTitle'); if(st) st.textContent = 'Новая кампания';
  adsPrefillFromCamp(c);
  adsSyncLaunchBtn();
  adsStep(1);
  openSheet('ads-create');
  toast('Копия «'+c.name+'» — проверьте и запустите');
}

/* ---------- редактирование существующей кампании (тот же мастер) ---------- */
function adsEdit(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c) return;
  adsEditId = id;
  const st = document.getElementById('adsSheetTitle'); if(st) st.textContent = 'Редактирование';
  adsPrefillFromCamp(c);
  adsSyncLaunchBtn();
  adsStep(2);   /* сразу к креативу — таргетинг/бюджет уже проставлены */
  openSheet('ads-create');
  toast('Редактирование «'+c.name+'»');
}

/* обновить пост объявления в ленте после правок (если он там есть) */
function adsSyncFeedPost(c){
  const pid = adsPostId(c.id);
  const post = POSTS.rec.find(p=>p.id===pid);
  if(!post) return;
  const tag = (ADS_FORMATS[c.fmt]||ADS_FORMATS.post).tag;
  post.sub = tag;
  post.body = `<b>${esc(c.name)}</b><br>${esc(c.text)}${adsMediaHtml(c.media, 'ads-post-media')}<div class="ads-post-cta"><button onclick="event.stopPropagation();adsCtaClick(${c.id})">${esc(c.cta)} ${I('chev')}</button></div>`;
  const feedOn = document.getElementById('screen-feed');
  if(feedOn && feedOn.classList.contains('active') && typeof renderFeed==='function') renderFeed(curFeedKind);
}

/* ---------- запланированные кампании ---------- */
function adsStartNow(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c || c.status!=='sched') return;
  c.status = 'mod'; c.startTs = 0;
  adsSave(); adsRender();
  toast('Кампания «'+c.name+'» отправлена на модерацию');
  setTimeout(()=>adsModerate(id), 2000);
}
function adsCancelSched(id){
  const c = ADS.camps.find(x=>x.id===id); if(!c || c.status!=='sched') return;
  showPopup({ico:'flag', title:'Отменить запуск?',
    body:`«${esc(c.name)}» ещё не стартовала. Бюджет ${fmtMoney(c.budget)} вернётся на лицевой счёт.`,
    actions:[
      {label:'Отменить кампанию', onclick:()=>{
        walletAdd(c.budget, 'Возврат: запуск рекламы отменён — '+c.name);
        adsBill(-c.budget, c.name, 'Возврат (отмена запуска)');
        ADS.camps = ADS.camps.filter(x=>x.id!==id);
        adsSave(); adsRender(); toast('Запуск отменён, бюджет возвращён');
      }},
      {label:'Оставить', ghost:true}
    ]});
}

/* ---------- живая статистика: тикер раз в 5 секунд ---------- */
function adsTick(){
  let changed = false;
  /* запланированные кампании: наступило время старта — на модерацию, затем в ленту */
  const due = ADS.camps.filter(c=>c.status==='sched' && c.startTs && Date.now()>=c.startTs);
  due.forEach(c=>{ c.status='mod'; c.startTs=0; adsModerate(c.id); });
  if(due.length){ changed = true; adsSave(); if(document.getElementById('screen-ads').classList.contains('active')) adsRender(); }
  ADS.camps.forEach(c=>{
    if(c.status!=='act') return;
    /* дневной лимит бюджета (равномерная открутка): сброс на новых сутках */
    const dk = adsDayKey();
    if(c.spentDay!==dk){ c.spentDay = dk; c.spentToday = 0; }
    if(c.dailyCap>0 && c.spentToday>=c.dailyCap) return;   /* на сегодня открутка исчерпана */
    changed = true;
    const dImps = 70 + Math.floor(Math.random()*180);
    let dClicks;
    if(c.ab){
      const ia = Math.round(dImps*(.45+Math.random()*.1)), ib = dImps-ia;
      const ca = Math.round(ia*c.ab.ka*(.7+Math.random()*.6));
      const cb = Math.round(ib*c.ab.kb*(.7+Math.random()*.6));
      c.ab.a.i += ia; c.ab.a.c += ca; c.ab.b.i += ib; c.ab.b.c += cb;
      dClicks = ca + cb;
    }else{
      const ctr = c.ctrEst || 0.022;
      dClicks = Math.round(dImps*(ctr*(.6+Math.random()*.9)));
    }
    const gross = c.model==='CPC' ? dClicks*c.bid : dImps/1000*adsCampCpm(c);
    const dSpend = gross * (1 - (c.disc||0));   /* скидка тарифа: тот же охват — дешевле */
    c.imps += dImps; c.clicks += dClicks;
    c.spent = Math.min(c.budget, c.spent + dSpend);
    c.spentToday = (c.spentToday||0) + dSpend;
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

/* ---------- патчи ядра ---------- */
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
ADS.camps.forEach(c=>{
  if(c.status==='act') adsPushToFeed(c);
  if(c.status==='mod') setTimeout(()=>adsModerate(c.id), 3000);
});
adsRender();
setInterval(adsTick, 5000);
window.addEventListener('resize', ()=>{
  if(document.getElementById('screen-ads').classList.contains('active'))
    ADS.camps.forEach(c=>{ adsDrawSpark(c); if(adsOpenStats.has(c.id)) adsDrawDays(c); });
});
new MutationObserver(()=>{
  if(document.getElementById('screen-ads').classList.contains('active'))
    ADS.camps.forEach(c=>{ if(adsOpenStats.has(c.id)) adsDrawDays(c); });
}).observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
