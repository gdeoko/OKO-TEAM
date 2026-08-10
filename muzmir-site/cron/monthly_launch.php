<?php
/**
 * ЗАПУСК НОВОГО МЕСЯЦА — САМ, БЕЗ ЧЕЛОВЕКА.
 *
 * Раз в месяц, 1-го числа, кампания должна начаться заново: те же конкурсы на
 * новые даты, посты в сообществе, письмо по базе. Раньше это делалось руками
 * из пульта запуска — то есть не делалось бы вовсе, забудь владелец нажать кнопку.
 *
 * Крон-строка (1-го числа в 09:00 МСК, за час до запуска в 10:00):
 *   0 9 1 * * php /var/www/muzmir/cron/monthly_launch.php >> /var/www/muzmir/data/logs/launch.log 2>&1
 *
 * Что делает по шагам:
 *   1. Продлевает конкурсы на новый месяц. Прошлые закрываются и уезжают в архив
 *      (к их slug добавляется месяц), а новые получают ЧИСТЫЕ адреса без месяца —
 *      поэтому постоянные ссылки в постах и письмах всегда ведут на актуальный
 *      конкурс, а прошлогодние заявки остаются за архивной записью.
 *   2. Ставит план волн месяца: посты ВК по каждому конкурсу и объединённое письмо
 *      на 10:00, напоминания 22-го и 25-го, закрытие приёма, итоги 28-го.
 *   3. Со ВТОРОГО месяца выключает блок «личный кабинет» в письме (правило
 *      владельца): доступ выдан всей базе один раз в августе 2026, дальше кабинет
 *      создаётся человеку при подаче заявки, а не рассылкой.
 *
 * Идемпотентно: повторный запуск в тот же месяц ничего не дублирует.
 * Ничего не отправляет сам — отправкой занимается cron/launch_scheduler.php,
 * когда наступит время волны.
 *
 * Ручной прогон без изменений:  php cron/monthly_launch.php --dry
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'data', 'helpers', 'send_timing', 'newsletter', 'mailer', 'mail_campaigns',
          'vk', 'vk_templates', 'launch_run'] as $m) {
    $p = BASE_PATH . '/core/' . $m . '.php';
    if (is_file($p)) require_once $p;
}
require_once __DIR__ . '/_lib.php';

const JOB = 'monthly_launch';
$DRY = in_array('--dry', $argv, true);

if (!$DRY && !cron_lock(JOB, 3600)) { cron_log(JOB, 'предыдущий запуск ещё идёт'); exit(0); }
if (!$DRY) register_shutdown_function(static function () { cron_unlock(JOB); });

// Проверить будущий месяц, не дожидаясь его: --month=2026-09
// (вместе с --dry ничего не меняет, только показывает план).
$now = time();
foreach ($argv as $a) {
    if (preg_match('~^--month=(\d{4})-(\d{2})$~', (string) $a, $mm)) {
        $t = mktime(12, 0, 0, (int) $mm[2], 1, (int) $mm[1]);
        if ($t) $now = $t;
    }
}
$Y     = (int) date('Y', $now);
$M     = (int) date('n', $now);
$tag   = date('Y-m', $now);
$start = date('Y-m-01', $now);
$end   = date('Y-m-25', $now);

$say = static function (string $s) use ($DRY): void {
    echo '[' . date('Y-m-d H:i:s') . '] monthly_launch: ' . ($DRY ? '(проба) ' : '') . $s . "\n";
    if (!$DRY) cron_log(JOB, $s);
};

$say("месяц $tag, приём с $start по $end");

/* ── 1. Конкурсы месяца ─────────────────────────────────────────────────── */

