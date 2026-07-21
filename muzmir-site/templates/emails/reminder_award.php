<?php
/** Письмо: напоминание о наградной продукции. $vars: name, competition, result, order_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$result = (string)($vars['result'] ?? '');
$order = (string)($vars['order_url'] ?? '#');
?>
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;">Ваша награда ждёт Вас</h1>
<p style="margin:0 0 16px;">Здравствуйте<?= $name !== '' ? ', ' . h($name) : '' ?>! Вы отличились в конкурсе «<?= h($competition) ?>»<?= $result !== '' ? ' с результатом «' . h($result) . '»' : '' ?>. Достижение можно сохранить в печатном виде.</p>
<p style="margin:0 0 8px;">Для Вас доступны памятные дипломы на плотной бумаге, медали и кубки с гравировкой. Оформить заказ можно в несколько шагов - мы бережно упакуем и отправим награду.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($order) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Заказать награду</a>
  </td></tr>
</table>
<p style="margin:0;font-size:13px;color:#8a7658;">Если печатная награда Вам не нужна, просто оставьте это письмо без ответа.</p>
