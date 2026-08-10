<?php
/**
 * Единый почасовой крон маркетинговых рассылок Культурного центра «Музыкальный Мир»:
 * запуск конкурсов и дедлайны приёма заявок. Каналы: письма всей базе
 * (subscribers + users, дедуп по email) через очередь mail_queue, пост на стену
 * сообщества ВК (core/vk.php -> vk_wall_post), in-app уведомления (notify_user).
 *
 * Крон-строка (раз в час; PHP сам живёт в Europe/Moscow — config.php):
 *   0 * * * * php /var/www/muzmir/cron/mailings.php >/dev/null 2>&1
 *
 * Что делает (все проверки времени — по Москве):
 *  1. ЗАПУСК КОНКУРСОВ (любой час): конкурс status='open' и (start_date = сегодня
 *     ИЛИ создан < 24 часов назад), рассылки ещё не было — письмо «Открыт приём
 *     заявок» всей базе + пост ВК + in-app всем пользователям.
 *  2. «Осталось 3 дня до конца приёма» (10:00-11:00 мск): end_date - 3 = сегодня.
 *  3. «Последний день приёма» (9:00-10:00 мск): end_date = сегодня.
 *
 * Отдельного письма о ВИП-клубе здесь больше нет: приглашение в клуб идёт третьим
 * блоком объединённого письма запуска (core/launch_combo.php).
 *
 * Пока кампанией месяца управляет пульт запуска (launch_jobs), этот крон вообще
 * не работает — иначе те же волны выходили бы дважды.
 *
 * Антидубль: таблица mailing_log(kind, ref, sent_at) + UNIQUE(kind, ref) —
 * создаётся мягко, повторный запуск безопасен. Письма — фирменный лейаут
 * core/result_mail.php (rm_mail_layout/rm_mail_btn, синий #17307A + золото
 * #C79322), кладутся в mail_queue батчами — реальную отправку делает
 * cron/process_newsletter_queue.php, крон не блокируется на SMTP.
 *
 * Запуск вручную: php cron/mailings.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
// Фирменные кирпичики письма (rm_mail_layout/rm_mail_btn)
// + core/notifications.php подключается изнутри result_mail.php.
require_once BASE_PATH . '/core/result_mail.php';
require_once BASE_PATH . '/core/vk.php';
require_once BASE_PATH . '/core/vk_templates.php';
require_once BASE_PATH . '/core/club.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'mailings';

// СТОП-КРАН: пока массовые коммуникации выключены в пульте запуска, ничего
// массового наружу не уходит (см. core/newsletter.php::mass_sending_enabled).
if (is_file(BASE_PATH . '/core/newsletter.php')) require_once BASE_PATH . '/core/newsletter.php';
if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) {
    cron_log(JOB, 'массовые коммуникации выключены стоп-краном — выход');
    exit(0);
}

/** Размер батча вставок в mail_queue (одна транзакция на батч). */
const MAILINGS_BATCH = 200;

