<?php
/**
 * АУДИТ ВХОДЯЩЕЙ ПОЧТЫ.
 *
 * Разбор писем решает судьбу адресов: по согласию учреждение получает сертификат
 * и доступ, по отказу адрес удаляется навсегда. Ошибка тут стоит дорого в обе
 * стороны, поэтому классификатор проверяется на живых формулировках, какими
 * пишут в учреждениях, а не на выдуманных.
 *
 *   php scripts/audit_inbox.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/inbox_reader.php';

$line = str_repeat('=', 78);
$fail = 0;
$ok   = 0;

/** Проверка одного случая. */
$check = static function (string $what, $got, $want) use (&$fail, &$ok): void {
    $good = $got === $want;
    $good ? $ok++ : $fail++;
    printf("  %s %-58s %s\n", $good ? '✓' : '✗', mb_substr($what, 0, 58),
        $good ? '' : ('получили «' . var_export($got, true) . '», ждали «' . var_export($want, true) . '»'));
};

/* ── 1. Автоответчик против живого человека ───────────────────────────────── */
echo "АВТООТВЕТЧИК ОТЛИЧАЕТСЯ ОТ ЧЕЛОВЕКА\n$line\n";
$autos = [
    ['Автоответ', 'Я в отпуске до 25 августа.'],
    ['', 'Данное письмо сформировано автоматически, отвечать на него не нужно.'],
    ['Re: Обращение', 'Ваше обращение зарегистрировано. Вх. №89-23/01-06/1592 от 14.08.2026г.'],
    ['Out of office', 'I am currently out of office.'],
    ['Re: письмо', 'Ваше письмо получено. Спасибо.'],
];
foreach ($autos as [$s, $b]) $check('робот: ' . ($s ?: mb_substr($b, 0, 40)), inbox_is_auto($s, $b), true);

$humans = [
    ['Re: Приглашение', 'Здравствуйте! Подтверждаем согласие на информационное партнёрство. Реквизиты во вложении.'],
    ['Вопрос', 'Добрый день. Уточните, пожалуйста, до какого числа принимаются заявки?'],
];
foreach ($humans as [$s, $b]) $check('человек: ' . mb_substr($b, 0, 44), inbox_is_auto($s, $b), false);

/* ── 2. Классификатор ─────────────────────────────────────────────────────── */
echo "\nО ЧЁМ ПИСЬМО\n$line\n";
$cases = [
    // согласия
    ['novosti', 'Re: Приглашаем к участию', 'Подтверждаем согласие на участие в информационном партнёрстве.', 'partner_accept'],
    ['novosti', 'Ответ', 'Наше учреждение согласно стать информационным партнёром центра.', 'partner_accept'],
    ['novosti', '', 'Принимаем Ваше предложение о партнёрстве, просим присвоить статус.', 'partner_accept'],
    ['novosti', '', 'Мы заинтересованы в сотрудничестве с Вашим центром.', 'partner_accept'],
    // отказы
    ['novosti', 'Re: Приглашаем', 'Отказываемся от участия, спасибо за предложение.', 'partner_decline'],
    ['novosti', '', 'Просим более не направлять письма на этот адрес.', 'partner_decline'],
    ['novosti', '', 'Наше учреждение не планирует участвовать в конкурсах.', 'partner_decline'],
    ['novosti', '', 'Исключите нас из рассылки, пожалуйста.', 'partner_decline'],
    // вопросы (не должны стать ни согласием, ни отказом)
    ['novosti', 'Вопрос', 'Здравствуйте! А положение о конкурсе можно ещё раз прислать?', 'question'],
    ['novosti', '', 'Скажите, участие платное или нет? Хотим показать директору.', 'question'],
    ['news',    '', 'Когда придёт диплом моего ребёнка?', 'question'],
    ['nagradi', '', 'Заказала кубок, когда ждать отправку?', 'question'],
    // ведомства
    ['kc', 'Re: Обращение', 'Не находим оснований для поддержки конкурса.', 'ministry_decline'],
    ['kc', 'Re: Обращение', 'Информация о конкурсах доведена до подведомственных учреждений, поддерживаем.', 'ministry_approve'],
    ['kc', 'Re: Обращение', 'Уточните регистрационный номер организации.', 'ministry_question'],
    // недоставка
    ['news', 'Недоставленное сообщение', 'Не удалось доставить письмо адресату', 'bounce'],
];
foreach ($cases as [$box, $subj, $body, $want]) {
    $check($box . ': ' . mb_substr($body, 0, 46), inbox_classify($box, $subj, $body, false), $want);
}

/* ── 3. Служебные отправители ─────────────────────────────────────────────── */
echo "\nСЛУЖЕБНЫЕ ОТПРАВИТЕЛИ\n$line\n";
foreach (['mailer-daemon@yandex.ru', 'noreply@id.yandex.ru', 'no-reply@vk.com', 'postmaster@mail.ru'] as $e) {
    $check('робот: ' . $e, inbox_is_service($e), true);
}
foreach (['school12@mail.ru', 'info@iro22.ru'] as $e) {
    $check('живой адрес: ' . $e, inbox_is_service($e), false);
}

/* ── 4. Свои адреса не разбираем ──────────────────────────────────────────── */
echo "\nСВОИ АДРЕСА (сами себе не отвечаем)\n$line\n";
$own = inbox_own_emails();
foreach (['kc@музыкальный-мир.рф', 'okoteam.top@gmail.com'] as $e) {
    $check('в списке своих: ' . $e, in_array(mb_strtolower($e), $own, true), true);
}
$check('чужой адрес не в списке своих', in_array('school12@mail.ru', $own, true), false);

/* ── 5. Что реально лежит в базе ──────────────────────────────────────────── */
echo "\nЧТО УЖЕ РАЗОБРАНО НА БОЕВОЙ БАЗЕ\n$line\n";
inbox_migrate();
foreach (all("SELECT mailbox, kind, COUNT(*) n FROM inbox_messages GROUP BY 1,2 ORDER BY 1,3 DESC") as $r) {
    printf("  %-9s %-20s %d\n", (string) $r['mailbox'], (string) $r['kind'], (int) $r['n']);
}
$wait = (int) (scalar("SELECT COUNT(*) FROM inbox_messages WHERE handled_by=''") ?? 0);
echo "  ждут разбора: $wait\n";

echo "\n$line\n";
echo $fail === 0 ? "Все $ok проверок пройдены.\n" : "ПРОВАЛОВ: $fail из " . ($ok + $fail) . "\n";
exit($fail === 0 ? 0 : 1);
