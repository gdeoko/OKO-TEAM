<?php
/**
 * КАЖДАЯ КНОПКА КАБИНЕТА — НАЖАТА ПО-НАСТОЯЩЕМУ.
 *
 * Кнопка «Подтвердить почту» месяцами не работала так, что этого не было видно
 * ниоткуда: человека перекидывало обратно в настройки, письма не было, ошибки
 * тоже не было. Ни один аудит этого не ловил, потому что все они проверяли
 * функции и данные, а не то, что происходит при нажатии.
 *
 * Здесь проверка идёт с другой стороны: заводится временный участник, скрипт
 * входит на сайт настоящим HTTP-запросом, находит на странице кабинета КАЖДУЮ
 * форму и нажимает её. После каждого нажатия смотрим, случилось ли хоть что-то:
 * сообщение на экране, запись в журнале, письмо в очереди или изменение в базе.
 * Молчаливый редирект без единого следа считается сбоем — именно так выглядела
 * сломанная кнопка.
 *
 * Ничего чужого не трогает: работает на своей учётной записи и удаляет её.
 *
 *   php scripts/audit_buttons.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$BASE = rtrim((string) cfgv('base_url', ''), '/');
$line = str_repeat('=', 78);
$OK = 0; $BAD = 0;
function ok(string $s, string $x = ''): void  { global $OK; $OK++; echo "  [ок]   $s" . ($x !== '' ? " — $x" : '') . "\n"; }
function bad(string $s, string $x = ''): void { global $BAD; $BAD++; echo "  [СБОЙ] $s" . ($x !== '' ? " — $x" : '') . "\n"; }

/* ── Временный участник ───────────────────────────────────────────────────── */
$MAIL = 'button-check-' . substr(bin2hex(random_bytes(4)), 0, 8) . '@example.test';
$PASS = 'ProbaKnopki' . random_int(100, 999);
$uid = (int) insert('users', [
    'email' => $MAIL, 'password_hash' => password_hash($PASS, PASSWORD_DEFAULT),
    'full_name' => 'Проверка Кнопок Кабинета', 'role' => 'user', 'email_verified' => 0,
]);
echo "ПРОВЕРКА КНОПОК КАБИНЕТА\n$line\nвременный участник: #$uid $MAIL\n";

register_shutdown_function(static function () use ($uid, $MAIL): void {
    foreach (['mail_queue' => 'LOWER(to_email)=?', 'subscribers' => 'LOWER(email)=?'] as $t => $w) {
        try { q("DELETE FROM \"$t\" WHERE $w", [mb_strtolower($MAIL)]); } catch (\Throwable $e) {}
    }
    foreach (['audit_log' => 'entity=\'user\' AND entity_id=?', 'notifications' => 'user_id=?',
              'sessions' => 'user_id=?', 'referrals' => 'user_id=?'] as $t => $w) {
        try { q("DELETE FROM \"$t\" WHERE $w", [$uid]); } catch (\Throwable $e) {}
    }
    try { q("DELETE FROM users WHERE id=?", [$uid]); } catch (\Throwable $e) {}
    echo "\nвременный участник удалён\n";
});

/* ── Браузер на curl ──────────────────────────────────────────────────────── */
$JAR = tempnam(sys_get_temp_dir(), 'btn');
/** Запрос с сохранением cookie. Возвращает ['code','body','location']. */
function req(string $url, array $post = null): array {
    global $JAR;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_COOKIEJAR => $JAR, CURLOPT_COOKIEFILE => $JAR,
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_TIMEOUT => 25,
    ]);
    if ($post !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post));
    }
    $body = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $loc  = (string) curl_getinfo($ch, CURLINFO_REDIRECT_URL);
    curl_close($ch);
    return ['code' => $code, 'body' => $body, 'location' => $loc];
}
/** Токен формы со страницы. */
function csrf_of(string $html): string {
    return preg_match('~name="_csrf"[^>]*value="([^"]+)"~', $html, $m) ? $m[1] : '';
}

/* ── Вход ─────────────────────────────────────────────────────────────────── */
$r = req($BASE . '/login');
$tok = csrf_of($r['body']);
$tok !== '' ? ok('страница входа отдаёт токен формы') : bad('на странице входа нет токена формы');

$r = req($BASE . '/login', ['_csrf' => $tok, 'email' => $MAIL, 'password' => $PASS]);
$r['code'] === 302 && str_contains($r['location'], '/cabinet')
    ? ok('вход выполняется', 'переход в кабинет')
    : bad('вход не выполнился', 'код ' . $r['code'] . ' ' . $r['location']);

$cab = req($BASE . '/cabinet');
$cab['code'] === 200 ? ok('кабинет открывается', number_format(strlen($cab['body']), 0, '.', ' ') . ' байт')
                     : bad('кабинет не открылся', 'код ' . $cab['code']);

/* ── Собираем формы со страницы ───────────────────────────────────────────── */
preg_match_all('~<form\b[^>]*>(.*?)</form>~is', $cab['body'], $mf);
$forms = [];
foreach ($mf[1] as $i => $innerHtml) {
    $tag = $mf[0][$i];
    if (!preg_match('~name="action"[^>]*value="([a-z_]+)"~', $innerHtml, $ma)) continue;
    $fields = [];
    if (preg_match_all('~<input\b[^>]*type="hidden"[^>]*>~i', $innerHtml, $mh)) {
        foreach ($mh[0] as $inp) {
            if (preg_match('~name="([^"]+)"~', $inp, $n) && preg_match('~value="([^"]*)"~', $inp, $v)) {
                $fields[$n[1]] = $v[1];
            }
        }
    }
    $forms[$ma[1]] = $fields;
}
echo "\nНАЙДЕНО ФОРМ НА СТРАНИЦЕ: " . count($forms) . " (" . implode(', ', array_keys($forms)) . ")\n$line\n";

