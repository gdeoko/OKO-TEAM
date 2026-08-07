<?php
/**
 * core/launch_run.php — «Пуск-пульт» конкурса.
 * Одна кнопка «Запустить» раскидывает объявление по каналам:
 *   • ВК стена сообщества + дубль в сторис (с афишей);
 *   • ВК рассылка в личку (открытые диалоги);
 *   • Email по всей базе (через прогрев-очередь newsletter);
 *   • In-app уведомление всем пользователям приложения.
 * Тексты — по эталонам vk_templates.php, с возможностью ручной правки
 * (override в settings: launch_txt:{compId}:{wave}).
 * Волны: launch | d3 | last | closed | results.
 * Поддержка расписания (launch_jobs) и dry-run (ничего не отправляет — только отчёт).
 */
declare(strict_types=1);

require_once __DIR__ . '/vk_templates.php';
if (is_file(__DIR__ . '/mailer.php'))        require_once __DIR__ . '/mailer.php';
if (is_file(__DIR__ . '/newsletter.php'))     require_once __DIR__ . '/newsletter.php';
if (is_file(__DIR__ . '/notifications.php'))   require_once __DIR__ . '/notifications.php';
if (is_file(__DIR__ . '/vk.php'))              require_once __DIR__ . '/vk.php';
if (is_file(__DIR__ . '/send_timing.php'))     require_once __DIR__ . '/send_timing.php';

/** Человекочитаемые названия волн (порядок = порядок в пульте). */
function launch_waves(): array {
    return [
        'launch'  => 'Открытие · приём заявок',
        'd3'      => 'Осталось 3 дня',
        'last'    => 'Последний день',
        'closed'  => 'Приём закрыт',
        'results' => 'Результаты',
    ];
}

/** Каналы отправки. */
function launch_channels(): array {
    return [
        'vk_wall' => 'ВК: стена + сторис',
        'vk_dm'   => 'ВК: рассылка в личку',
        'email'   => 'Email по базе (прогрев)',
        'inapp'   => 'In-app всем пользователям',
    ];
}

/** Нормализация записи конкурса для эталонов (длинный/короткий — строго по results_mode). */
function launch_norm_comp(array $c): array {
    $c['duration'] = ((string)($c['results_mode'] ?? '') === 'list') ? 'long' : 'short';
    return $c;
}

/** Список открытых конкурсов (для сводных волн d3/last/closed). */
function launch_open_comps(): array {
    $rows = all("SELECT * FROM competitions WHERE status='open' ORDER BY (type='international') DESC, sort, id");
    return array_map('launch_norm_comp', $rows);
}

/** Дефолтный (эталонный) текст волны из vk_templates. */
function launch_wave_default(array $c, string $wave, array $siblings = []): string {
    $c = launch_norm_comp($c);
    $comps = $siblings ?: [$c];
    switch ($wave) {
        // ЗАПУСК — один общий текст по всем открытым конкурсам (если их несколько);
        // одиночный конкурс — отдельный пост.
        case 'launch':  return count($comps) > 1 ? vkt_launch_all($comps) : vkt_launch($c);
        case 'd3':      return vkt_deadline($comps, false);
        case 'last':    return vkt_deadline($comps, true);
        case 'closed':  return vkt_closed($comps);
        case 'results': return vkt_results_long($c);
    }
    return '';
}

/** Текст волны: ручной override (если правили в пульте), иначе эталон. */
function launch_wave_text(array $c, string $wave, array $siblings = []): string {
    $ov = function_exists('setting') ? (string) setting('launch_txt:' . (int) $c['id'] . ':' . $wave, '') : '';
    if (trim($ov) !== '') return $ov;
    return launch_wave_default($c, $wave, $siblings);
}

/** Абсолютный путь к файлу афиши конкурса (для ВК-фото/сторис) или ''. */
function launch_cover_path(array $c): string {
    $cover = trim((string) ($c['cover'] ?? ''));
    if ($cover === '') return '';
    $cover = preg_replace('~^https?://[^/]+~i', '', $cover);
    $p = BASE_PATH . '/public/' . ltrim($cover, '/');
    return is_file($p) ? $p : '';
}

/** Тема email по волне. */
function launch_email_subject(array $c, string $wave): string {
    $n = (string) $c['name'];
    return match ($wave) {
        'launch'  => 'Открыт приём заявок в новые конкурсы — Культурный центр «Музыкальный Мир»',
        'd3'      => 'Осталось 3 дня — приём заявок закрывается',
        'last'    => 'Сегодня последний день приёма заявок',
        'closed'  => 'Приём заявок закрыт',
        'results' => 'Результаты конкурса «' . $n . '»',
        default   => 'Культурный центр «Музыкальный Мир»',
    };
}

