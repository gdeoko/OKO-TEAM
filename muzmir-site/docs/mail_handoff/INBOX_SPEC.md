# Спецификация: IMAP-мониторинг + чат-бот на письмах

Задача пришла от Даниэля: **автоматизация ответов на входящие письма для 4 ящиков**, чтобы ни одно согласие/отказ/вопрос не потерялись.

Читать вместе с `CONTEXT_FULL.md` (общий контекст) и `PARTNER_AUTOMATION.md` (что уже работает у партнёрки).

## Цель одной фразой

**Всё что приходит на news@, novosti@, kc@, nagradi@ автоматически читается, отвечается чат-ботом (кроме автоответчиков), а согласия/отказы приводят к автодействию — БЕЗ участия Даниэля.**

## Ящики и их назначение

| Ящик | SMTP пароль (config.local.php `MUZMIR_SMTP_SENDERS`) | Что приходит | Автодействие |
|---|---|---|---|
| `news@` | `tfccybmhaohpswqm` | Ответы своей базы на рассылку конкурсов, вопросы участников | Чат-бот отвечает (использовать `chat_brain.php`) |
| `novosti@` (в конфиге `news2`) | `dkkpzlwotygomhyt` | Ответы 40к учреждений на обращения о партнёрстве | «Согласны» → `partner_accept()` автоматом. «Отказ» → удалить email из institutions. Иначе → чат-бот отвечает |
| `kc@` | `umycdzpnplwlbriz` | Ответы ~220 ведомств Минкультуры на обращения от Даниэля (шёл из другой сессии) | Одобрение → благодарность + опубликовать в /support галерею (уже частично работает в `ministry_replies.php`). Отказ → удалить из базы ведомств |
| `nagradi.on@` | `yqouvayxmojhrfqq` | Вопросы про статус дипломов/наград/чеков | Чат-бот отвечает (специальный контекст: где заявка, когда диплом, где чек) |

IMAP хост для всех: `imap.yandex.ru:993`, тот же логин и пароль что и для SMTP.

## Реквизиты для чтения (готово на проде)

- `core/imap_read.php` (10 КБ) — функции `im_search`, `im_fetch`, `im_parse`, `im_walk_parts`, `im_decode_header`, `im_decode_body`. Готовое.
- `cron/ministry_replies.php` (23 КБ) — рабочий пример: читает kc@, парсит письма ведомств, вытаскивает вложения, публикует в /support на сайте. **Использовать как эталон.**
- `cron/process_bounces.php` — другой пример IMAP-чтения (для отсева мёртвых адресов).

## Реквизиты для чат-бота

- `core/chat_brain.php` (85 КБ) — готовый мозг с интеграцией Gemini:
  - `chat_gemini_keys()` — список API ключей
  - `chat_gemini_reply($apiKey, $sessionKey, $text)` — синхронный ответ
  - `chat_system_prompt()` — системный промпт про Музмир
  - `chat_official_kb()` — база знаний (конкурсы, тарифы, партнёрство)
  - `chat_context_from_dialogue()` — контекст из истории диалога

## Что построить

### Шаг 1: Таблица `inbox_messages`

```sql
CREATE TABLE inbox_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mailbox TEXT NOT NULL,              -- 'news' | 'novosti' | 'kc' | 'nagradi'
    imap_uid INTEGER,                    -- UID письма в IMAP (для идемпотентности)
    thread_key TEXT,                     -- нормализованный References/In-Reply-To для группировки
    from_email TEXT NOT NULL,
    from_name TEXT DEFAULT '',
    to_email TEXT,
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    attachments TEXT DEFAULT '',        -- JSON: [{name, path, size, mime}]
    headers_raw TEXT,
    message_id TEXT,                    -- Message-ID заголовок
    in_reply_to TEXT,
    is_autoresponder INTEGER DEFAULT 0,  -- 1 = out-of-office/vacation/auto-reply
    kind TEXT DEFAULT '',                -- 'partner_accept' | 'partner_decline' | 'ministry_approve' | 'ministry_decline' | 'question' | 'other'
    handled_by TEXT DEFAULT '',          -- 'bot' | 'auto_accept' | 'auto_decline' | 'auto_thanks' | 'human'
    reply_text TEXT DEFAULT '',          -- что ответил бот (если ответил)
    reply_sent_at TEXT,
    linked_letter_id INTEGER,           -- FK на official_letters.id (если это ответ на обращение)
    linked_partner_inst INTEGER,        -- FK на institutions.id (если это партнёр)
    received_at TEXT NOT NULL,
    processed_at TEXT,
    UNIQUE(mailbox, imap_uid)
);
CREATE INDEX idx_inbox_kind ON inbox_messages(kind);
CREATE INDEX idx_inbox_thread ON inbox_messages(thread_key);
CREATE INDEX idx_inbox_from ON inbox_messages(from_email);
CREATE INDEX idx_inbox_handled ON inbox_messages(handled_by);
```

