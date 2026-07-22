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
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;line-height:1.25;">Новый конкурс: «<?= h($competition) ?>»</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 16px;">Мы открыли приём заявок на новый конкурс и приглашаем Вас принять участие.</p>
<?php if ($desc !== ''): ?>
<p style="margin:0 0 20px;color:#5a4632;"><?= h($desc) ?></p>
<?php endif; ?>
<?php if ($start !== '' || $end !== ''): ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#f6ecdb;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#5a4632;">
    <div style="font-weight:600;color:#7a2e1e;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Сроки приёма</div>
    <?php if ($start !== ''): ?><div><span style="color:#8a7658;">Начало:</span> <?= h($start) ?></div><?php endif; ?>
    <?php if ($end !== ''): ?><div><span style="color:#8a7658;">Окончание:</span> <b style="color:#7a2e1e;"><?= h($end) ?></b></div><?php endif; ?>
  </td></tr>
</table>
<?php endif; ?>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($link) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Узнать подробнее</a>
  </td></tr>
</table>
