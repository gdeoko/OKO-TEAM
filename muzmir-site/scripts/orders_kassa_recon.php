<?php
/**
 * СВЕРКА ВСЕХ ЗАКАЗОВ НАГРАД С КАССОЙ — ТОЛЬКО ЧТЕНИЕ, НИЧЕГО НЕ МЕНЯЕТ.
 *
 *   php scripts/orders_kassa_recon.php
 *
 * В обе стороны: каждый заказ → его платежи в кассе (успех, сумма, возвраты,
 * двойная оплата) и каждый успешный платёж кассы → заказ или заявка (платёж без
 * хозяина). Плюс исполнение: электронные к сроку (5 рабочих дней, клубу 3),
 * оригиналы — адрес, индекс, трек, отправка не позже 7 дней + 3 дня запаса.
 *
 * ДО 28.09.2026 10:06 платежи шли в магазин 1092130, его ключ удалён по решению
 * владельца (коммит «Оплата переведена на кассу Ильясова А. И.»). Такие платежи
 * касса по текущему ключу не находит (404), и они сверяются по нашей записи
 * уведомления кассы в payments — в отчёте помечены «[магазин до 28.09]».
 */
if (PHP_SAPI !== 'cli') exit(1);
define('BASE_PATH', dirname(__DIR__)); $GLOBALS['CFG']=require BASE_PATH.'/config.php';
require BASE_PATH.'/core/db.php'; require BASE_PATH.'/core/helpers.php';
require_once BASE_PATH.'/core/send_timing.php';
if (is_file(BASE_PATH.'/core/club.php')) require_once BASE_PATH.'/core/club.php';

$shop   = (string)(cfgv('yukassa_shop') ?: setting('yukassa_shop',''));
$secret = (string)(cfgv('yukassa_secret') ?: setting('yukassa_secret',''));
function yk(string $path) { global $shop,$secret;
    $ch = curl_init('https://api.yookassa.ru/v3/'.$path);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_USERPWD=>"$shop:$secret",CURLOPT_TIMEOUT=>30]);
    $r=curl_exec($ch); $c=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    return $c===200 ? json_decode((string)$r,true) : null; }
function yk_all(string $kind): array { $out=[]; $cur=''; $guard=0;
    do { $q = $kind.'?limit=100&created_at.gte=2026-06-01T00:00:00.000Z'.($cur!==''?'&cursor='.urlencode($cur):'');
         $d = yk($q); if (!$d) { fwrite(STDERR,"касса не ответила на $kind\n"); break; }
         foreach ($d['items']??[] as $it) $out[$it['id']]=$it; $cur=(string)($d['next_cursor']??''); }
    while ($cur!=='' && ++$guard<200);
    return $out; }

$KP = yk_all('payments'); $KR = yk_all('refunds');
$refByPay = []; foreach ($KR as $r) if (($r['status']??'')==='succeeded') $refByPay[$r['payment_id']] = ($refByPay[$r['payment_id']]??0) + (float)$r['amount']['value'];

$orders = all("SELECT * FROM awards_orders ORDER BY id");
$pays   = all("SELECT * FROM payments"); $payByOrder=[]; $linked=[]; $SWITCH=strtotime('2026-09-28 10:06:00'); $oldCnt=['orders'=>0,'sum'=>0];
foreach ($pays as $p) { if ((int)$p['order_id']>0) $payByOrder[(int)$p['order_id']][]=$p; if ($p['yukassa_id']) $linked[$p['yukassa_id']]=$p; }
$metaByOrder=[]; foreach ($KP as $id=>$k) { $oid=(int)($k['metadata']['order_id']??0); if ($oid>0) $metaByOrder[$oid][]=$id; }

$PAIDST=['paid','made','shipped','delivered'];
$R=['money'=>[], 'fulfil'=>[], 'note'=>[]]; $cnt=['digital'=>0,'original'=>0,'mixed'=>0,'club'=>0,'other'=>0];
$sum=['orders_paid'=>0,'kassa_ok'=>0,'refunded'=>0]; $ok=0; $usedK=[];
$now=time();

