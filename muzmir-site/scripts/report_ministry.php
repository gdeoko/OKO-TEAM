<?php
/**
 * СВОДКА ПО ОБРАЩЕНИЯМ В ВЕДОМСТВА.
 *
 * Одна команда отвечает на вопрос «что там с рассылкой»: сколько отправлено,
 * сколько ответили и что именно ответили, кто выбыл и почему, какие адреса
 * оказались мёртвыми. Считается по фактам из базы, ничего не отправляет.
 *
 *   php scripts/report_ministry.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$line = str_repeat('=', 78);
$num  = static fn($v): int => (int) (scalar($v) ?? 0);

echo "СВОДКА ПО ОБРАЩЕНИЯМ В ВЕДОМСТВА · " . date('d.m.Y H:i') . "\n$line\n\n";

/* ── База адресатов ────────────────────────────────────────────────────────── */
$total    = $num("SELECT COUNT(*) FROM ministries");
$sent     = $num("SELECT COUNT(*) FROM ministries WHERE status='sent'");
$waiting  = $num("SELECT COUNT(*) FROM ministries WHERE status='new'");
$excluded = $num("SELECT COUNT(*) FROM ministries WHERE status='excluded'");
$declined = $num("SELECT COUNT(*) FROM ministries WHERE status='declined'");
$bounced  = $num("SELECT COUNT(*) FROM ministries WHERE status='bounced'");
$letters  = $num("SELECT COUNT(*) FROM official_letters WHERE kind='support' AND status='sent'");

echo "РАССЫЛКА\n";
printf("  всего ведомств в базе        %4d\n", $total);
printf("  письмо отправлено            %4d  (официальных писем ушло: %d)\n", $sent, $letters);
printf("  ещё не отправляли            %4d\n", $waiting);
printf("  исключены из рассылки        %4d\n", $excluded);
printf("  отказали и вычеркнуты        %4d\n", $declined);
printf("  адрес не существует          %4d\n", $bounced);

/* ── Ответы ────────────────────────────────────────────────────────────────── */
$rows = all("SELECT verdict, COUNT(DISTINCT email) AS orgs, COUNT(*) AS msgs
               FROM ministry_replies GROUP BY verdict ORDER BY 2 DESC");
$names = [
    'support' => 'ПОДДЕРЖАЛИ (документ на бланке)',
    'refusal' => 'отказали (документ на бланке)',
    'receipt' => 'обращение зарегистрировано / принято к рассмотрению',
    'eform'   => 'перенаправили в электронную приёмную',
    'fix'     => 'просят переоформить (ошибка в ФИО или должности)',
    'bounce'  => 'письмо вернулось (адрес или почтовый сбой)',
    'other'   => 'не разобрано, смотрит человек',
];
$answered = $num("SELECT COUNT(DISTINCT email) FROM ministry_replies");

echo "\nОТВЕТЫ\n";
printf("  ответили ведомств            %4d из %d отправленных (%s%%)\n",
    $answered, $sent, $sent > 0 ? number_format($answered / $sent * 100, 1, ',', '') : '0');
if (!$rows) {
    echo "  разобранных ответов пока нет\n";
} else {
    foreach ($rows as $r) {
        printf("    %-52s %3d ведомств\n", $names[(string) $r['verdict']] ?? (string) $r['verdict'], (int) $r['orgs']);
    }
}

// Кто именно ответил — список короткий, его полезно видеть целиком.
$who = all("SELECT org, verdict, MAX(answered_at) AS at FROM ministry_replies
            GROUP BY email ORDER BY at DESC, org");
if ($who) {
    echo "\n  кто ответил:\n";
    foreach ($who as $w) {
        printf("    %-8s %s%s\n",
            (string) $w['verdict'],
            mb_substr((string) $w['org'], 0, 56),
            trim((string) $w['at']) !== '' ? '  (' . date('d.m H:i', strtotime((string) $w['at'])) . ')' : '');
    }
}

/* ── Кто выбыл и почему ────────────────────────────────────────────────────── */
$out = all("SELECT status, org, email, COALESCE(note,'') AS note, COALESCE(e_reception_url,'') AS form
              FROM ministries WHERE status IN ('excluded','declined','bounced','unsub')
           ORDER BY status, org");
if ($out) {
    echo "\nВЫБЫЛИ ИЗ РАССЫЛКИ (" . count($out) . ")\n";
    foreach ($out as $o) {
        printf("  %-9s %-50s %s\n", (string) $o['status'], mb_substr((string) $o['org'], 0, 50),
            (string) $o['email'] !== '' ? (string) $o['email'] : '(адрес удалён)');
        $why = trim((string) $o['note']);
        if ($why !== '') echo '            ' . mb_substr($why, 0, 92) . "\n";
        if (trim((string) $o['form']) !== '') echo '            приёмная: ' . (string) $o['form'] . "\n";
    }
}

/* ── Письма поддержки на сайте ─────────────────────────────────────────────── */
$gallery = $num("SELECT COUNT(*) FROM ministry_letters");
echo "\nПИСЬМА ПОДДЕРЖКИ НА САЙТЕ\n";
printf("  опубликовано                 %4d\n", $gallery);

echo "\n$line\n";
