<?php
/* ============================================================
   DUCK'S — отправка писем через Gmail (CURL SMTP, App Password).
   Фирменный HTML-шаблон: чёрный фон, красный неон, лого-утка, кнопки.
   sendEmail($to,$subject,$html,$attachments=[]) — с вложениями (MIME).
   emailTpl($title,$contentHtml,$buttons=[],$preheader='') — красивый каркас.
   ============================================================ */
require_once __DIR__ . '/config.php';

/* Кнопки: [['Текст','https://...','primary|primary2|ghost'], ...] → вертикальный столбик кнопок */
function emailButtons($buttons) {
  if (!$buttons) return '';
  $h = '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px auto 2px;" width="84%">';
  foreach ($buttons as $b) {
    $txt = htmlspecialchars($b[0]); $url = htmlspecialchars($b[1]);
    $style = $b[2] ?? 'primary';
    if ($style === 'ghost') {
      $css = 'background:#101010;color:#fff;border:1px solid #2c2c2c;';
    } elseif ($style === 'primary2') {
      $css = 'background:linear-gradient(135deg,#ff2a2a,#cc0000);color:#fff;border:none;box-shadow:0 6px 18px rgba(204,0,0,.4);';
    } else { // primary
      $css = 'background:' . BRAND_RED . ';color:#fff;border:none;box-shadow:0 6px 20px rgba(204,0,0,.45);';
    }
    $h .= '<tr><td style="padding:5px 0;">'
        . '<a href="' . $url . '" style="display:block;text-align:center;text-decoration:none;font-weight:800;'
        . 'font-size:15px;letter-spacing:.4px;padding:14px 20px;border-radius:40px;'
        . 'font-family:Arial,Helvetica,sans-serif;' . $css . '">' . $txt . '</a></td></tr>';
  }
  return $h . '</table>';
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
  . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:26px 12px;">'
  . '<tr><td align="center">'
  . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:'
  . BRAND_BG . ';border:1px solid #1c1c1c;border-radius:24px;overflow:hidden;">'
  // шапка: маскот-утка + вордмарк
  . '<tr><td align="center" style="padding:30px 24px 8px;background:radial-gradient(130% 130% at 50% -10%,rgba(204,0,0,.22),transparent 60%);">'
  . '<img src="' . DUCK_MASCOT_URL . '" width="92" alt="DUCK\'S" style="display:block;margin:0 auto;width:92px;height:auto;">'
  . '<div style="font-family:Arial,Helvetica,sans-serif;font-weight:900;font-size:25px;color:#fff;letter-spacing:3px;margin-top:10px;">'
  . 'DUCK<span style="color:' . BRAND_RED . ';">&#39;</span>S</div>'
  . '<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888;letter-spacing:5px;margin-top:3px;">GAME SPACE</div>'
  . '</td></tr>'
  // тонкая красная линия-разделитель
  . '<tr><td style="padding:14px 32px 0;"><div style="height:2px;background:linear-gradient(90deg,transparent,' . BRAND_RED . ',transparent);border-radius:2px;"></div></td></tr>'
  // заголовок
  . '<tr><td style="padding:16px 32px 0;"><h1 style="font-family:Arial,Helvetica,sans-serif;color:#fff;font-size:23px;'
  . 'line-height:1.25;margin:0 0 6px;text-align:center;font-weight:800;">' . htmlspecialchars($title) . '</h1></td></tr>'
  // контент
  . '<tr><td style="padding:6px 32px 4px;font-family:Arial,Helvetica,sans-serif;color:#cfcfcf;font-size:15px;line-height:1.6;text-align:center;">'
  . $contentHtml . '</td></tr>'
  // кнопки
  . '<tr><td align="center" style="padding:4px 24px 22px;">' . $btns . '</td></tr>'
  // подвал
  . '<tr><td style="padding:18px 24px 26px;border-top:1px solid #161616;text-align:center;'
  . 'font-family:Arial,Helvetica,sans-serif;color:#666;font-size:11px;line-height:1.7;">'
  . '<img src="' . DUCK_LOGO_URL . '" width="30" alt="" style="opacity:.85;margin-bottom:6px;"><br>'
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
