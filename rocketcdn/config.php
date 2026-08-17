<?php
/* ══════════════════════════════════════════════════════════
   Rocket CDN · единый конфиг сайта, админки и бота.

   Секреты сюда не пишем. Реальные значения лежат в
   config.local.php рядом с этим файлом (в git не попадает,
   см. .gitignore и DEPLOY.md).
   ══════════════════════════════════════════════════════════ */

if (!defined('RC_ROOT')) define('RC_ROOT', __DIR__);

/* Файлы данных пишет и веб-сервер, и бот из расписания. Групповая
   запись нужна, чтобы они не мешали друг другу. */
umask(0002);

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


/* ── Хранилище ───────────────────────────────────────────────
   По умолчанию данные лежат рядом с сайтом в папке data и закрыты
   правилами веб-сервера. Если сервер настроить не получается, задайте
   в config.local.php ключ data_dir и уведите папку выше корня сайта. */
define('RC_DATA',   !empty($RC['data_dir']) ? rtrim($RC['data_dir'], '/') : RC_ROOT . '/data');
define('RC_STATS',  RC_DATA . '/stats');
define('RC_LEADS',  RC_DATA . '/leads.json');
define('RC_CONTENT',RC_DATA . '/content.json');
define('RC_STATE',  RC_DATA . '/bot_state.json');
define('RC_LOG',    RC_DATA . '/errors.log');

foreach ([RC_DATA, RC_STATS] as $dir) {
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
}

/* Привязки чата и тем бот записывает сам по команде /bindchat,
   поэтому руками их в конфиг вносить не нужно. */
$__bind = RC_DATA . '/bindings.json';
if (is_file($__bind)) {
    $b = json_decode((string)@file_get_contents($__bind), true);
    if (is_array($b)) foreach ($b as $k => $v) if ($v !== '' && $v !== null) $RC[$k] = $v;
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
/* Запасные адреса api.telegram.org.
   На российских площадках имя нередко резолвится в адрес, до которого
   сети нет. Тогда мы перебираем известные адреса, а найденный рабочий
   запоминаем в data/tg_ip.txt, чтобы следующий вызов шёл сразу по нему. */
function rc_tg_ips() {
    $own = (array)rc_cfg('tg_ips', []);
    $def = ['149.154.167.220', '149.154.167.197', '149.154.175.50',
            '149.154.166.110', '91.108.56.130'];
    return array_values(array_unique(array_merge($own, $def)));
}

function rc_tg_pin_file() { return RC_DATA . '/tg_ip.txt'; }

function rc_tg_pin_get() {
    $f = rc_tg_pin_file();
    if (!is_file($f)) return '';
    $ip = trim((string)@file_get_contents($f));
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '';
}

function rc_tg_pin_set($ip) {
    @file_put_contents(rc_tg_pin_file(), $ip, LOCK_EX);
}

/* $fast - режим перебора: адреса, до которых сети нет, отваливаются
   за три секунды, а не за восемь. На этой площадке из пяти известных
   адресов телеграма отвечает ровно один, и перебор остальных по
   восемь секунд съедал минуту на каждый сбой. */
function rc_tg_call($token, $method, $params, $ip, $fast = false) {
    $ch = curl_init('https://api.telegram.org/bot' . $token . '/' . $method);
    $opt = [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($params, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $fast ? 10 : 25,
        CURLOPT_CONNECTTIMEOUT => $fast ? 3 : 8,
        /* Только IPv4. Резолвер площадки отдаёт для api.telegram.org
           адрес шестой версии, до которого отсюда сети нет, и каждый
           вызов молча висел восемь секунд, пока не упрётся в таймаут. */
        CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
    ];
    if ($ip) $opt[CURLOPT_RESOLVE] = ['api.telegram.org:443:' . $ip];
    if ($px = rc_cfg('tg_proxy')) $opt[CURLOPT_PROXY] = $px;
    curl_setopt_array($ch, $opt);
    $r = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    return [$r, $err];
}

/* Резервный резолвинг через DNS поверх HTTPS.
   Статический список адресов рано или поздно устаревает: телеграм
   меняет узлы. Спрашиваем адрес у публичных резолверов и запоминаем
   ответ на четверть часа, чтобы не дёргать их на каждый вызов. */
function rc_tg_resolve() {
    $cache = RC_DATA . '/tg_dns.json';
    $d = rc_json_read($cache, []);
    if (!empty($d['ips']) && !empty($d['ts']) && (time() - (int)$d['ts']) < 900) {
        return (array)$d['ips'];
    }
    $ips = [];
    $sources = [
        ['https://1.1.1.1/dns-query?name=api.telegram.org&type=A', ['accept: application/dns-json']],
        ['https://dns.google/resolve?name=api.telegram.org&type=A', []],
    ];
    foreach ($sources as $src) {
        $ch = curl_init($src[0]);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_IPRESOLVE      => CURL_IPRESOLVE_V4,
            CURLOPT_HTTPHEADER     => $src[1],
        ]);
        $r = curl_exec($ch);
        curl_close($ch);
        $j = json_decode((string)$r, true);
        foreach ((array)($j['Answer'] ?? []) as $a) {
            $ip = (string)($a['data'] ?? '');
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) $ips[] = $ip;
        }
        if ($ips) break;
    }
    $ips = array_values(array_unique($ips));
    if ($ips) rc_json_write($cache, ['ts' => time(), 'ips' => $ips]);
    return $ips;
}

