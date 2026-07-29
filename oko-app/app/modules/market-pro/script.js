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
      <p>Флагманская услуга «под ключ» от команды OKO: контент, дизайн, сайт и реклама, делаем мы, растёшь ты.</p>
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
    toast('Пакет «'+p.name+'» оплачен, чат с командой создан');
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
      <span class="mp-banner-t">OKO <b>PRODUCTION</b>, под ключ</span>
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
    ${(hasQ||hasF)?`<button class="mp-emp-save" onclick="mpSaveSearch()">${I('bell')} Сохранить поиск</button>`:''}
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

/* ================= AVITO-МЕХАНИКИ v2: отзыв-плашка, портфолио продавца, быстрые чипы,
   цветной индикатор ответа, попап «как работает эскроу». Всё аддитивно, поверх базовой Биржи. */

/* ---------- индикатор ответа: скорость + цвет + минуты ---------- */
function mpReplyMeta(l){
  const k = l.seed % 3;
  if(k===0){ const m = 10 + (l.seed%16); return {cls:'fast', lab:'отвечает за '+m+' мин', short:'за '+m+' мин'}; }
  if(k===1){ return {cls:'mid', lab:'отвечает в течение часа', short:'за 1 ч'}; }
  const h = 2 + (l.seed%3); return {cls:'slow', lab:'отвечает за '+h+' ч', short:'за '+h+' ч'};
}
function mpIsFast(l){ return mpReplyMeta(l).cls==='fast'; }
function mpIsOnline(l){ return (l.seed%2)===0; }
function mpHasReviews(l){ return Array.isArray(l.reviews) && l.reviews.length>0; }

/* ---------- плашка «Отзыв продавца»: рейтинг + число + одна цитата ---------- */
function mpTopReview(l){
  const rv = l.reviews||[];
  if(!rv.length) return null;
  return rv.slice().sort((a,b)=>(b.r-a.r) || ((b.t||'').length-(a.t||'').length))[0];
}
function mpSellerReviewCard(l){
  if(!mpHasReviews(l)) return '';
  const top = mpTopReview(l);
  const rv = l.reviews||[];
  const cnt = rv.length;
  const word = cnt%10===1 && cnt%100!==11 ? 'отзыв'
             : (cnt%10>=2 && cnt%10<=4 && (cnt%100<10||cnt%100>=20)) ? 'отзыва' : 'отзывов';
  return `<div class="mp-srv" id="mpSrv">
    <div class="mp-srv-head">
      <span class="mp-srv-big"><b>${l.r.toFixed(1)}</b>${I('star')}</span>
      <div class="mp-srv-b">
        <b>Отзывы о продавце</b>
        <small>${stars(l.r)} · ${cnt} ${word}</small>
      </div>
    </div>
    <div class="mp-srv-quote">
      ${I('comment')}
      <div><p>«${esc(top.t)}»</p><small>${esc(top.n)} · ${stars(top.r)}</small></div>
    </div>
  </div>`;
}

/* ---------- портфолио продавца: другие услуги того же n ---------- */
function mpSellerOther(l){
  return LISTINGS.filter(x=>x.n===l.n && x.id!==l.id && !x.my && x.st==='act').slice(0,6);
}
function mpPortfolioBlock(l){
  const arr = mpSellerOther(l);
  if(!arr.length) return '';
  return `<div class="mp-portf" id="mpPortf">
    <div class="mp-strip-h">${I('grid')} Портфолио продавца · ${arr.length}</div>
    <div class="mp-recent-row">${arr.map(s=>`
      <button class="mp-rc" onclick="openListing(${s.id})">
        <span class="mp-rc-ph">${mpRecentThumb(s)}${s.r?`<span class="mp-rc-rate">${I('star')}${s.r.toFixed(1)}</span>`:''}</span>
        <span class="mp-rc-p">${esc(s.pt)}</span>
        <span class="mp-rc-t">${esc(s.t)}</span>
      </button>`).join('')}</div>
  </div>`;
}

/* ---------- инъекция плашки отзывов + портфолио в карточку объявления ---------- */
const _mpOpenListingRev2 = openListing;
openListing = function(id){
  _mpOpenListingRev2.apply(this, arguments);
  try{
    const l = LISTINGS.find(x=>x.id===id);
    const v = document.getElementById('lstView');
    if(!l || !v) return;
    /* плашка отзывов сразу после карточки продавца */
    const seller = v.querySelector('.seller-card');
    if(seller && !v.querySelector('#mpSrv')){
      const html = mpSellerReviewCard(l);
      if(html) seller.insertAdjacentHTML('afterend', html);
    }
    /* индикатор ответа: цветной чип + онлайн-точка — заменяем текстовую meta-строку */
    const meta = v.querySelector('.mp-seller-meta');
    if(meta && !meta.querySelector('.mp-reply')){
      const r = mpReplyMeta(l);
      const on = mpIsOnline(l);
      const onlineChip = on
        ? `<span class="mp-online on">онлайн сейчас</span>`
        : `<span class="mp-online off">был ${1+(l.seed%9)} ч назад</span>`;
      const rateN = (typeof mpSellerRate==='function') ? mpSellerRate(l) : 95;
      const since = (typeof mpSellerSince==='function') ? mpSellerSince(l) : 2020;
      meta.innerHTML = `
        <span class="mp-reply ${r.cls}">${I('clock')} ${r.lab}</span>
        ${onlineChip}
        <span class="mp-meta-dot">${I('crown')} на OKO с ${since} · ${rateN}% ответов</span>`;
    }
    /* портфолио продавца — перед похожими объявлениями (или в конец) */
    if(!l.my && !v.querySelector('#mpPortf')){
      const html = mpPortfolioBlock(l);
      if(html){
        const sim = v.querySelector('#mpSim');
        if(sim) sim.insertAdjacentHTML('beforebegin', html);
        else v.insertAdjacentHTML('beforeend', html);
      }
    }
    /* делаем эскроу-блок кликабельным + добавляем строку-подсказку */
    const trust = v.querySelector('#mpTrust');
    if(trust && !trust.classList.contains('clickable')){
      trust.classList.add('clickable');
      trust.setAttribute('role','button');
      trust.setAttribute('tabindex','0');
      trust.addEventListener('click', mpEscInfoOpen);
      trust.addEventListener('keydown', e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); mpEscInfoOpen(); } });
      const row = trust.querySelector('.mp-trust-row');
      if(row && !row.querySelector('.mp-trust-more'))
        row.insertAdjacentHTML('beforeend',
          `<span class="mp-trust-more">${I('chev')} как это работает</span>`);
    }
  }catch(e){}
};

