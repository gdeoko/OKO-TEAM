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
      </div>
    </div>
    ${hqPortalCard()}
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
/* Гля-портал в 3D-штаб: самодостаточный превью-тумбнейл (SVG/CSS, без внешних картинок —
   офлайн/CSP-safe) + понятный CTA. Клик по всей карточке открывает внешнюю вкладку hq.html
   через hqOpen3d() (тяжёлый WebGL намеренно НЕ встраивается — лагает в webview). */
function hqPortalCard(){
  /* агенты-орбиты вокруг знака OKO — цвета берём из палитры отделов/агентов */
  const nodes = ['#9AFF00','#4aa0ff','#a855f7','#ff7a3c','#22d3ee','#facc15','#ff6bad','#34d399']
    .map((c,i,arr)=>`<i style="--a:${Math.round(i*360/arr.length)}deg;--c:${c};--d:${(i*0.28).toFixed(2)}s"></i>`).join('');
  return `
    <button class="hq-portal card" type="button" onclick="hqOpen3d()" aria-label="Открыть 3D-штаб OKO в новой вкладке">
      <div class="hq-portal-scene" aria-hidden="true">
        <div class="hq-portal-grid"></div>
        <div class="hq-portal-glow"></div>
        <div class="hq-portal-orbit"><div class="hq-portal-ring">${nodes}</div></div>
        <span class="hq-portal-eye"><svg class="i"><use href="#i-logo"/></svg></span>
        <span class="hq-portal-scan"></span>
        <span class="hq-portal-badge"><i class="hq-dot work"></i>LIVE · 3D</span>
        <span class="hq-portal-chip">WebGL-штаб · ${HQ_AGENTS.length} агентов</span>
        <span class="hq-portal-play">${I('share')}</span>
      </div>
      <div class="hq-portal-cta">
        <span class="hq-portal-t"><b>Открыть 3D-штаб</b><small>отдельная вкладка · true-journey-418.higgsfield.app</small></span>
        <span class="hq-portal-go">${I('chev')}</span>
      </div>
    </button>
    <small class="hq-3d-note">${I('bolt')} Тяжёлый WebGL вынесен из приложения — открывается отдельной страницей, чтобы Telegram-webview не лагал.</small>`;
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
        ? `<div class="hq-rep-reason">${I('flag')}<span>Флаг системы: ${esc(a.reason)}</span></div>`
        : `<div class="hq-ad-clean">${I('check2')}<span>Нарушений не найдено, на финальное решение владельца</span></div>`}
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
      <div class="hq-mod-head"><i class="hq-dot work"></i><b>Модератор OKO: активен</b><span class="chip on" style="font-size:9px">24/7</span></div>
      <div class="hq-mod-stats">
        <div class="hq-ms"><b>${m.spam}</b><small>спам</small></div>
        <div class="hq-ms bad"><b>${m.scam}</b><small>скам</small></div>
        <div class="hq-ms bad"><b>${m.adult}</b><small>18+</small></div>
        <div class="hq-ms bad"><b>${m.drugs}</b><small>наркотики</small></div>
      </div>
      <div class="hq-mod-note">За сутки проверено ${m.checked.toLocaleString('ru')} сообщений и постов. Автоблок мгновенный, спорное — в очередь ниже.</div>
    </div>
    <div class="adm-sec-h">Последние автоблокировки</div>
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

/* ==================== 4c. ПЛАТЕЖИ: сводка + фильтр + карточка транзакции + возврат/подтверждение ==================== */
HQ_STATE.payOv = HQ_STATE.payOv || {};   /* переопределения статуса по индексу (персист) */
hqSave();
function hqPayNum(s){ return parseInt(String(s).replace(/[^0-9]/g,'')) || 0; }
function hqPaySt(i){ return HQ_STATE.payOv[i] || (ADMIN.pay[i] ? ADMIN.pay[i].st : 'wait'); }
function hqPayTier(p){ return String(p.plan||'').split(/\s|·/)[0].trim().toUpperCase(); }
const HQ_PAY_METHOD = {
  BUSINESS:'Карта Visa ····4417', PRO:'Карта Mastercard ····8820',
  START:'СБП · Сбербанк', FREE:'—'
};
const HQ_PAY_ST = {ok:{l:'проведён', cls:'ok'}, wait:{l:'ожидает', cls:'wait'}, refunded:{l:'возврат', cls:'no'}};
let hqPayFilter = 'all';
const HQ_PAY_FILTERS = [{k:'all',l:'Все'},{k:'ok',l:'Проведённые'},{k:'wait',l:'Ожидают'},{k:'refunded',l:'Возвраты'}];
function hqPaySetFilter(k){ hqPayFilter = k; renderAdmin(); }
function hqPayTxn(p, i){
  let h = 0; const s = (p.n||'')+(p.plan||'');
  for(let j=0;j<s.length;j++) h = (h*31 + s.charCodeAt(j)) >>> 0;
  return 'OKO-'+new Date().getFullYear()+'-'+String(100000 + (h + i*4177) % 899999);
}
function hqPayOpen(i){
  const p = ADMIN.pay[i]; if(!p) return;
  const st = hqPaySt(i), sm = hqPayNum(p.sum), fee = Math.round(sm*3.5)/100, net = Math.round((sm - fee)*100)/100;
  const tier = hqPayTier(p), meta = HQ_PAY_ST[st] || HQ_PAY_ST.wait;
  const det = `<div class="hq-pay-det">
      <div class="hq-pay-drow"><span>Транзакция</span><b>${hqPayTxn(p,i)}</b></div>
      <div class="hq-pay-drow"><span>Плательщик</span><b>${esc(p.n)}</b></div>
      <div class="hq-pay-drow"><span>Тариф</span><b>${esc(p.plan)}</b></div>
      <div class="hq-pay-drow"><span>Метод</span><b>${esc(HQ_PAY_METHOD[tier]||'Карта')}</b></div>
      <div class="hq-pay-drow"><span>Дата</span><b>${esc(p.when)}</b></div>
      <div class="hq-pay-drow"><span>Статус</span><b><span class="adm-tag ${meta.cls}">${meta.l}</span></b></div>
    </div>
    <div class="hq-pay-det hq-pay-break">
      <div class="hq-pay-drow"><span>Сумма платежа</span><b>$${sm}</b></div>
      <div class="hq-pay-drow"><span>Эквайринг · 3.5%</span><b class="neg">−$${fee.toFixed(2)}</b></div>
      <div class="hq-pay-drow total"><span>К зачислению</span><b>$${net.toFixed(2)}</b></div>
    </div>`;
  const actions = [];
  if(st === 'wait'){
    actions.push({label:'Подтвердить платёж', onclick:()=>hqPayConfirm(i)});
    actions.push({label:'Отклонить', ghost:true, onclick:()=>hqPayRefund(i)});
  } else if(st === 'ok'){
    actions.push({label:'Оформить возврат', onclick:()=>hqPayRefund(i)});
    actions.push({label:'Закрыть', ghost:true});
  } else {
    actions.push({label:'Закрыть'});
  }
  showPopup({ico:'card', title:'Платёж · $'+sm, body:det, actions});
}
function hqPayConfirm(i){
  if(!ADMIN.pay[i]) return;
  HQ_STATE.payOv[i] = 'ok'; hqSave();
  renderAdmin(); toast('Платёж подтверждён · тариф активирован');
}
function hqPayRefund(i){
  if(!ADMIN.pay[i]) return;
  HQ_STATE.payOv[i] = 'refunded'; hqSave();
  renderAdmin(); toast('Возврат оформлен · $'+hqPayNum(ADMIN.pay[i].sum)+' возвращены плательщику');
}
const _prevAdmPayHq = admPay;
admPay = function(){
  const okSum   = ADMIN.pay.reduce((s,p,i)=> hqPaySt(i)==='ok'   ? s+hqPayNum(p.sum) : s, 0);
  const waitN   = ADMIN.pay.filter((p,i)=> hqPaySt(i)==='wait').length;
  const refSum  = ADMIN.pay.reduce((s,p,i)=> hqPaySt(i)==='refunded' ? s+hqPayNum(p.sum) : s, 0);
  const okCount = ADMIN.pay.filter((p,i)=> hqPaySt(i)==='ok').length;
  const avg     = okCount ? Math.round(okSum/okCount) : 0;
  const chips = HQ_PAY_FILTERS.map(f=>
    `<button class="hq-chip ${hqPayFilter===f.k?'on':''}" onclick="hqPaySetFilter('${f.k}')">${f.l}</button>`).join('');
  const idx = ADMIN.pay.map((p,i)=>i).filter(i=> hqPayFilter==='all' ? true : hqPaySt(i)===hqPayFilter);
  const rows = idx.map(i=>{
    const p = ADMIN.pay[i], st = hqPaySt(i), meta = HQ_PAY_ST[st] || HQ_PAY_ST.wait, tier = hqPayTier(p);
    return `<div class="adm-row hq-pay ${st}" onclick="hqPayOpen(${i})">
      <span class="hq-pay-ic">${I('card')}</span>
      <span class="adm-main"><b>${esc(p.n)} · ${esc(p.sum)}</b><small>${esc(p.plan)} · ${esc(HQ_PAY_METHOD[tier]||'Карта')} · ${esc(p.when)}</small></span>
      <span class="adm-tag ${meta.cls}">${meta.l}</span>
      <span class="hq-pay-go">${I('chev')}</span>
    </div>`;
  }).join('');
  const waitBanner = waitN
    ? `<div class="hq-alert" onclick="hqPaySetFilter('wait')">${I('bolt')}<span><b>${waitN}</b> ${waitN===1?'платёж ждёт':'платежа ждут'} подтверждения — нажми, чтобы обработать</span>${I('chev')}</div>`
    : '';
  return `
    <div class="hq-part-sum card">
      <div class="hq-part-s"><b>$${okSum.toLocaleString('ru')}</b><small>проведено</small></div>
      <div class="hq-part-s"><b>$${avg}</b><small>средний чек</small></div>
      <div class="hq-part-s"><b>${refSum?'$'+refSum:'0'}</b><small>возвраты</small></div>
    </div>
    ${waitBanner}
    <div class="hq-chips">${chips}</div>
    <div class="adm-sec-h">Платежи · ${idx.length} из ${ADMIN.pay.length}</div>
    ${rows || '<p class="dim" style="font-size:13px;padding:6px 2px">Нет платежей по этому фильтру.</p>'}
    <div class="adm-acts"><button class="adm-btn" onclick="hqExportReport()">${I('file')} Выгрузить отчёт (.txt)</button></div>`;
};

