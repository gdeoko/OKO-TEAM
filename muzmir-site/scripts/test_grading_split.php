<?php
/**
 * ПРОВЕРКА: ОЦЕНКА КОРОТКИХ И ОЦЕНКА ДЛИННЫХ НЕ ПЕРЕСЕКАЮТСЯ.
 *
 * Разделы разные, и заявка обязана быть ровно в одном из них — иначе непонятно,
 * где конкурс на самом деле оценивают, а оценённые длинного попадаются на глаза
 * там, где их быть не должно.
 *
 * Проверяются все четыре списка сразу: очередь и архив короткого раздела,
 * очередь и архив длинного, плюс выпадающий список конкурсов у каждого.
 *
 *   php scripts/test_grading_split.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/graded_list.php';

$line = str_repeat('=', 78);
$fail = 0;

/** Названия длинных конкурсов — по ним ловим чужаков в коротком разделе. */
$longNames = array_column(all("SELECT name FROM competitions WHERE COALESCE(results_mode,'email')='list'"), 'name');
$shortNames = array_column(all("SELECT name FROM competitions WHERE COALESCE(results_mode,'email')<>'list'"), 'name');

echo "РАЗДЕЛЕНИЕ ОЦЕНКИ · длинных конкурсов: " . count($longNames) . ", коротких: " . count($shortNames) . "\n$line\n";

/** Печатает состав списка и считает чужаков. */
$check = static function (string $title, array $rows, array $alien) use (&$fail): void {
    $by = [];
    foreach ($rows as $r) { $k = (string) ($r['comp'] ?? $r['comp_name'] ?? '—'); $by[$k] = ($by[$k] ?? 0) + 1; }
    $bad = 0;
    foreach ($by as $k => $n) if (in_array($k, $alien, true)) $bad += $n;
    printf("\n%s: всего %d %s\n", $title, count($rows), $bad ? '✗ ЧУЖИХ: ' . $bad : '✓');
    foreach ($by as $k => $n) printf("    %-28s %3d %s\n", mb_substr($k, 0, 28), $n, in_array($k, $alien, true) ? '← чужой раздел' : '');
    if ($bad) $fail++;
};

/* ── Короткий раздел ───────────────────────────────────────────────────────── */
$check('АРХИВ «Оценка коротких»', graded_rows(0, '', 'new', 'short'), $longNames);

$shortQueue = all("SELECT a.id, c.name comp FROM applications a
                     LEFT JOIN competitions c ON c.id=a.competition_id
                    WHERE a.status NOT IN ('rejected') AND COALESCE(a.result,'')='' AND a.is_paid=1
                      AND (c.results_mode IS NULL OR c.results_mode <> 'list')");
$check('ОЧЕРЕДЬ «Оценка коротких»', $shortQueue, $longNames);

/* ── Длинный раздел ────────────────────────────────────────────────────────── */
$check('АРХИВ «Оценка длинных»', graded_rows(0, '', 'new', 'long'), $shortNames);

/* ── Выпадающие списки конкурсов ───────────────────────────────────────────── */
$shortPick = array_column(all("SELECT name FROM competitions WHERE COALESCE(results_mode,'email') <> 'list' ORDER BY sort,name"), 'name');
$longPick  = array_column(all("SELECT name FROM competitions WHERE results_mode='list' ORDER BY sort,name"), 'name');

echo "\nВЫБОР КОНКУРСА В РАЗДЕЛАХ\n";
printf("  «Оценка коротких» предлагает: %s\n", implode(', ', $shortPick) ?: '—');
printf("  «Оценка длинных»  предлагает: %s\n", implode(', ', $longPick) ?: '—');
foreach ($shortPick as $n) if (in_array($n, $longNames, true)) { echo "  ✗ длинный конкурс предлагается в коротком разделе: $n\n"; $fail++; }
foreach ($longPick as $n) if (in_array($n, $shortNames, true)) { echo "  ✗ короткий конкурс предлагается в длинном разделе: $n\n"; $fail++; }

/* ── Ничья заявка не должна попасть в оба архива ───────────────────────────── */
$ids = static fn(array $rows): array => array_map(static fn($r) => (int) $r['id'], $rows);
$both = array_intersect($ids(graded_rows(0, '', 'new', 'short')), $ids(graded_rows(0, '', 'new', 'long')));
echo "\nЗАЯВКИ В ОБОИХ АРХИВАХ СРАЗУ: " . (count($both) === 0 ? "нет ✓" : count($both) . ' ✗') . "\n";
if ($both) $fail++;

echo "\n$line\n" . ($fail === 0 ? "Разделы не пересекаются.\n" : "НАРУШЕНИЙ: $fail\n");
exit($fail === 0 ? 0 : 1);
