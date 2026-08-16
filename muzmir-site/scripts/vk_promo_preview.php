<?php
/**
 * ЧТО И КУДА УЙДЁТ СЕГОДНЯ.
 *
 * Показывает набор записей в ротации и ближайшую очередь площадок: какая
 * запись какому сообществу достанется и каким способом — публикацией или
 * предложкой. Ничего не публикует.
 *
 *   php scripts/vk_promo_preview.php        — набор и первые десять площадок
 *   php scripts/vk_promo_preview.php 30     — сколько площадок показать
 *   php scripts/vk_promo_preview.php 0 --full — с полными текстами записей
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk_promo.php';

$n    = isset($argv[1]) ? (int) $argv[1] : 10;
$full = in_array('--full', $argv, true);
$line = str_repeat('=', 78);

vkp_ensure();

echo "НАБОР ЗАПИСЕЙ\n$line\n";
$posts = vkp_posts();
if (!$posts) {
    echo "  пусто: сначала php scripts/vk_posts_import.php 11358:1 …\n";
} else {
    foreach ($posts as $p) {
        printf("  слот %d  %-34s  %5d симв.  вложение: %s\n", (int) $p['slot'],
            mb_substr((string) $p['title'], 0, 34), mb_strlen((string) $p['text']),
            (string) $p['attachment'] !== '' ? (string) $p['attachment'] : 'нет');
        if ($full) echo "\n" . (string) $p['text'] . "\n\n" . str_repeat('-', 78) . "\n";
    }
}

$cap = vkp_daily_cap();
printf("\n  суточная норма записей: %d, сегодня уже выпущено: %d\n", $cap, vkp_sent_today());

echo "\nСОСТОЯНИЕ ПЛОЩАДОК\n$line\n";
foreach ([
    ['готовы принять запись сегодня', "status='ready' AND score>=12 AND COALESCE(pending_log_id,0)=0
                                        AND COALESCE(date(last_post_at),'') <> date('now','localtime')"],
    ['ждут вердикта по предложке',    "COALESCE(pending_log_id,0) <> 0"],
    ['получили запись сегодня',       "COALESCE(date(last_post_at),'') = date('now','localtime')"],
    ['отклонили, больше не пишем',    "status='rejected'"],
    ['предложку не смотрят',          "status='silent'"],
] as [$title, $where]) {
    printf("  %-32s %d\n", $title, (int) (scalar("SELECT COUNT(*) FROM vk_targets WHERE $where") ?? 0));
}

if ($n > 0 && $posts) {
    echo "\nБЛИЖАЙШАЯ ОЧЕРЕДЬ\n$line\n";
    $targets = all("SELECT * FROM vk_targets
                     WHERE status='ready' AND (can_post=1 OR can_suggest=1) AND score>=12
                       AND COALESCE(pending_log_id,0)=0
                       AND COALESCE(date(last_post_at),'') <> date('now','localtime')
                     ORDER BY can_post DESC, score DESC, members DESC LIMIT :l", ['l' => $n]);
    foreach ($targets as $t) {
        $p = vkp_next_post($t);
        printf("  %-9s слот %d  %-38s vk.com/%s\n",
            (int) $t['can_post'] === 1 ? 'на стену' : 'предложка',
            (int) ($p['slot'] ?? 0), mb_substr((string) $t['name'], 0, 38), (string) $t['screen_name']);
    }
}
