/* ================= PROFILE-SOCIAL (ps-): чужие профили, подписки, соцграф ================= */
/* Fullscreen-профиль любого автора (#psView): аватар, имя + verified, ник, био,
   статистика, Подписаться/Отписаться (персист oko-social), Написать (личный чат),
   лента постов автора. Точки входа: имя/аватар в ленте (делегирование на #feedList),
   аватар в шапке конва (кроме своих/каналов), автор в глобальном поиске.
   Подписки поднимают посты автора выше во вкладке «Подписки» (стабильная
   пересортировка POSTS.sub) и дают буст в рекомендациях (chain feedScore). */

const PS = {
  cur: null,        /* имя автора, чей профиль открыт */
  follow: {},       /* {имя: ts подписки} — персист в oko-social */
  graphName: null,  /* автор, чей соцграф открыт */
  graphTab: 'followers',
  tab: 'posts',     /* активная вкладка профиля: posts | media */
};

/* ---------- персист ---------- */
function psLoadState(){
  try{
    const s = JSON.parse(localStorage.getItem('oko-social') || 'null');
    if(s && s.follow && typeof s.follow === 'object') PS.follow = s.follow;
  }catch(e){}
}
function psSaveState(){
  try{ localStorage.setItem('oko-social', JSON.stringify({follow: PS.follow, at: Date.now()})); }catch(e){}
}
function psIsFollowing(name){ return !!PS.follow[name]; }

