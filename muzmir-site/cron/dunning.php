<?php
/**
 * Точечный дожим оплаты (запуск: раз в минуту).
 *
 * Для НЕоплаченных платных заявок и НЕоплаченных заказов наград:
 *   +3 мин  → напоминание об оплате;
 *   +1 час  → напоминание;
 *   +24 часа → ФИНАЛЬНОЕ напоминание (предупреждаем: не оплатите в течение 24 ч — удалим);
 *   +48 часов (24 ч после последнего) → АВТОУДАЛЕНИЕ + письмо/уведомление «подайте заново».
 *
 * Идемпотентность — reminder_log(app_id, kind) с уникальным (app_id,kind).
 * Для заказов kind начинается с dun_ord_, app_id = id заказа (namespacing по kind).
 * Письма кладутся в mail_queue (priority 0 — транзакционные, уходят сразу).
 *
 * Запуск: php cron/dunning.php   (crontab: * * * * *)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
if (is_file(BASE_PATH . '/core/notifications.php')) require_once BASE_PATH . '/core/notifications.php';
require_once BASE_PATH . '/core/paylink.php';   // прямые ссылки на оплату конкретного счёта
// Нужен для сверки с кассой перед удалением неоплаченной заявки: «не оплачено» —
// это наш статус, а деньги могли прийти минуту назад.
require_once BASE_PATH . '/core/payments.php';
require_once BASE_PATH . '/core/outreach_window.php';
require_once __DIR__ . '/_lib.php';

/**
 * ДОЖИМ НЕ БУДИТ ЧЕЛОВЕКА НОЧЬЮ.
 *
 * Крон работает раз в минуту, и напоминания «оплатите» уходили в любое время
 * суток, включая ночь и воскресенье, — а это письмо от имени центра, и правило
 * рабочего окна на него распространяется. Исключение одно: самое первое
 * напоминание через три минуты после подачи. Человек в этот момент на сайте,
 * он только что оставил заявку и ждёт счёт; для него это продолжение действия,
 * а не рассылка. Остальные этапы ждут ближайшего рабочего часа: reminder_log
 * помнит, что письмо не отправлено, и следующий прогон в окне его отправит.
 */
function dun_may_send(string $stage): bool {
    if ($stage === '3min') return true;
    return outreach_window_ok();
}

const JOB = 'dunning';

if (!cron_lock(JOB, 300)) { exit(0); }

/** Мягкое создание reminder_log. */
function dun_log_ensure(): void {
    try {
        q("CREATE TABLE IF NOT EXISTS reminder_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            app_id INTEGER NOT NULL,
            kind TEXT NOT NULL,
            sent_at TEXT DEFAULT (datetime('now','localtime')),
            UNIQUE(app_id, kind)
        )");
    } catch (\Throwable $e) { /* тихо */ }
}
function dun_sent(int $id, string $kind): bool {
    return (bool) one("SELECT id FROM reminder_log WHERE app_id=? AND kind=?", [$id, $kind]);
}
function dun_mark(int $id, string $kind): void {
    try { insert('reminder_log', ['app_id' => $id, 'kind' => $kind, 'sent_at' => date('Y-m-d H:i:s')]); }
    catch (\Throwable $e) { /* дубль — ок */ }
}

/** Прошло ли не меньше $seconds с момента $createdAt (UTC-строка SQLite). */
function dun_age_ok(string $createdAt, int $seconds): bool {
    $t = strtotime($createdAt . ' UTC');
    if ($t === false) $t = strtotime($createdAt);
    if ($t === false) return false;
    return (time() - $t) >= $seconds;
}

$STAGES = [
    ['3min', 180,   'Напоминание об оплате'],
    ['1h',   3600,  'Напоминание об оплате'],
    ['24h',  86400, 'Последнее напоминание об оплате'],
];
$DELETE_AFTER = 172800; // 48 ч от создания = 24 ч после напоминания «24h»

