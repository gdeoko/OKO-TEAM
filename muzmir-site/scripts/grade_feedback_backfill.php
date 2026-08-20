<?php
/**
 * ПРОШЛЫЕ РЕШЕНИЯ ЖЮРИ — В ОБУЧЕНИЕ.
 *
 * Обучение на правках начинает работать с того дня, когда его включили, и первое
 * время поправка молчит: наблюдений мало. Между тем у центра уже есть готовая
 * пара «предложение машины — решение человека» по каждой работе, которую жюри
 * оценило после разбора. Это тот же материал, только собранный раньше.
 *
 * Скрипт переносит эти пары в журнал обучения. Ничего не пересчитывает и не
 * трогает заявки: только записывает, что предлагала машина и что поставил
 * человек. Совпадения тоже переносятся — без них статистика состояла бы из одних
 * ошибок.
 *
 *   php scripts/grade_feedback_backfill.php          — показать, что найдено
 *   php scripts/grade_feedback_backfill.php --apply  — записать
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/grade_feedback.php';

$apply = in_array('--apply', $argv, true);
gfb_migrate();

$line = str_repeat('=', 78);
echo "ПЕРЕНОС РЕШЕНИЙ ЖЮРИ В ОБУЧЕНИЕ\n$line\n";

/* Берём последний удачный разбор по каждой заявке, у которой есть решение
   человека. Решения самой машины не берём: у применённых ею разборов звание
   совпадает по определению, и статистика вышла бы поддельной. */
$rows = all("SELECT a.id, a.nomination, a.result,
                    g.id AS run_id, g.title, g.total, g.applied
               FROM applications a
               JOIN grading_runs g ON g.application_id = a.id AND g.status='ok'
              WHERE COALESCE(a.result,'') <> ''
                AND COALESCE(g.applied,0) = 0
                AND g.id = (SELECT MAX(g2.id) FROM grading_runs g2
                             WHERE g2.application_id = a.id AND g2.status='ok')
           ORDER BY a.id");

$levels = gfb_levels();
$same = 0; $down = 0; $up = 0; $skip = 0; $wrote = 0;
foreach ($rows as $r) {
    $ai = array_search((string) $r['title'], $levels, true);
    $hu = array_search((string) $r['result'], $levels, true);
    if ($ai === false || $hu === false) { $skip++; continue; }
    $steps = $hu - $ai;
    if ($steps === 0) $same++; elseif ($steps > 0) $down++; else $up++;

    if ($apply) {
        q("DELETE FROM grade_feedback WHERE application_id=?", [(int) $r['id']]);
        insert('grade_feedback', [
            'application_id' => (int) $r['id'],
            'run_id'      => (int) $r['run_id'],
            'nomination'  => trim((string) $r['nomination']),
            'ai_title'    => (string) $r['title'],
            'ai_total'    => (float) $r['total'],
            'human_title' => (string) $r['result'],
            'steps'       => $steps,
        ]);
        $wrote++;
    }
}

printf("  пар «подсказка — решение жюри»: %d\n", count($rows));
printf("    совпало:            %d\n", $same);
printf("    жюри строже:        %d\n", $down);
printf("    жюри мягче:         %d\n", $up);
printf("    не разобрано:       %d\n", $skip);

if ($apply) {
    printf("\n  записано в обучение: %d\n", $wrote);
    $b = gfb_bias();
    printf("  поправка сейчас: %+d ступени (%s, наблюдений %d)\n", (int) $b['steps'], (string) $b['scope'], (int) $b['n']);
    echo "\n  по номинациям:\n";
    foreach (all("SELECT nomination, COUNT(*) n FROM grade_feedback
                  WHERE COALESCE(nomination,'')<>'' GROUP BY nomination ORDER BY n DESC LIMIT 12") as $x) {
        $bb = gfb_bias((string) $x['nomination']);
        printf("    %-34s %3d правок → поправка %+d (%s)\n",
               mb_substr((string) $x['nomination'], 0, 34), (int) $x['n'], (int) $bb['steps'], (string) $bb['scope']);
    }
} else {
    echo "\n  это предпросмотр: php scripts/grade_feedback_backfill.php --apply\n";
}
echo "\n$line\n";
