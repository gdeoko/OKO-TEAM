/* ══════════════════════════════════════════════════════════════
   V.LIONOFF · мини-приложение.
   Ванильный JS без сборки: файл открывается и в Телеграме, и как сайт.
   ══════════════════════════════════════════════════════════════ */
(() => {
'use strict';

const TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
// Скрипт Телеграма определяет WebApp на любой странице, поэтому «внутри
// Телеграма» узнаём по подписанным данным запуска, а не по наличию объекта.
const INSIDE_TG = !!(TG && TG.initData);
// Приложение живёт и в корне домена, и в подпапке: базу считаем от адреса.
const BASE = location.pathname.replace(/[^/]*$/, '');
// Запросы идут прямо в index.php: приложение так живёт в любой подпапке и не
// требует правил переписывания в nginx.
const API = BASE + 'api/index.php?r=';
const apiUrl = (path) => API + path.replace('?', '&');
const $ = (sel, root = document) => root.querySelector(sel);
const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (n) => new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
const plural = (n, a, b, c) => { n = Math.abs(n) % 100; const d = n % 10;
  if (n > 10 && n < 20) return c; if (d > 1 && d < 5) return b; if (d === 1) return a; return c; };

const S = {
  token: localStorage.getItem('vc_token') || '',
  me: null, app: {}, screen: 'home', params: {}, cache: {}, guest: true,
};

// ─────────────────────────── иконки ───────────────────────────
const ICON = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v16H6.5A2.5 2.5 0 0 0 4 20.5zM20 18v4H6.5A2.5 2.5 0 0 1 4 19.5"/>',
  cases: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16.5 14.5h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  play: '<path d="M8 5.5v13l11-6.5z"/>',
  lock: '<rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check: '<path d="m4 12.5 5 5L20 6.5"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back: '<path d="M19 12H5m6 6-6-6 6-6"/>',
  fire: '<path d="M12 2c3 4 6 6 6 10a6 6 0 1 1-12 0c0-2 1-3.5 2.5-5 .5 1.5 1.5 2 2.5 2 0-3 .5-5 1-7z"/>',
  star: '<path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-2.9L6.7 19.6l1.1-6L3.4 9.4l6-.8z"/>',
  cert: '<circle cx="12" cy="9" r="6"/><path d="m8 14-1 8 5-3 5 3-1-8"/>',
  bell: '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6M10.5 20a2 2 0 0 0 3 0"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14h-.1a2 2 0 1 1 0-4H3a1.6 1.6 0 0 0 1.5-2.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 10h.1a2 2 0 1 1 0 4H21a1.6 1.6 0 0 0-1.6 1z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.6"/><path d="M8.5 7 10 4h4l1.5 3"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2"/>',
};
const ico = (name, size = 20, stroke = 1.7) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor"
     stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICON[name] || ''}</svg>`;
const icoFill = (name, size = 20) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor">${ICON[name] || ''}</svg>`;

const LOGO = `<img src="${BASE}assets/img/icon.png" alt="V.LIONOFF" width="28" height="28"
  style="border-radius:9px;display:block">`;


// ─────────────────────────── инфографика кодом ───────────────────────────
// Слайд может нести тип: stat | bars | steps | compare | timeline.
// Всё рисуется разметкой и CSS, картинок ради украшения в уроках нет.
function ig(s) {
  if (!s || !s.ig) return '';
  const d = s.ig;
  if (d.type === 'stat') {
    return `<div class="ig">${(d.items || []).map(x => `
      <div class="ig-stat"><b class="count" data-to="${esc(x.value)}">${esc(x.value)}</b>
      <span>${esc(x.label)}</span></div>`).join('')}</div>`;
  }
  if (d.type === 'bars') {
    const max = Math.max(...(d.items || []).map(x => +x.value || 0), 1);
    return `<div class="ig">${(d.items || []).map(x => `
      <div class="ig-bar"><div class="top"><span>${esc(x.label)}</span>
        <b>${esc(x.note || x.value)}</b></div>
        <div class="track"><i class="fill" style="--w:${Math.round((+x.value || 0) * 100 / max)}%"></i></div>
      </div>`).join('')}</div>`;
  }
  if (d.type === 'steps') {
    return `<div class="ig ig-steps">${(d.items || []).map((x, i) => `
      <div class="ig-step"><span class="n">${i + 1}</span>
        <span class="t"><b>${esc(x.title)}</b>${x.text ? esc(x.text) : ''}</span></div>`).join('')}</div>`;
  }
  if (d.type === 'compare') {
    return `<div class="ig ig-compare">
      <div class="good"><h5>${esc(d.goodTitle || 'работает')}</h5><ul style="padding-left:16px;margin:0">
        ${(d.good || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="bad"><h5>${esc(d.badTitle || 'не работает')}</h5><ul style="padding-left:16px;margin:0">
        ${(d.bad || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>`;
  }
  if (d.type === 'timeline') {
    return `<div class="ig ig-timeline">${(d.items || []).map(x => `
      <div class="p"><b>${esc(x.title)}</b><span>${esc(x.text || '')}</span></div>`).join('')}</div>`;
  }
  return '';
}

// кольцо прогресса
function ring(percent, label) {
  const r = 32, len = 2 * Math.PI * r, off = len - len * Math.min(100, percent) / 100;
  return `<div class="ring"><svg width="76" height="76" viewBox="0 0 76 76">
    <defs><linearGradient id="ringgrad" x1="0" y1="0" x2="76" y2="76">
      <stop offset="0" stop-color="#7C5CFF"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>
    <circle class="bg" cx="38" cy="38" r="${r}" fill="none" stroke-width="6"/>
    <circle class="fg" cx="38" cy="38" r="${r}" fill="none" stroke-width="6"
      stroke-dasharray="${len}" stroke-dashoffset="${len}" data-off="${off}"/>
  </svg><b>${esc(label)}</b></div>`;
}

