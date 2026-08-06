<?php
/**
 * SQLite (PDO) — подключение, схема, миграции, помощники.
 * База создаётся при первом обращении. WAL для конкурентных записей.
 */
declare(strict_types=1);

function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $cfg = $GLOBALS['CFG'] ?? require BASE_PATH . '/config.php';
    $path = $cfg['db_path'];
    $dir = dirname($path);
    if (!is_dir($dir)) mkdir($dir, 0775, true);
    $isNew = !file_exists($path);
    $pdo = new PDO('sqlite:' . $path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA journal_mode=WAL');
    $pdo->exec('PRAGMA foreign_keys=ON');
    $pdo->exec('PRAGMA busy_timeout=15000');
    db_migrate($pdo);
    if ($isNew) db_seed($pdo);
    return $pdo;
}

/** Хелперы запросов. */
function q(string $sql, array $args = []): PDOStatement {
    $st = db()->prepare($sql);
    $st->execute($args);
    return $st;
}
function one(string $sql, array $args = []) {
    $r = q($sql, $args)->fetch();
    return $r === false ? null : $r;
}
function all(string $sql, array $args = []): array { return q($sql, $args)->fetchAll(); }
function scalar(string $sql, array $args = []) {
    $r = q($sql, $args)->fetch(PDO::FETCH_NUM);
    return $r === false ? null : $r[0];
}
/** Существует ли таблица в SQLite. Определяется в ядре, чтобы быть доступной и в CLI-кронах
 *  (реконсилер платежей), и в веб-API — иначе payment_apply_status() молча выходит. */
