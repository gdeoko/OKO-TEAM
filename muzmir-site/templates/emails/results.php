<?php
/** Письмо: результаты объявлены. $vars: name, competition, result, score, results_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$result = (string)($vars['result'] ?? '');
$score = (string)($vars['score'] ?? '');
$results = (string)($vars['results_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;line-height:1.25;">Результаты конкурса</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Жюри завершило работу по конкурсу «<?= h($competition) ?>». Благодарим Вас за участие.</p>
<?php if ($result !== ''): ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:linear-gradient(135deg,#fbf1de,#f3e2c4);border-radius:14px;border:1px solid #e6d0a8;">
  <tr><td style="padding:24px;text-align:center;">
    <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#a0522d;margin-bottom:6px;">Ваш результат</div>
    <div style="font-size:22px;font-weight:700;color:#7a2e1e;line-height:1.25;">«<?= h($result) ?>»</div>
    <?php if ($score !== ''): ?><div style="margin-top:6px;font-size:14px;color:#8a7658;">Оценка жюри: <?= h($score) ?></div><?php endif; ?>
  </td></tr>
</table>
<?php endif; ?>

<p style="margin:0 0 6px;">Полный протокол и Ваш диплом доступны на странице результатов и в личном кабинете.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($results) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Смотреть результаты</a>
  </td></tr>
</table>
