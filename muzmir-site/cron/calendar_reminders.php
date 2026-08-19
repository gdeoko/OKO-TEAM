<?php
/**
 * Напоминания «за неделю до старта» по подпискам со страницы «Календарь».
 * Запуск: раз в день.
 *
 * На странице /calendar (templates/site/pages/calendar.php) посетитель подписывается
 * кнопкой «Напомнить за неделю до старта». Подписка сохраняется как токен в
 * subscribers.tags в формате:
 *
 *     calendar:{slug}:{date}
 *
 * где {date} - это УЖЕ ДАТА ОТПРАВКИ письма (start_date конкурса минус 7 дней),
 * а {slug} - конкурс из таблицы competitions. Токен ставился, но НИКОГДА не
 * отправлялся - не было крона, который его читает. Этот скрипт закрывает дыру.
 *
 * Что делает:
 *  - находит активных подписчиков, у которых в tags есть токен calendar:{slug}:{date}
 *    с {date} <= сегодня (день отправки настал; «<=» дренит и накопившийся бэклог,
 *    пока крона не существовало);
 *  - берёт конкурс из competitions по slug (ничего не выдумывает про конкурс);
 *  - кладёт каждому персональное письмо в mail_queue (шаблон calendar_reminder)
 *    с CTA на страницу конкурса;
 *  - СНИМАЕТ обработанный токен с подписчика - идемпотентно, повторно не шлёт;
 *  - логирует в data/logs/cron.log и пишет audit_log.
 *
 * Реальную отправку из mail_queue (и суточный лимит рассылки) выполняет
 * cron/process_newsletter_queue.php - здесь только постановка в очередь, как в
 * cron/send_reminders.php.
 *
 * Запуск: php cron/calendar_reminders.php
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
require_once __DIR__ . '/_lib.php';
// Опционально: движок рассылок даёт настоящий unsub_token через nl_ensure_subscriber().
if (is_file(BASE_PATH . '/core/newsletter.php')) require_once BASE_PATH . '/core/newsletter.php';

const JOB = 'calendar_reminders';

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

/** Единый способ поставить письмо в очередь (мягко, если mail_queue доступна). */
function calrem_enqueue(string $email, string $name, string $subject, string $html): bool {
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return false;
    if (!function_exists('mail_queue')) return false;
    return mail_queue($email, $name, $subject, $html) > 0;
}

/** Настоящая ссылка отписки (/api/v1/unsubscribe.php?token=...), как у рассылок. */
function calrem_unsub_url_token(string $token): string {
    return rtrim((string) cfgv('base_url'), '/') . '/api/v1/unsubscribe.php?token=' . urlencode($token);
}

/** То же по e-mail: заводит/находит подписчика ради токена (мягко). */
function calrem_unsub_url_email(string $email): string {
    if ($email !== '' && function_exists('nl_ensure_subscriber')) {
        try {
            [$token, ] = nl_ensure_subscriber($email, '', 'calendar');
            if ($token !== '') return calrem_unsub_url_token($token);
        } catch (\Throwable $e) { /* не критично */ }
    }
    return rtrim((string) cfgv('base_url'), '/') . '/api/v1/unsubscribe.php';
}

/** Склонение слова «день» для числа N. */
function calrem_plural_day(int $n): string {
    $n = abs($n); $t = $n % 100; $u = $n % 10;
    if ($t >= 11 && $t <= 14) return $n . ' дней';
    if ($u === 1) return $n . ' день';
    if ($u >= 2 && $u <= 4) return $n . ' дня';
    return $n . ' дней';
}

