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
$redo   = -1;    // повторный прогон: брать работы, у которых нет удачного разбора новее этого номера
$since  = 0;     // отчёт: считать только по разборам новее этого номера
foreach ($argv as $a) {
    if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = (int) $m[1];
    if (preg_match('~^--redo=(\d+)$~',  $a, $m)) $redo  = (int) $m[1];
    if (preg_match('~^--since=(\d+)$~', $a, $m)) $since = (int) $m[1];
}
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
    // Обычно берём работы, которых машина ещё не видела. Но когда движок
    // меняется (появились эталоны, поменялись критерии), нужен второй прогон по
    // тем же работам: иначе не увидеть, стало ли лучше. Для этого --redo=НОМЕР —
    // «считать необработанной работу, у которой нет разбора новее этого номера».
    $rows = all("SELECT a.id, a.result, a.nomination
                   FROM applications a
                  WHERE COALESCE(a.result,'') <> ''
                    AND TRIM(COALESCE(a.video_url,'')) <> ''
                    AND NOT EXISTS (SELECT 1 FROM grading_runs g
                                     WHERE g.application_id = a.id AND g.status = 'ok' AND g.id > ?)
               ORDER BY a.id DESC" . ($limit > 0 ? " LIMIT $limit" : ''), [max(0, $redo)]);

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
// По одной работе может быть несколько разборов (движок дорабатывался), берём
// самый свежий. --since=НОМЕР отсекает старые: так видно, что дала доработка.
$pairs = all("SELECT g.total, g.title AS ai_title, g.confidence, a.result AS jury_title, a.nomination
                FROM grading_runs g
                JOIN applications a ON a.id = g.application_id
               WHERE g.status='ok' AND COALESCE(a.result,'') <> '' AND g.id > ?
                 AND g.id = (SELECT MAX(g2.id) FROM grading_runs g2
                              WHERE g2.application_id = g.application_id AND g2.status='ok')", [$since]);

echo "СОВПАДЕНИЕ С ЖЮРИ\n$line\n";
if ($since > 0) echo "  считаем только разборы новее №$since\n";
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

/* ПОПРАВКА ШКАЛЫ: НЕ ТОЛЬКО СДВИГ, НО И РАЗМАХ.
 *
 * Одного сдвига мало. Видно другое: жюри пользуется всей шкалой, от «дипломанта
 * III» до «Гран-при», а машина жмётся к середине и почти всем ставит 82-94. При
 * таком сглаживании сдвиг вправо поднимет и слабые работы, а сдвиг влево уронит
 * сильные. Поэтому подбираем два числа сразу: во сколько растянуть размах и
 * куда сдвинуть центр, чтобы баллы машины легли на баллы жюри.
 *
 * Балл жюри берём как середину диапазона его звания: «лауреат II» это 85-89,
 * значит 87. Дальше обычный метод наименьших квадратов по двум параметрам.
 */
$mid = static function (string $title): float {
    $floor = gr_score_floor($title);
    if ($floor <= 0) return 60.0;                 // участник конкурса
    return $floor >= 95 ? 97.5 : $floor + 2.5;
};
$xs = []; $ys = [];
foreach ($pairs as $p) { $xs[] = (float) $p['total']; $ys[] = $mid((string) $p['jury_title']); }
$n2 = count($xs);
$mx = array_sum($xs) / $n2;
$my = array_sum($ys) / $n2;
$sxy = 0.0; $sxx = 0.0;
for ($i = 0; $i < $n2; $i++) { $sxy += ($xs[$i] - $mx) * ($ys[$i] - $my); $sxx += ($xs[$i] - $mx) ** 2; }
// Размах машины бывает вырожденным (все баллы почти одинаковы) — тогда растяжка
// не определена, и честнее оставить единицу, чем делить на почти ноль.
$gain  = $sxx > 1.0 ? round($sxy / $sxx, 3) : 1.0;
$gain  = max(0.5, min(3.0, $gain));               // разумные пределы
$shift = round($my - $gain * $mx, 1);

// Что получится после поправки: считаем совпадение заново на тех же данных.
$exact2 = $near2 = 0;
for ($i = 0; $i < $n2; $i++) {
    $corr = max(0.0, min(100.0, $gain * $xs[$i] + $shift));
    $d = cal_rank(gr_title_by_score($corr)) - cal_rank((string) $pairs[$i]['jury_title']);
    if ($d === 0) $exact2++;
    if (abs($d) <= 1) $near2++;
}

printf("\n  ПОПРАВКА ШКАЛЫ: размах ×%.2f, сдвиг %+.1f балла\n", $gain, $shift);
printf("  после поправки на этих же работах: точно %d%%, в пределах ступени %d%%\n",
    (int) round($exact2 * 100 / $n2), (int) round($near2 * 100 / $n2));
echo "  (поправка меняет только перевод балла в звание, критерии и веса остаются прежними)\n";

/* ПОПРАВКА ОТДЕЛЬНО ПО НОМИНАЦИЯМ.
 *
 * Общая поправка усредняет то, что усреднять нельзя: сверка сразу показала, что
 * в художественном слове машина мягче жюри, а в вокале строже. Одно число на все
 * номинации исправит одну и испортит другую. Поэтому там, где работ набралось
 * достаточно, поправка считается своя, а общая остаётся запасной.
 */
$minPerNom = 8;
$perNom = [];
foreach ($pairs as $p) {
    $nom = trim((string) $p['nomination']);
    if ($nom === '') continue;
    $perNom[$nom]['x'][] = (float) $p['total'];
    $perNom[$nom]['y'][] = $mid((string) $p['jury_title']);
}
$nomFix = [];
foreach ($perNom as $nom => $v) {
    $k = count($v['x']);
    if ($k < $minPerNom) continue;
    $mx2 = array_sum($v['x']) / $k;
    $my2 = array_sum($v['y']) / $k;
    $sxy2 = 0.0; $sxx2 = 0.0;
    for ($i = 0; $i < $k; $i++) { $sxy2 += ($v['x'][$i] - $mx2) * ($v['y'][$i] - $my2); $sxx2 += ($v['x'][$i] - $mx2) ** 2; }
    $g2 = $sxx2 > 1.0 ? max(0.5, min(3.0, round($sxy2 / $sxx2, 3))) : 1.0;
    $nomFix[$nom] = ['gain' => $g2, 'shift' => round($my2 - $g2 * $mx2, 1), 'n' => $k];
}
if ($nomFix) {
    echo "\n  ПОПРАВКА ПО НОМИНАЦИЯМ (где работ хотя бы " . $minPerNom . "):\n";
    foreach ($nomFix as $nom => $f) {
        printf("    %-30s размах ×%.2f, сдвиг %+.1f (работ %d)\n", mb_substr($nom, 0, 30), $f['gain'], $f['shift'], $f['n']);
    }
} else {
    echo "\n  По номинациям поправку не считаем: нигде ещё не набралось " . $minPerNom . " работ.\n";
}

/* КВАНТИЛЬНАЯ КАЛИБРОВКА: ГЛАВНЫЙ СПОСОБ.
 *
 * Линейная поправка работает, когда балл машины и оценка жюри связаны прямой
 * линией. Здесь связь умеренная, и растягивание шкалы почти ничего не даёт: на
 * 27 работах точность выросла с 11 до 15 процентов. Но у нас есть кое-что
 * надёжнее — РАСПРЕДЕЛЕНИЕ. Мы знаем, какую долю работ жюри признаёт лауреатами
 * первой степени, какую второй и так далее. Значит можно отсортировать работы по
 * баллу машины и раздать звания в тех же долях: столько же лауреатов, сколько у
 * жюри, и в том же порядке силы.
 *
 * Это не подгонка результата. Порядок работ остаётся тем, который выстроила
 * машина по критериям; меняются только границы, где проходит черта между
 * званиями. Так работает нормирование в любом конкурсе с ограниченным числом
 * призовых мест.
 */
$dist = [];
foreach ($pairs as $p) { $t = (string) $p['jury_title']; $dist[$t] = ($dist[$t] ?? 0) + 1; }
$order = ['ГРАН-ПРИ', 'ЛАУРЕАТ I СТЕПЕНИ', 'ЛАУРЕАТ II СТЕПЕНИ', 'ЛАУРЕАТ III СТЕПЕНИ',
          'ДИПЛОМАНТ I СТЕПЕНИ', 'ДИПЛОМАНТ II СТЕПЕНИ', 'ДИПЛОМАНТ III СТЕПЕНИ', 'УЧАСТНИК КОНКУРСА'];
$sorted = $xs;
rsort($sorted);                       // баллы машины по убыванию
$thresholds = [];
$pos = 0;
foreach ($order as $title) {
    $k = (int) ($dist[$title] ?? 0);
    if ($k <= 0) continue;
    $pos += $k;
    // Порог — балл последней работы, попавшей в это звание. Ниже него начинается
    // следующее. Берём среднее с соседом, чтобы черта не проходила ровно по баллу.
    $idx  = min($pos, count($sorted)) - 1;
    $low  = (float) $sorted[$idx];
    $next = isset($sorted[$idx + 1]) ? (float) $sorted[$idx + 1] : $low - 1;
    $thresholds[$title] = round(($low + $next) / 2, 1);
}

$exact3 = $near3 = 0;
$byThreshold = static function (float $score) use ($thresholds, $order): string {
    foreach ($order as $t) {
        if (!isset($thresholds[$t])) continue;
        if ($score >= $thresholds[$t]) return $t;
    }
    return 'УЧАСТНИК КОНКУРСА';
};
for ($i = 0; $i < $n2; $i++) {
    $d = cal_rank($byThreshold($xs[$i])) - cal_rank((string) $pairs[$i]['jury_title']);
    if ($d === 0) $exact3++;
    if (abs($d) <= 1) $near3++;
}
echo "\n  КВАНТИЛЬНАЯ КАЛИБРОВКА (звания раздаются в тех же долях, что у жюри):\n";
foreach ($thresholds as $t => $v) printf("    от %5.1f балла — %s\n", $v, $t);
printf("  на этих же работах: точно %d%%, в пределах ступени %d%%\n",
    (int) round($exact3 * 100 / $n2), (int) round($near3 * 100 / $n2));

if ($apply) {
    // Берём тот способ, который на сверке дал лучший результат, и записываем это
    // прямо: владелец должен видеть, почему выбран именно он.
    $useQuantile = $exact3 >= $exact2;
    set_setting('grade_scale_mode', $useQuantile ? 'quantile' : 'linear');
    set_setting('grade_score_thresholds', json_encode($thresholds, JSON_UNESCAPED_UNICODE));
    echo "\n  выбран способ: " . ($useQuantile ? 'квантильный' : 'линейный')
       . ' (точность ' . (int) round(max($exact2, $exact3) * 100 / $n2) . "%)\n";
    set_setting('grade_scale_gain',  (string) $gain);
    set_setting('grade_scale_shift', (string) $shift);
    set_setting('grade_scale_by_nomination', json_encode($nomFix, JSON_UNESCAPED_UNICODE));
    echo "\n  поправка сохранена: размах " . $gain . ", сдвиг " . $shift
       . ($nomFix ? ', плюс своя поправка для ' . count($nomFix) . ' номинаций' : '') . "\n";
} else {
    echo "\n  чтобы применить: php scripts/ai_grade_calibrate.php --report --apply\n";
}
echo "\n  ВАЖНО: сверено " . $n2 . " работ. Пока их меньше сорока, поправка приблизительная:\n";
echo "  одна необычная работа заметно двигает результат. Для рабочей настройки нужно 60-100 работ.\n";