/* ---------- попап «Как работает безопасная сделка» ---------- */
const MP_ESC_STEPS = [
  ['card',      'Оплата',    'Ты платишь с кошелька OKO. Деньги замораживаются на счёте площадки — исполнитель их пока не видит.'],
  ['briefcase', 'Работа',    'Исполнитель принимает заказ и начинает работу. В любой момент можно писать в чат по сделке — он в разделе Кабинет.'],
  ['eye',       'Проверка',  'Готовую работу исполнитель сдаёт. У тебя есть время всё проверить: сделка на холде, деньги ещё у OKO.'],
  ['check',     'Выплата',   'Всё нравится — подтверждаешь получение. Только тогда деньги уходят исполнителю, а тебя просят оставить отзыв.'],
  ['flag',      'Спор',      'Что-то не так — открываешь спор. Модерация OKO разбирает переписку и возвращает деньги, если работа не выполнена.'],
];
function mpEscInfoOpen(){
  if(document.getElementById('mpEscModal')) return;
  const wrap = document.createElement('div');
  wrap.id = 'mpEscModal';
  wrap.className = 'mp-escm';
  wrap.innerHTML = `
    <div class="mp-escm-back" onclick="mpEscInfoClose()"></div>
    <div class="mp-escm-card" role="dialog" aria-label="Безопасная сделка">
      <button class="mp-escm-x" onclick="mpEscInfoClose()" aria-label="Закрыть">${I('back')}</button>
      <div class="mp-escm-head">
        <span class="mp-escm-ic">${I('lock')}</span>
        <div><b>Безопасная сделка</b><small>Эскроу через кошелёк OKO · комиссия 10% только с продавца</small></div>
      </div>
      <div class="mp-escm-list">
        ${MP_ESC_STEPS.map((s,i)=>`
          <div class="mp-escm-step">
            <span class="mp-escm-n">${i+1}</span>
            <div class="mp-escm-b">
              <b>${I(s[0])} ${s[1]}</b>
              <p>${s[2]}</p>
            </div>
          </div>`).join('')}
      </div>
      <div class="mp-escm-foot">
        ${I('check')} <span>Возврат при спорах гарантирован — деньги хранятся на счёте OKO до подтверждения.</span>
      </div>
      <button class="btn" onclick="mpEscInfoClose()">Понятно</button>
    </div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(()=>wrap.classList.add('open'));
  document.addEventListener('keydown', mpEscKey);
}
function mpEscInfoClose(){
  const w = document.getElementById('mpEscModal');
  if(!w) return;
  w.classList.remove('open');
  document.removeEventListener('keydown', mpEscKey);
  setTimeout(()=>{ if(w.parentNode) w.parentNode.removeChild(w); }, 220);
}
function mpEscKey(e){ if(e.key==='Escape') mpEscInfoClose(); }

/* ================= БЫСТРЫЕ ЧИПЫ: онлайн, с отзывами, быстрый ответ ================= */
if(typeof mkFilters.mpOnline==='undefined')  mkFilters.mpOnline  = false;
if(typeof mkFilters.mpHasRev==='undefined')  mkFilters.mpHasRev  = false;
if(typeof mkFilters.mpFast==='undefined')    mkFilters.mpFast    = false;

const _prevMkApplyFiltersQuick = mkApplyFilters;
mkApplyFilters = function(arr){
  arr = _prevMkApplyFiltersQuick(arr);
  if(mkFilters.mpOnline) arr = arr.filter(mpIsOnline);
  if(mkFilters.mpHasRev) arr = arr.filter(mpHasReviews);
  if(mkFilters.mpFast)   arr = arr.filter(mpIsFast);
  return arr;
};
const _prevActiveFilterCountQuick = activeFilterCount;
activeFilterCount = function(){
  return _prevActiveFilterCountQuick()
    + (mkFilters.mpOnline?1:0) + (mkFilters.mpHasRev?1:0) + (mkFilters.mpFast?1:0);
};
const _prevResetFiltersQuick = resetFilters;
resetFilters = function(){
  _prevResetFiltersQuick();
  mkFilters.mpOnline = false; mkFilters.mpHasRev = false; mkFilters.mpFast = false;
};
function mpToggleQuick(k){
  mkFilters[k] = !mkFilters[k];
  renderMarketList(document.getElementById('marketRoot'), typeof mkView!=='undefined' && mkView==='fav');
}
function mpInjectQuickChips(){
  const root = document.getElementById('marketRoot');
  if(!root) return;
  if(document.getElementById('mpQuickChips')) return;
  const bar = root.querySelector('.mk-toolbar');
  if(!bar) return;
  const w = document.createElement('div');
  w.id = 'mpQuickChips'; w.className = 'mp-qchips';
  const chip = (k, ic, lab) =>
    `<button class="mp-qc${mkFilters[k]?' on':''}" onclick="mpToggleQuick('${k}')">${I(ic)}<span>${lab}</span></button>`;
  w.innerHTML = `<div class="mp-qc-row">
    ${chip('mpOnline', 'circle-play', 'Онлайн сейчас')}
    ${chip('mpHasRev', 'star',        'С отзывами')}
    ${chip('mpFast',   'bolt',        'Быстрый ответ')}
  </div>`;
  bar.insertAdjacentElement('afterend', w);
}
if(typeof renderMarketList==='function'){
  const _mpRMLquick = renderMarketList;
  renderMarketList = function(){
    _mpRMLquick.apply(this, arguments);
    try{ mpInjectQuickChips(); }catch(e){}
  };
}

/* ================================================================================
   MARKET-PRO v3 · биржа услуг уровня Avito + Fiverr + Upwork
   Всё аддитивно поверх базовой Биржи и уже подключённых патчей market-pro.
   9 больших блоков (см. mpV3-заголовки ниже). Персист — тот же MP (localStorage).
   ================================================================================ */

/* ---------- ЕДИНАЯ БАЗА ДАННЫХ V3 (миграция без потерь) ---------- */
MP.revealedTg   = MP.revealedTg   || {};       // {lid: '@nickname'} — оплаченные раскрытия TG
MP.tgRevealCount= MP.tgRevealCount|| 0;
MP.bumps        = MP.bumps        || {};       // {lid: expiresAt}    — активные bump'ы (24ч)
MP.searchHist   = MP.searchHist   || [];       // ['ролики', ...]     — история поиска
try{ mpSave(); }catch(e){}

/* ---------- SVG-ЩИТ ВЕРИФИКАЦИИ (свой символ, чтобы не завязываться на i-verified размер) ---------- */
(function mpAddShieldSymbol(){
  const defs = document.querySelector('svg defs');
  if(!defs || document.getElementById('i-mpshield')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
  s.setAttribute('id','i-mpshield'); s.setAttribute('viewBox','0 0 100 100');
  s.innerHTML = '<path d="M50 8 18 22v28c0 20 14 34 32 42 18-8 32-22 32-42V22z"/>';
  defs.appendChild(s);
  const t = document.createElementNS('http://www.w3.org/2000/svg','symbol');
  t.setAttribute('id','i-mptg'); t.setAttribute('viewBox','0 0 100 100');
  t.innerHTML = '<circle cx="50" cy="50" r="42" fill="currentColor" stroke="none"/><path d="M28 51l40-17c2-1 3 0 2 2l-6 30c-1 2-2 3-4 2l-11-8-5 5c-1 1-2 1-3-1l-2-12 26-24-30 20-8-3c-2-1-2-2 1-3z" fill="#0d0d0d" stroke="none"/>';
  defs.appendChild(t);
})();

/* ============================================================
   A · SAFE DEAL — компактный 3-шаговый визуал на карточке
   ============================================================ */
const MP_SAFE_STEPS = [
  ['card',      'Заказ',      'выбираешь услугу и оформляешь безопасно'],
  ['lock',      'Предоплата', 'деньги замораживаются в эскроу OKO'],
  ['check',     'Приёмка',    'работа сдана — подтверждаешь, деньги уходят исполнителю'],
];
function mpSafeMini(){
  return `<div class="mp-safe" id="mpSafe" role="button" tabindex="0" onclick="mpEscInfoOpen()">
    <div class="mp-safe-h">
      <span class="mp-safe-ic">${I('lock')}</span>
      <div class="mp-safe-b">
        <b>Безопасная сделка · 3 шага</b>
        <small>Эскроу OKO защищает деньги · возврат при спорах</small>
      </div>
      <span class="mp-safe-more">${I('chev')}</span>
    </div>
    <div class="mp-safe-line">
      ${MP_SAFE_STEPS.map((s,i)=>`
        <div class="mp-safe-step">
          <span class="mp-safe-dot">${I(s[0])}</span>
          <b>${s[1]}</b>
          <small>${s[2]}</small>
        </div>
        ${i<MP_SAFE_STEPS.length-1?'<span class="mp-safe-arrow"></span>':''}
      `).join('')}
    </div>
  </div>`;
}

/* ============================================================
   B · СВЯЗАТЬСЯ: OKO-чат (главная CTA) + Показать TG (платно 100 ₽)
   ============================================================ */
const MP_TG_PRICE = 100;
function mpFakeTg(l){
  /* стабильный ник от seed */
  const alph = 'abcdefghijklmnopqrstuvwxyz';
  let s = ''; let n = (l.seed||1) * 9301 + 49297;
  const nick = (l.n||'user').split(' ')[0].toLowerCase().replace(/[^a-z]/g,'');
  const base = nick.length>2 ? nick : 'oko';
  for(let i=0;i<4;i++){ n = (n*9301+49297) % 233280; s += alph[n%26]; }
  return '@'+base+'_'+s;
}
function mpTgMasked(l){
  const full = mpFakeTg(l);
  return full.slice(0, Math.min(full.length, 4)) + '•••';
}
function mpContactBlock(l){
  const revealed = MP.revealedTg[l.id];
  const tgLine = revealed
    ? `<button class="mp-tg-row revealed" onclick="mpTgCopy('${l.id}')">
         <span class="mp-tg-ic">${I('mptg')}</span>
         <div class="mp-tg-b"><b>${esc(revealed)}</b><small>Telegram · нажми, чтобы скопировать</small></div>
         <span class="mp-tg-hint">${I('copy')}</span>
       </button>`
    : `<button class="mp-tg-row" onclick="mpTgReveal(${l.id})">
         <span class="mp-tg-ic locked">${I('lock')}</span>
         <div class="mp-tg-b"><b>Показать Telegram · ${mpTgMasked(l)}</b><small>Разовое раскрытие контакта продавца · ${MP_TG_PRICE} ₽ с кошелька</small></div>
         <span class="mp-tg-price">${MP_TG_PRICE} ₽</span>
       </button>`;
  return `<div class="mp-contact" id="mpContact">
    <div class="mp-strip-h">${I('chat')} Связаться с продавцом</div>
    <button class="btn mp-contact-cta" onclick="mpChatFromContact(${l.id})">${I('chat')} Написать в OKO-чат</button>
    <p class="mp-contact-sub">${I('lock')} Все сообщения по этому объявлению защищены эскроу · рекомендуем.</p>
    ${tgLine}
  </div>`;
}
function mpChatFromContact(id){ if(typeof contactSeller==='function') contactSeller(id); }
function mpTgReveal(id){
  const l = LISTINGS.find(x=>x.id===id); if(!l) return;
  if(MP.revealedTg[id]) return; // уже открыт
  showPopup({ico:'mptg', title:'Показать номер Telegram?',
    body:'Разовое раскрытие контакта продавца «'+esc(l.n)+'» — <b>'+MP_TG_PRICE+' ₽</b> с кошелька OKO. Дальнейшие показы бесплатны.',
    actions:[
      {label:'Отмена', ghost:true, onclick:()=>closePopup()},
      {label:'Показать за '+MP_TG_PRICE+' ₽', onclick:()=>{
        closePopup();
        if(!walletCharge(MP_TG_PRICE, 'Раскрытие TG · '+l.n)) return;
        if(typeof okoEarn==='function') okoEarn(MP_TG_PRICE, 'Раскрытие TG');
        MP.revealedTg[id] = mpFakeTg(l);
        MP.tgRevealCount = (MP.tgRevealCount||0)+1;
        mpSave();
        toast('Контакт открыт: '+MP.revealedTg[id]);
        openListing(id); // перерисовать карточку
      }}
    ]});
}
function mpTgCopy(id){
  const nick = MP.revealedTg[id]; if(!nick) return;
  try{ navigator.clipboard && navigator.clipboard.writeText(nick); }catch(e){}
  toast('Скопировано: '+nick);
}

/* ============================================================
   C · РЕЙТИНГ С ТРЕЙЛОМ — 30-дневный SVG-sparkline + «93% в срок»
   ============================================================ */
function mpTrendPoints(seed, n){
  const pts = [];
  let s = (seed || 1) >>> 0;
  for(let i=0;i<n;i++){
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const base = 3.6 + Math.sin(i/3)*0.35 + Math.cos(i/7)*0.25;
    const jit = ((s%1000)/1000 - 0.5) * 0.7;
    let v = base + jit + (i/n)*0.7; // общий подъём
    v = Math.max(3.0, Math.min(5.0, v));
    pts.push(v);
  }
  return pts;
}
function mpSparkline(seed){
  const pts = mpTrendPoints(seed, 30);
  const W = 240, H = 44, PAD = 3;
  const min = 3.0, max = 5.0;
  const xs = i => PAD + i*(W-PAD*2)/(pts.length-1);
  const ys = v => PAD + (H-PAD*2)*(1-(v-min)/(max-min));
  const path = pts.map((v,i)=>(i?'L':'M')+xs(i).toFixed(1)+' '+ys(v).toFixed(1)).join(' ');
  const fill = `M${xs(0)} ${H-PAD} `+ pts.map((v,i)=>'L'+xs(i).toFixed(1)+' '+ys(v).toFixed(1)).join(' ') +` L${xs(pts.length-1)} ${H-PAD} Z`;
  const last = pts[pts.length-1], lastX = xs(pts.length-1), lastY = ys(last);
  return `<svg class="mp-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="mpsparkg" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#9AFF00" stop-opacity=".55"/><stop offset="1" stop-color="#9AFF00" stop-opacity="0"/></linearGradient></defs>
    <path d="${fill}" fill="url(#mpsparkg)" stroke="none"/>
    <path d="${path}" fill="none" stroke="#9AFF00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="#9AFF00"/>
  </svg>`;
}
function mpOnTimeRate(l){ return 88 + ((l.seed||0) % 11); } // 88..98%
function mpRatingTrail(l){
  const on = mpOnTimeRate(l);
  return `<div class="mp-trail" id="mpTrail">
    <div class="mp-trail-top">
      <div><b>Рейтинг за 30 дней</b><small>динамика оценок клиентов</small></div>
      <div class="mp-trail-badge">${I('check')} ${on}% сделок закрыто в срок</div>
    </div>
    <div class="mp-trail-graph">${mpSparkline(l.seed || l.id)}</div>
    <div class="mp-trail-scale"><span>3.0</span><span>4.0</span><span>5.0</span></div>
  </div>`;
}

/* ============================================================
   D · ВЕРИФИКАЦИЯ 3 УРОВНЯ (Паспорт / Портфолио / Оплаченный кейс OKO)
   ============================================================ */
function mpTiers(l){
  const passport  = mpIsVerified(l) || (l.seed||0)%3===0;
  const portfolio = (l.reviews && l.reviews.length>=2) || (Array.isArray(l.photos) && l.photos.length>=1);
  const okoCase   = !!l.promo || (l.deals||0)>=40 || (typeof VERIFIED!=='undefined' && VERIFIED.has(l.n));
  return [
    {k:'passport',  lab:'Паспорт',              hint:'Личность подтверждена',   on:passport},
    {k:'portfolio', lab:'Портфолио',            hint:'Работы и живые отзывы',   on:portfolio},
    {k:'okocase',   lab:'Оплаченный кейс OKO',  hint:'Проведена сделка через OKO', on:okoCase},
  ];
}
function mpTiersLevel(l){ return mpTiers(l).filter(t=>t.on).length; } // 0..3
function mpTiersBlock(l){
  const tiers = mpTiers(l);
  const lv = tiers.filter(t=>t.on).length;
  return `<div class="mp-tiers" id="mpTiers">
    <div class="mp-tiers-h">
      <b>Верификация продавца</b>
      <span class="mp-tiers-lv lv${lv}">${lv}/3</span>
    </div>
    <div class="mp-tiers-row">${tiers.map(t=>`
      <div class="mp-tier ${t.on?'on':'off'}">
        <span class="mp-tier-shield">
          <svg class="mp-tier-svg"><use href="#i-mpshield"/></svg>
          ${t.on?`<span class="mp-tier-check">${I('check')}</span>`:''}
        </span>
        <b>${t.lab}</b><small>${t.hint}</small>
      </div>`).join('')}</div>
  </div>`;
}
function mpTiersMini(l){ // компактный ряд щитков для списочных плашек
  const tiers = mpTiers(l);
  return `<span class="mp-tiers-mini">${tiers.map(t=>
    `<span class="mp-tm ${t.on?'on':'off'}" title="${t.lab}"><svg class="mp-tier-svg"><use href="#i-mpshield"/></svg></span>`).join('')}</span>`;
}

/* ============================================================
   E · БЫСТРЫЕ ФИЛЬТРЫ (расширение уже существующих) — 7 чипов
   ============================================================ */
if(typeof mkFilters.mpBudget==='undefined') mkFilters.mpBudget = false; // до 5000₽
if(typeof mkFilters.mpToday==='undefined')  mkFilters.mpToday  = false; // сегодня
if(typeof mkFilters.mpMyCity==='undefined') mkFilters.mpMyCity = false; // в городе
if(typeof mkFilters.mpPhotos==='undefined') mkFilters.mpPhotos = false; // с примерами
function mpMyCity(){ return (typeof PROFILE!=='undefined' && PROFILE.city) || 'Онлайн'; }
function mpIsToday(l){ return ((l.seed||0)%4)===0; } // детерминированно «сегодня»
function mpHasPhotos(l){ return (Array.isArray(l.photos) && l.photos.length>0) || (l.reviews||[]).some(r=>Array.isArray(r.pics) && r.pics.length); }
const _mpMkApplyFiltersV3 = mkApplyFilters;
mkApplyFilters = function(arr){
  arr = _mpMkApplyFiltersV3(arr);
  if(mkFilters.mpBudget) arr = arr.filter(l=>l.p<=5000);
  if(mkFilters.mpToday)  arr = arr.filter(mpIsToday);
  if(mkFilters.mpMyCity){ const c = mpMyCity(); arr = arr.filter(l=>l.city===c); }
  if(mkFilters.mpPhotos) arr = arr.filter(mpHasPhotos);
  /* сортировка bump'нутых объявлений — сверху, если активны */
  arr = arr.slice().sort((a,b)=>{
    const ba = mpBumpActive(a.id) ? 1 : 0, bb = mpBumpActive(b.id) ? 1 : 0;
    return bb - ba;
  });
  return arr;
};
const _mpActiveFilterCountV3 = activeFilterCount;
activeFilterCount = function(){
  return _mpActiveFilterCountV3()
    + (mkFilters.mpBudget?1:0) + (mkFilters.mpToday?1:0)
    + (mkFilters.mpMyCity?1:0) + (mkFilters.mpPhotos?1:0);
};
const _mpResetFiltersV3 = resetFilters;
resetFilters = function(){
  _mpResetFiltersV3();
  mkFilters.mpBudget = false; mkFilters.mpToday = false;
  mkFilters.mpMyCity = false; mkFilters.mpPhotos = false;
};
/* дополняем строку quick-chips новыми — переопределяем весь inject */
mpInjectQuickChips = function(){
  const root = document.getElementById('marketRoot'); if(!root) return;
  if(document.getElementById('mpQuickChips')) return;
  const bar = root.querySelector('.mk-toolbar'); if(!bar) return;
  const w = document.createElement('div');
  w.id = 'mpQuickChips'; w.className = 'mp-qchips';
  const chip = (k, ic, lab) =>
    `<button class="mp-qc${mkFilters[k]?' on':''}" onclick="mpToggleQuick('${k}')">${I(ic)}<span>${lab}</span></button>`;
  w.innerHTML = `<div class="mp-qc-row">
    ${chip('mpBudget',  'money',       'до 5 000 ₽')}
    ${chip('mpToday',   'bolt',        'Сегодня')}
    ${chip('mpMyCity',  'pos',         'В городе')}
    ${chip('mpPhotos',  'photo',       'С примерами')}
    ${chip('mpOnline',  'circle-play', 'Онлайн')}
    ${chip('mpHasRev',  'star',        'С отзывами')}
    ${chip('mpFast',    'bolt',        'Быстрый ответ')}
  </div>`;
  bar.insertAdjacentElement('afterend', w);
};

/* ============================================================
   F · МИНИ-КАРТА УСЛУГ (абстрактная SVG, без API)
   ============================================================ */
function mpMapListings(){
  let arr = LISTINGS.filter(l=>!l.my && l.st==='act');
  if(typeof mkCat!=='undefined' && mkCat) arr = arr.filter(l=>l.cat===mkCat);
  return arr.slice(0, 12);
}
function mpMap(){
  const arr = mpMapListings();
  if(!arr.length) return '';
  const W = 320, H = 130;
  const pts = arr.map(l=>{
    const s = (l.seed||l.id) >>> 0;
    const x = 18 + ((s*13) % (W-36));
    const y = 14 + (((s>>3)*7) % (H-28));
    return {l, x, y};
  });
  const dots = pts.map(p=>{
    const bumped = mpBumpActive(p.l.id) ? ' bumped' : '';
    return `<g class="mp-map-pt${bumped}" onclick="event.stopPropagation();openListing(${p.l.id})">
      <circle cx="${p.x}" cy="${p.y}" r="8" class="mp-map-halo"/>
      <circle cx="${p.x}" cy="${p.y}" r="3.6" class="mp-map-core"/>
      <title>${esc(p.l.t)} · ${esc(p.l.pt)}</title>
    </g>`;
  }).join('');
  return `<div class="mp-mapwrap" id="mpMap">
    <div class="mp-strip-h">${I('pos')} Мастера рядом · ${arr.length} на карте</div>
    <div class="mp-map">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" class="mp-map-svg">
        <defs><pattern id="mpMapGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgba(154,255,0,.10)" stroke-width=".6"/></pattern></defs>
        <rect width="${W}" height="${H}" fill="url(#mpMapGrid)"/>
        <path d="M0 40 Q60 20 120 45 T240 30 T320 55" fill="none" stroke="rgba(154,255,0,.18)" stroke-width="1"/>
        <path d="M0 90 Q80 70 160 92 T320 88" fill="none" stroke="rgba(154,255,0,.12)" stroke-width="1"/>
        ${dots}
      </svg>
      <span class="mp-map-me">${I('pos')} вы здесь</span>
    </div>
  </div>`;
}
function mpInjectMap(){
  const root = document.getElementById('marketRoot'); if(!root) return;
  if(document.getElementById('mpMap')) return;
  if(typeof mkView==='undefined' || mkView!=='list') return;
  const results = document.getElementById('mkResults'); if(!results) return;
  const html = mpMap(); if(!html) return;
  results.insertAdjacentHTML('beforebegin', html);
}

/* ============================================================
   G · ОТЗЫВЫ С МЕДИА (превью фото + фуллскрин-свайп-просмотр)
   ============================================================ */
/* процедурный SVG-плейсхолдер вместо реальной фотки — data URI, вечно валиден */
function mpPicSvg(seed, w, h){
  w = w||600; h = h||600;
  const s = (seed*1234567) >>> 0;
  const hue1 = (s % 360), hue2 = ((s>>3) % 360);
  const cx = 30 + (s%40), cy = 30 + ((s>>2)%40);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='xMidYMid slice' width='${w}' height='${h}'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='hsl(${hue1} 55% 22%)'/><stop offset='1' stop-color='hsl(${hue2} 60% 12%)'/></linearGradient></defs>
    <rect width='100' height='100' fill='url(%23g)'/>
    <circle cx='${cx}' cy='${cy}' r='${18+(s%14)}' fill='hsl(85 100% 55% / .45)'/>
    <circle cx='${100-cx}' cy='${100-cy}' r='${10+(s%9)}' fill='hsl(${hue2} 90% 60% / .35)'/>
    <path d='M0 ${70+(s%15)} L100 ${55+(s%20)} L100 100 L0 100 Z' fill='hsl(0 0% 6% / .55)'/>
  </svg>`;
  return 'data:image/svg+xml;utf8,'+svg.replace(/#/g,'%23').replace(/"/g,"'").replace(/\s+/g,' ');
}
/* сеем медиа в отзывы объявлений (детерминировано, один раз за сессию, не персист) */
(function mpSeedReviewPics(){
  LISTINGS.forEach(l=>{
    (l.reviews||[]).forEach((r, ri)=>{
      if(r.pics && r.pics.length) return;
      const s = ((l.seed||l.id)*7 + ri*31) >>> 0;
      if(s % 3 !== 0) return; // ~1/3 отзывов с медиа
      const n = 1 + (s % 3);
      r.pics = [];
      for(let i=0;i<n;i++) r.pics.push(mpPicSvg(s + i*97));
    });
  });
})();

let MP_MV = {items:[], i:0, caption:''};
function mpMvOpen(items, i, caption){
  if(!items || !items.length) return;
  MP_MV.items = items; MP_MV.i = Math.max(0, Math.min(i||0, items.length-1)); MP_MV.caption = caption||'';
  mpMvRender();
  const v = document.getElementById('mpMediaViewer');
  if(!v) return;
  v.classList.add('open'); v.setAttribute('aria-hidden','false');
  document.addEventListener('keydown', mpMvKey);
  mpMvBindSwipe(v);
}
function mpMvClose(){
  const v = document.getElementById('mpMediaViewer'); if(!v) return;
  v.classList.remove('open'); v.setAttribute('aria-hidden','true');
  document.removeEventListener('keydown', mpMvKey);
}
function mpMvKey(e){
  if(e.key==='Escape') mpMvClose();
  else if(e.key==='ArrowRight') mpMvGo(1);
  else if(e.key==='ArrowLeft')  mpMvGo(-1);
}
function mpMvGo(step){
  if(!MP_MV.items.length) return;
  MP_MV.i = (MP_MV.i + step + MP_MV.items.length) % MP_MV.items.length;
  mpMvRender();
}
function mpMvRender(){
  const stage = document.getElementById('mpMvStage'); if(!stage) return;
  stage.innerHTML = MP_MV.items.map((u,i)=>
    `<div class="mp-mv-slide${i===MP_MV.i?' on':''}"><img src="${u}" alt=""></div>`).join('');
  const cap = document.getElementById('mpMvCap'); if(cap) cap.innerHTML = esc(MP_MV.caption)+' · '+(MP_MV.i+1)+' / '+MP_MV.items.length;
  const dots = document.getElementById('mpMvDots');
  if(dots) dots.innerHTML = MP_MV.items.map((_,i)=>`<span class="mp-mv-dot${i===MP_MV.i?' on':''}"></span>`).join('');
  const nav = document.querySelectorAll('#mpMediaViewer .mp-mv-nav');
  nav.forEach(b=>{ b.style.display = MP_MV.items.length>1 ? 'flex' : 'none'; });
}
function mpMvBindSwipe(v){
  if(v._mpBound) return; v._mpBound = true;
  let x0 = null;
  v.addEventListener('touchstart', e=>{ x0 = e.touches[0].clientX; }, {passive:true});
  v.addEventListener('touchend',   e=>{
    if(x0===null) return;
    const dx = (e.changedTouches[0].clientX) - x0;
    if(Math.abs(dx)>40) mpMvGo(dx<0 ? 1 : -1);
    x0 = null;
  }, {passive:true});
  v.querySelector('.mp-mv-stage').addEventListener('click', e=>{
    /* тап по правой половине -> вперёд, по левой -> назад, кроме если по nav */
    const r = v.getBoundingClientRect();
    const half = r.left + r.width/2;
    if(MP_MV.items.length>1) mpMvGo(e.clientX>half ? 1 : -1);
  });
}
/* при рендере отзывов на карточке — добавляем миниатюры (аддитивно, поверх базового вывода).
   Клик по миниатюре открывает фуллскрин через ref по (listing id + review index + pic index),
   чтобы не тащить SVG-data-URI в onclick-атрибут (там одиночные кавычки — сломают HTML). */
function mpOpenRvMedia(lid, ri, pi){
  const l = LISTINGS.find(x=>x.id===lid); if(!l) return;
  const r = (l.reviews||[])[ri]; if(!r || !r.pics) return;
  mpMvOpen(r.pics, pi, 'Отзыв: '+r.n);
}
function mpDecorateReviews(id){
  const v = document.getElementById('lstView'); if(!v) return;
  const l = LISTINGS.find(x=>x.id===id); if(!l) return;
  const revList = v.querySelector('.rev-list'); if(!revList) return;
  const revs = l.reviews||[];
  const nodes = revList.querySelectorAll('.rev');
  nodes.forEach((node, i)=>{
    const r = revs[i];
    if(!r || !r.pics || !r.pics.length || node.querySelector('.mp-rvmedia')) return;
    const strip = document.createElement('div');
    strip.className = 'mp-rvmedia';
    strip.innerHTML = r.pics.map((u,pi)=>
      `<button type="button" class="mp-rvm-t" onclick="mpOpenRvMedia(${id},${i},${pi})"><img src="${u}" alt=""></button>`).join('');
    node.appendChild(strip);
  });
}

/* ============================================================
   H · УМНЫЙ ПОИСК — подсказки, история, топ дня
   ============================================================ */
const MP_TOP_TODAY = ['Reels под ключ','Лендинг за 3 дня','Настройка таргета','Дизайн карточек','Клон голоса','SEO-статьи','3D товара','Обложки для YouTube'];
function mpHistPush(q){
  q = (q||'').trim(); if(q.length<2) return;
  MP.searchHist = (MP.searchHist||[]).filter(x=>x.toLowerCase()!==q.toLowerCase());
  MP.searchHist.unshift(q);
  if(MP.searchHist.length>8) MP.searchHist.length = 8;
  mpSave();
}
function mpHistClear(){ MP.searchHist = []; mpSave(); mpRenderSuggest(); }
function mpSuggest(q){
  q = (q||'').trim().toLowerCase();
  if(!q) return [];
  const out = [];
  MK_CATS.forEach(c=>{ if(c.name.toLowerCase().includes(q)) out.push({kind:'cat', k:c.k, t:c.name, ic:c.ic}); });
  LISTINGS.filter(l=>!l.my && l.st==='act').forEach(l=>{
    const hay = (l.t+' '+l.n+' '+catName(l.cat)).toLowerCase();
    if(hay.includes(q)) out.push({kind:'lst', id:l.id, t:l.t, sub:l.n+' · '+l.pt, ic:catIco(l.cat)});
  });
  return out.slice(0, 8);
}
function mpMountSuggest(){
  const inp = document.getElementById('mkSearchInput'); if(!inp || inp._mpBound) return;
  inp._mpBound = true;
  const bar = inp.closest('.mk-searchbar'); if(!bar) return;
  bar.classList.add('mp-searchbar-relative');
  const drop = document.createElement('div');
  drop.id = 'mpSuggest'; drop.className = 'mp-suggest';
  bar.appendChild(drop);
  inp.addEventListener('focus', mpRenderSuggest);
  inp.addEventListener('input', mpRenderSuggest);
  inp.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ mpHistPush(inp.value); mpRenderSuggest(); }
    if(e.key==='Escape') mpHideSuggest();
  });
  document.addEventListener('click', e=>{
    if(!bar.contains(e.target)) mpHideSuggest();
  }, {passive:true, capture:true});
}
function mpHideSuggest(){ const d = document.getElementById('mpSuggest'); if(d) d.classList.remove('open'); }
function mpRenderSuggest(){
  const inp = document.getElementById('mkSearchInput'); const d = document.getElementById('mpSuggest');
  if(!inp || !d) return;
  const q = inp.value||'';
  const sug = mpSuggest(q);
  const hist = MP.searchHist||[];
  if(!q.trim() && !hist.length && !MP_TOP_TODAY.length){ d.classList.remove('open'); return; }
  let html = '';
  if(q.trim() && sug.length){
    html += `<div class="mp-sug-h">${I('search')} Совпадения</div>`;
    html += sug.map(s=>s.kind==='cat'
      ? `<button class="mp-sug-i" onclick="mpSuggestGoCat('${s.k}')"><span class="mp-sug-ic">${I(s.ic)}</span><span class="mp-sug-b"><b>${esc(s.t)}</b><small>категория</small></span></button>`
      : `<button class="mp-sug-i" onclick="mpSuggestGoLst(${s.id})"><span class="mp-sug-ic">${I(s.ic)}</span><span class="mp-sug-b"><b>${esc(s.t)}</b><small>${esc(s.sub)}</small></span></button>`
    ).join('');
  }
  if(!q.trim() && hist.length){
    html += `<div class="mp-sug-h">${I('clock')} Недавние запросы <button class="mp-sug-x" onclick="mpHistClear()">${I('trash')} очистить</button></div>`;
    html += hist.map(h=>
      `<button class="mp-sug-i" onclick="mpSuggestGoQ(${JSON.stringify(h)})"><span class="mp-sug-ic">${I('clock')}</span><span class="mp-sug-b"><b>${esc(h)}</b></span></button>`).join('');
  }
  if(!q.trim()){
    html += `<div class="mp-sug-h">${I('fire')} Топ запросы дня</div>`;
    html += `<div class="mp-sug-top">${MP_TOP_TODAY.map(t=>
      `<button class="mp-sug-chip" onclick="mpSuggestGoQ(${JSON.stringify(t)})">${esc(t)}</button>`).join('')}</div>`;
  }
  d.innerHTML = html;
  d.classList.toggle('open', !!html);
}
function mpSuggestGoQ(q){
  mkSearchQ = q;
  const inp = document.getElementById('mkSearchInput'); if(inp) inp.value = q;
  mpHistPush(q);
  if(typeof renderMarketListSoft==='function') renderMarketListSoft();
  mpHideSuggest();
}
function mpSuggestGoCat(k){
  mpHideSuggest();
  if(typeof openMarketCat==='function') openMarketCat(k);
}
function mpSuggestGoLst(id){
  mpHideSuggest();
  openListing(id);
}

