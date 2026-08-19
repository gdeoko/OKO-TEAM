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
// Одна проверка «когда наружу можно» на все каналы: пульт публикует стену ВК,
// сторис и личку, и правило владельца должно действовать и здесь.
if (is_file(__DIR__ . '/outreach_window.php')) require_once __DIR__ . '/outreach_window.php';

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

/**
 * Абсолютный путь к афише поста (для ВК-фото/сторис) или ''.
 *  1) если админ загрузил свою афишу для этой волны (settings.launch_cover:{cid}:{wave}) — она;
 *  2) для общих постов (d3/last/closed) и результатов — авто-композит (launch_poster);
 *  3) иначе — афиша самого конкурса (cover).
 */
function launch_cover_path(array $c, string $wave = '', array $siblings = []): string {
    $cid = (int) ($c['id'] ?? 0);
    // 1) Пользовательский оверрайд афиши для этой волны.
    if ($wave !== '' && function_exists('setting')) {
        $ov = trim((string) setting('launch_cover:' . $cid . ':' . $wave, ''));
        if ($ov === '__none__') return '';               // афишу явно удалили
        if ($ov !== '') {
            $op = BASE_PATH . '/public/' . ltrim(preg_replace('~^https?://[^/]+~i', '', $ov), '/');
            if (is_file($op)) return $op;
        }
    }
    // 2) Общие посты и результаты — композит с текстом (если получилось собрать).
    if (in_array($wave, ['d3', 'last', 'closed', 'results'], true)) {
        if (!function_exists('launch_poster') && is_file(BASE_PATH . '/core/launch_poster.php')) require_once BASE_PATH . '/core/launch_poster.php';
        if (function_exists('launch_poster')) {
            $comps = in_array($wave, ['d3', 'last', 'closed'], true) ? ($siblings ?: launch_open_comps()) : [$c];
            $extra = $wave === 'results' ? (string) ($c['name'] ?? '') : '';
            $poster = launch_poster($wave, $comps, $extra);
            if ($poster) return $poster;
        }
    }
    // 3) Афиша конкурса.
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
    // Клуб постоянных участников живёт на /club. Раньше здесь стоял url('/vip') —
    // такого роута в public/index.php нет, страница отдавала 404. Кнопка «ВИП-клуб»
    // есть в КАЖДОМ письме запуска (кроме результатов), то есть в волне на всю базу
    // 8286 подписчиков ссылка вела в никуда.
    $vipUrl     = url('/club');

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

/** Тип кампании письма по волне (konkurs|vip|kabinet). */
function launch_email_ctype(string $wave): string {
    if ($wave === 'campaign_vip') return 'vip';
    if ($wave === 'campaign_kabinet') return 'kabinet';
    return 'konkurs';
}

/**
 * Красивое письмо кампании с переопределениями из пульта запуска.
 * $ctype: konkurs (все конкурсы в одном письме) | vip (ВИП-клуб). Возвращает [subject, body].
 * (kabinet идёт отдельным персональным онбордингом с логином/паролем — не через этот билдер.)
 */
function launch_email_build(string $ctype): array {
    if (!function_exists('campaign_build') && is_file(BASE_PATH . '/core/mail_campaigns.php')) require_once BASE_PATH . '/core/mail_campaigns.php';
    $key  = $ctype === 'vip' ? 'vip' : 'new_competitions';
    $subj = function_exists('setting') ? (string) setting('launch_mail_subject:' . $ctype, '') : '';
    // Визуально отредактированное в пульте тело письма (contenteditable) — приоритетнее шаблона.
    $ovHtml = function_exists('setting') ? (string) setting('launch_mail_html:' . $ctype, '') : '';
    if (trim($ovHtml) !== '') {
        if (trim($subj) === '') { $b0 = function_exists('campaign_build') ? campaign_build($key) : ['subject' => 'Культурный центр «Музыкальный Мир»']; $subj = (string) $b0['subject']; }
        return [$subj, $ovHtml];
    }
    $opt = [];
    $lead = function_exists('setting') ? (string) setting('launch_mail_lead:' . $ctype, '') : '';
    if (trim($subj) !== '') $opt['subject'] = $subj;
    if (trim($lead) !== '') $opt['lead'] = $lead;
    $b = function_exists('campaign_build') ? campaign_build($key, $opt) : ['subject' => 'Культурный центр «Музыкальный Мир»', 'body' => ''];
    return [(string) $b['subject'], (string) $b['body']];
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
            created_at TEXT DEFAULT (datetime('now','localtime')),
            done_at TEXT
        )");
    } catch (\Throwable $e) {}
    // started_at — момент атомарного захвата задания планировщиком (см. launch_run_due()).
    // Нужен, чтобы (а) второй крон не подхватил уже выполняющуюся волну,
    // (б) «зависшее» задание (процесс убит) можно было вернуть в очередь через 30 минут.
    try {
        $cols = [];
        foreach (all("PRAGMA table_info(launch_jobs)") as $r) $cols[] = (string) ($r['name'] ?? '');
        if (!in_array('started_at', $cols, true)) db()->exec("ALTER TABLE launch_jobs ADD COLUMN started_at TEXT");
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
    // Колонка типа кампании нужна до INSERT в newsletters (квоты konkurs/vip/kabinet).
    if (!function_exists('nl_ensure_campaign_type_col') && is_file(BASE_PATH . '/core/newsletter.php')) require_once BASE_PATH . '/core/newsletter.php';
    if (function_exists('nl_ensure_campaign_type_col')) nl_ensure_campaign_type_col();
    $c = one("SELECT * FROM competitions WHERE id=?", [$compId]);
    if (!$c) return ['ok' => false, 'msg' => 'Конкурс не найден'];
    $c = launch_norm_comp($c);
    $channels = array_values(array_intersect($channels, array_keys(launch_channels())));
    if (!$channels) return ['ok' => false, 'msg' => 'Не выбран ни один канал'];
    // Внутренние (не редактируемые в пульте) волны запуска:
    //   launch_vk       — ПЕРСОНАЛЬНЫЙ пост ВК по каждому конкурсу (стена+сторис, своя афиша);
    //   launch_mail      — ОБЩЕЕ письмо-открытие по всем конкурсам (4 афиши в одном письме) + in-app;
    //   campaign_vip     — письмо-приглашение в ВИП-клуб (аудитория ВИП, своя квота);
    //   campaign_kabinet — письмо о возможностях личного кабинета (аудитория зарег. пользователей).
    $internalWaves = ['launch_vk', 'launch_mail', 'campaign_vip', 'campaign_kabinet'];
    if (!isset(launch_waves()[$wave]) && !in_array($wave, $internalWaves, true)) return ['ok' => false, 'msg' => 'Неизвестная волна'];
    // Правило владельца: «осталось 3 дня / последний день / приём закрыт» НЕ идут на почту —
    // только in-app всем + пост ВКонтакте (с авто-сторис) + рассылка в личку. На почту идёт
    // только открытие конкурсов и ВИП-клуб (и результаты длинного — участникам).
    if (in_array($wave, ['d3', 'last', 'closed'], true)) {
        $channels = array_values(array_diff($channels, ['email']));
        if (!$channels) $channels = ['inapp', 'vk_wall'];
    }
    // launch_vk — только ВК (стена/сторис/личка), по конкретному конкурсу.
    if ($wave === 'launch_vk') {
        $channels = array_values(array_intersect($channels, ['vk_wall', 'vk_dm'])) ?: ['vk_wall'];
    }
    // launch_mail — общее письмо + in-app (ВК идёт отдельными персональными постами launch_vk).
    if ($wave === 'launch_mail') {
        $channels = array_values(array_intersect($channels, ['email', 'inapp'])) ?: ['email', 'inapp'];
    }
    // campaign_* — только e-mail по своей аудитории.
    if ($wave === 'campaign_vip' || $wave === 'campaign_kabinet') {
        $channels = ['email'];
    }
    // Пост результатов — ТОЛЬКО для длинных конкурсов (по коротким результат уходит на почту).
    if ($wave === 'results' && !vkt_is_long($c)) {
        return ['ok' => false, 'msg' => 'Пост результатов — только для длинных конкурсов. По коротким платным результаты приходят на почту в течение 5 рабочих дней, отдельный пост не публикуется.'];
    }

    // Сводные волны (запуск/3 дня/последний/закрыт) — ОДИН пост/письмо по всем открытым
    // конкурсам. Персональные (launch_vk/результаты/campaign_*) — по конкретному конкурсу.
    $siblings = in_array($wave, ['launch', 'launch_mail', 'd3', 'last', 'closed'], true) ? launch_open_comps() : [$c];
    // Ключ шаблонов текста/афиши: launch_vk использует эталоны «launch», но с одним конкурсом.
    $tplWave = ($wave === 'launch_vk') ? 'launch' : $wave;

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

    $text  = launch_wave_text($c, $tplWave, $siblings);
    $cover = launch_cover_path($c, $tplWave, $siblings);
    $report = [];

    // ---- ВК стена + сторис ----
    if (in_array('vk_wall', $channels, true)) {
        if ($dry) {
            $report['vk_wall'] = 'постим на стену' . ($cover ? ' + афиша + сторис' : ' (без афиши)') . ', ' . mb_strlen($text) . ' симв.';
        } else {
            $r = $cover ? vk_wall_post_with_photo($text, $cover) : vk_wall_post($text);
            $ok = empty($r['error']);
            // Афиша обязательна: если она не приложилась, это должно быть ВИДНО в отчёте,
            // а не выясняться потом по пустому посту в сообществе.
            $noPhoto = !empty($r['photo_missing']);
            $report['vk_wall'] = $ok
                ? ('опубликовано на стене' . ($noPhoto ? ' — БЕЗ АФИШИ: ' . (string) ($r['photo_error'] ?? '') . ' (приложить вручную)' : ''))
                : ('ошибка: ' . ($r['error']['error_msg'] ?? '?'));
            if ($ok && $cover) { $s = vk_story_photo($cover, url('/competition/' . (string) $c['slug'])); $report['vk_story'] = empty($s['error']) ? 'сторис опубликована' : ('сторис: ' . ($s['error']['error_msg'] ?? '?')); }
        }
    }
    // ---- ВК рассылка в личку ----
    if (in_array('vk_dm', $channels, true)) {
        if ($dry) { $report['vk_dm'] = 'рассылка в открытые диалоги (пачками)'; }
        else { $r = function_exists('vk_broadcast') ? vk_broadcast($text) : ['error' => ['error_msg' => 'vk_broadcast нет']]; $report['vk_dm'] = empty($r['error']) ? ('отправлено: ' . (int) ($r['sent'] ?? $r['count'] ?? 0)) : ('ошибка: ' . ($r['error']['error_msg'] ?? '?')); }
    }
    // ---- Email ----
    if (in_array('email', $channels, true)) {
        if ($wave === 'results') {
            // РЕЗУЛЬТАТЫ ДЛИННОГО: на почту — ПЕРСОНАЛЬНОЕ письмо КАЖДОМУ участнику
            // (результат + заявка + кнопки + вложение списка), НЕ 1:1 с ВК-постом.
            if ($dry) {
                $cnt = (int) scalar("SELECT COUNT(*) FROM applications WHERE competition_id=? AND COALESCE(result,'')<>''", [$compId]);
                $report['email'] = 'персональные письма участникам: ' . $cnt . ' (результат+заявка+кнопки+файл списка)';
            } else {
                if (!function_exists('results_long_mail_send') && is_file(BASE_PATH . '/core/result_mail.php')) require_once BASE_PATH . '/core/result_mail.php';
                // Файл списка результатов (DOCX) — во вложение + публичная ссылка на кнопку.
                $docxAbs = ''; $docxUrl = '';
                try {
                    if (is_file(BASE_PATH . '/core/results_doc.php')) require_once BASE_PATH . '/core/results_doc.php';
                    if (function_exists('results_docx')) {
                        $tmp = results_docx($compId);
                        if ($tmp && is_file($tmp)) {
                            $pubDir = BASE_PATH . '/public/uploads/launch/';
                            if (!is_dir($pubDir)) @mkdir($pubDir, 0775, true);
                            $pubName = 'results_' . $compId . '.docx';
                            if (@copy($tmp, $pubDir . $pubName)) { $docxAbs = $pubDir . $pubName; $docxUrl = url('/uploads/launch/' . $pubName); }
                            else { $docxAbs = $tmp; }
                        }
                    }
                } catch (\Throwable $e) {}
                $posterUrl = '';
                if ($cover !== '' && str_starts_with($cover, BASE_PATH . '/public')) $posterUrl = url(substr($cover, strlen(BASE_PATH . '/public')));
                $vkUrl = (string) cfgv('org_vk');
                $sent = 0;
                if (function_exists('results_long_mail_send')) {
                    foreach (all("SELECT id FROM applications WHERE competition_id=? AND COALESCE(result,'')<>''", [$compId]) as $p) {
                        if (results_long_mail_send((int) $p['id'], $vkUrl, $docxAbs, $docxUrl, $posterUrl)) $sent++;
                    }
                }
                $report['email'] = 'персональных писем участникам: ' . $sent;
            }
        } elseif ($wave === 'campaign_kabinet') {
            // «Личный кабинет» — ПЕРСОНАЛЬНЫЙ онбординг: логин + временный пароль по эталону,
            // каждому свой (не одинаковое письмо). Идёт под квотой типа 'kabinet' (100/день).
            if (!function_exists('kabinet_onboarding_enqueue') && is_file(BASE_PATH . '/core/kabinet_onboarding.php')) require_once BASE_PATH . '/core/kabinet_onboarding.php';
            if ($dry) {
                $cnt = function_exists('kabinet_onboarding_pending') ? kabinet_onboarding_pending() : 0;
                $report['email'] = 'онбординг «личный кабинет» (логин+пароль) → адресов: ' . $cnt . ' (квота 100/день)';
            } else {
                $queued = function_exists('kabinet_onboarding_enqueue') ? kabinet_onboarding_enqueue() : 0;
                $report['email'] = 'онбординг «личный кабинет»: в очередь ' . (int) $queued;
            }
        } elseif ($wave === 'campaign_vip') {
            // ВИП-клуб — красивое письмо (как раздел сайта, без цен), аудитория ВИП, квота 100/день.
            [$vsubj, $vbody] = launch_email_build('vip');
            if ($dry) {
                $cnt = count(function_exists('nl_resolve_recipients') ? nl_resolve_recipients('vip') : []);
                $report['email'] = 'кампания «ВИП-клуб» → получателей: ' . $cnt . ' (квота 100/день)';
            } else {
                try {
                    $nid = insert('newsletters', ['subject' => $vsubj, 'body' => $vbody, 'audience' => 'vip', 'campaign_type' => 'vip', 'status' => 'draft']);
                    $queued = function_exists('newsletter_enqueue') ? newsletter_enqueue((int) $nid) : 0;
                    $report['email'] = 'кампания «ВИП-клуб»: в очередь ' . (int) $queued;
                } catch (\Throwable $e) { $report['email'] = 'ошибка: ' . $e->getMessage(); }
            }
        } else {
            // Открытие (launch/launch_mail) — ОДНО ОБЪЕДИНЁННОЕ письмо на человека:
            // конкурсы месяца + личный кабинет с логином/паролем (только тем, кто ни разу
            // не входил) + приглашение в клуб (только тем, кто не состоит).
            // Раньше это были три отдельные волны: 3 × 8200 = 24 600 писем, то есть больше
            // двух месяцев при квоте 400/день. Теперь 8200 — около 21 рабочего дня.
            if (!function_exists('launch_combo_enqueue')) require_once BASE_PATH . '/core/launch_combo.php';
            try {
                $res = launch_combo_enqueue($dry);
                $report['email'] = $dry
                    ? sprintf('объединённое письмо → получателей: %d (из них с доступом в кабинет: %d, с приглашением в клуб: %d), квота 400/день',
                              $res['queued'], $res['with_cabinet'], $res['with_vip'])
                    : sprintf('в очередь поставлено писем: %d (с доступом в кабинет: %d, с приглашением в клуб: %d)',
                              $res['queued'], $res['with_cabinet'], $res['with_vip']);
            } catch (\Throwable $e) { $report['email'] = 'ошибка: ' . $e->getMessage(); }
        }
    }
    // ---- In-app всем ----
    if (in_array('inapp', $channels, true)) {
        [$t, $b, $u] = launch_inapp_payload($c, $wave === 'launch_mail' ? 'launch' : $wave);
        if ($dry) { $report['inapp'] = 'уведомление всем активным пользователям'; }
        else { $n = launch_notify_all($t, $b, $u, 'trophy'); $report['inapp'] = 'уведомлено пользователей: ' . $n; }
    }

    // ВОЛНА «РЕЗУЛЬТАТЫ» — ОДИН РУБИЛЬНИК НА ВСЁ ОГЛАШЕНИЕ.
    //
    // Пост в сообществе вышел, персональные письма ушли — значит итоги оглашены, и
    // с этой секунды их можно показывать. Дата публикации хранится в
    // competitions.results_published_at, и по ней открываются сразу три места:
    // раздел «Результаты» на сайте, личный кабинет участника и чат-бот
    // (см. app_result_public_sql и core/chat_gate.php).
    //
    // Раньше эту дату не ставил никто, кроме кнопки «Опубликовать» в админке. То
    // есть 28-го числа участник получал письмо со своим званием, шёл на сайт — и
    // видел «результаты будут опубликованы», а бот отказывался их называть, пока
    // оргкомитет не вспомнит про кнопку. Теперь оглашение включает всё разом.
    if (!$dry && $wave === 'results') {
        foreach ($siblings as $sc) {
            if (!vkt_is_long($sc)) continue;
            if (trim((string) ($sc['results_published_at'] ?? '')) !== '') continue;
            update('competitions', ['results_published_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => (int) $sc['id']]);
            $report['site'] = 'раздел «Результаты» на сайте открыт, кабинет и чат-бот показывают итоги';
        }
    }

    // Волна «Открытие» — конкурс(ы) становятся видимыми на сайте (гейт запуска).
    if (!$dry && in_array($wave, ['launch', 'launch_mail', 'launch_vk'], true)) {
        $toShow = in_array($wave, ['launch_mail'], true) ? $siblings : [$c];
        foreach ($toShow as $sc) {
            update('competitions', ['launched' => 1, 'launched_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => (int) $sc['id']]);
        }
    }

    if (!$dry && function_exists('audit')) audit('launch_fire', 'competition', $compId, ['wave' => $wave, 'channels' => $channels, 'report' => $report]);
    return ['ok' => true, 'scheduled' => false, 'report' => $report, 'msg' => $dry ? 'Предпросмотр (ничего не отправлено).' : 'Запущено.'];
}

/* =====================================================================
 *  ОБЩИЙ ПУЛЬТ ЗАПУСКА (по всем конкурсам сразу) — планирование и авто-закрытие.
 *  Ничего не публикуется само по себе: посты уходят ТОЛЬКО по расписанию,
 *  которое оргкомитет явно создаёт кнопкой «Запланировать всё» в разделе «Запуск».
 * ===================================================================== */

/**
 * Дата/время волны запуска. Воскресенье сдвигается, но В РАЗНЫЕ СТОРОНЫ.
 *
 * Наружу в выходной ничего не идёт (core/outreach_window.php), поэтому воскресная
 * волна просто простояла бы сутки и ушла бы в понедельник вперемешку со следующей.
 * Сдвигать надо, а вот куда — зависит от того, что волна говорит участнику.
 *
 *   НАЗАД, В СУББОТУ ($shift='back') — предупреждения «осталось 3 дня» и
 *   «последний день». Сказать раньше срока не страшно: приём ещё идёт, человек
 *   успеет подать. Сказать позже — значит позвать в уже закрытый конкурс.
 *
 *   ВПЕРЁД, В ПОНЕДЕЛЬНИК ($shift='forward') — «приём закрыт» и «результаты».
 *   Объявить закрытие до закрытия или итоги до подведения нельзя вовсе.
 *
 * СДВИГ НЕ ВЫХОДИТ ЗА ГРАНИЦУ МЕСЯЦА. 28 февраля 2027 года — воскресенье, и
 * перенос вперёд поставил бы волну итогов на 1 марта. Оттуда её снял бы запуск
 * следующего месяца (launch_schedule_all чистит задания месяца и позже), а
 * страховочный cron/publish_results_vk.php перестал бы считать волну «своей»,
 * потому что сверяет месяц run_at с текущим, и опубликовал бы итоги сам — как
 * раз в воскресенье. Поэтому упёршись в границу месяца, двигаем в другую сторону.
 *
 * Рабочие дни остаются там, ради чего и написаны — сроки оценки и наградных
 * документов (st_is_workday / next_working_slot в core/send_timing.php).
 */
function launch_workday_at(int $y, int $m, int $d, int $hh, int $mi, string $shift = 'forward'): string {
    $t = new \DateTime(sprintf('%04d-%02d-%02d %02d:%02d:00', $y, $m, $d, $hh, $mi));
    if ((int) $t->format('w') === 0) {
        $step = $shift === 'back' ? '-1 day' : '+1 day';
        $try  = (clone $t)->modify($step);
        // Вышли из месяца кампании — двигаем в противоположную сторону.
        if ((int) $try->format('n') !== $m) $try = (clone $t)->modify($shift === 'back' ? '+1 day' : '-1 day');
        $t = $try;
    }
    return $t->format('Y-m-d H:i:s');
}

/** Дата запуска по умолчанию: 1-е число. Если 1-е уже прошло — следующий месяц. */
function launch_default_date(): string {
    $now = new \DateTime('now');
    $y = (int) $now->format('Y'); $m = (int) $now->format('n'); $d = (int) $now->format('j');
    if ($d > 1) { $m++; if ($m > 12) { $m = 1; $y++; } }
    // Здесь воскресенье не сдвигаем: это календарная дата открытия приёма («новые
    // конкурсы с 1 числа»), её видит участник. Перенос воскресной ОТПРАВКИ на
    // понедельник делает launch_send_slot(), даты в тексте он не трогает.
    return (new \DateTime(sprintf('%04d-%02d-01 00:00:00', $y, $m)))->format('Y-m-d');
}

/**
 * Ближайший слот в окне отправки 09:00–18:00.
 * Ровно то же окно, что у nl_bulk_window_open(). Суббота остаётся рабочей, а
 * воскресенье уезжает на понедельник: наружу в выходной ничего не уходит
 * (core/outreach_window.php), и волна, поставленная на воскресенье, просто
 * простояла бы сутки в очереди.
 */
function launch_send_slot(\DateTime $from): \DateTime {
    $t = clone $from;
    $h = (int) $t->format('G');
    if ($h < 9)       { $t->setTime(9, (int) $t->format('i') % 10); }
    elseif ($h >= 18) { $t->modify('+1 day'); $t->setTime(9, 0); }
    // Перенос воскресенья на понедельник ЧАС НЕ МЕНЯЕТ: 10:00 для запуска месяца
    // выбрано владельцем, в 09:00 пост уходил в пустоту. Раньше setTime(9,0) стоял
    // безусловно и молча съедал выбранное время.
    if ((int) $t->format('w') === 0) {
        $hh = (int) $t->format('G'); $mi = (int) $t->format('i');
        $t->modify('+1 day');
        $t->setTime(max(9, $hh), $hh >= 9 ? $mi : 0);
    }
    return $t;
}

/**
 * Запланировать ПОЛНЫЙ запуск. Один клик оргкомитета создаёт всё расписание:
 *   • день запуска (рабочий слот):
 *       — launch_vk       — ПЕРСОНАЛЬНЫЙ пост ВК (стена+сторис) по КАЖДОМУ конкурсу (своя афиша);
 *       — launch_mail      — ОБЩЕЕ письмо «4 афиши в одном» по всей базе + in-app всем (гейт: конкурсы
 *                            становятся видимыми на сайте);
 *       — campaign_vip     — письмо-приглашение в ВИП-клуб (+15 мин, аудитория ВИП, квота 75/день);
 *       — campaign_kabinet — письмо о возможностях личного кабинета (+30 мин, квота 75/день);
 *   • общие посты месяца (ВК+in-app, БЕЗ e-mail): 22 09:00 «3 дня», 25 09:00 «последний день»,
 *     25 18:00 «приём закрыт» (закрытие приёма);
 *   • результаты 28 10:00 — по КАЖДОМУ длинному конкурсу (ВК-пост общий + персональные письма участникам).
 *     Час выбран владельцем: в 10:00 сообщество уже читает ленту, в 09:00 пост уходил в пустоту.
 * Предыдущий незавершённый план отменяется.
 */
function launch_schedule_all(string $launchDate, string $launchTime, array $channels): array {
    launch_migrate();
    $channels = array_values(array_intersect($channels, array_keys(launch_channels())));
    if (!$channels) return ['ok' => false, 'msg' => 'Не выбран ни один канал'];
    $comps = launch_open_comps();
    if (!$comps) return ['ok' => false, 'msg' => 'Нет открытых конкурсов (status=open) для запуска'];

    // ОТМЕНЯЕМ ТОЛЬКО СВОЙ ПЛАН — С МЕСЯЦА ЗАПУСКА И ДАЛЬШЕ.
    // Раньше здесь снималось ВСЁ незавершённое без разбора месяца. Планировщик
    // нового месяца вызывается 1-го числа в 09:00 — то есть до того, как отработает
    // волна результатов прошлого месяца (28-е, а при задержке — начало следующего).
    // Она молча уезжала в 'cancelled', и участники прошлого сезона не получали
    // ни постов с итогами, ни писем с результатами: работа жюри уходила в никуда.
    $__planMonth = substr($launchDate, 0, 7);
    q("UPDATE launch_jobs SET status='cancelled'
        WHERE status='scheduled' AND strftime('%Y-%m', run_at) >= ?", [$__planMonth]);

    // Хвосты прошлых месяцев не выполняем (их время ушло), но и не выдаём за отмену
    // оргкомитетом: помечаем отдельным статусом, чтобы в журнале было видно, что
    // волна не отработала в срок.
    q("UPDATE launch_jobs SET status='expired'
        WHERE status='scheduled' AND strftime('%Y-%m', run_at) < ?", [$__planMonth]);

    // Идеальные наборы каналов по волнам (правило владельца, «как надо»):
    //   • ВСЕ посты ВК (запуск по каждому конкурсу, 3 дня, последний, закрытие, результаты)
    //     идут и на СТЕНУ (+авто-сторис), и РАССЫЛКОЙ В ЛИЧКУ (vk_dm) по всем;
    //   • массовое письмо-открытие и результаты дублируются в IN-APP (кабинет/приложение + колокольчик).
    // $channels из пульта используется как глобальный выключатель: канал уходит из наборов,
    // только если он явно снят в пульте (по умолчанию включены все).
    $enabled  = fn(array $set) => array_values(array_intersect($set, $channels)) ?: [];
    $vkAll    = $enabled(['vk_wall', 'vk_dm']);          // стена+сторис + рассылка в личку
    $hasVk    = (bool) $vkAll;
    $vkCh     = $vkAll ?: ['vk_wall'];
    $hasEmail = in_array('email', $channels, true);
    $hasInapp = in_array('inapp', $channels, true);

    // Время запуска → ближайший слот окна 09:00–18:00. Суббота рабочая (её
    // next_working_slot() уводил на понедельник вопреки дате из пульта), а
    // воскресенье переносится на понедельник: наружу в выходной ничего не уходит.
    $lt = strtotime($launchDate . ' ' . ($launchTime ?: '09:00'));
    if (!$lt) $lt = time();
    $fromDt = (new \DateTime())->setTimestamp($lt);
    $runLaunch = launch_send_slot($fromDt)->format('Y-m-d H:i:s');
    $rep = (int) $comps[0]['id'];
    $planned = [];

    // 1) ПЕРСОНАЛЬНЫЙ пост ВК по каждому конкурсу (своя афиша/текст).
    if ($hasVk) {
        foreach ($comps as $c) {
            insert('launch_jobs', ['competition_id' => (int) $c['id'], 'wave' => 'launch_vk',
                'channels' => implode(',', $vkCh), 'run_at' => $runLaunch, 'status' => 'scheduled']);
        }
        $planned['launch_vk'] = ['count' => count($comps), 'run_at' => $runLaunch];
    }

    // 2) ОБЩЕЕ письмо-открытие «4 афиши в одном» + in-app всем (гейт: показываем конкурсы на сайте).
    $mailCh = array_values(array_intersect($channels, ['email', 'inapp']));
    if (!$mailCh) $mailCh = $hasInapp ? ['inapp'] : ($hasEmail ? ['email'] : []);
    if ($mailCh || (!$hasVk)) {
        insert('launch_jobs', ['competition_id' => $rep, 'wave' => 'launch_mail',
            'channels' => implode(',', $mailCh ?: ['inapp']), 'run_at' => $runLaunch, 'status' => 'scheduled']);
        $planned['launch_mail'] = ['run_at' => $runLaunch, 'channels' => $mailCh];
    }

    // 3) Отдельных волн «ВИП-клуб» и «личный кабинет» БОЛЬШЕ НЕТ (правило владельца,
    //    август 2026): оба блока входят в объединённое письмо волны launch_mail.
    //    Раньше здесь заводились ещё два задания (+15 и +30 минут), и человек получал
    //    три письма подряд, а база проходилась за два с лишним месяца вместо одного.
    //    Волны campaign_vip / campaign_kabinet остаются в коде launch_fire — их можно
    //    запустить руками из пульта, если понадобится разовая отдельная кампания,
    //    но в АВТОМАТИЧЕСКОМ плане следующих месяцев они не появляются.

    // 4) Общие посты месяца — стена+сторис + рассылка ВК в личку + in-app (БЕЗ e-mail).
    $ly = (int) date('Y', $lt); $lm = (int) date('n', $lt);
    $commonCh = $enabled(['vk_wall', 'vk_dm', 'inapp']) ?: ['vk_wall', 'inapp'];
    // Предупреждения при попадании на воскресенье уходят в субботу (сказать раньше
    // можно, позже нельзя), объявление о закрытии — в понедельник.
    $d3     = launch_workday_at($ly, $lm, 22, 9, 0, 'back');
    $last   = launch_workday_at($ly, $lm, 25, 9, 0, 'back');
    $closed = launch_workday_at($ly, $lm, 25, 18, 0, 'forward');
    insert('launch_jobs', ['competition_id' => $rep, 'wave' => 'd3',     'channels' => implode(',', $commonCh), 'run_at' => $d3,     'status' => 'scheduled']);
    insert('launch_jobs', ['competition_id' => $rep, 'wave' => 'last',   'channels' => implode(',', $commonCh), 'run_at' => $last,   'status' => 'scheduled']);
    insert('launch_jobs', ['competition_id' => $rep, 'wave' => 'closed', 'channels' => implode(',', $commonCh), 'run_at' => $closed, 'status' => 'scheduled']);
    $planned['d3'] = $d3; $planned['last'] = $last; $planned['closed'] = $closed;

    // 5) Результаты 28 10:00 — по каждому ДЛИННОМУ конкурсу (ВК общий пост + персональные письма участникам).
    // Время оглашения назначено владельцем на 10:00 МСК и совпадает со страховочным
    // кроном publish_results_vk (он же 28-го в 10:00): если пульт по какой-то причине
    // не сработает, оглашение всё равно состоится в обещанный час, а не на час раньше.
    $results = launch_workday_at($ly, $lm, 28, 10, 0);
    // Результаты: стена+сторис + рассылка ВК + персональные письма участникам + in-app/колокольчик.
    $resCh = $enabled(['vk_wall', 'vk_dm', 'email', 'inapp']) ?: ['email'];
    $longIds = [];
    foreach ($comps as $c) {
        if (function_exists('vkt_is_long') ? vkt_is_long($c) : (($c['results_mode'] ?? '') === 'list')) {
            insert('launch_jobs', ['competition_id' => (int) $c['id'], 'wave' => 'results',
                'channels' => implode(',', $resCh), 'run_at' => $results, 'status' => 'scheduled']);
            $longIds[] = (int) $c['id'];
        }
    }
    if ($longIds) $planned['results'] = ['run_at' => $results, 'comps' => count($longIds)];

    if (function_exists('audit')) audit('launch_plan', 'competition', 0,
        ['plan' => $planned, 'comps' => count($comps), 'channels' => $channels]);
    return ['ok' => true, 'scheduled' => $planned, 'comps' => count($comps)];
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
/**
 * Что показывать в колонке «Конкурс» плана.
 *
 * Волны «3 дня», «последний день» и «приём закрыт» — ОБЩИЕ: один пост про все
 * конкурсы месяца сразу. В задании у них стоит первый конкурс — просто как
 * держатель строки, и панель честно печатала его название («Мировые Таланты»),
 * из-за чего казалось, будто напоминание уйдёт только по одному конкурсу.
 *
 * Персональные волны (пост ВК по каждому конкурсу, результаты длинного) — там
 * название конкурса настоящее и его надо показывать.
 */
function lp_wave_scope(string $wave, string $compName): string {
    if (in_array($wave, ['d3', 'last', 'closed', 'launch_mail'], true)) return 'все конкурсы месяца';
    return $compName !== '' ? $compName : '—';
}

function launch_panel_html(): string {
    launch_migrate();
    $openComps = launch_open_comps();
    $channels  = launch_channels();
    $defDate   = (string) (function_exists('setting') ? setting('launch_plan_date', '2026-08-08') : '2026-08-08');
    if ($defDate === '') $defDate = '2026-08-08';
    $defTime   = (string) (function_exists('setting') ? setting('launch_plan_time', '09:00') : '09:00');
    $savedCh   = array_filter(explode(',', (string) (function_exists('setting') ? setting('launch_plan_channels', 'vk_wall,vk_dm,email,inapp') : 'vk_wall,vk_dm,email,inapp')));
    if (!$savedCh) $savedCh = ['vk_wall', 'vk_dm', 'email', 'inapp'];
    $jobs = all("SELECT j.*, c.name comp FROM launch_jobs j LEFT JOIN competitions c ON c.id=j.competition_id
                 WHERE j.status IN ('scheduled','done') ORDER BY j.run_at ASC LIMIT 200");
    $sched = array_values(array_filter($jobs, fn($j) => $j['status'] === 'scheduled'));
    $doneJobs = array_values(array_filter($jobs, fn($j) => $j['status'] === 'done'));
    $waveShort = ['launch' => 'Открытие', 'launch_vk' => 'Пост ВК (конкурс)', 'launch_mail' => 'Письмо-открытие',
                  'campaign_vip' => 'ВИП-клуб', 'campaign_kabinet' => 'Личный кабинет',
                  'd3' => '3 дня', 'last' => 'Последний', 'closed' => 'Закрыт', 'results' => 'Результаты'];
    $post = url('/admin/?p=launch');

    // Отображаемый URL афиши поста (учёт оверрайда/композита), '' если удалена/нет.
    $coverDisp = function (array $c, string $wave, array $sib) : string {
        $abs = launch_cover_path($c, $wave, $sib);
        if ($abs === '') return '';
        $pub = BASE_PATH . '/public';
        if (str_starts_with($abs, $pub)) return url(substr($abs, strlen($pub))) . '?t=' . (int) @filemtime($abs);
        return '';
    };

    // Один инлайн-редактор поста: текст (textarea) + афиша (заменить/удалить) + Сохранить/Сбросить/Предпросмотр.
    $editor = function (int $cid, string $wave, string $title, string $text, string $cover, bool $email) use ($post): string {
        $tid = 'lw_' . $cid . '_' . $wave;
        ob_start(); ?>
        <div class="lp2-block" data-cid="<?= $cid ?>" data-wave="<?= h($wave) ?>">
          <div class="lp2-bh"><b><?= h($title) ?></b>
            <span class="lp2-state" id="st_<?= $tid ?>"></span></div>
          <div class="lp2-body">
            <div class="lp2-coverwrap">
              <?php if ($cover !== ''): ?><img class="lp2-cover" src="<?= h($cover) ?>" alt="Афиша поста" loading="lazy"><?php else: ?><div class="lp2-cover lp2-cover--empty">Без афиши</div><?php endif; ?>
              <div class="lp2-coveracts">
                <label class="btn btn--ghost btn--xs lp2-upl">Заменить афишу
                  <input type="file" accept="image/*" data-lp2cover="<?= $cid ?>:<?= h($wave) ?>" style="display:none">
                </label>
                <?php if ($cover !== ''): ?><button type="button" class="btn btn--ghost btn--xs" data-lp2="coverdel" data-id="<?= $cid ?>" data-wave="<?= h($wave) ?>" style="color:#B23B3B">Удалить</button><?php endif; ?>
              </div>
            </div>
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
        <p class="muted small" style="margin:4px 0 0">Всё видно сразу, редактируется на месте. Ничего не уходит раньше расписания и только в рабочее время (09:00–18:00, кроме вс). По умолчанию запуск — 1-е число (если вс → 2-е), общие посты 22 (09:00), 25 (09:00), 25 (18:00), результаты длинного — 28 (10:00). Если дата попадает на вс — сдвиг на день.</p>
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
              <td><?= h(lp_wave_scope((string) $j['wave'], (string) ($j['comp'] ?? ''))) ?></td>
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
              <td><?= h(lp_wave_scope((string) $j['wave'], (string) ($j['comp'] ?? ''))) ?></td></tr>
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
        <p class="small muted" style="margin:0 0 14px">Всё уже составлено по эталонам — правьте и сохраняйте. Опубликованные посты из списка убираются: изменить вышедший пост можно только во ВКонтакте. Письмо правится и во время рассылки.</p>

        <?php
        $rep = (int) $openComps[0]['id']; $sib = $openComps;

        // УЖЕ ОПУБЛИКОВАННОЕ НЕ РЕДАКТИРУЕТСЯ.
        // Пост, который вчера вышел на стену сообщества, правкой текста в пульте
        // не изменить — редактор для него только сбивает с толку. Показываем
        // редакторы лишь тех волн, которые ещё впереди.
        $firedWaves = [];
        try {
            foreach (all("SELECT DISTINCT wave FROM launch_jobs WHERE status IN ('done','running')
                           AND strftime('%Y-%m', run_at) = ?", [date('Y-m')]) as $w) {
                $firedWaves[(string) $w['wave']] = true;
            }
        } catch (\Throwable $e) {}
        $vkFired = isset($firedWaves['launch_vk']);
        ?>
        <?php if (!$vkFired): ?>
        <div class="lp2-group-t">Посты ВКонтакте — отдельный пост по каждому конкурсу (стена + сторис + рассылка в личку по всем)</div>
        <?php foreach ($openComps as $c):
            echo $editor((int) $c['id'], 'launch', 'Пост ВК «' . $c['name'] . '»',
                launch_wave_text($c, 'launch', [$c]), $coverDisp($c, 'launch', [$c]), false);
        endforeach; ?>
        <?php else: ?>
        <div class="lp2-group-t">Посты ВКонтакте — опубликованы</div>
        <p class="small muted" style="margin:-4px 0 14px">Посты уже вышли на стену сообщества <?= h(date('d.m.Y')) ?>, править их здесь нельзя —
        правка в пульте меняет только то, что ещё не опубликовано. Изменить вышедший пост можно прямо во ВКонтакте.</p>
        <?php endif; ?>

        <div class="lp2-group-t" style="margin-top:18px">Массовое письмо — правится в любой момент, в том числе во время рассылки</div>
        <p class="small muted" style="margin:-4px 0 14px">Письмо собирается в момент отправки каждому человеку, поэтому исправленный текст
        уходит всем, кому письмо ещё не доставлено — ждать следующего месяца не нужно. Тем, кто уже получил, письмо не меняется.</p>
        <?php
        // Три email-блока с ВИЗУАЛЬНЫМ редактором (contenteditable, как в «Отправках»):
        // общая база (200/день), ВИП-клуб (100/день), личный кабинет (100/день).
        $mailBlock = function (string $ctype, string $title, string $desc, string $quotaKey, int $quotaDef, string $bodyHtml) use ($post): string {
            $subj  = (string) (function_exists('setting') ? setting('launch_mail_subject:' . $ctype, '') : '');
            $quota = (int) (function_exists('setting') ? setting($quotaKey, (string) $quotaDef) : $quotaDef);
            ob_start(); ?>
            <div class="lp2-block" data-mailblock="<?= h($ctype) ?>">
              <div class="lp2-bh"><b><?= h($title) ?></b><span class="lp2-state" id="mbst_<?= h($ctype) ?>"></span></div>
              <p class="small muted" style="margin:0 0 10px"><?= h($desc) ?></p>
              <label class="small muted" style="display:block;margin-bottom:8px">Тема письма (пусто — по умолчанию)
                <input type="text" id="mbsubj_<?= h($ctype) ?>" value="<?= h($subj) ?>" placeholder="Тема по умолчанию" style="display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:9px 11px;border:1px solid #d7ddea;border-radius:10px;font:inherit">
              </label>
              <div class="mb-toolbar">
                <button type="button" data-mbcmd="bold" title="Жирный"><b>Ж</b></button>
                <button type="button" data-mbcmd="italic" title="Курсив"><i>К</i></button>
                <button type="button" data-mbcmd="link" title="Ссылка">🔗 Ссылка</button>
                <button type="button" data-mbcmd="btn" title="Кнопка">▭ Кнопка</button>
                <span class="small muted" style="margin-left:auto">Редактируйте прямо в письме ↓</span>
              </div>
              <div class="mb-edit" id="mbbody_<?= h($ctype) ?>" contenteditable="true"><?= $bodyHtml ?></div>
              <label class="small muted" style="display:block;margin:10px 0 10px">Количество в день (успешных писем)
                <input type="number" min="1" max="1000" id="mbq_<?= h($ctype) ?>" value="<?= $quota ?>" style="display:block;width:120px;margin-top:4px;padding:9px 11px;border:1px solid #d7ddea;border-radius:10px;font:inherit">
              </label>
              <div class="lp2-acts">
                <button type="button" class="btn btn--primary btn--sm" data-mbsave="<?= h($ctype) ?>" data-quotakey="<?= h($quotaKey) ?>">Сохранить</button>
                <button type="button" class="btn btn--ghost btn--sm" data-mbreset="<?= h($ctype) ?>" style="color:#B23B3B">Сбросить к шаблону</button>
                <a class="btn btn--ghost btn--sm" href="<?= h($post . '&do=email_preview_campaign&ctype=' . $ctype) ?>" target="_blank" rel="noopener">Предпросмотр письма</a>
              </div>
            </div>
            <?php return (string) ob_get_clean();
        };
        // ОДНО ОБЪЕДИНЁННОЕ ПИСЬМО (правило владельца, август 2026).
        // Отдельные блоки «ВИП-клуб» и «Личный кабинет» из пульта убраны: теперь это
        // три части одного письма, и редактируются они в одном месте — иначе легко
        // отредактировать шаблон, который никуда не уходит.
        if (!function_exists('launch_combo_inner')) require_once BASE_PATH . '/core/launch_combo.php';
        // В РЕДАКТОРЕ токены оставляем токенами: если подставить сюда образцовые логин
        // и пароль, админ сохранит шаблон с зашитым чужим паролем навсегда.
        // Живые значения показываются только в «Предпросмотре письма».
        $comboPreview = launch_combo_inner(true, true, '{{login}}', '{{name}}', '{{password}}');
        echo $mailBlock(
            'combo',
            'Письмо запуска: конкурсы + личный кабинет + клуб',
            'Одно письмо на человека, три блока подряд: конкурсы месяца → доступ в личный кабинет (логин и временный пароль) → приглашение в клуб. '
            . 'Блок кабинета уходит ТОЛЬКО тем, кто ещё ни разу не входил (у действующих участников свой пароль, его не трогаем). '
            . 'Блок клуба — только тем, кто в клубе не состоит. Ниже показан полный вариант со всеми тремя блоками; '
            . 'метки {{name}}, {{login}} и {{password}} подставляются каждому получателю автоматически — '
            . 'их нужно оставить как есть.',
            'nl_split_konkurs', 400,
            // ВАЖНО: метки НЕ подменяем примерами. Отредактированный здесь текст
            // сохраняется как шаблон волны; подставь мы сюда «Имя», в сохранённом
            // шаблоне осталось бы именно оно, и все получили бы «Здравствуйте, Имя!».
            (string) $comboPreview
        );
        ?>

        <div class="lp2-group-t" style="margin-top:18px">Общие посты по всем конкурсам (афиша — авто-композит со всеми афишами и надписью, можно заменить)</div>
        <?php
        $repComp = launch_norm_comp($openComps[0]);
        // Каждый из трёх — один общий пост про ВСЕ конкурсы месяца. Отработавшие прячем.
        if (!isset($firedWaves['d3']))     echo $editor($rep, 'd3', 'Осталось 3 дня (22-е, 09:00) — общий пост по всем конкурсам', launch_wave_text($repComp, 'd3', $sib), $coverDisp($repComp, 'd3', $sib), false);
        if (!isset($firedWaves['last']))   echo $editor($rep, 'last', 'Последний день (25-е, 09:00) — общий пост по всем конкурсам', launch_wave_text($repComp, 'last', $sib), $coverDisp($repComp, 'last', $sib), false);
        if (!isset($firedWaves['closed'])) echo $editor($rep, 'closed', 'Приём закрыт (25-е, 18:00) — общий пост по всем конкурсам', launch_wave_text($repComp, 'closed', $sib), $coverDisp($repComp, 'closed', $sib), false);
        ?>

        <?php $longComps = array_values(array_filter($openComps, fn($c) => function_exists('vkt_is_long') && vkt_is_long($c))); ?>
        <?php if ($longComps): ?>
          <div class="lp2-group-t" style="margin-top:18px">Результаты длинного конкурса (28-е, 10:00) — ВК-пост общий; на почту — персональное письмо каждому участнику с результатом, кнопками и файлом списка</div>
          <?php foreach ($longComps as $c) {
              echo $editor((int) $c['id'], 'results', 'Результаты «' . $c['name'] . '»',
                  launch_wave_text($c, 'results', [$c]), $coverDisp($c, 'results', [$c]), true);
          } ?>
        <?php endif; ?>
      </div>

      <?php endif; /* openComps */ ?>
    </div>

    <style>
    .lp2 .card{margin-bottom:16px}
    .lp2 h2 svg,.lp2 h3 svg,.lp2 .btn svg{width:20px;height:20px;flex:none;vertical-align:-4px}
    .lp2 h2{display:flex;align-items:center;gap:8px}
    .lp2-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid #d7ddea;border-radius:999px;font-size:.85rem;cursor:pointer}
    .lp2-msg{margin-top:12px;padding:10px 14px;border-radius:10px;font-size:.9rem}
    .lp2-msg.ok{background:#E7F7EE;color:#1E7A44}.lp2-msg.err{background:#FDECEC;color:#B23B3B}
    .lp2-prev{margin-top:12px;font-size:.85rem;line-height:1.6;color:#445;background:#F7F9FF;border:1px solid #E3E9F7;border-radius:10px;padding:12px 14px;white-space:pre-wrap}
    .lp2-block{border:1px solid #E6E9F2;border-radius:14px;padding:12px 14px;margin:0 0 12px;background:#FCFDFF}
    .lp2-bh{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}
    .lp2-bh b{color:#17307A}
    .lp2-state{font-size:12px;color:#1E7A44}
    .lp2-body{display:flex;gap:12px;align-items:flex-start}
    .lp2-coverwrap{flex:none;width:140px;display:flex;flex-direction:column;gap:6px}
    .lp2-cover{width:140px;height:auto;border-radius:10px;border:1px solid #E6E9F2;display:block}
    .lp2-cover--empty{height:88px;display:flex;align-items:center;justify-content:center;color:#99a;font-size:12px;background:#F4F6FB}
    .lp2-coveracts{display:flex;gap:6px;flex-wrap:wrap}
    .btn--xs{padding:4px 8px;font-size:12px;border-radius:8px}
    .lp2-upl{cursor:pointer;margin:0}
    .lp2-ta{flex:1;min-width:0;width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #d7ddea;border-radius:10px;font:inherit;font-size:.9rem;line-height:1.55;resize:vertical}
    .lp2-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}
    .lp2-group-t{font-size:.8rem;letter-spacing:.05em;text-transform:uppercase;color:#889;margin:0 0 10px;font-weight:700}
    .mb-toolbar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 8px;padding:6px;background:#F4F6FB;border:1px solid #E3E9F7;border-radius:10px}
    .mb-toolbar button{padding:5px 10px;border:1px solid #d7ddea;background:#fff;border-radius:8px;cursor:pointer;font-size:13px;line-height:1}
    .mb-toolbar button:hover{background:#eef2fb}
    .mb-edit{border:1px solid #d7ddea;border-radius:12px;padding:16px 18px;background:#fff;max-height:520px;overflow:auto;font-size:14px;line-height:1.5;color:#222}
    .mb-edit:focus{outline:2px solid #C7932255;border-color:#C79322}
    .mb-edit img{max-width:100%;height:auto}
    [data-theme=dark] .mb-toolbar{background:#171b2b;border-color:#2b3350}
    [data-theme=dark] .mb-toolbar button{background:#1c2136;border-color:#2b3350;color:#e6ecff}
    [data-theme=dark] .mb-edit{background:#fff;color:#222}
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
      // Загрузка/замена афиши поста (multipart).
      root.addEventListener('change', function(e){
        var inp=e.target.closest('[data-lp2cover]'); if(!inp||!inp.files||!inp.files[0]) return;
        var pair=inp.getAttribute('data-lp2cover').split(':'); var f=inp.files[0];
        var fd=new FormData(); fd.append('_csrf',CSRF); fd.append('do','cover_upload'); fd.append('id',pair[0]); fd.append('wave',pair[1]); fd.append('cover',f);
        showMsg('Загружаю афишу…',true);
        fetch(POST,{method:'POST',credentials:'same-origin',body:fd}).then(function(r){return r.json();}).then(function(d){
          if(!d.ok){showMsg(d.msg||'Ошибка загрузки',false);return;}
          showMsg('Афиша обновлена. Обновляю…',true); setTimeout(function(){location.reload();},700);
        }).catch(function(){showMsg('Ошибка сети.',false);});
      });
      // Визуальный редактор email-блоков: тулбар (Ж/К/ссылка/кнопка), сохранение тела, сброс.
      var MB_BTN='display:inline-block;padding:12px 26px;border-radius:11px;background:#17307A;color:#E9C877;text-decoration:none;font-weight:700;font-size:14px';
      root.addEventListener('click', function(e){
        var tb=e.target.closest('[data-mbcmd]'); if(!tb) return;
        var blk=tb.closest('[data-mailblock]'); if(!blk) return;
        var ed=blk.querySelector('.mb-edit'); if(!ed) return;
        ed.focus();
        var cmd=tb.getAttribute('data-mbcmd');
        if(cmd==='bold') document.execCommand('bold',false,null);
        else if(cmd==='italic') document.execCommand('italic',false,null);
        else if(cmd==='link'){ var u=prompt('Ссылка (URL):','https://'); if(u){ var t=prompt('Текст ссылки:', (window.getSelection && String(window.getSelection()))||'ссылка')||u; document.execCommand('insertHTML',false,'<a href="'+u.replace(/"/g,'&quot;')+'" style="color:#17307A">'+t.replace(/</g,'&lt;')+'</a>'); } }
        else if(cmd==='btn'){ var bu=prompt('Ссылка кнопки (URL):','https://'); if(bu){ var bt=prompt('Текст кнопки:','Подробнее')||'Подробнее'; document.execCommand('insertHTML',false,'<div style="margin:16px 0"><a href="'+bu.replace(/"/g,'&quot;')+'" style="'+MB_BTN+'">'+bt.replace(/</g,'&lt;')+'</a></div>'); } }
      });
      root.addEventListener('click', function(e){
        var mb=e.target.closest('[data-mbsave]'); if(!mb) return;
        var ct=mb.getAttribute('data-mbsave'), qk=mb.getAttribute('data-quotakey');
        var st=$('mbst_'+ct), subj=$('mbsubj_'+ct), q=$('mbq_'+ct), ed=$('mbbody_'+ct);
        if(st){ st.textContent='сохраняю…'; st.style.color='#889'; }
        post({do:'mail_block_save',ctype:ct,quotakey:qk,subject:subj?subj.value:'',html:ed?ed.innerHTML:'',quota:q?q.value:''}).then(function(d){
          if(st){ st.textContent=d.ok?'✓ сохранено':(d.msg||'ошибка'); st.style.color=d.ok?'#1E7A44':'#B23B3B'; }
        }).catch(function(){ if(st){st.textContent='ошибка сети'; st.style.color='#B23B3B';} });
      });
      root.addEventListener('click', function(e){
        var mr=e.target.closest('[data-mbreset]'); if(!mr) return;
        if(!confirm('Вернуть эталонный шаблон письма? Ваши правки будут удалены.')) return;
        post({do:'mail_block_reset',ctype:mr.getAttribute('data-mbreset')}).then(function(d){ if(d.ok) location.reload(); }).catch(function(){});
      });
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
        } else if(act==='coverdel'){
          if(!confirm('Удалить афишу этого поста?')) return;
          post({do:'cover_remove',id:b.getAttribute('data-id'),wave:b.getAttribute('data-wave')}).then(function(d){
            showMsg(d.msg||'Афиша удалена. Обновляю…',true); setTimeout(function(){location.reload();},700);
          }).catch(function(){});
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
    // РАБОЧЕЕ ОКНО 09:00–18:00, ВОСКРЕСЕНЬЕ ЗАКРЫТО.
    // Проверки дня недели здесь не было вовсе: пульт остался единственным местом,
    // где правило владельца «наружу ничего не уходит ночью и в воскресенье» не
    // применялось, хотя стена ВК, сторис и личка уходят именно отсюда. Учреждение
    // видит воскресную запись на своей стене и читает её как рассылку робота.
    // Источник правды один на все каналы — core/outreach_window.php; условие
    // продублировано на случай, если файл окна почему-то не подключён.
    $windowOk = function_exists('outreach_window_ok')
        ? outreach_window_ok()
        : ((int) $now->format('w') !== 0 && $h >= 9 && $h <= 18);
    if (!$windowOk) return 0;   // вне рабочего окна ничего не публикуем

    // Зависшие задания: если процесс умер посреди волны, задание осталось в 'running'
    // и больше никогда бы не выполнилось. Через 30 минут возвращаем его в очередь.
    try {
        q("UPDATE launch_jobs SET status='scheduled'
            WHERE status='running' AND COALESCE(started_at,'') <> ''
              AND started_at < ?", [(new \DateTime('-2 hours'))->format('Y-m-d H:i:s')]);
    } catch (\Throwable $e) { /* колонки может не быть на старой БД — не мешаем работе */ }

    // ПРОТУХШИЕ ЗАДАНИЯ НЕ ВЫПОЛНЯЮТСЯ.
    // Условие было одно — «run_at <= сейчас», то есть наступившей считалась любая
    // прошедшая дата, хоть 1970 года. В базе такие строки реально лежат (волны
    // 'closed' и 'results' с run_at='1970-01-01'), и держал их от выполнения только
    // опущенный стоп-кран: как только массовые включат, вся эта древность улетела бы
    // разом — «приём закрыт» и итоги месяца, которого не было.
    //
    // Догон просрочки нужен (крон мог не работать сутки), но у него должен быть срок.
    // Двое суток — предел: волна старше этого уже не про сегодняшнюю кампанию.
    $staleBefore = (new \DateTime('-2 days'))->format('Y-m-d H:i:s');
    try {
        $st = q("UPDATE launch_jobs SET status='expired'
                  WHERE status='scheduled' AND run_at < ?", [$staleBefore]);
        $nSt = is_object($st) && method_exists($st, 'rowCount') ? (int) $st->rowCount() : 0;
        if ($nSt > 0) {
            error_log('launch_run_due: протухшие волны сняты (старше 2 суток): ' . $nSt);
            if (function_exists('nl_log')) nl_log("запуск: протухшие волны сняты (старше 2 суток) — $nSt");
        }
    } catch (\Throwable $e) {}

    // ORDER BY ... id ASC обязателен: у всех волн одного запуска одинаковый run_at,
    // и без вторичной сортировки порядок не определён. Нужен именно порядок вставки —
    // сначала посты ВК (быстрые), потом почтовая волна (она идёт минутами).
    $due = all("SELECT * FROM launch_jobs
                 WHERE status='scheduled' AND run_at <= ? AND run_at >= ?
                 ORDER BY run_at ASC, id ASC",
               [$now->format('Y-m-d H:i:s'), $staleBefore]);
    $done = 0;
    foreach ($due as $j) {
        $jid  = (int) $j['id'];
        $wave = (string) $j['wave'];

        // АТОМАРНЫЙ ЗАХВАТ ЗАДАНИЯ ДО ОТПРАВКИ.
        // Раньше статус менялся только ПОСЛЕ успешной отправки. Если launch_fire падал
        // на середине (например, пост в ВК уже ушёл, а на письмах вылетело исключение),
        // задание оставалось 'scheduled' — и следующая минута публиковала тот же пост
        // ВТОРОЙ раз. Файловый лок крона от этого не защищает: он снимается по выходе.
        // Теперь помечаем 'running' одним UPDATE с условием на прежний статус: если
        // строк не изменилось, задание уже взял кто-то другой — пропускаем.
        try {
            $claim = q("UPDATE launch_jobs SET status='running', started_at=? WHERE id=? AND status='scheduled'",
                       [$now->format('Y-m-d H:i:s'), $jid]);
            $taken = is_object($claim) && method_exists($claim, 'rowCount') ? (int) $claim->rowCount() : 1;
            if ($taken < 1) continue;
        } catch (\Throwable $e) { continue; }

        $channels = array_filter(array_map('trim', explode(',', (string) $j['channels'])));
        try {
            $res = launch_fire((int) $j['competition_id'], $wave, $channels, '', false);
            update('launch_jobs', [
                'status' => 'done', 'done_at' => $now->format('Y-m-d H:i:s'),
                'report' => json_encode($res['report'] ?? [], JSON_UNESCAPED_UNICODE),
            ], 'id=:id', ['id' => $jid]);
            $done++;
        } catch (\Throwable $e) {
            // Помечаем СБОЕМ, а не возвращаем в очередь: часть волны могла уже уйти,
            // и повтор задвоил бы посты. Разбирается вручную из пульта запуска.
            update('launch_jobs', [
                'status' => 'failed', 'done_at' => $now->format('Y-m-d H:i:s'),
                'report' => json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE),
            ], 'id=:id', ['id' => $jid]);
            error_log('launch_run_due: волна ' . $wave . ' #' . $jid . ' — ' . $e->getMessage());
            continue;
        }

        // Волна «приём закрыт» → авто-закрытие приёма заявок и афиш.
        if ($wave === 'closed') { try { launch_close_intake(); } catch (\Throwable $e) { error_log('launch_close_intake: ' . $e->getMessage()); } }
    }
    return $done;
}
