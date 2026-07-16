/* ================= WALLET: экран кошелька / лицевой счёт =================
   Опирается на core-ext: WALLET, walletAdd, walletCharge, fmtMoney, okoEarn.
   Патчит денежные потоки ядра (тарифы, продвижение, биржа, переводы, партнёрка). */

/* ---------- иконка TON (кристалл) в общий defs ---------- */
(function walAddIcons(){
  const defs = document.querySelector('svg defs');
  if(!defs || document.getElementById('i-ton')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
  s.setAttribute('id','i-ton'); s.setAttribute('viewBox','0 0 100 100');
  s.innerHTML = '<path d="M18 20h64L50 88 18 20z" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M50 20v68" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>';
  defs.appendChild(s);
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

/* ---------- состояние модуля ---------- */
let walFilter = 'all';
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

/* ---------- категории расходов ---------- */
function walCat(why){
  if(/продвижен/i.test(why)) return 'Продвижение';
  if(/бирж/i.test(why)) return 'Биржа';
  if(/игр|рулетк|ставк|дорог/i.test(why)) return 'Игры';
  if(/тариф/i.test(why)) return 'Тарифы';
  if(/перевод/i.test(why)) return 'Переводы';
  return 'Прочее';
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
  walRenderCats();
  walRenderLedger();
  walUpdateChips();
}
function walRenderCats(){
  const bar = document.getElementById('walCatBar'), wrap = document.getElementById('walCats');
  if(!bar || !wrap) return;
  const sums = {};
  WALLET.ledger.forEach(op=>{ if(op.t==='-') sums[walCat(op.why)] = (sums[walCat(op.why)]||0) + op.sum; });
  const cats = Object.entries(sums).sort((a,b)=>b[1]-a[1]);
  if(!cats.length){
    bar.style.display = 'none';
    wrap.innerHTML = '<div class="wal-cats-empty">Расходов пока нет — всё в плюсе</div>';
    return;
  }
  bar.style.display = 'flex';
  const total = cats.reduce((s,c)=>s+c[1],0);
  bar.innerHTML = cats.map(([,v],i)=>
    `<i style="width:${(v/total*100).toFixed(1)}%;opacity:${(1 - i*0.16).toFixed(2)};animation-delay:${i*70}ms"></i>`).join('');
  wrap.innerHTML = cats.map(([k,v],i)=>
    `<span class="wal-cat" style="animation-delay:${i*60}ms"><span class="dot" style="opacity:${(1 - i*0.16).toFixed(2)}"></span>${k}<b>${fmtMoney(v)}</b></span>`).join('');
}
function walRenderLedger(){
  const box = document.getElementById('walLedger');
  if(!box) return;
  const list = WALLET.ledger.filter(op => walFilter==='all' || (walFilter==='in' ? op.t==='+' : op.t==='-'));
  if(!list.length){
    box.innerHTML = `<div class="wal-empty">${I('file')}${walFilter==='in' ? 'Пополнений пока нет' : walFilter==='out' ? 'Списаний пока нет' : 'Операций пока нет'}</div>`;
    return;
  }
  const arrIn  = '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M72 28 30 70"/><path d="M30 38v32h32"/></svg>';
  const arrOut = '<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M28 72 70 30"/><path d="M38 30h32v32"/></svg>';
  box.innerHTML = list.slice(0, 60).map((op,i)=>`
    <div class="wal-op" style="animation-delay:${Math.min(i,10)*45}ms">
      <div class="wal-op-ic ${op.t==='+'?'in':'out'}">${op.t==='+'?arrIn:arrOut}</div>
      <div class="wal-op-b">
        <div class="wal-op-why">${esc(op.why)}</div>
        <div class="wal-op-t">${walWhen(op.at)}</div>
      </div>
      <div class="wal-op-sum ${op.t==='+'?'in':'out'}">${op.t==='+'?'+':'−'} ${fmtMoney(op.sum)}</div>
    </div>`).join('');
}
function walSetFilter(f){
  walFilter = f;
  document.querySelectorAll('#walFilters button').forEach(b=>b.classList.toggle('on', b.dataset.f===f));
  walRenderLedger();
}
function walCopyAcc(){
  try{ navigator.clipboard.writeText(WALLET.acc); }catch(e){}
  toast('Номер счёта скопирован: ' + WALLET.acc);
}
function walScrollHistory(){
  const a = document.getElementById('walHistAnchor');
  if(a) a.scrollIntoView({behavior:'smooth', block:'start'});
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
    toast('Кошелёк пополнен на ' + fmtMoney(s.sum));
  }, 1100);
}

/* ---------- вывод (комиссия 2%) ---------- */
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
    <p class="dim" style="font-size:12.5px;margin:-4px 0 12px">Доступно: <b style="color:var(--accent)">${fmtMoney(WALLET.balance)}</b></p>
    <input id="walWdSum" type="number" min="1" max="${WALLET.balance}" placeholder="Сумма вывода, ₽" value="${s.sum||''}"
      oninput="walWdState.sum=Math.max(0,Number(this.value)||0);walSyncWdCalc()">
    <p style="font-weight:600;font-size:13px;margin:2px 0 8px">Куда вывести</p>
    <div class="wal-methods">${WAL_METHODS.map(([k,l,ic])=>`
      <button class="wal-m ${s.method===k?'on':''}" onclick="walWdState.method='${k}';walRenderWithdraw()">${I(ic)}<span>${l}</span></button>`).join('')}</div>
    <div class="wal-fee" id="walWdCalc"></div>
    <button class="btn" onclick="walDoWithdraw()"><svg class="i"><use href="#i-card"/></svg> <span id="walWdBtn">Вывести</span></button>
    <p class="dim" style="font-size:11px;text-align:center;margin-top:9px">Комиссия вывода 2%. Поступление 1–3 рабочих дня.</p>`;
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
  const fee = walWdFee(s.sum), get = s.sum - fee;
  if(!walletCharge(s.sum, 'Вывод на ' + WAL_M_LABEL[s.method])){ return; }
  okoEarn(fee, 'Комиссия вывода');
  const v = document.getElementById('walWdView');
  v.innerHTML = `<div style="text-align:center;padding:22px 0">
    <div class="spin"></div><p style="font-weight:700;margin-top:14px">Оформляем заявку…</p></div>`;
  setTimeout(()=>{
    v.innerHTML = `<div class="wal-ok-wrap">
      <div class="wal-ok">${I('check')}</div>
      <p style="font-weight:800;font-size:19px;margin-top:14px">Заявка на вывод создана</p>
      <p class="dim" style="font-size:13px;margin-top:6px">${fmtMoney(get)} придут на ${WAL_M_LABEL[s.method]} в течение 1–3 дней.<br>Комиссия 2%: ${fmtMoney(fee)}</p>
      <div style="height:16px"></div>
      <button class="btn" onclick="closeSheet()">Готово</button></div>`;
    renderWallet();
    toast('Вывод ' + fmtMoney(s.sum) + ' оформлен');
  }, 900);
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
  okoEarn(l.p * 0.10, 'Комиссия Биржи 10%');
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
