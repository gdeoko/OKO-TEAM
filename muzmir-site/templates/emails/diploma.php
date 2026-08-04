<?php
/** Письмо: диплом готов (файл — во вложении). $vars: name, competition, result, diploma_number, diploma_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$result = (string)($vars['result'] ?? '');
$dnumber = (string)($vars['diploma_number'] ?? '');
$durl = (string)($vars['diploma_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Ваш диплом готов</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Поздравляем Вас с участием в конкурсе «<?= h($competition) ?>». Диплом приложен к этому письму в формате PDF.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">
    <div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Ваш диплом</div>
    <?php if ($result !== ''): ?><div><span style="color:#6B7699;">Результат:</span> <b style="color:#17307A;">«<?= h($result) ?>»</b></div><?php endif; ?>
    <?php if ($dnumber !== ''): ?><div><span style="color:#6B7699;">Номер диплома:</span> <?= h($dnumber) ?></div><?php endif; ?>
    <div><span style="color:#6B7699;">Формат:</span> PDF, во вложении</div>
  </td></tr>
</table>

<p style="margin:0 0 6px;">Подлинность диплома можно проверить по QR-коду на самом документе или скачать копию по кнопке ниже.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:12px;background:#C79322;background:linear-gradient(135deg,#C79322,#E3B94F);">
    <a href="<?= h($durl) ?>" style="display:inline-block;padding:14px 34px;color:#17307A;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Скачать диплом</a>
  </td></tr>
</table>
