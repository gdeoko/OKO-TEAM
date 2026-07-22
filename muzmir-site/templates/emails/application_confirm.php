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
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;line-height:1.25;">Заявка принята</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Ваша заявка на конкурс «<?= h($competition) ?>» зарегистрирована. Мы бережно передадим Вашу работу жюри.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#f6ecdb;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#5a4632;">
    <div style="font-weight:600;color:#7a2e1e;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Детали заявки</div>
    <?php if ($number !== ''): ?><div><span style="color:#8a7658;">Номер заявки:</span> <b style="color:#7a2e1e;"><?= h($number) ?></b></div><?php endif; ?>
    <?php if ($nomination !== ''): ?><div><span style="color:#8a7658;">Номинация:</span> <?= h($nomination) ?></div><?php endif; ?>
    <?php if ($work !== ''): ?><div><span style="color:#8a7658;">Работа:</span> «<?= h($work) ?>»</div><?php endif; ?>
    <div><span style="color:#8a7658;">Статус:</span> принята</div>
  </td></tr>
</table>

<p style="margin:0 0 6px;">Следить за статусом можно в личном кабинете. Мы напишем Вам, как только появятся результаты.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($cabinet) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Открыть личный кабинет</a>
  </td></tr>
</table>
