<?php
/** Письмо: диплом готов (файл — во вложении). $vars: name, competition, result, diploma_number, diploma_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$result = (string)($vars['result'] ?? '');
$dnumber = (string)($vars['diploma_number'] ?? '');
$durl = (string)($vars['diploma_url'] ?? '#');
?>
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;">Ваш диплом готов</h1>
<p style="margin:0 0 16px;">Здравствуйте<?= $name !== '' ? ', ' . h($name) : '' ?>! Поздравляем Вас с участием в конкурсе «<?= h($competition) ?>». Диплом приложен к письму в формате PDF.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;background:#f6ecdb;border-radius:12px;">
  <tr><td style="padding:18px 22px;font-size:14px;line-height:1.9;color:#5a4632;">
    <?php if ($result !== ''): ?><div><span style="color:#8a7658;">Результат:</span> <b style="color:#7a2e1e;">«<?= h($result) ?>»</b></div><?php endif; ?>
    <?php if ($dnumber !== ''): ?><div><span style="color:#8a7658;">Номер диплома:</span> <?= h($dnumber) ?></div><?php endif; ?>
  </td></tr>
</table>
<p style="margin:0 0 8px;">Подлинность диплома можно проверить по QR-коду на самом документе или скачать копию по кнопке ниже.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($durl) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Скачать диплом</a>
  </td></tr>
</table>