/* ---------- утилиты ---------- */
function psHash(s){
  let h = 2166136261;
  for(let i = 0; i < String(s).length; i++){ h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function psFmt(n){ try{ return Math.round(n).toLocaleString('ru-RU'); }catch(e){ return String(n); } }
function psAttr(s){ return esc(s).replace(/'/g, '&#39;'); }
function psInitials(name){
  return String(name).trim().split(/\s+/).slice(0, 2).map(w => (w[0]||'').toUpperCase()).join('') || 'U';
}
const PS_TRANSLIT = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
function psNick(name){
  const raw = String(name).toLowerCase().replace(/[^a-zа-яё0-9]+/g, '')
    .split('').map(ch => PS_TRANSLIT[ch] !== undefined ? PS_TRANSLIT[ch] : ch).join('');
  return (raw.slice(0, 14) || 'user' + (psHash(name) % 999));
}
function psAgo(p){
  if(!p.ts) return 'недавно';
  const h = Math.max(1, Math.round((Date.now() - p.ts) / 36e5));
  if(h < 24) return h + ' ч назад';
  const d = Math.round(h / 24);
  return d + ' ' + (d === 1 ? 'день' : (d < 5 ? 'дня' : 'дней')) + ' назад';
}
/* id поста из карточки ленты (по onclick кнопки меню — не ломая чужой DOM) */
function psPostIdOf(art){
  const b = art && art.querySelector('.post-more');
  const m = b && (b.getAttribute('onclick') || '').match(/openPostMenu\((\d+)/);
  return m ? +m[1] : null;
}

/* ---------- био: рукописные для известных авторов + генератор ---------- */
const PS_BIOS = {
  'Марк Волков':      'Монтажёр вертикальных форматов. Собираю Reels для локального бизнеса: хук, ритм, караоке-субтитры. Кейсы и цифры досмотров — в постах.',
  'Алина Крид':       'SMM-стратег. Разбираю алгоритмы простыми словами и превращаю метрики в план публикаций. Тесты форматов — каждую неделю.',
  'OKO Team':         'Официальная команда OKO. Анонсы сборок, новые разделы приложения и разборы фич — из первых рук.',
  'OKO · Официальный':'Официальный канал OKO в ленте: обновления премодератора, алгоритмов и сервисов приложения.',
  'Даниэль / рост':   'Канал о росте на системе: контент-заводы, автоматизация и цифры вместо вдохновения.',
  'Даниэль':          'Основатель OKO. Строю приложение, где мессенджер, лента и заработок живут в одном месте.',
  'Клуб OKO':         'Сообщество практиков OKO: открытые разборы, эфиры и первые заказы на бирже.',
  'Клуб OKO · Рост':  'Закрытый клуб роста: еженедельные разборы роликов и воронок участников.',
  'Кейс недели':      'Подборка живых кейсов из OKO: цифры, воронки и что реально сработало.',
  'OKO Партнёрам':    'Всё про партнёрскую программу OKO: ставки, выплаты и топы месяца.',
  'Поддержка OKO':    'ИИ-поддержка OKO. Отвечает на вопросы о приложении круглосуточно; сложные случаи передаёт команде.',
  'Аня':              'Дизайнер обложек и визуала. Люблю чистую сетку, лайм и тёмные темы.',
  'Биржа OKO':        'Сервис безопасных сделок OKO: исполнители с рейтингом, оплата после приёмки.',
};
const PS_BIO_TOPIC = {
  ai:       'Пишу про нейросети без магии: пайплайны, промпты и локальные модели в деле.',
  content:  'Контент как система: хуки, монтаж, удержание. Разбираю на живых роликах.',
  business: 'Считаю юнит-экономику и строю процессы, которые работают без собственника.',
  marketing:'Перформанс и креативы: связки, тесты, CPL. Только то, что пережило A/B.',
  games:    'Геймдев маленькой командой: прототипы, плейтесты и честные цифры ретеншна.',
  crypto:   'Слежу за TON и ончейн-метриками. Без сигналов — только данные и риски.',
};
const PS_BIO_POOL = [
  'Автор OKO. Делюсь опытом и цифрами из своих проектов — без воды.',
  'Веду канал о своём деле: процессы, ошибки и что в итоге сработало.',
  'Практик, а не теоретик: каждый пост — из реальной задачи.',
  'Собираю здесь то, что помогает расти: приёмы, инструменты, разборы.',
];
function psBio(name, topic, sub){
  if(PS_BIOS[name]) return PS_BIOS[name];
  if(topic && PS_BIO_TOPIC[topic]) return PS_BIO_TOPIC[topic];
  const s = String(sub || '').toLowerCase();
  if(s.indexOf('smm') > -1) return PS_BIO_TOPIC.marketing;
  if(s.indexOf('монтаж') > -1) return PS_BIO_TOPIC.content;
  if(s.indexOf('сообщество') > -1) return 'Живое сообщество в OKO: обсуждения, разборы и взаимопомощь участников.';
  return PS_BIO_POOL[psHash(name) % PS_BIO_POOL.length];
}

/* ---------- «Актуальное»: сторис-кружки (Instagram highlights) ----------
   Каталог рубрик: label → иконка + текст мини-«истории». Набор для автора —
   детерминированный (команда/тема влияют на состав). */
const PS_HL = {
  'Анонсы':   {ic:'megaphone',   txt:'Свежие анонсы сборок и новых разделов OKO — что уже вышло и что дальше в работе.'},
  'Фичи':     {ic:'bolt',        txt:'Разборы новых возможностей приложения: как включить, где найти и зачем оно нужно.'},
  'Ответы':   {ic:'chat',        txt:'Частые вопросы и быстрые ответы. Сложные случаи передаём живой команде.'},
  'Кейсы':    {ic:'fire',        txt:'Живые кейсы с цифрами: было / стало, воронка и что именно сработало.'},
  'Отзывы':   {ic:'heart',       txt:'Реальные отклики подписчиков и клиентов — без накрутки и постановки.'},
  'Услуги':   {ic:'briefcase',   txt:'Чем помогаю, форматы работы, сроки и как считается результат.'},
  'Гайды':    {ic:'compass',     txt:'Пошаговые гайды и чек-листы из практики. Открой и сохрани себе.'},
  'Процесс':  {ic:'circle-play', txt:'Как всё устроено изнутри: инструменты, этапы и рабочий процесс.'},
  'Лучшее':   {ic:'star',        txt:'Подборка самых полезных публикаций автора в одном месте.'},
  'Нейросети':{ic:'rocket',      txt:'Пайплайны, промпты и локальные модели в деле — без магии и воды.'},
  'Монтаж':   {ic:'circle-play', txt:'Приёмы монтажа вертикалок: хук, ритм, караоке-субтитры, удержание.'},
  'Рост':     {ic:'rocket',      txt:'Метрики, воронки и что двигает рост. Цифры вместо вдохновения.'},
};
/* «портфолио» для медиа-сетки — детерминированные плитки-работы автора */
const PS_PORTFOLIO = [
  {ic:'circle-play', title:'Reels-кейс',  txt:'Вертикальный ролик с сильным хуком и караоке-субтитрами — досмотры выше среднего по нише.'},
  {ic:'rocket',      title:'Запуск',      txt:'Разбор запуска от связки креатив → лид → продажа. Что тестировали и что оставили.'},
  {ic:'fire',        title:'Залетевшее',  txt:'Формат, который собрал больше всего охватов за месяц. Почему он сработал.'},
  {ic:'briefcase',   title:'Услуга',      txt:'Что входит в работу, сроки и как измеряется результат для клиента.'},
  {ic:'compass',     title:'Гайд',        txt:'Пошаговый разбор приёма из практики — бери и повторяй у себя.'},
  {ic:'star',        title:'Избранное',   txt:'Подборка сильных работ автора, отобранных вручную.'},
  {ic:'megaphone',   title:'Промо',       txt:'Промо-материал в фирменном стиле бренда: чёрный + лайм.'},
  {ic:'bolt',        title:'Процесс',     txt:'Как устроен процесс изнутри: инструменты и этапы сборки.'},
];

/* ---------- модель автора: посты + чаты + детерминированная статистика ---------- */
function psAuthor(name){
  const posts = [];
  try{ [...POSTS.sub, ...POSTS.rec].forEach(p => { if(p.name === name) posts.push(p); }); }catch(e){}
  posts.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const p0 = posts[0] || null;
  const chat = (typeof CHATS !== 'undefined') ? CHATS.find(c => c.kind === 'direct' && c.name === name) : null;
  const anyChat = chat || ((typeof CHATS !== 'undefined') ? CHATS.find(c => c.name === name) : null);
  const h = psHash(name);
  const sub = (p0 && p0.sub) || '';

  let followers = 0;
  for(const p of posts){ /* аудитория из любого поста автора: «канал · 48.2к» */
    const m = String(p.sub || '').match(/(\d+(?:[.,]\d+)?)\s*к/i);
    if(m){ followers = Math.round(parseFloat(m[1].replace(',', '.')) * 1000); break; }
  }
  if(!followers && anyChat && anyChat.subs){
    const mm = String(anyChat.subs).match(/(\d+(?:[.,]\d+)?)\s*к/i);
    if(mm) followers = Math.round(parseFloat(mm[1].replace(',', '.')) * 1000);
  }
  if(!followers) followers = 300 + h % 4200;

  return {
    name, posts, sub,
    nick: (chat && chat.nick) ? chat.nick : psNick(name),
    online: chat ? !!chat.online : (h % 3 === 0),
    followers,
    followingN: 12 + h % 480,
    ava: (p0 && p0.ava) || (anyChat && anyChat.ava) || psInitials(name),
    avaIcon: (!(p0 && p0.ava) && anyChat && anyChat.avaIcon) ? anyChat.avaIcon : null,
    topic: (posts.map(p => p.topic).find(Boolean)) || null,
  };
}

/* ---------- обложка: детерминированный вариант композиции ---------- */
function psCoverClass(name){ return 'v' + (psHash('cov:' + name) % 5); } /* v0..v4 (v0 = базовый) */

/* ---------- ачивки автора (детерминированно из модели) ---------- */
function psAchievements(a){
  const h = psHash('ach:' + a.name);
  const out = [];
  const verified = (typeof VERIFIED !== 'undefined' && VERIFIED.has(a.name));
  const team = /OKO|Клуб OKO|Поддержка|Партнёрам|Биржа/.test(a.name);
  if(team) out.push({ic:'crown', label:'Команда OKO', gold:true});
  if(verified) out.push({ic:'verified', label:'Проверенный'});
  /* аудитория */
  if(a.followers >= 20000) out.push({ic:'fire', label:'Топ-аудитория', gold:true});
  else if(a.followers >= 5000) out.push({ic:'users', label:'Растущий канал'});
  /* активность */
  if(a.posts.length >= 6) out.push({ic:'bolt', label:'Активный автор'});
  else if(a.posts.length >= 2) out.push({ic:'edit', label:'Автор OKO'});
  /* тематика */
  const topicBadge = {
    ai:      {ic:'rocket',    label:'ИИ-эксперт'},
    content: {ic:'circle-play',label:'Контент-мейкер'},
    business:{ic:'briefcase', label:'Предприниматель'},
    marketing:{ic:'megaphone',label:'Маркетолог'},
    games:   {ic:'rocket',    label:'Геймдев'},
    crypto:  {ic:'money',     label:'Крипто-аналитик'},
  }[a.topic];
  if(topicBadge) out.push(topicBadge);
  /* добор до минимум 3 из стабильного пула (детерминированно по хэшу, без повторов) */
  const pool = [
    {ic:'star',  label:'Ветеран OKO'},
    {ic:'flag',  label:'Ранний участник'},
    {ic:'heart', label:'Любимец подписчиков'},
    {ic:'thumb', label:'Проверено делом'},
    {ic:'clock', label:'Всегда на связи'},
    {ic:'rocket',label:'Быстрый рост'},
  ];
  const start = h % pool.length;
  for(let i = 0; out.length < 3 && i < pool.length; i++) out.push(pool[(start + i) % pool.length]);
  /* dedupe по label, максимум 4 — чтобы лента не обрезалась даже на десктопе (640px) */
  const seen = new Set();
  return out.filter(b => !seen.has(b.label) && seen.add(b.label)).slice(0, 4);
}
function psAchHtml(a){
  const list = psAchievements(a);
  if(!list.length) return '';
  return `<div class="ps-ach">` + list.map((b, i) =>
    `<span class="ps-badge${b.gold ? ' gold' : ''}" style="animation-delay:${40 + i * 55}ms">
       <span class="ps-bi">${I(b.ic)}</span>${esc(b.label)}
     </span>`).join('') + `</div>`;
}

/* ================= СОЦ-ДОКАЗАТЕЛЬСТВО: «Читают …» (Instagram-style) ================= */
/* «Читают Марк, Алина и ещё N» — 2 знакомых человека из пула + остаток.
   Тап ведёт в соцграф подписчиков. Показывается только если есть кого показать. */
function psSocialProofHtml(a){
  let pool = [];
  try{ pool = psPeoplePool().filter(p => p.name !== a.name); }catch(e){}
  if(!pool.length) return '';
  const salt = psHash('proof:' + a.name);
  const ranked = pool.map(p => ({p, w: psHash(p.name + '~' + salt)})).sort((x, y) => x.w - y.w).map(x => x.p);
  const show = ranked.slice(0, Math.min(3, ranked.length));
  const rest = Math.max(0, a.followers - show.length);
  const avas = show.map((p, i) =>
    `<span class="ps-sp-ava" style="z-index:${show.length - i}">${p.avaIcon ? I(p.avaIcon) : esc(p.ava || psInitials(p.name))}</span>`).join('');
  const names = show.slice(0, 2).map(p => `<b>${esc(p.name)}</b>`).join(', ');
  const tail = rest > 0 ? ` и ещё ${psFmt(rest)}` : '';
  return `<button class="ps-social-proof" onclick="psOpenGraph('followers')" aria-label="Показать подписчиков">
    <span class="ps-sp-avas">${avas}</span>
    <span class="ps-sp-txt">Читают ${names}${tail}</span>
  </button>`;
}

/* ================= «АКТУАЛЬНОЕ»: сторис-кружки ================= */
function psHighlights(a){
  const out = [];
  const seen = new Set();
  const add = (label) => { if(label && PS_HL[label] && !seen.has(label)){ seen.add(label); out.push(label); } };
  const team = /OKO|Клуб|Поддержка|Партнёрам|Биржа/.test(a.name);
  if(team){ add('Анонсы'); add('Фичи'); add('Ответы'); }
  const topicHl = {ai:'Нейросети', content:'Монтаж', business:'Рост', marketing:'Рост', games:'Процесс', crypto:'Рост'}[a.topic];
  add(topicHl);
  /* добор из общего пула детерминированно */
  const pool = ['Кейсы', 'Отзывы', 'Услуги', 'Гайды', 'Лучшее', 'Процесс'];
  const start = psHash('hl:' + a.name) % pool.length;
  for(let i = 0; out.length < 5 && i < pool.length; i++) add(pool[(start + i) % pool.length]);
  return out.slice(0, 6);
}
function psHlHtml(a){
  const list = psHighlights(a);
  if(!list.length) return '';
  return `<div class="ps-hls" role="list">` + list.map((label, i) => {
    const h = PS_HL[label];
    return `<button class="ps-hl" role="listitem" style="animation-delay:${60 + i * 45}ms"
        onclick="psOpenHighlight('${psAttr(label)}')" aria-label="Актуальное: ${psAttr(label)}">
      <span class="ps-hl-ring"><span class="ps-hl-in">${I(h.ic)}</span></span>
      <span class="ps-hl-lb">${esc(label)}</span>
    </button>`;
  }).join('') + `</div>`;
}
function psOpenHighlight(label){
  const h = PS_HL[label];
  if(!h || typeof showPopup !== 'function') return;
  const name = PS.cur || '';
  const g = 'g' + (psHash('hl:' + label + name) % 6);
  showPopup({
    title: label,
    body: `<div class="ps-story ${g}">
        <span class="ps-story-ic">${I(h.ic)}</span>
        <span class="ps-story-tag">Актуальное</span>
      </div>
      <p class="ps-story-txt">${esc(h.txt)}</p>`,
    actions: [{label:'Понятно'}]
  });
}

/* ================= МЕДИА-СЕТКА (Instagram grid) ================= */
/* детерминированный список плиток: реальные посты автора + «портфолио»-добор */
function psMediaList(a){
  const tiles = [];
  a.posts.forEach(p => {
    tiles.push({
      real: true, id: p.id,
      ic: p.media ? 'circle-play' : 'txt',
      dur: (p.media && /:/.test(String(p.media))) ? p.media : null,
      views: p.views || 0, likes: p.likes || 0,
      title: (String(p.body || '').split(/[.!?\n]/)[0] || 'Пост').slice(0, 48),
      txt: String(p.body || ''),
      g: 'g' + (psHash('mt:' + p.id) % 6)
    });
  });
  const base = psHash('media:' + a.name);
  for(let i = 0; tiles.length < 6 && i < PS_PORTFOLIO.length; i++){
    const pt = PS_PORTFOLIO[(base + i) % PS_PORTFOLIO.length];
    if(tiles.some(t => t.title === pt.title)) continue;
    tiles.push({
      real: false, ic: pt.ic, title: pt.title, txt: pt.txt, dur: null,
      views: 800 + psHash(a.name + pt.title) % 42000,
      likes: 30 + psHash(pt.title + a.name) % 1900,
      g: 'g' + ((base + i) % 6)
    });
  }
  return tiles.slice(0, 9);
}
function psMediaHtml(a){
  const list = psMediaList(a);
  if(!list.length) return `<div class="ps-empty">${I('grid')}<p>Медиа пока нет</p><span>Кейсы, ролики и работы автора появятся здесь</span></div>`;
  const nf = v => (typeof fmtN === 'function' ? fmtN(v) : v);
  return `<div class="ps-grid">` + list.map((t, i) => `
    <button class="ps-mtile ${t.g} fade-in" style="animation-delay:${i * 35}ms" onclick="psOpenMedia(${i})" aria-label="${psAttr(t.title)}">
      <span class="ps-mt-ic">${I(t.ic)}</span>
      ${t.dur ? `<span class="ps-mt-dur">${I('circle-play')}${esc(t.dur)}</span>` : ''}
      <span class="ps-mt-stat">${I('eye')}${nf(t.views)}</span>
    </button>`).join('') + `</div>`;
}
function psOpenMedia(i){
  if(!PS.cur || typeof showPopup !== 'function') return;
  const a = psAuthor(PS.cur);
  const t = psMediaList(a)[i];
  if(!t) return;
  const nf = v => (typeof fmtN === 'function' ? fmtN(v) : v);
  const actions = [];
  if(t.real) actions.push({label:'Открыть в постах', onclick: () => {
    psTab('posts');
    try{ const el = document.getElementById('psPosts'); if(el && el.scrollIntoView) el.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){}
  }});
  actions.push({label:'Закрыть', ghost:true});
  showPopup({
    title: t.title,
    body: `<div class="ps-story ${t.g}">
        <span class="ps-story-ic">${I(t.ic)}</span>
        <span class="ps-lb-meta"><span>${I('eye')}${nf(t.views)}</span><span>${I('heart')}${nf(t.likes)}</span></span>
      </div>
      <p class="ps-story-txt">${esc(t.txt)}</p>`,
    actions
  });
}

/* ================= ВКЛАДКИ: Посты / Медиа ================= */
function psTabHtml(a, tab){
  if(tab === 'media') return psMediaHtml(a);
  return `<div id="psPosts">${psPostsHtml(a)}</div>`;
}
function psTab(tab){
  tab = (tab === 'media') ? 'media' : 'posts';
  PS.tab = tab;
  if(!PS.cur) return;
  const a = psAuthor(PS.cur);
  const body = document.getElementById('psTabBody');
  if(body) body.innerHTML = psTabHtml(a, tab);
  const tabs = document.getElementById('psTabs');
  if(tabs) tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.pt === tab));
}

/* ---------- count-up статистики при открытии профиля ---------- */
function psAnimateStats(){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  document.querySelectorAll('#psBody .ps-stat b[data-to]').forEach(el => {
    const to = +el.getAttribute('data-to'); if(!isFinite(to)) return;
    if(reduce || to <= 0){ el.textContent = psFmt(to); return; }
    const dur = 650, t0 = performance.now();
    (function step(now){
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3); /* easeOutCubic */
      el.textContent = psFmt(to * e);
      if(k < 1) requestAnimationFrame(step); else el.textContent = psFmt(to);
    })(t0);
  });
}

/* ---------- рендер профиля ---------- */
function psPostsHtml(a){
  if(!a.posts.length) return `<div class="ps-empty">${I('feed')}<p>Здесь скоро будут посты</p><span>Подпишись — и не пропустишь первую публикацию автора</span></div>`;
  return a.posts.map(p => `
    <article class="ps-post fade-in">
      <div class="ps-post-time">${psAgo(p)}${p.promoted ? ' · реклама' : ''}</div>
      <div class="ps-post-body">${p.body}</div>
      ${p.media ? `<div class="ps-post-media">${I('circle-play')}<span>${p.media}</span></div>` : ''}
      <div class="ps-post-meta">
        <button class="ps-like ${p.liked ? 'on' : ''}" onclick="psLike(${p.id})">${I('heart')}<span>${p.likes}</span></button>
        <span>${I('comment')}${p.comments ? p.comments.length : 0}</span>
        <span>${I('share')}${p.reposts || 0}</span>
        <span class="ps-views">${I('eye')}${typeof fmtN === 'function' ? fmtN(p.views || 0) : (p.views || 0)}</span>
      </div>
    </article>`).join('');
}
function psRender(name){
  const a = psAuthor(name);
  const f = psIsFollowing(name);
  PS.tab = 'posts';
  const head = document.getElementById('psHeadName');
  if(head) head.textContent = '@' + a.nick;
  const body = document.getElementById('psBody');
  if(!body) return;
  body.innerHTML = `
    <div class="ps-cover ${psCoverClass(a.name)} fade-in">
      <div class="ps-cover-grid"></div>
      <div class="ps-cover-mark">${I('logo')}</div>
    </div>
    <div class="ps-top fade-in">
      <div class="ps-ava-wrap">
        <div class="ps-ava">${a.avaIcon ? I(a.avaIcon) : esc(a.ava)}</div>
        ${a.online ? '<span class="ps-ava-on" title="в сети"></span>' : ''}
      </div>
      <h3 class="ps-name">${esc(a.name)}${typeof vBadge === 'function' ? vBadge(a.name) : ''}</h3>
      <div class="ps-nick">@${esc(a.nick)}${a.online ? '<span class="ps-dot">·</span><span class="ps-on">в сети</span>' : ''}</div>
      <p class="ps-bio">${esc(psBio(a.name, a.topic, a.sub))}</p>
      ${psAchHtml(a)}
      ${psSocialProofHtml(a)}
      <div class="ps-stats">
        <div class="ps-stat"><b data-to="${a.posts.length}">${a.posts.length}</b><small>постов</small></div>
        <button class="ps-stat ps-stat-btn" onclick="psOpenGraph('followers')" aria-label="Показать подписчиков"><b id="psFollowers" data-to="${a.followers + (f ? 1 : 0)}">${psFmt(a.followers + (f ? 1 : 0))}</b><small>подписчиков</small></button>
        <button class="ps-stat ps-stat-btn" onclick="psOpenGraph('following')" aria-label="Показать подписки"><b data-to="${a.followingN}">${psFmt(a.followingN)}</b><small>подписок</small></button>
      </div>
      <div class="ps-actions">
        <button class="btn ${f ? 'ghost' : ''}" id="psFollowBtn" onclick="psToggleFollow()">${I(f ? 'check' : 'plus')} ${f ? 'Отписаться' : 'Подписаться'}</button>
        <button class="btn ghost" onclick="psMessage()">${I('chat')} Написать</button>
        <button class="btn ghost ps-share-btn" onclick="psShare()" aria-label="Поделиться профилем" title="Поделиться">${I('share')}</button>
      </div>
    </div>
    ${psHlHtml(a)}
    <div class="ps-tabs" id="psTabs" role="tablist">
      <button class="on" data-pt="posts" role="tab" aria-selected="true" onclick="psTab('posts')">${I('feed')}<span>Посты</span><small class="ps-tab-cnt">${a.posts.length}</small></button>
      <button data-pt="media" role="tab" aria-selected="false" onclick="psTab('media')">${I('grid')}<span>Медиа</span></button>
    </div>
    <div id="psTabBody">${psTabHtml(a, 'posts')}</div>`;
}

/* ---------- открыть/закрыть вьюху ---------- */
function psOpenProfile(name){
  if(!name) return;
  if(typeof PROFILE !== 'undefined' && name === PROFILE.name){ /* свой профиль — родная вкладка */
    if(typeof showTab === 'function') showTab('profile');
    return;
  }
  PS.cur = name;
  psRender(name);
  try{ psAnimateStats(); }catch(e){}
  const v = document.getElementById('psView');
  if(v && !v.classList.contains('open')){
    v.classList.add('open');
    if(typeof nvPush === 'function') nvPush('view:psProfile', psClose);
  }
}
function psClose(){
  const v = document.getElementById('psView');
  if(v) v.classList.remove('open');
  PS.cur = null;
  if(typeof nvPop === 'function') nvPop('view:psProfile');
}

/* ---------- подписка / отписка ---------- */
function psGoSubFeed(){
  psClose();
  if(typeof showTab === 'function') showTab('feed');
  const btn = document.querySelector('.feed-tabs button');
  if(btn && typeof feedTab === 'function') feedTab(btn, 'sub');
  else if(typeof renderFeed === 'function') renderFeed('sub');
}
/* переключить подписку на произвольное имя (без привязки к открытому профилю) */
function psSetFollow(name, want){
  if(!name) return false;
  const f = (typeof want === 'boolean') ? want : !psIsFollowing(name);
  if(f) PS.follow[name] = Date.now(); else delete PS.follow[name];
  psSaveState();
  if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined' && curFeedKind === 'sub'){
    try{ renderFeed('sub'); }catch(e){}
  }
  return f;
}
function psToggleFollow(){
  const name = PS.cur;
  if(!name) return;
  const f = !psIsFollowing(name);
  if(f) PS.follow[name] = Date.now(); else delete PS.follow[name];
  psSaveState();

  /* счётчик подписчиков — с бампом */
  const a = psAuthor(name);
  const el = document.getElementById('psFollowers');
  if(el){
    el.textContent = psFmt(a.followers + (f ? 1 : 0));
    el.classList.remove('ps-bump'); void el.offsetWidth; el.classList.add('ps-bump');
  }
  const btn = document.getElementById('psFollowBtn');
  if(btn){
    btn.classList.toggle('ghost', f);
    btn.innerHTML = I(f ? 'check' : 'plus') + ' ' + (f ? 'Отписаться' : 'Подписаться');
  }
  /* лента «Подписки» пересортировывается сразу, если открыта */
  if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined' && curFeedKind === 'sub'){
    try{ renderFeed('sub'); }catch(e){}
  }
  if(f && typeof showPopup === 'function'){
    showPopup({ico:'users', title:'Подписка оформлена',
      body:`Готово. Лучшие посты <b>${esc(name)}</b> теперь поднимаются выше в ленте «Подписки» — ничего важного не пропустишь.`,
      actions:[{label:'В ленту', onclick: psGoSubFeed}, {label:'Понятно', ghost:true}]});
  } else if(!f && typeof toast === 'function'){
    toast('Ты отписался от ' + name);
  }
}

