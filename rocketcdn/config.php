<?php
/* ══════════════════════════════════════════════════════════
   Rocket CDN · единый конфиг сайта, админки и бота.

   Секреты сюда не пишем. Реальные значения лежат в
   config.local.php рядом с этим файлом (в git не попадает,
   см. .gitignore и DEPLOY.md).
   ══════════════════════════════════════════════════════════ */

if (!defined('RC_ROOT')) define('RC_ROOT', __DIR__);

/* ── Значения по умолчанию ───────────────────────────────── */
$RC = [
    /* Сайт */
    'site_url'    => 'https://rocketcdn.ru',
    'lk_url'      => 'https://lk.rocketcdn.ru',
    'brand'       => 'Rocket CDN',

    /* Админка: пароль входа. Обязательно сменить на боевом. */
    'admin_key'   => 'rocket2026',

    /* Почта: ящик Gmail и пароль приложения на 16 знаков */
    'mail_user'   => '',
    'mail_pass'   => '',
    'mail_name'   => 'Rocket CDN',
    'mail_to'     => '',          /* куда падают заявки, по умолчанию mail_user */

    /* Телеграм */
    'tg_token'    => '',          /* токен @rocket_cdn_bot */
    'tg_admins'   => [1966985736, 6547482131, 581327337],
    'tg_chat'     => '',          /* id общего чата, заполняется командой /bindchat */
    'tg_topic_form'  => '',       /* id темы «Формы» */
    'tg_topic_error' => '',       /* id темы «Ошибки» */
    'tg_topic_stat'  => '',       /* id темы «Аналитика» */

    /* Аналитика */
    'report_hour' => 9,           /* час ежедневного отчёта, МСК */
    'tz'          => 'Europe/Moscow',
];

/* ── Локальные значения перекрывают дефолтные ────────────── */
if (is_file(__DIR__ . '/config.local.php')) {
    $local = include __DIR__ . '/config.local.php';
    if (is_array($local)) $RC = array_merge($RC, $local);
}
if (empty($RC['mail_to'])) $RC['mail_to'] = $RC['mail_user'];

date_default_timezone_set($RC['tz']);

/* Привязки чата и тем бот записывает сам по команде /bindchat,
   поэтому руками их в конфиг вносить не нужно. */
$__bind = __DIR__ . '/data/bindings.json';
if (is_file($__bind)) {
    $b = json_decode((string)@file_get_contents($__bind), true);
    if (is_array($b)) foreach ($b as $k => $v) if ($v !== '' && $v !== null) $RC[$k] = $v;
}

/* ── Хранилище ───────────────────────────────────────────── */
define('RC_DATA',   RC_ROOT . '/data');
define('RC_STATS',  RC_DATA . '/stats');
define('RC_LEADS',  RC_DATA . '/leads.json');
define('RC_CONTENT',RC_DATA . '/content.json');
define('RC_STATE',  RC_DATA . '/bot_state.json');
define('RC_LOG',    RC_DATA . '/errors.log');

foreach ([RC_DATA, RC_STATS] as $dir) {
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
}

/* ── Мелкие помощники ────────────────────────────────────── */
function rc_cfg($k, $def = null) {
    global $RC;
    return array_key_exists($k, $RC) ? $RC[$k] : $def;
}

function rc_json_read($file, $def = []) {
    if (!is_file($file)) return $def;
    $raw = @file_get_contents($file);
    if ($raw === false || $raw === '') return $def;
    $d = json_decode($raw, true);
    return is_array($d) ? $d : $def;
}

/* Пишем через временный файл и блокировку: параллельные запросы
   не должны затирать данные друг друга. */
function rc_json_write($file, $data) {
    $tmp = $file . '.' . getmypid() . '.tmp';
    $ok = @file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    if ($ok === false) return false;
    return @rename($tmp, $file);
}

/* Атомарное изменение файла под блокировкой */
function rc_json_update($file, callable $fn) {
    $fh = @fopen($file, 'c+');
    if (!$fh) return false;
    @flock($fh, LOCK_EX);
    $raw = stream_get_contents($fh);
    $data = $raw === '' ? [] : (json_decode($raw, true) ?: []);
    $data = $fn($data);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    @flock($fh, LOCK_UN);
    fclose($fh);
    return $data;
}

function rc_log($msg) {
    @file_put_contents(RC_LOG, date('Y-m-d H:i:s') . ' ' . $msg . "\n", FILE_APPEND | LOCK_EX);
}

