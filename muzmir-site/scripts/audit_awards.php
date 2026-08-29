<?php
/**
 * АУДИТ ЗАКАЗОВ НАГРАД: ГДЕ ЧЕЛОВЕК ЗАПЛАТИЛ И НЕ ПОЛУЧИЛ.
 *
 * Проверки собраны по разборам живых поломок августа 2026, каждая из них уже
 * стоила центру денег или доверия:
 *
 *   1. Оплата есть в кассе, а у нас заказ «не оплачен» — повторный клик
 *      «Оплатить» помечал succeeded-платёж отменённым, и опрос его больше не
 *      видел (заказ №70, 400 ₽, двенадцать попыток оплаты).
 *   2. Оплачено позиций больше, чем выдано документов — девять именных
 *      дипломов схлопывались в один, потому что ключ повтора считался по
 *      званию, одинаковому у всех участников коллектива (заказы №74 и №69,
 *      9 и 14 дипломов).
 *   3. У именного или благодарности в реестре стоит звание вместо ФИО — такой
 *      бланк печатается на название коллектива, то есть ничем не отличается от
 *      основного диплома.
 *   4. Один файл бланка на несколько документов — девять человек получили бы
 *      один и тот же PDF.
 *   5. Позиция оплачена без ФИО получателя — печатать нечего.
 *   6. Документ завис: срок отправки прошёл, а он не ушёл; или счётчик попыток
 *      упёрся в предел и он выпал из очереди навсегда.
 *   7. Номер бланка разошёлся с реестром — QR ведёт в «диплом не найден».
 *   8. Заявка с программой вместо одного номера (п. 8.1 положения).
 *   9. Брошенные счета старше суток.
 *  10. На печать готовится больше бумаг, чем оплачено — заказу с трофеем без
 *      диплома система подкладывала основной, и состав печати расходился с чеком.
 *  11. Две посылки одному человеку на один адрес — адрес вписан то руками, то из
 *      подсказки, и центр вёз одну квартиру двумя отправлениями.
 *
 * Только чтение, ничего не меняет. Запуск:
 *   php scripts/audit_awards.php            — всё
 *   php scripts/audit_awards.php --no-kassa — без обращения к ЮKassa (быстро)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/payments.php';

$skipKassa = in_array('--no-kassa', $argv, true);
$PAID = "status IN ('paid','made','shipped','delivered')";
$line = str_repeat('=', 78);
$problems = 0;
$say = static function (string $t): void { echo $t . "\n"; };
$head = static function (string $t) use ($line, $say): void { $say("\n$line\n$t\n$line"); };

$head('1. ОПЛАТА В КАССЕ ЕСТЬ, А У НАС ЗАКАЗ НЕ ПРОВЕДЁН');
if ($skipKassa) {
    $say('  пропущено (--no-kassa)');
} else {
    $shop = (string) cfgv('yukassa_shop'); $sec = (string) cfgv('yukassa_secret');
    if ($shop === '' || $sec === '') { $say('  ключи ЮKassa не заданы — проверка невозможна'); }
    else {
        $from = gmdate('Y-m-d\TH:i:s.000\Z', time() - 60 * 86400);
        $cursor = ''; $pages = 0; $lost = 0; $seen = 0; $tests = 0; $cosmetic = 0;
        do {
            $url = 'https://api.yookassa.ru/v3/payments?limit=100&status=succeeded'
                 . '&created_at.gte=' . rawurlencode($from)
                 . ($cursor !== '' ? '&cursor=' . rawurlencode($cursor) : '');
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25,
                                    CURLOPT_USERPWD => $shop . ':' . $sec]);
            $j = json_decode((string) curl_exec($ch), true); curl_close($ch);
            if (!is_array($j)) break;
            foreach ((array) ($j['items'] ?? []) as $p) {
                $seen++;
                $pid = (string) ($p['id'] ?? '');
                $sum = (float) ($p['amount']['value'] ?? 0);
                $row = one("SELECT id, status FROM payments WHERE yukassa_id=?", [$pid]);
                if ($row && (string) $row['status'] === 'succeeded') continue;
                // Платежи со старого сайта в нашей базе не заводились никогда —
                // о них здесь говорить не о чем.
                if (stripos((string) ($p['description'] ?? ''), 'Заказ с сайта') !== false) continue;
                // Проверка на копейки — это отладка владельца, а не участник.
                if ($sum < 10) { $tests++; continue; }

                /* ГЛАВНЫЙ ВОПРОС НЕ «ПРОВЕДЁН ЛИ ПЛАТЁЖ», А «ПОЛУЧИЛ ЛИ ЧЕЛОВЕК
                 * ОПЛАЧЕННОЕ». Строка payments могла остаться в pending, пока
                 * заявка давно отмечена оплаченной и наградные материалы выданы:
                 * это несовпадение в журнале, а не потеря денег, и поднимать по
                 * нему тревогу — значит прятать настоящие потери в шуме.
                 * Смотрим по metadata, за что платили, и что с этим стало. */
                $m = (array) ($p['metadata'] ?? []);
                $ids = array_values(array_filter(array_map('intval',
                    explode(',', (string) ($m['application_ids'] ?? $m['application_id'] ?? '')))));
                $oid = (int) ($m['order_id'] ?? 0);
                $covered = false;
                if ($ids) {
                    $in = implode(',', $ids);
                    $paidCnt = (int) scalar("SELECT COUNT(*) FROM applications
                                              WHERE id IN ($in) AND (is_paid=1 OR COALESCE(amount_paid,0) > 0)");
                    $gone    = count($ids) - (int) scalar("SELECT COUNT(*) FROM applications WHERE id IN ($in)");
                    if ($paidCnt > 0) $covered = true;
                    if ($gone === count($ids)) {          // заявок нет — человек заплатил и остался ни с чем
                        $covered = false;
                    }
                } elseif ($oid > 0) {
                    $covered = (bool) scalar("SELECT COUNT(*) FROM awards_orders
                                               WHERE id=? AND status IN ('paid','made','shipped','delivered')", [$oid]);
                }
                if ($covered) {
                    $cosmetic++;
                    printf("  журнал: %s ₽ | %s | заявка оплачена, статус платежа не проведён\n",
                        number_format($sum, 0), mb_substr((string) ($p['description'] ?? ''), 0, 40));
                    continue;
                }
                $lost++; $problems++;
                printf("  ДЕНЬГИ ПРИНЯТЫ, УСЛУГА НЕ ОКАЗАНА: %s ₽ | %s | %s | у нас: %s\n",
                    number_format($sum, 0), mb_substr((string) ($p['description'] ?? ''), 0, 38),
                    (string) ($m['email'] ?? '—'), $row ? 'статус ' . $row['status'] : 'строки нет');
            }
            $cursor = (string) ($j['next_cursor'] ?? ''); $pages++;
        } while ($cursor !== '' && $pages < 10);
        printf("\n  проверено платежей за 60 дней: %d | потерь: %d | расхождений в журнале: %d | проверочных (<10 ₽): %d\n",
               $seen, $lost, $cosmetic, $tests);
        if ($lost === 0) $say('  чисто: денег, принятых без услуги, нет');
    }
}

