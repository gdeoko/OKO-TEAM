/* ===== GAMES: игровой центр OKO — рулетка + «Дорога» + «Кости» (префикс gm-) =====
   Ставки ТОЛЬКО с кошелька (walletCharge/walletAdd), доход OKO — okoEarn.
   Механика рулетки перенесена из Mortis: CSS-колесо (conic-gradient) +
   страховочный setTimeout — результат обрабатывается ровно один раз.
   Плюс: таблица лидеров недели (персист) и ежедневный бонус (колесо подарков). */

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
  /* фишка казино */
  mk('i-gm-chip','<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="50" r="19" fill="none" stroke="currentColor" stroke-width="7"/><path d="M50 12v13M50 75v13M12 50h13M75 50h13M23 23l9 9M68 68l9 9M77 23l-9 9M32 68l-9 9" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
  /* дорога с разметкой */
  mk('i-gm-road','<path d="M16 88C32 62 32 38 24 12M84 88C68 62 68 38 76 12" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M50 14v13M50 44v13M50 74v13" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
  /* игральная кость (5 точек) */
  mk('i-gm-dice','<rect x="14" y="14" width="72" height="72" rx="16" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="34" cy="34" r="6.5" fill="currentColor" stroke="none"/><circle cx="66" cy="34" r="6.5" fill="currentColor" stroke="none"/><circle cx="50" cy="50" r="6.5" fill="currentColor" stroke="none"/><circle cx="34" cy="66" r="6.5" fill="currentColor" stroke="none"/><circle cx="66" cy="66" r="6.5" fill="currentColor" stroke="none"/>');
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
})();

/* ---------- общее состояние ---------- */
const GM_LIMIT_MAX = 10000; /* дневной лимит ставок, ₽ */
const GM_HIST = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-games'))||[]; }catch(e){ return []; } })();
const GM_GAME_NAMES = {wheel:'Рулетка OKO', road:'Дорога OKO', dice:'Кости OKO'};
const GM_GAME_ICONS = {wheel:'gm-chip', road:'gm-road', dice:'gm-dice'};

function gmFmtMult(m){ return '×' + String(m).replace('.', ','); }

function gmUpdateBalance(){
  const el = document.getElementById('gmBalance');
  if(el) el.textContent = fmtMoney(WALLET.balance);
}

/* ============================================================
   ПРИЗОВОЙ ПУЛ OKO — билеты (валюта), призы, проверки видео, бусты
   Призы НЕ только деньги: скидки на тариф, тариф на месяц, проверки,
   билеты, бусты и деньги. Всё персистится, статусы отслеживаются.
   ============================================================ */

/* ---------- билеты: внутренняя валюта круток ---------- */
let GM_TICKETS = (()=>{ try{ return Math.max(0, parseInt(localStorage.getItem('oko-games-tickets'),10) || 0); }catch(e){ return 0; } })();
function gmTicketsSave(){ try{ localStorage.setItem('oko-games-tickets', String(GM_TICKETS)); }catch(e){} }
function gmPluralTk(n){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return 'билетов';
  if(b > 1 && b < 5) return 'билета';
  if(b === 1) return 'билет';
  return 'билетов';
}
function gmTicketsRender(){
  document.querySelectorAll('.gm-tk-val').forEach(e=>{ e.textContent = GM_TICKETS; });
  const modeBtn = document.getElementById('gmSpinTk');
  if(modeBtn) modeBtn.classList.toggle('off', GM_TICKETS < 1);
}
function gmTicketsAdd(n, why){
  if(n <= 0) return;
  GM_TICKETS += n; gmTicketsSave(); gmTicketsRender();
}
function gmTicketsSpend(n){
  if(GM_TICKETS < n) return false;
  GM_TICKETS -= n; gmTicketsSave(); gmTicketsRender();
  return true;
}

/* ---------- счётчик бонусных проверок видео ---------- */
function gmChecksGet(){ try{ return Math.max(0, parseInt(localStorage.getItem('oko-games-checks'),10) || 0); }catch(e){ return 0; } }
function gmChecksAdd(n){ try{ localStorage.setItem('oko-games-checks', String(gmChecksGet() + n)); }catch(e){} }
/* другим модулям (напр. paywall) — сколько бонусных проверок доступно */
window.okoBonusChecks = gmChecksGet;

/* ---------- буст: ×множитель к следующему выигрышу в играх ---------- */
function gmBoostGet(){ try{ return parseInt(localStorage.getItem('oko-games-boost'),10) || 0; }catch(e){ return 0; } }
function gmBoostSet(v){ try{ if(v > 1) localStorage.setItem('oko-games-boost', String(v)); else localStorage.removeItem('oko-games-boost'); }catch(e){} gmBoostBadge(); }
function gmBoostBadge(){
  const el = document.getElementById('gmBoostBadge');
  if(!el) return;
  const b = gmBoostGet();
  if(b > 1){
    el.style.display = '';
    el.innerHTML = `${I('gm-boost')}<span>Активен буст <b>×${b}</b> — умножит следующий выигрыш в любой игре</span>`;
  }else{
    el.style.display = 'none';
    el.innerHTML = '';
  }
}
/* применить (и погасить) буст к выигрышу; вернуть итоговую выплату */
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

/* ---------- лояльность: за каждые 1000 ₽ ставок — 1 билет ----------
   Связывает три денежные игры с призовым пулом, НЕ трогая их RTP. */
const GM_TK_STEP = 1000;
function gmWager(bet){
  let w = 0;
  try{ w = parseFloat(localStorage.getItem('oko-games-wager')) || 0; }catch(e){}
  w += bet;
  let earned = 0;
  while(w >= GM_TK_STEP){ w -= GM_TK_STEP; earned++; }
  try{ localStorage.setItem('oko-games-wager', String(w)); }catch(e){}
  if(earned > 0){
    gmTicketsAdd(earned);
    toast(`+${earned} ${gmPluralTk(earned)} за активность — крути призовое колесо`);
  }
}

/* блокировка ставок на время раунда: input + чипы + выбор исхода */
function gmLockBets(hostId, on){
  const el = document.getElementById(hostId);
  if(el) el.classList.toggle('gm-locked', !!on);
}

