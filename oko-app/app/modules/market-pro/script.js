/* ================= MARKET-PRO: кабинет продавца + пакеты OKO Production =================
   Часть 1 — кабинет продавца на Бирже: статистика, баланс продаж (минус комиссия 10%),
   эскроу-сделки, вывод на кошелёк, рейтинг и отзывы.
   Часть 2 — флагманские пакеты «OKO Production — под ключ»: оплата с кошелька,
   рабочий чат клиента с ветками работ, уведомление.
   Патчи (chain): renderMarket (кнопка кабинета + премиум-баннер), orderListing
   (регистрация сделки в кабинете, саму покупку НЕ трогаем — она уже патчена wallet),
   openConv (закреплённые ветки работ). Персист: localStorage oko-market-pro. */

/* ---------- константы ---------- */
const MP_USD = 90;             // курс прототипа, ₽ за $
const MP_FEE = 0.10;           // комиссия OKO с продаж Биржи
const MP_ASSIST = 'Личный ассистент OKO';
const MP_BRANCHES = [
  ['Контент',  'сценарии, съёмка, монтаж, автопостинг'],
  ['Дизайн',   'обложки, оформление профиля, креативы'],
  ['Сайт',     'лендинг, домен, воронка продаж'],
  ['Реклама',  'кампании, таргет, ретаргет, трафик'],
  ['Отчёты',   'аналитика, метрики, еженедельные итоги'],
];
const MP_ST = {
  work: {t:'В работе',               ic:'clock'},
  wait: {t:'Ожидает подтверждения',  ic:'eye'},
  done: {t:'Завершена',              ic:'check'},
};

/* ---------- пакеты услуг ---------- */
const MP_PACKS = {
  start: {k:'start', name:'СТАРТ', usd:1500, tag:'Контент-завод на месяц',
    inc:['30 роликов в месяц под ключ','Сценарии, монтаж, караоке-субтитры','Дизайн: обложки и оформление профиля','Автопостинг в 3 соцсети','Аналитика и еженедельные отчёты'],
    bonus:[],
    weeks:[
      ['Бриф и стратегия','Анализ ниши и конкурентов, контент-план на 30 роликов, референсы стиля'],
      ['Запуск конвейера','Первые 8 роликов: сценарии, монтаж, обложки; старт автопостинга'],
      ['Разгон','Ещё 11 роликов, корректировка форматов по первой аналитике'],
      ['Итоги месяца','Финальные 11 роликов, полный отчёт и план следующего месяца'],
    ]},
  business: {k:'business', name:'БИЗНЕС', usd:3000, hot:true, tag:'Всё из СТАРТ + запуск продаж',
    inc:['Весь пакет СТАРТ: 30 роликов, дизайн, автопостинг, аналитика'],
    bonus:['Сайт под ключ: лендинг + домен','Воронка продаж от заявки до оплаты','Рекламные кампании: таргет и трафик','Личный ассистент на весь срок'],
    weeks:[
      ['Бриф и фундамент','Стратегия, контент-план, прототип сайта, структура воронки'],
      ['Контент + сайт','8 роликов в работе, релиз лендинга, подключение форм и аналитики'],
      ['Запуск продаж','Воронка в бою, старт рекламных кампаний, ещё 11 роликов'],
      ['Масштабирование','Финальные ролики, оптимизация рекламы, сводный отчёт по выручке'],
    ]},
};

/* ---------- состояние (персист) ---------- */
let MP = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-market-pro'))||null; }catch(e){ return null; } })();
function mpSave(){ try{ localStorage.setItem('oko-market-pro', JSON.stringify(MP)); }catch(e){} }
if(!MP || !MP.v){
  const H = 3600e3, now = Date.now();
  MP = { v:1, seq:0, gross:58000, customChatId:null, orders:[],
    stats:{901:{orders:9, rev:405000}, 902:{orders:6, rev:114000}, 903:{orders:8, rev:64000}},
    deals:[
      {id:'d1', t:'Контент-завод: 30 роликов в месяц', n:'Марина К.',  sum:45000, st:'work', dir:'in',  at:now-26*H},
      {id:'d2', t:'Лендинг под ключ за 5 дней',        n:'Игорь В.',   sum:19000, st:'wait', dir:'in',  at:now-4*H},
      {id:'d3', t:'Разбор и стратегия роста канала',   n:'Алина Р.',   sum:8000,  st:'done', dir:'in',  at:now-70*H},
    ]};
  mpSave();
}
const mpBal = () => Math.round(MP.gross * (1 - MP_FEE));

