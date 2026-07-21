<?php
/**
 * Telegram Bot API — cURL-обёртки и обработчик входящих апдейтов.
 * Бот: @kc_muz_mir_bot. Все вызовы — тихие фолбэки: если токен пуст
 * или сервис недоступен, функции не бросают исключений и не роняют сайт.
 *
 * Контракт (docs/CONTRACTS.md):
 *   tg_send(chatId, text, opt): array
 *   tg_notify_admin(text): void
 */
declare(strict_types=1);

/** Низкоуровневый вызов метода Bot API через cURL. Тихий фолбэк. */
function tg_api(string $method, array $params = []): array {
    $token = (string) cfgv('tg_bot_token', '');
    if ($token === '') {
        return ['ok' => false, 'error' => 'no_token', 'description' => 'tg_bot_token is empty'];
    }
    $url = "https://api.telegram.org/bot{$token}/{$method}";
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($params, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 12,
        CURLOPT_CONNECTTIMEOUT => 6,
    ]);
    $raw = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($raw === false) {
        return ['ok' => false, 'error' => 'curl', 'description' => $err];
    }
    $data = json_decode((string) $raw, true);
    return is_array($data) ? $data : ['ok' => false, 'error' => 'bad_json', 'raw' => $raw];
}

/**
 * sendMessage. $opt: keyboard => [[['text'=>..,'url'|'callback_data'=>..]], ..],
 * no_preview => bool, reply_to => int, parse_mode => 'HTML'|'' (по умолчанию HTML).
 */
function tg_send(string $chatId, string $text, array $opt = []): array {
    if ($chatId === '') return ['ok' => false, 'error' => 'no_chat'];
    $params = [
        'chat_id' => $chatId,
        'text'    => $text,
    ];
    if (!array_key_exists('parse_mode', $opt) || $opt['parse_mode'] !== '') {
        $params['parse_mode'] = $opt['parse_mode'] ?? 'HTML';
    }
    if (!empty($opt['no_preview'])) {
        $params['link_preview_options'] = ['is_disabled' => true];
    }
    if (!empty($opt['reply_to'])) {
        $params['reply_parameters'] = ['message_id' => (int) $opt['reply_to']];
    }
    if (!empty($opt['keyboard']) && is_array($opt['keyboard'])) {
        $params['reply_markup'] = ['inline_keyboard' => $opt['keyboard']];
    } elseif (isset($opt['reply_markup']) && is_array($opt['reply_markup'])) {
        $params['reply_markup'] = $opt['reply_markup'];
    }
    return tg_api('sendMessage', $params);
}

/** sendPhoto. $photo — URL или file_id. $opt: caption, keyboard. */
function tg_send_photo(string $chatId, string $photo, array $opt = []): array {
    if ($chatId === '' || $photo === '') return ['ok' => false, 'error' => 'no_args'];
    $params = ['chat_id' => $chatId, 'photo' => $photo];
    if (!empty($opt['caption'])) {
        $params['caption'] = $opt['caption'];
        $params['parse_mode'] = $opt['parse_mode'] ?? 'HTML';
    }
    if (!empty($opt['keyboard']) && is_array($opt['keyboard'])) {
        $params['reply_markup'] = ['inline_keyboard' => $opt['keyboard']];
    }
    return tg_api('sendPhoto', $params);
}

/** Уведомление администратора (cfgv('tg_admin_chat')). Тихо. */
function tg_notify_admin(string $text): void {
    $admin = (string) cfgv('tg_admin_chat', '');
    if ($admin === '') return;
    tg_send($admin, $text, ['no_preview' => true]);
}

/** answerCallbackQuery — закрыть «часики» на inline-кнопке. */
function tg_answer_callback(string $callbackId, string $text = '', bool $alert = false): array {
    if ($callbackId === '') return ['ok' => false, 'error' => 'no_id'];
    $params = ['callback_query_id' => $callbackId];
    if ($text !== '') { $params['text'] = $text; $params['show_alert'] = $alert; }
    return tg_api('answerCallbackQuery', $params);
}

