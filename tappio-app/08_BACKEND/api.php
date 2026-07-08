<?php
/*
╔══════════════════════════════════════════════════════════════════╗
║  TAPPIO · API BACKEND                                        ║
║  Контракт №005/2026 ИМПЕРИЯ · OKO TEAM × @a_trafico              ║
║                                                                  ║
║  Actions:                                                        ║
║   saveLead     — клиент оставил email (форма / чат-бот / exit)   ║
║   drip         — крон-эндпоинт (дожимы)                          ║
║   newsletter   — рассылка по сегментам                           ║
║   getStats     — статистика для админа                           ║
║   getLeads     — список лидов                                    ║
║   download     — скачивание лид-магнита PDF                      ║
║   unsubscribe  — отписка                                         ║
╚══════════════════════════════════════════════════════════════════╝
*/

// ── CONFIG ───────────────────────────────────────────────────────
define('SITE_URL',     'https://tappio.pro');     // подставить реальный домен
define('SITE_NAME',    'Tappio');
define('GMAIL',        'tappio.app@gmail.com');    // основная почта
define('GMAIL_PASS',   'higoqygkblmpsnpk');         // app-password Gmail (без пробелов!)
define('GMAIL_NAME',   'Tappio');
define('TG_TOKEN',     '8681257013:AAGL56AFYPVddqrqY9DOcgK6wJoJjS_BxXw'); // тот же что в OKO для уведомлений
define('ADMIN_TG_ID',  '1966985736');                      // Даниэль
define('CLIENT_TG_ID', '');                                // Александр — подставить когда даст
define('ADMIN_KEY',    'tappio_2026_secret_key');              // для крона

define('DATA_FILE',    __DIR__ . '/data.json');
define('PARTIALS_DIR', __DIR__ . '/partials');
define('LOG_FILE',     __DIR__ . '/api.log');

// App Store links
$APP_LINKS = [
  'spy'   => 'https://apps.apple.com/us/app/spy-camera-finder-scanner/id6760315795',
  'brain' => 'https://apps.apple.com/us/app/brainova-daily-mind-workout/id6759396840',
  'tape'  => 'https://apps.apple.com/us/app/3d-tape-measure/id6755061647',
];
$APP_NAMES = [
  'spy'   => 'Spy Camera Finder',
  'brain' => 'Brainova',
  'tape'  => '3D Tape Measure',
];
$APP_ACCENTS = [
  'spy'   => '#00D9FF',
  'brain' => '#C77DFF',
  'tape'  => '#F4C430',
];

// Лид-магниты (PDF файлы)
$LEAD_MAGNETS = [
  'spy'   => ['file'=>'lead-magnets/spy-airbnb-hidden-cameras.pdf',  'title'=>'5 Places Hidden Cameras Hide in Airbnbs'],
  'brain' => ['file'=>'lead-magnets/brain-7day-starter-plan.pdf',    'title'=>'7-Day Brain Workout Starter Plan'],
  'tape'  => ['file'=>'lead-magnets/tape-furniture-checklist.pdf',   'title'=>'Furniture Measurement Checklist'],
  'bundle'=> ['file'=>'lead-magnets/tappio-starter-bundle.pdf',  'title'=>'Tappio · Starter Bundle'],
];

// ── HEADERS ──────────────────────────────────────────────────────
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') exit;

// ── STORAGE ──────────────────────────────────────────────────────
function loadData(): array {
    if (!file_exists(DATA_FILE)) {
        return ['leads' => [], 'log' => [], 'settings' => []];
    }
    $raw = @file_get_contents(DATA_FILE);
    $d = $raw ? json_decode($raw, true) : null;
    if (!is_array($d)) $d = ['leads' => [], 'log' => [], 'settings' => []];
    if (!isset($d['leads']))    $d['leads']    = [];
    if (!isset($d['log']))      $d['log']      = [];
    if (!isset($d['settings'])) $d['settings'] = [];
    return $d;
}
function saveData(array $d): bool {
    return @file_put_contents(DATA_FILE, json_encode($d, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT)) !== false;
}
function logLine(string $msg): void {
    @file_put_contents(LOG_FILE, '['.date('Y-m-d H:i:s').'] '.$msg."\n", FILE_APPEND);
}

