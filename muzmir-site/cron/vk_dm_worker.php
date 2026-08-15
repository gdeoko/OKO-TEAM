<?php
/**
 * Воркер рассылки личных сообщений от сообщества ВК (очередь vk_dm_queue).
 * Аудитория — только открытые диалоги сообщества (кто сам писал/разрешил
 * сообщения), поэтому это легальная рассылка, а не спам.
 *
 * Крон-строка (раз в минуту):
 *   * * * * * php /var/www/muzmir/cron/vk_dm_worker.php >/dev/null 2>&1
 *
 * Темп: settings.vk_dm_per_run сообщений за запуск (по умолчанию 20) с паузой
 * ~1.2с между отправками — 5 тыс. диалогов уходят за ~4-5 часов.
 * Ошибки приватности (901/902/936/914) — skipped, не повторяем; флуд-контроль
 * (6/9/29) — оставляем в очереди и выходим до следующей минуты.
 * Выключатель: settings.vk_dm_enabled = '0' останавливает отправку.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'vk_dm_worker';

if (!cron_lock(JOB, 300)) exit(0);

try {
    if (trim((string) cfgv('vk_token', '')) === '') { cron_unlock(JOB); exit(0); }
    if ((string) scalar("SELECT value FROM settings WHERE key='vk_dm_enabled'") === '0') {
        cron_unlock(JOB);
        exit(0);
    }
    vk_dm_ensure_table();

    $perRun = max(1, (int) (scalar("SELECT value FROM settings WHERE key='vk_dm_per_run'") ?: 20));
    $batch = all("SELECT * FROM vk_dm_queue WHERE status='queued' ORDER BY id LIMIT " . $perRun);
    if (!$batch) { cron_unlock(JOB); exit(0); }

    $sent = 0; $skip = 0;
    foreach ($batch as $m) {
        $r = vk_dm_send((int) $m['peer_id'], (string) $m['message'], (string) $m['attachment'], (int) $m['id']);
        if (isset($r['response'])) {
            db()->prepare("UPDATE vk_dm_queue SET status='sent', sent_at=datetime('now','localtime') WHERE id=?")
                ->execute([(int) $m['id']]);
            $sent++;
        } else {
            $code = (int) ($r['error']['error_code'] ?? 0);
            $msg  = (string) ($r['error']['error_msg'] ?? '?');
            if (in_array($code, [6, 9, 29], true)) {
                // флуд/rate-limit: не трогаем очередь, ждём следующую минуту
                cron_log(JOB, "флуд-контроль (код $code) - пауза до следующего запуска");
                break;
            }
            // приватность/запрет сообщений и прочее - пропускаем навсегда
            db()->prepare("UPDATE vk_dm_queue SET status='skipped', error=? WHERE id=?")
                ->execute(["$code: $msg", (int) $m['id']]);
            $skip++;
        }
        usleep(1200000);
    }
    if ($sent > 0 || $skip > 0) {
        $left = (int) scalar("SELECT COUNT(*) FROM vk_dm_queue WHERE status='queued'");
        cron_log(JOB, "отправлено $sent, пропущено $skip, в очереди $left");
    }
} catch (Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}
cron_unlock(JOB);
