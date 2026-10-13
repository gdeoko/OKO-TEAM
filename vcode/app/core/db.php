<?php
/** V.LIONOFF · база. SQLite через PDO, схема накатывается сама при первом вызове. */

function vc_cfg(): array {
  static $c = null;
  if ($c === null) { $c = require __DIR__ . '/config.php'; }
  return $c;
}

function vc_db(): PDO {
  static $pdo = null;
  if ($pdo !== null) { return $pdo; }
  $cfg = vc_cfg();
  $path = $cfg['db'];
  $dir = dirname($path);
  if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
  $fresh = !is_file($path);
  $pdo = new PDO('sqlite:' . $path, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ]);
  $pdo->exec('PRAGMA journal_mode=WAL');
  $pdo->exec('PRAGMA foreign_keys=ON');
  $pdo->exec('PRAGMA busy_timeout=5000');
  if ($fresh || !vc_table_exists($pdo, 'users')) {
    $sql = file_get_contents(__DIR__ . '/../db/schema.sql');
    $pdo->exec($sql);
  }
  return $pdo;
}

function vc_table_exists(PDO $pdo, string $name): bool {
  $st = $pdo->prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?");
  $st->execute([$name]);
  return (bool) $st->fetchColumn();
}

function vc_q(string $sql, array $args = []): PDOStatement {
  $st = vc_db()->prepare($sql);
  $st->execute($args);
  return $st;
}

function vc_all(string $sql, array $args = []): array { return vc_q($sql, $args)->fetchAll(); }

function vc_one(string $sql, array $args = []) {
  $r = vc_q($sql, $args)->fetch();
  return $r === false ? null : $r;
}

function vc_val(string $sql, array $args = []) {
  $v = vc_q($sql, $args)->fetchColumn();
  return $v === false ? null : $v;
}

function vc_insert(string $table, array $data): int {
  $cols = array_keys($data);
  $sql = sprintf('INSERT INTO %s (%s) VALUES (%s)', $table, implode(',', $cols),
    implode(',', array_fill(0, count($cols), '?')));
  vc_q($sql, array_values($data));
  return (int) vc_db()->lastInsertId();
}

function vc_update(string $table, array $data, string $where, array $args = []): void {
  $sets = implode(',', array_map(fn($c) => "$c=?", array_keys($data)));
  vc_q("UPDATE $table SET $sets WHERE $where", array_merge(array_values($data), $args));
}

function vc_setting(string $key, $default = '') {
  $v = vc_val('SELECT value FROM settings WHERE key=?', [$key]);
  return $v === null ? $default : $v;
}

function vc_setting_set(string $key, string $value): void {
  vc_q('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
       [$key, $value]);
}

function vc_event(?int $userId, string $kind, $data = ''): void {
  try {
    vc_insert('events', ['user_id' => $userId, 'kind' => $kind,
      'data' => is_string($data) ? $data : json_encode($data, JSON_UNESCAPED_UNICODE)]);
  } catch (Throwable $e) { /* аналитика не имеет права ронять запрос */ }
}