// ── EMAIL ────────────────────────────────────────────────────────
function sendEmail(string $to, string $subject, string $body): bool {
    if (!$to) return false;
    $msg  = "From: " . GMAIL_NAME . " <" . GMAIL . ">\r\n";
    $msg .= "To: {$to}\r\n";
    $msg .= "Subject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
    $msg .= "MIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n";
    $msg .= $body;
    // Приоритет: curl SMTP к Gmail
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
        logLine("SMTP error: $err");
    }
    // Fallback: PHP mail()
    $headers = "From: " . GMAIL_NAME . " <" . GMAIL . ">\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n";
    return @mail($to, '=?UTF-8?B?'.base64_encode($subject).'?=', $body, $headers);
}

// ── TELEGRAM ─────────────────────────────────────────────────────
function sendTelegram(string $chatId, string $text): void {
    if (!TG_TOKEN || !$chatId) return;
    $url  = 'https://api.telegram.org/bot'.TG_TOKEN.'/sendMessage';
    $data = ['chat_id'=>$chatId,'text'=>$text,'parse_mode'=>'HTML','disable_web_page_preview'=>true];
    $opts = ['http'=>['method'=>'POST','header'=>'Content-Type: application/json','content'=>json_encode($data),'timeout'=>5]];
    @file_get_contents($url, false, stream_context_create($opts));
}
function tgWithButtons(string $chatId, string $text, array $buttons = []): void {
    if (!TG_TOKEN || !$chatId) return;
    $url  = 'https://api.telegram.org/bot'.TG_TOKEN.'/sendMessage';
    $data = ['chat_id'=>$chatId,'text'=>$text,'parse_mode'=>'HTML','disable_web_page_preview'=>true];
    if ($buttons) $data['reply_markup'] = ['inline_keyboard' => $buttons];
    $opts = ['http'=>['method'=>'POST','header'=>'Content-Type: application/json','content'=>json_encode($data),'timeout'=>5]];
    @file_get_contents($url, false, stream_context_create($opts));
}

// ── EMAIL TEMPLATES ──────────────────────────────────────────────
// Универсальный шаблон под Tappio (cyan accent по умолчанию)
function emailTpl(string $title, string $content, string $accent = '#00D9FF', array $btns = []): string {
    $btnsHtml = '';
    foreach ($btns as $btn) {
        $primary = !empty($btn['primary']);
        $bg = $primary ? $accent : 'rgba(255,255,255,0.04)';
        $cl = $primary ? '#04121a' : '#fff';
        $br = $primary ? 'none' : '1px solid rgba(255,255,255,0.12)';
        $btnsHtml .= "<a href='{$btn['url']}' style='display:block;text-align:center;background:{$bg};color:{$cl};text-decoration:none;padding:15px 24px;border-radius:12px;font-weight:800;font-family:Inter,Arial,sans-serif;font-size:14px;border:{$br};margin-bottom:10px;letter-spacing:.5px'>{$btn['text']}</a>";
    }
    $btnBlock = $btnsHtml ? "<div style='margin:24px 0'>{$btnsHtml}</div>" : '';

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>'.htmlspecialchars($title).'</title></head>
<body style="margin:0;padding:0;background:#06060a;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Inter,Arial,sans-serif;color:#fff">
<div style="max-width:580px;margin:0 auto;padding:24px 20px">

  <!-- Header -->
  <div style="text-align:center;padding:20px 0 24px;border-bottom:1px solid rgba(255,255,255,0.06)">
    <div style="display:inline-block;font-family:Inter,Arial,sans-serif;font-size:24px;font-weight:900;letter-spacing:3px;color:#fff">
      TAPP<span style="color:'.$accent.'">IO</span>
    </div>
    <div style="font-size:10px;color:rgba(255,255,255,0.4);letter-spacing:3px;text-transform:uppercase;margin-top:6px">3 Apps · Built for iPhone</div>
  </div>

  <!-- Title -->
  <h1 style="font-family:Inter,Arial,sans-serif;font-size:24px;font-weight:900;color:#fff;margin:32px 0 18px;line-height:1.25;letter-spacing:-.3px">'.$title.'</h1>

  <!-- Content card -->
  <div style="background:linear-gradient(180deg,#10131c,#0a0c14);border:1px solid rgba(255,255,255,0.06);border-left:3px solid '.$accent.';border-radius:14px;padding:24px;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.7">
    '.$content.'
  </div>

  '.$btnBlock.'

  <!-- App Store links footer -->
  <div style="margin-top:32px;padding:18px;background:rgba(255,255,255,0.02);border-radius:12px;text-align:center">
    <div style="font-size:11px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px">All 3 Apps</div>
    <div>
      <a href="https://apps.apple.com/us/app/spy-camera-finder-scanner/id6760315795" style="display:inline-block;margin:0 6px;padding:6px 10px;color:#00D9FF;text-decoration:none;font-size:12px;font-weight:600">Spy Camera</a>
      <a href="https://apps.apple.com/us/app/brainova-daily-mind-workout/id6759396840" style="display:inline-block;margin:0 6px;padding:6px 10px;color:#C77DFF;text-decoration:none;font-size:12px;font-weight:600">Brainova</a>
      <a href="https://apps.apple.com/us/app/3d-tape-measure/id6755061647" style="display:inline-block;margin:0 6px;padding:6px 10px;color:#F4C430;text-decoration:none;font-size:12px;font-weight:600">3D Tape</a>
    </div>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding:24px 0 8px;font-size:11px;color:rgba(255,255,255,0.25);line-height:1.7">
    '.SITE_NAME.' · '.SITE_URL.'<br>
    <a href="'.SITE_URL.'/api.php?action=unsubscribe&email={{email}}" style="color:rgba(255,255,255,0.35);text-decoration:underline">Unsubscribe</a>
    &middot;
    <a href="mailto:'.GMAIL.'" style="color:rgba(255,255,255,0.35);text-decoration:none">Contact us</a>
  </div>

</div></body></html>';
}

