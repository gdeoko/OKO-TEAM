<?php
/**
 * Цепочка напоминаний о заказе наградной продукции по итогам конкурса.
 *
 * Кому: заявки со статусом graded и непустым результатом, по которым НЕТ
 * оплаченного заказа наград (awards_orders по application_id со статусом
 * paid/shipped/delivered). Когда: через 3, 15, 30 и 55 дней после
 * проставления результата (applications.graded_at, пишется в admin/grading.php
 * при сохранении итога; для старых заявок без метки — от created_at).
 * Заказ наград доступен 60 дней после результата — после 60 дней не шлём.
 *
 * Идемпотентность: таблица reminder_log (app_id, kind, sent_at) + уникальный
 * индекс на пару app_id+kind, kind = award_order_<дней>. При догоняющем
 * запуске отправляется только самый поздний подходящий шаг, а не вся пачка.
 *
 * Письмо — фирменный лейаут core/result_mail.php (rm_mail_layout, синий
 * #17307A + золото #C79322), кладётся в mail_queue — реальную отправку делает
 * cron/process_newsletter_queue.php. Плюс in-app уведомление участнику
 * (core/notifications.php, notify_user).
 *
 * Строка crontab (см. scripts/crontab.txt). Час ОБЯЗАН лежать внутри рабочего
 * окна владельца (пн-сб 09:00-19:00 МСК): задание само проверяет окно и вне его
 * не делает ничего. На 08:00 оно молча выходило на первой строке, а окно заказа
 * наград всего 60 дней — пропущенное напоминание не отыгрывается. Часовой пояс
 * крона задан в самом расписании (CRON_TZ=Europe/Moscow), пересчитывать под
 * системную зону не нужно:
 *   0 11 * * 1-6 php /path/to/muzmir-site/cron/award_order_reminders.php >> data/logs/cron.log 2>&1
 *
 * Запуск вручную: php cron/award_order_reminders.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';

// РАБОЧЕЕ ОКНО ВЛАДЕЛЬЦА: наружу только пн-сб 09:00-19:00 МСК.
// Расписание крона само по себе не защищает: час можно поменять руками, и письмо
// от имени центра уйдёт человеку в нерабочее время. Проверяем окно в самом
// задании; сама проверка стоит ниже, после подключения cron/_lib.php.
require_once BASE_PATH . '/core/outreach_window.php';
// Фирменные кирпичики письма (rm_mail_layout/rm_mail_btn/rm_award_hint)
// + core/notifications.php подключается изнутри result_mail.php.
require_once BASE_PATH . '/core/result_mail.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'award_order_reminders';
/** Дни после результата, в которые шлём напоминания (по возрастанию). */
const AWARD_REMINDER_STEPS = [3, 15, 30, 55];
/** Сколько дней после результата доступен заказ наград. */
const AWARD_ORDER_WINDOW_DAYS = 60;

