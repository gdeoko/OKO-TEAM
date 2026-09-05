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
    // Ключ адреса для сборки посылок (core/address.php): один адрес — одна посылка,
    // как бы человек его ни записал.
    try { db()->exec("ALTER TABLE awards_orders ADD COLUMN addr_key TEXT DEFAULT ''"); } catch (\Throwable $e) {}
    /* ПОЧТОВЫЙ ИНДЕКС. Форма правки адреса в админке собирала его и пыталась
     * сохранить, а колонки не было вовсе — правка адреса падала с ошибкой и
     * посылку нельзя было переадресовать. Индекс нужен и сам по себе: без него
     * Почта России отправление не примет. */
    try { db()->exec("ALTER TABLE awards_orders ADD COLUMN postal_index TEXT DEFAULT ''"); } catch (\Throwable $e) {}
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
    /* Сквозной номер именного. Считаем от уже выданных по этой заявке, а не с
     * нуля: коллектив дозаказывает детей вторым заказом, и нумерация с единицы
     * упёрлась бы в занятые номера. */
    $namedSeq = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND type='named'", [$appId]);
    foreach ($items as $it) {
        if (!is_array($it) || (string) ($it['kind'] ?? '') !== 'digital') continue;
        $type = $map[mb_strtolower(trim((string) ($it['item'] ?? '')))] ?? '';
        if ($type === '') continue;
        // ФИО получателя из заказа. Правило владельца: одна благодарность =
        // один педагог = одно ФИО. Заказали две — будет два разных документа,
        // поэтому и повтор ловим по паре «тип + получатель», а не по одному типу.
        $person = trim((string) ($it['fio'] ?? ''));
        /* В РЕЕСТРЕ У ИМЕННОГО ДОЛЖНО СТОЯТЬ ИМЯ, А НЕ ЗВАНИЕ.
         *
         * Здесь у 'named' в result уходило звание — одинаковое у всех участников
         * коллектива. Проверка повтора ниже сверяет как раз пару «тип + result»,
         * поэтому из девяти именных дипломов ансамбля заводился ОДИН, а восемь
         * молча пропадали: человек заплатил 3 600 ₽ и получил один документ.
         * Звание на бланк берётся из заявки, так что имени здесь ничего не мешает. */
        $result = $type === 'extra'
            ? (string) ($a['extra_diploma'] ?? '')
            : (($type === 'thanks' || $type === 'named') ? $person : (string) ($a['result'] ?? ''));

        $dup = $type === 'thanks' || $type === 'named'
            ? one("SELECT id FROM diplomas WHERE application_id=? AND type=? AND COALESCE(result,'')=?",
                  [$appId, $type, $result])
            : one("SELECT id FROM diplomas WHERE application_id=? AND type=?", [$appId, $type]);
        /* ПОВТОРНАЯ ОПЛАТА НЕ ПРОГЛАТЫВАЕТСЯ МОЛЧА.
         *
         * Защита от дубля нужна: повторный вызов выдачи по тому же заказу не
         * должен плодить документы. Но она же срабатывает, когда человек
         * ОПЛАТИЛ второй раз — и тогда деньги приняты, документа нет, и никто
         * об этом не узнаёт. Так у Тумановой висят 300 ₽ за вторую
         * благодарность тому же педагогу, а по VR-2026-00098 — 400 ₽ за
         * второй основной диплом, заказанный через три минуты после первого.
         *
         * Выдавать второй такой же документ нельзя (человек мог ошибиться), и
         * возвращать деньги сами мы тоже не вправе — это решение владельца.
         * Значит единственное верное поведение: оставить след и сказать вслух. */
        if ($dup) {
            if (function_exists('audit')) {
                audit('order_digital_duplicate', 'awards_orders', $orderId,
                      ['app' => $appId, 'type' => $type, 'person' => $person,
                       'have' => (int) $dup['id'], 'amount' => (int) ($it['price'] ?? 0)]);
            }
            if (function_exists('tg_notify_admin')) {
                tg_notify_admin('Заказ №' . $orderId . ': «' . (string) ($it['item'] ?? $type)
                    . '»' . ($person !== '' ? ' (' . $person . ')' : '')
                    . ' по заявке ' . (string) $a['number'] . ' уже выдан ранее — второй такой же документ не создаём.'
                    . ' Оплата принята (' . (int) ($it['price'] ?? 0) . ' ₽). Решите: выдать повторно или вернуть.');
            }
            continue;
        }

        // НОМЕР В РЕЕСТРЕ = НОМЕР НА БЛАНКЕ. Здесь дописывался свой суффикс
        // '-2', а печать считала номер заново по позиции педагога и давала '-T2':
        // QR с оплаченного бланка вёл в «диплом не найден», а лишняя запись
        // реестра не стояла ни на одном документе. Считаем тем же индексом.
        $pIdx = ($type === 'thanks' && function_exists('diploma_person_index'))
                  ? diploma_person_index((string) ($a['teacher'] ?? ''), $person)
                  // Именные нумеруются по порядку в заказе: первый -N, второй -N2…
                  : ($type === 'named' ? ++$namedSeq : 0);
        $mk = static fn(int $idx): string => function_exists('diploma_make_number')
                 ? diploma_make_number((string) $a['number'], $type, $idx)
                 : ((string) $a['number'] . '-' . mb_strtoupper($type) . ($idx > 1 ? $idx : ''));
        $num = $mk($pIdx);

        // ОПЛАЧЕННАЯ ПОЗИЦИЯ ВЫДАЁТСЯ ВСЕГДА. Номер бывает занят по-честному: заказ
        // на второго руководителя коллектива, ФИО написано иначе, чем в заявке, и
        // позиция получателя не нашлась. Раньше такая позиция молча пропускалась,
        // записи в реестре не появлялось, и крон её никогда не отправлял: человек
        // заплатил и не получал ничего. Берём следующий свободный номер и печатаем
        // ИМЕННО ЕГО (person_idx уходит в бланк), поэтому реестр и бланк совпадают.
        $tries = 0;
        while (one("SELECT id FROM diplomas WHERE number=?", [$num]) && $tries < 50) {
            $pIdx = max(1, $pIdx) + 1;
            $num  = $mk($pIdx);
            $tries++;
        }
        if ($tries >= 50) {
            // Полсотни занятых номеров подряд означают не совпадение, а поломку:
            // выдавать наугад нельзя, но и молчать нельзя - владелец должен узнать.
            if (function_exists('audit')) {
                audit('order_digital_number_taken', 'awards_orders', $orderId,
                      ['app' => $appId, 'type' => $type, 'number' => $num, 'fio' => $person]);
            }
            if (function_exists('tg_notify_admin')) {
                tg_notify_admin('Заказ №' . $orderId . ': не удалось подобрать номер для «' . $type
                    . '» по заявке ' . (string) $a['number'] . '. Позиция оплачена, выдать вручную.');
            }
            continue;
        }

        $pdf = null;
        try {
            if (function_exists('diploma_pdf_html')) {
                $pdf = diploma_pdf_html((array) $a, [
                    'extra'      => $type === 'extra',
                    'thanks'     => $type === 'thanks',
                    'named'      => $type === 'named',
                    'person'     => $person,      // чьё имя печатать (благодарность/именной)
                    'person_idx' => $pIdx,        // и под каким номером: бланк = реестр
                ]);
            }
        } catch (\Throwable $e) { $pdf = null; }

        insert('diplomas', [
            'number'         => $num,
            'application_id' => $appId,
            'type'           => $type,
            'result'         => $result,
            'pdf_path'       => diploma_store_path($pdf),
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

/** Базовая награда — та, от которой считается всё остальное: основной или именной диплом. */
function award_is_base(string $item): bool {
    $c = award_canon_item($item);
    return $c === 'Основной диплом' || $c === 'Именной диплом';
}

/**
 * ЕСТЬ ЛИ У УЧАСТНИКА ОСНОВНОЙ ДИПЛОМ — В КОРЗИНЕ ИЛИ УЖЕ ПОЛУЧЕННЫЙ.
 *
 * Правило центра (28.08.2026): дополнительный диплом, благодарность педагогу,
 * кубок, статуэтка и медаль — это дополнения к главной награде. Заказ одной
 * благодарности без диплома участника бессмыслен: человек остаётся без
 * документа о собственном результате, а центр печатает награду «в никуда».
 * Поэтому в БЕСПЛАТНОМ конкурсе такие позиции доступны только вместе с
 * основным (или именным) дипломом.
 *
 * Платных конкурсов правило не касается: там основной диплом входит в оргвзнос
 * и приходит сам, требовать его повторно значит брать деньги дважды.
 *
 * «Основной есть» — это любое из трёх: он в этом же заказе; он заказан раньше
 * (и заказ дошёл хотя бы до оплаты); он уже выпущен и лежит в реестре дипломов.
 *
 * Вид требуемого диплома подбирается под корзину, чтобы человеку не навязывать
 * лишнее: собрал электронные — хватит электронного, есть хоть один оригинал или
 * трофей — нужен оригинал (иначе к посылке с медалью не будет самого диплома).
 *
 * @return array{need:bool, kind:string, blocked:string}
 *         need    — требуется ли добавить основной диплом;
 *         kind    — 'digital' | 'original', какой именно добавить;
 *         blocked — название позиции, из-за которой он потребовался.
 */
function award_base_required(array $items, ?int $appId, bool $compIsPaid): array {
    $none = ['need' => false, 'kind' => 'digital', 'blocked' => ''];
    if ($compIsPaid) return $none;

    $hasBase = false; $blocked = ''; $needOriginal = false;
    foreach ($items as $it) {
        if (!is_array($it)) continue;
        $item = trim((string) ($it['item'] ?? ''));
        $kind = (string) ($it['kind'] ?? 'original');
        if ($item === '' || $kind === 'club') continue;
        if (award_canon_item($item) === '') continue;      // доставка и прочее служебное
        if (award_is_base($item)) { $hasBase = true; continue; }
        /* ДОПОЛНИТЕЛЬНЫЙ ДИПЛОМ ЗАКАЗЫВАЕТСЯ ОТДЕЛЬНО. Решение владельца.
         *
         * Он присуждается жюри персонально и за отдельное достоинство
         * выступления — это самостоятельная награда, а не приложение к основному.
         * Требование «сначала купите основной» останавливало людей, у которых
         * основной диплом уже есть по другим заявкам: человек хотел доплатить за
         * присуждённую ему награду и упирался в отказ. Кубок, статуэтка, медаль и
         * благодарность по-прежнему идут только вместе с основным дипломом. */
        if (preg_match('~дополнительн~ui', $item)) continue;
        if ($blocked === '') $blocked = $item;
        if ($kind !== 'digital') $needOriginal = true;     // оригинал или трофей
    }
    if ($hasBase || $blocked === '') return $none;

    // Заказан раньше по этой же заявке — с момента оплаты. Неоплаченный заказ
    // основного не считаем: он может так и не состояться, а награда уже уедет.
    if ($appId) {
        try {
            foreach (all("SELECT items FROM awards_orders
                           WHERE application_id=? AND status IN ('paid','made','shipped','delivered','sent')",
                         [$appId]) as $o) {
                foreach ((array) json_decode((string) ($o['items'] ?? '[]'), true) as $pi) {
                    if (is_array($pi) && award_is_base((string) ($pi['item'] ?? ''))) return $none;
                }
            }
        } catch (\Throwable $e) { /* нет таблицы — просто требуем диплом */ }
        // Уже выпущен (в том числе автоматически, по платному участию).
        try {
            $d = one("SELECT id FROM diplomas WHERE application_id=? AND type IN ('main','named') LIMIT 1", [$appId]);
            if ($d) return $none;
        } catch (\Throwable $e) { /* реестра нет — требуем */ }
    }

    return ['need' => true, 'kind' => $needOriginal ? 'original' : 'digital', 'blocked' => $blocked];
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
function award_item_allowed(string $item, string $kind, string $result, bool $compIsPaid,
                            ?bool $isGroup = null): array {
    $itemN = trim($item);
    $kind  = $kind === 'digital' ? 'digital' : 'original';

    /* ИМЕННОЙ ДИПЛОМ — ТОЛЬКО УЧАСТНИКУ КОЛЛЕКТИВА (жёсткое правило владельца).
     *
     * Смысл именного в том, что диплом коллектива один на всех и висит у
     * руководителя, а ребёнку нужен свой — с фамилией. У солиста основной диплом
     * И ТАК именной: там его фамилия. Заказав оба, он получает два одинаковых
     * документа и платит за второй впустую — ровно это случилось у Самойлова.
     *
     * $isGroup передаётся из заявки. Не передан (старые вызовы) — правило не
     * применяем, чтобы не отказать по незнанию. */
    if ($isGroup === false && preg_match('~именн~ui', $itemN)) {
        return [false, 'Именной диплом выписывается участнику КОЛЛЕКТИВА. '
                     . 'У солиста основной диплом и так именной — на нём стоит его фамилия, '
                     . 'и второй такой же документ заказывать незачем.'];
    }

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
        return [false, 'Этот электронный диплом входит в участие и приходит автоматически — заказывать его не нужно.'];
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
/** Каталог чистых бланков — вне веб-корня, наружу не отдаётся. */
function order_clean_dir(): string { return BASE_PATH . '/data/clean_blanks/'; }

/**
 * Абсолютный путь бланка по сохранённому адресу.
 *
 * В кэше заказов лежат адреса двух поколений: старые прямые ссылки на
 * /diplomas/... и новые на закрытый маршрут админки. И там и там нас интересует
 * только имя файла, поэтому берём его и ищем сначала в закрытом каталоге.
 */
function order_clean_path(string $url): string {
    $name = basename(parse_url($url, PHP_URL_PATH) ?: $url);
    if ($name === '' || !preg_match('~^[A-Za-z0-9._-]+\.pdf$~', $name)) {
        // Новый адрес несёт имя параметром: /admin/?p=orders&blank=...
        parse_str((string) parse_url($url, PHP_URL_QUERY), $q);
        $name = basename((string) ($q['blank'] ?? ''));
    }
    if ($name === '' || !preg_match('~^[A-Za-z0-9._-]+\.pdf$~', $name)) return '';
    $priv = order_clean_dir() . $name;
    if (is_file($priv)) return $priv;
    $pub = BASE_PATH . '/public/diplomas/' . $name;
    return is_file($pub) ? $pub : '';
}

/**
 * ЭТО БУМАГА ИЛИ ИЗДЕЛИЕ?
 *
 * Казалось бы, достаточно поискать в названии «диплом». Но изделие называется
 * «Медаль ДИПЛОМанта», и такая проверка считала медаль дипломом: заказ на одну
 * медаль за 500 ₽ выглядел оплаченной бумагой, а лежавший в нём лишний бланк
 * основного диплома — законным. Владелец увидел это как «заказали медаль, а на
 * скачивание стоит диплом».
 *
 * Поэтому сначала отсекаем изделия, и только потом ищем бумагу.
 */
function award_is_paper(string $item): bool {
    if (preg_match('~кубок|статуэт|медал~ui', $item)) return false;   // изделие
    return (bool) preg_match('~диплом|благодар|грамот~ui', $item);
}

/** Адрес бланка для админки: закрытый маршрут, а не публичный файл. */
function order_clean_url(string $file): string {
    return '/admin/?p=orders&blank=' . rawurlencode(basename($file));
}

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
            $abs = order_clean_path($url);
            if ($abs === '') continue;
            // Старые записи вели прямо в веб-корень: подменяем адрес на закрытый,
            // иначе кнопка «Скачать» так и осталась бы публичной ссылкой.
            $c['url'] = order_clean_url(basename($abs));
            $live[] = $c;
        }
        /* У старых записей вида нет. Восстанавливаем его по составу заказа: без
         * этого админка снова посчитает электронные оригиналами, пока кэш не
         * пересчитают руками. */
        $byType = [];
        foreach (order_items_parse($order) as $p) {
            if (($p['dtype'] ?? '') !== '') $byType[(string) $p['dtype']] = (string) ($p['kind'] ?? 'original');
        }
        foreach ($live as $i => $c) {
            if (isset($c['kind']) && $c['kind'] !== '') continue;
            $live[$i]['kind'] = $byType[(string) ($c['type'] ?? '')] ?? 'original';
        }
        // Кэш посчитан (строка непустая) — возвращаем результат, даже если он пуст.
        if ($raw !== '') return $live;
    }

    if (!$regen) return [];   // ещё не считали — но и бастион в цикле вывода не дёргаем

    $pdfs = order_generate_clean_pdfs($order);
    /* ВИД ПОЗИЦИИ СОХРАНЯЕМ ТОЖЕ.
     *
     * В кэш писались только подпись, адрес, тип и ФИО — вид (оригинал или
     * электронная версия) терялся. Админка отбирает бланки для посылки как раз
     * по нему, а при отсутствии поля считала оригиналом ВСЁ: в разделе «Заказы
     * оригиналов» у Самойлова висели три электронных диплома, и понять, что
     * печатать и класть в коробку, было нельзя. */
    $store = array_map(
        fn($p) => ['label' => $p['label'], 'url' => $p['url'], 'type' => $p['type'],
                   'fio' => $p['fio'] ?? '', 'kind' => (string) ($p['kind'] ?? 'original')],
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
        // Тип бланка определяется названием, а не видом заказа: электронная
        // благодарность — та же благодарность, её тоже надо уметь показать,
        // открыть и скачать. Трофеи (кубок, статуэтка, медаль) бланка не имеют
        // и вернут пустую строку сами.
        $dtype = order_item_diploma_type($name);
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
    // БЛАНК ДЕЛАЕТСЯ ДЛЯ ЛЮБОЙ ЗАКАЗАННОЙ БУМАГИ, А НЕ ТОЛЬКО ДЛЯ ОРИГИНАЛА.
    //
    // Здесь стояло условие «только original»: электронная благодарность бланка
    // не получала вовсе, и в админке её нечего было ни открыть, ни скачать —
    // кнопка печати выдавала производственный лист с номером заказа. Между тем
    // документ одинаковый; разница лишь в том, что оригинал печатают и
    // подписывают живьём, а электронный уходит файлом.
    $jobs = [];
    foreach (order_items_parse($order) as $p) {
        if ($p['dtype'] === '') continue;
        /* ДОПОЛНИТЕЛЬНЫЙ ДИПЛОМ БЕЗ ПРИСУЖДЁННОЙ НОМИНАЦИИ НЕ ПЕЧАТАЕМ.
         *
         * У Самойлова дополнительный диплом присуждён по одной заявке («за
         * искренность исполнения»), а заказ оформлен по другой, где не присуждали
         * ничего. Бланк всё равно готовился — и выходил с выдуманной наградой.
         * Печатать нечего: жюри решения не принимало, подтвердить документ
         * невозможно. Позиция остаётся в заказе видимой, но лист не готовим. */
        if ($p['dtype'] === 'extra' && trim((string) ($app['extra_diploma'] ?? '')) === '') {
            if (function_exists('audit')) {
                audit('order_extra_not_awarded', 'awards_orders', (int) ($order['id'] ?? 0),
                      ['app' => $appId, 'number' => (string) ($app['number'] ?? '')]);
            }
            continue;
        }
        $named = in_array($p['dtype'], ['named', 'thanks'], true);
        $n = $named ? max(1, (int) $p['count']) : 1;   // неименные печатаются одним образцом
        for ($i = 0; $i < $n; $i++) {
            $jobs[] = ['type' => $p['dtype'], 'item' => $p['item'], 'fio' => (string) ($p['fio'] ?? ''),
                       'kind' => (string) $p['kind']];
        }
    }
    /* ПЕЧАТАЕМ РОВНО ТО, ЧТО ОПЛАЧЕНО.
     *
     * Здесь стояло: трофей заказан, а диплома в заказе нет — всё равно положить
     * основной. Замысел понятен (статуэтка без диплома выглядит голо), но в
     * работе это читается как ошибка счёта: педагог оплатил два диплома и
     * статуэтку на 1 800 ₽, а на печать выходило три диплома. Владелец увидел
     * расхождение в 500 ₽ и пошёл искать, где потерялись деньги.
     *
     * Состав печати обязан сходиться с составом оплаты — иначе ни склад, ни
     * бухгалтерия не сверят посылку с заказом. Нужен диплом к трофею — его
     * заказывают позицией, и он появится здесь сам. */
    if (!$jobs && order_has_originals($order)) {
        // Трофей без единой бумаги: печатать нечего, но и молчать нельзя —
        // иначе в админке у заказа не будет ни одного листа и это спишут на сбой.
        if (function_exists('audit')) {
            audit('order_trophy_without_diploma', 'awards_orders', (int) ($order['id'] ?? 0),
                  ['app' => $appId, 'items' => (string) ($order['items'] ?? '')]);
        }
    }

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

        $pdf = null; $err = '';
        try { $pdf = diploma_pdf_html((array)$app, $opt); }
        catch (\Throwable $e) { $pdf = null; $err = $e->getMessage(); }
        if ($pdf && is_file($pdf)) {
            $label = $labels[$t] ?? $j['item'];
            if ($j['fio'] !== '') $label .= ' — ' . $j['fio'];
            $out[] = ['label' => $label, 'path' => $pdf, 'url' => order_clean_url(basename($pdf)),
                      'type' => $t, 'fio' => $j['fio'], 'kind' => (string) ($j['kind'] ?? 'original')];
            continue;
        }
        /* НЕ СОБРАЛСЯ — ГОВОРИМ ОБ ЭТОМ, А НЕ ТЕРЯЕМ ПОЗИЦИЮ МОЛЧА.
         *
         * Ошибка здесь проглатывалась: позиция просто исчезала из списка на
         * печать, и заказ выглядел так, будто её и не заказывали. Именно так у
         * заказа №67 (статуэтка, основной диплом, благодарность) на скачивании
         * осталась одна благодарность — на бастионе снесли браузер, и рендер
         * молча возвращал пустоту по всем бланкам разом.
         *
         * Теперь запись уходит в журнал и в аудит: оплаченная позиция без бланка
         * должна быть видна, а не выясняться от участника через месяц. */
        error_log('order_clean_pdfs: заказ ' . (int) ($order['id'] ?? 0) . ', позиция «' . $j['item']
                . '» (' . $t . ') — бланк не собрался' . ($err !== '' ? ': ' . $err : ''));
        if (function_exists('audit')) {
            audit('order_blank_failed', 'awards_orders', (int) ($order['id'] ?? 0),
                  ['item' => $j['item'], 'type' => $t, 'fio' => $j['fio'], 'error' => mb_substr($err, 0, 200)]);
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
    // Вид позиции — в кэш: по нему админка отделяет посылку от электронных.
    $store = array_map(fn($p) => ['label' => $p['label'], 'url' => $p['url'], 'type' => $p['type'],
                                  'fio' => $p['fio'] ?? '', 'kind' => (string) ($p['kind'] ?? 'original')], $pdfs);
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
    return order_mark_shipped_parcel([$orderId], $track);
}

/**
 * ОТПРАВКА ПОСЫЛКИ: ОДИН ТРЕК — ОДНО ПИСЬМО, НО СО ВСЕМ, ЧТО В КОРОБКЕ.
 *
 * Человек заказывает награды по каждой заявке отдельно, а едут они вместе: один
 * адрес, один ярлык, один трек-номер. Раньше письмо об отправке собиралось по
 * ПЕРВОМУ заказу посылки, и участник читал, что ему выслали только основной и
 * дополнительный дипломы, хотя в коробке лежали ещё благодарность и статуэтка
 * из второго заказа. Человек шёл на почту за неполной посылкой и писал в центр.
 *
 * Поэтому состав письма собирается по ВСЕМ заказам посылки, а номера заказов
 * перечисляются в заголовке. Письмо по-прежнему одно: четыре одинаковых письма
 * подряд читаются как сбой рассылки.
 *
 * @param array<int> $orderIds заказы одной посылки (первый — основной)
 */
function order_mark_shipped_parcel(array $orderIds, string $track): bool {
    orders_migrate();
    $ids = array_values(array_unique(array_filter(array_map('intval', $orderIds), static fn(int $x): bool => $x > 0)));
    if (!$ids) return false;
    $track = trim($track);

    $orders = [];
    foreach ($ids as $i) {
        $o = one("SELECT * FROM awards_orders WHERE id=?", [$i]);
        if ($o) $orders[] = $o;
    }
    if (!$orders) return false;

    foreach ($orders as $o) {
        update('awards_orders', ['status' => 'shipped', 'tracking' => $track, 'shipped_at' => date('Y-m-d H:i:s')],
               'id=:id', ['id' => (int) $o['id']]);
    }

    $order = $orders[0];
    $nums  = array_map(static fn(array $o): int => (int) $o['id'], $orders);
    $email = (string) ($order['email'] ?? '');
    $ok = false;
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $html = order_ship_email(array_merge($order, ['tracking' => $track]), $orders);
        $nagradi = function_exists('mail_senders') ? (mail_senders()['nagradi'] ?? []) : [];
        $opt = ['from_name' => 'Наградный отдел «Музыкальный Мир»'];
        if ($nagradi) $opt['account'] = $nagradi;
        $subj = count($nums) > 1
            ? 'Ваши награды отправлены Почтой России — заказы №' . implode(', №', $nums)
            : 'Ваши награды отправлены Почтой России — заказ №' . $nums[0];
        if (function_exists('mail_send')) $ok = (bool) mail_send($email, $subj, $html, $opt);
    }
    // In-app уведомление.
    $uid = (int) ($order['user_id'] ?? 0);
    if ($uid > 0 && function_exists('notify_user')) {
        $track4 = $track !== '' ? (' Трек: ' . $track . '.') : '';
        $what = count($nums) > 1 ? ('Заказы №' . implode(', №', $nums) . ' отправлены одной посылкой.')
                                 : ('Заказ №' . $nums[0] . ' отправлен.');
        notify_user($uid, 'Награды отправлены Почтой России', $what . $track4, '/cabinet#orders', 'trophy');
    }
    return $ok;
}

/**
 * Красивое письмо об отправке (rich mm_email_tx) с трек-номером и кнопкой отслеживания.
 *
 * @param array $order  основной заказ посылки (адрес, получатель, трек)
 * @param array $parcel все заказы этой посылки; пусто — значит посылка из одного
 *                      заказа. Состав перечисляется по всем: в коробку кладут всё
 *                      разом, и письмо обязано совпадать с тем, что человек достанет.
 */
function order_ship_email(array $order, array $parcel = []): string {
    $base  = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
    $name  = trim((string)($order['full_name'] ?? ''));
    $track = trim((string)($order['tracking'] ?? ''));
    $oid   = (string)($order['id'] ?? '');
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $trackUrl = order_pochta_url($track);

    if (!$parcel) $parcel = [$order];
    $nums = [];
    foreach ($parcel as $o) { $n = (int) ($o['id'] ?? 0); if ($n > 0) $nums[] = $n; }
    if (!$nums) $nums = [(int) $oid];

    /* Одинаковые позиции из разных заказов складываем: «Медаль × 1» и «Медаль × 1»
     * в одной коробке человек видит как две медали, а не как две строки. Именные
     * бланки (диплом на ФИО, благодарность педагогу) не складываются — у каждого
     * своё имя, и order_items_parse держит их отдельными строками. */
    $lines = [];
    foreach ($parcel as $o) {
        foreach (order_items_parse($o) as $p) {
            $key = mb_strtolower(trim((string) $p['item'])) . '|' . mb_strtolower(trim((string) ($p['fio'] ?? '')));
            if (!isset($lines[$key])) $lines[$key] = ['item' => (string) $p['item'], 'fio' => (string) ($p['fio'] ?? ''), 'count' => 0];
            $lines[$key]['count'] += (int) $p['count'];
        }
    }
    $rows = '';
    foreach ($lines as $p) {
        $who = $p['fio'] !== '' ? '<span style="color:' . MM_MUTED . ';"> · ' . h($p['fio']) . '</span>' : '';
        $rows .= '<tr><td style="padding:6px 0;font-size:14px;color:' . MM_INK . ';">' . h($p['item']) . $who . '</td>'
              . '<td style="padding:6px 0;font-size:14px;color:' . MM_NAVY . ';font-weight:700;text-align:right;">× ' . (int)$p['count'] . '</td></tr>';
    }

    $numsHtml = count($nums) > 1
        ? 'заказам <b style="color:' . MM_NAVY . ';">№' . h(implode(', №', $nums)) . '</b> (одной посылкой)'
        : 'заказу <b style="color:' . MM_NAVY . ';">№' . h((string) $nums[0]) . '</b>';

    $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:' . MM_NAVY . ';font-weight:700;">Ваши награды отправлены</h1>'
        . '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . '<p style="margin:0 0 18px;">Наградные материалы по ' . $numsHtml . ' изготовлены и отправлены <b>Почтой России</b>.</p>'
        . ($track !== '' ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-radius:14px;overflow:hidden;"><tr>'
            . '<td style="background:' . MM_NAVY . ';background:linear-gradient(135deg,' . MM_NAVY . ',' . MM_NAVY2 . ');padding:20px 24px;text-align:center;">'
            . '<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72);margin-bottom:6px;">Трек-номер для отслеживания</div>'
            . '<div style="font-family:Georgia,serif;font-size:24px;font-weight:800;color:' . MM_GOLD . ';letter-spacing:.06em;">' . h($track) . '</div></td></tr></table>' : '')
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:' . MM_CARD . ';border:1px solid ' . MM_LINE . ';border-radius:12px;"><tr><td style="padding:14px 20px;">'
        . '<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' . MM_MUTED . ';margin-bottom:6px;">Состав отправления</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table></td></tr></table>'
        . '<p style="margin:14px 0 0;font-size:14px;color:' . MM_MUTED . ';">Доставка Почтой России — обычно до 14 рабочих дней. Отследить посылку можно по кнопке ниже.</p>';

    return mm_email_tx($inner, [
        'preheader' => (count($nums) > 1 ? 'Заказы №' . implode(', №', $nums) . ' отправлены' : 'Заказ №' . $nums[0] . ' отправлен')
                     . ' Почтой России' . ($track !== '' ? '. Трек: ' . $track : '') . '.',
        'hero'      => $trackUrl !== '' ? mm_cta_primary($trackUrl, 'Отследить посылку', 'Почта России · трек ' . $track) : mm_cta_primary($base . '/cabinet#orders', 'Мои заказы в кабинете'),
        'actions'   => [['Личный кабинет', $base . '/cabinet#orders'], ['Оставить отзыв', $base . '/reviews']],
        'thanks'    => true,
    ]);
}

/**
 * СРОКИ И ОЧЕРЕДЬ ПО ЗАКАЗУ — ДЛЯ АДМИНКИ.
 *
 * Владелец смотрит на заказ и должен сразу видеть: когда человек подал заявку на
 * участие, когда оформил заказ, когда оплатил, к какому числу вещь должна быть
 * готова и какой этот заказ по счёту в работе. Раньше в карточке стояла одна
 * дата оформления, и понять, кто ждёт дольше всех, было нельзя.
 *
 * Сроки берутся те же, что обещаны участнику в письмах и в разделе «Вопросы и
 * ответы»: оригиналы - до 7 рабочих дней со дня оплаты, электронные - 5 рабочих
 * дней (3 для участников клуба).
 *
 * @return array{app_date:string, ordered:string, paid_at:string, due:string,
 *               queue:int, queue_total:int, overdue:bool}
 */
function order_timeline(array $o): array {
    $out = ['app_date' => '', 'ordered' => '', 'paid_at' => '', 'due' => '',
            'queue' => 0, 'queue_total' => 0, 'overdue' => false];
    $oid = (int) ($o['id'] ?? 0);
    if (!$oid) return $out;

    $out['ordered'] = (string) ($o['created_at'] ?? '');

    // Когда человек подал заявку на участие.
    $appId = (int) ($o['application_id'] ?? 0);
    if ($appId) {
        try { $out['app_date'] = (string) (scalar("SELECT created_at FROM applications WHERE id=?", [$appId]) ?: ''); }
        catch (\Throwable $e) { /* заявки может не быть */ }
    }

    // Когда оплачен: по успешному платежу, иначе по дате оформления заказа.
    try {
        $out['paid_at'] = (string) (scalar("SELECT created_at FROM payments
                                             WHERE order_id=? AND status='succeeded'
                                             ORDER BY id DESC LIMIT 1", [$oid]) ?: '');
    } catch (\Throwable $e) { /* таблицы может не быть */ }
    if ($out['paid_at'] === '' && in_array((string) ($o['status'] ?? ''), ['paid','made','shipped','delivered'], true)) {
        $out['paid_at'] = (string) ($o['created_at'] ?? '');
    }

    // К какому числу должно быть готово: 7 рабочих дней от оплаты.
    if ($out['paid_at'] !== '') {
        if (!function_exists('working_days_after') && is_file(BASE_PATH . '/core/send_timing.php')) {
            require_once BASE_PATH . '/core/send_timing.php';
        }
        if (function_exists('working_days_after')) {
            try { $out['due'] = working_days_after($out['paid_at'], 7)->format('Y-m-d H:i:s'); }
            catch (\Throwable $e) { $out['due'] = ''; }
        }
    }
    // Просрочка считается только для того, что ещё не изготовлено.
    if ($out['due'] !== '' && (string) ($o['status'] ?? '') === 'paid') {
        $out['overdue'] = strtotime($out['due']) < time();
    }

    /* Очередь: какой это заказ по счёту среди ожидающих изготовления. Считаем от
     * оплаты - кто заплатил раньше, того и делают раньше. */
    if ((string) ($o['status'] ?? '') === 'paid') {
        try {
            $out['queue_total'] = (int) scalar(
                "SELECT COUNT(*) FROM awards_orders
                  WHERE status='paid' AND items LIKE '%\"kind\":\"original\"%'
                    AND items NOT LIKE '%\"kind\":\"club\"%'");
            $out['queue'] = 1 + (int) scalar(
                "SELECT COUNT(*) FROM awards_orders
                  WHERE status='paid' AND items LIKE '%\"kind\":\"original\"%'
                    AND items NOT LIKE '%\"kind\":\"club\"%' AND id < ?", [$oid]);
        } catch (\Throwable $e) { /* без очереди не страшно */ }
    }
    return $out;
}

/** Дата в человеческом виде: «31.08.2026, 14:41». Пусто - прочерк. */
function order_dt(string $s, bool $withTime = true): string {
    $s = trim($s);
    if ($s === '') return '—';
    $ts = strtotime($s);
    if (!$ts) return '—';
    return date($withTime ? 'd.m.Y, H:i' : 'd.m.Y', $ts);
}

/** «3 дня назад» / «сегодня» - чтобы было видно, кто ждёт дольше всех. */
function order_ago(string $s): string {
    $s = trim($s);
    if ($s === '') return '';
    $ts = strtotime($s);
    if (!$ts) return '';
    $d = (int) floor((time() - $ts) / 86400);
    if ($d <= 0) return 'сегодня';
    if ($d === 1) return 'вчера';
    $tail = ($d % 10 === 1 && $d % 100 !== 11) ? 'день'
          : ((in_array($d % 10, [2,3,4], true) && !in_array($d % 100, [12,13,14], true)) ? 'дня' : 'дней');
    return $d . ' ' . $tail . ' назад';
}
