<?php
/**
 * Публикация итогов БЕСПЛАТНЫХ конкурсов на стену сообщества ВК + рассылка
 * писем с результатами участникам. Запуск: 28 числа каждого месяца в 10:00 мск.
 *
 * Крон-строка (сервер в UTC, 10:00 мск = 07:00 UTC):
 *   0 7 28 * * php /path/to/muzmir-site/cron/publish_results_vk.php
 * Дата дополнительно проверяется внутри скрипта (if (date('j') !== '28') exit) -
 * защита от запуска не по расписанию (ручной прогон, кривой crontab).
 *
 * Логика:
 *  - берём бесплатные конкурсы (is_paid=0, status 'open' или 'finished'),
 *    у которых есть заявки и ВСЕ они в статусе 'graded' (жюри закончило);
 *  - пропускаем те, чьи итоги уже публиковались (таблица-метка vk_results_log:
 *    competition_id, posted_at - создаётся мягко, CREATE TABLE IF NOT EXISTS);
 *  - постим итоги на стену сообщества КЦ через core/vk.php -> vk_wall_post()
 *    (VK API wall.post, owner_id=-cfgv('vk_group_id'), from_group=1, токен -
 *    cfgv('vk_token'), маппинг MUZMIR_VK_TOKEN в config.php);
 *  - после успешного поста ставим в очередь письма результата каждой
 *    graded-заявке конкурса (core/result_mail.php -> result_mail_send(), внутри
 *    также in-app уведомление) и фиксируем конкурс в vk_results_log.
 *
 * Запуск вручную: php cron/publish_results_vk.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';
require_once BASE_PATH . '/core/vk_templates.php';
require_once BASE_PATH . '/core/result_mail.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'publish_results_vk';

// Страховка расписания: работаем только 28 числа (по локальной зоне сайта, мск).
if (date('j') !== '28') {
    cron_log(JOB, 'сегодня не 28 число - выход');
    exit(0);
}

if (!cron_lock(JOB, 3600)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

try {
    if (!function_exists('all')) {
        cron_log(JOB, 'БД недоступна - выход');
        cron_unlock(JOB);
        exit(0);
    }

    if (trim((string) cfgv('vk_token', '')) === '') {
        cron_log(JOB, 'vk_token (MUZMIR_VK_TOKEN) не настроен - выход');
        cron_unlock(JOB);
        exit(0);
    }

    // Таблица-метка публикаций итогов: мягкое создание, повторный запуск безопасен.
    q("CREATE TABLE IF NOT EXISTS vk_results_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competition_id INTEGER NOT NULL UNIQUE,
        posted_at TEXT DEFAULT (datetime('now'))
    )");

    // Бесплатные конкурсы без опубликованных итогов, у которых есть заявки
    // и все заявки уже оценены жюри (status='graded').
    $comps = all(
        "SELECT c.*
           FROM competitions c
          WHERE c.is_paid = 0
            AND c.status IN ('open','finished')
            AND NOT EXISTS (SELECT 1 FROM vk_results_log l WHERE l.competition_id = c.id)
            AND EXISTS (SELECT 1 FROM applications a WHERE a.competition_id = c.id)
            AND NOT EXISTS (SELECT 1 FROM applications a
                             WHERE a.competition_id = c.id AND a.status != 'graded')
       ORDER BY c.id ASC"
    );

    if (!$comps) {
        cron_log(JOB, 'готовых к публикации бесплатных конкурсов нет - выход');
        cron_unlock(JOB);
        exit(0);
    }

    $posted = 0;
    $skipped = 0;
    foreach ($comps as $c) {
        $cid  = (int) $c['id'];
        $name = trim((string) $c['name']);
        $link = url('/results/' . (string) $c['slug']);

        // Полный шаблон Даниэля «результаты длинного конкурса» (core/vk_templates.php).
        $message = vkt_results_long($c);

        $af = BASE_PATH . '/public/uploads/comp/' . $cid . '/afisha.jpg';
        $r = (is_file($af) && function_exists('vk_wall_post_with_photo'))
            ? vk_wall_post_with_photo($message, $af)
            : vk_wall_post($message);
        if (isset($r['error'])) {
            cron_log(JOB, "конкурс #$cid «{$name}»: wall.post ОШИБКА: "
                . (string) ($r['error']['error_msg'] ?? '?') . ' - пропуск, попробуем в следующий раз');
            $skipped++;
            continue;
        }
        $postId = (int) ($r['response']['post_id'] ?? 0);
        cron_log(JOB, "конкурс #$cid «{$name}»: пост опубликован (post_id=$postId)");
        if (function_exists('vk_broadcast')) {
            $bc = vk_broadcast($message, vk_dm_wall_attachment($r));
            cron_log(JOB, "конкурс #$cid: рассылка подписчикам — " . ($bc['ok'] ? 'OK id=' . $bc['id'] : 'нет: ' . $bc['error']));
        }
        unset($bc);

        // Рассылка писем с результатами всем оценённым заявкам конкурса.
        $apps = all(
            "SELECT id FROM applications WHERE competition_id=? AND status='graded' ORDER BY id ASC",
            [$cid]
        );
        $mailed = 0;
        foreach ($apps as $a) {
            try {
                if (result_mail_send((int) $a['id'])) $mailed++;
            } catch (\Throwable $e) {
                cron_log(JOB, "конкурс #$cid, заявка #{$a['id']}: письмо не поставлено: " . $e->getMessage());
            }
        }
        cron_log(JOB, "конкурс #$cid: писем результата в очереди - $mailed из " . count($apps));

        // Метка «итоги опубликованы» - повторно этот конкурс не публикуется.
        insert('vk_results_log', [
            'competition_id' => $cid,
            'posted_at'      => date('Y-m-d H:i:s'),
        ]);
        $posted++;
    }

    cron_log(JOB, "итог: опубликовано конкурсов $posted, отложено из-за ошибок VK $skipped");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