// Шаблон #1 — Welcome / Lead-magnet (Spy)
function emailSpy(string $name, string $email): string {
    $title = "Your hidden-camera spotting guide is here";
    $content = '
<p style="margin:0 0 14px">Hi <b style="color:#fff">'.htmlspecialchars($name).'</b>,</p>
<p style="margin:0 0 14px">Welcome — thanks for joining. As promised, here\'s the full <b>"5 Places Hidden Cameras Hide in Airbnbs"</b> guide. Inside:</p>
<ul style="margin:14px 0;padding-left:22px;line-height:1.85">
  <li>The 5 most common spots hosts use to hide cameras</li>
  <li>How to do a 12-second scan when you arrive somewhere new</li>
  <li>What to do if you actually find something</li>
  <li>Real cases — what happened to other travellers</li>
</ul>
<p style="margin:14px 0">Tap below to download. Save it on your phone — read before your next trip.</p>';
    $btns = [
      ['text'=>'Download Free Guide (PDF)', 'url'=>SITE_URL.'/api.php?action=download&product=spy&email='.urlencode($email), 'primary'=>true],
      ['text'=>'Get Spy Camera Finder · App Store', 'url'=>'https://apps.apple.com/us/app/spy-camera-finder-scanner/id6760315795'],
    ];
    return emailTpl($title, $content, '#00D9FF', $btns);
}

// Шаблон #2 — Brainova
function emailBrain(string $name, string $email): string {
    $title = "Your 7-Day Brain Workout starts now";
    $content = '
<p style="margin:0 0 14px">Hi <b style="color:#fff">'.htmlspecialchars($name).'</b>,</p>
<p style="margin:0 0 14px">Welcome. Here\'s the <b>7-Day Brain Workout Starter Plan</b> we promised. Inside:</p>
<ul style="margin:14px 0;padding-left:22px;line-height:1.85">
  <li>Day-by-day 10-minute routines (Memory, Math, Attention, Logic)</li>
  <li>How to read your Brain Score and what to aim for</li>
  <li>The 3 habits that 2x your improvement rate</li>
  <li>How to keep it up beyond day 7</li>
</ul>
<p style="margin:14px 0">Open it on your phone before your first session.</p>';
    $btns = [
      ['text'=>'Download Free Plan (PDF)', 'url'=>SITE_URL.'/api.php?action=download&product=brain&email='.urlencode($email), 'primary'=>true],
      ['text'=>'Get Brainova · App Store', 'url'=>'https://apps.apple.com/us/app/brainova-daily-mind-workout/id6759396840'],
    ];
    return emailTpl($title, $content, '#C77DFF', $btns);
}

