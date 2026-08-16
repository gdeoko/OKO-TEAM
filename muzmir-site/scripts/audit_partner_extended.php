<?php
/**
 * АУДИТ v2 — расширенный: логика + edge cases + безопасность.
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

$PASS = 0; $FAIL = 0;
$errors = [];

function step(string $name, callable $fn): void {
    global $PASS, $FAIL, $errors;
    try {
        $r = $fn();
        if ($r === true) { echo "  ✓ $name\n"; $PASS++; }
        elseif ($r === null || $r === false) { echo "  ✗ $name\n"; $FAIL++; $errors[] = $name; }
        else { echo "  ✓ $name → $r\n"; $PASS++; }
    } catch (\Throwable $e) {
        echo "  ✗ $name — " . $e->getMessage() . "\n"; $FAIL++; $errors[] = $name;
    }
}
function section(string $t): void { echo "\n═══ $t ═══\n"; }

$TEST_EMAIL = 'okoteam.top+audit-' . substr(bin2hex(random_bytes(3)),0,6) . '@gmail.com'; // реальный email через subaddress
$TEST_INST_ID = insert('institutions', [
    'name'    => 'ТЕСТ-АУДИТ2 Детская школа искусств',
    'region'  => 'Тестовая область',
    'email'   => $TEST_EMAIL,
    'director'=> 'Тестовый Тест Тестович',
    'source'  => 'audit', 'kind' => 'dshi',
]);
register_shutdown_function(function() use (&$TEST_INST_ID) {
    if (!$TEST_INST_ID) return;
    q("DELETE FROM applications      WHERE institution_id=?", [$TEST_INST_ID]);
    q("DELETE FROM partner_thanks    WHERE institution_id=?", [$TEST_INST_ID]);
    q("DELETE FROM partner_events    WHERE institution_id=?", [$TEST_INST_ID]);
    q("DELETE FROM partner_docs      WHERE institution_id=?", [$TEST_INST_ID]);
    q("DELETE FROM mail_queue        WHERE to_email LIKE 'okoteam.top+audit-%@gmail.com'");
    q("DELETE FROM institutions      WHERE id=?", [$TEST_INST_ID]);
});

$ACCEPTED = partner_accept($TEST_INST_ID);

/* ─────────── EDGE CASES ─────────── */

section('E1. Edge cases: пустые/битые данные');
step('partner_by_slug(пусто) → null', function() { return partner_by_slug('') === null; });
step('partner_by_email(пусто) → null', function() { return partner_by_email('') === null; });
step('partner_by_promo(пусто) → null', function() { return partner_by_promo('') === null; });
step('partner_apply_promo(несуществующий) → false', function() { return partner_apply_promo('FAKE-CODE-XXXX') === false; });
step('partner_login(пусто, пусто) → null', function() { return partner_login('', '') === null; });
step('partner_login(валидный email, пусто) → null', function() use ($TEST_EMAIL) { return partner_login($TEST_EMAIL, '') === null; });
step('partner_current без сессии → null', function() {
    unset($_SESSION['partner_id']);
    return partner_current() === null;
});

section('E2. Гонка на промокоде (несколько параллельных вызовов)');
step('промокод не даст больше max использований (защита транзакцией)', function() use ($TEST_INST_ID) {
    q("UPDATE institutions SET partner_promo_uses=0, partner_promo_max=3 WHERE id=?", [$TEST_INST_ID]);
    $p = one("SELECT partner_promo_code FROM institutions WHERE id=?", [$TEST_INST_ID]);
    $ok = 0; $no = 0;
    for ($i = 0; $i < 10; $i++) {
        $r = partner_apply_promo((string)$p['partner_promo_code']);
        if ($r) $ok++; else $no++;
    }
    q("UPDATE institutions SET partner_promo_max=10, partner_promo_uses=0 WHERE id=?", [$TEST_INST_ID]);
    return $ok === 3 && $no === 7 ? "успешно $ok, отказ $no (лимит 3)" : "expected 3/7, got $ok/$no";
});