if (!function_exists('tbl_exists')) {
    function tbl_exists(string $t): bool {
        return (bool) one("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [$t]);
    }
}
function insert(string $table, array $data): int {
    $cols = array_keys($data);
    $ph = array_map(fn($c) => ':' . $c, $cols);
    q("INSERT INTO $table (" . implode(',', $cols) . ") VALUES (" . implode(',', $ph) . ")", $data);
    return (int) db()->lastInsertId();
}
function update(string $table, array $data, string $where, array $wargs = []): int {
    $set = implode(',', array_map(fn($c) => "$c=:$c", array_keys($data)));
    $st = db()->prepare("UPDATE $table SET $set WHERE $where");
    $st->execute($data + $wargs);
    return $st->rowCount();
}

function db_migrate(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT)");
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password_hash TEXT,
        full_name TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        google_id TEXT DEFAULT '',
        tg_id TEXT DEFAULT '',
        role TEXT DEFAULT 'user',            -- user|teacher|jury|moderator|designer|accountant|admin|owner
        avatar TEXT DEFAULT '',
        email_verified INTEGER DEFAULT 0,
        verify_token TEXT DEFAULT '',
        reset_token TEXT DEFAULT '',
        reset_expires TEXT DEFAULT '',
        notify_email INTEGER DEFAULT 1,
        notify_tg INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        last_login TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        ip TEXT, ua TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT
    );
    CREATE TABLE IF NOT EXISTS competitions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        code TEXT DEFAULT '',                -- MC, SR ... для номеров заявок
        name TEXT NOT NULL,
        type TEXT DEFAULT 'international',   -- international|national
        direction TEXT DEFAULT 'multi',     -- multi|patriotic|thematic
        is_paid INTEGER DEFAULT 0,
        price INTEGER DEFAULT 0,
        cover TEXT DEFAULT '',
        description TEXT DEFAULT '',
        start_date TEXT,
        end_date TEXT,
        results_date TEXT,
        results_mode TEXT DEFAULT 'email',
        results_published_at TEXT,          -- дата публикации итогов длинного конкурса (results_mode='list')
        status TEXT DEFAULT 'draft',        -- draft|open|closed|judging|finished
        regulation_pdf TEXT DEFAULT '',
        diploma_template TEXT DEFAULT '',
        diploma_theme TEXT DEFAULT '',       -- ключ темы фона диплома
        diploma_bg TEXT DEFAULT '',          -- путь к фону-подложке диплома (png)
        diploma_approved INTEGER DEFAULT 0,  -- шаблон подтверждён в админке/боте
        region_logos TEXT DEFAULT '',       -- json список лого субъектов
        nominations TEXT DEFAULT '',        -- json активных номинаций
        sort INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS awards_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competition_id INTEGER,
        item TEXT NOT NULL,
        kind TEXT DEFAULT 'original',       -- original|digital
        price INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT UNIQUE,
        competition_id INTEGER NOT NULL,
        user_id INTEGER,
        full_name TEXT NOT NULL,
        is_group INTEGER DEFAULT 0,
        group_name TEXT DEFAULT '',
        birth_date TEXT DEFAULT '',
        age_category TEXT DEFAULT '',
        nomination TEXT DEFAULT '',
        subgroup TEXT DEFAULT '',
        formation TEXT DEFAULT '',           -- solo|duet|ensemble|choir
        work_title TEXT DEFAULT '',
        teacher TEXT DEFAULT '',
        institution TEXT DEFAULT '',
        city TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        video_url TEXT DEFAULT '',
        video_platform TEXT DEFAULT '',
        address TEXT DEFAULT '',
        postal_index TEXT DEFAULT '',
        status TEXT DEFAULT 'new',           -- new|paid|judging|graded|sent|rejected
        is_paid INTEGER DEFAULT 0,
        score REAL,
        result TEXT DEFAULT '',
        flag TEXT DEFAULT '',                -- suspicious|duplicate
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS jury_grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        jury_id INTEGER NOT NULL,
        score REAL,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS diplomas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        number TEXT UNIQUE,
        application_id INTEGER,
        type TEXT DEFAULT 'main',           -- main|extra|named|thanks
        result TEXT DEFAULT '',
        pdf_path TEXT DEFAULT '',
        lang TEXT DEFAULT 'ru',
        sent_at TEXT,
        verified_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS awards_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER,
        user_id INTEGER,
        full_name TEXT, competition TEXT, result TEXT,
        items TEXT DEFAULT '',
        amount INTEGER DEFAULT 0,
        email TEXT, phone TEXT, address TEXT,
        status TEXT DEFAULT 'new',           -- new|paid|shipped|delivered
        tracking TEXT DEFAULT '',
        payment_id TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER,
        order_id INTEGER,
        amount INTEGER,
        method TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        yukassa_id TEXT DEFAULT '',
        purpose TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT '',
        source TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        unsub_token TEXT DEFAULT '',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS newsletters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT, body TEXT,
        audience TEXT DEFAULT 'all',
        scheduled_at TEXT, sent_at TEXT,
        stats_sent INTEGER DEFAULT 0,
        stats_open INTEGER DEFAULT 0,
        stats_click INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS mail_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        to_email TEXT NOT NULL, to_name TEXT DEFAULT '',
        subject TEXT, body TEXT,
        attach TEXT DEFAULT '',
        newsletter_id INTEGER,
        status TEXT DEFAULT 'queued',        -- queued|sent|failed|paused
        priority INTEGER DEFAULT 0,          -- 0=транзакционное (сразу), >0=массовое (лимит+паузы)
        tries INTEGER DEFAULT 0,
        error TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        sent_at TEXT
    );
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, competition_id INTEGER,
        author TEXT DEFAULT '', text TEXT,
        rating INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending',       -- pending|published|rejected
        admin_reply TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS faq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT, answer TEXT, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE, title TEXT, body TEXT,
        meta_description TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS concerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, category TEXT DEFAULT '', embed_url TEXT, cover TEXT DEFAULT '',
        date TEXT, sort INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS posters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competition_id INTEGER, type TEXT, format TEXT DEFAULT '1x1',
        image_path TEXT, published_at TEXT, created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ministry_letters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        region TEXT, image_path TEXT, title TEXT DEFAULT '', sort INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, session_key TEXT, role TEXT, text TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, action TEXT, entity TEXT, entity_id INTEGER,
        meta TEXT DEFAULT '', ip TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS rate_limit (
        k TEXT, window_start INTEGER, hits INTEGER DEFAULT 0, PRIMARY KEY (k, window_start)
    );
    CREATE TABLE IF NOT EXISTS verify_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        diploma_number TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_app_comp ON applications(competition_id);
    CREATE INDEX IF NOT EXISTS idx_app_user ON applications(user_id);
    CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_grade_app ON jury_grades(application_id);
    CREATE INDEX IF NOT EXISTS idx_dip_app ON diplomas(application_id);
    CREATE INDEX IF NOT EXISTS idx_queue_status ON mail_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sub_email ON subscribers(email);
    ");
}

function setting(string $key, $default = null) {
    $r = one("SELECT value FROM settings WHERE key=?", [$key]);
    return $r ? $r['value'] : $default;
}
function set_setting(string $key, string $value): void {
    q("INSERT INTO settings(key,value,updated_at) VALUES(?,?,datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')", [$key, $value]);
}

require_once __DIR__ . '/seed.php';
