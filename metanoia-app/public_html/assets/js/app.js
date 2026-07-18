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
    { img: 'assets/img/stories/anons.jpg', icon: 'video',   name: 'Анонс урока', seen: false },
    { img: 'assets/img/stories/motivation.jpg', icon: 'sparkle', name: 'Мотивация', seen: false },
    { img: 'assets/img/stories/success.jpg', icon: 'trophy',  name: 'Успехи', seen: true },
    { img: 'assets/img/stories/quote.jpg', icon: 'cross',   name: 'Цитата дня', seen: true },
  ],

  feed: [
    {
      type: 'lesson', label: 'Новый урок',
      coverImg: 'assets/img/chapters/ch1.jpg',
      title: 'Урок 1. Пророчества; почему Господь родился на земле',
      meta: 'Глава 1 «Жизнь Господа» · видеоурок',
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
      img: 'assets/img/verse-quote.jpg',
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
      title: 'Глава 1 · Новый Завет «Жизнь Господа»', range: 'уроки 1–35', award: '«Ученик Господа»',
      lessons: [
        { n: 1, cn: 1, title: "Пророчества; почему Господь родился на земле", state: 'open' },
        { n: 2, cn: 2, title: "Рождение Иоанна Крестителя", state: 'locked' },
        { n: 3, cn: 3, title: "Рождение Господа", state: 'locked' },
        { n: 4, cn: 4, title: "Поклонение волхвов", state: 'locked' },
        { n: 5, cn: 5, title: "Отрок Иисус поражает учёных", state: 'locked' },
        { n: 6, cn: 6, title: "Крещение Господа", state: 'locked' },
        { n: 7, cn: 7, title: "Первые ученики", state: 'locked' },
        { n: 8, cn: 8, title: "Чудо в Кане (превращение воды в вино)", state: 'locked' },
        { n: 9, cn: 9, title: "Купальня Вифезда", state: 'locked' },
        { n: 10, cn: 10, title: "Избрание двенадцати апостолов", state: 'locked' },
        { n: 11, cn: 11, title: "Нагорная проповедь: как молиться", state: 'locked' },
        { n: 12, cn: 12, title: "Нагорная проповедь: не заботьтесь ни о чём", state: 'locked' },
        { n: 13, cn: 13, title: "Нагорная проповедь: дом, построенный на камне", state: 'locked' },
        { n: 14, cn: 14, title: "Господь исцеляет прокажённого и слугу", state: 'locked' },
        { n: 15, cn: 15, title: "Вдова из Наина", state: 'locked' },
        { n: 16, cn: 16, title: "Притча о сеятеле", state: 'locked' },
        { n: 17, cn: 17, title: "Воскрешение дочери Иаира", state: 'locked' },
        { n: 18, cn: 18, title: "Насыщение 5000 людей", state: 'locked' },
        { n: 19, cn: 19, title: "Иисус идёт по морю", state: 'locked' },
        { n: 20, cn: 20, title: "Добрый самарянин", state: 'locked' },
        { n: 21, cn: 21, title: "Марфа и Мария", state: 'locked' },
        { n: 22, cn: 22, title: "Человек, родившийся слепым", state: 'locked' },
        { n: 23, cn: 23, title: "Воскрешение Лазаря", state: 'locked' },
        { n: 24, cn: 24, title: "Книжники и фарисеи", state: 'locked' },
        { n: 25, cn: 25, title: "Малые дети", state: 'locked' },
        { n: 26, cn: 26, title: "Притча о великом ужине", state: 'locked' },
        { n: 27, cn: 27, title: "Притча о блудном сыне", state: 'locked' },
        { n: 28, cn: 28, title: "Притча о виноградной лозе", state: 'locked' },
        { n: 29, cn: 29, title: "Вербное воскресенье: торжественный вход", state: 'locked' },
        { n: 30, cn: 30, title: "Заговор Иуды; Тайная вечеря", state: 'locked' },
        { n: 31, cn: 31, title: "Молитва в Гефсимании; предательство и арест", state: 'locked' },
        { n: 32, cn: 32, title: "Суд и распятие Иисуса", state: 'locked' },
        { n: 33, cn: 33, title: "Пасха (Воскресение)", state: 'locked' },
        { n: 34, cn: 34, title: "Путь в Эммаус; Вознесение", state: 'locked' },
        { n: 35, cn: 35, title: "Что совершил Господь", state: 'locked' },
        { n: 'I', title: 'Проверка знаний · Глава 1', state: 'locked', exam: true },
      ],
    },
    {
      title: 'Глава 2 · Ветхий Завет', range: 'уроки 1–35', award: '«Странник небес»',
      lessons: [
        { n: 36, cn: 1, title: "Первый день творения", state: 'locked' },
        { n: 37, cn: 2, title: "Второй день творения", state: 'locked' },
        { n: 38, cn: 3, title: "Третий день творения", state: 'locked' },
        { n: 39, cn: 4, title: "Четвёртый день творения", state: 'locked' },
        { n: 40, cn: 5, title: "Пятый день творения", state: 'locked' },
        { n: 41, cn: 6, title: "Шестой день творения", state: 'locked' },
        { n: 42, cn: 7, title: "Седьмой день творения", state: 'locked' },
        { n: 43, cn: 8, title: "Введение в жизнь после смерти", state: 'locked' },
        { n: 44, cn: 9, title: "Люди не могут умереть", state: 'locked' },
        { n: 45, cn: 10, title: "Мир духов", state: 'locked' },
        { n: 46, cn: 11, title: "Каков ты на самом деле", state: 'locked' },
        { n: 47, cn: 12, title: "Пути в рай и в ад", state: 'locked' },
        { n: 48, cn: 13, title: "Младенцы в раю", state: 'locked' },
        { n: 49, cn: 14, title: "Дети в раю (часть 1)", state: 'locked' },
        { n: 50, cn: 15, title: "Дети в раю (часть 2)", state: 'locked' },
        { n: 51, cn: 16, title: "Брак на небесах", state: 'locked' },
        { n: 52, cn: 17, title: "Господь в раю", state: 'locked' },
        { n: 53, cn: 18, title: "Жизнь в трёх небесах", state: 'locked' },
        { n: 54, cn: 19, title: "Работа, которую выполняют ангелы", state: 'locked' },
        { n: 55, cn: 20, title: "Один день из жизни ангела", state: 'locked' },
        { n: 56, cn: 21, title: "Ад", state: 'locked' },
        { n: 57, cn: 22, title: "Мы свободны выбирать рай или ад", state: 'locked' },
        { n: 58, cn: 23, title: "Как мы попадаем в рай", state: 'locked' },
        { n: 59, cn: 24, title: "Иоанн видит Господа среди золотых светильников", state: 'locked' },
        { n: 60, cn: 25, title: "Престол на небесах", state: 'locked' },
        { n: 61, cn: 26, title: "Свиток с семью печатями", state: 'locked' },
        { n: 62, cn: 27, title: "Великое множество в белых одеждах", state: 'locked' },
        { n: 63, cn: 28, title: "Ангел с маленькой книжкой", state: 'locked' },
        { n: 64, cn: 29, title: "Жена, облечённая в солнце; Михаил и дракон", state: 'locked' },
        { n: 65, cn: 30, title: "Два зверя", state: 'locked' },
        { n: 66, cn: 31, title: "Господь на белом коне", state: 'locked' },
        { n: 67, cn: 32, title: "Белый престол и Книга жизни", state: 'locked' },
        { n: 68, cn: 33, title: "Святой город, Новый Иерусалим", state: 'locked' },
        { n: 69, cn: 34, title: "Река жизни; Древо жизни", state: 'locked' },
        { n: 70, cn: 35, title: "Отправление двенадцати учеников", state: 'locked' },
        { n: 'II', title: 'Проверка знаний · Глава 2', state: 'locked', exam: true },
      ],
    },
    {
      title: 'Глава 3 · История народа Божьего — Израиль', range: 'уроки 1–35', award: '«Знаток героев» + сертификат года',
      lessons: [
        { n: 71, cn: 1, title: "Призвание Аврама", state: 'locked' },
        { n: 72, cn: 2, title: "Авраам и ангелы; рождение Исаака", state: 'locked' },
        { n: 73, cn: 3, title: "Жертвоприношение Исаака", state: 'locked' },
        { n: 74, cn: 4, title: "Исаак женится на Ревекке", state: 'locked' },
        { n: 75, cn: 5, title: "Рождение Иакова и Исава; похищение благословения", state: 'locked' },
        { n: 76, cn: 6, title: "Сон Иакова", state: 'locked' },
        { n: 77, cn: 7, title: "Иаков женится на Лии и Рахили", state: 'locked' },
        { n: 78, cn: 8, title: "Возвращение Иакова", state: 'locked' },
        { n: 79, cn: 9, title: "Иосиф и его братья", state: 'locked' },
        { n: 80, cn: 10, title: "Иосиф в Египте", state: 'locked' },
        { n: 81, cn: 11, title: "Иосиф принимает свою семью", state: 'locked' },
        { n: 82, cn: 12, title: "Рождение Моисея", state: 'locked' },
        { n: 83, cn: 13, title: "Моисей и неопалимая купина", state: 'locked' },
        { n: 84, cn: 14, title: "Десять казней и Пасха", state: 'locked' },
        { n: 85, cn: 15, title: "Переход через Красное море; манна", state: 'locked' },
        { n: 86, cn: 16, title: "Моисей ударяет в скалу", state: 'locked' },
        { n: 87, cn: 17, title: "Десять заповедей; золотой телец", state: 'locked' },
        { n: 88, cn: 18, title: "Скиния и Ковчег Завета", state: 'locked' },
        { n: 89, cn: 19, title: "Иисус Навин ведёт битву; Аарон и Ор", state: 'locked' },
        { n: 90, cn: 20, title: "Переход через Иордан; Иерихон", state: 'locked' },
        { n: 91, cn: 21, title: "Битва при Гаваоне; раздел земли", state: 'locked' },
        { n: 92, cn: 22, title: "Рождение и призвание Самуила", state: 'locked' },
        { n: 93, cn: 23, title: "Саул помазан; правление и отвержение", state: 'locked' },
        { n: 94, cn: 24, title: "Давид помазан; Давид побеждает Голиафа", state: 'locked' },
        { n: 95, cn: 25, title: "Давид и Ионафан", state: 'locked' },
        { n: 96, cn: 26, title: "Давид как царь", state: 'locked' },
        { n: 97, cn: 27, title: "Мудрость Соломона и Храм", state: 'locked' },
        { n: 98, cn: 28, title: "Илия возвещает засуху; помощь вдове", state: 'locked' },
        { n: 99, cn: 29, title: "Илия и пророки Ваала", state: 'locked' },
        { n: 100, cn: 30, title: "Призвание Елисея; Илия восходит на небо", state: 'locked' },
        { n: 101, cn: 31, title: "Елисей и масло вдовы; воскрешение сына", state: 'locked' },
        { n: 102, cn: 32, title: "Исцеление проказы Неемана", state: 'locked' },
        { n: 103, cn: 33, title: "Даниил во рву львином", state: 'locked' },
        { n: 104, cn: 34, title: "Иона", state: 'locked' },
        { n: 105, cn: 35, title: "Почему Господь должен был прийти", state: 'locked' },
        { n: 'III', title: 'Проверка знаний · Глава 3', state: 'locked', exam: true },
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
      } else if (btn.dataset.tab === 'games') {
        openGamesHub();
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
      <div class="feed-card__quote-badge"><span data-icon="sparkle" data-size="14"></span> ${item.label}</div>
      <div class="feed-card__quote-img"><img src="${item.img || 'assets/img/quote-bg.jpg'}" alt="" loading="lazy"></div>
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
    el.addEventListener('click', () => toast('Поделиться можно будет после запуска')));
  $$('#feed [data-act="watch"]').forEach((el) =>
    el.addEventListener('click', () => openLesson(1)));
  $$('#feed [data-act="join"]').forEach((el) =>
    el.addEventListener('click', () => toast('Запись на созвон скоро откроется')));
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
  $('#lessons').innerHTML = DEMO.blocks.map((block, bi) => `
    <div class="block-title">${block.title} <small>${block.range} · награда: ${block.award}</small></div>
    ${block.lessons.map((l) => `
      <button class="lesson-item lesson-item--${l.state} lesson-item--b${bi + 1} ${l.exam ? 'lesson-item--exam' : ''} ${l.img ? 'lesson-item--img' : ''}" data-state="${l.state}" data-n="${l.n}" data-bi="${bi}">
        ${l.img
          ? `<div class="lesson-item__thumb"><img src="${l.img}" alt="" loading="lazy"><span class="lesson-item__badge">${l.cn || l.n}</span></div>`
          : `<div class="lesson-item__num">${l.exam ? ICON('crown', 20) : (l.cn || l.n)}</div>`}
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
      const n = Number(el.dataset.n);
      if (Number.isNaN(n)) {
        // экзамен блока — определяем индекс блока по кнопке
        const bi = Number(el.dataset.bi);
        openExam(Number.isNaN(bi) ? 0 : bi);
        return;
      }
      openLesson(n);
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
        title: 'Урок 1 уже открыт', sub: '«Пророчества» — начни путешествие с первого урока.' },
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
  { t: 'lesson', title: 'Пророчества; почему Господь родился на земле', meta: 'Урок 1 · Глава 1 «Жизнь Господа»', age: '5-7 7-10 10-14', theme: 'НЗ' },
  { t: 'lesson', title: 'Рождение Иоанна Крестителя', meta: 'Урок 2 · Глава 1 «Жизнь Господа»', age: '5-7 7-10', theme: 'НЗ' },
  { t: 'lesson', title: 'Рождение Господа', meta: 'Урок 3 · Глава 1 «Жизнь Господа»', age: '5-7 7-10', theme: 'НЗ' },
  { t: 'lesson', title: 'Призвание Аврама', meta: 'Урок 1 · Глава 3 «Израиль»', age: '5-7', theme: 'ВЗ' },
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
    el.addEventListener('click', () => {
      if (el.querySelector('.sr__title')?.textContent === 'Собери стих') openVerse('easy');
      else toast('Скоро откроется');
    }));
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
  const xpMatch = (c.rank.match(/(\d+)\s*XP/) || [])[1];
  renderRanks(xpMatch ? Number(xpMatch) : 0);
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
  'candle:assets/img/stickers/candle.jpg',
  'heart:assets/img/stickers/heart.jpg',
  'sun:assets/img/stickers/sun.jpg',
  'bell:assets/img/stickers/bell.jpg',
  'sparkles:assets/img/stickers/sparkles.jpg',
  'flame:assets/img/stickers/flame.jpg',
].map((s) => { const i = s.indexOf(':'); return { key: s.slice(0, i), url: s.slice(i + 1) }; });

const CHAT_MSGS = {
  0: { readonly: true, pinned: 'Правила школы: доброта, уважение, поддержка. Пишем с любовью!',
    msgs: [
      { who: 'Екатерина', img: 'assets/img/avatars/ekaterina.jpg', text: 'Мир вашему дому, дорогие семьи! Здесь я буду делиться новостями школы и отвечать на вопросы.', time: '10:02' },
      { who: 'Екатерина', img: 'assets/img/avatars/ekaterina.jpg', voice: { dur: 23 }, time: '11:15' },
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
      { who: 'Аня', sticker: 'assets/img/stickers/sparkles.jpg', time: '09:43' },
    ] },
  4: { msgs: [
      { who: 'Поддержка', text: 'Здравствуйте! Чем можем помочь? Отвечаем в течение дня, подписчикам Метанойя+ — в течение часа.', time: 'вчера' },
    ] },
};
let cvChatId = null;
let myMsgs = JSON.parse(localStorage.getItem('mt_msgs2') || '{}');