/* ============================================================
   I · BUMP / BOOST — «Поднять за 50 ₽ на день»
   ============================================================ */
const MP_BUMP_PRICE = 50, MP_BUMP_TTL = 24*3600e3;
function mpBumpActive(id){
  const t = MP.bumps && MP.bumps[id]; return !!(t && t>Date.now());
}
function mpBumpLeft(id){
  const t = MP.bumps && MP.bumps[id]; if(!t) return '';
  const ms = Math.max(0, t-Date.now()); const h = Math.floor(ms/3600e3);
  return h>=1 ? h+' ч' : Math.max(1, Math.round(ms/60e3))+' мин';
}
function mpBumpDo(id){
  const l = LISTINGS.find(x=>x.id===id); if(!l || !l.my) return;
  if(mpBumpActive(id)){ toast('Уже поднято · осталось '+mpBumpLeft(id)); return; }
  showPopup({ico:'rocket', title:'Поднять объявление?',
    body:'«'+esc(l.t)+'» будет закреплено сверху ленты на <b>24 часа</b>. Стоимость: <b>'+MP_BUMP_PRICE+' ₽</b> с кошелька.',
    actions:[
      {label:'Отмена', ghost:true, onclick:()=>closePopup()},
      {label:'Поднять за '+MP_BUMP_PRICE+' ₽', onclick:()=>{
        closePopup();
        if(!walletCharge(MP_BUMP_PRICE, 'Bump объявления · '+l.t)) return;
        if(typeof okoEarn==='function') okoEarn(MP_BUMP_PRICE, 'Bump объявления');
        MP.bumps[id] = Date.now() + MP_BUMP_TTL; mpSave();
        toast('Поднято на 24 часа — теперь выше в ленте');
        openListing(id);
      }}
    ]});
}
function mpBumpBadge(id){
  return mpBumpActive(id)
    ? `<span class="mp-bump-badge">${I('rocket')} Поднято · ${mpBumpLeft(id)}</span>`
    : '';
}
function mpBumpButtonForListing(l){
  const active = mpBumpActive(l.id);
  return active
    ? `<button class="mp-bump-btn active" disabled>${I('rocket')} Поднято · ещё ${mpBumpLeft(l.id)}</button>`
    : `<button class="mp-bump-btn" onclick="mpBumpDo(${l.id})">${I('rocket')} Поднять на день · ${MP_BUMP_PRICE} ₽</button>`;
}
/* декор карточек списка: наклейка «Поднято» */
function mpDecorateBumps(){
  document.querySelectorAll('#mkResults .lst-card').forEach(card=>{
    const id = mpIdFromCard(card); if(!id) return;
    if(mpBumpActive(id) && !card.querySelector('.mp-bump-flag')){
      const flag = document.createElement('span'); flag.className = 'mp-bump-flag';
      flag.innerHTML = I('rocket')+' Поднято';
      const photo = card.querySelector('.lst-photo');
      (photo||card).appendChild(flag);
      card.classList.add('mp-bumped');
    }
  });
}

