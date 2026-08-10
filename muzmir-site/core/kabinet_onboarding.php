<?php
/**
 * Онбординг «Личный кабинет» — персональное письмо с ЛОГИНОМ и ВРЕМЕННЫМ ПАРОЛЕМ
 * по утверждённому эталону (см. auth_ensure_account). Массовая волна на базу
 * зарегистрированных пользователей, которые ещё НИ РАЗУ не входили (last_login IS NULL) —
 * то есть импортированные адреса, которым нужно выдать доступ. Активных пользователей
 * (со своим паролем) НЕ трогаем. Идёт под суточной квотой типа 'kabinet' (по умолчанию 100/день).
 *
 * Каждому: генерируем временный пароль, обновляем password_hash, ставим в mail_queue
 * персональное письмо (campaign_type='kabinet', priority=5). Идемпотентно: повторно
 * одному адресу онбординг не ставим (проверяем существующую kabinet-строку в очереди/архиве).
 */
declare(strict_types=1);

/** Внутреннее тело кабинет-письма с токенами {{name}} {{login}} {{password}} (эталон или оверрайд из пульта). */
function kabinet_onboarding_inner(): string {
    $ov = function_exists('setting') ? (string) setting('launch_mail_html:kabinet', '') : '';
    if (trim($ov) !== '') return $ov;
    $base = rtrim((string) cfgv('base_url'), '/');
    if ($base === '' || stripos($base, 'localhost') !== false) $base = 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai';
    if (!function_exists('mm_email_btn')) require_once __DIR__ . '/mailer.php';
    return '<p style="margin:0 0 14px;font-size:15px;color:#2a2a3a;">Здравствуйте, {{name}}! Мы открыли для Вас личный кабинет'
        . ' на сайте Культурного центра «Музыкальный Мир»: заявки, результаты,'
        . ' электронные дипломы и заказ наград — всё в одном месте.</p>'
        . '<div style="margin:0 0 16px;padding:16px 18px;border:1.5px solid #C79322;border-radius:12px;background:#FCF9F0;text-align:center;">'
        . '<div style="font-size:13px;color:#6b5d3f;margin-bottom:6px;">Ваш логин</div>'
        . '<div style="font-size:16px;font-weight:bold;color:#17307A;margin-bottom:10px;">{{login}}</div>'
        . '<div style="font-size:13px;color:#6b5d3f;margin-bottom:6px;">Временный пароль</div>'
        . '<div style="font-family:monospace;font-size:22px;font-weight:bold;letter-spacing:3px;color:#17307A;">{{password}}</div>'
        . '<div style="font-size:12px;color:#8a7b58;margin-top:8px;">После входа пароль можно сменить в настройках кабинета.</div>'
        . '</div>'
        . mm_email_btn($base . '/login', 'Войти в личный кабинет');
}

/** HTML письма кабинета с логином/паролем (единый эталон, с подстановкой значений). */
function kabinet_onboarding_html(string $email, string $name, string $pass): string {
    if (!function_exists('mm_email_layout')) require_once __DIR__ . '/mailer.php';
    $inner = kabinet_onboarding_inner();
    $inner = str_replace(['{{name}}', '{{login}}', '{{password}}'],
                         [h($name !== '' ? $name : 'участник'), h($email), h($pass)], $inner);
    return mm_email_layout($inner, ['title' => 'Ваш личный кабинет открыт']);
}

/** Генерация читаемого временного пароля. */
function kabinet_gen_password(int $len = 9): string {
    $alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    $p = '';
    for ($i = 0; $i < $len; $i++) $p .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    return $p;
}

/**
 * Ставит в очередь партию онбординг-писем кабинета. $limit — сколько за один вызов
 * (обычно все сразу; воркер сам разложит по 100/день согласно квоте типа 'kabinet').
 * Возвращает число поставленных писем.
 */