/* ── Телеграм ────────────────────────────────────────────── */
function rc_tg($method, $params = []) {
    $token = rc_cfg('tg_token');
    if (!$token) return null;
    $ch = curl_init('https://api.telegram.org/bot' . $token . '/' . $method);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($params, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $r = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($err) { rc_log('TG ' . $method . ': ' . $err); return null; }
    return json_decode($r, true);
}

function rc_tg_send($chat, $text, $markup = null, $topic = null) {
    if (!$chat) return null;
    $p = ['chat_id' => $chat, 'text' => $text, 'parse_mode' => 'HTML', 'disable_web_page_preview' => true];
    if ($topic) $p['message_thread_id'] = (int)$topic;
    if ($markup) $p['reply_markup'] = $markup;
    return rc_tg('sendMessage', $p);
}

/* Уведомление в общий чат (в нужную тему) и всем администраторам */
function rc_notify($text, $markup = null, $topic_key = null) {
    $chat = rc_cfg('tg_chat');
    $topic = $topic_key ? rc_cfg($topic_key) : null;
    $sent = false;
    if ($chat) { rc_tg_send($chat, $text, $markup, $topic); $sent = true; }
    if (!$sent) {
        foreach ((array)rc_cfg('tg_admins', []) as $uid) rc_tg_send($uid, $text, $markup);
    }
}

/* ── Почта через SMTP Gmail ──────────────────────────────── */
function rc_mail($to, $subject, $html) {
    $user = rc_cfg('mail_user');
    $pass = rc_cfg('mail_pass');
    $name = rc_cfg('mail_name');
    if (!$to) return false;

    $headers  = 'From: =?UTF-8?B?' . base64_encode($name) . "?= <{$user}>\r\n";
    $headers .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n";

    if ($user && $pass && function_exists('curl_init')) {
        $msg  = "From: =?UTF-8?B?" . base64_encode($name) . "?= <{$user}>\r\n";
        $msg .= "To: {$to}\r\n";
        $msg .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
        $msg .= "Date: " . date('r') . "\r\n";
        $msg .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" . $html;

        $fp = fopen('php://temp', 'rw+');
        fwrite($fp, $msg);
        rewind($fp);
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => 'smtps://smtp.gmail.com:465',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_USERNAME       => $user,
            CURLOPT_PASSWORD       => $pass,
            CURLOPT_MAIL_FROM      => '<' . $user . '>',
            CURLOPT_MAIL_RCPT      => ['<' . $to . '>'],
            CURLOPT_READDATA       => $fp,
            CURLOPT_UPLOAD         => true,
            CURLOPT_TIMEOUT        => 25,
        ]);
        curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);
        fclose($fp);
        if (!$err) return true;
        rc_log('MAIL ' . $err);
    }
    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $html, $headers);
}

/* Фирменный шаблон письма в тёмной гамме бренда */
function rc_mail_tpl($title, $rows, $note = '', $btn = null) {
    $site = rc_cfg('site_url');
    $body = '';
    foreach ($rows as $k => $v) {
        if ($v === '' || $v === null) continue;
        $body .= '<tr>'
            . '<td style="padding:10px 0;border-bottom:1px solid rgba(226,232,240,.10);color:rgba(226,232,240,.55);font-size:13px;width:38%;vertical-align:top">' . htmlspecialchars($k) . '</td>'
            . '<td style="padding:10px 0;border-bottom:1px solid rgba(226,232,240,.10);color:#E2E8F0;font-size:14px;font-weight:600">' . nl2br(htmlspecialchars($v)) . '</td>'
            . '</tr>';
    }
    $btnHtml = '';
    if ($btn) {
        $btnHtml = '<a href="' . htmlspecialchars($btn['url']) . '" style="display:inline-block;margin-top:24px;background:linear-gradient(135deg,#42B2DC,#0A5897);color:#fff;text-decoration:none;padding:14px 28px;border-radius:14px;font-weight:700;font-size:14px">'
            . htmlspecialchars($btn['text']) . '</a>';
    }
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;padding:0;background:#050C15;font-family:Golos Text,Segoe UI,Arial,sans-serif">'
        . '<table width="100%" cellpadding="0" cellspacing="0" style="background:#050C15;padding:28px 14px"><tr><td align="center">'
        . '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#091320;border:1px solid rgba(226,232,240,.10);border-radius:22px;padding:32px">'
        . '<tr><td>'
        . '<div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-.02em">Rocket<span style="color:#42B2DC">CDN</span></div>'
        . '<div style="font-size:10px;letter-spacing:.28em;color:rgba(66,178,220,.75);margin-top:4px">FAST. RELIABLE. GLOBAL.</div>'
        . '<h1 style="font-size:20px;color:#E2E8F0;margin:26px 0 18px;font-weight:700;letter-spacing:-.02em">' . htmlspecialchars($title) . '</h1>'
        . '<table width="100%" cellpadding="0" cellspacing="0">' . $body . '</table>'
        . ($note ? '<p style="color:rgba(226,232,240,.55);font-size:13px;line-height:1.7;margin-top:20px">' . htmlspecialchars($note) . '</p>' : '')
        . $btnHtml
        . '<div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(226,232,240,.10);color:rgba(226,232,240,.35);font-size:11.5px">'
        . '<a href="' . $site . '" style="color:rgba(66,178,220,.8);text-decoration:none">' . preg_replace('~^https?://~', '', $site) . '</a>'
        . ' &middot; ' . date('d.m.Y H:i')
        . '</div></td></tr></table></td></tr></table></body></html>';
}
