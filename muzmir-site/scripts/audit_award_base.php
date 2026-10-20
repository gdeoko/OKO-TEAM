<?php
/**
 * scripts/audit_award_base.php — ДОПОЛНЕНИЕ БЕЗ ОСНОВНОГО ДИПЛОМА.
 *
 * Правило центра (28.08.2026, расширено владельцем 14.10.2026): дополнительный
 * диплом, благодарность педагогу, кубок, статуэтка и медаль изготавливаются
 * только вместе с основным (или именным) дипломом — и дополнительный тоже, ни
 * электронный, ни оригинал исключением не является.
 *
 * Аудит зовёт САМ заслон `award_base_required()`, а не свою копию его логики:
 * копии расходятся молча, и тогда аудит показывает зелёное там, где сайт
 * пропускает заказ (эта грабля уже стоила правок в правилах 33 и 35).
 *
 * Запуск: php scripts/audit_award_base.php [--всё]
 *   без ключа — только живые заказы (неотменённые);
 *   --всё     — включая отменённые, для разбора истории.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/orders.php';

$всё = in_array('--всё', $argv, true) || in_array('--all', $argv, true);

$sql = "SELECT o.id, o.application_id, o.items, o.status, o.amount, o.kind,
               o.payment_id, o.created_at, o.made_at, o.shipped_at, o.canceled_at,
               o.full_name, o.result, c.is_paid, c.name AS comp
          FROM awards_orders o
          LEFT JOIN applications a ON a.id = o.application_id
          LEFT JOIN competitions c ON c.id = a.competition_id"
     . ($всё ? '' : " WHERE COALESCE(o.canceled_at,'')=''")
     . " ORDER BY o.id";

$беды = 0; $всегоПроверено = 0;
foreach (all($sql) as $o) {
    $items = json_decode((string) $o['items'], true);
    if (!is_array($items) || !$items) continue;
    $всегоПроверено++;

    /* Заслон видит заказы этой заявки со статусом от «оплачен» и выше, поэтому
       сам проверяемый заказ его вывод не портит: основного в нём всё равно нет,
       иначе заслон нашёл бы его прямо в корзине. */
    $r = award_base_required($items, (int) $o['application_id'] ?: null, (int) $o['is_paid'] === 1);
    if (empty($r['need'])) continue;

    $беды++;
    $позиции = [];
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        $n = (string) ($it['item'] ?? '');
        if (award_canon_item($n) === '') continue;
        $позиции[] = $n . ' (' . ((string) ($it['kind'] ?? '') === 'digital' ? 'электронный' : 'оригинал') . ')';
    }
    $дипломы = all("SELECT number, type FROM diplomas WHERE application_id=? ORDER BY id",
                   [(int) $o['application_id']]);
    $реестр = [];
    foreach ($дипломы as $d) $реестр[] = $d['number'] . ' [' . $d['type'] . ']';

    printf("\n№%d  %s  %s\n", (int) $o['id'], (string) $o['full_name'], (string) $o['comp']);
    printf("  заявка %d, результат «%s», конкурс %s\n",
        (int) $o['application_id'], (string) $o['result'],
        (int) $o['is_paid'] === 1 ? 'платный' : 'бесплатный');
    printf("  заказано: %s — %s ₽, статус %s, оплата %s\n",
        implode(' + ', $позиции), (string) $o['amount'], (string) $o['status'],
        (string) $o['payment_id'] !== '' ? 'есть' : 'НЕТ');
    printf("  создан %s%s%s\n", (string) $o['created_at'],
        (string) $o['made_at'] !== '' ? ', изготовлен ' . $o['made_at'] : '',
        (string) $o['shipped_at'] !== '' ? ', ОТПРАВЛЕН ' . $o['shipped_at'] : ', не отправлен');
    printf("  в реестре по заявке: %s\n", $реестр ? implode(', ', $реестр) : 'НИ ОДНОГО');
    printf("  не хватает: Основной диплом (%s), из-за позиции «%s»\n",
        $r['kind'] === 'digital' ? 'электронный' : 'оригинал', (string) $r['blocked']);
}

echo "\n", str_repeat('-', 60), "\n";
printf("проверено заказов: %d; дополнений без основного диплома: %d\n", $всегоПроверено, $беды);
if ($беды > 0) {
    echo "ДЕНЬГИ НЕ ТРОГАЕМ: решение по оплаченному заказу принимает владелец\n";
    echo "(возврат, доплата основного или отправка как есть).\n";
}
exit($беды > 0 ? 1 : 0);
