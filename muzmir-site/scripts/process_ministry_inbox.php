<?php
/**
 * ОТВЕТЫ ВЕДОМСТВ, ПРИШЕДШИЕ НЕ НА ТОТ ЯЩИК.
 *
 * Разбор ответов (cron/ministry_replies.php) читает ящик kc@ напрямую по IMAP и
 * работает только с ним. А ведомства отвечают куда придётся: адрес центра на
 * mail.ru напечатан на старых бланках и разошёлся по справочникам, и туда за
 * месяц пришло семь ответов, которых никто не видел. Среди них — Союз театральных
 * деятелей России с готовыми ссылками на публикации, Минобразования
 * Ставропольского края и Минкультуры Северной Осетии.
 *
 * Здесь разбирается то, что уже лежит в общей таблице входящих, независимо от
 * ящика: определяется поддержка или отказ, письмо публикуется в галерее
 * /ministry-support, ведомству уходит благодарность на бланке, а во ВКонтакте
 * готовится черновик поста.
 *
 * Правило владельца соблюдается: благодарность уходит с kc@ — это переписка с
 * ведомствами, а не рассылка.
 *
 *   php scripts/process_ministry_inbox.php --dry
 *   php scripts/process_ministry_inbox.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/ministries.php';
require_once BASE_PATH . '/core/ministry_reply.php';
require_once BASE_PATH . '/core/inbox_reader.php';

$dry  = in_array('--dry', $argv, true);
$line = str_repeat('=', 78);

echo "ОТВЕТЫ ВЕДОМСТВ ИЗ ОБЩЕЙ ПОЧТЫ\n$line\n";

/* Берём всё, что похоже на ответ ведомства и ещё не разобрано по существу. */
$rows = all("SELECT * FROM inbox_messages
              WHERE is_auto = 0
                AND kind IN ('ministry_question','ministry_approve','ministry_decline','ministry_eform')
                AND COALESCE(handled_by,'') IN ('', 'skip')
              ORDER BY id ASC");
printf("  писем к разбору: %d\n\n", count($rows));

$dir = BASE_PATH . '/public/uploads/ministry';
if (!is_dir($dir)) @mkdir($dir, 0775, true);

$stat = ['поддержка' => 0, 'отказ' => 0, 'непонятно' => 0, 'в галерею' => 0, 'благодарность' => 0];

foreach ($rows as $m) {
    $id   = (int) $m['id'];
    $from = mb_strtolower(trim((string) $m['from_email']));
    $min  = one("SELECT * FROM ministries WHERE LOWER(email) = ?", [$from]);

    /* ВЕДОМСТВО ОТВЕЧАЕТ НЕ С ТОГО АДРЕСА, НА КОТОРЫЙ МЫ ПИСАЛИ.
     *
     * Письмо ушло на depcult@depcult.gov35.ru, а ответ пришёл с mincult@gov35.ru:
     * департамент культуры Вологодской области стал министерством и сменил ящик.
     * По точному совпадению адреса такое письмо остаётся ничьим — без статуса,
     * без благодарности. Поэтому вторым заходом ищем по домену ведомства: он у
     * региона один и подделать его нельзя. Берём только однозначное совпадение. */
    if (!$min) {
        $dom = mb_strtolower((string) substr(strrchr($from, '@') ?: '', 1));
        $parts = explode('.', $dom);
        $base  = count($parts) >= 2 ? implode('.', array_slice($parts, -2)) : $dom;
        if ($base !== '' && !in_array($base, ['mail.ru', 'yandex.ru', 'gmail.com', 'bk.ru',
                                              'inbox.ru', 'list.ru', 'rambler.ru'], true)) {
            $same = all("SELECT * FROM ministries WHERE LOWER(email) LIKE ?", ['%@%' . $base]);
            if (count($same) === 1) {
                $min = $same[0];
                echo "     адрес сменился: " . $min['email'] . " → " . $from . "\n";
                if (!$dry) q("UPDATE ministries SET email=? WHERE id=?", [$from, (int) $min['id']]);
                $min['email'] = $from;
            }
        }
    }
    $org  = (string) ($min['org'] ?? $m['from_name'] ?? $from);

    /* Разбираем по бланку ведомства, а не по нашей цитате.
     *
     * Текст вложения (attach_text) — это письмо ведомства как есть. Тело письма
     * берём только своей частью, без процитированного нашего обращения: иначе
     * «прошу оказать информационную поддержку» из нашего же текста читается как
     * согласие, и благодарность уходит тому, кто ничего не ответил. */
    $attText = (string) ($m['attach_text'] ?? '');
    $ownText = inbox_strip_quote((string) $m['body_text']);
    $text    = trim($attText . "\n" . $ownText);
    $kind = trim($text) === ''
        ? 'ministry_question'
        : inbox_classify('kc', (string) $m['subject'], $text, false);
    $kind = ['partner_accept' => 'ministry_approve', 'partner_decline' => 'ministry_decline',
             'question' => 'ministry_question'][$kind] ?? $kind;

    // Прямой отказ распознаём и по обороту «находится за рамками нашего профиля»:
    // так ответил журнал «Музыкальная академия», и это именно отказ, а не вопрос.
    if (preg_match('~за рамками (нашего|моего) профил|не соответствует профил|не размещаем реклам'
                 . '|реклама .{0,40}за рамками~ui', $text)) {
        $kind = 'ministry_decline';
    }

    /* Требование сопроводительного письма — тоже не отказ по существу: документ
       просто не приняли по форме. Ведомство помечаем, и следующее обращение
       уйдёт к нему уже с сопроводительным отдельным файлом. */
    if (preg_match('~отсутствует сопроводительн|без сопроводительн|нет сопроводительн'
                 . '|отсутствует официальное письмо~ui', $text)) {
        $kind = 'ministry_cover';
    }

    $verdict = $kind === 'ministry_approve' ? 'поддержка'
             : ($kind === 'ministry_decline' ? 'отказ'
             : ($kind === 'ministry_eform'   ? 'только интернет-приёмная'
             : ($kind === 'ministry_cover'   ? 'нужно сопроводительное'
             : 'непонятно')));
    if (!isset($stat[$verdict])) $stat[$verdict] = 0;
    printf("  #%-5d %-34s %s\n", $id, mb_substr($org, 0, 34), $verdict);
    $stat[$verdict]++;

    if ($dry) continue;

    q("UPDATE inbox_messages SET kind = ? WHERE id = ?", [$kind, $id]);

    if ($kind === 'ministry_question') {          // решает человек, автоматика молчит
        q("UPDATE inbox_messages SET handled_by='human' WHERE id=?", [$id]);
        continue;
    }

    /* ── Принимают только через интернет-приёмную ──
     *
     * Благодарности тут быть не может: нам не отказали, но и не поддержали —
     * документ вообще не приняли к рассмотрению. Почтовый канал для этого
     * ведомства закрываем, чтобы следующая волна не слала ему письма впустую,
     * и запоминаем ссылку на приёмную: подавать туда придётся руками. */
    if ($kind === 'ministry_eform') {
        $form = function_exists('mrep_form_url') ? mrep_form_url($text) : '';
        if ($min) {
            try {
                q("UPDATE ministries SET portal_only=1" . ($form !== '' ? ", e_reception_url=?" : "")
                  . " WHERE id=?", $form !== '' ? [$form, (int) $min['id']] : [(int) $min['id']]);
            } catch (\Throwable $e) {}
        }
        try {
            q("UPDATE official_letters SET status='eform', replied_at=datetime('now','localtime')
                WHERE LOWER(email)=? AND kind='support' AND status IN ('sent','queued')", [$from]);
        } catch (\Throwable $e) {}
        echo "     принимают только через приёмную" . ($form !== '' ? ": $form" : "") . "\n";
        q("UPDATE inbox_messages SET kind='ministry_eform', handled_by='human' WHERE id=?", [$id]);
        continue;
    }

    /* ── Вернули из-за отсутствия сопроводительного письма ──
     *
     * Ставим ведомству отметку needs_cover: следующее обращение уйдёт с
     * сопроводительным письмом отдельным первым файлом (lm_cover_pdf()).
     * Обращение возвращаем в работу — оно не отправлено по существу. */
    if ($kind === 'ministry_cover') {
        if ($min) {
            try { q("UPDATE ministries SET needs_cover=1 WHERE id=?", [(int) $min['id']]); }
            catch (\Throwable $e) {}
        }
        try {
            q("UPDATE official_letters SET status='needs_cover', replied_at=datetime('now','localtime')
                WHERE LOWER(email)=? AND kind='support' AND status IN ('sent','queued')", [$from]);
        } catch (\Throwable $e) {}
        echo "     вернули без сопроводительного — отмечено, вышлем заново с ним\n";
        q("UPDATE inbox_messages SET kind='ministry_cover', handled_by='human' WHERE id=?", [$id]);
        continue;
    }

    if ($min) min_mark_replied($from, $kind === 'ministry_decline' ? 'declined' : 'supported');

    /* Реестр обращений тоже закрываем: пока обращение числится «отправлено»,
     * ведомство попадает в следующую волну и получает то же письмо второй раз. */
    if (!$dry) {
        try {
            q("UPDATE official_letters
                  SET status = ?, replied_at = datetime('now','localtime')
                WHERE LOWER(email) = ? AND kind = 'support' AND status IN ('sent','queued')",
              [$kind === 'ministry_decline' ? 'declined' : 'replied', $from]);
        } catch (\Throwable $e) {}
    }

    if ($kind === 'ministry_decline') {
        if (function_exists('mrep_mark_declined')) {
            try { mrep_mark_declined($from, 'отказ письмом'); } catch (\Throwable $e) {}
        }
        q("UPDATE inbox_messages SET handled_by='auto_decline' WHERE id=?", [$id]);
        continue;
    }

    /* ── Поддержка: скан в галерею ── */
    $imgRel = $fileRel = '';
    foreach (json_decode((string) $m['attachments'], true) ?: [] as $a) {
        $rel = (string) ($a['file'] ?? '');
        if ($rel === '' || !is_file(BASE_PATH . '/' . $rel)) continue;
        $ext = strtolower((string) pathinfo($rel, PATHINFO_EXTENSION));
        if (!in_array($ext, ['pdf', 'jpg', 'jpeg', 'png'], true)) continue;

        $stem = 'ml_' . substr(sha1($rel), 0, 10);
        $dst  = $dir . '/' . $stem . '.' . $ext;
        @copy(BASE_PATH . '/' . $rel, $dst);
        @chmod($dst, 0664);
        $fileRel = 'uploads/ministry/' . basename($dst);

        if ($ext === 'pdf') {
            // В галерее показываем картинку: первая страница письма — это бланк
            // с гербом и подписью, ради которого всё и затевалось.
            @exec('pdftoppm -jpeg -r 130 -f 1 -l 1 -singlefile ' . escapeshellarg($dst)
                . ' ' . escapeshellarg($dir . '/' . $stem) . ' 2>/dev/null');
            if (is_file($dir . '/' . $stem . '.jpg')) {
                @chmod($dir . '/' . $stem . '.jpg', 0664);
                $imgRel = 'uploads/ministry/' . $stem . '.jpg';
            }
        } else {
            $imgRel = $fileRel;
        }
        if ($imgRel !== '') break;
    }

    $already = (int) (scalar("SELECT COUNT(*) FROM ministry_letters WHERE msg_key = ?",
                             [(string) $m['msg_key']]) ?? 0);
    if ($already === 0) {
        try {
            insert('ministry_letters', [
                'region'       => (string) ($min['region'] ?? '') ?: $org,
                'title'        => $org,
                'image_path'   => $imgRel !== '' ? '/' . ltrim($imgRel, '/') : '',
                'file_path'    => $fileRel,
                'source_email' => $from,
                'msg_key'      => (string) $m['msg_key'],
                'letter_date'  => substr((string) $m['received_at'], 0, 10),
                'sort'         => 0,
            ]);
            $stat['в галерею']++;
        } catch (\Throwable $e) { echo "     в галерею не попало: " . $e->getMessage() . "\n"; }
    }

    /* ── Благодарность ── */
    //
    // ОДНО ВЕДОМСТВО — ОДНА БЛАГОДАРНОСТЬ.
    //
    // Минкультнац Мордовии прислал ответ и на kc@, и на почту центра на mail.ru.
    // Письма разные (разные ящики — разные ключи), ведомство одно, и 19 августа
    // оно получило от нас две одинаковые благодарности подряд. Перед постановкой
    // письма смотрим, не благодарили ли этот адрес недавно.
    $thanked = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                               WHERE LOWER(to_email) = ?
                                 AND subject LIKE 'Благодарим за поддержку%'
                                 AND created_at >= datetime('now','localtime','-60 days')", [$from]) ?? 0);
    if ($thanked > 0) {
        echo "     благодарность уже уходила, второй раз не пишем\n";
        q("UPDATE inbox_messages SET handled_by='auto_accept' WHERE id=?", [$id]);
        continue;
    }

    if ($min && function_exists('mrep_enabled') && mrep_enabled()) {
        $files = [];
        try { $t = mrep_thanks_pdf($min); if ($t) $files[] = $t; } catch (\Throwable $e) {}
        try {
            $ans = mrep_reply_support($min, (string) ($min['last_number'] ?? ''));
            mrep_queue_official($from, $org, $ans['subject'], $ans['html'], $files);
            $stat['благодарность']++;
        } catch (\Throwable $e) { echo "     благодарность не поставлена: " . $e->getMessage() . "\n"; }
    }

    q("UPDATE inbox_messages SET handled_by='auto_accept' WHERE id=?", [$id]);
}

echo "\n$line\n";
foreach ($stat as $k => $v) printf("  %-14s %d\n", $k, $v);
if ($dry) echo "\n  сухой прогон: ничего не изменено\n";
