<?php
/**
 * ЕЖЕДНЕВНЫЙ АУДИТ ЗАКАЗОВ ЗА ПРОШЕДШИЙ ДЕНЬ.
 *
 * Правило владельца от 21.10.2026, постоянное: каждую ночь в 00:30 проверять
 * все вчерашние заказы, ошибки исправлять немедленно, утром в 08:00 показывать
 * отчёт.
 *
 * ЧТО ЧИНИМ САМИ. Только то, где правда известна и деньги не двигаются:
 * платёж в кассе прошёл, а заказ остался «ожидает оплаты»; клубный заказ
 * оплачен, а членство не включилось; в заказе нет отметки о платеже, которая
 * есть в кассе. Это не распоряжение деньгами, а приведение записи в
 * соответствие с тем, что уже произошло.
 *
 * ЧЕГО НЕ ДЕЛАЕМ НИКОГДА. Возвратов, отмен оплаченных заказов, правки сумм у
 * оплаченного заказа, писем участникам о деньгах (правило 8а). Двойная оплата,
 * расхождение суммы, заказ без адреса — только строкой в отчёте: кто, сколько,
 * за что. Решает владелец.
 *
 * ПОЧЕМУ СВЕРКА ИДЁТ С КАССОЙ, А НЕ ПО ПОЛЮ В ЗАКАЗЕ. В awards_orders.payment_id
 * лежит ПОСЛЕДНЯЯ попытка оплаты, и она часто отменённая, а успешный платёж —
 * среди прежних в таблице payments по order_id. Судить по одному payment_id
 * нельзя: так четыре оплаченных заказа однажды выглядели неоплаченными.
 *
 * Запуск: php cron/orders_audit.php [--date=YYYY-MM-DD] [--dry] [--days=N]
 * Отчёт: data/logs/orders_audit-YYYY-MM-DD.txt и настройка orders_audit_last.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/cron/_lib.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/orders.php';
if (is_file(BASE_PATH . '/core/loyalty.php')) require_once BASE_PATH . '/core/loyalty.php';
if (is_file(BASE_PATH . '/core/club.php'))    require_once BASE_PATH . '/core/club.php';
if (is_file(BASE_PATH . '/core/telegram.php')) require_once BASE_PATH . '/core/telegram.php';

$dry = in_array('--dry', $argv ?? [], true);
if (!$dry && !cron_lock('orders_audit', 1800)) exit(0);

/* Проверяем ВЧЕРАШНИЙ день: задание идёт в 00:30, когда сутки уже закрыты.
   --date= разбирает конкретный день руками, --days=N — несколько последних. */
$день = date('Y-m-d', strtotime('-1 day'));
$дней = 1;
foreach ($argv ?? [] as $a) {
    if (preg_match('~^--date=(\d{4}-\d{2}-\d{2})$~', $a, $m)) $день = $m[1];
    if (preg_match('~^--days=(\d+)$~', $a, $m)) $дней = max(1, (int) $m[1]);
}
$от = date('Y-m-d 00:00:00', strtotime($день . ' -' . ($дней - 1) . ' days'));
$до = date('Y-m-d 23:59:59', strtotime($день));

$исправлено = [];   // что починили сами
$владельцу  = [];   // что требует его решения
$заметки    = [];   // наблюдения без действия

/** Ключи кассы: сначала config.local.php, потом настройки админки. */
$shop   = (string) (cfgv('yukassa_shop')   ?: setting('yukassa_shop', ''));
$secret = (string) (cfgv('yukassa_secret') ?: setting('yukassa_secret', ''));

/** Спросить кассу о платеже. null — не спросили (нет ключей, сеть, 4xx). */
function audit_yk(string $pid, string $shop, string $secret): ?array {
    if ($shop === '' || $secret === '' || !preg_match('~^[0-9a-f-]{30,}$~i', $pid)) return null;
    $ch = curl_init('https://api.yookassa.ru/v3/payments/' . rawurlencode($pid));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_USERPWD => $shop . ':' . $secret,
                            CURLOPT_TIMEOUT => 15]);
    $r = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    if ($code !== 200) return null;
    $d = json_decode((string) $r, true);
    return is_array($d) ? $d : null;
}

