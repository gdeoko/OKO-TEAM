<?php
// ╔══════════════════════════════════════════════╗
// ║  OKO TEAM — API Backend v3 (SQLite, авто)    ║
// ╚══════════════════════════════════════════════╝
require __DIR__ . '/db.php';

header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Admin-Key, X-Agent-Token');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$C = cfg();
$body = json_decode(file_get_contents('php://input'), true) ?? [];
$action = $_GET['action'] ?? $body['action'] ?? '';

function out($d) { echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function fail($m, $c = 400) { http_response_code($c); out(['ok'=>false,'error'=>$m]); }
function admin_ok(): bool { $C=cfg(); $k=$_GET['key']??($_SERVER['HTTP_X_ADMIN_KEY']??($GLOBALS['body']['key']??'')); return $k!=='' && hash_equals((string)$C['admin_password'],(string)$k); }
function require_admin(){ if(!admin_ok()) fail('Unauthorized',403); }
function agent_ok(): bool { $C=cfg(); $t=$_SERVER['HTTP_X_AGENT_TOKEN']??($GLOBALS['body']['agent_token']??''); return $t!=='' && hash_equals((string)($C['agent_token']??''),(string)$t); }
function require_agent(){ if(!agent_ok()) fail('Unauthorized',403); }
function rate_limit($b,$max,$win){ $ip=$_SERVER['REMOTE_ADDR']??'0'; $f=sys_get_temp_dir().'/oko_rl_'.md5($b.$ip); $n=time();
    $h=file_exists($f)?array_filter(json_decode(file_get_contents($f),true)?:[],fn($t)=>$t>$n-$win):[]; if(count($h)>=$max) fail('Слишком часто, подождите',429); $h[]=$n; @file_put_contents($f,json_encode(array_values($h))); }

function tg_send($chat,$text,$btns=[],$thread=null){ $C=cfg(); if(empty($C['tg_bot_token'])||!$chat) return;
    $d=['chat_id'=>$chat,'text'=>$text,'parse_mode'=>'HTML','disable_web_page_preview'=>true];
    if($thread) $d['message_thread_id']=$thread; if($btns) $d['reply_markup']=['inline_keyboard'=>$btns];
    $ch=curl_init('https://api.telegram.org/bot'.$C['tg_bot_token'].'/sendMessage');
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($d),CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>6]); curl_exec($ch); curl_close($ch); }
function topic_thread($n){ $r=db_one("SELECT thread_id FROM team_chat_topics WHERE topic_name=?",[$n]); return $r?(int)$r['thread_id']:null; }

