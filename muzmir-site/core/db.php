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
    // UTF-8 регистронезависимость для поиска. Встроенные LIKE/LOWER в SQLite работают
    // только с ASCII: запрос «иванов» не находил «Иванов», и поиск в админке выглядел
    // сломанным. Регистрируем свои функции на mb_* — их использует search_like().
    $pdo->sqliteCreateFunction('mb_lower', function ($s) {
        return $s === null ? null : mb_strtolower((string) $s, 'UTF-8');
    }, 1);
    $pdo->sqliteCreateFunction('mb_upper', function ($s) {
        return $s === null ? null : mb_strtoupper((string) $s, 'UTF-8');
    }, 1);
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
/**
 * ВРЕМЯ СОЗДАНИЯ ЗАПИСИ СТАВИМ САМИ, ПО МОСКВЕ.
 *
 * У почти всех таблиц created_at заполнялся умолчанием SQLite — datetime('now'),
 * а это ВСЕМИРНОЕ время, без часового пояса. Заявка, поданная в 11:04 по Москве,
 * ложилась в базу как 08:04, и в админке рядом стояли два времени одного события
 * с разницей в три часа: время подачи от SQLite и время письма от PHP.
 *
 * Умолчания в схеме починены отдельно (scripts/fix_tz_defaults.php), но эта
 * подстраховка остаётся: время проставляется здесь, в единственной точке вставки,
 * и уже не зависит от того, что записано в схеме. Если вызывающий код задал
 * значение сам, не трогаем.
 */
function insert(string $table, array $data): int {
    foreach (db_tz_columns($table) as $col) {
        if (!array_key_exists($col, $data)) $data[$col] = date('Y-m-d H:i:s');
    }
    $cols = array_keys($data);
    $ph = array_map(fn($c) => ':' . $c, $cols);
    q("INSERT INTO $table (" . implode(',', $cols) . ") VALUES (" . implode(',', $ph) . ")", $data);
    return (int) db()->lastInsertId();
}

/**
 * КОЛОНКИ СО ВРЕМЕНЕМ, КОТОРОЕ ИНАЧЕ ПОСТАВИТ SQLITE.
 *
 * Это все колонки таблицы, у которых в умолчании стоит datetime('now') — неважно,
 * как они называются: created_at, created, ts, started_at. Именно им нужно
 * подставить московское время при вставке. Если умолчание уже с 'localtime',
 * колонка сюда не попадает — подставлять нечего.
 */
function db_tz_columns(string $table): array {
    static $cache = [];
    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $table)) return [];
    if (!isset($cache[$table])) {
        $out = [];
        try {
            foreach (db()->query("PRAGMA table_info(\"$table\")")->fetchAll(PDO::FETCH_ASSOC) as $c) {
                $def = (string) ($c['dflt_value'] ?? '');
                if (strpos($def, "datetime('now')") !== false) $out[] = (string) $c['name'];
            }
        } catch (\Throwable $e) { $out = []; }
        $cache[$table] = $out;
    }
    return $cache[$table];
}

