<?php
/**
 * ЕЖЕДНЕВНЫЙ ВЫПУСК АНОНСОВ В СООБЩЕСТВА УЧРЕЖДЕНИЙ.
 *
 * Раз в час берёт несколько площадок из vk_targets и кладёт в каждую анонс:
 * где стена открыта — публикацией, где нет — в предложенные новости. Суточный
 * предел (settings.vk_promo_daily, по умолчанию 40) считается по журналу, а не
 * по счётчику в памяти, поэтому перезапуск крона не удваивает выпуск.
 *
 * Очередь идёт от крупных сообществ к мелким: при одинаковых усилиях запись у
 * тысячи подписчиков стоит больше, чем у сорока.
 *
 * Раз в сутки (первый запуск после полуночи) проверяется судьба вчерашних
 * предложек: опубликовали, отклонили или ещё висит. Это единственный способ
 * знать реальную отдачу канала, а не считать отправленное за размещённое.
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

    /* ── Судьба вчерашних предложек: раз в сутки, в первый ночной запуск ── */
    $lastCheck = (string) (scalar("SELECT value FROM settings WHERE key='vk_promo_checked_on'") ?? '');
    $today     = date('Y-m-d');
    if ($lastCheck !== $today) {
        $stat = vkp_check_outcomes(60);
        q("INSERT INTO settings (key,value) VALUES ('vk_promo_checked_on',:v)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value", ['v' => $today]);
        cron_log(JOB, sprintf('проверка предложек: опубликовано %d, висит %d, снято %d',
            $stat['опубликовано'], $stat['висит'], $stat['снято']));
    }

    /* ── Сколько сегодня ещё можно ── */
    $cap  = vkp_daily_cap();
    $left = $cap - vkp_sent_today();
    if ($left <= 0) { cron_unlock(JOB); exit(0); }

    // Растягиваем суточный предел по рабочим часам: пачка за час, а не всё разом.
    $perRun = max(1, (int) (scalar("SELECT value FROM settings WHERE key='vk_promo_per_run'") ?: 4));
    $take   = min($left, $perRun);

    $targets = all("SELECT * FROM vk_targets
                     WHERE status='ready' AND (can_post=1 OR can_suggest=1)
                     ORDER BY can_post DESC, score DESC, members DESC LIMIT :l", ['l' => $take]);
    if (!$targets) {
        cron_log(JOB, 'площадок в очереди нет — нужен прогон scripts/vk_scan_targets.php');
        cron_unlock(JOB);
        exit(0);
    }

    /* ── Что рекламируем ── */
    $comp = one("SELECT slug, name, end_date FROM competitions
                  WHERE status='open' AND is_paid=0 ORDER BY end_date LIMIT 1")
         ?: one("SELECT slug, name, end_date FROM competitions WHERE status='open' ORDER BY end_date LIMIT 1");
    if (!$comp) { cron_log(JOB, 'нет открытых конкурсов — выпуск пропущен'); cron_unlock(JOB); exit(0); }

    $campaign = 'vk-promo-' . date('Y-m');
    $link     = rtrim((string) cfgv('base_url'), '/') . '/competitions?utm_source=vk&utm_medium=community&utm_campaign=' . $campaign;
    $deadline = preg_replace('~\s+\d{4}$~u', '', ru_date((string) $comp['end_date']));

    // Афиша конкурса 1:1 — если она есть на диске.
    $posterRel = (string) (scalar("SELECT image_path FROM posters p
                                    JOIN competitions c ON c.id=p.competition_id
                                   WHERE c.slug=:s AND p.format='1x1' ORDER BY p.id DESC LIMIT 1",
                                  ['s' => (string) $comp['slug']]) ?? '');
    $attach = $posterRel !== '' ? vkp_attachment(BASE_PATH . '/public' . $posterRel) : '';

    $ok = $err = 0;
    foreach ($targets as $t) {
        $msg = vkp_message($t, $link, $deadline);
        $r   = vkp_publish($t, $msg, $attach, $campaign);
        if ($r['ok']) $ok++; else $err++;
        if (!$r['ok'] && $r['fatal']) {
            cron_log(JOB, 'частотный предел ВКонтакте: ' . $r['error'] . ' — до следующего часа');
            break;
        }
        // Живой человек не публикует раз в секунду. Пауза 20-40 секунд.
        sleep(random_int(20, 40));
    }

    if ($ok || $err) cron_log(JOB, sprintf('выпущено %d, отказов %d (за сутки %d из %d)',
        $ok, $err, vkp_sent_today(), $cap));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}

cron_unlock(JOB);
