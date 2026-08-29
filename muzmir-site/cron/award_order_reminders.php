<?php
/**
 * Цепочка напоминаний о заказе наградной продукции по итогам конкурса.
 *
 * Кому: заявки со статусом graded и непустым результатом. Молчим ровно в одном
 * случае — когда человек уже взял ВЕСЬ положенный ему комплект.
 *
 * ДВЕ ЦЕПОЧКИ, ПО ТОМУ, ПОКУПАЛ ЧЕЛОВЕК ИЛИ НЕТ.
 *   • Не заказывал ничего — письма через 3, 15, 30 и 55 дней после того, как он
 *     узнал результат.
 *   • Уже что-то оплатил, но комплект неполный — два письма, через 5 и 20 дней
 *     ПОСЛЕ ОПЛАТЫ, и в них показывается только недостающее.
 *
 * Раньше второй цепочки не было вовсе: первый же оплаченный заказ выключал
 * напоминания навсегда. Из 27 покупателей 19 остались без трофея по своему
 * званию, семь коллективов — без именных дипломов на детей, и предложить им это
 * было некому. Полный комплект считается по тому, что человеку действительно
 * положено: трофей по званию, диплом на бланке, именные (только коллективу),
 * благодарность (только если в заявке есть педагог).
 *
 * Заказ наград доступен 60 дней после результата — после 60 дней не шлём ничего,
 * обе цепочки живут внутри этого окна.
 *
 * Идемпотентность: таблица reminder_log (app_id, kind, sent_at) + уникальный
 * индекс на пару app_id+kind, kind = award_order_<дней> или award_addon_<дней>.
 * При догоняющем запуске отправляется только самый поздний подходящий шаг.
 *
 * Письмо — фирменный лейаут core/result_mail.php (rm_mail_layout, синий
 * #17307A + золото #C79322), кладётся в mail_queue — реальную отправку делает
 * cron/process_newsletter_queue.php. Плюс in-app уведомление участнику
 * (core/notifications.php, notify_user).
 *
 * Строка crontab (см. scripts/crontab.txt). Час ОБЯЗАН лежать внутри рабочего
 * окна владельца (пн-сб 09:00-19:00 МСК): задание само проверяет окно и вне его
 * не делает ничего. На 08:00 оно молча выходило на первой строке, а окно заказа
 * наград всего 60 дней — пропущенное напоминание не отыгрывается. Часовой пояс
 * крона задан в самом расписании (CRON_TZ=Europe/Moscow), пересчитывать под
 * системную зону не нужно:
 *   0 11 * * 1-6 php /path/to/muzmir-site/cron/award_order_reminders.php >> data/logs/cron.log 2>&1
 *
 * Запуск вручную: php cron/award_order_reminders.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';

// РАБОЧЕЕ ОКНО ВЛАДЕЛЬЦА: наружу только пн-сб 09:00-19:00 МСК.
// Расписание крона само по себе не защищает: час можно поменять руками, и письмо
// от имени центра уйдёт человеку в нерабочее время. Проверяем окно в самом
// задании; сама проверка стоит ниже, после подключения cron/_lib.php.
require_once BASE_PATH . '/core/outreach_window.php';
// Фирменные кирпичики письма (rm_mail_layout/rm_mail_btn/rm_award_hint)
// + core/notifications.php подключается изнутри result_mail.php.
require_once BASE_PATH . '/core/result_mail.php';
require_once BASE_PATH . '/core/award_offer.php';
require_once BASE_PATH . '/core/auth_link.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'award_order_reminders';
/** Дни после результата, в которые шлём напоминания (по возрастанию). */
const AWARD_REMINDER_STEPS = [3, 15, 30, 55];

/* ШАГИ ДЛЯ ТЕХ, КТО УЖЕ ЧТО-ТО КУПИЛ.
 *
 * Считаются не от результата, а от дня оплаты: человек только что заплатил,
 * письмо «доберите остальное» на следующее утро выглядит навязчиво. Два письма
 * за всё окно — через 5 и через 20 дней, и оба только если комплект неполный. */
