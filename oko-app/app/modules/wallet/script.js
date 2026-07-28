/* ================= WALLET: экран кошелька / лицевой счёт =================
   Опирается на core-ext: WALLET, walletAdd, walletCharge, fmtMoney, okoEarn.
   Патчит денежные потоки ядра (тарифы, продвижение, биржа, переводы, партнёрка).
   Плюс: график баланса 30 дней, автопродление PRO, выписка (.txt + документ),
   реквизиты пополнения, лимиты счёта и ПИН-код на вывод. */

/* ---------- иконки TON (кристалл) и «скачать» в общий defs ---------- */
(function walAddIcons(){
  const defs = document.querySelector('svg defs');
  if(!defs) return;
  if(!document.getElementById('i-ton')){
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id','i-ton'); s.setAttribute('viewBox','0 0 100 100');
    s.innerHTML = '<path d="M18 20h64L50 88 18 20z" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 20v68" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>';
    defs.appendChild(s);
  }
  if(!document.getElementById('i-dl')){
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id','i-dl'); s.setAttribute('viewBox','0 0 100 100');
    s.innerHTML = '<path d="M50 14v44M32 42l18 18 18-18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 80h60" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>';
    defs.appendChild(s);
  }
  /* лупа (поиск по истории) */
  if(!document.getElementById('i-search')){
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id','i-search'); s.setAttribute('viewBox','0 0 100 100');
    s.innerHTML = '<circle cx="43" cy="43" r="27" fill="none" stroke="currentColor" stroke-width="8"/><path d="M63 63 84 84" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>';
    defs.appendChild(s);
  }
  /* кубик (категория «Игры») */
  if(!document.getElementById('i-dice')){
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id','i-dice'); s.setAttribute('viewBox','0 0 100 100');
    s.innerHTML = '<rect x="20" y="20" width="60" height="60" rx="14" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="37" cy="37" r="5.5" fill="currentColor"/><circle cx="63" cy="37" r="5.5" fill="currentColor"/><circle cx="50" cy="50" r="5.5" fill="currentColor"/><circle cx="37" cy="63" r="5.5" fill="currentColor"/><circle cx="63" cy="63" r="5.5" fill="currentColor"/>';
    defs.appendChild(s);
  }
})();

/* ---------- демо-наполнение леджера (один раз, реалистичные операции) ---------- */
(function walSeedDemo(){
  try{ if(localStorage.getItem('oko-wallet-demo')==='1') return; }catch(e){}
  const H = 3600e3, now = Date.now();
  const demo = [
    {t:'-', sum:300,  why:'Перевод в чате · Марк Волков',            at: now - 5*H},
    {t:'-', sum:200,  why:'Игра «Рулетка» · ставка',                 at: now - 9*H},
    {t:'-', sum:500,  why:'Покупка на Бирже: Монтаж Reels под ключ', at: now - 26*H},
    {t:'-', sum:349,  why:'Продвижение объявления · Турбо',          at: now - 30*H},
    {t:'-', sum:1490, why:'Тариф START · 1 мес',                     at: now - 50*H},
    {t:'+', sum:5000, why:'Пополнение · Карта РФ',                   at: now - 52*H},
  ];
  demo.forEach(op=>{ WALLET.balance += op.t==='+' ? op.sum : -op.sum; });
  WALLET.ledger = demo.concat(WALLET.ledger);
  WALLET.ledger.sort((a,b)=>b.at-a.at);
  if(!WALLET.hold) WALLET.hold = 500; // эскроу по активной сделке Биржи
  walletSave();
  try{ localStorage.setItem('oko-wallet-demo','1'); }catch(e){}
})();

/* история за месяц для графика (только старые даты, баланс НЕ меняют —
   восстанавливаются графиком назад от текущего) */
(function walSeedDemo2(){
  try{ if(localStorage.getItem('oko-wallet-demo2')==='1') return; }catch(e){}
  const D = 864e5, now = Date.now();
  const hist = [
    {t:'+', sum:1200, why:'Продажа на Бирже: обложка канала',   at: now - 3*D},
    {t:'-', sum:150,  why:'Стикеры OKO · набор «Неон»',         at: now - 4*D},
    {t:'+', sum:900,  why:'Партнёрская программа · выплата',    at: now - 6*D},
    {t:'-', sum:349,  why:'Продвижение объявления · Старт',     at: now - 8*D},
    {t:'-', sum:600,  why:'Рулетка OKO · платный спин',          at: now - 11*D},
    {t:'+', sum:800,  why:'Пополнение · USDT',                  at: now - 13*D},
    {t:'-', sum:1490, why:'Тариф START · 1 мес',                at: now - 19*D},
    {t:'+', sum:700,  why:'Возврат по спору · Биржа',           at: now - 22*D},
    {t:'-', sum:250,  why:'Перевод в чате · Аня Соколова',      at: now - 26*D},
    {t:'+', sum:1500, why:'Пополнение · Карта РФ',              at: now - 28*D},
  ];
  WALLET.ledger = WALLET.ledger.concat(hist);
  WALLET.ledger.sort((a,b)=>b.at-a.at);
  walletSave();
  try{ localStorage.setItem('oko-wallet-demo2','1'); }catch(e){}
})();

/* ---------- состояние модуля ---------- */
let walFilter = 'all';
let walSearch = '';
let walTopupState = {sum:1000, method:'card'};
let walWdState = {sum:0, method:'card'};
const WAL_METHODS = [
  ['card','Карта РФ','card'],
  ['usdt','USDT','money'],
  ['lava','Lava.top','bolt'],
  ['ton','TON','ton'],
];
const WAL_M_LABEL = {card:'Карта РФ', usdt:'Крипта USDT', lava:'Lava.top', ton:'TON'};
const WAL_USD_RATE = 90; // курс прототипа для партнёрских выплат в $
/* суточный лимит вывода зависит от тарифа (лимиты по тарифу) */
const WAL_WD_LIMITS = {FREE:50000, START:100000, PRO:300000, BUSINESS:1000000, MAX:5000000};
const WAL_WD_DAY_LIMIT = 100000;        // дефолт (fallback без paywall-API)
function walTier(){
  if(typeof window.okoHasSub === 'function'){
    if(window.okoHasSub('MAX')) return 'MAX';
    if(window.okoHasSub('BUSINESS')) return 'BUSINESS';
    if(window.okoHasSub('PRO')) return 'PRO';
    if(window.okoHasSub('START')) return 'START';
    return 'FREE';
  }
  const t = (typeof PROFILE!=='undefined' && PROFILE.tier) ? String(PROFILE.tier).toUpperCase() : 'FREE';
  return WAL_WD_LIMITS[t] ? t : 'FREE';
}
function walWdLimit(){ return WAL_WD_LIMITS[walTier()] || WAL_WD_DAY_LIMIT; }
const WAL_NOCONF_LIMIT = 5000;          // покупки без подтверждения
const WAL_CARD_NUM = '2200 7007 1234 5566';
const WAL_USDT_ADDR = 'TQoKo4fHFYyeJtsDdD7TgKLxAV1mFJnEok';
const WAL_TON_ADDR = 'UQAoKoAppTonWa11etMockAddr9hfP2vXqLmTz4A';

