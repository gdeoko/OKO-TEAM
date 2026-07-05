/* ══════════════════════════════════════════════════════════════
   МЕТАНОЙЯ · app.js · Этап 1 (фундамент)
   Демо-данные локальные — API подключается на следующих этапах.
   Файл работает при открытии index.html напрямую (file://).
   ══════════════════════════════════════════════════════════════ */

'use strict';

/* ───────── ДЕМО-ДАННЫЕ (заменятся на /api/v1/ на этапе 1-бэк) ───────── */

const DEMO = {
  stories: [
    { img: 'assets/img/avatars/ekaterina.jpg', name: 'Екатерина', badge: 'Педагог', seen: false },
    { icon: 'video',   name: 'Анонс урока', seen: false },
    { icon: 'sparkle', name: 'Мотивация', seen: false },
    { icon: 'trophy',  name: 'Успехи', seen: true },
    { icon: 'cross',   name: 'Цитата дня', seen: true },
  ],

  feed: [
    {
      type: 'lesson', label: 'Новый урок',
      coverImg: 'assets/img/covers/lesson-1.jpg',
      title: 'Урок 1. Кто такой Бог?',
      meta: 'Блок 1 «Знакомство с Богом» · 32 мин',
      progress: 40, likes: 24, comments: 7,
    },
    {
      type: 'announce', label: 'Объявление · Екатерина Павленко',
      title: 'Добро пожаловать в Метанойю!',
      text: 'Дорогие родители и дети! Я очень рада видеть каждого из вас в нашей школе. Начинаем наш путь вместе — с Богом!',
      likes: 56, comments: 12,
    },
    {
      type: 'quote', label: 'Цитата дня',
      title: '«Так да светит свет ваш пред людьми, чтобы они видели ваши добрые дела и прославляли Отца вашего Небесного»',
      ref: 'Мф. 5:16',
      likes: 41, comments: 3,
    },
    {
      type: 'event', label: 'Анонс созвона',
      title: 'Притча о блудном сыне',
      text: 'Живое занятие с Екатериной. Разбираем одну из самых глубоких притч.',
      meta: 'Завтра · 18:00 (МСК) · мест осталось: 8/50',
      likes: 18, comments: 5,
    },
  ],

  chats: [
    { img: 'assets/img/avatars/ekaterina.jpg', name: 'Екатерина Павленко', peda: true, pinned: true, last: 'Добро пожаловать в нашу школу!', time: '12:34', unread: 3 },
    { icon: 'comment', name: 'Общий чат школы', last: 'Иван: Спасибо большое!', time: '11:20', unread: 2 },
    { icon: 'users', name: 'Чат родителей', last: 'Мария: Кто идёт на созвон завтра?', time: '10:05', unread: 0 },
    { icon: 'gamepad', name: 'Чат учеников', last: 'Миша: Я собрал стих за 20 секунд!', time: '09:41', unread: 0 },
    { icon: 'headset', name: 'Поддержка', last: 'Чем можем помочь?', time: 'Вчера', unread: 0 },
  ],

  blocks: [
    {
      title: 'Блок 1 · «Знакомство с Богом»', range: 'уроки 1–12', award: '«Первооткрыватель»',
      lessons: [
        { n: 1, title: 'Кто такой Бог?', state: 'open', meta: 'Просмотрено · Тест · ДЗ' },
        { n: 2, title: 'Создание мира', state: 'locked' },
        { n: 3, title: 'Адам и Ева', state: 'locked' },
        { n: 4, title: 'Ноев ковчег', state: 'locked' },
      ],
    },
    {
      title: 'Блок 2 · «Герои веры»', range: 'уроки 13–24', award: '«Знаток героев»',
      lessons: [
        { n: 13, title: 'Авраам', state: 'locked' },
        { n: 14, title: 'Моисей', state: 'locked' },
      ],
    },
    {
      title: 'Блок 3 · «Жизнь Иисуса»', range: 'уроки 25–36', award: '«Ученик Христа»',
      lessons: [
        { n: 25, title: 'Рождество', state: 'locked' },
        { n: 26, title: 'Крещение', state: 'locked' },
      ],
    },
  ],

  children: [
    { img: 'assets/img/avatars/lion.jpg', name: 'Миша', age: 8, rank: 'Росточек · 220 XP', streak: 12 },
    { img: 'assets/img/avatars/star.jpg', name: 'Аня', age: 6, rank: 'Зёрнышко · 75 XP', streak: 4 },
  ],
};

/* ───────── УТИЛИТЫ ───────── */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('toast--show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('toast--show'), 2200);
}

/* ───────── НАВИГАЦИЯ ПО ТАБАМ ───────── */

function switchTab(tab) {
  $$('.nav__tab').forEach((b) => b.classList.toggle('nav__tab--active', b.dataset.tab === tab));
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === tab));
  window.scrollTo({ top: 0 });
}

function initNav() {
  $$('.nav__tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const isActive = btn.classList.contains('nav__tab--active');
      if (isActive) {
        // Повторный тап на активный таб → прокрутка вверх (как в Instagram)
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        switchTab(btn.dataset.tab);
      }
    });
  });
}

/* ───────── РЕНДЕР: STORIES ───────── */

