<?php
/**
 * CRON: отправка электронных дипломов участникам.
 * Логика:
 *  - Короткие конкурсы (results_mode=email): каждый диплом должен уйти на почту через 3-5 раб.дней
 *    после проставления результата (jury_graded_at). Отправка в рабочее время МСК с 9:00 до 18:00,
 *    интервал 1 мин между письмами. В выходные - сдвиг на понедельник 9:00.
 *  - Длинные (results_mode=list): результаты публикуются 28 числа месяца пакетом (пост в ВК/сайт/email списком).
 *
 * Планирование хранится в diplomas.scheduled_at. Cron ежеминутно проверяет и шлёт.
 */
declare(strict_types=1);
define('BASE_PATH', dirname(__DIR__));
$CFG = require BASE_PATH . '/config.php';
$GLOBALS['CFG'] = $CFG;
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/telegram.php';
require_once BASE_PATH . '/core/pdf_diploma.php';
require_once BASE_PATH . '/core/diploma_render.php';
db();

// Библиотечный режим: только функции (_diploma_email_html и пр.), крон не запускается.
if (defined('MM_EMAIL_TEST_LIB')) return;

// CLI-хук проверки рендера письма диплома (без запуска рассылки):
//   php cron/send_diplomas.php --render-test
if (PHP_SAPI === 'cli' && in_array('--render-test', $argv, true)) {
    $sample = [
        'comp_name' => 'Величие России',
        'full_name' => 'Смирнова Екатерина Александровна',
        'number'    => 'MM-2026-A1B2C3',
        'result'    => 'ЛАУРЕАТ I СТЕПЕНИ',
        'type'      => 'main',
    ];
    $html = _diploma_email_html($sample);
    echo "RENDER OK, длина: " . strlen($html) . " байт\n";
    if (in_array('--print', $argv, true)) echo $html . "\n";
    // Реальная отправка тестового письма: --send <email> (через nagradi, без вложения)
    $si = array_search('--send', $argv, true);
    if ($si !== false && isset($argv[$si + 1])) {
        $to = (string) $argv[$si + 1];
        $nagradi = mail_senders()['nagradi'] ?? [];
        if (!$nagradi) { echo "нет отправителя nagradi\n"; exit(1); }
        $ok = mail_send($to, 'Ваш диплом — «' . $sample['comp_name'] . '» (' . $sample['result'] . ')', $html, [
            'account' => $nagradi, 'from_name' => 'Наградный отдел «Музыкальный Мир»',
        ]);
        echo "ОТПРАВКА на $to: " . ($ok ? 'OK' : 'FAIL') . "\n";
    }
    exit(0);
}

// 1) Убеждаемся что нужные колонки есть (мягкие миграции).
try { db()->exec("ALTER TABLE diplomas ADD COLUMN scheduled_at TEXT"); } catch (\Throwable $e) {}
try { db()->exec("ALTER TABLE applications ADD COLUMN send_at_override TEXT"); } catch (\Throwable $e) {}

date_default_timezone_set('Europe/Moscow');
$now = new DateTime('now');

