<?php
/** Письмо: диплом готов (файл — во вложении). $vars: name, competition, result, diploma_number, diploma_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$result = (string)($vars['result'] ?? '');
$dnumber = (string)($vars['diploma_number'] ?? '');
$durl = (string)($vars['diploma_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;line-height:1.25;">Ваш диплом готов</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Поздравляем Вас с участием в конкурсе «<?= h($competition) ?>». Диплом приложен к этому письму в формате PDF.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#f6ecdb;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#5a4632;">
    <div style="font-weight:600;color:#7a2e1e;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Ваш диплom</div>
    <?php if ($result !== ''): ?><div><span style="color:#8a7658;">Результат:</span> <b style="color:#7a2e1e;">«<?= h($result) ?>»</b></div><?php endif; ?>
    <?php if ($dnumber !== ''): ?><div><span style="color:#8a7658;">Номер диплома:</span> <?= h($dnumber) ?></div><?php endif; ?>
    <div><span style="color:#8a7658;">Формат:</span> PDF, во вложении</div>
  </td></tr>
</table>

<p style="margin:0 0 6px;">Подлинность диплома можно проверить по QR-коду на самом документе или скачать копию по кнопке ниже.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($durl) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Скачать диплом</a>
  </td></tr>
</table>