function msgHtml(m, mine, key) {
  return `<div class="msg ${mine ? 'msg--mine' : 'msg--their'}" data-key="${key}" data-mine="${mine ? 1 : 0}" data-text="${(m.text || 'стикер').replace(/"/g, '&quot;')}">
    ${!mine && m.who ? `<div class="msg__name" style="color:${nameColor(m.who)}">${m.who}</div>` : ''}
    ${m.sticker ? `<img class="msg__sticker" src="${m.sticker}" alt="" onerror="this.closest(&quot;.msg&quot;).style.display=&quot;none&quot;">`
      : m.voice ? `<div class="msg__voice" data-voice="${m.voice.url || ''}">
          <button class="msg__voice-play">${ICON('play', 15)}</button>
          <div class="msg__wave">${waveBars(m.voice.dur + 7)}</div>
          <span class="msg__voice-dur">${fmtDur(m.voice.dur)}</span></div>`
      : m.circle ? `<div class="msg__voice" data-voice="${m.circle.url || ''}">
          <button class="msg__voice-play">${ICON('circle', 15)}</button>
          <div class="msg__wave">${waveBars(m.circle.dur + 3)}</div>
          <span class="msg__voice-dur">видео ${fmtDur(m.circle.dur)}</span></div>`
      : m.photo ? `<img class="msg__photo" src="${m.photo}" alt="фото">`
      : m.file ? `<div class="msg__file"><div class="msg__file-icon">${ICON('file', 18)}</div>
          <div><div class="msg__file-name">${m.file.name}</div>
          <div class="msg__file-size">${m.file.size}</div></div></div>`
      : `<div class="msg__bubble">${m.quote ? `<div class="msg__quote">${m.quote}</div>` : ''}${m.text}</div>`}
    ${reactsHtml(cvChatId, key)}
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
    data.msgs.map((m, i) => msgHtml(m, false, 'd' + i)).join('') +
    mine.map((m, i) => msgHtml(m, true, 'm' + i)).join('');
  bindLongPress();
  $$('#cvMsgs .msg__voice-play').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const url = b.closest('.msg__voice').dataset.voice;
    if (url) new Audio(url).play().catch(() => toast('Не удалось воспроизвести'));
    else toast('Демо-запись: реальный звук — на телефоне (нужен доступ к микрофону)');
  }));
  $('#cvMsgs').scrollTop = $('#cvMsgs').scrollHeight;
}

function openChatView(i) {
  cvChatId = i;
  const c = DEMO.chats[i];
  const data = CHAT_MSGS[i] || {};
  $('#cvAvatar').innerHTML = c.img ? `<img src="${c.img}" alt="">` : ICON(c.icon, 20);
  $('#cvName').textContent = c.name;
  $('#cvStatus').textContent = c.peda ? 'онлайн' : c.dm ? 'родитель · был(а) недавно' : '234 участника, 12 онлайн';
  $('#cvPinned').hidden = !data.pinned;
  if (data.pinned) $('#cvPinnedText').textContent = data.pinned;
  $('#cvReadonly').hidden = !data.readonly;
  $('#cvInputRow').style.display = data.readonly ? 'none' : '';
  $('#cvStickers').hidden = true;
  renderChatMsgs();
  // прочитано
  if (c.unread) { c.unread = 0; renderChats(); }
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'chatview'));
  document.body.classList.add('in-chat');
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
}

function cvSendText() {
  const val = $('#cvField').value.trim();
  if (!val) return;
  const msg = { text: val, time: 'только что' };
  if (replyTo) { msg.quote = replyTo.text; replyTo = null; $('#cvReplyBar')?.remove(); }
  (myMsgs[cvChatId] = myMsgs[cvChatId] || []).push(msg);
  localStorage.setItem('mt_msgs2', JSON.stringify(myMsgs));
  $('#cvField').value = '';
  renderChatMsgs();
}

function initChatView() {
  $('#cvBack').addEventListener('click', () => {
    document.body.classList.remove('in-chat');
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
          localStorage.setItem('mt_msgs2', JSON.stringify(myMsgs));
          panel.hidden = true;
          renderChatMsgs();
        }));
    } else panel.hidden = true;
  });
}

/* ───────── УВЕДОМЛЕНИЯ ───────── */

const NOTIFS = [
  { icon: 'video',  title: 'Новый урок доступен', text: '«Пророчества; почему Господь родился на земле» — начни первым', time: '2 ч назад' },
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
  { type: 'chapter', label: 'Новая глава книги «Метанойя»', title: 'Глава 1 · Жизнь Господа',
    text: 'Уроки главы в виде книги — читайте всей семьёй.', likes: 12, comments: 2 },
  { type: 'achievement', label: 'Достижение', title: 'Аня получила значок «Первооткрыватель»',
    text: 'Первый пройденный урок — начало большого пути!', likes: 31, comments: 4 },
  { type: 'quote', label: 'Цитата дня · вчера', img: 'assets/img/quote-bg.jpg',
    title: '«Начало мудрости — страх Господень»', ref: 'Притч. 1:7', likes: 27, comments: 1 },
  { type: 'lesson', label: 'Скоро', coverImg: 'assets/img/chapters/ch1.jpg',
    title: 'Урок 4. Поклонение волхвов', meta: 'Глава 1 «Жизнь Господа» · скоро', likes: 9, comments: 0 },
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


/* ───────── РЕАКЦИИ И ДЕЙСТВИЯ С СООБЩЕНИЯМИ ───────── */

const REACTIONS = ['heart', 'flame', 'sun', 'sparkles', 'candle', 'bell'];
let reactions = JSON.parse(localStorage.getItem('mt_react2') || '{}'); // {chatId: {msgKey: [keys]}}
let maTarget = null;   // { key, mine, text }
let replyTo = null;    // { who, text }

function reactsHtml(chatId, msgKey) {
  const r = (reactions[chatId] || {})[msgKey] || [];
  if (!r.length) return '';
  const counts = {};
  r.forEach((k) => { counts[k] = (counts[k] || 0) + 1; });
  return `<div class="msg__reacts">${Object.entries(counts).map(([k, n]) =>
    `<span class="msg__react msg__react--mine"><img src="assets/img/stickers/${k}.jpg" alt="">${n}</span>`).join('')}</div>`;
}

function openMsgActions(key, mine, text) {
  maTarget = { key, mine, text };
  $('#maReactions').innerHTML = REACTIONS.map((k) =>
    `<button data-react="${k}"><img src="assets/img/stickers/${k}.jpg" alt="${k}"></button>`).join('');
  $$('#maReactions [data-react]').forEach((b) =>
    b.addEventListener('click', () => {
      const store = (reactions[cvChatId] = reactions[cvChatId] || {});
      const list = (store[maTarget.key] = store[maTarget.key] || []);
      const at = list.indexOf(b.dataset.react);
      if (at >= 0) list.splice(at, 1); else list.push(b.dataset.react);
      localStorage.setItem('mt_react2', JSON.stringify(reactions));
      $('#msgActions').hidden = true;
      renderChatMsgs();
    }));
  $('#maDelete').hidden = !mine;
  $('#msgActions').hidden = false;
}

function initMsgActions() {
  $('#maBackdrop').addEventListener('click', () => { $('#msgActions').hidden = true; });
  $('#maReply').addEventListener('click', () => {
    replyTo = { text: maTarget.text.slice(0, 80) };
    $('#msgActions').hidden = true;
    showReplyBar();
    $('#cvField').focus();
  });
  $('#maCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(maTarget.text); } catch {}
    $('#msgActions').hidden = true;
    toast('Скопировано');
  });
  $('#maDelete').addEventListener('click', () => {
    const idx = Number(maTarget.key.slice(1));
    (myMsgs[cvChatId] || []).splice(idx, 1);
    localStorage.setItem('mt_msgs2', JSON.stringify(myMsgs));
    $('#msgActions').hidden = true;
    renderChatMsgs();
    toast('Сообщение удалено');
  });
}

function showReplyBar() {
  let bar = $('#cvReplyBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'cvReplyBar';
    bar.className = 'cv-reply';
    $('#cvInputRow').before(bar);
  }
  bar.innerHTML = `<span data-icon-inline></span><span><b>Ответ:</b> ${replyTo.text}</span>
    <button id="cvReplyCancel">${ICON('close', 16)}</button>`;
  $('#cvReplyCancel').addEventListener('click', () => { replyTo = null; bar.remove(); });
}

/* долгий тап на сообщении */
function bindLongPress() {
  $$('#cvMsgs .msg').forEach((el) => {
    let timer = null;
    const start = () => {
      timer = setTimeout(() => {
        openMsgActions(el.dataset.key, el.dataset.mine === '1', el.dataset.text || '');
      }, 450);
    };
    const cancel = () => clearTimeout(timer);
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  });
}

/* ───────── ЭКРАН УРОКА (динамический, все 36 уроков) ───────── */

let currentLesson = 1;

// Мета урока (заголовок, блок, картинка) из DEMO.blocks по номеру
function lessonMeta(n) {
  for (let bi = 0; bi < DEMO.blocks.length; bi++) {
    const block = DEMO.blocks[bi];
    const l = block.lessons.find((x) => x.n === n);
    if (l) return { l, block, bi, blockTitle: block.title.replace(/^Глава \d+ · /, '').replace(/[«»]/g, '') };
  }
  return null;
}

function lessonContent(n) {
  const map = (typeof window !== 'undefined' && window.LESSONS) ? window.LESSONS : {};
  return map[n] || null;
}

function lessonStateKey(n) { return 'mt_lesson_' + n; }
function getLessonState(n) {
  return JSON.parse(localStorage.getItem(lessonStateKey(n)) || '{"watch":false,"test":false,"hw":false,"done":false}');
}
function saveLessonState(n, st) { localStorage.setItem(lessonStateKey(n), JSON.stringify(st)); }

function openLesson(n) {
  currentLesson = Number(n) || 1;
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'lesson'));
  $('#nav').style.display = 'none';
  renderLesson(currentLesson);
  window.scrollTo({ top: 0 });
}

function renderLesson(n) {
  const meta = lessonMeta(n);
  const c = lessonContent(n);
  const st = getLessonState(n);
  const body = $('#lessonBody');
  if (!meta) { body.innerHTML = '<div class="card">Урок не найден.</div>'; return; }
  const title = meta.l.title;
  const cn = meta.l.cn || n;
  const cover = meta.l.img || `assets/img/chapters/ch${meta.bi + 1}.jpg`;

  // Контент ещё не подгружен (для новых уроков — мягкий фолбэк)
  const story = c && c.story ? c.story : ['Материал этого урока скоро появится здесь. А пока можно пройти другие уроки и игры.'];
  const verse = c && c.verse ? c.verse : { text: 'Бог есть любовь, и пребывающий в любви пребывает в Боге', ref: '1 Ин 4:16' };
  const quiz = c && c.quiz ? c.quiz : [];
  const questions = c && c.questions ? c.questions : [];

  body.innerHTML = `
    <div class="feed-card__cover feed-card__cover--img lesson-cover"><img src="${cover}" alt=""></div>
    <h1 class="screen-title" style="margin-top:14px">Урок ${cn}. ${title}</h1>
    <div class="feed-card__meta">${meta.block.title} · для всех возрастов</div>

    <div class="lesson-steps" id="lessonSteps">
      <div class="lstep ${st.watch ? 'done' : ''}" data-step="watch"><i></i>Просмотрено</div>
      <div class="lstep ${st.test ? 'done' : ''}" data-step="test"><i></i>Тест</div>
      <div class="lstep ${st.hw ? 'done' : ''}" data-step="hw"><i></i>ДЗ</div>
    </div>

    <div class="video-stub" id="videoStub" style="background-image:linear-gradient(to top,rgba(20,35,47,.9),rgba(20,35,47,.35)),url('${cover}')">
      <div class="video-stub__play">${ICON('play', 26)}</div>
      <div class="video-stub__cap"><b>Видеоурок</b><span>Появится здесь после записи · пока проходите материалы и тест</span></div>
    </div>

    ${c && c.intro ? `<div class="card lesson-text lesson-intro"><p>${c.intro}</p></div>` : ''}

    <h2 class="section-title">Цитата из Писания</h2>
    <article class="card feed-card feed-card--quote">
      <div class="feed-card__title">«${verse.text}»</div>
      <div class="quote-ref">${verse.ref}</div>
    </article>

    <h2 class="section-title">Детский пересказ</h2>
    <div class="card lesson-text">${story.map((p) => `<p>${p}</p>`).join('')}</div>

    ${c && c.golden ? `<div class="card lesson-golden">${ICON('sparkle', 18)}<span>${c.golden}</span></div>` : ''}

    ${questions.length ? `<h2 class="section-title">Вопросы для беседы</h2>
      <div class="card lesson-text lesson-questions">${questions.map((q, i) => `<div class="lq"><span class="lq__n">${i + 1}</span>${q}</div>`).join('')}</div>` : ''}

    ${quiz.length ? `<h2 class="section-title">Проверь себя</h2>
      <div class="card" id="lessonTest">
        ${quiz.map((q, qi) => `<div class="q" data-q="${qi}">
          <div class="q__text">${qi + 1}. ${q.q}</div>
          ${q.opts.map((o, oi) => `<label class="q__opt"><input type="radio" name="q${qi}" value="${oi}"> ${o}</label>`).join('')}
        </div>`).join('')}
        <button class="btn btn--primary" id="testCheck" style="width:100%">Проверить ответы</button>
        <div class="test-result" id="testResult" hidden></div>
      </div>` : ''}

    ${c && c.prayer ? `<h2 class="section-title">Помолимся вместе</h2>
      <div class="card lesson-prayer">${ICON('dove', 18)}<p>${c.prayer}</p></div>` : ''}

    <h2 class="section-title">Домашнее задание</h2>
    <div class="card lesson-text">
      <p>${c && c.parentNote ? c.parentNote : 'Нарисуй вместе с родителями то, что тебе запомнилось из урока, и отправь рисунок Екатерине.'}</p>
      <button class="btn btn--outline" id="hwUpload" style="margin-top:10px">Загрузить фото рисунка</button>
    </div>

    <button class="btn btn--primary lesson-done" id="lessonDone">${st.done ? 'Урок пройден ✓' : 'Отметить урок пройденным'}</button>
  `;

  hydrateIcons();
  wireLesson(n, quiz);
}

function wireLesson(n, quiz) {
  const st = getLessonState(n);
  const syncSteps = () => {
    $$('#lessonSteps .lstep').forEach((el) => el.classList.toggle('done', !!getLessonState(n)[el.dataset.step]));
  };

  $('#videoStub')?.addEventListener('click', () => {
    const s = getLessonState(n);
    if (!s.watch) { s.watch = true; saveLessonState(n, s); syncSteps(); toast('+20 XP за просмотр (видео появится позже)'); }
    else toast('Видео появится после записи уроков');
  });

  $('#testCheck')?.addEventListener('click', () => {
    if (!quiz.length) return;
    let correct = 0, answered = 0;
    quiz.forEach((q, qi) => {
      const sel = document.querySelector(`input[name="q${qi}"]:checked`);
      $$(`input[name="q${qi}"]`).forEach((i) => i.closest('.q__opt').classList.remove('right', 'wrong'));
      if (!sel) return;
      answered++;
      const label = sel.closest('.q__opt');
      if (Number(sel.value) === q.answer) { correct++; label.classList.add('right'); }
      else label.classList.add('wrong');
    });
    if (answered < quiz.length) return toast('Ответь на все вопросы');
    const res = $('#testResult');
    res.hidden = false;
    const pct = Math.round(correct / quiz.length * 100);
    if (pct >= 70) {
      res.className = 'test-result pass';
      res.textContent = `Отлично! ${correct} из ${quiz.length} (${pct}%) — тест пройден, +15 XP${pct === 100 ? ' и +30 XP за 100%!' : ''}`;
      const s = getLessonState(n);
      if (!s.test) { s.test = true; saveLessonState(n, s); syncSteps(); }
      if (pct === 100 && window.MAGIC) { const r = $('#testCheck').getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top); }
    } else {
      res.className = 'test-result fail';
      res.textContent = `${correct} из ${quiz.length} — нужно 70%. Перечитай пересказ и попробуй ещё раз.`;
    }
  });

  $('#hwUpload')?.addEventListener('click', () => {
    const s = getLessonState(n); s.hw = true; saveLessonState(n, s); syncSteps();
    toast('Загрузка рисунка скоро откроется — шаг засчитан');
  });

  $('#lessonDone')?.addEventListener('click', () => {
    const s = getLessonState(n); s.done = true; saveLessonState(n, s); syncSteps();
    $('#lessonDone').textContent = 'Урок пройден ✓';
    // открыть следующий урок в списке
    const meta = lessonMeta(n);
    if (meta) {
      const idx = meta.block.lessons.findIndex((x) => x.n === n);
      const next = meta.block.lessons[idx + 1];
      if (next && next.state === 'locked') { next.state = 'open'; renderLessons(); }
    }
    const nextTitle = nextLessonTitle(n);
    if (window.MAGIC) MAGIC.rewardModal({
      icon: 'trophy', title: 'Урок пройден!',
      subtitle: nextTitle ? `Молодец! Открыт следующий урок: «${nextTitle}».` : 'Молодец! Ты прошёл урок.',
      xp: 20,
    });
    else toast('+20 XP!');
  });
}

function nextLessonTitle(n) {
  const meta = lessonMeta(n);
  if (!meta) return '';
  const idx = meta.block.lessons.findIndex((x) => x.n === n);
  const next = meta.block.lessons[idx + 1];
  return next && !next.exam ? next.title : '';
}

function unlockAllLessons() {
  // Витрина: открываем все уроки и проверки для просмотра (прогресс-геймификация — на бэкенде)
  DEMO.blocks.forEach((b) => b.lessons.forEach((l) => { if (l.state === 'locked') l.state = 'open'; }));
}

function initLesson() {
  $('#lessonBack').addEventListener('click', () => {
    $('#nav').style.display = '';
    switchTab('lessons');
  });
  $('#examBack')?.addEventListener('click', () => {
    $('#nav').style.display = '';
    switchTab('lessons');
  });
}

/* ───────── ПРОВЕРКА ЗНАНИЙ (экзамен блока) ───────── */

let examState = null; // { bi, questions:[{q,opts,answer,from}], answers:{} }

function openExam(bi) {
  const block = DEMO.blocks[bi];
  if (!block) return;
  // Собираем по одному вопросу из каждого урока блока (там, где есть контент)
  const questions = [];
  block.lessons.forEach((l) => {
    if (l.exam) return;
    const c = lessonContent(l.n);
    if (c && c.quiz && c.quiz.length) {
      // детерминированный выбор вопроса (по номеру урока)
      const q = c.quiz[l.n % c.quiz.length];
      questions.push({ q: q.q, opts: q.opts, answer: q.answer, from: l.n, title: l.title });
    }
  });
  examState = { bi, questions, answers: {} };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'exam'));
  $('#nav').style.display = 'none';
  renderExam();
  window.scrollTo({ top: 0 });
}

function renderExam() {
  const { bi, questions } = examState;
  const block = DEMO.blocks[bi];
  const total = questions.length;
  if (total === 0) {
    $('#examBody').innerHTML = `
      <div class="exam-head"><div class="exam-head__ic">${ICON('crown', 26)}</div>
        <div><div class="exam-head__title">Проверка знаний</div>
          <div class="exam-head__sub">${block.title.replace(/^Глава \d+ · /, '')}</div></div></div>
      <div class="card lesson-text"><p>Материал этой главы готовит педагог школы. Как только уроки главы будут наполнены, здесь появится проверка знаний.</p></div>`;
    hydrateIcons();
    return;
  }
  $('#examBody').innerHTML = `
    <div class="exam-head">
      <div class="exam-head__ic">${ICON('crown', 26)}</div>
      <div>
        <div class="exam-head__title">Проверка знаний</div>
        <div class="exam-head__sub">${block.title.replace(/^Глава \d+ · /, '')} · ${total} вопросов · порог 70%</div>
      </div>
    </div>
    <div class="card" id="examQuiz">
      ${questions.map((q, qi) => `<div class="q" data-q="${qi}">
        <div class="q__text">${qi + 1}. ${q.q}</div>
        ${q.opts.map((o, oi) => `<label class="q__opt"><input type="radio" name="ex${qi}" value="${oi}"> ${o}</label>`).join('')}
      </div>`).join('')}
      <button class="btn btn--primary" id="examCheck" style="width:100%">Завершить проверку</button>
      <div class="test-result" id="examResult" hidden></div>
    </div>`;
  hydrateIcons();
  $('#examCheck').addEventListener('click', gradeExam);
}

function gradeExam() {
  const { bi, questions } = examState;
  let correct = 0, answered = 0;
  questions.forEach((q, qi) => {
    const sel = document.querySelector(`input[name="ex${qi}"]:checked`);
    $$(`input[name="ex${qi}"]`).forEach((i) => i.closest('.q__opt').classList.remove('right', 'wrong'));
    if (!sel) return;
    answered++;
    const label = sel.closest('.q__opt');
    if (Number(sel.value) === q.answer) { correct++; label.classList.add('right'); }
    else label.classList.add('wrong');
  });
  if (answered < questions.length) return toast('Ответь на все вопросы');
  const pct = Math.round(correct / questions.length * 100);
  const res = $('#examResult');
  res.hidden = false;
  const block = DEMO.blocks[bi];
  const award = block.award;
  if (pct >= 70) {
    res.className = 'test-result pass';
    res.textContent = `Поздравляем! ${correct} из ${questions.length} (${pct}%). Проверка блока пройдена — значок ${award} твой!`;
    localStorage.setItem('mt_exam_' + bi, JSON.stringify({ pct, ts: Date.now() }));
    if (window.MAGIC) {
      const r = $('#examCheck').getBoundingClientRect();
      MAGIC.celebrate(r.left + r.width / 2, r.top);
      setTimeout(() => MAGIC.rewardModal({
        icon: 'crown', title: 'Проверка блока пройдена!',
        subtitle: `Ты получил значок ${award}. Сертификат доступен в разделе «Сертификаты».`,
        xp: 50,
      }), 400);
    }
  } else {
    res.className = 'test-result fail';
    res.textContent = `${correct} из ${questions.length} (${pct}%) — нужно 70%. Повтори уроки блока и попробуй снова.`;
  }
}

/* ───────── ИГРА «ДИЛЕММА» (моральный выбор) ───────── */
function DIL() { return (typeof window !== 'undefined' && window.DILEMMAS) ? window.DILEMMAS : []; }
let dilState = { i: 0, answered: false };

function openDilemma() {
  if (!DIL().length) { toast('Игра скоро появится'); return; }
  dilState = { i: 0, answered: false };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'dilemma'));
  $('#nav').style.display = 'none';
  renderDilemma();
  window.scrollTo({ top: 0 });
}

function renderDilemma() {
  const d = DIL()[dilState.i];
  $('#dilemmaNum').textContent = dilState.i + 1;
  $('#dilemmaTotal').textContent = DIL().length;
  $('#dilemmaBody').innerHTML = `
    <div class="card dil-situation"><div class="dil-situation__t">${d.title}</div><p>${d.situation}</p></div>
    <div class="dil-opts" id="dilOpts">
      ${d.options.map((o, oi) => `<button class="dil-opt" data-oi="${oi}">${o.text}</button>`).join('')}
    </div>
    <div class="dil-feedback" id="dilFeedback" hidden></div>`;
  dilState.answered = false;
  $$('#dilOpts .dil-opt').forEach((el) => el.addEventListener('click', () => answerDilemma(Number(el.dataset.oi))));
}

function answerDilemma(oi) {
  if (dilState.answered) return;
  dilState.answered = true;
  const d = DIL()[dilState.i];
  const chosen = d.options[oi];
  $$('#dilOpts .dil-opt').forEach((el, i) => {
    el.disabled = true;
    if (d.options[i].good) el.classList.add('dil-opt--good');
    else if (i === oi) el.classList.add('dil-opt--bad');
  });
  const last = dilState.i >= DIL().length - 1;
  const fb = $('#dilFeedback');
  fb.hidden = false;
  fb.className = 'dil-feedback ' + (chosen.good ? 'dil-feedback--good' : 'dil-feedback--soft');
  fb.innerHTML = `
    <div class="dil-feedback__row">${ICON(chosen.good ? 'check' : 'heart', 18)}<span>${chosen.feedback}</span></div>
    <div class="dil-verse">«${d.verse.text}» <em>${d.verse.ref}</em></div>
    <button class="btn btn--primary" id="dilNext" style="width:100%;margin-top:12px">${last ? 'Завершить' : 'Следующая ситуация'}</button>`;
  if (chosen.good && window.MAGIC) { const r = fb.getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top); }
  $('#dilNext').addEventListener('click', () => {
    if (last) {
      if (window.MAGIC) MAGIC.rewardModal({ icon: 'heart', title: 'Ты прошёл все ситуации!', subtitle: 'Учиться выбирать добро — это тоже вера. Молодец!', xp: 25 });
      setTimeout(openGamesHub, 400);
    } else { dilState.i++; renderDilemma(); window.scrollTo({ top: 0 }); }
  });
}

/* ───────── ИГРА «БИБЛЕЙСКИЙ ДЕТЕКТИВ» ───────── */
function DET() { return (typeof window !== 'undefined' && window.DETECTIVE) ? window.DETECTIVE : []; }
let detState = { i: 0, clue: 1, score: 0, answered: false };

function openDetective() {
  if (!DET().length) { toast('Игра скоро появится'); return; }
  detState = { i: 0, clue: 1, score: 0, answered: false };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'detective'));
  $('#nav').style.display = 'none';
  renderDetective();
  window.scrollTo({ top: 0 });
}

function renderDetective() {
  const c = DET()[detState.i];
  $('#detNum').textContent = detState.i + 1;
  $('#detTotal').textContent = DET().length;
  $('#detScore').textContent = detState.score;
  $('#detBody').innerHTML = `
    <div class="det-clues">${c.clues.slice(0, detState.clue).map((cl, i) => `<div class="det-clue"><span class="det-clue__n">Улика ${i + 1}</span>${cl}</div>`).join('')}</div>
    ${detState.clue < c.clues.length ? `<button class="btn btn--outline" id="detMore" style="width:100%;margin-bottom:12px">Ещё улика (−5 очков)</button>` : ''}
    <div class="det-opts" id="detOpts">${c.options.map((o) => `<button class="det-opt" data-a="${o}">${o}</button>`).join('')}</div>
    <div class="det-reveal" id="detReveal" hidden></div>`;
  detState.answered = false;
  $('#detMore')?.addEventListener('click', () => { if (detState.clue < c.clues.length) { detState.clue++; renderDetective(); } });
  $$('#detOpts .det-opt').forEach((el) => el.addEventListener('click', () => answerDetective(el.dataset.a)));
}

function answerDetective(ans) {
  if (detState.answered) return;
  detState.answered = true;
  const c = DET()[detState.i];
  const right = ans === c.answer;
  $$('#detOpts .det-opt').forEach((b) => { b.disabled = true; if (b.dataset.a === c.answer) b.classList.add('det-opt--right'); else if (b.dataset.a === ans) b.classList.add('det-opt--wrong'); });
  if (right) { const gain = Math.max(5, 20 - (detState.clue - 1) * 5); detState.score += gain; $('#detScore').textContent = detState.score; }
  const last = detState.i >= DET().length - 1;
  const rv = $('#detReveal');
  rv.hidden = false;
  rv.className = 'det-reveal ' + (right ? 'det-reveal--ok' : 'det-reveal--no');
  rv.innerHTML = `<div class="det-reveal__t">${right ? 'Раскрыто!' : 'Верный ответ: ' + c.answer}</div><p>${c.reveal}</p>
    <button class="btn btn--primary" id="detNext" style="width:100%;margin-top:10px">${last ? 'Завершить' : 'Следующее дело'}</button>`;
  if (right && window.MAGIC) { const r = rv.getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top); }
  $('#detNext').addEventListener('click', () => {
    if (last) {
      if (window.MAGIC) MAGIC.rewardModal({ icon: 'search', title: 'Все дела раскрыты!', subtitle: `Ты настоящий знаток Писания — ${detState.score} очков!`, xp: detState.score });
      setTimeout(openGamesHub, 400);
    } else { detState.i++; detState.clue = 1; renderDetective(); window.scrollTo({ top: 0 }); }
  });
}

/* ───────── СЕМЕЙНЫЙ АЛТАРЬ (девоционалы) ───────── */
function DEV() { return (typeof window !== 'undefined' && window.DEVOTIONALS) ? window.DEVOTIONALS : []; }
let devState = { i: 0 };

function openDevotional() {
  if (!DEV().length) { toast('Девоционалы скоро появятся'); return; }
  // «сегодняшний» день детерминированно из сохранённого прогресса
  const saved = Number(localStorage.getItem('mt_dev_day') || '0');
  devState = { i: Math.min(Math.max(0, saved), DEV().length - 1) };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'devotional'));
  $('#nav').style.display = 'none';
  renderDevotional();
  window.scrollTo({ top: 0 });
}

function renderDevotional() {
  const d = DEV()[devState.i];
  const total = DEV().length;
  $('#devBody').innerHTML = `
    <div class="dev-head">
      <div class="dev-head__day">День ${d.day} из ${total}</div>
      <h1 class="dev-head__title">${d.title}</h1>
    </div>
    <article class="card feed-card feed-card--quote"><div class="feed-card__title">«${d.verse.text}»</div><div class="quote-ref">${d.verse.ref}</div></article>
    <h2 class="section-title">Мысль дня</h2>
    <div class="card lesson-text"><p>${d.thought}</p></div>
    ${d.action ? `<div class="card lesson-golden">${ICON('sparkle', 18)}<span>${d.action}</span></div>` : ''}
    <h2 class="section-title">Спросите за ужином</h2>
    <div class="card lesson-text"><p>${d.question}</p></div>
    <div class="card lesson-prayer">${ICON('dove', 18)}<p>${d.prayer}</p></div>
    <div class="dev-nav">
      <button class="btn btn--outline" id="devPrev" ${devState.i === 0 ? 'disabled' : ''}>← Вчера</button>
      <button class="btn btn--primary" id="devNext" ${devState.i >= total - 1 ? 'disabled' : ''}>Завтра →</button>
    </div>`;
  hydrateIcons();
  $('#devPrev')?.addEventListener('click', () => { if (devState.i > 0) { devState.i--; localStorage.setItem('mt_dev_day', devState.i); renderDevotional(); window.scrollTo({ top: 0 }); } });
  $('#devNext')?.addEventListener('click', () => { if (devState.i < total - 1) { devState.i++; localStorage.setItem('mt_dev_day', devState.i); renderDevotional(); window.scrollTo({ top: 0 }); } });
}

/* ───────── ПУЛ ВОПРОСОВ ИЗ УРОКОВ ───────── */
function quizPool() {
  const map = (typeof window !== 'undefined' && window.LESSONS) ? window.LESSONS : {};
  const pool = [];
  Object.keys(map).forEach((n) => {
    const c = map[n];
    if (c && c.quiz) c.quiz.forEach((q) => pool.push({ q: q.q, opts: q.opts, answer: q.answer }));
  });
  return pool;
}
// детерминированная тасовка по seed
function seededShuffle(arr, seed) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = (i * (seed + 13) + 7) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ───────── СЕМЕЙНЫЙ КВИЗ (2 игрока, pass-and-play) ───────── */
const FAM_ROUNDS = 6; // по 3 вопроса каждому
let famState = { qs: [], i: 0, scores: [0, 0], answered: false };

function openFamily() {
  const pool = quizPool();
  if (pool.length < FAM_ROUNDS) { toast('Игра скоро появится'); return; }
  famState = { qs: seededShuffle(pool, dayIndex()).slice(0, FAM_ROUNDS), i: 0, scores: [0, 0], answered: false };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'family'));
  $('#nav').style.display = 'none';
  renderFamily();
  window.scrollTo({ top: 0 });
}

function renderFamily() {
  if (famState.i >= FAM_ROUNDS) return finishFamily();
  const q = famState.qs[famState.i];
  const player = famState.i % 2; // 0 или 1
  famState.answered = false;
  $('#familyBody').innerHTML = `
    <div class="fam-turn fam-turn--p${player + 1}">
      <div class="fam-turn__who">Ходит Игрок ${player + 1}</div>
      <div class="fam-turn__score">Игрок 1: ${famState.scores[0]} · Игрок 2: ${famState.scores[1]}</div>
      <div class="fam-turn__round">Вопрос ${famState.i + 1} из ${FAM_ROUNDS}</div>
    </div>
    <div class="card"><div class="q__text" style="margin-bottom:12px">${q.q}</div>
      <div id="famOpts">${q.opts.map((o, oi) => `<button class="fam-opt" data-oi="${oi}">${o}</button>`).join('')}</div>
    </div>`;
  $$('#famOpts .fam-opt').forEach((el) => el.addEventListener('click', () => answerFamily(Number(el.dataset.oi))));
}

function answerFamily(oi) {
  if (famState.answered) return;
  famState.answered = true;
  const q = famState.qs[famState.i];
  const player = famState.i % 2;
  const right = oi === q.answer;
  $$('#famOpts .fam-opt').forEach((el, i) => { el.disabled = true; if (i === q.answer) el.classList.add('fam-opt--right'); else if (i === oi) el.classList.add('fam-opt--wrong'); });
  if (right) { famState.scores[player]++; if (window.MAGIC) { const r = $('#familyBody').getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top + 60); } }
  setTimeout(() => { famState.i++; renderFamily(); window.scrollTo({ top: 0 }); }, right ? 900 : 1200);
}

function finishFamily() {
  const [a, b] = famState.scores;
  const title = a === b ? 'Ничья — дружная семья!' : `Победил Игрок ${a > b ? 1 : 2}!`;
  if (window.MAGIC) MAGIC.rewardModal({ icon: 'users', title, subtitle: `Игрок 1: ${a} · Игрок 2: ${b}. Играть вместе — уже победа.`, xp: 20 });
  else toast(title);
  setTimeout(openGamesHub, 500);
}

/* ───────── ЕЖЕДНЕВНЫЙ ВЫЗОВ ───────── */
const CHALLENGES = [
  { task: 'Скажи сегодня «спасибо» трём людям — и Богу за них.', deed: 'Благодарность' },
  { task: 'Сделай доброе дело тихо, чтобы никто не заметил.', deed: 'Доброта' },
  { task: 'Помирись с тем, на кого обижался. Прощение делает сердце лёгким.', deed: 'Прощение' },
  { task: 'Помолись сегодня за свою семью своими словами.', deed: 'Молитва' },
  { task: 'Помоги маме или папе без просьбы.', deed: 'Послушание' },
  { task: 'Поделись чем-то своим с другом или братом.', deed: 'Щедрость' },
  { task: 'Найди в природе три Божьих чуда и скажи «как красиво!».', deed: 'Благодарность' },
  { task: 'Поддержи того, кому сегодня грустно. Ты можешь стать маячком.', deed: 'Милосердие' },
];

function openChallenge() {
  const idx = dayIndex() % CHALLENGES.length;
  const ch = CHALLENGES[idx];
  const pool = quizPool();
  const q = pool.length ? seededShuffle(pool, dayIndex() + 5)[0] : null;
  const doneToday = localStorage.getItem('mt_challenge_date') === todayKey();
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'challenge'));
  $('#nav').style.display = 'none';
  $('#challengeBody').innerHTML = `
    <div class="ch-head"><div class="ch-head__ic">${ICON('trophy', 26)}</div>
      <div><div class="ch-head__title">Вызов дня</div><div class="ch-head__sub">Тема: ${ch.deed} · Метанойя+</div></div></div>
    <div class="card ch-task">${ICON('flame', 18)}<p>${ch.task}</p></div>
    ${q ? `<h2 class="section-title">Вопрос дня</h2>
    <div class="card"><div class="q__text" style="margin-bottom:12px">${q.q}</div>
      <div id="chOpts">${q.opts.map((o, oi) => `<button class="fam-opt" data-oi="${oi}">${o}</button>`).join('')}</div>
      <div class="test-result" id="chResult" hidden></div></div>` : ''}
    <button class="btn btn--primary" id="chClaim" style="width:100%;margin-top:16px" ${doneToday ? 'disabled' : ''}>${doneToday ? 'Вызов дня выполнен ✓' : 'Отметить выполненным · +15 XP'}</button>`;
  hydrateIcons();
  if (q) $$('#chOpts .fam-opt').forEach((el) => el.addEventListener('click', () => {
    $$('#chOpts .fam-opt').forEach((b, i) => { b.disabled = true; if (i === q.answer) b.classList.add('fam-opt--right'); else if (b === el) b.classList.add('fam-opt--wrong'); });
    const res = $('#chResult'); res.hidden = false;
    const ok = Number(el.dataset.oi) === q.answer;
    res.className = 'test-result ' + (ok ? 'pass' : 'fail');
    res.textContent = ok ? 'Верно! Так держать.' : 'Не угадал — но вызов дня всё равно можно выполнить.';
  }));
  $('#chClaim')?.addEventListener('click', () => {
    if (localStorage.getItem('mt_challenge_date') === todayKey()) return;
    localStorage.setItem('mt_challenge_date', todayKey());
    if (window.MAGIC) MAGIC.rewardModal({ icon: 'trophy', title: 'Вызов дня выполнен!', subtitle: 'Возвращайся завтра — новый вызов уже ждёт.', xp: 15 });
    else toast('+15 XP!');
    setTimeout(openGamesHub, 400);
  });
  window.scrollTo({ top: 0 });
}

/* ───────── ТОЛКОВАНИЕ (выбери каноническое) ───────── */
function INT() { return (typeof window !== 'undefined' && window.INTERPRET) ? window.INTERPRET : []; }
let intState = { i: 0, score: 0, answered: false };

function openInterpret() {
  if (!INT().length) { toast('Игра скоро появится'); return; }
  intState = { i: 0, score: 0, answered: false };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'interpret'));
  $('#nav').style.display = 'none';
  renderInterpret();
  window.scrollTo({ top: 0 });
}

function renderInterpret() {
  const c = INT()[intState.i];
  $('#intNum').textContent = intState.i + 1;
  $('#intTotal').textContent = INT().length;
  $('#intScore').textContent = intState.score;
  intState.answered = false;
  $('#intBody').innerHTML = `
    <article class="card feed-card feed-card--quote"><div class="feed-card__title">«${c.passage}»</div><div class="quote-ref">${c.ref}</div></article>
    <div class="int-q">${c.question}</div>
    <div class="int-opts" id="intOpts">${c.options.map((o, oi) => `<button class="dil-opt" data-oi="${oi}">${o.text}</button>`).join('')}</div>
    <div class="dil-feedback" id="intFb" hidden></div>`;
  $$('#intOpts .dil-opt').forEach((el) => el.addEventListener('click', () => answerInterpret(Number(el.dataset.oi))));
}

function answerInterpret(oi) {
  if (intState.answered) return;
  intState.answered = true;
  const c = INT()[intState.i];
  const chosen = c.options[oi];
  $$('#intOpts .dil-opt').forEach((el, i) => { el.disabled = true; if (c.options[i].canonical) el.classList.add('dil-opt--good'); else if (i === oi) el.classList.add('dil-opt--bad'); });
  if (chosen.canonical) { intState.score += 15; $('#intScore').textContent = intState.score; if (window.MAGIC) { const r = $('#intBody').getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top + 80); } }
  const last = intState.i >= INT().length - 1;
  const fb = $('#intFb'); fb.hidden = false;
  fb.className = 'dil-feedback ' + (chosen.canonical ? 'dil-feedback--good' : 'dil-feedback--soft');
  fb.innerHTML = `<div class="dil-feedback__row">${ICON(chosen.canonical ? 'check' : 'book', 18)}<span>${chosen.note}</span></div>
    <button class="btn btn--primary" id="intNext" style="width:100%;margin-top:12px">${last ? 'Завершить' : 'Следующий отрывок'}</button>`;
  $('#intNext').addEventListener('click', () => {
    if (last) { if (window.MAGIC) MAGIC.rewardModal({ icon: 'cross', title: 'Готово!', subtitle: `Ты вникал в смысл Писания — ${intState.score} очков.`, xp: intState.score }); setTimeout(openGamesHub, 400); }
    else { intState.i++; renderInterpret(); window.scrollTo({ top: 0 }); }
  });
}

/* ───────── КОВЧЕГ ЗАВЕТА (квест, 5 глав) ───────── */
function QST() { return (typeof window !== 'undefined' && window.QUEST) ? window.QUEST : []; }
let q2State = { i: 0, answered: false };

function openQuest2() {
  if (!QST().length) { toast('Квест скоро появится'); return; }
  q2State = { i: 0, answered: false };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'quest2'));
  $('#nav').style.display = 'none';
  renderQuest2();
  window.scrollTo({ top: 0 });
}

function renderQuest2() {
  const c = QST()[q2State.i];
  $('#q2Num').textContent = q2State.i + 1;
  $('#q2Total').textContent = QST().length;
  q2State.answered = false;
  $('#q2Body').innerHTML = `
    <div class="q2-chapter">${c.title}</div>
    <div class="card lesson-text q2-scene"><p>${c.scene}</p></div>
    <div class="q2-question">${c.question}</div>
    <div class="dil-opts" id="q2Opts">${c.options.map((o, oi) => `<button class="dil-opt" data-oi="${oi}">${o.text}</button>`).join('')}</div>
    <div class="dil-feedback" id="q2Fb" hidden></div>`;
  $$('#q2Opts .dil-opt').forEach((el) => el.addEventListener('click', () => answerQuest2(Number(el.dataset.oi))));
}

function answerQuest2(oi) {
  if (q2State.answered) return;
  q2State.answered = true;
  const c = QST()[q2State.i];
  const chosen = c.options[oi];
  $$('#q2Opts .dil-opt').forEach((el, i) => { el.disabled = true; if (c.options[i].correct) el.classList.add('dil-opt--good'); else if (i === oi) el.classList.add('dil-opt--bad'); });
  const last = q2State.i >= QST().length - 1;
  const fb = $('#q2Fb'); fb.hidden = false;
  fb.className = 'dil-feedback ' + (chosen.correct ? 'dil-feedback--good' : 'dil-feedback--soft');
  fb.innerHTML = `<div class="dil-feedback__row">${ICON(chosen.correct ? 'check' : 'heart', 18)}<span>${chosen.outcome}</span></div>
    <div class="dil-verse">«${c.verse.text}» <em>${c.verse.ref}</em></div>
    <button class="btn btn--primary" id="q2Next" style="width:100%;margin-top:12px">${last ? 'Завершить путь' : 'Дальше в путь →'}</button>`;
  if (chosen.correct && window.MAGIC) { const r = fb.getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top); }
  $('#q2Next').addEventListener('click', () => {
    if (last) { if (window.MAGIC) MAGIC.rewardModal({ icon: 'star', title: 'Путь пройден!', subtitle: 'Ты прошёл весь путь веры до конца. Бог хранит идущих за Ним.', xp: 35 }); setTimeout(openGamesHub, 400); }
    else { q2State.i++; renderQuest2(); window.scrollTo({ top: 0 }); }
  });
}


/* ───────── TELEGRAM-ФУНКЦИИ: ГОЛОСОВЫЕ, КРУЖОЧКИ, ВЛОЖЕНИЯ, ЛИЧКИ ───────── */

const PARENTS = [
  { name: 'Мария', city: 'Гатчина', kids: 'дочь Соня, 7 лет' },
  { name: 'Иван', city: 'Самара', kids: 'Тимофей 7 и Вера 10' },
  { name: 'Ольга', city: 'Минск', kids: 'сын Марк, 9 лет' },
];

let voiceMode = 'audio';           // 'audio' | 'circle'
let rec = { active: false, timer: null, sec: 0, media: null, chunks: [] };

function waveBars(seed) {
  let bars = '';
  for (let k = 0; k < 24; k++) {
    const hgt = 5 + ((seed * (k + 3) * 7919) % 17);
    bars += `<i style="height:${hgt}px"></i>`;
  }
  return bars;
}

function fmtDur(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

/* запись: зажать — голосовое/кружочек; короткий тап — переключение режима */
function initVoice() {
  const btn = $('#cvVoice');
  let pressAt = 0, holdTimer = null;

  const beginRecord = async () => {
    rec.active = true; rec.sec = 0; rec.chunks = []; rec.media = null;
    $('#cvRecord').hidden = false;
    $('#cvRecHint').textContent = voiceMode === 'audio' ? 'отпусти, чтобы отправить' : 'кружочек: отпусти, чтобы отправить';
    $('#cvRecTime').textContent = '0:00';
    rec.timer = setInterval(() => { rec.sec++; $('#cvRecTime').textContent = fmtDur(rec.sec); }, 1000);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        voiceMode === 'audio' ? { audio: true } : { audio: true, video: { facingMode: 'user' } });
      rec.media = new MediaRecorder(stream);
      rec.media.ondataavailable = (e) => rec.chunks.push(e.data);
      rec.media.start();
    } catch { /* нет доступа (file:// или отказ) — демо-режим без реальной записи */ }
  };

  const finishRecord = (send) => {
    if (!rec.active) return;
    rec.active = false;
    clearInterval(rec.timer);
    $('#cvRecord').hidden = true;
    const dur = Math.max(1, rec.sec);
    let done = (url) => {
      if (!send) return;
      const msg = voiceMode === 'audio'
        ? { voice: { dur, url } }
        : { circle: { dur, url } };
      msg.time = 'только что';
      (myMsgs[cvChatId] = myMsgs[cvChatId] || []).push(msg);
      localStorage.setItem('mt_msgs2', JSON.stringify(myMsgs));
      renderChatMsgs();
    };
    if (rec.media && rec.media.state !== 'inactive') {
      rec.media.onstop = () => {
        rec.media.stream.getTracks().forEach((t) => t.stop());
        done(URL.createObjectURL(new Blob(rec.chunks)));
      };
      rec.media.stop();
    } else done(null);
  };

  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pressAt = Date.now();
    holdTimer = setTimeout(beginRecord, 220);   // зажал → запись
  });
  btn.addEventListener('pointerup', () => {
    clearTimeout(holdTimer);
    if (Date.now() - pressAt < 220) {
      // короткий тап → переключение микрофон ↔ кружочек (как в TG)
      voiceMode = voiceMode === 'audio' ? 'circle' : 'audio';
      $('#cvVoiceIcon').innerHTML = ICON(voiceMode === 'audio' ? 'mic' : 'circle', 20);
      toast(voiceMode === 'audio' ? 'Режим: голосовое сообщение' : 'Режим: видеокружочек');
    } else finishRecord(true);
  });
  btn.addEventListener('pointerleave', () => { if (rec.active) finishRecord(true); });
  $('#cvRecCancel').addEventListener('click', () => finishRecord(false));

  // поле ввода: есть текст → стрелка отправки, пусто → микрофон
  $('#cvField').addEventListener('input', () => {
    const has = $('#cvField').value.trim().length > 0;
    $('#cvSend').hidden = !has;
    $('#cvVoice').hidden = has;
  });
}

/* вложения через скрепку */
function initAttach() {
  $('#cvAttachBtn').addEventListener('click', () => { $('#attachSheet').hidden = false; });
  $('[data-close-attach]').addEventListener('click', () => { $('#attachSheet').hidden = true; });
  $$('#attachSheet [data-attach]').forEach((b) => b.addEventListener('click', () => {
    $('#attachSheet').hidden = true;
    if (b.dataset.attach === 'photo') $('#cvPhotoInput').click();
    if (b.dataset.attach === 'file') $('#cvFileInput').click();
    if (b.dataset.attach === 'poll') toast('Опросы создаёт только Екатерина');
  }));
  $('#cvPhotoInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      (myMsgs[cvChatId] = myMsgs[cvChatId] || []).push({ photo: reader.result, time: 'только что' });
      renderChatMsgs();
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  });
  $('#cvFileInput').addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) return toast('Файл больше 20 МБ');
    (myMsgs[cvChatId] = myMsgs[cvChatId] || []).push({
      file: { name: f.name, size: (f.size / 1024 / 1024).toFixed(1) + ' МБ' }, time: 'только что' });
    localStorage.setItem('mt_msgs2', JSON.stringify(myMsgs));
    renderChatMsgs();
    e.target.value = '';
  });
}

/* личные сообщения между родителями */
function initDm() {
  $('#newChatBtn').addEventListener('click', () => {
    $('#dmList').innerHTML = PARENTS.map((p, i) => `
      <button class="dm-item" data-dm="${i}">
        <div class="dm-item__avatar">${p.name[0]}</div>
        <div><div class="dm-item__name">${p.name}</div>
        <div class="dm-item__meta">${p.city} · ${p.kids}</div></div>
      </button>`).join('');
    $('#dmSheet').hidden = false;
    $$('#dmList [data-dm]').forEach((b) => b.addEventListener('click', () => {
      $('#dmSheet').hidden = true;
      openDm(PARENTS[Number(b.dataset.dm)]);
    }));
  });
  $('[data-close-dm]').addEventListener('click', () => { $('#dmSheet').hidden = true; });
}

function openDm(parent) {
  let idx = DEMO.chats.findIndex((c) => c.name === parent.name);
  if (idx === -1) {
    DEMO.chats.push({ icon: 'users', name: parent.name, last: 'Личная переписка', time: 'сейчас', unread: 0, dm: true });
    idx = DEMO.chats.length - 1;
    CHAT_MSGS[idx] = { msgs: [] };
    renderChats();
  }
  openChatView(idx);
}

/* карточка профиля участника (тап по имени в чате) */
function showUserCard(name) {
  const p = PARENTS.find((x) => x.name === name);
  const isPeda = name.includes('Екатерина');
  $('#ucAvatar').innerHTML = isPeda ? '<img src="assets/img/avatars/ekaterina.jpg" alt="">' : name[0];
  $('#ucName').textContent = isPeda ? 'Екатерина Павленко' : name;
  $('#ucMeta').textContent = isPeda ? 'Педагог школы · онлайн'
    : p ? `Родитель · ${p.city} · ${p.kids}` : 'Ученик · личные сообщения детям недоступны';
  $('#ucWrite').style.display = (isPeda || p) ? '' : 'none';
  $('#userCard').hidden = false;
  $('#ucWrite').onclick = () => {
    $('#userCard').hidden = true;
    if (isPeda) openChatView(0);
    else if (p) openDm(p);
  };
}

function initUserCard() {
  $('#ucClose').addEventListener('click', () => { $('#userCard').hidden = true; });
  document.addEventListener('click', (e) => {
    const nameEl = e.target.closest('.msg__name');
    if (nameEl) showUserCard(nameEl.textContent.trim());
  });
}


/* ───────── РАСПИСАНИЕ СОЗВОНОВ ───────── */

const EVENTS = [
  { title: 'Притча о блудном сыне', when: 'Завтра · 18:00 (МСК)', seats: 8, total: 50 },
  { title: 'Знакомство со школой для новых семей', when: 'Суббота · 12:00 (МСК)', seats: 23, total: 50 },
];
let myEvents = JSON.parse(localStorage.getItem('mt_events') || '[]');

function renderSchedule() {
  const box = $('#schedule');
  if (!box) return;
  box.innerHTML = EVENTS.map((ev, i) => {
    const joined = myEvents.includes(i);
    return `<div class="ev card">
      <div class="ev__icon">${ICON('video', 22)}</div>
      <div class="ev__body">
        <div class="ev__title">${ev.title}</div>
        <div class="ev__meta">${ICON('clock', 12)} ${ev.when} · мест: ${ev.seats - (joined ? 1 : 0)}/${ev.total}</div>
      </div>
      <button class="btn ${joined ? 'btn--outline' : 'btn--primary'} ev__btn" data-ev="${i}">
        ${joined ? 'Вы записаны' : 'Записаться'}</button>
    </div>`;
  }).join('');
  $$('#schedule [data-ev]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.ev);
    if (myEvents.includes(i)) { myEvents = myEvents.filter((x) => x !== i); toast('Запись отменена'); }
    else { myEvents.push(i); toast('Вы записаны! Напомним за 15 минут до начала'); }
    localStorage.setItem('mt_events', JSON.stringify(myEvents));
    renderSchedule();
  }));
}

/* ───────── ПОИСК ПО СООБЩЕНИЯМ В ЧАТЕ ───────── */

function initChatSearch() {
  $('#cvSearchBtn').addEventListener('click', () => {
    const bar = $('#cvSearchBar');
    bar.hidden = !bar.hidden;
    if (!bar.hidden) $('#cvSearchField').focus();
    else { $('#cvSearchField').value = ''; filterMsgs(''); }
  });
  $('#cvSearchField').addEventListener('input', (e) => filterMsgs(e.target.value.trim().toLowerCase()));
}

function filterMsgs(q) {
  let found = 0;
  $$('#cvMsgs .msg').forEach((el) => {
    const hit = !q || (el.dataset.text || '').toLowerCase().includes(q);
    el.style.display = hit ? '' : 'none';
    if (hit && q) found++;
  });
  $('#cvSearchCount').textContent = q ? (found ? `найдено: ${found}` : 'не найдено') : '';
}


/* ───────── МИНИ-ИГРА «СОБЕРИ СТИХ» (этап 5, tap-to-place) ───────── */

const VERSES = {
  easy:   { ref: 'Пс. 22:1', text: 'Господь Пастырь мой', name: 'Лёгкий', xp: 15 },
  medium: { ref: '1 Ин. 4:16', text: 'Бог есть любовь и пребывающий в любви', name: 'Средний', xp: 22 },
  hard:   { ref: 'Мф. 5:16', text: 'Так да светит свет ваш пред людьми чтобы они видели ваши добрые дела', name: 'Сложный', xp: 30 },
};
let verseLevel = 'easy';
let versePlaced = [];       // индексы слов в порядке нажатия
let verseWords = [];        // {w, idx}
let verseTimer = null, verseSec = 0;

function shuffleSeeded(arr) {
  // детерминированная тасовка (без Math.random в кадре — вариативность по длине)
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (i * 7 + a.length * 13) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  // если совпало с оригиналом — сдвиг
  if (a.every((x, i) => x.idx === i)) a.push(a.shift());
  return a;
}

function verseFmt(s) { return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }

function openVerse(level) {
  verseLevel = level || 'easy';
  const v = VERSES[verseLevel];
  versePlaced = [];
  const words = v.text.split(' ');
  verseWords = shuffleSeeded(words.map((w, idx) => ({ w, idx })));
  $('#verseRef').textContent = v.ref;
  $('#verseLevelName').textContent = v.name;
  renderVerse();
  renderVerseLevels();
  verseSec = 0; $('#verseTimer').textContent = '0:00';
  clearInterval(verseTimer);
  verseTimer = setInterval(() => { verseSec++; $('#verseTimer').textContent = verseFmt(verseSec); }, 1000);
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'verse'));
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
}

function renderVerse() {
  $('#verseTarget').innerHTML = versePlaced.map((pi) =>
    `<button class="word word--placed" data-take="${pi}">${verseWords[pi].w}</button>`).join('');
  $('#verseBank').innerHTML = verseWords.map((w, pi) =>
    versePlaced.includes(pi) ? '' : `<button class="word" data-put="${pi}">${w.w}</button>`).join('');
  $$('#verseBank [data-put]').forEach((el) => el.addEventListener('click', () => {
    versePlaced.push(Number(el.dataset.put)); renderVerse();
  }));
  $$('#verseTarget [data-take]').forEach((el) => el.addEventListener('click', () => {
    versePlaced = versePlaced.filter((x) => x !== Number(el.dataset.take)); renderVerse();
  }));
}

function renderVerseLevels() {
  $('#verseLevels').innerHTML = Object.entries(VERSES).map(([k, v]) =>
    `<button class="verse-level ${k === verseLevel ? 'verse-level--on' : ''}" data-lvl="${k}">${v.name}</button>`).join('');
  $$('#verseLevels [data-lvl]').forEach((el) =>
    el.addEventListener('click', () => openVerse(el.dataset.lvl)));
}

function checkVerse() {
  const v = VERSES[verseLevel];
  const total = v.text.split(' ').length;
  if (versePlaced.length < total) return toast('Собери стих полностью');
  const correct = versePlaced.every((pi, pos) => verseWords[pi].idx === pos);
  const cells = $$('#verseTarget .word');
  versePlaced.forEach((pi, pos) => {
    cells[pos].classList.add(verseWords[pi].idx === pos ? 'word--right' : 'word--wrong');
  });
  if (correct) {
    clearInterval(verseTimer);
    const bonus = verseSec < 20 ? 5 : 0;
    setTimeout(() => {
      if (window.MAGIC) MAGIC.rewardModal({
        icon: 'book', title: 'Стих собран!',
        subtitle: `«${v.text}» — ${v.ref}. Время: ${verseFmt(verseSec)}${bonus ? ' · бонус за скорость!' : ''}`,
        xp: v.xp + bonus,
      });
    }, 500);
  } else {
    setTimeout(() => cells.forEach((c) => c.classList.remove('word--wrong')), 600);
    toast('Почти! Проверь порядок слов');
  }
}

function initVerseGame() {
  $('#openVerseGame')?.addEventListener('click', () => openVerse('easy'));
  $('#verseBack').addEventListener('click', () => {
    clearInterval(verseTimer);
    openGamesHub();
  });
  $('#verseReset').addEventListener('click', () => { versePlaced = []; renderVerse(); });
  $('#verseCheck').addEventListener('click', checkVerse);
}


/* ───────── МОЙ ХРАМ: растущий SVG (геймификация) ───────── */

const TEMPLE_STAGES = [
  'Участок', 'Фундамент', 'Стены', 'Окна', 'Крыша', 'Купол',
  'Крест', 'Золочение', 'Колокольня', 'Двери', 'Готов!'
];
let templeState = JSON.parse(localStorage.getItem('mt_temple') || '{"bricks":34,"decor":[]}');
if (!templeState.decor) templeState.decor = [];

function templeStageIndex(bricks) {
  return Math.min(10, Math.floor(bricks / 10)); // 0..10, каждые 10 кирпичей = этап
}

// Украшения храма — продолжение после 100%
const TEMPLE_DECOR = [
  { key: 'garden', icon: 'sprout', name: 'Разбить сад', note: 'Посади вокруг храма живой сад', xp: 30 },
  { key: 'candles', icon: 'flame', name: 'Зажечь свечи', note: 'Наполни храм тёплым светом', xp: 30 },
  { key: 'bell', icon: 'church', name: 'Повесить колокол', note: 'Пусть звон созывает на молитву', xp: 40 },
  { key: 'feast', icon: 'crown', name: 'Праздник освящения', note: 'Собери друзей на большой праздник', xp: 50 },
];

function templeHeroStage(bricks) {
  if (bricks >= 100) return 10;
  if (bricks >= 60) return 6;
  if (bricks >= 30) return 3;
  return 0;
}

function renderTemple(animate) {
  const bricks = Math.min(100, templeState.bricks);
  const stage = templeStageIndex(bricks);

  // Красивый визуал: подставляем нужную акварельную иллюстрацию этапа
  const hs = templeHeroStage(bricks);
  document.querySelectorAll('#templeHero .temple-hero__img').forEach((im) => {
    im.classList.toggle('temple-hero__img--on', Number(im.dataset.tstage) === hs);
  });
  const hero = document.getElementById('templeHero');
  if (hero) hero.classList.toggle('temple-hero--complete', bricks >= 100);

  const nm = document.getElementById('templeStageName');
  if (nm) nm.textContent = bricks >= 100
    ? 'Храм построен! · «Архитектор веры»'
    : `Этап ${stage} из 10 · «${TEMPLE_STAGES[stage]}»`;
  const bar = document.getElementById('templeBar');
  if (bar) bar.style.width = bricks + '%';
  const br = document.getElementById('templeBricks');
  if (br) br.textContent = `${bricks} кирпичиков из 100`;

  const btn = document.getElementById('templeBrick');
  if (btn) btn.style.display = bricks >= 100 ? 'none' : '';

  renderTempleDecor();
}

function renderTempleDecor() {
  const wrap = document.getElementById('templeNext');
  if (!wrap) return;
  const done = templeState.bricks >= 100;
  wrap.hidden = !done;
  if (!done) return;
  const grid = document.getElementById('templeDecor');
  if (grid) {
    grid.innerHTML = TEMPLE_DECOR.map((d) => {
      const ok = templeState.decor.includes(d.key);
      return `<button class="tdecor ${ok ? 'tdecor--done' : ''}" data-decor="${d.key}">
        <span class="tdecor__ic">${ICON(d.icon, 20)}</span>
        <span class="tdecor__body"><span class="tdecor__name">${d.name}</span><span class="tdecor__note">${d.note}</span></span>
        <span class="tdecor__xp">${ok ? '✓' : '+' + d.xp}</span>
      </button>`;
    }).join('');
    grid.querySelectorAll('[data-decor]').forEach((b) => b.addEventListener('click', () => addTempleDecor(b.dataset.decor)));
  }
  const allDone = TEMPLE_DECOR.every((d) => templeState.decor.includes(d.key));
  const note = document.getElementById('templeDecorDone');
  if (note) note.hidden = !allDone;
}

function addTempleDecor(key) {
  if (templeState.decor.includes(key)) return;
  templeState.decor.push(key);
  localStorage.setItem('mt_temple', JSON.stringify(templeState));
  const d = TEMPLE_DECOR.find((x) => x.key === key);
  renderTempleDecor();
  if (window.MAGIC) {
    const el = document.querySelector(`[data-decor="${key}"]`);
    if (el) { const r = el.getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top); }
  }
  toast(`${d.name} · +${d.xp} XP`);
  if (TEMPLE_DECOR.every((x) => templeState.decor.includes(x.key)) && window.MAGIC) {
    setTimeout(() => MAGIC.rewardModal({ icon: 'crown', title: 'Храм освящён!',
      subtitle: 'Ты украсил свой храм и наполнил его светом. Значок «Хранитель храма» твой!' }), 500);
  }
}

function setBackLabel(id) {
  const b = document.getElementById(id);
  if (b) { b.innerHTML = `<span data-icon="back" data-size="18"></span> ${gameOpener === 'games' ? 'К играм' : 'Профиль ребёнка'}`; hydrateIcons(); }
}

function openTempleScreen() {
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'temple'));
  $('#nav').style.display = 'none';
  setBackLabel('templeBack');
  requestAnimationFrame(() => renderTemple(true));
  window.scrollTo({ top: 0 });
}

function initTemple() {
  $('#openTemple')?.addEventListener('click', () => { gameOpener = 'child'; openTempleScreen(); });
  $('#templeBack')?.addEventListener('click', () => {
    if (gameOpener === 'games') { openGamesHub(); return; }
    $('#nav').style.display = 'none';
    openChild(DEMO.children[0]);
  });
  $('#templeBrick')?.addEventListener('click', () => {
    const before = templeStageIndex(templeState.bricks);
    templeState.bricks = Math.min(100, templeState.bricks + 4);
    localStorage.setItem('mt_temple', JSON.stringify(templeState));
    renderTemple(true);
    const after = templeStageIndex(templeState.bricks);
    if (templeState.bricks >= 100 && window.MAGIC) {
      const r = document.getElementById('templeHero').getBoundingClientRect();
      MAGIC.celebrate(r.left + r.width / 2, r.top + r.height / 2);
      setTimeout(() => MAGIC.rewardModal({
        icon: 'church', title: 'Храм построен!',
        subtitle: 'Ты получил значок «Архитектор веры». Теперь укрась свой храм — путь продолжается!',
      }), 400);
    } else if (after > before) {
      toast(`Новый этап: «${TEMPLE_STAGES[after]}»!`);
    } else toast('+4 кирпичика');
  });
}





/* ───────── ХАБ ИГР + МЕМОРИ + ВИКТОРИНА (этап 5) ───────── */

const GAMES = {
  free: [
    { key: 'verse', icon: 'book', name: 'Собери стих', meta: 'Пазл-слова · +15–30 XP', play: true,
      desc: 'Стих Писания рассыпался на слова — собери его в правильном порядке.', bullets: ['Тренирует память Писания', 'Три уровня сложности', '+15–30 XP за стих'] },
    { key: 'memory', icon: 'sparkle', name: 'Библейское мемори', meta: 'Найди пары · +20 XP', play: true,
      desc: 'Переворачивай карточки и находи пары символов веры.', bullets: ['8 пар: голубь, храм, крест…', 'Звёзды за скорость', '+20 XP'] },
    { key: 'quiz', icon: 'flame', name: 'Викторина на скорость', meta: '10 вопросов · +10–30 XP', play: true,
      desc: 'Отвечай на вопросы по Писанию, пока не закончилось время.', bullets: ['Полоска времени 10 сек', 'Бонус за быстрый ответ', '+10–30 XP'] },
    { key: 'who', icon: 'search', name: 'Кто это?', meta: 'Угадай по подсказкам · +20 XP', play: true,
      desc: 'Три подсказки об одном библейском герое. Угадаешь с первой — больше очков.', bullets: ['Чем меньше подсказок — тем больше XP', '10 героев', 'Учит запоминать героев веры'] },
    { key: 'chrono', icon: 'clock', name: 'Хронология', meta: 'Расставь по порядку · +25 XP', play: true,
      desc: 'Расставь библейские события в правильном порядке — от сотворения мира до Церкви.', bullets: ['Перетаскивай события', 'Понимание всей истории спасения', '+25 XP'] },
  ],
  premium: [
    { key: 'match3', icon: 'sparkle', name: 'Три в ряд: Дары Духа', meta: '3 в ряд · +30 XP', premium: true, play: true,
      desc: 'Собирай тройки символов даров Духа Святого и проходи уровень за уровнем.', bullets: ['Больше 100 уровней', 'Растущая сложность', 'Бустеры и комбо'] },
    { key: 'exodus', icon: 'map', name: 'Исход: собери манну', meta: 'Собери манну · +25 XP', premium: true, play: true,
      desc: 'Веди народ Израиля через пустыню: собирай манну и уклоняйся от преград.', bullets: ['Аркада на время', 'Собирай манну за очки', 'История Исхода'] },
    { key: 'david', icon: 'target', name: 'Давид и Голиаф', meta: 'Меткий бросок · +25 XP', premium: true, play: true,
      desc: 'Рассчитай силу и траекторию — один точный бросок пращи решает всё.', bullets: ['Физика броска', 'Уровни сложности', 'Смелость веры'] },
    { key: 'ark', icon: 'dove', name: 'Ноев Ковчег', meta: 'Пары животных · +30 XP', premium: true, play: true,
      desc: 'Собери всех животных парами и проведи их в ковчег до начала дождя.', bullets: ['Игра на время', 'Пары животных', 'История Ноя'] },
    { key: 'temple', icon: 'church', name: 'Храм Соломона', meta: 'Растущий храм', premium: true, play: true,
      desc: 'Строй великий храм: собирай кирпичики за уроки и игры, этап за этапом.', bullets: ['Стройка храма', 'Растёт с прогрессом', 'Значок «Архитектор веры»'] },
    { key: 'quest', icon: 'star', name: 'Ковчег Завета', meta: '5 глав-историй · +35 XP', premium: true, play: true,
      desc: 'Приключение в пяти главах: пройди путь веры, делая верный выбор.', bullets: ['5 глав-историй', 'Выбор на каждом шаге', 'История пути к святыне'] },
    { key: 'detective', icon: 'search', name: 'Библейский детектив', meta: '6 историй · +очки', premium: true, play: true,
      desc: 'По уликам догадайся, о какой библейской истории идёт речь.', bullets: ['Дедукция для детей', '6 историй', 'Внимание к деталям'] },
    { key: 'dilemma', icon: 'heart', name: 'Дилемма', meta: 'Верный выбор · +25 XP', premium: true, play: true,
      desc: 'Жизненные ситуации и выбор: как поступить по совести и по вере?', bullets: ['Разговор о ценностях', 'Нет «проигрыша»', 'Обсуждай с родителями'] },
    { key: 'family', icon: 'users', name: 'Семейный квиз', meta: '2 игрока · викторина', premium: true, play: true,
      desc: 'Играйте вдвоём на одном устройстве — кто лучше знает Писание?', bullets: ['2 игрока на одном экране', 'Вопросы для всей семьи', 'Вечер вместе'] },
  ],
  daily: [
    { key: 'journey', icon: 'map', name: 'Путешествие веры', meta: 'Карта прогресса', play: true,
      desc: 'Двигайся по библейской карте — от Сада Эдема через Египет к Земле обетованной.', bullets: ['Твой путь на карте', 'Остановки-истории', 'Растёт с уроками'] },
    { key: 'temple-b', icon: 'church', name: 'Строитель храма', meta: 'Растущий храм', play: true,
      desc: 'Собирай кирпичики за уроки и тесты — и твой храм растёт этап за этапом.', bullets: ['10 этапов стройки', 'Награда за постоянство', 'Значок «Архитектор веры»'] },
    { key: 'dailyverse', icon: 'book', name: 'Ежедневный стих', meta: 'Ритуал дня · +5 XP', play: true,
      desc: 'Один короткий стих в день с простым пояснением. Прочитал — получил свет и +5 XP.', bullets: ['Тёплая привычка', 'Стрик дней подряд', '+5 XP в день'] },
    { key: 'challenge', icon: 'trophy', name: 'Ежедневный вызов', meta: 'Задание дня · +15 XP', premium: true, play: true,
      desc: 'Каждый день — новое маленькое задание: стих, доброе дело, молитва, тест.', bullets: ['Задание на каждый день', 'Награды за серии', 'Только в Метанойя+'] },
    { key: 'interpret', icon: 'cross', name: 'Толкование', meta: 'Понять притчу · +очки', premium: true, play: true,
      desc: 'Среди похожих вариантов выбери верное, каноническое толкование притчи.', bullets: ['Учит понимать притчи', 'Одобрено педагогом', 'Для старших детей'] },
  ],
};

let gameOpener = 'games'; // откуда открыли temple/journey: 'games' или 'child'

function openGamesHub() {
  renderGhub('free');
  $$('.nav__tab').forEach((b) => b.classList.toggle('nav__tab--active', b.dataset.tab === 'games'));
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'games'));
  $('#nav').style.display = '';               // игры — теперь основной таб внизу
  const gb = $('#gamesBack'); if (gb) gb.style.display = 'none';
  window.scrollTo({ top: 0 });
}

function renderGhub(cat) {
  $$('#ghub, .ghub-tab'); // noop
  $$('.ghub-tab').forEach((b) => b.classList.toggle('ghub-tab--on', b.dataset.gcat === cat));
  const locked = cat === 'premium';
  $('#ghub').innerHTML = GAMES[cat].map((g) => `
    <button class="gcard ${g.play ? 'gcard--play' : 'gcard--locked'}" data-game="${g.key}">
      ${!g.play ? `<div class="gcard__lock">${ICON('lock', 15)}</div>` : ''}
      <div class="gcard__img gcard__img--${g.key}"><img src="assets/img/games/${g.key}.jpg" alt="" loading="lazy" onerror="this.remove()"></div>
      <div class="gcard__name">${g.name}</div>
      <div class="gcard__meta">${g.meta}</div>
    </button>`).join('');
  $$('#ghub [data-game]').forEach((el) => el.addEventListener('click', () => {
    const k = el.dataset.game;
    if (k === 'verse') openVerse('easy');
    else if (k === 'memory') openMemory();
    else if (k === 'quiz') openQuiz();
    else if (k === 'who') openWho();
    else if (k === 'chrono') openChrono();
    else if (k === 'journey') { gameOpener = 'games'; openJourneyScreen(); }
    else if (k === 'temple-b') { gameOpener = 'games'; openTempleScreen(); }
    else if (k === 'dailyverse') openDailyVerse();
    else if (k === 'match3') openMatch3();
    else if (k === 'david') openDavid();
    else if (k === 'exodus') openExodus();
    else if (k === 'ark') openArk();
    else if (k === 'dilemma') openDilemma();
    else if (k === 'detective') openDetective();
    else if (k === 'family') openFamily();
    else if (k === 'challenge') openChallenge();
    else if (k === 'interpret') openInterpret();
    else if (k === 'quest') openQuest2();
    else if (k === 'temple') { gameOpener = 'games'; openTempleScreen(); }
    else openGamePreview(k);
  }));
}

function initGamesHub() {
  $('#openGamesHub')?.addEventListener('click', openGamesHub);
  $('#gamesBack')?.addEventListener('click', () => { $('#nav').style.display = ''; switchTab('profile'); });
  $$('.ghub-tab').forEach((b) => b.addEventListener('click', () => renderGhub(b.dataset.gcat)));
  $('#gpvClose')?.addEventListener('click', () => { $('#gamePreview').hidden = true; });
  $('#whoBack')?.addEventListener('click', openGamesHub);
  $('#whoMore')?.addEventListener('click', () => { const q = WHO[whoState.i]; if (whoState.clue < q.clues.length) { whoState.clue++; whoState.score = Math.max(0, whoState.score); renderWho(); } });
  $('#chronoBack')?.addEventListener('click', openGamesHub);
  $('#chronoCheck')?.addEventListener('click', checkChrono);
  $('#m3Back')?.addEventListener('click', () => { cancelAnimationFrame(david.raf); openGamesHub(); });
  $('#davidBack')?.addEventListener('click', () => { cancelAnimationFrame(david.raf); openGamesHub(); });
  $('#davidFire')?.addEventListener('click', davidFire);
  $('#exodusBack')?.addEventListener('click', () => { exodusStop(); openGamesHub(); });
  $('#exodusGo')?.addEventListener('click', exodusStart);
  $('#arkBack')?.addEventListener('click', () => { arkStop(); openGamesHub(); });
  $('#dilemmaBack')?.addEventListener('click', openGamesHub);
  $('#detectiveBack')?.addEventListener('click', openGamesHub);
  $('#familyBack')?.addEventListener('click', openGamesHub);
  $('#challengeBack')?.addEventListener('click', openGamesHub);
  $('#interpretBack')?.addEventListener('click', openGamesHub);
  $('#quest2Back')?.addEventListener('click', openGamesHub);
}

/* ── Превью заблокированной / премиум-игры ── */
function gameByKey(k) { return [...GAMES.free, ...GAMES.premium, ...GAMES.daily].find((g) => g.key === k); }

function openGamePreview(k) {
  const g = gameByKey(k); if (!g) return;
  $('#gpvIcon').innerHTML = ICON(g.icon, 34);
  const badge = $('#gpvBadge');
  badge.className = 'gpv__badge ' + (g.premium ? 'gpv__badge--plus' : 'gpv__badge--soon');
  badge.textContent = g.premium ? 'Метанойя+' : 'Скоро';
  $('#gpvName').textContent = g.name;
  $('#gpvDesc').textContent = g.desc || '';
  $('#gpvList').innerHTML = (g.bullets || []).map((b) => `<li>${b}</li>`).join('');
  const cta = $('#gpvCta');
  const note = $('#gpvNote');
  const wish = $('#gpvWish');
  if (g.premium) {
    cta.textContent = 'Открыть в Метанойя+';
    cta.disabled = false;
    cta.onclick = () => { $('#gamePreview').hidden = true; openSubscribeScreen(); };
    note.textContent = 'Доступ ко всем играм и материалам Метанойя+';
    wish.hidden = false;
    wish.onclick = () => addWish(g.key);
  } else {
    cta.textContent = 'Мы уже работаем над ней';
    cta.disabled = true;
    cta.onclick = null;
    note.textContent = 'Игра появится в одном из ближайших обновлений';
    wish.hidden = true;
  }
  $('#gamePreview').hidden = false;
  hydrateIcons();
}

/* ── Мягкая монетизация: желания ребёнка (УЛ9) ── */
function getWishes() { return JSON.parse(localStorage.getItem('mt_wishes') || '[]'); }

function addWish(key) {
  const w = getWishes();
  if (!w.includes(key)) { w.push(key); localStorage.setItem('mt_wishes', JSON.stringify(w)); }
  $('#gamePreview').hidden = true;
  renderWishes();
  if (window.MAGIC) MAGIC.rewardModal({ icon: 'heart', title: 'Родители узнают!', subtitle: 'Мы бережно передадим твоё пожелание маме или папе. Они решат вместе с тобой 💛', xp: 0 });
  else toast('Пожелание отправлено родителям');
}

function renderWishes() {
  const keys = getWishes();
  const block = $('#wishBlock');
  if (!block) return;
  if (!keys.length) { block.hidden = true; return; }
  block.hidden = false;
  $('#wishes').innerHTML = keys.map((k) => {
    const g = gameByKey(k); if (!g) return '';
    return `<div class="wish">
      <div class="wish__ic">${ICON(g.icon, 18)}</div>
      <div class="wish__body"><div class="wish__name">${g.name}</div><div class="wish__note">Ребёнок хочет открыть эту игру</div></div>
      <button class="wish__cta" data-wish="${k}">Открыть</button>
    </div>`;
  }).join('');
  $$('#wishes [data-wish]').forEach((el) => el.addEventListener('click', openSubscribeScreen));
  hydrateIcons();
}

/* ── Кто это? (угадай героя по подсказкам) ── */
const WHO = [
  { name: 'Ной', opts: ['Ной', 'Моисей', 'Давид', 'Иона'], clues: ['Бог повелел ему построить огромный корабль.', 'Он взял в него каждой твари по паре.', 'После потопа увидел радугу — знак завета.'] },
  { name: 'Моисей', opts: ['Илия', 'Моисей', 'Авраам', 'Иосиф'], clues: ['Младенцем его нашли в корзине среди тростника.', 'Бог говорил с ним из горящего куста.', 'Он вывел народ из Египта через море.'] },
  { name: 'Давид', opts: ['Саул', 'Самсон', 'Давид', 'Соломон'], clues: ['В юности он был пастухом и играл на арфе.', 'Одолел великана всего одним камнем.', 'Стал великим царём Израиля.'] },
  { name: 'Иона', opts: ['Иона', 'Пётр', 'Павел', 'Даниил'], clues: ['Он пытался убежать от Божьего поручения на корабле.', 'Его проглотила огромная рыба.', 'Три дня он молился в её чреве.'] },
  { name: 'Иосиф', opts: ['Иаков', 'Иосиф', 'Исаак', 'Аарон'], clues: ['Отец подарил ему разноцветную одежду.', 'Братья продали его в Египет.', 'Он умел толковать сны и стал правителем.'] },
];
let whoState = { i: 0, clue: 1, score: 0 };

function openWho() {
  whoState = { i: 0, clue: 1, score: 0 };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'who'));
  $('#nav').style.display = 'none';
  renderWho();
  window.scrollTo({ top: 0 });
}

function renderWho() {
  const q = WHO[whoState.i];
  $('#whoNum').textContent = whoState.i + 1;
  $('#whoScore').textContent = whoState.score;
  $('#whoClues').innerHTML = q.clues.slice(0, whoState.clue).map((c, i) =>
    `<div class="who-clue"><span class="who-clue__n">Подсказка ${i + 1}</span>${c}</div>`).join('');
  $('#whoMore').disabled = whoState.clue >= q.clues.length;
  $('#whoMore').style.display = whoState.clue >= q.clues.length ? 'none' : '';
  $('#whoOpts').innerHTML = q.opts.map((o) => `<button class="who-opt" data-who="${o}">${o}</button>`).join('');
  $$('#whoOpts [data-who]').forEach((el) => el.addEventListener('click', () => answerWho(el, q)));
}

function answerWho(el, q) {
  const right = el.dataset.who === q.name;
  $$('#whoOpts .who-opt').forEach((b) => { b.disabled = true; if (b.dataset.who === q.name) b.classList.add('who-opt--right'); });
  if (!right) el.classList.add('who-opt--wrong');
  if (right) {
    const gain = Math.max(5, 20 - (whoState.clue - 1) * 5);
    whoState.score += gain;
    $('#whoScore').textContent = whoState.score;
    if (window.MAGIC) { const r = el.getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top); }
  }
  $('#whoMore').style.display = 'none';
  setTimeout(() => {
    if (whoState.i < WHO.length - 1) { whoState.i++; whoState.clue = 1; renderWho(); }
    else finishWho();
  }, 1100);
}

function finishWho() {
  if (window.MAGIC) MAGIC.rewardModal({ icon: 'search', title: 'Игра пройдена!', subtitle: `Ты узнал героев веры и набрал ${whoState.score} очков.`, xp: whoState.score });
  else toast(`Готово · ${whoState.score} очков`);
  setTimeout(openGamesHub, 400);
}

/* ── Хронология (расставь события по порядку) ── */
const CHRONO = [
  { t: 'Сотворение мира', ord: 'В начале' },
  { t: 'Ноев потоп', ord: 'Ветхий Завет' },
  { t: 'Исход из Египта', ord: 'Ветхий Завет' },
  { t: 'Царь Давид', ord: 'Ветхий Завет' },
  { t: 'Рождество Иисуса', ord: 'Новый Завет' },
  { t: 'Воскресение Христа', ord: 'Новый Завет' },
];
let chronoOrder = [];

function openChrono() {
  // стартовая перестановка (детерминированная, заведомо не по порядку)
  chronoOrder = [2, 0, 4, 1, 5, 3].map((i) => CHRONO[i]);
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'chrono'));
  $('#nav').style.display = 'none';
  $('#chronoResult').textContent = '';
  renderChrono();
  window.scrollTo({ top: 0 });
}

function renderChrono() {
  $('#chronoList').innerHTML = chronoOrder.map((c, i) => `
    <div class="chrono-item" data-ci="${i}">
      <span class="chrono-item__grip">${ICON('menu', 16)}</span>
      <div class="chrono-item__body"><div class="chrono-item__title">${c.t}</div><div class="chrono-item__ord">${c.ord}</div></div>
      <div class="chrono-item__moves">
        <button class="chrono-move" data-mv="up" data-i="${i}" ${i === 0 ? 'disabled' : ''}>${ICON('chevron-up', 14)}</button>
        <button class="chrono-move" data-mv="down" data-i="${i}" ${i === chronoOrder.length - 1 ? 'disabled' : ''}>${ICON('chevron-down', 14)}</button>
      </div>
    </div>`).join('');
  $$('#chronoList .chrono-move').forEach((el) => el.addEventListener('click', () => {
    const i = Number(el.dataset.i);
    const j = el.dataset.mv === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= chronoOrder.length) return;
    [chronoOrder[i], chronoOrder[j]] = [chronoOrder[j], chronoOrder[i]];
    renderChrono();
  }));
  hydrateIcons();
}

function checkChrono() {
  let correct = 0;
  $$('#chronoList .chrono-item').forEach((el, i) => {
    const ok = chronoOrder[i] === CHRONO[i];
    el.classList.toggle('chrono-item--ok', ok);
    el.classList.toggle('chrono-item--bad', !ok);
    if (ok) correct++;
  });
  const res = $('#chronoResult');
  if (correct === CHRONO.length) {
    res.style.color = 'var(--success)';
    res.textContent = 'Верно! Вся история спасения по порядку 🎉';
    if (window.MAGIC) {
      const r = $('#chronoCheck').getBoundingClientRect();
      MAGIC.celebrate(r.left + r.width / 2, r.top);
      setTimeout(() => MAGIC.rewardModal({ icon: 'clock', title: 'Хронология собрана!', subtitle: 'Ты выстроил события от сотворения мира до Церкви.', xp: 25 }), 300);
    }
    setTimeout(openGamesHub, 1600);
  } else {
    res.style.color = 'var(--terracotta)';
    res.textContent = `Правильно на месте: ${correct} из ${CHRONO.length}. Попробуй ещё!`;
  }
}

/* ── Библейское мемори ── */
const MEM_PAIRS = ['dove', 'church', 'cross', 'star', 'book', 'flame', 'heart', 'crown'];
let memState = { flipped: [], matched: 0, moves: 0, lock: false };

function openMemory() {
  const cards = [...MEM_PAIRS, ...MEM_PAIRS].map((icon, i) => ({ icon, i }));
  // детерминированная тасовка
  for (let i = cards.length - 1; i > 0; i--) { const j = (i * 7 + 5) % (i + 1); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  memState = { flipped: [], matched: 0, moves: 0, lock: false, cards };
  $('#memMoves').textContent = '0';
  $('#memGrid').innerHTML = cards.map((c, idx) => `
    <div class="mcard" data-mem="${idx}" data-icon="${c.icon}">
      <div class="mcard__face mcard__back">${ICON('sparkle', 22)}</div>
      <div class="mcard__face mcard__front mcard__front--img"><img src="assets/img/mem/${c.icon}.jpg" alt="" loading="lazy"></div>
    </div>`).join('');
  $$('#memGrid .mcard').forEach((el) => el.addEventListener('click', () => memFlip(el)));
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'memory'));
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
}

function memFlip(el) {
  if (memState.lock || el.classList.contains('mcard--flip') || el.classList.contains('mcard--done')) return;
  el.classList.add('mcard--flip');
  memState.flipped.push(el);
  if (memState.flipped.length === 2) {
    memState.moves++; $('#memMoves').textContent = memState.moves;
    memState.lock = true;
    const [a2, b2] = memState.flipped;
    if (a2.dataset.icon === b2.dataset.icon) {
      setTimeout(() => {
        a2.classList.add('mcard--done'); b2.classList.add('mcard--done');
        memState.flipped = []; memState.lock = false; memState.matched++;
        if (memState.matched === MEM_PAIRS.length) {
          const stars = memState.moves <= 12 ? 3 : memState.moves <= 18 ? 2 : 1;
          if (window.MAGIC) MAGIC.rewardModal({ icon: 'sparkle', title: 'Все пары найдены!',
            subtitle: `Ходов: ${memState.moves} · ${'★'.repeat(stars)}`, xp: 20 });
        }
      }, 500);
    } else {
      setTimeout(() => { a2.classList.remove('mcard--flip'); b2.classList.remove('mcard--flip'); memState.flipped = []; memState.lock = false; }, 800);
    }
  }
}

function initMemory() { $('#memBack')?.addEventListener('click', openGamesHub); }

/* ── Викторина на скорость ── */
const QUIZ = [
  { q: 'Кто построил ковчег, чтобы спастись от потопа?', opts: ['Моисей', 'Ной', 'Давид', 'Авраам'], right: 1 },
  { q: 'Сколько дней Бог творил мир?', opts: ['3', '7', '12', '40'], right: 1 },
  { q: 'Кто победил великана Голиафа?', opts: ['Давид', 'Самсон', 'Иона', 'Даниил'], right: 0 },
  { q: 'Где родился Иисус?', opts: ['Иерусалим', 'Назарет', 'Вифлеем', 'Египет'], right: 2 },
  { q: 'Как называется разговор с Богом?', opts: ['Песня', 'Молитва', 'Урок', 'Игра'], right: 1 },
];
let quizState = { i: 0, score: 0, timer: null, t: 100 };

function openQuiz() {
  quizState = { i: 0, score: 0, timer: null, t: 100 };
  $('#quizScore').textContent = '0';
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'quiz'));
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
  renderQuiz();
}

function renderQuiz() {
  const q = QUIZ[quizState.i];
  $('#quizNum').textContent = quizState.i + 1;
  $('#quizQ').textContent = q.q;
  $('#quizOpts').innerHTML = q.opts.map((o, k) => `<button class="qopt" data-opt="${k}">${o}</button>`).join('');
  $$('#quizOpts .qopt').forEach((el) => el.addEventListener('click', () => answerQuiz(Number(el.dataset.opt))));
  // таймер 10 сек
  quizState.t = 100;
  clearInterval(quizState.timer);
  const bar = $('#quizBar'); bar.style.width = '100%';
  quizState.timer = setInterval(() => {
    quizState.t -= 1; bar.style.width = quizState.t + '%';
    if (quizState.t <= 0) answerQuiz(-1);
  }, 100);
}

function answerQuiz(pick) {
  clearInterval(quizState.timer);
  const q = QUIZ[quizState.i];
  const opts = $$('#quizOpts .qopt');
  opts.forEach((el, k) => {
    el.style.pointerEvents = 'none';
    if (k === q.right) el.classList.add('qopt--right');
    else if (k === pick) el.classList.add('qopt--wrong');
  });
  if (pick === q.right) {
    const bonus = Math.round(quizState.t / 20);
    quizState.score += 2 + bonus;
    $('#quizScore').textContent = quizState.score;
  }
  setTimeout(() => {
    if (quizState.i + 1 < QUIZ.length) { quizState.i++; renderQuiz(); }
    else {
      const perfect = quizState.score >= QUIZ.length * 2;
      if (window.MAGIC) MAGIC.rewardModal({ icon: 'flame', title: 'Викторина пройдена!',
        subtitle: `Твой результат: ${quizState.score} очков${perfect ? ' · молниеносно!' : ''}`,
        xp: 10 + quizState.score });
    }
  }, 1100);
}

function initQuiz() { $('#quizBack')?.addEventListener('click', () => { clearInterval(quizState.timer); openGamesHub(); }); }

/* ───────── КНИГА «МЕТАНОЙЯ»: оглавление + читалка (раздел 9.7) ───────── */

const BOOK = {
  1: {
    title: 'Глава 1. Кто такой Бог?',
    body: `<p class="drop">Однажды маленькая девочка спросила маму: «А где живёт Бог?» Мама улыбнулась и ответила: «Он живёт везде, где есть любовь». Так начинается наш первый разговор — самый важный из всех.</p>
    <p>Бог — это Тот, Кто сотворил всё вокруг: высокое небо и глубокое море, каждую травинку и каждую звезду. Его нельзя увидеть глазами, как нельзя увидеть ветер. Но мы чувствуем ветер, когда он гладит нас по щеке, — и так же мы узнаём Бога по Его добрым делам.</p>
    <div class="scripture">Бог есть любовь, и пребывающий в любви пребывает в Боге, и Бог в нём.<cite>1 Ин. 4:16</cite></div>
    <p>Самое главное, что нужно запомнить: Бог любит каждого из нас. Не за то, что мы хорошо себя ведём или получаем пятёрки, — а просто потому, что мы Его дети. Он рядом, когда нам радостно, и особенно близко, когда нам грустно.</p>
    <p>С Богом можно разговаривать. Это называется молитва — и она не требует особых слов. Можно просто сказать: «Спасибо Тебе за этот день». И Он услышит.</p>`,
  },
};
const BOOK_BLOCKS = [
  { title: 'Блок 1 · «Знакомство с Богом»', chapters: [
    { n: 1, title: 'Кто такой Бог?', ready: true },
    { n: 2, title: 'Создание мира', ready: false },
    { n: 3, title: 'Адам и Ева', ready: false },
    { n: 4, title: 'Ноев ковчег', ready: false },
  ]},
  { title: 'Блок 2 · «Герои веры»', chapters: [
    { n: 13, title: 'Авраам — друг Божий', ready: false },
    { n: 14, title: 'Моисей', ready: false },
  ]},
];
let readerFs = ['s','m','l','xl'];
let readerFsIdx = 1;
const FS_PX = { s: 15, m: 16, l: 18, xl: 21 };

function openBook() {
  // Книга = уроки программы. Оглавление из глав, чтение — из контента урока.
  $('#bookToc').innerHTML = DEMO.blocks.map((block) => `
    <div class="toc-block">${block.title}</div>
    ${block.lessons.filter((l) => !l.exam).map((l) => {
      const ready = !!lessonContent(l.n);
      return `<button class="toc-item ${ready ? '' : 'toc-item--locked'}" data-chapter="${l.n}">
        <div class="toc-item__num">${l.cn || l.n}</div>
        <div class="toc-item__t">${l.title}</div>
        ${ready ? `<span class="toc-item__read">Читать</span>` : `<span data-icon="lock" data-size="15"></span>`}
      </button>`;
    }).join('')}
  `).join('');
  $$('#bookToc [data-chapter]').forEach((el) => el.addEventListener('click', () => {
    const n = Number(el.dataset.chapter);
    if (lessonContent(n)) openReader(n);
    else toast('Материал этого урока готовит педагог школы');
  }));
  hydrateIcons();
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'book'));
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
}

function openReader(n) {
  const c = lessonContent(n);
  const meta = lessonMeta(n);
  if (!c || !meta) { toast('Материал этого урока готовит педагог школы'); return; }
  const title = meta.l.title;
  const intro = c.intro ? `<p class="drop">${c.intro}</p>` : '';
  const scripture = c.verse ? `<div class="scripture">${c.verse.text}<cite>${c.verse.ref}</cite></div>` : '';
  const story = (c.story || []).map((p) => `<p>${p}</p>`).join('');
  const golden = c.golden ? `<div class="scripture">${c.golden}</div>` : '';
  const prayer = c.prayer ? `<p><em>${c.prayer}</em></p>` : '';
  $('#readerTitle').textContent = title;
  $('#readerBody').innerHTML = `<h2>${title}</h2>${intro}${scripture}${story}${golden}${prayer}`;
  applyReaderFs();
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'reader'));
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
}

function applyReaderFs() {
  const size = FS_PX[readerFs[readerFsIdx]];
  $('#readerBody').style.setProperty('--reader-fs', size + 'px');
}

function initBook() {
  $('#openBook')?.addEventListener('click', openBook);
  $('#bookBack')?.addEventListener('click', () => { $('#nav').style.display = ''; switchTab('profile'); });
  $('#readerBack')?.addEventListener('click', openBook);
  $('#readerSize')?.addEventListener('click', () => {
    readerFsIdx = (readerFsIdx + 1) % readerFs.length;
    localStorage.setItem('mt_reader_fs', readerFsIdx);
    applyReaderFs();
    toast('Размер шрифта: ' + readerFs[readerFsIdx].toUpperCase());
  });
  const saved = localStorage.getItem('mt_reader_fs');
  if (saved !== null) readerFsIdx = Number(saved);
}

/* ───────── РАНГИ РОСТА (раздел 11.2) ───────── */

const RANKS = [
  { icon: 'seed',   name: 'Зёрнышко', from: 0,    to: 100 },
  { icon: 'sprout', name: 'Росточек', from: 100,  to: 300 },
  { icon: 'flower', name: 'Цветочек', from: 300,  to: 600 },
  { icon: 'tree',   name: 'Деревце',  from: 600,  to: 1000 },
  { icon: 'star',   name: 'Звёздочка',from: 1000, to: 1500 },
  { icon: 'dove',   name: 'Голубок',  from: 1500, to: 2500 },
  { icon: 'crown',  name: 'Мудрец',   from: 2500, to: 4000 },
  { icon: 'church', name: 'Хранитель веры', from: 4000, to: Infinity },
];

function rankIndex(xp) {
  for (let i = RANKS.length - 1; i >= 0; i--) if (xp >= RANKS[i].from) return i;
  return 0;
}

function renderRanks(xp) {
  const box = document.getElementById('ranksLadder');
  if (!box) return;
  const cur = rankIndex(xp);
  box.innerHTML = RANKS.map((r, i) => {
    const cls = i < cur ? 'rank--done' : i === cur ? 'rank--current' : 'rank--future';
    return `<div class="rank ${cls}">
      <div class="rank__icon">${ICON(r.icon, 22)}</div>
      <div class="rank__name">${r.name}</div>
      <div class="rank__xp">${r.to === Infinity ? r.from + '+' : r.from + '–' + r.to} XP</div>
    </div>`;
  }).join('');
  // прокрутить к текущему рангу
  const el = box.children[cur];
  if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function rankUpCheck(oldXp, newXp) {
  const was = rankIndex(oldXp), now = rankIndex(newXp);
  if (now > was && window.MAGIC) {
    MAGIC.rewardModal({
      icon: RANKS[now].icon, title: 'Новый ранг!',
      subtitle: `Ты поднялся до ранга «${RANKS[now].name}». Продолжай расти в вере!`,
    });
  }
}

/* ───────── ПУТЕШЕСТВИЕ ВЕРЫ: карта прогресса ───────── */

const JOURNEY = [
  'Сад Эдема', 'Ноев ковчег', 'Египет', 'Синай',
  'Земля обетованная', 'Иерусалим', 'Вифлеем', 'Голгофа', 'Воскресение'
];
let journeyStop = 2; // остановка 3 (0-индекс) — демо

function initJourney() {
  $('#openJourney')?.addEventListener('click', () => { gameOpener = 'child'; openJourneyScreen(); });
  $('#journeyBack')?.addEventListener('click', () => {
    if (gameOpener === 'games') { openGamesHub(); return; }
    $('#nav').style.display = 'none';
    openChild(DEMO.children[0]);
  });
}

function openJourneyScreen() {
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'journey'));
  $('#nav').style.display = 'none';
  setBackLabel('journeyBack');
  window.scrollTo({ top: 0 });
  requestAnimationFrame(renderJourney);
}

function renderJourney() {
  const path = document.getElementById('jPath');
  const done = document.getElementById('jPathDone');
  const avatar = document.getElementById('jAvatar');
  const stopsG = document.getElementById('jStops');
  if (!path) return;

  const L = path.getTotalLength();
  const n = JOURNEY.length;
  const stopAt = (i) => path.getPointAtLength((i / (n - 1)) * L);

  // остановки
  stopsG.innerHTML = JOURNEY.map((name, i) => {
    const pt = stopAt(i);
    const reached = i <= journeyStop;
    const isCurrent = i === journeyStop;
    const labelRight = pt.x < 160;
    return `
      ${isCurrent ? `<circle class="j-stop-ring" cx="${pt.x}" cy="${pt.y}" r="14" fill="none" stroke="var(--terracotta)" stroke-width="2"/>` : ''}
      <circle class="j-stop-dot" cx="${pt.x}" cy="${pt.y}" r="8"
        fill="${reached ? 'var(--gold)' : '#fff'}" stroke="${reached ? 'var(--terracotta)' : 'rgba(90,101,119,.4)'}" stroke-width="2.5"/>
      <text class="j-stop-label ${reached ? '' : 'j-stop-label--locked'}"
        x="${labelRight ? pt.x + 16 : pt.x - 16}" y="${pt.y + 4}"
        text-anchor="${labelRight ? 'start' : 'end'}">${i + 1}. ${name}</text>`;
  }).join('');

  // пройденная часть пути — до текущей остановки
  const doneLen = (journeyStop / (n - 1)) * L;
  done.style.strokeDasharray = L;
  done.style.strokeDashoffset = L;
  requestAnimationFrame(() => { done.style.strokeDashoffset = L - doneLen; });

  // аватар едет к текущей остановке
  const cur = stopAt(journeyStop);
  avatar.style.transform = 'translate(50px, 40px)'; // старт
  requestAnimationFrame(() => { avatar.style.transform = `translate(${cur.x}px, ${cur.y}px)`; });
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
    toast('Вы вошли как гость — можно всё посмотреть');
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

/* ───────── РОСТ: РЕЙТИНГ · МЕТАНОЙЯ+ · НАСТРОЙКИ · ТЁМНАЯ ТЕМА (этап 5) ───────── */

const LB_COLORS = ['#C97064', '#7AAED4', '#D4A574', '#7BC67A', '#9B7AD4', '#5A6577', '#D4974A'];
const LEADERBOARD = [
  { name: 'София', xp: 420, rank: 'Цветочек' },
  { name: 'Миша', xp: 340, rank: 'Росточек', img: 'assets/img/avatars/lion.jpg', me: true },
  { name: 'Даниил', xp: 305, rank: 'Росточек' },
  { name: 'Ева', xp: 260, rank: 'Росточек', img: 'assets/img/avatars/star.jpg' },
  { name: 'Марк', xp: 210, rank: 'Зёрнышко' },
  { name: 'Лиза', xp: 165, rank: 'Зёрнышко' },
  { name: 'Тимофей', xp: 120, rank: 'Зёрнышко' },
];

function lbAva(c, i, cls) {
  const color = LB_COLORS[i % LB_COLORS.length];
  const inner = c.img ? `<img src="${c.img}" alt="">` : c.name[0];
  return `<div class="${cls}" style="background:${color}">${inner}</div>`;
}

function openRatingScreen() {
  const sorted = [...LEADERBOARD].sort((a, b) => b.xp - a.xp);
  const podOrder = [1, 0, 2]; // 2-е, 1-е, 3-е места визуально
  $('#ratingPodium').innerHTML = podOrder.map((rankIdx) => {
    const c = sorted[rankIdx]; if (!c) return '';
    const place = rankIdx + 1;
    return `<div class="pod pod--${place}">
      ${lbAva(c, sorted.indexOf(c), 'pod__ava')}
      <div class="pod__name">${c.name}</div>
      <div class="pod__xp">${c.xp} XP</div>
      <div class="pod__stand">${place}</div>
    </div>`;
  }).join('');
  $('#ratingList').innerHTML = sorted.map((c, i) => `
    <div class="lb-row ${c.me ? 'lb-row--me' : ''}">
      <div class="lb-row__pos">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</div>
      ${lbAva(c, i, 'lb-row__ava')}
      <div class="lb-row__body">
        <div class="lb-row__name">${c.name}${c.me ? ' · это ты' : ''}</div>
        <div class="lb-row__rank">${c.rank}</div>
      </div>
      <div class="lb-row__xp">${c.xp}<small> XP</small></div>
    </div>`).join('');
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'rating'));
  $('#nav').style.display = 'none';
  hydrateIcons();
  window.scrollTo({ top: 0 });
}

/* ── Метанойя+ ── */
const SUB_BENEFITS = [
  'Дополнительные игры в приложении',
  'Материалы для практических работ',
  'Рабочая тетрадь в электронном формате',
  'Книга «Метанойя» в приложении',
  'Поддержка школы · для всей семьи',
];
const SUB_PLANS = [
  { key: 'monthly', name: 'Метанойя +', desc: 'Ежемесячно · отмена в любой момент', amt: '690 ₽', per: 'в месяц' },
];
let subPlan = 'monthly';

function openSubscribeScreen() {
  const active = localStorage.getItem('mt_plus') === '1';
  $('#subBenefits').innerHTML =
    (active ? `<div class="sub-active">Метанойя+ активна · спасибо, что растёте с нами 🕊</div>` : '') +
    SUB_BENEFITS.map((b) => `<div class="sub-benefit"><div class="sub-benefit__ic">${ICON('check', 15)}</div>${b}</div>`).join('');
  renderSubPlans();
  $('#subCta').textContent = active ? 'Метанойя+ уже активна' : 'Оформить Метанойя+';
  $('#subCta').disabled = active;
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'subscribe'));
  $('#nav').style.display = 'none';
  hydrateIcons();
  window.scrollTo({ top: 0 });
}

function renderSubPlans() {
  $('#subPlans').innerHTML = SUB_PLANS.map((p) => `
    <button class="sub-plan ${p.key === subPlan ? 'sub-plan--on' : ''}" data-plan="${p.key}">
      ${p.tag ? `<span class="sub-plan__tag">${p.tag}</span>` : ''}
      <div class="sub-plan__radio">${p.key === subPlan ? ICON('check', 13) : ''}</div>
      <div class="sub-plan__body"><div class="sub-plan__name">${p.name}</div><div class="sub-plan__desc">${p.desc}</div></div>
      <div class="sub-plan__price"><div class="sub-plan__amt">${p.amt}</div><div class="sub-plan__per">${p.per}</div></div>
    </button>`).join('');
  $$('#subPlans [data-plan]').forEach((el) => el.addEventListener('click', () => { subPlan = el.dataset.plan; renderSubPlans(); hydrateIcons(); }));
  hydrateIcons();
}

/* ── Стать партнёром ── */
const PARTNER_BENEFITS = [
  'Вы помогаете школе оставаться бесплатной для семей',
  'Имя на «Стене благодарности» (по желанию)',
  'Ранний доступ к новым урокам и играм',
  'Личное слово благодарности от Екатерины',
];
const PARTNER_PLANS = [
  { key: 'p300', name: 'Друг школы', desc: 'Небольшая, но важная поддержка', amt: '300 ₽', per: 'в месяц' },
  { key: 'p1000', name: 'Партнёр', desc: 'Вы делаете большое дело', amt: '1 000 ₽', per: 'в месяц', tag: 'Популярно' },
  { key: 'p3000', name: 'Покровитель', desc: 'Особая поддержка служения', amt: '3 000 ₽', per: 'в месяц' },
];
let partnerPlan = 'p1000';

function openPartner() {
  $('#partnerBenefits').innerHTML = PARTNER_BENEFITS.map((b) => `<div class="sub-benefit"><div class="sub-benefit__ic">${ICON('check', 15)}</div>${b}</div>`).join('');
  renderPartnerPlans();
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'partner'));
  $('#nav').style.display = 'none';
  hydrateIcons();
  window.scrollTo({ top: 0 });
}
function renderPartnerPlans() {
  $('#partnerPlans').innerHTML = PARTNER_PLANS.map((p) => `
    <button class="sub-plan ${p.key === partnerPlan ? 'sub-plan--on' : ''}" data-pp="${p.key}">
      ${p.tag ? `<span class="sub-plan__tag">${p.tag}</span>` : ''}
      <div class="sub-plan__radio">${p.key === partnerPlan ? ICON('check', 13) : ''}</div>
      <div class="sub-plan__body"><div class="sub-plan__name">${p.name}</div><div class="sub-plan__desc">${p.desc}</div></div>
      <div class="sub-plan__price"><div class="sub-plan__amt">${p.amt}</div><div class="sub-plan__per">${p.per}</div></div>
    </button>`).join('');
  $$('#partnerPlans [data-pp]').forEach((el) => el.addEventListener('click', () => { partnerPlan = el.dataset.pp; renderPartnerPlans(); hydrateIcons(); }));
  hydrateIcons();
}

/* ── Поддержать школу (пожертвование) ── */
const DONATE_AMOUNTS = [200, 500, 1000, 2000];
let donateAmt = 500;
function openDonate() {
  donateAmt = 500;
  $('#donateCustom').value = '';
  renderDonate();
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'donate'));
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
}
function renderDonate() {
  $('#donateGrid').innerHTML = DONATE_AMOUNTS.map((a) => `
    <button class="donate-amt ${a === donateAmt ? 'donate-amt--on' : ''}" data-da="${a}">${a} ₽</button>`).join('');
  $$('#donateGrid [data-da]').forEach((el) => el.addEventListener('click', () => { donateAmt = Number(el.dataset.da); $('#donateCustom').value = ''; renderDonate(); }));
}

/* ── Настройки ── */
function switchRow(id, icon, name, desc, on) {
  return `<div class="set-row">
    <div class="set-row__ic">${ICON(icon, 17)}</div>
    <div class="set-row__body"><div class="set-row__name">${name}</div><div class="set-row__desc">${desc}</div></div>
    <button class="switch ${on ? 'switch--on' : ''}" id="${id}" role="switch" aria-checked="${on}"></button>
  </div>`;
}
const SET_DEFAULTS = { theme: 'light', n_lessons: true, n_msgs: true, n_calls: true, p_pin: true, p_time: false };
function setGet(k) { const v = localStorage.getItem('mt_set_' + k); return v === null ? SET_DEFAULTS[k] : v === '1'; }
function setPut(k, v) { localStorage.setItem('mt_set_' + k, v ? '1' : '0'); }

function openSettingsScreen() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  $('#setAppearance').innerHTML = switchRow('swTheme', dark ? 'moon' : 'sun', 'Тёмная тема', 'Мягкие тёмные тона для вечернего чтения', dark);
  $('#setNotify').innerHTML =
    switchRow('swLessons', 'book', 'Новые уроки', 'Уведомлять о новых занятиях', setGet('n_lessons')) +
    switchRow('swMsgs', 'comment', 'Сообщения', 'Личные сообщения и чаты школы', setGet('n_msgs')) +
    switchRow('swCalls', 'video', 'Напоминания о созвонах', 'За час до живого занятия', setGet('n_calls'));
  $('#setParental').innerHTML =
    switchRow('swPin', 'lock', 'PIN на родительский раздел', 'Защита профиля родителя от детей', setGet('p_pin')) +
    switchRow('swTime', 'clock', 'Ограничение времени игр', '30 минут игр в день', setGet('p_time'));
  hydrateIcons();
  wireSwitch('swTheme', null, (on) => { applyTheme(on ? 'dark' : 'light'); localStorage.setItem('mt_theme', on ? 'dark' : 'light'); openSettingsScreen(); });
  wireSwitch('swLessons', 'n_lessons'); wireSwitch('swMsgs', 'n_msgs'); wireSwitch('swCalls', 'n_calls');
  wireSwitch('swPin', 'p_pin'); wireSwitch('swTime', 'p_time');
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'settings'));
  $('#nav').style.display = 'none';
  window.scrollTo({ top: 0 });
}

function wireSwitch(id, key, cb) {
  const el = $('#' + id); if (!el) return;
  el.addEventListener('click', () => {
    const on = !el.classList.contains('switch--on');
    el.classList.toggle('switch--on', on);
    el.setAttribute('aria-checked', on);
    if (key) setPut(key, on);
    if (cb) cb(on);
  });
}

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode === 'dark' ? 'dark' : 'light');
}

// Тема: явный выбор пользователя (mt_theme) важнее; иначе — по системе
function resolveTheme() {
  const saved = localStorage.getItem('mt_theme');
  if (saved) return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function initSystemTheme() {
  if (!window.matchMedia) return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => { if (!localStorage.getItem('mt_theme')) applyTheme(mq.matches ? 'dark' : 'light'); };
  mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange);
}

/* ── Сертификаты ── */
const CERTIFICATES = [
  { key: 'b1', title: 'Глава 1 · Жизнь Господа', short: 'первую главу', award: 'Ученик Господа', earned: true, date: '8 июля 2026' },
  { key: 'b2', title: 'Глава 2 · Ветхий Завет', short: 'вторую главу', award: 'Странник небес', earned: false },
  { key: 'b3', title: 'Глава 3 · Израиль', short: 'третью главу', award: 'Знаток героев', earned: false },
  { key: 'year', title: 'Годовой сертификат школы', short: 'годовую программу', award: 'Выпускник «Метанойя»', earned: false, year: true },
];
const CHILD_FOR_CERT = 'Миша';

function openCertificates() {
  $('#certGrid').innerHTML = CERTIFICATES.map((c) => `
    <button class="cert-card ${c.earned ? 'cert-card--earned' : 'cert-card--locked'} ${c.year ? 'cert-card--year' : ''}" data-cert="${c.key}">
      <div class="cert-card__ribbon">${ICON(c.earned ? 'award' : 'lock', 22)}</div>
      <div class="cert-card__name">${c.title}</div>
      <div class="cert-card__award">${c.year ? 'Диплом выпускника' : '«' + c.award + '»'}</div>
      <div class="cert-card__state">${c.earned ? 'Получен · нажми' : 'Завершите блок'}</div>
    </button>`).join('');
  $$('#certGrid [data-cert]').forEach((el) => el.addEventListener('click', () => {
    const c = CERTIFICATES.find((x) => x.key === el.dataset.cert);
    if (c.earned) openCertView(c); else toast('Сертификат откроется после завершения блока');
  }));
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'certificates'));
  $('#nav').style.display = 'none';
  hydrateIcons();
  window.scrollTo({ top: 0 });
}

function certSVG(cert, name) {
  const line = cert.year
    ? `успешно завершил(а) годовую программу<tspan x="240" dy="26">христианской онлайн-школы «Метанойя»</tspan>`
    : `успешно завершил(а) ${cert.short}<tspan x="240" dy="26">«${cert.title.split('· ')[1] || cert.title}»</tspan>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 660" font-family="'Playfair Display', Georgia, serif">
  <rect width="480" height="660" fill="#FAF8F5"/>
  <rect x="16" y="16" width="448" height="628" fill="none" stroke="#D4A574" stroke-width="3"/>
  <rect x="26" y="26" width="428" height="608" fill="none" stroke="#C97064" stroke-width="1"/>
  <g fill="#D4A574"><circle cx="40" cy="40" r="4"/><circle cx="440" cy="40" r="4"/><circle cx="40" cy="620" r="4"/><circle cx="440" cy="620" r="4"/></g>
  <text x="240" y="92" text-anchor="middle" font-size="15" letter-spacing="6" fill="#1A3A52" font-family="Montserrat, sans-serif">O K O · Т Е А М</text>
  <g transform="translate(240 150)"><path d="M-34 0 C-20 -22 20 -22 34 0 C20 22 -20 22 -34 0 Z" fill="none" stroke="#1A3A52" stroke-width="2.5"/><circle cx="0" cy="0" r="10" fill="#C97064"/><circle cx="0" cy="0" r="4" fill="#FAF8F5"/></g>
  <text x="240" y="230" text-anchor="middle" font-size="44" font-weight="700" fill="#1A3A52" letter-spacing="2">СЕРТИФИКАТ</text>
  <text x="240" y="258" text-anchor="middle" font-size="13" letter-spacing="4" fill="#C97064" font-family="Montserrat, sans-serif">ХРИСТИАНСКАЯ ШКОЛА МЕТАНОЙЯ</text>
  <line x1="180" y1="278" x2="300" y2="278" stroke="#D4A574" stroke-width="1.5"/>
  <text x="240" y="318" text-anchor="middle" font-size="14" fill="#5A6577" font-family="Montserrat, sans-serif">настоящим удостоверяется, что</text>
  <text x="240" y="372" text-anchor="middle" font-size="40" font-weight="700" fill="#C97064">${name}</text>
  <text x="240" y="414" text-anchor="middle" font-size="15" fill="#5A6577" font-family="Montserrat, sans-serif">${line}</text>
  <g transform="translate(240 486)"><circle r="40" fill="none" stroke="#D4A574" stroke-width="2"/><circle r="33" fill="#D4A574" opacity="0.14"/><path d="M0 -20 5 -6 20 -6 8 3 12 18 0 9 -12 18 -8 3 -20 -6 -5 -6 Z" fill="#D4A574"/></g>
  <text x="240" y="556" text-anchor="middle" font-size="14" font-weight="600" fill="#1A3A52">Награда: «${cert.award}»</text>
  <text x="130" y="606" text-anchor="middle" font-size="12" fill="#5A6577" font-family="Montserrat, sans-serif">${cert.date || '____________'}</text>
  <line x1="70" y1="590" x2="190" y2="590" stroke="#5A6577" stroke-width="0.8"/>
  <text x="130" y="622" text-anchor="middle" font-size="10.5" fill="#8A93A0" font-family="Montserrat, sans-serif">дата</text>
  <text x="350" y="600" text-anchor="middle" font-size="15" fill="#1A3A52" font-style="italic">Е. Павленко</text>
  <line x1="290" y1="590" x2="410" y2="590" stroke="#5A6577" stroke-width="0.8"/>
  <text x="350" y="622" text-anchor="middle" font-size="10.5" fill="#8A93A0" font-family="Montserrat, sans-serif">педагог-основатель</text>
</svg>`;
}

let currentCert = null;
function openCertView(cert) {
  currentCert = cert;
  $('#certStage').innerHTML = certSVG(cert, CHILD_FOR_CERT);
  $('#certView').hidden = false;
}

function downloadCert() {
  if (!currentCert) return;
  const svg = certSVG(currentCert, CHILD_FOR_CERT);
  const img = new Image();
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  img.onload = () => {
    const scale = 2, cv = document.createElement('canvas');
    cv.width = 480 * scale; cv.height = 660 * scale;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#FAF8F5'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    cv.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Сертификат-Метанойя-${currentCert.key}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Сертификат сохранён');
    }, 'image/png');
  };
  img.onerror = () => toast('Не удалось сохранить — попробуйте ещё раз');
  img.src = svgUrl;
}

/* ── Ежедневный стих (ритуал дня) ── */
const DAILY_VERSES = [
  { t: 'Так да светит свет ваш пред людьми, чтобы они видели ваши добрые дела', r: 'Матфея 5:16', n: 'Сегодня сделай одно доброе дело — тихо, от сердца.' },
  { t: 'Всё могу в укрепляющем меня Иисусе Христе', r: 'Филиппийцам 4:13', n: 'Если что-то трудно — попроси у Бога сил и попробуй снова.' },
  { t: 'Возлюби ближнего твоего, как самого себя', r: 'Марка 12:31', n: 'Ближний — это тот, кто рядом. Начни с семьи.' },
  { t: 'Бог есть любовь, и пребывающий в любви пребывает в Боге, и Бог в нём', r: '1 Иоанна 4:16', n: 'Где живёт любовь — там и Бог. Согрей сегодня кого-то добротой.', audio: 'assets/audio/verse-day.mp3' },
  { t: 'Просите, и дано будет вам; ищите, и найдёте', r: 'Матфея 7:7', n: 'С Богом можно говорить обо всём. Он слышит.' },
  { t: 'Радуйтесь всегда в Господе', r: 'Филиппийцам 4:4', n: 'Найди сегодня три вещи, за которые скажешь спасибо.' },
  { t: 'Господь — Пастырь мой; я ни в чём не буду нуждаться', r: 'Псалом 22:1', n: 'Пастырь заботится о каждой овечке — и о тебе тоже.' },
  { t: 'Будьте добры друг ко другу, прощайте', r: 'Ефесянам 4:32', n: 'Прощать трудно, но это делает сердце лёгким.' },
  { t: 'Не бойся, ибо Я с тобою', r: 'Исаии 41:10', n: 'Когда страшно — вспомни: ты не один.' },
  { t: 'Блаженны чистые сердцем, ибо они Бога узрят', r: 'Матфея 5:8', n: 'Чистое сердце — как чистое окошко: через него виден свет.' },
];

function todayKey() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function dayIndex() { const d = new Date(); const start = new Date(d.getFullYear(), 0, 0); return Math.floor((d - start) / 86400000); }

function openDailyVerse() {
  // Витрина: показываем озвученный стих, чтобы сразу услышать голос (в проде — по дню)
  const voicedIdx = DAILY_VERSES.findIndex((x) => x.audio);
  const v = DAILY_VERSES[voicedIdx >= 0 ? voicedIdx : (dayIndex() % DAILY_VERSES.length)];
  const claimedToday = localStorage.getItem('mt_dverse_date') === todayKey();
  const streak = Number(localStorage.getItem('mt_dverse_streak') || 0);
  $('#dverseText').textContent = '«' + v.t + '»';
  $('#dverseRef').textContent = v.r;
  $('#dverseNote').textContent = v.n;
  // озвучка стиха (реальная запись голосом)
  const audioEl = $('#dverseAudio');
  const listenBtn = $('#dverseListen');
  if (v.audio) {
    audioEl.src = v.audio;
    listenBtn.hidden = false;
    $('#dverseListenLbl').textContent = 'Послушать голосом';
    listenBtn.classList.remove('dverse__listen--playing');
  } else {
    listenBtn.hidden = true;
    audioEl.pause();
    audioEl.removeAttribute('src');
  }
  const btn = $('#dverseClaim');
  btn.disabled = claimedToday;
  btn.textContent = claimedToday ? 'Стих на сегодня прочитан ✓' : 'Прочитал(а) · получить +5 XP';
  $('#dverseStreak').textContent = streak > 0 ? `🔥 ${streak} ${plural(streak, 'день', 'дня', 'дней')} подряд со стихом дня` : '';
  $('#dailyVerse').hidden = false;
  hydrateIcons();
}

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function claimDailyVerse() {
  if (localStorage.getItem('mt_dverse_date') === todayKey()) return;
  const last = localStorage.getItem('mt_dverse_date');
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yKey = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
  let streak = Number(localStorage.getItem('mt_dverse_streak') || 0);
  streak = last === yKey ? streak + 1 : 1;
  localStorage.setItem('mt_dverse_date', todayKey());
  localStorage.setItem('mt_dverse_streak', String(streak));
  if (window.MAGIC) {
    const b = $('#dverseClaim').getBoundingClientRect();
    MAGIC.celebrate(b.left + b.width / 2, b.top);
  }
  openDailyVerse();
  toast('+5 XP · стих дня');
}

/* ── Три в ряд: Дары Духа (match-3) ── */
const M3_SYM = [
  { icon: 'dove', color: '#7AAED4' },
  { icon: 'flame', color: '#E07A4E' },
  { icon: 'heart', color: '#D46A6A' },
  { icon: 'star', color: '#E6C079' },
  { icon: 'book', color: '#9B7AD4' },
  { icon: 'cross', color: '#7BC67A' },
];
const M3_ROWS = 7, M3_COLS = 6, M3_TARGET = 400;
let m3 = { grid: [], score: 0, moves: 18, sel: null, busy: false };

function m3Rand() { return Math.floor(Math.random() * M3_SYM.length); }

function m3FindMatches() {
  const set = new Set();
  for (let r = 0; r < M3_ROWS; r++) {
    for (let c = 0; c < M3_COLS; c++) {
      const v = m3.grid[r][c];
      if (v < 0) continue;
      // горизонталь
      if (c + 2 < M3_COLS && m3.grid[r][c + 1] === v && m3.grid[r][c + 2] === v) {
        let k = c; while (k < M3_COLS && m3.grid[r][k] === v) { set.add(r + ',' + k); k++; }
      }
      // вертикаль
      if (r + 2 < M3_ROWS && m3.grid[r + 1][c] === v && m3.grid[r + 2][c] === v) {
        let k = r; while (k < M3_ROWS && m3.grid[k][c] === v) { set.add(k + ',' + c); k++; }
      }
    }
  }
  return set;
}

function m3Gravity() {
  for (let c = 0; c < M3_COLS; c++) {
    const col = [];
    for (let r = M3_ROWS - 1; r >= 0; r--) if (m3.grid[r][c] >= 0) col.push(m3.grid[r][c]);
    for (let r = M3_ROWS - 1; r >= 0; r--) m3.grid[r][c] = col.length ? col.shift() : m3Rand();
  }
}

function m3Resolve(score) {
  let any = false;
  while (true) {
    const m = m3FindMatches();
    if (m.size === 0) break;
    any = true;
    if (score) m3.score += m.size * 10;
    m.forEach((k) => { const [r, c] = k.split(',').map(Number); m3.grid[r][c] = -1; });
    m3Gravity();
  }
  return any;
}

function openMatch3() {
  m3 = { grid: [], score: 0, moves: 18, sel: null, busy: false };
  for (let r = 0; r < M3_ROWS; r++) { m3.grid[r] = []; for (let c = 0; c < M3_COLS; c++) m3.grid[r][c] = m3Rand(); }
  m3Resolve(false); // устаканить без очков
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'match3'));
  $('#nav').style.display = 'none';
  renderM3();
  window.scrollTo({ top: 0 });
}

function renderM3() {
  $('#m3Score').textContent = m3.score;
  $('#m3Moves').textContent = m3.moves;
  $('#m3Target').textContent = M3_TARGET;
  $('#m3Bar').style.width = Math.min(100, Math.round(m3.score / M3_TARGET * 100)) + '%';
  const g = $('#m3grid');
  g.innerHTML = '';
  for (let r = 0; r < M3_ROWS; r++) for (let c = 0; c < M3_COLS; c++) {
    const v = m3.grid[r][c];
    const cell = document.createElement('button');
    cell.className = 'm3-cell' + (m3.sel && m3.sel[0] === r && m3.sel[1] === c ? ' m3-cell--on' : '');
    cell.style.background = M3_SYM[v].color;
    cell.innerHTML = ICON(M3_SYM[v].icon, 22);
    cell.addEventListener('click', () => m3Tap(r, c));
    g.appendChild(cell);
  }
}

function m3Tap(r, c) {
  if (m3.busy || m3.moves <= 0) return;
  if (!m3.sel) { m3.sel = [r, c]; renderM3(); return; }
  const [sr, sc] = m3.sel;
  if (sr === r && sc === c) { m3.sel = null; renderM3(); return; }
  const adjacent = Math.abs(sr - r) + Math.abs(sc - c) === 1;
  if (!adjacent) { m3.sel = [r, c]; renderM3(); return; }
  // пробуем обмен
  m3.busy = true;
  [m3.grid[sr][sc], m3.grid[r][c]] = [m3.grid[r][c], m3.grid[sr][sc]];
  const before = m3.score;
  const matched = m3Resolve(true);
  m3.sel = null;
  if (!matched) {
    [m3.grid[sr][sc], m3.grid[r][c]] = [m3.grid[r][c], m3.grid[sr][sc]]; // откат
    m3.busy = false;
    renderM3();
    return;
  }
  m3.moves--;
  renderM3();
  m3.busy = false;
  if (window.MAGIC && m3.score > before) {
    const b = $('#m3grid').getBoundingClientRect();
    MAGIC.celebrate(b.left + b.width / 2, b.top + b.height / 3);
  }
  if (m3.score >= M3_TARGET) m3End(true);
  else if (m3.moves <= 0) m3End(false);
}

function m3End(win) {
  m3.busy = true;
  if (window.MAGIC) MAGIC.rewardModal(win
    ? { icon: 'sparkle', title: 'Уровень пройден!', subtitle: `Ты собрал ${m3.score} очков. Дары Духа приумножаются!`, xp: 30 }
    : { icon: 'flame', title: 'Ходы закончились', subtitle: `Набрано ${m3.score} из ${M3_TARGET}. Попробуй ещё раз — получится!`, xp: 0 });
  else toast(win ? 'Уровень пройден!' : 'Ходы закончились');
  setTimeout(openGamesHub, win ? 1600 : 1400);
}

/* ── Давид и Голиаф (меткость по таймингу) ── */
const DAVID_GOAL = 3, DAVID_STONES = 5;
let david = { stones: DAVID_STONES, hits: 0, pos: 0, dir: 1, speed: 1.6, zoneL: 40, zoneW: 20, raf: 0, busy: false };

function openDavid() {
  david = { stones: DAVID_STONES, hits: 0, pos: 0, dir: 1, speed: 1.6, zoneL: 40, zoneW: 20, raf: 0, busy: false };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'david'));
  $('#nav').style.display = 'none';
  $('#davidFig').innerHTML = ICON('users', 40);
  $('#davidHint').textContent = 'Останови метку в золотой зоне — и попадёшь Голиафу в лоб';
  $('#davidHint').style.color = '';
  $('#davidFire').disabled = false;
  davidPlaceZone();
  davidRender();
  davidLoop();
  window.scrollTo({ top: 0 });
}

function davidPlaceZone() {
  const max = 100 - david.zoneW;
  david.zoneL = 15 + Math.random() * (max - 20);
  $('#davidZone').style.left = david.zoneL + '%';
  $('#davidZone').style.width = david.zoneW + '%';
}

function davidLoop() {
  cancelAnimationFrame(david.raf);
  const step = () => {
    if (david.busy) return;
    david.pos += david.dir * david.speed;
    if (david.pos >= 100) { david.pos = 100; david.dir = -1; }
    if (david.pos <= 0) { david.pos = 0; david.dir = 1; }
    $('#davidMarker').style.left = david.pos + '%';
    david.raf = requestAnimationFrame(step);
  };
  david.raf = requestAnimationFrame(step);
}

function davidRender() {
  $('#davidStones').textContent = david.stones;
  $('#davidHits').textContent = david.hits;
  $('#davidGoal').textContent = DAVID_GOAL;
  $('#davidMarker').style.left = david.pos + '%';
}

function davidFire() {
  if (david.busy || david.stones <= 0) return;
  cancelAnimationFrame(david.raf);
  const hit = david.pos >= david.zoneL && david.pos <= david.zoneL + david.zoneW;
  david.stones--;
  const hint = $('#davidHint');
  if (hit) {
    david.hits++;
    david.speed = Math.min(3.2, david.speed + 0.35); // сложнее с каждым попаданием
    david.zoneW = Math.max(11, david.zoneW - 2);
    hint.style.color = 'var(--success)';
    hint.textContent = 'Точно в цель! 🎯';
    $('#davidFig').classList.add('david-goliath__fig--hit');
    if (window.MAGIC) {
      const t = $('#davidTarget').getBoundingClientRect();
      MAGIC.celebrate(t.left + t.width / 2, t.top + t.height / 2);
    }
    setTimeout(() => $('#davidFig').classList.remove('david-goliath__fig--hit'), 400);
  } else {
    hint.style.color = 'var(--terracotta)';
    hint.textContent = 'Мимо! Целься спокойнее.';
  }
  davidRender();
  if (david.hits >= DAVID_GOAL) return davidEnd(true);
  if (david.stones <= 0) return davidEnd(false);
  david.busy = true;
  setTimeout(() => { david.busy = false; davidPlaceZone(); davidLoop(); }, 650);
}

function davidEnd(win) {
  cancelAnimationFrame(david.raf);
  $('#davidFire').disabled = true;
  const xp = win ? 25 : 0;
  if (window.MAGIC) MAGIC.rewardModal(win
    ? { icon: 'target', title: 'Голиаф повержен!', subtitle: 'С верой и меткостью даже великан не страшен. Как Давид — ты победил!', xp }
    : { icon: 'target', title: 'Камни закончились', subtitle: `Попаданий: ${david.hits} из ${DAVID_GOAL}. Давид тоже тренировался — попробуй ещё!`, xp });
  else toast(win ? 'Голиаф повержен!' : 'Камни закончились');
  setTimeout(openGamesHub, win ? 1700 : 1400);
}

/* ── Исход: собери манну (аркада на время) ── */
const EXODUS_GOAL = 15, EXODUS_TIME = 30;
let exodus = { score: 0, time: EXODUS_TIME, spawn: 0, tick: 0, running: false };

function openExodus() {
  exodusStop();
  exodus = { score: 0, time: EXODUS_TIME, spawn: 0, tick: 0, running: false };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'exodus'));
  $('#nav').style.display = 'none';
  $('#exodusScore').textContent = '0';
  $('#exodusGoal').textContent = EXODUS_GOAL;
  $('#exodusTime').textContent = EXODUS_TIME;
  $('#exodusBar').style.width = '0%';
  const start = $('#exodusStart');
  if (start) start.style.display = '';
  window.scrollTo({ top: 0 });
}

function exodusStop() {
  clearInterval(exodus.spawn); clearInterval(exodus.tick);
  exodus.spawn = 0; exodus.tick = 0; exodus.running = false;
}

function exodusStart() {
  if (exodus.running) return;
  exodus.running = true;
  const start = $('#exodusStart');
  if (start) start.style.display = 'none';
  exodus.tick = setInterval(() => {
    exodus.time--;
    $('#exodusTime').textContent = Math.max(0, exodus.time);
    if (exodus.time <= 0) exodusEnd();
  }, 1000);
  exodus.spawn = setInterval(exodusSpawn, 720);
  exodusSpawn();
}

function exodusSpawn() {
  const field = $('#exodusField');
  if (!field) return;
  const stone = Math.random() < 0.25;
  const el = document.createElement('button');
  el.className = 'exodus-item ' + (stone ? 'exodus-item--stone' : 'exodus-item--manna');
  el.innerHTML = ICON(stone ? 'circle' : 'sparkle', stone ? 26 : 24);
  const x = 6 + Math.random() * 78, y = 8 + Math.random() * 74;
  el.style.left = x + '%'; el.style.top = y + '%';
  el.addEventListener('click', () => {
    if (!exodus.running || el.classList.contains('exodus-item--gone')) return;
    el.classList.add('exodus-item--gone');
    if (stone) {
      exodus.score = Math.max(0, exodus.score - 1);
    } else {
      exodus.score++;
      if (window.MAGIC) { const r = el.getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top + r.height / 2); }
    }
    $('#exodusScore').textContent = exodus.score;
    $('#exodusBar').style.width = Math.min(100, Math.round(exodus.score / EXODUS_GOAL * 100)) + '%';
    setTimeout(() => el.remove(), 120);
    if (exodus.score >= EXODUS_GOAL) exodusEnd();
  });
  field.appendChild(el);
  setTimeout(() => { el.classList.add('exodus-item--gone'); setTimeout(() => el.remove(), 200); }, 1150);
}

function exodusEnd() {
  const win = exodus.score >= EXODUS_GOAL;
  exodusStop();
  $$('#exodusField .exodus-item').forEach((e) => e.remove());
  if (window.MAGIC) MAGIC.rewardModal(win
    ? { icon: 'sparkle', title: 'Манна собрана!', subtitle: `Ты собрал ${exodus.score} манны, как народ в пустыне. Господь заботится о Своих!`, xp: 25 }
    : { icon: 'map', title: 'Время вышло', subtitle: `Собрано ${exodus.score} из ${EXODUS_GOAL}. Ещё попытка — и получится!`, xp: exodus.score >= 8 ? 10 : 0 });
  else toast(win ? 'Манна собрана!' : 'Время вышло');
  setTimeout(openGamesHub, win ? 1700 : 1400);
}

/* ── Ноев Ковчег: собери пары животных ── */
const ARK_ANIMALS = [
  { icon: 'dove', img: 'dove', color: '#7AAED4' },
  { icon: 'fish', img: 'fish', color: '#4FA6A6' },
  { icon: 'turtle', img: 'turtle', color: '#7B9E5A' },
  { icon: 'rabbit', img: 'rabbit', color: '#C98BA0' },
  { icon: 'bird', img: 'bird', color: '#E0954E' },
  { icon: 'butterfly', img: 'butterfly', color: '#9B7AD4' },
];
const ARK_TIME = 45;
let ark = { cards: [], sel: null, pairs: 0, time: ARK_TIME, tick: 0, busy: false };

function openArk() {
  arkStop();
  const deck = [];
  ARK_ANIMALS.forEach((a, i) => { deck.push({ id: i, ...a }); deck.push({ id: i, ...a }); });
  // детерминированная тасовка
  for (let i = deck.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  ark = { cards: deck, sel: null, pairs: 0, time: ARK_TIME, tick: 0, busy: false };
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'ark'));
  $('#nav').style.display = 'none';
  $('#arkTotal').textContent = ARK_ANIMALS.length;
  $('#arkPairs').textContent = '0';
  $('#arkTime').textContent = ARK_TIME;
  $('#arkWater').style.height = '0%';
  renderArk();
  ark.tick = setInterval(() => {
    ark.time--;
    $('#arkTime').textContent = Math.max(0, ark.time);
    $('#arkWater').style.height = Math.min(100, Math.round((ARK_TIME - ark.time) / ARK_TIME * 100)) + '%';
    if (ark.time <= 0) arkEnd(false);
  }, 1000);
  window.scrollTo({ top: 0 });
}

function arkStop() { clearInterval(ark.tick); ark.tick = 0; }

function renderArk() {
  const g = $('#arkGrid');
  g.innerHTML = '';
  ark.cards.forEach((c, idx) => {
    const cell = document.createElement('button');
    cell.className = 'ark-card ark-card--img' + (c.done ? ' ark-card--done' : '') + (ark.sel === idx ? ' ark-card--on' : '');
    cell.style.setProperty('--ac', c.color);
    cell.innerHTML = `<img src="assets/img/ark/${c.img}.jpg" alt="" loading="lazy">`;
    cell.addEventListener('click', () => arkTap(idx));
    g.appendChild(cell);
  });
}

function arkTap(idx) {
  if (ark.busy || ark.cards[idx].done) return;
  if (ark.sel === null) { ark.sel = idx; renderArk(); return; }
  if (ark.sel === idx) { ark.sel = null; renderArk(); return; }
  const a = ark.cards[ark.sel], b = ark.cards[idx];
  if (a.id === b.id) {
    ark.cards[ark.sel].done = true; ark.cards[idx].done = true;
    ark.pairs++;
    $('#arkPairs').textContent = ark.pairs;
    ark.sel = null;
    renderArk();
    if (window.MAGIC) { const r = $('#arkGrid').getBoundingClientRect(); MAGIC.celebrate(r.left + r.width / 2, r.top + r.height / 3); }
    if (ark.pairs >= ARK_ANIMALS.length) arkEnd(true);
  } else {
    // мимо — краткая подсветка и сброс
    ark.busy = true;
    const prev = ark.sel; ark.sel = idx; renderArk();
    const cells = $$('#arkGrid .ark-card');
    cells[prev]?.classList.add('ark-card--miss'); cells[idx]?.classList.add('ark-card--miss');
    setTimeout(() => { ark.sel = null; ark.busy = false; renderArk(); }, 520);
  }
}

function arkEnd(win) {
  arkStop();
  ark.busy = true;
  if (window.MAGIC) MAGIC.rewardModal(win
    ? { icon: 'dove', title: 'Все на борту!', subtitle: 'Ты собрал всех животных парами и спас их от потопа, как Ной. Бог хранит верных!', xp: 30 }
    : { icon: 'dove', title: 'Вода поднялась', subtitle: `На борту ${ark.pairs} из ${ARK_ANIMALS.length} пар. Попробуй ещё — успеешь!`, xp: ark.pairs >= 4 ? 12 : 0 });
  else toast(win ? 'Все на борту!' : 'Вода поднялась');
  setTimeout(openGamesHub, win ? 1800 : 1400);
}

/* ── Магазин за баллы (идея Екатерины #12) ── */
const SHOP_XP = 340; // демо-баланс ребёнка (в проде — реальный XP)
const MERCH = [
  { icon: 'sparkle', name: 'Набор наклеек', cost: 300 },
  { icon: 'book', name: 'Закладка для книг', cost: 700 },
  { icon: 'star', name: 'Значок-магнит', cost: 900 },
  { icon: 'cup', name: 'Кружка Метанойи', cost: 1500 },
  { icon: 'crown', name: 'Футболка', cost: 2500 },
  { icon: 'church', name: 'Худи Метанойи', cost: 4000 },
];

function openShop() {
  const el = $('#shopTileXp');
  $('#shopXp').textContent = SHOP_XP;
  $('#shopGrid').innerHTML = MERCH.map((m) => {
    const can = SHOP_XP >= m.cost;
    return `<div class="shop-card ${can ? '' : 'shop-card--locked'}">
      <div class="shop-card__ic">${ICON(m.icon, 24)}</div>
      <div class="shop-card__name">${m.name}</div>
      <div class="shop-card__cost">${m.cost} XP</div>
      <button class="shop-card__btn" data-merch="${m.name}" data-cost="${m.cost}" ${can ? '' : 'disabled'}>${can ? 'Обменять' : `ещё ${m.cost - SHOP_XP}`}</button>
    </div>`;
  }).join('');
  $$('#shopGrid [data-merch]').forEach((b) => b.addEventListener('click', () => {
    if (window.MAGIC) MAGIC.rewardModal({ icon: 'trophy', title: 'Заявка принята!', subtitle: `Ты обменял баллы на «${b.dataset.merch}». Мы свяжемся с родителями, чтобы передать подарок 🎁`, xp: 0 });
    else toast('Заявка на подарок принята');
  }));
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'shop'));
  $('#nav').style.display = 'none';
  hydrateIcons();
  window.scrollTo({ top: 0 });
}

/* ── Годовой альбом «Наш год с Метанойей» (УЛ7) ── */
const ALBUM = { child: 'Миша', year: '2025–2026', lessons: 24, games: 41, days: 128, temple: 'построен' };

function openAlbumScreen() {
  const earned = CHILD_BADGES.filter((b) => b.earned);
  $('#albumPages').innerHTML = `
    <div class="alb-page alb-page--cover">
      <div class="alb-cover__dove">${ICON('dove', 26)}</div>
      <div class="alb-cover__eyebrow">Семейный альбом</div>
      <div class="alb-cover__title">Наш год<br>с Метанойей</div>
      <div class="alb-cover__fam">Семья · ${ALBUM.child} и близкие</div>
      <div class="alb-cover__year">Учебный год ${ALBUM.year}</div>
    </div>
    <div class="alb-page alb-page--light">
      <div class="alb-page__t">Что мы прошли</div>
      <div class="alb-page__sub">Целый год маленьких шагов к большому</div>
      <div class="alb-stats">
        <div class="alb-stat"><div class="alb-stat__n">${ALBUM.lessons}</div><div class="alb-stat__l">уроков пройдено</div></div>
        <div class="alb-stat"><div class="alb-stat__n">${ALBUM.games}</div><div class="alb-stat__l">игр сыграно</div></div>
        <div class="alb-stat"><div class="alb-stat__n">${ALBUM.days}</div><div class="alb-stat__l">дней в приложении</div></div>
        <div class="alb-stat"><div class="alb-stat__n">${earned.length}</div><div class="alb-stat__l">значков собрано</div></div>
      </div>
    </div>
    <div class="alb-page alb-page--light">
      <div class="alb-page__t">Наши значки</div>
      <div class="alb-page__sub">Каждый — за настоящее старание</div>
      <div class="alb-badges">${earned.map((b) => `<div class="alb-badge"><div class="alb-badge__ic">${ICON(b.icon, 22)}</div><div class="alb-badge__n">${b.name}</div></div>`).join('')}</div>
    </div>
    <div class="alb-page alb-page--light">
      <div class="alb-page__t">Мы делали это вместе</div>
      <div class="alb-page__sub">Семейные квесты года</div>
      <div class="alb-quests">
        <div class="alb-quest"><span class="alb-quest__ic">${ICON('check', 15)}</span> «Благодарное сердце» — говорили спасибо за ужином</div>
        <div class="alb-quest"><span class="alb-quest__ic">${ICON('check', 15)}</span> Читали книгу «Метанойя» всей семьёй</div>
        <div class="alb-quest"><span class="alb-quest__ic">${ICON('check', 15)}</span> Молились вместе перед сном</div>
      </div>
    </div>`;
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'album'));
  $('#nav').style.display = 'none';
  hydrateIcons();
  window.scrollTo({ top: 0 });
}

function albumCoverSVG() {
  const b = CHILD_BADGES.filter((x) => x.earned).length;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 660" font-family="'Playfair Display', Georgia, serif">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A3A52"/><stop offset="0.7" stop-color="#2c4f6b"/><stop offset="1" stop-color="#C97064"/></linearGradient></defs>
  <rect width="480" height="660" fill="url(#g)"/>
  <rect x="20" y="20" width="440" height="620" fill="none" stroke="#D4A574" stroke-width="2"/>
  <g transform="translate(240 130)"><circle r="34" fill="rgba(255,255,255,0.12)"/><path d="M-24 0 C-14 -16 14 -16 24 0 C14 16 -14 16 -24 0 Z" fill="none" stroke="#D4A574" stroke-width="2.5"/><circle cx="0" cy="0" r="7" fill="#D4A574"/></g>
  <text x="240" y="215" text-anchor="middle" font-size="13" letter-spacing="6" fill="#D4A574" font-family="Montserrat, sans-serif">СЕМЕЙНЫЙ АЛЬБОМ</text>
  <text x="240" y="272" text-anchor="middle" font-size="42" font-weight="700" fill="#fff">Наш год</text>
  <text x="240" y="318" text-anchor="middle" font-size="42" font-weight="700" fill="#fff">с Метанойей</text>
  <text x="240" y="366" text-anchor="middle" font-size="16" fill="#EAF0F5" font-family="Montserrat, sans-serif">Семья · ${ALBUM.child} и близкие</text>
  <rect x="150" y="392" width="180" height="34" rx="17" fill="none" stroke="rgba(255,255,255,0.4)"/>
  <text x="240" y="414" text-anchor="middle" font-size="14" fill="#fff" font-family="Montserrat, sans-serif">Учебный год ${ALBUM.year}</text>
  <g font-family="Montserrat, sans-serif">
    <text x="120" y="500" text-anchor="middle" font-size="30" font-weight="700" fill="#D4A574">${ALBUM.lessons}</text><text x="120" y="522" text-anchor="middle" font-size="11" fill="#EAF0F5">уроков</text>
    <text x="240" y="500" text-anchor="middle" font-size="30" font-weight="700" fill="#D4A574">${ALBUM.games}</text><text x="240" y="522" text-anchor="middle" font-size="11" fill="#EAF0F5">игр</text>
    <text x="360" y="500" text-anchor="middle" font-size="30" font-weight="700" fill="#D4A574">${b}</text><text x="360" y="522" text-anchor="middle" font-size="11" fill="#EAF0F5">значков</text>
  </g>
  <text x="240" y="600" text-anchor="middle" font-size="13" fill="rgba(255,255,255,0.75)" font-family="Montserrat, sans-serif">OKO TEAM · с заботой о духовном росте детей</text>
</svg>`;
}

