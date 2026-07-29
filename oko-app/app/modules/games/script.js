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
  /* тайный сундук (mystery box — loot crate) */
  mk('i-gm-mbox','<rect x="14" y="30" width="72" height="56" rx="6" fill="none" stroke="currentColor" stroke-width="7"/><rect x="10" y="22" width="80" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="7"/><path d="M50 30v56" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="52" r="6" fill="none" stroke="currentColor" stroke-width="6"/><path d="M50 22c-6-10 6-12 6-4 0-6 12-4 6 4M50 22c6-10-6-12-6-4 0-6-12-4-6 4" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>');
  /* медаль-звезда (достижения) */
  mk('i-gm-medal','<path d="M28 10h44l-8 30H36z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="62" r="24" fill="none" stroke="currentColor" stroke-width="7"/><path d="M50 50l4 10 10 1-8 7 3 10-9-6-9 6 3-10-8-7 10-1z" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>');
  /* календарь стрика */
  mk('i-gm-cal','<rect x="14" y="22" width="72" height="64" rx="6" fill="none" stroke="currentColor" stroke-width="7"/><path d="M14 40h72M32 12v18M68 12v18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
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
  /* веха 7 дней — +2 бесплатных крутки в копилке */
  if(s.n === 7){
    gmExtraFreeSet(gmExtraFreeGet() + 2);
    gmAchUnlock('streak7');
    toast('Серия 7 дней подряд · +2 бесплатных крутки в копилке');
  }
  /* прочие вехи — бонусные билеты */
  const bonus = GM_STREAK_MILE[s.n] || (s.n > 30 && s.n % 7 === 0 ? 5 : 0);
  if(bonus){
    gmTicketsAdd(bonus);
    toast(`Серия ${s.n} ${gmPluralDay(s.n)}! Бонус +${bonus} ${gmPluralTk(bonus)}`);
  }
  gmStreakRender();
  return s;
}
/* календарь последних 7 дней — активные дни закрашены как «сделано» */
function gmStreakCalendar(){
  const s = gmStreakGet(), today = gmDayIdx();
  const now = new Date();
  const names = ['вс','пн','вт','ср','чт','пт','сб'];
  const out = [];
  for(let i = 6; i >= 0; i--){
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayIdx = today - i;
    const active = s.d !== null && s.d !== undefined && dayIdx <= s.d && dayIdx > s.d - (s.n || 0);
    out.push({name: names[dt.getDay()], num: dt.getDate(), done: active, isToday: i === 0});
  }
  return out;
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
/* контекстная подсказка серии + календарь последних 7 дней (Duolingo-style) */
function gmStreakNote(){
  const n = gmStreakDisplay();
  const cal = gmStreakCalendar();
  const cells = cal.map(c=>
    `<div class="gm-cal-cell ${c.done ? 'done' : ''} ${c.isToday ? 'today' : ''}">
      <span class="gm-cal-day">${c.name}</span>
      <span class="gm-cal-dot">${c.done ? I('gm-flame') : c.num}</span>
    </div>`
  ).join('');

  const extra = gmExtraFreeGet();
  let msg;
  if(extra > 0){
    msg = `Бесплатных круток в копилке · <b>${extra}</b>. Жми «Крутить бесплатно»`;
  }else if(n <= 0){
    msg = 'Заходи каждый день · через 7 дней подряд открой +2 бесплатных крутки';
  }else{
    const milestones = [3, 7, 14, 30];
    const next = milestones.find(m => m > n) || (n + (7 - n % 7));
    const reward = next === 7 ? '+2 бесплатных крутки' : `+${GM_STREAK_MILE[next] || 5} ${gmPluralTk(GM_STREAK_MILE[next] || 5)}`;
    msg = `Серия <b>${n}</b> ${gmPluralDay(n)} · ещё ${next - n} ${gmPluralDay(next - n)} до ${reward}`;
  }

  return `<div class="gm-streak-block ${n > 0 ? 'lit' : ''}">
    <div class="gm-cal">${cells}</div>
    <div class="gm-cal-msg">${I('gm-flame')}<span>${msg}</span></div>
  </div>`;
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
    const canFree = gmCanFree();
    const extra = gmExtraFreeGet();
    const claimedNoStash = gmBonusClaimedToday() && extra <= 0;
    let label;
    if(!canFree){
      label = `<span class="gm-spin-cd">Бесплатно через <b id="gmFreeCd2">${gmFmtCd(gmBonusLeftMs())}</b></span>`;
    }else if(extra > 0 && gmBonusClaimedToday()){
      label = `Крутить бесплатно · копилка <b>${extra}</b>`;
    }else{
      label = 'Крутить бесплатно';
    }
    action = `<button class="gm-spin ${claimedNoStash || gmSpinning ? 'off' : ''}" onclick="gmDoSpin(false)">${I('gm-gift')}${label}</button>` + gmStreakNote();
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
    ${gmWheelTeaserHtml()}
    ${action}
    ${gmMBProgressHtml()}`;
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
    /* если дневной подарок уже сорван — снимаем из копилки бесплатных круток от стрика */
    if(gmBonusClaimedToday()){
      if(!gmExtraFreeUse()){
        toast('Бесплатная крутка сегодня уже была — выбери платную ставку');
        return;
      }
    }
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
  /* бесплатный дневной подарок засчитываем ТОЛЬКО если это была реальная дневная крутка,
     а не расход из копилки от стрика (которая должна быть сверх лимита) */
  if(mode === 'free' && !gmBonusClaimedToday()){
    try{ localStorage.setItem('oko-games-bonus', String(Date.now())); }catch(e){}
    gmStreakBump();
  }
  /* общая статистика круток — для Mystery Box, ретеншена и достижений */
  gmSetLastSpin();
  const total = gmSpinTotalInc();
  gmMBSet(gmMBCount() + 1);
  if(total === 1) gmAchUnlock('first');
  if(total >= 10) gmAchUnlock('ten');
  if(total >= 50) gmAchUnlock('fifty');
  const icon = gmPrizeIcon(p);
  const rare = p.c >= 4; /* редчайший сектор — вау-момент «джекпот» */
  if(rare) gmAchUnlock('jackpot');
  if(p.t === 'tier') gmAchUnlock('tier');
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

  /* бесплатная крутка израсходована — перевести выбор на платный пул,
     если больше нет доступной бесплатной крутки (ни дневной, ни из копилки) */
  if(mode === 'free' && !gmCanFree()){ gmMode = 'p100'; gmBuildWheel(); }
  gmRenderModes();
  gmPrizesBtnRender();
  gmUpdateBalance();
  gmTicketsRender();
  gmBoostBadge();
  gmAchRender();
  /* MYSTERY BOX — 20 круток подряд открывают тайный сундук с гарантированно крупным призом */
  if(gmMBCount() >= GM_MB_STEP){
    gmMBSet(0);
    setTimeout(gmMBAward, 900); /* даём отыграть основной ревил */
  }
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
  if(GM_LB.my >= 5000 && typeof gmAchUnlock === 'function') gmAchUnlock('rich');
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

/* ============================================================
   БЕСПЛАТНЫЕ КРУТКИ В КОПИЛКЕ (стрик 7 дней = +2 бесплатных крутки)
   ============================================================ */
function gmExtraFreeGet(){ try{ return Math.max(0, parseInt(localStorage.getItem('oko-games-extrafree'),10) || 0); }catch(e){ return 0; } }
function gmExtraFreeSet(n){
  try{
    if(n > 0) localStorage.setItem('oko-games-extrafree', String(n));
    else localStorage.removeItem('oko-games-extrafree');
  }catch(e){}
}
function gmExtraFreeUse(){
  const n = gmExtraFreeGet();
  if(n <= 0) return false;
  gmExtraFreeSet(n - 1);
  return true;
}
function gmCanFree(){ return !gmBonusClaimedToday() || gmExtraFreeGet() > 0; }

/* ============================================================
   СТАТИСТИКА КРУТОК — для Mystery Box, ретеншена, достижений
   ============================================================ */
function gmSpinTotal(){ try{ return Math.max(0, parseInt(localStorage.getItem('oko-games-spins-total'),10) || 0); }catch(e){ return 0; } }
function gmSpinTotalInc(){
  const n = gmSpinTotal() + 1;
  try{ localStorage.setItem('oko-games-spins-total', String(n)); }catch(e){}
  return n;
}
function gmLastSpin(){ try{ return parseInt(localStorage.getItem('oko-games-lastspin'),10) || 0; }catch(e){ return 0; } }
function gmSetLastSpin(){ try{ localStorage.setItem('oko-games-lastspin', String(Date.now())); }catch(e){} }

/* ============================================================
   MYSTERY BOX — особый приз каждые 20 круток (loot crate)
   Пул только премиум-призов, гарантированно крупнее среднего.
   ============================================================ */
const GM_MB_STEP = 20;
const GM_MB_POOL = [
  {t:'ticket',  v:10,          w:200},
  {t:'check',   v:5,           w:170},
  {t:'disc',    v:30,          w:130},
  {t:'ticket',  v:20,          w:110},
  {t:'boost',   v:5,           w:90},
  {t:'service', v:'priority',  w:75},
  {t:'disc',    v:50,          w:55},
  {t:'tier',    v:'PRO',       w:45},
  {t:'service', v:'campaign',  w:35}
];
function gmMBCount(){ try{ return Math.max(0, parseInt(localStorage.getItem('oko-games-mbspins'),10) || 0); }catch(e){ return 0; } }
function gmMBSet(n){ try{ localStorage.setItem('oko-games-mbspins', String(Math.max(0, n|0))); }catch(e){} }
function gmMBPluralSpin(n){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return 'круток';
  if(b > 1 && b < 5) return 'крутки';
  if(b === 1) return 'крутка';
  return 'круток';
}
function gmMBProgressHtml(){
  const cur = Math.min(GM_MB_STEP, gmMBCount());
  const pct = cur / GM_MB_STEP * 100;
  const left = Math.max(0, GM_MB_STEP - cur);
  const ready = left === 0;
  return `<div class="gm-mb-progress ${ready ? 'ready' : ''}">
    <div class="gm-mb-p-head">
      <span>${I('gm-mbox')}Тайный сундук</span>
      <b>${cur}/${GM_MB_STEP}</b>
    </div>
    <div class="gm-mb-p-bar"><i style="width:${pct}%"></i></div>
    <small>${ready ? 'Готов к открытию · следующая крутка откроет сундук' : `Ещё ${left} ${gmMBPluralSpin(left)} до особого приза`}</small>
  </div>`;
}
function gmMBAward(){
  const pool = GM_MB_POOL;
  const tot = pool.reduce((a,p)=>a + p.w, 0);
  let r = Math.random() * tot, idx = 0;
  for(let i = 0; i < pool.length; i++){ if(r < pool[i].w){ idx = i; break; } r -= pool[i].w; }
  const p = pool[idx];
  let title = '', prize = null;
  switch(p.t){
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
    case 'service':{
      const sv = GM_SERVICES[p.v] || {};
      prize = {type:'service', val:p.v, code:gmMakeCode(), status:'active'};
      title = sv.label || 'Услуга OKO'; break;
    }
    case 'tier':
      if(typeof PROFILE !== 'undefined'){ PROFILE.tier = p.v; if(typeof renderMyProfile === 'function') renderMyProfile(); }
      prize = {type:'tier', val:p.v, status:'active'};
      title = `Тариф ${p.v} на месяц`;
      gmAchUnlock('tier'); break;
  }
  gmPrizeAdd(prize);
  gmAchUnlock('mbox');
  const val = gmNominal(p);
  if(val > 0) gmLbAddWin(val);
  gmMBReveal(gmPrizeIcon(p), title);
  gmRenderModes(); /* обновить прогресс сундука на 0/20 */
}
function gmMBReveal(icon, title){
  const host = document.getElementById('screen-games');
  if(!host) return;
  const el = document.createElement('div');
  el.className = 'gm-mb-overlay';
  el.innerHTML = `
    <div class="gm-mb-scrim" onclick="gmMBClose(this)"></div>
    <div class="gm-mb-modal" role="dialog" aria-modal="true">
      <span class="gm-mb-tag">${I('gm-cup')}Тайный сундук</span>
      <div class="gm-mb-crate">
        <span class="gm-mb-crate-glow"></span>
        <span class="gm-mb-crate-ic">${I('gm-mbox')}</span>
      </div>
      <div class="gm-mb-prize">
        <span class="gm-mb-prize-ic">${I(icon)}</span>
        <b>${title}</b>
      </div>
      <small class="gm-mb-sub">Награда за ${GM_MB_STEP} круток · уже в «Мои призы»</small>
      <button class="gm-spin" onclick="gmMBClose(this)">${I('gm-gift')}Забрать</button>
    </div>`;
  host.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('open'));
  gmConfetti(el.querySelector('.gm-mb-modal'), true);
  try{ if(navigator.vibrate) navigator.vibrate([30, 60, 30, 60, 90]); }catch(e){}
}
function gmMBClose(node){
  const wrap = node && node.closest ? node.closest('.gm-mb-overlay') : null;
  if(wrap){ wrap.classList.remove('open'); setTimeout(()=>wrap.remove(), 260); }
}

/* ============================================================
   ДОСТИЖЕНИЯ — 8 бейджей за активность в рулетке
   ============================================================ */
const GM_ACH = [
  {id:'first',   ic:'gm-gift',    t:'Первый спин',    s:'Крути рулетку впервые'},
  {id:'ten',     ic:'bolt',       t:'10 круток',      s:'Разогрев начат'},
  {id:'fifty',   ic:'gm-flame',   t:'50 круток',      s:'Постоянный игрок'},
  {id:'jackpot', ic:'gm-cup',     t:'Джекпот',        s:'Поймать редкий сектор'},
  {id:'streak7', ic:'gm-cal',     t:'Неделя подряд',  s:'Серия из 7 дней'},
  {id:'mbox',    ic:'gm-mbox',    t:'Тайный сундук',  s:'Открыть Mystery Box'},
  {id:'rich',    ic:'money',      t:'Богач недели',   s:'5000 рублей призов за неделю'},
  {id:'tier',    ic:'crown',      t:'Тарифный удар',  s:'Выиграть тариф в рулетке'}
];
function gmAchGet(){ try{ return JSON.parse(localStorage.getItem('oko-games-ach')) || {}; }catch(e){ return {}; } }
function gmAchSave(a){ try{ localStorage.setItem('oko-games-ach', JSON.stringify(a)); }catch(e){} }
function gmAchUnlock(id){
  const a = gmAchGet();
  if(a[id]) return false;
  a[id] = Date.now();
  gmAchSave(a);
  const info = GM_ACH.find(x=>x.id === id);
  if(info) toast(`Достижение · ${info.t}`);
  gmAchRender();
  return true;
}
function gmAchRender(){
  const el = document.getElementById('gmAch');
  if(!el) return;
  const a = gmAchGet();
  const done = GM_ACH.filter(x=>a[x.id]).length;
  el.innerHTML = GM_ACH.map(ach=>{
    const on = !!a[ach.id];
    return `<div class="gm-ach ${on ? 'on' : ''}">
      <span class="gm-ach-ic">${I(ach.ic)}</span>
      <b>${ach.t}</b>
      <small>${ach.s}</small>
      ${on ? `<span class="gm-ach-check">${I('check')}</span>` : ''}
    </div>`;
  }).join('');
  const head = document.getElementById('gmAchHead');
  if(head) head.textContent = `${done}/${GM_ACH.length}`;
}

/* ============================================================
   RETENTION-БАННЕР — если last-spin > 24ч и клиент вернулся,
   а бесплатная крутка снова доступна, показать «С возвращением»
   ============================================================ */
function gmRetentionSeenKey(){ return 'oko-games-retseen-' + gmDayIdx(); }
function gmRetentionRender(){
  const el = document.getElementById('gmRetention');
  if(!el) return;
  const last = gmLastSpin();
  const gap = last ? (Date.now() - last) / 3600e3 : 0;
  let seen = false;
  try{ seen = !!localStorage.getItem(gmRetentionSeenKey()); }catch(e){}
  if(last && gap > 24 && !gmBonusClaimedToday() && !seen){
    el.innerHTML = `<div class="gm-ret">
      <span class="gm-ret-ic">${I('gm-gift')}</span>
      <div class="gm-ret-b"><b>С возвращением</b><small>Бесплатная крутка ждёт тебя в колесе</small></div>
      <button class="gm-ret-cta" onclick="gmSelectMode('free');gmRetentionDismiss()">Крутить</button>
      <button class="gm-ret-x" onclick="gmRetentionDismiss()" aria-label="Закрыть">×</button>
    </div>`;
  }else{
    el.innerHTML = '';
  }
}
function gmRetentionDismiss(){
  try{ localStorage.setItem(gmRetentionSeenKey(), '1'); }catch(e){}
  gmRetentionRender();
}

/* ============================================================
   WHEEL-TEASER — три самых крупных приза из текущего пула,
   чтобы клиент видел ЧТО можно получить ещё до крутки
   ============================================================ */
function gmWheelTeaserHtml(){
  const pool = gmCurrentPool();
  const top = pool.slice().sort((a,b)=>gmNominal(b) - gmNominal(a)).slice(0, 3);
  const cells = top.map(p=>
    `<div class="gm-teaser-cell">
      <span class="gm-teaser-ic">${I(gmPrizeIcon(p))}</span>
      <b>${p.s}</b>
    </div>`
  ).join('');
  return `<div class="gm-teaser">
    <small>В колесе прямо сейчас · крупные призы</small>
    <div class="gm-teaser-row">${cells}</div>
  </div>`;
}

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
    gmAchRender();
    gmRetentionRender();
    if(!gmSpinning){
      /* автопереключение на платный пул только если бесплатной крутки правда нет */
      if(gmMode === 'free' && !gmCanFree()) gmMode = 'p100';
      gmBuildWheel();
      gmRenderModes();
    }
  }
};

/* ---------- самоинициализация (все новые модули поднимаются ниже, после определения) ---------- */
regTitle('games', 'Рулетка OKO');
addSvcTile({id:'games', label:'Рулетка OKO', ico:'gm-gift', first:true, onclick:()=>showTab('games')});
gmMode = gmCanFree() ? 'free' : 'p100';
gmBuildWheel();
gmRenderModes();
gmLbEnsure();
gmLbRender();
gmPrizesBtnRender();
gmTicketsRender();
gmBoostBadge();
gmStreakRender();
gmAchRender();
gmRetentionRender();
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

/* ============================================================
   ДОПОЛНИТЕЛЬНЫЕ SVG-ИКОНКИ (подарки, мини-игры, лиги, чарт)
   ============================================================ */
(function gmIcons2(){
  const defs = document.querySelector('svg defs');
  if(!defs) return;
  const mk = (id, inner, vb)=>{
    if(defs.querySelector('#'+id)) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id', id); s.setAttribute('viewBox', vb || '0 0 100 100');
    s.innerHTML = inner; defs.appendChild(s);
  };
  /* Подарки для магазина TON */
  mk('i-gm-rose','<path d="M50 20a14 14 0 00-14 14c0 8 6 14 14 14s14-6 14-14a14 14 0 00-14-14z" fill="none" stroke="currentColor" stroke-width="6"/><path d="M50 48v34M40 62c-14-2-22 6-24 20 12-2 22-8 24-20zM60 62c14-2 22 6 24 20-12-2-22-8-24-20z" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 34l4 6-4 4-4-4z" fill="currentColor" stroke="none"/>');
  mk('i-gm-diamond','<path d="M50 12 20 42l30 46 30-46L50 12z" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linejoin="round"/><path d="M20 42h60M50 12v76M35 42l15-30M65 42L50 12M35 42l15 46M65 42 50 88" fill="none" stroke="currentColor" stroke-width="4.5"/>');
  mk('i-gm-rocket2','<path d="M50 10c14 12 22 30 22 46l-8 8H36l-8-8c0-16 8-34 22-46z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="42" r="8" fill="none" stroke="currentColor" stroke-width="6"/><path d="M36 68l-14 20 22-6M64 68l14 20-22-6" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"/>');
  mk('i-gm-flame2','<path d="M52 10c2 18 22 22 22 42 0 16-11 30-24 30S26 68 26 52c0-9 5-15 5-15-11 4-17 15-17 27a36 36 0 0072 0c0-28-27-38-34-54z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>');
  mk('i-gm-crown2','<path d="M18 74V36l16 14 16-24 16 24 16-14v38a4 4 0 01-4 4H22a4 4 0 01-4-4z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><circle cx="34" cy="36" r="4" fill="currentColor" stroke="none"/><circle cx="50" cy="26" r="4" fill="currentColor" stroke="none"/><circle cx="66" cy="36" r="4" fill="currentColor" stroke="none"/>');
  mk('i-gm-cup2','<path d="M30 12h40v22a20 20 0 01-40 0z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M30 20H16a12 12 0 0014 14M70 20h14a12 12 0 01-14 14M50 54v14M36 84h28M43 68h14" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>');
  /* Sad-face для sad-anim (стрик порван) */
  mk('i-gm-sad','<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="38" cy="43" r="4" fill="currentColor" stroke="none"/><circle cx="62" cy="43" r="4" fill="currentColor" stroke="none"/><path d="M34 70c8-11 24-11 32 0" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M22 44l-6-6M78 44l6-6" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>');
  /* График / чарт для personal stats */
  mk('i-gm-chart','<path d="M14 82V18M14 82h72" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M28 66l16-18 14 12 22-30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="80" cy="30" r="4" fill="currentColor" stroke="none"/>');
  /* Мишень: задачи/челленджи */
  mk('i-gm-target','<circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="50" cy="50" r="22" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="50" cy="50" r="8" fill="currentColor" stroke="none"/>');
  /* Три лиги */
  mk('i-gm-friends','<circle cx="30" cy="34" r="12" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="70" cy="34" r="12" fill="none" stroke="currentColor" stroke-width="6"/><path d="M10 78c0-14 9-24 20-24s20 10 20 24M50 78c0-14 9-24 20-24s20 10 20 24" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>');
  mk('i-gm-city','<path d="M12 84h76M22 84V44l12-8v48M46 84V26l16-10v68M74 84V52l12-6v38" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/><rect x="28" y="52" width="4" height="4" fill="currentColor" stroke="none"/><rect x="52" y="40" width="4" height="4" fill="currentColor" stroke="none"/><rect x="52" y="56" width="4" height="4" fill="currentColor" stroke="none"/><rect x="78" y="60" width="4" height="4" fill="currentColor" stroke="none"/>');
  mk('i-gm-world','<circle cx="50" cy="50" r="36" fill="none" stroke="currentColor" stroke-width="6"/><path d="M14 50h72M50 14c-10 10-16 22-16 36s6 26 16 36c10-10 16-22 16-36S60 24 50 14z" fill="none" stroke="currentColor" stroke-width="5.5"/>');
  /* Скретч (монета/скраб) */
  mk('i-gm-scratch','<rect x="14" y="24" width="72" height="52" rx="7" fill="none" stroke="currentColor" stroke-width="6"/><path d="M28 44l14 14M28 60l14 14M46 44l14 14M46 60l14 14" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><circle cx="72" cy="50" r="10" fill="currentColor" stroke="none"/>');
  /* Сетка (три-в-ряд) */
  mk('i-gm-grid','<path d="M14 14h24v24H14zM38 14h24v24H38zM62 14h24v24H62zM14 38h24v24H14zM38 38h24v24H38zM62 38h24v24H62zM14 62h24v24H14zM38 62h24v24H38zM62 62h24v24H62z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>');
  /* Коробка (открытие) */
  mk('i-gm-box','<rect x="14" y="34" width="72" height="52" rx="4" fill="none" stroke="currentColor" stroke-width="6"/><path d="M14 34l8-16h56l8 16M50 18v68M14 52h72" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linejoin="round"/>');
  /* Battle pass — щит с звездой */
  mk('i-gm-bp','<path d="M50 12l32 8v26c0 22-14 34-32 42-18-8-32-20-32-42V20z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M50 34l5 10 11 2-8 8 2 11-10-6-10 6 2-11-8-8 11-2z" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linejoin="round"/>');
  /* XP-искра */
  mk('i-gm-xp','<path d="M50 10l10 22 24 4-18 16 4 24-20-12-20 12 4-24-18-16 24-4z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><path d="M50 34v14M40 46l10 6 10-6" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>');
  /* Инвентарь подарков */
  mk('i-gm-inv','<rect x="12" y="26" width="76" height="60" rx="6" fill="none" stroke="currentColor" stroke-width="6"/><path d="M12 44h76M30 26v-4a10 10 0 0110-10h20a10 10 0 0110 10v4" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><circle cx="50" cy="62" r="8" fill="none" stroke="currentColor" stroke-width="5.5"/>');
  /* Меню-точки для карточек подарков — уже есть i-more, не дублируем */
  /* Часы (напоминание стрика) — уже есть i-clock */
})();

/* ============================================================
   ЗВУК: короткий WebAudio-бип для достижений и наград (без внешних mp3)
   ============================================================ */
let GM_AUDIO_CTX = null;
function gmSfx(freq, dur, type){
  try{
    if(document.documentElement.dataset.sound === 'off') return;
    if(!GM_AUDIO_CTX) GM_AUDIO_CTX = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = GM_AUDIO_CTX;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq || 800;
    g.gain.value = 0;
    osc.connect(g).connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.linearRampToValueAtTime(0.14, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.16));
    osc.start(t); osc.stop(t + (dur || 0.16) + 0.02);
  }catch(e){}
}
function gmSfxAch(){ gmSfx(660, 0.09, 'triangle'); setTimeout(()=>gmSfx(990, 0.16, 'triangle'), 90); }
function gmSfxWin(){ gmSfx(520, 0.09, 'sine'); setTimeout(()=>gmSfx(780, 0.11, 'sine'), 100); setTimeout(()=>gmSfx(1040, 0.24, 'sine'), 210); }
function gmSfxTap(){ gmSfx(360, 0.05, 'square'); }

/* ============================================================
   XP-СИСТЕМА: сквозной опыт для Battle Pass + челленджей
   ============================================================ */
function gmXpGet(){ try{ return Math.max(0, parseInt(localStorage.getItem('oko-games-xp'),10) || 0); }catch(e){ return 0; } }
function gmXpSet(v){ try{ localStorage.setItem('oko-games-xp', String(Math.max(0, v|0))); }catch(e){} }
function gmXpAdd(n, why){
  if(n <= 0) return;
  const before = gmBpLevel();
  gmXpSet(gmXpGet() + n);
  const after = gmBpLevel();
  if(after > before){
    toast(`Новый уровень пропуска · ${after}`);
    gmSfxAch();
    for(let l = before + 1; l <= after; l++) gmBpGrant(l);
    gmAchCheckBp(after);
  }
  gmBpRenderCard();
  if(why) try{ gmXpLogPush({at:Date.now(), n, why}); }catch(e){}
}
function gmXpLogPush(rec){
  let log = [];
  try{ log = JSON.parse(localStorage.getItem('oko-games-xp-log')) || []; }catch(e){}
  log.unshift(rec);
  try{ localStorage.setItem('oko-games-xp-log', JSON.stringify(log.slice(0, 40))); }catch(e){}
}

/* ============================================================
   BATTLE PASS — 30 уровней, XP-требование растёт, награды через уровень
   ============================================================ */
const GM_BP_MAX = 30;
const GM_BP_PER_LEVEL = 250; /* базовый XP на уровень (растёт линейно) */
function gmBpXpForLevel(l){ return Math.round(GM_BP_PER_LEVEL * l + 50 * (l - 1) * l / 2); } /* нарастающая сумма */
function gmBpLevel(){
  const xp = gmXpGet();
  for(let l = 1; l <= GM_BP_MAX; l++){
    if(xp < gmBpXpForLevel(l)) return l - 1;
  }
  return GM_BP_MAX;
}
function gmBpProgress(){
  const l = gmBpLevel();
  if(l >= GM_BP_MAX) return {l, cur: 1, need: 1, next: null};
  const cur = gmXpGet() - (l ? gmBpXpForLevel(l) : 0);
  const need = gmBpXpForLevel(l + 1) - (l ? gmBpXpForLevel(l) : 0);
  return {l, cur, need, next: l + 1};
}
function gmBpReward(l){
  /* награды подобраны в стиле око: билеты, крутки, скидки, услуги, тарифы */
  if(l % 10 === 0) return {t:'tier', v:'PRO', s:'PRO на месяц'};
  if(l % 5 === 0) return {t:'service', v:'priority', s:'Топ в ленте'};
  if(l % 3 === 0) return {t:'check', v:2, s:'2 проверки видео'};
  if(l % 2 === 0) return {t:'ticket', v:3, s:'3 билета'};
  return {t:'xp', v:50, s:'+50 XP-буст'};
}
function gmBpClaimedList(){ try{ return JSON.parse(localStorage.getItem('oko-games-bp-claimed')) || {}; }catch(e){ return {}; } }
function gmBpClaimSave(m){ try{ localStorage.setItem('oko-games-bp-claimed', JSON.stringify(m)); }catch(e){} }
function gmBpGrant(l){
  const cl = gmBpClaimedList();
  if(cl[l]) return;
  cl[l] = Date.now();
  gmBpClaimSave(cl);
  const r = gmBpReward(l);
  switch(r.t){
    case 'ticket': gmTicketsAdd(r.v); toast(`Пропуск ур ${l} · +${r.v} ${gmPluralTk(r.v)}`); break;
    case 'check':  gmChecksAdd(r.v); gmPrizeAdd({type:'check', val:r.v, status:'active'}); toast(`Пропуск ур ${l} · +${r.v} проверки видео`); break;
    case 'service':{
      gmPrizeAdd({type:'service', val:r.v, code:gmMakeCode(), status:'active'});
      toast(`Пропуск ур ${l} · ${(GM_SERVICES[r.v]||{}).label||'услуга OKO'}`); break;
    }
    case 'tier':
      if(typeof PROFILE !== 'undefined'){ PROFILE.tier = r.v; if(typeof renderMyProfile === 'function') renderMyProfile(); }
      gmPrizeAdd({type:'tier', val:r.v, status:'active'});
      toast(`Пропуск ур ${l} · тариф ${r.v} на месяц`); break;
    case 'xp': gmTicketsAdd(1); break; /* xp-буст = маленький бонус, не циклим xp */
  }
  gmPrizesBtnRender();
}
function gmBpRenderCard(){
  const el = document.getElementById('gmBpCard');
  if(!el) return;
  const p = gmBpProgress();
  const chip = document.getElementById('gmBpLvlChip');
  if(chip) chip.textContent = 'Ур ' + p.l;
  const pct = p.need > 0 ? Math.min(100, Math.round(p.cur / p.need * 100)) : 100;
  const nextReward = p.next ? gmBpReward(p.next) : null;
  el.innerHTML = `
    <div class="gm-bp-head">
      <span class="gm-bp-badge">${I('gm-bp')}<b>Уровень ${p.l}</b></span>
      <small>${p.next ? `до ур ${p.next} · ${p.need - p.cur} XP` : 'максимум достигнут'}</small>
    </div>
    <div class="gm-bp-bar"><i style="width:${pct}%"></i></div>
    ${nextReward ? `<div class="gm-bp-next">
      <span>Следующая награда</span>
      <b>${nextReward.s}</b>
    </div>` : ''}
    <button class="gm-bp-open" onclick="gmBpOpen()">Смотреть все 30 уровней ${I('chev')}</button>`;
}
function gmBpOpen(){ openSheet('gmBp'); gmBpRenderFull(); }
function gmBpRenderFull(){
  const el = document.getElementById('gmBpBody');
  if(!el) return;
  const p = gmBpProgress();
  const cl = gmBpClaimedList();
  const rows = [];
  for(let l = 1; l <= GM_BP_MAX; l++){
    const r = gmBpReward(l);
    const claimed = !!cl[l];
    const locked = l > p.l;
    const need = gmBpXpForLevel(l);
    rows.push(`<div class="gm-bp-row ${claimed ? 'claimed' : ''} ${locked ? 'locked' : 'ready'}">
      <span class="gm-bp-lvl">${l}</span>
      <span class="gm-bp-rw-ic">${I(gmBpRewardIcon(r))}</span>
      <div class="gm-bp-rw-b">
        <b>${r.s}</b>
        <small>${need} XP</small>
      </div>
      <span class="gm-bp-rw-badge ${claimed ? 'done' : (locked ? 'lock' : 'act')}">${claimed ? I('check') : (locked ? I('lock') : I('gm-gift'))}</span>
    </div>`);
  }
  el.innerHTML = `
    <div class="gm-bp-summary">
      <div>
        <b>${I('gm-bp')}Уровень ${p.l} / ${GM_BP_MAX}</b>
        <small>${p.next ? `XP до ур ${p.next}: ${p.need - p.cur} / ${p.need}` : 'Все уровни пройдены'}</small>
      </div>
      <div class="gm-bp-xp">${I('gm-xp')}<b>${gmXpGet()}</b><small>XP всего</small></div>
    </div>
    <div class="gm-bp-bar big"><i style="width:${p.need ? (p.cur/p.need*100) : 100}%"></i></div>
    <p class="gm-bp-note">Опыт даётся за крутки, задания дня, стрик, мини-игры и достижения. Пропуск сбрасывается вместе с сезоном.</p>
    <div class="gm-bp-list">${rows.join('')}</div>`;
}
function gmBpRewardIcon(r){
  switch(r.t){
    case 'ticket': return 'gm-ticket';
    case 'check':  return 'gm-checkvid';
    case 'service':return 'gm-boost';
    case 'tier':   return 'crown';
    case 'xp':     return 'gm-xp';
  }
  return 'gm-gift';
}

/* ============================================================
   DAILY CHALLENGES — 3 ежедневных задания, сброс в полночь
   ============================================================ */
const GM_DAILY_TEMPLATES = [
  {id:'spin3',    ic:'gm-gift',   t:'Крути рулетку',       target:3,  metric:'spins',     xp:60,  s:'3 крутки колеса'},
  {id:'spin5',    ic:'gm-gift',   t:'Расширь удачу',       target:5,  metric:'spins',     xp:110, s:'5 круток колеса'},
  {id:'mini2',    ic:'gm-grid',   t:'Мини-игры',           target:2,  metric:'minis',     xp:80,  s:'2 партии в мини-играх'},
  {id:'mini3',    ic:'gm-grid',   t:'Мини-марафон',        target:3,  metric:'minis',     xp:120, s:'3 партии в мини-играх'},
  {id:'gift1',    ic:'gm-gift',   t:'Отправь подарок',     target:1,  metric:'gifts',     xp:70,  s:'1 отправленный подарок'},
  {id:'scratch2', ic:'gm-scratch',t:'Скретч дня',          target:2,  metric:'scratch',   xp:80,  s:'2 скретч-карты'},
  {id:'m3',       ic:'gm-grid',   t:'Собери линию',        target:1,  metric:'match3',    xp:60,  s:'1 успешная линия'},
  {id:'box',      ic:'gm-box',    t:'Открой коробку',      target:1,  metric:'box',       xp:70,  s:'1 открытая коробка'},
  {id:'stake',    ic:'money',    t:'Ставка на удачу',      target:1,  metric:'paidspin',  xp:90,  s:'1 платная крутка (₽ или билет)'},
  {id:'streak',   ic:'gm-flame', t:'Держи серию',          target:1,  metric:'streakday', xp:50,  s:'зайди в игры сегодня'}
];
function gmDailyKey(){ return 'oko-games-daily-' + gmDayIdx(); }
function gmDailyState(){
  const k = gmDailyKey();
  let st = null;
  try{ st = JSON.parse(localStorage.getItem(k)); }catch(e){}
  if(st && Array.isArray(st.tasks)) return st;
  /* сгенерировать новые 3 задания на день (детерминировано от даты) */
  const seed = gmDayIdx() * 9301 + 49297;
  const shuffled = GM_DAILY_TEMPLATES.slice().sort((a,b)=>((seed + a.target*13) % 100) - ((seed + b.target*7) % 100));
  const picked = shuffled.slice(0, 3).map(x=>({id:x.id, p:0, c:false, r:false}));
  st = {tasks: picked, bonusClaimed: false};
  /* всегда включаем «зайди сегодня» — считать сразу выполненным при заходе */
  const streakIdx = picked.findIndex(t=>t.id==='streak');
  if(streakIdx >= 0){ picked[streakIdx].p = 1; picked[streakIdx].c = true; }
  try{ localStorage.setItem(k, JSON.stringify(st)); }catch(e){}
  gmDailyCleanupOld();
  return st;
}
function gmDailyCleanupOld(){
  try{
    for(let i = 0; i < localStorage.length; i++){
      const k = localStorage.key(i);
      if(k && k.startsWith('oko-games-daily-') && k !== gmDailyKey()){
        const d = parseInt(k.replace('oko-games-daily-',''), 10);
        if(d && d < gmDayIdx() - 3){ localStorage.removeItem(k); i--; }
      }
    }
  }catch(e){}
}
function gmDailyTaskInfo(id){ return GM_DAILY_TEMPLATES.find(t=>t.id === id) || {}; }
function gmDailySave(st){ try{ localStorage.setItem(gmDailyKey(), JSON.stringify(st)); }catch(e){} }
function gmDailyBump(metric){
  const st = gmDailyState();
  let any = false;
  st.tasks.forEach(t=>{
    const info = gmDailyTaskInfo(t.id);
    if(info.metric !== metric || t.c) return;
    t.p = Math.min(info.target, (t.p || 0) + 1);
    if(t.p >= info.target){ t.c = true; any = true; }
  });
  gmDailySave(st);
  if(any){ toast('Задание дня выполнено'); gmSfxTap(); }
  gmDailyRenderCard();
  gmDailyRenderFull();
}
function gmDailyClaim(id){
  const st = gmDailyState();
  const t = st.tasks.find(x=>x.id === id);
  const info = gmDailyTaskInfo(id);
  if(!t || !t.c || t.r) return;
  t.r = true;
  gmDailySave(st);
  gmXpAdd(info.xp || 40, 'daily:' + id);
  toast(`+${info.xp} XP · ${info.t}`);
  gmSfxAch();
  /* если все 3 задания завершены и награда за них ещё не забрана — +200 XP и бонус-крутка */
  if(st.tasks.every(x=>x.c && x.r) && !st.bonusClaimed){
    st.bonusClaimed = true;
    gmDailySave(st);
    gmXpAdd(200, 'daily-bonus');
    gmExtraFreeSet(gmExtraFreeGet() + 1);
    toast('Все задания дня! +200 XP + бесплатная крутка');
    gmAchUnlock('daily-all');
    gmSfxWin();
  }
  gmDailyRenderCard();
  gmDailyRenderFull();
  gmRenderModes();
}
function gmDailyRenderCard(){
  const el = document.getElementById('gmDailyBlock');
  if(!el) return;
  const st = gmDailyState();
  const done = st.tasks.filter(t=>t.c).length;
  const cnt = document.getElementById('gmDailyCount');
  if(cnt) cnt.textContent = done + '/3';
  const rows = st.tasks.slice(0,3).map(t=>{
    const info = gmDailyTaskInfo(t.id);
    const pct = Math.min(100, Math.round((t.p||0) / (info.target || 1) * 100));
    return `<div class="gm-dq-row ${t.c ? 'done' : ''} ${t.r ? 'redeemed' : ''}">
      <span class="gm-dq-ic">${I(info.ic || 'gm-target')}</span>
      <div class="gm-dq-b">
        <b>${info.t || t.id}</b>
        <div class="gm-dq-bar"><i style="width:${pct}%"></i></div>
        <small>${t.p||0}/${info.target||0} · +${info.xp||0} XP</small>
      </div>
      <button class="gm-dq-btn ${t.c && !t.r ? 'ready' : ''}" ${t.c && !t.r ? '' : 'disabled'} onclick="gmDailyClaim('${t.id}')">${t.r ? I('check') : (t.c ? 'Забрать' : `${info.target - (t.p||0)}`)}</button>
    </div>`;
  }).join('');
  const allDone = st.tasks.every(x=>x.c && x.r);
  el.innerHTML = rows + `<div class="gm-dq-bonus ${allDone ? 'done' : (st.tasks.every(x=>x.c) ? 'ready' : '')}">
    <span>${I('gm-target')}Все 3 задания = +200 XP и бесплатная крутка</span>
    ${allDone ? `<b>${I('check')}Получено</b>` : ''}
  </div>`;
}
function gmDailyOpen(){ openSheet('gmDaily'); gmDailyRenderFull(); }
function gmDailyRenderFull(){
  const el = document.getElementById('gmDailyBody');
  if(!el) return;
  const st = gmDailyState();
  const left = gmFmtCd(gmBonusLeftMs());
  const done = st.tasks.filter(t=>t.c).length;
  const rows = st.tasks.map(t=>{
    const info = gmDailyTaskInfo(t.id);
    const pct = Math.min(100, Math.round((t.p||0) / (info.target || 1) * 100));
    return `<div class="gm-dq-row big ${t.c ? 'done' : ''} ${t.r ? 'redeemed' : ''}">
      <span class="gm-dq-ic">${I(info.ic || 'gm-target')}</span>
      <div class="gm-dq-b">
        <b>${info.t}</b>
        <small class="gm-dq-desc">${info.s}</small>
        <div class="gm-dq-bar"><i style="width:${pct}%"></i></div>
        <small>${t.p||0}/${info.target} · <b class="gm-dq-xp">+${info.xp} XP</b></small>
      </div>
      <button class="gm-dq-btn ${t.c && !t.r ? 'ready' : ''}" ${t.c && !t.r ? '' : 'disabled'} onclick="gmDailyClaim('${t.id}')">${t.r ? I('check') : (t.c ? 'Забрать' : 'Идёт')}</button>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="gm-dq-head">
      <div><b>Задания дня · ${done}/3</b><small>сброс через ${left}</small></div>
      <span class="gm-bp-xp small">${I('gm-xp')}<b>${gmXpGet()}</b><small>XP</small></span>
    </div>
    <div class="gm-dq-list">${rows}</div>
    <div class="gm-dq-bonus ${st.tasks.every(x=>x.c && x.r) ? 'done' : (st.tasks.every(x=>x.c) ? 'ready' : '')}">
      <span>${I('gm-target')}Все задания = +200 XP и +1 бесплатная крутка</span>
    </div>`;
}

/* ============================================================
   СТРИК: большой шит с 7-дневным календарём + sad-anim при разрыве
   ============================================================ */
function gmStreakOpen(){ openSheet('gmStreak'); gmStreakRenderFull(); }
function gmStreakRenderFull(){
  const el = document.getElementById('gmStreakBody');
  if(!el) return;
  const s = gmStreakGet();
  const n = gmStreakDisplay();
  const broken = s.d !== null && s.d !== undefined && s.d < gmDayIdx() - 1 && (s.n || 0) > 0;
  const cal = gmStreakCalendar();
  const cells = cal.map(c=>
    `<div class="gm-cal-cell big ${c.done ? 'done' : ''} ${c.isToday ? 'today' : ''}">
      <span class="gm-cal-day">${c.name}</span>
      <span class="gm-cal-dot">${c.done ? I('gm-flame') : c.num}</span>
    </div>`
  ).join('');
  const left = gmFmtCd(gmBonusLeftMs());
  const bonus7 = n >= 7 ? true : false;
  el.innerHTML = `
    <div class="gm-streak-hero ${broken ? 'sad' : (n>0 ? 'lit' : '')}">
      <div class="gm-streak-flame ${broken ? 'sad' : ''}">${I(broken ? 'gm-sad' : 'gm-flame2')}</div>
      <div>
        <b class="gm-streak-big">${n}</b>
        <small>${gmPluralDay(n)} подряд</small>
      </div>
    </div>
    ${broken ? `<div class="gm-streak-sad">Серия прервалась. Заходи каждый день, чтобы копить бонусы.</div>` : ''}
    <div class="gm-streak-cal">${cells}</div>
    <div class="gm-streak-bonus ${bonus7 ? 'on' : ''}">
      <span>${I('gm-cup')}</span>
      <div><b>7 дней подряд = ×3 приз</b><small>множитель применится к следующей крутке колеса</small></div>
      ${bonus7 ? `<span class="gm-streak-badge">Активно</span>` : `<small class="gm-streak-need">ещё ${Math.max(0,7-n)} ${gmPluralDay(Math.max(0,7-n))}</small>`}
    </div>
    <div class="gm-streak-remind">
      ${I('clock')}<span>Осталось до сброса дня · <b>${left}</b></span>
    </div>
    <button class="gm-spin" onclick="gmStreakRemind()">${I('bell')}${gmRemindOn() ? 'Напоминание включено' : 'Напомнить за 3 часа до сброса'}</button>`;
}
/* «push» через notifs-plus — при разрыве серии в течение дня */
function gmRemindOn(){ try{ return localStorage.getItem('oko-games-remind') === '1'; }catch(e){ return false; } }
function gmStreakRemind(){
  const cur = gmRemindOn();
  try{ localStorage.setItem('oko-games-remind', cur ? '0' : '1'); }catch(e){}
  if(!cur){
    toast('Напомним за 3 часа до сброса дня');
    gmScheduleRemind();
  }else{
    toast('Напоминание выключено');
  }
  gmStreakRenderFull();
}
let gmRemindTimer = 0;
function gmScheduleRemind(){
  clearTimeout(gmRemindTimer);
  if(!gmRemindOn()) return;
  const left = gmBonusLeftMs();
  const trigger = left - 3 * 3600 * 1000;
  if(trigger < 1000){
    /* уже поздно на сегодня — планируем на завтра */
    gmRemindTimer = setTimeout(gmScheduleRemind, left + 60000);
    return;
  }
  gmRemindTimer = setTimeout(()=>{
    if(!gmCanFree()) return;
    if(typeof NOTIFS !== 'undefined' && NOTIFS.unshift){
      NOTIFS.unshift({ic:'gm-flame', who:'Рулетка OKO', t:'Осталось 3 часа до сброса дня — заходи за бесплатной круткой', time:'только что', g:'Сегодня', unread:true, act:function(){ if(typeof showTab === 'function') showTab('games'); }});
      if(typeof updateNotifDot === 'function') updateNotifDot();
      if(typeof window.renderNotifs === 'function') window.renderNotifs();
    }
    toast('До сброса дня 3 часа — крути бесплатную');
    gmScheduleRemind();
  }, trigger);
}

/* ============================================================
   TON GIFTS — каталог, отправка другу, инвентарь с редкостью
   ============================================================ */
const GM_GIFTS = [
  {id:'rose',    n:'Роза',      ic:'gm-rose',    ton:0.5,  rar:'Common',    col:'#ff5b7a'},
  {id:'cup',     n:'Кубок',     ic:'gm-cup2',    ton:1.5,  rar:'Common',    col:'#f4c04a'},
  {id:'flame',   n:'Огонь',     ic:'gm-flame2',  ton:3,    rar:'Rare',      col:'#ff8a24'},
  {id:'rocket',  n:'Ракета',    ic:'gm-rocket2', ton:8,    rar:'Rare',      col:'#7cd0ff'},
  {id:'diamond', n:'Диамант',   ic:'gm-diamond', ton:25,   rar:'Epic',      col:'#9AFF00'},
  {id:'crown',   n:'Корона',    ic:'gm-crown2',  ton:100,  rar:'Legendary', col:'#ffd23f'}
];
const GM_RAR_COLORS = {
  Common:    {bg:'rgba(154,255,0,.08)', ink:'#9AFF00',  ord:1},
  Rare:      {bg:'rgba(0,136,204,.14)', ink:'#0088CC',  ord:2},
  Epic:      {bg:'rgba(178,102,255,.15)',ink:'#b266ff', ord:3},
  Legendary: {bg:'rgba(255,210,63,.18)', ink:'#ffd23f', ord:4}
};
function gmGiftById(id){ return GM_GIFTS.find(g=>g.id === id); }
/* TON — 1 TON ≈ ₽300 (условно для симуляции) */
function gmTonToRub(t){ return Math.round(t * 300); }

function gmGiftsInv(){ try{ return JSON.parse(localStorage.getItem('oko-games-gifts')) || []; }catch(e){ return []; } }
function gmGiftsInvSave(list){ try{ localStorage.setItem('oko-games-gifts', JSON.stringify(list.slice(0, 60))); }catch(e){} }
function gmGiftAdd(id, from){
  const g = gmGiftById(id);
  if(!g) return;
  const list = gmGiftsInv();
  list.unshift({id, n:g.n, ic:g.ic, rar:g.rar, from:from||null, at:Date.now()});
  gmGiftsInvSave(list);
  gmGiftsRailRender();
  gmGiftsInvBtnRender();
  gmAchGiftCheck();
}
function gmGiftsHist(){ try{ return JSON.parse(localStorage.getItem('oko-games-gifts-hist')) || []; }catch(e){ return []; } }
function gmGiftsHistPush(rec){
  const l = gmGiftsHist();
  l.unshift(rec);
  try{ localStorage.setItem('oko-games-gifts-hist', JSON.stringify(l.slice(0, 40))); }catch(e){}
}
function gmGiftsShopOpen(){ openSheet('gmGiftsShop'); gmGiftsShopRender(); }
function gmGiftsShopRender(){
  const el = document.getElementById('gmGiftsShopBody');
  if(!el) return;
  const cards = GM_GIFTS.map(g=>{
    const c = GM_RAR_COLORS[g.rar];
    return `<div class="gm-gcard" style="--gc:${g.col}">
      <span class="gm-gcard-ic">${I(g.ic)}</span>
      <b>${g.n}</b>
      <span class="gm-gcard-rar" style="background:${c.bg};color:${c.ink}">${g.rar}</span>
      <div class="gm-gcard-price">${I('ton')}<b>${g.ton}</b><small>≈ ${fmtMoney(gmTonToRub(g.ton))}</small></div>
      <button class="gm-gcard-buy" onclick="gmGiftBuy('${g.id}',false)">Купить себе</button>
      <button class="gm-gcard-send" onclick="gmGiftBuy('${g.id}',true)">${I('send')}Другу</button>
    </div>`;
  }).join('');
  el.innerHTML = `
    <div class="gm-gift-note">${I('ton')}<span>Подарки покупаются за TON. При оплате блокчейн-сеть возьмёт комиссию. Симуляция — оплата фиктивная.</span></div>
    <div class="gm-gift-grid">${cards}</div>`;
}
function gmGiftBuy(id, forFriend){
  const g = gmGiftById(id);
  if(!g) return;
  /* «оплата» — списание с ₽-кошелька по курсу TON→₽ */
  const rub = gmTonToRub(g.ton);
  if(!walletCharge(rub, 'Подарок TON · ' + g.n)) return;
  okoEarn(Math.round(rub * 0.05), 'Комиссия подарка TON');
  gmXpAdd(30, 'gift-buy');
  if(forFriend){
    gmGiftSendOpen(id);
  }else{
    gmGiftAdd(id, 'сам');
    gmGiftsHistPush({dir:'in', id, at:Date.now(), from:'себе'});
    toast(`Подарок «${g.n}» добавлен в коллекцию`);
    gmSfxAch();
    gmDailyBump('gifts'); /* учтём в челлендже — купить = подарить себе тоже считается */
  }
}
function gmGiftSendOpen(preselectId){
  openSheet('gmGiftSend');
  const el = document.getElementById('gmGiftSendBody');
  if(!el) return;
  const g = preselectId ? gmGiftById(preselectId) : null;
  const friends = gmFriendList();
  el.innerHTML = `
    <div class="gm-gsend-head">
      ${g ? `<span class="gm-gcard-ic small" style="--gc:${g.col}">${I(g.ic)}</span><div><b>${g.n}</b><small>${g.ton} TON · ${g.rar}</small></div>` : `<b>Выбери контакт</b>`}
    </div>
    <label class="gm-gsend-msg"><small>Сообщение (необязательно)</small><input id="gmGSendMsg" placeholder="С днём рождения!" maxlength="80"/></label>
    <div class="gm-gsend-list">${friends.map(f=>`<button class="gm-gsend-friend" onclick="gmGiftSendTo('${preselectId||''}','${esc(f.n)}')">
      <span class="gm-gsend-ava">${esc(f.n[0]||'?').toUpperCase()}</span>
      <div><b>${esc(f.n)}</b><small>${esc(f.h||'в OKO')}</small></div>
      ${I('chev')}
    </button>`).join('')}</div>`;
}
function gmFriendList(){
  /* демо-список друзей: если в чатах есть контакты — берём оттуда, иначе моки */
  const fromChats = [];
  try{
    if(typeof CHATS !== 'undefined' && Array.isArray(CHATS)){
      CHATS.filter(c=>!c.grp && c.name).slice(0,8).forEach(c=>{
        fromChats.push({n:c.name, h:c.last || 'в OKO'});
      });
    }
  }catch(e){}
  if(fromChats.length) return fromChats;
  return [
    {n:'Марат К.', h:'@marat'},
    {n:'Настя В.', h:'@nastya.vibe'},
    {n:'Кирилл Т.', h:'@kirillt'},
    {n:'Полина М.', h:'@polya'},
    {n:'Артём В.', h:'@artem'},
    {n:'Ксюша Р.', h:'@ksusha'}
  ];
}
function gmGiftSendTo(giftId, friendName){
  const g = giftId ? gmGiftById(giftId) : null;
  if(!g){ toast('Сначала выбери подарок в магазине'); return; }
  const msg = (document.getElementById('gmGSendMsg')||{}).value || '';
  gmGiftsHistPush({dir:'out', id:giftId, to:friendName, msg, at:Date.now()});
  /* «событие в чат» — если есть чаты, покажем сообщение-стикер */
  try{
    if(typeof CHATS !== 'undefined' && Array.isArray(CHATS)){
      const c = CHATS.find(x=>x.name === friendName);
      if(c){
        c.last = `Ты отправил подарок «${g.n}»`;
        c.time = 'только что';
        if(typeof renderChats === 'function') renderChats();
      }
    }
  }catch(e){}
  gmXpAdd(50, 'gift-send');
  gmDailyBump('gifts');
  toast(`Подарок «${g.n}» отправлен · ${friendName}`);
  gmSfxAch();
  closeSheet();
  gmGiftsRailRender();
  gmGiftsInvBtnRender();
}
function gmGiftsRailRender(){
  const el = document.getElementById('gmGiftRail');
  if(!el) return;
  el.innerHTML = GM_GIFTS.map(g=>{
    const c = GM_RAR_COLORS[g.rar];
    return `<button class="gm-grail" style="--gc:${g.col}" onclick="gmGiftBuy('${g.id}',false)">
      <span class="gm-grail-ic">${I(g.ic)}</span>
      <b>${g.n}</b>
      <small style="color:${c.ink}">${g.ton} TON</small>
    </button>`;
  }).join('');
}
function gmGiftsInvBtnRender(){
  const el = document.getElementById('gmGiftsInvBtn');
  if(!el) return;
  const inv = gmGiftsInv();
  const hist = gmGiftsHist();
  const sent = hist.filter(h=>h.dir === 'out').length;
  el.innerHTML = `${I('gm-inv')}<div class="gm-bonus-t"><span>Мои подарки</span><small>${inv.length ? `${inv.length} в коллекции · отправлено ${sent}` : 'ещё нет — купи или отправь другу'}</small></div>${I('chev','gm-bonus-chev')}`;
}
function gmGiftsInvOpen(){ openSheet('gmGiftsInv'); gmGiftsInvRender(); }
function gmGiftsInvRender(){
  const el = document.getElementById('gmGiftsInvBody');
  if(!el) return;
  const inv = gmGiftsInv();
  const hist = gmGiftsHist();
  const rarStats = {Common:0,Rare:0,Epic:0,Legendary:0};
  inv.forEach(x=>{ if(rarStats[x.rar] !== undefined) rarStats[x.rar]++; });
  const stats = `<div class="gm-inv-stats">${['Common','Rare','Epic','Legendary'].map(r=>{
    const c = GM_RAR_COLORS[r];
    return `<div class="gm-inv-stat" style="--rc:${c.ink};--rb:${c.bg}"><b>${rarStats[r]}</b><small>${r}</small></div>`;
  }).join('')}</div>`;
  if(!inv.length){
    el.innerHTML = stats + `<div class="gm-empty">${I('gm-inv')}<span>Подарков пока нет — открой витрину и подари себе или другу</span></div>
      <button class="gm-spin" onclick="closeSheet();gmGiftsShopOpen()">${I('gm-diamond')}Открыть витрину</button>`;
    return;
  }
  const items = inv.map(x=>{
    const g = gmGiftById(x.id) || {ic:'gm-gift', col:'#9AFF00'};
    const c = GM_RAR_COLORS[x.rar] || GM_RAR_COLORS.Common;
    const d = new Date(x.at);
    const time = d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'}) + ' ' + d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
    return `<div class="gm-inv-card" style="--gc:${g.col}">
      <span class="gm-inv-ic">${I(g.ic)}</span>
      <b>${esc(x.n)}</b>
      <small class="gm-inv-rar" style="background:${c.bg};color:${c.ink}">${x.rar}</small>
      <small class="gm-inv-time">${time}</small>
    </div>`;
  }).join('');
  const histRows = hist.slice(0, 12).map(h=>{
    const g = gmGiftById(h.id) || {n:'Подарок', ic:'gm-gift'};
    const d = new Date(h.at);
    const time = d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'});
    return `<div class="gm-inv-hist ${h.dir}">
      ${I(g.ic)}
      <div><b>${h.dir==='out' ? 'Отправлен · '+esc(h.to||'') : 'Получен · '+esc(h.from||'')}</b><small>${g.n} · ${time}</small></div>
    </div>`;
  }).join('');
  el.innerHTML = stats +
    `<div class="gm-inv-grid">${items}</div>` +
    (histRows ? `<h4 class="gm-inv-h">История</h4><div class="gm-inv-hist-list">${histRows}</div>` : '');
}

/* ============================================================
   МИНИ-ИГРЫ: скретч, три-в-ряд, коробка, спин (уже есть)
   ============================================================ */
const GM_MINI = [
  {id:'wheel',   n:'Колесо',        ic:'gm-gift',    s:'основная рулетка', fn:'gmScrollToWheel'},
  {id:'scratch', n:'Скретч',        ic:'gm-scratch', s:'зaдизь пальцем',   fn:'gmScratchOpen'},
  {id:'match3',  n:'Лайм-плитки',   ic:'gm-grid',    s:'три в ряд',        fn:'gmMatch3Open'},
  {id:'box',     n:'Коробка',       ic:'gm-box',     s:'крути и открой',   fn:'gmBoxOpen'}
];
function gmMiniRender(){
  const el = document.getElementById('gmMiniGrid');
  if(!el) return;
  el.innerHTML = GM_MINI.map(m=>{
    return `<button class="gm-mini-cell" onclick="${m.fn}()">
      <span class="gm-mini-ic">${I(m.ic)}</span>
      <b>${m.n}</b>
      <small>${m.s}</small>
    </button>`;
  }).join('');
}
function gmScrollToWheel(){
  const el = document.querySelector('#screen-games .gm-wheel-card');
  if(el && el.scrollIntoView) el.scrollIntoView({behavior:'smooth', block:'start'});
}

/* --- СКРЕТЧ-КАРТА --- */
function gmScratchOpen(){ openSheet('gmScratch'); gmScratchRender(); }
function gmScratchState(){
  return {revealed: 0, total: 0, prize: null};
}
function gmScratchRender(){
  const el = document.getElementById('gmScratchBody');
  if(!el) return;
  /* цена: 1 билет за карту, награда — случайный приз из пула free */
  const pool = GM_POOLS.free;
  const total = pool.reduce((a,p)=>a + p.w, 0);
  let r = Math.random() * total, idx = 0;
  for(let i = 0; i < pool.length; i++){ if(r < pool[i].w){ idx = i; break; } r -= pool[i].w; }
  const prize = pool[idx];
  el.innerHTML = `
    <div class="gm-sc-head">
      <b>Скретч-карта</b>
      <small>1 билет · зaдизь пальцем поле, чтобы открыть приз</small>
    </div>
    <div class="gm-sc-price"><span>Стоимость: 1 билет</span><span class="gm-tk-val">${GM_TICKETS}</span></div>
    <div class="gm-sc-card" id="gmScCard" data-prize='${JSON.stringify(prize).replace(/'/g,'&apos;')}'>
      <div class="gm-sc-prize">
        <span class="gm-sc-prize-ic">${I(gmPrizeIcon(prize))}</span>
        <b>${prize.s}</b>
        <small>${gmPrizeSub(prize)}</small>
      </div>
      <canvas class="gm-sc-canvas" id="gmScCanvas" width="300" height="180"></canvas>
    </div>
    <button class="gm-spin" id="gmScBuy" onclick="gmScratchBuy()">${I('gm-scratch')}Купить и потереть — 1 билет</button>
    <button class="gm-spin ghost" id="gmScNew" style="display:none" onclick="gmScratchOpen()">Ещё карта</button>`;
  gmScratchInitCanvas();
}
function gmScratchInitCanvas(){
  const c = document.getElementById('gmScCanvas');
  if(!c) return;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, '#20340a');
  g.addColorStop(1, '#0d0d0d');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(154,255,0,.35)';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ЗАДИЗЬ ПАЛЬЦЕМ', c.width/2, c.height/2);
  c.dataset.locked = '1'; /* до оплаты — заблокировано */
}
function gmScratchBuy(){
  const c = document.getElementById('gmScCanvas');
  const btn = document.getElementById('gmScBuy');
  if(!c || !btn) return;
  if(!gmTicketsSpend(1)){ toast('Нужен 1 билет — заработай в рулетке'); return; }
  c.dataset.locked = '0';
  btn.style.display = 'none';
  gmXpAdd(20, 'scratch-play');
  gmDailyBump('minis');
  gmDailyBump('scratch');
  gmScratchAttach();
}
function gmScratchAttach(){
  const c = document.getElementById('gmScCanvas');
  if(!c) return;
  const ctx = c.getContext('2d');
  let dragging = false, cleared = 0, cellSize = 8;
  const totalArea = c.width * c.height;
  const need = totalArea * 0.55;
  ctx.globalCompositeOperation = 'destination-out';
  function pos(e){
    const rect = c.getBoundingClientRect();
    const pt = e.touches ? e.touches[0] : e;
    return {x: (pt.clientX - rect.left) * (c.width / rect.width), y: (pt.clientY - rect.top) * (c.height / rect.height)};
  }
  function scratch(e){
    if(!dragging) return;
    e.preventDefault && e.preventDefault();
    const p = pos(e);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
    ctx.fill();
    cleared += Math.PI * 22 * 22;
    if(cleared > need){
      dragging = false;
      gmScratchDone();
    }
  }
  c.addEventListener('pointerdown', e=>{ dragging = true; scratch(e); });
  c.addEventListener('pointermove', scratch);
  c.addEventListener('pointerup', ()=>{ dragging = false; });
  c.addEventListener('pointerleave', ()=>{ dragging = false; });
  c.addEventListener('touchstart', e=>{ dragging = true; scratch(e); }, {passive:false});
  c.addEventListener('touchmove', scratch, {passive:false});
  c.addEventListener('touchend', ()=>{ dragging = false; });
}
function gmScratchDone(){
  const card = document.getElementById('gmScCard');
  const c = document.getElementById('gmScCanvas');
  if(!card) return;
  try{
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height); /* полное открытие */
  }catch(e){}
  const p = JSON.parse((card.dataset.prize||'{}').replace(/&apos;/g,"'"));
  if(!p || !p.t) return;
  /* выдаём приз через общий gmGrant-конвейер, режим 'free', но не считаем как дневную крутку */
  const pseudoGrant = ()=>{
    let prize = null, title = '';
    switch(p.t){
      case 'money':  walletAdd(p.v, 'Скретч-карта OKO'); prize = {type:'money', val:p.v, status:'done'}; title = '+ ' + fmtMoney(p.v); break;
      case 'ticket': gmTicketsAdd(p.v); prize = {type:'ticket', val:p.v, status:'done'}; title = `+ ${p.v} ${gmPluralTk(p.v)}`; break;
      case 'check':  gmChecksAdd(p.v); prize = {type:'check', val:p.v, status:'active'}; title = `+ ${p.v} проверки видео`; break;
      case 'disc':   prize = {type:'discount', val:p.v, code:gmMakeCode(), status:'active'}; title = `Скидка −${p.v}% на тариф`; break;
      case 'boost':  gmBoostSet(p.v); prize = {type:'boost', val:p.v, status:'active'}; title = `Буст ×${p.v}`; break;
      case 'tier':   if(typeof PROFILE!=='undefined'){ PROFILE.tier = p.v; } prize = {type:'tier', val:p.v, status:'active'}; title = `Тариф ${p.v} на месяц`; break;
      case 'service':prize = {type:'service', val:p.v, code:gmMakeCode(), status:'active'}; title = (GM_SERVICES[p.v]||{}).label||'Услуга OKO'; break;
    }
    gmPrizeAdd(prize);
    toast('Скретч: ' + title);
    const btn = document.getElementById('gmScNew');
    if(btn) btn.style.display = '';
    gmSfxWin();
    gmXpAdd(40, 'scratch-win');
    gmLbAddWin(gmNominal(p) || 0);
  };
  pseudoGrant();
}

/* --- ТРИ-В-РЯД: 4x4 лайм-плитки, найти 3 одинаковых подряд --- */
const GM_M3_ICONS = ['gm-gift','gm-flame2','gm-diamond','gm-rose','gm-cup2'];
function gmMatch3Open(){ openSheet('gmMatch3'); gmMatch3New(); }
let GM_M3 = null;
function gmMatch3New(){
  const el = document.getElementById('gmMatch3Body');
  if(!el) return;
  GM_M3 = {grid: [], sel: -1, moves: 5, matched: 0};
  for(let i = 0; i < 16; i++){
    GM_M3.grid.push(Math.floor(Math.random() * GM_M3_ICONS.length));
  }
  gmMatch3Render();
}
function gmMatch3Render(){
  const el = document.getElementById('gmMatch3Body');
  if(!el) return;
  const cells = GM_M3.grid.map((v,i)=>`<button class="gm-m3-cell ${GM_M3.sel === i ? 'sel' : ''}" data-i="${i}" onclick="gmMatch3Tap(${i})">${I(GM_M3_ICONS[v])}</button>`).join('');
  el.innerHTML = `
    <div class="gm-sc-head">
      <b>Собери три в ряд</b>
      <small>Меняй местами соседние плитки · ${GM_M3.moves} ходов · линии: <b>${GM_M3.matched}</b></small>
    </div>
    <div class="gm-m3-grid">${cells}</div>
    <button class="gm-spin ghost" onclick="gmMatch3New()">Новая партия</button>`;
}
function gmMatch3Tap(i){
  if(!GM_M3) return;
  if(GM_M3.moves <= 0){ toast('Ходы закончились — начни партию заново'); return; }
  if(GM_M3.sel < 0){ GM_M3.sel = i; gmMatch3Render(); return; }
  if(GM_M3.sel === i){ GM_M3.sel = -1; gmMatch3Render(); return; }
  const a = GM_M3.sel, b = i;
  const ax = a % 4, ay = Math.floor(a / 4), bx = b % 4, by = Math.floor(b / 4);
  if(Math.abs(ax - bx) + Math.abs(ay - by) !== 1){ GM_M3.sel = b; gmMatch3Render(); return; }
  [GM_M3.grid[a], GM_M3.grid[b]] = [GM_M3.grid[b], GM_M3.grid[a]];
  GM_M3.sel = -1;
  GM_M3.moves--;
  gmSfxTap();
  const found = gmMatch3Find();
  if(found > 0){
    GM_M3.matched += found;
    gmDailyBump('m3');
    gmDailyBump('minis');
    /* награда: за каждую собранную линию — 1 билет */
    gmTicketsAdd(found);
    gmXpAdd(30 * found, 'match3');
    toast(`Линия! +${found} ${gmPluralTk(found)}`);
    gmSfxAch();
  }
  gmMatch3Render();
  if(GM_M3.moves <= 0 && GM_M3.matched > 0){
    setTimeout(()=>{ toast(`Партия окончена · линий: ${GM_M3.matched}`); }, 200);
  }
}
function gmMatch3Find(){
  let cnt = 0;
  /* горизонтали */
  for(let r = 0; r < 4; r++){
    for(let c = 0; c < 2; c++){
      const i = r*4 + c;
      if(GM_M3.grid[i] === GM_M3.grid[i+1] && GM_M3.grid[i] === GM_M3.grid[i+2]){
        GM_M3.grid[i] = -1; GM_M3.grid[i+1] = -1; GM_M3.grid[i+2] = -1;
        cnt++;
      }
    }
  }
  /* вертикали */
  for(let c = 0; c < 4; c++){
    for(let r = 0; r < 2; r++){
      const i = r*4 + c;
      if(GM_M3.grid[i] !== -1 && GM_M3.grid[i] === GM_M3.grid[i+4] && GM_M3.grid[i] === GM_M3.grid[i+8]){
        GM_M3.grid[i] = -1; GM_M3.grid[i+4] = -1; GM_M3.grid[i+8] = -1;
        cnt++;
      }
    }
  }
  /* «падение»: заполнить пустые новыми */
  for(let i = 0; i < 16; i++){
    if(GM_M3.grid[i] === -1) GM_M3.grid[i] = Math.floor(Math.random() * GM_M3_ICONS.length);
  }
  return cnt;
}

/* --- КОРОБКА: 3 коробки, выбери одну — открытие с анимацией --- */
function gmBoxOpen(){ openSheet('gmBox'); gmBoxRender(); }
function gmBoxRender(){
  const el = document.getElementById('gmBoxBody');
  if(!el) return;
  el.innerHTML = `
    <div class="gm-sc-head">
      <b>Три коробки — одна выигрышная</b>
      <small>Стоимость: 2 билета · выбери коробку и открой</small>
    </div>
    <div class="gm-box-row" id="gmBoxRow">
      ${[0,1,2].map(i=>`<button class="gm-box" onclick="gmBoxPick(${i})"><span class="gm-box-ic">${I('gm-box')}</span></button>`).join('')}
    </div>
    <button class="gm-spin" id="gmBoxBuy" onclick="gmBoxBuy()">${I('gm-box')}Оплатить и выбрать — 2 билета</button>
    <div id="gmBoxPrize"></div>`;
}
let GM_BOX_PAID = false;
function gmBoxBuy(){
  if(!gmTicketsSpend(2)){ toast('Нужно 2 билета'); return; }
  GM_BOX_PAID = true;
  document.getElementById('gmBoxBuy').style.display = 'none';
  toast('Выбирай коробку');
  gmXpAdd(20, 'box-play');
  gmDailyBump('minis');
  gmDailyBump('box');
}
function gmBoxPick(i){
  if(!GM_BOX_PAID){ toast('Сначала оплати — 2 билета'); return; }
  GM_BOX_PAID = false;
  const boxes = document.querySelectorAll('#gmBoxRow .gm-box');
  boxes.forEach((b,idx)=>{
    b.classList.add(idx === i ? 'chosen' : 'faded');
    b.disabled = true;
  });
  /* Выбираем приз из премиум-пула mystery box */
  const pool = GM_MB_POOL;
  const tot = pool.reduce((a,p)=>a + p.w, 0);
  let r = Math.random() * tot, idx = 0;
  for(let j = 0; j < pool.length; j++){ if(r < pool[j].w){ idx = j; break; } r -= pool[j].w; }
  const p = pool[idx];
  setTimeout(()=>{
    let title = '', prize = null;
    switch(p.t){
      case 'ticket': gmTicketsAdd(p.v); prize = {type:'ticket', val:p.v, status:'done'}; title = `+ ${p.v} ${gmPluralTk(p.v)}`; break;
      case 'check':  gmChecksAdd(p.v); prize = {type:'check', val:p.v, status:'active'}; title = `+ ${p.v} проверки видео`; break;
      case 'disc':   prize = {type:'discount', val:p.v, code:gmMakeCode(), status:'active'}; title = `Скидка −${p.v}%`; break;
      case 'boost':  gmBoostSet(p.v); prize = {type:'boost', val:p.v, status:'active'}; title = `Буст ×${p.v}`; break;
      case 'service':prize = {type:'service', val:p.v, code:gmMakeCode(), status:'active'}; title = (GM_SERVICES[p.v]||{}).label||'Услуга OKO'; break;
      case 'tier':   if(typeof PROFILE!=='undefined'){ PROFILE.tier = p.v; } prize = {type:'tier', val:p.v, status:'active'}; title = `Тариф ${p.v} на месяц`; break;
    }
    gmPrizeAdd(prize);
    const pel = document.getElementById('gmBoxPrize');
    if(pel){
      pel.innerHTML = `<div class="gm-box-reveal">${I(gmPrizeIcon(p))}<b>${title}</b><small>Приз в «Мои призы»</small></div>
        <button class="gm-spin ghost" onclick="gmBoxRender()">Ещё раз</button>`;
    }
    gmSfxWin();
    gmXpAdd(60, 'box-win');
    gmLbAddWin(gmNominal(p) || 0);
  }, 700);
}

/* ============================================================
   ЛИДЕРЫ 3 ЛИГИ (Друзья / Город / Мир) — расширяем существующий рендер
   ============================================================ */
let GM_LB_LEAGUE = 'friends';
const GM_LB_LEAGUES = [
  {id:'friends', n:'Друзья', ic:'gm-friends'},
  {id:'city',    n:'Твой город', ic:'gm-city'},
  {id:'world',   n:'Мир', ic:'gm-world'}
];
const GM_LB_POOLS = {
  friends: ['Марат К.','Настя В.','Кирилл Т.','ZONA_51','Полина М.','deniska_pro','Артём В.','lera.moon'],
  city:    ['spb_ivan','msk_max','kzn_dm','ekb_lera','nsk_alex','nn_kate','krd_serg','vlg_yara','irk_dima','sam_alina','ufa_kirill','rst_pavel'],
  world:   ['tokyo_ai','ny_hero','berlin_bob','miami_lux','dubai_sm','paris_mila','seoul_yj','sao_jorge','london_max','singh_ram','lima_dee','bali_su']
};
function gmLbLeagueGet(id){
  const k = 'oko-games-lb-' + id + '-' + gmWeekKey();
  let cached = null;
  try{ cached = JSON.parse(localStorage.getItem(k)); }catch(e){}
  if(cached && cached.bots) return cached;
  const pool = GM_LB_POOLS[id].slice().sort(()=>Math.random() - 0.5);
  const size = id === 'world' ? 12 : 10;
  /* призы: у world самые крупные, у friends скромнее */
  const scale = id === 'friends' ? 0.6 : id === 'city' ? 1 : 1.8;
  const data = {
    week: gmWeekKey(),
    bots: pool.slice(0, size).map(n=>({
      n, s: Math.round((300 + Math.random() * 8200 * scale) / 10) * 10, w: 2 + Math.floor(Math.random() * 34)
    }))
  };
  try{ localStorage.setItem(k, JSON.stringify(data)); }catch(e){}
  return data;
}
function gmLbTabsRender(){
  const el = document.getElementById('gmLbTabs');
  if(!el) return;
  el.innerHTML = GM_LB_LEAGUES.map(l=>`<button class="gm-lb-tab ${GM_LB_LEAGUE === l.id ? 'on' : ''}" onclick="gmLbSetLeague('${l.id}')">${I(l.ic)}<span>${l.n}</span></button>`).join('');
}
function gmLbSetLeague(id){
  if(!GM_LB_POOLS[id]) return;
  GM_LB_LEAGUE = id;
  gmLbTabsRender();
  gmLbRender();
}
/* переопределение gmLbRank/gmLbRender для 3 лиг — с сохранением базового поведения */
const _gmLbRankBase = gmLbRank;
gmLbRank = function(){
  if(GM_LB_LEAGUE === 'friends' || GM_LB_LEAGUE === 'city' || GM_LB_LEAGUE === 'world'){
    gmLbEnsure();
    const data = gmLbLeagueGet(GM_LB_LEAGUE);
    const rows = data.bots.map(b=>({n:b.n, s:b.s, w:b.w, me:false}));
    /* твоя позиция участвует только в friends / city (не в world по умолчанию) */
    if(GM_LB_LEAGUE !== 'world' || GM_LB.my > 4000){
      rows.push({n: PROFILE.name, s: Math.round(GM_LB.my*100)/100, w: GM_LB.myW, me:true});
    }
    rows.sort((a,b)=>b.s - a.s);
    return rows;
  }
  return _gmLbRankBase.apply(this, arguments);
};
const _gmLbRenderBase = gmLbRender;
gmLbRender = function(){
  const el = document.getElementById('gmLb');
  if(!el) return;
  gmLbEnsure();
  const rows = gmLbRank();
  const myIdx = rows.findIndex(r=>r.me);
  const days = 7 - ((new Date().getDay() + 6) % 7);
  const leagueLabel = (GM_LB_LEAGUES.find(l=>l.id === GM_LB_LEAGUE) || {n:''}).n;
  const nextGap = (myIdx > 0 && myIdx < rows.length) ? rows[Math.max(0, myIdx - 1)].s - rows[myIdx].s : 0;
  let html = `<div class="gm-lb-head"><span>${I('gm-cup')}${leagueLabel} · за эту неделю</span><small>сброс через ${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}</small></div>`;
  html += rows.slice(0, 10).map((r,i)=>gmLbRow(r, i+1)).join('');
  if(myIdx >= 10) html += `<div class="gm-lb-gap">···</div>` + gmLbRow(rows[myIdx], myIdx + 1);
  if(myIdx > 0 && nextGap > 0) html += `<div class="gm-lb-tip">${I('gm-chart')}Ещё ${fmtMoney(nextGap)} призов · и обгонишь ${rows[myIdx-1].n}</div>`;
  if(myIdx < 0) html += `<div class="gm-lb-tip">${I('gm-chart')}Крути и выигрывай — попадёшь в лигу</div>`;
  el.innerHTML = html;
};

/* ============================================================
   ДОСТИЖЕНИЯ 30 с редкостью + фильтром + звуком
   ============================================================ */
const GM_ACH_EXT = [
  {id:'daily-all',   ic:'gm-target',  t:'Мастер дня',      s:'Выполнить все 3 задания дня', rar:'Rare'},
  {id:'daily-week',  ic:'gm-target',  t:'Неделя миссий',   s:'7 дней с выполненными заданиями', rar:'Epic'},
  {id:'gift-first',  ic:'gm-gift',    t:'Первый подарок',  s:'Купи или отправь подарок TON', rar:'Common'},
  {id:'gift-legend', ic:'gm-crown2',  t:'Легенда даров',   s:'Заполучи Legendary-подарок', rar:'Legendary'},
  {id:'gift-collect',ic:'gm-inv',     t:'Коллекционер',    s:'Собери 10 подарков в инвентаре', rar:'Rare'},
  {id:'gift-send5',  ic:'send',       t:'Щедрая душа',     s:'Отправь 5 подарков', rar:'Rare'},
  {id:'m3-line',     ic:'gm-grid',    t:'В линию',         s:'Собери линию в лайм-плитках', rar:'Common'},
  {id:'m3-triple',   ic:'gm-grid',    t:'Три линии',       s:'Собери 3 линии за партию', rar:'Rare'},
  {id:'scratch-hit', ic:'gm-scratch', t:'Скретчёр',        s:'Открой скретч-карту', rar:'Common'},
  {id:'box-open',    ic:'gm-box',     t:'Коробочник',      s:'Открой коробку', rar:'Common'},
  {id:'bp-5',        ic:'gm-bp',      t:'Пропуск 5',       s:'Достичь уровня 5 пропуска', rar:'Common'},
  {id:'bp-15',       ic:'gm-bp',      t:'Пропуск 15',      s:'Достичь уровня 15 пропуска', rar:'Rare'},
  {id:'bp-30',       ic:'gm-bp',      t:'Максимальный',    s:'Достичь уровня 30 пропуска', rar:'Legendary'},
  {id:'streak14',    ic:'gm-flame',   t:'Две недели',      s:'Серия 14 дней', rar:'Rare'},
  {id:'streak30',    ic:'gm-flame2',  t:'Месяц огня',      s:'Серия 30 дней', rar:'Epic'},
  {id:'xp1000',      ic:'gm-xp',      t:'1000 XP',         s:'Набрать 1000 XP всего', rar:'Common'},
  {id:'xp5000',      ic:'gm-xp',      t:'5000 XP',         s:'Набрать 5000 XP всего', rar:'Rare'},
  {id:'city-top10',  ic:'gm-city',    t:'Топ города',      s:'Войди в топ-10 своего города', rar:'Rare'},
  {id:'world-top10', ic:'gm-world',   t:'Мир знает',       s:'Войди в топ-10 мира', rar:'Legendary'},
  {id:'friends-top1',ic:'gm-friends', t:'Первый среди друзей', s:'Занять 1 место в лиге друзей', rar:'Epic'},
  {id:'boost-5',     ic:'gm-boost',   t:'Пять бустов',     s:'Выиграй буст 5 раз', rar:'Rare'},
  {id:'promo-use',   ic:'gm-pct',     t:'Скидка в дело',   s:'Использовать призовую скидку на тариф', rar:'Common'},
  {id:'vip',         ic:'crown',      t:'VIP-статус',      s:'Активировать любой платный тариф', rar:'Rare'}
];
/* Расширяем список: сначала базовые 8, потом ext */
if(typeof GM_ACH !== 'undefined' && GM_ACH.length < 15){
  GM_ACH.forEach(a=>{ if(!a.rar) a.rar = 'Common'; });
  GM_ACH_EXT.forEach(a=>GM_ACH.push(a));
}
let GM_ACH_FILTER = 'all';
function gmAchFilterRender(){
  const el = document.getElementById('gmAchFilter');
  if(!el) return;
  const opts = [
    {id:'all', n:'Все'},
    {id:'unlocked', n:'Открытые'},
    {id:'Common', n:'Common'},
    {id:'Rare', n:'Rare'},
    {id:'Epic', n:'Epic'},
    {id:'Legendary', n:'Legendary'}
  ];
  el.innerHTML = opts.map(o=>`<button class="gm-ach-fil ${GM_ACH_FILTER === o.id ? 'on' : ''}" onclick="gmAchSetFilter('${o.id}')">${o.n}</button>`).join('');
}
function gmAchSetFilter(id){ GM_ACH_FILTER = id; gmAchFilterRender(); gmAchRender(); }
/* Переопределение рендера достижений — с редкостью, фильтром и звуком */
const _gmAchRenderBase = gmAchRender;
gmAchRender = function(){
  const el = document.getElementById('gmAch');
  if(!el) return;
  const a = gmAchGet();
  const done = GM_ACH.filter(x=>a[x.id]).length;
  let list = GM_ACH.slice();
  if(GM_ACH_FILTER === 'unlocked') list = list.filter(x=>a[x.id]);
  else if(GM_ACH_FILTER !== 'all') list = list.filter(x=>(x.rar||'Common') === GM_ACH_FILTER);
  /* сортировка: открытые сначала, затем по редкости (легендарные внизу неоткрытые) */
  const rarOrd = (r)=>({Common:1,Rare:2,Epic:3,Legendary:4})[r] || 1;
  list.sort((x,y)=>{
    const ax = a[x.id] ? 0 : 1, ay = a[y.id] ? 0 : 1;
    if(ax !== ay) return ax - ay;
    return rarOrd(x.rar||'Common') - rarOrd(y.rar||'Common');
  });
  el.innerHTML = list.map(ach=>{
    const on = !!a[ach.id];
    const rar = ach.rar || 'Common';
    const rc = GM_RAR_COLORS[rar] || GM_RAR_COLORS.Common;
    return `<div class="gm-ach ${on ? 'on' : ''} rar-${rar.toLowerCase()}">
      <span class="gm-ach-ic" style="${on ? '' : ''}">${I(ach.ic)}</span>
      <b>${ach.t}</b>
      <small>${ach.s}</small>
      <span class="gm-ach-rar" style="color:${rc.ink};background:${rc.bg}">${rar}</span>
      ${on ? `<span class="gm-ach-check">${I('check')}</span>` : ''}
    </div>`;
  }).join('');
  const head = document.getElementById('gmAchHead');
  if(head) head.textContent = `${done}/${GM_ACH.length}`;
};
/* Расширить gmAchUnlock — играть звук */
const _gmAchUnlockBase = gmAchUnlock;
gmAchUnlock = function(id){
  const before = gmAchGet();
  if(before[id]) return false;
  const r = _gmAchUnlockBase.apply(this, arguments);
  if(r){
    const info = GM_ACH.find(x=>x.id === id);
    const rar = (info && info.rar) || 'Common';
    if(rar === 'Legendary' || rar === 'Epic') gmSfxWin();
    else gmSfxAch();
    gmXpAdd(({Common:30,Rare:80,Epic:150,Legendary:300})[rar] || 30, 'ach:' + id);
  }
  return r;
};
/* Проверки достижений */
function gmAchCheckBp(l){
  if(l >= 5)  gmAchUnlock('bp-5');
  if(l >= 15) gmAchUnlock('bp-15');
  if(l >= 30) gmAchUnlock('bp-30');
}
function gmAchGiftCheck(){
  const inv = gmGiftsInv();
  const hist = gmGiftsHist();
  if(inv.length >= 1) gmAchUnlock('gift-first');
  if(inv.length >= 10) gmAchUnlock('gift-collect');
  if(inv.some(g=>g.rar === 'Legendary')) gmAchUnlock('gift-legend');
  if(hist.filter(h=>h.dir==='out').length >= 5) gmAchUnlock('gift-send5');
}

/* ============================================================
   PERSONAL STATS — «твои шансы за неделю»
   ============================================================ */
function gmStatsOpen(){ openSheet('gmStats'); gmStatsRender(); }
function gmStatsRender(){
  const el = document.getElementById('gmStatsBody');
  if(!el) return;
  const total = gmSpinTotal();
  const weekWin = GM_LB && typeof GM_LB.my === 'number' ? GM_LB.my : 0;
  const weekN = GM_LB && GM_LB.myW ? GM_LB.myW : 0;
  const avg = weekN ? Math.round(weekWin / weekN) : 0;
  const pool = GM_POOLS.p100;
  const tot = pool.reduce((a,p)=>a + p.w, 0);
  const rare = pool.filter(p=>p.c >= 4).reduce((a,p)=>a + p.w, 0) / tot;
  const tierChance = pool.filter(p=>p.t === 'tier').reduce((a,p)=>a + p.w, 0) / tot;
  el.innerHTML = `
    <div class="gm-stats-grid">
      <div class="gm-stats-cell"><span>${I('gm-gift')}</span><b>${total}</b><small>круток всего</small></div>
      <div class="gm-stats-cell"><span>${I('gm-cup')}</span><b>${weekN}</b><small>призов за неделю</small></div>
      <div class="gm-stats-cell"><span>${I('money')}</span><b>${fmtMoney(weekWin)}</b><small>суммарно за неделю</small></div>
      <div class="gm-stats-cell"><span>${I('gm-xp')}</span><b>${gmXpGet()}</b><small>XP всего</small></div>
    </div>
    <h4 class="gm-stats-h">Твой средний приз</h4>
    <p class="gm-stats-note">За неделю: <b>${fmtMoney(avg)}</b> за одну крутку</p>
    <h4 class="gm-stats-h">Шансы редких секторов</h4>
    <div class="gm-stats-bar-row">
      <span>Редкие призы (c4)</span>
      <div class="gm-stats-bar"><i style="width:${(rare * 100 * 3).toFixed(1)}%"></i></div>
      <b>${(rare * 100).toFixed(1)}%</b>
    </div>
    <div class="gm-stats-bar-row">
      <span>Тариф в подарок</span>
      <div class="gm-stats-bar"><i style="width:${(tierChance * 100 * 5).toFixed(1)}%"></i></div>
      <b>${(tierChance * 100).toFixed(1)}%</b>
    </div>
    <h4 class="gm-stats-h">Честность (anti-cheat)</h4>
    <p class="gm-stats-note">Каждый сектор — фиксированный вес. RNG выполняется на устройстве (Math.random). Прошлые крутки не влияют на будущие. Шансы совпадают с «Таблицей шансов».</p>
    <button class="gm-spin ghost" onclick="closeSheet();gmOddsOpen()">${I('gm-scales')}Открыть таблицу шансов</button>`;
}

/* ============================================================
   VIP-КАБИНЕТ — для START/PRO/MAX: удвоенные призы + доп. крутки
   ============================================================ */
function gmVipTier(){
  const t = (typeof PROFILE !== 'undefined' && PROFILE.tier) ? String(PROFILE.tier).toUpperCase() : 'FREE';
  if(t.includes('MAX')) return 'MAX';
  if(t.includes('PRO')) return 'PRO';
  if(t.includes('START')) return 'START';
  if(t.includes('BUSINESS')) return 'BUSINESS';
  return 'FREE';
}
function gmVipMultiplier(){
  const t = gmVipTier();
  if(t === 'MAX' || t === 'BUSINESS') return 2.5;
  if(t === 'PRO') return 2;
  if(t === 'START') return 1.5;
  return 1;
}
function gmVipExtraFree(){
  const t = gmVipTier();
  if(t === 'MAX' || t === 'BUSINESS') return 3;
  if(t === 'PRO') return 2;
  if(t === 'START') return 1;
  return 0;
}
function gmVipBannerRender(){
  const el = document.getElementById('gmVipBanner');
  if(!el) return;
  const t = gmVipTier();
  if(t === 'FREE'){
    el.innerHTML = `<button class="gm-vip-banner off" onclick="if(typeof showTab==='function')showTab('paywall')">
      ${I('crown')}<div><b>VIP-кабинет закрыт</b><small>Активируй START/PRO/MAX и получи ×2 призы и +2 крутки в день</small></div>${I('chev','gm-bonus-chev')}
    </button>`;
  }else{
    const mul = gmVipMultiplier();
    el.innerHTML = `<button class="gm-vip-banner on" onclick="gmVipOpen()">
      ${I('crown')}<div><b>VIP · ${t}</b><small>×${mul} к призам · +${gmVipExtraFree()} бесплатных круток в день · открыть</small></div>${I('chev','gm-bonus-chev')}
    </button>`;
  }
}
function gmVipOpen(){ openSheet('gmVip'); gmVipRender(); }
function gmVipRender(){
  const el = document.getElementById('gmVipBody');
  if(!el) return;
  const t = gmVipTier();
  const mul = gmVipMultiplier();
  const claimedKey = 'oko-games-vip-free-' + gmDayIdx();
  let claimed = 0;
  try{ claimed = parseInt(localStorage.getItem(claimedKey),10) || 0; }catch(e){}
  const max = gmVipExtraFree();
  const left = Math.max(0, max - claimed);
  if(t === 'FREE'){
    el.innerHTML = `<div class="gm-vip-lock">${I('lock')}<b>VIP-кабинет закрыт</b><small>Оформи START, PRO или MAX — множитель призов, дополнительные бесплатные крутки, приоритет в лидерах</small><button class="gm-spin" onclick="closeSheet();if(typeof showTab==='function')showTab('paywall')">${I('crown')}Смотреть тарифы</button></div>`;
    return;
  }
  el.innerHTML = `
    <div class="gm-vip-hero">
      <span>${I('crown')}</span>
      <div>
        <b>VIP · ${t}</b>
        <small>активные бонусы в рулетке</small>
      </div>
    </div>
    <div class="gm-vip-perks">
      <div class="gm-vip-perk"><span>${I('gm-boost')}</span><b>×${mul}</b><small>множитель денежных призов</small></div>
      <div class="gm-vip-perk"><span>${I('gm-gift')}</span><b>+${max}</b><small>бесплатных круток в день</small></div>
      <div class="gm-vip-perk"><span>${I('gm-cup')}</span><b>+50%</b><small>вес XP-начислений</small></div>
      <div class="gm-vip-perk"><span>${I('gm-scales')}</span><b>Всегда</b><small>приоритет при равном призе</small></div>
    </div>
    <div class="gm-vip-daily">
      <b>Ежедневные VIP-крутки</b>
      <small>Забрано сегодня: ${claimed}/${max}</small>
      <button class="gm-spin ${left ? '' : 'off'}" onclick="gmVipClaimFree()" ${left ? '' : 'disabled'}>${I('gm-gift')}${left ? `Забрать ${left} ${gmPluralTk(left).replace('билет','крутк')}` : 'Уже забраны'}</button>
    </div>
    <p class="gm-stats-note">VIP-множитель применяется автоматически к каждой денежной выплате в колесе. Крутки идут сверх лимита и не занимают дневной подарок.</p>`;
}
function gmVipClaimFree(){
  const t = gmVipTier();
  if(t === 'FREE'){ toast('Нужен активный тариф'); return; }
  const max = gmVipExtraFree();
  const claimedKey = 'oko-games-vip-free-' + gmDayIdx();
  let claimed = 0;
  try{ claimed = parseInt(localStorage.getItem(claimedKey),10) || 0; }catch(e){}
  const left = Math.max(0, max - claimed);
  if(!left){ toast('VIP-крутки на сегодня забраны'); return; }
  try{ localStorage.setItem(claimedKey, String(claimed + left)); }catch(e){}
  gmExtraFreeSet(gmExtraFreeGet() + left);
  toast(`+${left} бесплатных круток от VIP`);
  gmSfxAch();
  gmVipRender();
  gmRenderModes();
}
/* Применяем VIP-множитель поверх gmApplyBoost */
const _gmApplyBoostBase = gmApplyBoost;
gmApplyBoost = function(base){
  let val = _gmApplyBoostBase.apply(this, arguments);
  const mul = gmVipMultiplier();
  if(mul > 1 && val > 0){
    const before = val;
    val = Math.round(val * mul * 100) / 100;
    toast(`VIP ×${mul}: +${fmtMoney(val - before)}`);
  }
  return val;
};

/* ============================================================
   ИНТЕГРАЦИЯ: cчётчики круток → challenges + XP + achievements
   ============================================================ */
const _gmGrantBase = gmGrant;
gmGrant = function(p, mode, payTicket){
  _gmGrantBase.apply(this, arguments);
  gmDailyBump('spins');
  if(mode !== 'free') gmDailyBump('paidspin');
  gmXpAdd(mode === 'free' ? 15 : 25, 'spin');
  /* стрик достижения расширенные */
  const s = gmStreakGet();
  if(s.n >= 14) gmAchUnlock('streak14');
  if(s.n >= 30) gmAchUnlock('streak30');
  if(gmXpGet() >= 1000) gmAchUnlock('xp1000');
  if(gmXpGet() >= 5000) gmAchUnlock('xp5000');
  /* лидерборды-достижения */
  try{
    const cityRank = (function(){ const rows = _gmLbRankBase.call({}); return 0; })();
  }catch(e){}
  if(gmVipTier() !== 'FREE') gmAchUnlock('vip');
};

/* Патчим существующий gmPrizeUse для достижения promo-use */
const _gmPrizeUseBase = gmPrizeUse;
gmPrizeUse = function(id){
  _gmPrizeUseBase.apply(this, arguments);
  const p = GM_PRIZES.find(x=>x.id === id);
  if(p && p.type === 'discount' && p.status === 'used') gmAchUnlock('promo-use');
};

/* ============================================================
   MASTER init: показать все новые блоки на экране игр
   ============================================================ */
const _prevShowTabGm2 = showTab;
showTab = function(t){
  _prevShowTabGm2(t);
  if(t === 'games'){
    gmDailyRenderCard();
    gmMiniRender();
    gmBpRenderCard();
    gmGiftsRailRender();
    gmGiftsInvBtnRender();
    gmLbTabsRender();
    gmAchFilterRender();
    gmVipBannerRender();
    gmScheduleRemind();
    /* засчитать «зашёл сегодня» в челленджах */
    gmDailyBump('streakday');
  }
};

/* Первичный рендер (когда games — стартовая вкладка) */
setTimeout(function gmInit2(){
  gmDailyRenderCard();
  gmMiniRender();
  gmBpRenderCard();
  gmGiftsRailRender();
  gmGiftsInvBtnRender();
  gmLbTabsRender();
  gmAchFilterRender();
  gmVipBannerRender();
  gmScheduleRemind();
  /* при первом заходе — засчитать «зашёл сегодня» в челлендж */
  gmDailyBump('streakday');
}, 60);
