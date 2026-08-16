# Партнёрка построчно — разбор всех функций

Читать вместе с `03_prod_files/core/partner.php`, `core/partner_docs.php`, `cron/partner_triggers.php`, `admin/partners.php`, `public/partner.php`.

Здесь — что делает каждая ключевая функция, что принимает, что возвращает, где вызывается.

---

## core/partner.php

### `partner_migrate()` — миграции БД

Идемпотентная функция. Каждый вызов проверяет и добавляет колонки в `institutions` (через try/catch на ALTER TABLE), плюс создаёт таблицы `partner_docs`, `partner_events`, `partner_thanks`, `partner_requests`.

**Вызывается в начале КАЖДОЙ функции этого файла** — гарантирует что схема на месте даже после ручного отката БД.

Добавляемые колонки:
```sql
partner_slug             TEXT
partner_status           TEXT      -- ''|'invited'|'accepted'|'declined'|'blocked'
partner_no               TEXT      -- 'ИП-2026-00001'
partner_accepted_at      TEXT
partner_declined_at      TEXT
partner_invited_at       TEXT
partner_pass_hash        TEXT      -- bcrypt для входа в ЛК
partner_pass_shown       INTEGER   -- 0 = пароль ещё не показан
partner_promo_code       TEXT      -- 'PART-XXXXXXXX'
partner_promo_uses       INTEGER   -- сколько раз применён
partner_promo_max        INTEGER   -- лимит (10)
partner_promo_activated_at TEXT    -- когда 10 заявок пройдено
partner_priority_days    INTEGER   -- 4 (у остальных 5)
partner_notified_5       INTEGER
partner_notified_10      INTEGER
partner_apps_count       INTEGER
partner_apps_paid        INTEGER
```

Таблицы: см. `04_schema/tables.sql`.

---

### `partner_slugify(string $name): string`
Транслит русского названия в slug:
- «Мокроусовская ДШИ» → «mokrousovskaya-dshi»
- «МБУ ДО «Детская школа искусств п.Городищи»» → «mbu-do-detskaya-shkola-iskusstv-p-gorodishchi»

Fallback: если результат пустой → возвращает `''`, дальше в `partner_unique_slug` подставляется `inst-<id>`.

---

### `partner_unique_slug(int $instId, string $baseSlug): string`
Проверяет уникальность slug (могут быть дубли имён). Если занят — добавляет `-2`, `-3` и т.д.

---

### `partner_next_no(): string`
Возвращает следующий номер партнёрства:
- Формат `ИП-YYYY-NNNNN` где YYYY = текущий год, NNNNN = порядковый (5 цифр с ведущими нулями).
- Идёт по MAX(partner_no) в institutions + 1.
- Первый партнёр: `ИП-2026-00001`.

---

### `partner_gen_promo(int $year): string`
Генерит промокод: `PART-{HASH8}`.
- HASH8 = `strtoupper(substr(md5(random_bytes(16)), 0, 8))`.
- Пример: `PART-A3F8DE21`.

---

### `partner_gen_password(int $len = 9): string`
9-символьный пароль из `a-z0-9` (без похожих 0/O, 1/l/I).

---

### `partner_accept(int $instId): array` ★ ГЛАВНАЯ

**Что делает** (в порядке):
1. `partner_migrate()` — гарантирует схему
2. Достаёт институцию из БД
3. **Идемпотентность**: если `partner_status='accepted' AND partner_no!=''` — возвращает существующие данные, ничего не создаёт заново
4. Генерит: `partner_slug`, `partner_no`, `partner_promo_code`, `partner_gen_password()`, `password_hash`
5. UPDATE institutions с новыми значениями + `partner_status='accepted'`, `partner_accepted_at=NOW`
6. INSERT INTO `partner_docs` (kind='cert', number, org, region, issued_at, valid_until=+1 год)
7. `partner_log_event('accepted', {no, slug})`
8. Возвращает `['inst' => обновлённая_запись, 'password_plain' => пароль_открытым_текстом]`

