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

## Прокси для IG
mobileproxy.space #537454 (мобильный, сейчас гео Казахстан/Алматы). Вход/пароль/API — `IG_PROXY_*` в secrets.
Смена оборудования/IP: API `mobileproxy.space/api.html` (Bearer `IG_PROXY_API_TOKEN`),
команды `reboot_proxy`, `change_equipment&id_country=<id>`, `get_id_country&only_avaliable=1`.

## Как «намертво» держать вход
1. «Сохранить данные для входа» нажато (IG помнит устройство).
2. Постоянный профиль браузера `ig_dsnew` на VPS + `storageState` в этой папке (дубль).
3. Заходить с того же мобильного прокси и не чистить профиль.
