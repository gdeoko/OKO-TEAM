<?php
/**
 * Разовая настройка Callback API ВКонтакте для авто-ответов бота сообщества.
 * Запуск на muzmir-сервере:  php scripts/vk_setup_callback.php
 *
 * Делает всё через VK API токеном сообщества (право manage):
 *   1) забирает строку подтверждения (groups.getCallbackConfirmationCode);
 *   2) прописывает MUZMIR_VK_CONFIRM и MUZMIR_VK_CALLBACK_SECRET в config.local.php;
 *   3) регистрирует сервер (groups.addCallbackServer) на URL /api/v1/webhook_vk
 *      — ВК тут же дёргает вебхук и проверяет строку подтверждения;
 *   4) включает событие message_new (groups.setCallbackSettings).
 * Идемпотентно: повторный запуск переиспользует существующий сервер.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';

$gid   = (int) cfgv('vk_group_id', 211325055);
$puny  = (string) cfgv('domain_puny', 'xn----7sbugdeiegh1b0a9hen.xn--p1ai');
$url   = 'https://' . $puny . '/api/v1/webhook_vk';
$title = 'Бот сайта';   // ВК ограничивает заголовок 14 символами
$localPath = BASE_PATH . '/config.local.php';

function step(string $s): void { fwrite(STDOUT, $s . "\n"); }
function fail(string $s): void { fwrite(STDERR, "ОШИБКА: $s\n"); exit(1); }

if (trim((string) cfgv('vk_token')) === '') fail('vk_token не задан (MUZMIR_VK_TOKEN).');
step('URL вебхука: ' . $url);

// 1) Строка подтверждения.
$cc = vk_api('groups.getCallbackConfirmationCode', ['group_id' => $gid]);
$confirm = (string) ($cc['response']['code'] ?? '');
if ($confirm === '') fail('не удалось получить код подтверждения: ' . json_encode($cc, JSON_UNESCAPED_UNICODE));
step('Код подтверждения: ' . $confirm);

// 2) Пишем confirm + secret в config.local.php (мягкий merge через var_export).
$local = is_file($localPath) ? (require $localPath) : [];
if (!is_array($local)) $local = [];
$secret = (string) ($local['MUZMIR_VK_CALLBACK_SECRET'] ?? '');
if ($secret === '') $secret = bin2hex(random_bytes(16));
$local['MUZMIR_VK_CONFIRM']         = $confirm;
$local['MUZMIR_VK_CALLBACK_SECRET'] = $secret;
$dump = "<?php\n// Локальные секреты (не в git). Обновляется скриптами настройки.\nreturn " . var_export($local, true) . ";\n";
if (file_put_contents($localPath, $dump) === false) fail('не удалось записать config.local.php');
step('config.local.php обновлён (MUZMIR_VK_CONFIRM, MUZMIR_VK_CALLBACK_SECRET).');

// 3) Существующий сервер или добавляем новый (ВК сразу проверит вебхук).
$srv = vk_api('groups.getCallbackServers', ['group_id' => $gid]);
$serverId = 0;
foreach (($srv['response']['items'] ?? []) as $it) {
    if (rtrim((string) ($it['url'] ?? ''), '/') === rtrim($url, '/')) { $serverId = (int) $it['id']; break; }
}
if ($serverId === 0) {
    $add = vk_api('groups.addCallbackServer', [
        'group_id'   => $gid,
        'url'        => $url,
        'title'      => $title,
        'secret_key' => $secret,
    ]);
    $serverId = (int) ($add['response']['server_id'] ?? 0);
    if ($serverId === 0) fail('addCallbackServer: ' . json_encode($add, JSON_UNESCAPED_UNICODE));
    step('Сервер зарегистрирован, server_id=' . $serverId);
} else {
    // Обновим секрет на всякий случай.
    vk_api('groups.editCallbackServer', ['group_id' => $gid, 'server_id' => $serverId, 'url' => $url, 'title' => $title, 'secret_key' => $secret]);
    step('Сервер уже есть, server_id=' . $serverId . ' (секрет обновлён).');
}

// 4) Включаем событие message_new (+ разрешение писать / набор текста).
$set = vk_api('groups.setCallbackSettings', [
    'group_id'      => $gid,
    'server_id'     => $serverId,
    'api_version'   => '5.199',
    'message_new'   => 1,
    'message_allow' => 1,
    'message_deny'  => 1,
]);
if ((int) ($set['response'] ?? 0) !== 1) fail('setCallbackSettings: ' . json_encode($set, JSON_UNESCAPED_UNICODE));
step('Событие message_new включено. Готово ✅');

// Проверим статус сервера.
$srv2 = vk_api('groups.getCallbackServers', ['group_id' => $gid]);
foreach (($srv2['response']['items'] ?? []) as $it) {
    if ((int) $it['id'] === $serverId) {
        step('Статус сервера: ' . (string) ($it['status'] ?? '?'));
    }
}
