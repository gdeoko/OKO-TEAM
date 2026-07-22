<?php
/** Универсальное письмо. $vars: title, message (строка или HTML), name, cta_url, cta_text. */
$title   = trim((string)($vars['title'] ?? 'Уведомление'));
$message = (string)($vars['message'] ?? '');
$name    = trim((string)($vars['name'] ?? ($vars['full_name'] ?? '')));
$ctaUrl  = (string)($vars['cta_url'] ?? '');
$ctaText = (string)($vars['cta_text'] ?? '');
// message может прийти как готовый HTML (содержит теги) или как простой текст.
$isHtml  = $message !== '' && $message !== strip_tags($message);
?>
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;line-height:1.25;"><?= h($title) ?></h1>
<?php if ($name !== ''): ?>
<p style="margin:0 0 14px;">Здравствуйте, <?= h($name) ?>!</p>
<?php endif; ?>
<?php if ($isHtml): ?>
<div style="margin:0 0 8px;line-height:1.7;"><?= $message ?></div>
<?php else: ?>
<p style="margin:0 0 8px;line-height:1.7;"><?= nl2br(h($message)) ?></p>
<?php endif; ?>
<?php if ($ctaUrl !== ''): ?>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($ctaUrl) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;"><?= h($ctaText !== '' ? $ctaText : 'Перейти на сайт') ?></a>
  </td></tr>
</table>
<?php endif; ?>
