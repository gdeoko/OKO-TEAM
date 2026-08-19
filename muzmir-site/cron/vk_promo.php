<?php
/**
 * РАЗНОС НАШИХ ЗАПИСЕЙ ПО СООБЩЕСТВАМ УЧРЕЖДЕНИЙ.
 *
 * Набор — шесть настоящих записей со стены центра (vk_posts, слоты 1..6):
 * четыре конкурса, партнёрство для учреждений и клуб участников. По чужим
 * площадкам они расходятся один в один, вместе со своими афишами.
 *
 * ДВА РАЗНЫХ ПОРЯДКА, ПОТОМУ ЧТО ДВЕРИ РАЗНЫЕ.
 *
 * Открытая стена — публикация без чьего-либо решения, и площадка получает весь
 * набор за один день волнами: 9:00, 11:00, 13:00, 15:00, 17:00, 18:00. Шесть
 * записей подряд в одни сутки допустимы только там, где мы никого не заставляем
 * ничего делать.
 *
 * Предложка — очередь к живому администратору. Туда уходит ровно одна запись в
 * сутки, и следующая только после того, как он опубликовал предыдущую.
 * Отклонил — площадка больше не получает ничего никогда. Промолчал дольше
 * settings.vk_promo_wait_days (по умолчанию 5 дней) — откладываем: предложку там
 * не смотрят.
 *
 * ПРЕДЕЛ ВКОНТАКТЕ. Записей с одной страницы выходит около полусотни в сутки,
 * дальше публикации закрывают. Поэтому суточная норма (vk_promo_daily, по
 * умолчанию 40) считается по журналу и делится так:
 *   vk_promo_open_per_day    площадок с открытой стеной × 6 записей = 30
 *   vk_promo_suggest_per_day предложек по одной записи             = 10
 * Это и есть настоящее ограничение канала: не «сколько площадок», а «сколько
 * записей в сутки».
 *
 * ВРЕМЯ. Наружу ничего не уходит ночью и в воскресенье — проверка стоит внутри
 * (core/outreach_window.php), а не только в расписании крона.
 *
 * Крон (пн–сб, шесть волн):
 *   0 9,11,13,15,17,18 * * 1-6  php /var/www/muzmir/cron/vk_promo.php
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
require_once BASE_PATH . '/core/outreach_window.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'vk_promo';

/** Час волны → какой слот набора уходит на открытые стены. */
const WAVES = [9 => 1, 11 => 2, 13 => 3, 15 => 4, 17 => 5, 18 => 6];

if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) exit(0);
if ((string) scalar("SELECT value FROM settings WHERE key='vk_promo_enabled'") === '0') exit(0);
if (trim((string) cfgv('vk_token', '')) === '') exit(0);
if (!outreach_window_ok()) exit(0);
if (!cron_lock(JOB, 1800)) exit(0);

