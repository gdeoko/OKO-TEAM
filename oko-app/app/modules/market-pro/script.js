/* ================= MARKET-PRO: кабинет продавца + пакеты OKO Production =================
   Часть 1 — кабинет продавца на Бирже: статистика, баланс продаж (минус комиссия 10%),
   эскроу-сделки, вывод на кошелёк, рейтинг и отзывы.
   Часть 2 — флагманские пакеты «OKO Production — под ключ»: оплата с кошелька,
   рабочий чат клиента с ветками работ, уведомление.
   Часть 3 — шлифовка: отзывы после сделки (звёзды 1-5 + текст -> l.reviews + пересчёт l.r),
   чат с продавцом с автоприветствием, жалоба на объявление (chip-причины -> ADMIN.moder),
   фильтр «Только проверенные» (verified или рейтинг 4.8+).
   Патчи (chain): renderMarket (кнопка кабинета + премиум-баннер), orderListing
   (регистрация сделки в кабинете, саму покупку НЕ трогаем — она уже патчена wallet),
   openConv (закреплённые ветки работ), openListing (бейдж/жалоба/кнопка), contactSeller
   (автоприветствие), mkApplyFilters/renderFilters/activeFilterCount/resetFilters
   (фильтр проверенных), admModer (счётчик жалоб). Персист: localStorage oko-market-pro. */

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
  new:     {t:'Новый заказ',            ic:'bolt'},
  work:    {t:'В работе',               ic:'clock'},
  wait:    {t:'На холде · проверка',    ic:'lock'},
  done:    {t:'Завершена',              ic:'check'},
  dispute: {t:'Спор',                   ic:'flag'},
  cancel:  {t:'Отменена · возврат',     ic:'back'},
};
const MP_ST_OPEN = st => st!=='done' && st!=='cancel'; // сделка «живая» (эскроу активен)

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
const MP_H = 3600e3;
function mpSeedDeals(){
  const now = Date.now(), H = MP_H;
  return [
    {id:'d0', t:'Пакет: 15 Shorts для запуска',       n:'Тимур Н.',   sum:12000, st:'new',  dir:'in',  at:now-40*60e3, lid:901},
    {id:'d1', t:'Контент-завод: 30 роликов в месяц',  n:'Марина К.',  sum:45000, st:'work', dir:'in',  at:now-26*H, lid:901},
    {id:'d2', t:'Лендинг под ключ за 5 дней',         n:'Игорь В.',   sum:19000, st:'wait', dir:'in',  at:now-4*H,  lid:902},
    {id:'d3', t:'Разбор и стратегия роста канала',    n:'Алина Р.',   sum:8000,  st:'done', dir:'in',  at:now-70*H, lid:903, rev:5},
    {id:'d4', t:'Дизайн обложек и карточек товара',   n:'Лиза Кот',   sum:300,   st:'wait', dir:'out', at:now-9*H,  lid:2, held:false},
  ];
}
if(!MP || !MP.v){
  MP = { v:2, seq:0, gross:58000, customChatId:null, orders:[],
    stats:{901:{orders:9, rev:405000}, 902:{orders:6, rev:114000}, 903:{orders:8, rev:64000}},
    deals: mpSeedDeals() };
  mpSave();
}
/* миграция v1 -> v2: не стираем сохранённые данные, лишь добираем демо-статусы «новый» и «покупка» */
if(MP.v < 2){
  const have = new Set(MP.deals.map(d=>d.id));
  mpSeedDeals().forEach(d=>{ if((d.id==='d0'||d.id==='d4') && !have.has(d.id)) MP.deals.push(d); });
  MP.v = 2; mpSave();
}
MP.myRevs  = MP.myRevs  || [];  // отзывы, добавленные после сделок (реплей после перезагрузки)
MP.reports = MP.reports || [];  // локальный лог жалоб на объявления
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

/* ---------- реплей сохранённых отзывов (LISTINGS пересоздаются каждый запуск) ---------- */
(function mpReplayReviews(){
  const touched = new Set();
  (MP.myRevs||[]).forEach(rv0=>{
    const l = LISTINGS.find(x=>x.id===rv0.lid);
    if(!l) return;
    (l.reviews = l.reviews||[]).unshift({n:rv0.n, r:rv0.r, t:rv0.t});
    touched.add(l);
  });
  /* стартовый рейтинг своих сид-объявлений должен сразу совпадать со своими же отзывами
     (иначе, напр., #903 показывает 4.8 при единственном 5★-отзыве — mismatch до 1-го реального) */
  LISTINGS.forEach(l=>{ if(l.my && l.reviews && l.reviews.length) touched.add(l); });
  touched.forEach(l=>mpRecalcRating(l));
})();

/* ---------- хелперы ---------- */
function mpRecalcRating(l){
  const rv = l.reviews||[];
  if(rv.length) l.r = Math.round(rv.reduce((s,x)=>s+x.r,0)/rv.length*10)/10;
}
function mpDealListing(d){
  return (d.lid && LISTINGS.find(x=>x.id===d.lid)) || LISTINGS.find(x=>x.t===d.t) || null;
}
function mpIsVerified(l){
  return (typeof VERIFIED!=='undefined' && VERIFIED.has(l.n)) || l.r>=4.8;
}
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

