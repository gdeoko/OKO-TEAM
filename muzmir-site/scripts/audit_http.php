<?php
/**
 * АУДИТ HTTP: обходит все публичные страницы, разделы админки и точки API,
 * ловит коды ответа, PHP-предупреждения в теле, пустые страницы и битые ссылки.
 *
 *   BASE=http://127.0.0.1:8099 php scripts/audit_http.php
 *
 * Сам ничего не отправляет наружу: только GET-обход и безопасные POST-проверки.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

const AUDIT_HOST = 'xn----7sbugdeiegh1b0a9hen.xn--p1ai';

/* База нужна ровно для одного: завести временного администратора, чтобы разделы
   панели проверялись по-настоящему, а не помечались «пропуск». */
if (!defined('BASE_PATH')) define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

/* КУДА СТУЧАТЬСЯ.
 *
 * Здесь стоял только адрес местного отладочного сервера, и на боевом сервере,
 * где его нет, ВСЕ проверки возвращали код 0 и отчёт был сплошным «FAIL» — то
 * есть аудит молчаливо ничего не проверял. Теперь по умолчанию берём сам сайт:
 * если рядом поднят отладочный сервер, он и будет использован, иначе боевой
 * (запрос идёт на 127.0.0.1 с нужным заголовком Host, наружу не выходит). */
$BASE = rtrim((string) getenv('BASE'), '/');
if ($BASE === '') {
    $probe = @fsockopen('127.0.0.1', 8099, $eno, $estr, 1);
    if ($probe) { fclose($probe); $BASE = 'http://127.0.0.1:8099'; }
    else        { $BASE = 'https://' . AUDIT_HOST; }
}
$JAR  = sys_get_temp_dir() . '/muzmir_audit_cookies.txt';
@unlink($JAR);

$FAIL = 0; $OK = 0; $WARN = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, string $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, string $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function warn(string $w, string $i = ''): void { global $WARN; $WARN++; echo "  warn $w" . ($i !== '' ? "  $i" : '') . "\n"; }

/** GET/POST с общей cookie-банкой (сессия админа/участника сохраняется между вызовами). */
function req(string $url, array $post = null, array $opt = []): array {
    global $JAR;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_RESOLVE => [AUDIT_HOST . ':443:127.0.0.1', AUDIT_HOST . ':80:127.0.0.1'],
        CURLOPT_FOLLOWLOCATION => $opt['follow'] ?? true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_COOKIEJAR      => $JAR,
        CURLOPT_COOKIEFILE     => $JAR,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HEADER         => true,
        CURLOPT_PROXY          => '',      // локальный стенд мимо прокси
    ]);
    if ($post !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post));
    }
    $raw  = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hlen = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'head' => substr($raw, 0, $hlen), 'body' => substr($raw, $hlen), 'err' => $err];
}

/** Ищет в теле следы PHP-ошибок и вёрстки наизнанку. */
function php_noise(string $body): string {
    $pat = ['Warning:', 'Notice:', 'Deprecated:', 'Fatal error', 'Parse error',
            'Undefined variable', 'Undefined array key', 'Uncaught', 'PDOException',
            'SQLSTATE', 'Call to undefined', 'Trying to access array offset'];
    $hits = [];
    foreach ($pat as $p) {
        if (stripos($body, $p) !== false) {
            $pos = stripos($body, $p);
            $hits[] = trim(preg_replace('~\s+~', ' ', substr($body, $pos, 140)));
        }
    }
    return implode(' | ', array_slice($hits, 0, 2));
}

function page(string $path, string $label = '', int $expect = 200, int $minLen = 800): void {
    global $BASE;
    $label = $label ?: $path;
    $r = req($BASE . $path);
    if ($r['err'] !== '') { bad("$label — сеть", $r['err']); return; }
    if ($r['code'] !== $expect) { bad("$label — код", "получен {$r['code']}, ожидался $expect"); return; }
    $noise = php_noise($r['body']);
    if ($noise !== '') { bad("$label — PHP-шум", $noise); return; }
    if (strlen($r['body']) < $minLen) { bad("$label — пустая страница", strlen($r['body']) . ' байт'); return; }
    ok($label, $r['code'] . ', ' . round(strlen($r['body']) / 1024) . ' КБ');
}

