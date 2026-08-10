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
// Подпись на одну анкету вместо пароля админки в ссылке: пароль в кнопке
// телеграм-сообщения означает полный доступ у всех, кто видел этот чат.
function anketa_sig(string $sid): string { $C=cfg(); return substr(hash_hmac('sha256',$sid,(string)$C['admin_password']),0,32); }
function anketa_sig_ok(string $sid, string $sig): bool { return $sig!=='' && hash_equals(anketa_sig($sid),$sig); }
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

case 'anketaSlug':
    // Персональная ссылка okoteam.top/anketa-<имя>. Реестр пишет агент, когда
    // готовит клиенту КП: анкета сразу знает имя и услугу, и человек не
    // заполняет заново то, что мы уже выяснили в переписке.
    $slug=preg_replace('/[^\w\-]+/','',$_GET['slug']??'');
    if(!$slug) out(['ok'=>false,'error'=>'нет slug'],400);
    $reg=__DIR__.'/data/anketa_slugs.json';
    $map=is_file($reg)?(json_decode((string)file_get_contents($reg),true)?:[]):[];
    $rec=$map[$slug]??null;
    if(!$rec) out(['ok'=>false,'error'=>'ссылка не зарегистрирована']);
    out(['ok'=>true,'slug'=>$slug,'name'=>$rec['name']??'','email'=>$rec['email']??'',
         'service'=>$rec['service']??'','uid'=>$rec['uid']??'']);

case 'uploadAnketaFile':
    // Вложения грузятся ОТДЕЛЬНО от анкеты, а не внутри JSON в base64.
    // Прежняя схема физически не пропускала видео и голосовые: base64 раздувает
    // файл в полтора раза, и весь POST упирался в лимит — клиент видел «отправлено»,
    // а файлов в архиве не было. Теперь каждый файл идёт своим запросом.
    rate_limit('uploadAnketaFile',200,60);
    $sid=preg_replace('/[^\w.\-]+/','',$_POST['anketa_id']??$_GET['anketa_id']??'');
    if(!$sid) out(['ok'=>false,'error'=>'нет anketa_id'],400);
    // Причину надо называть: «файл не пришёл» одинаково звучало и когда PHP
    // резал файл по своему лимиту, и когда его не выбрали. Из-за этого лимит в
    // 2 МБ прятался за общей фразой, и видео молча терялись.
    $UPERR=[UPLOAD_ERR_INI_SIZE=>'файл больше лимита сервера',
            UPLOAD_ERR_FORM_SIZE=>'файл больше лимита формы',
            UPLOAD_ERR_PARTIAL=>'файл дошёл не целиком',
            UPLOAD_ERR_NO_FILE=>'файл не выбран',
            UPLOAD_ERR_NO_TMP_DIR=>'на сервере нет временной папки',
            UPLOAD_ERR_CANT_WRITE=>'сервер не смог записать файл',
            UPLOAD_ERR_EXTENSION=>'загрузку остановило расширение PHP'];
    $uerr=(int)($_FILES['file']['error']??UPLOAD_ERR_NO_FILE);
    if($uerr!==UPLOAD_ERR_OK||empty($_FILES['file']['tmp_name'])||!is_uploaded_file($_FILES['file']['tmp_name']))
        out(['ok'=>false,'error'=>($UPERR[$uerr]??'файл не пришёл'),
             'limit'=>ini_get('upload_max_filesize')],400);
    $orig=(string)($_FILES['file']['name']??'file');
    if(((int)($_FILES['file']['size']??0))> 400*1024*1024) out(['ok'=>false,'error'=>'файл больше 400 МБ'],413);
    $dir=__DIR__."/uploads/$sid"; if(!is_dir($dir)) @mkdir($dir,0755,true);
    $fn=preg_replace('/[^\w.\-]+/u','_',$orig);
    $ext=strtolower(pathinfo($fn,PATHINFO_EXTENSION));
    // Исполняемое на сервере не принимаем ни под каким видом.
    if(in_array($ext,['php','phtml','php3','php4','php5','phar','cgi','pl','py','sh','htaccess']))
        out(['ok'=>false,'error'=>'такой тип файла не принимаем'],415);
    if(file_exists("$dir/$fn")) $fn=pathinfo($fn,PATHINFO_FILENAME).'_'.substr(md5(mt_rand()),0,5).($ext?".$ext":'');
    if(!move_uploaded_file($_FILES['file']['tmp_name'],"$dir/$fn"))
        out(['ok'=>false,'error'=>'не удалось сохранить'],500);
    $mime=(string)($_FILES['file']['type']??'application/octet-stream');
    db_insert("INSERT INTO anketa_files (submission_id,filename,path,mime,size_bytes,created_at) VALUES (?,?,?,?,?,?)",
        [$sid,$fn,"/uploads/$sid/$fn",$mime,filesize("$dir/$fn"),now()]);
    out(['ok'=>true,'filename'=>$fn,'size'=>filesize("$dir/$fn"),'mime'=>$mime]);

case 'agentDossier':
    // Досье клиента от агента: всё, что конвейер по нему сделал — карточка,
    // тарифы с ценами, ссылки на КП, Систему, договоры и оплату, стадия и
    // дожимы. Раньше эти материалы жили только на стороне агента, и владелец
    // видел куски вместо целого.
    require_agent();
    $uid=preg_replace('/[^\w.\-]+/','',(string)($body['uid']??''));
    if(!$uid) out(['ok'=>false,'error'=>'нет uid'],400);
    $dir=__DIR__.'/data/dossiers'; if(!is_dir($dir)) @mkdir($dir,0755,true);
    file_put_contents("$dir/$uid.json",json_encode($body,JSON_UNESCAPED_UNICODE));
    out(['ok'=>true,'uid'=>$uid]);

case 'dossiers':
    require_admin();
    $dir=__DIR__.'/data/dossiers'; $rows=[];
    foreach(glob("$dir/*.json") as $f){
        $d=json_decode((string)file_get_contents($f),true);
        if($d) $rows[]=$d;
    }
    usort($rows,fn($a,$b)=>(int)($b['updated_at']??0)<=>(int)($a['updated_at']??0));
    out(['ok'=>true,'count'=>count($rows),'dossiers'=>array_slice($rows,0,300)]);

