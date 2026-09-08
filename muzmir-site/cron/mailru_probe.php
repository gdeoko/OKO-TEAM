<?php
/**
 * ОТКРЫЛАСЬ ЛИ ДВЕРЬ MAIL.RU — СПРАШИВАЕМ У СОБСТВЕННОГО ЯЩИКА.
 *
 * С 25 августа Mail.ru Group отбивает всё, что уходит с домена центра: и
 * рассылку через Unisender, и личное письмо с Яндекса. Ответ один и тот же —
 * «550 spam message rejected», проверено 8 сентября обоими каналами на
 * собственный адрес kulturniy.centr.mir@mail.ru. Значит закрыт ДОМЕН, а не
 * канал, и переключением сервиса это не лечится.
 *
 * В очереди из-за этого стоят 4 191 письмо своей базы и 17 645 писем
 * учреждениям — все на mail.ru, bk.ru, inbox.ru, list.ru, internet.ru.
 * Ждать вручную и каждый день заглядывать в почту — работа, которая обязана
 * делаться сама.
 *
 * Почему не по статистике доставок. Регулятор нормы (mrep_domain_day_cap)
 * судит по mail_events: «доставлено» против «отказ». Но события до него не
 * доходят — Unisender, накопив отказы, теперь отклоняет адрес ДО отправки
 * («temporary_unavailable»), и в mail_events не появляется ни строки. В итоге
 * норма mail.ru стоит на пробных 30 и в примечании честно написано «вчера 0
 * доставлено, 0 отказов»: наблюдений нет, решения нет, замкнутый круг —
 * тот самый, про который правило 20.
 *
 * Поэтому спрашиваем напрямую. Раз в сутки с домена центра уходит одно письмо
 * на собственный ящик центра на mail.ru. Дошло — дверь открыта, и это видно
 * не по чужой статистике, а глазами: письмо лежит в папке. Не дошло — норма
 * остаётся пробной, никто ничего не трогает.
 *
 * Письмо самому себе, поэтому правило «наружу ничего не уходит ночью и в
 * воскресенье» здесь не нарушается: адресат — центр.
 *
 * Что делает, когда дверь открылась:
 *   - поднимает суточную норму всей группы Mail.ru с пробной до рабочего пола;
 *   - снимает у Unisender пометку «адрес временно недоступен» с адресов из
 *     очереди — иначе сервис продолжит отклонять их сам, уже без участия
 *     Mail.ru (scripts/uni_unsuppress.php);
 *   - пишет владельцу в Telegram: рассылку можно продолжать.
 *
 * Запуск: раз в час в рабочее окно.
 *   5 9-19 * * * php /var/www/muzmir/cron/mailru_probe.php >/dev/null 2>&1
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/cron/_lib.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/mail_reputation.php';
require_once BASE_PATH . '/core/imap_read.php';
require_once BASE_PATH . '/core/inbox_reader.php';   // ради inbox_spam_folders()
require_once BASE_PATH . '/core/telegram.php';

if (!cron_lock('mailru_probe', 1800)) exit(0);

/** Вся группа держится на одной репутации домена — и открывается тоже вместе. */
const MR_FAMILY = ['mail.ru', 'bk.ru', 'inbox.ru', 'list.ru', 'internet.ru'];

$dry = in_array('--dry', array_slice($argv, 1), true);
$log = [];
$say = function (string $m) use (&$log) { $log[] = $m; echo $m . PHP_EOL; };

/* ---------- 1. Ящик центра на mail.ru: он же адресат пробы, он же свидетель ---------- */
$acc = mail_account_by_name('mailru');
if (!$acc || empty($acc['user'])) {
    $say('нет ящика mailru в MUZMIR_SMTP_SENDERS — проверить нечем');
    cron_unlock('mailru_probe');
    exit(1);
}
$acc['host'] = (string) ($acc['imap_host'] ?? 'imap.mail.ru');
$acc['port'] = (int) ($acc['imap_port'] ?? 0) ?: 993;
$selfBox = (string) $acc['user'];

/* ---------- 2. Проба, отправленная в прошлый раз: дошла ли? ---------- */
$token  = trim((string) setting('mailru_probe_token', ''));
$sentAt = trim((string) setting('mailru_probe_sent_at', ''));
$opened = false;

if ($token !== '' && $sentAt !== '') {
    $age = time() - (int) strtotime($sentAt);
    if ($age < 900) {
        $say("проба $token отправлена " . $sentAt . ' — ещё рано смотреть');
        cron_unlock('mailru_probe');
        exit(0);
    }

    // Ищем по дате, а не по теме: серверы по-разному относятся к поиску
    // кириллицы в SUBJECT, а дата понятна всем. Сверку с меткой делаем сами.
    $since = date('d-M-Y', (int) strtotime($sentAt) - 86400);
    foreach (im_folders_for($acc) as $folder) {
        foreach (im_search($acc, 'SINCE ' . $since, $folder) as $id) {
            $raw = im_fetch($acc, $id, $folder);
            if ($raw === '') continue;
            // По сырому тексту метку не найти: тема с кириллицей уезжает в
            // base64 целиком, вместе с латинской меткой внутри. Поэтому письмо
            // сначала разбираем, и только потом ищем.
            $p   = im_parse($raw);
            $hay = (string) ($p['subject'] ?? '') . ' ' . (string) ($p['text'] ?? '');
            if (strpos($hay, $token) === false && strpos($raw, $token) === false) continue;
            $opened = true;
            $say("проба $token НАЙДЕНА в папке $folder — Mail.ru принимает письма с домена");
            break 2;
        }
    }

    if (!$opened) {
        if ($age > 6 * 3600) {
            $say("проба $token за " . round($age / 3600) . " ч не дошла — дверь закрыта, пробуем завтра");
            if (!$dry) { set_setting('mailru_probe_token', ''); set_setting('mailru_probe_sent_at', ''); }
        } else {
            $say("проба $token пока не дошла (" . round($age / 60) . " мин) — ждём");
            cron_unlock('mailru_probe');
            exit(0);
        }
    }
}

