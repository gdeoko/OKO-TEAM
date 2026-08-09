<?php
/**
 * ОБЪЕДИНЁННОЕ ПИСЬМО ЗАПУСКА (правило владельца, август 2026).
 *
 * Вместо трёх отдельных волн — одно письмо на человека, тремя блоками:
 *   1. Открыт приём заявок — все конкурсы месяца с афишами.
 *   2. Личный кабинет — ЛОГИН и ВРЕМЕННЫЙ ПАРОЛЬ (персонально, только тем, кто
 *      ни разу не входил).
 *   3. Клуб постоянных участников — приглашение (только тем, кто ещё не в клубе).
 *
 * ЗАЧЕМ. Раздельно это было 3 × 8200 = 24 600 писем: при квоте 400/день и двух
 * ящиках база проходилась бы больше двух месяцев. Одним письмом — 8200, то есть
 * ~21 рабочий день при 400/день. Плюс человек получает один конверт вместо трёх.
 *
 * ПОЧЕМУ НЕЛЬЗЯ БЫЛО ПРОСТО СКЛЕИТЬ ШАБЛОНЫ. Массовая рассылка
 * (newsletter_enqueue) строит тело ОДИН раз и кладёт всем одинаковое — персональный
 * пароль туда не подставить. Поэтому здесь письмо собирается ПОД КАЖДОГО получателя,
 * как в kabinet_onboarding_enqueue().
 *
 * ГЛАВНАЯ ОСТОРОЖНОСТЬ. Блок с паролем идёт ТОЛЬКО тем, у кого users.last_login IS NULL.
 * У действующих участников свой пароль: выдать им новый — значит выкинуть их из
 * аккаунта прямо в день запуска. Таким людям блок кабинета не добавляется вовсе.
 *
 * Идемпотентность: письма привязаны к одной строке newsletters (кампания месяца).
 * Повторный вызов не поставит второе письмо тому же адресу.
 */
declare(strict_types=1);

require_once __DIR__ . '/newsletter.php';
require_once __DIR__ . '/mail_campaigns.php';
require_once __DIR__ . '/kabinet_onboarding.php';

/** Тема объединённого письма (переопределяется в пульте: launch_mail_subject:combo). */
function launch_combo_subject(): string {
    $ov = trim((string) setting('launch_mail_subject:combo', ''));
    if ($ov !== '') return $ov;
    $s = campaign_subject('new_competitions');
    return $s !== '' ? $s : 'Открыт приём заявок — конкурсы месяца';
}

/**
 * Внутренний HTML письма под конкретного получателя.
 *
 * @param bool   $withCabinet добавлять ли блок логина/пароля
 * @param bool   $withVip     добавлять ли приглашение в клуб
 * @param string $email       логин (он же адрес)
 * @param string $name        имя для обращения
 * @param string $pass        временный пароль (только если $withCabinet)
 */
function launch_combo_inner(bool $withCabinet, bool $withVip, string $email, string $name, string $pass): string {
    // Тело, отредактированное в пульте запуска, важнее эталона. Оно хранится
    // с токенами {{name}} {{login}} {{password}} — подстановка ниже общая для
    // обоих путей, поэтому оверрайд не ломает персонализацию.
    $ov = trim((string) setting('launch_mail_html:combo', ''));
    if ($ov !== '') {
        $inner = $ov;
    } else {
        // 1. Конкурсы месяца — эталон кампании «новые конкурсы» (с афишами и кнопками).
        $inner = campaign_inner('new_competitions');

        // 2. Личный кабинет с доступом — только тем, кто ещё ни разу не входил.
        if ($withCabinet) {
            $inner .= '<div style="height:1px;background:#E8DFC8;margin:26px 0"></div>' . kabinet_onboarding_inner();
        }

        // 3. Клуб постоянных участников — только тем, кто ещё не состоит.
        if ($withVip) {
            $inner .= '<div style="height:1px;background:#E8DFC8;margin:26px 0"></div>' . campaign_inner('vip');
        }
    }

    return str_replace(
        ['{{name}}', '{{login}}', '{{password}}'],
        // Токены оставляем как есть, если их передали токенами (режим редактора пульта).
        [
            $name === '{{name}}'         ? '{{name}}'     : h($name !== '' ? $name : 'участник'),
            $email === '{{login}}'       ? '{{login}}'    : h($email),
            $pass === '{{password}}'     ? '{{password}}' : h($pass),
        ],
        $inner
    );
}

