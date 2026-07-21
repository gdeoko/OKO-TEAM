<?php
/** POST {text} → мозг-агент (если задан) либо вежливый фолбэк. История в chat_messages. */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!rate_ok('chat:' . client_ip(), 40, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много сообщений, попробуйте позже'], 429);
}

$text = trim(input('text'));
if ($text === '') json_out(['ok' => false, 'error' => 'Пустое сообщение'], 422);

$uid = current_user()['id'] ?? null;
$sessionKey = $_SESSION['chat_key'] ?? ($_SESSION['chat_key'] = bin2hex(random_bytes(8)));

if (tbl_exists('chat_messages')) {
    insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'user', 'text' => $text]);
}

$reply = null;
$agentUrl = cfgv('agent_url');
if ($agentUrl) {
    $reply = agent_chat_proxy($agentUrl, (string) cfgv('agent_token'), $text, $sessionKey, $uid);
}
if ($reply === null || $reply === '') {
    $reply = 'Спасибо за обращение! Оператор Оргкомитета ответит Вам в рабочее время (' . cfgv('org_hours') . '). '
           . 'Также Вы можете написать на ' . cfgv('org_email') . ' или позвонить ' . cfgv('org_phone') . '.';
}

if (tbl_exists('chat_messages')) {
    insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'assistant', 'text' => $reply]);
}

json_out(['ok' => true, 'reply' => $reply, 'session' => $sessionKey]);