/** Есть ли у таблицы такая колонка. Ответ кэшируется: спрашивают на каждой вставке. */
function db_has_column(string $table, string $column): bool {
    static $cache = [];
    if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $table)) return false;
    if (!isset($cache[$table])) {
        $cols = [];
        try {
            foreach (db()->query("PRAGMA table_info(\"$table\")")->fetchAll(PDO::FETCH_ASSOC) as $c) {
                $cols[(string) $c['name']] = true;
            }
        } catch (\Throwable $e) { $cols = []; }
        $cache[$table] = $cols;
    }
    return isset($cache[$table][$column]);
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
        created_at TEXT DEFAULT (datetime('now','localtime')),
        last_login TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        ip TEXT, ua TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime')),
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
        created_at TEXT DEFAULT (datetime('now','localtime'))
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
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS jury_grades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        jury_id INTEGER NOT NULL,
        score REAL,
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime'))
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
        created_at TEXT DEFAULT (datetime('now','localtime'))
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
        created_at TEXT DEFAULT (datetime('now','localtime'))
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
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS subscribers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        name TEXT DEFAULT '',
        source TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        unsub_token TEXT DEFAULT '',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now','localtime'))
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
        created_at TEXT DEFAULT (datetime('now','localtime'))
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
        created_at TEXT DEFAULT (datetime('now','localtime')),
        sent_at TEXT
    );
    CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, competition_id INTEGER,
        author TEXT DEFAULT '', text TEXT,
        rating INTEGER DEFAULT 5,
        status TEXT DEFAULT 'pending',       -- pending|published|rejected
        admin_reply TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS faq (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT, answer TEXT, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE, title TEXT, body TEXT,
        meta_description TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS concerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT, category TEXT DEFAULT '', embed_url TEXT, cover TEXT DEFAULT '',
        date TEXT, sort INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS posters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        competition_id INTEGER, type TEXT, format TEXT DEFAULT '1x1',
        image_path TEXT, published_at TEXT, created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS ministry_letters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        region TEXT, image_path TEXT, title TEXT DEFAULT '', sort INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, session_key TEXT, role TEXT, text TEXT,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER, action TEXT, entity TEXT, entity_id INTEGER,
        meta TEXT DEFAULT '', ip TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS rate_limit (
        k TEXT, window_start INTEGER, hits INTEGER DEFAULT 0, PRIMARY KEY (k, window_start)
    );
    CREATE TABLE IF NOT EXISTS verify_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        diploma_number TEXT, ip TEXT, created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_app_comp ON applications(competition_id);
    CREATE INDEX IF NOT EXISTS idx_app_user ON applications(user_id);
    CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);
    CREATE INDEX IF NOT EXISTS idx_grade_app ON jury_grades(application_id);
    CREATE INDEX IF NOT EXISTS idx_dip_app ON diplomas(application_id);
    CREATE INDEX IF NOT EXISTS idx_queue_status ON mail_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sub_email ON subscribers(email);
    ");

    // Ленивое добавление колонок к существующим таблицам (идемпотентно).
    // launched: конкурс появляется на сайте (афиша/заявка/награды/календарь) ТОЛЬКО после
    // запуска из пульта. До запуска — виден только в админке. Текущие конкурсы уже запущены.
    //
    // ВАЖНО: раньше эти колонки добавлялись «по месту» — в cron/send_diplomas.php,
    // admin/grading.php, admin/dispatch.php, core/newsletter.php и т.д. Если модуль,
    // создающий колонку, в этом запросе не подключался, любой другой код падал на
    // «no such column» (например, кабинет не мог прочитать result_sent_at, пока не
    // отработает крон). Теперь вся схема заводится здесь, в одном месте, при db().
    foreach ([
        ['competitions', 'launched',            'INTEGER DEFAULT 0'],
        ['competitions', 'launched_at',         'TEXT'],
        ['competitions', 'results_published_at','TEXT'],
        // Положение загружено владельцем файлом, а не собрано из эталона. Такое
        // автогенерация не трогает: его для того и загрузили, что эталон не подошёл.
        ['competitions', 'regulation_custom',   'INTEGER DEFAULT 0'],
        ['competitions', 'duration',            "TEXT DEFAULT 'long'"],

        // Заявка: аттестация, сроки отправки результата, служебные поля жюри.
        ['applications', 'graded_at',        'TEXT'],
        ['applications', 'extra_diploma',    "TEXT DEFAULT ''"],
        ['applications', 'jury_comment',     "TEXT DEFAULT ''"],
        ['applications', 'link_check',       'TEXT'],
        ['applications', 'reject_reason',    "TEXT DEFAULT ''"],
        ['applications', 'send_at_override', 'TEXT'],
        ['applications', 'result_send_at',   "TEXT DEFAULT ''"],   // план отправки результата
        ['applications', 'result_sent_at',   "TEXT DEFAULT ''"],   // ФАКТ отправки результата
        ['applications', 'amount_paid',      'INTEGER DEFAULT 0'], // сколько реально оплачено за участие
        // Расшифровка цены заявки: сколько стоило до скидок, сколько скидки и за что.
        // Без этого админка показывала голую сумму (а то и «не оплачено»), и понять,
        // почему участник заплатил 400 вместо 500, было неоткуда.
        ['applications', 'price_base',       'INTEGER DEFAULT 0'], // взнос по прайсу, до скидок
        ['applications', 'discount_pct',     'INTEGER DEFAULT 0'], // итоговый процент скидки
        ['applications', 'discount_info',    "TEXT DEFAULT ''"],   // JSON: из чего сложилась скидка
        // Пакетная оплата: id платежа, покрывающего эту заявку, и общий id пакета
        // (одинаковый у всех заявок в одном чеке). Без этого админка видела платёж
        // только у ПЕРВОЙ заявки батча, а остальные считались неоплаченными.
        ['applications', 'payment_id',       'INTEGER DEFAULT 0'], // id из payments — единственный чек за эту заявку
        ['applications', 'batch_id',         "TEXT DEFAULT ''"],   // общий id пакета (yukassa_id платежа)
        // Возврат. Раньше единственным следом возврата был is_paid=0, и возвращённая
        // заявка становилась неотличима от неоплаченной: пропадала из админки и
        // снова открывалась к оплате по старой ссылке из письма.
        ['applications', 'refunded_at',      "TEXT DEFAULT ''"],   // когда деньги вернули
        ['applications', 'amount_refunded',  'INTEGER DEFAULT 0'], // сколько вернули
        // Ручное состояние из админки. Обычно пусто: статус вычисляется из фактов
        // (см. core/app_status.php). Заполняется, только когда оргкомитету нужно
        // аварийно перевести заявку в состояние, до которого факты не дошли.
        ['applications', 'state_override',   "TEXT DEFAULT ''"],

        // Дипломы: расписание отправки и счётчик попыток.
        ['diplomas', 'scheduled_at',      'TEXT'],
        ['diplomas', 'send_tries',        'INTEGER DEFAULT 0'],
        ['diplomas', 'video_review_path', "TEXT DEFAULT ''"],

        // Очередь писем: приоритет (0 = транзакционное) и плановое время.
        ['mail_queue', 'scheduled_at',  'TEXT'],
        ['mail_queue', 'priority',      'INTEGER DEFAULT 0'],
        ['mail_queue', 'campaign_type', 'TEXT'],

        // Заказы наградного материала: этапы исполнения.
        ['awards_orders', 'made_at',       'TEXT'],
        ['awards_orders', 'shipped_at',    'TEXT'],
        ['awards_orders', 'delivered_at',  'TEXT'],
        ['awards_orders', 'dispatched_at', 'TEXT'],
        ['awards_orders', 'clean_pdfs',    "TEXT DEFAULT ''"],
        ['awards_orders', 'kind',          "TEXT DEFAULT 'original'"], // original|digital|club|mixed
        ['awards_orders', 'amount_full',   'INTEGER DEFAULT 0'],       // цена до клубной скидки
        ['awards_orders', 'discount_pct',  'INTEGER DEFAULT 0'],       // применённая скидка ВИП, %
        ['awards_orders', 'scheduled_at',  'TEXT'],                    // план отправки электронных
        ['awards_orders', 'sent_at',       'TEXT'],                    // факт отправки электронных
        ['awards_orders', 'canceled_at',   'TEXT'],                    // время отмены (админ)
        ['awards_orders', 'cancel_reason', "TEXT DEFAULT ''"],         // причина отмены
        ['awards_orders', 'refund_amount', 'INTEGER DEFAULT 0'],       // возвращённая сумма, ₽
        ['awards_orders', 'refund_id',     "TEXT DEFAULT ''"],         // id refund в ЮKassa

        // Канал, приведший заявку: 'vk/vk-promo-2026-08', 'email', 'partner'.
        // Без него все каналы сливаются в одну кучу и усиливать нечего.
        ['applications', 'src', "TEXT DEFAULT ''"],

        // Время, начиная с которого сообщение показывается участнику. Пусто —
        // сразу. Так работает очередь чата: Клуб получает ответ моментально,
        // обычный участник в обещанный срок (core/chat_priority.php).
        ['chat_messages', 'visible_at', "TEXT DEFAULT ''"],

        // Очередь ВКонтакте. Там ответ не «показывается», а ОТПРАВЛЯЕТСЯ отдельным
        // отсоединённым процессом, который спит до своего срока. Пока пауза была
        // 20-30 секунд, потеря такого процесса роли не играла; с пятиминутной
        // очередью это уже потерянный ответ живому человеку — и никаких следов.
        // vk_send_at — когда ответ должен уйти, vk_sent — ушёл ли (сторож
        // cron/vk_resend_stuck.php досылает всё, что просрочено).
        ['chat_messages', 'vk_send_at', "TEXT DEFAULT ''"],
        ['chat_messages', 'vk_sent',    'INTEGER DEFAULT 0'],

        ['users',   'blocked',     'INTEGER DEFAULT 0'],
        ['reviews', 'attachments', "TEXT DEFAULT ''"],
        ['newsletters', 'campaign_type', "TEXT DEFAULT 'konkurs'"],
    ] as $col) {
        try { $pdo->exec("ALTER TABLE {$col[0]} ADD COLUMN {$col[1]} {$col[2]}"); } catch (\Throwable $e) { /* уже есть */ }
    }

    // Индексы под частые выборки очередей и статусов (список «Отправки», кабинет).
    foreach ([
        "CREATE INDEX IF NOT EXISTS idx_dip_sched   ON diplomas(sent_at, scheduled_at)",
        "CREATE INDEX IF NOT EXISTS idx_queue_sched ON mail_queue(status, scheduled_at)",
        "CREATE INDEX IF NOT EXISTS idx_ord_app     ON awards_orders(application_id)",
        "CREATE INDEX IF NOT EXISTS idx_ord_status  ON awards_orders(status)",
        "CREATE INDEX IF NOT EXISTS idx_app_result  ON applications(result_sent_at)",
    ] as $ix) {
        try { $pdo->exec($ix); } catch (\Throwable $e) { /* не критично */ }
    }
}

