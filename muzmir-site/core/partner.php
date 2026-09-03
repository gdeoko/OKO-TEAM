<?php
/**
 * core/partner.php — партнёрская программа «Информационный партнёр».
 *
 * Собирает всё, что связано с жизненным циклом учреждения-партнёра: приглашение,
 * приём партнёрства (admin-side), генерация slug/promo/пароля ЛК, счётчики
 * заявок, триггеры уведомлений (5+ заявок → форма благодарностей, 10+ →
 * промокод), генерация сертификата PDF, скидка по промокоду.
 *
 * Все операции идемпотентны и логируются в partner_events.
 */
declare(strict_types=1);

if (!function_exists('cfgv')) require_once BASE_PATH . '/config.php';
if (!function_exists('db'))   require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/paylink.php';

/* ─────────────────────── МИГРАЦИЯ (ленивая, без ошибок) ─────────────────────── */

function partner_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    $stmts = [
        // institutions: партнёрские поля
        "ALTER TABLE institutions ADD COLUMN partner_slug TEXT DEFAULT ''",
        "ALTER TABLE institutions ADD COLUMN partner_status TEXT DEFAULT ''",
        "ALTER TABLE institutions ADD COLUMN partner_accepted_at TEXT DEFAULT ''",
        "ALTER TABLE institutions ADD COLUMN partner_declined_at TEXT DEFAULT ''",
        "ALTER TABLE institutions ADD COLUMN partner_no TEXT DEFAULT ''",
        "ALTER TABLE institutions ADD COLUMN partner_pass_hash TEXT DEFAULT ''",
        "ALTER TABLE institutions ADD COLUMN partner_pass_shown INTEGER DEFAULT 0",
        "ALTER TABLE institutions ADD COLUMN partner_promo_code TEXT DEFAULT ''",
        "ALTER TABLE institutions ADD COLUMN partner_promo_uses INTEGER DEFAULT 0",
        "ALTER TABLE institutions ADD COLUMN partner_promo_max INTEGER DEFAULT 10",
        "ALTER TABLE institutions ADD COLUMN partner_promo_activated_at TEXT DEFAULT ''",
        "ALTER TABLE institutions ADD COLUMN partner_priority_days INTEGER DEFAULT 4",
        "ALTER TABLE institutions ADD COLUMN partner_thanks_manager_used INTEGER DEFAULT 0",
        "ALTER TABLE institutions ADD COLUMN partner_apps_count INTEGER DEFAULT 0",
        "ALTER TABLE institutions ADD COLUMN partner_apps_paid INTEGER DEFAULT 0",
        "ALTER TABLE institutions ADD COLUMN partner_notified_5 INTEGER DEFAULT 0",
        "ALTER TABLE institutions ADD COLUMN partner_notified_10 INTEGER DEFAULT 0",
        "ALTER TABLE institutions ADD COLUMN partner_last_login TEXT DEFAULT ''",
        // applications: FK на institutions
        "ALTER TABLE applications ADD COLUMN institution_id INTEGER DEFAULT 0",
    ];
    foreach ($stmts as $sql) { try { db()->exec($sql); } catch (\Throwable $e) {} }

    // Индексы и таблицы — CREATE IF NOT EXISTS сами по себе идемпотентны.
    try { db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_inst_partner_slug  ON institutions(partner_slug)  WHERE partner_slug<>''"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_inst_partner_promo ON institutions(partner_promo_code) WHERE partner_promo_code<>''"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_inst_partner_status ON institutions(partner_status)"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_app_institution_id ON applications(institution_id)"); } catch (\Throwable $e) {}

    try { db()->exec("CREATE TABLE IF NOT EXISTS partner_thanks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        institution_id INTEGER NOT NULL, role TEXT NOT NULL, fio TEXT NOT NULL,
        doc_number TEXT UNIQUE, doc_path TEXT DEFAULT '',
        status TEXT DEFAULT 'queued',
        requested_at TEXT DEFAULT (datetime('now','localtime')),
        scheduled_send_at TEXT DEFAULT '', sent_at TEXT DEFAULT '',
        error TEXT DEFAULT '')"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_pth_inst_fio ON partner_thanks(institution_id, LOWER(fio))"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_pth_status ON partner_thanks(status)"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_pth_inst   ON partner_thanks(institution_id)"); } catch (\Throwable $e) {}

    // КТО И ПО КАКОЙ ЗАЯВКЕ ПОТРАТИЛ ПАРТНЁРСКОЕ ИСПОЛЬЗОВАНИЕ.
    // Счётчик partner_promo_uses говорит «сколько», но не «кто», и по нему нельзя
    // ни отличить повторное применение тем же человеком, ни вернуть использование
    // отклонённой заявке. Десять использований на учреждение это мало, и терять их
    // на один и тот же адрес нельзя.
    try { db()->exec("CREATE TABLE IF NOT EXISTS partner_promo_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        institution_id INTEGER NOT NULL,
        application_id INTEGER DEFAULT 0,
        email TEXT DEFAULT '',
        status TEXT DEFAULT 'used',          -- used | released
        created_at TEXT DEFAULT (datetime('now','localtime')))"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_ppl_inst_mail ON partner_promo_log(institution_id, email)"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_ppl_app ON partner_promo_log(application_id)"); } catch (\Throwable $e) {}

    try { db()->exec("CREATE TABLE IF NOT EXISTS partner_docs (
        number TEXT PRIMARY KEY, kind TEXT NOT NULL, institution_id INTEGER NOT NULL,
        org TEXT DEFAULT '', region TEXT DEFAULT '', fio TEXT DEFAULT '',
        issued_at TEXT DEFAULT (datetime('now','localtime')),
        valid_until TEXT DEFAULT '', revoked_at TEXT DEFAULT '')"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_pdoc_inst ON partner_docs(institution_id)"); } catch (\Throwable $e) {}

    try { db()->exec("CREATE TABLE IF NOT EXISTS partner_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT, institution_id INTEGER NOT NULL,
        kind TEXT NOT NULL, payload TEXT DEFAULT '',
        fired_at TEXT DEFAULT (datetime('now','localtime')))"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_pev_inst ON partner_events(institution_id)"); } catch (\Throwable $e) {}
}