// Уже продлевали в этом месяце?
$fresh = all("SELECT id, name FROM competitions WHERE status='open' AND date(start_date) = ?", [$start]);
if ($fresh) {
    $say('конкурсы месяца уже открыты (' . count($fresh) . ') — продлевать не нужно');
} else {
    // Берём последний состав открытых конкурсов — он и есть «постоянная линейка» центра.
    $prev = all("SELECT * FROM competitions WHERE status='open' ORDER BY sort ASC, id ASC");
    if (!$prev) {
        $say('ОТКРЫТЫХ КОНКУРСОВ НЕТ — продлевать нечего, план не ставим');
        exit(1);
    }
    $say('продлеваем конкурсы: ' . implode(', ', array_map(fn($c) => (string) $c['name'], $prev)));

    // Поля, которые переезжают в новый месяц как есть.
    $carry = ['code', 'name', 'type', 'direction', 'is_paid', 'price', 'cover', 'description',
              'results_mode', 'regulation_pdf', 'diploma_template', 'diploma_theme', 'diploma_bg',
              'diploma_approved', 'region_logos', 'nominations', 'sort', 'duration'];

    foreach ($prev as $c) {
        $oldId   = (int) $c['id'];
        $slug    = (string) $c['slug'];
        $prevTag = substr((string) ($c['start_date'] ?? ''), 0, 7) ?: 'archive';

        if ($DRY) { $say("  #{$oldId} «{$c['name']}»: slug $slug → архив $slug-$prevTag, новый конкурс на $start-$end"); continue; }

        try {
            // Прошлый месяц уезжает в архив: закрыт, адрес с меткой месяца.
            update('competitions', [
                'status' => 'finished',
                'slug'   => $slug . '-' . $prevTag,
            ], 'id=:id', ['id' => $oldId]);

            // Новый конкурс занимает постоянный адрес.
            $row = [];
            foreach ($carry as $f) if (array_key_exists($f, $c)) $row[$f] = $c[$f];
            $row['slug']         = $slug;
            $row['start_date']   = $start;
            $row['end_date']     = $end;
            $row['results_date'] = date('Y-m-28', $now);
            $row['status']       = 'open';
            $row['launched']     = 0;
            $row['launched_at']  = null;
            $newId = (int) insert('competitions', $row);
            $say("  «{$c['name']}»: архив #$oldId ($slug-$prevTag) → новый #$newId ($slug)");
        } catch (\Throwable $e) {
            $say("  ОШИБКА по конкурсу #$oldId: " . $e->getMessage());
        }
    }
}

/* ── 2. Блок кабинета в письме — только в самый первый месяц ─────────────── */

// Правило владельца: логин и пароль рассылались по базе один раз (август 2026).
// Дальше кабинет человек получает при подаче заявки, и повторять это в письме
// нельзя — иначе тем, кто так и не вошёл, каждый месяц менялся бы пароль.
$firstTag = trim((string) setting('combo_first_month', ''));
if ($firstTag === '') {
    $firstTag = '2026-08';
    if (!$DRY) set_setting('combo_first_month', $firstTag);
}
$withCabinet = ($tag === $firstTag);
if (!$DRY) set_setting('combo_cabinet_block', $withCabinet ? '1' : '0');
$say('блок «личный кабинет» в письме: ' . ($withCabinet ? 'включён (первый месяц)' : 'выключен'));

/* ── 3. План волн месяца ────────────────────────────────────────────────── */

$already = (int) (scalar(
    "SELECT COUNT(*) FROM launch_jobs WHERE status IN ('scheduled','running','done')
      AND strftime('%Y-%m', run_at) = ?", [$tag]) ?? 0);
if ($already > 0) {
    $say("план месяца уже стоит ($already заданий) — не трогаем");
} elseif ($DRY) {
    $say('поставили бы план волн на ' . $start . ' 10:00');
} else {
    $channels = ['vk_wall', 'vk_dm', 'email', 'inapp'];
    $saved = trim((string) setting('launch_channels', ''));
    if ($saved !== '') {
        $list = array_values(array_filter(array_map('trim', explode(',', $saved))));
        if ($list) $channels = $list;
    }
    $res = launch_schedule_all($start, '10:00', $channels);
    if (!empty($res['ok'])) {
        $say('план месяца поставлен: ' . json_encode($res['scheduled'] ?? [], JSON_UNESCAPED_UNICODE));
    } else {
        $say('НЕ УДАЛОСЬ поставить план: ' . (string) ($res['msg'] ?? '?'));
    }
}

/* ── 4. Массовые коммуникации должны быть включены ──────────────────────── */

if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) {
    if ($DRY) { $say('стоп-кран стоит — включили бы'); }
    else { mass_sending_set(true); $say('стоп-кран снят: волны месяца пойдут по расписанию'); }
}

$say('готово');
