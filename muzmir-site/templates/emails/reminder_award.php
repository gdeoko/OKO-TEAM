<?php
/** Письмо: напоминание о наградной продукции. $vars: name, competition, result, order_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$result = (string)($vars['result'] ?? '');
$order = (string)($vars['order_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Ваша награда ждёт Вас</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Вы отличились в конкурсе «<?= h($competition) ?>»<?= $result !== '' ? ' с результатом «' . h($result) . '»' : '' ?>. Такое достижение достойно того, чтобы сохранить его в печатном виде.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">
    <div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Что можно заказать</div>
    <div><span style="color:#C79322;">•</span> Памятные дипломы на плотной бумаге</div>
    <div><span style="color:#C79322;">•</span> Наградные медали и статуэтки</div>
    <div><span style="color:#C79322;">•</span> Наградные кубки</div>
  </td></tr>
</table>

<p style="margin:0 0 6px;">Оформить заказ можно в несколько шагов - мы бережно упакуем и отправим награду.</p>

<p style="margin:18px 0 0;font-size:13px;color:#6B7699;">Если печатная награда Вам не нужна, просто оставьте это письмо без ответа.</p>
