<?php
/**
 * Почтовый модуль КЦ «Музыкальный Мир».
 * Отправка через Gmail SMTP по cURL (smtps://smtp.gmail.com:465), очередь писем,
 * рендер премиум HTML-шаблонов. Все ошибки — тихие, наружу только bool/int.
 * Контракт: см. docs/CONTRACTS.md (раздел mailer).
 */
declare(strict_types=1);

/** Тихий лог почты в data/logs/mail.log. */
function mail_log(string $msg): void {
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
    @file_put_contents(BASE_PATH . '/data/logs/mail.log', $line, FILE_APPEND | LOCK_EX);
}

/** MIME encoded-word для не-ASCII заголовков (Subject, имя отправителя). */
function mail_encode_header(string $s): string {
    if (preg_match('/^[\x20-\x7E]*$/', $s)) return $s;         // чистый ASCII — как есть
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

/** Собирает готовое MIME-письмо (multipart) с HTML и опциональным вложением. */
function mail_build_mime(string $fromName, string $fromEmail, string $to, string $replyTo,
                         string $subject, string $html, string $attach = ''): string {
    $eol = "\r\n";
    $boundary = 'mm_' . bin2hex(random_bytes(12));
    $fromH = mail_encode_header($fromName) . ' <' . $fromEmail . '>';

    $headers  = 'From: ' . $fromH . $eol;
    $headers .= 'To: ' . $to . $eol;
    if ($replyTo !== '') $headers .= 'Reply-To: ' . $replyTo . $eol;
    $headers .= 'Subject: ' . mail_encode_header($subject) . $eol;
    $headers .= 'Date: ' . date('r') . $eol;
    $headers .= 'Message-ID: <' . bin2hex(random_bytes(12)) . '@musmir>' . $eol;
    $headers .= 'MIME-Version: 1.0' . $eol;

    // Текстовая версия — грубый фолбэк из HTML.
    $plain = trim(preg_replace('/\s+/u', ' ', html_entity_decode(
        strip_tags(preg_replace('/<(br|\/p|\/div|\/tr|\/h[1-6])>/i', "\n", $html)),
        ENT_QUOTES, 'UTF-8')));

    $hasAttach = $attach !== '' && is_file($attach) && is_readable($attach);

    if ($hasAttach) {
        $altBoundary = 'alt_' . bin2hex(random_bytes(8));
        $headers .= 'Content-Type: multipart/mixed; boundary="' . $boundary . '"' . $eol;

        $body  = '--' . $boundary . $eol;
        $body .= 'Content-Type: multipart/alternative; boundary="' . $altBoundary . '"' . $eol . $eol;
        $body .= mail_mime_part($altBoundary, 'text/plain; charset=UTF-8', $plain);
        $body .= mail_mime_part($altBoundary, 'text/html; charset=UTF-8', $html);
        $body .= '--' . $altBoundary . '--' . $eol . $eol;

        $data = (string) @file_get_contents($attach);
        $fname = mail_encode_header(basename($attach));
        $mime  = function_exists('finfo_open')
            ? (finfo_file(finfo_open(FILEINFO_MIME_TYPE), $attach) ?: 'application/octet-stream')
            : 'application/octet-stream';
        $body .= '--' . $boundary . $eol;
        $body .= 'Content-Type: ' . $mime . '; name="' . $fname . '"' . $eol;
        $body .= 'Content-Transfer-Encoding: base64' . $eol;
        $body .= 'Content-Disposition: attachment; filename="' . $fname . '"' . $eol . $eol;
        $body .= chunk_split(base64_encode($data)) . $eol;
        $body .= '--' . $boundary . '--' . $eol;
    } else {
        $headers .= 'Content-Type: multipart/alternative; boundary="' . $boundary . '"' . $eol;
        $body  = mail_mime_part($boundary, 'text/plain; charset=UTF-8', $plain);
        $body .= mail_mime_part($boundary, 'text/html; charset=UTF-8', $html);
        $body .= '--' . $boundary . '--' . $eol;
    }

    return $headers . $eol . $body;
}

/** Одна MIME-часть (base64). */
function mail_mime_part(string $boundary, string $ctype, string $content): string {
    $eol = "\r\n";
    return '--' . $boundary . $eol
        . 'Content-Type: ' . $ctype . $eol
        . 'Content-Transfer-Encoding: base64' . $eol . $eol
        . chunk_split(base64_encode($content)) . $eol;
}

/**
 * Отправка письма через Gmail SMTP (cURL, smtps://…:465).
 * @param array $opt ['attach'=>путь, 'reply_to'=>адрес, 'from_name'=>имя]
 */
function mail_send(string $to, string $subject, string $html, array $opt = []): bool {
    $to = trim($to);
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        mail_log('SKIP bad recipient: ' . $to);
        return false;
    }

    $user = (string) cfgv('smtp_user');
    $pass = (string) cfgv('smtp_pass');
    $host = (string) cfgv('smtp_host', 'smtp.gmail.com');
    $port = (int) cfgv('smtp_port', 465);
    if ($user === '' || $pass === '') {
        mail_log('SKIP no SMTP credentials for ' . $to);
        return false;
    }

    $fromName = (string) ($opt['from_name'] ?? cfgv('mail_from_name', 'КЦ «Музыкальный Мир»'));
    $replyTo  = (string) ($opt['reply_to'] ?? cfgv('mail_reply_to', ''));
    $attach   = (string) ($opt['attach'] ?? '');

    $mime = mail_build_mime($fromName, $user, $to, $replyTo, $subject, $html, $attach);

    // Тело письма читаем cURL'ом из потока в памяти.
    $stream = fopen('php://temp', 'r+');
    fwrite($stream, $mime);
    rewind($stream);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => 'smtps://' . $host . ':' . $port,
        CURLOPT_USE_SSL        => CURLUSESSL_ALL,
        CURLOPT_USERNAME       => $user,
        CURLOPT_PASSWORD       => $pass,
        CURLOPT_MAIL_FROM      => '<' . $user . '>',
        CURLOPT_MAIL_RCPT      => ['<' . $to . '>'],
        CURLOPT_UPLOAD         => true,
        CURLOPT_INFILE         => $stream,
        CURLOPT_INFILESIZE     => strlen($mime),
        CURLOPT_READFUNCTION   => function ($ch, $fd, $len) use ($stream) {
            return fread($stream, $len);
        },
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $ok  = curl_exec($ch) !== false;
    $err = curl_error($ch);
    curl_close($ch);
    if (is_resource($stream)) fclose($stream);

    if ($ok) {
        mail_log('SENT to ' . $to . ' | ' . $subject);
    } else {
        mail_log('FAIL to ' . $to . ' | ' . $subject . ' | ' . $err);
    }
    return $ok;
}

