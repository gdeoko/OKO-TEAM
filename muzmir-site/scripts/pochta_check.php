<?php
/**
 * ПРОВЕРКА СВЯЗИ С ПОЧТОЙ РОССИИ И СВОДКА ПО ОТПРАВКАМ.
 *
 * Показывает, отвечает ли API, что он о нас знает, и в каком состоянии каждая
 * посылка с наградами. Ничего не меняет, кроме таблицы состояний посылок.
 *
 *   php scripts/pochta_check.php            — связь и сводка
 *   php scripts/pochta_check.php <трек>     — история одной посылки
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/pochta.php';

$line = str_repeat('=', 78);
$one  = trim((string) ($argv[1] ?? ''));

/* ── Связь ────────────────────────────────────────────────────────────────── */
echo "СВЯЗЬ С ПОЧТОЙ РОССИИ\n$line\n";
if (!pochta_ready()) {
    echo "  доступы не заданы (POCHTA_TOKEN / POCHTA_LOGIN / POCHTA_PASSWORD)\n";
    exit(1);
}
$c = pochta_cfg();
printf("  адрес:  %s\n  логин:  %s\n  токен:  %s…\n", $c['url'], $c['login'], mb_substr($c['token'], 0, 8));

$r = pochta_api('/1.0/settings');
printf("  ответ на /1.0/settings: HTTP %d\n", $r['code']);
if ($r['code'] === 200 && is_array($r['data'])) {
    foreach (['name' => 'отправитель', 'inn' => 'ИНН', 'address' => 'адрес',
              'phone' => 'телефон', 'email' => 'почта'] as $k => $ru) {
        $v = $r['data'][$k] ?? null;
        if (is_string($v) && $v !== '') printf("    %-12s %s\n", $ru, mb_substr($v, 0, 60));
    }
} else {
    echo '    ' . mb_substr(trim((string) $r['raw']), 0, 300) . "\n";
}

/* ── История одной посылки ────────────────────────────────────────────────── */
if ($one !== '') {
    echo "\nИСТОРИЯ ПОСЫЛКИ $one\n$line\n";
    $h = pochta_history($one);
    if (!$h) { echo "  Почта не отдала историю по этому номеру\n"; exit(1); }
    foreach ($h as $s) {
        printf("  %-19s %-46s %s\n",
            substr((string) $s['at'], 0, 19),
            mb_substr((string) $s['operation'], 0, 46),
            mb_substr((string) $s['place'], 0, 28));
    }
    $st = pochta_state((string) $h[count($h) - 1]['operation']);
    echo "\n  состояние: " . pochta_state_ru($st) . "\n";
    exit(0);
}

/* ── Сводка по всем отправкам ─────────────────────────────────────────────── */
echo "\nОТПРАВКИ УЧАСТНИКАМ\n$line\n";
$orders = all("SELECT id, application_id, full_name, email, status, tracking, shipped_at, delivered_at
                 FROM awards_orders
                WHERE TRIM(COALESCE(tracking,'')) <> '' ORDER BY id DESC");
if (!$orders) {
    echo "  посылок с трек-номером пока нет\n";
    echo "  (трек-номер вносит админ при отправке: раздел «Заказы наград»)\n";
    exit(0);
}

$byState = [];
foreach ($orders as $o) {
    $track = (string) $o['tracking'];
    $st = pochta_refresh($track, (int) $o['id']);
    $code = (string) ($st['state'] ?? '');
    $byState[$code] = ($byState[$code] ?? 0) + 1;
    printf("  #%-4s %-24s %-16s %-22s %s\n",
        $o['id'], mb_substr((string) $o['full_name'], 0, 24), $track,
        pochta_state_ru($code), mb_substr((string) ($st['operation'] ?? ''), 0, 30));
}

echo "\nИТОГО\n$line\n";
foreach ($byState as $st => $n) printf("  %-30s %d\n", pochta_state_ru((string) $st), $n);
printf("  %-30s %d\n", 'всего посылок', count($orders));
