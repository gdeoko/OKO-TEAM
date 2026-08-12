<?php
/**
 * Разовая очистка: возврат трёх тестовых succeeded-платежей по 1₽ (Ильясов,
 * заявки 163/164/165 — удалены, платежи в ЮKassa остались). Идемпотентно:
 * yukassa_refund генерирует уникальный Idempotence-Key по (payment_id, amount, reason),
 * повторный запуск не создаст дублей.
 *
 * После возврата шлём одно сводное письмо владельцу (zamis76@mail.ru) синхронно
 * через mail_send_failover — «тестовые заявки отклонены, возврат выполнен».
 *
 * Запуск (владелец разрешил тратить 3₽ на возврат): php scripts/refund_test_1r.php
 */
declare(strict_types=1);
define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'payments', 'mailer', 'result_mail'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';

$targets = [
    ['id' => 49, 'yk' => '320a5847-000f-5000-b000-1d64255a756a'],
    ['id' => 50, 'yk' => '320a5962-000f-5001-9000-154c9db99aa5'],
    ['id' => 51, 'yk' => '320a5ad5-000f-5001-8000-11d054fd8d2a'],
];

$rows = [];
$totalRefunded = 0;
$anyFailed = false;

foreach ($targets as $t) {
    $reason = 'Тестовая заявка отклонена и удалена — возврат оргвзноса 1₽';
    // Прямой вызов yukassa_refund: платёж и заявка уже удалены, refund_application
    // тут не подходит (ей нужна живая applications-строка).
    $res = yukassa_refund($t['yk'], 1.00, $reason . ' [pay#' . $t['id'] . ']');
    if (!empty($res['ok'])) {
        echo "OK  pay#{$t['id']}  refund_id={$res['id']}  status={$res['status']}\n";
        $rows[] = ['pay' => $t['id'], 'yk' => $t['yk'], 'ok' => true, 'refund_id' => $res['id']];
        $totalRefunded += 1;
        if (function_exists('audit')) audit('refund_test_1r', 'payments', $t['id'], ['yukassa_id' => $t['yk'], 'refund_id' => $res['id']]);
    } else {
        echo "FAIL pay#{$t['id']}  " . ($res['error'] ?? '') . "\n";
        $rows[] = ['pay' => $t['id'], 'yk' => $t['yk'], 'ok' => false, 'error' => $res['error'] ?? ''];
        $anyFailed = true;
    }
}

echo "\nИтого возвращено: {$totalRefunded} ₽\n";

// Одно сводное письмо владельцу — короткое и по делу, без огромного шаблона.
$to = 'zamis76@mail.ru';
$subject = 'Тестовые заявки отклонены — возврат ' . $totalRefunded . ' ₽';
$body = '<p>Здравствуйте, Альберт Ильясович!</p>'
      . '<p>Тестовые заявки на конкурсы (id 163, 164, 165), которые Вы подавали для проверки платного потока, отклонены и удалены. Оргвзнос по каждой из них — <b>1 ₽</b> — возвращён через ЮKassa на ту же карту:</p>'
      . '<ul style="line-height:1.7">';
foreach ($rows as $r) {
    if (!empty($r['ok'])) {
        $body .= '<li>Платёж <code>' . htmlspecialchars($r['yk']) . '</code> — возврат оформлен (id ' . htmlspecialchars($r['refund_id']) . ').</li>';
    } else {
        $body .= '<li>Платёж <code>' . htmlspecialchars($r['yk']) . '</code> — <b>автовозврат не прошёл</b>: ' . htmlspecialchars($r['error']) . '. Верните вручную в ЛК ЮKassa.</li>';
    }
}
$body .= '</ul>'
       . '<p>Зачисление на карту обычно занимает до 3 рабочих дней (срок зависит от банка).</p>'
       . '<p style="color:#8b7b3b;font-size:13px;margin-top:20px">Это письмо — подтверждение по чистке тестовых данных перед запуском.</p>';

$sent = false;
try { $sent = mail_send_failover($to, $subject, rm_mail_layout($body, 'Возврат по тестовым заявкам'), ['pool' => 'tx']); }
catch (\Throwable $e) { echo "MAIL FAIL: " . $e->getMessage() . "\n"; }
echo "Письмо {$to}: " . ($sent ? 'OK' : 'FAIL') . "\n";

exit($anyFailed ? 1 : 0);