function renderStories() {
  $('#stories').innerHTML = DEMO.stories.map((s) => `
    <button class="story" data-story="${s.name}">
      <div class="story__ring ${s.seen ? 'story__ring--seen' : ''}">
        <div class="story__avatar">${s.img ? `<img src="${s.img}" alt="">` : ICON(s.icon, 26)}</div>
      </div>
      <div class="story__name">${s.name}</div>
      ${s.badge ? `<div class="story__badge">${ICON('dove', 9)} ${s.badge}</div>` : ''}
    </button>
  `).join('');
  $$('#stories .story').forEach((el, i) =>
    el.addEventListener('click', () => svOpen(i)));
}

/* ───────── РЕНДЕР: ЛЕНТА ───────── */

function feedCard(item, idx) {
  const actions = `
    <div class="feed-card__actions">
      <button data-act="like" data-post="${idx}">${ICON('heart', 16)} ${item.likes}</button>
      <button data-act="comment" data-post="${idx}">${ICON('comment', 16)} ${item.comments}</button>
      <button data-act="share">${ICON('share', 16)} Поделиться</button>
    </div>`;

  if (item.type === 'quote') {
    return `<article class="card feed-card feed-card--quote">
      <div class="feed-card__type">${item.label}</div>
      <div class="feed-card__title">${item.title}</div>
      <div class="quote-ref">${item.ref}</div>
      ${actions}
    </article>`;
  }

  return `<article class="card feed-card">
    <div class="feed-card__type">${item.label}</div>
    ${item.coverImg ? `<div class="feed-card__cover feed-card__cover--img"><img src="${item.coverImg}" alt="" loading="lazy">${ICON('play', 44, 'feed-card__play')}</div>` : ''}
    <div class="feed-card__title">${item.title}</div>
    ${item.text ? `<p class="feed-card__text">${item.text}</p>` : ''}
    ${item.meta ? `<div class="feed-card__meta">${item.meta}</div>` : ''}
    ${item.progress ? `<div class="progress"><div class="progress__fill" style="width:${item.progress}%"></div></div>
      <div class="feed-card__meta">Пройдено ${item.progress}%</div>` : ''}
    ${item.type === 'lesson' ? `<button class="btn btn--primary" style="margin-top:12px" data-act="watch">Смотреть</button>` : ''}
    ${item.type === 'event' ? `<button class="btn btn--outline" style="margin-top:12px;width:auto" data-act="join">Записаться</button>` : ''}
    ${actions}
  </article>`;
}

function renderFeed() {
  $('#feed').innerHTML = DEMO.feed.map((item, i) => feedCard(item, i)).join('');
  $$('#feed [data-act="like"]').forEach((el) => {
    const id = Number(el.dataset.post);
    const base = DEMO.feed[id].likes;
    if (likes[id]) { el.classList.add('liked'); el.innerHTML = `${ICON('heart', 16)} ${base + 1}`; }
    el.addEventListener('click', () => toggleLike(id, el, base));
  });
  $$('#feed [data-act="comment"]').forEach((el) =>
    el.addEventListener('click', () => openComments(Number(el.dataset.post))));
  $$('#feed [data-act="share"]').forEach((el) =>
    el.addEventListener('click', () => toast('Поделиться — после публикации приложения')));
  $$('#feed [data-act="watch"], #feed [data-act="join"]').forEach((el) =>
    el.addEventListener('click', () => toast('Экран урока и запись на созвон — этап 4')));
}

/* ───────── РЕНДЕР: ЧАТЫ ───────── */

function renderChats() {
  $('#chatList').innerHTML = DEMO.chats.map((c) => `
    <button class="chat-item ${c.pinned ? 'chat-item--pinned' : ''}">
      <div class="chat-item__avatar">${c.img ? `<img src="${c.img}" alt="">` : ICON(c.icon, 24)}</div>
      <div class="chat-item__body">
        <div class="chat-item__name">${c.name} ${c.peda ? `<span class="chat-item__peda">${ICON('dove', 10)} Педагог</span>` : ''}</div>
        <div class="chat-item__last">${c.last}</div>
      </div>
      <div class="chat-item__side">
        <div class="chat-item__time">${c.time}</div>
        ${c.unread ? `<div class="chat-item__unread">${c.unread}</div>` : ''}
      </div>
    </button>
  `).join('');
  $$('#chatList .chat-item').forEach((el, i) =>
    el.addEventListener('click', () => openChatView(i)));

  const unreadTotal = DEMO.chats.reduce((s, c) => s + c.unread, 0);
  const badge = $('#chatsBadge');
  badge.textContent = unreadTotal;
  badge.style.display = unreadTotal ? '' : 'none';
}

/* ───────── РЕНДЕР: УРОКИ ───────── */

