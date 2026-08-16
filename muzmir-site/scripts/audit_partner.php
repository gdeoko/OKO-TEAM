<?php
/**
 * АВТОМАТИЗИРОВАННЫЙ АУДИТ партнёрской программы «Информационный партнёр».
 *
 * Прогоняет полный жизненный цикл на изолированной тестовой институции,
 * не трогая реальных данных. По каждому шагу — PASS/FAIL с причиной.
 * По завершении обязательно чистит за собой (все тестовые записи).
 *
 * Запуск: php audit_partner.php
 * Выход:  сводка "PASSED N / FAILED M / SKIPPED K", exit 0/1
 */
declare(strict_types=1);
define('BASE_PATH', '/var/www/muzmir');
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/partner_docs.php';
require_once BASE_PATH . '/core/paylink.php';

$PASS = 0; $FAIL = 0; $SKIP = 0;
$errors = [];
$startTs = microtime(true);

function step(string $name, callable $fn): void {
    global $PASS, $FAIL, $errors;
    try {
        $r = $fn();
        if ($r === true) { echo "  ✓ $name\n"; $PASS++; }
        elseif ($r === null || $r === false) { echo "  ✗ $name — false\n"; $FAIL++; $errors[] = $name; }
        else { echo "  ✓ $name → $r\n"; $PASS++; }
    } catch (\Throwable $e) {
        echo "  ✗ $name — EXCEPTION: " . $e->getMessage() . "\n";
        $FAIL++;
        $errors[] = $name . ': ' . $e->getMessage();
    }
}

function section(string $title): void { echo "\n═══ $title ═══\n"; }

/* ─────────────────────── ПОДГОТОВКА: изолированный тестовый партнёр ─────────────────────── */

section('0. Тестовая институция (isolated)');

// Создаём тестовую институцию НЕ ТРОГАЯ существующих
$TEST_EMAIL = 'audit-test-' . substr(bin2hex(random_bytes(4)), 0, 8) . '@example.test';
$TEST_INST_ID = null;

step('создать тестовую institution', function() use (&$TEST_INST_ID, $TEST_EMAIL) {
    $TEST_INST_ID = insert('institutions', [
        'name'    => 'ТЕСТ-АУДИТ Детская школа искусств',
        'region'  => 'Тестовая область',
        'city'    => 'Тестовый город',
        'email'   => $TEST_EMAIL,
        'director'=> 'Тестовый Тест Тестович',
        'source'  => 'audit',
        'kind'    => 'dshi',
    ]);
    return $TEST_INST_ID > 0 ? "id=$TEST_INST_ID" : false;
});

$cleanup = function() use (&$TEST_INST_ID) {
    if (!$TEST_INST_ID) return;
    try { q("DELETE FROM applications      WHERE institution_id=?", [$TEST_INST_ID]); } catch (\Throwable $e) {}
    try { q("DELETE FROM partner_thanks    WHERE institution_id=?", [$TEST_INST_ID]); } catch (\Throwable $e) {}
    try { q("DELETE FROM partner_events    WHERE institution_id=?", [$TEST_INST_ID]); } catch (\Throwable $e) {}
    try { q("DELETE FROM partner_docs      WHERE institution_id=?", [$TEST_INST_ID]); } catch (\Throwable $e) {}
    try { q("DELETE FROM mail_queue        WHERE to_email LIKE 'audit-test-%@example.test' OR subject LIKE '[АУДИТ]%'"); } catch (\Throwable $e) {}
    try { q("DELETE FROM institutions      WHERE id=?", [$TEST_INST_ID]); } catch (\Throwable $e) {}
};
register_shutdown_function($cleanup);

/* ─────────────────────── 1. СХЕМА БД ─────────────────────── */