/* ---------- 3. Дверь открылась — снимаем ограничения ---------- */
if ($opened) {
    $floor = max(200, (int) setting('nl_domain_floor_cap', '800'));
    if (!$dry) {
        mrep_ensure_caps();
        foreach (MR_FAMILY as $d) {
            q("INSERT OR REPLACE INTO mail_domain_caps (domain, day_cap, cap_date, note) VALUES (?,?,?,?)",
              [$d, $floor, date('Y-m-d'), 'проба дошла ' . date('d.m.Y H:i') . ' — норма возвращена к рабочей']);
        }
        set_setting('mailru_probe_token', '');
        set_setting('mailru_probe_sent_at', '');
        set_setting('mailru_open_at', date('Y-m-d H:i:s'));
    }
    $say('норма Mail.ru Group возвращена к ' . $floor . ' писем в сутки');

    // Пометку «адрес временно недоступен» Unisender ставит сам и сам же по ней
    // отказывает. Пока её не снять, очередь будет стоять при открытой двери.
    $freed = 0;
    if (!$dry && is_file(BASE_PATH . '/scripts/uni_unsuppress.php')) {
        $out = [];
        exec('php ' . escapeshellarg(BASE_PATH . '/scripts/uni_unsuppress.php') . ' --limit=1000 --apply 2>&1', $out, $rc);
        foreach ($out as $line) if (preg_match('~снято:\s*(\d+)~u', $line, $m)) $freed = (int) $m[1];
        $say('снято пометок Unisender: ' . $freed);
    }

    $queued = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND campaign_type='konkurs'");
    $txt = "Mail.ru снова принимает письма с домена центра.\n"
         . "Норма поднята до $floor в сутки, снято пометок сервиса: $freed.\n"
         . "В очереди своей базы: $queued писем.";
    if (!$dry) tg_notify_admin($txt);
    cron_log('mailru_probe', 'дверь открыта; норма ' . $floor . ', снято пометок ' . $freed);
    cron_unlock('mailru_probe');
    exit(0);
}

/* ---------- 4. Новая проба — не чаще раза в сутки ---------- */
$last = trim((string) setting('mailru_probe_last_try', ''));
if ($last !== '' && substr($last, 0, 10) === date('Y-m-d')) {
    $say('сегодня уже стучались (' . $last . ') — второй раз незачем');
    cron_unlock('mailru_probe');
    exit(0);
}

$token = 'MRPROBE-' . strtoupper(bin2hex(random_bytes(4)));
$subj  = 'Служебная проверка канала ' . $token;
$html  = '<p>Служебное письмо центра самому себе: проверяем, принимает ли Mail.ru '
       . 'почту с домена музыкальный-мир.рф.</p><p>Метка: ' . $token . '</p>'
       . '<p>Отвечать не нужно.</p>';

if ($dry) {
    $say("сухой прогон: отправил бы пробу $token на $selfBox");
    cron_unlock('mailru_probe');
    exit(0);
}

// Свою же пометку снимаем перед отправкой, иначе сервис откажет вместо Mail.ru
// и мы примем его отказ за отказ почтовой службы.
uni_suppression_drop($selfBox);

$ok = mail_send_unisender($selfBox, $subj, $html, [
    'from_addr' => (string) cfgv('unisender_from', ''),
    'from_name' => (string) cfgv('mail_from_name', 'Культурный центр «Музыкальный Мир»'),
]);

set_setting('mailru_probe_last_try', date('Y-m-d H:i:s'));
if ($ok) {
    set_setting('mailru_probe_token', $token);
    set_setting('mailru_probe_sent_at', date('Y-m-d H:i:s'));
    $say("проба $token отправлена на $selfBox — результат будет виден через час");
} else {
    $say('проба не ушла: ' . mail_last_error());
}
cron_log('mailru_probe', $ok ? "проба $token отправлена" : 'проба не ушла: ' . mail_last_error());
cron_unlock('mailru_probe');

/* ---------- вспомогательное ---------- */

/** INBOX и «Спам»: письмо, попавшее в спам, тоже означает, что дверь открыта. */
function im_folders_for(array $acc): array {
    $out = ['INBOX'];
    if (function_exists('inbox_spam_folders')) {
        foreach (inbox_spam_folders($acc) as $f) $out[] = $f;
    } else {
        $out[] = '&BCEEPwQwBDw-';   // «Спам» на mail.ru в модифицированном UTF-7
    }
    return array_values(array_unique($out));
}

/** Снять у Unisender пометку «адрес недоступен» с одного адреса. */
function uni_suppression_drop(string $email): bool {
    $key = trim((string) cfgv('unisender_api_key', ''));
    if ($key === '' || $email === '') return false;
    $url = rtrim((string) cfgv('unisender_api_url', 'https://go2.unisender.ru/ru/transactional/api/v1'), '/')
         . '/suppression/delete.json';
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['api_key' => $key, 'email' => $email]),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $raw = curl_exec($ch);
    curl_close($ch);
    $d = json_decode((string) $raw, true);
    return is_array($d) && (string) ($d['status'] ?? '') === 'success';
}
