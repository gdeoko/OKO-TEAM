<?php
/** Единая точка входа публичного сайта + фронт-контроллер. */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$CFG = require BASE_PATH . '/config.php';
$GLOBALS['CFG'] = $CFG;

require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/countdown.php';
require_once BASE_PATH . '/core/auth.php';
require_once BASE_PATH . '/core/security.php';

session_start();
db(); // инициализация/миграции

// Маршрут
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$base = parse_url($CFG['base_url'], PHP_URL_PATH) ?: '';
if ($base && $base !== '/' && str_starts_with($uri, $base)) $uri = substr($uri, strlen($base)) ?: '/';
$route = '/' . trim($uri, '/');
$route = $route === '' ? '/' : $route;

// Заголовки безопасности (CSP/HSTS/anti-clickjacking) — на все ответы, кроме встраиваемого виджета.
security_headers($route);

// REST API и админ-панель обслуживаются через фронт-контроллер
// (в проде nginx try_files отдаёт эти пути в index.php, т.к. web-root = public/).
if (preg_match('#^/api/v1/([a-z0-9_]+)(?:\.php)?$#', $route, $m)) {
    $f = BASE_PATH . '/api/v1/' . $m[1] . '.php';
    if (is_file($f)) { require $f; exit; }
    json_out(['ok' => false, 'error' => 'not_found'], 404);
}
if ($route === '/admin' || str_starts_with($route, '/admin/')) {
    $_GET['__route'] = $route;
    require BASE_PATH . '/admin/index.php';
    exit;
}

// Алиасы русских слагов старого сайта → 301 на канонические URL.
$aliases = [
    '/obrazci'     => '/awards',           // образцы наград
    '/oplata-sayt' => '/awards',     // оплата наградного материала
    '/voprosi'     => '/faq',              // справка/вопросы
    '/konkursi'    => '/competitions',     // список конкурсов
    '/podderjka'   => '/ministry-support', // поддержка Минкультуры
    '/comment'     => '/reviews',          // отзывы
    '/documents'   => '/competitions',     // положения конкурсов
    '/video'       => '/concerts',         // онлайн-концерты
    '/onas'        => '/about',            // о нас
    '/instrukciya' => '/awards',     // инструкция по заказу наград
    '/zadachi'     => '/goals',            // цели/задачи центра
    '/prays'       => '/awards',     // прайс наградного материала
    '/novosti'      => '/blog',            // Блог/Новости (русский слаг)
];
$aliases['/order-awards'] = '/awards';
if (isset($aliases[$route])) { header('Location: ' . url($aliases[$route]), true, 301); exit; }

// Короткие ссылки из постов ВК: /konkurs-<slug> -> подача, /obrazci-<slug> -> награды конкурса.
if (preg_match('#^/konkurs-([a-z0-9\-]+)$#', $route, $m)) {
    header('Location: ' . url('/apply?competition=' . rawurlencode($m[1])), true, 301); exit;
}
if (preg_match('#^/obrazci-([a-z0-9\-]+)$#', $route, $m)) {
    $c = one("SELECT id FROM competitions WHERE slug=?", [$m[1]]);
    header('Location: ' . url($c ? '/awards?comp=' . (int)$c['id'] : '/awards'), true, 301); exit;
}

// Карта сайта: статические маршруты + конкурсы по slug.
if ($route === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    $baseUrl = rtrim($CFG['base_url'], '/');
    $static = ['/', '/competitions', '/apply', '/awards', '/order-awards', '/concerts',
        '/about', '/goals', '/ministry-support', '/faq', '/contacts', '/reviews',
        '/blog', '/privacy', '/agreement'];
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($static as $p) {
        echo '  <url><loc>' . htmlspecialchars($baseUrl . $p, ENT_XML1) . '</loc></url>' . "\n";
    }
    $slugs = [];
    try { $slugs = all("SELECT slug FROM competitions"); } catch (\Throwable $e) { $slugs = []; }
    foreach ($slugs as $row) {
        $s = is_array($row) ? ($row['slug'] ?? '') : (string) $row;
        if ($s === '') continue;
        echo '  <url><loc>' . htmlspecialchars($baseUrl . '/awards/' . $s, ENT_XML1) . '</loc></url>' . "\n";
    }
    // Статьи блога (pages со слагом blog-*).
    try {
        foreach (all("SELECT slug FROM pages WHERE slug LIKE 'blog-%'") as $row) {
            $s = is_array($row) ? ($row['slug'] ?? '') : (string) $row;
            if ($s === '') continue;
            echo '  <url><loc>' . htmlspecialchars($baseUrl . '/blog/' . $s, ENT_XML1) . '</loc></url>' . "\n";
        }
    } catch (\Throwable $e) {}
    echo '</urlset>';
    exit;
}

