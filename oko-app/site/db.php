<?php
// ═══════════════════════════════════════════════════════════════
// OKO SITE — слой БД (SQLite, создаётся сам, ноль настройки).
// Таблицы создаются при первом обращении. Данные из старых
// data.json / anketas.json мигрируются автоматически.
// ═══════════════════════════════════════════════════════════════

function cfg(): array {
    static $c = null;
    if ($c === null) {
        $path = __DIR__ . '/config.php';
        $c = file_exists($path) ? require $path : require __DIR__ . '/config.example.php';
        /* Платёжные ключи (ЮKassa) живут в ОТДЕЛЬНОМ файле-оверлее, чтобы их
           можно было добавить на VPS одной командой в веб-консоли, не редактируя
           большой config.php руками. Файл возвращает массив и накрывает базовый
           конфиг. Наружу не отдаётся: nginx исполняет *.php, а `return` ничего
           не печатает. В git этого файла нет — только на VPS. */
        $ov = __DIR__ . '/config-pay.php';
        if (file_exists($ov)) {
            $o = @require $ov;
            if (is_array($o)) $c = array_replace($c, $o);
        }
    }
    return $c;
}
function now(): string { return date('Y-m-d H:i:s'); }

function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    $dir = __DIR__ . '/data';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $pdo = new PDO('sqlite:' . $dir . '/oko.db');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode=WAL');
    $pdo->exec('PRAGMA busy_timeout=5000');
    db_schema($pdo);
    db_automigrate($pdo);
    db_backfill_anketa_clients($pdo);
    return $pdo;
}

// Разовый бэкофилл: все, кто заполнял анкету, попадают в базу клиентов (Даниэль просил авто).
// Работает с $pdo напрямую (не через db()/client_upsert) — чтобы не рекурсить при инициализации.
function db_backfill_anketa_clients(PDO $pdo): void {
    try {
        $done = $pdo->query("SELECT v FROM settings WHERE k='anketa_clients_synced'")->fetchColumn();
        if ($done) return;
        $rows = $pdo->query("SELECT client_name,email,tg FROM anketa_submissions")->fetchAll();
        $find = $pdo->prepare("SELECT id FROM clients WHERE email=? AND email!=''");
        $upd  = $pdo->prepare("UPDATE clients SET name=COALESCE(NULLIF(?,''),name), tg=COALESCE(NULLIF(?,''),tg) WHERE id=?");
        $ins  = $pdo->prepare("INSERT INTO clients (name,email,phone,tg,niche,status,source,created_at) VALUES (?,?,?,?,?,?,?,?)");
        foreach ($rows as $r) {
            $email = trim($r['email'] ?? ''); $name = trim($r['client_name'] ?? '');
            $tg = ltrim(trim($r['tg'] ?? ''), '@');
            if (!$email && !$name) continue;
            $ex = null;
            if ($email) { $find->execute([$email]); $ex = $find->fetchColumn(); }
            if ($ex) $upd->execute([$name, $tg, $ex]);
            else     $ins->execute([$name, $email, '', $tg, '', 'anketa', 'anketa', date('Y-m-d H:i:s')]);
        }
        $pdo->prepare("INSERT OR REPLACE INTO settings (k,v,updated_at) VALUES ('anketa_clients_synced',?,?)")
            ->execute([date('Y-m-d H:i:s'), date('Y-m-d H:i:s')]);
    } catch (Throwable $e) { /* не критично */ }
}

function db_schema(PDO $pdo): void {
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT UNIQUE, phone TEXT, tg TEXT,
      tg_user_id INTEGER, niche TEXT, status TEXT DEFAULT 'new', products TEXT, tariff TEXT,
      paid INTEGER DEFAULT 0, paid_product TEXT, paid_ts TEXT, source TEXT DEFAULT 'site',
      note TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now','localtime')), updated_at TEXT);
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, email TEXT, name TEXT, product TEXT,
      tariff TEXT, amount TEXT, method TEXT, manual INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE, name TEXT, phone TEXT, tg TEXT,
      products TEXT, paid INTEGER DEFAULT 0, created_at TEXT, last_action TEXT);
    CREATE TABLE IF NOT EXISTS newsletter_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT, segment TEXT, sent INTEGER, failed INTEGER, created_at TEXT);
    CREATE TABLE IF NOT EXISTS anketa_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id TEXT UNIQUE, client_id INTEGER,
      service_type TEXT DEFAULT 'sistema', client_name TEXT, email TEXT, tg TEXT, answers TEXT,
      progress INTEGER DEFAULT 0, total INTEGER DEFAULT 0, complete INTEGER DEFAULT 0,
      started_at TEXT, completed_at TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS anketa_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id TEXT, filename TEXT, path TEXT, mime TEXT,
      size_bytes INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS dialogs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, tg_user_id INTEGER, account TEXT,
      role TEXT, message TEXT, stage TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS vacancies (
      id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT, source_type TEXT, text TEXT, niche TEXT,
      budget TEXT, score INTEGER, responded INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT, vacancy_id INTEGER, client_id INTEGER, account TEXT,
      message TEXT, case_used TEXT, created_at TEXT DEFAULT (datetime('now','localtime')));
    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER, product TEXT, tariff TEXT, amount INTEGER,
      status TEXT DEFAULT 'open', kp_url TEXT, contract_path TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')), closed_at TEXT);
    CREATE TABLE IF NOT EXISTS team_chat_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT, topic_name TEXT UNIQUE, chat_id TEXT, thread_id INTEGER, description TEXT, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT, page TEXT, ref TEXT, ua TEXT, ip TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')));
    CREATE INDEX IF NOT EXISTS idx_visits_created ON visits(created_at);
    ");
    // Ветки командного чата (idempotent)
    $topics = [['ai_command',2866,'AI КОМАНДА'],['vacancies_channels',2871,'Вакансии • каналы'],
        ['vacancies_bots',2872,'Вакансии • боты'],['responses_channels',2869,'Отклик • каналы'],
        ['responses_bots',2870,'Отклик • боты'],['hot_leads',2873,'Горячие лиды'],
        ['deals',2874,'Сделки'],['need_human',2875,'Нужен человек'],['analytics',2876,'Аналитика']];
    $chat = cfg()['team_chat_id'] ?? '';
    $st = $pdo->prepare("INSERT OR IGNORE INTO team_chat_topics (topic_name,chat_id,thread_id,description) VALUES (?,?,?,?)");
    foreach ($topics as $t) $st->execute([$t[0], $chat, $t[1], $t[2]]);
}