/* ---------- инфографика: динамика выручки (6 мес.), внутренне-согласованный тренд ---------- */
const MP_TREND_W = [0.52, 0.61, 0.55, 0.74, 0.83, 1.0]; // относительная форма кривой роста
function mpMonthLabels(){
  const ru = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
  const out = [], now = new Date();
  for(let i=5;i>=0;i--){ const d = new Date(now.getFullYear(), now.getMonth()-i, 1); out.push(ru[d.getMonth()]); }
  return out;
}
function mpTrendVals(total){
  const s = MP_TREND_W.reduce((a,b)=>a+b,0);
  return MP_TREND_W.map(x=>Math.round(total/s*x)); // сумма месяцев == общая выручка
}
/* ---------- инфографика: воронка показы -> контакты -> заказы (реальные числа) ---------- */
function mpFunnel(views, contacts, orders){
  const rows = [
    {ic:'eye',       lab:'Показы',   n:views},
    {ic:'chat',      lab:'Контакты', n:contacts},
    {ic:'briefcase', lab:'Заказы',   n:orders},
  ];
  const max = Math.max(1, views);
  return `<div class="mp-funnel">${rows.map((r,i)=>{
    const w = Math.max(7, Math.round(r.n/max*100));
    const conv = i>0 ? (rows[i-1].n ? Math.round(r.n/rows[i-1].n*1000)/10 : 0) : null;
    return `<div class="mp-fn-row">
      <div class="mp-fn-lab">${I(r.ic)}<span>${r.lab}</span><b>${fmtN(r.n)}</b></div>
      <div class="mp-fn-track"><span class="mp-fn-bar s${i}" style="--w:${w}%"></span></div>
      ${conv!==null?`<div class="mp-fn-conv">${I('chev')} конверсия <b>${conv}%</b></div>`:''}
    </div>`;
  }).join('')}</div>`;
}
/* ---------- инфографика: распределение оценок (реальные отзывы) ---------- */
function mpRatingDist(revs){
  const cnt = {5:0,4:0,3:0,2:0,1:0};
  revs.forEach(r=>{ const k = Math.max(1,Math.min(5,Math.round(r.r))); cnt[k]++; });
  const max = Math.max(1, ...Object.values(cnt));
  let rows = '';
  for(let s=5;s>=1;s--){
    const w = Math.round(cnt[s]/max*100);
    rows += `<div class="mp-rd-row"><span class="mp-rd-k">${s}${I('star')}</span>
      <span class="mp-rd-track"><span class="mp-rd-bar" style="--w:${cnt[s]?w:0}%"></span></span>
      <span class="mp-rd-n">${cnt[s]}</span></div>`;
  }
  return `<div class="mp-rdist">${rows}</div>`;
}
/* ---------- блок аналитики (динамика выручки + воронка) ---------- */
function mpAnalytics(revenue, views, contacts, orders){
  const vals = mpTrendVals(revenue), labs = mpMonthLabels();
  const max = Math.max(1, ...vals);
  const growth = vals[0] ? Math.round((vals[5]-vals[0])/vals[0]*100) : 0;
  const bars = vals.map((v,i)=>{
    const h = Math.max(6, Math.round(v/max*100));
    return `<div class="mp-tb-col"><span class="mp-tb-val">${fmtN(v)}</span>
      <span class="mp-tb-track"><span class="mp-tb-bar${i===5?' now':''}" style="--h:${h}%;--d:${i*0.07}s"></span></span>
      <span class="mp-tb-x">${labs[i]}</span></div>`;
  }).join('');
  return `
    <div class="mp-h">${I('poll')} Динамика выручки · 6 мес.</div>
    <div class="mp-chart">
      <div class="mp-chart-top">
        <div><b>${fmtMoney(revenue)}</b><small>за полгода</small></div>
        <span class="mp-grow ${growth>=0?'up':'down'}">${I(growth>=0?'rocket':'chev')} ${growth>=0?'+':''}${growth}%</span>
      </div>
      <div class="mp-tbars">${bars}</div>
    </div>
    <div class="mp-h">${I('bolt')} Воронка продаж</div>
    ${mpFunnel(views, contacts, orders)}`;
}
/* ---------- эскроу-трекер стадий сделки ---------- */
function mpEscrowStep(d){
  if(d.st==='cancel')
    return `<div class="mp-esc-flat cancel">${I('back')} Сделка отменена · ${fmtMoney(d.sum)} возвращены на кошелёк</div>`;
  const nodes = d.dir==='in'
    ? ['Заказ','В работе','Сдача','Выплата']
    : ['Оплата','В работе','Проверка','Получено'];
  const dispute = d.st==='dispute';
  // new:0  work:1  wait/dispute:2  done:all
  const cur = d.st==='new' ? 0 : d.st==='work' ? 1 : (d.st==='wait'||dispute) ? 2 : nodes.length;
  const fill = Math.min(100, Math.round(cur/(nodes.length-1)*100));
  return `<div class="mp-esc-track${dispute?' dispute':''}" style="--fill:${fill}%">
    <div class="mp-esc-line"></div><div class="mp-esc-fill"></div>
    ${nodes.map((n,i)=>{
      const cls = i<cur ? 'done' : i===cur ? 'cur' : '';
      return `<div class="mp-esc-node ${cls}"><span class="mp-esc-dot">${i<cur?I('check'):''}</span><small>${n}</small></div>`;
    }).join('')}
  </div>${dispute?`<div class="mp-esc-flat dispute">${I('flag')} Спор открыт · модерация OKO проверяет сделку, деньги заморожены</div>`:''}`;
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
  const term = d => (d.st==='done'||d.st==='cancel');
  const deals = MP.deals.slice().sort((a,b)=>(term(a)-term(b)) || (a.st==='dispute'?-1:0)-(b.st==='dispute'?-1:0) || b.at-a.at);
  const openN = MP.deals.filter(d=>MP_ST_OPEN(d.st)).length;
  const holdSum = MP.deals.filter(d=>MP_ST_OPEN(d.st)).reduce((s,d)=>s+d.sum,0);
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

    ${mpAnalytics(revenue, views, contacts, orders)}

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

    <div class="mp-h">${I('lock')} Сделки · эскроу
      ${openN?`<span class="mp-h-badge">${openN} активн.</span>`:''}
      ${holdSum?`<span class="mp-h-badge hold">${I('lock')}${fmtMoney(holdSum)} в холде</span>`:''}
    </div>
    ${deals.map(d=>{
      const st = MP_ST[d.st];
      return `<div class="mp-deal${d.st==='dispute'?' dispute':''}${d.st==='cancel'?' cancelled':''}">
        <div class="mp-deal-top"><b>${esc(d.t)}</b><span class="mp-deal-sum">${fmtMoney(d.sum)}</span></div>
        <div class="mp-deal-meta">
          <span class="mp-st ${d.st}">${I(st.ic)}${st.t}</span>
          <span class="mp-dir ${d.dir}">${d.dir==='in'?'Продажа':'Покупка'}</span>
          <small>${esc(d.n)} · ${mpWhen(d.at)}</small>
          ${MP_ST_OPEN(d.st)?`<small class="mp-esc">${I('lock')}деньги в холде</small>`:''}
        </div>
        ${mpEscrowStep(d)}${mpDealActions(d)}</div>`;
    }).join('')}

    <div class="mp-h">${I('star')} Рейтинг и отзывы</div>
    <div class="mp-rate-big"><b>${avg?avg.toFixed(1):'—'}</b>
      <div class="mp-rate-mid">${stars(avg)}<small>${revs.length} отзывов по ${mine.length} объявлениям</small></div>
      ${revs.length?mpRatingDist(revs):''}</div>
    ${revs.slice(0,6).map(r=>`<div class="mp-rev">
      <div class="mp-rev-h"><b>${esc(r.n)}</b><span class="mp-rev-st">${stars(r.r)}</span></div>
      <p>${esc(r.t)}</p></div>`).join('')}
    <div style="height:6px"></div>`;
  mpCountUp();
}
/* ---------- набор действий под каждой сделкой (зависит от направления и статуса) ---------- */
function mpDealActions(d){
  if(d.st==='cancel') return ''; // отменённая сделка — терминальна, действий нет
  const chat = MP_ST_OPEN(d.st)
    ? `<button class="ghost" onclick="mpOpenDealChat('${d.id}')">${I('chat')} Чат по сделке</button>` : '';
  let main = '';
  if(d.dir==='in'){                                   // ПРОДАЖА (пользователь — продавец)
    if(d.st==='new')        main = `<button onclick="mpDealNext('${d.id}')">${I('check')} Принять заказ</button>`;
    else if(d.st==='work')  main = `<button onclick="mpDealNext('${d.id}')">${I('send')} Сдать работу</button>`;
    else if(d.st==='wait')  main = `<button onclick="mpDealNext('${d.id}')">${I('check')} Завершить сделку</button>`;
    else if(d.st==='dispute') main = `<button onclick="mpDealResolve('${d.id}','refund')">${I('back')} Вернуть деньги</button>
                                      <button onclick="mpDealResolve('${d.id}','done')">${I('check')} Завершить</button>`;
    else return mpRevBtn(d);                           // done / cancel
  } else {                                             // ПОКУПКА (пользователь — покупатель)
    if(d.st==='new' || d.st==='work'){
      main = `<button class="ghost" onclick="mpDealPoke('${d.id}')">${I('eye')} Запросить статус</button>
              <button class="warn" onclick="mpDealCancel('${d.id}')">${I('back')} Отменить · возврат</button>`;
    } else if(d.st==='wait'){
      main = `<button onclick="mpDealNext('${d.id}')">${I('check')} Подтвердить получение</button>
              <button class="warn" onclick="mpDealDispute('${d.id}')">${I('flag')} Открыть спор</button>`;
    } else if(d.st==='dispute'){
      main = `<button onclick="mpDealResolve('${d.id}','refund')">${I('back')} Вернуть деньги</button>
              <button class="ghost" onclick="mpDealResolve('${d.id}','done')">${I('check')} Всё ок, завершить</button>`;
    } else return mpRevBtn(d);                          // done / cancel
  }
  return `<div class="mp-deal-act">${main}${chat}</div>`;
}
function mpDealNext(id){
  const d = MP.deals.find(x=>x.id===id);
  if(!d) return;
  if(d.st==='new'){ d.st='work'; toast('Заказ принят — сделка в работе'); mpDealChatNote(d,'Продавец принял заказ. Работа началась.'); }
  else if(d.st==='work'){ d.st='wait'; toast('Работа сдана — деньги на холде до подтверждения'); mpDealChatNote(d, d.dir==='in'?'Продавец сдал работу. Проверьте и подтвердите — эскроу снимется.':'Работа сдана исполнителем.'); }
  else if(d.st==='wait'){ mpDealComplete(d); return; }
  mpSave(); mpRenderCab();
}
function mpDealComplete(d){
  d.st = 'done';
  if(d.dir==='in'){                                   // продажа: выручка в баланс продаж, комиссия при выводе
    MP.gross += d.sum;
    toast('Сделка завершена · +'+fmtMoney(Math.round(d.sum*(1-MP_FEE)))+' в баланс продаж');
  } else {                                            // покупка: снимаем холд — деньги ушли исполнителю
    mpReleaseHold(d);
    toast('Получение подтверждено — эскроу снят, деньги ушли исполнителю');
    setTimeout(()=>mpOpenReview(d.id), 500);
  }
  mpDealChatNote(d, 'Сделка успешно завершена. Спасибо!');
  mpSave(); mpRenderCab();
}
function mpDealPoke(id){
  const d = MP.deals.find(x=>x.id===id);
  if(!d || d.dir!=='out' || (d.st!=='work' && d.st!=='new')) return;
  d.st = 'wait'; mpSave();
  toast('Исполнитель сдал работу — проверь и подтверди получение');
  mpDealChatNote(d, 'Исполнитель отметил работу как сданную — на проверке у покупателя.');
  mpRenderCab();
}
/* снять эскроу-холд (реальные деньги только если сделка их реально держит) */
function mpReleaseHold(d){
  if(d.held){
    WALLET.hold = Math.max(0, WALLET.hold - d.sum); walletSave();
    // комиссия OKO признаётся ТОЛЬКО здесь — при завершении сделки (деньги ушли из эскроу продавцу)
    okoEarn(Math.round(d.sum*MP_FEE*100)/100, 'Комиссия Биржи 10%');
    d.held = false;
  }
}
/* возврат покупателю: холд -> баланс (комиссия не признавалась — откатывать нечего) */
function mpRefundBuyer(d){
  if(d.held){
    WALLET.hold = Math.max(0, WALLET.hold - d.sum); walletSave();
    walletAdd(d.sum, 'Возврат по сделке Биржи');
    d.held = false;
  }
}
function mpDealCancel(id){
  const d = MP.deals.find(x=>x.id===id);
  if(!d || d.dir!=='out' || !MP_ST_OPEN(d.st)) return;
  showPopup({ico:'back', title:'Отменить сделку?', body:'Сделка «'+esc(d.t)+'» будет отменена, а '+fmtMoney(d.sum)+' из эскроу вернутся на кошелёк.',
    actions:[
      {label:'Оставить', ghost:true, onclick:()=>closePopup()},
      {label:'Отменить и вернуть', onclick:()=>{ closePopup(); mpRefundBuyer(d); d.st='cancel'; mpSave();
        toast('Сделка отменена · '+fmtMoney(d.sum)+' возвращены на кошелёк');
        mpDealChatNote(d,'Покупатель отменил сделку. Эскроу возвращён на кошелёк.'); mpRenderCab(); }}
    ]});
}
function mpDealDispute(id){
  const d = MP.deals.find(x=>x.id===id);
  if(!d || d.st!=='wait') return;
  d.st = 'dispute'; mpSave();
  if(typeof ADMIN!=='undefined' && ADMIN.moder){
    ADMIN.moder.unshift({t:'Спор по сделке: «'+d.t+'» — '+fmtMoney(d.sum), by:'@'+(PROFILE.nick||'user'), kind:'Биржа'});
    if(ADMIN.kpi) ADMIN.kpi.moder = ADMIN.moder.length;
  }
  toast('Спор открыт — деньги заморожены, модерация OKO подключится');
  mpDealChatNote(d,'Открыт спор. Средства заморожены до решения модерации OKO.');
  mpRenderCab();
}
function mpDealResolve(id, outcome){
  const d = MP.deals.find(x=>x.id===id);
  if(!d || d.st!=='dispute') return;
  if(outcome==='refund'){
    if(d.dir==='out') mpRefundBuyer(d);
    d.st = 'cancel'; toast('Спор решён в пользу возврата · '+fmtMoney(d.sum)+' вернулись');
    mpDealChatNote(d,'Спор решён: средства возвращены покупателю.');
    mpSave(); mpRenderCab();
  } else {
    mpDealComplete(d); // завершение с обычной логикой (выручка/снятие холда)
  }
}

/* ---------- чат по сделке: связка эскроу с мессенджером ---------- */
function mpDealChat(d){
  let chat = (d.chatId && CHATS.find(c=>c.id===d.chatId)) || CHATS.find(c=>c.name===d.n);
  if(!chat){
    const id = 'deal-'+d.id;
    chat = {id, ava:(d.n||'?')[0], name:d.n, kind:'direct', nick:(d.n||'user').toLowerCase().replace(/\s/g,'_'),
      kindIcon:null, preview:'Сделка: '+d.t, time:nowT(), unread:0, online:true,
      msgs:[{kind:'sys', body:'Сделка по объявлению «'+d.t+'» · '+fmtMoney(d.sum)+' · '+(d.dir==='in'?'вы продавец':'вы покупатель')},
            {kind:'sys', body:'Эскроу OKO: деньги под защитой до подтверждения выполнения'}]};
    CHATS.unshift(chat);
  }
  d.chatId = chat.id;
  return chat;
}
function mpDealChatNote(d, text){
  const chat = (d.chatId && CHATS.find(c=>c.id===d.chatId)) || CHATS.find(c=>c.name===d.n);
  if(!chat) return;
  chat.msgs.push({kind:'sys', body:'Сделка · '+MP_ST[d.st].t+': '+text});
  chat.preview = text; chat.time = nowT();
  if(typeof currentChat!=='undefined' && currentChat===chat && typeof openConv==='function') openConv(chat.id);
  if(typeof renderChatList==='function' && document.getElementById('screen-chats')) renderChatList();
}
function mpOpenDealChat(id){
  const d = MP.deals.find(x=>x.id===id);
  if(!d) return;
  const chat = mpDealChat(d);
  mpSave();
  closeSheet();
  showTab('chats');
  if(typeof renderChatList==='function') renderChatList();
  openConv(chat.id);
}

/* ================= ОТЗЫВЫ ПОСЛЕ СДЕЛКИ ================= */
let mpRevDealId = null, mpRevStars = 5;
const MP_STAR_LAB = {1:'Ужасно', 2:'Плохо', 3:'Нормально', 4:'Хорошо', 5:'Отлично'};
function mpRevBtn(d){
  if(d.rev) return `<div class="mp-deal-act"><span class="mp-revok">${I('check')} Отзыв оставлен · ${d.rev}/5</span></div>`;
  if(!mpDealListing(d)) return '';
  return `<div class="mp-deal-act"><button onclick="mpOpenReview('${d.id}')">${I('star')} Оставить отзыв</button></div>`;
}
function mpOpenReview(id){
  const d = MP.deals.find(x=>x.id===id);
  if(!d || d.st!=='done' || d.rev) return;
  mpRevDealId = id; mpRevStars = 5;
  mpRenderReview();
  openSheet('mpReview');
}
function mpRenderReview(){
  const d = MP.deals.find(x=>x.id===mpRevDealId);
  const box = document.getElementById('mpReviewView');
  if(!d || !box) return;
  const who = d.dir==='out'
    ? 'Оцени исполнителя — отзыв появится в его объявлении и пересчитает рейтинг'
    : 'Покупатель '+esc(d.n)+' оценивает сделку — отзыв появится в твоём объявлении';
  box.innerHTML = `
    <h3 class="mp-rv-title">Оставить отзыв</h3>
    <p class="mp-rv-sub">${esc(d.t)} · ${fmtMoney(d.sum)}</p>
    <p class="mp-rv-who">${I('star')} ${who}</p>
    <div class="mp-rstars" id="mpRstars">${mpStarsBig()}</div>
    <div class="mp-rlab" id="mpRlab">${MP_STAR_LAB[mpRevStars]}</div>
    <textarea id="mpRevText" class="mp-ta" rows="4" maxlength="280" placeholder="Что понравилось, что можно улучшить…"></textarea>
    <button class="btn" onclick="mpSubmitReview()">${I('star')} Опубликовать отзыв</button>`;
}
function mpStarsBig(){
  let s = '';
  for(let i=1;i<=5;i++) s += `<button class="mp-rstar ${i<=mpRevStars?'on':''}" onclick="mpSetStars(${i})">${I('star')}</button>`;
  return s;
}
function mpSetStars(n){
  mpRevStars = n;
  const el = document.getElementById('mpRstars'); if(el) el.innerHTML = mpStarsBig();
  const lb = document.getElementById('mpRlab');   if(lb) lb.textContent = MP_STAR_LAB[n];
}
function mpSubmitReview(){
  const d = MP.deals.find(x=>x.id===mpRevDealId);
  if(!d) return;
  const txt = ((document.getElementById('mpRevText')||{}).value||'').trim();
  if(txt.length<3){ toast('Пара слов о сделке — и отзыв готов'); return; }
  const l = mpDealListing(d);
  const author = d.dir==='out' ? PROFILE.name : d.n;
  if(l){
    (l.reviews = l.reviews||[]).unshift({n:author, r:mpRevStars, t:txt});
    mpRecalcRating(l);
    MP.myRevs.push({lid:l.id, n:author, r:mpRevStars, t:txt, at:Date.now()});
  }
  d.rev = mpRevStars;
  mpSave();
  closeSheet();
  toast(l ? 'Отзыв опубликован — рейтинг объявления теперь '+l.r.toFixed(1) : 'Отзыв сохранён');
  mpOpenCabinet(); // вернуться в кабинет с обновлённым состоянием
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
      <div class="mp-pack-note">Оплата с кошелька OKO · команда и рабочий чат сразу, старт брифа в день оплаты</div>
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
  if(typeof mkView!=='undefined' && mkView==='cats'){ mpInjectMarket(); mpDecorateCards(); }
};
function mpInjectMarket(){
  const root = document.getElementById('marketRoot');
  if(!root) return;
  const quick = root.querySelector('.mk-quick');
  if(!quick || document.getElementById('mpCabRow')) return;
  const active = MP.deals.filter(d=>MP_ST_OPEN(d.st)).length;
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
      <span class="mp-banner-s">Полный цикл роста под ключ: контент, дизайн, сайт, реклама</span>
    </span>
    <span class="mp-banner-cta"><span class="mp-banner-chip">от $1500</span>${I('chev')}</span>`;
  row.insertAdjacentElement('afterend', bn);
}