/** Rich-HTML письма из текста волны + фирменные кнопки/контакты. */
function launch_email_html(array $c, string $wave, array $siblings = []): string {
    $text = launch_wave_text($c, $wave, $siblings);
    // Автоссылки: музыкальный-мир.рф/... , vk.ru/... , max.ru/... → кликабельные.
    // (Telegram/YouTube/Instagram/WhatsApp/Facebook НЕ линкуем и не упоминаем — запрещены.)
    $safe = h($text);
    $safe = preg_replace('~(музыкальный-мир\.рф[^\s<]*)~u', '<a href="https://$1" style="color:#17307A">$1</a>', $safe);
    $safe = preg_replace('~((?:vk\.ru|vk\.com|max\.ru)/[^\s<]+)~u', '<a href="https://$1" style="color:#17307A">$1</a>', $safe);
    $body = nl2br($safe);

    $applyUrl   = url('/apply');
    $cabUrl     = url('/cabinet');
    $reviewsUrl = url('/reviews');
    $compsUrl   = url('/konkursi');
    $vipUrl     = url('/vip');

    $inner = '<div style="font-size:15px;line-height:1.7;color:#33406B;">' . $body . '</div>';

    // ЗАПУСК: общее письмо — карточки-афиши по каждому открытому конкурсу
    // (обложка + «Подать заявку» + «Положение»). Это тот самый общий формат «4 афиши».
    if ($wave === 'launch' && count($siblings) > 1) {
        $base  = rtrim((string) (function_exists('cfgv') ? cfgv('base_url') : ''), '/');
        $cards = '';
        foreach ($siblings as $sc) {
            $cover = trim((string) ($sc['cover'] ?? ''));
            if ($cover !== '' && !preg_match('~^https?://~i', $cover)) $cover = $base . '/' . ltrim($cover, '/');
            $name  = h((string) $sc['name']);
            $paid  = (int) ($sc['is_paid'] ?? 0) === 1;
            $feeTxt = $paid ? ('Оргвзнос ' . (int) $sc['price'] . ' ₽') : 'Участие бесплатное';
            $applyU = $base . '/konkurs-' . h((string) $sc['slug']);
            $regU   = $base . '/polozhenie-' . h((string) $sc['slug']);
            $cards .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#F7F9FF;border:1px solid #E3E9F7;border-radius:14px;overflow:hidden">'
                . ($cover !== '' ? '<tr><td><img src="' . h($cover) . '" alt="' . $name . '" width="100%" style="display:block;width:100%;max-width:100%;height:auto"></td></tr>' : '')
                . '<tr><td style="padding:16px 18px">'
                . '<div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#17307A;margin:0 0 4px">«' . $name . '»</div>'
                . '<div style="font-size:13px;color:#6A7096;margin:0 0 12px">' . $feeTxt . ' · приём до ' . h(function_exists('ru_date') ? ru_date((string) ($sc['end_date'] ?? '')) : (string) ($sc['end_date'] ?? '')) . '</div>'
                . '<a href="' . h($applyU) . '" style="display:inline-block;background:#17307A;color:#fff;text-decoration:none;padding:10px 18px;border-radius:9px;font-weight:700;font-size:14px;margin:0 8px 6px 0">Подать заявку</a>'
                . '<a href="' . h($regU) . '" style="display:inline-block;background:#fff;color:#17307A;text-decoration:none;padding:9px 17px;border-radius:9px;font-weight:700;font-size:14px;border:1.5px solid #17307A">Положение</a>'
                . '</td></tr></table>';
        }
        $inner = '<div style="font-size:15px;line-height:1.7;color:#33406B;margin:0 0 18px">Культурный центр «Музыкальный Мир» приглашает принять участие в новых онлайн-конкурсах культуры и искусства:</div>'
            . $cards
            . '<div style="font-size:13.5px;line-height:1.7;color:#6A7096;margin:8px 0 0">Моментальный приём заявки · без ограничений по возрасту и количеству заявок · профессиональное жюри · в дипломе не указывается формат «онлайн».</div>';
    }

    // Кнопки-действия (email-совместимые таблицы).
    $btns = [];
    if ($wave !== 'closed') $btns[] = ['Подать заявку', $applyUrl];
    if ($wave === 'results') { $btns[] = ['Результаты и заказ наград', url('/results/' . (string) ($c['slug'] ?? ''))]; $btns[] = ['Оставить отзыв', $reviewsUrl]; }
    $btns[] = ['Личный кабинет', $cabUrl];
    $btns[] = ['Другие конкурсы', $compsUrl];
    if ($wave !== 'results') $btns[] = ['ВИП-клуб', $vipUrl];

    if (function_exists('mm_email_tx')) {
        $hero = function_exists('mm_cta_primary')
            ? mm_cta_primary($btns[0][1], $btns[0][0], '')
            : '';
        $actions = array_slice($btns, 1);
        return mm_email_tx($inner, [
            'preheader' => launch_email_subject($c, $wave),
            'hero'      => $hero,
            'actions'   => $actions,
            'thanks'    => in_array($wave, ['results'], true),
        ]);
    }
    // Fallback без обёртки.
    $btnHtml = '';
    foreach ($btns as $b) {
        $btnHtml .= '<a href="' . h($b[1]) . '" style="display:inline-block;margin:4px 6px 4px 0;padding:11px 20px;background:#17307A;color:#fff;text-decoration:none;border-radius:9px;font-weight:700;font-size:14px;">' . h($b[0]) . '</a>';
    }
    return $inner . '<div style="margin-top:22px">' . $btnHtml . '</div>';
}