function downloadAlbum() {
  const svg = albumCoverSVG();
  const img = new Image();
  img.onload = () => {
    const s = 2, cv = document.createElement('canvas');
    cv.width = 480 * s; cv.height = 660 * s;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    cv.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Наш-год-с-Метанойей.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('Обложка альбома сохранена');
    }, 'image/png');
  };
  img.onerror = () => toast('Не удалось сохранить — попробуйте ещё раз');
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/* ── Автономный режим (УЛ6) ── */
function updateOffline() {
  const bar = document.getElementById('offlineBar');
  if (!bar) return;
  if (!navigator.onLine) {
    bar.hidden = false;
    requestAnimationFrame(() => bar.classList.add('offbar--on'));
  } else {
    bar.classList.remove('offbar--on');
    setTimeout(() => { if (navigator.onLine) bar.hidden = true; }, 420);
  }
}
function initOffline() {
  window.addEventListener('online', updateOffline);
  window.addEventListener('offline', updateOffline);
  updateOffline();
}

/* ── Добавить ребёнка ── */
function initialAvatar(name, color) {
  const ch = (name.trim()[0] || '?').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${color}"/><text x="50" y="50" dy="0.35em" text-anchor="middle" font-family="Playfair Display, Georgia, serif" font-size="46" font-weight="700" fill="#fff">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
const AVATAR_OPTS = [
  { type: 'img', src: 'assets/img/avatars/lion.jpg' },
  { type: 'img', src: 'assets/img/avatars/star.jpg' },
  { type: 'ini', color: '#9B7AD4' },
  { type: 'ini', color: '#7AAED4' },
];
let addkAge = 7, addkPick = 0;

function loadSavedKids() {
  const saved = JSON.parse(localStorage.getItem('mt_kids') || '[]');
  saved.forEach((k) => { if (!DEMO.children.some((c) => c.name === k.name && c.age === k.age)) DEMO.children.push(k); });
}

function openAddChild() {
  addkAge = 7; addkPick = 0;
  $('#addkName').value = '';
  $('#addkAge').textContent = addkAge;
  renderAddkAvatars();
  $('#addChild').hidden = false;
  hydrateIcons();
  setTimeout(() => $('#addkName').focus(), 100);
}

function renderAddkAvatars() {
  const name = $('#addkName').value || '?';
  $('#addkAvatars').innerHTML = AVATAR_OPTS.map((o, i) => {
    const inner = o.type === 'img' ? `<img src="${o.src}" alt="">` : `<span style="width:100%;height:100%;display:grid;place-items:center;background:${o.color}">${(name.trim()[0] || '?').toUpperCase()}</span>`;
    return `<button type="button" class="addk__ava ${i === addkPick ? 'addk__ava--on' : ''}" data-av="${i}">${inner}</button>`;
  }).join('');
  $$('#addkAvatars [data-av]').forEach((el) => el.addEventListener('click', () => { addkPick = Number(el.dataset.av); renderAddkAvatars(); }));
}

function saveChild() {
  const name = $('#addkName').value.trim();
  if (!name) { $('#addkName').focus(); toast('Введите имя ребёнка'); return; }
  const opt = AVATAR_OPTS[addkPick];
  const img = opt.type === 'img' ? opt.src : initialAvatar(name, opt.color);
  const kid = { name, age: addkAge, rank: 'Зёрнышко · 0 XP', streak: 0, img };
  DEMO.children.push(kid);
  const saved = JSON.parse(localStorage.getItem('mt_kids') || '[]');
  saved.push(kid);
  localStorage.setItem('mt_kids', JSON.stringify(saved));
  renderChildren();
  $('#addChild').hidden = true;
  if (window.MAGIC) MAGIC.rewardModal({ icon: 'sparkle', title: 'Ребёнок добавлен!', subtitle: `${name} теперь в вашей семье Метанойя. Начните первый урок вместе.`, xp: 0 });
  else toast(`${name} добавлен(а)`);
}

function initAddChild() {
  $('#addChildBtn')?.addEventListener('click', openAddChild);
  $('#addkClose')?.addEventListener('click', () => { $('#addChild').hidden = true; });
  $('#addkMinus')?.addEventListener('click', () => { addkAge = Math.max(3, addkAge - 1); $('#addkAge').textContent = addkAge; });
  $('#addkPlus')?.addEventListener('click', () => { addkAge = Math.min(16, addkAge + 1); $('#addkAge').textContent = addkAge; });
  $('#addkName')?.addEventListener('input', renderAddkAvatars);
  $('#addkSave')?.addEventListener('click', saveChild);
}

/* ── Задать вопрос · тёплый помощник ──
   Ответы курируются педагогом на материалах школы.
   Чувствительные темы не разбираются, а мягко переводятся на родителей. */
const ASK_SENSITIVE = ['умереть', 'умру', 'убить', 'убью', 'не хочу жить', 'бьют', 'бьёт', 'ударил', 'больно делают', 'ненавижу себя', 'обижают', 'страшно дома', 'секрет от родителей'];
const ASK_ANSWERS = [
  { kw: ['видит', 'следит', 'плохой', 'накажет', 'наказыва'], a: 'Бог смотрит на тебя не как строгий надзиратель, а как любящий Отец. Он видит твоё сердце и радуется, когда ты стараешься. А если ошибся — Он всегда готов простить. Ты для Него очень дорог.', ref: '1 Иоанна 4:18' },
  { kw: ['молит', 'помолиться', 'как говорить с бог'], a: 'Молиться — это просто говорить с Богом своими словами, как с близким другом. Можно поблагодарить, попросить о ком-то или рассказать, что на душе. Не нужно особых слов — Он слышит даже шёпот сердца.', ref: 'Матфея 6:6' },
  { kw: ['животн', 'хомяч', 'собак', 'кошк', 'питомец', 'умер', 'умерл'], a: 'Когда кто-то, кого мы любим, уходит, нам очень грустно — и это нормально, так любит сердце. Бог заботится о всём Своём творении, и Он рядом с тобой в этой грусти. Хорошо поделиться этими чувствами с мамой или папой.', ref: 'Псалом 144:9' },
  { kw: ['страшно', 'боюсь', 'страх', 'темнот'], a: 'Когда страшно, вспомни: ты не один. Бог обещал быть рядом всегда, даже в темноте. Можно тихо сказать: «Господи, будь со мной» — и сделать медленный вдох. И обязательно расскажи близким, что тебя пугает.', ref: 'Исаии 41:10' },
  { kw: ['создал мир', 'кто создал', 'откуда всё', 'сотвор'], a: 'Библия говорит, что в начале Бог сотворил небо и землю — солнце, море, зверей и людей. Он вложил в мир красоту и порядок. А тебя Он создал особенным, не похожим ни на кого.', ref: 'Бытие 1:1' },
  { kw: ['кто такой иисус', 'иисус', 'христ'], a: 'Иисус — Сын Божий, Который пришёл на землю, чтобы показать нам любовь Отца. Он исцелял, прощал и рассказывал добрые истории — притчи. А ещё Он очень любит детей.', ref: 'Марка 10:14' },
  { kw: ['рай', 'небес', 'после смерти'], a: 'Рай — это место, где Бог, и где нет боли и слёз, только свет и радость. Об этом хорошо думать без страха, а с тихой надеждой. Если у тебя есть вопросы посложнее — здорово обсудить их с родителями.', ref: 'Откровение 21:4' },
  { kw: ['прост', 'виноват', 'плохо поступил', 'обманул', 'соврал'], a: 'Каждый иногда ошибается — это часть роста. Важно честно признать, попросить прощения и постараться исправить. Бог прощает тех, кто приходит к Нему с открытым сердцем. И близкие тоже тебя любят.', ref: 'Псалом 50:12' },
  { kw: ['любит ли бог', 'бог меня люб', 'зачем я'], a: 'Бог любит тебя не за оценки и не за поведение, а просто потому, что ты — Его. Ты нужен в этом мире. Даже когда кажется, что ты один, Его любовь рядом.', ref: 'Иеремия 31:3' },
  { kw: ['грустно', 'плачу', 'печаль', 'одиноко'], a: 'Грусть приходит ко всем, и в ней нет ничего стыдного. Бог близок к тем, у кого болит сердце. Попробуй рассказать о своих чувствах маме или папе — вместе легче.', ref: 'Псалом 33:19' },
];

let askInited = false;
function openAsk() {
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'ask'));
  $('#nav').style.display = 'none';
  if (!askInited) {
    $('#askThread').innerHTML = '';
    askPush('bot', 'Привет! Я тёплый помощник школы Метанойя. Можешь спросить меня о Боге, вере или о том, что тебя тревожит. Я здесь, чтобы поддержать 🕊');
    renderAskChips();
    askInited = true;
  }
  window.scrollTo({ top: 0 });
}

