<?php
/**
 * ПИСЬМО: ЗАКАЗ НАГРАДНЫХ МАТЕРИАЛОВ ПРИНЯТ.
 *
 * До этого письма человек, оплативший награду, получал общее payment_success:
 * «Мы подтверждаем оплату участия в конкурсе… Работа передана жюри. Результаты
 * и диплом придут на этот адрес». Он платил за изготовление диплома уже ПОСЛЕ
 * оглашения — и получал письмо про участие, которое давно состоялось, без
 * единого слова о том, что именно он купил и когда это придёт. Отсюда и
 * вопросы в чат: «я оплатил, а мне пишут про жюри — деньги дошли?»
 *
 * Здесь по порядку: что заказано, на какую сумму, когда будет готово и как
 * доедет. Сроки разные и в одном заказе могут быть оба вида:
 *   • электронные — 5 рабочих дней (участникам Клуба 3), точная дата ниже;
 *   • оригиналы   — печать, затем Почта России, трек-номер письмом.
 *
 * $vars: order (строка awards_orders), items (массив позиций), digital_date
 *        (готовность электронных, 'd.m.Y' или ''), cabinet_url, name.
 */
$o        = is_array($vars['order'] ?? null) ? $vars['order'] : [];
$items    = is_array($vars['items'] ?? null) ? $vars['items'] : [];
$name     = trim((string) ($vars['name'] ?? ''));
$cabinet  = (string) ($vars['cabinet_url'] ?? '#');
$digDate  = (string) ($vars['digital_date'] ?? '');
$orderNo  = (int) ($o['id'] ?? 0);
$comp     = trim((string) ($o['competition'] ?? ''));
$result   = trim((string) ($o['result'] ?? ''));
$amount   = (int) ($o['amount'] ?? 0);
$address  = trim((string) ($o['address'] ?? ''));
$hello    = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';

$hasDigital  = false;
$hasOriginal = false;
foreach ($items as $it) {
    if (!is_array($it)) continue;
    if ((string) ($it['kind'] ?? '') === 'digital') $hasDigital = true; else $hasOriginal = true;
}
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Заявка на изготовление принята</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">Оплата получена, заказ<?= $orderNo ? ' №' . $orderNo : '' ?> принят в работу<?= $comp !== '' ? ' по конкурсу «' . h($comp) . '»' : '' ?>. Ниже — что именно изготавливаем и когда Вы это получите.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">
    <div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">Ваш заказ</div>
    <?php foreach ($items as $it):
        if (!is_array($it)) continue;
        $title = trim((string) ($it['item'] ?? ''));
        if ($title === '') continue;
        $vid   = (string) ($it['kind'] ?? '') === 'digital' ? 'электронная версия' : 'оригинал на бланке';
        $fio   = trim((string) ($it['fio'] ?? ''));
    ?>
      <div><b style="color:#17307A;"><?= h($title) ?></b> — <?= h($vid) ?><?= $fio !== '' ? ', ' . h($fio) : '' ?></div>
    <?php endforeach; ?>
    <?php if ($result !== ''): ?><div style="margin-top:8px;"><span style="color:#6B7699;">Аттестационный результат:</span> <b style="color:#17307A;"><?= h($result) ?></b></div><?php endif; ?>
    <?php if ($amount > 0): ?><div><span style="color:#6B7699;">Оплачено:</span> <?= $amount ?> ₽</div><?php endif; ?>
  </td></tr>
</table>

<?php /* СРОКИ — ОТДЕЛЬНО ПО ВИДАМ. В одном заказе бывают оба, и путать их нельзя:
         электронное приходит письмом к названной дате, оригинал едет посылкой. */ ?>
<p style="margin:0 0 10px;font-weight:700;color:#17307A;font-size:16px;">Сроки</p>

<?php if ($hasDigital): ?>
  <p style="margin:0 0 14px;">
    <b style="color:#17307A;">Электронные наградные материалы.</b>
    Изготавливаем в течение 5 рабочих дней<?= $digDate !== '' ? ' — будут готовы ' . h($digDate) : '' ?>.
    Придут на этот адрес и появятся в личном кабинете. Участникам ВИП-клуба — за 3 рабочих дня.
  </p>
<?php endif; ?>

<?php if ($hasOriginal): ?>
  <p style="margin:0 0 14px;">
    <b style="color:#17307A;">Оригиналы на бланках.</b>
    Печатаем и передаём в отправку Почтой России. Как только посылка уйдёт, пришлём
    письмо с трек-номером — отследить можно и в личном кабинете. Доставка обычно
    занимает до 14 рабочих дней. Стоимость доставки оплачивается при получении,
    наложенным платежом.
  </p>
  <?php if ($address !== ''): ?>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#FBF8F1;border:1px solid #E6E0D2;border-radius:12px;">
      <tr><td style="padding:14px 18px;font-size:14px;line-height:1.7;color:#33406B;">
        <span style="color:#6B7699;">Адрес доставки:</span> <?= h($address) ?><br>
        <span style="color:#6B7699;font-size:13px;">Нашли ошибку в адресе — напишите нам, пока посылка не ушла.</span>
      </td></tr>
    </table>
  <?php endif; ?>
<?php endif; ?>

<p style="margin:0 0 6px;">Статус заказа виден в личном кабинете — там же появятся готовые файлы<?= $hasOriginal ? ' и трек-номер отправления' : '' ?>.</p>
