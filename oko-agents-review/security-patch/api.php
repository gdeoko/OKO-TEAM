<?php
// ╔══════════════════════════════════════════════╗
// ║  OKO TEAM — API Backend v2.0                 ║
// ║  okoteam.top/api.php                         ║
// ╚══════════════════════════════════════════════╝

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ── КОНФИГ ──────────────────────────────────────
define('DATA_FILE',    __DIR__ . '/data.json');
define('PARTIALS_DIR', __DIR__ . '/partials/');
define('GMAIL',        'daniel.okoteam@gmail.com');
define('GMAIL_PASS',   'xoitcjrufqsqoljj');
define('GMAIL_NAME',   'OKO TEAM · Даниэль Ильясов');
define('DANIEL_EMAIL', 'daniel.okoteam@gmail.com');
define('DANIEL_TG',    '1966985736');
define('TG_TOKEN',     '8681257013:AAGL56AFYPVddqrqY9DOcgK6wJoJjS_BxXw');
define('SITE_URL',     'https://okoteam.top');
define('ADMIN_KEY',    '8f77c66fe4174815c07bcb7124b8b7d36e0c3d5a');

// Lava ссылки
define('LAVA_SISTEMA', 'https://app.lava.top/products/09a788c0-c5dc-4310-a0e2-7fd90708295a/f184b8aa-6b9b-418b-be5b-cb47d6de33b7');
define('LAVA_ZAVOD',   'https://app.lava.top/products/cc256201-d7ca-4fa5-b3eb-cd4ca8ecdcc2');
define('LAVA_CONSULT', 'https://app.lava.top/products/ac767e5f-ee82-4ef7-9d00-3fded697f981');

// Продукты
$PRODUCTS = [
    'sistema' => ['name' => 'СИСТЕМА OKO',                  'emoji' => '🧠', 'lava' => LAVA_SISTEMA, 'custom' => false],
    'zavod'   => ['name' => 'Контент-завод',                 'emoji' => '🏭', 'lava' => LAVA_ZAVOD,   'custom' => false],
    'consult' => ['name' => 'Консультация',                   'emoji' => '📞', 'lava' => LAVA_CONSULT, 'custom' => false],
    'web'     => ['name' => 'Сайты / Боты / Приложения',     'emoji' => '💻', 'lava' => null,          'custom' => true],
    'voronka' => ['name' => 'Воронка + Нейробот',            'emoji' => '🤖', 'lava' => null,          'custom' => true],
    'bot'     => ['name' => 'Воронка + Нейробот',            'emoji' => '🤖', 'lava' => null,          'custom' => true],
    'club'    => ['name' => 'OKO CLUB',                      'emoji' => '⭐', 'lava' => null,          'custom' => false],
];

// Тарифы системы
$TARIFFS = [
    '1'  => ['name' => '1 месяц',    'price' => '25 000 ₽'],
    '3'  => ['name' => '3 месяца',   'price' => '65 000 ₽'],
    '6'  => ['name' => '6 месяцев',  'price' => '120 000 ₽'],
    '12' => ['name' => '12 месяцев', 'price' => '200 000 ₽'],
    // Завод
    '1m'   => ['name' => '1 месяц',  'price' => '19 900 ₽'],
    '3m'   => ['name' => '3 месяца', 'price' => '49 900 ₽'],
    '6m'   => ['name' => '6 месяцев','price' => '89 900 ₽'],
    // Консультация
    '1h'   => ['name' => '1 час',   'price' => ''],
    '3h'   => ['name' => '3 часа',  'price' => ''],
    '5h'   => ['name' => '5 часов', 'price' => ''],
];

// ── HELPERS ─────────────────────────────────────
function loadData() {
    if (!file_exists(DATA_FILE)) return ['leads'=>[],'payments'=>[],'subscribers'=>[],'newsletter_log'=>[],'settings'=>[]];
    $raw = file_get_contents(DATA_FILE);
    return json_decode($raw, true) ?: ['leads'=>[],'payments'=>[],'subscribers'=>[],'newsletter_log'=>[],'settings'=>[]];
}
function saveData($d) {
    file_put_contents(DATA_FILE, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}
function upsertSubscriber(&$data, $email, $name, $phone, $tg, $product) {
    foreach ($data['subscribers'] as &$s) {
        if ($s['email'] === $email) {
            $s['name']        = $name ?: $s['name'];
            $s['phone']       = $phone ?: ($s['phone'] ?? '');
            $s['tg']          = $tg ?: ($s['tg'] ?? '');
            $s['last_action'] = date('Y-m-d H:i:s');
            if (!in_array($product, $s['products'] ?? [])) $s['products'][] = $product;
            return;
        }
    }
    $data['subscribers'][] = [
        'email' => $email, 'name' => $name, 'phone' => $phone, 'tg' => $tg,
        'products' => [$product], 'paid' => false,
        'ts' => date('Y-m-d H:i:s'), 'last_action' => date('Y-m-d H:i:s'),
    ];
}
function isCustomProduct($product) {
    global $PRODUCTS;
    return !empty($PRODUCTS[$product]['custom']);
}

// ── EMAIL ────────────────────────────────────────
function sendEmail($to, $subject, $body) {
    if (!$to) return false;
    $msg  = "From: " . GMAIL_NAME . " <" . GMAIL . ">\r\n";
    $msg .= "To: {$to}\r\n";
    $msg .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
    $msg .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n";
    $msg .= $body;
    if (function_exists('curl_init')) {
        $fp = fopen('php://temp', 'rw+');
        fwrite($fp, $msg); rewind($fp);
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => 'smtps://smtp.gmail.com:465',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_USERNAME       => GMAIL,
            CURLOPT_PASSWORD       => GMAIL_PASS,
            CURLOPT_MAIL_FROM      => "<" . GMAIL . ">",
            CURLOPT_MAIL_RCPT      => ["<{$to}>"],
            CURLOPT_READDATA       => $fp,
            CURLOPT_UPLOAD         => true,
            CURLOPT_TIMEOUT        => 15,
        ]);
        curl_exec($ch); $err = curl_error($ch); curl_close($ch); fclose($fp);
        if (empty($err)) return true;
    }
    $headers = "From: " . GMAIL_NAME . " <" . GMAIL . ">\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n";
    return @mail($to, '=?UTF-8?B?'.base64_encode($subject).'?=', $body, $headers);
}

