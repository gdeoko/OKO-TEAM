<?php
/**
 * Вовлекающие IN-APP уведомления (НЕ email — не массовая рассылка).
 * Показываются участнику в приложении (колокольчик + тост сверху как от чата),
 * только тем, кто реально пользуется приложением (есть сессия за последнее время).
 *
 *   1) «Начал — не закончил»: зарегистрировался >2 дней назад, но НИ ОДНОЙ заявки →
 *      один мягкий нудж «подайте заявку» (однократно, icon='nudge').
 *   2) «Иногда напоминания/реклама»: активному участнику — не чаще раза в 7 дней —
 *      уведомление о ближайшем открытом конкурсе (icon='promo'), с ограничением на проход.
 *
 * Запуск: php cron/engagement.php   (crontab: 0 12 * * *)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
if (is_file(BASE_PATH . '/core/notifications.php')) require_once BASE_PATH . '/core/notifications.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'engagement';
if (!cron_lock(JOB, 600)) { exit(0); }
if (!function_exists('notify_user') || !function_exists('tbl_exists') || !tbl_exists('notifications')) {
    cron_log(JOB, 'notifications недоступны — выход'); cron_unlock(JOB); exit(0);
}

$PROMO_CAP = 300; // не больше N промо-уведомлений за проход

try {
    /* 1) Нудж «подайте заявку» — активные пользователи без заявок. */
    $nudged = 0;
    $rows = all(
        "SELECT DISTINCT u.id, u.full_name
           FROM users u
           JOIN sessions s ON s.user_id = u.id
          WHERE u.created_at <= datetime('now','-2 days')
            AND s.created_at >= datetime('now','-30 days')
            AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id)
            AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.icon='nudge')
          LIMIT 300"
    );
    foreach ($rows as $u) {
        notify_user((int) $u['id'], 'Участвуйте в конкурсе',
            'Вы ещё не подали ни одной заявки. Выберите конкурс и подайте заявку — это займёт пару минут.',
            '/calendar', 'nudge');
        $nudged++;
    }

    /* 2) Промо о ближайшем открытом конкурсе — активным, не чаще раза в 7 дней. */
    $promoed = 0;
    $comp = one("SELECT name, slug FROM competitions WHERE status='open' ORDER BY (end_date IS NULL), end_date ASC LIMIT 1");
    if ($comp) {
        $rows = all(
            "SELECT DISTINCT u.id
               FROM users u
               JOIN sessions s ON s.user_id = u.id
              WHERE s.created_at >= datetime('now','-14 days')
                AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.icon='promo'
                                AND n.created_at >= datetime('now','-7 days'))
              LIMIT " . (int) $PROMO_CAP
        );
        foreach ($rows as $u) {
            notify_user((int) $u['id'], 'Открыт приём заявок',
                'Идёт конкурс «' . (string) $comp['name'] . '». Успейте подать заявку — жюри, дипломы и награды.',
                '/competition/' . (string) $comp['slug'], 'promo');
            $promoed++;
        }
    }

    cron_log(JOB, "нудж:$nudged промо:$promoed");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