/* доп-настройки кошелька (персист): автопродление, ПИН, суточный вывод */
const WAL_X = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-wallet-x'))||{}; }catch(e){ return {}; } })();
function walXSave(){ try{ localStorage.setItem('oko-wallet-x', JSON.stringify(WAL_X)); }catch(e){} }
function walProPrice(){ return (typeof PLANS!=='undefined' && PLANS.PRO) ? PLANS.PRO.mo : 4890; }
function walDMY(ts){ const d = new Date(ts); return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+d.getFullYear(); }
function walDMYT(ts){ const d = new Date(ts); return walDMY(ts)+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function walCopy(txt, msg){ try{ navigator.clipboard.writeText(txt); }catch(e){} toast(msg||'Скопировано'); }

/* ---------- категории операций (расход и доход) ---------- */
function walCat(why){
  if(/продвижен/i.test(why)) return 'Продвижение';
  if(/бирж/i.test(why)) return 'Биржа';
  if(/игр|рулетк|ставк|дорог|кости/i.test(why)) return 'Игры';
  if(/тариф|автопродлен|подписк/i.test(why)) return 'Тарифы';
  if(/вывод/i.test(why)) return 'Вывод средств';
  if(/пополнен/i.test(why)) return 'Пополнение';
  if(/партнёр|партнер|реф(ерал|\b)/i.test(why)) return 'Партнёрка';
  if(/стикер/i.test(why)) return 'Стикеры';
  if(/перевод/i.test(why)) return 'Переводы';
  return 'Прочее';
}
/* иконка категории для строки истории */
const WAL_CAT_IC = {
  'Продвижение':'rocket', 'Биржа':'briefcase', 'Игры':'dice', 'Тарифы':'crown',
  'Вывод средств':'card', 'Пополнение':'plus', 'Партнёрка':'users',
  'Стикеры':'sticker', 'Переводы':'send', 'Прочее':'money'
};
function walCatIc(why){ return WAL_CAT_IC[walCat(why)] || 'money'; }
/* заголовок дня для группировки истории */
const WAL_MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function walDayKey(at){ return new Date(at).toDateString(); }
function walDayLabel(at){
  const d = new Date(at), n = new Date();
  if(d.toDateString() === n.toDateString()) return 'Сегодня';
  const y = new Date(n - 864e5);
  if(d.toDateString() === y.toDateString()) return 'Вчера';
  return d.getDate() + ' ' + WAL_MONTHS[d.getMonth()] + (d.getFullYear() !== n.getFullYear() ? ' ' + d.getFullYear() : '');
}
function walWhen(at){
  const d = new Date(at), n = new Date();
  const hm = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  if(d.toDateString() === n.toDateString()) return 'сегодня ' + hm;
  const y = new Date(n - 864e5);
  if(d.toDateString() === y.toDateString()) return 'вчера ' + hm;
  return String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0') + ' ' + hm;
}

/* ---------- рендер экрана ---------- */
let walShownBal = null;
function walAnimateBalance(){
  const el = document.getElementById('walBalance');
  if(!el) return;
  const target = WALLET.balance;
  const from = walShownBal === null ? target : walShownBal;
  walShownBal = target;
  const t0 = performance.now(), dur = 550;
  (function step(t){
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    const v = Math.round(from + (target - from) * e);
    el.innerHTML = v.toLocaleString('ru-RU').replace(/,/g,' ') + ' <b>₽</b>';
    if(k < 1) requestAnimationFrame(step);
  })(t0);
}
function renderWallet(){
  const scr = document.getElementById('screen-wallet');
  if(!scr) return;
  const acc = document.getElementById('walAccNum'); if(acc) acc.textContent = WALLET.acc;
  walAnimateBalance();
  const hold = document.getElementById('walHold');
  if(hold){
    hold.style.display = WALLET.hold > 0 ? 'inline-flex' : 'none';
    hold.querySelector('span').innerHTML = 'В холде (эскроу): <b>' + fmtMoney(WALLET.hold) + '</b>';
  }
  walRenderStats();
  walRenderCats();
  walRenderLedger();
  walUpdateChips();
  walRenderAutopay();
  walRenderSec();
  walDrawChart(true);
}

/* ---------- СТАТИСТИКА ДОХОДОВ/РАСХОДОВ за 30 дней ---------- */
function walCountUp(el, to, dur){
  if(!el) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce){ el.textContent = fmtMoney(to); return; }
  const from = 0, t0 = performance.now(), D = dur || 700;
  (function step(t){
    const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
    el.textContent = fmtMoney(Math.round(from + (to - from) * e));
    if(k < 1) requestAnimationFrame(step);
  })(t0);
}
function walRenderStats(){
  const box = document.getElementById('walStats');
  if(!box) return;
  const since = Date.now() - 30 * 864e5;
  let inc = 0, exp = 0, part = 0, incN = 0, expN = 0;
  WALLET.ledger.forEach(o=>{
    if(o.at < since) return;
    if(o.t === '+'){ inc += o.sum; incN++; if(walCat(o.why) === 'Партнёрка') part += o.sum; }
    else { exp += o.sum; expN++; }
  });
  const net = inc - exp, mx = Math.max(inc, exp, 1);
  const wIn = (inc / mx * 100).toFixed(1), wOut = (exp / mx * 100).toFixed(1);
  const netUp = net >= 0;
  box.innerHTML = `
    <div class="card wal-stat-card">
      <div class="wal-stat-net">
        <div class="wal-stat-net-l"><span>Чистыми за 30 дней</span><b class="${netUp?'in':'out'}" id="walStatNet">0 ₽</b></div>
        <span class="wal-stat-net-chip ${netUp?'in':'out'}">${netUp?'прибыль':'минус'}</span>
      </div>
      <div class="wal-stat-rows">
        <div class="wal-stat-row">
          <div class="wal-stat-top"><span class="wal-stat-k"><i class="wal-stat-dot in"></i>Доходы<em>${incN}</em></span><b class="in" id="walStatIn">0 ₽</b></div>
          <div class="wal-stat-track"><i class="in" style="width:${wIn}%"></i></div>
        </div>
        <div class="wal-stat-row">
          <div class="wal-stat-top"><span class="wal-stat-k"><i class="wal-stat-dot out"></i>Расходы<em>${expN}</em></span><b class="out" id="walStatOut">0 ₽</b></div>
          <div class="wal-stat-track"><i class="out" style="width:${wOut}%"></i></div>
        </div>
      </div>
      ${part > 0 ? `<div class="wal-stat-part">${I('users')}<span>Партнёрские начисления</span><b>+ ${fmtMoney(part)}</b></div>` : ''}
    </div>`;
  requestAnimationFrame(()=>{
    walCountUp(document.getElementById('walStatNet'), net, 800);
    walCountUp(document.getElementById('walStatIn'), inc, 800);
    walCountUp(document.getElementById('walStatOut'), exp, 800);
  });
}