case 'dossierPage':
    // Готовая страница раздела: админка показывает её во вкладке «Материалы».
    // Собирается на сервере — так раздел не зависит от правок в 84 КБ вёрстки.
    require_admin();
    $dir=__DIR__.'/data/dossiers'; $rows=[];
    foreach(glob("$dir/*.json") as $f){ $d=json_decode((string)file_get_contents($f),true); if($d)$rows[]=$d; }
    usort($rows,fn($a,$b)=>(int)($b['updated_at']??0)<=>(int)($a['updated_at']??0));
    $e=fn($x)=>htmlspecialchars((string)$x,ENT_QUOTES,'UTF-8');
    $money=fn($n)=>number_format((int)$n,0,'.',' ');
    $cards='';
    foreach($rows as $d){
        $t='';
        foreach(($d['tariffs']??[]) as $x){
            $pay=($x['pay_url']??'')?'<a href="'.$e($x['pay_url']).'">оплата</a>':'<i>оплаты нет</i>';
            $doc=($x['contract_url']??'')?'<a href="'.$e($x['contract_url']).'">договор</a>':'<i>договора нет</i>';
            $t.='<div class="t"><b>'.$e($x['name']??'').'</b> '.$money($x['price_rub']??0).' ₽ · '.$pay.' · '.$doc.'</div>';
        }
        $L=$d['links']??[];
        $links='';
        foreach(['kp'=>'КП','sistema'=>'Система','anketa'=>'Анкета'] as $k=>$lbl)
            if(!empty($L[$k])) $links.='<a href="'.$e($L[$k]).'">'.$lbl.'</a> ';
        if(!empty($L['workchat_branch'])) $links.='<span class="br">'.$e($L['workchat_branch']).'</span>';
        $soc=implode(' · ',array_map(fn($k,$v)=>$e($k).':'.$e($v),
              array_keys($d['socials']??[]),array_values($d['socials']??[])));
        $cards.='<div class="c"><div class="h">'.$e($d['brand']??$d['uid']??'').
            '<span class="s">'.$e($d['niche']??'').' · '.$e($d['city']??$d['country']??'').
            ' · стадия: '.$e($d['stage']?:'—').' · дожимов '.(int)($d['followups']??0).'/3</span></div>'.
            ($soc?'<div class="m">'.$soc.($d['site']??''?' · '.$e($d['site']):'').'</div>':'').
            ($d['pains']??[]?'<div class="m">боли: '.$e(implode(', ',$d['pains'])).'</div>':'').
            ($d['budget_rub']??0?'<div class="m">бюджет: '.$money($d['budget_rub']).' ₽</div>':'').
            ($d['competitors']??0?'<div class="m">конкурентов '.(int)$d['competitors'].', роликов '.(int)($d['competitor_videos']??0).'</div>':'').
            $t.'<div class="l">'.$links.'</div></div>';
    }
    if(!$cards) $cards='<p class="none">Пока пусто. Материалы появятся, как только агент соберёт первому клиенту КП.</p>';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="ru"><meta charset="utf-8">'
      .'<meta name="viewport" content="width=device-width,initial-scale=1"><style>'
      .'body{margin:0;padding:16px;background:#0d0d0d;color:#eaeaea;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'
      .'.c{background:#151515;border-radius:12px;padding:14px;margin-bottom:12px}'
      .'.h{font-size:16px;font-weight:600}.h .s{display:block;font-size:12px;color:#9a9a9a;font-weight:400;margin-top:2px}'
      .'.m{font-size:12px;color:#b5b5b5;margin-top:6px}'
      .'.t{margin-top:8px;font-size:13px}.l{margin-top:10px;display:flex;gap:10px;flex-wrap:wrap}'
      .'a{color:#9AFF00;text-decoration:none}i{color:#7a7a7a;font-style:normal}'
      .'.br{color:#7a7a7a;font-size:12px}.none{color:#9a9a9a}'
      .'</style><h2 style="margin:0 0 14px">Материалы клиентов — '.count($rows).'</h2>'.$cards.'</html>';
    exit;

case 'saveAnketa':
    rate_limit('saveAnketa',20,60);
    // Идентификатор приходит из браузера и попадает в путь на диске.
    // Строка вида ../.. писала файл клиента куда угодно по сайту.
    $sid=preg_replace('/[^A-Za-z0-9_\-]+/','',(string)($body['anketa_id']??''));
    $sid=substr($sid,0,64);
    if($sid==='') $sid='ank_'.time().'_'.substr(md5(mt_rand()),0,6);
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
    // Пришли по персональной ссылке — кладём метку в ответы, чтобы анкета
    // сошлась с клиентом в админке, даже если он ввёл другое имя.
    $aslug=preg_replace('/[^\w\-]+/','',(string)($body['slug']??''));
    if($aslug) $answers['__slug']=$aslug;
    // Файлы уже лежат на диске (грузились отдельными запросами) — вписываем их
    // в ответы, чтобы в скачанной анкете было видно, что именно прислал клиент.
    $onDisk=db_all("SELECT filename,size_bytes FROM anketa_files WHERE submission_id=?",[$sid]);
    if($onDisk) $answers['files_uploaded']=implode("\n",array_map(
        fn($r)=>$r['filename'].' ('.max(1,(int)round($r['size_bytes']/1024)).' КБ)',$onDisk));
    db_exec("INSERT INTO anketa_submissions (submission_id,client_id,service_type,client_name,email,tg,answers,progress,total,complete,started_at,completed_at,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(submission_id) DO UPDATE SET answers=excluded.answers, progress=excluded.progress, complete=excluded.complete, completed_at=excluded.completed_at",
        [$sid,$cid,$svc,$name,$email,($answers['q7d']??''),json_encode($answers,JSON_UNESCAPED_UNICODE),
         $body['progress']??0,$body['total']??0,$complete?1:0,$body['ts']??now(),$complete?now():null,now()]);
    if($complete && !empty($body['send_notifications']))
        tg_send($C['daniel_tg'],"📋 <b>Новая анкета</b> ($svc)\n\n👤 ".htmlspecialchars($name).($email?"\n📧 $email":''),
            [[['text'=>'📥 Скачать анкету','url'=>$C['site_url'].'/api.php?action=downloadAnketa&id='.urlencode($sid).'&sig='.anketa_sig($sid)]]], topic_thread('hot_leads'));
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
    $__id=(string)($_GET['id']??'');
    if(!admin_ok() && !anketa_sig_ok($__id,(string)($_GET['sig']??''))) fail('Unauthorized',403);
    // require __DIR__.'/anketa_download.php'; download_anketa_zip($_GET['id']??''); exit;

case 'downloadAnketaPdf':
    require_admin(); require __DIR__.'/anketa_report.php'; render_anketa_report($_GET['id']??''); exit;

