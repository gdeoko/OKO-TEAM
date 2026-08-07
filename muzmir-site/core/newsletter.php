<?php
/**
 * Движок массовых рассылок Культурного центра «Музыкальный Мир».
 * Разворачивает рассылку по аудитории в mail_queue батчами (с учётом дневного
 * лимита Gmail), трекингом открытий/кликов, отпиской по unsub_token и A/B-тестом
 * заголовка. Реальную отправку делает core/mailer.php (mail_send) — его не трогаем,
 * только вызываем.
 *
 * Контракт (см. задачу):
 *   newsletter_enqueue(int $newsletterId): int          — постановка в очередь, возвращает число писем.
 *   newsletter_process_queue(int $limit): int           — отправка пачки, возвращает число отправленных.
 *   newsletter_track_open(string $token): void          — инкремент stats_open.
 *   newsletter_track_click(string $token, string $url): string — инкремент stats_click, вернуть целевой URL.
 */
declare(strict_types=1);

/** Тихий лог рассылок в общий mail.log (функция из mailer.php). */
function nl_log(string $msg): void {
    if (function_exists('mail_log')) mail_log('[nl] ' . $msg);
}

/* =====================================================================
 *  Аудитория
 * ===================================================================== */

/**
 * Разбор поля newsletters.audience → [email, name][].
 * Форматы: 'all' | 'segment:<тег>' | 'competition:<id>' | 'vip' | 'kabinet'.
 * Отписавшихся (subscribers.active=0) исключаем на этапе постановки.
 */
function nl_resolve_recipients(string $audience): array {
    [$kind, $value] = array_pad(explode(':', $audience, 2), 2, '');
    $kind = $kind ?: 'all';

    if ($kind === 'competition' && (int) $value > 0) {
        return all(
            "SELECT DISTINCT email, full_name AS name
               FROM applications
              WHERE competition_id = ? AND email <> ''",
            [(int) $value]
        );
    }
    if ($kind === 'segment' && $value !== '') {
        return all(
            "SELECT email, name FROM subscribers
              WHERE active = 1 AND tags LIKE ?",
            ['%' . $value . '%']
        );
    }
    // ВИП-клуб: действующие члены клуба (активные + срок не истёк) с почтой.
    if ($kind === 'vip') {
        return all(
            "SELECT u.email AS email, u.full_name AS name
               FROM club_members m JOIN users u ON u.id = m.user_id
              WHERE COALESCE(m.active,1) = 1
                AND (m.expires_at IS NULL OR m.expires_at = '' OR m.expires_at > datetime('now'))
                AND COALESCE(u.email,'') <> '' AND COALESCE(u.blocked,0) = 0"
        );
    }
    // Личный кабинет: зарегистрированные пользователи (не заблокированные, с почтой, не отписавшиеся).
    if ($kind === 'kabinet') {
        return all(
            "SELECT email, full_name AS name FROM users
              WHERE COALESCE(email,'') <> '' AND COALESCE(blocked,0) = 0 AND COALESCE(notify_email,1) = 1"
        );
    }
    return all("SELECT email, name FROM subscribers WHERE active = 1");
}

/**
 * Гарантирует запись в subscribers для адреса и возвращает [token, active].
 * Если адрес уже отписан (active=0) — возвращает active=0, письмо ему не шлём.
 * Токен отписки создаётся при отсутствии.
 */
function nl_ensure_subscriber(string $email, string $name, string $source): array {
    $email = mb_strtolower(trim($email));
    $row = one("SELECT id, unsub_token, active FROM subscribers WHERE email = ?", [$email]);
    if ($row) {
        $token = (string) $row['unsub_token'];
        if ($token === '') {
            $token = bin2hex(random_bytes(16));
            update('subscribers', ['unsub_token' => $token], 'id=:id', ['id' => $row['id']]);
        }
        return [$token, (int) $row['active']];
    }
    $token = bin2hex(random_bytes(16));
    insert('subscribers', [
        'email'       => $email,
        'name'        => $name,
        'source'      => $source,
        'unsub_token' => $token,
        'active'      => 1,
    ]);
    return [$token, 1];
}

