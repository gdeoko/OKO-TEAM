<?php
/**
 * НАСТРОЙКА ИЗ КОМАНДНОЙ СТРОКИ.
 *
 *   php scripts/setting.php                        — показать все настройки
 *   php scripts/setting.php diplomas_send_hold     — показать одну
 *   php scripts/setting.php diplomas_send_hold 1   — записать
 *
 * Зачем отдельный скрипт. Часть выключателей (стоп-кран выдачи наград, режим
 * аттестации, отправка писем сайта через запасной ящик) живёт в таблице
 * settings, и до сих пор их правили однострочником с ручным SQL — а значит,
 * мимо журнала и с риском опечататься в имени ключа. Здесь запись видна,
 * проверяема и попадает в audit_log.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$key = (string) ($argv[1] ?? '');
$val = array_key_exists(2, $argv) ? (string) $argv[2] : null;

if ($key === '') {
    foreach (all("SELECT key, value FROM settings ORDER BY key") as $r)
        printf("%-34s %s\n", (string) $r['key'], (string) $r['value']);
    exit(0);
}

if ($val === null) {
    $cur = setting($key, null);
    echo $key . ' = ' . ($cur === null ? '(нет такой настройки)' : (string) $cur) . "\n";
    exit(0);
}

$old = setting($key, null);
set_setting($key, $val);
if (function_exists('audit')) audit('setting_set', 'settings', 0, ['key' => $key, 'old' => $old, 'new' => $val]);
printf("%s: %s → %s\n", $key, $old === null ? '(не было)' : (string) $old, $val);