/* биржа: бейджи «Проверенный» и рейтинг-пилюля на медиа-плейсхолдерах карточек */
function mpIdFromCard(el){
  const m = (el.getAttribute('onclick')||'').match(/openListing\((\d+)\)/);
  return m ? +m[1] : null;
}
function mpRatingPill(l){
  return `<span class="mp-photo-rate">${I('star')}${l.r.toFixed(1)}</span>`;
}
function mpVerMini(){ return `<span class="mp-photo-ver" title="Проверенный продавец">${I('verified')}</span>`; }
function mpDecoratePhoto(photo, l){
  if(!photo || photo.querySelector('.mp-photo-rate')) return;
  if(l.r) photo.insertAdjacentHTML('beforeend', mpRatingPill(l));
  if(mpIsVerified(l)) photo.insertAdjacentHTML('beforeend', mpVerMini());
}
function mpDecorateCards(){
  document.querySelectorAll('#mkResults .lst-card').forEach(card=>{
    const id = mpIdFromCard(card), l = id && LISTINGS.find(x=>x.id===id);
    if(l) mpDecoratePhoto(card.querySelector('.lst-photo'), l);
  });
  document.querySelectorAll('.mk-feat .feat-card').forEach(card=>{
    const id = mpIdFromCard(card), l = id && LISTINGS.find(x=>x.id===id);
    if(l && mpIsVerified(l) && !card.querySelector('.mp-photo-ver'))
      (card.querySelector('.lst-photo')||card).insertAdjacentHTML('beforeend', mpVerMini());
  });
}
if(typeof renderMarketListSoft==='function'){
  const _prevRMLS = renderMarketListSoft;
  renderMarketListSoft = function(){
    const box = document.getElementById('mkResults');
    if(box) box.classList.remove('mp-cascade'); // печать в поиске не должна каждый раз анимировать заново
    _prevRMLS.apply(this, arguments);
    mpDecorateCards();
  };
}
/* каскадное появление карточек — только при полном входе в список (не на каждый символ поиска) */
if(typeof renderMarketList==='function'){
  const _prevRML = renderMarketList;
  renderMarketList = function(){
    _prevRML.apply(this, arguments);
    const box = document.getElementById('mkResults');
    if(box){ void box.offsetWidth; box.classList.add('mp-cascade'); }
  };
}

