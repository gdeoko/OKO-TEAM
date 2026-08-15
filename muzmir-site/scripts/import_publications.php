<?php
/** Импорт публикаций о центре в СМИ (из data/publications_import.json).
 *  Идемпотентно: очищает таблицу и заливает заново. CLI: php scripts/import_publications.php */
declare(strict_types=1);
$root = dirname(__DIR__);
$json = $root . '/data/publications_import.json';
$db   = (getenv('MUZMIR_DB_PATH') ?: $root . '/data/muzmir.sqlite');
if (!is_file($json)) { fwrite(STDERR, "no manifest\n"); exit(1); }
$items = json_decode(file_get_contents($json), true);
if (!is_array($items)) { fwrite(STDERR, "bad manifest\n"); exit(1); }
$d = new PDO('sqlite:' . $db);
$d->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$d->exec('CREATE TABLE IF NOT EXISTS publications (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, title TEXT NOT NULL, source TEXT, host TEXT, sort INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime(\'now\',\'localtime\')))');
$d->exec('BEGIN');
$d->exec('DELETE FROM publications');
$ins = $d->prepare('INSERT OR IGNORE INTO publications (url,title,source,host,sort) VALUES (?,?,?,?,?)');
$i = 0; foreach ($items as $p) { $ins->execute([$p['url'], $p['title'], $p['source'] ?? '', $p['host'] ?? '', $i++]); }
$d->exec('COMMIT');
echo "publications imported: " . $d->query('SELECT COUNT(*) FROM publications')->fetchColumn() . "\n";
