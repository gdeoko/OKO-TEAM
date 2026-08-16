<?php
/**
 * ПИСЬМО ТОМУ, КТО УЖЕ ПОДАЛ ЗАЯВКУ: ПРИВЕДИТЕ ОСТАЛЬНЫХ УЧЕНИКОВ.
 *
 * Заявки подаёт не ребёнок. Их подаёт педагог или родитель, и по базе это
 * видно: на 158 заявок приходится 65 разных адресов, то есть один человек
 * отправляет несколько работ. Такой человек — самый дешёвый источник новых
 * заявок, какой у нас есть: он уже прошёл всю форму, знает требования, и у него
 * в классе или в студии остались другие дети.
 *
 * Письмо уходит один раз на адрес, через день после первой заявки, и содержит
 * ровно то, что человеку нужно для второго захода:
 *   • благодарность и напоминание, что диплом куратора и благодарственное
 *     письмо педагогу выдаются бесплатно и на каждого;
 *   • его личный промокод: 5% ученику и 5% ему самому с каждого применения;
 *   • прямую ссылку на подачу следующей работы.
 *
 * Ничего не выдумывается сверх правил лояльности: проценты берутся из
 * core/loyalty.php, потолки те же.
 *
 * Крон (пн–сб, один раз в день):
 *   0 11 * * 1-6  php /var/www/muzmir/cron/teacher_invite.php
 *
 * Выключатель: settings.teacher_invite_enabled = '0'; общий стоп-кран массовых
 * коммуникаций и рабочее окно тоже действуют.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/loyalty.php';
require_once BASE_PATH . '/core/outreach_window.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'teacher_invite';

// Сухой прогон: показывает, кому и что ушло бы, ничего не ставя в очередь.
// Нужен, чтобы проверять письмо вне рабочего окна, не трогая адресатов.
$dry = in_array('--dry', $argv, true);

if (!$dry && function_exists('mass_sending_enabled') && !mass_sending_enabled()) exit(0);
if (!$dry && (string) scalar("SELECT value FROM settings WHERE key='teacher_invite_enabled'") === '0') exit(0);
if (!$dry && !outreach_window_ok()) exit(0);
if (!$dry && !cron_lock(JOB, 900)) exit(0);

try {
    db()->exec("CREATE TABLE IF NOT EXISTS teacher_invites (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        email      TEXT NOT NULL,
        code       TEXT DEFAULT '',
        apps       INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')))");
    db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_tinv_email ON teacher_invites(email)");

    $cap = max(1, (int) (scalar("SELECT value FROM settings WHERE key='teacher_invite_daily'") ?: 200));

    /* Кому. Подавшим хотя бы одну заявку сутки назад и раньше: письмо в тот же
     * час выглядит как автоответчик, а через день — как внимание. Отписавшихся
     * и попавших в стоп-лист не трогаем. */
    $rows = all("SELECT LOWER(TRIM(a.email)) AS email,
                        COUNT(*) AS apps,
                        MAX(COALESCE(NULLIF(TRIM(a.teacher),''), '')) AS teacher,
                        MAX(a.user_id) AS user_id
                   FROM applications a
                   LEFT JOIN teacher_invites t ON t.email = LOWER(TRIM(a.email))
                  WHERE TRIM(COALESCE(a.email,'')) <> ''
                    AND t.id IS NULL
                    AND a.created_at < datetime('now','localtime','-1 day')
                    AND NOT EXISTS (SELECT 1 FROM mail_stop s WHERE LOWER(s.email) = LOWER(TRIM(a.email)))
                  GROUP BY 1
                  ORDER BY apps DESC
                  LIMIT :l", ['l' => $cap]);

    if (!$rows) { if (!$dry) cron_unlock(JOB); exit(0); }

    $base  = rtrim((string) cfgv('base_url'), '/');
    $site  = (string) cfgv('domain', 'музыкальный-мир.рф');
    $phone = (string) cfgv('org_phone', '');
    $ok = $err = 0;

    foreach ($rows as $r) {
        $email = (string) $r['email'];
        $apps  = (int) $r['apps'];
        $uid   = (int) ($r['user_id'] ?? 0);

        /* Личный промокод. Правила лояльности прежние: 5% ученику, 5% владельцу
         * кода за каждое оплаченное применение.
         *
         * Код имеет смысл только тогда, когда у владельца есть аккаунт: скидка
         * владельцу начисляется на его учётную запись. Заявку можно подать и
         * гостем, поэтому владельца ищем ещё и по адресу почты, а если аккаунта
         * нет вовсе — письмо уходит без промокода, а не с чужим. */
        if ($uid <= 0) {
            $u = one("SELECT id FROM users WHERE LOWER(email)=? LIMIT 1", [$email]);
            $uid = (int) ($u['id'] ?? 0);
        }
        $code = '';
        if ($uid > 0) {
            $ref = one("SELECT * FROM referrals WHERE teacher_user_id=? AND active=1", [$uid]);
            if (!$ref && !$dry) {
                try { $ref = referral_create($uid, '', REFERRAL_MAX_PCT, REFERRAL_REWARD_MAX_PCT, 'выдан письмом педагогу'); }
                catch (\Throwable $e) { $ref = null; }
            }
            $code = (string) ($ref['code'] ?? ($dry ? 'будет выдан' : ''));
        }

        [$token] = nl_ensure_subscriber($email, (string) $r['teacher'], 'teacher');
        $unsub = $base . '/api/v1/unsubscribe.php?token=' . urlencode($token);

        $name = trim((string) $r['teacher']);
        $hello = $name !== '' ? 'Уважаемый(ая) ' . h($name) . '!' : 'Здравствуйте!';

        $body = '<p style="margin:0 0 14px;font-size:16px">' . $hello . '</p>'
              . '<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Благодарим за '
              . ($apps > 1 ? 'поданные работы' : 'поданную работу')
              . ' на конкурсы Культурного центра «Музыкальный Мир». '
              . 'Напоминаем: <b>диплом куратора и благодарственное письмо педагогу выдаются бесплатно</b> '
              . 'и оформляются на каждого преподавателя, подготовившего участника. Заказывать их не нужно, '
              . 'они придут вместе с дипломами учеников.</p>'
              . '<p style="margin:0 0 14px;font-size:15px;line-height:1.6">Если в Вашем классе или коллективе '
              . 'есть другие ребята, их работы можно подать до окончания приёма. Каждая работа оценивается '
              . 'отдельно, ограничений по числу участников от одного педагога нет.</p>';

        if ($code !== '') {
            $body .= '<div style="background:#FDF6E2;border:1px solid #E9CE84;border-radius:8px;padding:16px 20px;margin:0 0 16px">'
                  . '<div style="font-size:13px;color:#7A5A12;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Ваш личный промокод</div>'
                  . '<div style="font-family:monospace;font-size:22px;font-weight:800;color:#2A1E06;letter-spacing:.06em">' . h($code) . '</div>'
                  . '<div style="font-size:14px;color:#4A3308;margin-top:8px">'
                  . 'Скидка <b>' . REFERRAL_MAX_PCT . '%</b> тому, кто подаёт заявку с этим кодом, и '
                  . '<b>' . REFERRAL_REWARD_MAX_PCT . '%</b> Вам на следующую оплату за каждое подтверждённое применение. '
                  . 'Кодом можно делиться с коллегами и родителями учеников.</div></div>';
        }

        $body .= mm_email_btn($base . '/apply?utm_source=email&utm_campaign=teacher-invite', 'Подать следующую работу', 'gold')
              . '<p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#4a4a55">'
              . 'Положения, номинации и образцы наград — на сайте <b>' . h($site) . '</b>. '
              . 'Вопросы по участию: ' . h($phone) . '.</p>';

        $html = function_exists('nl_wrap_email')
            ? nl_wrap_email($body, $unsub, '', 'Диплом куратора бесплатно и промокод для Ваших учеников')
            : $body;

        if ($dry) {
            printf("  %-38s работ %-3d код %-9s\n", $email, $apps, $code !== '' ? $code : 'нет');
            $ok++;
            continue;
        }

        $qid = (int) insert('mail_queue', [
            'to_email'      => $email,
            'to_name'       => $name,
            'subject'       => $apps > 1 ? 'Дипломы куратора и промокод для Ваших учеников'
                                         : 'Диплом куратора и промокод для Ваших учеников',
            'body'          => $html,
            'campaign_type' => 'teacher',
            'status'        => 'queued',
            'priority'      => 2,
        ]);
        if ($qid > 0) {
            q("INSERT OR IGNORE INTO teacher_invites (email, code, apps) VALUES (:e,:c,:a)",
              ['e' => $email, 'c' => $code, 'a' => $apps]);
            $ok++;
        } else $err++;
    }

    if ($dry) printf("\n  всего адресатов: %d\n", $ok);
    else cron_log(JOB, sprintf('поставлено писем педагогам: %d, отказов %d', $ok, $err));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}

if (!$dry) cron_unlock(JOB);
