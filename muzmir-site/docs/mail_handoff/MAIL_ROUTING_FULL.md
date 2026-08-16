# Маршрутизация почты муз-мира — все ящики, все пулы

## 4 боевых ящика и 2 виртуальных

| Ящик | Роль | SMTP (Yandex 360) | IMAP | Отсылка через |
|---|---|---|---|---|
| **news@муз-мир.рф** | Своя база: конкурсы, рассылка участникам | smtp.yandex.ru:465 | imap.yandex.ru:993 | Unisender API (bulk pool) |
| **novosti@муз-мир.рф** | Учреждения: приглашение в партнёрство | smtp.yandex.ru:465 | imap.yandex.ru:993 | Unisender API (cold pool) |
| **kc@муз-мир.рф** | Ведомства: обращения к министерствам | smtp.yandex.ru:465 | imap.yandex.ru:993 | Yandex SMTP напрямую |
| **nagradi.on@муз-мир.рф** | Награды: дипломы, чеки, пароли | smtp.yandex.ru:465 | imap.yandex.ru:993 | Yandex SMTP напрямую |
| **kulturniy.centr.mir@gmail.com** | Только приём (запасной ящик) | — | Gmail IMAP | НИЧЕГО не отправляем |
| **unisender**/**unisender-cold**/**unisender-kc** | Виртуальные (обёртки Unisender API) | HTTP | — | HTTPS API |

## Пароли (config.local.php строка 30, ключ `MUZMIR_SMTP_SENDERS`)

JSON-объект:
```json
{
  "nagradi": {
    "host": "smtp.yandex.ru", "port": 465,
    "user": "nagradi.on@xn----7sbugdeiegh1b0a9hen.xn--p1ai",
    "pass": "yqouvayxmojhrfqq",
    "from_addr": "nagradi.on@xn----7sbugdeiegh1b0a9hen.xn--p1ai",
    "from_name": "Наградной отдел — Музыкальный Мир"
  },
  "news": {
    "host": "smtp.yandex.ru", "port": 465,
    "user": "news@xn----7sbugdeiegh1b0a9hen.xn--p1ai",
    "pass": "tfccybmhaohpswqm",
    "from_addr": "news@музыкальный-мир.рф",
    "from_name": "Культурный центр «Музыкальный Мир»"
  },
  "news2": {
    "host": "smtp.yandex.ru", "port": 465,
    "user": "novosti@xn----7sbugdeiegh1b0a9hen.xn--p1ai",
    "pass": "dkkpzlwotygomhyt",
    "from_addr": "novosti@xn----7sbugdeiegh1b0a9hen.xn--p1ai",
    "from_name": "Культурный центр «Музыкальный Мир»"
  },
  "kc": {
    "host": "smtp.yandex.ru", "port": 465,
    "user": "kc@xn----7sbugdeiegh1b0a9hen.xn--p1ai",
    "pass": "umycdzpnplwlbriz",
    "from_addr": "kc@музыкальный-мир.рф",
    "from_name": "Культурный центр «Музыкальный Мир»"
  }
}
```

⚠️ Обрати внимание: `novosti@` в конфиге называется **`news2`** (историческая причина). При lookup `mail_account_by_name('novosti')` → NULL, но `mail_account_by_name('news2')` → есть. Учитывать в inbox-скрипте.

## Пулы отправки (в `core/mailer.php` функция `mail_pool_names($pool)`)

```php
'bulk'         => ['unisender'],         // своя база через news@ (Unisender)
'cold'         => ['unisender-cold'],    // учреждения через novosti@ (Unisender, отдельный warmup)
'awards'       => ['nagradi'],           // дипломы, партнёрские сертификаты, чеки
'transactional'=> ['news'],              // подтверждения регистрации, восстановление пароля
'official'     => ['kc'],                // обращения к министерствам
'news'         => ['unisender-kc'],      // разовые новости и уведомления сайта (>200 адресатов)
```

**Правило владельца** (обязательное):
- Рассылки на большие базы (>200) — ТОЛЬКО через Unisender (иначе Яндекс банит домен за спам).
- Персональные письма (диплом, чек) — прямой SMTP Yandex 360.
- Официальные обращения (ведомства) — прямой SMTP с kc@ (обязательный требования: подпись, реквизиты).

## Виртуальные аккаунты Unisender

Файл: `core/mailer.php`, функция `mail_account_by_name($name)` строки 581-620.

```
'unisender'     — своя база (bulk),   from_addr = unisender_from = news@муз-мир.рф
'unisender-cold'— холодный охват,     from_addr = unisender_from_cold = novosti@муз-мир.рф
'unisender-kc'  — новости сайта,      from_addr = unisender_from_kc = kc@муз-мир.рф
```

Все три используют один API ключ (`unisender_api_key` в config). Разделены обратные адреса + отдельные warmup-квоты.

## Как воркер выбирает пул (patched in этом чате)

Файл: `core/newsletter.php`, функция `newsletter_process_queue()` строки 1355-1435.

Изначально был баг: воркер загружал ТОЛЬКО `bulk`-пул и слал через него ВСЁ, включая холодные письма учреждениям. Институции летели через news@ вместо novosti@.

Патч:
```php
$bulkBoxes = mail_fallback_accounts([], 'bulk');   // = [unisender]
$coldBoxes = mail_fallback_accounts([], 'cold');   // = [unisender-cold]
$boxes = array_merge(array_values($bulkBoxes), array_values($coldBoxes));
$poolByBox = [];
foreach ($bulkBoxes as $b) $poolByBox[strtolower($b['user'])] = 'bulk';
foreach ($coldBoxes as $b) $poolByBox[strtolower($b['user'])] = 'cold';
```