/* =====================================================================
 *  Трекинг (пиксель открытия + подменённые ссылки клика)
 * ===================================================================== */

/** Токен трекинга рассылки (хранится в settings как nl_track_<id>). */
function nl_track_token(int $newsletterId): string {
    $key = 'nl_track_' . $newsletterId;
    $tok = setting($key, '');
    if ($tok === '' || $tok === null) {
        $tok = bin2hex(random_bytes(12));
        set_setting($key, $tok);
    }
    return (string) $tok;
}

/** Находит id рассылки по её токену трекинга. */
function nl_newsletter_by_track(string $token): ?int {
    if ($token === '') return null;
    $row = one("SELECT key FROM settings WHERE value = ? AND key LIKE 'nl_track_%'", [$token]);
    if (!$row) return null;
    return (int) substr((string) $row['key'], strlen('nl_track_'));
}

/** URL эндпоинта трекинга. */
function nl_track_url(string $event, string $token, string $target = ''): string {
    $base = rtrim((string) cfgv('base_url'), '/');
    $u = $base . '/api/v1/track.php?e=' . $event . '&t=' . urlencode($token);
    if ($target !== '') {
        $u .= '&u=' . rtrim(strtr(base64_encode($target), '+/', '-_'), '=');
    }
    return $u;
}

/** Пиксель открытия. */
function nl_open_pixel(string $token): string {
    $src = h(nl_track_url('o', $token));
    return '<img src="' . $src . '" width="1" height="1" alt="" '
         . 'style="display:block;width:1px;height:1px;border:0;opacity:0;" />';
}

/** Заменяет http(s)-ссылки в теле письма на трекинговые (клик). */
function nl_rewrite_links(string $html, string $token): string {
    return (string) preg_replace_callback(
        '/href\s*=\s*"(https?:\/\/[^"]+)"/i',
        function ($m) use ($token) {
            return 'href="' . h(nl_track_url('c', $token, $m[1])) . '"';
        },
        $html
    );
}

/** Инкремент открытий. */
function newsletter_track_open(string $token): void {
    $id = nl_newsletter_by_track($token);
    if ($id) q("UPDATE newsletters SET stats_open = stats_open + 1 WHERE id = ?", [$id]);
}

/** Инкремент кликов, возврат безопасного целевого URL для редиректа. */
function newsletter_track_click(string $token, string $url = ''): string {
    $id = nl_newsletter_by_track($token);
    if ($id) q("UPDATE newsletters SET stats_click = stats_click + 1 WHERE id = ?", [$id]);
    $url = trim($url);
    if ($url !== '' && preg_match('#^https?://#i', $url)) return $url;
    return rtrim((string) cfgv('base_url'), '/') . '/';
}

/* =====================================================================
 *  Вёрстка письма (премиум-лейаут КЦ, лого + подвал + отписка)
 * ===================================================================== */

/** Оборачивает тело рассылки в единый фирменный HTML-лейаут (mm_email_layout, core/mailer.php). */
function nl_wrap_email(string $bodyHtml, string $unsubUrl, string $openPixel, string $preheader = ''): string {
    if (!function_exists('mm_email_layout')) require_once __DIR__ . '/mailer.php';
    return mm_email_layout($bodyHtml, [
        'preheader'       => $preheader,
        'unsubscribe_url' => $unsubUrl,
        'pixel'           => $openPixel,
    ]);
}

/* =====================================================================
 *  Постановка рассылки в очередь
 * ===================================================================== */

/**
 * Разворачивает рассылку по аудитории в mail_queue с трекингом, отпиской и A/B.
 * Идемпотентно: перед постановкой чистит прежние ещё не отправленные письма
 * этой рассылки. Возвращает число поставленных в очередь писем.
 */
