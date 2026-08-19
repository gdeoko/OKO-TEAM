<?php
/**
 * core/orders.php — фулфилмент заказов ОРИГИНАЛОВ наград.
 *
 * Поток: заказ оплачен → сразу собираем производственный пакет (что/сколько/фото,
 * адрес, телефон + ЧИСТЫЕ дипломы без подписи/печати, но с номером+QR) → в Telegram
 * ветку @zakaznagrad И в админку (раздел «Заказы оригиналов»). Центр печатает/подписывает/
 * отправляет сам; в админке вводит трек-номер → участнику красивое письмо «Отправлено
 * Почтой России + отследить» и статусы в личном кабинете.
 */
declare(strict_types=1);

require_once __DIR__ . '/mailer.php';

/** Мягкие миграции: таймстемпы этапов исполнения заказа + кэш чистых PDF. */
function orders_migrate(): void {
    foreach (['made_at', 'shipped_at', 'delivered_at', 'dispatched_at'] as $col) {
        try { db()->exec("ALTER TABLE awards_orders ADD COLUMN $col TEXT"); } catch (\Throwable $e) {}
    }
    try { db()->exec("ALTER TABLE awards_orders ADD COLUMN clean_pdfs TEXT DEFAULT ''"); } catch (\Throwable $e) {}
}

/* ==================== ПРАВИЛА СОСТАВА НАГРАДНОГО МАТЕРИАЛА ====================
 * Требования владельца:
 *  1) Трофей — строго по аттестационному результату заявки:
 *       ГРАН-ПРИ → только кубок, ЛАУРЕАТ → только статуэтка, ДИПЛОМАНТ → только медаль.
 *  2) ОРИГИНАЛЫ дипломов (основной, дополнительный, именной, благодарность) доступны
 *     во ВСЕХ конкурсах, включая платные.
 *  3) В ПЛАТНОМ конкурсе электронные основной и дополнительный дипломы НЕ заказываются:
 *     они входят в оргвзнос и приходят автоматически после аттестации.
 *  4) В бесплатном конкурсе заказывается всё — и оригиналы, и электронные.
 * Правила применяются и на витрине, и на сервере (клиенту доверять нельзя).
 */

/**
 * ИСПОЛНЕНИЕ ЗАКАЗА ЭЛЕКТРОННЫХ НАГРАД.
 *
 * Вызывается при успешной оплате заказа (core/payments.php). Создаёт записи в
 * diplomas по оплаченным электронным позициям и планирует отправку:
 *   • участник ВИП-клуба — через 3 рабочих дня от оплаты;
 *   • обычный участник  — через 5 рабочих дней.
 * Дальше письмо уходит кроном send_diplomas по scheduled_at, одним письмом на заявку.
 *
 * Нужно прежде всего длинному бесплатному конкурсу: там наградные документы не входят
 * в участие, участник заказывает их сам после публикации итогов — и до этой функции
 * оплаченный заказ электронных наград не порождал вообще ничего.
 *
 * Идемпотентна: повторный вызов не создаёт дубли (проверяет тип диплома по заявке).
 */
