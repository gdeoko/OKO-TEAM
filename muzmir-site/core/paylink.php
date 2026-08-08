<?php
/**
 * ПРЯМЫЕ ССЫЛКИ НА ОПЛАТУ.
 *
 * Задача: кнопка «Оплатить» в письме и в уведомлении сайта должна вести НЕ в общий
 * личный кабинет, а сразу на оплату КОНКРЕТНОЙ заявки или заказа — то есть на форму
 * ЮKassa. Раньше все дожимы вели на /cabinet, и человек искал нужный счёт руками.
 *
 * Ссылка вида /pay?t=app&id=123&s=<подпись>. Подпись — HMAC-SHA256 от типа и номера
 * на секрете сайта, поэтому:
 *   • ссылка работает прямо из письма, без входа в кабинет;
 *   • чужую ссылку не подобрать и не подделать подстановкой другого номера;
 *   • ничего лишнего в ссылке нет — ни почты, ни персональных данных.
 *
 * Оплаченные и удалённые счета ссылка не открывает — страница /pay объясняет почему.
 */
declare(strict_types=1);

/** Секрет для подписи ссылок. Создаётся один раз и хранится в настройках. */
function pay_secret(): string {
    $s = (string) setting('paylink_secret', '');
    if ($s === '') {
        $s = bin2hex(random_bytes(32));
        set_setting('paylink_secret', $s);
    }
    return $s;
}

/** Подпись для пары «тип + номер». */
function pay_sign(string $type, int $id): string {
    return substr(hash_hmac('sha256', $type . ':' . $id, pay_secret()), 0, 32);
}

/** Проверка подписи (сравнение без утечки по времени). */
function pay_sign_ok(string $type, int $id, string $sig): bool {
    if ($sig === '' || $id <= 0) return false;
    return hash_equals(pay_sign($type, $id), $sig);
}

/** Абсолютная ссылка на оплату заявки на участие. */
function pay_link_app(int $appId): string {
    return rtrim((string) cfgv('base_url', ''), '/')
         . '/pay?t=app&id=' . $appId . '&s=' . pay_sign('app', $appId);
}

/** Абсолютная ссылка на оплату заказа наградного материала. */
function pay_link_order(int $orderId): string {
    return rtrim((string) cfgv('base_url', ''), '/')
         . '/pay?t=order&id=' . $orderId . '&s=' . pay_sign('order', $orderId);
}

/** Относительная ссылка на оплату заявки — для уведомлений внутри сайта. */
function pay_path_app(int $appId): string {
    return '/pay?t=app&id=' . $appId . '&s=' . pay_sign('app', $appId);
}

/** Относительная ссылка на оплату заказа — для уведомлений внутри сайта. */
function pay_path_order(int $orderId): string {
    return '/pay?t=order&id=' . $orderId . '&s=' . pay_sign('order', $orderId);
}