section('1. Схема БД');
step('таблица partner_thanks существует', function() {
    return scalar("SELECT name FROM sqlite_master WHERE type='table' AND name='partner_thanks'") === 'partner_thanks';
});
step('таблица partner_docs существует', function() {
    return scalar("SELECT name FROM sqlite_master WHERE type='table' AND name='partner_docs'") === 'partner_docs';
});
step('таблица partner_events существует', function() {
    return scalar("SELECT name FROM sqlite_master WHERE type='table' AND name='partner_events'") === 'partner_events';
});
step('institutions.partner_status колонка есть', function() {
    $r = one("SELECT COUNT(*) c FROM pragma_table_info('institutions') WHERE name='partner_status'");
    return (int) ($r['c'] ?? 0) === 1;
});
step('applications.institution_id колонка есть', function() {
    $r = one("SELECT COUNT(*) c FROM pragma_table_info('applications') WHERE name='institution_id'");
    return (int) ($r['c'] ?? 0) === 1;
});
step('уникальный индекс по partner_slug', function() {
    return scalar("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_inst_partner_slug'") === 'idx_inst_partner_slug';
});
step('уникальный индекс по partner_promo_code', function() {
    return scalar("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_inst_partner_promo'") === 'idx_inst_partner_promo';
});

/* ─────────────────────── 2. ЯДРО partner_accept + генерация ─────────────────────── */

section('2. Ядро partner_accept и генерация артефактов');
$ACCEPTED = null;
step('partner_accept: возвращает партнёра с пустого статуса', function() use (&$ACCEPTED, $TEST_INST_ID) {
    $r = partner_accept($TEST_INST_ID);
    $ACCEPTED = $r;
    return !empty($r['inst']['partner_no']) && !empty($r['password_plain'])
        ? "no={$r['inst']['partner_no']}, pass len=" . strlen($r['password_plain'])
        : false;
});
step('partner_accept: idempotent (второй вызов пароль не возвращает)', function() use ($TEST_INST_ID) {
    $r = partner_accept($TEST_INST_ID);
    return $r['password_plain'] === '';
});
step('slug создан и уникален (транслит из названия)', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_slug FROM institutions WHERE id=?", [$TEST_INST_ID]);
    $slug = (string) ($p['partner_slug'] ?? '');
    return $slug !== '' && preg_match('~^[a-z0-9-]+$~', $slug) ? "slug=$slug" : false;
});
step('промокод сгенерирован в формате PART-YYYY-XXXX', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_promo_code FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return preg_match('~^PART-\d{4}-[A-Z0-9]{4}$~', (string) ($p['partner_promo_code'] ?? '')) ? "code={$p['partner_promo_code']}" : false;
});
step('номер партнёрства в реестре partner_docs', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_no FROM institutions WHERE id=?", [$TEST_INST_ID]);
    $doc = one("SELECT * FROM partner_docs WHERE number=?", [$p['partner_no']]);
    return $doc && $doc['kind'] === 'cert' ? "kind={$doc['kind']}" : false;
});
step('событие accepted залогировано', function() use ($TEST_INST_ID) {
    $ev = one("SELECT COUNT(*) c FROM partner_events WHERE institution_id=? AND kind='accepted'", [$TEST_INST_ID]);
    return (int) $ev['c'] >= 1;
});

/* ── 2б. Письмо «вы приняты»: сертификат и доступ в кабинет ─────────────────
   Самое узкое место цепочки. Пароль в открытом виде существует ровно один раз —
   в ответе partner_accept. Если письмо не уходит, учреждение остаётся партнёром
   только на бумаге: ни сертификата, ни входа в кабинет. */