function renderLessons() {
  $('#lessons').innerHTML = DEMO.blocks.map((block) => `
    <div class="block-title">${block.title} <small>${block.range} · награда: ${block.award}</small></div>
    ${block.lessons.map((l) => `
      <button class="lesson-item lesson-item--${l.state}" data-state="${l.state}" data-n="${l.n}">
        <div class="lesson-item__num">${l.n}</div>
        <div class="lesson-item__body">
          <div class="lesson-item__title">${l.title}</div>
          ${l.meta ? `<div class="lesson-item__meta">${l.meta}</div>` : ''}
        </div>
        ${l.state === 'locked' ? `<div class="lesson-item__lock">${ICON('lock', 18)}</div>` : ''}
      </button>
    `).join('')}
  `).join('');

  $$('#lessons .lesson-item').forEach((el) => {
    el.addEventListener('click', () => {
      if (el.dataset.state === 'locked') {
        const prev = Number(el.dataset.n) - 1;
        toast(`Пройди урок ${prev} — тест и ДЗ, чтобы открыть`);
      } else {
        toast('Экран урока — этап 4');
      }
    });
  });
}

/* ───────── РЕНДЕР: ДЕТИ ───────── */

function renderChildren() {
  $('#children').innerHTML = DEMO.children.map((c) => `
    <button class="child-card">
      <div class="child-card__avatar"><img src="${c.img}" alt=""></div>
      <div>
        <div class="child-card__name">${c.name}, ${c.age} лет</div>
        <div class="child-card__rank">${c.rank}</div>
      </div>
      <div class="child-card__xp">${ICON('flame', 14)} ${c.streak} дн.</div>
    </button>
  `).join('');
  $$('#children .child-card').forEach((el, i) =>
    el.addEventListener('click', () => openChild(DEMO.children[i])));
}



/* ═════════════════ ЭТАП 2 ═════════════════ */

/* ───────── STORIES: КОНТЕНТ И ПЛЕЕР ───────── */

const STORIES_CONTENT = [
  { // Екатерина
    slides: [
      { img: 'assets/img/ekaterina-story.jpg', overlay: true,
        title: 'Добро пожаловать в Метанойю!',
        sub: 'Я Екатерина — педагог школы. Рада каждой семье. Начинаем путь вместе — с Богом.' },
      { bg: 'cream', title: 'Первый созвон — завтра в 18:00',
        sub: '«Притча о блудном сыне». Записаться можно на Главной.' },
    ],
  },
  { // Анонс урока
    slides: [
      { img: 'assets/img/covers/lesson-1.jpg', overlay: true,
        title: 'Урок 1 уже открыт', sub: '«Кто такой Бог?» — начни путешествие с первого шага.' },
    ],
  },
  { // Мотивация
    slides: [
      { bg: 'navy', title: '«Человеку возможно всё»',
        sub: 'Не говори: не могу, не знаю, не понимаю. Сегодня — лучший день, чтобы начать.' },
    ],
  },
  { // Успехи
    slides: [
      { bg: 'cream', title: 'Миша получил значок «Молниеносный»',
        sub: '10 из 10 в викторине на скорость. Так держать!' },
    ],
  },
  { // Цитата дня
    slides: [
      { bg: 'navy', title: '«Так да светит свет ваш пред людьми»', ref: 'Мф. 5:16' },
    ],
  },
];

const SV = { idx: 0, slide: 0, timer: null, DUR: 7000 };

function svRender() {
  const story = DEMO.stories[SV.idx];
  const content = STORIES_CONTENT[SV.idx];
  const s = content.slides[SV.slide];

  $('#svWho').innerHTML = `
    ${story.img ? `<img src="${story.img}" alt="">` : ICON(story.icon, 24)}
    <div><div>${story.name}</div>${story.badge ? `<small>${story.badge}</small>` : ''}</div>`;

  $('#svBars').innerHTML = content.slides.map((_, i) =>
    `<div class="sv__bar"><i style="${i < SV.slide ? 'width:100%' : ''}"></i></div>`).join('');

  const viewer = $('#storyViewer');
  viewer.classList.toggle('sv--cream', s.bg === 'cream');

  $('#svContent').innerHTML = `
    ${s.img ? `<img src="${s.img}" alt="">` : `<div class="sv__bg-${s.bg}"></div>`}
    <div class="sv-text ${s.img && s.overlay ? 'sv-text--overlay' : ''}">
      <div class="sv-text__title">${s.title}</div>
      ${s.sub ? `<div class="sv-text__sub">${s.sub}</div>` : ''}
      ${s.ref ? `<div class="sv-text__ref">${s.ref}</div>` : ''}
    </div>`;

  // анимация текущего бара
  const bar = $$('#svBars .sv__bar i')[SV.slide];
  requestAnimationFrame(() => {
    bar.style.transition = `width ${SV.DUR}ms linear`;
    bar.style.width = '100%';
  });

  clearTimeout(SV.timer);
  SV.timer = setTimeout(svNext, SV.DUR);
}

function svOpen(idx) {
  SV.idx = idx; SV.slide = 0;
  $('#storyViewer').hidden = false;
  document.body.style.overflow = 'hidden';
  svRender();
}

function svClose() {
  clearTimeout(SV.timer);
  $('#storyViewer').hidden = true;
  document.body.style.overflow = '';
}

function svNext() {
  const content = STORIES_CONTENT[SV.idx];
  if (SV.slide + 1 < content.slides.length) { SV.slide++; svRender(); }
  else if (SV.idx + 1 < STORIES_CONTENT.length) { SV.idx++; SV.slide = 0; svRender(); }
  else svClose();
}

