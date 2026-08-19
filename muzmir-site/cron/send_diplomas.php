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
if (!defined('BASE_PATH')) define('BASE_PATH', dirname(__DIR__));   // безопасно и в библиотечном режиме (из кабинета)
if (empty($GLOBALS['CFG'])) { $CFG = require BASE_PATH . '/config.php'; $GLOBALS['CFG'] = $CFG; }
require_once BASE_PATH . '/cron/_lib.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/telegram.php';
require_once BASE_PATH . '/core/pdf_diploma.php';
require_once BASE_PATH . '/core/diploma_render.php';
require_once BASE_PATH . '/core/app_status.php';

db();

// Библиотечный режим: только функции (_diploma_email_html и пр.), крон не запускается.
// ЭТА ПРОВЕРКА ОБЯЗАНА СТОЯТЬ ДО ЛОКА. Файл подключают как библиотеку личный кабинет
// (кнопка «выслать диплом ещё раз») и админка — если брать лок раньше, то в минуту
// работы крона кнопка просто выходила по exit(0) посреди страницы: белый экран.
if (defined('MM_EMAIL_TEST_LIB')) return;

// ЗАЩИТА ОТ НАЛОЖЕНИЯ — только для запуска из крона.
// Крон идёт раз в минуту, а письмо с дипломами несёт 2-3 PDF (до нескольких мегабайт):
// SMTP-загрузка легко переваливает за минуту, и следующий запуск успевал подхватить
// те же дипломы — участник получал одно и то же письмо по два-три раза. Плюс раздел
// планирования без лока слал рендер-серверу дубли заданий и падал на UNIQUE.
// TTL 15 минут: если процесс убьют, лок протухнет и отправка продолжится сама.
if (PHP_SAPI !== 'cli') return;                  // из веба — только функции, без рассылки
if (!cron_lock('send_diplomas', 900)) exit(0);
register_shutdown_function(static function () { cron_unlock('send_diplomas'); });

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
        // Берём РЕАЛЬНЫЙ диплом с готовым PDF — чтобы проверить файл-вложение + фото в теле.
        $real = one("SELECT d.*, a.full_name, c.name AS comp_name
                     FROM diplomas d JOIN applications a ON a.id=d.application_id
                     JOIN competitions c ON c.id=a.competition_id
                     WHERE d.pdf_path <> '' ORDER BY d.id DESC LIMIT 1");
        $opt = ['account' => $nagradi, 'from_name' => 'Наградный отдел «Музыкальный Мир»'];
        if ($real) {
            [$pdfAbs, $imgUrl] = _diploma_files((array)$real);
            $real['_img_url'] = $imgUrl;
            $html = _diploma_email_html((array)$real);
            if ($pdfAbs) $opt['attach'] = $pdfAbs;
            $subj = 'Ваш диплом конкурса «' . ($real['comp_name'] ?? '') . '» - № ' . ($real['number'] ?? '');
            echo "используем реальный диплом id=" . $real['id'] . " pdf=" . ($pdfAbs?'да':'нет') . " png=" . ($imgUrl?'да':'нет') . "\n";
        } else {
            $subj = 'Ваш диплом — «' . $sample['comp_name'] . '» (' . $sample['result'] . ')';
        }
        $ok = mail_send($to, $subj, $html, $opt);
        echo "ОТПРАВКА на $to: " . ($ok ? 'OK' : 'FAIL') . "\n";
    }
    exit(0);
}

// 1) Убеждаемся что нужные колонки есть (мягкие миграции).
try { db()->exec("ALTER TABLE diplomas ADD COLUMN scheduled_at TEXT"); } catch (\Throwable $e) {}
try { db()->exec("ALTER TABLE applications ADD COLUMN send_at_override TEXT"); } catch (\Throwable $e) {}
try { db()->exec("ALTER TABLE competitions ADD COLUMN results_published_at TEXT"); } catch (\Throwable $e) {}
try { db()->exec("ALTER TABLE diplomas ADD COLUMN send_tries INTEGER DEFAULT 0"); } catch (\Throwable $e) {}
try { db()->exec("ALTER TABLE applications ADD COLUMN result_send_at TEXT DEFAULT ''"); } catch (\Throwable $e) {}
try { db()->exec("ALTER TABLE applications ADD COLUMN result_sent_at TEXT DEFAULT ''"); } catch (\Throwable $e) {}

