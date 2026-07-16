/* ===== GAMES: игровой центр OKO — рулетка + «Дорога» (префикс gm-) =====
   Ставки ТОЛЬКО с кошелька (walletCharge/walletAdd), доход OKO — okoEarn.
   Механика рулетки перенесена из Mortis: CSS-колесо (conic-gradient) +
   страховочный setTimeout — результат обрабатывается ровно один раз. */

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
})();

/* ---------- общее состояние ---------- */
const GM_LIMIT_MAX = 10000; /* дневной лимит ставок, ₽ */
const GM_HIST = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-games'))||[]; }catch(e){ return []; } })();

function gmFmtMult(m){ return '×' + String(m).replace('.', ','); }

function gmUpdateBalance(){
  const el = document.getElementById('gmBalance');
  if(el) el.textContent = fmtMoney(WALLET.balance);
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
  ['wheel','road'].forEach(k=>{
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
const GM_COLORS = { /* [фон сектора, цвет подписи] */
  0:  ['#141414', '#6e6e6e'],
  1.2:['#1e3305', '#c9ff70'],
  1.5:['#2e4d06', '#dbff9e'],
  2:  ['#487a08', '#f0ffd8'],
  3:  ['#6fb50d', '#0c1400'],
  10: ['#9AFF00', '#000000']
};
const GM_WEIGHTS = [[0,530],[1.2,230],[1.5,120],[2,60],[3,40],[10,20]]; /* из 1000, RTP ≈ 89.6% */

let gmWheelAngle = 0;
let gmSpinning = false;   /* флаг из Mortis: результат ровно один раз */
let gmSpinToken = 0;

function gmBuildWheel(){
  const w = document.getElementById('gmWheel');
  if(!w) return;
  const stops = GM_SECTORS.map((m,i)=>`${GM_COLORS[m][0]} ${i*30}deg ${(i+1)*30}deg`).join(',');
  w.style.background = `conic-gradient(from -15deg, ${stops})`;
  w.innerHTML = GM_SECTORS.map((m,i)=>
    `<span class="gm-sec" style="color:${GM_COLORS[m][1]};transform:translate(-50%,-50%) rotate(${i*30}deg) translateY(-96px)">${gmFmtMult(m)}</span>`
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
  gmUpdateBalance();

  gmSpinning = true;
  const token = ++gmSpinToken;
  document.getElementById('gmSpinBtn').classList.add('off');
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
  const win = Math.round(bet * mult * 100) / 100;
  if(win > 0){
    walletAdd(win, 'Выигрыш в рулетке');
    gmConfetti(document.querySelector('.gm-wheel-card'));
    gmSetResult(`<b class="gm-win">+ ${fmtMoney(win)}</b><span>Сектор ${gmFmtMult(mult)} — выплата уже на кошельке</span>`);
  }else{
    const wrap = document.getElementById('gmWheelWrap');
    wrap.classList.remove('gm-shake'); void wrap.offsetWidth; wrap.classList.add('gm-shake');
    gmSetResult(`<b class="gm-lose">×0</b><span>Ставка сгорела — колесо ждёт реванша</span>`);
  }
  const net = bet - win;
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
function gmRoadClearTiles(){ gmRoadTiles().forEach(t=>t.classList.remove('ok','bad')); }

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
  gmRoad = {active:true, step:0, bet, busy:false};
  gmRoadClearTiles();
  gmSyncEye(true);
  gmRoadMultsRender();
  gmRoadCtrl();
  gmUpdateBalance();
}

function gmRoadStep(){
  if(!gmRoad.active || gmRoad.busy) return;
  gmRoad.busy = true;
  const i = gmRoad.step;
  const tile = gmRoadTiles()[i];
  gmMoveEye(i); /* прыжок на плиту */
  setTimeout(()=>{
    const ok = Math.random() * 100 < GM_ROAD_ODDS[i];
    if(ok){
      tile.classList.add('ok');
      gmRoad.step++;
      gmRoad.busy = false;
      gmRoadMultsRender();
      if(gmRoad.step === GM_ROAD_MULTS.length){
        gmRoadCash(); /* дошёл до конца — авто-выплата ×8 */
      }else{
        gmRoadCtrl();
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
  const win = Math.round(gmRoad.bet * mult * 100) / 100;
  walletAdd(win, 'Выигрыш: Дорога OKO');
  const net = gmRoad.bet - win;
  if(net > 0) okoEarn(net, 'Игры: дорога');
  gmHistPush({g:'road', bet:gmRoad.bet, win, mult, at: Date.now()});
  gmConfetti(document.querySelector('.gm-road-card'));
  gmRoad.active = false;
  gmRoadClearTiles();
  gmSyncEye(true);
  gmRoadMultsRender();
  gmRoadCtrl(`<b class="gm-win">+ ${fmtMoney(win)}</b>забрал на ${gmFmtMult(mult)} — выплата на кошельке`);
  gmUpdateBalance();
}

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
    const name = h.g === 'wheel' ? 'Рулетка OKO' : 'Дорога OKO';
    const d = new Date(h.at);
    const time = d.toLocaleDateString('ru-RU', {day:'2-digit', month:'2-digit'}) + ' ' +
                 d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    const detail = win ? (h.g === 'wheel' ? 'сектор ' : 'забрал на ') + gmFmtMult(h.mult) : 'проигрыш';
    return `<div class="gm-op">
      <span class="gm-op-ic ${win ? 'in' : 'out'}">${I(h.g === 'wheel' ? 'gm-chip' : 'gm-road')}</span>
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
const _prevShowTabGm = showTab;
showTab = function(t){
  _prevShowTabGm(t);
  if(t === 'games'){
    gmUpdateBalance();
    gmRenderLimit();
    gmRenderHistory();
    requestAnimationFrame(()=>gmSyncEye(true)); /* позиция глаза после показа экрана */
  }
};

/* ---------- самоинициализация ---------- */
regTitle('games', 'Игры');
addSvcTile({id:'games', label:'Игры OKO', ico:'fire', first:true, onclick:()=>showTab('games')});
gmBuildWheel();
gmRoadMultsRender();
gmRoadCtrl();
gmRenderHistory();
gmRenderLimit();
gmUpdateBalance();
window.addEventListener('resize', ()=>{
  const sc = document.getElementById('screen-games');
  if(sc && sc.classList.contains('active')) gmSyncEye(true);
});