/**
 * Строит регистронезависимое (в т.ч. для кириллицы) условие поиска по нескольким полям.
 * Поддерживает несколько слов: «иванов вокал» найдёт строку, где есть оба фрагмента
 * (в любых полях и в любом порядке).
 *
 * @param  array $fields поля SQL, например ['a.full_name','a.email','c.name']
 * @param  string $query пользовательская строка поиска
 * @return array [фрагмент SQL для WHERE (или ''), массив аргументов]
 */
function search_like(array $fields, string $query): array {
    $query = trim(preg_replace('/\s+/u', ' ', $query));
    if ($query === '' || !$fields) return ['', []];
    // Не более 5 слов — защита от неограниченного роста запроса.
    $words = array_slice(explode(' ', $query), 0, 5);
    $sql = []; $args = [];
    foreach ($words as $w) {
        $w = mb_strtolower($w, 'UTF-8');
        $ors = [];
        foreach ($fields as $f) {
            $ors[] = "mb_lower(COALESCE($f,'')) LIKE ?";
            $args[] = '%' . $w . '%';
        }
        $sql[] = '(' . implode(' OR ', $ors) . ')';
    }
    return [implode(' AND ', $sql), $args];
}

function setting(string $key, $default = null) {
    $r = one("SELECT value FROM settings WHERE key=?", [$key]);
    return $r ? $r['value'] : $default;
}
function set_setting(string $key, string $value): void {
    q("INSERT INTO settings(key,value,updated_at) VALUES(?,?,datetime('now','localtime'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now','localtime')", [$key, $value]);
}

require_once __DIR__ . '/seed.php';