/* ==================== 4d. ИИ-АГЕНТЫ: панель систем (вкл/выкл) + разбор эскалаций ==================== */
HQ_STATE.aiOff = HQ_STATE.aiOff || {};      /* выключенные системы (персист) */
HQ_STATE.escDone = HQ_STATE.escDone || {};  /* закрытые эскалации по индексу (персист) */
hqSave();
const HQ_AISYS = [
  {k:'support', n:'Поддержка',   ic:'chat',      c:'#9AFF00', load:81, m:'214 ответов/сут · ответ 41 сек'},
  {k:'assist',  n:'Ассистент',   ic:'bolt',      c:'#4aa0ff', load:44, m:'12 отчётов · сводки 09:00'},
  {k:'moder',   n:'Модератор',   ic:'shield',    c:'#a855f7', load:63, m:'68 автоблоков · очередь 0'},
  {k:'fraud',   n:'Антифрод',    ic:'lock',      c:'#ff7a3c', load:37, m:'1.2к проверок · 46 стопов'},
  {k:'sales',   n:'Продажи',     ic:'briefcase', c:'#22d3ee', load:52, m:'34 лида · дожим 12'},
  {k:'copy',    n:'Копирайтер',  ic:'edit',      c:'#facc15', load:29, m:'19 текстов · A/B на завтра'},
];
function hqAiOn(k){ return !HQ_STATE.aiOff[k]; }
function hqAiToggle(k){
  if(HQ_STATE.aiOff[k]) delete HQ_STATE.aiOff[k]; else HQ_STATE.aiOff[k] = 1;
  hqSave(); renderAdmin();
  toast(''+(HQ_AISYS.find(a=>a.k===k)||{}).n+': '+(hqAiOn(k)?'включён':'выключен'));
}
function hqEscResolve(i){ HQ_STATE.escDone[i] = 1; hqSave(); renderAdmin(); toast('Эскалация закрыта · пользователю отправлен ответ'); }
function hqAiCard(a){
  const on = hqAiOn(a.k);
  return `<div class="hq-ai ${on?'':'off'}">
    <div class="hq-ai-top">
      <span class="hq-ai-ic" style="color:${a.c};background:${a.c}1e">${I(a.ic)}</span>
      <span class="hq-ai-n"><b>${esc(a.n)}</b>
        <span class="hq-ai-st"><i class="hq-dot ${on?'work':'wait'}"></i>${on?'активен':'выключен'}</span></span>
      <span class="switch ${on?'on':''}" onclick="hqAiToggle('${a.k}')"><i></i></span>
    </div>
    <div class="hq-ai-m">${esc(a.m)}</div>
    <div class="hq-bar"><i style="width:${on?a.load:0}%;background:linear-gradient(90deg,${a.c},${a.c}99);transition:width .5s"></i></div>
  </div>`;
}
const _prevAdmAgentsHq = admAgents;
admAgents = function(){
  const onN = HQ_AISYS.filter(a=>hqAiOn(a.k)).length;
  const openEsc = ADMIN.agents.filter((a,i)=>a.esc && !HQ_STATE.escDone[i]).length;
  const board = `
    <div class="hq-part-sum card">
      <div class="hq-part-s"><b>${onN}/${HQ_AISYS.length}</b><small>систем активно</small></div>
      <div class="hq-part-s"><b>24/7</b><small>режим работы</small></div>
      <div class="hq-part-s"><b class="${openEsc?'warn':''}">${openEsc}</b><small>эскалаций</small></div>
    </div>
    <div class="adm-sec-h">Системы OKO · вкл/выкл</div>
    <div class="hq-ai-grid">${HQ_AISYS.map(hqAiCard).join('')}</div>`;
  const escRows = ADMIN.agents.map((a,i)=>{
    const done = !!HQ_STATE.escDone[i];
    const tag = a.esc
      ? (done ? '<span class="adm-tag ok">решено</span>' : '<span class="adm-tag no">эскалация</span>')
      : '<span class="adm-tag ok">отвечено</span>';
    const act = (a.esc && !done)
      ? `<div class="adm-acts"><button class="adm-btn pri" onclick="hqEscResolve(${i})">Закрыть эскалацию</button></div>`
      : '';
    return `<div class="adm-log hq-esc ${a.esc&&!done?'hot':''}">
      <div class="lt"><b>${esc(a.a)}</b><span>${esc(a.when)}</span></div>
      «${esc(a.q)}» ${tag}${act}
    </div>`;
  }).join('');
  return board + `<div class="adm-sec-h">Диалоги и эскалации${openEsc?' · '+openEsc+' в работе':''}</div>` + escRows;
};

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

/* ==================== 7. ОБЗОР+: кризис-виджет / live-лента / heatmap / топ-фичи / воронка ====================
   Ставим ПЯТЬ дашборд-блоков уровня Stripe/Linear на вкладку «Обзор»,
   между KPI-рядом и панелью «Быстро». Ничего не удаляем, только вставляем. */

/* ---- 7.1 КРИЗИС-ВИДЖЕТ: диагностика по MRR/оттоку/возвратам ---- */
function hqCrisisSignal(){
  const now = Date.now(), W = 7*864e5;
  const rev = (typeof OKO_REVENUE!=='undefined') ? OKO_REVENUE : [];
  const sumBetween = (a,b)=>rev.reduce((s,r)=>(r.at>=a&&r.at<b)?s+r.sum:s, 0);
  const cur = sumBetween(now-W, now), prev = sumBetween(now-2*W, now-W);
  const dropPct = prev>0 ? Math.round((cur-prev)/prev*100) : 0;
  const churn = (typeof ADMIN!=='undefined' && ADMIN.kpi) ? +ADMIN.kpi.churn : 0;
  const refN = (typeof ADMIN!=='undefined' && ADMIN.pay) ? ADMIN.pay.filter((p,i)=>hqPaySt(i)==='refunded').length : 0;
  const waitN = (typeof ADMIN!=='undefined' && ADMIN.pay) ? ADMIN.pay.filter((p,i)=>hqPaySt(i)==='wait').length : 0;
  const items = [];
  if(dropPct <= -5) items.push({sev:'hi', txt:'выручка недели ниже на '+Math.abs(dropPct)+'% ('+fmtMoney(Math.round(cur))+' против '+fmtMoney(Math.round(prev))+')'});
  if(churn >= 2.0)  items.push({sev:'md', txt:'отток '+churn+'% выше нормы 1.5% — платные снимаются'});
  if(refN >= 1)     items.push({sev:'md', txt:refN+' возврат'+(refN===1?'':'а')+' за период — проверь причины отказов'});
  if(waitN >= 1)    items.push({sev:'lo', txt:waitN+' платёж'+(waitN===1?'':'а')+' висят в статусе «ожидает»'});
  if(!items.length) return null;
  const sev = items.some(x=>x.sev==='hi') ? 'hi' : (items.some(x=>x.sev==='md') ? 'md' : 'lo');
  const title = dropPct <= -5
    ? 'ALERT · MRR '+dropPct+'% за неделю'
    : (churn >= 2.0 ? 'ALERT · отток растёт' : 'Внимание · сигналы дашборда');
  return {sev, title, items, dropPct, churn, cur, prev, refN, waitN};
}
function hqCrisisBlock(){
  if(HQ_STATE.crisisHide) return '';
  const s = hqCrisisSignal(); if(!s) return '';
  const rows = s.items.map(x=>`<li><span class="hq-cr-b ${x.sev}"></span>${esc(x.txt)}</li>`).join('');
  return `<div class="hq-crisis card sev-${s.sev}">
    <div class="hq-crisis-h">
      <span class="hq-crisis-ic">${I('bolt')}</span>
      <b>${esc(s.title)}</b>
      <span class="hq-crisis-live"><i class="hq-dot work"></i>LIVE</span>
    </div>
    <ul class="hq-crisis-list">${rows}</ul>
    <div class="hq-crisis-acts">
      <button class="adm-btn pri" onclick="hqCrisisOpen()">Разобрать</button>
      <button class="adm-btn" onclick="hqCrisisDismiss()">Скрыть на сутки</button>
    </div>
  </div>`;
}
function hqCrisisDismiss(){
  HQ_STATE.crisisHide = Date.now() + 864e5; hqSave();
  renderAdmin(); toast('Плашка скрыта — вернётся через сутки');
}
(function hqCrisisAutoUnhide(){
  if(HQ_STATE.crisisHide && HQ_STATE.crisisHide < Date.now()){ delete HQ_STATE.crisisHide; hqSave(); }
})();
function hqCrisisOpen(){
  const s = hqCrisisSignal(); if(!s){ toast('Сигналов больше нет'); return; }
  const detail = s.items.map(x=>`<div class="hq-crisis-drow"><span class="hq-cr-b ${x.sev}"></span><span>${esc(x.txt)}</span></div>`).join('');
  const numRows = [
    ['Выручка · 7 дней', fmtMoney(Math.round(s.cur))],
    ['Выручка · предыдущие 7 дней', fmtMoney(Math.round(s.prev))],
    ['Отток', s.churn+'%'],
    ['Возвраты в очереди', s.refN],
    ['Платежи ждут', s.waitN],
  ].map(([l,v])=>`<div class="hq-pay-drow"><span>${l}</span><b>${v}</b></div>`).join('');
  showPopup({
    ico:'bolt', title:'Разбор сигналов',
    body:`<div class="hq-crisis-pop">
      <div class="hq-crisis-block">${detail}</div>
      <div class="hq-pay-det">${numRows}</div>
      <p class="hq-crisis-p">Следующие шаги: проверь платежи в статусе «ожидает» (вкладка Платежи), запусти акцию на удержание для оттока, сверь модерацию — часть возвратов идёт из-за отклонённых заявок.</p>
    </div>`,
    actions:[
      {label:'К платежам', onclick:()=>{ closePopup(); admGo('pay'); }},
      {label:'К модерации', ghost:true, onclick:()=>{ closePopup(); admGo('moder'); }},
      {label:'Закрыть', ghost:true},
    ]
  });
}