/* ============================================================
   ФИНАЛЬНАЯ ОБЁРТКА openListing — вкатываем все v3-блоки
   ============================================================ */
const _mpOpenListingV3 = openListing;
openListing = function(id){
  _mpOpenListingV3.apply(this, arguments);
  try{
    const l = LISTINGS.find(x=>x.id===id);
    const v = document.getElementById('lstView');
    if(!l || !v) return;

    /* --- декор отзывов медиа-миниатюрами --- */
    mpDecorateReviews(id);

    if(l.my){
      /* --- на своей карточке: контейнер владельца (bump + метрики) --- */
      if(!document.getElementById('mpOwnerBar')){
        const bar = document.createElement('div');
        bar.id = 'mpOwnerBar'; bar.className = 'mp-owner-bar';
        bar.innerHTML = `
          <div class="mp-strip-h">${I('rocket')} Продвижение и метрики</div>
          ${mpBumpButtonForListing(l)}
          <div class="mp-owner-kpi">
            <div><b>${fmtN(l.views||0)}</b><small>${I('eye')} показы</small></div>
            <div><b>${l.contacts||0}</b><small>${I('chat')} контакты</small></div>
            <div><b>${l.favs||0}</b><small>${I('heart')} в избранном</small></div>
          </div>`;
        const meta = v.querySelector('.lst-d-meta');
        if(meta && mpBumpActive(l.id) && !meta.querySelector('.mp-bump-badge'))
          meta.insertAdjacentHTML('beforeend', mpBumpBadge(l.id));
        v.appendChild(bar);
      }
      return;
    }

    /* --- покупателю: блок «связаться» (OKO-чат + Show TG) --- */
    if(!document.getElementById('mpContact')){
      const cta = v.querySelector('.lst-cta');
      const html = mpContactBlock(l);
      if(cta){
        cta.insertAdjacentHTML('beforebegin', html);
        cta.style.display = 'none'; // прячем базовые кнопки — новая CTA богаче
        const orderBtn = v.querySelector('.btn[onclick^="orderListing"]');
        if(orderBtn) orderBtn.style.marginTop = '4px';
      } else {
        v.insertAdjacentHTML('beforeend', html);
      }
    }

    /* --- 3-уровневая верификация --- */
    if(!document.getElementById('mpTiers')){
      const seller = v.querySelector('.seller-card');
      const html = mpTiersBlock(l);
      if(seller) seller.insertAdjacentHTML('afterend', html);
      else v.insertAdjacentHTML('beforeend', html);
    }

    /* --- 30-day sparkline рейтинга --- */
    if(!document.getElementById('mpTrail')){
      const srv = document.getElementById('mpSrv') || document.getElementById('mpTiers');
      const html = mpRatingTrail(l);
      if(srv) srv.insertAdjacentHTML('afterend', html);
      else v.insertAdjacentHTML('beforeend', html);
    }

    /* --- 3-шаговое напоминание об эскроу поверх старого mp-trust --- */
    const old = document.getElementById('mpTrust');
    if(old && !document.getElementById('mpSafe')){
      old.insertAdjacentHTML('afterend', mpSafeMini());
    }
  }catch(e){}
};

