<?php
/**
 * Живая проверка конкурсной видео-ссылки на шаге подачи заявки.
 * Форма зовёт этот эндпоинт при переходе с шага «Номер», чтобы НЕ пропустить
 * дальше заведомо неверную ссылку: несуществующую, закрытую, не видео или
 * старше 1 года. Ответ: { ok, state, platform, stale, reason }.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/link_check.php';

// ОГРАНИЧЕНИЕ ЧАСТОТЫ И ИСТОЧНИКА.
// Ручка не требовала ни входа, ни лимита, ни даже POST — и при этом заставляла наш
// сервер ходить curl'ом по любому переданному адресу. Это и разведка внутренней сети
// чужими руками (ответ отличается по времени и коду), и готовый усилитель флуда:
// один HTTP-запрос к нам превращался в наш запрос к жертве, без счётчика.
if (!request_same_origin_vc()) {
    json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Недопустимый источник запроса'], 403);
}
if (!rate_ok('video_check:' . client_ip(), 30, 3600)) {
    json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Слишком много проверок. Подождите немного.'], 429);
}

$url = trim((string) input('url'));
if ($url === '') json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Пустая ссылка']);
if (mb_strlen($url) > 500) json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Слишком длинная ссылка']);

$r = video_verify($url);
json_out([
    'ok'       => (bool)($r['ok'] ?? false),
    'state'    => (string)($r['state'] ?? 'bad'),
    'platform' => (string)($r['platform'] ?? ''),
    'stale'    => $r['stale'] ?? null,
    'reason'   => (string)($r['reason'] ?? ''),
]);

/** Проверка Origin/Referer своего домена — ручкой пользуется только форма подачи. */
function request_same_origin_vc(): bool {
    $hosts = [];
    if ($bu = cfgv('base_url')) { $h = parse_url((string) $bu, PHP_URL_HOST); if ($h) $hosts[] = strtolower($h); }
    foreach (['domain', 'domain_puny'] as $k) { if ($d = cfgv($k)) $hosts[] = strtolower((string) $d); }
    $hosts = array_values(array_unique(array_filter($hosts)));
    if (!$hosts) return true;
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') return false;
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    return $srcHost !== '' && in_array($srcHost, $hosts, true);
}