date_default_timezone_set('Europe/Moscow');
$now = new DateTime('now');

// 1а) РЕЗУЛЬТАТЫ по расписанию: у коротких конкурсов результат уходит по result_send_at
//     (моментально — уже отправлен в админке; дата/авто — отправляет этот cron), ОТДЕЛЬНО
//     и РАНЬШЕ наградных дипломов. Наградной материал уходит позже (через N раб.дней от подачи).
if (function_exists('all')) {
    $dueRes = all("SELECT a.id, a.user_id FROM applications a
                     JOIN competitions c ON c.id = a.competition_id
                    WHERE a.result IS NOT NULL AND a.result <> '' AND a.status <> 'rejected'
                      AND (c.results_mode IS NULL OR c.results_mode <> 'list')
                      AND a.result_send_at <> '' AND a.result_send_at <= ?
                      AND (a.result_sent_at IS NULL OR a.result_sent_at = '')
                    ORDER BY a.result_send_at ASC LIMIT 30", [$now->format('Y-m-d H:i:s')]);
    if ($dueRes) {
        if (is_file(BASE_PATH.'/core/result_mail.php'))   require_once BASE_PATH.'/core/result_mail.php';
        if (is_file(BASE_PATH.'/core/notifications.php')) require_once BASE_PATH.'/core/notifications.php';
        foreach ($dueRes as $r) {
            $ok = false;
            if (function_exists('result_mail_send')) { try { $ok = (bool) result_mail_send((int)$r['id']); } catch (\Throwable $e) {} }
            if ($ok) {
                q("UPDATE applications SET result_sent_at=? WHERE id=?", [$now->format('Y-m-d H:i:s'), (int)$r['id']]);
                // Результат дошёл до участника → статус «Оценена» (до этого — «На оценке»).
                if (function_exists('app_status_sync')) app_status_sync((int)$r['id']);
                if (!empty($r['user_id']) && function_exists('notify_user')) {
                    notify_user((int)$r['user_id'], 'Ваш результат готов',
                        'Жюри подвело итоги конкурса. Наградные дипломы придут на почту из заявки в ближайшие рабочие дни.',
                        '/cabinet', 'award');
                }
            }
        }
    }
}

// 2) Планируем отправку у новоаттестованных заявок (результат проставлен, но диплом ещё не спланирован).
//    Отклонённые заявки не трогаем; повторное grade_result с изменённым итогом удаляет
//    неотправленный диплом — здесь он будет пересоздан с новым результатом и свежим PDF.
//
// ТОЛЬКО КОРОТКИЕ ПЛАТНЫЕ КОНКУРСЫ. Электронные основной и дополнительный дипломы
// входят в стоимость участия — их центр обязан выдать сам, поэтому здесь они и
// изготавливаются.
//
// Длинный конкурс (results_mode='list') и любой конкурс с бесплатным участием сюда
// НЕ ПОПАДАЮТ. У длинного свой порядок: жюри оценивает — итоги публикуются списком
// 28-го числа — выходит пост в сообществе — участникам уходит письмо со ссылкой на
// список. И только потом участник САМ заказывает наградные документы, любые:
// электронные или оригиналы. До оплаты заказа диплома не существует, создаёт его
// order_fulfil_digital() в core/orders.php.
//
// Раньше условия здесь не было: диплом бесплатного конкурса изготавливался сразу
// после оценки и вставал в очередь на 28-е число. Бесплатный конкурс раздавал бы
// платные документы сам, да ещё и раньше, чем участник увидит результат.
//
$fresh = all("SELECT a.*, c.results_mode, c.results_date, c.is_paid AS comp_is_paid
              FROM applications a
              JOIN competitions c ON c.id = a.competition_id
              WHERE a.result IS NOT NULL AND a.result <> ''
                AND a.status <> 'rejected'
                AND COALESCE(c.results_mode,'email') <> 'list'
                AND COALESCE(c.is_paid,0) = 1
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
    // 2в. МАКЕТ ДЛЯ ТИПОГРАФИИ ЗДЕСЬ НЕ ОТПРАВЛЯЕМ.
    //
    // Раньше чистый бланк улетал в чат заказов сразу после оценки — по каждой
    // заявке подряд. Но оригинал участник заказывает ПОСЛЕ того, как получил
    // диплом, и на момент оценки заказа ещё не существует: в чат уходили макеты,
    // которые никто не собирался печатать, а настоящий оплаченный заказ тонул
    // среди них.
    //
    // Печатный пакет отправляет order_dispatch_production() в момент ОПЛАТЫ
    // заказа (core/payments.php) — с составом, адресом получателя и теми же
    // чистыми дипломами. Это единственное правильное место.
}

// 2г. Педагоги, приведшие класс. Дипломы учеников готовы — значит пора поблагодарить
//     того, кто их подготовил. Документ уходит сам и бесплатно: преподаватель и есть
//     тот канал, по которому в конкурс приходят сразу десять участников.
if (is_file(BASE_PATH . '/core/curator_awards.php')) {
    require_once BASE_PATH . '/core/curator_awards.php';
    $compIds = [];
    foreach ($fresh as $a) $compIds[(int) $a['competition_id']] = true;
    foreach (array_keys($compIds) as $cid) {
        try {
            [$g, $s] = curator_process_competition($cid);
            if ($g > 0) cron_log('send_diplomas', "благодарности педагогам конкурса #$cid: выдано $g, отправлено $s");
        } catch (\Throwable $e) {
            cron_log('send_diplomas', 'благодарности педагогам #' . $cid . ': ' . $e->getMessage());
        }
    }
}

// 3) Шлём то, что подошло по расписанию (окно ±60 сек), интервал 1 мин между заявками.
$dueList = all("SELECT d.*, a.email, a.full_name, a.number AS app_number, c.name AS comp_name
                FROM diplomas d
                JOIN applications a ON a.id = d.application_id
                JOIN competitions c ON c.id = a.competition_id
                WHERE d.sent_at IS NULL
                  AND d.scheduled_at IS NOT NULL
                  AND d.scheduled_at <= ?
                  AND COALESCE(d.send_tries,0) < 5
                  AND a.status <> 'rejected'
                  -- Длинный конкурс (results_mode='list'): дипломы не рассылаем,
                  -- пока итоги не опубликованы админом (результаты — только пакетно).
                  AND (c.results_mode <> 'list' OR c.results_published_at IS NOT NULL)
                ORDER BY d.scheduled_at ASC
                LIMIT 30", [$now->format('Y-m-d H:i:s')]);

// ГРУППИРОВКА: все дипломы ОДНОЙ заявки (осн + доп + именной + благодарность) — в ОДНОМ письме.
$groups = [];
foreach ($dueList as $d) { $groups[(int)$d['application_id']][] = $d; }

$sentThisTick = 0;
foreach ($groups as $appId => $items) {
    if ($sentThisTick >= 1) break; // одна заявка (одно письмо) в минуту
    $first = $items[0];
    $to = (string)$first['email']; if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) continue;

    // Собираем вложения (PDF) + фото каждого диплома для тела письма.
    $attachments = []; $blocks = [];
    foreach ($items as $it) {
        [$pdfAbs, $imgUrl] = _diploma_files((array)$it);
        if ($pdfAbs) $attachments[] = $pdfAbs;
        $blocks[] = ['type' => (string)($it['type'] ?? 'main'), 'result' => (string)($it['result'] ?? ''), 'number' => (string)($it['number'] ?? ''), 'img' => $imgUrl];
    }
    // НЕ ОТПРАВЛЯЕМ ПУСТОЙ КОНВЕРТ. Если ни одного PDF собрать не удалось (бастион
    // рендера недоступен, ключ доступа не подхватился, файл не создан), то письмо
    // «Ваши наградные документы… файлы прикреплены» ушло бы вообще без вложений и
    // диплом навсегда пометился бы отправленным — участник остался бы ни с чем.
    // Считаем это неудачной попыткой: увеличиваем счётчик и ждём следующего тика.
    if (!$attachments) {
        foreach ($items as $it) {
            update('diplomas', ['send_tries' => (int) ($it['send_tries'] ?? 0) + 1], 'id=:id', ['id' => (int) $it['id']]);
        }
        echo date('c') . " send_diplomas: заявка #$appId — ни одного PDF, отправку отложил\n";
        continue;
    }

    $cnt = count($items);
    // Правило владельца: наградную бумагу называем наградным материалом, а не
    // документом. «Документ» участник читает как справку из канцелярии.
    $subject = ($cnt > 1 ? 'Ваши наградные материалы конкурса «' : 'Ваш наградной материал конкурса «')
             . $first['comp_name'] . '» - заявка № ' . $first['app_number'];
    $html = _diploma_group_html($blocks, (string)$first['full_name'], (string)$first['comp_name']);

    // ОДИН ЯЩИК — ОДНА ТОЧКА ОТКАЗА, И ЭТО УЖЕ СТОИЛО ЛЮДЯМ ДИПЛОМОВ.
    //
    // Письмо уходило строго с nagradi.on@ через mail_send, без перебора. С 17
    // августа Яндекс закрыл этому ящику отправку наружу (554 на любое письмо), и
    // все наградные письма молча падали: пять попыток на каждый диплом, потом
    // send_tries>=5 — и документ выпадал из выборки насовсем, без единой записи в
    // очереди и без строки в «Отправках». Наградной ящик остаётся первым, но
    // теперь за ним стоит весь пул: не принял один — уйдёт со следующего.
    $opt = ['pool' => 'awards'];
    $nagradi = function_exists('mail_senders') ? (mail_senders()['nagradi'] ?? []) : [];
    if ($nagradi) { $opt['account'] = $nagradi; $opt['from_name'] = 'Наградный отдел «Музыкальный Мир»'; }
    if ($attachments) $opt['attachments'] = $attachments;   // все PDF во вложении
    $ok = false;
    if (function_exists('mail_send_failover')) {
        try { $ok = (bool) mail_send_failover($to, $subject, $html, $opt); } catch (\Throwable $e) { $ok = false; }
    } elseif (function_exists('mail_send')) {
        $ok = (bool) mail_send($to, $subject, $html, $opt);
    }
    if (!$ok) {
        $why = function_exists('mail_last_error') ? mail_last_error() : '';
        fwrite(STDERR, 'send_diplomas: заявка #' . $appId . ' не ушла (' . $to . '): '
                     . mb_substr($why, 0, 160) . "\n");
    }
    if ($ok) {
        foreach ($items as $it) update('diplomas', ['sent_at' => $now->format('Y-m-d H:i:s')], 'id=:id', ['id' => (int)$it['id']]);
        // Статус пересчитывается по фактам (core/app_status.php), а не проставляется
        // вручную: жёсткое 'done' раньше не знали ни кабинет, ни фильтры админки,
        // из-за чего заявка «пропадала» из списков и статистики.
        if (function_exists('app_status_sync')) app_status_sync((int)$appId);
        else q("UPDATE applications SET status='made' WHERE id=?", [(int)$appId]);
        $sentThisTick++;
    } else {
        // ВАЖНО: время отправки, заданное оргкомитетом, НЕ трогаем при сбое — иначе оно
        // «перескакивает» и письмо не уходит в назначенный момент. Просто считаем попытки:
        // задание остаётся «наступившим» (scheduled_at <= now) и повторяется на следующем тике,
        // пока не уйдёт. После 5 неудач выпадает из выборки (send_tries>=5), но заданное время
        // остаётся видимым в «Отправках» вместе со статусом «не удалось отправить».
        foreach ($items as $it) {
            $tries = (int) ($it['send_tries'] ?? 0) + 1;
            update('diplomas', ['send_tries' => $tries], 'id=:id', ['id' => (int)$it['id']]);
            if ($tries >= 5) fwrite(STDERR, "send_diplomas: диплом #{$it['id']} не ушёл после $tries попыток (адрес $to) — время оставлено как задано\n");
        }
    }
}

fwrite(STDERR, "send_diplomas: planned=" . count($fresh) . " sent_now=$sentThisTick pending=" . max(0, count($dueList) - $sentThisTick) . "\n");

// ================= helpers =================

/**
 * Планирование даты отправки диплома. Только для коротких платных конкурсов:
 * длинные и бесплатные отсечены запросом $fresh и сюда не доходят.
 *
 * ДАТА ПОДАЧИ заявки (created_at) + N рабочих дней (вс — нерабочий), рабочее
 * окно 9:00-18:00 МСК; если оценка произошла ПОЗЖЕ этого срока — ближайшее
 * рабочее окно.
 */
function _plan_send_at(DateTimeInterface $now, array $a, array $comp): DateTime {
    // Наградные дипломы НЕ следуют за ручным сроком результата (send_at_override) —
    // они всегда уходят через N рабочих дней от ДАТЫ ПОДАЧИ заявки.

    // Короткие платные: наградные дипломы — через N рабочих дней ПОСЛЕ РЕЗУЛЬТАТА
    //    (result_send_at), N=5 (ВИП-клуб — 3), вс — нерабочий, только рабочее окно
    //    9:00-18:00 МСК. Если срок уже прошёл — ближайшее рабочее окно (никогда ночью).
    if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
    require_once BASE_PATH . '/core/send_timing.php';
    // Точка отсчёта — плановое время результата; если его нет — момент аттестации, иначе подача.
    $base = trim((string)($a['result_send_at'] ?? '')) !== '' ? (string)$a['result_send_at']
          : (trim((string)($a['graded_at'] ?? '')) !== '' ? (string)$a['graded_at'] : (string)($a['created_at'] ?? 'now'));
    $wDays = 5;
    if (!empty($a['user_id']) && function_exists('club_is_active') && club_is_active((int)$a['user_id'])) $wDays = 3;
    $planned = working_days_add($base, $wDays);                                  // результат + N раб.дней, 09:0x
    $soonest = next_working_slot(new DateTime($now->format('Y-m-d H:i:s')));     // ближайшее рабочее окно
    return $planned > $soonest ? $planned : $soonest;
}

/** HTML-письмо с прикреплённым дипломом (кратко, брендово). */
function _diploma_email_html(array $d): string {
    $comp = (string)($d['comp_name'] ?? 'конкурса');
    $name = trim((string)($d['full_name'] ?? ''));
    $num  = (string)($d['number'] ?? '');
    $res  = (string)($d['result'] ?? '');
    $isExtra = (string)($d['type'] ?? 'main') === 'extra';
    $base = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
    // Ссылка ПОДПИСАНА: маршрут диплома закрыт от перебора чужих номеров, а
    // участник должен открывать свой документ прямо из письма, без входа в кабинет.
    if (!function_exists('diploma_link')) require_once BASE_PATH . '/core/paylink.php';
    $downloadUrl = diploma_link($num);
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

    // Фото диплома в теле письма (как в ручных письмах центра) + файл во вложении.
    $imgUrl = (string)($d['_img_url'] ?? '');
    $imgBlock = $imgUrl !== ''
        ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;"><tr><td align="center">'
          . '<img src="' . h($imgUrl) . '" alt="Диплом" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;border:1px solid ' . MM_LINE . ';box-shadow:0 8px 26px rgba(23,48,122,.18);">'
          . '<div style="margin-top:8px;font-size:12px;color:' . MM_MUTED . ';">Официальный диплом · PDF-файл прикреплён к письму</div>'
          . '</td></tr></table>'
        : '';

    $inner = $imgBlock
        . '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:24px;color:' . MM_NAVY . ';font-weight:700;line-height:1.25;">' . $titleLine . '</h1>'
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
            ['Скачать диплом ещё раз', $downloadUrl],
            ['Проверить подлинность', $verifyUrl],
            ['Оставить отзыв', $reviewUrl],
        ],
        'thanks'    => true,
    ]);
}