/* ---------- демо: мои объявления продавца (LISTINGS не персистится — сеем каждый запуск) ---------- */
(function mpSeedMyListings(){
  if(LISTINGS.some(l=>l.my)) return;
  const rv = (n,r,t)=>({n,r,t});
  LISTINGS.push(
    {id:901, cat:'video', type:'service', t:'Контент-завод: 30 роликов в месяц', p:45000, pt:'от 45 000 ₽/мес',
     ds:'Полный цикл: сценарии, съёмка, монтаж, караоке-субтитры, обложки, автопостинг и аналитика. Команда OKO Production.',
     a:'Д', n:PROFILE.name, r:4.9, deals:23, city:'Онлайн', term:'помесячно', views:3120, favs:97, contacts:141,
     promo:'turbo', fav:false, my:true, st:'act', seed:52,
     reviews:[rv('Марина К.',5,'За месяц 31 ролик, два залетели за 100к просмотров'), rv('Игорь В.',5,'Снял с себя весь контент, занимаюсь только продажами'), rv('Олег',4,'Качество топ, хотелось бы быстрее правки')]},
    {id:902, cat:'sites', type:'service', t:'Лендинг под ключ за 5 дней', p:19000, pt:'от 19 000 ₽',
     ds:'Продающий лендинг: структура, дизайн в фирменном стиле, адаптив, домен, формы и аналитика. Правки — 7 дней бесплатно.',
     a:'Д', n:PROFILE.name, r:5.0, deals:14, city:'Онлайн', term:'5 дней', views:1460, favs:41, contacts:57,
     promo:'vip', fav:false, my:true, st:'act', seed:64,
     reviews:[rv('Алина Р.',5,'Лендинг окупился с первой недели'), rv('Сергей Дан',5,'Конверсия 9% на холодном трафике')]},
    {id:903, cat:'consult', type:'service', t:'Разбор и стратегия роста канала', p:8000, pt:'от 8 000 ₽',
     ds:'Часовой разбор: контент, упаковка, воронка. На выходе — пошаговый план роста на 90 дней.',
     a:'Д', n:PROFILE.name, r:4.8, deals:19, city:'Онлайн', term:'1 день', views:890, favs:26, contacts:33,
     promo:null, fav:false, my:true, st:'act', seed:77,
     reviews:[rv('Катя SMM',5,'План на 90 дней реально рабочий')]}
  );
})();

/* ---------- хелперы ---------- */
function mpWhen(at){
  const d = new Date(at), n = new Date();
  const hm = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  if(d.toDateString()===n.toDateString()) return 'сегодня '+hm;
  if(d.toDateString()===new Date(n-864e5).toDateString()) return 'вчера '+hm;
  return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+' '+hm;
}
function mpCountUp(){
  document.querySelectorAll('[data-mpcount]').forEach(el=>{
    const target = Number(el.dataset.mpcount)||0, t0 = performance.now(), dur = 600;
    (function step(t){
      const k = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-k,3);
      el.textContent = fmtN(Math.round(target*e));
      if(k<1) requestAnimationFrame(step);
    })(t0);
  });
}
function mpMyReviews(){
  const out = [];
  LISTINGS.filter(l=>l.my).forEach(l=>(l.reviews||[]).forEach(r=>out.push(r)));
  return out;
}

