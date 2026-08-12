<?php
/**
 * БЛАГОДАРНОСТЬ ПЕДАГОГУ, КОТОРЫЙ ПРИВЁЛ УЧЕНИКОВ.
 *
 * ПО УМОЛЧАНИЮ ВЫКЛЮЧЕНО. Благодарственное письмо — позиция прайса наградных
 * (300 ₽ электронное, 400 ₽ оригинал), и раздавать её даром — решение владельца,
 * а не автоматики. Механизм остаётся в коде, но включается только вручную:
 * setting('curator_free_enabled') = '1'.
 *
 * Замысел механизма: заявку в конкурс приносит не ребёнок и не родитель, а
 * преподаватель — одна учительница ДШИ подаёт десять-пятнадцать работ своего
 * класса. Документ ей нужен в аттестационное портфолио, стоит он центру ноль,
 * это PDF. Порог в несколько работ отделяет преподавателя, работающего с
 * классом, от родителя, вписавшего имя учителя в одну заявку.
 *
 * Отдельная нерешённая проблема, из-за которой включать нельзя как есть:
 * СВОЕГО АДРЕСА У ПЕДАГОГА В БАЗЕ НЕТ. Письмо уходит на почту из заявок, а её
 * указывает подающий — то есть благодарность педагогу приходит участнику.
 */
declare(strict_types=1);

/** Включена ли бесплатная автовыдача благодарностей педагогам. */
function curator_free_enabled(): bool {
    return (string) setting('curator_free_enabled', '0') === '1';
}

/** Со скольких аттестованных работ педагог получает благодарность даром. */
function curator_free_threshold(): int {
    return max(1, (int) setting('curator_free_from', '3'));
}

/** Нормализованное имя педагога — ключ, по которому его узнаём среди заявок. */
/**
 * РАЗБОР ПОЛЯ «ПЕДАГОГ» НА ОТДЕЛЬНЫХ ЛЮДЕЙ.
 *
 * Участник вписывает педагогов как придётся: через запятую, через «и», через
 * слэш, а чаще всего просто подряд — «Мельникова Анастасия Вадимовна Волкова
 * Ирина Вячеславовна». Явные разделители разбираем сразу; сплошную строку режем
 * по тройкам «Фамилия Имя Отчество», опираясь на отчество — оно в русском ФИО
 * стоит последним и хорошо опознаётся по окончанию.
 *
 * Если разобрать не вышло, возвращаем строку целиком: лучше одна благодарность
 * со странным именем, чем ни одной.
 *
 * @return array<int,string>
 */
function curator_split_teachers(string $raw): array {
    $s = preg_replace('~\s+~u', ' ', trim($raw)) ?? '';
    if ($s === '') return [];

    // Явные разделители — самый частый и самый надёжный случай.
    if (preg_match('~[,;/]|\sи\s~u', $s)) {
        $parts = preg_split('~\s*[,;/]\s*|\s+и\s+~u', $s) ?: [];
        $out = [];
        foreach ($parts as $p) { $p = trim($p); if (mb_strlen($p) >= 5) $out[] = $p; }
        if ($out) return $out;
    }

    // Сплошная строка: собираем слова, закрывая человека на отчестве.
    $words = preg_split('~ ~u', $s) ?: [];
    if (count($words) < 6) return [$s];              // один человек — делить нечего

    $out = []; $buf = [];
    foreach ($words as $w) {
        $buf[] = $w;
        $isPatronymic = (bool) preg_match('~(вич|вна|чна|шна|ич|ична)$~ui', $w);
        if ($isPatronymic && count($buf) >= 3) { $out[] = implode(' ', $buf); $buf = []; }
    }
    if ($buf) {
        // Хвост без отчества — приклеиваем к последнему, чтобы не потерять слова.
        if ($out) $out[count($out) - 1] .= ' ' . implode(' ', $buf);
        else      $out[] = implode(' ', $buf);
    }
    return $out ?: [$s];
}

function curator_key(string $teacher): string {
    $t = preg_replace('~\s+~u', ' ', trim($teacher));
    return mb_strtolower((string) $t);
}

/**
 * Педагоги конкурса, заслужившие благодарность, но ещё её не получившие.
 *
 * Считаем только работы с выставленным результатом: пока жюри не отработало,
 * благодарить не за что. Отклонённые заявки в счёт не идут.
 *
 * @return array [['teacher'=>..,'email'=>..,'works'=>int,'app_id'=>int], ...]
 */