/* ---------- «Написать»: найти/создать личный чат + openConv ---------- */
function psMessage(){
  const name = PS.cur;
  if(!name || typeof CHATS === 'undefined') return;
  if(typeof st2IsBlocked === 'function' && st2IsBlocked(name)){
    if(typeof toast === 'function') toast('Разблокируйте пользователя, чтобы написать');
    return;
  }
  const a = psAuthor(name);
  let c = CHATS.find(x => x.kind === 'direct' && x.name === name);
  if(!c){
    c = {id: Date.now(), name, kind:'direct', nick: a.nick, kindIcon: null,
      preview:'Чат создан', time:(typeof nowT === 'function' ? nowT() : ''), unread:0, online: !!a.online,
      msgs:[{kind:'sys', body:'Личный чат с ' + name + ' создан'}]};
    if(a.avaIcon) c.avaIcon = a.avaIcon; else c.ava = a.ava;
    CHATS.unshift(c);
  }
  psClose();
  if(typeof showTab === 'function') showTab('chats');
  try{
    if(typeof renderChatList === 'function'){
      const s = document.getElementById('chatSearch');
      renderChatList(s ? s.value : '');
    }
  }catch(e){}
  if(typeof openConv === 'function') openConv(c.id);
}

/* ---------- лайк из профиля (через ядро — сигналы feed-algo сохраняются) ---------- */
function psLike(id){
  if(typeof likePost === 'function') likePost(id);
  const wrap = document.getElementById('psPosts');
  if(wrap && PS.cur) wrap.innerHTML = psPostsHtml(psAuthor(PS.cur));
}

