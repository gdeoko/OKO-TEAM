<?php
/** Служебное письмо владельцу: годовой отчёт (PDF во вложении). $vars: year, message, report_url. */
$yearRep = (string)($vars['year'] ?? '');
$message = (string)($vars['message'] ?? '');
$reportUrl = (string)($vars['report_url'] ?? '');
?>
<div style="display:inline-block;background:#17307A;color:#fff;font-size:12px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;padding:5px 12px;border-radius:999px;margin:0 0 14px;">Отчёт</div>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Годовой отчёт<?= $yearRep !== '' ? ' за ' . h($yearRep) . ' год' : '' ?></h1>
<p style="margin:0 0 16px;"><?= nl2br(h($message)) ?></p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:18px 24px;font-size:14px;line-height:1.8;color:#33406B;">
    <div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Документ</div>
    <div><span style="color:#6B7699;">Формат:</span> PDF, во вложении к этому письму</div>
  </td></tr>
</table>

<?php if ($reportUrl !== ''): ?>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px;">
  <tr><td style="border-radius:12px;background:#C79322;background:linear-gradient(135deg,#C79322,#E3B94F);">
    <a href="<?= h($reportUrl) ?>" style="display:inline-block;padding:14px 34px;color:#17307A;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Открыть отчёт</a>
  </td></tr>
</table>
<?php endif; ?>