// Шаблон #3 — 3D Tape
function emailTape(string $name, string $email): string {
    $title = "Your Furniture Measurement Checklist";
    $content = '
<p style="margin:0 0 14px">Hi <b style="color:#fff">'.htmlspecialchars($name).'</b>,</p>
<p style="margin:0 0 14px">Here\'s the <b>Furniture Measurement Checklist</b> as promised. Open this before any IKEA / Wayfair / Home Depot / Pottery Barn trip:</p>
<ul style="margin:14px 0;padding-left:22px;line-height:1.85">
  <li>The 9 dimensions you must check before buying any furniture</li>
  <li>Doorways, hallways, elevators — the "will it fit through" math</li>
  <li>Polygon-area measurement for L-shaped rooms</li>
  <li>How to export your project as a PDF you can show in-store</li>
</ul>
<p style="margin:14px 0">Print it or open on your phone — works either way.</p>';
    $btns = [
      ['text'=>'Download Free Checklist (PDF)', 'url'=>SITE_URL.'/api.php?action=download&product=tape&email='.urlencode($email), 'primary'=>true],
      ['text'=>'Get 3D Tape Measure · App Store', 'url'=>'https://apps.apple.com/us/app/3d-tape-measure/id6755061647'],
    ];
    return emailTpl($title, $content, '#F4C430', $btns);
}

// Шаблон #4 — Bundle (3 apps starter)
function emailBundle(string $name, string $email): string {
    $title = "Welcome to Tappio — here are your tools";
    $content = '
<p style="margin:0 0 14px">Hi <b style="color:#fff">'.htmlspecialchars($name).'</b>,</p>
<p style="margin:0 0 14px">Thanks for joining. You picked the bundle, so here\'s your <b>Tappio Starter Pack</b> — quick guide to all 3 apps:</p>
<ul style="margin:14px 0;padding-left:22px;line-height:1.85">
  <li><b style="color:#00D9FF">Spy Camera Finder</b> — when to scan, how to read results</li>
  <li><b style="color:#C77DFF">Brainova</b> — daily 10-minute routine to start with</li>
  <li><b style="color:#F4C430">3D Tape Measure</b> — measurement workflow for every project</li>
</ul>
<p style="margin:14px 0">Each app is free to download. Pick the one you need first, install, and try the live demos on our site any time.</p>';
    $btns = [
      ['text'=>'Download Starter Pack (PDF)', 'url'=>SITE_URL.'/api.php?action=download&product=bundle&email='.urlencode($email), 'primary'=>true],
    ];
    return emailTpl($title, $content, '#00D9FF', $btns);
}

// Drip-1 — через 1 час: напоминание + социальное доказательство
function emailDrip1(string $name, string $product): string {
    global $APP_NAMES, $APP_LINKS, $APP_ACCENTS;
    $appName = $APP_NAMES[$product] ?? 'Tappio';
    $appUrl  = $APP_LINKS[$product] ?? SITE_URL;
    $accent  = $APP_ACCENTS[$product] ?? '#00D9FF';
    $title = "Quick reminder, ".htmlspecialchars($name);
    $content = '
<p style="margin:0 0 14px">Hi <b style="color:#fff">'.htmlspecialchars($name).'</b>,</p>
<p style="margin:0 0 14px">Just checking in — did you get a chance to download <b style="color:'.$accent.'">'.$appName.'</b> yet?</p>
<p style="margin:0 0 14px">Hundreds of new users picked it up this week. Most spend less than 5 minutes setting it up and get value the same day.</p>
<p style="margin:14px 0">It\'s free on the App Store. Two taps and you\'re in.</p>';
    $btns = [['text'=>'Get '.$appName.' Now', 'url'=>$appUrl, 'primary'=>true]];
    return emailTpl($title, $content, $accent, $btns);
}