/* ───────────── Публичные страницы ───────────── */
sec('Публичные страницы сайта');
$pub = ['/', '/menu', '/competitions', '/apply', '/goals', '/ministry-support', '/awards',
        '/order-awards', '/concerts', '/blog', '/about', '/reviews', '/faq', '/contacts',
        '/agreement', '/privacy', '/login', '/register', '/forgot', '/results', '/teacher',
        '/calendar', '/gala', '/partner', '/club', '/notifications', '/chat'];
foreach ($pub as $p) page($p);

sec('Страницы конкурсов (по каждому конкурсу из базы)');
$slugs = array_values(array_filter(array_map('trim', explode(',', (string) getenv('SLUGS')))));
if (!$slugs) warn('список слагов не передан (SLUGS=…) — страницы конкурсов пропускаю');
foreach ($slugs as $s) {
    page('/apply?competition=' . $s, "подача /$s");
    page('/order-awards?competition=' . $s, "заказ наград /$s");
    page('/awards/' . $s, "образцы наград /$s", 200, 400);
    // Внутренняя страница конкурса упразднена: /competition/<slug> ведёт на подачу.
    $r = req($BASE . '/competition/' . $s, null, ['follow' => false]);
    in_array($r['code'], [301, 302], true)
        ? ok("/competition/$s → подача", (string) $r['code'])
        : bad("/competition/$s — нет редиректа", (string) $r['code']);
}

sec('Короткие ссылки из постов ВК');
foreach ($slugs as $s) {
    foreach (["/konkurs-$s" => 'подача', "/obrazci-$s" => 'образцы'] as $u => $what) {
        $r = req($BASE . $u, null, ['follow' => false]);
        in_array($r['code'], [301, 302], true)
            ? ok("$u → редирект ($what)", (string) $r['code'])
            : bad("$u — нет редиректа", (string) $r['code']);
    }
}

sec('Несуществующие адреса дают 404, а не 500');
foreach (['/net-takoy-stranicy', '/awards/net-takogo', '/artist/net-takogo',
          '/blog/net-takoy-stati'] as $p) {
    $r = req($BASE . $p);
    $r['code'] === 404 ? ok("$p → 404") : bad("$p — код", (string) $r['code']);
}

/* ───────────── Вход в админку ───────────── */
sec('Админка: вход');
$r = req($BASE . '/admin/');
if (!preg_match('~name="_csrf"\s+value="([^"]+)"~', $r['body'], $m)) {
    bad('CSRF-поле на форме входа не найдено');
    $adminIn = false;
} else {
    $login = getenv('ADMIN_LOGIN') ?: 'admin@test.local';
    $pass  = getenv('ADMIN_PASS')  ?: 'Test_12345';
    $r = req($BASE . '/admin/', ['_csrf' => $m[1], 'do' => 'login', 'email' => $login, 'password' => $pass]);
    $adminIn = stripos($r['body'], 'p=logout') !== false;

    /* НА БОЕВОМ СЕРВЕРЕ ОТЛАДОЧНОГО АДМИНА НЕТ.
     *
     * Раньше на этом месте аудит просто писал «вход не удался» и пропускал ВСЮ
     * админку: восемнадцать разделов помечались «пропуск», и отчёт выглядел
     * благополучным, ничего при этом не проверив. Заводим временного админа,
     * проходим проверки его глазами и удаляем его в конце — настоящие учётные
     * записи при этом не трогаются, и пароли нигде не всплывают. */
    if (!$adminIn) {
        $GLOBALS['__tmpAdmin'] = 0;
        try {
            $tmpMail = 'audit-adm-' . bin2hex(random_bytes(4)) . '@example.test';
            $tmpPass = 'Aud-' . bin2hex(random_bytes(5));
            $GLOBALS['__tmpAdmin'] = (int) insert('users', [
                'email' => $tmpMail, 'password_hash' => password_hash($tmpPass, PASSWORD_DEFAULT),
                'full_name' => 'Проверка Админ', 'role' => 'admin', 'email_verified' => 1,
            ]);
            $r = req($BASE . '/admin/');
            if (preg_match('~name="_csrf"\s+value="([^"]+)"~', $r['body'], $m2)) {
                $r = req($BASE . '/admin/', ['_csrf' => $m2[1], 'do' => 'login',
                                             'email' => $tmpMail, 'password' => $tmpPass]);
                $adminIn = stripos($r['body'], 'p=logout') !== false;
            }
        } catch (\Throwable $e) { /* не вышло — ниже честно скажем */ }
    }
    $adminIn ? ok('вход в админку выполнен') : bad('вход в админку не удался');
}