/**
 * Тип кампании для суточной квоты (konkurs|vip|kabinet) — определяется по аудитории.
 * ВИП-клуб и «личный кабинет» имеют отдельные дневные лимиты (см. nl_daily_split).
 * Всё остальное (конкурсы/общая база/новости) — тип 'konkurs'.
 */
function nl_campaign_type_for_audience(string $audience): string {
    $audience = trim(mb_strtolower($audience));
    if ($audience === 'vip'     || str_starts_with($audience, 'vip:'))     return 'vip';
    if ($audience === 'kabinet' || str_starts_with($audience, 'kabinet:')) return 'kabinet';
    return 'konkurs';
}

/** Мягко гарантирует колонки campaign_type в newsletters И в mail_queue. */
function nl_ensure_campaign_type_col(): void {
    try { db()->exec("ALTER TABLE newsletters ADD COLUMN campaign_type TEXT DEFAULT 'konkurs'"); } catch (\Throwable $e) {}
    try { db()->exec("ALTER TABLE mail_queue  ADD COLUMN campaign_type TEXT"); } catch (\Throwable $e) {}
}

function newsletter_enqueue(int $newsletterId): int {
    $n = one("SELECT * FROM newsletters WHERE id = ?", [$newsletterId]);
    if (!$n) { nl_log("enqueue: рассылка #$newsletterId не найдена"); return 0; }

    $audience = (string) ($n['audience'] ?? 'all');
    $source   = str_starts_with($audience, 'competition:') ? 'competition' : 'newsletter';
    $recips   = nl_resolve_recipients($audience);

    // Тип кампании (для суточных квот konkurs/vip/kabinet) фиксируем на рассылке.
    nl_ensure_campaign_type_col();
    $ctype = trim((string) ($n['campaign_type'] ?? '')) ?: nl_campaign_type_for_audience($audience);
    try { update('newsletters', ['campaign_type' => $ctype], 'id=:id', ['id' => $newsletterId]); } catch (\Throwable $e) {}

    $subjectA = (string) ($n['subject'] ?? '');
    $subjectB = trim((string) setting('nl_subject_b_' . $newsletterId, ''));
    $hasAB    = $subjectB !== '';
    $bodyRaw  = (string) ($n['body'] ?? '');
    $token    = nl_track_token($newsletterId);
    $base     = rtrim((string) cfgv('base_url'), '/');
    $preheader = mb_substr(trim(strip_tags($bodyRaw)), 0, 120);

    // Идемпотентность: убираем прежние неотправленные письма этой рассылки.
    q("DELETE FROM mail_queue WHERE newsletter_id = ? AND status = 'queued'", [$newsletterId]);

    $queued = 0;
    $i = 0;
    $pdo = db();
    $pdo->beginTransaction();
    try {
        foreach ($recips as $r) {
            $email = mb_strtolower(trim((string) ($r['email'] ?? '')));
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) continue;

            [$unsubToken, $active] = nl_ensure_subscriber($email, (string) ($r['name'] ?? ''), $source);
            if (!$active) continue; // отписавшихся не трогаем

            // A/B-заголовок: делим аудиторию 50/50 (чётные — A, нечётные — B).
            $subject = ($hasAB && ($i % 2 === 1)) ? $subjectB : $subjectA;
            $i++;

            $unsubUrl = $base . '/api/v1/unsubscribe.php?token=' . urlencode($unsubToken);
            $body = nl_rewrite_links($bodyRaw, $token);
            $body = nl_wrap_email($body, $unsubUrl, nl_open_pixel($token), $preheader);

            insert('mail_queue', [
                'to_email'      => $email,
                'to_name'       => (string) ($r['name'] ?? ''),
                'subject'       => $subject,
                'body'          => $body,
                'newsletter_id' => $newsletterId,
                'campaign_type' => $ctype,   // тип для суточной квоты (konkurs/vip/kabinet)
                'status'        => 'queued',
                'priority'      => 5,   // МАССОВАЯ: воркер шлёт через news@ с дневным лимитом и паузами
            ]);
            $queued++;
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        nl_log("enqueue #$newsletterId ошибка: " . $e->getMessage());
        return 0;
    }

    update('newsletters', [
        'status'     => $queued > 0 ? 'sending' : 'sent',
        'stats_sent' => 0,
    ], 'id=:id', ['id' => $newsletterId]);
    if (function_exists('audit')) audit('newsletter_enqueue', 'newsletter', $newsletterId, ['queued' => $queued]);
    nl_log("enqueue #$newsletterId: поставлено $queued (A/B=" . ($hasAB ? 'да' : 'нет') . ")");

    return $queued;
}

