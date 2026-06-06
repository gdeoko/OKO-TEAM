<?php
/* ============================================================
   DUCK'S — единый API-роутер. POST/GET ?action=...
   Публичные: saveLead, saveCoupon, track, getContent, downloadCoupon
   Админские (нужен pin): auth, getStats, getSubscribers, saveSubscriber,
     deleteSubscriber, getCoupons, couponAction, getContent(admin),
     saveContent, getSettings, saveSettings, sendNewsletter, getNewsletters,
     manualInvite, exportSubscribers
   ============================================================ */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/templates.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Pin');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

function body() {
  static $b = null;
  if ($b !== null) return $b;
  $raw = file_get_contents('php://input');
  $b = json_decode($raw, true);
  if (!is_array($b)) $b = $_POST ?: [];
  return $b;
}
function inp($k, $d = '') { $b = body(); return isset($b[$k]) ? $b[$k] : ($_GET[$k] ?? $d); }
function out($d) { echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function fail($m, $code = 400) { http_response_code($code); out(['ok' => false, 'error' => $m]); }

function requireAdmin() {
  $pin = $_SERVER['HTTP_X_ADMIN_PIN'] ?? inp('pin', '');
  if (!hash_equals(currentPin(), (string)$pin)) fail('unauthorized', 401);
}

$action = $_GET['action'] ?? inp('action', '');

switch ($action) {

  /* ---------- ПУБЛИЧНОЕ ---------- */

  case 'saveLead': {
    $d = [
      'name' => trim(inp('name')), 'email' => strtolower(trim(inp('email'))),
      'phone' => trim(inp('phone')), 'game' => trim(inp('game')),
      'format' => trim(inp('format')), 'source' => 'form',
    ];
    if (!filter_var($d['email'], FILTER_VALIDATE_EMAIL)) fail('bad email');
    $id = upsertSubscriber($d);
    logEvent('form', 'signup', ['id' => $id, 'game' => $d['game']]);
    logEvent('conversion', 'lead');
    // мгновенно: welcome игроку, лид-магнит, письмо+ТГ руководителям
    @sendEmail($d['email'], 'Заявка принята — DUCK\'S GAME SPACE 🦆', welcomeEmail($d['name']));
    @sendEmail($d['email'], setting('magnet_title') . ' — подарок DUCK\'S 🎁', magnetEmail($d['name']));
    db()->prepare("UPDATE subscribers SET welcomed=1, magnet_sent=1 WHERE id=?")->execute([$id]);
    foreach (array_filter(array_map('trim', explode(',', ADMIN_EMAILS))) as $ae)
      @sendEmail($ae, '🦆 Новая заявка с сайта', adminLeadHtml($d, 'Заявка'));
    out(['ok' => true, 'id' => $id]);
  }

  case 'saveCoupon': {
    $name = trim(inp('name')); $email = strtolower(trim(inp('email')));
    $phone = trim(inp('phone')); $score = (int)inp('score');
    $discount = (int)setting('coupon_discount', 15);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) fail('bad email');
    // один активный купон на почту
    $st = db()->prepare("SELECT number,discount FROM coupons WHERE email=? AND status='active' LIMIT 1");
    $st->execute([$email]); $exist = $st->fetch();
    if ($exist) { $number = $exist['number']; $discount = (int)$exist['discount']; }
    else {
      $number = genCouponNumber();
      $sid = upsertSubscriber(['name'=>$name,'email'=>$email,'phone'=>$phone,'source'=>'darts']);
      db()->prepare("INSERT INTO coupons (number,name,email,phone,discount,score,status,subscriber_id,created,updated)
                     VALUES (?,?,?,?,?,?, 'active', ?, ?, ?)")
          ->execute([$number,$name,$email,$phone,$discount,$score,$sid,time(),time()]);
    }
    logEvent('coupon', 'issued', ['number'=>$number,'score'=>$score]);
    logEvent('conversion', 'coupon');
    $dlUrl = SITE_URL . '/api.php?action=downloadCoupon&number=' . urlencode($number);
    $html = couponEmail($name, $number, $discount);
    @sendEmail($email, "Твой купон −$discount% — DUCK'S 🎯", $html, [
      ['name' => "kupon-$number.html", 'type' => 'text/html',
       'data' => couponCardHtml($name, $number, $discount)],
    ]);
    foreach (array_filter(array_map('trim', explode(',', ADMIN_EMAILS))) as $ae)
      @sendEmail($ae, '🎯 Купон выдан с сайта',
        adminLeadHtml(['name'=>$name,'email'=>$email,'phone'=>$phone,'score'=>$score,
          'number'=>$number,'source'=>'darts'], 'Купон'));
    out(['ok' => true, 'number' => $number, 'download' => $dlUrl]);
  }

  case 'track': {
    $type = inp('type', 'click'); $label = substr(trim(inp('label')), 0, 120);
    if (!in_array($type, ['visit','click','conversion'])) $type = 'click';
    logEvent($type, $label, inp('meta', ''));
    out(['ok' => true]);
  }

  case 'downloadCoupon': {
    header_remove('Content-Type'); header('Content-Type: text/html; charset=utf-8');
    $number = trim(inp('number'));
    $st = db()->prepare("SELECT * FROM coupons WHERE number=?"); $st->execute([$number]);
    $c = $st->fetch();
    if (!$c) { echo '<h1 style="color:#fff;background:#000;font-family:sans-serif;padding:40px;">Купон не найден</h1>'; exit; }
    echo couponCardHtml($c['name'], $c['number'], $c['discount']); exit;
  }

  case 'getContent': {  // публично: тексты сайта
    $c = is_file(CONTENT_FILE) ? json_decode(file_get_contents(CONTENT_FILE), true) : [];
    out(['ok' => true, 'content' => $c ?: new stdClass()]);
  }

  /* ---------- АДМИНКА ---------- */

  case 'auth': {
    $pin = inp('pin', '');
    if (!hash_equals(currentPin(), (string)$pin)) fail('bad pin', 401);
    out(['ok' => true]);
  }

  case 'setPin': {
    requireAdmin();
    $new = preg_replace('/\D/', '', (string)inp('newPin', ''));
    if (strlen($new) < 4 || strlen($new) > 6) fail('PIN должен быть 4–6 цифр');
    setSetting('admin_pin', $new);
    out(['ok' => true, 'pin' => $new]);
  }

  case 'getStats': {
    requireAdmin();
    $pdo = db();
    $cnt = fn($q,$p=[]) => (function() use ($pdo,$q,$p){ $s=$pdo->prepare($q); $s->execute($p); return (int)$s->fetchColumn(); })();
    $stats = [
      'subscribers' => $cnt("SELECT COUNT(*) FROM subscribers"),
      'fromForm'    => $cnt("SELECT COUNT(*) FROM subscribers WHERE source='form'"),
      'fromDarts'   => $cnt("SELECT COUNT(*) FROM subscribers WHERE source='darts'"),
      'invited'     => $cnt("SELECT COUNT(*) FROM subscribers WHERE invited=1"),
      'coupons'     => $cnt("SELECT COUNT(*) FROM coupons"),
      'couponsActive' => $cnt("SELECT COUNT(*) FROM coupons WHERE status='active'"),
      'couponsUsed' => $cnt("SELECT COUNT(*) FROM coupons WHERE status='used'"),
      'visits'      => $cnt("SELECT COUNT(*) FROM events WHERE type='visit'"),
      'clicks'      => $cnt("SELECT COUNT(*) FROM events WHERE type='click'"),
      'conversions' => $cnt("SELECT COUNT(*) FROM events WHERE type='conversion'"),
    ];
    $stats['conversionRate'] = $stats['visits'] > 0
      ? round($stats['conversions'] / max(1,$stats['visits']) * 100, 1) : 0;
    // ряды для графиков: последние 14 дней — заявки/купоны
    $days = [];
    for ($i = 13; $i >= 0; $i--) {
      $start = strtotime("-$i day 00:00:00"); $end = $start + 86400;
      $days[] = [
        'date'    => date('d.m', $start),
        'leads'   => $cnt("SELECT COUNT(*) FROM subscribers WHERE created>=? AND created<?", [$start,$end]),
        'coupons' => $cnt("SELECT COUNT(*) FROM coupons WHERE created>=? AND created<?", [$start,$end]),
        'clicks'  => $cnt("SELECT COUNT(*) FROM events WHERE type='click' AND created>=? AND created<?", [$start,$end]),
      ];
    }
    // топ кликов по карточкам/кнопкам
    $tc = $pdo->query("SELECT label, COUNT(*) c FROM events WHERE type='click' GROUP BY label ORDER BY c DESC LIMIT 12");
    out(['ok' => true, 'stats' => $stats, 'days' => $days, 'topClicks' => $tc->fetchAll()]);
  }

  case 'getSubscribers': {
    requireAdmin();
    $src = inp('filter', 'all'); $q = trim(inp('q', ''));
    $sql = "SELECT * FROM subscribers WHERE 1=1"; $p = [];
    if (in_array($src, ['form','darts'])) { $sql .= " AND source=?"; $p[] = $src; }
    if ($q !== '') { $sql .= " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
      $like = "%$q%"; array_push($p, $like, $like, $like); }
    $sql .= " ORDER BY created DESC LIMIT 500";
    $st = db()->prepare($sql); $st->execute($p);
    out(['ok' => true, 'items' => $st->fetchAll()]);
  }

  case 'saveSubscriber': {
    requireAdmin();
    $id = (int)inp('id', 0); $now = time();
    $f = ['name'=>trim(inp('name')),'email'=>strtolower(trim(inp('email'))),
          'phone'=>trim(inp('phone')),'game'=>trim(inp('game')),'format'=>trim(inp('format')),
          'source'=>inp('source','form'),'status'=>inp('status','new'),'note'=>trim(inp('note'))];
    if ($id) {
      db()->prepare("UPDATE subscribers SET name=?,email=?,phone=?,game=?,format=?,source=?,status=?,note=?,updated=? WHERE id=?")
        ->execute([$f['name'],$f['email'],$f['phone'],$f['game'],$f['format'],$f['source'],$f['status'],$f['note'],$now,$id]);
    } else {
      db()->prepare("INSERT INTO subscribers (name,email,phone,game,format,source,status,note,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?)")
        ->execute([$f['name'],$f['email'],$f['phone'],$f['game'],$f['format'],$f['source'],$f['status'],$f['note'],$now,$now]);
      $id = db()->lastInsertId();
    }
    out(['ok' => true, 'id' => $id]);
  }

  case 'deleteSubscriber': {
    requireAdmin();
    db()->prepare("DELETE FROM subscribers WHERE id=?")->execute([(int)inp('id')]);
    out(['ok' => true]);
  }

  case 'getCoupons': {
    requireAdmin();
    $q = trim(inp('q','')); $status = inp('status','all');
    $sql = "SELECT * FROM coupons WHERE 1=1"; $p = [];
    if (in_array($status,['active','used','void'])) { $sql .= " AND status=?"; $p[]=$status; }
    if ($q !== '') { $sql .= " AND (number LIKE ? OR name LIKE ? OR email LIKE ?)";
      $like="%$q%"; array_push($p,$like,$like,$like); }
    $sql .= " ORDER BY created DESC LIMIT 500";
    $st = db()->prepare($sql); $st->execute($p);
    out(['ok' => true, 'items' => $st->fetchAll(),
         'discount' => (int)setting('coupon_discount',15), 'points' => (int)setting('coupon_points',150)]);
  }

  case 'couponAction': {
    requireAdmin();
    $op = inp('op'); $id = (int)inp('id', 0);
    if ($op === 'create') {
      $number = genCouponNumber();
      $disc = (int)inp('discount', setting('coupon_discount',15));
      db()->prepare("INSERT INTO coupons (number,name,email,phone,discount,score,status,created,updated) VALUES (?,?,?,?,?,?,'active',?,?)")
        ->execute([$number, trim(inp('name')), strtolower(trim(inp('email'))), trim(inp('phone')),
                   $disc, (int)inp('score',0), time(), time()]);
      $cid = db()->lastInsertId();
      if (filter_var(inp('email'), FILTER_VALIDATE_EMAIL) && inp('send'))
        @sendEmail(inp('email'), "Твой купон −$disc% — DUCK'S 🎯", couponEmail(inp('name'),$number,$disc),
          [['name'=>"kupon-$number.html",'type'=>'text/html','data'=>couponCardHtml(inp('name'),$number,$disc)]]);
      out(['ok'=>true,'number'=>$number,'id'=>$cid]);
    }
    if (in_array($op, ['use','void','active'])) {
      db()->prepare("UPDATE coupons SET status=?, updated=? WHERE id=?")->execute([$op==='use'?'used':$op, time(), $id]);
      out(['ok'=>true]);
    }
    if ($op === 'delete') { db()->prepare("DELETE FROM coupons WHERE id=?")->execute([$id]); out(['ok'=>true]); }
    if ($op === 'resend') {
      $st=db()->prepare("SELECT * FROM coupons WHERE id=?"); $st->execute([$id]); $c=$st->fetch();
      if ($c) @sendEmail($c['email'], "Твой купон −{$c['discount']}% — DUCK'S 🎯",
        couponEmail($c['name'],$c['number'],$c['discount']),
        [['name'=>"kupon-{$c['number']}.html",'type'=>'text/html','data'=>couponCardHtml($c['name'],$c['number'],$c['discount'])]]);
      out(['ok'=>true]);
    }
    fail('bad op');
  }

  case 'saveContent': {
    requireAdmin();
    $content = inp('content', null);
    if (!is_array($content)) fail('bad content');
    if (!is_dir(dirname(CONTENT_FILE))) @mkdir(dirname(CONTENT_FILE), 0775, true);
    file_put_contents(CONTENT_FILE, json_encode($content, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    out(['ok' => true]);
  }

  case 'getSettings': {
    requireAdmin();
    $all = db()->query("SELECT k,v FROM settings")->fetchAll();
    $map = []; foreach ($all as $r) $map[$r['k']] = $r['v'];
    out(['ok' => true, 'settings' => $map]);
  }

  case 'saveSettings': {
    requireAdmin();
    $s = inp('settings', []);
    if (is_array($s)) foreach ($s as $k => $v) setSetting($k, (string)$v);
    out(['ok' => true]);
  }

  case 'sendNewsletter': {
    requireAdmin();
    $subject = trim(inp('subject')); $html = inp('html', '');
    $audience = inp('audience', 'all'); $test = inp('test', '');
    if (!$subject || !$html) fail('subject/body required');
    $atts = [];
    foreach ((array)inp('attachments', []) as $a) {
      if (!empty($a['data']) && !empty($a['name'])) {
        $data = base64_decode(preg_replace('#^data:[^;]+;base64,#', '', $a['data']));
        if ($data !== false) $atts[] = ['name'=>$a['name'],'type'=>$a['type']??'application/octet-stream','data'=>$data];
      }
    }
    $wrapped = emailTpl($subject, $html, array_map(fn($b)=>[$b['label'],$b['url']], (array)inp('buttons', [])));
    if ($test && filter_var($test, FILTER_VALIDATE_EMAIL)) {
      @sendEmail($test, $subject, $wrapped, $atts);
      out(['ok'=>true,'sent'=>0,'test'=>true]);
    }
    $sql = "SELECT DISTINCT email,name FROM subscribers WHERE email!=''";
    if (in_array($audience,['form','darts'])) $sql .= " AND source='" . $audience . "'";
    $rows = db()->query($sql)->fetchAll();
    $sent = 0;
    foreach ($rows as $r) {
      $personal = str_replace('{name}', $r['name'] ?: 'друг', $wrapped);
      if (@sendEmail($r['email'], $subject, $personal, $atts)) $sent++;
    }
    db()->prepare("INSERT INTO newsletter_log (subject,body,recipients,audience,created) VALUES (?,?,?,?,?)")
        ->execute([$subject, $html, $sent, $audience, time()]);
    out(['ok' => true, 'sent' => $sent, 'total' => count($rows)]);
  }

  case 'getNewsletters': {
    requireAdmin();
    out(['ok'=>true,'items'=>db()->query("SELECT id,subject,recipients,audience,created FROM newsletter_log ORDER BY created DESC LIMIT 100")->fetchAll()]);
  }

  case 'manualInvite': {
    requireAdmin();
    $id = (int)inp('id');
    $st = db()->prepare("SELECT * FROM subscribers WHERE id=?"); $st->execute([$id]); $s = $st->fetch();
    if (!$s) fail('not found');
    @sendEmail($s['email'], "Твоё приглашение в DUCK'S 🦆", inviteEmail($s['name']));
    db()->prepare("UPDATE subscribers SET invited=1, status='invited', invite_at=0, updated=? WHERE id=?")
        ->execute([time(), $id]);
    out(['ok' => true]);
  }

  case 'exportSubscribers': {
    requireAdmin();
    header_remove('Content-Type');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=ducks-subscribers.csv');
    $rows = db()->query("SELECT name,email,phone,game,format,source,status,datetime(created,'unixepoch') created FROM subscribers ORDER BY created DESC")->fetchAll();
    echo "\xEF\xBB\xBF"; // BOM
    echo "Имя;Почта;Телефон;Игра;Формат;Источник;Статус;Дата\n";
    foreach ($rows as $r) echo implode(';', array_map(fn($v)=>str_replace(';',',',$v), $r)) . "\n";
    exit;
  }

  default:
    fail('unknown action: ' . htmlspecialchars($action), 404);
}