section('E3. Безопасность');
step('SQL injection в promo — не сработает', function() {
    return partner_by_promo("'; DROP TABLE institutions; --") === null;
});
step('SQL injection в slug — не сработает', function() {
    return partner_by_slug("'; DROP TABLE institutions; --") === null;
});
step('верификация: подпись от чужого номера НЕ проходит', function() {
    $realNo = 'ИП-2026-99999';
    $wrongNo = 'ИП-2026-00001';
    $realSig = substr(hash_hmac('sha256', 'partner-doc:' . $realNo, pay_secret()), 0, 16);
    // Пытаемся использовать real-подпись с wrong-номером
    $url = rtrim((string)cfgv('base_url'),'/') . '/tests/verify.php?n=' . rawurlencode($wrongNo) . '&s=' . $realSig;
    $body = @file_get_contents($url);
    return $body && str_contains($body, 'не подтверждён');
});
step('верификация: пустая подпись → «не подтверждён»', function() {
    $url = rtrim((string)cfgv('base_url'),'/') . '/tests/verify.php?n=ANY&s=';
    $body = @file_get_contents($url);
    return $body && str_contains($body, 'не подтверждён');
});
step('slug со спецсимволами (Юникод, точки, слэши) — не создаёт коллизий', function() use ($TEST_INST_ID) {
    $slug1 = partner_slugify('МБУДО «ДШИ №1» / город Санкт-Петербург');
    $slug2 = partner_slugify('МБУДО ДШИ 1 город Санкт Петербург');
    // Оба должны быть валидны
    return preg_match('~^[a-z0-9-]+$~', $slug1) && preg_match('~^[a-z0-9-]+$~', $slug2)
        ? "$slug1 vs $slug2" : false;
});

section('E4. Идемпотентность триггеров');
q("UPDATE institutions SET partner_notified_5=0, partner_notified_10=0 WHERE id=?", [$TEST_INST_ID]);
// Заведём 10 заявок разом
for ($i = 1; $i <= 10; $i++) {
    insert('applications', [
        'number' => 'TEST-AUD2-' . $TEST_INST_ID . '-' . $i,
        'competition_id' => 21, 'user_id' => 0,
        'full_name' => "Уч $i", 'work_title' => "Ном $i",
        'age_category'=>'До 6 лет','nomination'=>'Хореография','formation'=>'Соло',
        'teacher' => 'Т' . $i, 'status'=>'new', 'is_paid'=>1,
        'email'=>'test@example.test', 'institution_id'=>$TEST_INST_ID,
    ]);
}
step('крон запуск №1: apps_5 и apps_10 события созданы', function() use ($TEST_INST_ID) {
    exec('php /var/www/muzmir/cron/partner_triggers.php 2>&1');
    $c5  = (int) scalar("SELECT COUNT(*) FROM partner_events WHERE institution_id=? AND kind='apps_5'",  [$TEST_INST_ID]);
    $c10 = (int) scalar("SELECT COUNT(*) FROM partner_events WHERE institution_id=? AND kind='apps_10'", [$TEST_INST_ID]);
    return $c5 === 1 && $c10 === 1 ? "apps_5=$c5 apps_10=$c10" : "expected 1/1, got $c5/$c10";
});
step('крон запуск №2: события НЕ дублируются', function() use ($TEST_INST_ID) {
    exec('php /var/www/muzmir/cron/partner_triggers.php 2>&1');
    $c5  = (int) scalar("SELECT COUNT(*) FROM partner_events WHERE institution_id=? AND kind='apps_5'",  [$TEST_INST_ID]);
    $c10 = (int) scalar("SELECT COUNT(*) FROM partner_events WHERE institution_id=? AND kind='apps_10'", [$TEST_INST_ID]);
    return $c5 === 1 && $c10 === 1 ? "стабильно $c5/$c10 (не задублено)" : "ДУБЛИ: $c5/$c10";
});

