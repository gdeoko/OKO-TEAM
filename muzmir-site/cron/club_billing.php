<?php
/**
 * CRON: биллинг ВИП-клуба — автопродление подписки и снятие привилегий.
 *
 * Что делает раз в час:
 *   1) АВТОСПИСАНИЕ. По членствам, у которых наступил срок (expires_at <= сейчас)
 *      и включено автопродление, списывает следующий период по сохранённому в
 *      ЮKassa способу оплаты: ежемесячно — за месяц, годовая подписка — за год.
 *      Успех → членство продлено, участнику письмо. Неудача → счётчик попыток,
 *      письмо-напоминание; после 3 неудач автопродление больше не пытается.
 *   2) СНЯТИЕ ПРИВИЛЕГИЙ. Членства с истёкшим сроком, которые не продлеваются
 *      (отказ от автопродления или 3 неудачных списания), помечаются неактивными.
 *      С этого момента club_is_active() = false, и все привилегии (скидка 20%,
 *      сроки 3 дня) перестают действовать сами собой — отдельных правок не нужно.
 *
 * Команда центра (владелец/оргкомитет) в биллинг не попадает: у неё безлимит.
 *
 * Запуск: php cron/club_billing.php   (crontab: 0 * * * *)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/club.php';
require_once BASE_PATH . '/core/payments.php';   // yukassa_charge_saved — рекуррентное списание
require_once __DIR__ . '/_lib.php';
db();

const JOB = 'club_billing';

if (!cron_lock(JOB, 900)) { cron_log(JOB, 'предыдущий запуск ещё идёт'); exit(0); }

$renewed = 0; $failed = 0; $expired = 0;

try {
    club_boot();

    /* ---------- 1) Автосписание ---------- */
    foreach (club_due_for_charge(50) as $m) {
        $uid    = (int) $m['user_id'];
        $period = (string) ($m['period'] ?? 'month') === 'year' ? 'year' : 'month';
        $months = $period === 'year' ? 12 : 1;
        $price  = $period === 'year'
            ? (int) setting('club_price_year', '10000')
            : (int) setting('club_price', '1000');
        $pm     = trim((string) ($m['payment_method_id'] ?? ''));
        $email  = (string) ($m['email'] ?? '');

        // Способ оплаты не сохранён — списать нечем: просим продлить вручную.
        if ($pm === '' || $price <= 0) {
            club_billing_notify($email, (string) $m['full_name'], 'manual', $period, $price);
            q("UPDATE club_members SET charge_fails = COALESCE(charge_fails,0) + 1 WHERE user_id=?", [$uid]);
            $failed++;
            continue;
        }

        $pay = function_exists('yukassa_charge_saved')
            ? yukassa_charge_saved($price, $pm, 'Продление членства в ВИП-клубе «Музыкальный Мир»', [
                'club_user_id' => $uid, 'email' => $email, 'period' => $period,
              ])
            : null;

        $ok = $pay && in_array((string) ($pay['status'] ?? ''), ['succeeded', 'pending', 'waiting_for_capture'], true);
        if ($ok && (string) $pay['status'] === 'succeeded') {
            club_grant($uid, $months, 'auto_renew', ['period' => $period, 'payment_method_id' => $pm]);
            club_billing_notify($email, (string) $m['full_name'], 'renewed', $period, $price);
            cron_log(JOB, "продлено: user #$uid, $period, $price ₽");
            $renewed++;
        } else {
            $fails = (int) ($m['charge_fails'] ?? 0) + 1;
            q("UPDATE club_members SET charge_fails=?, next_charge_at=datetime('now','+1 day') WHERE user_id=?", [$fails, $uid]);
            club_billing_notify($email, (string) $m['full_name'], $fails >= 3 ? 'stopped' : 'retry', $period, $price);
            cron_log(JOB, "не удалось списать: user #$uid, попытка $fails");
            $failed++;
        }
    }

    /* ---------- 2) Снятие привилегий у истёкших ---------- */
    foreach (club_expired(100) as $m) {
        $uid = (int) $m['user_id'];
        update('club_members', ['active' => 0], 'user_id=:uid', ['uid' => $uid]);
        club_billing_notify((string) ($m['email'] ?? ''), (string) $m['full_name'], 'expired',
                            (string) ($m['period'] ?? 'month'), 0);
        cron_log(JOB, "членство истекло, привилегии сняты: user #$uid");
        $expired++;
    }

    /* ---------- 3) Дожимы: возвращаем ушедших ----------
       После окончания подписки напоминаем вернуться 4 раза — на 1, 3, 7 и 14 день.
       Каждое напоминание отправляется однократно (метка в settings), тон мягкий:
       показываем, что человек теряет, и даём кнопку вернуться. */
    $dunned = 0;
    foreach ([1 => 'd1', 3 => 'd3', 7 => 'd7', 14 => 'd14'] as $day => $tag) {
        $rows = all(
            "SELECT m.*, u.email, u.full_name
               FROM club_members m JOIN users u ON u.id = m.user_id
              WHERE m.active = 0 AND COALESCE(m.expires_at,'') <> ''
                AND date(m.expires_at) = date('now', '-' || ? || ' days')
                AND COALESCE(u.email,'') <> '' AND COALESCE(u.blocked,0) = 0
              LIMIT 100", [$day]
        );
        foreach ($rows as $m) {
            $uid = (int) $m['user_id'];
            $key = 'club_dun:' . $uid . ':' . $tag;
            if ((string) setting($key, '') !== '') continue;      // уже напоминали
            set_setting($key, date('Y-m-d H:i:s'));
            club_billing_notify((string) $m['email'], (string) $m['full_name'], 'comeback_' . $tag,
                                (string) ($m['period'] ?? 'month'), 0);
            $dunned++;
        }
    }

    cron_log(JOB, "продлено $renewed, неудач $failed, истекло $expired, напоминаний $dunned");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}