/* ---------- «Поделиться» профилем: ссылка + копирование ---------- */
function psProfileLink(name){
  const a = psAuthor(name);
  return 'https://okoteam.top/@' + a.nick;
}
function psCopy(text){
  try{ if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text); return true; } }catch(e){}
  try{
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    return true;
  }catch(e){ return false; }
}
function psShare(){
  const name = PS.cur;
  if(!name) return;
  const link = psProfileLink(name);
  const doCopy = () => { const ok = psCopy(link); if(typeof toast === 'function') toast(ok ? 'Ссылка скопирована' : 'Не удалось скопировать'); };
  /* нативный шэринг телефона, если доступен */
  if(navigator.share){
    navigator.share({title: name + ' в OKO', text: 'Профиль ' + name + ' в OKO', url: link}).catch(()=>{});
    return;
  }
  if(typeof showPopup === 'function'){
    showPopup({ico:'share', title:'Поделиться профилем',
      body:`Профиль <b>${esc(name)}</b> в OKO.<div class="ps-sharelink">${I('globe')}<span>${esc(link)}</span></div>`,
      actions:[{label:'Скопировать ссылку', onclick: doCopy}, {label:'Закрыть', ghost:true}]});
  } else { doCopy(); }
}

/* ---------- меню профиля: поделиться / блокировка / жалоба ---------- */
function psRefreshFollowBtn(){
  const name = PS.cur;
  if(!name) return;
  const f = psIsFollowing(name);
  const btn = document.getElementById('psFollowBtn');
  if(btn){ btn.classList.toggle('ghost', f); btn.innerHTML = I(f ? 'check' : 'plus') + ' ' + (f ? 'Отписаться' : 'Подписаться'); }
}
function psBlock(name){
  if(typeof st2Block !== 'function'){ if(typeof toast === 'function') toast('Блокировки недоступны'); return; }
  st2Block(name);                 /* сам снимает подписку + чистит ленту + персист */
  psRefreshFollowBtn();
  if(typeof toast === 'function') toast('Вы заблокировали ' + name);
}
function psUnblock(name){
  if(typeof st2Unblock === 'function'){ st2Unblock(name); if(typeof toast === 'function') toast('Вы разблокировали ' + name); }
}
function psReport(name){ if(typeof toast === 'function') toast('Жалоба на ' + name + ' отправлена на модерацию'); }
function psMore(){
  const name = PS.cur;
  if(!name) return;
  const blocked = (typeof st2IsBlocked === 'function') && st2IsBlocked(name);
  const actions = [{label:'Поделиться профилем', onclick: psShare}];
  if(blocked) actions.push({label:'Разблокировать', onclick: () => psUnblock(name)});
  else        actions.push({label:'Заблокировать', onclick: () => psBlock(name)});
  actions.push({label:'Пожаловаться', ghost:true, onclick: () => psReport(name)});
  if(typeof showPopup === 'function') showPopup({ico:'more', title: name, body:'Действия с профилем', actions});
  const ok = document.querySelector('#okoPopup [data-pa="1"]');
  if(ok && !blocked) ok.classList.add('ps-btn-danger');
}

