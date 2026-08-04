<?php
/** Письмо: результаты объявлены. $vars: name, competition, result, score, results_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$result = (string)($vars['result'] ?? '');
$score = (string)($vars['score'] ?? '');
$results = (string)($vars['results_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Результаты конкурса</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Жюри завершило работу по конкурсу «<?= h($competition) ?>». Благодарим Вас за участие.</p>
<?php if ($result !== ''): ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;border-radius:16px;overflow:hidden;">
  <tr><td style="background:#17307A;background:linear-gradient(135deg,#17307A 0%,#24499F 100%);padding:26px 24px;text-align:center;">
    <div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:8px;">Ваш результат</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#C79322;line-height:1.25;">«<?= h($result) ?>»</div>
    <?php if ($score !== ''): ?><div style="margin-top:8px;font-size:14px;color:rgba(255,255,255,.85);">Оценка жюри: <?= h($score) ?></div><?php endif; ?>
  </td></tr>
</table>
<?php endif; ?>

<p style="margin:0 0 6px;">Полный протокол и Ваш диплом доступны на странице результатов и в личном кабинете.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:12px;background:#C79322;background:linear-gradient(135deg,#C79322,#E3B94F);">
    <a href="<?= h($results) ?>" style="display:inline-block;padding:14px 34px;color:#17307A;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Смотреть результаты</a>
  </td></tr>
</table>