/* ============================================================
   ФИНАЛЬНАЯ ОБЁРТКА renderMarketList — инъекции для list-вью
   ============================================================ */
if(typeof renderMarketList==='function'){
  const _mpRMLv3 = renderMarketList;
  renderMarketList = function(){
    _mpRMLv3.apply(this, arguments);
    try{
      mpInjectMap();
      mpMountSuggest();
      mpDecorateBumps();
    }catch(e){}
  };
}
if(typeof renderMarketListSoft==='function'){
  const _mpRMLSv3 = renderMarketListSoft;
  renderMarketListSoft = function(){
    _mpRMLSv3.apply(this, arguments);
    try{ mpDecorateBumps(); }catch(e){}
  };
}

/* ============================================================
   КАБИНЕТ ПРОДАВЦА — добавляем в карточки объявлений bump-кнопки
   ============================================================ */
const _mpRenderCabV3 = mpRenderCab;
mpRenderCab = function(){
  _mpRenderCabV3.apply(this, arguments);
  try{
    const box = document.getElementById('mpCabView'); if(!box) return;
    const mine = LISTINGS.filter(l=>l.my);
    /* добавляем bump-строку под каждым «мои объявления» */
    box.querySelectorAll('.mp-lst').forEach((row, i)=>{
      const l = mine[i]; if(!l || row.querySelector('.mp-bump-row')) return;
      const active = mpBumpActive(l.id);
      const bar = document.createElement('div');
      bar.className = 'mp-bump-row';
      bar.innerHTML = active
        ? `<span class="mp-bump-on">${I('rocket')} Поднято · ещё ${mpBumpLeft(l.id)}</span>`
        : `<button class="mp-bump-mini" onclick="event.stopPropagation();mpBumpDo(${l.id})">${I('rocket')} Поднять · ${MP_BUMP_PRICE} ₽</button>`;
      row.appendChild(bar);
    });
  }catch(e){}
};

/* ================================================================================
   MARKET-PRO v4 · «биржа услуг как Авито» + no-demo для новых пользователей
   Даниэль 29.07: реальный функционал без демо-воды для новых пользователей.
   Всё аддитивно, поверх уже существующих слоёв. Ключ демо-режима — mpIsDemo().
   ================================================================================ */

/* ---------- флаг демо-режима: только владельцу или по явному опт-ину ---------- */
function mpIsDemo(){
  try{
    if(typeof isOwner==='function' && isOwner()) return true;
    if(localStorage.getItem('oko-demo')==='1') return true;
  }catch(e){}
  return false;
}
function mpDemoToggle(){
  try{
    const on = mpIsDemo();
    if(on) localStorage.removeItem('oko-demo');
    else localStorage.setItem('oko-demo','1');
    toast(on ? 'Демо-объявления скрыты' : 'Показаны демо-объявления');
    renderMarket();
  }catch(e){}
}
window.mpDemoToggle = mpDemoToggle;

/* ---------- сид «настоящих» помечаем как демо, чтобы фильтровать по флагу ---------- */
(function mpMarkDemo(){
  LISTINGS.forEach(l=>{ if(!('demo' in l)) l.demo = !l.my; });
  try{
    if(typeof POSTS!=='undefined'){
      ['sub','rec'].forEach(k=>{ (POSTS[k]||[]).forEach(p=>{ if(!('demo' in p)) p.demo = (p.name !== PROFILE.name); }); });
    }
  }catch(e){}
})();

/* ---------- фильтр реального каталога: без демо для не-owner ---------- */
function mpVisibleListings(){
  const demo = mpIsDemo();
  return LISTINGS.filter(l=> demo ? true : (!l.demo || l.my));
}

/* ---------- обёртки: фильтры каталога учитывают mpIsDemo ---------- */
const _mpApplyFiltersDemo = mkApplyFilters;
mkApplyFilters = function(arr){
  if(!mpIsDemo()) arr = arr.filter(l=> !l.demo || l.my);
  return _mpApplyFiltersDemo(arr);
};

/* ---------- рекомендации и поиск: тоже прячем демо ---------- */
(function mpPatchGlobalListingReads(){
  /* renderMarketCats хочет посчитать n-у в каждой категории и построить featured — оба
     читают LISTINGS напрямую. Патчим сам renderMarketCats через chain: перерисовываем чистый
     список после базы, если запущено не в демо-режиме и там оказались демо-карточки. */
})();

/* ============================================================
   V4·A — на «Категории» показывать пустое состояние новому пользователю
   ============================================================ */
function mpHasRealListings(){
  return LISTINGS.some(l=> l.my || (!l.demo && l.st==='act'));
}
function mpCatsEmptyState(){
  const wrap = document.getElementById('marketRoot');
  if(!wrap) return;
  if(mpIsDemo()) return;                 // владельцу — показать демо как было
  if(mpHasRealListings()) return;        // уже есть настоящие — не мешаем
  /* пустой стартовый экран биржи */
  wrap.innerHTML = `
    <div class="mk-searchbar" onclick="mkOpenSearch()"><svg class="i"><use href="#i-search"/></svg><span>Поиск услуг и товаров</span></div>
    <div class="mk-quick">
      <button onclick="openMyListings()">${I('briefcase')}<span>Мои объявления</span></button>
      <button onclick="mkView='fav';mkCat=null;renderMarket()">${I('heart')}<span>Сохранённые</span></button>
    </div>
    <div class="mp-fresh">
      <div class="mp-fresh-ic">${I('briefcase')}</div>
      <h3>Биржа OKO пока пуста в вашем городе</h3>
      <p>Разместите первое объявление — покупатели найдут вас через поиск, категории и карту. Сделки защищены эскроу OKO.</p>
      <div class="mp-fresh-cta">
        <button class="btn" onclick="mpOpenWizard()">${I('plus')} Добавить первое объявление</button>
        <button class="btn ghost" onclick="mpDemoToggle()">${I('eye')} Посмотреть как работает биржа</button>
      </div>
      <div class="mp-fresh-safety">
        ${I('lock')} <span><b>Правило безопасной сделки:</b> не переводите деньги вне OKO — только через безопасную оплату эскроу. При спорах модерация вернёт средства.</span>
      </div>
      <div class="mp-fresh-cats">
        <div class="mp-fresh-h">Что можно продавать</div>
        <div class="mp-fresh-grid">${MK_CATS.slice(0,8).map(c=>
          `<button class="mp-fresh-cat" onclick="mpOpenWizardCat('${c.k}')">${I(c.ic)}<span>${c.name}</span></button>`).join('')}</div>
      </div>
    </div>`;
}