/* ================= ЧАСТЬ 1 · КАБИНЕТ ПРОДАВЦА ================= */
function mpOpenCabinet(){ mpRenderCab(); openSheet('mpCab'); }
function mpRenderCab(){
  const box = document.getElementById('mpCabView');
  if(!box) return;
  const mine = LISTINGS.filter(l=>l.my);
  const views    = mine.reduce((s,l)=>s+(l.views||0),0);
  const contacts = mine.reduce((s,l)=>s+(l.contacts||0),0);
  const orders   = mine.reduce((s,l)=>s+((MP.stats[l.id]||{}).orders||0),0);
  const revenue  = mine.reduce((s,l)=>s+((MP.stats[l.id]||{}).rev||0),0);
  const revs = mpMyReviews();
  const avg = revs.length ? revs.reduce((s,r)=>s+r.r,0)/revs.length : 0;
  const fee = MP.gross - mpBal();
  const badge = (typeof vBadge==='function') ? vBadge(PROFILE.name) : '';
  const deals = MP.deals.slice().sort((a,b)=>(a.st==='done')-(b.st==='done') || b.at-a.at);
  box.innerHTML = `
    <div class="mp-cab-head">
      <div class="mp-cab-ava">${esc(PROFILE.name[0])}</div>
      <div><b>${esc(PROFILE.name)}${badge}</b>
        <small>${stars(avg)} ${avg?avg.toFixed(1):'—'} · ${revs.length} отзывов · продавец Биржи</small></div>
    </div>

    <div class="mp-h">${I('poll')} Статистика продавца</div>
    <div class="mp-kpi">
      <div class="mp-kpi-t">${I('eye')}<b data-mpcount="${views}">0</b><small>просмотры</small></div>
      <div class="mp-kpi-t">${I('chat')}<b data-mpcount="${contacts}">0</b><small>контакты</small></div>
      <div class="mp-kpi-t">${I('briefcase')}<b data-mpcount="${orders}">0</b><small>заказы</small></div>
      <div class="mp-kpi-t">${I('money')}<b data-mpcount="${revenue}">0</b><small>выручка ₽</small></div>
    </div>

    <div class="mp-h">${I('card')} Баланс продаж</div>
    <div class="mp-balcard">
      <small class="dim" style="font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:700">К выводу после комиссии</small>
      <div class="mp-bal-sum"><b>${mpBal().toLocaleString('ru-RU').replace(/,/g,' ')}</b> ₽</div>
      <div class="mp-calc">
        <div class="mp-calc-row"><span>Выручка с завершённых сделок</span><b>${fmtMoney(MP.gross)}</b></div>
        <div class="mp-calc-row fee"><span>Комиссия OKO 10%</span><b>− ${fmtMoney(fee)}</b></div>
        <div class="mp-calc-row total"><span>К выводу</span><b>${fmtMoney(mpBal())}</b></div>
      </div>
      <button class="btn" onclick="mpWithdraw()">${I('money')} Вывести на кошелёк</button>
    </div>

    <div class="mp-h">${I('briefcase')} По объявлениям</div>
    ${mine.length ? mine.map(l=>{
      const s = MP.stats[l.id]||{orders:0,rev:0};
      return `<div class="mp-lst" onclick="closeSheet();openListing(${l.id})">
        <span class="mp-lst-ic">${I(catIco(l.cat))}</span>
        <div class="mp-lst-b"><b>${esc(l.t)}</b>
          <div class="mp-lst-s">
            <span>${I('eye')}${fmtN(l.views)}</span>
            <span>${I('chat')}${l.contacts}</span>
            <span>${I('briefcase')}${s.orders} закз.</span>
          </div></div>
        <span class="mp-lst-rev">${fmtN(s.rev)} ₽</span></div>`;
    }).join('') : '<div class="mp-empty">Объявлений нет — размести первое на Бирже</div>'}

    <div class="mp-h">${I('lock')} Активные сделки · эскроу</div>
    ${deals.map(d=>{
      const st = MP_ST[d.st];
      const act = d.dir==='in'
        ? (d.st==='work' ? `<div class="mp-deal-act"><button onclick="mpDealNext('${d.id}')">${I('send')} Сдать работу</button></div>`
         : d.st==='wait' ? `<div class="mp-deal-act"><button onclick="mpDealNext('${d.id}')">${I('check')} Завершить сделку</button></div>` : '')
        : (d.st==='wait' ? `<div class="mp-deal-act"><button onclick="mpDealNext('${d.id}')">${I('check')} Подтвердить получение</button></div>` : '');
      return `<div class="mp-deal">
        <div class="mp-deal-top"><b>${esc(d.t)}</b><span class="mp-deal-sum">${fmtMoney(d.sum)}</span></div>
        <div class="mp-deal-meta">
          <span class="mp-st ${d.st}">${I(st.ic)}${st.t}</span>
          <span class="mp-dir">${d.dir==='in'?'Продажа':'Покупка'}</span>
          <small>${esc(d.n)} · ${mpWhen(d.at)}</small>
          ${d.st!=='done'?`<small class="mp-esc">${I('lock')}деньги в холде</small>`:''}
        </div>${act}</div>`;
    }).join('')}

    <div class="mp-h">${I('star')} Рейтинг и отзывы</div>
    <div class="mp-rate-big"><b>${avg?avg.toFixed(1):'—'}</b>
      <div>${stars(avg)}<small>${revs.length} отзывов по ${mine.length} объявлениям</small></div></div>
    ${revs.slice(0,6).map(r=>`<div class="mp-rev">
      <div class="mp-rev-h"><b>${esc(r.n)}</b><span class="mp-rev-st">${stars(r.r)}</span></div>
      <p>${esc(r.t)}</p></div>`).join('')}
    <div style="height:6px"></div>`;
  mpCountUp();
}
function mpDealNext(id){
  const d = MP.deals.find(x=>x.id===id);
  if(!d) return;
  if(d.st==='work'){ d.st='wait'; toast('Работа сдана — ждём подтверждения покупателя'); }
  else if(d.st==='wait'){
    d.st = 'done';
    if(d.dir==='in'){
      MP.gross += d.sum;
      toast('Сделка завершена · +'+fmtMoney(Math.round(d.sum*(1-MP_FEE)))+' в баланс продаж');
    } else {
      WALLET.hold = Math.max(0, WALLET.hold - d.sum); walletSave();
      toast('Получение подтверждено — эскроу снят, деньги ушли исполнителю');
    }
  }
  mpSave(); mpRenderCab();
}
function mpWithdraw(){
  const bal = mpBal();
  if(bal <= 0){ toast('Баланс продаж пуст — заверши активные сделки'); return; }
  walletAdd(bal, 'Выручка Биржи');
  okoEarn(MP.gross - bal, 'Комиссия Биржи 10%');
  MP.gross = 0; mpSave();
  toast('+'+fmtMoney(bal)+' зачислено на кошелёк');
  mpRenderCab();
}

