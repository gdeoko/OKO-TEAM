<?php
/**
 * УБОРКА ВО ВХОДЯЩИХ: ОТБОЙНИКИ ПОЧТОВЫХ РОБОТОВ — В ОТДЕЛЬНУЮ ПАПКУ.
 *
 * Почтовый сервер Минкультуры Челябинской области зациклил пересылку нашего
 * обращения и с 15 августа возвращает его нам по кругу: больше тысячи трёхсот
 * писем «Undelivered Mail Returned to Sender», по восемь-десять в час. Ответить
 * на это нечем — петля на их стороне, наши письма туда давно не уходят, — а
 * рабочий ящик центра завален так, что живое письмо в нём не найти.
 *
 * Задание раскладывает такие письма по папке «Отбойники»: они остаются в почте
 * и в нашей базе, их видно, если понадобятся, но во «Входящих» их больше нет.
 *
 * ЧТО ПЕРЕКЛАДЫВАЕТСЯ — ТОЛЬКО ОЧЕВИДНОЕ:
 *   письмо от почтового робота (mailer-daemon, postmaster, mail delivery system)
 *   И с темой отчёта о недоставке. Оба условия сразу: письмо от живого человека
 *   с адреса postmaster@ или письмо со словом «returned» в теме останется на
 *   месте.
 *
 * Ничего не удаляется. Если папки нет, она создаётся.
 *
 * В КРОН НЕ ПОСТАВЛЕН НАМЕРЕННО. Проверка 21.08.2026 показала, что в почте
 * центра этих писем уже нет: во «Входящих» kc@ от gov74 остаётся одно письмо,
 * в «Спаме» ни одного, хотя в нашей базе их полторы тысячи — значит почта
 * разбирается с ними сама, и ежечасно лазить в ящик робота незачем. Задание
 * лежит готовым на случай, когда завал повторится: тогда его достаточно
 * запустить руками или добавить строкой в расписание.
 *
 *   php cron/inbox_tidy.php          — показать, что нашлось
 *   php cron/inbox_tidy.php --apply  — переложить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/imap_read.php';
require_once BASE_PATH . '/core/inbox_reader.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'inbox_tidy';

$apply = in_array('--apply', $argv, true);
$folder = (string) (function_exists('setting') ? setting('inbox_bounce_folder', 'Отбойники') : 'Отбойники');

if ($apply && !cron_lock(JOB, 900)) { cron_log(JOB, 'предыдущий заход ещё идёт'); exit(0); }

/** Письмо от почтового робота с отчётом о недоставке? */
function tidy_is_bounce(string $from, string $subject): bool {
    $f = mb_strtolower($from);
    $s = mb_strtolower($subject);
    $robot = preg_match('~(mailer-daemon|postmaster|mail\s*delivery|no-?reply@.*(mx|mail)\.)~u', $f) === 1;
    $rep   = preg_match('~undelivered|undeliverable|returned to sender|delivery status|delivery has failed'
                      . '|failure notice|не\s?доставлен|недоставлен|доставка не удалась~u', $s) === 1;
    return $robot && $rep;
}

$total = ['seen' => 0, 'moved' => 0, 'errors' => 0];
foreach (inbox_boxes() as $alias => $accName) {
    $acc = mail_account_by_name($accName);
    if (!$acc) continue;
    $acc['host'] = inbox_imap_host($acc);
    $acc['port'] = (int) ($acc['imap_port'] ?? 0) ?: 993;

    $err = null;
    // Берём только свежие: старые уже разобраны и лежат где лежат.
    $ids = im_search($acc, 'SINCE ' . date('d-M-Y', strtotime('-3 days')), 'INBOX', $err);
    if ($err) { $total['errors']++; continue; }
    if (!$ids) continue;

    $mine = [];
    foreach ($ids as $id) {
        $raw = im_fetch($acc, (int) $id, 'INBOX');
        if ($raw === '') continue;
        $p = im_parse($raw);
        $total['seen']++;
        $from = (string) ($p['from'] ?? '');
        $subj = (string) ($p['subject'] ?? '');
        if (!tidy_is_bounce($from, $subj)) continue;
        $mine[] = [(int) $id, $from, $subj];
    }
    if (!$mine) continue;

    printf("%-8s отбойников во «Входящих»: %d\n", $alias, count($mine));
    foreach (array_slice($mine, 0, 3) as [$id, $from, $subj]) {
        printf("    %-34s %s\n", mb_substr($from, 0, 34), mb_substr($subj, 0, 44));
    }
    if (!$apply) continue;

    // Папку создаём заранее: MOVE в несуществующую папку сервер отклонит.
    im_cmd($acc, '', 'CREATE "' . $folder . '"', 20);

    // Двигаем по одному: пачкой сервер иногда отвечает молча, и понять, что
    // ушло, а что нет, невозможно. Идём с конца — номера писем при перемещении
    // сдвигаются, и обход с начала пропускал бы каждое второе.
    $moved = 0;
    foreach (array_reverse($mine) as [$id, $from, $subj]) {
        [$ok, $res] = im_cmd($acc, 'INBOX', 'MOVE ' . (int) $id . ' "' . $folder . '"', 25);
        if ($ok) $moved++;
        else {
            // Старые серверы MOVE не знают — тогда копия плюс пометка на удаление.
            [$ok2] = im_cmd($acc, 'INBOX', 'COPY ' . (int) $id . ' "' . $folder . '"', 25);
            if ($ok2) {
                im_cmd($acc, 'INBOX', 'STORE ' . (int) $id . ' +FLAGS (\\Deleted)', 20);
                $moved++;
            } else { $total['errors']++; }
        }
    }
    if ($moved > 0) im_cmd($acc, 'INBOX', 'EXPUNGE', 30);
    $total['moved'] += $moved;
    printf("    переложено: %d\n", $moved);
}

if ($apply) {
    cron_log(JOB, sprintf('просмотрено %d, переложено отбойников %d, ошибок %d',
        $total['seen'], $total['moved'], $total['errors']));
    cron_unlock(JOB);
    printf("\nитого переложено: %d (папка «%s»)\n", $total['moved'], $folder);
} else {
    printf("\nэто предпросмотр: php cron/inbox_tidy.php --apply\n");
}
