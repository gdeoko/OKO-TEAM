<?php
/**
 * ПРИЁМ ОТВЕТОВ ВЕДОМСТВ — ПИСЬМА ПОДДЕРЖКИ САМИ ПОПАДАЮТ НА САЙТ.
 *
 * После рассылки обращений ведомства отвечают на официальную почту центра.
 * Ответ — это, как правило, скан письма на фирменном бланке: именно он и должен
 * оказаться в разделе «Поддержка» на сайте, где родители и педагоги видят, кто
 * конкурс поддерживает. Раньше это делалось руками и поэтому не делалось.
 *
 * Что делает крон:
 *   1) читает входящие официальной почты по IMAP;
 *   2) оставляет только письма с адресов из базы ведомств;
 *   3) вынимает вложения (скан или PDF), PDF превращает в картинку первой
 *      страницы — галерея на сайте показывает изображения;
 *   4) кладёт письмо в раздел «Поддержка» и отмечает ведомство ответившим;
 *   5) сообщает владельцу в Телеграм и готовит пост во ВКонтакте.
 *
 * Крон-строка (раз в час):
 *   5 * * * * php /var/www/muzmir/cron/ministry_replies.php
 *
 * Вручную:
 *   php cron/ministry_replies.php         — обычный прогон
 *   php cron/ministry_replies.php dry     — только показать, что нашлось
 *   php cron/ministry_replies.php days 30 — искать за последние 30 дней
 *
 * НОВОЕ ПИСЬМО ПУБЛИКУЕТСЯ ПЕРВЫМ. Владелец просил, чтобы свежая поддержка
 * всегда была сверху: дата письма пишется в letter_date, а галерея сортируется
 * по ней по убыванию.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/imap_read.php';
require_once BASE_PATH . '/core/ministries.php';
require_once BASE_PATH . '/core/letter_texts.php';
require_once BASE_PATH . '/core/ministry_reply.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'ministry_replies';

$mode = strtolower(trim((string) ($argv[1] ?? '')));
$days = $mode === 'days' ? max(1, (int) ($argv[2] ?? 14)) : 14;
$dry  = $mode === 'dry';

function mr_log(string $s): void { cron_log('ministry_replies', $s); echo $s . "\n"; }



if (!cron_lock(JOB, 900)) { echo "предыдущий прогон ещё идёт\n"; exit(0); }
register_shutdown_function(static function () { cron_unlock(JOB); });

min_migrate();
try { db()->exec("ALTER TABLE ministry_letters ADD COLUMN letter_date TEXT"); } catch (\Throwable $e) {}
// Откуда письмо пришло и какой у него файл — чтобы одно и то же письмо не
// попало в галерею дважды и чтобы было видно, чей это ответ.
foreach (["ALTER TABLE ministry_letters ADD COLUMN source_email TEXT DEFAULT ''",
          "ALTER TABLE ministry_letters ADD COLUMN file_path TEXT DEFAULT ''",
          "ALTER TABLE ministry_letters ADD COLUMN msg_key TEXT DEFAULT ''"] as $sql) {
    try { db()->exec($sql); } catch (\Throwable $e) {}
}

/* ── Учётные данные официальной почты ─────────────────────────────────────
 *
 * ЧИТАЕМ ТОТ ЯЩИК, С КОТОРОГО ПИСАЛИ. Обращения уходят с kc@музыкальный-мир.рф
 * (пул official), туда же ведомства и отвечают — адрес для ответа назван в самом
 * документе. Здесь же стояло cfgv('smtp_user'), то есть Gmail администраторов, и
 * IMAP-хост выводился из smtp_host как imap.gmail.com. Разбор ходил в чужой
 * ящик: ответы ведомств лежали бы в kc@ непрочитанными, поддержка не попадала бы
 * на сайт, отказы не вычёркивались, а мёртвые адреса оставались в базе.
 * Обнаружено сразу после первой рассылки 220 обращений, 14.08.2026.
 */
$acc = function_exists('mail_account_by_name') ? mail_account_by_name('kc') : [];
$user = trim((string) ($acc['user'] ?? ''));
$pass = trim((string) ($acc['pass'] ?? ''));
$smtpHost = (string) ($acc['host'] ?? '');

// Запасной путь — общие настройки, если ящик official почему-то не заведён.
if ($user === '' || $pass === '') {
    $user = trim((string) cfgv('smtp_user', ''));
    $pass = trim((string) cfgv('smtp_pass', ''));
    $smtpHost = (string) cfgv('smtp_host', 'smtp.gmail.com');
    if ($user !== '') mr_log('ВНИМАНИЕ: ящик official не настроен, читаем общий — ответы ведомств могут быть не здесь');
}
if ($user === '' || $pass === '') { mr_log('нет учётных данных официальной почты — пропуск'); exit(0); }