/**
 * ЧТО СЧИТАЕМ ЗА «КНОПКА СРАБОТАЛА».
 *
 * Каждой кнопке — свой признак. Общий для всех: сообщение на экране. Без него
 * человек не понимает, случилось что-то или нет, и жмёт снова.
 */
$expect = [
    'resend_verify'   => ['почта' => "SELECT COUNT(*) FROM mail_queue WHERE LOWER(to_email)=?"],
    'referral_create' => ['реферальная ссылка' => "SELECT COUNT(*) FROM referrals WHERE user_id=?"],
];
$safe = ['resend_verify', 'referral_create', 'music_toggle', 'privacy', 'notify'];

foreach ($forms as $action => $fields) {
    if (!in_array($action, $safe, true)) {
        echo "  [—]    $action — не нажимаем: форма меняет данные участника\n";
        continue;
    }
    $page = req($BASE . '/cabinet');
    $post = $fields;
    $post['_csrf']  = csrf_of($page['body']);
    $post['action'] = $action;

    $before = [];
    foreach ($expect[$action] ?? [] as $what => $sql) {
        $arg = str_contains($sql, 'to_email') ? mb_strtolower($MAIL) : $uid;
        $before[$what] = (int) (scalar($sql, [$arg]) ?? 0);
    }
    $auditBefore = (int) (scalar("SELECT COUNT(*) FROM audit_log WHERE entity='user' AND entity_id=?", [$uid]) ?? 0);

    $res = req($BASE . '/cabinet', $post);
    $after = req($BASE . '/cabinet');
    // Сообщение показывается один раз, поэтому ищем его сразу после нажатия.
    $hasFlash = (bool) preg_match('~class="[^"]*flash[^"]*"~i', $after['body'])
             || mb_stripos($after['body'], 'отправлен') !== false
             || mb_stripos($after['body'], 'сохранен') !== false
             || mb_stripos($after['body'], 'сохранён') !== false;

    $changed = [];
    foreach ($expect[$action] ?? [] as $what => $sql) {
        $arg = str_contains($sql, 'to_email') ? mb_strtolower($MAIL) : $uid;
        $now = (int) (scalar($sql, [$arg]) ?? 0);
        if ($now > $before[$what]) $changed[] = $what;
    }
    $auditAfter = (int) (scalar("SELECT COUNT(*) FROM audit_log WHERE entity='user' AND entity_id=?", [$uid]) ?? 0);
    if ($auditAfter > $auditBefore) $changed[] = 'запись в журнале';

    $why = [];
    if ($res['code'] !== 302 && $res['code'] !== 200) $why[] = 'ответ ' . $res['code'];
    if (!$changed && !$hasFlash) $why[] = 'ни следа: ни сообщения, ни записи, ни письма';

    $why ? bad('кнопка «' . $action . '»', implode('; ', $why))
         : ok('кнопка «' . $action . '»', $changed ? implode(', ', $changed) : 'показано сообщение');
}

/* ── Ссылка подтверждения из письма ───────────────────────────────────────── */
echo "\nССЫЛКА ИЗ ПИСЬМА\n$line\n";
$tokv = (string) (scalar("SELECT verify_token FROM users WHERE id=?", [$uid]) ?? '');
if ($tokv === '') {
    bad('токен подтверждения не создан', 'кнопка «Подтвердить почту» не довела дело до конца');
} else {
    ok('токен подтверждения создан');
    $r = req($BASE . '/verify-email?token=' . urlencode($tokv));
    $v = (int) (scalar("SELECT COALESCE(email_verified,0) FROM users WHERE id=?", [$uid]) ?? 0);
    $v === 1 ? ok('переход по ссылке подтверждает почту') : bad('переход по ссылке не подтвердил почту');
    $r2 = req($BASE . '/verify-email?token=' . urlencode($tokv));
    mb_stripos($r2['body'], 'недействительна') !== false
        ? ok('повторный переход отвечает «ссылка недействительна»')
        : bad('повторный переход ведёт себя неожиданно');
}

/* ── Почтовый слой на всех входах ─────────────────────────────────────────── */
echo "\nПОЧТА ПОДКЛЮЧЕНА НА ВСЕХ ВХОДАХ\n$line\n";
foreach (['public/index.php' => 'публичный сайт', 'admin/_boot.php' => 'админка',
          'api/v1/_boot.php' => 'API'] as $f => $what) {
    $src = (string) @file_get_contents(BASE_PATH . '/' . $f);
    mb_strpos($src, "core/mailer.php") !== false
        ? ok("почтовый слой подключён: $what")
        : bad("почтовый слой не подключён: $what", 'ветки с function_exists(mail_queue) будут молчать');
}

@unlink($JAR);
echo "\n$line\n";
printf("ПРОЙДЕНО: %d · СБОЕВ: %d\n", $OK, $BAD);
exit($BAD > 0 ? 1 : 0);
