<?php
/**
 * ОТМЕНА АВТОПРОДЛЕНИЯ ПОДПИСКИ ЭЛИТНОГО КЛУБА — РУКАМИ УЧАСТНИКА.
 *
 * Страница клуба обещает: «отменить можно в любое время в личном кабинете».
 * Обещание было пустым: функция club_cancel_auto_renew() существовала и никем
 * не вызывалась, кнопки в кабинете не было, и человеку оставалось звонить в
 * колл-центр. ЮKassa при подключении автоплатежей спрашивает ровно это —
 * возможность отказаться без обращения в поддержку.
 *
 * Отмена НЕ отбирает оплаченное: членство работает до конца оплаченного
 * периода, снимается только следующее списание. Вернуть автопродление можно
 * тем же действием — потому и один эндпоинт на оба направления.
 *
 * POST action=off|on
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!csrf_check()) json_out(['ok' => false, 'error' => 'Сессия устарела, обновите страницу'], 403);

$u = current_user();
if (!$u) json_out(['ok' => false, 'error' => 'Требуется вход в кабинет'], 401);
$uid = (int) $u['id'];

if (!function_exists('club_status') && is_file(BASE_PATH . '/core/club.php')) {
    require_once BASE_PATH . '/core/club.php';
}
if (!function_exists('club_status')) json_out(['ok' => false, 'error' => 'Клуб недоступен'], 500);

$st = club_status($uid);
if (empty($st['active'])) json_out(['ok' => false, 'error' => 'Активного членства нет.'], 409);
if (!empty($st['staff'])) {
    json_out(['ok' => false, 'error' => 'Доступ оргкомитета бессрочный, списаний по нему нет.'], 409);
}

$action = input('action') === 'on' ? 'on' : 'off';

if ($action === 'off') {
    if (!function_exists('club_cancel_auto_renew')) json_out(['ok' => false, 'error' => 'Отмена недоступна'], 500);
    club_cancel_auto_renew($uid);
    if (function_exists('audit')) audit('club_auto_renew_off', 'club_members', $uid, []);
    $until = trim((string) ($st['expires_local'] ?? $st['expires_at'] ?? ''));
    json_out([
        'ok' => true,
        'auto_renew' => false,
        'message' => 'Вы отказались от продления. Членство действует до '
            . ($until !== '' && function_exists('ru_date') ? ru_date(substr($until, 0, 10)) : 'конца оплаченного периода')
            . ' — оплаченное не пропадает, напоминаний о продлении больше не будет. Передумаете — продлить можно на странице клуба.',
    ]);
}

/* Включение обратно: доступно, пока членство живо. Счётчик неудачных списаний
   обнуляем — иначе прошлые отказы кассы сразу съедят три попытки и
   автопродление выключится само в тот же день. */
/* Без автосписания (продление вручную, 22.10.2026) «включить обратно» значит
   снять отказ: напоминание за 3 дня снова придёт. */
$__auto = function_exists('club_autorenew_enabled') && club_autorenew_enabled();
update('club_members', ['auto_renew' => $__auto ? 1 : 0, 'cancelled_at' => '', 'charge_fails' => 0],
       'user_id=:uid', ['uid' => $uid]);
if (function_exists('audit')) audit('club_auto_renew_on', 'club_members', $uid, []);
json_out(['ok' => true, 'auto_renew' => $__auto, 'message' => $__auto ? 'Автопродление включено.'
    : 'Отказ снят: за 3 дня до окончания членства придёт письмо со ссылкой на продление.']);
