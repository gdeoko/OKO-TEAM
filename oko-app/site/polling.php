<?php
// ╔══════════════════════════════════════════════╗
// ║  OKO TEAM — Telegram бот (webhook) v3         ║
// ║  Работает без крона: Telegram шлёт сюда POST. ║
// ║  Вебхук ставится один раз (Claude поставит).  ║
// ╚══════════════════════════════════════════════╝
require __DIR__ . '/db.php';
$C = cfg();
define('DANIEL', (int)$C['daniel_tg']);
define('SITE_URL', $C['site_url']);

function tg($m, $p = []) {
    $ch = curl_init('https://api.telegram.org/bot' . cfg()['tg_bot_token'] . '/' . $m);
    curl_setopt_array($ch, [CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>json_encode($p),
        CURLOPT_HTTPHEADER=>['Content-Type: application/json'], CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>10]);
    $r = curl_exec($ch); curl_close($ch); return json_decode($r, true);
}
function send($chat, $text, $inline = [], $menu = false) {
    $p = ['chat_id'=>$chat, 'text'=>$text, 'parse_mode'=>'HTML', 'disable_web_page_preview'=>true];
    if ($inline) $p['reply_markup'] = ['inline_keyboard'=>$inline];
    elseif ($menu) $p['reply_markup'] = ['keyboard'=>[[['text'=>'📊 Статистика'],['text'=>'👥 Лиды']],
        [['text'=>'💰 Оплаты'],['text'=>'🔎 Поиск']],[['text'=>'🤖 Агенты'],['text'=>'📥 База']],
        [['text'=>'📨 Рассылка'],['text'=>'🏭 Продукты']],[['text'=>'🖥 Админка']]], 'resize_keyboard'=>true, 'persistent'=>true];
    return tg('sendMessage', $p);
}
function edit($chat, $mid, $text, $inline = []) {
    $p=['chat_id'=>$chat,'message_id'=>$mid,'text'=>$text,'parse_mode'=>'HTML','disable_web_page_preview'=>true];
    if ($inline) $p['reply_markup']=['inline_keyboard'=>$inline];
    tg('editMessageText',$p);
}
// ── Мост к серверу агентов (VPS control /agent) ────────────────
function ctl($op) {
    $C=cfg(); $url=rtrim($C['control_url']??'','/').'/agent';
    if (!$url || $url==='/agent') return "Control-эндпоинт не настроен.";
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_POST=>true, CURLOPT_POSTFIELDS=>json_encode(['op'=>$op]),
        CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-Token: '.($C['control_token']??'')],
        CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>45]);
    $r=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    return ($code==200 && $r!==false) ? $r : "Нет связи с сервером агентов (код $code).";
}
function agents_kb() { return [
    [['text'=>'▶️ Старт откликов','callback_data'=>'agc_outreach_on'],['text'=>'⏹ Стоп откликов','callback_data'=>'agc_outreach_off']],
    [['text'=>'🟢 Старт агентов','callback_data'=>'agc_agents_start'],['text'=>'🔴 Стоп агентов','callback_data'=>'agc_agents_stop']],
    [['text'=>'🔄 Обновить','callback_data'=>'agc_status']],
]; }
function send_doc($chat, $filename, $content, $caption='') {
    $tmp=tempnam(sys_get_temp_dir(),'baza'); file_put_contents($tmp,$content);
    $ch=curl_init('https://api.telegram.org/bot'.cfg()['tg_bot_token'].'/sendDocument');
    curl_setopt_array($ch,[CURLOPT_POST=>true, CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>40,
        CURLOPT_POSTFIELDS=>['chat_id'=>$chat,'caption'=>$caption,
            'document'=>new CURLFile($tmp,'text/csv',$filename)]]);
    curl_exec($ch); curl_close($ch); @unlink($tmp);
}
function st_set($k,$v){ db_exec("INSERT OR REPLACE INTO settings (k,v,updated_at) VALUES (?,?,?)",["bot_$k",$v,now()]); }
function st_get($k){ $r=db_one("SELECT v FROM settings WHERE k=?",["bot_$k"]); return $r['v']??null; }
function st_clr($k){ db_exec("DELETE FROM settings WHERE k=?",["bot_$k"]); }
function site_api($action,$params=[],$postBody=null){
    $C=cfg(); $url=SITE_URL.'/api.php?action='.$action.'&key='.urlencode($C['admin_password']);
    foreach($params as $k=>$v) $url.='&'.$k.'='.urlencode($v);
    $ch=curl_init($url); $opt=[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>45];
    if($postBody!==null){$opt[CURLOPT_POST]=true;$opt[CURLOPT_POSTFIELDS]=json_encode(array_merge($postBody,['key'=>$C['admin_password']]));$opt[CURLOPT_HTTPHEADER]=['Content-Type: application/json'];}
    curl_setopt_array($ch,$opt); $r=curl_exec($ch); curl_close($ch); return json_decode($r,true)?:[];
}

