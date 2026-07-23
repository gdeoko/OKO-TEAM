/* ===== GAMES: Рулетка OKO — единая призовая рулетка (префикс gm-) =====
   Один призовой опыт: колесо призов (SVG-иконки) — деньги, билеты, скидки на
   тариф, сам тариф, проверки видео, услуги OKO и бусты.
   • 1 бесплатная крутка в день (подарок — каждый сектор в плюс).
   • Платные крутки: пользователь выбирает ставку (100/300/1000 ₽ или билеты) —
     чем крупнее ставка, тем богаче пул. Каждая крутка ГАРАНТИРОВАННО даёт приз
     (нет «сгораний»). EV прозрачен — средний приз показан заранее.
   Никакого денежного гэмблинга (множителей ×N на ставку) — только фикс-призы.
   Списание — walletCharge, начисление — walletAdd, доход OKO — okoEarn.
   Всё оборачивается в function-declaration/патчи; каждый доступ к DOM защищён. */

/* ---------- SVG-иконки модуля (штрих 7, скруглённые концы) ---------- */
(function gmIcons(){
  const defs = document.querySelector('svg defs');
  if(!defs) return;
  const mk = (id, inner)=>{
    if(defs.querySelector('#'+id)) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id', id); s.setAttribute('viewBox','0 0 100 100');
    s.innerHTML = inner; defs.appendChild(s);
  };
  /* подарок с лентой */
  mk('i-gm-gift','<path d="M20 46v34a8 8 0 008 8h44a8 8 0 008-8V46" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><rect x="14" y="30" width="72" height="16" rx="5" fill="none" stroke="currentColor" stroke-width="7"/><path d="M50 30v58" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M50 30C39 30 30 22 32 13c9-2 16 7 18 17zM50 30c11 0 20-8 18-17-9-2-16 7-18 17z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>');
  /* кубок чемпиона */
  mk('i-gm-cup','<path d="M32 14h36v24a18 18 0 01-36 0z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M32 22H17a15 15 0 0015 17M68 22h15a15 15 0 01-15 17" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M50 56v14M38 84h24M43 70h14" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
  /* билет (внутренняя валюта) с перфорацией */
  mk('i-gm-ticket','<path d="M20 32h60a6 6 0 016 6v8a7.5 7.5 0 000 15v8a6 6 0 01-6 6H20a6 6 0 01-6-6v-8a7.5 7.5 0 000-15v-8a6 6 0 016-6z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M66 36v7M66 57v7" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
  /* процент (скидка на тариф) */
  mk('i-gm-pct','<circle cx="31" cy="31" r="10" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="69" cy="69" r="10" fill="none" stroke="currentColor" stroke-width="7"/><path d="M78 22 22 78" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
  /* буст (двойная стрелка вверх) */
  mk('i-gm-boost','<path d="M26 52l24-24 24 24M26 74l24-24 24 24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>');
  /* проверка видео (экран + галочка) */
  mk('i-gm-checkvid','<rect x="14" y="22" width="72" height="56" rx="12" fill="none" stroke="currentColor" stroke-width="7"/><path d="M34 50l10 11 22-24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>');
  /* пламя (серия визитов / стрик) */
  mk('i-gm-flame','<path d="M53 12c2 16 18 21 18 39a21 21 0 01-42 0c0-9 5-14 5-14-11 4-18 15-18 27a34 34 0 0068 0c0-26-24-36-31-52z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M50 84a13 13 0 01-8-23c1 8 7 9 8 15 4-3 4-7 3-11 6 2 10 8 10 14a13 13 0 01-13 5z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>');
  /* весы честности (таблица шансов) */
  mk('i-gm-scales','<path d="M50 16v66M30 82h40" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M24 28h52" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M24 28 12 54a13 13 0 0024 0zM76 28 64 54a13 13 0 0024 0z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>');
})();

/* ---------- общее состояние + хелперы ---------- */
function gmUpdateBalance(){
  const el = document.getElementById('gmBalance');
  if(el) el.textContent = fmtMoney(WALLET.balance);
}
function gmPluralTk(n){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return 'билетов';
  if(b > 1 && b < 5) return 'билета';
  if(b === 1) return 'билет';
  return 'билетов';
}
function gmPluralCheck(n){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return 'проверок';
  if(b > 1 && b < 5) return 'проверки';
  if(b === 1) return 'проверка';
  return 'проверок';
}
function gmPluralPrize(n){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return 'призов';
  if(b > 1 && b < 5) return 'приза';
  if(b === 1) return 'приз';
  return 'призов';
}

/* услуги OKO — призы-купоны (код в «Мои призы») */
const GM_SERVICES = {
  promo:    {s:'Промо',    label:'Промо-пост в ленте OKO',        ic:'megaphone'},
  listing:  {s:'Буст',     label:'Буст объявления · 3 дня',        ic:'rocket'},
  priority: {s:'Топ',      label:'Приоритет в ленте · 7 дней',     ic:'fire'},
  campaign: {s:'Кампания', label:'Рекламная кампания OKO',         ic:'megaphone'}
};

/* ============================================================
   ПРИЗОВОЙ ПУЛ: билеты (валюта), проверки видео, бусты, сундук призов
   ============================================================ */

/* ---------- билеты: внутренняя валюта круток ---------- */
let GM_TICKETS = (()=>{ try{ return Math.max(0, parseInt(localStorage.getItem('oko-games-tickets'),10) || 0); }catch(e){ return 0; } })();
function gmTicketsSave(){ try{ localStorage.setItem('oko-games-tickets', String(GM_TICKETS)); }catch(e){} }
function gmTicketsRender(){
  document.querySelectorAll('.gm-tk-val').forEach(e=>{ e.textContent = GM_TICKETS; });
}
function gmTicketsAdd(n){
  if(n <= 0) return;
  GM_TICKETS += n; gmTicketsSave(); gmTicketsRender();
}
function gmTicketsSpend(n){
  if(GM_TICKETS < n) return false;
  GM_TICKETS -= n; gmTicketsSave(); gmTicketsRender();
  return true;
}

/* ---------- бонусные проверки видео ---------- */
function gmChecksGet(){ try{ return Math.max(0, parseInt(localStorage.getItem('oko-games-checks'),10) || 0); }catch(e){ return 0; } }
function gmChecksAdd(n){ try{ localStorage.setItem('oko-games-checks', String(gmChecksGet() + n)); }catch(e){} }
/* другим модулям (напр. paywall) — сколько бонусных проверок доступно */
window.okoBonusChecks = gmChecksGet;

/* ---------- буст: ×множитель к следующему ДЕНЕЖНОМУ призу ---------- */
function gmBoostGet(){ try{ return parseInt(localStorage.getItem('oko-games-boost'),10) || 0; }catch(e){ return 0; } }
function gmBoostSet(v){ try{ if(v > 1) localStorage.setItem('oko-games-boost', String(v)); else localStorage.removeItem('oko-games-boost'); }catch(e){} gmBoostBadge(); }
function gmBoostBadge(){
  const el = document.getElementById('gmBoostBadge');
  if(!el) return;
  const b = gmBoostGet();
  if(b > 1){
    el.style.display = '';
    el.innerHTML = `${I('gm-boost')}<span>Активен буст <b>×${b}</b> — умножит следующий денежный приз в рулетке</span>`;
  }else{
    el.style.display = 'none';
    el.innerHTML = '';
  }
}
/* применить (и погасить) буст к денежному призу; вернуть итоговую выплату */
function gmApplyBoost(base){
  const b = gmBoostGet();
  if(b > 1 && base > 0){
    gmBoostSet(0);
    gmPrizeUse2('boost'); /* пометить первый активный буст использованным */
    const boosted = Math.round(base * b * 100) / 100;
    toast(`Буст ×${b} сработал: +${fmtMoney(boosted - base)}`);
    return boosted;
  }
  return base;
}

/* ---------- сундук призов (персист 'oko-games-prizes') ---------- */
let GM_PRIZES = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-games-prizes')) || []; }catch(e){ return []; } })();
function gmPrizesSave(){ try{ localStorage.setItem('oko-games-prizes', JSON.stringify(GM_PRIZES.slice(0, 60))); }catch(e){} }
function gmMakeCode(){ return 'OKO-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function gmPrizeAdd(p){
  p.id = 'gp' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  p.at = Date.now();
  GM_PRIZES.unshift(p);
  gmPrizesSave();
  gmPrizesRender();
  gmPrizesBtnRender();
  return p;
}
function gmPrizeUse(id){
  const p = GM_PRIZES.find(x=>x.id === id);
  if(p && p.status === 'active'){ p.status = 'used'; gmPrizesSave(); gmPrizesRender(); gmPrizesBtnRender(); }
}
/* пометить первый активный приз данного типа использованным (для бустов) */
function gmPrizeUse2(type){
  const p = GM_PRIZES.find(x=>x.type === type && x.status === 'active');
  if(p){ p.status = 'used'; gmPrizesSave(); gmPrizesRender(); gmPrizesBtnRender(); }
}
/* лучшая активная скидка на тариф — подхватывается в оплате */
function gmActiveDiscount(){
  return GM_PRIZES.filter(p=>p.type === 'discount' && p.status === 'active')
                  .sort((a,b)=>b.val - a.val)[0] || null;
}
function gmPrizesActiveCount(){ return GM_PRIZES.filter(p=>p.status === 'active').length; }

/* ============================================================
   ПРИЗОВЫЕ ПУЛЫ — каждый ровно 12 секторов (30° на сектор)
   c — «редкость» (0..4) для палитры; s — короткая подпись сектора
   ============================================================ */
const GM_POOLS = {
  /* бесплатный подарок дня — каждый сектор в плюс */
  free: [
    {t:'money',   v:50,        w:220, c:0, s:'50 ₽'},
    {t:'ticket',  v:1,         w:190, c:1, s:'1 бил'},
    {t:'money',   v:100,       w:150, c:1, s:'100 ₽'},
    {t:'check',   v:1,         w:120, c:2, s:'1 пров'},
    {t:'disc',    v:10,        w:95,  c:2, s:'−10%'},
    {t:'ticket',  v:2,         w:80,  c:2, s:'2 бил'},
    {t:'money',   v:200,       w:55,  c:3, s:'200 ₽'},
    {t:'money',   v:300,       w:40,  c:3, s:'300 ₽'},
    {t:'disc',    v:20,        w:28,  c:3, s:'−20%'},
    {t:'ticket',  v:5,         w:14,  c:4, s:'5 бил'},
    {t:'service', v:'promo',   w:6,   c:4, s:'Промо'},
    {t:'tier',    v:'PRO',     w:2,   c:4, s:'PRO'}
  ],
  /* крутка за 100 ₽ */
  p100: [
    {t:'ticket',  v:2,         w:210, c:1, s:'2 бил'},
    {t:'money',   v:50,        w:200, c:1, s:'50 ₽'},
    {t:'money',   v:100,       w:150, c:1, s:'100 ₽'},
    {t:'check',   v:2,         w:110, c:2, s:'2 пров'},
    {t:'disc',    v:10,        w:95,  c:2, s:'−10%'},
    {t:'money',   v:200,       w:70,  c:2, s:'200 ₽'},
    {t:'boost',   v:2,         w:55,  c:3, s:'×2'},
    {t:'disc',    v:20,        w:40,  c:3, s:'−20%'},
    {t:'money',   v:500,       w:40,  c:3, s:'500 ₽'},
    {t:'ticket',  v:5,         w:20,  c:4, s:'5 бил'},
    {t:'service', v:'listing', w:8,   c:4, s:'Буст'},
    {t:'tier',    v:'PRO',     w:2,   c:4, s:'PRO'}
  ],
  /* крутка за 300 ₽ */
  p300: [
    {t:'money',   v:200,       w:200, c:1, s:'200 ₽'},
    {t:'ticket',  v:5,         w:170, c:1, s:'5 бил'},
    {t:'money',   v:300,       w:140, c:2, s:'300 ₽'},
    {t:'check',   v:3,         w:100, c:2, s:'3 пров'},
    {t:'disc',    v:20,        w:95,  c:2, s:'−20%'},
    {t:'money',   v:500,       w:70,  c:3, s:'500 ₽'},
    {t:'boost',   v:3,         w:55,  c:3, s:'×3'},
    {t:'disc',    v:30,        w:40,  c:3, s:'−30%'},
    {t:'money',   v:1000,      w:35,  c:4, s:'1000 ₽'},
    {t:'service', v:'priority',w:22,  c:4, s:'Топ'},
    {t:'tier',    v:'PRO',     w:15,  c:4, s:'PRO'},
    {t:'disc',    v:50,        w:8,   c:4, s:'−50%'}
  ],
  /* крутка за 1000 ₽ */
  p1000: [
    {t:'money',   v:500,       w:190, c:1, s:'500 ₽'},
    {t:'ticket',  v:10,        w:150, c:1, s:'10 бил'},
    {t:'money',   v:1000,      w:130, c:2, s:'1000 ₽'},
    {t:'disc',    v:30,        w:95,  c:2, s:'−30%'},
    {t:'check',   v:5,         w:85,  c:2, s:'5 пров'},
    {t:'boost',   v:5,         w:60,  c:3, s:'×5'},
    {t:'money',   v:2000,      w:55,  c:3, s:'2000 ₽'},
    {t:'disc',    v:50,        w:45,  c:3, s:'−50%'},
    {t:'service', v:'campaign',w:40,  c:4, s:'Кампания'},
    {t:'tier',    v:'PRO',     w:30,  c:4, s:'PRO'},
    {t:'tier',    v:'BUSINESS',w:12,  c:4, s:'BIZ'},
    {t:'money',   v:5000,      w:8,   c:4, s:'5000 ₽'}
  ]
};
const GM_STAKES = {
  p100:  {cost:100,  tk:1},
  p300:  {cost:300,  tk:3},
  p1000: {cost:1000, tk:10}
};

/* палитра секторов по «редкости», зависит от темы: [фон, подпись] */
const GM_POOL_COLS_DARK = [
  ['#16220b','#a9c47f'], ['#20340a','#c9ff70'], ['#33520a','#e4ffbf'], ['#5f9c0d','#0c1400'], ['#9AFF00','#0a1400']
];
/* светлая тема: секторы углублены, чтобы колесо не «выцветало» на почти-белом столе, при этом подписи тёмные и читаемые */
const GM_POOL_COLS_LIGHT = [
  ['#cfe39a','#2c4708'], ['#b2d76e','#22400a'], ['#8fc23a','#15330a'], ['#6bac16','#0c2000'], ['#9AFF00','#0a1400']
];
function gmIsLight(){ return document.documentElement.dataset.theme === 'light'; }
function gmPoolCols(){ return gmIsLight() ? GM_POOL_COLS_LIGHT : GM_POOL_COLS_DARK; }

/* номинальная ₽-ценность приза — для прозрачного EV и таблицы лидеров */
function gmNominal(p){
  switch(p.t){
    case 'money':   return p.v;
    case 'ticket':  return p.v * 50;
    case 'check':   return p.v * 100;
    case 'disc':    return ({10:200, 20:450, 30:800, 50:1600})[p.v] || p.v * 20;
    case 'boost':   return ({2:120, 3:220, 5:400})[p.v] || 100;
    case 'tier':    return ({PRO:990, BUSINESS:2490})[p.v] || 990;
    case 'service': return ({promo:300, listing:450, priority:700, campaign:1600})[p.v] || 400;
  }
  return 0;
}
function gmPrizeIcon(p){
  switch(p.t){
    case 'money':   return 'money';
    case 'ticket':  return 'gm-ticket';
    case 'check':   return 'gm-checkvid';
    case 'disc':    return 'gm-pct';
    case 'boost':   return 'gm-boost';
    case 'tier':    return 'crown';
    case 'service': return (GM_SERVICES[p.v] || {}).ic || 'gm-gift';
  }
  return 'gm-gift';
}

/* ============================================================
   БЕСПЛАТНАЯ ЕЖЕДНЕВНАЯ КРУТКА — таймер до полуночи
   ============================================================ */
function gmBonusStamp(){ try{ return Number(localStorage.getItem('oko-games-bonus')) || 0; }catch(e){ return 0; } }
function gmBonusClaimedToday(){
  const ts = gmBonusStamp();
  if(!ts) return false;
  const a = new Date(ts), b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function gmBonusLeftMs(){
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1) - n;
}
function gmFmtCd(ms){
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = n => String(n).padStart(2, '0');
  return p(Math.floor(s/3600)) + ':' + p(Math.floor(s%3600/60)) + ':' + p(s%60);
}

/* ============================================================
   СЕРИЯ ВИЗИТОВ (СТРИК) — заходи каждый день, копи серию, получай билеты.
   Хранение 'oko-games-streak' = {n:серия, d:индекс_дня_последней_крутки}.
   Ретеншн-петля: пропуск дня обнуляет серию; вехи 3/7/14/30 дней дают бонус-билеты.
   ============================================================ */
const GM_STREAK_MILE = {3:1, 7:3, 14:6, 30:15}; /* веха(дней): бонус(билетов) */
function gmDayIdx(ts){ const d = ts ? new Date(ts) : new Date(); return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5); }
function gmStreakGet(){ try{ return JSON.parse(localStorage.getItem('oko-games-streak')) || {n:0, d:null}; }catch(e){ return {n:0, d:null}; } }
function gmStreakSave(s){ try{ localStorage.setItem('oko-games-streak', JSON.stringify(s)); }catch(e){} }
/* «живая» серия для показа: если последняя крутка сегодня или вчера — серия ещё жива */
function gmStreakDisplay(){
  const s = gmStreakGet(), t = gmDayIdx();
  return (s.d === t || s.d === t - 1) ? (s.n || 0) : 0;
}
function gmPluralDay(n){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return 'дней';
  if(b > 1 && b < 5) return 'дня';
  if(b === 1) return 'день';
  return 'дней';
}
/* засчитать сегодняшнюю активность в серию (зовётся при БЕСПЛАТНОЙ крутке дня) */
function gmStreakBump(){
  const s = gmStreakGet(), t = gmDayIdx();
  if(s.d === t) return s;                       /* уже засчитано сегодня */
  if(s.d === t - 1) s.n = (s.n || 0) + 1;       /* заходил вчера — серия растёт */
  else s.n = 1;                                 /* был пропуск — серия с начала */
  s.d = t;
  gmStreakSave(s);
  const bonus = GM_STREAK_MILE[s.n] || (s.n > 30 && s.n % 7 === 0 ? 5 : 0);
  if(bonus){
    gmTicketsAdd(bonus);
    toast(`Серия ${s.n} ${gmPluralDay(s.n)}! Бонус +${bonus} ${gmPluralTk(bonus)}`);
  }
  gmStreakRender();
  return s;
}
function gmStreakRender(){
  const el = document.getElementById('gmStreakChip');
  if(!el) return;
  const n = gmStreakDisplay();
  if(n > 0){
    el.style.display = '';
    el.classList.toggle('lit', gmBonusClaimedToday());
    const v = el.querySelector('.gm-streak-n');
    if(v) v.textContent = n;
    el.setAttribute('title', `Серия ${n} ${gmPluralDay(n)} подряд — заходи каждый день за бонусными билетами`);
  }else{
    el.style.display = 'none';
  }
}
/* контекстная подсказка серии в блоке бесплатной крутки */
function gmStreakNote(){
  const n = gmStreakDisplay();
  if(n <= 0){
    return `<div class="gm-streak-note">${I('gm-flame')}<span>Заходи каждый день — собери серию и получай бонусные билеты</span></div>`;
  }
  const next = [3, 7, 14, 30].find(m => m > n);
  const tail = next
    ? `ещё ${next - n} ${gmPluralDay(next - n)} до бонуса +${GM_STREAK_MILE[next]} ${gmPluralTk(GM_STREAK_MILE[next])}`
    : 'ты в ударе — серия максимальная';
  return `<div class="gm-streak-note lit">${I('gm-flame')}<span>Серия <b>${n}</b> ${gmPluralDay(n)} · ${tail}</span></div>`;
}

/* ============================================================
   КОЛЕСО — построение, режимы, кручение, выдача приза
   ============================================================ */
let gmMode = 'free';                 /* free | p100 | p300 | p1000 */
let gmSpinning = false;
let gmSpinToken = 0;
let gmWheelAngle = 0;
let gmPaidCost = 0;

function gmCurrentPool(){ return GM_POOLS[gmMode] || GM_POOLS.free; }

function gmSecLabel(p){
  return `${I(gmPrizeIcon(p))}<b>${p.s}</b>`;
}
function gmBuildWheel(){
  const w = document.getElementById('gmWheel');
  if(!w) return;
  const pool = gmCurrentPool(), C = gmPoolCols();
  const N = pool.length, seg = 360 / N;
  const stops = pool.map((p,i)=>`${C[p.c][0]} ${i*seg}deg ${(i+1)*seg}deg`).join(',');
  w.style.background = `conic-gradient(from -${seg/2}deg, ${stops})`;
  w.innerHTML = pool.map((p,i)=>
    `<span class="gm-sec" style="color:${C[p.c][1]};transform:translate(-50%,-50%) rotate(${i*seg}deg) translateY(-90px)">${gmSecLabel(p)}</span>`
  ).join('');
}
function gmSetResult(html){
  const el = document.getElementById('gmWheelResult');
  if(el) el.innerHTML = html;
}

/* --- режимы (пилюли ставок + EV + кнопка запуска) --- */
function gmModeSub(m){
  if(m === 'free') return gmBonusClaimedToday() ? 'через ' + gmFmtCd(gmBonusLeftMs()) : 'подарок дня';
  return 'призы крупнее';
}
function gmEvText(m){
  const pool = GM_POOLS[m], tot = pool.reduce((a,p)=>a + p.w, 0);
  const avg = Math.round(pool.reduce((a,p)=>a + p.w * gmNominal(p), 0) / tot);
  const tierW = pool.filter(p=>p.t === 'tier').reduce((a,p)=>a + p.w, 0);
  const pct = Math.round(tierW / tot * 1000) / 10;
  if(m === 'free') return `Подарок дня — каждый сектор в плюс, деньги сразу на кошелёк. Средний приз ≈ ${fmtMoney(avg)}`;
  return `Средний приз ≈ ${fmtMoney(avg)} · приз гарантирован каждую крутку · шанс тарифа ${String(pct).replace('.', ',')}%`;
}
function gmRenderModes(){
  const el = document.getElementById('gmModes');
  if(!el) return;
  const order = ['free','p100','p300','p1000'];
  const label = {free:'Бесплатно', p100:'100 ₽', p300:'300 ₽', p1000:'1000 ₽'};
  const pills = order.map(m=>{
    const on = m === gmMode;
    const claimed = m === 'free' && gmBonusClaimedToday();
    return `<button class="gm-mpill ${on ? 'on' : ''} ${claimed ? 'claimed' : ''}" ${gmSpinning ? 'disabled' : ''} onclick="gmSelectMode('${m}')">
      <span class="gm-mpill-ic">${I(m === 'free' ? 'gm-gift' : 'money')}</span>
      <b>${label[m]}</b>
      <small ${claimed ? 'id="gmFreeCd"' : ''}>${gmModeSub(m)}</small>
    </button>`;
  }).join('');

  let action = '';
  if(gmMode === 'free'){
    const claimed = gmBonusClaimedToday();
    action = `<button class="gm-spin ${claimed || gmSpinning ? 'off' : ''}" onclick="gmDoSpin(false)">${I('gm-gift')}${
      claimed ? `<span class="gm-spin-cd">Бесплатно через <b id="gmFreeCd2">${gmFmtCd(gmBonusLeftMs())}</b></span>` : 'Крутить бесплатно'
    }</button>` + gmStreakNote();
  }else{
    const st = GM_STAKES[gmMode], canTk = GM_TICKETS >= st.tk;
    action = `<div class="gm-spin-row">
      <button class="gm-spin ${gmSpinning ? 'off' : ''}" onclick="gmDoSpin(false)">${I('bolt')}Крутить · ${fmtMoney(st.cost)}</button>
      <button class="gm-spin ghost ${canTk && !gmSpinning ? '' : 'off'}" onclick="gmDoSpin(true)">${I('gm-ticket')}${st.tk} ${gmPluralTk(st.tk)}</button>
    </div>`;
  }
  el.innerHTML = `
    <div class="gm-mode-pills">${pills}</div>
    <div class="gm-ev" id="gmEv">${gmEvText(gmMode)}</div>
    ${action}`;
}
function gmSelectMode(m){
  if(gmSpinning || !GM_POOLS[m]) return;
  gmMode = m;
  gmBuildWheel();
  gmRenderModes();
}

/* --- запуск крутки --- */
function gmDoSpin(payTicket){
  if(gmSpinning){ toast('Колесо ещё крутится'); return; }
  const m = gmMode;
  if(m === 'free'){
    if(gmBonusClaimedToday()){ toast('Бесплатная крутка сегодня уже была — выбери платную ставку'); return; }
    gmPaidCost = 0;
  }else{
    const st = GM_STAKES[m];
    if(payTicket){
      if(!gmTicketsSpend(st.tk)){ toast(`Нужно ${st.tk} ${gmPluralTk(st.tk)} — заработай их в рулетке`); return; }
      gmPaidCost = 0;
    }else{
      if(!walletCharge(st.cost, 'Крутка рулетки OKO')) return;
      gmPaidCost = st.cost;
      gmUpdateBalance();
    }
  }
  gmSpinRun(m, !!payTicket);
}
function gmSpinRun(mode, payTicket){
  gmSpinning = true;
  const token = ++gmSpinToken;
  gmRenderModes(); /* заблокировать пилюли/кнопки на время раунда */
  gmSetResult(`<span class="gm-run">Колесо крутится…</span>`);
  const rev = document.getElementById('gmReveal');
  if(rev){ rev.className = 'gm-reveal'; rev.innerHTML = ''; }

  const pool = gmCurrentPool();
  const total = pool.reduce((a,p)=>a + p.w, 0);
  let r = Math.random() * total, idx = 0;
  for(let i = 0; i < pool.length; i++){ if(r < pool[i].w){ idx = i; break; } r -= pool[i].w; }
  const seg = 360 / pool.length;

  const wheel = document.getElementById('gmWheel');
  if(!wheel){ gmSpinning = false; gmGrant(pool[idx], mode, payTicket); return; }
  const cur = ((gmWheelAngle % 360) + 360) % 360;
  wheel.style.transition = 'none';
  wheel.style.transform = `rotate(${cur}deg)`;
  void wheel.offsetWidth; /* форс-рефлоу перед новым переходом */

  /* стрелка «щёлкает» по секторам, пока колесо крутится */
  const ptr = document.querySelector('#screen-games .gm-pointer');
  if(ptr) ptr.classList.add('ticking');

  const turns = 6 + Math.floor(Math.random() * 3);
  const jitter = Math.random() * (seg * 0.44) - seg * 0.22; /* внутри сектора, с запасом от границ */
  const delta = ((360 - idx * seg) - cur + 720) % 360;
  const target = cur + turns * 360 + delta + jitter;
  gmWheelAngle = target;
  /* длинный инерционный хвост: быстрый старт, долгое мягкое торможение */
  wheel.style.transition = 'transform 6.4s cubic-bezier(0.16,0.84,0.16,1)';
  wheel.style.transform = `rotate(${target}deg)`;

  /* transitionend может потеряться (смена вкладки/reduced-motion) —
     страховочный таймер; token гарантирует ровно один вызов */
  const settle = ()=>{
    if(token !== gmSpinToken || !gmSpinning) return;
    gmSpinning = false;
    if(ptr) ptr.classList.remove('ticking');
    gmGrant(pool[idx], mode, payTicket);
  };
  wheel.addEventListener('transitionend', settle, {once:true});
  setTimeout(settle, 6700);
}
function gmPrizeSub(p){
  switch(p.t){
    case 'money':   return 'зачислено на кошелёк';
    case 'ticket':  return 'билеты — валюта круток';
    case 'check':   return 'бонусные проверки видео — в «Мои призы»';
    case 'disc':    return 'промокод в «Мои призы» — применится при оплате тарифа';
    case 'boost':   return 'умножит следующий денежный приз в рулетке';
    case 'tier':    return 'тариф активирован на месяц';
    case 'service': return 'услуга активна — код в «Мои призы»';
  }
  return '';
}
function gmGrant(p, mode, payTicket){
  if(mode === 'free'){ try{ localStorage.setItem('oko-games-bonus', String(Date.now())); }catch(e){} gmStreakBump(); }
  const icon = gmPrizeIcon(p);
  const rare = p.c >= 4; /* редчайший сектор — вау-момент «джекпот» */
  let title = '', prize = null;
  switch(p.t){
    case 'money':{
      const amt = gmApplyBoost(p.v);
      walletAdd(amt, 'Приз рулетки OKO');
      prize = {type:'money', val:amt, status:'done'};
      title = `+ ${fmtMoney(amt)}`; break;
    }
    case 'ticket':
      gmTicketsAdd(p.v); prize = {type:'ticket', val:p.v, status:'done'};
      title = `+ ${p.v} ${gmPluralTk(p.v)}`; break;
    case 'check':
      gmChecksAdd(p.v); prize = {type:'check', val:p.v, status:'active'};
      title = `+ ${p.v} ${gmPluralCheck(p.v)} видео`; break;
    case 'disc':
      prize = {type:'discount', val:p.v, code:gmMakeCode(), status:'active'};
      title = `Скидка −${p.v}% на тариф`; break;
    case 'boost':
      gmBoostSet(p.v); prize = {type:'boost', val:p.v, status:'active'};
      title = `Буст ×${p.v} к призу`; break;
    case 'tier':
      if(typeof PROFILE !== 'undefined'){ PROFILE.tier = p.v; if(typeof renderMyProfile === 'function') renderMyProfile(); }
      prize = {type:'tier', val:p.v, status:'active'};
      title = `Тариф ${p.v} на месяц`; break;
    case 'service':{
      const sv = GM_SERVICES[p.v] || {};
      prize = {type:'service', val:p.v, code:gmMakeCode(), status:'active'};
      title = sv.label || 'Услуга OKO'; break;
    }
  }
  /* доход OKO — маржа платной крутки (за вычетом денежного приза) */
  if(mode !== 'free' && !payTicket && gmPaidCost > 0){
    const moneyOut = p.t === 'money' ? prize.val : 0;
    const net = gmPaidCost - moneyOut;
    if(net > 0) okoEarn(net, 'Игры: рулетка OKO');
  }
  gmPrizeAdd(prize);
  gmPrizeReveal(icon, title, rare);
  gmConfetti(document.querySelector('.gm-wheel-card'), rare);
  if(rare) gmJackpot();
  gmSetResult(`<b class="gm-win">${title}</b><span>${gmPrizeSub(p)}</span>`);
  const val = gmNominal(p);
  if(val > 0) gmLbAddWin(val);

  /* бесплатная крутка израсходована — перевести выбор на платный пул */
  if(mode === 'free'){ gmMode = 'p100'; gmBuildWheel(); }
  gmRenderModes();
  gmPrizesBtnRender();
  gmUpdateBalance();
  gmTicketsRender();
  gmBoostBadge();
}

/* красивая анимация выпадения приза — карточка в центре колеса */
let gmRevHideT = 0;
function gmPrizeReveal(icon, title, rare){
  const rev = document.getElementById('gmReveal');
  if(!rev) return;
  rev.classList.toggle('rare', !!rare);
  rev.innerHTML = `
    <div class="gm-reveal-rays"></div>
    <div class="gm-reveal-card">
      ${rare ? `<span class="gm-reveal-tag">${I('gm-cup')}Редкий приз</span>` : ''}
      <span class="gm-reveal-ic">${I(icon)}</span>
      <b>${title}</b>
    </div>`;
  rev.classList.remove('show'); void rev.offsetWidth; rev.classList.add('show');
  /* лёгкая вибрация выигрыша на телефоне (звука нет); редкий приз — насыщеннее */
  try{ if(navigator.vibrate) navigator.vibrate(rare ? [18, 50, 22, 50, 40] : [12, 40, 22]); }catch(e){}
  /* показать праздник, затем плавно вернуть колесо готовым к следующей крутке */
  const tok = gmSpinToken;
  clearTimeout(gmRevHideT);
  gmRevHideT = setTimeout(()=>{
    if(tok !== gmSpinToken || gmSpinning) return; /* уже крутят снова — не мешаем */
    const r = document.getElementById('gmReveal');
    if(r) r.classList.remove('show');
  }, 3200);
}

/* лаймовое конфетти (rare — гуще и с золотыми искрами для джекпота) */
function gmConfetti(host, rare){
  if(!host) return;
  const box = document.createElement('div');
  box.className = 'gm-confetti' + (rare ? ' rare' : '');
  const cols = rare
    ? ['#9AFF00','#c9ff70','#eaffcc','#ffe873','#ffd23f','#ffffff']
    : ['#9AFF00','#c9ff70','#6fb50d','#eaffcc','#ffffff'];
  const N = rare ? 46 : 28;
  let h = '';
  for(let i=0;i<N;i++){
    h += `<i style="left:${(Math.random()*100).toFixed(1)}%;background:${cols[i%cols.length]};animation-delay:${(Math.random()*0.4).toFixed(2)}s;animation-duration:${(0.9+Math.random()*0.9).toFixed(2)}s"></i>`;
  }
  box.innerHTML = h;
  host.appendChild(box);
  setTimeout(()=>box.remove(), 2400);
}

/* джекпот — редкий приз: золотая вспышка стола + доп. вибрация */
function gmJackpot(){
  const card = document.querySelector('#screen-games .gm-wheel-card');
  if(!card) return;
  card.classList.remove('gm-jackpot'); void card.offsetWidth; card.classList.add('gm-jackpot');
  setTimeout(()=>card.classList.remove('gm-jackpot'), 1500);
}

/* ================= ТАБЛИЦА ЛИДЕРОВ НЕДЕЛИ =================
   Топ-10: мок-игроки + свой ник. Свои призы реально суммируются (номинал ₽)
   и двигают позицию. Персист под 'oko-games-lb', сброс каждую неделю. */
const GM_LB_NAMES = ['Марат К.','nastya.vibe','Кирилл Т.','ZONA_51','Полина М.','deniska_pro',
                     'Артём В.','lera.moon','Саид А.','mr_fortuna','Ольга Ж.','tigran.dice'];
let GM_LB = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-games-lb'))||null; }catch(e){ return null; } })();

function gmWeekKey(){
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - jan1) / 864e5 + jan1.getDay() + 1) / 7);
  return d.getFullYear() + '-W' + week;
}
function gmLbSave(){ try{ localStorage.setItem('oko-games-lb', JSON.stringify(GM_LB)); }catch(e){} }
function gmLbEnsure(){
  const wk = gmWeekKey();
  if(GM_LB && GM_LB.week === wk && Array.isArray(GM_LB.bots)) return;
  const pool = GM_LB_NAMES.slice();
  for(let i = pool.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  GM_LB = {
    week: wk, my: 0, myW: 0, move: null,
    bots: pool.slice(0,10).map(n=>({n, s: Math.round((300 + Math.random()*8200)/10)*10, w: 2 + Math.floor(Math.random()*34)}))
  };
  gmLbSave();
}
function gmLbRank(){
  gmLbEnsure();
  const rows = GM_LB.bots.map(b=>({n: b.n, s: b.s, w: b.w, me: false}));
  rows.push({n: PROFILE.name, s: Math.round(GM_LB.my*100)/100, w: GM_LB.myW, me: true});
  rows.sort((a,b)=>b.s - a.s);
  return rows;
}
function gmLbMyRank(){ return gmLbRank().findIndex(r=>r.me) + 1; }
function gmLbAddWin(sum){
  gmLbEnsure();
  const before = gmLbMyRank();
  GM_LB.my += sum;
  GM_LB.myW++;
  const after = gmLbMyRank();
  if(after < before){ GM_LB.move = 'up'; toast(`Лидеры недели: ты поднялся на ${after}-е место`); }
  else if(after > before) GM_LB.move = 'down';
  gmLbSave();
  gmLbRender();
}
/* «живая» таблица: при заходе на экран кто-то из мок-игроков иногда выигрывает */
function gmLbDrift(){
  gmLbEnsure();
  if(Math.random() < 0.45){
    const b = GM_LB.bots[Math.floor(Math.random() * GM_LB.bots.length)];
    b.s += Math.round((40 + Math.random()*550)/10)*10;
    b.w++;
    gmLbSave();
  }
}
function gmLbRow(r, pos){
  const mv = r.me && GM_LB.move ? `<svg class="i gm-lb-mv ${GM_LB.move}"><use href="#i-chev"/></svg>` : '';
  const posHtml = pos === 1 ? `<b class="gm-lb-pos p1">${I('gm-cup')}</b>` : `<b class="gm-lb-pos ${pos<=3?'p'+pos:''}">${pos}</b>`;
  return `<div class="gm-lb-row ${r.me ? 'me' : ''}">
    ${posHtml}
    <span class="gm-lb-ava">${esc((r.n[0]||'?').toUpperCase())}</span>
    <div class="gm-lb-b">
      <span class="gm-lb-n">${esc(r.n)}${r.me ? vBadge(r.n) : ''}${r.me ? '<i class="gm-lb-you">ты</i>' : ''}${mv}</span>
      <small>${r.w} ${gmPluralPrize(r.w)} за неделю</small>
    </div>
    <b class="gm-lb-sum">${fmtMoney(r.s)}</b>
  </div>`;
}
function gmLbRender(){
  const el = document.getElementById('gmLb');
  if(!el) return;
  const rows = gmLbRank();
  const myIdx = rows.findIndex(r=>r.me);
  const days = 7 - ((new Date().getDay() + 6) % 7);
  let html = `<div class="gm-lb-head"><span>${I('gm-cup')}Призы за эту неделю</span><small>сброс через ${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}</small></div>`;
  html += rows.slice(0, 10).map((r,i)=>gmLbRow(r, i+1)).join('');
  if(myIdx >= 10) html += `<div class="gm-lb-gap">···</div>` + gmLbRow(rows[myIdx], myIdx + 1);
  el.innerHTML = html;
}

/* ---------- баннер «Мои призы» ---------- */
function gmPrizesBtnRender(){
  const b = document.getElementById('gmPrizesBtn');
  if(b){
    const n = GM_PRIZES.length, act = gmPrizesActiveCount();
    b.innerHTML = `${I('gm-cup')}<div class="gm-bonus-t"><span>Мои призы</span><small>${n ? `${n} ${gmPluralPrize(n)} · ${act} к использованию` : 'ещё нет — крути рулетку'}</small></div>${I('chev','gm-bonus-chev')}`;
  }
  document.querySelectorAll('.gm-prizes-cnt').forEach(e=>{ e.textContent = GM_PRIZES.length; });
}

/* ---------- «Мои призы»: шит выпавших призов ---------- */
function gmPrizesOpen(){ openSheet('gmPrizes'); gmPrizesRender(); }
function gmPrizeRow(p){
  let ic = 'gm-gift', cat = 'Приз', title = '', extra = '', badge = '', bcls = 'active';
  switch(p.type){
    case 'money':  ic='money';       cat='Деньги';         title=`+ ${fmtMoney(p.val)}`;            badge='Начислено'; bcls='done'; break;
    case 'ticket': ic='gm-ticket';   cat='Билеты';         title=`+ ${p.val} ${gmPluralTk(p.val)}`; badge='Начислено'; bcls='done'; break;
    case 'check':  ic='gm-checkvid'; cat='Проверки видео'; title=`${p.val} ${gmPluralCheck(p.val)}`; badge=p.status==='used'?'Использовано':'Доступно'; bcls=p.status==='used'?'used':'active'; break;
    case 'discount':
      ic='gm-pct'; cat='Скидка на тариф'; title=`Скидка −${p.val}% на тариф`;
      if(p.status==='active'){ badge='Активна'; bcls='active'; extra=`<button class="gm-code" onclick="gmCopyCode('${p.code}')">${p.code}${I('copy')}</button>`; }
      else { badge='Использована'; bcls='used'; extra=`<span class="gm-code used">${p.code}</span>`; }
      break;
    case 'boost':  ic='gm-boost'; cat='Буст к призу'; title=`Буст ×${p.val} к призу`; badge=p.status==='used'?'Использован':'Активен'; bcls=p.status==='used'?'used':'active'; break;
    case 'tier':   ic='crown';    cat='Тариф на месяц'; title=`Тариф ${p.val} на месяц`; badge='Активен'; bcls='active'; break;
    case 'service':{
      const sv = GM_SERVICES[p.val] || {};
      ic = sv.ic || 'gm-gift'; cat = 'Услуга OKO'; title = sv.label || 'Услуга OKO';
      if(p.status==='active'){ badge='Активна'; bcls='active'; extra=`<button class="gm-code" onclick="gmCopyCode('${p.code}')">${p.code}${I('copy')}</button>`; }
      else { badge='Использована'; bcls='used'; extra=`<span class="gm-code used">${p.code}</span>`; }
      break;
    }
  }
  const d = new Date(p.at);
  const time = d.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}) + ' ' +
               d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
  return `<div class="gm-prize ${bcls}">
    <span class="gm-prize-ic p-${p.type}">${I(ic)}</span>
    <div class="gm-prize-b">
      <span class="gm-prize-t">${title}</span>
      <span class="gm-prize-s">${cat} · ${time}</span>
      ${extra}
    </div>
    <span class="gm-prize-badge b-${bcls}">${badge}</span>
  </div>`;
}
function gmPrizesRender(){
  const el = document.getElementById('gmPrizesBody');
  if(!el) return;
  const checks = gmChecksGet();
  const discs = GM_PRIZES.filter(p=>p.type === 'discount' && p.status === 'active').length;
  const head = `<div class="gm-prz-stats">
    <div class="gm-prz-stat"><span class="gm-prz-sic">${I('gm-ticket')}</span><b class="gm-tk-val">${GM_TICKETS}</b><small>${gmPluralTk(GM_TICKETS)}</small></div>
    <div class="gm-prz-stat"><span class="gm-prz-sic">${I('gm-checkvid')}</span><b>${checks}</b><small>проверок</small></div>
    <div class="gm-prz-stat"><span class="gm-prz-sic">${I('gm-pct')}</span><b>${discs}</b><small>скидок</small></div>
  </div>`;
  if(!GM_PRIZES.length){
    el.innerHTML = head +
      `<div class="gm-empty">${I('gm-gift')}<span>Призов пока нет — крути рулетку: выпадают билеты, скидки на тариф, проверки видео, услуги OKO, бусты и деньги</span></div>
       <button class="gm-spin" onclick="closeSheet();showTab('games')">${I('gm-gift')}К рулетке</button>`;
    return;
  }
  el.innerHTML = head + `<div class="gm-prz-list">${GM_PRIZES.map(gmPrizeRow).join('')}</div>`;
}
function gmCopyCode(code){
  const done = ()=>toast('Код ' + code + ' скопирован — вставь при оплате тарифа');
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(code).then(done, done); return; }
  }catch(e){}
  done();
}