/** Короткое in-app уведомление по волне: [title, body, url]. */
function launch_inapp_payload(array $c, string $wave): array {
    $n = (string) $c['name'];
    $slug = (string) ($c['slug'] ?? '');
    return match ($wave) {
        'launch'  => ['Открыт приём заявок', 'Конкурс «' . $n . '» — успейте подать заявку и пройти аттестацию жюри.', url('/competition/' . $slug)],
        'd3'      => ['Осталось 3 дня', 'Приём заявок на конкурсы «Музыкального Мира» скоро закроется. Успейте подать номер.', url('/konkursi')],
        'last'    => ['Последний день приёма', 'Сегодня — финальный день подачи заявок. Не откладывайте.', url('/konkursi')],
        'closed'  => ['Приём заявок закрыт', 'Спасибо за участие! Результаты сообщим в кабинете и на почте.', url('/cabinet')],
        'results' => ['Результаты конкурса', 'Опубликованы итоги конкурса «' . $n . '». Смотрите свой результат.', url('/results/' . $slug)],
        default   => ['Культурный центр «Музыкальный Мир»', '', url('/konkursi')],
    };
}

/** Массовое in-app уведомление ВСЕМ пользователям (одним запросом). Возвращает число. */
function launch_notify_all(string $title, string $body, string $url, string $icon = 'bell'): int {
    try {
        q("INSERT INTO notifications (user_id, title, body, url, icon)
           SELECT id, ?, ?, ?, ? FROM users WHERE COALESCE(blocked,0)=0", [$title, $body, $url, $icon]);
        return (int) db()->query("SELECT COUNT(*) FROM users WHERE COALESCE(blocked,0)=0")->fetchColumn();
    } catch (\Throwable $e) {
        // Фолбэк: если нет колонки blocked.
        try {
            q("INSERT INTO notifications (user_id, title, body, url, icon) SELECT id, ?, ?, ?, ? FROM users", [$title, $body, $url, $icon]);
            return (int) db()->query("SELECT COUNT(*) FROM users")->fetchColumn();
        } catch (\Throwable $e2) { return 0; }
    }
}

/** Мягкая миграция таблицы запланированных запусков. */
function launch_migrate(): void {
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS launch_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            competition_id INTEGER NOT NULL,
            wave TEXT NOT NULL,
            channels TEXT NOT NULL,
            run_at TEXT NOT NULL,
            status TEXT DEFAULT 'scheduled',   -- scheduled|done|cancelled
            report TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            done_at TEXT
        )");
    } catch (\Throwable $e) {}
}

/**
 * Запуск волны по каналам.
 * @param int      $compId
 * @param string   $wave     launch|d3|last|closed|results
 * @param string[] $channels vk_wall|vk_dm|email|inapp
 * @param string   $when     '' = сейчас; иначе дата-время (МСК) → планируется
 * @param bool     $dry      true = ничего не отправлять, только отчёт
 * @return array   ['ok'=>bool,'scheduled'=>bool,'report'=>[...],'msg'=>string]
 */
