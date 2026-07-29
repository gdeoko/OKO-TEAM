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

// ═════════════════════════════════════════════════════════════════
// L9 — Кошелёк OKO: P2P-переводы между юзерами через SQLite
// Таблицы: wallet_accounts (email UNIQUE, balance, hold), wallet_ledger (from,to,amount,direction,tx_id).
// Операции: wallet_balance / wallet_transfer / wallet_history / wallet_topup.
// Комиссия OKO 1% с отправителя пишется отдельной строкой direction='fee'.
// ═════════════════════════════════════════════════════════════════
case 'wallet_balance':
    $email = strtolower(trim($_GET['email'] ?? ($body['email'] ?? '')));
    if(!$email) fail('no email');
    wallet_ensure_account($email);
    $a = db_one("SELECT balance, hold FROM wallet_accounts WHERE client_email=?", [$email]);
    out(['ok'=>true, 'email'=>$email, 'balance'=>(int)$a['balance'], 'hold'=>(int)$a['hold'], 'currency'=>'RUB']);

case 'wallet_transfer':
    $from = strtolower(trim($body['from_email'] ?? ''));
    if(!$from) fail('no from_email');
    // rate limit: не более 5 переводов в минуту на пользователя+IP
    rate_limit('wtx_'.md5($from), 5, 60);
    $tokey   = trim($body['to_nick_or_email'] ?? '');
    $amount  = (int)round((float)($body['amount'] ?? 0));
    $comment = mb_substr(trim((string)($body['comment'] ?? '')), 0, 140);
    if(!$tokey)      fail('no recipient');
    if($amount <= 0) fail('amount must be > 0');
    if($amount > 10000000) fail('amount too big');
    // resolve recipient email
    $to = null;
    if(strpos($tokey,'@') !== false && strpos($tokey,'.') !== false){
        $to = strtolower($tokey);
    } else {
        $nick = ltrim($tokey, '@');
        $r = db_one("SELECT email FROM clients WHERE (lower(tg)=lower(?) OR lower(name)=lower(?)) AND email IS NOT NULL AND email!='' LIMIT 1",[$nick,$nick]);
        if($r && !empty($r['email'])) $to = strtolower($r['email']);
    }
    if(!$to)         fail('recipient not found', 404);
    if($to === $from) fail('cannot transfer to yourself');
    $fee  = (int)floor($amount * 0.01);          // 1% комиссия OKO
    $need = $amount + $fee;
    wallet_ensure_account($from);
    wallet_ensure_account($to);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $bal = (int)$pdo->query("SELECT balance FROM wallet_accounts WHERE client_email=".$pdo->quote($from))->fetchColumn();
        if($bal < $need){ $pdo->rollBack(); fail('insufficient funds: balance '.$bal.' < required '.$need); }
        $tx   = 'TX-'.strtoupper(bin2hex(random_bytes(6)));
        $now  = now();
        $pdo->prepare("UPDATE wallet_accounts SET balance=balance-?, updated_at=? WHERE client_email=?")->execute([$need,   $now, $from]);
        $pdo->prepare("UPDATE wallet_accounts SET balance=balance+?, updated_at=? WHERE client_email=?")->execute([$amount, $now, $to]);
        $ins = $pdo->prepare("INSERT INTO wallet_ledger (from_email,to_email,amount,direction,comment,tx_id,status,created_at) VALUES (?,?,?,?,?,?,?,?)");
        $ins->execute([$from, $to,  $amount, 'send',    $comment,           $tx, 'ok', $now]);
        $ins->execute([$from, $to,  $amount, 'receive', $comment,           $tx, 'ok', $now]);
        if($fee > 0)
        $ins->execute([$from, 'oko',$fee,    'fee',     'Комиссия OKO 1%',  $tx, 'ok', $now]);
        $pdo->commit();
    } catch(Throwable $e){
        try{ $pdo->rollBack(); }catch(Throwable $e2){}
        fail('tx error: '.$e->getMessage(), 500);
    }
    $newBal = (int)db_val("SELECT balance FROM wallet_accounts WHERE client_email=?", [$from]);
    // уведомление получателю в Telegram, если у него привязан tg-id
    $rc = db_one("SELECT name, tg, tg_user_id FROM clients WHERE lower(email)=? LIMIT 1", [$to]);
    if($rc && !empty($rc['tg_user_id']))
        tg_send((string)$rc['tg_user_id'], "💸 <b>Пришло ".number_format($amount,0,'.',' ')." ₽</b>\n\nОт: <code>".htmlspecialchars($from)."</code>".($comment?"\n\n«".htmlspecialchars($comment)."»":''));
    out(['ok'=>true, 'tx_id'=>$tx, 'amount'=>$amount, 'fee'=>$fee, 'total'=>$need, 'balance'=>$newBal, 'to'=>$to]);

