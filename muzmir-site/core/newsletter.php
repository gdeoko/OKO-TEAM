<?php
/**
 * Движок массовых рассылок КЦ «Музыкальный Мир».
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

/** Оборачивает тело рассылки в фирменный HTML-лейаут письма. */
function nl_wrap_email(string $bodyHtml, string $unsubUrl, string $openPixel, string $preheader = ''): string {
    $logo  = logo_data_uri();
    $org   = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
    $addr  = h((string) cfgv('org_address', ''));
    $phone = h((string) cfgv('org_phone', ''));
    $email = h((string) cfgv('org_email', ''));
    $hours = h((string) cfgv('org_hours', ''));
    $year  = (int) cfgv('year', (int) date('Y'));
    $unsub = h($unsubUrl);
    $pre   = h($preheader);

    return <<<HTML
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>{$org}</title>
</head>
<body style="margin:0;padding:0;background:#f0e6d6;font-family:'Segoe UI',Arial,sans-serif;color:#3a2e22;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{$pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0e6d6;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#fbf6ef;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(90,50,20,.14);">
  <tr>
    <td style="background:linear-gradient(135deg,#7a2e1e 0%,#a0522d 55%,#b8860b 100%);padding:34px 40px;text-align:center;">
      <img src="{$logo}" alt="{$org}" width="96" height="96" style="display:inline-block;width:96px;height:96px;border-radius:14px;background:#fff;padding:6px;">
      <div style="margin-top:14px;color:#fff;font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;">Культурный центр «Музыкальный Мир»</div>
    </td>
  </tr>
  <tr>
    <td style="padding:40px 44px 30px;font-size:16px;line-height:1.7;color:#3a2e22;">
      {$bodyHtml}
    </td>
  </tr>
  <tr><td style="padding:0 44px;"><div style="height:1px;background:#e6d6bf;"></div></td></tr>
  <tr>
    <td style="padding:26px 44px 34px;font-size:13px;line-height:1.65;color:#8a7658;">
      <div style="font-weight:600;color:#7a2e1e;font-size:14px;margin-bottom:8px;">{$org}</div>
      <div>{$addr}</div>
      <div>Телефон: {$phone}</div>
      <div>Почта: {$email}</div>
      <div>Режим работы: {$hours}</div>
      <div style="margin-top:18px;font-size:12px;color:#a8977c;">
        Вы получили это письмо, так как оставили заявку или подписку на сайте центра.
        <a href="{$unsub}" style="color:#a0522d;text-decoration:underline;">Отписаться от рассылки</a>.
      </div>
      <div style="margin-top:10px;font-size:12px;color:#bfae92;">© {$year} {$org}</div>
    </td>
  </tr>
</table>
</td></tr>
</table>
{$openPixel}
</body>
</html>
HTML;
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

/**
 * Отправляет пачку из mail_queue через mail_send, уважая дневной лимит Gmail
 * (cfgv('mail_daily_limit')). Обновляет статусы писем и newsletters.stats_sent.
 * Зовётся из cron process_newsletter_queue.php. Возвращает число отправленных.
 */
function newsletter_process_queue(int $limit): int {
    $dailyLimit = (int) cfgv('mail_daily_limit', 400);
    $batchCap   = (int) cfgv('mail_batch_size', 40);
    if ($limit <= 0) $limit = $batchCap;

    $remaining = $dailyLimit - nl_sent_today();
    if ($remaining <= 0) { nl_log('process: дневной лимит исчерпан'); return 0; }

    $take = min($limit, $remaining);
    $rows = all(
        "SELECT * FROM mail_queue WHERE status = 'queued' ORDER BY id ASC LIMIT ?",
        [$take]
    );
    if (!$rows) return 0;

    $sent = 0;
    foreach ($rows as $row) {
        $id = (int) $row['id'];
        $opt = [];
        if (!empty($row['attach'])) $opt['attach'] = (string) $row['attach'];

        $ok = false;
        try {
            $ok = mail_send((string) $row['to_email'], (string) $row['subject'], (string) $row['body'], $opt);
        } catch (\Throwable $e) {
            nl_log('process: исключение на письме #' . $id . ' — ' . $e->getMessage());
        }

        if ($ok) {
            update('mail_queue', [
                'status'  => 'sent',
                'sent_at' => date('Y-m-d H:i:s'),
                'tries'   => (int) $row['tries'] + 1,
            ], 'id=:id', ['id' => $id]);
            if (!empty($row['newsletter_id'])) {
                q("UPDATE newsletters SET stats_sent = stats_sent + 1 WHERE id = ?", [(int) $row['newsletter_id']]);
            }
            $sent++;
        } else {
            $tries  = (int) $row['tries'] + 1;
            $status = $tries >= 3 ? 'failed' : 'queued'; // до 3 попыток
            update('mail_queue', [
                'status' => $status,
                'tries'  => $tries,
                'error'  => 'send failed',
            ], 'id=:id', ['id' => $id]);
        }
    }

    // Рассылки без остатка в очереди помечаем как отправленные.
    q("UPDATE newsletters SET status = 'sent', sent_at = COALESCE(sent_at, datetime('now'))
        WHERE status = 'sending'
          AND id NOT IN (SELECT DISTINCT newsletter_id FROM mail_queue
                          WHERE newsletter_id IS NOT NULL AND status = 'queued')");

    nl_log("process: отправлено $sent из " . count($rows));
    return $sent;
}