/* Одна и та же жалоба не должна забивать журнал: повторы копим и
   пишем не чаще раза в четверть часа, с числом попыток. */
function rc_log_rare($key, $msg) {
    $f = RC_DATA . '/log_rare.json';
    $d = rc_json_read($f, []);
    $now = time();
    $rec = $d[$key] ?? ['ts' => 0, 'n' => 0];
    $rec['n']++;
    if ($now - (int)$rec['ts'] >= 900) {
        rc_log($msg . ($rec['n'] > 1 ? ' (повторов с прошлой записи: ' . $rec['n'] . ')' : ''));
        $rec = ['ts' => $now, 'n' => 0];
    }
    $d[$key] = $rec;
    rc_json_write($f, $d);
}

function rc_tg($method, $params = [], $tries = 2) {
    $token = rc_cfg('tg_token');
    if (!$token) return null;
    $err = '';
    $pin = rc_tg_pin_get();
    for ($i = 0; $i < max(1, $tries); $i++) {
        list($r, $err) = rc_tg_call($token, $method, $params, $pin);
        if (!$err) return json_decode($r, true);
        if ($i === 0) usleep(400000);
    }

    /* Обычный путь не сработал: ищем адрес, до которого сеть есть.
       Сначала известные адреса, потом свежие от публичных резолверов -
       список в коде когда-нибудь устареет, а резолвер нет. */
    $tried = [$pin];
    foreach (array_merge(rc_tg_ips(), rc_tg_resolve()) as $ip) {
        if (in_array($ip, $tried, true)) continue;
        $tried[] = $ip;
        list($r, $e2) = rc_tg_call($token, $method, $params, $ip, true);
        if (!$e2) {
            rc_tg_pin_set($ip);
            rc_log('TG: перешли на адрес ' . $ip);
            return json_decode($r, true);
        }
    }
    /* Связь с Телеграмом иногда моргает. В журнал пишем только то,
       что не прошло ни с одного адреса, и не чаще раза в четверть часа. */
    rc_log_rare('tg_' . $method, 'TG ' . $method . ': ' . $err);
    return null;
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

/* ── Состояние площадки в одном месте ─────────────────────────
   Одни и те же цифры нужны трём местам: вкладке «Состояние» в
   админке, ежедневной проверке в cron.php и команде /health в
   боте. Считаем их здесь, чтобы три копии логики не разъехались
   при первой же правке. */
function rc_selftest() {
    $res = [];
    $res['mail_configured'] = (bool)rc_cfg('mail_user') && (bool)rc_cfg('mail_pass');
    $res['tg_configured']   = (bool)rc_cfg('tg_token');
    $res['chat_bound']      = (bool)rc_cfg('tg_chat');
    $res['data_writable']   = is_writable(RC_DATA);

    $st = rc_json_read(RC_DATA . '/cron_state.json', []);
    $res['cron_last']   = (string)($st['daily'] ?? '');
    $res['backup_last'] = (string)($st['backup'] ?? '');
    $bk = glob(RC_DATA . '/backup/*.json');
    $res['backup_count'] = $bk ? count($bk) : 0;

    $store = rc_json_read(RC_LEADS, []);
    $new = 0; $oldest = 0;
    foreach ((array)($store['items'] ?? []) as $l) {
        if (($l['status'] ?? 'new') !== 'new') continue;
        $new++;
        $ts = strtotime((string)($l['ts'] ?? ''));
        if ($ts && (!$oldest || $ts < $oldest)) $oldest = $ts;
    }
    $res['leads_new'] = $new;
    $res['leads_wait_hours'] = $oldest ? (int)round((time() - $oldest) / 3600) : 0;

    /* Дату кладёт корневой скрипт: папку letsencrypt сайту не открываем,
       рядом с сертификатом лежит закрытый ключ */
    $res['cert_days'] = null;
    $cert = rc_json_read(RC_DATA . '/cert.json', []);
    if (!empty($cert['until'])) {
        $res['cert_days'] = (int)floor(((int)$cert['until'] - time()) / 86400);
        $res['cert_names'] = (string)($cert['names'] ?? '');
    }

    $free = @disk_free_space(RC_DATA);
    $res['disk_free_gb'] = $free ? round($free / 1073741824, 1) : null;
    $res['tg_ip'] = function_exists('rc_tg_pin_get') ? rc_tg_pin_get() : '';
    return $res;
}

/* Кто и что менял через бота: правки текстов идут в обход админки,
   и без журнала потом не разобраться, откуда взялась формулировка. */
function rc_admin_log($who, $what, $detail = '') {
    $f = RC_DATA . '/admin_log.json';
    $d = rc_json_read($f, []);
    if (!is_array($d)) $d = [];
    array_unshift($d, [
        'ts' => date('Y-m-d H:i:s'),
        'who' => (string)$who,
        'what' => (string)$what,
        'detail' => mb_substr((string)$detail, 0, 400),
    ]);
    rc_json_write($f, array_slice($d, 0, 300));
}

/* Словарь сайта: сначала правки из админки, потом исходные строки
   из rc-i18n.js. Разбор регулярным выражением намеренно простой -
   файл наш, формат мы держим сами. */
function rc_i18n_ru() {
    $out = [];
    $file = RC_ROOT . '/assets/rc-i18n.js';
    $src = is_file($file) ? (string)@file_get_contents($file) : '';
    $cut = strpos($src, 'var EN');
    if ($cut !== false) $src = substr($src, 0, $cut);
    if (preg_match_all('~"([a-z0-9_.]+)"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"~i', $src, $m, PREG_SET_ORDER)) {
        foreach ($m as $one) {
            $out[$one[1]] = str_replace(['\\"', '\\n'], ['"', "\n"], $one[2]);
        }
    }
    $c = rc_json_read(RC_CONTENT, []);
    foreach ((array)($c['i18n']['ru'] ?? []) as $k => $v) {
        if (is_string($v)) $out[$k] = $v;
    }
    return $out;
}

/* Сохранить одну строку словаря, не трогая остальные */
function rc_i18n_set($key, $value) {
    $c = rc_json_read(RC_CONTENT, []);
    if (!is_array($c)) $c = [];
    if (!isset($c['i18n']) || !is_array($c['i18n'])) $c['i18n'] = [];
    if (!isset($c['i18n']['ru']) || !is_array($c['i18n']['ru'])) $c['i18n']['ru'] = [];
    $c['i18n']['ru'][$key] = $value;
    rc_json_write(RC_CONTENT, $c);
}