/* ================= ЧАСТЬ 2 · ПАКЕТЫ OKO PRODUCTION ================= */
function mpOpenPackages(){
  const wrap = document.getElementById('marketRoot');
  if(!wrap) return;
  const packCard = p => `
    <div class="mp-pack ${p.hot?'hot':''}">
      ${p.hot?'<span class="mp-pack-flag">ФЛАГМАН</span>':''}
      <div class="mp-pack-name">${p.name}</div>
      <div class="mp-pack-tag">${p.tag}</div>
      <div class="mp-pack-price"><b>$${fmtN(p.usd)}</b><span>· ${fmtN(p.usd*MP_USD)} ₽ по курсу ${MP_USD} ₽/$</span></div>
      <ul class="mp-inc">${p.inc.map(x=>`<li>${I('check')}<span>${x}</span></li>`).join('')}</ul>
      ${p.bonus.length?`<span class="mp-bonus-lab">${I('bolt')} БОНУС</span>
        <ul class="mp-inc">${p.bonus.map(x=>`<li class="bonus">${I('check')}<span>${x}</span></li>`).join('')}</ul>`:''}
      <div class="mp-weeks"><div class="mp-weeks-h">Что получаешь по неделям</div>
        ${p.weeks.map((w,i)=>`<div class="mp-week"><span class="mp-week-n">${i+1}</span>
          <div class="mp-week-b"><b>Неделя ${i+1} · ${w[0]}</b><small>${w[1]}</small></div></div>`).join('')}</div>
      <button class="btn" onclick="mpOrderPackage('${p.k}')">${I('rocket')} Заказать пакет · ${fmtN(p.usd*MP_USD)} ₽</button>
      <div class="mp-pack-note">Оплата с кошелька OKO · рабочий чат с командой сразу после оплаты</div>
    </div>`;
  wrap.innerHTML = `
    <button class="mk-back" onclick="mkView='cats';mkCat=null;renderMarket()">${I('back')} Биржа</button>
    <div class="mp-hero">
      <svg><use href="#i-logo"/></svg>
      <h2>OKO <b>PRODUCTION</b></h2>
      <p>Флагманская услуга «под ключ» от команды OKO: контент, дизайн, сайт и реклама — делаем мы, растёшь ты.</p>
    </div>
    ${packCard(MP_PACKS.start)}
    ${packCard(MP_PACKS.business)}
    <div class="mp-pack custom">
      <span class="mp-cab-ic">${I('chat')}</span>
      <div style="flex:1;min-width:0"><div class="mp-pack-name">Индивидуальный</div>
        <p>Нестандартная задача или другой масштаб — соберём пакет под тебя.</p></div>
      <button class="btn" onclick="mpCustomChat()">Обсудим задачу</button>
    </div>
    <div style="height:8px"></div>`;
  wrap.scrollIntoView({block:'start'});
}

