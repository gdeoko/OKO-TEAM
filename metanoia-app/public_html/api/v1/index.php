<?php
/**
 * МЕТАНОЙЯ · API v1 · точка входа и роутер
 * Нативный PHP 8.1+, без фреймворков (shared-hosting).
 * Все ответы: JSON {success, data|error}.
 */

declare(strict_types=1);

require __DIR__ . '/core/config.php';
require __DIR__ . '/core/response.php';
require __DIR__ . '/core/db.php';
require __DIR__ . '/core/jwt.php';
require __DIR__ . '/core/auth.php';
require __DIR__ . '/core/ratelimit.php';

// ── CORS (только свой домен) ───────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === Config::get('APP_ORIGIN', 'https://app.metanoia-180.ru')) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

// ── Rate limiting: 100 запросов/мин на IP ──────────────────
RateLimit::check($_SERVER['REMOTE_ADDR'] ?? 'unknown', 100, 60);

// ── Разбор пути: /api/v1/{resource}/{action?}/{id?} ────────
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';
$path = preg_replace('#^.*?/api/v1(/index\.php)?#', '', $path);
$segments = array_values(array_filter(explode('/', $path)));
$resource = $segments[0] ?? '';
$method   = $_SERVER['REQUEST_METHOD'];

// ── Таблица маршрутов ──────────────────────────────────────
$routes = [
    'auth'   => __DIR__ . '/routes/auth.php',
    'users'  => __DIR__ . '/routes/users.php',
    'health' => null, // обрабатывается ниже
];

try {
    if ($resource === 'health') {
        Response::ok(['status' => 'alive', 'version' => 'v1']);
    }

    if (!isset($routes[$resource]) || $routes[$resource] === null) {
        Response::error('Не найдено', 404);
    }

    require $routes[$resource];
    // каждый файл маршрута определяет handle(array $segments, string $method): never
    handle($segments, $method);

} catch (Throwable $e) {
    error_log('[metanoia-api] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error(Config::get('APP_DEBUG') === '1' ? $e->getMessage() : 'Внутренняя ошибка сервера', 500);
}