case 'anketaFile':
    require_admin(); require __DIR__.'/anketa_report.php'; serve_anketa_file((int)($_GET['id']??0)); exit;

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
// L5 — ОКО Ai и все разговорные чаты: Gemini с ротацией ключей
//
// Решение Даниэля 09.08: Claude API не используем — дорого. Все чаты
// (ОКО Ai, поддержка, Даниэль Ai, агенты в диалогах) идут на Gemini:
// ключей четыре, они дешёвые, а на бесплатном тарифе ещё и квотируются
// поштучно — поэтому ключи перебираются по кругу, и упор в лимит одного
// не роняет ответ, а просто уводит запрос на следующий.
//
// POST {msg, history[]?, context?, persona?}   → {reply, usage}
// ═════════════════════════════════════════════════════════════════
case 'assistant':
    rate_limit('assistant',30,60);
    $msg = trim((string)($body['msg']??'')); if($msg==='') fail('empty');
    $keys = $C['gemini_keys'] ?? [];
    if(!$keys) fail('no gemini keys',500);
    if(!is_array($keys)) $keys = [$keys];
    $base  = rtrim((string)($C['gemini_base'] ?? 'https://generativelanguage.googleapis.com'),'/');
    $model = (string)($C['gemini_chat_model'] ?? $C['gemini_model'] ?? 'gemini-flash-latest');
    $hist  = is_array($body['history']??null)?array_slice($body['history'],-8):[];
    $ctx   = trim((string)($body['context']??''));

    /* Кто именно отвечает. Разные чаты — разный голос, но правила общие:
       по-русски, коротко, без упоминания движка под капотом. */
    $PERSONAS = [
        'oko'     => "Ты — ОКО Ai, помощник внутри приложения OKO.",
        'support' => "Ты — поддержка OKO. Отвечаешь как живой человек из команды: спокойно, по делу, без шаблонных фраз.",
        'daniel'  => "Ты — ассистент Даниэля Ильясова, основателя OKO. Говоришь его тоном: прямо, без воды, по-деловому.",
    ];
    $persona = (string)($body['persona'] ?? 'oko');
    $sys = ($PERSONAS[$persona] ?? $PERSONAS['oko'])
         . " Отвечаешь по-русски, коротко и по делу, mobile-first. Помогаешь предпринимателю с ростом"
         . " в соцсетях, продажами, контентом, автоматизацией."
         . " Никогда не называй модель или движок, на котором работаешь, — ты OKO."
         . " Если чего-то не знаешь или данных нет — скажи прямо, не выдумывай цифры и факты.";
    if($ctx) $sys .= "\n\nКонтекст пользователя:\n".mb_substr($ctx,0,1500);

    /* История в формате Gemini: роли user / model. */
    $contents = [];
    foreach($hist as $h){
        $r = (($h['role']??'')==='assistant' || ($h['role']??'')==='model') ? 'model' : 'user';
        $t = trim((string)($h['text']??$h['content']??''));
        if($t!=='') $contents[] = ['role'=>$r,'parts'=>[['text'=>$t]]];
    }
    $contents[] = ['role'=>'user','parts'=>[['text'=>$msg]]];

    $payload = [
        'contents'          => $contents,
        'systemInstruction' => ['parts'=>[['text'=>$sys]]],
        'generationConfig'  => ['temperature'=>0.7,'max_output_tokens'=>900],
    ];

    /* Модели по убыванию качества. Замер 09.08: у флагманской flash на
       бесплатном тарифе лимит 20 запросов — этого не хватает и на одного
       человека, не то что на поток. Поэтому если все ключи упёрлись в 429,
       спускаемся на модель полегче: у неё квота в разы больше, а для
       коротких ответов в чате её хватает с запасом. */
    $models = array_values(array_unique(array_filter([
        $model,
        (string)($C['gemini_chat_fallback'] ?? 'gemini-flash-lite-latest'),
    ])));

    /* Перебор ключ × модель: 429 и 5xx — повод взять следующий ключ, а когда
       кончились ключи — следующую модель. Осмысленный 4xx (кривой запрос)
       повтором не лечится и возвращается сразу. Начинаем со случайного
       ключа, чтобы не выжигать первый в списке. */
    $n = count($keys);
    $start = random_int(0, $n-1);
    $reply = ''; $usage = null; $lastErr = ''; $lastCode = 0; $использована = '';
    foreach($models as $m){
        for($i=0; $i<$n; $i++){
            $key = $keys[($start + $i) % $n];
            $url = $base.'/v1beta/models/'.$m.':generateContent?key='.urlencode($key);
            $ch = curl_init($url);
            curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload,JSON_UNESCAPED_UNICODE),
                CURLOPT_HTTPHEADER=>['Content-Type: application/json'],
                CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>45,CURLOPT_CONNECTTIMEOUT=>10]);
            $raw = curl_exec($ch); $err = curl_error($ch); $code = curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
            if(!$raw){ $lastErr = 'сеть: '.$err; $lastCode = 502; continue; }
            $j = json_decode($raw,true);
            if($code >= 400){
                $lastCode = $code;
                $lastErr  = ($j['error']['message'] ?? '') ?: mb_substr($raw,0,200);
                if($code === 429 || $code >= 500) continue;   /* лимит или сбой — следующий ключ */
                break 2;                                      /* остальное повтором не лечится */
            }
            foreach(($j['candidates'][0]['content']['parts'] ?? []) as $part){
                if(isset($part['text'])) $reply .= $part['text'];
            }
            $usage = [
                'input_tokens'  => (int)($j['usageMetadata']['promptTokenCount'] ?? 0),
                'output_tokens' => (int)($j['usageMetadata']['candidatesTokenCount'] ?? 0),
            ];
            $использована = $m;
            break 2;
        }
    }
    if($reply === ''){
        /* Человеку — по-русски и по делу, без кодов и ссылок на биллинг. */
        $видимо = ($lastCode === 429)
            ? 'Сегодняшний лимит бесплатных запросов исчерпан. Ответы вернутся, как только лимит обновится.'
            : 'ОКО Ai сейчас не отвечает. Это на нашей стороне, попробуй чуть позже.';
        out(['ok'=>false,'error'=>$видимо,'detail'=>'gemini '.$lastCode.': '.mb_substr((string)$lastErr,0,180)], 200);
    }

    db_exec("CREATE TABLE IF NOT EXISTS assistant_log (id INTEGER PRIMARY KEY AUTOINCREMENT, client_email TEXT, msg TEXT, reply TEXT, tokens_in INTEGER, tokens_out INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')))");
    db_insert("INSERT INTO assistant_log (client_email,msg,reply,tokens_in,tokens_out) VALUES (?,?,?,?,?)",
        [trim((string)($body['email']??'')), $msg, $reply, (int)($usage['input_tokens']??0), (int)($usage['output_tokens']??0)]);
    out(['ok'=>true,'reply'=>$reply,'usage'=>$usage]);

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
      tg_send($C['daniel_tg'],"<b>Партнёрская продажа</b>\nref: <code>$ref</code>\n$email · $prodKey · {$amount}₽\nК выплате: <b>{$payout}₽</b>",[],topic_thread('deals'));
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

// ── Состояние интеграций для Штаба OKO ──────────────────────────
// Штаб показывает по каждому ИИ-агенту, чего не хватает для запуска.
// Отдаём ТОЛЬКО факт «ключ настроен / не настроен» — ни значений, ни
// префиксов, ни длины. Иначе панель превратится в способ вытащить секреты.
case 'integrations':
    rate_limit('integrations', 30, 60);
    $has = function($v){
        if (is_array($v)) { foreach($v as $x){ if (trim((string)$x) !== '') return true; } return false; }
        return trim((string)$v) !== '';
    };
    out(['ok'=>true, 'integrations'=>[
        // Все чаты приложения — поддержка, Daniel Ai, агенты в диалогах —
        // отвечают через Gemini: решение Даниэля от 09.08, Claude API для
        // потока сообщений слишком дорог. Строку про Claude оставляем, но
        // честную: приложение к нему не обращается, ключ нужен только мосту
        // в Claude Code, где собираются мини-аппы и контент.
        'gemini'    => ['name'=>'Gemini',          'env'=>'GEMINI_API_KEY',    'ready'=>$has($C['gemini_keys'] ?? ''),    'what'=>'все чаты, ответы ОКО Ai, разбор контента и видео'],
        'anthropic' => ['name'=>'Claude API',      'env'=>'ANTHROPIC_API_KEY', 'ready'=>$has($C['anthropic_key'] ?? ''),  'what'=>'только мост в Claude Code — сборки мини-аппов; чаты приложения его не используют'],
        'telegram'  => ['name'=>'Telegram-бот',    'env'=>'TELEGRAM_BOT_TOKEN','ready'=>$has($C['tg_bot_token'] ?? ''),   'what'=>'вход, уведомления, приглашения'],
        'lava'      => ['name'=>'Lava.top',        'env'=>'LAVA_API_KEY',      'ready'=>$has($C['lava_api_key'] ?? ''),   'what'=>'оплата тарифов и пополнение счёта'],
        'mail'      => ['name'=>'Почта',           'env'=>'GMAIL_APP_PASS',    'ready'=>$has($C['gmail_pass'] ?? ''),     'what'=>'письма, коды подтверждения, рассылки'],
        'push'      => ['name'=>'Web Push',        'env'=>'VAPID_PRIVATE',     'ready'=>$has($C['vapid_private'] ?? ''),  'what'=>'уведомления вне приложения'],
    ], 'checked_at'=>date('c')]);

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

