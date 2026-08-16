# Партнёрка — полный конвейер от А до Я

Здесь ВСЯ цепочка: кабинет партнёра, раздел админки, сертификаты, благодарности, тексты писем, шаблоны PDF, HMAC-подписи, автотриггеры. Всё что реализовано.

## Обзор в одной картинке

```
УЧРЕЖДЕНИЕ ПОЛУЧАЕТ ОБРАЩЕНИЕ (novosti@)
              │
              ▼
   ответ «согласны/принимаем»  ──►  [TODO] чат новой сессии
              │
              ▼
     partner_accept($instId)                   ┌── регистрация в partner_docs
      генерит slug/промо/пароль,      ────►    │   (сертификат ИП-2026-XXXXX)
      создаёт сертификат PDF,                  ├── приветственное письмо
      ставит приветственное письмо             │   с логином, паролём, сертификатом
      в mail_queue (pool='awards')             │   и промокодом (-10%×10)
                                               └── событие partner_events kind='accepted'

ПАРТНЁР → /partner (ЛК)
      логин=email, пароль=из письма
              │
              ├──► скачать сертификат
              ├──► ЗАКАЗАТЬ БЛАГОДАРНОСТИ (форма: директор + до 3 педагогов)
              │       ставит записи в partner_thanks (status='queued')
              ├──► использовать промокод в /apply?src=partner
              └──► смотреть статистику своих заявок

КРОН partner_triggers.php (:15 каждый час)
      1. пересчитывает счётчик заявок
      2. 5+ заявок  → email директору «форма для благодарностей»
      3. 10+ заявок → активация промокода + email
      4. генерит PDF благодарностей из очереди partner_thanks
      5. отправка группой (директор + педагоги) через pool='awards'
```

## 1. Данные (что где в БД)

### `institutions` — партнёрские колонки

Институция становится партнёром без создания отдельной записи — просто расширяется существующая:

```sql
partner_slug              TEXT           -- 'mbudo-shkola-iskusstv-permskaja'
partner_status            TEXT           -- ''|'active'|'declined'|'blocked'
partner_promo_code        TEXT           -- 'PART-A3F8DE21'
partner_promo_max         INTEGER        -- 10 (максимум использований)
partner_promo_uses        INTEGER        -- 0..10
partner_promo_activated_at TEXT          -- когда получил промо (после 10+ заявок)
partner_priority_days     INTEGER        -- 4 (приоритет обработки дипломов, у остальных 5)
partner_password_hash     TEXT           -- bcrypt пароля для ЛК
partner_notified_5        INTEGER        -- 1 если уже слали email про 5+ заявок
partner_notified_10       INTEGER        -- 1 если уже активировали промо
partner_activated_at      TEXT           -- дата принятия партнёром
partner_apps_count        INTEGER        -- живой счётчик заявок от учреждения
```

### `partner_docs` — реестр всех выданных документов

```sql
CREATE TABLE partner_docs (
    number TEXT PRIMARY KEY,             -- 'ИП-2026-00001' (cert) или 'БЛГ-ИП-2026-00001-Р1' (thanks)
    kind TEXT NOT NULL,                  -- 'cert' | 'thanks_manager' | 'thanks_teacher'
    institution_id INTEGER NOT NULL,
    org TEXT,                            -- название учреждения
    region TEXT,
    fio TEXT,                            -- ФИО (для благодарностей — введённое партнёром)
    issued_at TEXT,
    valid_until TEXT,                    -- пусто = бессрочно (для сертификата — до конца года)
    revoked_at TEXT                      -- если документ отозван (пусто = действителен)
);
CREATE INDEX idx_pdoc_inst ON partner_docs(institution_id);
```

Все документы (и сертификаты, и благодарности) регистрируются здесь.
Проверка подлинности `/verify-doc.php?n=<number>&s=<hmac>` идёт именно по этой таблице.

### `partner_events` — лог событий партнёра

```sql
CREATE TABLE partner_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    kind TEXT NOT NULL,
    payload TEXT,
    fired_at TEXT
);
```

Виды событий (`kind`):
- `accepted` — принят партнёром (payload: slug, promo, cert_number)
- `declined` — отказался
- `apps_5` — 5+ заявок, форма благодарностей отправлена
- `apps_10` — 10+ заявок, промокод активирован
- `thanks_form_sent` — форма заказа благодарностей отправлена
- `thanks_delivered` — благодарности сгенерированы и отправлены
- `promo_activated` — промо код активирован
- `blocked` / `unblocked` — блокировка админом

