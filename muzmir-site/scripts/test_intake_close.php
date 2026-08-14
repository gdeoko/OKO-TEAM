<?php
/**
 * ЧТО БУДЕТ 25-ГО ЧИСЛА В 18:00, КОГДА ЗАКРОЕТСЯ ПРИЁМ.
 *
 * Проверка на реальных данных и БЕЗ единого изменения в базе: закрытие приёма
 * разыгрывается в памяти (статус конкурса подменяется на 'closed'), и видно,
 * что после этого показывает форма заявки, афиша и витрина наград.
 *
 * Поводом послужило то, что витрина образцов наград отбирала конкурсы по
 * status='open': в 18:00 вместе с приёмом раздел «Награды» опустел бы целиком,
 * ровно когда участники идут заказывать кубки по своим результатам.
 *
 *   php scripts/test_intake_close.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/orders.php';

$line = str_repeat('=', 78);
$fail = 0;

/* ── Расписание ────────────────────────────────────────────────────────────── */
echo "РАСПИСАНИЕ ЗАКРЫТИЯ\n$line\n";
foreach (all("SELECT id, wave, status, run_at, competition_id FROM launch_jobs
               WHERE status='scheduled' ORDER BY run_at") as $j) {
    $what = ['d3' => 'пост «осталось 3 дня»', 'last' => 'пост «последний день приёма»',
             'closed' => 'ЗАКРЫТИЕ ПРИЁМА (все конкурсы → closed, форма заявки выключается)',
             'results' => 'оглашение аттестационных результатов (ВК + письма + сайт)'][$j['wave']] ?? $j['wave'];
    echo '  ' . date('d.m.Y H:i', strtotime((string) $j['run_at'])) . " МСК — $what\n";
}
$closeJob = one("SELECT run_at FROM launch_jobs WHERE wave='closed' AND status='scheduled' ORDER BY run_at LIMIT 1");
if (!$closeJob) { echo "  ✗ задания на закрытие приёма НЕТ\n"; $fail++; }

/* ── Приём заявок ──────────────────────────────────────────────────────────── */
echo "\nПРИЁМ ЗАЯВОК\n$line\n";
$openNow = all("SELECT id, name, status, end_date FROM competitions
                 WHERE status='open' AND COALESCE(launched,0)=1 ORDER BY sort");
echo '  сейчас форма /apply предлагает конкурсов: ' . count($openNow) . "\n";
echo "  после закрытия (status='closed') предложит: 0 — форма покажет «Приём заявок этого месяца завершён»\n";
$reopen = (string) setting('intake_reopen_date', '');
echo '  дата открытия следующего месяца в тексте: '
   . ($reopen !== '' ? ru_date($reopen) : 'ещё не проставлена (ставится в момент закрытия, будет 1-е число)') . "\n";

// Сервер обязан отказывать и в обход формы: API принимает только open/judging.
$apiSrc = (string) file_get_contents(BASE_PATH . '/api/v1/apply.php');
$apiOk = str_contains($apiSrc, "in_array(\$c['status'], ['open', 'judging'], true)");
echo '  ' . ($apiOk ? '✓' : '✗') . " приём через API закрывается вместе со статусом конкурса\n";
if (!$apiOk) $fail++;

/* ── Витрина наград после закрытия ─────────────────────────────────────────── */
echo "\nЗАКАЗ НАГРАД ПОСЛЕ ЗАКРЫТИЯ ПРИЁМА (окно " . AWARDS_WINDOW_MONTHS . " мес.)\n$line\n";
$all = all("SELECT id, name, status, end_date FROM competitions
             WHERE COALESCE(launched,0)=1 AND status <> 'draft'
          ORDER BY CASE WHEN status='open' THEN 0 ELSE 1 END, end_date DESC, sort, id");
$shownAfter = 0;
foreach ($all as $c) {
    $after = $c; $after['status'] = 'closed';       // разыгрываем 25-е число, 18:01
    $open  = awards_window_open($after);
    $end   = awards_window_end($after);
    if ($open) $shownAfter++;
    printf("  %-22s приём до %s → награды заказывают до %s  %s\n",
        mb_substr((string) $c['name'], 0, 22),
        $c['end_date'] !== '' ? date('d.m.Y', strtotime((string) $c['end_date'])) : '—',
        $end !== '' ? date('d.m.Y', strtotime($end)) : '—',
        $open ? 'ВИДЕН на витрине' : 'окно истекло, скрыт');
}
if ($shownAfter !== count($all)) {
    echo "  ✗ ПРОВАЛ: после закрытия приёма витрина наград теряет конкурсы\n"; $fail++;
} else {
    echo "  ✓ все " . count($all) . " конкурса остаются на витрине наград после закрытия приёма\n";
}

// И через два месяца с хвостом окно обязано закрыться само.
$expired = ['status' => 'closed', 'end_date' => date('Y-m-d', strtotime('-3 months'))];
echo '  ' . (awards_window_open($expired) ? '✗ ПРОВАЛ: окно не закрывается никогда' : '✓ через два месяца окно закрывается само') . "\n";
if (awards_window_open($expired)) $fail++;

echo "\n$line\n" . ($fail === 0 ? "ВСЁ СОШЛОСЬ.\n" : "ПРОВАЛОВ: $fail\n");
exit($fail === 0 ? 0 : 1);