function launch_fire(int $compId, string $wave, array $channels, string $when = '', bool $dry = false): array {
    launch_migrate();
    $c = one("SELECT * FROM competitions WHERE id=?", [$compId]);
    if (!$c) return ['ok' => false, 'msg' => 'Конкурс не найден'];
    $c = launch_norm_comp($c);
    $channels = array_values(array_intersect($channels, array_keys(launch_channels())));
    if (!$channels) return ['ok' => false, 'msg' => 'Не выбран ни один канал'];
    if (!isset(launch_waves()[$wave])) return ['ok' => false, 'msg' => 'Неизвестная волна'];
    // Правило владельца: «осталось 3 дня / последний день / приём закрыт» НЕ идут на почту —
    // только in-app всем + пост ВКонтакте (с авто-сторис) + рассылка в личку. На почту идёт
    // только открытие конкурсов и ВИП-клуб (и результаты длинного — участникам).
    if (in_array($wave, ['d3', 'last', 'closed'], true)) {
        $channels = array_values(array_diff($channels, ['email']));
        if (!$channels) $channels = ['inapp', 'vk_wall'];
    }
    // Пост результатов — ТОЛЬКО для длинных конкурсов (по коротким результат уходит на почту).
    if ($wave === 'results' && !vkt_is_long($c)) {
        return ['ok' => false, 'msg' => 'Пост результатов — только для длинных конкурсов. По коротким платным результаты приходят на почту в течение 5 рабочих дней, отдельный пост не публикуется.'];
    }

    // Сводные волны (запуск/3 дня/последний/закрыт) — ОДИН пост/письмо по всем открытым
    // конкурсам. Одиночная — только «результаты» (по конкретному длинному конкурсу).
    $siblings = in_array($wave, ['launch', 'd3', 'last', 'closed'], true) ? launch_open_comps() : [$c];

    // Планирование на будущее.
    $when = trim($when);
    if ($when !== '' && !$dry) {
        $ts = strtotime(str_replace('T', ' ', $when));
        if ($ts && $ts > time() + 60) {
            $runAt = date('Y-m-d H:i:s', $ts);
            insert('launch_jobs', [
                'competition_id' => $compId, 'wave' => $wave,
                'channels' => implode(',', $channels), 'run_at' => $runAt, 'status' => 'scheduled',
            ]);
            return ['ok' => true, 'scheduled' => true, 'msg' => 'Запланировано на ' . date('d.m.Y H:i', $ts) . ' (МСК).'];
        }
    }

    $text  = launch_wave_text($c, $wave, $siblings);
    $cover = launch_cover_path($c);
    $report = [];

    // ---- ВК стена + сторис ----
    if (in_array('vk_wall', $channels, true)) {
        if ($dry) {
            $report['vk_wall'] = 'постим на стену' . ($cover ? ' + афиша + сторис' : ' (без афиши)') . ', ' . mb_strlen($text) . ' симв.';
        } else {
            $r = $cover ? vk_wall_post_with_photo($text, $cover) : vk_wall_post($text);
            $ok = empty($r['error']);
            $report['vk_wall'] = $ok ? 'опубликовано на стене' : ('ошибка: ' . ($r['error']['error_msg'] ?? '?'));
            if ($ok && $cover) { $s = vk_story_photo($cover, url('/competition/' . (string) $c['slug'])); $report['vk_story'] = empty($s['error']) ? 'сторис опубликована' : ('сторис: ' . ($s['error']['error_msg'] ?? '?')); }
        }
    }
    // ---- ВК рассылка в личку ----
    if (in_array('vk_dm', $channels, true)) {
        if ($dry) { $report['vk_dm'] = 'рассылка в открытые диалоги (пачками)'; }
        else { $r = function_exists('vk_broadcast') ? vk_broadcast($text) : ['error' => ['error_msg' => 'vk_broadcast нет']]; $report['vk_dm'] = empty($r['error']) ? ('отправлено: ' . (int) ($r['sent'] ?? $r['count'] ?? 0)) : ('ошибка: ' . ($r['error']['error_msg'] ?? '?')); }
    }
    // ---- Email по базе (прогрев) ----
    if (in_array('email', $channels, true)) {
        $subj = launch_email_subject($c, $wave);
        if ($dry) { $report['email'] = 'newsletter «' . $subj . '» → прогрев-очередь (60→480/день)'; }
        else {
            try {
                $nid = insert('newsletters', ['subject' => $subj, 'body' => launch_email_html($c, $wave, $siblings), 'audience' => 'all', 'status' => 'draft']);
                $queued = function_exists('newsletter_enqueue') ? newsletter_enqueue((int) $nid) : 0;
                $report['email'] = 'в очередь поставлено писем: ' . (int) $queued;
            } catch (\Throwable $e) { $report['email'] = 'ошибка: ' . $e->getMessage(); }
        }
    }
    // ---- In-app всем ----
    if (in_array('inapp', $channels, true)) {
        [$t, $b, $u] = launch_inapp_payload($c, $wave);
        if ($dry) { $report['inapp'] = 'уведомление всем активным пользователям'; }
        else { $n = launch_notify_all($t, $b, $u, 'trophy'); $report['inapp'] = 'уведомлено пользователей: ' . $n; }
    }

    if (!$dry && function_exists('audit')) audit('launch_fire', 'competition', $compId, ['wave' => $wave, 'channels' => $channels, 'report' => $report]);
    return ['ok' => true, 'scheduled' => false, 'report' => $report, 'msg' => $dry ? 'Предпросмотр (ничего не отправлено).' : 'Запущено.'];
}

/* =====================================================================
 *  ОБЩИЙ ПУЛЬТ ЗАПУСКА (по всем конкурсам сразу) — планирование и авто-закрытие.
 *  Ничего не публикуется само по себе: посты уходят ТОЛЬКО по расписанию,
 *  которое оргкомитет явно создаёт кнопкой «Запланировать всё» в разделе «Запуск».
 * ===================================================================== */

/** Дата/время в рабочем окне: воскресенье → переносим на понедельник, время сохраняем. */
function launch_workday_at(int $y, int $m, int $d, int $hh, int $mi): string {
    $t = new \DateTime(sprintf('%04d-%02d-%02d %02d:%02d:00', $y, $m, $d, $hh, $mi));
    while ((int) $t->format('w') === 0) { $t->modify('+1 day'); }   // вс — нерабочий
    return $t->format('Y-m-d H:i:s');
}

/** Дата запуска по умолчанию: 1-е число (если вс — 2-е). Если 1-е уже прошло — след. месяц. */
function launch_default_date(): string {
    $now = new \DateTime('now');
    $y = (int) $now->format('Y'); $m = (int) $now->format('n'); $d = (int) $now->format('j');
    if ($d > 1) { $m++; if ($m > 12) { $m = 1; $y++; } }
    $t = new \DateTime(sprintf('%04d-%02d-01 00:00:00', $y, $m));
    if ((int) $t->format('w') === 0) $t->modify('+1 day');          // 1-е вс → 2-е
    return $t->format('Y-m-d');
}

/**
 * Запланировать ПОЛНЫЙ запуск: волна launch по всем открытым конкурсам на выбранные
 * дату/время (приведённые к рабочему слоту) + общие посты d3/last/closed по месяцу запуска
 * (22 09:00 «осталось 3 дня», 25 09:00 «последний день», 25 18:00 «приём закрыт»).
 * Предыдущий незавершённый план отменяется.
 */
