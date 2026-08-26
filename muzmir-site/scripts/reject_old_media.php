<?php
/**
 * ОТКЛОНЕНИЕ РАБОТ СТАРШЕ ГОДА, ПО КОТОРЫМ РЕЗУЛЬТАТ ЕЩЁ НЕ УШЁЛ.
 *
 * Сверка свода оснований с решениями владельца нашла шесть принятых работ,
 * которые по дате съёмки не проходят п. 8.11: при ручном просмотре пятисот
 * заявок открыть свойства каждого файла невозможно. Три из них участникам уже
 * отправлены — их не трогаем, звание присвоено и отозвать его нельзя. Остальные
 * три ещё не ушли, и владелец решил отклонить их, если дата подтверждается.
 *
 * ДАТУ ПОДТВЕРЖДАЕМ ЗАНОВО, В МОМЕНТ ОТКАЗА. Основание — не запись в таблице,
 * а показание площадки: Яндекс.Диск отдаёт EXIF камеры (exif.date_time), и
 * именно он попадает в текст отказа. Не подтвердилось — заявка не трогается.
 *
 * ПИСЬМО УХОДИТ УТРОМ. Отказ приходит человеку ночью как удар без объяснения:
 * ответить некому, кабинет он в два часа ночи открывать не станет. Поэтому
 * письмо ставится в очередь на ближайшее рабочее время (пн-сб, с 9 утра).
 *
 *   php scripts/reject_old_media.php --dry     — показать, ничего не делая
 *   php scripts/reject_old_media.php --ids=14,1542,1676
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/media_date.php';
require_once BASE_PATH . '/core/grade_apply.php';

$dry = in_array('--dry', $argv, true);
$ids = [];
foreach ($argv as $a) {
    if (preg_match('~^--ids=([\d,]+)$~', $a, $m)) {
        foreach (explode(',', $m[1]) as $v) if ((int) $v > 0) $ids[] = (int) $v;
    }
}
if (!$ids) { fwrite(STDERR, "нужен --ids=14,1542,1676\n"); exit(1); }

/* Ближайшее рабочее время: пн-сб с 9 до 19. Воскресенье переносим на понедельник. */
$slot = static function (): string {
    $t = time();
    for ($i = 0; $i < 8; $i++) {
        $d = strtotime('+' . $i . ' day', $t);
        if ((int) date('N', $d) === 7) continue;                 // воскресенье
        $from = strtotime(date('Y-m-d', $d) . ' 09:00:00');
        $to   = strtotime(date('Y-m-d', $d) . ' 19:00:00');
        if ($i === 0 && $t >= $from && $t < $to) return date('Y-m-d H:i:s', $t);
        if ($from > $t) return date('Y-m-d H:i:s', $from);
    }
    return date('Y-m-d H:i:s', strtotime('+1 day 09:00:00'));
};

foreach ($ids as $id) {
    $a = one("SELECT a.*, c.end_date ce, c.name cn FROM applications a
               LEFT JOIN competitions c ON c.id = a.competition_id WHERE a.id=?", [$id]);
    if (!$a) { echo "#$id — заявки нет\n"; continue; }
    $who = trim((string) ($a['full_name'] ?: $a['group_name']));

    if ((string) $a['status'] === 'rejected') { echo "#$id $who — уже отклонена\n"; continue; }
    if (trim((string) ($a['result_sent_at'] ?? '')) !== '') {
        echo "#$id $who — результат уже отправлен участнику " . (string) $a['result_sent_at'] . ", не трогаю\n";
        continue;
    }

    $t = media_too_old((string) $a['video_url'], '', (string) $a['ce']);
    if (!$t['old']) { echo "#$id $who — дата не подтвердилась (" . (string) $t['note'] . "), не трогаю\n"; continue; }

    echo "#$id $who | " . (string) $a['cn'] . " | было: " . (string) $a['result'] . "\n";
    echo "    причина: " . str_replace("\n", ' ', (string) $t['reason']) . "\n";
    if ($dry) continue;

    $r = grade_reject_application($id, (string) $t['reason'], 'jury');
    echo '    ' . ($r['ok'] ? $r['msg'] : 'НЕ ОТКЛОНЕНА: ' . $r['msg']) . "\n";

    // Письмо этой заявки — на ближайшее рабочее время.
    if (!empty($r['mailed'])) {
        $when = $slot();
        q("UPDATE mail_queue SET scheduled_at=? WHERE to_email=? AND status='new'
             AND subject LIKE ? AND COALESCE(scheduled_at,'')=''",
          [$when, (string) $a['email'], '%' . (string) $a['number'] . '%']);
        echo "    письмо уйдёт $when\n";
    }
}
