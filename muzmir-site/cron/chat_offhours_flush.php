<?php
/**
 * Утренний ответ на вопросы, заданные вне рабочего времени.
 *
 * Пока центр не работает (вне 9:00–18:00 МСК / воскресенье), бот отвечает участнику
 * ВК коротким шаблоном и ставит диалогу флаг pending_offhours. Этот cron запускается
 * часто (раз в 5–10 минут); как только наступает рабочее время, он берёт такие диалоги,
 * генерирует настоящий ответ на ПОСЛЕДНИЙ вопрос участника общим «мозгом» и снимает флаг.
 *
 * ВЕБ-ДИАЛОГИ ТОЖЕ ОТРАБАТЫВАЮТСЯ. Раньше они пропускались с рассуждением «участник
 * не на связи» — и вопрос, заданный вечером на сайте, не получал ответа никогда:
 * человек возвращался в чат и видел там только своё сообщение и дежурное «сейчас
 * нерабочее время». Толкнуть сообщение в браузер мы действительно не можем, но
 * положить готовый ответ в историю — можем: окно чата добирает историю по
 * `since` из localStorage, и ответ ждёт человека прямо в переписке. Письмо на
 * почту отсюда НЕ отправляется: это внешнее действие, у него своё окно и свои
 * ящики (см. CLAUDE.md, правило 7).
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
                     WHERE pending_offhours=1 AND COALESCE(blocked,0)=0
                     ORDER BY updated_at ASC LIMIT 100");
} catch (\Throwable $e) { $dialogs = []; }

$answered = 0;
foreach ($dialogs as $d) {
    $sessionKey = (string) $d['session_key'];
    $isVk = (string) ($d['channel'] ?? '') === 'vk' || str_starts_with($sessionKey, 'vk_');
    $peer = (int) ($d['peer_id'] ?: (str_starts_with($sessionKey, 'vk_') ? substr($sessionKey, 3) : 0));
    // Диалог ВК без peer_id отправить некуда — снимаем флаг, чтобы не крутился вечно.
    if ($isVk && $peer <= 0) { chat_dialog_set($sessionKey, ['pending_offhours' => 0]); continue; }

    // Если оператор уже подключился / бот выключен — не мешаем, просто снимаем флаг.
    if (chat_bot_muted($sessionKey) !== '') { chat_dialog_set($sessionKey, ['pending_offhours' => 0]); continue; }

    /* СТАРЬЁ НЕ ВОСКРЕШАЕМ. Флаг мог провисеть неделю — например, пока веб-диалоги
     * вообще не обрабатывались. «Доброе утро! Возвращаюсь к Вашему вопросу» через
     * девять дней после вопроса читается не как забота, а как сбой автоматики, да
     * и вопрос за это время обычно решён. Отвечаем на вчерашнее, не на прошлое. */
    $askedAt = strtotime((string) ($d['offhours_at'] ?? '')) ?: 0;
    if ($askedAt > 0 && (time() - $askedAt) > 2 * 86400) {
        chat_dialog_set($sessionKey, ['pending_offhours' => 0]);
        cron_log(JOB, 'пропуск (вопрос старше двух суток): ' . $sessionKey . ' от ' . $d['offhours_at']);
        continue;
    }

    // Последний содержательный вопрос участника (после которого мы прислали шаблон).
    $lastQ = '';
    try {
        $lastQ = (string) (scalar(
            "SELECT text FROM chat_messages WHERE session_key=? AND role='user' AND text<>'' ORDER BY id DESC LIMIT 1",
            [$sessionKey]) ?: '');
    } catch (\Throwable $e) { $lastQ = ''; }
    if ($lastQ === '') { chat_dialog_set($sessionKey, ['pending_offhours' => 0]); continue; }

    // Аккаунт сайта — чтобы отвечать по его заявкам. В ВК ищем по привязке vk_id,
    // в вебе участник мог быть авторизован, и его id стоит прямо на сообщениях.
    $uid = 0;
    try {
        $uid = $isVk
            ? (int) (scalar("SELECT id FROM users WHERE vk_id = ?", [(string) $peer]) ?: 0)
            : (int) (scalar("SELECT user_id FROM chat_messages
                              WHERE session_key=? AND COALESCE(user_id,0)>0
                              ORDER BY id DESC LIMIT 1", [$sessionKey]) ?: 0);
    } catch (\Throwable $e) { $uid = 0; }
    $GLOBALS['chat_user_ctx'] = $uid ? chat_user_context($uid) : '';

    $name = '';
    if ($isVk) { try { $name = vk_user_name($peer); } catch (\Throwable $e) {} }
    elseif ($uid) {
        try { $name = (string) (scalar("SELECT full_name FROM users WHERE id=?", [$uid]) ?: ''); }
        catch (\Throwable $e) {}
        $name = trim(explode(' ', trim($name))[1] ?? '');   // обращаемся по имени, не по фамилии
    }

    $core = chat_brain_reply($lastQ, $sessionKey, $uid ?: null, $isVk ? 'vk' : 'web');
    if ($uid && function_exists('chat_apps_numbered_text')) {
        $picker = chat_apps_numbered_text($uid, $lastQ);
        if ($picker !== '') $core = trim($core . "\n\n" . $picker);
    }
    // «Доброе утро»-обрамление: отвечаем на вчерашний/ночной вопрос.
    $prefix = trim($name) !== '' ? ('Доброе утро, ' . trim($name) . '! ') : 'Доброе утро! ';
    $reply  = $prefix . 'Возвращаюсь к Вашему вопросу.' . "\n\n" . chat_wrap_reply($sessionKey, $core, '', false, false);

    /* В историю ответ кладём в обоих каналах — это и есть ответ для веба. Очередь
     * пяти минут здесь не нужна: человек и так ждал всю ночь. */
    try {
        insert('chat_messages', ['user_id' => $uid ?: null, 'session_key' => $sessionKey,
                                 'role' => 'assistant', 'text' => $reply, 'file' => '']);
    } catch (\Throwable $e) {}

    $ok = true;
    if ($isVk) {
        try { $r = vk_dm_send($peer, $reply); $ok = !isset($r['error']); }
        catch (\Throwable $e) { $ok = false; }
    }

    chat_dialog_set($sessionKey, ['pending_offhours' => 0]);
    if ($ok) $answered++;
    cron_log(JOB, ($isVk ? 'peer=' . $peer : 'web=' . $sessionKey)
                  . ' ответ=' . ($ok ? 'ok' : 'fail') . ' q=' . mb_substr($lastQ, 0, 60));
}

cron_log(JOB, 'ответили на ' . $answered . ' из ' . count($dialogs) . ' диалогов');
exit(0);
