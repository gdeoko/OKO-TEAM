<?php
/**
 * ПАРТНЁРСКОЕ ОБРАЩЕНИЕ УЧРЕЖДЕНИЮ ВО ВКОНТАКТЕ.
 *
 * То же предложение, что уходит почтой: приглашение принять статус
 * информационного партнёра, официальный бланк с исходящим номером во вложении и
 * именная ссылка согласия одним нажатием. Отличие только в двери: письмо ждёт,
 * пока откроют официальный ящик, а сообщение сообщества читает тот, кто ведёт
 * страницу учреждения, и читает сегодня.
 *
 * Порядок в очереди: сперва те 4 048 профильных сообществ, где стена закрыта
 * наглухо — до них другого пути нет вовсе; затем остальные профильные. Кому уже
 * писали, кто уже партнёр, кто отказался или в стоп-листе, в очередь не попадают.
 *
 * ТЕМП. Сообщения ВКонтакте считает строже записей: 30 в сутки с паузой в
 * несколько минут — темп живого человека, который пишет по делу. Частотные
 * ошибки (6, 9, 29) останавливают выпуск до следующего часа, остальные помечают
 * адресата и не повторяются.
 *
 * Крон:
 *   42 10-20 * * *  php /var/www/muzmir/cron/vk_admin_dm.php >/dev/null 2>&1
 *
 * Выключатель: settings.vk_admin_dm_enabled = '0'; общий стоп-кран массовых
 * коммуникаций тоже действует.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/vk_promo.php';
require_once BASE_PATH . '/core/vk_outreach.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'vk_admin_dm';

if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) exit(0);
if ((string) scalar("SELECT value FROM settings WHERE key='vk_admin_dm_enabled'") === '0') exit(0);
if (trim((string) cfgv('vk_token', '')) === '') exit(0);
if (!cron_lock(JOB, 1800)) exit(0);

try {
    vko_ensure();

    $cap  = max(0, (int) (scalar("SELECT value FROM settings WHERE key='vk_admin_dm_daily'") ?: 30));
    $sent = (int) (scalar("SELECT COUNT(*) FROM vk_outreach_log
                            WHERE date(created_at)=date('now','localtime') AND outcome='sent'") ?? 0);
    $left = $cap - $sent;
    if ($left <= 0) { cron_unlock(JOB); exit(0); }
    $take = min($left, max(1, (int) (scalar("SELECT value FROM settings WHERE key='vk_admin_dm_per_run'") ?: 3)));

    $queue = vko_queue($take);
    if (!$queue) { cron_log(JOB, 'адресатов нет'); cron_unlock(JOB); exit(0); }

    $comps = vko_comps();
    if (!$comps) { cron_log(JOB, 'нет открытых конкурсов — обращения не шлём'); cron_unlock(JOB); exit(0); }

    $ok = $err = $docs = 0;
    foreach ($queue as $row) {
        $r = vko_send($row, (int) $row['group_id'], $comps);
        if ($r['ok']) { $ok++; if ($r['doc']) $docs++; }
        else {
            $err++;
            if ($r['fatal']) {
                cron_log(JOB, 'частотный предел ВКонтакте: ' . $r['error'] . ' — до следующего часа');
                break;
            }
        }
        sleep(random_int(150, 260));      // 2,5-4,5 минуты между обращениями
    }

    if ($ok || $err) cron_log(JOB, sprintf('обращений %d (с бланком %d), отказов %d — за сутки %d из %d',
        $ok, $docs, $err, $sent + $ok, $cap));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}

cron_unlock(JOB);
