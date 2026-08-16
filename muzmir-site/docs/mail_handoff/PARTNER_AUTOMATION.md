# Партнёрская автоматизация — что УЖЕ работает

Читать перед тем как трогать `partner_accept()` и цепочку.
Ошибка → отправим сертификаты не тем или дважды. Нельзя.

## Полный жизненный цикл партнёра (реализован)

### 1. Учреждение получает обращение (уже идёт сейчас)

Крон `queue_institutions.php` каждые 15 мин добирает `mail_queue` до нормы дневного плана.
Функция `invite_official_letter()` в `core/invite_queue.php`:
- Создаёт запись в `official_letters` (номер вида `DDMMYYYY/NNN`, HMAC-подпись)
- Генерит PDF обращения через `pdf_letter.php`
- Кладёт в письмо 9 вложений: обращение + 4 афиши + 4 положения (общий кэш `data/attach_cache/season-YYYY-MM/`)
- Ставит в `mail_queue` с `priority=5, campaign_type='inst'`

Тема письма: «Приглашаем к участию в конкурсах — [Название учреждения] (исх. №14082026/NNN)».
Тело: обращение к «Руководителю [название]», «Уважаемые коллеги!», без ФИО.

Отправка через `unisender-cold` пул (`novosti@муз-мир.рф`) — воркер `newsletter_process_queue()` в `core/newsletter.php`.

### 2. Учреждение отвечает — здесь пропасть (TODO)

**Сейчас**: ответ приходит на `novosti@`, никто не читает — терятся согласия.
**Надо**: `cron/inbox_read.php` подхватит → классификатор `kind` → `partner_accept()` или `partner_decline()` (см. `INBOX_SPEC.md`).

### 3. `partner_accept($instId)` — функция ГОТОВА (не менять!)

Файл: `core/partner.php`.

Что делает (в одной транзакции):
1. Читает институцию из `institutions` по id.
2. Генерирует slug (транслит + fallback на «inst-<id>»).
3. Генерит промокод: `PART-<HASH8>` (максимум 10 использований на -10%).
4. Генерит пароль: 9 символов a-z0-9.
5. Обновляет `institutions`:
   - `partner_status='active'`
   - `partner_slug=<slug>`
   - `partner_promo_code=<code>`
   - `partner_promo_max=10`
   - `partner_priority_days=4`
   - `partner_password_hash=<bcrypt>`
   - `partner_activated_at=now`
6. Регистрирует сертификат в `partner_docs`:
   - `number = 'ИП-2026-<NNNNN>'`
   - `kind = 'cert'`
   - `institution_id`, `org`, `region`
7. Генерирует PDF сертификата через `partner_cert_pdf($instId)` (bastion Playwright).
8. Ставит приветственное письмо в `mail_queue`:
   - Тема: «Приветствуем в информационном партнёрстве — Культурный центр «Музыкальный Мир»»
   - Body содержит: сертификат PDF во вложении, логин (email), пароль (открытым текстом, ОДИН РАЗ), ссылку на ЛК `/partner`, промокод, инструкцию как использовать
   - `priority=0` (транзакционное, идёт сразу)
   - Через `mail_send_failover pool='awards'` (nagradi.on@)
9. Логирует событие в `partner_events`:
   - `kind='accepted'`, `payload=json{slug,promo,cert_number}`

**Идемпотентность**: если `partner_status` уже `active` → просто возвращает существующие данные, не создаёт заново.

### 4. Партнёр использует ЛК `/partner`

Файл: `public/partner.php`.

Логин: email + пароль (тот что пришёл в письме).
Возможности:
- Скачать сертификат PDF
- Заказать благодарности (форма с автоподстановкой педагогов из applications.teacher, до 3 руками + 1 директор)
- Смотреть свои заявки и статистику
- Использовать промокод (при подаче через `/apply?src=partner` cookie `partner_inst` подхватывает институцию)

### 5. Крон `partner_triggers.php` (каждый час :15)

Файл: `cron/partner_triggers.php`.

Что делает:
1. Пересчитывает `partner_apps_count` для всех активных партнёров (сколько заявок пришло от их учреждения).
2. **5+ заявок → email директору** с формой «Закажите бесплатные благодарности». Флаг `partner_notified_5=1` (идемпотентно). Событие `partner_events kind='apps_5'`.
3. **10+ заявок → активация промокода**: `partner_promo_activated_at=now`. Email директору с промокодом «-10% на следующие 10 заявок». Флаг `partner_notified_10=1`. Событие `apps_10`.
4. **Генерация заказанных благодарностей**:
   - Забирает из `partner_thanks` записи `status='queued'`
   - Группирует по институции
   - Для каждой генерит PDF (`partner_thanks_pdf`)
   - Ставит в `mail_queue` группой (директор + до 3 педагогов), `pool='awards'`
   - Обновляет `partner_thanks.status='sent'`
   - Событие `thanks_delivered`.

