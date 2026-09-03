<?php
/**
 * partner_certs_reissue.php — перевыпуск сертификатов действующих партнёров.
 *
 * ЗАЧЕМ. Из-за сломанной нумерации (см. scripts/partner_renumber.php) у всех
 * партнёров совпал номер, а бланк кэшировался ровно по номеру. Первым в этот
 * кэш попал тестовый прогон, и шестнадцать партнёров получили письмом
 * сертификат с наименованием «ПРОВЕРКА Детская школа искусств (временная
 * запись)» и краем «Тестовый край». Номера уже разведены, кэш теперь именуется
 * ещё и по id учреждения — остаётся пересобрать бланки и выслать их взамен.
 *
 * ЧТО ДЕЛАЕТ.
 *   --check   пересобрать PDF и прочитать их обратно: на бланке обязано стоять
 *             наименование этого учреждения и его новый номер. Ничего не шлёт.
 *   --send    то же плюс письмо партнёру с исправленным бланком. Письмо уходит
 *             только в рабочее окно (пн–сб 09:00–19:00 МСК, правило владельца)
 *             и только тем, у кого проверка бланка прошла.
 *
 * Повторный запуск --send письмо не дублирует: отметка cert_reissued в
 * partner_events.
 */
declare(strict_types=1);
define('BASE_PATH', '/var/www/muzmir');
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/partner_docs.php';
require_once BASE_PATH . '/core/outreach_window.php';

$send  = in_array('--send', $argv, true);
$force = in_array('--force-window', $argv, true);
if (!$send && !in_array('--check', $argv, true)) {
    fwrite(STDERR, "укажи --check или --send\n");
    exit(2);
}
$only = 0;
foreach ($argv as $a) if (preg_match('~^--only=(\d+)$~', $a, $m)) $only = (int) $m[1];

if ($send && !outreach_window_guard($force)) exit(0);

/** Текст бланка обратно из PDF — единственный способ убедиться, что он свой. */
function cert_text(string $pdf): string {
    $out = [];
    @exec('pdftotext ' . escapeshellarg($pdf) . ' - 2>/dev/null', $out);
    return preg_replace('~\s+~u', ' ', implode(' ', $out)) ?? '';
}

$sql = "SELECT * FROM institutions WHERE partner_status='accepted'";
$par = [];
if ($only > 0) { $sql .= " AND id=?"; $par[] = $only; }
$sql .= " ORDER BY partner_accepted_at";
$rows = q($sql, $par)->fetchAll(PDO::FETCH_ASSOC);
echo "партнёров: " . count($rows) . ($send ? "  (режим отправки)" : "  (только проверка)") . "\n";

$base = rtrim((string) cfgv('base_url', ''), '/');
$okCnt = $badCnt = $sentCnt = $skipCnt = 0;

