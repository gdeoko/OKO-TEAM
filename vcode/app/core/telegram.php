<?php
/** V.LIONOFF · тонкая обёртка Bot API. Без токена всё молча ничего не делает. */
require_once __DIR__ . '/db.php';

function vc_tg(string $method, array $params = []) {
  $cfg = vc_cfg();
  if (empty($cfg['bot_token'])) { return null; }
  $ch = curl_init('https://api.telegram.org/bot' . $cfg['bot_token'] . '/' . $method);
  curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($params, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 20,
  ]);
  $res = curl_exec($ch);
  $err = curl_error($ch);
  curl_close($ch);
  if ($res === false) { error_log('[vcode tg] ' . $err); return null; }
  return json_decode($res, true);
}

function vc_tg_send(int $chatId, string $text, array $keyboard = null, bool $preview = false) {
  if (!$chatId) { return null; }
  $p = ['chat_id' => $chatId, 'text' => $text, 'parse_mode' => 'HTML',
        'link_preview_options' => ['is_disabled' => !$preview]];
  if ($keyboard) { $p['reply_markup'] = ['inline_keyboard' => $keyboard]; }
  return vc_tg('sendMessage', $p);
}

function vc_tg_photo(int $chatId, string $photo, string $caption = '', array $keyboard = null) {
  $p = ['chat_id' => $chatId, 'photo' => $photo, 'caption' => $caption, 'parse_mode' => 'HTML'];
  if ($keyboard) { $p['reply_markup'] = ['inline_keyboard' => $keyboard]; }
  return vc_tg('sendPhoto', $p);
}

function vc_tg_notify_admins(string $text): void {
  $cfg = vc_cfg();
  foreach ($cfg['admin_ids'] as $id) { vc_tg_send((int)$id, $text); }
}

/** Кнопка, открывающая мини-приложение. */
function vc_tg_app_button(string $label = 'Открыть V.LIONOFF', string $path = ''): array {
  $cfg = vc_cfg();
  return [[['text' => $label, 'web_app' => ['url' => rtrim($cfg['base_url'], '/') . '/' . ltrim($path, '/')]]]];
}