### 6. Приоритет партнёра — работает

`cron/send_diplomas.php` проверяет:
- Клубный статус (`club_is_active`)
- Партнёрский приоритет (`partner_priority_days` = 4 дня вместо 5)

### 7. `partner_decline()` — есть, но НЕ УДАЛЯЕТ email

**Текущая логика в `partner.php`**:
```php
function partner_decline(int $instId): void {
    q("UPDATE institutions SET partner_status='declined' WHERE id=?", [$instId]);
    insert('partner_events', ['institution_id'=>$instId, 'kind'=>'declined']);
}
```

**Что ХОЧЕТ Даниэль**: не только пометить, но и **удалить email навсегда** — «мы больше никогда им не пишем».

Надо расширить в новой сессии:
```php
function partner_decline(int $instId): void {
    $inst = one("SELECT email FROM institutions WHERE id=?", [$instId]);
    q("UPDATE institutions SET partner_status='declined', email='' WHERE id=?", [$instId]);
    if (!empty($inst['email'])) {
        q("UPDATE subscribers SET active=0, tags=trim(COALESCE(tags,'')||',partner_declined',', ') WHERE LOWER(email)=?", [mb_strtolower($inst['email'])]);
    }
    insert('partner_events', ['institution_id'=>$instId, 'kind'=>'declined']);
}
```

## Схема таблиц (важное)

### `institutions` — расширения для партнёрки

```sql
partner_slug TEXT
partner_status TEXT           -- ''|'active'|'declined'|'blocked'
partner_promo_code TEXT
partner_promo_max INTEGER DEFAULT 10
partner_promo_uses INTEGER DEFAULT 0
partner_promo_activated_at TEXT
partner_priority_days INTEGER DEFAULT 4
partner_password_hash TEXT
partner_notified_5 INTEGER DEFAULT 0
partner_notified_10 INTEGER DEFAULT 0
partner_activated_at TEXT
partner_apps_count INTEGER DEFAULT 0
```

### `partner_docs` (реестр всех выданных партнёрских документов)

```sql
CREATE TABLE partner_docs (
    number TEXT PRIMARY KEY,       -- 'ИП-2026-00001' или 'БЛГ-ИП-2026-00001-Р1'
    kind TEXT NOT NULL,            -- 'cert' | 'thanks_manager' | 'thanks_teacher'
    institution_id INTEGER NOT NULL,
    org TEXT DEFAULT '',
    region TEXT DEFAULT '',
    fio TEXT DEFAULT '',
    issued_at TEXT DEFAULT (datetime('now')),
    valid_until TEXT DEFAULT '',
    revoked_at TEXT DEFAULT ''
);
```

### `partner_events` (лог всех событий)

```sql
CREATE TABLE partner_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_id INTEGER NOT NULL,
    kind TEXT NOT NULL,   -- accepted|declined|apps_5|apps_10|thanks_form_sent|thanks_delivered|promo_activated
    payload TEXT DEFAULT '',
    fired_at TEXT DEFAULT (datetime('now'))
);
```

### `partner_thanks` (очередь заказанных благодарностей)

Формат: `institution_id`, `status`, `role` (Р/П), `fio`, `works_count`, `pdf_path`, `created_at`, `sent_at`.

## Проверка подлинности партнёрских документов

URL: `https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/verify-doc.php?n=<номер>&s=<подпись>`

- Сертификат: `n=ИП-2026-XXXXX&s=<hmac16>`
- Благодарность: `n=БЛГ-ИП-2026-XXXXX-Р1&s=<hmac16>`

HMAC: `substr(hash_hmac('sha256', 'partner-doc:'.$number, pay_secret()), 0, 16)`.

QR-код внутри PDF ведёт именно на этот URL — на всех сертификатах и благодарностях.

## Автотест партнёрки (запускать после ЛЮБОЙ правки)

```bash
php /var/www/muzmir/scripts/audit_partner.php           # 49 тестов
php /var/www/muzmir/scripts/audit_partner_extended.php  # 23 edge-case теста
# Итого 72/72 PASSED — если хоть один FAIL, откатывай изменения
```
