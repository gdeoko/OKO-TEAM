<?php
/**
 * ЗАКАЗЫ НАГРАД ОДНОГО ЧЕЛОВЕКА — ОДНОЙ ПОСЫЛКОЙ.
 *
 * Человек заказывает награды по каждой заявке отдельно: благодарность педагогу
 * за одного ученика, потом за второго, потом медаль. В базе это разные заказы —
 * так и должно быть, у каждого своя оплата и своя заявка. А вот в работе это
 * одна посылка на один адрес: печатать по отдельности, клеить три конверта и
 * трижды платить за пересылку бессмысленно и дорого.
 *
 * Здесь заказы собираются в группы по получателю:
 *   • оригиналы — по адресу доставки (нормализованному: регистр, пробелы,
 *     сокращения улиц и запятые у людей всегда разные);
 *   • электронные — по адресу почты, на которую уйдут файлы.
 * Разные адреса — разные группы, даже если человек один: он мог заказать себе
 * и в школу.
 *
 * Группировка живёт только на показе — в админке и кабинете. Сами заказы не
 * склеиваются: за каждым стоит своя оплата, свой чек и своя заявка, и ломать
 * это ради удобства печати нельзя.
 */
declare(strict_types=1);

/** Вид заказа по составу: оригиналы, электронные или и то и другое. */
function og_kind(array $order): string {
    $items = json_decode((string) ($order['items'] ?? '[]'), true);
    $orig = $digi = false;
    foreach ((array) $items as $it) {
        $k = is_array($it) ? (string) ($it['kind'] ?? '') : '';
        if ($k === 'original') $orig = true;
        elseif ($k === 'digital') $digi = true;
    }
    if ($orig && $digi) return 'mixed';
    if ($orig) return 'original';
    if ($digi) return 'digital';
    return (string) ($order['kind'] ?? '');
}

/** Человекочитаемое название вида. */
function og_kind_ru(string $kind): string {
    return ['original' => 'оригиналы почтой', 'digital' => 'электронные', 'mixed' => 'оригиналы и электронные'][$kind] ?? $kind;
}

/** Нужна ли этому заказу почтовая доставка. */
function og_needs_address(array $order): bool {
    return in_array(og_kind($order), ['original', 'mixed'], true);
}

/**
 * Приведение адреса к сравнимому виду.
 *
 * Один и тот же адрес человек пишет каждый раз иначе: «ул. Дружбы, д. 180» и
 * «улица Дружбы 180». Без нормализации группировка развалится на ровном месте.
 */
