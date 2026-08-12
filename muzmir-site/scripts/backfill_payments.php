<?php
/**
 * Восстанавливает связь между заявками и платежами пакетной оплаты.
 *
 * Раньше payments привязывался только к первой заявке батча — админка и кабинет
 * видели «сумма 1275 ₽» у одной заявки, а остальные две (реально оплаченные)
 * значились без суммы. С этого коммита пакет пишется на все заявки, но старые
 * данные так и остались. Скрипт:
 *   1) по каждому платежу тянет metadata из ЮKassa (application_ids, promo);
 *   2) для succeeded раскладывает сумму по всем заявкам батча;
 *   3) вычисляет discount_pct из (базовая цена конкурса × N - фактическая сумма);
 *   4) заполняет price_base, discount_pct, discount_info, batch_id, payment_id.
 *
 * Идемпотентен — можно запускать сколько угодно раз.
 * Запуск: php scripts/backfill_payments.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'data'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';
db();

$shop   = (string) cfgv('yukassa_shop');
$secret = (string) cfgv('yukassa_secret');
if ($shop === '' || $secret === '') { fwrite(STDERR, "Нет ключей ЮKassa\n"); exit(2); }

$dry = in_array('--dry', $argv, true);
echo ($dry ? "DRY-RUN (ничего не меняем)\n\n" : "Приступаю к записи в базу.\n\n");

$stats = ['looked' => 0, 'fixed' => 0, 'linked' => 0, 'skipped' => 0];
foreach (all("SELECT * FROM payments WHERE yukassa_id IS NOT NULL AND yukassa_id<>'' ORDER BY id") as $p) {
    $stats['looked']++;
    $pid = (int) $p['id'];
    $ch = curl_init("https://api.yookassa.ru/v3/payments/" . rawurlencode((string) $p['yukassa_id']));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => "$shop:$secret", CURLOPT_TIMEOUT => 15]);
    $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($code !== 200) { $stats['skipped']++; echo "pay#$pid: ЮKassa вернула $code — пропуск\n"; continue; }
    $obj = json_decode((string) $raw, true) ?: [];
    $meta = $obj['metadata'] ?? [];
    $status = (string) ($obj['status'] ?? '');
    $totalRub = (int) round(((float) ($obj['amount']['value'] ?? 0)));

    $ids = [];
    if (!empty($meta['application_ids'])) {
        $ids = array_values(array_unique(array_filter(array_map('intval', explode(',', (string) $meta['application_ids'])))));
    } elseif (!empty($meta['application_id'])) {
        $ids = [(int) $meta['application_id']];
    } elseif ((int) ($p['application_id'] ?? 0) > 0) {
        $ids = [(int) $p['application_id']];
    }
    if (!$ids) { $stats['skipped']++; continue; }

    // Считаем базовую цену пакета: сумма price конкурсов всех заявок батча.
    $bases = [];
    foreach ($ids as $aid) {
        $r = one("SELECT c.price FROM applications a
                    JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$aid]);
        $bases[$aid] = (int) ($r['price'] ?? 0);
    }
    $baseSum = array_sum($bases);
    $pctReal = ($baseSum > 0 && $status === 'succeeded' && $totalRub > 0 && $totalRub < $baseSum)
        ? (int) round(($baseSum - $totalRub) / $baseSum * 100) : 0;

    // Доля каждой заявки в пакете (только для succeeded).
    $n = count($ids);
    $share = ($status === 'succeeded' && $totalRub > 0 && $n > 0) ? intdiv($totalRub, $n) : 0;
    $rest  = $share > 0 ? ($totalRub - $share * $n) : 0;

    $promo = trim((string) ($meta['promo'] ?? ''));
    $info  = ['total_pct' => $pctReal];
    if ($pctReal > 0) {
        // Разложить точно на клуб/достижения/промокод по одной сумме нельзя, но
        // если известен промокод — записываем его; остальное фиксируем как «total».
        if ($promo !== '') { $info['referral_pct'] = min(5, $pctReal); $info['promo_code'] = $promo; }
    }
    $infoJson = json_encode($info, JSON_UNESCAPED_UNICODE);

    printf("pay#%-3d %s (%s) сумма=%d база=%d ×%d заявок → %d%% скидки\n",
        $pid, substr((string) $p['yukassa_id'], 0, 12), $status, $totalRub, $baseSum, $n, $pctReal);

    foreach ($ids as $k => $aid) {
        $upd = [
            'batch_id'    => (string) $p['yukassa_id'],
            'payment_id'  => $pid,
            'price_base'  => (int) ($bases[$aid] ?? 0),
        ];
        if ($status === 'succeeded') {
            $upd['is_paid']       = 1;
            $upd['status']        = 'paid';
            $upd['amount_paid']   = $share + ($k === 0 ? $rest : 0);
            $upd['discount_pct']  = $pctReal;
            $upd['discount_info'] = $infoJson;
        }
        echo "  → app #$aid: " . implode(', ', array_map(fn($v, $k) => "$k=$v", $upd, array_keys($upd))) . "\n";
        if (!$dry) update('applications', $upd, 'id=:id', ['id' => $aid]);
        $stats['linked']++;
    }
    $stats['fixed']++;
}
echo "\n";
print_r($stats);