$head('2. ОПЛАЧЕНО БОЛЬШЕ, ЧЕМ ВЫДАНО');
$bad = 0;
foreach (all("SELECT id, application_id, full_name, email, items FROM awards_orders WHERE $PAID") as $o) {
    $want = ['named' => 0, 'thanks' => 0, 'main' => 0, 'extra' => 0];
    foreach ((array) json_decode((string) $o['items'], true) as $it) {
        if ((string) ($it['kind'] ?? '') !== 'digital') continue;   // оригиналы печатает типография
        $nm = mb_strtolower((string) ($it['item'] ?? ''));
        if (str_contains($nm, 'именн'))            $want['named']++;
        elseif (str_contains($nm, 'благодар'))     $want['thanks']++;
        elseif (str_contains($nm, 'дополнительн')) $want['extra']++;
        elseif (str_contains($nm, 'основной'))     $want['main']++;
    }
    foreach ($want as $t => $n) {
        if ($n === 0) continue;
        $have = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND type=?",
                             [(int) $o['application_id'], $t]);
        if ($have < $n) {
            $bad++; $problems++;
            printf("  заказ #%-4d %-24s %-26s %s: оплачено %d, выдано %d\n", $o['id'],
                mb_substr((string) $o['full_name'], 0, 24), mb_substr((string) $o['email'], 0, 26), $t, $n, $have);
        }
    }
}
if (!$bad) $say('  чисто: недостач нет');

