<?php
/**
 * СВЕРКА: ЗА ЧТО ЗАПЛАТИЛИ — ЧТО ВЫДАЛИ.
 *
 *   php scripts/audit_digital_paid.php
 *
 * Электронную награду человек оплачивает позицией заказа, а получает записью
 * в реестре наградных документов. Между этими двумя событиями стоит выдача
 * (order_digital_fulfil), и она умеет промолчать: сработала защита от дубля,
 * не нашлось свободного номера, не собрался бланк — деньги приняты, документа
 * нет, и никто об этом не узнаёт, пока не позвонит участник.
 *
 * Скрипт сверяет оплаченные электронные позиции с выданными документами и
 * показывает расхождения списком: кто, что, сколько заплатил, какими заказами.
 * НИЧЕГО НЕ МЕНЯЕТ И НЕ ВОЗВРАЩАЕТ — решение по деньгам принимает владелец.
 *
 * Позиция может относиться к ДРУГОЙ заявке того же человека: в корзине
 * кабинета к ней приписан номер («VR-2026-00614 «Мужество» — ЛАУРЕАТ III»).
 * Это учитывается, иначе сверка ругается на честно выданные документы.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$MAP = ['основной диплом' => 'main', 'дополнительный диплом' => 'extra',
        'именной диплом'  => 'named', 'благодарность'         => 'thanks'];

/** Заявка, к которой относится позиция: своя у заказа или названная в примечании. */
function adp_app_id(array $order, array $item): int {
    $own = (int) ($order['application_id'] ?? 0);
    if (!empty($item['application_id'])) return (int) $item['application_id'];
    if (preg_match('~([A-Za-z]{2,4}-\d{4}-\d{4,5})~u', (string) ($item['note'] ?? ''), $m)) {
        $id = (int) (scalar("SELECT id FROM applications WHERE UPPER(number)=?",
                            [mb_strtoupper($m[1])]) ?? 0);
        if ($id > 0) return $id;
    }
    return $own;
}

$want = [];   // «заявка|тип» → сколько оплачено
$src  = [];   // «заявка|тип» → каким заказами
foreach (all("SELECT * FROM awards_orders WHERE status IN ('paid','made','shipped','delivered')") as $o) {
    foreach ((array) json_decode((string) ($o['items'] ?? '[]'), true) as $it) {
        if (!is_array($it) || (string) ($it['kind'] ?? '') !== 'digital') continue;
        $type = $MAP[mb_strtolower(trim((string) ($it['item'] ?? '')))] ?? '';
        if ($type === '') continue;
        $aid = adp_app_id((array) $o, $it);
        if ($aid <= 0) continue;
        $k = $aid . '|' . $type;
        $want[$k] = ($want[$k] ?? 0) + max(1, (int) ($it['count'] ?? 1));
        $src[$k][] = '№' . (int) $o['id'] . ' от ' . substr((string) $o['created_at'], 0, 10)
                   . ' (' . (int) ($it['price'] ?? 0) . ' ₽)';
    }
}

$bad = 0; $money = 0;
foreach ($want as $k => $n) {
    [$aid, $type] = explode('|', $k);
    $have = (int) (scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND type=?",
                          [(int) $aid, $type]) ?? 0);
    if ($have >= $n) continue;
    $a = one("SELECT number, full_name, group_name, email FROM applications WHERE id=?", [(int) $aid]);
    $bad++;
    $who = trim((string) ($a['full_name'] ?? '')) !== '' ? (string) $a['full_name'] : (string) ($a['group_name'] ?? '');
    printf("%-18s %-7s оплачено %d, выдано %d   %s %s\n",
           (string) ($a['number'] ?? $aid), $type, $n, $have, $who, (string) ($a['email'] ?? ''));
    printf("      заказы: %s\n", implode('; ', $src[$k]));
    // Сумма непокрытого — по цене последней позиции этого вида.
    if (preg_match('~\((\d+) ₽\)~u', end($src[$k]), $m)) $money += (int) $m[1] * ($n - $have);
}
printf("\nПозиций с недовыдачей: %d%s\n", $bad, $money > 0 ? ", на сумму примерно $money ₽" : '');
echo $bad > 0
    ? "Ничего не изменено. Решение по каждому случаю — за владельцем: выдать повторно или вернуть.\n"
    : "Всё оплаченное выдано.\n";