function renderAskChips() {
  const chips = ['Бог видит, когда я плохой?', 'Как правильно молиться?', 'Куда попадают животные?', 'Почему бывает страшно?', 'Кто создал мир?'];
  $('#askSuggest').innerHTML = chips.map((c) => `<button class="ask-chip" type="button">${c}</button>`).join('');
  $$('#askSuggest .ask-chip').forEach((el) => el.addEventListener('click', () => askAsk(el.textContent)));
}

function askPush(who, text, ref, care) {
  const div = document.createElement('div');
  div.className = `ask-msg ask-msg--${who}${care ? ' ask-msg--care' : ''}`;
  div.innerHTML = text + (ref ? `<span class="ask-msg__ref">${ref}</span>` : '');
  $('#askThread').appendChild(div);
  $('#askThread').scrollTop = $('#askThread').scrollHeight;
}

function askMatch(text) {
  const t = text.toLowerCase();
  if (ASK_SENSITIVE.some((k) => t.includes(k))) {
    return { care: true, a: 'Мне важно то, что ты сейчас чувствуешь, и ты правильно сделал, что сказал об этом. С таким лучше всего поговорить с мамой, папой или с Екатериной — они любят тебя и помогут. Ты не один, и это не твоя вина. Пожалуйста, обратись к близкому взрослому прямо сейчас.', ref: 'Псалом 33:19' };
  }
  const hit = ASK_ANSWERS.find((x) => x.kw.some((k) => t.includes(k)));
  if (hit) return hit;
  return { a: 'Хороший вопрос! Я пока учусь и не на всё знаю ответ. Но точно знаю: Бог любит тебя, и рядом всегда есть взрослые, которые помогут разобраться. Можешь спросить об этом маму, папу или Екатерину — а ещё загляни в уроки, там много ответов.', ref: null };
}

