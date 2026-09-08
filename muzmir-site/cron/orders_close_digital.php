<?php
/**
 * ЭЛЕКТРОННЫЙ ЗАКАЗ ЗАКРЫВАЕТСЯ САМ, КОГДА ДОКУМЕНТ УШЁЛ.
 *
 * У заказа с электронной наградой нет ни изготовления, ни отправки почтой:
 * человек оплатил, наградной документ собрался и ушёл письмом — заказ выполнен.
 * Но статус так и оставался «оплачен»: его меняли руками только у оригиналов,
 * где есть коробка и трек-номер.
 *
 * Из-за этого в админке 8 сентября висело 135 «оплаченных» электронных заказов,
 * и по 104 из них документ давно отправлен. Список «что ещё не сделано» стал
 * бесполезен: настоящие тридцать один заказ, которые действительно ждут своей
 * даты, тонули среди сотни выполненных. Отсюда же вопросы «почему не
 * отображается, где зависло» — заказ выглядел незакрытым при отправленном
 * дипломе.
 *
 * Что делает: берёт заказы в статусе «оплачен»/«изготовлен», у которых ВСЕ
 * позиции электронные, проверяет, что по каждой оплаченной позиции документ
 * выдан И отправлен, и переводит такой заказ в «вручён».
 *
 * Чего НЕ делает:
 *   - не трогает заказы с оригиналами (там статус ставит человек, по трек-номеру);
 *   - не трогает заказ, где хоть один документ ещё не отправлен;
 *   - не создаёт документы и не шлёт писем — только закрывает выполненное;
 *   - не двигает деньги: отмена, возврат и оплата сюда не относятся.
 *
 * Позиция может относиться к ДРУГОЙ заявке того же человека — в корзине к ней
 * приписан номер заявки. Разбор тот же, что в scripts/audit_digital_paid.php:
 * без него честно выданные документы считались бы невыданными.
 *
 * Запуск: php cron/orders_close_digital.php --dry   (показать)
 *         php cron/orders_close_digital.php         (закрыть)
 * В расписании: раз в час, сразу после отправки наградных.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/cron/_lib.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

if (!cron_lock('orders_close_digital', 600)) exit(0);

$dry = in_array('--dry', array_slice($argv, 1), true);

const OCD_MAP = ['основной диплом' => 'main', 'дополнительный диплом' => 'extra',
                 'именной диплом'  => 'named', 'благодарность'         => 'thanks'];

/** Заявка, к которой относится позиция: своя у заказа или названная в примечании. */
function ocd_app_id(array $order, array $item): int {
    if (!empty($item['application_id'])) return (int) $item['application_id'];
    if (preg_match('~([A-Za-z]{2,4}-\d{4}-\d{4,5})~u', (string) ($item['note'] ?? ''), $m)) {
        $id = (int) (scalar("SELECT id FROM applications WHERE UPPER(number)=?", [mb_strtoupper($m[1])]) ?? 0);
        if ($id > 0) return $id;
    }
    return (int) ($order['application_id'] ?? 0);
}

$closed = 0; $skipped = 0; $lines = [];
foreach (all("SELECT id, status, items, application_id, full_name, created_at
                FROM awards_orders WHERE status IN ('paid','made') ORDER BY id") as $o) {
    $items = (array) json_decode((string) ($o['items'] ?? '[]'), true);
    if (!$items) { $skipped++; continue; }

    // Только полностью электронный заказ. Одна коробка — и это уже не наш случай.
    $allDigital = true;
    foreach ($items as $it) {
        if (!is_array($it)) { $allDigital = false; break; }
        if ((string) ($it['kind'] ?? '') !== 'digital') { $allDigital = false; break; }
    }
    if (!$allDigital) { $skipped++; continue; }

    /* Считаем по видам: сколько оплачено и сколько ОТПРАВЛЕНО. Выданный, но не
     * ушедший документ заказ не закрывает — человек его ещё не получил. */
    $want = [];
    foreach ($items as $it) {
        $type = OCD_MAP[mb_strtolower(trim((string) ($it['item'] ?? '')))] ?? '';
        if ($type === '') continue;
        $aid = ocd_app_id((array) $o, (array) $it);
        if ($aid <= 0) continue;
        $k = $aid . '|' . $type;
        $want[$k] = ($want[$k] ?? 0) + max(1, (int) ($it['count'] ?? 1));
    }
    if (!$want) { $skipped++; continue; }

    $done = true;
    foreach ($want as $k => $n) {
        [$aid, $type] = explode('|', $k);
        $sent = (int) (scalar("SELECT COUNT(*) FROM diplomas
                                WHERE application_id=? AND type=? AND COALESCE(sent_at,'')<>''",
                              [(int) $aid, $type]) ?? 0);
        if ($sent < $n) { $done = false; break; }
    }
    if (!$done) { $skipped++; continue; }

    $lines[] = sprintf('#%d от %s — %s', (int) $o['id'], substr((string) $o['created_at'], 0, 10),
                       mb_substr((string) ($o['full_name'] ?? ''), 0, 40));
    if (!$dry) {
        try {
            update('awards_orders', ['status' => 'delivered'], 'id=:id', ['id' => (int) $o['id']]);
            if (function_exists('audit')) audit('order_auto_delivered', 'awards_order', (int) $o['id']);
        } catch (\Throwable $e) { continue; }
    }
    $closed++;
}

foreach (array_slice($lines, 0, 20) as $l) echo '  ' . $l . PHP_EOL;
if (count($lines) > 20) printf("  … и ещё %d\n", count($lines) - 20);
printf("%s: %d, не тронуто: %d\n", $dry ? 'закрыл бы' : 'закрыто заказов', $closed, $skipped);
if ($closed > 0 && !$dry) cron_log('orders_close_digital', "закрыто электронных заказов: $closed");

cron_unlock('orders_close_digital');