/**
 * Групповое письмо: ВСЕ дипломы одной заявки (осн/доп/именной/благодарность) в одном
 * письме — каждый фотографией в теле + все PDF во вложении. Богатый шаблон + кнопки.
 * $blocks: [[type,result,number,img], ...].
 */
function _diploma_group_html(array $blocks, string $name, string $comp): string {
    $base = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
    $hello = trim($name) !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $labels = ['main' => 'Основной диплом', 'extra' => 'Дополнительный диплом (спецноминация)', 'named' => 'Именной диплом', 'thanks' => 'Благодарность'];

    // Рекомендованный оригинал по результату (по основному диплому).
    $mainRes = '';
    foreach ($blocks as $b) { if (($b['type'] ?? '') === 'main') { $mainRes = (string)$b['result']; break; } }
    if ($mainRes === '' && $blocks) $mainRes = (string)$blocks[0]['result'];
    $rU = mb_strtoupper($mainRes);
    $award = mb_strpos($rU, 'ГРАН') !== false ? 'кубок Гран-при'
           : (mb_strpos($rU, 'ЛАУРЕАТ') !== false ? 'статуэтку лауреата'
           : (mb_strpos($rU, 'ДИПЛОМАНТ') !== false ? 'медаль дипломанта' : 'оригинал диплома'));

    $cards = '';
    foreach ($blocks as $b) {
        $lbl = $labels[$b['type'] ?? 'main'] ?? 'Диплом';
        $meta = ($b['type'] ?? '') === 'thanks' ? 'Педагогу за подготовку участника'
              : (($b['type'] ?? '') === 'extra' ? ('Спецноминация: ' . h((string)$b['result'])) : ('Звание: ' . h((string)$b['result'])));
        $img = !empty($b['img'])
            ? '<img src="' . h((string)$b['img']) . '" alt="' . h($lbl) . '" width="520" style="display:block;width:100%;max-width:520px;height:auto;border-radius:12px;border:1px solid ' . MM_LINE . ';box-shadow:0 6px 20px rgba(23,48,122,.16);">'
            : '';
        $cards .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">'
            . '<tr><td style="padding:0 0 8px;"><div style="font-family:Georgia,serif;font-weight:700;color:' . MM_NAVY . ';font-size:17px;">' . h($lbl) . '</div>'
            . '<div style="font-size:13px;color:' . MM_MUTED . ';">' . $meta . ' · № ' . h((string)$b['number']) . ' · QR проверки подлинности · PDF во вложении</div></td></tr>'
            . '<tr><td align="center">' . $img . '</td></tr></table>';
    }

    $inner = '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:' . MM_NAVY . ';font-weight:700;line-height:1.25;">Ваши наградные материалы</h1>'
        . '<p style="margin:0 0 12px;">' . $hello . '</p>'
        . '<p style="margin:0 0 20px;">По итогам аттестации компетентного жюри конкурса «' . h($comp) . '» подготовлены Ваши наградные материалы. Каждый — с номером и QR-кодом проверки подлинности; официальные PDF-файлы прикреплены к письму.</p>'
        . $cards
        . '<p style="margin:6px 0 6px;font-weight:600;color:' . MM_NAVY . ';">Оригиналы наград — Почтой России:</p>'
        . '<p style="margin:0 0 8px;font-size:14px;color:' . MM_INK . ';line-height:1.6;">По Вашему результату доступны к заказу: <b>' . $award . '</b>, оригинал диплома на дизайнерской бумаге и благодарность педагогу — с голографическими логотипами, живыми подписями и печатями.</p>';

    return mm_email_tx($inner, [
        'preheader' => 'Ваши наградные материалы конкурса «' . $comp . '» готовы. Файлы во вложении.',
        'hero'      => mm_cta_primary($base . '/awards', 'Заказать наградной материал', 'По результату: ' . $award),
        'actions'   => [['Проверить подлинность', $base . '/verify'], ['Личный кабинет', $base . '/cabinet'], ['Оставить отзыв', $base . '/reviews']],
        'thanks'    => true,
    ]);
}