function kabinet_onboarding_enqueue(int $limit = 20000): int {
    if (function_exists('nl_ensure_campaign_type_col')) nl_ensure_campaign_type_col();
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN priority INTEGER DEFAULT 0"); } catch (\Throwable $e) {}

    // ОТДЕЛЬНОЙ МАССОВОЙ ВОЛНЫ КАБИНЕТА БОЛЬШЕ НЕТ (правило владельца, август 2026).
    //
    // Доступ в кабинет выдаётся двумя способами, и оба — не здесь:
    //   • блоком объединённого письма запуска (core/launch_combo.php) — по базе;
    //   • личным письмом сразу при подаче заявки, если кабинета ещё не было.
    //
    // Массовый прогон по всей базе выдавал бы ВРЕМЕННЫЙ ПАРОЛЬ тем же людям второй
    // раз: у тех, кому письмо с прежним паролем ещё не доехало, пароль в письме
    // переставал бы подходить. Функция оставлена как заглушка, чтобы старые вызовы
    // (пульт, скрипты) не падали.
    if (function_exists('nl_log')) nl_log('kabinet: отдельная массовая волна кабинета отключена — доступ выдаётся письмом запуска и при подаче заявки');
    return 0;

    /** @noinspection PhpUnreachableStatementInspection — код ниже сохранён для истории */
    // phpcs:disable

    // Кандидаты: зарег. пользователи с почтой, не заблокированные, ни разу не входившие,
    // которым ещё не ставили онбординг кабинета (нет kabinet-письма в очереди/архиве).
    $rows = all(
        "SELECT u.id, u.email, u.full_name AS name
           FROM users u
          WHERE COALESCE(u.email,'') <> '' AND COALESCE(u.blocked,0) = 0
            AND u.last_login IS NULL
            AND COALESCE(u.notify_email,1) = 1
            AND NOT EXISTS (
                SELECT 1 FROM mail_queue mq
                 WHERE mq.to_email = u.email AND mq.campaign_type = 'kabinet'
            )
          ORDER BY u.id ASC
          LIMIT ?",
        [max(1, $limit)]
    );
    if (!$rows) return 0;

    $queued = 0;
    foreach ($rows as $r) {
        $email = mb_strtolower(trim((string) $r['email']));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) continue;
        // Отписавшихся не трогаем.
        if (function_exists('nl_ensure_subscriber')) {
            [$tok, $active] = nl_ensure_subscriber($email, (string) ($r['name'] ?? ''), 'newsletter');
            if (!$active) continue;
        }
        $pass = kabinet_gen_password();
        try { update('users', ['password_hash' => password_hash($pass, PASSWORD_DEFAULT)], 'id=:id', ['id' => (int) $r['id']]); }
        catch (\Throwable $e) { continue; }
        try {
            insert('mail_queue', [
                'to_email'      => $email,
                'to_name'       => (string) ($r['name'] ?? ''),
                'subject'       => 'Ваш личный кабинет — Культурный центр «Музыкальный Мир»',
                'body'          => kabinet_onboarding_html($email, (string) ($r['name'] ?? ''), $pass),
                'campaign_type' => 'kabinet',
                'status'        => 'queued',
                'priority'      => 5,
            ]);
            $queued++;
        } catch (\Throwable $e) { /* пропускаем сбойную строку */ }
    }
    if ($queued && function_exists('audit')) audit('kabinet_onboarding_enqueue', 'user', 0, ['queued' => $queued]);
    return $queued;
}

/** Сколько адресов ещё ждут онбординга кабинета (для отчёта в пульте). */
function kabinet_onboarding_pending(): int {
    try {
        return (int) scalar(
            "SELECT COUNT(*) FROM users u
              WHERE COALESCE(u.email,'') <> '' AND COALESCE(u.blocked,0) = 0
                AND u.last_login IS NULL AND COALESCE(u.notify_email,1) = 1
                AND NOT EXISTS (SELECT 1 FROM mail_queue mq WHERE mq.to_email = u.email AND mq.campaign_type = 'kabinet')"
        );
    } catch (\Throwable $e) { return 0; }
}
