<?php
/** Письмо: одноразовый код для входа. $vars: name, code, ttl_minutes. */
$name = trim((string)($vars['name'] ?? ''));
$code = trim((string)($vars['code'] ?? ''));
$ttl  = (int)($vars['ttl_minutes'] ?? 15);
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Код для входа</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Вы запросили вход на сайт культурного центра «Музыкальный Мир». Введите этот код на странице входа:</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:2px solid #C79322;border-radius:16px;">
  <tr><td style="padding:26px 24px;text-align:center;">
    <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#6B7699;margin-bottom:10px;">Ваш код подтверждения</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:42px;font-weight:700;letter-spacing:12px;color:#17307A;line-height:1.2;"><?= h($code) ?></div>
  </td></tr>
</table>

<p style="margin:0;font-size:13px;color:#6B7699;">Код действует <?= $ttl ?> минут и подходит только для одного входа. Если Вы не запрашивали вход — просто оставьте это письмо без внимания, доступ к аккаунту сохранится.</p>
