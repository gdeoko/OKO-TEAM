<?php
/**
 * cron/partner_triggers.php — раз в час: партнёрские триггеры.
 *
 *   • Пересчёт счётчиков заявок каждого активного партнёра.
 *   • Если счётчик перешёл через 5 (и notified_5=0) — письмо-приглашение
 *     в форму благодарностей + флаг notified_5.
 *   • Если счётчик перешёл через 10 (и notified_10=0) — письмо с промокодом
 *     + флаг notified_10 + partner_promo_activated_at.
 *   • Готовые в очереди благодарности (status='queued' + scheduled_send_at≤now)
 *     генерятся в PDF (partner_thanks_pdf) и группируются по институции;
 *     каждая группа уходит одним письмом от nagradi.on@ (mail_send_failover
 *     pool='awards'). status='sent' + sent_at.
 *
 * Запуск: 15 * * * * php /var/www/muzmir/cron/partner_triggers.php
 *
 * Расписание почасовое, а письма уходят только в рабочее окно: задание пишет в
 * учреждение от имени центра, и приглашение в час ночи читается как рассылка
 * робота. Проверка стоит внутри скрипта, а не в расписании: расписание можно
 * поменять, скрипт можно запустить руками, а правило владельца одно.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/partner_docs.php';
require_once BASE_PATH . '/core/outreach_window.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'partner_triggers';

if (!cron_lock(JOB, 900)) { cron_log(JOB, 'блокировка — предыдущий ещё работает'); exit(0); }

// Наружу ничего не уходит ночью и в воскресенье. Счётчики подождут до утра
// вместе с письмами: перебирать партнёров каждый час ночью незачем.
// --force обходит окно и нужен проверкам (scripts/audit_partner*.php): они гоняют
// задание в любое время суток, а без обхода аудит падал бы каждый вечер, показывая
// поломку там, где сработало правило.
$ptForce = in_array('--force', $argv ?? [], true);
if (!$ptForce && !outreach_window_ok()) {
    cron_log(JOB, 'вне рабочего окна (' . outreach_window_reason() . ') — письма партнёрам ждут утра');
    cron_unlock(JOB);
    exit(0);
}

try {
    $stats = ['refreshed' => 0, 'notif_5' => 0, 'notif_10' => 0, 'thanks_sent' => 0, 'thanks_failed' => 0];

    // ── 1) Пересчёт счётчиков и триггеры уведомлений ─────────────────────────
    $partners = all("SELECT * FROM institutions WHERE partner_status='accepted'");
    foreach ($partners as $p) {
        $instId = (int) $p['id'];
        $before = (int) ($p['partner_apps_count'] ?? 0);
        $r = partner_refresh_counts($instId);
        $now = $r['count'];
        $stats['refreshed']++;

        // 5 заявок — открываем форму благодарностей
        if ($now >= 5 && (int) ($p['partner_notified_5'] ?? 0) === 0) {
            if (partner_send_5apps_email((int) $instId, $p)) {
                q("UPDATE institutions SET partner_notified_5=1 WHERE id=?", [$instId]);
                partner_log_event($instId, 'apps_5', json_encode(['count' => $now], JSON_UNESCAPED_UNICODE));
                $stats['notif_5']++;
            }
        }

        // 10 заявок — выдаём промокод
        if ($now >= 10 && (int) ($p['partner_notified_10'] ?? 0) === 0) {
            if (partner_send_10apps_email((int) $instId, $p)) {
                q("UPDATE institutions SET partner_notified_10=1, partner_promo_activated_at=? WHERE id=?",
                  [date('Y-m-d H:i:s'), $instId]);
                partner_log_event($instId, 'apps_10', json_encode(['count' => $now, 'promo' => $p['partner_promo_code'] ?? ''], JSON_UNESCAPED_UNICODE));
                $stats['notif_10']++;
            }
        }
    }

    // ── 2) Готовые к отправке благодарности — группируем по институции ─────────
    // Правило: если у институции все заказанные в один момент благодарности
    // созрели (scheduled_send_at ≤ now), они уходят единым письмом.
    $due = all("SELECT institution_id, GROUP_CONCAT(id) ids
                  FROM partner_thanks
                 WHERE status IN ('queued','generated')
                   AND scheduled_send_at<>''
                   AND scheduled_send_at <= ?
                 GROUP BY institution_id", [date('Y-m-d H:i:s')]);
    foreach ($due as $g) {
        $instId = (int) $g['institution_id'];
        $inst = one("SELECT * FROM institutions WHERE id=?", [$instId]);
        if (!$inst) continue;
        $ids = array_map('intval', explode(',', (string) $g['ids']));

        $atts = [];
        $tmpDir = '/tmp/partth_' . bin2hex(random_bytes(4));
        @mkdir($tmpDir, 0775, true);
        $listHtml = '';
        foreach ($ids as $tid) {
            $t = one("SELECT * FROM partner_thanks WHERE id=?", [$tid]);
            if (!$t) continue;
            $pdf = partner_thanks_pdf($tid);
            if ($pdf && is_file($pdf)) {
                $safeName = preg_replace('~[^a-zA-Zа-яА-Я0-9-]+~u', '_', (string) $t['fio']);
                $dst = $tmpDir . '/Благодарность_' . $safeName . '.pdf';
                copy($pdf, $dst);
                $atts[] = $dst;
                $listHtml .= '<li><b>' . h((string) $t['fio']) . '</b> — '
                    . ($t['role'] === 'manager' ? 'руководство' : 'педагог-куратор') . '</li>';
            }
        }
        if (!$atts) { foreach ($ids as $tid) q("UPDATE partner_thanks SET status='failed', error='pdf_render_fail' WHERE id=?", [$tid]); continue; }

        $body = partner_email_thanks_body($inst, $listHtml, count($atts));
        $subj = 'Благодарственные письма — от Оргкомитета Культурного центра «Музыкальный Мир»';

        $ok = mail_send_failover((string) $inst['email'], $subj, $body,
            ['pool' => 'awards', 'attach' => $atts]);
        if ($ok) {
            $now = date('Y-m-d H:i:s');
            foreach ($ids as $tid) q("UPDATE partner_thanks SET status='sent', sent_at=? WHERE id=?", [$now, $tid]);
            partner_log_event($instId, 'thanks_delivered', json_encode(['count' => count($atts)], JSON_UNESCAPED_UNICODE));
            $stats['thanks_sent'] += count($atts);
        } else {
            $err = function_exists('mail_last_error') ? mail_last_error() : '';
            foreach ($ids as $tid) q("UPDATE partner_thanks SET status='failed', error=? WHERE id=?", [mb_substr($err, 0, 300), $tid]);
            $stats['thanks_failed'] += count($atts);
        }
        foreach ($atts as $a) @unlink($a);
        @rmdir($tmpDir);
    }

    cron_log(JOB, sprintf('refreshed=%d notif5=%d notif10=%d thanks_sent=%d thanks_failed=%d',
        $stats['refreshed'], $stats['notif_5'], $stats['notif_10'], $stats['thanks_sent'], $stats['thanks_failed']));

} catch (\Throwable $e) {
    cron_log(JOB, 'FATAL: ' . $e->getMessage());
}

cron_unlock(JOB);
exit(0);

/* ─────────────────────── ШАБЛОНЫ ПИСЕМ ─────────────────────── */