case 'wallet_history':
    $email = strtolower(trim($_GET['email'] ?? ''));
    $limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));
    if(!$email) fail('no email');
    wallet_ensure_account($email);
    // отдаём все касающиеся юзера строки (send/fee исходящие + receive входящие + topup зачисления)
    $rows = db_all("SELECT id, from_email, to_email, amount, direction, comment, tx_id, status, created_at
        FROM wallet_ledger
        WHERE (from_email=? AND direction IN ('send','fee','topup_charge'))
           OR (to_email=?   AND direction IN ('receive','topup'))
        ORDER BY id DESC LIMIT ".$limit, [$email, $email]);
    out(['ok'=>true, 'email'=>$email, 'items'=>$rows]);

case 'wallet_topup':
    rate_limit('wallet_topup', 20, 60);
    $email  = strtolower(trim($body['email'] ?? ''));
    $amount = (int)round((float)($body['amount'] ?? 0));
    $method = trim($body['method'] ?? 'card');
    if(!$email)      fail('no email');
    if($amount <= 0) fail('amount must be > 0');
    wallet_ensure_account($email);
    $lavaKey = (string)($C['lava_api_key'] ?? '');
    $url = '';
    // Lava.top динамический счёт (если ключ есть)
    if($lavaKey){
        $orderId = 'oko-wallet-'.time().'-'.substr(md5($email.$amount),0,6);
        $ch = curl_init('https://api.lava.top/business/invoice');
        curl_setopt_array($ch,[
            CURLOPT_POST=>true,
            CURLOPT_POSTFIELDS=>json_encode([
                'sum'=>$amount, 'orderId'=>$orderId, 'currency'=>'RUB',
                'buyerEmail'=>$email, 'comment'=>'OKO WALLET · пополнение счёта',
                'hookUrl'=>($C['site_url']??'https://okoteam.top').'/api.php?action=lava_webhook',
            ], JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-Api-Key: '.$lavaKey],
            CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>10, CURLOPT_CONNECTTIMEOUT=>5,
        ]);
        $raw = curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
        if($code>=200 && $code<300 && $raw){
            $j = json_decode($raw, true) ?: [];
            $url = $j['url'] ?? ($j['paymentUrl'] ?? ($j['data']['url'] ?? ''));
        }
    }
    // fallback: готовый product-URL
    if(!$url) $url = (string)($C['lava']['sistema'] ?? 'https://app.lava.top');
    db_exec("CREATE TABLE IF NOT EXISTS wallet_topup_requests (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, amount INTEGER, method TEXT, url TEXT, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT (datetime('now','localtime')))");
    db_insert("INSERT INTO wallet_topup_requests (email,amount,method,url) VALUES (?,?,?,?)", [$email,$amount,$method,$url]);
    out(['ok'=>true, 'url'=>$url, 'amount'=>$amount, 'method'=>$method]);

// ── Web Push (VAPID) ────────────────────────────────────────────
// Таблица подписок создаётся лениво при первом обращении.
case 'push_subscribe':
    rate_limit('push_sub',30,60);
    push_ensure_table();
    $sub   = $body['subscription'] ?? null;
    $email = trim(strtolower($body['email'] ?? ''));
    $ua    = substr((string)($body['ua'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 512);
    if(!is_array($sub) || empty($sub['endpoint']) || empty($sub['keys']['p256dh']) || empty($sub['keys']['auth'])){
        fail('bad subscription');
    }
    $endpoint = (string)$sub['endpoint'];
    $p256dh   = (string)$sub['keys']['p256dh'];
    $auth     = (string)$sub['keys']['auth'];
    if(strlen($endpoint) > 2048) fail('endpoint too long');
    // upsert по endpoint
    $ex = db_one("SELECT id FROM push_subs WHERE endpoint=?", [$endpoint]);
    if($ex){
        db_exec("UPDATE push_subs SET client_email=COALESCE(NULLIF(?,''),client_email),
                 p256dh=?, auth=?, ua=?, updated_at=? WHERE id=?",
                [$email, $p256dh, $auth, $ua, now(), $ex['id']]);
    } else {
        db_insert("INSERT INTO push_subs (client_email,endpoint,p256dh,auth,ua,created_at,updated_at)
                   VALUES (?,?,?,?,?,?,?)",
                [$email, $endpoint, $p256dh, $auth, $ua, now(), now()]);
    }
    out(['ok'=>true,'stored'=>true]);

case 'push_unsubscribe':
    rate_limit('push_unsub',30,60);
    push_ensure_table();
    $endpoint = trim((string)($body['endpoint'] ?? ''));
    if($endpoint === '') fail('bad endpoint');
    $n = db_exec("DELETE FROM push_subs WHERE endpoint=?", [$endpoint]);
    out(['ok'=>true,'deleted'=>$n]);

case 'push_send':
    require_admin();
    rate_limit('push_send',20,60);
    push_ensure_table();
    $C = cfg();
    if(empty($C['vapid_public']) || empty($C['vapid_private']) ||
       $C['vapid_public']==='PUT_ON_VPS' || $C['vapid_private']==='PUT_ON_VPS'){
        fail('VAPID keys not configured on VPS (config.php: vapid_public / vapid_private)', 501);
    }
    // TODO: полноценная отправка — composer require minishlink/web-push, затем
    //   require __DIR__.'/vendor/autoload.php';
    //   use Minishlink\WebPush\WebPush; use Minishlink\WebPush\Subscription;
    //   $wp = new WebPush(['VAPID'=>['subject'=>$C['vapid_subject'],'publicKey'=>$C['vapid_public'],'privateKey'=>$C['vapid_private']]]);
    //   foreach($subs as $s) $wp->queueNotification(Subscription::create([...]), json_encode($payload));
    //   foreach($wp->flush() as $r) if(!$r->isSuccess() && $r->isSubscriptionExpired()) delete($r->getEndpoint());
    fail('push_send not implemented — install minishlink/web-push on VPS to enable', 501);

case 'health': out(['ok'=>true,'db'=>'sqlite','clients'=>(int)db_val("SELECT COUNT(*) FROM clients"),'v'=>4]);

// ── HQ (3D-штаб): публичные метрики без PII, только агрегаты ──
case 'hq_metrics_live':
    $revSql="COALESCE(SUM(CAST(REPLACE(REPLACE(REPLACE(amount,' ',''),'₽',''),'руб','') AS REAL)),0)";
    $today=(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)=date('now','localtime')");
    $paysToday=(int)db_val("SELECT COUNT(*) FROM payments WHERE date(created_at)=date('now','localtime')");
    $revToday=(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)=date('now','localtime')");
    $rev30=(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)>=date('now','-30 day','localtime')");
    $totalClients=(int)db_val("SELECT COUNT(*) FROM clients");
    $paidClients=(int)db_val("SELECT COUNT(*) FROM clients WHERE paid=1");
    $dau=(int)db_val("SELECT COUNT(DISTINCT ip) FROM visits WHERE date(created_at)=date('now','localtime')");
    // ряд 14д (для стен-графиков)
    $series=[];
    for($i=13;$i>=0;$i--){ $d=date('Y-m-d', strtotime("-$i day"));
        $series[]=['d'=>date('d.m',strtotime($d)),
            'leads'=>(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)=?",[$d]),
            'rev'=>(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)=?",[$d]),
            'dau'=>(int)db_val("SELECT COUNT(DISTINCT ip) FROM visits WHERE date(created_at)=?",[$d])];
    }
    out(['ok'=>true,'ts'=>time(),
        'mrr'=>round($rev30),'rev_today'=>round($revToday),
        'leads_today'=>$today,'pays_today'=>$paysToday,
        'clients_total'=>$totalClients,'clients_paid'=>$paidClients,
        'conversion'=>$totalClients?round($paidClients*100/$totalClients,1):0,
        'dau'=>$dau,'series'=>$series]);

// ── HQ live-feed: последние события команды, анонимизированные ──
case 'hq_feed_live':
    $anon=function($s){$s=trim((string)$s);if(!$s) return '—';$m=mb_substr($s,0,1); $n=mb_strlen($s); return $m.str_repeat('*',max(1,min(4,$n-1)));};
    $anonEmail=function($e){if(!$e||strpos($e,'@')===false) return '';list($a,$b)=explode('@',$e,2); return mb_substr($a,0,2).'***@'.$b;};
    $items=[];
    // новые лиды
    foreach(db_all("SELECT id,name,niche,created_at,paid,paid_product FROM clients ORDER BY id DESC LIMIT 30") as $r){
        $items[]=['t'=>$r['created_at'],'id'=>'sales',
            'msg'=>($r['paid']?'клиент купил · '.($r['paid_product']?:'PRO'):'новый лид · '.($r['niche']?:'без ниши'))
                .' · '.$anon($r['name'])];
    }
    // оплаты
    foreach(db_all("SELECT client_id,name,product,amount,created_at,manual FROM payments ORDER BY id DESC LIMIT 20") as $r){
        $items[]=['t'=>$r['created_at'],'id'=>'ceo',
            'msg'=>'оплата · '.($r['product']?:'—').' · '.($r['amount']?:'—').' · '.$anon($r['name']).($r['manual']?' (вручную)':'')];
    }
    // сделки
    foreach(db_all("SELECT d.status,d.product,d.amount,d.created_at,c.name FROM deals d LEFT JOIN clients c ON c.id=d.client_id ORDER BY d.id DESC LIMIT 15") as $r){
        $items[]=['t'=>$r['created_at'],'id'=>'sales',
            'msg'=>'сделка '.($r['status']?:'').' · '.($r['product']?:'—').' · '.$anon($r['name'])];
    }
    // отклики агентов/подрядчиков
    foreach(db_all("SELECT r.status,r.created_at,c.name FROM responses r LEFT JOIN clients c ON c.id=r.client_id ORDER BY r.id DESC LIMIT 10") as $r){
        $items[]=['t'=>$r['created_at'],'id'=>'support','msg'=>'отклик · '.($r['status']?:'—').' · '.$anon($r['name'])];
    }
    // сортировка по времени
    usort($items, function($a,$b){return strcmp($b['t'],$a['t']);});
    $items=array_slice($items,0,25);
    out(['ok'=>true,'ts'=>time(),'items'=>$items]);

// ── HQ топ-30 клиентов для комнаты клиентов (публично, без email/tg/note) ──
case 'hq_clients_top':
    $rows=db_all("SELECT id,name,niche,status,paid,paid_product,created_at FROM clients ORDER BY paid DESC, id DESC LIMIT 30");
    $out=[];
    foreach($rows as $r){
        $n=trim((string)$r['name']); if($n===''||$n==='Лид') $n='Клиент #'.$r['id'];
        // инициалы для аватара
        $parts=preg_split('/\s+/', $n); $ini='';
        foreach($parts as $p){ $ini.=mb_substr($p,0,1); if(mb_strlen($ini)>=2) break; }
        $out[]=['id'=>(int)$r['id'],'name'=>$n,'ini'=>mb_strtoupper($ini?:'K'),
            'niche'=>$r['niche']?:'','status'=>$r['status']?:'lead',
            'paid'=>(int)$r['paid'],'product'=>$r['paid_product']?:'','ts'=>$r['created_at']];
    }
    out(['ok'=>true,'items'=>$out]);

// ── HQ admin-действие: возврат / ручное зачисление / скидка / смена статуса ──
case 'hq_admin_action':
    require_admin();
    $op=(string)($body['op']??'');
    $email=(string)($body['email']??'');
    $cid=(int)($body['client_id']??0);
    if($cid && !$email){ $c=db_one("SELECT email FROM clients WHERE id=?",[$cid]); if($c) $email=(string)$c['email']; }
    if($op==='refund'){
        if(!$email) fail('email required');
        db_exec("UPDATE clients SET paid=0,status='refund' WHERE email=?",[$email]);
        db_insert("INSERT INTO deals (client_id,product,amount,status,created_at,closed_at) VALUES (?,?,?,?,?,?)",
            [$cid,'refund',0,'refunded',now(),now()]);
        tg_send($C['daniel_tg'],"↩️ <b>Возврат</b>\n$email");
        out(['ok'=>true,'op'=>'refund','email'=>$email]);
    }
    if($op==='manual_confirm'){
        $product=(string)($body['product']??'sistema');
        $amount=(string)($body['amount']??'');
        if(!$email) fail('email required');
        mark_paid($email,$product,$amount,true);
        out(['ok'=>true,'op'=>'manual_confirm','email'=>$email]);
    }
    if($op==='discount'){
        if(!$cid) fail('client_id required');
        $pct=(int)($body['pct']??10);
        db_exec("UPDATE clients SET note=COALESCE(note,'')||' | скидка '||?||'% выдана '||? WHERE id=?",[$pct,now(),$cid]);
        tg_send($C['daniel_tg'],"🎟 <b>Скидка выдана</b>\n$email · $pct%");
        out(['ok'=>true,'op'=>'discount','client_id'=>$cid,'pct'=>$pct]);
    }
    if($op==='set_status'){
        if(!$cid) fail('client_id required');
        $st=(string)($body['status']??'dialog');
        db_exec("UPDATE clients SET status=? WHERE id=?",[$st,$cid]);
        out(['ok'=>true,'op'=>'set_status','client_id'=>$cid,'status'=>$st]);
    }
    fail('unknown op');

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
function wallet_ensure_account($email){
    static $schemaReady = false;
    if(!$schemaReady){
        db_exec("CREATE TABLE IF NOT EXISTS wallet_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_email TEXT UNIQUE NOT NULL,
            balance INTEGER NOT NULL DEFAULT 0,
            hold INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT DEFAULT (datetime('now','localtime')))");
        db_exec("CREATE TABLE IF NOT EXISTS wallet_ledger (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_email TEXT, to_email TEXT,
            amount INTEGER NOT NULL,
            direction TEXT NOT NULL,
            comment TEXT, tx_id TEXT,
            status TEXT DEFAULT 'ok',
            created_at TEXT DEFAULT (datetime('now','localtime')))");
        db_exec("CREATE INDEX IF NOT EXISTS idx_wal_led_from ON wallet_ledger(from_email)");
        db_exec("CREATE INDEX IF NOT EXISTS idx_wal_led_to   ON wallet_ledger(to_email)");
        $schemaReady = true;
    }
    db_exec("INSERT OR IGNORE INTO wallet_accounts (client_email,balance,hold,updated_at) VALUES (?,0,0,?)",[$email, now()]);
}
// Web Push подписки: создаём таблицу лениво (без миграций).
function push_ensure_table(){
    static $ready = false; if($ready) return;
    db_exec("CREATE TABLE IF NOT EXISTS push_subs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_email TEXT,
        endpoint TEXT UNIQUE NOT NULL,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        ua TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT)");
    db_exec("CREATE INDEX IF NOT EXISTS idx_push_email ON push_subs(client_email)");
    $ready = true;
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