### `partner_thanks` — очередь заказанных благодарностей

Партнёр в ЛК заказывает форму — записи ложатся сюда:

```sql
CREATE TABLE partner_thanks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    role TEXT,                          -- 'manager' (директор) | 'teacher' (педагог)
    fio TEXT NOT NULL,                  -- ФИО (пишет партнёр)
    works_count INTEGER,                -- сколько работ у педагога
    pdf_path TEXT,                      -- путь к сгенерированному PDF
    status TEXT,                        -- 'queued' | 'sent' | 'failed'
    created_at TEXT,
    sent_at TEXT
);
```

## 2. `partner_accept()` — что происходит внутри

Файл: `03_prod_files/core/partner.php`.

Функция идемпотентна: если институция уже `active` — возвращает существующие данные, ничего не пересоздаёт.

Шаги:

1. **Загрузка институции** из БД по id.
2. **Генерация slug**: транслит названия через таблицу (Мокроусовская ДШИ → mokrousovskaja-dshi), fallback = 'inst-<id>'.
3. **Генерация промокода**: `'PART-' . strtoupper(substr(md5(random_bytes(16)), 0, 8))`. Максимум 10 использований, скидка -10%.
4. **Генерация пароля**: 9 символов a-z0-9, bcrypt hash в `partner_password_hash`.
5. **Регистрация сертификата** в `partner_docs`:
   - `number = 'ИП-' . date('Y') . '-' . str_pad($next, 5, '0', STR_PAD_LEFT)`
   - `kind='cert'`, org, region, valid_until = конец года
6. **Генерация PDF сертификата** через `partner_cert_pdf($instId)`:
   - Открывает URL `/tests/partner-cert.php?inst=<id>&sig=<hmac16>` через bastion Playwright
   - Сохраняет в `data/partners/cert/ИП-2026-XXXXX.pdf`
   - Bastion: `104.171.132.45` (тот же что для писем министрам)
7. **Приветственное письмо** в `mail_queue`:
   - Тема: `«Приветствуем в информационном партнёрстве — Культурный центр «Музыкальный Мир»»`
   - Тело: HTML с брендом (см. текст ниже)
   - Вложение: сертификат PDF
   - `priority=0` (транзакционное, идёт сразу)
   - Отправка через `mail_send_failover` pool='awards' (nagradi.on@)
8. **Событие** `partner_events kind='accepted', payload=json{slug, promo, cert_number}`.

### Текст приветственного письма (сокращённо)

```
Здравствуйте!

Культурный центр «Музыкальный Мир» подтверждает Ваше учреждение
информационным партнёром сезона 2026.

Ваш сертификат партнёра — во вложении (ИП-2026-XXXXX).
Проверить подлинность: https://муз-мир.рф/verify-doc.php?n=ИП-2026-XXXXX&s=<hmac>

Личный кабинет партнёра: https://муз-мир.рф/partner
Логин: <email>
Пароль: <9-символьный>
Пароль можно сменить в кабинете.

В кабинете Вы можете:
— скачать сертификат в любой момент
— заказать бесплатные благодарности директору и педагогам
   (по мере активности учреждения)
— посмотреть статистику заявок Ваших педагогов

Промокод для педагогов Вашего учреждения (даст -10% на 10 заявок,
активируется когда придёт 10 заявок):
    <PART-XXXXXXXX>
Использовать: указать при подаче заявки на /apply?src=partner

С уважением,
Оргкомитет Культурного центра «Музыкальный Мир»
```

## 3. Личный кабинет партнёра (`public/partner.php`)

Файл: `03_prod_files/public/partner.php` (505 строк).

### Роуты (все через `?a=<action>`)

| a= | Что делает |
|---|---|
| — (нет) | Overview — статистика, кнопки |
| `login` | POST: логин по email+password, ставит `$_SESSION['partner_id']` |
| `logout` | Разлогин |
| `cert` | Отдаёт сертификат PDF |
| `thanks` | Форма заказа благодарностей (GET) + приём (POST) |
| `promo` | Информация о промокоде и его использовании |
| `applications` | Список заявок от учреждения (по `partner_inst` cookie в applications) |

### Форма благодарностей (`?a=thanks`)