/**
 * Возвращает [абсолютный путь PDF диплома для вложения, HTTPS-URL PNG-превью для тела].
 * PNG-превью генерим из PDF через pdftoppm (кэшируем в public/diplomas/preview_<num>.png).
 */
function _diploma_files(array $d): array {
    $base = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
    $stored = trim((string)($d['pdf_path'] ?? ''));
    $pdfAbs = '';
    if ($stored !== '' && !str_starts_with($stored, 'http')) {
        $pdfAbs = (str_starts_with($stored, '/var')) ? $stored
                : BASE_PATH . '/public/' . ltrim($stored, '/');
        if (!is_file($pdfAbs)) $pdfAbs = '';
    }
    $imgUrl = '';
    if ($pdfAbs !== '') {
        $num    = (string)($d['number'] ?? '');
        $slug   = trim(strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $num)), '-') ?: substr(md5($pdfAbs), 0, 8);
        $dir    = BASE_PATH . '/public/diplomas';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $prefix = $dir . '/preview_' . $slug;
        $png    = $prefix . '-1.png';
        if (!is_file($png)) {
            @exec('pdftoppm -png -r 110 -f 1 -l 1 ' . escapeshellarg($pdfAbs) . ' ' . escapeshellarg($prefix) . ' 2>&1');
        }
        foreach ([$prefix . '-1.png', $prefix . '.png'] as $cand) {
            if (is_file($cand)) { $imgUrl = $base . '/diplomas/' . basename($cand); break; }
        }
    }
    return [$pdfAbs, $imgUrl];
}

