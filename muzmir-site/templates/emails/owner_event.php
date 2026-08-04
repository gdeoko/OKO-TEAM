<?php
/**
 * Компактное событийное письмо владельцу (owner_notify).
 * Скоуп: $topic, $title, $text, $fields (пары «Подпись => значение»).
 * Обёртка (шапка/подвал) — общий фирменный лейаут mail_template().
 */
$topic  = (string) ($topic ?? '');
$title  = (string) ($title ?? '');
$text   = (string) ($text ?? '');
$fields = is_array($fields ?? null) ? $fields : [];
?>
<div style="display:inline-block;background:#7a2e1e;color:#fff;font-size:12px;letter-spacing:.08em;
            text-transform:uppercase;font-weight:600;padding:5px 12px;border-radius:999px;margin:0 0 14px;">
  <?= h($topic) ?>
</div>
<h2 style="margin:0 0 10px;font-size:20px;line-height:1.35;color:#3a2e22;"><?= h($title) ?></h2>
<?php if (trim($text) !== ''): ?>
<p style="margin:0 0 14px;"><?= nl2br(h($text)) ?></p>
<?php endif; ?>
<?php if ($fields): ?>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
       style="background:#f6efe3;border-radius:10px;font-size:14px;line-height:1.55;">
  <?php foreach ($fields as $k => $v): ?>
  <tr>
    <td style="padding:7px 14px;color:#8a7658;white-space:nowrap;vertical-align:top;width:1%;"><?= h((string) $k) ?></td>
    <td style="padding:7px 14px;color:#3a2e22;font-weight:600;"><?= h((string) $v) ?></td>
  </tr>
  <?php endforeach; ?>
</table>
<?php endif; ?>
<p style="margin:16px 0 0;font-size:12px;color:#a8977c;">Автоматическое уведомление сайта. Время: <?= h(date('d.m.Y H:i')) ?> МСК.</p>
