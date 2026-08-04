<?php
/** Служебное письмо владельцу: ежемесячный отчёт. $vars: month_title, message (текст сводки), admin_url. */
$monthTitle = trim((string)($vars['month_title'] ?? ''));
$message = (string)($vars['message'] ?? '');
$adminUrl = (string)($vars['admin_url'] ?? '');
?>
<div style="display:inline-block;background:#17307A;color:#fff;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;padding:5px 12px;border-radius:999px;margin:0 0 14px;">Отчёт</div>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Сводка за <?= h($monthTitle !== '' ? $monthTitle : 'месяц') ?></h1>
<p style="margin:0 0 16px;">Автоматический отчёт о работе сайта культурного центра «Музыкальный Мир».</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">
    <?= nl2br(h($message)) ?>
  </td></tr>
</table>

<?php if ($adminUrl !== ''): ?>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;">
  <tr><td style="border-radius:12px;background:#C79322;background:linear-gradient(135deg,#C79322,#E3B94F);">
    <a href="<?= h($adminUrl) ?>" style="display:inline-block;padding:14px 34px;color:#17307A;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Открыть аналитику</a>
  </td></tr>
</table>
<?php endif; ?>