**Что НЕ делает автоматически**:
- ❌ Не генерирует PDF сертификата (это `partner_cert_pdf($instId)` отдельно)
- ❌ Не отправляет приветственное письмо (это `admin/partners.php` руками пока)

**Где вызывается сейчас**:
- `admin/partners.php` при `do='accept'` (кнопка админа)
- `scripts/audit_partner.php` (тест)

**Где нужно вызывать в новой сессии** (автопринятие из inbox):
```php
// в cron/inbox_actions.php при kind='partner_accept'
$r = partner_accept($inst['id']);
$certPath = partner_cert_pdf($inst['id']);   // генерит PDF
partner_send_welcome_email($inst['id'], $r['password_plain'], $certPath);  // ← НАПИСАТЬ
```

---

### `partner_decline(int $instId, string $reason = ''): void`

**Что делает**:
```php
q("UPDATE institutions SET partner_status='declined', partner_declined_at=NOW WHERE id=?", [$instId]);
partner_log_event($instId, 'declined', json_encode(['reason' => $reason]));
```

**Что НЕ делает (важно для новой сессии)**:
- ❌ Не удаляет email — Даниэль хочет: «отказ → удалить ящик навсегда, больше не тревожим».

**Что расширить**:
```php
function partner_decline(int $instId, string $reason = ''): void {
    partner_migrate();
    $inst = one("SELECT email FROM institutions WHERE id=?", [$instId]);

    q("UPDATE institutions SET partner_status='declined', partner_declined_at=?, email='' WHERE id=?",
      [date('Y-m-d H:i:s'), $instId]);

    if (!empty($inst['email'])) {
        q("UPDATE subscribers SET active=0,
             tags=trim(COALESCE(tags,'')||',partner_declined',', ')
           WHERE LOWER(email)=?", [mb_strtolower($inst['email'])]);
    }

    partner_log_event($instId, 'declined', json_encode(['reason' => $reason]));
}
```

---

### `partner_block(int $instId, string $reason = ''): void`
Блокировка (не удаление). `partner_status='blocked'`. Промокод перестаёт работать.

### `partner_unblock(int $instId): void`
Разблокировка. `partner_status='accepted'`.

### `partner_reset_password(int $instId): string`
Генерит новый пароль, обновляет `partner_pass_hash`, сбрасывает `partner_pass_shown=0`. Возвращает открытый пароль (для показа админу один раз).

---

### `partner_login(string $email, string $password): ?array`

Проверка пароля для входа в `/partner` ЛК:
```php
$inst = one("SELECT * FROM institutions
             WHERE LOWER(email)=? AND partner_status='accepted'", [strtolower($email)]);
if (!$inst) return null;
if (!password_verify($password, $inst['partner_pass_hash'])) return null;
return $inst;
```

Устанавливает `$_SESSION['partner_id'] = $inst['id']`, `$_SESSION['partner_email']`.

---

### `partner_current(): ?array`

Возвращает текущего залогиненного партнёра (по `$_SESSION['partner_id']`) или null.

**CLI-guard**: если `PHP_SAPI === 'cli'` → возвращает null не вызывая `session_start()` (иначе крон падал с warning).

---

### `partner_apply_promo(int $applicationId, string $promoCode): bool` ★