function order_fulfill_digital(int $orderId): int {
    $o = one("SELECT * FROM awards_orders WHERE id=?", [$orderId]);
    if (!$o) return 0;
    $appId = (int) ($o['application_id'] ?? 0);
    if (!$appId) return 0;

    $items = json_decode((string) ($o['items'] ?? '[]'), true);
    if (!is_array($items)) return 0;

    // Название позиции → тип диплома.
    $map = [
        'основной диплом'        => 'main',
        'дополнительный диплом'  => 'extra',
        'именной диплом'         => 'named',
        'благодарность'          => 'thanks',
    ];

    $a = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$a) return 0;

    // Срок: ВИП-клуб — 3 рабочих дня, остальные — 5 (от момента оплаты заказа).
    if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
    require_once BASE_PATH . '/core/send_timing.php';
    $uid    = (int) ($o['user_id'] ?? $a['user_id'] ?? 0);
    $isVip  = $uid > 0 && function_exists('club_is_active') && club_is_active($uid);
    $wdays  = $isVip ? 3 : 5;
    $sched  = working_days_after(date('Y-m-d H:i:s'), $wdays)->format('Y-m-d H:i:s');

    if (!function_exists('diploma_make_number')) {
        if (is_file(BASE_PATH . '/core/pdf_diploma.php')) require_once BASE_PATH . '/core/pdf_diploma.php';
    }
    if (is_file(BASE_PATH . '/core/diploma_render.php')) require_once BASE_PATH . '/core/diploma_render.php';

    $created = 0;
    foreach ($items as $it) {
        if (!is_array($it) || (string) ($it['kind'] ?? '') !== 'digital') continue;
        $type = $map[mb_strtolower(trim((string) ($it['item'] ?? '')))] ?? '';
        if ($type === '') continue;
        // ФИО получателя из заказа. Правило владельца: одна благодарность =
        // один педагог = одно ФИО. Заказали две — будет два разных документа,
        // поэтому и повтор ловим по паре «тип + получатель», а не по одному типу.
        $person = trim((string) ($it['fio'] ?? ''));
        $result = $type === 'extra'
            ? (string) ($a['extra_diploma'] ?? '')
            : ($type === 'thanks' ? $person : (string) ($a['result'] ?? ''));

        $dup = $type === 'thanks' || $type === 'named'
            ? one("SELECT id FROM diplomas WHERE application_id=? AND type=? AND COALESCE(result,'')=?",
                  [$appId, $type, $result])
            : one("SELECT id FROM diplomas WHERE application_id=? AND type=?", [$appId, $type]);
        if ($dup) continue;

        // НОМЕР В РЕЕСТРЕ = НОМЕР НА БЛАНКЕ. Здесь дописывался свой суффикс
        // '-2', а печать считала номер заново по позиции педагога и давала '-T2':
        // QR с оплаченного бланка вёл в «диплом не найден», а лишняя запись
        // реестра не стояла ни на одном документе. Считаем тем же индексом.
        $pIdx = ($type === 'thanks' && function_exists('diploma_person_index'))
                  ? diploma_person_index((string) ($a['teacher'] ?? ''), $person)
                  : 0;
        $num = function_exists('diploma_make_number')
                 ? diploma_make_number((string) $a['number'], $type, $pIdx)
                 : ((string) $a['number'] . '-' . mb_strtoupper($type));
        // Номер уже занят, значит такой бланк в реестре есть. Выдумывать второй
        // номер нельзя: он не напечатан нигде, а UNIQUE на diplomas.number уронил
        // бы всю выдачу заказа. Проверяем ДО рендера, чтобы не гонять бастион зря.
        if (one("SELECT id FROM diplomas WHERE number=?", [$num])) {
            if (function_exists('audit')) {
                audit('order_digital_number_taken', 'awards_orders', $orderId,
                      ['app' => $appId, 'type' => $type, 'number' => $num, 'fio' => $person]);
            }
            continue;
        }

        $pdf = null;
        try {
            if (function_exists('diploma_pdf_html')) {
                $pdf = diploma_pdf_html((array) $a, [
                    'extra'  => $type === 'extra',
                    'thanks' => $type === 'thanks',
                    'named'  => $type === 'named',
                    'person' => $person,          // чьё имя печатать (благодарность/именной)
                ]);
            }
        } catch (\Throwable $e) { $pdf = null; }

        insert('diplomas', [
            'number'         => $num,
            'application_id' => $appId,
            'type'           => $type,
            'result'         => $result,
            'pdf_path'       => $pdf ?: '',
            'lang'           => 'ru',
            'scheduled_at'   => $sched,
        ]);
        $created++;
    }

    if ($created > 0) {
        if (is_file(BASE_PATH . '/core/app_status.php')) require_once BASE_PATH . '/core/app_status.php';
        if (function_exists('app_status_sync')) app_status_sync($appId);
        if (function_exists('audit')) {
            audit('order_digital_fulfilled', 'awards_orders', $orderId,
                  ['created' => $created, 'vip' => $isVip, 'days' => $wdays, 'at' => $sched]);
        }
    }
    return $created;
}

