# Конспект PHP-референсов заказчика (php_examples/)

Источник: `muzmir_full/PART_4_EXAMPLES/03_materials/php_examples/`
Прочитаны построчно все .php + конфиги. Секреты/токены встречались (Telegram-токены,
Gmail app-passwords, админ-пароли, admin_password '2026', смтп-пароли) — значения НЕ выписываю,
только отмечаю факт: **все креды лежат в открытом виде прямо в коде** (антипаттерн, у нас так не делать).

ВАЖНО: в папке лежат ТРИ разных проекта, а не один:
1. **«Коптилыч»** (koptylich.ru/meat) — магазин копчёностей. Хранилище — плоский `data.json`.
   Файлы: `bot.php` (Telegram-бот на **webhook**), `api.php`, `data.json`, `upload.php`, `_htaccess`.
2. **«OKO TEAM»** (okoteam.top) — служебный бот агентства для Даниэля. Хранилище — `data.json`.
   Файлы: `polling.php` (Telegram-бот на **polling через cron**), `bot_state.json`, `polling_offset.txt`.
3. **«ИА Зановости»** (zanovosti.ru) — новостной сайт-СМИ. Хранилище — **SQLite/PDO**.
   Файлы: `db.php`, `submit.php`, `auth.php`, `admin_api.php`, `articles_api.php`,
   `analytics.php`, `newsletter.php`, `cron.php`, `robots.txt`, `sitemap.xml`.

**Для нашего проекта (PHP+SQLite: конкурсы/заявки/дипломы/ЮKassa/бот/мини-апп) архитектурно
ближе всего проект «Зановости» (SQLite) + оба бота как образцы UX.** ЮKassa нигде нет — у Коптилыча
оплата это ручная ссылка СБП Ozon + загрузка скрина чека, подтверждение вручную из бота.

---

## (1) Что реализовано в референсе — по файлам

### db.php (Зановости, SQLite) — самый ценный образец
- `getDB()`: `new PDO('sqlite:data/database.db')`, `ERRMODE_EXCEPTION`, `PRAGMA journal_mode=WAL`,
  `PRAGMA foreign_keys=ON`. Авто-создание БД при первом обращении (`initDB`) + `ensureTables()`
  для миграции старых баз (докидывает недостающие таблицы). Хорошая идемпотентная схема.
- Таблицы: `users` (email UNIQUE, password_hash, name, avatar, bio, is_club, notify_*, role,
  created_at, last_login), `sessions` (token PK, user_id, expires_at), `articles`
  (id TEXT PK, статусы pending/scheduled/published/rejected, publish_at для отложки, views),
  `subscribers` (email UNIQUE), `analytics`, `pages` (CMS-страницы с meta), `settings` (key/value).
- `settings` как key/value — в т.ч. `admin_password`, smtp-креды, admin_email, from_name.
  **Пароль редактора и админа зашиты дефолтами в код** (антипаттерн).
- `getUser($db,$token)`: JOIN users+sessions по токену с проверкой `expires_at > now`.
- `cleanSessions()`: удаление протухших сессий.
- `sendMail()`: отправка через **Curl SMTP** `smtps://smtp.gmail.com:465` (CURLOPT_MAIL_FROM/RCPT/
  READDATA/UPLOAD), с фолбэком на `mail()`. Тема в `=?UTF-8?B?base64?=`. Авто-детект html/plain.
- `emailTpl($title,$content,$btnText,$btnUrl)`: единый брендовый HTML-шаблон письма (шапка,
  карточка, опц. кнопка, футер). Инлайновые стили.

### auth.php (Зановости) — регистрация/логин/профиль
- Токен читается из `Authorization: Bearer` **или** cookie `zn_token` (двойной источник).
- `register`: валидация email/пароля (min 4), `password_hash(PASSWORD_DEFAULT)`,
  session-token `bin2hex(random_bytes(32))` на 30 дней, HttpOnly-cookie, аватар из base64
  (data-URI, лимит 5MB, whitelist jpeg/png/webp). Письмо-приветствие юзеру + письмо редактору.
- `login`: `password_verify`, обновление last_login, новая сессия.
- `logout`: удаление сессии + сброс cookie.
- `me`: текущий юзер по токену. `update_profile`: частичный UPDATE (сборка полей динамически),
  замена аватара. Везде `htmlspecialchars(strip_tags())` на входе.

