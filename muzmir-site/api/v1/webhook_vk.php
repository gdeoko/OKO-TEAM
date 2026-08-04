<?php
/**
 * Callback API ВКонтакте — авто-ответы в сообщениях сообщества «Музыкальный Мир».
 * ВК шлёт события сюда POST-ом (JSON). Мы:
 *   type=confirmation  -> отвечаем строкой подтверждения (cfgv('vk_confirm'));
 *   type=message_new   -> генерим ответ общим «мозгом» чата (chat_brain_reply)
 *                          и отправляем через messages.send токеном сообщества.
 * Ответ «ok» отдаём МГНОВЕННО (fastcgi_finish_request), а генерацию/отправку
 * делаем уже после — чтобы ВК не считал таймаут и не слал дубли. Дедуп по event_id.
 *
 * Регистрация сервера: scripts/vk_setup_callback.php (через API, токен manage).
 * Секрет запроса — cfgv('vk_callback_secret'); группа — cfgv('vk_group_id').
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/chat_brain.php';
require_once BASE_PATH . '/core/vk.php';

/** Мгновенный текстовый ответ ВК (не JSON) и выход. */
function vk_cb_out(string $body): void {
    if (!headers_sent()) header('Content-Type: text/plain; charset=utf-8');
    echo $body;
    exit;
}

$type = (string) input('type');

// --- Рукопожатие: подтверждение адреса сервера ---
if ($type === 'confirmation') {
    vk_cb_out((string) cfgv('vk_confirm', ''));
}

// --- Проверка секрета (если задан в настройках Callback) ---
$secret = (string) cfgv('vk_callback_secret', '');
if ($secret !== '' && (string) input('secret') !== $secret) {
    http_response_code(403);
    vk_cb_out('forbidden');
}

// --- Только своё сообщество ---
$gid = (int) cfgv('vk_group_id', 211325055);
$reqGid = (int) input('group_id');
if ($reqGid !== 0 && $reqGid !== $gid) {
    vk_cb_out('ok');
}

// --- Дедуп по event_id (ВК повторяет событие, пока не получит «ok») ---
$eventId = (string) input('event_id');
try {
    q("CREATE TABLE IF NOT EXISTS vk_cb_events (
        event_id TEXT PRIMARY KEY,
        type TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )");
    if ($eventId !== '') {
        $dup = (int) scalar("SELECT COUNT(*) FROM vk_cb_events WHERE event_id=?", [$eventId]);
        if ($dup > 0) vk_cb_out('ok');
        db()->prepare("INSERT OR IGNORE INTO vk_cb_events (event_id, type) VALUES (?, ?)")
            ->execute([$eventId, $type]);
    }
} catch (\Throwable $e) { /* дедуп best-effort */ }

// --- Отдаём «ok» немедленно, дальше обрабатываем в фоне ---
vk_cb_ack_then_process($type);

/**
 * Отдать «ok» и завершить HTTP-ответ, затем обработать событие в том же процессе.
 */
function vk_cb_ack_then_process(string $type): void {
    // Обрабатываем только новые входящие сообщения; остальное просто подтверждаем.
    $object = $_POST['object'] ?? [];
    if (!is_array($object)) $object = [];

    // Мгновенный ответ ВК.
    ignore_user_abort(true);
    if (!headers_sent()) {
        header('Content-Type: text/plain; charset=utf-8');
        header('Content-Length: 2');
    }
    echo 'ok';
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        // Фолбэк: дожать буфер и продолжить.
        while (ob_get_level() > 0) ob_end_flush();
        flush();
    }

    if ($type !== 'message_new') return;

    // API 5.199: входящее сообщение лежит в object.message.
    $msg  = $object['message'] ?? $object;
    $peer = (int) ($msg['peer_id'] ?? $msg['from_id'] ?? 0);
    $text = trim((string) ($msg['text'] ?? ''));
    if ($peer === 0) return;

    // Исходящие (эхо от самого сообщества) игнорируем.
    if ((int) ($msg['out'] ?? 0) === 1) return;

    $sessionKey = 'vk_' . $peer;

    try {
        _vk_bot_ensure_chatlog();
        // Пустой текст (стикер/вложение без слов) — вежливая подсказка.
        if ($text === '') {
            $reply = "Здравствуйте, доброго времени суток.\n\nНапишите, пожалуйста, Ваш вопрос текстом — подскажу по заявкам, участию, результатам и наградам Культурного центра «Музыкальный Мир».\n\n🌍 С уважением, оргкомитет культуры и искусства Культурного центра «Музыкальный Мир» 🌍";
        } else {
            insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey, 'role' => 'user', 'text' => $text, 'file' => '']);
            $reply = chat_brain_reply($text, $sessionKey, null, 'vk');
        }
        insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey, 'role' => 'assistant', 'text' => $reply, 'file' => '']);

        // Отправка ответа от имени сообщества. Уникальный random_id на каждый
        // ответ — иначе ВК считает повтор и молча отбрасывает второе сообщение.
        vk_dm_send($peer, $reply, '', random_int(1, 2000000000));
        _vk_log('bot reply peer=' . $peer . ' len=' . mb_strlen($reply));
    } catch (\Throwable $e) {
        _vk_log('bot error peer=' . $peer . ': ' . $e->getMessage());
    }
}

/** Гарантируем наличие таблицы chat_messages (та же, что у веб-чата). */
function _vk_bot_ensure_chatlog(): void {
    try {
        q("CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, session_key TEXT, role TEXT, text TEXT,
            file TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        )");
    } catch (\Throwable $e) {}
}
