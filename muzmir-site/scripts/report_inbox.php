<?php
/**
 * ОТЧЁТ ПО ВХОДЯЩЕЙ ПОЧТЕ ВСЕХ ЧЕТЫРЁХ ЯЩИКОВ.
 *
 * Владелец спросил прямо: на шесть тысяч разосланных писем есть ли ответы хоть
 * где-нибудь. Отвечать по таблице разбора нельзя — она смотрит только на две
 * недели назад и только на то, что успел взять крон. Поэтому здесь мы идём
 * напрямую в ящики по IMAP, считаем ВСЁ, что там лежит (входящие и спам), и
 * показываем живые письма отдельно от роботов.
 *
 *   php scripts/report_inbox.php            — за всё время
 *   php scripts/report_inbox.php 30         — за последние 30 дней
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/imap_read.php';
require_once BASE_PATH . '/core/inbox_reader.php';

$days = isset($argv[1]) ? max(0, (int) $argv[1]) : 0;
$crit = $days > 0 ? 'SINCE ' . date('d-M-Y', time() - $days * 86400) : 'ALL';
$line = str_repeat('=', 78);
$own  = inbox_own_emails();

echo "ЧТО ЛЕЖИТ В НАШИХ ЯЩИКАХ (" . ($days > 0 ? "за $days дн." : "за всё время") . ")\n$line\n";

$titles = ['novosti' => 'novosti@ — партнёрка и учреждения',
           'news'    => 'news@ — своя база участников',
           'kc'      => 'kc@ — ведомства и министерства',
           'nagradi' => 'nagradi@ — награды и заказы'];

$grand = ['всего' => 0, 'роботы' => 0, 'живые' => 0];
foreach (inbox_boxes() as $alias => $accName) {
    $acc = mail_account_by_name($accName);
    if (!$acc || empty($acc['user'])) { printf("\n%s\n  ящик не настроен\n", $titles[$alias] ?? $alias); continue; }
    $acc['host'] = 'imap.yandex.ru'; $acc['port'] = 993;

    printf("\n%s\n%s\n", $titles[$alias] ?? $alias, str_repeat('-', 78));
    $live = [];
    $n = ['всего' => 0, 'роботы' => 0, 'свои' => 0, 'живые' => 0];
    foreach (['INBOX' => 'входящие', 'Spam' => 'спам'] as $folder => $folderRu) {
        $ids = im_search($acc, $crit, $folder);
        printf("  %-10s писем: %d\n", $folderRu, count($ids));
        foreach ($ids as $id) {
            $raw = im_fetch($acc, $id, $folder);
            if (trim($raw) === '') continue;
            $m = im_parse($raw);
            $from = mb_strtolower(trim((string) $m['from']));
            if ($from === '') continue;
            $n['всего']++;
            if (in_array($from, $own, true)) { $n['свои']++; continue; }
            $auto = inbox_is_auto((string) $m['subject'], (string) $m['text'], $raw);
            if (inbox_is_service($from) || $auto) { $n['роботы']++; continue; }
            $n['живые']++;
            $live[] = [
                'when'  => trim((string) $m['date']),
                'from'  => $from,
                'subj'  => mb_substr(trim((string) $m['subject']), 0, 64),
                'kind'  => inbox_classify($alias, (string) $m['subject'], (string) $m['text'], false),
                'where' => $folderRu,
            ];
        }
    }
    printf("  из них: живых людей %d, роботов и служебных %d, наших собственных %d\n",
        $n['живые'], $n['роботы'], $n['свои']);
    if ($live) {
        usort($live, static fn($a, $b) => strtotime($b['when']) <=> strtotime($a['when']));
        echo "  ЖИВЫЕ ПИСЬМА:\n";
        foreach ($live as $l) {
            printf("   %-16s %-34s %-16s %s\n",
                ($t = strtotime($l['when'])) ? date('d.m.Y H:i', $t) : '?',
                mb_substr($l['from'], 0, 34), $l['kind'], $l['subj'] . ($l['where'] === 'спам' ? '  [из спама]' : ''));
        }
    } else {
        echo "  живых писем нет\n";
    }
    $grand['всего'] += $n['всего']; $grand['роботы'] += $n['роботы']; $grand['живые'] += $n['живые'];
}

echo "\n$line\n";
printf("ИТОГО: писем %d, живых ответов %d, роботов и служебных %d\n",
    $grand['всего'], $grand['живые'], $grand['роботы']);

/* Сколько мы вообще отправили — чтобы ответы было с чем сравнивать. */
try {
    $sent = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='sent'") ?? 0);
    if ($sent > 0) printf("отправлено писем из очереди: %d\n", $sent);
} catch (\Throwable $e) {}
