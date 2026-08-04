<?php
/** Письмо: подтверждение регистрации. $vars: name, verify_url. */
$name = trim((string)($vars['name'] ?? ''));
$verify = (string)($vars['verify_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Подтвердите адрес почты</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 16px;">Вы зарегистрировались на сайте культурного центра «Музыкальный Мир». Мы рады, что Вы с нами.</p>
<p style="margin:0 0 8px;">Остался один шаг — нажмите на кнопку ниже, и Ваш личный кабинет будет полностью открыт.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;">
  <tr><td style="border-radius:12px;background:#C79322;background:linear-gradient(135deg,#C79322,#E3B94F);">
    <a href="<?= h($verify) ?>" style="display:inline-block;padding:14px 34px;color:#17307A;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Подтвердить почту</a>
  </td></tr>
</table>

<p style="margin:0;font-size:13px;color:#6B7699;">Ссылка в кнопке действует ограниченное время. Если письмо пришло по ошибке, просто оставьте его без внимания.</p>
