<?php
/* ============================================================
   DUCK'S — слой данных (SQLite/PDO). Создаёт БД и таблицы при первом запуске.
   Таблицы: subscribers, coupons, events, newsletter_log, settings.
   ============================================================ */
require_once __DIR__ . '/config.php';

function db() {
  static $pdo = null;
  if ($pdo) return $pdo;
  $dir = dirname(DB_FILE);
  if (!is_dir($dir)) @mkdir($dir, 0775, true);
  if (!is_dir(UPLOAD_DIR)) @mkdir(UPLOAD_DIR, 0775, true);
  $pdo = new PDO('sqlite:' . DB_FILE);
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
  $pdo->exec('PRAGMA journal_mode=WAL;');
  initSchema($pdo);
  return $pdo;
}

function initSchema($pdo) {
  $pdo->exec("CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT, email TEXT, phone TEXT,
    game TEXT, format TEXT,
    source TEXT DEFAULT 'form',          -- form | darts
    status TEXT DEFAULT 'new',           -- new | invited | client
    note TEXT DEFAULT '',
    invite_at INTEGER DEFAULT 0,         -- unixtime когда слать авто-приглашение (0=не нужно/уже)
    invited INTEGER DEFAULT 0,           -- 1 = приглашение отправлено
    welcomed INTEGER DEFAULT 0,          -- 1 = письмо 'получили заявку' отправлено
    magnet_sent INTEGER DEFAULT 0,       -- 1 = лид-магнит отправлен
    created INTEGER, updated INTEGER
  )");

  $pdo->exec("CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT UNIQUE,                  -- именной номер купона
    name TEXT, email TEXT, phone TEXT,
    discount INTEGER DEFAULT 15,
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',        -- active | used | void
    subscriber_id INTEGER DEFAULT 0,
    created INTEGER, updated INTEGER
  )");

  $pdo->exec("CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,                           -- visit | click | conversion | coupon | form
    label TEXT,                          -- что именно (id карточки/кнопки)
    meta TEXT DEFAULT '',
    ua TEXT DEFAULT '', ip TEXT DEFAULT '',
    created INTEGER
  )");

  $pdo->exec("CREATE TABLE IF NOT EXISTS newsletter_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT, body TEXT,
    recipients INTEGER DEFAULT 0,
    audience TEXT DEFAULT 'all',         -- all | form | darts
    created INTEGER
  )");

  $pdo->exec("CREATE TABLE IF NOT EXISTS settings (
    k TEXT PRIMARY KEY, v TEXT
  )");

  // Значения по умолчанию (редактируются в админке → settings)
  $defaults = [
    'club_address'   => 'Москва, БП «ПАРК МИРА», DUCK\'S GAME SPACE',
    'club_address_map' => 'https://yandex.ru/maps/?text=Москва%20Парк%20Мира',
    'invite_text'    => 'Ты в списке! Ждём тебя в DUCK\'S GAME SPACE. Адрес и детали — ниже. До встречи за столом 🦆',
    'welcome_text'   => 'Заявка принята! Мы уже готовим тебе персональное приглашение — оно придёт совсем скоро. А пока загляни в наш канал.',
    'coupon_points'  => '150',           // порог очков в дартсе для купона
    'coupon_discount'=> '15',            // % скидки
    'magnet_url'     => SITE_URL . '/10-shagov',
    'magnet_title'   => '10 шагов, чтобы всегда быть в игре',
  ];
  $ins = $pdo->prepare("INSERT OR IGNORE INTO settings (k,v) VALUES (?,?)");
  foreach ($defaults as $k => $v) $ins->execute([$k, $v]);
}

function setting($k, $def = '') {
  $st = db()->prepare("SELECT v FROM settings WHERE k=?");
  $st->execute([$k]);
  $r = $st->fetchColumn();
  return $r === false ? $def : $r;
}
function setSetting($k, $v) {
  db()->prepare("INSERT INTO settings (k,v) VALUES (?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v")
      ->execute([$k, $v]);
}

/* upsert подписчика по email (не плодим дубли) */
function upsertSubscriber($d) {
  $pdo = db(); $now = time();
  $email = strtolower(trim($d['email'] ?? ''));
  $st = $pdo->prepare("SELECT id FROM subscribers WHERE email=?");
  $st->execute([$email]);
  $id = $st->fetchColumn();
  if ($id) {
    $pdo->prepare("UPDATE subscribers SET name=?, phone=?, game=?, format=?, source=?, updated=? WHERE id=?")
        ->execute([$d['name'] ?? '', $d['phone'] ?? '', $d['game'] ?? '', $d['format'] ?? '',
                   $d['source'] ?? 'form', $now, $id]);
    return $id;
  }
  $inviteAt = ($d['source'] ?? 'form') === 'form' ? $now + INVITE_DELAY_MIN * 60 : 0;
  $pdo->prepare("INSERT INTO subscribers (name,email,phone,game,format,source,status,invite_at,created,updated)
                 VALUES (?,?,?,?,?,?, 'new', ?, ?, ?)")
      ->execute([$d['name'] ?? '', $email, $d['phone'] ?? '', $d['game'] ?? '', $d['format'] ?? '',
                 $d['source'] ?? 'form', $inviteAt, $now, $now]);
  return $pdo->lastInsertId();
}

function logEvent($type, $label = '', $meta = '') {
  try {
    db()->prepare("INSERT INTO events (type,label,meta,ua,ip,created) VALUES (?,?,?,?,?,?)")
        ->execute([$type, $label, is_array($meta) ? json_encode($meta, JSON_UNESCAPED_UNICODE) : $meta,
                   substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200),
                   $_SERVER['REMOTE_ADDR'] ?? '', time()]);
  } catch (Exception $e) {}
}

/* уникальный номер купона: D15-XXXXXX */
function genCouponNumber() {
  do {
    $n = 'D15-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
    $st = db()->prepare("SELECT 1 FROM coupons WHERE number=?");
    $st->execute([$n]);
  } while ($st->fetchColumn());
  return $n;
}