function og_norm_address(string $addr): string {
    $s = mb_strtolower(trim($addr));
    $s = str_replace(['ё'], ['е'], $s);
    // Люди пишут слитно: «дом180», «49Горный». Без разделения буквы и цифры
    // номер дома прилипает к слову и адрес перестаёт совпадать сам с собой.
    $s = preg_replace('~(\p{L})(\d)~u', '$1 $2', $s) ?? $s;
    $s = preg_replace('~(\d)(\p{L})~u', '$1 $2', $s) ?? $s;
    // Сокращения и слова-связки убираем целиком: они ничего не различают.
    $s = preg_replace('~\b(г|гор|город|обл|область|край|р-н|район|пос|посёлок|поселок|с|село|ст|станица|ул|улица|пр|просп|проспект|пер|переулок|шоссе|наб|набережная|б-р|бульвар|мкр|микрорайон|д|дом|кв|квартира|корп|корпус|стр|строение|влд|владение)\.?\b~u', ' ', $s) ?? $s;
    $s = preg_replace('~[^\p{L}\p{N}]+~u', ' ', $s) ?? $s;

    // СРАВНИВАЕМ НАБОР СЛОВ, А НЕ СТРОКУ.
    //
    // Один и тот же адрес приходит то с индексом впереди, то в конце, то с
    // лишним «п» перед посёлком, то с повтором названия. Строку в строку такие
    // записи не сойдутся никогда, а набор значимых слов — сойдётся. Однобуквенные
    // остатки сокращений выбрасываем: они ничего не значат, но ломают сравнение.
    /* ШУМ, КОТОРЫЙ НИЧЕГО НЕ РАЗЛИЧАЕТ.
     *
     * Один и тот же человек за восемь минут оформил четыре заказа на один адрес,
     * но в первом написал его руками («г.Балашиха… ул. Поликахина д.1, индекс
     * 143980»), а в остальных взял из подсказки («Россия, Московская обл, г
     * Балашиха…»). Наборы слов разошлись на «россия», «московская», «индекс» и
     * сам индекс — и центр собрал ДВЕ посылки на одну квартиру: две доставки,
     * два трека, два похода на почту вместо одного.
     *
     * Страна, слово «индекс» и шестизначный почтовый индекс адрес не уточняют:
     * дом от дома они не отличают. Убираем их до сравнения. */
    $noise = ['россия', 'российская', 'федерация', 'рф', 'индекс', 'почтовый', 'почтовая'];
    $words = array_values(array_unique(array_filter(
        preg_split('~\s+~u', trim($s)) ?: [],
        static function (string $w) use ($noise): bool {
            if ($w === '') return false;
            if (in_array($w, $noise, true)) return false;
            if (ctype_digit($w) && mb_strlen($w) === 6) return false;   // почтовый индекс
            return mb_strlen($w) > 1 || ctype_digit($w);
        }
    )));
    sort($words, SORT_STRING);
    return implode(' ', $words);
}

/**
 * ОДИН ЛИ ЭТО АДРЕС.
 *
 * Даже без шума записи расходятся: в одной есть «московская», в другой нет; в
 * одной «мкр» развёрнут, в другой опущен. Строгое равенство наборов слов такие
 * записи не сведёт никогда, а человек и почтальон видят один адрес.
 *
 * Считаем адреса одним, если у них общее ядро: не меньше двух общих слов длиной
 * от четырёх букв (это город и улица) и не меньше двух третей меньшего набора.
 * Порог намеренно высокий: склеить два РАЗНЫХ адреса дороже, чем оставить две
 * посылки — во втором случае человек получит всё, просто двумя отправлениями.
 */
function og_addr_same(string $a, string $b): bool {
    if ($a === '' || $b === '') return false;
    if ($a === $b) return true;
    $wa = array_filter(explode(' ', $a), static fn($w) => $w !== '');
    $wb = array_filter(explode(' ', $b), static fn($w) => $w !== '');
    if (!$wa || !$wb) return false;
    $common = array_intersect($wa, $wb);
    $long = 0;
    foreach ($common as $w) if (mb_strlen($w) >= 4) $long++;
    if ($long < 2) return false;
    $ratio = count($common) / min(count($wa), count($wb));
    return $ratio >= 0.66;
}

/**
 * Ключ группы. Одинаковый ключ — одна посылка или одно письмо.
 *
 * У оригиналов ключ по адресу: именно он определяет посылку. У электронных по
 * почте: файлы уходят письмом, и адрес доставки к делу не относится.
 */
function og_key(array $order): string {
    $uid  = (int) ($order['user_id'] ?? 0);
    $mail = mb_strtolower(trim((string) ($order['email'] ?? '')));
    if (og_needs_address($order)) {
        $addr = og_norm_address((string) ($order['address'] ?? ''));
        // Без адреса группировать по адресу нельзя — такой заказ стоит отдельно
        // и виден как требующий уточнения.
        if ($addr === '') return 'noaddr:' . ($uid ?: $mail) . ':' . (int) ($order['id'] ?? 0);
        return 'post:' . ($uid ?: $mail) . ':' . $addr;
    }
    return 'mail:' . ($uid ?: $mail) . ':' . $mail;
}

/**
 * Сгруппировать заказы.
 *
 * @param array $orders строки awards_orders
 * @return array<string,array{key:string,orders:array,kind:string,address:string,email:string,
 *                            full_name:string,amount:int,items:array,statuses:array,ids:array}>
 */