### submit.php (Зановости) — приём заявок (статей)
- Только POST (405 иначе), CORS/OPTIONS-префлайт.
- `subscribe`: `INSERT OR IGNORE INTO subscribers` по валидированному email.
- `submit_article`: требует авторизацию (юзер по токену) ЛИБО `$token==='admin'`. Обязательные
  поля category/title/content. id = `art_`+uniqid. Обложка: base64-crop (data-URI, лимит 10MB,
  whitelist форматов) ИЛИ обычный `$_FILES` (move_uploaded_file). Мультизагрузка вложений.
  Статус заявки `pending`. Два письма: автору («принято на модерацию» + номер заявки) и редактору
  («новая заявка» с таблицей). Санитизация `htmlspecialchars(strip_tags())`.

### admin_api.php (Зановости) — модерация
- Auth: `checkAdmin()` сверяет `X-Admin-Key`/`?key` с `settings.admin_password`. (Для POST-мутаций
  проверка ослаблена — комментарий «trust same origin» — **дыра, у нас так не делать**.)
- GET: list/published/page/users/subscribers (с подсчётом статей на автора подзапросом).
- POST: `save_settings`, `save_page` (CMS), `status` (pending/published/rejected — при publish
  рассылка письма автору + всем клубным подписчикам с notify=1; при reject — письмо автору),
  `update` (динамический UPDATE полей + управление обложкой с удалением файла), `delete`
  (удаляет статью + файл обложки).

### articles_api.php (Зановости) — публичная выдача
- GET, фильтр по category, пагинация `limit`(1..50)/`offset`, только `status='published'`,
  JOIN автора (avatar/is_club/role), возврат total + articles. Prepared statements.

### analytics.php (Зановости) — своя аналитика на SQLite
- POST — запись просмотра (page, ts, date, ua→device detect regex, ref, screen, ip). GET — сводка:
  today/week/month/total, топ-страниц, дневная динамика 30д, разбивка по устройствам,
  почасовая активность (`strftime('%H', datetime(ts,'unixepoch'))`), топ-рефереров. Готовый
  self-hosted аналог метрики. **Мелочь-риск:** даты подставляются в query интерполяцией строк
  (не критично т.к. свои `date()`, но у нас лучше prepared).

### newsletter.php (Зановости) — рассылка
- POST subject/body, сегменты target: subs / authors (DISTINCT author_email) / club (is_club=1) / all.
  `array_unique+filter`, валидация email, `emailTpl`+`nl2br(htmlspecialchars())`, `usleep(300000)`
  троттлинг между письмами. Возврат sent-count.

### cron.php (Зановости) — крон
- `cleanSessions()` + публикация отложенных статей: `status='scheduled' AND publish_at<=now`
  → перевод в published, письмо автору + рассылка клубу (notify_new_articles=1). Печатает лог-строку.
  Запуск по системному cron.

### api.php (Коптилыч) — монолитный JSON-API магазина (data.json)
Экшены (switch по `?action`):
- `newOrder`: создаёт заказ в data.json, инкремент order_count, upsert подписчика (счётчик заказов),
  инкремент uses промокода, сохранение скрина чека из base64. Уведомления в Telegram (Артёму с
  инлайн-кнопками Принять/Детали, Даниэлю копия) + письмо админу и клиенту (брендовый HTML-шаблон,
  бонус при сумме ≥3000). 
- `checkPromo` (валидация промокода), `trackOrder` (статус по id), `newReview` (отзыв на модерацию
  + фото base64 + уведомление в TG), `partialSave` (сохранение недооформленной корзины по md5(email)
  — сырьё для «дожимов»/брошенных корзин), `updateStatus` (смена статуса + письмо клиенту + трек СДЭК),
  `approveReview`, `sendNewsletter` (сегменты all/vip(≥2 заказа)/new(1 заказ), throttle usleep),
  `adminSaveProducts/Promos/Reviews`.
- Email: **самописный SMTP на fsockopen** к ssl://smtp.gmail.com:465 (ручной AUTH LOGIN) — грубее,
  чем Curl-SMTP из db.php. У нас брать Curl-вариант.

