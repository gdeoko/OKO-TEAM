/* ================= WALLET: экран кошелька / лицевой счёт =================
   Опирается на core-ext: WALLET, walletAdd, walletCharge, fmtMoney, okoEarn.
   Патчит денежные потоки ядра (тарифы, продвижение, биржа, переводы, партнёрка).
   Плюс: график баланса 30 дней, автопродление PRO, выписка (.txt + документ),
   реквизиты пополнения, лимиты счёта и ПИН-код на вывод. */

/* ---------- иконки в общий defs (TON, свап, отпечаток, USDT, XP-звезда, чек, QR, target) ---------- */
(function walAddIcons(){
  const defs = document.querySelector('svg defs');
  if(!defs) return;
  const add = (id, vb, body)=>{
    if(document.getElementById(id)) return;
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id', id); s.setAttribute('viewBox', vb || '0 0 100 100');
    s.innerHTML = body;
    defs.appendChild(s);
  };
  add('i-ton','0 0 100 100','<path d="M18 20h64L50 88 18 20z" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 20v68" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
  add('i-dl','0 0 100 100','<path d="M50 14v44M32 42l18 18 18-18" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 80h60" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
  add('i-search','0 0 100 100','<circle cx="43" cy="43" r="27" fill="none" stroke="currentColor" stroke-width="8"/><path d="M63 63 84 84" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>');
  add('i-dice','0 0 100 100','<rect x="20" y="20" width="60" height="60" rx="14" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="37" cy="37" r="5.5" fill="currentColor"/><circle cx="63" cy="37" r="5.5" fill="currentColor"/><circle cx="50" cy="50" r="5.5" fill="currentColor"/><circle cx="37" cy="63" r="5.5" fill="currentColor"/><circle cx="63" cy="63" r="5.5" fill="currentColor"/>');
  /* свап (двусторонняя стрелка обмена) */
  add('i-swap','0 0 100 100','<path d="M24 34h50l-14-14M76 66H26l14 14" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>');
  /* отпечаток пальца */
  add('i-fingerprint','0 0 100 100','<path d="M30 55c0-14 9-25 20-25s20 11 20 25c0 6-1 12-3 17M50 30c-8 0-15 8-15 25 0 6 1 12 3 17M50 42c-3 0-5 3-5 12 0 8 2 20 4 30M62 46c1 5 1 12 0 20-1 6-3 12-5 18M40 78c1 4 3 8 5 11" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>');
  /* USDT — «$» в круге (простой логотип для чипа) */
  add('i-usdt','0 0 100 100','<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="7"/><path d="M50 32v36M40 40h20a6 6 0 010 12H40a6 6 0 000 12h20" fill="none" stroke="currentColor" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>');
  /* XP-звезда (5 лучей) */
  add('i-xp','0 0 100 100','<path d="M50 12l11 25 27 3-20 19 6 27-24-13-24 13 6-27-20-19 27-3z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>');
  /* цель / мишень */
  add('i-target','0 0 100 100','<circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" stroke-width="6"/><circle cx="50" cy="50" r="6" fill="currentColor"/>');
  /* поделиться */
  add('i-share','0 0 100 100','<circle cx="24" cy="50" r="10" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="72" cy="24" r="10" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="72" cy="76" r="10" fill="none" stroke="currentColor" stroke-width="7"/><path d="M33 45l30-16M33 55l30 16" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
  /* QR-иконка (маленькие квадраты) */
  add('i-qr','0 0 100 100','<rect x="12" y="12" width="26" height="26" rx="4" fill="none" stroke="currentColor" stroke-width="7"/><rect x="62" y="12" width="26" height="26" rx="4" fill="none" stroke="currentColor" stroke-width="7"/><rect x="12" y="62" width="26" height="26" rx="4" fill="none" stroke="currentColor" stroke-width="7"/><rect x="52" y="52" width="14" height="14" fill="currentColor"/><rect x="74" y="52" width="14" height="14" fill="currentColor"/><rect x="52" y="74" width="14" height="14" fill="currentColor"/></svg>');
  /* backspace (для пин-пада, если нет) */
  add('i-back-key','0 0 100 100','<path d="M32 20h48a10 10 0 0110 10v40a10 10 0 01-10 10H32L8 50z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M46 38l20 24M66 38L46 62" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>');
})();

/* ---------- ГОСТЬ / НЕ-ВЛАДЕЛЕЦ: сбрасываем демо-баланс и не сеем демо-историю ----------
   Правка Даниэля 29.07: «почему я новый аккаунт создал и у меня баланс перенёсся весь?»
   «почему везде демо данные?». Демо-заготовки — только у owner (Даниэль).
   Всем остальным — 0 ₽, пустой леджер, никаких live-пингов. */
/* Владелец = Даниэль (ник ktodaniel). Регистрация меняет ник, но не роль,
   поэтому проверяем по нику: любой другой ник = «новый аккаунт», ему не нужны
   демо-баланс, демо-цели, демо-автопополнения и live-ping «пришло 500₽». */
function walIsOwner(){
  try{
    if(typeof PROFILE === 'undefined') return false;
    const nick = String(PROFILE.nick || '').toLowerCase();
    return nick === 'ktodaniel' || PROFILE.role === 'owner-force';
  }catch(e){ return false; }
}
(function walGuestGuard(){
  if(walIsOwner()) return;
  try{
    if(localStorage.getItem('oko-wallet-guest-v2') === '1') return;
    /* глушим оба демо-сида, даже если их уже нет */
    localStorage.setItem('oko-wallet-demo', '1');
    localStorage.setItem('oko-wallet-demo2', '1');
    WALLET.balance = 0;
    WALLET.hold = 0;
    WALLET.ledger = [];
    walletSave();
    /* Стираем оставшиеся демо-балансы (USDT/TON/XP) и демо-цели/автоправила —
       чтобы новый аккаунт стартовал с чистого нуля, а не с чужих значений. */
    localStorage.removeItem('oko-wallet-x');
    localStorage.setItem('oko-wallet-guest-v2', '1');
  }catch(e){}
})();

/* ---------- демо-наполнение леджера (один раз, реалистичные операции) ---------- */
(function walSeedDemo(){
  if(!walIsOwner()) return;
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
  if(!walIsOwner()) return;
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
let walPeriod = 'all';
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
  const accA = document.getElementById('walAccNumAcc'); if(accA) accA.textContent = WALLET.acc;
  /* Последние 4 цифры номера счёта — в блок «•••• XXXX» карты (Сбер-стиль) */
  const last = document.getElementById('walAccLast');
  if(last){
    const digits = String(WALLET.acc).replace(/\D/g,'');
    last.textContent = digits.slice(-4).padStart(4, '0');
  }
  walApplyEye();          // применить скрытый режим баланса
  walAnimateBalance();
  const hold = document.getElementById('walHold');
  if(hold){
    hold.style.display = WALLET.hold > 0 ? 'inline-flex' : 'none';
    const span = hold.querySelector('span');
    if(span) span.innerHTML = 'В обработке: <b>' + fmtMoney(WALLET.hold) + '</b>';
  }
  walRenderCurrencies();  // мультивалютная лента (в подстранице «Мои счета»)
  walRenderGoals();       // финансовые цели (в подстранице «Цели»)
  walRenderAutoRules();   // правила автопополнения
  walRenderStats();
  walRenderTopInc();      // топ-3 источника дохода
  walRenderPie();         // пирог расходов
  walRenderCats();
  walRenderLedger();
  walUpdateChips();
  walRenderAutopay();
  walRenderSafety();
  walRenderPlanned();
  walRenderSec();
  walDrawChart(true);
  walUpdateAvg();
  w2UpdateMainMeta();     // хлебные крошки в меню + XP + плашка про крипту
  /* демо-нотификация о входящем платеже — 1 раз за сессию, только owner */
  walMaybeDemoLive();
}

/* --- обновление подписей в главном меню (счета/автоплатежи/цели/безопасность) + XP + крипто-плашка --- */
function w2UpdateMainMeta(){
  /* XP-число */
  const xp = (WAL_X.balances && WAL_X.balances.XP) || 0;
  const xpEl = document.getElementById('walXpNum');
  if(xpEl) xpEl.textContent = Math.round(xp).toLocaleString('ru-RU').replace(/,/g,' ');
  /* подпись «Мои счета»: собираем валюты с ненулевым балансом или дефолт */
  const accSub = document.getElementById('walMenuAccSub');
  if(accSub){
    const codes = ['RUB','USDT_TON','USDT_TRC','TON'];
    const active = codes.filter(c => walCurBal(c) > 0).map(c => WAL_CUR_META[c].sym);
    accSub.textContent = active.length ? active.join(', ') + ' — 4 счёта' : 'Рубли, TON, USDT · открой валюту';
  }
  /* подпись «Автоплатежи»: сколько активных правил + PRO */
  const autoSub = document.getElementById('walMenuAutoSub');
  if(autoSub){
    const rules = (WAL_X.autoRules || []).filter(r => r.on).length;
    const pro   = WAL_X.autopay ? 'PRO автопродление' : null;
    const parts = [];
    if(pro)   parts.push(pro);
    if(rules) parts.push(rules + ' правил' + (rules === 1 ? 'о' : ''));
    autoSub.textContent = parts.length ? parts.join(' · ') : 'Пока не настроено';
  }
  /* подпись «Цели» */
  const goalsSub = document.getElementById('walMenuGoalsSub');
  if(goalsSub){
    const n = (WAL_X.goals || []).length;
    goalsSub.textContent = n ? n + ' актив' + (n === 1 ? 'ная' : 'ных') + ' · копи под мечту' : 'Заведи первую копилку';
  }
  /* подпись «Безопасность»: сколько мер включено */
  const secSub = document.getElementById('walMenuSecSub');
  if(secSub){
    const on = [];
    if(WAL_X.pin) on.push('ПИН');
    if(WAL_X.bio) on.push('Face-ID');
    secSub.textContent = on.length ? on.join(' · ') + ' активны' : 'ПИН, Face-ID, лимиты';
  }
  /* крипто-плашка в «Мои счета» — честно про внешний кошелёк */
  const cp = document.getElementById('walCryptoPlate');
  if(cp){
    if(WAL_X.ton){
      cp.innerHTML = '<b>TON-кошелёк подключён.</b> Токены зачисляются напрямую с внешнего Tonkeeper / TON Wallet. USDT-TRC20 — сеть Tron, тот же способ через централизованный обменник.';
    } else {
      cp.innerHTML = '<b>Крипта — только с внешним кошельком.</b> Пока TON-кошелёк не подключён, вкладки TON и USDT показывают ноль. Подключить в разделе «Переводы» → «На крипто-адрес» (Tonkeeper, TON Wallet, MyTonWallet).';
    }
  }
  /* crypto sub в переводах */
  const trs = document.getElementById('w2TransferCryptoSub');
  if(trs) trs.textContent = WAL_X.ton ? 'Кошелёк подключён · комиссия сети' : 'Требуется подключить внешний кошелёк';
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
let walChartDays = 30;                     // текущий период мини-графика 7 / 30
function walSetChartPeriod(d){
  walChartDays = Number(d) || 30;
  document.querySelectorAll('#walChartPeriod button').forEach(b=>b.classList.toggle('on', +b.dataset.cp === walChartDays));
  walDrawChart(true);
  walUpdateAvg();
}
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
    const pts = walSeries(walChartDays), n = pts.length;
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
  const periodMs = walPeriod === 'all' ? 0 : Number(walPeriod) * 864e5;
  const since = periodMs ? Date.now() - periodMs : 0;
  const list = WALLET.ledger
    .filter(op => {
      if(walFilter === 'all')   return true;
      if(walFilter === 'in')    return op.t === '+';
      if(walFilter === 'out')   return op.t === '-';
      if(walFilter === 'part')  return walCat(op.why) === 'Партнёрка';
      if(walFilter === 'games') return walCat(op.why) === 'Игры';
      return true;
    })
    .filter(op => !since || op.at >= since)
    .filter(op => !q || (op.why + ' ' + walCat(op.why)).toLowerCase().includes(q))
    .slice().sort((a,b)=>b.at-a.at)
    .slice(0, 80);
  if(!list.length){
    /* полностью пустой леджер + нет фильтров = CTA «пополни счёт» (правка 29.07) */
    if(!q && !since && walFilter === 'all' && WALLET.ledger.length === 0){
      box.innerHTML = `<div class="w2-empty-cta">
        <div class="w2-empty-ic">${I('plus')}</div>
        <b>Операций пока нет</b>
        <span>Пополни счёт — и здесь появятся все входящие и исходящие платежи.</span>
        <button onclick="walOpenTopup()">${I('plus')} Пополнить счёт</button>
      </div>`;
      return;
    }
    let emptyMsg;
    if(q) emptyMsg = 'Ничего не найдено';
    else if(since) emptyMsg = 'За выбранный период операций нет';
    else if(walFilter==='in')    emptyMsg = 'Пополнений пока нет';
    else if(walFilter==='out')   emptyMsg = 'Списаний пока нет';
    else if(walFilter==='part')  emptyMsg = 'Партнёрских начислений пока нет';
    else if(walFilter==='games') emptyMsg = 'Игровых операций пока нет';
    else emptyMsg = 'Операций пока нет';
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
function walSetPeriod(p){
  walPeriod = String(p);
  document.querySelectorAll('#walPeriod button').forEach(b=>b.classList.toggle('on', b.dataset.p===walPeriod));
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
  const bsw = document.getElementById('walBioSw'), bsub = document.getElementById('walBioSub');
  if(bsw) bsw.classList.toggle('on', !!WAL_X.bio);
  if(bsub) bsub.textContent = WAL_X.bio ? 'Включён — быстрый вход по отпечатку / Face-ID' : 'Выключен, быстрая разблокировка кошелька';
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

/* ---------- CSV-экспорт операций (Excel/Numbers/Google Sheets) ---------- */
function walCsvCell(v){
  const s = String(v==null ? '' : v);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
}
function walDownloadCSV(){
  const ops = WALLET.ledger.slice().sort((a,b)=>b.at-a.at);
  const rows = [['Дата','Тип','Категория','Сумма, ₽','Описание']];
  ops.forEach(o=>{
    rows.push([
      walDMYT(o.at),
      o.t==='+' ? 'Пополнение' : 'Списание',
      walCat(o.why),
      (o.t==='+' ? '+' : '-') + o.sum,
      o.why
    ]);
  });
  const csv = rows.map(r=>r.map(walCsvCell).join(';')).join('\r\n');
  const d = new Date();
  const name = 'oko-wallet-' + d.getFullYear() + '-' +
    String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + '.csv';
  const blob = new Blob(['﻿' + csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); }catch(e){} }, 4000);
  toast('CSV сохранён: ' + name + ' (' + ops.length + ' операций)');
}

/* ---------- ПЛАНИРУЕМЫЕ СПИСАНИЯ (ближайшие подписки и автоплатежи) ---------- */
function walPlannedItems(){
  const now = new Date();
  const y = now.getFullYear();
  const nextAutopay = WAL_X.autopay && WAL_X.nextAt
    ? {ic:'crown', title:'Автопродление PRO', date: walDMY(WAL_X.nextAt), sum: walProPrice(), sub:'Списание с лицевого счёта'}
    : {ic:'crown', title:'Подписка PRO', date:'1 сентября ' + y, sum: walProPrice(), sub:'Продление тарифа, если включишь автопродление'};
  return [
    nextAutopay,
    {ic:'plus',    title:'Автопополнение баланса', date:'5 октября ' + y, sum: 3000, sub:'Регулярное пополнение с карты РФ'},
    {ic:'rocket',  title:'Продвижение канала',     date:'12 октября ' + y, sum: 349,  sub:'Продление кампании «Старт»'},
  ];
}
function walRenderPlanned(){
  const box = document.getElementById('walPlanned');
  if(!box) return;
  const items = walPlannedItems();
  const total = items.reduce((s,it)=>s+it.sum, 0);
  box.innerHTML = items.map((it,i)=>`
    <div class="wal-plan-row" style="animation-delay:${i*50}ms">
      <div class="wal-plan-ic">${I(it.ic)}</div>
      <div class="wal-plan-b">
        <b>${it.title}</b>
        <span>${it.sub}, ${it.date}</span>
      </div>
      <div class="wal-plan-sum">− ${fmtMoney(it.sum)}</div>
    </div>`).join('') + `
    <div class="wal-plan-total"><span>Итого запланировано</span><b>− ${fmtMoney(total)}</b></div>`;
}

/* ---------- УРОВЕНЬ БЕЗОПАСНОСТИ (виджет с прогресс-баром) ---------- */
function walSafetyChecks(){
  return [
    {ok: !!WAL_X.pin,   name:'ПИН-код на вывод'},
    {ok: !!WAL_X.bio,   name:'Вход по отпечатку / Face-ID'},
    {ok: !!WAL_X.twofa, name:'Двухфакторная защита входа'},
    {ok: !!WAL_X.phone, name:'Привязанный номер телефона'},
    {ok: true,          name:'Подтверждение крупных операций'},
    {ok: true,          name:'Проверка устройств входа'},
  ];
}
function walRenderSafety(){
  const box = document.getElementById('walSafety');
  if(!box) return;
  const list = walSafetyChecks();
  const ok = list.filter(c=>c.ok).length, tot = list.length;
  const pct = Math.round(ok/tot*100);
  const lvl = ok>=5 ? 'максимальный' : ok>=4 ? 'высокий' : ok>=3 ? 'средний' : ok>=2 ? 'базовый' : 'низкий';
  const cls = ok>=4 ? 'hi' : ok>=3 ? 'md' : 'lo';
  box.innerHTML = `
    <div class="wal-safe-h">
      <div class="wal-safe-ic ${cls}">${I('lock')}</div>
      <div class="wal-safe-t">
        <b>Уровень защиты: ${lvl}</b>
        <span>${ok} из ${tot} мер активны, нажми для советов</span>
      </div>
      <span class="wal-safe-score ${cls}">${ok}/${tot}</span>
    </div>
    <div class="wal-safe-bar"><i class="${cls}" style="width:${pct}%"></i></div>
    <div class="wal-safe-list">
      ${list.map(c=>`<span class="wal-safe-chip ${c.ok?'on':''}">${I(c.ok ? 'check' : 'lock')}${c.name}</span>`).join('')}
    </div>`;
}
function walSafetyTips(){
  const off = walSafetyChecks().filter(c=>!c.ok);
  let body;
  if(off.length){
    const tips = {
      'ПИН-код на вывод':               'Включи ПИН-код в блоке «Лимиты и безопасность» ниже, любой вывод потребует 4 цифры.',
      'Вход по отпечатку / Face-ID':    'Включи в блоке «Лимиты и безопасность» — быстрая разблокировка вместо ввода ПИН.',
      'Двухфакторная защита входа':     'В настройках профиля привяжи Telegram-подтверждение входа, второй фактор к паролю.',
      'Привязанный номер телефона':     'Добавь телефон в профиле, восстановление доступа и SMS-подтверждение крупных операций.',
    };
    body = '<b>Что усилить, по приоритету:</b><br>' +
      off.map((c,i)=>'<b>' + (i+1) + '.</b> ' + c.name + '<br><span style="color:var(--dim);font-size:12px">' + (tips[c.name] || 'Активировать в настройках профиля.') + '</span>').join('<br><br>') +
      '<br><br>Каждая мера снижает риск кражи денег и потери доступа к счёту.';
  } else {
    body = 'Все меры активны, кошелёк защищён по максимуму. Проверяй список активных сессий раз в месяц.';
  }
  if(typeof showPopup === 'function'){
    showPopup({ico:'lock', title:'Как усилить защиту счёта', body, actions:[{label:'Понятно'}]});
  } else {
    toast('Активно ' + (walSafetyChecks().length - off.length) + ' из ' + walSafetyChecks().length + ' мер защиты');
  }
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

/* =========================================================================
   WALLET v2: MULTI-CURRENCY, EXCHANGE, SEND, RECEIVE (QR), GOALS,
   AUTO-TOP-UP, TOP-3 INCOME, PIE, AVG, EYE (HIDE BALANCE), FACE-ID
   ========================================================================= */

/* ---------- показать/скрыть баланс (глазик) ---------- */
function walToggleEye(){
  WAL_X.hidden = !WAL_X.hidden; walXSave();
  walApplyEye();
}
function walApplyEye(){
  const on = !!WAL_X.hidden;
  const eye = document.getElementById('walEye');
  if(eye){
    eye.classList.toggle('on', on);
    eye.innerHTML = on
      ? '<svg class="i" viewBox="0 0 100 100"><path d="M14 50s12-22 36-22 36 22 36 22-12 22-36 22S14 50 14 50z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M14 14l72 72" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>'
      : '<svg class="i"><use href="#i-eye"/></svg>';
  }
  const bal = document.getElementById('walBalance');
  if(bal) bal.classList.toggle('hidden', on);
  document.querySelectorAll('.wal-cur-bal, .wal-cur-eq').forEach(el=>el.classList.toggle('hidden', on));
}

/* ---------- КУРСЫ и валютные балансы ---------- */
const WAL_RATES = {                          // курс к рублю (демо, фиксирован)
  USDT_TON: 95,    // 1 USDT = 95 ₽
  USDT_TRC: 95,    // одинаковый USDT, разные сети
  TON:      380,   // 1 TON  = 380 ₽
  XP:       0.5,   // 1 XP   = 0.5 ₽ (внутренние баллы)
};
const WAL_CUR_META = {
  RUB:      {code:'RUB',      name:'Рубли',     sub:'Лицевой счёт',          cls:'rub',      ic:'money',   sym:'₽',    dec:0},
  USDT_TON: {code:'USDT-TON', name:'USDT · TON', sub:'Стейбл в сети TON',    cls:'usdt-ton', ic:'usdt',    sym:'USDT', dec:2},
  USDT_TRC: {code:'USDT-TRC', name:'USDT · TRC20',sub:'Стейбл в сети Tron',  cls:'usdt-trc', ic:'usdt',    sym:'USDT', dec:2},
  TON:      {code:'TON',       name:'Toncoin',   sub:'Криптовалюта TON',     cls:'ton',      ic:'ton',     sym:'TON',  dec:2},
  XP:       {code:'XP',        name:'Звёзды XP', sub:'Внутренняя валюта',    cls:'xp',       ic:'xp',      sym:'XP',   dec:0},
};
/* стартовые балансы — демо только для владельца, гостям — по нулям (правка 29.07) */
if(!WAL_X.balances){
  WAL_X.balances = walIsOwner()
    ? {USDT_TON: 42.15, USDT_TRC: 108.30, TON: 12.4, XP: 8420}
    : {USDT_TON: 0, USDT_TRC: 0, TON: 0, XP: 0};
  walXSave();
}
function walCurBal(code){ return code === 'RUB' ? WALLET.balance : (WAL_X.balances[code] || 0); }
function walCurSet(code, v){
  if(code === 'RUB'){ WALLET.balance = Math.max(0, v); walletSave(); return; }
  WAL_X.balances[code] = Math.max(0, v); walXSave();
}
function walCurRub(code, amt){
  if(code === 'RUB') return amt;
  return amt * (WAL_RATES[code] || 0);
}
function walCurFmt(code, v){
  const m = WAL_CUR_META[code];
  if(!m) return String(v);
  if(code === 'RUB') return fmtMoney(v);
  const val = m.dec ? (Math.round(v * 100) / 100).toLocaleString('ru-RU', {minimumFractionDigits: m.dec, maximumFractionDigits: m.dec})
                    : Math.round(v).toLocaleString('ru-RU').replace(/,/g,' ');
  return val + ' ' + m.sym;
}
/* лого-круг валюты (для карточки и обмена) */
function walCurLogoHtml(code, klass){
  const m = WAL_CUR_META[code];
  const inner = code === 'RUB' ? '₽' : (code === 'XP' ? I('xp') : I(m.ic));
  return `<span class="wal-cur-logo ${m.cls} ${klass||''}">${inner}</span>`;
}

/* ---------- РЕНДЕР ЛЕНТЫ МУЛЬТИВАЛЮТНЫХ КАРТОЧЕК (устаревшая ленты strip)
   Оставлен как no-op для совместимости — теперь валюты живут в подстранице
   «Мои счета» (walRenderAccounts). XP — отдельным блоком, не как валюта. */
function walRenderCurrencies(){
  /* обновляем сумму эквивалента и список счетов в подстранице */
  walRenderAccounts();
}
let walCurRAF = 0;

/* ---------- НОВОЕ: список валютных счетов (подстраница «Мои счета») ---------- */
function walRenderAccounts(){
  const list = document.getElementById('walAccList');
  const totEl = document.getElementById('walTotalEq');
  /* Общий эквивалент — сумма всех валют в рублях (без XP: XP не валюта) */
  const codes = ['RUB','USDT_TON','USDT_TRC','TON'];
  let totalRub = 0;
  codes.forEach(c => { totalRub += walCurRub(c, walCurBal(c)); });
  if(totEl){
    totEl.innerHTML = Math.round(totalRub).toLocaleString('ru-RU').replace(/,/g,' ') + ' <b>₽</b>';
  }
  if(!list) return;
  const tonConnected = !!WAL_X.ton;
  list.innerHTML = codes.map(code => {
    const m = WAL_CUR_META[code];
    const bal = walCurBal(code);
    const eq  = walCurRub(code, bal);
    const isCrypto = code !== 'RUB';
    const disabled = isCrypto && !tonConnected && bal === 0;
    if(disabled){
      return `<button class="w2-acc-row disabled" onclick="w2Close('accounts');w2Open('transfers')" aria-label="Открыть счёт ${m.name}">
        ${walCurLogoHtml(code)}
        <div class="w2-acc-body">
          <b>${m.name}</b>
          <em>Нужен внешний ${code === 'TON' ? 'TON' : (code === 'USDT_TON' ? 'TON' : 'TRC20')}-кошелёк</em>
        </div>
        <span class="w2-acc-cta">Открыть счёт</span>
      </button>`;
    }
    return `<button class="w2-acc-row" onclick="walOpenCurDetail('${code}')" aria-label="Открыть счёт ${m.name}">
      ${walCurLogoHtml(code)}
      <div class="w2-acc-body">
        <b>${m.name}</b>
        <em>${isCrypto ? '<span class="rate">1 ' + m.sym + ' = ' + fmtMoney(WAL_RATES[code]).replace(' ₽','') + ' ₽</span>' : 'Основной лицевой счёт'}</em>
      </div>
      <div class="w2-acc-sum">
        <b>${walCurFmt(code, bal)}</b>
        ${isCrypto && bal > 0 ? '<em>≈ ' + fmtMoney(eq) + '</em>' : ''}
      </div>
    </button>`;
  }).join('');
}

/* ---------- ДЕТАЛИ ВАЛЮТЫ (bottom-sheet) ---------- */
function walOpenCurDetail(code){
  const m = WAL_CUR_META[code];
  const bal = walCurBal(code);
  const eq  = walCurRub(code, bal);
  document.getElementById('walCurDetailView').innerHTML = `
    <div style="text-align:center;padding:6px 0 4px">
      ${walCurLogoHtml(code)}
      <h3 style="margin-top:12px">${m.name}</h3>
      <p class="dim" style="font-size:12px;margin-top:3px">${m.sub}</p>
      <div style="font-family:var(--font-display);font-size:36px;letter-spacing:.02em;margin:16px 0 4px;color:var(--accent)">${walCurFmt(code, bal)}</div>
      <div style="font-size:13px;color:var(--dim)">≈ ${fmtMoney(eq)} по курсу ${fmtMoney(WAL_RATES[code]).replace(' ₽','')} ₽ за 1 ${m.sym}</div>
    </div>
    <div style="height:18px"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn" onclick="closeSheet();walExState={from:'${code}',to:'RUB',amount:0,editing:'from'};w2Open('exchange')"><svg class="i"><use href="#i-swap"/></svg> Продать за ₽</button>
      <button class="btn ghost" onclick="closeSheet();walExState={from:'RUB',to:'${code}',amount:0,editing:'from'};w2Open('exchange')"><svg class="i"><use href="#i-plus"/></svg> Купить за ₽</button>
    </div>
    <div style="height:8px"></div>
    <button class="btn ghost" onclick="closeSheet();walRecvState={sum:0,note:'',code:'${code}'};w2Open('receive')"><svg class="i"><use href="#i-qr"/></svg> Принять ${m.sym}</button>`;
  openSheet('walCurDetail');
}

/* ---------- ОБМЕН ВАЛЮТ ---------- */
let walExState = {from:'RUB', to:'USDT_TON', amount:0, editing:'from'};
function walOpenExchange(from, to){
  const codes = ['RUB','USDT_TON','USDT_TRC','TON','XP'];
  walExState.from = codes.includes(from) ? from : 'RUB';
  walExState.to   = codes.includes(to)   ? to   : (walExState.from === 'RUB' ? 'USDT_TON' : 'RUB');
  walExState.amount = 0; walExState.editing = 'from';
  walRenderExchange();
  openSheet('walExchange');
}
function walExRate(from, to){
  const fRub = from === 'RUB' ? 1 : WAL_RATES[from];
  const tRub = to   === 'RUB' ? 1 : WAL_RATES[to];
  return fRub / tRub;
}
function walExOut(){
  const s = walExState;
  return s.amount * walExRate(s.from, s.to);
}
function walExFee(){ return walExOut() * 0.005; }   // 0.5% спред
function walExFinal(){ return walExOut() - walExFee(); }
function walRenderExchange(){
  const s = walExState;
  const codes = ['RUB','USDT_TON','USDT_TRC','TON','XP'];
  const fromM = WAL_CUR_META[s.from], toM = WAL_CUR_META[s.to];
  const outVal = walExFinal();
  document.getElementById('walExView').innerHTML = `
    <h3>Обмен валют</h3>
    <p class="dim" style="font-size:12.5px;margin:-4px 0 12px">Мгновенный обмен внутри кошелька · спред 0.5%</p>
    <div class="wal-ex-swap">
      <div class="wal-ex-cell on">
        <span class="wal-ex-lbl">Отдаёте</span>
        ${walCurLogoHtml(s.from)}
        <div class="wal-ex-cell-mid">
          <div class="wal-ex-cell-code">${fromM.name}</div>
          <div class="wal-ex-cell-max">Доступно: ${walCurFmt(s.from, walCurBal(s.from))}</div>
        </div>
        <input id="walExAmt" type="number" min="0" step="any" placeholder="0" value="${s.amount||''}"
          oninput="walExState.amount=Math.max(0,Number(this.value)||0);walSyncExchange()">
      </div>
      <button class="wal-ex-arrow" onclick="walExSwap()" aria-label="Поменять местами"><svg class="i"><use href="#i-swap"/></svg></button>
      <div class="wal-ex-cell">
        <span class="wal-ex-lbl">Получаете</span>
        ${walCurLogoHtml(s.to)}
        <div class="wal-ex-cell-mid">
          <div class="wal-ex-cell-code">${toM.name}</div>
          <div class="wal-ex-cell-max">Курс: 1 ${fromM.sym} = ${walExRate(s.from, s.to).toFixed(6).replace(/\.?0+$/,'')} ${toM.sym}</div>
        </div>
        <input type="text" readonly value="${outVal ? walCurFmt(s.to, outVal).replace(' '+toM.sym,'') : ''}" placeholder="0">
      </div>
    </div>
    <p style="font-weight:600;font-size:12.5px;margin:14px 0 6px">Быстрый выбор пары</p>
    <div class="wal-ex-cur-pick">${codes.filter(c=>c!==s.from).map(c=>`
      <button class="${s.to===c?'on':''}" onclick="walExState.to='${c}';walRenderExchange()">
        ${walCurLogoHtml(c)}<span>${WAL_CUR_META[c].sym}</span>
      </button>`).join('')}</div>
    <div class="wal-ex-rate" id="walExRateBox"></div>
    <div style="height:8px"></div>
    <button class="btn" onclick="walDoExchange()"><svg class="i"><use href="#i-swap"/></svg> <span id="walExBtn">Обменять</span></button>
    <p class="dim" style="font-size:11px;text-align:center;margin-top:9px">Курс фиксируется в момент обмена. Комиссия сети OKO 0.5% уже учтена.</p>`;
  walSyncExchange();
}
function walSyncExchange(){
  const s = walExState, out = walExFinal(), toM = WAL_CUR_META[s.to];
  const box = document.getElementById('walExRateBox');
  if(box){
    box.innerHTML = s.amount > 0
      ? `Отдаёте <b>${walCurFmt(s.from, s.amount)}</b> → получите <em>${walCurFmt(s.to, out)}</em><br>Курс: 1 ${WAL_CUR_META[s.from].sym} = ${walExRate(s.from, s.to).toFixed(6).replace(/\.?0+$/,'')} ${toM.sym} · спред 0.5%`
      : 'Введи сумму, чтобы увидеть, сколько получишь';
  }
  const b = document.getElementById('walExBtn');
  if(b) b.textContent = s.amount > 0 ? `Обменять ${walCurFmt(s.from, s.amount)}` : 'Обменять';
}
function walExSwap(){
  const t = walExState.from; walExState.from = walExState.to; walExState.to = t;
  walExState.amount = 0;
  walRenderExchange();
}
function walDoExchange(){
  const s = walExState;
  if(!s.amount || s.amount <= 0){ toast('Укажи сумму обмена'); return; }
  if(s.amount > walCurBal(s.from)){ toast('Недостаточно средств: доступно ' + walCurFmt(s.from, walCurBal(s.from))); return; }
  const out = walExFinal();
  const from = WAL_CUR_META[s.from], to = WAL_CUR_META[s.to];
  const v = document.getElementById('walExView');
  v.innerHTML = `<div style="text-align:center;padding:22px 0"><div class="spin"></div><p style="font-weight:700;margin-top:14px">Обмен…</p></div>`;
  setTimeout(()=>{
    /* списываем «от» */
    if(s.from === 'RUB'){
      walletCharge(s.amount, 'Обмен ' + from.sym + ' → ' + to.sym);
    } else {
      walCurSet(s.from, walCurBal(s.from) - s.amount);
    }
    /* начисляем «в» */
    if(s.to === 'RUB'){
      walletAdd(Math.round(out), 'Обмен ' + from.sym + ' → ₽');
    } else {
      walCurSet(s.to, walCurBal(s.to) + out);
      /* лог операции — рубль-эквивалент, чтобы он попал в статистику */
      WALLET.ledger.unshift({t:'-', sum: Math.round(walCurRub(s.from, s.amount) - walCurRub(s.to, out)),
        why: 'Спред обмена ' + from.sym + ' → ' + to.sym, at: Date.now()});
      walletSave();
    }
    v.innerHTML = `<div class="wal-ok-wrap">
      <div class="wal-ok">${I('check')}</div>
      <p style="font-weight:800;font-size:19px;margin-top:14px">${walCurFmt(s.to, out)}</p>
      <p class="dim" style="font-size:13px;margin-top:6px">Обмен выполнен: ${walCurFmt(s.from, s.amount)} → ${walCurFmt(s.to, out)}<br>Новый баланс ${to.sym}: <b>${walCurFmt(s.to, walCurBal(s.to))}</b></p>
      <div style="height:16px"></div>
      <button class="btn" onclick="closeSheet()">Отлично</button></div>`;
    renderWallet();
    walFlash(s.to === 'RUB' ? 'in' : 'out');
    toast('Обмен: ' + walCurFmt(s.from, s.amount) + ' → ' + walCurFmt(s.to, out));
  }, 900);
}

/* ---------- ОТПРАВКА ДРУГОМУ ПОЛЬЗОВАТЕЛЮ ---------- */
const WAL_CONTACTS = [
  {nick:'markvolkov',  name:'Марк Волков'},
  {nick:'aniasokol',   name:'Аня Соколова'},
  {nick:'okoteam',     name:'OKO Team'},
  {nick:'nikapro',     name:'Ника Про'},
  {nick:'dm_studio',   name:'DM Studio'},
  {nick:'levabass',    name:'Лёва Басс'},
];
let walSendState = {to:'', name:'', sum:0, note:''};
function walOpenSend(nickPrefill){
  walSendState = {to: nickPrefill||'', name:'', sum:0, note:''};
  walRenderSend();
  openSheet('walSend');
}
function walRenderSend(){
  const s = walSendState;
  const contactChip = c => `
    <button class="wal-send-qi" onclick="walSendState.to='${c.nick}';walSendState.name='${esc(c.name)}';walRenderSend()">
      <span class="wal-send-av">${c.name.charAt(0)}</span><span>${esc(c.name.split(' ')[0])}</span>
    </button>`;
  document.getElementById('walSendView').innerHTML = `
    <h3>Отправить деньги</h3>
    <p class="dim" style="font-size:12.5px;margin:-4px 0 12px">Перевод внутри OKO — мгновенно и без комиссии</p>
    <div class="wal-send-to">
      <span class="wal-send-av">${(s.name || s.to || '?').charAt(0).toUpperCase()}</span>
      <input placeholder="Ник получателя, например ktodaniel" value="${esc(s.to)}"
        oninput="walSendState.to=this.value.replace(/^@/,'').trim();walSyncSendBtn()">
    </div>
    <p style="font-weight:600;font-size:12px;margin:2px 0 6px;color:var(--dim);letter-spacing:.06em;text-transform:uppercase">Недавние</p>
    <div class="wal-send-quick">${WAL_CONTACTS.map(contactChip).join('')}</div>
    <input class="wal-send-note" placeholder="Комментарий, например «за монтаж»"
      value="${esc(s.note)}" maxlength="80" oninput="walSendState.note=this.value">
    <div class="wal-qs">${[100,500,1000,2000].map(v=>`
      <button class="${s.sum===v?'on':''}" onclick="walSendState.sum=${v};walRenderSend()">${v>=1000?(v/1000)+'к':v}</button>`).join('')}</div>
    <input id="walSendSum" type="number" min="1" placeholder="Сумма, ₽" value="${s.sum||''}"
      oninput="walSendState.sum=Math.max(0,Number(this.value)||0);walSyncSendBtn()">
    <div style="height:6px"></div>
    <p class="dim" style="font-size:12px">Доступно: <b style="color:var(--accent)">${fmtMoney(WALLET.balance)}</b> · комиссии нет · получатель увидит перевод в чате.</p>
    <div style="height:12px"></div>
    <button class="btn" onclick="walDoSend()"><svg class="i"><use href="#i-send"/></svg> <span id="walSendBtn">Отправить</span></button>`;
  walSyncSendBtn();
}
function walSyncSendBtn(){
  const s = walSendState;
  const b = document.getElementById('walSendBtn');
  if(b) b.textContent = s.sum > 0 && s.to ? 'Отправить ' + fmtMoney(s.sum) : 'Отправить';
}
function walDoSend(){
  const s = walSendState;
  if(!s.to){ toast('Укажи ник получателя'); return; }
  if(!s.sum || s.sum <= 0){ toast('Укажи сумму перевода'); return; }
  if(s.sum > WALLET.balance){ toast('Недостаточно средств: доступно ' + fmtMoney(WALLET.balance)); return; }
  const why = 'Перевод в чате · @' + s.to + (s.note ? ' («' + s.note + '»)' : '');
  const v = document.getElementById('walSendView');
  v.innerHTML = `<div style="text-align:center;padding:22px 0"><div class="spin"></div><p style="font-weight:700;margin-top:14px">Отправляем…</p></div>`;
  setTimeout(()=>{
    walletCharge(s.sum, why);
    v.innerHTML = `<div class="wal-ok-wrap">
      <div class="wal-ok">${I('check')}</div>
      <p style="font-weight:800;font-size:19px;margin-top:14px">− ${fmtMoney(s.sum)}</p>
      <p class="dim" style="font-size:13px;margin-top:6px">Перевод @${esc(s.to)} доставлен.<br>Баланс: <b>${fmtMoney(WALLET.balance)}</b></p>
      <div style="height:16px"></div>
      <button class="btn" onclick="closeSheet()">Готово</button></div>`;
    renderWallet();
    walFlash('out');
    toast('Отправлено @' + s.to + ': ' + fmtMoney(s.sum));
  }, 800);
}

/* ---------- QR-ПРИЁМ (canvas) ---------- */
let walRecvState = {sum:0, note:'', code:'RUB'};
function walOpenReceive(code){
  walRecvState = {sum: 0, note:'', code: code || 'RUB'};
  walRenderReceive();
  openSheet('walReceive');
  setTimeout(walDrawRecvQR, 40);
}
function walRecvLink(){
  const s = walRecvState;
  const base = 'https://okoteam.top/pay';
  const p = new URLSearchParams();
  p.set('to', WALLET.acc);
  if(s.sum) p.set('sum', String(s.sum));
  if(s.note) p.set('note', s.note);
  if(s.code && s.code !== 'RUB') p.set('cur', s.code);
  return base + '?' + p.toString();
}
function walRenderReceive(){
  const s = walRecvState, m = WAL_CUR_META[s.code];
  document.getElementById('walRecvView').innerHTML = `
    <h3 style="margin-bottom:2px">Принять платёж</h3>
    <p class="dim" style="font-size:12.5px;margin:-2px 0 10px">Покажи QR — плательщик отсканирует и увидит счёт${s.code!=='RUB'?' в '+m.sym:''}</p>
    <div class="wal-recv">
      <div class="wal-recv-card">
        <canvas id="walRecvCanvas" width="420" height="420" aria-label="QR-код"></canvas>
        <div class="wal-recv-sum">${s.sum ? walCurFmt(s.code, s.sum) : (s.code==='RUB'?'Любая сумма':'Любое количество '+m.sym)}</div>
        <div class="wal-recv-sub">Счёт: <b>${WALLET.acc}</b>${s.note?'<br>«'+esc(s.note)+'»':''}</div>
        <div class="wal-recv-inputs">
          <input type="number" min="0" step="any" placeholder="Сумма ${m.sym}" value="${s.sum||''}"
            oninput="walRecvState.sum=Math.max(0,Number(this.value)||0);walDrawRecvQR();walRenderReceiveText()">
          <input placeholder="Комментарий" maxlength="40" value="${esc(s.note)}"
            oninput="walRecvState.note=this.value;walDrawRecvQR();walRenderReceiveText()">
        </div>
        <button class="wal-recv-link" onclick="walCopy(walRecvLink(),'Ссылка на приём скопирована')">
          <svg class="i"><use href="#i-copy"/></svg>
          <span id="walRecvLink">${esc(walRecvLink())}</span>
        </button>
      </div>
      <div class="wal-recv-share">
        <button class="prim" onclick="walShareReceive()"><svg class="i"><use href="#i-share"/></svg>Поделиться</button>
        <button class="sec" onclick="walCopy(walRecvLink(),'Ссылка скопирована')"><svg class="i"><use href="#i-copy"/></svg>Копировать</button>
      </div>
    </div>`;
}
function walRenderReceiveText(){
  const el = document.getElementById('walRecvLink');
  if(el) el.textContent = walRecvLink();
  const sumEl = document.querySelector('.wal-recv-sum');
  if(sumEl){
    const s = walRecvState, m = WAL_CUR_META[s.code];
    sumEl.textContent = s.sum ? walCurFmt(s.code, s.sum) : (s.code==='RUB'?'Любая сумма':'Любое количество '+m.sym);
  }
}
function walDrawRecvQR(){
  const cv = document.getElementById('walRecvCanvas'); if(!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.fillStyle = '#fff'; ctx.fillRect(0,0,W,H);
  /* сеть 25x25 (генерируем «QR-подобный» узор детерминированно по ссылке) */
  const N = 25, cell = W / N;
  const seed = walRecvLink();
  let h = 2166136261;
  for(let i = 0; i < seed.length; i++){ h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const rnd = ()=>{ h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
  const inFinder = (r,c)=> (r < 8 && c < 8) || (r < 8 && c >= N-8) || (r >= N-8 && c < 8);
  const inAlign  = (r,c)=> (r >= 17 && r <= 21 && c >= 17 && c <= 21);
  ctx.fillStyle = '#0a0a0a';
  for(let r = 0; r < N; r++) for(let c = 0; c < N; c++){
    if(inFinder(r,c) || inAlign(r,c)) continue;
    if(r === 6 || c === 6){                       // тайминг-линии
      if((r + c) % 2 === 0) ctx.fillRect(c*cell, r*cell, cell, cell);
      continue;
    }
    if(rnd() < 0.47) ctx.fillRect(c*cell, r*cell, cell, cell);
  }
  /* три finder-квадрата в углах */
  const fp = (r,c)=>{
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(c*cell, r*cell, 7*cell, 7*cell);
    ctx.fillStyle = '#fff';    ctx.fillRect((c+1)*cell, (r+1)*cell, 5*cell, 5*cell);
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect((c+2)*cell, (r+2)*cell, 3*cell, 3*cell);
  };
  fp(0,0); fp(0, N-7); fp(N-7, 0);
  /* маленький alignment в правом-нижнем */
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(17*cell, 17*cell, 5*cell, 5*cell);
  ctx.fillStyle = '#fff';    ctx.fillRect(18*cell, 18*cell, 3*cell, 3*cell);
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(19*cell, 19*cell, cell, cell);
  /* лого OKO в центре — лайм-круг с O */
  const cx = W/2, cy = H/2, R = W * 0.13;
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, R + cell*0.7, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#9AFF00'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold ' + Math.round(R * 1.05) + 'px "Bebas Neue", Impact, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('O', cx, cy + R*0.06);
}
function walShareReceive(){
  const link = walRecvLink();
  const text = 'Прими платёж на OKO-счёт ' + WALLET.acc + (walRecvState.sum ? ' · ' + walCurFmt(walRecvState.code, walRecvState.sum) : '');
  if(navigator.share){
    navigator.share({title: 'Платёж OKO', text, url: link}).catch(()=>{});
  } else {
    walCopy(link, 'Ссылка на приём скопирована');
  }
}

/* ---------- ПИРОГ РАСХОДОВ (SVG donut) ---------- */
const WAL_PIE_COLORS = ['#9AFF00','#7ECBEB','#FFB84A','#FF7EA6','#A980FF','#4EE2B8','#FFDF5C','#FF5C5C'];
function walRenderPie(){
  const box = document.getElementById('walPie');
  if(!box) return;
  const sums = {};
  const since = Date.now() - 30 * 864e5;
  WALLET.ledger.forEach(op=>{ if(op.t==='-' && op.at >= since) sums[walCat(op.why)] = (sums[walCat(op.why)]||0) + op.sum; });
  const cats = Object.entries(sums).sort((a,b)=>b[1]-a[1]);
  if(!cats.length){
    box.innerHTML = `<div class="wal-pie-empty">Расходов за 30 дней нет — держи баланс в плюсе.</div>`;
    return;
  }
  const total = cats.reduce((s,c)=>s+c[1], 0);
  const R = 42, C = 2 * Math.PI * R;
  let acc = 0;
  const arcs = cats.map(([k,v],i)=>{
    const frac = v / total, len = C * frac;
    const el = `<circle cx="60" cy="60" r="${R}" fill="transparent"
      stroke="${WAL_PIE_COLORS[i%WAL_PIE_COLORS.length]}" stroke-width="16"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-acc}"
      style="animation:walBarIn .7s cubic-bezier(.3,1,.4,1) ${i*70}ms both"/>`;
    acc += len;
    return el;
  }).join('');
  const list = cats.slice(0, 6).map(([k,v],i)=>{
    const pct = Math.round(v / total * 100);
    return `<div class="wal-pie-row" style="animation-delay:${i*60}ms">
      <span class="wal-pie-dot" style="background:${WAL_PIE_COLORS[i%WAL_PIE_COLORS.length]}"></span>
      <span class="wal-pie-nm">${esc(k)}</span>
      <span class="wal-pie-pct">${pct||'<1'}%</span>
    </div>`;
  }).join('');
  box.innerHTML = `
    <div class="wal-pie">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="${R}" fill="transparent" stroke="var(--raised)" stroke-width="16"/>
        ${arcs}
      </svg>
      <div class="wal-pie-center"><b>${fmtMoney(total)}</b><span>Всего 30 дней</span></div>
    </div>
    <div class="wal-pie-list">${list}</div>`;
}

/* ---------- ТОП-3 ИСТОЧНИКА ДОХОДА + СРЕДНЕЕ В ДЕНЬ ---------- */
function walRenderTopInc(){
  const box = document.getElementById('walTopInc');
  if(!box) return;
  const since = Date.now() - 30 * 864e5;
  const sums = {};
  let totalIn = 0;
  WALLET.ledger.forEach(op=>{
    if(op.t !== '+' || op.at < since) return;
    const c = walCat(op.why);
    sums[c] = (sums[c] || 0) + op.sum;
    totalIn += op.sum;
  });
  const cats = Object.entries(sums).sort((a,b)=>b[1]-a[1]).slice(0, 3);
  if(!cats.length){
    box.innerHTML = `<div class="wal-topinc-empty">За 30 дней доходов ещё нет — время монетизировать контент.</div>`;
    return;
  }
  const avg = Math.round(totalIn / 30);
  box.innerHTML = cats.map(([k,v],i)=>{
    const pct = totalIn ? Math.round(v / totalIn * 100) : 0;
    return `<div class="wal-topinc-r" style="animation-delay:${i*60}ms">
      <span class="wal-topinc-rank">${i+1}</span>
      <div class="wal-topinc-b">
        <b>${esc(k)}</b><span>${pct}% от всего дохода за 30 дней</span>
      </div>
      <span class="wal-topinc-sum">+ ${fmtMoney(v)}</span>
    </div>`;
  }).join('') + `
    <div class="wal-avg-chip">${I('users')}<span>В среднем в день:</span><b>+ ${fmtMoney(avg)}</b></div>`;
}

/* среднее в день под мини-графиком в hero */
function walUpdateAvg(){
  const el = document.getElementById('walAvg');
  if(!el) return;
  const days = walChartDays;
  const since = Date.now() - days * 864e5;
  let inc = 0, exp = 0;
  WALLET.ledger.forEach(o=>{
    if(o.at < since) return;
    if(o.t === '+') inc += o.sum; else exp += o.sum;
  });
  const net = inc - exp, avg = Math.round(net / days);
  const sign = avg >= 0 ? '+' : '−';
  el.innerHTML = `<svg viewBox="0 0 100 100"><path d="M20 66 50 34 80 66" fill="none" stroke="currentColor" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></svg>
    В среднем в день: <b>${sign} ${fmtMoney(Math.abs(avg))}</b> · за ${days} дн: ${sign} ${fmtMoney(Math.abs(net))}`;
}

/* ---------- ФИНАНСОВЫЕ ЦЕЛИ (демо-цели только у владельца, правка 29.07) ---------- */
if(!WAL_X.goals){
  WAL_X.goals = walIsOwner()
    ? [
        {id:'g_pro', name:'Копим на PRO', target: walProPrice(), saved: Math.round(walProPrice()*0.32), ic:'crown'},
        {id:'g_camera', name:'Камера для съёмок', target: 89000, saved: 24500, ic:'photo'},
      ]
    : [];
  walXSave();
}
function walRenderGoals(){
  const box = document.getElementById('walGoals');
  if(!box) return;
  const items = WAL_X.goals || [];
  box.innerHTML = items.map(g=>{
    const pct = Math.min(100, Math.round((g.saved || 0) / (g.target || 1) * 100));
    const done = pct >= 100;
    return `<div class="card wal-goal ${done?'done':''}" onclick="walOpenGoal('${g.id}')" role="button">
      <div class="wal-goal-top">
        <div class="wal-goal-ic">${I(g.ic || 'target')}</div>
        <div class="wal-goal-b"><b>${esc(g.name)}</b><span>${done?'Цель достигнута — забирай и трать':'Осталось накопить '+fmtMoney(Math.max(0, g.target - g.saved))}</span></div>
        <span class="wal-goal-pct">${pct}%</span>
      </div>
      <div class="wal-goal-bar"><i style="width:${pct}%"></i></div>
      <div class="wal-goal-foot">
        <span>Собрано <b>${fmtMoney(g.saved || 0)}</b></span>
        <span>Цель <b>${fmtMoney(g.target || 0)}</b></span>
      </div>
    </div>`;
  }).join('') + `
    <button class="wal-goal-add" onclick="walOpenGoal()"><svg class="i"><use href="#i-plus"/></svg>Добавить цель</button>`;
}
const WAL_GOAL_ICS = ['target','crown','rocket','photo','circle-play','bookmark','fire','globe'];
let walGoalEdit = null;
function walOpenGoal(id){
  const g = id ? (WAL_X.goals||[]).find(x=>x.id===id) : {id:'g_'+Math.random().toString(36).slice(2,7), name:'', target:0, saved:0, ic:'target'};
  walGoalEdit = Object.assign({_new: !id}, g);
  walRenderGoal();
  openSheet('walGoal');
}
function walRenderGoal(){
  const g = walGoalEdit; if(!g) return;
  document.getElementById('walGoalView').innerHTML = `
    <h3>${g._new ? 'Новая цель' : 'Цель · ' + esc(g.name || 'без имени')}</h3>
    <div class="wal-goal-form">
      <div>
        <span class="wal-autor-lbl">Название</span>
        <input class="wal-autor-inp" placeholder="Копим на новую камеру" value="${esc(g.name)}"
          oninput="walGoalEdit.name=this.value">
      </div>
      <div>
        <span class="wal-autor-lbl">Цель, ₽</span>
        <input class="wal-autor-inp" type="number" min="1" placeholder="5000" value="${g.target||''}"
          oninput="walGoalEdit.target=Math.max(0,Number(this.value)||0)">
      </div>
      <div>
        <span class="wal-autor-lbl">Уже накоплено, ₽</span>
        <input class="wal-autor-inp" type="number" min="0" placeholder="0" value="${g.saved||''}"
          oninput="walGoalEdit.saved=Math.max(0,Number(this.value)||0)">
      </div>
      <div>
        <span class="wal-autor-lbl">Иконка</span>
        <div class="wal-goal-ic-pick">${WAL_GOAL_ICS.map(ic=>`
          <button class="${g.ic===ic?'on':''}" onclick="walGoalEdit.ic='${ic}';walRenderGoal()">${I(ic)}</button>`).join('')}</div>
      </div>
    </div>
    <button class="btn" onclick="walSaveGoal()"><svg class="i"><use href="#i-check"/></svg> Сохранить цель</button>
    ${g._new ? '' : `<div style="height:8px"></div>
      <button class="btn ghost" style="color:var(--danger);border-color:var(--danger)" onclick="walDeleteGoal()"><svg class="i"><use href="#i-trash"/></svg> Удалить цель</button>`}`;
}
function walSaveGoal(){
  const g = walGoalEdit; if(!g) return;
  if(!g.name.trim()){ toast('Введи название цели'); return; }
  if(!g.target || g.target <= 0){ toast('Укажи сумму цели'); return; }
  const arr = WAL_X.goals || [];
  const idx = arr.findIndex(x=>x.id===g.id);
  const clean = {id:g.id, name:g.name.trim(), target:g.target, saved:g.saved||0, ic:g.ic||'target'};
  if(idx < 0) arr.push(clean); else arr[idx] = clean;
  WAL_X.goals = arr; walXSave();
  closeSheet(); walRenderGoals();
  toast(g._new ? 'Цель добавлена: ' + clean.name : 'Цель обновлена');
}
function walDeleteGoal(){
  const g = walGoalEdit; if(!g) return;
  WAL_X.goals = (WAL_X.goals||[]).filter(x=>x.id!==g.id); walXSave();
  closeSheet(); walRenderGoals();
  toast('Цель удалена');
}

/* ---------- АВТОПОПОЛНЕНИЯ (демо-правило только у владельца, правка 29.07) ---------- */
if(!WAL_X.autoRules){
  WAL_X.autoRules = walIsOwner()
    ? [{id:'ar_1', below: 1000, sum: 5000, method:'card', on: true}]
    : [];
  walXSave();
}
function walRenderAutoRules(){
  const box = document.getElementById('walAutoRules');
  if(!box) return;
  const rules = WAL_X.autoRules || [];
  const list = rules.length ? rules.map(r=>`
    <div class="wal-autor-r" style="opacity:${r.on?1:.55}">
      <div class="wal-autor-ic">${I('plus')}</div>
      <div class="wal-autor-b">
        <b>Если баланс &lt; ${fmtMoney(r.below)}</b>
        <span>Пополнить на <b style="color:var(--accent)">${fmtMoney(r.sum)}</b> · ${WAL_M_LABEL[r.method]||'Карта РФ'} · ${r.on?'активно':'выключено'}</span>
      </div>
      <button class="wal-autor-x" onclick="walToggleAutoRule('${r.id}')" aria-label="${r.on?'Выключить':'Включить'}">${I(r.on?'check':'plus')}</button>
      <button class="wal-autor-x" onclick="walDeleteAutoRule('${r.id}')" aria-label="Удалить">${I('trash')}</button>
    </div>`).join('') : `<div class="wal-autor-empty">Правил ещё нет. Настрой — и баланс не упадёт до нуля в самый неподходящий момент.</div>`;
  box.innerHTML = list + `
    <button class="wal-autor-add" onclick="walOpenAutoRule()"><svg class="i"><use href="#i-plus"/></svg>Новое правило</button>`;
}
function walToggleAutoRule(id){
  const r = (WAL_X.autoRules||[]).find(x=>x.id===id); if(!r) return;
  r.on = !r.on; walXSave(); walRenderAutoRules();
  toast('Автопополнение ' + (r.on ? 'включено' : 'выключено'));
}
function walDeleteAutoRule(id){
  WAL_X.autoRules = (WAL_X.autoRules||[]).filter(x=>x.id!==id); walXSave();
  walRenderAutoRules(); toast('Правило удалено');
}
let walAutoRuleEdit = null;
function walOpenAutoRule(){
  walAutoRuleEdit = {id:'ar_'+Math.random().toString(36).slice(2,7), below:1000, sum:5000, method:'card', on:true};
  walRenderAutoRule();
  openSheet('walAutoRule');
}
function walRenderAutoRule(){
  const r = walAutoRuleEdit; if(!r) return;
  document.getElementById('walAutoRuleView').innerHTML = `
    <h3>Новое правило автопополнения</h3>
    <p class="dim" style="font-size:12.5px;margin:-4px 0 12px">Кошелёк сам пополнится, когда баланс упадёт ниже порога</p>
    <div class="wal-autor-form">
      <div>
        <span class="wal-autor-lbl">Пополнить, если баланс меньше, ₽</span>
        <input class="wal-autor-inp" type="number" min="0" value="${r.below}"
          oninput="walAutoRuleEdit.below=Math.max(0,Number(this.value)||0)">
      </div>
      <div>
        <span class="wal-autor-lbl">Сумма пополнения, ₽</span>
        <input class="wal-autor-inp" type="number" min="1" value="${r.sum}"
          oninput="walAutoRuleEdit.sum=Math.max(0,Number(this.value)||0)">
      </div>
      <div>
        <span class="wal-autor-lbl">Источник пополнения</span>
        <div class="wal-methods">${WAL_METHODS.map(([k,l,ic])=>`
          <button class="wal-m ${r.method===k?'on':''}" onclick="walAutoRuleEdit.method='${k}';walRenderAutoRule()">${I(ic)}<span>${l}</span></button>`).join('')}</div>
      </div>
    </div>
    <button class="btn" onclick="walSaveAutoRule()"><svg class="i"><use href="#i-check"/></svg> Сохранить правило</button>
    <p class="dim" style="font-size:11px;text-align:center;margin-top:9px">Списание с карты только при срабатывании правила. Отключить в любой момент.</p>`;
}
function walSaveAutoRule(){
  const r = walAutoRuleEdit; if(!r) return;
  if(r.sum <= 0){ toast('Укажи сумму пополнения'); return; }
  WAL_X.autoRules = (WAL_X.autoRules || []).concat([r]); walXSave();
  closeSheet(); walRenderAutoRules();
  toast('Правило добавлено: если < ' + fmtMoney(r.below) + ' → пополнить на ' + fmtMoney(r.sum));
}
/* мок реального крона: при загрузке — если баланс ниже порога любого активного
   правила и с последнего срабатывания прошло > 30 мин — сработает.
   На самой первой загрузке молча выставляем baseline, чтобы не удивлять пользователя. */
(function walAutoRuleTick(){
  if(!WAL_X.autoRuleLast){ WAL_X.autoRuleLast = Date.now(); walXSave(); return; }
  const rules = (WAL_X.autoRules || []).filter(r=>r.on && WALLET.balance < r.below);
  if(!rules.length) return;
  if(Date.now() - WAL_X.autoRuleLast < 30 * 60 * 1000) return;
  const r = rules[0];
  walletAdd(r.sum, 'Автопополнение · правило (' + WAL_M_LABEL[r.method] + ')');
  WAL_X.autoRuleLast = Date.now(); walXSave();
  setTimeout(()=>toast('Автопополнение: +' + fmtMoney(r.sum) + ' — баланс был ниже ' + fmtMoney(r.below)), 500);
})();

/* ---------- FACE-ID / ОТПЕЧАТОК (эмуляция) ---------- */
function walToggleBio(){
  if(WAL_X.bio){
    WAL_X.bio = false; walXSave(); walRenderSec();
    toast('Вход по отпечатку выключен');
  } else {
    walOpenBio('setup');
  }
}
function walOpenBio(mode, onOk){
  document.getElementById('walBioView').innerHTML = `
    <div class="wal-bio" id="walBioBox">
      <div class="wal-bio-ic" onclick="walBioScan()">${I('fingerprint')}</div>
      <div class="wal-bio-h">${mode==='setup'?'Приложи палец':'Разблокируй кошелёк'}</div>
      <div class="wal-bio-s">${mode==='setup'?'Приложи палец к датчику, чтобы приложение запомнило отпечаток. В прод-версии — реальный Touch/Face-ID.':'Быстрый вход без ПИН-кода — приложи палец или посмотри в камеру'}</div>
    </div>
    <div style="height:14px"></div>
    <button class="btn ghost" onclick="closeSheet()">Отмена</button>`;
  window._walBioOnOk = onOk || (()=>{
    WAL_X.bio = true; walXSave(); walRenderSec();
    toast('Вход по отпечатку включён');
  });
  window._walBioMode = mode;
  openSheet('walBio');
}
function walBioScan(){
  const box = document.getElementById('walBioBox'); if(!box) return;
  /* «сканирование» — 1.4с прогресса */
  setTimeout(()=>{
    /* 90% успех */
    const ok = Math.random() > 0.1;
    box.classList.add(ok ? 'ok' : 'err');
    box.querySelector('.wal-bio-h').textContent = ok ? 'Готово' : 'Не распознан';
    box.querySelector('.wal-bio-s').textContent = ok ? 'Отпечаток принят.' : 'Попробуй ещё раз — приложи палец плотно.';
    if(ok){
      setTimeout(()=>{ closeSheet(); if(window._walBioOnOk) window._walBioOnOk(); }, 550);
    } else {
      setTimeout(()=>{ box.classList.remove('err'); box.querySelector('.wal-bio-h').textContent = 'Приложи палец'; box.querySelector('.wal-bio-s').textContent = 'Ещё раз — держи палец плотно.'; }, 900);
    }
  }, 1400);
}

/* ---------- LIVE-УВЕДОМЛЕНИЕ О ЗАЧИСЛЕНИИ (sticky slide-in) ---------- */
function walLiveNotify(opts){
  const cur = document.getElementById('walLive');
  if(cur) cur.remove();
  const el = document.createElement('div');
  el.id = 'walLive'; el.className = 'wal-live';
  el.innerHTML = `
    <span class="wal-live-av">${opts.avatar || (opts.who||'?').charAt(0).toUpperCase()}</span>
    <div class="wal-live-b">
      <b>${esc(opts.title || 'Поступление')}</b>
      <span>${esc(opts.sub || '')}</span>
    </div>
    <span class="wal-live-sum">${opts.sum || ''}</span>
    <button class="wal-live-x" onclick="event.stopPropagation();walLiveClose()" aria-label="Скрыть">${I('back')}</button>`;
  el.onclick = ()=>{ walLiveClose(); if(opts.onclick) opts.onclick(); };
  document.body.appendChild(el);
  setTimeout(walLiveClose, opts.ttl || 5000);
}
function walLiveClose(){
  const el = document.getElementById('walLive'); if(!el) return;
  el.classList.add('out');
  setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 350);
}
/* демо-нотификация при заходе в кошелёк — раз за сессию, зачисляет 500₽ */
let _walDemoLiveShown = false;
function walMaybeDemoLive(){
  if(!walIsOwner()) return;                              // гостям — никаких «пришло 500₽» (правка 29.07)
  if(_walDemoLiveShown) return;
  _walDemoLiveShown = true;
  setTimeout(()=>{
    walletAdd(500, 'Перевод в чате · Марк Волков');
    walLiveNotify({
      who:'Марк Волков',
      title:'Пришло 500 ₽ от Марка',
      sub:'@markvolkov · за монтаж рилса',
      sum:'+ 500 ₽',
      onclick:()=>{ if(typeof showTab==='function') showTab('wallet'); }
    });
    walFlash('in');
  }, 1600);
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

/* =========================================================================
   W2: НАВИГАЦИЯ ПО ПОДСТРАНИЦАМ КОШЕЛЬКА (Сбер/iOS pushed screens)
   Каждая .w2-page — fullscreen. Открытие через w2Open(id), закрытие w2Close(id).
   Синхронизировано с nvPush/nvPop, чтобы работал системный «назад».
   ========================================================================= */
function w2Open(id){
  const p = document.getElementById('w2p-' + id);
  if(!p) return;
  p.classList.add('open');
  /* оживление подстраниц, где рендер зависит от размеров */
  if(id === 'accounts')  walRenderAccounts();
  if(id === 'goals')     walRenderGoals();
  if(id === 'autopay')   { walRenderAutopay(); walRenderAutoRules(); walRenderPlanned(); }
  if(id === 'analytics') { walRenderStats(); walRenderTopInc(); walRenderPie(); walRenderCats(); requestAnimationFrame(()=>{ walDrawChart(true); walUpdateAvg(); }); }
  if(id === 'security')  { walRenderSafety(); walRenderSec(); }
  if(id === 'history')   walRenderLedger();
  if(id === 'transfers') w2RenderRecent();
  if(id === 'exchange')  w2RenderExchange();
  if(id === 'receive')   w2RenderReceive();
  try{ if(typeof nvPush === 'function') nvPush('w2-' + id, ()=>{ p.classList.remove('open'); }); }catch(e){}
}
function w2Close(id){
  const p = document.getElementById('w2p-' + id);
  if(!p) return;
  p.classList.remove('open');
  try{ if(typeof nvPop === 'function') nvPop('w2-' + id); }catch(e){}
}

/* --- «Оплатить» — маленький popup выбора куда платить --- */
function w2OpenPay(){
  if(typeof showPopup !== 'function'){
    /* fallback: пусть просто откроется история */
    return w2Open('history');
  }
  showPopup({
    ico:'card', title:'Что оплатить?',
    body:'Выбери, куда пойдёт списание с лицевого счёта. Для новых услуг — раздел «Партнёрка» и «Мини-аппы».',
    actions:[
      {label:'Тариф · подписка PRO', onclick:()=>{ if(typeof openPay === 'function') openPay('PRO'); else w2Open('autopay'); }},
      {label:'Автопополнение и шаблоны', onclick:()=>w2Open('autopay')},
      {label:'Перевод по нику или на карту', onclick:()=>w2Open('transfers')},
      {label:'Закрыть', ghost:true},
    ]
  });
}

/* --- «крипто-перевод» из подстраницы «Переводы» --- */
function w2TransferCrypto(){
  if(!WAL_X.ton){
    if(typeof showPopup === 'function'){
      showPopup({
        ico:'ton', title:'Нужен внешний TON-кошелёк',
        body:'Реальная крипта (Toncoin, USDT-TON, USDT-TRC20) отправляется и принимается только через <b>Tonkeeper</b>, <b>TON Wallet</b> или <b>MyTonWallet</b>. Внутри OKO — только отображение баланса и заявки.<br><br>Подключи кошелёк через TON Connect — займёт 10 секунд.',
        actions:[
          {label:'Подключить TON-кошелёк', onclick:()=>{ walTonConnect(); }},
          {label:'Понятно', ghost:true},
        ]
      });
    }
    return;
  }
  /* если подключён — открываем sheet вывода на TON */
  w2Close('transfers');
  walOpenWithdraw();
  setTimeout(()=>{ walWdState.method = 'ton'; walRenderWithdraw(); }, 40);
}

/* --- «Недавние получатели» на странице переводов --- */
function w2RenderRecent(){
  const box = document.getElementById('w2Recent');
  if(!box) return;
  /* берём из истории уникальных получателей переводов */
  const seen = new Set(), rows = [];
  WALLET.ledger.forEach(o => {
    if(o.t !== '-' || !/Перевод в чате/i.test(o.why)) return;
    const m = o.why.match(/@([A-Za-z0-9_]+)/);
    const nick = m ? m[1] : (o.why.split('·')[1] || '').trim();
    if(!nick || seen.has(nick)) return;
    seen.add(nick);
    rows.push({nick, name: nick, at: o.at});
  });
  if(!rows.length){
    box.innerHTML = '<p class="w2-recent-empty">Пока никого — как только сделаешь первый перевод, ник появится здесь.</p>';
    return;
  }
  box.innerHTML = rows.slice(0, 8).map(r => `
    <button class="wal-send-qi" onclick="w2Close('transfers');walOpenSend('${esc(r.nick)}')">
      <span class="wal-send-av">${(r.name||'?').charAt(0).toUpperCase()}</span>
      <span>${esc(r.name.length > 10 ? r.name.slice(0,10) + '…' : r.name)}</span>
    </button>`).join('');
}

/* --- XP инфо-попап --- */
function w2XpInfo(){
  if(typeof showPopup !== 'function') return;
  const xp = (WAL_X.balances && WAL_X.balances.XP) || 0;
  showPopup({
    ico:'xp', title:'Про очки OKO (XP)',
    body:'<b>' + Math.round(xp).toLocaleString('ru-RU').replace(/,/g,' ') + ' XP</b> — это внутренние очки приложения, а не валюта.<br><br>' +
         '· Начисляются за активность (уроки Академии, посты, задания)<br>' +
         '· Тратятся в Играх (спины, ставки) и на бонусы Академии<br>' +
         '· Нельзя вывести и обменять на рубли<br>' +
         '· Не связаны с криптой или банковским счётом',
    actions:[{label:'Понятно'}]
  });
}

/* =========================================================================
   W2: НОВЫЙ ОБМЕН ВАЛЮТ (fullscreen, большие поля ввода)
   Правка Даниэля: «пишет введите сумму а куда вводить при обмене?»
   Ответ: явное большое поле, focus, hint, счётчик, кнопка MAX, честный курс.
   ========================================================================= */
function w2RenderExchange(){
  const s = walExState;
  const codes = ['RUB','USDT_TON','USDT_TRC','TON'];         // XP не участвует в обмене — не валюта
  if(!codes.includes(s.from)) s.from = 'RUB';
  if(!codes.includes(s.to))   s.to = s.from === 'RUB' ? 'USDT_TON' : 'RUB';
  const fromM = WAL_CUR_META[s.from], toM = WAL_CUR_META[s.to];
  const outVal = walExFinal();
  const rate = walExRate(s.from, s.to);
  const box = document.getElementById('w2ExView');
  if(!box) return;
  box.innerHTML = `
    <div class="w2-ex">
      <p class="w2-ex-hint">Введи сумму в поле «Отдаёте» — во второй строке автоматически посчитается, сколько придёт.</p>

      <div class="w2-ex-cell on">
        <div class="w2-ex-cell-h">
          ${walCurLogoHtml(s.from)}
          <div class="w2-ex-cell-name">
            <div class="w2-ex-cell-lbl">Отдаёте</div>
            <b>${fromM.name}</b>
          </div>
        </div>
        <div class="w2-ex-cell-inp">
          <input id="w2ExAmt" type="number" inputmode="decimal" min="0" step="any"
                 placeholder="0"
                 value="${s.amount || ''}"
                 oninput="walExState.amount=Math.max(0,Number(this.value)||0);w2SyncExchange()">
          <span class="w2-ex-cell-sym">${fromM.sym}</span>
        </div>
        <div class="w2-ex-cell-bot">
          <span>Доступно: <b>${walCurFmt(s.from, walCurBal(s.from))}</b></span>
          <button class="max" onclick="walExState.amount=walCurBal('${s.from}');w2RenderExchange();document.getElementById('w2ExAmt').focus()">Всё</button>
        </div>
      </div>

      <button class="w2-ex-swap-btn" onclick="w2ExSwap()" aria-label="Поменять местами">${I('swap')}</button>

      <div class="w2-ex-cell">
        <div class="w2-ex-cell-h">
          ${walCurLogoHtml(s.to)}
          <div class="w2-ex-cell-name">
            <div class="w2-ex-cell-lbl">Получаете</div>
            <b>${toM.name}</b>
          </div>
        </div>
        <div class="w2-ex-cell-inp">
          <span class="w2-ex-cell-val" id="w2ExOut">${outVal ? walCurFmt(s.to, outVal).replace(' '+toM.sym,'') : '0'}</span>
          <span class="w2-ex-cell-sym">${toM.sym}</span>
        </div>
        <div class="w2-ex-cell-bot">
          <span>Курс: <b>1 ${fromM.sym} = ${rate.toFixed(6).replace(/\.?0+$/,'')} ${toM.sym}</b></span>
        </div>
      </div>

      <p class="w2-ex-pair-h">Быстрая смена пары «В»</p>
      <div class="w2-ex-pair">${codes.filter(c => c !== s.from).map(c => `
        <button class="${s.to === c ? 'on' : ''}" onclick="walExState.to='${c}';w2RenderExchange()">
          ${walCurLogoHtml(c)}<span>${WAL_CUR_META[c].sym}</span>
        </button>`).join('')}</div>

      <div class="w2-ex-info" id="w2ExInfo"></div>

      <button class="btn" onclick="w2DoExchange()">
        <svg class="i"><use href="#i-swap"/></svg>
        <span id="w2ExBtn">${s.amount > 0 ? 'Обменять ' + walCurFmt(s.from, s.amount) : 'Обменять'}</span>
      </button>
      <p class="dim" style="font-size:11px;text-align:center;margin-top:9px">Курс OKO Team, обновляется несколько раз в сутки. Комиссия обмена 1%. Реальные торги — на биржах.</p>
    </div>`;
  w2SyncExchange();
  /* автофокус на поле ввода — чтобы было очевидно, куда вбивать */
  setTimeout(()=>{
    const inp = document.getElementById('w2ExAmt');
    if(inp && !s.amount){ try{ inp.focus(); }catch(e){} }
  }, 220);
}
function w2SyncExchange(){
  const s = walExState;
  const out = walExFinal();
  const toM = WAL_CUR_META[s.to], fromM = WAL_CUR_META[s.from];
  const outEl = document.getElementById('w2ExOut');
  if(outEl) outEl.textContent = out ? walCurFmt(s.to, out).replace(' '+toM.sym,'') : '0';
  const info = document.getElementById('w2ExInfo');
  if(info){
    if(s.amount > 0){
      const fee = walExFee();
      info.innerHTML = 'Отдаёте <b>' + walCurFmt(s.from, s.amount) + '</b>, получите <em>' + walCurFmt(s.to, out) +
        '</em>.<br>Курс OKO Team, комиссия 1% уже учтена (' + walCurFmt(s.to, fee) + ').';
    } else {
      info.textContent = 'Введи сумму в верхнем поле — покажу, сколько придёт, и с каким курсом.';
    }
  }
  const btn = document.getElementById('w2ExBtn');
  if(btn) btn.textContent = s.amount > 0 ? 'Обменять ' + walCurFmt(s.from, s.amount) : 'Обменять';
}
function w2ExSwap(){
  const t = walExState.from; walExState.from = walExState.to; walExState.to = t;
  walExState.amount = 0;
  w2RenderExchange();
}
function w2DoExchange(){
  const s = walExState;
  if(!s.amount || s.amount <= 0){ toast('Введи сумму в поле «Отдаёте»'); const i = document.getElementById('w2ExAmt'); if(i) i.focus(); return; }
  if(s.amount > walCurBal(s.from)){ toast('Недостаточно: доступно ' + walCurFmt(s.from, walCurBal(s.from))); return; }
  const out = walExFinal();
  const from = WAL_CUR_META[s.from], to = WAL_CUR_META[s.to];
  const box = document.getElementById('w2ExView');
  box.innerHTML = `<div style="text-align:center;padding:44px 0"><div class="spin"></div><p style="font-weight:700;margin-top:14px">Меняем валюту…</p></div>`;
  setTimeout(()=>{
    /* списываем «от» */
    if(s.from === 'RUB'){
      walletCharge(s.amount, 'Обмен ' + from.sym + ' → ' + to.sym);
    } else {
      walCurSet(s.from, walCurBal(s.from) - s.amount);
    }
    /* начисляем «в» */
    if(s.to === 'RUB'){
      walletAdd(Math.round(out), 'Обмен ' + from.sym + ' → ₽');
    } else {
      walCurSet(s.to, walCurBal(s.to) + out);
    }
    box.innerHTML = `<div class="wal-ok-wrap">
      <div class="wal-ok">${I('check')}</div>
      <p style="font-weight:800;font-size:22px;margin-top:16px">${walCurFmt(s.to, out)}</p>
      <p class="dim" style="font-size:13px;margin-top:8px">Обмен выполнен: ${walCurFmt(s.from, s.amount)} → ${walCurFmt(s.to, out)}<br>Баланс ${to.sym}: <b>${walCurFmt(s.to, walCurBal(s.to))}</b></p>
      <div style="height:20px"></div>
      <button class="btn" onclick="w2Close('exchange')">Готово</button>
      <div style="height:8px"></div>
      <button class="btn ghost" onclick="walExState.amount=0;w2RenderExchange()">Ещё обмен</button>
    </div>`;
    renderWallet();
    walFlash(s.to === 'RUB' ? 'in' : 'out');
    toast('Обмен: ' + walCurFmt(s.from, s.amount) + ' → ' + walCurFmt(s.to, out));
  }, 700);
}

/* --- «QR-приём»: реюзаем существующий walRenderReceive/walDrawRecvQR в подстранице --- */
function w2RenderReceive(){
  const host = document.getElementById('w2RecvHost');
  if(!host) return;
  walRecvState = walRecvState || {sum:0, note:'', code:'RUB'};
  /* временно подменяем контейнер, чтобы render-хелпер записал HTML в него */
  const view = document.createElement('div'); view.id = 'walRecvView';
  host.innerHTML = ''; host.appendChild(view);
  walRenderReceive();
  setTimeout(walDrawRecvQR, 60);
}

/* =========================================================================
   w2- REAL P2P: реальные внутренние переводы через backend api.php.
   - WALLET.owner_email = PROFILE.email (ключ везде)
   - GET wallet_balance при открытии экрана
   - POST wallet_transfer с 1% комиссией OKO
   - GET wallet_history — реальная выписка
   - POST wallet_topup — Lava.top ссылка
   - IndexedDB очередь оффлайн, автоотправка при онлайне
   - PIN обязателен для сумм > 10 000 ₽ (реальная проверка перед fetch)
   - Rate limit 5 tx/min на бэке; на клиенте — понятное сообщение
   - Событие window «oko:wallet:receive» для notifs-plus
   ========================================================================= */
(function w2WalletRealInit(){
  const API   = (typeof OKO_API !== 'undefined' && OKO_API) ? OKO_API : 'https://okoteam.top/api.php';
  const FEE   = 0.01;
  const PIN_T = 10000; // порог PIN
  const w2SecureTxt = 'Через OKO Bank · комиссия 1%';

  function w2OwnerEmail(){
    try{
      if(typeof PROFILE === 'undefined') return '';
      return String(PROFILE.email || '').trim().toLowerCase();
    }catch(e){ return ''; }
  }
  window.w2WalletOwnerEmail = w2OwnerEmail;

  /* ---------- IndexedDB очередь оффлайн-переводов ---------- */
  const IDB_NAME = 'oko-wallet-queue-v1', IDB_STORE = 'txq';
  function w2Idb(){
    return new Promise((res)=>{
      try{
        const rq = indexedDB.open(IDB_NAME, 1);
        rq.onupgradeneeded = e => {
          const db = e.target.result;
          if(!db.objectStoreNames.contains(IDB_STORE))
            db.createObjectStore(IDB_STORE, {keyPath:'id', autoIncrement:true});
        };
        rq.onsuccess = e => res(e.target.result);
        rq.onerror   = ()=> res(null);
      }catch(e){ res(null); }
    });
  }
  async function w2QueuePush(tx){
    const db = await w2Idb(); if(!db) return false;
    return new Promise(res => {
      try{
        const t = db.transaction(IDB_STORE, 'readwrite');
        t.objectStore(IDB_STORE).add(Object.assign({at: Date.now()}, tx));
        t.oncomplete = ()=>res(true); t.onerror = ()=>res(false);
      }catch(e){ res(false); }
    });
  }
  async function w2QueueAll(){
    const db = await w2Idb(); if(!db) return [];
    return new Promise(res => {
      try{
        const t = db.transaction(IDB_STORE, 'readonly');
        const rq = t.objectStore(IDB_STORE).getAll();
        rq.onsuccess = ()=>res(rq.result || []); rq.onerror = ()=>res([]);
      }catch(e){ res([]); }
    });
  }
  async function w2QueueDel(id){
    const db = await w2Idb(); if(!db) return;
    return new Promise(res => {
      try{
        const t = db.transaction(IDB_STORE, 'readwrite');
        t.objectStore(IDB_STORE).delete(id);
        t.oncomplete = res; t.onerror = res;
      }catch(e){ res(); }
    });
  }

  /* ---------- API-обёртки ---------- */
  async function w2Fetch(url, opts){
    const ctrl = new AbortController();
    const to = setTimeout(()=>ctrl.abort(), 15000);
    try{
      const r = await fetch(url, Object.assign({signal:ctrl.signal}, opts||{}));
      clearTimeout(to);
      let j;
      try{ j = await r.json(); }catch(e){ j = {ok:false, error:'bad response'}; }
      if(r.status === 429) { const err = new Error(j.error||'Слишком часто'); err.code=429; throw err; }
      if(!j || !j.ok) throw new Error((j && j.error) || ('HTTP '+r.status));
      return j;
    } catch(e){ clearTimeout(to); throw e; }
  }
  async function w2ApiBalance(email){
    return w2Fetch(API+'?action=wallet_balance&email='+encodeURIComponent(email));
  }
  async function w2ApiTransfer(from, to, amount, comment){
    return w2Fetch(API+'?action=wallet_transfer', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({from_email: from, to_nick_or_email: to, amount, comment: comment||''})
    });
  }
  async function w2ApiHistory(email, limit){
    return w2Fetch(API+'?action=wallet_history&email='+encodeURIComponent(email)+'&limit='+(limit||50));
  }
  async function w2ApiTopup(email, amount, method){
    return w2Fetch(API+'?action=wallet_topup', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email, amount, method})
    });
  }
  window.w2Api = {balance:w2ApiBalance, transfer:w2ApiTransfer, history:w2ApiHistory, topup:w2ApiTopup};

  /* ---------- Слияние истории бэка в локальный леджер (без дублей по tx_id+dir) ---------- */
  function w2MergeHistory(items){
    if(!Array.isArray(items) || !items.length) return;
    const seen = new Set();
    (WALLET.ledger||[]).forEach(o => { if(o.tx_id) seen.add(o.tx_id + ':' + (o.dir || o.direction || o.t)); });
    const add = [];
    items.forEach(it => {
      const key = it.tx_id + ':' + it.direction;
      if(seen.has(key)) return;
      seen.add(key);
      const at = Date.parse((it.created_at||'').replace(' ','T')) || Date.now();
      const amt = Number(it.amount) || 0;
      if(it.direction === 'receive'){
        add.push({t:'+', sum: amt, why: 'Перевод от '+it.from_email + (it.comment?' («'+it.comment+'»)':''), at, tx_id: it.tx_id, dir:'receive'});
      } else if(it.direction === 'send'){
        add.push({t:'-', sum: amt, why: 'Перевод @'+it.to_email + (it.comment?' («'+it.comment+'»)':''), at, tx_id: it.tx_id, dir:'send'});
      } else if(it.direction === 'fee'){
        add.push({t:'-', sum: amt, why: 'Комиссия OKO 1%', at, tx_id: it.tx_id, dir:'fee'});
      } else if(it.direction === 'topup'){
        add.push({t:'+', sum: amt, why: 'Пополнение · '+(it.comment||'Lava.top'), at, tx_id: it.tx_id, dir:'topup'});
      }
    });
    if(add.length){
      WALLET.ledger = add.concat(WALLET.ledger||[]);
      WALLET.ledger.sort((a,b)=>b.at-a.at);
      walletSave();
    }
  }

  /* ---------- Синхронизация локального WALLET с бэком (skeleton-friendly) ---------- */
  let w2SyncBusy = false, w2LastSyncAt = 0, w2LastBal = null;
  async function w2Sync(force){
    const email = w2OwnerEmail();
    if(!email) return;
    if(w2SyncBusy) return;
    if(!force && Date.now() - w2LastSyncAt < 4000) return;
    w2SyncBusy = true;
    try{
      const j = await w2ApiBalance(email);
      const prev = WALLET.balance;
      WALLET.balance    = j.balance;
      WALLET.hold       = j.hold || 0;
      WALLET.owner_email = email;
      walletSave();
      // событие получения средств (для notifs-plus и live-нотифа)
      if(w2LastBal !== null && j.balance > w2LastBal){
        const diff = j.balance - w2LastBal;
        try{ window.dispatchEvent(new CustomEvent('oko:wallet:receive', {detail:{amount:diff, balance:j.balance, email}})); }catch(e){}
        try{ walLiveNotify({who:'OKO Bank', title:'Пришло '+fmtMoney(diff), sub:'На лицевой счёт', sum:'+ '+fmtMoney(diff)}); }catch(e){}
        try{ walFlash('in'); }catch(e){}
        if(typeof NOTIFS !== 'undefined' && Array.isArray(NOTIFS)){
          NOTIFS.unshift({ic:'money', who:'OKO Bank', t:'Пришло '+fmtMoney(diff)+' на счёт', time:'только что', g:'Сегодня', unread:true, act:()=>{ if(typeof showTab==='function') showTab('wallet'); }});
          if(typeof updateNotifDot === 'function') updateNotifDot();
        }
      }
      w2LastBal = j.balance;
      try{
        const h = await w2ApiHistory(email, 50);
        if(h) w2MergeHistory(h.items);
      }catch(e){}
      try{ walletNotifyRender(); walUpdateChips(); }catch(e){}
      w2LastSyncAt = Date.now();
    } catch(e){
      /* offline / api down — тихо, следующий тик попробует */
    } finally { w2SyncBusy = false; }
  }
  window.w2WalletSync = w2Sync;

  /* ---------- Skeleton (заглушка на время fetch) ---------- */
  function w2ShowSkeleton(){
    const bal = document.getElementById('walBalance');
    if(bal && !bal.dataset.w2sk){
      bal.dataset.w2sk = '1';
      bal.style.opacity = '0.65';
      setTimeout(()=>{ bal.style.opacity = ''; delete bal.dataset.w2sk; }, 900);
    }
  }

  /* ---------- Перехват renderWallet: фоновый sync ---------- */
  const _prevRenderWallet = window.renderWallet || renderWallet;
  window.renderWallet = function(){
    _prevRenderWallet();
    if(w2OwnerEmail()){ w2ShowSkeleton(); w2Sync(); }
  };
  try{ renderWallet = window.renderWallet; }catch(e){}

  /* ---------- Перехват walDoSend: реальный POST /wallet_transfer ---------- */
  const _prevWalDoSend = window.walDoSend;
  window.walDoSend = function(){
    const s = walSendState;
    if(!s.to){ toast('Укажи ник получателя'); return; }
    if(!s.sum || s.sum <= 0){ toast('Укажи сумму перевода'); return; }
    // считаем комиссию 1% — сумма+комиссия ≤ баланс
    const fee   = Math.floor(s.sum * FEE);
    const total = s.sum + fee;
    if(total > WALLET.balance){
      toast('Не хватает: нужно '+fmtMoney(total)+' (сумма+комиссия 1%)');
      return;
    }
    // PIN обязателен на суммы > PIN_T
    if(s.sum > PIN_T){
      if(!WAL_X.pin){
        showPopup({ico:'lock', title:'Нужен ПИН-код',
          body:'Для перевода на сумму больше <b>'+fmtMoney(PIN_T)+'</b> нужно установить ПИН-код в разделе «Безопасность».',
          actions:[
            {label:'Настроить ПИН', onclick:()=>{ closeSheet(); w2Open('security'); setTimeout(walTogglePin, 350); }},
            {label:'Отмена', ghost:true},
          ]});
        return;
      }
      walPinOpen('confirm', 'walSendView', ()=>{ openSheet('walSend'); w2DoRealSend(); });
      return;
    }
    w2DoRealSend();
  };

  async function w2DoRealSend(){
    const s = walSendState;
    const email = w2OwnerEmail();
    const v = document.getElementById('walSendView');
    if(v) v.innerHTML = '<div style="text-align:center;padding:22px 0"><div class="spin"></div><p style="font-weight:700;margin-top:14px">Отправляем…</p><p class="dim" style="font-size:12px;margin-top:5px">'+w2SecureTxt+'</p></div>';
    // офлайн или гость без email → очередь
    if(!email){
      if(v) v.innerHTML = '<div class="wal-ok-wrap"><div class="wal-ok" style="background:rgba(255,184,74,0.2);color:#FFB84A">'+I('lock')+'</div>'
        +'<p style="font-weight:800;font-size:19px;margin-top:14px">Нужен email</p>'
        +'<p class="dim" style="font-size:13px;margin-top:6px">Заверши регистрацию (добавь email), чтобы отправлять реальные P2P-переводы.</p>'
        +'<div style="height:16px"></div>'
        +'<button class="btn" onclick="closeSheet()">Хорошо</button></div>';
      return;
    }
    if(!navigator.onLine){
      await w2QueuePush({from:email, to:s.to, amount:s.sum, comment:s.note});
      if(v) v.innerHTML = '<div class="wal-ok-wrap"><div class="wal-ok" style="background:rgba(255,184,74,0.2);color:#FFB84A">'+I('clock')+'</div>'
        +'<p style="font-weight:800;font-size:19px;margin-top:14px">В очереди</p>'
        +'<p class="dim" style="font-size:13px;margin-top:6px">Нет сети — отправим, как только появится соединение.</p>'
        +'<div style="height:16px"></div>'
        +'<button class="btn" onclick="closeSheet()">Хорошо</button></div>';
      toast('Перевод в очереди — отправим при онлайне');
      return;
    }
    try{
      const r = await w2ApiTransfer(email, s.to, s.sum, s.note);
      const why = 'Перевод @'+s.to + (s.note?' («'+s.note+'»)':'');
      WALLET.balance = r.balance;
      // локальная запись — с tx_id, чтобы не задублить при следующем sync
      WALLET.ledger.unshift({t:'-', sum: r.amount, why, at: Date.now(), tx_id: r.tx_id, dir:'send'});
      if(r.fee > 0){
        WALLET.ledger.unshift({t:'-', sum: r.fee, why:'Комиссия OKO 1% · '+r.tx_id, at: Date.now(), tx_id: r.tx_id, dir:'fee'});
      }
      walletSave();
      if(v) v.innerHTML = '<div class="wal-ok-wrap"><div class="wal-ok">'+I('check')+'</div>'
        +'<p style="font-weight:800;font-size:19px;margin-top:14px">− '+fmtMoney(r.amount + (r.fee||0))+'</p>'
        +'<p class="dim" style="font-size:13px;margin-top:6px">Перевод @'+esc(s.to)+' доставлен.<br>Комиссия OKO: <b>'+fmtMoney(r.fee||0)+'</b><br>Осталось: <b>'+fmtMoney(WALLET.balance)+'</b></p>'
        +'<div style="font-size:11px;color:var(--dim);margin-top:8px">TX '+esc(r.tx_id)+'</div>'
        +'<div style="height:16px"></div>'
        +'<button class="btn" onclick="closeSheet()">Готово</button></div>';
      renderWallet(); walFlash('out');
      toast('Отправлено @'+s.to+': '+fmtMoney(r.amount));
    } catch(e){
      const msg = String((e && e.message) || e);
      if(/recipient not found/i.test(msg))       toast('Получатель не найден в OKO');
      else if(/insufficient/i.test(msg))         toast('Недостаточно средств на счёте');
      else if(/cannot transfer to yourself/i.test(msg)) toast('Нельзя перевести самому себе');
      else if(e && e.code === 429)               toast('Лимит: не более 5 переводов в минуту');
      else if(!navigator.onLine){
        await w2QueuePush({from:email, to:s.to, amount:s.sum, comment:s.note});
        toast('Сеть пропала — перевод в очереди');
      } else                                     toast('Ошибка перевода: '+msg);
      walRenderSend();
    }
  }

  /* ---------- Показ комиссии под кнопкой «Отправить» (пере-рендер-safe) ---------- */
  const _prevWalSyncSendBtn = window.walSyncSendBtn;
  window.walSyncSendBtn = function(){
    if(_prevWalSyncSendBtn) _prevWalSyncSendBtn();
    const s = walSendState;
    const view = document.getElementById('walSendView'); if(!view) return;
    let box = document.getElementById('w2SendFee');
    if(!box){
      const btn = document.getElementById('walSendBtn');
      const btnWrap = btn ? btn.closest('button') : null;
      const anchor = btnWrap || (view.querySelector('.btn'));
      if(anchor && anchor.parentElement){
        box = document.createElement('div');
        box.id = 'w2SendFee';
        box.style.cssText = 'font-size:12px;color:var(--dim);text-align:center;margin-top:6px;line-height:1.55;padding:0 6px';
        anchor.parentElement.insertBefore(box, anchor.nextSibling);
      }
    }
    if(box){
      if(s.sum > 0){
        const fee   = Math.floor(s.sum * FEE);
        const total = s.sum + fee;
        box.innerHTML =
          'К зачислению получателю: <b style="color:var(--accent)">'+fmtMoney(s.sum)+'</b><br>'+
          'Комиссия OKO 1%: <b>'+fmtMoney(fee)+'</b><br>'+
          'Всего спишется: <b>'+fmtMoney(total)+'</b>' +
          (s.sum > PIN_T ? '<br><span style="color:#FFB84A">При отправке потребуется ПИН-код</span>' : '');
      } else box.innerHTML = '';
    }
  };

  /* ---------- Guest warning: если открыл «Отправить» без email — предупредим ---------- */
  const _prevWalOpenSend = window.walOpenSend;
  window.walOpenSend = function(prefill){
    _prevWalOpenSend(prefill);
    if(!w2OwnerEmail()){
      setTimeout(()=>{
        const v = document.getElementById('walSendView');
        if(!v || document.getElementById('w2SendGuestWarn')) return;
        const warn = document.createElement('div');
        warn.id = 'w2SendGuestWarn';
        warn.style.cssText = 'background:rgba(255,184,74,0.12);border:1px solid rgba(255,184,74,0.35);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:12.5px;color:#FFB84A';
        warn.innerHTML = 'Реальные P2P-переводы работают после добавления email в профиль. Гостям — только UI-демо.';
        v.insertBefore(warn, v.firstChild);
      }, 40);
    }
  };

  /* ---------- Оффлайн очередь: авто-flush при онлайне ---------- */
  async function w2FlushQueue(){
    const email = w2OwnerEmail(); if(!email || !navigator.onLine) return;
    const q = await w2QueueAll();
    for(const tx of q){
      try{
        const r = await w2ApiTransfer(email, tx.to, tx.amount, tx.comment||'');
        await w2QueueDel(tx.id);
        toast('Отправлено из очереди: '+tx.to+' · '+fmtMoney(tx.amount));
      } catch(e){ break; /* следующий раз повторим */ }
    }
    w2Sync(true);
  }
  window.addEventListener('online', w2FlushQueue);
  setTimeout(w2FlushQueue, 3000);

  /* ---------- Перехват walDoTopup: реальный Lava.top для card/lava ---------- */
  const _prevWalDoTopup = window.walDoTopup;
  window.walDoTopup = async function(){
    const email = w2OwnerEmail();
    const s = walTopupState;
    // если гость или не банковский метод — старая мок-логика (usdt/ton — реквизиты)
    if(!email || (s.method !== 'card' && s.method !== 'lava')){
      return _prevWalDoTopup();
    }
    if(!s.sum || s.sum <= 0){ toast('Укажи сумму пополнения'); return; }
    const v = document.getElementById('walTopupView');
    if(v) v.innerHTML = '<div style="text-align:center;padding:22px 0"><div class="spin"></div><p style="font-weight:700;margin-top:14px">Открываем Lava.top…</p></div>';
    try{
      const r = await w2ApiTopup(email, s.sum, s.method);
      if(r && r.url){
        if(v) v.innerHTML = '<div class="wal-ok-wrap"><div class="wal-ok" style="background:linear-gradient(135deg,#9AFF00,#7ECBEB);color:#000">'+I('bolt')+'</div>'
          +'<p style="font-weight:800;font-size:19px;margin-top:14px">Счёт создан</p>'
          +'<p class="dim" style="font-size:13px;margin-top:6px">Оплата откроется на Lava.top. После оплаты баланс обновится автоматически.</p>'
          +'<div style="height:16px"></div>'
          +'<a class="btn" href="'+r.url+'" target="_blank" rel="noopener" style="text-decoration:none">Открыть Lava.top на '+fmtMoney(r.amount)+'</a>'
          +'<div style="height:8px"></div>'
          +'<button class="btn ghost" onclick="closeSheet()">Позже</button></div>';
        try{ window.open(r.url, '_blank', 'noopener'); }catch(e){}
        return;
      }
    } catch(e){ /* fallback */ }
    return _prevWalDoTopup();
  };

  /* ---------- PIN для вывода > 10 000: если PIN не установлен — требуем настроить ---------- */
  const _prevWalDoWithdraw = window.walDoWithdraw;
  window.walDoWithdraw = function(){
    const s = walWdState;
    if(s.sum > PIN_T && !WAL_X.pin){
      showPopup({ico:'lock', title:'Нужен ПИН-код',
        body:'Для вывода на сумму больше <b>'+fmtMoney(PIN_T)+'</b> нужно установить ПИН-код в разделе «Безопасность».',
        actions:[
          {label:'Настроить ПИН', onclick:()=>{ closeSheet(); w2Open('security'); setTimeout(walTogglePin, 350); }},
          {label:'Отмена', ghost:true},
        ]});
      return;
    }
    return _prevWalDoWithdraw();
  };

  /* ---------- «Повторить перевод» на карточке транзакции ---------- */
  const _prevWalRenderTx = window.walRenderTx;
  window.walRenderTx = function(op){
    _prevWalRenderTx(op);
    // если это исходящий перевод — добавим кнопку «Повторить»
    try{
      const cat = walCat(op.why);
      if(cat !== 'Переводы' || op.t !== '-') return;
      const acts = document.querySelector('#walTxView .wal-tx-acts');
      if(!acts || document.getElementById('w2RepeatBtn')) return;
      // достаём ник из описания
      const m = op.why.match(/@([A-Za-z0-9_.\-]+)/);
      const nick = m ? m[1] : '';
      if(!nick) return;
      const btn = document.createElement('button');
      btn.id = 'w2RepeatBtn'; btn.className = 'prim';
      btn.innerHTML = '<svg class="i"><use href="#i-send"/></svg>Повторить';
      btn.onclick = ()=>{ closeSheet(); setTimeout(()=>{ walOpenSend(nick); walSendState.sum = op.sum; walRenderSend(); }, 120); };
      acts.insertBefore(btn, acts.firstChild);
    }catch(e){}
  };

  /* ---------- Периодический poll: балансно-безопасно, только когда таб виден ---------- */
  setInterval(()=>{ if(!document.hidden && w2OwnerEmail()) w2Sync(); }, 25000);

  /* ---------- Первичный sync при загрузке (даёт email — сразу тянем реальные цифры) ---------- */
  if(w2OwnerEmail()) setTimeout(()=>w2Sync(true), 800);
})();

/* ---------- самоинициализация ---------- */
regTitle('wallet', 'Кошелёк');
walInsertChips();
walUpdateChips();
if(document.getElementById('screen-wallet') && document.getElementById('screen-wallet').classList.contains('active')) renderWallet();
/* При смене таба на другой — закрываем все w2-подстраницы, чтобы не «висели» */
try{
  const _prevShowTabW2 = showTab;
  showTab = function(t){
    if(t !== 'wallet'){
      document.querySelectorAll('.w2-page.open').forEach(p => p.classList.remove('open'));
    }
    _prevShowTabW2(t);
  };
}catch(e){}