function svPrev() {
  if (SV.slide > 0) { SV.slide--; svRender(); }
  else if (SV.idx > 0) { SV.idx--; SV.slide = 0; svRender(); }
  else svRender();
}

function initStoryViewer() {
  $('#svClose').addEventListener('click', svClose);
  $('#svNext').addEventListener('click', svNext);
  $('#svPrev').addEventListener('click', svPrev);
}

/* ───────── ЛАЙКИ (локально) ───────── */

const likes = JSON.parse(localStorage.getItem('mt_likes') || '{}');

function toggleLike(postId, btn, base) {
  likes[postId] = !likes[postId];
  localStorage.setItem('mt_likes', JSON.stringify(likes));
  btn.classList.toggle('liked', likes[postId]);
  btn.innerHTML = `${ICON('heart', 16)} ${base + (likes[postId] ? 1 : 0)}`;
}

/* ───────── КОММЕНТАРИИ (шторка) ───────── */

const DEMO_COMMENTS = {
  0: [
    { name: 'Екатерина Павленко', peda: true, img: 'assets/img/avatars/ekaterina.jpg', text: 'Смотрите вместе с детьми — в конце урока есть вопрос для семейного разговора.', time: '2 ч назад' },
    { name: 'Мария', text: 'Дочка посмотрела на одном дыхании, спасибо!', time: '1 ч назад' },
  ],
  1: [
    { name: 'Иван', text: 'Очень ждали запуска. Помощи Божией вашей школе!', time: '3 ч назад' },
    { name: 'Ольга', text: 'Записались всей семьёй.', time: '2 ч назад' },
  ],
  2: [ { name: 'Анна', text: 'Наш любимый стих.', time: 'вчера' } ],
  3: [ { name: 'Мария', text: 'Записались! Миша очень ждёт.', time: '30 мин назад' } ],
};
let userComments = JSON.parse(localStorage.getItem('mt_comments') || '{}');
let sheetPostId = null;

function openComments(postId) {
  sheetPostId = postId;
  renderComments();
  $('#sheetWrap').hidden = false;
}

function renderComments() {
  const list = [...(DEMO_COMMENTS[sheetPostId] || []), ...(userComments[sheetPostId] || [])];
  $('#sheetCount').textContent = `· ${list.length}`;
  $('#sheetList').innerHTML = list.length ? list.map((c) => `
    <div class="cmt">
      <div class="cmt__avatar">${c.img ? `<img src="${c.img}" alt="">` : c.name[0]}</div>
      <div>
        <div class="cmt__name">${c.name} ${c.peda ? ICON('dove', 11) : ''}</div>
        <div class="cmt__text">${c.text}</div>
        <div class="cmt__time">${c.time}</div>
      </div>
    </div>`).join('') : '<div class="empty-state">Пока нет комментариев — будь первым!</div>';
  $('#sheetList').scrollTop = $('#sheetList').scrollHeight;
}

function initComments() {
  $('#sheetBackdrop').addEventListener('click', () => { $('#sheetWrap').hidden = true; });
  const send = () => {
    const val = $('#sheetField').value.trim();
    if (!val) return;
    const name = localStorage.getItem('mt_name') || 'Вы';
    (userComments[sheetPostId] = userComments[sheetPostId] || []).push({ name, text: val, time: 'только что' });
    localStorage.setItem('mt_comments', JSON.stringify(userComments));
    $('#sheetField').value = '';
    renderComments();
  };
  $('#sheetSend').addEventListener('click', send);
  $('#sheetField').addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
}

/* ───────── ПОИСК ───────── */

const SEARCH_INDEX = [
  { t: 'lesson', title: 'Кто такой Бог?', meta: 'Урок 1 · Блок 1 · видео 32 мин', age: '5-7 7-10 10-14', theme: 'ВЗ' },
  { t: 'lesson', title: 'Создание мира', meta: 'Урок 2 · Блок 1 · скоро', age: '5-7 7-10', theme: 'ВЗ', locked: true },
  { t: 'lesson', title: 'Адам и Ева', meta: 'Урок 3 · Блок 1 · скоро', age: '5-7 7-10', theme: 'ВЗ', locked: true },
  { t: 'lesson', title: 'Ноев ковчег', meta: 'Урок 4 · Блок 1 · скоро', age: '5-7', theme: 'ВЗ', locked: true },
  { t: 'game', title: 'Собери стих', meta: 'Игра · пазл-слова · бесплатно', age: '5-7 7-10 10-14', theme: 'Молитва' },
  { t: 'game', title: 'Библейское мемори', meta: 'Игра · память · бесплатно', age: '5-7 7-10', theme: 'ВЗ' },
  { t: 'game', title: 'Викторина на скорость', meta: 'Игра · квиз · бесплатно', age: '7-10 10-14', theme: 'ВЗ НЗ' },
  { t: 'game', title: 'Кто это?', meta: 'Игра · угадайка · бесплатно', age: '7-10 10-14', theme: 'ВЗ НЗ' },
  { t: 'game', title: 'Хронология', meta: 'Игра · сортировка · бесплатно', age: '7-10 10-14', theme: 'ВЗ' },
  { t: 'game', title: 'Три в ряд: Дары Духа', meta: 'Игра · Метанойя+', age: '5-7 7-10 10-14', theme: 'НЗ', locked: true },
  { t: 'game', title: 'Давид и Голиаф', meta: 'Игра · Метанойя+', age: '7-10 10-14', theme: 'ВЗ', locked: true },
  { t: 'game', title: 'Ноев Ковчег', meta: 'Игра · Метанойя+', age: '5-7 7-10', theme: 'ВЗ', locked: true },
  { t: 'material', title: 'Раскраска «Сотворение мира»', meta: 'Материал · PDF · Метанойя+', age: '5-7', theme: 'ВЗ', locked: true },
  { t: 'material', title: 'Молитвы для самых маленьких', meta: 'Материал · карточки', age: '5-7', theme: 'Молитва' },
  { t: 'test', title: 'Тест к уроку 1', meta: 'Тест · 7 вопросов', age: '5-7 7-10 10-14', theme: 'ВЗ' },
];