### Шаг 2: `core/inbox_reader.php`

Универсальная функция:

```php
function inbox_scan_box(string $mailboxAlias): int
```

- Достаёт SMTP-конфиг ящика через `mail_account_by_name($mailboxAlias)`
- Подключается по IMAP (host=`imap.yandex.ru:993`, user/pass из конфига)
- `im_search($acc, 'UNSEEN', 'INBOX')` — только новые
- Для каждого UID: `im_fetch → im_parse`
- Определяет автоответчик (см. шаг 3)
- Сохраняет в `inbox_messages` (UPSERT по mailbox+imap_uid)
- Помечает письмо SEEN в IMAP (чтобы не читать повторно)

### Шаг 3: Детектор автоответчиков

Проверять В ЛЮБОЙ комбинации (достаточно ОДНОГО признака):
- Заголовок `Auto-Submitted: auto-replied` или `Auto-Submitted: auto-generated`
- Заголовок `X-Autoreply: yes`
- Заголовок `X-Autorespond` (любое значение)
- Заголовок `Precedence: bulk` или `Precedence: auto_reply`
- Заголовок `X-Auto-Response-Suppress`
- В теме (case-insensitive): `автоответ`, `отсутствую`, `out of office`, `out-of-office`, `on vacation`, `автоматический ответ`, `в отпуске`, `не в офисе`, `automatic reply`
- В теле (case-insensitive, первые 500 символов): те же ключевые фразы

Если автоответчик → `is_autoresponder=1`, `handled_by='auto'`, ничего не отвечать, ничего не удалять из институции.

### Шаг 4: Классификатор `kind`

По ящику + содержимому первых 300 символов тела:

**novosti@** (партнёрство):
- «согласны», «принимаем», «согласн», «готовы участвовать», «принимаем предложение», «интересно», «да» — `partner_accept`
- «отказываемся», «не интересно», «не участвуем», «отказ», «не согласны», «спасибо, нет», «нет» — `partner_decline`
- иначе → `question` (передать чат-боту)

**kc@** (ведомства):
- Прикреплён PDF/JPG с бланком/подписью → `ministry_approve` (передать в существующий `ministry_reply.php` → публикация в /support)
- «отказ», «не поддерживаем», «нет оснований», «не подлежит», «не рекомендуется» → `ministry_decline`
- иначе → `question`

**news@**, **nagradi@**:
- Всегда `question`

### Шаг 5: `cron/inbox_read.php` — крон

```
*/5 * * * * php /var/www/muzmir/cron/inbox_read.php
```

Каждые 5 минут читает все 4 ящика, кладёт в inbox_messages.

**НЕ отправляет ничего** сама — только читает и классифицирует.

### Шаг 6: `cron/inbox_actions.php` — исполнитель автодействий

```
*/2 * * * * php /var/www/muzmir/cron/inbox_actions.php
```

Каждые 2 минуты берёт из inbox_messages где `handled_by=''` и не автоответчик:

**partner_accept:**
```php
$inst = one("SELECT * FROM institutions WHERE LOWER(email)=?", [$from]);
if ($inst && $inst['partner_status'] !== 'active') {
    partner_accept($inst['id']);   // ставит статус, генерит slug/промо/пароль, ставит cert в очередь
    // Приветственное письмо с сертификатом и логином/паролем уже уходит внутри partner_accept
}
update handled_by='auto_accept', linked_partner_inst=$inst['id']
```

**partner_decline:**
```php
// Удаляем email навсегда (чтобы больше не тревожить)
q("UPDATE institutions SET email='', partner_status='declined' WHERE LOWER(email)=?", [$from]);
q("UPDATE subscribers SET active=0, tags=trim(tags||',partner_declined',', ') WHERE LOWER(email)=?", [$from]);
update handled_by='auto_decline'
```