function og_groups(array $orders): array {
    /* ГРУППИРУЕТСЯ ТОЛЬКО ТО, ЧТО ЕДЕТ ПОЧТОЙ.
     *
     * Смысл группы один: одна посылка на один живой адрес. Поэтому вместе
     * собираются оригиналы одного человека на один адрес — их кладут в одну
     * коробку, клеят один ярлык и вводят один трек-номер.
     *
     * Электронные заказы в группы НЕ ВХОДЯТ. Их никуда не везут: файлы уходят
     * письмом в течение пяти рабочих дней со дня заказа, и делает это раздел
     * «Заказы электронных наград». Была попытка показывать их вместе с посылкой
     * того же человека — вышло хуже: медаль и три электронные благодарности
     * выглядели одним отправлением, у электронных появлялся чужой почтовый
     * адрес, а сумма посылки включала то, что почтой не поедет. Каждый
     * электронный заказ остаётся сам по себе.
     */
    $g = [];
    $withAddr = [];    // оригиналы с адресом: они и образуют посылки
    $noAddr    = [];   // оригиналы без адреса и электронные заказы

    foreach ($orders as $o) {
        $addr = og_norm_address((string) ($o['address'] ?? ''));
        if ($addr !== '' && og_needs_address($o)) $withAddr[] = $o; else $noAddr[] = $o;
    }

    $put = static function (array &$g, string $k, array $o): void {
        if (!isset($g[$k])) {
            $g[$k] = ['key' => $k, 'orders' => [], 'kind' => 'digital',
                      'address' => '', 'email' => (string) ($o['email'] ?? ''),
                      'full_name' => (string) ($o['full_name'] ?? ''), 'amount' => 0,
                      'items' => [], 'statuses' => [], 'ids' => []];
        }
        $g[$k]['orders'][]  = $o;
        $g[$k]['ids'][]     = (int) ($o['id'] ?? 0);
        $g[$k]['amount']   += (int) ($o['amount'] ?? 0);
        $g[$k]['statuses'][(string) ($o['status'] ?? '')] = true;
        if (trim((string) ($o['address'] ?? '')) !== '' && $g[$k]['address'] === '') {
            $g[$k]['address'] = (string) $o['address'];
        }
        // Вид группы: хоть один оригинал — вся посылка едет почтой.
        $kk = og_kind($o);
        if ($kk === 'original' || $kk === 'mixed') {
            $g[$k]['kind'] = ($g[$k]['kind'] === 'digital' && count($g[$k]['orders']) > 1) ? 'mixed' : $kk;
        }
        foreach ((array) json_decode((string) ($o['items'] ?? '[]'), true) as $it) {
            if (!is_array($it)) continue;
            $g[$k]['items'][] = $it + ['order_id' => (int) ($o['id'] ?? 0),
                                       'application_id' => (int) ($o['application_id'] ?? 0)];
        }
    };

    /* 1. ПОСЫЛКИ: ОДИН ПОЛУЧАТЕЛЬ, ОДИН АДРЕС, ОДНО ОКНО ВРЕМЕНИ.
     *
     * Адреса мало: человек заказывает награды и в августе, и в ноябре, и это
     * разные посылки — первую давно отправили. Поэтому внутри адреса заказы
     * разбиваются на окна: всё, что заказано в течение пяти дней от первого
     * заказа окна, едет вместе; заказ позже открывает новое окно. Пять дней —
     * тот же срок, за который центр обещает изготовить наградные материалы,
     * так что ждать дольше уже нельзя.
     */
    usort($withAddr, static fn(array $a, array $b): int
        => strcmp((string) ($a['created_at'] ?? ''), (string) ($b['created_at'] ?? '')));

    $windowStart = [];    // ключ адреса → время первого заказа текущего окна
    $windowNo    = [];    // ключ адреса → номер окна
    $known       = [];    // получатель → [нормализованный адрес => ключ адреса]
    foreach ($withAddr as $o) {
        $who  = (int) ($o['user_id'] ?? 0) ?: mb_strtolower(trim((string) ($o['email'] ?? '')));
        // Готовый ключ от DaData точнее разбора строки: он одинаков и у адреса,
        // вписанного руками, и у выбранного из подсказки.
        $norm = trim((string) ($o['addr_key'] ?? ''));
        if ($norm === '') $norm = og_norm_address((string) ($o['address'] ?? ''));

        /* ПРЕЖДЕ ЧЕМ ЗАВОДИТЬ НОВУЮ ПОСЫЛКУ — СМОТРИМ, НЕТ ЛИ УЖЕ ОТКРЫТОЙ НА ЭТОТ
         * ЖЕ АДРЕС. Тот же человек пишет адрес то руками, то из подсказки, и записи
         * расходятся на «Россия», область и индекс. Без этой сверки центр собирал
         * две посылки на одну квартиру. Сверяем только внутри одного получателя:
         * похожие адреса разных людей — это разные люди. */
        $known[$who] ??= [];
        foreach ($known[$who] as $seen => $keyAddr) {
            if (og_addr_same($norm, (string) $seen)) { $norm = $keyAddr; break; }
        }
        $known[$who][$norm] = $norm;

        $base = 'post:' . $who . ':' . $norm;
        $ts   = strtotime((string) ($o['created_at'] ?? '')) ?: 0;

        if (!isset($windowStart[$base]) || $ts <= 0) {
            $windowStart[$base] = $ts; $windowNo[$base] = 1;
        } elseif ($ts - $windowStart[$base] > 5 * 86400) {
            $windowStart[$base] = $ts; $windowNo[$base]++;
        }
        $put($g, $base . ':w' . $windowNo[$base], $o);
    }

    // 2. Всё остальное — своей карточкой: электронные заказы и оригиналы без
    //    адреса. Электронные едут не почтой, а письмом (раздел «Заказы
    //    электронных наград»); оригинал без адреса объединять не с чем, пока
    //    получатель не скажет, куда его везти.
    foreach ($noAddr as $o) {
        $put($g, 'solo:' . (int) ($o['id'] ?? 0), $o);
    }

    // 3. Союз посылок одной заявки на один адрес (og_sliy_po_zayavke): личность
    //    заказчика и окно в пять дней делят верно не всегда.
    og_sliy_po_zayavke($g);

    // Вид группы уточняем по фактическому составу: так «оригиналы и электронные»
    // не появляется там, где всё электронное, и наоборот.
    foreach ($g as $k => $grp) {
        $orig = $digi = false;
        foreach ($grp['items'] as $it) {
            $kk = (string) ($it['kind'] ?? '');
            if ($kk === 'original') $orig = true;
            elseif ($kk === 'digital') $digi = true;
        }
        $g[$k]['kind'] = $orig && $digi ? 'mixed' : ($orig ? 'original' : 'digital');
    }
    return $g;
}

