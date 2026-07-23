<?php
// ═══════════════════════════════════════════════════════════════
// Ядро миграции JSON → SQLite. Работает с переданным $pdo напрямую
// (без db()-хелперов), чтобы не было рекурсии при авто-миграции.
// Возвращает ['clients'=>N,'payments'=>N,'anketas'=>N,'files'=>N].
// ═══════════════════════════════════════════════════════════════
require_once __DIR__ . '/db.php';   // для anketa_extract_files / mime_to_ext

function migrate_run(PDO $pdo, string $dataFile, string $anketaFile): array {
    $N = ['clients'=>0,'payments'=>0,'newsletter'=>0,'anketas'=>0,'files'=>0];
    $data    = file_exists($dataFile)   ? (json_decode(file_get_contents($dataFile), true)   ?: []) : [];
    $anketas = file_exists($anketaFile) ? (json_decode(file_get_contents($anketaFile), true) ?: []) : [];
    $uploads = __DIR__ . '/uploads';
    if (!is_dir($uploads)) @mkdir($uploads, 0755, true);
    $ts = date('Y-m-d H:i:s');

    $insClient = $pdo->prepare("INSERT INTO clients (name,email,phone,tg,niche,status,products,tariff,paid,paid_product,paid_ts,source,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,'site',?)
        ON CONFLICT(email) DO UPDATE SET name=excluded.name, phone=excluded.phone, tg=excluded.tg, paid=excluded.paid");
    $insSub = $pdo->prepare("INSERT INTO subscribers (email,name,phone,tg,products,paid,created_at,last_action)
        VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name, paid=excluded.paid");
    $getClient = $pdo->prepare("SELECT id FROM clients WHERE email=?");

    foreach (($data['subscribers'] ?? []) as $s) {
        if (empty($s['email'])) continue;
        $insClient->execute([$s['name']??'', $s['email'], $s['phone']??'', $s['tg']??'',
            $s['extra']['niche']??'', !empty($s['paid'])?'deal':'new',
            json_encode($s['products']??[],JSON_UNESCAPED_UNICODE), $s['tariff']??'',
            !empty($s['paid'])?1:0, $s['paid_product']??'', $s['paid_ts']??null, $s['ts']??$ts]);
        $insSub->execute([$s['email'], $s['name']??'', $s['phone']??'', $s['tg']??'',
            json_encode($s['products']??[],JSON_UNESCAPED_UNICODE), !empty($s['paid'])?1:0, $s['ts']??$ts, $s['last_action']??null]);
        $N['clients']++;
    }

    $insPay = $pdo->prepare("INSERT INTO payments (client_id,email,name,product,tariff,amount,manual,created_at) VALUES (?,?,?,?,?,?,?,?)");
    foreach (($data['payments'] ?? []) as $p) {
        $getClient->execute([$p['email']??'']); $cid = $getClient->fetchColumn() ?: null;
        $insPay->execute([$cid, $p['email']??'', $p['name']??'', $p['product']??'', $p['tariff']??'', $p['amount']??'', !empty($p['manual'])?1:0, $p['ts']??$ts]);
        $N['payments']++;
    }

    $insNl = $pdo->prepare("INSERT INTO newsletter_log (subject,segment,sent,failed,created_at) VALUES (?,?,?,?,?)");
    foreach (($data['newsletter_log'] ?? []) as $n) { $insNl->execute([$n['subject']??'', $n['segment']??'', $n['sent']??0, $n['failed']??0, $n['ts']??$ts]); $N['newsletter']++; }

    $insSet = $pdo->prepare("INSERT OR REPLACE INTO settings (k,v,updated_at) VALUES (?,?,?)");
    foreach (($data['settings'] ?? []) as $k => $v) $insSet->execute(["site_$k", is_scalar($v)?(string)$v:json_encode($v,JSON_UNESCAPED_UNICODE), $ts]);

    $insAnk = $pdo->prepare("INSERT INTO anketa_submissions (submission_id,client_id,service_type,client_name,email,tg,answers,progress,total,complete,started_at,completed_at,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(submission_id) DO UPDATE SET answers=excluded.answers, complete=excluded.complete");
    $insFile = $pdo->prepare("INSERT INTO anketa_files (submission_id,filename,path,mime,size_bytes,created_at) VALUES (?,?,?,?,?,?)");
    foreach ($anketas as $sid => $a) {
        if (!is_array($a)) continue;
        $answers = $a['answers'] ?? [];
        $files = anketa_extract_files($answers);
        if ($files) {
            $dir = "$uploads/$sid"; if (!is_dir($dir)) @mkdir($dir, 0755, true);
            foreach ($files as $f) {
                $fn = preg_replace('/[^\w.\-]+/u', '_', $f['name']);
                file_put_contents("$dir/$fn", $f['bin']);
                $insFile->execute([$sid, $fn, "/uploads/$sid/$fn", $f['mime'], strlen($f['bin']), $ts]);
                $N['files']++;
            }
        }
        $getClient->execute([$a['email']??'']); $cid = $getClient->fetchColumn() ?: null;
        $svc = in_array($a['product']??'sistema', ['sistema','web','zavod','complex']) ? $a['product'] : 'sistema';
        $insAnk->execute([$sid, $cid, $svc, $a['name']??'', $a['email']??'', $answers['q7d']??'',
            json_encode($answers,JSON_UNESCAPED_UNICODE), $a['progress']??0, $a['total']??0,
            !empty($a['complete'])?1:0, $a['ts']??null, !empty($a['complete'])?($a['ts']??null):null, $a['ts']??$ts]);
        $N['anketas']++;
    }
    return $N;
}