// Авто-миграция из старых JSON при первом запуске (если есть файлы и БД пуста).
function db_automigrate(PDO $pdo): void {
    $done = $pdo->query("SELECT v FROM settings WHERE k='migrated'")->fetchColumn();
    if ($done) return;
    $dataFile = __DIR__ . '/data.json'; $anketaFile = __DIR__ . '/anketas.json';
    if (!file_exists($dataFile) && !file_exists($anketaFile)) return; // нечего мигрировать — отметим позже
    require_once __DIR__ . '/migrate_core.php';
    migrate_run($pdo, $dataFile, $anketaFile);
    $pdo->prepare("INSERT OR REPLACE INTO settings (k,v,updated_at) VALUES ('migrated',?,?)")->execute([date('Y-m-d H:i:s'), now()]);
    // Бэкап старых JSON
    if (file_exists($dataFile))   @rename($dataFile,   $dataFile . '.backup');
    if (file_exists($anketaFile)) @rename($anketaFile, $anketaFile . '.backup');
}

// ── Helpers ────────────────────────────────────────────────────
function db_exec(string $sql, array $p = []): int { $s = db()->prepare($sql); $s->execute($p); return $s->rowCount(); }
function db_insert(string $sql, array $p = []): int { $s = db()->prepare($sql); $s->execute($p); return (int) db()->lastInsertId(); }
function db_all(string $sql, array $p = []): array { $s = db()->prepare($sql); $s->execute($p); return $s->fetchAll(); }
function db_one(string $sql, array $p = []): ?array { $s = db()->prepare($sql); $s->execute($p); $r = $s->fetch(); return $r ?: null; }
function db_val(string $sql, array $p = []) { $s = db()->prepare($sql); $s->execute($p); return $s->fetchColumn(); }

function mime_to_ext(string $mime): string {
    $map = ['image/png'=>'png','image/jpeg'=>'jpg','image/jpg'=>'jpg','image/webp'=>'webp','image/gif'=>'gif',
        'image/svg+xml'=>'svg','audio/mpeg'=>'mp3','audio/mp3'=>'mp3','audio/ogg'=>'ogg','audio/wav'=>'wav',
        'audio/webm'=>'webm','video/mp4'=>'mp4','video/webm'=>'webm','application/pdf'=>'pdf'];
    return $map[strtolower($mime)] ?? 'bin';
}

function anketa_extract_files(array &$answers): array {
    $files = [];
    if (isset($answers['__media__items']) && is_array($answers['__media__items'])) {
        foreach ($answers['__media__items'] as $i => $m) {
            $du = is_array($m) ? ($m['dataUrl'] ?? '') : '';
            if (preg_match('#data:([^;]+);base64,([A-Za-z0-9+/=]+)#', (string)$du, $mm)) {
                $bin = base64_decode($mm[2]);
                if ($bin !== false && $bin !== '') $files[] = ['name'=>$m['name'] ?? ('media_'.$i.'.'.mime_to_ext($mm[1])), 'mime'=>$mm[1], 'bin'=>$bin];
            }
        }
    }
    foreach ($answers as $k => $v) {
        if (strpos($k, '__') === 0 && is_string($v) && preg_match('#data:([^;]+);base64,([A-Za-z0-9+/=]+)#', $v, $mm)) {
            $bin = base64_decode($mm[2]);
            if ($bin !== false && $bin !== '') $files[] = ['name'=>trim($k,'_').'.'.mime_to_ext($mm[1]), 'mime'=>$mm[1], 'bin'=>$bin];
        }
    }
    foreach (array_keys($answers) as $k) if (strpos($k, '__') === 0) unset($answers[$k]);
    return $files;
}

// Upsert клиента по email → client_id.
function client_upsert(array $c): int {
    $email = $c['email'] ?? '';
    if ($email) {
        $ex = db_one("SELECT id FROM clients WHERE email=?", [$email]);
        if ($ex) {
            db_exec("UPDATE clients SET name=COALESCE(NULLIF(?,''),name), phone=COALESCE(NULLIF(?,''),phone),
                     tg=COALESCE(NULLIF(?,''),tg), niche=COALESCE(NULLIF(?,''),niche), updated_at=? WHERE id=?",
                [$c['name']??'', $c['phone']??'', $c['tg']??'', $c['niche']??'', now(), $ex['id']]);
            return (int)$ex['id'];
        }
    }
    return db_insert("INSERT INTO clients (name,email,phone,tg,niche,status,products,tariff,source,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)",
        [$c['name']??'', $email, $c['phone']??'', $c['tg']??'', $c['niche']??'', $c['status']??'new',
         isset($c['products'])?json_encode($c['products'],JSON_UNESCAPED_UNICODE):null, $c['tariff']??'', $c['source']??'site', now()]);
}