/* ---------- дневной лимит (ответственная игра) ---------- */
function gmLimitState(){
  let s = null;
  try{ s = JSON.parse(localStorage.getItem('oko-games-limit')); }catch(e){}
  const today = new Date().toISOString().slice(0,10);
  if(!s || s.date !== today) s = {date: today, spent: 0};
  return s;
}
function gmLimitCheck(bet){
  const s = gmLimitState();
  if(s.spent + bet > GM_LIMIT_MAX){
    showPopup({
      ico:'lock', title:'Дневной лимит ставок',
      body:`Ответственная игра: лимит — <b>${fmtMoney(GM_LIMIT_MAX)}</b> ставок в день. Сегодня уже поставлено <b>${fmtMoney(s.spent)}</b>. Новые ставки откроются завтра.`,
      actions:[{label:'Понятно'},{label:'В кошелёк', ghost:true, onclick:()=>showTab('wallet')}]
    });
    return false;
  }
  return true;
}
function gmLimitSpend(bet){
  const s = gmLimitState();
  s.spent += bet;
  try{ localStorage.setItem('oko-games-limit', JSON.stringify(s)); }catch(e){}
  gmRenderLimit();
}
function gmRenderLimit(){
  const s = gmLimitState();
  const txt = document.getElementById('gmLimitTxt');
  const bar = document.getElementById('gmLimitBar');
  const box = document.getElementById('gmLimit');
  if(!txt || !bar || !box) return;
  txt.textContent = fmtMoney(s.spent) + ' из ' + fmtMoney(GM_LIMIT_MAX);
  bar.style.width = Math.min(100, s.spent / GM_LIMIT_MAX * 100) + '%';
  box.classList.toggle('full', s.spent >= GM_LIMIT_MAX);
}

/* ---------- ставка: инпут + чипы ---------- */
function gmBet(inputId){
  const v = Math.floor(Number(document.getElementById(inputId).value) || 0);
  if(v < 10){ toast('Минимальная ставка — 10 ₽'); return 0; }
  return v;
}
function gmChip(inputId, v, btn){
  document.getElementById(inputId).value = v;
  if(inputId === 'gmRoadBet') gmRoadBetVal = v;
  btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b === btn));
}
function gmChipClear(inp){
  const box = inp.closest('.gm-bet') && inp.closest('.gm-bet').nextElementSibling;
  if(box && box.classList.contains('gm-chips')) box.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
}

/* ---------- переключение игр ---------- */
function gmShowGame(g){
  ['wheel','road','dice'].forEach(k=>{
    document.getElementById('gmGame-'+k).style.display = (k===g ? '' : 'none');
    document.getElementById('gmTab-'+k).classList.toggle('on', k===g);
  });
  if(g === 'road') requestAnimationFrame(()=>gmSyncEye(true));
}

/* ================= РУЛЕТКА OKO =================
   12 секторов: x0 ×4, x1.2 ×3, x1.5 ×2, x2 ×1, x3 ×1, x10 ×1.
   Итог раунда выбирается взвешенно (RTP ≈ 90%), колесо доезжает
   до соответствующего сектора. */
const GM_SECTORS = [10, 0, 1.2, 0, 2, 0, 1.5, 1.2, 0, 3, 1.2, 1.5];
/* палитра колеса зависит от темы: [фон сектора, цвет подписи] */
const GM_COLORS_DARK = {
  0:  ['#141a0e', '#6f7d5e'],
  1.2:['#1e3305', '#c9ff70'],
  1.5:['#2e4d06', '#dbff9e'],
  2:  ['#487a08', '#f0ffd8'],
  3:  ['#6fb50d', '#0c1400'],
  10: ['#9AFF00', '#0a1400']
};
const GM_COLORS_LIGHT = {
  0:  ['#eef2e6', '#98a58c'],  /* светлый нейтральный сектор */
  1.2:['#dcedb6', '#4e6d16'],
  1.5:['#c3e488', '#3a5c0f'],
  2:  ['#a6d94f', '#1f3f08'],
  3:  ['#7ec81c', '#0d2200'],
  10: ['#9AFF00', '#0a1400']
};
function gmIsLight(){ return document.documentElement.dataset.theme === 'light'; }
function gmColors(){ return gmIsLight() ? GM_COLORS_LIGHT : GM_COLORS_DARK; }
const GM_WEIGHTS = [[0,530],[1.2,230],[1.5,120],[2,60],[3,40],[10,20]]; /* из 1000, RTP ≈ 89.6% */

let gmWheelAngle = 0;
let gmSpinning = false;   /* флаг из Mortis: результат ровно один раз */
let gmSpinToken = 0;

function gmBuildWheel(){
  const w = document.getElementById('gmWheel');
  if(!w) return;
  const C = gmColors();
  const stops = GM_SECTORS.map((m,i)=>`${C[m][0]} ${i*30}deg ${(i+1)*30}deg`).join(',');
  w.style.background = `conic-gradient(from -15deg, ${stops})`;
  w.innerHTML = GM_SECTORS.map((m,i)=>
    `<span class="gm-sec" style="color:${C[m][1]};transform:translate(-50%,-50%) rotate(${i*30}deg) translateY(-96px)">${gmFmtMult(m)}</span>`
  ).join('');
}

function gmSetResult(html){
  const el = document.getElementById('gmWheelResult');
  if(el) el.innerHTML = html;
}

function gmSpin(){
  if(gmSpinning){ toast('Колесо ещё крутится'); return; }
  const bet = gmBet('gmWheelBet');
  if(!bet) return;
  if(!gmLimitCheck(bet)) return;
  if(!walletCharge(bet, 'Ставка в рулетке')) return;
  gmLimitSpend(bet);
  gmWager(bet);
  gmUpdateBalance();

  gmSpinning = true;
  const token = ++gmSpinToken;
  document.getElementById('gmSpinBtn').classList.add('off');
  gmLockBets('gmGame-wheel', true);
  gmSetResult(`<span class="gm-run">Ставка ${fmtMoney(bet)} принята — колесо крутится…</span>`);

  /* взвешенный исход, затем случайный сектор с этим множителем */
  let r = Math.random() * 1000, mult = 0;
  for(const [m, wt] of GM_WEIGHTS){ if(r < wt){ mult = m; break; } r -= wt; }
  const opts = GM_SECTORS.map((m,i)=>m===mult ? i : -1).filter(i=>i>=0);
  const idx = opts[Math.floor(Math.random() * opts.length)];

  const wheel = document.getElementById('gmWheel');
  const cur = ((gmWheelAngle % 360) + 360) % 360;
  wheel.style.transition = 'none';
  wheel.style.transform = `rotate(${cur}deg)`;
  void wheel.offsetWidth; /* форс-рефлоу перед новым переходом */

  const turns = 5 + Math.floor(Math.random() * 3);        /* 5–7 оборотов */
  const jitter = Math.random() * 22 - 11;                 /* внутри сектора (±11° < 15°) */
  const delta = ((360 - idx * 30) - cur + 720) % 360;
  const target = cur + turns * 360 + delta + jitter;
  gmWheelAngle = target;
  wheel.style.transition = 'transform 8s cubic-bezier(0.12,0.65,0.13,1)';
  wheel.style.transform = `rotate(${target}deg)`;

  /* КРИТИЧНО (фикс из Mortis): transitionend может потеряться (смена вкладки,
     reduced-motion) — страховочный таймер 8200мс; token гарантирует один вызов */
  const settle = ()=>{
    if(token !== gmSpinToken || !gmSpinning) return;
    gmSpinning = false;
    gmWheelFinish(bet, mult);
  };
  wheel.addEventListener('transitionend', settle, {once:true});
  setTimeout(settle, 8200);
}