/**
 * ОДНА ЗАЯВКА, ОДИН АДРЕС, НИЧЕГО НЕ УЕХАЛО — ЭТО ОДНА ПОСЫЛКА.
 *
 * Личность заказчика и окно в пять дней делят посылки верно почти всегда, но
 * на заявке 2368 они ошиблись оба: дополнительный диплом заказал педагог со
 * своего аккаунта 08.10, а основной — тот же участник гостем с другой почты
 * 18.10. Вышли две группы, то есть две коробки, два трек-номера и два письма
 * на один дом по одному ребёнку.
 *
 * Поэтому поверх первого разбора стоит союз: группы с ОБЩЕЙ ЗАЯВКОЙ и ОДНИМ
 * адресом становятся одной посылкой. Условий ровно три, и каждое нужно:
 *  - общая заявка. Это один участник и один наградной набор, поэтому слить их
 *    всегда верно. Одного адреса МАЛО: у заявки 2411 два именных диплома
 *    разным детям коллектива и два разных адреса в Москве, и слить их значило
 *    бы отправить обоим одну коробку;
 *  - один адрес (og_addr_same). По заявке можно заказать награду и себе домой,
 *    и в школу - это законно две посылки;
 *  - ничего из группы НЕ УЕХАЛО. Окно в пять дней написано под случай «первую
 *    давно отправили», и это правда: отправленную посылку не догнать. Здесь же
 *    обе ждут изготовления, и десять дней между заказами значат лишь, что
 *    человек доплатил позже.
 */