/* =====================================================================
 *  Отправка очереди батчами (дневной лимит Gmail)
 * ===================================================================== */

/** Сколько писем реально отправлено сегодня (общий лимит Gmail на аккаунт). */
function nl_sent_today(): int {
    $dayStart = date('Y-m-d 00:00:00');
    return (int) scalar(
        "SELECT COUNT(*) FROM mail_queue WHERE status = 'sent' AND sent_at >= ?",
        [$dayStart]
    );
}

/** Сколько МАССОВЫХ (priority>0) писем отправлено сегодня — для потолка пула. */
function nl_bulk_sent_today(): int {
    $dayStart = date('Y-m-d 00:00:00');
    return (int) scalar(
        "SELECT COUNT(*) FROM mail_queue WHERE status = 'sent' AND COALESCE(priority,0) > 0 AND sent_at >= ?",
        [$dayStart]
    );
}

/** Сколько массовых писем конкретного ТИПА (konkurs|vip|kabinet) ушло сегодня — для per-type квот. */
function nl_bulk_sent_today_type(string $type): int {
    $dayStart = date('Y-m-d 00:00:00');
    try {
        // Тип берём сначала из mail_queue.campaign_type (в т.ч. онбординг кабинета без newsletter),
        // иначе из связанной рассылки, иначе konkurs.
        return (int) scalar(
            "SELECT COUNT(*) FROM mail_queue q LEFT JOIN newsletters n ON n.id = q.newsletter_id
              WHERE q.status = 'sent' AND COALESCE(q.priority,0) > 0 AND q.sent_at >= ?
                AND COALESCE(q.campaign_type, n.campaign_type, 'konkurs') = ?",
            [$dayStart, $type]
        );
    } catch (\Throwable $e) { return 0; }
}

/* =====================================================================
 *  ПРОГРЕВ ДОМЕНА: рамп дневного лимита массовых по дню кампании
 * =====================================================================
 * Холодная база + свежий домен news@ = нельзя слать много сразу (Яндекс
 * тротлит 553 и репутация падает → спам). Раскочегариваем плавно: с малого
 * к потолку. Старт кампании фиксируется в settings['bulk_campaign_start']
 * (кнопкой «Запустить план» в админке). Пока старт не задан — берётся ручной
 * лимит cfgv('mail_daily_limit') (для точечных ad-hoc рассылок). */

/** Кривая прогрева: день кампании (1..) → потолок массовых на этот день. */
function nl_ramp_curve(): array {
    return [
        1 => 60,  2 => 90,  3 => 120, 4 => 160, 5 => 200, 6 => 250, 7 => 300,
        8 => 350, 9 => 400, 10 => 430, 11 => 450, 12 => 470, 13 => 480, 14 => 480,
    ]; // с 15-го дня и далее — потолок (nl_ramp_peak)
}

/** Абсолютный безопасный потолок массовых на один ящик news@ в сутки (по умолчанию 300). */
function nl_ramp_peak(): int { return (int) cfgv('mail_daily_max', 300); }