// ── EMAIL TEMPLATE ───────────────────────────────
function emailTpl($title, $content, $btns = []) {
    $btnsHtml = '';
    foreach ($btns as $btn) {
        $bg = $btn['primary'] ?? false ? '#9AFF00' : 'rgba(154,255,0,0.08)';
        $cl = $btn['primary'] ?? false ? '#000' : '#9AFF00';
        $br = $btn['primary'] ?? false ? 'none' : '1px solid rgba(154,255,0,0.3)';
        $btnsHtml .= "<a href='{$btn['url']}' style='display:block;text-align:center;background:{$bg};color:{$cl};text-decoration:none;padding:13px 24px;border-radius:12px;font-weight:800;font-family:Unbounded,Arial,sans-serif;font-size:13px;border:{$br};margin-bottom:8px'>{$btn['text']}</a>";
    }
    $btnBlock = $btnsHtml ? "<div style='margin:24px 0'>{$btnsHtml}</div>" : '';
    return '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700;900&family=Onest:wght@400;600&display=swap" rel="stylesheet">
<title>'.$title.'</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:Onest,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:20px">
<div style="text-align:center;padding:28px 0 20px;border-bottom:1px solid rgba(154,255,0,0.2)">
<div style="font-family:Unbounded,Arial,sans-serif;font-size:22px;font-weight:900;color:#fff">ОКО<span style="color:#9AFF00"> TEAM</span></div>
<div style="font-size:10px;color:rgba(154,255,0,0.7);letter-spacing:3px;text-transform:uppercase;margin-top:4px">Даниэль Ильясов</div>
</div>
<h2 style="font-family:Unbounded,Arial,sans-serif;font-size:19px;font-weight:900;color:#fff;margin:24px 0 16px;line-height:1.3">'.$title.'</h2>
<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(154,255,0,0.12);border-radius:16px;padding:24px;color:rgba(255,255,255,0.8);font-size:14px;line-height:1.8">'.$content.'</div>
'.$btnBlock.'
<div style="text-align:center;padding:20px 0;font-size:11px;color:rgba(255,255,255,0.2);line-height:1.7">
OKO TEAM · okoteam.top · @ktodaniel<br>
<a href="mailto:'.DANIEL_EMAIL.'?subject=Отписаться" style="color:rgba(154,255,0,0.35);text-decoration:none">Отписаться</a>
</div></div></body></html>';
}

function tableRow($label, $value, $lime = false) {
    $color = $lime ? '#9AFF00' : 'rgba(255,255,255,0.85)';
    return "<tr style='border-bottom:1px solid rgba(154,255,0,0.08)'>
        <td style='padding:8px 0;color:rgba(255,255,255,0.4);font-size:13px;white-space:nowrap;padding-right:16px'>$label</td>
        <td style='padding:8px 0;font-weight:600;color:$color;font-size:13px'>$value</td></tr>";
}

// ── TELEGRAM ─────────────────────────────────────
function sendTelegram($chatId, $text) {
    if (!TG_TOKEN || !$chatId) return;
    $url  = 'https://api.telegram.org/bot'.TG_TOKEN.'/sendMessage';
    $data = ['chat_id'=>$chatId,'text'=>$text,'parse_mode'=>'HTML','disable_web_page_preview'=>true];
    $opts = ['http'=>['method'=>'POST','header'=>'Content-Type: application/json','content'=>json_encode($data),'timeout'=>5]];
    @file_get_contents($url, false, stream_context_create($opts));
}
function tgWithButtons($chatId, $text, $buttons = []) {
    if (!TG_TOKEN || !$chatId) return;
    $url  = 'https://api.telegram.org/bot'.TG_TOKEN.'/sendMessage';
    $data = [
        'chat_id'                  => $chatId,
        'text'                     => $text,
        'parse_mode'               => 'HTML',
        'disable_web_page_preview' => true,
    ];
    if ($buttons) $data['reply_markup'] = ['inline_keyboard' => $buttons];
    $opts = ['http'=>['method'=>'POST','header'=>'Content-Type: application/json','content'=>json_encode($data),'timeout'=>5]];
    @file_get_contents($url, false, stream_context_create($opts));
}

// ══════════════════════════════════════════════════
// РОУТЕР
// ══════════════════════════════════════════════════
$body   = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? $body['action'] ?? '';

