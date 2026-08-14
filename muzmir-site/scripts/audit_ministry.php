<?php
/**
 * ПРЕДПОЛЁТНАЯ ПРОВЕРКА РАССЫЛКИ ПО ВЕДОМСТВАМ.
 *
 * Один прогон отвечает на вопрос «можно ли запускать». Проверяются данные,
 * документы, отправитель, темп, стоп-краны, разбор ответов и место на диске.
 * Ничего не отправляет и ничего не меняет.
 *
 *   php scripts/audit_ministry.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'data', 'helpers', 'mailer', 'ministries', 'letter_texts', 'letter_mail',
          'ministry_mailing', 'ministry_reply', 'official_letter', 'chat_brain'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}

$ok = 0; $warn = 0; $bad = 0;
$say = static function (string $state, string $what, string $detail = '') use (&$ok, &$warn, &$bad): void {
    $mark = ['ok' => '  [ok]', 'warn' => '  [!] ', 'bad' => '  [!!]'][$state];
    if ($state === 'ok') { $GLOBALS['__ok']++; } elseif ($state === 'warn') { $GLOBALS['__warn']++; } else { $GLOBALS['__bad']++; }
    printf("%s %-46s %s\n", $mark, $what, $detail);
};
$GLOBALS['__ok'] = 0; $GLOBALS['__warn'] = 0; $GLOBALS['__bad'] = 0;

echo "ПРЕДПОЛЁТНАЯ ПРОВЕРКА · " . date('d.m.Y H:i') . "\n" . str_repeat('=', 78) . "\n\n";

/* ── 1. Адресаты ──────────────────────────────────────────────────────── */
echo "1. АДРЕСАТЫ\n";
$rows = min_recipients();
$n = count($rows);
$say($n > 0 ? 'ok' : 'bad', 'готовых к отправке', (string) $n);

$byKind = []; $noFio = 0; $badMail = 0; $notDative = 0; $seenFio = [];
foreach ($rows as $r) {
    $byKind[(string) $r['kind']] = ($byKind[(string) $r['kind']] ?? 0) + 1;
    $isPress = (string) ($r['branch'] ?? 'main') === 'press';
    if (!$isPress && trim((string) $r['person']) === '') $noFio++;
    if (!filter_var((string) $r['email'], FILTER_VALIDATE_EMAIL)) $badMail++;
    if (!$isPress) {
        $head = mb_strtolower((string) (explode(' ', trim((string) $r['person_role']))[0] ?? ''));
        if ($head !== '' && !preg_match('~(у|ю|е|ой|ей|ому|ему)$~u', $head)
            && !preg_match('~^(временно|врио|и\.о\.)$~u', $head)) $notDative++;
        $k = mb_strtolower(preg_replace('~[^а-яёa-z]+~ui', '', (string) $r['person']) ?? '');
        if ($k !== '') $seenFio[$k] = ($seenFio[$k] ?? 0) + 1;
    }
}
$dups = count(array_filter($seenFio, static fn($c) => $c > 1));
$say($noFio === 0 ? 'ok' : 'bad', 'без ФИО (письма не будет)', (string) $noFio);
$say($badMail === 0 ? 'ok' : 'bad', 'кривых адресов', (string) $badMail);
$say($notDative === 0 ? 'ok' : 'bad', 'должность не в дательном падеже', (string) $notDative);
$say($dups === 0 ? 'ok' : 'bad', 'один человек получит два письма', (string) $dups);
echo '       по видам: ';
foreach ($byKind as $k => $v) echo "$k $v · ";
echo "\n";

$stale = 0;
foreach ($rows as $r) if (!min_is_verified($r) && (string) ($r['branch'] ?? '') !== 'press') $stale++;
$say($stale === 0 ? 'ok' : 'bad', 'просроченная сверка', (string) $stale);

/* ── 2. Что уходит ────────────────────────────────────────────────────── */
echo "\n2. ПИСЬМО И ВЛОЖЕНИЯ\n";
$free = ol_comps(true);
$say($free ? 'ok' : 'bad', 'бесплатных конкурсов в письме', (string) count($free));
foreach ($free as $c) echo '       ' . $c['name'] . ' — приём до ' . $c['end_date'] . "\n";

$att = $free ? mm_attachments($free) : [];
$say(count($att) >= 3 ? 'ok' : 'warn', 'приложений помимо бланка', (string) count($att));
foreach ($att as $f) echo '       ' . basename($f) . ' · ' . round(filesize($f) / 1024) . " КБ\n";