/* ---------- заказ пакета: оплата с кошелька ---------- */
let mpOrderPack = null;
function mpOrderPackage(k){ mpOrderPack = k; mpRenderOrder(); openSheet('mpOrder'); }
function mpRenderOrder(){
  const p = MP_PACKS[mpOrderPack];
  if(!p) return;
  const rub = p.usd*MP_USD, lack = rub - WALLET.balance;
  const box = document.getElementById('mpOrderView');
  box.innerHTML = `
    <div class="mp-ord-head">
      <span class="mp-banner-logo"><svg><use href="#i-logo"/></svg></span>
      <div><b>OKO Production · ${p.name}</b><small>${p.tag}</small></div>
    </div>
    <div class="mp-calc" style="border-top:none;padding-top:0">
      <div class="mp-calc-row"><span>Пакет «${p.name}»</span><b>$${fmtN(p.usd)}</b></div>
      <div class="mp-calc-row"><span>Курс прототипа</span><b>${MP_USD} ₽/$</b></div>
      <div class="mp-calc-row total"><span>К оплате с кошелька</span><b>${fmtMoney(rub)}</b></div>
      <div class="mp-calc-row"><span>Баланс кошелька</span><b>${fmtMoney(WALLET.balance)}</b></div>
    </div>
    ${lack>0 ? `
      <div class="mp-lack">Не хватает ${fmtMoney(lack)} для оплаты пакета</div>
      <button class="btn" onclick="mpGoTopup(${Math.ceil(lack/100)*100})">${I('plus')} Пополнить кошелёк</button>
      <div style="height:9px"></div>
      <button class="btn ghost" onclick="closeSheet()">Вернуться к пакетам</button>`
    : `
      <button class="btn" onclick="mpDoOrderPay()">${I('card')} Оплатить ${fmtMoney(rub)}</button>
      <p class="dim" style="font-size:11px;text-align:center;margin-top:9px">После оплаты создадим рабочий чат: личный ассистент, бриф и ветки работ.</p>`}`;
}
function mpGoTopup(sum){
  closeSheet();
  showTab('wallet');
  if(typeof walOpenTopup==='function') walOpenTopup(sum);
  else toast('Пополни кошелёк на '+fmtMoney(sum)+' и вернись к пакету');
}
function mpDoOrderPay(){
  const p = MP_PACKS[mpOrderPack];
  if(!p) return;
  const rub = p.usd*MP_USD;
  if(!walletCharge(rub, 'Пакет OKO Production · '+p.name)){ mpRenderOrder(); return; }
  okoEarn(rub, 'Пакеты услуг');
  const box = document.getElementById('mpOrderView');
  box.innerHTML = `<div style="text-align:center;padding:26px 0">
    <div class="mp-spin"></div>
    <p style="font-weight:700;margin-top:14px">Активируем пакет «${p.name}»…</p>
    <p class="dim" style="font-size:12px;margin-top:5px">Собираем команду и рабочий чат</p></div>`;
  setTimeout(()=>{
    const chat = mpCreateWorkChat(p);
    MP.orders.unshift({k:p.k, name:p.name, usd:p.usd, rub, chatId:chat.id, at:Date.now()});
    mpSave();
    NOTIFS.unshift({ic:'rocket', who:'OKO Production', t:'пакет «'+p.name+'» активирован — рабочий чат создан', time:'сейчас', g:'Сегодня', unread:true,
      act:()=>{ showTab('chats'); renderChatList(); openConv(chat.id); }});
    if(typeof updateNotifDot==='function') updateNotifDot();
    box.innerHTML = `<div class="mp-ok-wrap">
      <div class="mp-ok">${I('check')}</div>
      <p style="font-weight:800;font-size:19px;margin-top:14px">Пакет «${p.name}» активирован</p>
      <p class="dim" style="font-size:13px;margin-top:6px">Списано ${fmtMoney(rub)} · баланс ${fmtMoney(WALLET.balance)}.<br>Личный ассистент уже ждёт твой бриф.</p>
      <div style="height:16px"></div>
      <button class="btn" onclick="mpOpenWorkChat(${chat.id})">${I('chat')} Открыть рабочий чат</button></div>`;
    toast('Пакет «'+p.name+'» оплачен — чат с командой создан');
  }, 1200);
}
function mpOpenWorkChat(id){
  closeSheet();
  showTab('chats');
  renderChatList();
  openConv(id);
}