const SR_ICON = { lesson: 'video', game: 'gamepad', material: 'book', test: 'check' };

function runSearch() {
  const q = $('#searchInput').value.trim().toLowerCase();
  const box = $('#searchResults');
  const empty = $('#searchEmpty');
  if (q.length < 2) {
    box.innerHTML = '';
    empty.style.display = '';
    empty.querySelector('p').textContent = 'Начни вводить запрос — найдём уроки, игры и материалы.';
    return;
  }
  const found = SEARCH_INDEX.filter((it) => it.title.toLowerCase().includes(q));
  empty.style.display = found.length ? 'none' : '';
  if (!found.length) empty.querySelector('p').textContent = `Ничего не найдено по запросу «${$('#searchInput').value}». Попробуй другие слова.`;
  box.innerHTML = found.map((it) => `
    <button class="sr">
      <div class="sr__icon sr__icon--${it.t}">${ICON(SR_ICON[it.t], 20)}</div>
      <div>
        <div class="sr__title">${it.title}</div>
        <div class="sr__meta">${it.meta}</div>
      </div>
      ${it.locked ? `<div class="sr__lock">${ICON('lock', 16)}</div>` : ''}
    </button>`).join('');
  $$('#searchResults .sr').forEach((el) =>
    el.addEventListener('click', () => toast('Переход к контенту — по мере готовности разделов')));
}

/* ───────── ДЕТСКИЙ ПРОФИЛЬ И PIN ───────── */

const CHILD_BADGES = [
  { icon: 'trophy',  name: 'Первооткрыватель', earned: true },
  { icon: 'flame',   name: 'Верный ученик · 7 дней', earned: true },
  { icon: 'star',    name: 'Молниеносный', earned: true },
  { icon: 'comment', name: 'Общительный', earned: true },
  { icon: 'book',    name: 'Книжный червь', earned: false },
  { icon: 'gamepad', name: 'Игроман', earned: false },
  { icon: 'check',   name: 'Снайпер', earned: false },
  { icon: 'church',  name: 'Архитектор веры', earned: false },
  { icon: 'cross',   name: 'Ученик Христа', earned: false },
];

function openChild(c) {
  $('#childAvatar').src = c.img;
  $('#childName').textContent = `${c.name}, ${c.age} лет`;
  $('#childRank').textContent = c.rank;
  $('#childStreak').textContent = c.streak;
  $('#childBadges').innerHTML = CHILD_BADGES.map((b) => `
    <div class="badge-card ${b.earned ? '' : 'badge-card--locked'}">
      <div class="badge-card__icon">${b.earned ? ICON(b.icon, 22) : ICON('lock', 18)}</div>
      <div class="badge-card__name">${b.name}</div>
    </div>`).join('');
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'child'));
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
}

let pinBuf = '';
function initPin() {
  const pad = $('#pinPad');
  pad.innerHTML = [1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k) =>
    k === '' ? '<span></span>' : `<button data-key="${k}">${k}</button>`).join('');
  pad.addEventListener('click', (e) => {
    const key = e.target.dataset?.key;
    if (key === undefined) return;
    if (key === '⌫') pinBuf = pinBuf.slice(0, -1);
    else if (pinBuf.length < 4) pinBuf += key;
    $$('#pinDots i').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length));
    if (pinBuf.length === 4) {
      if (pinBuf === '1234') {
        $('#pinModal').hidden = true;
        pinBuf = '';
        $$('#pinDots i').forEach((d) => d.classList.remove('on'));
        $('#nav').style.display = '';
        switchTab('profile');
        toast('Вы в профиле родителя');
      } else {
        const dots = $('#pinDots');
        dots.classList.add('shake');
        setTimeout(() => { dots.classList.remove('shake'); pinBuf = '';
          $$('#pinDots i').forEach((d) => d.classList.remove('on')); }, 350);
      }
    }
  });
  $('#pinCancel').addEventListener('click', () => { $('#pinModal').hidden = true; pinBuf = ''; $$('#pinDots i').forEach((d) => d.classList.remove('on')); });
  $('#childBack').addEventListener('click', () => { $('#pinModal').hidden = false; });
}


/* ───────── ЭКРАН ПЕРЕПИСКИ (этап 3, начало) ───────── */

