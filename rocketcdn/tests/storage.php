<?php
require_once dirname(__DIR__) . '/storage.php';
function check($ok, $name) { if (!$ok) throw new RuntimeException('FAIL: ' . $name); echo "PASS: $name\n"; }
$dir = sys_get_temp_dir() . '/rocket-storage-' . bin2hex(random_bytes(5));
mkdir($dir, 0770, true);
$file = $dir . '/data.json';
try {
    check(rc_json_write($file, ['items' => [['name' => 'Тест']]]), 'initial commit');
    check(json_decode(file_get_contents($file), true)['items'][0]['name'] === 'Тест', 'Unicode round trip');
    check(rc_json_update($file, function ($d) { $d['count'] = 1; return $d; })['count'] === 1, 'update returns committed data');
    $good = file_get_contents($file);
    check(rc_json_write($file, ['bad' => INF]) === false && file_get_contents($file) === $good, 'encoding failure preserves original');
    check(rc_json_update($file, function ($d) { $d['bad'] = INF; return $d; }) === false && file_get_contents($file) === $good, 'failed update preserves original');
    try { rc_json_update($file, function ($d) { throw new RuntimeException('intentional'); }); } catch (RuntimeException $e) {}
    check(rc_json_write($file, ['count' => 2]), 'exception releases lock');
    file_put_contents($file, '{"broken":');
    $called = false;
    check(rc_json_update($file, function ($d) use (&$called) { $called = true; return []; }) === false, 'corrupt JSON rejected');
    check(!$called && file_get_contents($file) === '{"broken":', 'corrupt bytes preserved without invoking mutation');
    file_put_contents($file, '');
    check(rc_json_update($file, function ($d) { return []; }) === false, 'empty existing file rejected');
    check(rc_json_write($dir . '/missing/data.json', []) === false, 'missing storage directory rejected');
    check(rc_json_update($dir . '/new.json', function ($d) { $d['new'] = true; return $d; })['new'], 'new file created by update');
    check(count(glob($dir . '/.rc-json-*')) === 0, 'temporary files cleaned');
} finally { foreach (glob($dir . '/*') as $f) unlink($f); rmdir($dir); }
