<?php
/* ============================================================
   DUCK'S — отправка писем через Gmail (CURL SMTP, App Password).
   Фирменный HTML-шаблон: чёрный фон, красный неон, лого-утка, кнопки.
   sendEmail($to,$subject,$html,$attachments=[]) — с вложениями (MIME).
   emailTpl($title,$contentHtml,$buttons=[],$preheader='') — красивый каркас.
   ============================================================ */
require_once __DIR__ . '/config.php';

/* Кнопки: [['Текст','https://...'], ...] → HTML «неоновые» кнопки */
function emailButtons($buttons) {
  if (!$buttons) return '';
  $h = '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto 4px;"><tr>';
  foreach ($buttons as $b) {
    $txt = htmlspecialchars($b[0]); $url = htmlspecialchars($b[1]);
    $h .= '<td style="padding:6px 8px;">'
        . '<a href="' . $url . '" style="display:inline-block;background:' . BRAND_RED . ';'
        . 'color:#fff;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:.5px;'
        . 'padding:14px 26px;border-radius:40px;font-family:Arial,Helvetica,sans-serif;'
        . 'box-shadow:0 6px 20px rgba(204,0,0,.45);">' . $txt . '</a></td>';
  }
  return $h . '</tr></table>';
}

/* Фирменный каркас письма */
function emailTpl($title, $contentHtml, $buttons = [], $preheader = '') {
  $btns = emailButtons($buttons);
  $pre = $preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'
       . htmlspecialchars($preheader) . '</div>' : '';
  $year = date('Y');
  return '<!doctype html><html><head><meta charset="utf-8">'
  . '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
  . '<body style="margin:0;padding:0;background:#050505;">' . $pre
  . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:28px 12px;">'
  . '<tr><td align="center">'
  . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:'
  . BRAND_BG . ';border:1px solid #1c1c1c;border-radius:22px;overflow:hidden;">'
  // шапка с лого
  . '<tr><td align="center" style="padding:34px 24px 10px;background:radial-gradient(120% 120% at 50% 0%,rgba(204,0,0,.18),transparent 60%);">'
  . '<div style="font-size:40px;line-height:1;">🦆</div>'
  . '<div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:26px;color:#fff;letter-spacing:3px;margin-top:8px;">'
  . 'DUCK<span style="color:' . BRAND_RED . ';">&#39;</span>S</div>'
  . '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888;letter-spacing:5px;margin-top:4px;">GAME SPACE</div>'
  . '</td></tr>'
  // заголовок
  . '<tr><td style="padding:20px 32px 0;"><h1 style="font-family:Arial,Helvetica,sans-serif;color:#fff;font-size:22px;'
  . 'line-height:1.25;margin:0 0 6px;text-align:center;">' . htmlspecialchars($title) . '</h1></td></tr>'
  // контент
  . '<tr><td style="padding:8px 32px 6px;font-family:Arial,Helvetica,sans-serif;color:#cfcfcf;font-size:15px;line-height:1.6;text-align:center;">'
  . $contentHtml . '</td></tr>'
  // кнопки
  . '<tr><td align="center" style="padding:4px 24px 24px;">' . $btns . '</td></tr>'
  // подвал
  . '<tr><td style="padding:18px 24px 26px;border-top:1px solid #161616;text-align:center;'
  . 'font-family:Arial,Helvetica,sans-serif;color:#666;font-size:11px;line-height:1.6;">'
  . 'DUCK&#39;S GAME SPACE · Москва · клуб настольных и интеллектуальных игр<br>'
  . '<a href="' . TG_CHANNEL . '" style="color:#999;text-decoration:none;">Telegram-канал</a> · '
  . '<a href="' . SITE_URL . '" style="color:#999;text-decoration:none;">ducks.games</a><br>'
  . '<span style="color:#444;">© ' . $year . ' DUCK&#39;S GAME SPACE</span>'
  . '</td></tr>'
  . '</table></td></tr></table></body></html>';
}

/* Низкоуровневая отправка через Gmail CURL SMTP + fallback mail() */
function sendEmail($to, $subject, $html, $attachments = []) {
  $boundary = 'b_' . bin2hex(random_bytes(8));
  $altBoundary = 'a_' . bin2hex(random_bytes(8));
  $fromName = '=?UTF-8?B?' . base64_encode(MAIL_FROM_NAME) . '?=';
  $subjEnc  = '=?UTF-8?B?' . base64_encode($subject) . '?=';

  $head  = "From: $fromName <" . MAIL_FROM . ">\r\n";
  $head .= "To: <$to>\r\n";
  $head .= "Subject: $subjEnc\r\n";
  $head .= "MIME-Version: 1.0\r\n";
  $head .= "Date: " . date('r') . "\r\n";
  $head .= "Message-ID: <" . bin2hex(random_bytes(8)) . "@ducks.games>\r\n";

  $textAlt = trim(strip_tags(str_replace(['</p>', '<br>', '<br/>'], "\n", $html)));

  if ($attachments) {
    $head .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";
    $body  = "--$boundary\r\n";
    $body .= "Content-Type: multipart/alternative; boundary=\"$altBoundary\"\r\n\r\n";
    $body .= "--$altBoundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
           . chunk_split(base64_encode($textAlt)) . "\r\n";
    $body .= "--$altBoundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
           . chunk_split(base64_encode($html)) . "\r\n--$altBoundary--\r\n";
    foreach ($attachments as $a) {
      $fname = $a['name']; $data = $a['data'];
      $ctype = $a['type'] ?? 'application/octet-stream';
      $body .= "--$boundary\r\nContent-Type: $ctype; name=\"$fname\"\r\n";
      $body .= "Content-Transfer-Encoding: base64\r\n";
      $body .= "Content-Disposition: attachment; filename=\"$fname\"\r\n\r\n";
      $body .= chunk_split(base64_encode($data)) . "\r\n";
    }
    $body .= "--$boundary--\r\n";
  } else {
    $head .= "Content-Type: multipart/alternative; boundary=\"$altBoundary\"\r\n";
    $body  = "--$altBoundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
           . chunk_split(base64_encode($textAlt)) . "\r\n";
    $body .= "--$altBoundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
           . chunk_split(base64_encode($html)) . "\r\n--$altBoundary--\r\n";
  }

  // CURL SMTP (предпочтительно)
  if (function_exists('curl_init') && MAIL_PASS) {
    $raw = $head . "\r\n" . $body;
    $fp = fopen('php://temp', 'r+');
    fwrite($fp, $raw); rewind($fp);
    $ch = curl_init();
    curl_setopt_array($ch, [
      CURLOPT_URL => SMTP_HOST,
      CURLOPT_USE_SSL => CURLUSESSL_ALL,
      CURLOPT_USERNAME => MAIL_USER,
      CURLOPT_PASSWORD => MAIL_PASS,
      CURLOPT_MAIL_FROM => '<' . MAIL_FROM . '>',
      CURLOPT_MAIL_RCPT => ['<' . $to . '>'],
      CURLOPT_UPLOAD => true,
      CURLOPT_READDATA => $fp,
      CURLOPT_INFILESIZE => strlen($raw),
      CURLOPT_TIMEOUT => 30,
      CURLOPT_SSL_VERIFYPEER => false,
      CURLOPT_SSL_VERIFYHOST => 0,
    ]);
    $ok = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch); fclose($fp);
    if ($ok !== false && !$err) return true;
    @error_log("DUCKS mail curl fail to $to: $err");
  }
  // fallback
  return @mail($to, $subjEnc, $body, $head);
}
