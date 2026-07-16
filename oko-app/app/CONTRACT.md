# Контракт модулей OKO APP (обязателен для каждого модуля)

Приложение — ОДИН самодостаточный HTML-файл. Модуль = папка `oko-app/app/modules/<name>/`:
- `style.css` — CSS модуля (вставляется в общий `<style>`)
- `screen.html` — полноэкранные `<section class="screen" id="screen-X">` (внутрь `<main>`)
- `overlay.html` — bottom-sheets (`<div class="sheet" id="sheet-X">`) и fullscreen-вьюхи (вне `#app`)
- `script.js` — JS модуля; исполняется ПОСЛЕ ядра и модулей выше по порядку; самоинициализация в конце файла

Сборка: `python3 oko-app/app/build.py` → `oko-app/prototype/index.html`.

## Жёсткие правила бренда
- НИКАКИХ эмодзи в интерфейсе. Только SVG-иконки.
- Цвета/шрифты только из токенов: `var(--bg) --surface --raised --border --lime --lime-dim --accent --text --dim --danger --r-sm --r-md --r-lg --font-display --font-body --glow`.
- Обе темы обязаны выглядеть хорошо (тёмная по умолчанию + `:root[data-theme="light"]`).
- Тексты на русском, mobile-first (вертикальный телефон), но и десктоп не ломать (max-width контейнеров).
- Классы CSS ТОЛЬКО со своим префиксом модуля (напр. `gm-`, `ac-`, `ads-`) — коллизии запрещены.
- Всё живое: hover/active-состояния, лёгкие анимации (fade-in, pulse, glow), ничего «мёртвого».

## Иконки
`I('name')` → `<svg class="i"><use href="#i-name"/></svg>`. Есть символы:
logo, chat, feed, bolt, users, user, send, mic, clip, file, camera, photo, circle-play, play, pause,
plus, back, chev, sun, moon, heart, comment, share, bookmark, copy, search, check2, compass, bell,
lock, megaphone, globe, star, card, check, clock, flag, thumb, google, apple, phone, logout, crown,
poll, money, eye, briefcase, fire, laugh, wow, sad, pin, reply, edit, trash, forward, pos, sticker,
more, rocket, verified.
Свой символ добавлять JS-ом в `document.querySelector('svg defs')` (как core-ext добавляет i-verified),
стиль штриха: stroke-width 7, округлые концы, viewBox 0 0 100 100.

## API ядра (уже определены, НЕ переопределять)
Хелперы: `I(n,cls)`, `toast(msg)`, `esc(t)`, `fmtN`, `fmtRub(n)`, `openSheet(id)`, `closeSheet()`,
`showTab(t)`, `openMa(id)`, `closeMa()`.
Данные: `PROFILE {name,nick,tier,role,ceo,bio}`, `POSTS {sub,rec}`, `CHATS`, `LISTINGS`, `MK_CATS`,
`PLANS`, `NOTIFS`, `ADMIN`, `ADMIN_TABS`, `admTab`, `renderAdmin()`, `admGo(k)`, `PROGRESS`,
`renderFeed(kind)`, `renderMyProfile()`, `TITLES`.
core-ext: `WALLET {acc,balance,hold,ledger}`, `walletAdd(sum,why)`, `walletCharge(sum,why)->bool`,
`fmtMoney(n)`, `okoEarn(sum,src)`, `okoRevenueTotal()`, `OKO_REVENUE`,
`LANG`, `regT({k:{ru,en}})`, `t(k)`, `onLangChange(fn)`, `setLang(l)`,
`VERIFIED` (Set имён), `vBadge(name)`, `isOwner()`, `adminLogin(email,pass)->Promise<bool>`,
`sealSvg(size,color)` (официальная круглая печать), `signatureImg(w)` (подпись владельца),
`SEAL_REQ`, `showPopup({ico,title,body,actions:[{label,ghost,onclick}]})`, `closePopup()`,
`addSvcTile({id,label,ico,onclick,first})` (тайл в хаб «Мини-аппы»), `regTitle(k,title)`.

## Паттерны
- Новый полноэкранный раздел: `<section class="screen" id="screen-X">` + `regTitle('X','Заголовок')` +
  `addSvcTile(...)` с `onclick:()=>showTab('X')`. Переход назад — нижняя навигация всегда видна.
- Sheet: `<div class="sheet" id="sheet-X">` + `openSheet('X')`.
- Переопределение функции ядра: `имя = function(...){...}` (это допустимо для function declaration),
  прежнюю сохранить: `const _prevИмя = имя;` ДО переопределения. Патчи чужих модулей — через
  `if(typeof fn==='function')`.
- Деньги: ЛЮБОЕ списание — только `walletCharge()`, начисление — `walletAdd()`. Доход владельца
  (комиссии/маржа/реклама/тарифы) — `okoEarn(sum, 'Источник')`.
- Состояние модуля персистить в localStorage под ключом `oko-<модуль>` (try/catch).
- В конце `script.js` — самоинициализация (регистрация тайлов, патчи, первый рендер если экран активен).
- PROGRESS: НЕ трогать (обновляется централизованно).

## Запрещено
- Внешние URL (CDN, шрифты, картинки) — всё inline/SVG/уже вшито. Исключение: явно согласованный
  видео-URL Академии (константа).
- `document.write`, глобальные имена без префикса модуля, правки чужих файлов.
- Эмодзи, лорем-ипсум, «заглушки-пустышки» без поведения.