function partner_email_5apps_body(array $p): string {
    $base = rtrim((string) cfgv('base_url', ''), '/');
    $lk   = $base . '/partner';
    return '<div style="font:15px Arial,sans-serif;line-height:1.65;max-width:640px;padding:24px;color:#2A1E06">
<div style="text-align:center;margin-bottom:16px"><img src="' . $base . '/assets/img/logo_muzmir_256.png" width="70"></div>
<h2 style="color:#8A6512;font-family:Georgia,serif;margin:0 0 6px;text-align:center">От Вашего учреждения — 5 заявок</h2>
<p style="text-align:center;color:#666;margin:0 0 22px">Открылась возможность заказать благодарственные письма</p>
<p>Уважаемые коллеги!</p>
<p>От <b>' . h((string) $p['name']) . '</b> в наших конкурсах поступило уже 5 конкурсных заявок. В рамках партнёрской программы Вы можете оформить <b>бесплатные благодарственные письма</b> Оргкомитета центра:</p>
<div style="background:#FDF6E2;border:1px solid #E9CE84;border-radius:8px;padding:16px 20px;margin:14px 0">
<ul style="margin:0;padding-left:22px">
<li>до <b>3-х</b> благодарностей на имя руководства учреждения — <b>один раз</b> за партнёрство;</li>
<li>по одной благодарности на каждого педагога, чьи ученики уже подали заявки, — <b>без ограничений</b> по количеству, но по одной на каждое новое ФИО;</li>
<li>+ до 3-х дополнительных ФИО педагогов вручную.</li>
</ul></div>
<p style="text-align:center;margin:22px 0">
<a href="' . $lk . '?a=thanks" style="display:inline-block;background:linear-gradient(135deg,#C79322,#E9CE84);color:#2A1E06;font-weight:800;padding:14px 28px;border-radius:6px;text-decoration:none">Оформить благодарности</a>
</p>
<p style="font-size:13px;color:#666">Форма в личном кабинете партнёра. Заказ приходит на почту в течение <b>3 рабочих дней</b> единым письмом.</p>
<p style="margin-top:22px">С уважением, Оргкомитет Культурного центра «Музыкальный Мир»</p>
</div>';
}

