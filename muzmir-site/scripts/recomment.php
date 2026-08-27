<?php
/**
 * ПЕРЕПИСАТЬ КОММЕНТАРИЙ ЖЮРИ ПО СВЕЖЕМУ РАЗБОРУ.
 *
 * Звание у заявки уже стоит, а комментария нет или он не о том. Пересматривать
 * звание при этом нельзя — оно применено, и человек мог его подтвердить.
 * Поэтому здесь только текст: работа разбирается заново, из ответа берётся
 * комментарий участнику, остальное не трогается.
 *
 * Понадобилось после случая с заявкой #1800: там стоит ГРАН-ПРИ, а в поле
 * комментария лежал текст прежнего разбора — про техническую ошибку при подаче.
 * Такое письмо участнику отправить нельзя.
 *
 *   php scripts/recomment.php --ids=1800,1820,1826
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ai_grader.php';

$ids = [];
foreach ($argv as $a) {
    if (preg_match('~^--ids=([\d,]+)$~', $a, $m)) {
        foreach (explode(',', $m[1]) as $v) if ((int) $v > 0) $ids[] = (int) $v;
    }
}
if (!$ids) { fwrite(STDERR, "нужен --ids=…\n"); exit(1); }

foreach ($ids as $id) {
    $a = one("SELECT id, number, result FROM applications WHERE id=?", [$id]);
    if (!$a) { echo "#$id — нет заявки\n"; continue; }
    // Пустое поле, чтобы прежний неподходящий текст не остался, если разбор не удастся.
    q("UPDATE applications SET jury_comment='' WHERE id=?", [$id]);

    $res = ag_grade_application($id);
    $run = one("SELECT jury_comment, title FROM grading_runs
                 WHERE application_id=? AND status='ok' AND COALESCE(jury_comment,'')<>''
              ORDER BY id DESC LIMIT 1", [$id]);
    if (!$run) { echo "#$id {$a['number']} — разбор без комментария, нужен человек\n"; continue; }

    q("UPDATE applications SET jury_comment=? WHERE id=?", [(string) $run['jury_comment'], $id]);
    printf("#%d %s | звание %s | комментарий %d знаков%s\n", $id, (string) $a['number'],
        (string) $a['result'], mb_strlen((string) $run['jury_comment']),
        (string) $run['title'] !== (string) $a['result'] ? ' (свежий разбор дал «' . (string) $run['title'] . '»)' : '');
}