/* ─────────────────────── УТИЛИТЫ ─────────────────────── */

/** Транслитерация ФИ учреждения в URL-slug для /p/<slug>. */
function partner_slugify(string $s): string {
    $s = mb_strtolower(trim($s));
    $map = ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z',
        'и'=>'i','й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r',
        'с'=>'s','т'=>'t','у'=>'u','ф'=>'f','х'=>'h','ц'=>'c','ч'=>'ch','ш'=>'sh','щ'=>'sch',
        'ъ'=>'','ы'=>'y','ь'=>'','э'=>'e','ю'=>'yu','я'=>'ya','«'=>'','»'=>'','„'=>'','"'=>'',
        '№'=>'n', ' '=>'-', "\t"=>'-'];
    $s = strtr($s, $map);
    $s = preg_replace('~[^a-z0-9-]+~', '-', $s);
    $s = preg_replace('~-{2,}~', '-', trim((string)$s, '-'));
    return substr((string)$s, 0, 60);
}

/** Уникальный slug: если занят — добавляет короткий суффикс. */
function partner_unique_slug(int $instId, string $base): string {
    $base = $base !== '' ? $base : ('org-' . $instId);
    $slug = $base;
    for ($i = 0; $i < 20; $i++) {
        try {
            $exists = one("SELECT id FROM institutions WHERE partner_slug=? AND id<>?", [$slug, $instId]);
            if (!$exists) return $slug;
        } catch (\Throwable $e) { return $slug; }
        $slug = $base . '-' . substr(bin2hex(random_bytes(3)), 0, 4);
    }
    return $base . '-' . bin2hex(random_bytes(4));
}

/** Следующий свободный номер партнёрства «ИП-YYYY-NNNNN». */
function partner_next_no(?int $ts = null): string {
    partner_migrate();
    $ts = $ts ?: time();
    $year = (int) date('Y', $ts);
    $prefix = 'ИП-' . $year . '-';
    /* ДЛИНУ ПРЕФИКСА СЧИТАЕМ В СИМВОЛАХ, А НЕ В БАЙТАХ.
     *
     * SUBSTR у SQLite отрезает по символам, а strlen считает байты: у «ИП-2026-»
     * это 10 против 8, потому что две кириллические буквы занимают по два байта.
     * Срез уходил на два знака вправо, из «ИП-2026-00001» получалось «001», и
     * максимумом всегда выходило 999 — следующий номер навсегда застревал на
     * 01000. Один и тот же номер получили 37 944 учреждения, включая всех
     * шестнадцать действующих партнёров: их сертификаты неотличимы друг от
     * друга, а реестр по номеру ничего не находит. */
    try {
        $max = (int) (scalar("SELECT COALESCE(MAX(CAST(SUBSTR(partner_no, ?) AS INTEGER)), 0)
                              FROM institutions WHERE partner_no LIKE ?",
                              [mb_strlen($prefix) + 1, $prefix . '%']) ?? 0);
    } catch (\Throwable $e) { $max = 0; }
    // Номер обязан быть свободным. UNIQUE на partner_no нет, и молчаливый дубль
    // уже стоил шестнадцати партнёрам одинакового сертификата — проверяем явно.
    $n = $max + 1;
    for ($i = 0; $i < 200; $i++) {
        $no = sprintf('%s%05d', $prefix, $n);
        try { $busy = one("SELECT id FROM institutions WHERE partner_no=?", [$no]); }
        catch (\Throwable $e) { return $no; }
        if (!$busy) return $no;
        $n++;
    }
    return sprintf('%s%05d-%s', $prefix, $n, date('dHis'));
}

/** Уникальный промокод «PART-YYYY-XXXX». */
function partner_gen_promo(int $year): string {
    partner_migrate();
    for ($i = 0; $i < 20; $i++) {
        $code = 'PART-' . $year . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 4));
        try {
            $exists = one("SELECT id FROM institutions WHERE partner_promo_code=?", [$code]);
            if (!$exists) return $code;
        } catch (\Throwable $e) { return $code; }
    }
    return 'PART-' . $year . '-' . strtoupper(bin2hex(random_bytes(3)));
}