// 2) Планируем отправку у новоаттестованных заявок (результат проставлен, но диплом ещё не спланирован).
//    Отклонённые заявки не трогаем; повторное grade_result с изменённым итогом удаляет
//    неотправленный диплом — здесь он будет пересоздан с новым результатом и свежим PDF.
$fresh = all("SELECT a.*, c.results_mode, c.results_date, c.is_paid AS comp_is_paid
              FROM applications a
              JOIN competitions c ON c.id = a.competition_id
              WHERE a.result IS NOT NULL AND a.result <> ''
                AND a.status <> 'rejected'
                AND NOT EXISTS (SELECT 1 FROM diplomas d WHERE d.application_id = a.id)");
foreach ($fresh as $a) {
    $comp = one("SELECT * FROM competitions WHERE id=?", [$a['competition_id']]);
    if (!$comp) continue;
    // 2а. Генерируем PDF основного диплома: сначала HTML-шаблон (эталон, печать
    //     Chromium'ом на бастионе), при недоступности — старый GD-генератор.
    $pdfPath = null;
    try { $pdfPath = diploma_pdf_html((array)$a); } catch (\Throwable $e) { $pdfPath = null; }
    if (!$pdfPath && function_exists('pdf_diploma')) {
        try { $pdfPath = pdf_diploma((array)$a, 'main'); } catch (\Throwable $e) { $pdfPath = null; }
    }
    // 2б. Планируем отправку: ручной override администратора > режим конкурса > 3 раб.дня от даты подачи.
    $sched = _plan_send_at($now, (array)$a, (array)$comp);
    insert('diplomas', [
        'number'         => diploma_make_number((string)$a['number'], 'main'),
        'application_id' => (int)$a['id'],
        'type'           => 'main',
        'result'         => (string)$a['result'],
        'pdf_path'       => $pdfPath ?: '',
        'lang'           => 'ru',
        'scheduled_at'   => $sched->format('Y-m-d H:i:s'),
    ]);
    // 2б-доп. Дополнительный диплом (спецноминация) — ОТДЕЛЬНЫМ документом, тем же расписанием.
    if (trim((string)($a['extra_diploma'] ?? '')) !== '') {
        $pdfExtra = null;
        try { $pdfExtra = diploma_pdf_html((array)$a, ['extra' => true]); } catch (\Throwable $e) { $pdfExtra = null; }
        insert('diplomas', [
            'number'         => diploma_make_number((string)$a['number'], 'extra'),
            'application_id' => (int)$a['id'],
            'type'           => 'extra',
            'result'         => (string)$a['extra_diploma'],
            'pdf_path'       => $pdfExtra ?: '',
            'lang'           => 'ru',
            'scheduled_at'   => $sched->format('Y-m-d H:i:s'),
        ]);
    }
    // 2в. Оригинал (без подписи/печати) сразу летит в бот заказа (t.me/zakaznagrad) — админ отправит почтой.
    _send_original_to_orders_bot((array)$a, (array)$comp);
}

// 3) Шлём то, что подошло по расписанию (окно ±60 сек), интервал 1 мин между заявками.
$dueList = all("SELECT d.*, a.email, a.full_name, a.number AS app_number, c.name AS comp_name
                FROM diplomas d
                JOIN applications a ON a.id = d.application_id
                JOIN competitions c ON c.id = a.competition_id
                WHERE d.sent_at IS NULL
                  AND d.scheduled_at IS NOT NULL
                  AND d.scheduled_at <= ?
                  AND a.status <> 'rejected'
                ORDER BY d.scheduled_at ASC
                LIMIT 30", [$now->format('Y-m-d H:i:s')]);

$sentThisTick = 0;
foreach ($dueList as $d) {
    if ($sentThisTick >= 1) break; // ровно один в минуту
    $to = (string)$d['email']; if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) continue;

    $subject = ((string)($d['type'] ?? 'main') === 'extra'
                  ? 'Ваш дополнительный диплом (спецноминация) конкурса «'
                  : 'Ваш диплом конкурса «')
             . $d['comp_name'] . '» - № ' . $d['number'];
    $html = _diploma_email_html((array)$d);
    // Отправитель — наградной ящик nagradi@ (как и задумано для дипломов/наград).
    // Диплом НЕ прикладываем файлом: письмо богатое (кнопки/промо), а «тяжёлое вложение +
    // много промо-ссылок» на свежем домене Яндекс режет как спам. Диплом — кнопкой «Скачать
    // диплом (PDF)» (ссылка на /diploma/<номер>.pdf). Вложение вернём, когда домен прогреется.
    $opt = [];
    $nagradi = function_exists('mail_senders') ? (mail_senders()['nagradi'] ?? []) : [];
    if ($nagradi) $opt['account'] = $nagradi;
    $ok = false;
    if (function_exists('mail_send')) {
        $ok = (bool) mail_send($to, $subject, $html, $opt);
    }
    if ($ok) {
        update('diplomas', ['sent_at' => $now->format('Y-m-d H:i:s')], 'id=:id', ['id' => (int)$d['id']]);
        // Автостатус: диплом отправлен -> заявка исполнена (цепочка подана→оценена→исполнена).
        q("UPDATE applications SET status='done' WHERE id=?", [(int)$d['application_id']]);
        $sentThisTick++;
    } else {
        // сдвигаем ещё на 5 минут (retry)
        update('diplomas', ['scheduled_at' => (clone $now)->modify('+5 minutes')->format('Y-m-d H:i:s')], 'id=:id', ['id' => (int)$d['id']]);
    }
}

fwrite(STDERR, "send_diplomas: planned=" . count($fresh) . " sent_now=$sentThisTick pending=" . max(0, count($dueList) - $sentThisTick) . "\n");

// ================= helpers =================

/**
 * Планирование даты отправки результата/диплома.
 * Приоритет:
 *  1) applications.send_at_override — ручная дата администратора (со страницы оценки);
 *  2) длинные бесплатные (results_mode='list' ИЛИ is_paid=0) — пакетно в дату публикации
 *     (results_date, иначе ближайшее 28-е число) в 09:05 МСК, по одному не шлём;
 *  3) короткие платные — ДАТА ПОДАЧИ заявки (created_at) + 3 рабочих дня (вс — нерабочий),
 *     рабочее окно 9:00-18:00 МСК; если оценка произошла ПОЗЖЕ этого срока —
 *     ближайшее рабочее окно.
 */
function _plan_send_at(DateTimeInterface $now, array $a, array $comp): DateTime {
    // 1) Ручной override администратора.
    $ov = trim((string)($a['send_at_override'] ?? ''));
    if ($ov !== '') {
        try { return new DateTime($ov); } catch (\Throwable $e) { /* некорректная дата — игнор */ }
    }

    $mode   = (string)($comp['results_mode'] ?? 'email');
    $isPaid = (int)($comp['is_paid'] ?? 0) === 1;

    // 2) Длинные бесплатные: копим, пакетная рассылка в день публикации.
    if ($mode === 'list' || !$isPaid) {
        $rd = trim((string)($comp['results_date'] ?? ''));
        if ($rd !== '') {
            try { return new DateTime($rd . ' 09:05'); } catch (\Throwable $e) {}
        }
        // Ближайшее 28-е число в 09:05.
        $t = new DateTime($now->format('Y-m-') . '28 09:05');
        if ($t <= $now) $t->modify('first day of next month')->modify('+27 days')->setTime(9, 5);
        return $t;
    }

    // 3) Короткие платные: результат + 5 рабочих дней; для участников ВИП-клуба — 3
    //    (вс — нерабочий). Точка отсчёта — момент аттестации (graded_at), иначе подача.
    if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
    $base = trim((string)($a['graded_at'] ?? '')) !== '' ? (string)$a['graded_at'] : (string)($a['created_at'] ?? 'now');
    try { $t = new DateTime($base); } catch (\Throwable $e) { $t = new DateTime($now->format('Y-m-d H:i:s')); }
    $wDays = 5;
    if (!empty($a['user_id']) && function_exists('club_is_active') && club_is_active((int)$a['user_id'])) $wDays = 3;
    $days = 0;
    while ($days < $wDays) {
        $t->modify('+1 day');
        if ((int)$t->format('w') !== 0) $days++; // 0 = воскресенье, не считаем
    }
    $t->setTime(9, rand(0, 55)); // разлёт 9:00-9:55, чтобы письма не летели в одну минуту

    // Оценка произошла позже срока — отправляем в ближайшее рабочее окно 9:00-18:00.
    if ($now >= $t) {
        $t = (new DateTime($now->format('Y-m-d H:i:s')))->modify('+5 minutes');
        $hour = (int)$t->format('G');
        if ($hour >= 18)    $t->modify('+1 day')->setTime(9, rand(0, 55));
        elseif ($hour < 9)  $t->setTime(9, rand(0, 55));
        while ((int)$t->format('w') === 0) $t->modify('+1 day')->setTime(9, rand(0, 55));
    }
    return $t;
}

/** HTML-письмо с прикреплённым дипломом (кратко, брендово). */
function _diploma_email_html(array $d): string {
    $comp = (string)($d['comp_name'] ?? 'конкурса');
    $name = trim((string)($d['full_name'] ?? ''));
    $num  = (string)($d['number'] ?? '');
    $res  = (string)($d['result'] ?? '');
    $isExtra = (string)($d['type'] ?? 'main') === 'extra';
    $base = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
    $downloadUrl = $base . '/diploma/' . rawurlencode($num) . '.pdf';
    $orderUrl    = $base . '/awards';
    $verifyUrl   = $base . '/verify/' . rawurlencode($num);
    $reviewUrl   = $base . '/reviews';
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';

    // Рекомендованный оригинал награды по аттестационному результату.
    $rU = mb_strtoupper($res);
    $award = mb_strpos($rU, 'ГРАН') !== false ? 'кубок Гран-при'
           : (mb_strpos($rU, 'ЛАУРЕАТ') !== false ? 'статуэтку лауреата'
           : (mb_strpos($rU, 'ДИПЛОМАНТ') !== false ? 'медаль дипломанта' : 'оригинал диплома'));
    $titleLine = $isExtra ? 'Дополнительный диплом (спецноминация)' : 'Диплом конкурса «' . h($comp) . '»';
    $awardedLbl = $isExtra ? 'Специальная номинация' : 'Ваше звание';

    $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:24px;color:' . MM_NAVY . ';font-weight:700;line-height:1.25;">' . $titleLine . '</h1>'
        . '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . '<p style="margin:0 0 18px;">По итогам аттестации компетентного жюри ' . ($isExtra ? 'Вам присуждена специальная номинация:' : 'Вам присуждено звание:') . '</p>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-radius:16px;overflow:hidden;"><tr>'
        . '<td style="background:' . MM_NAVY . ';background:linear-gradient(135deg,' . MM_NAVY . ' 0%,' . MM_NAVY2 . ' 100%);padding:24px;text-align:center;">'
        . '<div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.72);margin-bottom:8px;">' . $awardedLbl . '</div>'
        . '<div style="font-family:Georgia,serif;font-size:26px;font-weight:700;color:' . MM_GOLD . ';letter-spacing:.03em;">' . h($res) . '</div></td></tr></table>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:' . MM_CARD . ';border:1px solid ' . MM_LINE . ';border-radius:12px;"><tr>'
        . '<td style="padding:14px 20px;font-size:14px;color:#33406B;"><span style="color:' . MM_MUTED . ';">Номер диплома:</span> <b style="color:' . MM_NAVY . ';">' . h($num) . '</b>'
        . ' · проверка подлинности по QR и на сайте.</td></tr></table>'
        . '<p style="margin:0 0 6px;font-weight:600;color:' . MM_NAVY . ';">Оригиналы наград — Почтой России:</p>'
        . '<p style="margin:0 0 14px;font-size:14px;color:' . MM_INK . ';line-height:1.6;">По Вашему результату доступны к заказу: <b>' . $award . '</b>, а также благодарность педагогу за подготовку. '
        . 'Оригиналы — на плотной дизайнерской бумаге, с голографическими логотипами, живыми подписями и печатями.</p>';

    return mm_email_tx($inner, [
        'preheader' => 'Ваш диплом готов' . ($res !== '' ? ' — «' . $res . '»' : '') . '. Скачайте и закажите наградной материал.',
        'hero'      => mm_cta_primary($orderUrl, 'Заказать наградной материал', 'По результату: ' . $award),
        'actions'   => [
            ['Скачать диплом (PDF)', $downloadUrl],
            ['Проверить подлинность', $verifyUrl],
            ['Оставить отзыв', $reviewUrl],
        ],
        'thanks'    => true,
    ]);
}

/** Отправка оригинала (без подписи/печати) + заявки + адреса в бот заказа (t.me/zakaznagrad) через нашего бота. */
function _send_original_to_orders_bot(array $a, array $comp): void {
    $ordersChat = (string) cfgv('tg_orders_chat', '');
    if ($ordersChat === '') return; // не сконфигурировано - тихо пропускаем
    if (!function_exists('pdf_diploma')) return;
    // Генерируем «чистую» версию (без подписи и печати)
    $clean = null;
    try { $clean = pdf_diploma($a, 'main_clean'); } catch (\Throwable $e) { $clean = null; }
    $line = "Заказ оригинала — Заявка № {$a['number']}\n"
          . "Конкурс: {$comp['name']}\n"
          . "Участник: {$a['full_name']}\n"
          . "Результат: {$a['result']}\n"
          . "Адрес: " . ($a['address'] ?: '(не указан — уточнить)') . "\n"
          . "E-mail: {$a['email']}\nТелефон: {$a['phone']}";
    if ($clean && is_file($clean) && function_exists('tg_send_photo')) {
        tg_send_photo($ordersChat, $clean, ['caption' => $line]);
    } elseif (function_exists('tg_send')) {
        tg_send($ordersChat, $line);
    }
}
