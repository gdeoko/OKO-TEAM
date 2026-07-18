<?php
/* ==========================================================
   Бизнес-парк «Кластер» — приём заявок с сайта
   Форма -> Telegram (@aktivitiorderbot, 4 руководителя) + Email + JSON-лог
   Ключи берутся из ENV или api/config.php (в git НЕ коммитится).
   ========================================================== */
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$cfg = ['TG_TOKEN'=>getenv('ACTIVITI_TG_BOT_TOKEN') ?: '',
        'TG_IDS'=>getenv('ACTIVITI_TG_MANAGER_IDS') ?: '',
        'GMAIL'=>getenv('ACTIVITI_GMAIL') ?: '',
        'GMAIL_APP'=>getenv('ACTIVITI_GMAIL_APP_PASS') ?: '',
        'NOTIFY_EMAIL'=>getenv('ACTIVITI_NOTIFY_EMAIL') ?: 'ddouglas@activity.su'];
if (file_exists(__DIR__.'/config.php')) { $cfg = array_merge($cfg, include __DIR__.'/config.php'); }

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = $_POST;
$name = trim($body['name'] ?? '');
$phone= trim($body['phone'] ?? '');
if ($name==='' || $phone==='') { echo json_encode(['ok'=>false,'error'=>'Заполните имя и телефон']); exit; }

$f = function($k) use ($body){ return trim($body[$k] ?? ''); };
$lead = [
  'ts'=>date('Y-m-d H:i:s'), 'name'=>$name, 'phone'=>$phone,
  'company'=>$f('company'), 'email'=>$f('email'), 'industry'=>$f('industry'),
  'space_type'=>$f('space_type'), 'area'=>$f('area'), 'term'=>$f('term'),
  'comment'=>$f('comment'), 'source'=>$f('source') ?: 'site:klaster',
  'page'=>$f('page'), 'ip'=>$_SERVER['REMOTE_ADDR'] ?? '',
];

/* -- JSON log -- */
$dir = __DIR__.'/../data'; if (!is_dir($dir)) @mkdir($dir,0755,true);
$file = $dir.'/leads.json';
$all = file_exists($file) ? (json_decode(file_get_contents($file),true) ?: []) : [];
$all[] = $lead;
@file_put_contents($file, json_encode($all, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT), LOCK_EX);

/* -- Telegram to all managers -- */
$rows = [
  ['Имя', $lead['name']], ['Телефон', $lead['phone']],
  ['Компания', $lead['company']], ['Email', $lead['email']],
  ['Отрасль', $lead['industry']], ['Тип', $lead['space_type']],
  ['Площадь', $lead['area']], ['Срок', $lead['term']],
  ['Комментарий', $lead['comment']],
];
$txt = "<b>Новая заявка — сайт «Кластер»</b>\n\n";
foreach ($rows as $r){ if($r[1]!=='') $txt .= "<b>".$r[0].":</b> ".htmlspecialchars($r[1])."\n"; }
$txt .= "\n".date('d.m.Y H:i');

$tgOk = 0;
if ($cfg['TG_TOKEN'] && $cfg['TG_IDS']) {
  foreach (array_filter(array_map('trim', explode(',', $cfg['TG_IDS']))) as $chatId) {
    $payload = ['chat_id'=>$chatId,'text'=>$txt,'parse_mode'=>'HTML','disable_web_page_preview'=>true];
    if ($lead['phone']) $payload['reply_markup'] = json_encode(['inline_keyboard'=>[[
      ['text'=>'Позвонить','url'=>'tel:'.preg_replace('/[^0-9+]/','',$lead['phone'])]
    ]]]);
    $ch = curl_init('https://api.telegram.org/bot'.$cfg['TG_TOKEN'].'/sendMessage');
    curl_setopt_array($ch,[CURLOPT_POST=>1,CURLOPT_RETURNTRANSFER=>1,CURLOPT_TIMEOUT=>8,
      CURLOPT_POSTFIELDS=>http_build_query($payload)]);
    $res = curl_exec($ch); curl_close($ch);
    if ($res && strpos($res,'"ok":true')!==false) $tgOk++;
  }
}

/* -- Email via Gmail SMTP (app password) -- */
function smtp_mail($cfg,$to,$subject,$html){
  if (!$cfg['GMAIL'] || !$cfg['GMAIL_APP'] || !$to) return false;
  $msg  = "From: Бизнес-парк Кластер <".$cfg['GMAIL'].">\r\nTo: {$to}\r\n";
  $msg .= "Subject: =?UTF-8?B?".base64_encode($subject)."?=\r\n";
  $msg .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n".$html;
  if (function_exists('curl_init')) {
    $fp=fopen('php://temp','rw+'); fwrite($fp,$msg); rewind($fp);
    $ch=curl_init();
    curl_setopt_array($ch,[CURLOPT_URL=>'smtps://smtp.gmail.com:465',CURLOPT_RETURNTRANSFER=>1,
      CURLOPT_SSL_VERIFYPEER=>1,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_USERNAME=>$cfg['GMAIL'],
      CURLOPT_PASSWORD=>$cfg['GMAIL_APP'],CURLOPT_MAIL_FROM=>'<'.$cfg['GMAIL'].'>',
      CURLOPT_MAIL_RCPT=>['<'.$to.'>'],CURLOPT_READDATA=>$fp,CURLOPT_UPLOAD=>1,CURLOPT_TIMEOUT=>15]);
    curl_exec($ch); $err=curl_error($ch); curl_close($ch); fclose($fp);
    return empty($err);
  }
  return @mail($to,'=?UTF-8?B?'.base64_encode($subject).'?=',$html,"From: ".$cfg['GMAIL']."\r\nContent-Type: text/html; charset=UTF-8\r\n");
}
$rowsHtml=''; foreach($rows as $r){ if($r[1]!=='') $rowsHtml.="<tr><td style='padding:6px 10px;color:#6B7280;font-size:13px'>".$r[0]."</td><td style='padding:6px 10px;font-weight:600;font-size:14px'>".htmlspecialchars($r[1])."</td></tr>"; }
$html = "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto'>
  <div style='background:#0E1116;color:#fff;padding:20px 24px;border-radius:14px 14px 0 0'>
  <b style='font-size:18px'>Новая заявка — сайт «Кластер»</b></div>
  <table style='width:100%;border-collapse:collapse;background:#fff;border:1px solid #E6E8EC'>$rowsHtml</table>
  <div style='padding:14px;color:#9aa2ad;font-size:12px'>".date('d.m.Y H:i')." · klaster-park.ru</div></div>";
$mailOk = smtp_mail($cfg, $cfg['NOTIFY_EMAIL'], 'Новая заявка — сайт Кластер', $html);

echo json_encode(['ok'=>true,'tg'=>$tgOk,'mail'=>$mailOk]);
