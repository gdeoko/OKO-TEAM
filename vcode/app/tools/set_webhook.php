<?php
/**
 * Подключить вебхук бота: php tools/set_webhook.php [--delete]
 * Адрес берётся из настроек: <base_url>/api/bot
 */
require_once __DIR__ . '/../core/telegram.php';
$cfg = vc_cfg();
if (in_array('--delete', $argv, true)) {
  print_r(vc_tg('deleteWebhook', ['drop_pending_updates' => true]));
  exit;
}
$url = rtrim($cfg['base_url'], '/') . '/api/bot';
$r = vc_tg('setWebhook', [
  'url' => $url,
  'secret_token' => $cfg['bot_secret'],
  'allowed_updates' => ['message', 'callback_query', 'pre_checkout_query'],
  'drop_pending_updates' => true,
]);
print_r($r);
// Кнопка меню «Открыть приложение» и команды бота.
print_r(vc_tg('setChatMenuButton', ['menu_button' => [
  'type' => 'web_app', 'text' => 'Открыть', 'web_app' => ['url' => $cfg['base_url']]]]));
print_r(vc_tg('setMyCommands', ['commands' => [
  ['command' => 'start', 'description' => 'Начать'],
  ['command' => 'app', 'description' => 'Открыть приложение'],
  ['command' => 'course', 'description' => 'Программа обучения'],
  ['command' => 'orders', 'description' => 'Заявки заказчиков'],
  ['command' => 'price', 'description' => 'Тарифы'],
  ['command' => 'my', 'description' => 'Мой прогресс'],
  ['command' => 'help', 'description' => 'Помощь'],
]]));
print_r(vc_tg('setMyDescription', ['description' =>
  'V.LIONOFF — школа контент-креаторов и биржа заказов. Учитесь снимать ролики, '
  . 'которые приносят заявки, и берите заказы прямо в приложении.']));
print_r(vc_tg('setMyShortDescription', ['short_description' =>
  'Школа контент-креаторов и биржа заказов']));
