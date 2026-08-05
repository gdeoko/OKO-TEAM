<?php
/**
 * Напоминания участникам. Запуск: раз в день.
 *
 * 1) Не оплатил заявку - платный конкурс, заявка не оплачена, старше 2 суток,
 *    не отклонена. Разово (проверка audit_log по действию reminder_payment).
 * 2) Не заказал наградную продукцию через 3 дня после подведения итогов -
 *    у заявки есть результат, но нет строки в awards_orders. Разово, шаблон
 *    templates/emails/reminder_award.php.
 * 3) Дедлайн приёма заявок через 5/3/1 день - активным подписчикам рассылки,
 *    по конкурсу и числу дней (разово на пару конкурс+число дней), шаблон
 *    templates/emails/reminder_deadline.php.
 *
 * Письма кладутся в mail_queue - реальную отправку делает
 * cron/process_newsletter_queue.php (раз в минуту, с учётом суточного лимита).
 *
 * Запуск: php cron/send_reminders.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
if (is_file(BASE_PATH . '/core/notifications.php')) require_once BASE_PATH . '/core/notifications.php';
require_once __DIR__ . '/_lib.php';
// Опционально: движок рассылок даёт настоящий unsub_token через nl_ensure_subscriber().
if (is_file(BASE_PATH . '/core/newsletter.php')) require_once BASE_PATH . '/core/newsletter.php';

const JOB = 'send_reminders';

if (!cron_lock(JOB, 3600 * 6)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

/** Единый способ поставить письмо в очередь (мягко, если mail_queue/mail_template доступны). */
function reminder_enqueue(string $email, string $name, string $subject, string $html): bool {
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    if (!function_exists('mail_queue')) return false;
    return mail_queue($email, $name, $subject, $html) > 0;
}

/** Настоящая ссылка отписки (/api/v1/unsubscribe.php?token=...), тот же механизм, что у рассылок. */
function reminder_unsub_url_token(string $token): string {
    return rtrim((string) cfgv('base_url'), '/') . '/api/v1/unsubscribe.php?token=' . urlencode($token);
}

/** То же самое, но по e-mail: заводит/находит подписчика ради токена (мягко). */
function reminder_unsub_url_email(string $email): string {
    if ($email !== '' && function_exists('nl_ensure_subscriber')) {
        try {
            [$token, ] = nl_ensure_subscriber($email, '', 'reminder');
            if ($token !== '') return reminder_unsub_url_token($token);
        } catch (\Throwable $e) { /* не критично, отдаём страницу отписки без токена */ }
    }
    return rtrim((string) cfgv('base_url'), '/') . '/api/v1/unsubscribe.php';
}

