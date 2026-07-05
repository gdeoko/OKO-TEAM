<?php
/* ============================================================
   PandaGo Order - общая библиотека
   ============================================================ */

/* ─── Работа с data.json (с блокировкой) ─── */
function data_read(): array {
    if (!file_exists(DATA_FILE)) {
        data_write(data_default());
    }
    $raw = file_get_contents(DATA_FILE);
    $d = json_decode($raw, true);
    if (!is_array($d)) $d = data_default();
    /* доливаем дефолты */
    foreach (data_default() as $k => $v) {
        if (!isset($d[$k])) $d[$k] = $v;
    }
    return $d;
}

function data_write(array $d): bool {
    $fp = fopen(LOCK_FILE, 'c');
    if (!$fp) return false;
    if (!flock($fp, LOCK_EX)) { fclose($fp); return false; }
    $ok = file_put_contents(
        DATA_FILE,
        json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
    );
    flock($fp, LOCK_UN);
    fclose($fp);
    return $ok !== false;
}

function data_default(): array {
    return [
        'leads'    => [],
        'events'   => [],
        'promos'   => [],
        'admins'   => ADMINS,
        'content'  => [],
        'settings' => [
            'rate'       => DEFAULT_RATE,
            'rateUpdate' => time(),
            'adminEmail' => '',
        ],
        'stats'    => [
            'leadsTotal' => 0,
        ],
        'rate_limits' => [],
        'nudge_last'  => 0,
        'digest_last' => 0,
    ];
}

/* ─── Клиентский IP ─── */
function client_ip(): string {
    $keys = ['HTTP_CF_CONNECTING_IP','HTTP_X_FORWARDED_FOR','REMOTE_ADDR'];
    foreach ($keys as $k) {
        if (!empty($_SERVER[$k])) {
            $ip = trim(explode(',', $_SERVER[$k])[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return '0.0.0.0';
}

/* ─── Rate limit (в памяти data.json, per-key) ─── */
function rate_limited(string $key, int $max, int $window): bool {
    $d = data_read();
    $now = time();
    $rl = $d['rate_limits'] ?? [];
    /* очистка старых */
    foreach ($rl as $k => $v) {
        if ($v['exp'] < $now) unset($rl[$k]);
    }
    if (!isset($rl[$key])) {
        $rl[$key] = ['cnt' => 1, 'exp' => $now + $window];
        $d['rate_limits'] = $rl;
        data_write($d);
        return false;
    }
    $rl[$key]['cnt']++;
    $d['rate_limits'] = $rl;
    data_write($d);
    return $rl[$key]['cnt'] > $max;
}

/* ─── Админ-токен ─── */
function require_admin_token(): void {
    $t = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ($_GET['token'] ?? '');
    if (!hash_equals(ADMIN_TOKEN, (string)$t)) {
        http_response_code(401);
        echo json_encode(['ok'=>false,'err'=>'unauthorized']);
        exit;
    }
}

/* ─── Нормализация контактов ─── */
function normalize_phone(string $s): string {
    $s = preg_replace('/[^\d+]/', '', $s);
    if (strlen($s) < 6) return '';
    if (str_starts_with($s, '8')) $s = '+7'.substr($s, 1);
    if (!str_starts_with($s, '+') && strlen($s) === 11) $s = '+'.$s;
    return substr($s, 0, 20);
}

function normalize_tg(string $s): string {
    $s = trim($s);
    if (!$s) return '';
    if (str_starts_with($s, 'https://t.me/')) $s = substr($s, 13);
    if (str_starts_with($s, 't.me/'))         $s = substr($s, 5);
    if (str_starts_with($s, '@'))             $s = substr($s, 1);
    $s = preg_replace('/[^A-Za-z0-9_]/', '', $s);
    return $s ? '@'.$s : '';
}

function normalize_email(string $s): string {
    $s = trim(strtolower($s));
    return filter_var($s, FILTER_VALIDATE_EMAIL) ? $s : '';
}

/* ─── Форматирование уведомлений ─── */
function format_lead_notification(array $l): string {
    $t = "Новая заявка · {$l['id']}\n";
    $t .= date('d.m.Y H:i', $l['ts'])." МСК\n\n";
    $t .= "Имя: {$l['name']}\n";
    if ($l['phone']) $t .= "Тел: {$l['phone']}\n";
    if ($l['tg'])    $t .= "TG:  {$l['tg']}\n";
    if ($l['email']) $t .= "Email: {$l['email']}\n";
    $t .= "\n{$l['service']}\n";
    if ($l['msg']) {
        $t .= "\n".$l['msg']."\n";
    }
    if ($l['ref']) $t .= "\nИсточник: ".$l['ref'];
    return $t;
}

function tg_inline_lead_actions(string $id): array {
    return [
        'inline_keyboard' => [
            [
                ['text'=>'Взял в работу', 'callback_data'=>"lead:in_progress:$id"],
                ['text'=>'Закрыл',        'callback_data'=>"lead:done:$id"],
            ],
            [
                ['text'=>'В корзину',     'callback_data'=>"lead:trash:$id"],
                ['text'=>'Заметка',       'callback_data'=>"lead:note:$id"],
            ],
        ],
    ];
}

/* ─── Telegram API ─── */
function tg_api(string $method, array $params = []): array {
    $url = 'https://api.telegram.org/bot'.TG_BOT_TOKEN.'/'.$method;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($params),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 4,
    ]);
    $r = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) return ['ok'=>false,'err'=>$err];
    $j = json_decode($r, true);
    return is_array($j) ? $j : ['ok'=>false,'err'=>'bad_response'];
}

function tg_send(int $chatId, string $text, ?array $keyboard = null): bool {
    $p = [
        'chat_id' => $chatId,
        'text'    => $text,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => 'true',
    ];
    if ($keyboard) $p['reply_markup'] = json_encode($keyboard, JSON_UNESCAPED_UNICODE);
    $r = tg_api('sendMessage', $p);
    return !empty($r['ok']);
}

function tg_answer_callback(string $callbackId, string $text = ''): void {
    tg_api('answerCallbackQuery', [
        'callback_query_id' => $callbackId,
        'text'              => $text,
    ]);
}

function tg_broadcast_admins(string $text, ?array $keyboard = null): void {
    foreach (ADMINS as $a) {
        tg_send($a['id'], htmlspecialchars($text, ENT_QUOTES, 'UTF-8'), $keyboard);
    }
}

/* Отправка по @username - работает только если пользователь писал боту.
   Ищем chat_id в data по этому username. */
function tg_send_to_username(string $username, string $text): bool {
    $u = ltrim($username, '@');
    $d = data_read();
    foreach ($d['leads'] ?? [] as $l) {
        if (ltrim($l['tg'] ?? '', '@') === $u && !empty($l['tg_chat_id'])) {
            return tg_send((int)$l['tg_chat_id'], $text);
        }
    }
    return false;
}

function is_admin_id(int $id): bool {
    foreach (ADMINS as $a) if ($a['id'] === $id) return true;
    return false;
}

/* ─── Email (best-effort через mail()) ─── */
function mail_send(string $to, string $subject, string $body): bool {
    $headers = [
        'From: '.SMTP_FROM_NAME.' <'.SMTP_FROM.'>',
        'Content-Type: text/plain; charset=UTF-8',
        'X-Mailer: PandaGo/1.0',
    ];
    return @mail($to, $subject, $body, implode("\r\n", $headers));
}
