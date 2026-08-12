<?php
/** Письмо: оплата прошла. $vars: name, competition, number, amount, cabinet_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$number = (string)($vars['number'] ?? '');
$amount = (string)($vars['amount'] ?? '');
$cabinet = (string)($vars['cabinet_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Оплата получена</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Мы подтверждаем оплату участия в конкурсе «<?= h($competition) ?>». Спасибо за доверие.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">
    <div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Детали платежа</div>
    <?php if ($number !== ''): ?><div><span style="color:#6B7699;">Номер заявки:</span> <b style="color:#17307A;"><?= h($number) ?></b></div><?php endif; ?>
    <?php if ($amount !== ''): ?><div><span style="color:#6B7699;">Сумма:</span> <?= h($amount) ?></div><?php endif; ?>
    <div><span style="color:#6B7699;">Статус:</span> оплачено</div>
  </td></tr>
</table>

<p style="margin:0 0 6px;">Работа передана жюри. Результаты и диплом придут на этот адрес, а также появятся в личном кабинете.</p>
