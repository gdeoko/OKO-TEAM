<?php
/** Приём апдейтов бота. Передаёт в core/telegram.php (tg_handle_update), иначе заглушка отвечает на /start. */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$raw = file_get_contents('php://input') ?: '';
$update = json_decode($raw, true);
if (!is_array($update)) json_out(['ok' => true]);

// Проверка секрет-токена вебхука (если задан при setWebhook).
$secret = cfgv('tg_webhook_secret');
if ($secret) {
    $got = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
    if (!hash_equals($secret, $got)) json_out(['ok' => false], 403);
}

if (function_exists('tg_handle_update')) {
    tg_handle_update($update);
    json_out(['ok' => true]);
}

// Заглушка: приветствие на /start.
$msg = $update['message'] ?? null;
$text = $msg['text'] ?? '';
$chatId = (string) ($msg['chat']['id'] ?? '');
if ($chatId !== '' && str_starts_with($text, '/start')) {
    $reply = 'Здравствуйте! Это бот Культурного центра «Музыкальный Мир». Сайт: ' . rtrim(cfgv('base_url'), '/')
           . '. Телефон: ' . cfgv('org_phone') . '.';
    if (function_exists('tg_send')) tg_send($chatId, $reply);
    else tg_send_raw($chatId, $reply);
}

json_out(['ok' => true]);