/** Адреса действующих членов клуба — им приглашение в клуб не нужно. */
function launch_combo_club_emails(): array {
    $out = [];
    try {
        $rows = all("SELECT LOWER(u.email) e FROM club_members m JOIN users u ON u.id = m.user_id
                      WHERE COALESCE(m.active,1) = 1
                        AND (m.expires_at IS NULL OR m.expires_at = '' OR m.expires_at > datetime('now'))
                        AND COALESCE(u.email,'') <> ''");
        foreach ($rows as $r) $out[(string) $r['e']] = true;
    } catch (\Throwable $e) {}
    if (!function_exists('club_staff_emails') && is_file(__DIR__ . '/club.php')) require_once __DIR__ . '/club.php';
    if (function_exists('club_staff_emails')) {
        foreach (club_staff_emails() as $e) {
            $e = mb_strtolower(trim((string) $e));
            if ($e !== '') $out[$e] = true;
        }
    }
    return $out;
}

/**
 * Ставит в очередь объединённую волну запуска.
 * @param bool $dry true — ничего не пишем, только считаем.
 * @return array ['queued'=>int,'with_cabinet'=>int,'with_vip'=>int,'newsletter_id'=>int]
 */
function launch_combo_enqueue(bool $dry = false, int $limit = 20000): array {
    nl_ensure_campaign_type_col();
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN priority INTEGER DEFAULT 0"); } catch (\Throwable $e) {}

    $subject = launch_combo_subject();

    // Одна строка кампании на месяц — она же ключ идемпотентности.
    $tag = 'combo:' . date('Y-m');
    $nl  = one("SELECT * FROM newsletters WHERE subject = ? AND audience = ?", [$subject, $tag]);
    $nid = (int) ($nl['id'] ?? 0);
    if (!$nid && !$dry) {
        $nid = (int) insert('newsletters', [
            'subject'       => $subject,
            'body'          => '(персональное письмо: собирается под каждого получателя)',
            'audience'      => $tag,
            'campaign_type' => 'konkurs',
            'status'        => 'sending',
        ]);
    }

    // Аудитория: активные подписчики + зарегистрированные с включёнными уведомлениями.
    // Отписавшихся и подавленных отсекает nl_ensure_subscriber ниже.
    $recips = all(
        "SELECT email, name FROM (
             SELECT LOWER(s.email) AS email, s.name AS name FROM subscribers s WHERE s.active = 1
             UNION
             SELECT LOWER(u.email) AS email, u.full_name AS name FROM users u
              WHERE COALESCE(u.email,'') <> '' AND COALESCE(u.blocked,0) = 0
                AND COALESCE(u.notify_email,1) = 1
                AND COALESCE(u.role,'user') NOT IN ('owner','admin','orgcom')
         ) ORDER BY email LIMIT ?",
        [max(1, $limit)]
    );

    $clubEmails = launch_combo_club_emails();

    $queued = 0; $withCab = 0; $withVip = 0; $skipped = 0;
    $pixel = $nid ? nl_open_pixel(nl_track_token($nid)) : '';
    $base  = rtrim((string) cfgv('base_url'), '/');

    foreach ($recips as $r) {
        $email = mb_strtolower(trim((string) $r['email']));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) continue;

        // Отписавшиеся и подавленные (bounced/invalid/alias/role) — мимо.
        [$unsubToken, $active] = nl_ensure_subscriber($email, (string) ($r['name'] ?? ''), 'newsletter');
        if (!$active) { $skipped++; continue; }

        // Идемпотентность: одному адресу — одно письмо кампании месяца.
        if ($nid) {
            $dup = one("SELECT id FROM mail_queue WHERE newsletter_id = ? AND to_email = ?", [$nid, $email]);
            if ($dup) { $skipped++; continue; }
        }

        // Кому нужен доступ в кабинет: аккаунт есть, но ни разу не входил.
        $u = one("SELECT id, full_name, last_login FROM users WHERE LOWER(email) = ?", [$email]);
        $needCabinet = $u && ($u['last_login'] === null || trim((string) $u['last_login']) === '');
        $needVip     = !isset($clubEmails[$email]);

        $name = trim((string) ($r['name'] ?? '')) ?: trim((string) ($u['full_name'] ?? ''));
        $pass = '';

        if ($needCabinet) {
            $pass = kabinet_gen_password();
            if (!$dry) {
                try { update('users', ['password_hash' => password_hash($pass, PASSWORD_DEFAULT)], 'id=:id', ['id' => (int) $u['id']]); }
                catch (\Throwable $e) { $needCabinet = false; $pass = ''; }
            }
        }

        if ($needCabinet) $withCab++;
        if ($needVip)     $withVip++;

        if ($dry) { $queued++; continue; }

        $inner    = launch_combo_inner($needCabinet, $needVip, $email, $name, $pass);
        $unsubUrl = $base . '/api/v1/unsubscribe.php?token=' . urlencode($unsubToken);
        $body     = nl_wrap_email(nl_rewrite_links($inner, nl_track_token($nid)), $unsubUrl, $pixel,
                                  mb_substr(trim(strip_tags($inner)), 0, 120), ['vip' => !$needVip]);

        try {
            insert('mail_queue', [
                'to_email'      => $email,
                'to_name'       => $name,
                'subject'       => $subject,
                'body'          => $body,
                'newsletter_id' => $nid,
                'campaign_type' => 'konkurs',   // одна квота на всю объединённую волну
                'status'        => 'queued',
                'priority'      => 5,
            ]);
            $queued++;
        } catch (\Throwable $e) { /* сбойную строку пропускаем, волну не роняем */ }
    }

    if (!$dry && $queued && function_exists('audit')) {
        audit('launch_combo_enqueue', 'newsletter', $nid,
              ['queued' => $queued, 'with_cabinet' => $withCab, 'with_vip' => $withVip, 'skipped' => $skipped]);
    }

    return ['queued' => $queued, 'with_cabinet' => $withCab, 'with_vip' => $withVip,
            'skipped' => $skipped, 'newsletter_id' => $nid];
}
