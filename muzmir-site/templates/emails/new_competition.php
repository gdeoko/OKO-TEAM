<?php
/** Письмо: анонс нового конкурса. $vars: name, competition, description, start_date, end_date, competition_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$desc = (string)($vars['description'] ?? '');
$start = (string)($vars['start_date'] ?? '');
$end = (string)($vars['end_date'] ?? '');
$link = (string)($vars['competition_url'] ?? '#');
?>
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;">Новый конкурс: «<?= h($competition) ?>»</h1>
<p style="margin:0 0 16px;">Здравствуйте<?= $name !== '' ? ', ' . h($name) : '' ?>! Мы открыли приём заявок на новый конкурс и приглашаем Вас принять участие.</p>
<?php if ($desc !== ''): ?>
<p style="margin:0 0 16px;color:#5a4632;"><?= h($desc) ?></p>
<?php endif; ?>
<?php if ($start !== '' || $end !== ''): ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;background:#f6ecdb;border-radius:12px;">
  <tr><td style="padding:18px 22px;font-size:14px;line-height:1.9;color:#5a4632;">
    <?php if ($start !== ''): ?><div><span style="color:#8a7658;">Начало приёма:</span> <?= h($start) ?></div><?php endif; ?>
    <?php if ($end !== ''): ?><div><span style="color:#8a7658;">Окончание приёма:</span> <?= h($end) ?></div><?php endif; ?>
  </td></tr>
</table>
<?php endif; ?>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($link) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Узнать подробнее</a>
  </td></tr>
</table>