/* обёртка renderMarket: если пусто и это не демо — показать fresh-старт */
const _mpRenderMarketFresh = renderMarket;
renderMarket = function(){
  _mpRenderMarketFresh();
  try{
    if(typeof mkView!=='undefined' && mkView==='cats') mpCatsEmptyState();
  }catch(e){}
};

/* ============================================================
   V4·B — расширенные фильтры Avito (payment, delivery, bargain, radius, photos, verified)
   ============================================================ */
if(typeof mkFilters.mpPay==='undefined')     mkFilters.mpPay = false;      // оплата на OKO
if(typeof mkFilters.mpDeliv==='undefined')   mkFilters.mpDeliv = false;    // с доставкой
if(typeof mkFilters.mpBargain==='undefined') mkFilters.mpBargain = false;  // торг
if(typeof mkFilters.mpPhoto==='undefined')   mkFilters.mpPhoto = false;    // только с фото
if(typeof mkFilters.mpRadius==='undefined')  mkFilters.mpRadius = 0;       // 0 = любой (км)

function mpHasOnlinePay(l){ return true; } // все объявления OKO поддерживают эскроу
function mpHasDelivery(l){ return (l.deliv===true) || ((l.seed||0)%2===0); }
function mpHasBargain(l){ return (l.bargain===true) || ((l.seed||0)%3===0); }
function mpHasAnyPhoto(l){ return Array.isArray(l.photos) && l.photos.length>0; }
/* геодистанция без API — детерминированная от seed, для прототипа */
function mpDistanceKm(l){ return ((l.seed||l.id||1) * 7) % 60; }

const _mpApplyFiltersV4 = mkApplyFilters;
mkApplyFilters = function(arr){
  arr = _mpApplyFiltersV4(arr);
  if(mkFilters.mpPay)     arr = arr.filter(mpHasOnlinePay);
  if(mkFilters.mpDeliv)   arr = arr.filter(mpHasDelivery);
  if(mkFilters.mpBargain) arr = arr.filter(mpHasBargain);
  if(mkFilters.mpPhoto)   arr = arr.filter(mpHasAnyPhoto);
  if(mkFilters.mpRadius)  arr = arr.filter(l=> mpDistanceKm(l) <= +mkFilters.mpRadius);
  return arr;
};
const _mpActiveFilterCountV4 = activeFilterCount;
activeFilterCount = function(){
  return _mpActiveFilterCountV4()
    + (mkFilters.mpPay?1:0) + (mkFilters.mpDeliv?1:0)
    + (mkFilters.mpBargain?1:0) + (mkFilters.mpPhoto?1:0)
    + (mkFilters.mpRadius?1:0);
};
const _mpResetFiltersV4 = resetFilters;
resetFilters = function(){
  _mpResetFiltersV4();
  mkFilters.mpPay = false; mkFilters.mpDeliv = false; mkFilters.mpBargain = false;
  mkFilters.mpPhoto = false; mkFilters.mpRadius = 0;
};

/* добавляем расширенные секции в шит фильтров */
const _mpRenderFiltersV4 = renderFilters;
renderFilters = function(){
  _mpRenderFiltersV4();
  const v = document.getElementById('filtersView');
  if(!v || v.querySelector('.mp-fadv-wrap')) return;
  const btnRow = v.lastElementChild;
  const radiusOpts = [[0,'Любой'],[5,'до 5 км'],[15,'до 15 км'],[50,'до 50 км']];
  const w = document.createElement('div');
  w.className = 'mp-fadv-wrap';
  w.innerHTML = `
    <p class="f-lab">${I('pos')} Радиус поиска</p>
    <div class="f-row">${radiusOpts.map(([v,lab])=>
      `<button class="f-chip ${mkFilters.mpRadius===v?'on':''}" onclick="mpSetRadius(${v})">${lab}</button>`).join('')}</div>
    <p class="f-lab">${I('lock')} Условия сделки</p>
    <div class="mp-cond-grid">
      <button class="mp-cond ${mkFilters.mpPay?'on':''}" onclick="mpToggleCond('mpPay')">${I('card')}<b>Онлайн-оплата</b><small>эскроу OKO</small></button>
      <button class="mp-cond ${mkFilters.mpDeliv?'on':''}" onclick="mpToggleCond('mpDeliv')">${I('rocket')}<b>С доставкой</b><small>в город/район</small></button>
      <button class="mp-cond ${mkFilters.mpBargain?'on':''}" onclick="mpToggleCond('mpBargain')">${I('chat')}<b>Возможен торг</b><small>цена обсуждается</small></button>
      <button class="mp-cond ${mkFilters.mpPhoto?'on':''}" onclick="mpToggleCond('mpPhoto')">${I('photo')}<b>Только с фото</b><small>реальные примеры</small></button>
    </div>`;
  v.insertBefore(w, btnRow);
};
function mpSetRadius(v){ mpKeepPrice(); mkFilters.mpRadius = v; renderFilters(); }
function mpToggleCond(k){ mpKeepPrice(); mkFilters[k] = !mkFilters[k]; renderFilters(); }

/* ============================================================
   V4·C — расширенный уровень фото (до 10) с drag-reorder
   ============================================================ */
/* переопределяем лимит */
try{ MP_PHOTO_MAX = 10; }catch(e){}

const _mpRenderFormPhotosDrag = mpRenderFormPhotos;
mpRenderFormPhotos = function(){
  _mpRenderFormPhotosDrag();
  const grid = document.getElementById('mpFormPhotos');
  if(!grid) return;
  const thumbs = grid.querySelectorAll('.mp-fp-thumb');
  thumbs.forEach((t,i)=>{
    t.setAttribute('draggable','true');
    t.dataset.idx = i;
    t.addEventListener('dragstart', mpFpDragStart);
    t.addEventListener('dragover', mpFpDragOver);
    t.addEventListener('drop', mpFpDrop);
    t.addEventListener('dragend', mpFpDragEnd);
    /* touch-reorder: long-press переносит */
    t.addEventListener('touchstart', mpFpTouchStart, {passive:true});
  });
};
let _mpDragI = -1;
function mpFpDragStart(e){
  _mpDragI = +this.dataset.idx;
  try{ e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(_mpDragI)); }catch(_){}
  this.classList.add('drag');
}
function mpFpDragOver(e){ e.preventDefault(); this.classList.add('over'); }
function mpFpDrop(e){
  e.preventDefault();
  const to = +this.dataset.idx;
  if(_mpDragI<0 || to<0 || _mpDragI===to) return;
  const arr = mpFormPhotos.slice();
  const [it] = arr.splice(_mpDragI,1);
  arr.splice(to,0,it);
  mpFormPhotos = arr;
  mpRenderFormPhotos();
}
function mpFpDragEnd(){
  document.querySelectorAll('.mp-fp-thumb').forEach(t=>t.classList.remove('drag','over'));
  _mpDragI = -1;
}
let _mpTouchT = null;
function mpFpTouchStart(e){
  const el = this;
  clearTimeout(_mpTouchT);
  _mpTouchT = setTimeout(()=>{
    /* при long-press показать переключатель «в обложку» — простой контекст */
    const i = +el.dataset.idx;
    if(i>0){
      const arr = mpFormPhotos.slice();
      const [it] = arr.splice(i,1);
      arr.unshift(it);
      mpFormPhotos = arr;
      mpRenderFormPhotos();
      toast('Обложка обновлена');
    }
  }, 550);
  const cancel = ()=>{ clearTimeout(_mpTouchT); el.removeEventListener('touchend',cancel); el.removeEventListener('touchmove',cancel); };
  el.addEventListener('touchend', cancel, {passive:true});
  el.addEventListener('touchmove', cancel, {passive:true});
}

/* ============================================================
   V4·D — 5-шаговый мастер создания объявления (как в Avito)
   ============================================================ */