function askAsk(text) {
  askPush('me', text);
  const r = askMatch(text);
  setTimeout(() => askPush('bot', r.a, r.ref, r.care), 450);
}

function initAsk() {
  $('#openAsk')?.addEventListener('click', openAsk);
  $('#askBack')?.addEventListener('click', () => { $('#nav').style.display = 'none'; openChild(DEMO.children[0]); });
  $('#askForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#askField').value.trim();
    if (!v) return;
    $('#askField').value = '';
    askAsk(v);
  });
}

/* ── Семейный квест недели (УЛ3) ── */
const FQ = {
  title: 'Благодарное сердце',
  sub: 'Квест недели · 1–7 июля',
  tasks: [
    { day: 'Понедельник', text: 'За ужином каждый скажет одно «спасибо» — Богу или близкому.' },
    { day: 'Среда', text: 'Прочитайте вместе одну главу из книги «Метанойя».' },
    { day: 'Пятница', text: 'Пройдите игру «Дилемма» и обсудите выбор всей семьёй.' },
    { day: 'Суббота', text: 'Сделайте одно доброе дело для соседа или друга.' },
    { day: 'Воскресенье', text: 'Короткая совместная молитва перед сном.' },
  ],
};
let fqDone = JSON.parse(localStorage.getItem('mt_quest') || '[]'); // индексы выполненных