**Что делает** (транзакционно):
```php
$db->beginTransaction();

// Найти институцию по промо-коду
$inst = one("SELECT id, partner_promo_uses, partner_promo_max FROM institutions
             WHERE partner_promo_code = ? AND partner_status='accepted'",
            [$promoCode]);
if (!$inst) { $db->rollBack(); return false; }

// Проверить лимит с блокировкой строки
if ($inst['partner_promo_uses'] >= $inst['partner_promo_max']) {
    $db->rollBack(); return false;
}

// Инкремент (атомарный)
$stmt = $db->prepare("UPDATE institutions
                       SET partner_promo_uses = partner_promo_uses + 1
                       WHERE id = ? AND partner_promo_uses < partner_promo_max");
$stmt->execute([$inst['id']]);

if ($stmt->rowCount() !== 1) { $db->rollBack(); return false; }

// Применить скидку к заявке
q("UPDATE applications SET discount=0.10, partner_promo_applied=? WHERE id=?",
  [$promoCode, $applicationId]);

partner_log_event($inst['id'], 'promo_used',
                  json_encode(['app_id' => $applicationId]));

$db->commit();
return true;
```

**Защита от гонки**: `UPDATE ... WHERE partner_promo_uses < partner_promo_max` — если 10 параллельных запросов пытаются применить код, ровно 10 успеют, 11-й получит `rowCount=0`.

**Скидка**: 10% (0.10). Применяется к оргвзносу заявки при подсчёте.

---

### `partner_attach_application(int $applicationId, int $institutionId): void`

Простой UPDATE:
```php
q("UPDATE applications SET institution_id=? WHERE id=?", [$institutionId, $applicationId]);
```

Вызывается в `api/v1/apply.php` когда есть cookie `partner_inst` или `?src=partner`.

---

### `partner_log_event(int $instId, string $kind, string $payload = ''): void`

INSERT INTO partner_events с текущей датой. `payload` — обычно JSON.

Виды `kind`:
- `accepted`, `declined`, `blocked`, `unblocked`
- `apps_5`, `apps_10`
- `thanks_form_sent`, `thanks_delivered`
- `promo_activated`, `promo_used`
- `cert_regenerated`, `pass_reset`

---

### `partner_by_slug(string $slug): ?array`

Ищет по slug. Используется в роутере `/p/<slug>` — ставит cookie `partner_inst`.

---

### `partner_by_promo(string $code): ?array`

Ищет по промокоду. SQL с параметризацией (защищено от SQL-инъекции — аудит проверял).

---

### `partner_sign(string $data): string`

HMAC-SHA256 подпись для URL:
```php
return substr(hash_hmac('sha256', 'partner-doc:' . $data, pay_secret()), 0, 16);
```

Используется в:
- Ссылка на сертификат в письме `?sig=<hmac>`
- Ссылка в QR-коде PDF (проверка через `/verify-doc.php`)

---

### `partner_verify_url(string $data, string $sig): bool`

Проверка подписи (для `/verify-doc.php`):
```php
$expected = partner_sign($data);
return hash_equals($expected, $sig);
```

---

## core/partner_docs.php

### `partner_render_pdf(string $url, string $outPath): ?string`

Общий вызов bastion Playwright:
1. `$url` — HTML-эндпоинт с шаблоном (`/tests/partner-cert.php?...`)
2. `$outPath` — куда сохранить PDF на проде
3. Отправляет команду на bastion (POST /poster/exec):
   - `cd /opt/oko-poster && node render_diploma.js <url> <tmp> 297mm 210mm`
   - `scp <tmp> root@176.124.200.169:<outPath>`
   - `rm -f <tmp>`
4. Проверяет что файл >20KB (защита от битых рендеров)
5. Сжимает через `diploma_compress_pdf()` если функция есть

**Timeout**: 120 секунд на bastion.

---

### `partner_cert_pdf_path(string $partnerNo): string`

Путь к файлу:
```
BASE_PATH . '/public/diplomas/partner_cert_' . slugify($partnerNo) . '.pdf'
```

Пример: `/var/www/muzmir/public/diplomas/partner_cert_ИП-2026-00001.pdf`.

⚠️ Файлы лежат в `public/diplomas/` (в отличие от обращений которые в `data/letters/`). Это чтобы можно было отдавать напрямую через веб-сервер (но с проверкой прав).

---