function partner_email_10apps_body(array $p): string {
    $base = rtrim((string) cfgv('base_url', ''), '/');
    return '<div style="font:15px Arial,sans-serif;line-height:1.65;max-width:640px;padding:24px;color:#2A1E06">
<div style="text-align:center;margin-bottom:16px"><img src="' . $base . '/assets/img/logo_muzmir_256.png" width="70"></div>
<h2 style="color:#8A6512;font-family:Georgia,serif;margin:0 0 6px;text-align:center">От Вашего учреждения — 10 заявок</h2>
<p style="text-align:center;color:#666;margin:0 0 22px">Активирован партнёрский промокод</p>
<p>Уважаемые коллеги!</p>
<p>Как Информационный партнёр Культурного центра «Музыкальный Мир», <b>' . h((string) $p['name']) . '</b> получает именной промокод на скидку <b>10%</b>:</p>
<div style="background:linear-gradient(135deg,#FDF6E2,#F7E9C4);border:2px dashed #C79322;border-radius:10px;padding:24px;margin:20px 0;text-align:center">
<div style="font-size:12px;color:#7A5A12;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px">Промокод -10%</div>
<div style="font-family:monospace;font-size:24px;font-weight:800;color:#2A1E06;letter-spacing:.08em">' . h((string) $p['partner_promo_code']) . '</div>
<div style="font-size:13px;color:#7A5A12;margin-top:8px">На <b>' . (int) $p['partner_promo_max'] . '</b> использований</div>
</div>
<p>Скидка применяется к оргвзносу при подаче заявки и к заказу наградного материала. Введите код в поле «Промокод» на нашем сайте — скидка учтётся автоматически.</p>
<p style="text-align:center;margin:20px 0">
<a href="' . $base . '/partner?a=promo" style="display:inline-block;background:#15224C;color:#fff;font-weight:700;padding:12px 24px;border-radius:6px;text-decoration:none">Посмотреть в личном кабинете</a>
</p>
<p style="margin-top:22px">С уважением, Оргкомитет Культурного центра «Музыкальный Мир»</p>
</div>';
}

function partner_email_thanks_body(array $inst, string $listHtml, int $count): string {
    $base = rtrim((string) cfgv('base_url', ''), '/');
    return '<div style="font:15px Arial,sans-serif;line-height:1.65;max-width:640px;padding:24px;color:#2A1E06">
<div style="text-align:center;margin-bottom:16px"><img src="' . $base . '/assets/img/logo_muzmir_256.png" width="70"></div>
<h2 style="color:#8A6512;font-family:Georgia,serif;margin:0 0 22px;text-align:center">Ваши благодарности готовы</h2>
<p>Уважаемые коллеги!</p>
<p>Оргкомитет Культурного центра «Музыкальный Мир» направляет благодарственные письма руководству и педагогическому составу <b>' . h((string) $inst['name']) . '</b> в рамках партнёрской программы «Информационный партнёр» (партнёрство № <b>' . h((string) $inst['partner_no']) . '</b>).</p>
<p><b>В приложении ' . $count . ' благодарственных писем:</b></p>
<ul>' . $listHtml . '</ul>
<p style="background:#FDF6E2;border:1px solid #E9CE84;border-radius:6px;padding:14px 18px;font-size:14px">
Документы принимаются в аттестационное портфолио. Каждое письмо оформлено на именном бланке центра с золотой рамкой, содержит подписи оргкомитета, печать и QR-код проверки подлинности.
</p>
<p style="margin-top:22px">Желаем Вам творческих успехов и новых побед!<br><br>
С уважением, Оргкомитет Культурного центра «Музыкальный Мир»</p>
</div>';
}

/** Отправка «5 заявок» через транзакционный пул kc@. */
function partner_send_5apps_email(int $instId, array $p): bool {
    $email = trim((string) ($p['email'] ?? ''));
    if ($email === '') return false;
    return (bool) mail_send_failover($email,
        'От Вашего учреждения — 5 заявок · открылась возможность заказать благодарности',
        partner_email_5apps_body($p),
        ['pool' => 'tx']);
}

/** Отправка «10 заявок + промокод». */
function partner_send_10apps_email(int $instId, array $p): bool {
    $email = trim((string) ($p['email'] ?? ''));
    if ($email === '') return false;
    return (bool) mail_send_failover($email,
        'Промокод −10% для Вашего учреждения — 10 заявок пройдено',
        partner_email_10apps_body($p),
        ['pool' => 'tx']);
}
