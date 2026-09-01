<?php
/**
 * ПИСЬМО: ЗАКАЗ ОФОРМЛЕН, НО НЕ ОПЛАЧЕН.
 *
 * В день оглашения итогов пять человек из двадцати двух собрали заказ и не
 * дошли до оплаты: кого-то отвлекли, у кого-то не прошла карта, кто-то закрыл
 * страницу ЮKassa и потерял её. Заказ при этом остался в кабинете целым — со
 * всеми позициями и ценой, — но человек об этом не знал, и центр молча терял
 * деньги, а участник — награду.
 *
 * Письмо не продаёт заново: оно напоминает, что выбранное сохранено, и даёт
 * одну кнопку — оплатить. Никакого давления и «последний шанс»: центр не
 * распродажа, а люди тут не покупатели, а участники со званием.
 *
 * $vars: order, items, cabinet_url, name, second (второе напоминание или первое).
 */
$o       = is_array($vars['order'] ?? null) ? $vars['order'] : [];
$items   = is_array($vars['items'] ?? null) ? $vars['items'] : [];
$name    = trim((string) ($vars['name'] ?? ''));
$cabinet = (string) ($vars['cabinet_url'] ?? '#');
$second  = !empty($vars['second']);
$orderNo = (int) ($o['id'] ?? 0);
$comp    = trim((string) ($o['competition'] ?? ''));
$result  = trim((string) ($o['result'] ?? ''));
$amount  = (int) ($o['amount'] ?? 0);
$hello   = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Ваш заказ ждёт оплаты</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 20px;">
  <?= $second
      ? 'Напоминаем: заказ' . ($orderNo ? ' №' . $orderNo : '') . ' на изготовление наградного материала так и не оплачен.'
      : 'Вы оформили заказ' . ($orderNo ? ' №' . $orderNo : '') . ' на изготовление наградного материала, но оплата не прошла.' ?>
  Всё выбранное сохранено<?= $comp !== '' ? ' — конкурс «' . h($comp) . '»' : '' ?>, начинать заново не нужно.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">
    <div style="font-weight:600;color:#17307A;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px;">В заказе</div>
    <?php foreach ($items as $it):
        if (!is_array($it)) continue;
        $title = trim((string) ($it['item'] ?? ''));
        if ($title === '') continue;
        $vid = (string) ($it['kind'] ?? '') === 'digital' ? 'электронная версия' : 'оригинал на бланке';
        $fio = trim((string) ($it['fio'] ?? ''));
    ?>
      <div><b style="color:#17307A;"><?= h($title) ?></b> — <?= h($vid) ?><?= $fio !== '' ? ', ' . h($fio) : '' ?></div>
    <?php endforeach; ?>
    <?php if ($result !== ''): ?><div style="margin-top:8px;"><span style="color:#6B7699;">Ваш результат:</span> <b style="color:#17307A;"><?= h($result) ?></b></div><?php endif; ?>
    <?php if ($amount > 0): ?><div><span style="color:#6B7699;">К оплате:</span> <b style="color:#17307A;"><?= $amount ?> ₽</b></div><?php endif; ?>
  </td></tr>
</table>

<p style="margin:0 0 10px;">Оплатить можно в личном кабинете, раздел «Награды» — кнопка «Оплатить заказ» рядом с ним. Как только оплата пройдёт, мы возьмём заказ в работу и напишем Вам.</p>
<p style="margin:0 0 6px;font-size:13px;color:#6B7699;">Если оплата уже прошла, а письмо всё равно пришло — просто ответьте на него, разберёмся. Передумали заказывать — ничего делать не нужно, заказ закроется сам.</p>