### upload.php (Коптилыч) — загрузка картинок товаров
- Пароль `?pass` (примитив). uploadImage (whitelist ext, лимит 5MB, санитизация имени),
  deleteImage (`basename()` от path traversal), listImages (glob). Простой файловый менеджер.

### bot.php (Коптилыч) — Telegram-бот на WEBHOOK
- Разделение прав: `isAdmin()` по списку chat_id (ARTEM, DANIEL). Неадминам — приветствие + ссылка
  в магазин. Админам — панель управления инлайн-кнопками.
- Инлайн-меню: Новые заказы / Все заказы / Статистика / Подписчики / Промокоды / Отзывы /
  Открыть магазин(url) / Админка(url).
- Команды: /start, /menu, /stats (быстрая), /new (5 последних новых с кнопками статусов), /help.
- Callback: смена статуса заказа (accept→accepted, prep→preparing, send→sent, done→done) через
  prefix-роутинг `strpos($data,$prefix.'_')===0` + вызов api.php updateStatus (письмо клиенту);
  detail_<id> — карточка заказа. Статистика с топ-товарами, средним чеком, сегментами подписчиков
  (VIP 2+ заказа), список промокодов с числом использований.

### polling.php (OKO TEAM) — Telegram-бот на POLLING (наш стиль, самый релевантный UX)
- Запускается кроном раз в минуту, внутри цикл 6×sleep(10) ≈ покрывает минуту (псевдо-long-poll
  на shared-хостинге без вебхука). Оффсет апдейтов в `polling_offset.txt`, `allowed_updates`
  = message/callback_query/channel_post.
- **Reply-keyboard главное меню** (persistent, resize): Лиды / Оплаты / Продукты / Дожимы /
  Рассылка / Команды. Доступ только у DANIEL (жёсткий chat_id), остальным — заглушка.
- **FSM состояний** через `bot_state.json` (setState/getState/clearState по ключу
  `awaiting_<userId>`): мультишаговые диалоги — поиск клиента, ручное подтверждение оплаты,
  рассылка (сегмент→тема→текст), пост в канал, заметка к клиенту (`note_<email>`).
- Callback-роутинг по префиксам: confirm_pay_/paid_ (подтверждение оплаты → дёргает
  api.php?action=manualConfirm&key=), del_lead_, stop_drip_ (удаляет файлы дожимов
  `partials/md5(email+product).json`), prod_stat_ (конверсия по продукту), nl_seg_ (сегмент рассылки),
  menu_products.
- Разделы: Лиды (всего/оплатили/сегодня + последние 8 + кнопка «Найти клиента» переводит в FSM
  search по email/имени/tg/phone), Оплаты (счётчики день/неделя), Продукты (лиды/оплаты + конверсия),
  Дожимы (активные drip из partials, таймеры дожим1/дожим2), Рассылка (сегменты all/paid/unpaid →
  дёргает api.php sendNewsletter), Команды (статистика сайта, шаблоны и т.д.).
- Реакция на channel_post из @gdeoko — уведомление Даниэлю о новом посте в канале.
- Продукты-конфиг зашит массивом `$PRODUCTS` (6 услуг агентства).

### Конфиги
- `data.json` (Коптилыч): полный каталог товаров (id/name/price/unit/min_qty/step/badge/discount/
  image/description), settings (min_order_kg=2, bonus_threshold=3000, bonus_text, tips_default=100,
  **sbp_link** — оплата через СБП-ссылку Ozon, vk_community, vk_personal, order_count), промокод
  «КЛУБ10» (10% percent). orders/reviews/subscribers пустые.
- `bot_state.json` = `{}`, `polling_offset.txt` = `0` (стартовые).
- `_htaccess`: RewriteRule на защиту `data/` [F], GZIP, cache-политика картинок/css/js,
  security-headers (X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN, X-XSS-Protection,
  Referrer-Policy). Хороший baseline для нашего .htaccess.
- `robots.txt`: закрыты admin.html, data/, uploads/, все служебные .php; ссылка на sitemap.
- `sitemap.xml`: SPA-якорные url c changefreq/priority.

---

## (2) Логика/тексты Telegram-бота, которые стоит перенять