/* ---------- рабочий чат клиента ---------- */
function mpNextChatId(){ MP.seq = (MP.seq||0)+1; mpSave(); return 9100 + MP.seq; }
function mpWorkMsgs(p){
  const bn = MP_BRANCHES.map(b=>b[0]).join(' / ');
  const msgs = [
    {kind:'sys', body:'Рабочее пространство OKO Production · пакет «'+p.name+'»'},
    {in:1, who:MP_ASSIST, t:nowT(), kind:'text', body:'Привет, '+PROFILE.name+'! Я твой личный ассистент по пакету «'+p.name+'». Веду проект от брифа до отчёта, на связи каждый день — все вопросы сюда.'},
    {in:1, who:MP_ASSIST, t:nowT(), kind:'text', body:'Состав пакета: '+p.inc.concat(p.bonus).join(' · ')+'. Срок первого цикла — 30 дней.'},
    {in:1, who:MP_ASSIST, t:nowT(), kind:'text', body:'Чтобы стартовать, пришли бриф: 1) ниша и продукт, 2) ссылки на соцсети и сайт, 3) главная цель на месяц, 4) примеры стиля, который нравится. Можно текстом или голосовым.'},
    {kind:'sys', body:'Закреплено · Ветки работ: '+bn+' — навигация сверху'},
  ];
  MP_BRANCHES.forEach(b=>{
    msgs.push({kind:'sys', body:'ВЕТКА · '+b[0]+' — '+b[1]});
  });
  msgs.push({in:1, who:'Продюсер OKO', t:nowT(), kind:'text', body:'На связи. После брифа в ветке «Контент» появится план на 30 роликов, в «Отчёты» — метрики каждую пятницу.'});
  return msgs;
}
function mpCreateWorkChat(p, forcedId){
  const id = forcedId || mpNextChatId();
  const chat = {id, ava:'OP', name:'OKO Production · '+PROFILE.name, kind:'group', managed:true, members:5,
    kindIcon:'rocket', preview:MP_ASSIST+': жду бриф', time:nowT(), unread:0, online:true,
    msgs:mpWorkMsgs(p), mpBranches:MP_BRANCHES.map(b=>b[0])};
  CHATS.unshift(chat);
  return chat;
}
function mpCustomChat(){
  let chat = MP.customChatId && CHATS.find(c=>c.id===MP.customChatId);
  if(!chat){
    const id = mpNextChatId();
    chat = {id, ava:'OP', name:'OKO Production · '+PROFILE.name, kind:'group', managed:true, members:3,
      kindIcon:'rocket', preview:MP_ASSIST+': расскажи о задаче', time:nowT(), unread:0, online:true,
      msgs:[
        {kind:'sys', body:'Обсуждение индивидуального пакета OKO Production'},
        {in:1, who:MP_ASSIST, t:nowT(), kind:'text', body:'Привет, '+PROFILE.name+'! Расскажи о задаче: что за проект, какой масштаб и сроки, какой бюджет комфортен. Соберу под тебя пакет и посчитаю смету за день.'},
        {in:1, who:MP_ASSIST, t:nowT(), kind:'text', body:'Для ориентира: СТАРТ $1500 — контент-завод на месяц, БИЗНЕС $3000 — плюс сайт, воронка и реклама. Индивидуальный может быть и между, и сильно больше.'},
      ], mpBranches:null};
    CHATS.unshift(chat);
    MP.customChatId = id; mpSave();
  }
  showTab('chats');
  renderChatList();
  openConv(chat.id);
}

