<?php
/**
 * Эндпоинты для внешнего мозг-агента. Авторизация: Bearer cfgv('agent_token').
 * Роутинг по $_GET['action']:
 *   GET  ?action=user&id=..         — данные пользователя
 *   GET  ?action=application&id=..  — данные заявки
 *   POST ?action=webhook           — событие сайта от агента
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$token = cfgv('agent_token');
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
if (!$token || !preg_match('/Bearer\s+(\S+)/i', $auth, $m) || !hash_equals((string) $token, trim($m[1]))) {
    json_out(['ok' => false, 'error' => 'Не авторизовано'], 401);
}

$action = input('action');

switch ($action) {
    case 'user':
        $u = one(
            "SELECT id, email, full_name, phone, tg_id, role, created_at, last_login FROM users WHERE id=?",
            [(int) input('id')]
        );
        if (!$u) json_out(['ok' => false, 'error' => 'Пользователь не найден'], 404);
        json_out(['ok' => true, 'user' => $u]);
        // no break — json_out завершает выполнение

    case 'application':
        $a = one(
            "SELECT a.*, c.name AS competition_name, c.slug AS competition_slug
               FROM applications a LEFT JOIN competitions c ON c.id = a.competition_id
              WHERE a.id=?",
            [(int) input('id')]
        );
        if (!$a) json_out(['ok' => false, 'error' => 'Заявка не найдена'], 404);
        json_out(['ok' => true, 'application' => $a]);

    case 'webhook':
        require_post();
        $event = input('event');
        audit('agent_webhook', '', null, ['event' => $event, 'payload' => array_keys($_POST)]);
        json_out(['ok' => true, 'received' => $event]);

    default:
        json_out(['ok' => false, 'error' => 'Неизвестное действие'], 400);
}
