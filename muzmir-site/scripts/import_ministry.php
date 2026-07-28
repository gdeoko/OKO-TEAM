<?php
/** Импорт писем поддержки министерств в ministry_letters из data/ministry_letters_import.json.
 *  Идемпотентно: очищает таблицу и заливает заново. CLI: php scripts/import_ministry.php */
declare(strict_types=1);
$root = dirname(__DIR__);
$json = $root . '/data/ministry_letters_import.json';
$db = $root . '/data/muzmir.sqlite';
if (!is_file($json)) { fwrite(STDERR, "no manifest\n"); exit(1); }
$items = json_decode(file_get_contents($json), true);
if (!is_array($items)) { fwrite(STDERR, "bad manifest\n"); exit(1); }
// region letters first (sorted by region, RU), then no-region answers
usort($items, function($a,$b){
    $ra=$a['region']??''; $rb=$b['region']??'';
    if (($ra==='')!==($rb==='')) return $ra===''?1:-1; // empty regions last
    $c = strcoll($ra,$rb); if ($c!==0) return $c;
    return strcmp($a['image']??'',$b['image']??'');
});
$pdo = new PDO('sqlite:'.$db); $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$pdo->exec('BEGIN');
$pdo->exec('DELETE FROM ministry_letters');
$ins = $pdo->prepare('INSERT INTO ministry_letters (region, image_path, title, sort) VALUES (?,?,?,?)');
$i=0; foreach ($items as $it) {
    $ins->execute([(string)($it['region']??''), (string)($it['image']??''), (string)($it['title']??''), $i++]);
}
$pdo->exec('COMMIT');
$n = $pdo->query('SELECT COUNT(*) FROM ministry_letters')->fetchColumn();
$withScan = $pdo->query("SELECT COUNT(*) FROM ministry_letters WHERE image_path<>''")->fetchColumn();
$regions = $pdo->query("SELECT COUNT(DISTINCT region) FROM ministry_letters WHERE region<>''")->fetchColumn();
echo "imported=$n withScan=$withScan regions=$regions\n";