**ministry_approve:**
```php
// Уже частично работает в ministry_replies.php (публикация в /support + благодарственное письмо ведомству)
require_once BASE_PATH.'/core/ministry_reply.php';
mr_process_reply($inboxRow);
update handled_by='auto_thanks'
```

**ministry_decline:**
```php
q("DELETE FROM institutions WHERE LOWER(email)=? AND kind='ministry'", [$from]);
update handled_by='auto_decline'
```

**question:**
```php
// Загрузка мозга и генерация ответа
require_once BASE_PATH.'/core/chat_brain.php';
$reply = chat_gemini_reply($key, "inbox:$from", $bodyText);
if ($reply) {
    mail_send($from, 'RE: '.$subject, chat_reply_html_wrap($reply), [
        'account' => mail_account_by_name($mailboxAlias),   // ответить с того же ящика
        'in_reply_to' => $inboxRow['message_id'],
        'references' => $inboxRow['message_id'],
    ]);
    update handled_by='bot', reply_text=$reply, reply_sent_at=now
}
```

**Guard от петли**: если в письме признаки нашего же исходящего (наш Message-ID в References) — не отвечать.

**Дедуп**: если на этот же from_email + очень похожий вопрос уже отвечали в последние 24ч — не отвечать повторно, помечать `handled_by='dedup'`.

### Шаг 7: Админка `/admin/?p=inbox`

Файл `admin/inbox.php`, зарегистрировать в `admin/_boot.php` как `'inbox' => ['Диалог писем', 'admin', 'mail']`.

**Показывать только те диалоги, где handled_by='bot' или ='auto_accept' или ='auto_thanks' или ='human'** (то есть где реально был осмысленный обмен). Автоответчики и dedup — не показывать.

Группировать по `thread_key`. Для каждого треда:
- From (email + имя)
- Ящик
- Kind (партнёр/ведомство/вопрос)
- Последнее сообщение (превью)
- Кол-во сообщений в диалоге
- Кнопка «Открыть» → показать полный диалог (входящие + ответы бота)
- Кнопка «Ответить вручную» (если админ хочет вмешаться)
- Кнопка «Отписать/удалить контакт»

Фильтры: по ящику, по kind, по handled_by, по дате.

### Шаг 8: Мониторинг

Добавить в виджет «Массовая рассылка» на дашборд:
- «Входящих сегодня»: N (из них M ответил бот)
- «Партнёров принято автоматом»: N
- «Ведомств одобрило»: N
- «Отказников удалено»: N

## Порядок реализации (аккуратно)

**Фаза 1 (безопасная — только чтение)**:
1. Создать таблицу `inbox_messages` (миграция идемпотентная)
2. `core/inbox_reader.php` + `cron/inbox_read.php` — только чтение и запись в БД
3. Детектор автоответчиков
4. Крон `*/5 * * * *` — читать все 4 ящика
5. Пустая админка `/admin/?p=inbox` — просто листинг из таблицы

**Тестировать 1-2 часа**: проверить что письма реально читаются, автоответчики детектируются, БД наполняется.

**Фаза 2 (автодействия — риск: можно спамить)**:
6. Классификатор `kind`
7. `cron/inbox_actions.php` — партнёрство (accept/decline)
8. Проверить на 1-2 живых кейсах, не сломать `partner_accept`

**Фаза 3 (чат-бот и ведомства)**:
9. Ветка `question` через chat_brain
10. Guard от петли + дедуп
11. Ведомства (approve через ministry_reply, decline через удаление)

**Фаза 4 (админка)**:
12. Полная админка с диалогами
13. Метрики на дашборд

## Что НЕ делать

- Не отвечать на автоответчики (петля бесконечная)
- Не отвечать на письма от `noreply@`, `no-reply@`, `postmaster@`, `mailer-daemon@`
- Не удалять email института если оно уже принято партнёром (`partner_status='active'`) — только для не-партнёров
- Не показывать в админке весь мусор рассылки (bounces, автоответчики) — только реальные диалоги
- Не менять существующий `ministry_replies.php` необратимо — расширять его через inbox_actions

## Секьюрити

- Гуард от «мы отвечаем сами себе»: если from_email — один из наших (news@/novosti@/kc@/nagradi@) — игнорировать
- Rate limit: не больше 1 ответа боту на один `from_email` в 30 минут
- Attach из входящих сохранять в `data/inbox_attach/YYYY-MM/<uid>/<name>` (не в public!)
- Максимальный размер входящего письма для парсинга — 10 МБ (больше — сохранить raw, не парсить тело)
