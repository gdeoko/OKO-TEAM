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
    // ВИП-клуб — ПРИГЛАШЕНИЕ вступить, поэтому идёт по ВСЕЙ базе (со своей суточной
    // квотой 100/день), а не только по действующим членам: раньше письмо «вступайте
    // в клуб» получали ровно те, кто уже в клубе, и до базы оно не доходило.
    // Действующих членов, наоборот, исключаем — им приглашение не нужно.
    if ($kind === 'vip') {
        // Кому НЕ шлём приглашение: действующим членам клуба и команде центра
        // (владелец/оргкомитет/администраторы — у них клуб безлимитный по определению).
        // Раньше выборка шла только по subscribers: зарегистрированные участники,
        // не подписанные на новости, приглашения не получали вовсе.
        $staff = [];
        if (!function_exists('club_staff_emails') && is_file(BASE_PATH . '/core/club.php')) {
            require_once BASE_PATH . '/core/club.php';
        }
        if (function_exists('club_staff_emails')) {
            foreach (club_staff_emails() as $e) { $e = mb_strtolower(trim((string) $e)); if ($e !== '') $staff[] = $e; }
        }
        $staffIn = $staff ? implode(',', array_fill(0, count($staff), '?')) : "''";

        return all(
            "SELECT email, name FROM (
                 SELECT s.email AS email, s.name AS name FROM subscribers s WHERE s.active = 1
                 UNION
                 SELECT u.email AS email, u.full_name AS name FROM users u
                  WHERE COALESCE(u.email,'') <> '' AND COALESCE(u.blocked,0) = 0
                    AND COALESCE(u.notify_email,1) = 1
                    AND COALESCE(u.role,'user') NOT IN ('owner','admin','orgcom')
             )
              WHERE LOWER(email) NOT IN (
                    SELECT LOWER(u2.email) FROM club_members m JOIN users u2 ON u2.id = m.user_id
                     WHERE COALESCE(m.active,1) = 1
                       AND (m.expires_at IS NULL OR m.expires_at = '' OR m.expires_at > datetime('now'))
                       AND COALESCE(u2.email,'') <> ''
                )
                AND LOWER(email) NOT IN ($staffIn)",
            $staff
        );
    }
    // «Личный кабинет» — тоже по ВСЕЙ базе (квота 100/день): рассказываем про кабинет
    // и подписчикам, и зарегистрированным. Отписавшиеся исключены.
    if ($kind === 'kabinet') {
        return all(
            "SELECT email, name FROM subscribers WHERE active = 1
             UNION
             SELECT email, full_name AS name FROM users
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
function nl_wrap_email(string $bodyHtml, string $unsubUrl, string $openPixel, string $preheader = '', array $opt = []): string {
    if (!function_exists('mm_email_layout')) require_once __DIR__ . '/mailer.php';
    return mm_email_layout($bodyHtml, [
        'preheader'       => $preheader,
        'unsubscribe_url' => $unsubUrl,
        'pixel'           => $openPixel,
        // Письмо про сам ВИП-клуб не должно нести ещё и карточку клуба в подвале.
        'vip'             => $opt['vip'] ?? true,
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

    // ВОЛНА ЗАПУСКА СОБИРАЕТСЯ НЕ ЗДЕСЬ. Её письма персональные (личный временный
    // пароль у каждого), их ставит launch_combo_enqueue(). Обычная постановка ниже
    // сначала СТИРАЕТ неотправленные письма рассылки, а потом кладёт всем одно и то же
    // тело — то есть уничтожила бы тысячи писем с паролями и разослала бы вместо них
    // служебную заглушку «(персональное письмо: собирается под каждого получателя)».
    if (str_starts_with((string) ($n['audience'] ?? ''), 'combo:')) {
        nl_log("enqueue: #$newsletterId — волна запуска, обычная постановка запрещена (её ведёт launch_combo_enqueue)");
        return 0;
    }

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

            // Подстановка имени. Эталоны кампаний (campaign_inner) начинаются со строки
            // «Здравствуйте, {{name}}!», а здесь тело раньше уходило как есть — вся база
            // получала бы письмо с буквальным «{{name}}» в первой строке.
            $nm   = trim((string) ($r['name'] ?? ''));
            $nm   = $nm !== '' ? $nm : 'уважаемый участник';
            $tok2 = ['{{name}}', '{{имя}}'];
            $subject = str_replace($tok2, $nm, $subject);

            $unsubUrl = $base . '/api/v1/unsubscribe.php?token=' . urlencode($unsubToken);
            $body = nl_rewrite_links(str_replace($tok2, h($nm), $bodyRaw), $token);
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

/** Абсолютный потолок массовых в сутки — сумма дневных лимитов ящиков пула. */
function nl_ramp_peak(): int { return nl_daily_cap(); }

/**
 * Дневное распределение массовой рассылки по типам кампаний (в успешных письмах/день).
 *
 * С августа 2026 волна ОДНА (правило владельца): объединённое письмо запуска —
 * конкурсы месяца + личный кабинет с доступом + приглашение в клуб. Поэтому весь
 * дневной объём отдан типу 'konkurs' (400/день = 200 на каждый из двух ящиков),
 * а 'vip' и 'kabinet' обнулены: отдельных волн больше нет.
 *
 * Раньше объём делился на три (200 конкурсы + 100 ВИП + 100 кабинет), и человек
 * получал три письма подряд, а база проходилась больше двух месяцев вместо одного.
 *
 * Типы 'vip' и 'kabinet' сохранены в коде: если из пульта руками запустить
 * отдельную кампанию, ей нужно выдать квоту через nl_split_vip / nl_split_kabinet.
 */
function nl_daily_split(): array {
    $k  = (int) setting('nl_split_konkurs', '400');
    $v  = (int) setting('nl_split_vip',     '0');
    $kb = (int) setting('nl_split_kabinet', '0');
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
    // ПРОГРЕВА БОЛЬШЕ НЕТ (правило владельца, август 2026): полный темп с первого дня.
    // Дневной потолок = сумма лимитов ящиков пула, по 200 на каждый → 400 в день.
    // Так база из 8200 адресов проходится за 21 рабочий день, а не за два месяца.
    // Ровность обеспечивает не урезанная квота, а пауза 2,5 минуты на ящик
    // (nl_box_gap_sec) — письма идут ниточкой, а не пачками.
    $boxes = function_exists('mail_fallback_accounts') ? count(mail_fallback_accounts([], 'bulk')) : 0;
    if ($boxes < 1) $boxes = 1;
    return $boxes * nl_per_box_cap();
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

/**
 * ОТКАЗ АДРЕСАТА ИЛИ НАШ СОБСТВЕННЫЙ СБОЙ?
 *
 * Отличать обязательно. «Ящика не существует» — вина адреса, его надо вывести из базы.
 * «Не смогли залогиниться на SMTP», «превышен суточный лимит», «нет связи» — наша
 * собственная проблема, адрес живой. Раньше разницы не было: часовой сбой почтовика
 * НАВСЕГДА выключал бы до 400 живых подписчиков в день — и они больше никогда
 * не получили бы ни одной рассылки.
 *
 * @return string 'hard' — виноват адрес; 'soft' — виноваты мы (или временная причина).
 */
function nl_failure_kind(string $err): string {
    $e = mb_strtolower($err);
    if (trim($e) === '') return 'soft';          // причины нет — человека не трогаем

    // 1. ЯВНЫЙ ОТКАЗ ПО ПОЛУЧАТЕЛЮ. Такие формулировки не спутать ни с чем.
    foreach (['no such user', 'user unknown', 'unknown user', 'mailbox not found',
              'mailbox unavailable', 'no such mailbox', 'does not exist', 'no mailbox',
              'recipient rejected', 'invalid recipient', 'address rejected',
              'unrouteable address', 'некорректный адрес', 'нет такого', 'не существует',
              '5.1.1', '5.1.0', '5.1.2', '5.1.3', '5.1.6'] as $w) {
        if (mb_strpos($e, $w) !== false) return 'hard';
    }

    // 2. ВРЕМЕННОЕ И НАШЕ. Сеть, авторизация, квоты, серые списки — адрес живой.
    //    Сюда же «data failed»: на этапе DATA почтовик отвергает НАШЕ ПИСЬМО
    //    (спам-фильтр, репутация отправителя), а не ящик получателя.
    foreach (['data failed', 'ни один из', 'не настроен ни один',
              'authentication', 'auth', 'password', 'пароль', 'login',
              'соединен', 'connect', 'refused', 'timeout', 'таймаут', 'timed out',
              'network', 'ssl', 'tls', 'certificate',
              'quota', 'лимит', 'limit exceeded', 'too many', 'rate',
              'try again', 'temporar', 'greylist', 'deferred',
              '421', '450', '451', '452', '4.7.', '4.3.', '4.4.'] as $w) {
        if (mb_strpos($e, $w) !== false) return 'soft';
    }

    // 3. ОСТАЛЬНЫЕ ПОСТОЯННЫЕ ОТКАЗЫ (5xx без пояснения). На этапе RCPT почтовик
    //    именно так отвечает про несуществующий ящик — самый частый случай
    //    в импортированной базе. Пункты 1-2 выше уже отсеяли нашу вину.
    if (preg_match('~\b5[0-9]{2}\b~', $e)) return 'hard';

    return 'soft';   // сомнение — всегда в пользу человека: живой адрес дороже квоты
}


/**
 * Разбирает массовые письма, которые окончательно не ушли (status=failed).
 *
 * Отказ по адресату — адрес выводится из базы (иначе дневная квота тратится впустую).
 * Наш собственный сбой — письмо ВОЗВРАЩАЕТСЯ в очередь (до 5 попыток), подписчик
 * остаётся активным: человек не виноват, что у нас упал SMTP.
 *
 * @return int сколько адресов реально выведено из базы
 */
function nl_prune_failed(): int {
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN soft_tries INTEGER DEFAULT 0"); } catch (\Throwable $e) {}
    $rows = all("SELECT id, to_email, COALESCE(error,'') AS error, COALESCE(soft_tries,0) AS soft_tries
                   FROM mail_queue WHERE status='failed' AND COALESCE(priority,0)>0");
    $n = 0; $back = 0;
    foreach ($rows as $r) {
        $e = mb_strtolower(trim((string) $r['to_email']));
        if ($e === '') continue;
        if (nl_failure_kind((string) $r['error']) === 'hard') {
            $sub = one("SELECT active FROM subscribers WHERE email=?", [$e]);
            if ($sub && (int) $sub['active'] === 1) { nl_mark_bounced($e, 'отказ адресата'); $n++; }
            continue;
        }
        // Наш сбой: возвращаем письмо в очередь, подписчика не трогаем.
        $st = (int) $r['soft_tries'];
        if ($st < 5) {
            update('mail_queue', ['status' => 'queued', 'tries' => 0, 'soft_tries' => $st + 1],
                   'id=:id', ['id' => (int) $r['id']]);
            $back++;
        }
    }
    if ($back > 0) nl_log("process: вернули в очередь после НАШЕГО сбоя — $back (адреса живые, из базы не выводим)");
    return $n;
}

/**
 * Отправляет пачку из mail_queue через mail_send, уважая дневной лимит с учётом
 * прогрева (nl_daily_cap). Обновляет статусы писем и newsletters.stats_sent.
 * Зовётся из cron process_newsletter_queue.php. Возвращает число отправленных.
 */
/**
 * ГЛОБАЛЬНЫЙ СТОП-КРАН массовых коммуникаций.
 *
 * Пока settings.mass_sending = '0' наружу не уходит НИЧЕГО массового: рассылки по базе,
 * авто-посты ВК, волны запуска, дожимы и вовлечение. Личные (транзакционные) письма —
 * результаты, дипломы, счета, восстановление пароля — продолжают ходить как обычно:
 * они адресные и к запуску отношения не имеют.
 *
 * Включается кнопкой в пульте запуска, когда сайт готов к старту.
 */
function mass_sending_enabled(): bool {
    return (string) setting('mass_sending', '0') === '1';
}

/** Включить/выключить массовые коммуникации (пульт запуска). */
function mass_sending_set(bool $on): void {
    set_setting('mass_sending', $on ? '1' : '0');
    set_setting('mass_sending_changed_at', date('Y-m-d H:i:s'));
}

/**
 * ОКНО МАССОВЫХ РАССЫЛОК (правило владельца, август 2026).
 *
 * Массовое уходит только с 1-го по 24-е число месяца и только с 09:00 до 18:00 МСК.
 * Воскресенье РАЗРЕШЕНО — в отличие от общего рабочего календаря (st_is_workday),
 * который воскресенье исключает: тот календарь про сроки оценки и наградные
 * документы, а рассылку по базе в выходной слать можно и нужно.
 *
 * Личные (транзакционные) письма это окно НЕ ограничивает: результат, диплом,
 * счёт и восстановление пароля уходят в любое время суток.
 *
 * Переопределяется настройками nl_window_day_from / nl_window_day_to /
 * nl_window_hour_from / nl_window_hour_to.
 */
function nl_bulk_window_open(?\DateTime $at = null): array {
    $t   = $at ?: new \DateTime('now');
    $day = (int) $t->format('j');
    $h   = (int) $t->format('G');

    $dFrom = (int) setting('nl_window_day_from', '1');
    $dTo   = (int) setting('nl_window_day_to',   '24');
    $hFrom = (int) setting('nl_window_hour_from', '9');
    $hTo   = (int) setting('nl_window_hour_to',  '18');

    if ($day < $dFrom || $day > $dTo) {
        return ['open' => false, 'why' => "рассылка идёт с {$dFrom}-го по {$dTo}-е число, сегодня {$day}-е"];
    }
    if ($h < $hFrom || $h >= $hTo) {
        return ['open' => false, 'why' => "рассылка идёт с {$hFrom}:00 до {$hTo}:00 МСК, сейчас " . $t->format('H:i')];
    }
    return ['open' => true, 'why' => ''];
}

/** Суточный лимит массовых НА ОДИН ящик (чтобы не упереться в лимит провайдера). */
function nl_per_box_cap(): int { return max(1, (int) setting('nl_per_box_cap', '200')); }

/**
 * Пауза между двумя письмами С ОДНОГО ящика, в секундах.
 *
 * 150 секунд = 2,5 минуты (правило владельца). За рабочее окно 9:00-18:00 это
 * 540 / 2,5 = 216 слотов на ящик — с запасом покрывает дневной лимит 200.
 * Ровный темп важнее скорости: письма, уходящие пачкой, почтовики режут как спам.
 */
function nl_box_gap_sec(): int { return max(5, (int) setting('nl_box_gap_sec', '150')); }

/** Метка времени последней успешной отправки с ящика (unix, 0 — сегодня ещё не слал). */
function nl_box_last_sent_ts(string $box): int {
    $box = mb_strtolower(trim($box));
    if ($box === '') return 0;
    $v = (string) setting('nl_box_last:' . $box, '');
    $ts = $v !== '' ? (int) $v : 0;
    // Отметка живёт в настройках: это дешевле, чем каждую минуту искать MAX(sent_at)
    // по очереди в сотни тысяч строк.
    return $ts;
}

/** Отметить, что ящик только что отправил письмо (запускает его паузу). */
function nl_box_touch(string $box): void {
    $box = mb_strtolower(trim($box));
    if ($box !== '') set_setting('nl_box_last:' . $box, (string) time());
}

/**
 * ПОЛНОЕ УДАЛЕНИЕ ЧЕЛОВЕКА ПО НЕДОСТАВКЕ (правило владельца, август 2026).
 *
 * Если ящик не существует или заблокирован — адрес больше никогда не примет письмо.
 * Держать его в базе бессмысленно: он съедает место в дневной квоте и портит
 * репутацию отправителя. Поэтому вычищаем везде: подписка, очередь писем,
 * учётная запись с кабинетом.
 *
 * ВАЖНО: сюда попадают ТОЛЬКО отказы адресата (nl_failure_kind() === 'hard').
 * Наш собственный сбой SMTP человека не трогает — письмо просто вернётся в очередь.
 *
 * Учётную запись не удаляем, если за человеком числятся заявки или заказы: это
 * живая история участия, её нельзя стирать из-за сломанной почты. Такой аккаунт
 * только отвязывается от рассылок.
 *
 * @return bool true, если человек действительно вычищен
 */
function nl_purge_person(string $email, string $reason = 'недоставка'): bool {
    $email = mb_strtolower(trim($email));
    if ($email === '') return false;
    $hard = false;
    try {
        // 1. Подписка — вон.
        $sub = one("SELECT id FROM subscribers WHERE LOWER(email)=?", [$email]);
        if ($sub) { q("DELETE FROM subscribers WHERE id=?", [(int) $sub['id']]); $hard = true; }

        // 2. Неотправленные письма этому адресу — снять с очереди.
        q("UPDATE mail_queue SET status='cancelled', error=? WHERE LOWER(to_email)=? AND status IN ('queued','paused')",
          [mb_substr('снято: ' . $reason, 0, 300), $email]);

        // 3. Учётная запись с кабинетом.
        $u = one("SELECT id, role FROM users WHERE LOWER(email)=?", [$email]);
        if ($u) {
            $uid  = (int) $u['id'];
            $role = (string) ($u['role'] ?? 'user');
            $staff = in_array($role, ['owner', 'admin', 'orgcom', 'moderator', 'jury', 'designer'], true);
            $apps  = (int) (scalar("SELECT COUNT(*) FROM applications WHERE user_id=?", [$uid]) ?? 0);
            $ords  = 0;
            try { $ords = (int) (scalar("SELECT COUNT(*) FROM award_orders WHERE user_id=?", [$uid]) ?? 0); } catch (\Throwable $e) {}
            if ($staff || $apps > 0 || $ords > 0) {
                // История участия дороже почты: аккаунт оставляем, но от рассылок отвязываем.
                try { update('users', ['notify_email' => 0], 'id=:id', ['id' => $uid]); } catch (\Throwable $e) {}
                nl_log("purge: $email — аккаунт сохранён (заявок $apps, заказов $ords, роль $role), отписан от рассылок");
            } else {
                foreach (['notifications' => 'user_id', 'sessions' => 'user_id', 'club_members' => 'user_id'] as $t => $col) {
                    try { q("DELETE FROM $t WHERE $col=?", [$uid]); } catch (\Throwable $e) {}
                }
                q("DELETE FROM users WHERE id=?", [$uid]);
                $hard = true;
                nl_log("purge: $email — учётная запись и кабинет удалены ($reason)");
            }
        }
    } catch (\Throwable $e) {
        nl_log('purge: ошибка на ' . $email . ' — ' . $e->getMessage());
        return false;
    }
    if ($hard) nl_log("purge: $email вычищен из базы ($reason)");
    return $hard;
}

/** Сколько массовых ушло сегодня с конкретного ящика. */
function nl_box_sent_today(string $box): int {
    if ($box === '') return 0;
    try {
        return (int) scalar(
            "SELECT COUNT(*) FROM mail_queue
              WHERE status='sent' AND COALESCE(priority,0) > 0
                AND sent_at >= ? AND LOWER(COALESCE(sent_via,'')) = ?",
            [date('Y-m-d 00:00:00'), mb_strtolower($box)]
        );
    } catch (\Throwable $e) { return 0; }
}

/**
 * СБОРКА ПЕРСОНАЛЬНОГО ПИСЬМА В МОМЕНТ ОТПРАВКИ.
 *
 * В очереди у таких писем пустое тело и «рецепт» в колонке build:
 *   {"kind":"combo","nlid":12}
 *
 * Что это даёт:
 *   • текст, поправленный в пульте запуска, уходит всем, кому письмо ещё не ушло;
 *   • блоки «кабинет» и «клуб» решаются по СЕГОДНЯШНЕМУ состоянию человека:
 *     вошёл в кабинет за эту неделю — блок с паролем ему уже не нужен;
 *   • временный пароль рождается в секунду отправки, поэтому до самого письма
 *     человек спокойно пользуется прежним паролем;
 *   • очередь весит килобайты вместо сотен мегабайт вёрстки.
 *
 * @return array{subject:string,body:string,after:?callable}|null null — собрать не вышло
 */
function nl_build_body(array $row): ?array {
    $spec = json_decode((string) ($row['build'] ?? ''), true);
    if (!is_array($spec)) return null;
    $kind  = (string) ($spec['kind'] ?? '');
    $email = mb_strtolower(trim((string) $row['to_email']));
    if ($email === '') return null;

    if ($kind !== 'combo') return null;

    foreach (['launch_combo', 'person_name', 'kabinet_onboarding', 'mail_campaigns'] as $m) {
        $p = BASE_PATH . '/core/' . $m . '.php';
        if (is_file($p)) require_once $p;
    }
    if (!function_exists('launch_combo_inner')) return null;

    // Состояние человека НА СЕЙЧАС.
    $u = one("SELECT id, full_name, last_login FROM users
               WHERE LOWER(email) = ? AND COALESCE(blocked,0) = 0
                 AND COALESCE(role,'user') NOT IN ('owner','admin','orgcom','moderator','jury','designer')",
             [$email]);
    // Блок «личный кабинет» рассылается по базе ОДИН РАЗ — в первый месяц.
    // Дальше доступ человек получает при подаче заявки (см. cron/monthly_launch.php).
    $cabinetAllowed = (string) setting('combo_cabinet_block', '1') === '1';
    $needCabinet = $cabinetAllowed && $u && trim((string) ($u['last_login'] ?? '')) === '';
    // Доступ уже отправляли лично — при подаче заявки. Повторять его в письме волны
    // нельзя: новый пароль обесценит тот, что человек получил пару дней назад
    // и, возможно, ещё не успел применить.
    if ($needCabinet) {
        try {
            $already = one("SELECT 1 FROM mail_queue
                             WHERE LOWER(to_email) = ? AND status = 'sent'
                               AND subject LIKE '%личный кабинет создан%'", [$email]);
            if ($already) $needCabinet = false;
        } catch (\Throwable $e) {}
    }

    $inClub = false;
    try {
        $inClub = (bool) one(
            "SELECT 1 FROM club_members m JOIN users u2 ON u2.id = m.user_id
              WHERE LOWER(u2.email) = ? AND COALESCE(m.active,1) = 1
                AND (m.expires_at IS NULL OR m.expires_at = '' OR m.expires_at > datetime('now'))",
            [$email]);
    } catch (\Throwable $e) {}
    $needVip = !$inClub;

    // Имя: своё, иначе распознанное по адресу.
    $stored = trim((string) ($row['to_name'] ?? '')) ?: trim((string) ($u['full_name'] ?? ''));
    $name = function_exists('person_greeting_name') ? person_greeting_name($email, $stored) : $stored;

    // Пароль — только если блок кабинета нужен. Хеш применим ПОСЛЕ отправки.
    $pass = ''; $after = null;
    if ($needCabinet && function_exists('kabinet_gen_password')) {
        $pass = kabinet_gen_password();
        $hash = password_hash($pass, PASSWORD_DEFAULT);
        $uid  = (int) $u['id'];
        $after = static function () use ($uid, $hash): void {
            update('users', ['password_hash' => $hash], 'id=:id', ['id' => $uid]);
        };
    }

    $inner = launch_combo_inner($needCabinet, $needVip, $email, $name, $pass);

    $nid   = (int) ($spec['nlid'] ?? 0);
    $token = $nid ? nl_track_token($nid) : '';
    $pixel = $token !== '' ? nl_open_pixel($token) : '';
    if ($token !== '') $inner = nl_rewrite_links($inner, $token);

    [$unsubToken, ] = nl_ensure_subscriber($email, $name, 'newsletter');
    $unsub = rtrim((string) cfgv('base_url'), '/') . '/api/v1/unsubscribe.php?token=' . urlencode((string) $unsubToken);

    $body = nl_wrap_email($inner, $unsub, $pixel, mb_substr(trim(strip_tags($inner)), 0, 120), ['vip' => !$needVip]);

    // Тема тоже берётся свежая — её тоже правят в пульте.
    $subject = function_exists('launch_combo_subject') ? launch_combo_subject() : (string) $row['subject'];

    return ['subject' => $subject, 'body' => $body, 'after' => $after];
}

function newsletter_process_queue(int $limit): int {
    $dailyLimit = nl_daily_cap();
    $gap        = max(0, (int) cfgv('mail_send_gap', 30));   // антибан-пауза для МАССОВЫХ
    $perRun     = max(1, (int) cfgv('mail_throttle_per_run', 2));
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN priority INTEGER DEFAULT 0"); } catch (\Throwable $e) {}
    // scheduled_at — плановое время отправки. NULL/пусто = сразу. Позволяет админу из
    // «живого пульта» (admin/dispatch.php) отложить письмо или задержать его.
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN scheduled_at TEXT"); } catch (\Throwable $e) {}
    // sent_via — каким ящиком реально ушло письмо. Без этой отметки нельзя считать
    // суточный лимит на КАЖДЫЙ ящик и раскладывать нагрузку между ними поровну.
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN sent_via TEXT DEFAULT ''"); } catch (\Throwable $e) {}
    // build — «рецепт» письма для персональных волн: тело собирается в момент
    // отправки, а не при постановке (см. nl_build_body ниже).
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN build TEXT"); } catch (\Throwable $e) {}
    $nowTs = date('Y-m-d H:i:s');

    // Отправка одного письма очереди с обновлением статуса.
    // $account — необязательный аккаунт-отправитель (для массовых рассылок из пула).
    $sendRow = function (array $row, array $account = []): bool {
        $id = (int) $row['id'];
        $opt = [];
        if (!empty($row['attach'])) $opt['attach'] = (string) $row['attach'];
        if ($account) $opt['account'] = $account;

        // ТЕЛО ПЕРСОНАЛЬНОГО ПИСЬМА СОБИРАЕТСЯ ЗДЕСЬ, В СЕКУНДУ ОТПРАВКИ.
        // Поэтому текст, поправленный в пульте, догоняет всех, кому ещё не ушло,
        // а временный пароль выдаётся ровно тому, кто письмо сейчас получит.
        $afterSend = null;                      // что сделать ПОСЛЕ успешной отправки
        if (trim((string) ($row['build'] ?? '')) !== '') {
            $built = nl_build_body($row);
            if ($built === null) {
                // Собрать не удалось — письмо не теряем, попробуем в следующий раз.
                update('mail_queue', ['error' => 'сборка письма не удалась, попробуем позже'], 'id=:id', ['id' => $id]);
                return false;
            }
            $row['subject'] = $built['subject'];
            $row['body']    = $built['body'];
            $afterSend      = $built['after'] ?? null;
        }
        // ПРИОРИТЕТ ОБЯЗАН ДОЙТИ ДО mail_send_failover.
        // Внутри него пул письма считается заново: mail_pool_for(['priority'=>…,'subject'=>…]).
        // Без priority он всегда видел 0 и определял пул ПО ТЕМЕ. Тема волны запуска —
        // «Открыт приём заявок — 4 конкурса с наградами и дипломами» — содержит «наград»
        // и «диплом», поэтому пул выходил 'awards', а выбранный ротацией ящик news@
        // в awards-пуле отсутствует и молча выбрасывался: вся волна ушла бы с наградного
        // ящика и официальной почты центра, мимо ротации и мимо лимита 200/ящик.
        $opt['priority'] = (int) ($row['priority'] ?? 0);
        $ok = false;
        // Автозамена ящика: если основной не принял — письмо уйдёт со следующей почты.
        try {
            $ok = function_exists('mail_send_failover')
                ? mail_send_failover((string) $row['to_email'], (string) $row['subject'], (string) $row['body'], $opt)
                : mail_send((string) $row['to_email'], (string) $row['subject'], (string) $row['body'], $opt);
        }
        catch (\Throwable $e) { nl_log('process: исключение #' . $id . ' — ' . $e->getMessage()); }
        if ($ok) {
            // Если сработала резервная почта — фиксируем это в письме очереди.
            $sw = function_exists('mail_switched') ? mail_switched() : '';
            if ($sw !== '') {
                update('mail_queue', ['error' => 'Отправлено с резервной почты: ' . $sw], 'id=:id', ['id' => $id]);
                nl_log('process: #' . $id . ' ушло с резервной почты ' . $sw);
            }
            // Каким ящиком реально ушло: при подмене — резервным, иначе выбранным.
            // Эту отметку читает nl_box_sent_today() для лимита на каждый ящик.
            $via = $sw !== '' ? $sw : (string) ($account['user'] ?? '');
            update('mail_queue', ['status' => 'sent', 'sent_at' => date('Y-m-d H:i:s'), 'sent_via' => mb_strtolower($via), 'tries' => (int) $row['tries'] + 1], 'id=:id', ['id' => $id]);
            // Пароль меняем ТОЛЬКО теперь: письмо с ним уже у человека.
            if (is_callable($afterSend)) { try { $afterSend(); } catch (\Throwable $e) { nl_log('post-send #' . $id . ': ' . $e->getMessage()); } }
            if (!empty($row['newsletter_id'])) q("UPDATE newsletters SET stats_sent = stats_sent + 1 WHERE id = ?", [(int) $row['newsletter_id']]);
        } else {
            $tries = (int) $row['tries'] + 1;
            // Пишем РЕАЛЬНУЮ причину (нет SMTP-доступов, отказ сервера, плохой адрес),
            // иначе в админке видно только «send failed» и непонятно, что чинить.
            $why = function_exists('mail_last_error') ? mail_last_error() : '';
            update('mail_queue', [
                'status' => $tries >= 3 ? 'failed' : 'queued',
                'tries'  => $tries,
                'error'  => mb_substr($why !== '' ? $why : 'Отправка не удалась', 0, 300),
            ], 'id=:id', ['id' => $id]);
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

    // 2) МАССОВЫЕ (priority>0) — только когда массовые коммуникации включены в пульте.
    //    До старта они просто ждут в очереди: ничего не теряется и никуда не уходит.
    if (!mass_sending_enabled()) {
        nl_log('process: массовые рассылки выключены стоп-краном (пульт запуска) — отправлены только личные письма');
        return $sent;
    }
    //    Окно рассылки: 1-24 число, 09:00-18:00 МСК (воскресенье разрешено).
    //    Вне окна массовые ждут в очереди — личные письма выше уже ушли.
    $win = nl_bulk_window_open();
    if (!$win['open']) {
        nl_log('process: массовые вне окна отправки — ' . $win['why']);
        return $sent;
    }
    //    Нагрузка раскладывается ПОРОВНУ между ящиками bulk-пула, не больше
    //    nl_per_box_cap (200) с каждого: иначе весь объём уходил через первый ящик
    //    пула и упирался в суточный лимит провайдера.
    nl_ensure_campaign_type_col();

    // ПРОСРОЧЕННАЯ ВОЛНА ЗАПУСКА НЕ УХОДИТ В СЛЕДУЮЩИЙ МЕСЯЦ.
    // Письмо запуска зовёт подать заявку на конкурсы ЭТОГО месяца — приём закрывается
    // 25-го. Что не успело уйти до конца месяца, в следующем стало бы приглашением на
    // уже закрытый конкурс, с кнопкой «подать заявку», которая никуда не ведёт.
    // Такие письма снимаем: этих людей подхватит волна нового месяца — с актуальными
    // конкурсами и свежим паролем.
    try {
        $stale = q("UPDATE mail_queue SET status='cancelled',
                        error='снято: волна прошлого месяца, конкурсы уже закрыты'
                     WHERE status IN ('queued','paused') AND COALESCE(priority,0)>0
                       AND newsletter_id IN (SELECT id FROM newsletters
                                              WHERE audience LIKE 'combo:%' AND audience < ?)",
                   ['combo:' . date('Y-m')]);
        $nStale = is_object($stale) && method_exists($stale, 'rowCount') ? (int) $stale->rowCount() : 0;
        if ($nStale > 0) nl_log("process: снято писем прошлых волн запуска — $nStale (их получатели войдут в волну текущего месяца)");
    } catch (\Throwable $e) {}

    // ── ТЕМП ОТПРАВКИ ────────────────────────────────────────────────────────
    // Правило владельца (август 2026): 400 УСПЕШНЫХ писем в день — по 200 с каждого
    // из двух ящиков, ровным темпом одно письмо в 2,5 минуты с ящика, с 9:00 до 18:00.
    // 9 часов = 540 минут; 540 / 2,5 = 216 слотов на ящик — с запасом на 200 писем.
    //
    // Темп держится НЕ паузой внутри прогона (крон идёт раз в минуту, спать в нём
    // нельзя — заблокирует и личные письма), а отметкой времени последней отправки
    // каждого ящика: ящик участвует в прогоне, только если с его прошлого письма
    // прошло достаточно времени.
    //
    // Считаем только УСПЕШНЫЕ. Если письмо не ушло, слот ящика не тратится: берём
    // следующего получателя тут же, в этом же прогоне.
    $globalRemaining = $dailyLimit - nl_bulk_sent_today();
    if ($globalRemaining > 0) {
        $split = nl_daily_split();
        $typeLeft = [];
        foreach (['konkurs', 'vip', 'kabinet'] as $t) {
            $typeLeft[$t] = max(0, (int) ($split[$t] ?? 0) - nl_bulk_sent_today_type($t));
        }
        $allowed = array_keys(array_filter($typeLeft, fn($n) => $n > 0));

        // Ящики: у каждого свой дневной остаток и свой слот по времени.
        $boxes   = function_exists('mail_fallback_accounts') ? mail_fallback_accounts([], 'bulk') : [];
        $gapSec  = nl_box_gap_sec();
        $ready   = [];      // индексы ящиков, которым сейчас можно отправлять
        foreach ($boxes as $bi => $b) {
            $u = mb_strtolower((string) ($b['user'] ?? ''));
            if ($u === '') continue;
            if (nl_box_sent_today($u) >= nl_per_box_cap()) continue;          // дневной лимит ящика выбран
            // Ящик, который подряд отказывает (почтовик срезал его как спамера),
            // слот не получает: каждая попытка с него — выброшенные секунды и лишний
            // повод для почтовика. Первый успешный ответ обнуляет счётчик сам.
            if (function_exists('mail_account_penalty') && mail_account_penalty($b)) continue;
            $last = nl_box_last_sent_ts($u);
            if ($last > 0 && (time() - $last) < $gapSec) continue;            // слот ещё не подошёл
            $ready[$bi] = $u;
        }

        if (!$allowed) {
            nl_log('process: суточные квоты всех типов (konkurs/vip/kabinet) на сегодня исчерпаны');
        } elseif (!$ready) {
            // Это нормальное состояние между слотами — в лог не шумим каждую минуту.
        } else {
            $ph   = implode(',', array_fill(0, count($allowed), '?'));
            // Берём с запасом: часть писем может не уйти (мёртвые адреса), и тогда
            // мы сразу пробуем следующее тем же ящиком, не теряя слот.
            $bulk = all(
                "SELECT q.*, COALESCE(q.campaign_type, n.campaign_type, 'konkurs') AS ctype
                   FROM mail_queue q LEFT JOIN newsletters n ON n.id = q.newsletter_id
                  WHERE q.status='queued' AND COALESCE(q.priority,0)>0
                    AND (q.scheduled_at IS NULL OR q.scheduled_at='' OR q.scheduled_at<=?)
                    AND COALESCE(q.campaign_type, n.campaign_type, 'konkurs') IN ($ph)
                  ORDER BY q.id ASC LIMIT ?",
                array_merge([$nowTs], $allowed, [max(20, count($ready) * 20)])
            );

            $bulkSent = 0;
            foreach ($ready as $bi => $boxUser) {
                if ($globalRemaining - $bulkSent <= 0) break;
                $acc  = $boxes[$bi];
                $done = false;
                // Один УСПЕШНЫЙ отправленный на слот ящика. Неудачные не считаются:
                // мёртвый адрес выводится из базы, и мы сразу берём следующего.
                foreach ($bulk as $k => $row) {
                    if ($done) break;
                    if (!isset($bulk[$k])) continue;
                    $ct = (string) ($row['ctype'] ?? 'konkurs');
                    if (($typeLeft[$ct] ?? 0) <= 0) continue;
                    unset($bulk[$k]);                       // письмо занято этим прогоном
                    if ($sendRow($row, $acc)) {
                        $sent++; $bulkSent++; $typeLeft[$ct]--;
                        // Слот ставим ТОМУ ящику, который реально отправил. Если выбранный
                        // отказал и сработала автозамена, паузу должен получить заменивший,
                        // иначе он отправит два письма подряд без выдержки.
                        $really = function_exists('mail_switched') ? mb_strtolower(mail_switched()) : '';
                        nl_box_touch($really !== '' ? $really : $boxUser);
                        $done = true;
                    } else {
                        // Не ушло. Разбираем причину сразу: отказ адресата — человека
                        // вычищаем отовсюду и идём к следующему, наш сбой — письмо
                        // вернётся в очередь позже (nl_prune_failed).
                        $why = function_exists('mail_last_error') ? mail_last_error() : '';
                        if (nl_failure_kind($why) === 'hard') {
                            nl_purge_person((string) $row['to_email'], 'отказ адресата: ' . mb_substr($why, 0, 120));
                        }
                    }
                }
            }
            if ($bulkSent > 0) {
                nl_log('process: отправлено массовых за прогон — ' . $bulkSent
                     . ' (ящики: ' . implode(', ', $ready) . ')');
            }
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
