<?php
/** Письмо: оплата прошла. $vars: name, competition, number, amount, cabinet_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$number = (string)($vars['number'] ?? '');
$amount = (string)($vars['amount'] ?? '');
$cabinet = (string)($vars['cabinet_url'] ?? '#');
?>
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;">Оплата получена</h1>
<p style="margin:0 0 16px;">Здравствуйте<?= $name !== '' ? ', ' . h($name) : '' ?>! Мы подтверждаем оплату участия в конкурсе «<?= h($competition) ?>». Спасибо за доверие.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;background:#f6ecdb;border-radius:12px;">
  <tr><td style="padding:18px 22px;font-size:14px;line-height:1.9;color:#5a4632;">
    <?php if ($number !== ''): ?><div><span style="color:#8a7658;">Номер заявки:</span> <b style="color:#7a2e1e;"><?= h($number) ?></b></div><?php endif; ?>
    <?php if ($amount !== ''): ?><div><span style="color:#8a7658;">Сумма:</span> <?= h($amount) ?></div><?php endif; ?>
    <div><span style="color:#8a7658;">Статус:</span> оплачено</div>
  </td></tr>
</table>
<p style="margin:0 0 8px;">Работа передана жюри. Результаты и диплом придут на этот адрес, а также появятся в личном кабинете.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($cabinet) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Перейти в личный кабинет</a>
  </td></tr>
</table>