$pagesDir = BASE_PATH . '/templates/site/pages';

/** Запуск файла-страницы: он должен вызвать render_page(...). */
function serve(string $file, array $vars = []): void {
    global $pagesDir;
    $path = $pagesDir . '/' . $file . '.php';
    if (!is_file($path)) return;   // страница ещё не создана — пусть отработает 404 ниже
    extract($vars);
    require $path;
    exit;
}

// Динамические маршруты
if ($route === '/verify') serve('verify', ['number' => '']);
if (preg_match('#^/verify/([A-Za-zА-Яа-я0-9\-]+)$#u', $route, $m)) serve('verify', ['number' => $m[1]]);
// Внутренняя страница конкурса упразднена: вся информация — на афише в календаре,
// клик по конкурсу ведёт сразу на подачу заявки с предвыбором.
if (preg_match('#^/competition/([a-z0-9\-]+)$#', $route, $m)) {
    header('Location: ' . url('/apply?competition=' . rawurlencode($m[1])), true, 301); exit;
}
// Скачивание положения конкурса (DOCX 1:1 из эталона; генерирует при первом запросе).
// Старые ссылки .../regulation.pdf продолжают работать и отдают актуальный файл.
if (preg_match('#^/competition/([a-z0-9\-]+)/regulation\.(pdf|docx)$#', $route, $m)) {
    $c = one("SELECT * FROM competitions WHERE slug=?", [$m[1]]);
    if ($c) {
        try {
            $reqExt = strtolower($m[2]);
            // PDF-запрос (по умолчанию для «Открыть положение») — отдаём ИНЛАЙН,
            // чтобы положение ОТКРЫВАЛОСЬ в браузере, а не скачивалось.
            if ($reqExt === 'pdf') {
                require_once BASE_PATH . '/core/pdf_regulation.php';
                $pdf = pdf_regulation($c);
                // pdf_regulation() возвращает ПУТЬ к сгенерированному файлу (или, в старых версиях,
                // сами байты). Поддерживаем оба: если это существующий файл — отдаём его содержимое.
                $pdfData = ($pdf !== '' && strlen($pdf) < 512 && is_file($pdf)) ? (string) file_get_contents($pdf) : (string) $pdf;
                if ($pdfData === '' || strncmp($pdfData, '%PDF', 4) !== 0) {
                    throw new \RuntimeException('Не удалось сформировать PDF положения.');
                }
                header('Content-Type: application/pdf');
                header('Content-Disposition: inline; filename="Polozhenie_' . $c['slug'] . '.pdf"');
                header('Content-Length: ' . (string) strlen($pdfData));
                echo $pdfData;
                exit;
            }
            // Явный .docx-запрос — по-прежнему отдаём файлом (для редактирования).
            $path = !empty($c['regulation_pdf']) && is_file($c['regulation_pdf'])
                ? $c['regulation_pdf']
                : null;
            if ($path === null || strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'docx') {
                require_once BASE_PATH . '/core/regulation_gen.php';
                $path = regulation_generate((int)$c['id']);
            }
            header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            header('Content-Disposition: attachment; filename="Polozhenie_' . $c['slug'] . '.docx"');
            header('Content-Length: ' . (string) filesize($path));
            readfile($path);
            exit;
        } catch (\Throwable $e) {
            http_response_code(500);
            echo 'Не удалось сформировать положение: ' . htmlspecialchars($e->getMessage());
            exit;
        }
    }
    http_response_code(404); echo 'Конкурс не найден'; exit;
}
// Скачивание PDF диплома по номеру. Всегда отдаёт боевой PDF по НАШЕМУ HTML-шаблону:
// если файла нет — рендерит через бастион (diploma_pdf_html), фолбэк — GD-генератор.
if (preg_match('#^/diploma/([A-Za-z0-9\-]+)\.pdf$#', $route, $m)) {
    $d = one("SELECT * FROM diplomas WHERE number=?", [$m[1]]);
    if (!$d) { http_response_code(404); echo 'Диплом не найден'; exit; }
    $app = one("SELECT * FROM applications WHERE id=?", [(int) $d['application_id']]);
    require_once BASE_PATH . '/core/diploma_render.php';

    $file = '';
    $stored = trim((string) ($d['pdf_path'] ?? ''));
    if ($stored !== '' && !str_starts_with($stored, 'http')) {
        $abs = $stored[0] === '/' && str_starts_with($stored, '/var') ? $stored
             : BASE_PATH . '/public/' . ltrim($stored, '/');
        if (is_file($abs) && filesize($abs) > 20000) $file = $abs;
    }
    // Рендер боевого шаблона (кэшируем: сохраняем веб-путь в pdf_path)
    if ($file === '' && $app) {
        $rendered = diploma_pdf_html($app, ['thanks' => (($d['type'] ?? '') === 'thanks')]);
        if ($rendered && is_file($rendered)) {
            $file = $rendered;
            update('diplomas', ['pdf_path' => '/diplomas/' . basename($rendered)], 'id=:id', ['id' => (int) $d['id']]);
        }
    }
    // Фолбэк — GD-генератор (если бастион недоступен)
    if ($file === '' && $app && function_exists('pdf_diploma')) {
        try { $gd = pdf_diploma($app, (string) ($d['type'] ?: 'main')); if ($gd && is_file($gd)) $file = $gd; }
        catch (\Throwable $e) { /* ниже 404 */ }
    }
    if ($file === '') { http_response_code(404); echo 'Диплом ещё формируется, попробуйте через минуту'; exit; }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="Diploma_' . $d['number'] . '.pdf"');
    header('Content-Length: ' . (string) filesize($file));
    readfile($file);
    exit;
}
// Визуальный просмотр диплома (реальный HTML-шаблон, для реестра и кабинета).
if (preg_match('#^/diploma-view/([A-Za-z0-9\-]+)$#', $route, $m)) {
    $d = one("SELECT * FROM diplomas WHERE number=?", [$m[1]]);
    if (!$d) { http_response_code(404); echo 'Диплом не найден'; exit; }
    $app = one("SELECT * FROM applications WHERE id=?", [(int) $d['application_id']]);
    $c   = $app ? one("SELECT * FROM competitions WHERE id=?", [(int) $app['competition_id']]) : null;
    require_once BASE_PATH . '/core/diploma_html.php';
    $opt = [];
    if (($d['type'] ?? '') === 'thanks') { $opt['thanks'] = true; if (!empty($app['teacher'])) $app['full_name'] = $app['teacher']; }
    echo diploma_html($c ?: [], $app ?: [], $opt);
    exit;
}
// Приватный рендер боевого диплома для PDF-печати бастионом (ключ в settings).
if (preg_match('#^/diploma-render/(\d+)$#', $route, $m)) {
    $key  = (string)($_GET['key'] ?? '');
    $good = (string) setting('diploma_render_key', '');
    $app  = one("SELECT * FROM applications WHERE id=?", [(int)$m[1]]);
    if (!$app || $good === '' || $key === '' || !hash_equals($good, $key)) {
        http_response_code(404); echo 'Не найдено'; exit;
    }
    $c = one("SELECT * FROM competitions WHERE id=?", [(int)$app['competition_id']]);
    require_once BASE_PATH . '/core/diploma_html.php';
    require_once BASE_PATH . '/core/pdf_diploma.php';   // diploma_make_number()
    $opt = [];
    $rtype = (string)($_GET['type'] ?? '');
    if ($rtype === 'thanks') {
        $opt['thanks'] = true;
        if (!empty($app['teacher'])) $app['full_name'] = $app['teacher']; // благодарность — педагогу
    } elseif ($rtype === 'extra') {
        $opt['extra'] = true;  // отдельный дополнительный диплом (спецноминация)
    } elseif ($rtype === 'named') {
        $opt['named'] = true;  // именной диплом (участник в составе коллектива)
    }
    // ЧИСТЫЙ оригинал (без подписи/печати) — для типографии/изготовления. Номер+QR остаются.
    if (!empty($_GET['clean'])) $opt['clean'] = true;
    // ЖЁСТКОЕ ПРАВИЛО: номер диплома всегда корректный (по типу), совпадает с реестром /verify.
    if (function_exists('diploma_make_number')) {
        $opt['number'] = diploma_make_number((string)($app['number'] ?? ''), $rtype ?: 'main');
    }
    echo diploma_html($c ?: [], $app, $opt);
    exit;
}

