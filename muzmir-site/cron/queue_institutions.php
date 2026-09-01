<?php
/**
 * ОЧЕРЕДЬ ПРИГЛАШЕНИЙ УЧРЕЖДЕНИЯМ — ПОДДЕРЖИВАЕТСЯ, А НЕ НАБИВАЕТСЯ РАЗОМ.
 *
 * В базе тридцать пять тысяч адресов. Поставить их в очередь одним махом
 * технически можно, но неправильно сразу по трём причинам:
 *
 *   1) полгигабайта тел писем в базе — и столько же в каждом ночном бэкапе;
 *   2) письмо, поставленное сегодня, уйдёт через две недели и позовёт на
 *      конкурс, приём на который к тому времени закроется;
 *   3) отписавшийся за это время адресат всё равно получит письмо — оно уже
 *      лежит в очереди с готовым телом.
 *
 * Поэтому очередь держится глубиной примерно в два дневных объёма и добирается
 * по мере отправки. Тело письма всегда собрано на актуальных конкурсах, а
 * отписки и отказы почтовиков успевают подействовать.
 *
 * Крон: каждые пятнадцать минут в окно отправки, с 9 до 18. Точная строка — в
 * scripts/crontab.txt (записать её здесь нельзя: последовательность «звёздочка
 * слэш» закрывает этот комментарий).
 *
 * Вручную:
 *   php cron/queue_institutions.php          — добрать очередь до нормы
 *   php cron/queue_institutions.php 500      — добрать не больше 500 за раз
 *   php cron/queue_institutions.php status   — что в очереди и сколько осталось
 *
 * Сам по себе НИЧЕГО НЕ ОТПРАВЛЯЕТ: письма уходят общим воркером очереди и
 * только при поднятом стоп-кране массовых рассылок.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once BASE_PATH . '/core/institutions.php';
require_once BASE_PATH . '/core/invite_queue.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'queue_institutions';

$mode = strtolower(trim((string) ($argv[1] ?? '')));

/** Глубина очереди: два дневных объёма — запас на выходные и на сбои сервиса. */
function qi_target_depth(): int {
    $split = function_exists('nl_daily_split') ? nl_daily_split() : [];
    $cap   = (int) ($split['inst'] ?? 0);
    if ($cap < 1) $cap = function_exists('nl_daily_cap') ? (int) round(nl_daily_cap() / 2) : 250;
    return max(200, $cap * 2);
}

/**
 * Сколько писем УЧРЕЖДЕНИЯМ ждёт отправки прямо сейчас.
 *
 * Считаем только свой тип кампании. Волна по собственной базе идёт параллельно
 * и со своей квотой — если складывать их в одну кучу, восемь тысяч писем
 * подписчикам выглядели бы как «очередь полна», и учреждениям не поставилось бы
 * ни одного письма до конца месяца.
 */
function qi_in_queue(): int {
    return (int) (scalar("SELECT COUNT(*) FROM mail_queue
                           WHERE status IN ('queued','paused') AND COALESCE(priority,0) > 0
                             AND campaign_type = 'inst'") ?? 0);
}

if ($mode === 'status') {
    inst_migrate();
    printf("в очереди массовых: %d (норма глубины %d)\n", qi_in_queue(), qi_target_depth());
    printf("учреждений ждут первого письма: %d\n",
        (int) scalar("SELECT COUNT(*) FROM institutions WHERE email<>'' AND status='new' AND COALESCE(bounce_count,0)<2"));
    printf("готовы к повтору (писали больше трёх месяцев назад): %d\n", count(inst_pick_for_reinvite(100000)));
    printf("уже написали: %d, отписались: %d, отказ почтовика: %d\n",
        (int) scalar("SELECT COUNT(*) FROM institutions WHERE status='invited'"),
        (int) scalar("SELECT COUNT(*) FROM institutions WHERE status='unsubscribed'"),
        (int) scalar("SELECT COUNT(*) FROM institutions WHERE COALESCE(bounce_count,0)>=2"));
    exit(0);
}

// Час, а не пятнадцать минут: набор нескольких тысяч писем идёт дольше, чем
// приходит следующий крон, и короткий ttl превращал лок в фикцию (см. cron_lock).
if (!cron_lock(JOB, 3600)) { echo "предыдущий прогон ещё идёт\n"; exit(0); }
register_shutdown_function(static function () { cron_unlock(JOB); });

/* САМОЛЕЧЕНИЕ ПЕРЕД ДОБОРОМ.
 *
 * Учреждение помечается приглашённым сразу после постановки письма в очередь.
 * Если письмо из очереди потом исчезло (перезалив базы, ручная чистка, сбой),
 * метка осталась, и адрес выпал из выборки навсегда: она берёт только «новых».
 * Так десять с половиной тысяч учреждений числились обработанными, не получив
 * ни строчки. Перед каждым добором возвращаем таких в работу. */
if (function_exists('inst_reset_ghost_invites')) {
    $ghost = inst_reset_ghost_invites(true);
    if ($ghost > 0) cron_log(JOB, "возвращено в работу без письма: $ghost");
}

$have = qi_in_queue();
$need = qi_target_depth() - $have;

// ПОТОЛОК ОДНОГО ПРОХОДА.
// Пустая очередь означала «добрать сразу два дневных объёма» — семнадцать тысяч
// писем за один запуск. Такой проход идёт больше часа, держит гигабайт тел в
// базе и переживает собственный лок. Крон приходит каждые пятнадцать минут в
// окно 8–18, то есть сорок раз в день: восьмисот писем за проход хватает на
// тридцать тысяч в сутки — больше любой дневной квоты.
$need = min($need, 800);

if ($mode !== '' && ctype_digit($mode)) $need = min($need, (int) $mode);

if ($need < 1) {
    cron_log(JOB, "очередь заполнена: $have писем, добирать не нужно");
    exit(0);
}

// Сначала те, кому ещё не писали. Когда первая волна пройдёт целиком, начнут
// подбираться повторы — тем, кто промолчал и с чьего письма сменился сезон.
$r = invite_queue_institutions($need);
$queued = (int) $r['queued'];

if ($queued < $need) {
    $r2 = invite_requeue_institutions($need - $queued);
    $queued += (int) $r2['queued'];
    if ((int) $r2['queued'] > 0) cron_log(JOB, 'повторных приглашений: ' . (int) $r2['queued']);
}

// Благодарности учреждениям, которые откликнулись, — сама и бесплатно.
$t = invite_queue_thanks(50);

cron_log(JOB, sprintf('добрано в очередь %d писем (было %d, норма %d)%s',
    $queued, $have, qi_target_depth(),
    (int) $t['queued'] > 0 ? ', благодарностей ' . (int) $t['queued'] : ''));