try {
    vkp_ensure();
    $today = date('Y-m-d');
    $hour  = (int) date('G');

    /* Волна дня. Крон стоит на часах из WAVES; при ручном запуске берём
     * ближайшую прошедшую волну, чтобы порядок записей не сбивался. */
    $wave = 0;
    foreach (WAVES as $h => $slot) if ($hour >= $h) $wave = $slot;
    if ($wave === 0) { cron_unlock(JOB); exit(0); }
    $firstWave = ($wave === 1);

    /* ── Судьба предложек: раз в сутки, в первой волне ── */
    if ($firstWave) {
        $lastCheck = (string) (scalar("SELECT value FROM settings WHERE key='vk_promo_checked_on'") ?? '');
        if ($lastCheck !== $today) {
            $stat = vkp_check_outcomes(120);
            q("INSERT INTO settings (key,value) VALUES ('vk_promo_checked_on',:v)
               ON CONFLICT(key) DO UPDATE SET value=excluded.value", ['v' => $today]);
            cron_log(JOB, sprintf('проверка: опубликовано %d, висит %d, отклонили %d, молчат %d',
                $stat['опубликовано'], $stat['висит'], $stat['снято'], $stat['молчат']));
        }
    }

    $posts = vkp_posts();
    if (!$posts) { cron_log(JOB, 'набор записей пуст — нужен scripts/vk_posts_import.php'); cron_unlock(JOB); exit(0); }

    $cap  = vkp_daily_cap();
    $left = $cap - vkp_sent_today();
    if ($left <= 0) { cron_unlock(JOB); exit(0); }

    $ok = $err = 0;
    $stop = false;

    /* ═══ Открытые стены: весь набор за день, по одной записи в волну ═══ */
    $openPerDay = max(0, (int) (scalar("SELECT value FROM settings WHERE key='vk_promo_open_per_day'") ?: 5));

    if ($firstWave && $openPerDay > 0) {
        // Начало дня: набираем площадки на сегодня и сразу отдаём им первую запись.
        $recycle = max(7, (int) (scalar("SELECT value FROM settings WHERE key='vk_promo_recycle_days'") ?: 30));
        /* КРУГ СЧИТАЕТСЯ НАЧАТЫМ ПО cycle_date, А НЕ ТОЛЬКО ПО last_cycle_at.
         * Отметка last_cycle_at ставится лишь на шестой волне и лишь при успешной
         * публикации. Площадку, которой ВК закрыл стену на середине круга, отметка
         * не получала, на следующий день она снова проходила в набор, next_slot
         * сбрасывался в 1 — и в то же сообщество уходил тот же самый текст слота 1
         * второй раз. Именно это антиспам ВК ищет в первую очередь, да и суточная
         * норма записей тратится впустую. Теперь площадка, у которой круг начинался
         * в пределах окна перерыва, в набор не берётся: недоделанный круг лучше
         * оборвать, чем начать заново. */
        $fresh = all("SELECT * FROM vk_targets
                       WHERE status='ready' AND can_post=1 AND score >= 12
                         AND (COALESCE(cycle_date,'') = ''
                              OR date(cycle_date) < date('now','localtime','-' || :rec || ' days')
                              -- Круг, в котором не вышло НИ ОДНОЙ записи, отдыхом не считается:
                              -- иначе площадка, у которой все шесть волн упали (нет прав, закрытая
                              -- стена, сбой сети), уходит на месяц, так и не увидев ни одного поста.
                              OR NOT EXISTS (SELECT 1 FROM vk_promo_log l
                                              WHERE l.group_id = vk_targets.group_id
                                                AND l.outcome = 'sent'
                                                AND date(l.created_at) >= date(vk_targets.cycle_date)))
                         AND (COALESCE(last_cycle_at,'') = ''
                              OR last_cycle_at < datetime('now','localtime','-' || :rec || ' days'))
                       ORDER BY score DESC, members DESC
                       LIMIT :l", ['rec' => $recycle, 'l' => min($openPerDay, $left)]);
        // Отметку «круг начат» ставим ЗДЕСЬ, но она означает только «взяли в работу
        // сегодня»: площадка обязана попасть в $inWork ниже, иначе первая же волна
        // её не увидит. А вот отдых на весь перерыв даёт last_cycle_at, и он
        // ставится по факту публикации: если все шесть волн упали, площадка не
        // должна уходить на месяц, не получив ни одной записи.
        foreach ($fresh as $t) {
            q("UPDATE vk_targets SET cycle_date=:d, next_slot=1 WHERE group_id=:g",
              ['d' => $today, 'g' => (int) $t['group_id']]);
        }
    }

    // Площадки, взятые в работу сегодня, получают запись текущей волны.
    $inWork = all("SELECT * FROM vk_targets
                    WHERE can_post=1 AND cycle_date = :today AND status='ready'
                      AND NOT EXISTS (SELECT 1 FROM vk_promo_log l
                                       WHERE l.group_id = vk_targets.group_id AND l.slot = :slot
                                         AND date(l.created_at) = :today)
                    ORDER BY score DESC, members DESC", ['today' => $today, 'slot' => $wave]);

    foreach ($inWork as $t) {
        if ($left - $ok <= 0) { $stop = true; break; }
        $post = null;
        foreach ($posts as $p) if ((int) $p['slot'] === $wave) { $post = $p; break; }
        if (!$post) break;

        $r = vkp_publish($t, $post, 'vk-promo-' . date('Y-m'));
        if ($r['ok']) {
            $ok++;
            // Круг пройден: последняя волна набора — площадка отдыхает до следующего цикла.
            if ($wave === max(array_values(WAVES))) {
                q("UPDATE vk_targets SET last_cycle_at=datetime('now','localtime') WHERE group_id=:g",
                  ['g' => (int) $t['group_id']]);
            }
        } else {
            $err++;
            if ($r['fatal']) { cron_log(JOB, 'частотный предел: ' . $r['error']); $stop = true; break; }
        }
        sleep(random_int(20, 40));
    }

    /* ═══ Предложка: одна запись в сутки, ждём вердикта ═══ */
    $suggestPerDay = max(0, (int) (scalar("SELECT value FROM settings WHERE key='vk_promo_suggest_per_day'") ?: 10));
    if (!$stop && $firstWave && $suggestPerDay > 0) {
        $room = min($suggestPerDay, $left - $ok);
        $sugg = $room > 0 ? all("SELECT * FROM vk_targets
                                  WHERE status='ready' AND can_post=0 AND can_suggest=1 AND score >= 12
                                    AND COALESCE(pending_log_id,0) = 0
                                    AND COALESCE(date(last_post_at),'') <> :today
                                  ORDER BY score DESC, members DESC
                                  LIMIT :l", ['today' => $today, 'l' => $room]) : [];
        foreach ($sugg as $t) {
            $post = vkp_next_post($t);
            if (!$post) break;
            $r = vkp_publish($t, $post, 'vk-promo-' . date('Y-m'));
            if ($r['ok']) $ok++;
            else {
                $err++;
                if ($r['fatal']) { cron_log(JOB, 'частотный предел: ' . $r['error']); break; }
            }
            sleep(random_int(20, 40));
        }
    }

    if ($ok || $err) cron_log(JOB, sprintf('волна %d (слот %d): выпущено %d, отказов %d — за сутки %d из %d',
        $wave, $wave, $ok, $err, vkp_sent_today(), $cap));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}

cron_unlock(JOB);