/* В CLI нет api/v1/_boot.php с tbl_exists() — без неё notify_user() молчит. */
if (!function_exists('tbl_exists')) {
    function tbl_exists(string $t): bool {
        try {
            return (bool) one("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [$t]);
        } catch (\Throwable $e) { return false; }
    }
}

if (!cron_lock(JOB, 3300)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

/* ============================ Антидубль mailing_log ============================ */

/** Уже была рассылка этого вида по этой сущности? */
function mailing_sent(string $kind, string $ref): bool {
    try {
        return (bool) one("SELECT id FROM mailing_log WHERE kind=? AND ref=?", [$kind, $ref]);
    } catch (\Throwable $e) { return false; }
}

/** Отметить рассылку выполненной (UNIQUE(kind,ref) страхует от гонок — тихо). */
function mailing_mark(string $kind, string $ref): void {
    try {
        insert('mailing_log', ['kind' => $kind, 'ref' => $ref, 'sent_at' => date('Y-m-d H:i:s')]);
    } catch (\Throwable $e) { /* уже отмечено */ }
}

/* ============================== База адресатов ================================ */

/**
 * Вся база адресов: активные подписчики (subscribers.active=1) UNION пользователи
 * с включёнными почтовыми уведомлениями (users.notify_email=1). Дедуп по email
 * в нижнем регистре, только валидные адреса.
 * @return array<string, array{email:string,name:string}> ключ — email lower.
 */
function mailings_recipients(): array {
    $out = [];
    $add = function (string $email, string $name) use (&$out): void {
        $email = trim($email);
        $key = mb_strtolower($email);
        if ($email === '' || isset($out[$key])) return;
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return;
        $out[$key] = ['email' => $email, 'name' => trim($name)];
    };
    try {
        foreach (all("SELECT email, name FROM subscribers WHERE active=1") as $s) {
            $add((string) $s['email'], (string) $s['name']);
        }
    } catch (\Throwable $e) { /* таблицы может не быть */ }
    try {
        foreach (all("SELECT email, full_name FROM users WHERE email IS NOT NULL AND email <> '' AND notify_email=1") as $u) {
            $add((string) $u['email'], (string) $u['full_name']);
        }
    } catch (\Throwable $e) { /* таблицы может не быть */ }
    return $out;
}

/**
 * Кладёт письмо всем адресатам в mail_queue батчами по MAILINGS_BATCH
 * (одна транзакция на батч — быстро и не блокирует крон на SMTP).
 * @param array $recipients результат mailings_recipients()
 * @return int сколько писем поставлено в очередь
 */
function mailings_queue_all(array $recipients, string $subject, string $html): int {
    $queued = 0;
    $chunks = array_chunk(array_values($recipients), MAILINGS_BATCH);
    foreach ($chunks as $chunk) {
        $inTx = false;
        try { $inTx = db()->beginTransaction(); } catch (\Throwable $e) { /* без транзакции */ }
        foreach ($chunk as $r) {
            if (mail_queue($r['email'], $r['name'], $subject, $html) > 0) $queued++;
        }
        if ($inTx) {
            try { db()->commit(); } catch (\Throwable $e) { /* уже закрыта */ }
        }
    }
    return $queued;
}

/** In-app уведомление всем пользователям сайта. Возвращает число созданных. */
function mailings_notify_all(string $title, string $body, string $url, string $icon = 'bell'): int {
    if (!function_exists('notify_user')) return 0;
    $n = 0;
    try {
        foreach (all("SELECT id FROM users") as $u) {
            if (notify_user((int) $u['id'], $title, $body, $url, $icon) > 0) $n++;
        }
    } catch (\Throwable $e) { /* таблицы может не быть */ }
    return $n;
}

/** Название текущего месяца в родительном падеже (для темы письма). */
function mailings_month_ru(): string {
    $m = [1=>'января',2=>'февраля',3=>'марта',4=>'апреля',5=>'мая',6=>'июня',
          7=>'июля',8=>'августа',9=>'сентября',10=>'октября',11=>'ноября',12=>'декабря'];
    return $m[(int) date('n')] ?? '';
}

/* ============================= Кусочки контента =============================== */

/** Дата 'YYYY-MM-DD...' -> 'дд.мм.гггг' (пусто, если не разобралась). */
function mailings_dmy(?string $date): string {
    $ts = $date !== null && trim($date) !== '' ? strtotime(trim($date)) : false;
    return $ts !== false ? date('d.m.Y', $ts) : '';
}

/** Карточка конкурса для письма: название, сроки приёма, золотая кнопка. */
function mailings_comp_card(array $c, string $btnLabel): string {
    $navy = RM_NAVY; $muted = RM_MUTED; $card = RM_CARD; $line = RM_LINE;
    $name  = trim((string) $c['name']);
    $link  = url('/competition/' . (string) $c['slug']);
    $start = mailings_dmy((string) ($c['start_date'] ?? ''));
    $end   = mailings_dmy((string) ($c['end_date'] ?? ''));

    $dates = '';
    if ($start !== '' && $end !== '') $dates = 'Приём заявок: с ' . $start . ' по ' . $end;
    elseif ($end !== '')              $dates = 'Приём заявок: до ' . $end;
    elseif ($start !== '')            $dates = 'Приём заявок: с ' . $start;

    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        . 'style="margin:0 0 16px;background:' . $card . ';border:1px solid ' . $line . ';border-radius:14px;">'
        . '<tr><td style="padding:20px 24px;">'
        . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:18px;font-weight:700;color:' . $navy . ';margin-bottom:6px;">'
        . h($name) . '</div>'
        . ($dates !== '' ? '<div style="font-size:14px;color:' . $muted . ';margin-bottom:2px;">' . h($dates) . '</div>' : '')
        . rm_mail_btn($link, $btnLabel)
        . '</td></tr></table>';
}

/** Письмо со списком конкурсов в фирменном лейауте. */
function mailings_comps_html(string $title, string $lead, array $comps, string $btnLabel, string $preheader): string {
    $navy = RM_NAVY; $muted = RM_MUTED;
    $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.25;font-weight:700;color:' . $navy . ';">'
        . h($title) . '</h1>'
        . '<p style="margin:0 0 14px;">Здравствуйте!</p>'
        . '<p style="margin:0 0 20px;">' . h($lead) . '</p>';
    foreach ($comps as $c) {
        $inner .= mailings_comp_card($c, $btnLabel);
    }
    $inner .= '<p style="margin:14px 0 0;font-size:13px;color:' . $muted . ';">'
        . 'Все актуальные конкурсы центра — на странице <a href="' . h(url('/competitions'))
        . '" style="color:' . $navy . ';">конкурсов</a>.</p>';
    return rm_mail_layout($inner, $preheader);
}

/** Текст ВК-поста со списком конкурсов. */
function mailings_comps_vk(string $head, array $comps, string $tail): string {
    $lines = [$head, ''];
    foreach ($comps as $c) {
        $end = mailings_dmy((string) ($c['end_date'] ?? ''));
        $lines[] = '«' . trim((string) $c['name']) . '»'
            . ($end !== '' ? ' — приём заявок до ' . $end : '')
            . '. Подать заявку: ' . url('/competition/' . (string) $c['slug']);
    }
    $lines[] = '';
    $lines[] = $tail;
    return implode("\n", $lines);
}

/** Перечень названий конкурсов для in-app: «А», «Б». */
function mailings_comp_names(array $comps): string {
    return implode(', ', array_map(
        static fn(array $c): string => '«' . trim((string) $c['name']) . '»',
        $comps
    ));
}

/**
 * Одна кампания по списку конкурсов: письмо всей базе + пост ВК + in-app всем.
 * Помечает каждый конкурс в mailing_log только при успехе хотя бы одного канала.
 */
function mailings_run_comps_campaign(
    string $kind, array $comps, array $recipients,
    string $subject, string $html, string $vkText,
    string $inTitle, string $inBody
): void {
    $queued = mailings_queue_all($recipients, $subject, $html);

    $vkOk = false;
    if ($vkText !== '' && trim((string) cfgv('vk_token', '')) !== '') {
        $r = vk_wall_post($vkText);
        $vkOk = !isset($r['error']);
        if (!$vkOk) {
            cron_log(JOB, "$kind: wall.post ОШИБКА: " . (string) ($r['error']['error_msg'] ?? '?'));
        } elseif (function_exists('vk_broadcast')) {
            // тот же пост — рассылка подписчикам через сервис «Рассылки» (vkforms)
            $bc = vk_broadcast($vkText, vk_dm_wall_attachment($r));
            cron_log(JOB, "$kind: рассылка подписчикам — " . ($bc['ok'] ? 'OK id=' . $bc['id'] : 'нет: ' . $bc['error']));
        }
    } else {
        cron_log(JOB, "$kind: vk_token не настроен - ВК-пост пропущен");
    }

    $inApp = mailings_notify_all($inTitle, $inBody, url('/competitions'), 'megaphone');

    if ($queued > 0 || $vkOk || $inApp > 0) {
        foreach ($comps as $c) {
            mailing_mark($kind, (string) (int) $c['id']);
        }
        cron_log(JOB, "$kind: конкурсы " . mailings_comp_names($comps)
            . " - писем в очереди $queued, ВК " . ($vkOk ? 'OK' : 'нет') . ", in-app $inApp");
    } else {
        cron_log(JOB, "$kind: ни один канал не сработал - без отметки, повторим в следующий час");
    }
}

/* ================================== Работа =================================== */

try {
    if (!function_exists('all') || !function_exists('scalar')) {
        cron_log(JOB, 'БД недоступна - выход');
        cron_unlock(JOB);
        exit(0);
    }

    /* ---------- Мягкие миграции ---------- */
    q("CREATE TABLE IF NOT EXISTS mailing_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        sent_at TEXT DEFAULT (datetime('now')),
        UNIQUE(kind, ref)
    )");
    // Таблица in-app уведомлений (контракт core/notifications.php) — если её ещё нет.
    q("CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT DEFAULT '',
        url TEXT DEFAULT '',
        icon TEXT DEFAULT 'bell',
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
    )");

    $today = date('Y-m-d');            // Europe/Moscow (config.php)
    $hour  = (int) date('G');
    $day   = (int) date('j');

    /* ---------- ЧЬЯ ЭТО РАБОТА: ПУЛЬТА ЗАПУСКА ИЛИ ЭТОГО КРОНА ---------- */
    // Этот крон — СТАРАЯ автоматика кампании месяца. С августа 2026 теми же волнами
    // управляет пульт запуска (таблица launch_jobs): открытие конкурсов, «осталось
    // 3 дня», «последний день», «приём закрыт» и приглашение в клуб.
    //
    // Работая одновременно, они дублируют друг друга: 10-го числа в 10:00 этот крон
    // отправил бы ОТДЕЛЬНОЕ письмо о ВИП-клубе и пост в ВК — ровно поверх объединённого
    // письма запуска, где приглашение в клуб уже есть третьим блоком. То же 22-го и
    // 25-го: пост «осталось 3 дня» вышел бы на стену дважды.
    //
    // Правило: если на этот месяц в пульте есть кампания, кампанийные блоки 1-4
    // здесь НЕ выполняются. Пульт — единственный источник этих волн.
    $panelOwns = false;
    try {
        $panelOwns = (int) scalar(
            "SELECT COUNT(*) FROM launch_jobs
              WHERE status IN ('scheduled','running','done')
                AND strftime('%Y-%m', run_at) = ?", [date('Y-m')]) > 0;
    } catch (\Throwable $e) { $panelOwns = false; }   // нет таблицы — работает старая схема
    if ($panelOwns) {
        cron_log(JOB, 'кампанию месяца ведёт пульт запуска (launch_jobs) — блоки 1-4 пропускаем, чтобы не задвоить письма и посты');
        cron_unlock(JOB);
        exit(0);
    }

    $recipients = mailings_recipients();
    cron_log(JOB, 'база адресов: ' . count($recipients) . ' (subscribers + users, дедуп по email)');

    /* ============ 1. ЗАПУСК КОНКУРСОВ (любой час) ============ */
    // status='open' и (start_date = сегодня ИЛИ конкурс создан < 24 часов назад);
    // created_at — SQL-дефолт datetime('now'), UTC (см. соглашение в cron/_lib.php).
    $launch = array_values(array_filter(
        all(
            "SELECT * FROM competitions
              WHERE status = 'open'
                AND (date(start_date) = ? OR created_at >= datetime('now', '-1 day'))
           ORDER BY id ASC",
            [$today]
        ),
        static fn(array $c): bool => !mailing_sent('comp_launch', (string) (int) $c['id'])
    ));
    if ($launch) {
        $many = count($launch) > 1;
        $subject = $many
            ? 'Открыт приём заявок на новые конкурсы - Культурного центра «Музыкальный Мир»'
            : 'Открыт приём заявок - «' . trim((string) $launch[0]['name']) . '»';
        $html = mailings_comps_html(
            'Открыт приём заявок',
            $many
                ? 'Культурный центр «Музыкальный Мир» открывает приём заявок на новые конкурсы. Выбирайте конкурс, подавайте заявку и покажите своё мастерство.'
                : 'Культурный центр «Музыкальный Мир» открывает приём заявок на новый конкурс. Подавайте заявку и покажите своё мастерство.',
            $launch,
            'Подать заявку',
            'Открыт приём заявок: ' . mailings_comp_names($launch) . '.'
        );
        /* ВК: отдельный пост на каждый конкурс с его афишей — шаблон «запуск». */
        if (trim((string) cfgv('vk_token', '')) !== '') {
            foreach ($launch as $lc) {
                $af = BASE_PATH . '/public/uploads/comp/' . (int) $lc['id'] . '/afisha.jpg';
                $r = (is_file($af) && function_exists('vk_wall_post_with_photo'))
                    ? vk_wall_post_with_photo(vkt_launch($lc), $af)
                    : vk_wall_post(vkt_launch($lc));
                cron_log(JOB, 'comp_launch VK «' . $lc['name'] . '»: '
                    . (isset($r['error']) ? 'ОШИБКА ' . (string)($r['error']['error_msg'] ?? '?') : 'OK'));
                if (!isset($r['error']) && function_exists('vk_broadcast')) {
                    $bc = vk_broadcast(vkt_launch($lc), vk_dm_wall_attachment($r));
                    cron_log(JOB, 'comp_launch «' . $lc['name'] . '»: рассылка подписчикам — '
                        . ($bc['ok'] ? 'OK id=' . $bc['id'] : 'нет: ' . $bc['error']));
                }
            }
        }
        // Почта — только месячной сводкой 1-го числа; здесь ВК уже опубликован, кампания даёт in-app.
        mailings_run_comps_campaign(
            'comp_launch', $launch, [], $subject, $html, '',
            'Открыт приём заявок',
            ($many ? 'Новые конкурсы: ' : 'Новый конкурс: ') . mailings_comp_names($launch) . '. Подайте заявку!'
        );
    }

    /* ============ 1а. СВОДКА МЕСЯЦА (1 числа, 10:00 мск) ============ */
    // Календарь владельца: 1-го — рассылка «запущены новые конкурсы» всей базе,
    // даже если событийная рассылка по какому-то конкурсу уже была.
    if ($day === 1 && $hour === 10) {
        $kindMonth = 'month_launch_' . date('Y-m');
        $monthly = array_values(array_filter(
            all("SELECT * FROM competitions
                  WHERE status = 'open' ORDER BY sort, id ASC"),
            static fn(array $c): bool => !mailing_sent($kindMonth, (string) (int) $c['id'])
        ));
        if ($monthly) {
            $subject = 'Новые конкурсы ' . mailings_month_ru() . ' - Культурного центра «Музыкальный Мир»';
            $html = mailings_comps_html(
                'Конкурсы месяца запущены',
                'Приём заявок открыт с 1 по 25 число. Выбирайте конкурс, подавайте заявку и покажите своё мастерство.',
                $monthly,
                'Подать заявку',
                'Запущены конкурсы месяца: ' . mailings_comp_names($monthly) . '.'
            );
            $vk = mailings_comps_vk(
                'КОНКУРСЫ МЕСЯЦА ЗАПУЩЕНЫ. Приём заявок открыт с 1 по 25 число:',
                $monthly,
                'Ждём ваши заявки! Все конкурсы центра: ' . url('/competitions')
            );
            mailings_run_comps_campaign(
                $kindMonth, $monthly, $recipients, $subject, $html, $vk,
                'Конкурсы месяца запущены',
                'Открыт приём заявок: ' . mailings_comp_names($monthly) . '. Подайте заявку!'
            );
        }
    }

    /* ============ 2. «Осталось 3 дня до конца приёма» (22 числа / end_date-3, 10:00 мск) ============ */
    if ($hour === 10) {
        $soonWhere = $day === 22
            ? "status = 'open' AND end_date IS NOT NULL AND end_date <> ''"
            : "status = 'open' AND end_date IS NOT NULL AND end_date <> '' AND date(end_date, '-3 days') = ?";
        $soon = array_values(array_filter(
            all(
                "SELECT * FROM competitions
                  WHERE $soonWhere ORDER BY id ASC",
                $day === 22 ? [] : [$today]
            ),
            static fn(array $c): bool => !mailing_sent('deadline_3', (string) (int) $c['id'])
        ));
        if ($soon) {
            $many = count($soon) > 1;
            $subject = $many
                ? 'Осталось 3 дня до конца приёма заявок - Культурного центра «Музыкальный Мир»'
                : 'Осталось 3 дня - «' . trim((string) $soon[0]['name']) . '»';
            $html = mailings_comps_html(
                'Осталось 3 дня',
                'Через три дня завершается приём заявок' . ($many ? ' на конкурсы' : ' на конкурс')
                    . '. Успейте подать заявку — жюри уже готовится к работе.',
                $soon,
                'Успеть подать заявку',
                'Приём заявок завершается через 3 дня: ' . mailings_comp_names($soon) . '.'
            );
            $vk = vkt_deadline($soon, false);
            // По календарю владельца: без почты — только ВК + приложение.
            mailings_run_comps_campaign(
                'deadline_3', $soon, [], $subject, $html, $vk,
                'Осталось 3 дня до конца приёма',
                'Приём заявок завершается: ' . mailings_comp_names($soon) . '. Успейте подать заявку.'
            );
        }
    }

    /* ============ 3. «Последний день приёма» (25 числа / end_date, 9:00 мск) ============ */
    if ($hour === 9) {
        $lastWhere = $day === 25
            ? "status = 'open' AND end_date IS NOT NULL AND end_date <> ''"
            : "status = 'open' AND end_date IS NOT NULL AND end_date <> '' AND date(end_date) = ?";
        $last = array_values(array_filter(
            all(
                "SELECT * FROM competitions
                  WHERE $lastWhere ORDER BY id ASC",
                $day === 25 ? [] : [$today]
            ),
            static fn(array $c): bool => !mailing_sent('deadline_last', (string) (int) $c['id'])
        ));
        if ($last) {
            $many = count($last) > 1;
            $subject = $many
                ? 'Последний день приёма заявок - Культурного центра «Музыкальный Мир»'
                : 'Последний день приёма заявок - «' . trim((string) $last[0]['name']) . '»';
            $html = mailings_comps_html(
                'Последний день приёма',
                'Сегодня последний день приёма заявок' . ($many ? ' на конкурсы' : ' на конкурс')
                    . '. Это последняя возможность принять участие — заявки принимаются до конца дня.',
                $last,
                'Подать заявку сегодня',
                'Сегодня последний день приёма заявок: ' . mailings_comp_names($last) . '.'
            );
            $vk = vkt_deadline($last, true);
            // По календарю владельца: без почты — только ВК + приложение.
            mailings_run_comps_campaign(
                'deadline_last', $last, [], $subject, $html, $vk,
                'Последний день приёма заявок',
                'Сегодня завершается приём: ' . mailings_comp_names($last) . '. Подайте заявку до конца дня.'
            );
        }
    }

    /* ============ 3б. «Приём заявок закрыт» (26 числа / end_date+1, 10:00 мск) ============ */
    if ($hour === 10) {
        $closedWhere = $day === 26
            ? "status IN ('open','judging') AND end_date IS NOT NULL AND end_date <> '' AND date(end_date) < ?"
            : "status IN ('open','judging') AND end_date IS NOT NULL AND end_date <> '' AND date(end_date, '+1 day') = ?";
        $closedComps = array_values(array_filter(
            all("SELECT * FROM competitions WHERE $closedWhere ORDER BY id ASC", [$today]),
            static fn(array $c): bool => !mailing_sent('closed_post', (string) (int) $c['id'])
        ));
        if ($closedComps) {
            $vkOkC = false;
            if (trim((string) cfgv('vk_token', '')) !== '') {
                $r = vk_wall_post(vkt_closed($closedComps));
                $vkOkC = !isset($r['error']);
                if (!$vkOkC) {
                    cron_log(JOB, 'closed_post: wall.post ОШИБКА: ' . (string)($r['error']['error_msg'] ?? '?'));
                } elseif (function_exists('vk_broadcast')) {
                    $bc = vk_broadcast(vkt_closed($closedComps), vk_dm_wall_attachment($r));
                    cron_log(JOB, 'closed_post: рассылка подписчикам — ' . ($bc['ok'] ? 'OK id=' . $bc['id'] : 'нет: ' . $bc['error']));
                }
            }
            $inC = mailings_notify_all('Приём заявок закрыт',
                'Приём заявок завершён: ' . mailings_comp_names($closedComps) . '. Следите за результатами.',
                url('/results'), 'bell');
            if ($vkOkC || $inC > 0) {
                foreach ($closedComps as $c) mailing_mark('closed_post', (string) (int) $c['id']);
                cron_log(JOB, 'closed_post: ' . mailings_comp_names($closedComps) . ' — ВК ' . ($vkOkC ? 'OK' : 'нет') . ", in-app $inC");
            }
        }
    }

    /* ============ 4. ВИП-РАССЫЛКА о Клубе — УБРАНА НАВСЕГДА ============
     * Правило владельца (август 2026): отдельного письма о Клубе не существует.
     * Приглашение в клуб — третий блок объединённого письма запуска
     * (core/launch_combo.php), и уходит только тем, кто в клубе не состоит.
     * Этот блок срабатывал 10-го числа в 10:00 — ровно в минуту запуска — и слал
     * всей базе второе письмо о том же самом плюс пост в ВК.
     */

} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