/* ---------- ГРАФИК БАЛАНСА за 30 дней (восстановление по леджеру) ---------- */
function walSeries(days){
  const now = Date.now(), day = 864e5, pts = [];
  for(let i = days; i >= 0; i--){
    const T = now - i * day;
    let b = WALLET.balance;
    for(const op of WALLET.ledger){
      if(op.at > T) b += op.t === '+' ? -op.sum : op.sum; // откатываем более поздние операции
    }
    pts.push(b);
  }
  return pts;
}
let walChartRAF = 0;
function walDrawChart(animate){
  const cv = document.getElementById('walChart');
  if(!cv) return;
  if(walChartRAF){ cancelAnimationFrame(walChartRAF); walChartRAF = 0; }
  requestAnimationFrame(()=>{
    const W = cv.clientWidth, H = 66;
    if(!W) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pts = walSeries(30), n = pts.length;
    const min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    const span = (max - min) || Math.max(Math.abs(max), 100) * 0.25;
    const lo = min - span * 0.12, hi = max + span * 0.12;
    const X = i => 3 + i / (n - 1) * (W - 6);
    const base = H - 5;                         // ось для «роста»
    const Yfull = v => base - (v - lo) / (hi - lo) * (H - 12);
    const light = document.documentElement.dataset.theme === 'light';
    const accent = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim() || '#9AFF00';
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

    function frame(prog){
      // растём от оси вверх: Y интерполируется от base к финальному
      const Y = v => base + (Yfull(v) - base) * prog;
      ctx.clearRect(0, 0, W, H);
      /* сетка */
      ctx.strokeStyle = light ? 'rgba(0,0,0,.09)' : 'rgba(255,255,255,.08)';
      ctx.lineWidth = 1; ctx.setLineDash([3,5]);
      [0.22, 0.78].forEach(k=>{ ctx.beginPath(); ctx.moveTo(2, H*k); ctx.lineTo(W-2, H*k); ctx.stroke(); });
      ctx.setLineDash([]);
      const path = ()=>{
        ctx.beginPath();
        ctx.moveTo(X(0), Y(pts[0]));
        for(let i = 1; i < n - 1; i++)
          ctx.quadraticCurveTo(X(i), Y(pts[i]), (X(i)+X(i+1))/2, (Y(pts[i])+Y(pts[i+1]))/2);
        ctx.quadraticCurveTo(X(n-1), Y(pts[n-1]), X(n-1), Y(pts[n-1]));
      };
      /* градиент-заливка */
      path();
      ctx.lineTo(X(n-1), H); ctx.lineTo(X(0), H); ctx.closePath();
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, light ? `rgba(83,168,0,${.28*prog})` : `rgba(154,255,0,${.30*prog})`);
      g.addColorStop(1, 'rgba(154,255,0,0)');
      ctx.fillStyle = g; ctx.fill();
      /* линия */
      path();
      ctx.strokeStyle = accent; ctx.lineWidth = 2;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if(!light){ ctx.shadowColor = 'rgba(154,255,0,.55)'; ctx.shadowBlur = 7; }
      ctx.stroke();
      ctx.shadowBlur = 0;
      /* точка «сейчас» */
      ctx.beginPath(); ctx.arc(X(n-1), Y(pts[n-1]), 3.2, 0, Math.PI*2);
      ctx.fillStyle = accent; ctx.fill();
      if(prog > 0.98){
        ctx.beginPath(); ctx.arc(X(n-1), Y(pts[n-1]), 5.6, 0, Math.PI*2);
        ctx.strokeStyle = light ? 'rgba(83,168,0,.35)' : 'rgba(154,255,0,.35)'; ctx.lineWidth = 1.4; ctx.stroke();
      }
    }

    if(animate && !reduce){
      const t0 = performance.now(), D = 780;
      (function run(t){
        const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
        frame(e);
        if(k < 1) walChartRAF = requestAnimationFrame(run); else walChartRAF = 0;
      })(t0);
    } else {
      frame(1);
    }

    /* чип динамики */
    const dEl = document.getElementById('walDelta');
    if(dEl){
      const diff = pts[n-1] - pts[0];
      const pct = pts[0] ? Math.round(diff / Math.abs(pts[0]) * 100) : 0;
      const up = diff >= 0;
      dEl.className = 'wal-delta ' + (up ? 'in' : 'out');
      dEl.innerHTML = `<svg viewBox="0 0 100 100" style="${up?'':'transform:rotate(180deg)'}"><path d="M20 66 50 34 80 66" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></svg>${up?'+':'−'} ${fmtMoney(Math.abs(diff))}${pct ? ' · ' + (up?'+':'−') + Math.abs(pct) + '%' : ''}`;
    }
  });
}