function gmWheelFinish(bet, mult){
  document.getElementById('gmSpinBtn').classList.remove('off');
  gmLockBets('gmGame-wheel', false);
  const base = Math.round(bet * mult * 100) / 100;
  const win = gmApplyBoost(base);
  if(win > 0){
    walletAdd(win, 'Выигрыш в рулетке');
    gmConfetti(document.querySelector('.gm-wheel-card'));
    gmLbAddWin(win);
    gmSetResult(`<b class="gm-win">+ ${fmtMoney(win)}</b><span>Сектор ${gmFmtMult(mult)} — выплата уже на кошельке</span>`);
  }else{
    const wrap = document.getElementById('gmWheelWrap');
    wrap.classList.remove('gm-shake'); void wrap.offsetWidth; wrap.classList.add('gm-shake');
    gmSetResult(`<b class="gm-lose">×0</b><span>Ставка сгорела — колесо ждёт реванша</span>`);
  }
  const net = bet - base;
  if(net > 0) okoEarn(net, 'Игры: рулетка');
  gmHistPush({g:'wheel', bet, win, mult, at: Date.now()});
  gmUpdateBalance();
}

/* лаймовое конфетти */
function gmConfetti(host){
  if(!host) return;
  const box = document.createElement('div');
  box.className = 'gm-confetti';
  const cols = ['#9AFF00','#c9ff70','#6fb50d','#eaffcc','#ffffff'];
  let h = '';
  for(let i=0;i<28;i++){
    h += `<i style="left:${(Math.random()*100).toFixed(1)}%;background:${cols[i%cols.length]};animation-delay:${(Math.random()*0.35).toFixed(2)}s;animation-duration:${(0.9+Math.random()*0.8).toFixed(2)}s"></i>`;
  }
  box.innerHTML = h;
  host.appendChild(box);
  setTimeout(()=>box.remove(), 2200);
}

/* ================= ДОРОГА OKO =================
   5 плит, шансы на шаг [92,84,74,60,45]%, множители [1.2,1.6,2.4,4,8].
   Ставка списывается на старте; «Забрать» — walletAdd(bet*множитель). */
const GM_ROAD_MULTS = [1.2, 1.6, 2.4, 4, 8];
const GM_ROAD_ODDS  = [92, 84, 74, 60, 45];
let gmRoad = {active:false, step:0, bet:0, busy:false};
let gmRoadBetVal = 100;

function gmRoadMultsRender(){
  const el = document.getElementById('gmRoadMults');
  if(!el) return;
  el.innerHTML = GM_ROAD_MULTS.map((m,i)=>{
    let cls = '';
    if(gmRoad.active && i < gmRoad.step) cls = 'done';
    else if(gmRoad.active && i === gmRoad.step) cls = 'cur';
    return `<span class="gm-rm ${cls}">${gmFmtMult(m)}</span>`;
  }).join('');
}

function gmRoadTiles(){ return document.querySelectorAll('#gmTrack .gm-tile'); }
function gmRoadClearTiles(){ gmRoadTiles().forEach(t=>t.classList.remove('ok','bad','next')); }
/* подсветить плиту, на которую сейчас шагнёт глаз */
function gmRoadMarkNext(){
  const tiles = gmRoadTiles();
  tiles.forEach(t=>t.classList.remove('next'));
  if(gmRoad.active && !gmRoad.busy && gmRoad.step < tiles.length) tiles[gmRoad.step].classList.add('next');
}
/* искры из плиты при удачном шаге */
function gmSpark(tile){
  if(!tile) return;
  const box = document.createElement('div');
  box.className = 'gm-spark';
  let h = '';
  for(let i=0;i<8;i++){
    const a = (i/8)*Math.PI*2 + Math.random()*0.5;
    const d = 26 + Math.random()*20;
    h += `<i style="--dx:${(Math.cos(a)*d).toFixed(0)}px;--dy:${(Math.sin(a)*d).toFixed(0)}px;animation-delay:${(Math.random()*0.08).toFixed(2)}s"></i>`;
  }
  box.innerHTML = h;
  tile.appendChild(box);
  setTimeout(()=>box.remove(), 800);
}

/* позиция глаза: i = индекс плиты, -1 = старт */
function gmMoveEye(i, noHop){
  const eye = document.getElementById('gmEye');
  const el = i < 0 ? document.getElementById('gmStartCell') : gmRoadTiles()[i];
  if(!eye || !el) return;
  eye.style.left = (el.offsetLeft + el.offsetWidth / 2) + 'px';
  eye.classList.remove('gm-fall');
  if(!noHop){ eye.classList.remove('gm-hop'); void eye.offsetWidth; eye.classList.add('gm-hop'); }
}
function gmSyncEye(noHop){
  gmMoveEye(gmRoad.active && gmRoad.step > 0 ? gmRoad.step - 1 : -1, noHop);
}

