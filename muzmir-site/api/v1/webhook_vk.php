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

    $t0 = time(); // отсчёт «человеческой» паузы от момента получения вопроса
    try {
        _vk_bot_ensure_chatlog();
        // Логируем входящее сообщение пользователя (если есть текст).
        if ($text !== '') {
            insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey, 'role' => 'user', 'text' => $text, 'file' => '']);
        }

        // Последний ответ оператора в этом диалоге — для антидубля и «тишины на стикеры».
        try {
            $lastAsst = (string) (scalar("SELECT text FROM chat_messages WHERE session_key=? AND role='assistant' ORDER BY id DESC LIMIT 1", [$sessionKey]) ?: '');
            $lastRole = (string) (scalar("SELECT role FROM chat_messages WHERE session_key=? ORDER BY id DESC LIMIT 1", [$sessionKey]) ?: '');
        } catch (\Throwable $e) { $lastAsst = ''; $lastRole = ''; }
        // Нормализация для сравнения (без пробелов/регистра/эмодзи-хвостов).
        $normReply = static fn(string $s): string => mb_strtolower(preg_replace('/\s+/u', ' ', trim($s)));

        // Стикеры/картинки/пустой текст: НЕ дёргаем человека повторно. Если мы только что
        // ответили (последняя запись — наш ответ) — молчим. Иначе один раз мягко просим текст.
        if ($text === '' && $lastRole === 'assistant') {
            _vk_log('skip empty (sticker) peer=' . $peer . ' — уже ответили');
            return;
        }

        vk_typing($peer);                        // «печатает…» сразу, как живой оператор
        $name  = vk_user_name($peer);            // имя для персонального приветствия
        $greet = chat_should_greet($sessionKey); // здороваемся раз в начале / после суток
        // Если этот ВК-пользователь привязан к аккаунту сайта — подтягиваем его заявки.
        try { $vkUid = (int) (scalar("SELECT id FROM users WHERE vk_id = ?", [(string) $peer]) ?: 0); }
        catch (\Throwable $e) { $vkUid = 0; }
        $GLOBALS['chat_user_ctx'] = $vkUid ? chat_user_context($vkUid) : '';
        $closing = false; $short = false;

        if ($text !== '' && chat_is_closing($text)) {
            // Пользователь завершил диалог («спасибо», «пока» и т.п.) — финальный шаблон.
            $reply   = chat_closing_message($name);
            $closing = true;
        } elseif ($text === '') {
            $core  = 'Напишите, пожалуйста, Ваш вопрос текстом — подскажу по заявкам, участию, результатам и наградам Культурного центра «Музыкальный Мир».';
            $reply = chat_wrap_reply($sessionKey, $core, $name, $greet, false);
        } elseif (($rep = chat_repeat_count($sessionKey, $text)) > 0) {
            // Один и тот же вопрос повторно (в т.ч. троллинг) — короткий человеческий ответ.
            $reply = chat_repeat_reply($rep, $name);
            $short = true;
        } else {
            $core  = chat_brain_reply($text, $sessionKey, null, 'vk');
            // Задача 1 (ВК): вопрос про результат/диплом + несколько действующих заявок и
            // номер не назван → пронумерованный список заявок (клавиатур нет — цифрами/номерами).
            if ($vkUid) {
                $picker = chat_apps_numbered_text($vkUid, $text);
                if ($picker !== '') $core = trim($core . "\n\n" . $picker);
            }
            // Задача 3 (ВК): мозг ушёл в rule-фолбэк — просим позвонить + уведомляем владельца.
            if (!empty($GLOBALS['chat_fell_back'])) {
                $vkLink = 'https://vk.com/gim' . (int) cfgv('vk_group_id', 211325055) . '?sel=' . $peer;
                $tail = chat_escalate_no_answer($vkUid ?: null, $sessionKey, $name, $text, 'vk',
                    ['Ссылка' => $vkLink, 'peer_id' => (string) $peer]);
                if ($tail !== '') $core = trim($core . "\n\n" . $tail);
            }
            $reply = chat_wrap_reply($sessionKey, $core, $name, $greet, false);
        }

        // АНТИДУБЛЬ: нельзя слать один и тот же ответ подряд (участник видит спам).
        // Если сгенерированный ответ совпал с прошлым — заменяем коротким уточнением;
        // если и оно уже было — молчим (не отвечаем на каждое сообщение/стикер).
        if (!$closing && $lastAsst !== '' && $normReply($reply) === $normReply($lastAsst)) {
            $clarifiers = [
                'Уточните, пожалуйста, вопрос текстом — по участию, оплате, результатам или наградам, — и я подскажу.',
                'Напишите, пожалуйста, чем помочь: заявка, оплата, результаты или награды?',
            ];
            // Выбираем вариант, которого ещё не было последним.
            $alt = $normReply($clarifiers[0]) === $normReply($lastAsst) ? $clarifiers[1] : $clarifiers[0];
            if ($normReply($alt) === $normReply($lastAsst)) {
                _vk_log('skip duplicate reply peer=' . $peer);
                return; // всё уже сказано — молчим
            }
            $reply = chat_wrap_reply($sessionKey, $alt, $name, false, true);
            $short = true;
        }

        // Сразу фиксируем ответ в истории (состояние диалога корректно тут же).
        insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey, 'role' => 'assistant', 'text' => $reply, 'file' => '']);
        if ($closing) chat_mark_dialog_end($sessionKey); // маркер — ПОСЛЕ ответа, чтобы следующий диалог снова здоровался

        // Тихая эскалация оператору в Телеграм: участник просит живого человека / жалоба / возврат.
        try {
            $tl = mb_strtolower($text);
            $trg = ['оператор','живой человек','с человеком','менеджер','жалоб','недоволен','верните деньги','возврат','не помог','позовите','соедините','администратор','сотрудник','обман'];
            $hitVk = false;
            foreach ($trg as $w) if ($text !== '' && mb_strpos($tl, $w) !== false) { $hitVk = true; break; }
            $doneVk = (int) scalar("SELECT COUNT(*) FROM chat_messages WHERE session_key=? AND role='escalated'", [$sessionKey]);
            if ($hitVk && $doneVk === 0) {
                if (!function_exists('owner_notify') && is_file(BASE_PATH . '/core/notify_owner.php')) require_once BASE_PATH . '/core/notify_owner.php';
                if (function_exists('owner_notify')) {
                    $hist = all("SELECT role,text FROM chat_messages WHERE session_key=? AND role IN ('user','assistant') ORDER BY id DESC LIMIT 10", [$sessionKey]);
                    $tr = [];
                    foreach (array_reverse($hist) as $r) { $tx = trim((string)$r['text']); if ($tx!=='') $tr[] = ($r['role']==='user'?'👤':'🤖').' '.mb_substr($tx,0,200); }
                    owner_notify('ЧАТ-БОТ', '🔔 Нужен оператор (ВКонтакте) — участник просит живого человека', implode("\n", $tr), [
                        'Участник ВК' => $name ?: ('peer ' . $peer),
                        'peer_id'     => (string)$peer,
                        'Ссылка'      => 'https://vk.com/gim' . (int) cfgv('vk_group_id', 211325055) . '?sel=' . $peer,
                        '_event'      => 'chat_escalation_vk',
                    ]);
                }
                insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey, 'role' => 'escalated', 'text' => '', 'file' => '']);
            }
        } catch (\Throwable $e) { /* тихо */ }

        // Человеческая пауза 20-30 сек (для коротких/повторных — 8-14 сек) с «печатает…».
        // Выполняется ОТДЕЛЬНЫМ отсоединённым процессом, чтобы НЕ держать php-fpm воркер
        // (пул из 5 — иначе подвиснет весь сайт). Индикатор «печатает…» уже показан выше.
        $target = $short ? random_int(8, 14) : random_int(20, 30);
        $target = (int) max(3, $target - (time() - $t0)); // вычесть уже потраченное на генерацию
        $cmd = 'php ' . escapeshellarg(BASE_PATH . '/cron/vk_send_delayed.php')
             . ' ' . (int) $peer . ' ' . (int) $target . ' ' . escapeshellarg(base64_encode($reply))
             . ' >/dev/null 2>&1 &';
        exec($cmd);
        _vk_log('bot reply peer=' . $peer . ' greet=' . (int) $greet . ' short=' . (int) $short . ' delay=' . $target . 's len=' . mb_strlen($reply));
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
