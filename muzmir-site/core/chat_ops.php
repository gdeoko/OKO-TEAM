<?php
/**
 * core/chat_ops.php — состояние диалогов чата и правила «живого» оператора.
 * Единый слой для веб-чата (api/v1/chat.php) и ВК (api/v1/webhook_vk.php) + админ-раздела
 * «Чат-бот» (admin/chats.php). Отвечает за:
 *   • per-dialog настройки: бот вкл/выкл, блокировка, ручной перехват оператором;
 *   • рабочие часы (9:00–18:00 МСК, кроме воскресенья) и шаблон вне графика;
 *   • доставку сообщений оператора в нужный канал (ВК — messages.send, сайт — история).
 *
 * Таблица chat_dialogs заводится лениво (chat_ops_boot), core/db.php не трогаем.
 * Файл только определяет функции; ничего не выполняет при require.
 */
declare(strict_types=1);

/** Идемпотентное создание таблицы состояния диалогов. */
function chat_ops_boot(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("
        CREATE TABLE IF NOT EXISTS chat_dialogs (
            session_key   TEXT PRIMARY KEY,
            channel       TEXT DEFAULT 'web',   -- web | vk
            peer_id       TEXT DEFAULT '',      -- для ВК: id собеседника (messages.send)
            title         TEXT DEFAULT '',      -- имя участника (кэш для списка)
            bot_enabled   INTEGER DEFAULT 1,    -- 0 = бот молчит, отвечает только оператор
            blocked       INTEGER DEFAULT 0,    -- 1 = диалог заблокирован (бот молчит совсем)
            operator_until TEXT DEFAULT '',     -- пока now < этого времени — бот молчит (ручной перехват)
            last_admin_at TEXT DEFAULT '',      -- когда оператор в последний раз писал
            pending_offhours INTEGER DEFAULT 0, -- есть вопрос, заданный вне графика (ответить в 9:00)
            offhours_at   TEXT DEFAULT '',      -- когда отправили шаблон «нерабочее время»
            created_at    TEXT DEFAULT (datetime('now','localtime')),
            updated_at    TEXT DEFAULT (datetime('now','localtime'))
        )");
    } catch (\Throwable $e) { /* best-effort */ }
}

/**
 * Сколько минут бот молчит после ответа оператора (ручной перехват).
 * Полчаса — правило владельца: столько длится живой разговор, и всё это время
 * бот в диалог не заходит, даже если человек написал ещё раз.
 */
function chat_takeover_minutes(): int {
    $m = (int) setting('chat_takeover_min', '30');
    return $m > 0 ? min(120, $m) : 30;
}

/** Строка состояния диалога (с дефолтами, если записи ещё нет). */
function chat_dialog_get(string $sessionKey): array {
    chat_ops_boot();
    $def = ['session_key'=>$sessionKey,'channel'=>str_starts_with($sessionKey,'vk_')?'vk':'web',
            'peer_id'=>str_starts_with($sessionKey,'vk_')?substr($sessionKey,3):'','title'=>'',
            'bot_enabled'=>1,'blocked'=>0,'operator_until'=>'','last_admin_at'=>'',
            'pending_offhours'=>0,'offhours_at'=>''];
    try {
        $row = one("SELECT * FROM chat_dialogs WHERE session_key=?", [$sessionKey]);
        if ($row) return array_merge($def, $row);
    } catch (\Throwable $e) {}
    return $def;
}

/** Создать/обновить запись диалога заданными полями. */
function chat_dialog_set(string $sessionKey, array $fields): void {
    chat_ops_boot();
    $channel = str_starts_with($sessionKey, 'vk_') ? 'vk' : 'web';
    $peer    = $channel === 'vk' ? substr($sessionKey, 3) : '';
    try {
        $exists = one("SELECT session_key FROM chat_dialogs WHERE session_key=?", [$sessionKey]);
        if (!$exists) {
            q("INSERT INTO chat_dialogs (session_key, channel, peer_id) VALUES (?,?,?)",
              [$sessionKey, $channel, $peer]);
        }
        if ($fields) {
            $set = []; $vals = [];
            foreach ($fields as $k => $v) { $set[] = "$k=?"; $vals[] = $v; }
            $set[] = "updated_at=datetime('now','localtime')";
            $vals[] = $sessionKey;
            q("UPDATE chat_dialogs SET " . implode(',', $set) . " WHERE session_key=?", $vals);
        }
    } catch (\Throwable $e) { /* best-effort */ }
}

/**
 * Рабочее ли сейчас время центра по Москве.
 *
 * ГРАФИК ЗДЕСЬ ОБЯЗАН СОВПАДАТЬ С ОБЪЯВЛЕННЫМ. Здесь стояло «9:00–18:00, кроме
 * воскресенья» — то есть суббота считалась обычным будним днём. А бот в том же
 * диалоге сообщает график из config.php (org_hours): «Пн–Пт 09:00–18:00,
 * Сб 10:00–16:00». В субботу в 9 утра и в 5 вечера человек получал живой ответ
 * от «закрытого» центра, а в 16:30 — «сейчас нерабочее время», хотя по коду
 * работа шла до 18. Суббота теперь короткая, как и написано на витрине.
 *
 * $ts — необязательная метка (для тестов); по умолчанию — текущее время.
 */
function chat_is_working_hours(?int $ts = null): bool {
    try {
        $tz = new DateTimeZone('Europe/Moscow');
        $dt = new DateTime('@' . ($ts ?? time()));
        $dt->setTimezone($tz);
        $dow  = (int) $dt->format('N');   // 1=Пн … 7=Вс
        $hour = (int) $dt->format('G');
        if ($dow === 7) return false;                    // воскресенье — выходной
        if ($dow === 6) return $hour >= 10 && $hour < 16; // суббота — короткая
        return $hour >= 9 && $hour < 18;                 // будни 9:00–17:59
    } catch (\Throwable $e) {
        return true; // при сбое — не блокируем ответы
    }
}