/* заказ на бирже: покупка уже патчена wallet (эскроу+комиссия) — только читаем результат */
const _prevOrderListingMp = orderListing;
orderListing = function(id){
  const holdBefore = WALLET.hold;
  _prevOrderListingMp(id);
  if(WALLET.hold <= holdBefore) return; // оплата не прошла — сделку не регистрируем
  const l = LISTINGS.find(x=>x.id===id);
  if(!l) return;
  const d = {id:'d'+Date.now(), t:l.t, n:l.n, sum:l.p, st:'work', dir:'out', at:Date.now(), lid:l.id, held:true, chatId:'seller-'+id};
  MP.deals.unshift(d);
  mpSave();
  // связка с мессенджером: в диалоге продавца отмечаем эскроу-защиту
  const chat = CHATS.find(c=>c.id==='seller-'+id) || CHATS.find(c=>c.name===l.n);
  if(chat){ d.chatId = chat.id;
    chat.msgs.push({kind:'sys', body:'Заказ оформлен · '+fmtMoney(l.p)+' в эскроу OKO до подтверждения выполнения'});
    chat.preview = 'Эскроу: '+fmtMoney(l.p)+' в холде'; chat.time = nowT();
    if(typeof renderChatList==='function' && document.getElementById('screen-chats')) renderChatList();
  }
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

/* карточка объявления: значок проверенного, «Написать продавцу», меню «Пожаловаться» */
const _prevOpenListingMp = openListing;
openListing = function(id){
  _prevOpenListingMp(id);
  mpDecorateListing(id);
};
function mpDecorateListing(id){
  const l = LISTINGS.find(x=>x.id===id);
  const v = document.getElementById('lstView');
  if(!l || !v) return;
  const bigPhoto = v.querySelector('.lst-photo.big');
  if(bigPhoto && mpIsVerified(l) && !bigPhoto.querySelector('.mp-photo-ver'))
    bigPhoto.insertAdjacentHTML('beforeend', mpVerMini());
  const seller = v.querySelector('.seller-card');
  if(seller){
    const nameEl = seller.querySelector('b');
    if(nameEl && typeof vBadge==='function' && !nameEl.querySelector('svg')) nameEl.insertAdjacentHTML('beforeend', vBadge(l.n));
    if(mpIsVerified(l) && !seller.querySelector('.mp-ver-chip'))
      seller.insertAdjacentHTML('beforeend', `<span class="mp-ver-chip">${I('verified')} Проверенный</span>`);
  }
  if(l.my) return; // на своём объявлении ни чата, ни жалобы
  const write = v.querySelector('.lst-cta .btn:not(.ghost)');
  if(write) write.innerHTML = I('chat')+' Написать продавцу';
  if(!document.getElementById('mpReportBtn')){
    const sent = (MP.reports||[]).some(r=>r.lid===l.id);
    const b = document.createElement('button');
    b.id = 'mpReportBtn';
    b.className = 'mp-report-btn'+(sent?' sent':'');
    b.innerHTML = sent ? I('check')+' Жалоба на рассмотрении модерации'
                       : I('flag')+' Пожаловаться на объявление';
    b.onclick = ()=>mpOpenReport(l.id);
    v.appendChild(b);
  }
}

/* чат с продавцом: автоприветствие при создании/открытии диалога из карточки */
const _prevContactSellerMp = contactSeller;
contactSeller = function(id){
  _prevContactSellerMp(id);
  const l = LISTINGS.find(x=>x.id===id);
  if(!l) return;
  const chat = CHATS.find(c=>c.name===l.n);
  if(!chat) return;
  const greet = 'Здравствуйте! Интересует «'+l.t+'»';
  if(chat.msgs.some(m=>m.kind==='text' && m.body===greet)) return; // уже здоровались по этому объявлению
  if(typeof currentChat!=='undefined' && currentChat===chat && typeof pushMsg==='function'){
    pushMsg({in:0, t:nowT(), kind:'text', body:greet});
  } else {
    chat.msgs.push({in:0, t:nowT(), kind:'text', body:greet});
    chat.preview = 'Ты: '+greet; chat.time = nowT();
  }
};

/* ================= ЖАЛОБА НА ОБЪЯВЛЕНИЕ ================= */
let mpRepLid = null, mpRepReason = null;
const MP_REP_REASONS = ['Мошенничество','Спам и реклама','Запрещённый товар','Цена не соответствует','Оскорбления','Другое'];
function mpOpenReport(id){
  mpRepLid = id; mpRepReason = null;
  mpRenderReport();
  openSheet('mpReport');
}
function mpRenderReport(){
  const l = LISTINGS.find(x=>x.id===mpRepLid);
  const box = document.getElementById('mpReportView');
  if(!l || !box) return;
  const sent = (MP.reports||[]).some(r=>r.lid===l.id);
  box.innerHTML = sent ? `
    <div class="mp-rep-done">${I('flag')}</div>
    <h3 class="mp-rv-title" style="text-align:center">Жалоба на рассмотрении</h3>
    <p class="mp-rv-sub" style="text-align:center">Модерация уже проверяет «${esc(l.t)}». Обычно это занимает до 24 часов.</p>
    <div style="height:14px"></div>
    <button class="btn ghost" onclick="closeSheet()">Понятно</button>`
  : `
    <h3 class="mp-rv-title">Пожаловаться</h3>
    <p class="mp-rv-sub">${esc(l.t)} · ${esc(l.n)}</p>
    <p class="f-lab">Причина жалобы</p>
    <div class="mp-rep-chips" id="mpRepChips">${mpRepChips()}</div>
    <textarea id="mpRepText" class="mp-ta" rows="3" maxlength="240" placeholder="Комментарий для модерации (необязательно)"></textarea>
    <button class="btn" onclick="mpSubmitReport()">${I('flag')} Отправить жалобу</button>
    <p class="mp-rep-note">Жалоба анонимна для продавца и уходит модерации OKO</p>`;
}
function mpRepChips(){
  return MP_REP_REASONS.map((r,i)=>
    `<button class="f-chip ${mpRepReason===r?'on':''}" onclick="mpRepPick(${i})">${r}</button>`).join('');
}
function mpRepPick(i){
  mpRepReason = MP_REP_REASONS[i];
  const el = document.getElementById('mpRepChips');
  if(el) el.innerHTML = mpRepChips(); // перерисовываем только чипы — текст комментария не теряется
}
function mpSubmitReport(){
  const l = LISTINGS.find(x=>x.id===mpRepLid);
  if(!l) return;
  if(!mpRepReason){ toast('Выбери причину жалобы'); return; }
  const txt = ((document.getElementById('mpRepText')||{}).value||'').trim();
  MP.reports.push({lid:l.id, t:l.t, reason:mpRepReason, txt, at:Date.now()});
  mpSave();
  if(typeof ADMIN!=='undefined' && ADMIN.moder){ // chain-доступ к очереди модерации админки
    ADMIN.moder.unshift({t:'Жалоба: «'+l.t+'» — '+mpRepReason, by:'@'+(PROFILE.nick||'user'), kind:'Биржа'});
    if(ADMIN.kpi) ADMIN.kpi.moder = ADMIN.moder.length;
  }
  closeSheet();
  toast('Передано модерации — спасибо, что бережёшь Биржу');
  openListing(mpRepLid); // вернуться в карточку: кнопка уже в статусе «на рассмотрении»
}

/* админка: счётчик и лог жалоб с Биржи во вкладке «Модерация» */
if(typeof admModer==='function'){
  const _prevAdmModerMp = admModer;
  admModer = function(){
    const rep = MP.reports||[];
    const inQ = (typeof ADMIN!=='undefined' && ADMIN.moder) ? ADMIN.moder.filter(m=>(m.t||'').indexOf('Жалоба:')===0).length : 0;
    const rows = rep.slice(-4).reverse().map(r=>`
      <div class="adm-row">
        <span class="adm-tag no">${esc(r.reason)}</span>
        <span class="adm-main"><b style="white-space:normal">${esc(r.t)}</b><small>${esc(r.txt||'без комментария')} · ${mpWhen(r.at)}</small></span>
      </div>`).join('');
    const block = `
      <div class="adm-sec-h">Жалобы с Биржи · всего ${rep.length}${inQ?` · в очереди ${inQ}`:''}</div>
      ${rep.length ? rows : '<p class="dim" style="font-size:13px">Жалоб нет — Биржа чистая.</p>'}`;
    return _prevAdmModerMp() + block;
  };
}

/* ================= ФИЛЬТРЫ: город + «только проверенные» ================= */
if(typeof mkFilters.mpVerif==='undefined') mkFilters.mpVerif = false;
if(typeof mkFilters.city==='undefined')    mkFilters.city   = '';
function mpCities(){
  const seen = [];
  LISTINGS.forEach(l=>{ if(!l.my && l.city && seen.indexOf(l.city)<0) seen.push(l.city); });
  return seen;
}
const _prevMkApplyFiltersMp = mkApplyFilters;
mkApplyFilters = function(arr){
  arr = _prevMkApplyFiltersMp(arr);
  if(mkFilters.city)   arr = arr.filter(l=>l.city===mkFilters.city);
  if(mkFilters.mpVerif) arr = arr.filter(mpIsVerified);
  return arr;
};
const _prevActiveFilterCountMp = activeFilterCount;
activeFilterCount = function(){ return _prevActiveFilterCountMp() + (mkFilters.mpVerif?1:0) + (mkFilters.city?1:0); };
const _prevResetFiltersMp = resetFilters;
resetFilters = function(){ _prevResetFiltersMp(); mkFilters.mpVerif = false; mkFilters.city = ''; };
const _prevRenderFiltersMp = renderFilters;
renderFilters = function(){
  _prevRenderFiltersMp();
  const v = document.getElementById('filtersView');
  if(!v || v.querySelector('.mp-fver-wrap')) return;
  const btnRow = v.lastElementChild; // строка «Сбросить / Показать»
  const cities = mpCities();
  const cityChips = [['','Любой']].concat(cities.map(c=>[c,c]))
    .map(([val,lab])=>`<button class="f-chip ${mkFilters.city===val?'on':''}" onclick="mpSetCity('${val.replace(/'/g,"\\'")}')">${val?I('pos'):''}${lab}</button>`).join('');
  const w = document.createElement('div');
  w.className = 'mp-fver-wrap';
  w.innerHTML = `<p class="f-lab">${I('pos')} Город</p>
    <div class="f-row mp-city-row">${cityChips}</div>
    <p class="f-lab">Продавец</p>
    <button class="f-chip mp-fver ${mkFilters.mpVerif?'on':''}" onclick="mpToggleVerif()">${I('verified')} Только проверенные</button>
    <small>значок OKO или рейтинг продавца 4.8+</small>`;
  v.insertBefore(w, btnRow);
};
function mpKeepPrice(){
  const mn = document.getElementById('fMin'), mx = document.getElementById('fMax');
  if(mn) mkFilters.min = (mn.value||'').replace(/\D/g,'');
  if(mx) mkFilters.max = (mx.value||'').replace(/\D/g,'');
}
function mpToggleVerif(){ mpKeepPrice(); mkFilters.mpVerif = !mkFilters.mpVerif; renderFilters(); }
function mpSetCity(city){ mpKeepPrice(); mkFilters.city = city; renderFilters(); }

/* ================= ФОТО В ОБЪЯВЛЕНИИ (реальная загрузка, downscale, галерея) =================
   База отдаёт .lf-photo как заглушку-тост и не поддерживает фото. Здесь — рабочая загрузка
   с телефона/ПК: FileReader -> canvas-downscale -> dataURL, до 6 фото, превью с удалением,
   рендер на карточках/в детальной, свайп-галерея в карточке. Всё в памяти сессии (LISTINGS
   не персистится в базе — это ок, лишнего в localStorage не пишем). Патчи: openListingForm,
   saveListing, lstPhoto, openListing (галерея). */
const MP_PHOTO_MAX = 6, MP_PHOTO_DIM = 1100;
let mpFormPhotos = [];

/* уменьшаем картинку до MP_PHOTO_DIM по большей стороне -> лёгкий jpeg dataURL */
function mpDownscale(dataUrl){
  return new Promise(res=>{
    const img = new Image();
    img.onload = function(){
      let {width:w, height:h} = img;
      if(!w || !h){ res(dataUrl); return; }
      const k = Math.min(1, MP_PHOTO_DIM/Math.max(w,h));
      w = Math.round(w*k); h = Math.round(h*k);
      try{
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        res(cv.toDataURL('image/jpeg', 0.82));
      }catch(e){ res(dataUrl); }
    };
    img.onerror = ()=>res(dataUrl);
    img.src = dataUrl;
  });
}
function mpReadFile(file){
  return new Promise(res=>{
    if(!file || !/^image\//.test(file.type||'')){ res(null); return; }
    const fr = new FileReader();
    fr.onload = ()=>mpDownscale(fr.result).then(res);
    fr.onerror = ()=>res(null);
    fr.readAsDataURL(file);
  });
}
function mpAddPhotoFiles(files){
  const list = Array.prototype.slice.call(files||[]);
  if(!list.length) return;
  const free = MP_PHOTO_MAX - mpFormPhotos.length;
  if(free<=0){ toast('Можно до '+MP_PHOTO_MAX+' фото'); return; }
  const take = list.slice(0, free);
  if(list.length>free) toast('Добавлено '+free+' — лимит '+MP_PHOTO_MAX+' фото');
  Promise.all(take.map(mpReadFile)).then(arr=>{
    arr.filter(Boolean).forEach(u=>mpFormPhotos.push(u));
    mpRenderFormPhotos();
  });
}
function mpRemoveFormPhoto(i){ mpFormPhotos.splice(i,1); mpRenderFormPhotos(); }
function mpRenderFormPhotos(){
  const grid = document.getElementById('mpFormPhotos');
  if(!grid) return;
  const full = mpFormPhotos.length>=MP_PHOTO_MAX;
  grid.innerHTML = mpFormPhotos.map((u,i)=>`
    <div class="mp-fp-thumb"${i===0?' data-cover="1"':''}>
      <img src="${u}" alt="">
      ${i===0?'<span class="mp-fp-cover">Обложка</span>':''}
      <button type="button" class="mp-fp-del" onclick="mpRemoveFormPhoto(${i})" aria-label="Удалить">${I('trash')}</button>
    </div>`).join('') +
    (full ? '' : `<button type="button" class="mp-fp-add" onclick="document.getElementById('mpPhotoInput').click()">
      ${I('camera')}<span>${mpFormPhotos.length?'Ещё':'Добавить фото'}</span></button>`);
}
function mpMountPhotoUploader(){
  const v = document.getElementById('listingFormView');
  if(!v) return;
  const tile = v.querySelector('.lf-photo');
  if(!tile || document.getElementById('mpFormPhotos')) return;
  const wrap = document.createElement('div');
  wrap.className = 'mp-fp-wrap';
  wrap.innerHTML = `
    <label class="f-lab" style="margin-top:0">Фото объявления <small class="mp-fp-hint">до ${MP_PHOTO_MAX} · первое станет обложкой</small></label>
    <input type="file" id="mpPhotoInput" accept="image/*" multiple hidden>
    <div class="mp-fp-grid" id="mpFormPhotos"></div>`;
  tile.replaceWith(wrap);
  const input = document.getElementById('mpPhotoInput');
  if(input) input.addEventListener('change', function(){ mpAddPhotoFiles(this.files); this.value=''; });
  mpRenderFormPhotos();
}
const _prevOpenListingFormMp = openListingForm;
openListingForm = function(id){
  _prevOpenListingFormMp(id);
  const l = id ? LISTINGS.find(x=>x.id===id) : null;
  mpFormPhotos = (l && Array.isArray(l.photos)) ? l.photos.slice() : [];
  mpMountPhotoUploader();
};
const _prevSaveListingMp = saveListing;
saveListing = function(){
  const wasEditing = (typeof editingListing!=='undefined') ? editingListing : null;
  const before = LISTINGS.length;
  const photos = mpFormPhotos.slice();
  _prevSaveListingMp();
  let target = null;
  if(wasEditing){ target = LISTINGS.find(x=>x.id===wasEditing) || null; }
  else if(LISTINGS.length>before){ target = LISTINGS[0]; } // база unshift-ит новое объявление
  if(target){
    target.photos = photos;
    if(document.getElementById('marketRoot') && typeof openMyListings==='function') openMyListings();
  }
};

/* рендер медиа: если у объявления есть фото — показываем реальную картинку вместо плейсхолдера */
const _prevLstPhotoMp = lstPhoto;
lstPhoto = function(l, big){
  if(l && Array.isArray(l.photos) && l.photos.length){
    const extra = (big && l.photos.length>1) ? `<span class="mp-photo-count">${I('photo')}${l.photos.length}</span>` : '';
    return `<div class="lst-photo${big?' big':''} mp-has-photo"><img src="${l.photos[0]}" alt="" loading="lazy">${extra}</div>`;
  }
  return _prevLstPhotoMp(l, big);
};

/* детальная карточка: свайп-галерея по фото (тап по миниатюре меняет обложку) */
const _prevOpenListingGal = openListing;
openListing = function(id){
  _prevOpenListingGal(id);
  const l = LISTINGS.find(x=>x.id===id);
  const v = document.getElementById('lstView');
  if(!l || !v || !Array.isArray(l.photos) || l.photos.length<2) return;
  const hero = v.querySelector('.lst-photo.big');
  if(!hero || v.querySelector('.mp-gal')) return;
  const strip = document.createElement('div');
  strip.className = 'mp-gal';
  strip.innerHTML = l.photos.map((u,i)=>
    `<button type="button" class="mp-gal-t${i===0?' on':''}" onclick="mpSwapHero(this,'${'i'+id}',${i})"><img src="${u}" alt=""></button>`).join('');
  hero.insertAdjacentElement('afterend', strip);
  strip.dataset.for = id;
};
function mpSwapHero(btn, _tag, i){
  const v = document.getElementById('lstView'); if(!v) return;
  const strip = v.querySelector('.mp-gal'); if(!strip) return;
  const l = LISTINGS.find(x=>x.id=== +strip.dataset.for); if(!l || !l.photos[i]) return;
  const heroImg = v.querySelector('.lst-photo.big img');
  if(heroImg){ heroImg.style.opacity = '0'; setTimeout(()=>{ heroImg.src = l.photos[i]; heroImg.style.opacity=''; }, 120); }
  strip.querySelectorAll('.mp-gal-t').forEach(b=>b.classList.remove('on'));
  if(btn) btn.classList.add('on');
}

/* ================= AVITO-ГЛУБИНА: сохранённые поиски, «вы смотрели», rich-пустые состояния, эскроу-доверие ================= */
/* Всё аддитивно, поверх базовой Биржи. Персист — в том же MP (localStorage oko-market-pro).
   Ничего из существующих потоков не ломаем: поиск/фильтры/избранное/продвижение/кабинет/пакеты работают как были. */
MP.saved  = MP.saved  || [];   // сохранённые поиски: {id,q,cat,sort,filters,at}
MP.recent = MP.recent || [];   // недавно просмотренные объявления: массив id (свежие спереди, cap 10)
try{ mpSave(); }catch(e){}

/* ---------- подпись/сводка/совпадения сохранённого поиска ---------- */
function mpSearchLabel(s){
  const q = (s && s.q || '').trim();
  if(q) return q;
  if(s && s.cat) return catName(s.cat);
  return 'Все объявления';
}
const MP_TYPE_RU = {service:'услуги', work:'работа', goods:'товары'};
/* объявления, подходящие под сохранённый поиск (read-only, не трогает глобальные mkFilters/mkSearchQ) */
function mpMatchListings(s){
  let arr = LISTINGS.filter(l=>!l.my && l.st==='act');
  if(s.cat) arr = arr.filter(l=>l.cat===s.cat);
  const q = (s.q||'').trim().toLowerCase();
  if(q) arr = arr.filter(l=>(l.t+' '+l.ds+' '+l.n+' '+catName(l.cat)).toLowerCase().includes(q));
  const f = s.filters||{};
  if(f.min)    arr = arr.filter(l=>l.p >= +f.min);
  if(f.max)    arr = arr.filter(l=>l.p <= +f.max);
  if(f.rating) arr = arr.filter(l=>l.r >= f.rating);
  if(f.type && f.type!=='all') arr = arr.filter(l=>l.type===f.type);
  if(f.city)   arr = arr.filter(l=>l.city===f.city);
  if(f.mpVerif) arr = arr.filter(mpIsVerified);
  return arr;
}
/* «N новых по подписке» — стабильный псевдо-счётчик (прототип): детерминирован от поиска и числа совпадений */
function mpSavedNew(s){
  const m = mpMatchListings(s).length;
  if(!m) return 0;
  return (Math.floor((s.at||0)/1e5) + m) % 3; // 0..2, но стабильно для конкретного поиска
}
function mpSearchSummary(s){
  const parts = [];
  if(s.q && s.cat) parts.push(catName(s.cat));
  const f = s.filters||{};
  if(f.city)   parts.push(f.city);
  if(f.mpVerif) parts.push('проверенные');
  if(f.type && f.type!=='all') parts.push(MP_TYPE_RU[f.type]||'');
  if(f.min || f.max) parts.push(((f.min?'от '+fmtN(+f.min):'')+(f.max?' до '+fmtN(+f.max):'')).trim()+' ₽');
  if(f.rating) parts.push('от '+f.rating+' звёзд');
  parts.push(mpMatchListings(s).length+' предлож.');
  return parts.filter(Boolean).join(' · ');
}

/* ---------- сигнатура текущего состояния поиска (для «уже сохранён»/дедуп) ---------- */
function mpCurFilters(){
  return {min:mkFilters.min||'', max:mkFilters.max||'', rating:mkFilters.rating||0,
    type:mkFilters.type||'all', city:mkFilters.city||'', mpVerif:!!mkFilters.mpVerif};
}
function mpSig(q, cat, f){
  return JSON.stringify([(q||'').trim(), cat||'',
    {min:f.min||'', max:f.max||'', rating:f.rating||0, type:f.type||'all', city:f.city||'', mpVerif:!!f.mpVerif}]);
}
function mpSearchMeaningful(){
  const f = mkFilters;
  const hasF = f.min || f.max || f.rating || (f.type && f.type!=='all') || f.city || f.mpVerif;
  return !!((mkSearchQ && mkSearchQ.trim()) || mkCat || hasF);
}
function mpSearchAlreadySaved(){
  const cur = mpSig(mkSearchQ, mkCat, mpCurFilters());
  return (MP.saved||[]).some(s=>mpSig(s.q, s.cat, s.filters||{})===cur);
}

/* ---------- сохранить / перезапустить / удалить поиск ---------- */
function mpSaveSearch(){
  if(!mpSearchMeaningful()){ toast('Задай запрос или фильтры, чтобы сохранить поиск'); return; }
  if(mpSearchAlreadySaved()){ toast('Такой поиск уже сохранён'); return; }
  MP.saved.unshift({id:'s'+Date.now(), q:(mkSearchQ||'').trim(), cat:mkCat||null,
    sort:mkSort, filters:mpCurFilters(), at:Date.now()});
  if(MP.saved.length>12) MP.saved.length = 12;
  mpSave();
  toast('Поиск сохранён — уведомим о новых предложениях');
  const b = document.getElementById('mpSaveBtn');
  if(b){ b.classList.add('saved'); b.innerHTML = I('check')+' Поиск сохранён'; }
  const h = document.querySelector('#mpSaveBar .mp-savebar-hint');
  if(h) h.textContent = 'Уведомим о новых';
}
function mpRunSaved(id){
  const s = (MP.saved||[]).find(x=>x.id===id);
  if(!s) return;
  mkView = 'list'; mkCat = s.cat||null; mkSearchQ = s.q||'';
  if(s.sort) mkSort = s.sort;
  const f = s.filters||{};
  mkFilters.min = f.min||''; mkFilters.max = f.max||''; mkFilters.rating = f.rating||0;
  mkFilters.type = f.type||'all'; mkFilters.city = f.city||''; mkFilters.mpVerif = !!f.mpVerif;
  renderMarket();
}
function mpRemoveSaved(id){
  MP.saved = (MP.saved||[]).filter(x=>x.id!==id);
  mpSave();
  toast('Поиск удалён');
  if(document.getElementById('marketRoot') && typeof mkView!=='undefined' && mkView==='cats') renderMarket();
}

/* ---------- недавно просмотренные ---------- */
function mpTrackRecent(id){
  const l = LISTINGS.find(x=>x.id===id);
  if(!l || l.my) return; // свои объявления в «вы смотрели» не показываем
  MP.recent = (MP.recent||[]).filter(x=>x!==id);
  MP.recent.unshift(id);
  if(MP.recent.length>10) MP.recent.length = 10;
  mpSave();
}
function mpRecentListings(){
  return (MP.recent||[]).map(id=>LISTINGS.find(l=>l.id===id)).filter(l=>l && !l.my).slice(0,10);
}
function mpRecentThumb(l){
  if(Array.isArray(l.photos) && l.photos.length) return `<img src="${l.photos[0]}" alt="" loading="lazy">`;
  const hue = (l.seed*37)%360;
  return `<span class="mp-rc-ico" style="--h:${hue}deg">${I(catIco(l.cat))}</span>`;
}

/* ---------- инъекция «сохранённые поиски» + «вы смотрели» на домашней Бирже (cats) ---------- */
const _mpInjectMarketPrev = mpInjectMarket;
mpInjectMarket = function(){
  _mpInjectMarketPrev.apply(this, arguments);
  try{ mpInjectRecentSaved(); }catch(e){}
};
function mpInjectRecentSaved(){
  const anchor = document.getElementById('mpBanner') || document.getElementById('mpCabRow');
  if(!anchor) return;
  let after = anchor;
  /* сохранённые поиски */
  if(!document.getElementById('mpSaved')){
    const saved = MP.saved||[];
    if(saved.length){
      const el = document.createElement('div');
      el.id = 'mpSaved'; el.className = 'mp-saved';
      el.innerHTML = `<div class="mp-strip-h">${I('bookmark')} Сохранённые поиски</div>
        <div class="mp-saved-row">${saved.map(s=>{
          const nw = mpSavedNew(s);
          return `<div class="mp-ss">
            <button class="mp-ss-run" onclick="mpRunSaved('${s.id}')">
              <span class="mp-ss-t">${esc(mpSearchLabel(s))}</span>
              <span class="mp-ss-s">${esc(mpSearchSummary(s))}</span>
              ${nw?`<span class="mp-ss-new">${I('bell')} +${nw} новых</span>`:''}
            </button>
            <button class="mp-ss-x" onclick="event.stopPropagation();mpRemoveSaved('${s.id}')" aria-label="Удалить поиск">${I('trash')}</button>
          </div>`;
        }).join('')}</div>`;
      after.insertAdjacentElement('afterend', el);
      after = el;
    }
  } else after = document.getElementById('mpSaved');
  /* недавно просмотренные */
  if(!document.getElementById('mpRecent')){
    const rec = mpRecentListings();
    if(rec.length){
      const el = document.createElement('div');
      el.id = 'mpRecent'; el.className = 'mp-recent';
      el.innerHTML = `<div class="mp-strip-h">${I('clock')} Вы смотрели</div>
        <div class="mp-recent-row">${rec.map(l=>`
          <button class="mp-rc" onclick="openListing(${l.id})">
            <span class="mp-rc-ph">${mpRecentThumb(l)}</span>
            <span class="mp-rc-p">${esc(l.pt)}</span>
            <span class="mp-rc-t">${esc(l.t)}</span>
          </button>`).join('')}</div>`;
      after.insertAdjacentElement('afterend', el);
    }
  }
}

/* ---------- кнопка «Сохранить поиск» под тулбаром списка ---------- */
if(typeof renderMarketList==='function'){
  const _mpRMLsave = renderMarketList;
  renderMarketList = function(){
    _mpRMLsave.apply(this, arguments);
    try{ mpInjectSaveBtn(); }catch(e){}
  };
}
function mpInjectSaveBtn(){
  const root = document.getElementById('marketRoot');
  if(!root) return;
  if(typeof mkView!=='undefined' && mkView==='fav') return; // в избранном сохранять нечего
  if(document.getElementById('mpSaveBar')) return;
  const bar = root.querySelector('.mk-toolbar');
  if(!bar || !mpSearchMeaningful()) return;
  const saved = mpSearchAlreadySaved();
  const w = document.createElement('div');
  w.id = 'mpSaveBar'; w.className = 'mp-savebar';
  w.innerHTML = `<button id="mpSaveBtn" class="mp-savebar-btn${saved?' saved':''}" onclick="mpSaveSearch()">
      ${saved ? I('check')+' Поиск сохранён' : I('bookmark')+' Сохранить поиск'}</button>
    <span class="mp-savebar-hint">${saved?'Уведомим о новых':'Сохраните — пришлём новые раньше всех'}</span>`;
  bar.insertAdjacentElement('afterend', w);
}

/* ---------- rich-пустые состояния (избранное / 0 результатов) ---------- */
function mpEmpBadge(ic){ return `<span class="mp-emp-badge">${I(ic)}</span>`; }
function mpRichEmpty(){
  const box = document.getElementById('mkResults');
  if(!box) return;
  const empty = box.querySelector('.mk-empty');
  if(!empty || box.querySelector('.mp-emp')) return; // либо результаты есть, либо уже нарисовано
  const fav = (typeof mkView!=='undefined' && mkView==='fav');
  if(fav){
    box.innerHTML = `<div class="mp-emp">
      ${mpEmpBadge('heart')}
      <b>В избранном пусто</b>
      <p>Нажимай на сердечко у объявлений — они появятся здесь, чтобы вернуться к ним позже.</p>
      <button class="btn" onclick="mkView='list';mkCat=null;mkSearchQ='';renderMarket()">${I('search')} Смотреть объявления</button>
    </div>`;
    return;
  }
  const cats = MK_CATS.filter(c=>LISTINGS.some(l=>l.cat===c.k && !l.my && l.st==='act')).slice(0,4);
  const hasF = (typeof activeFilterCount==='function' && activeFilterCount()>0);
  const hasQ = !!(mkSearchQ && mkSearchQ.trim());
  box.innerHTML = `<div class="mp-emp">
    ${mpEmpBadge('search')}
    <b>Ничего не найдено</b>
    <p>${hasQ?'По запросу «'+esc(mkSearchQ.trim())+'» ничего нет. ':''}Попробуй изменить запрос${hasF?' или сбросить фильтры':''}.</p>
    ${hasF?`<button class="btn ghost" onclick="mpEmptyReset()">${I('poll')} Сбросить фильтры</button>`:''}
    ${cats.length?`<div class="mp-emp-lab">Популярные категории</div>
      <div class="mp-emp-cats">${cats.map(c=>`<button class="mp-emp-cat" onclick="mpEmptyGoCat('${c.k}')">${I(c.ic)}<span>${c.name}</span></button>`).join('')}</div>`:''}
    ${(hasQ||hasF)?`<button class="mp-emp-save" onclick="mpSaveSearch()">${I('bell')} Сохранить поиск и получать новые предложения</button>`:''}
  </div>`;
}
function mpEmptyReset(){
  if(typeof resetFilters==='function') resetFilters();
  renderMarketList(document.getElementById('marketRoot'), typeof mkView!=='undefined' && mkView==='fav');
}
function mpEmptyGoCat(k){
  if(typeof resetFilters==='function') resetFilters();
  mkSearchQ = '';
  if(typeof openMarketCat==='function') openMarketCat(k);
}
/* оборачиваем soft-рендер (уже пропатчен модулем) — дорисовываем rich-пустое после базового */
if(typeof renderMarketListSoft==='function'){
  const _mpRMLSempty = renderMarketListSoft;
  renderMarketListSoft = function(){
    _mpRMLSempty.apply(this, arguments);
    try{ mpRichEmpty(); }catch(e){}
  };
}

/* ---------- rich-пустое состояние «Мои объявления» ---------- */
if(typeof openMyListings==='function'){
  const _mpOpenMyListings = openMyListings;
  openMyListings = function(){
    _mpOpenMyListings.apply(this, arguments);
    try{ mpRichSellerEmpty(); }catch(e){}
  };
}
function mpRichSellerEmpty(){
  const root = document.getElementById('marketRoot');
  if(!root) return;
  const empty = root.querySelector('.mk-empty');
  if(!empty || root.querySelector('.mp-emp')) return;
  const trailing = empty.nextElementSibling; // базовая кнопка «Разместить объявление» — убираем дубль
  empty.outerHTML = `<div class="mp-emp seller">
    ${mpEmpBadge('briefcase')}
    <b>У тебя ещё нет объявлений</b>
    <p>Размести первую услугу или товар бесплатно — покупатели с Биржи найдут тебя сами, а сделки защитит эскроу OKO.</p>
    <button class="btn" onclick="openListingForm()">${I('plus')} Разместить объявление</button>
  </div>`;
  if(trailing && trailing.tagName==='BUTTON') trailing.remove();
}

/* ---------- доверие покупателю на карточке: эскроу + «на OKO с …» / отклик ---------- */
const MP_REPLY_RU = ['несколько минут','час','пару часов'];
function mpSellerSince(l){ return 2019 + (l.seed%6); }        // «на OKO с 2019…2024» — стабильно от seed
function mpSellerRate(l){ return 90 + (l.seed%9); }           // 90…98% ответов
function mpSellerReply(l){ return MP_REPLY_RU[l.seed%3]; }
function mpTrustBlock(l){
  return `<div class="mp-trust" id="mpTrust">
    <div class="mp-trust-head">
      <span class="mp-trust-ic">${I('lock')}</span>
      <div class="mp-trust-b"><b>Безопасная сделка через эскроу OKO</b>
        <small>Деньги замораживаются на счёте OKO и уходят исполнителю только после того, как вы подтвердите выполнение. При споре — возврат.</small></div>
    </div>
    <div class="mp-trust-row">
      <span>${I('check')} Возврат при спорах</span>
      <span>${I('lock')} Защита платежа</span>
    </div>
  </div>`;
}
/* трекинг «вы смотрели» + блок доверия — финальная обёртка openListing (после декора/галереи) */
const _mpOpenListingTrust = openListing;
openListing = function(id){
  _mpOpenListingTrust.apply(this, arguments);
  try{ mpTrackRecent(id); }catch(e){}
  try{
    const l = LISTINGS.find(x=>x.id===id);
    const v = document.getElementById('lstView');
    if(!l || !v || l.my) return; // на своей карточке эскроу-подсказки покупателю не нужны
    /* строка о продавце в карточке продавца */
    const seller = v.querySelector('.seller-card');
    if(seller && !seller.querySelector('.mp-seller-meta')){
      const info = (seller.querySelector('b') && seller.querySelector('b').parentElement) || seller;
      info.insertAdjacentHTML('beforeend',
        `<div class="mp-seller-meta">${I('crown')} на OKO с ${mpSellerSince(l)} · ${I('chat')} отвечает за ${mpSellerReply(l)} · ${mpSellerRate(l)}% ответов</div>`);
    }
    /* блок эскроу-доверия над кнопками действий */
    if(!document.getElementById('mpTrust')){
      const cta = v.querySelector('.lst-cta');
      if(cta) cta.insertAdjacentHTML('beforebegin', mpTrustBlock(l));
      else v.insertAdjacentHTML('beforeend', mpTrustBlock(l));
    }
  }catch(e){}
};

/* ================= ДИСКРЕТНАЯ СОРТИРОВКА: видимые чипы вместо слепого циклера =================
   База показывает одну кнопку cycleSort — тап вслепую меняет режим по кругу, режимов не видно.
   Заменяем на строку чипов со всеми режимами MK_SORTS: активный подсвечен, тап ставит режим
   напрямую. Базовую кнопку прячем (не удаляем — она пересоздаётся в innerHTML базой). */
const MP_SORT_IC = {pop:'fire', cheap:'chev', exp:'chev', rating:'star', new:'bolt'};
function mpSetSort(k){
  if(typeof mkSort==='undefined' || mkSort===k) return;
  mkSort = k;
  renderMarketList(document.getElementById('marketRoot'), typeof mkView!=='undefined' && mkView==='fav');
}
function mpInjectSortBar(){
  const root = document.getElementById('marketRoot');
  if(!root || typeof MK_SORTS==='undefined') return;
  const bar = root.querySelector('.mk-toolbar');
  if(!bar) return;
  const cyc = bar.querySelector('.mk-tool[onclick*="cycleSort"]'); // слепой циклер базы — прячем
  if(cyc) cyc.style.display = 'none';
  if(document.getElementById('mpSortBar')) return;
  const w = document.createElement('div');
  w.id = 'mpSortBar'; w.className = 'mp-sortbar';
  w.innerHTML = `<div class="mp-sort-row">${MK_SORTS.map(s=>{
    const dir = s[0]==='cheap' ? ' dn' : s[0]==='exp' ? ' up' : '';
    return `<button class="mp-sc${mkSort===s[0]?' on':''}${dir}" onclick="mpSetSort('${s[0]}')">${I(MP_SORT_IC[s[0]]||'poll')}${s[1]}</button>`;
  }).join('')}</div>`;
  bar.insertAdjacentElement('afterend', w); // сразу под тулбаром (перед mpSaveBar, если он есть)
}
if(typeof renderMarketList==='function'){
  const _mpRMLsort = renderMarketList;
  renderMarketList = function(){
    _mpRMLsort.apply(this, arguments);
    try{ mpInjectSortBar(); }catch(e){}
  };
}

/* ================= ПОХОЖИЕ ОБЪЯВЛЕНИЯ (кросс-продажа на детальной карточке) =================
   Классический маркетплейс-приём: под объявлением — лента похожих. Ранжируем по близости
   (та же категория -> тот же тип -> продвижение/рейтинг/просмотры) и расширяем по всему
   каталогу, чтобы лента была не пустой даже когда в категории мало предложений. */
function mpSimilar(l){
  const rank = p => (typeof promoRank==='function' ? promoRank(p) : 0);
  const arr = LISTINGS.filter(x=>!x.my && x.st==='act' && x.id!==l.id);
  arr.sort((a,b)=>
    ((b.cat===l.cat)-(a.cat===l.cat)) ||
    ((b.type===l.type)-(a.type===l.type)) ||
    (rank(b.promo)-rank(a.promo)) ||
    ((b.r||0)-(a.r||0)) ||
    ((b.views||0)-(a.views||0)));
  return arr.slice(0,8);
}
function mpSimilarBlock(l){
  const sim = mpSimilar(l);
  if(sim.length<2) return '';
  return `<div class="mp-sim" id="mpSim">
    <div class="mp-strip-h">${I('grid')} Похожие объявления</div>
    <div class="mp-recent-row">${sim.map(s=>`
      <button class="mp-rc" onclick="openListing(${s.id})">
        <span class="mp-rc-ph">${mpRecentThumb(s)}${s.r?`<span class="mp-rc-rate">${I('star')}${s.r.toFixed(1)}</span>`:''}</span>
        <span class="mp-rc-p">${esc(s.pt)}</span>
        <span class="mp-rc-t">${esc(s.t)}</span>
      </button>`).join('')}</div>
  </div>`;
}
const _mpOpenListingSim = openListing;
openListing = function(id){
  _mpOpenListingSim.apply(this, arguments);
  try{
    const l = LISTINGS.find(x=>x.id===id);
    const v = document.getElementById('lstView');
    if(!l || !v || l.my || document.getElementById('mpSim')) return;
    v.insertAdjacentHTML('beforeend', mpSimilarBlock(l));
  }catch(e){}
};

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
if(document.getElementById('ma-market') && document.getElementById('ma-market').style.display==='block') renderMarket();