**Стоит перенять напрямую:**
- **Polling-бот через cron с циклом 6×sleep(10)** (polling.php) — идеальный паттерн для shared-хостинга
  без вебхука/HTTPS-эндпоинта. Оффсет в файле. У нас бот @kc_muz_mir_bot — можно так же, если нет
  стабильного webhook.
- **FSM на bot_state.json** (`awaiting_<userId>` → search/confirm/nl_subject/nl_content/channel_post/
  note_<email>) — чистый способ вести мультишаговые диалоги без БД. Для нашего бота: подача заявки на
  конкурс пошагово (ФИО → номинация → возраст → файл), выдача диплома, поиск участника.
- **Persistent reply-keyboard как главное меню** + инлайн-кнопки для действий с prefix-роутингом
  callback_data (`strpos($data,'prefix_')===0`, id/email в хвосте). Компактно и расширяемо.
- **Разграничение прав по chat_id** (`isAdmin`/жёсткий DANIEL) — для админ-функций бота.
- **Кнопка «Подтвердить оплату вручную»** дёргает API с ключом — нам полезно как ручной фолбэк к
  ЮKassa (если вебхук оплаты не пришёл, админ жмёт кнопку → выдаётся диплом/доступ).
- **Уведомление о новой заявке/оплате/отзыве в TG админам сразу** с инлайн-кнопкой действия
  (Принять/Детали) — мгновенный операционный контроль.
- **Дожимы/брошенные корзины**: `partialSave` сохраняет недооформленную заявку, бот показывает
  активные «дожимы» с таймерами, снятие с дожима удаляет файл. Аналог для нас: недооформленная
  заявка на конкурс/недооплата → напоминание.

**Тексты/тон (бренд заказчика, НЕ копировать дословно — у OKO свой стиль без эмодзи, но полезно как
структура сообщений):**
- Карточка заказа: «🆕 Заказ #id / состав / 💰 сумма / 👤 имя / 📞 телефон» + ряд кнопок статусов.
- Быстрая статистика: «Всего заказов / Новых / Выручка / Подписчиков».
- Приветствие неадмину: краткое + ссылка-CTA в магазин.
- Подтверждение оплаты: «Оплата подтверждена / {name} · {email} / Письмо отправлено клиенту».
- Рассылка: сегмент → «Напишите тему письма» → «Теперь напишите текст ({{name}} для персонализации)»
  → «Рассылка завершена. Отправлено: X, Ошибок: Y».
- **NB для OKO:** оба ботов усыпаны эмодзи. По правилу №4 CLAUDE.md — у нас в интерфейсе эмодзи
  запрещены. Перенимать структуру и логику, но тексты писать в brand-стиле (SVG/без эмодзи).

---

## (3) Полезные паттерны заявок/рассылок/крона

**Заявки (submit.php):**
- POST-only + CORS-префлайт + 405 на прочее.
- Приём base64-картинки (data-URI) с regex-проверкой формата, лимитом размера, whitelist ext —
  и параллельно обычный `$_FILES` через move_uploaded_file. Полезно для загрузки работ/аватаров.
- `htmlspecialchars(strip_tags())` на всех текстовых полях. Prepared statements везде.
- Двойное письмо: заявителю (подтверждение + номер) и админу (детали) — паттерн «receipt + notify».
- Статус заявки в БД (pending → published/rejected) как единый жизненный цикл.

**Рассылки (newsletter.php + api.php sendNewsletter):**
- Сегментация: subs/authors/club/all (Зановости) и all/vip/new/paid/unpaid (Коптилыч/OKO).
- `array_unique + filter(FILTER_VALIDATE_EMAIL)`, брендовый HTML-шаблон, `nl2br(htmlspecialchars)`,
  `usleep(300000)` троттлинг чтобы не словить лимиты SMTP. Возврат sent/failed.
- Персонализация `{{name}}` (в OKO-боте) — простая замена в тексте.

**Крон (cron.php):**
- Отложенная публикация: `status='scheduled' AND publish_at<=now` → published + рассылка. Для нас:
  автопубликация результатов конкурса/дедлайны приёма заявок.
- Периодическая очистка протухших сессий. Идемпотентно, печатает лог-строку с датой.

