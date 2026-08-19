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
          'vk', 'vk_templates', 'launch_run', 'telegram'] as $m) {
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
    // ЛИНЕЙКУ БЕРЁМ ПО ПОСЛЕДНЕМУ МЕСЯЦУ, А НЕ ПО СТАТУСУ 'open'.
    // К 1-му числу открытых конкурсов физически не остаётся: приём закрывается 25-го
    // в 18:00 (волна 'closed'), а ночью на 26-е крон check_competitions_dates добивает
    // всё, у чего end_date прошла. То есть этот крон, запускаясь 1-го в 09:00, всегда
    // видел пустой список и выходил с ошибкой — новый месяц не открылся бы ни разу.
    //
    // Постоянная линейка центра — это конкурсы последнего месяца в любом статусе,
    // у которых чистый slug (архивные получают суффикс «-ГГГГ-ММ» при переносе).
    $lastStart = (string) (scalar(
        "SELECT MAX(start_date) FROM competitions WHERE COALESCE(start_date,'') <> ''") ?? '');
    $prev = $lastStart !== ''
        ? all("SELECT * FROM competitions WHERE start_date = ? ORDER BY sort ASC, id ASC", [$lastStart])
        : [];
    // Подстраховка: если по дате ничего не нашлось — берём открытые, как раньше.
    if (!$prev) $prev = all("SELECT * FROM competitions WHERE status='open' ORDER BY sort ASC, id ASC");

    if (!$prev) {
        $say('КОНКУРСОВ В БАЗЕ НЕТ — продлевать нечего, план не ставим');
        // Молчать здесь нельзя: это значит, что месяц не откроется и заявок не будет.
        if (!$DRY && function_exists('tg_notify_admin')) {
            try { tg_notify_admin("Музыкальный Мир: месячный запуск $tag НЕ СОСТОЯЛСЯ — в базе нет ни одного конкурса для продления."); } catch (\Throwable $e) {}
        }
        exit(1);
    }
    $say('линейка взята по последнему месяцу (' . ($lastStart ?: 'по статусу open') . '): ' . count($prev) . ' шт.');
    $say('продлеваем конкурсы: ' . implode(', ', array_map(fn($c) => (string) $c['name'], $prev)));

    // Поля, которые переезжают в новый месяц как есть.
    $carry = ['code', 'name', 'type', 'direction', 'is_paid', 'price', 'cover', 'description',
              'results_mode', 'regulation_pdf', 'diploma_template', 'diploma_theme', 'diploma_bg',
              'diploma_approved', 'region_logos', 'nominations', 'sort', 'duration'];

    foreach ($prev as $c) {
        $oldId   = (int) $c['id'];
        $slug    = (string) $c['slug'];
        $prevTag = substr((string) ($c['start_date'] ?? ''), 0, 7) ?: 'archive';
        // Конкурс, уже уехавший в архив, второй метки не получает: иначе адрес
        // превращается в «vozrozhdenie-2026-07-2026-07» и ломает старые ссылки.
        if ($prevTag !== 'archive' && str_ends_with($slug, '-' . $prevTag)) {
            $say("  #{$oldId} «{$c['name']}»: уже в архиве ($slug) — пропускаю");
            continue;
        }

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
// Правило владельца от 19.08.2026: блок кабинета остаётся в письме каждого
// месяца, вместе с конкурсами и клубом. Опасности повторной выдачи пароля нет:
// доступ попадает в письмо только тому, кто ни разу не входил и кому личное
// письмо с доступом не уходило (core/newsletter.php, $needCabinet). Остальные
// видят обычное приглашение в кабинет без пароля.
$firstTag = trim((string) setting('combo_first_month', ''));
if ($firstTag === '') {
    $firstTag = '2026-08';
    if (!$DRY) set_setting('combo_first_month', $firstTag);
}
$withCabinet = true;
if (!$DRY) set_setting('combo_cabinet_block', '1');
$say('блок «личный кабинет» в письме: включён (доступ — только тем, кто ещё не входил)');

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

/* ── 3б. Новый круг по учреждениям ──────────────────────────────────────── */

// ПАРТНЁРСКАЯ ВОЛНА ИДЁТ КАЖДЫЙ МЕСЯЦ, А НЕ ОДИН РАЗ В ЖИЗНИ.
//
// Очередь приглашений берёт учреждения со статусом «new» и после отправки
// ставит «invited» — то есть письмо уходит однажды и больше никогда. Конкурсы
// при этом меняются каждый месяц, и школа, не открывшая августовское письмо,
// про сентябрьские конкурсы уже не узнает. Первого числа открываем новый круг:
// возвращаем в очередь тех, кому писали в прошлом месяце и кто не просил
// перестать. Отписавшиеся, отбившие письмо и исключённые не возвращаются
// никогда, партнёры тоже: у них своя связь с центром.
if ($DRY) {
    $__back = (int) (scalar("SELECT COUNT(*) FROM institutions
        WHERE status = 'invited' AND TRIM(COALESCE(email,'')) <> ''
          AND COALESCE(bounce_count,0) < 2
          AND COALESCE(partner_status,'') <> 'accepted'
          AND (invited_at IS NULL OR invited_at = '' OR strftime('%Y-%m', invited_at) < ?)", [$tag]) ?? 0);
    $say("открыли бы новый круг приглашений учреждениям: $__back");
} else {
    q("UPDATE institutions SET status='new', updated_at=datetime('now','localtime')
        WHERE status = 'invited' AND TRIM(COALESCE(email,'')) <> ''
          AND COALESCE(bounce_count,0) < 2
          AND COALESCE(partner_status,'') <> 'accepted'
          AND (invited_at IS NULL OR invited_at = '' OR strftime('%Y-%m', invited_at) < ?)", [$tag]);
    $__back = (int) db()->query("SELECT changes()")->fetchColumn();
    $say("новый круг приглашений учреждениям: возвращено в очередь $__back");
}

/* ── 4. Стоп-кран массовых коммуникаций ─────────────────────────────────── */

// СТОП-КРАН САМ НЕ ПОДНИМАЕТСЯ. Раньше эта строка безусловно включала массовые
// коммуникации 1-го числа. Но опустить стоп-кран может не только человек кнопкой
// «Завершить кампанию»: его роняет автоматика защиты — больше 30 жёстких отказов
// за прогон или доля отказов выше 20% («это не база, это канал»). Ровно так в
// августе 2026 из базы ушли 2695 живых адресов. Автоподъём 1-го числа означал бы,
// что аварийная остановка живёт максимум до конца месяца и снимается без разбора
// причины — то есть защиты нет.
//
// Поэтому включаем сами только то, что сами и выключили штатно (завершение
// кампании). Во всех прочих случаях — сообщаем владельцу и ждём его решения.
if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) {
    $why = trim((string) setting('mass_sending_off_reason', ''));
    if ($why === 'campaign_finished') {
        if ($DRY) { $say('стоп-кран опущен штатно (кампания завершена) — подняли бы'); }
        else {
            mass_sending_set(true);
            set_setting('mass_sending_off_reason', '');
            $say('стоп-кран снят: прошлая кампания была завершена штатно, волны месяца пойдут по расписанию');
        }
    } else {
        $say('ВНИМАНИЕ: стоп-кран опущен' . ($why !== '' ? " ($why)" : ' автоматикой защиты или вручную')
           . ' — сам не поднимаю. План месяца поставлен, но рассылки не пойдут, пока владелец не включит их в пульте.');
        if (!$DRY && function_exists('tg_notify_admin')) {
            try {
                tg_notify_admin("Музыкальный Мир: план на $tag поставлен, но массовые рассылки выключены"
                    . ($why !== '' ? " ($why)" : '') . ". Включите их в пульте запуска, если причина устранена.");
            } catch (\Throwable $e) {}
        }
    }
}

$say('готово');
