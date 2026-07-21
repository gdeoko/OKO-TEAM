<?php
/** Письмо: подтверждение регистрации. $vars: name, verify_url. */
$name = trim((string)($vars['name'] ?? ''));
$verify = (string)($vars['verify_url'] ?? '#');
?>
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;">Добро пожаловать<?= $name !== '' ? ', ' . h($name) : '' ?>!</h1>
<p style="margin:0 0 16px;">Вы зарегистрировались на сайте культурного центра «Музыкальный Мир». Мы рады, что Вы с нами.</p>
<p style="margin:0 0 8px;">Осталось подтвердить адрес почты - нажмите на кнопку ниже, и Ваш личный кабинет будет полностью открыт.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($verify) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Подтвердить почту</a>
  </td></tr>
</table>
<p style="margin:0;font-size:13px;color:#8a7658;">Если кнопка не открывается, скопируйте ссылку в браузер:<br><span style="color:#a0522d;word-break:break-all;"><?= h($verify) ?></span></p>
