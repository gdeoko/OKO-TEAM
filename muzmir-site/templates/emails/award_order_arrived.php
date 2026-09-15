<?php
/**
 * ПИСЬМО: ПОСЫЛКА ПРИШЛА В ОТДЕЛЕНИЕ, ЕЁ МОЖНО ЗАБРАТЬ.
 *
 * Трек-номер человек получает при отправке, но следить за ним сам он не будет:
 * зайти на сайт Почты, вбить четырнадцать цифр, разобрать «прибыло в место
 * вручения» — это работа. В итоге посылка месяц лежит в отделении и уезжает
 * обратно, а центр узнаёт об этом, когда она возвращается.
 *
 * АДРЕС ЗДЕСЬ — ОТДЕЛЕНИЯ, А НЕ ИЗ ЗАЯВКИ. Это разные вещи, и путать их нельзя:
 * в заявке человек пишет, куда доставить (дом, квартира), а забирать он идёт в
 * отделение по индексу. Поэтому в письме крупно стоит индекс, ссылка на само
 * отделение на сайте Почты (там режим работы и телефон) и ссылка на карту —
 * открывается сразу на нужном отделении.
 *
 * $vars: order (строка awards_orders), items (массив позиций), name,
 *        index (индекс отделения), place (город/населённый пункт, если известен),
 *        track (трек-номер), office_url, map_url, keep_until (до какого числа хранится)
 */
$o       = is_array($vars['order'] ?? null) ? $vars['order'] : [];
$items   = is_array($vars['items'] ?? null) ? $vars['items'] : [];
$name    = trim((string) ($vars['name'] ?? ''));
$index   = trim((string) ($vars['index'] ?? ''));
$place   = trim((string) ($vars['place'] ?? ''));
$track   = trim((string) ($vars['track'] ?? ''));
$office  = (string) ($vars['office_url'] ?? '');
$map     = (string) ($vars['map_url'] ?? '');
$keep    = trim((string) ($vars['keep_until'] ?? ''));
$orderNo = (int) ($o['id'] ?? 0);
$comp    = trim((string) ($o['competition'] ?? ''));
$hello   = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Посылка пришла — её можно забрать</h1>

<p style="margin:0 0 14px;"><?= $hello ?></p>

<p style="margin:0 0 16px;">Ваш наградной материал<?= $comp !== '' ? ' по конкурсу «' . h($comp) . '»' : '' ?>
   доставлен в отделение Почты России и ждёт Вас.</p>

<?php if ($index !== ''): ?>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border-collapse:collapse;background:#F7F8FC;border:1px solid #E2E6F0;border-radius:10px;">
  <tr><td style="padding:18px 20px;">
    <div style="font-size:13px;color:#6B7280;margin-bottom:6px;">Отделение Почты России</div>
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;color:#17307A;font-weight:700;letter-spacing:1px;"><?= h($index) ?></div>
    <?php if ($place !== ''): ?>
      <div style="font-size:15px;color:#1a1a1a;margin-top:6px;"><?= h($place) ?></div>
    <?php endif; ?>
    <div style="margin-top:14px;">
      <?php if ($office !== ''): ?>
        <a href="<?= h($office) ?>" style="display:inline-block;margin:0 10px 8px 0;padding:10px 18px;background:#17307A;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;">Адрес и режим работы</a>
      <?php endif; ?>
      <?php if ($map !== ''): ?>
        <a href="<?= h($map) ?>" style="display:inline-block;margin:0 0 8px;padding:10px 18px;background:#fff;color:#17307A;text-decoration:none;border:1px solid #17307A;border-radius:8px;font-size:14px;">Показать на карте</a>
      <?php endif; ?>
    </div>
  </td></tr>
</table>
<?php endif; ?>

<p style="margin:0 0 8px;font-size:15px;">
  <b>Что взять с собой:</b> паспорт<?= $track !== '' ? ' и номер отправления' : '' ?>.
</p>
<?php if ($track !== ''): ?>
<p style="margin:0 0 16px;font-size:15px;">
  Номер отправления: <b style="letter-spacing:.5px;"><?= h($track) ?></b>
</p>
<?php endif; ?>

<?php if ($items): ?>
<p style="margin:0 0 8px;font-size:15px;"><b>В посылке:</b></p>
<ul style="margin:0 0 16px;padding-left:20px;font-size:15px;">
  <?php foreach ($items as $it): if (!is_array($it)) continue; ?>
    <li><?= h((string) ($it['item'] ?? '')) ?></li>
  <?php endforeach; ?>
</ul>
<?php endif; ?>

<?php if ($keep !== ''): ?>
<p style="margin:0 0 16px;padding:12px 16px;background:#FFF7E6;border-left:3px solid #C79322;font-size:14px;color:#6B5418;">
  Отделение хранит посылку до <b><?= h($keep) ?></b>. После этого она вернётся отправителю,
  и получить её будет уже нельзя — постарайтесь забрать до этой даты.
</p>
<?php endif; ?>

<p style="margin:0 0 6px;font-size:14px;color:#6B7280;">Заказ № <?= $orderNo ?></p>