// ═════════════════════════════════════════════════════════════════
// v6.2 — Админка и Штаб: единая точка данных, реал-тайм.
// admin_dashboard, admin_feed, admin_partners, admin_moderation,
// admin_finance, admin_action, partner_payout, moderate_anketa,
// agent_status, agent_update  → без mock, всё из SQLite.
// ═════════════════════════════════════════════════════════════════

// ── Единый JSON дашборда: MRR/ARR/DAU/ретеншн/донаты/топ-партнёры/тренды ──
case 'admin_dashboard':
    require_admin();
    partner_ensure_tables();
    $revSql="COALESCE(SUM(CAST(REPLACE(REPLACE(REPLACE(amount,' ',''),'₽',''),'руб','') AS REAL)),0)";
    // MRR (30 дней) / MRR_prev (30→60 дней назад) / ARR
    $mrr=(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)>=date('now','-30 day','localtime')");
    $mrrPrev=(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)>=date('now','-60 day','localtime') AND date(created_at)<date('now','-30 day','localtime')");
    $arr=$mrr*12;
    $revTotal=(float)db_val("SELECT $revSql FROM payments");
    $revToday=(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)=date('now','localtime')");
    $revWeek =(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)>=date('now','-7 day','localtime')");
    $mrrGrowth=$mrrPrev>0 ? round(($mrr-$mrrPrev)/$mrrPrev*100,1) : ($mrr>0?100:0);
    // DAU/MAU
    $dau=(int)db_val("SELECT COUNT(DISTINCT ip) FROM visits WHERE date(created_at)=date('now','localtime')");
    $mau=(int)db_val("SELECT COUNT(DISTINCT ip) FROM visits WHERE date(created_at)>=date('now','-30 day','localtime')");
    // регистрации
    $regToday=(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)=date('now','localtime')");
    $regWeek =(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)>=date('now','-7 day','localtime')");
    $regMonth=(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)>=date('now','-30 day','localtime')");
    $totalClients=(int)db_val("SELECT COUNT(*) FROM clients");
    $paidClients=(int)db_val("SELECT COUNT(*) FROM clients WHERE paid=1");
    // разбивка активных подписок по продуктам (donut)
    $byProd=db_all("SELECT COALESCE(NULLIF(paid_product,''),'sistema') p, COUNT(*) c FROM clients WHERE paid=1 GROUP BY p ORDER BY c DESC");
    // ретеншн 7d/30d: доля юзеров, которые регистрировались N дней назад
    // и заходили на сайт в последние 7/30 дней (сравниваем по IP клиента с visits).
    $retSql = function($daysAgo, $windowDays) {
        return "SELECT COUNT(DISTINCT c.id) FROM clients c
                WHERE date(c.created_at) BETWEEN date('now','-".($daysAgo*2)." day','localtime') AND date('now','-$daysAgo day','localtime')
                  AND EXISTS(SELECT 1 FROM visits v WHERE v.ip=c.ip AND date(v.created_at)>=date('now','-$windowDays day','localtime'))";
    };
    $ret7base=(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at) BETWEEN date('now','-14 day','localtime') AND date('now','-7 day','localtime') AND ip IS NOT NULL AND ip!=''");
    $ret7hit=(int)db_val("SELECT COUNT(DISTINCT c.id) FROM clients c WHERE date(c.created_at) BETWEEN date('now','-14 day','localtime') AND date('now','-7 day','localtime') AND ip IS NOT NULL AND ip!='' AND EXISTS(SELECT 1 FROM visits v WHERE v.ip=c.ip AND date(v.created_at)>=date('now','-7 day','localtime'))");
    $ret30base=(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at) BETWEEN date('now','-60 day','localtime') AND date('now','-30 day','localtime') AND ip IS NOT NULL AND ip!=''");
    $ret30hit=(int)db_val("SELECT COUNT(DISTINCT c.id) FROM clients c WHERE date(c.created_at) BETWEEN date('now','-60 day','localtime') AND date('now','-30 day','localtime') AND ip IS NOT NULL AND ip!='' AND EXISTS(SELECT 1 FROM visits v WHERE v.ip=c.ip AND date(v.created_at)>=date('now','-30 day','localtime'))");
    // топ-10 партнёров: сумма payouts (независимо от status)
    $partners=db_all("SELECT ref, COUNT(*) sales, COALESCE(SUM(amount),0) turnover, COALESCE(SUM(partner_amount),0) payout,
        SUM(CASE WHEN status='paid' THEN partner_amount ELSE 0 END) paid_out,
        SUM(CASE WHEN status='pending' THEN partner_amount ELSE 0 END) pending
        FROM partner_payouts WHERE ref!='' GROUP BY ref ORDER BY turnover DESC LIMIT 10");
    // ряд 30 дней (для больших чартов)
    $series=[];
    for($i=29;$i>=0;$i--){ $d=date('Y-m-d', strtotime("-$i day"));
        $series[]=['d'=>date('d.m',strtotime($d)),
            'leads'=>(int)db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)=?",[$d]),
            'revenue'=>(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)=?",[$d]),
            'visits'=>(int)db_val("SELECT COUNT(*) FROM visits WHERE date(created_at)=?",[$d]),
            'payments'=>(int)db_val("SELECT COUNT(*) FROM payments WHERE date(created_at)=?",[$d])];
    }
    out(['ok'=>true,'ts'=>time(),
        'mrr'=>round($mrr),'mrr_prev'=>round($mrrPrev),'mrr_growth'=>$mrrGrowth,'arr'=>round($arr),
        'rev_total'=>round($revTotal),'rev_today'=>round($revToday),'rev_week'=>round($revWeek),
        'dau'=>$dau,'mau'=>$mau,
        'reg_today'=>$regToday,'reg_week'=>$regWeek,'reg_month'=>$regMonth,
        'clients_total'=>$totalClients,'clients_paid'=>$paidClients,
        'conversion'=>$totalClients?round($paidClients*100/$totalClients,1):0,
        'by_product'=>$byProd,
        'retention_7d'=>$ret7base?round($ret7hit*100/$ret7base,1):0,'retention_7d_base'=>$ret7base,
        'retention_30d'=>$ret30base?round($ret30hit*100/$ret30base,1):0,'retention_30d_base'=>$ret30base,
        'partners'=>$partners,
        'series'=>$series]);