let MP_WZ = null;
function mpOpenWizard(){
  MP_WZ = {step:1, cat:null, kind:'service', title:'', desc:'', price:'', bargain:false,
    onlinePay:true, deliv:false, city:(typeof PROFILE!=='undefined' && PROFILE.city)||'Онлайн', term:'по договорённости'};
  mpFormPhotos = [];
  mpWzRender();
  openSheet('mpWizard');
}
function mpOpenWizardCat(k){ mpOpenWizard(); MP_WZ.cat = k; MP_WZ.step = 2; mpWzRender(); }
function mpWzGoto(n){ if(!MP_WZ) return; MP_WZ.step = Math.max(1, Math.min(5, n)); mpWzRender(); }
function mpWzNext(){ if(!MP_WZ) return;
  if(MP_WZ.step===1 && !MP_WZ.cat){ toast('Выбери категорию'); return; }
  if(MP_WZ.step===2){
    const t = (document.getElementById('wzTitle')||{}).value||'';
    const d = (document.getElementById('wzDesc')||{}).value||'';
    if(t.trim().length<4){ toast('Название от 4 символов'); return; }
    MP_WZ.title = t.trim(); MP_WZ.desc = d.trim();
  }
  if(MP_WZ.step===3){ if(mpFormPhotos.length<1){ toast('Добавь хотя бы одно фото'); return; } }
  if(MP_WZ.step===4){
    const p = (document.getElementById('wzPrice')||{}).value||'';
    if(!p.trim()){ toast('Укажи цену или «договорная»'); return; }
    MP_WZ.price = p.trim();
    MP_WZ.bargain = !!(document.getElementById('wzBargain')||{}).checked;
    MP_WZ.onlinePay = !!(document.getElementById('wzOnlinePay')||{}).checked;
  }
  if(MP_WZ.step<5) mpWzGoto(MP_WZ.step+1);
  else mpWzSubmit();
}
function mpWzRender(){
  const box = document.getElementById('mpWizardView');
  if(!box || !MP_WZ) return;
  const step = MP_WZ.step;
  const bar = `<div class="mp-wz-steps">
    ${[1,2,3,4,5].map(i=>`<span class="mp-wz-dot${i<=step?' on':''}${i===step?' cur':''}">${i}</span>`).join('')}
  </div>`;
  const cap = ['Категория','Название и описание','Фото','Цена и оплата','Гео и доставка'][step-1];
  const nav = `<div class="mp-wz-nav">
    ${step>1?`<button class="btn ghost" onclick="mpWzGoto(${step-1})">${I('back')} Назад</button>`:'<span></span>'}
    <button class="btn" onclick="mpWzNext()">${step<5?'Далее':'Опубликовать'} ${I('chev')}</button>
  </div>`;
  let body = '';
  if(step===1){
    const cats = MK_CATS.map(c=>`<button class="mp-wz-cat ${MP_WZ.cat===c.k?'on':''}" onclick="MP_WZ.cat='${c.k}';mpWzRender()">
      <span class="mp-wz-cat-ic">${I(c.ic)}</span><b>${esc(c.name)}</b></button>`).join('');
    body = `
      <p class="f-lab">Тип объявления</p>
      <div class="f-row">
        <button class="f-chip ${MP_WZ.kind==='service'?'on':''}" onclick="MP_WZ.kind='service';mpWzRender()">${I('briefcase')} Услуга</button>
        <button class="f-chip ${MP_WZ.kind==='goods'?'on':''}" onclick="MP_WZ.kind='goods';mpWzRender()">${I('photo')} Товар</button>
        <button class="f-chip ${MP_WZ.kind==='work'?'on':''}" onclick="MP_WZ.kind='work';mpWzRender()">${I('users')} Работа</button>
      </div>
      <p class="f-lab">Категория</p>
      <div class="mp-wz-cats">${cats}</div>`;
  } else if(step===2){
    body = `
      <p class="f-lab">Что вы продаёте?</p>
      <input id="wzTitle" placeholder="Например: Монтаж Reels под ключ за 24 часа" value="${esc(MP_WZ.title)}" maxlength="80">
      <small class="mp-wz-hint">До 80 символов · чем конкретнее — тем больше откликов</small>
      <p class="f-lab" style="margin-top:14px">Описание</p>
      <textarea id="wzDesc" rows="5" maxlength="800" placeholder="Что входит, сроки, условия, гарантии. Расскажите как покупателю">${esc(MP_WZ.desc)}</textarea>
      <small class="mp-wz-hint">До 800 символов · без контактов — площадка их спрячет</small>`;
  } else if(step===3){
    body = `
      <p class="f-lab">Фото объявления · до ${MP_PHOTO_MAX}</p>
      <input type="file" id="mpPhotoInput" accept="image/*" multiple hidden>
      <div class="mp-fp-grid" id="mpFormPhotos"></div>
      <small class="mp-wz-hint">Первое фото — обложка. Перетащите миниатюру, чтобы поменять порядок; долгое касание — сделать обложкой.</small>`;
  } else if(step===4){
    body = `
      <p class="f-lab">Цена</p>
      <input id="wzPrice" inputmode="decimal" placeholder="Например: 1500 или договорная" value="${esc(MP_WZ.price)}">
      <div class="mp-wz-opts">
        <label class="mp-wz-check"><input type="checkbox" id="wzBargain" ${MP_WZ.bargain?'checked':''}><span></span> ${I('chat')} Возможен торг</label>
        <label class="mp-wz-check"><input type="checkbox" id="wzOnlinePay" ${MP_WZ.onlinePay?'checked':''}><span></span> ${I('card')} Онлайн-оплата через эскроу OKO</label>
      </div>
      <div class="mp-wz-safety">${I('lock')} Расчёты — только через безопасную оплату OKO. Не переводите деньги напрямую даже проверенным покупателям.</div>`;
  } else {
    const cities = ['Москва','Санкт-Петербург','Казань','Екатеринбург','Новосибирск','Онлайн'];
    body = `
      <p class="f-lab">Город/район</p>
      <input id="wzCity" list="wzCityList" value="${esc(MP_WZ.city)}" oninput="MP_WZ.city=this.value">
      <datalist id="wzCityList">${cities.map(c=>`<option value="${c}"></option>`).join('')}</datalist>
      <div class="mp-city-chips">${cities.map(c=>`<button class="f-chip ${MP_WZ.city===c?'on':''}" onclick="MP_WZ.city='${c}';mpWzRender()">${c}</button>`).join('')}</div>
      <p class="f-lab" style="margin-top:14px">Срок исполнения</p>
      <input id="wzTerm" placeholder="Например: 3 дня, помесячно" value="${esc(MP_WZ.term)}" oninput="MP_WZ.term=this.value">
      <label class="mp-wz-check" style="margin-top:12px"><input type="checkbox" id="wzDeliv" ${MP_WZ.deliv?'checked':''} onchange="MP_WZ.deliv=this.checked"><span></span> ${I('rocket')} Возможна доставка</label>
      <div class="mp-wz-preview">
        <div class="mp-wz-preview-h">${I('eye')} Предпросмотр</div>
        <div class="mp-wz-preview-card">
          <div class="mp-wz-preview-ph">${mpFormPhotos[0]?`<img src="${mpFormPhotos[0]}" alt="">`:I(MK_CATS.find(c=>c.k===MP_WZ.cat)?.ic||'briefcase')}</div>
          <div>
            <div class="mp-wz-preview-p">${esc(MP_WZ.price||'договорная')}${MP_WZ.bargain?' · торг':''}</div>
            <div class="mp-wz-preview-t">${esc(MP_WZ.title||'Название объявления')}</div>
            <div class="mp-wz-preview-m">${I('pos')} ${esc(MP_WZ.city)} · ${esc(MP_WZ.term)}</div>
          </div>
        </div>
      </div>`;
  }
  box.innerHTML = `
    <div class="mp-wz-head">
      <h3>Новое объявление</h3>
      <small>Шаг ${step} из 5 · ${cap}</small>
    </div>
    ${bar}
    <div class="mp-wz-body">${body}</div>
    ${nav}`;
  if(step===3){ mpMountPhotoUploader(); mpRenderFormPhotos(); }
}
function mpWzSubmit(){
  const cat = MP_WZ.cat, t = MP_WZ.title, ds = MP_WZ.desc, pt = MP_WZ.price;
  const price = parseInt((pt||'').replace(/\D/g,''))||0;
  const id = Date.now();
  const seed = id%97;
  LISTINGS.unshift({
    id, cat, type:MP_WZ.kind, t, p:price, pt:pt || 'договорная', ds:ds || 'Без описания',
    a:PROFILE.name[0], n:PROFILE.name, r:5.0, deals:0,
    city:MP_WZ.city, term:MP_WZ.term, views:0, favs:0, contacts:0,
    promo:null, fav:false, my:true, demo:false, st:'mod', seed,
    photos:mpFormPhotos.slice(), reviews:[],
    bargain:MP_WZ.bargain, deliv:MP_WZ.deliv, onlinePay:MP_WZ.onlinePay
  });
  closeSheet();
  toast('Объявление отправлено на модерацию');
  mpNotifPush({ic:'briefcase', who:'Биржа OKO', t:'объявление «'+t+'» отправлено на модерацию', act:()=>{ openMyListings(); }});
  setTimeout(()=>{
    const l = LISTINGS.find(x=>x.id===id);
    if(l && l.st==='mod'){
      l.st = 'act';
      mpNotifPush({ic:'check', who:'Биржа OKO', t:'«'+t+'» опубликовано — уже в поиске', act:()=>{ openListing(id); }});
      if(document.getElementById('marketRoot') && typeof mkView!=='undefined') openMyListings();
    }
  }, 3500);
  openMyListings();
}

/* если пользователь нажал старую кнопку «Разместить объявление», а мы не редактируем — открываем мастер */
const _mpOpenListingFormWiz = openListingForm;
openListingForm = function(id){
  if(id){ _mpOpenListingFormWiz(id); return; } // редактирование — старая простая форма
  mpOpenWizard();
};

/* ============================================================
   V4·E — «Мои объявления»: вкладки active / mod / rejected / archive
   ============================================================ */
let MP_MY_TAB = 'act';
const MP_MY_TABS = [
  ['act',  'Активные',    'briefcase'],
  ['mod',  'На модерации','clock'],
  ['rej',  'Отклонены',   'flag'],
  ['arch', 'Архив',       'trash'],
];
function mpArchiveListing(id){
  const l = LISTINGS.find(x=>x.id===id); if(!l) return;
  l.st = 'arch'; toast('Объявление в архиве'); closeSheet(); openMyListings();
}
function mpRestoreListing(id){
  const l = LISTINGS.find(x=>x.id===id); if(!l) return;
  l.st = 'act'; toast('Объявление снова в поиске'); openMyListings();
}
window.mpArchiveListing = mpArchiveListing;
window.mpRestoreListing = mpRestoreListing;

/* заменяем базовый openMyListings — с вкладками и статусом-причиной */
const _mpOpenMyListingsV4 = openMyListings;
openMyListings = function(){
  const wrap = document.getElementById('marketRoot'); if(!wrap) return;
  const mine = LISTINGS.filter(l=>l.my);
  const cnt = {act:0, mod:0, rej:0, arch:0};
  mine.forEach(l=>{ cnt[l.st] = (cnt[l.st]||0) + (l.st==='sold'?0:1); if(l.st==='sold') cnt.arch++; });
  const tab = MP_MY_TAB;
  const shown = mine.filter(l=> tab==='arch' ? (l.st==='arch'||l.st==='sold') : l.st===tab);
  wrap.innerHTML = `
    <button class="mk-back" onclick="mkView='cats';renderMarket()">${I('back')} Биржа</button>
    <h3 class="mk-h" style="margin-top:6px">Мои объявления</h3>
    <div class="mp-my-tabs">${MP_MY_TABS.map(([k,lab,ic])=>
      `<button class="mp-my-tab ${tab===k?'on':''}" onclick="MP_MY_TAB='${k}';openMyListings()">
        ${I(ic)}<span>${lab}</span>${cnt[k]?`<i>${cnt[k]}</i>`:''}
      </button>`).join('')}</div>
    ${shown.length ? shown.map(l=>{
      const cover = (l.photos && l.photos[0]) ? `<img src="${l.photos[0]}" alt="">` : I(catIco(l.cat));
      const rejReason = l.rejReason || 'Требуется больше информации';
      return `<div class="lst-card mp-my-card" onclick="openListing(${l.id})">
        <div class="lst-photo ${l.photos&&l.photos[0]?'mp-has-photo':''}" style="--h:${(l.seed*37)%360}deg">${cover}</div>
        <div class="lst-body">
          <div class="lst-price">${esc(l.pt||'договорная')}</div>
          <div class="lst-title">${esc(l.t)}</div>
          <div class="lst-meta">${statusChip(l.st==='sold'?'sold':(l.st==='act'?'act':l.st==='mod'?'mod':'act'))} ${l.promo?promoBadge(l.promo):''}</div>
          <div class="lst-foot dim" style="font-size:11.5px">${I('eye')}${fmtN(l.views||0)} · ${I('heart')}${l.favs||0} · ${I('chat')}${l.contacts||0}</div>
          ${l.st==='rej'?`<div class="mp-my-rej">${I('flag')} <b>Отклонено:</b> ${esc(rejReason)}</div>`:''}
          ${l.st==='arch'?`<div class="mp-my-arch">${I('trash')} В архиве · нажми, чтобы восстановить</div>`:''}
          ${l.st==='mod'?`<div class="mp-my-mod">${I('clock')} На модерации · обычно до 5 минут</div>`:''}
        </div>
      </div>`;
    }).join('') : `<div class="mp-my-empty">
      <span class="mp-emp-badge">${I(MP_MY_TABS.find(t=>t[0]===tab)[2])}</span>
      <b>${tab==='act'?'Здесь пусто':tab==='mod'?'Нет объявлений на модерации':tab==='rej'?'Нет отклонённых':'Архив пуст'}</b>
      <p>${tab==='act'?'Разместите объявление — оно появится здесь и в общей ленте после короткой проверки.':'Всё в порядке · ничего не требует внимания'}</p>
      ${tab==='act'?`<button class="btn" onclick="mpOpenWizard()">${I('plus')} Разместить объявление</button>`:''}
    </div>`}
    <button class="btn mp-my-add" onclick="mpOpenWizard()">${I('plus')} Разместить новое объявление</button>`;
};