// ── Webhook: один апдейт в теле запроса ────────────────────────
$u = json_decode(file_get_contents('php://input'), true);
if (!$u) { http_response_code(200); echo 'ok'; exit; }

if (!empty($u['callback_query'])) {
    $cb=$u['callback_query']; $chat=$cb['message']['chat']['id']; $mid=$cb['message']['message_id']; $data=$cb['data'];
    tg('answerCallbackQuery',['callback_query_id'=>$cb['id']]);
    if ($chat==DANIEL && strpos($data,'pay_')===0) {
        $c=db_one("SELECT email,name FROM clients WHERE id=?",[(int)substr($data,4)]);
        if ($c&&$c['email']) { @file_get_contents(SITE_URL.'/api.php?action=manualConfirm&email='.urlencode($c['email']).'&key='.urlencode(cfg()['admin_password']));
            edit($chat,$mid,"✅ Оплата подтверждена\n\n{$c['name']} · {$c['email']}"); }
    }
    elseif ($chat==DANIEL && strpos($data,'agc_')===0) {   // управление агентами
        $op=substr($data,4);
        if ($op!=='status') { $res=ctl($op); tg('answerCallbackQuery',['callback_query_id'=>$cb['id'],'text'=>$res]); }
        $st=ctl('status');
        edit($chat,$mid,"🤖 <b>Управление агентами</b>\n\n".htmlspecialchars($st),agents_kb());
    }
    elseif ($chat==DANIEL && strpos($data,'nlseg_')===0) {   // сегмент рассылки выбран
        $seg=substr($data,6); st_set('nl_seg',$seg); st_set('await','nl_subject');
        $lab=['all'=>'всем','paid'=>'оплатившим','unpaid'=>'не оплатившим'];
        edit($chat,$mid,"📨 Сегмент: <b>".($lab[$seg]??$seg)."</b>\n\nНапиши ТЕМУ письма:");
    }
    http_response_code(200); echo 'ok'; exit;
}

$m = $u['message'] ?? null;
if (!$m) { http_response_code(200); echo 'ok'; exit; }
$chat = $m['chat']['id']; $text = trim($m['text'] ?? '');
if ($chat != DANIEL) { send($chat, "Это служебный бот OKO TEAM."); http_response_code(200); echo 'ok'; exit; }

// ── Состояния ──
if (st_get('await')==='search') { st_clr('await'); $q="%$text%";
    $found=db_all("SELECT * FROM clients WHERE name LIKE ? OR email LIKE ? OR tg LIKE ? OR phone LIKE ? LIMIT 5",[$q,$q,$q,$q]);
    if(!$found){ send($chat,"Не найдено: $text"); }
    else foreach($found as $s){ $btns=[]; if($s['tg'])$btns[]=['text'=>'Написать','url'=>"https://t.me/{$s['tg']}"]; if(!$s['paid'])$btns[]=['text'=>'✅ Оплата','callback_data'=>'pay_'.$s['id']];
        send($chat,"<b>{$s['name']}</b>\nEmail: {$s['email']}\nТел: {$s['phone']}".($s['tg']?"\nTG: @{$s['tg']}":'')."\nНиша: {$s['niche']}\nСтатус: ".($s['paid']?'ОПЛАТИЛ':$s['status']),[$btns]); }
    http_response_code(200); echo 'ok'; exit;
}
if (st_get('await')==='nl_subject') { st_set('nl_subj',$text); st_set('await','nl_content');
    send($chat,"Тема: <b>".htmlspecialchars($text)."</b>\n\nТеперь напиши ТЕКСТ письма (можно {{name}} для имени):");
    http_response_code(200); echo 'ok'; exit;
}
if (st_get('await')==='nl_content') {
    $subj=st_get('nl_subj'); $seg=st_get('nl_seg')?:'all'; st_clr('await'); st_clr('nl_subj'); st_clr('nl_seg');
    send($chat,"Запускаю рассылку…\n\nТема: $subj\nСегмент: $seg");
    $res=site_api('sendNewsletter',[],['segment'=>$seg,'subject'=>$subj,'content'=>$text]);
    send($chat,($res['ok']??false)?"✅ Рассылка завершена\n\nОтправлено: ".($res['sent']??0)."\nОшибок: ".($res['failed']??0):"Ошибка рассылки: ".($res['error']??'нет связи'));
    http_response_code(200); echo 'ok'; exit;
}

