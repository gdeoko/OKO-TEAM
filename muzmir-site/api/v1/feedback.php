<?php
/** POST формы обратной связи → письмо администратору (очередь) + уведомление в Telegram. */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

// --- Проверка источника (Origin/Referer принадлежит своему домену) + CSRF-токен ---
if (!auth_origin_ok() || !csrf_check()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}

if (!rate_ok('feedback:' . client_ip(), 10, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много обращений, попробуйте позже'], 429);
}

$name  = input('name');
// Форма контактов шлёт единое поле «contact» (почта ИЛИ телефон). Поддерживаем и
// старые раздельные поля email/phone для обратной совместимости.
$contact = trim((string) input('contact'));
$email = mb_strtolower(input('email'));
$phone = input('phone');
if ($contact !== '') {
    if (filter_var($contact, FILTER_VALIDATE_EMAIL)) { $email = mb_strtolower($contact); }
    else { $phone = $contact; }
}
$msg   = normalize_text(input('message'));

if (mb_strlen($msg) < 5) json_out(['ok' => false, 'error' => 'Опишите обращение подробнее'], 422);

// Контакт обязателен, но это может быть телефон — не валим на «почте», если дан телефон.
if ($email === '' && trim((string) $phone) === '') {
    json_out(['ok' => false, 'error' => 'Укажите электронную почту или телефон для ответа'], 422);
}
if ($email !== '') {
    $ev = function_exists('v_email') ? v_email($email) : ['ok' => (bool) filter_var($email, FILTER_VALIDATE_EMAIL)];
    if (!($ev['ok'] ?? false)) json_out(['ok' => false, 'error' => 'Проверьте электронную почту'], 422);
}

$subject = 'Обратная связь с сайта - ' . ($name !== '' ? $name : $email);
$fieldsHtml = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">'
    . '<tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">'
    . '<div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Данные обращения</div>'
    . '<div><span style="color:#6B7699;">Имя:</span> ' . h($name) . '</div>'
    . '<div><span style="color:#6B7699;">Почта:</span> ' . h($email) . '</div>'
    . '<div><span style="color:#6B7699;">Телефон:</span> ' . h($phone) . '</div>'
    . '</td></tr></table>'
    . '<p style="margin:16px 0 0;"><b style="color:#17307A;">Сообщение:</b><br>' . nl2br(h($msg)) . '</p>';
$body = function_exists('mail_template')
    ? mail_template('generic', [
        'title'     => 'Обратная связь с сайта',
        'message'   => $fieldsHtml,
        'preheader' => 'Новое обращение: ' . ($name !== '' ? $name : $email),
      ])
    : '<p><b>Имя:</b> ' . h($name) . '</p>'
      . '<p><b>Почта:</b> ' . h($email) . '</p>'
      . '<p><b>Телефон:</b> ' . h($phone) . '</p>'
      . '<p><b>Сообщение:</b><br>' . nl2br(h($msg)) . '</p>';

// Обращения с сайта — в ящик администраторов. Это ВХОДЯЩАЯ почта: сюда падают
// уведомления сайта, а наружу с неё не уходит ничего. Публичный адрес центра
// (org_email) теперь российский и стоит в контактах, но уведомления админам
// по-прежнему собираются отдельно, чтобы не смешиваться с перепиской.
$admin = trim((string) cfgv('owner_email', (string) cfgv('org_email', '')));
if ($admin === '' || !filter_var($admin, FILTER_VALIDATE_EMAIL)) $admin = 'kulturniy.centr.mir@gmail.com';
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
