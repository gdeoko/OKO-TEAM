<?php
/**
 * ОТЛАДКА БЛАНКА: выдать разметку диплома в стандартный вывод.
 *   php scripts/diploma_dbg_html.php <id конкурса> [main|extra|named|thanks]
 *
 * Нужен, чтобы выверять ритм листа в браузере на бастионе, не гоняя каждый раз
 * полную сборку четырёх образцов: разметка забирается одним потоком и
 * складывается файлом рядом с Chromium.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/diploma_html.php';

$cid = (int) ($argv[1] ?? 0);
$kind = strtolower(trim((string) ($argv[2] ?? 'main')));
$eng  = strtolower(trim((string) ($argv[3] ?? '')));      // v1/v2 — принудительный движок
$appId = (int) ($argv[4] ?? 0);                            // 0 — образцовая заявка
$c = one("SELECT * FROM competitions WHERE id=?", [$cid]);
if (!$c) { fwrite(STDERR, "Конкурс не найден\n"); exit(1); }
if (in_array($eng, ['v1', 'v2'], true)) $c['diploma_engine'] = $eng;

$app = [
    'id' => 0, 'number' => (string) $c['code'] . '-2026-00001', 'competition_id' => $cid,
    'full_name' => 'Иванова Мария Сергеевна', 'is_group' => 1,
    'group_name' => 'Образцовый ансамбль «Родник»', 'age_category' => '11-13 лет',
    'nomination' => 'Вокальное искусство', 'work_title' => '«Гляжу в озёра синие»',
    'teacher' => 'Петрова Анна Владимировна', 'institution' => 'Детская школа искусств №1',
    'city' => 'Россия, город Москва', 'result' => 'ЛАУРЕАТ I СТЕПЕНИ',
    'extra_diploma' => 'ЗА ВЕРНОСТЬ ТРАДИЦИЯМ', 'email' => 'sample@example.org',
];
/* Реальная заявка вместо образцовой: у живых участников длинные названия
 * учреждений и коллективов, и ровно на них лист расползается. */
if ($appId > 0) {
    $real = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if ($real) $app = $real + $app;
}

$opt = [];
if ($kind === 'extra')  $opt['extra'] = true;
if ($kind === 'named')  { $opt['named'] = true;  $opt['person'] = (string) $app['full_name']; }
if ($kind === 'thanks') { $opt['thanks'] = true; $opt['person'] = (string) $app['teacher']; }

echo diploma_html($c, $app, $opt);
