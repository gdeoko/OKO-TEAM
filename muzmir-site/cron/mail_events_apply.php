<?php
/**
 * РЕАКЦИЯ НА СОБЫТИЯ ДОСТАВКИ.
 *
 * Приёмник событий (api/v1/mail_events.php) обязан отвечать сервису мгновенно,
 * поэтому он только складывает события. Разбор — здесь: адрес, который вернул
 * жёсткий отказ, пожаловался на спам или отписался, снимается с рассылки, чтобы
 * мы не били в одну и ту же закрытую дверь и не портили репутацию домена.
 *
 * Мягкий отказ (переполнен ящик, сервер адресата лежал) не трогаем: через день
 * письмо уйдёт нормально.
 *
 *   php cron/mail_events_apply.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

/** Лог в общий журнал кронов. */
function mea_log(string $msg): void {
    $dir = BASE_PATH . '/data/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    @file_put_contents($dir . '/cron.log', '[' . date('Y-m-d H:i:s') . "] [mail_events_apply] $msg\n", FILE_APPEND);
    echo $msg . "\n";
}

try {
    db()->exec("ALTER TABLE mail_events ADD COLUMN handled_at TEXT DEFAULT ''");
} catch (\Throwable $e) { /* колонка уже есть */ }

$rows = [];
try {
    $rows = all("SELECT id, email, status FROM mail_events
                  WHERE COALESCE(handled_at,'')='' AND status IN ('hard_bounced','spam','unsubscribed')
                  ORDER BY id LIMIT 2000");
} catch (\Throwable $e) { mea_log('таблицы событий ещё нет'); exit(0); }

if (!$rows) { mea_log('новых событий для разбора нет'); exit(0); }

$n = ['учреждения' => 0, 'подписчики' => 0, 'очередь' => 0];
$chg = static fn(): int => (int) db()->query("SELECT changes()")->fetchColumn();

foreach ($rows as $r) {
    $e = mb_strtolower(trim((string) $r['email']));
    if ($e === '') { q("UPDATE mail_events SET handled_at=datetime('now') WHERE id=?", [(int) $r['id']]); continue; }
    foreach ([
        'учреждения' => ["UPDATE institutions SET status=?, updated_at=datetime('now')
                           WHERE status NOT IN ('bounced','unsubscribed','banned') AND LOWER(email)=?",
                         [(string) $r['status'] === 'unsubscribed' ? 'unsubscribed' : 'bounced', $e]],
        'подписчики' => ["UPDATE subscribers SET active=0 WHERE active=1 AND LOWER(email)=?", [$e]],
        'очередь'    => ["UPDATE mail_queue SET status='failed', error='отказ по событию доставки'
                           WHERE status='queued' AND LOWER(to_email)=?", [$e]],
    ] as $what => [$sql, $args]) {
        try { q($sql, $args); $n[$what] += $chg(); } catch (\Throwable $ex) {}
    }
    q("UPDATE mail_events SET handled_at=datetime('now') WHERE id=?", [(int) $r['id']]);
}

mea_log('разобрано событий ' . count($rows) . ': снято учреждений ' . $n['учреждения']
        . ', подписчиков ' . $n['подписчики'] . ', писем из очереди ' . $n['очередь']);