// ── Продукты и тарифы (для рассылок/уведомлений) ──
$GLOBALS['PRODUCTS']=[
  'sistema'=>['name'=>'СИСТЕМА OKO','emoji'=>'🧠'],'zavod'=>['name'=>'Контент-завод','emoji'=>'🏭'],
  'consult'=>['name'=>'Консультация','emoji'=>'📞'],'web'=>['name'=>'Сайты / Боты / Приложения','emoji'=>'💻'],
  'voronka'=>['name'=>'Воронка + Нейробот','emoji'=>'🤖'],'club'=>['name'=>'OKO CLUB','emoji'=>'⭐'],
];
// Единая база контактов = clients (новые лиды с сайта/агентов) + subscribers (старые из миграции),
// дедуп по email. Раньше рассылка/продукты читали только subscribers → новые лиды не попадали.
function contacts_all($seg='all'){
  $rows=db_all("SELECT lower(email) email, MAX(name) name,
      group_concat(COALESCE(products,'')) products, MAX(COALESCE(paid,0)) paid FROM (
        SELECT email,name,products,paid FROM clients WHERE email IS NOT NULL AND email!=''
        UNION ALL
        SELECT email,name,products,paid FROM subscribers WHERE email IS NOT NULL AND email!=''
      ) GROUP BY lower(email)");
  if($seg==='paid'){ $o=[]; foreach($rows as $r){ if((int)$r['paid']===1)$o[]=$r; } return $o; }
  if($seg==='unpaid'){ $o=[]; foreach($rows as $r){ if((int)$r['paid']!==1)$o[]=$r; } return $o; }
  return $rows;
}
// ── Email (Gmail SMTP) ──
function emailTpl($title,$content,$btns=[]){
  $b='';foreach($btns as $x){$pr=!empty($x['primary']);$bg=$pr?'#9AFF00':'rgba(154,255,0,0.08)';$cl=$pr?'#000':'#9AFF00';$br=$pr?'none':'1px solid rgba(154,255,0,0.3)';
    $b.="<a href='{$x['url']}' style='display:block;text-align:center;background:$bg;color:$cl;text-decoration:none;padding:13px 24px;border-radius:12px;font-weight:800;font-family:Unbounded,Arial,sans-serif;font-size:13px;border:$br;margin-bottom:8px'>{$x['text']}</a>";}
  $bb=$b?"<div style='margin:24px 0'>$b</div>":'';
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@700;900&family=Onest:wght@400;600&display=swap" rel="stylesheet"></head><body style="margin:0;background:#050505;font-family:Onest,Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:20px"><div style="text-align:center;padding:26px 0 18px;border-bottom:1px solid rgba(154,255,0,0.2)"><div style="font-family:Unbounded,Arial,sans-serif;font-size:22px;font-weight:900;color:#fff">ОКО<span style="color:#9AFF00"> TEAM</span></div></div><h2 style="font-family:Unbounded,Arial,sans-serif;font-size:18px;color:#fff;margin:22px 0 14px">'.$title.'</h2><div style="background:rgba(255,255,255,0.03);border:1px solid rgba(154,255,0,0.12);border-radius:14px;padding:22px;color:rgba(255,255,255,0.82);font-size:14px;line-height:1.8">'.$content.'</div>'.$bb.'<div style="text-align:center;padding:18px 0;font-size:11px;color:rgba(255,255,255,0.25)">OKO TEAM · okoteam.top · @ktodaniel</div></div></body></html>';
}
function sendEmail($to,$subject,$body){
  $C=cfg(); $from=$C['gmail']??''; $pass=$C['gmail_pass']??''; $name=$C['gmail_name']??'OKO TEAM';
  if(!$to||!$from) return false;
  $msg="From: $name <$from>\r\nTo: $to\r\nSubject: =?UTF-8?B?".base64_encode($subject)."?=\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n".$body;
  if($pass && function_exists('curl_init')){
    $fp=fopen('php://temp','rw+');fwrite($fp,$msg);rewind($fp);
    $ch=curl_init();curl_setopt_array($ch,[CURLOPT_URL=>'smtps://smtp.gmail.com:465',CURLOPT_RETURNTRANSFER=>true,CURLOPT_SSL_VERIFYPEER=>false,CURLOPT_SSL_VERIFYHOST=>false,CURLOPT_USERNAME=>$from,CURLOPT_PASSWORD=>$pass,CURLOPT_MAIL_FROM=>"<$from>",CURLOPT_MAIL_RCPT=>["<$to>"],CURLOPT_READDATA=>$fp,CURLOPT_UPLOAD=>true,CURLOPT_TIMEOUT=>15]);
    curl_exec($ch);$err=curl_error($ch);curl_close($ch);fclose($fp);if(empty($err))return true;
  }
  return @mail($to,'=?UTF-8?B?'.base64_encode($subject).'?=',$body,"From: $name <$from>\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\n");
}

daily_summary(); // опортунистическая «сводка дня» без крона

switch ($action) {

case 'saveLead':
    rate_limit('saveLead',10,60);
    $email=trim($body['email']??''); $name=trim($body['name']??''); $phone=trim($body['phone']??'');
    $tg=trim($body['tg']??''); $product=trim($body['product']??'sistema'); $tariff=trim($body['tariff']??'');
    if(!$email||!$name||!$phone) fail('Заполните все обязательные поля');
    $cid=client_upsert(['name'=>$name,'email'=>$email,'phone'=>$phone,'tg'=>$tg,'niche'=>($body['extra']['niche']??''),'products'=>[$product],'tariff'=>$tariff,'source'=>'site']);
    db_exec("UPDATE clients SET tariff=?, ip=? WHERE id=?",[$tariff,$_SERVER['REMOTE_ADDR']??'',$cid]);
    tg_send($C['daniel_tg'],"<b>Новый лид</b>\n\n$name\n$phone\n$email".($tg?"\n@$tg":'')."\n$product $tariff",
        $tg?[[['text'=>"Написать $name",'url'=>"https://t.me/$tg"]]]:[], topic_thread('hot_leads'));
    out(['ok'=>true]);

case 'saveAnketa':
    rate_limit('saveAnketa',20,60);
    $sid=$body['anketa_id']??('ank_'.time().'_'.substr(md5(mt_rand()),0,6));
    $name=$body['name']??''; $email=$body['email']??''; $answers=$body['answers']??[];
    $svc=in_array($body['product']??'sistema',['sistema','web','zavod','complex'])?$body['product']:'sistema';
    $complete=!empty($body['complete'])||(($body['progress']??0)>=($body['total']??999));
    $files=anketa_extract_files($answers);
    if($files){ $dir=__DIR__."/uploads/$sid"; if(!is_dir($dir)) @mkdir($dir,0755,true);
        foreach($files as $f){ $fn=preg_replace('/[^\w.\-]+/u','_',$f['name']); file_put_contents("$dir/$fn",$f['bin']);
            db_insert("INSERT INTO anketa_files (submission_id,filename,path,mime,size_bytes,created_at) VALUES (?,?,?,?,?,?)",[$sid,$fn,"/uploads/$sid/$fn",$f['mime'],strlen($f['bin']),now()]); } }
    // Анкета → клиент АВТОМАТОМ: заполнил анкету = попал в базу клиентов (создаём/линкуем).
    $atg=ltrim(trim($body['tg']??($answers['q7d']??'')),'@');
    $aniche=trim($answers['niche']??($answers['q2']??($answers['q3']??'')));
    $cid = ($email||$name) ? client_upsert(['name'=>$name,'email'=>$email,'tg'=>$atg,
            'niche'=>$aniche,'status'=>'anketa','source'=>'anketa']) : null;
    db_exec("INSERT INTO anketa_submissions (submission_id,client_id,service_type,client_name,email,tg,answers,progress,total,complete,started_at,completed_at,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(submission_id) DO UPDATE SET answers=excluded.answers, progress=excluded.progress, complete=excluded.complete, completed_at=excluded.completed_at",
        [$sid,$cid,$svc,$name,$email,($answers['q7d']??''),json_encode($answers,JSON_UNESCAPED_UNICODE),
         $body['progress']??0,$body['total']??0,$complete?1:0,$body['ts']??now(),$complete?now():null,now()]);
    if($complete && !empty($body['send_notifications']))
        tg_send($C['daniel_tg'],"📋 <b>Новая анкета</b> ($svc)\n\n👤 ".htmlspecialchars($name).($email?"\n📧 $email":''),
            [[['text'=>'📥 Скачать анкету','url'=>$C['site_url'].'/api.php?action=downloadAnketa&id='.urlencode($sid).'&key='.urlencode($C['admin_password'])]]], topic_thread('hot_leads'));
    out(['ok'=>true,'id'=>$sid]);

case 'checkPaid':
    $email=trim($_GET['email']??''); if(!$email) out(['paid'=>false]);
    $r=db_one("SELECT name FROM clients WHERE email=? AND paid=1",[$email]); out($r?['paid'=>true,'name'=>$r['name']]:['paid'=>false]);

case 'confirmPayment':
    $secret=$_GET['secret']??($body['secret']??($_SERVER['HTTP_X_ADMIN_KEY']??''));
    if(!hash_equals((string)$C['admin_password'],(string)$secret)) fail('Unauthorized',403);
    $status=$body['status']??'success';
    if($status && !in_array($status,['success','paid','completed'])) out(['ok'=>true,'skipped'=>true]);
    $email=trim($body['buyer_email']??($body['email']??'')); if(!$email) fail('No email');
    mark_paid($email,trim($body['offer_id']??($body['product']??'sistema')),trim($body['amount']??($body['sum']??'')),false);
    out(['ok'=>true]);

case 'manualConfirm':
    require_admin();
    $email=trim($_GET['email']??($body['email']??'')); if(!$email) fail('Нет email');
    mark_paid($email,trim($_GET['product']??($body['product']??'sistema')),'',true); out(['ok'=>true,'message'=>"Готово для $email"]);

case 'getStats':
    require_admin();
    $total=(int)db_val("SELECT COUNT(*) FROM clients"); $paid=(int)db_val("SELECT COUNT(*) FROM clients WHERE paid=1");
    $today=(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)=date('now','localtime')");
    $payCount=(int)db_val("SELECT COUNT(*) FROM payments");
    $revSql="COALESCE(SUM(CAST(REPLACE(REPLACE(REPLACE(amount,' ',''),'₽',''),'руб','') AS REAL)),0)";
    $revenue=(float)db_val("SELECT $revSql FROM payments");
    $visitsTotal=(int)db_val("SELECT COUNT(*) FROM visits");
    $visitsToday=(int)db_val("SELECT COUNT(*) FROM visits WHERE date(created_at)=date('now','localtime')");
    // Ряд за 14 дней — для анимационных графиков (лиды / выручка / визиты).
    $series=[];
    for($i=13;$i>=0;$i--){ $d=date('Y-m-d', strtotime("-$i day"));
        $series[]=['d'=>date('d.m',strtotime($d)),
            'leads'=>(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)=?",[$d]),
            'revenue'=>(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)=?",[$d]),
            'visits'=>(int)db_val("SELECT COUNT(*) FROM visits WHERE date(created_at)=?",[$d])];
    }
    out(['ok'=>true,'total_subs'=>$total,'paid'=>$paid,'unpaid'=>$total-$paid,'today'=>$today,'payments'=>$payCount,
        'revenue'=>$revenue,'visits_total'=>$visitsTotal,'visits_today'=>$visitsToday,
        'conversion'=>$total?round($paid*100/$total):0,'series'=>$series,
        'by_status'=>db_all("SELECT status, COUNT(*) c FROM clients GROUP BY status"),
        'recent'=>db_all("SELECT id,name,email,tg,niche,status,paid,created_at FROM clients ORDER BY id DESC LIMIT 20"),
        'deals'=>db_all("SELECT d.*, c.name FROM deals d LEFT JOIN clients c ON c.id=d.client_id ORDER BY d.id DESC LIMIT 10")]);

case 'getClients':
    require_admin();
    $q=trim($_GET['q']??''); $st=trim($_GET['status']??''); $w=[]; $p=[];
    if($q){ $w[]="(name LIKE ? OR email LIKE ? OR tg LIKE ? OR niche LIKE ?)"; array_push($p,"%$q%","%$q%","%$q%","%$q%"); }
    if($st){ $w[]="status=?"; $p[]=$st; }
    out(['ok'=>true,'clients'=>db_all("SELECT * FROM clients".($w?" WHERE ".implode(' AND ',$w):"")." ORDER BY id DESC LIMIT 200",$p)]);

case 'getClient':
    require_admin();
    $id=(int)($_GET['id']??0); $client=db_one("SELECT * FROM clients WHERE id=?",[$id]); if(!$client) fail('Не найден',404);
    out(['ok'=>true,'client'=>$client,
        'dialogs'=>db_all("SELECT * FROM dialogs WHERE client_id=? ORDER BY id ASC",[$id]),
        'payments'=>db_all("SELECT * FROM payments WHERE client_id=? ORDER BY id DESC",[$id]),
        'anketas'=>db_all("SELECT id,submission_id,service_type,complete,created_at FROM anketa_submissions WHERE client_id=? ORDER BY id DESC",[$id]),
        'responses'=>db_all("SELECT * FROM responses WHERE client_id=? ORDER BY id DESC",[$id]),
        'deals'=>db_all("SELECT * FROM deals WHERE client_id=? ORDER BY id DESC",[$id])]);

case 'updateClient':
    require_admin();
    $id=(int)($body['id']??0); if(!$id) fail('Нет id');
    if(isset($body['status'])) db_exec("UPDATE clients SET status=? WHERE id=?",[$body['status'],$id]);
    if(isset($body['note']))   db_exec("UPDATE clients SET note=? WHERE id=?",[$body['note'],$id]);
    out(['ok'=>true]);

case 'getAnketas':
    require_admin();
    out(['ok'=>true,'anketas'=>db_all("SELECT id,submission_id,service_type,client_name,email,tg,progress,total,complete,created_at FROM anketa_submissions ORDER BY id DESC LIMIT 300")]);

case 'getDialogs':
    require_admin();
    $cid=(int)($_GET['client_id']??0);
    out(['ok'=>true,'dialogs'=>db_all($cid?"SELECT * FROM dialogs WHERE client_id=? ORDER BY id ASC":"SELECT d.*, c.name client_name FROM dialogs d LEFT JOIN clients c ON c.id=d.client_id ORDER BY d.id DESC LIMIT 200",$cid?[$cid]:[])]);

case 'getVacancies': require_admin(); out(['ok'=>true,'vacancies'=>db_all("SELECT * FROM vacancies ORDER BY id DESC LIMIT 200")]);
case 'getResponses': require_admin(); out(['ok'=>true,'responses'=>db_all("SELECT * FROM responses ORDER BY id DESC LIMIT 200")]);
case 'getPayments': require_admin(); out(['ok'=>true,'payments'=>db_all("SELECT * FROM payments ORDER BY id DESC LIMIT 200")]);
case 'getSubscribers': require_admin(); out(['ok'=>true,'subscribers'=>contacts_all('all'),'log'=>db_all("SELECT * FROM newsletter_log ORDER BY id DESC LIMIT 20")]);
case 'getProducts':
    require_admin();
    $all=contacts_all('all'); $rows=[];
    foreach($GLOBALS['PRODUCTS'] as $k=>$p){
        $leads=0;$paid=0;
        foreach($all as $r){ if(strpos((string)($r['products']??''),$k)!==false){ $leads++; if((int)$r['paid']===1)$paid++; } }
        $rows[]=['key'=>$k,'name'=>$p['name'],'emoji'=>$p['emoji'],'leads'=>$leads,'paid'=>$paid];
    }
    out(['ok'=>true,'products'=>$rows]);
case 'sendNewsletter':
    require_admin();
    $subject=trim($body['subject']??''); $content=trim($body['content']??'');
    $seg=$body['segment']??'all'; $btnText=trim($body['btnText']??''); $btnUrl=trim($body['btnUrl']??'');
    if(!$subject||!$content){ out(['ok'=>false,'error'=>'Нет темы или текста']); }
    $subs=contacts_all($seg);
    $btns=$btnText?[['text'=>$btnText,'url'=>$btnUrl,'primary'=>true]]:[];
    $sent=0;$failed=0;
    foreach($subs as $s){ if(empty($s['email']))continue;
        $pc=str_replace(['{{name}}','{{email}}'],[$s['name']?:'друг',$s['email']],$content);
        $html=emailTpl($subject,nl2br(htmlspecialchars($pc)),$btns);
        sendEmail($s['email'],$subject,$html)?$sent++:$failed++; usleep(250000);
    }
    db_insert("INSERT INTO newsletter_log (subject,segment,sent,failed,created_at) VALUES (?,?,?,?,?)",[$subject,$seg,$sent,$failed,now()]);
    out(['ok'=>true,'sent'=>$sent,'failed'=>$failed]);

case 'downloadAnketa':
    require_admin(); require __DIR__.'/anketa_download.php'; download_anketa_zip($_GET['id']??''); exit;

case 'agentDialog':
    require_agent(); $cid=agent_resolve_client($body);
    db_insert("INSERT INTO dialogs (client_id,tg_user_id,account,role,message,stage,created_at) VALUES (?,?,?,?,?,?,?)",
        [$cid,$body['tg_user_id']??null,$body['account']??'',$body['role']??'out',$body['message']??'',$body['stage']??'',now()]);
    out(['ok'=>true,'client_id'=>$cid]);
case 'agentVacancy':
    require_agent();
    out(['ok'=>true,'id'=>db_insert("INSERT INTO vacancies (source,source_type,text,niche,budget,score,responded,created_at) VALUES (?,?,?,?,?,?,?,?)",
        [$body['source']??'',$body['source_type']??'channel',$body['text']??'',$body['niche']??'',$body['budget']??'',$body['score']??0,!empty($body['responded'])?1:0,now()])]);
case 'agentResponse':
    require_agent(); $cid=agent_resolve_client($body);
    out(['ok'=>true,'id'=>db_insert("INSERT INTO responses (vacancy_id,client_id,account,message,case_used,created_at) VALUES (?,?,?,?,?,?)",
        [$body['vacancy_id']??null,$cid,$body['account']??'',$body['message']??'',$body['case_used']??'',now()])]);
case 'agentDeal':
    require_agent(); $cid=agent_resolve_client($body);
    out(['ok'=>true,'id'=>db_insert("INSERT INTO deals (client_id,product,tariff,amount,status,kp_url,contract_path,created_at) VALUES (?,?,?,?,?,?,?,?)",
        [$cid,$body['product']??'',$body['tariff']??'',(int)($body['amount']??0),$body['status']??'open',$body['kp_url']??'',$body['contract_path']??'',now()])]);
case 'getAnketaForAgent':
    require_agent();
    $a=db_one("SELECT * FROM anketa_submissions WHERE submission_id=? OR email=? ORDER BY id DESC LIMIT 1",[$body['submission_id']??'',$body['email']??'']);
    if(!$a) fail('Анкета не найдена',404);
    $a['files']=db_all("SELECT filename,path,mime FROM anketa_files WHERE submission_id=?",[$a['submission_id']]);
    out(['ok'=>true,'anketa'=>$a]);

case 'track':
    // Публичный маячок посещений/кликов (ставится на страницы сайта) → аналитика визитов.
    rate_limit('track',120,60);
    $page=substr(trim($body['page']??($_GET['page']??'')),0,200);
    $ref=substr(trim($body['ref']??($_GET['ref']??'')),0,200);
    @db_insert("INSERT INTO visits (page,ref,ua,ip,created_at) VALUES (?,?,?,?,?)",
        [$page,$ref,substr($_SERVER['HTTP_USER_AGENT']??'',0,200),$_SERVER['REMOTE_ADDR']??'',now()]);
    header('Access-Control-Allow-Origin: *'); out(['ok'=>true]);

case 'exportAnalytics':
    require_admin();
    $revSql="COALESCE(SUM(CAST(REPLACE(REPLACE(REPLACE(amount,' ',''),'₽',''),'руб','') AS REAL)),0)";
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=oko_analytics.csv');
    echo "\xEF\xBB\xBF"; $f=fopen('php://output','w');
    fputcsv($f,['Дата','Лиды','Оплаты','Выручка','Визиты','Анкеты'],';');
    for($i=29;$i>=0;$i--){ $d=date('Y-m-d',strtotime("-$i day"));
        fputcsv($f,[$d,
            (int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)=?",[$d]),
            (int)db_val("SELECT COUNT(*) FROM payments WHERE date(created_at)=?",[$d]),
            (float)db_val("SELECT $revSql FROM payments WHERE date(created_at)=?",[$d]),
            (int)db_val("SELECT COUNT(*) FROM visits WHERE date(created_at)=?",[$d]),
            (int)db_val("SELECT COUNT(*) FROM anketa_submissions WHERE date(created_at)=? AND complete=1",[$d]),
        ],';');
    }
    fclose($f); exit;

case 'exportBase':
    require_admin();
    $rows=db_all("SELECT id,name,email,phone,tg,niche,status,products,paid,source,created_at FROM clients ORDER BY id DESC");
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=oko_base.csv');
    echo "\xEF\xBB\xBF"; $f=fopen('php://output','w');
    fputcsv($f,['id','name','email','phone','tg','niche','status','products','paid','source','created_at'],';');
    foreach($rows as $r){ fputcsv($f,[$r['id'],$r['name'],$r['email'],$r['phone'],$r['tg'],$r['niche'],$r['status'],$r['products'],$r['paid'],$r['source'],$r['created_at']],';'); }
    fclose($f); exit;
// ═════════════════════════════════════════════════════════════════
// L5 — Помощник OKO: форвард в Claude через Cloudflare-прокси
// POST {msg, history[]?, context?}   → {reply, usage}
// ═════════════════════════════════════════════════════════════════
case 'assistant':
    rate_limit('assistant',30,60);
    $msg = trim((string)($body['msg']??'')); if($msg==='') fail('empty');
    $key  = (string)($C['anthropic_key'] ?? '');
    $base = rtrim((string)($C['anthropic_base'] ?? 'https://api.anthropic.com'),'/');
    $model= (string)($C['anthropic_model'] ?? 'claude-haiku-4-5-20250929');
    if(!$key) fail('no anthropic key',500);
    $hist = is_array($body['history']??null)?array_slice($body['history'],-8):[];
    $ctx  = trim((string)($body['context']??''));
    $sys  = "Ты — Личный Помощник OKO. Отвечаешь по-русски, коротко и по делу, mobile-first. Помогаешь предпринимателю с ростом в соцсетях, продажами, контентом, автоматизацией. Не упоминай что ты нейросеть, Claude, OpenAI и т.п. Ты — OKO.";
    if($ctx) $sys .= "\n\nКонтекст пользователя:\n".mb_substr($ctx,0,1500);
    $messages = [];
    foreach($hist as $h){ $r=($h['role']??'')==='assistant'?'assistant':'user'; $t=trim((string)($h['text']??$h['content']??''));
      if($t!=='') $messages[]=['role'=>$r,'content'=>$t]; }
    $messages[] = ['role'=>'user','content'=>$msg];
    $payload = ['model'=>$model,'max_tokens'=>800,'system'=>$sys,'messages'=>$messages];
    $ch = curl_init($base.'/v1/messages');
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','x-api-key: '.$key,'anthropic-version: 2023-06-01'],
        CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>45,CURLOPT_CONNECTTIMEOUT=>10]);
    $raw = curl_exec($ch); $err=curl_error($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    if(!$raw) fail('upstream: '.$err,502);
    $j = json_decode($raw,true);
    if($code>=400) fail('claude '.$code.': '.(($j['error']['message']??'')?:mb_substr($raw,0,200)),502);
    $reply=''; foreach(($j['content']??[]) as $b){ if(($b['type']??'')==='text') $reply.=$b['text']; }
    db_exec("CREATE TABLE IF NOT EXISTS assistant_log (id INTEGER PRIMARY KEY AUTOINCREMENT, client_email TEXT, msg TEXT, reply TEXT, tokens_in INTEGER, tokens_out INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')))");
    db_insert("INSERT INTO assistant_log (client_email,msg,reply,tokens_in,tokens_out) VALUES (?,?,?,?,?)",
        [trim((string)($body['email']??'')), $msg, $reply, (int)($j['usage']['input_tokens']??0), (int)($j['usage']['output_tokens']??0)]);
    out(['ok'=>true,'reply'=>$reply,'usage'=>$j['usage']??null]);

// ═════════════════════════════════════════════════════════════════
// L8 — Партнёрка: выдать оплаты-URL с реф-кодом + записать клик
// POST {product, ref?, email?, name?}   → {url}
// ═════════════════════════════════════════════════════════════════
case 'pay_url':
    rate_limit('pay_url',60,60);
    $product = (string)($body['product']??'sistema');
    $url = $C['lava'][$product] ?? '';
    if(!$url) fail('unknown product');
    $ref = trim((string)($body['ref']??'')); $ref=preg_replace('/[^A-Za-z0-9_\-]/','',$ref);
    if($ref!==''){
      $url .= (strpos($url,'?')===false?'?':'&').'ref='.urlencode($ref).'&partner='.urlencode($ref);
      db_exec("CREATE TABLE IF NOT EXISTS partner_clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT, product TEXT, ip TEXT, ua TEXT, buyer_email TEXT, created_at TEXT DEFAULT (datetime('now','localtime')))");
      db_insert("INSERT INTO partner_clicks (ref,product,ip,ua,buyer_email) VALUES (?,?,?,?,?)",
        [$ref,$product,$_SERVER['REMOTE_ADDR']??'',mb_substr($_SERVER['HTTP_USER_AGENT']??'',0,200),trim((string)($body['email']??''))]);
    }
    out(['ok'=>true,'url'=>$url]);

// ═════════════════════════════════════════════════════════════════
// L8 — Lava webhook: приём оплаты + начисление 15% партнёру
// POST body — JSON от Lava (buyer.email, product.title, amount, status)
// Auth: HTTP Basic (lava_webhook_user:lava_webhook_pass)
// ═════════════════════════════════════════════════════════════════
case 'lava_webhook':
    $u = $_SERVER['PHP_AUTH_USER'] ?? '';
    $p = $_SERVER['PHP_AUTH_PW']   ?? '';
    if(!hash_equals((string)($C['lava_webhook_user']??''),(string)$u) ||
       !hash_equals((string)($C['lava_webhook_pass']??''),(string)$p)){
        header('WWW-Authenticate: Basic realm="lava"'); fail('Unauthorized',401);
    }
    db_exec("CREATE TABLE IF NOT EXISTS partner_payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT, buyer_email TEXT, product TEXT, amount REAL, partner_amount REAL, status TEXT, invoice_id TEXT, created_at TEXT DEFAULT (datetime('now','localtime')))");
    $status = strtolower((string)($body['status']??$body['eventType']??''));
    $email  = trim((string)($body['buyer']['email']??$body['email']??''));
    $amount = (float)($body['amount']??$body['sum']??0);
    $title  = (string)($body['product']['title']??$body['product']??'');
    $ref    = (string)($body['clientUtm']['utm_content']??$body['partnerId']??$body['ref']??'');
    $inv    = (string)($body['id']??$body['invoiceId']??$body['contractId']??'');
    file_put_contents(sys_get_temp_dir().'/oko_lava_'.time().'.json', json_encode($body,JSON_UNESCAPED_UNICODE));
    if(!in_array($status,['success','completed','paid','subscription-active','subscription.recurring.payment.success'])) out(['ok'=>true,'skipped'=>$status]);
    $prodKey = 'sistema';
    if(stripos($title,'завод')!==false||stripos($title,'zavod')!==false) $prodKey='zavod';
    if(stripos($title,'консульт')!==false||stripos($title,'consult')!==false) $prodKey='consult';
    if($email) mark_paid($email,$prodKey,(string)$amount,false);
    if($ref!==''){
      $pct = (float)($C['partner_percent']??15);
      $payout = round($amount*$pct/100,2);
      db_insert("INSERT INTO partner_payouts (ref,buyer_email,product,amount,partner_amount,status,invoice_id) VALUES (?,?,?,?,?,?,?)",
        [$ref,$email,$prodKey,$amount,$payout,'pending',$inv]);
      tg_send($C['daniel_tg'],"<b>Партнёрская продажа</b>\nref: <code>$ref</code>\n$email · $prodKey · $amount₽\nК выплате: <b>$payout₽</b>",[],topic_thread('deals'));
    }
    out(['ok'=>true,'processed'=>true]);

// ═════════════════════════════════════════════════════════════════
// L6 — Проверка видео (Gemini Vision, multipart upload)
// POST multipart:  file (mp4/mov ≤50MB) + niche?, goal?
// ═════════════════════════════════════════════════════════════════
case 'video_analyze':
    rate_limit('video_analyze',10,60);
    if(empty($_FILES['file']['tmp_name'])) fail('no file');
    if($_FILES['file']['size']>50*1024*1024) fail('too big');
    $keys = $C['gemini_keys'] ?? []; if(!$keys) fail('no gemini keys',500);
    $key = $keys[array_rand($keys)];
    $base = rtrim((string)($C['gemini_base'] ?? 'https://generativelanguage.googleapis.com'),'/');
    $model = (string)($C['gemini_model'] ?? 'gemini-flash-latest');
    $niche = trim((string)($_POST['niche']??''));
    $goal  = trim((string)($_POST['goal']??'вирал в reels'));
    $data = base64_encode(file_get_contents($_FILES['file']['tmp_name']));
    $mime = mime_content_type($_FILES['file']['tmp_name']) ?: 'video/mp4';
    $prompt = "Проанализируй короткое вертикальное видео как продюсер вирусного контента для ниши «$niche», цель — $goal. Верни СТРОГО JSON (без markdown): {\"hook\":0-10, \"dynamics\":0-10, \"clarity\":0-10, \"cta\":0-10, \"score\":0-10, \"strengths\":[..5], \"risks\":[..5], \"fixes\":[..5], \"caption_ru\":\"...\", \"hashtags\":[..10], \"score_reason\":\"1 предложение\"}. По-русски. Только JSON.";
    $payload = ['contents'=>[['parts'=>[
        ['inline_data'=>['mime_type'=>$mime,'data'=>$data]],
        ['text'=>$prompt]
    ]]], 'generationConfig'=>['response_mime_type'=>'application/json','temperature'=>0.4,'max_output_tokens'=>1500]];
    $url = $base.'/v1beta/models/'.$model.':generateContent?key='.urlencode($key);
    $ch = curl_init($url);
    curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER=>['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>90]);
    $raw=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    if(!$raw||$code>=400) fail('gemini '.$code.': '.mb_substr((string)$raw,0,200),502);
    $j=json_decode($raw,true);
    $text = $j['candidates'][0]['content']['parts'][0]['text'] ?? '';
    $parsed = json_decode($text,true);
    if(!$parsed){
        if(preg_match('/\{[\s\S]+\}/', $text, $m)) $parsed = json_decode($m[0],true);
    }
    if(!$parsed) fail('parse: '.mb_substr($text,0,200),502);
    out(['ok'=>true,'result'=>$parsed]);

// ═════════════════════════════════════════════════════════════════
// L7b — соцсети: получение OAuth-callback / сохранение токена
// POST {platform, access_token, handle, email?}
// ═════════════════════════════════════════════════════════════════
case 'socials_link':
    rate_limit('socials_link',20,60);
    $platform = preg_replace('/[^a-z]/','',strtolower((string)($body['platform']??'')));
    if(!in_array($platform,['instagram','telegram','vk','tiktok','youtube'])) fail('bad platform');
    $tok = trim((string)($body['access_token']??''));
    $handle = trim((string)($body['handle']??''));
    $email = trim((string)($body['email']??''));
    if(!$handle) fail('handle required');
    db_exec("CREATE TABLE IF NOT EXISTS user_socials (id INTEGER PRIMARY KEY AUTOINCREMENT, client_email TEXT, platform TEXT, handle TEXT, access_token TEXT, linked_at TEXT DEFAULT (datetime('now','localtime')), UNIQUE(client_email,platform))");
    db_exec("INSERT INTO user_socials (client_email,platform,handle,access_token) VALUES (?,?,?,?) ON CONFLICT(client_email,platform) DO UPDATE SET handle=excluded.handle,access_token=excluded.access_token,linked_at=datetime('now','localtime')",
        [$email,$platform,$handle,$tok]);
    out(['ok'=>true,'linked'=>$platform.':'.$handle]);

case 'health': out(['ok'=>true,'db'=>'sqlite','clients'=>(int)db_val("SELECT COUNT(*) FROM clients"),'v'=>4]);

default: fail('unknown action',404);
}

// ── helpers ────────────────────────────────────────────────────
function mark_paid($email,$product,$amount,$manual){
    $C=cfg(); $c=db_one("SELECT id,name,tg FROM clients WHERE email=?",[$email]);
    if($c){ db_exec("UPDATE clients SET paid=1,paid_product=?,paid_ts=?,status='deal' WHERE id=?",[$product,now(),$c['id']]); }
    else { $cid=client_upsert(['name'=>'Клиент','email'=>$email,'products'=>[$product],'status'=>'deal']);
        db_exec("UPDATE clients SET paid=1,paid_product=?,paid_ts=? WHERE id=?",[$product,now(),$cid]); $c=['id'=>$cid,'name'=>'Клиент','tg'=>'']; }
    db_insert("INSERT INTO payments (client_id,email,name,product,amount,manual,created_at) VALUES (?,?,?,?,?,?,?)",[$c['id'],$email,$c['name'],$product,$amount,$manual?1:0,now()]);
    db_insert("INSERT INTO deals (client_id,product,amount,status,created_at,closed_at) VALUES (?,?,?,?,?,?)",[$c['id'],$product,(int)preg_replace('/\D/','',$amount),'won',now(),now()]);
    tg_send($C['daniel_tg'],"💰 <b>Оплата</b>\n\n{$c['name']}\n$email\n$product".($amount?"\n$amount":''), !empty($c['tg'])?[[['text'=>"Написать",'url'=>"https://t.me/{$c['tg']}"]]]:[], topic_thread('deals'));
}
function agent_resolve_client(array $b){
    if(!empty($b['client_id'])) return (int)$b['client_id'];
    if(!empty($b['email'])||!empty($b['tg'])){
        $c=db_one("SELECT id FROM clients WHERE email=? OR tg=?",[$b['email']??'',$b['tg']??'']);
        if($c) return (int)$c['id'];
        return client_upsert(['name'=>$b['name']??'Лид','email'=>$b['email']??'','tg'=>$b['tg']??'','niche'=>$b['niche']??'','status'=>'dialog','source'=>'agent']);
    }
    return null;
}
function daily_summary(){
    $C=cfg(); $today=date('Y-m-d');
    $last=db_val("SELECT v FROM settings WHERE k='daily_summary'");
    if((int)date('G')<21 || $last===$today) return;
    db_exec("INSERT OR REPLACE INTO settings (k,v,updated_at) VALUES ('daily_summary',?,?)",[$today,now()]);
    $l=db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)=date('now','localtime')");
    $p=db_val("SELECT COUNT(*) FROM payments WHERE date(created_at)=date('now','localtime')");
    $a=db_val("SELECT COUNT(*) FROM anketa_submissions WHERE date(created_at)=date('now','localtime') AND complete=1");
    tg_send($C['daniel_tg'],"📊 <b>Сводка за ".date('d.m')."</b>\n\nЛидов: $l\nОплат: $p\nАнкет: $a",[],topic_thread('analytics'));
}