function curator_pending(int $competitionId): array {
    if (!curator_free_enabled()) return [];
    $rows = all(
        "SELECT a.id, a.teacher, a.email, a.full_name
           FROM applications a
          WHERE a.competition_id = ?
            AND a.status <> 'rejected'
            AND a.result IS NOT NULL AND a.result <> ''
            AND TRIM(COALESCE(a.teacher,'')) <> ''",
        [$competitionId]
    );
    if (!$rows) return [];

    $byTeacher = [];
    foreach ($rows as $r) {
        // В одной заявке нередко записаны ДВА педагога: «Мельникова Анастасия
        // Вадимовна Волкова Ирина Вячеславовна». Без разбора они склеивались в
        // одну «фамилию» и печатались на бланке одной строкой — благодарность
        // получалась ни на кого. Благодарность именная: одна на человека.
        foreach (curator_split_teachers((string) $r['teacher']) as $one) {
            $k = curator_key($one);
            if ($k === '') continue;
            if (!isset($byTeacher[$k])) {
                $byTeacher[$k] = ['teacher' => $one, 'email' => '', 'works' => 0, 'app_id' => (int) $r['id'], 'emails' => []];
            }
            $byTeacher[$k]['works']++;
            $e = mb_strtolower(trim((string) $r['email']));
            if ($e !== '') $byTeacher[$k]['emails'][$e] = ($byTeacher[$k]['emails'][$e] ?? 0) + 1;
        }
    }

    $out = [];
    foreach ($byTeacher as $k => $t) {
        if ($t['works'] < curator_free_threshold()) continue;
        // Адрес педагога берём тот, что чаще всего стоит в его заявках: обычно
        // он же их и подавал. Если адреса разные — верим большинству.
        arsort($t['emails']);
        $t['email'] = (string) (array_key_first($t['emails']) ?? '');
        unset($t['emails']);
        if ($t['email'] === '') continue;
        if (curator_already_thanked($competitionId, $k)) continue;
        $out[] = $t;
    }
    return $out;
}

/** Уже благодарили этого педагога за этот конкурс? */
function curator_already_thanked(int $competitionId, string $teacherKey): bool {
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS curator_thanks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            competition_id INTEGER,
            teacher_key TEXT,
            teacher TEXT,
            email TEXT,
            works INTEGER DEFAULT 0,
            pdf_path TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now')),
            sent_at TEXT
        )");
        db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_curator_thanks_uni
                    ON curator_thanks(competition_id, teacher_key)");
    } catch (\Throwable $e) {}
    try {
        return (int) (scalar("SELECT COUNT(*) FROM curator_thanks WHERE competition_id=? AND teacher_key=?",
                             [$competitionId, $teacherKey]) ?? 0) > 0;
    } catch (\Throwable $e) { return false; }
}

/**
 * Выдать благодарность педагогу: сделать PDF и записать факт выдачи.
 * Возвращает id записи или 0.
 */
function curator_grant(int $competitionId, array $t): int {
    $key = curator_key((string) $t['teacher']);
    if ($key === '' || curator_already_thanked($competitionId, $key)) return 0;

    $comp = one("SELECT name, direction, diploma_theme, diploma_bg FROM competitions WHERE id=?", [$competitionId]);
    $app  = one("SELECT * FROM applications WHERE id=?", [(int) ($t['app_id'] ?? 0)]) ?: [];

    // Документ печатается тем же генератором, что и дипломы участников: у центра
    // один бланк, и благодарность не должна выглядеть распечаткой из редактора.
    $doc = array_merge($app, [
        'full_name'      => (string) $t['teacher'],
        'is_group'       => 0,
        'group_name'     => '',
        'competition'    => (string) ($comp['name'] ?? ''),
        'competition_id' => $competitionId,
        'result'         => 'Благодарность за подготовку участников',
        'nomination'     => '',
        'subgroup'       => '',
    ]);

    // ОПЦИЯ НАЗЫВАЕТСЯ 'thanks', А НЕ 'type'.
    // Генератор читает ['thanks'=>true|'extra'=>true|'named'=>true]; ключ 'type'
    // он не знает и молча печатал ОСНОВНОЙ ДИПЛОМ. Хуже того, имя файла строится
    // от номера заявки — и путь совпадал с дипломом ученика: педагогу уходила
    // копия детского диплома вместо благодарности на своё имя.
    // 'person' обязателен: без него на бланке печатается участник, а не педагог.
    $pdf = '';
    try {
        if (function_exists('diploma_pdf_html')) {
            $pdf = (string) diploma_pdf_html($doc, ['thanks' => true, 'person' => (string) $t['teacher']]);
        }
    } catch (\Throwable $e) { $pdf = ''; }
    if ($pdf === '' && function_exists('pdf_diploma')) {
        try { $pdf = (string) pdf_diploma($doc, 'thanks'); } catch (\Throwable $e) { $pdf = ''; }
    }

    try {
        return (int) insert('curator_thanks', [
            'competition_id' => $competitionId,
            'teacher_key'    => $key,
            'teacher'        => (string) $t['teacher'],
            'email'          => (string) $t['email'],
            'works'          => (int) $t['works'],
            'pdf_path'       => $pdf,
        ]);
    } catch (\Throwable $e) { return 0; }
}