function walRenderCats(){
  const bar = document.getElementById('walCatBar'), wrap = document.getElementById('walCats');
  if(!bar || !wrap) return;
  const sums = {};
  WALLET.ledger.forEach(op=>{ if(op.t==='-') sums[walCat(op.why)] = (sums[walCat(op.why)]||0) + op.sum; });
  const cats = Object.entries(sums).sort((a,b)=>b[1]-a[1]);
  if(!cats.length){
    bar.style.display = 'none';
    wrap.innerHTML = '<div class="wal-cats-empty">Расходов пока нет, всё в плюсе</div>';
    return;
  }
  bar.style.display = 'flex';
  const total = cats.reduce((s,c)=>s+c[1],0);
  const CAT_COLORS = ['#9AFF00','#7ECBEB','#FFB84A','#FF7EA6','#A980FF','#4EE2B8','#FFDF5C','#FF5C5C'];
  bar.innerHTML = cats.map(([,v],i)=>
    `<i style="width:${(v/total*100).toFixed(1)}%;background:${CAT_COLORS[i%CAT_COLORS.length]};animation-delay:${i*70}ms"></i>`).join('');
  wrap.innerHTML = cats.map(([k,v],i)=>{
    const pct = Math.round(v / total * 100);
    const c = CAT_COLORS[i%CAT_COLORS.length];
    return `<span class="wal-cat" style="animation-delay:${i*60}ms"><span class="dot" style="background:${c};box-shadow:0 0 6px ${c}66"></span>${k}<b>${fmtMoney(v)}</b><span class="wal-cat-pct">${pct||'<1'}%</span></span>`;
  }).join('');
}
function walOpTime(at){
  const d = new Date(at);
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function walRenderLedger(){
  const box = document.getElementById('walLedger');
  if(!box) return;
  const q = walSearch;
  const list = WALLET.ledger
    .filter(op => walFilter==='all' || (walFilter==='in' ? op.t==='+' : op.t==='-'))
    .filter(op => !q || (op.why + ' ' + walCat(op.why)).toLowerCase().includes(q))
    .slice().sort((a,b)=>b.at-a.at)
    .slice(0, 80);
  if(!list.length){
    const emptyMsg = q ? 'Ничего не найдено' : walFilter==='in' ? 'Пополнений пока нет' : walFilter==='out' ? 'Списаний пока нет' : 'Операций пока нет';
    box.innerHTML = `<div class="wal-empty">${I(q ? 'search' : 'file')}${emptyMsg}</div>`;
    return;
  }
  /* корневой значок направления поверх иконки категории */
  const badgeIn  = '<svg class="wal-op-dir" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M70 34 34 70"/><path d="M36 40v30h30"/></svg>';
  const badgeOut = '<svg class="wal-op-dir" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"><path d="M32 68 68 32"/><path d="M40 32h28v28"/></svg>';
  /* группировка по дням */
  const groups = [];
  let cur = null;
  list.forEach(op=>{
    const k = walDayKey(op.at);
    if(!cur || cur.k !== k){ cur = {k, at: op.at, ops: [], net: 0}; groups.push(cur); }
    cur.ops.push(op);
    cur.net += op.t==='+' ? op.sum : -op.sum;
  });
  let idx = 0;
  box.innerHTML = groups.map(g=>{
    const netUp = g.net >= 0;
    const rows = g.ops.map(op=>{
      const d = idx++; const dir = op.t==='+';
      return `
      <div class="wal-op" role="button" tabindex="0" onclick="walOpenTx(${op.at})" style="animation-delay:${Math.min(d,12)*42}ms">
        <div class="wal-op-ic ${dir?'in':'out'}"><svg class="i"><use href="#i-${walCatIc(op.why)}"/></svg>${dir?badgeIn:badgeOut}</div>
        <div class="wal-op-b">
          <div class="wal-op-why">${esc(op.why)}</div>
          <div class="wal-op-t"><span class="wal-op-cat">${walCat(op.why)}</span> · ${walOpTime(op.at)}</div>
        </div>
        <div class="wal-op-sum ${dir?'in':'out'}">${dir?'+':'−'} ${fmtMoney(op.sum)}</div>
        <svg class="i wal-op-chev"><use href="#i-chev"/></svg>
      </div>`;
    }).join('');
    return `<div class="wal-day">
      <div class="wal-day-h"><span class="wal-day-l">${walDayLabel(g.at)}</span><span class="wal-day-net ${netUp?'in':'out'}">${netUp?'+':'−'} ${fmtMoney(Math.abs(g.net))}</span></div>
      ${rows}
    </div>`;
  }).join('');
}
function walSetFilter(f){
  walFilter = f;
  document.querySelectorAll('#walFilters button').forEach(b=>b.classList.toggle('on', b.dataset.f===f));
  walRenderLedger();
}
function walSetSearch(v){
  walSearch = (v || '').trim().toLowerCase();
  walRenderLedger();
}
function walCopyAcc(){
  walCopy(WALLET.acc, 'Номер счёта скопирован: ' + WALLET.acc);
}
function walScrollHistory(){
  const a = document.getElementById('walHistAnchor');
  if(a) a.scrollIntoView({behavior:'smooth', block:'start'});
}

/* ---------- АВТОПРОДЛЕНИЕ ПОДПИСКИ PRO ---------- */
function walRenderAutopay(){
  const sw = document.getElementById('walAutoSw'), sub = document.getElementById('walAutoSub');
  if(!sw || !sub) return;
  sw.classList.toggle('on', !!WAL_X.autopay);
  sub.textContent = WAL_X.autopay
    ? 'Следующее списание ' + walDMY(WAL_X.nextAt) + ' · ' + fmtMoney(walProPrice())
    : 'Выключено, тариф не продлевается сам';
}
function walToggleAutopay(){
  if(WAL_X.autopay){
    WAL_X.autopay = false; walXSave(); walRenderAutopay();
    toast('Автопродление PRO выключено');
    return;
  }
  const next = Date.now() + 30 * 864e5;
  showPopup({ico:'crown', title:'Автопродление PRO',
    body:'Тариф PRO — <b>' + fmtMoney(walProPrice()) + ' / мес</b>.<br>Первое автосписание с лицевого счёта — <b>' + walDMY(next) + '</b>.<br>Отключить можно в любой момент в кошельке.',
    actions:[
      {label:'Включить автопродление', onclick:()=>{
        WAL_X.autopay = true; WAL_X.nextAt = next; walXSave();
        walRenderAutopay(); toast('Автопродление PRO включено — списание ' + walDMY(next));
      }},
      {label:'Отмена', ghost:true}
    ]});
}
/* просроченное автопродление — списываем при запуске (мок реального крона) */
(function walAutoChargeDue(){
  if(!WAL_X.autopay || !WAL_X.nextAt || Date.now() < WAL_X.nextAt) return;
  const price = walProPrice();
  if(WALLET.balance >= price && walletCharge(price, 'Автопродление тарифа PRO')){
    okoEarn(price, 'Тарифы');
    WAL_X.nextAt = Date.now() + 30 * 864e5;
    toast('Тариф PRO продлён автоматически: ' + fmtMoney(price));
  } else {
    WAL_X.autopay = false;
    toast('Автопродление PRO: не хватило средств — выключено');
  }
  walXSave();
})();

/* ---------- ЛИМИТЫ И БЕЗОПАСНОСТЬ ---------- */
function walWdUsedToday(){
  return WAL_X.wdDay === new Date().toDateString() ? (WAL_X.wdSum || 0) : 0;
}
function walRenderSec(){
  const sub = document.getElementById('walSecWdSub'), bar = document.getElementById('walSecWdBar');
  const used = walWdUsedToday(), lim = walWdLimit(), tier = walTier();
  if(sub) sub.innerHTML = fmtMoney(used) + ' из ' + fmtMoney(lim) + ' за сегодня · <b class="wal-tier-tag">тариф ' + tier + '</b>';
  if(bar) bar.style.width = Math.min(100, used / lim * 100).toFixed(1) + '%';
  /* апселл лимита — если не максимальный тариф */
  const secB = sub ? sub.parentElement : null;
  let up = document.getElementById('walWdUpsell');
  if(secB){
    if(tier !== 'MAX'){
      if(!up){
        up = document.createElement('button');
        up.id = 'walWdUpsell'; up.type = 'button'; up.className = 'wal-upsell';
        up.onclick = walWdUpsell;
        secB.appendChild(up);
      }
      const nextTier = tier==='FREE'?'START':tier==='START'?'PRO':tier==='PRO'?'BUSINESS':'MAX';
      up.innerHTML = I('crown') + '<span>Лимит ' + fmtMoney(WAL_WD_LIMITS[nextTier]) + '/сутки на ' + nextTier + '</span>' + I('chev');
    } else if(up){ up.remove(); }
  }
  const psw = document.getElementById('walPinSw'), psub = document.getElementById('walPinSub');
  if(psw) psw.classList.toggle('on', !!WAL_X.pin);
  if(psub) psub.textContent = WAL_X.pin ? 'Включён — вывод только по ПИН-коду' : 'Выключен, включи для защиты вывода';
}
function walWdUpsell(){
  const tier = walTier();
  const nextTier = tier==='FREE'?'START':tier==='START'?'PRO':tier==='PRO'?'BUSINESS':'MAX';
  if(typeof window.okoRequireSub === 'function'){
    window.okoRequireSub(nextTier, 'Выше тариф — выше суточный лимит вывода средств', ()=>{ renderWallet(); });
  } else if(typeof openPay === 'function'){
    openPay(nextTier==='MAX'?'BUSINESS':nextTier);
  }
}
function walTogglePin(){
  if(WAL_X.pin) walPinOpen('off', 'walPinView');
  else walPinOpen('set', 'walPinView');
}

/* ---------- ПИН-ПАД (мок 4 цифры, персист) ---------- */
let walPinCtx = null;
function walPinOpen(mode, targetId, onOk){
  walPinCtx = {mode, targetId, onOk: onOk || null, stage: 1, first: '', buf: ''};
  if(targetId === 'walPinView') openSheet('walPin');
  walPinRender();
}
function walPinRender(err){
  const c = walPinCtx; if(!c) return;
  const box = document.getElementById(c.targetId); if(!box) return;
  const T = {
    set1:    ['Придумай ПИН-код', '4 цифры — понадобится при каждом выводе средств'],
    set2:    ['Повтори ПИН-код', 'Ещё раз те же 4 цифры для подтверждения'],
    off:     ['Отключение ПИН-кода', 'Введи текущий ПИН-код'],
    confirm: ['Подтверди вывод', 'Введи ПИН-код, чтобы вывести средства'],
  };
  const [title, sub] = T[c.mode === 'set' ? 'set' + c.stage : c.mode];
  box.innerHTML = `
  <div class="wal-pin">
    <div class="wal-pin-lock">${I('lock')}</div>
    <h3 style="text-align:center">${title}</h3>
    <p class="dim" style="font-size:12px;text-align:center;margin-top:4px">${sub}</p>
    <div class="wal-pin-dots ${err ? 'err' : ''}" id="walPinDots">${[0,1,2,3].map(i=>`<span class="${i < c.buf.length ? 'on' : ''}"></span>`).join('')}</div>
    <div class="wal-pin-keys">
      ${[1,2,3,4,5,6,7,8,9].map(d=>`<button onclick="walPinKey(${d})">${d}</button>`).join('')}
      <button class="ghosty" onclick="walPinCancel()">Отмена</button>
      <button onclick="walPinKey(0)">0</button>
      <button class="ghosty" onclick="walPinBackspace()" aria-label="Стереть"><svg class="i"><use href="#i-back"/></svg></button>
    </div>
  </div>`;
}
function walPinDots(){
  const c = walPinCtx, d = document.getElementById('walPinDots');
  if(!c || !d) return;
  [...d.children].forEach((s,i)=>s.classList.toggle('on', i < c.buf.length));
}
function walPinKey(n){
  const c = walPinCtx; if(!c || c.buf.length >= 4) return;
  c.buf += String(n); walPinDots();
  if(c.buf.length === 4) setTimeout(walPinEval, 170);
}
function walPinBackspace(){
  const c = walPinCtx; if(!c) return;
  c.buf = c.buf.slice(0, -1); walPinDots();
}
function walPinErr(msg){
  const c = walPinCtx; if(!c) return;
  c.buf = '';
  toast(msg);
  walPinRender(true);
  setTimeout(()=>{ const d = document.getElementById('walPinDots'); if(d) d.classList.remove('err'); }, 450);
}
function walPinEval(){
  const c = walPinCtx; if(!c) return;
  const code = c.buf;
  if(c.mode === 'set'){
    if(c.stage === 1){ c.first = code; c.stage = 2; c.buf = ''; walPinRender(); return; }
    if(code === c.first){
      WAL_X.pin = code; walXSave(); walPinCtx = null;
      closeSheet(); walRenderSec();
      toast('ПИН-код на вывод установлен');
    } else { c.stage = 1; c.first = ''; walPinErr('ПИН-коды не совпали — начни заново'); }
    return;
  }
  if(c.mode === 'off'){
    if(code === WAL_X.pin){
      WAL_X.pin = null; walXSave(); walPinCtx = null;
      closeSheet(); walRenderSec();
      toast('ПИН-код отключён');
    } else walPinErr('Неверный ПИН-код');
    return;
  }
  if(c.mode === 'confirm'){
    if(code === WAL_X.pin){ const ok = c.onOk; walPinCtx = null; if(ok) ok(); }
    else walPinErr('Неверный ПИН-код');
  }
}
function walPinCancel(){
  const c = walPinCtx; walPinCtx = null;
  if(c && c.mode === 'confirm') walRenderWithdraw();
  else closeSheet();
}

/* ---------- баланс-чипы (хаб + профиль) ---------- */
function walMakeChip(id){
  if(document.getElementById(id)) return;
  const b = document.createElement('button');
  b.className = 'balance-chip'; b.id = id;
  b.innerHTML = `<svg class="i"><use href="#i-money"/></svg><span>${fmtMoney(WALLET.balance)}</span>`;
  b.onclick = ()=>showTab('wallet');
  return b;
}
function walInsertChips(){
  const heroTxt = document.querySelector('#maHero .ma-hero-txt');
  if(heroTxt && !document.getElementById('walChipHub')){
    const c = walMakeChip('walChipHub');
    if(c){ c.style.marginTop = '9px'; heroTxt.appendChild(c); }
  }
  const profTop = document.querySelector('#screen-profile .profile-top');
  if(profTop && !document.getElementById('walChipProf')){
    const c = walMakeChip('walChipProf');
    if(c){ c.style.margin = '0 0 14px'; profTop.insertAdjacentElement('afterend', c); }
  }
}
function walUpdateChips(){
  ['walChipHub','walChipProf'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.querySelector('span').textContent = fmtMoney(WALLET.balance);
  });
}