/** Случайный пароль ЛК партнёра (8 символов, читаемые). */
function partner_gen_password(): string {
    $abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без I/O/0/1
    $out = '';
    for ($i = 0; $i < 8; $i++) $out .= $abc[random_int(0, strlen($abc) - 1)];
    return $out;
}

/** HMAC-подпись документа (тот же алгоритм, что и на странице проверки подлинности). */
function partner_sign(string $number): string {
    return substr(hash_hmac('sha256', 'partner-doc:' . $number, pay_secret()), 0, 16);
}

/** URL проверки подлинности для QR. */
function partner_verify_url(string $number): string {
    return rtrim((string) cfgv('base_url', ''), '/')
        . '/verify-doc.php?n=' . rawurlencode($number)
        . '&s=' . partner_sign($number);
}

/**
 * Подпись ссылки «стать партнёром» для конкретного учреждения.
 *
 * Согласие партнёра до сих пор принималось только ответным письмом: учреждение
 * должно было написать «согласны», письмо попадало в разбор входящих, и лишь
 * потом включалась вся цепочка. На 7 849 отправленных приглашений это дало ноль
 * партнёрств — не потому, что учреждения против, а потому что отвечать на письмо
 * долго и некому. Ссылка с подписью убирает этот шаг: одно нажатие в письме, и
 * учреждение уже в программе.
 *
 * Подпись привязана к id учреждения и к секрету сайта, поэтому подобрать чужую
 * ссылку нельзя, а старое письмо продолжает работать.
 */
function partner_join_sign(int $instId): string {
    return substr(hash_hmac('sha256', 'partner-join:' . $instId, pay_secret()), 0, 20);
}

/** Ссылка «стать партнёром» для письма-приглашения. */
function partner_join_url(int $instId): string {
    return rtrim((string) cfgv('base_url', ''), '/')
        . '/partner-join?i=' . $instId . '&s=' . partner_join_sign($instId);
}

/** Проверить ссылку и вернуть учреждение (или null, если подпись чужая). */
function partner_join_check(int $instId, string $sig): ?array {
    if ($instId <= 0 || $sig === '') return null;
    if (!hash_equals(partner_join_sign($instId), $sig)) return null;
    $inst = one("SELECT * FROM institutions WHERE id=?", [$instId]) ?: null;
    if (!$inst) return null;

    // КТО ПРОСИЛ БОЛЬШЕ НЕ ПИСАТЬ, ТОГО НЕ ЗАПИСЫВАЕМ В ПАРТНЁРЫ ПО СТАРОЙ ССЫЛКЕ.
    //
    // Ссылка живёт в письме вечно, а учреждение за это время могло отписаться,
    // попасть в исключённые или быть заблокированным. Приём партнёрства по такой
    // ссылке возвращал бы адрес обратно в переписку и в рассылку — ровно против
    // того, о чём человек попросил.
    $st = mb_strtolower(trim((string) ($inst['status'] ?? '')));
    if (in_array($st, ['unsubscribed', 'excluded', 'banned'], true)) return null;
    if (mb_strtolower(trim((string) ($inst['partner_status'] ?? ''))) === 'blocked') return null;

    return $inst;
}

/* ─────────────────────── ЖИЗНЕННЫЙ ЦИКЛ ─────────────────────── */

/**
 * Приём партнёрства (одно нажатие кнопки в админке).
 *
 * Генерирует slug, номер, промокод, пароль ЛК, регистрирует сертификат
 * в реестре partner_docs, ставит статус accepted. Идемпотентна: повторный
 * вызов на уже принятой институции возвращает существующие данные.
 *
 * Возвращает: ['inst'=>row, 'password_plain'=>'ABCD...' или '' если уже был]
 */
function partner_accept(int $instId): array {
    partner_migrate();
    $inst = one("SELECT * FROM institutions WHERE id=?", [$instId]);
    if (!$inst) throw new \RuntimeException('institution not found');

    // Уже принят — возвращаем текущее состояние, пароль скрываем (только hash).
    if (($inst['partner_status'] ?? '') === 'accepted' && !empty($inst['partner_no'])) {
        return ['inst' => $inst, 'password_plain' => ''];
    }

    $slugBase = partner_slugify((string) ($inst['name'] ?? ''));
    $slug     = partner_unique_slug($instId, $slugBase);
    $no       = partner_next_no();
    $promo    = partner_gen_promo((int) date('Y'));
    $passPlain = partner_gen_password();
    $passHash  = password_hash($passPlain, PASSWORD_DEFAULT);

    $upd = [
        'partner_slug'         => $slug,
        'partner_status'       => 'accepted',
        'partner_accepted_at'  => date('Y-m-d H:i:s'),
        'partner_no'           => $no,
        'partner_pass_hash'    => $passHash,
        'partner_pass_shown'   => 0,
        'partner_promo_code'   => $promo,
        'partner_promo_uses'   => 0,
        'partner_promo_max'    => 10,
        'partner_priority_days'=> 4,
    ];
    q("UPDATE institutions SET partner_slug=?, partner_status=?, partner_accepted_at=?,
         partner_no=?, partner_pass_hash=?, partner_pass_shown=?, partner_promo_code=?,
         partner_promo_uses=?, partner_promo_max=?, partner_priority_days=?
         WHERE id=?",
        [$slug, 'accepted', $upd['partner_accepted_at'], $no, $passHash, 0, $promo, 0, 10, 4, $instId]);

    // Регистрация сертификата в реестре
    try {
        q("INSERT OR REPLACE INTO partner_docs (number, kind, institution_id, org, region, fio, issued_at, valid_until)
           VALUES (?, 'cert', ?, ?, ?, '', ?, ?)",
           [$no, $instId, (string)$inst['name'], (string)$inst['region'],
            date('Y-m-d H:i:s'), date('Y-m-d H:i:s', strtotime('+1 year'))]);
    } catch (\Throwable $e) {}

    partner_log_event($instId, 'accepted', json_encode(['no' => $no, 'slug' => $slug], JSON_UNESCAPED_UNICODE));

    $inst = one("SELECT * FROM institutions WHERE id=?", [$instId]);
    return ['inst' => $inst, 'password_plain' => $passPlain];
}