function gmRoadCtrl(msg){
  const el = document.getElementById('gmRoadCtrl');
  if(!el) return;
  el.classList.remove('gm-locked');
  if(!gmRoad.active){
    el.innerHTML = `
      ${msg ? `<div class="gm-road-msg">${msg}</div>` : ''}
      <div class="gm-bet"><input id="gmRoadBet" type="number" inputmode="numeric" min="10" step="10" value="${gmRoadBetVal}" placeholder="Ставка, ₽" oninput="gmRoadBetVal=this.value;gmChipClear(this)"></div>
      <div class="gm-chips">
        <button ${gmRoadBetVal==50?'class="on"':''} onclick="gmChip('gmRoadBet',50,this)">50 ₽</button>
        <button ${gmRoadBetVal==100?'class="on"':''} onclick="gmChip('gmRoadBet',100,this)">100 ₽</button>
        <button ${gmRoadBetVal==500?'class="on"':''} onclick="gmChip('gmRoadBet',500,this)">500 ₽</button>
        <button ${gmRoadBetVal==1000?'class="on"':''} onclick="gmChip('gmRoadBet',1000,this)">1000 ₽</button>
      </div>
      <button class="gm-spin" onclick="gmRoadStart()">${I('play')}Старт — выйти на дорогу</button>`;
  }else{
    const s = gmRoad.step;
    const curMult = s > 0 ? GM_ROAD_MULTS[s-1] : 0;
    const cash = s > 0 ? Math.round(gmRoad.bet * curMult * 100) / 100 : 0;
    el.innerHTML = `
      <div class="gm-road-stat">
        <span>Ставка <b>${fmtMoney(gmRoad.bet)}</b></span>
        <span>Шанс шага <b>${GM_ROAD_ODDS[s]}%</b></span>
        <span>Сейчас <b>${s > 0 ? gmFmtMult(curMult) : '—'}</b></span>
      </div>
      <div class="gm-road-btns">
        <button class="gm-spin" onclick="gmRoadStep()">${I('bolt')}Шаг</button>
        <button class="gm-spin ghost ${s > 0 ? '' : 'off'}" onclick="gmRoadCash()">${I('money')}Забрать ${s > 0 ? fmtMoney(cash) : ''}</button>
      </div>`;
  }
}

function gmRoadStart(){
  if(gmRoad.active) return;
  const bet = gmBet('gmRoadBet');
  if(!bet) return;
  if(!gmLimitCheck(bet)) return;
  if(!walletCharge(bet, 'Ставка: Дорога OKO')) return;
  gmLimitSpend(bet);
  gmWager(bet);
  gmRoad = {active:true, step:0, bet, busy:false};
  gmRoadClearTiles();
  gmSyncEye(true);
  gmRoadMultsRender();
  gmRoadCtrl();
  gmRoadMarkNext();
  gmUpdateBalance();
}

function gmRoadStep(){
  if(!gmRoad.active || gmRoad.busy) return;
  gmRoad.busy = true;
  gmLockBets('gmRoadCtrl', true); /* кнопки Шаг/Забрать не жмутся во время прыжка */
  const i = gmRoad.step;
  const tile = gmRoadTiles()[i];
  tile.classList.remove('next');
  gmMoveEye(i); /* прыжок на плиту */
  setTimeout(()=>{
    const ok = Math.random() * 100 < GM_ROAD_ODDS[i];
    if(ok){
      tile.classList.add('ok');
      gmSpark(tile);
      gmRoad.step++;
      gmRoad.busy = false;
      gmRoadMultsRender();
      if(gmRoad.step === GM_ROAD_MULTS.length){
        gmRoadCash(); /* дошёл до конца — авто-выплата ×8 */
      }else{
        gmRoadCtrl();
        gmRoadMarkNext();
      }
    }else{
      tile.classList.add('bad');
      document.getElementById('gmEye').classList.add('gm-fall'); /* глаз падает */
      okoEarn(gmRoad.bet, 'Игры: дорога');
      gmHistPush({g:'road', bet:gmRoad.bet, win:0, mult:0, at: Date.now()});
      const lostBet = gmRoad.bet, lostStep = i + 1;
      gmRoad.active = false;
      setTimeout(()=>{
        gmRoad.busy = false;
        gmRoadClearTiles();
        gmSyncEye(true);
        gmRoadMultsRender();
        gmRoadCtrl(`<b class="gm-lose">Провал</b>плита ${lostStep} не выдержала — ставка ${fmtMoney(lostBet)} сгорела`);
      }, 950);
    }
  }, 520);
}

function gmRoadCash(){
  if(!gmRoad.active || gmRoad.step < 1 || gmRoad.busy) return;
  const mult = GM_ROAD_MULTS[gmRoad.step - 1];
  const base = Math.round(gmRoad.bet * mult * 100) / 100;
  const win = gmApplyBoost(base);
  walletAdd(win, 'Выигрыш: Дорога OKO');
  const net = gmRoad.bet - base;
  if(net > 0) okoEarn(net, 'Игры: дорога');
  gmHistPush({g:'road', bet:gmRoad.bet, win, mult, at: Date.now()});
  gmConfetti(document.querySelector('.gm-road-card'));
  gmLbAddWin(win);
  gmRoad.active = false;
  gmRoadClearTiles();
  gmSyncEye(true);
  gmRoadMultsRender();
  gmRoadCtrl(`<b class="gm-win">+ ${fmtMoney(win)}</b>забрал на ${gmFmtMult(mult)} — выплата на кошельке`);
  gmUpdateBalance();
}

/* ================= КОСТИ OKO =================
   Две 3D-кости (CSS-кубы), ставка на сумму: меньше 7 (×1,9), ровно 7 (×5),
   больше 7 (×1,9). Честный бросок 2d6; RTP: 15/36×1.9 ≈ 79%, 6/36×5 ≈ 83%. */
const GM_DICE_BETS = {under:{m:1.9, t:'меньше 7'}, seven:{m:5, t:'ровно 7'}, over:{m:1.9, t:'больше 7'}};
const GM_PIPS = {1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8]};
/* грань -> значение (противоположные в сумме дают 7) и её позиция на кубе */
const GM_FACES = [
  ['translateZ(32px)', 1], ['rotateY(180deg) translateZ(32px)', 6],
  ['rotateY(90deg) translateZ(32px)', 3], ['rotateY(-90deg) translateZ(32px)', 4],
  ['rotateX(90deg) translateZ(32px)', 5], ['rotateX(-90deg) translateZ(32px)', 2]
];
/* какой поворот куба показывает значение зрителю */
const GM_DICE_ROT = {1:[0,0], 2:[90,0], 3:[0,-90], 4:[0,90], 5:[-90,0], 6:[0,180]};
let gmDice = {rolling:false, pick:'under', token:0};
let gmDiceTurns = {gmDie1:0, gmDie2:0};