/* ==================== ОКНО ЗАКАЗА НАГРАД ====================
 * Правило владельца: заказать наградной материал можно ДВА МЕСЯЦА со дня
 * закрытия приёма заявок. Для августовских конкурсов это с 25 августа по
 * 25 октября. Всё это время образцы наград по конкурсу остаются на витрине;
 * когда открывается новый месяц, свежие конкурсы встают выше, а прошлые
 * опускаются вниз и уходят с витрины сами, когда окно истекает.
 *
 * Почему не «пока не закрыт приём»: витрина образцов отбирала конкурсы по
 * status='open', и 25-го числа в 18:00, вместе с закрытием приёма, раздел
 * «Награды» опустел бы полностью — ровно в тот момент, когда люди идут
 * заказывать кубки по своим результатам.
 */

/** Сколько месяцев после закрытия приёма можно заказывать награды. */
const AWARDS_WINDOW_MONTHS = 2;

/** Последний день заказа наград по конкурсу (Y-m-d). '' — дата приёма неизвестна. */
function awards_window_end(array $c): string {
    $base = trim((string) ($c['end_date'] ?? ''));
    if ($base === '') return '';
    try { return (new \DateTime($base))->modify('+' . AWARDS_WINDOW_MONTHS . ' months')->format('Y-m-d'); }
    catch (\Throwable $e) { return ''; }
}

/** Открыт ли заказ наград по конкурсу прямо сейчас. */
function awards_window_open(array $c): bool {
    // Пока идёт приём — окно заведомо открыто.
    if ((string) ($c['status'] ?? '') === 'open') return true;
    $end = awards_window_end($c);
    if ($end === '') return true;   // дата не заполнена: не запрещаем заказ на пустом месте
    return date('Y-m-d') <= $end;
}

/**
 * КАНОНИЧЕСКОЕ имя позиции прайса.
 *
 * В базе одни и те же награды заведены по-разному: «Кубок» и «Кубок Гран-при»,
 * «Медаль» и «Медаль дипломанта», «Благодарность» и «Благодарность педагогу».
 * Из-за этого в форме заказа один и тот же кубок показывался ДВАЖДЫ. Приводим
 * к одному имени везде, где строится каталог наград.
 *
 * Возвращает '' для служебных строк прайса (например «Доставка Почтой России») —
 * они не являются товаром и в каталог не попадают.
 */
function award_canon_item(string $item): string {
    $l = mb_strtolower(trim($item), 'UTF-8');
    if ($l === '') return '';
    if (mb_strpos($l, 'доставк') !== false)   return '';
    if (mb_strpos($l, 'кубок') !== false)     return 'Кубок Гран-при';
    if (mb_strpos($l, 'статуэт') !== false)   return 'Статуэтка лауреата';
    if (mb_strpos($l, 'медал') !== false)     return 'Медаль дипломанта';
    if (mb_strpos($l, 'благодарн') !== false) return 'Благодарность';
    if (mb_strpos($l, 'именн') !== false)     return 'Именной диплом';
    if (mb_strpos($l, 'дополнит') !== false)  return 'Дополнительный диплом';
    if (mb_strpos($l, 'основн') !== false)    return 'Основной диплом';
    return trim($item);
}

/** Трофей, положенный по результату: 'Кубок' | 'Статуэтка' | 'Медаль' | '' (нет результата). */
function award_trophy_for_result(string $result): string {
    $r = mb_strtoupper(trim($result), 'UTF-8');
    if ($r === '') return '';
    if (mb_strpos($r, 'ГРАН') !== false)      return 'Кубок';
    if (mb_strpos($r, 'ЛАУРЕАТ') !== false)   return 'Статуэтка';
    if (mb_strpos($r, 'ДИПЛОМАНТ') !== false) return 'Медаль';
    return '';
}

/** Является ли позиция трофеем (кубок/статуэтка/медаль). */
function award_is_trophy(string $item): bool {
    $n = mb_strtolower(trim($item), 'UTF-8');
    return mb_strpos($n, 'кубок') !== false
        || mb_strpos($n, 'статуэт') !== false
        || mb_strpos($n, 'медал') !== false;
}

/**
 * Разрешена ли позиция к заказу по этой заявке.
 *
 * @param string $item   название позиции («Кубок», «Основной диплом», …)
 * @param string $kind   'original' | 'digital'
 * @param string $result аттестационный результат заявки
 * @param bool   $compIsPaid платный ли конкурс
 * @return array [bool разрешено, string причина отказа]
 */
