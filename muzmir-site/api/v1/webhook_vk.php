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
require_once BASE_PATH . '/core/chat_ops.php';
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

// --- Проверка секрета ---
// СЕКРЕТ ОБЯЗАТЕЛЕН. Раньше проверка стояла под условием «если секрет задан»:
// стоило его не заполнить (или случайно затереть в настройках Callback API), и
// ручка становилась анонимной — кто угодно мог слать сюда события от имени
// сообщества, отвечать за бота и заводить диалоги. Незаполненный секрет — это не
// «проверка отключена», это открытая дверь.
$secret = (string) cfgv('vk_callback_secret', '');
if ($secret === '') {
    error_log('webhook_vk: vk_callback_secret не задан — приём событий закрыт');
    http_response_code(403);
    vk_cb_out('forbidden');
}
if (!hash_equals($secret, (string) input('secret'))) {
    http_response_code(403);
    vk_cb_out('forbidden');
}

// --- Только своё сообщество ---
// Поблажка «$reqGid !== 0» убрана: событие без group_id — это не наше событие.
$gid = (int) cfgv('vk_group_id', 211325055);
if ((int) input('group_id') !== $gid) {
    vk_cb_out('ok');
}

// --- Дедуп по event_id (ВК повторяет событие, пока не получит «ok») ---
$eventId = (string) input('event_id');
try {
    q("CREATE TABLE IF NOT EXISTS vk_cb_events (
        event_id TEXT PRIMARY KEY,
        type TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
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

        // Регистрируем/обновляем диалог в реестре (для админ-раздела «Чат-бот»).
        chat_dialog_set($sessionKey, ['channel' => 'vk', 'peer_id' => (string) $peer]);

        // --- Ручной перехват / блокировка / выключенный бот: НЕ отвечаем автоматически ---
        // (оператор ведёт диалог сам из админки; бот молчит 5–10 минут после его ответа).
        if (($muted = chat_bot_muted($sessionKey)) !== '') {
            _vk_log('bot muted (' . $muted . ') peer=' . $peer);
            return;
        }

        // --- Мультимодал: голосовое/фото/видео-вложение → текст (расшифровка ВК или Gemini) ---
        // Распознаём ДО проверки нерабочего времени, чтобы и голосовое сохранилось и получило ответ.
        if (empty($msg['attachments']) === false && is_array($msg['attachments'])) {
            [$mk, $murl, $mtr] = _vk_extract_media($msg);
            $mediaText = '';
            if ($mtr !== '') {
                $mediaText = $mtr;                                   // ВК уже расшифровала голосовое
            } elseif ($mk !== '' && $murl !== '') {
                try {
                    require_once BASE_PATH . '/core/chat_media.php';
                    $u = chat_media_understand_url($murl, $mk);
                    if ($u !== '') $mediaText = chat_media_as_user_text($mk, $u);
                } catch (\Throwable $e) { _vk_log('media understand err: ' . $e->getMessage()); }
            }
            if ($mediaText !== '') {
                $text = ($text === '') ? $mediaText : trim($text . "\n" . $mediaText);
                // Голосовое без подписи — сохраняем расшифровку как реплику пользователя (в историю/контекст).
                try { insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey, 'role' => 'user', 'text' => $mediaText, 'file' => '']); } catch (\Throwable $e) {}
            }
        }

        // --- Вне рабочего времени (9:00–18:00 МСК, кроме вс): шаблон + сохраняем вопрос ---
        // Ответ по существу бот даст утром (cron/chat_offhours_flush.php) или оператор.
        if ($text !== '' && !chat_is_working_hours()) {
            $d = chat_dialog_get($sessionKey);
            if ((int) ($d['pending_offhours'] ?? 0) !== 1) {
                $nm  = vk_user_name($peer);
                $tpl = chat_offhours_template($nm);
                insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey, 'role' => 'assistant', 'text' => $tpl, 'file' => '']);
                chat_dialog_set($sessionKey, ['pending_offhours' => 1, 'offhours_at' => date('Y-m-d H:i:s'), 'title' => $nm]);
                vk_typing($peer);
                if (!_vk_spawn_delayed($peer, random_int(4, 9), $tpl)) {
                    $r = vk_dm_send($peer, $tpl, '', random_int(1, 2000000000));
                    if (!isset($r['response'])) {
                        _vk_log('offhours peer=' . $peer . ' НЕ ДОСТАВЛЕНО: '
                                . json_encode($r['error'] ?? $r, JSON_UNESCAPED_UNICODE));
                    }
                }
                _vk_log('offhours template peer=' . $peer);
            } else {
                _vk_log('offhours (pending) peer=' . $peer . ' — молчим до утра');
            }
            return;
        }
        // Рабочее время: если оставался «нерабочий» вопрос — снимаем флаг, ответим сейчас.
        if ((int) (chat_dialog_get($sessionKey)['pending_offhours'] ?? 0) === 1) {
            chat_dialog_set($sessionKey, ['pending_offhours' => 0]);
        }

        // Последний ответ оператора + последняя СОДЕРЖАТЕЛЬНАЯ роль (user/assistant,
        // игнорируя системные маркеры escalated/dialog_end) — для антидубля и «тишины на стикеры».
        try {
            $lastAsst = (string) (scalar("SELECT text FROM chat_messages WHERE session_key=? AND role='assistant' ORDER BY id DESC LIMIT 1", [$sessionKey]) ?: '');
            $lastRole = (string) (scalar("SELECT role FROM chat_messages WHERE session_key=? AND role IN ('user','assistant') ORDER BY id DESC LIMIT 1", [$sessionKey]) ?: '');
        } catch (\Throwable $e) { $lastAsst = ''; $lastRole = ''; }
        // Нормализация для сравнения (без пробелов/регистра/эмодзи-хвостов).
        $normReply = static fn(string $s): string => mb_strtolower(preg_replace('/\s+/u', ' ', trim($s)));

        // Вложения (фото/видео/документ) во входящем сообщении — например скрин заявки/оплаты.
        $hasAttach = !empty($msg['attachments']) && is_array($msg['attachments']);

        // Стикеры/эмодзи/пустой текст БЕЗ вложения: не дёргаем человека повторно. Если мы
        // только что ответили (последняя содержательная запись — наш ответ) — молчим.
        if ($text === '' && !$hasAttach && $lastRole === 'assistant') {
            _vk_log('skip empty (sticker) peer=' . $peer . ' — уже ответили');
            return;
        }

        vk_typing($peer);                        // «печатает…» сразу, как живой оператор
        $name  = vk_user_name($peer);            // имя для персонального приветствия
        $greet = chat_should_greet($sessionKey); // здороваемся раз в начале / после суток
        // Если этот ВК-пользователь привязан к аккаунту сайта — подтягиваем его заявки.
        try { $vkUid = (int) (scalar("SELECT id FROM users WHERE vk_id = ?", [(string) $peer]) ?: 0); }
        catch (\Throwable $e) { $vkUid = 0; }
        // Контекст: привязанный аккаунт + «обучение на диалоге» (ФИО/номер заявки из переписки).
        $ctx  = $vkUid ? chat_user_context($vkUid) : '';
        $hint = ($text !== '') ? chat_context_from_dialogue($sessionKey, $text) : '';
        $GLOBALS['chat_user_ctx'] = $hint !== '' ? trim($ctx . "\n" . $hint) : $ctx;
        $closing = false; $short = false;

        if ($text !== '' && chat_is_closing($text)) {
            // Пользователь завершил диалог («спасибо», «пока» и т.п.) — финальный шаблон.
            $reply   = chat_closing_message($name);
            $closing = true;
        } elseif ($text === '') {
            // Пришло вложение (фото/скрин) без подписи — подтверждаем получение, а не «пишите текстом».
            $core = $hasAttach
                ? 'Спасибо, вложение получила. Подскажите, пожалуйста, по какому вопросу — заявка, оплата, результаты или наградные материалы, — и я помогу.'
                : 'Напишите, пожалуйста, Ваш вопрос текстом — подскажу по заявкам, участию, результатам и наградам Культурного центра «Музыкальный Мир».';
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
            $reply = chat_wrap_reply($sessionKey, $alt, $name, false, false);
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
        // Отсоединённый процесс запускаем ЯВНЫМ бинарником PHP и проверяем, что он
        // вообще стартовал. Голое 'php …' зависело от PATH процесса php-fpm — в нём
        // php может отсутствовать вовсе, и тогда ответ бота не уходил никуда, а в
        // логе стояло бодрое «bot reply». Если запустить не удалось — отправляем
        // синхронно, без человеческой паузы: лучше мгновенный ответ, чем никакого.
        if (!_vk_spawn_delayed($peer, $target, $reply)) {
            _vk_log('bot reply peer=' . $peer . ': фоновый процесс не запустился — шлю синхронно');
            $r = vk_dm_send($peer, $reply, '', random_int(1, 2000000000));
            if (!isset($r['response'])) {
                _vk_log('bot reply peer=' . $peer . ' НЕ ДОСТАВЛЕНО: '
                        . json_encode($r['error'] ?? $r, JSON_UNESCAPED_UNICODE));
            }
        }
        _vk_log('bot reply peer=' . $peer . ' greet=' . (int) $greet . ' short=' . (int) $short . ' delay=' . $target . 's len=' . mb_strlen($reply));
    } catch (\Throwable $e) {
        _vk_log('bot error peer=' . $peer . ': ' . $e->getMessage());
    }
}

