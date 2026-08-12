<?php
/**
 * СБОР АДРЕСОВ ВЕДОМСТВ — ПО ОДНОМУ РЕГИОНУ ЗА ПРОГОН.
 *
 * Крон-строка (раз в 20 минут днём — точная строка в scripts/crontab.txt).
 * Обход всех регионов занимает примерно сутки; спешить некуда, а стучаться в
 * государственные сайты пачкой — верный способ получить блокировку.
 *
 * Вручную:
 *   php cron/harvest_ministries.php seed    — занести проверенный список
 *   php cron/harvest_ministries.php step    — один регион
 *   php cron/harvest_ministries.php stats   — что собрано
 *   php cron/harvest_ministries.php reset   — начать обход регионов заново
 *
 * Ничего не отправляет.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ministries.php';
require_once BASE_PATH . '/core/ministry_harvest.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'harvest_ministries';

$mode = strtolower(trim((string) ($argv[1] ?? 'step')));

function mh_log(string $s): void { cron_log('ministries', $s); echo $s . "\n"; }

if ($mode === 'stats') {
    $s = min_stats();
    echo "ВСЕГО адресов: {$s['total']}, готовы к отправке: {$s['ready']}, регионов: {$s['regions']}\n\n";
    echo "По типам:\n";
    foreach ($s['by_kind'] as $k => $n) printf("  %-28s %d\n", min_kind_ru($k), $n);
    echo "\nПо статусам:\n";
    foreach ($s['by_status'] as $k => $n) printf("  %-28s %d\n", min_status_ru($k), $n);
    exit(0);
}

if ($mode === 'seed')  { echo 'занесено новых: ' . min_seed() . "\n"; exit(0); }
if ($mode === 'reset') { set_setting('mh_region', '0'); echo "обход регионов начнём заново\n"; exit(0); }

if ($mode === 'mkrf') {
    $r = mh_import_mkrf();
    echo sprintf("реестр Минкультуры: карточек %d, новых адресов %d%s\n",
        (int) $r['seen'], (int) $r['added'], isset($r['error']) ? ' — ' . $r['error'] : '');
    exit(0);
}

if (!cron_lock(JOB, 1800)) { echo "предыдущий сбор ещё идёт\n"; exit(0); }
register_shutdown_function(static function () { cron_unlock(JOB); });

// Проверенный список заносим при первом же запуске: без него база пуста, а
// автоматический обход даёт только черновые адреса.
min_seed();

// Реестр Минкультуры тянем один раз — он и даёт все региональные министерства
// культуры с ФИО министров. Дальше обход порталов ищет только органы
// образования, которых в реестре культуры быть не может.
if ((string) setting('mh_mkrf_done', '') !== '1') {
    $r = mh_import_mkrf();
    if (!isset($r['error'])) {
        set_setting('mh_mkrf_done', '1');
        mh_log(sprintf('Реестр Минкультуры: карточек %d, новых адресов %d', (int) $r['seen'], (int) $r['added']));
    }
}

$regions = mh_regions();
$i = (int) setting('mh_region', '0');
if ($i >= count($regions)) { mh_log('Ведомства: все регионы пройдены'); exit(0); }

[$region, $portal] = $regions[$i];
set_setting('mh_region', (string) ($i + 1));

$r = mh_harvest_region($region, $portal);
mh_log(sprintf('Ведомства «%s» (%s): новых %d%s%s [%d из %d]',
    $region, $portal, (int) $r['added'],
    $r['found'] ? ' — ' . implode(', ', array_slice($r['found'], 0, 4)) : '',
    $r['note'] !== '' ? ' — ' . $r['note'] : '',
    $i + 1, count($regions)));
