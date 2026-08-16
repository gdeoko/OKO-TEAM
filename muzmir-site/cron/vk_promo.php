<?php
/**
 * РАЗНОС НАШИХ ЗАПИСЕЙ ПО СООБЩЕСТВАМ УЧРЕЖДЕНИЙ.
 *
 * Раз в час берёт несколько площадок и кладёт в каждую очередную запись из
 * набора: где стена открыта — публикацией, где нет — в предложенные новости.
 * Записи не сочиняются: это наши собственные посты со стены сообщества, с теми
 * же текстами и афишами (таблица vk_posts, слоты 1..6).
 *
 * ОДНА ЗАПИСЬ В ДЕНЬ НА ПЛОЩАДКУ. Каждое сообщество получает одну запись в
 * сутки и следующую только на другой день: за шесть дней до него доходит весь
 * набор. Больше одной в день — это спам, и первым же пожалуется тот
 * администратор, ради которого всё делается.
 *
 * ПРЕДЛОЖКА ЖДЁТ ОТВЕТА. Туда уходит ровно одна запись, и следующая — только
 * после того, как администратор опубликовал предыдущую. Опубликовал — площадка
 * получает следующую запись набора. Отклонил — больше не пишем никогда.
 * Промолчал дольше срока (settings.vk_promo_wait_days, по умолчанию 5 дней) —
 * откладываем: предложку там не смотрят.
 *
 * ПРЕДЕЛ ВКОНТАКТЕ. Записей с одной страницы можно делать около полусотни в
 * сутки, поэтому суточная норма (settings.vk_promo_daily, по умолчанию 40)
 * считается по журналу и раскладывается по рабочим часам. Это и есть настоящее
 * ограничение канала: не «сколько площадок», а «сколько записей в день».
 *
 * Крон:
 *   17 9-21 * * *  php /var/www/muzmir/cron/vk_promo.php >/dev/null 2>&1
 *
 * Выключатель: settings.vk_promo_enabled = '0'. Общий стоп-кран массовых
 * коммуникаций тоже останавливает выпуск.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk_promo.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'vk_promo';

if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) exit(0);
if ((string) scalar("SELECT value FROM settings WHERE key='vk_promo_enabled'") === '0') exit(0);
if (trim((string) cfgv('vk_token', '')) === '') exit(0);
if (!cron_lock(JOB, 1800)) exit(0);

try {
    vkp_ensure();

    /* ── Судьба отправленного: раз в сутки, в первый запуск дня ── */
    $lastCheck = (string) (scalar("SELECT value FROM settings WHERE key='vk_promo_checked_on'") ?? '');
    $today     = date('Y-m-d');
    if ($lastCheck !== $today) {
        $stat = vkp_check_outcomes(120);
        q("INSERT INTO settings (key,value) VALUES ('vk_promo_checked_on',:v)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value", ['v' => $today]);
        cron_log(JOB, sprintf('проверка: опубликовано %d, висит %d, отклонили %d, молчат %d',
            $stat['опубликовано'], $stat['висит'], $stat['снято'], $stat['молчат']));
    }

    $posts = vkp_posts();
    if (!$posts) { cron_log(JOB, 'набор записей пуст — нужен scripts/vk_posts_import.php'); cron_unlock(JOB); exit(0); }

    /* ── Сколько сегодня ещё можно ── */
    $cap  = vkp_daily_cap();
    $left = $cap - vkp_sent_today();
    if ($left <= 0) { cron_unlock(JOB); exit(0); }

    $perRun = max(1, (int) (scalar("SELECT value FROM settings WHERE key='vk_promo_per_run'") ?: 4));
    $take   = min($left, $perRun);

    /* ── Кому сегодня ──
     * Только профильные и живые площадки, сегодня ещё не получавшие записи, и —
     * для предложки — не ждущие вердикта по прошлой. Открытые стены идут
     * первыми: там публикация гарантирована.
     */
    $targets = all("SELECT * FROM vk_targets
                     WHERE status='ready' AND (can_post=1 OR can_suggest=1) AND score >= 12
                       AND COALESCE(pending_log_id,0) = 0
                       AND COALESCE(date(last_post_at),'') <> date('now','localtime')
                     ORDER BY can_post DESC, score DESC, members DESC
                     LIMIT :l", ['l' => $take]);
    if (!$targets) { cron_unlock(JOB); exit(0); }

    $campaign = 'vk-promo-' . date('Y-m');
    $ok = $err = 0;
    foreach ($targets as $t) {
        $post = vkp_next_post($t);
        if (!$post) break;

        $r = vkp_publish($t, $post, $campaign);
        if ($r['ok']) $ok++; else $err++;
        if (!$r['ok'] && $r['fatal']) {
            cron_log(JOB, 'частотный предел ВКонтакте: ' . $r['error'] . ' — до следующего часа');
            break;
        }
        // Живой человек не публикует раз в секунду.
        sleep(random_int(20, 40));
    }

    if ($ok || $err) cron_log(JOB, sprintf('выпущено %d, отказов %d (за сутки %d из %d)',
        $ok, $err, vkp_sent_today(), $cap));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}

cron_unlock(JOB);
