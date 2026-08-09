<?php
/**
 * Аудит возврата средств в ЮKassa: проверяет, что функции refund_application и
 * refund_award_order корректно находят реальные succeeded-платежи в БД,
 * правильно считают долю пакетной заявки и не ломаются на граничных случаях.
 *
 * НЕ вызывает yukassa_refund — только dry-run по логике поиска платежа.
 * (Реальный возврат делает admin через кнопку в /admin/?p=orders или отклонение
 * заявки в grading.php — там же и вызывается yukassa_refund настоящим ключом.)
 */
declare(strict_types=1);
define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'payments'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';

$fails = 0; $passes = 0;
function chk(string $t, bool $ok, string $ctx = ''): void {
    global $fails, $passes;
    if ($ok) { $passes++; echo "  ok   $t" . ($ctx !== '' ? "  [$ctx]" : '') . PHP_EOL; }
    else     { $fails++; echo "  FAIL $t" . ($ctx !== '' ? "  ($ctx)" : '') . PHP_EOL; }
}

echo "=== Оплаченные заявки на платные конкурсы: refund findable? ===\n";
// Проверяем только те заявки, у которых есть РЕАЛЬНЫЙ succeeded-платёж:
// admin мог проставить is_paid=1 вручную (без ЮKassa) — возвращать по такой заявке
// нечего, это ожидаемое поведение payment_for_application (=null).
$paidApps = all(
    "SELECT a.id, a.batch_id, a.payment_id, a.amount_paid, c.is_paid comp_paid
       FROM applications a JOIN competitions c ON c.id=a.competition_id
       JOIN payments p ON (p.id=a.payment_id OR p.application_id=a.id)
      WHERE a.is_paid=1 AND c.is_paid=1 AND a.status<>'rejected'
        AND p.status='succeeded' AND p.yukassa_id<>'' AND p.yukassa_id NOT LIKE 'stub-%'
      GROUP BY a.id
      ORDER BY a.id DESC LIMIT 20"
);
if (!$paidApps) { echo "  (нет оплаченных заявок с реальным succeeded-платежом)\n"; }
foreach ($paidApps as $a) {
    $pay = payment_for_application((int) $a['id']);
    $ok = $pay !== null;
    $ctx = 'app #' . $a['id'] . ' batch=' . ($a['batch_id'] ?: '-')
         . ' payment_id=' . ($a['payment_id'] ?: '-')
         . ' amount_paid=' . (int) $a['amount_paid']
         . ($pay ? ' → pay#' . $pay['id'] . ' yk=' . $pay['yukassa_id'] . ' status=' . $pay['status'] : ' → НЕ НАЙДЕН');
    chk('payment_for_application находит платёж', $ok, $ctx);
}

// Отдельно — предупреждение о заявках с is_paid=1 без реального succeeded-платежа
// (админ-руками, старые данные). При отклонении refund_application вернёт
// «Успешный платёж не найден» — это корректное поведение, а не баг.
$noPay = all(
    "SELECT a.id, a.payment_id, a.amount_paid FROM applications a
     LEFT JOIN payments p ON p.id=a.payment_id
     WHERE a.is_paid=1
       AND (p.id IS NULL OR p.status<>'succeeded' OR p.yukassa_id='' OR p.yukassa_id LIKE 'stub-%')
     ORDER BY a.id DESC LIMIT 10"
);
if ($noPay) {
    echo "\n  Заявки с is_paid=1 без реального succeeded-платежа в ЮKassa:\n";
    foreach ($noPay as $a) echo "    - app #" . $a['id'] . " payment_id=" . ($a['payment_id'] ?: '-') . " amount_paid=" . (int) $a['amount_paid'] . " (возврат не будет предложен — так и должно быть)\n";
}

echo "\n=== Оплаченные заказы наград: refund findable? ===\n";
$paidOrders = all(
    "SELECT id, amount, status FROM awards_orders
      WHERE status IN ('paid','made') AND amount > 0
      ORDER BY id DESC LIMIT 20"
);
if (!$paidOrders) echo "  (нет оплаченных заказов для проверки)\n";
foreach ($paidOrders as $o) {
    $pay = payment_for_order((int) $o['id']);
    $ok = $pay !== null;
    $ctx = 'order #' . $o['id'] . ' amount=' . (int) $o['amount'] . ' status=' . $o['status']
         . ($pay ? ' → pay#' . $pay['id'] . ' yk=' . $pay['yukassa_id'] . ' status=' . $pay['status'] : ' → НЕ НАЙДЕН');
    chk('payment_for_order находит платёж', $ok, $ctx);
}

echo "\n=== Проверка функций возврата в наличии ===\n";
chk('yukassa_refund объявлена',       function_exists('yukassa_refund'),      'core/payments.php');
chk('refund_application объявлена',   function_exists('refund_application'),  'core/payments.php');
chk('refund_award_order объявлена',   function_exists('refund_award_order'),  'core/payments.php');
chk('payment_for_application объявлена', function_exists('payment_for_application'), 'core/payments.php');
chk('payment_for_order объявлена',    function_exists('payment_for_order'),   'core/payments.php');

echo "\n=== Проверка миграции колонок awards_orders ===\n";
$cols = all("PRAGMA table_info(awards_orders)");
$colNames = array_column($cols, 'name');
foreach (['canceled_at','cancel_reason','refund_amount','refund_id'] as $c) {
    chk("колонка $c существует", in_array($c, $colNames, true));
}

echo "\n=== Пакетные заявки: доля рассчитывается корректно ===\n";
// Ищем пакеты и убеждаемся, что sum(amount_paid) по пакету == сумма платежа.
$batches = all(
    "SELECT batch_id, COUNT(*) n, SUM(amount_paid) sum_share, MIN(payment_id) pid
       FROM applications
      WHERE batch_id<>'' AND is_paid=1
      GROUP BY batch_id HAVING n>1
      ORDER BY MAX(id) DESC LIMIT 10"
);
if (!$batches) echo "  (пакетов из 2+ заявок нет — не на чем проверять)\n";
foreach ($batches as $b) {
    $pay = one("SELECT amount, yukassa_id FROM payments WHERE id=?", [(int) $b['pid']]);
    $expected = (int) ($pay['amount'] ?? 0);
    $got      = (int) $b['sum_share'];
    chk('sum(amount_paid) пакета == amount платежа', $got === $expected,
        'batch=' . $b['batch_id'] . " apps=$b[n] share=$got vs payment=$expected");
}

echo "\n" . str_repeat('─', 60) . "\n";
echo "PASS: $passes  FAIL: $fails\n";
exit($fails ? 1 : 0);