$orders = all("SELECT * FROM awards_orders WHERE created_at BETWEEN ? AND ? ORDER BY id", [$от, $до]);

foreach ($orders as $o) {
    $oid    = (int) $o['id'];
    $status = (string) $o['status'];
    $amount = (int) $o['amount'];
    $кто    = trim((string) ($o['full_name'] ?? '')) . ' <' . (string) ($o['email'] ?? '') . '>';
    $items  = json_decode((string) ($o['items'] ?? '[]'), true);
    $items  = is_array($items) ? $items : [];
    $клубный = false;
    foreach ($items as $it) if (is_array($it) && (string) ($it['kind'] ?? '') === 'club') $клубный = true;

    /* --- Платежи заказа: своя запись и правда кассы --- */
    $pays = all("SELECT * FROM payments WHERE order_id=? ORDER BY id", [$oid]);
    $успешныйУнас = false;
    foreach ($pays as $p) if (in_array((string) $p['status'], ['succeeded', 'refunded'], true)) $успешныйУнас = true;

    $успешныйВКассе = false; $кассаСпрошена = false; $суммаКассы = 0;
    $pids = array_values(array_unique(array_filter(array_merge(
        array_column($pays, 'yukassa_id'), [(string) ($o['payment_id'] ?? '')]
    ))));
    foreach ($pids as $pid) {
        $d = audit_yk((string) $pid, $shop, $secret);
        if ($d === null) continue;
        $кассаСпрошена = true;
        if ((string) ($d['status'] ?? '') === 'succeeded' || !empty($d['paid'])) {
            $успешныйВКассе = true;
            $суммаКассы = (int) round((float) ($d['amount']['value'] ?? 0));
            // Запись о платеже в нашей базе могла не появиться вовсе.
            $есть = false;
            foreach ($pays as $p) if ((string) $p['yukassa_id'] === (string) $pid
                                      && (string) $p['status'] === 'succeeded') $есть = true;
            if (!$есть && !$dry) {
                $ряд = null;
                foreach ($pays as $p) if ((string) $p['yukassa_id'] === (string) $pid) $ряд = $p;
                if ($ряд) {
                    update('payments', ['status' => 'succeeded'], 'id=:id', ['id' => (int) $ряд['id']]);
                } else {
                    insert('payments', ['order_id' => $oid, 'amount' => $суммаКассы, 'method' => 'yukassa',
                                        'status' => 'succeeded', 'yukassa_id' => (string) $pid, 'purpose' => 'awards']);
                }
                $исправлено[] = "заказ #$oid: платёж $pid в кассе проведён — запись в базе приведена в соответствие";
            }
        }
    }

    /* --- 1. Деньги пришли, а заказ висит «ожидает оплаты» --- */
    if ($status === 'new' && ($успешныйВКассе || $успешныйУнас)) {
        if (!$dry) {
            update('awards_orders', ['status' => 'paid'], 'id=:id', ['id' => $oid]);
            audit('orders_audit_fix_paid', 'awards_orders', $oid, ['было' => 'new', 'стало' => 'paid']);
        }
        $исправлено[] = "заказ #$oid ($кто, $amount ₽): оплата прошла, а заказ числился неоплаченным — переведён в «К изготовлению»";
        $status = 'paid';
    }

    /* --- 2. Заказ в работе, а оплаты нет нигде --- */
    if (in_array($status, ['paid', 'made', 'shipped', 'delivered'], true) && $amount > 0
        && !$успешныйУнас && !$успешныйВКассе && $кассаСпрошена) {
        $владельцу[] = "заказ #$oid ($кто, $amount ₽, {$status}): числится оплаченным, но в кассе успешного платежа НЕТ — проверить";
    }

    /* --- 3. Клубный заказ оплачен, а членство не включилось --- */
    if ($клубный && in_array($status, ['paid', 'made'], true) && (int) ($o['user_id'] ?? 0) > 0
        && function_exists('club_status')) {
        $ст = club_status((int) $o['user_id']);
        if (empty($ст['active'])) {
            /* Включаем членство ровно тем же вызовом, что и обычная оплата
               (core/payments.php): период берём из состава заказа. Способ
               оплаты для автопродления здесь не трогаем — его знает только
               касса в момент платежа, и выдумывать его нельзя. */
            $мес = (strpos((string) ($o['items'] ?? ''), '"period":"year"') !== false) ? 12 : 1;
            if (!$dry && function_exists('club_grant')) {
                try {
                    club_grant((int) $o['user_id'], $мес, 'payment', ['period' => $мес >= 12 ? 'year' : 'month']);
                    audit('orders_audit_fix_club', 'awards_orders', $oid, ['user_id' => (int) $o['user_id'], 'месяцев' => $мес]);
                } catch (\Throwable $e) {}
            }
            $исправлено[] = "заказ #$oid ($кто): клубный взнос оплачен, а членство не было активно — включено на "
                          . ($мес >= 12 ? 'год' : 'месяц');
        }
    }

    /* --- 4. Двойная оплата: тот же состав ПО ТОЙ ЖЕ ЗАЯВКЕ в тот же день ---
     *
     * Сравнивать по почте нельзя: педагог заказывает награды за весь класс с
     * одного ящика, и «Медаль дипломанта за 500 ₽» у него повторяется столько
     * раз, сколько детей. Первый прогон на живых данных дал пять таких ложных
     * пар подряд — Шарипов, Буланов, Коробьянц по одной почте. Настоящий дубль
     * — это повтор по ОДНОЙ заявке: один конкурсант, одна и та же награда. */
    $aidDup = (int) ($o['application_id'] ?? 0);
    if ($status !== 'canceled' && $amount > 0 && $aidDup > 0) {
        $близкие = all("SELECT id, status, amount, created_at FROM awards_orders
                         WHERE id > ? AND items = ? AND application_id = ?
                           AND status <> 'canceled'
                           AND created_at BETWEEN ? AND ?",
                       [$oid, (string) $o['items'], $aidDup, $от, $до]);
        foreach ($близкие as $б) {
            /* ДЕНЬГИ ВЗЯЛИ ДВАЖДЫ — ИЛИ ЧЕЛОВЕК ПРОСТО ПЕРЕЗАКАЗАЛ?
             *
             * Два одинаковых заказа по одной заявке — обычное дело: первая
             * попытка оплаты сорвалась (карта, банк, закрытая вкладка), человек
             * оформил заново и заплатил один раз. Такой «дубль» лежит
             * неоплаченным и никого не касается. Тревожит только случай, когда
             * ОБА оплачены: тогда с человека действительно взяли дважды. */
            $обаОплачены = in_array((string) $б['status'], ['paid','made','shipped','delivered'], true)
                         && in_array($status, ['paid','made','shipped','delivered'], true);
            if ($обаОплачены) {
                $владельцу[] = "заказы #$oid и #{$б['id']} ($кто, заявка #$aidDup): ОБА оплачены, одинаковый состав на {$amount} ₽ в один день — "
                             . "похоже на двойную оплату. Сверить с кассой и решить; возврат агент не делает";
            } else {
                $заметки[] = "заказы #$oid и #{$б['id']} ($кто, заявка #$aidDup): одинаковый состав, но оплачен один — "
                           . "вторая попытка оформления, денег дважды не брали";
            }
        }
    }

    /* --- 5. Сумма заказа не сходится со скидкой, записанной в нём --- */
    $full = (int) ($o['amount_full'] ?? 0);
    $pct  = (int) ($o['discount_pct'] ?? 0);
    if ($full > 0 && $pct > 0 && function_exists('loyalty_apply')) {
        $ожид = (int) loyalty_apply($full, $pct) - (int) ($o['vk_bonus_rub'] ?? 0);
        if (abs($ожид - $amount) > 1) {
            $владельцу[] = "заказ #$oid ($кто): в кассе {$amount} ₽, а по прайсу {$full} ₽ со скидкой {$pct}% должно быть {$ожид} ₽ — разница "
                         . ($amount - $ожид) . " ₽";
        }
    }

    /* --- 6. Оригиналы без адреса или индекса: посылка не поедет --- */
    $естьОригинал = false;
    foreach ($items as $it) if (is_array($it) && (string) ($it['kind'] ?? '') === 'original') $естьОригинал = true;
    if ($естьОригинал && in_array($status, ['paid', 'made'], true)) {
        if (trim((string) ($o['address'] ?? '')) === '' || trim((string) ($o['postal_index'] ?? '')) === '') {
            $владельцу[] = "заказ #$oid ($кто): оплачены оригиналы, но "
                         . (trim((string) ($o['address'] ?? '')) === '' ? 'НЕТ АДРЕСА' : 'нет индекса')
                         . " — посылку не отправить";
        }
    }

    /* --- 7. Награды заказаны по заявке без аттестационного результата --- */
    $aid = (int) ($o['application_id'] ?? 0);
    if ($aid > 0 && !$клубный) {
        $res = (string) (scalar("SELECT COALESCE(result,'') FROM applications WHERE id=?", [$aid]) ?? '');
        if (trim($res) === '') {
            $заметки[] = "заказ #$oid ($кто): заявка #$aid ещё без результата — награды заказаны до оценки";
        }
    }
}