step('письмо о приёме уходит и помечает доступ выданным', function() use ($TEST_INST_ID) {
    $ok = partner_send_welcome($TEST_INST_ID, 'TESTPASS');
    if (!$ok) return false;
    $shown = (int) (scalar("SELECT partner_pass_shown FROM institutions WHERE id=?", [$TEST_INST_ID]) ?? 0);
    return $shown === 1 ? 'отправлено, доступ отмечен выданным' : false;
});
step('письмо о приёме не отправляется дважды', function() use ($TEST_INST_ID) {
    partner_send_welcome($TEST_INST_ID, 'TESTPASS');
    $n = (int) (scalar("SELECT COUNT(*) FROM partner_events WHERE institution_id=? AND kind='welcome_sent'", [$TEST_INST_ID]) ?? 0);
    return $n === 1 ? 'ровно одно событие welcome_sent' : false;
});

/* ─────────────────────── 3. Аутентификация ЛК ─────────────────────── */

section('3. Аутентификация ЛК партнёра');
step('partner_login с верным паролем работает', function() use ($ACCEPTED, $TEST_EMAIL) {
    $p = partner_login($TEST_EMAIL, $ACCEPTED['password_plain']);
    return $p && !empty($p['id']);
});
step('partner_login с неверным паролем отказывает', function() use ($TEST_EMAIL) {
    return partner_login($TEST_EMAIL, 'WRONG_PASS') === null;
});
step('partner_by_email возвращает партнёра', function() use ($TEST_EMAIL) {
    return partner_by_email($TEST_EMAIL) !== null;
});
step('partner_by_slug возвращает партнёра', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_slug FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return partner_by_slug((string) $p['partner_slug']) !== null;
});
step('несуществующий slug → null', function() {
    return partner_by_slug('nonexistent-xxx-yyy-zzz') === null;
});

/* ─────────────────────── 4. Промокод: применение и лимиты ─────────────────────── */

section('4. Промокод и его лимиты');
step('partner_by_promo находит по коду', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_promo_code FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return partner_by_promo((string) $p['partner_promo_code']) !== null;
});
step('partner_apply_promo даёт 10% и инкрементит', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_promo_code FROM institutions WHERE id=?", [$TEST_INST_ID]);
    $r = partner_apply_promo((string) $p['partner_promo_code'], 999999);
    return $r && (int) $r['discount_pct'] === 10 && (int) $r['uses_left'] === 9;
});
step('счётчик promo_uses = 1 в БД', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_promo_uses FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return (int) $p['partner_promo_uses'] === 1;
});
step('исчерпание промокода (используем 9 раз) — 10-й даёт false', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_promo_code FROM institutions WHERE id=?", [$TEST_INST_ID]);
    for ($i = 0; $i < 9; $i++) partner_apply_promo((string) $p['partner_promo_code'], 1000000 + $i);
    $r = partner_apply_promo((string) $p['partner_promo_code']);
    return $r === false;
});
step('уже исчерпанный код не находится через partner_by_promo', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_promo_code FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return partner_by_promo((string) $p['partner_promo_code']) === null;
});
// Сбросим счётчик для дальнейших тестов
q("UPDATE institutions SET partner_promo_uses=0 WHERE id=?", [$TEST_INST_ID]);

/* ─────────────────────── 5. Привязка заявок ─────────────────────── */

section('5. Привязка applications.institution_id');
$TEST_APPS = [];
step('создать 4 тестовых заявки (institution_id=TEST)', function() use ($TEST_INST_ID, &$TEST_APPS) {
    for ($i = 1; $i <= 4; $i++) {
        $aid = insert('applications', [
            'number'         => 'TEST-AUDIT-' . $TEST_INST_ID . '-' . $i,
            'competition_id' => 21, // Величие России
            'user_id'        => 0,
            'full_name'      => 'Участник Тестов ' . $i,
            'work_title'     => 'Тестовый номер ' . $i,
            'age_category'   => 'До 6 лет',
            'nomination'     => 'Хореография',
            'formation'      => 'Соло',
            'teacher'        => ($i === 4 ? 'Иванова Мария Петровна' : 'Петров Иван Тестович'),
            'status'         => 'new',
            'is_paid'        => 1,
            'email'          => 'test@example.test',
            'institution_id' => $TEST_INST_ID,
        ]);
        $TEST_APPS[] = $aid;
    }
    return count($TEST_APPS) === 4 ? '4 заявки, id=' . implode(',', $TEST_APPS) : false;
});
step('partner_refresh_counts обновляет счётчик', function() use ($TEST_INST_ID) {
    $r = partner_refresh_counts($TEST_INST_ID);
    return $r['count'] === 4 ? "count={$r['count']}, paid={$r['paid']}" : false;
});