/** setWebhook на переданный URL. */
function tg_set_webhook(string $url): array {
    if ($url === '') return ['ok' => false, 'error' => 'no_url'];
    return tg_api('setWebhook', [
        'url' => $url,
        'allowed_updates' => ['message', 'callback_query'],
        'drop_pending_updates' => true,
    ]);
}

/**
 * Проверка Telegram WebApp initData (HMAC по bot_token).
 * Возвращает массив user (id, first_name, ...) при валидной подписи, иначе null.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
function tg_check_init_data(string $initData): ?array {
    $token = (string) cfgv('tg_bot_token', '');
    if ($token === '' || $initData === '') return null;

    parse_str($initData, $pairs);
    if (!isset($pairs['hash'])) return null;
    $hash = (string) $pairs['hash'];
    unset($pairs['hash']);

    // Проверка свежести (не старше 24ч), если auth_date есть.
    if (isset($pairs['auth_date'])) {
        $authDate = (int) $pairs['auth_date'];
        if ($authDate > 0 && (time() - $authDate) > 86400) return null;
    }

    ksort($pairs);
    $chunks = [];
    foreach ($pairs as $k => $v) $chunks[] = $k . '=' . $v;
    $dataCheckString = implode("\n", $chunks);

    $secretKey  = hash_hmac('sha256', $token, 'WebAppData', true);
    $calculated = hash_hmac('sha256', $dataCheckString, $secretKey);
    if (!hash_equals($calculated, $hash)) return null;

    $user = null;
    if (isset($pairs['user'])) {
        $decoded = json_decode((string) $pairs['user'], true);
        if (is_array($decoded)) $user = $decoded;
    }
    return $user;
}

/* ─────────────────────────── Обработка апдейтов ─────────────────────────── */

/** Клавиатура с кнопкой запуска Mini App. */
function tg_webapp_keyboard(): array {
    return [[[ 'text' => 'Открыть конкурсы', 'web_app' => ['url' => rtrim((string) cfgv('base_url'), '/') . '/tma'] ]]];
}

/**
 * Точка входа для webhook_telegram.php (его создаёт API-агент):
 *   $update = json_decode(file_get_contents('php://input'), true);
 *   tg_handle_update($update);
 * Никогда не бросает — все ветки в try/catch, тихий фолбэк.
 */
function tg_handle_update(array $update): void {
    try {
        if (isset($update['callback_query'])) {
            tg_handle_callback($update['callback_query']);
            return;
        }
        $msg = $update['message'] ?? $update['edited_message'] ?? null;
        if (!$msg || !isset($msg['chat']['id'])) return;

        $chatId = (string) $msg['chat']['id'];
        $from   = $msg['from'] ?? [];
        $tgId   = (string) ($from['id'] ?? '');
        $text   = trim((string) ($msg['text'] ?? ''));

        // Связываем tg_id пользователя при любом контакте (если такой юзер есть).
        tg_touch_user($tgId, $from);

        // Команда без учёта @botname и аргументов.
        $cmd = '';
        if ($text !== '' && $text[0] === '/') {
            $cmd = strtolower(explode(' ', ltrim(explode('@', $text)[0], '/'))[0]);
        }

        switch ($cmd) {
            case 'start':   tg_cmd_start($chatId, $from);   break;
            case 'help':    tg_cmd_help($chatId);           break;
            case 'apply':   tg_cmd_apply($chatId);          break;
            case 'my':      tg_cmd_my($chatId, $tgId);      break;
            case 'support': tg_cmd_support($chatId, $from, $text); break;
            default:        tg_cmd_fallback($chatId, $text); break;
        }
    } catch (\Throwable $e) {
        // Тихо: webhook всегда должен вернуть 200, чтобы Telegram не долбил ретраями.
        if (function_exists('error_log')) error_log('tg_handle_update: ' . $e->getMessage());
    }
}