/**
 * ЗАРАНЕЕ ПОДГОТОВЛЕННЫЙ ПАРТНЁРСКИЙ АККАУНТ.
 *
 * Правило владельца: аккаунт учреждения существует ДО того, как ему уходит
 * письмо. Тогда в самом письме уже есть постоянная ссылка учреждения, логин и
 * пароль от кабинета, а согласие сводится к одному нажатию — не нужно ждать,
 * пока оргкомитет что-то выдаст руками.
 *
 * От partner_accept отличается одним: статус НЕ становится «accepted».
 * Учреждение ещё не согласилось, оно просто заведено. Согласие ставит
 * partner_accept, и он же выдаёт сертификат в реестр.
 *
 * Идемпотентна: у кого аккаунт уже есть, ничего не трогает и пароль не меняет.
 * Возвращает ['inst'=>row, 'password_plain'=>'…'|''].
 */
function partner_prepare(int $instId): array {
    partner_migrate();
    $inst = one("SELECT * FROM institutions WHERE id=?", [$instId]);
    if (!$inst) throw new \RuntimeException('institution not found');

    if (trim((string) ($inst['partner_slug'] ?? '')) !== '' && !empty($inst['partner_no'])) {
        return ['inst' => $inst, 'password_plain' => ''];
    }

    $slug      = partner_unique_slug($instId, partner_slugify((string) ($inst['name'] ?? '')));
    $no        = partner_next_no();
    $promo     = partner_gen_promo((int) date('Y'));
    $passPlain = partner_gen_password();

    q("UPDATE institutions SET partner_slug=?, partner_no=?, partner_pass_hash=?,
             partner_pass_shown=0, partner_promo_code=?, partner_promo_uses=0,
             partner_promo_max=10, partner_priority_days=4
         WHERE id=?",
      [$slug, $no, password_hash($passPlain, PASSWORD_DEFAULT), $promo, $instId]);

    return ['inst' => one("SELECT * FROM institutions WHERE id=?", [$instId]),
            'password_plain' => $passPlain];
}

/** Отказ от партнёрства (админ-side). */
function partner_decline(int $instId, string $reason = ''): void {
    partner_migrate();
    q("UPDATE institutions SET partner_status='declined', partner_declined_at=? WHERE id=?",
      [date('Y-m-d H:i:s'), $instId]);
    partner_log_event($instId, 'declined', json_encode(['reason' => $reason], JSON_UNESCAPED_UNICODE));
}

/** Блокировка партнёра (например, злоупотребление). */
function partner_block(int $instId, string $reason = ''): void {
    partner_migrate();
    q("UPDATE institutions SET partner_status='blocked' WHERE id=?", [$instId]);
    partner_log_event($instId, 'blocked', json_encode(['reason' => $reason], JSON_UNESCAPED_UNICODE));
}

/** Разблокировка. */
function partner_unblock(int $instId): void {
    partner_migrate();
    q("UPDATE institutions SET partner_status='accepted' WHERE id=?", [$instId]);
    partner_log_event($instId, 'unblocked', '');
}

/** Сброс пароля ЛК партнёра. Возвращает новый plain-пароль. */
function partner_reset_password(int $instId): string {
    partner_migrate();
    $pass = partner_gen_password();
    q("UPDATE institutions SET partner_pass_hash=?, partner_pass_shown=0 WHERE id=?",
      [password_hash($pass, PASSWORD_DEFAULT), $instId]);
    partner_log_event($instId, 'password_reset', '');
    return $pass;
}

/**
 * ПИСЬМО «ВЫ ПРИНЯТЫ В ПАРТНЁРЫ» — сертификат и доступ в кабинет.
 *
 * Без него вся цепочка обрывалась на самом важном месте. partner_accept()
 * заводит номер, промокод и пароль, но пароль существует в открытом виде ровно
 * один раз — в её ответе. Автоприём по письму этот ответ выбрасывал, пароль
 * оставался только хешем, и учреждение, согласившееся на партнёрство, не
 * получало ни сертификата, ни доступа: формально партнёр, фактически ничего.
 *
 * Отправляем один раз. Отметка — событие welcome_sent в partner_events, поэтому
 * повторный вызов (второе письмо о согласии, повторное нажатие в админке)
 * ничего не дублирует.
 *
 * @param string $passPlain пароль из partner_accept(); пусто — выпишем новый,
 *                          но только если прежний ещё ни разу не показывали.
 */
