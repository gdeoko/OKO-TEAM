<?php
/**
 * cron/smm_image_retry.php — ДОСНЯТЬ КАРТИНКУ ЧЕРНОВИКУ И ПУСТИТЬ ЕГО В ОЧЕРЕДЬ.
 *
 * ЗАЧЕМ. Пост собирается в два захода: сначала тема, факт, текст и проверки, в
 * самом конце платная картинка. Если картинка не вышла, пост остаётся черновиком
 * и больше НИКОГДА не досматривается: smm_pending_slots() считает слот занятым,
 * потому что строка в нём уже есть, и cron/smm_prepare.php к нему не возвращается.
 *
 * ЦЕНА ЭТОГО ИЗВЕСТНА. 10.10.2026 у центра перестал работать ключ apimodels
 * (сначала 402 «кончились средства», потом 401 «Invalid or missing API key»), и
 * конвейер три дня подряд писал тексты, которые никуда не уходили: десять готовых
 * постов легли черновиками, лента встала с 09.10, и не сказал об этом никто.
 * Темы при этом расходовались: smm_topic_is_fresh() считает их занятыми, а
 * повторять тему владелец запретил навсегда.
 *
 * ЧТО ДЕЛАЕТ. Берёт черновики, у которых текст есть, а картинки нет, и снимает
 * картинку по уже сохранённому промпту. Вышла — пост становится ready и уйдёт в
 * свой слот обычным порядком. Расход ограничен тем же дневным пределом
 * (smm_image_budget_day), что и у конвейера: отдельного кошелька тут нет.
 *
 * ОТКАЗ СЛУЖБЫ НЕ МОЛЧИТ. Если картинка не вышла из-за ключа или денег (401, 402,
 * 403), работа прекращается сразу и владельцу уходит ОДНО сообщение в Телеграм с
 * причиной словами. Перебирать остальные черновики в такой момент бессмысленно:
 * ответ у всех будет один и тот же.
 *
 * Запуск: php cron/smm_image_retry.php [--limit=N] [--dry]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/smm_make.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'smm_image_retry';

$opts  = getopt('', ['limit::', 'dry']);
$limit = isset($opts['limit']) ? max(1, (int) $opts['limit']) : 4;
$dry   = isset($opts['dry']);

if (!cron_lock(JOB, 1800)) { cron_log(JOB, 'предыдущий запуск ещё идёт — выход'); exit(0); }

try {
    if ((int) setting('smm_enabled', '0') !== 1) {
        cron_log(JOB, 'конвейер выключен (smm_enabled=0) — выход');
        cron_unlock(JOB); exit(0);
    }
    smm_migrate();

    /* Сначала ближайшие слоты: если денег на все не хватит, пусть хватит на
       сегодняшний пост, а не на послезавтрашний. */
    $rows = all("SELECT * FROM smm_posts
                  WHERE status = 'draft'
                    AND COALESCE(image_path,'') = ''
                    AND COALESCE(image_prompt,'') <> ''
                    AND COALESCE(text_full,'') <> ''
                  ORDER BY slot_date ASC, slot_hour ASC
                  LIMIT " . ($limit * 3));
    if (!$rows) { cron_log(JOB, 'черновиков без картинки нет'); cron_unlock(JOB); exit(0); }

    cron_log(JOB, 'черновиков без картинки: ' . count($rows) . ', беру до ' . $limit);

    $ok = 0; $fail = 0; $stop = '';
    foreach ($rows as $p) {
        if ($ok >= $limit) break;
        $id    = (int) $p['id'];
        $ratio = (string) ($p['ratio'] ?: '4:3');
        // Имя по номеру поста (см. smm_image_path): у черновика картинки ещё
        // нет, а имя по слоту затёрло бы файл поста, который этот слот занял.
        $path  = smm_image_path($id);

        if ($dry) { cron_log(JOB, "  [сухой] #$id {$p['slot_date']} {$p['slot_hour']}:00 — {$p['topic']}"); $ok++; continue; }

        [$imgOk, $imgErr, $cost] = smm_make_image((string) $p['image_prompt'], $ratio, $path);
        update('smm_posts', [
            'image_path' => $imgOk ? $path : '',
            'image_cost' => $imgOk ? $cost : 0,
            'error'      => $imgOk ? '' : (string) $imgErr,
            'status'     => $imgOk ? 'ready' : 'draft',
        ], 'id=:id', ['id' => $id]);

        if ($imgOk) { $ok++; cron_log(JOB, "  #$id картинка снята, пост готов к слоту {$p['slot_date']} {$p['slot_hour']}:00"); continue; }

        $fail++;
        cron_log(JOB, "  #$id картинка не вышла: {$imgErr}");
        /* Ключ, деньги, запрет — одинаковый ответ у всех, продолжать нечего. */
        if (preg_match('~\b(401|402|403)\b|нет ключа|предел расхода~u', (string) $imgErr)) { $stop = (string) $imgErr; break; }
    }

    if ($stop !== '' && function_exists('tg_notify_admin')) {
        tg_notify_admin("Конвейер постов встал: картинка не собирается.\nПричина: {$stop}\n"
            . "Готовых текстов ждёт: " . (int) scalar("SELECT COUNT(*) FROM smm_posts WHERE status='draft' AND COALESCE(image_path,'')=''")
            . ". Лента молчит, пока это не починено.");
    }
    cron_log(JOB, "снято картинок: $ok, отказов: $fail" . ($stop !== '' ? ", остановлен: $stop" : ''));
} catch (\Throwable $e) {
    cron_log(JOB, 'сбой: ' . $e->getMessage());
}
cron_unlock(JOB);