**Email-инфраструктура (db.php sendMail — брать этот вариант):**
- **Curl SMTP** `smtps://smtp.gmail.com:465` (CURLOPT_USERNAME/PASSWORD/MAIL_FROM/MAIL_RCPT/
  READDATA/UPLOAD) с фолбэком на `mail()`. Тема base64 `=?UTF-8?B?`. Один брендовый `emailTpl()`.
  Гораздо чище самописного fsockopen из api.php Коптилыча.

**База/хранилище:**
- SQLite + PDO + WAL + foreign_keys + идемпотентный `initDB`/`ensureTables` (авто-миграция) —
  ровно наш стек. `settings` key/value таблица под конфиг. `sessions` с TTL и cookie-токеном.

**Безопасность/инфра:**
- `.htaccess`: закрыть `data/` (или наш `*.db`) через RewriteRule [F], security-headers, gzip, cache.
- `robots.txt`: закрыть admin + служебные endpoints.

---

## (4) Что у нас лучше / хуже / отсутствует (сверка с нашим сайтом PHP+SQLite)

**Где мы уже ЛУЧШЕ / должны быть лучше (референс — антипаттерн):**
- **Секреты в коде.** У них Telegram-токены, Gmail app-passwords, admin_password, SMTP-пароли —
  хардкод прямо в .php и в дефолтах db.php. У нас правило: ключи в env/secrets.env(.b64), не в git,
  не в коде. НЕ повторять их подход.
- **Слабая авторизация админки.** admin_api.php по факту «доверяет same-origin» для мутаций (auth-
  проверка закомментирована). upload.php — пароль в открытом GET-параметре. У нас нужна нормальная
  session/token-проверка на всех мутациях.
- **Коптилыч/OKO хранят всё в data.json** (гонки записи при конкурентных запросах, нет транзакций).
  Наш SQLite — надёжнее. Брать у них только SQLite-проект (Зановости) как образец схемы.
- **Оплата.** У Коптилыча оплаты нет как интеграции — только СБП-ссылка Ozon + скрин чека + ручное
  подтверждение из бота. У нас **ЮKassa с вебхуком** — заметно лучше и автоматизированнее. Но их
  «ручное подтверждение оплаты кнопкой в боте» стоит оставить как фолбэк, если вебхук не дошёл.
- **Эмодзи в UI/сообщениях.** У них везде. У нас запрещено (правило №4). Перенимаем логику, не тексты.

**Что стоит СВЕРИТЬ/добавить у нас (если отсутствует):**
- FSM-диалоги бота на state-файле/таблице (пошаговая подача заявки на конкурс, выдача диплома, поиск).
- Ручное подтверждение оплаты кнопкой в боте как фолбэк к ЮKassa-вебхуку.
- Сегментированная рассылка по участникам (по статусу оплаты/номинации/году) с throttle.
- Крон: автопубликация результатов/закрытие приёма по дедлайну + очистка сессий.
- Self-hosted аналитика на SQLite (analytics.php) — если нет своей/внешней метрики.
- Мгновенные TG-уведомления админам о новой заявке/оплате/отзыве с инлайн-кнопкой действия.
- Брендовый HTML-emailTpl + Curl-SMTP с фолбэком на mail() (если у нас отправка писем слабее).
- `.htaccess` hardening (закрыть *.db/data/uploads, security-headers) + robots.txt на служебные .php.
- Отложенная публикация (publish_at) и статусная модель заявки pending→published/rejected.

**Чего в референсе НЕТ (наши уникальные задачи — образца не будет):**
- ЮKassa-интеграция и вебхук оплаты (у них только СБП-ссылка + ручное подтверждение).
- Генерация дипломов/сертификатов (PDF/картинка) — нигде нет.
- Мини-апп Telegram (WebApp) — нигде нет, только url-кнопки в магазин/канал.
- Полноценная конкурсная логика (номинации, возрастные группы, жюри, баллы) — нет.

**Итог:** брать за основу SQLite-стек и структуру «Зановости» (db.php/auth.php/submit.php/
admin_api.php/cron.php/analytics.php + emailTpl/Curl-SMTP), UX-паттерны обоих ботов (polling+FSM
из polling.php, инлайн-меню и prefix-роутинг из bot.php), .htaccess/robots hardening. Всё, что
касается секретов и авторизации, — делать по-нашему (env + нормальный auth), их подход не копировать.