/** Отправка оригинала (без подписи/печати) + заявки + адреса в бот заказа (t.me/zakaznagrad) через нашего бота. */
function _send_original_to_orders_bot(array $a, array $comp): void {
    $ordersChat = (string) cfgv('tg_orders_chat', '');
    if ($ordersChat === '') return; // не сконфигурировано - тихо пропускаем

    // ПЕЧАТНЫЙ МАКЕТ НУЖЕН ТОЛЬКО ТАМ, ГДЕ ОРИГИНАЛ КУПЛЕН.
    // Раньше бланк улетал в чат заказов по КАЖДОЙ оценённой заявке, независимо
    // от того, заказывал участник печатный оригинал или нет. Чат забивался
    // макетами, которые никто не будет печатать, и настоящий оплаченный заказ
    // терялся в этом потоке. Теперь макет уходит только по оплаченному заказу
    // с оригиналом.
    $appId = (int) ($a['id'] ?? 0);
    if ($appId <= 0) return;
    if (!function_exists('order_has_originals')) require_once BASE_PATH . '/core/orders.php';

    $paid = false;
    try {
        // Оплаченным считаем заказ, который прошёл кассу: 'new' сюда не входит —
        // это корзина, за неё ещё не заплатили.
        foreach (all("SELECT * FROM awards_orders
                       WHERE application_id = ? AND status IN ('paid','made','shipped','delivered')",
                     [$appId]) as $o) {
            if (order_has_originals((array) $o)) { $paid = true; break; }
        }
    } catch (\Throwable $e) { $paid = false; }

    if (!$paid) {
        cron_log('send_diplomas', "заявка {$a['number']}: оплаченного заказа оригинала нет, макет в чат заказов не отправляем");
        return;
    }
    // «ЧИСТАЯ» ВЕРСИЯ — ЧЕРЕЗ БОЕВОЙ ШАБЛОН, А НЕ ЧЕРЕЗ ТИП 'main_clean'.
    // Такого типа генератор не знает: он считал 'main_clean' названием спец-награды
    // и печатал на бланке крупным золотом «MAIN_CLEAN», причём с подписью, печатью и
    // номером вне реестра. Именно этот файл уходил в типографию как образец для
    // оригинала. Режим clean поддерживает diploma_pdf_html — им и пользуемся.
    $clean = null;
    try {
        if (function_exists('diploma_pdf_html')) $clean = diploma_pdf_html($a, ['clean' => true]);
    } catch (\Throwable $e) { $clean = null; }
    if (!$clean && function_exists('pdf_diploma')) {
        // Фолбэк — обычный основной бланк. Он с подписью, но хотя бы без надписи
        // «MAIN_CLEAN» и с правильным номером.
        try { $clean = pdf_diploma($a, 'main'); } catch (\Throwable $e) { $clean = null; }
    }
    $line = "Заказ оригинала — Заявка № {$a['number']}\n"
          . "Конкурс: {$comp['name']}\n"
          . "Участник: {$a['full_name']}\n"
          . "Результат: {$a['result']}\n"
          . "Адрес: " . ($a['address'] ?: '(не указан — уточнить)') . "\n"
          . "E-mail: {$a['email']}\nТелефон: {$a['phone']}";
    // Отправляем ДОКУМЕНТОМ, а не фото: Telegram сжимает фото и режет разрешение,
    // а типографии нужен исходный PDF, с которого печатают оригинал.
    if ($clean && is_file($clean) && function_exists('tg_send_document')) {
        tg_send_document($ordersChat, $clean, ['caption' => $line]);
    } elseif ($clean && is_file($clean) && function_exists('tg_send_photo')) {
        tg_send_photo($ordersChat, $clean, ['caption' => $line]);
    } elseif (function_exists('tg_send')) {
        tg_send($ordersChat, $line);
    }
}
