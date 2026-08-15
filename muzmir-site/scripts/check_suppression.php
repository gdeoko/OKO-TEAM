<?php
/**
 * НЕ ЗАБЛОКИРОВАН ЛИ АДРЕС В СЕРВИСЕ РАССЫЛОК.
 *
 * Сервис молча выбрасывает письма к адресам из своего списка подавленных: API
 * отвечает «принято», а письмо не уходит никуда. Проверять это надо адресно.
 *
 *   php scripts/check_suppression.php kc@музыкальный-мир.рф another@mail.ru
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$key  = trim((string) cfgv('unisender_api_key', ''));
$base = rtrim((string) cfgv('unisender_api_url', 'https://go2.unisender.ru/ru/transactional/api/v1'), '/') . '/';
$list = array_slice($argv, 1);
if (!$list) $list = ['kc@музыкальный-мир.рф', 'news@музыкальный-мир.рф',
                     'novosti@музыкальный-мир.рф', 'nagradi.on@музыкальный-мир.рф'];

foreach ($list as $email) {
    $ch = curl_init($base . 'suppression/get.json');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['api_key' => $key, 'email' => $email], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25,
    ]);
    $raw = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    printf("%-34s HTTP %d  %s\n", $email, $code, mb_substr(trim($raw), 0, 220));
}
