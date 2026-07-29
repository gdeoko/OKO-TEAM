<?php
/** Единая точка входа публичного сайта + фронт-контроллер. */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$CFG = require BASE_PATH . '/config.php';
$GLOBALS['CFG'] = $CFG;

require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
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
    '/oplata-sayt' => '/order-awards',     // оплата наградного материала
    '/voprosi'     => '/faq',              // справка/вопросы
    '/konkursi'    => '/competitions',     // список конкурсов
    '/podderjka'   => '/ministry-support', // поддержка Минкультуры
    '/comment'     => '/reviews',          // отзывы
    '/documents'   => '/competitions',     // положения конкурсов
    '/video'       => '/concerts',         // онлайн-концерты
    '/onas'        => '/about',            // о нас
    '/instrukciya' => '/order-awards',     // инструкция по заказу наград
    '/zadachi'     => '/goals',            // цели/задачи центра
    '/prays'       => '/order-awards',     // прайс наградного материала
    '/novosti'      => '/blog',            // Блог/Новости (русский слаг)
];
if (isset($aliases[$route])) { header('Location: ' . url($aliases[$route]), true, 301); exit; }

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
        echo '  <url><loc>' . htmlspecialchars($baseUrl . '/competition/' . $s, ENT_XML1) . '</loc></url>' . "\n";
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
if (preg_match('#^/competition/([a-z0-9\-]+)$#', $route, $m)) serve('competition', ['slug' => $m[1]]);
// Скачивание PDF-положения конкурса (генерирует по эталону при первом запросе).
if (preg_match('#^/competition/([a-z0-9\-]+)/regulation\.pdf$#', $route, $m)) {
    $c = one("SELECT * FROM competitions WHERE slug=?", [$m[1]]);
    if ($c) {
        require_once BASE_PATH . '/core/pdf_regulation.php';
        try {
            $path = !empty($c['regulation_pdf']) && is_file($c['regulation_pdf'])
                ? $c['regulation_pdf']
                : pdf_regulation((array)$c);
            if (empty($c['regulation_pdf']) && is_file($path)) {
                update('competitions', ['regulation_pdf' => $path], 'id=:wid', ['wid' => (int)$c['id']]);
            }
            header('Content-Type: application/pdf');
            header('Content-Disposition: inline; filename="Polozhenie_' . $c['slug'] . '.pdf"');
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
// Скачивание PDF диплома по номеру (публично, но с логированием verify_log).
if (preg_match('#^/diploma/([A-Za-z0-9\-]+)\.pdf$#', $route, $m)) {
    $d = one("SELECT * FROM diplomas WHERE number=?", [$m[1]]);
    if ($d && !empty($d['pdf_path']) && is_file($d['pdf_path'])) {
        header('Content-Type: application/pdf');
        header('Content-Disposition: inline; filename="Diploma_' . $d['number'] . '.pdf"');
        readfile($d['pdf_path']);
        exit;
    }
    http_response_code(404); echo 'Диплом не найден'; exit;
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
