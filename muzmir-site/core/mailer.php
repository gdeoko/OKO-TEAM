<?php
/**
 * Почтовый модуль Культурного центра «Музыкальный Мир».
 * Отправка через Gmail SMTP по cURL (smtps://smtp.gmail.com:465), очередь писем,
 * рендер премиум HTML-шаблонов. Все ошибки — тихие, наружу только bool/int.
 * Контракт: см. docs/CONTRACTS.md (раздел mailer).
 */
declare(strict_types=1);

/* ================= Единый фирменный стиль писем (имперская палитра) =================
 * Синий #17307A, золото #C79322, айвори #FAF4E6. Georgia/Playfair для заголовков,
 * table-вёрстка, все ссылки — только кнопками. Использовать ВЕЗДЕ, где собирается письмо.
 */
const MM_NAVY   = '#17307A';
const MM_NAVY2  = '#24499F';
const MM_GOLD   = '#C79322';
const MM_GOLD2  = '#E3B94F';
const MM_IVORY  = '#FAF4E6';
const MM_INK    = '#1D2B55';
const MM_MUTED  = '#6B7699';
const MM_CARD   = '#F4F6FC';
const MM_LINE   = '#DCE3F3';

/** Абсолютный URL логотипа центра для писем (почтовики режут data:-URI). */
function mm_logo_url(): string {
    $base = rtrim((string) cfgv('base_url', ''), '/');
    if ($base === '' || stripos($base, 'localhost') !== false || stripos($base, '127.0.0.1') !== false) {
        $base = 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai';
    }
    return $base . '/assets/img/logo_muzmir_256.png';
}

/**
 * Фирменная кнопка письма (table-обёртка — стабильно во всех почтовиках).
 * $variant: 'gold' (золотой градиент, синий текст) | 'navy' (синий градиент, золотой текст).
 */
function mm_email_btn(string $href, string $label, string $variant = 'gold'): string {
    if ($variant === 'navy') {
        $bg = 'background:' . MM_NAVY . ';background:linear-gradient(135deg,' . MM_NAVY . ',' . MM_NAVY2 . ');';
        $color = MM_GOLD2;
    } else {
        $bg = 'background:' . MM_GOLD . ';background:linear-gradient(135deg,' . MM_GOLD . ',' . MM_GOLD2 . ');';
        $color = MM_NAVY;
    }
    return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">'
        . '<tr><td style="border-radius:12px;' . $bg . '">'
        . '<a href="' . h($href) . '" style="display:inline-block;padding:14px 36px;color:' . $color . ';'
        . 'text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.02em;border-radius:12px;">'
        . h($label) . '</a></td></tr></table>';
}

/**
 * Единый фирменный лейаут письма: шапка с логотипом на синем градиенте,
 * белая карточка контента, подвал с контактами. Все письма сайта — только через него.
 * $opt: preheader, unsubscribe_url (ссылка отписки в подвале, иначе строка без ссылки),
 *       pixel (HTML пикселя открытия), audience_note (пояснение в подвале).
 */
