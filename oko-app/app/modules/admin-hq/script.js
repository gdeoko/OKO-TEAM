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
    return;
  }
  hqStopLog();
  _prevRenderAdminHq();
};
const _prevCloseAdminHq = closeAdmin;
closeAdmin = function(){ hqStopLog(); _prevCloseAdminHq(); };

/* ---------- вкладка «Доходы» ---------- */
const HQ_SRC_ICO = {
  'Тарифы':'crown', 'Комиссия Биржи 10%':'briefcase', 'Рекламный кабинет':'megaphone',
  'Продвижение':'rocket', 'Игры: рулетка':'fire', 'Игры: дорога':'fire', 'Комиссия вывода':'card'
};
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

  const srcRows = srcs.map((s,i)=>`
    <div class="hq-src" style="animation-delay:${i*0.05}s">
      <div class="hq-src-t"><b>${esc(s.src)}</b><span><i>${fmtMoney(Math.round(s.sum))}</i> · ${total?Math.round(s.sum/total*100):0}%</span></div>
      <div class="hq-bar"><i style="width:${Math.max(3, s.sum/max*100)}%"></i></div>
    </div>`).join('');

  const ops = OKO_REVENUE.slice(0,30).map(r=>`
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
    <div class="adm-sec-h">По источникам</div>
    ${srcRows || '<p class="dim" style="font-size:13px">Пока нет операций — доход копится из комиссий, тарифов и рекламы.</p>'}
    <div class="adm-sec-h">Последние операции (${Math.min(30, OKO_REVENUE.length)})</div>
    ${ops}`;
}

/* ---------- вкладка «Штаб HQ» ---------- */
const HQ_ROOMS = [
  {n:'Финансы',      ic:'money',     c:'#d4af37', s:'КУДиР ведётся · налог отложен', live:1},
  {n:'Юридический',  ic:'file',      c:'#ef4444', s:'договор №14 на проверке 161-ФЗ', live:1},
  {n:'Безопасность', ic:'shield',    c:'#9AFF00', s:'аптайм 99.98% · 0 инцидентов', live:1},
  {n:'Research Lab', ic:'search',    c:'#4aa0ff', s:'разбор ниши · 2 отчёта в мозг', live:1},
  {n:'War-room',     ic:'fire',      c:'#ff7a3c', s:'1 горячий лид · планёрка 16:00', live:1},
  {n:'Comms',        ic:'megaphone', c:'#22d3ee', s:'3 канала · автоответы вкл', live:0},
  {n:'Publishing',   ic:'rocket',    c:'#a855f7', s:'очередь: 3 ролика · пост 18:00', live:1},
  {n:'HR / Найм',    ic:'users',     c:'#ff6bad', s:'прогрев 2 новых аккаунтов', live:0},
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
        <button class="btn sm hq-3d-btn" onclick="hqOpen3d()">${I('eye')} Открыть 3D-штаб</button>
      </div>
    </div>
    <div class="adm-sec-h">Отделы</div>
    <div class="hq-rooms">${HQ_ROOMS.map((r,i)=>`
      <button class="hq-room" style="animation-delay:${i*0.04}s" onclick="toast('Отдел «${r.n}»: детальный дашборд — этап 2')">
        <span class="hq-room-ic" style="color:${r.c};background:${r.c}1e">${I(r.ic)}</span>
        <b>${esc(r.n)} ${r.live?'<i class="hq-dot work"></i>':''}</b>
        <small>${esc(r.s)}</small>
      </button>`).join('')}</div>
    <div class="adm-sec-h">Агенты (${HQ_AGENTS.length})</div>
    <div class="hq-agents" id="hqAgents">${HQ_AGENTS.map(hqAgentCard).join('')}</div>
    <div class="adm-sec-h">Живой лог штаба</div>
    <div class="hq-log" id="hqLog">${HQ_LOG.map(e=>hqLogLine(e)).join('')}</div>`;
}
function hqOpen3d(){
  if(typeof isOwner === 'function' && !isOwner()){ hqShowGate(); return; }
  /* локальный file:// не умеет iframe на /hq.html — открываем вкладкой */
  if(location.protocol !== 'https:' && location.protocol !== 'http:'){ window.open('/hq.html','_blank'); return; }
  try{ localStorage.setItem('oko-hq-auth','1'); }catch(e){} // владелец уже авторизован в приложении
  let v = document.getElementById('hqEmbed');
  if(!v){
    v = document.createElement('div');
    v.id = 'hqEmbed';
    v.innerHTML = `
      <div class="hq-emb-head">
        <button class="hq-emb-back" onclick="hqCloseEmbed()">${I('back')} Назад</button>
        <b>OKO HQ · ШТАБ</b>
        <a class="hq-emb-ext" href="/hq.html" target="_blank" title="Открыть отдельной вкладкой">${I('share')}</a>
      </div>
      <iframe id="hqFrame" allow="autoplay; fullscreen" src="about:blank"></iframe>`;
    document.body.appendChild(v);
  }
  const fr = document.getElementById('hqFrame');
  if(fr.getAttribute('src') !== '/hq.html') fr.setAttribute('src', '/hq.html');
  v.classList.add('open');
  if(typeof nvPush === 'function') nvPush('hq-embed', hqCloseEmbed);
}
function hqCloseEmbed(){
  const v = document.getElementById('hqEmbed');
  if(!v) return;
  v.classList.remove('open');
  const fr = document.getElementById('hqFrame');
  if(fr) fr.setAttribute('src', 'about:blank'); // освободить GPU/видео
}

/* ---------- живой лог: тик каждые 6 секунд ---------- */
let hqTimer = null;
function hqStartLog(){ if(!hqTimer) hqTimer = setInterval(hqTick, 6000); }
function hqStopLog(){ if(hqTimer){ clearInterval(hqTimer); hqTimer = null; } }
function hqTick(){
  const av = document.getElementById('adminView');
  if(!av || !av.classList.contains('open') || admTab !== 'hq'){ hqStopLog(); return; }
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
  return head + _prevAdmModerHq();
};

/* ==================== 6. ОБЗОР: KPI «Доход OKO» ==================== */
const _prevAdmOverviewHq = admOverview;
admOverview = function(){
  const html = _prevAdmOverviewHq();
  const kpi = `<div class="adm-kpi"><b style="font-size:24px;padding-top:4px;display:block">${fmtMoney(Math.round(okoRevenueTotal()))}</b><small>Доход OKO (комиссии) <i class="up" style="cursor:pointer" onclick="admGo('revenue')">→ Доходы</i></small></div>`;
  return html.replace('<div class="adm-kpis">', '<div class="adm-kpis">'+kpi);
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

/* ==================== самоинициализация ==================== */
(function hqInit(){
  hqDecorateProfile();
})();
