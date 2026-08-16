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

// 2) letters/obrashchenie-*.pdf: снести PDF, где письмо уже ушло.
// Сутки, а не трое: один бланк весит больше полумегабайта, а в день их теперь
// уходит несколько тысяч. Проверке подлинности PDF не нужен — страница письма
// собирается из базы, и QR ведёт именно на неё.
$cnt = 0; $bytes = 0;
$rows = db()->query("SELECT DISTINCT o.file FROM official_letters o
    JOIN mail_queue m ON m.id=o.queue_id
    WHERE m.status='sent' AND m.sent_at < datetime('now','localtime','-1 day')
      AND o.file LIKE '%obrashchenie-%.pdf'")->fetchAll(PDO::FETCH_COLUMN);
foreach ($rows as $f) {
    if (!$f || !is_file($f)) continue;
    $bytes += @filesize($f); @unlink($f); $cnt++;
}
$logit("letters: pruned=$cnt files, freed=".round($bytes/1024/1024,1)."MB");

// 2б) БЕСХОЗНЫЕ БЛАНКИ. Письмо могли снять с очереди (адрес попал в стоп-лист,
// учреждение удалили, волна отменилась), а полумегабайтный PDF остался лежать
// навсегда. Такие файлы никому не принадлежат и место занимают зря.
// «Занят» определяем ТОЛЬКО по вложениям писем, которые ещё ждут отправки.
// Реестр обращений для этого не годится: у неотправленного письма поле file
// пустое, и по нему все живые бланки выглядели бы бесхозными.
$busy = [];
foreach (db()->query("SELECT attach FROM mail_queue
                       WHERE status IN ('queued','paused') AND COALESCE(attach,'')<>''")
             ->fetchAll(PDO::FETCH_COLUMN) as $a) {
    $list = json_decode((string) $a, true);
    if (!is_array($list)) $list = [(string) $a];
    foreach ($list as $f) $busy[basename((string) $f)] = true;
}
$cnt = 0; $bytes = 0;
foreach (glob(BASE_PATH.'/data/letters/obrashchenie-*.pdf') as $f) {
    $b = basename($f);
    if (isset($busy[$b])) continue;
    // Совсем свежие не трогаем: письмо могли поставить в очередь секунду назад.
    if (time() - (int) @filemtime($f) < 3600) continue;
    $bytes += (int) @filesize($f); @unlink($f); $cnt++;
}
$logit("letters orphan: pruned=$cnt files, freed=".round($bytes/1024/1024,1)."MB");

// 3) daily backups старше 10 дней (кроме weekly и before_cleanup)
$cnt = 0; $bytes = 0;
foreach (glob(BASE_PATH.'/data/backups/muzmir_2026-*.sqlite') as $f) {
    if (str_contains($f, 'weekly') || str_contains($f, 'before_')) continue;
    if (time() - filemtime($f) < 10*86400) continue;
    $bytes += filesize($f); @unlink($f); $cnt++;
}
$logit("backups: pruned=$cnt files, freed=".round($bytes/1024/1024,1)."MB");

echo "OK\n";