### `partner_cert_pdf(int $instId, bool $regen = false): ?string`

Генерация сертификата:
1. `partner_migrate()`
2. Достаёт институцию, проверяет `partner_status='accepted'` и `partner_no!=''`
3. Кэш: если файл существует, >20KB, mtime <30 дней и `!$regen` → возвращает существующий путь
4. Иначе — строит URL шаблона:
   ```
   /tests/partner-cert.php?key={render_key}&org={name}&reg={region}
      &no={partner_no}&since={accepted_date}&till={+1_год}
   ```
5. Вызывает `partner_render_pdf($url, $out)`
6. Возвращает путь к PDF или null

---

### `partner_thanks_pdf(int $thanksId, bool $regen = false): ?string`

Аналогично для благодарностей:
1. Достаёт `partner_thanks` запись по id
2. URL: `/tests/partner-thanks.php?key=...&role=...&fio=...&org=...&no=БЛГ-ИП-2026-XXXXX-РX`
3. Рендер + сохранение
4. UPDATE `partner_thanks SET doc_path=?, status='generated' WHERE id=?`
5. Возвращает путь

---

### `partner_thanks_next_no(int $instId, string $role): string`

Возвращает следующий номер:
- `role='manager'` → `БЛГ-ИП-2026-00001-Р1` (Руководитель)
- `role='teacher'` → `БЛГ-ИП-2026-00001-П1`, `-П2`, `-П3`... (Педагоги, порядок в заказе)

Считает по MAX(number) в `partner_docs WHERE institution_id=? AND kind LIKE 'thanks_%'` + 1.

---

## cron/partner_triggers.php

**Расписание**: `15 * * * *` — каждый час на 15 минут.

**Идемпотентно**: работает через флаги `partner_notified_5`, `partner_notified_10`, `partner_thanks.status`.

### Шаг 1: пересчёт `partner_apps_count`

```php
q("UPDATE institutions
     SET partner_apps_count = (
         SELECT COUNT(*) FROM applications a
          WHERE a.institution_id = institutions.id
            AND a.created_at >= COALESCE(institutions.partner_accepted_at, '2000-01-01')
     )
   WHERE partner_status='accepted'");
```

### Шаг 2: триггер 5+ заявок

```php
foreach (SELECT * FROM institutions WHERE partner_status='accepted' AND partner_apps_count>=5 AND partner_notified_5=0) as $p:
    if (partner_send_5apps_email($p['id'], $p)) {
        UPDATE partner_notified_5=1;
        partner_log_event('apps_5', {count: $p['partner_apps_count']});
    }
```

### Шаг 3: триггер 10+ заявок

```php
foreach (WHERE partner_apps_count>=10 AND partner_notified_10=0) as $p:
    if (partner_send_10apps_email($p['id'], $p)) {
        UPDATE partner_notified_10=1, partner_promo_activated_at=NOW;
        partner_log_event('apps_10', {count, promo: $p['partner_promo_code']});
    }
```

### Шаг 4: генерация и отправка благодарностей

```php
$grouped = группировать SELECT FROM partner_thanks WHERE status='queued' AND scheduled_send_at<=NOW BY institution_id;

foreach ($grouped as $instId => $thanksList):
    $atts = [];
    $listHtml = '';
    foreach ($thanksList as $t):
        $pdf = partner_thanks_pdf($t['id']);  // рендер если нет
        $safe = slugify($t['fio']);
        $dst = "/tmp/thanks_{$instId}/Благодарность_{$safe}.pdf";
        copy($pdf, $dst);
        $atts[] = $dst;
        $listHtml .= '<li><b>' . h($t['fio']) . '</b> — '
                   . ($t['role']==='manager' ? 'руководство' : 'педагог-куратор') . '</li>';
    endforeach;

    $body = partner_email_thanks_body($inst, $listHtml, count($atts));
    $ok = mail_send_failover($inst['email'],
        'Благодарственные письма — от Оргкомитета КЦ «Музыкальный Мир»',
        $body, ['pool'=>'awards', 'attach'=>$atts]);

    if ($ok):
        UPDATE partner_thanks SET status='sent', sent_at=NOW WHERE id IN (...);
        partner_log_event('thanks_delivered', {count});
    endif;

    rm -rf /tmp/thanks_{$instId}/  // подчистить
endforeach;
```

