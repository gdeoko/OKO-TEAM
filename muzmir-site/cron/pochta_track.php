<?php
/**
 * ГДЕ ПОСЫЛКА — СПРАШИВАЕМ САМИ, А НЕ ЖДЁМ, ПОКА СПРОСЯТ.
 *
 * Трек-номер админ вбивает при отправке, и на этом раньше всё заканчивалось:
 * заказ навсегда оставался «отправлен». Дошла посылка или лежит в отделении
 * третью неделю — не знал никто, пока участник не напишет в чат.
 *
 * Здесь раз в несколько часов обходим отправленные заказы и спрашиваем Почту:
 *   • пришла в отделение  → участнику письмо «где забрать», заказ «доставлено»
 *                            в кабинете и админке;
 *   • вручена получателю  → статус «доставлено», дата вручения;
 *   • пошла обратно       → сообщение владельцу: это надо разбирать руками.
 *
 * ПИСЬМО УХОДИТ ОДИН РАЗ. Отметка arrived_mailed_at в заказе; повторный проход
 * по тому же заказу молчит, даже если Почта пришлёт то же событие ещё раз.
 *
 * НЕТ ДОСТУПА — НЕ РАБОТАЕМ И НЕ ВРЁМ. Служба отслеживания подключается
 * отдельно от «Отправки» (POCHTA_TRACK_LOGIN / POCHTA_TRACK_PASSWORD). Пока их
 * нет, задание тихо выходит: лучше пустой статус, чем выдуманный.
 *
 * Расписание: 20 10,14,18 * * *  (три раза в рабочий день; Почта обновляет
 * события пачками, чаще спрашивать нечего, а суточный лимит службы не бесконечен)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/cron/_lib.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/pochta.php';
require_once BASE_PATH . '/core/order_arrived.php';

const JOB = 'pochta_track';

$dry = in_array('--dry', $argv, true);

if (!pochta_track_ready()) {
    echo "служба отслеживания не подключена (нет POCHTA_TRACK_LOGIN/PASSWORD) — пропуск\n";
    exit(0);
}
if (!$dry && !cron_lock(JOB, 1800)) exit(0);

/* Берём то, что реально в пути: отправлено, трек есть, письмо о приходе ещё не
 * ушло. Доставленные и отменённые не трогаем — по ним вопрос закрыт. */
try { db()->exec("ALTER TABLE awards_orders ADD COLUMN arrived_mailed_at TEXT DEFAULT ''"); } catch (\Throwable $e) {}
$rows = all("SELECT id, tracking, full_name, email, status, postal_index, address, shipped_at
               FROM awards_orders
              WHERE COALESCE(tracking,'') <> ''
                AND status IN ('shipped','made')
                AND COALESCE(arrived_mailed_at,'') = ''
           ORDER BY id");

printf("отправлений в работе: %d%s\n", count($rows), $dry ? '  (сухой прогон)' : '');

$mailed = 0; $done = 0; $back = 0; $quiet = 0; $err = 0;

foreach ($rows as $o) {
    $track = strtoupper(preg_replace('~\s+~', '', (string) $o['tracking']) ?? '');
    if ($track === '') continue;

    $st = pochta_refresh($track, (int) $o['id']);
    $state = (string) ($st['state'] ?? '');
    $place = (string) ($st['place'] ?? '');
    $idx   = (string) ($st['index'] ?? '');

    if ($state === '') {
        $err++;
        printf("  #%-4d %-16s истории нет\n", $o['id'], $track);
        usleep(600000);
        continue;
    }

    printf("  #%-4d %-16s %-12s %s\n", $o['id'], $track, $state, mb_substr($place, 0, 40));

    if ($dry) { usleep(300000); continue; }

    /* ПРИШЛА В ОТДЕЛЕНИЕ. Для участника это и есть главное событие: посылку
     * можно забрать. Индекс берём из события Почты — это отделение, куда она
     * реально пришла, а не то, что человек написал в заявке. */
    if ($state === 'waiting') {
        // Хранение — 15 календарных дней с даты прибытия (правило Почты для
        // посылок). Дату называем, чтобы человек не тянул: невостребованное
        // уезжает обратно, и наградной материал приходится слать заново.
        $ts   = strtotime((string) ($st['happened_at'] ?? '')) ?: time();
        $keep = date('d.m.Y', $ts + 15 * 86400);
        if (order_notify_arrived((int) $o['id'], $idx, $keep)) {
            $mailed++;
            update('awards_orders', ['status' => 'delivered', 'delivered_at' => date('Y-m-d H:i:s')],
                   'id=:i', ['i' => (int) $o['id']]);
            cron_log(JOB, 'заказ #' . $o['id'] . ': посылка в отделении ' . $idx . ', письмо отправлено');
        }
    } elseif ($state === 'delivered') {
        // Вручена. Письмо «где забрать» уже неактуально — просто закрываем заказ.
        update('awards_orders', ['status' => 'delivered', 'delivered_at' => date('Y-m-d H:i:s'),
                                 'arrived_mailed_at' => date('Y-m-d H:i:s')],
               'id=:i', ['i' => (int) $o['id']]);
        $done++;
        cron_log(JOB, 'заказ #' . $o['id'] . ': вручена получателю');
    } elseif ($state === 'returning' || $state === 'lost') {
        $back++;
        cron_log(JOB, 'заказ #' . $o['id'] . ': ' . pochta_state_ru($state) . ' — нужен человек');
        if (is_file(BASE_PATH . '/core/notify_owner.php')) {
            require_once BASE_PATH . '/core/notify_owner.php';
            if (function_exists('owner_tg_send')) {
                try {
                    owner_tg_send('Заказы', '<b>Посылка ' . h(pochta_state_ru($state)) . '</b>' . "\n"
                        . 'Заказ №' . (int) $o['id'] . ' · ' . h((string) $o['full_name']) . "\n"
                        . 'Трек: <code>' . h($track) . '</code>' . "\n"
                        . 'Разберитесь руками: автоматика тут ничего не решает.');
                } catch (\Throwable $e) {}
            }
        }
    } else {
        $quiet++;                       // в пути — ничего не делаем
    }

    // Служба отслеживания считает запросы; идём спокойно.
    sleep(1);
}

printf("\nписем о приходе: %d, вручено: %d, вернулось: %d, в пути: %d, без истории: %d\n",
       $mailed, $done, $back, $quiet, $err);
if (!$dry) cron_unlock(JOB);
