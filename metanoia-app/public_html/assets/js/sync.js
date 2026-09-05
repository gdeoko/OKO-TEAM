/* ══════════════════════════════════════════════════════════════
   МЕТАНОЙЯ · sync.js · прогресс между устройствами

   Пока сервера нет, приложение живёт целиком на устройстве.
   Этот слой спит и ничего не делает. Он просыпается сам, когда
   в index.html заполнен адрес сервера:

     <meta name="mt-api" content="https://app.metanoia-180.ru/api/v1">

   и в браузере лежит токен входа (mt_token) с выбранным ребёнком
   (mt_child_id). Тогда всё состояние уходит на сервер снимком, а на
   новом устройстве возвращается обратно.

   Разбор конфликтов простой: у снимка есть номер ревизии, больше
   номер — свежее данные. Телефон и планшет одного ребёнка сходятся
   без вопросов родителю.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const META = document.querySelector('meta[name="mt-api"]');
  const БАЗА = (META && META.content || '').replace(/\/+$/, '');

  // Ключи устройства: тема экрана и звук у каждого свои, их не возим.
  const МЕСТНЫЕ = ['mt_theme', 'mt_music_off', 'mt_reader_fs', 'mt_dev_day',
    'mt_onb', 'mt_auth', 'mt_token', 'mt_child_id', 'mt_rev', 'mt_sync_at'];

  const токен = () => localStorage.getItem('mt_token') || '';
  const ребёнок = () => localStorage.getItem('mt_child_id') || '';
  const включён = () => !!(БАЗА && токен() && ребёнок());

  function ревизия() { return Number(localStorage.getItem('mt_rev') || 0); }
  function поднятьРевизию() { localStorage.setItem('mt_rev', String(ревизия() + 1)); }

  /** Всё состояние ребёнка одним объектом. */
  function снимок() {
    const s = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('mt_') || МЕСТНЫЕ.includes(k)) continue;
      s[k] = localStorage.getItem(k);
    }
    // Числа для родительской зоны берём отдельно, серверу их читать проще.
    let pet = null;
    try { pet = JSON.parse(localStorage.getItem('mt_pet') || 'null'); } catch (e) { pet = null; }
    return {
      keys: s,
      xp: pet && Number(pet.зёрна) || 0,
      level: pet && Number(pet.стадия) + 1 || 1,
      streak: {
        current: Number(localStorage.getItem('mt_dverse_streak') || 0),
        best: Number(localStorage.getItem('mt_dverse_best') || 0),
        last: localStorage.getItem('mt_dverse_date') || '',
      },
    };
  }

  /** Разложить снимок с сервера обратно по ключам. */
  function применить(state) {
    const keys = state && state.keys;
    if (!keys) return false;
    let менялось = false;
    Object.keys(keys).forEach((k) => {
      if (!k.startsWith('mt_') || МЕСТНЫЕ.includes(k)) return;
      if (localStorage.getItem(k) !== keys[k]) {
        origSetItem.call(localStorage, k, keys[k]);
        менялось = true;
      }
    });
    return менялось;
  }

  async function запрос(путь, опции) {
    const r = await fetch(БАЗА + путь, Object.assign({
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + токен(),
      },
    }, опции || {}));
    const тело = await r.json().catch(() => ({}));
    if (!r.ok || тело.success === false) {
      const err = new Error(тело.error || ('Сервер ответил ' + r.status));
      err.code = r.status;
      throw err;
    }
    return тело.data;
  }

  /* ── Отправка: копим правки и шлём пачкой, а не на каждый клик ── */
  let таймер = null;
  let вПути = false;

  function отправитьПозже() {
    if (!включён()) return;
    clearTimeout(таймер);
    таймер = setTimeout(отправить, 3000);
  }

  async function отправить() {
    if (!включён() || вПути) return;
    вПути = true;
    try {
      const rev = ревизия() || 1;
      await запрос('/progress/' + ребёнок(), {
        method: 'PUT',
        body: JSON.stringify({ rev: rev, state: снимок() }),
      });
      localStorage.setItem('mt_sync_at', String(Date.now()));
    } catch (e) {
      // 409: на сервере прогресс свежее, значит забираем его и не спорим.
      if (e.code === 409) { вПути = false; return забрать(); }
      // Связи нет — попробуем в следующий раз, данные никуда не делись.
    }
    вПути = false;
  }

  async function забрать() {
    if (!включён()) return;
    try {
      const d = await запрос('/progress/' + ребёнок());
      const серверная = Number(d && d.rev || 0);
      if (серверная > ревизия()) {
        if (применить(d.state)) {
          localStorage.setItem('mt_rev', String(серверная));
          // Экраны уже нарисованы старыми данными, честнее перерисовать всё.
          if (!sessionStorage.getItem('mt_sync_reload')) {
            sessionStorage.setItem('mt_sync_reload', '1');
            location.reload();
          }
        } else {
          localStorage.setItem('mt_rev', String(серверная));
        }
      } else if (серверная < ревизия()) {
        отправить();
      }
    } catch (e) { /* нет связи — работаем на устройстве */ }
  }

  /* ── Перехват записи: любое сохранение приложения помечает правку ── */
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) {
    origSetItem(k, v);
    if (typeof k === 'string' && k.startsWith('mt_') && !МЕСТНЫЕ.includes(k)) {
      поднятьРевизию();
      отправитьПозже();
    }
  };

  // Уходя со страницы, досылаем то, что не успело уйти по таймеру.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { clearTimeout(таймер); отправить(); }
  });

  window.addEventListener('load', () => {
    sessionStorage.removeItem('mt_sync_reload');
    забрать();
  });

  window.MT_SYNC = {
    включён: включён,
    забрать: забрать,
    отправить: отправить,
    снимок: снимок,
    ревизия: ревизия,
  };
})();