function launch_schedule_all(string $launchDate, string $launchTime, array $channels): array {
    launch_migrate();
    $channels = array_values(array_intersect($channels, array_keys(launch_channels())));
    if (!$channels) return ['ok' => false, 'msg' => 'Не выбран ни один канал'];
    $comps = launch_open_comps();
    if (!$comps) return ['ok' => false, 'msg' => 'Нет открытых конкурсов (status=open) для запуска'];

    q("UPDATE launch_jobs SET status='cancelled' WHERE status='scheduled'");

    // Время запуска → ближайший рабочий слот (ночь/вс → 09:0x ближайшего рабочего дня).
    $lt = strtotime($launchDate . ' ' . ($launchTime ?: '09:00'));
    if (!$lt) $lt = time();
    $fromDt = (new \DateTime())->setTimestamp($lt);
    $slot = function_exists('next_working_slot') ? next_working_slot($fromDt) : $fromDt;
    $runLaunch = $slot->format('Y-m-d H:i:s');

    // ЗАПУСК — ОДНО общее письмо/пост по всем открытым конкурсам (не по каждому отдельно).
    // Представитель — первый открытый конкурс; сводная волна сама агрегирует все.
    $rep = (int) $comps[0]['id'];
    insert('launch_jobs', ['competition_id' => $rep, 'wave' => 'launch',
        'channels' => implode(',', $channels), 'run_at' => $runLaunch, 'status' => 'scheduled']);

    // Общие волны — по месяцу запуска.
    $ly = (int) date('Y', $lt); $lm = (int) date('n', $lt);
    $d3     = launch_workday_at($ly, $lm, 22, 9, 0);
    $last   = launch_workday_at($ly, $lm, 25, 9, 0);
    $closed = launch_workday_at($ly, $lm, 25, 18, 0);
    insert('launch_jobs', ['competition_id' => $rep, 'wave' => 'd3',     'channels' => implode(',', $channels), 'run_at' => $d3,     'status' => 'scheduled']);
    insert('launch_jobs', ['competition_id' => $rep, 'wave' => 'last',   'channels' => implode(',', $channels), 'run_at' => $last,   'status' => 'scheduled']);
    insert('launch_jobs', ['competition_id' => $rep, 'wave' => 'closed', 'channels' => implode(',', $channels), 'run_at' => $closed, 'status' => 'scheduled']);

    if (function_exists('audit')) audit('launch_plan', 'competition', 0,
        ['launch' => $runLaunch, 'd3' => $d3, 'last' => $last, 'closed' => $closed, 'comps' => count($comps), 'channels' => $channels]);
    return ['ok' => true, 'scheduled' => [
        'launch' => ['count' => 1, 'comps' => count($comps), 'run_at' => $runLaunch],
        'd3' => $d3, 'last' => $last, 'closed' => $closed,
    ]];
}

/** Отменить весь текущий план (незавершённые задания). */
function launch_cancel_all(): int {
    launch_migrate();
    $n = (int) scalar("SELECT COUNT(*) FROM launch_jobs WHERE status='scheduled'");
    q("UPDATE launch_jobs SET status='cancelled' WHERE status='scheduled'");
    if ($n && function_exists('audit')) audit('launch_plan_cancel', 'competition', 0, ['count' => $n]);
    return $n;
}

/**
 * Авто-закрытие приёма заявок (вызывается при выполнении волны 'closed', т.е. 25-е 18:00).
 * Открытые конкурсы → status='closed' (уходят с афиши и из календаря, приём прекращается).
 * Ставим флаг для публичного окна «новые конкурсы с 1 числа».
 */
function launch_close_intake(): void {
    foreach (launch_open_comps() as $c) {
        update('competitions', ['status' => 'closed'], 'id=:id', ['id' => (int) $c['id']]);
    }
    if (function_exists('set_setting')) {
        set_setting('intake_closed', '1');
        set_setting('intake_closed_at', date('Y-m-d H:i:s'));
        // Дата следующего открытия — 1-е следующего месяца (для текста окна).
        set_setting('intake_reopen_date', launch_default_date());
    }
    if (function_exists('audit')) audit('intake_closed', 'competition', 0, []);
}

/**
 * Cron: выполнить наступившие запланированные запуски — С ЗАЩИТОЙ РАБОЧЕГО ВРЕМЕНИ.
 * Посты уходят только в окне 09:00–18:00 и не в воскресенье. Если задание «просрочено»
 * в нерабочее время (ночь/вс) — оно НЕ теряется и НЕ шлётся ночью, а ждёт ближайшего
 * рабочего момента (страховка от случайной ночной публикации). Возвращает число выполненных.
 */
/**
 * ВСТРОЕННЫЙ пульт запуска (без модалок) — рендерится прямо внизу раздела «Конкурсы».
 * Все тексты волн видны сразу в textarea (сервер уже подставил текст), редактируются на
 * месте, сохраняются/сбрасываются инлайн. Афиша, дата/время, каналы, предпросмотр письма,
 * планирование и отмена — тут же. После запуска показывается запланированное/выполненное.
 * Все AJAX уходят на ?p=launch (обработчики в admin/launch.php). $postUrl передаётся сам.
 */