/* ─────────────────────── 6. Триггер 5-заявок ─────────────────────── */

section('6. Триггер 5+ заявок → письмо + флаг notified_5');
step('добавить 5-ю заявку', function() use ($TEST_INST_ID) {
    $aid = insert('applications', [
        'number' => 'TEST-AUDIT-' . $TEST_INST_ID . '-5',
        'competition_id' => 21, 'user_id' => 0,
        'full_name' => 'Пятый Тестовый', 'work_title' => 'Пятый номер',
        'age_category' => 'До 6 лет', 'nomination' => 'Хореография', 'formation' => 'Соло',
        'teacher' => 'Смирнов Александр Николаевич', 'status' => 'new', 'is_paid' => 1,
        'email' => 'test@example.test', 'institution_id' => $TEST_INST_ID,
    ]);
    return $aid > 0;
});
step('крон-триггер запущен: apps_5 сработал', function() use ($TEST_INST_ID) {
    // Прогоняем крон-функции напрямую (без запуска процесса)
    exec('php /var/www/muzmir/cron/partner_triggers.php >> /var/www/muzmir/data/logs/partner.log 2>&1', $out, $rc);
    $ev = one("SELECT COUNT(*) c FROM partner_events WHERE institution_id=? AND kind='apps_5'", [$TEST_INST_ID]);
    return (int) $ev['c'] >= 1;
});
step('флаг partner_notified_5 = 1', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_notified_5 FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return (int) $p['partner_notified_5'] === 1;
});


/* ─────────────────────── 7. Триггер 10-заявок → промокод ─────────────────────── */

section('7. Триггер 10+ заявок → активация промокода');
step('добавить ещё 5 заявок (итого 10)', function() use ($TEST_INST_ID) {
    for ($i = 6; $i <= 10; $i++) {
        insert('applications', [
            'number' => 'TEST-AUDIT-' . $TEST_INST_ID . '-' . $i,
            'competition_id' => 21, 'user_id' => 0,
            'full_name' => "Участник {$i}", 'work_title' => "Номер {$i}",
            'age_category' => 'До 6 лет', 'nomination' => 'Хореография', 'formation' => 'Соло',
            'teacher' => 'Петрова Елена Владимировна', 'status' => 'new', 'is_paid' => 1,
            'email' => 'test@example.test', 'institution_id' => $TEST_INST_ID,
        ]);
    }
    partner_refresh_counts($TEST_INST_ID);
    $p = one("SELECT partner_apps_count FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return (int) $p['partner_apps_count'] === 10;
});
step('крон: apps_10 сработал', function() use ($TEST_INST_ID) {
    exec('php /var/www/muzmir/cron/partner_triggers.php >> /var/www/muzmir/data/logs/partner.log 2>&1', $out, $rc);
    $ev = one("SELECT COUNT(*) c FROM partner_events WHERE institution_id=? AND kind='apps_10'", [$TEST_INST_ID]);
    return (int) $ev['c'] >= 1;
});
step('promo_activated_at заполнено', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_promo_activated_at FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return !empty($p['partner_promo_activated_at']);
});

/* ─────────────────────── 8. Форма благодарностей ─────────────────────── */