function partner_send_welcome(int $instId, string $passPlain = ''): bool {
    partner_migrate();
    $inst = one("SELECT * FROM institutions WHERE id=?", [$instId]);
    if (!$inst || (string) ($inst['partner_status'] ?? '') !== 'accepted') return false;
    $email = trim((string) ($inst['email'] ?? ''));
    if ($email === '') return false;

    try {
        $was = one("SELECT id FROM partner_events WHERE institution_id=? AND kind='welcome_sent'", [$instId]);
        if ($was) return true;
    } catch (\Throwable $e) {}

    // Пароль. Если вызывающий его не передал, а партнёру доступ ещё не
    // показывали — выписываем новый. Если показывали, доступ у него уже есть,
    // и менять пароль письмом нельзя: сломаем рабочий вход.
    if ($passPlain === '' && (int) ($inst['partner_pass_shown'] ?? 0) === 0) {
        $passPlain = partner_reset_password($instId);
    }

    $cert = null;
    try {
        if (!function_exists('partner_cert_pdf')) require_once BASE_PATH . '/core/partner_docs.php';
        $cert = partner_cert_pdf($instId);
    } catch (\Throwable $e) { $cert = null; }

    $base = rtrim((string) cfgv('base_url', ''), '/');
    $link = $base . '/p/' . rawurlencode((string) $inst['partner_slug']);
    $no   = (string) $inst['partner_no'];
    // Проверка подлинности, контакты и регистрационные данные: партнёр показывает
    // сертификат в аттестационном портфолио, и там спрашивают, чем он подтверждён.
    $verify  = partner_verify_url($no);
    $phone   = (string) cfgv('org_phone', '');
    $orgMail = (string) cfgv('org_email', '');
    $reg     = (string) cfgv('org_reg', '');

    $access = $passPlain === '' ? '' :
        '<div style="background:#FDF6E2;border:1px solid #E9CE84;border-radius:8px;padding:16px 20px;margin:16px 0">
         <div style="font-size:13px;color:#7A5A12;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Кабинет партнёра</div>
         <div>Адрес: <a href="' . $base . '/partner?a=login">' . h($base) . '/partner</a></div>
         <div>Логин: <b>' . h($email) . '</b></div>
         <div>Пароль: <b style="font-family:monospace;font-size:17px">' . h($passPlain) . '</b></div>
         <div style="font-size:12px;color:#7A5A12;margin-top:8px">Пароль высылается один раз, сменить его можно в кабинете.</div>
         </div>';

    $body = '<div style="font:15px Arial,sans-serif;line-height:1.65;max-width:640px;padding:24px;color:#2A1E06">
<div style="text-align:center;margin-bottom:16px"><img src="' . $base . '/assets/img/logo_muzmir_256.png" width="70" alt=""></div>
<h2 style="color:#8A6512;font-family:Georgia,serif;margin:0 0 6px;text-align:center">' . h((string) $inst['name']) . ' — информационный партнёр</h2>
<p style="text-align:center;color:#666;margin:0 0 22px">Партнёрство № ' . h($no) . '</p>
<p>Уважаемые коллеги!</p>
<p>Благодарим за согласие на сотрудничество. Культурный центр «Музыкальный Мир» подтверждает статус информационного партнёра для <b>' . h((string) $inst['name']) . '</b>.'
. ($cert ? ' Сертификат партнёра — в приложении к письму.' : '') . '</p>
<p style="font-size:14px;color:#555">Подлинность сертификата можно проверить в любой момент по QR-коду на бланке или по ссылке:<br>
<a href="' . h($verify) . '">' . h($verify) . '</a></p>'
. $access .
'<p><b>Персональная ссылка учреждения:</b><br><a href="' . $link . '">' . h($link) . '</a></p>
<p style="font-size:14px;color:#555">Заявки, поданные по этой ссылке, засчитываются учреждению автоматически — отдельно ничего указывать не нужно.</p>
<div style="background:#F7F4EC;border-radius:8px;padding:16px 20px;margin:16px 0">
<div style="font-weight:700;margin-bottom:8px">Что даёт партнёрство</div>
<ul style="margin:0;padding-left:22px">
<li>с 5 заявок — бесплатные благодарственные письма Оргкомитета руководству и педагогам;</li>
<li>с 10 заявок — именной промокод на скидку 10% для участников учреждения;</li>
<li>ускоренная выдача дипломов участникам учреждения;</li>
<li>кабинет партнёра: заявки, статистика, заказ благодарностей.</li>
</ul></div>
<p style="margin-top:22px">С уважением,<br>Оргкомитет Культурного центра «Музыкальный Мир»<br>
' . h($phone) . ' · ' . h($orgMail) . '</p>
<hr style="border:none;border-top:1px solid #E9CE84;margin:24px 0 12px">
<p style="font-size:11px;color:#999;text-align:center">' . h($reg) . '</p>
</div>';

    $opts = ['pool' => 'awards'];
    if ($cert && is_file($cert)) $opts['attach'] = [$cert];
    if (!function_exists('mail_send_failover')) require_once BASE_PATH . '/core/mailer.php';

    $ok = (bool) mail_send_failover($email,
        'Сертификат информационного партнёра № ' . $no . ' и доступ в кабинет',
        $body, $opts);

    if ($ok) {
        try { q("UPDATE institutions SET partner_pass_shown=1 WHERE id=?", [$instId]); } catch (\Throwable $e) {}
        partner_log_event($instId, 'welcome_sent', json_encode(
            ['no' => $no, 'cert' => $cert ? basename($cert) : '', 'access' => $passPlain !== ''],
            JSON_UNESCAPED_UNICODE));
    } else {
        partner_log_event($instId, 'welcome_failed', function_exists('mail_last_error') ? mail_last_error() : '');
    }
    return $ok;
}