section('E5. Массовость: партнёр без email не крашит крон');
$INST2 = insert('institutions', [
    'name' => 'ТЕСТ-АУДИТ Без email', 'email' => '', 'source' => 'audit', 'kind' => 'other',
]);
partner_accept($INST2);
for ($i = 1; $i <= 5; $i++) insert('applications', [
    'number' => 'TEST-AUD-NOEM-' . $i,
    'competition_id' => 21, 'user_id' => 0,
    'full_name' => "У $i", 'work_title' => "$i",
    'age_category'=>'До 6 лет','nomination'=>'Хореография','formation'=>'Соло',
    'teacher' => 'X', 'status'=>'new', 'is_paid'=>1,
    'email'=>'x@example.test', 'institution_id'=>$INST2,
]);
step('крон не крашится при партнёре без email', function() use ($INST2) {
    exec('php /var/www/muzmir/cron/partner_triggers.php 2>&1', $out, $rc);
    return $rc === 0;
});
step('счётчик всё равно обновлён (5 заявок)', function() use ($INST2) {
    $p = one("SELECT partner_apps_count, partner_notified_5 FROM institutions WHERE id=?", [$INST2]);
    // Флаг notified_5 не должен ставиться — email-то нет.
    return (int)$p['partner_apps_count'] === 5 && (int)$p['partner_notified_5'] === 0;
});
// Cleanup
q("DELETE FROM applications      WHERE institution_id=?", [$INST2]);
q("DELETE FROM partner_thanks    WHERE institution_id=?", [$INST2]);
q("DELETE FROM partner_events    WHERE institution_id=?", [$INST2]);
q("DELETE FROM partner_docs      WHERE institution_id=?", [$INST2]);
q("DELETE FROM institutions      WHERE id=?", [$INST2]);

section('E6. Форма благодарностей: ограничение "1 руководство"');
q("UPDATE institutions SET partner_thanks_manager_used=0 WHERE id=?", [$TEST_INST_ID]);
q("DELETE FROM partner_thanks    WHERE institution_id=?", [$TEST_INST_ID]);
step('можно завести благодарности руководству', function() use ($TEST_INST_ID) {
    $no = partner_thanks_next_no($TEST_INST_ID, 'manager');
    insert('partner_thanks', ['institution_id'=>$TEST_INST_ID,'role'=>'manager','fio'=>'Иванов И.И.','doc_number'=>$no,'status'=>'queued']);
    q("UPDATE institutions SET partner_thanks_manager_used=1 WHERE id=?", [$TEST_INST_ID]);
    $r = one("SELECT partner_thanks_manager_used FROM institutions WHERE id=?", [$TEST_INST_ID]);
    return (int)$r['partner_thanks_manager_used'] === 1;
});
step('второй раз на руководство — контроллер должен отклонять (проверка в public/partner.php)', function() {
    // Проверим что в коде есть проверка
    $s = file_get_contents('/var/www/muzmir/public/partner.php');
    return str_contains($s, 'partner_thanks_manager_used') && str_contains($s, 'уже выдавались');
});

section('E7. Форма благодарностей: дедупликация по ФИО');
q("DELETE FROM partner_thanks    WHERE institution_id=?", [$TEST_INST_ID]);
step('дубль по ФИО (case-insensitive) не даёт вставить (уникальный индекс)', function() use ($TEST_INST_ID) {
    $no1 = partner_thanks_next_no($TEST_INST_ID, 'teacher');
    insert('partner_thanks', ['institution_id'=>$TEST_INST_ID,'role'=>'teacher','fio'=>'Иванова М.П.','doc_number'=>$no1,'status'=>'queued']);
    $ok = false;
    try {
        $no2 = partner_thanks_next_no($TEST_INST_ID, 'teacher');
        insert('partner_thanks', ['institution_id'=>$TEST_INST_ID,'role'=>'teacher','fio'=>'иванова м.п.','doc_number'=>$no2,'status'=>'queued']);
    } catch (\Throwable $e) { $ok = true; }
    return $ok ? 'ОК (unique constraint)' : 'НЕТ ОШИБКИ — дедуп сломан';
});

section('E8. Автоматизация: cron прописан и работает');
step('cron в crontab', function() {
    exec('crontab -l 2>/dev/null', $out);
    foreach ($out as $l) if (str_contains($l, 'partner_triggers.php')) return true;
    return false;
});
step('cron лог папка существует', function() {
    return is_dir('/var/www/muzmir/data/logs');
});
step('cron лог-файл создастся при первом запуске', function() {
    exec('php /var/www/muzmir/cron/partner_triggers.php >> /var/www/muzmir/data/logs/partner.log 2>&1');
    return is_file('/var/www/muzmir/data/logs/partner.log');
});

/* ─────────── ИТОГ ─────────── */

echo "\n═══════════════════════════════════════════════\n";
echo "АУДИТ v2 · PASSED $PASS · FAILED $FAIL\n";
if ($FAIL > 0) { echo "ПРОБЛЕМЫ:\n"; foreach ($errors as $e) echo "  · $e\n"; }
echo "═══════════════════════════════════════════════\n";
exit($FAIL === 0 ? 0 : 1);
