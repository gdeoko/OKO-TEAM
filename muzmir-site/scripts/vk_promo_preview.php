<?php
/**
 * КАК БУДЕТ ВЫГЛЯДЕТЬ АНОНС.
 *
 * Показывает готовые записи для первых площадок очереди, ничего не публикуя.
 * Смысл прогона — увидеть глазами то, что увидит администратор дома культуры, и
 * убедиться, что соседние сообщества получают непохожие тексты: одинаковая
 * запись в сотне сообществ — прямая дорога к ограничению на публикации.
 *
 *   php scripts/vk_promo_preview.php        — пять образцов
 *   php scripts/vk_promo_preview.php 12     — сколько нужно
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk_promo.php';

$n    = max(1, (int) ($argv[1] ?? 5));
$line = str_repeat('=', 78);

vkp_ensure();

$comp = one("SELECT slug, name, end_date FROM competitions WHERE status='open' AND is_paid=0 ORDER BY end_date LIMIT 1")
     ?: one("SELECT slug, name, end_date FROM competitions WHERE status='open' ORDER BY end_date LIMIT 1");
if (!$comp) { echo "нет открытых конкурсов\n"; exit(0); }

$campaign = 'vk-promo-' . date('Y-m');
$link     = rtrim((string) cfgv('base_url'), '/') . '/competitions?utm_source=vk&utm_medium=community&utm_campaign=' . $campaign;
$deadline = preg_replace('~\s+\d{4}$~u', '', ru_date((string) $comp['end_date']));

$targets = all("SELECT * FROM vk_targets WHERE status='ready' AND (can_post=1 OR can_suggest=1)
                ORDER BY can_post DESC, score DESC, members DESC LIMIT :l", ['l' => $n]);

echo "ОБРАЗЦЫ АНОНСОВ (конкурс: {$comp['name']}, до {$deadline})\n$line\n";
$texts = [];
foreach ($targets as $t) {
    $msg = vkp_message($t, $link, $deadline);
    $texts[] = $msg;
    printf("\n--- vk.com/%s | %s | %s подписчиков | %s ---\n%s\n",
        (string) $t['screen_name'], mb_substr((string) $t['name'], 0, 44),
        number_format((int) $t['members'], 0, '.', ' '),
        (int) $t['can_post'] === 1 ? 'стена' : 'предложка', $msg);
}

printf("\n$line\n  разных текстов: %d из %d\n", count(array_unique($texts)), count($texts));