function mm_email_layout(string $inner, array $opt = []): string {
    $navy = MM_NAVY; $navy2 = MM_NAVY2; $gold = MM_GOLD; $ink = MM_INK;
    $muted = MM_MUTED; $ivory = MM_IVORY; $line = MM_LINE;

    $logo  = h(mm_logo_url());
    $org   = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
    $addr  = h((string) cfgv('org_address', ''));
    $phone = h((string) cfgv('org_phone', '+7 (999) 504-88-99'));
    $email = h((string) cfgv('org_email', ''));
    $hours = h((string) cfgv('org_hours', ''));
    $year  = (int) cfgv('year', (int) date('Y'));
    $pre   = h((string) ($opt['preheader'] ?? ''));
    $pixel = (string) ($opt['pixel'] ?? '');
    $note  = h((string) ($opt['audience_note'] ?? 'Вы получили это письмо, так как оставили заявку или подписку на сайте центра.'));

    $contacts = '';
    if ($addr  !== '') $contacts .= '<div style="margin-top:2px;">' . $addr . '</div>';
    if ($phone !== '') $contacts .= '<div style="margin-top:2px;">Телефон: ' . $phone . '</div>';
    if ($email !== '') $contacts .= '<div style="margin-top:2px;">Почта: ' . $email . '</div>';
    if ($hours !== '') $contacts .= '<div style="margin-top:2px;">Режим работы: ' . $hours . '</div>';

    $unsubUrl = trim((string) ($opt['unsubscribe_url'] ?? ''));
    $unsubLine = $unsubUrl !== '' && $unsubUrl !== '{{unsubscribe_url}}'
        ? $note . ' <a href="' . h($unsubUrl) . '" style="color:' . $gold . ';text-decoration:underline;">Отписаться от рассылки</a>.'
        : $note;

    // Подписка на наши каналы — ВКонтакте и MAX (в каждом письме).
    $vkUrl  = h((string) cfgv('org_vk', 'https://vk.com/muzmir_kc'));
    $maxUrl = h((string) cfgv('org_max', 'https://max.ru/join/v4SJluLzTAMWm4r5ldJ-JyA2rS5InmPYjaP6drn3F8I'));
    $social = '<div style="margin-top:18px;">'
        . '<div style="font-size:12px;color:' . $muted . ';margin-bottom:8px;">Подпишитесь на наши каналы — анонсы конкурсов, результаты и полезное:</div>'
        . '<a href="' . $vkUrl . '" style="display:inline-block;margin:0 8px 8px 0;padding:9px 18px;background:' . $navy . ';color:#FFFFFF;text-decoration:none;border-radius:9px;font-size:13px;font-weight:700;">ВКонтакте</a>'
        . '<a href="' . $maxUrl . '" style="display:inline-block;margin:0 8px 8px 0;padding:9px 18px;background:' . $gold . ';color:' . $navy . ';text-decoration:none;border-radius:9px;font-size:13px;font-weight:700;">Канал в MAX</a>'
        . '</div>';

    return <<<HTML
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>{$org}</title>
</head>
<body style="margin:0;padding:0;background:{$ivory};font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:{$ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{$pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{$ivory};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(23,48,122,.16);">

  <tr>
    <td style="background:{$navy};background:linear-gradient(135deg,{$navy} 0%,{$navy2} 100%);padding:32px 40px 28px;text-align:center;">
      <img src="{$logo}" alt="{$org}" width="96" height="96"
           style="display:inline-block;width:96px;height:96px;border-radius:50%;background:#FFFFFF;border:2px solid {$gold};">
      <div style="margin-top:14px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:{$gold};letter-spacing:.04em;line-height:1.35;">Культурный центр<br>«Музыкальный Мир»</div>
      <div style="margin-top:8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.78);">Конкурсы · Фестивали · Концерты</div>
    </td>
  </tr>

  <tr>
    <td style="padding:38px 42px 28px;font-size:15px;line-height:1.7;color:{$ink};">
      {$inner}
    </td>
  </tr>

  <tr><td style="padding:0 42px;"><div style="height:1px;background:{$line};"></div></td></tr>

  <tr>
    <td style="padding:24px 42px 32px;font-size:13px;line-height:1.65;color:{$muted};">
      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;color:{$navy};font-size:14px;margin-bottom:6px;">{$org}</div>
      {$contacts}
      {$social}
      <div style="margin-top:16px;font-size:12px;color:#96A0BE;">{$unsubLine}</div>
      <div style="margin-top:8px;font-size:12px;color:#A9B2CC;">© {$year} {$org}</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
{$pixel}
</body>
</html>
HTML;
}

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

    $fromName = (string) ($opt['from_name'] ?? cfgv('mail_from_name', 'Культурного центра «Музыкальный Мир»'));
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

    return mm_email_layout($inner, [
        'preheader'       => (string) ($vars['preheader'] ?? ''),
        'unsubscribe_url' => (string) ($vars['unsubscribe_url'] ?? ''),
    ]);
}