const AWARD_ADDON_STEPS = [5, 20];
/** Сколько дней после результата доступен заказ наград. */
const AWARD_ORDER_WINDOW_DAYS = 60;

/* В CLI нет api/v1/_boot.php с tbl_exists() — без неё notify_user() молчит. */
if (!function_exists('tbl_exists')) {
    function tbl_exists(string $t): bool {
        try {
            return (bool) one("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [$t]);
        } catch (\Throwable $e) { return false; }
    }
}

// Библиотечный режим: при включённом MM_EMAIL_TEST_LIB подключающий скрипт
// получает только функции (award_reminder_html и пр.), сам крон не запускается.
if (defined('MM_EMAIL_TEST_LIB')) return;

// Отказ по окну пишем в общий журнал кронов, а не только в stdout: вывод
// заданий уходит в /dev/null, и молчаливо пропавшее задание не заметить.
if (!in_array('--force', $argv, true) && !outreach_window_ok()) {
    cron_log(JOB, 'вне рабочего окна (' . outreach_window_reason() . '), письма не отправляются');
    echo "вне рабочего окна, письма не отправляются\n";
    exit(0);
}

if (!cron_lock(JOB, 3600 * 6)) {
    cron_log(JOB, 'предыдущий запуск ещё выполняется, выход');
    exit(0);
}

/** Уже слали этот шаг по заявке? (reminder_log) */
function award_reminder_sent(int $appId, string $kind): bool {
    try {
        return (bool) one("SELECT id FROM reminder_log WHERE app_id=? AND kind=?", [$appId, $kind]);
    } catch (\Throwable $e) { return false; }
}

/** Отметить шаг отправленным (уникальный индекс страхует от гонок — тихо). */
function award_reminder_mark(int $appId, string $kind): void {
    try {
        insert('reminder_log', ['app_id' => $appId, 'kind' => $kind, 'sent_at' => date('Y-m-d H:i:s')]);
    } catch (\Throwable $e) { /* уже отмечено */ }
}

/**
 * Момент проставления результата (unix ts): graded_at (пишет PHP по зоне сайта,
 * Europe/Moscow) или, для старых заявок без метки, created_at (SQL-дефолт
 * datetime('now','localtime') — UTC, см. соглашение в cron/_lib.php).
 */
function award_graded_ts(array $a): int {
    // Отсчёт идёт от того дня, когда участник УЗНАЛ результат, а не когда жюри
    // его выставило: у конкурса с публикацией списком между этими событиями
    // проходит неделя, и напоминание «осталось 55 дней» пришло бы раньше самих
    // итогов.
    foreach (['result_sent_at', 'results_published_at'] as $k) {
        $v = trim((string) ($a[$k] ?? ''));
        if ($v !== '') {
            $ts = strtotime($v);
            if ($ts !== false) return $ts;
        }
    }
    $g = trim((string) ($a['graded_at'] ?? ''));
    if ($g !== '') {
        $ts = strtotime($g);
        if ($ts !== false) return $ts;
    }
    $c = trim((string) ($a['created_at'] ?? ''));
    $ts = $c !== '' ? strtotime($c . ' UTC') : false;
    return $ts !== false ? $ts : time();
}

/** «1 день / 2 дня / 5 дней». */
function award_ru_days(int $n): string {
    $n10 = $n % 10; $n100 = $n % 100;
    if ($n10 === 1 && $n100 !== 11) return $n . ' день';
    if ($n10 >= 2 && $n10 <= 4 && ($n100 < 12 || $n100 > 14)) return $n . ' дня';
    return $n . ' дней';
}


/** «1 заявка / 2 заявки / 5 заявок». */
function award_ru_apps(int $n): string {
    $n10 = $n % 10; $n100 = $n % 100;
    if ($n10 === 1 && $n100 !== 11) return 'заявка';
    if ($n10 >= 2 && $n10 <= 4 && ($n100 < 12 || $n100 > 14)) return 'заявки';
    return 'заявок';
}

/** Высшее из званий адресата: по нему положен самый весомый трофей. */
function award_top_result(array $apps): string {
    $rank = static function (string $r): int {
        $r = mb_strtoupper($r);
        if (str_contains($r, 'ГРАН-ПРИ'))  return 3;
        if (str_contains($r, 'ЛАУРЕАТ'))   return 2;
        if (str_contains($r, 'ДИПЛОМАНТ')) return 1;
        return 0;
    };
    $best = '';
    foreach ($apps as $a) {
        $r = trim((string) ($a['result'] ?? ''));
        if ($best === '' || $rank($r) > $rank($best)) $best = $r;
    }
    return $best;
}

/**
 * ЧТО ЧЕЛОВЕК УЖЕ ОПЛАТИЛ ПО ЭТИМ ЗАЯВКАМ.
 *
 * Позиции сводим к четырём видам, которыми и торгует центр: 'trophy' (кубок,
 * статуэтка, медаль — что положено по званию), 'diploma' (основной или
 * дополнительный диплом), 'named' (именной), 'thanks' (благодарность педагогу).
 *
 * @param array $apps заявки одного адресата
 * @return string[] виды, которые уже куплены
 */
function award_owned_kinds(array $apps): array {
    $ids = [];
    foreach ($apps as $a) $ids[] = (int) $a['id'];
    if (!$ids) return [];
    $in = implode(',', $ids);
    $own = [];
    try {
        $rows = all("SELECT items FROM awards_orders
                      WHERE application_id IN ($in) AND status IN ('paid','made','shipped','delivered')");
    } catch (\Throwable $e) { return []; }
    foreach ($rows as $r) {
        foreach ((array) json_decode((string) $r['items'], true) as $it) {
            if (!is_array($it)) continue;
            $nm = mb_strtolower((string) ($it['item'] ?? ''));
            if ($nm === '') continue;
            if (str_contains($nm, 'кубок') || str_contains($nm, 'статуэт') || str_contains($nm, 'медал')) $own['trophy'] = true;
            elseif (str_contains($nm, 'именн'))      $own['named']  = true;
            elseif (str_contains($nm, 'благодар'))   $own['thanks'] = true;
            elseif (str_contains($nm, 'диплом'))     $own['diploma'] = true;
        }
    }
    return array_keys($own);
}

/** Когда человек в последний раз оплачивал заказ по этим заявкам (unix ts, 0 — не платил). */
function award_last_paid_ts(array $apps): int {
    $ids = [];
    foreach ($apps as $a) $ids[] = (int) $a['id'];
    if (!$ids) return 0;
    $in = implode(',', $ids);
    try {
        $v = (string) scalar("SELECT MAX(COALESCE(NULLIF(made_at,''), created_at)) FROM awards_orders
                               WHERE application_id IN ($in) AND status IN ('paid','made','shipped','delivered')");
    } catch (\Throwable $e) { return 0; }
    if (trim($v) === '') return 0;
    $ts = strtotime($v);
    return $ts !== false ? $ts : 0;
}

/**
 * ЧЕГО У ЧЕЛОВЕКА ЕЩЁ НЕТ ИЗ ПОЛОЖЕННОГО.
 *
 * Раньше цепочка останавливалась на первом же оплаченном заказе: купил
 * электронный диплом за 400 ₽ — и больше ни слова, хотя ни трофея по своему
 * званию, ни именных дипломов на детей у него нет. Из 27 покупателей 19 остались
 * без трофея, семь коллективов — без именных, и предложить им это было некому.
 *
 * Считаем по тому, что человеку действительно положено:
 *   • трофей — всем, у кого есть звание (вид зависит от звания);
 *   • диплом на бланке — всем;
 *   • именной — только коллективам (у солиста диплом и так именной);
 *   • благодарность — только если в заявке указан педагог.
 * Полный комплект — писем нет вовсе.
 *
 * @return string[] недостающие виды
 */
function award_missing_kinds(array $apps, array $owned): array {
    $need = [];
    if (award_top_result($apps) !== '') $need[] = 'trophy';
    $need[] = 'diploma';
    if (award_any_group($apps)) $need[] = 'named';
    foreach ($apps as $a) {
        if (trim((string) ($a['teacher'] ?? '')) !== '') { $need[] = 'thanks'; break; }
    }
    return array_values(array_diff($need, $owned));
}

/** Есть ли среди заявок коллективная — тогда предлагаем и именной диплом. */
function award_any_group(array $apps): bool {
    foreach ($apps as $a) if (trim((string) ($a['group_name'] ?? '')) !== '') return true;
    return false;
}

/** Перечень результатов адресата — когда заявок несколько. */
function award_reminder_list(array $apps): string {
    $rows = '';
    foreach ($apps as $a) {
        $ex = trim((string) ($a['extra_diploma'] ?? ''));
        $rows .= '<tr>'
            . '<td style="padding:9px 10px 9px 0;font-size:13px;color:' . RM_INK . ';border-top:1px solid ' . RM_LINE . ';vertical-align:top;">'
            . '<b>' . h((string) ($a['work_title'] ?? '—')) . '</b>'
            . '<div style="color:' . RM_MUTED . ';font-size:12px;margin-top:2px;">№' . h((string) $a['number']) . '</div></td>'
            . '<td style="padding:9px 0;font-size:13px;font-weight:700;color:' . RM_NAVY . ';border-top:1px solid ' . RM_LINE . ';text-align:right;white-space:nowrap;vertical-align:top;">'
            . h(trim((string) ($a['result'] ?? '')))
            . ($ex !== '' ? '<div style="font-weight:400;font-size:11.5px;color:' . RM_GOLD . ';margin-top:3px;">' . h($ex) . '</div>' : '')
            . '</td></tr>';
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
         . 'style="margin:0 0 20px;background:' . RM_CARD . ';border:1px solid ' . RM_LINE . ';border-radius:14px;">'
         . '<tr><td style="padding:16px 20px 18px;">'
         . '<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' . RM_MUTED . ';margin-bottom:6px;">Ваши результаты</div>'
         . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table>'
         . '</td></tr></table>';
}

/**
 * HTML письма-напоминания в фирменном лейауте (синий + золото).
 *
 * $apps — все заявки этого адресата, попавшие в письмо. При одной заявке письмо
 * выглядит как прежде; при нескольких вместо одного звания идёт их перечень,
 * потому что напоминание одно на человека, а результаты у него разные.
 */
function award_reminder_html(array $a, int $daysLeft, string $awardsUrl, array $apps = [], array $owned = []): string {
    $navy = RM_NAVY; $navy2 = RM_NAVY_2; $gold = RM_GOLD; $muted = RM_MUTED;
    $card = RM_CARD; $line = RM_LINE;

    $name   = trim((string) $a['full_name']);
    $hello  = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $result = trim((string) $a['result']);
    $comp   = (string) $a['comp_name'];
    $deadline = date('d.m.Y', award_graded_ts($a) + AWARD_ORDER_WINDOW_DAYS * 86400);
    if (!$apps) $apps = [$a];
    $many = count($apps) > 1;

    /* ТОМУ, КТО УЖЕ ПЛАТИЛ, НЕЛЬЗЯ ПИСАТЬ «НЕ ЗАБУДЬТЕ ЗАКАЗАТЬ».
     *
     * Он заказал — и письмо с таким заголовком читается как «ваш заказ потеряли».
     * Для него это разговор о том, что к полученному можно добавить: витрина ниже
     * уже показывает только недостающее (в ao_block уходит $owned). */
    $isAddon = $owned !== [];
    $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.25;font-weight:700;color:' . $navy . ';">'
        . ($isAddon ? 'К Вашей награде можно добавить' : 'Не забудьте заказать награды') . '</h1>'
        . '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . ($isAddon
            ? '<p style="margin:0 0 20px;">Спасибо за заказ — он в работе. По результату '
              . '<b style="color:' . $navy . ';">«' . h($result) . '»</b> конкурса «' . h($comp) . '» '
              . 'Вам положено ещё кое-что из наградного комплекта. Ниже — только то, чего у Вас пока нет.</p>'
            : '')
        . ($isAddon ? '' : ($many
            ? '<p style="margin:0 0 20px;">Не забудьте заказать награды по итогам конкурса «' . h($comp) . '». '
              . 'У Вас ' . count($apps) . ' ' . award_ru_apps(count($apps)) . ' с аттестационным результатом.</p>'
            : '<p style="margin:0 0 20px;">Не забудьте заказать награды по результату '
              . '<b style="color:' . $navy . ';">«' . h($result) . '»</b> конкурса «' . h($comp) . '». '
              . h(rm_award_hint($result)) . '</p>'))
        // Результат: одно звание крупно, несколько — перечнем.
        . ($many ? award_reminder_list($apps) :
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-radius:16px;overflow:hidden;">'
          . '<tr><td style="background:' . $navy . ';background:linear-gradient(135deg,' . $navy . ' 0%,' . $navy2 . ' 100%);padding:24px 26px;text-align:center;">'
          . '<div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:8px;">Ваш результат</div>'
          . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.25;font-weight:800;color:' . $gold . ';letter-spacing:.03em;">' . h($result) . '</div>'
          . '</td></tr></table>')
        // Срок действия заказа.
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        . 'style="margin:0 0 8px;background:' . $card . ';border:1px solid ' . $line . ';border-radius:14px;">'
        . '<tr><td style="padding:16px 22px;">'
        . '<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' . $muted . ';margin-bottom:6px;">Срок заказа</div>'
        . '<div style="font-size:14px;line-height:1.7;color:' . RM_INK . ';">Заказ наградной продукции доступен '
        . '<b style="color:' . $navy . ';">' . AWARD_ORDER_WINDOW_DAYS . ' дней</b> после публикации результата — '
        . 'осталось <b style="color:' . $navy . ';">' . h(award_ru_days($daysLeft)) . '</b>, до ' . h($deadline) . '.</div>'
        . '</td></tr></table>'
        // Награду покупают глазами: показываем настоящие снимки того, что придёт
        // по почте, и ровно то, что положено по этому званию.
        // Коллективу предлагается ещё и именной диплом на каждого участника:
        // диплом ансамбля один, а детей в нём двадцать.
        . ao_block((int) $a['competition_id'], award_top_result($apps), $awardsUrl, award_any_group($apps), $owned)
        . '<p style="margin:14px 0 0;font-size:13px;color:' . $muted . ';">Если наградная продукция Вам не нужна, просто оставьте это письмо без ответа.</p>';

    return mm_email_tx($inner, [
        'preheader' => $isAddon
            ? 'К заказанному можно добавить остальное — заказ открыт ещё ' . award_ru_days($daysLeft) . '.'
            : 'Заказ наград по результату «' . $result . '» доступен ещё ' . award_ru_days($daysLeft) . '.',
        'hero'      => mm_cta_primary($awardsUrl, $isAddon ? 'Дополнить заказ' : 'Заказать наградной материал',
                                      $result !== '' ? 'По результату: ' . $result : ''),
        // Кабинет открываем сразу: пароль участник часто не заводил вовсе, и
        // кнопка «Личный кабинет» упиралась в форму входа (core/auth_link.php).
        'actions'   => [['Личный кабинет', (function_exists('auth_link_url')
                            ? auth_link_url('/cabinet', (int) ($a['user_id'] ?? 0))
                            : url('/cabinet'))],
                        ['Оставить отзыв', url('/reviews')]],
    ]);
}

try {
    if (!function_exists('all') || !function_exists('scalar')) {
        cron_log(JOB, 'БД недоступна - выход');
        cron_unlock(JOB);
        exit(0);
    }

    /* ---------- Мягкие миграции ---------- */
    try { q("ALTER TABLE applications ADD COLUMN graded_at TEXT"); } catch (\Throwable $e) { /* колонка уже есть */ }
    q("CREATE TABLE IF NOT EXISTS reminder_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        app_id INTEGER NOT NULL,
        kind TEXT NOT NULL,
        sent_at TEXT DEFAULT (datetime('now','localtime'))
    )");
    q("CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_log_app_kind ON reminder_log(app_id, kind)");
    // Таблица in-app уведомлений (контракт core/notifications.php) — если её ещё нет.
    q("CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        body TEXT DEFAULT '',
        url TEXT DEFAULT '',
        icon TEXT DEFAULT 'bell',
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )");

    /* ---------- Кандидаты: результат есть, оплаченного заказа наград нет ---------- */
    // УЧАСТНИК ДОЛЖЕН ЗНАТЬ СВОЙ РЕЗУЛЬТАТ — но узнаёт он его двумя способами.
    //
    // Раньше здесь стояло единственное условие: письмо с результатом отправлено.
    // Для платных конкурсов это верно, а у конкурсов с публикацией списком
    // (results_mode = list) такого письма не бывает вовсе: итоги выходят на
    // странице результатов. В итоге сто с лишним участников бесплатного
    // конкурса не получали ни одного напоминания о заказе наград — а именно там
    // заказ и есть единственный способ получить награду на руки.
    //
    // Теперь годится любой из двух способов, и от него же считается срок.
    $rows = all(
        "SELECT a.id, a.number, a.competition_id, a.user_id, a.full_name, a.group_name, a.email,
                a.result, a.graded_at, a.created_at, a.result_sent_at, a.teacher,
                c.name AS comp_name, c.results_mode, c.results_published_at
           FROM applications a
           JOIN competitions c ON c.id = a.competition_id
          WHERE a.status <> 'rejected'
            AND a.result IS NOT NULL AND a.result <> ''
            AND (
                  COALESCE(a.result_sent_at,'') <> ''
               OR (COALESCE(c.results_mode,'email') = 'list' AND COALESCE(c.results_published_at,'') <> '')
            )"
    );

    /* ОДИН ЧЕЛОВЕК — ОДНО НАПОМИНАНИЕ, СКОЛЬКО БЫ ЗАЯВОК У НЕГО НИ БЫЛО.
     *
     * У «Величия России» 719 заявок в цепочке, а адресов около трёхсот: педагог
     * подаёт номер на каждого ученика, у одного руководителя доходит до двадцати.
     * Письмо на заявку означало бы двадцать одинаковых напоминаний в один день —
     * человек читает это как сбой, почтовая служба как рассылку, и ящик kc@
     * получает 719 отправок вместо трёхсот. Группируем по адресу.
     *
     * Отметка в reminder_log ставится по КАЖДОЙ заявке из письма: идемпотентность
     * сохраняется, и заявка, попавшая в письмо, второй раз шаг не отработает. */
    $queued = 0; $expired = 0; $complete = 0;

    /* СНАЧАЛА СОБИРАЕМ ЧЕЛОВЕКА ЦЕЛИКОМ, ПОТОМ РЕШАЕМ, ЧТО ЕМУ ПИСАТЬ.
     *
     * Комплект считается на адресат, а не на заявку: письмо одно на человека, и
     * трофей, купленный по одной заявке, закрывает эту позицию для всех его
     * заявок в конкурсе. Пока решение принималось по каждой заявке отдельно,
     * человек с пятью номерами получил бы пять разных решений на одно письмо. */
    $people = [];
    foreach ($rows as $a) {
        $id   = (int) $a['id'];
        $days = (int) floor((time() - award_graded_ts($a)) / 86400);
        if ($days > AWARD_ORDER_WINDOW_DAYS) { $expired++; continue; }   // окно заказа закрыто

        $key = mb_strtolower(trim((string) $a['email']));
        if ($key === '') $key = 'app#' . $id;                            // без почты — сам по себе
        $a['_days_left'] = max(1, AWARD_ORDER_WINDOW_DAYS - $days);
        $a['_days']      = $days;
        $people[$key][]  = $a;
    }

    foreach ($people as $apps) {
        $first  = $apps[0];
        $owned  = award_owned_kinds($apps);
        $missing = award_missing_kinds($apps, $owned);

        // Взял всё положенное — писем больше нет. Единственный случай молчания.
        if (!$missing) { $complete++; continue; }

        $isAddon = $owned !== [];
        if ($isAddon) {
            /* Уже покупал: отсчёт от дня оплаты, два письма за всё окно.
             * И только внутри тех же 60 дней — после них заказ всё равно закрыт. */
            $paidTs = award_last_paid_ts($apps);
            if ($paidTs <= 0) continue;
            $sinceBuy = (int) floor((time() - $paidTs) / 86400);
            $step = null;
            foreach (AWARD_ADDON_STEPS as $s) { if ($sinceBuy >= $s) $step = $s; }
            if ($step === null) continue;
            $kind = 'award_addon_' . $step;
        } else {
            // Ничего не купил — прежняя цепочка от результата.
            $step = null;
            foreach (AWARD_REMINDER_STEPS as $s) { if ((int) $first['_days'] >= $s) $step = $s; }
            if ($step === null) continue;
            $kind = 'award_order_' . $step;
        }

        // Идемпотентность прежняя: шаг отмечается по каждой заявке из письма.
        $alreadySent = true;
        foreach ($apps as $ap) { if (!award_reminder_sent((int) $ap['id'], $kind)) { $alreadySent = false; break; } }
        if ($alreadySent) continue;

        $cnt      = count($apps);
        $daysLeft = (int) $first['_days_left'];
        // При нескольких заявках ведём в раздел наград конкурса: какую
        // заказывать, человек выбирает сам.
        $awardsUrl = url('/awards') . '?comp=' . (int) $first['competition_id']
                   . ($cnt === 1 ? '&app=' . (int) $first['id'] : '');

        $delivered = false;

        // Письмо в очередь mail_queue.
        $email = trim((string) $first['email']);
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $html = award_reminder_html($first, $daysLeft, $awardsUrl, $apps, $owned);
            $subject = $isAddon
                ? 'Остальное к Вашей награде - «' . $first['comp_name'] . '»'
                : 'Не забудьте заказать награды - «' . $first['comp_name'] . '»';
            if (mail_queue($email, (string) $first['full_name'], $subject, $html) > 0) $delivered = true;
        }

        // In-app уведомление участнику.
        if ((int) $first['user_id'] > 0 && function_exists('notify_user')) {
            $body = $isAddon
                ? 'К заказанному можно добавить остальное из положенного по результату «'
                  . $first['result'] . '». Заказ доступен ещё ' . award_ru_days($daysLeft) . '.'
                : ($cnt === 1
                    ? 'Результат «' . $first['result'] . '» на конкурсе «' . $first['comp_name'] . '». '
                      . 'Заказ доступен ещё ' . award_ru_days($daysLeft) . '.'
                    : 'Итоги по ' . $cnt . ' Вашим заявкам на конкурсе «' . $first['comp_name'] . '». '
                      . 'Заказ наград доступен ещё ' . award_ru_days($daysLeft) . '.');
            $title = $isAddon ? 'Дополните наградной комплект' : 'Не забудьте заказать награды';
            $nid = notify_user((int) $first['user_id'], $title, $body, $awardsUrl, 'trophy');
            if ($nid > 0) $delivered = true;
        }

        if ($delivered) {
            foreach ($apps as $ap) award_reminder_mark((int) $ap['id'], $kind);
            $queued++;
            cron_log(JOB, sprintf('%s: %s шаг %d дн., заявок %d, не хватает: %s',
                                  $email !== '' ? $email : ('#' . $first['id']),
                                  $isAddon ? 'допродажа,' : 'напоминание,', $step, $cnt, implode('+', $missing)));
        }
    }
    cron_log(JOB, "заказ наград: писем $queued, комплект уже полный у $complete, окно истекло у $expired");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