/** Лог события. */
function partner_log_event(int $instId, string $kind, string $payload = ''): void {
    try { q("INSERT INTO partner_events (institution_id, kind, payload) VALUES (?,?,?)",
             [$instId, $kind, $payload]); } catch (\Throwable $e) {}
}

/* ─────────────────────── ПОИСК И СТАТИСТИКА ─────────────────────── */

/** Партнёр по slug (для /p/<slug>). Только активные (accepted). */
/**
 * Учреждение по постоянной ссылке /p/<slug>.
 *
 * ССЫЛКА РАБОТАЕТ ДО ПОДТВЕРЖДЕНИЯ ПАРТНЁРСТВА. Раньше сюда пускало только
 * учреждение со статусом accepted, а ссылка стоит в письме-приглашении рядом с
 * кнопкой «Подать заявку»: педагог нажимал её и попадал на главную страницу
 * вместо формы. То есть письмо звало участвовать и тут же теряло человека.
 *
 * Заявка, поданная до подтверждения, тоже засчитывается учреждению: именно
 * растущий счётчик и есть лучший довод подтвердить партнёрство. Не пускаем
 * только тех, кому центр больше не пишет: отписавшихся, исключённых, закрытых.
 */
function partner_by_slug(string $slug): ?array {
    partner_migrate();
    if ($slug === '') return null;
    try {
        return one("SELECT * FROM institutions
                     WHERE partner_slug=?
                       AND COALESCE(status,'') NOT IN ('excluded','unsubscribed','banned')
                     LIMIT 1", [$slug]) ?: null;
    } catch (\Throwable $e) { return null; }
}

/** Партнёр по email (для логина в ЛК). */
function partner_by_email(string $email): ?array {
    partner_migrate();
    $email = mb_strtolower(trim($email));
    if ($email === '') return null;
    try {
        return one("SELECT * FROM institutions WHERE LOWER(email)=? AND partner_status='accepted' LIMIT 1", [$email])
            ?: null;
    } catch (\Throwable $e) { return null; }
}

/** Скидка партнёрского промокода, %. Ровно столько обещано в письме и в кабинете. */
const PARTNER_PROMO_PCT = 10;

/** Партнёрский код в каноническом виде: только латиница и цифры, верхний регистр. */
function partner_promo_norm(string $code): string {
    return (string) preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($code)));
}