function tg_handle_callback(array $cb): void {
    $id     = (string) ($cb['id'] ?? '');
    $chatId = (string) ($cb['message']['chat']['id'] ?? '');
    $data   = (string) ($cb['data'] ?? '');

    // Подтверждение/отклонение шаблона диплома: approve_diploma_{id} / reject_diploma_{id}.
    if (preg_match('/^(approve|reject)_diploma_(\d+)$/', $data, $m)) {
        tg_diploma_decision($id, $chatId, $m[1] === 'approve', (int) $m[2]);
        return;
    }

    tg_answer_callback($id);
    if ($chatId === '') return;
    switch ($data) {
        case 'help':  tg_cmd_help($chatId);  break;
        case 'apply': tg_cmd_apply($chatId); break;
        default: /* no-op */ break;
    }
}

/** Подтвердить или отклонить шаблон диплома из inline-кнопки бота. */
function tg_diploma_decision(string $callbackId, string $chatId, bool $approve, int $cid): void {
    if (!function_exists('one') || !function_exists('update')) {
        tg_answer_callback($callbackId, 'База недоступна.', true);
        return;
    }
    $c = one("SELECT id,name FROM competitions WHERE id=?", [$cid]);
    if (!$c) {
        tg_answer_callback($callbackId, 'Конкурс не найден.', true);
        return;
    }
    update('competitions', ['diploma_approved' => $approve ? 1 : 0], 'id=:wid', ['wid' => $cid]);
    if (function_exists('audit')) {
        audit($approve ? 'diploma_approve' : 'diploma_unapprove', 'competition', $cid, ['via' => 'telegram']);
    }
    $name = strip_tags((string) $c['name']);
    tg_answer_callback($callbackId, $approve ? 'Шаблон подтверждён.' : 'Шаблон отклонён.', true);
    if ($chatId !== '') {
        $text = $approve
            ? ('Шаблон диплома подтверждён для конкурса «' . h($name) . '». Массовая генерация разблокирована.')
            : ('Шаблон диплома отклонён для конкурса «' . h($name) . '». Массовая генерация заблокирована.');
        tg_send($chatId, $text, ['no_preview' => true]);
    }
}

/** Обновить tg_id у пользователя, если он найден по tg_id (идемпотентно). */
function tg_touch_user(string $tgId, array $from): void {
    if ($tgId === '' || !function_exists('one')) return;
    try {
        $u = one("SELECT id FROM users WHERE tg_id=?", [$tgId]);
        if ($u) return; // уже связан
        // Если пользователь ещё не связан — ничего не создаём; связка идёт из Mini App/кабинета.
    } catch (\Throwable $e) { /* тихо */ }
}

function tg_cmd_start(string $chatId, array $from): void {
    $name = trim((string) ($from['first_name'] ?? ''));
    $hi   = $name !== '' ? ('Здравствуйте, ' . h($name) . '!') : 'Здравствуйте!';
    $org  = h((string) cfgv('org_name', 'КЦ «Музыкальный Мир»'));
    $text = $hi . "\n\n"
          . "Это бот " . $org . " - международные и всероссийские онлайн-конкурсы "
          . "и фестивали культуры и искусства.\n\n"
          . "Нажмите кнопку ниже, чтобы открыть конкурсы прямо в Telegram, "
          . "или используйте команды:\n"
          . "/apply - подать заявку\n"
          . "/my - мои заявки\n"
          . "/help - помощь\n"
          . "/support - написать в оргкомитет";
    tg_send($chatId, $text, ['keyboard' => tg_webapp_keyboard(), 'no_preview' => true]);
}

function tg_cmd_help(string $chatId): void {
    $base = rtrim((string) cfgv('base_url'), '/');
    $text = "<b>Помощь</b>\n\n"
          . "/start - главное меню и запуск приложения\n"
          . "/apply - подать заявку на конкурс\n"
          . "/my - статус Ваших заявок\n"
          . "/support - связаться с оргкомитетом\n\n"
          . "Сайт: " . h($base) . "\n"
          . "Телефон: " . h((string) cfgv('org_phone', ''));
    tg_send($chatId, $text, [
        'no_preview' => true,
        'keyboard'   => [
            [['text' => 'Подать заявку', 'callback_data' => 'apply']],
            [['text' => 'Открыть приложение', 'web_app' => ['url' => $base . '/tma']]],
        ],
    ]);
}