const STICKERS = [
  'pray:assets/svg/stickers/burning-candle.svg',
  'heart:assets/svg/stickers/winged-heart.svg',
  'sun:assets/svg/stickers/smiling-sun.svg',
  'bell:assets/svg/stickers/bell-ring.svg',
  'sparkles:assets/svg/stickers/sparkles.svg',
  'flame:assets/svg/stickers/faith-flame.svg',
].map((s) => { const [key, url] = s.split(':'); return { key, url }; });

const CHAT_MSGS = {
  0: { readonly: true, pinned: 'Правила школы: доброта, уважение, поддержка. Пишем с любовью!',
    msgs: [
      { who: 'Екатерина', img: 'assets/img/avatars/ekaterina.jpg', text: 'Мир вашему дому, дорогие семьи! Здесь я буду делиться новостями школы и отвечать на вопросы.', time: '10:02' },
      { who: 'Екатерина', img: 'assets/img/avatars/ekaterina.jpg', text: 'Добро пожаловать в нашу школу!', time: '12:34' },
    ] },
  1: { pinned: 'Знакомимся: напишите, из какого вы города!',
    msgs: [
      { who: 'Иван', text: 'Здравствуйте! Мы из Самары, двое детей — 7 и 10 лет.', time: '11:02' },
      { who: 'Мария', text: 'А мы из Гатчины! Очень рады школе.', time: '11:10' },
      { who: 'Иван', text: 'Спасибо большое!', time: '11:20' },
    ] },
  2: { msgs: [
      { who: 'Мария', text: 'Кто идёт на созвон завтра?', time: '10:05' },
      { who: 'Ольга', text: 'Мы записались, дочка ждёт очень.', time: '10:12' },
    ] },
  3: { msgs: [
      { who: 'Миша', text: 'Я собрал стих за 20 секунд!', time: '09:41' },
      { who: 'Аня', sticker: 'assets/svg/stickers/sparkles.svg', time: '09:43' },
    ] },
  4: { msgs: [
      { who: 'Поддержка', text: 'Здравствуйте! Чем можем помочь? Отвечаем в течение дня, подписчикам Метанойя+ — в течение часа.', time: 'вчера' },
    ] },
};
let cvChatId = null;
let myMsgs = JSON.parse(localStorage.getItem('mt_msgs') || '{}');

function msgHtml(m, mine) {
  return `<div class="msg ${mine ? 'msg--mine' : 'msg--their'}">
    ${!mine && m.who ? `<div class="msg__name" style="color:${nameColor(m.who)}">${m.who}</div>` : ''}
    ${m.sticker
      ? `<img class="msg__sticker" src="${m.sticker}" alt="стикер">`
      : `<div class="msg__bubble">${m.text}</div>`}
    <div class="msg__meta">${m.time}${mine ? ICON('check', 11) : ''}</div>
  </div>`;
}

function nameColor(name) {
  const palette = ['#C97064', '#7AAED4', '#7BC67A', '#D4974A', '#9B7AD4'];
  let hsum = 0;
  for (const ch of name) hsum += ch.charCodeAt(0);
  return palette[hsum % palette.length];
}

function renderChatMsgs() {
  const data = CHAT_MSGS[cvChatId] || { msgs: [] };
  const mine = myMsgs[cvChatId] || [];
  $('#cvMsgs').innerHTML =
    data.msgs.map((m) => msgHtml(m, false)).join('') +
    mine.map((m) => msgHtml(m, true)).join('');
  $('#cvMsgs').scrollTop = $('#cvMsgs').scrollHeight;
}

function openChatView(i) {
  cvChatId = i;
  const c = DEMO.chats[i];
  const data = CHAT_MSGS[i] || {};
  $('#cvAvatar').innerHTML = c.img ? `<img src="${c.img}" alt="">` : ICON(c.icon, 20);
  $('#cvName').textContent = c.name;
  $('#cvStatus').textContent = c.peda ? 'онлайн' : '234 участника, 12 онлайн';
  $('#cvPinned').hidden = !data.pinned;
  if (data.pinned) $('#cvPinnedText').textContent = data.pinned;
  $('#cvReadonly').hidden = !data.readonly;
  $('#cvInputRow').style.display = data.readonly ? 'none' : '';
  $('#cvStickers').hidden = true;
  renderChatMsgs();
  // прочитано
  if (c.unread) { c.unread = 0; renderChats(); }
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'chatview'));
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
}

function cvSendText() {
  const val = $('#cvField').value.trim();
  if (!val) return;
  (myMsgs[cvChatId] = myMsgs[cvChatId] || []).push({ text: val, time: 'только что' });
  localStorage.setItem('mt_msgs', JSON.stringify(myMsgs));
  $('#cvField').value = '';
  renderChatMsgs();
}

function initChatView() {
  $('#cvBack').addEventListener('click', () => {
    $('#nav').style.display = '';
    switchTab('chats');
  });
  $('#cvSend').addEventListener('click', cvSendText);
  $('#cvField').addEventListener('keydown', (e) => { if (e.key === 'Enter') cvSendText(); });
  $('#cvStickerBtn').addEventListener('click', () => {
    const panel = $('#cvStickers');
    if (panel.hidden) {
      panel.innerHTML = STICKERS.map((s) =>
        `<button data-sticker="${s.url}"><img src="${s.url}" alt="${s.key}"></button>`).join('');
      panel.hidden = false;
      $$('#cvStickers [data-sticker]').forEach((b) =>
        b.addEventListener('click', () => {
          (myMsgs[cvChatId] = myMsgs[cvChatId] || []).push({ sticker: b.dataset.sticker, time: 'только что' });
          localStorage.setItem('mt_msgs', JSON.stringify(myMsgs));
          panel.hidden = true;
          renderChatMsgs();
        }));
    } else panel.hidden = true;
  });
}

