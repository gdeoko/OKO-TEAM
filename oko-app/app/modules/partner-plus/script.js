/* =================== PARTNER-PLUS ===================
   Расширение партнёрского кабинета: уровни, лидерборд, промо-материалы,
   дип-линки на тариф, QR-код реф-ссылки, история начислений с фильтром.
   Не трогает base.html: всё вставляется в существующий #screen-partner. */

(function partnerPlus(){
  'use strict';

  /* ---------- иконки: трофей, медаль, звезда-заливка, поделиться ---------- */
  (function addIcons(){
    const defs = document.querySelector('svg defs');
    if(!defs) return;
    function sym(id, vb, inner){
      if(document.getElementById(id)) return;
      const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
      s.setAttribute('id', id); s.setAttribute('viewBox', vb);
      s.innerHTML = inner; defs.appendChild(s);
    }
    sym('i-trophy', '0 0 100 100',
      '<path d="M30 20h40v18c0 12-9 22-20 22S30 50 30 38V20z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>' +
      '<path d="M30 26H18c0 10 5 18 12 20M70 26h12c0 10-5 18-12 20" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M42 62h16v10H42zM34 78h32v6H34z" fill="currentColor"/>');
    sym('i-medal', '0 0 100 100',
      '<circle cx="50" cy="58" r="22" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M32 40 22 14h20l10 20M68 40l10-26H58L48 34" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>');
    sym('i-qr', '0 0 100 100',
      '<rect x="10" y="10" width="26" height="26" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="18" y="18" width="10" height="10" fill="currentColor"/>' +
      '<rect x="64" y="10" width="26" height="26" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="72" y="18" width="10" height="10" fill="currentColor"/>' +
      '<rect x="10" y="64" width="26" height="26" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="18" y="72" width="10" height="10" fill="currentColor"/>' +
      '<rect x="46" y="10" width="6" height="14" fill="currentColor"/>' +
      '<rect x="46" y="30" width="6" height="6" fill="currentColor"/>' +
      '<rect x="46" y="46" width="14" height="6" fill="currentColor"/>' +
      '<rect x="66" y="46" width="6" height="6" fill="currentColor"/>' +
      '<rect x="46" y="60" width="6" height="6" fill="currentColor"/>' +
      '<rect x="60" y="60" width="14" height="14" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="82" y="60" width="8" height="8" fill="currentColor"/>' +
      '<rect x="82" y="76" width="8" height="14" fill="currentColor"/>' +
      '<rect x="60" y="82" width="14" height="8" fill="currentColor"/>');
    sym('i-share', '0 0 100 100',
      '<circle cx="22" cy="50" r="10" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<circle cx="74" cy="22" r="10" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<circle cx="74" cy="78" r="10" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M31 46 65 27M31 54 65 73" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>');
  })();

  /* ---------- модель партнёра (демо, но правдоподобно) ---------- */
  const PP = {
    nick: 'daniel7x',
    salesTotal: 34,           // всего продаж 1-й линии (демо, для уровня)
    salesWeek: 47,            // недельный оборот в леджере (условно, для лидерборда)
    products: [
      {k:'',           label:'Общая'},
      {k:'START',      label:'START'},
      {k:'PRO',        label:'PRO'},
      {k:'BUSINESS',   label:'BUSINESS'},
      {k:'MAX',        label:'MAX'},
      {k:'ACADEMY',    label:'Академия'},
    ],
    activeProduct: '',
  };

  const TIERS = [
    {k:'bronze', label:'Bronze', min:0,   max:50,   badge:'medal',  bonus:0, note:'Стандартная комиссия 15% с 1-й линии, 5% со 2-й.'},
    {k:'silver', label:'Silver', min:50,  max:200,  badge:'medal',  bonus:0, note:'До Gold осталось несколько продаж — открывается +5% сверху.'},
    {k:'gold',   label:'Gold',   min:200, max:9999, badge:'trophy', bonus:5, note:'Максимальная комиссия: 20% с 1-й линии, 5% со 2-й.'},
  ];

  function currentTier(sales){
    for(let i=TIERS.length-1;i>=0;i--) if(sales >= TIERS[i].min) return {tier:TIERS[i], next:TIERS[i+1]||null};
    return {tier:TIERS[0], next:TIERS[1]};
  }

  /* ---------- лидерборд (демо) ---------- */
  const LEADERS = [
    {nick:'anna.mkt',   sum:1240},
    {nick:'kirill.pro', sum: 986},
    {nick:'vova.reels', sum: 812},
    {nick:'lera.copy',  sum: 640},
    {nick:'ilya.growth',sum: 528},
    {nick:'daniel7x',   sum: PP.salesWeek*9},
    {nick:'masha.smm',  sum: 380},
    {nick:'tim.sales',  sum: 322},
    {nick:'nadya.blog', sum: 285},
  ];

  /* ---------- промо-материалы (мокапы + copy для соцсетей) ---------- */
  const PROMO = [
    {
      k:'story-hook', h:'Один инструмент вместо десяти', sub:'сторис · 9:16',
      gr:'g1', fmt:'Instagram Stories 1080×1920',
      copy:'OKO — я снёс 8 приложений и оставил одно.\n\nМессенджер + лента + мини-аппы + кошелёк + академия — всё внутри.\n\nЗабирай по ссылке в шапке, у меня −15% на PRO для подписчиков.\n#OKO #продуктивность'
    },
    {
      k:'reels-1',    h:'Как я делаю ролик за 8 минут', sub:'reels · 9:16',
      gr:'g2', fmt:'Reels / TikTok 1080×1920',
      copy:'Раньше монтаж = 3 часа. Теперь 8 минут.\nОткрываю Контент-завод OKO, кидаю тему — получаю Reels 1080×1920 с озвучкой и субтитрами.\n\nСсылка в описании, для моих +30 дней PRO бесплатно.\n#reels #контент #OKO'
    },
    {
      k:'post-carousel', h:'5 фишек, которых нет у Telegram', sub:'пост · 1:1',
      gr:'g3', fmt:'Instagram / VK 1080×1080',
      copy:'Что делает OKO там, где Telegram молчит:\n\n1. Партнёрка 15% / 5% прямо внутри\n2. Кошелёк с эскроу для сделок\n3. Академия с сертификатом\n4. Биржа услуг под ключ\n5. Контент-завод: ролики без монтажёра\n\nЗабирай по моей ссылке — скинут скидку.'
    },
    {
      k:'yt-thumb', h:'Обзор OKO: заменил 8 приложений', sub:'YouTube · 16:9',
      gr:'g4', fmt:'YouTube preview 1280×720',
      copy:'В новом ролике разбираю OKO по косточкам: где выигрывает у связки Notion + Telegram + CapCut, где недотягивает, и почему я перевёл всю команду.\n\nПо моей реф-ссылке — месяц PRO в подарок при годовой оплате.'
    },
    {
      k:'lp-hero', h:'OKO — приложение, где всё сразу', sub:'баннер · 16:9',
      gr:'g5', fmt:'Web-баннер 1600×900',
      copy:'Заголовок для лендинга или статьи:\n\n«OKO — одно приложение вместо восьми. Мессенджер, кошелёк, академия, биржа, контент-завод и партнёрка. Русский рынок, платит с оборота твоих клиентов.»\n\nCTA: Забрать PRO со скидкой -> {реф-ссылка}'
    },
    {
      k:'ads-square', h:'Партнёрка OKO: 15% + 5%', sub:'реклама · 1:1',
      gr:'g6', fmt:'Ads square 1080×1080',
      copy:'Оффер для ретаргета на подписчиков:\n\n«Приведи одного клиента в OKO — получай 15% с каждой его оплаты. Он приведёт друга — +5% сверху. Выплаты на карту РФ, USDT или Lava.top. Стартуй за 30 секунд.»'
    },
  ];

  /* ---------- рендер расширения экрана ---------- */
  function ppRender(){
    const scr = document.getElementById('screen-partner');
    if(!scr || scr.dataset.ppReady === '1') return;
    const pad = scr.querySelector('.pad');
    if(!pad) return;

    // 1) Уровень партнёра — сразу после stat-grid
    const statGrid = pad.querySelector('.stat-grid');
    if(statGrid && !document.getElementById('ppTier')){
      const el = document.createElement('div');
      el.id = 'ppTier';
      el.innerHTML = tierHTML();
      statGrid.insertAdjacentElement('afterend', el);
    }

    // 2) Дип-линки — заменяем содержимое карточки реф-ссылки на расширенное
    const refCard = pad.querySelector('#refInput')?.closest('.card');
    if(refCard && !refCard.dataset.ppReady){
      refCard.dataset.ppReady = '1';
      refCard.innerHTML = deepHTML();
      wireDeep();
    }

    // 3) Промо-материалы — новая карточка после реф-ссылки
    if(refCard && !document.getElementById('ppPromo')){
      const el = document.createElement('div');
      el.id = 'ppPromo'; el.className = 'card'; el.style.marginTop = '12px';
      el.innerHTML = promoHTML();
      refCard.insertAdjacentElement('afterend', el);
    }

    // 4) Лидерборд — после промо
    const promoCard = document.getElementById('ppPromo');
    if(promoCard && !document.getElementById('ppLb')){
      const el = document.createElement('div');
      el.id = 'ppLb'; el.className = 'card'; el.style.marginTop = '12px'; el.style.padding = '14px 0 4px';
      el.innerHTML = leaderboardHTML();
      promoCard.insertAdjacentElement('afterend', el);
    }

    // 5) История начислений с фильтром — заменяем старую «Последние начисления»
    const scoreCard = Array.from(pad.querySelectorAll('.card')).find(c => /Последние начисления/.test(c.innerText||''));
    if(scoreCard && !scoreCard.dataset.ppReady){
      scoreCard.dataset.ppReady = '1';
      scoreCard.innerHTML = historyHTML();
      renderHistoryList();
    }

    scr.dataset.ppReady = '1';
  }

  /* ================= Блок 1: Уровень ================= */
  function tierHTML(){
    const {tier, next} = currentTier(PP.salesTotal);
    const min = tier.min, max = next ? next.min : tier.max;
    const pct = Math.min(100, Math.round((PP.salesTotal - min) / Math.max(1, max - min) * 100));
    const remaining = next ? Math.max(0, next.min - PP.salesTotal) : 0;
    const nextLabel = next ? next.label : '';
    const note = next
      ? `До <b>${nextLabel}</b> осталось <b>${remaining}</b> продаж. На Gold открывается <b>+5% к комиссии</b> — итого 20% с первой линии.`
      : `Ты в топе программы: <b>+5% бонус к комиссии</b>, персональный менеджер и приоритетные выплаты.`;
    return `<div class="pp-tier">
      <div class="pp-tier-row">
        <div class="pp-tier-name">
          <span class="pp-tier-badge ${tier.k}"><svg class="i"><use href="#i-${tier.badge}"/></svg></span>
          <span>Уровень ${tier.label}</span>
        </div>
        <div class="pp-tier-sales"><b>${PP.salesTotal}</b> / ${next ? next.min : '∞'} продаж</div>
      </div>
      <div class="pp-tier-bar"><i style="width:${pct}%"></i></div>
      <div class="pp-tier-sub">
        <span>${tier.label} · ${min}+</span>
        <span>${nextLabel ? nextLabel + ' · ' + max + '+' : 'MAX'}</span>
      </div>
      <div class="pp-tier-note">${note}</div>
    </div>`;
  }

  /* ================= Блок 2: Дип-линки + QR ================= */
  function baseRef(){ return 'okoteam.top/r/' + PP.nick; }
  function currentRef(){
    const p = PP.activeProduct;
    return baseRef() + (p ? '?product=' + p : '');
  }
  function deepHTML(){
    return `<p style="font-weight:600;font-size:14px">Твоя реф-ссылка</p>
      <p class="dim" style="font-size:12.5px;margin-top:4px">15% с оплат твоих клиентов (первые 6 мес, далее 5%) + 5% со второго уровня</p>
      <div class="pp-deep">
        <div class="pp-deep-tabs" id="ppDeepTabs">
          ${PP.products.map(p=>`<button data-p="${p.k}" class="${p.k===PP.activeProduct?'on':''}">${p.label}</button>`).join('')}
        </div>
        <div class="reflink">
          <input value="${currentRef()}" readonly id="refInput">
        </div>
        <div class="pp-ref-actions">
          <button class="btn sm" onclick="ppCopyRef()"><svg class="i"><use href="#i-copy"/></svg>Копировать</button>
          <button class="btn ghost icon-only" onclick="ppOpenQR()" title="QR-код"><svg class="i"><use href="#i-qr"/></svg></button>
          <button class="btn ghost icon-only" onclick="ppShareRef()" title="Поделиться"><svg class="i"><use href="#i-share"/></svg></button>
        </div>
        <p class="pp-ref-hint">Дип-линк ведёт сразу на выбранный тариф: клиенту не нужно искать и выбирать.</p>
      </div>`;
  }
  function wireDeep(){
    const tabs = document.getElementById('ppDeepTabs');
    if(!tabs) return;
    tabs.addEventListener('click', e=>{
      const b = e.target.closest('button[data-p]');
      if(!b) return;
      PP.activeProduct = b.dataset.p;
      tabs.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
      const inp = document.getElementById('refInput');
      if(inp) inp.value = currentRef();
    });
  }
  window.ppCopyRef = function(){
    const inp = document.getElementById('refInput');
    if(!inp) return;
    inp.select();
    try{ navigator.clipboard.writeText(inp.value); }catch(e){ document.execCommand('copy'); }
    if(typeof toast === 'function') toast('Реф-ссылка скопирована');
  };
  window.ppShareRef = function(){
    const url = document.getElementById('refInput')?.value || currentRef();
    if(navigator.share){
      navigator.share({title:'OKO', text:'Заходи в OKO по моей ссылке', url:'https://'+url})
        .catch(()=>{});
    } else {
      try{ navigator.clipboard.writeText('https://'+url); }catch(e){}
      if(typeof toast === 'function') toast('Ссылка для расшаривания скопирована');
    }
  };

  /* ---------- QR: мок-код на канве SVG (детерминированный от URL) ---------- */
  function qrSvg(text){
    const N = 29;                        // размер сетки
    // простая детерминированная псевдо-случайность из строки
    let seed = 2166136261;
    for(let i=0;i<text.length;i++){ seed ^= text.charCodeAt(i); seed = (seed*16777619)>>>0; }
    function rnd(){ seed ^= seed<<13; seed ^= seed>>>17; seed ^= seed<<5; return ((seed>>>0)%1000)/1000; }
    // заливка ячеек
    const cells = [];
    for(let y=0;y<N;y++){
      const row = [];
      for(let x=0;x<N;x++) row.push(rnd() < 0.48 ? 1 : 0);
      cells.push(row);
    }
    // тайминг-линии
    for(let i=8;i<N-8;i++){ cells[6][i] = i%2===0?1:0; cells[i][6] = i%2===0?1:0; }
    // finder-паттерны (7×7) в трёх углах + чистая рамка вокруг
    function finder(cy, cx){
      for(let dy=-1;dy<=7;dy++) for(let dx=-1;dx<=7;dx++){
        const y=cy+dy, x=cx+dx; if(y<0||y>=N||x<0||x>=N) continue;
        cells[y][x] = 0;
      }
      for(let dy=0;dy<7;dy++) for(let dx=0;dx<7;dx++){
        const y=cy+dy, x=cx+dx;
        const inner = dy>=2 && dy<=4 && dx>=2 && dx<=4;
        const outer = dy===0 || dy===6 || dx===0 || dx===6;
        cells[y][x] = (inner||outer) ? 1 : 0;
      }
    }
    finder(0,0); finder(0,N-7); finder(N-7,0);
    // мини-alignment в правом нижнем углу
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
      const y=N-5+dy, x=N-5+dx;
      const outer = Math.abs(dy)===2 || Math.abs(dx)===2;
      const center = dy===0 && dx===0;
      cells[y][x] = (outer||center) ? 1 : 0;
    }
    // склеиваем SVG
    const size = 232, pad = 6, cell = (size - pad*2) / N;
    let rects = '';
    for(let y=0;y<N;y++) for(let x=0;x<N;x++){
      if(!cells[y][x]) continue;
      rects += `<rect x="${(pad+x*cell).toFixed(2)}" y="${(pad+y*cell).toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}"/>`;
    }
    // OKO-глаз в центре (маркер бренда, оставляет ощущение «настоящего» с логотипом)
    const c = size/2, r = 22;
    const brand = `<circle cx="${c}" cy="${c}" r="${r+2}" fill="#fff"/>
      <circle cx="${c}" cy="${c}" r="${r-2}" fill="#000"/>
      <circle cx="${c}" cy="${c}" r="8" fill="#9AFF00"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" fill="#fff"/>
      <g fill="#000">${rects}</g>${brand}
    </svg>`;
  }
  window.ppOpenQR = function(){
    const url = currentRef();
    document.getElementById('ppQrView').innerHTML = `
      <h3>QR-код твоей ссылки</h3>
      <div class="pp-qr-wrap">
        <div class="pp-qr">${qrSvg(url)}</div>
        <div class="pp-qr-url">${url}</div>
        <div class="pp-qr-tip">Покажи на встрече, наклей на визитку или встрой в сторис.</div>
      </div>
      <div style="height:12px"></div>
      <button class="btn" onclick="ppCopyRef()"><svg class="i"><use href="#i-copy"/></svg>Скопировать ссылку</button>`;
    if(typeof openSheet === 'function') openSheet('pp-qr');
  };

  /* ================= Блок 3: Промо-материалы ================= */
  function promoHTML(){
    return `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <p style="font-weight:700;font-size:15px">Готовые промо-материалы</p>
        <span class="chip">${PROMO.length} шт.</span>
      </div>
      <p class="dim" style="font-size:12.5px;margin-bottom:10px">Мокапы для сторис, Reels, постов и рекламы. Тапни — получишь готовый текст.</p>
      <div class="pp-promo-grid">
        ${PROMO.map((p,i)=>`
          <div class="pp-promo-card" onclick="ppOpenPromo(${i})">
            <div class="pp-promo-thumb ${p.gr}">
              <div>
                <div class="pp-promo-h">${p.h}</div>
                <div class="pp-promo-sub">${p.sub}</div>
              </div>
              <div class="pp-promo-logo">OKO</div>
            </div>
            <div class="pp-promo-meta"><span>${p.fmt.split(' ')[0]}</span><span class="dim">${p.fmt.split(' ').slice(1).join(' ')}</span></div>
          </div>`).join('')}
      </div>`;
  }
  window.ppOpenPromo = function(i){
    const p = PROMO[i]; if(!p) return;
    document.getElementById('ppPromoView').innerHTML = `
      <h3>${p.h}</h3>
      <p class="dim" style="font-size:12px">${p.fmt}</p>
      <div class="pp-promo-preview pp-promo-thumb ${p.gr}">
        <div>
          <div class="pp-promo-h" style="font-size:18px">${p.h}</div>
          <div class="pp-promo-sub" style="margin-top:8px">${p.sub}</div>
        </div>
      </div>
      <p style="font-weight:700;font-size:13px;margin-bottom:6px">Готовый текст</p>
      <div class="pp-promo-copy">${escapeHtml(p.copy)}</div>
      <div class="pp-promo-actions">
        <button class="btn" onclick="ppCopyPromo(${i})"><svg class="i"><use href="#i-copy"/></svg>Скопировать</button>
        <button class="btn ghost" onclick="ppSavePromo(${i})"><svg class="i"><use href="#i-bookmark"/></svg>В избранное</button>
      </div>
      <p class="dim" style="font-size:11.5px;margin-top:12px;text-align:center">Реф-ссылка подставится автоматически: ${currentRef()}</p>`;
    if(typeof openSheet === 'function') openSheet('pp-promo');
  };
  window.ppCopyPromo = function(i){
    const p = PROMO[i]; if(!p) return;
    const text = p.copy.replace(/\{реф-ссылка\}/g, currentRef());
    try{ navigator.clipboard.writeText(text); }catch(e){}
    if(typeof toast === 'function') toast('Текст скопирован');
  };
  window.ppSavePromo = function(){
    if(typeof toast === 'function') toast('Сохранено в избранное');
  };

  /* ================= Блок 4: Лидерборд ================= */
  function leaderboardHTML(){
    const sorted = LEADERS.slice().sort((a,b)=>b.sum-a.sum);
    const myIdx = sorted.findIndex(l=>l.nick===PP.nick);
    return `<div style="display:flex;justify-content:space-between;align-items:baseline;padding:0 14px 8px">
        <p style="font-weight:700;font-size:15px">Лидеры недели</p>
        <span class="chip">твоё место · ${myIdx+1}</span>
      </div>
      <div class="pp-lb">
        ${sorted.slice(0,8).map((l,i)=>{
          const cls = i===0?'top1':(i===1?'top2':(i===2?'top3':''));
          const you = l.nick===PP.nick ? 'you' : '';
          const av = l.nick[0].toUpperCase();
          return `<div class="pp-lb-row ${cls} ${you}">
            <div class="pp-lb-place">${i+1}</div>
            <div class="pp-lb-nick"><span class="pp-lb-ava">${av}</span><span>@${l.nick}</span></div>
            <div class="pp-lb-sum">$${l.sum.toLocaleString('ru-RU').replace(/,/g,' ')}</div>
          </div>`;
        }).join('')}
      </div>`;
  }

  /* ================= Блок 5: История начислений с фильтром ================= */
  const HIST = [
    {t:'PRO · год · уровень 1',      p:'PRO',      lvl:1, sum:70.35, st:'paid', at: Date.now() - 2*24*3600e3},
    {t:'START · мес · уровень 1',    p:'START',    lvl:1, sum: 2.25, st:'paid', at: Date.now() - 3*24*3600e3},
    {t:'BUSINESS · 6м · уровень 2',  p:'BUSINESS', lvl:2, sum:49.95, st:'paid', at: Date.now() - 5*24*3600e3},
    {t:'PRO · мес · уровень 1',      p:'PRO',      lvl:1, sum: 7.35, st:'hold', at: Date.now() - 8*3600e3},
    {t:'ACADEMY · курс · уровень 1', p:'ACADEMY',  lvl:1, sum: 8.50, st:'paid', at: Date.now() - 6*24*3600e3},
    {t:'MAX · мес · уровень 1',      p:'MAX',      lvl:1, sum:224.85,st:'hold', at: Date.now() - 12*3600e3},
    {t:'START · мес · уровень 2',    p:'START',    lvl:2, sum: 0.75, st:'can',  at: Date.now() - 12*24*3600e3},
    {t:'PRO · мес · уровень 1',      p:'PRO',      lvl:1, sum: 7.35, st:'paid', at: Date.now() - 15*24*3600e3},
    {t:'BUSINESS · год · уровень 1', p:'BUSINESS', lvl:1, sum:596.70,st:'paid', at: Date.now() - 22*24*3600e3},
  ];
  const HIST_STATE = {status:'all', product:'all'};

  function historyHTML(){
    const products = ['all', ...Array.from(new Set(HIST.map(h=>h.p)))];
    const statuses = [['all','Все'],['paid','Выплачено'],['hold','В холде'],['can','Отменено']];
    return `<div style="display:flex;justify-content:space-between;align-items:baseline">
        <p style="font-weight:700;font-size:15px">История начислений</p>
        <span class="chip" id="ppHistCount"></span>
      </div>
      <div class="pp-hist-filters" id="ppHistProduct">
        ${products.map(p=>`<button data-p="${p}" class="${p==='all'?'on':''}">${p==='all'?'Все продукты':p}</button>`).join('')}
      </div>
      <div class="pp-hist-filters" id="ppHistStatus">
        ${statuses.map(([k,l])=>`<button data-s="${k}" class="${k==='all'?'on':''}">${l}</button>`).join('')}
      </div>
      <div id="ppHistList"></div>`;
  }
  function fmtDate(ts){
    const d = new Date(ts);
    const now = Date.now(), diff = now - ts;
    if(diff < 3600e3) return Math.max(1, Math.round(diff/60e3)) + ' мин назад';
    if(diff < 24*3600e3) return Math.round(diff/3600e3) + ' ч назад';
    if(diff < 7*24*3600e3) return Math.round(diff/(24*3600e3)) + ' дн назад';
    return d.toLocaleDateString('ru-RU', {day:'2-digit', month:'short'});
  }
  function renderHistoryList(){
    const list = document.getElementById('ppHistList');
    const cnt = document.getElementById('ppHistCount');
    if(!list) return;
    const filtered = HIST.filter(h =>
      (HIST_STATE.status==='all' || h.st===HIST_STATE.status) &&
      (HIST_STATE.product==='all' || h.p===HIST_STATE.product)
    ).sort((a,b)=>b.at-a.at);
    if(cnt) cnt.textContent = filtered.length + ' начислений';
    if(!filtered.length){
      list.innerHTML = `<div class="pp-hist-empty">По этим фильтрам ничего нет.</div>`;
      return;
    }
    const stLabel = {paid:'Выплачено', hold:'В холде', can:'Отменено'};
    list.innerHTML = filtered.map(h=>`
      <div class="pp-hist-row">
        <div>
          <div class="pp-hist-t">${h.t}</div>
          <div class="pp-hist-m">
            <span>${fmtDate(h.at)}</span>
            <span class="pp-hist-st ${h.st}">${stLabel[h.st]}</span>
          </div>
        </div>
        <div class="pp-hist-sum">${h.st==='can'?'—':'+$'+h.sum.toFixed(2)}</div>
      </div>`).join('');
  }
  document.addEventListener('click', e=>{
    const bp = e.target.closest('#ppHistProduct button[data-p]');
    if(bp){
      HIST_STATE.product = bp.dataset.p;
      bp.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===bp));
      renderHistoryList();
      return;
    }
    const bs = e.target.closest('#ppHistStatus button[data-s]');
    if(bs){
      HIST_STATE.status = bs.dataset.s;
      bs.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===bs));
      renderHistoryList();
    }
  });

  /* ---------- утилиты ---------- */
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ---------- init: рендер при первом заходе на экран партнёрки ---------- */
  const _showTab = window.showTab;
  if(typeof _showTab === 'function'){
    window.showTab = function(t){
      const r = _showTab.apply(this, arguments);
      if(t === 'partner') ppRender();
      return r;
    };
  }
  // и один раз на старте — на случай, если экран уже открыт
  document.addEventListener('DOMContentLoaded', ppRender);
  setTimeout(ppRender, 100);
  setTimeout(ppRender, 600);
})();