/** Письмо педагогу с благодарностью. */
function curator_email_html(array $row, string $compName): string {
    $works = (int) ($row['works'] ?? 0);
    $word  = $works % 10 === 1 && $works % 100 !== 11 ? 'работу'
           : (in_array($works % 10, [2, 3, 4], true) && !in_array($works % 100, [12, 13, 14], true) ? 'работы' : 'работ');
    $site  = (string) cfgv('domain', 'музыкальный-мир.рф');

    $body = '<p style="margin:0 0 14px;font-size:16px">Уважаемый педагог!</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.62">
Ваши ученики представили на конкурс «' . h($compName) . '» ' . $works . ' ' . $word . ',
и все они прошли аттестацию жюри. Благодарим Вас за подготовку участников.
</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.62">
Во вложении - благодарственное письмо Культурного центра на Ваше имя. Документ
оформлен на официальном бланке и подходит для аттестационного портфолио.
</p>
<p style="margin:0 0 14px;font-size:15px;line-height:1.62">
Дипломы учеников отправлены на адреса, указанные в заявках. Приём работ следующего
сезона открыт - положения на сайте ' . h($site) . '.
</p>
<p style="margin:18px 0 0;font-size:15px">С уважением,<br>оргкомитет Культурного центра «Музыкальный Мир»</p>';

    if (!function_exists('mm_email_layout')) require_once __DIR__ . '/mailer.php';
    return mm_email_layout($body, [
        'preheader'     => 'Благодарственное письмо за подготовку участников конкурса',
        'vip'           => false,
        'audience_note' => 'Письмо направлено педагогу, чьи ученики участвовали в конкурсе центра.',
    ]);
}

/**
 * Разобрать конкурс целиком: найти заслуживших педагогов, выдать документы,
 * отправить письма. Возвращает [выдано, отправлено].
 */
function curator_process_competition(int $competitionId): array {
    if (!curator_free_enabled()) return [0, 0];
    $comp = one("SELECT name FROM competitions WHERE id=?", [$competitionId]);
    $name = (string) ($comp['name'] ?? '');
    $granted = 0; $sent = 0;

    foreach (curator_pending($competitionId) as $t) {
        $id = curator_grant($competitionId, $t);
        if ($id <= 0) continue;
        $granted++;

        $row = one("SELECT * FROM curator_thanks WHERE id=?", [$id]);
        if (!$row) continue;
        $to = trim((string) $row['email']);
        if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) continue;

        $opt = ['account' => function_exists('mail_account_by_name') ? mail_account_by_name('nagradi') : []];
        if (trim((string) $row['pdf_path']) !== '' && is_file((string) $row['pdf_path'])) {
            $opt['attach'] = (string) $row['pdf_path'];
        }
        $ok = function_exists('mail_send')
            ? (bool) mail_send($to, 'Благодарственное письмо за подготовку участников',
                               curator_email_html((array) $row, $name), $opt)
            : false;
        if ($ok) {
            try { update('curator_thanks', ['sent_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $id]); } catch (\Throwable $e) {}
            $sent++;
        }
    }
    return [$granted, $sent];
}