/* ───────── УВЕДОМЛЕНИЯ ───────── */

const NOTIFS = [
  { icon: 'video',  title: 'Новый урок доступен', text: '«Кто такой Бог?» — начни первым', time: '2 ч назад' },
  { icon: 'trophy', title: 'Миша получил значок «Молниеносный»', text: '10 из 10 в викторине на скорость', time: '5 ч назад' },
  { icon: 'dove',   title: 'Сообщение от Екатерины', text: 'Добро пожаловать в нашу школу!', time: 'вчера' },
  { icon: 'clock',  title: 'Созвон завтра в 18:00', text: '«Притча о блудном сыне» — вы записаны', time: 'вчера' },
];

function initNotifs() {
  const read = localStorage.getItem('mt_notif_read') === '1';
  if (read) { $('#bellBadge').style.display = 'none'; }
  $('#bellBtn').addEventListener('click', () => {
    $('#notifList').innerHTML = NOTIFS.map((n, i) => `
      <div class="nf ${!read && i < 3 ? 'nf--new' : ''}">
        <div class="nf__icon">${ICON(n.icon, 18)}</div>
        <div>
          <div class="nf__title">${n.title}</div>
          <div class="nf__text">${n.text}</div>
          <div class="nf__time">${n.time}</div>
        </div>
      </div>`).join('');
    $('#notifPanel').hidden = false;
  });
  $('#notifBack').addEventListener('click', () => { $('#notifPanel').hidden = true; });
  $('#notifReadAll').addEventListener('click', () => {
    localStorage.setItem('mt_notif_read', '1');
    $('#bellBadge').style.display = 'none';
    $$('#notifList .nf').forEach((el) => el.classList.remove('nf--new'));
    toast('Все уведомления прочитаны');
  });
}

/* ───────── PULL-TO-REFRESH И БЕСКОНЕЧНАЯ ЛЕНТА ───────── */

const EXTRA_FEED = [
  { type: 'chapter', label: 'Новая глава книги «Метанойя»', title: 'Глава 1. Начало пути',
    text: 'Литературная версия первого урока — читайте всей семьёй.', likes: 12, comments: 2 },
  { type: 'achievement', label: 'Достижение', title: 'Аня получила значок «Первооткрыватель»',
    text: 'Первый пройденный урок — начало большого пути!', likes: 31, comments: 4 },
  { type: 'quote', label: 'Цитата дня · вчера',
    title: '«Начало мудрости — страх Господень»', ref: 'Притч. 1:7', likes: 27, comments: 1 },
  { type: 'lesson', label: 'Скоро', coverImg: 'assets/img/covers/lesson-4.jpg',
    title: 'Урок 4. Ноев ковчег', meta: 'Блок 1 · откроется после урока 3', likes: 9, comments: 0 },
];
let feedPage = 0;

function initInfiniteFeed() {
  const more = $('#feedMore');
  const io = new IntersectionObserver((entries) => {
    if (!entries[0].isIntersecting) return;
    if (feedPage >= 1) {
      more.textContent = 'Вы посмотрели всю ленту. Возвращайтесь за новым!';
      io.disconnect();
      return;
    }
    feedPage++;
    const start = DEMO.feed.length;
    DEMO.feed.push(...EXTRA_FEED);
    renderFeed();
  }, { rootMargin: '200px' });
  io.observe(more);
}

function initPTR() {
  let startY = null, pulling = false;
  const screens = document.body;
  screens.addEventListener('touchstart', (e) => {
    if (window.scrollY === 0 && $('[data-screen="home"]').classList.contains('screen--active')) {
      startY = e.touches[0].clientY;
    } else startY = null;
  }, { passive: true });
  screens.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    if (e.touches[0].clientY - startY > 80 && !pulling) {
      pulling = true;
      $('#ptr').classList.add('ptr--show');
    }
  }, { passive: true });
  screens.addEventListener('touchend', () => {
    if (pulling) {
      setTimeout(() => {
        $('#ptr').classList.remove('ptr--show');
        toast('Лента обновлена');
      }, 900);
      pulling = false;
    }
    startY = null;
  });
}

/* ───────── ОНБОРДИНГ И АВТОРИЗАЦИЯ (демо-режим, API — при деплое) ───────── */

function showApp(name) {
  $('#onboarding').hidden = true;
  $('#auth').hidden = true;
  if (name) {
    localStorage.setItem('mt_name', name);
  }
  const stored = localStorage.getItem('mt_name') || 'Даниэль';
  $('#avatarBtn').textContent = stored[0].toUpperCase();
  $('.profile-head__avatar').textContent = stored[0].toUpperCase();
  $('.profile-head__name').textContent = stored;
}

