/* ================= ADMIN-HQ: админка владельца + окно штаба OKO HQ =================
   Опирается на core-ext: isOwner, adminLogin, showPopup, okoRevenueTotal, OKO_REVENUE,
   fmtMoney, okoEarn. Патчит: openAdmin (гейт), renderAdmin (вкладки Доходы/Штаб HQ),
   admModer (ИИ-модерация сверху), admOverview (KPI дохода), renderMyProfile (чип CEO). */

/* ---------- иконка i-shield (безопасность) в общий defs ---------- */
(function hqAddIcons(){
  const defs = document.querySelector('svg defs');
  if(!defs || document.getElementById('i-shield')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
  s.setAttribute('id','i-shield'); s.setAttribute('viewBox','0 0 100 100');
  s.innerHTML = '<path d="M50 12l30 12v22c0 20-13 34-30 42-17-8-30-22-30-42V24l30-12z" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M37 50l10 10 17-20" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';
  defs.appendChild(s);
})();

/* ---------- состояние модуля ---------- */
const HQ_STATE = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-admin-hq'))||{}; }catch(e){ return {}; } })();
function hqSave(){ try{ localStorage.setItem('oko-admin-hq', JSON.stringify(HQ_STATE)); }catch(e){} }

/* ---------- действия админа по юзерам (бан/галочка) — персист oko-admin-actions ---------- */
const HQ_ACT = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-admin-actions'))||{users:{}}; }catch(e){ return {users:{}}; } })();
HQ_ACT.users = HQ_ACT.users || {};
function hqActSave(){ try{ localStorage.setItem('oko-admin-actions', JSON.stringify(HQ_ACT)); }catch(e){} }
(function hqRestoreVerified(){ /* выданные галочки переживают перезагрузку */
  if(typeof VERIFIED === 'undefined') return;
  Object.keys(HQ_ACT.users).forEach(n=>{ if(HQ_ACT.users[n].ver) VERIFIED.add(n); });
})();

/* ---------- демо-наполнение выручки OKO (один раз, реальные источники okoEarn) ---------- */
(function hqSeedRevenue(){
  if(HQ_STATE.revSeeded) return;
  if(typeof OKO_REVENUE === 'undefined') return;
  const D = 864e5, now = Date.now();
  // [днейНазад, сумма, источник] — те же метки src, что шлют модули через okoEarn()
  const seed = [
    [0.10, 1490, 'Тарифы'],          [0.22, 250,  'Комиссия Биржи 10%'],
    [0.35, 349,  'Продвижение'],     [0.60, 120,  'Игры: рулетка'],
    [0.90, 3000, 'Рекламный кабинет'],[1.15, 45,   'Комиссия вывода'],
    [1.40, 2990, 'Тарифы'],          [1.85, 890,  'Комиссия Биржи 10%'],
    [2.30, 60,   'Игры: дорога'],    [3.10, 990,  'Продвижение'],
    [3.70, 1490, 'Тарифы'],          [4.20, 340,  'Игры: рулетка'],
    [5.05, 1500, 'Рекламный кабинет'],[5.80, 320,  'Комиссия Биржи 10%'],
    [6.40, 120,  'Комиссия вывода'], [7.25, 4990, 'Тарифы'],
    [8.10, 590,  'Продвижение'],     [9.00, 150,  'Игры: дорога'],
    [10.2, 1200, 'Комиссия Биржи 10%'],[11.4, 990, 'Тарифы'],
    [12.6, 5000, 'Рекламный кабинет'],[13.9, 80,  'Игры: рулетка'],
    [15.1, 450,  'Комиссия Биржи 10%'],[16.8, 349, 'Продвижение'],
    [18.0, 2990, 'Тарифы'],          [19.5, 75,   'Комиссия вывода'],
    [21.2, 210,  'Игры: рулетка'],   [23.0, 1000, 'Рекламный кабинет'],
    [24.8, 150,  'Комиссия Биржи 10%'],[26.5, 1490,'Тарифы'],
    [28.2, 90,   'Игры: дорога'],    [29.6, 500,  'Комиссия Биржи 10%'],
  ];
  seed.forEach(([d,sum,src])=> OKO_REVENUE.push({sum, src, at: now - d*D}));
  OKO_REVENUE.sort((a,b)=>b.at-a.at);
  try{ localStorage.setItem('oko-revenue', JSON.stringify(OKO_REVENUE)); }catch(e){}
  HQ_STATE.revSeeded = 1; hqSave();
})();

/* ---------- хелперы ---------- */
function hqHM(d){ return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
function hqWhen(at){
  const d = new Date(at), n = new Date();
  if(d.toDateString() === n.toDateString()) return 'сегодня '+hqHM(d);
  if(d.toDateString() === new Date(n-864e5).toDateString()) return 'вчера '+hqHM(d);
  return String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0')+' '+hqHM(d);
}
/* дневные корзины дохода за N дней (учитывают активный фильтр источника) */
function hqDailyBuckets(list, days){
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const out = [];
  for(let i=days-1;i>=0;i--){
    const d0 = start - i*864e5, d1 = d0 + 864e5;
    let sum = 0;
    for(const r of list){ if(r.at>=d0 && r.at<d1) sum += r.sum; }
    out.push({at:d0, sum});
  }
  return out;
}
/* столбчатый график динамики дохода за 14 дней */
function hqRevChart(list){
  const b = hqDailyBuckets(list, 14);
  const peak = b.reduce((m,x)=>Math.max(m,x.sum), 0);
  const max = Math.max(1, peak);
  const cols = b.map((x,i)=>{
    const h = x.sum ? Math.max(5, Math.round(x.sum/max*78)) : 1.5;
    const day = new Date(x.at).getDate();
    const isPk = peak>0 && x.sum===peak;
    return `<div class="hq-col${isPk?' pk':''}" style="--h:${h}%">`
      + `<span class="hq-col-v">+${fmtMoney(Math.round(x.sum))}</span>`
      + `<i style="animation-delay:${(i*0.035).toFixed(3)}s"></i><em>${day}</em></div>`;
  }).join('');
  return `<div class="hq-chart card">
    <div class="hq-chart-h"><small>Динамика дохода · 14 дней</small><b>пик +${fmtMoney(Math.round(peak))}</b></div>
    <div class="hq-chart-plot"><div class="hq-chart-grid"><span style="top:0"></span><span style="top:50%"></span><span style="bottom:0"></span></div>${cols}</div>
  </div>`;
}
/* мини-спарклайн (area+line) для KPI-плитки обзора — весь доход, 14 дней */
function hqMiniSpark(){
  const b = hqDailyBuckets(typeof OKO_REVENUE!=='undefined'?OKO_REVENUE:[], 14);
  const max = Math.max(1, ...b.map(x=>x.sum));
  const n = b.length;
  const xy = b.map((x,i)=>[ +(i/(n-1)*100).toFixed(2), +(19 - (x.sum/max)*17).toFixed(2) ]);
  const line = xy.map(p=>p[0]+','+p[1]).join(' ');
  const area = '0,20 ' + line + ' 100,20';
  const last = xy[xy.length-1];
  return `<svg class="hq-kpi-spark" viewBox="0 0 100 22" preserveAspectRatio="none">`
    + `<polygon class="ar" points="${area}"/>`
    + `<polyline class="ln" points="${line}"/>`
    + `<circle class="dot" cx="${last[0]}" cy="${last[1]}" r="2.4"/></svg>`;
}

/* ==================== 1. ГЕЙТ: раздел владельца ==================== */
const _prevOpenAdminHq = openAdmin;
openAdmin = function(){
  if(typeof isOwner === 'function' && !isOwner()){ hqShowGate(); return; }
  _prevOpenAdminHq();
};
function hqShowGate(){
  showPopup({
    ico:'lock', title:'Раздел владельца',
    body:`Админка и штаб OKO HQ доступны только владельцу. Подтверди личность.
      <div class="hq-gate">
        <input id="hqGateEmail" type="email" inputmode="email" autocomplete="email" placeholder="Email владельца">
        <input id="hqGatePass" type="password" autocomplete="current-password" placeholder="Пароль"
               onkeydown="if(event.key==='Enter')hqGateSubmit()">
        <div class="hq-gate-err" id="hqGateErr"></div>
        <button class="btn" id="hqGateBtn" onclick="hqGateSubmit()">Войти</button>
      </div>`,
    actions:[{label:'Отмена', ghost:true}]
  });
  setTimeout(()=>{ const e=document.getElementById('hqGateEmail'); if(e) e.focus(); }, 60);
}
async function hqGateSubmit(){
  const em = document.getElementById('hqGateEmail'), ps = document.getElementById('hqGatePass'),
        btn = document.getElementById('hqGateBtn'), err = document.getElementById('hqGateErr');
  if(!em || !btn) return;
  btn.disabled = true; btn.textContent = 'Проверка…'; if(err) err.textContent = '';
  let ok = false;
  try{ ok = await adminLogin(em.value, ps ? ps.value : ''); }catch(e){ ok = false; }
  if(ok){
    closePopup();
    toast('Владелец подтверждён');
    if(typeof renderMyProfile === 'function') try{ renderMyProfile(); }catch(e){}
    _prevOpenAdminHq();
    if(hqPendingTab){ admGo(hqPendingTab); hqPendingTab = null; }
  } else {
    btn.disabled = false; btn.textContent = 'Войти';
    if(err) err.textContent = 'Доступ запрещён';
    const card = document.querySelector('#okoPopup .pop-card');
    if(card){ card.classList.remove('hq-shake'); void card.offsetWidth; card.classList.add('hq-shake'); }
  }
}
let hqPendingTab = null;

/* ==================== 2-3. ВКЛАДКИ: Доходы + Штаб HQ ==================== */
ADMIN_TABS.push({k:'revenue', t:'Доходы'});
ADMIN_TABS.push({k:'hq', t:'Штаб HQ'});

const _prevRenderAdminHq = renderAdmin;
renderAdmin = function(){
  if(admTab === 'revenue' || admTab === 'hq'){
    document.getElementById('admTabs').innerHTML = ADMIN_TABS.map(t=>
      `<button class="adm-tab ${admTab===t.k?'on':''}" onclick="admGo('${t.k}')">${t.t}</button>`).join('');
    document.getElementById('admBody').innerHTML = admTab==='revenue' ? hqRevenueView() : hqHqView();
    if(admTab === 'hq') hqStartLog(); else hqStopLog();
    if(admTab === 'revenue' && !hqRevHeroDone){ hqRevHeroDone = true; hqAnimateRevHero(); }
    return;
  }
  hqStopLog();
  _prevRenderAdminHq();
};
const _prevCloseAdminHq = closeAdmin;
closeAdmin = function(){ hqStopLog(); hqRevHeroDone = false; _prevCloseAdminHq(); };

/* count-up дохода при первом открытии вкладки «Доходы» (не повторяется при смене фильтра) */
let hqRevHeroDone = false;
function hqAnimateRevHero(){
  const el = document.querySelector('.hq-rev-total'); if(!el) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const target = Math.round(okoRevenueTotal()), t0 = performance.now(), dur = 900;
  const step = now=>{
    const k = Math.min(1, (now-t0)/dur), e = 1-Math.pow(1-k,3);
    el.textContent = fmtMoney(Math.round(target*e));
    if(k<1) requestAnimationFrame(step); else el.textContent = fmtMoney(target);
  };
  requestAnimationFrame(step);
}

/* ---------- вкладка «Доходы» ---------- */
const HQ_SRC_ICO = {
  'Тарифы':'crown', 'Комиссия Биржи 10%':'briefcase', 'Рекламный кабинет':'megaphone',
  'Продвижение':'rocket', 'Игры: рулетка':'fire', 'Игры: дорога':'fire', 'Комиссия вывода':'card'
};
let hqRevSrc = 'all', hqRevSrcs = ['all'];
function hqRevFilter(i){ hqRevSrc = hqRevSrcs[i] || 'all'; renderAdmin(); }
function hqRevenueView(){
  const total = Math.round(okoRevenueTotal());
  const now = new Date();
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const mSum = Math.round(OKO_REVENUE.filter(r=>r.at>=mStart).reduce((s,r)=>s+r.sum,0));
  const dim = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const proj = Math.round(now.getDate() ? mSum / now.getDate() * dim : 0);

  // агрегация по источникам
  const by = {};
  OKO_REVENUE.forEach(r=>{ by[r.src] = (by[r.src]||0) + r.sum; });
  const srcs = Object.keys(by).map(k=>({src:k, sum:by[k]})).sort((a,b)=>b.sum-a.sum);
  const max = srcs.length ? srcs[0].sum : 1;

  // фильтр по источнику (чипы)
  hqRevSrcs = ['all'].concat(srcs.map(s=>s.src));
  if(hqRevSrc !== 'all' && !by[hqRevSrc]) hqRevSrc = 'all';
  const list = hqRevSrc==='all' ? OKO_REVENUE : OKO_REVENUE.filter(r=>r.src===hqRevSrc);
  const chips = hqRevSrcs.map((s,i)=>
    `<button class="hq-chip ${hqRevSrc===s?'on':''}" onclick="hqRevFilter(${i})">${s==='all'?'Все источники':esc(s)}</button>`).join('');

  // суммы за периоды (по активному фильтру)
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const per = from=>{ const a=list.filter(r=>r.at>=from); return {s:Math.round(a.reduce((x,r)=>x+r.sum,0)), n:a.length}; };
  const pT = per(dayStart), p7 = per(Date.now()-7*864e5), p30 = per(Date.now()-30*864e5);
  const perRow = (l,p)=>`<div class="hq-per"><span>${l}</span><small>${p.n} опер.</small><b>+${fmtMoney(p.s)}</b></div>`;

  const srcRows = srcs.map((s,i)=>`
    <div class="hq-src ${hqRevSrc===s.src?'on':''}" style="animation-delay:${i*0.05}s" onclick="hqRevFilter(${hqRevSrc===s.src?0:i+1})">
      <div class="hq-src-t"><b>${esc(s.src)}</b><span><i>${fmtMoney(Math.round(s.sum))}</i> · ${total?Math.round(s.sum/total*100):0}%</span></div>
      <div class="hq-bar"><i style="width:${Math.max(3, s.sum/max*100)}%"></i></div>
    </div>`).join('');

  const ops = list.slice(0,30).map(r=>`
    <div class="adm-row">
      <span class="hq-op-ic">${I(HQ_SRC_ICO[r.src]||'money')}</span>
      <span class="adm-main"><b>${esc(r.src)}</b><small>${hqWhen(r.at)}</small></span>
      <span class="hq-op-sum">+${fmtMoney(Math.round(r.sum))}</span>
    </div>`).join('');

  return `
    <div class="hq-rev-hero card">
      <small>Доход OKO — всего</small>
      <b class="hq-rev-total">${fmtMoney(total)}</b>
      <div class="hq-rev-sub">за этот месяц <b>${fmtMoney(mSum)}</b> · проекция месяца <b>${fmtMoney(proj)}</b></div>
    </div>
    <div class="hq-chips">${chips}</div>
    ${hqRevChart(list)}
    <div class="adm-sec-h">Суммы${hqRevSrc!=='all' ? ' · '+esc(hqRevSrc) : ''}</div>
    <div class="hq-pers card">${perRow('Сегодня',pT)}${perRow('7 дней',p7)}${perRow('30 дней',p30)}</div>
    <div class="adm-sec-h">По источникам</div>
    ${srcRows || '<p class="dim" style="font-size:13px">Пока нет операций — доход копится из комиссий, тарифов и рекламы.</p>'}
    <div class="adm-sec-h">Операции${hqRevSrc!=='all' ? ' · '+esc(hqRevSrc) : ''} (${Math.min(30, list.length)})</div>
    ${ops || '<p class="dim" style="font-size:13px">По этому источнику операций пока нет.</p>'}
    <div class="adm-acts"><button class="adm-btn" onclick="hqExportReport()">${I('file')} Выгрузить отчёт (.txt)</button></div>`;
}

/* ---------- экспорт: .txt-сводка владельца ---------- */
function hqExportReport(){
  const L = [], now = new Date();
  const pad = n=>String(n).padStart(2,'0');
  const stamp = pad(now.getDate())+'.'+pad(now.getMonth()+1)+'.'+now.getFullYear()+' '+hqHM(now);
  L.push('OKO — СВОДНЫЙ ОТЧЁТ ВЛАДЕЛЬЦА');
  L.push('Сформирован: '+stamp);
  L.push('==============================================');

  /* пользователи */
  L.push('', 'ПОЛЬЗОВАТЕЛИ');
  const k = ADMIN.kpi;
  L.push('Всего: '+k.users.toLocaleString('ru')+' · активных сегодня: '+k.dau+' · отток: '+k.churn+'%');
  ADMIN.users.forEach(u=>{
    const a = HQ_ACT.users[u.n] || {};
    const fl = [u.tier];
    if(typeof VERIFIED !== 'undefined' && VERIFIED.has(u.n)) fl.push('галочка');
    if(a.ban) fl.push('БАН');
    L.push('  '+u.n+' ('+u.h+') — '+fl.join(' · ')+' — '+u.when);
  });

  /* доходы по источникам */
  L.push('', 'ДОХОДЫ ПО ИСТОЧНИКАМ');
  const by = {}; OKO_REVENUE.forEach(r=>{ by[r.src]=(by[r.src]||0)+r.sum; });
  const total = Math.round(okoRevenueTotal());
  Object.keys(by).sort((a,b)=>by[b]-by[a]).forEach(s=>{
    L.push('  '+s+': '+fmtMoney(Math.round(by[s]))+' ('+(total?Math.round(by[s]/total*100):0)+'%)');
  });
  const sumFrom = from=>Math.round(OKO_REVENUE.filter(r=>r.at>=from).reduce((x,r)=>x+r.sum,0));
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  L.push('Итого: '+fmtMoney(total)+' · сегодня '+fmtMoney(sumFrom(dayStart))
    +' · 7д '+fmtMoney(sumFrom(Date.now()-7*864e5))+' · 30д '+fmtMoney(sumFrom(Date.now()-30*864e5)));

  /* рекламные кампании */
  L.push('', 'РЕКЛАМНЫЕ КАМПАНИИ');
  if(typeof ADS !== 'undefined' && ADS.camps && ADS.camps.length){
    ADS.camps.forEach(c=>{
      const st = (typeof ADS_STATUS !== 'undefined' && ADS_STATUS[c.status]) ? ADS_STATUS[c.status].l : c.status;
      L.push('  '+c.name+' — '+st+' · бюджет '+fmtMoney(c.budget)+' · откручено '+fmtMoney(Math.round(c.spent))
        +' · '+(c.imps||0).toLocaleString('ru')+' показов · '+(c.clicks||0).toLocaleString('ru')+' кликов');
    });
  } else L.push('  нет данных');

  /* сделки биржи */
  L.push('', 'СДЕЛКИ БИРЖИ (эскроу)');
  if(typeof MP !== 'undefined' && MP.deals && MP.deals.length){
    const stL = {work:'в работе', wait:'на подтверждении', done:'завершена'};
    MP.deals.forEach(d=> L.push('  '+d.t+' — '+d.n+' · '+fmtMoney(d.sum)+' · '+(stL[d.st]||d.st)));
  } else L.push('  нет данных');

  L.push('', '==============================================', 'OKO · штаб владельца · отчёт сформирован автоматически');

  const fname = 'oko-report-'+now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate())+'.txt';
  const url = URL.createObjectURL(new Blob(['﻿'+L.join('\n')], {type:'text/plain;charset=utf-8'}));
  const a = document.createElement('a');
  a.href = url; a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
  toast('Отчёт выгружен: '+fname);
}

/* ==================== 2b. ПОЛЬЗОВАТЕЛИ: поиск / фильтр / бан / галочка / написать ==================== */
let hqUsrQ = '', hqUsrFilter = 'all';
const HQ_USR_FILTERS = [
  {k:'all',  l:'Все'}, {k:'paid', l:'Платные'}, {k:'free', l:'Бесплатные'},
  {k:'ver',  l:'С галочкой'}, {k:'ban',  l:'Забаненные'},
];
function hqUsrMatch(u){
  const a = HQ_ACT.users[u.n] || {};
  const ver = (typeof VERIFIED!=='undefined' && VERIFIED.has(u.n));
  if(hqUsrFilter==='paid' && !u.paid) return false;
  if(hqUsrFilter==='free' && u.paid) return false;
  if(hqUsrFilter==='ver'  && !ver) return false;
  if(hqUsrFilter==='ban'  && !a.ban) return false;
  if(hqUsrQ && (u.n+' '+u.h).toLowerCase().indexOf(hqUsrQ.toLowerCase()) < 0) return false;
  return true;
}
/* сохраняем оригинальный индекс в ADMIN.users — действия работают по нему при любом фильтре */
function hqUsrList(){ return ADMIN.users.map((u,i)=>({u,i})).filter(x=>hqUsrMatch(x.u)); }
function hqUserRow(u, i){
  const a = HQ_ACT.users[u.n] || {};
  const ver = (typeof VERIFIED!=='undefined' && VERIFIED.has(u.n));
  return `
    <div class="adm-row hq-usr ${a.ban?'ban':''}">
      <div class="hq-usr-top">
        <span class="adm-ava">${esc(u.n[0])}</span>
        <span class="adm-main"><b>${esc(u.n)}${typeof vBadge==='function' ? vBadge(u.n) : ''}</b><small>${esc(u.h)} · ${esc(u.when)}</small></span>
        ${a.ban ? '<span class="adm-tag no">БАН</span>' : ''}
        <span class="adm-tag ${u.paid?'paid':'free'}">${esc(u.tier)}</span>
      </div>
      <div class="hq-usr-acts">
        <button class="adm-btn ${a.ban?'':'dng'}" onclick="hqUserBan(${i})">${a.ban?'Разбанить':'Забанить'}</button>
        <button class="adm-btn" onclick="hqUserVerify(${i})">${ver ? 'Снять галочку' : 'Выдать галочку'}</button>
        <button class="adm-btn pri" onclick="hqUserMsg(${i})">Написать</button>
      </div>
    </div>`;
}
function hqUsrListHtml(){
  const list = hqUsrList();
  if(!list.length) return `<p class="dim hq-usr-empty">Никого не найдено${hqUsrQ?' по запросу «'+esc(hqUsrQ)+'»':' по этому фильтру'}.</p>`;
  return list.map(x=>hqUserRow(x.u, x.i)).join('');
}
/* обновляем ТОЛЬКО список — поле поиска не пересоздаётся, фокус/каретка сохраняются */
function hqUsrRenderList(){
  const box = document.getElementById('hqUsrList'); if(box) box.innerHTML = hqUsrListHtml();
  const c = document.getElementById('hqUsrCount'); if(c) c.textContent = hqUsrList().length;
}
function hqUsrSearch(v){ hqUsrQ = v; hqUsrRenderList(); }
function hqUsrSetFilter(k){
  hqUsrFilter = k;
  const chips = document.getElementById('hqUsrChips');
  if(chips) chips.querySelectorAll('.hq-chip').forEach(el=>el.classList.toggle('on', el.dataset.k===k));
  hqUsrRenderList();
}
const _prevAdmUsersHq = admUsers; /* базовый рендер заменён расширенным (chain сохранён) */
admUsers = function(){
  const chips = HQ_USR_FILTERS.map(f=>
    `<button class="hq-chip ${hqUsrFilter===f.k?'on':''}" data-k="${f.k}" onclick="hqUsrSetFilter('${f.k}')">${f.l}</button>`).join('');
  return `
    <div class="adm-sec-h">Пользователи · <span id="hqUsrCount">${hqUsrList().length}</span> из ${ADMIN.users.length}</div>
    <div class="hq-usr-search">${I('search')}<input id="hqUsrInput" placeholder="Поиск по имени или @нику" value="${esc(hqUsrQ)}" oninput="hqUsrSearch(this.value)" autocomplete="off"></div>
    <div class="hq-chips" id="hqUsrChips">${chips}</div>
    <div id="hqUsrList">${hqUsrListHtml()}</div>
    <div class="adm-acts"><button class="adm-btn" onclick="hqExportReport()">${I('file')} Выгрузить отчёт (.txt)</button></div>`;
};
function hqUserBan(i){
  const u = ADMIN.users[i]; if(!u) return;
  const a = HQ_ACT.users[u.n] = HQ_ACT.users[u.n] || {};
  a.ban = a.ban ? 0 : 1;
  hqActSave();
  if(admTab==='users') hqUsrRenderList(); else renderAdmin();
  toast(a.ban ? 'Пользователь '+u.n+' забанен' : u.n+' разбанен — доступ восстановлен');
}
function hqUserVerify(i){
  const u = ADMIN.users[i]; if(!u || typeof VERIFIED === 'undefined') return;
  const a = HQ_ACT.users[u.n] = HQ_ACT.users[u.n] || {};
  if(VERIFIED.has(u.n)){ VERIFIED.delete(u.n); a.ver = 0; toast('Галочка снята: '+u.n); }
  else { VERIFIED.add(u.n); a.ver = 1; toast('Галочка выдана: '+u.n); }
  hqActSave();
  if(admTab==='users') hqUsrRenderList(); else renderAdmin();
}
function hqUserMsg(i){
  const u = ADMIN.users[i]; if(!u) return;
  let c = CHATS.find(x=>x.kind==='direct' && x.name===u.n);
  if(!c){
    c = {id:'hq-u'+i, ava:u.n[0], name:u.n, kind:'direct', nick:(u.h||'').replace('@',''), kindIcon:null,
         preview:'Диалог начат из админки', time:hqHM(new Date()), unread:0, online:false,
         msgs:[{kind:'sys', body:'Диалог с пользователем открыт владельцем из админки OKO'}]};
    CHATS.unshift(c);
  }
  closeAdmin();
  showTab('chats');
  const s = document.getElementById('chatSearch');
  renderChatList(s ? s.value : '');
  openConv(c.id);
}

/* ---------- вкладка «Штаб HQ» ---------- */
const HQ_ROOMS = [
  {n:'Финансы',      ic:'money',     c:'#d4af37', s:'КУДиР ведётся · налог отложен', live:1,
    d:'Учёт доходов и расходов, резерв под налог УСН, сверка эквайринга и выплат партнёрам.',
    k:[['выручка·мес','+184к ₽'],['налог отложен','11 040 ₽'],['на выплаты','$213'],['сверка','ОК']]},
  {n:'Юридический',  ic:'file',      c:'#ef4444', s:'договор №14 на проверке 161-ФЗ', live:1,
    d:'Договоры, оферты, проверка по 152-ФЗ и 161-ФЗ, контроль реквизитов в диалогах.',
    k:[['в работе','3 док.'],['проверка 161-ФЗ','1'],['оферты','актуальны'],['риски','0']]},
  {n:'Безопасность', ic:'shield',    c:'#9AFF00', s:'аптайм 99.98% · 0 инцидентов', live:1,
    d:'Мониторинг аптайма, антифрод, автоблок скам-реквизитов, защита аккаунтов от угона.',
    k:[['аптайм·30д','99.98%'],['инциденты','0'],['автоблоков','46'],['2FA','вкл']]},
  {n:'Research Lab', ic:'search',    c:'#4aa0ff', s:'разбор ниши · 2 отчёта в мозг', live:1,
    d:'Разбор ниш и конкурентов от 1М просмотров, тренды форматов, отчёты в общий мозг.',
    k:[['разобрано','14 конк.'],['отчётов·нед','2'],['трендов','6'],['в мозг','сохр.']]},
  {n:'War-room',     ic:'fire',      c:'#ff7a3c', s:'1 горячий лид · планёрка 16:00', live:1,
    d:'Оперативный штаб по горячим сделкам: разбор лидов, дожим, эскалация продаж.',
    k:[['горячих лидов','1'],['в воронке','12'],['планёрка','16:00'],['конверсия','23%']]},
  {n:'Comms',        ic:'megaphone', c:'#22d3ee', s:'3 канала · автоответы вкл', live:0,
    d:'Внешние коммуникации, автоответы в каналах, модерация комментариев и заявок.',
    k:[['каналов','3'],['автоответы','вкл'],['ответ·ср','41 сек'],['очередь','0']]},
  {n:'Publishing',   ic:'rocket',    c:'#a855f7', s:'очередь: 3 ролика · пост 18:00', live:1,
    d:'Конвейер контента: сборка роликов, календарь автопостинга, контроль расписания.',
    k:[['в очереди','3 ролика'],['пост сегодня','18:00'],['за неделю','19'],['статус','по плану']]},
  {n:'HR / Найм',    ic:'users',     c:'#ff6bad', s:'прогрев 2 новых аккаунтов', live:0,
    d:'Прогрев и распределение аккаунтов, онбординг новых агентов и ролей штаба.',
    k:[['прогрев','2 акк.'],['агентов','10'],['ролей','8'],['резерв','2']]},
];
const HQ_AGENTS = [
  {id:'ceo',      role:'Гендиректор', c:'#9AFF00', st:'work',  p:72, task:'аппрув КП для MedCraft',
    pool:['обход штаба · раздача задач','смотрит дашборд выручки','аппрув договора №14','планёрка war-room 16:00']},
  {id:'sales',    role:'Sales',       c:'#4aa0ff', st:'work',  p:44, task:'дожим лида @stomat_pro — стадия КП',
    pool:['называет цену @beauty_msk','отправка КП клинике «Дента»','прогрев базы · 12 лидов','горячий лид → war-room']},
  {id:'editor',   role:'Editor',      c:'#a855f7', st:'work',  p:63, task:'рендер урока 2 Академии',
    pool:['монтаж Reels ЗооОпт №3','караоке-субтитры урока 3','цветокор ролика MedCraft','сборка тест-ролика клиенту']},
  {id:'designer', role:'Designer',    c:'#ff7a3c', st:'think', p:28, task:'обложка «Цинк» для MedCraft',
    pool:['карточка товара ЗооОпт','баннер тарифов OKO','обложка урока 4','макет сторис ×3']},
  {id:'marketer', role:'Marketer',    c:'#22d3ee', st:'work',  p:51, task:'воронка для ниши стоматологий',
    pool:['разбор ниши «фитнес»','контент-план ЗооОпт · август','сегменты ЦА для рекламы','A/B оффер тарифов']},
  {id:'legal',    role:'Legal',       c:'#d4af37', st:'wait',  p:90, task:'договор №14 · проверка 161-ФЗ',
    pool:['оферта для Академии','проверка ПД по 152-ФЗ','договор для @beauty_msk','чек реквизитов lava']},
  {id:'copy',     role:'Copy',        c:'#ff6bad', st:'work',  p:37, task:'5 хуков для Reels ЗооОпт',
    pool:['скрипт прогрева ×3','заголовки лендинга OKO','пост-анонс Академии','оффер для стоматологий']},
  {id:'support',  role:'Support',     c:'#34d399', st:'work',  p:81, task:'тикет #218: не приходит код входа',
    pool:['тикет #221: возврат за тариф','FAQ по кошельку','онбординг нового PRO','тикет #224: смена ника']},
  {id:'factory',  role:'Factory',     c:'#facc15', st:'work',  p:58, task:'очередь: 3 ролика · постинг 18:00',
    pool:['ролик/день ЗооОпт · сборка','аналитика охватов 10:00','усиление залетевшего формата','календарь автопостинга']},
  {id:'assist',   role:'Assistants',  c:'#8892a0', st:'think', p:19, task:'парсинг конкурентов от 1М просмотров',
    pool:['разбор загрузок в мозг','ресёрч трендов Reels','OCR договора-скана','подбор номеров для прогрева']},
];
const HQ_ST_LABEL = {work:'в работе', wait:'ожидает', think:'думает'};
const HQ_LOG_POOL = [
  {a:'designer', m:'обложка урока 2 готова'},
  {a:'sales',    m:'лид @stomat_pro перешёл на стадию «КП отправлено»'},
  {a:'editor',   m:'рендер 72% · субтитры синхронизированы'},
  {a:'legal',    m:'договор №14 чист по 161-ФЗ · передан CEO'},
  {a:'factory',  m:'ролик №3 ушёл в очередь автопостинга'},
  {a:'marketer', m:'воронка стоматологий: CPL прогноз 210 ₽'},
  {a:'support',  m:'тикет #218 закрыт · пользователь доволен'},
  {a:'copy',     m:'3 хука из 5 готовы · A/B на завтра'},
  {a:'assist',   m:'спарсено 14 конкурентов · отчёт в мозг'},
  {a:'ceo',      m:'аппрув КП MedCraft · отправить сегодня'},
  {a:'sales',    m:'новый входящий лид из ВК · передан в воронку'},
  {a:'factory',  m:'аналитика 10:00 собрана · охваты +18%'},
  {a:'editor',   m:'урок 2: финальный экспорт 1080×1920'},
  {a:'legal',    m:'блокирован Сбер-реквизит в диалоге · заменён на lava'},
  {a:'designer', m:'баннер тарифов · 2 варианта на выбор'},
  {a:'support',  m:'среднее время ответа за час: 41 сек'},
  {a:'marketer', m:'сегмент ЦА «владельцы клиник» готов'},
  {a:'assist',   m:'OCR скана завершён · данные в vault'},
  {a:'copy',     m:'заголовки лендинга: 6 вариантов в тесте'},
  {a:'ceo',      m:'выручка дня выше плана · штабу зачёт'},
];
let HQ_LOG = [];
(function hqSeedLog(){
  const now = Date.now();
  let t = now;
  for(let i=0;i<13;i++){
    t -= (60 + Math.random()*180) * 1000;
    const e = HQ_LOG_POOL[(HQ_LOG_POOL.length - 1 - i) % HQ_LOG_POOL.length];
    HQ_LOG.push({t: hqHM(new Date(t)), a: e.a, m: e.m});
  }
})();
/* ---------- онлайн-мониторинг: «сейчас в приложении» + спарклайн ---------- */
let hqOnline = 0, hqOnlineHist = [];
(function hqSeedOnline(){
  let v = 380 + Math.floor(Math.random()*60);
  for(let i=0;i<24;i++){
    v = Math.max(300, Math.min(520, v + Math.floor(Math.random()*17) - 8));
    hqOnlineHist.push(v);
  }
  hqOnline = hqOnlineHist[hqOnlineHist.length-1];
})();
function hqSparkSvg(){
  const h = hqOnlineHist;
  const min = Math.min.apply(null,h) - 6, max = Math.max.apply(null,h) + 6;
  const pts = h.map((v,i)=>((i/(h.length-1))*100).toFixed(1)+','+(26-(v-min)/(max-min)*22).toFixed(1)).join(' ');
  return `<svg class="hq-spark" viewBox="0 0 100 28" preserveAspectRatio="none">
    <polygon points="0,28 ${pts} 100,28" fill="var(--lime-dim)"/>
    <polyline points="${pts}" fill="none" stroke="var(--lime)" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}
function hqOnlineBlock(){
  return `<div class="hq-online card">
    <div class="hq-on-l">
      <small><i class="hq-dot work"></i> Сейчас в приложении</small>
      <b id="hqOnlineN">${hqOnline}</b>
      <span class="hq-on-d" id="hqOnlineD">live · пик ${Math.max.apply(null,hqOnlineHist)}</span>
    </div>
    <div class="hq-on-r" id="hqSparkWrap">${hqSparkSvg()}</div>
  </div>`;
}
function hqOnlineTick(){
  const d = Math.floor(Math.random()*19) - 9;
  hqOnline = Math.max(300, Math.min(520, hqOnline + d));
  hqOnlineHist.push(hqOnline); if(hqOnlineHist.length > 24) hqOnlineHist.shift();
  const nEl = document.getElementById('hqOnlineN'); if(nEl) nEl.textContent = hqOnline;
  const dEl = document.getElementById('hqOnlineD');
  if(dEl) dEl.innerHTML = (d>=0 ? '<i class="up">+'+d+'</i>' : '<i class="dn">−'+Math.abs(d)+'</i>')
    + ' за тик · пик '+Math.max.apply(null,hqOnlineHist);
  const sw = document.getElementById('hqSparkWrap'); if(sw) sw.innerHTML = hqSparkSvg();
}

function hqAgent(id){ return HQ_AGENTS.find(a=>a.id===id); }
function hqLogLine(e, fresh){
  const ag = hqAgent(e.a) || {role:'OKO', c:'var(--accent)'};
  return `<div class="hq-ll${fresh?' new':''}"><span class="hq-lt">${e.t}</span><b style="color:${ag.c}">${esc(ag.role)}</b><span class="m">→ ${esc(e.m)}</span></div>`;
}
function hqAgentCard(a, i){
  return `<div class="hq-ag" style="animation-delay:${i*0.04}s">
    <div class="hq-ag-top">
      <span class="hq-ava" style="color:${a.c};background:${a.c}1e"><svg class="i"><use href="#i-logo"/></svg></span>
      <span class="hq-ag-n"><b>${esc(a.role)}</b>
        <span class="hq-ag-st"><i class="hq-dot ${a.st}" id="hq-d-${a.id}"></i><span id="hq-s-${a.id}">${HQ_ST_LABEL[a.st]}</span></span>
      </span>
    </div>
    <div class="hq-ag-task" id="hq-t-${a.id}">${esc(a.task)}</div>
    <div class="hq-bar"><i id="hq-p-${a.id}" style="width:${a.p}%;background:linear-gradient(90deg,${a.c},${a.c}99)"></i></div>
  </div>`;
}
function hqHqView(){
  return `
    <div class="hq-head card">
      <span class="hq-head-eye"><svg class="i"><use href="#i-logo"/></svg></span>
      <div class="hq-head-b">
        <h3>OKO HQ — командный центр</h3>
        <small>10 агентов · 8 отделов · аптайм 99.98%<br>мозг синхронизирован ${hqHM(new Date())}</small>
        <button class="btn sm hq-3d-btn" onclick="hqOpen3d()">${I('share')} Открыть 3D-штаб · новая вкладка</button>
        <small class="hq-3d-note">Тяжёлый 3D вынесен из приложения — открывается отдельной страницей, чтобы не лагало.</small>
      </div>
    </div>
    ${hqOnlineBlock()}
    <div class="adm-sec-h">Отделы</div>
    <div class="hq-rooms">${HQ_ROOMS.map((r,i)=>`
      <button class="hq-room" style="animation-delay:${i*0.04}s" onclick="hqRoomOpen(${i})">
        <span class="hq-room-ic" style="color:${r.c};background:${r.c}1e">${I(r.ic)}</span>
        <b>${esc(r.n)} ${r.live?'<i class="hq-dot work"></i>':''}</b>
        <small>${esc(r.s)}</small>
      </button>`).join('')}</div>
    <div class="adm-sec-h">Агенты (${HQ_AGENTS.length})</div>
    <div class="hq-agents" id="hqAgents">${HQ_AGENTS.map(hqAgentCard).join('')}</div>
    <div class="adm-sec-h">Живой лог штаба</div>
    <div class="hq-log" id="hqLog">${HQ_LOG.map(e=>hqLogLine(e)).join('')}</div>`;
}
/* детальный дашборд отдела: реальные KPI вместо заглушки-тоста */
function hqRoomOpen(i){
  const r = HQ_ROOMS[i]; if(!r) return;
  const kpis = (r.k||[]).map(([l,v])=>
    `<div class="hq-room-kpi"><b>${esc(v)}</b><small>${esc(l)}</small></div>`).join('');
  showPopup({
    ico:r.ic, title:'Отдел · '+r.n,
    body:`<div class="hq-room-pop">
      <div class="hq-room-pop-st"><i class="hq-dot ${r.live?'work':'wait'}"></i>${r.live?'на смене · агент активен':'в резерве · включается по расписанию'}</div>
      ${r.d?`<p class="hq-room-pop-d">${esc(r.d)}</p>`:''}
      <div class="hq-room-kpis">${kpis}</div>
      <div class="hq-room-pop-s">${I('bolt')}<span>${esc(r.s)}</span></div>
    </div>`,
    actions:[{label:'Закрыть'}]
  });
}

/* Абсолютный публичный адрес 3D-штаба. По требованию владельца тяжёлый WebGL НЕ встраивается
   в приложение (лагает в Telegram-webview) — штаб открывается отдельной вкладкой (ссылкой). */
const HQ_URL_ABS = 'https://true-journey-418.higgsfield.app/hq.html';

/* открыть штаб во внешней вкладке: в Telegram → tg.openLink, иначе → window.open */
function hqOpenExternal(){
  const tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  try{ if(tg && typeof tg.openLink === 'function'){ tg.openLink(HQ_URL_ABS); return true; } }catch(e){}
  try{ const w = window.open(HQ_URL_ABS, '_blank', 'noopener'); return !!w; }catch(e){ return false; }
}
function hqOpen3d(){
  if(typeof isOwner === 'function' && !isOwner()){ hqShowGate(); return; }
  try{ localStorage.setItem('oko-hq-auth','1'); }catch(e){}
  const ok = hqOpenExternal();
  if(typeof toast === 'function') toast(ok ? 'Открываю 3D-штаб в новой вкладке' : 'Штаб: ' + HQ_URL_ABS);
}

/* ---------- живой лог: тик каждые 6 секунд ---------- */
let hqTimer = null;
function hqStartLog(){ if(!hqTimer) hqTimer = setInterval(hqTick, 6000); }
function hqStopLog(){ if(hqTimer){ clearInterval(hqTimer); hqTimer = null; } }
function hqTick(){
  const av = document.getElementById('adminView');
  if(!av || !av.classList.contains('open') || admTab !== 'hq'){ hqStopLog(); return; }
  hqOnlineTick(); // онлайн-счётчик + спарклайн
  // новая строка лога
  const e = HQ_LOG_POOL[Math.floor(Math.random()*HQ_LOG_POOL.length)];
  const line = {t: hqHM(new Date()), a: e.a, m: e.m};
  HQ_LOG.unshift(line); if(HQ_LOG.length > 15) HQ_LOG.length = 15;
  const logEl = document.getElementById('hqLog');
  if(logEl){
    logEl.insertAdjacentHTML('afterbegin', hqLogLine(line, true));
    while(logEl.children.length > 15) logEl.lastElementChild.remove();
  }
  // прогресс агентов: 2 случайных двигаются
  for(let k=0;k<2;k++){
    const a = HQ_AGENTS[Math.floor(Math.random()*HQ_AGENTS.length)];
    if(a.st === 'wait') continue;
    a.p += 3 + Math.floor(Math.random()*7);
    if(a.p >= 100){
      const done = {t: hqHM(new Date()), a: a.id, m: 'задача готова: '+a.task};
      HQ_LOG.unshift(done); if(HQ_LOG.length > 15) HQ_LOG.length = 15;
      if(logEl){ logEl.insertAdjacentHTML('afterbegin', hqLogLine(done, true)); while(logEl.children.length > 15) logEl.lastElementChild.remove(); }
      a.task = a.pool[a._pi = ((a._pi||0)+1) % a.pool.length];
      a.p = 4 + Math.floor(Math.random()*10);
    }
    const bar = document.getElementById('hq-p-'+a.id); if(bar) bar.style.width = a.p+'%';
    const tt = document.getElementById('hq-t-'+a.id); if(tt) tt.textContent = a.task;
  }
  // изредка агент меняет состояние
  if(Math.random() < 0.22){
    const a = HQ_AGENTS[Math.floor(Math.random()*HQ_AGENTS.length)];
    const order = ['work','think','work','wait'];
    a.st = order[Math.floor(Math.random()*order.length)];
    const d = document.getElementById('hq-d-'+a.id); if(d) d.className = 'hq-dot '+a.st;
    const s = document.getElementById('hq-s-'+a.id); if(s) s.textContent = HQ_ST_LABEL[a.st];
  }
}

/* ==================== 4. МОДЕРАЦИЯ+: ИИ-агент сверху очереди ==================== */
const HQ_MOD = HQ_STATE.mod || {spam:46, scam:12, adult:7, drugs:3, checked:8214};
HQ_STATE.mod = HQ_MOD; hqSave();
const HQ_MOD_FEED = [
  {k:'Спам',      cls:'wait', frag:'«Зaрaбoтok 90к/нед, пиши в ЛC…» ×14 чатов', ago:6,   act:'скрыто · мут 24ч'},
  {k:'Скам',      cls:'no',   frag:'«Сбор на лечение, карта 2202 70••…»',       ago:18,  act:'бан + жалоба'},
  {k:'18+',       cls:'no',   frag:'фото в ленте · «ночные знакомства»',        ago:41,  act:'удалено'},
  {k:'Наркотики', cls:'no',   frag:'сленг-паттерн «клад» в групповом чате',     ago:73,  act:'бан навсегда'},
  {k:'Спам',      cls:'wait', frag:'массовая рассылка инвайтов ×34',            ago:95,  act:'ограничение 48ч'},
  {k:'Скам',      cls:'no',   frag:'фейк-магазин «OKO Store» на Бирже',         ago:130, act:'удалено + бан'},
];
/* ---- жалобы пользователей (персист oko-admin-hq.reports) ---- */
const HQ_REPORTS = (HQ_STATE.reports && Array.isArray(HQ_STATE.reports)) ? HQ_STATE.reports : [
  {id:'r1', kind:'Профиль',    tgt:'Гость-8842',       by:'@marina_smm',       reason:'выдаёт себя за поддержку OKO, выманивает коды входа', ago:9,  done:0},
  {id:'r2', kind:'Пост',       tgt:'@fastcash_pro',    by:'@igorvideo',        reason:'финансовая пирамида в рекомендациях ленты',          ago:24, done:0},
  {id:'r3', kind:'Объявление', tgt:'«iPhone 15 за 9900»', by:'@alina.grow',    reason:'товар-приманка, продавец без единой сделки',         ago:52, done:0},
  {id:'r4', kind:'Канал',      tgt:'«Сигналы OKO PRO»',by:'@dmitrymarketing',  reason:'платный канал обещает доход 300% в месяц',           ago:88, done:0},
];
HQ_STATE.reports = HQ_REPORTS; hqSave();
const HQ_REP_ICO = {'Профиль':'user','Пост':'feed','Объявление':'briefcase','Канал':'crown'};
const HQ_REP_DONE = {ban:{l:'заблокирован', cls:'no'}, warn:{l:'предупреждён', cls:'wait'}, ok:{l:'отклонена', cls:'ok'}};
function hqReportFind(id){ return HQ_REPORTS.find(r=>r.id===id); }
function hqReportBan(id){
  const r = hqReportFind(id); if(!r || r.done) return;
  r.done = 'ban';
  const u = ADMIN.users.find(x=>x.n===r.tgt || x.h===r.tgt); /* если цель — известный юзер, баним и его карточку */
  if(u){ const a = HQ_ACT.users[u.n] = HQ_ACT.users[u.n]||{}; a.ban = 1; hqActSave(); }
  hqSave(); renderAdmin(); toast('Нарушитель заблокирован, жалоба закрыта');
}
function hqReportWarn(id){ const r=hqReportFind(id); if(!r||r.done) return; r.done='warn'; hqSave(); renderAdmin(); toast('Предупреждение отправлено автору'); }
function hqReportDismiss(id){ const r=hqReportFind(id); if(!r||r.done) return; r.done='ok'; hqSave(); renderAdmin(); toast('Жалоба отклонена — нарушений не найдено'); }
function hqReportsBlock(){
  const open = HQ_REPORTS.filter(r=>!r.done).length;
  const rows = HQ_REPORTS.map(r=>{
    if(r.done){
      const d = HQ_REP_DONE[r.done] || {l:'закрыта', cls:'ok'};
      return `<div class="adm-row hq-rep done">
        <span class="hq-rep-ic">${I(HQ_REP_ICO[r.kind]||'flag')}</span>
        <span class="adm-main"><b style="white-space:normal">${esc(r.kind)}: ${esc(r.tgt)}</b><small>${esc(r.reason)}</small></span>
        <span class="adm-tag ${d.cls}">${d.l}</span></div>`;
    }
    return `<div class="hq-rep card">
      <div class="hq-rep-top">
        <span class="hq-rep-ic">${I(HQ_REP_ICO[r.kind]||'flag')}</span>
        <span class="adm-main"><b style="white-space:normal">${esc(r.kind)}: ${esc(r.tgt)}</b><small>жалоба от ${esc(r.by)} · ${r.ago} мин назад</small></span>
      </div>
      <div class="hq-rep-reason">${I('flag')}<span>${esc(r.reason)}</span></div>
      <div class="hq-rep-acts">
        <button class="adm-btn dng" onclick="hqReportBan('${r.id}')">Заблокировать</button>
        <button class="adm-btn" onclick="hqReportWarn('${r.id}')">Предупредить</button>
        <button class="adm-btn" onclick="hqReportDismiss('${r.id}')">Отклонить</button>
      </div>
    </div>`;
  }).join('');
  return `<div class="adm-sec-h">Жалобы пользователей${open?' · '+open+' новых':''}</div>${rows}`;
}

/* ---- реклама на модерации: реальные кампании из кабинета (ADS) + собственная очередь ---- */
const HQ_ADREV = (HQ_STATE.adRev && Array.isArray(HQ_STATE.adRev)) ? HQ_STATE.adRev : [
  {id:'a1', name:'Курс «Трейдинг на автопилоте»', fmt:'Продвижение поста', budget:5000, reason:'обещание гарантированного дохода — против правил площадки', done:0},
  {id:'a2', name:'ЗооОпт — корма оптом дешевле',  fmt:'Объявление Биржи',  budget:2000, reason:'',                                                     done:0},
  {id:'a3', name:'Клиника «Дента» · импланты',    fmt:'Баннер',            budget:3500, reason:'мед-тематика — требуется подтверждение лицензии',      done:0},
];
HQ_STATE.adRev = HQ_ADREV; hqSave();
function hqAdRevDecide(id, ok){
  const a = HQ_ADREV.find(x=>x.id===id); if(!a || a.done) return;
  a.done = ok ? 'act' : 'rej';
  hqSave(); renderAdmin(); toast(ok ? 'Кампания одобрена и запущена' : 'Кампания отклонена, бюджет возвращён');
}
function hqRealPendingAds(){
  if(typeof ADS==='undefined' || !ADS || !Array.isArray(ADS.camps)) return [];
  return ADS.camps.filter(c=>c && c.status==='mod');
}
function hqRealAdDecide(id, ok){
  if(typeof ADS==='undefined' || !ADS.camps) return;
  const c = ADS.camps.find(x=>x.id===id); if(!c) return;
  if(ok){ c.status='act'; if(typeof adsPushToFeed==='function'){ try{ adsPushToFeed(c); }catch(e){} } }
  else { c.status='rej'; c.reason='отклонено владельцем на ручной модерации'; }
  if(typeof adsSave==='function'){ try{ adsSave(); }catch(e){} }
  renderAdmin(); toast(ok ? 'Реальная кампания одобрена' : 'Реальная кампания отклонена');
}
function hqAdsBlock(){
  const real = hqRealPendingAds();
  const realRows = real.map(c=>`
    <div class="hq-ad card live">
      <div class="hq-ad-top"><span class="hq-ad-ic">${I('megaphone')}</span>
        <span class="adm-main"><b style="white-space:normal">${esc(c.name)}</b><small>из рекламного кабинета · бюджет ${fmtMoney(c.budget)} · ждёт решения</small></span>
        <span class="adm-tag wait">LIVE</span></div>
      <div class="hq-ad-acts">
        <button class="adm-btn pri" onclick="hqRealAdDecide(${c.id},1)">Одобрить</button>
        <button class="adm-btn dng" onclick="hqRealAdDecide(${c.id},0)">Отклонить</button>
      </div>
    </div>`).join('');
  const rows = HQ_ADREV.map(a=>{
    if(a.done){
      return `<div class="adm-row hq-ad done"><span class="hq-ad-ic">${I('megaphone')}</span>
        <span class="adm-main"><b style="white-space:normal">${esc(a.name)}</b><small>${esc(a.fmt)} · ${fmtMoney(a.budget)}</small></span>
        <span class="adm-tag ${a.done==='act'?'ok':'no'}">${a.done==='act'?'одобрена':'отклонена'}</span></div>`;
    }
    return `<div class="hq-ad card">
      <div class="hq-ad-top"><span class="hq-ad-ic">${I('megaphone')}</span>
        <span class="adm-main"><b style="white-space:normal">${esc(a.name)}</b><small>${esc(a.fmt)} · бюджет ${fmtMoney(a.budget)}</small></span></div>
      ${a.reason
        ? `<div class="hq-rep-reason">${I('flag')}<span>Флаг ИИ: ${esc(a.reason)}</span></div>`
        : `<div class="hq-ad-clean">${I('check2')}<span>ИИ нарушений не нашёл — на финальное решение владельца</span></div>`}
      <div class="hq-ad-acts">
        <button class="adm-btn pri" onclick="hqAdRevDecide('${a.id}',1)">Одобрить</button>
        <button class="adm-btn dng" onclick="hqAdRevDecide('${a.id}',0)">Отклонить</button>
      </div>
    </div>`;
  }).join('');
  const openN = real.length + HQ_ADREV.filter(a=>!a.done).length;
  return `<div class="adm-sec-h">Реклама на модерации${openN?' · '+openN:''}</div>${realRows}${rows}`;
}

const _prevAdmModerHq = admModer;
admModer = function(){
  const m = HQ_MOD;
  const head = `
    <div class="hq-mod card">
      <div class="hq-mod-head"><i class="hq-dot work"></i><b>ИИ-агент модерации: активен</b><span class="chip on" style="font-size:9px">24/7</span></div>
      <div class="hq-mod-stats">
        <div class="hq-ms"><b>${m.spam}</b><small>спам</small></div>
        <div class="hq-ms bad"><b>${m.scam}</b><small>скам</small></div>
        <div class="hq-ms bad"><b>${m.adult}</b><small>18+</small></div>
        <div class="hq-ms bad"><b>${m.drugs}</b><small>наркотики</small></div>
      </div>
      <div class="hq-mod-note">За сутки проверено ${m.checked.toLocaleString('ru')} сообщений и постов. Автоблок мгновенный, спорное — в очередь ниже.</div>
    </div>
    <div class="adm-sec-h">Последние блокировки ИИ</div>
    ${HQ_MOD_FEED.map(f=>`
      <div class="adm-row">
        <span class="adm-tag ${f.cls}">${esc(f.k)}</span>
        <span class="adm-main"><b style="white-space:normal">${esc(f.frag)}</b><small>${f.ago} мин назад · ${esc(f.act)}</small></span>
      </div>`).join('')}`;
  return head + hqReportsBlock() + hqAdsBlock() + _prevAdmModerHq();
};

/* ==================== 4b. ПАРТНЁРКА: сводка + рабочие выплаты (персист) ==================== */
function hqPartEarn(p){ return parseInt(String(p.earn).replace(/[^0-9]/g,'')) || 0; }
function hqPartPaid(p){ HQ_ACT.paid = HQ_ACT.paid || {}; return HQ_ACT.paid[p.n] || p.st==='ok'; }
const _prevAdmPartnersHq = admPartners;
admPartners = function(){
  HQ_ACT.paid = HQ_ACT.paid || {};
  const totalRef = ADMIN.partners.reduce((s,p)=>s+p.ref, 0);
  const toPay = ADMIN.partners.filter(p=>!hqPartPaid(p)).reduce((s,p)=>s+hqPartEarn(p), 0);
  const rows = ADMIN.partners.map((p,i)=>`
    <div class="adm-row">
      <span class="adm-ava">${esc(p.n[0])}</span>
      <span class="adm-main"><b>${esc(p.n)} · ${esc(p.earn)}</b><small>${esc(p.h)} · ${p.ref} рефералов</small></span>
      ${hqPartPaid(p)
        ? '<span class="adm-tag ok">выплачено</span>'
        : `<button class="adm-btn pri" onclick="hqPartnerPay(${i})">Выплатить</button>`}
    </div>`).join('');
  return `
    <div class="hq-part-sum card">
      <div class="hq-part-s"><b>${ADMIN.partners.length}</b><small>партнёров</small></div>
      <div class="hq-part-s"><b>${totalRef}</b><small>рефералов</small></div>
      <div class="hq-part-s"><b>$${toPay}</b><small>к выплате</small></div>
    </div>
    <div class="adm-sec-h">Партнёры и выплаты</div>${rows}`;
};
function hqPartnerPay(i){
  const p = ADMIN.partners[i]; if(!p) return;
  HQ_ACT.paid = HQ_ACT.paid || {}; HQ_ACT.paid[p.n] = 1; hqActSave();
  renderAdmin(); toast('Выплата '+p.earn+' отправлена партнёру '+p.n);
}

/* ==================== 6. ОБЗОР: KPI «Доход OKO» + панель «Быстро» ==================== */
const _prevAdmOverviewHq = admOverview;
admOverview = function(){
  const html = _prevAdmOverviewHq();
  const kpi = `<div class="adm-kpi hq-kpi-rev"><b style="font-size:24px;padding-top:4px;display:block">${fmtMoney(Math.round(okoRevenueTotal()))}</b>${hqMiniSpark()}<small>Доход OKO (комиссии) <i class="up" style="cursor:pointer" onclick="admGo('revenue')">→ Доходы</i></small></div>`;
  const quick = `
    <div class="adm-sec-h">Быстро · действия владельца</div>
    <div class="hq-quick">
      <button class="hq-qbtn" onclick="hqQuickMoney()"><span class="hq-qic">${I('money')}</span><b>+10 000 ₽</b><small>тестовые на кошелёк</small></button>
      <button class="hq-qbtn" onclick="hqExportReport()"><span class="hq-qic">${I('file')}</span><b>Отчёт .txt</b><small>полная сводка</small></button>
      <button class="hq-qbtn dng" onclick="hqResetDemo()"><span class="hq-qic">${I('trash')}</span><b>Сброс демо</b><small>очистить oko-данные</small></button>
    </div>`;
  return html.replace('<div class="adm-kpis">', '<div class="adm-kpis">'+kpi) + quick;
};
function hqQuickMoney(){
  if(typeof walletAdd !== 'function'){ toast('Кошелёк недоступен'); return; }
  walletAdd(10000, 'Тестовое начисление владельца');
  toast('+10 000 ₽ зачислено на кошелёк (тест)');
}
function hqResetDemo(){
  showPopup({
    ico:'trash', title:'Сбросить демо-данные?',
    body:'Будут очищены все локальные данные приложения (ключи oko-*): кошелёк, доходы, кампании, сделки, прогресс. Авторизация и статус владельца сохранятся. После сброса приложение перезагрузится.',
    actions:[
      {label:'Сбросить всё', onclick:hqDoResetDemo},
      {label:'Отмена', ghost:true}
    ]
  });
}
function hqDoResetDemo(){
  try{
    Object.keys(localStorage).forEach(k=>{
      if(k.indexOf('oko-')===0 && !/auth|owner/.test(k)) localStorage.removeItem(k);
    });
  }catch(e){}
  toast('Демо-данные сброшены — перезагрузка…');
  setTimeout(()=>location.reload(), 700);
}

/* ==================== 5. ПРОФИЛЬ: чип CEO + строка «Штаб OKO HQ» ==================== */
function hqOpenHqTab(){
  if(typeof isOwner === 'function' && !isOwner()){ hqPendingTab='hq'; hqShowGate(); return; }
  openAdmin(); admGo('hq');
}
function hqDecorateProfile(){
  const nameEl = document.getElementById('profName');
  if(nameEl){
    const wrap = nameEl.parentElement;
    let chip = document.getElementById('hqCeoChip');
    if(PROFILE.ceo){
      if(!chip && wrap){
        chip = document.createElement('div');
        chip.id = 'hqCeoChip'; chip.className = 'hq-ceo-chip';
        chip.innerHTML = `${I('crown')} ГЕНЕРАЛЬНЫЙ ДИРЕКТОР OKO`;
        wrap.appendChild(chip);
      }
    } else if(chip) chip.remove();
  }
  const anchor = document.getElementById('prowAdmin');
  let row = document.getElementById('hqProwHq');
  if(typeof isOwner === 'function' && isOwner()){
    if(!row && anchor){
      row = document.createElement('button');
      row.id = 'hqProwHq'; row.className = 'prow';
      row.innerHTML = `<svg class="i"><use href="#i-eye"/></svg> Штаб OKO HQ <span class="chip" style="font-size:9px;margin-left:auto">10 агентов</span>`;
      row.onclick = hqOpenHqTab;
      anchor.parentElement.insertBefore(row, anchor);
    }
  } else if(row) row.remove();
}
const _prevRenderMyProfileHq = renderMyProfile;
renderMyProfile = function(){
  _prevRenderMyProfileHq();
  hqDecorateProfile();
};

/* ==================== самоинициализация ==================== */
(function hqInit(){
  hqDecorateProfile();
})();