Партнёр видит:
- Автоподстановка педагогов из applications.teacher (последние 30 дней, DISTINCT LOWER(TRIM(teacher)))
- Ниже — до 3 полей для ручного ввода педагогов (ФИО + сколько работ)
- Один чекбокс «На директора учреждения» + поле ФИО директора
- Кнопка «Заказать бесплатно»

При отправке:
1. Валидация ФИО (не пусто, длина 5-100 символов)
2. Проверка что директор ещё не был заказан («руководство один раз» правило)
3. INSERT в `partner_thanks` (по одной записи на директора + каждого педагога)
4. Событие `partner_events kind='thanks_form_sent'`
5. Показ «Заказ принят. Благодарности будут готовы в течение суток.»

### CSS

Полностью инлайновый в `partner_css()` внутри файла:
- Бренд Музмира: тёплый бежевый фон, синие акценты (#1D2B55)
- Крупные типографские заголовки
- Форма благодарностей — карточки с иконками
- Мобильный адаптив

## 4. Раздел «Партнёры» в админке (`admin/partners.php`)

Файл: `03_prod_files/admin/partners.php` (264 строки).
Зарегистрирован в `admin/_boot.php` строка ~N: `'partners' => ['Партнёры', 'admin', 'trophy']`.

### Что видит админ

**Список партнёров** (таблица):
- Институция (название + регион)
- Статус (active/declined/blocked)
- Slug
- Заявок (счётчик)
- Промокод (использовано/лимит)
- Дата активации
- Действия (кнопки)

**Фильтры**: по статусу (все/active/declined), по региону, поиск по названию.

**Действия** (POST на `?do=<action>`):
- `accept` — вручную принять (обычно автомат делает через inbox)
- `decline` — отказ
- `block` — заблокировать (не удаляем, но временно)
- `unblock` — снять блокировку
- `reset_pass` — сгенерировать новый пароль, показать один раз
- `regen_cert` — перегенерировать сертификат
- `send_thanks_now` — принудительно отправить все ждущие благодарности
- `delete_thanks` — удалить заказанную благодарность (если ошибка)
- `edit` — редактировать данные партнёра

**Показ пароля** при `reset_pass` и `accept`: пароль лежит в `$_SESSION['partner_password_shown']`, показывается ОДИН РАЗ на следующей странице, потом стирается.

## 5. HTML-шаблоны PDF

### Сертификат партнёра

Файл: `03_prod_files/templates/partner-cert.php`.
URL для рендера: `/tests/partner-cert.php?inst=<id>&sig=<hmac16>`.
Рендер через bastion (104.171.132.45) Playwright — PDF на А4.

Верстка (в HTML/CSS):
- Фон: бренд-плашка Музмира (бежевая с рамкой)
- Верхний блок: лого + «Культурный центр «Музыкальный Мир»»
- Заголовок: **«Сертификат информационного партнёра»**
- Название учреждения (крупно, из БД)
- Регион, город
- Дата выдачи, номер ИП-2026-XXXXX
- Блок подписи-печати (позиция top:148mm, left:22mm, width:188mm):
  - Синяя подпись директора (SVG, `etalons/brand/signature.svg`)
  - Синяя печать (PNG, `etalons/brand/stamp.png`)
  - Подписи выровнены на строку через `.sig-vis .sg{bottom:-5mm}` (фикс от «висят слишком высоко»)
- QR-код (справа внизу, top:196mm) — ведёт на `/verify-doc.php?n=ИП-2026-XXXXX&s=<hmac>`
- Мелким шрифтом: «Проверить подлинность: муз-мир.рф/verify-doc.php?n=...»

### Благодарность (партнёрская, отдельная от «Величие России»)

Файл: `03_prod_files/templates/partner-thanks.php`.
URL: `/tests/partner-thanks.php?id=<thanks_id>&sig=<hmac>`.

Два варианта в одном шаблоне (различаются текстом):
1. **Директору** («role=manager»): «Директору [название учреждения]. Благодарим за развитие партнёрских отношений...»
2. **Педагогу** («role=teacher»): «Педагогу [название учреждения]. Благодарим за подготовку [N] обучающихся к участию в конкурсах...»

Верстка:
- Тот же бренд-фон
- Шрифт для ФИО — **Marck Script** (курсив, чтобы визуально отличалось от печатного текста)
- Номер: **БЛГ-ИП-2026-XXXXX-Р1** (для директора) или **-П1/-П2/-П3** (для педагогов, порядок в форме)
- Подпись + печать директора Музмира
- QR-код проверки

### Общие функции рендера

- `partner_cert_pdf($instId)` в `core/partner_docs.php` — сертификат
- `partner_thanks_pdf($thanksId)` в `core/partner_docs.php` — благодарность
- `partner_thanks_next_no($instId, $role)` — считает следующий порядковый номер (Р1, П1, П2, П3...)
- Оба используют `partner_render_pdf($url, $outPath)` — общий вызов bastion Playwright

## 6. Крон `partner_triggers.php` (:15 каждый час)

Файл: `03_prod_files/cron/partner_triggers.php` (210 строк).

Последовательность:

### Шаг 1: Пересчёт счётчиков заявок
```sql
UPDATE institutions
   SET partner_apps_count = (
        SELECT COUNT(*) FROM applications a
         WHERE a.institution_id = institutions.id
           AND a.created_at >= COALESCE(institutions.partner_activated_at, '2000-01-01')
   )
 WHERE partner_status='active'
```

### Шаг 2: Триггер 5+ заявок
Для каждого партнёра `WHERE partner_apps_count>=5 AND partner_notified_5=0`:
- Собрать список педагогов (из applications.teacher, DISTINCT последние 30 дней)
- Отправить email директору с формой (кнопка «Заказать благодарности» ведёт на `/partner?a=thanks`)
- `UPDATE partner_notified_5=1`
- Событие `partner_events kind='apps_5'`

Текст письма (шаблон):
```
Здравствуйте!

За последнее время Ваше учреждение подало 5+ заявок на наши конкурсы.
Спасибо за активность! В знак благодарности предлагаем Вам оформить
бесплатные благодарственные PDF-письма для директора и педагогов
(на бланке Культурного центра, с печатью и подписью).

Оформить: https://муз-мир.рф/partner?a=thanks
Логин: <email>, пароль: (тот что Вам приходил при принятии в партнёры,
если утеряли — восстановите в кабинете).

Список Ваших активных педагогов:
— Иванова А.А. (3 работы)
— Петрова М.М. (5 работ)
— ...

С уважением,
Оргкомитет
```

### Шаг 3: Триггер 10+ заявок
Для `partner_apps_count>=10 AND partner_notified_10=0`:
- `partner_promo_activated_at = now()`
- Email директору «Ваш промокод активирован» + сам код
- `partner_notified_10=1`
- Событие `apps_10`

### Шаг 4: Генерация благодарностей
`SELECT FROM partner_thanks WHERE status='queued'` — берём по институциям, генерим PDF (bastion), группируем в одно письмо (директор + до 3 педагогов):

```
Здравствуйте!

Ваш заказ благодарственных писем готов.

Во вложении:
— БЛГ-ИП-2026-XXXXX-Р1 (директору [ФИО])
— БЛГ-ИП-2026-XXXXX-П1 (педагогу [ФИО])
— БЛГ-ИП-2026-XXXXX-П2 (педагогу [ФИО])

Документы зарегистрированы в реестре Культурного центра.
Проверить подлинность: https://муз-мир.рф/verify-doc.php?n=БЛГ-ИП-2026-XXXXX-Р1&s=<hmac>

С уважением,
Оргкомитет
```

Отправка через `mail_send_failover` с pool='awards' (nagradi.on@).

## 7. Приоритет партнёра в дипломах

Патч в `cron/send_diplomas.php`:

```php
$defaultDays = 5;
$days = $defaultDays;
if (!empty($inst['partner_priority_days']) && $inst['partner_priority_days'] < $days) {
    $days = (int)$inst['partner_priority_days'];   // = 4 для партнёров
}
$deadline = date('Y-m-d', strtotime("+$days weekdays", $submittedAt));
```

То есть партнёры получают дипломы за 4 рабочих дня вместо 5.

## 8. Промокод -10%

### Как использовать
1. Партнёр даёт своим педагогам ссылку `https://муз-мир.рф/p/<slug>` или сам код `PART-XXXXXXXX`
2. Клик по `/p/<slug>` ставит cookie `partner_inst` = id учреждения на 30 дней
3. Редирект на `/apply?src=partner`
4. В форме заявки — поле «Промокод», можно ввести код руками (или подставится из cookie)

### Логика применения (в `api/v1/apply.php`)
```php
// После INSERT заявки
if ($partInstId) partner_attach_application($aid, $partInstId);
if ($promoCode) partner_apply_promo($aid, $promoCode);
```

`partner_apply_promo()` в `core/partner.php`:
- Транзакция: `UPDATE institutions SET partner_promo_uses = partner_promo_uses + 1 WHERE partner_promo_code=? AND partner_status='active' AND partner_promo_uses < partner_promo_max`
- Если UPDATE вернул 1 строку — применили, ставим `applications.discount = 0.10`
- Если 0 строк — либо код не найден, либо лимит выбран (автоматически скрывается)
- Событие `partner_events kind='promo_used', payload=json{app_id, uses_now}`

**Защита от гонки**: транзакция гарантирует что 11-я заявка не получит скидку даже при параллельных подачах.

## 9. Верификация документов `/verify-doc.php`

Файл: `03_prod_files/public/verify-doc.php`.

URL: `https://муз-мир.рф/verify-doc.php?n=<номер>&s=<подпись>`

Логика:
1. `$expected = substr(hash_hmac('sha256', 'partner-doc:'.$number, pay_secret()), 0, 16)`
2. `$sigOk = hash_equals($expected, $sig)` — проверка HMAC
3. `$inRegistry = one("SELECT * FROM partner_docs WHERE number=?")` (или `official_letters` для обращений)
4. `$valid = $sigOk && $inRegistry`

Если валид — красивая страница «Документ подлинный» + номер + учреждение + дата.
Если нет — «Документ не подтверждён» + причина (подпись не совпала / нет в реестре).

Три типа документов:
- `ИП-2026-XXXXX` → «Сертификат Информационного партнёра»
- `БЛГ-ИП-2026-XXXXX-РX/ПX` → «Благодарственное письмо (Информационный партнёр)»
- `DDMMYYYY/NNN` → «Официальное обращение центра»

Дипломы (`MM-2026-XXXXX` и т.п.) идут через отдельный роут `/verify/<номер>`.

## 10. Аудит партнёрки — 72 теста

Файлы:
- `03_prod_files/scripts/audit_partner.php` (49 тестов, ~21 сек)
- `03_prod_files/scripts/audit_partner_extended.php` (23 теста, ~10 сек)

**Итог на момент упаковки: 72/72 PASSED.**

### Что проверяет основной аудит
1. Схема БД — все колонки, индексы, ограничения
2. Ядро `partner_accept` — генерация всех полей, идемпотентность
3. Аутентификация — верный/неверный пароль, поиск по email/slug
4. Промокод — применение, инкремент, транзакционная защита от превышения
5. `applications.institution_id` — счётчик заявок обновляется
6. Триггер 5+ — крон отрабатывает, флаг ставится
7. Триггер 10+ — промокод активируется
8. Форма благодарностей — очередь → PDF → отправка
9. Приоритет 4 дня — `send_diplomas.php` учитывает partner_priority_days
10. `verify-doc.php` — подпись корректна / некорректна
11. HTTP роуты — /admin/?p=partners, /partner, /p/<slug>, /p/nonexistent
12. Cron прописан в crontab
13. Блокировка/восстановление — block/unblock/reset_password

### Что проверяет расширенный аудит
- Edge cases: пустые/битые данные во всех функциях
- Гонка на промокоде: 10 параллельных вызовов — срабатывает ровно `max`
- SQL injection в `partner_by_promo/slug`
- Подделка HMAC подписи
- Slug генерация: юникод, спецсимволы, номера
- Идемпотентность триггеров: 2 запуска подряд не дублируют события
- Партнёр без email — крон не крашится
- «Руководство один раз» — повторный заказ отклонён
- Дедупликация ФИО через уникальный индекс (`institution_id`, `LOWER(fio)`)

Аудит **создаёт тестовое учреждение**, гоняет весь цикл, потом **чистит за собой** в `register_shutdown_function`. Ничего живого не трогает.

### Запуск после ЛЮБОЙ правки партнёрки
```bash
php /var/www/muzmir/scripts/audit_partner.php
php /var/www/muzmir/scripts/audit_partner_extended.php
```
Exit code 0 = OK, exit 1 = регрессия.

### Рекомендованный крон (не поставлен)
```
0 6 * * 0 php audit_partner.php >> logs/audit.log 2>&1 && \
          php audit_partner_extended.php >> logs/audit.log 2>&1
```
Каждое воскресенье 06:00 — регресс поймается автоматом.
