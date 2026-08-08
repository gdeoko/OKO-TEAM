<?php
/**
 * Админ-раздел «Заказы оригиналов»: все заявки на изготовление оригиналов наград.
 * Видно состав (кол-во + фото), адрес получателя, чистые дипломы (без подписи/печати,
 * с номером+QR) — скачать и распечатать. Отметки: изготовлено → трек-номер → отправить
 * (участнику уходит красивое письмо + уведомление в кабинет + статус).
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/orders.php';
orders_migrate();

/* ---------------------------- POST-обработчики ---------------------------- */
/* --------- Печатный производственный лист заказа (GET) --------- */
if (input('do') === 'print' && (int) input('id') > 0) {
    $o = one("SELECT * FROM awards_orders WHERE id=?", [(int) input('id')]);
    if ($o) {
        $items = json_decode((string) ($o['items'] ?? '[]'), true);
        $rows = '';
        foreach ((is_array($items) ? $items : []) as $it) {
            $nm = is_array($it) ? (string) ($it['item'] ?? '') : (string) $it;
            $kd = is_array($it) ? (string) ($it['kind'] ?? '') : '';
            if ($nm === '') continue;
            $rows .= '<tr><td>' . h($nm) . '</td><td>' . h($kd === 'digital' ? 'электронный' : ($kd === 'original' ? 'оригинал' : $kd)) . '</td></tr>';
        }
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Заказ №' . (int) $o['id'] . '</title>'
            . '<style>body{font-family:Arial,sans-serif;font-size:13px;color:#111;max-width:760px;margin:20px auto;padding:0 16px}'
            . 'h1{font-size:20px}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #999;padding:6px 9px;text-align:left}'
            . '.kv{margin:3px 0}@media print{.noprint{display:none}}</style></head><body onload="window.print()">'
            . '<h1>Производственный лист · Заказ №' . (int) $o['id'] . '</h1>'
            . '<div class="kv"><b>Получатель:</b> ' . h((string) ($o['full_name'] ?? '')) . '</div>'
            . '<div class="kv"><b>Email:</b> ' . h((string) ($o['email'] ?? '')) . ' · <b>Телефон:</b> ' . h((string) ($o['phone'] ?? '')) . '</div>'
            . '<div class="kv"><b>Индекс:</b> ' . h((string) ($o['postal_index'] ?? '')) . '</div>'
            . '<div class="kv"><b>Адрес:</b> ' . h((string) ($o['address'] ?? '')) . '</div>'
            . '<div class="kv"><b>Сумма:</b> ' . (int) ($o['amount'] ?? 0) . ' ₽ · <b>Статус:</b> ' . h((string) ($o['status'] ?? '')) . '</div>'
            . '<table><thead><tr><th>Наградной материал</th><th>Вид</th></tr></thead><tbody>' . $rows . '</tbody></table>'
            . '<p class="noprint"><button onclick="window.print()">Печать</button></p>'
            . '</body></html>';
        exit;
    }
    http_response_code(404); echo 'Заказ не найден'; exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('orders'); }
    $do  = input('do');
    $oid = (int) input('order');

    if ($do === 'edit_addr' && $oid) {
        update('awards_orders', [
            'full_name'    => mb_substr(trim(input('full_name')), 0, 200),
            'address'      => mb_substr(trim(input('address')), 0, 500),
            'postal_index' => mb_substr(trim(input('postal_index')), 0, 20),
            'phone'        => mb_substr(trim(input('phone')), 0, 40),
        ], 'id=:id', ['id' => $oid]);
        audit('order_edit_addr', 'awards_orders', $oid, []);
        flash('Данные заказа №' . $oid . ' обновлены.', 'success');
        admin_redirect('orders');
    }

    if ($do === 'made' && $oid) {
        update('awards_orders', ['status' => 'made', 'made_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $oid]);
        flash('Заказ №' . $oid . ' отмечен как изготовленный.', 'success');
        admin_redirect('orders');
    }
    if ($do === 'ship' && $oid) {
        $track = trim(input('tracking'));
        if ($track === '') { flash('Введите трек-номер для отправки.', 'error'); admin_redirect('orders'); }
        $ok = order_mark_shipped($oid, $track);
        flash($ok ? ('Заказ №' . $oid . ' отправлен, участнику ушло письмо с трек-номером.') : ('Статус обновлён, но письмо участнику не ушло (проверьте e-mail заказа).'), $ok ? 'success' : 'error');
        admin_redirect('orders');
    }
    if ($do === 'delivered' && $oid) {
        update('awards_orders', ['status' => 'delivered', 'delivered_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $oid]);
        flash('Заказ №' . $oid . ' отмечен как доставленный.', 'success');
        admin_redirect('orders');
    }
    if ($do === 'redispatch' && $oid) {
        $order = one("SELECT * FROM awards_orders WHERE id=?", [$oid]);
        if ($order) update('awards_orders', ['dispatched_at' => ''], 'id=:id', ['id' => $oid]);
        $ok = order_dispatch_production($oid);
        flash($ok ? ('Пакет заказа №' . $oid . ' переотправлен в производство (Telegram).') : ('Не удалось отправить в Telegram — проверьте настройку канала заказов.'), $ok ? 'success' : 'error');
        admin_redirect('orders');
    }
    if ($do === 'regen' && $oid) {
        $order = one("SELECT * FROM awards_orders WHERE id=?", [$oid]);
        if ($order) order_clean_pdfs($order, true);
        flash('Чистые дипломы заказа №' . $oid . ' перегенерированы.', 'success');
        admin_redirect('orders');
    }
}

/* ------------------------------- Данные --------------------------------- */
$filter = input('status');   // '', paid, made, shipped, delivered, new
$where  = "items NOT LIKE '%\"kind\":\"club\"%'";  // клубные членства сюда не относятся
$params = [];
if ($filter === 'archive') {
    // АРХИВ: заказ, по которому введён трек-номер, уходит из работы сюда.
    $where .= " AND status IN ('shipped','delivered')";
} elseif (in_array($filter, ['new','paid','made','shipped','delivered'], true)) {
    $where .= " AND status=?"; $params[] = $filter;
} else {
    // РАБОЧИЙ СПИСОК (правило владельца): только то, что реально нужно сделать —
    // распечатать и отправить. Неоплаченные скрыты («до оплаты заказа не существует»),
    // а отправленные уходят в архив сразу после ввода трек-номера, чтобы не мешались.
    $where .= " AND status IN ('paid','made')";
}
// Поиск по заказам (раньше его не было вовсе — заказ искали глазами по всему списку).
$qOrd = trim((string) input('q'));
if ($qOrd !== '') {
    [$sq, $sa] = search_like(['full_name','email','phone','competition','result','address','tracking','items'], $qOrd);
    if ($sq !== '') { $where .= " AND ($sq)"; $params = array_merge($params, $sa); }
    // Точный поиск по номеру заказа: «№12» или просто «12».
    if (preg_match('/^№?\s*(\d+)$/u', $qOrd, $m)) {
        $where = '(' . $where . ') OR id=?';
        $params[] = (int) $m[1];
    }
}
$orders = all("SELECT * FROM awards_orders WHERE $where ORDER BY (status='paid') DESC, id DESC LIMIT 300", $params);

// Счётчики по статусам (только оригинальные заказы).
$counts = [];
foreach (all("SELECT status, COUNT(*) c FROM awards_orders WHERE items NOT LIKE '%\"kind\":\"club\"%' GROUP BY status") as $r) {
    $counts[(string)$r['status']] = (int)$r['c'];
}
$STAT = ['paid'=>'К изготовлению','made'=>'Изготовлено','shipped'=>'Отправлено','delivered'=>'Доставлено','new'=>'Ожидает оплаты'];
$STEPS = ['paid'=>1,'made'=>2,'shipped'=>3,'delivered'=>4];

ob_start(); ?>
<div class="page-head">
  <h1>Заказы оригиналов наград</h1>
  <p class="muted small">Изготовление до 7 раб. дней, доставка Почтой России до 14 раб. дней. Дипломы ниже — «чистые» (без подписи/печати, с номером+QR): распечатайте, подпишите и поставьте печать живьём.</p>
</div>

<form method="get" class="filters" style="margin-bottom:14px">
  <input type="hidden" name="p" value="orders">
  <?php if ($filter !== ''): ?><input type="hidden" name="status" value="<?= h($filter) ?>"><?php endif; ?>
  <div class="field"><label>Поиск</label>
    <input name="q" value="<?= h($qOrd) ?>" placeholder="ФИО, почта, телефон, конкурс, результат, адрес, трек, № заказа" style="min-width:280px"></div>
  <button class="btn btn--primary btn--sm"><?= admin_icon('search') ?>Найти</button>
  <?php if ($qOrd !== ''): ?><a class="btn btn--ghost btn--sm" href="<?= a_link('orders', $filter !== '' ? ['status'=>$filter] : []) ?>">Сброс</a><?php endif; ?>
</form>

<div class="tabs" style="margin-bottom:18px;display:flex;gap:6px;flex-wrap:wrap;">
  <?php
  // «В работе» — то, что нужно распечатать и отправить. После ввода трек-номера
  // заказ уходит в «Архив» и в рабочем списке больше не мешается.
  $TABS = ['' => 'В работе'] + $STAT + ['archive' => 'Архив'];
  foreach ($TABS as $k => $lbl):
      $n = $k === ''        ? (($counts['paid'] ?? 0) + ($counts['made'] ?? 0))
         : ($k === 'archive' ? (($counts['shipped'] ?? 0) + ($counts['delivered'] ?? 0))
         : ($counts[$k] ?? 0)); ?>
    <a class="tag <?= $filter === $k ? 'active' : '' ?>" href="<?= a_link('orders', $k === '' ? [] : ['status' => $k]) ?>"
       style="padding:7px 13px;border-radius:10px;<?= $filter===$k?'background:var(--a-navy);color:#fff;':'' ?>"><?= h($lbl) ?> · <?= $n ?></a>
  <?php endforeach; ?>
</div>

<?php if (!$orders): ?>
  <p class="muted">Заказов оригиналов пока нет.</p>
<?php else: foreach ($orders as $o):
    $oid = (int)$o['id'];
    $st  = (string)$o['status'];
    $step = $STEPS[$st] ?? ($st === 'new' ? 0 : 1);
    $items = order_items_parse($o);
    $cleans = order_clean_pdfs($o);
    $trackUrl = order_pochta_url((string)($o['tracking'] ?? ''));
?>
  <div class="card" style="margin-bottom:16px;border:1px solid var(--a-line);border-radius:14px;overflow:hidden;">
    <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--a-card,#F4F6FC);border-bottom:1px solid var(--a-line);">
      <div>
        <b style="font-size:16px;color:var(--a-navy);">Заказ №<?= $oid ?></b>
        <span class="muted small"> · <?= h((string)$o['created_at']) ?></span>
        <div class="small"><?= h((string)$o['competition']) ?> · <b><?= h((string)$o['result']) ?></b></div>
      </div>
      <div>
        <?php $badge = ['paid'=>'#C79322','made'=>'#2C7BE5','shipped'=>'#17307A','delivered'=>'#1E9E5A','new'=>'#8892B0'][$st] ?? '#8892B0'; ?>
        <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:<?= $badge ?>;color:#fff;font-weight:700;font-size:12px;"><?= h($STAT[$st] ?? $st) ?></span>
      </div>
    </div>

    <div style="padding:16px 18px;">
      <!-- Прогресс -->
      <div style="display:flex;gap:6px;margin-bottom:16px;">
        <?php foreach (['paid'=>'Оплачено','made'=>'Изготовлено','shipped'=>'Отправлено','delivered'=>'Доставлено'] as $sk => $sl): $on = $step >= $STEPS[$sk]; ?>
          <div style="flex:1;text-align:center;">
            <div style="height:6px;border-radius:4px;background:<?= $on ? 'var(--a-navy)' : 'rgba(0,0,0,.1)' ?>;"></div>
            <div class="small" style="margin-top:4px;color:<?= $on ? 'var(--a-navy)' : '#9AA' ?>;font-weight:<?= $on?700:400 ?>;"><?= $sl ?></div>
          </div>
        <?php endforeach; ?>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <!-- Получатель -->
        <div>
          <div class="small muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Получатель</div>
          <div><b><?= h((string)$o['full_name']) ?></b><?= vip_mark((int)($o['user_id'] ?? 0)) ?></div>
          <div class="small">📍 <?= h((string)($o['address'] ?: '(адрес не указан — уточнить)')) ?></div>
          <div class="small">📞 <?= h((string)$o['phone']) ?> · ✉ <?= h((string)$o['email']) ?></div>
          <div class="small muted" style="margin-top:4px;">Сумма: <?= h(function_exists('money') ? money((int)$o['amount']) : (int)$o['amount'].' ₽') ?><?php
            // Заказ мог быть оформлен со скидкой участника Клуба — показываем, с какой
            // суммы и на сколько, иначе непонятно, почему в кассе меньше прайса.
            $ofull = (int)($o['amount_full'] ?? 0); $opct = (int)($o['discount_pct'] ?? 0);
            if ($ofull > (int)$o['amount']): ?> · было <s><?= number_format($ofull, 0, '.', ' ') ?> ₽</s><?php
              if ($opct > 0): ?>, скидка <?= $opct ?>%<?= vip_kind((int)($o['user_id'] ?? 0)) === 'club' ? ' — участник ВИП-клуба' : '' ?><?php endif;
            endif; ?></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            <a class="btn btn--ghost btn--sm" href="<?= a_link('orders', ['do'=>'print','id'=>(int)$o['id']]) ?>" target="_blank" rel="noopener"><?= admin_icon('diplomas') ?? '' ?>Печать листа</a>
            <button type="button" class="btn btn--ghost btn--sm" onclick="var f=document.getElementById('oe<?= (int)$o['id'] ?>');f.style.display=f.style.display==='none'?'grid':'none'">Редактировать адрес</button>
          </div>
          <form method="post" action="<?= url('/admin/') ?>" id="oe<?= (int)$o['id'] ?>" style="display:none;gap:6px;margin-top:8px"><?= csrf_field() ?>
            <input type="hidden" name="do" value="edit_addr"><input type="hidden" name="order" value="<?= (int)$o['id'] ?>">
            <input type="text" name="full_name" value="<?= h((string)$o['full_name']) ?>" placeholder="Получатель" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px">
            <input type="text" name="postal_index" value="<?= h((string)($o['postal_index'] ?? '')) ?>" placeholder="Индекс" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px">
            <input type="text" name="phone" value="<?= h((string)$o['phone']) ?>" placeholder="Телефон" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px">
            <textarea name="address" placeholder="Адрес" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px;min-height:52px"><?= h((string)($o['address'] ?? '')) ?></textarea>
            <button class="btn btn--navy btn--sm" type="submit">Сохранить</button>
          </form>
        </div>
        <!-- Состав с фото -->
        <div>
          <div class="small muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Состав (что изготовить)</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <?php foreach ($items as $p): ?>
              <div style="width:88px;text-align:center;">
                <?php if ($p['photo']): ?>
                  <img src="<?= h($p['photo']) ?>" alt="" style="width:88px;height:88px;object-fit:cover;border-radius:10px;border:1px solid var(--a-line);">
                <?php else: ?>
                  <div style="width:88px;height:88px;border-radius:10px;border:1px dashed var(--a-line);display:flex;align-items:center;justify-content:center;color:#9AA;font-size:11px;">нет фото</div>
                <?php endif; ?>
                <div class="small" style="margin-top:4px;line-height:1.2;"><?= h($p['item']) ?></div>
                <div class="small" style="font-weight:700;color:var(--a-navy);">× <?= (int)$p['count'] ?></div>
              </div>
            <?php endforeach; ?>
          </div>
        </div>
      </div>

      <!-- Чистые дипломы для печати -->
      <?php if ($cleans): ?>
        <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--a-line);">
          <div class="small muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">Дипломы для печати (чистые, с номером+QR)</div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <?php foreach ($cleans as $c): ?>
              <a class="btn btn--ghost btn--sm" href="<?= h($c['url']) ?>" target="_blank"><?= admin_icon('download') ?><span><?= h($c['label']) ?></span></a>
            <?php endforeach; ?>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline;"><?= csrf_field() ?>
              <input type="hidden" name="do" value="regen"><input type="hidden" name="order" value="<?= $oid ?>">
              <button class="btn btn--ghost btn--sm" type="submit">Перегенерировать</button>
            </form>
          </div>
        </div>
      <?php endif; ?>

      <!-- Действия -->
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--a-line);display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <?php if ($st === 'paid'): ?>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline;"><?= csrf_field() ?>
            <input type="hidden" name="do" value="made"><input type="hidden" name="order" value="<?= $oid ?>">
            <button class="btn btn--navy btn--sm" type="submit"><?= admin_icon('check') ?>Отметить «Изготовлено»</button>
          </form>
        <?php endif; ?>
        <?php if (in_array($st, ['paid','made'], true)): ?>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline-flex;gap:6px;align-items:center;"><?= csrf_field() ?>
            <input type="hidden" name="do" value="ship"><input type="hidden" name="order" value="<?= $oid ?>">
            <input type="text" name="tracking" placeholder="Трек-номер Почты России" required
                   style="padding:8px 12px;border:1px solid var(--a-line);border-radius:9px;min-width:220px;">
            <button class="btn btn--primary btn--sm" type="submit"><?= admin_icon('truck') ?>Отправить (письмо участнику)</button>
          </form>
        <?php endif; ?>
        <?php if ($st === 'shipped'): ?>
          <span class="small">Трек: <b><?= h((string)$o['tracking']) ?></b></span>
          <?php if ($trackUrl): ?><a class="btn btn--ghost btn--sm" href="<?= h($trackUrl) ?>" target="_blank">Отследить</a><?php endif; ?>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline;"><?= csrf_field() ?>
            <input type="hidden" name="do" value="delivered"><input type="hidden" name="order" value="<?= $oid ?>">
            <button class="btn btn--navy btn--sm" type="submit"><?= admin_icon('check') ?>Доставлено</button>
          </form>
        <?php endif; ?>
        <?php if ($st === 'delivered'): ?>
          <span class="small" style="color:#1E9E5A;font-weight:700;">✓ Доставлено<?= !empty($o['delivered_at']) ? ' · '.h((string)$o['delivered_at']) : '' ?></span>
        <?php endif; ?>
        <form method="post" action="<?= url('/admin/') ?>" style="display:inline;margin-left:auto;"><?= csrf_field() ?>
          <input type="hidden" name="do" value="redispatch"><input type="hidden" name="order" value="<?= $oid ?>">
          <button class="btn btn--ghost btn--sm" type="submit"><?= admin_icon('send') ?>В Telegram-производство</button>
        </form>
      </div>
    </div>
  </div>
<?php endforeach; endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Заказы оригиналов', $content, 'orders');