foreach ($rows as $inst) {
    $id    = (int) $inst['id'];
    $no    = (string) $inst['partner_no'];
    $name  = (string) $inst['name'];
    $email = trim((string) $inst['email']);
    printf("\n[%6d] %-14s %s\n", $id, $no, mb_substr($name, 0, 50));

    /* Старый общий бланк — убрать, чтобы он ни при каких условиях не всплыл. */
    $stale = BASE_PATH . '/public/diplomas/partner_cert_' . preg_replace('~[^0-9a-zA-Z]~', '-', $no) . '.pdf';
    if (is_file($stale)) @unlink($stale);

    $pdf = partner_cert_pdf($id, true);
    if (!$pdf || !is_file($pdf)) { echo "  БЛАНК НЕ СОБРАЛСЯ\n"; $badCnt++; continue; }

    /* Сверка: наименование сравниваем по первым словам — в PDF буквы разрежены
       межбуквенными пробелами только в заголовках, но название печатается
       обычным начертанием. Номер обязан совпасть точно.
       Кавычки, пробелы и знаки отбрасываем С ОБЕИХ сторон: pdftotext переставляет
       вертикальную черту и по-своему расставляет пробелы у кавычек, и сверка
       ругалась на совершенно правильные бланки («МБУ «ЦИКиД»» и ещё три). */
    $flat  = static fn(string $s): string => (string) preg_replace('~[^\p{L}\p{N}]+~u', '', mb_strtolower($s));
    $txt   = cert_text($pdf);
    $probe = mb_substr($flat($name), 0, 16);
    $nameOk = $probe === '' || mb_strpos($flat($txt), $probe) !== false;
    $noOk   = $txt === '' || mb_strpos($flat($txt), $flat($no)) !== false;
    printf("  %s  %s  наим.%s номер%s\n", basename($pdf), number_format(filesize($pdf)),
        $nameOk ? '+' : ' НЕТ', $noOk ? '+' : ' НЕТ');
    if (!$nameOk || !$noOk) {
        echo "  БЛАНК НЕ ПРОШЁЛ СВЕРКУ, письмо не уйдёт\n";
        if ($txt !== '') echo "  в бланке: " . mb_substr($txt, 0, 200) . "\n";
        $badCnt++;
        continue;
    }
    $okCnt++;

    /* Реестр проверки подлинности — на новый номер. */
    try {
        q("DELETE FROM partner_docs WHERE institution_id=? AND kind='cert'", [$id]);
        q("INSERT OR REPLACE INTO partner_docs (number, kind, institution_id, org, region, fio, issued_at, valid_until)
           VALUES (?, 'cert', ?, ?, ?, '', ?, ?)",
          [$no, $id, $name, (string) $inst['region'],
           (string) ($inst['partner_accepted_at'] ?: date('Y-m-d H:i:s')),
           date('Y-m-d H:i:s', strtotime((string) ($inst['partner_accepted_at'] ?: 'now')) + 365 * 86400)]);
    } catch (\Throwable $e) { echo "  реестр: " . $e->getMessage() . "\n"; }

    if (!$send) continue;
    if ($email === '') { echo "  адреса нет\n"; $skipCnt++; continue; }
    try {
        if (one("SELECT id FROM partner_events WHERE institution_id=? AND kind='cert_reissued'", [$id])) {
            echo "  замена уже высылалась\n"; $skipCnt++; continue;
        }
    } catch (\Throwable $e) {}

    $link   = $base . '/p/' . rawurlencode((string) $inst['partner_slug']);
    $verify = partner_verify_url($no);
    $body = '<div style="font:15px Arial,sans-serif;line-height:1.65;max-width:640px;padding:24px;color:#2A1E06">
<div style="text-align:center;margin-bottom:16px"><img src="' . $base . '/assets/img/logo_muzmir_256.png" width="70" alt=""></div>
<h2 style="color:#8A6512;font-family:Georgia,serif;margin:0 0 6px;text-align:center">Исправленный сертификат партнёра</h2>
<p style="text-align:center;color:#666;margin:0 0 22px">Партнёрство № ' . h($no) . '</p>
<p>Уважаемые коллеги!</p>
<p>Приносим извинения: в письме, которым мы подтвердили статус информационного
партнёра для <b>' . h($name) . '</b>, к сообщению по нашей технической ошибке был
приложен бланк с неверным наименованием и служебным номером. Просим тот файл
не использовать.</p>
<p>Правильный сертификат — в приложении к этому письму. За учреждением закреплён
постоянный номер партнёрства <b>' . h($no) . '</b>; он же указан на бланке и по нему
всегда можно подтвердить подлинность документа:<br>
<a href="' . h($verify) . '">' . h($verify) . '</a></p>
<p>Все остальные условия партнёрства прежние. Постоянная ссылка учреждения не
менялась:<br><a href="' . $link . '">' . h($link) . '</a></p>
<p>Доступ в кабинет партнёра тоже прежний — логин <b>' . h($email) . '</b>, пароль из
первого письма. Если пароль потерялся, восстановить его можно на странице входа
<a href="' . $base . '/partner?a=login">' . h($base) . '/partner</a>.</p>
<p style="margin-top:22px">С уважением,<br>Оргкомитет Культурного центра «Музыкальный Мир»<br>'
. h((string) cfgv('org_phone', '')) . ' · ' . h((string) cfgv('org_email', '')) . '</p>
<hr style="border:none;border-top:1px solid #E9CE84;margin:24px 0 12px">
<p style="font-size:11px;color:#999;text-align:center">' . h((string) cfgv('org_reg', '')) . '</p>
</div>';

    $ok = (bool) mail_send_failover($email,
        'Исправленный сертификат информационного партнёра № ' . $no,
        $body, ['pool' => 'awards', 'attach' => [$pdf]]);
    if ($ok) {
        $sentCnt++;
        echo "  письмо ушло: $email\n";
        partner_log_event($id, 'cert_reissued', json_encode(['no' => $no, 'file' => basename($pdf)], JSON_UNESCAPED_UNICODE));
    } else {
        echo "  ПИСЬМО НЕ УШЛО: " . (function_exists('mail_last_error') ? mail_last_error() : '') . "\n";
    }
}

echo "\nитог: бланков верных $okCnt, с ошибкой $badCnt, писем отправлено $sentCnt, пропущено $skipCnt\n";
