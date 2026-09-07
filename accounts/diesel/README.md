# DIESEL CARGO — аккаунты клиента (входы)

Раздел «аккаунты клиентов». Доступ во всех сессиях (репо + SessionStart-хук).
Пароли/TOTP — в `secrets.env.b64` (раздел «КЛИЕНТСКИЕ АККАУНТЫ · DIESEL CARGO»).

## Instagram

### @diesel_cargo_top — ПАЧКА A, оформлен и залогинен (07.09.2026)
- Имя: **DIESEL CARGO** · Сайт: **dieselcompany.pro** · Аватар: бренд-крылья DIESEL
- Описание: «Техника из Китая под ключ · Мото/квадро/гидро/спецтехника · Доставка/документы/гарантия · Город в директ → расчёт · dieselcompany.pro»
- Вход: по юзернейму `diesel_cargo_top` + пароль (`IG_DS_TOP_PASS`) + TOTP (`IG_DS_TOP_TOTP`).
  «Сохранить данные для входа» нажато → повторный вход в один тап.
- ds_user_id `24401725552`. Профиль браузера на VPS: `/opt/oko-poster/browser/ig_dsnew`.
- **Сессия (cookies): `ig_diesel_cargo_top_state.json`** в этой папке — грузить в Playwright:
  `chromium.launchPersistentContext(... )` использует профиль, либо
  `browser.newContext({ storageState: "accounts/diesel/ig_diesel_cargo_top_state.json" })`.
  Ходить ТОЛЬКО через мобильный прокси (`IG_PROXY_*`, mobileproxy #537454), не с серверного IP.

### @diesel_cargo_ng (он же вход по почте `cjsusytd@atorymail.com`) — не активирован
- Пароль/2FA верные, но аккаунт требует подтверждения телефона (SMS/WhatsApp). Отложен.

### @diesel_kitay — ПАЧКА B (рабочий ранее), см. `IG_KITAY_*` в secrets.

## TikTok

### @diesel_kitay — «DIESEL CARGO», ПАЧКА A, ЗАЛОГИНЕН (07.09.2026)
- URL: https://www.tiktok.com/@diesel_kitay · аватар: бренд-крылья DIESEL · 3 подписчика, активный (десятки роликов завода уже опубликованы, 240–860 просмотров).
- Вход: email `ssm101002@gmail.com` + пароль `Diesel_(@)8`, код с почты берётся сам (`tt_code.py`).
- Профиль браузера на VPS: `/opt/oko-poster/cfg/tt_diesel_prof`. Сессия (cookies): **`tt_diesel_kitay_state.json`** в этой папке.
- Скрипт входа: `/opt/oko-poster/tt_run.mjs` (форк `tt_diesel_login.mjs`), прокси socks5 `127.0.0.1:10811` (10843 из оригинала — лёг; живые: 10811, 10840).
- Постинг обычно идёт через Hooppy (page 2365299), прямой браузер — для оформления/ручных действий.
- ⚠️ Био содержит «Снегоходы» и эмодзи 📦 — против правил DIESEL (снегоходы не делаем, без эмодзи). Почистить при следующем оформлении.

## Прокси для IG/TikTok
mobileproxy.space #537454 (мобильный, сейчас гео Казахстан/Алматы). Вход/пароль/API — `IG_PROXY_*` в secrets.
Смена оборудования/IP: API `mobileproxy.space/api.html` (Bearer `IG_PROXY_API_TOKEN`),
команды `reboot_proxy`, `change_equipment&id_country=<id>`, `get_id_country&only_avaliable=1`.

## Как «намертво» держать вход
1. «Сохранить данные для входа» нажато (IG помнит устройство).
2. Постоянный профиль браузера `ig_dsnew` на VPS + `storageState` в этой папке (дубль).
3. Заходить с того же мобильного прокси и не чистить профиль.
