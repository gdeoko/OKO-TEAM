<?php
/**
 * ПРОВЕРКА РАЗДЕЛЕНИЯ ВОЛН И ЗАЩИТЫ ОТ ЛОЖНЫХ ОТКАЗОВ.
 *
 * Проверяется то, что ломалось вживую: письмо учреждению уходило с рассылочного
 * ящика своей базы, дневной потолок считался по одному ящику вместо двух, а
 * молчаливый отказ почтовика вычёркивал живого человека навсегда.
 *
 *   php scripts/audit_mail_split.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once BASE_PATH . '/core/mail_reputation.php';

$line = str_repeat('=', 78);
$ok = $bad = 0;
$say = function (bool $good, string $what, string $note = '') use (&$ok, &$bad): void {
    if ($good) { $ok++;  printf("  [ок]   %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
    else       { $bad++; printf("  [СБОЙ] %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
};

echo "КАЖДАЯ ВОЛНА СО СВОЕГО ЯЩИКА\n$line\n";

$boxBulk = nl_box_for_type('konkurs');
$boxCold = nl_box_for_type('inst');
$say($boxBulk !== '', 'ящик своей базы настроен', $boxBulk);
$say($boxCold !== '', 'ящик учреждений настроен', $boxCold);
$say($boxBulk !== $boxCold, 'волны не делят один ящик');

$fromBulk = mail_addr_ascii((string) (mail_account_by_name('unisender')['from_addr'] ?? ''));
$fromCold = mail_addr_ascii((string) (mail_account_by_name('unisender-cold')['from_addr'] ?? ''));
$say(str_starts_with(mb_strtolower($fromBulk), 'news@'),    'своя база уходит с news@',      $fromBulk);
$say(str_starts_with(mb_strtolower($fromCold), 'novosti@'), 'учреждения уходят с novosti@',  $fromCold);

$say(mail_pool_for(['campaign_type' => 'inst',    'priority' => 5]) === 'cold', 'письмо учреждению получает пул cold');
$say(mail_pool_for(['campaign_type' => 'konkurs', 'priority' => 5]) === 'bulk', 'письмо своей базе получает пул bulk');
// Тема волны запуска содержит слова «наград» и «диплом»: раньше по теме
// определялся пул awards, и массовое письмо уходило с наградного ящика.
$say(mail_pool_for(['campaign_type' => 'konkurs', 'priority' => 5,
                    'subject' => 'Открыт приём заявок — конкурсы с наградами и дипломами']) === 'bulk',
     'тема письма больше не перебивает пул');

echo "\nДНЕВНОЙ ПОТОЛОК СЧИТАЕТСЯ ПО ОБОИМ ЯЩИКАМ\n$line\n";
$boxes = nl_bulk_boxes();
$say(count($boxes) >= 2, 'в массовой отправке два ящика', count($boxes) . ' шт.');
$perBox = nl_per_box_cap($boxBulk);
$cap    = nl_daily_cap();
printf("  норма ящика: %s, дневной потолок: %s\n",
    number_format($perBox, 0, '.', ' '), number_format($cap, 0, '.', ' '));
$say($cap >= $perBox * 2 - 1, 'потолок = сумма норм двух ящиков');
$split = nl_daily_split();
$say(abs(($split['konkurs'] ?? 0) - ($split['inst'] ?? 0)) <= 1, 'волны поделены поровну',
     ($split['konkurs'] ?? 0) . ' / ' . ($split['inst'] ?? 0));

echo "\nОТПРАВКА РАЗЛОЖЕНА ПО ОКНУ\n$line\n";
$from = (int) setting('nl_window_hour_from', '9');
$to   = (int) setting('nl_window_hour_to', '18');
$say($to > $from, 'окно задано', sprintf('%02d:00-%02d:00', $from, $to));
$hours = max(1, $to - $from);
printf("  темп: %s писем в час на ящик, пауза между письмами %d с\n",
    number_format((int) round($perBox / $hours), 0, '.', ' '), nl_box_gap_sec($boxBulk));

echo "\nМОЛЧАЛИВЫЙ ОТКАЗ НЕ УБИВАЕТ АДРЕС\n$line\n";
$say(!mrep_bounce_is_proof(''),                                   'пустая причина не доказывает ничего');
$say(!mrep_bounce_is_proof('550 5.7.1 This message is blocked due to security reason'), 'блокировка по «безопасности» — это канал');
$say(!mrep_bounce_is_proof('550 spam message rejected'),           'отказ по спам-фильтру — это канал');
$say(!mrep_bounce_is_proof('err_spam_rejected'),                   'вердикт сервиса err_spam_rejected — это канал');
$say(mrep_bounce_is_proof('550 5.1.1 The email account that you tried to reach does not exist'), 'прямой текст «ящика нет» — это адрес');
$say(mrep_bounce_is_proof('err_user_not_found'),                   'вердикт сервиса err_user_not_found — это адрес');
$say(mrep_bounce_is_proof('550 no such user here'),                '«no such user» — это адрес');

echo "\nДОМЕН, ОТБИВАЮЩИЙ ПАЧКОЙ, УХОДИТ НА ПАУЗУ\n$line\n";
$stats = mrep_domain_stats(60);
$say(is_array($stats), 'статистика доменов за час читается', count($stats) . ' доменов');
$paused = mrep_paused_domains();
printf("  на паузе сейчас: %s\n", $paused ? mrep_paused_note() : 'никого');
$say(is_array($paused), 'список паузы получен');

echo "\nСВОЯ НОРМА НА КАЖДУЮ ПОЧТОВУЮ СЛУЖБУ\n$line\n";
$capMail = mrep_domain_day_cap('mail.ru');
$say($capMail > 0 && $capMail < 100000, 'у mail.ru своя суточная норма', (string) $capMail);
$say(mrep_domain_day_cap('dshi-example.gov74.ru') === PHP_INT_MAX, 'школьная почта нормой не ограничена');
foreach (['mail.ru', 'yandex.ru', 'gmail.com'] as $d) {
    printf("  %-12s норма %5d, ушло сегодня %5d, осталось %5d\n", $d,
        mrep_domain_day_cap($d), mrep_sent_today_by_domain()[$d] ?? 0, mrep_domain_quota_left($d));
}

echo "\nРАБОЧИЕ ЯЩИКИ ЦЕНТРА В РАССЫЛКАХ НЕ УЧАСТВУЮТ\n$line\n";
// Правило владельца: kc@ — заявки, результаты, сайт, ведомства; nagradi.on@ —
// награды; массовые — только news@ и novosti@, в обоих каналах.
$boxesOf = static function (string $pool): array {
    return array_map(static fn(array $a) => mb_strtolower((string) ($a['user'] ?? '')),
                     mail_fallback_accounts([], $pool));
};
foreach (['bulk', 'cold', 'bulk_smtp', 'cold_smtp'] as $pool) {
    $list = $boxesOf($pool);
    // Имя переменной намеренно длинное: короткое $bad — это счётчик сбоев всего
    // аудита, и его подмена обнуляла итоговую строку.
    $officialBoxes = array_filter($list, static fn($u) => str_starts_with($u, 'kc@') || str_starts_with($u, 'nagradi'));
    $say(!$officialBoxes, "пул $pool не содержит рабочих ящиков центра", implode(', ', $list));
}
$say($boxesOf('bulk_smtp') === $boxesOf('bulk') || str_starts_with($boxesOf('bulk_smtp')[0] ?? '', 'news@'),
     'прямой канал своей базы идёт с news@', $boxesOf('bulk_smtp')[0] ?? '(нет)');
$say(str_starts_with($boxesOf('cold_smtp')[0] ?? '', 'novosti@'),
     'прямой канал учреждений идёт с novosti@', $boxesOf('cold_smtp')[0] ?? '(нет)');

echo "\nШЛЮЗЫ И ЯНДЕКС ИДУТ ПРЯМЫМ КАНАЛОМ\n$line\n";
if (is_file(BASE_PATH . '/core/mail_domain_policy.php')) {
    require_once BASE_PATH . '/core/mail_domain_policy.php';
    $off = mdp_official_domains();
    $say(is_array($off), 'список особого канала читается', count($off) . ' доменов: ' . implode(', ', array_slice(array_keys($off), 0, 5)));
    $say(!mdp_needs_official('kto@mail.ru'), 'публичная почта в особый канал не уходит');
    if ($off) {
        $one = array_key_first($off);
        $say(mdp_needs_official('x@' . $one), 'адрес шлюза распознан', $one);
    }
} else { $say(false, 'файл политики доменов не найден'); }

echo "\n$line\nПРОЙДЕНО: $ok · СБОЕВ: $bad\n";
exit($bad > 0 ? 1 : 0);
