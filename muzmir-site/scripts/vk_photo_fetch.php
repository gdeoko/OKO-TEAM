<?php
/**
 * СКАЧАТЬ НАШУ ЖЕ АФИШУ ИЗ ВКОНТАКТЕ.
 *
 * Афиши постов запуска рисовались руками и на диске сайта не лежат: они есть
 * только во ВКонтакте. Чтобы делать новые афиши в том же стиле, нужен исходник
 * под рукой.
 *
 *   php scripts/vk_photo_fetch.php -211325055_457243070 /tmp/afisha.jpg
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';

$photo = (string) ($argv[1] ?? '');
$dst   = (string) ($argv[2] ?? '/tmp/vk_photo.jpg');
if ($photo === '') { echo "укажите photo вида -211325055_457243070\n"; exit(1); }

$r = vk_api('photos.getById', ['photos' => $photo, 'extended' => 0]);
if (isset($r['error'])) { echo 'ошибка: ' . (string) ($r['error']['error_msg'] ?? '?') . "\n"; exit(1); }

$p = $r['response'][0] ?? [];
$best = ''; $w = 0;
foreach (($p['sizes'] ?? []) as $s) {
    if ((int) ($s['width'] ?? 0) > $w) { $w = (int) $s['width']; $best = (string) $s['url']; }
}
if ($best === '') { echo "размеры не пришли\n"; exit(1); }

$ch = curl_init($best);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_TIMEOUT => 60]);
$bin = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!is_string($bin) || strlen($bin) < 5000) { echo "не скачалось, код $code, байт " . strlen((string) $bin) . "\n"; exit(1); }
file_put_contents($dst, $bin);
printf("сохранено %s, %d×?, %d байт\n", $dst, $w, strlen($bin));