/* ---------- псевдо-QR (детерминированный SVG-плейсхолдер) ---------- */
function walQrSvg(seed, size){
  let h = 2166136261;
  for(let i = 0; i < seed.length; i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = ()=>{ h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const N = 21, finder = (r,c)=> (r < 8 && c < 8) || (r < 8 && c >= N-8) || (r >= N-8 && c < 8);
  let cells = '';
  for(let r = 0; r < N; r++) for(let c = 0; c < N; c++)
    if(!finder(r,c) && rnd() < 0.46) cells += `<rect x="${c}" y="${r}" width="1" height="1"/>`;
  const fp = (r,c)=>`<rect x="${c}" y="${r}" width="7" height="7" fill="#111"/><rect x="${c+1}" y="${r+1}" width="5" height="5" fill="#fff"/><rect x="${c+2}" y="${r+2}" width="3" height="3" fill="#111"/>`;
  return `<svg viewBox="-1.5 -1.5 24 24" width="${size}" height="${size}" shape-rendering="crispEdges" style="border-radius:8px;background:#fff">
    <rect x="-1.5" y="-1.5" width="24" height="24" fill="#fff"/>
    <g fill="#111">${cells}</g>${fp(0,0)}${fp(0,14)}${fp(14,0)}</svg>`;
}

/* ---------- реквизиты пополнения по способу ---------- */
function walTopReqHtml(m){
  if(m === 'card') return `
    <div class="wal-mockcard fade-in">
      <div class="wal-mc-row">
        <svg class="wal-mc-chip" viewBox="0 0 44 32"><rect x="1" y="1" width="42" height="30" rx="6" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M1 12h14M1 20h14M29 12h14M29 20h14M15 5v22M29 5v22" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>
        <span class="wal-mc-sys">МИР · СБП</span>
      </div>
      <button class="wal-mc-num" onclick="walCopy(WAL_CARD_NUM,'Номер карты скопирован')">${WAL_CARD_NUM}${I('copy')}</button>
      <div class="wal-mc-bot"><span>OKO PAY · перевод по номеру</span><span>Т-Банк</span></div>
    </div>
    <div class="wal-req-qr fade-in">
      ${walQrSvg('oko-card-' + WALLET.acc, 88)}
      <div><b>QR для оплаты</b><span>Отсканируй в приложении банка — сумма и назначение платежа подставятся сами. Зачисление мгновенно.</span></div>
    </div>`;
  if(m === 'usdt') return `
    <div class="wal-req fade-in">
      <div class="wal-req-h">${I('money')}<span>Адрес USDT · сеть <b>TRC20</b></span></div>
      <button class="wal-addr" onclick="walCopy(WAL_USDT_ADDR,'Адрес USDT скопирован')"><span>${WAL_USDT_ADDR}</span>${I('copy')}</button>
      <p class="wal-req-warn">Отправляй только USDT в сети TRC20 — перевод в другой сети будет потерян. Курс фиксируется в момент зачисления.</p>
    </div>`;
  if(m === 'ton') return `
    ${walTonSurface('topup')}
    <div class="wal-req fade-in">
      <div class="wal-req-h">${I('ton')}<span>Адрес кошелька <b>TON</b></span></div>
      <button class="wal-addr" onclick="walCopy(WAL_TON_ADDR,'Адрес TON скопирован')"><span>${WAL_TON_ADDR}</span>${I('copy')}</button>
      <p class="wal-req-warn" style="color:var(--dim)">Переводи Toncoin из любого TON-кошелька — зачисление за 1–2 минуты по текущему курсу.</p>
    </div>`;
  return `
    <div class="wal-req fade-in">
      <div class="wal-req-h">${I('bolt')}<span>Оплата через Lava.top</span></div>
      <p class="wal-req-warn" style="color:var(--dim);margin-top:7px">Счёт откроется в защищённом шлюзе после нажатия «Пополнить» — карты любой страны, СБП и крипта.</p>
    </div>`;
}

/* ---------- пополнение ---------- */
function walOpenTopup(prefill){
  walTopupState = {sum: prefill || 1000, method:'card'};
  walRenderTopup();
  openSheet('walTopup');
}
function walRenderTopup(){
  const s = walTopupState;
  document.getElementById('walTopupView').innerHTML = `
    <h3>Пополнение счёта</h3>
    <p class="dim" style="font-size:12.5px;margin:-4px 0 12px">Счёт ${WALLET.acc} · зачисление мгновенно</p>
    <div class="wal-qs">${[500,1000,5000,10000].map(v=>`
      <button class="${s.sum===v?'on':''}" onclick="walTopupState.sum=${v};walRenderTopup()">${v>=1000?(v/1000)+'к':v}</button>`).join('')}</div>
    <input id="walTopSum" type="number" min="1" placeholder="Сумма, ₽" value="${s.sum||''}"
      oninput="walTopupState.sum=Math.max(0,Number(this.value)||0);walSyncTopupBtn()">
    <p style="font-weight:600;font-size:13px;margin:2px 0 8px">Способ пополнения</p>
    <div class="wal-methods">${WAL_METHODS.map(([k,l,ic])=>`
      <button class="wal-m ${s.method===k?'on':''}" onclick="walTopupState.method='${k}';walRenderTopup()">${I(ic)}<span>${l}</span></button>`).join('')}</div>
    <div id="walTopReq">${walTopReqHtml(s.method)}</div>
    <div style="height:14px"></div>
    <button class="btn" onclick="walDoTopup()"><svg class="i"><use href="#i-plus"/></svg> <span id="walTopBtnSum">Пополнить на ${fmtMoney(s.sum)}</span></button>
    <p class="dim" style="font-size:11px;text-align:center;margin-top:9px">Без комиссии. Мок: в проде — платёжный шлюз OKO.</p>`;
}
function walSyncTopupBtn(){
  const el = document.getElementById('walTopBtnSum');
  if(el) el.textContent = 'Пополнить на ' + fmtMoney(walTopupState.sum);
}
function walDoTopup(){
  const s = walTopupState;
  if(!s.sum || s.sum <= 0){ toast('Укажи сумму пополнения'); return; }
  const v = document.getElementById('walTopupView');
  v.innerHTML = `<div style="text-align:center;padding:22px 0">
    <div class="spin"></div><p style="font-weight:700;margin-top:14px">Создаём платёж…</p>
    <p class="dim" style="font-size:12px;margin-top:5px">${WAL_M_LABEL[s.method]} · защищённое соединение</p></div>`;
  setTimeout(()=>{
    walletAdd(s.sum, 'Пополнение · ' + WAL_M_LABEL[s.method]);
    v.innerHTML = `<div class="wal-ok-wrap">
      <div class="wal-ok">${I('check')}</div>
      <p style="font-weight:800;font-size:19px;margin-top:14px">+ ${fmtMoney(s.sum)}</p>
      <p class="dim" style="font-size:13px;margin-top:6px">Счёт пополнен через ${WAL_M_LABEL[s.method]}.<br>Баланс: ${fmtMoney(WALLET.balance)}</p>
      <div style="height:16px"></div>
      <button class="btn" onclick="closeSheet()">Отлично</button></div>`;
    renderWallet();
    walFlash('in');
    toast('Кошелёк пополнен на ' + fmtMoney(s.sum));
  }, 1100);
}

/* ---------- вывод (комиссия 2%, суточный лимит, ПИН) ---------- */
function walOpenWithdraw(){
  walWdState = {sum:0, method:'card'};
  walRenderWithdraw();
  openSheet('walWithdraw');
}
function walWdFee(sum){ return Math.round(sum * 0.02 * 100) / 100; }
function walRenderWithdraw(){
  const s = walWdState;
  document.getElementById('walWdView').innerHTML = `
    <h3>Вывод средств</h3>
    <p class="dim" style="font-size:12.5px;margin:-4px 0 12px">Доступно: <b style="color:var(--accent)">${fmtMoney(WALLET.balance)}</b> · лимит на сегодня: ${fmtMoney(Math.max(0, walWdLimit() - walWdUsedToday()))}</p>
    <input id="walWdSum" type="number" min="1" max="${WALLET.balance}" placeholder="Сумма вывода, ₽" value="${s.sum||''}"
      oninput="walWdState.sum=Math.max(0,Number(this.value)||0);walSyncWdCalc()">
    <p style="font-weight:600;font-size:13px;margin:2px 0 8px">Куда вывести</p>
    <div class="wal-methods">${WAL_METHODS.map(([k,l,ic])=>`
      <button class="wal-m ${s.method===k?'on':''}" onclick="walWdState.method='${k}';walRenderWithdraw()">${I(ic)}<span>${l}</span></button>`).join('')}</div>
    ${s.method==='ton' ? walTonSurface('withdraw') : ''}
    <div class="wal-fee" id="walWdCalc"></div>
    <button class="btn" onclick="walDoWithdraw()"><svg class="i"><use href="#i-card"/></svg> <span id="walWdBtn">Вывести</span></button>
    <p class="dim" style="font-size:11px;text-align:center;margin-top:9px">Комиссия вывода 2%. Поступление 1–3 рабочих дня.${WAL_X.pin ? ' Защищено ПИН-кодом.' : ''}</p>`;
  walSyncWdCalc();
}
function walSyncWdCalc(){
  const s = walWdState, fee = walWdFee(s.sum), get = Math.max(0, s.sum - fee);
  const c = document.getElementById('walWdCalc');
  if(c) c.innerHTML = `
    <div class="wal-fee-row"><span>Сумма вывода</span><b>${fmtMoney(s.sum)}</b></div>
    <div class="wal-fee-row"><span>Комиссия 2%</span><b style="color:var(--danger)">− ${fmtMoney(fee)}</b></div>
    <div class="wal-fee-row total"><span>К получению</span><b>${fmtMoney(get)}</b></div>`;
  const b = document.getElementById('walWdBtn');
  if(b) b.textContent = s.sum > 0 ? 'Вывести ' + fmtMoney(s.sum) : 'Вывести';
}
function walDoWithdraw(){
  const s = walWdState;
  if(!s.sum || s.sum <= 0){ toast('Укажи сумму вывода'); return; }
  if(s.sum > WALLET.balance){ toast('Сумма больше баланса — максимум ' + fmtMoney(WALLET.balance)); return; }
  if(s.method === 'ton' && !WAL_X.ton){ toast('Сначала подключи TON-кошелёк'); return; }
  const used = walWdUsedToday(), lim = walWdLimit();
  if(used + s.sum > lim){
    toast('Суточный лимит вывода ' + fmtMoney(lim) + ' (тариф ' + walTier() + ') — сегодня доступно ' + fmtMoney(Math.max(0, lim - used)) + '. Выше тариф — выше лимит.');
    return;
  }
  if(WAL_X.pin){ walPinOpen('confirm', 'walWdView', walExecWithdraw); return; }
  walExecWithdraw();
}
function walExecWithdraw(){
  const s = walWdState;
  const fee = walWdFee(s.sum), get = s.sum - fee;
  if(!walletCharge(s.sum, 'Вывод средств · ' + WAL_M_LABEL[s.method])){ return; }
  okoEarn(fee, 'Комиссия вывода');
  const today = new Date().toDateString();
  if(WAL_X.wdDay !== today){ WAL_X.wdDay = today; WAL_X.wdSum = 0; }
  WAL_X.wdSum += s.sum; walXSave();
  const v = document.getElementById('walWdView');
  v.innerHTML = `<div style="text-align:center;padding:22px 0">
    <div class="spin"></div><p style="font-weight:700;margin-top:14px">Оформляем заявку…</p></div>`;
  setTimeout(()=>{
    v.innerHTML = `<div class="wal-ok-wrap">
      <div class="wal-ok">${I('check')}</div>
      <p style="font-weight:800;font-size:19px;margin-top:14px">Заявка на вывод создана</p>
      <p class="dim" style="font-size:13px;margin-top:6px">${fmtMoney(get)} придут на ${WAL_M_LABEL[s.method]} в течение 1–3 дней.<br>Комиссия 2%: ${fmtMoney(fee)}</p>
      <div class="wal-tx-tl-h" style="justify-content:center">${I('clock')}<span>Статус вывода</span></div>
      <div style="text-align:left;max-width:300px;margin:0 auto">${walWdTimelineHtml(Date.now())}</div>
      <div style="height:14px"></div>
      <button class="btn" onclick="closeSheet()">Готово</button></div>`;
    renderWallet();
    walFlash('out');
    toast('Вывод ' + fmtMoney(s.sum) + ' оформлен');
  }, 900);
}

/* ---------- ВЫПИСКА: документ с печатью + скачивание .txt ---------- */
function walStmtTotals(){
  let inN = 0, inS = 0, outN = 0, outS = 0;
  WALLET.ledger.forEach(o=>{ if(o.t === '+'){ inN++; inS += o.sum; } else { outN++; outS += o.sum; } });
  return {inN, inS, outN, outS, net: inS - outS};
}
function walStmtHtml(){
  const ops = WALLET.ledger.slice().sort((a,b)=>b.at-a.at);
  const t = walStmtTotals(), now = Date.now();
  const from = ops.length ? ops[ops.length-1].at : now, to = ops.length ? ops[0].at : now;
  return `
  <div class="wal-st-head">
    <div class="wal-st-req">
      <b>${SEAL_REQ.fio}</b>
      <span>${SEAL_REQ.inn}</span>
      <span>${SEAL_REQ.brand} · ${SEAL_REQ.geo}</span>
    </div>
    <div class="wal-st-seal">${sealSvg(84)}</div>
  </div>
  <h1>Выписка по лицевому счёту</h1>
  <div class="wal-st-meta">
    <div><span>Лицевой счёт</span><b>${WALLET.acc}</b></div>
    <div><span>Владелец</span><b>${esc(PROFILE.name)} · @${esc(PROFILE.nick)}</b></div>
    <div><span>Период</span><b>${walDMY(from)} — ${walDMY(to)}</b></div>
    <div><span>Сформирована</span><b>${walDMYT(now)}</b></div>
  </div>
  <div class="wal-st-ops">${ops.map(o=>`
    <div class="wal-st-op">
      <span class="d">${walDMYT(o.at)}</span>
      <span class="w">${esc(o.why)}</span>
      <b class="${o.t==='+'?'in':'out'}">${o.t==='+'?'+':'−'} ${fmtMoney(o.sum)}</b>
    </div>`).join('')}</div>
  <div class="wal-st-tot">
    <div><span>Пополнения (${t.inN})</span><b class="in">+ ${fmtMoney(t.inS)}</b></div>
    <div><span>Списания (${t.outN})</span><b class="out">− ${fmtMoney(t.outS)}</b></div>
    <div class="net"><span>Итог за период</span><b>${t.net>=0?'+':'−'} ${fmtMoney(Math.abs(t.net))}</b></div>
    <div class="net"><span>Баланс на дату выписки</span><b>${fmtMoney(WALLET.balance)}</b></div>
    ${WALLET.hold > 0 ? `<div><span>В холде (эскроу)</span><b>${fmtMoney(WALLET.hold)}</b></div>` : ''}
  </div>
  <div class="wal-st-sign">
    <div class="wal-st-sig">${signatureImg(118)}<span>Ильясов Д. А. · ${walDMY(now)}</span></div>
    <span class="wal-st-note">Документ сформирован автоматически в OKO APP и подтверждает операции по лицевому счёту.</span>
  </div>`;
}
function walStmtText(){
  const ops = WALLET.ledger.slice().sort((a,b)=>b.at-a.at);
  const t = walStmtTotals(), now = Date.now();
  const from = ops.length ? ops[ops.length-1].at : now, to = ops.length ? ops[0].at : now;
  const hr = '='.repeat(58), sep = '-'.repeat(58), L = [];
  L.push(hr);
  L.push('        OKO APP — ВЫПИСКА ПО ЛИЦЕВОМУ СЧЁТУ');
  L.push(hr);
  L.push('Счёт:          ' + WALLET.acc);
  L.push('Владелец:      ' + PROFILE.name + ' (@' + PROFILE.nick + ')');
  L.push('Период:        ' + walDMY(from) + ' — ' + walDMY(to));
  L.push('Сформирована:  ' + walDMYT(now));
  L.push(sep);
  ops.forEach(o=>{
    L.push(walDMYT(o.at) + '  ' + (o.t === '+' ? '+' : '-') + fmtMoney(o.sum).padStart(13) + '  ' + o.why);
  });
  L.push(sep);
  L.push('Пополнений:    ' + t.inN + ' на сумму ' + fmtMoney(t.inS));
  L.push('Списаний:      ' + t.outN + ' на сумму ' + fmtMoney(t.outS));
  L.push('Итог периода:  ' + (t.net >= 0 ? '+' : '-') + fmtMoney(Math.abs(t.net)));
  L.push('Баланс:        ' + fmtMoney(WALLET.balance) + (WALLET.hold > 0 ? ' (в холде ' + fmtMoney(WALLET.hold) + ')' : ''));
  L.push(sep);
  L.push(SEAL_REQ.fio + ' · ' + SEAL_REQ.inn);
  L.push(SEAL_REQ.brand + ' · ' + SEAL_REQ.geo);
  L.push('Документ сформирован автоматически в OKO APP.');
  L.push(hr);
  return L.join('\n');
}
function walStmtHide(){
  const el = document.getElementById('walStmt');
  if(el) el.classList.remove('open');
}
function walOpenStatement(){
  const paper = document.getElementById('walStmtPaper');
  if(paper) paper.innerHTML = walStmtHtml();
  const el = document.getElementById('walStmt');
  if(el) el.classList.add('open');
  if(typeof nvPush === 'function') nvPush('wal-stmt', walStmtHide);
}
function walCloseStatement(){
  walStmtHide();
  if(typeof nvPop === 'function') nvPop('wal-stmt');
}
function walDownloadStatement(){
  const d = new Date();
  const name = 'OKO-выписка-' + WALLET.acc + '-' + d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + '.txt';
  const blob = new Blob(['\ufeff' + walStmtText()], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); }catch(e){} }, 4000);
  toast('Выписка сохранена: ' + name);
}

