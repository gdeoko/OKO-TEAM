<?php
/**
 * СКВОЗНОЙ ТЕСТ ОТПРАВКИ ОБРАЩЕНИЯ — НА ЯЩИК ЦЕНТРА.
 *
 * Собирает обращение ровно так же, как рассылка: тот же бланк, те же вложения,
 * тот же отправитель и пул. Отличие одно — адресат подменяется на почту центра,
 * и в реестр исходящих ничего не пишется, номер не занимается.
 *
 * Так проверяется то, что нельзя проверить предпросмотром: доходит ли письмо с
 * kc@, не режет ли его почтовая служба за размер вложений, как оно выглядит в
 * почтовом клиенте.
 *
 *   php scripts/test_ministry_send.php                     — на ящик админов
 *   php scripts/test_ministry_send.php kc@музыкальный-мир.рф
 *
 * ЖЕЛЕЗНОЕ ПРАВИЛО: адресат обязан быть ящиком центра. Слать тест на живое
 * ведомство нельзя — обращение отправляется один раз.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/ministries.php';
require_once BASE_PATH . '/core/letter_texts.php';
require_once BASE_PATH . '/core/letter_mail.php';
require_once BASE_PATH . '/core/ministry_mailing.php';

$to = trim((string) ($argv[1] ?? (string) cfgv('owner_email', 'kulturniy.centr.mir@gmail.com')));

// Свои ящики — это домен центра и почта администраторов. Всё остальное значит,
// что кто-то по ошибке подставил адрес ведомства.
$own = [mb_strtolower((string) cfgv('owner_email', '')), mb_strtolower((string) cfgv('org_email', ''))];
$isOwn = in_array(mb_strtolower($to), $own, true)
      || str_contains(mb_strtolower($to), 'музыкальный-мир.рф')
      || str_contains(mb_strtolower($to), 'xn----7sbugdeiegh1b0a9hen');
if (!$isOwn) { echo "СТОП: $to не похож на ящик центра. Тест шлём только себе.\n"; exit(1); }

$free = ol_comps(true);
if (!$free) { echo "нет бесплатного конкурса — обращение собрать не из чего\n"; exit(1); }

$rows = min_recipients();
if (!$rows) { echo "нет ни одного готового адресата\n"; exit(1); }
$r = $rows[0];

echo "СОБИРАЕМ ПИСЬМО\n";
echo '  образец адресата: ' . $r['org'] . ' · ' . $r['person'] . "\n";
echo '  реально уйдёт на: ' . $to . "\n\n";

$number = 'ТЕСТ-' . date('dmY-His');
$mail = lm_mail_support($r, $number, $free);
$att  = mm_attachments($free);
$pdf  = (string) ($mail['pdf'] ?? '');
$files = $pdf !== '' && is_file($pdf) ? array_merge([$pdf], $att) : $att;

$bytes = 0;
echo "ВЛОЖЕНИЯ\n";
foreach ($files as $f) {
    $bytes += (int) filesize($f);
    printf("  %-56s %6d КБ\n", basename($f), (int) round(filesize($f) / 1024));
}
printf("  ИТОГО %d файлов, %.1f МБ\n\n", count($files), $bytes / 1048576);
if ($bytes > 20 * 1024 * 1024) echo "  ВНИМАНИЕ: больше 20 МБ, почтовые службы такое режут\n\n";

$acc = mail_account_by_name('kc');
echo "ОТПРАВИТЕЛЬ\n";
echo '  пул official → ' . implode(', ', mail_pool_names('official')) . "\n";
echo '  ящик: ' . ($acc['from_addr'] ?? '(не настроен!)') . ' через ' . ($acc['host'] ?? '?') . "\n";
echo '  ответ на: ' . ol_reply_email() . "\n\n";

if (!$acc) { echo "ящик kc не настроен в smtp_senders — отправлять нечем\n"; exit(1); }

$subject = '[ТЕСТ] ' . mm_subject($number);
$okSend = mail_send($to, $subject, (string) $mail['html'], [
    'account' => $acc,
    'attach'  => $files,
]);
if (!$okSend && function_exists('mail_last_error')) echo '  причина: ' . mail_last_error() . "\n";

echo $okSend ? "ОТПРАВЛЕНО: письмо ушло на $to\n" : "НЕ ОТПРАВЛЕНО: почтовая служба отказала\n";
echo "в реестр исходящих ничего не записано, номер не занят\n";