/* ---- 7.2 LIVE-ЛЕНТА СОБЫТИЙ: регистрации, оплаты, выводы, сделки (тик 5с) ---- */
const HQ_FEED_POOL = [
  {k:'reg',   ic:'user',      c:'#4aa0ff', tpl:['Регистрация · @{nick} · через Telegram','Регистрация · @{nick} · e-mail','Новый гость: @{nick} · трафик из ленты']},
  {k:'pay',   ic:'card',      c:'#9AFF00', tpl:['Оплата ${a} · PRO · {name}','Оплата ${a} · BUSINESS · {name}','Оплата ${a} · START · {name}','Продление ${a} · PRO · {name}']},
  {k:'out',   ic:'money',     c:'#facc15', tpl:['Выплата партнёру ${a} · @{nick}','Вывод на карту ${a} · {name}','Комиссия +${b} ₽ · тариф']},
  {k:'deal',  ic:'briefcase', c:'#22d3ee', tpl:['Новая сделка Биржи · {name} · {c} ₽','Эскроу открыт · {c} ₽ · @{nick}','Сделка закрыта · {c} ₽ · комиссия 10%']},
  {k:'churn', ic:'flag',      c:'#ff7a3c', tpl:['Отписка от PRO · {name}','Заявка на возврат ${a} · @{nick}']},
  {k:'mod',   ic:'shield',    c:'#a855f7', tpl:['Модератор OKO: блок спам-рассылки ×{d}','Флаг «скам-реквизит» в чате · автобан','Жалоба на @{nick} · в очередь']},
  {k:'ref',   ic:'users',     c:'#ff6bad', tpl:['Реферал @{nick} привёл {d} новых','Уровень партнёра @{nick} повышен до GOLD']},
];
const HQ_FEED_LABEL = {reg:'РЕГИСТРАЦИЯ', pay:'ПЛАТЁЖ', out:'ВЫВОД', deal:'СДЕЛКА', churn:'ОТПИСКА', mod:'МОДЕРАЦИЯ', ref:'ПАРТНЁРКА'};
const HQ_FEED_NICKS = ['marina_smm','igorvideo','alina.grow','stomat_pro','fastcash_pro','dmitrymarketing','beauty_msk','zoo_opt','fitmax','denta_clinic','editor_pro','target_alena','coach_max','vp_studio','sales_pro'];
const HQ_FEED_NAMES = ['Марина К.','Игорь В.','Алина Р.','Пётр С.','Анна Л.','Дмитрий О.','Ксения В.','Роман Т.','Ольга М.','Никита Ш.','Елена Д.'];
function hqFeedRandom(kind){
  const p = HQ_FEED_POOL.find(x=>x.k===kind) || HQ_FEED_POOL[0];
  const t = p.tpl[Math.floor(Math.random()*p.tpl.length)];
  return t
    .replace('{nick}', HQ_FEED_NICKS[Math.floor(Math.random()*HQ_FEED_NICKS.length)])
    .replace('{name}', HQ_FEED_NAMES[Math.floor(Math.random()*HQ_FEED_NAMES.length)])
    .replace('${a}',  '$'+([15,49,99,149,199,299][Math.floor(Math.random()*6)]))
    .replace('${b}',  ([120,240,340,590,890][Math.floor(Math.random()*5)]))
    .replace('{c}',   ([1200,1800,2500,3400,4900,8900][Math.floor(Math.random()*6)]).toLocaleString('ru'))
    .replace('{d}',   String(3+Math.floor(Math.random()*17)));
}
function hqFeedNew(kind){
  const k = kind || (['reg','pay','out','deal','pay','reg','mod','deal','churn','ref'][Math.floor(Math.random()*10)]);
  const p = HQ_FEED_POOL.find(x=>x.k===k) || HQ_FEED_POOL[0];
  return {t: hqHM(new Date()), k, ic:p.ic, c:p.c, m: hqFeedRandom(k)};
}
let HQ_FEED = [];
(function hqSeedFeed(){
  const order = ['pay','reg','deal','pay','mod','out','reg','deal','pay','ref','reg','mod','pay','out'];
  for(const k of order) HQ_FEED.push(hqFeedNew(k));
})();
function hqFeedLine(e, fresh){
  return `<div class="hq-fd${fresh?' new':''}">
    <span class="hq-fd-ic" style="color:${e.c};background:${e.c}1e">${I(e.ic)}</span>
    <span class="hq-fd-b">
      <span class="hq-fd-k" style="color:${e.c}">${HQ_FEED_LABEL[e.k]||e.k}</span>
      <span class="hq-fd-m">${esc(e.m)}</span>
    </span>
    <span class="hq-fd-t">${e.t}</span>
  </div>`;
}
function hqFeedBlock(){
  return `<div class="adm-sec-h">Лента событий · live <span class="hq-fd-pulse"><i class="hq-dot work"></i>обновление 5 сек</span></div>
    <div class="hq-fd-box card" id="hqFeedBox">${HQ_FEED.map(e=>hqFeedLine(e)).join('')}</div>`;
}
let hqFeedTimer = null;
function hqStartFeed(){ if(!hqFeedTimer) hqFeedTimer = setInterval(hqFeedTick, 5000); }
function hqStopFeed(){ if(hqFeedTimer){ clearInterval(hqFeedTimer); hqFeedTimer = null; } }
function hqFeedTick(){
  const av = document.getElementById('adminView');
  if(!av || !av.classList.contains('open') || admTab !== 'overview'){ hqStopFeed(); return; }
  const line = hqFeedNew();
  HQ_FEED.unshift(line); if(HQ_FEED.length > 18) HQ_FEED.length = 18;
  const box = document.getElementById('hqFeedBox'); if(!box) return;
  box.insertAdjacentHTML('afterbegin', hqFeedLine(line, true));
  while(box.children.length > 18) box.lastElementChild.remove();
}

/* ---- 7.3 HEATMAP DAU: 7×24, интенсивность = активность ---- */
const HQ_HEAT_DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
function hqHeatData(){
  /* стабильный псевдослучайный паттерн: утро/обед/вечер выше, ночь ниже, ВС/СБ иначе */
  const grid = [];
  for(let d=0; d<7; d++){
    const row = [];
    for(let h=0; h<24; h++){
      let base = 0;
      if(h>=9 && h<=13) base = 55;
      else if(h>=17 && h<=22) base = 78;
      else if(h>=14 && h<=16) base = 40;
      else if(h>=7 && h<=8) base = 25;
      else if(h>=23 || h<=5) base = 6;
      else base = 18;
      /* выходные: вечерний пик выше, будни днём выше */
      if(d>=5){ if(h>=18 && h<=23) base += 18; if(h>=9 && h<=13) base -= 12; }
      else   { if(h>=10 && h<=12) base += 10; if(h>=20 && h<=22) base += 6; }
      /* лёгкий детерминированный шум */
      const noise = ((d*31 + h*17 + 7) % 13) - 6;
      row.push(Math.max(0, Math.min(100, base + noise)));
    }
    grid.push(row);
  }
  return grid;
}
function hqHeatBlock(){
  const g = hqHeatData();
  const hours = Array.from({length:24}, (_,h)=>h);
  const head = '<div class="hq-hm-hrow"><span></span>' +
    hours.map(h=>`<span class="hq-hm-hh${(h%3===0)?' k':''}">${h%3===0?h:''}</span>`).join('') + '</div>';
  const rows = g.map((row,d)=>{
    const cells = row.map((v,h)=>{
      const cls = v>=80?'lv5':v>=60?'lv4':v>=40?'lv3':v>=20?'lv2':v>=5?'lv1':'lv0';
      return `<i class="${cls}" title="${HQ_HEAT_DAYS[d]} ${h}:00 · ${v}"></i>`;
    }).join('');
    return `<div class="hq-hm-row"><span class="hq-hm-d">${HQ_HEAT_DAYS[d]}</span>${cells}</div>`;
  }).join('');
  const peak = g.reduce((m,r,d)=>{ r.forEach((v,h)=>{ if(v>m.v) m={v,d,h}; }); return m; }, {v:0,d:0,h:0});
  return `<div class="adm-sec-h">Heatmap активности · 7 дней × 24 часа</div>
    <div class="hq-hm card">
      <div class="hq-hm-grid">${head}${rows}</div>
      <div class="hq-hm-foot">
        <span class="hq-hm-peak">Пик: <b>${HQ_HEAT_DAYS[peak.d]} ${peak.h}:00</b></span>
        <span class="hq-hm-leg"><em>меньше</em><i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i><i class="lv5"></i><em>больше</em></span>
      </div>
    </div>`;
}

/* ---- 7.4 ТОП-ФИЧИ ПО ИСПОЛЬЗОВАНИЮ ---- */
const HQ_FEATS = [
  {n:'Контент-завод',   ic:'rocket',    c:'#9AFF00', n24:342, dl:'+18%', up:1, sub:'запусков за 24 часа'},
  {n:'Reels-машина',    ic:'circle-play', c:'#4aa0ff', n24:217, dl:'+12%', up:1, sub:'сборок за сутки'},
  {n:'Академия OKO',    ic:'crown',     c:'#facc15', n24:189, dl:'+9%',  up:1, sub:'уроков открыто'},
  {n:'Биржа услуг',     ic:'briefcase', c:'#22d3ee', n24:94,  dl:'+7%',  up:1, sub:'сделок закрыто'},
  {n:'Штаб OKO HQ',     ic:'shield',    c:'#a855f7', n24:66,  dl:'−2%',  up:0, sub:'планёрок агентов'},
  {n:'Разбор конкурентов', ic:'search', c:'#ff6bad', n24:51,  dl:'+22%', up:1, sub:'отчётов в мозг'},
];
function hqFeatsBlock(){
  const max = Math.max(1, ...HQ_FEATS.map(f=>f.n24));
  const rows = HQ_FEATS.map((f,i)=>`
    <div class="hq-feat" style="animation-delay:${i*0.045}s">
      <span class="hq-feat-ic" style="color:${f.c};background:${f.c}1e">${I(f.ic)}</span>
      <span class="hq-feat-b">
        <span class="hq-feat-top"><b>${esc(f.n)}</b><span class="hq-feat-n">${f.n24}<em>${esc(f.sub)}</em></span></span>
        <span class="hq-bar"><i style="width:${Math.round(f.n24/max*100)}%;background:linear-gradient(90deg,${f.c},${f.c}99)"></i></span>
      </span>
      <span class="hq-feat-dl ${f.up?'up':'dn'}">${esc(f.dl)}</span>
    </div>`).join('');
  return `<div class="adm-sec-h">Топ фич · использование за 24 часа</div>
    <div class="hq-feats card">${rows}</div>`;
}

