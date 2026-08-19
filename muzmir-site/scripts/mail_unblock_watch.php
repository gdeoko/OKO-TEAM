<?php
/**
 * СТОРОЖ БЛОКИРОВКИ РАБОЧИХ ЯЩИКОВ.
 *
 * С 17 августа kc@ и nagradi.on@ получают от Яндекса 554 на каждое письмо
 * («Message rejected under suspicion of SPAM»): 161 массовое письмо, ушедшее с
 * kc@, стоило центру двух суток без подтверждений заявок и без наградных
 * материалов. На это время письма сайта переведены на почту центра в Gmail
 * (настройка mail_tx_via_gmail), а в поддержку Яндекс 360 отправлено обращение.
 *
 * Ограничение снимут молча — письма просто начнут уходить. Ждать этого руками
 * значит держать центр на чужой почте лишние дни, поэтому проверка стоит в
 * кроне: как только оба ящика снова отправляют, настройка возвращается на ноль
 * и почта центра работает со своего домена.
 *
 * Проверка идёт по SMTP до команды DATA включительно, письмо адресуется своему
 * же ящику — наружу ничего не уходит, правило рабочего окна не нарушается.
 *
 *   php scripts/mail_unblock_watch.php
 *   php scripts/mail_unblock_watch.php --dry
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';

$dry  = in_array('--dry', $argv, true);
$line = str_repeat('=', 78);

/** Ящик отправляет? Проба до конца письма, получатель — он сам. */
function mub_can_send(array $acc): array {
    $ctx = stream_context_create(['ssl' => ['verify_peer' => false, 'verify_peer_name' => false]]);
    $fp  = @stream_socket_client('ssl://' . ($acc['host'] ?? 'smtp.yandex.ru') . ':' . ((int) ($acc['port'] ?? 465)),
                                 $e, $es, 20, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) return [false, 'нет соединения: ' . $es];

    $rd = static function () use ($fp): string {
        $o = '';
        while ($l = fgets($fp, 600)) { $o .= $l; if (preg_match('/^\d{3} /', $l)) break; }
        return rtrim($o);
    };
    $wr = static function (string $s) use ($fp, $rd): string { fwrite($fp, $s . "\r\n"); return $rd(); };

    $rd();
    $from = mail_addr_ascii((string) ($acc['from_addr'] ?? $acc['user']));
    $wr('EHLO ' . (explode('@', $from)[1] ?? 'localhost'));
    $wr('AUTH LOGIN');
    $wr(base64_encode((string) $acc['user']));
    $auth = $wr(base64_encode((string) $acc['pass']));
    if (!str_starts_with($auth, '235')) { fclose($fp); return [false, 'вход не принят: ' . mb_substr($auth, 0, 60)]; }

    $wr('MAIL FROM:<' . $from . '>');
    $wr('RCPT TO:<' . $from . '>');
    $wr('DATA');
    $msg = "From: <$from>\r\nTo: <$from>\r\nSubject: proba\r\nDate: " . date('r')
         . "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nПроверка канала.\r\n";
    $res = $wr($msg . '.');
    $wr('QUIT');
    fclose($fp);
    return [str_starts_with($res, '250'), $res];
}

echo "ПРОВЕРКА РАБОЧИХ ЯЩИКОВ ЦЕНТРА\n$line\n";

$ok = [];
foreach (['kc', 'nagradi'] as $name) {
    $acc = mail_account_by_name($name);
    if (!$acc) { printf("  %-8s ящик не настроен\n", $name); $ok[$name] = false; continue; }
    [$can, $note] = mub_can_send($acc);
    $ok[$name] = $can;
    printf("  %-8s %-10s %s\n", $name, $can ? 'работает' : 'закрыт', mb_substr($note, 0, 90));
}

$viaGmail = (string) setting('mail_tx_via_gmail', '0') === '1';
echo "\n  письма сайта сейчас: " . ($viaGmail ? 'через почту центра в Gmail' : 'со своего домена') . "\n";

if ($ok['kc'] && $ok['nagradi'] && $viaGmail) {
    if (!$dry) {
        setting_set('mail_tx_via_gmail', '0');
        @file_put_contents(BASE_PATH . '/data/logs/cron.log',
            '[' . date('Y-m-d H:i:s') . "] [mail_unblock_watch] ограничение снято, письма сайта вернулись на kc@\n",
            FILE_APPEND);
    }
    echo "  ОГРАНИЧЕНИЕ СНЯТО: письма сайта возвращены на рабочие ящики центра\n";
} elseif (!$ok['kc'] || !$ok['nagradi']) {
    echo "  ограничение держится, письма сайта остаются на запасном канале\n";
}
