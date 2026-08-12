<?php
/**
 * Страница оплаты КОНКРЕТНОГО счёта: /pay?t=app|order&id=<id>&s=<подпись>.
 *
 * Куда ведут кнопки «Оплатить» из писем и уведомлений сайта. Ничего не спрашивает:
 * проверяет подпись (или владение счётом при входе в кабинет), создаёт платёж
 * ЮKassa и сразу перебрасывает на его форму. Если платить уже нечего — объясняет
 * человеческим языком, что произошло, и даёт правильную следующую кнопку.
 */
require_once BASE_PATH . '/core/paylink.php';
require_once BASE_PATH . '/core/payments.php';

$type = (string) input('t');
$id   = (int) input('id');
$sig  = (string) input('s');
$u    = current_user();
$uid  = (int) ($u['id'] ?? 0);

/** Экран с объяснением вместо редиректа на оплату. */
$show = function (string $title, string $text, array $buttons = []) {
    ob_start(); ?>
<section class="section">
  <div class="container" style="max-width:560px">
    <div class="card reveal" style="padding:32px 26px;text-align:center">
      <div style="width:56px;height:56px;margin:0 auto 16px;border-radius:18px;background:var(--gold-soft,#FFF6E9);
                  display:flex;align-items:center;justify-content:center;color:var(--gold-ink,#8B6F1F)">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7"
             stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
      </div>
      <h1 style="margin:0 0 10px;font-size:1.35rem"><?= h($title) ?></h1>
      <p style="color:var(--muted);margin:0 0 22px;line-height:1.6"><?= $text ?></p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
        <?php foreach ($buttons as $i => [$label, $href]): ?>
          <a class="btn <?= $i === 0 ? 'btn--primary' : 'btn--ghost' ?>" href="<?= h($href) ?>"><?= h($label) ?></a>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</section>
    <?php
    $content = ob_get_clean();
    render_page('Оплата', $content, ['active' => '/cabinet', 'meta' => 'Оплата счёта Культурного центра «Музыкальный Мир».']);
};

if (!in_array($type, ['app', 'order'], true) || $id <= 0) {
    $show('Ссылка не распознана',
          'Проверьте адрес — возможно, ссылка скопирована не полностью. Все свои счета всегда видно в личном кабинете.',
          [['Личный кабинет', url('/cabinet')]]);
    return;
}

/* ─────────────── ЗАЯВКА НА УЧАСТИЕ ─────────────── */
if ($type === 'app') {
    $a = one("SELECT a.*, c.name comp_name, c.is_paid comp_paid, c.price comp_price
                FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
               WHERE a.id=?", [$id]);
    // Доступ: либо верная подпись из письма, либо это своя заявка в открытом кабинете.
    $mine  = $a && $uid > 0 && (int) ($a['user_id'] ?? 0) === $uid;
    if (!pay_sign_ok('app', $id, $sig) && !$mine) {
        $show('Ссылка недействительна',
              'Возможно, срок ссылки истёк или она предназначена другому участнику. Войдите в кабинет — там видно все ваши счета.',
              [['Личный кабинет', url('/cabinet')], ['Войти', url('/login') . '?next=' . urlencode('/cabinet')]]);
        return;
    }
    if (!$a) {
        $show('Заявка не найдена',
              'Скорее всего, неоплаченная заявка была удалена автоматически. Подать её заново можно в один клик.',
              [['Подать заявку', url('/apply')], ['Все конкурсы', url('/competitions')]]);
        return;
    }
    if ((int) ($a['is_paid'] ?? 0) === 1) {
        $show('Заявка уже оплачена',
              'Оргвзнос по заявке <b>№' . h((string) $a['number']) . '</b> получен — платить повторно не нужно. Работа передана жюри.',
              [['Личный кабинет', url('/cabinet')]]);
        return;
    }
    // Отклонённую заявку оплатить нельзя. Возврат обнуляет is_paid, и до этой
    // проверки старая кнопка «Оплатить участие» из письма спокойно открывала кассу
    // человеку, которому центр уже отказал и вернул деньги.
    if ((string) ($a['status'] ?? '') === 'rejected') {
        $refunded = (int) ($a['amount_refunded'] ?? 0);
        $show('Заявка отклонена',
              'По заявке <b>№' . h((string) $a['number']) . '</b> оплата не требуется.'
              . ($refunded > 0
                  ? ' Оргвзнос ' . $refunded . ' ₽ возвращён на карту, которой вы платили — банк зачисляет возврат до нескольких рабочих дней.'
                  : ' Если оргвзнос был внесён, он возвращён на карту, которой вы платили.')
              . ' Подать работу заново можно в любой момент.',
              [['Подать заявку', url('/apply')], ['Личный кабинет', url('/cabinet')]]);
        return;
    }
    if ((int) ($a['comp_paid'] ?? 0) !== 1 || (int) ($a['comp_price'] ?? 0) <= 0) {
        $show('Оплата не требуется',
              'Участие в конкурсе «' . h((string) $a['comp_name']) . '» бесплатное — заявка уже принята.',
              [['Личный кабинет', url('/cabinet')]]);
        return;
    }

    // Сумма к оплате — через общий расчёт application_amount_due(): уважает уже
    // зафиксированную сумму, иначе применяет скидки участника (достижения, клуб,
    // реферальный кредит) и сохраняет разбор на заявку. Один и тот же расчёт зовут
    // подача, кабинет и эта страница — иначе в письме одна цифра, а в кассе другая.
    require_once BASE_PATH . '/core/loyalty.php';
    $amount = (int) application_amount_due($a)['amount'];

    // Прежний счёт по этой заявке гасим В КАССЕ, а не только у себя в базе: иначе
    // ссылка из старого письма остаётся оплачиваемой и заявку платят дважды.
    try { yukassa_cancel_open_for_app($id); } catch (\Throwable $e) {}

    $payment = yukassa_create_payment($amount, 'Оргвзнос за участие: ' . (string) $a['comp_name'], [
        'application_ids' => (string) $id,
        'application_id'  => $id,
        'number'          => (string) $a['number'],
        'numbers'         => (string) $a['number'],
        'email'           => mb_strtolower((string) $a['email']),
    ]);
    $label = 'заявки №' . (string) $a['number'];
    $back  = url('/cabinet');
}

/* ─────────────── ЗАКАЗ НАГРАДНОГО МАТЕРИАЛА ─────────────── */
if ($type === 'order') {
    $o = one("SELECT * FROM awards_orders WHERE id=?", [$id]);
    $mine = $o && $uid > 0 && (int) ($o['user_id'] ?? 0) === $uid;
    if (!pay_sign_ok('order', $id, $sig) && !$mine) {
        $show('Ссылка недействительна',
              'Возможно, срок ссылки истёк или она предназначена другому участнику. Войдите в кабинет — там видно все ваши счета.',
              [['Личный кабинет', url('/cabinet')], ['Войти', url('/login') . '?next=' . urlencode('/cabinet')]]);
        return;
    }
    if (!$o) {
        $show('Заказ не найден',
              'Скорее всего, неоплаченный заказ был удалён автоматически. Оформить награды заново можно из кабинета.',
              [['Заказать награды', url('/order-awards')], ['Личный кабинет', url('/cabinet')]]);
        return;
    }
    if ((string) ($o['status'] ?? '') !== 'new') {
        $show('Заказ уже оплачен',
              'Заказ <b>№' . (int) $id . '</b> принят в работу — платить повторно не нужно. Ход изготовления виден в кабинете.',
              [['Личный кабинет', url('/cabinet')]]);
        return;
    }
    $amount = (int) ($o['amount'] ?? 0);
    if ($amount <= 0) {
        $show('Оплата не требуется',
              'По заказу <b>№' . (int) $id . '</b> сумма к оплате нулевая — он уже в работе.',
              [['Личный кабинет', url('/cabinet')]]);
        return;
    }
    // Старый счёт заказа — тоже гасим в кассе до создания нового.
    try { yukassa_cancel_open_for_order($id); } catch (\Throwable $e) {}

    $payment = yukassa_create_payment($amount, 'Наградные материалы, заказ №' . $id, [
        'order_id' => $id,
        'email'    => mb_strtolower((string) ($o['email'] ?? '')),
    ]);
    $label = 'заказа №' . $id;
    $back  = url('/cabinet');
}

/* ─────────────── Общий финал: гасим старые счета и уходим на ЮKassa ─────────────── */
if (!$payment || empty($payment['id'])) {
    $show('Не удалось открыть оплату',
          'Платёжный сервис сейчас не отвечает. Попробуйте ещё раз через пару минут — счёт никуда не денется.',
          [['Попробовать ещё раз', url($_SERVER['REQUEST_URI'] ?? '/pay')], ['Личный кабинет', $back]]);
    return;
}

// Повторный переход по ссылке не должен плодить «висящие» платежи.
if (tbl_exists('payments')) {
    if ($type === 'app') {
        q("UPDATE payments SET status='canceled' WHERE application_id=? AND status IN ('pending','waiting_for_capture','')", [$id]);
        insert('payments', ['application_id' => $id, 'amount' => $amount, 'method' => 'yukassa',
                            'status' => (string) ($payment['status'] ?? 'pending'),
                            'yukassa_id' => (string) $payment['id'], 'purpose' => 'application']);
    } else {
        q("UPDATE payments SET status='canceled' WHERE order_id=? AND status IN ('pending','waiting_for_capture','')", [$id]);
        insert('payments', ['order_id' => $id, 'amount' => $amount, 'method' => 'yukassa',
                            'status' => (string) ($payment['status'] ?? 'pending'),
                            'yukassa_id' => (string) $payment['id'], 'purpose' => 'order']);
    }
}
audit('paylink_open', $type === 'app' ? 'applications' : 'awards_orders', $id,
      ['amount' => $amount, 'by' => $uid ?: 'ссылка из письма']);

$url = (string) ($payment['confirmation_url'] ?? '');
if ($url !== '') { header('Location: ' . $url, true, 302); exit; }

// Магазин ещё не подключён (заглушка) — честно объясняем, а не молчим.
$show('Оплата ' . $label,
      'Сумма к оплате: <b>' . number_format($amount, 0, '.', ' ') . ' ₽</b>.<br>'
    . 'Платёжная форма сейчас недоступна — Оргкомитет свяжется с вами и подтвердит оплату вручную.',
      [['Личный кабинет', $back], ['Написать в Оргкомитет', url('/contacts')]]);