/**
 * Запуск отсоединённого процесса «печатает… → отправить».
 *
 * Путь к PHP берём из настройки php_bin, иначе — из PHP_BINARY текущего процесса.
 * Голое слово 'php' полагалось на PATH php-fpm, а там его может не быть: команда
 * молча падала, ответ бота не уходил, и понять это по логам было нельзя.
 *
 * @return bool удалось ли запустить (false — вызывающий шлёт синхронно)
 */
function _vk_spawn_delayed(int $peer, int $delay, string $text): bool {
    if (!function_exists('exec')) return false;
    $bin = trim((string) cfgv('php_bin', ''));
    if ($bin === '' || !is_executable($bin)) $bin = PHP_BINARY ?: 'php';
    // php-fpm отдаёт PHP_BINARY вида /usr/sbin/php-fpm8.3 — им скрипт не запустить.
    if (str_contains(basename($bin), 'fpm')) {
        foreach (['/usr/bin/php', '/usr/local/bin/php'] as $cand) {
            if (is_executable($cand)) { $bin = $cand; break; }
        }
        if (str_contains(basename($bin), 'fpm')) return false;
    }
    $cmd = escapeshellarg($bin) . ' ' . escapeshellarg(BASE_PATH . '/cron/vk_send_delayed.php')
         . ' ' . $peer . ' ' . $delay . ' ' . escapeshellarg(base64_encode($text))
         . ' >/dev/null 2>&1 &';
    $out = []; $rc = 0;
    @exec($cmd, $out, $rc);
    return $rc === 0;
}