/* В CLI нет api/v1/_boot.php с tbl_exists() — без неё notify_user() молчит. */
if (!function_exists('tbl_exists')) {
    function tbl_exists(string $t): bool {
        try {
            return (bool) one("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [$t]);
        } catch (\Throwable $e) { return false; }
    }
}

// Библиотечный режим: при включённом MM_EMAIL_TEST_LIB подключающий скрипт
// получает только функции (award_reminder_html и пр.), сам крон не запускается.
if (defined('MM_EMAIL_TEST_LIB')) return;

// Отказ по окну пишем в общий журнал кронов, а не только в stdout: вывод
// заданий уходит в /dev/null, и молчаливо пропавшее задание не заметить.
if (!in_array('--force', $argv, true) && !outreach_window_ok()) {
    cron_log(JOB, 'вне рабочего окна (' . outreach_window_reason() . '), письма не отправляются');
    echo "вне рабочего окна, письма не отправляются\n";
    exit(0);
}

if (!cron_lock(JOB, 3600 * 6)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

/** Уже слали этот шаг по заявке? (reminder_log) */
function award_reminder_sent(int $appId, string $kind): bool {
    try {
        return (bool) one("SELECT id FROM reminder_log WHERE app_id=? AND kind=?", [$appId, $kind]);
    } catch (\Throwable $e) { return false; }
}

/** Отметить шаг отправленным (уникальный индекс страхует от гонок — тихо). */
function award_reminder_mark(int $appId, string $kind): void {
    try {
        insert('reminder_log', ['app_id' => $appId, 'kind' => $kind, 'sent_at' => date('Y-m-d H:i:s')]);
    } catch (\Throwable $e) { /* уже отмечено */ }
}

/**
 * Момент проставления результата (unix ts): graded_at (пишет PHP по зоне сайта,
 * Europe/Moscow) или, для старых заявок без метки, created_at (SQL-дефолт
 * datetime('now','localtime') — UTC, см. соглашение в cron/_lib.php).
 */
function award_graded_ts(array $a): int {
    $g = trim((string) ($a['graded_at'] ?? ''));
    if ($g !== '') {
        $ts = strtotime($g);
        if ($ts !== false) return $ts;
    }
    $c = trim((string) ($a['created_at'] ?? ''));
    $ts = $c !== '' ? strtotime($c . ' UTC') : false;
    return $ts !== false ? $ts : time();
}

/** «1 день / 2 дня / 5 дней». */
function award_ru_days(int $n): string {
    $n10 = $n % 10; $n100 = $n % 100;
    if ($n10 === 1 && $n100 !== 11) return $n . ' день';
    if ($n10 >= 2 && $n10 <= 4 && ($n100 < 12 || $n100 > 14)) return $n . ' дня';
    return $n . ' дней';
}

/** HTML письма-напоминания в фирменном лейауте (синий + золото). */
function award_reminder_html(array $a, int $daysLeft, string $awardsUrl): string {
    $navy = RM_NAVY; $navy2 = RM_NAVY_2; $gold = RM_GOLD; $muted = RM_MUTED;
    $card = RM_CARD; $line = RM_LINE;

    $name   = trim((string) $a['full_name']);
    $hello  = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $result = trim((string) $a['result']);
    $comp   = (string) $a['comp_name'];
    $deadline = date('d.m.Y', award_graded_ts($a) + AWARD_ORDER_WINDOW_DAYS * 86400);

    $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.25;font-weight:700;color:' . $navy . ';">Не забудьте заказать награды</h1>'
        . '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . '<p style="margin:0 0 20px;">Не забудьте заказать награды по результату '
        . '<b style="color:' . $navy . ';">«' . h($result) . '»</b> конкурса «' . h($comp) . '». '
        . h(rm_award_hint($result)) . '</p>'
        // Крупно результат — золотом на синем градиенте (как в письме с итогами).
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-radius:16px;overflow:hidden;">'
        . '<tr><td style="background:' . $navy . ';background:linear-gradient(135deg,' . $navy . ' 0%,' . $navy2 . ' 100%);padding:24px 26px;text-align:center;">'
        . '<div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:8px;">Ваш результат</div>'
        . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.25;font-weight:800;color:' . $gold . ';letter-spacing:.03em;">' . h($result) . '</div>'
        . '</td></tr></table>'
        // Срок действия заказа.
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        . 'style="margin:0 0 8px;background:' . $card . ';border:1px solid ' . $line . ';border-radius:14px;">'
        . '<tr><td style="padding:16px 22px;">'
        . '<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' . $muted . ';margin-bottom:6px;">Срок заказа</div>'
        . '<div style="font-size:14px;line-height:1.7;color:' . RM_INK . ';">Заказ наградной продукции доступен '
        . '<b style="color:' . $navy . ';">' . AWARD_ORDER_WINDOW_DAYS . ' дней</b> после публикации результата — '
        . 'осталось <b style="color:' . $navy . ';">' . h(award_ru_days($daysLeft)) . '</b>, до ' . h($deadline) . '.</div>'
        . '</td></tr></table>'
        . '<p style="margin:6px 0 0;font-weight:600;color:' . $navy . ';">Оригиналы наград — Почтой России:</p>'
        . '<p style="margin:6px 0 0;font-size:14px;color:' . RM_INK . ';line-height:1.6;">На плотной дизайнерской бумаге, с голографическими логотипами, живыми подписями и печатями. Доступна и благодарность педагогу за подготовку.</p>'
        . '<p style="margin:14px 0 0;font-size:13px;color:' . $muted . ';">Если наградная продукция Вам не нужна, просто оставьте это письмо без ответа.</p>';

    return mm_email_tx($inner, [
        'preheader' => 'Заказ наград по результату «' . $result . '» доступен ещё ' . award_ru_days($daysLeft) . '.',
        'hero'      => mm_cta_primary($awardsUrl, 'Заказать наградной материал', $result !== '' ? 'По результату: ' . $result : ''),
        'actions'   => [['Личный кабинет', url('/cabinet')], ['Оставить отзыв', url('/reviews')]],
    ]);
}

try {
    if (!function_exists('all') || !function_exists('scalar')) {
        cron_log(JOB, 'БД недоступна - выход');
        cron_unlock(JOB);
        exit(0);
    }

    /* ---------- Мягкие миграции ---------- */
    try { q("ALTER TABLE applications ADD COLUMN graded_at TEXT"); } catch (\Throwable $e) { /* колонка уже есть */ }
    q("CREATE TABLE IF NOT EXISTS reminder_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        sent_at TEXT DEFAULT (datetime('now','localtime'))
    )");
    q("CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_log_app_kind ON reminder_log(app_id, kind)");
    // Таблица in-app уведомлений (контракт core/notifications.php) — если её ещё нет.
    q("CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT DEFAULT '',
        url TEXT DEFAULT '',
        icon TEXT DEFAULT 'bell',
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )");

    /* ---------- Кандидаты: результат есть, оплаченного заказа наград нет ---------- */
    $rows = all(
        "SELECT a.id, a.number, a.competition_id, a.user_id, a.full_name, a.email,
                a.result, a.graded_at, a.created_at, c.name AS comp_name
           FROM applications a
           JOIN competitions c ON c.id = a.competition_id
          WHERE a.status <> 'rejected'
            AND a.result IS NOT NULL AND a.result <> ''
            -- напоминаем о заказе наград только тем, кто уже получил результат на почту
            AND COALESCE(a.result_sent_at,'') <> ''"
    );

    $queued = 0; $expired = 0;
    foreach ($rows as $a) {
        $id = (int) $a['id'];

        // Оплаченный заказ наград уже есть — напоминать не о чем.
        $paidOrders = (int) scalar(
            "SELECT COUNT(*) FROM awards_orders WHERE application_id=? AND status IN ('paid','shipped','delivered')",
            [$id]
        );
        if ($paidOrders > 0) continue;

        $days = (int) floor((time() - award_graded_ts($a)) / 86400);
        if ($days > AWARD_ORDER_WINDOW_DAYS) { $expired++; continue; } // окно заказа закрыто

        // Самый поздний подходящий шаг цепочки (3/15/30/55): одно письмо за запуск.
        $step = null;
        foreach (AWARD_REMINDER_STEPS as $s) { if ($days >= $s) $step = $s; }
        if ($step === null) continue;

        $kind = 'award_order_' . $step;
        if (award_reminder_sent($id, $kind)) continue;

        $daysLeft  = max(1, AWARD_ORDER_WINDOW_DAYS - $days);
        $awardsUrl = url('/awards') . '?comp=' . (int) $a['competition_id'] . '&app=' . $id;

        $delivered = false;

        // Письмо в очередь mail_queue.
        $email = trim((string) $a['email']);
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $html = award_reminder_html($a, $daysLeft, $awardsUrl);
            $subject = 'Не забудьте заказать награды - «' . $a['comp_name'] . '»';
            if (mail_queue($email, (string) $a['full_name'], $subject, $html) > 0) $delivered = true;
        }

        // In-app уведомление участнику.
        if ((int) $a['user_id'] > 0 && function_exists('notify_user')) {
            $nid = notify_user(
                (int) $a['user_id'],
                'Не забудьте заказать награды',
                'Результат «' . $a['result'] . '» на конкурсе «' . $a['comp_name'] . '». '
                    . 'Заказ доступен ещё ' . award_ru_days($daysLeft) . '.',
                '/awards?comp=' . (int) $a['competition_id'] . '&app=' . $id,
                'trophy'
            );
            if ($nid > 0) $delivered = true;
        }

        if ($delivered) {
            award_reminder_mark($id, $kind);
            $queued++;
            cron_log(JOB, "заявка #$id ({$a['number']}): шаг $step дн., осталось $daysLeft дн.");
        }
    }
    cron_log(JOB, "напоминания о заказе наград: отправлено $queued, окно 60 дн. истекло у $expired");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