/* ================= СОЦГРАФ: подписчики / подписки ================= */
/* пул реальных людей приложения (чаты + авторы ленты + известные каналы) */
function psPeoplePool(){
  const seen = new Set(); const out = [];
  const push = (name, ava, avaIcon, nick, online) => {
    if(!name || seen.has(name)) return; seen.add(name);
    if(typeof PROFILE !== 'undefined' && name === PROFILE.name) return;
    out.push({name, ava: ava || psInitials(name), avaIcon: avaIcon || null,
      nick: nick || psNick(name), online: !!online});
  };
  try{
    if(typeof CHATS !== 'undefined') CHATS.forEach(c => {
      if(c.kind === 'direct' && c.id !== 'live') push(c.name, c.ava, c.avaIcon, c.nick, c.online);
    });
  }catch(e){}
  try{
    [...POSTS.sub, ...POSTS.rec].forEach(p => { if(p.name) push(p.name, p.ava, null, null, false); });
  }catch(e){}
  try{ Object.keys(PS_BIOS).forEach(n => push(n)); }catch(e){}
  return out;
}
/* детерминированный подсписок людей для (автор, вкладка) */
function psGraphPeople(name, tab){
  const pool = psPeoplePool().filter(p => p.name !== name);
  if(!pool.length) return [];
  const salt = psHash(name + ':' + tab);
  /* сортировка по «весу» — псевдослучайно, но стабильно */
  const ranked = pool.map(p => ({p, w: psHash(p.name + '#' + salt)}))
    .sort((x, y) => x.w - y.w).map(x => x.p);
  /* сколько показать: от stat, но не больше пула */
  const a = psAuthor(name);
  const want = tab === 'followers' ? a.followers : a.followingN;
  const n = Math.max(3, Math.min(ranked.length, 6 + (salt % 7)));
  const list = ranked.slice(0, n);
  /* если это подписчики автора, на которого подписан ТЫ — добавить себя первым */
  if(tab === 'followers' && psIsFollowing(name) && typeof PROFILE !== 'undefined'){
    list.unshift({name: PROFILE.name, ava: (PROFILE.name[0]||'O').toUpperCase(), avaIcon: null,
      nick: PROFILE.nick, online: true, isMe: true});
  }
  return {list, total: want};
}
function psPersonRowHtml(p){
  const f = psIsFollowing(p.name);
  const me = !!p.isMe;
  return `<div class="ps-person${me ? ' me' : ''}" ${me ? '' : `onclick="psGraphOpenPerson('${psAttr(p.name)}')"`}>
    <div class="ps-person-ava">${p.avaIcon ? I(p.avaIcon) : esc(p.ava)}${p.online ? '<span class="ps-person-on"></span>' : ''}</div>
    <div class="ps-person-b">
      <span class="ps-person-n"><span class="ps-person-nm">${esc(p.name)}</span>${me ? '<span class="ps-you">это ты</span>' : (typeof vBadge === 'function' ? vBadge(p.name) : '')}</span>
      <small>@${esc(p.nick)}</small>
    </div>
    ${me ? '' : `<button class="ps-follow-mini${f ? ' on' : ''}" onclick="event.stopPropagation();psFollowMini(this,'${psAttr(p.name)}')">${I(f ? 'check' : 'plus')}<span>${f ? 'Вы подписаны' : 'Подписаться'}</span></button>`}
  </div>`;
}
function psFollowMini(btn, name){
  const f = psSetFollow(name);
  if(btn){
    btn.classList.toggle('on', f);
    btn.innerHTML = I(f ? 'check' : 'plus') + '<span>' + (f ? 'Вы подписаны' : 'Подписаться') + '</span>';
    btn.classList.remove('ps-bump'); void btn.offsetWidth; btn.classList.add('ps-bump');
  }
}
function psGraphRender(){
  const name = PS.graphName, tab = PS.graphTab || 'followers';
  const wrap = document.getElementById('psGraphList');
  const th = document.getElementById('psGraphTabs');
  if(th) th.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.gt === tab));
  if(!wrap) return;
  const res = psGraphPeople(name, tab);
  const list = res.list || [];
  const total = res.total || list.length;
  if(!list.length){ wrap.innerHTML = `<div class="ps-empty">${I('users')}<p>Пока никого</p><span>Первые подписки появятся здесь — начни собирать своё комьюнити</span></div>`; return; }
  wrap.innerHTML = `<div class="ps-graph-note">Показаны ${list.length} из ${psFmt(total)}</div>` +
    list.map((p, i) => `<div class="fade-in" style="animation-delay:${i * 30}ms">${psPersonRowHtml(p)}</div>`).join('');
}
function psGraphTab(tab){ PS.graphTab = tab; psGraphRender(); }
function psOpenGraph(tab){
  if(!PS.cur) return;
  PS.graphName = PS.cur; PS.graphTab = tab || 'followers';
  const head = document.getElementById('psGraphName');
  if(head) head.textContent = PS.graphName;
  const th = document.getElementById('psGraphTabs');
  if(th) th.style.display = '';
  psGraphRender();
  /* сет-лист открыт поверх fullscreen-профиля → поднять бэкдроп над #psView */
  try{ document.body.classList.add('ps-over-view'); }catch(e){}
  if(typeof openSheet === 'function') openSheet('ps-graph');
}
function psGraphOpenPerson(name){
  if(typeof closeSheet === 'function') closeSheet();
  setTimeout(() => psOpenProfile(name), 60);
}

