<?php
/**
 * ОТВЕТЫ УЧРЕЖДЕНИЙ, КОТОРЫЕ МЫ НЕ УВИДЕЛИ.
 *
 * За месяц партнёрской рассылки в админке стояло «ответили: 0» — при том что
 * ответы приходили. Причин было три, и все технические:
 *   1) отметка replied_at не проставлялась вообще ни разу;
 *   2) школа отвечает с соседнего адреса своего домена, а сравнивался только
 *      адрес из справочника — письмо не связывалось с учреждением;
 *   3) ответ, пришедший в kc@ или на исторический ящик, считался письмом
 *      ведомства и молча пропускался: партнёрскую ветку он не запускал.
 *
 * Код на будущее исправлен (core/inbox_reader.php, cron/inbox_actions.php).
 * Этот скрипт разбирает то, что уже накопилось: доопределяет учреждение по
 * домену, ставит отметку об ответе и возвращает в разбор письма, которые были
 * прочитаны как «ведомственные».
 *
 *   php scripts/partner_replies_fix.php          — показать, что найдено
 *   php scripts/partner_replies_fix.php --apply  — применить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/inbox_reader.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 78);
echo "ОТВЕТЫ УЧРЕЖДЕНИЙ\n$line\n";

/* ── 1. Связать письма с учреждениями ────────────────────────────────────── */
/* Роботов и отбойники не связываем: догадка по домену цепляла к учреждению
   каждое уведомление Почты России, потому что один её адрес есть в справочнике. */
$rows = all("SELECT id, mailbox, from_email, subject, kind, is_auto, inst_id, ministry_id, received_at, handled_by
               FROM inbox_messages
              WHERE COALESCE(inst_id,0)=0 AND COALESCE(ministry_id,0)=0
                AND COALESCE(from_email,'')<>''
                AND COALESCE(is_auto,0)=0
                AND COALESCE(kind,'') NOT IN ('service','bounce','auto')
           ORDER BY id");
$link = 0;
foreach ($rows as $r) {
    $who = inbox_identify((string) $r['from_email']);
    if ($who['inst_id'] <= 0) continue;
    $link++;
    if ($link <= 20) printf("  связано: %-34s → учреждение #%d\n", mb_substr((string) $r['from_email'], 0, 34), $who['inst_id']);
    if ($apply) q("UPDATE inbox_messages SET inst_id=? WHERE id=?", [$who['inst_id'], (int) $r['id']]);
}
printf("  писем связано с учреждениями: %d\n", $link);

/* ── 2. Отметка «ответили» ───────────────────────────────────────────────── */
$msgs = all("SELECT m.inst_id, MIN(m.received_at) first_at, COUNT(*) c
               FROM inbox_messages m
               JOIN institutions i ON i.id = m.inst_id
              WHERE COALESCE(m.inst_id,0) > 0
                AND COALESCE(m.is_auto,0) = 0
                AND COALESCE(m.kind,'') NOT IN ('service','bounce','auto')
                AND COALESCE(i.replied_at,'') = ''
           GROUP BY m.inst_id");
printf("\n  учреждений с живым ответом без отметки: %d\n", count($msgs));
foreach ($msgs as $m) {
    if ($apply) q("UPDATE institutions SET replied_at=? WHERE id=?", [(string) $m['first_at'], (int) $m['inst_id']]);
}

/* ── 3. Ответы, прочитанные как «ведомственные» ──────────────────────────── */
$mis = all("SELECT m.id, m.from_email, m.subject, m.kind, m.mailbox, m.handled_by, i.name
              FROM inbox_messages m
              JOIN institutions i ON i.id = m.inst_id
             WHERE COALESCE(m.ministry_id,0)=0
               AND m.kind LIKE 'ministry%'
          ORDER BY m.id DESC");
printf("\n  ответов учреждений, помеченных как ведомственные: %d\n", count($mis));
foreach ($mis as $m) {
    $new = (string) $m['kind'] === 'ministry_decline' ? 'partner_decline'
         : ((string) $m['kind'] === 'ministry_approve' ? 'partner_accept' : 'question');
    printf("    [%s] %-30s %-16s → %s\n", $m['mailbox'], mb_substr((string) $m['from_email'], 0, 30),
           (string) $m['kind'], $new);
    printf("        %s\n", mb_substr((string) $m['name'], 0, 70));
    if ($apply) {
        // Снимаем отметку обработки: письмо вернётся в разбор уже партнёрской
        // веткой (cron/inbox_actions.php) — приём или отказ выполнит она.
        q("UPDATE inbox_messages SET kind=?, handled_by='' WHERE id=?", [$new, (int) $m['id']]);
    }
}

/* ── 4. Итог ─────────────────────────────────────────────────────────────── */
echo "\n$line\n";
printf("  учреждений всего:            %d\n", (int) scalar("SELECT COUNT(*) FROM institutions"));
printf("  приглашено:                  %d\n", (int) scalar("SELECT COUNT(*) FROM institutions WHERE COALESCE(invited_at,'')<>''"));
printf("  ответили (после разбора):    %d\n", (int) scalar("SELECT COUNT(*) FROM institutions WHERE COALESCE(replied_at,'')<>''"));
printf("  партнёров:                   %d\n", (int) scalar("SELECT COUNT(*) FROM institutions WHERE partner_status='accepted'"));
echo $apply ? "\n  применено\n" : "\n  это предпросмотр: php scripts/partner_replies_fix.php --apply\n";
