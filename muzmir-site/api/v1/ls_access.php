<?php
/**
 * ЗАПРОС ДОСТУПА К КАБИНЕТУ — СТОРОНА УЧАСТНИКА (core/ls_access.php).
 *
 * GET  — есть ли запрос, ждущий ответа, и открыт ли доступ сейчас. Кабинет
 *        спрашивает каждые несколько секунд, пока открыт: всё происходит в
 *        реальном времени, писем и сообщений нет (слово владельца).
 * POST action=answer id=… agree=1|0 — ответ на запрос.
 * POST action=close  id=…           — закрыть открытый доступ досрочно.
 *
 * Ответ даёт только сам участник из своей сессии. Из кабинета, открытого
 * администратором, ни согласиться, ни закрыть нельзя — иначе согласие
 * давал бы тот, кто его просит.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/ls_access.php';

if (ls_active()) json_out(['ok' => true, 'impersonating' => true]);

$u = current_user();
if (!$u) json_out(['ok' => false, 'error' => 'Требуется вход в кабинет'], 401);
$uid = (int) $u['id'];

// Имя администратора участнику не показываем (слово владельца 22.10.2026):
// окно говорит «Администратор колл-центра Культурного центра».

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!csrf_check()) json_out(['ok' => false, 'error' => 'Сессия устарела, обновите страницу'], 403);
    $id = (int) input('id');
    $act = input('action');
    if ($act === 'answer') {
        $agree = input('agree') === '1';
        if (!ls_answer($id, $uid, $agree)) {
            json_out(['ok' => false, 'error' => 'Запрос уже не действует — администратор может отправить новый.'], 409);
        }
        audit($agree ? 'ls_consent_given' : 'ls_consent_denied', 'ls_access', $id);
        json_out(['ok' => true, 'granted' => $agree]);
    }
    if ($act === 'close') {
        $r = ls_row($id);
        if (!$r || (int) $r['user_id'] !== $uid) json_out(['ok' => false, 'error' => 'Доступ не найден'], 404);
        ls_close($id, 'user');
        audit('ls_closed_by_user', 'ls_access', $id);
        json_out(['ok' => true]);
    }
    json_out(['ok' => false, 'error' => 'Неизвестное действие'], 400);
}

$p = ls_pending_for($uid);
$g = ls_granted_for($uid);
json_out([
    'ok' => true,
    'pending' => $p ? [
        'id' => (int) $p['id'],
        'left' => max(0, (int) strtotime((string) $p['pending_until']) - time()),
        'minutes' => LS_GRANT_MIN,
    ] : null,
    'granted' => $g ? [
        'id' => (int) $g['id'],
        'until' => substr((string) $g['granted_until'], 11, 5),
        'entered' => (string) $g['entered_at'] !== '',
    ] : null,
]);