switch ($action) {

// ──────────────────────────────────────────────────
// saveLead — клиент заполнил форму
// ──────────────────────────────────────────────────
case 'saveLead':
    $email   = trim($body['email']   ?? '');
    $name    = trim($body['name']    ?? '');
    $phone   = trim($body['phone']   ?? '');
    $tg      = trim($body['tg']      ?? '');
    $product = trim($body['product'] ?? 'sistema');
    $tariff  = trim($body['tariff']  ?? '');
    // Дополнительные поля анкеты (для custom продуктов)
    $extra   = $body['extra'] ?? [];

    if (!$email || !$name || !$phone) {
        echo json_encode(['ok'=>false,'error'=>'Заполните все обязательные поля']); break;
    }

    global $PRODUCTS, $TARIFFS;
    $prod      = $PRODUCTS[$product] ?? ['name'=>$product,'emoji'=>'🎯','lava'=>null,'custom'=>false];
    $prodName  = $prod['name'];
    $prodEmoji = $prod['emoji'];
    $lavaUrl   = $prod['lava'];
    $isCustom  = $prod['custom'];
    $tariffInfo = $TARIFFS[$tariff] ?? null;
    $tariffStr  = $tariffInfo ? $tariffInfo['name'] . ($tariffInfo['price'] ? ' — '.$tariffInfo['price'] : '') : $tariff;

    $data = loadData();

    // Сохраняем partial (для дожимов) — только для продуктов с оплатой
    if (!$isCustom) {
        if (!is_dir(PARTIALS_DIR)) mkdir(PARTIALS_DIR, 0755, true);
        $leadFile = PARTIALS_DIR . md5($email.$product) . '.json';
        file_put_contents($leadFile, json_encode([
            'email'=>$email,'name'=>$name,'phone'=>$phone,'tg'=>$tg,
            'product'=>$product,'tariff'=>$tariff,'extra'=>$extra,
            'ts'=>time(),'drip1'=>false,'drip2'=>false,
        ], JSON_UNESCAPED_UNICODE));
    }

    upsertSubscriber($data, $email, $name, $phone, $tg, $product);
    foreach ($data['subscribers'] as &$s) {
        if ($s['email'] === $email) {
            $s['tariff'] = $tariff;
            $s['extra']  = $extra;
            $s['ip']     = $_SERVER['REMOTE_ADDR'] ?? '';
            $s['last_seen'] = date('Y-m-d H:i:s');
            break;
        }
    }
    saveData($data);

    // Строим таблицу дополнительных полей анкеты
    $extraRows = '';
    if (!empty($extra)) {
        foreach ($extra as $k => $v) {
            if ($v) $extraRows .= tableRow(htmlspecialchars($k), htmlspecialchars($v));
        }
    }

    // ═══ ЛОГИКА ПИСЕМ ═══
    if ($isCustom) {
        // ── CUSTOM продукт (сайт/воронка/бот): Даниэль сам скидывает счёт ──

        // 1. Письмо КЛИЕНТУ — одно, кнопка "Написать Даниэлю"
        // Строим таблицу данных клиента
        $clientDataRows = tableRow('Имя', $name)
            . tableRow('Email', $email)
            . tableRow('Телефон', $phone)
            . ($tg ? tableRow('Telegram', "@$tg") : '')
            . $extraRows;

        $clientHtml = emailTpl(
            "Заявка принята!",
            "<p>Привет, <strong>$name</strong>!</p>
             <p>Твоя заявка на <strong>$prodName</strong> принята. Даниэль изучит её и свяжется в ближайшее время с расчётом стоимости.</p>
             <p style='margin-top:16px;font-size:12px;color:rgba(255,255,255,0.5)'>Данные вашей заявки:</p>
             <table style='width:100%;border-collapse:collapse;margin-top:8px'>$clientDataRows</table>
             <p style='margin-top:16px;font-size:12px;color:rgba(255,255,255,0.4)'>Если нужна помощь — напишите напрямую: <a href='https://t.me/ktodaniel' style='color:#9AFF00'>@ktodaniel</a></p>",
            [['text'=>'Написать Даниэлю','url'=>'https://t.me/ktodaniel','primary'=>true]]
        );
        sendEmail($email, "Заявка на $prodName принята — OKO TEAM", $clientHtml);

        // 2. Письмо ДАНИЭЛЮ — с полными данными анкеты
        $adminContent = "
            <p>Новая заявка на <strong>$prodEmoji $prodName</strong></p>
            <table style='width:100%;border-collapse:collapse'>
            " . tableRow('Продукт', "$prodEmoji $prodName", true)
              . tableRow('Имя', $name)
              . tableRow('Email', $email)
              . tableRow('Телефон', $phone)
              . ($tg ? tableRow('Telegram', "<a href='https://t.me/$tg' style='color:#9AFF00'>@$tg</a>") : '')
              . $extraRows . "
            </table>
            <p style='margin-top:16px;padding:12px;background:rgba(154,255,0,0.08);border-radius:8px;font-size:13px;color:#9AFF00;font-weight:600'>
              Рассчитай стоимость и скинь счёт клиенту!
            </p>";
        $adminHtml = emailTpl(
            "$prodEmoji Новая заявка: $prodName",
            $adminContent,
            $tg
                ? [['text'=>"Написать $name",'url'=>"https://t.me/$tg",'primary'=>true]]
                : [['text'=>"Написать $name",'url'=>"mailto:$email",'primary'=>true]]
        );
        sendEmail(DANIEL_EMAIL, "Заявка: $name → $prodName", $adminHtml);

        // TG уведомление
        $tgMsg = "<b>Новая заявка</b>\n\n$prodName\n\n"
               . "$name\n$phone\n$email"
               . ($tg ? "\n@$tg" : '');
        if (!empty($extra)) {
            foreach ($extra as $k => $v) {
                if ($v) $tgMsg .= "\n$k: $v";
            }
        }
        $tgMsg .= "\n\n" . date('d.m H:i');
        $tgBtns = $tg
            ? [[['text'=>"Написать $name",'url'=>"https://t.me/$tg"]]]
            : [[['text'=>"Написать $name",'url'=>"mailto:$email"]]];
        tgWithButtons(DANIEL_TG, $tgMsg, $tgBtns);

    } else {
        // ── ОБЫЧНЫЙ продукт с оплатой (sistema / zavod / consult) ──

        // 1. Письмо ДАНИЭЛЮ — новый лид
        $adminContent = "
            <p><strong>$name</strong> оставил контакты и перешёл к оплате.</p>
            <table style='width:100%;border-collapse:collapse'>
            " . tableRow('Продукт', "$prodEmoji $prodName" . ($tariffStr ? " · $tariffStr" : ''), true)
              . tableRow('Имя', $name)
              . tableRow('Email', $email)
              . tableRow('Телефон', $phone)
              . ($tg ? tableRow('Telegram', "<a href='https://t.me/$tg' style='color:#9AFF00'>@$tg</a>") : '')
              . $extraRows . "
            </table>
            <p style='margin-top:12px;font-size:12px;color:rgba(255,255,255,0.4);padding:10px;background:rgba(255,255,255,0.03);border-radius:8px'>
              Дожим через 1 час если нет оплаты, второй — через 24 часа.
            </p>";
        $adminBtns = $tg
            ? [['text'=>"Написать $name",'url'=>"https://t.me/$tg",'primary'=>true]]
            : [['text'=>"Написать $name",'url'=>"mailto:$email",'primary'=>true]];
        $adminHtml = emailTpl("$prodEmoji Новый лид: $prodName", $adminContent, $adminBtns);
        sendEmail(DANIEL_EMAIL, "Лид: $name → $prodName" . ($tg ? " (@$tg)" : ''), $adminHtml);

        // 2. Письмо КЛИЕНТУ — письмо 1 с кнопкой ОПЛАТИТЬ
        $lavaLink = $lavaUrl ?: LAVA_SISTEMA;
        $clientHtml = emailTpl(
            "Заявка принята!",
            "<p>Привет, <strong>$name</strong>!</p>
             <p>Твоя заявка на <strong>$prodEmoji $prodName</strong>" . ($tariffStr ? " ($tariffStr)" : '') . " получена.</p>
             <p>Нажми кнопку ниже чтобы перейти к оплате. После успешной оплаты Даниэль добавит тебя в закрытый чат и пришлёт анкету.</p>
             <p style='font-size:12px;color:rgba(255,255,255,0.4);margin-top:12px'>Если нужна помощь — <a href='https://t.me/ktodaniel' style='color:#9AFF00'>@ktodaniel</a></p>",
            [['text'=>'Перейти к оплате','url'=>$lavaLink,'primary'=>true]]
        );
        sendEmail($email, "Заявка на $prodName — OKO TEAM", $clientHtml);

        // TG уведомление
        $tgMsg = "<b>Новый лид</b>\n\n$prodName" . ($tariffStr ? " · $tariffStr" : '') . "\n\n"
               . "$name\n$phone\n$email" . ($tg ? "\n@$tg" : '')
               . "\n\n" . date('d.m H:i');
        $tgBtns = [
            [['text'=>"Подтвердить оплату",'callback_data'=>'paid_'.$email]],
            $tg ? [['text'=>"Написать $name",'url'=>"https://t.me/$tg"]] : [['text'=>"Написать $name",'url'=>"mailto:$email"]],
        ];
        tgWithButtons(DANIEL_TG, $tgMsg, $tgBtns);
    }

    echo json_encode(['ok'=>true]);
    break;

// ──────────────────────────────────────────────────
// confirmPayment — Lava webhook или ручное подтверждение
// ──────────────────────────────────────────────────
case 'confirmPayment':
    // Требуем секретный ключ для ЛЮБОГО подтверждения оплаты.
    // Закрыт обход без ключа и убран слабый ключ oko2026.
    $secret = $_GET['secret'] ?? ($body['secret'] ?? ($_SERVER['HTTP_X_API_KEY'] ?? ''));
    if (!hash_equals(ADMIN_KEY, (string)$secret)) {
        http_response_code(403);
        echo json_encode(['ok'=>false,'error'=>'Unauthorized']); break;
    }

    // Парсим Lava формат
    $lavaStatus = $body['status'] ?? '';
    if ($lavaStatus && !in_array($lavaStatus, ['success','paid','completed'])) {
        echo json_encode(['ok'=>true,'skipped'=>true]); break;
    }

    $email   = trim($body['buyer_email'] ?? ($body['email'] ?? ''));
    $name    = trim($body['buyer_name']  ?? ($body['name']  ?? 'Клиент'));
    $product = trim($body['offer_id']    ?? ($body['product'] ?? 'sistema'));
    $tariff  = trim($body['period']      ?? ($body['tariff']  ?? ''));
    $amount  = trim($body['amount']      ?? ($body['sum']     ?? ''));

    // Ищем в partials если нет данных
    if (!$email && is_dir(PARTIALS_DIR)) {
        foreach (glob(PARTIALS_DIR . '*.json') as $f) {
            $p = json_decode(file_get_contents($f), true);
            if ($p && ($p['product'] === $product || !$product)) {
                $email = $p['email'] ?? ''; $name = $p['name'] ?? 'Клиент';
                $tariff = $p['tariff'] ?? ''; break;
            }
        }
    }

    if (!$email) { echo json_encode(['ok'=>false,'error'=>'No email']); break; }

    global $PRODUCTS, $TARIFFS;
    $prod       = $PRODUCTS[$product] ?? ['name'=>$product,'emoji'=>'🎯'];
    $prodName   = $prod['name'];
    $prodEmoji  = $prod['emoji'];
    $tariffInfo = $TARIFFS[$tariff] ?? null;
    $tariffStr  = $tariffInfo ? $tariffInfo['name'] . ($tariffInfo['price'] ? ' — '.$tariffInfo['price'] : '') : $tariff;

    $data = loadData();

    // Помечаем как оплатившего
    $clientPhone = ''; $clientTg = '';
    foreach ($data['subscribers'] as &$s) {
        if ($s['email'] === $email) {
            $s['paid'] = true; $s['paid_product'] = $product;
            $s['paid_ts'] = date('Y-m-d H:i:s');
            $clientPhone = $s['phone'] ?? ''; $clientTg = $s['tg'] ?? '';
            break;
        }
    }

    $data['payments'][] = [
        'email'=>$email,'name'=>$name,'product'=>$product,
        'tariff'=>$tariff,'amount'=>$amount,'ts'=>date('Y-m-d H:i:s'),
    ];
    $data['settings']['order_count'] = ($data['settings']['order_count'] ?? 0) + 1;
    saveData($data);

    // Удаляем partial — дожимы не нужны
    $lf = PARTIALS_DIR . md5($email.$product) . '.json';
    if (file_exists($lf)) unlink($lf);

    // ── Письмо КЛИЕНТУ — письмо 2, кнопка "Написать Даниэлю" ──
    $clientHtml = emailTpl(
        "Оплата получена! 🎉",
        "<p>Привет, <strong>$name</strong>!</p>
         <p>Оплата по продукту <strong>$prodEmoji $prodName</strong>" . ($tariffStr ? " ($tariffStr)" : '') . " успешно получена.</p>
         <p>Даниэль уже получил уведомление. Напиши ему — он добавит тебя в закрытый чат и пришлёт анкету для сборки системы.</p>
         <div style='margin-top:16px;padding:14px;background:rgba(154,255,0,0.06);border:1px solid rgba(154,255,0,0.15);border-radius:12px;font-size:13px;color:rgba(255,255,255,0.65);line-height:2'>
           ✓ Письмо отправлено на email<br>
           ✓ Напиши <a href='https://t.me/ktodaniel' style='color:#9AFF00;font-weight:700'>@ktodaniel</a> — получишь доступ в чат<br>
           ✓ Даниэль пришлёт анкету для сборки системы
         </div>",
        [['text'=>'Написать Даниэлю','url'=>'https://t.me/ktodaniel','primary'=>true]]
    );
    sendEmail($email, "Оплата получена — $prodName · OKO TEAM", $clientHtml);

    // ── Письмо ДАНИЭЛЮ — с полными данными ──
    $adminContent = "
        <p>💰 <strong>$name</strong> оплатил!</p>
        <table style='width:100%;border-collapse:collapse'>
        " . tableRow('Продукт', "$prodEmoji $prodName" . ($tariffStr ? " · $tariffStr" : ''), true)
          . ($amount ? tableRow('Сумма', "$amount", true) : '')
          . tableRow('Имя', $name)
          . tableRow('Email', $email)
          . ($clientPhone ? tableRow('Телефон', $clientPhone) : '')
          . ($clientTg ? tableRow('Telegram', "<a href='https://t.me/$clientTg' style='color:#9AFF00'>@$clientTg</a>") : '') . "
        </table>
        <p style='margin-top:16px;padding:12px;background:rgba(154,255,0,0.1);border-radius:8px;font-weight:600;color:#9AFF00;text-align:center'>
          Добавь в закрытый чат и пришли анкету!
        </p>";
    $adminHtml = emailTpl(
        "ОПЛАТА: $prodName",
        $adminContent,
        $clientTg
            ? [['text'=>"Написать $name",'url'=>"https://t.me/$clientTg",'primary'=>true]]
            : [['text'=>"Написать $name",'url'=>"mailto:$email",'primary'=>true]]
    );
    sendEmail(DANIEL_EMAIL, "ОПЛАТА: $name — $prodName", $adminHtml);

    $tgMsg = "<b>Оплата получена</b>\n\n$prodName" . ($tariffStr ? " · $tariffStr" : '')
           . "\n$name\n$email" . ($clientPhone ? "\n$clientPhone" : '')
           . ($clientTg ? "\n@$clientTg" : '') . ($amount ? "\n$amount" : '')
           . "\n\nДобавь в закрытый чат и пришли анкету!";
    $tgBtns = [
        $clientTg ? [['text'=>"Написать $name",'url'=>"https://t.me/$clientTg"]] : [['text'=>"Написать $name",'url'=>"mailto:$email"]],
        [['text'=>"Открыть @gdeoko",'url'=>'https://t.me/gdeoko']],
    ];
    tgWithButtons(DANIEL_TG, $tgMsg, $tgBtns);

    echo json_encode(['ok'=>true]);
    break;

// ──────────────────────────────────────────────────
// checkPaid — браузер проверяет статус оплаты
// ──────────────────────────────────────────────────
case 'checkPaid':
    $email   = trim($_GET['email']   ?? '');
    $product = trim($_GET['product'] ?? '');
    if (!$email) { echo json_encode(['paid'=>false]); break; }
    $data = loadData();
    foreach ($data['subscribers'] as $s) {
        if ($s['email'] === $email && !empty($s['paid'])) {
            echo json_encode(['paid'=>true,'name'=>$s['name']??'']); break 2;
        }
    }
    echo json_encode(['paid'=>false]);
    break;

// ──────────────────────────────────────────────────
// drip — дожим (вызывается из cron.php)
// ──────────────────────────────────────────────────
case 'drip':
    $key = $_GET['key'] ?? '';
    if ($key !== ADMIN_KEY) { http_response_code(403); echo json_encode(['ok'=>false]); break; }

    if (!is_dir(PARTIALS_DIR)) { echo json_encode(['ok'=>true,'sent'=>0]); break; }

    $sent = 0;
    foreach (glob(PARTIALS_DIR . '*.json') as $f) {
        $p = json_decode(file_get_contents($f), true);
        if (!$p || empty($p['email'])) continue;

        $elapsed = time() - ($p['ts'] ?? 0);
        $email   = $p['email'];
        $name    = $p['name'] ?? 'друг';
        $product = $p['product'] ?? 'sistema';
        $tariff  = $p['tariff'] ?? '';

        global $PRODUCTS, $TARIFFS;
        $prod       = $PRODUCTS[$product] ?? ['name'=>$product,'emoji'=>'🎯','lava'=>null];
        $prodName   = $prod['name'];
        $prodEmoji  = $prod['emoji'];
        $lavaUrl    = $prod['lava'] ?? LAVA_SISTEMA;
        $tariffInfo = $TARIFFS[$tariff] ?? null;
        $tariffStr  = $tariffInfo ? $tariffInfo['name'] . ($tariffInfo['price'] ? ' — '.$tariffInfo['price'] : '') : '';

        // Дожим 1 — через 1 час
        if ($elapsed >= 3600 && empty($p['drip1'])) {
            $html = emailTpl(
                "Вы не завершили оплату",
                "<p>Привет, <strong>$name</strong>!</p>
                 <p>Вы оставили заявку на <strong>$prodEmoji $prodName</strong>" . ($tariffStr ? " ($tariffStr)" : '') . ", но оплата не прошла.</p>
                 <p>Место ещё забронировано — осталось только завершить оплату. Мы берём всего 50 клиентов в месяц.</p>
                 <p style='font-size:12px;color:rgba(255,255,255,0.4)'>Есть вопросы? <a href='https://t.me/ktodaniel' style='color:#9AFF00'>@ktodaniel</a></p>",
                [['text'=>'Завершить оплату','url'=>$lavaUrl,'primary'=>true]]
            );
            if (sendEmail($email, "Вы не завершили оплату — OKO TEAM", $html)) {
                $p['drip1'] = true;
                file_put_contents($f, json_encode($p, JSON_UNESCAPED_UNICODE));
                $sent++;
            }
        }

        // Дожим 2 — через 24 часа
        if ($elapsed >= 86400 && !empty($p['drip1']) && empty($p['drip2'])) {
            $html = emailTpl(
                "Последний шанс",
                "<p>Привет, <strong>$name</strong>!</p>
                 <p>Это последнее напоминание о вашей заявке на <strong>$prodEmoji $prodName</strong>.</p>
                 <p>Места ограничены — если не оплатить сейчас, место перейдёт следующему.</p>
                 <p>Если передумали или есть вопросы — напишите Даниэлю, он всё объяснит.</p>",
                [
                    ['text'=>'Оплатить сейчас','url'=>$lavaUrl,'primary'=>true],
                    ['text'=>'Написать Даниэлю','url'=>'https://t.me/ktodaniel','primary'=>false],
                ]
            );
            if (sendEmail($email, "Последний шанс — место ещё ваше · OKO TEAM", $html)) {
                $p['drip2'] = true;
                file_put_contents($f, json_encode($p, JSON_UNESCAPED_UNICODE));
                $sent++;
            }
        }

        // Если прошло 48 часов и оба дожима отправлены — удаляем
        if ($elapsed >= 172800 && !empty($p['drip1']) && !empty($p['drip2'])) {
            unlink($f);
        }
    }

    echo json_encode(['ok'=>true,'sent'=>$sent]);
    break;

// ──────────────────────────────────────────────────
// sendNewsletter — рассылка
// ──────────────────────────────────────────────────
case 'sendNewsletter':
    $key = $body['key'] ?? '';
    if ($key !== ADMIN_KEY) { echo json_encode(['ok'=>false,'error'=>'Нет доступа']); break; }
    $subject = $body['subject'] ?? '';
    $content = $body['content'] ?? '';
    $btnText = $body['btnText'] ?? '';
    $btnUrl  = $body['btnUrl']  ?? '';
    $segment = $body['segment'] ?? 'all';
    $product = $body['product'] ?? '';
    if (!$subject || !$content) { echo json_encode(['ok'=>false,'error'=>'Нет темы или текста']); break; }
    $data = loadData();
    $subs = $data['subscribers'];
    if ($segment === 'paid')    $subs = array_filter($subs, fn($s) => !empty($s['paid']));
    elseif ($segment === 'unpaid') $subs = array_filter($subs, fn($s) => empty($s['paid']));
    elseif ($segment === 'product' && $product) $subs = array_filter($subs, fn($s) => in_array($product, $s['products']??[]));
    $sent = 0; $failed = 0;
    $btns = $btnText ? [['text'=>$btnText,'url'=>$btnUrl,'primary'=>true]] : [];
    foreach ($subs as $sub) {
        $personalContent = str_replace(['{{name}}','{{email}}'], [$sub['name']??'друг', $sub['email']], $content);
        $html = emailTpl($subject, nl2br(htmlspecialchars($personalContent)), $btns);
        sendEmail($sub['email'], $subject, $html) ? $sent++ : $failed++;
        usleep(300000);
    }
    $data['newsletter_log'][] = ['ts'=>date('Y-m-d H:i:s'),'subject'=>$subject,'segment'=>$segment,'sent'=>$sent,'failed'=>$failed];
    saveData($data);
    echo json_encode(['ok'=>true,'sent'=>$sent,'failed'=>$failed]);
    break;

// ──────────────────────────────────────────────────
// getStats / getSubscribers / manualConfirm
// ──────────────────────────────────────────────────
case 'saveAnketa':
    $anketaFile = __DIR__ . '/anketas.json';
    $anketas = file_exists($anketaFile) ? json_decode(file_get_contents($anketaFile), true) : [];
    if (!is_array($anketas)) $anketas = [];

    $anketa_id  = $body['anketa_id'] ?? ('ank_' . time());
    $clientName = $body['name']    ?? '';
    $clientEmail= $body['email']   ?? '';
    $isComplete = !empty($body['complete']) || (($body['progress'] ?? 0) >= ($body['total'] ?? 1));

    $anketas[$anketa_id] = [
        'id'       => $anketa_id,
        'product'  => $body['product'] ?? 'sistema',
        'name'     => $clientName,
        'email'    => $clientEmail,
        'answers'  => $body['answers'] ?? [],
        'progress' => $body['progress'] ?? 0,
        'total'    => $body['total']    ?? 0,
        'ts'       => $body['ts']       ?? date('c'),
        'complete' => $isComplete,
    ];

    $writeResult = file_put_contents($anketaFile, json_encode($anketas, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    if ($writeResult === false) {
        // Try creating the file with open permissions
        @chmod(dirname($anketaFile), 0755);
        file_put_contents($anketaFile, json_encode($anketas, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    // Send notifications only when fully complete
    if ($isComplete && !empty($body['send_notifications'])) {
        $answers = $body['answers'] ?? [];

        // Build answers HTML for email
        $answersHtml = '';
        foreach ($answers as $k => $v) {
            if (strpos($k, '__file__') === 0) continue;
            if (empty($v)) continue;
            $vStr = is_array($v) ? implode(', ', $v) : str_replace('|||', ' · ', (string)$v);
            $answersHtml .= "<tr><td style='padding:6px 10px;color:rgba(255,255,255,.5);font-size:11px;vertical-align:top;width:35%'>".htmlspecialchars($k)."</td>"
                          . "<td style='padding:6px 10px;color:#fff;font-size:12px'>".nl2br(htmlspecialchars($vStr))."</td></tr>";
        }

        // Download URL for this anketa
        $downloadUrl = SITE_URL . '/api.php?action=downloadAnketa&id=' . urlencode($anketa_id);

        // Email to Daniel
        $toMe = DANIEL_EMAIL;
        $subjMe = "📋 Новая анкета СИСТЕМА OKO — " . ($clientName ?: 'Клиент');
        $bodyMe = emailTpl($subjMe,
            "<p>Клиент <strong>" . htmlspecialchars($clientName) . "</strong> заполнил анкету СИСТЕМА OKO.</p>"
            . ($clientEmail ? "<p>Email: <a href='mailto:{$clientEmail}' style='color:#9AFF00'>{$clientEmail}</a></p>" : "")
            . "<p style='margin-top:16px;font-size:12px;color:rgba(255,255,255,.5)'>Ответы на анкету:</p>"
            . "<table style='width:100%;border-collapse:collapse;margin-top:6px;background:rgba(255,255,255,.03);border-radius:8px'>{$answersHtml}</table>",
            array_filter([
                ['text'=>'Скачать анкету', 'url'=> $downloadUrl, 'primary'=>true],
                !empty($answers['q7d']) ? ['text'=>'Написать в Telegram', 'url'=>'https://t.me/'.ltrim($answers['q7d']??'','@'), 'primary'=>false] : null,
                $clientEmail ? ['text'=>'Написать на email', 'url'=>'mailto:'.$clientEmail, 'primary'=>false] : null,
            ])
        );
        sendEmail($toMe, $subjMe, $bodyMe);

        // Telegram to Daniel with inline keyboard buttons
        $tgText = "📋 <b>Новая анкета СИСТЕМА OKO</b>

"
            . "👤 " . htmlspecialchars($clientName ?: '—') . "
"
            . ($clientEmail ? "📧 " . htmlspecialchars($clientEmail) . "
" : "")
            . "
<i>Нажми кнопку ниже чтобы скачать анкету</i>";
        $tgButtons = [];
        $tgButtons[] = ['text' => '📥 Скачать анкету', 'url' => $downloadUrl];
        // Telegram link to client
        $clientTg = ltrim($answers['q7d'] ?? '', '@');
        if ($clientTg) {
            $tgButtons[] = ['text' => '💬 Написать в Telegram', 'url' => 'https://t.me/' . $clientTg];
        } elseif ($clientEmail) {
            $tgButtons[] = ['text' => '✉️ Написать на email', 'url' => 'mailto:' . $clientEmail];
        }
        tgWithButtons(DANIEL_TG, $tgText, [$tgButtons]);

        // Email to client (if email provided)
        if ($clientEmail) {
            $subjClient = "Твоя анкета получена — OKO TEAM";
            $bodyClient = emailTpl("Анкета получена!",
                "<p>Привет, <strong>" . htmlspecialchars($clientName ?: 'друг') . "</strong>!</p>"
                . "<p>Твоя анкета СИСТЕМА OKO успешно получена 🎉</p>"
                . "<p>Даниэль уже видит твои ответы и скоро выйдет на связь с тобой.</p>"
                . "<p style='margin-top:16px;font-size:12px;color:rgba(255,255,255,.5)'>Если нужна помощь — напиши напрямую: <a href='https://t.me/ktodaniel' style='color:#9AFF00'>@ktodaniel</a></p>",
                [
                    ['text'=>'Скачать мою анкету', 'url'=> $downloadUrl, 'primary'=>true],
                    ['text'=>'Написать Даниэлю', 'url'=>'https://t.me/ktodaniel', 'primary'=>false]
                ]
            );
            sendEmail($clientEmail, $subjClient, $bodyClient);
        }
    }

    echo json_encode(['ok' => true]);
    break;

case 'downloadAnketa':
    $anketaFile = __DIR__ . '/anketas.json';
    $anketas = file_exists($anketaFile) ? json_decode(file_get_contents($anketaFile), true) : [];
    $aid = $_GET['id'] ?? '';
    if (!$aid || !isset($anketas[$aid])) { http_response_code(404); echo 'Анкета не найдена'; exit; }
    $a = $anketas[$aid];
    $clientName = $a['name'] ?? 'Клиент';
    $clientEmail = $a['email'] ?? '';
    $date = date('d.m.Y', strtotime($a['ts'] ?? 'now'));
    $answers = $a['answers'] ?? [];

    $qLabels = [
      'q1'=>'Имя','q2'=>'Имя в контенте / псевдоним','q3'=>'Чем занимаешься',
      'q4'=>'Ниша','q4b'=>'Ниша (своя)','q5'=>'Опыт в теме','q6'=>'История',
      'q7'=>'Город и страна','q7b'=>'Email','q7c'=>'Телефон','q7d'=>'Telegram',
      'q8'=>'Уникальность как эксперта',
      'q9'=>'Что продаёшь сейчас','q10'=>'Продукты в планах',
      'q11'=>'Доход сейчас','q12'=>'Цель через 3 месяца','q13'=>'Цель через год',
      'q14'=>'Откуда приходят клиенты','q15'=>'Новых клиентов в месяц',
      'q16'=>'Средний чек (₽)','q17'=>'Подписочная модель / клуб',
      'q18-ig'=>'Instagram','q18-tg'=>'Telegram канал','q18-yt'=>'YouTube',
      'q18-tt'=>'TikTok','q18-vk'=>'ВКонтакте','q18-site'=>'Сайт',
      'q19'=>'Подписчики по платформам','q20'=>'Приоритетная платформа',
      'q21'=>'Частота публикаций','q22'=>'Что публикуешь','q23'=>'Съёмка',
      'q24'=>'Контент который заходил','q25'=>'Что не работало',
      'q26'=>'ИИ-инструменты','q27'=>'Язык контента',
      'q28'=>'Логотип','q29'=>'Фирменные цвета','q30'=>'Стиль визуала',
      'q31'=>'Референсы аккаунтов','q32'=>'Стиль общения с аудиторией',
      'q33'=>'Фото/видео в качестве','q34'=>'Фото для аватара',
      'q35'=>'Идеальный клиент','q36'=>'Проблема и желание клиента',
      'q37'=>'Конкуренты','q38'=>'Отличие от конкурентов',
      'q39'=>'Возражения клиентов','q40'=>'Что говорят клиенты',
      'q41'=>'Цифры результатов клиентов',
      'q42'=>'Команда','q43'=>'Менеджер продаж','q44'=>'Бюджет на продвижение',
      'q45'=>'Часов в день на контент','q46'=>'Сервисы и инструменты',
      'q46b'=>'Съёмка — каждый день или пакетами',
      'q47'=>'Период системы','q48'=>'Главная цель','q49'=>'Что мешало расти',
      'q50'=>'Что пробовал — не сработало','q51'=>'Мечта на 1-3 года',
      'q52'=>'Что ещё важно знать',
      'q53'=>'Способы оплаты','q54'=>'Telegram для клиентов',
      'q55'=>'Время публикаций','q56'=>'Типичное время публикации',
      'q57'=>'Отзывы клиентов','q58'=>'Сильные цифры результатов',
      'q59'=>'Частые вопросы аудитории','q60'=>'ФИО для договора',
      'q61'=>'Город регистрации','q62'=>'Гарантии клиентам',
      'q63'=>'Идеи для лид-магнитов','q64'=>'Ограничения по местам/датам',
      'qX1'=>'Название проекта / бренда','qX1b'=>'Название (своё)',
      'qX2'=>'Стиль общения (ты/вы)','qX3'=>'Фирменные фразы',
      'qX4'=>'Дешёвый входной продукт','qX5'=>'Правовая форма',
      'qX5b'=>'Правовая форма (своя)','qX6'=>'HeyGen аккаунт',
      'qX7'=>'Часовой пояс','qX8'=>'Готовый контент в запасе',
      'qFINAL-text'=>'Дополнение от клиента',
    ];

    $rows = '';
    $mediaItems = [];

    foreach ($answers as $k => $v) {
        // Collect media separately
        if ($k === '__media__items' && is_array($v)) {
            $mediaItems = $v;
            continue;
        }
        if (strpos($k, '__') === 0) continue;
        if (empty($v) && $v !== '0') continue;

        $label = $qLabels[$k] ?? $k;
        $vStr = is_array($v) ? implode(', ', $v) : str_replace('|||', ' · ', (string)$v);
        $vStr = preg_replace('/<svg-[^>]+>/', '', $vStr);
        $vStr = trim($vStr);
        if (empty($vStr)) continue;
        $rows .= '<tr><td class="ql">'.htmlspecialchars($label).'</td>'
               . '<td class="qv">'.nl2br(htmlspecialchars($vStr)).'</td></tr>';
    }

    // Build media HTML
    $mediaHtml = '';
    foreach ($mediaItems as $m) {
        $mname = htmlspecialchars($m['name'] ?? '');
        $mtype = $m['mimeType'] ?? '';
        $mdata = $m['dataUrl'] ?? '';
        if (!$mdata) continue;
        if (strpos($mtype, 'image/') === 0) {
            $mediaHtml .= '<div class="media-item">'
                . '<div class="media-lbl">📎 '.$mname.'</div>'
                . '<img src="'.htmlspecialchars($mdata).'" style="max-width:100%;border-radius:10px;margin-top:8px;display:block">'
                . '</div>';
        } elseif (strpos($mtype, 'audio/') === 0) {
            $mediaHtml .= '<div class="media-item">'
                . '<div class="media-lbl">🎙 '.$mname.'</div>'
                . '<audio controls src="'.htmlspecialchars($mdata).'" style="width:100%;margin-top:8px"></audio>'
                . '</div>';
        } elseif (strpos($mtype, 'video/') === 0) {
            $mediaHtml .= '<div class="media-item">'
                . '<div class="media-lbl">📹 '.$mname.'</div>'
                . '<video controls src="'.htmlspecialchars($mdata).'" style="max-width:100%;border-radius:10px;margin-top:8px;display:block"></video>'
                . '</div>';
        } else {
            $mediaHtml .= '<div class="media-item"><div class="media-lbl">📎 '.$mname.'</div></div>';
        }
    }

    header('Content-Type: text/html; charset=utf-8');
    header('Content-Disposition: attachment; filename="Anketa_'.rawurlencode($clientName).'_'.$date.'.html"');

    echo '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Анкета — '.$clientName.' — '.$date.'</title>
<link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#060606;color:#fff;font-family:"Onest",sans-serif;min-height:100vh;padding:24px 16px 48px}
.wrap{max-width:760px;margin:0 auto}
.logo-row{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.logo-ico{width:42px;height:42px;background:#000;border:2px solid #9AFF00;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.logo-name{font-size:18px;font-weight:900;color:#fff}
.logo-name span{color:#9AFF00}
.logo-sub{font-size:10px;color:rgba(255,255,255,.35);letter-spacing:2px;text-transform:uppercase;margin-top:2px}
.hdr{background:#0b0b0b;border:1px solid rgba(154,255,0,0.2);border-radius:16px;padding:22px 24px;margin-bottom:20px}
.hdr-name{font-size:24px;font-weight:900;color:#fff;margin-bottom:8px}
.hdr-meta{display:flex;flex-wrap:wrap;gap:8px 16px}
.hdr-tag{font-size:12px;color:rgba(255,255,255,.45);display:flex;align-items:center;gap:5px}
.hdr-tag b{color:rgba(255,255,255,.75);font-weight:600}
.card{background:#0b0b0b;border:1px solid rgba(255,255,255,.07);border-radius:14px;overflow:hidden;margin-bottom:16px}
.card-title{padding:12px 18px;background:rgba(154,255,0,.05);border-bottom:1px solid rgba(154,255,0,.1);font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(154,255,0,.8)}
table{width:100%;border-collapse:collapse}
.ql{padding:11px 18px;color:rgba(255,255,255,.35);font-size:11px;font-weight:700;letter-spacing:.5px;vertical-align:top;width:33%;border-bottom:1px solid rgba(255,255,255,.05);text-transform:uppercase}
.qv{padding:11px 18px;font-size:13px;color:rgba(255,255,255,.82);vertical-align:top;border-bottom:1px solid rgba(255,255,255,.05);line-height:1.6}
tr:last-child .ql, tr:last-child .qv{border-bottom:none}
.media-section{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.media-item{background:rgba(154,255,0,.04);border:1px solid rgba(154,255,0,.1);border-radius:10px;padding:12px}
.media-lbl{font-size:12px;color:rgba(154,255,0,.8);font-weight:700;margin-bottom:4px}
.foot{text-align:center;padding:24px 0 8px;font-size:12px;color:rgba(255,255,255,.2)}
.foot a{color:rgba(154,255,0,.5);text-decoration:none}
</style>
</head><body>
<div class="wrap">

<div class="logo-row">
  <div class="logo-ico">
    <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
      <path d="M4 20 C10 8 30 8 36 20 C30 32 10 32 4 20Z" fill="none" stroke="#9AFF00" stroke-width="2.5"/>
      <circle cx="20" cy="20" r="6" fill="none" stroke="#9AFF00" stroke-width="2.5"/>
      <circle cx="20" cy="20" r="2.5" fill="#9AFF00"/>
    </svg>
  </div>
  <div>
    <div class="logo-name">ОКО<span> TEAM</span></div>
    <div class="logo-sub">Система роста</div>
  </div>
</div>

<div class="hdr">
  <div class="hdr-name">'.htmlspecialchars($clientName).'</div>
  <div class="hdr-meta">
    <div class="hdr-tag"><b>📅 '.$date.'</b></div>
    '.($clientEmail ? '<div class="hdr-tag">📧 <b>'.htmlspecialchars($clientEmail).'</b></div>' : '').'
    '.(!empty($answers['q7c']) ? '<div class="hdr-tag">📞 <b>'.htmlspecialchars($answers['q7c']).'</b></div>' : '').'
    '.(!empty($answers['q7d']) ? '<div class="hdr-tag">💬 <b>'.htmlspecialchars($answers['q7d']).'</b></div>' : '').'
    <div class="hdr-tag">📋 <b>Анкета СИСТЕМА OKO</b></div>
  </div>
</div>

<div class="card">
  <div class="card-title">Ответы на анкету</div>
  <table>'.$rows.'</table>
</div>

'.($mediaHtml ? '<div class="card"><div class="card-title">Прикреплённые файлы</div><div class="media-section">'.$mediaHtml.'</div></div>' : '').'

<div class="foot">
  OKO TEAM &nbsp;·&nbsp; <a href="https://okoteam.top">okoteam.top</a> &nbsp;·&nbsp; <a href="https://t.me/ktodaniel">@ktodaniel</a>
</div>

</div></body></html>';
    exit;

case 'getAnketas':
    if (($_GET['key'] ?? '') !== ADMIN_KEY) { echo json_encode(['ok'=>false,'error'=>'auth']); break; }
    $anketaFile = __DIR__ . '/anketas.json';
    $anketas = file_exists($anketaFile) ? json_decode(file_get_contents($anketaFile), true) : [];
    if (!is_array($anketas)) $anketas = [];
    // Sort by ts desc
    usort($anketas, function($a, $b) { return strcmp($b['ts'] ?? '', $a['ts'] ?? ''); });
    echo json_encode(['ok' => true, 'anketas' => array_values($anketas)]);
    break;

case 'getStats':
    $key = $_GET['key'] ?? '';
    if ($key !== ADMIN_KEY) { echo json_encode(['ok'=>false]); break; }
    $data = loadData();
    $subs = $data['subscribers'];
    $paid = array_filter($subs, fn($s) => !empty($s['paid']));
    $byProduct = [];
    foreach ($subs as $s) foreach ($s['products']??[] as $p) $byProduct[$p] = ($byProduct[$p]??0)+1;
    echo json_encode(['ok'=>true,'total_subs'=>count($subs),'paid'=>count($paid),'unpaid'=>count($subs)-count($paid),'payments'=>count($data['payments']??[]),'by_product'=>$byProduct,'newsletter_log'=>array_slice(array_reverse($data['newsletter_log']??[]),0,10),'recent_subs'=>array_slice(array_reverse($subs),0,20)]);
    break;

case 'getSubscribers':
    $key = $_GET['key'] ?? '';
    if ($key !== ADMIN_KEY) { echo json_encode(['ok'=>false]); break; }
    $data = loadData();
    echo json_encode(['ok'=>true,'subscribers'=>$data['subscribers'],'payments'=>$data['payments']??[]]);
    break;

case 'manualConfirm':
    $key     = $_GET['key']     ?? '';
    $email   = trim($_GET['email']   ?? '');
    $product = trim($_GET['product'] ?? 'sistema');
    if ($key !== ADMIN_KEY) { echo json_encode(['ok'=>false,'error'=>'Нет доступа']); break; }
    if (!$email) { echo json_encode(['ok'=>false,'error'=>'Нет email']); break; }
    $data = loadData(); $name = 'Клиент'; $found = false;
    foreach ($data['subscribers'] as &$s) {
        if ($s['email'] === $email) {
            $s['paid'] = true; $s['paid_product'] = $product;
            $s['paid_ts'] = date('Y-m-d H:i:s');
            $name = $s['name'] ?? 'Клиент'; $found = true; break;
        }
    }
    if (!$found) $data['subscribers'][] = ['email'=>$email,'name'=>'Клиент','phone'=>'','tg'=>'','products'=>[$product],'paid'=>true,'paid_product'=>$product,'paid_ts'=>date('Y-m-d H:i:s'),'ts'=>date('Y-m-d H:i:s'),'last_action'=>date('Y-m-d H:i:s')];
    $data['payments'][] = ['email'=>$email,'name'=>$name,'product'=>$product,'manual'=>true,'ts'=>date('Y-m-d H:i:s')];
    $data['settings']['order_count'] = ($data['settings']['order_count']??0)+1;
    saveData($data);
    $lf = PARTIALS_DIR . md5($email.$product) . '.json';
    if (file_exists($lf)) unlink($lf);
    global $PRODUCTS;
    $prod = $PRODUCTS[$product] ?? ['name'=>$product,'emoji'=>''];
    $clientHtml = emailTpl("Оплата подтверждена!", "<p>Привет, <strong>$name</strong>!</p><p>Оплата по <strong>{$prod['emoji']} {$prod['name']}</strong> подтверждена. Даниэль скоро напишет тебе.</p>", [['text'=>'Написать Даниэлю','url'=>'https://t.me/ktodaniel','primary'=>true]]);
    sendEmail($email, "Оплата подтверждена — OKO TEAM", $clientHtml);
    echo json_encode(['ok'=>true,'message'=>"Готово! Письма отправлены для $email"]);
    break;

default:
    echo json_encode(['ok'=>false,'error'=>'unknown action']);
}