function award_item_allowed(string $item, string $kind, string $result, bool $compIsPaid): array {
    $itemN = trim($item);
    $kind  = $kind === 'digital' ? 'digital' : 'original';

    // 1) Трофеи — строго по результату, и только оригиналами.
    if (award_is_trophy($itemN)) {
        if ($kind !== 'original') return [false, 'Трофеи выпускаются только оригиналами.'];
        $need = award_trophy_for_result($result);
        if ($need === '') return [false, 'По заявке нет аттестационного результата.'];
        $ok = mb_stripos($itemN, mb_strtolower($need, 'UTF-8')) !== false
              || mb_stripos($need, mb_strtolower($itemN, 'UTF-8')) !== false;
        if (!$ok) {
            return [false, 'По результату «' . $result . '» доступен только этот трофей: ' . $need . '.'];
        }
        return [true, ''];
    }

    // 2) Электронные основной и дополнительный в ПЛАТНОМ конкурсе не заказываются —
    //    они входят в стоимость участия и приходят автоматически.
    if ($kind === 'digital' && $compIsPaid
        && in_array($itemN, ['Основной диплом', 'Дополнительный диплом'], true)) {
        return [false, 'В платном конкурсе этот электронный диплом входит в стоимость участия и приходит автоматически.'];
    }

    // 3) Остальное (оригиналы дипломов везде, электронные именной/благодарность,
    //    в бесплатном — все электронные) разрешено.
    return [true, ''];
}

/**
 * Фильтрует прайс-лист под конкретную заявку.
 * @param array $rows ['Item||kind' => price, ...]
 * @return array тот же формат, только разрешённые позиции
 */
function award_filter_prices(array $rows, string $result, bool $compIsPaid): array {
    $out = [];
    foreach ($rows as $key => $price) {
        $parts = explode('||', (string) $key, 2);
        $item  = $parts[0] ?? '';
        $kind  = $parts[1] ?? 'original';
        [$ok] = award_item_allowed($item, $kind, $result, $compIsPaid);
        if ($ok) $out[$key] = $price;
    }
    return $out;
}

/**
 * Чистые дипломы заказа для админки.
 *
 * ГЕНЕРАЦИЯ ЗДЕСЬ НЕ ПРОИСХОДИТ САМА ПО СЕБЕ. Раньше происходила — и это вешало
 * раздел «Заказы»: пустой результат сохранялся как "[]", а проверка кэша требовала
 * НЕпустой массив, поэтому такой заказ на КАЖДОЙ отрисовке списка снова уходил на
 * бастион с таймаутом 120 секунд на каждый тип диплома. Стоило бастиону сломаться —
 * и страница заказов переставала открываться вообще, причём чинилось это только
 * починкой бастиона: сам кэш никогда не заполнялся.
 *
 * Теперь: показываем то, что уже сохранено (пустой список — тоже валидный ответ),
 * а генерация запускается только явно — кнопкой «Перегенерировать» ($regen) или при
 * отправке заказа в производство.
 */
function order_clean_pdfs(array $order, bool $regen = false): array {
    $oid = (int)($order['id'] ?? 0);
    $raw = trim((string)($order['clean_pdfs'] ?? ''));
    $cached = json_decode($raw, true);

    if (!$regen && is_array($cached)) {
        // Отсеиваем записи, чей файл уже удалён с диска, — остальное отдаём как есть.
        $live = [];
        foreach ($cached as $c) {
            $url = (string) ($c['url'] ?? '');
            if ($url === '') continue;
            $abs = BASE_PATH . '/public/diplomas/' . basename(parse_url($url, PHP_URL_PATH) ?: $url);
            if (is_file($abs)) $live[] = $c;
        }
        // Кэш посчитан (строка непустая) — возвращаем результат, даже если он пуст.
        if ($raw !== '') return $live;
    }

    if (!$regen) return [];   // ещё не считали — но и бастион в цикле вывода не дёргаем

    $pdfs = order_generate_clean_pdfs($order);
    $store = array_map(
        fn($p) => ['label' => $p['label'], 'url' => $p['url'], 'type' => $p['type'], 'fio' => $p['fio'] ?? ''],
        $pdfs
    );
    if ($oid > 0) update('awards_orders', ['clean_pdfs' => json_encode($store, JSON_UNESCAPED_UNICODE)], 'id=:id', ['id' => $oid]);
    return $store;
}