try {
    if (!function_exists('all') || !function_exists('one')) {
        cron_log(JOB, 'БД недоступна - выход');
        cron_unlock(JOB);
        exit(0);
    }

    $orgHours = (string) cfgv('org_hours', '');

    /* ---------- 1) Напоминание об оплате заявки ---------- */
    $unpaid = 0;
    // Дожим ТОЛЬКО по действительно неоплаченным заявкам на раннем этапе.
    // Любой статус после оплаты (paid/judging/graded/sent/done) и отклонённые
    // исключены — чтобы оплатившие участники НИКОГДА не получали «оплатите».
    $rows = all(
        "SELECT a.id, a.number, a.full_name, a.email, a.user_id, c.name AS comp_name
           FROM applications a
           JOIN competitions c ON c.id = a.competition_id
          WHERE c.is_paid = 1 AND a.is_paid = 0
            AND a.status NOT IN ('rejected','paid','judging','graded','sent','done')
            AND a.email <> ''
            AND a.created_at <= datetime('now', '-2 days')"
    );
    foreach ($rows as $a) {
        $id = (int) $a['id'];
        if (already_notified('reminder_payment', 'application', $id)) continue;

        $name = trim((string) $a['full_name']);
        $html = function_exists('mail_template') ? mail_template('reminder_payment', [
            'name'             => $name,
            'competition'      => (string) $a['comp_name'],
            'number'           => (string) ($a['number'] ?? ''),
            'cabinet_url'      => url('/cabinet'),
            'preheader'        => 'Оплата участия пока не поступила',
            '_tx'              => [
                'hero'    => mm_cta_primary(url('/cabinet'), 'Оплатить участие', ($a['number'] ?? '') !== '' ? 'Заявка №' . (string) $a['number'] . ' ждёт оплаты' : 'Заявка ждёт оплаты'),
                'actions' => [['Личный кабинет', url('/cabinet')]],
            ],
        ]) : '';

        if ($html !== '' && reminder_enqueue((string) $a['email'], $name, 'Оплатите участие - «' . $a['comp_name'] . '»', $html)) {
            audit('reminder_payment', 'application', $id, ['competition' => $a['comp_name']]);
            // In-app уведомление участнику
            if (!empty($a['user_id']) && function_exists('notify_user')) {
                notify_user((int)$a['user_id'], 'Заявка ' . $a['number'] . ' ждёт оплаты',
                    'Чтобы работа попала на оценку жюри — оплатите оргвзнос.', '/cabinet#apps', 'pay');
            }
            $unpaid++;
        }
    }
    cron_log(JOB, "напоминания об оплате: поставлено в очередь $unpaid");

    /* ---------- 2) Напоминание о наградной продукции (через 3 дня после итогов) ---------- */
    $awards = 0;
    $rows = all(
        "SELECT a.id, a.full_name, a.email, a.result, c.name AS comp_name
           FROM applications a
           JOIN competitions c ON c.id = a.competition_id
          WHERE a.result <> ''
            AND a.status IN ('graded', 'sent')
            AND a.email <> ''
            AND c.results_date IS NOT NULL
            AND date(c.results_date) <= date('now', '-3 days')"
    );
    foreach ($rows as $a) {
        $id = (int) $a['id'];
        if (already_notified('reminder_award', 'application', $id)) continue;

        $ordered = (int) scalar("SELECT COUNT(*) FROM awards_orders WHERE application_id=?", [$id]);
        if ($ordered > 0) {
            // Уже заказали - фиксируем, чтобы больше не проверять эту заявку.
            audit('reminder_award', 'application', $id, ['skipped' => 'already_ordered']);
            continue;
        }

        $awardOrderUrl = url('/awards') . '?app=' . $id;
        $html = function_exists('mail_template') ? mail_template('reminder_award', [
            'name'            => trim((string) $a['full_name']),
            'competition'     => (string) $a['comp_name'],
            'result'          => (string) $a['result'],
            'order_url'       => $awardOrderUrl,
            'preheader'       => 'Оформите памятную награду',
            '_tx'             => [
                'hero'    => mm_cta_primary($awardOrderUrl, 'Заказать наградной материал', (string) $a['result'] !== '' ? 'По результату: ' . (string) $a['result'] : ''),
                'actions' => [['Личный кабинет', url('/cabinet')], ['Оставить отзыв', url('/reviews')]],
            ],
        ]) : '';

        if ($html !== '' && reminder_enqueue((string) $a['email'], (string) $a['full_name'], 'Оформите награду - «' . $a['comp_name'] . '»', $html)) {
            audit('reminder_award', 'application', $id, ['competition' => $a['comp_name']]);
            if (!empty($a['user_id']) && function_exists('notify_user')) {
                notify_user((int)$a['user_id'], 'Оформите памятную награду',
                    'По результату «' . $a['result'] . '» на конкурсе «' . $a['comp_name'] . '» — доступен заказ кубка/статуэтки/медали.',
                    '/order-awards?app=' . $id, 'trophy');
            }
            $awards++;
        }
    }
    cron_log(JOB, "напоминания о наградах: поставлено в очередь $awards");

    /* ---------- 3) Напоминание о дедлайне приёма заявок (5 / 3 / 1 день) ---------- */
    $subs = all("SELECT email, name, unsub_token FROM subscribers WHERE active=1 AND email <> ''");
    foreach ([5, 3, 1] as $days) {
        $comps = all(
            "SELECT * FROM competitions WHERE status='open' AND end_date IS NOT NULL AND date(end_date)=date('now', ?)",
            ["+$days days"]
        );
        foreach ($comps as $c) {
            $cid = (int) $c['id'];
            $action = 'reminder_deadline_' . $days;
            if (already_notified($action, 'competition', $cid)) continue;

            $queued = 0;
            foreach ($subs as $s) {
                $unsub = reminder_unsub_url_token((string) $s['unsub_token']);
                $html = function_exists('mail_template') ? mail_template('reminder_deadline', [
                    'name'            => (string) ($s['name'] ?? ''),
                    'competition'     => (string) $c['name'],
                    'end_date'        => function_exists('ru_date') ? ru_date((string) $c['end_date']) : (string) $c['end_date'],
                    'apply_url'       => url('/competition/' . $c['slug']),
                    'preheader'       => 'Приём заявок скоро закроется',
                    'unsubscribe_url' => $unsub,
                ]) : '';
                if ($html !== '' && reminder_enqueue(
                    (string) $s['email'], (string) ($s['name'] ?? ''),
                    'Осталось ' . $days . ' дн. до конца приёма заявок - «' . $c['name'] . '»', $html
                )) {
                    $queued++;
                }
            }
            audit($action, 'competition', $cid, ['days' => $days, 'queued' => $queued]);
            cron_log(JOB, "дедлайн $days дн.: «{$c['name']}» -> $queued писем в очередь");
        }
    }

    /* ---------- 4) Дожим «оставьте отзыв» (через 3 дня после отправки диплома) ---------- */
    $reviews = 0;
    $rows = all(
        "SELECT a.id, a.user_id, a.full_name, a.email, a.competition_id, c.name AS comp_name, c.slug AS comp_slug
           FROM diplomas d
           JOIN applications a ON a.id = d.application_id
           JOIN competitions c ON c.id = a.competition_id
          WHERE d.sent_at IS NOT NULL
            AND date(d.sent_at) <= date('now', '-3 days')
            AND a.email <> ''
          GROUP BY a.id"
    );
    foreach ($rows as $a) {
        $id = (int) $a['id'];
        if (already_notified('reminder_review', 'application', $id)) continue;
        // Уже оставил отзыв по этому конкурсу — не просим повторно.
        $has = (int) scalar("SELECT COUNT(*) FROM reviews WHERE competition_id=? AND (user_id=? OR author=?)",
            [(int) $a['competition_id'], (int) ($a['user_id'] ?? 0), (string) $a['full_name']]);
        if ($has > 0) { audit('reminder_review', 'application', $id, ['skipped' => 'has_review']); continue; }

        $reviewsUrl = url('/reviews');
        $name = trim((string) $a['full_name']);
        $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
        $inner = '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:23px;color:#17307A;font-weight:700;">Поделитесь впечатлением</h1>'
               . '<p style="margin:0 0 12px;">' . $hello . '</p>'
               . '<p style="margin:0 0 16px;">Вы участвовали в конкурсе «' . h((string) $a['comp_name']) . '» и получили наградные документы. '
               . 'Нам очень важно Ваше мнение — расскажите, как всё прошло. Ваш отзыв помогает другим участникам и вдохновляет нас. Это займёт минуту.</p>';
        $html = function_exists('mm_email_tx') ? mm_email_tx($inner, [
            'preheader' => 'Расскажите о конкурсе «' . (string) $a['comp_name'] . '»',
            'hero'      => mm_cta_primary($reviewsUrl, 'Оставить отзыв', 'Конкурс «' . (string) $a['comp_name'] . '»'),
            'actions'   => [['Личный кабинет', url('/cabinet')]],
            'thanks'    => true,
        ]) : '';
        if ($html !== '' && reminder_enqueue((string) $a['email'], (string) $a['full_name'], 'Поделитесь отзывом о конкурсе «' . $a['comp_name'] . '»', $html)) {
            audit('reminder_review', 'application', $id, ['competition' => $a['comp_name']]);
            if (!empty($a['user_id']) && function_exists('notify_user')) {
                notify_user((int) $a['user_id'], 'Поделитесь отзывом',
                    'Расскажите, как прошёл конкурс «' . $a['comp_name'] . '». Ваше мнение важно для нас.', '/reviews', 'star');
            }
            $reviews++;
        }
    }
    cron_log(JOB, "дожим отзывов: поставлено в очередь $reviews");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
