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

  // Ключи устройства: тема экрана, звук и размер шрифта у каждого свои.
  // День семейного алтаря, наоборот, общий для семьи и ездит с прогрессом.
  const МЕСТНЫЕ = ['mt_theme', 'mt_music_off', 'mt_reader_fs',
    'mt_onb', 'mt_auth', 'mt_token', 'mt_refresh', 'mt_child_id', 'mt_rev', 'mt_sync_at'];

  const токен = () => localStorage.getItem('mt_token') || '';
  const ребёнок = () => localStorage.getItem('mt_child_id') || '';
  const включён = () => !!(БАЗА && токен() && ребёнок());

  function ревизия() { return Number(localStorage.getItem('mt_rev') || 0); }
  function поднятьРевизию() { localStorage.setItem('mt_rev', String(ревизия() + 1)); }

  // Снимок на сервере ограничен, поэтому тяжёлые записи не возим. Тяжёлой
  // бывает переписка со вложенными снимками: их место на сервере чатов.
  const ПРЕДЕЛ_ЗАПИСИ = 120000;

  /** Всё состояние ребёнка одним объектом. */
  function снимок() {
    const s = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('mt_') || МЕСТНЫЕ.includes(k)) continue;
      const v = localStorage.getItem(k);
      if (v === null || v.length > ПРЕДЕЛ_ЗАПИСИ) continue;
      s[k] = v;
    }
    // Числа для родительской зоны берём отдельно, серверу их читать проще.
    let pet = null;
    try { pet = JSON.parse(localStorage.getItem('mt_pet') || 'null'); } catch (e) { pet = null; }
    return {
      keys: s,
      xp: pet && Number(pet.зёрна) || 0,
      // Стадия друга считается от роста, отдельного поля у неё нет.
      level: (typeof petСтадия === 'function' ? petСтадия() : 0) + 1,
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
      if (typeof keys[k] !== 'string') return; // мусор с чужой версии не кладём
      if (localStorage.getItem(k) !== keys[k]) {
        origSetItem.call(localStorage, k, keys[k]);
        менялось = true;
      }
    });
    return менялось;
  }

  /** Три попытки с паузой: одна оборванная связь не должна стоить семье прогресса. */
  async function сНастойчивостью(дело, раз = 3) {
    let последняя = null;
    for (let i = 0; i < раз; i++) {
      try { return await дело(); } catch (e) {
        последняя = e;
        // Сервер ответил и отказал (нет прав, чужой профиль) — повтор не поможет.
        if (e && e.code && e.code >= 400 && e.code < 500) throw e;
        await new Promise((r) => setTimeout(r, 800 * (i + 1)));
      }
    }
    throw последняя;
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
      const d = await сНастойчивостью(() => запрос('/progress/' + ребёнок()));
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
    } catch (e) {
      if (window.console) console.warn('Метанойя: прогресс с сервера не пришёл', e && e.message);
    }
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

  /* Вход из Телеграма: подпись отдаём серверу, он проверяет её ключом бота
     и возвращает токен. Ребёнка берём первого в семье, если он уже заведён. */
  async function войтиИзТелеграма() {
    const подпись = localStorage.getItem('mt_tg_init');
    if (!БАЗА || !подпись || токен()) return;
    try {
      const d = await сНастойчивостью(() => запрос('/oauth/telegram-webapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ init_data: подпись }),
      }));
      if (d && d.access_token) {
        localStorage.setItem('mt_token', d.access_token);
        localStorage.setItem('mt_auth', '1');
        if (d.user && d.user.name) localStorage.setItem('mt_name', d.user.name);
        const я = await сНастойчивостью(() => запрос('/users/me'));
        const дети = (я && я.children) || [];
        if (дети.length) localStorage.setItem('mt_child_id', String(дети[0].id));
      }
    } catch (e) {
      // Работаем на устройстве, но причину пишем: без неё молчаливый сбой
      // входа не отличить от «сервера просто нет».
      if (window.console) console.warn('Метанойя: вход из Телеграма не удался', e && e.message);
    }
  }

  window.addEventListener('load', async () => {
    sessionStorage.removeItem('mt_sync_reload');
    await войтиИзТелеграма();
    забрать();
  });

  /* Ребёнок, заведённый в приложении, появляется и на сервере: без этого
     переносить прогресс некуда. Молча, ошибки не мешают семье работать. */
  async function завестиРебёнка(имя, возраст) {
    if (!БАЗА || !токен() || ребёнок()) return null;
    try {
      const d = await запрос('/users/children', {
        method: 'POST',
        body: JSON.stringify({ name: имя, age: возраст }),
      });
      if (d && d.id) {
        localStorage.setItem('mt_child_id', String(d.id));
        отправитьПозже();
        return d.id;
      }
    } catch (e) { /* нет связи — заведём при следующем входе */ }
    return null;
  }

  /* ── Вход почтой и паролем ──────────────────────────────
     Пока адреса сервера нет, эти четыре ручки честно отвечают «нет сервера»,
     и приложение остаётся целиком на устройстве. Как только в index.html
     появится mt-api, те же кнопки начинают работать по-настоящему. */

  const естьСервер = () => !!БАЗА;

  /** Разложить ответ входа: токен, имя, первый ребёнок. */
  function принятьВход(d) {
    if (!d || !d.access_token) throw new Error('Сервер не выдал токен');
    localStorage.setItem('mt_token', d.access_token);
    localStorage.setItem('mt_auth', '1');
    if (d.refresh_token) localStorage.setItem('mt_refresh', d.refresh_token);
    if (d.user && d.user.name) localStorage.setItem('mt_name', d.user.name);
    return d;
  }

  async function подхватитьРебёнка() {
    try {
      const я = await сНастойчивостью(() => запрос('/users/me'));
      const дети = (я && я.children) || [];
      if (дети.length) localStorage.setItem('mt_child_id', String(дети[0].id));
      return дети;
    } catch (e) { return []; }
  }

  async function войти(email, пароль) {
    if (!естьСервер()) return null;
    const d = await сНастойчивостью(() => запрос('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email, password: пароль }),
    }));
    принятьВход(d);
    await подхватитьРебёнка();
    await забрать();
    return d;
  }

  async function зарегистрировать(поля) {
    if (!естьСервер()) return null;
    const d = await сНастойчивостью(() => запрос('/auth/register', {
      method: 'POST',
      body: JSON.stringify(поля),
    }));
    принятьВход(d);
    await подхватитьРебёнка();
    return d;
  }

  async function войтиГуглом(idToken) {
    if (!естьСервер()) return null;
    const d = await сНастойчивостью(() => запрос('/oauth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    }));
    принятьВход(d);
    await подхватитьРебёнка();
    await забрать();
    return d;
  }

  async function забылПароль(email) {
    if (!естьСервер()) return null;
    return сНастойчивостью(() => запрос('/auth/forgot', {
      method: 'POST',
      body: JSON.stringify({ email: email }),
    }));
  }

  async function новыйПароль(ключ, пароль) {
    if (!естьСервер()) return null;
    const d = await запрос('/auth/reset', {
      method: 'POST',
      body: JSON.stringify({ token: ключ, password: пароль }),
    });
    принятьВход(d);
    await подхватитьРебёнка();
    await забрать();
    return d;
  }

  /** Стереть аккаунт на сервере вместе с детьми и прогрессом. */
  async function удалитьАккаунт() {
    if (!включён()) return true; // сервера нет, чистим только телефон
    await запрос('/users/me', { method: 'DELETE' });
    return true;
  }

  window.MT_SYNC = {
    включён: включён,
    естьСервер: естьСервер,
    войти: войти,
    зарегистрировать: зарегистрировать,
    войтиГуглом: войтиГуглом,
    забылПароль: забылПароль,
    новыйПароль: новыйПароль,
    удалитьАккаунт: удалитьАккаунт,
    завестиРебёнка: завестиРебёнка,
    забрать: забрать,
    отправить: отправить,
    снимок: снимок,
    ревизия: ревизия,
  };
})();
