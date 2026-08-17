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

/* ---------- Открытие письма, отправленного НАПРЯМУЮ с почты центра ----------
 *
 * У писем, ушедших через сервис рассылок, события открытий присылает сам сервис.
 * Письма ведомственным шлюзам и на Яндекс уходят мимо него, прямой отправкой, и
 * по ним не было бы вообще ничего: ни доставки, ни открытий. А знать надо именно
 * это — ради того канал и заводился (Яндекс письма через сервис принимает, но
 * кладёт в «Спам»: 1 181 доставлено, 7 открытий).
 *
 * Ссылка именная и подписана: по номеру письма в очереди находится адрес, и
 * открытие ложится в общую таблицу событий с пометкой job_id='own'. Дальше его
 * одинаково видят и отчёт по службам, и суточные нормы.
 */
if ($event === 'o2') {
    $qid = (int) input('q');
    $sig = trim((string) input('s'));
    if (!function_exists('nl_own_pixel_sig')) require_once BASE_PATH . '/core/newsletter.php';
    if ($qid > 0 && $sig !== '' && hash_equals(nl_own_pixel_sig($qid), $sig)) {
        try {
            $to = (string) (scalar("SELECT to_email FROM mail_queue WHERE id=?", [$qid]) ?? '');
            if ($to !== '') nl_own_event($to, 'opened');
        } catch (\Throwable $e) { /* картинку отдаём в любом случае */ }
    }
    header('Content-Type: image/gif');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo base64_decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    exit;
}

if ($event === 'c') {
    $enc = (string) input('u');
    $url = '';
    if ($enc !== '') {
        $pad = strlen($enc) % 4;
        $b64 = strtr($enc, '-_', '+/') . ($pad ? str_repeat('=', 4 - $pad) : '');
        $url = (string) base64_decode($b64, true);
    }
    // core/newsletter.php здесь НЕ подключался, поэтому newsletter_track_click()
    // не существовала, и работал фолбэк — «любой http(s) адрес годится». То есть
    // проверка домена, написанная в newsletter_track_click, не применялась ни разу:
    // ссылка вида /api/v1/track?e=c&u=<чужой сайт> уводила куда угодно с
    // официального домена центра, и в письме она выглядит как наша.
    if (!function_exists('newsletter_track_click')) {
        require_once BASE_PATH . '/core/newsletter.php';
    }
    $target = function_exists('newsletter_track_click')
        ? newsletter_track_click($token, $url)
        : rtrim((string) cfgv('base_url'), '/') . '/';   // без проверки домена — только на главную
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