/**
 * Письмо участнику о состоянии подписки.
 * $kind: renewed | retry | stopped | expired | manual
 */
function club_billing_notify(string $email, string $name, string $kind, string $period, int $price): void {
    $email = trim($email);
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return;
    $base = rtrim((string) cfgv('base_url', ''), '/');
    $per  = $period === 'year' ? 'год' : 'месяц';

    [$subject, $text, $cta] = match ($kind) {
        'renewed' => ['Членство в ВИП-клубе продлено',
                      'Подписка на ' . $per . ' продлена автоматически, списано ' . $price . ' ₽. Все привилегии клуба продолжают действовать.',
                      'Личный кабинет'],
        'retry'   => ['Не удалось продлить членство в ВИП-клубе',
                      'Списание за ' . $per . ' не прошло. Мы повторим попытку завтра. Чтобы не терять привилегии, можно продлить членство вручную.',
                      'Продлить членство'],
        'stopped' => ['Автопродление ВИП-клуба остановлено',
                      'Списание не прошло три раза подряд, автопродление отключено. Привилегии сохраняются до конца оплаченного срока.',
                      'Продлить членство'],
        'expired' => ['Срок членства в ВИП-клубе истёк',
                      'Оплаченный период закончился, привилегии клуба больше не действуют. Вступить снова можно в любой момент — прогресс сохранён.',
                      'Вступить снова'],
        // Дожимы после ухода: 1, 3, 7 и 14 день. Показываем, что человек теряет.
        'comeback_d1'  => ['Вы больше не в ВИП-клубе — вернуть привилегии?',
                      'Со вчерашнего дня скидка ' . mm_vip_discount() . '% на участие и награды не действует, а результаты приходят за 5 рабочих дней вместо 3. Членство можно возобновить в один клик.',
                      'Вернуть привилегии'],
        'comeback_d3'  => ['Скидка ' . mm_vip_discount() . '% ждёт вашего возвращения',
                      'Участники клуба платят за конкурсы и награды на ' . mm_vip_discount() . '% меньше, получают бесплатный конкурс каждый месяц и результаты за 3 рабочих дня.',
                      'Вступить снова'],
        'comeback_d7'  => ['Неделя без привилегий клуба',
                      'Пока подписка не активна, каждая заявка и каждая награда обходятся дороже. Возвращение занимает минуту — все прежние достижения на месте.',
                      'Возобновить членство'],
        'comeback_d14' => ['Последнее напоминание о ВИП-клубе',
                      'Больше писать об этом не будем. Если решите вернуться — клуб открыт: скидка ' . mm_vip_discount() . '%, ускоренные сроки, закрытые конкурсы и поддержка в приоритете.',
                      'Открыть ВИП-клуб'],
        default   => ['Продлите членство в ВИП-клубе',
                      'Срок членства подошёл к концу, а сохранённого способа оплаты нет — продлите подписку вручную.',
                      'Продлить членство'],
    };

    $inner = '<p style="margin:0 0 12px;">Здравствуйте' . ($name !== '' ? ', ' . h($name) : '') . '!</p>'
           . '<p style="margin:0 0 16px;line-height:1.65;">' . h($text) . '</p>';
    $html  = function_exists('mm_email_tx')
        ? mm_email_tx($inner, [
            'preheader' => $subject,
            'hero'      => function_exists('mm_cta_primary') ? mm_cta_primary($base . '/club', $cta, '') : '',
            // В письмах про сам клуб карточка клуба не нужна — она и есть тема письма.
            'vip'       => false,
          ])
        : $inner;

    if (function_exists('mail_queue')) mail_queue($email, $name, $subject, $html);
}