function launch_panel_html(): string {
    launch_migrate();
    $openComps = launch_open_comps();
    $channels  = launch_channels();
    $defDate   = (string) (function_exists('setting') ? setting('launch_plan_date', launch_default_date()) : launch_default_date());
    $defTime   = (string) (function_exists('setting') ? setting('launch_plan_time', '09:00') : '09:00');
    $savedCh   = array_filter(explode(',', (string) (function_exists('setting') ? setting('launch_plan_channels', 'vk_wall,email,inapp') : 'vk_wall,email,inapp')));
    if (!$savedCh) $savedCh = ['vk_wall', 'email', 'inapp'];
    $jobs = all("SELECT j.*, c.name comp FROM launch_jobs j LEFT JOIN competitions c ON c.id=j.competition_id
                 WHERE j.status IN ('scheduled','done') ORDER BY j.run_at ASC LIMIT 200");
    $sched = array_values(array_filter($jobs, fn($j) => $j['status'] === 'scheduled'));
    $doneJobs = array_values(array_filter($jobs, fn($j) => $j['status'] === 'done'));
    $waveShort = ['launch' => 'Открытие', 'd3' => '3 дня', 'last' => 'Последний', 'closed' => 'Закрыт', 'results' => 'Результаты'];
    $post = url('/admin/?p=launch');

    $coverUrl = static function (array $c): string {
        $cv = trim((string) ($c['cover'] ?? ''));
        if ($cv === '') return '';
        return preg_match('~^https?://~i', $cv) ? $cv : url('/' . ltrim($cv, '/'));
    };

    // Один инлайн-редактор текста волны (textarea + Сохранить/Сбросить + предпросмотр письма).
    $editor = function (int $cid, string $wave, string $title, string $text, string $cover = '', bool $email = false) use ($post): string {
        $tid = 'lw_' . $cid . '_' . $wave;
        ob_start(); ?>
        <div class="lp2-block" data-cid="<?= $cid ?>" data-wave="<?= h($wave) ?>">
          <div class="lp2-bh"><b><?= h($title) ?></b>
            <span class="lp2-state" id="st_<?= $tid ?>"></span></div>
          <div class="lp2-body">
            <?php if ($cover !== ''): ?><img class="lp2-cover" src="<?= h($cover) ?>" alt="Афиша" loading="lazy"><?php endif; ?>
            <textarea id="<?= $tid ?>" class="lp2-ta" rows="8"><?= h($text) ?></textarea>
          </div>
          <div class="lp2-acts">
            <button type="button" class="btn btn--primary btn--sm" data-lp2="save" data-t="<?= $tid ?>" data-id="<?= $cid ?>" data-wave="<?= h($wave) ?>">Сохранить текст</button>
            <button type="button" class="btn btn--ghost btn--sm" data-lp2="reset" data-t="<?= $tid ?>" data-id="<?= $cid ?>" data-wave="<?= h($wave) ?>">Сбросить к эталону</button>
            <?php if ($email): ?><a class="btn btn--ghost btn--sm" href="<?= h($post . '&do=email_preview&id=' . $cid . '&wave=' . $wave) ?>" target="_blank" rel="noopener">Предпросмотр письма</a><?php endif; ?>
          </div>
        </div>
        <?php return (string) ob_get_clean();
    };

    ob_start(); ?>
    <div class="lp2" data-post="<?= h($post) ?>" data-csrf="<?= h(csrf_token()) ?>">
      <div class="page-head" style="margin-bottom:8px"><h2 style="margin:0"><?= admin_icon('rocket') ?> Пульт запуска</h2>
        <p class="muted small" style="margin:4px 0 0">Всё видно сразу, редактируется на месте. Ничего не уходит раньше расписания и только в рабочее время (09:00–18:00, кроме вс). По умолчанию запуск — 1-е число (если вс → 2-е), общие посты 22 (09:00), 25 (09:00), 25 (18:00), результаты длинного — 28 (09:00). Если дата попадает на вс — сдвиг на день.</p>
      </div>

      <?php if (!$openComps): ?>
        <div class="card" style="padding:18px">Нет открытых конкурсов. Создайте/откройте конкурсы выше — и здесь автоматически появятся тексты постов и писем для запуска.</div>
      <?php else: ?>

      <?php if ($sched): ?>
      <div class="card" style="border-left:4px solid #1E9E5A">
        <h3 style="margin:0 0 8px">Запланировано — панель управления</h3>
        <table class="a-table" style="width:100%"><thead><tr><th>Когда (МСК)</th><th>Волна</th><th>Конкурс</th><th>Каналы</th></tr></thead><tbody>
          <?php foreach ($sched as $j): ?>
            <tr><td><b><?= h(date('d.m.Y H:i', strtotime((string) $j['run_at']))) ?></b></td>
              <td><?= h($waveShort[$j['wave']] ?? $j['wave']) ?></td>
              <td><?= h((string) ($j['comp'] ?? '—')) ?></td>
              <td class="small muted"><?= h((string) $j['channels']) ?></td></tr>
          <?php endforeach; ?>
        </tbody></table>
        <div style="margin-top:10px"><button type="button" class="btn btn--ghost btn--sm" data-lp2="cancel" style="color:#B23B3B;border-color:#d99">Отменить весь план</button></div>
      </div>
      <?php endif; ?>

      <?php if ($doneJobs): ?>
      <div class="card">
        <h3 style="margin:0 0 8px">Уже опубликовано</h3>
        <table class="a-table" style="width:100%"><thead><tr><th>Когда</th><th>Волна</th><th>Конкурс</th></tr></thead><tbody>
          <?php foreach (array_slice(array_reverse($doneJobs), 0, 30) as $j): ?>
            <tr><td><?= h(date('d.m H:i', strtotime((string) ($j['done_at'] ?: $j['run_at'])))) ?></td>
              <td><?= h($waveShort[$j['wave']] ?? $j['wave']) ?></td>
              <td><?= h((string) ($j['comp'] ?? '—')) ?></td></tr>
          <?php endforeach; ?>
        </tbody></table>
      </div>
      <?php endif; ?>

      <div class="card">
        <h3 style="margin:0 0 12px">План запуска</h3>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">
          <label class="small muted">Дата запуска<br><input type="date" id="lp2Date" value="<?= h($defDate) ?>" style="display:block;margin-top:4px;padding:8px 10px;border:1px solid #d7ddea;border-radius:10px"></label>
          <label class="small muted">Время (МСК)<br><input type="time" id="lp2Time" value="<?= h($defTime) ?>" style="display:block;margin-top:4px;padding:8px 10px;border:1px solid #d7ddea;border-radius:10px"></label>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
          <?php foreach ($channels as $ck => $cl): ?>
            <label class="lp2-chip"><input type="checkbox" class="lp2Ch" value="<?= h($ck) ?>" <?= in_array($ck, $savedCh, true) ? 'checked' : '' ?>> <?= h($cl) ?></label>
          <?php endforeach; ?>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn btn--ghost btn--sm" data-lp2="preview"><?= admin_icon('eye') ?>Предпросмотр (dry-run)</button>
          <button type="button" class="btn btn--primary" data-lp2="schedule"><?= admin_icon('clock') ?>Запланировать всё</button>
        </div>
        <div id="lp2Msg" class="lp2-msg" hidden></div>
        <div id="lp2Prev" class="lp2-prev" hidden></div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 4px">Тексты постов и писем</h3>
        <p class="small muted" style="margin:0 0 14px">Всё уже составлено по эталонам — правьте и сохраняйте. Изменённый текст уйдёт при запуске.</p>

        <?php $rep = (int) $openComps[0]['id']; ?>
        <div class="lp2-group-t">Открытие — отдельный пост по каждому конкурсу (публикуется при запуске)</div>
        <?php foreach ($openComps as $c):
            echo $editor((int) $c['id'], 'launch', 'Открытие «' . $c['name'] . '»',
                launch_wave_text($c, 'launch', [$c]), $coverUrl($c), true);
        endforeach; ?>

        <div class="lp2-group-t" style="margin-top:18px">Общие посты по всем конкурсам</div>
        <?php
        $sib = $openComps;
        $repComp = launch_norm_comp($openComps[0]);
        echo $editor($rep, 'd3', 'Осталось 3 дня (22-е, 09:00)', launch_wave_text($repComp, 'd3', $sib));
        echo $editor($rep, 'last', 'Последний день (25-е, 09:00)', launch_wave_text($repComp, 'last', $sib));
        echo $editor($rep, 'closed', 'Приём закрыт (25-е, 18:00)', launch_wave_text($repComp, 'closed', $sib));
        ?>

        <?php $longComps = array_values(array_filter($openComps, fn($c) => function_exists('vkt_is_long') && vkt_is_long($c))); ?>
        <?php if ($longComps): ?>
          <div class="lp2-group-t" style="margin-top:18px">Результаты длинного конкурса (28-е, 09:00) — список, афиша, файл, ссылки</div>
          <?php foreach ($longComps as $c) {
              echo $editor((int) $c['id'], 'results', 'Результаты «' . $c['name'] . '»',
                  launch_wave_text($c, 'results', [$c]), $coverUrl($c), true);
          } ?>
        <?php endif; ?>
      </div>

      <?php endif; /* openComps */ ?>
    </div>

    <style>
    .lp2 .card{margin-bottom:16px}
    .lp2-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid #d7ddea;border-radius:999px;font-size:.85rem;cursor:pointer}
    .lp2-msg{margin-top:12px;padding:10px 14px;border-radius:10px;font-size:.9rem}
    .lp2-msg.ok{background:#E7F7EE;color:#1E7A44}.lp2-msg.err{background:#FDECEC;color:#B23B3B}
    .lp2-prev{margin-top:12px;font-size:.85rem;line-height:1.6;color:#445;background:#F7F9FF;border:1px solid #E3E9F7;border-radius:10px;padding:12px 14px;white-space:pre-wrap}
    .lp2-block{border:1px solid #E6E9F2;border-radius:14px;padding:12px 14px;margin:0 0 12px;background:#FCFDFF}
    .lp2-bh{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .lp2-bh b{color:#17307A}
    .lp2-state{font-size:12px;color:#1E7A44}
    .lp2-body{display:flex;gap:12px;align-items:flex-start}
    .lp2-cover{width:120px;height:auto;border-radius:10px;border:1px solid #E6E9F2;flex:none}
    .lp2-ta{flex:1;min-width:0;width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d7ddea;border-radius:10px;font:inherit;font-size:.9rem;line-height:1.55;resize:vertical}
    .lp2-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .lp2-group-t{font-size:.8rem;letter-spacing:.05em;text-transform:uppercase;color:#889;margin:0 0 10px;font-weight:700}
    @media(max-width:640px){.lp2-body{flex-direction:column}.lp2-cover{width:100%;max-width:220px}}
    [data-theme=dark] .lp2-block{background:#151a29;border-color:#2a3150}
    [data-theme=dark] .lp2-ta,[data-theme=dark] .lp2-chip{background:#171b2b;border-color:#2b3350;color:#e6ecff}
    </style>

    <script>
    (function(){
     try{
      var root=document.querySelector('.lp2'); if(!root) return;
      var POST=root.getAttribute('data-post'), CSRF=root.getAttribute('data-csrf');
      var $=function(id){return document.getElementById(id);};
      function post(data){ data._csrf=CSRF; return fetch(POST,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},credentials:'same-origin',body:new URLSearchParams(data)}).then(function(r){return r.json();}); }
      function chans(){ return Array.prototype.map.call(root.querySelectorAll('.lp2Ch:checked'),function(c){return c.value;}).join(','); }
      var msg=$('lp2Msg'), prev=$('lp2Prev');
      function showMsg(t,ok){ if(!msg)return; msg.textContent=t; msg.className='lp2-msg '+(ok?'ok':'err'); msg.hidden=false; }
      root.addEventListener('click', function(e){
        var b=e.target.closest('[data-lp2]'); if(!b) return;
        var act=b.getAttribute('data-lp2');
        if(act==='save'){
          var ta=$(b.getAttribute('data-t')); if(!ta) return;
          var stEl=$('st_'+b.getAttribute('data-t'));
          post({do:'save',id:b.getAttribute('data-id'),wave:b.getAttribute('data-wave'),text:ta.value}).then(function(d){
            if(stEl){ stEl.textContent=d.ok?(d.is_custom?'✎ свой текст сохранён':'эталон'):(d.msg||'ошибка'); stEl.style.color=d.ok?'#1E7A44':'#B23B3B'; }
          }).catch(function(){ if(stEl){stEl.textContent='ошибка сети'; stEl.style.color='#B23B3B';} });
        } else if(act==='reset'){
          if(!confirm('Вернуть эталонный текст?')) return;
          post({do:'save',id:b.getAttribute('data-id'),wave:b.getAttribute('data-wave'),text:''}).then(function(d){
            if(d.ok) location.reload();
          }).catch(function(){});
        } else if(act==='preview'){
          var ch=chans(); if(!ch){showMsg('Выберите хотя бы один канал.',false);return;}
          if(prev){prev.hidden=false;prev.textContent='Считаю…';}
          post({do:'preview',channels:ch}).then(function(d){
            if(!d.ok){if(prev)prev.hidden=true;showMsg(d.msg||'Ошибка',false);return;}
            if(prev)prev.textContent=(d.lines||[]).join('\n');
          }).catch(function(){showMsg('Ошибка сети.',false);});
        } else if(act==='schedule'){
          var ch2=chans(); if(!ch2){showMsg('Выберите хотя бы один канал.',false);return;}
          var dE=$('lp2Date'), tE=$('lp2Time');
          if(!confirm('Запланировать запуск на '+(dE?dE.value:'')+' '+(tE?tE.value:'')+' МСК и общие посты? Раньше расписания ничего не уйдёт.')) return;
          post({do:'schedule',date:dE?dE.value:'',time:tE?tE.value:'',channels:ch2}).then(function(d){
            if(!d.ok){showMsg(d.msg||'Ошибка',false);return;}
            showMsg((d.msg||'Запланировано')+' Обновляю…',true); setTimeout(function(){location.reload();},900);
          }).catch(function(){showMsg('Ошибка сети.',false);});
        } else if(act==='cancel'){
          if(!confirm('Отменить весь запланированный план?')) return;
          post({do:'cancel'}).then(function(d){ showMsg(d.msg||'Отменено',true); setTimeout(function(){location.reload();},900); }).catch(function(){});
        }
      });
     }catch(err){ try{ var w=document.createElement('div'); w.style.cssText='margin:12px;padding:10px 14px;border-radius:10px;background:#FDECEC;color:#B23B3B'; w.textContent='Пульт: '+(err&&err.message||err); (document.querySelector('.lp2')||document.body).appendChild(w);}catch(e){} }
    })();
    </script>
    <?php
    return (string) ob_get_clean();
}

function launch_run_due(): int {
    launch_migrate();
    $now = new \DateTime('now');
    $h = (int) $now->format('G');
    $isSunday = ((int) $now->format('w') === 0);
    // Рабочее окно 09:00–18:00 включительно (18:00 — момент закрытия приёма).
    $inWindow = (!$isSunday && $h >= 9 && $h <= 18);
    if (!$inWindow) return 0;   // вне рабочего окна ничего не публикуем

    $due = all("SELECT * FROM launch_jobs WHERE status='scheduled' AND run_at <= ? ORDER BY run_at ASC", [$now->format('Y-m-d H:i:s')]);
    $done = 0;
    foreach ($due as $j) {
        $wave = (string) $j['wave'];
        $channels = array_filter(array_map('trim', explode(',', (string) $j['channels'])));
        $res = launch_fire((int) $j['competition_id'], $wave, $channels, '', false);
        update('launch_jobs', [
            'status' => 'done', 'done_at' => $now->format('Y-m-d H:i:s'),
            'report' => json_encode($res['report'] ?? [], JSON_UNESCAPED_UNICODE),
        ], 'id=:id', ['id' => (int) $j['id']]);
        // Волна «приём закрыт» → авто-закрытие приёма заявок и афиш.
        if ($wave === 'closed') { try { launch_close_intake(); } catch (\Throwable $e) { error_log('launch_close_intake: ' . $e->getMessage()); } }
        $done++;
    }
    return $done;
}