// Демо-образец диплома конкурса (HTML-сборщик по эталону, водяной знак «ОБРАЗЕЦ»).
if (preg_match('#^/diploma-sample/([a-z0-9\-]+)$#', $route, $m)) {
    $c = one("SELECT * FROM competitions WHERE slug=?", [$m[1]]);
    if ($c) {
        require_once BASE_PATH . '/core/diploma_html.php';
        $opt = ['sample' => true];
        if (isset($_GET['thanks'])) $opt['thanks'] = true;
        if (isset($_GET['extra']))  $opt['extra']  = true;
        if (isset($_GET['named']))  $opt['named']  = true;
        echo diploma_html($c, diploma_sample_app(), $opt);
        exit;
    }
    http_response_code(404); echo 'Конкурс не найден'; exit;
}
if (preg_match('#^/awards/([a-z0-9\-]+)$#', $route, $m)) serve('awards_competition', ['slug' => $m[1]]);
if (preg_match('#^/artist/([a-z0-9\-]+)$#', $route, $m)) serve('artist', ['slug' => $m[1]]);
if (preg_match('#^/pedagog/([a-z0-9\-]+)$#', $route, $m)) serve('teacher_profile', ['slug' => $m[1]]);
if (preg_match('#^/results/([a-z0-9\-]+)$#', $route, $m)) serve('results', ['slug' => $m[1]]);
if (preg_match('#^/blog/([a-z0-9\-]+)$#', $route, $m)) serve('blog', ['slug' => $m[1]]);

