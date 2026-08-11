<?php
/**
 * СБОР БАЗЫ УЧРЕЖДЕНИЙ — ФОНОВЫЙ, ПОРЦИЯМИ.
 *
 * Запускается кроном и каждый раз берёт небольшую порцию работы: пара запросов к
 * ВКонтакте, десяток сайтов, один регион OSM. Так база растёт неделями, не создавая
 * нагрузки на чужие серверы и не привлекая внимания антифрода.
 *
 * Крон-строка (каждые 10 минут, только днём — ночью чужие сайты трогать незачем):
 *   каждые-10-минут 8-22 * * * php /var/www/muzmir/cron/harvest_institutions.php
 *   (точная строка — в scripts/crontab.txt)
 *
 * Вручную:
 *   php cron/harvest_institutions.php vk        — один шаг по ВКонтакте
 *   php cron/harvest_institutions.php sites     — добрать почту с сайтов
 *   php cron/harvest_institutions.php osm       — один регион OpenStreetMap
 *   php cron/harvest_institutions.php stats     — что уже собрано
 *   php cron/harvest_institutions.php reset-vk  — начать обход ВК заново
 *
 * Ничего не отправляет. Только собирает.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/institutions.php';
require_once BASE_PATH . '/core/inst_harvest.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'harvest_institutions';

$mode = strtolower(trim((string) ($argv[1] ?? 'auto')));

/** Курсор обхода: где остановились в прошлый раз. */
function hv_cursor(string $key, int $default = 0): int {
    return (int) setting('harvest_' . $key, (string) $default);
}
function hv_cursor_set(string $key, int $v): void { set_setting('harvest_' . $key, (string) $v); }

/* ── Сводка ─────────────────────────────────────────────────────────────── */
if ($mode === 'stats') {
    $s = inst_stats();
    echo "ВСЕГО учреждений: {$s['total']}\n";
    echo "  с e-mail:   {$s['with_email']}\n";
    echo "  с ВК:       {$s['with_vk']}\n";
    echo "  готовы к приглашению: {$s['ready']}\n\n";
    echo "По типам:\n";
    foreach ($s['by_kind'] as $k => $n) printf("  %-30s %d\n", inst_kind_ru($k), $n);
    echo "\nПо статусам:\n";
    foreach ($s['by_status'] as $k => $n) printf("  %-30s %d\n", inst_status_ru($k), $n);
    if ($s['by_region']) {
        echo "\nТоп регионов:\n";
        foreach ($s['by_region'] as $k => $n) printf("  %-40s %d\n", $k, $n);
    }
    exit(0);
}

if ($mode === 'reset-vk') { hv_cursor_set('vk_q', 0); hv_cursor_set('vk_city', 0); echo "обход ВК начнём заново\n"; exit(0); }

/* Сбор идёт долго, а крон частый — без лока порции наложатся друг на друга.
   Лок берём ПОСЛЕ команд «stats» и «reset-vk»: они только читают настройки, и
   раньше их нельзя было выполнить, пока идёт сбор — то есть посмотреть, как
   продвигается работа, было невозможно именно тогда, когда это нужнее всего. */
if (!cron_lock(JOB, 900)) { echo "предыдущий сбор ещё идёт\n"; exit(0); }
register_shutdown_function(static function () { cron_unlock(JOB); });

