<?php
/** Письмо: напоминание о скором старте конкурса (за неделю до открытия приёма
 * заявок, подписка со страницы «Календарь»). $vars: name, competition, start_date,
 * countdown (готовая фраза «через 7 дней»), comp_url. */
$name = trim((string)($vars['name'] ?? ''));
$competition = (string)($vars['competition'] ?? '');
$start = (string)($vars['start_date'] ?? '');
$countdown = (string)($vars['countdown'] ?? '');
$comp = (string)($vars['comp_url'] ?? '#');
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Конкурс скоро стартует</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Вы просили напомнить о конкурсе «<?= h($competition) ?>»<?= $countdown !== '' ? ' - и вот он уже ' . h($countdown) : '' ?>. Самое время подготовить работу, чтобы подать заявку в первый же день приёма.</p>
<?php if ($start !== ''): ?>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:22px 24px;text-align:center;">
    <div style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#C79322;margin-bottom:6px;">Приём заявок открывается</div>
    <div style="font-size:20px;font-weight:700;color:#17307A;line-height:1.25;"><?= h($start) ?></div>
  </td></tr>
</table>
<?php endif; ?>

<p style="margin:0 0 6px;">Загляните на страницу конкурса - там условия участия, номинации и сроки. Мы подготовили всё, чтобы Вы ничего не упустили.</p>

<p style="margin:18px 0 0;font-size:13px;color:#6B7699;">Это единичное напоминание - повторных писем по этому конкурсу не будет.</p>
