<?php
/** Маршрутизатор встроенного сервера PHP: php -S 127.0.0.1:8080 -t public_html tools/dev_router.php */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$root = __DIR__ . '/../public_html';
if (preg_match('#^/api/bot/?$#', $path)) { require $root . '/api/bot.php'; return true; }
if (preg_match('#^/api/(.*)$#', $path, $m)) { $_GET['r'] = $m[1]; require $root . '/api/index.php'; return true; }
if ($path !== '/' && is_file($root . $path)) { return false; }
if (is_dir($root . $path) && is_file(rtrim($root . $path, '/') . '/index.html')) {
  readfile(rtrim($root . $path, '/') . '/index.html'); return true;
}
readfile($root . '/index.html');
return true;