try {
    if (!function_exists('all') || !function_exists('one')) {
        cron_log(JOB, 'БД недоступна - выход');
        cron_unlock(JOB);
        exit(0);
    }

    $today = date('Y-m-d');

    // Активные подписчики, у которых вообще есть календарные токены.
    $subs = all(
        "SELECT id, email, name, tags, unsub_token FROM subscribers
          WHERE active = 1 AND email <> '' AND tags LIKE '%calendar:%'"
    );

    $compCache = [];                 // slug => row|false (одна выборка на конкурс)
    $sent = 0; $dropped = 0; $touched = 0;

    foreach ($subs as $s) {
        $email = trim((string) $s['email']);
        $name  = trim((string) ($s['name'] ?? ''));
        $tokens = array_values(array_filter(array_map('trim', explode(',', (string) $s['tags']))));
        $remove = [];                // токены, которые надо снять после обработки

        foreach ($tokens as $tok) {
            // Ждём строго calendar:{slug}:{date-или-now}
            if (!preg_match('/^calendar:([^:]+):(.+)$/', $tok, $m)) continue;
            $slug = $m[1];
            $when = $m[2];

            // Токен без даты («now» - на момент подписки старт был неизвестен):
            // отправлять «через N дней» нечего, тихо снимаем, чтобы не залипал.
            if ($when === 'now') { $remove[] = $tok; $dropped++; continue; }

            // День отправки ещё не настал - ждём (не трогаем токен).
            if ($when > $today) continue;

            // Конкурс берём из БД по slug (ничего не выдумываем).
            if (!array_key_exists($slug, $compCache)) {
                $compCache[$slug] = one(
                    "SELECT id, slug, name, start_date, status, cover FROM competitions
                      WHERE slug = ? AND status <> 'draft'",
                    [$slug]
                );
            }
            $comp = $compCache[$slug];

            if (!$comp) {
                // Конкурс удалён/черновик - подписка неактуальна, снимаем токен.
                $remove[] = $tok; $dropped++;
                cron_log(JOB, "конкурс не найден по slug=$slug - токен снят у $email");
                continue;
            }

            $start = (string) ($comp['start_date'] ?? '');
            // Старт уже наступил/прошёл - «через N дней» неуместно, снимаем без письма.
            if ($start === '' || $start <= $today) {
                $remove[] = $tok; $dropped++;
                cron_log(JOB, "старт «{$comp['name']}» уже наступил/не задан - токен снят у $email");
                continue;
            }

            $days = (int) floor((strtotime($start) - strtotime($today)) / 86400);
            $countdown = 'стартует через ' . calrem_plural_day($days);

            $unsub = ($s['unsub_token'] ?? '') !== ''
                ? calrem_unsub_url_token((string) $s['unsub_token'])
                : calrem_unsub_url_email($email);

            $compUrl = url('/competition/' . $comp['slug']);
            // Афиша конкурса в письмо (обложка из БД, абсолютный URL).
            $coverRaw = trim((string) ($comp['cover'] ?? ''));
            $coverUrl = $coverRaw === '' ? ''
                : (preg_match('~^https?://~', $coverRaw) ? $coverRaw : rtrim((string) cfgv('base_url'), '/') . '/' . ltrim($coverRaw, '/'));
            $html = function_exists('mail_template') ? mail_template('calendar_reminder', [
                'name'            => $name,
                'competition'     => (string) $comp['name'],
                'start_date'      => function_exists('ru_date') ? ru_date($start) : $start,
                'countdown'       => $countdown,
                'comp_url'        => $compUrl,
                'cover_url'       => $coverUrl,
                'preheader'       => 'Конкурс «' . $comp['name'] . '» ' . $countdown,
                '_tx'             => [
                    'hero'    => mm_cta_primary($compUrl, 'Открыть страницу конкурса', 'Приём заявок ' . $countdown),
                    'actions' => [['Календарь конкурсов', url('/calendar')]],
                ],
            ]) : '';

            $subject = 'Напоминание: конкурс «' . $comp['name'] . '» ' . $countdown;

            if ($html !== '' && calrem_enqueue($email, $name, $subject, $html)) {
                $remove[] = $tok;   // идемпотентность: письмо поставлено - токен снимаем
                $sent++;
                audit('calendar_reminder_sent', 'competition', (int) $comp['id'], [
                    'email' => $email, 'slug' => $comp['slug'], 'days' => $days, 'send_date' => $when,
                ]);
            } else {
                // Не удалось поставить в очередь - токен НЕ снимаем, попробуем завтра.
                cron_log(JOB, "не удалось поставить письмо в очередь для $email по «{$comp['name']}»");
            }
        }

        // Снимаем обработанные токены одним апдейтом на подписчика.
        if ($remove) {
            $kept = array_values(array_diff($tokens, $remove));
            update('subscribers', ['tags' => implode(',', $kept)], 'id=:id', ['id' => (int) $s['id']]);
            $touched++;
        }
    }

    cron_log(JOB, "готово: писем в очередь $sent, токенов снято-без-письма $dropped, подписчиков затронуто $touched");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
