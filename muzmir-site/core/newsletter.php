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
 * Форматы: 'all' | 'segment:<тег>' | 'competition:<id>'.
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
function newsletter_enqueue(int $newsletterId): int {
    $n = one("SELECT * FROM newsletters WHERE id = ?", [$newsletterId]);
    if (!$n) { nl_log("enqueue: рассылка #$newsletterId не найдена"); return 0; }

    $audience = (string) ($n['audience'] ?? 'all');
    $source   = str_starts_with($audience, 'competition:') ? 'competition' : 'newsletter';
    $recips   = nl_resolve_recipients($audience);

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
                'status'        => 'queued',
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

/**
 * Отправляет пачку из mail_queue через mail_send, уважая дневной лимит Gmail
 * (cfgv('mail_daily_limit')). Обновляет статусы писем и newsletters.stats_sent.
 * Зовётся из cron process_newsletter_queue.php. Возвращает число отправленных.
 */
function newsletter_process_queue(int $limit): int {
    $dailyLimit = (int) cfgv('mail_daily_limit', 400);
    $gap        = max(0, (int) cfgv('mail_send_gap', 30));   // антибан-пауза для МАССОВЫХ
    $perRun     = max(1, (int) cfgv('mail_throttle_per_run', 2));
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN priority INTEGER DEFAULT 0"); } catch (\Throwable $e) {}

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
    $tx = all("SELECT * FROM mail_queue WHERE status='queued' AND COALESCE(priority,0)=0 ORDER BY id ASC LIMIT 30");
    foreach ($tx as $row) { if ($sendRow($row, $route($row))) $sent++; }

    // 2) МАССОВЫЕ (priority>0) — через news@музыкальный-мир.рф, в рамках дневного лимита.
    $remaining = $dailyLimit - nl_bulk_sent_today();
    if ($remaining > 0) {
        $take = min(max(1, $perRun), $remaining);
        $bulk = all("SELECT * FROM mail_queue WHERE status='queued' AND COALESCE(priority,0)>0 ORDER BY id ASC LIMIT ?", [$take]);
        $i = 0;
        foreach ($bulk as $row) {
            if ($i++ > 0 && $gap > 0) sleep($gap);
            if ($sendRow($row, $route($row))) $sent++;
        }
    } else {
        nl_log('process: дневной лимит массовых исчерпан (транзакционные отправлены)');
    }

    // Рассылки без остатка в очереди помечаем как отправленные.
    q("UPDATE newsletters SET status = 'sent', sent_at = COALESCE(sent_at, datetime('now'))
        WHERE status = 'sending'
          AND id NOT IN (SELECT DISTINCT newsletter_id FROM mail_queue
                          WHERE newsletter_id IS NOT NULL AND status = 'queued')");

    nl_log("process: отправлено $sent (транзакционных " . count($tx) . ")");
    return $sent;
}