// Хост IMAP выводим из SMTP: у Яндекса это imap.yandex.ru, у Gmail imap.gmail.com.
$imapHost = trim((string) cfgv('imap_official_host', ''));
if ($imapHost === '') $imapHost = str_ireplace('smtp.', 'imap.', $smtpHost);

mr_log('читаем ящик ' . $user . ' на ' . $imapHost);
$acc = ['host' => $imapHost, 'port' => (int) (cfgv('imap_port', 0) ?: 993), 'user' => $user, 'pass' => $pass];

/* ── Кого слушаем ───────────────────────────────────────────────────────── */
// Строку берём целиком: из неё готовятся и благодарность на бланке (ФИО,
// должность), и тема ответа со ссылкой на наш исходящий номер. С коротким
// списком колонок last_number и person были всегда пустыми, и официальные ответы
// уходили безымянными и без «(к исх. №...)».
$known = [];
foreach (all("SELECT * FROM ministries WHERE email<>''") as $r) {
    $known[mb_strtolower((string) $r['email'])] = $r;
}
if (!$known) { mr_log('база ведомств пуста — слушать некого'); exit(0); }

$since = date('d-M-Y', time() - $days * 86400);
$ids = im_search($acc, 'SINCE ' . $since);
if (!$ids) { mr_log("писем за последние $days дн. не найдено (или IMAP недоступен)"); exit(0); }

// Свежие письма важнее: если ящик большой, за один прогон берём последние 60.
rsort($ids);
$ids = array_slice($ids, 0, 60);

$dir = BASE_PATH . '/public/uploads/ministry';
if (!is_dir($dir)) @mkdir($dir, 0775, true);

$added = 0; $seen = 0; $replies = 0;