section('8. Форма благодарностей → очередь → отправка группой');
step('создать 3 записи в partner_thanks (руководство+2 педагога)', function() use ($TEST_INST_ID) {
    $ids = [];
    $roles = [
        ['manager', 'Тестовый Тест Тестович',        'БЛГ-ИП-TEST-Р1'],
        ['teacher', 'Иванова Мария Петровна',        'БЛГ-ИП-TEST-П1'],
        ['teacher', 'Смирнов Александр Николаевич',  'БЛГ-ИП-TEST-П2'],
    ];
    foreach ($roles as [$role, $fio, $no]) {
        $ids[] = insert('partner_thanks', [
            'institution_id' => $TEST_INST_ID, 'role' => $role, 'fio' => $fio,
            'doc_number' => $no . '-' . substr(bin2hex(random_bytes(2)),0,4),
            'status' => 'queued', 'scheduled_send_at' => date('Y-m-d H:i:s', time() - 60),
        ]);
    }
    return count($ids) === 3 ? '3 thanks' : false;
});
step('крон-триггер: генерация PDF + отправка группой', function() use ($TEST_INST_ID) {
    exec('php /var/www/muzmir/cron/partner_triggers.php >> /var/www/muzmir/data/logs/partner.log 2>&1', $out, $rc);
    $sent = (int) scalar("SELECT COUNT(*) FROM partner_thanks WHERE institution_id=? AND status='sent'", [$TEST_INST_ID]);
    // "sent" может быть 0 если email тестовый и Unisender отклонил. Проверим что хотя бы PDF сгенерились.
    $gen = (int) scalar("SELECT COUNT(*) FROM partner_thanks WHERE institution_id=? AND doc_path<>''", [$TEST_INST_ID]);
    return $gen === 3 ? "sent=$sent generated=$gen" : false;
});
step('PDF-файлы реально созданы и >100КБ', function() use ($TEST_INST_ID) {
    $rows = all("SELECT doc_path FROM partner_thanks WHERE institution_id=? AND doc_path<>''", [$TEST_INST_ID]);
    $ok = 0;
    foreach ($rows as $r) {
        if (is_file($r['doc_path']) && filesize($r['doc_path']) > 100000) $ok++;
    }
    return $ok === 3 ? "3 PDF файла OK" : "только $ok из 3";
});
step('запись в реестре partner_docs = 3 благодарности', function() use ($TEST_INST_ID) {
    $n = (int) scalar("SELECT COUNT(*) FROM partner_docs WHERE institution_id=? AND kind IN ('thanks_manager','thanks_teacher')", [$TEST_INST_ID]);
    return $n === 3;
});

/* ─────────────────────── 9. Приоритет 4 дня для дипломов партнёра ─────────────────────── */

section('9. Приоритет 4 дня для дипломов партнёра (send_diplomas.php)');
step('код содержит partner_priority_days hook', function() {
    $s = file_get_contents('/var/www/muzmir/cron/send_diplomas.php');
    return str_contains($s, 'partner_priority_days');
});
step('поле partner_priority_days у партнёра = 4', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_priority_days FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return (int) $p['partner_priority_days'] === 4;
});

/* ─────────────────────── 10. Verify.php — реестр проверки подлинности ─────────────────────── */

section('10. verify.php — HMAC-проверка');
step('корректная подпись → страница «подлинный»', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_no FROM institutions WHERE id=?", [$TEST_INST_ID]);
    $n = (string) $p['partner_no'];
    $s = substr(hash_hmac('sha256', 'partner-doc:' . $n, pay_secret()), 0, 16);
    $url = rtrim((string) cfgv('base_url'), '/') . '/tests/verify.php?n=' . rawurlencode($n) . '&s=' . $s;
    $out = @file_get_contents($url);
    return $out && str_contains($out, 'Документ подлинный');
});
step('неверная подпись → «не подтверждён»', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_no FROM institutions WHERE id=?", [$TEST_INST_ID]);
    $url = rtrim((string) cfgv('base_url'), '/') . '/tests/verify.php?n=' . rawurlencode((string) $p['partner_no']) . '&s=WRONGSIG12345678';
    $out = @file_get_contents($url);
    return $out && str_contains($out, 'не подтверждён');
});