/* ---------- восстановление рабочих чатов после перезагрузки ---------- */
(function mpRestoreChats(){
  (MP.orders||[]).slice().reverse().forEach(o=>{
    const p = MP_PACKS[o.k];
    if(p && !CHATS.find(c=>c.id===o.chatId)) mpCreateWorkChat(p, o.chatId);
  });
})();

/* ================= ПАТЧИ (chain) ================= */

/* биржа: кнопка-строка кабинета + премиум-баннер над категориями */
const _prevRenderMarketMp = renderMarket;
renderMarket = function(){
  _prevRenderMarketMp();
  if(typeof mkView!=='undefined' && mkView==='cats') mpInjectMarket();
};
function mpInjectMarket(){
  const root = document.getElementById('marketRoot');
  if(!root) return;
  const quick = root.querySelector('.mk-quick');
  if(!quick || document.getElementById('mpCabRow')) return;
  const active = MP.deals.filter(d=>d.st!=='done').length;
  const row = document.createElement('button');
  row.id = 'mpCabRow'; row.className = 'mp-cab-row'; row.onclick = mpOpenCabinet;
  row.innerHTML = `<span class="mp-cab-ic">${I('crown')}</span>
    <span class="mp-cab-b"><b>Кабинет продавца</b><small>К выводу ${fmtMoney(mpBal())} · активных сделок: ${active}</small></span>
    ${I('chev','mp-chev')}`;
  quick.insertAdjacentElement('afterend', row);
  const bn = document.createElement('button');
  bn.id = 'mpBanner'; bn.className = 'mp-banner'; bn.onclick = mpOpenPackages;
  bn.innerHTML = `<span class="mp-banner-logo"><svg><use href="#i-logo"/></svg></span>
    <span class="mp-banner-b">
      <span class="mp-banner-t">OKO <b>PRODUCTION</b> — под ключ</span>
      <span class="mp-banner-s">Контент-завод, дизайн, сайт и реклама командой OKO</span>
    </span>
    <span class="mp-banner-cta"><span class="mp-banner-chip">от $1500</span>${I('chev')}</span>`;
  row.insertAdjacentElement('afterend', bn);
}

/* заказ на бирже: покупка уже патчена wallet (эскроу+комиссия) — только читаем результат */
const _prevOrderListingMp = orderListing;
orderListing = function(id){
  const holdBefore = WALLET.hold;
  _prevOrderListingMp(id);
  if(WALLET.hold <= holdBefore) return; // оплата не прошла — сделку не регистрируем
  const l = LISTINGS.find(x=>x.id===id);
  if(!l) return;
  MP.deals.unshift({id:'d'+Date.now(), t:l.t, n:l.n, sum:l.p, st:'work', dir:'out', at:Date.now()});
  mpSave();
  const sheet = document.getElementById('sheet-mpCab');
  if(sheet && sheet.classList.contains('open')) mpRenderCab();
};

/* чаты: закреплённое сообщение-навигация «ветки работ» */
const _prevOpenConvMp = openConv;
openConv = function(id){
  _prevOpenConvMp(id);
  const old = document.getElementById('mpPinBar');
  if(old) old.remove();
  if(!currentChat || !currentChat.mpBranches) return;
  const msgs = document.getElementById('msgs');
  if(!msgs) return;
  const bar = document.createElement('div');
  bar.id = 'mpPinBar'; bar.className = 'mp-pin';
  bar.innerHTML = `<div class="mp-pin-h">${I('pin')} Закреплено · ветки работ</div>
    <div class="mp-pin-chips">${currentChat.mpBranches.map(b=>
      `<button onclick="mpGoBranch('${b}')">${b}</button>`).join('')}</div>`;
  msgs.parentElement.insertBefore(bar, msgs);
};
function mpGoBranch(name){
  if(!currentChat) return;
  const idx = currentChat.msgs.findIndex(m=>m.kind==='sys' && (m.body||'').indexOf('ВЕТКА · '+name)===0);
  if(idx<0) return;
  const el = document.getElementById('msgs');
  const node = el && el.children[idx];
  if(!node) return;
  node.scrollIntoView({behavior:'smooth', block:'center'});
  node.classList.remove('mp-branch-flash');
  void node.offsetWidth;
  node.classList.add('mp-branch-flash');
}

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
if(document.getElementById('ma-market') && document.getElementById('ma-market').style.display==='block') renderMarket();