/**
 * Дневное распределение массовой рассылки по типам кампаний (в успешных письмах/день).
 * СЕЙЧАС (пока идёт разовая рассылка про личный кабинет): 150 конкурсы + 75 ВИП + 75 кабинет.
 * ДАЛЕЕ (кабинета больше нет): 200 конкурсы + 100 ВИП. Итого всегда 300 успешных/день.
 * Переключатель: settings.nl_kabinet_phase = '1' (сейчас) | '0' (обычный режим).
 * Возвращает ['konkurs'=>N, 'vip'=>N, 'kabinet'=>N] (kabinet=0 в обычном режиме).
 */
function nl_daily_split(): array {
    // Значения можно переопределить в settings (nl_split_konkurs / nl_split_vip / nl_split_kabinet)
    // из блоков пульта запуска. По умолчанию: база 200/день, ВИП 100/день, кабинет 100/день.
    $phase = (string) setting('nl_kabinet_phase', '1'); // '1' — идёт разовая волна «личный кабинет»
    $k  = (int) setting('nl_split_konkurs', '200');
    $v  = (int) setting('nl_split_vip',     '100');
    $kb = (int) setting('nl_split_kabinet', $phase === '1' ? '100' : '0');
    return ['konkurs' => max(0, $k), 'vip' => max(0, $v), 'kabinet' => max(0, $kb)];
}

/**
 * Сколько писем конкретной кампании (newsletter_id) уже успешно ушло сегодня —
 * чтобы соблюдать суточную квоту КАЖДОГО типа отдельно (конкурсы/ВИП/кабинет).
 */
function nl_newsletter_sent_today(int $newsletterId): int {
    if ($newsletterId <= 0) return 0;
    try {
        return (int) scalar(
            "SELECT COUNT(*) FROM mail_queue WHERE status='sent' AND newsletter_id=?
               AND date(COALESCE(sent_at, created_at))=date('now','localtime')",
            [$newsletterId]);
    } catch (\Throwable $e) { return 0; }
}

/** Дата старта плана рассылки (YYYY-MM-DD) или '' если план не запущен. */
function nl_campaign_start(): string {
    $s = trim((string) setting('bulk_campaign_start', ''));
    return $s !== '' ? substr($s, 0, 10) : '';
}

/** Номер дня кампании (1 = день старта). 0 — если план не запущен. */
function nl_campaign_day(): int {
    $start = nl_campaign_start();
    if ($start === '') return 0;
    $d0 = strtotime($start . ' 00:00:00');
    if ($d0 === false) return 0;
    $days = (int) floor((time() - $d0) / 86400) + 1;
    return max(1, $days);
}

/** Дневной потолок массовых с учётом прогрева. */
function nl_daily_cap(): int {
    $day = nl_campaign_day();
    if ($day === 0) {                          // план не запущен — ручной лимит
        return max(1, (int) cfgv('mail_daily_limit', 130));
    }
    $curve = nl_ramp_curve();
    $cap = $day >= 15 ? nl_ramp_peak() : ($curve[$day] ?? nl_ramp_peak());
    return min($cap, nl_ramp_peak());
}

/**
 * Помечает недоставленные адреса «отказами»: подписчик active=0 + тег bounced,
 * чтобы он выбыл из будущих волн, а дневная квота заполнялась живыми адресами
 * (естественный «backfill» — счёт идёт по доставленным, не по попыткам).
 * $email — адрес, $reason — краткая причина для лога.
 */
function nl_mark_bounced(string $email, string $reason = 'bounce'): void {
    $email = mb_strtolower(trim($email));
    if ($email === '') return;
    $row = one("SELECT id, tags, active FROM subscribers WHERE email=?", [$email]);
    if (!$row) return;
    $tags = (string) ($row['tags'] ?? '');
    if (mb_stripos($tags, 'bounced') === false) $tags = trim($tags . ',bounced', ', ');
    update('subscribers', ['active' => 0, 'tags' => $tags], 'id=:id', ['id' => (int) $row['id']]);
    nl_log('bounce: ' . $email . ' → выведен из базы (' . $reason . ')');
}