if ($text==='/start'||$text==='/menu') { send($chat,"OKO TEAM\n\nДобро пожаловать, Даниэль!",[],true); }
elseif ($text==='📊 Статистика') {
    $t=db_val("SELECT COUNT(*) FROM clients"); $p=db_val("SELECT COUNT(*) FROM clients WHERE paid=1");
    $today=db_val("SELECT COUNT(*) FROM clients WHERE date(created_at)=date('now','localtime')");
    $ank=db_val("SELECT COUNT(*) FROM anketa_submissions WHERE complete=1");
    send($chat,"📊 <b>Статистика</b>\n\nКлиентов: $t\nОплатили: $p\nСегодня: $today\nАнкет: $ank");
}
elseif ($text==='👥 Лиды') { $r=db_all("SELECT name,niche,status,paid FROM clients ORDER BY id DESC LIMIT 10");
    send($chat,"👥 <b>Лиды</b>\n\n".(implode("\n",array_map(fn($s)=>"· {$s['name']} · {$s['niche']} · ".($s['paid']?'оплатил':$s['status']),$r))?:'пусто')); }
elseif ($text==='💰 Оплаты') { $r=db_all("SELECT name,product,amount FROM payments ORDER BY id DESC LIMIT 10");
    send($chat,"💰 <b>Оплаты</b>\n\n".(implode("\n",array_map(fn($p)=>"· {$p['name']} · {$p['product']} ".($p['amount']?"· {$p['amount']}":''),$r))?:'пока нет')); }
elseif ($text==='🔎 Поиск') { st_set('await','search'); send($chat,"Введите имя / email / телефон / @username:"); }
elseif ($text==='🤖 Агенты'||$text==='/agents') {
    $st=ctl('status'); send($chat,"🤖 <b>Управление агентами</b>\n\n".htmlspecialchars($st),agents_kb());
}
elseif ($text==='📥 База'||$text==='/baza') {
    $csv=ctl('baza');
    if (strpos($csv,'ERR')===0||strpos($csv,'Нет связи')===0) { send($chat,"Не удалось получить базу: $csv"); }
    else { $cnt=max(0,substr_count($csv,"\n")-1); send_doc($chat,'oko_baza_'.date('Y-m-d').'.csv',$csv,"📥 База лидов: $cnt контактов"); }
}
elseif ($text==='📨 Рассылка'||$text==='/newsletter') {
    $tot=db_val("SELECT COUNT(*) FROM subscribers"); $paid=db_val("SELECT COUNT(*) FROM subscribers WHERE paid=1");
    send($chat,"📨 <b>Рассылка</b>\n\nПодписчиков: $tot · Оплатили: $paid\n\nВыбери сегмент:",[
        [['text'=>"Всем ($tot)",'callback_data'=>'nlseg_all']],
        [['text'=>"Оплатившим ($paid)",'callback_data'=>'nlseg_paid'],['text'=>"Не оплатившим",'callback_data'=>'nlseg_unpaid']],
    ]);
}
elseif ($text==='🏭 Продукты'||$text==='/products') {
    $r=site_api('getProducts');
    if(!($r['ok']??false)){ send($chat,"Не удалось получить продукты."); }
    else { $l="🏭 <b>Продукты</b>\n\n"; foreach(($r['products']??[]) as $p){ $conv=$p['leads']?round($p['paid']/$p['leads']*100):0; $l.="{$p['emoji']} <b>{$p['name']}</b> · лидов {$p['leads']} · оплат {$p['paid']} · {$conv}%\n"; } send($chat,$l); }
}
elseif ($text==='🖥 Админка') { send($chat,"Панель: ".SITE_URL."/admin"); }
else { send($chat,"Используйте кнопки меню.\n/menu — меню",[],true); }

http_response_code(200); echo 'ok';
