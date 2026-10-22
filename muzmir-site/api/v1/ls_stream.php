<?php
/**
 * ПОКАЗ ЭКРАНА — СТОРОНА УЧАСТНИКА (core/ls_access.php, раздел «показ экрана»).
 *
 * GET  — открыт ли доступ, смотрит ли администратор, есть ли новая указка.
 * POST action=push id=… full=0|1 data=[…] — пачка событий rrweb.
 * Ответ на оба — одно и то же состояние, поэтому указка приезжает с каждой
 * пачкой, раз в секунду, без отдельного опроса.
 *
 * Работает только из СОБСТВЕННОЙ сессии участника. Браузер администратора,
 * зашедшего в чужой кабинет, сюда не пишет: иначе он показывал бы сам себя.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/ls_access.php';
ls_watch_boot();

if (ls_active()) json_out(['ok' => true, 'active' => false]);
$u = current_user();
if (!$u) json_out(['ok' => true, 'active' => false]);
$uid = (int) $u['id'];

$g = ls_granted_for($uid);
$state = static function (?array $g): array {
    if (!$g) return ['ok' => true, 'active' => false];
    $g = ls_row((int) $g['id']) ?: $g;
    return [
        'ok'       => true,
        'active'   => true,
        'id'       => (int) $g['id'],
        'until'    => substr((string) $g['granted_until'], 11, 5),
        'left'     => max(0, (int) strtotime((string) $g['granted_until']) - time()),
        'watching' => ls_watching($g),
        // Возраст указки по часам сервера: старую метку новый скрипт страницы не показывает.
        'point'    => ($pt = ls_point_get($g)) ? $pt + ['age' => (int) round(microtime(true) * 1000) - (int) $pt['t']] : null,
    ];
};

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!csrf_check()) json_out(['ok' => false, 'error' => 'csrf'], 403);
    if (!$g || (int) input('id') !== (int) $g['id']) json_out(['ok' => true, 'active' => false]);
    if (input('action') === 'push' && ls_watching($g)) {
        $raw = (string) ($_POST['data'] ?? '');
        // Пачка — JSON-массив. Пустое и непомерное не берём: полный снимок
        // большой страницы — сотни килобайт, а не десятки мегабайт.
        if ($raw !== '' && strlen($raw) < 6 * 1024 * 1024 && is_array(json_decode($raw, true))) {
            ls_frames_push((int) $g['id'], input('full') === '1', $raw);
        }
    }
}
json_out($state($g));
