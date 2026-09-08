<?php
require __DIR__ . '/../storage.php';
if (($argv[1] ?? '') === 'child') {
    for ($i=0;$i<60;$i++) if (rc_json_update($argv[2], function ($d) { $d['count']++; return $d; }) === false) exit(2);
    exit(0);
}
$dir=sys_get_temp_dir().'/rocket-concurrent-'.bin2hex(random_bytes(5));mkdir($dir);$file=$dir.'/data.json';
try {
    rc_json_write($file,['count'=>0]);$children=[];
    for ($i=0;$i<4;$i++) {
        $pipes=[];$proc=proc_open([PHP_BINARY,__FILE__,'child',$file],[0=>['pipe','r'],1=>['file',$dir.'/child-'.$i.'.log','a'],2=>['file',$dir.'/child-'.$i.'.log','a']],$pipes);
        if (!is_resource($proc)) throw new RuntimeException('Cannot start concurrent writer');
        fclose($pipes[0]);$children[]=$proc;
    }
    foreach ($children as $proc) if (proc_close($proc)!==0) throw new RuntimeException('Concurrent writer failed');
    $data=json_decode(file_get_contents($file),true);
    if (($data['count']??0)!==240) throw new RuntimeException('Lost concurrent update');
    echo "PASS: native concurrent writers preserve all 240 updates\n";
} finally { foreach(glob($dir.'/*') as $p)unlink($p);rmdir($dir); }
