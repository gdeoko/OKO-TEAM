<?php
/**
 * disk_cleanup.php — держит диск в чистоте, чтобы вложения массовых
 * писем не съели место в разгар кампании. Запуск: 4 раза в сутки.
 *
 * 1) attach_cache/inv_*: папки, для которых ВСЕ письма уже sent — удаляем.
 * 2) letters/obrashchenie-*.pdf: PDF для sent-писем старше 3 дней — удаляем.
 * 3) backups: daily старше 10 дней (weekly оставляем).
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
define('BASE_PATH','/var/www/muzmir');
$GLOBALS['CFG']=require BASE_PATH.'/config.php';
require_once BASE_PATH.'/core/db.php';

$log = BASE_PATH.'/data/logs/disk_cleanup.log';
$logit = fn($m) => @file_put_contents($log, date('Y-m-d H:i:s')." $m\n", FILE_APPEND);

// 1) attach_cache — снести inv_ папки, все письма которых уже отправлены
$freed = 0; $kept = 0;
foreach (glob(BASE_PATH.'/data/attach_cache/inv_*', GLOB_ONLYDIR) as $dir) {
    // Есть ли хоть одно queued-письмо, чей attach ссылается на этот dir?
    $like = '%'.basename($dir).'%';
    $r = db()->prepare("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND attach LIKE ?");
    $r->execute([$like]);
    if ((int)$r->fetchColumn() > 0) { $kept++; continue; }
    // Ничего не queued → можно сносить
    $sz = 0;
    foreach (glob($dir.'/*') as $f) { $sz += @filesize($f); @unlink($f); }
    @rmdir($dir);
    $freed += $sz;
}
$logit("attach_cache: freed=".round($freed/1024/1024,1)."MB kept_dirs=$kept");

// 2) letters/obrashchenie-*.pdf: снести PDF, где письмо давно ушло
$cnt = 0; $bytes = 0;
$rows = db()->query("SELECT DISTINCT o.file FROM official_letters o
    JOIN mail_queue m ON m.id=o.queue_id
    WHERE m.status='sent' AND m.sent_at < datetime('now','-3 days')
      AND o.file LIKE '%obrashchenie-%.pdf'")->fetchAll(PDO::FETCH_COLUMN);
foreach ($rows as $f) {
    if (!$f || !is_file($f)) continue;
    $bytes += @filesize($f); @unlink($f); $cnt++;
}
$logit("letters: pruned=$cnt files, freed=".round($bytes/1024/1024,1)."MB");

// 3) daily backups старше 10 дней (кроме weekly и before_cleanup)
$cnt = 0; $bytes = 0;
foreach (glob(BASE_PATH.'/data/backups/muzmir_2026-*.sqlite') as $f) {
    if (str_contains($f, 'weekly') || str_contains($f, 'before_')) continue;
    if (time() - filemtime($f) < 10*86400) continue;
    $bytes += filesize($f); @unlink($f); $cnt++;
}
$logit("backups: pruned=$cnt files, freed=".round($bytes/1024/1024,1)."MB");

echo "OK\n";