// Статические маршруты → файл страницы
// Прим.: параметр возврата после OAuth (?auth=ok) не требует маршрута —
// роутер работает только по PATH, query-строка проходит на любой маршрут
// (напр. /cabinet?auth=ok). /welcome — необязательная точка входа: рендерит
// главную, где срабатывает глобальная модалка входа .auth-modal.
$map = [
    '/' => 'home',
    '/welcome' => 'home',
    '/menu' => 'menu',
    '/competitions' => 'competitions',
    '/apply' => 'apply',
    '/goals' => 'page_goals',
    '/ministry-support' => 'ministry',
    '/awards' => 'awards',
    '/order-awards' => 'order_awards',
    '/concerts' => 'concerts',
    '/blog' => 'blog',
    '/about' => 'about',
    '/reviews' => 'reviews',
    '/faq' => 'faq',
    '/contacts' => 'contacts',
    '/agreement' => 'legal_agreement',
    '/privacy' => 'legal_privacy',
    '/login' => 'login',
    '/register' => 'register',
    '/logout' => 'logout',
    '/forgot' => 'forgot',
    '/reset-password' => 'reset_password',
    '/verify-email' => 'verify_email',
    '/cabinet' => 'cabinet',
    '/pay-status' => 'pay_status',
    '/notifications' => 'notifications',
    '/chat' => 'chat',
    '/results' => 'results_index',
    '/teacher' => 'teacher',
    '/calendar' => 'calendar',
    '/gala' => 'gala',
    '/partner' => 'partner',
    '/club' => 'club',
    '/widget' => 'widget',
];

// Telegram Mini App = сам сайт (не отдельная витрина): /tma отдаёт полную главную с TG-адаптацией
// ($_GET['tg'] включает in-tg режим в layout; дальше контекст держит кука mz_tg на всех страницах).
if ($route === '/tma') { $_GET['tg'] = '1'; serve('home'); }

if (isset($map[$route]) && is_file($pagesDir . '/' . $map[$route] . '.php')) {
    serve($map[$route]);
}

// 404
http_response_code(404);
require_once BASE_PATH . '/core/helpers.php';
render_page('Страница не найдена', '<section class="section"><div class="container" style="text-align:center">'
    . '<h1>404</h1><p>Такой страницы нет. Вернитесь на <a href="' . url('/') . '">главную</a>.</p></div></section>');
