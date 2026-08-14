<?php
/**
 * ОБРАЗЕЦ ОБРАЩЕНИЯ В ВЕДОМСТВО — ПОСМОТРЕТЬ ДО ОТПРАВКИ.
 *
 * Обращение отправляется один раз и с исходящим номером: сначала документ надо
 * увидеть глазами, а уже потом ставить письма в очередь. Скрипт собирает письмо
 * ровно тем же кодом, что и рассылка, но НИЧЕГО не пишет в реестр обращений и
 * не занимает номер — вместо него подставляется «ОБРАЗЕЦ».
 *
 *   php scripts/sample_letter.php              — по первому адресату из списка
 *   php scripts/sample_letter.php 214          — по конкретной строке ministries
 *   php scripts/sample_letter.php 214 /tmp/x   — и положить файлы в свою папку
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ministries.php';
require_once BASE_PATH . '/core/letter_texts.php';
require_once BASE_PATH . '/core/letter_mail.php';
require_once BASE_PATH . '/core/ministry_mailing.php';

$id  = (int) ($argv[1] ?? 0);
$dir = (string) ($argv[2] ?? '/tmp/sample_letter');
@mkdir($dir, 0775, true);

$free = ol_comps(true);
if (!$free) { echo "нет ни одного бесплатного конкурса — обращение собрать не из чего\n"; exit(1); }

$rows = min_recipients();
$r = null;
foreach ($rows as $x) { if ($id === 0 || (int) $x['id'] === $id) { $r = $x; break; } }
if (!$r) { echo "адресат не найден среди готовых к отправке\n"; exit(1); }

echo "АДРЕСАТ\n";
echo '  ведомство: ' . $r['org'] . "\n";
echo '  кому:      ' . $r['person_role'] . ' ' . $r['person'] . "\n";
echo '  адрес:     ' . $r['email'] . "\n";
echo '  ветка:     ' . ($r['branch'] ?? 'main') . "\n\n";

echo "КОНКУРСЫ В ПИСЬМЕ (только бесплатные)\n";
foreach ($free as $c) echo '  ' . $c['name'] . ' — приём до ' . $c['end_date'] . "\n";
echo "\n";

$mail = lm_mail_support($r, 'ОБРАЗЕЦ', $free);
$att  = mm_attachments($free);
$pdf  = (string) ($mail['pdf'] ?? '');

echo "ПИСЬМО\n";
echo '  тема:      ' . mm_subject('ОБРАЗЕЦ') . "\n";
echo '  отправитель: пул official → ' . implode(', ', mail_pool_names('official')) . "\n";
echo '  ответ на:  ' . ol_reply_email() . "\n\n";

echo "ВЛОЖЕНИЯ\n";
$files = $pdf !== '' && is_file($pdf) ? array_merge([$pdf], $att) : $att;
foreach ($files as $f) {
    printf("  %-58s %d КБ\n", basename($f), (int) round(filesize($f) / 1024));
    @copy($f, $dir . '/' . basename($f));
}
file_put_contents($dir . '/pismo.html', (string) $mail['html']);
echo "\nвсё сложено в $dir (тело письма — pismo.html)\n";
