<?php
$tmp = sys_get_temp_dir() . '/rocket-backup-' . bin2hex(random_bytes(6));
mkdir($tmp, 0700); define('RC_DATA', $tmp);
require __DIR__ . '/../storage.php'; require __DIR__ . '/../backup.php';
function check_backup($ok, $message) { if (!$ok) throw new RuntimeException($message); echo "PASS: $message\n"; }
try {
    rc_json_write($tmp . '/leads.json', ['items'=>[['id'=>'before']]]);
    file_put_contents($tmp . '/tg_offset.txt', '1');
    $child = pcntl_fork();
    if ($child === 0) {
        $lock = fopen($tmp . '/bot.lock', 'c'); flock($lock, LOCK_EX);
        rc_json_write($tmp . '/leads.json', ['items'=>[['id'=>'after']]]);
        file_put_contents($tmp . '/ready', '1');
        usleep(200000); file_put_contents($tmp . '/tg_offset.txt', '2');
        flock($lock, LOCK_UN); fclose($lock); exit;
    }
    $deadline=microtime(true)+3;
    while (!is_file($tmp.'/ready') && microtime(true)<$deadline) usleep(1000);
    check_backup(rc_backup_snapshot($tmp.'/snapshot.json'), 'backup publishes complete checkpoint');
    pcntl_waitpid($child,$status);
    $s=json_decode(file_get_contents($tmp.'/snapshot.json'),true);
    check_backup($s['telegram_offset']===2 && $s['leads']['items'][0]['id']==='after', 'backup cannot split bot record and offset');
    $old=file_get_contents($tmp.'/snapshot.json');file_put_contents($tmp.'/leads.json','{');
    check_backup(!rc_backup_snapshot($tmp.'/snapshot.json') && file_get_contents($tmp.'/snapshot.json')===$old, 'corrupt source preserves previous backup');
} finally { foreach (glob($tmp.'/*') as $f) unlink($f); rmdir($tmp); }
