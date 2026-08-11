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

/* ── Учётные данные официальной почты ───────────────────────────────────── */
$user = trim((string) cfgv('smtp_user', ''));
$pass = trim((string) cfgv('smtp_pass', ''));
if ($user === '' || $pass === '') { mr_log('нет учётных данных официальной почты — пропуск'); exit(0); }

// Хост IMAP выводим из SMTP: у Gmail это imap.gmail.com, у Яндекса imap.yandex.ru.
$smtpHost = (string) cfgv('smtp_host', 'smtp.gmail.com');
$imapHost = trim((string) cfgv('imap_official_host', ''));
if ($imapHost === '') $imapHost = str_ireplace('smtp.', 'imap.', $smtpHost);

$acc = ['host' => $imapHost, 'port' => (int) (cfgv('imap_port', 0) ?: 993), 'user' => $user, 'pass' => $pass];

/* ── Кого слушаем ───────────────────────────────────────────────────────── */
$known = [];
foreach (all("SELECT id, email, org, region FROM ministries WHERE email<>''") as $r) {
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
    if ($from === '' || !isset($known[$from])) continue;      // не ведомство — не наше дело

    $seen++;
    $org    = (string) $known[$from]['org'];
    $region = (string) $known[$from]['region'];

    // Ключ письма: адрес + тема + дата. По нему письмо не попадёт в галерею
    // дважды, даже если крон прочитает ящик десять раз.
    $key = substr(sha1($from . '|' . $m['subject'] . '|' . $m['date']), 0, 24);
    if ((int) scalar("SELECT COUNT(*) FROM ministry_letters WHERE msg_key=?", [$key]) > 0) continue;

    // Отказ отличаем от поддержки по тексту: «не имеем возможности», «отказ».
    $txt = mb_strtolower((string) $m['text']);
    $isRefusal = (bool) preg_match('~не\s+(?:имеем|представляется|можем)|отказ|отклонен~u', $txt);
    $isUnsub   = (bool) preg_match('~^\s*отписать~u', $txt);

    if ($dry) {
        mr_log(sprintf('  [%s] %s — «%s», вложений %d%s', $m['date'], $org,
            mb_substr((string) $m['subject'], 0, 60), count($m['attachments']),
            $isRefusal ? ' (похоже на отказ)' : ''));
        continue;
    }

    if ($isUnsub) { min_unsubscribe($from); $replies++; continue; }

    min_mark_replied($from, $isRefusal ? 'declined' : 'supported');
    try {
        q("UPDATE official_letters SET status=?, replied_at=datetime('now') WHERE email=? AND kind='support'",
          [$isRefusal ? 'declined' : 'replied', $from]);
    } catch (\Throwable $e) {}
    $replies++;
    if ($isRefusal) continue;                                  // отказ в галерею не идёт

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
