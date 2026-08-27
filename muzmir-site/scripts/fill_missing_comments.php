<?php
/**
 * ЗВАНИЕ БЕЗ РАЗБОРА — ЭТО ПОЛОВИНА РЕЗУЛЬТАТА.
 *
 * Участник получает письмо, где есть звание и комментарий жюри: ради второго
 * педагог и везёт ребёнка на конкурс, по нему видно, что именно услышали. У
 * пяти работ последнего применения комментарий оказался пуст — свежий разбор
 * вернул звание и баллы, но текст не написал (так бывает, когда ответ модели
 * обрывается на длинном разборе).
 *
 * Брать текст неоткуда, кроме прежнего разбора той же работы: его писала та же
 * модель по той же записи, и звание в нём совпадает. Если прежнего нет —
 * заявка называется вслух, чтобы человек написал комментарий сам.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';

$dry = in_array('--dry', $argv, true);
$rows = all("SELECT id, number, result FROM applications
              WHERE COALESCE(result,'') <> '' AND COALESCE(jury_comment,'') = ''
                AND status NOT IN ('rejected','draft')");
echo 'без комментария: ' . count($rows) . "\n";

foreach ($rows as $a) {
    $id = (int) $a['id'];
    /* Разбор, закончившийся «ТРЕБУЕТ ПРОВЕРКИ», не годится: его комментарий
       написан о нарушении, а не о выступлении, и участнику он скажет не то. */
    $prev = one("SELECT jury_comment, title FROM grading_runs
                  WHERE application_id=? AND status='ok' AND COALESCE(jury_comment,'') <> ''
                    AND title <> 'ТРЕБУЕТ ПРОВЕРКИ'
               ORDER BY id DESC LIMIT 1", [$id]);
    if (!$prev) { echo "  #{$id} {$a['number']} — прежнего разбора нет, нужен человек\n"; continue; }
    $same = (string) $prev['title'] === (string) $a['result'];
    echo "  #{$id} {$a['number']} — беру разбор" . ($same ? '' : ' (звание тогда было «' . (string) $prev['title'] . '»)') . "\n";
    if (!$dry) {
        q("UPDATE applications SET jury_comment=? WHERE id=?", [(string) $prev['jury_comment'], $id]);
    }
}