function fqProgress() { return { done: fqDone.length, total: FQ.tasks.length }; }

function renderQuestCard() {
  const { done, total } = fqProgress();
  const pct = Math.round((done / total) * 100);
  const bar = $('#fqCardBar'); if (bar) bar.style.width = pct + '%';
  const st = $('#fqCardStage'); if (st) st.innerHTML = `«${FQ.title}» · ${done}/${total} <span data-icon="play" data-size="13" style="color:var(--terracotta)"></span>`;
  hydrateIcons();
}

function openQuest() {
  $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'quest'));
  $('#nav').style.display = 'none';
  renderQuest();
  window.scrollTo({ top: 0 });
}

function renderQuest() {
  const { done, total } = fqProgress();
  const all = done === total;
  $('#fqTitle').textContent = '«' + FQ.title + '»';
  $('#fqSub').textContent = FQ.sub;
  $('#fqBar').style.width = Math.round((done / total) * 100) + '%';
  $('#fqCount').textContent = all ? 'Квест выполнен! Значок недели ваш 🎉' : `${done} из ${total} дел сделано`;
  $('#fqBadge').classList.toggle('fq-head__badge--done', all);
  $('#fqTasks').innerHTML = FQ.tasks.map((t, i) => {
    const d = fqDone.includes(i);
    return `<button class="fq-task ${d ? 'fq-task--done' : ''}" data-fq="${i}">
      <div class="fq-task__check">${d ? ICON('check', 15) : ''}</div>
      <div class="fq-task__body"><div class="fq-task__day">${t.day}</div><div class="fq-task__text">${t.text}</div></div>
    </button>`;
  }).join('');
  $$('#fqTasks [data-fq]').forEach((el) => el.addEventListener('click', () => toggleFq(Number(el.dataset.fq))));
  hydrateIcons();
}

