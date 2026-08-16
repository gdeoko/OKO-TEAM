<?php
/**
 * ЖИВАЯ ПРОВЕРКА ПИСЬМА «ВЫ ПРИНЯТЫ В ПАРТНЁРЫ».
 *
 * Аудит проверяет механику на адресе зоны .test — туда письмо намеренно не
 * уходит. Здесь письмо отправляется по-настоящему, на ящик самого центра, чтобы
 * увидеть его глазами: тот ли отправитель, дошёл ли сертификат вложением, читаются
 * ли доступ в кабинет и персональная ссылка.
 *
 * Работает на своей временной институции и убирает её за собой полностью:
 * номер партнёрства, запись в реестре документов и события тоже удаляются.
 *
 *   php scripts/test_partner_welcome.php [почта]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/partner_docs.php';

$to = $argv[1] ?? (string) cfgv('org_email', '');
if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) { echo "нужен адрес ящика центра\n"; exit(1); }
// Письмо уходит настоящему получателю, поэтому получатель — только наш ящик.
$own = array_map('mb_strtolower', array_filter([
    (string) cfgv('org_email', ''), 'kulturniy.centr.mir@gmail.com',
]));
if (!in_array(mb_strtolower($to), $own, true)) {
    echo "адрес не принадлежит центру — отказ: $to\n"; exit(1);
}

$line = str_repeat('=', 78);
echo "ЖИВАЯ ПРОВЕРКА ПИСЬМА О ПРИЁМЕ В ПАРТНЁРЫ\n$line\nполучатель: $to\n";

partner_migrate();
$instId = (int) insert('institutions', [
    'name'     => 'ПРОВЕРКА ПИСЬМА Детская школа искусств',
    'region'   => 'Проверочная область',
    'city'     => 'Проверочный город',
    'email'    => $to,
    'director' => 'Проверкин Пров Провович',
    'source'   => 'test_welcome',
    'kind'     => 'dshi',
    'status'   => 'excluded',   // чтобы не попасть в рассылку, пока живёт
]);
echo "временная институция: id=$instId\n";

$cleanup = static function () use ($instId): void {
    $no = (string) (scalar("SELECT partner_no FROM institutions WHERE id=?", [$instId]) ?? '');
    try { if ($no !== '') q("DELETE FROM partner_docs WHERE institution_id=? OR number=?", [$instId, $no]); } catch (\Throwable $e) {}
    try { q("DELETE FROM partner_events WHERE institution_id=?", [$instId]); } catch (\Throwable $e) {}
    try { q("DELETE FROM partner_thanks WHERE institution_id=?", [$instId]); } catch (\Throwable $e) {}
    try { q("DELETE FROM institutions WHERE id=?", [$instId]); } catch (\Throwable $e) {}
    echo "временные данные удалены\n";
};

try {
    $r = partner_accept($instId);
    $no = (string) ($r['inst']['partner_no'] ?? '');
    echo "принят партнёром: № $no, пароль кабинета: " . (string) $r['password_plain'] . "\n";

    $t0 = microtime(true);
    $ok = partner_send_welcome($instId, (string) $r['password_plain']);
    printf("отправка: %s, %.1f с.\n", $ok ? 'ушло' : 'НЕ УШЛО — ' . mail_last_error(), microtime(true) - $t0);

    $ev = one("SELECT payload FROM partner_events WHERE institution_id=? AND kind='welcome_sent'", [$instId]);
    if ($ev) {
        $p = json_decode((string) $ev['payload'], true);
        echo "сертификат во вложении: " . (!empty($p['cert']) ? $p['cert'] : 'НЕТ (письмо ушло без него)') . "\n";
        echo "доступ в кабинет в письме: " . (!empty($p['access']) ? 'есть' : 'нет') . "\n";
    }
} catch (\Throwable $e) {
    echo "ОШИБКА: " . $e->getMessage() . "\n";
}

$cleanup();
echo "\nпроверьте ящик: письмо «Сертификат информационного партнёра»\n";