function gmBuildDice(){
  ['gmDie1','gmDie2'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = '<div class="gm-cube">' + GM_FACES.map(([tf, v])=>
      `<div class="gm-face" style="transform:${tf}">${Array.from({length:9},(_,i)=>`<i class="${GM_PIPS[v].includes(i)?'on':''}"></i>`).join('')}</div>`
    ).join('') + '</div>';
  });
  gmDiceSet('gmDie1', 3, true);
  gmDiceSet('gmDie2', 4, true);
}
/* повернуть куб на значение v; при броске — с накопленными кувырками по двум осям */
function gmDiceSet(id, v, instant){
  const cube = document.querySelector('#'+id+' .gm-cube');
  if(!cube) return;
  const [rx, ry] = GM_DICE_ROT[v];
  if(instant){
    cube.style.transition = 'none';
    gmDiceTurns[id] = 0;
    cube.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    void cube.offsetWidth;
    return;
  }
  gmDiceTurns[id] += 2 + Math.floor(Math.random()*3); /* +2–4 полных оборота */
  const k = gmDiceTurns[id] * 360;
  cube.style.transition = 'transform 1.5s cubic-bezier(.18,.72,.24,1)';
  cube.style.transform = `rotateX(${rx + k}deg) rotateY(${ry + k}deg)`;
}
function gmDicePick(k, btn){
  if(gmDice.rolling) return;
  gmDice.pick = k;
  document.querySelectorAll('#gmDicePicks button').forEach(b=>b.classList.toggle('on', b === btn));
}
function gmDiceSetResult(html){
  const el = document.getElementById('gmDiceResult');
  if(el) el.innerHTML = html;
}
function gmDiceRoll(){
  if(gmDice.rolling){ toast('Кости ещё в воздухе'); return; }
  const bet = gmBet('gmDiceBet');
  if(!bet) return;
  if(!gmLimitCheck(bet)) return;
  if(!walletCharge(bet, 'Ставка: Кости OKO')) return;
  gmLimitSpend(bet);
  gmWager(bet);
  gmUpdateBalance();

  gmDice.rolling = true;
  const token = ++gmDice.token;
  document.getElementById('gmDiceBtn').classList.add('off');
  gmLockBets('gmGame-dice', true);
  gmDiceSetResult(`<span class="gm-run">Ставка ${fmtMoney(bet)} на «${GM_DICE_BETS[gmDice.pick].t}» — кости в воздухе…</span>`);

  const d1 = 1 + Math.floor(Math.random()*6);
  const d2 = 1 + Math.floor(Math.random()*6);
  gmDiceSet('gmDie1', d1);
  gmDiceSet('gmDie2', d2);

  /* transitionend + страховочный таймер (паттерн рулетки), token = один вызов */
  const settle = ()=>{
    if(token !== gmDice.token || !gmDice.rolling) return;
    gmDice.rolling = false;
    gmDiceFinish(bet, d1, d2);
  };
  const cube = document.querySelector('#gmDie1 .gm-cube');
  if(cube) cube.addEventListener('transitionend', settle, {once:true});
  setTimeout(settle, 1700);
}
function gmDiceFinish(bet, d1, d2){
  document.getElementById('gmDiceBtn').classList.remove('off');
  gmLockBets('gmGame-dice', false);
  const sum = d1 + d2;
  const out = sum < 7 ? 'under' : (sum > 7 ? 'over' : 'seven');
  const cfg = GM_DICE_BETS[gmDice.pick];
  const hit = out === gmDice.pick;
  const base = hit ? Math.round(bet * cfg.m * 100) / 100 : 0;
  const win = gmApplyBoost(base);
  /* подсветить фактический исход на кнопках */
  const ob = document.querySelector(`#gmDicePicks button[data-pick="${out}"]`);
  if(ob){ ob.classList.add('hit'); setTimeout(()=>ob.classList.remove('hit'), 1500); }
  if(win > 0){
    walletAdd(win, 'Выигрыш: Кости OKO');
    gmConfetti(document.querySelector('.gm-dice-card'));
    gmLbAddWin(win);
    gmDiceSetResult(`<b class="gm-win">+ ${fmtMoney(win)}</b><span>Выпало ${d1} + ${d2} = ${sum} — ставка «${cfg.t}» ${gmFmtMult(cfg.m)} сыграла</span>`);
  }else{
    const card = document.querySelector('.gm-dice-card');
    card.classList.remove('gm-shake'); void card.offsetWidth; card.classList.add('gm-shake');
    gmDiceSetResult(`<b class="gm-lose">×0</b><span>Выпало ${d1} + ${d2} = ${sum} (${GM_DICE_BETS[out].t}) — ставка «${cfg.t}» не сыграла</span>`);
  }
  const net = bet - base;
  if(net > 0) okoEarn(net, 'Игры: кости');
  gmHistPush({g:'dice', bet, win, mult: hit ? cfg.m : 0, d: sum, at: Date.now()});
  gmUpdateBalance();
}

