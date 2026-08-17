<?php
/**
 * СВОДКА ДНЯ: ЧТО УШЛО, ЧТО ПРИШЛО, ЧТО ПОЛУЧИЛОСЬ.
 *
 * Каналов стало много: почта по своей базе, письма учреждениям, обращения в
 * сообщения ВКонтакте, записи в чужих сообществах, письма педагогам, обращения
 * в ведомства. Пока по каждому лезешь в свою таблицу, картины дня нет ни у
 * кого, и вопрос «какой статус» превращается в полчаса раскопок.
 *
 * Здесь всё в одном месте и в одном порядке: сколько отправлено, сколько
 * доставлено, сколько ответили, что ответили и сколько заявок это дало. Цифры
 * берутся из таблиц как есть, без сглаживания: ноль показывается нулём.
 *
 *   php scripts/daily_status.php            — сегодня и общий итог
 *   php scripts/daily_status.php 7          — то же плюс разбивка за 7 дней
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$days = max(0, (int) ($argv[1] ?? 0));
$line = str_repeat('=', 78);
$n    = static fn($v): string => number_format((int) $v, 0, '.', ' ');
$one  = static function (string $sql, array $a = []): int {
    try { return (int) (scalar($sql, $a) ?? 0); } catch (\Throwable $e) { return 0; }
};
$has  = static fn(string $t): bool => function_exists('tbl_exists') ? tbl_exists($t) : true;

printf("СВОДКА НА %s\n%s\n", date('d.m.Y H:i'), $line);

/* ═══════════ 1. Почта ═══════════ */
echo "\n1. ПОЧТА\n$line\n";
$sentToday = $one("SELECT COUNT(*) FROM mail_queue WHERE status='sent' AND date(sent_at)=date('now','localtime')");
$sentAll   = $one("SELECT COUNT(*) FROM mail_queue WHERE status='sent'");
$queued    = $one("SELECT COUNT(*) FROM mail_queue WHERE status='queued'");
$failed    = $one("SELECT COUNT(*) FROM mail_queue WHERE status='failed'");
printf("  отправлено сегодня: %s, всего: %s\n", $n($sentToday), $n($sentAll));
printf("  в очереди: %s, не ушло: %s\n", $n($queued), $n($failed));