foreach ($orders as $o) {
    $oid=(int)$o['id']; $st=(string)$o['status']; $amt=(int)$o['amount'];
    $items=json_decode((string)$o['items'],true) ?: [];
    $kinds=array_unique(array_map(fn($i)=>(string)($i['kind']??''),$items));
    $club=in_array('club',$kinds,true); $dig=in_array('digital',$kinds,true); $ori=in_array('original',$kinds,true);
    $type = $club?'club':($dig&&$ori?'mixed':($dig?'digital':($ori?'original':'other'))); $cnt[$type]++;
    $who = trim((string)$o['full_name']).' <'.$o['email'].'>';
    $label = "#$oid ".($type==='digital'?'электр.':($type==='original'?'оригинал':($type==='mixed'?'электр.+оригинал':($type==='club'?'клуб':'прочее'))))." $amt ₽, $who";

    $ids=[]; foreach ($payByOrder[$oid]??[] as $p) $ids[]=$p['yukassa_id']; if ($o['payment_id']) $ids[]=$o['payment_id'];
    foreach ($metaByOrder[$oid]??[] as $i) $ids[]=$i; $ids=array_values(array_unique(array_filter($ids)));
    $succ=[]; $known=0; $old=false;
    foreach ($ids as $i) { $k=$KP[$i]??null; if (!$k) { $k=yk('payments/'.rawurlencode($i)); if ($k) $KP[$i]=$k; }
        if (!$k) { // нет в новом магазине: платёж прежнего магазина 1092130 — сверяем по своей записи уведомления
            $lp=$linked[$i]??null; $lt=$lp?strtotime((string)$lp['created_at']):strtotime((string)$o['created_at']);
            if ($lt && $lt < $SWITCH) { $old=true; $known++; if ($lp && in_array((string)$lp['status'],['succeeded','refunded'],true)) $succ[$i]=['amount'=>['value'=>(float)$lp['amount']],'status'=>'succeeded','old'=>1,'created_at'=>$lp['created_at'],'local_status'=>$lp['status']]; }
            continue; }
        $known++; $usedK[$i]=true; if (($k['status']??'')==='succeeded') $succ[$i]=$k; }
    if ($old) { $oldCnt['orders']++; if (in_array($st,$PAIDST,true)) $oldCnt['sum']+=$amt; }
    $label .= $old ? ' [магазин до 28.09]' : '';
    $kSum=0; $kRef=0; foreach ($succ as $i=>$k) { $kSum+=(float)$k['amount']['value']; $kRef+=(float)($refByPay[$i]??0); if (!empty($k['old']) && ($k['local_status']??'')==='refunded') $kRef+=(float)$k['amount']['value']; }
    $sum['kassa_ok']+=$kSum; $sum['refunded']+=$kRef;
    $paid=in_array($st,$PAIDST,true); if ($paid) $sum['orders_paid']+=$amt;
    $problem=false;

    if ($paid && $amt>0 && !$succ) { $R['money'][]="$label — числится «{$st}», а успешного платежа в кассе НЕТ".($ids?' (попыток: '.count($ids).', найдено в кассе: '.$known.')':' (платёж не привязан)'); $problem=true; }
    if (!$paid && $succ) {
        $net=$kSum-$kRef;
        if ($st==='canceled' && $net<=0.5) $R['note'][]="$label — отменён, деньги возвращены полностью ({$kRef} ₽)";
        else { $R['money'][]="$label — статус «{$st}», а в кассе оплачено {$kSum} ₽".($kRef?", возвращено {$kRef} ₽":'')." — деньги взяты, заказ не в работе"; $problem=true; }
    }
    if (count($succ)>1) { $R['money'][]="$label — В КАССЕ ".count($succ)." УСПЕШНЫХ ПЛАТЕЖА на ".$kSum." ₽ (".implode(', ',array_keys($succ)).")".($kRef?", возвращено {$kRef} ₽":''); $problem=true; }
    if ($paid && count($succ)===1 && abs($kSum-$amt)>0.5) { $R['money'][]="$label — сумма в кассе {$kSum} ₽ не равна сумме заказа"; $problem=true; }
    if ($paid && $kRef>0) $R['note'][]="$label — возврат {$kRef} ₽ при выданных документах («{$st}»)".($kRef>=$amt?' (полный)':' (частичный)');
    // Частичный возврат записан строкой «id:сумма» в payments.refunds (касса прежнего магазина недоступна).
    foreach ($payByOrder[$oid]??[] as $p) if (!empty($succ[$p['yukassa_id']]['old']) && (string)$p['status']!=='refunded')
        foreach (array_filter(explode(',', (string)$p['refunds'])) as $rr) $kRef += (float) (explode(':', $rr)[1] ?? 0);
    if ((float)($o['refund_amount']??0)>0 && abs((float)$o['refund_amount']-$kRef)>0.5) { $R['money'][]="$label — в заказе записан возврат {$o['refund_amount']} ₽, а в кассе {$kRef} ₽"; $problem=true; }

    // Исполнение (только оплаченные).
    if ($paid && !$club) {
        $pt = null; foreach ($succ as $k) { $t=strtotime((string)($k['captured_at']??$k['created_at'])); if ($t) $pt = $pt? min($pt,$t):$t; }
        $pt = $pt ?: strtotime((string)$o['created_at']);
        $isClub = function_exists('club_status') && (int)$o['user_id']>0 ? !empty(club_status((int)$o['user_id'])['active']) : false;
        if ($dig) {
            $dl = working_days_add(date('Y-m-d H:i:s',$pt), $isClub?3:5)->getTimestamp();
            // У смешанного заказа дата отправки электронных стоит у дипломов, а не у заказа.
            $sent = trim((string)($o['sent_at']??''))!=='' || ($type==='digital' && $st==='delivered')
                 || (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND kind IN ('digital','both') AND COALESCE(sent_at,'')<>''", [(int)$o['application_id']]) > 0;
            if (!$sent && $now > $dl) { $R['fulfil'][]="$label — электронные не отправлены, срок был ".date('d.m',$dl); $problem=true; }
            elseif (!$sent) $R['note'][]="$label — электронные ещё в работе, срок ".date('d.m',$dl);
        }
        if ($ori) {
            if (trim((string)$o['address'])==='' && empty($o['pickup'])) { $R['fulfil'][]="$label — оригиналы оплачены, НЕТ АДРЕСА"; $problem=true; }
            elseif (trim((string)$o['postal_index'])==='' && empty($o['pickup'])) { $R['fulfil'][]="$label — нет почтового индекса"; $problem=true; }
            $madeDl = $pt + 7*86400;
            $shippedLike = in_array($st,['shipped','delivered'],true) || trim((string)$o['dispatched_at'])!=='' || trim((string)$o['shipped_at'])!=='';
            if (in_array($st,['shipped','delivered'],true) && trim((string)$o['tracking'])==='' && empty($o['pickup'])) { $R['fulfil'][]="$label — «{$st}», но нет трек-номера"; $problem=true; }
            if (!$shippedLike && $now > $madeDl + 3*86400 && trim((string)$o['hold_reason'])==='') { $R['fulfil'][]="$label — оригиналы не отправлены, оплачен ".date('d.m',$pt).' ('.(int)(($now-$pt)/86400).' дн.)'.($st==='made'?', изготовлены '.substr((string)$o['made_at'],0,10):''); $problem=true; }
            if (trim((string)$o['hold_reason'])!=='') $R['note'][]="$label — отправка на удержании: ".$o['hold_reason'];
        }
    }
    if ($club && $paid && function_exists('club_status') && (int)$o['user_id']>0 && empty(club_status((int)$o['user_id'])['active'])) {
        $R['note'][]="$label — клубный взнос оплачен, членство сейчас не активно (возможно, истёк срок)"; }
    if (!$problem) $ok++;
}

// Обратная сторона: успешные платежи кассы, не привязанные ни к заказу, ни к заявке.
$orphan=[]; $kTot=['succeeded'=>0,'n'=>0]; $byPurpose=[];
foreach ($KP as $id=>$k) { if (($k['status']??'')!=='succeeded') continue; $kTot['succeeded']+=(float)$k['amount']['value']; $kTot['n']++;
    $p=$linked[$id]??null; $pur = $p ? (string)$p['purpose'] : (isset($k['metadata']['order_id'])?'awards(meta)':(isset($k['metadata']['application_ids'])||isset($k['metadata']['application_id'])?'application(meta)':'?'));
    $byPurpose[$pur]=($byPurpose[$pur]??0)+(float)$k['amount']['value'];
    if (!$p && empty($usedK[$id]) && !isset($k['metadata']['application_ids']) && !isset($k['metadata']['application_id']))
        $orphan[]=$id.' '.$k['amount']['value'].' ₽ '.substr((string)$k['created_at'],0,10).' «'.mb_substr((string)($k['description']??''),0,70).'» meta='.json_encode($k['metadata']??[],JSON_UNESCAPED_UNICODE);
}

echo "ЗАКАЗОВ ВСЕГО: ".count($orders)." | электр. {$cnt['digital']}, оригиналы {$cnt['original']}, смешанные {$cnt['mixed']}, клуб {$cnt['club']}, прочее {$cnt['other']}\n";
echo "Без замечаний: $ok\n"; echo "Заказов прежнего магазина (до 28.09, сверка по нашим записям уведомлений кассы): {$oldCnt['orders']}, в работе на {$oldCnt['sum']} ₽\n";
echo "Касса: платежей за период ".count($KP).", успешных {$kTot['n']} на ".round($kTot['succeeded'])." ₽; возвратов ".count($KR)." на ".round(array_sum(array_map(fn($r)=>($r['status']==='succeeded')?(float)$r['amount']['value']:0,$KR)))." ₽\n";
echo "Сумма оплаченных заказов в базе: {$sum['orders_paid']} ₽ | в кассе по этим заказам успешно: ".round($sum['kassa_ok'])." ₽, возвращено ".round($sum['refunded'])." ₽\n";
echo "Успешные платежи кассы по назначению: ".json_encode(array_map('round',$byPurpose),JSON_UNESCAPED_UNICODE)."\n\n";
foreach (['money'=>'ДЕНЬГИ / КАССА','fulfil'=>'ИСПОЛНЕНИЕ','note'=>'К СВЕДЕНИЮ'] as $k=>$t) { echo "== $t: ".count($R[$k])."\n"; foreach ($R[$k] as $x) echo "  • $x\n"; echo "\n"; }
echo "== ПЛАТЕЖИ КАССЫ БЕЗ ЗАКАЗА/ЗАЯВКИ: ".count($orphan)."\n"; foreach ($orphan as $x) echo "  • $x\n";
