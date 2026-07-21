<?php
/**
 * Даты конкурсов. Запуск: раз в день.
 *
 * 1) Автозакрытие приёма: status='open' и end_date уже прошёл -> status='closed'.
 * 2) Генерация афиш poster_generate() по типам: open (приём открыт), 5days/3days/
 *    lastday (до конца приёма 5/3/1 день), results (подведены итоги). Каждая афиша
 *    пишется в таблицу posters (image_path, published_at=NULL) - НЕ дублируется при
 *    повторном запуске (проверка по competition_id+type+format перед генерацией).
 *    Публикацию уже созданных афиш (published_at IS NULL) забирает
 *    cron/publish_scheduled_posts.php.
 * 3) Уведомление внешнего мозг-агента (cfgv('agent_url')) о событиях: закрытие
 *    конкурса, готовность новой афиши.
 *
 * Запуск: php cron/check_competitions_dates.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/qr.php';
require_once BASE_PATH . '/core/poster.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'check_competitions_dates';

if (!cron_lock(JOB, 3600 * 6)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

/** Генерирует афишу типа $type/$format, если такой ещё нет в таблице posters. */
function ensure_poster(array $c, string $type, string $format = '1x1'): void {
    if (!function_exists('poster_generate')) return;
    $cid = (int) $c['id'];
    $exists = one("SELECT id FROM posters WHERE competition_id=? AND type=? AND format=?", [$cid, $type, $format]);
    if ($exists) return;

    $path = poster_generate($c, $type, $format);
    if ($path === '') {
        cron_log(JOB, "афиша FAIL: {$c['slug']} $type/$format");
        return;
    }
    $rel = str_replace(BASE_PATH . '/public', '', $path);
    insert('posters', [
        'competition_id' => $cid,
        'type'           => $type,
        'format'         => $format,
        'image_path'     => $rel,
    ]);
    cron_log(JOB, "афиша создана: {$c['slug']} $type/$format -> $rel");
    if (function_exists('agent_notify')) {
        agent_notify('poster_ready', [
            'competition_id' => $cid, 'slug' => $c['slug'], 'name' => $c['name'],
            'type' => $type, 'format' => $format, 'image_path' => $rel,
        ]);
    }
}

try {
    if (!function_exists('all') || !function_exists('one')) {
        cron_log(JOB, 'БД недоступна - выход');
        cron_unlock(JOB);
        exit(0);
    }

    /* ---------- 1) Автозакрытие приёма заявок ---------- */
    $closed = 0;
    $toClose = all("SELECT * FROM competitions WHERE status='open' AND end_date IS NOT NULL AND date(end_date) < date('now')");
    foreach ($toClose as $c) {
        $cid = (int) $c['id'];
        update('competitions', ['status' => 'closed'], 'id=:wid', ['wid' => $cid]);
        if (function_exists('audit')) audit('auto_close', 'competition', $cid, ['end_date' => $c['end_date']]);
        cron_log(JOB, "конкурс «{$c['name']}» автоматически закрыт (end_date={$c['end_date']})");
        if (function_exists('agent_notify')) {
            agent_notify('competition_closed', ['competition_id' => $cid, 'slug' => $c['slug'], 'name' => $c['name']]);
        }
        $closed++;
    }
    cron_log(JOB, "автозакрытие: закрыто конкурсов $closed");

    /* ---------- 2) Афиши по открытым конкурсам ---------- */
    $open = all("SELECT * FROM competitions WHERE status='open'");
    foreach ($open as $c) {
        // «Приём открыт» - в трёх форматах для соцсетей.
        ensure_poster($c, 'open', '1x1');
        ensure_poster($c, 'open', '16x9');
        ensure_poster($c, 'open', '9x16');

        if (!empty($c['end_date'])) {
            $days = (int) floor((strtotime((string) $c['end_date']) - strtotime(date('Y-m-d'))) / 86400);
            if ($days === 5) ensure_poster($c, '5days');
            elseif ($days === 3) ensure_poster($c, '3days');
            elseif ($days === 0) ensure_poster($c, 'lastday');
        }
    }

    /* ---------- 3) Афиши «Результаты» ---------- */
    $withResults = all("SELECT * FROM competitions WHERE results_date IS NOT NULL AND date(results_date) <= date('now')");
    foreach ($withResults as $c) {
        ensure_poster($c, 'results');
    }

    cron_log(JOB, 'проверка дат завершена: открытых конкурсов ' . count($open) . ', с итогами ' . count($withResults));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