// ── Live newsfeed для админа+штаба: последние 20 событий с ISO-timestamps ──
case 'admin_feed':
    require_admin();
    partner_ensure_tables();
    $items=[];
    // новые лиды (клиенты)
    foreach(db_all("SELECT id,name,email,tg,niche,paid,paid_product,created_at FROM clients ORDER BY id DESC LIMIT 15") as $r){
        $items[]=['t'=>$r['created_at'],'kind'=>($r['paid']?'payment':'lead'),
            'title'=>$r['paid']?('оплата · '.($r['paid_product']?:'PRO')):('новый лид'.($r['niche']?' · '.$r['niche']:'')),
            'who'=>$r['name']?:'—','email'=>$r['email']?:'','tg'=>$r['tg']?:'','client_id'=>(int)$r['id']];
    }
    // оплаты
    foreach(db_all("SELECT id,client_id,name,email,product,amount,manual,created_at FROM payments ORDER BY id DESC LIMIT 15") as $r){
        $items[]=['t'=>$r['created_at'],'kind'=>'payment',
            'title'=>'оплата · '.($r['product']?:'—').' · '.($r['amount']?:'—').($r['manual']?' (вручную)':''),
            'who'=>$r['name']?:'—','email'=>$r['email']?:'','client_id'=>(int)$r['client_id']];
    }
    // сделки
    foreach(db_all("SELECT d.id,d.status,d.product,d.amount,d.created_at,c.name,c.email,c.id cid FROM deals d LEFT JOIN clients c ON c.id=d.client_id ORDER BY d.id DESC LIMIT 10") as $r){
        $items[]=['t'=>$r['created_at'],'kind'=>'deal',
            'title'=>'сделка '.($r['status']?:'').' · '.($r['product']?:'—'),
            'who'=>$r['name']?:'—','email'=>$r['email']?:'','client_id'=>(int)$r['cid']];
    }
    // партнёрские продажи
    foreach(db_all("SELECT id,ref,buyer_email,product,amount,partner_amount,status,created_at FROM partner_payouts ORDER BY id DESC LIMIT 10") as $r){
        $items[]=['t'=>$r['created_at'],'kind'=>'partner',
            'title'=>'партнёрская продажа · ref '.$r['ref'].' → '.round($r['partner_amount']).'₽',
            'who'=>$r['buyer_email']?:'—','email'=>$r['buyer_email']?:''];
    }
    // отклики агентов
    foreach(db_all("SELECT r.id,r.account,r.message,r.created_at,c.name FROM responses r LEFT JOIN clients c ON c.id=r.client_id ORDER BY r.id DESC LIMIT 5") as $r){
        $items[]=['t'=>$r['created_at'],'kind'=>'response',
            'title'=>'отклик агента '.($r['account']?:'—'),
            'who'=>$r['name']?:'—'];
    }
    // новые анкеты
    foreach(db_all("SELECT id,client_name,email,service_type,complete,created_at FROM anketa_submissions ORDER BY id DESC LIMIT 8") as $r){
        $items[]=['t'=>$r['created_at'],'kind'=>'anketa',
            'title'=>'анкета '.($r['service_type']?:'').($r['complete']?' · готова':' · частично'),
            'who'=>$r['client_name']?:'—','email'=>$r['email']?:''];
    }
    usort($items, function($a,$b){return strcmp($b['t'],$a['t']);});
    $items=array_slice($items,0,25);
    out(['ok'=>true,'ts'=>time(),'items'=>$items]);

