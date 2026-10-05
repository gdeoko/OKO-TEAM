<?php
/**
 * cron/smm_prepare.php — набивает очередь постов на ближайшие дни.
 *
 * ПОЧЕМУ ЗАРАНЕЕ, А НЕ В МОМЕНТ ПУБЛИКАЦИИ. Картинка генерируется несколько
 * минут, модель иногда отвечает отказом по квоте, тема с первой попытки часто
 * повторяет вышедшую. Если собирать пост в 10:00 ради публикации в 10:00, то
 * первый же отказ оставляет день пустым — а владелец просил, чтобы публиковалось
 * без пропусков. Поэтому конвейер смотрит на три дня вперёд и держит очередь
 * заполненной: к моменту публикации пост уже лежит готовый, с картинкой.
 *
 * Запуск: раз в час. php cron/smm_prepare.php [--days=3] [--limit=2]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/smm_make.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'smm_prepare';

$opts  = getopt('', ['days::', 'limit::', 'dry']);
$days  = isset($opts['days'])  ? max(0, (int) $opts['days'])  : 3;
$limit = isset($opts['limit']) ? max(1, (int) $opts['limit']) : 2;
$dry   = isset($opts['dry']);

if (!cron_lock(JOB, 3600)) { cron_log(JOB, 'предыдущий запуск ещё идёт — выход'); exit(0); }

try {
    if ((int) setting('smm_enabled', '0') !== 1) {
        cron_log(JOB, 'конвейер выключен (smm_enabled=0) — выход');
        cron_unlock(JOB); exit(0);
    }

    smm_migrate();

    $slots = smm_pending_slots($days);
    if (!$slots) { cron_log(JOB, 'очередь заполнена, свободных слотов нет'); cron_unlock(JOB); exit(0); }

    $done = 0;
    foreach ($slots as $slot) {
        if ($done >= $limit) break;

        $date  = $slot['date'];
        $hour  = $slot['hour'];
        $layer = smm_pick_layer($date, $hour);
        $stage = smm_pick_stage($hour);
        $ratio = smm_pick_ratio();

        cron_log(JOB, "готовлю {$date} {$hour}:00 — слой {$layer}, ступень {$stage}, формат {$ratio}");

        $topic = smm_make_topic($layer, $stage);
        if (!$topic) { cron_log(JOB, "  тема не нашлась (все попытки повторяли вышедшее) — пропуск"); continue; }

        $body = smm_make_body($topic, $layer, $stage);
        if (!$body) { cron_log(JOB, "  текст не собрался — пропуск"); continue; }

        $full = smm_compose($body);
        $err  = smm_validate($body, $full);
        if ($err) {
            /* Одна попытка переписать: модель часто промахивается по длине, и это
               чинится повтором, а не ручной правкой. */
            cron_log(JOB, '  текст не прошёл проверку: ' . implode('; ', $err) . ' — переписываю');

            /* Три захода, и каждому говорится, чем плох предыдущий. Без этого
               модель повторяет ту же ошибку слово в слово: на требование длины
               она устойчиво отдаёт 1100–1300 знаков, пока ей прямо не скажешь,
               что вышло коротко и насколько. */
            for ($try = 0; $try < 3 && $err; $try++) {
                $retry = smm_make_body($topic, $layer, $stage, implode('; ', $err));
                if (!$retry) continue;
                $body = $retry;
                $full = smm_compose($body);
                $err  = smm_validate($body, $full);
            }
            if ($err) { cron_log(JOB, '  текст так и не прошёл: ' . implode('; ', $err) . ' — пропуск'); continue; }
        }

        /* Текст написан и прошёл правила центра — теперь проверяем, не дописала ли
           модель собственных «исследований» поверх проверенного факта. */
        $factProblems = smm_text_fact_check($body);
        if ($factProblems) {
            cron_log(JOB, '  в тексте сомнительные факты: ' . implode('; ', array_slice($factProblems, 0, 2)) . ' — переписываю');
            $hint = 'в тексте недостоверные утверждения: ' . implode('; ', $factProblems)
                  . '. Убери их совсем или замени на проверяемые. Не выдумывай замену.';
            $retry = smm_make_body($topic, $layer, $stage, $hint);
            if ($retry) {
                $full2 = smm_compose($retry);
                if (!smm_validate($retry, $full2) && !smm_text_fact_check($retry)) {
                    $body = $retry; $full = $full2;
                } else {
                    cron_log(JOB, '  переписанный текст тоже с проблемами — пропуск');
                    continue;
                }
            } else {
                cron_log(JOB, '  переписать не удалось — пропуск');
                continue;
            }
        }

        if ($dry) {
            cron_log(JOB, "  [сухой прогон] тема: {$topic['topic']}, тело " . mb_strlen($body, 'UTF-8') . ' знаков');
            $done++;
            continue;
        }

        $id = insert('smm_posts', [
            'slot_date' => $date,
            'slot_hour' => $hour,
            'status'    => 'draft',
            'topic'     => (string) $topic['topic'],
            'topic_key' => smm_key((string) $topic['topic']),
            'fact'      => (string) ($topic['fact'] ?? ''),
            'fact_key'  => smm_key((string) ($topic['fact'] ?? '')),
            'source'    => (string) ($topic['source'] ?? ''),
            'layer'     => $layer,
            'stage'     => $stage,
            'ratio'     => $ratio,
            'title'     => (string) ($topic['title'] ?? ''),
            'subtitle'  => (string) ($topic['subtitle'] ?? ''),
            'body'      => $body,
            'text_full' => $full,
        ]);

        /* Картинка — последней: она платная, и тратиться имеет смысл только на
           пост, который уже прошёл все проверки текста. */
        $prompt = smm_make_image_prompt($topic, $ratio);
        $imgOk  = false;
        if ($prompt) {
            $path = BASE_PATH . '/data/smm/' . $date . '_' . $hour . '.jpg';
            [$imgOk, $imgErr, $cost] = smm_make_image($prompt, $ratio, $path);
            update('smm_posts', [
                'image_prompt' => $prompt,
                'image_path'   => $imgOk ? $path : '',
                'image_cost'   => $imgOk ? $cost : 0,
                'error'        => $imgOk ? '' : (string) $imgErr,
            ], 'id=:id', ['id' => $id]);
            if (!$imgOk) cron_log(JOB, "  картинка не вышла: {$imgErr}");
        }

        /* Пост без картинки в очередь не ставим: текстовая простыня без
           изображения в ленте проигрывает и читается как объявление. Он остаётся
           черновиком, виден в админке, и его можно доснять руками. */
        update('smm_posts', ['status' => $imgOk ? 'ready' : 'draft'], 'id=:id', ['id' => $id]);

        cron_log(JOB, "  готово: {$topic['topic']}" . ($imgOk ? '' : ' (без картинки, остаётся черновиком)'));
        $done++;
    }

    cron_log(JOB, "подготовлено постов: {$done}");
} catch (\Throwable $e) {
    cron_log(JOB, 'сбой: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
