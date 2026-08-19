<?php
/**
 * СВЕРКА АВТОМАТИЧЕСКОЙ ОЦЕНКИ С ОЦЕНКОЙ ЖЮРИ.
 *
 * Пока не известно, насколько машина совпадает с живым жюри центра, включать
 * автомат нельзя: любые слова о «профессиональной оценке» будут словами. Здесь
 * берутся работы, которые жюри уже оценило, прогоняются через тот же движок и
 * сравниваются два столбца: что поставил человек и что ставит машина.
 *
 * Что считаем:
 *   • точное совпадение звания;
 *   • совпадение с точностью до одной ступени (для конкурса это уже рабочая
 *     погрешность: разные члены жюри расходятся не меньше);
 *   • систематический сдвиг — машина в среднем строже или мягче жюри;
 *   • расхождение по номинациям: где именно она промахивается.
 *
 * Главный результат — поправка шкалы. Если машина ровно на ступень строже,
 * достаточно сдвинуть границы званий, и совпадение вырастет без всякой правки
 * критериев. Поправка сохраняется настройкой grade_scale_shift и применяется
 * ко всем последующим оценкам.
 *
 *   php scripts/ai_grade_calibrate.php --limit=20        — прогнать 20 работ
 *   php scripts/ai_grade_calibrate.php --report          — только отчёт по уже прогнанным
 *   php scripts/ai_grade_calibrate.php --report --apply  — записать поправку шкалы
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ai_grader.php';

$limit  = 0;
$report = in_array('--report', $argv, true);
$apply  = in_array('--apply', $argv, true);
foreach ($argv as $a) if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = (int) $m[1];
$line = str_repeat('=', 78);

ag_migrate();

/** Порядковый номер звания: 0 участник, 7 Гран-при. Нужен, чтобы считать сдвиг. */
function cal_rank(string $title): int {
    $t = mb_strtoupper(trim($title));
    if (str_contains($t, 'ГРАН'))          return 7;
    if (str_contains($t, 'ЛАУРЕАТ I СТ'))  return 6;
    if (str_contains($t, 'ЛАУРЕАТ II С'))  return 5;
    if (str_contains($t, 'ЛАУРЕАТ III'))   return 4;
    if (str_contains($t, 'ДИПЛОМАНТ I С')) return 3;
    if (str_contains($t, 'ДИПЛОМАНТ II ')) return 2;
    if (str_contains($t, 'ДИПЛОМАНТ III')) return 1;
    return 0;
}

/* ── Прогон ── */
if (!$report) {
    $rows = all("SELECT a.id, a.result, a.nomination
                   FROM applications a
                  WHERE COALESCE(a.result,'') <> ''
                    AND TRIM(COALESCE(a.video_url,'')) <> ''
                    AND NOT EXISTS (SELECT 1 FROM grading_runs g
                                     WHERE g.application_id = a.id AND g.status = 'ok')
               ORDER BY a.id DESC" . ($limit > 0 ? " LIMIT $limit" : ''));

    echo "СВЕРКА С ОЦЕНКАМИ ЖЮРИ\n$line\n  работ к прогону: " . count($rows) . "\n\n";
    $n = 0;
    foreach ($rows as $r) {
        $t0  = microtime(true);
        $res = ag_grade_application((int) $r['id']);
        $n++;
        printf("  %3d. заявка %-6d жюри: %-22s машина: %-22s %s\n", $n, (int) $r['id'],
            mb_substr((string) $r['result'], 0, 22),
            $res['ok'] ? mb_substr($res['title'], 0, 22) : '—',
            $res['ok'] ? sprintf('%.1f балла, %.0f с', $res['total'], microtime(true) - $t0) : ('отказ: ' . mb_substr($res['why'], 0, 60)));
        // Пауза между работами: у сервиса есть минутные лимиты, и упереться в них
        // на середине сверки значит потерять уже потраченное время.
        sleep(max(2, (int) setting('grade_pause_sec', '5')));
    }
    echo "\n";
}

/* ── Отчёт ── */
$pairs = all("SELECT g.total, g.title AS ai_title, g.confidence, a.result AS jury_title, a.nomination
                FROM grading_runs g
                JOIN applications a ON a.id = g.application_id
               WHERE g.status='ok' AND COALESCE(a.result,'') <> ''");

echo "СОВПАДЕНИЕ С ЖЮРИ\n$line\n";
if (!$pairs) { echo "  сверять нечего: ни одной работы, оценённой и жюри, и машиной\n"; exit(0); }

$exact = $near = 0;
$diffs = [];
$byNom = [];
foreach ($pairs as $p) {
    $j = cal_rank((string) $p['jury_title']);
    $a = cal_rank((string) $p['ai_title']);
    $d = $a - $j;
    $diffs[] = $d;
    if ($d === 0) $exact++;
    if (abs($d) <= 1) $near++;
    $nom = mb_substr((string) $p['nomination'], 0, 26);
    $byNom[$nom]['n'] = ($byNom[$nom]['n'] ?? 0) + 1;
    $byNom[$nom]['d'] = ($byNom[$nom]['d'] ?? 0) + $d;
}
$cnt  = count($diffs);
$avg  = array_sum($diffs) / $cnt;
$pcE  = round($exact * 100 / $cnt);
$pcN  = round($near * 100 / $cnt);

printf("  работ сверено:            %d\n", $cnt);
printf("  звание совпало точно:     %d (%d%%)\n", $exact, $pcE);
printf("  расхождение не больше 1:  %d (%d%%)\n", $near, $pcN);
printf("  средний сдвиг:            %+.2f ступени (%s)\n\n", $avg,
    $avg < -0.15 ? 'машина строже жюри' : ($avg > 0.15 ? 'машина мягче жюри' : 'систематического сдвига нет'));

echo "  ПО НОМИНАЦИЯМ:\n";
foreach ($byNom as $nom => $v) {
    printf("    %-28s работ %2d, средний сдвиг %+.2f\n", $nom, $v['n'], $v['d'] / max(1, $v['n']));
}

/* Поправка шкалы: сдвиг в ступенях переводим в баллы (ступень это 5 баллов). */
$shift = round(-$avg * 5, 1);
printf("\n  ПОПРАВКА ШКАЛЫ: %+.1f балла ко всем оценкам\n", $shift);
echo "  (после поправки звание считается от исправленного балла, критерии не трогаем)\n";

if ($apply) {
    set_setting('grade_scale_shift', (string) $shift);
    echo "\n  поправка сохранена: grade_scale_shift = " . $shift . "\n";
} elseif (abs($shift) >= 0.5) {
    echo "\n  чтобы применить: php scripts/ai_grade_calibrate.php --report --apply\n";
}