foreach (all("SELECT campaign_type AS t, status AS s, COUNT(*) c FROM mail_queue
              GROUP BY 1,2 ORDER BY t, s") as $r) {
    $names = ['konkurs' => 'своя база', 'inst' => 'учреждения', 'teacher' => 'педагоги',
              'ministry' => 'ведомства', '' => 'прочее'];
    printf("    %-12s %-8s %s\n", $names[(string) $r['t']] ?? (string) $r['t'], (string) $r['s'], $n($r['c']));
}

if ($has('mail_events')) {
    echo "\n  события доставки (вебхук Unisender):\n";
    $ev = all("SELECT status, COUNT(*) c FROM mail_events GROUP BY 1 ORDER BY c DESC");
    if (!$ev) echo "    пусто — события не приходят\n";
    foreach ($ev as $r) printf("    %-16s %s\n", (string) $r['status'], $n($r['c']));
}

/* ═══════════ 2. Учреждения и партнёрка ═══════════ */
echo "\n2. УЧРЕЖДЕНИЯ И ПАРТНЁРСТВО\n$line\n";
printf("  учреждений в базе: %s, приглашено письмами: %s\n",
    $n($one("SELECT COUNT(*) FROM institutions")),
    $n($one("SELECT COUNT(*) FROM institutions WHERE invited_count>0")));
foreach (['accepted' => 'приняли партнёрство', 'declined' => 'отказались',
          'blocked' => 'заблокированы', 'invited' => 'помечены приглашёнными'] as $st => $t) {
    printf("  %-24s %s\n", $t, $n($one("SELECT COUNT(*) FROM institutions WHERE partner_status=?", [$st])));
}
if ($has('partner_events')) {
    foreach (all("SELECT kind, COUNT(*) c FROM partner_events GROUP BY 1 ORDER BY c DESC LIMIT 8") as $r) {
        printf("    событие %-16s %s\n", (string) $r['kind'], $n($r['c']));
    }
}
printf("  заявок, засчитанных учреждениям: %s\n",
    $n($one("SELECT COUNT(*) FROM applications WHERE institution_id<>0")));

/* ═══════════ 3. Ведомства ═══════════ */
echo "\n3. ВЕДОМСТВА\n$line\n";
printf("  ведомств в базе: %s\n", $n($one("SELECT COUNT(*) FROM ministries")));
if ($has('official_letters')) {
    printf("  официальных обращений выпущено: %s (из них ведомствам: %s)\n",
        $n($one("SELECT COUNT(*) FROM official_letters")),
        $n($one("SELECT COUNT(*) FROM official_letters WHERE kind='support'")));
}
if ($has('ministry_replies')) {
    $rep = $one("SELECT COUNT(*) FROM ministry_replies");
    printf("  ответов от ведомств: %s\n", $n($rep));
    foreach (all("SELECT COALESCE(NULLIF(verdict,''),'без разбора') v, COUNT(*) c
                    FROM ministry_replies GROUP BY 1 ORDER BY c DESC") as $r) {
        $names = ['support' => 'поддержали', 'refuse' => 'отказали', 'fix' => 'просят исправить',
                  'question' => 'задали вопрос', 'redirect' => 'перенаправили'];
        printf("    %-20s %s\n", $names[(string) $r['v']] ?? (string) $r['v'], $n($r['c']));
    }
    foreach (all("SELECT org, verdict, substr(COALESCE(excerpt,''),1,90) x, created_at
                    FROM ministry_replies ORDER BY id DESC LIMIT 5") as $r) {
        printf("    · %s [%s] %s\n", mb_substr((string) $r['org'], 0, 40),
            (string) $r['verdict'], trim((string) $r['x']));
    }
}
if ($has('ministry_letters')) {
    printf("  писем поддержки опубликовано на сайте: %s\n", $n($one("SELECT COUNT(*) FROM ministry_letters")));
}

/* ═══════════ 4. Входящая почта ═══════════ */
if ($has('inbox_messages')) {
    echo "\n4. ВХОДЯЩИЕ ПИСЬМА\n$line\n";
    printf("  всего разобрано: %s, за сегодня: %s\n",
        $n($one("SELECT COUNT(*) FROM inbox_messages")),
        $n($one("SELECT COUNT(*) FROM inbox_messages WHERE date(received_at)=date('now','localtime')")));
    foreach (all("SELECT COALESCE(NULLIF(kind,''),'не разобрано') k, COUNT(*) c
                    FROM inbox_messages GROUP BY 1 ORDER BY c DESC LIMIT 8") as $r) {
        $names = ['service' => 'служебные и отбивки', 'auto' => 'автоответы',
                  'question' => 'вопросы участников', 'ministry_question' => 'вопросы ведомств',
                  'partner_yes' => 'согласия на партнёрство'];
        printf("    %-24s %s\n", $names[(string) $r['k']] ?? (string) $r['k'], $n($r['c']));
    }
}

/* ═══════════ 5. ВКонтакте ═══════════ */
echo "\n5. ВКОНТАКТЕ\n$line\n";
if ($has('vk_targets')) {
    printf("  площадок: открытых стен %s, предложек %s, закрытых %s\n",
        $n($one("SELECT COUNT(*) FROM vk_targets WHERE can_post=1")),
        $n($one("SELECT COUNT(*) FROM vk_targets WHERE can_post=0 AND can_suggest=1")),
        $n($one("SELECT COUNT(*) FROM vk_targets WHERE can_post=0 AND can_suggest=0")));
}
if ($has('vk_promo_log')) {
    printf("  записей выпущено сегодня: %s, всего: %s\n",
        $n($one("SELECT COUNT(*) FROM vk_promo_log WHERE date(created_at)=date('now','localtime') AND outcome<>'error'")),
        $n($one("SELECT COUNT(*) FROM vk_promo_log WHERE outcome<>'error'")));
    foreach (all("SELECT outcome, COUNT(*) c FROM vk_promo_log GROUP BY 1 ORDER BY c DESC") as $r) {
        $names = ['sent' => 'отправлено, судьба неизвестна', 'published' => 'опубликовано',
                  'pending' => 'висит у администратора', 'rejected' => 'отклонили',
                  'ignored' => 'не смотрят предложку', 'error' => 'отказ ВКонтакте'];
        printf("    %-30s %s\n", $names[(string) $r['outcome']] ?? (string) $r['outcome'], $n($r['c']));
    }
}
if ($has('vk_outreach_log')) {
    printf("  партнёрских обращений в ЛС: сегодня %s, всего %s\n",
        $n($one("SELECT COUNT(*) FROM vk_outreach_log WHERE date(created_at)=date('now','localtime') AND outcome='sent'")),
        $n($one("SELECT COUNT(*) FROM vk_outreach_log WHERE outcome='sent'")));
}

/* ═══════════ 6. Заявки ═══════════ */
echo "\n6. ЗАЯВКИ\n$line\n";
printf("  сегодня: %s, за месяц: %s, всего: %s\n",
    $n($one("SELECT COUNT(*) FROM applications WHERE date(created_at)=date('now','localtime')")),
    $n($one("SELECT COUNT(*) FROM applications WHERE created_at >= date('now','localtime','start of month')")),
    $n($one("SELECT COUNT(*) FROM applications")));
printf("  оплаченных за месяц: %s\n",
    $n($one("SELECT COUNT(*) FROM applications WHERE is_paid=1 AND created_at >= date('now','localtime','start of month')")));

$src = all("SELECT CASE WHEN COALESCE(src,'')='' THEN 'без метки' ELSE src END s, COUNT(*) c
              FROM applications WHERE created_at >= date('now','localtime','-30 days')
             GROUP BY 1 ORDER BY c DESC LIMIT 8");
if ($src) {
    echo "  источники за 30 дней:\n";
    foreach ($src as $r) printf("    %-28s %s\n", (string) $r['s'], $n($r['c']));
}

/* ═══════════ 7. По дням ═══════════ */
if ($days > 0) {
    echo "\n7. ПО ДНЯМ\n$line\n";
    printf("  %-12s %8s %8s %8s\n", 'дата', 'писем', 'заявок', 'записей ВК');
    for ($i = $days - 1; $i >= 0; $i--) {
        $d = date('Y-m-d', strtotime("-$i day"));
        printf("  %-12s %8s %8s %8s\n", date('d.m', strtotime($d)),
            $n($one("SELECT COUNT(*) FROM mail_queue WHERE status='sent' AND date(sent_at)=?", [$d])),
            $n($one("SELECT COUNT(*) FROM applications WHERE date(created_at)=?", [$d])),
            $has('vk_promo_log')
                ? $n($one("SELECT COUNT(*) FROM vk_promo_log WHERE date(created_at)=? AND outcome<>'error'", [$d]))
                : '0');
    }
}

echo "\n$line\n";
