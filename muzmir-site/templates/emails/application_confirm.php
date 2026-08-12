<?php
/** Письмо: заявка принята. $vars: name, competition, number, nomination, work_title, cabinet_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$number = (string)($vars['number'] ?? '');
$nomination = (string)($vars['nomination'] ?? '');
$work = (string)($vars['work_title'] ?? '');
$cabinet = (string)($vars['cabinet_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Заявка принята</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Ваша заявка на конкурс «<?= h($competition) ?>» зарегистрирована. Мы бережно передадим Вашу работу жюри.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">
    <div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Детали заявки</div>
    <?php if ($number !== ''): ?><div><span style="color:#6B7699;">Номер заявки:</span> <b style="color:#17307A;"><?= h($number) ?></b></div><?php endif; ?>
    <?php if ($nomination !== ''): ?><div><span style="color:#6B7699;">Номинация:</span> <?= h($nomination) ?></div><?php endif; ?>
    <?php if ($work !== ''): ?><div><span style="color:#6B7699;">Работа:</span> «<?= h($work) ?>»</div><?php endif; ?>
    <div><span style="color:#6B7699;">Статус:</span> принята</div>
  </td></tr>
</table>

<p style="margin:0 0 6px;">Следить за статусом можно в личном кабинете. Мы напишем Вам, как только появятся результаты.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:12px;background:#C79322;background:linear-gradient(135deg,#C79322,#E3B94F);">
    <a href="<?= h($cabinet) ?>" style="display:inline-block;padding:14px 34px;color:#17307A;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Открыть личный кабинет</a>
  </td></tr>
</table>
