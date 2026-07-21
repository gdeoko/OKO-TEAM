<?php
/**
 * CLI: настройка Telegram-бота @kc_muz_mir_bot.
 *   - setWebhook на cfgv('base_url').'/api/v1/webhook_telegram.php'
 *   - setMyCommands (список команд)
 *   - setChatMenuButton (кнопка меню → Web App /tma)
 *   - печатает getWebhookInfo
 *
 * ВНИМАНИЕ: боевой домен пока не подключён. Скрипт НЕ запускается автоматически.
 * Запуск вручную (когда base_url боевой и HTTPS):
 *   MUZMIR_BASE_URL=https://<домен> MUZMIR_TG_BOT_TOKEN=<token> php scripts/tg_setup.php
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$CFG = require BASE_PATH . '/config.php';
$GLOBALS['CFG'] = $CFG;

require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/telegram.php';

function out(string $label, array $res): void {
    $ok = !empty($res['ok']) ? 'OK ' : 'ERR';
    echo "[$ok] $label: " . json_encode($res, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
}

$token = (string) cfgv('tg_bot_token', '');
if ($token === '') {
    fwrite(STDERR, "tg_bot_token пуст. Задайте MUZMIR_TG_BOT_TOKEN и повторите.\n");
    exit(1);
}

$base = rtrim((string) cfgv('base_url'), '/');
if (!str_starts_with($base, 'https://')) {
    fwrite(STDERR, "ВНИМАНИЕ: base_url = $base (не HTTPS). Telegram webhook требует HTTPS. Продолжаю, но webhook не встанет.\n");
}

$webhookUrl = $base . '/api/v1/webhook_telegram.php';
$tmaUrl     = $base . '/tma';

echo "Бот: @" . cfgv('tg_bot_user') . "\n";
echo "Webhook URL: $webhookUrl\n";
echo "Mini App URL: $tmaUrl\n\n";

// 1) Webhook
out('setWebhook', tg_set_webhook($webhookUrl));

// 2) Команды бота
$commands = [
    ['command' => 'start',   'description' => 'Главное меню и запуск приложения'],
    ['command' => 'apply',   'description' => 'Подать заявку на конкурс'],
    ['command' => 'my',      'description' => 'Статус моих заявок'],
    ['command' => 'help',    'description' => 'Помощь'],
    ['command' => 'support', 'description' => 'Написать в оргкомитет'],
];
out('setMyCommands', tg_api('setMyCommands', ['commands' => $commands]));

// 3) Кнопка меню → Web App
out('setChatMenuButton', tg_api('setChatMenuButton', [
    'menu_button' => [
        'type'    => 'web_app',
        'text'    => 'Конкурсы',
        'web_app' => ['url' => $tmaUrl],
    ],
]));

// 4) Итог
echo "\n--- getWebhookInfo ---\n";
$info = tg_api('getWebhookInfo');
echo json_encode($info, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
