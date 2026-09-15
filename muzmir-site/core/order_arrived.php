<?php
/**
 * «ПОСЫЛКА ПРИШЛА» — ПИСЬМО УЧАСТНИКУ И ОТМЕТКА В ЗАКАЗЕ.
 *
 * Задача владельца от 15.09.2026: как только посылка доехала до отделения,
 * участник должен получить письмо — где забрать, по какому адресу, и чтобы
 * карта открывалась сразу на нужном отделении.
 *
 * АДРЕС ОТДЕЛЕНИЯ, А НЕ АДРЕС ДОСТАВКИ. В заявке человек указывает, куда везти
 * (улица, дом, квартира). Забирает он в отделении по индексу, и это другой
 * адрес. Поэтому берём индекс — из события Почты, если оно есть, иначе из
 * заказа, — и ведём человека на страницу самого отделения и на карту.
 *
 * Своей базы отделений у нас нет и заводить её незачем: Почта держит страницу
 * каждого отделения по индексу (там адрес, режим работы, телефон), а карта
 * открывается поиском по этому же индексу. Оба адреса — постоянные ссылки,
 * никаких ключей и никакого разбора чужой вёрстки.
 *
 * Идемпотентно: повторный вызов письма не шлёт (отметка arrived_mailed_at).
 */
declare(strict_types=1);

/** Страница отделения на сайте Почты: адрес, режим работы, телефон. */
function order_office_url(string $index): string {
    $index = preg_replace('~\D~', '', $index) ?? '';
    return strlen($index) === 6 ? 'https://www.pochta.ru/post-index/' . $index : '';
}

/** Карта, открытая на этом отделении. */
function order_office_map_url(string $index, string $place = ''): string {
    $index = preg_replace('~\D~', '', $index) ?? '';
    if (strlen($index) !== 6) return '';
    $q = 'Почта России ' . $index . ($place !== '' ? ' ' . $place : '');
    return 'https://yandex.ru/maps/?text=' . rawurlencode($q);
}

/**
 * Населённый пункт из адреса доставки — только чтобы человек сориентировался,
 * какой это город. Улицу и дом НЕ берём: это его адрес, а не отделения.
 */
function order_place_hint(string $address): string {
    $a = trim($address);
    if ($a === '') return '';
    $parts = array_map('trim', explode(',', $a));
    $out = [];
    foreach ($parts as $p) {
        if ($p === '' || preg_match('~^\d{6}$~', $p)) continue;          // индекс отдельно
        if (preg_match('~^(д|дом|кв|квартира|к|корп|стр|литер|пом)\b~ui', $p)) break;
        if (preg_match('~^(ул|улица|пр-кт|проспект|пер|переулок|б-р|ш|шоссе|мкр|наб)\b~ui', $p)) break;
        $out[] = $p;
        if (count($out) >= 3) break;
    }
    return implode(', ', $out);
}

/**
 * Отправить участнику письмо «посылка пришла».
 *
 * @param int    $orderId заказ
 * @param string $index   индекс отделения (пусто — возьмём из заказа)
 * @param string $keep    до какого числа хранится (пусто — не пишем)
 * @return bool отправлено ли письмо сейчас
 */
function order_notify_arrived(int $orderId, string $index = '', string $keep = ''): bool {
    $o = one("SELECT * FROM awards_orders WHERE id=?", [$orderId]);
    if (!$o) return false;

    // Уже писали по этому заказу — второй раз не тревожим.
    try { db()->exec("ALTER TABLE awards_orders ADD COLUMN arrived_mailed_at TEXT DEFAULT ''"); } catch (\Throwable $e) {}
    if (trim((string) ($o['arrived_mailed_at'] ?? '')) !== '') return false;

    $email = trim((string) ($o['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return false;

    if ($index === '') $index = (string) ($o['postal_index'] ?? '');
    // Индекс мог остаться только в адресе — вытащим первые шесть цифр подряд.
    if (preg_replace('~\D~', '', $index) === '' && preg_match('~\b(\d{6})\b~', (string) $o['address'], $m)) {
        $index = $m[1];
    }
    $index = preg_replace('~\D~', '', $index) ?? '';

    $name  = trim((string) ($o['full_name'] ?? ''));
    $place = order_place_hint((string) ($o['address'] ?? ''));
    $items = json_decode((string) ($o['items'] ?? '[]'), true);
    $items = is_array($items) ? $items : [];
    $base  = rtrim((string) cfgv('base_url', ''), '/');

    $vars = [
        'order'      => $o,
        'items'      => $items,
        'name'       => $name,
        'index'      => $index,
        'place'      => $place,
        'track'      => trim((string) ($o['tracking'] ?? '')),
        'office_url' => order_office_url($index),
        'map_url'    => order_office_map_url($index, $place),
        'keep_until' => $keep,
        '_tx'        => [
            'preheader' => 'Наградной материал доставлен в отделение Почты России и ждёт получения.',
            'actions'   => [['Личный кабинет', $base . '/cabinet']],
            'thanks'    => true,
        ],
    ];

    $html = function_exists('mail_template')
        ? mail_template('award_order_arrived', $vars)
        : '<p>Здравствуйте! Ваша посылка пришла в отделение ' . h($index) . '.</p>';

    $subject = 'Посылка пришла в отделение — Культурный центр «Музыкальный Мир»';

    /* Письмо личное, по конкретному заказу: priority 0. В этой системе
     * priority — это признак МАССОВОСТИ, а не важности (см. CLAUDE.md). */
    $ok = function_exists('mail_send_failover')
        ? mail_send_failover($email, $subject, $html, ['priority' => 0, 'campaign_type' => 'order', 'pool' => 'tx'])
        : (function_exists('mail_queue') ? (bool) mail_queue($email, $name, $subject, $html) : false);

    if ($ok) {
        update('awards_orders', ['arrived_mailed_at' => date('Y-m-d H:i:s')], 'id=:i', ['i' => $orderId]);
        if (function_exists('audit')) audit('order_arrived_mail', 'awards_orders', $orderId, ['index' => $index]);
    }
    return $ok;
}