if ($rows) {
    $probe = lm_mail_support($rows[0], 'ПРОВЕРКА', $free);
    $pdf = (string) ($probe['pdf'] ?? '');
    $say($pdf !== '' && is_file($pdf) ? 'ok' : 'bad', 'бланк обращения собирается',
         $pdf !== '' && is_file($pdf) ? round(filesize($pdf) / 1024) . ' КБ' : 'НЕ СОБРАЛСЯ');
    $size = array_sum(array_map('filesize', array_filter(array_merge([$pdf], $att), 'is_file')));
    $say($size < 20 * 1024 * 1024 ? 'ok' : 'bad', 'вес письма', round($size / 1048576, 1) . ' МБ');
}

/* ── 3. Отправитель ───────────────────────────────────────────────────── */
echo "\n3. ОТПРАВИТЕЛЬ И ТЕМП\n";
$pool = mail_pool_names('official');
$say($pool === ['kc'] ? 'ok' : 'bad', 'пул official', implode(', ', $pool));
$acc = mail_account_by_name('kc');
$say($acc ? 'ok' : 'bad', 'ящик kc настроен', (string) ($acc['from_addr'] ?? 'НЕТ'));
$say(str_contains(mb_strtolower(ol_reply_email()), 'музыкальный-мир') ? 'ok' : 'bad',
     'адрес для ответа', ol_reply_email());
$per = max(1, (int) cfgv('official_per_minute', 5));
$say($per <= 10 ? 'ok' : 'warn', 'писем в минуту', $per . ' → всё уйдёт за ' . ceil($n / $per) . ' мин');

/* ── 4. Стоп-краны ────────────────────────────────────────────────────── */
echo "\n4. СТОП-КРАНЫ\n";
$say(mm_enabled() ? 'warn' : 'ok', 'автоотправка обращений 1-го числа',
     mm_enabled() ? 'ВКЛЮЧЕНА' : 'опущена (штатно до вашей команды)');
$say(mrep_enabled() ? 'warn' : 'ok', 'автоответы ведомствам',
     mrep_enabled() ? 'ВКЛЮЧЕНЫ' : 'опущены (штатно до вашей команды)');

/* ── 5. Разбор ответов ────────────────────────────────────────────────── */
echo "\n5. РАЗБОР ОТВЕТОВ\n";
$say(function_exists('mrep_classify') ? 'ok' : 'bad', 'модуль разбора подключён');
$noDoc = mrep_classify('Ответ', 'Конечно поддержим, разместим анонс у себя.', []);
$say($noDoc['verdict'] === 'receipt' ? 'ok' : 'bad',
     'обещание без документа не считается решением', $noDoc['verdict']);
$auto = mrep_classify('Automatic reply', 'Я в отпуске до 28 августа.', []);
$say(in_array($auto['verdict'], ['receipt', 'other'], true) ? 'ok' : 'bad',
     'автоответчик не считается решением', $auto['verdict']);
$dsn = mrep_classify('Undelivered Mail Returned to Sender', '550 5.1.1 User unknown', []);
$say($dsn['verdict'] === 'bounce' ? 'ok' : 'bad', 'недоставка распознаётся', $dsn['verdict']);
$keys = function_exists('chat_gemini_keys') ? chat_gemini_keys() : [];
$say($keys ? 'ok' : 'bad', 'ключи модели для разбора', count($keys) . ' шт.');
$say(trim((string) shell_exec('command -v pdftotext')) !== '' ? 'ok' : 'bad', 'чтение PDF');
$say(class_exists('ZipArchive') ? 'ok' : 'bad', 'чтение DOCX');

/* ── 6. Почта и место ─────────────────────────────────────────────────── */
echo "\n6. ИНФРАСТРУКТУРА\n";
$freeB = (float) @disk_free_space(BASE_PATH);
$totB  = (float) @disk_total_space(BASE_PATH);
$pct   = $totB > 0 ? round($freeB / $totB * 100) : 0;
$say($pct >= 15 ? 'ok' : ($pct >= 8 ? 'warn' : 'bad'), 'свободно на диске',
     round($freeB / 1073741824, 1) . ' ГБ (' . $pct . '%)');
$q = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND COALESCE(campaign_type,'')='official'");
$say($q === 0 ? 'ok' : 'warn', 'обращений уже в очереди', (string) $q);
$sentSeason = (int) scalar("SELECT COUNT(*) FROM official_letters WHERE kind='support' AND season=?", [date('Y-m')]);
$say('ok', 'обращений отправлено в этом месяце', (string) $sentSeason);

echo "\n" . str_repeat('=', 78) . "\n";
printf("ИТОГ: в порядке %d, предупреждений %d, ошибок %d\n",
       $GLOBALS['__ok'], $GLOBALS['__warn'], $GLOBALS['__bad']);
echo $GLOBALS['__bad'] === 0
    ? "К запуску готово. Команда: php cron/ministry_letters.php send\n"
    : "ЕСТЬ ОШИБКИ — запускать нельзя.\n";