try {
    dun_log_ensure();
    $baseCab = rtrim((string) cfgv('base_url'), '/');
    $remApp = 0; $remOrd = 0; $delApp = 0; $delOrd = 0;

    /* ─────────── ЗАЯВКИ (платный конкурс, не оплачена) ─────────── */
    $apps = all(
        "SELECT a.*, c.name AS comp_name, c.price AS comp_price
           FROM applications a JOIN competitions c ON c.id=a.competition_id
          WHERE c.is_paid=1 AND a.is_paid=0
            AND a.status NOT IN ('rejected','paid','judging','graded','sent','done')
            AND a.email <> ''
            AND a.created_at >= datetime('now','localtime','-4 days')"
    );
    foreach ($apps as $a) {
        $id = (int) $a['id'];
        $created = (string) $a['created_at'];
        $name = trim((string) $a['full_name']);
        $num  = (string) ($a['number'] ?? '');
        $uid  = (int) ($a['user_id'] ?? 0);

        // Автоудаление (после последнего напоминания).
        if (dun_sent($id, 'dun_app_24h') && dun_age_ok($created, $DELETE_AFTER)) {
            if (!dun_sent($id, 'dun_app_deleted')) {
                dun_app_deleted_notify($a, $baseCab);
                dun_mark($id, 'dun_app_deleted');
            }
            /* ПЕРЕД УДАЛЕНИЕМ СПРАШИВАЕМ КАССУ, А НЕ СВОЮ БАЗУ.
             *
             * Здесь удалялась заявка «без оплаты» и её незакрытый счёт. Но
             * «без оплаты» — это НАШ статус: человек мог заплатить час назад,
             * а уведомление кассы до нас не дошло. Тогда дожим сносил и заявку,
             * и строку платежа — и деньги пропадали из учёта совсем: сверка
             * ищет платёж по своей строке, а строки больше нет.
             *
             * Так 16.08 пропали 500 ₽ участницы: оплата прошла, заявка была
             * удалена, конкурс закрылся, и человек остался без участия и без
             * денег. Поэтому сначала сверяемся с кассой: деньги пришли —
             * проводим оплату и заявку НЕ трогаем. */
            $close = function_exists('payments_close_open')
                ? payments_close_open('application', $id)
                : ['paid' => 0, 'kept' => 0];
            if ((int) ($close['paid'] ?? 0) > 0 || (int) ($close['kept'] ?? 0) > 0) {
                cron_log(JOB, "заявка #$id ($num) не удалена: в кассе есть деньги или касса не ответила");
                continue;
            }
            q("DELETE FROM applications WHERE id=? AND is_paid=0", [$id]);
            /* Строку платежа НЕ удаляем: это финансовый след. Она нужна, чтобы
             * потом сойтись с кассой и увидеть, что деньги приходили. */
            if (tbl_exists('payments')) {
                q("UPDATE payments SET status='canceled'
                    WHERE application_id=? AND status IN ('pending','')", [$id]);
            }
            audit('dunning_delete', 'application', $id, ['number' => $num]);
            $delApp++;
            continue;
        }

        foreach ($STAGES as [$stage, $secs, $subjPrefix]) {
            $kind = 'dun_app_' . $stage;
            if (dun_sent($id, $kind) || !dun_age_ok($created, $secs)) continue;
            if (!dun_may_send($stage)) continue;
            $isFinal = $stage === '24h';
            $html = dun_app_mail_html($a, $baseCab, $isFinal);
            if ($html !== '' && mail_queue((string) $a['email'], $name, 'Оплатите участие — «' . $a['comp_name'] . '»', $html)) {
                dun_mark($id, $kind);
                if ($uid > 0 && function_exists('notify_user')) {
                    notify_user($uid, 'Заявка ' . $num . ($isFinal ? ' будет удалена' : ' ждёт оплаты'),
                        $isFinal ? 'Оплатите в течение 24 часов, иначе заявка автоматически удалится.' : 'Оплатите оргвзнос, чтобы работа попала на оценку жюри.',
                        pay_path_app($id), 'pay');   // кнопка ведёт сразу на оплату этой заявки
                }
                $remApp++;
            }
            break; // не больше одного этапа за проход
        }
    }

    /* ─────────── ЗАКАЗЫ НАГРАД (не оплачены, status='new') ─────────── */
    $ords = all(
        "SELECT * FROM awards_orders
          WHERE status='new' AND email <> '' AND created_at >= datetime('now','localtime','-4 days')"
    );
    foreach ($ords as $o) {
        $id = (int) $o['id'];
        $created = (string) $o['created_at'];
        $name = trim((string) ($o['full_name'] ?? ''));
        $uid  = (int) ($o['user_id'] ?? 0);

        if (dun_sent($id, 'dun_ord_24h') && dun_age_ok($created, $DELETE_AFTER)) {
            if (!dun_sent($id, 'dun_ord_deleted')) {
                dun_ord_deleted_notify($o, $baseCab);
                dun_mark($id, 'dun_ord_deleted');
            }
            q("DELETE FROM awards_orders WHERE id=? AND status='new'", [$id]);
            // Строку платежа не удаляем — это финансовый след (см. выше).
            if (tbl_exists('payments')) {
                q("UPDATE payments SET status='canceled'
                    WHERE order_id=? AND status IN ('pending','')", [$id]);
            }
            audit('dunning_delete', 'awards_order', $id, []);
            $delOrd++;
            continue;
        }

        foreach ($STAGES as [$stage, $secs, $subjPrefix]) {
            $kind = 'dun_ord_' . $stage;
            if (dun_sent($id, $kind) || !dun_age_ok($created, $secs)) continue;
            if (!dun_may_send($stage)) continue;
            $isFinal = $stage === '24h';
            $html = dun_ord_mail_html($o, $baseCab, $isFinal);
            if ($html !== '' && mail_queue((string) $o['email'], $name, 'Оплатите заказ наград №' . $id, $html)) {
                dun_mark($id, $kind);
                if ($uid > 0 && function_exists('notify_user')) {
                    notify_user($uid, 'Заказ №' . $id . ($isFinal ? ' будет удалён' : ' ждёт оплаты'),
                        $isFinal ? 'Оплатите в течение 24 часов, иначе заказ автоматически удалится.' : 'Оплатите заказ, чтобы мы передали его в изготовление.',
                        pay_path_order($id), 'pay');   // кнопка ведёт сразу на оплату этого заказа
                }
                $remOrd++;
            }
            break;
        }
    }

    cron_log(JOB, "дожим: заявки+$remApp/удалено-$delApp, заказы+$remOrd/удалено-$delOrd");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}

/* ─────────── Шаблоны писем ─────────── */

function dun_app_mail_html(array $a, string $baseCab, bool $isFinal): string {
    if (!function_exists('mm_email_tx')) return '';
    $name = trim((string) $a['full_name']);
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $num = (string) ($a['number'] ?? '');
    $warn = $isFinal
        ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#FFF6F4;border:1px solid #F0C9C0;border-radius:14px;"><tr><td style="width:4px;background:#C0392B;border-radius:14px 0 0 14px;"></td><td style="padding:13px 20px;font-size:13.5px;line-height:1.6;color:#7A2E22;"><b style="color:#C0392B;">ВНИМАНИЕ.</b> Если оплата не поступит в течение <b>24 часов</b>, заявка будет автоматически удалена, и её нужно будет подать заново.</td></tr></table>'
        : '';
    $inner = '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:#17307A;font-weight:700;">Заявка ждёт оплаты</h1>'
        . '<p style="margin:0 0 12px;">' . $hello . '</p>'
        . $warn
        . '<p style="margin:0 0 16px;">Ваша заявка <b>№' . h($num) . '</b> на конкурс «' . h((string) $a['comp_name']) . '» пока не оплачена. '
        . 'Оплатите оргвзнос, чтобы работа попала на оценку жюри.</p>';
    return mm_email_tx($inner, [
        'preheader' => 'Оплата участия пока не поступила',
        // Кнопка ведёт прямо на оплату ЭТОЙ заявки (форма ЮKassa), а не в общий кабинет.
        'hero'      => mm_cta_primary(pay_link_app((int) $a['id']), 'Оплатить участие', 'Заявка №' . $num),
        'actions'   => [['Личный кабинет', $baseCab . '/cabinet']],
    ]);
}

function dun_app_deleted_notify(array $a, string $baseCab): void {
    if (!function_exists('mm_email_tx') || !function_exists('mail_queue')) return;
    $name = trim((string) $a['full_name']);
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $num = (string) ($a['number'] ?? '');
    $inner = '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:23px;color:#17307A;font-weight:700;">Заявка удалена</h1>'
        . '<p style="margin:0 0 12px;">' . $hello . '</p>'
        . '<p style="margin:0 0 16px;">Заявка <b>№' . h($num) . '</b> на конкурс «' . h((string) $a['comp_name']) . '» была удалена, так как оплата не поступила в течение суток после последнего напоминания. '
        . 'Вы можете подать заявку заново в любой момент.</p>';
    $html = mm_email_tx($inner, [
        'preheader' => 'Неоплаченная заявка удалена',
        'hero'      => mm_cta_primary($baseCab . '/apply', 'Подать заявку заново', 'Конкурс «' . (string) $a['comp_name'] . '»'),
        'actions'   => [['Все конкурсы', $baseCab . '/calendar']],
    ]);
    mail_queue((string) $a['email'], $name, 'Заявка удалена — оплата не поступила', $html);
    $uid = (int) ($a['user_id'] ?? 0);
    if ($uid > 0 && function_exists('notify_user')) {
        notify_user($uid, 'Заявка ' . $num . ' удалена', 'Оплата не поступила вовремя. Вы можете подать заявку заново.', '/apply', 'pay');
    }
}

function dun_ord_mail_html(array $o, string $baseCab, bool $isFinal): string {
    if (!function_exists('mm_email_tx')) return '';
    $name = trim((string) ($o['full_name'] ?? ''));
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $warn = $isFinal
        ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#FFF6F4;border:1px solid #F0C9C0;border-radius:14px;"><tr><td style="width:4px;background:#C0392B;border-radius:14px 0 0 14px;"></td><td style="padding:13px 20px;font-size:13.5px;line-height:1.6;color:#7A2E22;"><b style="color:#C0392B;">ВНИМАНИЕ.</b> Если оплата не поступит в течение <b>24 часов</b>, заказ будет автоматически удалён.</td></tr></table>'
        : '';
    $inner = '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:#17307A;font-weight:700;">Заказ ждёт оплаты</h1>'
        . '<p style="margin:0 0 12px;">' . $hello . '</p>'
        . $warn
        . '<p style="margin:0 0 16px;">Ваш заказ наградного материала <b>№' . (int) $o['id'] . '</b> пока не оплачен. '
        . 'Оплатите заказ, чтобы мы передали его в изготовление.</p>';
    return mm_email_tx($inner, [
        'preheader' => 'Оплата заказа пока не поступила',
        // Кнопка ведёт прямо на оплату ЭТОГО заказа (форма ЮKassa), а не в общий кабинет.
        'hero'      => mm_cta_primary(pay_link_order((int) $o['id']), 'Оплатить заказ', 'Заказ №' . (int) $o['id']),
        'actions'   => [['Личный кабинет', $baseCab . '/cabinet']],
    ]);
}

function dun_ord_deleted_notify(array $o, string $baseCab): void {
    if (!function_exists('mm_email_tx') || !function_exists('mail_queue')) return;
    $name = trim((string) ($o['full_name'] ?? ''));
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $inner = '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:23px;color:#17307A;font-weight:700;">Заказ удалён</h1>'
        . '<p style="margin:0 0 12px;">' . $hello . '</p>'
        . '<p style="margin:0 0 16px;">Заказ наградного материала <b>№' . (int) $o['id'] . '</b> был удалён, так как оплата не поступила вовремя. '
        . 'Вы можете оформить заказ заново в личном кабинете.</p>';
    $html = mm_email_tx($inner, [
        'preheader' => 'Неоплаченный заказ удалён',
        'hero'      => mm_cta_primary($baseCab . '/cabinet', 'В личный кабинет', ''),
    ]);
    mail_queue((string) $o['email'], $name, 'Заказ удалён — оплата не поступила', $html);
    $uid = (int) ($o['user_id'] ?? 0);
    if ($uid > 0 && function_exists('notify_user')) {
        notify_user($uid, 'Заказ №' . (int) $o['id'] . ' удалён', 'Оплата не поступила вовремя. Можно оформить заказ заново.', '/cabinet', 'pay');
    }
}