/* ---------------------------------------------------------------- отчёт */
$шапка = $дней > 1 ? "Аудит заказов за $от … $до" : "Аудит заказов за $день";
$строки = [$шапка, str_repeat('─', mb_strlen($шапка)), ''];
$строки[] = 'Проверено заказов: ' . count($orders) . ($dry ? '  (сухой прогон, ничего не менялось)' : '');
$строки[] = 'Касса отвечает: ' . ($shop !== '' && $secret !== '' ? 'да' : 'НЕТ — ключи не заданы, сверка по своей базе');
$строки[] = '';

$строки[] = 'ИСПРАВЛЕНО: ' . count($исправлено);
foreach ($исправлено as $x) $строки[] = '  • ' . $x;
$строки[] = '';
$строки[] = 'ТРЕБУЕТ ВАШЕГО РЕШЕНИЯ: ' . count($владельцу);
foreach ($владельцу as $x) $строки[] = '  • ' . $x;
if ($заметки) {
    $строки[] = '';
    $строки[] = 'К сведению: ' . count($заметки);
    foreach ($заметки as $x) $строки[] = '  • ' . $x;
}
if (!$исправлено && !$владельцу && !$заметки) {
    $строки[] = 'Расхождений нет — все заказы в порядке.';
}

$отчёт = implode("\n", $строки) . "\n";
echo $отчёт;

if (!$dry) {
    $dir = BASE_PATH . '/data/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    @file_put_contents($dir . '/orders_audit-' . $день . '.txt', $отчёт);
    // Утренний показ берёт готовый текст отсюда — пересчитывать ночную работу незачем.
    set_setting('orders_audit_last', $отчёт);
    set_setting('orders_audit_last_day', $день);
    set_setting('orders_audit_last_run', date('Y-m-d H:i:s'));

    /* Телеграм владельцу — только когда есть что решать. Отчёт «всё чисто»
       каждую ночь превращается в шум, который перестают читать (так уже вышло
       с уведомлением «Бот не смог ответить»). */
    if ($владельцу && function_exists('tg_notify_admin')) {
        try {
            tg_notify_admin("Аудит заказов за $день: " . count($владельцу) . " вопрос(ов) к Вам\n\n"
                          . implode("\n", array_map(static fn(string $s): string => '• ' . $s, $владельцу)));
        } catch (\Throwable $e) {}
    }
}