/** Ссылка на отслеживание Почты России по трек-номеру. */
function order_pochta_url(string $track): string {
    $track = trim($track);
    return $track !== '' ? 'https://www.pochta.ru/tracking#' . rawurlencode($track) : '';
}

/** Позиция заказа → фото награды (slug файла в assets/img/awards/<cid>/). */
function order_item_photo_slug(string $item): string {
    $i = mb_strtolower($item);
    if (mb_strpos($i, 'кубок') !== false)      return 'cup';
    if (mb_strpos($i, 'статуэт') !== false)    return 'statuette';
    if (mb_strpos($i, 'медал') !== false)      return 'medal';
    if (mb_strpos($i, 'именн') !== false)      return 'diploma-name';
    if (mb_strpos($i, 'дополнит') !== false)   return 'diploma2';
    if (mb_strpos($i, 'благодар') !== false)   return 'thanks';
    if (mb_strpos($i, 'диплом') !== false)     return 'diploma';
    return 'diploma';
}

/** Позиция заказа → тип диплома для рендера (main/extra/named/thanks) или '' если это физическая награда. */
function order_item_diploma_type(string $item): string {
    $i = mb_strtolower($item);
    if (mb_strpos($i, 'кубок') !== false || mb_strpos($i, 'статуэт') !== false || mb_strpos($i, 'медал') !== false) return '';
    if (mb_strpos($i, 'доставк') !== false) return '';
    if (mb_strpos($i, 'именн') !== false)    return 'named';
    if (mb_strpos($i, 'дополнит') !== false) return 'extra';
    if (mb_strpos($i, 'благодар') !== false) return 'thanks';
    if (mb_strpos($i, 'диплом') !== false)   return 'main';
    return '';
}

/** Разбор позиций заказа с агрегацией по количеству + фото + тип. */
function order_items_parse(array $order): array {
    $raw = json_decode((string)($order['items'] ?? ''), true);
    if (!is_array($raw)) $raw = [];
    $cid = 0;
    if (!empty($order['application_id'])) {
        $cid = (int) scalar("SELECT competition_id FROM applications WHERE id=?", [(int)$order['application_id']]);
    }
    if (!$cid) $cid = (int) scalar("SELECT id FROM competitions WHERE status='open' ORDER BY sort,id LIMIT 1");
    $base = rtrim((string) cfgv('base_url', ''), '/');
    $agg = [];
    foreach ($raw as $it) {
        if (!is_array($it)) continue;
        $name = trim((string)($it['item'] ?? ''));
        $kind = trim((string)($it['kind'] ?? 'original'));
        if ($name === '' || $kind === 'club') continue;
        // ИМЕННЫЕ ПОЗИЦИИ НЕ СХЛОПЫВАЕМ.
        // Именной диплом и благодарность выписываются на КОНКРЕТНОЕ ФИО — витрина
        // и требует его на каждый экземпляр. Раньше ключ агрегации был «вид|название»,
        // и пять благодарностей пяти разным педагогам превращались в одну строку
        // «Благодарность × 5» с потерянными ФИО: в производство уходил один бланк,
        // пустой. Такие позиции держим по строке на экземпляр, различая по ФИО.
        $fio   = trim((string)($it['fio'] ?? ''));
        $dtype = $kind === 'original' ? order_item_diploma_type($name) : '';
        $named = in_array($dtype, ['named', 'thanks'], true);
        $key = $kind . '|' . $name . ($named ? '|' . mb_strtolower($fio) . '|' . count($agg) : '');
        if (!isset($agg[$key])) {
            $slug = order_item_photo_slug($name);
            $photo = '';
            foreach ([$cid] as $c) {
                $web = '/assets/img/awards/' . $c . '/' . $slug . '.jpg';
                if (is_file(BASE_PATH . '/public' . $web)) { $photo = $base . $web; break; }
            }
            $agg[$key] = [
                'item' => $name, 'kind' => $kind, 'count' => 0,
                'price' => (int)($it['price'] ?? 0),
                'photo' => $photo,
                'fio'   => $fio,          // на кого выписывается (именные позиции)
                'dtype' => $dtype,
                'physical' => $kind === 'original' && order_item_diploma_type($name) === '' && mb_strpos(mb_strtolower($name), 'доставк') === false,
            ];
        }
        $agg[$key]['count']++;
    }
    return array_values($agg);
}