function initOnboarding() {
  const onb = $('#onboarding');
  const track = $('#onbTrack');
  const dots = $$('#onbDots .onb__dot');

  track.addEventListener('scroll', () => {
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    dots.forEach((d, i) => d.classList.toggle('onb__dot--on', i === idx));
  }, { passive: true });

  const finish = () => {
    localStorage.setItem('mt_onb', '1');
    onb.hidden = true;
    if (!localStorage.getItem('mt_auth')) $('#auth').hidden = false;
  };
  $('#onbSkip').addEventListener('click', finish);
  $('#onbStart').addEventListener('click', finish);
}

function markInvalid(input, bad) {
  input.classList.toggle('field--error', bad);
  return bad;
}

function initAuth() {
  // переключение вкладок Вход / Регистрация
  $$('[data-authtab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('[data-authtab]').forEach((t) => t.classList.toggle('auth__tab--on', t === tab));
      $('#loginForm').hidden = tab.dataset.authtab !== 'login';
      $('#registerForm').hidden = tab.dataset.authtab !== 'register';
    });
  });

  // роль «Ученик 12+» скрывает блок ребёнка
  $('#registerForm [name="role"]').addEventListener('change', (e) => {
    $('[data-childblock]').style.display = e.target.value === 'parent' ? '' : 'none';
  });

  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const bad = markInvalid(f.email, !f.email.value.includes('@'))
              | markInvalid(f.password, f.password.value.length < 1);
    if (bad) return toast('Проверьте email и пароль');
    localStorage.setItem('mt_auth', '1');
    showApp(f.email.value.split('@')[0]);
    toast('С возвращением!');
  });

  $('#registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const passOk = f.password.value.length >= 8
      && /\d/.test(f.password.value) && /[a-zA-Zа-яА-Я]/.test(f.password.value);
    const bad = markInvalid(f.name, f.name.value.trim().length < 2)
              | markInvalid(f.email, !f.email.value.includes('@'))
              | markInvalid(f.password, !passOk);
    if (bad) return toast('Проверьте выделенные поля');
    localStorage.setItem('mt_auth', '1');
    showApp(f.name.value.trim());
    toast('Добро пожаловать в Метанойю!');
  });

  $('#guestBtn').addEventListener('click', () => {
    localStorage.setItem('mt_auth', '1');
    showApp(null);
    toast('Демо-режим: все данные тестовые');
  });
  $('#forgotBtn').addEventListener('click', () => toast('Восстановление пароля — после подключения почты'));
  $$('.auth__oauth').forEach((b) =>
    b.addEventListener('click', () => toast('Вход через ' + (b.dataset.oauth === 'google' ? 'Google' : 'Telegram') + ' — подключается на этапе 1-бэк')));
}

/* ───────── ОБРАТНЫЙ ОТСЧЁТ ДО СОЗВОНА (демо) ───────── */

let callMinutes = 135; // 2ч 15мин
function tickCountdown() {
  const h = Math.floor(callMinutes / 60);
  const m = callMinutes % 60;
  $('#callCountdown').textContent = h > 0 ? `${h}ч ${m}мин` : `${m}мин`;
  if (callMinutes > 0) callMinutes -= 1;
}

/* ───────── SERVICE WORKER (только по http/https, не file://) ───────── */

function initSW() {
  if (location.protocol.startsWith('http') && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

/* ───────── СТАРТ ───────── */

function hydrateIcons() {
  $$('[data-icon]').forEach((el) => {
    el.innerHTML = ICON(el.dataset.icon, Number(el.dataset.size || 20));
  });
}

document.addEventListener('DOMContentLoaded', () => {
  hydrateIcons();
  renderStories();
  renderFeed();
  renderChats();
  renderLessons();
  renderChildren();
  initNav();
  initSW();

  tickCountdown();
  setInterval(tickCountdown, 60_000);

  $('#dailyVerseBtn').addEventListener('click', () => toast('Ежедневный стих — этап 5'));
  $('#avatarBtn').addEventListener('click', () => switchTab('profile'));
  $('#addChildBtn').addEventListener('click', () => toast('Добавление ребёнка — этап 2'));
  $$('.menu-item').forEach((el) =>
    el.addEventListener('click', () => toast('Раздел в разработке')));
  let searchTimer = null;
  $('#searchInput').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, 300); // debounce по ТЗ
  });
  $$('.filter-chip').forEach((el) =>
    el.addEventListener('click', () => el.classList.toggle('filter-chip--active')));
  $$('.tab-chip').forEach((el) =>
    el.addEventListener('click', () => {
      $$('.tab-chip').forEach((c) => c.classList.remove('tab-chip--active'));
      el.classList.add('tab-chip--active');
    }));

  initOnboarding();
  initAuth();
  initStoryViewer();
  initComments();
  initPin();
  initChatView();
  initNotifs();
  initInfiniteFeed();
  initPTR();
  showApp(null);

  // Splash → онбординг (первый запуск) → вход → приложение
  setTimeout(() => {
    $('#splash').classList.add('splash--hide');
    if (!localStorage.getItem('mt_onb')) {
      $('#onboarding').hidden = false;
      hydrateIcons();
    } else if (!localStorage.getItem('mt_auth')) {
      $('#auth').hidden = false;
      hydrateIcons();
    }
  }, 2400);
});