/** Кладёт письмо в очередь mail_queue (реальная отправка — воркером). */
function mail_queue(string $to, string $name, string $subject, string $html, string $attach = ''): int {
    try {
        return insert('mail_queue', [
            'to_email' => trim($to),
            'to_name'  => $name,
            'subject'  => $subject,
            'body'     => $html,
            'attach'   => $attach,
            'status'   => 'queued',
        ]);
    } catch (\Throwable $e) {
        mail_log('QUEUE FAIL ' . $to . ' | ' . $e->getMessage());
        return 0;
    }
}

/**
 * Рендер фрагмента templates/emails/$name.php в скоупе $vars и обёртка
 * в премиум HTML-лейаут письма (тёплая палитра, логотип, подвал, unsubscribe).
 */
function mail_template(string $name, array $vars = []): string {
    $file = BASE_PATH . '/templates/emails/' . preg_replace('/[^a-z0-9_]/', '', $name) . '.php';
    $inner = '';
    if (is_file($file)) {
        extract($vars, EXTR_SKIP);
        ob_start();
        include $file;
        $inner = (string) ob_get_clean();
    } else {
        mail_log('TEMPLATE MISSING: ' . $name);
        $inner = '<p style="margin:0">' . h((string)($vars['message'] ?? '')) . '</p>';
    }

    $logo   = logo_data_uri();
    $org    = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
    $addr   = h((string) cfgv('org_address', ''));
    $phone  = h((string) cfgv('org_phone', ''));
    $email  = h((string) cfgv('org_email', ''));
    $hours  = h((string) cfgv('org_hours', ''));
    $year   = (int) cfgv('year', (int) date('Y'));
    $unsub  = $vars['unsubscribe_url'] ?? '{{unsubscribe_url}}';
    $preheader = h((string) ($vars['preheader'] ?? ''));

    return <<<HTML
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>{$org}</title>
</head>
<body style="margin:0;padding:0;background:#f0e6d6;font-family:'Segoe UI',Arial,sans-serif;color:#3a2e22;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{$preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0e6d6;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#fbf6ef;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(90,50,20,.14);">

  <tr>
    <td style="background:linear-gradient(135deg,#7a2e1e 0%,#a0522d 55%,#b8860b 100%);padding:34px 40px;text-align:center;">
      <img src="{$logo}" alt="{$org}" width="96" height="96" style="display:inline-block;width:96px;height:96px;border-radius:14px;background:#fff;padding:6px;">
      <div style="margin-top:14px;color:#fff;font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;">Культурный центр «Музыкальный Мир»</div>
    </td>
  </tr>

  <tr>
    <td style="padding:40px 44px 30px;font-size:16px;line-height:1.7;color:#3a2e22;">
      {$inner}
    </td>
  </tr>

  <tr><td style="padding:0 44px;"><div style="height:1px;background:#e6d6bf;"></div></td></tr>

  <tr>
    <td style="padding:26px 44px 34px;font-size:13px;line-height:1.65;color:#8a7658;">
      <div style="font-weight:600;color:#7a2e1e;font-size:14px;margin-bottom:8px;">{$org}</div>
      <div>{$addr}</div>
      <div>Телефон: {$phone}</div>
      <div>Почта: {$email}</div>
      <div>Режим работы: {$hours}</div>
      <div style="margin-top:18px;font-size:12px;color:#a8977c;">
        Вы получили это письмо, так как оставили заявку или подписку на сайте центра.
        <a href="{$unsub}" style="color:#a0522d;text-decoration:underline;">Отписаться от рассылки</a>.
      </div>
      <div style="margin-top:10px;font-size:12px;color:#bfae92;">© {$year} {$org}</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>
HTML;
}
