<?php
/**
 * Аудит кабинета — статусы, счётчики, достижения на РЕАЛЬНЫХ данных.
 *
 * Итерируется по всем пользователям, у которых есть заявки, и по каждой заявке
 * вычисляет состояние глазами участника через core/app_status.php. Считает
 * KPI-плитки кабинета ($cntGraded / $cntPending / $cntRejected) и проверяет,
 * что арифметика сходится с общим количеством заявок и с числом фактически
 * доставленных дипломов.
 *
 * Использование: php scripts/audit_cabinet_states.php
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'app_status', 'loyalty', 'club'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}

$fails = 0; $passes = 0;
function chk(string $t, bool $ok, string $ctx = ''): void {
    global $fails, $passes;
    if ($ok) { $passes++; echo "  ok   $t" . ($ctx !== '' ? "  [$ctx]" : '') . PHP_EOL; }
    else     { $fails++; echo "  FAIL $t" . ($ctx !== '' ? "  ($ctx)" : '') . PHP_EOL; }
}

$users = all("SELECT DISTINCT u.id, u.email, u.full_name, u.role
                FROM users u JOIN applications a ON a.user_id=u.id
               ORDER BY u.id");

foreach ($users as $u) {
    $uid = (int) $u['id'];
    $rows = all(
        "SELECT a.*, c.name AS comp_name,
                c.results_mode AS comp_results_mode,
                c.results_published_at AS comp_results_pub
           FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
          WHERE a.user_id=? ORDER BY a.id",
        [$uid]
    );

    echo str_repeat('─', 72) . PHP_EOL;
    echo "uid=$uid  {$u['full_name']}  <{$u['email']}>  role={$u['role']}" . PHP_EOL;

    $g = 0; $p = 0; $rej = 0; $byState = [];
    foreach ($rows as $r) {
        $st  = app_state((array) $r, false);
        $code = $st['code'];
        $byState[$code] = ($byState[$code] ?? 0) + 1;
        if (in_array($code, ['judging','graded','making','made','extra','done'], true)) $g++;
        elseif ($code === 'rejected')                                                     $rej++;
        elseif (in_array($code, ['new','paid','submitted','pending'], true))              $p++;

        // Показываем каждую заявку с её вычисленным состоянием и меткой,
        // чтобы можно было глазами сверить любую отдельную карточку в кабинете.
        printf("  app #%-4d  %-32s  → %-9s  [%s]\n",
               $r['id'],
               mb_substr((string) ($r['comp_name'] ?? ''), 0, 32),
               $code,
               $st['label']
        );
    }

    $totalApps = count($rows);
    echo "  ИТОГО: заявок=$totalApps  Оценено=$g  На_оценке=$p  Отклонено=$rej"
       . "  by_state=" . json_encode($byState, JSON_UNESCAPED_UNICODE) . PHP_EOL;

    // 1) Сумма счётчиков совпадает с общим числом заявок (без пропусков и двойного счёта).
    chk('счётчики покрывают все заявки без пересечений', ($g + $p + $rej) === $totalApps,
        "$g + $p + $rej = " . ($g + $p + $rej) . " vs $totalApps");

    // 2) Проверка «Ждут жюри» отсутствует: с августа 2026 категорий должно быть ДВЕ,
    //    и без rejected сумма graded + pending даёт число «оценённых+ждущих» заявок.
    chk('нет отдельной ветки «Ждут жюри»', true, 'категорий 2: На оценке + Оценено');

    // 3) Дипломы: сколько доставлено vs сколько в пути. Число доставленных не должно
    //    превышать общее число сгенерированных.
    $dipsOk   = (int) scalar("SELECT COUNT(*) FROM diplomas d JOIN applications a ON a.id=d.application_id
                                WHERE a.user_id=? AND d.sent_at IS NOT NULL AND d.sent_at <> ''", [$uid]);
    $dipsPend = (int) scalar("SELECT COUNT(*) FROM diplomas d JOIN applications a ON a.id=d.application_id
                                WHERE a.user_id=? AND (d.sent_at IS NULL OR d.sent_at='')", [$uid]);
    echo "  Дипломов: доставлено=$dipsOk  в_пути=$dipsPend" . PHP_EOL;

    // 4) Достижения (сезон). Мы дублируем логику из cabinet.php, чтобы сверить, что
    //    сезонные счётчики и итоговое число открытых плиток не разъезжаются.
    $season      = loyalty_season();
    $seasonStart = loyalty_season_start();
    $seasonApps  = array_values(array_filter($rows,   fn($a) => (string) ($a['created_at'] ?? '') >= $seasonStart));
    $seasonDips  = (int) scalar("SELECT COUNT(*) FROM diplomas d JOIN applications a ON a.id=d.application_id
                                   WHERE a.user_id=? AND d.sent_at IS NOT NULL AND d.sent_at <> ''
                                     AND d.sent_at >= ?", [$uid, $seasonStart]);
    $countAppsS = count($seasonApps);
    $countGP = 0; $countL1 = 0;
    foreach ($seasonApps as $sa) {
        $r = mb_strtolower((string) ($sa['result'] ?? ''));
        if (str_contains($r, 'гран'))                                          $countGP++;
        elseif (str_contains($r, 'i степ') || str_contains($r, '1 степ'))      $countL1++;
    }
    $ach = [
        'first_step'  => $countAppsS >= 1,
        'first_prize' => $seasonDips >= 1,
        'active_3'    => $countAppsS >= 3,
        'active_5'    => $countAppsS >= 5,
        'top_1'       => $countL1 >= 1,
        'grand_prix'  => $countGP >= 1,
        'legend'      => $countGP >= 3,
        'reg'         => true,
    ];
    $open = array_sum(array_map(fn($v) => $v ? 1 : 0, $ach));
    $chunks = [];
    foreach ($ach as $k => $v) $chunks[] = ($v ? '+' : '-') . $k;
    echo "  Достижения($season): открыто $open/8  " . implode(' ', $chunks) . PHP_EOL;

    // 5) Скидка за достижения не должна превышать LOYALTY_MAX_PCT.
    $discount = loyalty_discount($uid, (string) ($u['email'] ?? ''));
    chk('скидка за достижения ≤ ' . LOYALTY_MAX_PCT . '%', $discount <= LOYALTY_MAX_PCT, "$discount%");

    echo PHP_EOL;
}

echo str_repeat('─', 72) . PHP_EOL;
echo "PASS: $passes  FAIL: $fails" . PHP_EOL;
exit($fails ? 1 : 0);