/* при открытии карточки МОЕГО объявления — добавим кнопки Архив/Восстановить/Удалить */
const _mpOpenListingMyActions = openListing;
openListing = function(id){
  _mpOpenListingMyActions.apply(this, arguments);
  try{
    const l = LISTINGS.find(x=>x.id===id);
    const v = document.getElementById('lstView');
    if(!l || !v || !l.my) return;
    if(v.querySelector('.mp-my-act')) return;
    const row = document.createElement('div');
    row.className = 'mp-my-act';
    row.innerHTML = (l.st==='arch' || l.st==='sold')
      ? `<button class="btn ghost" onclick="mpRestoreListing(${l.id})">${I('check')} Восстановить</button>
         <button class="btn ghost" onclick="removeListing(${l.id})">${I('trash')} Удалить</button>`
      : `<button class="btn ghost" onclick="mpArchiveListing(${l.id})">${I('trash')} В архив</button>
         <button class="btn ghost" onclick="removeListing(${l.id})">${I('trash')} Удалить</button>`;
    v.appendChild(row);
  }catch(e){}
};

/* ============================================================
   V4·F — Уведомления по бирже (единый publisher)
   ============================================================ */
function mpNotifPush(o){
  try{
    if(typeof NOTIFS==='undefined') return;
    NOTIFS.unshift({ic:o.ic||'briefcase', who:o.who||'Биржа OKO', t:o.t||'', time:'сейчас', g:'Сегодня', unread:true, act:o.act||(()=>{})});
    if(typeof updateNotifDot==='function') updateNotifDot();
  }catch(e){}
}
/* Хук на bump — «Твоё объявление в топе» */
const _mpBumpDoNotif = (typeof mpBumpDo==='function') ? mpBumpDo : null;
if(_mpBumpDoNotif){
  mpBumpDo = function(id){
    const before = MP.bumps && MP.bumps[id];
    _mpBumpDoNotif(id);
    setTimeout(()=>{
      const after = MP.bumps && MP.bumps[id];
      if(after && after !== before){
        const l = LISTINGS.find(x=>x.id===id);
        if(l) mpNotifPush({ic:'rocket', who:'Биржа OKO', t:'«'+l.t+'» в топе категории · +24 часа показов', act:()=>{ openListing(id); }});
      }
    }, 400);
  };
  window.mpBumpDo = mpBumpDo;
}

/* ============================================================
   V4·G — Радиус на мини-карте (кольцо вокруг «вы здесь»)
   ============================================================ */
const _mpMapV4 = mpMap;
mpMap = function(){
  const html = _mpMapV4();
  if(!html) return html;
  const km = mkFilters.mpRadius || 15;
  const rPx = Math.min(60, 15 + km*0.8);
  const ring = `<svg class="mp-map-ring" viewBox="0 0 320 130" preserveAspectRatio="none">
    <circle cx="16" cy="115" r="${rPx}" fill="none" stroke="rgba(154,255,0,.28)" stroke-dasharray="3 4"/>
    <circle cx="16" cy="115" r="4" fill="#9AFF00"/>
  </svg>
  <span class="mp-map-radius">${I('pos')} радиус · ${km} км</span>`;
  return html.replace('<span class="mp-map-me">', ring + '<span class="mp-map-me">');
};

/* ============================================================
   V4·H — Плашка «Безопасная сделка» в списочной ленте (баннер сверху)
   ============================================================ */
function mpSafetyBanner(){
  const root = document.getElementById('marketRoot');
  if(!root) return;
  if(document.getElementById('mpSafetyBan')) return;
  const toolbar = root.querySelector('.mk-toolbar');
  if(!toolbar) return;
  const el = document.createElement('div');
  el.id = 'mpSafetyBan';
  el.className = 'mp-safety-ban';
  el.innerHTML = `<span class="mp-safety-ic">${I('lock')}</span>
    <span class="mp-safety-b"><b>Не переводите деньги вне OKO</b><small>Все сделки — только через безопасную оплату эскроу. Иначе площадка не защитит.</small></span>
    <button class="mp-safety-x" onclick="mpDismissSafety()" aria-label="Скрыть">${I('back')}</button>`;
  toolbar.insertAdjacentElement('afterend', el);
}
function mpDismissSafety(){
  try{ localStorage.setItem('oko-mp-safety-dismissed', '1'); }catch(e){}
  const el = document.getElementById('mpSafetyBan'); if(el) el.remove();
}
window.mpDismissSafety = mpDismissSafety;

if(typeof renderMarketList==='function'){
  const _mpRMLsafety = renderMarketList;
  renderMarketList = function(){
    _mpRMLsafety.apply(this, arguments);
    try{
      let dismissed = false;
      try{ dismissed = localStorage.getItem('oko-mp-safety-dismissed')==='1'; }catch(e){}
      if(!dismissed) mpSafetyBanner();
    }catch(e){}
  };
}

/* ============================================================
   V4·I — Финальная обёртка renderMarketCats: 2-уровневая группировка Услуги/Товары
   ============================================================ */
/* добавляем 3 «товарных» категории (одежда/электроника/дом) в конец каталога */
(function mpAddGoodsCats(){
  const has = k => MK_CATS.some(c=>c.k===k);
  const extras = [
    {k:'goods-cloth',   name:'Одежда и обувь', ic:'sticker', kind:'goods'},
    {k:'goods-tech',    name:'Электроника',    ic:'device',  kind:'goods'},
    {k:'goods-home',    name:'Дом и сад',      ic:'globe',   kind:'goods'},
  ];
  extras.forEach(e=>{ if(!has(e.k)) MK_CATS.push(e); });
  /* маркируем существующие как услуги, если не помечено */
  MK_CATS.forEach(c=>{ if(!c.kind) c.kind = 'service'; });
})();

/* поверх cats-рендера базы — перестраиваем сетку в 2 группы, если раньше рендерилось линейно */
function mpGroupCats(){
  const root = document.getElementById('marketRoot'); if(!root) return;
  const grid = root.querySelector('.mk-cats'); if(!grid) return;
  if(root.querySelector('.mp-catsg')) return;
  const services = MK_CATS.filter(c=>c.kind==='service');
  const goods    = MK_CATS.filter(c=>c.kind==='goods');
  const build = (list) => list.map(c=>{
    const n = mpVisibleListings().filter(l=>l.cat===c.k && !l.my).length;
    return `<button class="mk-cat" onclick="openMarketCat('${c.k}')"><span class="mk-cat-ic">${I(c.ic)}</span><b>${esc(c.name)}</b><small>${n} объявл.</small></button>`;
  }).join('');
  const wrap = document.createElement('div');
  wrap.className = 'mp-catsg';
  wrap.innerHTML = `
    <div class="mp-catsg-head">${I('briefcase')} <b>Услуги</b><small>${services.length} категорий</small></div>
    <div class="mk-cats">${build(services)}</div>
    <div class="mp-catsg-head" style="margin-top:14px">${I('photo')} <b>Товары</b><small>${goods.length} категорий</small></div>
    <div class="mk-cats">${build(goods)}</div>`;
  grid.replaceWith(wrap);
}
const _mpRenderMarketGroup = renderMarket;
renderMarket = function(){
  _mpRenderMarketGroup();
  try{ if(typeof mkView!=='undefined' && mkView==='cats') mpGroupCats(); }catch(e){}
};

/* ============================================================
   V4·J — Инъекция safety-баннера на карточке (нижняя приписка под CTA)
   ============================================================ */
const _mpOpenListingSafeCta = openListing;
openListing = function(id){
  _mpOpenListingSafeCta.apply(this, arguments);
  try{
    const l = LISTINGS.find(x=>x.id===id);
    const v = document.getElementById('lstView');
    if(!l || !v || l.my) return;
    if(v.querySelector('.mp-safety-inline')) return;
    const cta = v.querySelector('.lst-cta') || v.querySelector('#mpContact');
    if(!cta) return;
    const note = document.createElement('div');
    note.className = 'mp-safety-inline';
    note.innerHTML = `${I('lock')} <span>Все расчёты — только через безопасную оплату OKO. Прямые переводы площадка не защищает.</span>`;
    cta.insertAdjacentElement('afterend', note);
  }catch(e){}
};

/* ---------- сид «настоящих» уведомлений: только для не-owner фильтруем демо ---------- */
(function mpFilterDemoNotifs(){
  try{
    if(mpIsDemo() || typeof NOTIFS==='undefined') return;
    /* базовые сиды в NOTIFS упоминают Марк/Артём и т.п. — оставим только Биржу и системные */
    const demoWho = ['Лиза Кот','Артём Слов','Сергей Дан','+3 подписчика','Партнёрка'];
    NOTIFS = NOTIFS.filter(n=> !demoWho.includes(n.who));
    if(typeof updateNotifDot==='function') updateNotifDot();
  }catch(e){}
})();

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
if(document.getElementById('ma-market') && document.getElementById('ma-market').style.display==='block') renderMarket();