Плюс раздельные SQL-выборки (`$rowsByPool['bulk']` для konkurs, `$rowsByPool['cold']` для inst) — иначе `ORDER BY id ASC LIMIT 40` брал только старые inst-строки и konkurs вообще не шёл.

## Автозамена ящика (mail_send_failover)

Если основной ящик не принял письмо (rate limit, temporary block) — воркер автоматически пробует резервный из того же пула. Файл: `core/mailer.php` функция `mail_send_failover()`.

**Важно**: за каждый ящик считается свой `sent_via` в `mail_queue`, чтобы дневная норма считалась правильно.

## Дневные квоты и warmup

Файл: `core/newsletter.php`, функция `nl_service_cap_today()`.

Лесенка прогрева (settings):
```
nl_warmup_ladder = 4000,6000,8000,10000,12000
nl_warmup_max = 12000
```

День от `nl_warmup_started`:
- День 1 → 4000
- День 2 → 6000
- День 3 → 8000
- День 4 → 10000
- День 5+ → 12000 (потолок)

**Стоп прогрева**: если начались отказы почтовиков — держим текущий уровень (не увеличиваем).

## Split по типам кампаний

Файл: `core/newsletter.php`, функция `nl_daily_split()`.

Settings:
```
nl_split_konkurs_pct = 50   # своя база (тип 'konkurs')
nl_split_inst_pct = 50      # учреждения (тип 'inst')
# vip, kabinet — по умолчанию 0 (доп-типы)
```

При `nl_daily_cap()=4000` получаем 2000 konkurs + 2000 inst.
При 12000 — 6000 + 6000.

## Окно отправки

Все настройки в `settings`:
```
nl_window_hour_from = 8      # с 8:00
nl_window_hour_to = 18       # до 18:00
nl_window_day_from = 1       # с 1 числа
nl_window_day_to = 24        # до 24 числа
nl_window_sunday = 0         # воскресенье = 0 (тишина)
```

Проверка окна: `core/newsletter.php` функция `nl_bulk_window_open()`.
Вне окна воркер только шлёт транзакционные (priority=0), массовые ждут.

## Rate limiting (антибан-темп)

Файл: `core/newsletter.php`, функция `nl_box_due_by_now()`.

Дневная норма ящика растянута по окну (10 часов). Ящик участвует в прогоне только если **отстаёт от графика**. Идёт «ниточкой» ~400 писем/час на ящик.

Настройки:
```
mail_send_gap = 30          # антибан-пауза (мин) между письмами
mail_throttle_per_run = 2   # писем за прогон (крон каждую минуту)
nl_per_box_cap = 200        # дефолтный дневной cap ящика (если не warmup)
```

## Guard: остановка при массовых отказах

Файл: `core/newsletter.php`, воркер checks:
- Если >30 hard-bounce подряд за один прогон → `mass_sending_set(false, 'guard_hard_streak')` — стоп-кран автомат.
- Если ящик отдаёт отказы подряд (несколько раз) → `nl_box_fail_add()` → на сегодня замолкает.

## Мониторинг доставки

- `data/logs/mail.log` — все SMTP-события (`SENT(uni) to ... | subject | job=...`)
- `data/logs/newsletter.log` — сводки прогонов
- `data/logs/bounces.log` — сканирование bounces (каждые 30 мин)
- В админке `/admin/?p=dispatch` — живой пульт очереди

## Правило владельца по маршрутизации (действует)

**Каждый тип письма → строго свой ящик:**

| Что | Тип (campaign_type) | Пул | Отправитель |
|---|---|---|---|
| Запуск сезона: своя база | `konkurs` | bulk | news@ |
| Запуск сезона: учреждения | `inst` | cold | novosti@ |
| Диплом участнику | (priority=0) | awards | nagradi.on@ |
| Чек оплаты | (priority=0) | awards | nagradi.on@ |
| Восстановление пароля | (priority=0) | awards | nagradi.on@ |
| Подтверждение регистрации | (priority=0) | transactional | news@ |
| Партнёрский сертификат | (priority=0) | awards | nagradi.on@ |
| Партнёрская благодарность | (priority=0) | awards | nagradi.on@ |
| Промокод -10% | (priority=0) | awards | nagradi.on@ |
| Обращение к министерству | `official` | official | kc@ |
| Новости сайта >200 адресатов | — | news (unisender-kc) | kc@ через Unisender |
| VIP-клуб напоминание | `vip` | bulk | news@ |
| Онбординг кабинета | `kabinet` | bulk | news@ |

## Что читать (IMAP) — задача для новой сессии

Все 4 ящика: news@, novosti@, kc@, nagradi.on@.

Пароли те же что для SMTP (Yandex 360 — общий пароль SMTP+IMAP).

**Для inbox-читалки** (см. `INBOX_SPEC.md`):
- Каждый ящик мониторить каждые 5-15 мин
- Автоответчики — детектить и НЕ отвечать
- Партнёрские согласия → `partner_accept()` автоматом
- Партнёрские отказы → удалить email из institutions
- Ведомственные одобрения → `ministry_replies.php` уже работает + расширить с благодарностью
- Ведомственные отказы → удалить из institutions kind='ministry'
- Вопросы → chat_brain.php отвечает

Никогда не отвечать на:
- `noreply@`, `no-reply@`, `postmaster@`, `mailer-daemon@`
- Наши собственные адреса (news@/novosti@/kc@/nagradi.on@)
- Message-ID из наших исходящих (петля)
