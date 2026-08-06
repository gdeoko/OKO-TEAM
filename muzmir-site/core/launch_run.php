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

/** Нормализация записи конкурса для эталонов (проставляем duration из results_mode). */
function launch_norm_comp(array $c): array {
    if (!isset($c['duration'])) {
        $c['duration'] = (($c['results_mode'] ?? '') === 'list') ? 'long' : 'short';
    }
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
        case 'launch':  return vkt_launch($c);
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
        'launch'  => 'Открыт приём заявок: «' . $n . '»',
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
    // Автоссылки: музыкальный-мир.рф/... , vk.ru/... , t.me/... → кликабельные.
    $safe = h($text);
    $safe = preg_replace('~(музыкальный-мир\.рф[^\s<]*)~u', '<a href="https://$1" style="color:#17307A">$1</a>', $safe);
    $safe = preg_replace('~((?:vk\.ru|vk\.com|t\.me)/[^\s<]+)~u', '<a href="https://$1" style="color:#17307A">$1</a>', $safe);
    $body = nl2br($safe);

    $applyUrl   = url('/apply');
    $cabUrl     = url('/cabinet');
    $reviewsUrl = url('/reviews');
    $compsUrl   = url('/konkursi');
    $vipUrl     = url('/vip');

    $inner = '<div style="font-size:15px;line-height:1.7;color:#33406B;">' . $body . '</div>';

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

    // Сводные волны — по всем открытым конкурсам; одиночные — по одному.
    $siblings = in_array($wave, ['d3', 'last', 'closed'], true) ? launch_open_comps() : [$c];

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

/** Cron: выполнить наступившие запланированные запуски. Возвращает число выполненных. */
function launch_run_due(): int {
    launch_migrate();
    $due = all("SELECT * FROM launch_jobs WHERE status='scheduled' AND run_at <= ? ORDER BY run_at ASC", [date('Y-m-d H:i:s')]);
    $done = 0;
    foreach ($due as $j) {
        $channels = array_filter(array_map('trim', explode(',', (string) $j['channels'])));
        $res = launch_fire((int) $j['competition_id'], (string) $j['wave'], $channels, '', false);
        update('launch_jobs', [
            'status' => 'done', 'done_at' => date('Y-m-d H:i:s'),
            'report' => json_encode($res['report'] ?? [], JSON_UNESCAPED_UNICODE),
        ], 'id=:id', ['id' => (int) $j['id']]);
        $done++;
    }
    return $done;
}
