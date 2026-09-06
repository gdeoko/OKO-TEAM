<?php
// ╔══════════════════════════════════════════════╗
// ║  OKO TEAM — Cron дожимов                     ║
// ║  Запускать каждые 30 минут:                  ║
// ║  */30 * * * * php /path/to/cron.php          ║
// ╚══════════════════════════════════════════════╝

define('PARTIALS_DIR', __DIR__ . '/partials/');
define('GMAIL',        'daniel.okoteam@gmail.com');
define('GMAIL_PASS',   'xoitcjrufqsqoljj');
define('GMAIL_NAME',   'OKO TEAM · Даниэль Ильясов');
define('SITE_URL',     'https://okoteam.top');

// Lava ссылки
$LAVA = [
    'sistema' => 'https://app.lava.top/products/09a788c0-c5dc-4310-a0e2-7fd90708295a/f184b8aa-6b9b-418b-be5b-cb47d6de33b7',
    'zavod'   => 'https://app.lava.top/products/cc256201-d7ca-4fa5-b3eb-cd4ca8ecdcc2',
    'consult' => 'https://app.lava.top/products/ac767e5f-ee82-4ef7-9d00-3fded697f981',
];

function sendEmail($to, $subject, $body) {
    $msg  = "From: " . GMAIL_NAME . " <" . GMAIL . ">\r\n";
    $msg .= "To: {$to}\r\n";
    $msg .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
    $msg .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" . $body;
    if (function_exists('curl_init')) {
        $fp = fopen('php://temp','rw+'); fwrite($fp,$msg); rewind($fp);
        $ch = curl_init();
        curl_setopt_array($ch,[CURLOPT_URL=>'smtps://smtp.gmail.com:465',CURLOPT_RETURNTRANSFER=>true,CURLOPT_SSL_VERIFYPEER=>false,CURLOPT_SSL_VERIFYHOST=>false,CURLOPT_USERNAME=>GMAIL,CURLOPT_PASSWORD=>GMAIL_PASS,CURLOPT_MAIL_FROM=>"<".GMAIL.">",CURLOPT_MAIL_RCPT=>["<{$to}>"],CURLOPT_READDATA=>$fp,CURLOPT_UPLOAD=>true,CURLOPT_TIMEOUT=>15]);
        curl_exec($ch); $err=curl_error($ch); curl_close($ch); fclose($fp);
        if(empty($err)) return true;
    }
    return @mail($to,'=?UTF-8?B?'.base64_encode($subject).'?=',$body,"From: ".GMAIL_NAME." <".GMAIL.">\r\nContent-Type: text/html; charset=UTF-8\r\n");
}

function emailTpl($title, $content, $btns=[]) {
    $btnsHtml='';
    foreach($btns as $btn){
        $bg=$btn['primary']??false?'#9AFF00':'transparent';
        $cl=$btn['primary']??false?'#000':'rgba(255,255,255,0.7)';
        $br=$btn['primary']??false?'none':'1px solid rgba(255,255,255,0.2)';
        $btnsHtml.="<a href='{$btn['url']}' style='display:block;text-align:center;background:{$bg};color:{$cl};text-decoration:none;padding:13px 24px;border-radius:12px;font-weight:800;font-family:Unbounded,Arial,sans-serif;font-size:13px;border:{$br};margin-bottom:8px'>{$btn['text']}</a>";
    }
    $btnBlock=$btnsHtml?"<div style='margin:24px 0'>{$btnsHtml}</div>":'';
    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700;900&family=Onest:wght@400;600&display=swap" rel="stylesheet"></head><body style="margin:0;padding:0;background:#050505;font-family:Onest,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:20px"><div style="text-align:center;padding:24px 0 18px;border-bottom:1px solid rgba(154,255,0,0.2)"><div style="font-family:Unbounded,Arial,sans-serif;font-size:22px;font-weight:900;color:#fff">ОКО<span style="color:#9AFF00"> TEAM</span></div></div><h2 style="font-family:Unbounded,Arial,sans-serif;font-size:18px;font-weight:900;color:#fff;margin:22px 0 14px">'.$title.'</h2><div style="background:rgba(255,255,255,0.03);border:1px solid rgba(154,255,0,0.12);border-radius:14px;padding:22px;color:rgba(255,255,255,0.8);font-size:14px;line-height:1.8">'.$content.'</div>'.$btnBlock.'<div style="text-align:center;padding:18px 0;font-size:11px;color:rgba(255,255,255,0.2)">OKO TEAM · okoteam.top · @ktodaniel<br><a href="mailto:'.GMAIL.'?subject=Отписаться" style="color:rgba(154,255,0,0.35);text-decoration:none">Отписаться</a></div></div></body></html>';
}

if (!is_dir(PARTIALS_DIR)) exit;

$processed = 0;
foreach (glob(PARTIALS_DIR . '*.json') as $f) {
    $p = json_decode(file_get_contents($f), true);
    if (!$p || empty($p['email'])) continue;

    $elapsed  = time() - ($p['ts'] ?? 0);
    $email    = $p['email'];
    $name     = $p['name'] ?? 'друг';
    $product  = $p['product'] ?? 'sistema';
    $tariff   = $p['tariff'] ?? '';
    $lavaUrl  = $LAVA[$product] ?? $LAVA['sistema'];

    // Дожим 1: через 1 час
    if ($elapsed >= 3600 && empty($p['drip1'])) {
        $html = emailTpl(
            "Вы не завершили оплату",
            "<p>Привет, <strong>$name</strong>!</p>
             <p>Вы оставили заявку, но оплата не прошла. Место ещё забронировано.</p>
             <p>Мы берём не более <strong>50 клиентов в месяц</strong> — количество мест ограничено.</p>
             <p style='font-size:12px;color:rgba(255,255,255,0.4)'>Есть вопросы? <a href='https://t.me/ktodaniel' style='color:#9AFF00'>@ktodaniel</a></p>",
            [['text'=>'💳 Завершить оплату','url'=>$lavaUrl,'primary'=>true]]
        );
        if (sendEmail($email, "Вы не завершили оплату — OKO TEAM", $html)) {
            $p['drip1'] = true;
            file_put_contents($f, json_encode($p, JSON_UNESCAPED_UNICODE));
            $processed++;
        }
    }

    // Дожим 2: через 24 часа
    if ($elapsed >= 86400 && !empty($p['drip1']) && empty($p['drip2'])) {
        $html = emailTpl(
            "Последний шанс",
            "<p>Привет, <strong>$name</strong>!</p>
             <p>Это последнее напоминание. Ваше место в <strong>OKO TEAM</strong> ещё свободно, но мы не можем держать его бесконечно.</p>
             <p>Если передумали — просто напишите Даниэлю, он ответит на все вопросы.</p>",
            [
                ['text'=>'💳 Оплатить сейчас','url'=>$lavaUrl,'primary'=>true],
                ['text'=>'💬 Написать Даниэлю','url'=>'https://t.me/ktodaniel','primary'=>false],
            ]
        );
        if (sendEmail($email, "Последнее напоминание — OKO TEAM", $html)) {
            $p['drip2'] = true;
            file_put_contents($f, json_encode($p, JSON_UNESCAPED_UNICODE));
            $processed++;
        }
    }

    // Удаляем через 48 часов
    if ($elapsed >= 172800 && !empty($p['drip1']) && !empty($p['drip2'])) {
        unlink($f);
    }
}

echo date('Y-m-d H:i:s') . " — cron done, processed: $processed\n";
