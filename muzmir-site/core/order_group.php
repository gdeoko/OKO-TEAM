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
    $words = array_values(array_unique(array_filter(
        preg_split('~\s+~u', trim($s)) ?: [],
        static fn(string $w): bool => $w !== '' && (mb_strlen($w) > 1 || ctype_digit($w))
    )));
    sort($words, SORT_STRING);
    return implode(' ', $words);
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
    $g = [];
    foreach ($orders as $o) {
        $k = og_key($o);
        if (!isset($g[$k])) {
            $g[$k] = ['key' => $k, 'orders' => [], 'kind' => og_kind($o),
                      'address' => (string) ($o['address'] ?? ''), 'email' => (string) ($o['email'] ?? ''),
                      'full_name' => (string) ($o['full_name'] ?? ''), 'amount' => 0,
                      'items' => [], 'statuses' => [], 'ids' => []];
        }
        $g[$k]['orders'][] = $o;
        $g[$k]['ids'][]    = (int) ($o['id'] ?? 0);
        $g[$k]['amount']  += (int) ($o['amount'] ?? 0);
        $g[$k]['statuses'][(string) ($o['status'] ?? '')] = true;
        // Вид группы — самый «тяжёлый» из встреченных: если хоть что-то едет
        // почтой, вся группа требует адреса и отправки.
        $kk = og_kind($o);
        if ($kk === 'mixed' || ($kk === 'original' && $g[$k]['kind'] === 'digital')
            || ($kk === 'digital' && $g[$k]['kind'] === 'original')) {
            $g[$k]['kind'] = ($kk === $g[$k]['kind']) ? $kk : 'mixed';
        }
        if (($o['address'] ?? '') !== '' && $g[$k]['address'] === '') $g[$k]['address'] = (string) $o['address'];
        foreach ((array) json_decode((string) ($o['items'] ?? '[]'), true) as $it) {
            if (!is_array($it)) continue;
            $g[$k]['items'][] = $it + ['order_id' => (int) ($o['id'] ?? 0),
                                       'application_id' => (int) ($o['application_id'] ?? 0)];
        }
    }
    return $g;
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
