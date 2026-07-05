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
  $$('#stories .story').forEach((el) =>
    el.addEventListener('click', () => toast('Просмотр Stories — этап 2')));
}

/* ───────── РЕНДЕР: ЛЕНТА ───────── */

function feedCard(item) {
  const actions = `
    <div class="feed-card__actions">
      <button data-act="like">${ICON('heart', 16)} ${item.likes}</button>
      <button data-act="comment">${ICON('comment', 16)} ${item.comments}</button>
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
  $('#feed').innerHTML = DEMO.feed.map(feedCard).join('');
  $$('#feed [data-act]').forEach((el) =>
    el.addEventListener('click', () => toast('Функция подключается на следующих этапах')));
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
  $$('#chatList .chat-item').forEach((el) =>
    el.addEventListener('click', () => toast('Мессенджер — этап 3')));

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
  $$('#children .child-card').forEach((el) =>
    el.addEventListener('click', () => toast('Детский профиль — этап 2')));
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
  $('#bellBtn').addEventListener('click', () => toast('Уведомления — этап 7'));
  $('#avatarBtn').addEventListener('click', () => switchTab('profile'));
  $('#addChildBtn').addEventListener('click', () => toast('Добавление ребёнка — этап 2'));
  $$('.menu-item').forEach((el) =>
    el.addEventListener('click', () => toast('Раздел в разработке')));
  $('#searchInput').addEventListener('input', (e) => {
    $('#searchEmpty').querySelector('p').textContent = e.target.value.length >= 2
      ? `Ничего не найдено по запросу «${e.target.value}». Поиск заработает на этапе 2.`
      : 'Начни вводить запрос — найдём уроки, игры и материалы.';
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