function toggleFq(i) {
  const was = fqDone.includes(i);
  if (was) fqDone = fqDone.filter((x) => x !== i);
  else fqDone.push(i);
  localStorage.setItem('mt_quest', JSON.stringify(fqDone));
  const nowAll = !was && fqDone.length === FQ.tasks.length;
  renderQuest();
  renderQuestCard();
  if (nowAll && window.MAGIC) {
    const r = $('#fqBadge').getBoundingClientRect();
    MAGIC.celebrate(r.left + r.width / 2, r.top + r.height / 2);
    setTimeout(() => MAGIC.rewardModal({ icon: 'users', title: 'Семейный значок недели!', subtitle: 'Вы прошли квест «' + FQ.title + '» всей семьёй. Так рождается традиция.', xp: 0 }), 350);
  } else if (!was && window.MAGIC) {
    const r = $('#fqTasks').querySelector(`[data-fq="${i}"]`)?.getBoundingClientRect();
    if (r) MAGIC.celebrate(r.left + r.width / 2, r.top + 10);
  }
}

/* ── Родительский отчёт за неделю (УЛ2) ── */
const WREPORT = {
  child: 'Миша', ava: 'assets/img/avatars/lion.jpg', range: '1–7 июля',
  lessons: 3, games: 8, streak: 12, streakUp: true,
  rankNote: 'До ранга «Цветочек» осталось <b>60 XP</b> — это примерно два урока.',
  tips: [
    'На этой неделе Миша дважды возвращался к притче о блудном сыне. Хороший момент поговорить о прощении за семейным ужином.',
    'Серия из 12 дней подряд — похвалите его за постоянство, это важнее скорости.',
    'Он пока не открывал «Хронологию». Предложите пройти её вместе — заодно повторите порядок событий Писания.',
  ],
};