$head('3. ИМЕННОЙ ИЛИ БЛАГОДАРНОСТЬ СО ЗВАНИЕМ ВМЕСТО ФИО');
$bad = 0;
foreach (all("SELECT number, type, result, sent_at FROM diplomas WHERE type IN ('named','thanks')") as $d) {
    if (!preg_match('~ЛАУРЕАТ|ДИПЛОМАНТ|ГРАН-ПРИ|УЧАСТНИК КОНКУРСА~ui', (string) $d['result'])) continue;
    $bad++; $problems++;
    printf("  %-22s %-8s «%s»%s\n", (string) $d['number'], (string) $d['type'],
        mb_substr((string) $d['result'], 0, 30), trim((string) $d['sent_at']) !== '' ? '  УЖЕ ОТПРАВЛЕН' : '');
}
if (!$bad) $say('  чисто: у всех именных и благодарностей стоит ФИО');

$head('4. ОДИН ФАЙЛ БЛАНКА НА НЕСКОЛЬКО ДОКУМЕНТОВ');
$bad = 0;
foreach (all("SELECT pdf_path, COUNT(*) c, GROUP_CONCAT(number) nums FROM diplomas
               WHERE COALESCE(pdf_path,'') <> '' GROUP BY pdf_path HAVING c > 1") as $r) {
    $bad++; $problems++;
    printf("  %s — общий для %d: %s\n", basename((string) $r['pdf_path']), $r['c'], mb_substr((string) $r['nums'], 0, 60));
}
if (!$bad) $say('  чисто: у каждого документа свой файл');

$head('5. ПОЗИЦИЯ ОПЛАЧЕНА БЕЗ ФИО ПОЛУЧАТЕЛЯ');
$bad = 0;
foreach (all("SELECT id, full_name, email, items FROM awards_orders WHERE $PAID") as $o) {
    foreach ((array) json_decode((string) $o['items'], true) as $it) {
        $nm = (string) ($it['item'] ?? '');
        if (!preg_match('~именн|благодар~ui', $nm)) continue;
        if (trim((string) ($it['fio'] ?? '')) !== '') continue;
        $bad++; $problems++;
        printf("  заказ #%-4d %-26s позиция «%s» без ФИО\n", $o['id'], mb_substr((string) $o['email'], 0, 26), $nm);
    }
}
if (!$bad) $say('  чисто: у всех именных позиций и благодарностей есть ФИО');

$head('6. ЗАВИСШИЕ ОТПРАВКИ');
$bad = 0;
foreach (all("SELECT d.number, d.scheduled_at, d.send_tries, a.email
                FROM diplomas d JOIN applications a ON a.id=d.application_id
               WHERE COALESCE(d.sent_at,'')='' AND COALESCE(d.scheduled_at,'')<>''
                 AND datetime(d.scheduled_at) < datetime('now','localtime','-2 hours')
               ORDER BY d.scheduled_at LIMIT 40") as $d) {
    $bad++; $problems++;
    printf("  %-22s срок %s, попыток %d, %s\n", (string) $d['number'], (string) $d['scheduled_at'],
        (int) $d['send_tries'], mb_substr((string) $d['email'], 0, 28));
}
if (!$bad) $say('  чисто: просроченных отправок нет');

$stuck = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE COALESCE(sent_at,'')='' AND COALESCE(send_tries,0) >= 5");
if ($stuck > 0) { $problems++; printf("  ВЫПАЛИ ИЗ ОЧЕРЕДИ (5 неудачных попыток): %d\n", $stuck); }

$head('7. НОМЕР БЛАНКА РАЗОШЁЛСЯ С РЕЕСТРОМ');
$bad = 0;
require_once BASE_PATH . '/core/pdf_diploma.php';
foreach (all("SELECT d.number, d.type, a.number AS anum FROM diplomas d
               JOIN applications a ON a.id=d.application_id") as $d) {
    $t = (string) $d['type'];
    $n = (string) $d['number'];
    $base = (string) $d['anum'];
    // Проверяем только форму: номер обязан начинаться с номера заявки и нести
    // суффикс своего типа. Индекс получателя (-N3, -T2, -E1) законен.
    $okPrefix = str_starts_with($n, $base);
    $sfx = ['main' => '', 'named' => '-N', 'thanks' => '-T', 'extra' => '-E'][$t] ?? null;
    $okSuffix = $sfx === null || $sfx === '' ? true : str_starts_with(substr($n, strlen($base)), $sfx);
    if ($okPrefix && $okSuffix) continue;
    $bad++; $problems++;
    printf("  %-22s тип %-8s заявка %s\n", $n, $t, $base);
}
if (!$bad) $say('  чисто: номера бланков совпадают с реестром');

$head('8. ЗАЯВКИ С ПРОГРАММОЙ ВМЕСТО ОДНОГО НОМЕРА (п. 8.1)');
$bad = 0;
foreach (all("SELECT number, work_title, status, result FROM applications
               WHERE COALESCE(work_title,'')<>'' AND status <> 'rejected'") as $a) {
    $wt = (string) $a['work_title'];
    $marks = preg_match_all('~(?<![\d,.])\b[1-9]\s*[\)\.\-–]\s*(?=[\p{Lu}\p{Ll}«"])~u', $wt) ?: 0;
    if ($marks < 2) continue;
    $bad++; $problems++;
    printf("  %-16s %-18s %s\n", (string) $a['number'], (string) $a['status'], mb_substr($wt, 0, 46));
}
if (!$bad) $say('  чисто: в каждой заявке один конкурсный номер');

$head('9. ЗАКАЗЫ, ЗАВИСШИЕ В «НЕ ОПЛАЧЕНО» СО СЧЁТОМ');
$bad = 0;
foreach (all("SELECT id, full_name, email, amount, created_at FROM awards_orders
               WHERE status='new' AND COALESCE(payment_id,'')<>''
                 AND datetime(created_at) < datetime('now','localtime','-1 day')
               ORDER BY id DESC LIMIT 20") as $o) {
    $bad++;
    printf("  заказ #%-4d %-26s %s ₽ от %s\n", $o['id'], mb_substr((string) $o['email'], 0, 26),
        (string) $o['amount'], substr((string) $o['created_at'], 0, 16));
}
if (!$bad) $say('  чисто: брошенных счетов старше суток нет');
else $say('  (это не всегда ошибка: человек мог передумать на странице оплаты)');

$head('10. НА ПЕЧАТЬ ГОТОВИТСЯ БОЛЬШЕ БУМАГ, ЧЕМ ОПЛАЧЕНО');
/* Заказу с трофеем без диплома система молча подкладывала основной диплом:
 * педагог оплатил два диплома и статуэтку на 1 800 ₽, а на печать выходило три
 * диплома — расхождение в 500 ₽, которое владелец пошёл искать руками. Состав
 * печати обязан сходиться с составом оплаты. */
$bad = 0;
foreach (all("SELECT id, full_name, amount, items, clean_pdfs FROM awards_orders WHERE $PAID") as $o) {
    $paper = 0;
    foreach ((array) json_decode((string) $o['items'], true) as $it) {
        if (preg_match('~диплом|благодар~ui', (string) ($it['item'] ?? ''))) $paper++;
    }
    $sheets = count((array) json_decode((string) ($o['clean_pdfs'] ?? '[]'), true));
    if ($sheets <= $paper) continue;
    $bad++; $problems++;
    printf("  заказ #%-4d %-26s %s ₽: оплачено бумаг %d, готовится к печати %d\n",
        $o['id'], mb_substr((string) $o['full_name'], 0, 26), (string) $o['amount'], $paper, $sheets);
}
if (!$bad) $say('  чисто: печатается ровно то, что оплачено');

$head('11. ДВЕ ПОСЫЛКИ ОДНОМУ ЧЕЛОВЕКУ НА ОДИН АДРЕС');
/* Педагог оформил четыре заказа за восемь минут: первый адрес вписал руками, три
 * следующих взял из подсказки. Записи разошлись на «Россия», область и индекс —
 * и центр собрал две посылки на одну квартиру: две доставки и два похода на почту
 * вместо одного. Сверяем адреса внутри одного получателя. */
require_once BASE_PATH . '/core/order_group.php';
$bad = 0;
$orig = all("SELECT * FROM awards_orders WHERE items LIKE '%\"kind\":\"original\"%'");
$byWho = [];
foreach (og_groups($orig) as $key => $g) {
    if (!str_starts_with((string) $key, 'post:')) continue;
    $byWho[explode(':', (string) $key)[1] ?? ''][] = $g;
}
foreach ($byWho as $who => $list) {
    if (count($list) < 2) continue;
    for ($i = 0; $i < count($list); $i++) {
        for ($j = $i + 1; $j < count($list); $j++) {
            $a = og_norm_address((string) $list[$i]['address']);
            $b = og_norm_address((string) $list[$j]['address']);
            if (!og_addr_same($a, $b)) continue;
            $bad++; $problems++;
            printf("  получатель %s: заказы %s и %s едут порознь на один адрес\n",
                $who, implode(',', $list[$i]['ids']), implode(',', $list[$j]['ids']));
        }
    }
}
if (!$bad) $say('  чисто: на один адрес собирается одна посылка');

$say("\n$line");
printf("ИТОГ: проблем найдено — %d\n", $problems);
$say($line);