/** Партнёр по промокоду (для применения скидки). */
function partner_by_promo(string $code): ?array {
    partner_migrate();
    $code = strtoupper(trim($code));
    if ($code === '') return null;
    try {
        return one("SELECT * FROM institutions WHERE UPPER(partner_promo_code)=?
                    AND partner_status='accepted' AND partner_promo_uses<partner_promo_max LIMIT 1", [$code])
            ?: null;
    } catch (\Throwable $e) { return null; }
}

/**
 * ПРОВЕРКА ПАРТНЁРСКОГО ПРОМОКОДА БЕЗ СПИСАНИЯ.
 *
 * Партнёрский код вводится в то же поле «Промокод», что и реферальный, а
 * реферальный поиск чистит строку от дефисов (referral_lookup). Из-за этого
 * PART-2026-XXXX не находился никогда: письмо о десяти заявках и кабинет
 * обещали скидку, а форма заявки её не давала. Сравниваем по нормализованному
 * виду, чтобы код срабатывал и с дефисами, и без них, в любом регистре.
 *
 * Отдельно от partner_apply_promo, потому что решение «тратить код или нет»
 * принимается по цене: участнику с клубной скидкой партнёрская не нужна, и
 * сжигать ради неё одно из десяти использований учреждения нельзя.
 *
 * @return array{0:?array,1:string} учреждение (или null) и причина отказа
 */
function partner_promo_check(string $code): array {
    partner_migrate();
    $norm = partner_promo_norm($code);
    if ($norm === '') return [null, ''];
    try {
        $p = one("SELECT * FROM institutions
                   WHERE partner_promo_code<>''
                     AND REPLACE(REPLACE(UPPER(partner_promo_code),'-',''),' ','')=?
                   LIMIT 1", [$norm]);
    } catch (\Throwable $e) { $p = null; }
    // Код не партнёрский — молча отдаём его реферальной ветке.
    if (!$p) return [null, ''];
    if ((string) ($p['partner_status'] ?? '') !== 'accepted') {
        return [null, 'Партнёрский промокод больше не действует.'];
    }
    // Код обещан «с 10 заявок». До активации он не работает, даже если утёк раньше.
    if (trim((string) ($p['partner_promo_activated_at'] ?? '')) === ''
        && (int) ($p['partner_apps_count'] ?? 0) < 10) {
        return [null, 'Партнёрский промокод учреждения ещё не активирован.'];
    }
    if ((int) ($p['partner_promo_uses'] ?? 0) >= (int) ($p['partner_promo_max'] ?? 10)) {
        return [null, 'Партнёрский промокод исчерпал лимит использований.'];
    }
    return [$p, ''];
}

/** Пересчёт счётчиков заявок партнёра (лёгкий, для крон-триггеров). */
function partner_refresh_counts(int $instId): array {
    partner_migrate();
    try {
        $r = one("SELECT COUNT(*) c, SUM(CASE WHEN is_paid=1 THEN 1 ELSE 0 END) p
                   FROM applications WHERE institution_id=?", [$instId])
             ?: ['c' => 0, 'p' => 0];
    } catch (\Throwable $e) { $r = ['c' => 0, 'p' => 0]; }
    $cnt = (int) ($r['c'] ?? 0);
    $paid = (int) ($r['p'] ?? 0);
    try { q("UPDATE institutions SET partner_apps_count=?, partner_apps_paid=? WHERE id=?",
            [$cnt, $paid, $instId]); } catch (\Throwable $e) {}
    return ['count' => $cnt, 'paid' => $paid];
}

/** Развёрнутая статистика партнёра для ЛК. */
function partner_stats(int $instId): array {
    partner_migrate();
    $counts = partner_refresh_counts($instId);
    $thanks = 0;
    try { $thanks = (int) (scalar("SELECT COUNT(*) FROM partner_thanks WHERE institution_id=? AND status='sent'", [$instId]) ?? 0); } catch (\Throwable $e) {}
    $inst = one("SELECT * FROM institutions WHERE id=?", [$instId]);
    return [
        'apps_total'      => $counts['count'],
        'apps_paid'       => $counts['paid'],
        'thanks_issued'   => $thanks,
        'promo_uses'      => (int) ($inst['partner_promo_uses'] ?? 0),
        'promo_max'       => (int) ($inst['partner_promo_max'] ?? 10),
        'to_thanks'       => max(0, 5  - $counts['count']),   // до открытия формы благодарностей
        'to_promo'        => max(0, 10 - $counts['count']),   // до активации промокода
        'notified_5'      => (int) ($inst['partner_notified_5'] ?? 0),
        'notified_10'     => (int) ($inst['partner_notified_10'] ?? 0),
        'priority_days'   => (int) ($inst['partner_priority_days'] ?? 4),
    ];
}

/* ─────────────────────── СКИДКА ПРОМОКОДА ─────────────────────── */

/**
 * Применить промокод: проверить действителен, вернуть скидку в процентах и
 * зафиксировать использование (транзакционно). Возвращает false, если код не
 * подходит или лимит исчерпан.
 */
function partner_apply_promo(string $code, ?int $applicationId = null, string $email = ''): array|false {
    partner_migrate();
    $p = partner_by_promo($code);
    if (!$p) return false;
    $instId = (int) $p['id'];
    $uses   = (int) ($p['partner_promo_uses'] ?? 0);
    $max    = (int) ($p['partner_promo_max'] ?? 10);
    if ($uses >= $max) return false;
    // ОДИН УЧАСТНИК — ОДНО ИСПОЛЬЗОВАНИЕ. Иначе десять скидок учреждения выбирает
    // один человек, подав десять заявок подряд, а остальные педагоги школы уже
    // ничего не получают. У реферального кода такая же защита (referral_already_used).
    $email = mb_strtolower(trim($email));
    if ($email !== '') {
        try {
            $usedBefore = (int) (scalar("SELECT COUNT(*) FROM partner_promo_log
                                   WHERE institution_id=? AND email=? AND status='used'",
                                 [$instId, $email]) ?? 0);
            if ($usedBefore > 0) return false;
        } catch (\Throwable $e) {}
    }
    try {
        // Транзакционный инкремент: не даст «перескочить» лимит при гонке.
        // РЕЗУЛЬТАТ ОБЯЗАТЕЛЬНО ПРОВЕРЯЕМ. Условие в UPDATE стояло и раньше, но
        // никто не смотрел, сколько строк оно изменило: при одновременной подаче
        // двух заявок обе читали «использований 9», обе шли дальше, и одиннадцатая
        // скидка выдавалась как ни в чём не бывало.
        db()->beginTransaction();
        $st = q("UPDATE institutions SET partner_promo_uses=partner_promo_uses+1
                  WHERE id=? AND partner_promo_uses<partner_promo_max", [$instId]);
        $done = $st && $st->rowCount() > 0;
        if (!$done) { db()->rollBack(); return false; }
        db()->commit();
    } catch (\Throwable $e) {
        try { db()->rollBack(); } catch (\Throwable $e2) {}
        return false;
    }
    try {
        insert('partner_promo_log', ['institution_id' => $instId, 'application_id' => (int) ($applicationId ?? 0),
                                     'email' => $email, 'status' => 'used']);
    } catch (\Throwable $e) {}
    partner_log_event($instId, 'promo_used', json_encode(['app' => $applicationId, 'uses' => $uses + 1], JSON_UNESCAPED_UNICODE));
    return ['institution_id' => $instId, 'discount_pct' => PARTNER_PROMO_PCT,
            'promo_code' => $p['partner_promo_code'], 'uses_left' => $max - $uses - 1];
}

/**
 * ВЕРНУТЬ ИСПОЛЬЗОВАНИЕ ПРОМОКОДА ЗАЯВКЕ, КОТОРОЙ НЕ БУДЕТ.
 *
 * Заявку отклонили по положению, оргвзнос вернули — значит и партнёрское
 * использование должно вернуться учреждению: их всего десять, и списывать их за
 * несостоявшееся участие нечестно к остальным педагогам школы. Возврат
 * идемпотентен: повторный вызов по той же заявке ничего не меняет.
 *
 * @return bool было ли что возвращать
 */
function partner_release_promo(int $applicationId): bool {
    if ($applicationId <= 0) return false;
    partner_migrate();
    try {
        $row = one("SELECT id, institution_id FROM partner_promo_log
                     WHERE application_id=? AND status='used' ORDER BY id DESC LIMIT 1", [$applicationId]);
        if (!$row) return false;
        $instId = (int) $row['institution_id'];
        q("UPDATE partner_promo_log SET status='released' WHERE id=?", [(int) $row['id']]);
        q("UPDATE institutions SET partner_promo_uses=MAX(0, partner_promo_uses-1) WHERE id=?", [$instId]);
        partner_log_event($instId, 'promo_released',
            json_encode(['app' => $applicationId], JSON_UNESCAPED_UNICODE));
        return true;
    } catch (\Throwable $e) { return false; }
}

/* ─────────────────────── КАБИНЕТ (аутентификация) ─────────────────────── */

/** Проверить логин/пароль ЛК партнёра. Возвращает институцию или null. */
function partner_login(string $email, string $password): ?array {
    partner_migrate();
    $p = partner_by_email($email);
    if (!$p) return null;
    $hash = (string) ($p['partner_pass_hash'] ?? '');
    if ($hash === '' || !password_verify($password, $hash)) return null;
    try { q("UPDATE institutions SET partner_last_login=? WHERE id=?",
             [date('Y-m-d H:i:s'), (int) $p['id']]); } catch (\Throwable $e) {}
    return $p;
}

/** Текущий партнёр из сессии (или null, если не залогинен). */
function partner_current(): ?array {
    if (PHP_SAPI === 'cli') return null; // CLI-режим (крон, аудит) не имеет сессии
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $pid = (int) ($_SESSION['partner_id'] ?? 0);
    if ($pid <= 0) return null;
    partner_migrate();
    try {
        return one("SELECT * FROM institutions WHERE id=? AND partner_status='accepted'", [$pid])
            ?: null;
    } catch (\Throwable $e) { return null; }
}

function partner_login_session(int $instId): void {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $_SESSION['partner_id'] = $instId;
    session_regenerate_id(true);
}

function partner_logout_session(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    unset($_SESSION['partner_id']);
}

/* ─────────────────────── ПРИВЯЗКА ЗАЯВОК ─────────────────────── */

/** Cookie для персональной ссылки /p/<slug> (90 дней). */
const PARTNER_COOKIE = 'partner_inst';

function partner_set_cookie(int $instId): void {
    setcookie(PARTNER_COOKIE, (string) $instId, [
        'expires'  => time() + 90 * 86400,
        'path'     => '/',
        'secure'   => !empty($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    $_SESSION['partner_ref'] = $instId;
}

/** id учреждения-партнёра, к которому привязать текущую заявку (cookie ⇢ session). */
function partner_cookie_id(): int {
    $c = (int) ($_COOKIE[PARTNER_COOKIE] ?? 0);
    if ($c > 0) return $c;
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    return (int) ($_SESSION['partner_ref'] ?? 0);
}

/**
 * Присвоить заявке institution_id (при подаче заявки через /p/<slug>).
 * Также инкрементит счётчик — крон-триггер узнает о новом апдейте.
 */
function partner_attach_application(int $applicationId, int $instId): void {
    partner_migrate();
    if ($applicationId <= 0 || $instId <= 0) return;
    // Метка в cookie живёт 90 дней и переживает и отказ, и блокировку. Засчитывать
    // заявки тому, кто уже не партнёр, нельзя: он получил бы благодарности и
    // промокод по инерции.
    try {
        $st = (string) (scalar("SELECT partner_status FROM institutions WHERE id=?", [$instId]) ?? '');
        if ($st !== 'accepted') return;
    } catch (\Throwable $e) { return; }
    try {
        q("UPDATE applications SET institution_id=? WHERE id=? AND (institution_id IS NULL OR institution_id=0)",
          [$instId, $applicationId]);
    } catch (\Throwable $e) {}
    partner_refresh_counts($instId);
}