function tg_cmd_apply(string $chatId): void {
    $base = rtrim((string) cfgv('base_url'), '/');
    $text = "Подать заявку можно на сайте или прямо в приложении.\n\n"
          . "Форма заявки: " . h($base . '/apply');
    tg_send($chatId, $text, [
        'no_preview' => true,
        'keyboard'   => [
            [['text' => 'Открыть форму заявки', 'web_app' => ['url' => $base . '/tma']]],
            [['text' => 'Открыть на сайте', 'url' => $base . '/apply']],
        ],
    ]);
}

/** Статус заявок пользователя по tg_id. */
function tg_cmd_my(string $chatId, string $tgId): void {
    if ($tgId === '' || !function_exists('all')) {
        tg_send($chatId, 'Не удалось определить Ваш профиль. Откройте приложение через /start.');
        return;
    }
    $rows = [];
    try {
        $rows = all(
            "SELECT a.number, a.work_title, a.nomination, a.status, a.result, c.name AS comp
               FROM applications a
               JOIN users u ON u.id = a.user_id
          LEFT JOIN competitions c ON c.id = a.competition_id
              WHERE u.tg_id = ?
           ORDER BY a.created_at DESC
              LIMIT 20",
            [$tgId]
        );
    } catch (\Throwable $e) { $rows = []; }

    if (!$rows) {
        $base = rtrim((string) cfgv('base_url'), '/');
        tg_send($chatId, "У Вас пока нет заявок.\n\nПодать первую: " . h($base . '/apply'), [
            'no_preview' => true,
            'keyboard'   => [[['text' => 'Подать заявку', 'web_app' => ['url' => $base . '/tma']]]],
        ]);
        return;
    }

    $labels = [
        'new' => 'принята', 'paid' => 'оплачена', 'judging' => 'на оценке жюри',
        'graded' => 'оценена', 'sent' => 'диплом отправлен', 'rejected' => 'отклонена',
    ];
    $lines = ["<b>Ваши заявки</b>\n"];
    foreach ($rows as $r) {
        $st = $labels[$r['status']] ?? (string) $r['status'];
        $line = '№ ' . h((string) $r['number']);
        if (!empty($r['comp']))       $line .= ' - ' . h((string) $r['comp']);
        if (!empty($r['work_title'])) $line .= "\n" . h((string) $r['work_title']);
        $line .= "\nСтатус: " . h($st);
        if (!empty($r['result']))     $line .= ', результат: ' . h((string) $r['result']);
        $lines[] = $line;
    }
    tg_send($chatId, implode("\n\n", $lines), ['no_preview' => true]);
}

/** Сообщение в поддержку — уведомляем админа, подтверждаем пользователю. */
function tg_cmd_support(string $chatId, array $from, string $text): void {
    $body = trim(preg_replace('/^\/support(@\S+)?/i', '', $text) ?? '');
    $who  = trim(((string)($from['first_name'] ?? '')) . ' ' . ((string)($from['last_name'] ?? '')));
    $un   = !empty($from['username']) ? ('@' . $from['username']) : '';
    if ($body === '') {
        tg_send($chatId, "Напишите вопрос одним сообщением после команды, например:\n/support Когда будут результаты конкурса?");
        return;
    }
    tg_notify_admin(
        "Обращение из бота\n"
        . "От: " . trim($who . ' ' . $un) . " (id " . (string)($from['id'] ?? '?') . ")\n"
        . "chat_id: " . $chatId . "\n\n"
        . $body
    );
    tg_send($chatId, 'Спасибо, обращение передано в оргкомитет. Мы ответим в рабочее время: '
        . h((string) cfgv('org_hours', '')) . '.');
}

function tg_cmd_fallback(string $chatId, string $text): void {
    if ($text !== '' && $text[0] === '/') {
        tg_send($chatId, "Не знаю такой команды. Наберите /help.");
        return;
    }
    $base = rtrim((string) cfgv('base_url'), '/');
    tg_send($chatId, "Чтобы открыть конкурсы, нажмите кнопку ниже или наберите /help.", [
        'keyboard' => [[['text' => 'Открыть приложение', 'web_app' => ['url' => $base . '/tma']]]],
    ]);
}