foreach ($ids as $id) {
    $raw = im_fetch($acc, $id);
    if (trim($raw) === '') continue;

    $m = im_parse($raw);
    $from = (string) $m['from'];

    /* УВЕДОМЛЕНИЕ О НЕДОСТАВКЕ.
     *
     * Его пишет почтовый сервер, а не ведомство: адрес отправителя —
     * MAILER-DAEMON или postmaster, и по фильтру «письмо от известного
     * ведомства» такое уведомление не проходило вовсе. Адрес, который не принял
     * письмо, спрятан внутри текста — достаём его оттуда и вычёркиваем.
     */
    if (mrep_is_daemon($from, (string) $m['subject'])) {
        // Вычёркиваем только при постоянном отказе: «нет такого адресата».
        // Переполненный ящик, петля пересылки и прочие временные беды — не повод
        // терять ведомство навсегда, письмо просто уйдёт в следующий раз.
        $perm = mrep_bounce_is_permanent($raw);
        foreach (mrep_bounced_addresses($raw, $known) as $deadMail) {
            $org = (string) ($known[$deadMail]['org'] ?? '');
            if ($perm) {
                if (mrep_mark_bounced($deadMail, 'адресата не существует, ' . date('d.m.Y'))) {
                    mr_log('адресата не существует, вычеркнут: ' . $deadMail . ' (' . $org . ')');
                    $replies++;
                }
            } else {
                mr_log('письмо не доставлено, но адрес живой — оставляем в работе: ' . $deadMail . ' (' . $org . ')');
            }
        }
        continue;
    }

    // ОТВЕТ С СОСЕДНЕГО АДРЕСА ТОГО ЖЕ ВЕДОМСТВА.
    // Департамент культуры ЯНАО ответил с codify@yanao.ru на письмо, ушедшее на
    // depcul@yanao.ru: у крупных органов входящие регистрирует отдельная система
    // со своим адресом. Строгое сравнение такой ответ теряло — он не попадал ни в
    // разбор, ни в счётчик ответивших. Домены общих почтовых служб (mail.ru и
    // прочие) сюда не годятся: там за одним доменом тысячи чужих людей.
    if ($from !== '' && !isset($known[$from]) && str_contains($from, '@')) {
        $dom = substr($from, strpos($from, '@') + 1);
        if ($dom !== '' && !preg_match('~^(mail|gmail|yandex|bk|list|inbox|rambler|ya|mail\.ru)\.~i', $dom)) {
            foreach ($known as $km => $kr) {
                if (str_ends_with($km, '@' . $dom)) {
                    $known[$from] = $kr;
                    mr_log('ответ с соседнего адреса ведомства: ' . $from . ' → ' . (string) $kr['org']);
                    break;
                }
            }
        }
    }
    if ($from === '' || !isset($known[$from])) continue;      // не ведомство — не наше дело

    $seen++;
    $org    = (string) $known[$from]['org'];
    $region = (string) $known[$from]['region'];

    // Ключ письма: адрес + тема + дата. По нему письмо не попадёт в галерею
    // дважды, даже если крон прочитает ящик десять раз.
    $key = substr(sha1($from . '|' . $m['subject'] . '|' . $m['date']), 0, 24);
    // ПРОВЕРЯЕМ ОБА ЖУРНАЛА.
    //
    // Здесь смотрели только в галерею писем поддержки (ministry_letters), а туда
    // попадает лишь одобрение. Квитанция «обращение зарегистрировано» в галерею
    // не идёт — и каждый прогон крона (а он раз в пять минут) заводил по ней новую
    // строку разбора. Три ведомства превратились в четырнадцать «ответов», и
    // сводка по статусам врала бы ровно во столько же раз.
    mrep_migrate();
    $dup = (int) scalar("SELECT COUNT(*) FROM ministry_letters WHERE msg_key=?", [$key])
         + (int) scalar("SELECT COUNT(*) FROM ministry_replies WHERE msg_key=?", [$key]);
    if ($dup > 0) continue;

    $isUnsub = (bool) preg_match('~^\s*отписать~u', mb_strtolower((string) $m['text']));

    /* ЧТО НАМ ОТВЕТИЛИ.
     *
     * Решение органа власти живёт в приложенном документе на бланке, а не в теле
     * письма: в теле бывает «направляем ответ» или автоответчик об отпуске.
     * Поэтому разбирается всё письмо целиком — тело плюс вложения, включая
     * сканы без текстового слоя. Прежняя проверка искала «не имеем возможности»
     * в теле и одинаково срабатывала на отказе, на квитанции о регистрации и на
     * автоответе.
     */
    $verdict = mrep_classify((string) $m['subject'], (string) $m['text'], (array) $m['attachments']);
    $isRefusal = $verdict['verdict'] === 'refusal';
    $isSupport = $verdict['verdict'] === 'support';

    if ($dry) {
        mr_log(sprintf('  [%s] %s — «%s», вложений %d → %s (%s): %s', $m['date'], $org,
            mb_substr((string) $m['subject'], 0, 50), count($m['attachments']),
            $verdict['verdict'], $verdict['by'], mb_substr((string) $verdict['reason'], 0, 70)));
        continue;
    }

    if ($isUnsub) { min_unsubscribe($from); $replies++; continue; }

    /* ТРЕБУЮТ ЭЛЕКТРОННУЮ ПРИЁМНУЮ — ВЫЧЁРКИВАЕМ И БОЛЬШЕ НЕ ПИШЕМ.
     *
     * Решение владельца от 14.08.2026: центр работает с теми, кто принимает
     * обращения почтой. Подача через форму или портал госуслуг требует ручного
     * входа под учётной записью организации, на две с лишним сотни ведомств это
     * не масштабируется, а держать постоянный доступ к госпорталу ради
     * одного-двух писем незачем.
     *
     * Ответ такому ведомству не отправляем: отвечать не на что, решения по
     * существу нам не выносили. Адрес формы, если он назван в письме, оседает в
     * карточке — на случай, если к этим ведомствам когда-нибудь вернёмся.
     */
    if ($verdict['verdict'] === 'eform') {
        $formUrl = function_exists('mrep_form_url') ? mrep_form_url((string) $m['text']) : '';
        mrep_mark_eform($from, $formUrl, (string) $verdict['reason']);
        mr_log('принимает только через электронную приёмную, исключено: ' . $from . ' (' . $org . ')'
             . ($formUrl !== '' ? ' — форма: ' . $formUrl : ''));
        $replies++;
        continue;
    }

    // След разбора: по нему потом видно, почему центр ответил именно так.
    mrep_migrate();
    try {
        insert('ministry_replies', [
            'ministry_id' => (int) ($known[$from]['id'] ?? 0),
            'email' => $from, 'org' => $org,
            'subject' => (string) $m['subject'],
            'excerpt' => mb_substr(trim((string) $m['text']), 0, 500),
            'verdict' => (string) $verdict['verdict'],
            'reason'  => (string) $verdict['reason'],
            'fixed_fio' => (string) ($verdict['fio'] ?? ''),
            'msg_key' => $key,
            // Дата письма ведомства, а не момент разбора: в сводке важно, когда
            // ответили они. Пустая колонка делала сводку по датам бесполезной.
            'answered_at' => (string) ($m['date'] ?? date('Y-m-d H:i:s')),
            'answer_kind' => (string) ($m['attachments'] ? 'с вложением' : 'только текст'),
        ]);
    } catch (\Throwable $e) {}

    // Квитанция о регистрации и автоответчик — ещё не ответ. Ведомство остаётся
    // в работе и ждёт настоящего решения, отвечать тут нечего.
    if (in_array($verdict['verdict'], ['receipt', 'bounce'], true)) { $replies++; continue; }

    // Не разобрали — зовём человека и ничего не решаем сами.
    if ($verdict['verdict'] === 'other') {
        $replies++;
        if (is_file(BASE_PATH . '/core/notify_owner.php')) {
            require_once BASE_PATH . '/core/notify_owner.php';
            if (function_exists('owner_tg_send')) {
                try {
                    owner_tg_send('analytics', '<b>Ответ ведомства не разобран</b>' . "\n" . h($org)
                        . "\n«" . h(mb_substr((string) $m['subject'], 0, 80)) . '»'
                        . "\n" . h(mb_substr(trim((string) $m['text']), 0, 300))
                        . "\n\nРешение примите сами: автоматика по нему ничего не делает.");
                } catch (\Throwable $e) {}
            }
        }
        continue;
    }

    // Просят переоформить: правим адресата и шлём обращение заново.
    if ($verdict['verdict'] === 'fix') {
        $replies++;
        $newFio = trim((string) ($verdict['fio'] ?? ''));
        if ($newFio !== '') mrep_fix_person($from, $newFio);
        if (mrep_enabled()) {
            $ans = mrep_reply_fix($known[$from], $newFio, (string) ($known[$from]['last_number'] ?? ''));
            // Тот же дедуп, что и у благодарности: ведомство часто отвечает дважды,
            // и второй наш ответ на тот же вопрос выглядит как сбой автоматики.
            if (!mrep_already_sent($from, (int) ($known[$from]['id'] ?? 0), $ans['subject'])) {
                mrep_queue_official($from, $org, $ans['subject'], $ans['html']);
            }
        }
        mr_log('просят переоформить: ' . $org . ($newFio !== '' ? ' → ' . $newFio : ' (ФИО не назвали)'));
        continue;
    }

    $minId = (int) ($known[$from]['id'] ?? 0);
    min_mark_replied($from, $isRefusal ? 'declined' : 'supported', $minId);
    try {
        // Реестр обращений закрываем и по адресу ответа, и по тому, на который мы
        // писали: ответ приходит с соседнего ящика ведомства, а запись обращения
        // заведена на прежний адрес — по одному адресу она так и висела «отправлено».
        $addrs = array_unique(array_filter([$from, mb_strtolower(trim((string) ($known[$from]['email'] ?? '')))]));
        foreach ($addrs as $addr) {
            q("UPDATE official_letters SET status=?, replied_at=datetime('now','localtime')
                WHERE LOWER(email)=? AND kind='support' AND status IN ('sent','queued')",
              [$isRefusal ? 'declined' : 'replied', $addr]);
        }
    } catch (\Throwable $e) {}
    $replies++;

    if ($isRefusal) {
        // Отказ: вычёркиваем навсегда и отвечаем коротко. В галерею не идёт.
        mrep_mark_declined($from, (string) $verdict['reason']);
        if (mrep_enabled()) {
            $ans = mrep_reply_refusal($known[$from], (string) ($known[$from]['last_number'] ?? ''));
            if (!mrep_already_sent($from, (int) ($known[$from]['id'] ?? 0), $ans['subject'])) {
                mrep_queue_official($from, $org, $ans['subject'], $ans['html']);
            }
        }
        mr_log('отказ, ведомство больше не пишем: ' . $org);
        continue;
    }

    /* ── Скан письма ────────────────────────────────────────────────────── */
    $imgRel = ''; $fileRel = '';
    foreach ($m['attachments'] as $a) {
        $name = (string) $a['name'];
        $ext  = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
        if (!in_array($ext, ['pdf', 'jpg', 'jpeg', 'png'], true)) continue;
        if (strlen((string) $a['data']) > 20 * 1024 * 1024) continue;

        $stem = 'ml_' . $key . '_' . substr(sha1($name), 0, 6);
        $abs  = $dir . '/' . $stem . '.' . $ext;
        if (@file_put_contents($abs, $a['data']) === false) continue;
        @chmod($abs, 0664);
        $fileRel = 'uploads/ministry/' . basename($abs);

        if ($ext === 'pdf') {
            // Галерея показывает картинки. Первая страница письма — это и есть
            // бланк с гербом и подписью, ради которого всё затевалось.
            $jpg = $dir . '/' . $stem . '.jpg';
            @exec('pdftoppm -jpeg -r 130 -f 1 -l 1 -singlefile ' . escapeshellarg($abs)
                  . ' ' . escapeshellarg($dir . '/' . $stem) . ' 2>/dev/null');
            if (is_file($jpg)) { @chmod($jpg, 0664); $imgRel = 'uploads/ministry/' . basename($jpg); }
        } else {
            $imgRel = $fileRel;
        }
        if ($imgRel !== '') break;                            // одного скана достаточно
    }

    try {
        insert('ministry_letters', [
            'region'       => $region !== '' ? $region : $org,
            'title'        => $org,
            'image_path'   => $imgRel,
            'file_path'    => $fileRel,
            'source_email' => $from,
            'msg_key'      => $key,
            'letter_date'  => substr((string) $m['date'], 0, 10),
            'sort'         => 0,
        ]);
        $added++;
    } catch (\Throwable $e) {
        mr_log('не удалось записать письмо: ' . $e->getMessage());
        continue;
    }

    /* ── БЛАГОДАРНОСТЬ ЗА ПОДДЕРЖКУ ──────────────────────────────────────
     *
     * Ведомство поддержало — центр отвечает письмом и прикладывает именную
     * благодарность на бланке. Имя берётся из той же строки базы, что стояла в
     * адресате обращения: человек, которому писали, и человек, которого
     * благодарим, — один и тот же.
     *
     * Документ печатает браузер на бастионе, это не мгновенно; если печать не
     * удалась, письмо всё равно уходит — благодарность без вложения лучше, чем
     * молчание в ответ на поддержку.
     */
    // ОДНО ВЕДОМСТВО — ОДНА БЛАГОДАРНОСТЬ. Ведомство присылает два письма подряд
    // или отвечает сразу на два наших ящика — до этой проверки крон благодарил
    // столько же раз, сколько писем прочитал.
    if (mrep_enabled() && mrep_already_thanked($from, $minId)) {
        mr_log('благодарность уже уходила, второй раз не пишем: ' . $org);
    } elseif (mrep_enabled()) {
        $files = [];
        try {
            $thanks = mrep_thanks_pdf($known[$from]);
            if ($thanks) $files[] = $thanks;
        } catch (\Throwable $e) {}
        $ans = mrep_reply_support($known[$from], (string) ($known[$from]['last_number'] ?? ''));
        mrep_queue_official($from, $org, $ans['subject'], $ans['html'], $files);
        mr_log('поддержка: ' . $org . ($files ? ' — благодарность приложена' : ' — БЕЗ документа, печать не удалась'));
    }

    /* ── Владельцу и во ВКонтакте ───────────────────────────────────────── */
    if (is_file(BASE_PATH . '/core/notify_owner.php')) {
        require_once BASE_PATH . '/core/notify_owner.php';
        if (function_exists('owner_tg_send')) {
            try {
                owner_tg_send('analytics', '<b>Письмо поддержки</b>' . "\n" . h($org)
                    . ($imgRel === '' ? "\n(скан не распознан — вложите вручную)" : "\nОпубликовано в разделе «Поддержка»"));
            } catch (\Throwable $e) {}
        }
    }

    // Пост во ВКонтакте готовим ЧЕРНОВИКОМ и не публикуем сами. Сообщение
    // «нас поддержало такое-то министерство» — публичное заявление от имени
    // ведомства, и решение о публикации остаётся за владельцем: в админке оно
    // отправляется одной кнопкой.
    min_posts_migrate();
    try {
        insert('ministry_posts', [
            'letter_email' => $from,
            'org'          => $org,
            'text'         => 'Наши конкурсы поддерживает ' . $org . '.' . "\n\n"
                            . 'Письмо поддержки опубликовано на сайте центра в разделе «Поддержка»: '
                            . rtrim((string) cfgv('base_url', ''), '/') . '/ministry-support',
            'image_path'   => $imgRel,
            'status'       => 'draft',
        ]);
    } catch (\Throwable $e) {}
}


mr_log(sprintf('ответы ведомств: просмотрено писем %d, от ведомств %d, ответов учтено %d, писем поддержки добавлено %d',
    count($ids), $seen, $replies, $added));