// запуск анимаций после отрисовки экрана
function animate() {
  document.querySelectorAll('.ring .fg').forEach(c => {
    requestAnimationFrame(() => { c.style.strokeDashoffset = c.dataset.off; });
  });
  document.querySelectorAll('.count[data-to]').forEach(nEl => {
    const to = parseFloat(String(nEl.dataset.to).replace(/[^\d.]/g, ''));
    if (!isFinite(to) || to <= 0) return;
    const suffix = String(nEl.dataset.to).replace(/[\d.\s]/g, '');
    const t0 = performance.now(), dur = 900;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const v = Math.round(to * (1 - Math.pow(1 - k, 3)));
      nEl.textContent = v + suffix;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

// салют: короткий, из центра экрана
function sparks(count = 26) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#7C5CFF', '#22D3EE', '#EDEFF5'];
  for (let i = 0; i < count; i++) {
    const s = document.createElement('i');
    s.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 190;
    s.style.cssText = `left:50%;top:38%;background:${colors[i % 3]};` +
      `--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;` +
      `animation-delay:${Math.random() * .18}s`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }
}

// ─────────────────────────── сеть ───────────────────────────
async function api(path, body, method) {
  const opt = {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json' },
  };
  if (S.token) opt.headers['Authorization'] = 'Bearer ' + S.token;
  if (TG && TG.initData) opt.headers['X-TG-Init'] = TG.initData;
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(apiUrl(path), opt);
  let data;
  try { data = await res.json(); } catch (e) { data = { ok: false, error: 'сервер ответил не JSON' }; }
  if (!data.ok && data.error && res.status !== 401) { toast(data.error); }
  return data;
}

function toast(text) {
  const old = $('.toast'); if (old) old.remove();
  const t = el(`<div class="toast">${esc(text)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}
function haptic(kind = 'light') {
  try { TG && TG.HapticFeedback && TG.HapticFeedback.impactOccurred(kind); } catch (e) {}
}

// ─────────────────────────── шторка ───────────────────────────
function sheet(html) {
  const wrap = $('#sheet'); const body = $('#sheet-body');
  body.innerHTML = `<div class="grip"></div>` + html;
  wrap.classList.add('on');
  wrap.querySelectorAll('[data-close]').forEach(b => b.onclick = closeSheet);
  return body;
}
function closeSheet() { $('#sheet').classList.remove('on'); }

// ─────────────────────────── каркас ───────────────────────────
const TABS = [
  { id: 'home',    title: 'Главная',  icon: 'home' },
  { id: 'academy', title: 'Обучение', icon: 'book' },
  { id: 'orders',  title: 'Заявки',   icon: 'cases' },
  { id: 'wallet',  title: 'Тариф',    icon: 'wallet' },
  { id: 'profile', title: 'Профиль',  icon: 'user' },
];

function renderTabs() {
  const bar = $('#tabbar');
  bar.hidden = false;
  bar.innerHTML = TABS.map(t => `
    <button data-tab="${t.id}" class="${S.screen === t.id ? 'on' : ''}">
      ${ico(t.icon, 22)}<span>${t.title}</span>
    </button>`).join('');
  bar.querySelectorAll('button').forEach(b => b.onclick = () => { haptic(); go(b.dataset.tab); });
}

function head(title, opts = {}) {
  return `<header class="head">
    ${opts.back ? `<button class="icon-btn" data-act="back">${ico('back', 20)}</button>`
                : `<span class="logo">${LOGO}</span>`}
    <span class="title">${esc(title)}</span>
    <span class="spacer"></span>
    ${opts.right || ''}
    <button class="icon-btn" data-act="theme">${ico('sun', 19)}</button>
  </header>`;
}

function mount(html) {
  const app = $('#app');
  app.innerHTML = html;
  app.querySelectorAll('[data-act="back"]').forEach(b => b.onclick = () => history.back());
  app.querySelectorAll('[data-act="theme"]').forEach(b => b.onclick = toggleTheme);
  app.scrollTop = 0; window.scrollTo(0, 0);
  renderTabs();
  animate();
}

function loading() {
  mount(`${head('V.LIONOFF')}<div class="screen">
    <div class="skeleton" style="height:140px;margin-bottom:14px"></div>
    <div class="skeleton" style="height:80px;margin-bottom:12px"></div>
    <div class="skeleton" style="height:200px"></div></div>`);
}

function toggleTheme() {
  const now = document.documentElement.dataset.vcTheme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.vcTheme = now;
  localStorage.setItem('vc_theme', now);
  if (S.me) api('profile', { theme: now });
}

// ─────────────────────────── маршрутизация ───────────────────────────
function go(screen, params = {}, replace = false) {
  S.screen = screen; S.params = params;
  const url = '#' + screen + (params.slug ? '/' + params.slug : (params.id ? '/' + params.id : ''));
  if (replace) history.replaceState({ screen, params }, '', url);
  else history.pushState({ screen, params }, '', url);
  draw();
}

window.addEventListener('popstate', (e) => {
  const st = e.state || parseHash();
  S.screen = st.screen || 'home'; S.params = st.params || {};
  draw();
});

function parseHash() {
  const raw = (location.hash || '#home').slice(1).split('/');
  const screen = raw[0] || 'home';
  const rest = raw[1] || '';
  const params = {};
  if (rest) { if (/^\d+$/.test(rest)) params.id = +rest; else params.slug = rest; }
  return { screen, params };
}

function draw() {
  if (INSIDE_TG) { S.screen === 'home' ? TG.BackButton.hide() : TG.BackButton.show(); }
  const fn = SCREENS[S.screen] || SCREENS.home;
  fn(S.params);
}

// ─────────────────────────── экраны ───────────────────────────
const SCREENS = {};

SCREENS.home = async () => {
  loading();
  const d = await api('home');
  if (!d.ok) return;
  S.cache.home = d;
  const me = d.me;
  const hi = me ? `Привет, ${esc(me.name.split(' ')[0])}` : 'V.LIONOFF';
  const lvl = me ? me.level : null;
  const pct = lvl ? Math.min(100, Math.round((lvl.xp - lvl.from) * 100 / Math.max(1, lvl.to - lvl.from))) : 0;

  mount(`${head('V.LIONOFF')}
  <div class="screen">
    <section class="hero reveal">
      <div class="row" style="gap:16px;align-items:flex-start">
        <div class="col" style="flex:1">
          <h1>${hi}</h1>
          <div class="sub">${me ? `Уровень ${lvl.level} · ${esc(lvl.name)}` : 'Школа контент-креаторов и биржа заказов'}</div>
        </div>
        ${me ? ring(pct, lvl.level) : ''}
      </div>
      <div class="stats">
        ${me ? `
        <div class="stat"><b class="count" data-to="${me.lessons_done}">0</b><span>уроков</span></div>
        <div class="stat"><b class="count" data-to="${me.streak}">0</b><span>дней подряд</span></div>
        <div class="stat"><b class="count" data-to="${me.xp}">0</b><span>опыта</span></div>` : `
        <div class="stat"><b class="count" data-to="${d.stats.lessons}">0</b><span>уроков</span></div>
        <div class="stat"><b class="count" data-to="${d.stats.creators}">0</b><span>креаторов</span></div>
        <div class="stat"><b class="count" data-to="${d.stats.orders}">0</b><span>заявок</span></div>`}
      </div>
    </section>

    ${d.continue ? `<button class="continue reveal" data-lesson="${d.continue.lesson_id}">
      <span class="play">${icoFill('play', 20)}</span>
      <span class="col" style="flex:1;text-align:left">
        <span class="tiny">Продолжить · ${esc(d.continue.course)}</span>
        <b style="font-size:15px">${esc(d.continue.title)}</b>
      </span>${ico('arrow', 18)}
    </button>` : ''}

    <div class="section-title"><h2>Академия</h2><a data-go="academy">все курсы</a></div>
    ${d.courses.slice(0, 2).map(courseCard).join('')}

    ${d.orders.length ? `<div class="section-title"><h2>Свежие заявки</h2><a data-go="orders">биржа</a></div>
    ${d.orders.map(o => `<div class="order" data-order="${o.id}">
      <h3>${esc(o.title)}</h3>
      <div class="meta">
        <span class="pill">${esc(ORDER_KIND[o.kind] || o.kind)}</span>
        ${o.city ? `<span class="pill">${ico('pin', 13)} ${esc(o.city)}</span>` : ''}
        ${o.budget ? `<span class="pill accent">${money(o.budget)} ₽</span>` : ''}
      </div></div>`).join('')}` : ''}

    ${d.feed.length ? `<div class="section-title"><h2>Лента</h2></div>
    ${d.feed.map(p => `<article class="card">
      ${p.cover ? `<img src="${BASE}${esc(p.cover)}" alt="" loading="lazy" style="border-radius:12px;margin-bottom:10px">` : ''}
      <h3 style="font-size:16px;margin-bottom:6px">${esc(p.title)}</h3>
      <div class="small muted">${esc(p.text).slice(0, 220)}</div>
      ${p.link ? `<a class="btn sm ghost mt16" href="${esc(p.link)}" target="_blank">Открыть</a>` : ''}
    </article>`).join('')}` : ''}
  </div>`);

  bindCommon();
};

const ORDER_KIND = { reels: 'Рилс', obzor: 'Обзор', prodakshn: 'Продакшн', montazh: 'Монтаж', foto: 'Фото' };

function courseCard(c) {
  return `<article class="course-card tap reveal" data-course="${esc(c.slug)}">
    <div class="course-art">
      ${c.cover ? `<img src="${BASE}${esc(c.cover)}" alt="" loading="lazy">` : ''}
      <div class="mark">
        <span class="tiny" style="color:#fff;opacity:.72">V.LIONOFF · ${esc(c.level)}</span>
        <b>${esc(c.title)}</b>
      </div>
      ${(c.opened || c.free_lessons) ? '' : `<span class="lock">${ico('lock', 15)}</span>`}
    </div>
    <div class="course-body">
      <div class="row between" style="margin-bottom:8px">
        <span class="pill ${c.access === 'free' || (!c.opened && c.free_lessons) ? 'ok' : 'accent'}">
          ${c.access === 'free' ? 'бесплатно'
            : (!c.opened && c.free_lessons ? `${c.free_lessons} ${plural(c.free_lessons, 'урок', 'урока', 'уроков')} бесплатно`
            : (c.access === 'pro' ? 'по подписке' : money(c.price) + ' ₽'))}
        </span>
        <span class="small muted">${c.lessons} ${plural(c.lessons, 'урок', 'урока', 'уроков')}</span>
      </div>
      <div class="small muted">${esc(c.subtitle)}</div>
      ${c.done ? `<div class="progress" style="margin-top:12px"><i style="width:${c.percent}%"></i></div>
        <div class="small muted" style="margin-top:6px">${c.percent}% пройдено</div>` : ''}
    </div>
  </article>`;
}

SCREENS.academy = async () => {
  loading();
  const d = await api('courses');
  if (!d.ok) return;
  mount(`${head('Академия')}
  <div class="screen">
    <p class="muted small" style="margin:0 2px 14px">
      Курсы полного формата: слайды, конспект, тест и практика. За направление, сертификат.</p>
    ${d.courses.map(courseCard).join('')}
  </div>`);
  bindCommon();
};

SCREENS.course = async (p) => {
  loading();
  const d = await api('course?slug=' + encodeURIComponent(p.slug || ''));
  if (!d.ok) return;
  const c = d.course;
  mount(`${head(c.title, { back: true })}
  <div class="screen">
    <div class="course-art" style="border-radius:20px;margin-bottom:14px;aspect-ratio:16/9">
      ${c.cover ? `<img src="${BASE}${esc(c.cover)}" alt="" loading="lazy">` : ''}
      <div class="mark"><span class="tiny" style="color:#fff;opacity:.7">V.LIONOFF</span><b>${esc(c.title)}</b></div>
    </div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <span class="pill">${c.blocks} ${plural(c.blocks, 'блок', 'блока', 'блоков')}</span>
      <span class="pill">${c.lessons} ${plural(c.lessons, 'урок', 'урока', 'уроков')}</span>
      <span class="pill">${esc(c.level)}</span>
      ${c.cert ? `<span class="pill accent">${ico('cert', 13)} сертификат</span>` : ''}
    </div>
    <p class="muted" style="margin:0 2px 16px">${esc(c.descr)}</p>
    ${c.done ? `<div class="card flat">
      <div class="row between"><b>Прогресс</b><span>${c.done}/${c.lessons}</span></div>
      <div class="progress mt16"><i style="width:${c.percent}%"></i></div></div>` : ''}
    ${d.certificate ? `<div class="cert" style="background-image:url('${BASE}assets/img/cert.jpg');background-size:cover;background-position:center"><div class="num">${esc(d.certificate.number)}</div>
      <b style="display:block;margin:6px 0">Сертификат получен</b>
      <span class="small muted">${esc(d.certificate.issued_at)}</span></div>` : ''}
    ${!c.opened ? `<div class="card" style="border-color:var(--accent)">
      <b>Курс открывается тарифом PRO</b>
      <p class="small muted" style="margin:6px 0 12px">Первые уроки бесплатны, попробуйте, прежде чем платить.</p>
      <button class="btn primary" data-go="wallet">Открыть доступ</button></div>` : ''}

    ${d.blocks.map((b, bi) => `<section style="margin-top:18px" class="reveal">
      ${b.cover ? `<div class="course-art" style="border-radius:16px;aspect-ratio:16/7;margin-bottom:10px">
        <img src="${BASE}${esc(b.cover)}" alt="" loading="lazy">
        <div class="mark"><b style="font-size:17px">${bi + 1}. ${esc(b.title)}</b></div></div>`
      : `<div class="section-title"><h2>${bi + 1}. ${esc(b.title)}</h2></div>`}
      ${b.descr ? `<p class="small muted" style="margin:-4px 2px 10px">${esc(b.descr)}</p>` : ''}
      ${b.lessons.map((l, li) => `<button class="card tap row between" data-lesson="${l.id}" style="width:100%;text-align:left">
        <span class="row" style="gap:12px">
          <span class="avatar" style="width:38px;height:38px;border-radius:12px;font-size:13px;
            ${l.state === 'done' ? 'background:var(--accent-soft);color:var(--accent)' : ''}">
            ${l.state === 'done' ? ico('check', 16) : (bi + 1) + '.' + (li + 1)}</span>
          <span class="col">
            <b style="font-size:14.5px">${esc(l.title)}</b>
            <span class="small muted">${l.minutes} мин · ${l.slides} ${plural(l.slides, 'слайд', 'слайда', 'слайдов')}${l.quiz ? ' · тест' : ''}</span>
          </span>
        </span>
        ${l.opened ? ico('arrow', 18) : ico('lock', 16)}
      </button>`).join('')}
    </section>`).join('')}
  </div>`);
  bindCommon();
};

// ── урок: слайды → конспект → тест → практика ──
SCREENS.lesson = async (p) => {
  loading();
  const d = await api('lesson?id=' + (p.id || 0));
  if (!d.ok) return;
  if (d.locked) {
    mount(`${head(d.lesson.title, { back: true })}<div class="screen">
      <div class="card center" style="padding:36px 20px">
        <div style="color:var(--muted);margin-bottom:12px">${ico('lock', 30)}</div>
        <h2 style="font-size:19px;margin-bottom:8px">Урок закрыт</h2>
        <p class="muted small">Он входит в полный курс. Откройте доступ, и продолжите с этого места.</p>
        <button class="btn primary mt16" data-go="wallet">Открыть доступ</button>
      </div></div>`);
    bindCommon(); return;
  }
  const L = d.lesson;
  S.cache.lesson = d;
  let i = Math.min(L.slide || 0, Math.max(0, L.slides.length - 1));

  const paint = () => {
    const total = L.slides.length;
    const s = L.slides[i] || {};
    mount(`${head(d.course.title, { back: true })}
    <div class="screen">
      <div class="lesson-top">
        <span class="pill accent">${ico('spark', 13)} ${L.xp} XP</span>
        <span class="pill">${ico('clock', 13)} ${L.minutes} мин</span>
        ${L.state === 'done' ? `<span class="pill ok">${ico('check', 13)} пройден</span>` : ''}
      </div>
      <h1 style="font-size:20px;margin-bottom:14px">${esc(L.title)}</h1>

      <div class="slide" id="slide">
        <div class="kicker">слайд ${i + 1} из ${total}</div>
        <h2>${esc(s.title || L.title)}</h2>
        ${(s.text || '').split('\n').filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('')}
        ${ig(s)}
        ${Array.isArray(s.list) && s.list.length ? `<ul>${s.list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${s.note ? `<div class="note">${esc(s.note)}</div>` : ''}
      </div>
      <div class="slide-dots">${L.slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
      <div class="grid2" style="margin-top:12px">
        <button class="btn" id="prev" ${i === 0 ? 'disabled' : ''}>Назад</button>
        <button class="btn primary" id="next">${i >= total - 1 ? 'К конспекту' : 'Дальше'}</button>
      </div>
    </div>`);
    $('#prev').onclick = () => { if (i > 0) { i--; haptic(); paint(); } };
    $('#next').onclick = () => {
      if (i < total - 1) { i++; haptic(); api('lesson/slide', { id: L.id, slide: i }); paint(); }
      else { notesView(); }
    };
    bindCommon();
  };

  const notesView = () => {
    mount(`${head(d.course.title, { back: true })}
    <div class="screen">
      <h1 style="font-size:20px;margin-bottom:6px">${esc(L.title)}</h1>
      <div class="tiny" style="margin-bottom:14px">конспект урока</div>
      ${L.audio ? `<div class="card flat" style="padding:12px">
        <div class="tiny" style="margin-bottom:8px">конспект голосом автора</div>
        <audio controls preload="none" src="${BASE}${esc(L.audio)}" style="width:100%"></audio>
      </div>` : ''}
      <div class="card">${mdToHtml(L.notes)}</div>
      ${L.practice ? `<div class="card" style="border-color:var(--accent)">
        <div class="tiny" style="color:var(--accent)">практика</div>
        <div style="margin-top:8px">${mdToHtml(L.practice)}</div></div>` : ''}
      <button class="btn primary mt16" id="toquiz">${L.quiz.length ? 'Пройти тест' : 'Завершить урок'}</button>
      <button class="btn ghost" style="margin-top:8px" id="back2">Вернуться к слайдам</button>
    </div>`);
    $('#back2').onclick = () => { i = 0; paint(); };
    $('#toquiz').onclick = () => L.quiz.length ? quizView() : finish([]);
    bindCommon();
  };

  const quizView = () => {
    const answers = {};
    mount(`${head('Тест', { back: true })}
    <div class="screen">
      <h1 style="font-size:19px;margin-bottom:4px">${esc(L.title)}</h1>
      <p class="small muted" style="margin:0 0 18px">Проходной результат, 70%. Можно пересдать.</p>
      <div id="quiz">${L.quiz.map((q, qi) => `
        <div class="quiz-q" data-q="${qi}">
          <h4>${qi + 1}. ${esc(q.q)}</h4>
          ${q.options.map((o, oi) => `<button class="quiz-opt" data-q="${qi}" data-o="${oi}">
            <span class="mark"></span><span>${esc(o)}</span></button>`).join('')}
        </div>`).join('')}</div>
      <button class="btn primary" id="send" disabled>Проверить</button>
    </div>`);
    document.querySelectorAll('.quiz-opt').forEach(b => b.onclick = () => {
      const qi = b.dataset.q;
      document.querySelectorAll(`.quiz-opt[data-q="${qi}"]`).forEach(x => x.classList.remove('sel'));
      b.classList.add('sel'); answers[qi] = +b.dataset.o; haptic();
      $('#send').disabled = Object.keys(answers).length < L.quiz.length;
    });
    $('#send').onclick = () => finish(answers);
    bindCommon();
  };

  const finish = async (answers) => {
    const r = await api('lesson/quiz', { id: L.id, answers });
    if (!r.ok) return;
    if (S.me) { S.me.xp = r.xp; S.me.streak = r.streak; S.me.level = r.level; }
    if (r.passed) {
      haptic('medium');
      sparks();
      mount(`${head('Готово', { back: true })}
      <div class="screen">
        <div class="card center" style="padding:34px 20px;background:
          radial-gradient(120% 130% at 50% 0%, rgba(124,92,255,.22), transparent 62%), var(--surface)">
          <div style="color:var(--accent);margin-bottom:10px">${ico('check', 34, 2.4)}</div>
          <h2 style="font-size:22px;margin-bottom:6px">Урок пройден</h2>
          <p class="muted small">Результат теста: ${r.score}%${r.xp_gain ? ` · +${r.xp_gain} XP` : ''}</p>
          <div class="row" style="justify-content:center;gap:10px;margin-top:16px">
            <span class="pill accent">${ico('fire', 13)} серия ${r.streak}</span>
            <span class="pill">${ico('star', 13)} ${r.level.name}</span>
          </div>
        </div>
        ${r.certificate ? `<div class="cert"><div class="num">${esc(r.certificate.number)}</div>
          <b style="display:block;margin:6px 0">Курс завершён. Сертификат ваш.</b>
          <span class="small muted">Покажите его заказчику в профиле.</span></div>` : ''}
        ${d.next ? `<button class="btn primary" data-lesson="${d.next.id}">Следующий урок: ${esc(d.next.title)}</button>` : ''}
        <button class="btn ghost" style="margin-top:8px" data-go="course" data-slug="${esc(d.course.slug)}">К программе курса</button>
      </div>`);
    } else {
      mount(`${head('Тест', { back: true })}
      <div class="screen">
        <div class="card center" style="padding:30px 20px">
          <h2 style="font-size:20px;margin-bottom:8px">${r.score}%, пока мало</h2>
          <p class="muted small">Нужно 70%. Вернитесь к конспекту и попробуйте снова: это не экзамен, а тренировка.</p>
          <button class="btn primary mt16" id="again">Пройти ещё раз</button>
          <button class="btn ghost" style="margin-top:8px" id="notes2">Открыть конспект</button>
        </div>
      </div>`);
      $('#again').onclick = quizView;
      $('#notes2').onclick = notesView;
    }
    bindCommon();
  };

  paint();
};

function mdToHtml(src) {
  const lines = String(src || '').split('\n');
  let html = '', inList = false;
  for (const raw of lines) {
    const t = raw.trim();
    if (!t) { if (inList) { html += '</ul>'; inList = false; } continue; }
    if (t.startsWith('## ')) { if (inList) { html += '</ul>'; inList = false; }
      html += `<h3 style="font-size:16px;margin:14px 0 8px">${esc(t.slice(3))}</h3>`; continue; }
    if (t.startsWith('- ') || t.startsWith('• ')) {
      if (!inList) { html += '<ul style="padding-left:18px;margin:0 0 10px">'; inList = true; }
      html += `<li style="margin-bottom:6px">${inline(t.slice(2))}</li>`; continue;
    }
    if (inList) { html += '</ul>'; inList = false; }
    html += `<p style="margin:0 0 10px">${inline(t)}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
  function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
}

// ── биржа ──
SCREENS.orders = async () => {
  loading();
  const [o, c] = await Promise.all([api('orders'), api('catalog')]);
  const tab = S.params.tab || 'orders';
  mount(`${head('Биржа')}
  <div class="screen">
    <div class="chips" style="margin-bottom:14px">
      <button class="chip ${tab === 'orders' ? 'on' : ''}" data-tab2="orders">Заявки</button>
      <button class="chip ${tab === 'people' ? 'on' : ''}" data-tab2="people">Исполнители</button>
      <button class="chip" id="add">${ico('plus', 14)} Разместить</button>
    </div>
    ${tab === 'orders' ? (o.items && o.items.length ? o.items.map(x => `
      <div class="order reveal" data-order="${x.id}">
        <h3>${esc(x.title)}</h3>
        <div class="small muted">${esc((x.descr || '').slice(0, 160))}</div>
        <div class="meta">
          <span class="pill">${esc(ORDER_KIND[x.kind] || x.kind)}</span>
          ${x.city ? `<span class="pill">${ico('pin', 13)} ${esc(x.city)}</span>` : ''}
          ${+x.remote ? `<span class="pill">удалённо</span>` : ''}
          ${x.budget ? `<span class="pill accent">${money(x.budget)} ₽</span>` : ''}
          <span class="pill">${x.responses} ${plural(+x.responses, 'отклик', 'отклика', 'откликов')}</span>
          ${x.my_response ? `<span class="pill ok">вы откликнулись</span>` : ''}
        </div>
      </div>`).join('') : empty('Заявок пока нет', 'Как появятся, они будут здесь и в боте.'))
    : (c.items && c.items.length ? c.items.map(personCard).join('')
       : empty('Исполнителей пока нет', 'Пройдите курс и заполните профиль, попадёте в каталог.'))}
  </div>`);
  document.querySelectorAll('[data-tab2]').forEach(b => b.onclick = () => go('orders', { tab: b.dataset.tab2 }, true));
  $('#add').onclick = orderForm;
  bindCommon();
};

function personCard(p) {
  return `<div class="person reveal" data-person="${p.id}">
    ${p.photo ? `<img class="avatar" src="${esc(p.photo)}" alt="">`
              : `<div class="avatar">${esc((p.name || '?').slice(0, 1).toUpperCase())}</div>`}
    <div class="col" style="flex:1">
      <div class="row between">
        <b>${esc(p.name)}</b>
        ${p.verified ? `<span class="pill ok">проверен</span>` : ''}
      </div>
      <span class="small muted">${esc(p.city || 'город не указан')}${p.price_from ? ' · от ' + money(p.price_from) + ' ₽' : ''}</span>
      ${p.services && p.services.length ? `<div class="chips" style="margin-top:6px">
        ${p.services.slice(0, 3).map(s => `<span class="chip" style="padding:5px 10px;font-size:12px">${esc(s)}</span>`).join('')}
      </div>` : ''}
    </div>
  </div>`;
}

function guestStub(title, text) {
  const bot = 'https://t.me/' + (S.app.bot || 'vcodemedia_bot');
  return `<div class="card center reveal" style="padding:34px 20px">
    <div style="color:var(--accent);margin-bottom:10px">${ico('lock', 28)}</div>
    <h2 style="font-size:19px;margin-bottom:8px">${esc(title)}</h2>
    <p class="muted small" style="margin-bottom:16px">${esc(text)}</p>
    <a class="btn primary" href="${bot}">Открыть в Telegram</a>
    <button class="btn ghost" style="margin-top:8px" data-go="academy">Посмотреть программу</button>
  </div>`;
}

function empty(title, text) {
  return `<div class="empty">${ico('cases', 34)}<h3 style="font-size:16px;margin-bottom:6px">${esc(title)}</h3>
    <p class="small">${esc(text)}</p></div>`;
}

SCREENS.order = async (p) => {
  loading();
  const d = await api('order?id=' + (p.id || 0));
  if (!d.ok) return;
  const o = d.order;
  mount(`${head('Заявка', { back: true })}
  <div class="screen">
    <h1 style="font-size:20px;margin-bottom:10px">${esc(o.title)}</h1>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <span class="pill">${esc(ORDER_KIND[o.kind] || o.kind)}</span>
      ${o.city ? `<span class="pill">${ico('pin', 13)} ${esc(o.city)}</span>` : ''}
      ${o.budget ? `<span class="pill accent">${money(o.budget)} ₽</span>` : ''}
      ${o.deadline ? `<span class="pill">${ico('clock', 13)} ${esc(o.deadline)}</span>` : ''}
    </div>
    <div class="card">${mdToHtml(o.descr)}</div>
    ${d.responses.length ? `<div class="section-title"><h2>Отклики</h2></div>
      ${d.responses.map(r => `<div class="card">
        ${personCard(r.user)}
        <div class="small" style="margin-top:8px">${esc(r.text)}</div>
        ${r.price ? `<div class="pill accent" style="margin-top:8px">${money(r.price)} ₽</div>` : ''}
      </div>`).join('')}` : ''}
    <button class="btn primary mt16" id="resp">Откликнуться</button>
    <p class="small muted center" style="margin-top:10px">
      Сервис берёт ${S.app.fee || 20}% с оплаченного заказа. Общение и сдача работы, внутри сделки.</p>
  </div>`);
  $('#resp').onclick = () => respondForm(o.id);
  bindCommon();
};

function respondForm(orderId) {
  const b = sheet(`<h2 style="font-size:18px;margin-bottom:12px">Отклик на заявку</h2>
    <label class="tiny">Что предлагаете</label>
    <textarea id="r-text" placeholder="Что сделаю, в какие сроки, что уже снимал по этой теме"></textarea>
    <label class="tiny mt16">Ваша цена, ₽</label>
    <input id="r-price" type="number" inputmode="numeric" placeholder="6000">
    <button class="btn primary mt16" id="r-send">Отправить</button>
    <button class="btn ghost" style="margin-top:8px" data-close>Отмена</button>`);
  $('#r-send', b).onclick = async () => {
    const r = await api('orders/respond', { order_id: orderId,
      text: $('#r-text', b).value, price: +$('#r-price', b).value || 0 });
    if (r.ok) { closeSheet(); toast('Отклик отправлен'); go('orders'); }
  };
}

function orderForm() {
  const b = sheet(`<h2 style="font-size:18px;margin-bottom:12px">Разместить заявку</h2>
    <label class="tiny">Что нужно снять</label>
    <input id="o-title" placeholder="Обзор кофейни для Reels">
    <label class="tiny mt16">Подробности</label>
    <textarea id="o-descr" placeholder="Формат, сроки, что показать, есть ли сценарий"></textarea>
    <div class="grid2 mt16">
      <div><label class="tiny">Формат</label>
        <select id="o-kind">${Object.entries(ORDER_KIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div><label class="tiny">Бюджет, ₽</label><input id="o-budget" type="number" inputmode="numeric" placeholder="6000"></div>
    </div>
    <div class="grid2" style="margin-top:10px">
      <div><label class="tiny">Город</label><input id="o-city" placeholder="Ставрополь"></div>
      <div><label class="tiny">Срок</label><input id="o-deadline" placeholder="до 20 числа"></div>
    </div>
    <label class="tiny mt16">Связь</label>
    <input id="o-contact" placeholder="@username или телефон">
    <button class="btn primary mt16" id="o-send">Отправить на модерацию</button>
    <p class="small muted center" style="margin-top:10px">Заявка появится на бирже после проверки.</p>`);
  $('#o-send', b).onclick = async () => {
    const r = await api('orders/create', {
      title: $('#o-title', b).value, descr: $('#o-descr', b).value,
      kind: $('#o-kind', b).value, budget: +$('#o-budget', b).value || 0,
      city: $('#o-city', b).value, deadline: $('#o-deadline', b).value,
      contact: $('#o-contact', b).value,
    });
    if (r.ok) { closeSheet(); toast('Заявка отправлена на модерацию'); }
  };
}

// ── тариф и партнёрка ──
SCREENS.wallet = async () => {
  loading();
  const d = await api('wallet');
  if (!d.ok) {
    mount(`${head('Тариф')}<div class="screen">${guestStub('Тариф и партнёрка',
      'Оплата, подписка и партнёрская ссылка живут внутри приложения Telegram: там видно, кто вы.')}</div>`);
    bindCommon(); return;
  }
  const price = d.plan.price || {};
  mount(`${head('Тариф')}
  <div class="screen">
    <div class="card flat row between">
      <div class="col"><span class="tiny">текущий тариф</span>
        <b style="font-size:17px">${d.plan.name === 'free' ? 'Старт' : (d.plan.name === 'pro' ? 'PRO' : 'Наставник')}</b>
        ${d.plan.until ? `<span class="small muted">до ${esc(String(d.plan.until).slice(0, 10))}</span>` : ''}
      </div>
      <span class="pill ${d.plan.name === 'free' ? '' : 'grad'}">${d.plan.name === 'free' ? 'базовый' : 'активен'}</span>
    </div>

    <div class="plan">
      <span class="pill">Старт</span>
      <div class="price">0 ₽</div>
      <ul>
        <li>${ico('check', 15)} Первый блок курса</li>
        <li>${ico('check', 15)} Биржа на просмотр</li>
        <li>${ico('check', 15)} Профиль креатора</li>
      </ul>
    </div>

    <div class="plan best">
      <span class="pill grad">PRO · выбор большинства</span>
      <div class="price">${money(price.pro)} ₽<span style="font-size:14px;color:var(--muted)"> / месяц</span></div>
      <ul>
        <li>${ico('check', 15)} Весь курс и все новые уроки</li>
        <li>${ico('check', 15)} Сертификат за направление</li>
        <li>${ico('check', 15)} Отклики на заявки заказчиков</li>
        <li>${ico('check', 15)} Место в каталоге исполнителей</li>
      </ul>
      <button class="btn primary" data-pay="plan:pro">Оформить PRO</button>
    </div>

    <div class="plan">
      <span class="pill">Наставник</span>
      <div class="price">${money(price.mentor)} ₽<span style="font-size:14px;color:var(--muted)"> / месяц</span></div>
      <ul>
        <li>${ico('check', 15)} Всё из PRO</li>
        <li>${ico('check', 15)} Разбор ваших роликов раз в неделю</li>
        <li>${ico('check', 15)} Личные правки по сценарию и монтажу</li>
      </ul>
      <button class="btn" data-pay="plan:mentor">Оформить</button>
    </div>

    <div class="section-title"><h2>Партнёрская программа</h2></div>
    <div class="card">
      <p class="small muted" style="margin:0 0 12px">
        Приводите людей по своей ссылке: 30% с каждой их оплаты падает на ваш счёт.</p>
      <div class="row between" style="gap:10px">
        <code style="font-size:12.5px;word-break:break-all;color:var(--accent-2)">${esc(d.ref.link)}</code>
        <button class="btn sm" id="copy">${ico('share', 14)}</button>
      </div>
      <div class="hr"></div>
      <div class="row between"><span class="muted small">Приглашено</span><b>${d.ref.count}</b></div>
      <div class="row between" style="margin-top:6px"><span class="muted small">Баланс</span><b>${money(d.balance)} ₽</b></div>
    </div>

    ${d.payments.length ? `<div class="section-title"><h2>История</h2></div>
      ${d.payments.map(p => `<div class="card flat row between">
        <div class="col"><b style="font-size:14px">${esc(productName(p.product))}</b>
          <span class="small muted">${esc(String(p.created_at).slice(0, 16))}</span></div>
        <span class="pill ${p.status === 'paid' ? 'ok' : 'warn'}">${money(p.amount)} ₽</span>
      </div>`).join('')}` : ''}
  </div>`);
  $('#copy').onclick = () => { navigator.clipboard.writeText(d.ref.link); toast('Ссылка скопирована'); };
  document.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => payForm(b.dataset.pay));
  bindCommon();
};

function productName(code) {
  if (code === 'plan:pro') return 'Тариф PRO';
  if (code === 'plan:mentor') return 'Тариф Наставник';
  if (String(code).startsWith('course:')) return 'Курс ' + code.slice(7);
  return code;
}

function payForm(product) {
  const b = sheet(`<h2 style="font-size:18px;margin-bottom:6px">${esc(productName(product))}</h2>
    <p class="small muted">Оплата картой РФ или зарубежной. Доступ открывается сразу после оплаты.</p>
    <label class="tiny mt16">Промокод</label>
    <input id="p-promo" placeholder="если есть">
    <button class="btn primary mt16" id="p-go">Перейти к оплате</button>
    <button class="btn ghost" style="margin-top:8px" data-close>Отмена</button>`);
  $('#p-go', b).onclick = async () => {
    const r = await api('pay', { product, promo: $('#p-promo', b).value });
    if (!r.ok) return;
    if (r.url) { closeSheet(); TG ? TG.openLink(r.url) : window.open(r.url, '_blank'); }
    else {
      sheet(`<h2 style="font-size:18px;margin-bottom:8px">Счёт на ${money(r.amount)} ₽</h2>
        <p class="small muted">Онлайн-касса подключается. Пока напишите в поддержку
        ${esc(S.app.support || '')}, пришлём ссылку на оплату и откроем доступ.</p>
        <button class="btn primary mt16" id="p-sup">Написать в поддержку</button>
        <button class="btn ghost" style="margin-top:8px" data-close>Закрыть</button>`);
      $('#p-sup').onclick = () => {
        const u = 'https://t.me/' + String(S.app.support || '').replace('@', '');
        TG ? TG.openTelegramLink(u) : window.open(u, '_blank');
      };
    }
  };
}

// ── профиль ──
SCREENS.profile = async () => {
  loading();
  const [p, c] = await Promise.all([api('profile'), api('certificates')]);
  if (!p.ok) {
    mount(`${head('Профиль')}<div class="screen">${guestStub('Профиль креатора',
      'Витрина для заказчика, сертификаты и настройки открываются после входа через Telegram.')}</div>`);
    bindCommon(); return;
  }
  const u = p.user;
  S.me = u;
  mount(`${head('Профиль')}
  <div class="screen">
    <div class="prof-head">
      ${u.photo ? `<img class="avatar" src="${esc(u.photo)}" alt="">`
                : `<div class="avatar">${esc((u.name || '?').slice(0, 1).toUpperCase())}</div>`}
      <div class="col" style="flex:1">
        <b style="font-size:17px">${esc(u.name)}</b>
        <span class="small muted">${u.username ? '@' + esc(u.username) : 'Телеграм'} · ${esc(u.city || 'город не указан')}</span>
        <div class="row" style="gap:6px;margin-top:6px">
          <span class="pill accent">${ico('star', 12)} ${esc(u.level.name)}</span>
          <span class="pill">${ico('fire', 12)} ${u.streak}</span>
        </div>
      </div>
    </div>

    <div class="grid2">
      <div class="card flat center mb0"><b style="font-size:20px;font-family:Unbounded">${u.lessons_done}</b>
        <div class="tiny">уроков пройдено</div></div>
      <div class="card flat center mb0"><b style="font-size:20px;font-family:Unbounded">${u.xp}</b>
        <div class="tiny">опыта</div></div>
    </div>

    <div class="section-title"><h2>Витрина для заказчика</h2></div>
    <div class="card">
      <label class="tiny">Город</label>
      <input id="f-city" value="${esc(u.city)}" placeholder="Ставрополь">
      <label class="tiny mt16">О себе</label>
      <textarea id="f-about" placeholder="Что снимаете, чем полезны бизнесу">${esc(u.about)}</textarea>
      <label class="tiny mt16">Что делаете</label>
      <div class="chips" id="f-serv" style="margin-top:6px">
        ${['Рилс', 'Обзоры', 'Съёмка', 'Монтаж', 'Сценарий', 'Фото', 'Продакшн']
          .map(s => `<button class="chip ${(u.services || []).includes(s) ? 'on' : ''}" data-serv="${s}">${s}</button>`).join('')}
      </div>
      <label class="tiny mt16">Цена от, ₽</label>
      <input id="f-price" type="number" inputmode="numeric" value="${u.price_from || ''}" placeholder="6000">
      <label class="tiny mt16">Instagram / TikTok / канал</label>
      <input id="f-link" value="${esc((u.links && u.links.main) || '')}" placeholder="https://instagram.com/...">
      <button class="btn primary mt16" id="f-save">Сохранить</button>
    </div>

    <div class="section-title"><h2>Я на бирже</h2></div>
    <div class="chips">
      <button class="chip ${u.role === 'creator' ? 'on' : ''}" data-role="creator">Исполнитель</button>
      <button class="chip ${u.role === 'client' ? 'on' : ''}" data-role="client">Заказчик</button>
    </div>

    ${c.items && c.items.length ? `<div class="section-title"><h2>Сертификаты</h2></div>
      ${c.items.map(x => `<div class="cert"><div class="num">${esc(x.number)}</div>
        <b style="display:block;margin:6px 0">${esc(x.title)}</b>
        <span class="small muted">выдан ${esc(String(x.issued_at).slice(0, 10))}</span></div>`).join('')}` : ''}

    <div class="section-title"><h2>Настройки</h2></div>
    <button class="card tap row between" id="th" style="width:100%">
      <span class="row" style="gap:10px">${ico('sun', 18)} Тема</span>
      <span class="muted small">${document.documentElement.dataset.vcTheme === 'light' ? 'светлая' : 'тёмная'}</span>
    </button>
    <button class="card tap row between" id="nt" style="width:100%">
      <span class="row" style="gap:10px">${ico('bell', 18)} Уведомления бота</span>
      <span class="muted small">${u.notify ? 'включены' : 'выключены'}</span>
    </button>
    <button class="card tap row between" id="sup" style="width:100%">
      <span class="row" style="gap:10px">${ico('share', 18)} Поддержка</span>
      <span class="muted small">${esc(S.app.support || '')}</span>
    </button>
    ${u.is_admin ? `<a class="card tap row between" href="${BASE}admin/" style="width:100%">
      <span class="row" style="gap:10px">${ico('gear', 18)} Админ-панель</span>${ico('arrow', 16)}</a>` : ''}
    <p class="small muted center" style="margin-top:18px">V.LIONOFF · версия 1.0</p>
  </div>`);

  const serv = new Set(u.services || []);
  document.querySelectorAll('[data-serv]').forEach(b => b.onclick = () => {
    const s = b.dataset.serv;
    serv.has(s) ? serv.delete(s) : serv.add(s);
    b.classList.toggle('on'); haptic();
  });
  document.querySelectorAll('[data-role]').forEach(b => b.onclick = async () => {
    await api('profile', { role: b.dataset.role });
    toast('Роль обновлена'); go('profile', {}, true);
  });
  $('#f-save').onclick = async () => {
    const r = await api('profile', {
      city: $('#f-city').value, about: $('#f-about').value,
      services: [...serv], price_from: +$('#f-price').value || 0,
      links: { main: $('#f-link').value },
    });
    if (r.ok) toast('Профиль сохранён');
  };
  $('#th').onclick = toggleTheme;
  $('#nt').onclick = async () => { await api('profile', { notify: u.notify ? 0 : 1 }); go('profile', {}, true); };
  $('#sup').onclick = () => {
    const url = 'https://t.me/' + String(S.app.support || '').replace('@', '');
    TG ? TG.openTelegramLink(url) : window.open(url, '_blank');
  };
  bindCommon();
};


// ─────────────────────────── сайт (вне Телеграма) ───────────────────────────
SCREENS.site = async () => {
  const d = await api('home');
  const courses = (d.courses || []);
  const bot = 'https://t.me/' + (S.app.bot || 'vcodemedia_bot');
  mount(`${head('V.LIONOFF')}
  <div class="screen" style="max-width:980px">
    <section class="hero reveal" style="padding:0;overflow:hidden">
      <img src="${BASE}assets/img/hero.jpg" alt="" style="width:100%;display:block;opacity:.9"
        onerror="this.style.display='none'">
      <div style="padding:22px">
        <h1 style="font-size:28px;line-height:1.08">Снимайте ролики,<br>которые приносят заявки</h1>
        <p class="muted" style="margin:12px 0 0;font-size:15px">
          Школа контент-креаторов и биржа заказов в одном приложении.
          Учитесь, собирайте профиль и берите заказы бизнеса в своём городе.</p>
        <div class="row" style="gap:10px;margin-top:18px;flex-wrap:wrap">
          <a class="btn primary" style="width:auto;padding:14px 26px" href="${bot}">Открыть в Telegram</a>
          <button class="btn" style="width:auto;padding:14px 22px" data-go="academy">Посмотреть программу</button>
        </div>
      </div>
    </section>

    <div class="grid2 reveal" style="margin-top:4px">
      <div class="card flat center mb0"><b class="count" data-to="${d.stats.lessons}" style="font-family:Unbounded;font-size:26px">0</b>
        <div class="tiny">уроков в академии</div></div>
      <div class="card flat center mb0"><b class="count" data-to="${d.stats.creators}" style="font-family:Unbounded;font-size:26px">0</b>
        <div class="tiny">креаторов в каталоге</div></div>
    </div>

    <div class="section-title"><h2>Что внутри</h2></div>
    <div class="card reveal">
      <div class="ig ig-steps">
        <div class="ig-step"><span class="n">1</span><span class="t">
          <b>Академия</b>Курсы полного формата: слайды, конспект, тест и практика в каждом уроке. Сертификат за направление.</span></div>
        <div class="ig-step"><span class="n">2</span><span class="t">
          <b>Биржа заказов</b>Заказчики оставляют заявки: обзоры, рилс, съёмка. Откликаетесь прямо в приложении.</span></div>
        <div class="ig-step"><span class="n">3</span><span class="t">
          <b>Профиль-витрина</b>Город, услуги, цена и портфолио. Заказчик находит вас в каталоге исполнителей.</span></div>
        <div class="ig-step"><span class="n">4</span><span class="t">
          <b>Партнёрская программа</b>Своя ссылка и доля с каждого, кого вы привели.</span></div>
      </div>
    </div>

    <div class="section-title"><h2>Программа</h2></div>
    ${courses.map(courseCard).join('')}

    <div class="section-title"><h2>Сколько стоит</h2></div>
    <div class="plan reveal"><span class="pill">Старт</span>
      <div class="price">0 ₽</div>
      <ul><li>${ico('check',15)} Первый блок курса</li>
          <li>${ico('check',15)} Биржа на просмотр</li>
          <li>${ico('check',15)} Профиль креатора</li></ul></div>
    <div class="plan best reveal"><span class="pill grad">PRO</span>
      <div class="price">${money((S.app.plan_price||{}).pro || 1490)} ₽<span style="font-size:14px;color:var(--muted)"> / месяц</span></div>
      <ul><li>${ico('check',15)} Весь курс и новые уроки</li>
          <li>${ico('check',15)} Сертификат</li>
          <li>${ico('check',15)} Отклики на заявки</li>
          <li>${ico('check',15)} Место в каталоге исполнителей</li></ul>
      <a class="btn primary" href="${bot}">Начать</a></div>

    <div class="card center reveal" style="margin-top:18px">
      <h2 style="font-size:19px;margin-bottom:8px">Приложение живёт в Telegram</h2>
      <p class="muted small" style="margin-bottom:14px">Открывается в один клик, ничего скачивать не нужно.</p>
      <a class="btn primary" href="${bot}">Открыть V.LIONOFF</a>
    </div>
    <p class="small muted center" style="margin:20px 0 10px">
      V.LIONOFF · школа контент-креаторов и биржа заказов · ${new Date().getFullYear()}</p>
  </div>`);
  bindCommon();
};

// ─────────────────────────── общее связывание ───────────────────────────
function bindCommon() {
  document.querySelectorAll('[data-course]').forEach(b => b.onclick = () => go('course', { slug: b.dataset.course }));
  document.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => go('lesson', { id: +b.dataset.lesson }));
  document.querySelectorAll('[data-order]').forEach(b => b.onclick = () => go('order', { id: +b.dataset.order }));
  document.querySelectorAll('[data-go]').forEach(b => b.onclick = (e) => {
    e.preventDefault();
    go(b.dataset.go, b.dataset.slug ? { slug: b.dataset.slug } : {});
  });
  document.querySelectorAll('[data-person]').forEach(b => b.onclick = () => toast('Карточка исполнителя: скоро чат внутри сделки'));
}

// ─────────────────────────── запуск ───────────────────────────
async function boot() {
  const saved = localStorage.getItem('vc_theme');
  if (saved) document.documentElement.dataset.vcTheme = saved;
  if (TG) {
    TG.ready(); TG.expand();
    try { TG.setHeaderColor && TG.setHeaderColor('#08090C'); } catch (e) {}
    try { TG.disableVerticalSwipes && TG.disableVerticalSwipes(); } catch (e) {}
    TG.BackButton.onClick(() => history.back());
    if (TG.initData && TG.colorScheme === 'light' && !saved) {
      document.documentElement.dataset.vcTheme = 'light';
    }
  }
  const start = TG && TG.initDataUnsafe ? (TG.initDataUnsafe.start_param || '') : '';
  const r = await api('auth', { initData: TG ? TG.initData : '', start });
  if (r.ok) {
    S.app = r.app || {};
    S.guest = !r.user;
    if (r.token) { S.token = r.token; localStorage.setItem('vc_token', r.token); }
    if (r.user) {
      S.me = r.user;
      if (r.user.theme && !saved) document.documentElement.dataset.vcTheme = r.user.theme;
    }
  }
  const st = parseHash();
  if (!INSIDE_TG && !location.hash) { st.screen = 'site'; }
  S.screen = st.screen; S.params = st.params;
  history.replaceState({ screen: S.screen, params: S.params }, '', location.hash || '#home');
  draw();
}

document.addEventListener('click', (e) => {
  if (e.target && e.target.hasAttribute && e.target.hasAttribute('data-close')) closeSheet();
});

boot();
})();
