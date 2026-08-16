<?php
/**
 * ПЕРЕПИСЬ ПЛОЩАДОК: КУДА ИЗ 16 463 СООБЩЕСТВ УЧРЕЖДЕНИЙ МОЖНО ПОЛОЖИТЬ АНОНС.
 *
 * Обходит сообщества учреждений и раскладывает их по трём дверям: открытая
 * стена (публикуем сами), предложенные новости (кладём администратору на
 * рассмотрение), закрыто (остаётся только личное сообщение). Результат ложится
 * в vk_targets, откуда его берёт cron/vk_promo.php.
 *
 * Ничего не публикует. Можно гонять сколько угодно: повторный запуск обновляет
 * устаревшие записи, свежие не трогает.
 *
 *   php scripts/vk_scan_targets.php            — очередная порция (3000)
 *   php scripts/vk_scan_targets.php 20000      — за один проход всю базу
 *   php scripts/vk_scan_targets.php 0          — только показать, что уже собрано
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk_promo.php';

$limit = isset($argv[1]) ? max(0, (int) $argv[1]) : 3000;
$line  = str_repeat('=', 78);

vkp_ensure();

if ($limit > 0) {
    echo "ПЕРЕПИСЬ ПЛОЩАДОК\n$line\n";
    $t0 = microtime(true);
    [$done, $open, $sugg, $shut] = vkp_scan($limit);
    printf("  проверено %d за %d с: открытых стен %d, предложек %d, закрытых %d\n",
        $done, (int) round(microtime(true) - $t0), $open, $sugg, $shut);
}

[$fit, $unfit] = vkp_rank();
printf("  отбор по профилю: годных %d, отсеяно непрофильных %d\n", $fit, $unfit);

echo "\nЧТО СОБРАНО ВСЕГО\n$line\n";
$tot  = (int) (scalar("SELECT COUNT(*) FROM vk_targets") ?? 0);
$base = (int) (scalar("SELECT COUNT(*) FROM institutions WHERE vk_id<>0") ?? 0);
printf("  проверено сообществ: %d из %d (%.1f%%)\n", $tot, $base, $base ? $tot * 100 / $base : 0);

foreach ([
    ['открытая стена, публикуем сами', "can_post=1"],
    ['предложка, решает администратор', "can_post=0 AND can_suggest=1"],
    ['закрыто наглухо',                 "can_post=0 AND can_suggest=0"],
] as [$title, $where]) {
    $n = (int) (scalar("SELECT COUNT(*) FROM vk_targets WHERE $where") ?? 0);
    $m = (int) (scalar("SELECT COALESCE(SUM(members),0) FROM vk_targets WHERE $where") ?? 0);
    printf("  %-34s %5d, аудитория %s\n", $title, $n, number_format($m, 0, '.', ' '));
}

$ready = (int) (scalar("SELECT COUNT(*) FROM vk_targets WHERE status='ready' AND (can_post=1 OR can_suggest=1)") ?? 0);
$done_ = (int) (scalar("SELECT COUNT(*) FROM vk_targets WHERE status='done'") ?? 0);
printf("\n  в очереди на анонс: %d, уже отправлено: %d\n", $ready, $done_);

$cap = vkp_daily_cap();
if ($cap > 0 && $ready > 0) {
    printf("  при темпе %d в сутки очередь разойдётся за %d дней\n", $cap, (int) ceil($ready / $cap));
}

echo "\nСАМЫЕ КРУПНЫЕ В ОЧЕРЕДИ\n$line\n";
foreach (all("SELECT name, screen_name, members, can_post FROM vk_targets
              WHERE status='ready' AND (can_post=1 OR can_suggest=1)
              ORDER BY score DESC, members DESC LIMIT 15") as $r) {
    printf("  %7s  %-9s %-40s vk.com/%s\n", number_format((int) $r['members'], 0, '.', ' '),
        (int) $r['can_post'] === 1 ? 'стена' : 'предложка',
        mb_substr((string) $r['name'], 0, 40), (string) $r['screen_name']);
}

/* Итог по выпуску, если он уже шёл. */
$sent = (int) (scalar("SELECT COUNT(*) FROM vk_promo_log WHERE outcome<>'error'") ?? 0);
if ($sent > 0) {
    echo "\nСУДЬБА ОТПРАВЛЕННОГО\n$line\n";
    foreach (all("SELECT outcome, COUNT(*) n FROM vk_promo_log GROUP BY 1 ORDER BY n DESC") as $r) {
        $names = ['sent' => 'отправлено, судьба неизвестна', 'published' => 'опубликовано',
                  'pending' => 'висит у администратора', 'rejected' => 'снято', 'error' => 'отказ ВКонтакте'];
        printf("  %-32s %d\n", $names[(string) $r['outcome']] ?? (string) $r['outcome'], (int) $r['n']);
    }
    $pub = (int) (scalar("SELECT COUNT(*) FROM vk_promo_log WHERE outcome='published'") ?? 0);
    $chk = (int) (scalar("SELECT COUNT(*) FROM vk_promo_log WHERE outcome IN ('published','pending','rejected')") ?? 0);
    if ($chk > 0) printf("\n  реальная доля публикации: %.1f%% (проверено %d записей)\n", $pub * 100 / $chk, $chk);
}
