<?php
/**
 * ЗАВЕДЕНЫ ЛИ КОНКУРСЫ СЛЕДУЮЩЕГО МЕСЯЦА — НАПОМИНАНИЕ ВЛАДЕЛЬЦУ.
 *
 * Правило центра: конкурсы каждый месяц новые, их заводит владелец — своё
 * название, афиша, положение, бланк диплома (19.08.2026). Крон открытия месяца
 * (cron/monthly_launch.php) 1-го числа только проверяет, что они есть: если не
 * заведено ни одного, он ничего не делает и пишет в Telegram.
 *
 * Беда в том, что это сообщение приходит УЖЕ ПЕРВОГО ЧИСЛА, когда месяц начался
 * и исправлять поздно: афишу, положение и бланк за утро не сделать, а база ждёт
 * письма. Поэтому спрашиваем заранее, с 24-го числа, и каждый день говорим,
 * сколько осталось.
 *
 * Когда конкурсы заведены — молчим: сторож, который хвалит каждый день, перестаёт
 * читаться (та же причина, по которой убрали ежедневное «Бот не смог ответить»).
 * Один раз подтверждаем, что всё на месте, и дальше тихо.
 *
 * Запуск: 0 11 24-31 * *  (ежедневно в конце месяца, в рабочее время)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
if (is_file(BASE_PATH . '/core/telegram.php')) require_once BASE_PATH . '/core/telegram.php';
// plural_ru живёт в chat_priority.php — без него «3 дня» выйдет «3 день».
if (!function_exists('plural_ru') && is_file(BASE_PATH . '/core/chat_priority.php')) {
    require_once BASE_PATH . '/core/chat_priority.php';
}
require_once __DIR__ . '/_lib.php';

const JOB = 'next_month_check';
$DRY = in_array('--dry', $argv, true);

if (!$DRY && !cron_lock(JOB, 3600)) exit(0);

$now      = new DateTime('now');
$next     = (new DateTime('first day of next month'))->setTime(0, 0);
$nextTag  = $next->format('Y-m');
$nextName = ['', 'январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль',
             'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'][(int) $next->format('n')];
$daysLeft = (int) $now->diff($next)->days;

/* СЧИТАЕМ ПО ДАТЕ НАЧАЛА ПРИЁМА, КАК И КРОН ОТКРЫТИЯ МЕСЯЦА.
 * Условие обязано совпадать с monthly_launch.php слово в слово, иначе
 * напоминание скажет «всё готово», а первого числа запуск не состоится. */
$have = all("SELECT id, code, name, status, COALESCE(launched,0) launched, start_date, end_date
               FROM competitions
              WHERE date(start_date) >= ? AND date(start_date) <= ?
           ORDER BY sort ASC, id ASC",
           [$next->format('Y-m-01'), $next->format('Y-m-t')]);

$open = array_values(array_filter($have, static fn(array $c): bool => (string) $c['status'] === 'open'));

if ($open) {
    /* Подтверждаем один раз за месяц и замолкаем. */
    $markKey = 'next_month_ok:' . $nextTag;
    if ((string) setting($markKey, '') === '') {
        $names = implode(', ', array_map(static fn(array $c): string => (string) $c['name'], $open));
        cron_log(JOB, "конкурсы на $nextTag заведены (" . count($open) . "): $names");
        if (!$DRY) {
            set_setting($markKey, date('Y-m-d H:i:s'));
            if (function_exists('tg_notify_admin')) {
                try {
                    tg_notify_admin("Музыкальный Мир: конкурсы на $nextName заведены — "
                        . count($open) . " шт. ($names). Первого числа запуск пройдёт сам: "
                        . "прошлый месяц уедет в архив, волны встанут на 10:00.");
                } catch (\Throwable $e) {}
            }
        }
    } else {
        cron_log(JOB, "конкурсы на $nextTag заведены, владельцу уже сообщили — молчу");
    }
    if (!$DRY) cron_unlock(JOB);
    exit(0);
}

/* Конкурсов нет. Говорим каждый день, называя остаток: «через неделю» и
   «завтра» — разные новости, и человек должен слышать разницу. */
$draft = count($have) - count($open);
$срок  = $daysLeft <= 1 ? 'ЗАВТРА' : ($daysLeft . ' ' . plural_ru($daysLeft, 'день', 'дня', 'дней'));

$text = "Музыкальный Мир: на $nextName не заведено ни одного конкурса.\n\n"
      . "До начала месяца $срок. Первого числа в 09:00 крон проверит ещё раз: "
      . "если конкурсов не будет, запуск не состоится — ни постов, ни письма по базе, "
      . "а октябрьские останутся открытыми вместо архива.\n\n"
      . "Что нужно на каждый конкурс: название, афиша, положение, бланк диплома, "
      . "приём с " . $next->format('d.m') . " по " . $next->format('25.m') . ". "
      . "Заводятся в админке, раздел «Конкурсы»."
      . ($draft > 0 ? "\n\nЧерновики на месяц уже есть ($draft) — их нужно перевести в «Приём открыт»." : '');

cron_log(JOB, "конкурсов на $nextTag нет (черновиков: $draft), до месяца дней: $daysLeft");
if ($DRY) {
    echo $text, "\n";
    exit(0);
}
if (function_exists('tg_notify_admin')) {
    try { tg_notify_admin($text); } catch (\Throwable $e) { cron_log(JOB, 'не отправилось: ' . $e->getMessage()); }
}
cron_unlock(JOB);
