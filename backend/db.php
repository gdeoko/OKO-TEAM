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
    source TEXT DEFAULT 'form',          -- последний источник (для отображения)
    is_form INTEGER DEFAULT 0,           -- заполнял обычную форму
    is_darts INTEGER DEFAULT 0,          -- заполнял форму купона дартса
    status TEXT DEFAULT 'new',           -- new | invited | client
    note TEXT DEFAULT '',
    invited INTEGER DEFAULT 0,           -- 1 = приглашение отправлено
    welcomed INTEGER DEFAULT 0,          -- 1 = письмо 'получили заявку' отправлено
    created INTEGER, updated INTEGER
  )");

  // Очередь авто-отправок (приглашение + 4 лид-магнита по расписанию)
  $pdo->exec("CREATE TABLE IF NOT EXISTS drips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscriber_id INTEGER,
    kind TEXT,                           -- invite | magnet1..magnet4
    send_at INTEGER,                     -- когда слать (unixtime)
    sent INTEGER DEFAULT 0,
    created INTEGER
  )");
  $pdo->exec("CREATE INDEX IF NOT EXISTS idx_drips_due ON drips(sent, send_at)");

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
    'admin_pin'      => ADMIN_PIN,       // цифровой PIN входа (меняется в админке)
    'club_address'   => 'Москва, Проспект Мира, дом 102с25',
    'club_address_map' => 'https://yandex.ru/maps/?rtext=~Москва, Проспект Мира, дом 102с25&rtt=auto',
    'invite_text'    => 'Ты в списке! Ждём тебя в DUCK\'S GAME SPACE. Адрес и детали — ниже. До встречи за столом.',
    'welcome_text'   => 'Заявка принята! Мы уже готовим тебе персональное приглашение — оно придёт совсем скоро. А пока загляни в наш канал.',
    'coupon_points'  => '150',           // порог очков в дартсе для купона
    'coupon_discount'=> '15',            // % скидки
  ];
  $ins = $pdo->prepare("INSERT OR IGNORE INTO settings (k,v) VALUES (?,?)");
  foreach ($defaults as $k => $v) $ins->execute([$k, $v]);
}

/* Действующий PIN админки (из БД, иначе константа из config) */
function currentPin() {
  $p = setting('admin_pin', ADMIN_PIN);
  return ($p === '' || $p === null) ? ADMIN_PIN : $p;
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

/* upsert подписчика по email. Флаги is_form/is_darts ДОБАВЛЯЮТСЯ (не затирают друг друга):
   один человек может заполнить и обычную форму, и купон — попадёт в ОБА фильтра. */
function upsertSubscriber($d) {
  $pdo = db(); $now = time();
  $email = strtolower(trim($d['email'] ?? ''));
  $src = $d['source'] ?? 'form';                 // 'form' | 'darts'
  $isForm = $src === 'form' ? 1 : 0;
  $isDarts = $src === 'darts' ? 1 : 0;
  $st = $pdo->prepare("SELECT id, name, phone, game, format FROM subscribers WHERE email=?");
  $st->execute([$email]);
  $row = $st->fetch();
  if ($row) {
    $id = $row['id'];
    // не затираем уже известные имя/телефон пустыми значениями
    $name = $d['name'] ?: $row['name'];
    $phone = $d['phone'] ?: $row['phone'];
    $game = $d['game'] ?: $row['game'];
    $format = $d['format'] ?: $row['format'];
    // CAST(? AS INTEGER): PDO биндит 0/1 как ТЕКСТ, а SQLite в MAX() ставит текст выше чисел
    // (MAX(1,'0')='0') — приведение к INTEGER чинит «слипание» флагов.
    $pdo->prepare("UPDATE subscribers SET name=?, phone=?, game=?, format=?, source=?,
                   is_form=MAX(is_form,CAST(? AS INTEGER)), is_darts=MAX(is_darts,CAST(? AS INTEGER)), updated=? WHERE id=?")
        ->execute([$name, $phone, $game, $format, $src, $isForm, $isDarts, $now, $id]);
    return $id;
  }
  $pdo->prepare("INSERT INTO subscribers (name,email,phone,game,format,source,is_form,is_darts,status,created,updated)
                 VALUES (?,?,?,?,?,?,?,?, 'new', ?, ?)")
      ->execute([$d['name'] ?? '', $email, $d['phone'] ?? '', $d['game'] ?? '', $d['format'] ?? '',
                 $src, $isForm, $isDarts, $now, $now]);
  return $pdo->lastInsertId();
}

/* Поставить в очередь авто-цепочку: приглашение + 4 лид-магнита по расписанию.
   Логичная очередь от момента заявки:
     +15 мин  → приглашение в клуб (адрес, кнопки)
     +15 мин  → лид-магнит 1
     +1 час   → лид-магнит 2
     +6 часов → лид-магнит 3
     +24 часа → лид-магнит 4
   Идемпотентно: если для подписчика уже стоят дрипы — повторно не добавляем. */
function enqueueDrips($subscriberId) {
  $pdo = db(); $now = time();
  $st = $pdo->prepare("SELECT COUNT(*) FROM drips WHERE subscriber_id=?");
  $st->execute([$subscriberId]);
  if ((int)$st->fetchColumn() > 0) return;
  $plan = [
    ['invite',  INVITE_DELAY_MIN * 60],
    ['magnet1', 15 * 60],
    ['magnet2', 60 * 60],
    ['magnet3', 6 * 3600],
    ['magnet4', 24 * 3600],
  ];
  $ins = $pdo->prepare("INSERT INTO drips (subscriber_id,kind,send_at,sent,created) VALUES (?,?,?,0,?)");
  foreach ($plan as [$kind, $delay]) $ins->execute([$subscriberId, $kind, $now + $delay, $now]);
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