/* ---- 7.5 ФИНАНСОВАЯ ВОРОНКА: визитор → рег → START → PRO → BUSINESS ---- */
const HQ_FUNNEL = [
  {n:'Визиторы',    v:12840, c:'#4aa0ff', sub:'уник. за 30 дней'},
  {n:'Регистрации', v:1284,  c:'#22d3ee', sub:'аккаунтов создано'},
  {n:'START',       v:214,   c:'#facc15', sub:'активировали базовый'},
  {n:'PRO',         v:78,    c:'#9AFF00', sub:'переход на средний'},
  {n:'BUSINESS',    v:12,    c:'#ff7a3c', sub:'верхний тариф'},
];
function hqFunnelBlock(){
  const top = HQ_FUNNEL[0].v;
  const rows = HQ_FUNNEL.map((s,i)=>{
    const pct = Math.round(s.v/top*100);
    const conv = i===0 ? 100 : Math.round(s.v/HQ_FUNNEL[i-1].v*100*10)/10;
    const dropTxt = i===0 ? '' : ' · '+conv+'% из «'+HQ_FUNNEL[i-1].n+'»';
    return `<div class="hq-fn-row" style="animation-delay:${i*0.06}s">
      <div class="hq-fn-l"><b>${esc(s.n)}</b><small>${esc(s.sub)}${dropTxt}</small></div>
      <div class="hq-fn-bar"><i style="width:${pct}%;background:linear-gradient(90deg,${s.c},${s.c}99)"><em>${s.v.toLocaleString('ru')}</em></i></div>
    </div>`;
  }).join('');
  const overall = Math.round(HQ_FUNNEL[HQ_FUNNEL.length-1].v/HQ_FUNNEL[0].v*10000)/100;
  return `<div class="adm-sec-h">Финансовая воронка · визитор до BUSINESS</div>
    <div class="hq-fn card">
      ${rows}
      <div class="hq-fn-foot">Сквозная конверсия: <b>${overall}%</b> визитор в верхний тариф</div>
    </div>`;
}

/* ---- 7.6 патчим admOverview: вставляем 5 блоков после KPI-ряда, перед «Быстро» ---- */
const _prevAdmOverviewHq2 = admOverview;
admOverview = function(){
  const html = _prevAdmOverviewHq2();
  const insert = hqCrisisBlock() + hqHeatBlock() + hqFunnelBlock() + hqFeatsBlock() + hqFeedBlock();
  /* вставляем перед секцией «Быстро · действия владельца» — держит структуру предсказуемой */
  const marker = '<div class="adm-sec-h">Быстро · действия владельца</div>';
  if(html.indexOf(marker) >= 0) return html.replace(marker, insert + marker);
  return html + insert;
};

/* ---- 7.7 стартуем ленту на overview, останавливаем при уходе ---- */
const _prevRenderAdminHq2 = renderAdmin;
renderAdmin = function(){
  _prevRenderAdminHq2();
  if(admTab === 'overview') hqStartFeed(); else hqStopFeed();
};
const _prevCloseAdminHq2 = closeAdmin;
closeAdmin = function(){ hqStopFeed(); _prevCloseAdminHq2(); };

/* ============================================================================
   8. КАБИНЕТ УРОВНЯ STRIPE / AMPLITUDE / NOTION
   - real-time KPI (тик 15 сек): MRR/ARR, DAU/MAU/WAU, retention 7/30/90, AOV/LTV/CAC/ROI
   - donut активных подписок по тарифам
   - cohort-таблица (недели × retention)
   - A/B тесты с победителем
   - live-heatmap кликов на мини-скриншоте главного экрана
   - product analytics: наименее используемые фичи
   - CRM партнёров (топ-10) — как новая вкладка
   - Финансы (доходы / расходы / прогноз кассы) — как новая вкладка
   - Роли команды (Дир / Финансы / Контент / Партнёры / Поддержка)
   - Быстрые действия: triage / mailing PRO / бан / возврат
   - Экспорт .csv и .pdf (через print-view)
============================================================================ */

/* ---------- 8.0 состояние: роль, seed real-time метрик ---------- */
HQ_STATE.role = HQ_STATE.role || 'director';
HQ_STATE.abSeen = HQ_STATE.abSeen || {};
hqSave();

const HQ_ROLES = [
  {k:'director', n:'Директор',   ic:'crown',     see:['kpi','donut','cohort','funnel','ab','click','feat','least','risks','fin','crm','feed','heat','quick']},
  {k:'finance',  n:'Финансы',    ic:'money',     see:['kpi','donut','fin','risks','quick']},
  {k:'content',  n:'Контент',    ic:'edit',      see:['click','feat','least','heat','feed','ab']},
  {k:'partners', n:'Партнёры',   ic:'briefcase', see:['crm','fin','feed','quick']},
  {k:'support',  n:'Поддержка',  ic:'chat',      see:['risks','feed','quick']},
];
function hqRole(){ return HQ_ROLES.find(r=>r.k===HQ_STATE.role) || HQ_ROLES[0]; }
function hqRoleSees(k){ return hqRole().see.indexOf(k) >= 0; }
function hqRoleSet(k){ HQ_STATE.role = k; hqSave(); renderAdmin(); toast('Роль: '+hqRole().n+' · дашборд адаптирован'); }