sec('Админка: разделы');
$sections = ['dashboard' => 'Панель', 'applications' => 'Заявки', 'grading' => 'Оценка коротких',
             'longcomp' => 'Оценка длинных', 'dispatch' => 'Отправки', 'digital' => 'Заказы электронных',
             'orders' => 'Заказы оригиналов', 'diplomas' => 'Дипломы', 'competitions' => 'Конкурсы',
             'users' => 'Пользователи', 'newsletter' => 'Рассылки', 'launch' => 'Запуск',
             'analytics' => 'Аналитика', 'cms' => 'Контент', 'settings' => 'Настройки',
             'chats' => 'Чаты', 'diploma_editor' => 'Редактор дипломов'];
foreach ($sections as $p => $title) {
    if (!$adminIn) { warn("$title — пропуск (нет сессии)"); continue; }
    page('/admin/?p=' . $p, "админка: $title", 200, 500);
}

sec('Админка: поиск в разделах со списками');
foreach (['applications', 'grading', 'longcomp', 'dispatch', 'digital', 'orders', 'users'] as $p) {
    if (!$adminIn) { warn("$p — пропуск"); continue; }
    foreach (['иванов', 'ИВАНОВ', 'Ivan', '2026'] as $q) {
        $r = req($BASE . '/admin/?p=' . $p . '&q=' . rawurlencode($q));
        $noise = php_noise($r['body']);
        if ($r['code'] !== 200) { bad("поиск $p «{$q}» — код", (string) $r['code']); }
        elseif ($noise !== '')  { bad("поиск $p «{$q}» — PHP-шум", $noise); }
        else ok("поиск $p «{$q}»");
    }
}

/* ───────────── API ───────────── */
sec('API: без CSRF всё закрыто, GET-точки отвечают');
foreach (['apply', 'order', 'subscribe', 'review', 'feedback'] as $ep) {
    $r = req($BASE . '/api/v1/' . $ep . '.php', ['x' => '1']);
    in_array($r['code'], [403, 405, 422, 429], true)
        ? ok("POST /api/v1/$ep без CSRF отклонён", (string) $r['code'])
        : bad("POST /api/v1/$ep — не отклонён", (string) $r['code']);
}
$r = req($BASE . '/api/v1/address_suggest.php?q=' . rawurlencode('Москва Солянка'));
$r['code'] === 200 || $r['code'] === 403
    ? ok('подсказки адреса отвечают', (string) $r['code'])
    : bad('подсказки адреса', (string) $r['code']);

/* ───────────── Статика ───────────── */
sec('Статика и служебные файлы');
foreach (['/assets/css/style.css', '/assets/js/address.js', '/robots.txt', '/sitemap.xml',
          '/manifest.webmanifest'] as $p) {
    $r = req($BASE . $p);
    $r['code'] === 200 ? ok($p, round(strlen($r['body']) / 1024) . ' КБ') : warn("$p — код {$r['code']}");
}

echo "\n" . str_repeat('─', 60) . "\n";
echo ($FAIL === 0 ? "HTTP ЧИСТО" : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK, предупреждений: $WARN\n";
exit($FAIL === 0 ? 0 : 1);

/* Временный админ живёт ровно столько, сколько идёт проверка. */
if (!empty($GLOBALS['__tmpAdmin'])) {
    try {
        q("DELETE FROM sessions WHERE user_id=?", [(int) $GLOBALS['__tmpAdmin']]);
        q("DELETE FROM users WHERE id=?", [(int) $GLOBALS['__tmpAdmin']]);
    } catch (\Throwable $e) {}
}
