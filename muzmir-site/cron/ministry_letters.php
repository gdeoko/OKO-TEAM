<?php
/**
 * ОБРАЩЕНИЯ В ВЕДОМСТВА — АВТОМАТ ДНЯ ЗАПУСКА.
 *
 * Первого числа каждого месяца центр открывает приём на новые конкурсы. В этот
 * же день по всем министерствам культуры и образования, творческим союзам и
 * профильным порталам должно уйти официальное обращение об информационной
 * поддержке — именное, с исходящим номером, подписью, печатью и приложениями.
 *
 * Крон-строка (ежедневно в 09:10 МСК; сам скрипт решает, его сегодня день или нет):
 *   10 9 * * * php /var/www/muzmir/cron/ministry_letters.php
 *
 * Вручную:
 *   php cron/ministry_letters.php prepare  — собрать письма и положить в очередь
 *                                            приостановленными (ничего не уйдёт)
 *   php cron/ministry_letters.php send     — то же, но письма готовы к отправке
 *   php cron/ministry_letters.php status   — что в реестре и очереди
 *   php cron/ministry_letters.php on|off   — стоп-кран автоматической отправки
 *
 * ПОКА СТОП-КРАН ОПУЩЕН (ministry_mailing_on = 0), автомат только готовит
 * письма и складывает их приостановленными. Это осознанное состояние по умолчанию:
 * первое обращение в министерство отправляется один раз, переделать его нельзя.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ministries.php';
require_once BASE_PATH . '/core/ministry_mailing.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'ministry_letters';

$mode = strtolower(trim((string) ($argv[1] ?? 'auto')));

function ml_log(string $s): void { cron_log('ministry_letters', $s); echo $s . "\n"; }

if ($mode === 'on' || $mode === 'off') {
    mm_set_enabled($mode === 'on');
    echo 'автоматическая отправка обращений: ' . ($mode === 'on' ? 'ВКЛЮЧЕНА' : 'выключена') . "\n";
    exit(0);
}

/* ── Отметка об отправке ─────────────────────────────────────────────────
 *
 * QR на бланке ведёт на страницу проверки подлинности, а она показывает
 * документ только после того, как он отмечен отправленным. Отметку ставит
 * mm_sync_sent() — раньше она вызывалась лишь в штатном суточном прогоне, и
 * получалось так: письма ушли, ведомство сканирует код в тот же час и читает
 * «документ не найден». Ровно наоборот тому, зачем этот код на бланке.
 *
 * Поэтому отметка вынесена отдельным режимом и ходит по крону каждые десять
 * минут:  *\/10 * * * * php /var/www/muzmir/cron/ministry_letters.php sync
 */
if ($mode === 'sync') {
    // ЭТОТ РЕЖИМ ТОЖЕ ОБЯЗАН БРАТЬ ЛОК.
    //
    // Лок стоял ниже, а «sync» выходил до него — и каждые десять минут крон
    // запускал ещё одну копию, не спрашивая, закончилась ли прошлая. 01.09 их
    // накопилось сорок две, самая старая работала три с половиной часа. Каждая
    // держит открытое соединение с базой, а SQLite не может обрезать журнал
    // WAL, пока жив хоть один читатель: журнал вырос до 2,4 ГБ, и запросы у
    // всех — включая рассылку — стали ползти. Волна запуска встала намертво.
    //
    // Полчаса — с запасом: штатный проход занимает секунды, а если он идёт
    // дольше, значит что-то не так, и плодить копии тем более незачем.
    if (!cron_lock(JOB . '_sync', 1800)) { echo "предыдущий sync ещё идёт\n"; exit(0); }
    register_shutdown_function(static function () { cron_unlock(JOB . '_sync'); });
    $n = mm_sync_sent();
    if ($n > 0) ml_log("отмечено отправленными обращений: $n");
    exit(0);
}

if ($mode === 'status') {
    $s = min_stats();
    echo 'автоотправка: ' . (mm_enabled() ? 'включена' : 'выключена (стоп-кран)') . "\n";
    echo "адресатов в базе: {$s['total']}, доступны: {$s['ready']}\n";
    echo 'обращений в реестре: ' . (int) scalar("SELECT COUNT(*) FROM official_letters WHERE kind='support'") . "\n";
    echo '  из них отправлено: ' . (int) scalar("SELECT COUNT(*) FROM official_letters WHERE kind='support' AND sent_at<>''") . "\n";
    foreach (all("SELECT status, COUNT(*) n FROM mail_queue WHERE campaign_type='official' GROUP BY status") as $r) {
        echo "очередь [{$r['status']}]: {$r['n']}\n";
    }
    exit(0);
}

if (!cron_lock(JOB, 1800)) { echo "предыдущий прогон ещё идёт\n"; exit(0); }
register_shutdown_function(static function () { cron_unlock(JOB); });

// Что ушло — отмечаем в реестре. С этого момента работает QR проверки подлинности.
$synced = mm_sync_sent();
if ($synced > 0) ml_log("отмечено отправленными обращений: $synced");

$season = date('Y-m');

if ($mode === 'prepare' || $mode === 'send') {
    $r = mm_queue_all($mode === 'send', (int) ($argv[2] ?? 0));
    ml_log(sprintf('обращения: поставлено %d, пропущено %d, вложений %d, статус «%s»%s',
        (int) $r['queued'], (int) $r['skipped'], (int) ($r['attachments'] ?? 0),
        (string) ($r['status'] ?? ''), isset($r['error']) ? ' — ' . $r['error'] : ''));
    exit(0);
}

/* ── Штатный ход: только первого числа и только один раз за сезон ────────── */

if (date('j') !== '1') { exit(0); }

if ((string) setting('ministry_letters_season', '') === $season) {
    ml_log("обращения этого месяца ($season) уже подготовлены");
    exit(0);
}

// Конкурсы месяца должны быть открыты: обращение зовёт поддержать конкретный
// конкурс, и если он ещё в черновике, письмо уйдёт в никуда.
$open = (int) scalar("SELECT COUNT(*) FROM competitions WHERE status='open' AND is_paid=0");
if ($open === 0) {
    ml_log('бесплатных открытых конкурсов нет — обращения ждут открытия приёма');
    exit(0);
}

$r = mm_queue_all(mm_enabled());
set_setting('ministry_letters_season', $season);

ml_log(sprintf('запуск %s: обращений поставлено %d, пропущено %d, статус «%s»%s',
    $season, (int) $r['queued'], (int) $r['skipped'], (string) ($r['status'] ?? ''),
    mm_enabled() ? '' : ' — стоп-кран опущен, письма ждут в очереди'));

// Владельцу — короткий отчёт в Телеграм, чтобы он знал, что автомат отработал.
if (is_file(BASE_PATH . '/core/notify_owner.php')) {
    require_once BASE_PATH . '/core/notify_owner.php';
    if (function_exists('owner_tg_send')) {
        try {
            owner_tg_send('analytics', sprintf(
                '<b>Обращения в ведомства</b>%sПодготовлено %d обращений об информационной поддержке. %s',
                "\n", (int) $r['queued'],
                mm_enabled() ? 'Письма уходят с официальной почты центра.'
                             : 'Отправка выключена — письма ждут в очереди.'));
        } catch (\Throwable $e) {}
    }
}
