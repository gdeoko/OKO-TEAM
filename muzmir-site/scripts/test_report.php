<?php
/** Прогон генератора годового отчёта КЦ (core/report_annual.php) на текущих данных БД. */
declare(strict_types=1);
define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/report_annual.php';

db(); // инициализация/миграции, как в public/index.php

function chk(string $label, string $path): void {
    if ($path && is_file($path)) {
        printf("  [OK]   %-28s -> %s (%.1f КБ)\n", $label, $path, filesize($path) / 1024);
    } else {
        printf("  [FAIL] %-28s -> %s\n", $label, $path ?: '(пусто)');
    }
}

$year = (int) ($argv[1] ?? date('Y'));
printf("Годовой отчёт КЦ «Музыкальный Мир» за %d год\n\n", $year);

$path = annual_report($year);
chk("annual_report($year)", $path);

if ($path && is_file($path)) {
    $size = filesize($path);
    echo "\nПроверка структуры PDF:\n";
    $head = file_get_contents($path, false, null, 0, 8);
    printf("  [%s] сигнатура %%PDF- в начале файла\n", str_starts_with($head, '%PDF-') ? 'OK' : 'FAIL');
    $pageCount = substr_count(file_get_contents($path), '/Type /Page ');
    printf("  [%s] страниц в документе: %d\n", $pageCount > 0 ? 'OK' : 'FAIL', $pageCount);
    printf("  Размер файла: %.1f КБ\n", $size / 1024);
}

echo "\n=== Готово ===\n";
