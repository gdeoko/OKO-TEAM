<?php
/** Роутер для встроенного PHP-сервера (dev): статику отдаём напрямую, остальное — в index.php. */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . '/../public' . $path;
if ($path !== '/' && is_file($file)) return false;      // статический файл
require __DIR__ . '/../public/index.php';
