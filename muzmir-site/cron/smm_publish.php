<?php
/**
 * cron/smm_publish.php — публикует готовый пост, когда подошёл его час.
 *
 * Запускается часто (каждые десять минут), а не ровно в 10:00 и 17:00. Крон,
 * заведённый на одну минуту в сутки, пропускает публикацию целиком, если в эту
 * минуту сервер был занят или перезагружался: следующего шанса у поста нет.
 * Здесь же пост со статусом ready и наступившим часом будет подобран ближайшим
 * запуском — отсюда и «без пропусков».
 *
 * Запуск: php cron/smm_publish.php [--force] [--id=N]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/smm_make.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'smm_publish';

$opts  = getopt('', ['force', 'id::']);
$force = isset($opts['force']);
$onlyId = isset($opts['id']) ? (int) $opts['id'] : 0;

if (!cron_lock(JOB, 900)) { cron_log(JOB, 'предыдущий запуск ещё идёт — выход'); exit(0); }

try {
    /* ДВА РУБИЛЬНИКА, А НЕ ОДИН.
     *
     * smm_enabled включает производство: темы, тексты, картинки, очередь.
     * smm_autopublish решает, уходит ли готовое наружу само. Это разные решения:
     * пока владелец присматривается к тому, что пишет конвейер, очередь должна
     * наполняться, но публиковать обязан человек нажатием в админке. Публикация
     * необратима, и первый же прогон показал, зачем это нужно: модель сочинила
     * несуществующее исследование и отдала его как факт. */
    if (!$force) {
        if ((int) setting('smm_enabled', '0') !== 1) { cron_unlock(JOB); exit(0); }
        if ((int) setting('smm_autopublish', '0') !== 1) {
            cron_log(JOB, 'автопубликация выключена — готовые посты ждут человека в админке');
            cron_unlock(JOB); exit(0);
        }
    }
    smm_migrate();

    $post = $onlyId > 0
        ? one("SELECT * FROM smm_posts WHERE id = ?", [$onlyId])
        : smm_due_post();

    if (!$post) { cron_unlock(JOB); exit(0); }

    /* Окно проверяется внутри smm_publish(), но сказать о причине в журнал
       лучше здесь — иначе в воскресенье журнал молчит и выглядит как поломка. */
    if (!$force && function_exists('outreach_window_ok') && !outreach_window_ok()) {
        cron_log(JOB, 'вне окна публикаций: ' . outreach_window_reason());
        cron_unlock(JOB); exit(0);
    }

    update('smm_posts', ['attempts' => (int) $post['attempts'] + 1], 'id=:id', ['id' => (int) $post['id']]);

    [$ok, $info] = smm_publish($post, $force);

    if (!$ok) {
        $attempts = (int) $post['attempts'] + 1;
        update('smm_posts', [
            'error'  => (string) $info,
            'status' => $attempts >= 5 ? 'failed' : 'ready',
        ], 'id=:id', ['id' => (int) $post['id']]);
        cron_log(JOB, "пост #{$post['id']} не ушёл: {$info} (попытка {$attempts})");

        /* Исчерпали попытки — владелец должен узнать сам, а не обнаружить
           пустую ленту через неделю. */
        if ($attempts >= 5 && function_exists('agent_notify')) {
            agent_notify('smm_failed', [
                'post_id' => (int) $post['id'],
                'topic'   => (string) $post['topic'],
                'error'   => (string) $info,
            ]);
        }
        cron_unlock(JOB); exit(0);
    }

    /* Ссылку на запись ВКонтакте берём не сразу: Hooppy отдаёт свой id мгновенно,
       а до стены пост доезжает через несколько секунд. */
    sleep(20);
    $vk = smm_vk_last_link();

    update('smm_posts', [
        'status'         => 'published',
        'hooppy_post_id' => (int) $info,
        'vk_link'        => $vk,
        'error'          => '',
        'published_at'   => date('Y-m-d H:i:s'),
    ], 'id=:id', ['id' => (int) $post['id']]);

    cron_log(JOB, "опубликован #{$post['id']}: {$post['topic']}" . ($vk !== '' ? " — {$vk}" : ''));

    if (function_exists('agent_notify')) {
        agent_notify('smm_published', [
            'post_id' => (int) $post['id'],
            'topic'   => (string) $post['topic'],
            'vk_link' => $vk,
        ]);
    }
} catch (\Throwable $e) {
    cron_log(JOB, 'сбой: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