/** В заказе есть оригиналы (kind=original, кроме доставки)? — тогда нужен производственный пакет. */
function order_has_originals(array $order): bool {
    foreach (order_items_parse($order) as $p) {
        if ($p['kind'] === 'original' && mb_strpos(mb_strtolower($p['item']), 'доставк') === false) return true;
    }
    return false;
}

/**
 * Генерирует ЧИСТЫЕ дипломы (без подписи/печати, с номером+QR) для заказа — по типам
 * дипломов из позиций. Возвращает [[label,absPath,webUrl], ...].
 */
function order_generate_clean_pdfs(array $order): array {
    $appId = (int)($order['application_id'] ?? 0);
    if ($appId <= 0) return [];
    $app = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$app) return [];
    if (!function_exists('diploma_pdf_html')) require_once BASE_PATH . '/core/diploma_render.php';

    // ИДЁМ ПО ЭКЗЕМПЛЯРАМ, А НЕ ПО ТИПАМ.
    // Здесь стояло $types[$p['dtype']] = $p['item'] — карта «тип → название», которая
    // схлопывала N заказанных именных документов в один. Заказ пяти благодарностей на
    // пятерых педагогов давал ОДИН бланк без ФИО, и в типографию уезжал именно он.
    $jobs = [];
    foreach (order_items_parse($order) as $p) {
        if ($p['kind'] !== 'original' || $p['dtype'] === '') continue;
        $named = in_array($p['dtype'], ['named', 'thanks'], true);
        $n = $named ? max(1, (int) $p['count']) : 1;   // неименные печатаются одним образцом
        for ($i = 0; $i < $n; $i++) {
            $jobs[] = ['type' => $p['dtype'], 'item' => $p['item'], 'fio' => (string) ($p['fio'] ?? '')];
        }
    }
    // Если оригиналы (кубок/статуэтка/медаль) без явного диплома — всё равно кладём основной.
    if (!$jobs && order_has_originals($order)) $jobs[] = ['type' => 'main', 'item' => 'Основной диплом', 'fio' => ''];

    $labels = ['main' => 'Основной диплом', 'extra' => 'Дополнительный диплом', 'named' => 'Именной диплом', 'thanks' => 'Благодарность'];
    $out = [];
    $base = rtrim((string) cfgv('base_url', ''), '/');
    foreach ($jobs as $idx => $j) {
        $t = $j['type'];
        $opt = ['clean' => true];
        if ($t === 'extra')  $opt['extra']  = true;
        if ($t === 'named')  $opt['named']  = true;
        if ($t === 'thanks') $opt['thanks'] = true;
        // ФИО получателя — в рендер: без него благодарность печатается пустой.
        if ($j['fio'] !== '') $opt['person'] = $j['fio'];
        else if (in_array($t, ['named', 'thanks'], true)) $opt['person_idx'] = $idx + 1;

        $pdf = null;
        try { $pdf = diploma_pdf_html((array)$app, $opt); } catch (\Throwable $e) { $pdf = null; }
        if ($pdf && is_file($pdf)) {
            $label = $labels[$t] ?? $j['item'];
            if ($j['fio'] !== '') $label .= ' — ' . $j['fio'];
            $out[] = ['label' => $label, 'path' => $pdf, 'url' => $base . '/diplomas/' . basename($pdf),
                      'type' => $t, 'fio' => $j['fio']];
        }
    }
    return $out;
}

/** Текстовая сводка состава заказа (кол-во × позиция). */
function order_items_summary(array $order): string {
    $lines = [];
    foreach (order_items_parse($order) as $p) {
        // У именных позиций показываем, на кого выписывается: без этого сборщик
        // заказа не знает, чьё имя печатать.
        $fio = trim((string) ($p['fio'] ?? ''));
        $lines[] = '• ' . $p['item'] . ($fio !== '' ? ' — ' . $fio : '') . ' × ' . $p['count'];
    }
    return implode("\n", $lines);
}

/**
 * Диспетч производственного пакета при ОПЛАТЕ (сразу, не ждём дни): в Telegram-ветку
 * @zakaznagrad + чистые дипломы документами. Идемпотентно (dispatched_at).
 */
