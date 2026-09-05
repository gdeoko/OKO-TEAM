/* ══════════════════════════════════════════════════════════════
   МЕТАНОЙЯ · tasks.js · интерактивные задания к урокам
   Пять типов: пары, порядок, найди на картинке, пропущенное слово, ребус.
   Задание собирается из содержания урока, поэтому есть у всех 105 уроков.
   Свои задания Екатерины кладутся в window.TASKS[номер] и перебивают авто.
   ══════════════════════════════════════════════════════════════ */

'use strict';

(function () {

  const ТИПЫ = ['pairs', 'order', 'gap', 'rebus', 'find'];

  /* ── вспомогательное ── */

  function перемешать(arr, seed) {
    // Перемешивание с постоянным зерном: задание не прыгает при каждом входе
    const a = arr.slice();
    let s = seed || 7;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor(s / 233280 * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function слова(текст) {
    return String(текст || '').replace(/[«»„“”"]/g, '').split(/\s+/).filter(Boolean);
  }

  function чистое(слово) {
    return String(слово || '').replace(/[.,!?;:()]/g, '');
  }

  function длинные(текст, минДлина) {
    return слова(текст).map(чистое)
      .filter((w) => w.length >= (минДлина || 6) && /^[А-Яа-яЁё-]+$/.test(w));
  }

  function предложения(текст) {
    return String(текст || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 20);
  }

  /* ── сборка задания по содержанию урока ── */

  function собрать(n, c) {
    if (!c) return null;
    const свои = (typeof window !== 'undefined' && window.TASKS) ? window.TASKS[n] : null;
    if (свои) return свои;

    const тип = ТИПЫ[n % ТИПЫ.length];
    const делатель = { pairs: пары, order: порядок, gap: пропуск, rebus: ребус, find: найди }[тип];
    return делатель(n, c) || пропуск(n, c) || null;
  }

  /* 1. Соединить пары: вопрос и правильный ответ */
  function пары(n, c) {
    const quiz = (c.quiz || []).filter((q) => q.opts && q.opts[q.answer]);
    if (quiz.length < 3) return null;
    const список = quiz.slice(0, 3).map((q) => ({ лево: q.q, право: q.opts[q.answer] }));
    return {
      тип: 'pairs',
      заголовок: 'Соедини пары',
      подсказка: 'Нажми вопрос, потом его ответ. Правильная пара загорится',
      пары: список,
      право: перемешать(список.map((p) => p.право), n * 13 + 5),
    };
  }

  /* 2. Расставить по порядку: как всё было в рассказе */
  function порядок(n, c) {
    const все = (c.story || []).flatMap(предложения);
    if (все.length < 4) return null;
    const шаг = Math.max(1, Math.floor(все.length / 4));
    const верно = [все[0], все[шаг], все[шаг * 2], все[Math.min(шаг * 3, все.length - 1)]]
      .map((s) => s.length > 120 ? s.slice(0, 117).trim() + '…' : s);
    if (new Set(верно).size < 4) return null;
    return {
      тип: 'order',
      заголовок: 'Расставь по порядку',
      подсказка: 'Как всё было в рассказе? Нажимай по очереди, с самого начала',
      верно,
      карточки: перемешать(верно, n * 7 + 3),
    };
  }

  /* 3. Вставить пропущенное слово в стих */
  function пропуск(n, c) {
    const текст = c.verse && c.verse.text ? c.verse.text : (c.golden || '');
    const кандидаты = длинные(текст, 6);
    if (!кандидаты.length) return null;
    const слово = кандидаты[n % кандидаты.length];
    const части = слова(текст);
    const i = части.findIndex((w) => чистое(w) === слово);
    if (i < 0) return null;

    const чужие = ['радость', 'дорога', 'молитва', 'надежда', 'терпение', 'милость', 'истина', 'сердце']
      .filter((w) => w !== слово.toLowerCase());
    const варианты = перемешать([слово, чужие[n % чужие.length], чужие[(n + 3) % чужие.length]], n * 11 + 2);

    return {
      тип: 'gap',
      заголовок: 'Вставь слово в стих',
      подсказка: 'Какое слово пропало из стиха?',
      до: части.slice(0, i).join(' '),
      после: части.slice(i + 1).join(' '),
      ссылка: c.verse && c.verse.ref ? c.verse.ref : '',
      верно: слово,
      варианты,
    };
  }

  /* 4. Ребус: собрать слово из слогов */
  function ребус(n, c) {
    const источник = c.golden || (c.verse && c.verse.text) || '';
    const кандидаты = длинные(источник, 7);
    if (!кандидаты.length) return null;
    const слово = кандидаты[n % кандидаты.length].toLowerCase();

    // Режем на куски по 2-3 буквы, чтобы читалось как слоги
    const куски = [];
    for (let i = 0; i < слово.length;) {
      const шаг = (слово.length - i) === 4 ? 2 : ((i % 2 === 0) ? 3 : 2);
      куски.push(слово.slice(i, i + шаг));
      i += шаг;
    }
    if (куски.length < 2) return null;

    return {
      тип: 'rebus',
      заголовок: 'Собери слово',
      подсказка: 'Слово из золотой мысли рассыпалось на слоги. Собери его',
      верно: слово,
      куски: перемешать(куски, n * 5 + 9),
    };
  }

  /* 5. Найди правильное: выбрать нужную карточку из нескольких */
  function найди(n, c) {
    const q = (c.quiz || [])[0];
    if (!q || !q.opts || q.opts.length < 3) return null;
    return {
      тип: 'find',
      заголовок: 'Найди правильное',
      подсказка: q.q,
      верно: q.opts[q.answer],
      карточки: q.opts.slice(),
    };
  }

  /* ── отрисовка ── */

  function разметка(з) {
    if (!з) return '';
    const шапка = `<div class="task__head"><span class="task__kind">${з.заголовок}</span>
      <span class="task__hint">${з.подсказка}</span></div>`;

    if (з.тип === 'pairs') {
      return `<div class="task task--pairs" data-task="pairs">${шапка}
        <div class="task__cols">
          <div class="task__col">${з.пары.map((p, i) =>
            `<button class="tcard tcard--left" data-left="${i}">${p.лево}</button>`).join('')}</div>
          <div class="task__col">${з.право.map((t, i) =>
            `<button class="tcard tcard--right" data-right="${i}">${t}</button>`).join('')}</div>
        </div>
        <div class="task__res" hidden></div></div>`;
    }

    if (з.тип === 'order') {
      return `<div class="task task--order" data-task="order">${шапка}
        <div class="task__slots" data-slots></div>
        <div class="task__pool">${з.карточки.map((t, i) =>
          `<button class="tcard tcard--wide" data-card="${i}">${t}</button>`).join('')}</div>
        <div class="task__res" hidden></div></div>`;
    }

    if (з.тип === 'gap') {
      return `<div class="task task--gap" data-task="gap">${шапка}
        <div class="task__verse">${з.до} <span class="task__blank" data-blank>…</span> ${з.после}
          ${з.ссылка ? `<cite>${з.ссылка}</cite>` : ''}</div>
        <div class="task__pool">${з.варианты.map((t, i) =>
          `<button class="tcard" data-word="${i}">${t}</button>`).join('')}</div>
        <div class="task__res" hidden></div></div>`;
    }

    if (з.тип === 'rebus') {
      return `<div class="task task--rebus" data-task="rebus">${шапка}
        <div class="task__built" data-built></div>
        <div class="task__pool">${з.куски.map((t, i) =>
          `<button class="tcard tcard--syl" data-syl="${i}">${t}</button>`).join('')}</div>
        <button class="task__reset" data-reset>Собрать заново</button>
        <div class="task__res" hidden></div></div>`;
    }

    if (з.тип === 'find') {
      return `<div class="task task--find" data-task="find">${шапка}
        <div class="task__pool task__pool--grid">${з.карточки.map((t, i) =>
          `<button class="tcard tcard--big" data-find="${i}">${t}</button>`).join('')}</div>
        <div class="task__res" hidden></div></div>`;
    }
    return '';
  }

  /* ── поведение ── */

  function оживить(корень, з, готово) {
    if (!корень || !з) return;
    const res = корень.querySelector('.task__res');
    const победа = (текст) => {
      res.hidden = false;
      res.className = 'task__res pass';
      res.textContent = текст || 'Верно! Задание выполнено';
      корень.classList.add('task--done');
      if (typeof готово === 'function') готово();
    };
    const промах = (текст) => {
      res.hidden = false;
      res.className = 'task__res fail';
      res.textContent = текст || 'Пока не так. Попробуй ещё раз';
    };

    if (з.тип === 'pairs') {
      let выбрано = null, собрано = 0;
      корень.querySelectorAll('[data-left]').forEach((b) => b.addEventListener('click', () => {
        if (b.classList.contains('tcard--ok')) return;
        корень.querySelectorAll('[data-left]').forEach((x) => x.classList.remove('tcard--sel'));
        b.classList.add('tcard--sel');
        выбрано = Number(b.dataset.left);
      }));
      корень.querySelectorAll('[data-right]').forEach((b) => b.addEventListener('click', () => {
        if (выбрано === null || b.classList.contains('tcard--ok')) return;
        const ждём = з.пары[выбрано].право;
        if (b.textContent.trim() === String(ждём).trim()) {
          b.classList.add('tcard--ok');
          корень.querySelector(`[data-left="${выбрано}"]`).classList.add('tcard--ok');
          корень.querySelectorAll('[data-left]').forEach((x) => x.classList.remove('tcard--sel'));
          выбрано = null; собрано++;
          if (собрано === з.пары.length) победа('Все пары собраны!');
        } else {
          b.classList.add('tcard--miss');
          setTimeout(() => b.classList.remove('tcard--miss'), 420);
          промах();
        }
      }));
    }

    if (з.тип === 'order') {
      const слоты = корень.querySelector('[data-slots]');
      let шаг = 0;
      корень.querySelectorAll('[data-card]').forEach((b) => b.addEventListener('click', () => {
        if (b.classList.contains('tcard--ok')) return;
        if (b.textContent.trim() === String(з.верно[шаг]).trim()) {
          b.classList.add('tcard--ok');
          const el = document.createElement('div');
          el.className = 'tslot';
          el.innerHTML = `<span class="tslot__n">${шаг + 1}</span>${b.textContent}`;
          слоты.appendChild(el);
          шаг++;
          if (шаг === з.верно.length) победа('Порядок собран верно!');
        } else {
          b.classList.add('tcard--miss');
          setTimeout(() => b.classList.remove('tcard--miss'), 420);
          промах('Это было не сейчас. Подумай, что шло раньше');
        }
      }));
    }

    if (з.тип === 'gap') {
      const дырка = корень.querySelector('[data-blank]');
      корень.querySelectorAll('[data-word]').forEach((b) => b.addEventListener('click', () => {
        if (корень.classList.contains('task--done')) return;
        if (b.textContent.trim().toLowerCase() === String(з.верно).toLowerCase()) {
          дырка.textContent = b.textContent;
          дырка.classList.add('task__blank--ok');
          b.classList.add('tcard--ok');
          победа('Слово на месте!');
        } else {
          b.classList.add('tcard--miss');
          setTimeout(() => b.classList.remove('tcard--miss'), 420);
          промах();
        }
      }));
    }

    if (з.тип === 'rebus') {
      const поле = корень.querySelector('[data-built]');
      let собрано = '';
      const обновить = () => { поле.textContent = собрано || '…'; };
      обновить();
      корень.querySelectorAll('[data-syl]').forEach((b) => b.addEventListener('click', () => {
        if (корень.classList.contains('task--done') || b.classList.contains('tcard--ok')) return;
        собрано += b.textContent.trim();
        b.classList.add('tcard--ok');
        обновить();
        if (собрано === з.верно) победа('Слово собрано!');
        else if (собрано.length >= з.верно.length) промах('Получилось другое слово. Нажми «Собрать заново»');
      }));
      корень.querySelector('[data-reset]')?.addEventListener('click', () => {
        собрано = ''; обновить();
        корень.querySelectorAll('[data-syl]').forEach((x) => x.classList.remove('tcard--ok'));
        res.hidden = true;
      });
    }

    if (з.тип === 'find') {
      корень.querySelectorAll('[data-find]').forEach((b) => b.addEventListener('click', () => {
        if (корень.classList.contains('task--done')) return;
        if (b.textContent.trim() === String(з.верно).trim()) { b.classList.add('tcard--ok'); победа(); }
        else {
          b.classList.add('tcard--miss');
          setTimeout(() => b.classList.remove('tcard--miss'), 420);
          промах();
        }
      }));
    }
  }

  window.ЗАДАНИЯ = { собрать, разметка, оживить };
})();