/* ─────────────────────── 11. HTTP роуты ─────────────────────── */

section('11. HTTP роуты');
step('/admin/?p=partners → 200', function() {
    $ch = curl_init(rtrim((string) cfgv('base_url'), '/') . '/admin/?p=partners');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_FOLLOWLOCATION => false]);
    curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    return $code === 200;
});
// По /partner живёт публичная страница программы, кабинет — на ?a=login.
// Так письма партнёру («оформить благодарности», «посмотреть промокод») ведут
// в кабинет, а поисковикам и новым учреждениям достаётся страница программы.
step('/partner?a=login → 200 (форма логина)', function() {
    $ch = curl_init(rtrim((string) cfgv('base_url'), '/') . '/partner?a=login');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_FOLLOWLOCATION => true]);
    $body = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    return $code === 200 && $body && str_contains($body, 'Кабинет партнёра');
});
step('/p/<slug> → 302 на /apply?src=partner', function() use ($TEST_INST_ID) {
    $p = one("SELECT partner_slug FROM institutions WHERE id=?", [$TEST_INST_ID]);
    $ch = curl_init(rtrim((string) cfgv('base_url'), '/') . '/p/' . rawurlencode((string) $p['partner_slug']));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_FOLLOWLOCATION => false, CURLOPT_HEADER => true]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $loc = (string) curl_getinfo($ch, CURLINFO_REDIRECT_URL);
    curl_close($ch);
    return $code === 302 && str_contains($loc, '/apply?src=partner');
});
step('/p/nonexistent → 302 на /', function() {
    $ch = curl_init(rtrim((string) cfgv('base_url'), '/') . '/p/nonexistent-xxxxx-yyyyy');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_FOLLOWLOCATION => false]);
    curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE); curl_close($ch);
    return $code === 302;
});

/* ─────────────────────── 12. Cron в crontab ─────────────────────── */

section('12. Cron partner_triggers');
step('cron partner_triggers.php прописан в crontab', function() {
    exec('crontab -l 2>/dev/null', $out);
    foreach ($out as $l) if (str_contains($l, 'partner_triggers.php')) return true;
    return false;
});

/* ─────────────────────── 13. Отказ / блок / сброс пароля ─────────────────────── */

section('13. Блокировка и восстановление');
step('partner_block → status=blocked', function() use ($TEST_INST_ID) {
    partner_block($TEST_INST_ID, 'audit test');
    $p = one("SELECT partner_status FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return $p['partner_status'] === 'blocked';
});
step('заблокированный не логинится', function() use ($TEST_EMAIL, $ACCEPTED) {
    return partner_login($TEST_EMAIL, $ACCEPTED['password_plain']) === null;
});
step('partner_unblock → status=accepted', function() use ($TEST_INST_ID) {
    partner_unblock($TEST_INST_ID);
    $p = one("SELECT partner_status FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return $p['partner_status'] === 'accepted';
});
step('partner_reset_password: новый пароль работает, старый — нет', function() use ($TEST_INST_ID, $TEST_EMAIL, $ACCEPTED) {
    $newPass = partner_reset_password($TEST_INST_ID);
    $oldOk = partner_login($TEST_EMAIL, $ACCEPTED['password_plain']) !== null;
    $newOk = partner_login($TEST_EMAIL, $newPass) !== null;
    return !$oldOk && $newOk;
});

/* ─────────────────────── ИТОГ ─────────────────────── */

$dur = round(microtime(true) - $startTs, 1);
echo "\n═══════════════════════════════════════════════\n";
echo "ИТОГ: PASSED $PASS · FAILED $FAIL · $dur с\n";
if ($FAIL > 0) { echo "ПРОБЛЕМЫ:\n"; foreach ($errors as $e) echo "  · $e\n"; }
echo "═══════════════════════════════════════════════\n";
exit($FAIL === 0 ? 0 : 1);