/* ================= НЕСКОЛЬКО АККАУНТОВ (Telegram/Instagram) =================
   ЕДИНЫЙ источник правды — settings-plus (ST2.accounts / st2SwitchAccount /
   st2AddAccount / st2RemoveAccount, персист в oko-settings2). Здесь — только
   быстрый переключатель в шапке своего профиля (settings-plus грузится ПОЗЖЕ
   нашего модуля, поэтому к его API обращаемся строго в рантайме, по клику). */
function psAccAvailable(){ return typeof ST2 !== 'undefined' && Array.isArray(ST2.accounts); }
function psAccList(){ return psAccAvailable() ? ST2.accounts : []; }
function psAccActiveId(){ return psAccAvailable() ? ST2.activeAcc : null; }
function psAccInit(name){
  return (typeof st2AccInit === 'function') ? st2AccInit(name) : psInitials(name);
}
function psAccHue(a){
  const key = (a && (a.nick || a.name)) || 'user';
  return (typeof st2Hue === 'function') ? st2Hue(key) : (psHash(key) % 360);
}
function psAccSwitch(id){
  if(id === psAccActiveId()){ if(typeof closeSheet === 'function') closeSheet(); return; }
  if(typeof closeSheet === 'function') closeSheet();
  if(typeof st2SwitchAccount === 'function') st2SwitchAccount(id); /* сам зовёт renderMyProfile + toast + persist */
  /* лента зависит от PROFILE.name («мои посты») — освежить, если открыта */
  try{ if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined') renderFeed(curFeedKind); }catch(e){}
}
function psAccAdd(){
  if(typeof closeSheet === 'function') closeSheet();
  if(typeof st2AddAccount === 'function') st2AddAccount();
  else if(typeof toast === 'function') toast('Управление аккаунтами — в настройках');
}
function psAccRemove(id){
  if(typeof closeSheet === 'function') closeSheet();
  if(typeof st2RemoveAccount === 'function') st2RemoveAccount(id);
}
function psAccAvaHtml(a){
  const h = psAccHue(a);
  if(a && a.avatar) return `<span class="ps-acc-ava has" style="background-image:url(${a.avatar})"></span>`;
  return `<span class="ps-acc-ava" style="--h:${h}">${esc(psAccInit(a.name))}</span>`;
}
function psAccRenderSheet(){
  const wrap = document.getElementById('psAccList');
  if(!wrap) return;
  const arr = psAccList();
  const activeId = psAccActiveId();
  if(!arr.length){ wrap.innerHTML = `<div class="ps-empty">${I('users')}<p>Пока некого показать</p><span>Загляни позже — подберём интересных авторов под тебя</span></div>`; return; }
  wrap.innerHTML = arr.map(a => {
    const active = a.id === activeId;
    const owner = a.role === 'owner';
    const tierChip = a.tier && a.tier !== 'FREE' ? `<span class="ps-acc-tier">${esc(a.tier)}</span>` : '';
    return `<div class="ps-acc-row${active ? ' active' : ''}" onclick="psAccSwitch('${a.id}')">
      ${psAccAvaHtml(a)}
      <div class="ps-acc-info">
        <span class="ps-acc-name">${esc(a.name)}${typeof vBadge === 'function' ? vBadge(a.name) : ''}${owner ? ` <span class="ps-acc-badge" title="владелец">${I('crown')}</span>` : ''}${tierChip}</span>
        <small>@${esc(a.nick)}</small>
      </div>
      ${active ? `<span class="ps-acc-check">${I('check2')}</span>`
               : (owner ? '' : `<button class="ps-acc-del" onclick="event.stopPropagation();psAccRemove('${a.id}')" aria-label="Убрать аккаунт">${I('trash')}</button>`)}
    </div>`;
  }).join('');
}
function psOpenAccounts(){
  if(!psAccAvailable()){ if(typeof toast === 'function') toast('Аккаунты недоступны'); return; }
  psAccRenderSheet();
  if(typeof openSheet === 'function') openSheet('ps-acc');
}
/* инъекция переключателя аккаунтов в шапку своего профиля */
function psInjectAccSwitch(){
  const top = document.querySelector('#screen-profile .profile-top');
  if(!top) return;
  top.classList.add('ps-acc-clickable');
  if(!top._psAccBound){
    top.addEventListener('click', function(e){
      if(e.target.closest && e.target.closest('.ps-acc-switch')){ psOpenAccounts(); return; }
      psOpenAccounts();
    });
    top._psAccBound = true;
  }
  if(!top.querySelector('.ps-acc-switch')){
    const btn = document.createElement('button');
    btn.className = 'ps-acc-switch';
    btn.setAttribute('aria-label', 'Сменить аккаунт');
    btn.innerHTML = I('chev');
    top.appendChild(btn);
  }
  /* count-бейдж, если аккаунтов > 1 */
  const badge = top.querySelector('.ps-acc-switch');
  if(badge){
    const n = psAccList().length;
    badge.classList.toggle('multi', n > 1);
  }
}
/* доступ к «Моим подпискам» (реальные подписки из PS.follow) на своём профиле */
function psMyFollows(){
  return Object.keys(PS.follow || {}).sort((a, b) => (PS.follow[b] || 0) - (PS.follow[a] || 0));
}
function psInjectMyFollows(){
  const stats = document.getElementById('profStats');
  if(!stats) return;
  let row = document.getElementById('psMyFollowsRow');
  const names = psMyFollows();
  if(!names.length){ if(row) row.remove(); return; }
  if(!row){
    row = document.createElement('button');
    row.id = 'psMyFollowsRow'; row.className = 'ps-myfollows';
    stats.insertAdjacentElement('afterend', row);
    row.addEventListener('click', psOpenMyFollows);
  }
  const avas = names.slice(0, 4).map(n => `<span class="ps-mf-ava">${esc(psInitials(n))}</span>`).join('');
  row.innerHTML = `<span class="ps-mf-avas">${avas}</span>
    <span class="ps-mf-txt"><b>${names.length}</b> ${names.length === 1 ? 'подписка' : (names.length < 5 ? 'подписки' : 'подписок')}</span>
    <span class="ps-mf-chev">${I('chev')}</span>`;
}
function psOpenMyFollows(){
  const names = psMyFollows();
  PS.graphName = (typeof PROFILE !== 'undefined') ? PROFILE.name : '';
  PS.graphTab = 'myfollows';
  const head = document.getElementById('psGraphName');
  if(head) head.textContent = 'Мои подписки';
  const th = document.getElementById('psGraphTabs');
  if(th) th.style.display = 'none';
  const wrap = document.getElementById('psGraphList');
  if(wrap){
    if(!names.length){ wrap.innerHTML = `<div class="ps-empty">${I('users')}<p>Твоя лента подписок пуста</p><span>Подпишись на авторов — их лучшие посты будут первыми у тебя</span></div>`; }
    else{
      const pool = psPeoplePool();
      const byName = {}; pool.forEach(p => byName[p.name] = p);
      wrap.innerHTML = names.map((n, i) => {
        const p = byName[n] || {name: n, ava: psInitials(n), nick: psNick(n), online: false};
        return `<div class="fade-in" style="animation-delay:${i * 30}ms">${psPersonRowHtml(p)}</div>`;
      }).join('');
    }
  }
  if(typeof openSheet === 'function') openSheet('ps-graph');
}

/* ================= ТОЧКА ВХОДА 1: лента (делегирование на #feedList) ================= */
function psFeedTap(e){
  const hit = e.target.closest && e.target.closest('#feedList .post .head .ava, #feedList .post .head .name, #feedList .post .head .sub');
  if(!hit) return;
  if(e.target.closest('.post-more') || e.target.closest('.chip')) return; /* меню и чипы — не трогаем */
  const art = hit.closest('article.post');
  const id = psPostIdOf(art);
  const p = (id != null && typeof postById === 'function') ? postById(id) : null;
  if(!p || !p.name) return;
  psOpenProfile(p.name);
}

/* ================= ТОЧКА ВХОДА 2: аватар в шапке конва (кроме своих/каналов) ================= */
function psConvAvaTap(e){
  const ava = e.target.closest && e.target.closest('#convAva');
  if(!ava) return;
  const c = (typeof currentChat !== 'undefined') && currentChat;
  if(!c || c.kind !== 'direct' || c.id === 'live') return;              /* каналы/группы/живой чат — прежнее поведение */
  if(typeof PROFILE !== 'undefined' && c.name === PROFILE.name) return; /* свой чат — прежнее поведение */
  e.stopPropagation(); e.preventDefault();
  psOpenProfile(c.name);
}

/* ================= ТОЧКА ВХОДА 3: глобальный поиск (chain renderSearch) ================= */
function psDecorateSearch(){
  const body = document.getElementById('searchBody');
  if(!body || typeof CHATS === 'undefined') return;
  const inp = document.getElementById('gSearchInput');
  const q = ((inp && inp.value) || '').trim().toLowerCase();
  if(!q) return;

  /* 1) «Люди»: тап ведёт в профиль (оттуда — «Написать» в чат) */
  body.querySelectorAll('.nt-item').forEach(btn => {
    const oc = btn.getAttribute('onclick') || '';
    if(oc.indexOf('openConv(') < 0 || oc.indexOf('openListing') > -1) return;
    const m = oc.match(/openConv\((?:'([^']+)'|(\d+))\)/);
    if(!m) return;
    const id = m[2] !== undefined ? +m[2] : m[1];
    const c = CHATS.find(x => x.id === id);
    if(!c || c.kind !== 'direct' || c.id === 'live') return;
    if(typeof PROFILE !== 'undefined' && c.name === PROFILE.name) return;
    btn.setAttribute('onclick', `closeSearch();psOpenProfile('${psAttr(c.name)}')`);
  });

  /* 2) секция «Авторы» — авторы постов ленты по запросу */
  try{
    const inChats = new Set(CHATS.filter(c => c.kind === 'direct').map(c => c.name));
    const seen = new Set(); const authors = [];
    [...POSTS.sub, ...POSTS.rec].forEach(p => {
      if(!p.name || seen.has(p.name)) return; seen.add(p.name);
      if(typeof PROFILE !== 'undefined' && p.name === PROFILE.name) return;
      if(inChats.has(p.name)) return; /* уже в секции «Люди» */
      if(p.name.toLowerCase().includes(q)) authors.push(p);
    });
    if(!authors.length) return;
    const html = `<p class="nt-group">Авторы</p>` + authors.slice(0, 5).map(p =>
      `<button class="nt-item" onclick="closeSearch();psOpenProfile('${psAttr(p.name)}')">
        <span class="nt-ic">${esc(p.ava || p.name[0])}</span>
        <div class="nt-b"><span><b>${esc(p.name)}</b>${typeof vBadge === 'function' ? vBadge(p.name) : ''}</span><small>${esc(p.sub || 'Автор в OKO · открыть профиль')}</small></div>
      </button>`).join('');
    const empty = body.querySelector('.empty-state');
    if(empty) body.innerHTML = html;
    else body.insertAdjacentHTML('beforeend', html);
  }catch(e){}
}

/* ================= ПОДПИСКИ ПОДНИМАЮТ ПОСТЫ: сортировка sub + буст rec ================= */
/* стабильная пересортировка POSTS.sub: подписки выше, исходный порядок помним в _psIdx */
function psSortSub(){
  if(typeof POSTS === 'undefined' || !Array.isArray(POSTS.sub)) return;
  let min = Infinity;
  POSTS.sub.forEach(p => { if(typeof p._psIdx === 'number' && p._psIdx < min) min = p._psIdx; });
  if(min === Infinity) min = 0;
  const fresh = POSTS.sub.filter(p => typeof p._psIdx !== 'number');
  fresh.forEach((p, i) => { p._psIdx = min - fresh.length + i; }); /* новые посты — сверху своей группы */
  POSTS.sub.sort((a, b) =>
    ((psIsFollowing(b.name) ? 1 : 0) - (psIsFollowing(a.name) ? 1 : 0)) || (a._psIdx - b._psIdx));
}
/* декор вкладки «Подписки»: verified-галочка + чип «Подписка» */
function psDecorateSub(){
  const list = document.getElementById('feedList');
  if(!list) return;
  list.querySelectorAll('article.post').forEach(art => {
    const id = psPostIdOf(art);
    const p = (id != null && typeof postById === 'function') ? postById(id) : null;
    if(!p) return;
    const nameEl = art.querySelector('.head .name');
    if(!nameEl) return;
    /* галочка verified — только если её ещё никто не поставил (verify-stickers/feed-algo) */
    if(typeof vBadge === 'function' && typeof VERIFIED !== 'undefined' && VERIFIED.has(p.name) &&
       !nameEl.querySelector('.ps-vb, .vs-badge, .fa-vb, use[href*="i-verified"]'))
      nameEl.insertAdjacentHTML('beforeend', `<span class="ps-vb">${vBadge(p.name)}</span>`);
    if(psIsFollowing(p.name) && !nameEl.querySelector('.ps-fchip'))
      nameEl.insertAdjacentHTML('beforeend', ` <span class="chip ps-fchip">${I('check')}Подписка</span>`);
  });
}

/* ================= САМОИНИЦИАЛИЗАЦИЯ И ПАТЧИ (chain) ================= */
(function psInit(){
  psLoadState();

  /* chain renderMyProfile: переключатель аккаунтов + «Мои подписки» + гейт админ-строки */
  if(typeof renderMyProfile === 'function'){
    const _psPrevRenderMyProfile = renderMyProfile;
    renderMyProfile = function(){
      _psPrevRenderMyProfile.apply(this, arguments);
      try{ psInjectAccSwitch(); }catch(e){}
      try{ psInjectMyFollows(); }catch(e){}
      /* админ-строка видна только владельцу активного аккаунта */
      const owner = (typeof isOwner === 'function') ? isOwner() : (PROFILE.role === 'owner');
      try{
        const adm = document.getElementById('prowAdmin');
        if(adm) adm.style.display = owner ? '' : 'none';
      }catch(e){}
      /* чип тарифа: у не-владельца показываем реальный tier аккаунта; владельцу —
         сохранённый «богатый» чип (с датой/покупкой) не трогаем без нужды */
      try{
        const tierEl = document.getElementById('profTier');
        if(tierEl){
          if(!owner){
            if(PS._tierOrig === undefined) PS._tierOrig = tierEl.textContent;
            tierEl.textContent = (PROFILE.tier && PROFILE.tier !== 'FREE') ? PROFILE.tier : 'FREE';
            PS._tierOv = true;
          } else if(PS._tierOv){
            tierEl.textContent = (PROFILE.tier && PROFILE.tier !== 'FREE')
              ? (PS._tierOrig || PROFILE.tier) : 'FREE';
            PS._tierOv = false;
          }
        }
      }catch(e){}
    };
  }

  /* chain closeSheet: снять подъём бэкдропа над профилем */
  if(typeof closeSheet === 'function'){
    const _psPrevCloseSheet = closeSheet;
    closeSheet = function(){
      _psPrevCloseSheet.apply(this, arguments);
      try{ document.body.classList.remove('ps-over-view'); }catch(e){}
    };
  }

  /* chain renderFeed: сортировка «Подписок» перед рендером ядра + декор после */
  if(typeof renderFeed === 'function'){
    const _psPrevRenderFeed = renderFeed;
    renderFeed = function(kind){
      kind = kind || (typeof curFeedKind !== 'undefined' ? curFeedKind : 'sub') || 'sub';
      if(kind === 'sub'){ try{ psSortSub(); }catch(e){} }
      _psPrevRenderFeed(kind);
      if(kind === 'sub'){ try{ psDecorateSub(); }catch(e){} }
    };
  }

  /* chain feedScore: подписки чуть выше и в рекомендациях */
  if(typeof feedScore === 'function'){
    const _psPrevFeedScore = feedScore;
    feedScore = function(p){
      let s = _psPrevFeedScore(p);
      if(p && p.name && psIsFollowing(p.name)) s += 180;
      return s;
    };
  }

  /* chain renderSearch: авторы в поиске */
  if(typeof renderSearch === 'function'){
    const _psPrevRenderSearch = renderSearch;
    renderSearch = function(){
      _psPrevRenderSearch();
      try{ psDecorateSearch(); }catch(e){}
    };
  }

  /* делегирование кликов: лента + аватар конва (capture — раньше onclick-атрибутов) */
  const fl = document.getElementById('feedList');
  if(fl && !fl._psTap){ fl.addEventListener('click', psFeedTap); fl._psTap = true; }
  document.addEventListener('click', psConvAvaTap, true);

  /* применить сортировку/декор к уже отрисованной ленте */
  try{
    if(typeof curFeedKind !== 'undefined' && curFeedKind === 'sub' && document.getElementById('feedList'))
      renderFeed('sub');
  }catch(e){}

  /* если профиль уже отрисован ядром до установки чейна — переинъекция */
  try{
    const sp = document.getElementById('screen-profile');
    if(sp && sp.classList.contains('active') && typeof renderMyProfile === 'function') renderMyProfile();
    else { psInjectAccSwitch(); psInjectMyFollows(); }
  }catch(e){}
})();