/* ============================================================
   ТАБЛИЦА ШАНСОВ — честная механика: точный % каждого сектора по каждому пулу.
   Прозрачность уровня «provably fair»: игрок видит вероятности до крутки.
   ============================================================ */
let gmOddsMode = 'free';
function gmOddsOpen(){ gmOddsMode = (gmMode && GM_POOLS[gmMode]) ? gmMode : 'free'; openSheet('gmOdds'); gmOddsRender(); }
function gmOddsSetMode(m){ if(GM_POOLS[m]){ gmOddsMode = m; gmOddsRender(); } }
function gmOddsRender(){
  const el = document.getElementById('gmOddsBody');
  if(!el) return;
  const order = ['free','p100','p300','p1000'];
  const label = {free:'Бесплатно', p100:'100 ₽', p300:'300 ₽', p1000:'1000 ₽'};
  const pool = GM_POOLS[gmOddsMode] || GM_POOLS.free;
  const total = pool.reduce((a,p)=>a + p.w, 0);
  const avg = Math.round(pool.reduce((a,p)=>a + p.w * gmNominal(p), 0) / total);
  const C = gmPoolCols();

  const tabs = order.map(m=>
    `<button class="gm-odds-tab ${m === gmOddsMode ? 'on' : ''}" onclick="gmOddsSetMode('${m}')">${label[m]}</button>`
  ).join('');

  /* сортировка по убыванию шанса — самые частые сверху */
  const rows = pool.map((p,i)=>({p, pct: p.w / total * 100})).sort((a,b)=>b.pct - a.pct);
  const maxPct = rows[0].pct || 1;
  const body = rows.map(({p, pct})=>{
    const shown = pct >= 9.95 ? Math.round(pct) : Math.round(pct * 10) / 10;
    const txt = String(shown).replace('.', ',') + '%';
    return `<div class="gm-odds-row">
      <span class="gm-odds-ic" style="color:${C[p.c][1]};background:${C[p.c][0]}">${I(gmPrizeIcon(p))}</span>
      <div class="gm-odds-b">
        <span class="gm-odds-t">${p.s}</span>
        <span class="gm-odds-bar"><i style="width:${Math.max(4, pct / maxPct * 100).toFixed(1)}%"></i></span>
      </div>
      <b class="gm-odds-pct">${txt}</b>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="gm-odds-tabs">${tabs}</div>
    <div class="gm-odds-note">${I('gm-scales')}<span>${
      gmOddsMode === 'free'
        ? 'Подарок дня — каждый сектор в плюс. Шансы честные и неизменные.'
        : 'Приз гарантирован каждую крутку. Шансы фиксированы и не зависят от прошлых круток.'
    } Средний приз ≈ <b>${fmtMoney(avg)}</b>.</span></div>
    <div class="gm-odds-list">${body}</div>
    <div class="gm-odds-sum">Сумма всех шансов — 100%. Итог выбирается честным случайным числом на устройстве.</div>`;
}

/* живой обратный отсчёт до полуночи (пилюля + кнопка «Бесплатно») */
setInterval(()=>{
  if(!gmBonusClaimedToday()) return;
  const cd = gmFmtCd(gmBonusLeftMs());
  ['gmFreeCd','gmFreeCd2'].forEach(id=>{ const e = document.getElementById(id); if(e) e.textContent = cd; });
}, 1000);

/* ---------- патчи ядра (прежние версии сохранены и вызываются) ---------- */
const _prevWalletAddGm = walletAdd;
walletAdd = function(sum, why){
  _prevWalletAddGm(sum, why);
  gmUpdateBalance();
};
const _prevWalletChargeGm = walletCharge;
walletCharge = function(sum, why){
  const ok = _prevWalletChargeGm(sum, why);
  gmUpdateBalance();
  return ok;
};
/* пересобрать колесо под новую тему (палитра секторов задаётся из JS) */
if(typeof applyTheme === 'function'){
  const _prevApplyThemeGm = applyTheme;
  applyTheme = function(t){
    _prevApplyThemeGm(t);
    if(!gmSpinning) gmBuildWheel();
    if(document.getElementById('sheet-gmPrizes') && document.getElementById('sheet-gmPrizes').classList.contains('open')) gmPrizesRender();
  };
}

const _prevShowTabGm = showTab;
showTab = function(t){
  _prevShowTabGm(t);
  if(t === 'games'){
    gmUpdateBalance();
    gmLbDrift();      /* таблица лидеров живёт: мок-игроки тоже выигрывают */
    gmLbRender();
    gmPrizesBtnRender();
    gmTicketsRender();
    gmBoostBadge();
    gmStreakRender();
    if(!gmSpinning){
      if(gmMode === 'free' && gmBonusClaimedToday()) gmMode = 'p100';
      gmBuildWheel();
      gmRenderModes();
    }
  }
};

/* ---------- самоинициализация ---------- */
regTitle('games', 'Рулетка OKO');
addSvcTile({id:'games', label:'Рулетка OKO', ico:'gm-gift', first:true, onclick:()=>showTab('games')});
gmMode = gmBonusClaimedToday() ? 'p100' : 'free';
gmBuildWheel();
gmRenderModes();
gmLbEnsure();
gmLbRender();
gmPrizesBtnRender();
gmTicketsRender();
gmBoostBadge();
gmStreakRender();
gmUpdateBalance();

/* ---------- подхват призовой скидки в оплате тарифа ----------
   paywall грузится ПОСЛЕ games и полностью заменяет renderPay (pwRenderPay),
   поэтому оборачиваем ИТОГОВЫЙ renderPay/doPay отложенно (после всех модулей). */
function gmApplyDiscountToPay(){
  const view = document.getElementById('payView');
  if(!view) return;
  const old = view.querySelector('.gm-pay-promo');
  if(old) old.remove();
  const d = gmActiveDiscount();
  if(!d) return;
  const sumEl = view.querySelector('.pay-sum');
  if(!sumEl) return;
  const base = parseInt(sumEl.textContent.replace(/[^\d]/g, ''), 10) || 0;
  const now = Math.round(base * (1 - d.val / 100));
  const fmt = (typeof fmtRub === 'function') ? fmtRub : fmtMoney;
  sumEl.textContent = fmt(now);
  const btn = Array.from(view.querySelectorAll('button.btn, button')).find(b=>/Оплатить/.test(b.textContent));
  if(btn) btn.innerHTML = I('lock') + ' Оплатить ' + fmt(now);
  const total = view.querySelector('.pay-total');
  if(total && total.parentNode){
    const badge = document.createElement('div');
    badge.className = 'gm-pay-promo';
    badge.innerHTML = `${I('gm-pct')}<span>Промокод из рулетки <b>${d.code}</b> · дополнительно −${d.val}%</span>`;
    total.parentNode.insertBefore(badge, total);
  }
}
setTimeout(function gmPatchPay(){
  if(typeof renderPay === 'function'){
    const _prevRenderPayGm = renderPay;
    renderPay = function(){ _prevRenderPayGm.apply(this, arguments); gmApplyDiscountToPay(); };
  }
  if(typeof doPay === 'function'){
    const _prevDoPayGm = doPay;
    doPay = function(){
      const d = gmActiveDiscount();
      _prevDoPayGm.apply(this, arguments);
      if(d) gmPrizeUse(d.id); /* скидка израсходована на покупку */
    };
  }
}, 0);
