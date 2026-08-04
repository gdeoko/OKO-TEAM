<?php
/**
 * Трекинг рассылок:
 *   GET ?e=o&t=<token>            — пиксель открытия (отдаёт 1x1 GIF).
 *   GET ?e=c&t=<token>&u=<b64url> — клик, инкремент и редирект на целевой URL.
 * Логику считает core/newsletter.php (newsletter_track_open / newsletter_track_click).
 *
 * Плюс лёгкий сборщик аналитики сайта (site_events):
 *   POST {type, path, meta} — pageview/click и т.п., без персональных данных.
 *   Пишется через site_event() (core/notify_owner.php), ошибки тихие.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

/* ---------- POST: событие аналитики сайта ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    require_once BASE_PATH . '/core/notify_owner.php';
    // Щадящий лимит: до 240 событий/час с IP; при превышении молча принимаем без записи.
    if (!rate_ok('track:' . client_ip(), 240, 3600)) json_out(['ok' => true]);

    $type = mb_substr(preg_replace('/[^a-z0-9_\-]/i', '', (string) input('type')) ?? '', 0, 32);
    if ($type === '') json_out(['ok' => false], 422);

    $path = (string) input('path');
    if ($path === '' || $path[0] !== '/') $path = '/' . ltrim($path, '/');
    $path = mb_substr($path, 0, 200);

    // meta — только короткие скалярные значения, без ПД (до 8 ключей).
    $meta = $_POST['meta'] ?? [];
    if (!is_array($meta)) $meta = [];
    $clean = [];
    foreach ($meta as $k => $v) {
        if (!is_scalar($v)) continue;
        $clean[mb_substr((string) $k, 0, 24)] = mb_substr((string) $v, 0, 160);
        if (count($clean) >= 8) break;
    }

    site_event($type, $path, $clean);
    json_out(['ok' => true]);
}

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
