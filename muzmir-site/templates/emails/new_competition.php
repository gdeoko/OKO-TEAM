<?php
/** Письмо: анонс нового конкурса. $vars: name, competition, description, start_date, end_date, competition_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$desc = (string)($vars['description'] ?? '');
$start = (string)($vars['start_date'] ?? '');
$end = (string)($vars['end_date'] ?? '');
$link = (string)($vars['competition_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Новый конкурс: «<?= h($competition) ?>»</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 16px;">Мы открыли приём заявок на новый конкурс и приглашаем Вас принять участие.</p>
<?php if ($desc !== ''): ?>
<p style="margin:0 0 20px;color:#33406B;"><?= h($desc) ?></p>
<?php endif; ?>
<?php if ($start !== '' || $end !== ''): ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">
    <div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Сроки приёма</div>
    <?php if ($start !== ''): ?><div><span style="color:#6B7699;">Начало:</span> <?= h($start) ?></div><?php endif; ?>
    <?php if ($end !== ''): ?><div><span style="color:#6B7699;">Окончание:</span> <b style="color:#17307A;"><?= h($end) ?></b></div><?php endif; ?>
  </td></tr>
</table>
<?php endif; ?>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:12px;background:#C79322;background:linear-gradient(135deg,#C79322,#E3B94F);">
    <a href="<?= h($link) ?>" style="display:inline-block;padding:14px 34px;color:#17307A;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Узнать подробнее</a>
  </td></tr>
</table>
