<?php
/**
 * Публикация отложенных афиш в соцсети. Запуск: раз в час.
 *
 * Афиши (таблица posters, её пишет cron/check_competitions_dates.php) с
 * published_at IS NULL считаются «отложенными постами» - отправляются
 * внешнему мозг-агенту (cfgv('agent_url'), событие publish_poster) вместе со
 * ссылкой на картинку; агент публикует их в соцсети КЦ. При успешной отправке
 * агенту posters.published_at проставляется - повторно афиша не отправляется.
 * Если agent_url не задан или агент недоступен - афиша остаётся в очереди
 * и будет предложена на следующем часовом запуске.
 *
 * Запуск: php cron/publish_scheduled_posts.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'publish_scheduled_posts';

if (!cron_lock(JOB, 1800)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

try {
    if (!function_exists('all')) {
        cron_log(JOB, 'БД недоступна - выход');
        cron_unlock(JOB);
        exit(0);
    }

    $agentUrl = (string) cfgv('agent_url', '');
    if ($agentUrl === '') {
        cron_log(JOB, 'agent_url не задан - публикация в соцсети недоступна, выход');
        cron_unlock(JOB);
        exit(0);
    }

    $rows = all(
        "SELECT p.*, c.name AS comp_name, c.slug AS comp_slug
           FROM posters p LEFT JOIN competitions c ON c.id = p.competition_id
          WHERE p.published_at IS NULL
       ORDER BY p.created_at ASC LIMIT 50"
    );

    $base = rtrim((string) cfgv('base_url', ''), '/');
    $sent = 0;
    $pending = 0;
    foreach ($rows as $p) {
        $imageUrl = $base . (string) $p['image_path'];
        $ok = agent_notify('publish_poster', [
            'poster_id'      => (int) $p['id'],
            'competition_id' => $p['competition_id'] ? (int) $p['competition_id'] : null,
            'competition'    => $p['comp_name'] ?? '',
            'slug'           => $p['comp_slug'] ?? '',
            'type'           => $p['type'],
            'format'         => $p['format'],
            'image_url'      => $imageUrl,
        ]);
        if ($ok) {
            update('posters', ['published_at' => date('Y-m-d H:i:s')], 'id=:wid', ['wid' => $p['id']]);
            cron_log(JOB, "афиша #{$p['id']} ({$p['type']}/{$p['format']}) отправлена агенту на публикацию");
            $sent++;
        } else {
            cron_log(JOB, "афиша #{$p['id']}: агент не принял, остаётся в очереди");
            $pending++;
        }
    }

    cron_log(JOB, "итог: опубликовано $sent, осталось в очереди $pending");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
