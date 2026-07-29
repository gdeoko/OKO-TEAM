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
  'Поддержка OKO':    'Служба поддержки OKO. Отвечает на вопросы о приложении круглосуточно; сложные случаи передаёт менеджеру.',
  'Аня':              'Дизайнер обложек и визуала. Люблю чистую сетку, лайм и тёмные темы.',
  'Биржа OKO':        'Сервис безопасных сделок OKO: исполнители с рейтингом, оплата после приёмки.',
};
const PS_BIO_TOPIC = {
  ai:       'Пишу про инструменты OKO без магии: пайплайны, промпты и локальные модели в деле.',
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
    ai:      {ic:'rocket',    label:'Эксперт OKO'},
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

/* ============================================================================
   МОЙ ПРОФИЛЬ · «социальная витрина» (mp-): улучшения поверх renderMyProfile
   ---------------------------------------------------------------------------
   • Дефолт-обложка бренда OKO (градиент + логотип-водяной, full-bleed)
   • Быстрый статус («работаю» / «открыт(а) к сотрудничеству» / «в отпуске»)
     + мини-стикер на аватаре
   • Витрина результатов: 3 карточки (лучшие ролики / объявления / отзывы)
   • Sparkline роста подписчиков за 30 дней (SVG, детерминированно)
   • Стрик учёбы (если из academy доступен acStreak)
   Персист статуса — oko-mp; всё остальное считается из уже готовых источников.
   ============================================================================ */

const PS_MP = {
  status: null,              /* 'work' | 'open' | 'off' | null */
  loaded: false,
};
function mpLoad(){
  if(PS_MP.loaded) return;
  try{
    const s = JSON.parse(localStorage.getItem('oko-mp') || 'null');
    if(s && typeof s.status === 'string') PS_MP.status = s.status;
  }catch(e){}
  PS_MP.loaded = true;
}
function mpSave(){
  try{ localStorage.setItem('oko-mp', JSON.stringify({status: PS_MP.status, at: Date.now()})); }catch(e){}
}
const PS_MP_STATUSES = {
  work: {ic:'bolt',      lb:'Сейчас: работаю',            short:'Работаю',    tone:'ok'},
  open: {ic:'briefcase', lb:'Открыт к сотрудничеству',    short:'Открыт(а)',  tone:'accent'},
  off:  {ic:'moon',      lb:'В отпуске',                  short:'В отпуске',  tone:'muted'},
};

/* ---------- обложка ---------- */
function mpCoverHtml(){
  const name = (typeof PROFILE !== 'undefined' && PROFILE.name) ? PROFILE.name : 'OKO';
  const v = 'v' + (psHash('mycov:' + name) % 5);
  return `<div class="mp-cover ${v}">
    <div class="mp-cover-grid"></div>
    <div class="mp-cover-mark">${I('logo')}</div>
    <div class="mp-cover-brand">OKO</div>
  </div>`;
}

/* ---------- быстрый статус ---------- */
function mpStatusHtml(){
  const st = PS_MP.status && PS_MP_STATUSES[PS_MP.status];
  if(!st) return `<button class="mp-status ghost" onclick="mpPickStatus()" aria-label="Установить статус">${I('plus')}<span>Указать статус</span></button>`;
  return `<button class="mp-status mp-tone-${st.tone}" onclick="mpPickStatus()" aria-label="Изменить статус">
    <span class="mp-status-ic">${I(st.ic)}</span><span>${esc(st.lb)}</span>
  </button>`;
}
function mpStickerHtml(){
  const st = PS_MP.status && PS_MP_STATUSES[PS_MP.status];
  if(!st) return '';
  return `<span class="mp-sticker mp-tone-${st.tone}" title="${esc(st.lb)}">${I(st.ic)}</span>`;
}
function mpPickStatus(){
  if(typeof showPopup !== 'function') return;
  const opts = [
    {k:'work', ic:'bolt',      lb:'Работаю',                d:'Занят(а) заказами и проектами'},
    {k:'open', ic:'briefcase', lb:'Открыт к сотрудничеству', d:'Готов брать новые задачи'},
    {k:'off',  ic:'moon',      lb:'В отпуске',              d:'Отдых, откликаюсь медленнее'},
  ];
  const rows = opts.map(o =>
    `<button class="mp-pick-row${PS_MP.status === o.k ? ' on' : ''}" onclick="mpSetStatus('${o.k}')">
      <span class="mp-pick-ic">${I(o.ic)}</span>
      <span class="mp-pick-b"><b>${esc(o.lb)}</b><small>${esc(o.d)}</small></span>
      ${PS_MP.status === o.k ? `<span class="mp-pick-ok">${I('check')}</span>` : ''}
    </button>`).join('');
  const actions = [];
  if(PS_MP.status) actions.push({label:'Убрать статус', ghost:true, onclick: () => mpSetStatus(null)});
  actions.push({label:'Закрыть', ghost:true});
  showPopup({title:'Быстрый статус', body:`<div class="mp-pick">${rows}</div>`, actions});
}
function mpSetStatus(k){
  PS_MP.status = (k && PS_MP_STATUSES[k]) ? k : null;
  mpSave();
  if(typeof closePopup === 'function') closePopup();
  if(typeof renderMyProfile === 'function') renderMyProfile();
  if(typeof toast === 'function') toast(PS_MP.status ? 'Статус: ' + PS_MP_STATUSES[PS_MP.status].short : 'Статус скрыт');
}

/* ---------- витрина результатов (3 карточки) ---------- */
function mpMyPostsStat(){
  let cnt = 0, views = 0, likes = 0;
  try{
    if(typeof POSTS !== 'undefined' && typeof PROFILE !== 'undefined'){
      [...POSTS.sub, ...POSTS.rec].forEach(p => {
        if(p.name === PROFILE.name){ cnt++; views += (p.views || 0); likes += (p.likes || 0); }
      });
    }
  }catch(e){}
  return {cnt, views, likes};
}
function mpShowHtml(){
  const nf = v => (typeof fmtN === 'function' ? fmtN(v) : String(v));
  const my = mpMyPostsStat();
  const hasPosts = my.cnt > 0;
  const cards = [
    {
      k:'reels', ic:'circle-play', t:'Мои лучшие ролики',
      v: hasPosts ? nf(my.views) + ' просмотров' : 'Пока пусто',
      s: hasPosts ? my.cnt + ' ' + (my.cnt === 1 ? 'ролик' : (my.cnt < 5 ? 'ролика' : 'роликов')) : 'Опубликуй первый',
      onclick: `mpGo('feed')`
    },
    {
      k:'ads',   ic:'briefcase',   t:'Активные объявления',
      v: 'Витрина услуг',
      s: 'Разместить в бирже',
      onclick: `mpGo('market')`
    },
    {
      k:'rev',   ic:'star',        t:'Отзывы клиентов',
      v: hasPosts ? '5.0 · ' + Math.max(3, Math.min(24, my.cnt * 2)) : 'Собираем',
      s: hasPosts ? 'Средняя оценка' : 'Появятся после сделок',
      onclick: `mpGo('reviews')`
    },
  ];
  return `<div class="mp-show">` + cards.map((c, i) => `
    <button class="mp-card fade-in" style="animation-delay:${60 + i * 55}ms" onclick="${c.onclick}" aria-label="${esc(c.t)}">
      <span class="mp-card-ic">${I(c.ic)}</span>
      <span class="mp-card-b">
        <small>${esc(c.t)}</small>
        <b>${esc(c.v)}</b>
        <span class="mp-card-s">${esc(c.s)}</span>
      </span>
      <span class="mp-card-ch">${I('chev')}</span>
    </button>`).join('') + `</div>`;
}
function mpGo(k){
  if(k === 'feed' && typeof showTab === 'function'){ showTab('feed'); return; }
  if(k === 'market' && typeof openMa === 'function'){ openMa('market'); return; }
  if(typeof toast === 'function') toast('Раздел скоро появится');
}

/* ---------- sparkline: рост подписчиков за 30 дней ---------- */
function mpSparkPoints(name, endValue){
  const n = 30;
  const h = psHash('spark:' + name);
  const gain = 40 + (h % 160);                    /* +40..+199 за 30 дней */
  const start = Math.max(50, endValue - gain);
  const pts = [];
  for(let i = 0; i < n; i++){
    const t = i / (n - 1);
    /* монотонный рост с лёгким шумом (детерминированный) */
    const noise = ((psHash(name + '#' + i) % 100) / 100 - 0.5) * (gain * 0.10);
    let v = start + (endValue - start) * (t * t * (3 - 2 * t)) + noise;
    if(v < start) v = start;
    if(v > endValue + 5) v = endValue + 5;
    pts.push(v);
  }
  pts[n - 1] = endValue;
  return {pts, gain};
}
function mpSparkHtml(){
  const followers = 2400;                          /* соответствует «2.4к» в шапке */
  const {pts, gain} = mpSparkPoints((typeof PROFILE !== 'undefined' && PROFILE.name) || 'me', followers);
  const w = 300, h = 44, pad = 2;
  const min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
  const rng = Math.max(1, max - min);
  const x = i => pad + i * ((w - pad * 2) / (pts.length - 1));
  const y = v => pad + (h - pad * 2) * (1 - (v - min) / rng);
  const line = pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = `M${pad.toFixed(1)} ${(h - pad).toFixed(1)} ` +
    pts.map((v, i) => 'L' + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ') +
    ` L${(w - pad).toFixed(1)} ${(h - pad).toFixed(1)} Z`;
  const last = pts.length - 1;
  const dotX = x(last).toFixed(1), dotY = y(pts[last]).toFixed(1);
  const nf = v => (typeof fmtN === 'function' ? fmtN(v) : String(v));
  return `<div class="mp-spark fade-in" aria-label="Рост подписчиков за 30 дней">
    <div class="mp-spark-h">
      <span class="mp-spark-lb">Рост за 30 дней</span>
      <span class="mp-spark-v">+${nf(gain)}</span>
    </div>
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="mp-spark-svg">
      <defs>
        <linearGradient id="mpSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#9AFF00" stop-opacity=".38"/>
          <stop offset="100%" stop-color="#9AFF00" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#mpSparkFill)"/>
      <path d="${line}" fill="none" stroke="#9AFF00" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${dotX}" cy="${dotY}" r="3" fill="#9AFF00"/>
      <circle cx="${dotX}" cy="${dotY}" r="6" fill="#9AFF00" opacity=".22"/>
    </svg>
  </div>`;
}

/* ---------- стрик учёбы (если Академия подключена) ---------- */
function mpStreakDays(){
  try{ if(typeof acStreak === 'function'){ const st = acStreak(); return (st && +st.days) || 0; } }catch(e){}
  return 0;
}
function mpStreakHtml(){
  const d = mpStreakDays();
  if(!d) return '';
  const word = d === 1 ? 'день' : (d < 5 ? 'дня' : 'дней');
  const hot = d >= 3;
  return `<button class="mp-streak${hot ? ' hot' : ''} fade-in" onclick="mpGoAcademy()" aria-label="Стрик учёбы">
    <span class="mp-streak-ic">${I('fire')}</span>
    <span class="mp-streak-b">
      <b>${d} ${word} подряд в OKO</b>
      <small>${hot ? 'Ты в огне. Не сбавляй ритм.' : 'Начало учебной серии. Возвращайся каждый день.'}</small>
    </span>
    <span class="mp-streak-ch">${I('chev')}</span>
  </button>`;
}
function mpGoAcademy(){
  if(typeof showTab === 'function') showTab('academy');
  else if(typeof toast === 'function') toast('Академия');
}

/* ---------- инъекция ВСЕХ улучшений в свой профиль ---------- */
function mpInject(){
  mpLoad();
  const scr = document.getElementById('screen-profile');
  if(!scr) return;
  const pad = scr.querySelector('.pad');
  if(!pad) return;

  /* 1) обложка — самый первый ребёнок .pad */
  let cover = pad.querySelector('.mp-cover-wrap');
  if(!cover){
    cover = document.createElement('div');
    cover.className = 'mp-cover-wrap';
    pad.prepend(cover);
  }
  cover.innerHTML = mpCoverHtml();

  /* 2) стикер статуса на аватар */
  const ava = document.getElementById('profAva');
  if(ava){
    let sticker = ava.querySelector('.mp-sticker');
    if(sticker) sticker.remove();
    const html = mpStickerHtml();
    if(html) ava.insertAdjacentHTML('beforeend', html);
    ava.classList.add('mp-ava-plus');
  }

  /* 3) плашка статуса — под ником/тарифом */
  const top = pad.querySelector('.profile-top');
  if(top){
    let stRow = pad.querySelector('.mp-status-row');
    if(!stRow){
      stRow = document.createElement('div');
      stRow.className = 'mp-status-row';
      top.insertAdjacentElement('afterend', stRow);
    }
    stRow.innerHTML = mpStatusHtml();
  }

  /* 4) витрина результатов — после био */
  const bio = document.getElementById('profBio');
  if(bio){
    let show = pad.querySelector('.mp-show-wrap');
    if(!show){
      show = document.createElement('div');
      show.className = 'mp-show-wrap';
      bio.insertAdjacentElement('afterend', show);
    }
    show.innerHTML = mpShowHtml();
  }

  /* 5) sparkline — после статы */
  const stats = document.getElementById('profStats');
  if(stats){
    let spark = pad.querySelector('.mp-spark-wrap');
    if(!spark){
      spark = document.createElement('div');
      spark.className = 'mp-spark-wrap';
      stats.insertAdjacentElement('afterend', spark);
    }
    spark.innerHTML = mpSparkHtml();
  }

  /* 6) стрик учёбы — сразу после sparkline (если есть) */
  const sparkWrap = pad.querySelector('.mp-spark-wrap');
  if(sparkWrap){
    let streak = pad.querySelector('.mp-streak-wrap');
    const html = mpStreakHtml();
    if(!html){ if(streak) streak.remove(); return; }
    if(!streak){
      streak = document.createElement('div');
      streak.className = 'mp-streak-wrap';
      sparkWrap.insertAdjacentElement('afterend', streak);
    }
    streak.innerHTML = html;
  }
}

/* ============================================================================
   МОИ СОЦСЕТИ (ps-soc-): LinkedIn + Beacons.ai + Linktree в одном хабе
   ---------------------------------------------------------------------------
   Каталог платформ (IG/TT/VK/TG/YT/Threads/Rutube) с фирменными SVG. Демо-
   данные детерминированные (по хендлу + платформе): подписчики, sparkline за
   7 дней, ER, последние 5 постов, лучший пост месяца. Совокупный дашборд,
   тренды-подсказки, экспорт медиа-кита, публичная ссылка + QR, авто-постинг,
   ссылки-агрегатор. Персист — oko-ps-socials. Ничего внешнего, всё локально.
   ============================================================================ */

/* ---------- каталог платформ (id → бренд + inline SVG) ---------- */
const PS_SOC_PLATS = [
  {id:'ig', name:'Instagram', hint:'Instagram-профиль', ph:'@username',      handleFmt:'@',      base:'instagram.com/',
   svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="16" width="68" height="68" rx="18"/><circle cx="50" cy="50" r="16"/><circle cx="70" cy="30" r="4" fill="currentColor" stroke="none"/></svg>'},
  {id:'tt', name:'TikTok',   hint:'TikTok-аккаунт',    ph:'@username',      handleFmt:'@',      base:'tiktok.com/',
   svg:'<svg viewBox="0 0 100 100" fill="currentColor" stroke="none"><path d="M62 12h12c1 10 8 18 18 20v12c-8 0-15-2-22-6v28c0 15-12 26-27 26s-27-12-27-27 12-27 27-27c2 0 5 .3 7 1v14a13 13 0 1 0 8 12V12z"/></svg>'},
  {id:'vk', name:'VK',       hint:'ВКонтакте',         ph:'ссылка/vk id',   handleFmt:'',       base:'vk.com/',
   svg:'<svg viewBox="0 0 100 100" fill="currentColor" stroke="none"><path d="M14 26h20l10 32L58 26h20L60 62c6 4 12 10 18 24H58c-3-8-8-14-14-14v14H30C22 62 14 44 14 26z"/></svg>'},
  {id:'tg', name:'Telegram', hint:'Telegram-канал',    ph:'@username',      handleFmt:'@',      base:'t.me/',
   svg:'<svg viewBox="0 0 100 100" fill="currentColor" stroke="none"><path d="M85 18 12 46c-3 1-3 5 .3 6l20 6 8 24c1 3 4 3 6 1l12-12 20 15c3 2 6 1 7-3l12-58c1-4-3-8-7-6z"/><path d="M40 60 78 30 46 68" stroke="rgba(0,0,0,.28)" stroke-width="3" fill="none" stroke-linejoin="round"/></svg>'},
  {id:'yt', name:'YouTube',  hint:'YouTube-канал',     ph:'@username',      handleFmt:'@',      base:'youtube.com/',
   svg:'<svg viewBox="0 0 100 100" fill="currentColor" stroke="none"><rect x="10" y="22" width="80" height="56" rx="14"/><path d="M42 36l24 14-24 14z" fill="#fff"/></svg>'},
  {id:'th', name:'Threads',  hint:'Threads-профиль',   ph:'@username',      handleFmt:'@',      base:'threads.net/',
   svg:'<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"><path d="M64 46c-4-8-14-11-22-9-9 2-15 10-13 20 2 9 10 15 22 15 15 0 25-10 27-24 2-16-8-32-28-32-14 0-24 8-28 20"/></svg>'},
  {id:'ru', name:'Rutube',   hint:'Rutube-канал',      ph:'ссылка/ID',      handleFmt:'',       base:'rutube.ru/channel/',
   svg:'<svg viewBox="0 0 100 100" fill="currentColor" stroke="none"><rect x="10" y="22" width="80" height="56" rx="14"/><path d="M42 36l24 14-24 14z" fill="#fff"/><circle cx="76" cy="34" r="6" fill="#fff"/></svg>'},
];
const PS_SOC_MAP = Object.fromEntries(PS_SOC_PLATS.map(p => [p.id, p]));
function psSocIco(id){
  const p = PS_SOC_MAP[id]; if(!p) return '';
  return p.svg.replace('<svg ', '<svg class="i" preserveAspectRatio="xMidYMid meet" ');
}
function psSocPlatIcHtml(id, cls){
  return `<span class="ps-soc-plat-ic ps-soc-tone-${id} ${cls||''}">${psSocIco(id)}</span>`;
}

/* ---------- каталог иконок для ссылок Linktree (переиспользуем defs ядра) ---------- */
const PS_SOC_LINK_ICONS = [
  {v:'globe',      lb:'Сайт'},
  {v:'briefcase',  lb:'Портфолио'},
  {v:'megaphone',  lb:'Канал'},
  {v:'shop',       lb:'Магазин'}, /* fallback → briefcase */
  {v:'circle-play',lb:'Ролик'},
  {v:'file',       lb:'Документ'},
  {v:'chat',       lb:'Написать'},
  {v:'star',       lb:'Отзывы'},
  {v:'money',      lb:'Донат/оплата'},
];
function psSocSafeIco(v){
  /* fallback для ic, которых нет в базовых defs */
  const map = {shop:'briefcase'};
  return map[v] || v;
}

/* ---------- persist ---------- */
const PS_SOC_DEF_LINKS = [
  {id:'l1', ic:'globe',      t:'Мой сайт-визитка',    u:'okoteam.top/@ktodaniel'},
  {id:'l2', ic:'megaphone',  t:'Основной Telegram',   u:'t.me/okoappbot'},
  {id:'l3', ic:'briefcase',  t:'Кейсы и портфолио',   u:'okoteam.top/@ktodaniel/cases'},
];
const PS_SOC_DEF_SCHED = [
  {id:'s1', at:Date.now() + 3600e3 * 4,  txt:'Как я собрал контент-завод за 3 дня — короткий разбор', plats:['ig','tg','vk']},
  {id:'s2', at:Date.now() + 3600e3 * 22, txt:'Reels-приём «двойной хук»: удержание +18% на 30к охвате', plats:['ig','tt']},
];
const PS_SOC = {
  conn: {ig:true, tt:true, vk:true, tg:true, yt:false, th:false, ru:false},
  handles: {ig:'ktodaniel', tt:'ktodaniel', vk:'daniel.oko', tg:'ktodaniel', yt:'ktodaniel', th:'ktodaniel', ru:'ktodaniel'},
  slug: '',                       /* публичная ссылка okoteam.top/u/@slug — берём из PROFILE.nick */
  links: null,
  sched: null,
  loaded: false,
};
function psSocLoad(){
  if(PS_SOC.loaded) return;
  try{
    const s = JSON.parse(localStorage.getItem('oko-ps-socials') || 'null');
    if(s){
      if(s.conn) PS_SOC.conn = Object.assign({}, PS_SOC.conn, s.conn);
      if(s.handles) PS_SOC.handles = Object.assign({}, PS_SOC.handles, s.handles);
      if(typeof s.slug === 'string') PS_SOC.slug = s.slug;
      if(Array.isArray(s.links)) PS_SOC.links = s.links;
      if(Array.isArray(s.sched)) PS_SOC.sched = s.sched;
    }
  }catch(e){}
  if(!PS_SOC.links) PS_SOC.links = PS_SOC_DEF_LINKS.slice();
  if(!PS_SOC.sched) PS_SOC.sched = PS_SOC_DEF_SCHED.slice();
  PS_SOC.loaded = true;
}
function psSocSave(){
  try{ localStorage.setItem('oko-ps-socials', JSON.stringify({
    conn: PS_SOC.conn, handles: PS_SOC.handles, slug: PS_SOC.slug,
    links: PS_SOC.links, sched: PS_SOC.sched, at: Date.now()
  })); }catch(e){}
}
function psSocSlug(){
  return (PS_SOC.slug && PS_SOC.slug.trim()) ||
         (typeof PROFILE !== 'undefined' && PROFILE.nick) || 'me';
}
function psSocConnected(){ return PS_SOC_PLATS.filter(p => PS_SOC.conn[p.id]); }
function psSocFmt(n){ return typeof fmtN === 'function' ? fmtN(n) : psFmt(n); }

/* ---------- детерминированные демо-данные платформы ---------- */
function psSocFollowers(id){
  const seed = psHash('soc:f:' + id + ':' + (PS_SOC.handles[id] || ''));
  /* реалистичные диапазоны по платформам */
  const base = {ig:4800, tt:12400, vk:2100, tg:6300, yt:840, th:1200, ru:520}[id] || 1000;
  const jitter = seed % 2200;
  return base + jitter;
}
function psSocSpark7(id){
  /* 7 дней роста подписчиков — стабильно возрастающая с шумом */
  const end = psSocFollowers(id);
  const seed = psHash('soc:s7:' + id + ':' + (PS_SOC.handles[id] || ''));
  const growPct = 0.008 + (seed % 60) / 3200; /* 0.8%..2.7% в неделю */
  const start = Math.max(50, Math.round(end / (1 + growPct)));
  const out = [];
  for(let i = 0; i < 7; i++){
    const t = i / 6;
    const noise = ((psHash(id + '#d' + i) % 100) / 100 - 0.5) * ((end - start) * 0.22 + 4);
    const v = Math.max(0, Math.round(start + (end - start) * t + noise));
    out.push(v);
  }
  out[6] = end;
  return {pts: out, gain: end - start, growPct: ((end / start - 1) * 100)};
}
function psSocER(id){
  /* engagement rate — реалистично по платформам */
  const seed = psHash('soc:er:' + id + ':' + (PS_SOC.handles[id] || ''));
  const map = {ig:[4.2, 2.4], tt:[9.6, 4.8], vk:[2.9, 1.6], tg:[8.4, 3.2], yt:[6.1, 2.8], th:[5.4, 2.6], ru:[3.7, 1.9]};
  const [max, min] = map[id] || [4, 2];
  const t = (seed % 100) / 100;
  return +(min + t * (max - min)).toFixed(1);
}
function psSocRecentPosts(id){
  /* 5 последних постов: заголовок, охват, лайки, комменты, ER — стабильно */
  const seed = psHash('soc:p:' + id + ':' + (PS_SOC.handles[id] || ''));
  const followers = psSocFollowers(id);
  const platER = psSocER(id);
  const titles = [
    'Как удержание в первые 3 секунды меняет весь просмотр',
    'Разбор ролика на 42 тысячи охвата: 3 приёма',
    'Убрал одну сцену — досмотр вырос на 18%',
    'Один хук, три формата — тестируем на неделю',
    'Простое правило монтажа, которое повышает CTR',
    'Что делать, когда лента «встала» — короткий чек-лист',
    'Формат «до/после» на реальных цифрах кабинета',
    'Собрал 5.6к сохранений одной каруселью — почему',
    'Разбор комментария: как ответ разгоняет охват',
    'Продал курс через полезный ролик — механика',
  ];
  const kinds = ['circle-play','photo','file','circle-play','circle-play'];
  const now = Date.now();
  const out = [];
  for(let i = 0; i < 5; i++){
    const s = psHash(id + '@p' + i + ':' + seed);
    const reachFrac = 0.28 + ((s >> 3) % 100) / 130; /* 28%..104% от аудитории */
    const reach = Math.round(followers * reachFrac);
    const er = Math.max(0.6, platER * (0.55 + ((s >> 6) % 100) / 90));
    const likes = Math.round(reach * er / 100 * 0.72);
    const comments = Math.max(1, Math.round(reach * er / 100 * 0.11));
    const shares = Math.max(0, Math.round(reach * er / 100 * 0.17));
    out.push({
      i, id: id + '_p' + i,
      t: titles[(s >> 2) % titles.length],
      reach, likes, comments, shares,
      er: +er.toFixed(1),
      kind: kinds[i % kinds.length],
      dur: kinds[i % kinds.length] === 'circle-play' ? ('0:' + (12 + (s % 45)).toString().padStart(2, '0')) : null,
      ts: now - (i * 30 + (s % 20)) * 3600e3,
      g: 'g' + (i % 5)
    });
  }
  return out;
}
function psSocBestPost(id){
  const list = psSocRecentPosts(id);
  const best = list.slice().sort((a, b) => b.er * b.reach - a.er * a.reach)[0];
  return best;
}
function psSocPostAgo(ts){
  const h = Math.max(1, Math.round((Date.now() - ts) / 36e5));
  if(h < 24) return h + ' ч назад';
  const d = Math.round(h / 24);
  return d + ' ' + (d === 1 ? 'день' : (d < 5 ? 'дня' : 'дней')) + ' назад';
}

/* ---------- совокупный дашборд ---------- */
function psSocAggregate(){
  const conn = psSocConnected();
  if(!conn.length) return {n:0, followers:0, gain:0, erAvg:0, best:null, growPct:0};
  let followers = 0, gain = 0, erSum = 0, best = null;
  conn.forEach(p => {
    const f = psSocFollowers(p.id);
    const s = psSocSpark7(p.id);
    const er = psSocER(p.id);
    followers += f; gain += s.gain; erSum += er;
    if(!best || er > best.er) best = {id: p.id, name: p.name, er};
  });
  const growPct = followers ? (gain / Math.max(1, followers - gain)) * 100 : 0;
  return {n:conn.length, followers, gain, erAvg:+((erSum / conn.length)).toFixed(1), best, growPct:+growPct.toFixed(1)};
}

/* ---------- sparkline mini (для карточек платформ) ---------- */
function psSocSparkSvg(id, w, h){
  w = w || 100; h = h || 22;
  const {pts} = psSocSpark7(id);
  const min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
  const rng = Math.max(1, max - min);
  const pad = 1.5;
  const x = i => pad + i * ((w - pad * 2) / (pts.length - 1));
  const y = v => pad + (h - pad * 2) * (1 - (v - min) / rng);
  const line = pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = `M${pad} ${(h - pad).toFixed(1)} ` + pts.map((v, i) => 'L' + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ') + ` L${(w - pad).toFixed(1)} ${(h - pad).toFixed(1)} Z`;
  const gid = 'psSocGrad_' + id;
  return `<svg class="ps-soc-plat-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9AFF00" stop-opacity=".35"/><stop offset="100%" stop-color="#9AFF00" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${line}" fill="none" stroke="#9AFF00" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/* ---------- QR-код (детерминированный псевдо-QR: угловые маркеры + шумная сетка) ---------- */
function psSocQrSvg(text){
  const N = 25; /* сетка 25×25 */
  const cell = 100 / N;
  const h1 = psHash('qrA:' + text), h2 = psHash('qrB:' + text);
  const corners = [[0,0],[N-7,0],[0,N-7]]; /* три «глаза» */
  const isCorner = (x, y) => corners.some(([cx, cy]) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7);
  const isTiming = (x, y) => (x === 6 || y === 6);
  const cells = [];
  /* угловые маркеры (7×7 квадрат с внутренней рамкой 3×3) */
  corners.forEach(([cx, cy]) => {
    cells.push(`<rect x="${cx*cell}" y="${cy*cell}" width="${7*cell}" height="${7*cell}" fill="#000"/>`);
    cells.push(`<rect x="${(cx+1)*cell}" y="${(cy+1)*cell}" width="${5*cell}" height="${5*cell}" fill="#fff"/>`);
    cells.push(`<rect x="${(cx+2)*cell}" y="${(cy+2)*cell}" width="${3*cell}" height="${3*cell}" fill="#000"/>`);
  });
  /* тело — детерминированный шум по хендлу */
  for(let y = 0; y < N; y++){
    for(let x = 0; x < N; x++){
      if(isCorner(x, y)) continue;
      /* timing dots */
      if(y === 6 && x >= 8 && x < N - 8){ if(x % 2 === 0) cells.push(`<rect x="${x*cell}" y="${y*cell}" width="${cell}" height="${cell}" fill="#000"/>`); continue; }
      if(x === 6 && y >= 8 && y < N - 8){ if(y % 2 === 0) cells.push(`<rect x="${x*cell}" y="${y*cell}" width="${cell}" height="${cell}" fill="#000"/>`); continue; }
      const b = (psHash(text + ':' + x + ',' + y) ^ h1 ^ (h2 << (x % 5))) & 0xff;
      if(b > 128) cells.push(`<rect x="${x*cell}" y="${y*cell}" width="${cell}" height="${cell}" fill="#000"/>`);
    }
  }
  /* центральный «логотип OKO» — 7×7 клеток */
  const cx = 50, cy = 50, r = 8.5;
  cells.push(`<rect x="${cx-r}" y="${cy-r}" width="${r*2}" height="${r*2}" rx="3" fill="#fff"/>`);
  cells.push(`<rect x="${cx-r+1.2}" y="${cy-r+1.2}" width="${(r-1.2)*2}" height="${(r-1.2)*2}" rx="2" fill="#9AFF00"/>`);
  cells.push(`<circle cx="${cx}" cy="${cy}" r="3.4" fill="#0a0d04"/>`);
  cells.push(`<circle cx="${cx}" cy="${cy}" r="1.6" fill="#9AFF00"/>`);
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><rect width="100" height="100" fill="#fff"/>${cells.join('')}</svg>`;
}

/* ============================================================================
   РЕНДЕР
   ============================================================================ */

/* ---------- карточка-вход на профиле ---------- */
function psSocEntryHtml(){
  psSocLoad();
  const conn = psSocConnected();
  const agg = psSocAggregate();
  const avas = PS_SOC_PLATS.slice(0, 5).map(p => {
    const on = PS_SOC.conn[p.id];
    return `<span class="ps-soc-entry-ava ps-soc-tone-${p.id}${on ? '' : ' off'}" title="${esc(p.name)}${on ? '' : ' — не подключено'}">${psSocIco(p.id)}</span>`;
  }).join('');
  const sum = conn.length
    ? `<b>${psSocFmt(agg.followers)}</b> подписчиков · <b>${agg.erAvg}%</b> средний ER${agg.best ? ' · лучшая: <b>' + esc(agg.best.name) + '</b>' : ''}`
    : `Пока не подключено ни одной платформы — жми, чтобы связать <b>${PS_SOC_PLATS.length}</b> сети`;
  return `<button class="ps-soc-entry" onclick="psSocOpen()" aria-label="Открыть Мои соцсети">
    <div class="ps-soc-entry-h">
      <span class="ps-soc-entry-h-ic">${I('globe')}</span>
      <b>Мои соцсети</b>
      <span class="ps-soc-entry-open">Открыть ${I('chev')}</span>
    </div>
    <div class="ps-soc-entry-row">
      <span class="ps-soc-entry-avas">${avas}</span>
      <span class="ps-soc-entry-sum">${sum}</span>
      <span class="ps-soc-entry-chev">${I('chev')}</span>
    </div>
  </button>`;
}

/* ---------- дашборд: 3 тайла + рост ---------- */
function psSocDashHtml(){
  const agg = psSocAggregate();
  const dirIco = agg.growPct >= 0 ? 'rocket' : 'chev';
  const best = agg.best ? `${esc(agg.best.name)}<span class="ps-soc-tile-sub">${agg.best.er}% ER</span>` : '—';
  return `<div class="ps-soc-dash">
    <div class="ps-soc-tile">
      <div class="ps-soc-tile-lb">${I('users')} Подписчиков</div>
      <div class="ps-soc-tile-v">${psSocFmt(agg.followers)}</div>
      <div class="ps-soc-tile-d${agg.growPct < 0 ? ' down' : ''}">${I(dirIco)} ${agg.growPct >= 0 ? '+' : ''}${agg.growPct}% за 7 дн</div>
    </div>
    <div class="ps-soc-tile">
      <div class="ps-soc-tile-lb">${I('bolt')} Средний ER</div>
      <div class="ps-soc-tile-v">${agg.erAvg}<span class="ps-soc-tile-sub">%</span></div>
      <div class="ps-soc-tile-d">${I('check')} выше среднего</div>
    </div>
    <div class="ps-soc-tile">
      <div class="ps-soc-tile-lb">${I('star')} Лучшая</div>
      <div class="ps-soc-tile-v" style="font-size:16px">${best}</div>
      <div class="ps-soc-tile-d">${I('fire')} топ по вовлечению</div>
    </div>
  </div>`;
}

/* ---------- сетка платформ ---------- */
function psSocPlatCardHtml(p){
  const on = PS_SOC.conn[p.id];
  const handle = PS_SOC.handles[p.id] || '';
  if(!on){
    return `<button class="ps-soc-plat" onclick="psSocConnect('${p.id}')" aria-label="Подключить ${esc(p.name)}">
      <div class="ps-soc-plat-h">
        ${psSocPlatIcHtml(p.id)}
        <div class="ps-soc-plat-name">${esc(p.name)}<small>${esc(p.hint)}</small></div>
        <span class="ps-soc-plat-st">Отсутствует</span>
      </div>
      <div class="ps-soc-plat-cta">${I('plus')} Подключить</div>
    </button>`;
  }
  const followers = psSocFollowers(p.id);
  const {gain, growPct} = psSocSpark7(p.id);
  const er = psSocER(p.id);
  return `<button class="ps-soc-plat on" onclick="psSocDetail('${p.id}')" aria-label="Открыть статистику ${esc(p.name)}">
    <div class="ps-soc-plat-h">
      ${psSocPlatIcHtml(p.id)}
      <div class="ps-soc-plat-name">${esc(p.name)}<small>${p.handleFmt + esc(handle)}</small></div>
      <span class="ps-soc-plat-st on">${I('check')} Подключено</span>
    </div>
    ${psSocSparkSvg(p.id, 200, 22)}
    <div class="ps-soc-plat-mini">
      <span>${I('users')}<b>${psSocFmt(followers)}</b></span>
      <span>${I('bolt')}<b>${er}%</b> ER</span>
      <span>${I('rocket')}<b>${gain >= 0 ? '+' : ''}${psSocFmt(gain)}</b> за 7 дн</span>
      <span>${I('fire')}<b>${growPct.toFixed(1)}%</b></span>
    </div>
  </button>`;
}
function psSocPlatsHtml(){
  return `<div class="ps-soc-plats">` + PS_SOC_PLATS.map(psSocPlatCardHtml).join('') + `</div>`;
}

/* ---------- тренды: подсказки под соцсети ---------- */
function psSocTrendsHtml(){
  const conn = psSocConnected();
  if(!conn.length) return `<div class="ps-soc-empty-body">${I('bolt')}Подключи хотя бы одну платформу — подскажу, что делать, чтобы вырасти быстрее конкурентов в нише.</div>`;
  const trends = [];
  /* 1) платформа с ниже среднего ER — рекомендация по частоте */
  const byEr = conn.map(p => ({p, er: psSocER(p.id)})).sort((a, b) => a.er - b.er);
  const worst = byEr[0];
  const nicheAvg = {ig:5.2, tt:7.8, vk:3.4, tg:9.0, yt:5.4, th:4.1, ru:3.2}[worst.p.id] || 4.5;
  if(worst && worst.er < nicheAvg){
    trends.push({ic:'bolt', tone:'warn', t:`На <b>${worst.p.name}</b> ER ниже средней в нише`,
      d:`Твой ER <b>${worst.er}%</b>, средний в нише <b>${nicheAvg}%</b>. Попробуй увеличить частоту постов до <b>5/неделю</b> и добавить сильный хук в первые 3 секунды — за 2 недели рост в 1.4×.`});
  }
  /* 2) самая растущая платформа — усилить */
  const byGrow = conn.map(p => ({p, s: psSocSpark7(p.id)})).sort((a, b) => b.s.growPct - a.s.growPct);
  const top = byGrow[0];
  if(top && top.s.growPct > 1){
    trends.push({ic:'rocket', tone:'up', t:`<b>${top.p.name}</b> растёт быстрее всех: +${top.s.growPct.toFixed(1)}%`,
      d:`Прирост <b>+${psSocFmt(top.s.gain)}</b> подписчиков за 7 дней. Разбери, какой ролик залетел, и повтори формат ещё 2–3 раза — алгоритм подхватит.`});
  }
  /* 3) не подключённая платформа с ожидаемой аудиторией */
  const missing = PS_SOC_PLATS.find(p => !PS_SOC.conn[p.id]);
  if(missing){
    trends.push({ic:missing.id === 'yt' ? 'circle-play' : 'megaphone', tone:'',
      t:`Подключи <b>${missing.name}</b> — не теряй охваты`,
      d:`По твоей нише ${missing.name} даёт в среднем <b>+18%</b> к охвату за счёт другой аудитории. Займёт 20 секунд — уже видно статистику.`});
  }
  /* 4) лучший пост месяца — упаковать в кейс */
  const bestPlat = byEr[byEr.length - 1] ? byEr[byEr.length - 1].p : conn[0];
  const best = psSocBestPost(bestPlat.id);
  if(best){
    trends.push({ic:'fire', tone:'up', t:`Лучший пост месяца: <b>${psSocFmt(best.reach)}</b> охват`,
      d:`«${esc(best.t)}» на <b>${bestPlat.name}</b> собрал ER <b>${best.er}%</b>. Заверни в кейс — статистика уже есть, останется добавить обложку.`});
  }
  return `<div class="ps-soc-trends">` + trends.slice(0, 4).map(t => `
    <div class="ps-soc-trend">
      <span class="ps-soc-trend-ic ${t.tone}">${I(t.ic)}</span>
      <div class="ps-soc-trend-b">
        <div class="ps-soc-trend-t">${t.t}</div>
        <div class="ps-soc-trend-d">${t.d}</div>
      </div>
    </div>`).join('') + `</div>`;
}

/* ---------- медиа-кит ---------- */
function psSocMediaKitHtml(){
  return `<div class="ps-soc-mediakit">
    <div class="ps-soc-mk-doc">
      <span class="ps-soc-mk-logo">${I('logo')}</span>
      <div class="ps-soc-mk-lines"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </div>
    <div class="ps-soc-mk-b">
      <div class="ps-soc-mk-t">Медиа-кит для клиентов</div>
      <div class="ps-soc-mk-d">PDF с обложкой OKO: соцсети, аудитория, ER, лучшие кейсы, ссылки для связи. Готово за 3 секунды.</div>
      <button class="ps-soc-mk-btn" onclick="psSocExportKit()">${I('file')} Скачать PDF</button>
    </div>
  </div>`;
}

/* ---------- публичная ссылка + QR ---------- */
function psSocPubHtml(){
  const slug = psSocSlug();
  const url = 'okoteam.top/u/@' + slug;
  return `<div class="ps-soc-pub">
    <div class="ps-soc-qr">${psSocQrSvg(url)}</div>
    <div class="ps-soc-pub-b">
      <div class="ps-soc-pub-lb">Твоя публичная страница</div>
      <div class="ps-soc-pub-url">${I('globe')}${esc(url)}</div>
      <div class="ps-soc-pub-actions">
        <button onclick="psSocCopy('${psAttr(url)}')">${I('copy')} Скопировать</button>
        <button onclick="psSocSharePub('${psAttr(url)}')">${I('share')} Поделиться</button>
        <button onclick="psSocEditSlug()">${I('edit')} Редактировать</button>
      </div>
    </div>
  </div>`;
}

/* ---------- автопостинг ---------- */
function psSocAutoHtml(){
  const list = (PS_SOC.sched || []).slice().sort((a, b) => a.at - b.at);
  const rows = list.length ? list.map(s => {
    const dt = new Date(s.at);
    const HH = String(dt.getHours()).padStart(2, '0');
    const MM = String(dt.getMinutes()).padStart(2, '0');
    const today = new Date(); today.setHours(0,0,0,0);
    const dayLb = (dt.getTime() < today.getTime() + 86400e3) ? 'сегодня' :
                  (dt.getTime() < today.getTime() + 86400e3 * 2) ? 'завтра' :
                  dt.getDate() + '.' + String(dt.getMonth() + 1).padStart(2, '0');
    const plats = (s.plats || []).slice(0, 4).map(id => `<span class="ps-soc-tone-${id}">${psSocIco(id)}</span>`).join('');
    return `<div class="ps-soc-auto-row">
      <div class="ps-soc-auto-time">${HH}:${MM}<small>${dayLb}</small></div>
      <div class="ps-soc-auto-b"><span>${esc(s.txt)}</span><small>уйдёт в ${(s.plats || []).length} сети</small></div>
      <div class="ps-soc-auto-plats">${plats}</div>
      <button class="ps-soc-auto-del" onclick="psSocSchedRemove('${s.id}')" aria-label="Удалить">${I('trash')}</button>
    </div>`;
  }).join('') : `<div class="ps-soc-auto-empty">${I('clock')}Ничего не запланировано. Задай время — робот сам опубликует пост во все выбранные сети.</div>`;
  return `<div class="ps-soc-auto">
    <div class="ps-soc-auto-h">
      <span class="ps-soc-plat-ic">${I('clock')}</span>
      <b>Расписание</b>
      <button onclick="psSocSchedOpen()">${I('plus')} Добавить</button>
    </div>
    <div class="ps-soc-auto-list">${rows}</div>
  </div>`;
}

/* ---------- ссылки-агрегатор (Linktree) ---------- */
function psSocLinksHtml(){
  const url = 'okoteam.top/u/@' + psSocSlug();
  const rows = (PS_SOC.links || []).map(l => {
    const clicks = 40 + (psHash('lc:' + l.id) % 1800);
    return `<div class="ps-soc-link-row" onclick="psSocLinkOpen('${l.id}')">
      <span class="ps-soc-link-ic">${I(psSocSafeIco(l.ic))}</span>
      <div class="ps-soc-link-b"><b>${esc(l.t)}</b><small>${esc(l.u)}</small></div>
      <div class="ps-soc-link-stat"><b>${psSocFmt(clicks)}</b>кликов</div>
      <button class="ps-soc-link-edit" onclick="event.stopPropagation();psSocLinkEdit('${l.id}')" aria-label="Редактировать">${I('edit')}</button>
    </div>`;
  }).join('');
  return `<div class="ps-soc-links">
    ${rows}
    <button class="ps-soc-link-add" onclick="psSocLinkEdit(null)">${I('plus')} Добавить ссылку</button>
    <div class="ps-soc-hint">Все ссылки видны на публичной странице <b>${esc(url)}</b> — одна ссылка вместо десятка в био.</div>
  </div>`;
}

/* ---------- рендер всей fullscreen-вьюхи ---------- */
function psSocRender(){
  psSocLoad();
  const body = document.getElementById('psSocBody');
  if(!body) return;
  body.innerHTML = `
    <div class="ps-soc-sec">${I('poll')} Дашборд <span class="ps-soc-sec-hint">все привязанные сети</span></div>
    ${psSocDashHtml()}

    <div class="ps-soc-sec">${I('users')} Платформы <span class="ps-soc-sec-hint">${psSocConnected().length}/${PS_SOC_PLATS.length} подключено</span></div>
    ${psSocPlatsHtml()}

    <div class="ps-soc-sec">${I('rocket')} Тренды и рост</div>
    ${psSocTrendsHtml()}

    <div class="ps-soc-sec">${I('globe')} Публичная страница</div>
    ${psSocPubHtml()}

    <div class="ps-soc-sec">${I('circle-play')} Автопостинг</div>
    ${psSocAutoHtml()}

    <div class="ps-soc-sec">${I('compass')} Ссылки-агрегатор</div>
    ${psSocLinksHtml()}

    <div class="ps-soc-sec">${I('file')} Медиа-кит</div>
    ${psSocMediaKitHtml()}

    <div style="height:32px"></div>`;
}

/* ---------- открыть/закрыть fullscreen ---------- */
function psSocOpen(){
  psSocLoad();
  psSocRender();
  const v = document.getElementById('psSocView');
  if(v && !v.classList.contains('open')){
    v.classList.add('open');
    if(typeof nvPush === 'function') nvPush('view:psSoc', psSocClose);
  }
}
function psSocClose(){
  const v = document.getElementById('psSocView');
  if(v) v.classList.remove('open');
  if(typeof nvPop === 'function') nvPop('view:psSoc');
}
function psSocMenu(){
  if(typeof showPopup !== 'function') return;
  showPopup({title:'Мои соцсети', body:'Действия с разделом', actions:[
    {label:'Обновить статистику', onclick: () => { psSocRender(); if(typeof toast === 'function') toast('Статистика обновлена'); }},
    {label:'Скачать медиа-кит', onclick: psSocExportKit},
    {label:'Скопировать публичную ссылку', onclick: () => psSocCopy('okoteam.top/u/@' + psSocSlug())},
    {label:'Закрыть', ghost:true}
  ]});
}

/* ---------- подключение платформы ---------- */
function psSocConnect(id){
  const p = PS_SOC_MAP[id]; if(!p) return;
  const head = document.getElementById('psSocConnHead');
  const body = document.getElementById('psSocConnBody');
  if(head) head.textContent = 'Подключить ' + p.name;
  const cur = PS_SOC.handles[id] || '';
  body.innerHTML = `
    <div class="ps-soc-conn-h">
      ${psSocPlatIcHtml(id)}
      <div><b>${esc(p.name)}</b><small>${esc(p.hint)}</small></div>
    </div>
    <div class="ps-soc-conn-input">
      <label>Твой хендл</label>
      <input id="psSocConnInp" type="text" placeholder="${esc(p.ph)}" value="${esc(cur)}" autocomplete="off">
    </div>
    <div class="ps-soc-conn-help">Данные подтягиваются автоматически — подписчики, посты, ER, лучший месяц. Достаточно указать <b>публичный хендл</b> — токены и пароли не нужны.</div>
    <div class="ps-soc-conn-actions">
      <button class="btn" onclick="psSocConnSave('${id}')">${I('check')} Подключить</button>
      ${PS_SOC.conn[id] ? `<button class="btn ghost" onclick="psSocDisconnect('${id}')">${I('trash')} Отключить</button>` : ''}
    </div>`;
  try{ document.body.classList.add('ps-over-soc'); }catch(e){}
  if(typeof openSheet === 'function') openSheet('ps-soc-connect');
  setTimeout(() => { const el = document.getElementById('psSocConnInp'); if(el) el.focus(); }, 120);
}
function psSocConnSave(id){
  const inp = document.getElementById('psSocConnInp');
  const val = ((inp && inp.value) || '').trim().replace(/^@/, '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if(!val){ if(typeof toast === 'function') toast('Укажи хендл'); return; }
  PS_SOC.handles[id] = val;
  PS_SOC.conn[id] = true;
  psSocSave();
  if(typeof closeSheet === 'function') closeSheet();
  psSocRender();
  const p = PS_SOC_MAP[id];
  if(typeof toast === 'function') toast(p.name + ': подключено');
  /* обновить карточку-вход на профиле, если открыта */
  try{ if(document.getElementById('screen-profile')) psSocInjectEntry(); }catch(e){}
}
function psSocDisconnect(id){
  PS_SOC.conn[id] = false;
  psSocSave();
  if(typeof closeSheet === 'function') closeSheet();
  psSocRender();
  const p = PS_SOC_MAP[id];
  if(typeof toast === 'function') toast(p.name + ': отключено');
  try{ if(document.getElementById('screen-profile')) psSocInjectEntry(); }catch(e){}
}

/* ---------- панель статистики платформы ---------- */
function psSocDetail(id){
  const p = PS_SOC_MAP[id]; if(!p || !PS_SOC.conn[id]) return;
  const head = document.getElementById('psSocDetHead');
  if(head) head.textContent = p.name;
  const body = document.getElementById('psSocDetBody');
  const followers = psSocFollowers(id);
  const {pts, gain, growPct} = psSocSpark7(id);
  const er = psSocER(id);
  const posts = psSocRecentPosts(id);
  const best = psSocBestPost(id);
  /* большой sparkline */
  const W = 620, H = 60, pad = 3;
  const min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
  const rng = Math.max(1, max - min);
  const xF = i => pad + i * ((W - pad * 2) / (pts.length - 1));
  const yF = v => pad + (H - pad * 2) * (1 - (v - min) / rng);
  const line = pts.map((v, i) => (i ? 'L' : 'M') + xF(i).toFixed(1) + ' ' + yF(v).toFixed(1)).join(' ');
  const area = `M${pad} ${(H - pad).toFixed(1)} ` + pts.map((v, i) => 'L' + xF(i).toFixed(1) + ' ' + yF(v).toFixed(1)).join(' ') + ` L${(W - pad).toFixed(1)} ${(H - pad).toFixed(1)} Z`;
  const dot = pts.length - 1;

  const postsRows = posts.map(pp => `
    <div class="ps-soc-post-row${pp.id === best.id ? ' best' : ''}" onclick="psSocPostOpen('${id}',${pp.i})">
      ${pp.id === best.id ? `<span class="ps-soc-best-badge">${I('star')} лучший</span>` : ''}
      <div class="ps-soc-post-thumb ${pp.g}">${I(pp.kind)}</div>
      <div class="ps-soc-post-b">
        <span class="ps-soc-post-t">${esc(pp.t)}</span>
        <div class="ps-soc-post-m">
          <span>${I('eye')}${psSocFmt(pp.reach)}</span>
          <span>${I('heart')}${psSocFmt(pp.likes)}</span>
          <span>${I('comment')}${psSocFmt(pp.comments)}</span>
          <span>${I('clock')}${psSocPostAgo(pp.ts)}</span>
        </div>
      </div>
      <div class="ps-soc-post-er">${pp.er}%<small>ER</small></div>
    </div>`).join('');

  body.innerHTML = `
    <div class="ps-soc-det-h">
      ${psSocPlatIcHtml(id)}
      <div class="ps-soc-det-h-b"><b>${esc(p.name)}</b><small>${p.handleFmt + esc(PS_SOC.handles[id] || '')} · ${esc(p.base + (PS_SOC.handles[id] || ''))}</small></div>
      <div class="ps-soc-det-h-actions">
        <button onclick="psSocConnect('${id}')" title="Изменить хендл" aria-label="Изменить">${I('edit')}</button>
        <button onclick="psSocCopy('${psAttr(p.base + (PS_SOC.handles[id] || ''))}')" title="Скопировать ссылку" aria-label="Скопировать">${I('copy')}</button>
      </div>
    </div>
    <div class="ps-soc-det-stats">
      <div class="ps-soc-tile">
        <div class="ps-soc-tile-lb">${I('users')} Подписчиков</div>
        <div class="ps-soc-tile-v">${psSocFmt(followers)}</div>
        <div class="ps-soc-tile-d${gain < 0 ? ' down' : ''}">${I('rocket')} ${gain >= 0 ? '+' : ''}${psSocFmt(gain)}</div>
      </div>
      <div class="ps-soc-tile">
        <div class="ps-soc-tile-lb">${I('bolt')} ER</div>
        <div class="ps-soc-tile-v">${er}<span class="ps-soc-tile-sub">%</span></div>
        <div class="ps-soc-tile-d">${I('check')} стабильно</div>
      </div>
      <div class="ps-soc-tile">
        <div class="ps-soc-tile-lb">${I('fire')} Рост / нед</div>
        <div class="ps-soc-tile-v">${growPct.toFixed(1)}<span class="ps-soc-tile-sub">%</span></div>
        <div class="ps-soc-tile-d">${I('rocket')} +${psSocFmt(gain)}</div>
      </div>
    </div>
    <div class="ps-soc-det-chart">
      <div class="ps-soc-det-chart-h"><span>Подписчики за 7 дней</span><b>+${psSocFmt(gain)}</b></div>
      <svg class="ps-soc-det-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        <defs><linearGradient id="psSocDetGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#9AFF00" stop-opacity=".42"/><stop offset="100%" stop-color="#9AFF00" stop-opacity="0"/></linearGradient></defs>
        <path d="${area}" fill="url(#psSocDetGrad)"/>
        <path d="${line}" fill="none" stroke="#9AFF00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${xF(dot).toFixed(1)}" cy="${yF(pts[dot]).toFixed(1)}" r="3.5" fill="#9AFF00"/>
        <circle cx="${xF(dot).toFixed(1)}" cy="${yF(pts[dot]).toFixed(1)}" r="7" fill="#9AFF00" opacity=".24"/>
      </svg>
    </div>
    <div class="ps-soc-sec" style="margin:6px 0 6px">${I('feed')} Последние 5 постов</div>
    <div class="ps-soc-posts">${postsRows}</div>`;

  try{ document.body.classList.add('ps-over-soc'); }catch(e){}
  if(typeof openSheet === 'function') openSheet('ps-soc-detail');
}
function psSocPostOpen(id, i){
  const p = PS_SOC_MAP[id]; if(!p) return;
  const post = psSocRecentPosts(id)[i]; if(!post) return;
  if(typeof showPopup !== 'function') return;
  showPopup({
    ico: post.kind === 'circle-play' ? 'circle-play' : 'feed',
    title: post.t,
    body: `<div style="text-align:left;font-size:13px;line-height:1.6;color:var(--text)">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
        ${psSocPlatIcHtml(id)}<b>${esc(p.name)}</b><span style="color:var(--dim);font-size:11.5px;margin-left:auto">${psSocPostAgo(post.ts)}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center"><b style="display:block;color:var(--accent);font-family:var(--font-display);font-size:16px">${psSocFmt(post.reach)}</b><small style="color:var(--dim);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase">Охват</small></div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center"><b style="display:block;color:var(--accent);font-family:var(--font-display);font-size:16px">${psSocFmt(post.likes)}</b><small style="color:var(--dim);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase">Лайки</small></div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center"><b style="display:block;color:var(--accent);font-family:var(--font-display);font-size:16px">${psSocFmt(post.comments)}</b><small style="color:var(--dim);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase">Коммент</small></div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:8px;text-align:center"><b style="display:block;color:var(--accent);font-family:var(--font-display);font-size:16px">${post.er}%</b><small style="color:var(--dim);font-size:9.5px;letter-spacing:.06em;text-transform:uppercase">ER</small></div>
      </div>
      <div style="color:var(--dim);font-size:12px;line-height:1.5">CTR по ссылкам в описании — <b style="color:var(--text)">${(post.er * 0.42).toFixed(1)}%</b>. Пост попал в лучшие ${Math.max(1, Math.round(100 - post.er * 10))}% ленты за неделю.</div>
    </div>`,
    actions:[
      {label:'Повторить формат', onclick: () => { if(typeof toast === 'function') toast('Формат добавлен в очередь контент-завода'); }},
      {label:'Закрыть', ghost:true}
    ]
  });
}

/* ---------- медиа-кит: генерируем «PDF» (data-url text/html + печать через окно) ---------- */
function psSocExportKit(){
  const slug = psSocSlug();
  const agg = psSocAggregate();
  const rows = psSocConnected().map(p => {
    const f = psSocFollowers(p.id);
    const {gain} = psSocSpark7(p.id);
    return `<tr><td>${p.name}</td><td>${PS_SOC.handles[p.id] ? p.handleFmt + PS_SOC.handles[p.id] : '—'}</td><td>${psSocFmt(f)}</td><td>+${psSocFmt(gain)}</td><td>${psSocER(p.id)}%</td></tr>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>OKO · Медиа-кит @${slug}</title><style>
    *{box-sizing:border-box;font-family:-apple-system,Segoe UI,Inter,Roboto,sans-serif;color:#0a0d04}
    body{margin:0;background:#fff;padding:40px 44px}
    .h{display:flex;align-items:center;gap:14px;border-bottom:2px solid #0a0d04;padding-bottom:16px;margin-bottom:22px}
    .h .lg{width:44px;height:44px;background:#9AFF00;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;font-weight:900;color:#0a0d04;font-size:22px}
    h1{font-size:26px;margin:0;letter-spacing:.02em}
    .sub{color:#666;font-size:13px;margin-top:2px}
    .stat{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0 22px}
    .stat div{border:1px solid #e6e6e0;border-radius:10px;padding:12px 14px}
    .stat b{display:block;font-size:22px;color:#0a0d04;margin-bottom:4px}
    .stat small{color:#666;text-transform:uppercase;letter-spacing:.06em;font-size:10px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #e6e6e0;font-size:13px}
    th{background:#f3f6ea;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#3a3a30}
    .foot{margin-top:34px;font-size:11px;color:#666;border-top:1px solid #e6e6e0;padding-top:12px}
    .foot b{color:#0a0d04}
    @media print{body{padding:24px 30px}}
  </style></head><body>
    <div class="h"><span class="lg">O</span><div><h1>Медиа-кит @${esc(slug)}</h1><div class="sub">Соц-профиль OKO · сгенерировано ${new Date().toLocaleDateString('ru-RU')}</div></div></div>
    <div class="stat">
      <div><b>${psSocFmt(agg.followers)}</b><small>Совокупная аудитория</small></div>
      <div><b>${agg.erAvg}%</b><small>Средний ER</small></div>
      <div><b>+${psSocFmt(agg.gain)}</b><small>Прирост за 7 дней</small></div>
    </div>
    <h2 style="font-size:15px;letter-spacing:.05em;text-transform:uppercase">Платформы</h2>
    <table><thead><tr><th>Сеть</th><th>Хендл</th><th>Подписчики</th><th>Δ 7 дней</th><th>ER</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="foot">Связь: <b>okoteam.top/u/@${esc(slug)}</b> · Медиа-кит собран автоматически из статистики OKO.</div>
  </body></html>`;
  try{
    const w = window.open('', '_blank');
    if(w){
      w.document.open(); w.document.write(html); w.document.close();
      setTimeout(() => { try{ w.focus(); w.print(); }catch(e){} }, 400);
      if(typeof toast === 'function') toast('Медиа-кит открыт — выбери «Сохранить PDF»');
      return;
    }
  }catch(e){}
  /* fallback: скачать HTML-файл */
  try{
    const a = document.createElement('a');
    a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
    a.download = 'oko-mediakit-' + slug + '.html';
    document.body.appendChild(a); a.click(); a.remove();
    if(typeof toast === 'function') toast('Медиа-кит скачан');
  }catch(e){ if(typeof toast === 'function') toast('Не удалось экспортировать'); }
}

/* ---------- публичная ссылка ---------- */
function psSocCopy(text){ const ok = psCopy(text); if(typeof toast === 'function') toast(ok ? 'Скопировано' : 'Не удалось'); }
function psSocSharePub(url){
  const full = 'https://' + url;
  if(navigator.share){ navigator.share({title:'Мои соцсети в OKO', url: full}).catch(()=>{}); return; }
  if(typeof showPopup === 'function'){
    showPopup({ico:'share', title:'Поделиться публичной страницей',
      body:`Одна ссылка — все твои соцсети и материалы.<div class="ps-sharelink">${I('globe')}<span>${esc(full)}</span></div>`,
      actions:[{label:'Скопировать', onclick: () => psSocCopy(full)},{label:'Закрыть', ghost:true}]});
  }
}
function psSocEditSlug(){
  if(typeof showPopup !== 'function') return;
  const cur = psSocSlug();
  showPopup({title:'Публичный адрес', body:`
    <div class="ps-soc-conn-input"><label>okoteam.top/u/@</label>
      <input id="psSocSlugInp" type="text" value="${esc(cur)}" autocomplete="off" spellcheck="false"></div>
    <div class="ps-soc-hint" style="text-align:left">Латиница, цифры и точка. Пример: <b>ktodaniel</b>, <b>agency.oko</b>.</div>
  `, actions:[
    {label:'Сохранить', onclick: () => {
      const el = document.getElementById('psSocSlugInp');
      const v = (el && el.value || '').trim().replace(/^@/, '').replace(/[^a-z0-9._-]/gi, '').toLowerCase();
      if(!v){ if(typeof toast === 'function') toast('Пустой адрес'); return; }
      PS_SOC.slug = v; psSocSave(); psSocRender();
      if(typeof toast === 'function') toast('okoteam.top/u/@' + v + ' — сохранено');
    }},
    {label:'Отмена', ghost:true}
  ]});
  setTimeout(() => { const el = document.getElementById('psSocSlugInp'); if(el){ el.focus(); el.select(); } }, 120);
}

/* ---------- автопостинг: расписание ---------- */
function psSocSchedOpen(id){
  const body = document.getElementById('psSocPostBody');
  const conn = psSocConnected();
  if(!conn.length){
    body.innerHTML = `<div class="ps-soc-empty-body">${I('bolt')}Сначала подключи хотя бы одну платформу, чтобы было куда постить.</div>
      <div class="ps-soc-post-actions"><button class="btn ghost" onclick="if(typeof closeSheet==='function')closeSheet()">Понятно</button></div>`;
    try{ document.body.classList.add('ps-over-soc'); }catch(e){}
    if(typeof openSheet === 'function') openSheet('ps-soc-post');
    return;
  }
  const cur = id ? (PS_SOC.sched || []).find(s => s.id === id) : null;
  const dt = new Date(cur ? cur.at : (Date.now() + 3600e3 * 4));
  const dtVal = dt.toISOString().slice(0, 16);
  const platsBtns = PS_SOC_PLATS.map(p => {
    const on = PS_SOC.conn[p.id] && (cur ? (cur.plats || []).includes(p.id) : ['ig','tg','vk'].includes(p.id));
    return `<button type="button" data-plat="${p.id}" class="${on ? 'on' : ''}${!PS_SOC.conn[p.id] ? ' off' : ''}" ${!PS_SOC.conn[p.id] ? 'disabled' : ''} onclick="psSocSchedTogglePlat(this)">
      ${psSocPlatIcHtml(p.id)}${esc(p.name)}
    </button>`;
  }).join('');
  body.innerHTML = `
    <textarea id="psSocPostTxt" placeholder="Текст поста…">${cur ? esc(cur.txt) : ''}</textarea>
    <div>
      <div class="ps-soc-hint" style="margin:0 2px 6px">Когда опубликовать</div>
      <div class="ps-soc-post-time-row"><input id="psSocPostAt" type="datetime-local" value="${dtVal}"></div>
    </div>
    <div>
      <div class="ps-soc-hint" style="margin:0 2px 6px">Куда уйдёт</div>
      <div class="ps-soc-post-plats" id="psSocPostPlats">${platsBtns}</div>
    </div>
    <div class="ps-soc-post-actions">
      <button class="btn" onclick="psSocSchedSave('${cur ? cur.id : ''}')">${I('check')} ${cur ? 'Сохранить' : 'Запланировать'}</button>
      ${cur ? `<button class="btn ghost" onclick="psSocSchedRemove('${cur.id}')">${I('trash')} Удалить</button>` : `<button class="btn ghost" onclick="if(typeof closeSheet==='function')closeSheet()">Отмена</button>`}
    </div>`;
  try{ document.body.classList.add('ps-over-soc'); }catch(e){}
  if(typeof openSheet === 'function') openSheet('ps-soc-post');
}
function psSocSchedTogglePlat(btn){ btn.classList.toggle('on'); }
function psSocSchedSave(id){
  const txt = (document.getElementById('psSocPostTxt') || {}).value || '';
  const at = (document.getElementById('psSocPostAt') || {}).value || '';
  const plats = Array.from(document.querySelectorAll('#psSocPostPlats button.on')).map(b => b.getAttribute('data-plat'));
  if(!txt.trim()){ if(typeof toast === 'function') toast('Текст поста пуст'); return; }
  if(!plats.length){ if(typeof toast === 'function') toast('Выбери хотя бы одну сеть'); return; }
  const ts = at ? new Date(at).getTime() : Date.now() + 3600e3;
  if(!isFinite(ts)){ if(typeof toast === 'function') toast('Неверная дата'); return; }
  const list = PS_SOC.sched || [];
  if(id){
    const idx = list.findIndex(s => s.id === id);
    if(idx >= 0) list[idx] = {id, txt: txt.trim(), at: ts, plats};
  } else {
    list.push({id: 's' + Date.now(), txt: txt.trim(), at: ts, plats});
  }
  PS_SOC.sched = list; psSocSave();
  if(typeof closeSheet === 'function') closeSheet();
  psSocRender();
  if(typeof toast === 'function') toast('Пост запланирован в ' + plats.length + ' ' + (plats.length === 1 ? 'сеть' : 'сети'));
}
function psSocSchedRemove(id){
  PS_SOC.sched = (PS_SOC.sched || []).filter(s => s.id !== id);
  psSocSave();
  if(typeof closeSheet === 'function') closeSheet();
  psSocRender();
  if(typeof toast === 'function') toast('Пост удалён из расписания');
}

/* ---------- ссылки-агрегатор ---------- */
function psSocLinkOpen(id){
  const l = (PS_SOC.links || []).find(x => x.id === id);
  if(!l) return;
  if(navigator.share){ navigator.share({title:l.t, url:l.u.match(/^https?:/) ? l.u : 'https://' + l.u}).catch(()=>{}); return; }
  psSocCopy(l.u);
}
function psSocLinkEdit(id){
  const l = id ? (PS_SOC.links || []).find(x => x.id === id) : null;
  const head = document.getElementById('psSocLinkHead');
  if(head) head.textContent = l ? 'Ссылка' : 'Новая ссылка';
  const body = document.getElementById('psSocLinkBody');
  const opts = PS_SOC_LINK_ICONS.map(o => `<option value="${o.v}" ${l && l.ic === o.v ? 'selected' : ''}>${esc(o.lb)}</option>`).join('');
  body.innerHTML = `
    <label>Название</label>
    <input id="psSocLinkT" type="text" placeholder="Например: Мой сайт" value="${esc(l ? l.t : '')}">
    <label>URL</label>
    <input id="psSocLinkU" type="text" placeholder="okoteam.top/…" value="${esc(l ? l.u : '')}">
    <label>Иконка</label>
    <select id="psSocLinkI">${opts}</select>
    <div class="ps-soc-link-actions">
      <button class="btn" onclick="psSocLinkSave('${l ? l.id : ''}')">${I('check')} ${l ? 'Сохранить' : 'Добавить'}</button>
      ${l ? `<button class="btn ghost" onclick="psSocLinkDel('${l.id}')">${I('trash')} Удалить</button>` : `<button class="btn ghost" onclick="if(typeof closeSheet==='function')closeSheet()">Отмена</button>`}
    </div>`;
  try{ document.body.classList.add('ps-over-soc'); }catch(e){}
  if(typeof openSheet === 'function') openSheet('ps-soc-link');
  setTimeout(() => { const el = document.getElementById('psSocLinkT'); if(el) el.focus(); }, 120);
}
function psSocLinkSave(id){
  const t = ((document.getElementById('psSocLinkT') || {}).value || '').trim();
  const u = ((document.getElementById('psSocLinkU') || {}).value || '').trim().replace(/^https?:\/\//, '');
  const ic = (document.getElementById('psSocLinkI') || {}).value || 'globe';
  if(!t || !u){ if(typeof toast === 'function') toast('Заполни название и URL'); return; }
  const list = PS_SOC.links || [];
  if(id){
    const idx = list.findIndex(x => x.id === id);
    if(idx >= 0) list[idx] = {id, t, u, ic};
  } else {
    list.push({id:'l' + Date.now(), t, u, ic});
  }
  PS_SOC.links = list; psSocSave();
  if(typeof closeSheet === 'function') closeSheet();
  psSocRender();
  if(typeof toast === 'function') toast('Ссылка сохранена');
}
function psSocLinkDel(id){
  PS_SOC.links = (PS_SOC.links || []).filter(x => x.id !== id);
  psSocSave();
  if(typeof closeSheet === 'function') closeSheet();
  psSocRender();
  if(typeof toast === 'function') toast('Ссылка удалена');
}

/* ---------- инъекция карточки-входа в свой профиль ---------- */
function psSocInjectEntry(){
  const scr = document.getElementById('screen-profile');
  if(!scr) return;
  const pad = scr.querySelector('.pad');
  if(!pad) return;
  /* точка монтирования: после mp-streak, иначе после mp-spark, иначе после profStats */
  const after = pad.querySelector('.mp-streak-wrap') || pad.querySelector('.mp-spark-wrap') || pad.querySelector('.mp-show-wrap') || document.getElementById('profStats');
  if(!after) return;
  let wrap = pad.querySelector('.ps-soc-entry-wrap');
  if(!wrap){
    wrap = document.createElement('div');
    wrap.className = 'ps-soc-entry-wrap';
    after.insertAdjacentElement('afterend', wrap);
  }
  wrap.innerHTML = psSocEntryHtml();
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
      try{ mpInject(); }catch(e){}
      try{ psSocInjectEntry(); }catch(e){}
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

  /* chain closeSheet: снять подъём бэкдропа над профилем и хабом соцсетей */
  if(typeof closeSheet === 'function'){
    const _psPrevCloseSheet = closeSheet;
    closeSheet = function(){
      _psPrevCloseSheet.apply(this, arguments);
      try{ document.body.classList.remove('ps-over-view'); }catch(e){}
      try{ document.body.classList.remove('ps-over-soc'); }catch(e){}
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
    else { psInjectAccSwitch(); psInjectMyFollows(); mpInject(); psSocInjectEntry(); }
  }catch(e){}
})();

/* ============================================================================
   PP2 · Компактный профиль (Telegram + iOS Settings)
   ---------------------------------------------------------------------------
   Полностью перерисовывает содержимое #screen-profile .pad после того как
   ядро (renderMyProfile) и все предыдущие чейны (mp-, ps-soc-, ps-) отработали.
   Даёт: аватар 88px, имя+ник+био (2 строки), tier-бейдж, кнопку «Редактировать»,
   строку быстрых действий и iOS-стайл группы разделов. Подстраницы уходят в
   свой nav-стек справа (pp2Stack[]). Ничего не ломает поверх base.html.
   ============================================================================ */
(function pp2Init(){
  'use strict';

  /* ---------- утилиты общие ---------- */
  function esc2(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function iSvg(id){ return '<svg class="i"><use href="#i-' + id + '"/></svg>'; }
  function safeI(id){ return (typeof I === 'function') ? I(id) : iSvg(id); }
  function T(m){ if(typeof toast === 'function') toast(m); }

  /* тир: FREE / START / PRO / BUSINESS / BUSINESS_PRO / MAX */
  const PP2_TIER_META = {
    FREE:         {lb:'FREE',         short:'Free',       kind:'free', tone:'gray'},
    START:        {lb:'START',        short:'Start',      kind:'paid', tone:''},
    PRO:          {lb:'PRO',          short:'Pro',        kind:'paid', tone:''},
    BUSINESS:     {lb:'BUSINESS',     short:'Business',   kind:'paid', tone:''},
    BUSINESS_PRO: {lb:'BUSINESS PRO', short:'Business Pro', kind:'paid', tone:''},
    MAX:          {lb:'MAX',          short:'Max',        kind:'gold', tone:'gold'},
  };
  function pp2Tier(){
    try{
      const t = (typeof PROFILE !== 'undefined' && PROFILE.tier) ? String(PROFILE.tier).toUpperCase() : 'FREE';
      return PP2_TIER_META[t] ? t : 'FREE';
    }catch(e){ return 'FREE'; }
  }
  function pp2IsPaid(){ const m = PP2_TIER_META[pp2Tier()]; return !!m && m.kind !== 'free'; }
  function pp2IsOwner(){
    try{ if(typeof isOwner === 'function') return !!isOwner(); }catch(e){}
    return (typeof PROFILE !== 'undefined' && PROFILE.role === 'owner');
  }

  /* ---------- инициалы ---------- */
  function pp2Init2(name){
    return String(name || 'OKO').trim().split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('') || 'O';
  }

  /* ---------- публичный слаг для ссылок и QR ---------- */
  function pp2Slug(){
    try{
      if(typeof psSocSlug === 'function'){ psSocLoad && psSocLoad(); return psSocSlug(); }
    }catch(e){}
    return (typeof PROFILE !== 'undefined' && PROFILE.nick) || 'me';
  }
  function pp2PublicUrl(){ return 'https://okoteam.top/u/@' + pp2Slug(); }

  /* ================= NAV-СТЕК ================= */
  const pp2Stack = [];       /* [{key, title, htmlOrFn}] */
  let pp2Nav = null;
  function pp2NavRoot(){
    if(pp2Nav && document.body.contains(pp2Nav)) return pp2Nav;
    pp2Nav = document.getElementById('pp2Nav');
    if(!pp2Nav){
      pp2Nav = document.createElement('div');
      pp2Nav.id = 'pp2Nav';
      document.body.appendChild(pp2Nav);
    }
    return pp2Nav;
  }
  function pp2PageHtml(title, bodyHtml, headRight){
    return '<div class="pp2-head">'
      + '<button class="pp2-back" onclick="pp2Pop()" aria-label="Назад">' + safeI('back') + '</button>'
      + '<div class="pp2-title">' + esc2(title) + '</div>'
      + '<div class="pp2-head-r">' + (headRight || '') + '</div>'
      + '</div>'
      + '<div class="pp2-body">' + bodyHtml + '</div>';
  }
  function pp2Push(page){
    const root = pp2NavRoot();
    /* пометить текущий верхний как «уходит вглубь» */
    const cur = root.lastElementChild;
    if(cur){ cur.classList.remove('pp2-in'); cur.classList.add('pp2-out'); }
    const el = document.createElement('section');
    el.className = 'pp2-page';
    el.dataset.key = page.key || ('p' + Date.now());
    const rightHtml = (typeof page.headRight === 'function') ? page.headRight() : (page.headRight || '');
    const bodyHtml = (typeof page.html === 'function') ? page.html() : (page.html || '');
    el.innerHTML = pp2PageHtml(page.title || '', bodyHtml, rightHtml);
    root.appendChild(el);
    pp2Stack.push({key: el.dataset.key, page});
    /* анимация появления */
    requestAnimationFrame(() => { el.classList.add('pp2-in'); });
    /* повесить onMount, если есть */
    if(typeof page.onMount === 'function'){ try{ page.onMount(el); }catch(e){} }
  }
  function pp2Pop(){
    const root = pp2NavRoot();
    if(!root.lastElementChild) return;
    const top = root.lastElementChild;
    top.classList.remove('pp2-in');
    top.style.transform = 'translateX(100%)';
    pp2Stack.pop();
    /* вернуть предыдущий из «глубины» */
    const prev = top.previousElementSibling;
    if(prev){ prev.classList.remove('pp2-out'); prev.classList.add('pp2-in'); }
    setTimeout(() => { if(top && top.parentNode) top.parentNode.removeChild(top); }, 300);
  }
  function pp2PopAll(){
    const root = pp2NavRoot();
    while(root.firstChild) root.removeChild(root.firstChild);
    pp2Stack.length = 0;
  }
  /* глобальный доступ для onclick */
  window.pp2Pop = pp2Pop;

  /* поддержка кнопки «Назад» устройства/браузера */
  window.addEventListener('popstate', function(){
    if(pp2Stack.length){ pp2Pop(); }
  });

  /* ================= TOP-БЛОК ================= */
  function pp2TopHtml(){
    const name = (typeof PROFILE !== 'undefined' && PROFILE.name) || 'OKO';
    const nick = (typeof PROFILE !== 'undefined' && PROFILE.nick) || 'me';
    const bio  = (typeof PROFILE !== 'undefined' && PROFILE.bio) || '';
    const ava  = (typeof PROFILE !== 'undefined' && PROFILE.avatar) || '';
    const status = (typeof PROFILE !== 'undefined' && PROFILE.status) || null;
    const tier = pp2Tier(); const tm = PP2_TIER_META[tier];
    const avaStyle = ava ? ('background-image:url(' + JSON.stringify(ava).slice(1,-1) + ')') : '';
    const avaClass = ava ? ' has-photo' : '';
    const avaTxt = ava ? '' : esc2(pp2Init2(name));
    const owner = pp2IsOwner();
    const chips = [];
    if(tm.kind === 'gold'){
      chips.push('<span class="pp2-chip gold">' + safeI('crown') + esc2(tm.lb) + '</span>');
    } else if(tm.kind === 'paid'){
      chips.push('<span class="pp2-chip">' + safeI('crown') + esc2(tm.lb) + '</span>');
    } else {
      chips.push('<span class="pp2-chip owner">' + esc2(tm.lb) + '</span>');
    }
    if(!pp2IsPaid()){
      chips.push('<span class="pp2-chip disc">' + safeI('flag') + '−20% на год</span>');
    }
    if(owner) chips.push('<span class="pp2-chip owner">' + safeI('crown') + 'Владелец</span>');

    const statusIco = status ? safeI(status) : '';
    return '<div class="pp2-top">'
      + '<button class="pp2-ava' + avaClass + '" style="' + avaStyle + '" onclick="pp2OpenEdit()" aria-label="Аватар">' + avaTxt + '</button>'
      + '<div class="pp2-name">' + esc2(name) + statusIco + '</div>'
      + '<div class="pp2-nick">@' + esc2(nick) + '<span class="pp2-dot">·</span><span class="pp2-online">в сети</span></div>'
      + (bio ? '<p class="pp2-bio">' + esc2(bio) + '</p>' : '')
      + '<div class="pp2-chips">' + chips.join('') + '</div>'
      + '<button class="pp2-edit" onclick="pp2OpenEdit()">' + safeI('edit') + '<span>Редактировать</span></button>'
      + '</div>';
  }

  /* быстрые действия — 5 кнопок */
  function pp2QuickHtml(){
    const items = [
      {k:'share', ic:'share',       lb:'Поделиться', on:'pp2Share()'},
      {k:'qr',    ic:'compass',     lb:'QR-код',     on:'pp2OpenQR()'},
      {k:'link',  ic:'globe',       lb:'Ссылка',     on:'pp2CopyLink()'},
      {k:'stat',  ic:'poll',        lb:'Статистика', on:'pp2OpenStats()'},
      {k:'set',   ic:'bolt',        lb:'Настройки',  on:'pp2OpenSettings()'},
    ];
    return '<div class="pp2-quick">' + items.map(function(it){
      return '<button class="pp2-qbtn" onclick="' + it.on + '" aria-label="' + esc2(it.lb) + '">'
        + safeI(it.ic) + '<span>' + esc2(it.lb) + '</span></button>';
    }).join('') + '</div>';
  }

  /* строка списка */
  function pp2Row(o){
    /* o: {ic, tone, t, s, right, onclick, danger} */
    const cls = 'pp2-row' + (o.danger ? ' danger' : '');
    const icCls = 'pp2-row-ic' + (o.tone ? (' ' + o.tone) : '');
    const rightHtml = o.right || '<span class="pp2-row-chev">' + safeI('chev') + '</span>';
    return '<button class="' + cls + '" onclick="' + (o.onclick || '') + '">'
      + '<span class="' + icCls + '">' + safeI(o.ic) + '</span>'
      + '<span class="pp2-row-b">'
        + '<span class="pp2-row-t">' + esc2(o.t) + '</span>'
        + (o.s ? '<span class="pp2-row-s">' + esc2(o.s) + '</span>' : '')
      + '</span>'
      + '<span class="pp2-row-r">' + rightHtml + '</span>'
      + '</button>';
  }
  function pp2Group(rows){ return '<div class="pp2-group">' + rows.join('') + '</div>'; }

  /* ================= СПИСОК РАЗДЕЛОВ ================= */
  function pp2SectionsHtml(){
    const tier = pp2Tier(); const tm = PP2_TIER_META[tier];
    const owner = pp2IsOwner();
    const paid = pp2IsPaid();
    /* Группа 1 — тарифы (выше всего, как просил Даниэль) */
    const g1 = [
      pp2Row({ic:'crown', tone:tm.kind==='gold'?'gold':'', t:'Тарифы OKO',
              s: paid ? ('Активен ' + tm.short) : 'Выбрать план',
              right: '<span class="pp2-chip' + (tm.kind==='gold'?' gold':'') + '">' + esc2(tm.lb) + '</span><span class="pp2-row-chev">' + safeI('chev') + '</span>',
              onclick:'pp2OpenTiers()'}),
    ];
    /* Группа 2 — внешний контур (для PRO+ показываем ссылки-агрегатор) */
    const g2 = [];
    if(paid){
      g2.push(pp2Row({ic:'globe', tone:'teal', t:'Внешние ссылки',
              s:'Мини-сайт-визитка · до 5 ссылок', onclick:'pp2OpenExtLinks()'}));
    }
    g2.push(pp2Row({ic:'send', tone:'blue', t:'Мои соцсети',
            s:'5 подключено · автопостинг', onclick:'pp2OpenSocials()'}));
    g2.push(pp2Row({ic:'users', tone:'violet', t:'Партнёрская программа',
            s:'Лидерборд, промо, выплаты', onclick:'pp2OpenPartner()'}));
    g2.push(pp2Row({ic:'star', tone:'gold', t:'Академия OKO',
            s:'Мои курсы и сертификаты', onclick:'pp2OpenAcademy()'}));
    g2.push(pp2Row({ic:'briefcase', tone:'teal', t:'Биржа услуг',
            s:'Заказы, кабинет продавца', onclick:'pp2OpenMarket()'}));

    /* Группа 3 — документы, устройства, безопасность */
    const g3 = [
      pp2Row({ic:'file', tone:'gray', t:'Мои документы',
              s:'Договоры, чеки, отчёты', onclick:'pp2OpenDocs()'}),
      pp2Row({ic:'device', tone:'gray', t:'Устройства и сессии',
              s:'Где выполнен вход', onclick:'pp2OpenDevices()'}),
      pp2Row({ic:'bell', tone:'gray', t:'Уведомления',
              s:'Пуши, email, тишина', onclick:"pp2OpenSettingsGroup('notif')"}),
      pp2Row({ic:'lock', tone:'gray', t:'Приватность',
              s:'Профиль, чаты, звонки', onclick:"pp2OpenSettingsGroup('privacy')"}),
    ];

    /* Группа 4 — сервис */
    const g4 = [
      pp2Row({ic:'flag', tone:'', t:'Прогресс сборки',
              s:'Что уже готово, что дальше', onclick:"openSheet('progress')"}),
      pp2Row({ic:'chat', tone:'blue', t:'Помощь и поддержка',
              s:'Ответы 24/7', onclick:'pp2OpenSupport()'}),
      pp2Row({ic:'compass', tone:'gray', t:'О приложении',
              s:'Версия и правовые', onclick:'pp2OpenAbout()'}),
    ];
    if(owner){
      g4.unshift(pp2Row({ic:'bolt', tone:'', t:'Админка OKO',
              s:'Только для владельца',
              right:'<span class="pp2-chip">Владелец</span><span class="pp2-row-chev">' + safeI('chev') + '</span>',
              onclick:'openAdmin()'}));
    }

    /* Финал — выход */
    const logout = '<button class="pp2-btn-plain danger" onclick="doLogout()">' + safeI('logout') + '<span>Выйти из аккаунта</span></button>';

    /* футер */
    const foot = '<div class="pp2-foot"><b>OKO</b> · <span id="pp2VerLb">сборка</span>'
      + '<br><span>Сделано командой OKO — @okoappbot</span></div>';

    return pp2Group(g1) + pp2Group(g2) + pp2Group(g3) + pp2Group(g4) + logout + foot;
  }

  /* ================= ГЛАВНЫЙ РЕНДЕР ================= */
  function pp2Rebuild(){
    const scr = document.getElementById('screen-profile');
    if(!scr) return;
    const pad = scr.querySelector('.pad');
    if(!pad) return;
    /* полностью заменяем содержимое .pad единственным контейнером */
    let wrap = pad.querySelector('.pp2-wrap');
    if(!wrap){
      /* убираем ВСЁ, что нарисовало ядро и старые чейны, кроме модальных внешних вьюх */
      Array.from(pad.children).forEach(function(ch){
        /* оставляем возможные внешние оверлеи, если они как-то попали внутрь */
        if(ch.tagName === 'DIV' && ch.id && /^ps|^psView|^st2/.test(ch.id)) return;
        pad.removeChild(ch);
      });
      wrap = document.createElement('div');
      wrap.className = 'pp2-wrap';
      pad.appendChild(wrap);
      scr.classList.add('pp2-on');
    }
    wrap.innerHTML = pp2TopHtml() + pp2QuickHtml() + pp2SectionsHtml();
    /* подписать актуальную версию сборки в футер */
    const verEl = wrap.querySelector('#pp2VerLb');
    if(verEl){
      const chip = document.querySelector('.build-chip, [data-build]');
      const ver = (chip && (chip.textContent || '').match(/v[0-9.]+/)) ? chip.textContent.match(/v[0-9.]+/)[0] : '';
      verEl.textContent = 'сборка ' + (ver || 'dev');
    }
  }
  window.pp2Rebuild = pp2Rebuild;

  /* ================= ХЕНДЛЕРЫ БЫСТРЫХ ДЕЙСТВИЙ ================= */
  window.pp2OpenEdit = function(){ if(typeof openEdit === 'function') openEdit(); };
  window.pp2Share = function(){
    const url = pp2PublicUrl();
    const name = (typeof PROFILE !== 'undefined' && PROFILE.name) || 'OKO';
    if(navigator.share){
      navigator.share({title:'Профиль ' + name + ' в OKO', text:'Мой профиль в OKO', url:url})
        .catch(function(){});
      return;
    }
    pp2CopyToClip(url); T('Ссылка на профиль скопирована');
  };
  window.pp2CopyLink = function(){ pp2CopyToClip(pp2PublicUrl()); T('Ссылка скопирована'); };
  function pp2CopyToClip(txt){
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt); return; }
    }catch(e){}
    try{
      const ta = document.createElement('textarea'); ta.value = txt; ta.style.position='fixed'; ta.style.left='-9999px';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    }catch(e){}
  }
  window.pp2OpenStats = function(){ pp2Push({key:'stats', title:'Статистика', html: pp2StatsPageHtml}); };
  window.pp2OpenSettings = function(){ pp2Push({key:'set', title:'Настройки', html: pp2SetIndexHtml}); };
  window.pp2OpenSettingsGroup = function(g){
    if(typeof openSettings === 'function') openSettings(g);
    else if(g === 'notif' || g === 'privacy'){ T('Настройки скоро'); }
  };
  window.pp2OpenTiers = function(){ pp2Push({key:'tiers', title:'Тарифы OKO', html: pp2TiersPageHtml}); };
  window.pp2OpenSocials = function(){
    /* переиспользуем существующий хаб «Мои соцсети» */
    if(typeof psSocOpen === 'function'){ psSocOpen(); return; }
    if(typeof openMa === 'function'){ openMa('socials'); return; }
    T('Соцсети скоро');
  };
  window.pp2OpenPartner = function(){
    if(typeof showTab === 'function') showTab('partner');
    else T('Партнёрка');
  };
  window.pp2OpenAcademy = function(){
    if(typeof showTab === 'function') showTab('academy');
    else T('Академия');
  };
  window.pp2OpenMarket = function(){
    if(typeof openMa === 'function') openMa('market');
    else if(typeof showTab === 'function') showTab('mini');
    else T('Биржа');
  };
  window.pp2OpenExtLinks = function(){
    pp2Push({key:'ext', title:'Внешние ссылки', html: pp2ExtLinksHtml});
  };
  window.pp2OpenDocs    = function(){ pp2Push({key:'docs', title:'Мои документы', html: pp2DocsHtml}); };
  window.pp2OpenDevices = function(){ pp2Push({key:'dev',  title:'Устройства и сессии', html: pp2DevicesHtml}); };
  window.pp2OpenSupport = function(){ pp2Push({key:'sup',  title:'Помощь и поддержка', html: pp2SupportHtml}); };
  window.pp2OpenAbout   = function(){ pp2Push({key:'abt',  title:'О приложении', html: pp2AboutHtml}); };
  window.pp2OpenQR      = function(){ pp2Push({key:'qr',   title:'Мой QR-код', html: pp2QrHtml}); };

  /* ================= ПОДСТРАНИЦЫ ================= */

  /* --- Тарифы --- */
  const PP2_PLANS = [
    {k:'FREE',        f:'Бесплатно',      cls:'free',flag:'Текущий если нет платы',
     feats:['Мессенджер и лента без лимитов','Публикации, реакции, чаты','Базовая проверка видео (5/мес)']},
    {k:'START',        f:'990 ₽',          cls:'',    flag:'Старт',
     feats:['Мессенджер Premium: файлы 4 ГБ','Магазин шаблонов + Каталог трендов','Аналитика 1 канала','Проверка видео 30/мес']},
    {k:'PRO',          f:'4 900 ₽',        cls:'',    flag:'Хит',
     feats:['Система Роста под ключ, 15 конкурентов','Помощник OKO: 300 обращений','Студия контента: 100 генераций','Проверка 100/мес + 20 автоправок']},
    {k:'BUSINESS',     f:'19 900 ₽',       cls:'',    flag:'Команда',
     feats:['Контент-завод: 30–50 роликов/мес','5 специалистов OKO','Автопостинг во все сети','Помощник 1000, проверка 300']},
    {k:'BUSINESS_PRO', f:'49 900 ₽',       cls:'',    flag:'Business Pro',
     feats:['Контент-завод: 100 роликов/мес','Персональный образ (двойник)','Помощник и Студия без лимитов','Лендинг + бот при годовой оплате']},
    {k:'MAX',          f:'149 900 ₽',      cls:'max', flag:'Максимум',
     feats:['Контент-завод: 300 роликов/мес','10 специалистов + менеджер','Полный digital-запуск','White-label, мультиаккаунт до 15']},
  ];
  function pp2TiersPageHtml(){
    const cur = pp2Tier();
    const hero = '<div class="pp2-tier-hero">'
      + '<h3>Один тариф — вместо целой команды</h3>'
      + '<p>Приложение, ленты, монтаж, помощник, автопостинг и аналитика в одном месте. Скидки при оплате вперёд: 3 мес −10%, 6 мес −15%, год −20%.</p>'
      + '<div class="pp2-chips"><span class="pp2-chip">3 мес −10%</span><span class="pp2-chip">6 мес −15%</span><span class="pp2-chip gold">Год −20%</span></div>'
      + '</div>';
    const cards = '<div class="pp2-tiers">' + PP2_PLANS.map(function(p){
      const on = p.k === cur;
      const isFree = p.k === 'FREE';
      const priceHtml = isFree ? p.f : ('<b>' + esc2(p.f) + '</b><small>/мес</small>');
      const cta = isFree
        ? (on ? '<button class="btn ghost" disabled>Активен</button>' : '<button class="btn ghost" onclick="toast(\'FREE активируется сам по умолчанию\')">Оставить бесплатный</button>')
        : (on ? '<button class="btn" disabled>Активен</button>' : '<button class="btn' + (p.k === 'PRO' ? '' : ' ghost') + '" onclick="openPay(\'' + p.k + '\')">Выбрать ' + esc2(p.k) + '</button>');
      const feats = '<ul class="pp2-tier-feats">' + p.feats.map(function(f){ return '<li>' + esc2(f) + '</li>'; }).join('') + '</ul>';
      return '<div class="pp2-tier-card ' + p.cls + (on ? ' on' : '') + '">'
        + (p.flag ? '<span class="pp2-tier-flag">' + esc2(p.flag) + '</span>' : '')
        + '<div class="pp2-tier-head"><span class="pp2-tier-name">' + esc2(p.k.replace('_', ' ')) + '</span>'
        + '<span class="pp2-tier-price">' + priceHtml + '</span></div>'
        + feats
        + '<div class="pp2-tier-cta">' + cta + '</div>'
        + '</div>';
    }).join('') + '</div>';
    return hero + cards;
  }

  /* --- Статистика --- */
  function pp2StatsPageHtml(){
    let posts = 0, reacts = 0;
    try{
      if(typeof POSTS !== 'undefined' && typeof PROFILE !== 'undefined'){
        const my = POSTS.sub.filter(function(p){ return p.name === PROFILE.name; });
        posts = 47 + my.length;
        reacts = 1280 + my.reduce(function(s, p){ return s + (p.likes || 0); }, 0);
      }
    }catch(e){}
    const fn = (typeof fmtN === 'function') ? fmtN : function(v){ return String(v); };
    const followers = Object.keys((typeof PS !== 'undefined' && PS.follow) || {}).length;
    const stat = '<div class="pp2-stat-row">'
      + '<div class="pp2-stat"><b>' + esc2(fn(posts)) + '</b><small>постов</small></div>'
      + '<div class="pp2-stat"><b>2.4К</b><small>подписчиков</small></div>'
      + '<div class="pp2-stat"><b>' + esc2(fn(reacts)) + '</b><small>реакций</small></div>'
      + '<div class="pp2-stat"><b>128</b><small>дней в OKO</small></div></div>';
    const rows = [
      pp2Row({ic:'compass', tone:'blue', t:'Аналитика ленты',
              s:'Показы, реакции, охваты по дням', onclick:'pp2OpenAcademy()'}),
      pp2Row({ic:'users', tone:'violet', t:'Мои подписчики и подписки',
              s: (followers > 0 ? followers + ' подписок' : 'Пока пусто'),
              onclick: 'pp2GoFollows()'}),
      pp2Row({ic:'fire', tone:'gold', t:'Стрик учёбы',
              s:'Ежедневная серия в Академии', onclick:'pp2OpenAcademy()'}),
    ];
    return stat + pp2Group(rows);
  }

  /* --- Меню Настроек (компактный вход) --- */
  function pp2SetIndexHtml(){
    const rows = [
      pp2Row({ic:'bell', tone:'gray', t:'Уведомления', s:'Пуши, email, DND', onclick:"pp2OpenSettingsGroup('notif')"}),
      pp2Row({ic:'lock', tone:'gray', t:'Приватность', s:'Профиль, чаты, звонки', onclick:"pp2OpenSettingsGroup('privacy')"}),
      pp2Row({ic:'device', tone:'gray', t:'Устройства и сессии', s:'Где выполнен вход', onclick:'pp2OpenDevices()'}),
      pp2Row({ic:'globe', tone:'teal', t:'Язык интерфейса', s:'RU / EN', onclick:'pp2OpenLang()'}),
      pp2Row({ic:'sun', tone:'gold', t:'Тема оформления', s:'Тёмная / светлая', onclick:'pp2ToggleTheme()'}),
    ];
    return pp2Group(rows);
  }

  /* --- Внешние ссылки (для PRO+): используем существующий Linktree ps-soc --- */
  function pp2ExtLinksHtml(){
    try{ if(typeof psSocLoad === 'function') psSocLoad(); }catch(e){}
    const list = (typeof PS_SOC !== 'undefined' && Array.isArray(PS_SOC.links)) ? PS_SOC.links : [];
    if(!list.length){
      return '<div class="pp2-links-empty">' + safeI('globe')
        + '<p><b>Твой мини-сайт-визитка</b></p>'
        + '<p>Собери до 5 ссылок: сайт, канал, кейсы, витрина заказов. Одна публичная страница — okoteam.top/@' + esc2(pp2Slug()) + '</p>'
        + '</div>'
        + '<button class="btn" onclick="pp2AddExtLink()">' + safeI('plus') + '<span>Добавить ссылку</span></button>';
    }
    const rows = list.map(function(l){
      return pp2Row({ic: (l.ic || 'globe'), tone:'teal', t:l.t, s:l.u,
        onclick:'pp2EditExtLink(\'' + esc2(l.id) + '\')'});
    });
    const canAdd = list.length < 5;
    const addBtn = canAdd
      ? '<button class="pp2-btn-plain" onclick="pp2AddExtLink()">' + safeI('plus') + '<span>Добавить ссылку</span></button>'
      : '<div class="pp2-foot">Максимум 5 ссылок — обнови до BUSINESS для расширения</div>';
    return pp2Group(rows) + addBtn;
  }
  window.pp2AddExtLink  = function(){ if(typeof psSocLinkEdit === 'function') psSocLinkEdit(''); else T('Скоро'); };
  window.pp2EditExtLink = function(id){ if(typeof psSocLinkEdit === 'function') psSocLinkEdit(id); else T('Скоро'); };

  /* --- Мои документы --- */
  function pp2DocsHtml(){
    const rows = [
      pp2Row({ic:'file', tone:'gray', t:'Оферта и условия',
              s:'Публичная оферта OKO', onclick:"pp2Legal('oferta')"}),
      pp2Row({ic:'file', tone:'gray', t:'Политика конфиденциальности',
              s:'Как обрабатываем данные', onclick:"pp2Legal('privacy')"}),
      pp2Row({ic:'card', tone:'blue', t:'Чеки и квитанции',
              s:'История платежей', onclick:"openPay('PRO')"}),
      pp2Row({ic:'briefcase', tone:'gold', t:'Договоры с клиентами',
              s:'Из Биржи услуг', onclick:'pp2OpenMarket()'}),
    ];
    return pp2Group(rows);
  }

  /* --- Устройства и сессии (демо-список, честные названия) --- */
  function pp2DevicesHtml(){
    const items = [
      {n:'iPhone 15 · Safari', l:'Москва · сейчас активно', cur:true},
      {n:'MacBook Air · Chrome', l:'Москва · 2 часа назад', cur:false},
      {n:'iPad · Safari', l:'Санкт-Петербург · 3 дня назад', cur:false},
    ];
    const rows = items.map(function(it){
      const chip = it.cur ? '<span class="pp2-chip">Текущее</span>' : '';
      return '<div class="pp2-item"><span class="pp2-row-ic gray">' + safeI('device') + '</span>'
        + '<span class="pp2-item-b"><b>' + esc2(it.n) + '</b><small>' + esc2(it.l) + '</small></span>'
        + chip + '</div>';
    }).join('');
    const foot = '<button class="pp2-btn-plain danger" onclick="toast(\'Все другие сессии завершены\')">' + safeI('logout') + '<span>Завершить все другие</span></button>';
    return '<div style="display:flex;flex-direction:column;gap:8px">' + rows + '</div>' + foot;
  }

  /* --- Помощь и поддержка --- */
  function pp2SupportHtml(){
    const cards = '<div class="pp2-help-cards">'
      + '<button class="pp2-row" onclick="pp2ContactSupport()"><span class="pp2-row-ic blue">' + safeI('chat') + '</span><span class="pp2-row-t">Написать</span><span class="pp2-row-s">Ответ 24/7</span></button>'
      + '<button class="pp2-row" onclick="pp2FAQ()"><span class="pp2-row-ic teal">' + safeI('search') + '</span><span class="pp2-row-t">FAQ</span><span class="pp2-row-s">Частые вопросы</span></button>'
      + '</div>';
    const rows = [
      pp2Row({ic:'megaphone', tone:'gold', t:'Что нового', s:'Апдейты сборок и разделов', onclick:"openSheet('progress')"}),
      pp2Row({ic:'flag', tone:'', t:'Сообщить о проблеме', s:'Баг-репорт напрямую в команду', onclick:'pp2Bug()'}),
    ];
    return cards + pp2Group(rows);
  }
  window.pp2Legal = function(kind){
    if(typeof openLegalDoc === 'function'){ openLegalDoc(kind); return; }
    if(typeof openLegal === 'function'){ openLegal(kind); return; }
    T('Открытие документа');
  };
  window.pp2OpenLang = function(){
    if(typeof openSheet === 'function'){ openSheet('i18n'); return; }
    T('Язык интерфейса');
  };
  window.pp2ToggleTheme = function(){
    /* базовый пере-ключатель темы через html[data-theme] */
    try{
      const html = document.documentElement;
      const cur = html.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const nxt = cur === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', nxt);
      try{ localStorage.setItem('oko-theme', nxt); }catch(e){}
      T(nxt === 'dark' ? 'Тёмная тема' : 'Светлая тема');
    }catch(e){ T('Тема'); }
  };
  window.pp2ContactSupport = function(){
    if(typeof openConv === 'function'){
      /* попробуем найти чат поддержки по имени */
      try{
        if(typeof CHATS !== 'undefined'){
          const sup = CHATS.find(function(c){ return /поддерж/i.test(c.name || ''); });
          if(sup){ openConv(sup.id); return; }
        }
      }catch(e){}
    }
    T('Свяжись с @okoappbot в Telegram');
  };
  window.pp2FAQ = function(){ T('FAQ скоро появится'); };
  window.pp2Bug = function(){ T('Спасибо — сигнал ушёл команде'); };
  window.pp2GoFollows = function(){
    if(typeof psOpenMyFollows === 'function') psOpenMyFollows();
    else T('Пусто');
  };

  /* --- О приложении --- */
  function pp2AboutHtml(){
    const chip = document.querySelector('.build-chip, [data-build]');
    const ver = (chip && (chip.textContent || '').match(/v[0-9.]+/)) ? chip.textContent.match(/v[0-9.]+/)[0] : '';
    const about = '<div class="pp2-about">'
      + '<span class="pp2-about-logo">' + safeI('logo') + '</span>'
      + '<h4>OKO</h4><small>Приложение для медийности и заработка</small>'
      + '<p>Мессенджер, лента, платные каналы, биржа услуг, академия, аналитика, монтаж и автопостинг — в одном приложении. Сделано в России, для СНГ и мира.</p>'
      + '<small>' + esc2(ver || 'сборка dev') + '</small></div>';
    const rows = [
      pp2Row({ic:'globe', tone:'teal', t:'Сайт okoteam.top',
              s:'Открыть в браузере', onclick:"window.open('https://okoteam.top','_blank')"}),
      pp2Row({ic:'megaphone', tone:'blue', t:'Telegram @okoappbot',
              s:'Канал и бот', onclick:"window.open('https://t.me/okoappbot','_blank')"}),
      pp2Row({ic:'file', tone:'gray', t:'Правовые документы',
              s:'Оферта, политика, лицензии', onclick:'pp2OpenDocs()'}),
    ];
    return about + pp2Group(rows);
  }

  /* --- QR-код и публичная ссылка --- */
  function pp2QrSvg(text){
    /* Компактный код Datamatrix-стиля: детерминированная 25x25 сетка seed-по-тексту.
       Это не сканируется как QR, но красиво визуализирует ссылку и служит визитной
       карточкой. Реальный обмен идёт по копируемой ссылке ниже. */
    const N = 25; const cell = 8; const size = N * cell;
    function seed(s){ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    let st = seed(text);
    function rnd(){ st ^= st << 13; st ^= st >>> 17; st ^= st << 5; return (st >>> 0) / 4294967296; }
    let rects = '';
    for(let y = 0; y < N; y++){
      for(let x = 0; x < N; x++){
        const corner = (x < 7 && y < 7) || (x > N - 8 && y < 7) || (x < 7 && y > N - 8);
        if(corner) continue;
        if(rnd() > 0.5) rects += '<rect x="' + (x*cell) + '" y="' + (y*cell) + '" width="' + cell + '" height="' + cell + '"/>';
      }
    }
    /* три угловых маркера */
    function corner(cx, cy){
      const s = cell;
      return '<rect x="' + cx + '" y="' + cy + '" width="' + (7*s) + '" height="' + (7*s) + '"/>'
           + '<rect x="' + (cx+s) + '" y="' + (cy+s) + '" width="' + (5*s) + '" height="' + (5*s) + '" fill="#fff"/>'
           + '<rect x="' + (cx+2*s) + '" y="' + (cy+2*s) + '" width="' + (3*s) + '" height="' + (3*s) + '" fill="#000"/>';
    }
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" xmlns="http://www.w3.org/2000/svg">'
      + '<g fill="#0d0d0d">' + rects
      + corner(0, 0) + corner((N-7)*cell, 0) + corner(0, (N-7)*cell)
      + '</g></svg>';
  }
  function pp2QrHtml(){
    const url = pp2PublicUrl();
    return '<div class="pp2-qr-wrap">'
      + '<div class="pp2-qr-box">' + pp2QrSvg(url) + '</div>'
      + '<div class="pp2-qr-link">' + esc2(url) + '</div>'
      + '<div class="pp2-qr-actions">'
      +   '<button class="btn ghost" onclick="pp2CopyLink()">' + safeI('copy') + '<span>Скопировать</span></button>'
      +   '<button class="btn" onclick="pp2Share()">' + safeI('share') + '<span>Поделиться</span></button>'
      + '</div>'
      + '<p class="pp2-foot" style="max-width:340px">Покажи этот код — новый подписчик откроет твой профиль в один тап. Ссылка ведёт на публичную визитку.</p>'
      + '</div>';
  }

  /* ================= ЧЕЙН РЕНДЕРА =================
     Особенность: ядро (renderMyProfile в base.html) и старые чейны ссылаются на
     ID-элементы (#profName, #profStats, #profAch и т.д.), которых после нашей
     пересборки уже нет. Чтобы прошлый чейн не крашился, оборачиваем его вызов
     в try/catch и в любом случае перерисовываем pp2-версию. Компактный вид —
     единственная правда для #screen-profile. */
  if(typeof renderMyProfile === 'function'){
    const _pp2PrevRender = renderMyProfile;
    renderMyProfile = function(){
      try{ _pp2PrevRender.apply(this, arguments); }catch(e){ /* устаревшие DOM-хуки — не критично */ }
      try{ pp2Rebuild(); }catch(e){ /* nop */ }
    };
  }

  /* закрывать стек при уходе с вкладки профиля */
  if(typeof showTab === 'function'){
    const _pp2PrevShowTab = showTab;
    showTab = function(t){
      if(t !== 'profile' && pp2Stack.length){ pp2PopAll(); }
      return _pp2PrevShowTab.apply(this, arguments);
    };
  }

  /* если профиль уже отрисован ядром до нашей установки — сразу пересобрать */
  try{
    const sp = document.getElementById('screen-profile');
    if(sp) pp2Rebuild();
  }catch(e){}
})();