/** Гарантируем наличие таблицы chat_messages (та же, что у веб-чата). */
function _vk_bot_ensure_chatlog(): void {
    try {
        q("CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, session_key TEXT, role TEXT, text TEXT,
            file TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )");
    } catch (\Throwable $e) {}
}

/**
 * Извлекает одно медиа-вложение ВК для мультимодального понимания.
 * Возвращает [kind, url, transcript]:
 *   • audio_message → предпочитаем ГОТОВУЮ расшифровку ВК (transcript), иначе link_ogg/link_mp3 → Gemini;
 *   • photo         → URL самого крупного размера (для распознавания диплома/скрина);
 *   • doc           → если это картинка/аудио — его URL.
 * kind ∈ {audio, image, video, ''}. Видео ВК напрямую не качается — пропускаем.
 */
function _vk_extract_media(array $msg): array {
    $atts = $msg['attachments'] ?? [];
    if (!is_array($atts)) return ['', '', ''];
    // 1) Голосовое — приоритет (готовая расшифровка ВК бесплатна и точна).
    foreach ($atts as $a) {
        if (($a['type'] ?? '') === 'audio_message') {
            $am = $a['audio_message'] ?? [];
            $tr = trim((string) ($am['transcript'] ?? ''));
            // transcript_state у ВК — СТРОКА ('in_progress' | 'done'). Здесь стояло
            // сравнение (int)… !== 0, а (int)'done' === 0, поэтому условие не
            // выполнялось никогда: готовая и бесплатная расшифровка ВК отбрасывалась,
            // и каждое голосовое шло на распознавание в Gemini — лишние секунды
            // задержки и лишний расход квоты.
            if ($tr !== '' && (string) ($am['transcript_state'] ?? 'done') !== 'in_progress') {
                return ['audio', '', $tr];
            }
            $url = (string) ($am['link_ogg'] ?? $am['link_mp3'] ?? '');
            if ($url !== '') return ['audio', $url, ''];
        }
    }
    // 2) Фото — крупнейший размер.
    foreach ($atts as $a) {
        if (($a['type'] ?? '') === 'photo') {
            $sizes = $a['photo']['sizes'] ?? [];
            if (is_array($sizes) && $sizes) {
                usort($sizes, fn($x, $y) => ((int) ($y['width'] ?? 0)) <=> ((int) ($x['width'] ?? 0)));
                $url = (string) ($sizes[0]['url'] ?? '');
                if ($url !== '') return ['image', $url, ''];
            }
        }
    }
    // 3) Документ-картинка или документ-аудио.
    foreach ($atts as $a) {
        if (($a['type'] ?? '') === 'doc') {
            $doc = $a['doc'] ?? [];
            $ext = strtolower((string) ($doc['ext'] ?? ''));
            $url = (string) ($doc['url'] ?? '');
            $kind = function_exists('chat_media_kind') ? chat_media_kind($ext) : '';
            if ($kind === '') {
                if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'heic'], true)) $kind = 'image';
                elseif (in_array($ext, ['ogg', 'mp3', 'm4a', 'wav'], true)) $kind = 'audio';
            }
            if ($kind !== '' && $kind !== 'video' && $url !== '') return [$kind, $url, ''];
        }
    }
    return ['', '', ''];
}