---

## admin/partners.php — управление партнёрами

**Роут**: `/admin/?p=partners`.
**Зарегистрирован**: `admin/_boot.php` через `admin_modules()` — `'partners' => ['Партнёры', 'admin', 'trophy']`.

### POST-действия (все с CSRF):

| do | Что делает |
|---|---|
| `accept` | `partner_accept($id)`. Пароль → `$_SESSION['partner_password_shown'][$id]`. Flash-сообщение. |
| `decline` | `partner_decline($id, $reason)` |
| `block` | `partner_block($id, $reason)` |
| `unblock` | `partner_unblock($id)` |
| `reset_pass` | `partner_reset_password($id)`. Новый пароль → сессия. |
| `regen_cert` | `partner_cert_pdf($id, regen=true)` |
| `send_thanks_now` | Взять `partner_thanks id=$tid`, немедленно сгенерить+отправить (минуя расписание) |
| `delete_thanks` | Удалить `partner_thanks id=$tid` (если админ увидел ошибку) |
| `edit` | Отредактировать данные партнёра (name, email, region) |

### Отображение

Таблица со списком партнёров + фильтры (все/активные/приглашены/отказ/блок) + поиск.

Кликаешь на партнёра → детальная карточка справа:
- Номер партнёрства
- Персональная ссылка `/p/<slug>`
- Промокод (использовано/лимит)
- Счётчик заявок (всего/оплачено)
- Дата активации
- Список заказанных благодарностей (partner_thanks)
- События (partner_events)

---

## public/partner.php — ЛК партнёра

**Роут**: `/partner`, `/partner?a=<action>` через `public/index.php`.

### Actions

| a | Что делает |
|---|---|
| (нет) | Overview: статистика (сколько заявок, промо использовано), кнопки на основные разделы |
| `login` | POST `email` + `password` → `partner_login()` → `$_SESSION['partner_id']` → редирект |
| `logout` | `unset($_SESSION['partner_id'])` |
| `cert` | Отдаёт `partner_cert_pdf()` с Content-Disposition: attachment |
| `thanks` | GET: форма заказа благодарностей / POST: обработка |
| `promo` | Информация о промокоде: код, ссылка `/p/<slug>`, использования |
| `applications` | Список заявок от учреждения (JOIN applications ... WHERE institution_id) |

### Форма `?a=thanks` детали

**Автоподстановка педагогов**:
```php
$teachers = all("SELECT DISTINCT teacher, COUNT(*) as works
                 FROM applications
                 WHERE institution_id=? AND teacher!=''
                   AND created_at >= COALESCE(partner_accepted_at, '2000-01-01')
                 GROUP BY LOWER(TRIM(teacher))
                 ORDER BY 2 DESC LIMIT 30", [$partnerId]);
```

Каждый педагог — чекбокс с ФИО и количеством работ. Владелец отмечает кого включить.

**Плюс ручные поля**: до 3 текстовых полей «ФИО + сколько работ» — можно добавить педагогов не из списка.

**Плюс директор** (один раз за партнёрство):
```php
$managerAlreadyOrdered = one("SELECT 1 FROM partner_thanks
                              WHERE institution_id=? AND role='manager'", [$partnerId]);
if (!$managerAlreadyOrdered):
    // Показать чекбокс "На директора" + поле ФИО
endif;
```

