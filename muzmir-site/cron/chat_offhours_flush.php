<?php
/**
 * Утренний ответ на вопросы, заданные вне рабочего времени.
 *
 * Пока центр не работает (вне 9:00–18:00 МСК / воскресенье), бот отвечает участнику
 * ВК коротким шаблоном и ставит диалогу флаг pending_offhours. Этот cron запускается
 * часто (раз в 5–10 минут); как только наступает рабочее время, он берёт такие диалоги,
 * генерирует настоящий ответ на ПОСЛЕДНИЙ вопрос участника общим «мозгом» и отправляет
 * его во ВКонтакте, после чего снимает флаг. Веб-диалоги пропускаем — участник не на
 * связи (ответит бот вживую, когда снова напишет в рабочее время).
 *
 * Запуск: php cron/chat_offhours_flush.php   (в кроне — каждые 5–10 минут)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/chat_brain.php';
require_once BASE_PATH . '/core/chat_ops.php';
require_once BASE_PATH . '/core/vk.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'chat_offhours_flush';

if (!cron_lock(JOB, 600)) { exit(0); }

// Только в рабочее время — иначе ждём.
if (!chat_is_working_hours()) {
    cron_log(JOB, 'нерабочее время — пропуск');
    exit(0);
}

chat_ops_boot();

$dialogs = [];
try {
    $dialogs = all("SELECT * FROM chat_dialogs
                     WHERE pending_offhours=1 AND channel='vk' AND COALESCE(blocked,0)=0
                     ORDER BY updated_at ASC LIMIT 100");
} catch (\Throwable $e) { $dialogs = []; }

$answered = 0;
foreach ($dialogs as $d) {
    $sessionKey = (string) $d['session_key'];
    $peer = (int) ($d['peer_id'] ?: (str_starts_with($sessionKey, 'vk_') ? substr($sessionKey, 3) : 0));
    if ($peer <= 0) { chat_dialog_set($sessionKey, ['pending_offhours' => 0]); continue; }

    // Если оператор уже подключился / бот выключен — не мешаем, просто снимаем флаг.
    if (chat_bot_muted($sessionKey) !== '') { chat_dialog_set($sessionKey, ['pending_offhours' => 0]); continue; }

    // Последний содержательный вопрос участника (после которого мы прислали шаблон).
    $lastQ = '';
    try {
        $lastQ = (string) (scalar(
            "SELECT text FROM chat_messages WHERE session_key=? AND role='user' AND text<>'' ORDER BY id DESC LIMIT 1",
            [$sessionKey]) ?: '');
    } catch (\Throwable $e) { $lastQ = ''; }
    if ($lastQ === '') { chat_dialog_set($sessionKey, ['pending_offhours' => 0]); continue; }

    // Привязанный аккаунт сайта — чтобы отвечать по его заявкам.
    try { $vkUid = (int) (scalar("SELECT id FROM users WHERE vk_id = ?", [(string) $peer]) ?: 0); }
    catch (\Throwable $e) { $vkUid = 0; }
    $GLOBALS['chat_user_ctx'] = $vkUid ? chat_user_context($vkUid) : '';

    $name = '';
    try { $name = vk_user_name($peer); } catch (\Throwable $e) {}

    $core = chat_brain_reply($lastQ, $sessionKey, $vkUid ?: null, 'vk');
    if ($vkUid && function_exists('chat_apps_numbered_text')) {
        $picker = chat_apps_numbered_text($vkUid, $lastQ);
        if ($picker !== '') $core = trim($core . "\n\n" . $picker);
    }
    // «Доброе утро»-обрамление: отвечаем на вчерашний/ночной вопрос.
    $prefix = trim($name) !== '' ? ('Доброе утро, ' . trim($name) . '! ') : 'Доброе утро! ';
    $reply  = $prefix . 'Возвращаюсь к Вашему вопросу.' . "\n\n" . chat_wrap_reply($sessionKey, $core, '', false, false);

    try {
        insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey, 'role' => 'assistant', 'text' => $reply, 'file' => '']);
    } catch (\Throwable $e) {}

    $ok = false;
    try { $r = vk_dm_send($peer, $reply); $ok = !isset($r['error']); }
    catch (\Throwable $e) { $ok = false; }

    chat_dialog_set($sessionKey, ['pending_offhours' => 0]);
    if ($ok) $answered++;
    cron_log(JOB, 'peer=' . $peer . ' ответ=' . ($ok ? 'ok' : 'fail') . ' q=' . mb_substr($lastQ, 0, 60));
}

cron_log(JOB, 'ответили на ' . $answered . ' из ' . count($dialogs) . ' диалогов');
exit(0);
