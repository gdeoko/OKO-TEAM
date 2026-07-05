<?php
/* ============================================================
   PandaGo Order API
   Endpoints: newLead, getStats, adminActions, updateRate,
              checkPromo, sendNewsletter, trackEvent, editContent
   ============================================================ */

declare(strict_types=1);
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__.'/logs/php-errors.log');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');

/* --- config --- */
require_once __DIR__.'/config.php';
require_once __DIR__.'/lib.php';

/* --- routing --- */
$action = $_GET['action'] ?? '';
$body   = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    $body = json_decode($raw, true);
    if (!is_array($body)) $body = $_POST;
}

try {
    switch ($action) {
        case 'newLead':        echo json_encode(api_newLead($body));       break;
        case 'getStats':       echo json_encode(api_getStats());           break;
        case 'adminActions':   echo json_encode(api_adminActions($body));  break;
        case 'updateRate':     echo json_encode(api_updateRate($body));    break;
        case 'checkPromo':     echo json_encode(api_checkPromo($body));    break;
        case 'sendNewsletter': echo json_encode(api_sendNewsletter($body));break;
        case 'trackEvent':     echo json_encode(api_trackEvent($body));    break;
        case 'editContent':    echo json_encode(api_editContent($body));   break;
        case 'ping':           echo json_encode(['ok'=>true,'ts'=>time()]);break;
        default:
            http_response_code(400);
            echo json_encode(['ok'=>false,'err'=>'unknown_action']);
    }
} catch (Throwable $e) {
    error_log('[api] '.$e->getMessage().' @ '.$e->getFile().':'.$e->getLine());
    http_response_code(500);
    echo json_encode(['ok'=>false,'err'=>'server_error']);
}

/* ────────────────────────────────────────────────────────────
   ENDPOINT IMPLEMENTATIONS
   ──────────────────────────────────────────────────────────── */

/* newLead - приём заявки с сайта */
function api_newLead(?array $b): array {
    if (!$b) return ['ok'=>false,'err'=>'empty_body'];

    /* honeypot */
    if (!empty($b['website'])) return ['ok'=>true,'id'=>'skip'];

    /* rate-limit по IP */
    $ip = client_ip();
    if (rate_limited('newLead:'.$ip, 5, 300)) {
        return ['ok'=>false,'err'=>'rate_limit'];
    }

    /* минимальная валидация */
    $name    = trim((string)($b['name']  ?? ''));
    $phone   = trim((string)($b['phone'] ?? ''));
    $tg      = trim((string)($b['tg']    ?? ''));
    $email   = trim((string)($b['email'] ?? ''));
    $service = trim((string)($b['service'] ?? 'Подбор техники'));
    $msg     = trim((string)($b['msg']   ?? ''));
    $contact = trim((string)($b['contact'] ?? ''));

    if (!$name)                     return ['ok'=>false,'err'=>'no_name'];
    if (!$phone && !$tg && !$email) return ['ok'=>false,'err'=>'no_contact'];

    /* нормализация */
    $phone = normalize_phone($phone);
    $tg    = normalize_tg($tg);
    $email = normalize_email($email);

    /* сохраняем */
    $data = data_read();
    $id   = 'L'.date('ymd').'-'.substr(bin2hex(random_bytes(3)),0,6);

    $lead = [
        'id'      => $id,
        'ts'      => time(),
        'name'    => $name,
        'phone'   => $phone,
        'tg'      => $tg,
        'email'   => $email,
        'service' => $service,
        'msg'     => $msg,
        'contact' => $contact,
        'ip'      => $ip,
        'ua'      => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200),
        'ref'     => substr($_SERVER['HTTP_REFERER'] ?? '', 0, 200),
        'status'  => 'new',      /* new / in_progress / done / trash */
        'assignee'=> null,
        'notes'   => [],
        'nudge1h' => 0,          /* был ли отправлен дожим 1ч */
        'nudge24h'=> 0,          /* был ли отправлен дожим 24ч */
    ];

    array_unshift($data['leads'], $lead);
    if (count($data['leads']) > 5000) {
        $data['leads'] = array_slice($data['leads'], 0, 5000);
    }
    $data['stats']['leadsTotal'] = ($data['stats']['leadsTotal'] ?? 0) + 1;
    data_write($data);

    /* уведомления всем админам */
    $text = format_lead_notification($lead);
    tg_broadcast_admins($text, tg_inline_lead_actions($id));

    /* email админам (best-effort) */
    if (!empty($data['settings']['adminEmail'])) {
        @mail_send(
            $data['settings']['adminEmail'],
            'PandaGo · заявка '.$id,
            $text
        );
    }

    return ['ok'=>true,'id'=>$id];
}