// ── Партнёры сгруппированные + список выплат ──
case 'admin_partners':
    require_admin();
    partner_ensure_tables();
    $grouped=db_all("SELECT ref, COUNT(*) sales, COUNT(DISTINCT buyer_email) buyers,
        COALESCE(SUM(amount),0) turnover, COALESCE(SUM(partner_amount),0) payout_total,
        SUM(CASE WHEN status='paid' THEN partner_amount ELSE 0 END) paid_out,
        SUM(CASE WHEN status='pending' THEN partner_amount ELSE 0 END) pending,
        MIN(created_at) first_sale, MAX(created_at) last_sale
        FROM partner_payouts WHERE ref!='' GROUP BY ref ORDER BY turnover DESC");
    $payouts=db_all("SELECT id,ref,buyer_email,product,amount,partner_amount,status,invoice_id,created_at
        FROM partner_payouts ORDER BY id DESC LIMIT 100");
    $clicks=(int)db_val("SELECT COUNT(*) FROM partner_clicks");
    $clicksToday=(int)db_val("SELECT COUNT(*) FROM partner_clicks WHERE date(created_at)=date('now','localtime')");
    out(['ok'=>true,'partners'=>$grouped,'payouts'=>$payouts,
        'stats'=>['clicks_total'=>$clicks,'clicks_today'=>$clicksToday]]);

// ── Модерация: анкеты pending + комментарии (если появятся) ──
case 'admin_moderation':
    require_admin();
    // «pending»: анкеты complete=0 старше 1 дня (не дозаполнены) + непроверенные complete=1 без manual review
    $anketas=db_all("SELECT id,submission_id,client_name,email,tg,service_type,progress,total,complete,created_at
        FROM anketa_submissions
        WHERE (complete=1 AND (COALESCE((SELECT v FROM settings WHERE k='ank_reviewed_'||submission_id),'')=''))
           OR (complete=0 AND date(created_at)<=date('now','-1 day','localtime'))
        ORDER BY id DESC LIMIT 100");
    out(['ok'=>true,'anketas'=>$anketas,
        'stats'=>[
            'anketa_pending'=>(int)db_val("SELECT COUNT(*) FROM anketa_submissions WHERE complete=1 AND COALESCE((SELECT v FROM settings WHERE k='ank_reviewed_'||submission_id),'')=''"),
            'anketa_total'=>(int)db_val("SELECT COUNT(*) FROM anketa_submissions"),
        ]]);

// ── Финансы: выручка / расходы / прибыль + CSV бухгалтерии ──
case 'admin_finance':
    require_admin();
    partner_ensure_tables();
    $revSql="COALESCE(SUM(CAST(REPLACE(REPLACE(REPLACE(amount,' ',''),'₽',''),'руб','') AS REAL)),0)";
    $revTotal=(float)db_val("SELECT $revSql FROM payments");
    $revMonth=(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)>=date('now','start of month','localtime')");
    $revPrevMonth=(float)db_val("SELECT $revSql FROM payments WHERE date(created_at)>=date('now','start of month','-1 month','localtime') AND date(created_at)<date('now','start of month','localtime')");
    // расходы = выплаты партнёрам (status=paid) + условно 10% на инфру от MRR
    $partnerPaid=(float)db_val("SELECT COALESCE(SUM(partner_amount),0) FROM partner_payouts WHERE status='paid'");
    $partnerPending=(float)db_val("SELECT COALESCE(SUM(partner_amount),0) FROM partner_payouts WHERE status='pending'");
    // средний чек
    $avgCheck=(float)db_val("SELECT AVG(CAST(REPLACE(REPLACE(REPLACE(amount,' ',''),'₽',''),'руб','') AS REAL)) FROM payments WHERE amount!=''");
    // выручка по продуктам
    $revByProd=db_all("SELECT COALESCE(NULLIF(product,''),'—') product, COUNT(*) count, $revSql revenue
        FROM payments GROUP BY product ORDER BY revenue DESC");
    // помесячно 12 месяцев
    $monthly=[];
    for($i=11;$i>=0;$i--){
        $monthly[]=['m'=>date('Y-m',strtotime("-$i month")),
            'revenue'=>(float)db_val("SELECT $revSql FROM payments WHERE strftime('%Y-%m',created_at)=?",[date('Y-m',strtotime("-$i month"))]),
            'payments'=>(int)db_val("SELECT COUNT(*) FROM payments WHERE strftime('%Y-%m',created_at)=?",[date('Y-m',strtotime("-$i month"))])];
    }
    out(['ok'=>true,'ts'=>time(),
        'revenue_total'=>round($revTotal),'revenue_month'=>round($revMonth),'revenue_prev_month'=>round($revPrevMonth),
        'partner_paid'=>round($partnerPaid),'partner_pending'=>round($partnerPending),
        'profit_month'=>round($revMonth - $partnerPaid),
        'avg_check'=>round($avgCheck),
        'by_product'=>$revByProd,
        'monthly'=>$monthly]);

case 'admin_finance_export':
    require_admin();
    partner_ensure_tables();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=oko_finance.csv');
    echo "\xEF\xBB\xBF"; $f=fopen('php://output','w');
    fputcsv($f,['Дата','Клиент','Email','Продукт','Сумма','Способ','Ручная','Партнёр (ref)','Партнёру ₽','Инвойс'],';');
    $rows=db_all("SELECT p.created_at,p.name,p.email,p.product,p.amount,p.method,p.manual,
                         pp.ref,pp.partner_amount,pp.invoice_id
                  FROM payments p LEFT JOIN partner_payouts pp ON pp.buyer_email=p.email AND pp.product=p.product
                  ORDER BY p.id DESC");
    foreach($rows as $r) fputcsv($f,[$r['created_at'],$r['name'],$r['email'],$r['product'],$r['amount'],$r['method'],
        $r['manual']?'да':'',$r['ref']?:'',$r['partner_amount']?:'',$r['invoice_id']?:''],';');
    fclose($f); exit;

// ── Ручной ввод оплаты (когда Lava webhook не сработал) ──
// POST {email, name, amount, product, method?, tx_id?, comment?, ref?}
// → создаёт клиента (если нет), payments+deals, начисляет 15% партнёру если ref
case 'admin_manual_payment':
    require_admin();
    partner_ensure_tables();
    manual_payment_ensure_columns();
    $email=strtolower(trim((string)($body['email']??'')));
    $name=trim((string)($body['name']??''));
    $amount=(int)round((float)($body['amount']??0));
    $product=trim((string)($body['product']??'sistema'));
    $method=trim((string)($body['method']??'manual'));
    $txId=trim((string)($body['tx_id']??''));
    $comment=trim((string)($body['comment']??''));
    $ref=trim((string)($body['ref']??''));
    if(!$email) fail('Email обязателен');
    if(!$name) fail('Имя обязательно');
    if($amount<=0) fail('Сумма должна быть > 0');
    if(!filter_var($email,FILTER_VALIDATE_EMAIL)) fail('Некорректный email');
    // upsert клиента и пометить оплату
    $existing=db_one("SELECT id,name FROM clients WHERE lower(email)=?",[$email]);
    if($existing){
        $cid=(int)$existing['id'];
        db_exec("UPDATE clients SET name=COALESCE(NULLIF(name,''),?), paid=1, paid_product=?, paid_ts=?, status='deal' WHERE id=?",[$name,$product,now(),$cid]);
    } else {
        $cid=client_upsert(['name'=>$name,'email'=>$email,'products'=>[$product],'status'=>'deal','source'=>'manual']);
        db_exec("UPDATE clients SET paid=1, paid_product=?, paid_ts=? WHERE id=?",[$product,now(),$cid]);
    }
    // payment (+ tx_id, note лениво в extra колонках)
    $payId=db_insert("INSERT INTO payments (client_id,email,name,product,amount,method,manual,tx_id,note,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
        [$cid,$email,$name,$product,(string)$amount,$method,1,$txId,$comment,now()]);
    // deal (амаунт как INT для агрегатов)
    db_insert("INSERT INTO deals (client_id,product,amount,status,created_at,closed_at) VALUES (?,?,?,?,?,?)",
        [$cid,$product,$amount,'won',now(),now()]);
    // партнёрская выплата 15% (если ref задан)
    $partnerAmount=0;
    if($ref!==''){
        $pct=(float)($C['partner_percent']??15);
        $partnerAmount=round($amount*$pct/100,2);
        db_insert("INSERT INTO partner_payouts (ref,buyer_email,product,amount,partner_amount,status,invoice_id) VALUES (?,?,?,?,?,?,?)",
            [$ref,$email,$product,$amount,$partnerAmount,'pending',$txId?:'manual-'.$payId]);
    }
    // уведомление владельцу
    $prodName=$GLOBALS['PRODUCTS'][$product]['name'] ?? $product;
    $msg="<b>Оплата (ручной ввод)</b>\n\n"
        .htmlspecialchars($name)."\n"
        .htmlspecialchars($email)."\n"
        .htmlspecialchars($prodName).' · '.number_format($amount,0,'.',' ').'₽'
        ."\nМетод: ".htmlspecialchars($method)
        .($txId?"\nTX: ".htmlspecialchars($txId):'')
        .($comment?"\n\n".htmlspecialchars($comment):'')
        .($ref?"\n\nreferrer: <code>".htmlspecialchars($ref)."</code> → партнёру ".number_format($partnerAmount,0,'.',' ')."₽":'');
    tg_send($C['daniel_tg'],$msg,[],topic_thread('deals'));
    out(['ok'=>true,'payment_id'=>$payId,'client_id'=>$cid,'partner_amount'=>$partnerAmount,'amount'=>$amount]);

// ── Универсальное админ-действие (ban/unban/refund/bonus/mark_paid/message/set_status) ──
case 'admin_action':
    require_admin();
    $op=(string)($body['op']??'');
    $email=strtolower(trim((string)($body['email']??'')));
    $cid=(int)($body['client_id']??0);
    if($cid && !$email){ $c=db_one("SELECT email FROM clients WHERE id=?",[$cid]); if($c) $email=(string)$c['email']; }
    if(!$cid && $email){ $c=db_one("SELECT id FROM clients WHERE lower(email)=?",[$email]); if($c) $cid=(int)$c['id']; }

    if($op==='ban'){
        if(!$cid && !$email) fail('client_id or email required');
        db_exec("UPDATE clients SET status='banned', note=COALESCE(note,'')||' | забанен '||? WHERE ".($cid?"id=?":"lower(email)=?"),[now(),$cid?:$email]);
        tg_send($C['daniel_tg'],"🚫 <b>Забанен</b>\n$email");
        out(['ok'=>true,'op'=>'ban','email'=>$email,'client_id'=>$cid]);
    }
    if($op==='unban'){
        if(!$cid && !$email) fail('client_id or email required');
        db_exec("UPDATE clients SET status='active', note=COALESCE(note,'')||' | разбан '||? WHERE ".($cid?"id=?":"lower(email)=?"),[now(),$cid?:$email]);
        out(['ok'=>true,'op'=>'unban','email'=>$email]);
    }
    if($op==='refund'){
        if(!$email) fail('email required');
        db_exec("UPDATE clients SET paid=0,status='refund' WHERE lower(email)=?",[$email]);
        db_insert("INSERT INTO deals (client_id,product,amount,status,created_at,closed_at) VALUES (?,?,?,?,?,?)",
            [$cid,'refund',0,'refunded',now(),now()]);
        // Возврат в кошелёк, если сумма указана
        $amount=(int)round((float)($body['amount']??0));
        if($amount>0 && $email){
            wallet_ensure_account($email);
            db_exec("UPDATE wallet_accounts SET balance=balance+?, updated_at=? WHERE client_email=?",[$amount,now(),$email]);
            $tx='TX-REFUND-'.strtoupper(bin2hex(random_bytes(4)));
            db_insert("INSERT INTO wallet_ledger (from_email,to_email,amount,direction,comment,tx_id,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
                ['oko',$email,$amount,'topup','Возврат средств',$tx,'ok',now()]);
        }
        tg_send($C['daniel_tg'],"↩️ <b>Возврат</b>\n$email".($amount?"\n{$amount}₽ в кошелёк":''));
        out(['ok'=>true,'op'=>'refund','email'=>$email,'refunded'=>$amount]);
    }
    if($op==='mark_paid'){
        if(!$email) fail('email required');
        mark_paid($email,(string)($body['product']??'sistema'),(string)($body['amount']??''),true);
        out(['ok'=>true,'op'=>'mark_paid','email'=>$email]);
    }
    if($op==='bonus'){
        if(!$email) fail('email required');
        $amount=(int)round((float)($body['amount']??0));
        if($amount<=0) fail('amount > 0');
        wallet_ensure_account($email);
        db_exec("UPDATE wallet_accounts SET balance=balance+?, updated_at=? WHERE client_email=?",[$amount,now(),$email]);
        $tx='TX-BONUS-'.strtoupper(bin2hex(random_bytes(4)));
        db_insert("INSERT INTO wallet_ledger (from_email,to_email,amount,direction,comment,tx_id,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
            ['oko',$email,$amount,'topup','Бонус OKO',$tx,'ok',now()]);
        tg_send($C['daniel_tg'],"🎁 <b>Бонус</b>\n$email · {$amount}₽");
        out(['ok'=>true,'op'=>'bonus','email'=>$email,'amount'=>$amount]);
    }
    if($op==='message'){
        if(!$cid && !$email) fail('client target required');
        $text=trim((string)($body['text']??'')); if(!$text) fail('text required');
        db_insert("INSERT INTO dialogs (client_id,account,role,message,stage,created_at) VALUES (?,?,?,?,?,?)",
            [$cid,'admin','out',$text,'admin',now()]);
        // если у клиента есть tg_user_id — отправим
        $c=db_one("SELECT tg_user_id,tg FROM clients WHERE id=?",[$cid]);
        if($c && !empty($c['tg_user_id'])) tg_send((string)$c['tg_user_id'],htmlspecialchars($text));
        out(['ok'=>true,'op'=>'message','client_id'=>$cid]);
    }
    if($op==='set_status'){
        if(!$cid) fail('client_id required');
        db_exec("UPDATE clients SET status=? WHERE id=?",[(string)($body['status']??'new'),$cid]);
        out(['ok'=>true,'op'=>'set_status']);
    }
    if($op==='discount'){
        if(!$cid) fail('client_id required');
        $pct=(int)($body['pct']??10);
        db_exec("UPDATE clients SET note=COALESCE(note,'')||' | скидка '||?||'% выдана '||? WHERE id=?",[$pct,now(),$cid]);
        out(['ok'=>true,'op'=>'discount','pct'=>$pct]);
    }
    fail('unknown op');

// ── Выплата партнёру: помечает payout paid + топит на его кошелёк (если известен email по ref=email) ──
case 'partner_payout':
    require_admin();
    partner_ensure_tables();
    $pid=(int)($body['payout_id']??0);
    $ref=trim((string)($body['ref']??''));
    if(!$pid && !$ref) fail('payout_id or ref required');
    $rows=$pid ? db_all("SELECT * FROM partner_payouts WHERE id=?",[$pid])
               : db_all("SELECT * FROM partner_payouts WHERE ref=? AND status='pending'",[$ref]);
    if(!$rows) fail('no pending payouts',404);
    $total=0; $ids=[];
    foreach($rows as $r){
        db_exec("UPDATE partner_payouts SET status='paid' WHERE id=?",[$r['id']]);
        $total += (float)$r['partner_amount']; $ids[]=(int)$r['id'];
    }
    // если ref похож на email — зачислим в кошелёк
    $partnerEmail = filter_var($rows[0]['ref']??'', FILTER_VALIDATE_EMAIL) ? strtolower($rows[0]['ref']) : '';
    if(!$partnerEmail){
        // попробуем найти партнёра по tg/имени = ref
        $c=db_one("SELECT email FROM clients WHERE (lower(tg)=lower(?) OR lower(name)=lower(?)) AND email!='' LIMIT 1",[$rows[0]['ref'],$rows[0]['ref']]);
        if($c) $partnerEmail=$c['email'];
    }
    $walletTx=null;
    if($partnerEmail && $total>0){
        wallet_ensure_account($partnerEmail);
        $amt=(int)round($total);
        db_exec("UPDATE wallet_accounts SET balance=balance+?, updated_at=? WHERE client_email=?",[$amt,now(),$partnerEmail]);
        $walletTx='TX-PAYOUT-'.strtoupper(bin2hex(random_bytes(4)));
        db_insert("INSERT INTO wallet_ledger (from_email,to_email,amount,direction,comment,tx_id,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
            ['oko',$partnerEmail,$amt,'topup','Партнёрская выплата ref='.$rows[0]['ref'],$walletTx,'ok',now()]);
    }
    tg_send($C['daniel_tg'],"💸 <b>Выплата партнёру</b>\nref=".$rows[0]['ref']." · ".round($total)."₽".($partnerEmail?" → $partnerEmail":' (нет email)'));
    out(['ok'=>true,'paid_ids'=>$ids,'total'=>round($total),'partner_email'=>$partnerEmail,'wallet_tx'=>$walletTx]);

// ── Модерация анкет: approve/reject/discount ──
case 'moderate_anketa':
    require_admin();
    $sid=trim((string)($body['sid']??($body['submission_id']??'')));
    $act=(string)($body['action']??'');
    if(!$sid) fail('sid required');
    $a=db_one("SELECT * FROM anketa_submissions WHERE submission_id=?",[$sid]);
    if(!$a) fail('anketa not found',404);
    if(!in_array($act,['approve','reject','discount'])) fail('unknown action');
    // помечаем в settings, чтобы не всплывала в pending
    db_exec("INSERT OR REPLACE INTO settings (k,v,updated_at) VALUES ('ank_reviewed_'||?,?,?)",[$sid,$act,now()]);
    if($act==='approve'){
        // Апрув → клиент становится 'active' если существует
        if(!empty($a['client_id'])) db_exec("UPDATE clients SET status='approved' WHERE id=?",[$a['client_id']]);
        tg_send($C['daniel_tg'],"✅ <b>Анкета одобрена</b>\n".($a['client_name']?:'—')."\n".($a['email']?:''));
    } elseif($act==='reject'){
        $reason=trim((string)($body['reason']??''));
        db_exec("INSERT OR REPLACE INTO settings (k,v,updated_at) VALUES ('ank_reject_reason_'||?,?,?)",[$sid,$reason,now()]);
        tg_send($C['daniel_tg'],"❌ <b>Анкета отклонена</b>\n".($a['client_name']?:'—').($reason?"\nПричина: $reason":''));
    } elseif($act==='discount'){
        $pct=(int)($body['pct']??10);
        if(!empty($a['client_id'])) db_exec("UPDATE clients SET note=COALESCE(note,'')||' | скидка анкеты '||?||'%' WHERE id=?",[$pct,$a['client_id']]);
        tg_send($C['daniel_tg'],"🎟 <b>Скидка ".($pct)."%</b>\n".($a['client_name']?:'—')."\n".($a['email']?:''));
    }
    out(['ok'=>true,'action'=>$act,'sid'=>$sid]);

// ── Статусы sub-agents для 3D-штаба + админки ──
// Данные из таблицы agent_tasks: последнее состояние каждого agent_name.
// Роли (дефолт если пусто): sales/editor/designer/marketer/legal/copy/support/factory/analyst/hr — как в hq.html.
case 'agent_status':
    agent_ensure_table();
    $rows=db_all("SELECT agent_name, task, status, progress, updated_at, created_at
                  FROM (SELECT * FROM agent_tasks ORDER BY id DESC)
                  GROUP BY agent_name");
    // если пусто — вернём базовый набор ролей, чтобы UI не был пустым
    if(!$rows){
        $defaults=[
          ['agent_name'=>'ceo','task'=>'обход штаба · раздача задач','status'=>'work','progress'=>72],
          ['agent_name'=>'sales','task'=>'ждём лидов','status'=>'idle','progress'=>0],
          ['agent_name'=>'editor','task'=>'ждём сценарии','status'=>'idle','progress'=>0],
          ['agent_name'=>'designer','task'=>'ждём макеты','status'=>'idle','progress'=>0],
          ['agent_name'=>'marketer','task'=>'воронка тарифов','status'=>'work','progress'=>30],
          ['agent_name'=>'legal','task'=>'проверка договоров','status'=>'wait','progress'=>50],
          ['agent_name'=>'copy','task'=>'база хуков','status'=>'idle','progress'=>0],
          ['agent_name'=>'support','task'=>'мониторинг тикетов','status'=>'work','progress'=>80],
          ['agent_name'=>'factory','task'=>'очередь роликов','status'=>'work','progress'=>40],
          ['agent_name'=>'analyst','task'=>'дневная сводка','status'=>'wait','progress'=>10],
          ['agent_name'=>'hr','task'=>'поиск партнёров','status'=>'idle','progress'=>0],
          ['agent_name'=>'assist','task'=>'приём вопросов','status'=>'idle','progress'=>0],
        ];
        foreach($defaults as $d){
            db_insert("INSERT INTO agent_tasks (agent_name,task,status,progress,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                [$d['agent_name'],$d['task'],$d['status'],$d['progress'],now(),now()]);
        }
        $rows=db_all("SELECT agent_name, task, status, progress, updated_at, created_at
                  FROM (SELECT * FROM agent_tasks ORDER BY id DESC)
                  GROUP BY agent_name");
    }
    // счётчики
    $counts=['idle'=>0,'work'=>0,'think'=>0,'wait'=>0,'busy'=>0];
    foreach($rows as &$r){ $s=$r['status']?:'idle'; if(!isset($counts[$s])) $counts[$s]=0; $counts[$s]++; }
    unset($r);
    out(['ok'=>true,'ts'=>time(),'agents'=>$rows,'counts'=>$counts]);

case 'agent_update':
    // Разрешим и админу, и агенту с токеном.
    if(!admin_ok() && !agent_ok()) fail('Unauthorized',403);
    agent_ensure_table();
    $name=trim((string)($body['agent']??($body['agent_name']??'')));
    if(!$name) fail('agent required');
    $task=(string)($body['task']??'');
    $st=(string)($body['status']??'idle');
    $prog=(int)($body['progress']??0);
    db_insert("INSERT INTO agent_tasks (agent_name,task,status,progress,created_at,updated_at) VALUES (?,?,?,?,?,?)",
        [$name,$task,$st,$prog,now(),now()]);
    // ограничим историю до 500 записей на агента
    db_exec("DELETE FROM agent_tasks WHERE agent_name=? AND id NOT IN (SELECT id FROM agent_tasks WHERE agent_name=? ORDER BY id DESC LIMIT 500)",[$name,$name]);
    out(['ok'=>true,'agent'=>$name,'status'=>$st,'task'=>$task]);

// ── История задач одного агента (для деталки в админке) ──
case 'agent_history':
    require_admin();
    $name=trim((string)($_GET['agent']??''));
    if(!$name) fail('agent required');
    agent_ensure_table();
    out(['ok'=>true,'items'=>db_all("SELECT id,task,status,progress,created_at,updated_at FROM agent_tasks WHERE agent_name=? ORDER BY id DESC LIMIT 100",[$name])]);

case 'health': out(['ok'=>true,'db'=>'sqlite','clients'=>(int)db_val("SELECT COUNT(*) FROM clients"),'v'=>6]);

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
    foreach(db_all("SELECT r.account,r.created_at,c.name FROM responses r LEFT JOIN clients c ON c.id=r.client_id ORDER BY r.id DESC LIMIT 10") as $r){
        $items[]=['t'=>$r['created_at'],'id'=>'support','msg'=>'отклик · '.($r['account']?:'—').' · '.$anon($r['name'])];
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
// Добавляем колонки tx_id и note в payments (если их ещё нет) — для ручного ввода оплат.
function manual_payment_ensure_columns(){
    static $ready = false; if($ready) return;
    $cols = db_all("PRAGMA table_info(payments)");
    $names = array_map(fn($r)=>$r['name'], $cols);
    if(!in_array('tx_id',$names)) @db_exec("ALTER TABLE payments ADD COLUMN tx_id TEXT");
    if(!in_array('note',$names))  @db_exec("ALTER TABLE payments ADD COLUMN note TEXT");
    $ready = true;
}
// Партнёрские таблицы (создаются лениво lava_webhook / pay_url — на пустой БД их может не быть).
function partner_ensure_tables(){
    static $ready = false; if($ready) return;
    db_exec("CREATE TABLE IF NOT EXISTS partner_clicks (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT, product TEXT, ip TEXT, ua TEXT, buyer_email TEXT, created_at TEXT DEFAULT (datetime('now','localtime')))");
    db_exec("CREATE TABLE IF NOT EXISTS partner_payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT, buyer_email TEXT, product TEXT, amount REAL, partner_amount REAL, status TEXT, invoice_id TEXT, created_at TEXT DEFAULT (datetime('now','localtime')))");
    $ready = true;
}
// Agent tasks: статусы sub-агентов OKO (Sonnet/Haiku/Opus/Fable/Claude Fable/…).
// Каждый пуш — новая строка; последняя запись по agent_name = текущее состояние.
function agent_ensure_table(){
    static $ready = false; if($ready) return;
    db_exec("CREATE TABLE IF NOT EXISTS agent_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        task TEXT,
        status TEXT DEFAULT 'idle',
        progress INTEGER DEFAULT 0,
        payload TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        updated_at TEXT)");
    db_exec("CREATE INDEX IF NOT EXISTS idx_agent_tasks_name ON agent_tasks(agent_name, id DESC)");
    $ready = true;
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