function renderWReport() {
  const w = WREPORT;
  $('#wreport').innerHTML = `
    <div class="wreport__head">
      <div class="wreport__ava"><img src="${w.ava}" alt=""></div>
      <div><div class="wreport__who">${w.child}</div><div class="wreport__range">${w.range} · итоги недели</div></div>
    </div>
    <div class="wreport__stats">
      <div class="wstat"><div class="wstat__num">${w.lessons}</div><div class="wstat__lbl">уроков<br>пройдено</div></div>
      <div class="wstat"><div class="wstat__num">${w.games}</div><div class="wstat__lbl">игр<br>сыграно</div></div>
      <div class="wstat"><div class="wstat__num">${w.streak} <small class="${w.streakUp ? 'wstat__up' : 'wstat__down'}">${w.streakUp ? '↑' : '↓'}</small></div><div class="wstat__lbl">дней<br>подряд</div></div>
    </div>
    <div class="wreport__dyn">${ICON('trophy', 16)}<span>${w.rankNote}</span></div>
    <div class="wreport__tips-t">О чём поговорить с ребёнком</div>
    ${w.tips.map((t) => `<div class="wtip"><div class="wtip__ic">${ICON('heart', 14)}</div><span>${t}</span></div>`).join('')}
    <div class="wreport__foot">Отчёт обновляется каждое воскресенье · только для родителя</div>`;
  hydrateIcons();
}

function initGrowth() {
  $('#openRating')?.addEventListener('click', openRatingScreen);
  $('#openCerts')?.addEventListener('click', openCertificates);
  $('#openShop')?.addEventListener('click', openShop);
  $('#shopBack')?.addEventListener('click', () => { $('#nav').style.display = 'none'; openChild(DEMO.children[0]); });
  $('#openDevotional')?.addEventListener('click', openDevotional);
  $('#devBack')?.addEventListener('click', () => { $('#nav').style.display = ''; switchTab('profile'); });
  $('#openQuest')?.addEventListener('click', openQuest);
  $('#questBack')?.addEventListener('click', () => { $('#nav').style.display = ''; switchTab('profile'); });
  $('#openAlbum')?.addEventListener('click', openAlbumScreen);
  $('#albumBack')?.addEventListener('click', () => { $('#nav').style.display = ''; switchTab('profile'); });
  $('#albumDl')?.addEventListener('click', downloadAlbum);
  initAsk();
  $('#dverseClose')?.addEventListener('click', () => { const a = $('#dverseAudio'); if (a) a.pause(); $('#dailyVerse').hidden = true; });
  $('#dverseClaim')?.addEventListener('click', claimDailyVerse);
  $('#dverseListen')?.addEventListener('click', () => {
    const a = $('#dverseAudio'); const btn = $('#dverseListen'); const lbl = $('#dverseListenLbl');
    if (!a || !a.getAttribute('src')) return;
    if (a.paused) { a.play(); btn.classList.add('dverse__listen--playing'); lbl.textContent = 'Пауза'; }
    else { a.pause(); btn.classList.remove('dverse__listen--playing'); lbl.textContent = 'Послушать голосом'; }
  });
  $('#dverseAudio')?.addEventListener('ended', () => {
    $('#dverseListen')?.classList.remove('dverse__listen--playing');
    const lbl = $('#dverseListenLbl'); if (lbl) lbl.textContent = 'Послушать ещё раз';
  });
  // Esc закрывает открытую модалку/шторку (a11y)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const modals = ['#msgActions', '#userCard', '#attachSheet', '#dmSheet', '#sheetWrap', '#certView', '#dailyVerse', '#addChild', '#gamePreview', '#notifPanel', '#pinModal', '#storyViewer'];
    for (const sel of modals) { const el = $(sel); if (el && !el.hidden) { el.hidden = true; return; } }
  });
  $('#certsBack')?.addEventListener('click', () => { $('#nav').style.display = 'none'; openChild(DEMO.children[0]); });
  $('#certClose')?.addEventListener('click', () => { $('#certView').hidden = true; });
  $('#certDl')?.addEventListener('click', downloadCert);
  $('#ratingBack')?.addEventListener('click', () => { $('#nav').style.display = 'none'; openChild(DEMO.children[0]); });
  $('#mSubscribe')?.addEventListener('click', openSubscribeScreen);
  $('#subBack')?.addEventListener('click', () => { $('#nav').style.display = ''; switchTab('profile'); });
  $('#mPartner')?.addEventListener('click', openPartner);
  $('#partnerBack')?.addEventListener('click', () => { $('#nav').style.display = ''; switchTab('profile'); });
  $('#partnerCta')?.addEventListener('click', () => {
    const p = PARTNER_PLANS.find((x) => x.key === partnerPlan);
    if (window.MAGIC) MAGIC.rewardModal({ icon: 'dove', title: 'Спасибо, что вы с нами!', subtitle: `Тариф «${p.name}» (${p.amt}/мес). Как только подключим оплату — оформим партнёрство. Ваша поддержка бесценна.`, xp: 0 });
    else toast('Спасибо за поддержку!');
  });
  $('#mDonate')?.addEventListener('click', openDonate);
  $('#donateBack')?.addEventListener('click', () => { $('#nav').style.display = ''; switchTab('profile'); });
  $('#donateCta')?.addEventListener('click', () => {
    const custom = Number($('#donateCustom').value);
    const amt = custom > 0 ? custom : donateAmt;
    if (window.MAGIC) MAGIC.rewardModal({ icon: 'heart', title: 'Спасибо от всего сердца!', subtitle: `Ваш дар ${amt} ₽ поможет школе. Как только подключим оплату — примем с благодарностью 🕊`, xp: 0 });
    else toast('Спасибо за поддержку!');
  });
  $('#subCta')?.addEventListener('click', () => {
    localStorage.setItem('mt_plus', '1');
    const p = SUB_PLANS.find((x) => x.key === subPlan);
    if (window.MAGIC) MAGIC.rewardModal({ icon: 'crown', title: 'Метанойя+ активирована!', subtitle: `Тариф «${p.name}». Дополнительные игры, личные уроки и сертификаты открыты.`, xp: 0 });
    else toast('Метанойя+ активирована');
    setTimeout(openSubscribeScreen, 300);
  });
  $('#mSettings')?.addEventListener('click', openSettingsScreen);
  $('#mNotify')?.addEventListener('click', openSettingsScreen);
  $('#mParental')?.addEventListener('click', openSettingsScreen);
  $('#setBack')?.addEventListener('click', () => { $('#nav').style.display = ''; switchTab('profile'); });
  $('#mSupport')?.addEventListener('click', () => {
    switchTab('chats');
    toast('Напишите нам в «Поддержку» — отвечаем в течение дня');
  });
  $('#mLogout')?.addEventListener('click', () => {
    try { localStorage.removeItem('mt_auth'); } catch (e) {}
    const auth = $('#auth'); if (auth) auth.hidden = false;
    window.scrollTo({ top: 0 });
    toast('Вы вышли из аккаунта');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyTheme(resolveTheme());
  initSystemTheme();
  hydrateIcons();
  if (window.MAGIC && document.getElementById('splashFx')) MAGIC.ambientMotes(document.getElementById('splashFx'));
  renderStories();
  renderFeed();
  renderChats();
  unlockAllLessons();
  renderLessons();
  loadSavedKids();
  renderChildren();
  renderWReport();
  renderQuestCard();
  renderWishes();
  initAddChild();
  initOffline();
  initNav();
  initSW();

  tickCountdown();
  setInterval(tickCountdown, 60_000);

  $('#dailyVerseBtn').addEventListener('click', openDailyVerse);
  $('#joinCall')?.addEventListener('click', () => toast('Запись на созвон скоро откроется'));
  $('#avatarBtn').addEventListener('click', () => switchTab('profile'));
  $('#searchBtn')?.addEventListener('click', () => {
    $$('.nav__tab').forEach((b) => b.classList.remove('nav__tab--active'));
    $$('.screen').forEach((s) => s.classList.toggle('screen--active', s.dataset.screen === 'search'));
    $('#nav').style.display = '';
    setTimeout(() => $('#searchInput')?.focus(), 100);
    window.scrollTo({ top: 0 });
  });
  $$('.menu-item:not([id])').forEach((el) =>
    el.addEventListener('click', () => toast('Этот раздел скоро появится')));
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
  initChatSearch();
  initVerseGame();
  initTemple();
  initJourney();
  initBook();
  initGamesHub();
  initMemory();
  initQuiz();
  initGrowth();
  renderSchedule();
  if (window.visualViewport) {
    const vvSync = () => document.documentElement.style.setProperty('--vvh', window.visualViewport.height + 'px');
    window.visualViewport.addEventListener('resize', vvSync);
    vvSync();
  }
  initVoice();
  initAttach();
  initDm();
  initUserCard();
  initMsgActions();
  initLesson();
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
