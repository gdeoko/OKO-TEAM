<?php
/**
 * Трекинг рассылок:
 *   GET ?e=o&t=<token>            — пиксель открытия (отдаёт 1x1 GIF).
 *   GET ?e=c&t=<token>&u=<b64url> — клик, инкремент и редирект на целевой URL.
 * Логику считает core/newsletter.php (newsletter_track_open / newsletter_track_click).
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$token = trim(input('t'));
$event = trim(input('e'));

if ($event === 'c') {
    $enc = (string) input('u');
    $url = '';
    if ($enc !== '') {
        $pad = strlen($enc) % 4;
        $b64 = strtr($enc, '-_', '+/') . ($pad ? str_repeat('=', 4 - $pad) : '');
        $url = (string) base64_decode($b64, true);
    }
    $target = function_exists('newsletter_track_click')
        ? newsletter_track_click($token, $url)
        : (preg_match('#^https?://#i', $url) ? $url : rtrim((string) cfgv('base_url'), '/') . '/');
    header('Location: ' . $target, true, 302);
    exit;
}

// По умолчанию — пиксель открытия.
if (function_exists('newsletter_track_open')) newsletter_track_open($token);

header('Content-Type: image/gif');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
// Прозрачный 1x1 GIF.
echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
exit;
