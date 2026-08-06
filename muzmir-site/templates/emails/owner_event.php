<?php
/**
 * Компактное событийное письмо владельцу (owner_notify).
 * Скоуп: $topic, $title, $text, $fields (пары «Подпись => значение»).
 * Обёртка (шапка/подвал) — общий фирменный лейаут mail_template().
 */
$topic   = (string) ($topic ?? '');
$title   = (string) ($title ?? '');
$text    = (string) ($text ?? '');
$fields  = is_array($fields ?? null) ? $fields : [];
$actions = is_array($actions ?? null) ? $actions : [];
/** Значение-ссылку рендерим кликабельно (конкурсный материал, email). */
$renderVal = static function (string $v): string {
    $v = trim($v);
    if (preg_match('~^https?://~i', $v)) {
        $url = preg_replace('~\s+\(.*\)$~', '', $v); // отрезаем "(VK Видео)" из href
        return '<a href="' . htmlspecialchars($url, ENT_QUOTES) . '" style="color:#17307A;word-break:break-all;">' . h($v) . '</a>';
    }
    if (filter_var($v, FILTER_VALIDATE_EMAIL)) {
        return '<a href="mailto:' . htmlspecialchars($v, ENT_QUOTES) . '" style="color:#17307A;">' . h($v) . '</a>';
    }
    return h($v);
};
?>
<div style="display:inline-block;background:#17307A;color:#fff;font-size:12px;letter-spacing:.08em;
            text-transform:uppercase;font-weight:600;padding:5px 12px;border-radius:999px;margin:0 0 14px;">
  <?= h($topic) ?>
</div>
<h2 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.35;color:#17307A;"><?= h($title) ?></h2>
<?php if (trim($text) !== ''): ?>
<p style="margin:0 0 14px;"><?= nl2br(h($text)) ?></p>
<?php endif; ?>
<?php if ($fields): ?>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
       style="background:#F4F6FC;border-radius:10px;font-size:14px;line-height:1.55;">
  <?php foreach ($fields as $k => $v): ?>
  <tr>
    <td style="padding:7px 14px;color:#6B7699;white-space:nowrap;vertical-align:top;width:1%;border-bottom:1px solid #E6EAF5;"><?= h((string) $k) ?></td>
    <td style="padding:7px 14px;color:#1D2B55;font-weight:600;border-bottom:1px solid #E6EAF5;"><?= $renderVal((string) $v) ?></td>
  </tr>
  <?php endforeach; ?>
</table>
<?php endif; ?>
<?php if ($actions): ?>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0;">
  <tr>
  <?php foreach ($actions as $i => $act): [$label, $aurl] = $act; ?>
    <td style="padding:0 8px 8px 0;">
      <a href="<?= htmlspecialchars($aurl, ENT_QUOTES) ?>"
         style="display:inline-block;background:<?= $i === 0 ? '#17307A' : '#EAEFFB' ?>;color:<?= $i === 0 ? '#fff' : '#17307A' ?>;
                text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:10px;"><?= h($label) ?></a>
    </td>
  <?php endforeach; ?>
  </tr>
</table>
<?php endif; ?>
<p style="margin:16px 0 0;font-size:12px;color:#96A0BE;">Автоматическое уведомление сайта. Время: <?= h(date('d.m.Y H:i')) ?> МСК.</p>
