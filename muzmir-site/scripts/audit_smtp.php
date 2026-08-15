<?php
/** Диагностика SMTP-пулов и последних отправок «Кода для входа». */
declare(strict_types=1);
define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'mailer'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';

echo "=== SMTP-настройки (settings) ===\n";
$s = all("SELECT key, value FROM settings WHERE key LIKE 'smtp%' OR key IN ('mail_from_name','smtp_senders') ORDER BY key");
foreach ($s as $r) {
    $v = (string) $r['value'];
    if (in_array($r['key'], ['smtp_pass'], true)) $v = '***';
    if ($r['key'] === 'smtp_senders') {
        $j = json_decode($v, true);
        if (is_array($j)) {
            foreach ($j as $k => $a) {
                echo "  sender[$k]: host=" . ($a['host'] ?? '-') . " port=" . ($a['port'] ?? '-') . " user=" . ($a['user'] ?? '-') . " from=" . ($a['from_addr'] ?? '-') . "\n";
            }
            continue;
        }
    }
    echo "  " . $r['key'] . " = " . (mb_strlen($v) > 100 ? mb_substr($v, 0, 100) . '…' : $v) . "\n";
}

echo "\n=== Пулы отправителей ===\n";
foreach (['tx', 'awards', 'bulk'] as $p) {
    $chain = mail_fallback_accounts([], $p);
    echo "  $p: ";
    foreach ($chain as $a) echo ($a['user'] ?? '-') . '@' . ($a['host'] ?? '-') . ':' . ($a['port'] ?? '-') . '  ';
    echo "\n";
}

echo "\n=== Последние 15 писем с subject 'Код для входа' ===\n";
$rows = all("SELECT id, to_email, status, error, created_at, sent_at
             FROM mail_queue WHERE subject LIKE '%Код для входа%' ORDER BY id DESC LIMIT 15");
if (!$rows) echo "  (нет)\n";
foreach ($rows as $r) {
    echo sprintf("  #%-6s %-40s status=%s created=%s sent=%s err=%s\n",
        $r['id'], $r['to_email'], $r['status'],
        $r['created_at'], $r['sent_at'] ?? '-', substr((string) ($r['error'] ?? '-'), 0, 60));
}

echo "\n=== Общая статистика писем на gmail/yandex/mail.ru за сутки ===\n";
$stats = all("SELECT
                CASE
                  WHEN to_email LIKE '%@gmail.com' THEN 'gmail'
                  WHEN to_email LIKE '%@yandex.%' THEN 'yandex'
                  WHEN to_email LIKE '%@mail.ru' THEN 'mail.ru'
                  ELSE 'other'
                END AS domain,
                status,
                COUNT(*) AS n
              FROM mail_queue
              WHERE created_at >= datetime('now','localtime','-1 day')
              GROUP BY domain, status
              ORDER BY domain, status");
foreach ($stats as $r) printf("  %-8s %-8s %d\n", $r['domain'], $r['status'], $r['n']);

echo "\n=== Проверка на карантин ящиков (mail_account_penalty) ===\n";
foreach (['main', 'nagradi', 'news', 'news2'] as $name) {
    $a = mail_account_by_name($name);
    if (!$a) { echo "  $name: НЕ настроен\n"; continue; }
    $p = mail_account_penalty($a);
    echo sprintf("  %-8s (%s) penalty=%d\n", $name, $a['user'] ?? '-', $p);
}