/* ================= ТАБЛИЦА ЛИДЕРОВ НЕДЕЛИ =================
   Топ-10: мок-игроки + свой ник. Свои выигрыши реально суммируются и двигают
   позицию. Персист под 'oko-games-lb', сброс каждую неделю. */
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
function gmPluralWins(n){
  if(n % 10 === 1 && n % 100 !== 11) return 'выигрыш';
  if(n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return 'выигрыша';
  return 'выигрышей';
}
function gmLbRow(r, pos){
  const mv = r.me && GM_LB.move ? `<svg class="i gm-lb-mv ${GM_LB.move}"><use href="#i-chev"/></svg>` : '';
  const posHtml = pos === 1 ? `<b class="gm-lb-pos p1">${I('gm-cup')}</b>` : `<b class="gm-lb-pos ${pos<=3?'p'+pos:''}">${pos}</b>`;
  return `<div class="gm-lb-row ${r.me ? 'me' : ''}">
    ${posHtml}
    <span class="gm-lb-ava">${esc((r.n[0]||'?').toUpperCase())}</span>
    <div class="gm-lb-b">
      <span class="gm-lb-n">${esc(r.n)}${r.me ? vBadge(r.n) : ''}${r.me ? '<i class="gm-lb-you">ты</i>' : ''}${mv}</span>
      <small>${r.w} ${gmPluralWins(r.w)} за неделю</small>
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
  let html = `<div class="gm-lb-head"><span>${I('gm-cup')}Выигрыши за эту неделю</span><small>сброс через ${days} ${days === 1 ? 'день' : days < 5 ? 'дня' : 'дней'}</small></div>`;
  html += rows.slice(0, 10).map((r,i)=>gmLbRow(r, i+1)).join('');
  if(myIdx >= 10) html += `<div class="gm-lb-gap">···</div>` + gmLbRow(rows[myIdx], myIdx + 1);
  el.innerHTML = html;
}

/* ================= ПРИЗОВАЯ КРУТКА =================
   Колесо призового пула: деньги, билеты, скидки на тариф (−10/−20/−50%),
   тариф на месяц, бонусные проверки видео и бусты. Один бесплатный спин
   в сутки ('oko-games-bonus'), далее — за 100 ₽ или за 1 билет.
   Денежные призы = расход OKO (маркетинг), okoEarn не трогаем;
   платная крутка 100 ₽ — доход (okoEarn в gmSpinMode). */
const GM_POOL = [
  {t:'money',  v:100,   w:210, s:'100 ₽',  c:0},
  {t:'ticket', v:1,     w:200, s:'1 бил',  c:1},
  {t:'money',  v:250,   w:150, s:'250 ₽',  c:0},
  {t:'check',  v:3,     w:120, s:'3 пров', c:2},
  {t:'ticket', v:2,     w:105, s:'2 бил',  c:1},
  {t:'disc',   v:10,    w:95,  s:'−10%',   c:2},
  {t:'boost',  v:2,     w:60,  s:'×2',     c:3},
  {t:'ticket', v:5,     w:45,  s:'5 бил',  c:3},
  {t:'disc',   v:20,    w:34,  s:'−20%',   c:3},
  {t:'money',  v:1000,  w:18,  s:'1000 ₽', c:4},
  {t:'disc',   v:50,    w:7,   s:'−50%',   c:4},
  {t:'tier',   v:'PRO', w:6,   s:'PRO',    c:4}
];
/* палитра секторов по «редкости», зависит от темы: [фон, подпись] */
const GM_POOL_COLS_DARK = [
  ['#16220b','#a9c47f'], ['#20340a','#c9ff70'], ['#33520a','#e4ffbf'], ['#5f9c0d','#0c1400'], ['#9AFF00','#0a1400']
];
const GM_POOL_COLS_LIGHT = [
  ['#e9f2d8','#5f7a3c'], ['#d8e9ac','#456314'], ['#bfe07f','#294709'], ['#8ccf2a','#0d2200'], ['#9AFF00','#0a1400']
];
function gmPoolCols(){ return gmIsLight() ? GM_POOL_COLS_LIGHT : GM_POOL_COLS_DARK; }
let gmBonus = {spinning:false, token:0, angle:0};

function gmPluralPrize(n){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return 'призов';
  if(b > 1 && b < 5) return 'приза';
  if(b === 1) return 'приз';
  return 'призов';
}

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

/* баннер входа на экране игр */
function gmBonusBtnRender(){
  const b = document.getElementById('gmBonusBtn');
  if(!b) return;
  const free = !gmBonusClaimedToday();
  b.classList.toggle('done', !free);
  if(free){
    b.innerHTML = `${I('gm-gift')}<div class="gm-bonus-t"><span>Призовая крутка</span><small>бесплатный спин сегодня — билеты, скидки, проверки, ₽</small></div>${I('chev','gm-bonus-chev')}`;
  }else{
    b.innerHTML = `${I('gm-gift')}<div class="gm-bonus-t"><span>Призовая крутка</span><small>бесплатно через <b id="gmBonusCd">${gmFmtCd(gmBonusLeftMs())}</b> · или за 100 ₽ / 1 билет</small></div>${I('chev','gm-bonus-chev')}`;
  }
}
/* баннер «Мои призы» */
function gmPrizesBtnRender(){
  const b = document.getElementById('gmPrizesBtn');
  if(b){
    const n = GM_PRIZES.length, act = gmPrizesActiveCount();
    b.innerHTML = `${I('gm-cup')}<div class="gm-bonus-t"><span>Мои призы</span><small>${n ? `${n} ${gmPluralPrize(n)} · ${act} к использованию` : 'ещё нет — крути призовое колесо'}</small></div>${I('chev','gm-bonus-chev')}`;
  }
  document.querySelectorAll('.gm-prizes-cnt').forEach(e=>{ e.textContent = GM_PRIZES.length; });
}

function gmBonusOpen(){
  openSheet('gmBonus'); /* navstack сам ведёт back по патчу openSheet/closeSheet */
  gmBonusRender();
}
/* три режима запуска: бесплатно / 100 ₽ / 1 билет */
function gmSpinModesHtml(){
  const free = !gmBonusClaimedToday();
  return `
    <button class="gm-spin ${free ? '' : 'off'}" id="gmSpinFree" onclick="gmSpinMode('free')">${I('gm-gift')}${
      free ? 'Бесплатно сегодня' : `<span class="gm-spin-cd">Бесплатно через <b id="gmFreeCd">${gmFmtCd(gmBonusLeftMs())}</b></span>`
    }</button>
    <div class="gm-spin-alt">
      <button class="gm-spin ghost" id="gmSpinPay" onclick="gmSpinMode('pay')">${I('money')}100 ₽</button>
      <button class="gm-spin ghost ${GM_TICKETS >= 1 ? '' : 'off'}" id="gmSpinTk" onclick="gmSpinMode('ticket')">${I('gm-ticket')}1 билет</button>
    </div>`;
}
function gmBonusRender(){
  const el = document.getElementById('gmBonusBody');
  if(!el) return;
  const COLS = gmPoolCols();
  const N = GM_POOL.length, seg = 360 / N;
  const stops = GM_POOL.map((p,i)=>`${COLS[p.c][0]} ${i*seg}deg ${(i+1)*seg}deg`).join(',');
  const secs = GM_POOL.map((p,i)=>
    `<span class="gm-bsec" style="color:${COLS[p.c][1]};transform:translate(-50%,-50%) rotate(${i*seg + seg/2 - 15}deg) translateY(-80px)">${p.s}</span>`
  ).join('');
  el.innerHTML = `
    <p class="gm-spin-intro">Один бесплатный спин в день. В пуле — деньги, билеты, скидки на тариф, месяц PRO, проверки видео и бусты.</p>
    <div class="gm-bonus-stage">
      <div class="gm-pointer"><svg width="30" height="26" viewBox="0 0 30 26"><path d="M15 26L2 2h26z" fill="#9AFF00" stroke="#0a0a0a" stroke-width="2" stroke-linejoin="round"/></svg></div>
      <div class="gm-bwheel-wrap">
        <div class="gm-bwheel" id="gmBWheel" style="background:conic-gradient(from -15deg, ${stops})">${secs}</div>
        <div class="gm-bwheel-hub">${I('gm-gift')}</div>
        <div class="gm-reveal" id="gmReveal"></div>
      </div>
    </div>
    <div class="gm-result" id="gmBonusRes"><span class="gm-hint">Крути — приз мгновенно попадёт в «Мои призы»</span></div>
    <div class="gm-spin-modes" id="gmSpinModes">${gmSpinModesHtml()}</div>
    <button class="gm-prizes-link" onclick="gmPrizesOpen()">${I('gm-cup')}<span>Мои призы</span><b class="gm-prizes-cnt">${GM_PRIZES.length}</b></button>`;
  gmBonus.angle = 0;
}
function gmSpinMode(mode){
  if(gmBonus.spinning) return;
  if(mode === 'free'){
    if(gmBonusClaimedToday()){ toast('Бесплатная крутка сегодня уже была — за 100 ₽ или билет'); return; }
  }else if(mode === 'pay'){
    if(!walletCharge(100, 'Призовая крутка OKO')) return;
    okoEarn(100, 'Игры: призовая крутка');
    gmUpdateBalance();
  }else if(mode === 'ticket'){
    if(!gmTicketsSpend(1)){ toast('Нужен 1 билет — заработай ставками или на колесе'); return; }
  }
  gmPrizeSpin(mode);
}
function gmPrizeSpin(mode){
  gmBonus.spinning = true;
  const token = ++gmBonus.token;
  document.querySelectorAll('#gmSpinModes .gm-spin').forEach(b=>b.classList.add('off'));
  const res = document.getElementById('gmBonusRes');
  if(res) res.innerHTML = `<span class="gm-run">Призовое колесо крутится…</span>`;
  const rev = document.getElementById('gmReveal');
  if(rev){ rev.className = 'gm-reveal'; rev.innerHTML = ''; }

  /* взвешенный приз */
  const total = GM_POOL.reduce((a,p)=>a + p.w, 0);
  let r = Math.random() * total, idx = 0;
  for(let i = 0; i < GM_POOL.length; i++){ if(r < GM_POOL[i].w){ idx = i; break; } r -= GM_POOL[i].w; }
  const seg = 360 / GM_POOL.length;

  const wheel = document.getElementById('gmBWheel');
  const cur = ((gmBonus.angle % 360) + 360) % 360;
  wheel.style.transition = 'none';
  wheel.style.transform = `rotate(${cur}deg)`;
  void wheel.offsetWidth;
  const turns = 5 + Math.floor(Math.random() * 3);
  const jitter = Math.random() * (seg * 0.5) - seg * 0.25; /* внутри сектора */
  const delta = ((360 - idx * seg) - cur + 720) % 360;
  const target = cur + turns * 360 + delta + jitter;
  gmBonus.angle = target;
  wheel.style.transition = 'transform 5.4s cubic-bezier(0.12,0.65,0.13,1)';
  wheel.style.transform = `rotate(${target}deg)`;

  const settle = ()=>{
    if(token !== gmBonus.token || !gmBonus.spinning) return;
    gmBonus.spinning = false;
    gmPrizeGrant(GM_POOL[idx], mode);
  };
  wheel.addEventListener('transitionend', settle, {once:true});
  setTimeout(settle, 5700);
}
function gmPrizeSub(p){
  switch(p.t){
    case 'money':  return 'уже зачислено на кошелёк';
    case 'ticket': return 'билеты — валюта круток и «Мои призы»';
    case 'check':  return 'бонусные проверки видео — в «Мои призы»';
    case 'disc':   return 'промокод в «Мои призы» — применится при оплате тарифа';
    case 'boost':  return 'сработает на следующий выигрыш в любой игре';
    case 'tier':   return 'активирован на месяц — лимиты обновлены';
  }
  return '';
}
function gmPrizeGrant(p, mode){
  if(mode === 'free'){ try{ localStorage.setItem('oko-games-bonus', String(Date.now())); }catch(e){} }
  let title = '', icon = 'gm-gift', prize = null;
  switch(p.t){
    case 'money':
      walletAdd(p.v, 'Приз: призовое колесо'); prize = {type:'money', val:p.v, status:'done'};
      icon = 'money'; title = `+ ${fmtMoney(p.v)}`; break;
    case 'ticket':
      gmTicketsAdd(p.v); prize = {type:'ticket', val:p.v, status:'done'};
      icon = 'gm-ticket'; title = `+ ${p.v} ${gmPluralTk(p.v)}`; break;
    case 'check':
      gmChecksAdd(p.v); prize = {type:'check', val:p.v, status:'active'};
      icon = 'gm-checkvid'; title = `+ ${p.v} проверки видео`; break;
    case 'disc':
      prize = {type:'discount', val:p.v, code:gmMakeCode(), status:'active'};
      icon = 'gm-pct'; title = `Скидка −${p.v}% на тариф`; break;
    case 'boost':
      gmBoostSet(p.v); prize = {type:'boost', val:p.v, status:'active'};
      icon = 'gm-boost'; title = `Буст ×${p.v} к выигрышу`; break;
    case 'tier':
      if(typeof PROFILE !== 'undefined'){ PROFILE.tier = p.v; if(typeof renderMyProfile === 'function') renderMyProfile(); }
      prize = {type:'tier', val:p.v, status:'active'};
      icon = 'crown'; title = `Тариф ${p.v} на месяц`; break;
  }
  gmPrizeAdd(prize);
  gmPrizeReveal(icon, title);
  gmConfetti(document.getElementById('sheet-gmBonus'));
  const res = document.getElementById('gmBonusRes');
  if(res) res.innerHTML = `<b class="gm-win">${title}</b><span>${gmPrizeSub(p)}</span>`;
  gmBonusBtnRender();
  gmPrizesBtnRender();
  gmUpdateBalance();
  gmTicketsRender();
  const modes = document.getElementById('gmSpinModes');
  if(modes) modes.innerHTML = gmSpinModesHtml();
}
/* красивая анимация выпадения приза — карточка в центре колеса */
function gmPrizeReveal(icon, title){
  const rev = document.getElementById('gmReveal');
  if(!rev) return;
  rev.innerHTML = `
    <div class="gm-reveal-rays"></div>
    <div class="gm-reveal-card">
      <span class="gm-reveal-ic">${I(icon)}</span>
      <b>${title}</b>
    </div>`;
  rev.classList.remove('show'); void rev.offsetWidth; rev.classList.add('show');
}

/* ---------- «Мои призы»: шит выпавших призов ---------- */
function gmPrizesOpen(){ openSheet('gmPrizes'); gmPrizesRender(); }
function gmPrizeRow(p){
  const map = {
    money:   ['money',       'Деньги'],
    ticket:  ['gm-ticket',   'Билеты'],
    check:   ['gm-checkvid',  'Проверки видео'],
    discount:['gm-pct',       'Скидка на тариф'],
    boost:   ['gm-boost',     'Буст к выигрышу'],
    tier:    ['crown',        'Тариф на месяц']
  };
  const [ic, cat] = map[p.type] || ['gm-gift', 'Приз'];
  let title = '', extra = '', badge = '', bcls = 'active';
  switch(p.type){
    case 'money':  title = `+ ${fmtMoney(p.val)}`; badge = 'Начислено'; bcls = 'done'; break;
    case 'ticket': title = `+ ${p.val} ${gmPluralTk(p.val)}`; badge = 'Начислено'; bcls = 'done'; break;
    case 'check':  title = `${p.val} проверки видео`; badge = p.status === 'used' ? 'Использовано' : 'Доступно'; bcls = p.status === 'used' ? 'used' : 'active'; break;
    case 'discount':
      title = `Скидка −${p.val}% на тариф`;
      if(p.status === 'active'){ badge = 'Активен'; bcls = 'active'; extra = `<button class="gm-code" onclick="gmCopyCode('${p.code}')">${p.code}${I('copy')}</button>`; }
      else { badge = 'Использован'; bcls = 'used'; extra = `<span class="gm-code used">${p.code}</span>`; }
      break;
    case 'boost':  title = `Буст ×${p.val} к выигрышу`; badge = p.status === 'used' ? 'Использован' : 'Активен'; bcls = p.status === 'used' ? 'used' : 'active'; break;
    case 'tier':   title = `Тариф ${p.val} на месяц`; badge = 'Активен'; bcls = 'active'; break;
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
      `<div class="gm-empty">${I('gm-gift')}<span>Призов пока нет — крути призовое колесо: выпадают билеты, скидки на тариф, проверки видео, бусты и деньги</span></div>
       <button class="gm-spin" onclick="closeSheet();gmBonusOpen()">${I('gm-gift')}К призовому колесу</button>`;
    return;
  }
  el.innerHTML = head + `<div class="gm-prz-list">${GM_PRIZES.map(gmPrizeRow).join('')}</div>`;
}
function gmCopyCode(code){
  const done = ()=>toast('Промокод ' + code + ' скопирован — вставь при оплате тарифа');
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(code).then(done, done); return; }
  }catch(e){}
  done();
}

/* живой обратный отсчёт до полуночи (баннер + кнопка «Бесплатно») */
setInterval(()=>{
  if(!gmBonusClaimedToday()) return;
  const cd = gmFmtCd(gmBonusLeftMs());
  const a = document.getElementById('gmBonusCd');
  const f = document.getElementById('gmFreeCd');
  if(a) a.textContent = cd;
  if(f) f.textContent = cd;
}, 1000);

/* ---------- история игр (последние 20) ---------- */
function gmHistPush(e){
  GM_HIST.unshift(e);
  if(GM_HIST.length > 20) GM_HIST.length = 20;
  try{ localStorage.setItem('oko-games', JSON.stringify(GM_HIST)); }catch(err){}
  gmRenderHistory();
}
function gmRenderHistory(){
  const el = document.getElementById('gmHistory');
  if(!el) return;
  if(!GM_HIST.length){
    el.innerHTML = `<div class="gm-empty">${I('clock')}<span>Ещё нет сыгранных раундов — сделай первую ставку</span></div>`;
    return;
  }
  el.innerHTML = GM_HIST.map(h=>{
    const win = h.win > 0;
    const name = GM_GAME_NAMES[h.g] || h.g;
    const d = new Date(h.at);
    const time = d.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}) + ' ' +
                 d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    let detail;
    if(h.g === 'dice') detail = `выпало ${h.d != null ? h.d : '—'} · ` + (win ? gmFmtMult(h.mult) : 'проигрыш');
    else detail = win ? (h.g === 'wheel' ? 'сектор ' : 'забрал на ') + gmFmtMult(h.mult) : 'проигрыш';
    return `<div class="gm-op">
      <span class="gm-op-ic ${win ? 'in' : 'out'}">${I(GM_GAME_ICONS[h.g] || 'gm-chip')}</span>
      <div class="gm-op-b"><span class="gm-op-t1">${name} · ставка ${fmtMoney(h.bet)}</span><span class="gm-op-t2">${detail} · ${time}</span></div>
      <b class="gm-op-sum ${win ? 'in' : 'out'}">${win ? '+' : '−'} ${fmtMoney(win ? h.win : h.bet)}</b>
    </div>`;
  }).join('');
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
/* пересобрать колёса под новую тему (палитра секторов задаётся из JS) */
if(typeof applyTheme === 'function'){
  const _prevApplyThemeGm = applyTheme;
  applyTheme = function(t){
    _prevApplyThemeGm(t);
    gmBuildWheel();
    if(document.getElementById('gmBWheel') && !gmBonus.spinning) gmBonusRender();
  };
}

const _prevShowTabGm = showTab;
showTab = function(t){
  _prevShowTabGm(t);
  if(t === 'games'){
    gmUpdateBalance();
    gmRenderLimit();
    gmRenderHistory();
    gmLbDrift();      /* таблица лидеров живёт: мок-игроки тоже выигрывают */
    gmLbRender();
    gmBonusBtnRender();
    gmPrizesBtnRender();
    gmTicketsRender();
    gmBoostBadge();
    requestAnimationFrame(()=>gmSyncEye(true)); /* позиция глаза после показа экрана */
  }
};

/* ---------- самоинициализация ---------- */
regTitle('games', 'Игры');
addSvcTile({id:'games', label:'Игры OKO', ico:'fire', first:true, onclick:()=>showTab('games')});
gmBuildWheel();
gmBuildDice();
gmRoadMultsRender();
gmRoadCtrl();
gmRenderHistory();
gmRenderLimit();
gmLbEnsure();
gmLbRender();
gmBonusBtnRender();
gmPrizesBtnRender();
gmTicketsRender();
gmBoostBadge();
gmUpdateBalance();
window.addEventListener('resize', ()=>{
  const sc = document.getElementById('screen-games');
  if(sc && sc.classList.contains('active')) gmSyncEye(true);
});

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
    badge.innerHTML = `${I('gm-pct')}<span>Промокод из игр <b>${d.code}</b> · дополнительно −${d.val}%</span>`;
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