/** Активен ли ручной перехват оператором (бот должен молчать). */
function chat_operator_active(string $sessionKey): bool {
    $d = chat_dialog_get($sessionKey);
    $until = trim((string) ($d['operator_until'] ?? ''));
    if ($until === '') return false;
    return strtotime($until) > time();
}

/**
 * Бот заглушён для диалога: заблокирован, выключен вручную или активен перехват
 * оператора. Возвращает причину ('blocked'|'disabled'|'operator') или '' если бот отвечает.
 */
function chat_bot_muted(string $sessionKey): string {
    $d = chat_dialog_get($sessionKey);
    if ((int) ($d['blocked'] ?? 0) === 1) return 'blocked';
    if ((int) ($d['bot_enabled'] ?? 1) === 0) return 'disabled';
    if (chat_operator_active($sessionKey)) return 'operator';
    return '';
}

/**
 * Отметить, что оператор только что ответил → включить тишину бота на N минут.
 *
 * И СНЯТЬ ТО, ЧТО БОТ УЖЕ СОБРАЛСЯ СКАЗАТЬ.
 *
 * Ответ обычному участнику ждёт своей очереди пять минут: на сайте — до
 * visible_at, во ВКонтакте — до vk_send_at. Пока он ждёт, оператор успевает
 * ответить сам, и через пару минут поверх живого ответа прилетал ещё и
 * ботовский — по тому же вопросу, другими словами. Человек видел два разных
 * ответа от «центра» подряд.
 *
 * Заглушить бота на будущее мало: снимаем и уже готовые, но не доставленные
 * ответы. Строку не удаляем — меняем роль на 'bot_cancelled': из истории она
 * пропадает (там отбор по user/assistant), в админке видно, что бот собирался
 * ответить и был остановлен, а сторож досылки её больше не подхватит.
 */
function chat_operator_touch(string $sessionKey, ?int $minutes = null): int {
    $min = $minutes ?? chat_takeover_minutes();
    $until = date('Y-m-d H:i:s', time() + $min * 60);
    chat_dialog_set($sessionKey, ['operator_until' => $until, 'last_admin_at' => date('Y-m-d H:i:s')]);
    return chat_cancel_pending_bot($sessionKey);
}

/**
 * Снять неотправленные ответы бота в диалоге. Возвращает, сколько снято.
 * Ответы самого оператора (by_operator=1) не трогаем — они уходят сразу и
 * никакой очереди не ждут.
 */
function chat_cancel_pending_bot(string $sessionKey): int {
    $now = date('Y-m-d H:i:s');
    try {
        $st = q("UPDATE chat_messages
                    SET role='bot_cancelled'
                  WHERE session_key=? AND role='assistant' AND COALESCE(by_operator,0)=0
                    AND ( (COALESCE(visible_at,'') <> '' AND visible_at > ?)
                       OR (COALESCE(vk_send_at,'') <> '' AND vk_send_at > ? AND COALESCE(vk_sent,0)=0) )",
                [$sessionKey, $now, $now]);
        return is_object($st) && method_exists($st, 'rowCount') ? (int) $st->rowCount() : 0;
    } catch (\Throwable $e) { return 0; }
}

/** Шаблон-ответ вне графика работы (вопрос сохраняем, ответим в 9:00). */
function chat_offhours_template(string $name = ''): string {
    $hrs = (string) cfgv('org_hours', 'ежедневно с 9:00 до 18:00 (кроме воскресенья)');
    $hi  = trim($name) !== '' ? ('Здравствуйте, ' . trim($name) . '. ') : 'Здравствуйте. ';
    return $hi . 'Сейчас нерабочее время — мы отвечаем ' . $hrs . ' по московскому времени. '
        . 'Ваше сообщение получено и не потеряется: как только начнётся рабочий день, я обязательно вернусь к Вашему вопросу и всё подробно расскажу. 🙏';
}

/**
 * Доставить сообщение оператора/бота в канал диалога.
 *  • ВК  — отправляем сразу через messages.send (vk_dm_send);
 *  • сайт — сообщение уже в истории chat_messages, клиент подхватит опросом.
 * Возвращает true, если доставка (для ВК) прошла или канал = web.
 */
function chat_channel_send(string $sessionKey, string $text, int $peer = 0): bool {
    $text = trim($text);
    if ($text === '') return false;
    if (str_starts_with($sessionKey, 'vk_')) {
        if (!function_exists('vk_dm_send') && is_file(BASE_PATH . '/core/vk.php')) require_once BASE_PATH . '/core/vk.php';
        if (!function_exists('vk_dm_send')) return false;
        $p = $peer ?: (int) substr($sessionKey, 3);
        try {
            $r = vk_dm_send($p, $text);
            // Успех — это наличие response с id сообщения. Проверка «нет ключа error»
            // считала успехом и пустой ответ, и ответ неизвестной формы: оператор
            // видел зелёное «отправлено» там, где ВК ничего не принял.
            $ok = isset($r['response']);
            if (!$ok && function_exists('_vk_log')) {
                _vk_log('chat_channel_send peer=' . $p . ' не доставлено: '
                        . json_encode($r['error'] ?? $r, JSON_UNESCAPED_UNICODE));
            }
            return $ok;
        }
        catch (\Throwable $e) { return false; }
    }
    return true; // web: доставка через историю
}
