<?php
/** Письмо: напоминание о сроке приёма заявок. $vars: name, competition, end_date, apply_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$end = (string)($vars['end_date'] ?? '');
$apply = (string)($vars['apply_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Приём заявок скоро закроется</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Напоминаем, что заявки на конкурс «<?= h($competition) ?>» принимаются ещё недолго. Успейте показать свою работу жюри.</p>
<?php if ($end !== ''): ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:22px 24px;text-align:center;">
    <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#C79322;margin-bottom:6px;">Заявки принимаются до</div>
    <div style="font-size:20px;font-weight:700;color:#17307A;line-height:1.25;"><?= h($end) ?></div>
  </td></tr>
</table>
<?php endif; ?>

<p style="margin:0 0 6px;">Заполнение занимает несколько минут. Вы можете подать работу в любой удобной номинации.</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;">
  <tr><td style="border-radius:12px;background:#C79322;background:linear-gradient(135deg,#C79322,#E3B94F);">
    <a href="<?= h($apply) ?>" style="display:inline-block;padding:14px 34px;color:#17307A;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Подать заявку</a>
  </td></tr>
</table>