// Drip-2 — через 24 часа: история + объяснение через кейс
function emailDrip2(string $name, string $product): string {
    global $APP_NAMES, $APP_LINKS, $APP_ACCENTS;
    $appName = $APP_NAMES[$product] ?? 'Tappio';
    $appUrl  = $APP_LINKS[$product] ?? SITE_URL;
    $accent  = $APP_ACCENTS[$product] ?? '#00D9FF';

    $stories = [
      'spy'   => 'A user in Phoenix booked an Airbnb in a small mountain town. First thing she did was run a scan — found a magnetic anomaly behind the bedroom mirror. Turned out the host had installed a "security camera" facing the bed. She got a full refund and the listing was taken down.',
      'brain' => 'Mark, 38, software engineer, started feeling foggy after work. He committed to 10 minutes of Brainova every morning with coffee. By week 3 his Brain Score went from 58 to 79. By week 6 his standups felt sharp again.',
      'tape'  => 'A couple in Chicago measured their new place by eye for their old furniture. The sofa didn\'t fit ($340 return). Then the dining table didn\'t fit ($280). Now they use 3D Tape Measure before every purchase — zero return fees this year.',
    ];
    $story = $stories[$product] ?? 'People who use Tappio report real, measurable changes within the first 30 days.';

    $title = "One real story before you go";
    $content = '
<p style="margin:0 0 14px">Hi <b style="color:#fff">'.htmlspecialchars($name).'</b>,</p>
<p style="margin:0 0 14px">Real quick — a user story we got recently:</p>
<div style="background:rgba(255,255,255,0.03);border-left:3px solid '.$accent.';padding:16px 18px;margin:18px 0;border-radius:0 10px 10px 0;font-style:italic;line-height:1.65">
'.$story.'
</div>
<p style="margin:14px 0">If something similar would help you — the app is one tap away.</p>';
    $btns = [['text'=>'Get '.$appName.' · App Store', 'url'=>$appUrl, 'primary'=>true]];
    return emailTpl($title, $content, $accent, $btns);
}

// ══════════════════════════════════════════════════════════════════
// ROUTER
// ══════════════════════════════════════════════════════════════════
$rawBody = file_get_contents('php://input');
$body    = json_decode($rawBody, true) ?? [];
$action  = $_GET['action'] ?? $body['action'] ?? '';