/* ---------- 8.1 real-time метрики (свежие числа каждые 15 сек) ---------- */
const HQ_TIERS = [
  {k:'BUSINESS', n:'BUSINESS', price:199, count:12, c:'#ff7a3c'},
  {k:'PRO',      n:'PRO',      price:49,  count:78, c:'#9AFF00'},
  {k:'START',    n:'START',    price:15,  count:214,c:'#facc15'},
  {k:'FREE',     n:'FREE',     price:0,   count:980,c:'#4aa0ff'},
];
const HQ_MET = {
  dau:412, wau:1108, mau:2984, retention:{d7:62.4, d30:38.1, d90:21.7},
  aov:41, ltv:186, cac:52, roas:3.6, /* ROI = (LTV-CAC)/CAC */
  errs:{srv:'12/1k', p95:'214ms'},
  updated: Date.now(),
};
function hqMrr(){ return HQ_TIERS.reduce((s,t)=>s+t.price*t.count, 0); }
function hqRoi(){ return Math.round((HQ_MET.ltv-HQ_MET.cac)/HQ_MET.cac*100); }
function hqMetTick(){
  /* мягкие колебания реалистичного диапазона */
  HQ_MET.dau = Math.max(340, Math.min(520, HQ_MET.dau + Math.round((Math.random()-0.5)*10)));
  HQ_MET.wau = Math.max(920, Math.min(1320, HQ_MET.wau + Math.round((Math.random()-0.5)*14)));
  HQ_MET.mau = Math.max(2600,Math.min(3400, HQ_MET.mau + Math.round((Math.random()-0.5)*8)));
  HQ_MET.retention.d7  = +(HQ_MET.retention.d7  + (Math.random()-0.5)*0.4).toFixed(1);
  HQ_MET.retention.d30 = +(HQ_MET.retention.d30 + (Math.random()-0.5)*0.3).toFixed(1);
  HQ_MET.retention.d90 = +(HQ_MET.retention.d90 + (Math.random()-0.5)*0.2).toFixed(1);
  HQ_MET.aov = Math.max(28, Math.min(64, HQ_MET.aov + Math.round((Math.random()-0.5)*3)));
  HQ_MET.ltv = Math.max(140, Math.min(240, HQ_MET.ltv + Math.round((Math.random()-0.5)*4)));
  HQ_MET.cac = Math.max(38,  Math.min(74,  HQ_MET.cac + Math.round((Math.random()-0.5)*3)));
  HQ_MET.updated = Date.now();
}
function hqMetHM(){ const d=new Date(HQ_MET.updated); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+':'+String(d.getSeconds()).padStart(2,'0'); }
function hqMetTile(v, l, sub, cls){
  return `<div class="hq-met ${cls||''}"><b>${v}</b><small>${esc(l)}</small>${sub?`<em>${sub}</em>`:''}</div>`;
}
function hqRtBlock(){
  const mrr = hqMrr(), arr = mrr*12, roi = hqRoi();
  const R = HQ_MET.retention;
  const dauPct = Math.round(HQ_MET.dau/HQ_MET.mau*100);
  return `<div class="adm-sec-h">Real-time метрики <span class="hq-rt-live"><i class="hq-dot work"></i>тик 15 сек · <span id="hqRtStamp">${hqMetHM()}</span></span></div>
    <div class="hq-met-grid card" id="hqMetGrid">
      ${hqMetTile('$'+mrr.toLocaleString('ru'), 'MRR', '<i class="up">+9%</i> к неделе', 'lime')}
      ${hqMetTile('$'+arr.toLocaleString('ru'), 'ARR', 'прогноз года', 'lime')}
      ${hqMetTile(HQ_MET.dau.toLocaleString('ru'), 'DAU', dauPct+'% от MAU', '')}
      ${hqMetTile(HQ_MET.wau.toLocaleString('ru'), 'WAU', '', '')}
      ${hqMetTile(HQ_MET.mau.toLocaleString('ru'), 'MAU', '30 дней', '')}
      ${hqMetTile(R.d7+'%',  'Retention 7d',  '', R.d7>=60?'lime':(R.d7>=45?'':'red'))}
      ${hqMetTile(R.d30+'%', 'Retention 30d', '', R.d30>=35?'lime':(R.d30>=25?'':'red'))}
      ${hqMetTile(R.d90+'%', 'Retention 90d', '', R.d90>=20?'lime':(R.d90>=12?'':'red'))}
      ${hqMetTile('$'+HQ_MET.aov, 'Средний чек', 'AOV', '')}
      ${hqMetTile('$'+HQ_MET.ltv, 'LTV', 'на клиента', 'lime')}
      ${hqMetTile('$'+HQ_MET.cac, 'CAC', 'привлечение', 'amber')}
      ${hqMetTile(roi+'%', 'ROI', 'LTV / CAC', roi>=150?'lime':(roi>=80?'':'red'))}
    </div>`;
}
/* только те tile-ноды, которые в разметке — пересобираем внутренности без re-render всей вкладки */
function hqMetLiveRefresh(){
  const box = document.getElementById('hqMetGrid'); if(!box) return;
  box.outerHTML = hqRtBlock().replace(/^[\s\S]*?<div class=\"adm-sec-h\">[\s\S]*?<\/div>\s*/, '');
  const st = document.getElementById('hqRtStamp'); if(st) st.textContent = hqMetHM();
}

/* ---------- 8.2 donut активных подписок по тарифам ---------- */
function hqDonutBlock(){
  const paid = HQ_TIERS.filter(t=>t.price>0);
  const tot = paid.reduce((s,t)=>s+t.count,0);
  const C = 2 * Math.PI * 42; /* окружность радиуса 42 */
  let acc = 0;
  const segs = paid.map((t,i)=>{
    const frac = t.count / tot;
    const len = frac * C, gap = C - len, off = -acc * C;
    acc += frac;
    return `<circle cx="60" cy="60" r="42" fill="none" stroke="${t.c}" stroke-width="16"
      stroke-dasharray="${len.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 60 60)"
      style="animation:hqDonutIn .9s cubic-bezier(.2,.85,.3,1) ${i*.08}s both"></circle>`;
  }).join('');
  const legend = paid.map(t=>{
    const pct = Math.round(t.count/tot*100);
    return `<div class="hq-dn-l"><i style="background:${t.c}"></i>
      <b>${esc(t.n)}</b><span>${t.count} · ${pct}%</span></div>`;
  }).join('');
  return `<div class="adm-sec-h">Активные подписки по тарифам</div>
    <div class="hq-donut card">
      <svg class="hq-dn-svg" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="42" fill="none" stroke="var(--raised)" stroke-width="16"/>
        ${segs}
        <text x="60" y="58" text-anchor="middle" class="hq-dn-num">${tot}</text>
        <text x="60" y="72" text-anchor="middle" class="hq-dn-sub">платных</text>
      </svg>
      <div class="hq-dn-legend">${legend}</div>
    </div>`;
}

/* ---------- 8.3 cohort-таблица: недели × retention (5×5) ---------- */
const HQ_COHORT = (function(){
  /* 6 недель когорт × колонки W0..W5 (в % удержания) */
  const now = new Date();
  const rows = [];
  for(let w=5; w>=0; w--){
    const dt = new Date(now.getTime() - w*7*864e5);
    const label = 'W-'+w+' · '+String(dt.getDate()).padStart(2,'0')+'.'+String(dt.getMonth()+1).padStart(2,'0');
    const size = 60 + Math.round(Math.random()*140);
    const arr = [100];
    let cur = 100;
    for(let k=1; k<=5; k++){
      if(k > (5-w)) { arr.push(null); continue; } /* будущее — прочерк */
      const drop = k===1 ? 26+Math.random()*14 : 6+Math.random()*8;
      cur = Math.max(0, cur - drop);
      arr.push(+cur.toFixed(1));
    }
    rows.push({label, size, arr});
  }
  return rows;
})();
function hqCohortBlock(){
  const head = '<div class="hq-ch-row hd"><span class="hq-ch-lbl">Когорта</span><span class="hq-ch-size">N</span>'
    + [0,1,2,3,4,5].map(k=>`<span class="hq-ch-c">W${k}</span>`).join('') + '</div>';
  const rows = HQ_COHORT.map((r,i)=>{
    const cells = r.arr.map(v=>{
      if(v==null) return `<span class="hq-ch-c em">—</span>`;
      const lv = v>=80?'lv5':v>=60?'lv4':v>=40?'lv3':v>=20?'lv2':v>=1?'lv1':'lv0';
      return `<span class="hq-ch-c ${lv}"><em>${Math.round(v)}</em></span>`;
    }).join('');
    return `<div class="hq-ch-row" style="animation-delay:${i*0.04}s">
      <span class="hq-ch-lbl">${esc(r.label)}</span>
      <span class="hq-ch-size">${r.size}</span>${cells}</div>`;
  }).join('');
  return `<div class="adm-sec-h">Когорты · удержание по неделям</div>
    <div class="hq-cohort card">
      <div class="hq-ch-scroll">${head}${rows}</div>
      <div class="hq-hm-foot">
        <span class="hq-hm-peak">6 недель · когорты по неделе регистрации</span>
        <span class="hq-hm-leg"><em>0%</em><i class="lv0"></i><i class="lv1"></i><i class="lv2"></i><i class="lv3"></i><i class="lv4"></i><i class="lv5"></i><em>100%</em></span>
      </div>
    </div>`;
}

/* ---------- 8.4 A/B тесты ---------- */
const HQ_AB = [
  {k:'ab1', n:'Заголовок тарифа PRO',  variants:['A · «Ускоряй контент»','B · «Собери завод за час»'], split:'50/50', sample:2411, winner:'B', uplift:12.4, metric:'CTR карточки тарифа', st:'run'},
  {k:'ab2', n:'Кнопка «Начать бесплатно» vs «Попробовать 7 дней»', variants:['A','B'], split:'50/50', sample:1890, winner:'A', uplift:4.8, metric:'клик по CTA', st:'done'},
  {k:'ab3', n:'Онбординг: 3 шага vs 5 шагов', variants:['3 шага','5 шагов'], split:'70/30', sample:940, winner:'3 шага', uplift:9.1, metric:'доход до 1-го урока', st:'run'},
  {k:'ab4', n:'Автоплей приветствия', variants:['вкл','выкл'], split:'50/50', sample:612, winner:null, uplift:0, metric:'глубина сессии', st:'wait'},
];
function hqAbBlock(){
  const rows = HQ_AB.map((t,i)=>{
    const stCls = t.st==='run'?'wait':(t.st==='done'?'ok':'');
    const stL = t.st==='run'?'идёт':(t.st==='done'?'завершён':'сбор данных');
    const win = t.winner ? `<div class="hq-ab-win"><span>Победитель</span><b>${esc(t.winner)}</b><em class="up">+${t.uplift}%</em></div>` : `<div class="hq-ab-win dim"><span>Победитель</span><b>—</b><em>ждём выборку</em></div>`;
    const vars = t.variants.map((v,vi)=>`<div class="hq-ab-v ${t.winner && (v.charAt(0)===t.winner.charAt(0) || v===t.winner)?'on':''}"><i>${String.fromCharCode(65+vi)}</i>${esc(v)}</div>`).join('');
    return `<div class="hq-ab card" style="animation-delay:${i*0.05}s">
      <div class="hq-ab-h">
        <b>${esc(t.n)}</b>
        <span class="adm-tag ${stCls}">${stL}</span>
      </div>
      <div class="hq-ab-vars">${vars}</div>
      <div class="hq-ab-meta">
        <span>метрика: <b>${esc(t.metric)}</b></span>
        <span>сплит: <b>${esc(t.split)}</b></span>
        <span>выборка: <b>${t.sample.toLocaleString('ru')}</b></span>
      </div>
      ${win}
    </div>`;
  }).join('');
  return `<div class="adm-sec-h">A/B тесты · ${HQ_AB.filter(x=>x.st==='run').length} активных</div>${rows}`;
}

/* ---------- 8.5 heatmap кликов: мини-макет главного + плотность точек ---------- */
/* координаты в системе 0..100 (в SVG viewBox 0 0 100 178 — вертикальный мокап) */
const HQ_CLICKS = [
  /* нижняя таб-панель — гарячий клик */
  {x:18, y:168, w:1.0}, {x:38, y:168, w:0.9}, {x:58, y:168, w:1.0},
  {x:78, y:168, w:0.6}, {x:82, y:168, w:0.9},
  /* карточки ленты в центре */
  {x:50, y:60, w:0.85}, {x:50, y:82, w:0.7}, {x:50, y:104, w:0.55},
  /* иконки в шапке */
  {x:12, y:14, w:0.35}, {x:88, y:14, w:0.4},
  /* CTA сторис */
  {x:22, y:32, w:0.5}, {x:38, y:32, w:0.35}, {x:54, y:32, w:0.3}, {x:70, y:32, w:0.25},
  /* второй клик по «Кошельку» */
  {x:78, y:168, w:0.6},
];
function hqClickBlock(){
  /* плотность: рендерим blur-градиенты через SVG feGaussianBlur */
  const pts = HQ_CLICKS.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="${8+p.w*8}" fill="url(#hqCg)" opacity="${0.35+p.w*0.5}"/>`).join('');
  const top = [...HQ_CLICKS].sort((a,b)=>b.w-a.w).slice(0,4).map((p,i)=>{
    const name = p.y>150?'таб-навигация':(p.y<20?'шапка приложения':(p.y<40?'ряд сторис':'карточки ленты'));
    return `<div class="hq-clk-l"><b>${i+1}</b><span>${name}</span><em>${Math.round(p.w*100)}%</em></div>`;
  }).join('');
  /* мини-макет главного экрана: шапка, сторис, лента, таб-бар */
  return `<div class="adm-sec-h">Heatmap кликов · главный экран <span class="hq-fd-pulse"><i class="hq-dot work"></i>последние 24 часа</span></div>
    <div class="hq-clk card">
      <div class="hq-clk-mock">
        <svg viewBox="0 0 100 178" preserveAspectRatio="xMidYMid meet" class="hq-clk-svg">
          <defs>
            <radialGradient id="hqCg" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stop-color="#ff3838" stop-opacity=".95"/>
              <stop offset="45%" stop-color="#ffb400" stop-opacity=".6"/>
              <stop offset="100%" stop-color="#9AFF00" stop-opacity="0"/>
            </radialGradient>
          </defs>
          <!-- шапка -->
          <rect x="0" y="0" width="100" height="22" fill="var(--raised)"/>
          <circle cx="12" cy="11" r="4" fill="var(--border)"/>
          <rect x="30" y="7" width="34" height="8" rx="2" fill="var(--border)"/>
          <circle cx="82" cy="11" r="4" fill="var(--border)"/>
          <circle cx="92" cy="11" r="4" fill="var(--border)"/>
          <!-- сторис -->
          <g fill="var(--border)"><circle cx="12" cy="32" r="6"/><circle cx="28" cy="32" r="6"/><circle cx="44" cy="32" r="6"/><circle cx="60" cy="32" r="6"/><circle cx="76" cy="32" r="6"/><circle cx="92" cy="32" r="6"/></g>
          <!-- лента -->
          <rect x="6" y="46" width="88" height="28" rx="3" fill="var(--raised)"/>
          <rect x="6" y="78" width="88" height="28" rx="3" fill="var(--raised)"/>
          <rect x="6" y="110" width="88" height="28" rx="3" fill="var(--raised)"/>
          <!-- таб-бар -->
          <rect x="0" y="156" width="100" height="22" fill="var(--raised)"/>
          <g fill="var(--border)">
            <circle cx="18" cy="167" r="3.5"/><circle cx="38" cy="167" r="3.5"/><circle cx="58" cy="167" r="3.5"/><circle cx="78" cy="167" r="3.5"/><circle cx="93" cy="167" r="3.5"/>
          </g>
          <!-- клики -->
          <g style="mix-blend-mode:screen">${pts}</g>
        </svg>
      </div>
      <div class="hq-clk-side">
        <div class="hq-clk-t">Топ зон по кликам</div>
        ${top}
        <div class="hq-clk-note">${I('bolt')}<span>Плотность = сумма кликов пользователей. Красное — hotspot, зелёное — низкая активность.</span></div>
      </div>
    </div>`;
}

/* ---------- 8.6 product analytics: наименее используемые ---------- */
const HQ_LEAST = [
  {n:'Кабинет рекламы', ic:'megaphone', c:'#4aa0ff', n7:6,   pct:0.5,  hint:'сложный вход — обучающий тур в 1 шаг'},
  {n:'Календарь публикаций', ic:'clock', c:'#facc15', n7:4,  pct:0.3,  hint:'спрятан в подменю Reels — вынести в главный'},
  {n:'Экспорт статистики', ic:'file',   c:'#ff6bad',  n7:2,  pct:0.15, hint:'не нужен пока PRO — оставить только BUSINESS'},
  {n:'Резервные копии',    ic:'shield', c:'#a855f7',  n7:1,  pct:0.08, hint:'кандидат на удаление — 0.08% MAU'},
];
function hqLeastBlock(){
  const rows = HQ_LEAST.map((f,i)=>`
    <div class="hq-feat" style="animation-delay:${i*0.045}s">
      <span class="hq-feat-ic" style="color:${f.c};background:${f.c}1e">${I(f.ic)}</span>
      <span class="hq-feat-b">
        <span class="hq-feat-top"><b>${esc(f.n)}</b><span class="hq-feat-n">${f.n7}<em>откр. за 7 дн</em></span></span>
        <span class="hq-least-hint">${esc(f.hint)}</span>
      </span>
      <span class="hq-feat-dl dn">${f.pct}%</span>
    </div>`).join('');
  return `<div class="adm-sec-h">Наименее используемые · кандидаты на упрощение</div>
    <div class="hq-feats card">${rows}</div>`;
}

/* ---------- 8.7 risks: сводная плашка с типизацией ---------- */
function hqRisksBlock(){
  const partWait = ADMIN.partners.filter(p=>!hqPartPaid(p));
  const partSum = partWait.reduce((s,p)=>s+hqPartEarn(p),0);
  const s = hqCrisisSignal();
  const riskList = [];
  if(partSum>0) riskList.push({sev:'md', ic:'briefcase', txt:'Партнёры просят выплату: <b>$'+partSum+'</b> ('+partWait.length+' чел.)'});
  if(s && s.dropPct <= -5) riskList.push({sev:'hi', ic:'bolt', txt:'MRR упал <b>'+s.dropPct+'%</b> за неделю ('+fmtMoney(Math.round(s.cur))+' против '+fmtMoney(Math.round(s.prev))+')'});
  if(HQ_MET.retention.d30 < 30) riskList.push({sev:'md', ic:'flag', txt:'Retention 30d ниже целевого 30%: <b>'+HQ_MET.retention.d30+'%</b>'});
  const errs = 42; riskList.push({sev:'md', ic:'shield', txt:'Server errors <b>+'+errs+'%</b> за час · p95 '+HQ_MET.errs.p95});
  const openMod = (typeof ADMIN!=='undefined' && ADMIN.moder) ? ADMIN.moder.length : 0;
  if(openMod>0) riskList.push({sev:'lo', ic:'edit', txt:openMod+' задач в очереди модерации'});
  if(!riskList.length) return '';
  const rows = riskList.map(r=>`
    <div class="hq-risk-row sev-${r.sev}">
      <span class="hq-risk-ic">${I(r.ic)}</span>
      <span class="hq-risk-m">${r.txt}</span>
    </div>`).join('');
  return `<div class="adm-sec-h">Уведомления о рисках · ${riskList.length}</div>
    <div class="hq-risks card">${rows}</div>`;
}

/* ---------- 8.8 быстрые действия: расширенный набор ---------- */
function hqQuickPro(){
  showPopup({ico:'megaphone', title:'Рассылка всем PRO',
    body:`<div class="hq-mail"><textarea id="hqMailBody" rows="5" placeholder="Текст письма для 78 подписчиков PRO">Привет! Мы обновили Reels-машину и добавили инфографику. Загляни — новая вкладка «Библиотека переходов» уже доступна.</textarea><small>Пойдёт по всем ${HQ_TIERS.find(t=>t.k==='PRO').count} активным PRO. Push + e-mail + внутренняя лента.</small></div>`,
    actions:[
      {label:'Отправить всем PRO', onclick:()=>toast('Рассылка запущена: '+HQ_TIERS.find(t=>t.k==='PRO').count+' PRO · push + e-mail')},
      {label:'Отмена', ghost:true}
    ]});
}
function hqQuickTriage(){
  const q = (typeof ADMIN!=='undefined' && ADMIN.agents) ? ADMIN.agents.filter((a,i)=>a.esc && !HQ_STATE.escDone[i]).length : 0;
  if(!q){ toast('Очередь triage пуста — все ответы отправлены'); return; }
  showPopup({ico:'bolt', title:'Ответить всем на triage', body:`Сегодня в очереди <b>${q}</b> эскалаций. Отправим шаблонный ответ с приветствием и обещанием разобрать в течение часа?`,
    actions:[
      {label:'Ответить всем', onclick:()=>{ ADMIN.agents.forEach((a,i)=>{ if(a.esc) HQ_STATE.escDone[i]=1; }); hqSave(); renderAdmin(); toast('Ответили на '+q+' эскалаций · очередь очищена'); }},
      {label:'Отмена', ghost:true}
    ]});
}
function hqQuickBan(){
  showPopup({ico:'lock', title:'Забанить пользователя',
    body:`<div class="hq-mail"><input id="hqBanNick" placeholder="@ник или имя" style="width:100%;background:var(--raised);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px 14px;color:var(--text);font-size:14px;outline:none"><small>Полный список — во вкладке «Пользователи». Здесь бан по нику одной кнопкой.</small></div>`,
    actions:[
      {label:'Забанить', onclick:()=>{
        const v = (document.getElementById('hqBanNick')||{}).value || '';
        const q = v.replace('@','').toLowerCase();
        const idx = ADMIN.users.findIndex(u=> (u.n+' '+u.h).toLowerCase().indexOf(q)>=0);
        if(idx<0){ toast('Пользователь «'+v+'» не найден'); return; }
        hqUserBan(idx);
      }},
      {label:'Отмена', ghost:true}
    ]});
}
function hqQuickRefund(){
  const waits = ADMIN.pay.map((p,i)=>({p,i,st:hqPaySt(i)})).filter(x=>x.st==='ok');
  if(!waits.length){ toast('Нет проведённых платежей для возврата'); return; }
  const rows = waits.slice(0,6).map(x=>`<button class="adm-btn" style="margin-bottom:6px;width:100%;text-align:left;justify-content:flex-start" onclick="hqPayRefund(${x.i});closePopup()">${I('card')} ${esc(x.p.n)} · ${esc(x.p.sum)} · ${esc(x.p.plan)}</button>`).join('');
  showPopup({ico:'card', title:'Возврат средств', body:`<div class="hq-mail">Выбери платёж для возврата:<div style="margin-top:8px">${rows}</div></div>`,
    actions:[{label:'Закрыть', ghost:true}]});
}
function hqQuickBlock(){
  return `<div class="adm-sec-h">Быстрые действия</div>
    <div class="hq-quick hq-quick-6">
      <button class="hq-qbtn" onclick="hqQuickTriage()"><span class="hq-qic">${I('bolt')}</span><b>Triage</b><small>ответить всем</small></button>
      <button class="hq-qbtn" onclick="hqQuickPro()"><span class="hq-qic">${I('megaphone')}</span><b>Письмо PRO</b><small>рассылка всем</small></button>
      <button class="hq-qbtn dng" onclick="hqQuickBan()"><span class="hq-qic">${I('lock')}</span><b>Бан юзера</b><small>по @нику</small></button>
      <button class="hq-qbtn" onclick="hqQuickRefund()"><span class="hq-qic">${I('card')}</span><b>Возврат</b><small>выбрать платёж</small></button>
      <button class="hq-qbtn" onclick="hqQuickMoney()"><span class="hq-qic">${I('money')}</span><b>+10 000 ₽</b><small>тест на кошелёк</small></button>
      <button class="hq-qbtn" onclick="hqExportMenu()"><span class="hq-qic">${I('file')}</span><b>Экспорт</b><small>CSV / PDF / TXT</small></button>
    </div>`;
}

/* ---------- 8.9 Роль: селектор + скрытие блоков ---------- */
function hqRoleBar(){
  const chips = HQ_ROLES.map(r=>`<button class="hq-chip ${HQ_STATE.role===r.k?'on':''}" onclick="hqRoleSet('${r.k}')" title="${esc(r.n)}"><span class="hq-role-ic">${I(r.ic)}</span>${esc(r.n)}</button>`).join('');
  return `<div class="adm-sec-h">Роль просмотра</div><div class="hq-chips hq-role-chips">${chips}</div>`;
}

/* ---------- 8.10 admOverview: собираем всё вместе ---------- */
const _prevAdmOverviewHqX = admOverview;
admOverview = function(){
  const html = _prevAdmOverviewHqX();
  /* убираем старую панель «Быстро · действия владельца» — заменим расширенной */
  const legacy = html
    .replace(/<div class="adm-sec-h">Быстро · действия владельца<\/div>[\s\S]*?<\/div>\s*/,'')
    .replace(/<div class="adm-sec-h">Быстрые действия<\/div>[\s\S]*?<\/div>\s*/,'');

  const R = hqRoleSees;
  const parts = [hqRoleBar()];
  if(R('risks')) parts.push(hqRisksBlock());
  if(R('kpi'))   parts.push(hqRtBlock());
  if(R('donut')) parts.push(hqDonutBlock());
  if(R('cohort'))parts.push(hqCohortBlock());
  if(R('click')) parts.push(hqClickBlock());
  if(R('ab'))    parts.push(hqAbBlock());
  if(R('least')) parts.push(hqLeastBlock());
  if(R('quick')) parts.push(hqQuickBlock());
  return legacy + parts.join('');
};

/* ---------- 8.11 real-time тикер обзора: 15 сек ---------- */
let hqRtTimer = null;
function hqStartRt(){ if(!hqRtTimer) hqRtTimer = setInterval(hqRtTick, 15000); }
function hqStopRt(){ if(hqRtTimer){ clearInterval(hqRtTimer); hqRtTimer = null; } }
function hqRtTick(){
  const av = document.getElementById('adminView');
  if(!av || !av.classList.contains('open') || admTab !== 'overview'){ hqStopRt(); return; }
  hqMetTick(); hqMetLiveRefresh();
}

/* ---------- 8.12 новые вкладки: Финансы / CRM ---------- */
ADMIN_TABS.push({k:'finance', t:'Финансы'});
ADMIN_TABS.push({k:'crm',     t:'CRM'});

/* ФИНАНСЫ ------------------------------------------------------------------ */
const HQ_FIN_INCOME = [
  {k:'Lava.top карта', v:184000, c:'#9AFF00'},
  {k:'Криптовалюта',    v:56000,  c:'#4aa0ff'},
  {k:'ЮKassa · СБП',    v:42000,  c:'#facc15'},
  {k:'Партнёрские',     v:18000,  c:'#a855f7'},
  {k:'Международные',   v:12000,  c:'#ff6bad'},
];
const HQ_FIN_EXPENSE = [
  {k:'Реклама',      v:82000, c:'#ff7a3c'},
  {k:'Инфраструктура',v:34000, c:'#4aa0ff'},
  {k:'Зарплаты',     v:120000,c:'#a855f7'},
  {k:'Сервисы (SaaS)',v:18000, c:'#22d3ee'},
  {k:'Юр / бухгалтерия',v:14000, c:'#facc15'},
];
/* прогноз кассы на 6 недель */
const HQ_FIN_CASH = (function(){
  let bal = 780000;
  const arr = [];
  for(let i=0;i<6;i++){
    const inc  = 82000 + Math.round(Math.random()*24000);
    const exp  = 74000 + Math.round(Math.random()*22000);
    bal += inc - exp;
    arr.push({w:'W+'+(i+1), inc, exp, bal});
  }
  return arr;
})();
function hqPieSVG(list, size){
  const R = 44, C = 2*Math.PI*R;
  const tot = list.reduce((s,x)=>s+x.v,0);
  let acc = 0;
  const segs = list.map((x,i)=>{
    const frac = x.v/tot, len = frac*C, gap = C-len, off = -acc*C;
    acc += frac;
    return `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${x.c}" stroke-width="26"
      stroke-dasharray="${len.toFixed(2)} ${gap.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 60 60)"
      style="animation:hqDonutIn .9s cubic-bezier(.2,.85,.3,1) ${i*.06}s both"/>`;
  }).join('');
  return `<svg class="hq-pie-svg" viewBox="0 0 120 120" aria-hidden="true" style="width:${size||132}px;height:${size||132}px">
    ${segs}
    <text x="60" y="58" text-anchor="middle" class="hq-dn-num">${(tot/1000).toFixed(0)}к</text>
    <text x="60" y="72" text-anchor="middle" class="hq-dn-sub">₽ / мес</text>
  </svg>`;
}
function hqBars(list){
  const max = Math.max(...list.map(x=>x.v));
  return list.map((x,i)=>`
    <div class="hq-bars-row" style="animation-delay:${i*0.05}s">
      <span class="hq-bars-lbl"><i style="background:${x.c}"></i>${esc(x.k)}</span>
      <span class="hq-bars-bar"><i style="width:${Math.round(x.v/max*100)}%;background:${x.c}"></i></span>
      <span class="hq-bars-v">${(x.v/1000).toFixed(0)}к</span>
    </div>`).join('');
}
function hqFinanceView(){
  const inc = HQ_FIN_INCOME.reduce((s,x)=>s+x.v,0);
  const exp = HQ_FIN_EXPENSE.reduce((s,x)=>s+x.v,0);
  const net = inc - exp;
  const lastBal = HQ_FIN_CASH[HQ_FIN_CASH.length-1].bal;
  const gapWeek = HQ_FIN_CASH.find(w=>w.bal<0);
  const legendInc = HQ_FIN_INCOME.map(x=>{
    const pct = Math.round(x.v/inc*100);
    return `<div class="hq-dn-l"><i style="background:${x.c}"></i><b>${esc(x.k)}</b><span>${(x.v/1000).toFixed(0)}к · ${pct}%</span></div>`;
  }).join('');
  /* cash-flow бары: доход зелёный, расход красный, баланс — линия */
  const cashMax = Math.max(...HQ_FIN_CASH.map(w=>Math.max(w.inc,w.exp)));
  const cashRows = HQ_FIN_CASH.map((w,i)=>`
    <div class="hq-cf-week" style="animation-delay:${i*0.06}s">
      <span class="hq-cf-lbl">${w.w}</span>
      <span class="hq-cf-bars">
        <i class="up"   style="height:${Math.round(w.inc/cashMax*100)}%"><em>+${(w.inc/1000).toFixed(0)}к</em></i>
        <i class="dn"   style="height:${Math.round(w.exp/cashMax*100)}%"><em>−${(w.exp/1000).toFixed(0)}к</em></i>
      </span>
      <span class="hq-cf-bal ${w.bal<0?'neg':''}">${(w.bal/1000).toFixed(0)}к</span>
    </div>`).join('');
  return `
    ${hqRoleBar()}
    <div class="hq-part-sum card">
      <div class="hq-part-s"><b>${(inc/1000).toFixed(0)}к ₽</b><small>Доходы · мес</small></div>
      <div class="hq-part-s"><b>${(exp/1000).toFixed(0)}к ₽</b><small>Расходы · мес</small></div>
      <div class="hq-part-s"><b class="${net<0?'warn':''}">${net>=0?'+':''}${(net/1000).toFixed(0)}к ₽</b><small>Чистая прибыль</small></div>
    </div>
    <div class="adm-sec-h">Структура доходов · pie</div>
    <div class="hq-donut card">${hqPieSVG(HQ_FIN_INCOME, 140)}<div class="hq-dn-legend">${legendInc}</div></div>
    <div class="adm-sec-h">Расходы · распределение</div>
    <div class="hq-bars card">${hqBars(HQ_FIN_EXPENSE)}</div>
    <div class="adm-sec-h">Прогноз кассы · 6 недель</div>
    <div class="hq-cf card">
      <div class="hq-cf-grid">${cashRows}</div>
      <div class="hq-cf-foot ${lastBal<0?'neg':''}">
        <span>Прогноз баланса через 6 недель: <b>${(lastBal/1000).toFixed(0)}к ₽</b></span>
        ${gapWeek ? `<span class="hq-cf-warn">${I('bolt')} Кассовый разрыв на ${gapWeek.w}: ${(gapWeek.bal/1000).toFixed(0)}к ₽</span>` : `<span class="hq-cf-ok">${I('check2')} Разрывов не прогнозируется</span>`}
      </div>
    </div>
    <div class="adm-acts" style="margin-top:12px">
      <button class="adm-btn pri" onclick="hqExportMenu()">${I('file')} Экспорт .csv / .pdf</button>
      <button class="adm-btn" onclick="hqExportReport()">${I('file')} Сводка .txt</button>
    </div>`;
}

/* CRM ПАРТНЁРОВ (топ-10) --------------------------------------------------- */
const HQ_CRM = [
  {n:'Марина К.',      h:'@marina_smm',        turn: 412000, refs:34, tier:'GOLD',  st:'ok',   last:'сегодня'},
  {n:'Дмитрий О.',     h:'@dmitrymarketing',   turn: 228000, refs:19, tier:'GOLD',  st:'wait', last:'вчера'},
  {n:'Алина Р.',       h:'@alina.grow',        turn: 196000, refs:22, tier:'GOLD',  st:'ok',   last:'2 дня назад'},
  {n:'Игорь В.',       h:'@igorvideo',         turn: 148000, refs:11, tier:'SILVER',st:'ok',   last:'3 дня назад'},
  {n:'Пётр С.',        h:'@stomat_pro',        turn: 96000,  refs:8,  tier:'SILVER',st:'wait', last:'сегодня'},
  {n:'Анна Л.',        h:'@beauty_msk',        turn: 74000,  refs:6,  tier:'SILVER',st:'ok',   last:'вчера'},
  {n:'Никита Ш.',      h:'@editor_pro',        turn: 62000,  refs:7,  tier:'SILVER',st:'ok',   last:'сегодня'},
  {n:'Роман Т.',       h:'@fitmax',            turn: 48000,  refs:5,  tier:'BRONZE',st:'wait', last:'4 дня назад'},
  {n:'Ольга М.',       h:'@target_alena',      turn: 34000,  refs:4,  tier:'BRONZE',st:'ok',   last:'5 дней назад'},
  {n:'Елена Д.',       h:'@denta_clinic',      turn: 22000,  refs:3,  tier:'BRONZE',st:'wait', last:'вчера'},
];
const HQ_CRM_TIER = {GOLD:{c:'#facc15',bg:'rgba(250,204,21,.14)'}, SILVER:{c:'#8892a0',bg:'rgba(136,146,160,.14)'}, BRONZE:{c:'#ff7a3c',bg:'rgba(255,122,60,.14)'}};
function hqCrmView(){
  const tot = HQ_CRM.reduce((s,x)=>s+x.turn,0);
  const waits = HQ_CRM.filter(x=>x.st==='wait');
  const oks   = HQ_CRM.filter(x=>x.st==='ok');
  const rows = HQ_CRM.map((p,i)=>{
    const t = HQ_CRM_TIER[p.tier] || {c:'#8892a0',bg:'transparent'};
    return `<div class="hq-crm-row" style="animation-delay:${i*0.04}s">
      <span class="hq-crm-rank">#${i+1}</span>
      <span class="adm-ava" style="background:${t.bg};color:${t.c};border:1px solid ${t.c}44">${esc(p.n[0])}</span>
      <span class="adm-main"><b>${esc(p.n)}</b><small>${esc(p.h)} · ${p.refs} рефералов · ${esc(p.last)}</small></span>
      <span class="hq-crm-tier" style="color:${t.c};background:${t.bg}">${p.tier}</span>
      <span class="hq-crm-turn">${(p.turn/1000).toFixed(0)}к ₽</span>
      <span class="adm-tag ${p.st==='ok'?'ok':'wait'}">${p.st==='ok'?'выплачено':'к выплате'}</span>
    </div>`;
  }).join('');
  return `
    ${hqRoleBar()}
    <div class="hq-part-sum card">
      <div class="hq-part-s"><b>${HQ_CRM.length}</b><small>партнёров · топ</small></div>
      <div class="hq-part-s"><b>${(tot/1000).toFixed(0)}к ₽</b><small>суммарный оборот</small></div>
      <div class="hq-part-s"><b class="${waits.length?'warn':''}">${waits.length}</b><small>ждут выплаты</small></div>
    </div>
    <div class="adm-sec-h">Топ-10 партнёров · CRM</div>
    <div class="hq-crm card">${rows}</div>
    <div class="adm-acts" style="margin-top:12px">
      <button class="adm-btn pri" onclick="toast('Партнёрам ${waits.length} отправлены выплаты · $${Math.round(waits.reduce((s,x)=>s+x.turn*0.1,0)).toLocaleString('ru')}')">${I('card')} Выплатить всем ждущим (${waits.length})</button>
      <button class="adm-btn" onclick="hqExportMenu()">${I('file')} Экспорт CRM</button>
    </div>`;
}

/* ---------- 8.13 расширение renderAdmin для finance/crm ---------- */
const _prevRenderAdminHq3 = renderAdmin;
renderAdmin = function(){
  if(admTab === 'finance' || admTab === 'crm'){
    document.getElementById('admTabs').innerHTML = ADMIN_TABS.map(t=>
      `<button class="adm-tab ${admTab===t.k?'on':''}" onclick="admGo('${t.k}')">${t.t}</button>`).join('');
    document.getElementById('admBody').innerHTML = admTab==='finance' ? hqFinanceView() : hqCrmView();
    hqStopRt(); hqStopFeed();
    return;
  }
  _prevRenderAdminHq3();
  if(admTab === 'overview') hqStartRt(); else hqStopRt();
};
const _prevCloseAdminHq3 = closeAdmin;
closeAdmin = function(){ hqStopRt(); _prevCloseAdminHq3(); };

/* ---------- 8.14 ЭКСПОРТ: CSV / PDF (print) / TXT ---------- */
function hqExportMenu(){
  showPopup({ico:'file', title:'Экспорт отчёта за месяц', body:`
    <div class="hq-mail" style="text-align:left">
      Выбери формат — данные включают: MRR, DAU, тарифы, доходы/расходы, платежи, партнёры, CRM.
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="adm-btn pri" style="flex:1;min-width:120px" onclick="hqExportCsv();closePopup()">${I('file')} CSV</button>
        <button class="adm-btn" style="flex:1;min-width:120px" onclick="hqExportPdf();closePopup()">${I('file')} PDF (печать)</button>
        <button class="adm-btn" style="flex:1;min-width:120px" onclick="hqExportReport();closePopup()">${I('file')} TXT</button>
      </div>
    </div>`, actions:[{label:'Закрыть', ghost:true}]});
}
function hqCsvEscape(v){ const s = String(v==null?'':v); return /[",\n;]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
function hqExportCsv(){
  const rows = [];
  rows.push(['section','key','value','sub']);
  const now = new Date();
  rows.push(['meta','date', now.toISOString(), 'OKO monthly export']);
  /* KPI */
  const mrr = hqMrr();
  rows.push(['kpi','MRR', mrr, 'USD']);
  rows.push(['kpi','ARR', mrr*12, 'USD']);
  rows.push(['kpi','DAU', HQ_MET.dau, '']);
  rows.push(['kpi','WAU', HQ_MET.wau, '']);
  rows.push(['kpi','MAU', HQ_MET.mau, '']);
  rows.push(['kpi','Retention 7d', HQ_MET.retention.d7, '%']);
  rows.push(['kpi','Retention 30d', HQ_MET.retention.d30, '%']);
  rows.push(['kpi','Retention 90d', HQ_MET.retention.d90, '%']);
  rows.push(['kpi','AOV', HQ_MET.aov, 'USD']);
  rows.push(['kpi','LTV', HQ_MET.ltv, 'USD']);
  rows.push(['kpi','CAC', HQ_MET.cac, 'USD']);
  rows.push(['kpi','ROI', hqRoi(), '%']);
  /* Тарифы */
  HQ_TIERS.forEach(t=> rows.push(['tier', t.k, t.count, 'active']));
  /* Доходы / Расходы */
  HQ_FIN_INCOME.forEach(x=> rows.push(['income', x.k, x.v, 'RUB/month']));
  HQ_FIN_EXPENSE.forEach(x=> rows.push(['expense', x.k, x.v, 'RUB/month']));
  /* Cash-flow */
  HQ_FIN_CASH.forEach(x=> rows.push(['cashflow', x.w, x.bal, 'income='+x.inc+' expense='+x.exp]));
  /* CRM */
  HQ_CRM.forEach((p,i)=> rows.push(['partner', p.n+' '+p.h, p.turn, p.tier+' · refs='+p.refs+' · '+p.st]));
  /* Платежи */
  ADMIN.pay.forEach((p,i)=> rows.push(['payment', p.n+' · '+p.plan, hqPayNum(p.sum), hqPaySt(i)]));
  /* AB */
  HQ_AB.forEach(t=> rows.push(['ab', t.n, t.winner||'', t.st+' · uplift='+t.uplift+'%']));
  const csv = rows.map(r=>r.map(hqCsvEscape).join(',')).join('\n');
  const stamp = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const url = URL.createObjectURL(new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = 'oko-report-'+stamp+'.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
  toast('CSV выгружен · '+rows.length+' строк');
}
function hqExportPdf(){
  const now = new Date();
  const stamp = String(now.getDate()).padStart(2,'0')+'.'+String(now.getMonth()+1).padStart(2,'0')+'.'+now.getFullYear();
  const mrr = hqMrr(), arr = mrr*12, roi = hqRoi();
  const inc = HQ_FIN_INCOME.reduce((s,x)=>s+x.v,0), exp = HQ_FIN_EXPENSE.reduce((s,x)=>s+x.v,0);
  const rowsKpi = [
    ['MRR', '$'+mrr.toLocaleString('en')], ['ARR', '$'+arr.toLocaleString('en')],
    ['DAU', HQ_MET.dau], ['WAU', HQ_MET.wau], ['MAU', HQ_MET.mau],
    ['Retention 7d', HQ_MET.retention.d7+'%'], ['Retention 30d', HQ_MET.retention.d30+'%'], ['Retention 90d', HQ_MET.retention.d90+'%'],
    ['AOV', '$'+HQ_MET.aov], ['LTV', '$'+HQ_MET.ltv], ['CAC', '$'+HQ_MET.cac], ['ROI', roi+'%'],
  ].map(r=>`<tr><td>${r[0]}</td><td><b>${r[1]}</b></td></tr>`).join('');
  const tiersR = HQ_TIERS.map(t=>`<tr><td>${t.k}</td><td><b>${t.count}</b></td><td>$${t.price}/мес</td></tr>`).join('');
  const incR = HQ_FIN_INCOME.map(x=>`<tr><td>${x.k}</td><td><b>${(x.v/1000).toFixed(0)}к ₽</b></td></tr>`).join('');
  const expR = HQ_FIN_EXPENSE.map(x=>`<tr><td>${x.k}</td><td><b>${(x.v/1000).toFixed(0)}к ₽</b></td></tr>`).join('');
  const crmR = HQ_CRM.map((p,i)=>`<tr><td>#${i+1}</td><td>${p.n} ${p.h}</td><td>${p.tier}</td><td><b>${(p.turn/1000).toFixed(0)}к ₽</b></td><td>${p.st==='ok'?'выплачено':'к выплате'}</td></tr>`).join('');
  const abR = HQ_AB.map(t=>`<tr><td>${t.n}</td><td>${t.winner||'—'}</td><td>${t.st}</td><td>${t.uplift?'+'+t.uplift+'%':''}</td></tr>`).join('');
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>OKO · отчёт ${stamp}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#0d1a05;background:#fff;padding:32px;max-width:900px;margin:0 auto;line-height:1.5}
      h1{font-size:26px;letter-spacing:.02em;margin:0 0 6px;color:#0d1a05}
      h2{font-size:17px;margin:28px 0 10px;color:#5cae00;border-bottom:2px solid #9AFF00;padding-bottom:5px}
      .head{display:flex;align-items:center;gap:14px;border-bottom:3px solid #9AFF00;padding-bottom:14px;margin-bottom:18px}
      .logo{width:52px;height:52px;border-radius:14px;background:#0d1a05;color:#9AFF00;display:grid;place-items:center;font-family:'Bebas Neue',Impact,sans-serif;font-size:26px;letter-spacing:.05em}
      .meta{color:#5b6a4a;font-size:13px;margin-top:3px}
      table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px}
      th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #e8efe0}
      th{background:#f6faed;font-weight:700;font-size:12px;color:#5cae00;text-transform:uppercase;letter-spacing:.05em}
      td b{color:#0d1a05;font-weight:700}
      .kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}
      .k{background:#f6faed;border-left:3px solid #9AFF00;padding:11px 14px;border-radius:6px}
      .k b{display:block;font-size:22px;color:#0d1a05;font-family:'Bebas Neue',Impact,sans-serif;letter-spacing:.03em}
      .k small{color:#5b6a4a;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
      .foot{margin-top:32px;padding-top:16px;border-top:1px solid #e8efe0;color:#5b6a4a;font-size:12px;text-align:center}
      @media print{body{padding:20px}}
    </style></head><body>
    <div class="head">
      <div class="logo">OKO</div>
      <div><h1>Сводный отчёт владельца OKO</h1><div class="meta">Дата формирования: ${stamp} · период: последние 30 дней</div></div>
    </div>

    <div class="kpi">
      <div class="k"><b>$${mrr.toLocaleString('en')}</b><small>MRR</small></div>
      <div class="k"><b>$${arr.toLocaleString('en')}</b><small>ARR</small></div>
      <div class="k"><b>${HQ_MET.dau}</b><small>DAU</small></div>
      <div class="k"><b>${roi}%</b><small>ROI</small></div>
    </div>

    <h2>Ключевые метрики</h2>
    <table>${rowsKpi}</table>

    <h2>Активные подписки по тарифам</h2>
    <table><thead><tr><th>Тариф</th><th>Активных</th><th>Цена</th></tr></thead><tbody>${tiersR}</tbody></table>

    <h2>Доходы (за месяц)</h2>
    <table><thead><tr><th>Канал</th><th>Сумма</th></tr></thead><tbody>${incR}
      <tr><td><b>Итого</b></td><td><b>${(inc/1000).toFixed(0)}к ₽</b></td></tr></tbody></table>

    <h2>Расходы (за месяц)</h2>
    <table><thead><tr><th>Категория</th><th>Сумма</th></tr></thead><tbody>${expR}
      <tr><td><b>Итого</b></td><td><b>${(exp/1000).toFixed(0)}к ₽</b></td></tr>
      <tr><td><b>Чистая прибыль</b></td><td><b>${((inc-exp)/1000).toFixed(0)}к ₽</b></td></tr></tbody></table>

    <h2>Партнёры · CRM топ-10</h2>
    <table><thead><tr><th>Ранг</th><th>Партнёр</th><th>Уровень</th><th>Оборот</th><th>Статус</th></tr></thead><tbody>${crmR}</tbody></table>

    <h2>A/B тесты</h2>
    <table><thead><tr><th>Эксперимент</th><th>Победитель</th><th>Статус</th><th>Uplift</th></tr></thead><tbody>${abR}</tbody></table>

    <div class="foot">OKO · штаб владельца · документ сформирован автоматически.
      Для сохранения в PDF: в диалоге печати выбери «Сохранить как PDF».</div>
    <script>window.addEventListener('load',()=>setTimeout(()=>window.print(),500));</script>
    </body></html>`;
  const w = window.open('', '_blank');
  if(!w){ toast('Разреши всплывающие окна для экспорта PDF'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  toast('PDF-отчёт открыт · нажми «Сохранить как PDF»');
}

/* ==================== самоинициализация ==================== */
(function hqInit(){
  hqDecorateProfile();
})();