/** Прунит адреса, письма которым окончательно провалились (status=failed). */
function nl_prune_failed(): int {
    $rows = all("SELECT DISTINCT to_email FROM mail_queue WHERE status='failed' AND COALESCE(priority,0)>0");
    $n = 0;
    foreach ($rows as $r) {
        $e = mb_strtolower(trim((string) $r['to_email']));
        $sub = one("SELECT active FROM subscribers WHERE email=?", [$e]);
        if ($sub && (int) $sub['active'] === 1) { nl_mark_bounced($e, 'smtp-failed'); $n++; }
    }
    return $n;
}

/**
 * Отправляет пачку из mail_queue через mail_send, уважая дневной лимит с учётом
 * прогрева (nl_daily_cap). Обновляет статусы писем и newsletters.stats_sent.
 * Зовётся из cron process_newsletter_queue.php. Возвращает число отправленных.
 */
function newsletter_process_queue(int $limit): int {
    $dailyLimit = nl_daily_cap();
    $gap        = max(0, (int) cfgv('mail_send_gap', 30));   // антибан-пауза для МАССОВЫХ
    $perRun     = max(1, (int) cfgv('mail_throttle_per_run', 2));
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN priority INTEGER DEFAULT 0"); } catch (\Throwable $e) {}
    // scheduled_at — плановое время отправки. NULL/пусто = сразу. Позволяет админу из
    // «живого пульта» (admin/dispatch.php) отложить письмо или задержать его.
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN scheduled_at TEXT"); } catch (\Throwable $e) {}
    $nowTs = date('Y-m-d H:i:s');

    // Отправка одного письма очереди с обновлением статуса.
    // $account — необязательный аккаунт-отправитель (для массовых рассылок из пула).
    $sendRow = function (array $row, array $account = []): bool {
        $id = (int) $row['id'];
        $opt = [];
        if (!empty($row['attach'])) $opt['attach'] = (string) $row['attach'];
        if ($account) $opt['account'] = $account;
        $ok = false;
        try { $ok = mail_send((string) $row['to_email'], (string) $row['subject'], (string) $row['body'], $opt); }
        catch (\Throwable $e) { nl_log('process: исключение #' . $id . ' — ' . $e->getMessage()); }
        if ($ok) {
            update('mail_queue', ['status' => 'sent', 'sent_at' => date('Y-m-d H:i:s'), 'tries' => (int) $row['tries'] + 1], 'id=:id', ['id' => $id]);
            if (!empty($row['newsletter_id'])) q("UPDATE newsletters SET stats_sent = stats_sent + 1 WHERE id = ?", [(int) $row['newsletter_id']]);
        } else {
            $tries = (int) $row['tries'] + 1;
            update('mail_queue', ['status' => $tries >= 3 ? 'failed' : 'queued', 'tries' => $tries, 'error' => 'send failed'], 'id=:id', ['id' => $id]);
        }
        return $ok;
    };

    $sent = 0;

    // Маршрутизация по категориям (mail_route_account):
    //   заявки/результаты/уведомления → официальная Gmail (аккаунт по умолчанию);
    //   награды/дипломы → nagradi@музыкальный-мир.рф;
    //   массовые рассылки → news@музыкальный-мир.рф.
    $route = function (array $row): array {
        return function_exists('mail_route_account') ? mail_route_account($row) : [];
    };

    // 1) ТРАНЗАКЦИОННЫЕ (priority=0: результаты, подтверждения заявок/оплат, заказы наград,
    //    восстановление пароля, уведомления, дипломы) — сразу, БЕЗ дневного лимита, до 30 за запуск.
    //    Каждое уходит со своего отправителя (Gmail для конкурсов, nagradi для наград).
    $tx = all("SELECT * FROM mail_queue WHERE status='queued' AND COALESCE(priority,0)=0
               AND (scheduled_at IS NULL OR scheduled_at='' OR scheduled_at<=?) ORDER BY id ASC LIMIT 30", [$nowTs]);
    foreach ($tx as $row) { if ($sendRow($row, $route($row))) $sent++; }

    // 2) МАССОВЫЕ (priority>0) — через news@музыкальный-мир.рф, в рамках дневного лимита
    //    И с СОБЛЮДЕНИЕМ per-type квот (конкурсы/ВИП/кабинет = 150/75/75, масштабируется прогревом).
    nl_ensure_campaign_type_col();
    $globalRemaining = $dailyLimit - nl_bulk_sent_today();
    if ($globalRemaining > 0) {
        $split = nl_daily_split();                       // ['konkurs'=>,'vip'=>,'kabinet'=>]
        $peak  = max(1, nl_ramp_peak());                 // потолок (300)
        $scale = min(1.0, $dailyLimit / $peak);          // прогрев: доля от полного плана
        // Остаток квоты по каждому типу на сегодня (масштабирован прогревом).
        $typeLeft = [];
        foreach (['konkurs', 'vip', 'kabinet'] as $t) {
            $cap = (int) floor(($split[$t] ?? 0) * $scale);
            if (($split[$t] ?? 0) > 0 && $cap < 1) $cap = 1;         // не «зануляем» тип на раннем прогреве
            $typeLeft[$t] = max(0, $cap - nl_bulk_sent_today_type($t));
        }
        $allowed = array_keys(array_filter($typeLeft, fn($n) => $n > 0));
        $budget  = min(max(1, $perRun), $globalRemaining);
        if ($allowed) {
            $ph   = implode(',', array_fill(0, count($allowed), '?'));
            $bulk = all(
                "SELECT q.*, COALESCE(q.campaign_type, n.campaign_type, 'konkurs') AS ctype
                   FROM mail_queue q LEFT JOIN newsletters n ON n.id = q.newsletter_id
                  WHERE q.status='queued' AND COALESCE(q.priority,0)>0
                    AND (q.scheduled_at IS NULL OR q.scheduled_at='' OR q.scheduled_at<=?)
                    AND COALESCE(q.campaign_type, n.campaign_type, 'konkurs') IN ($ph)
                  ORDER BY q.id ASC LIMIT ?",
                array_merge([$nowTs], $allowed, [max(1, $budget * 4)])
            );
            $i = 0; $bulkSent = 0;
            foreach ($bulk as $row) {
                if ($bulkSent >= $budget) break;                      // не больше бюджета за один прогон
                $ct = (string) ($row['ctype'] ?? 'konkurs');
                if (($typeLeft[$ct] ?? 0) <= 0) continue;             // квота типа исчерпана
                if ($i++ > 0 && $gap > 0) sleep($gap);
                if ($sendRow($row, $route($row))) { $sent++; $bulkSent++; $typeLeft[$ct]--; }
            }
        } else {
            nl_log('process: суточные квоты всех типов (konkurs/vip/kabinet) на сегодня исчерпаны');
        }
    } else {
        nl_log('process: дневной лимит массовых исчерпан (транзакционные отправлены)');
    }

    // Чистим базу от адресов, письма которым окончательно провалились на SMTP.
    $pruned = nl_prune_failed();
    if ($pruned > 0) nl_log("process: выведено из базы (SMTP-отказ) — $pruned");

    // Рассылки без остатка в очереди помечаем как отправленные.
    q("UPDATE newsletters SET status = 'sent', sent_at = COALESCE(sent_at, datetime('now'))
        WHERE status = 'sending'
          AND id NOT IN (SELECT DISTINCT newsletter_id FROM mail_queue
                          WHERE newsletter_id IS NOT NULL AND status = 'queued')");

    nl_log("process: отправлено $sent (транзакционных " . count($tx) . ", лимит массовых сегодня " . nl_daily_cap() . ", день кампании " . nl_campaign_day() . ")");
    return $sent;
}