function order_dispatch_production(int $orderId): bool {
    orders_migrate();
    $order = one("SELECT * FROM awards_orders WHERE id=?", [$orderId]);
    if (!$order || !order_has_originals($order)) return false;
    if (trim((string)($order['dispatched_at'] ?? '')) !== '') return true; // уже отправляли

    $pdfs = order_generate_clean_pdfs($order);
    // Кэшируем чистые дипломы в заказ (для админки — скачивание без повторного рендера).
    $store = array_map(fn($p) => ['label' => $p['label'], 'url' => $p['url'], 'type' => $p['type']], $pdfs);
    update('awards_orders', ['clean_pdfs' => json_encode($store, JSON_UNESCAPED_UNICODE)], 'id=:id', ['id' => $orderId]);

    // Маршрут — ТОПИК «ЗАКАЗЫ НАГРАД» рабочего чата (форум-группа), а не отдельный канал.
    if (is_file(BASE_PATH . '/core/notify_owner.php')) require_once BASE_PATH . '/core/notify_owner.php';
    $chat   = function_exists('owner_tg_chat') ? owner_tg_chat() : (string) cfgv('tg_orders_chat', '');
    $thread = function_exists('owner_tg_thread') ? owner_tg_thread('ЗАКАЗЫ НАГРАД') : null;

    $caption = "🏭 ЗАКАЗ ОРИГИНАЛОВ №{$orderId} — В ПРОИЗВОДСТВО\n"
        . "Конкурс: " . (string)($order['competition'] ?? '') . "\n"
        . "Участник: " . (string)($order['full_name'] ?? '') . "\n"
        . "Результат: " . (string)($order['result'] ?? '') . "\n\n"
        . "СОСТАВ:\n" . order_items_summary($order) . "\n\n"
        . "ПОЛУЧАТЕЛЬ:\n"
        . "ФИО: " . (string)($order['full_name'] ?? '') . "\n"
        . "Адрес: " . ((string)($order['address'] ?? '') ?: '(не указан — уточнить)') . "\n"
        . "Телефон: " . (string)($order['phone'] ?? '') . "\n"
        . "E-mail: " . (string)($order['email'] ?? '') . "\n\n"
        . "Срок изготовления — до 7 раб. дней. Дипломы (чистые, без подписи/печати, с номером+QR) — ниже. "
        . "После отправки введите трек-номер в админке → участник получит письмо.";

    // Пост в топик «ЗАКАЗЫ НАГРАД» + чистые дипломы документами туда же.
    // parse_mode='' (ПЛЕЙН): в подписи боевые данные (имена/адреса) с < > & — HTML-режим
    // Телеграма их не парсит и режет отправку.
    $okTg = false;
    if ($chat !== '' && function_exists('tg_send')) {
        $topt = ['no_preview' => true, 'parse_mode' => ''];
        if ($thread) $topt['message_thread_id'] = $thread;
        $r = null;
        try { $r = tg_send($chat, $caption, $topt); } catch (\Throwable $e) {}
        $okTg = is_array($r) && !empty($r['ok']);
        if ($okTg && function_exists('tg_send_document')) {
            foreach ($pdfs as $p) {
                if (is_file($p['path'])) {
                    $dopt = ['caption' => $p['label'] . ' (оригинал, чистый) — заказ №' . $orderId, 'parse_mode' => ''];
                    if ($thread) $dopt['message_thread_id'] = $thread;
                    try { tg_send_document($chat, $p['path'], $dopt); } catch (\Throwable $e) {}
                }
            }
        }
    }
    update('awards_orders', ['dispatched_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $orderId]);

    // Уведомление владельца (дублирующий канал).
    if (function_exists('owner_notify')) {
        try {
            owner_notify('ПРОИЗВОДСТВО', 'Заказ №' . $orderId . ' — в изготовление', '', [
                'Участник' => (string)($order['full_name'] ?? ''),
                'Состав'   => str_replace("\n", '; ', order_items_summary($order)),
                'Адрес'    => (string)($order['address'] ?? ''),
                'Телефон'  => (string)($order['phone'] ?? ''),
                '_event'   => 'order_production',
            ]);
        } catch (\Throwable $e) {}
    }
    return $okTg;
}

/**
 * Отметить заказ отправленным: статус shipped + трек + письмо участнику «Отправлено
 * Почтой России» с кнопкой «Отследить посылку» + in-app уведомление.
 */
function order_mark_shipped(int $orderId, string $track): bool {
    orders_migrate();
    $order = one("SELECT * FROM awards_orders WHERE id=?", [$orderId]);
    if (!$order) return false;
    $track = trim($track);
    update('awards_orders', ['status' => 'shipped', 'tracking' => $track, 'shipped_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $orderId]);

    $email = (string)($order['email'] ?? '');
    $name  = (string)($order['full_name'] ?? '');
    $ok = false;
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $html = order_ship_email(array_merge($order, ['tracking' => $track]));
        $nagradi = function_exists('mail_senders') ? (mail_senders()['nagradi'] ?? []) : [];
        $opt = ['from_name' => 'Наградный отдел «Музыкальный Мир»'];
        if ($nagradi) $opt['account'] = $nagradi;
        if (function_exists('mail_send')) $ok = (bool) mail_send($email, 'Ваши награды отправлены Почтой России — заказ №' . $orderId, $html, $opt);
    }
    // In-app уведомление.
    $uid = (int)($order['user_id'] ?? 0);
    if ($uid > 0 && function_exists('notify_user')) {
        $track4 = $track !== '' ? (' Трек: ' . $track . '.') : '';
        notify_user($uid, 'Награды отправлены Почтой России', 'Заказ №' . $orderId . ' отправлен.' . $track4, '/cabinet#orders', 'trophy');
    }
    return $ok;
}

/** Красивое письмо об отправке (rich mm_email_tx) с трек-номером и кнопкой отслеживания. */
function order_ship_email(array $order): string {
    $base  = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
    $name  = trim((string)($order['full_name'] ?? ''));
    $track = trim((string)($order['tracking'] ?? ''));
    $oid   = (string)($order['id'] ?? '');
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $trackUrl = order_pochta_url($track);

    $rows = '';
    foreach (order_items_parse($order) as $p) {
        $rows .= '<tr><td style="padding:6px 0;font-size:14px;color:' . MM_INK . ';">' . h($p['item']) . '</td>'
              . '<td style="padding:6px 0;font-size:14px;color:' . MM_NAVY . ';font-weight:700;text-align:right;">× ' . (int)$p['count'] . '</td></tr>';
    }

    $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:' . MM_NAVY . ';font-weight:700;">Ваши награды отправлены</h1>'
        . '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . '<p style="margin:0 0 18px;">Наградные материалы по заказу <b style="color:' . MM_NAVY . ';">№' . h($oid) . '</b> изготовлены и отправлены <b>Почтой России</b>.</p>'
        . ($track !== '' ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-radius:14px;overflow:hidden;"><tr>'
            . '<td style="background:' . MM_NAVY . ';background:linear-gradient(135deg,' . MM_NAVY . ',' . MM_NAVY2 . ');padding:20px 24px;text-align:center;">'
            . '<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72);margin-bottom:6px;">Трек-номер для отслеживания</div>'
            . '<div style="font-family:Georgia,serif;font-size:24px;font-weight:800;color:' . MM_GOLD . ';letter-spacing:.06em;">' . h($track) . '</div></td></tr></table>' : '')
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:' . MM_CARD . ';border:1px solid ' . MM_LINE . ';border-radius:12px;"><tr><td style="padding:14px 20px;">'
        . '<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' . MM_MUTED . ';margin-bottom:6px;">Состав отправления</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table></td></tr></table>'
        . '<p style="margin:14px 0 0;font-size:14px;color:' . MM_MUTED . ';">Доставка Почтой России — обычно до 14 рабочих дней. Отследить посылку можно по кнопке ниже.</p>';

    return mm_email_tx($inner, [
        'preheader' => 'Заказ №' . $oid . ' отправлен Почтой России' . ($track !== '' ? '. Трек: ' . $track : '') . '.',
        'hero'      => $trackUrl !== '' ? mm_cta_primary($trackUrl, 'Отследить посылку', 'Почта России · трек ' . $track) : mm_cta_primary($base . '/cabinet#orders', 'Мои заказы в кабинете'),
        'actions'   => [['Личный кабинет', $base . '/cabinet#orders'], ['Оставить отзыв', $base . '/reviews']],
        'thanks'    => true,
    ]);
}