function og_sliy_po_zayavke(array &$g): void {
    $norm = static function (array $o): string {
        $n = trim((string) ($o['addr_key'] ?? ''));
        return $n !== '' ? $n : og_norm_address((string) ($o['address'] ?? ''));
    };

    $kand = [];
    foreach ($g as $k => $grp) {
        if (strncmp((string) $k, 'post:', 5) !== 0) continue;   // сливаются только посылки
        $uehalo = false; $apps = []; $addr = '';
        foreach ((array) ($grp['orders'] ?? []) as $o) {
            $st = (string) ($o['status'] ?? '');
            if ($st === 'shipped' || $st === 'delivered') { $uehalo = true; break; }
            $a = (int) ($o['application_id'] ?? 0); if ($a > 0) $apps[$a] = true;
            if ($addr === '') $addr = $norm($o);
        }
        $ids = array_map('intval', (array) ($grp['ids'] ?? []));
        if ($uehalo || !$apps || $addr === '' || !$ids) continue;
        $kand[$k] = ['apps' => $apps, 'addr' => $addr, 'min' => min($ids)];
    }
    if (count($kand) < 2) return;

    $parent = [];
    $find = static function (string $x) use (&$parent): string {
        while (($parent[$x] ?? $x) !== $x) $x = (string) $parent[$x];
        return $x;
    };
    $list = array_keys($kand);
    foreach ($list as $i => $a) {
        for ($j = $i + 1, $n = count($list); $j < $n; $j++) {
            $b = $list[$j];
            if (!array_intersect_key($kand[$a]['apps'], $kand[$b]['apps'])) continue;
            if (!og_addr_same($kand[$a]['addr'], $kand[$b]['addr'])) continue;
            $ra = $find((string) $a); $rb = $find((string) $b);
            if ($ra === $rb) continue;
            // Остаётся группа с самым ранним заказом: ключ посылки не должен
            // прыгать от порядка перебора.
            if ($kand[$ra]['min'] <= $kand[$rb]['min']) $parent[$rb] = $ra; else $parent[$ra] = $rb;
        }
    }
    if (!$parent) return;

    foreach ($list as $k) {
        $k = (string) $k;
        $root = $find($k);
        if ($root === $k || !isset($g[$k], $g[$root])) continue;
        foreach ((array) $g[$k]['orders'] as $o)     $g[$root]['orders'][] = $o;
        foreach ((array) $g[$k]['ids'] as $i)        $g[$root]['ids'][]    = (int) $i;
        foreach ((array) $g[$k]['items'] as $it)     $g[$root]['items'][]  = $it;
        foreach (array_keys((array) $g[$k]['statuses']) as $s) $g[$root]['statuses'][(string) $s] = true;
        $g[$root]['amount'] += (int) ($g[$k]['amount'] ?? 0);
        if (trim((string) ($g[$root]['address'] ?? '')) === '') {
            $g[$root]['address'] = (string) ($g[$k]['address'] ?? '');
        }
        unset($g[$k]);
    }

    // Внутри посылки заказы по возрастанию номера: оператор печатает по порядку,
    // и по тому же порядку собран состав коробки в письме об отправке.
    foreach ($g as $k => $grp) {
        $ids = array_values(array_unique(array_map('intval', (array) ($grp['ids'] ?? []))));
        if (count($ids) < 2) continue;
        sort($ids);
        $g[$k]['ids'] = $ids;
        $ord = (array) ($grp['orders'] ?? []);
        usort($ord, static fn(array $a, array $b): int => ((int) ($a['id'] ?? 0)) <=> ((int) ($b['id'] ?? 0)));
        $g[$k]['orders'] = $ord;
    }
}