/* getStats - статистика для админки */
function api_getStats(): array {
    require_admin_token();
    $d = data_read();
    $leads = $d['leads'] ?? [];

    $today   = strtotime('today');
    $week    = strtotime('-7 days');
    $month   = strtotime('-30 days');

    $cnt = ['total'=>count($leads),'today'=>0,'week'=>0,'month'=>0,
            'new'=>0,'in_progress'=>0,'done'=>0,'trash'=>0];
    foreach ($leads as $l) {
        if ($l['ts'] >= $today) $cnt['today']++;
        if ($l['ts'] >= $week)  $cnt['week']++;
        if ($l['ts'] >= $month) $cnt['month']++;
        $st = $l['status'] ?? 'new';
        if (isset($cnt[$st])) $cnt[$st]++;
    }

    return [
        'ok'      => true,
        'counts'  => $cnt,
        'rate'    => $d['settings']['rate']    ?? 95,
        'rate_update_ts' => $d['settings']['rateUpdate'] ?? 0,
        'promos'  => $d['promos']              ?? [],
        'admins'  => $d['admins']              ?? [],
        'events'  => array_slice($d['events'] ?? [], 0, 200),
        'leads'   => array_slice($leads, 0, 500),
    ];
}

/* adminActions - операции над заявками (status, note, delete, assign) */
function api_adminActions(?array $b): array {
    require_admin_token();
    $b = $b ?? [];
    $op = $b['op'] ?? '';
    $id = $b['id'] ?? '';
    $d  = data_read();

    $found = null; $idx = -1;
    foreach ($d['leads'] as $i=>$l) {
        if ($l['id'] === $id) { $found = $l; $idx = $i; break; }
    }
    if (!$found) return ['ok'=>false,'err'=>'not_found'];

    switch ($op) {
        case 'setStatus':
            $st = $b['status'] ?? '';
            if (!in_array($st,['new','in_progress','done','trash'],true))
                return ['ok'=>false,'err'=>'bad_status'];
            $d['leads'][$idx]['status'] = $st;
            break;
        case 'addNote':
            $note = trim((string)($b['note'] ?? ''));
            if (!$note) return ['ok'=>false,'err'=>'empty_note'];
            $d['leads'][$idx]['notes'][] = [
                'ts'=>time(),'author'=>($b['author'] ?? 'admin'),'text'=>$note
            ];
            break;
        case 'assign':
            $d['leads'][$idx]['assignee'] = (string)($b['assignee'] ?? '');
            break;
        case 'delete':
            array_splice($d['leads'], $idx, 1);
            break;
        default:
            return ['ok'=>false,'err'=>'bad_op'];
    }
    data_write($d);
    return ['ok'=>true];
}

/* updateRate - обновить курс USD/RUB */
function api_updateRate(?array $b): array {
    require_admin_token();
    $rate = (float)($b['rate'] ?? 0);
    if ($rate < 30 || $rate > 500) return ['ok'=>false,'err'=>'bad_rate'];
    $d = data_read();
    $d['settings']['rate']       = $rate;
    $d['settings']['rateUpdate'] = time();
    data_write($d);
    return ['ok'=>true,'rate'=>$rate];
}

/* checkPromo - валидация промокода */
function api_checkPromo(?array $b): array {
    $code = strtoupper(trim((string)($b['code'] ?? '')));
    if (!$code) return ['ok'=>false,'err'=>'empty'];
    $d = data_read();
    foreach ($d['promos'] ?? [] as $p) {
        if (strtoupper($p['code']) === $code) {
            if (!empty($p['expires']) && $p['expires'] < time())
                return ['ok'=>false,'err'=>'expired'];
            if (!empty($p['maxUses']) && ($p['uses'] ?? 0) >= $p['maxUses'])
                return ['ok'=>false,'err'=>'used_up'];
            return ['ok'=>true,'discount'=>$p['discount'] ?? 0,
                    'type'=>$p['type'] ?? 'percent',
                    'label'=>$p['label'] ?? $code];
        }
    }
    return ['ok'=>false,'err'=>'not_found'];
}

