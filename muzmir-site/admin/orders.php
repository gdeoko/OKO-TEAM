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

/* --------- ПИСЬМО ОБ ОТПРАВКЕ: ПОКАЗАТЬ ТО, ЧТО ПОЛУЧИЛ УЧАСТНИК ---------
 *
 * Письмо с трек-номером уходит прямой отправкой, минуя очередь рассылок, и в
 * «Рассылках» его нет — после нажатия «Отправить» проверить было нечего.
 * Сначала ищем письмо в журнале личных писем; если заказ отправлен раньше, чем
 * журнал появился, письмо собирается заново из того же шаблона и тех же данных
 * заказа — получается ровно то, что ушло участнику.
 */
if (($__letter = (int) input('letter')) > 0) {
    $o = one("SELECT * FROM awards_orders WHERE id=?", [$__letter]);
    if (!$o) { http_response_code(404); echo 'Заказ не найден'; exit; }
    $html = '';
    if (is_file(BASE_PATH . '/core/mail_archive.php')) {
        require_once BASE_PATH . '/core/mail_archive.php';
        mail_archive_migrate();
        $rec = one("SELECT body FROM mail_sent WHERE to_email=? AND subject LIKE ? ORDER BY id DESC LIMIT 1",
                   [(string) ($o['email'] ?? ''), '%заказ №' . $__letter]);
        if ($rec) $html = (string) $rec['body'];
    }
    if ($html === '') $html = order_ship_email($o);
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
    echo $html;
    exit;
}

/* --------- Выдача чистого бланка (GET) ---------
 *
 * Бланк без подписи и печати лежит вне веб-корня и отдаётся ТОЛЬКО отсюда: этот
 * файл открывается после входа в админку, а прямой ссылки на него не существует.
 * Раньше бланк писался в public/diplomas/ рядом с готовыми дипломами, и имя у
 * него складывалось из номера диплома, который участник знает. Подставив к
 * своему номеру «-clean», человек скачивал пустой бланк и печатал его сам,
 * вместо того чтобы заказать оригинал. Теперь такой ссылки нет.
 */
if (($__blank = trim((string) input('blank'))) !== '') {
    $name = basename($__blank);
    // Имя проверяем строго: любые пути и точки — отказ, каталог закрытый.
    if (!preg_match('~^[A-Za-z0-9._-]+\.pdf$~', $name) || str_contains($name, '..')) {
        http_response_code(400); echo 'Некорректное имя файла'; exit;
    }
    $abs = order_clean_dir() . $name;
    // Часть бланков осталась в старом каталоге до переноса — их тоже отдаём,
    // но по этому же закрытому маршруту.
    if (!is_file($abs)) $abs = BASE_PATH . '/public/diplomas/' . $name;
    if (!is_file($abs)) { http_response_code(404); echo 'Бланк не найден'; exit; }
    header('Content-Type: application/pdf');
    header('Content-Length: ' . (string) filesize($abs));
    header('Content-Disposition: ' . (input('dl') !== '' ? 'attachment' : 'inline') . '; filename="' . $name . '"');
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: private, no-store');
    readfile($abs);
    exit;
}

