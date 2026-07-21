<?php
/** POST формы обратной связи → письмо администратору (очередь) + уведомление в Telegram. */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!rate_ok('feedback:' . client_ip(), 10, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много обращений, попробуйте позже'], 429);
}

$name  = input('name');
$email = mb_strtolower(input('email'));
$phone = input('phone');
$msg   = normalize_text(input('message'));

if (mb_strlen($msg) < 5) json_out(['ok' => false, 'error' => 'Опишите обращение подробнее'], 422);

$ev = function_exists('v_email') ? v_email($email) : ['ok' => (bool) filter_var($email, FILTER_VALIDATE_EMAIL)];
if (!($ev['ok'] ?? false)) json_out(['ok' => false, 'error' => 'Проверьте электронную почту'], 422);

$subject = 'Обратная связь с сайта - ' . ($name !== '' ? $name : $email);
$body = '<p><b>Имя:</b> ' . h($name) . '</p>'
      . '<p><b>Почта:</b> ' . h($email) . '</p>'
      . '<p><b>Телефон:</b> ' . h($phone) . '</p>'
      . '<p><b>Сообщение:</b><br>' . nl2br(h($msg)) . '</p>';

$admin = cfgv('org_email');
if (function_exists('mail_queue')) {
    mail_queue($admin, 'Оргкомитет', $subject, $body);
} elseif (tbl_exists('mail_queue')) {
    insert('mail_queue', ['to_email' => $admin, 'to_name' => 'Оргкомитет', 'subject' => $subject, 'body' => $body]);
}

if (function_exists('tg_notify_admin')) {
    tg_notify_admin("Обратная связь\n{$name} {$email} {$phone}\n{$msg}");
}
audit('feedback', '', null, ['email' => $email]);

json_out(['ok' => true, 'message' => 'Сообщение отправлено. Мы ответим Вам в ближайшее время']);