/* ── ВКонтакте ──────────────────────────────────────────────────────────── */
function hv_step_vk(int $combos = 8): void {
    $qs     = ih_vk_queries();
    $cities = ih_vk_cities();
    $total  = 0; $added = 0; $done = 0;

    // За прогон берём несколько клеток сетки: один запрос к ВК занимает доли
    // секунды, и делать ради него отдельный запуск крона расточительно.
    for ($n = 0; $n < max(1, $combos); $n++) {
        $qi = hv_cursor('vk_q');
        $ci = hv_cursor('vk_city');

        if ($qi >= count($qs)) { $qi = 0; $ci++; hv_cursor_set('vk_q', 0); hv_cursor_set('vk_city', $ci); }
        if ($ci > count($cities)) {
            ih_log('ВКонтакте: сетка «формулировка × город» пройдена целиком. Новый круг — reset-vk');
            break;
        }

        $query = $qs[$qi];
        $city  = $ci === 0 ? '' : ($cities[$ci - 1] ?? '');

        $r = ih_harvest_vk($query, $city, 1000);
        $total += (int) $r['found'];
        $added += (int) $r['added'];
        $done++;

        hv_cursor_set('vk_q', $qi + 1);
        hv_cursor_set('vk_city', $ci);

        // Лимит ВК — около трёх обращений в секунду. Держимся вдвое ниже.
        usleep(700000);
    }

    $qi = hv_cursor('vk_q'); $ci = hv_cursor('vk_city');
    $grid = count($qs) * (count($cities) + 1);
    $pos  = $ci * count($qs) + $qi;
    ih_log(sprintf('ВК: клеток за прогон %d, найдено %d, добавлено %d. Пройдено %d из %d (%d%%)',
        $done, $total, $added, $pos, $grid, (int) round(100 * $pos / max(1, $grid))));
}

/* ── Сайты ──────────────────────────────────────────────────────────────── */
function hv_step_sites(int $limit = 40): void {
    $r = ih_fill_emails_from_sites($limit);
    ih_log(sprintf('Сайты: проверено %d, добыто адресов %d, отказов сервера %d',
        (int) $r['checked'], (int) $r['filled'], (int) ($r['refused'] ?? 0)));

    // Много отказов подряд — почти наверняка нас перестали пускать. Продолжать
    // в таком состоянии бессмысленно и невежливо: делаем перерыв до завтра.
    if ((int) $r['checked'] > 10 && (int) ($r['refused'] ?? 0) > (int) $r['checked'] * 0.7) {
        set_setting('harvest_sites_pause_until', date('Y-m-d H:i:s', time() + 6 * 3600));
        ih_log('Сайты: слишком много отказов — пауза на 6 часов, чтобы не давить на чужие серверы');
    }
}

/* ── OpenStreetMap ──────────────────────────────────────────────────────── */
function hv_step_osm(): void {
    $regs = ih_osm_regions();
    $i = hv_cursor('osm_region');
    if ($i >= count($regs)) { ih_log('OSM: все регионы пройдены'); return; }
    $area = $regs[$i];
    $r = ih_harvest_osm($area);
    ih_log(sprintf('OSM «%s»: объектов %d, добавлено %d%s',
        $area, (int) ($r['found'] ?? 0), (int) ($r['added'] ?? 0),
        isset($r['error']) ? ' — ' . $r['error'] : ''));
    hv_cursor_set('osm_region', $i + 1);
}

/* ── Что делаем в этот прогон ───────────────────────────────────────────── */
switch ($mode) {
    case 'vk':    hv_step_vk((int) ($argv[2] ?? 8)); break;
    case 'sites':
        $pause = trim((string) setting('harvest_sites_pause_until', ''));
        if ($pause !== '' && $pause > date('Y-m-d H:i:s')) { ih_log("Сайты: пауза до $pause"); break; }
        hv_step_sites((int) ($argv[2] ?? 40));
        break;
    case 'osm':   hv_step_osm();   break;

    case 'auto':
    default:
        // Чередуем источники, чтобы ни один не получал запросов чаще, чем нужно.
        // Порядок: ВК (быстро и много) → сайты (медленно) → OSM (раз в несколько шагов).
        $tick = hv_cursor('tick');
        hv_cursor_set('tick', $tick + 1);

        if ($tick % 6 === 5)      hv_step_osm();
        elseif ($tick % 2 === 0)  hv_step_vk(8);
        else {
            $pause = trim((string) setting('harvest_sites_pause_until', ''));
            if ($pause === '' || $pause <= date('Y-m-d H:i:s')) hv_step_sites(40);
            else ih_log("Сайты: пауза до $pause");
        }
        break;
}

$s = inst_stats();
ih_log("итого в базе: {$s['total']}, из них с почтой: {$s['with_email']}, готовы к приглашению: {$s['ready']}");