switch ($action) {

// ──────────────────────────────────────────────────────────────────
// saveLead — главный action, вызывается из чата / форм / exit-popup
// ──────────────────────────────────────────────────────────────────
case 'saveLead':
    $email   = trim($body['email']   ?? '');
    $name    = trim($body['name']    ?? '');
    $product = trim($body['product'] ?? 'tappio_bundle');
    $source  = trim($body['source']  ?? 'unknown');
    // нормализация: tappio_spy → spy
    $productKey = str_replace('tappio_', '', $product);
    if (!in_array($productKey, ['spy','brain','tape','bundle','contact'])) $productKey = 'bundle';

    // Базовая валидация
    if (!$email || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        echo json_encode(['ok'=>false,'error'=>'Invalid email']); break;
    }
    if (!$name || strlen($name) < 2) {
        echo json_encode(['ok'=>false,'error'=>'Name too short']); break;
    }

    $data = loadData();

    // Дедупликация — если этот email + product уже есть и не старше 5 минут, не дублируем
    $now = time();
    $isDuplicate = false;
    foreach (array_reverse($data['leads']) as $lead) {
        if ($lead['email'] === $email && $lead['product'] === $productKey && ($now - $lead['ts']) < 300) {
            $isDuplicate = true; break;
        }
    }

    if (!$isDuplicate) {
        $leadId = uniqid('lead_', true);
        $data['leads'][] = [
            'id'       => $leadId,
            'email'    => $email,
            'name'     => $name,
            'product'  => $productKey,
            'source'   => $source,
            'ts'       => $now,
            'date'     => date('Y-m-d H:i:s', $now),
            'drip1'    => false,
            'drip2'    => false,
            'unsub'    => false,
        ];
        $data['log'][] = ['action'=>'lead_saved','email'=>$email,'product'=>$productKey,'source'=>$source,'ts'=>$now];
        saveData($data);
        logLine("LEAD: $email · $productKey · $source");

        // Email клиенту (соответствующий лид-магнит)
        $emailBody = match($productKey) {
            'spy'   => emailSpy($name, $email),
            'brain' => emailBrain($name, $email),
            'tape'  => emailTape($name, $email),
            default => emailBundle($name, $email),
        };
        // Подставляем email в unsubscribe link
        $emailBody = str_replace('{{email}}', urlencode($email), $emailBody);
        $subject = match($productKey) {
            'spy'   => 'Your Airbnb hidden-camera guide is here',
            'brain' => 'Your 7-Day Brain Workout starts now',
            'tape'  => 'Your Furniture Measurement Checklist',
            default => 'Welcome to Tappio',
        };
        sendEmail($email, $subject, $emailBody);

        // Уведомление Даниэлю в TG
        $appLabel = $APP_NAMES[$productKey] ?? 'Bundle';
        $tgMsg = "<b>📥 New Tappio lead</b>\n\n"
               . "<b>Name:</b> ".htmlspecialchars($name)."\n"
               . "<b>Email:</b> <code>".htmlspecialchars($email)."</code>\n"
               . "<b>Product:</b> $appLabel\n"
               . "<b>Source:</b> ".htmlspecialchars($source)."\n"
               . "<b>Time:</b> ".date('d.m.Y H:i', $now);
        $tgButtons = [[
            ['text'=>'Email back', 'url'=>'mailto:'.$email],
            ['text'=>'All leads',  'url'=>SITE_URL.'/api.php?action=getLeads&key='.ADMIN_KEY],
        ]];
        tgWithButtons(ADMIN_TG_ID, $tgMsg, $tgButtons);
        // Клиенту (Александр) — если задан
        if (CLIENT_TG_ID) {
            sendTelegram(CLIENT_TG_ID, "📥 Новый лид Tappio:\n$appLabel · ".htmlspecialchars($email));
        }
    }

    echo json_encode(['ok'=>true,'duplicate'=>$isDuplicate]);
    break;

// ──────────────────────────────────────────────────────────────────
// drip — крон-эндпоинт (защищён ADMIN_KEY)
// Запускается каждые 30 минут
// ──────────────────────────────────────────────────────────────────
case 'drip':
    if (($_GET['key'] ?? '') !== ADMIN_KEY) {
        http_response_code(403); echo json_encode(['ok'=>false,'error'=>'forbidden']); break;
    }
    $data = loadData();
    $now = time();
    $sent1 = 0; $sent2 = 0;

    foreach ($data['leads'] as &$lead) {
        if (!empty($lead['unsub'])) continue;
        $age = $now - $lead['ts'];
        // Drip-1 через 1 час
        if (!$lead['drip1'] && $age >= 3600) {
            $body = emailDrip1($lead['name'], $lead['product']);
            $body = str_replace('{{email}}', urlencode($lead['email']), $body);
            sendEmail($lead['email'], 'Quick reminder · Tappio', $body);
            $lead['drip1'] = true;
            $sent1++;
            logLine("DRIP1: ".$lead['email']." · ".$lead['product']);
        }
        // Drip-2 через 24 часа
        if ($lead['drip1'] && !$lead['drip2'] && $age >= 86400) {
            $body = emailDrip2($lead['name'], $lead['product']);
            $body = str_replace('{{email}}', urlencode($lead['email']), $body);
            sendEmail($lead['email'], 'One real story · Tappio', $body);
            $lead['drip2'] = true;
            $sent2++;
            logLine("DRIP2: ".$lead['email']." · ".$lead['product']);
        }
    }
    unset($lead);
    saveData($data);
    echo json_encode(['ok'=>true,'drip1_sent'=>$sent1,'drip2_sent'=>$sent2]);
    break;

// ──────────────────────────────────────────────────────────────────
// download — отдача PDF лид-магнита
// ──────────────────────────────────────────────────────────────────
case 'download':
    $product = $_GET['product'] ?? 'bundle';
    $email   = $_GET['email']   ?? '';
    if (!in_array($product, ['spy','brain','tape','bundle'])) {
        http_response_code(404); echo json_encode(['ok'=>false,'error'=>'unknown product']); break;
    }
    $magnet = $LEAD_MAGNETS[$product];
    $file   = __DIR__ . '/' . $magnet['file'];
    if (!file_exists($file)) {
        http_response_code(404); echo json_encode(['ok'=>false,'error'=>'file not found']); break;
    }
    // лог
    $data = loadData();
    $data['log'][] = ['action'=>'download','product'=>$product,'email'=>$email,'ts'=>time()];
    saveData($data);

    header_remove('Content-Type');
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="'.basename($magnet['file']).'"');
    header('Content-Length: '.filesize($file));
    readfile($file);
    exit;

// ──────────────────────────────────────────────────────────────────
// unsubscribe — отписка
// ──────────────────────────────────────────────────────────────────
case 'unsubscribe':
    $email = urldecode($_GET['email'] ?? '');
    $data = loadData();
    $cnt = 0;
    foreach ($data['leads'] as &$l) {
        if ($l['email'] === $email) { $l['unsub'] = true; $cnt++; }
    }
    unset($l);
    saveData($data);
    header_remove('Content-Type');
    header('Content-Type: text/html; charset=UTF-8');
    echo '<!DOCTYPE html><html><head><title>Unsubscribed</title><style>body{background:#06060a;color:#fff;font-family:-apple-system,Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.box{max-width:480px;text-align:center;padding:48px 32px;background:#10131c;border:1px solid rgba(0,217,255,.15);border-radius:18px}h1{font-size:22px;margin:0 0 14px;color:#00D9FF}p{font-size:14px;color:rgba(255,255,255,.7);line-height:1.6}</style></head><body><div class="box"><h1>You\'re unsubscribed</h1><p>Email <b>'.htmlspecialchars($email).'</b> has been removed from future Tappio emails. We respected your inbox before, we respect it now.</p><p style="margin-top:24px"><a href="'.SITE_URL.'" style="color:#00D9FF;text-decoration:none">← Back to site</a></p></div></body></html>';
    exit;

// ──────────────────────────────────────────────────────────────────
// newsletter — рассылка по сегментам (admin only)
// ──────────────────────────────────────────────────────────────────
case 'newsletter':
    if (($body['key'] ?? '') !== ADMIN_KEY) {
        http_response_code(403); echo json_encode(['ok'=>false,'error'=>'forbidden']); break;
    }
    $segment = $body['segment'] ?? 'all'; // all | spy | brain | tape | bundle
    $subject = $body['subject'] ?? 'Update from Tappio';
    $content = $body['content'] ?? '';
    if (!$content) { echo json_encode(['ok'=>false,'error'=>'no content']); break; }

    $data = loadData();
    $sent = 0;
    foreach ($data['leads'] as $lead) {
        if (!empty($lead['unsub'])) continue;
        if ($segment !== 'all' && $lead['product'] !== $segment) continue;
        $personalized = str_replace(
            ['{{name}}','{{email}}'],
            [$lead['name'], urlencode($lead['email'])],
            $content
        );
        $html = emailTpl($subject, $personalized);
        sendEmail($lead['email'], $subject, $html);
        $sent++;
    }
    $data['log'][] = ['action'=>'newsletter','segment'=>$segment,'sent'=>$sent,'ts'=>time()];
    saveData($data);
    echo json_encode(['ok'=>true,'sent'=>$sent]);
    break;

// ──────────────────────────────────────────────────────────────────
// getStats / getLeads — для админа (Даниэль)
// ──────────────────────────────────────────────────────────────────
case 'getStats':
    if (($_GET['key'] ?? '') !== ADMIN_KEY) {
        http_response_code(403); echo json_encode(['ok'=>false,'error'=>'forbidden']); break;
    }
    $data = loadData();
    $total = count($data['leads']);
    $byProduct = ['spy'=>0,'brain'=>0,'tape'=>0,'bundle'=>0];
    $bySource  = [];
    $unsubCnt  = 0;
    foreach ($data['leads'] as $l) {
        if (isset($byProduct[$l['product']])) $byProduct[$l['product']]++;
        $src = $l['source'] ?? 'unknown';
        $bySource[$src] = ($bySource[$src] ?? 0) + 1;
        if (!empty($l['unsub'])) $unsubCnt++;
    }
    // Последние 7 дней
    $week = time() - 7*86400;
    $last7 = 0; foreach ($data['leads'] as $l) if ($l['ts'] >= $week) $last7++;
    echo json_encode([
        'ok'=>true,
        'total'=>$total,
        'last7days'=>$last7,
        'by_product'=>$byProduct,
        'by_source'=>$bySource,
        'unsubscribed'=>$unsubCnt,
        'active'=>$total - $unsubCnt,
    ], JSON_PRETTY_PRINT);
    break;

case 'getLeads':
    if (($_GET['key'] ?? '') !== ADMIN_KEY) {
        http_response_code(403); echo json_encode(['ok'=>false,'error'=>'forbidden']); break;
    }
    $data = loadData();
    // Отдаём по 50 последних
    $leads = array_slice(array_reverse($data['leads']), 0, 50);
    echo json_encode(['ok'=>true,'count'=>count($leads),'leads'=>$leads], JSON_PRETTY_PRINT);
    break;

// ──────────────────────────────────────────────────────────────────
// default
// ──────────────────────────────────────────────────────────────────
default:
    echo json_encode([
      'ok'=>false,
      'error'=>'unknown action',
      'available'=>['saveLead','drip','newsletter','getStats','getLeads','download','unsubscribe'],
    ]);
}
