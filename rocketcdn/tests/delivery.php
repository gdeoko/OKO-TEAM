<?php
$dir = sys_get_temp_dir() . '/rocket-delivery-test-' . bin2hex(random_bytes(5));
mkdir($dir); define('RC_DATA', $dir); define('RC_LEADS', $dir . '/leads.json');
require __DIR__ . '/../storage.php'; require __DIR__ . '/../delivery.php';
function check_delivery($value, $label) { if (!$value) throw new RuntimeException($label); echo "PASS: $label\n"; }
try {
    $lead = ['id' => 'offline-1', 'contact' => 'test@example.invalid'];
    $lead['delivery'] = rc_delivery_jobs($lead);
    check_delivery(count($lead['delivery']) === 3, 'delivery channels created with lead');
    rc_json_write(RC_LEADS, ['items' => [$lead]]);
    $calls = [];
    $r = rc_delivery_run(8, function ($item, $channel) use (&$calls) { $calls[] = $channel; return $channel !== 'mail_team'; });
    check_delivery($r === ['sent' => 2, 'failed' => 1], 'worker records each channel separately');
    $saved = json_decode(file_get_contents(RC_LEADS), true);
    check_delivery($saved['items'][0]['delivery']['mail_team']['status'] === 'pending' && $saved['items'][0]['delivery']['mail_team']['next'] > time(), 'failed delivery uses delayed retry');
    $before = count($calls);
    rc_delivery_run(8, function () use (&$calls) { $calls[] = 'unexpected'; return true; });
    check_delivery(count($calls) === $before, 'successful channels and future retries are not resent');
    rc_json_update(RC_LEADS, function ($d) { $d['items'][0]['delivery']['mail_team'] = ['status'=>'sending','lease'=>time()-1,'attempts'=>2,'claim'=>'old']; return $d; });
    $r = rc_delivery_run(1, fn() => true);
    check_delivery($r['sent'] === 1, 'expired worker claim is recovered');
    if (!defined('ROCKET_TEST_WASM')) {
    $lock = fopen(RC_DATA . '/delivery-worker.lock', 'c'); flock($lock, LOCK_EX);
    $r = rc_delivery_run(1, function () { throw new RuntimeException('must not send'); });
    check_delivery(!empty($r['busy']), 'overlapping worker cannot send');
    flock($lock, LOCK_UN); fclose($lock);
    } else { echo "SKIP: interprocess flock requires native PHP (covered on server)\n"; }
    rc_json_update(RC_LEADS, function ($d) { $d['items'][0]['delivery']['mail_team'] = ['status'=>'pending','next'=>0,'attempts'=>7]; return $d; });
    rc_delivery_run(1, fn() => false);
    check_delivery(json_decode(file_get_contents(RC_LEADS), true)['items'][0]['delivery']['mail_team']['status'] === 'failed', 'retry limit requires operator action');
    file_put_contents(RC_LEADS, '{invalid');
    $called = false; $thrown = false;
    try { rc_delivery_run(1, function () use (&$called) { $called = true; return true; }); } catch (RuntimeException $e) { $thrown = true; }
    check_delivery($thrown && !$called, 'corrupt storage never sends notifications');
} finally { foreach (glob($dir . '/*') as $f) unlink($f); rmdir($dir); }