/* sendNewsletter - массовая рассылка в TG всем лидам с TG */
function api_sendNewsletter(?array $b): array {
    require_admin_token();
    $text  = trim((string)($b['text']  ?? ''));
    $target= $b['target'] ?? 'all';       /* all | new | done */
    $limit = (int)($b['limit'] ?? 500);
    if (!$text) return ['ok'=>false,'err'=>'empty_text'];

    $d = data_read();
    $sent = 0; $fail = 0;
    foreach ($d['leads'] as $l) {
        if (!$l['tg']) continue;
        if ($target !== 'all' && ($l['status'] ?? 'new') !== $target) continue;
        if ($sent + $fail >= $limit) break;
        /* TG-сообщение может быть отправлено только если пользователь писал боту */
        $ok = tg_send_to_username($l['tg'], $text);
        $ok ? $sent++ : $fail++;
        usleep(50000); /* 20 rps */
    }
    return ['ok'=>true,'sent'=>$sent,'fail'=>$fail];
}

/* trackEvent - трекинг событий с фронта (просмотры, клики, скроллы) */
function api_trackEvent(?array $b): array {
    $type = trim((string)($b['type'] ?? ''));
    if (!$type) return ['ok'=>false,'err'=>'no_type'];
    if (rate_limited('event:'.client_ip(), 200, 60))
        return ['ok'=>false,'err'=>'rate_limit'];

    $d = data_read();
    array_unshift($d['events'], [
        'ts'   => time(),
        'type' => substr($type, 0, 40),
        'data' => substr((string)($b['data'] ?? ''), 0, 200),
        'ip'   => client_ip(),
    ]);
    if (count($d['events']) > 5000) $d['events'] = array_slice($d['events'], 0, 5000);

    $key = 'e_'.$type;
    $d['stats'][$key] = ($d['stats'][$key] ?? 0) + 1;
    data_write($d);
    return ['ok'=>true];
}

/* editContent - редактирование блоков сайта или служебных структур */
function api_editContent(?array $b): array {
    require_admin_token();
    $key = trim((string)($b['key'] ?? ''));
    $val = $b['value'] ?? '';
    if (!$key) return ['ok'=>false,'err'=>'no_key'];
    if (!preg_match('/^[a-zA-Z0-9_\-\.]{1,60}$/', $key))
        return ['ok'=>false,'err'=>'bad_key'];

    $d = data_read();

    /* специальные системные ключи */
    if ($key === '_promos') {
        $decoded = json_decode((string)$val, true);
        if (!is_array($decoded)) return ['ok'=>false,'err'=>'bad_json'];
        /* валидация промокодов */
        $clean = [];
        foreach ($decoded as $p) {
            if (empty($p['code'])) continue;
            $clean[] = [
                'code'     => strtoupper(preg_replace('/[^A-Z0-9_-]/i','', (string)$p['code'])),
                'label'    => (string)($p['label'] ?? ''),
                'type'     => in_array(($p['type'] ?? 'percent'),['percent','fixed'],true) ? $p['type'] : 'percent',
                'discount' => max(0, min(90, (int)($p['discount'] ?? 0))),
                'expires'  => (int)($p['expires'] ?? 0),
                'maxUses'  => max(0, (int)($p['maxUses'] ?? 0)),
                'uses'     => max(0, (int)($p['uses'] ?? 0)),
            ];
        }
        $d['promos'] = $clean;
        data_write($d);
        return ['ok'=>true,'count'=>count($clean)];
    }

    if ($key === '_adminEmail') {
        $d['settings']['adminEmail'] = normalize_email((string)$val);
        data_write($d);
        return ['ok'=>true];
    }

    /* обычный content */
    $d['content'][$key] = $val;
    data_write($d);
    return ['ok'=>true];
}