**Валидация при POST**:
- Каждое ФИО: длина 5-100, обязательно содержит пробел (Имя Фамилия минимум)
- Директор ещё не заказан
- Уникальность педагога: `UNIQUE(institution_id, LOWER(fio))` в БД (защита от дубликатов даже при гонке)

**INSERT**: по одной записи в `partner_thanks` на каждого:
```php
foreach ($accepted as $person):
    insert('partner_thanks', [
        'institution_id' => $partnerId,
        'role' => $person['role'],  // 'manager' | 'teacher'
        'fio' => $person['fio'],
        'works_count' => $person['works'] ?? 0,
        'status' => 'queued',
        'scheduled_send_at' => date('Y-m-d H:i:s', strtotime('+1 hour')),
    ]);
endforeach;
partner_log_event($partnerId, 'thanks_form_sent', json_encode(['count' => count($accepted)]));
```

---

## Автотесты — 72 из 72 PASSED

**Файлы**:
- `scripts/audit_partner.php` (49 тестов, ~21 сек)
- `scripts/audit_partner_extended.php` (23 теста, ~10 сек)

**Что критично протестировать после ЛЮБОЙ правки** партнёрки — оба скрипта.

Аудит создаёт тестовое учреждение с уникальным email `audit-test-<timestamp>@example.local`, гоняет весь цикл, потом чистит через `register_shutdown_function`. Ничего живого не затрагивает.

Если хоть один тест fail (exit 1) → откатывай изменения, чини.

---

## Как встроить автопринятие партнёра из inbox (в новой сессии)

Псевдо-код для `cron/inbox_actions.php`:

```php
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/partner_docs.php';

foreach (SELECT * FROM inbox_messages WHERE handled_by='' AND kind='partner_accept' AND is_autoresponder=0) as $msg:
    // 1. Найти институцию по email
    $inst = one("SELECT * FROM institutions
                 WHERE LOWER(email)=? AND kind!='ministry'",
                 [mb_strtolower($msg['from_email'])]);
    if (!$inst):
        UPDATE inbox_messages SET handled_by='no_match' WHERE id=?;
        continue;
    endif;

    // 2. Проверить что не был уже принят
    if (($inst['partner_status'] ?? '') === 'accepted'):
        UPDATE inbox_messages SET handled_by='already_partner' WHERE id=?;
        continue;
    endif;

    // 3. Принять
    try:
        $r = partner_accept($inst['id']);
    catch (\Throwable $e):
        error_log('inbox_accept fail: ' . $e->getMessage());
        continue;
    endtry;

    // 4. Сгенерить сертификат
    $certPath = partner_cert_pdf($inst['id']);
    if (!$certPath):
        error_log('cert render failed for inst=' . $inst['id']);
        // Не критично — потом регенерируется, письмо всё равно шлём
    endif;

    // 5. Отправить приветственное письмо (см. ALL_EMAIL_TEMPLATES.md раздел 1.1)
    $sent = partner_send_welcome_email($inst['id'], $r['password_plain'], $certPath);
    if (!$sent):
        error_log('welcome email failed for inst=' . $inst['id']);
    endif;

    // 6. Пометить inbox как обработанный
    UPDATE inbox_messages SET
        handled_by='auto_accept',
        linked_partner_inst=$inst['id'],
        processed_at=NOW
        WHERE id=?;

    partner_log_event($inst['id'], 'auto_accepted_from_inbox',
        json_encode(['inbox_id' => $msg['id']]));
endforeach;
```

Аналогично для `kind='partner_decline'`:
```php
foreach (WHERE kind='partner_decline'):
    $inst = one("SELECT id FROM institutions WHERE LOWER(email)=?", [strtolower($msg['from_email'])]);
    if (!$inst): continue;

    partner_decline($inst['id'], 'auto_from_inbox: ' . mb_substr($msg['body_text'], 0, 200));
    // Расширенная версия уже удалит email!

    UPDATE inbox_messages SET handled_by='auto_decline' WHERE id=?;
endforeach;
```