/* ---------- WOW: вспышка-свечение баланса при денежной операции ---------- */
function walFlash(kind){
  const h = document.querySelector('#screen-wallet .wal-hero');
  if(!h) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce) return;
  h.classList.remove('wal-flash-in','wal-flash-out');
  void h.offsetWidth;                       // рефлоу — рестарт анимации
  h.classList.add(kind === 'out' ? 'wal-flash-out' : 'wal-flash-in');
  setTimeout(()=>h.classList.remove('wal-flash-in','wal-flash-out'), 900);
}

/* ---------- TON CONNECT: подключение внешнего TON-кошелька (персист) ---------- */
/* мок-адрес пользовательского кошелька (детерминированный от лицевого счёта) */
function walTonMyAddr(){
  let h = 2166136261; const seed = 'ton-' + WALLET.acc;
  for(let i = 0; i < seed.length; i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  let s = '';
  for(let i = 0; i < 34; i++){ h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0;
    s += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnopqrstuvwxyz'[h % 56]; }
  return 'UQ' + s;
}
function walTonReRender(){
  const tv = document.getElementById('sheet-walTopup');
  if(tv && tv.classList.contains('open')){ const r = document.getElementById('walTopReq'); if(r) r.innerHTML = walTopReqHtml(walTopupState.method); }
  const wv = document.getElementById('sheet-walWithdraw');
  if(wv && wv.classList.contains('open')) walRenderWithdraw();
}
function walTonConnect(){
  const btn = event && event.currentTarget;
  if(btn){ btn.innerHTML = '<span class="spin" style="width:20px;height:20px"></span><span><b>Подключаем…</b><em>TON Connect · подтверди в кошельке</em></span>'; }
  setTimeout(()=>{
    WAL_X.ton = walTonMyAddr(); walXSave();
    walTonReRender();
    toast('TON-кошелёк подключён');
  }, 700);
}
function walTonDisconnect(){
  WAL_X.ton = null; walXSave();
  walTonReRender();
  toast('TON-кошелёк отключён');
}
function walTonSurface(ctx){
  if(WAL_X.ton){
    const a = WAL_X.ton;
    return `<div class="wal-ton-conn fade-in">
      <div class="wal-ton-badge">${I('ton')}</div>
      <div class="wal-ton-b"><b>TON-кошелёк подключён</b><span>${a.slice(0,6)}…${a.slice(-6)}</span></div>
      <button class="wal-ton-x" onclick="walTonDisconnect()">Отключить</button>
    </div>`;
  }
  const sub = ctx === 'withdraw' ? 'Нужен для вывода Toncoin — Tonkeeper · Wallet · MyTonWallet'
                                 : 'Пополняй в один тап — Tonkeeper · Wallet · MyTonWallet';
  return `<button class="wal-ton-connect fade-in" type="button" onclick="walTonConnect()">${I('ton')}<span><b>Подключить TON-кошелёк</b><em>${sub}</em></span>${I('chev')}</button>`;
}

/* ---------- СТАТУС ВЫВОДА: живой таймлайн (мок реального процессинга) ---------- */
const WAL_WD_STAGES = [
  ['file', 'Заявка создана',        'Вывод оформлен в OKO'],
  ['lock', 'Проверка безопасности', 'Антифрод и сверка реквизитов'],
  ['card', 'Отправлено в банк',     'Платёж передан в платёжную систему'],
  ['check','Зачислено',             'Деньги у получателя'],
];
/* индекс текущего этапа: <этого done, ==active; 3 = полностью завершено */
function walWdStage(at){
  const el = Date.now() - at, M = 60000, H = 3600000, D = 864e5;
  if(el >= D) return 3;        // зачислено
  if(el >= 10 * M) return 2;   // отправлено в банк
  return 1;                    // проверка безопасности
}
function walWdDone(at){ return walWdStage(at) >= 3; }
function walWdTimelineHtml(at){
  const cur = walWdStage(at);
  const steps = WAL_WD_STAGES.map((s,i)=>{
    const isDone = i < cur || (i === 3 && cur === 3);
    const isActive = i === cur && cur < 3;
    const cls = isDone ? 'done' : isActive ? 'active' : '';
    const ic = isDone ? 'check' : s[0];
    let sub = s[2];
    if(i === 3 && !isDone) sub = 'Ожидается до ' + walDMY(at + 3 * 864e5);
    return `<div class="wal-tl-step ${cls}" style="animation-delay:${i*60}ms">
      <span class="wal-tl-dot"><svg class="i"><use href="#i-${ic}"/></svg></span>
      <span class="wal-tl-b"><b>${s[1]}</b><span>${sub}</span></span>
    </div>`;
  }).join('');
  return `<div class="wal-tl">${steps}</div>`;
}

/* ---------- ДЕТАЛИ ОПЕРАЦИИ (bottom-sheet, читает персист-леджер) ---------- */
function walOpId(at){ return 'OP-' + Number(at).toString(36).toUpperCase().slice(-8).padStart(8,'0'); }
function walBalanceAfter(op){
  let after = WALLET.balance;
  for(const o of WALLET.ledger){ if(o.at > op.at) after -= (o.t === '+' ? o.sum : -o.sum); }
  return after;
}
let walTxCur = null;
function walOpenTx(at){
  const op = WALLET.ledger.find(o => o.at === at);
  if(!op) return;
  walTxCur = op;
  walRenderTx(op);
  openSheet('walTx');
}
function walRenderTx(op){
  const box = document.getElementById('walTxView');
  if(!box) return;
  const dir = op.t === '+', cat = walCat(op.why), isTop = cat === 'Пополнение';
  const isWd = cat === 'Вывод средств';
  const wdDone = isWd ? walWdDone(op.at) : true;
  const after = walBalanceAfter(op);
  const statusHtml = isWd && !wdDone
    ? `<span class="wal-tx-status proc">${I('clock')}В обработке</span>`
    : `<span class="wal-tx-status">${I('check')}${isWd ? 'Зачислено' : 'Выполнено'}</span>`;
  box.innerHTML = `
  <div class="wal-tx">
    <div class="wal-tx-hero">
      <div class="wal-tx-ic ${dir?'in':'out'}"><svg class="i"><use href="#i-${walCatIc(op.why)}"/></svg></div>
      <div class="wal-tx-sum ${dir?'in':'out'}">${dir?'+':'−'} ${fmtMoney(op.sum)}</div>
      <div class="wal-tx-why">${esc(op.why)}</div>
      ${statusHtml}
    </div>
    ${isWd ? `<div class="wal-tx-tl-h">${I('clock')}<span>Статус вывода</span></div>${walWdTimelineHtml(op.at)}` : ''}
    <div class="wal-tx-rows">
      <div class="wal-tx-row"><span>Категория</span><b class="wal-tx-cat">${I(walCatIc(op.why))}${cat}</b></div>
      <div class="wal-tx-row"><span>Тип</span><b class="${dir?'':'out'}" style="color:${dir?'var(--accent)':'var(--text)'}">${dir?'Пополнение':'Списание'}</b></div>
      <div class="wal-tx-row"><span>Дата и время</span><b>${walDMYT(op.at)}</b></div>
      <div class="wal-tx-row"><span>Баланс после</span><b>${fmtMoney(after)}</b></div>
      <div class="wal-tx-row"><span>Номер операции</span><button class="wal-tx-id" onclick="walCopy('${walOpId(op.at)}','Номер операции скопирован')">${walOpId(op.at)}${I('copy')}</button></div>
    </div>
    <div class="wal-tx-acts">
      ${isTop ? `<button class="prim" onclick="closeSheet();walOpenTopup(${op.sum})"><svg class="i"><use href="#i-plus"/></svg>Повторить</button>` : ''}
      <button class="sec" onclick="walTxCopy()"><svg class="i"><use href="#i-copy"/></svg>Скопировать</button>
    </div>
  </div>`;
}
function walTxCopy(){
  const op = walTxCur; if(!op) return;
  const txt = 'OKO · операция ' + walOpId(op.at) + '\n' + (op.t==='+'?'+ ':'− ') + fmtMoney(op.sum) +
    '\n' + op.why + '\n' + walCat(op.why) + ' · ' + walDMYT(op.at) + '\nСчёт ' + WALLET.acc;
  walCopy(txt, 'Детали операции скопированы');
}

/* ---------- ПАТЧИ денежных потоков ядра (прежнее поведение сохранено) ---------- */

/* чипы обновляются при любой операции кошелька */
const _prevWalletNotifyRenderWal = walletNotifyRender;
walletNotifyRender = function(){ _prevWalletNotifyRenderWal(); walUpdateChips(); };

/* рендер кошелька при входе на вкладку */
const _prevShowTabWal = showTab;
showTab = function(t){
  _prevShowTabWal(t);
  if(t === 'wallet') renderWallet();
};

/* перерисовать график при смене темы (цвет линии и сетки зависят от темы) */
const _prevApplyThemeWal = applyTheme;
applyTheme = function(t){
  _prevApplyThemeWal(t);
  if(typeof walDrawChart === 'function') walDrawChart();
};

/* тарифы: списание с кошелька; при нехватке — предложение пополнить */
const _prevDoPayWal = doPay;
doPay = function(){
  const p = PLANS[payState.plan];
  const {total} = payPrice();
  if(WALLET.balance < total){
    const lack = total - WALLET.balance;
    document.getElementById('payView').innerHTML = `<div style="text-align:center;padding:14px 0">
      <div class="pop-ico" style="width:58px;height:58px;border-radius:50%;background:var(--lime-dim);display:flex;align-items:center;justify-content:center;margin:0 auto 12px">${I('money')}</div>
      <p style="font-weight:800;font-size:19px">Не хватает ${fmtMoney(lack)}</p>
      <p class="dim" style="font-size:13px;margin-top:6px">Тариф ${p.name} стоит ${fmtRub(total)}, на счёте ${fmtMoney(WALLET.balance)}.<br>Пополни кошелёк и вернись к оплате.</p>
      <div style="height:16px"></div>
      <button class="btn" onclick="closeSheet();showTab('wallet');walOpenTopup(${Math.ceil(lack/100)*100})">${I('plus')} Пополнить кошелёк</button>
      <div style="height:9px"></div>
      <button class="btn ghost" onclick="renderPay()">Назад к оплате</button></div>`;
    return;
  }
  walletCharge(total, 'Тариф ' + p.name);
  okoEarn(total, 'Тарифы');
  _prevDoPayWal();
};

/* продвижение объявления на Бирже */
const _prevBuyPromoWal = buyPromo;
buyPromo = function(id, k){
  const pr = PROMOS.find(p=>p.k===k);
  if(!walletCharge(pr.price, 'Продвижение объявления · ' + pr.name)){ closeSheet(); return; }
  okoEarn(pr.price, 'Продвижение');
  _prevBuyPromoWal(id, k);
};

/* продвижение поста в ленте */
const _prevBuyPostPromoWal = buyPostPromo;
buyPostPromo = function(i){
  const pr = POST_PROMOS[i];
  if(!walletCharge(pr.price, 'Продвижение поста · ' + pr.reach + ' показов')){ closeSheet(); return; }
  okoEarn(pr.price, 'Продвижение');
  _prevBuyPostPromoWal(i);
};

/* продвижение канала */
const _prevBuyChannelPromoWal = buyChannelPromo;
buyChannelPromo = function(i){
  const pr = CH_PROMOS[i];
  if(!walletCharge(pr.price, 'Продвижение канала · ' + pr.reach + ' показов')){ closeSheet(); return; }
  okoEarn(pr.price, 'Продвижение');
  _prevBuyChannelPromoWal(i);
};

/* заказ на Бирже: эскроу + комиссия OKO 10% */
const _prevOrderListingWal = orderListing;
orderListing = function(id){
  const l = LISTINGS.find(x=>x.id===id);
  if(!walletCharge(l.p, 'Покупка на Бирже: ' + l.t)){ closeSheet(); return; }
  // комиссия НЕ признаётся сейчас — только при снятии эскроу (mpReleaseHold), когда сделка реально завершена
  WALLET.hold += l.p; walletSave();
  _prevOrderListingWal(id);
  toast('Эскроу-защита: ' + fmtMoney(l.p) + ' в холде до выполнения заказа');
};

/* перевод денег в чате */
const _prevSendMoneyWal = sendMoney;
sendMoney = function(){
  const sum = Number(document.getElementById('moneySum').value);
  if(!sum || !currentChat){ _prevSendMoneyWal(); return; }
  if(!walletCharge(sum, 'Перевод в чате · ' + currentChat.name)){ closeSheet(); return; }
  _prevSendMoneyWal();
};

/* партнёрка: выплата зачисляется на кошелёк */
const _prevDoPayoutWal = doPayout;
doPayout = function(){
  const req = (document.getElementById('payoutReq').value || '').trim();
  _prevDoPayoutWal();
  if(!req) return; // прежняя версия уже показала подсказку про реквизиты
  const rub = Math.round(PAYOUT_BALANCE * WAL_USD_RATE);
  walletAdd(rub, 'Выплата партнёрских ($' + PAYOUT_BALANCE + ')');
};

/* ---------- самоинициализация ---------- */
regTitle('wallet', 'Кошелёк');
walInsertChips();
walUpdateChips();
if(document.getElementById('screen-wallet') && document.getElementById('screen-wallet').classList.contains('active')) renderWallet();