/**
 * ВСЕ ЗАКАЗЫ ТОЙ ЖЕ ПОСЫЛКИ, ЧТО И ЗАДАННЫЙ.
 *
 * Нужно там, где кнопка стоит у одного заказа, а действие относится к посылке
 * целиком: отправка с трек-номером. В «Очереди отправки» карточки идут по
 * заказам, и без этой сверки трек проставлялся одному заказу, а второй из той же
 * коробки оставался «в производстве», и участник получал письмо с половиной
 * содержимого посылки.
 *
 * @return array<int> id заказов посылки, первым — переданный
 */
function og_parcel_ids(int $orderId): array {
    $o = one("SELECT * FROM awards_orders WHERE id=?", [$orderId]);
    if (!$o) return [];
    if (!og_needs_address($o)) return [$orderId];   // электронные посылками не ездят

    $uid   = (int) ($o['user_id'] ?? 0);
    $mail  = trim((string) ($o['email'] ?? ''));
    $app   = (int) ($o['application_id'] ?? 0);
    if ($uid <= 0 && $mail === '' && $app <= 0) return [$orderId];

    /* ОТБОР ШИРЕ ЛИЧНОСТИ ЗАКАЗЧИКА: ИНАЧЕ СОСЕД ПО ПОСЫЛКЕ НЕ ЗАГРУЗИТСЯ.
     *
     * Заказы одной заявки бывают оформлены с разных почт и из разных учётных
     * записей (заявка 2368: дополнительный диплом заказал педагог со своего
     * аккаунта, основной - участник гостем с другой почты). Собирает их в одну
     * посылку og_groups, но до неё дело не дойдёт, если сюда их не принести:
     * отбор по одной личности второго заказа не видел вовсе. Лишние строки не
     * опасны - решает всё равно группировка. */
    $cond = []; $args = [];
    if ($uid > 0)     { $cond[] = 'user_id = ?';             $args[] = $uid; }
    if ($mail !== '') { $cond[] = 'LOWER(email) = LOWER(?)'; $args[] = $mail; }
    if ($app > 0)     { $cond[] = 'application_id = ?';      $args[] = $app; }

    $rows = all("SELECT * FROM awards_orders
                  WHERE (" . implode(' OR ', $cond) . ") AND status IN ('paid','made','shipped')
               ORDER BY id ASC LIMIT 200", $args);
    foreach (og_groups($rows) as $grp) {
        if (in_array($orderId, array_map('intval', $grp['ids']), true)) {
            $ids = array_values(array_unique(array_map('intval', $grp['ids'])));
            // Переданный заказ — первым: по нему берутся получатель и адрес письма.
            usort($ids, static fn(int $a, int $b): int => ($a === $orderId ? -1 : ($b === $orderId ? 1 : $a <=> $b)));
            return $ids;
        }
    }
    return [$orderId];
}

/** Общий статус группы: самый ранний из встреченных — по нему видно, что делать. */
function og_group_status(array $group): string {
    foreach (['paid', 'made', 'shipped', 'delivered', 'new', 'canceled'] as $s) {
        if (isset($group['statuses'][$s])) return $s;
    }
    return (string) array_key_first($group['statuses'] ?? []) ?: '';
}

/**
 * Заказы, которым не хватает адреса.
 *
 * Оплаченный заказ с оригиналами и пустым адресом — это тупик: изготовить можно,
 * отправить некуда. Такие нужно видеть отдельно и писать людям.
 */
function og_missing_address(int $limit = 200): array {
    $rows = all("SELECT * FROM awards_orders
                  WHERE status IN ('paid','made') AND TRIM(COALESCE(address,'')) = ''
               ORDER BY id DESC LIMIT ?", [$limit]);
    return array_values(array_filter($rows, static fn(array $o): bool => og_needs_address($o)));
}