/* ---------------------------- POST-обработчики ---------------------------- */
/* --------- Печатный производственный лист заказа (GET) --------- */
if (input('do') === 'print' && (int) input('id') > 0) {
    $o = one("SELECT * FROM awards_orders WHERE id=?", [(int) input('id')]);
    if ($o) {
        // Лист печатается на всю посылку: в коробку кладётся один вкладыш, а не
        // по листу на каждый оплаченный заказ.
        $pids = array_values(array_unique(array_filter(
            array_map('intval', preg_split('~[^0-9]+~', (string) input('orders')) ?: []),
            static fn(int $x): bool => $x > 0
        )));
        if (!$pids) $pids = [(int) $o['id']];
        $rows = '';
        $sum  = 0;
        foreach ($pids as $pid) {
            $po = $pid === (int) $o['id'] ? $o : one("SELECT * FROM awards_orders WHERE id=?", [$pid]);
            if (!$po) continue;
            $sum += (int) ($po['amount'] ?? 0);
            foreach ((array) json_decode((string) ($po['items'] ?? '[]'), true) as $it) {
                $nm = is_array($it) ? (string) ($it['item'] ?? '') : (string) $it;
                $kd = is_array($it) ? (string) ($it['kind'] ?? '') : '';
                if ($nm === '') continue;
                $fio = is_array($it) ? trim((string) ($it['fio'] ?? '')) : '';
                $rows .= '<tr><td>' . h($nm) . ($fio !== '' ? '<br><small>' . h($fio) . '</small>' : '') . '</td>'
                       . '<td>' . h($kd === 'digital' ? 'электронный' : ($kd === 'original' ? 'оригинал' : $kd)) . '</td>'
                       . '<td>№' . $pid . '</td></tr>';
            }
        }
        $o['amount'] = $sum;
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Заказ №' . (int) $o['id'] . '</title>'
            . '<style>body{font-family:Arial,sans-serif;font-size:13px;color:#111;max-width:760px;margin:20px auto;padding:0 16px}'
            . 'h1{font-size:20px}table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #999;padding:6px 9px;text-align:left}'
            . '.kv{margin:3px 0}@media print{.noprint{display:none}}</style></head><body onload="window.print()">'
            . '<h1>Производственный лист · ' . (count($pids) > 1 ? 'посылка, заказы №' . implode(', №', $pids) : 'заказ №' . (int) $o['id']) . '</h1>'
            . '<div class="kv"><b>Получатель:</b> ' . h((string) ($o['full_name'] ?? '')) . '</div>'
            . '<div class="kv"><b>Email:</b> ' . h((string) ($o['email'] ?? '')) . ' · <b>Телефон:</b> ' . h((string) ($o['phone'] ?? '')) . '</div>'
            . '<div class="kv"><b>Индекс:</b> ' . h((string) ($o['postal_index'] ?? '')) . '</div>'
            . '<div class="kv"><b>Адрес:</b> ' . h((string) ($o['address'] ?? '')) . '</div>'
            . '<div class="kv"><b>Сумма:</b> ' . (int) ($o['amount'] ?? 0) . ' ₽ · <b>Статус:</b> ' . h((string) ($o['status'] ?? '')) . '</div>'
            . '<table><thead><tr><th>Наградной материал</th><th>Вид</th><th>Заказ</th></tr></thead><tbody>' . $rows . '</tbody></table>'
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

    // ЗАКАЗЫ ОДНОГО ПОЛУЧАТЕЛЯ ОБРАБАТЫВАЮТСЯ ВМЕСТЕ.
    //
    // Человек заказывает награды по каждой заявке отдельно, а едут они одной
    // посылкой. Кнопка «Отправить» поэтому одна на всю группу: иначе на три
    // благодарности и медаль пришлось бы четыре раза вводить один и тот же
    // трек-номер, а участник получил бы четыре письма об отправке.
    $ids = array_values(array_unique(array_filter(
        array_map('intval', preg_split('~[^0-9]+~', (string) input('orders')) ?: []),
        static fn(int $x): bool => $x > 0
    )));
    if (!$ids && $oid) $ids = [$oid];
    if (!$oid && $ids) $oid = $ids[0];
    /** Сколько заказов затронуто — для сообщения человеку. */
    $manyNote = static fn(array $x): string => count($x) > 1 ? (' (заказов в посылке: ' . count($x) . ')') : '';

    if ($do === 'edit_addr' && $ids) {
        /* Адрес правится сразу у всей посылки: он у неё один по определению.
         *
         * Вместе с адресом пересчитываем и КЛЮЧ адреса. Без этого посылка,
         * которую только что переадресовали, продолжала бы собираться по старому
         * ключу — и уехала бы по прежнему адресу. */
        $newAddr = mb_substr(trim(input('address')), 0, 500);
        $newKey  = '';
        if ($newAddr !== '') {
            if (!function_exists('addr_key') && is_file(BASE_PATH . '/core/address.php')) {
                require_once BASE_PATH . '/core/address.php';
            }
            try { $newKey = function_exists('addr_key') ? addr_key($newAddr) : ''; }
            catch (\Throwable $e) { $newKey = ''; }
        }
        $fields = [
            'full_name'    => mb_substr(trim(input('full_name')), 0, 200),
            'address'      => $newAddr,
            'postal_index' => mb_substr(trim(input('postal_index')), 0, 20),
            'phone'        => mb_substr(trim(input('phone')), 0, 40),
        ];
        // Ключ переписываем, только если он посчитался: пустым значением мы бы
        // разбили посылку на отдельные отправления и отправили их по частям.
        if ($newKey !== '') $fields['addr_key'] = $newKey;
        foreach ($ids as $i) update('awards_orders', $fields, 'id=:id', ['id' => $i]);
        audit('order_edit_addr', 'awards_orders', $oid, ['orders' => $ids]);
        flash('Данные получателя обновлены' . $manyNote($ids) . '.', 'success');
        admin_redirect('orders');
    }

    if ($do === 'made' && $ids) {
        /* БЕЗ ИНДЕКСА НА ИЗГОТОВЛЕНИЕ НЕ ПРОПУСКАЕМ. Правило владельца.
         *
         * Почта России без индекса отправление не примет, а узнаётся это уже на
         * почте, с готовой посылкой на руках: кубок изготовлен, упакован, и его
         * несут обратно. Индекс проставляется сам при заказе, поэтому пустым он
         * бывает только у старых заказов и у адресов, введённых руками —
         * их и ловим здесь, до производства, пока исправить стоит одну минуту. */
        $noIndex = [];
        foreach ($ids as $i) {
            $ord = one("SELECT id, postal_index, kind FROM awards_orders WHERE id=?", [$i]);
            if (!$ord) continue;
            // Электронные и членство в клубе никуда не едут — индекс им не нужен.
            if (in_array((string) ($ord['kind'] ?? ''), ['digital', 'club'], true)) continue;
            if (!preg_match('~\d{6}~', (string) ($ord['postal_index'] ?? ''))) $noIndex[] = (int) $ord['id'];
        }
        if ($noIndex) {
            flash('Не отмечено: у заказа ' . implode(', ', array_map(static fn($x) => '№' . $x, $noIndex))
                . ' нет почтового индекса. Почта без индекса посылку не примет — впишите индекс'
                . ' в «Изменить адрес» и повторите.', 'error');
            admin_redirect('orders');
        }
        foreach ($ids as $i) update('awards_orders', ['status' => 'made', 'made_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $i]);
        flash('Отмечено как изготовленное' . $manyNote($ids) . '.', 'success');
        admin_redirect('orders');
    }
    if ($do === 'ship' && $ids) {
        $track = trim(input('tracking'));
        if ($track === '') { flash('Введите трек-номер для отправки.', 'error'); admin_redirect('orders'); }
        /* Письмо участнику — одно на посылку, но СО ВСЕМ ЕЁ СОДЕРЖИМЫМ.
         *
         * Четыре одинаковых письма подряд читаются как сбой рассылки, поэтому
         * письмо одно. Но раньше оно собиралось по первому заказу — и человек,
         * которому в одной коробке уехали дипломы, благодарность и статуэтка,
         * читал, что ему выслали только два диплома. Теперь состав письма
         * собирается по всем заказам посылки. */
        $ok = order_mark_shipped_parcel($ids, $track);
        flash($ok ? ('Отправлено, участнику ушло письмо с трек-номером' . $manyNote($ids) . '.')
                  : ('Статус обновлён, но письмо участнику не ушло (проверьте почту заказа).'), $ok ? 'success' : 'error');
        admin_redirect('orders');
    }
    if ($do === 'delivered' && $ids) {
        foreach ($ids as $i) update('awards_orders', ['status' => 'delivered', 'delivered_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $i]);
        flash('Отмечено как доставленное' . $manyNote($ids) . '.', 'success');
        admin_redirect('orders');
    }
    if ($do === 'redispatch' && $oid) {
        $order = one("SELECT * FROM awards_orders WHERE id=?", [$oid]);
        if ($order) update('awards_orders', ['dispatched_at' => ''], 'id=:id', ['id' => $oid]);
        $ok = order_dispatch_production($oid);
        flash($ok ? ('Пакет заказа №' . $oid . ' переотправлен в производство (Telegram).') : ('Не удалось отправить в Telegram — проверьте настройку канала заказов.'), $ok ? 'success' : 'error');
        admin_redirect('orders');
    }
    if ($do === 'regen' && $ids) {
        foreach ($ids as $i) {
            $order = one("SELECT * FROM awards_orders WHERE id=?", [$i]);
            if ($order) order_clean_pdfs($order, true);
        }
        flash('Наградные материалы подготовлены заново' . $manyNote($ids) . '.', 'success');
        admin_redirect('orders');
    }

    if ($do === 'cancel_refund' && $oid) {
        // Отмена заказа оригиналов с автоматическим возвратом средств в ЮKassa.
        // Возврат безопасен: yukassa_refund идемпотентен по Idempotence-Key,
        // повторный клик не создаст второго refund.
        $order = one("SELECT * FROM awards_orders WHERE id=?", [$oid]);
        if (!$order) { flash('Заказ №' . $oid . ' не найден.', 'error'); admin_redirect('orders'); }
        if (in_array((string) ($order['status'] ?? ''), ['shipped', 'delivered'], true)) {
            flash('Заказ №' . $oid . ' уже отправлен/доставлен — отменить нельзя.', 'error');
            admin_redirect('orders');
        }
        $reason = trim((string) input('cancel_reason'));
        if (!function_exists('refund_award_order') && is_file(BASE_PATH . '/core/payments.php')) require_once BASE_PATH . '/core/payments.php';

        $refund = ['ok' => false, 'amount' => 0, 'error' => null];
        try { $refund = refund_award_order($oid, $reason); } catch (\Throwable $e) { $refund = ['ok' => false, 'error' => $e->getMessage()]; }

        update('awards_orders', [
            'status'         => 'canceled',
            'canceled_at'    => date('Y-m-d H:i:s'),
            'cancel_reason'  => mb_substr($reason, 0, 500),
            'refund_amount'  => (int) ($refund['amount'] ?? 0),
            'refund_id'      => (string) ($refund['refund_id'] ?? ''),
        ], 'id=:id', ['id' => $oid]);
        audit('order_cancel_refund', 'awards_orders', $oid, [
            'refund_ok' => !empty($refund['ok']), 'amount' => (int) ($refund['amount'] ?? 0),
            'error'     => $refund['error'] ?? null,
        ]);

        // Письмо участнику о возврате.
        if (!function_exists('mail_send_failover') && is_file(BASE_PATH . '/core/mailer.php')) {
            require_once BASE_PATH . '/core/mailer.php';
        }
        if (function_exists('mail_send_failover')) {
            $to = (string) ($order['email'] ?? '');
            if ($to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) {
                $body = '<p>Здравствуйте'
                      . (trim((string) ($order['full_name'] ?? '')) !== '' ? ', ' . h((string) $order['full_name']) : '')
                      . '!</p><p>Заказ наградных материалов <b>№' . $oid . '</b> отменён'
                      . ($reason !== '' ? ' по причине: <i>' . h($reason) . '</i>' : '') . '.</p>';
                if (!empty($refund['ok']) && (int) $refund['amount'] > 0) {
                    $body .= '<p>Сумма <b>' . (int) $refund['amount'] . ' ₽</b> возвращена на ту же карту/способ оплаты. Зачисление обычно занимает до 3 рабочих дней (срок зависит от банка).</p>';
                } elseif (!empty($refund['already'])) {
                    $body .= '<p>Возврат по этому заказу уже был выполнен ранее.</p>';
                } elseif ((int) ($order['amount'] ?? 0) > 0) {
                    $body .= '<p><b>Внимание:</b> автоматический возврат не прошёл. Мы вернём деньги вручную и напишем вам отдельно.</p>';
                }
                mail_send_failover($to, 'Заказ №' . $oid . ' отменён — возврат средств', $body, ['pool' => 'tx']);
            }
        }

        $msg = 'Заказ №' . $oid . ' отменён.';
        if (!empty($refund['ok']) && (int) $refund['amount'] > 0) $msg .= ' Возврат ' . (int) $refund['amount'] . ' ₽ отправлен в ЮKassa.';
        elseif (!empty($refund['already']))                        $msg .= ' Возврат уже был выполнен ранее.';
        elseif (!empty($refund['error']))                          $msg .= ' ВНИМАНИЕ: автовозврат не прошёл (' . $refund['error'] . ') — верните вручную в ЛК ЮKassa.';
        flash($msg, !empty($refund['ok']) || (int) ($order['amount'] ?? 0) === 0 ? 'success' : 'error');
        admin_redirect('orders');
    }
}

/* ------------------------------- Данные --------------------------------- */
$filter = input('status');   // '', paid, made, shipped, delivered, new
/* ЗДЕСЬ ТОЛЬКО ТО, ЧТО ПЕЧАТАЮТ И ВЕЗУТ ПОЧТОЙ.
 *
 * Раздел называется «Заказы оригиналов», но брал все заказы подряд. Электронная
 * благодарность за 300 ₽ попадала в производство наравне с медалью: её печатали
 * глазами по списку, считали в сумму посылки и ждали от участника почтовый
 * адрес, которого для файла не нужно вовсе. Электронные заказы живут в разделе
 * «Заказы электронных наград» — там их выдача и срок в пять рабочих дней. */
$where  = "items NOT LIKE '%\"kind\":\"club\"%' AND items LIKE '%\"kind\":\"original\"%'";
$params = [];
if ($filter === 'archive') {
    // АРХИВ: заказ, по которому введён трек-номер, уходит из работы сюда.
    $where .= " AND status IN ('shipped','delivered')";
} elseif (in_array($filter, ['new','paid','made','shipped','delivered','canceled'], true)) {
    $where .= " AND status=?"; $params[] = $filter;
} else {
    // РАБОЧИЙ СПИСОК (правило владельца): только то, что реально нужно сделать —
    // распечатать и отправить. Неоплаченные скрыты («до оплаты заказа не существует»),
    // отправленные уходят в архив сразу после трек-номера, отменённые — в отдельную
    // вкладку «Отменённые», чтобы не смешивались с рабочим списком.
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
foreach (all("SELECT status, COUNT(*) c FROM awards_orders
               WHERE items NOT LIKE '%\"kind\":\"club\"%' AND items LIKE '%\"kind\":\"original\"%'
            GROUP BY status") as $r) {
    $counts[(string)$r['status']] = (int)$r['c'];
}
$STAT = ['paid'=>'К изготовлению','made'=>'Изготовлено','shipped'=>'Отправлено','delivered'=>'Доставлено','new'=>'Ожидает оплаты','canceled'=>'Отменён'];
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

<?php
/* ЗАКАЗЫ ОДНОГО ПОЛУЧАТЕЛЯ — ОДНОЙ КАРТОЧКОЙ.
   Человек заказывает по каждой заявке отдельно, а посылка одна. Раньше три
   благодарности и медаль шли четырьмя карточками: четыре печати, четыре ввода
   одного трек-номера и четыре письма участнику об отправке. Группируем по
   получателю: оригиналы по адресу, электронные по почте (core/order_group.php). */
require_once BASE_PATH . '/core/order_group.php';
$groups = og_groups($orders);
?>
<?php if (!$groups): ?>
  <p class="muted">Заказов пока нет.</p>
<?php else: foreach ($groups as $gr):
    $o    = $gr['orders'][0];                 // «главный» заказ: по нему шапка
    $oid  = (int)$o['id'];
    $ids  = $gr['ids'];
    $idsS = implode(',', $ids);
    $st   = og_group_status($gr);
    $step = $STEPS[$st] ?? ($st === 'new' ? 0 : 1);
    $gkind = $gr['kind'];
    $needAddr = in_array($gkind, ['original','mixed'], true);
    /* Состав и бланки собираем по всем заказам посылки — но ТОЛЬКО ОРИГИНАЛЫ.
       Если человек одним заказом взял и медаль, и электронную благодарность,
       в коробку едет медаль; файл уходит письмом из раздела электронных, и
       путать эти две работы нельзя. */
    $items = []; $cleans = []; $postSum = 0; $digiCnt = 0;
    foreach ($gr['orders'] as $go) {
        foreach (order_items_parse($go) as $p) {
            if ((string) ($p['kind'] ?? '') !== 'original') { $digiCnt += max(1, (int) $p['count']); continue; }
            $items[] = $p;
            $postSum += (int) ($p['price'] ?? 0) * max(1, (int) $p['count']);
        }
        foreach (order_clean_pdfs($go) as $c) {
            if ((string) ($c['kind'] ?? 'original') !== 'original') continue;
            $c['order_id'] = (int)$go['id']; $cleans[] = $c;
        }
    }
    // Сумма посылки — по оригинальным позициям. Оплата заказа может включать и
    // электронные материалы, которые почтой не поедут.
    if ($postSum <= 0) $postSum = (int) $gr['amount'];
    $trackUrl = order_pochta_url((string)($o['tracking'] ?? ''));
?>
  <div class="card" style="margin-bottom:16px;border:1px solid var(--a-line);border-radius:14px;overflow:hidden;">
    <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--a-card,#F4F6FC);border-bottom:1px solid var(--a-line);">
      <div>
        <b style="font-size:16px;color:var(--a-navy);">
          <?= count($ids) > 1 ? 'Посылка · заказы №' . h(implode(', №', $ids)) : 'Заказ №' . $oid ?>
        </b>
        <span class="muted small"> · <?= h(order_dt((string)$o['created_at'])) ?></span>
        <?php
        /* СРОКИ ВИДНЫ СРАЗУ, БЕЗ ЗАХОДА В ЗАЯВКУ.
         *
         * В шапке стояла одна дата оформления, и понять, кто ждёт дольше всех и
         * что уже просрочено, было нельзя: приходилось открывать заявку, потом
         * платежи, потом считать рабочие дни в уме. */
        $tl = order_timeline($o);
        ?>
        <div class="small muted" style="margin-top:3px;line-height:1.55">
          Заказ наград оформлен: <b><?= h(order_dt($tl['ordered'], false)) ?></b>
          <span class="muted">(<?= h(order_ago($tl['ordered'])) ?>)</span>
          <?php if ($tl['paid_at'] !== ''): ?>
            · Оплачен: <b><?= h(order_dt($tl['paid_at'], false)) ?></b>
          <?php endif; ?>
          <?php if ($tl['due'] !== ''): ?>
            · Изготовить до:
            <b style="color:<?= $tl['overdue'] ? '#8B2F2F' : 'var(--a-navy)' ?>"><?= h(order_dt($tl['due'], false)) ?></b>
            <?php if ($tl['overdue']): ?><span style="color:#8B2F2F">просрочено</span><?php endif; ?>
          <?php endif; ?>
          <?php if ($tl['queue'] > 0): ?>
            · В очереди: <b><?= (int) $tl['queue'] ?></b> из <?= (int) $tl['queue_total'] ?>
          <?php endif; ?>
        </div>
        <div class="small">
          <?= h((string)$o['competition']) ?> · <b><?= h((string)$o['result']) ?></b>
          <?php /* В разделе оригиналов вид всегда один — почтовая посылка. Писать
                   тут «оригиналы и электронные» было незачем: электронную часть
                   заказа здесь не изготавливают и не везут. */ ?>
          · <span style="color:#8B6F1F">оригиналы почтой</span>
        </div>
      </div>
      <div>
        <?php $badge = ['paid'=>'#C79322','made'=>'#2C7BE5','shipped'=>'#17307A','delivered'=>'#1E9E5A','new'=>'#8892B0','canceled'=>'#8B2F2F'][$st] ?? '#8892B0'; ?>
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
          <?php if ($needAddr): ?>
            <div class="small">📍 <?= $gr['address'] !== ''
              ? h($gr['address'])
              : '<b style="color:#8B2F2F">адрес не указан — отправить некуда</b>' ?></div>
          <?php else: ?>
            <div class="small" style="color:#1E7A46">Только электронные материалы — уходят письмом на почту</div>
          <?php endif; ?>
          <div class="small">📞 <?= h((string)$o['phone']) ?> · ✉ <?= h((string)$o['email']) ?></div>
          <div class="small muted" style="margin-top:4px;">Сумма посылки: <b><?= number_format($postSum, 0, '.', ' ') ?> ₽</b><?php
            // Заказ мог быть оформлен со скидкой участника Клуба — показываем, с какой
            // суммы и на сколько, иначе непонятно, почему в кассе меньше прайса.
            $ofull = (int)($o['amount_full'] ?? 0); $opct = (int)($o['discount_pct'] ?? 0);
            if ($ofull > (int)$o['amount']): ?> · было <s><?= number_format($ofull, 0, '.', ' ') ?> ₽</s><?php
              if ($opct > 0): ?>, скидка <?= $opct ?>%<?= vip_kind((int)($o['user_id'] ?? 0)) === 'club' ? ' — участник ВИП-клуба' : '' ?><?php endif;
            endif; ?></div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            <a class="btn btn--ghost btn--sm" href="<?= a_link('orders', ['do'=>'print','id'=>(int)$o['id'],'orders'=>$idsS]) ?>" target="_blank" rel="noopener"><?= admin_icon('diplomas') ?? '' ?>Лист для посылки</a>
            <button type="button" class="btn btn--ghost btn--sm" onclick="var f=document.getElementById('oe<?= (int)$o['id'] ?>');f.style.display=f.style.display==='none'?'grid':'none'">Редактировать адрес</button>
          </div>
          <form method="post" action="<?= url('/admin/') ?>" id="oe<?= (int)$o['id'] ?>" style="display:none;gap:6px;margin-top:8px"><?= csrf_field() ?>
            <input type="hidden" name="do" value="edit_addr"><input type="hidden" name="orders" value="<?= h($idsS) ?>">
            <input type="text" name="full_name" value="<?= h((string)$o['full_name']) ?>" placeholder="Получатель" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px">
            <input type="text" name="postal_index" value="<?= h((string)($o['postal_index'] ?? '')) ?>" placeholder="Индекс" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px">
            <input type="text" name="phone" value="<?= h((string)$o['phone']) ?>" placeholder="Телефон" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px">
            <textarea name="address" placeholder="Адрес" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px;min-height:52px"><?= h((string)($o['address'] ?? '')) ?></textarea>
            <button class="btn btn--navy btn--sm" type="submit">Сохранить</button>
          </form>
        </div>
        <!-- Состав с фото -->
        <div>
          <div class="small muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">
            Состав посылки (что изготовить) · оплачено
            <b style="color:var(--a-navy);font-size:13px"><?= number_format($postSum, 0, '.', ' ') ?> ₽</b>
          </div>
          <?php /* РАЗДЕЛ ОРИГИНАЛОВ — ТОЛЬКО ПРО ПОСЫЛКУ.
                   Здесь перечислялись и электронные позиции заказа: «в этом же
                   заказе 4 электронных материала». Для сборщика это лишний шум —
                   он собирает коробку, а не читает состав чужого раздела, — и от
                   него же путаница, что печатать. Электронные живут в своём
                   разделе; здесь остаётся одна строка о деньгах, иначе сумма
                   посылки не сходится с суммой заказа и её начинают искать. */ ?>
          <?php if ($digiCnt > 0): ?>
            <div class="small muted" style="margin:-2px 0 6px">
              Сумма посылки меньше суммы заказа: остальное — электронные материалы,
              они уходят письмом из своего раздела.
            </div>
          <?php endif; ?>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <?php foreach ($items as $p):
                $pk    = (string) ($p['kind'] ?? '');
                $pcnt  = max(1, (int) $p['count']);
                $pone  = (int) ($p['price'] ?? 0);
                $psum  = $pone * $pcnt;
            ?>
              <div style="width:104px;text-align:center;">
                <?php if ($p['photo']): ?>
                  <img src="<?= h($p['photo']) ?>" alt="" style="width:104px;height:104px;object-fit:cover;border-radius:10px;border:1px solid var(--a-line);">
                <?php else: ?>
                  <div style="width:104px;height:104px;border-radius:10px;border:1px dashed var(--a-line);display:flex;align-items:center;justify-content:center;color:#9AA;font-size:11px;">нет фото</div>
                <?php endif; ?>
                <div class="small" style="margin-top:4px;line-height:1.2;"><?= h($p['item']) ?></div>
                <?php /* Вид позиции подписан у самой награды, а не одной строкой на
                         весь заказ: в одной посылке едут и оригиналы, и электронные. */ ?>
                <div class="small" style="color:<?= $pk === 'original' ? '#8B6F1F' : '#1E7A46' ?>;">
                  <?= $pk === 'original' ? 'оригинал' : ($pk === 'digital' ? 'электронный' : h($pk)) ?>
                </div>
                <div class="small" style="font-weight:700;color:var(--a-navy);">
                  <?= $pcnt > 1 ? '× ' . $pcnt . ' · ' : '' ?><?= $psum > 0 ? number_format($psum, 0, '.', ' ') . ' ₽' : '—' ?>
                </div>
              </div>
            <?php endforeach; ?>
          </div>
        </div>
      </div>

      <!-- Чистые дипломы для печати -->
      <?php /* Блок показывается ВСЕГДА, когда в заказе есть оригиналы: раньше при
               пустом списке исчезала и кнопка «Перегенерировать», и получить дипломы
               было нечем — а список пуст ровно тогда, когда генерация не удалась.
               Сама генерация в отрисовке больше не запускается (см. order_clean_pdfs):
               она вешала раздел на две минуты на каждый заказ. */ ?>
      <?php /* НАГРАДНЫЕ МАТЕРИАЛЫ ПОСЫЛКИ.
               У каждого документа две кнопки: «Печать» открывает сам бланк в
               окне печати браузера, «Скачать» сохраняет файл. Раньше кнопка
               печати вела на производственный лист — белую страницу с номером
               заказа, а самой благодарности взять было негде. */ ?>
      <?php if ($cleans || $needAddr): ?>
        <div style="margin-top:14px;padding-top:12px;border-top:1px dashed var(--a-line);">
          <div class="small muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;">
            Бланки для печати в посылку (чистые, с номером и QR)
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:stretch">
            <?php foreach ($cleans as $c): $u = (string) $c['url']; ?>
              <div style="border:1px solid var(--a-line);border-radius:11px;padding:9px 12px;min-width:230px;background:#fff">
                <div class="small" style="font-weight:600;line-height:1.3;margin-bottom:6px"><?= h((string)$c['label']) ?></div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <a class="btn btn--navy btn--sm" href="<?= h($u) ?>#toolbar=1" target="_blank" rel="noopener"><?= admin_icon('diplomas') ?? '' ?>Печать</a>
                  <a class="btn btn--ghost btn--sm" href="<?= h($u) ?>&amp;dl=1"><?= admin_icon('download') ?? '' ?>Скачать</a>
                </div>
              </div>
            <?php endforeach; ?>
            <?php if (!$cleans): ?>
              <span class="small muted">Ещё не подготовлены — нажмите «Подготовить».</span>
            <?php endif; ?>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline;"><?= csrf_field() ?>
              <input type="hidden" name="do" value="regen"><input type="hidden" name="orders" value="<?= h($idsS) ?>">
              <button class="btn btn--ghost btn--sm" type="submit"><?= $cleans ? 'Перегенерировать' : 'Подготовить' ?></button>
            </form>
          </div>
        </div>
      <?php endif; ?>

      <!-- Действия -->
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--a-line);display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
        <?php if ($st === 'paid'): ?>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline;"><?= csrf_field() ?>
            <input type="hidden" name="do" value="made"><input type="hidden" name="orders" value="<?= h($idsS) ?>">
            <button class="btn btn--navy btn--sm" type="submit"><?= admin_icon('check') ?>Отметить «Изготовлено»</button>
          </form>
        <?php endif; ?>
        <?php if (in_array($st, ['paid','made'], true)): ?>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline-flex;gap:6px;align-items:center;"><?= csrf_field() ?>
            <input type="hidden" name="do" value="ship"><input type="hidden" name="orders" value="<?= h($idsS) ?>">
            <input type="text" name="tracking" placeholder="Трек-номер Почты России" required
                   style="padding:8px 12px;border:1px solid var(--a-line);border-radius:9px;min-width:220px;">
            <button class="btn btn--primary btn--sm" type="submit"><?= admin_icon('truck') ?>Отправить (письмо участнику)</button>
          </form>
        <?php endif; ?>
        <?php if ($st === 'shipped'): ?>
          <span class="small">Трек: <b><?= h((string)$o['tracking']) ?></b></span>
          <?php if ($trackUrl): ?><a class="btn btn--ghost btn--sm" href="<?= h($trackUrl) ?>" target="_blank">Отследить</a><?php endif; ?>
          <?php /* Письмо об отправке уходит прямой отправкой, минуя очередь, и в
                    «Рассылках» его нет. Здесь — ровно то, что увидел участник. */ ?>
          <a class="btn btn--ghost btn--sm" href="<?= a_link('orders', ['letter' => (int)$o['id']]) ?>" target="_blank"><?= admin_icon('newsletter') ?>Письмо участнику</a>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline;"><?= csrf_field() ?>
            <input type="hidden" name="do" value="delivered"><input type="hidden" name="orders" value="<?= h($idsS) ?>">
            <button class="btn btn--navy btn--sm" type="submit"><?= admin_icon('check') ?>Доставлено</button>
          </form>
        <?php endif; ?>
        <?php if ($st === 'delivered'): ?>
          <span class="small" style="color:#1E9E5A;font-weight:700;">✓ Доставлено<?= !empty($o['delivered_at']) ? ' · '.h((string)$o['delivered_at']) : '' ?></span>
        <?php endif; ?>
        <?php if ($st === 'canceled'): ?>
          <span class="small" style="color:#8B2F2F;font-weight:700;">✕ Отменён<?= !empty($o['canceled_at']) ? ' · '.h((string)$o['canceled_at']) : '' ?><?php if ((int)($o['refund_amount'] ?? 0) > 0): ?> · возврат <?= (int)$o['refund_amount'] ?> ₽<?php endif; ?></span>
          <?php if (trim((string)($o['cancel_reason'] ?? '')) !== ''): ?>
            <span class="small muted" style="width:100%;margin-top:4px">Причина: <?= h((string)$o['cancel_reason']) ?></span>
          <?php endif; ?>
        <?php endif; ?>
        <form method="post" action="<?= url('/admin/') ?>" style="display:inline;margin-left:auto;"><?= csrf_field() ?>
          <input type="hidden" name="do" value="redispatch"><input type="hidden" name="order" value="<?= $oid ?>">
          <button class="btn btn--ghost btn--sm" type="submit"><?= admin_icon('send') ?>В Telegram-производство</button>
        </form>
        <?php if (in_array($st, ['paid','made','new'], true)): ?>
          <!-- Отмена заказа с автоматическим возвратом средств в ЮKassa.
               Если заказ уже отправлен/доставлен — кнопка не показывается: возврат
               после отправки Почтой — только вручную по обращению. -->
          <button type="button" class="btn btn--ghost btn--sm" style="color:#8B2F2F;border-color:#EBC7C7"
                  onclick="var f=document.getElementById('cr<?= $oid ?>');f.style.display=f.style.display==='none'?'flex':'none'">
            <?= admin_icon('trash') ?>Отменить с возвратом
          </button>
          <form method="post" action="<?= url('/admin/') ?>" id="cr<?= $oid ?>"
                style="display:none;flex-basis:100%;flex-wrap:wrap;gap:6px;margin-top:8px;padding:12px;background:#FDF1F1;border:1px solid #EBC7C7;border-radius:10px"
                onsubmit="return confirm('Отменить заказ №<?= $oid ?> и вернуть <?= (int)$o['amount'] ?> ₽ в ЮKassa? Возврат необратим.');">
            <?= csrf_field() ?>
            <input type="hidden" name="do" value="cancel_refund">
            <input type="hidden" name="order" value="<?= $oid ?>">
            <input type="text" name="cancel_reason" placeholder="Причина отмены (для участника и в audit)" required
                   style="flex:1;padding:8px 12px;border:1px solid #EBC7C7;border-radius:9px;min-width:260px;background:#fff">
            <button class="btn btn--danger btn--sm" type="submit">Отменить и вернуть <?= (int)$o['amount'] ?> ₽</button>
          </form>
        <?php endif; ?>
      </div>
    </div>
  </div>
<?php endforeach; endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Заказы оригиналов', $content, 'orders');
