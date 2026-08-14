<?php
/**
 * ОТВЕТЫ ВЕДОМСТВ — РАЗБОР И ОТВЕТ ЦЕНТРА.
 *
 * Обращение об информационной поддержке — начало переписки, а не её конец. На
 * него отвечают, и на ответ полагается ответить: поблагодарить за поддержку,
 * принять к сведению отказ, извиниться и переделать документ, если в нём
 * ошиблись с адресатом. Раньше всё это лежало на владельце и поэтому не
 * делалось: двести двадцать ведомств вручную не обслужить.
 *
 * ЧТО ЗДЕСЬ ЕСТЬ
 *   mrep_classify()      — что нам, собственно, ответили;
 *   mrep_reply_support() — благодарность за поддержку с наградным документом;
 *   mrep_reply_refusal() — ответ на отказ, ведомство больше не беспокоим;
 *   mrep_reply_fix()     — извинение и повторное обращение на верное имя;
 *   mrep_mark_bounced()  — адрес не существует, вычёркиваем.
 *
 * ПОЧЕМУ РАЗБОР ЧЕРЕЗ МОДЕЛЬ, А НЕ РЕГУЛЯРКАМИ. Ответ ведомства — живой
 * канцелярский текст. «Ваше обращение рассмотрено, информация размещена на
 * официальном сайте» — это поддержка. «Ваше обращение рассмотрено, оснований
 * для размещения не усматривается» — отказ. «Ваше обращение зарегистрировано
 * за вх. № 12-34» — вообще не ответ, а квитанция, и отвечать на неё не нужно.
 * Регулярка «рассмотрено» одинаково срабатывает на всех трёх. Поэтому письмо
 * читает модель, а регулярки остаются страховкой на случай, когда она молчит.
 *
 * ЖЕЛЕЗНОЕ ПРАВИЛО. Ни один ответ не уходит сам, пока владелец не поднял
 * рубильник ministry_autoreply_on. Причина та же, что у обращений: письмо от
 * имени центра отзывать нельзя.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/ministries.php';

/* =====================================================================
 *  Рубильник и журнал
 * ===================================================================== */

function mrep_enabled(): bool { return (string) setting('ministry_autoreply_on', '0') === '1'; }
function mrep_set_enabled(bool $on): void { set_setting('ministry_autoreply_on', $on ? '1' : '0'); }

function mrep_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("
    CREATE TABLE IF NOT EXISTS ministry_replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ministry_id INTEGER DEFAULT 0,
        email       TEXT DEFAULT '',
        org         TEXT DEFAULT '',
        subject     TEXT DEFAULT '',
        excerpt     TEXT DEFAULT '',       -- начало письма, чтобы разбор можно было перепроверить
        verdict     TEXT DEFAULT '',       -- support|refusal|fix|receipt|other
        reason      TEXT DEFAULT '',       -- чем модель это объяснила
        fixed_fio   TEXT DEFAULT '',       -- если ведомство назвало верного адресата
        answered_at TEXT DEFAULT '',
        answer_kind TEXT DEFAULT '',
        msg_key     TEXT DEFAULT '',
        created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mrep_key ON ministry_replies(msg_key);
    ");
}

/* =====================================================================
 *  1. Что нам ответили
 * ===================================================================== */

/**
 * Разбор ответа ведомства.
 *
 * @return array{verdict:string, reason:string, fio:string, by:string}
 *   verdict: support  — поддержали, разместили анонс, готовы сотрудничать;
 *            refusal  — отказали;
 *            fix      — просят исправить документ или указали не того адресата;
 *            receipt  — квитанция о регистрации, ответа по существу ещё нет;
 *            other    — не разобрали, нужен человек.
 */
function mrep_classify(string $subject, string $text): array {
    $clean = trim(preg_replace('~\s+~u', ' ', $subject . "\n" . $text) ?? '');
    if ($clean === '') return ['verdict' => 'other', 'reason' => 'пустое письмо', 'fio' => '', 'by' => 'нет текста'];

    // СНАЧАЛА ПРАВИЛА, И ТОЛЬКО ПО СЛУЖЕБНЫМ ПИСЬМАМ. Уведомление о недоставке
    // пишет почтовый сервер, а не человек: там всегда «550», «user unknown»,
    // «Undelivered Mail Returned to Sender». Регулярка узнаёт такое письмо
    // безошибочно, а модель — как повезёт: на одном и том же тексте она отвечала
    // то «bounce», то «other, письмо не доставлено из-за ошибки сервера».
    // Спрашивать её тут не о чем.
    $sys = mrep_classify_rules($clean);
    if (in_array($sys['verdict'], ['bounce', 'receipt'], true)) return $sys;

    $byModel = mrep_classify_model($subject, mb_substr($text, 0, 4000));
    // Модель могла не ответить или честно сказать «не понял» — тогда пробуем
    // правила: они беднее, но на прямых формулировках работают.
    $res = null;
    if ($byModel && $byModel['verdict'] !== 'other')      $res = $byModel;
    elseif ($sys['verdict'] !== 'other')                  $res = $sys;
    else                                                  $res = $byModel ?: $sys;

    // Ведомство назвало верного адресата, а разобрало письмо правило — оно ФИО
    // вытащить не умеет. Достаём сами: в канцелярском тексте верное имя стоит
    // рядом со словами «на имя», «руководитель», «переоформить на».
    if ($res['verdict'] === 'fix' && trim((string) ($res['fio'] ?? '')) === '') {
        $res['fio'] = mrep_guess_fio($text);
    }
    return $res;
}

/**
 * Вытащить ФИО из текста письма.
 *
 * Берём только имя, названное после явного указания на адресата, и только в
 * каноническом виде «Фамилия Имя Отчество». Всё остальное — не догадка, а
 * выдумка: в письме встречаются и подписант, и исполнитель, и тот, кого
 * упомянули мимоходом.
 */
function mrep_guess_fio(string $text): string {
    $t = preg_replace('~\s+~u', ' ', $text) ?? $text;
    $pat = '~(?:на имя|переоформить на|действующего руководителя|руководител[ья]|адресат)[^.;]{0,40}?[:\s]\s*'
         . '((?:[А-ЯЁ][а-яё]+)\s+(?:[А-ЯЁ][а-яё]+)\s+(?:[А-ЯЁ][а-яё]+(?:вна|чна|шна|ич|ыч)))~u';
    if (preg_match($pat, $t, $m)) return trim($m[1]);
    return '';
}

/** Разбор моделью. Возвращает null, если модель недоступна или ответила мусором. */
function mrep_classify_model(string $subject, string $text): ?array {
    if (!function_exists('chat_gemini_keys')) {
        if (!is_file(BASE_PATH . '/core/chat_brain.php')) return null;
        require_once BASE_PATH . '/core/chat_brain.php';
    }
    if (!function_exists('chat_gemini_keys')) return null;

    $prompt = <<<PROMPT
Ты разбираешь ответ российского органа власти или учреждения культуры на официальное
обращение культурного центра с просьбой об информационной поддержке детского
творческого конкурса.

Определи, что именно ответили, и верни СТРОГО один объект JSON без пояснений:
{"verdict":"support|refusal|fix|receipt|other","reason":"одно предложение по-русски","fio":"ФИО верного адресата, если письмо на него указывает, иначе пустая строка"}

Значения verdict:
- support  — поддержку окажут: разместят анонс, направят информацию подведомственным
             учреждениям, готовы к сотрудничеству, благодарят и одобряют.
- refusal  — поддержать не могут: нет оснований, не входит в компетенцию, отказано,
             рекомендуют обратиться в другой орган.
- fix      — просят что-то исправить или переоформить: неверно указан адресат или его
             должность, обращение направлено не по адресу, требуется иная форма
             документа, не хватает сведений.
- receipt  — только уведомление о регистрации входящего или автоответ о получении,
             решения по существу ещё нет.
- other    — понять невозможно.

Тема письма: {$subject}

Текст письма:
{$text}
PROMPT;

    foreach (chat_gemini_keys() as $key) {
        if (function_exists('chat_gemini_is_exhausted') && chat_gemini_is_exhausted($key)) continue;
        $out = mrep_gemini_once($key, $prompt);
        if ($out === null) continue;
        // Модель любит обрамлять JSON в ```json — вырезаем тело объекта.
        if (preg_match('~\{.*\}~s', $out, $m)) $out = $m[0];
        $d = json_decode($out, true);
        if (!is_array($d) || !isset($d['verdict'])) continue;
        $v = (string) $d['verdict'];
        if (!in_array($v, ['support', 'refusal', 'fix', 'receipt', 'other'], true)) continue;
        return [
            'verdict' => $v,
            'reason'  => trim((string) ($d['reason'] ?? '')),
            'fio'     => trim((string) ($d['fio'] ?? '')),
            'by'      => 'модель',
        ];
    }
    return null;
}

/** Один вызов модели без истории разговора: здесь нужен разбор, а не беседа. */
function mrep_gemini_once(string $apiKey, string $prompt): ?string {
    $model = (string) (cfgv('gemini_model') ?: 'gemini-flash-latest');
    $base  = rtrim((string) (cfgv('gemini_base_url') ?: 'https://generativelanguage.googleapis.com'), '/');
    $payload = json_encode([
        'contents'         => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
        'generationConfig' => ['maxOutputTokens' => 400, 'temperature' => 0.1],
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($base . '/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 6,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($code === 429 && function_exists('chat_gemini_mark_exhausted')) chat_gemini_mark_exhausted($apiKey);
    if (!is_string($resp) || $code >= 400) return null;

    $d = json_decode($resp, true);
    $out = '';
    foreach ($d['candidates'][0]['content']['parts'] ?? [] as $p) $out .= (string) ($p['text'] ?? '');
    $out = trim($out);
    return $out !== '' ? $out : null;
}

/** Страховка на случай, когда модель недоступна. Осторожная: сомнения — в «other». */
function mrep_classify_rules(string $t): array {
    $l = mb_strtolower($t);

    if (preg_match('~недоставлено|delivery (has )?failed|undelivered mail|mail delivery|адрес(ат)? не (существует|найден)|user unknown|550~u', $l)) {
        return ['verdict' => 'bounce', 'reason' => 'служебное уведомление о недоставке', 'fio' => '', 'by' => 'правило'];
    }
    if (preg_match('~зарегистрирован[оа]? (за |под )?(вх|№)|присвоен (входящий|№)|ваше обращение принято|автоответ~u', $l)) {
        return ['verdict' => 'receipt', 'reason' => 'уведомление о регистрации входящего', 'fio' => '', 'by' => 'правило'];
    }
    if (preg_match('~не\s+(имеем|представляется|можем|находит|усматрива)|отказ|отклонен|не входит в компетенц|оснований для .{0,30}не~u', $l)) {
        return ['verdict' => 'refusal', 'reason' => 'в тексте прямой отказ', 'fio' => '', 'by' => 'правило'];
    }
    if (preg_match('~не (является|тот) адресат|направлено не по адресу|уточнит[ье] (фамилию|должность|адресата)'
                 . '|переоформ|повторно направ|направить .{0,20}повторно|неверно указан|не будет зарегистрирован'
                 . '|с учётом требований|на бланке организации~u', $l)) {
        return ['verdict' => 'fix', 'reason' => 'просят переоформить или уточнить адресата', 'fio' => '', 'by' => 'правило'];
    }
    if (preg_match('~поддерж|размещен|разместим|информация направлена|доведена до сведения|окажем содействие|благодарим за приглашение~u', $l)) {
        return ['verdict' => 'support', 'reason' => 'в тексте согласие поддержать', 'fio' => '', 'by' => 'правило'];
    }
    return ['verdict' => 'other', 'reason' => 'по тексту не разобрать', 'fio' => '', 'by' => 'правило'];
}

/* =====================================================================
 *  2. Ответы центра
 * ===================================================================== */

/** Общая обёртка письма: тот же вид, что у остальной почты центра. */
function mrep_wrap(string $title, string $bodyHtml): string {
    $org  = (string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»');
    $site = (string) cfgv('domain', 'музыкальный-мир.рф');
    $mail = function_exists('ol_reply_email') ? ol_reply_email() : (string) cfgv('org_email', '');
    return '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:15px;line-height:1.62;color:#1B2340;max-width:640px">'
         . '<p style="margin:0 0 16px;font-size:17px"><b>' . h($title) . '</b></p>'
         . $bodyHtml
         . '<p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #DCE3F3;font-size:13px;color:#6B7699">'
         . h($org) . ' · ' . h($site) . ' · ' . h($mail) . '</p></div>';
}

/**
 * Уважительное обращение по имени-отчеству.
 *
 * Род адресата уже умеет определять ol_salutation() — по отчеству, а если его
 * нет, по фамилии. Своего второго определителя здесь заводить незачем: два
 * набора правил разойдутся, и в одном письме центр напишет «уважаемая», а в
 * другом «уважаемый» тому же человеку.
 */
function mrep_salut(string $fio): string {
    if (!function_exists('ol_salutation')) require_once BASE_PATH . '/core/letter_texts.php';
    $s = function_exists('ol_salutation') ? trim(ol_salutation($fio)) : '';
    return $s !== '' ? $s : 'Уважаемые коллеги!';
}

/**
 * ОТВЕТ НА ПОДДЕРЖКУ.
 *
 * К письму прикладывается благодарность на бланке: ведомству она нужна не как
 * украшение, а как документ для собственной отчётности о взаимодействии с
 * некоммерческими организациями.
 */
function mrep_reply_support(array $m, string $number = ''): array {
    $salut = mrep_salut((string) ($m['person'] ?? ''));
    $org   = (string) ($m['org'] ?? '');
    $body  = '<p style="margin:0 0 14px">' . h($salut) . '</p>'
        . '<p style="margin:0 0 14px">Благодарим за поддержку всероссийских творческих конкурсов Культурного '
        . 'центра «Музыкальный Мир» и за содействие в информировании учреждений культуры и образования '
        . h($m['region'] ?? '') . '.</p>'
        . '<p style="margin:0 0 14px">Ваш ответ размещён в разделе «Поддержка» на официальном сайте центра — '
        . 'его видят педагоги и родители, которые выбирают конкурс для своих учеников и детей. Это и есть та '
        . 'самая поддержка, ради которой мы обращались: она делает участие в конкурсе понятным и надёжным делом '
        . 'для семьи из небольшого города.</p>'
        . '<p style="margin:0 0 14px">К настоящему письму прилагается благодарственное письмо на имя '
        . h($org) . '.</p>'
        . '<p style="margin:0 0 14px">Об итогах конкурсов и о числе участников из вашего региона мы сообщим '
        . 'отдельным письмом. Будем признательны за дальнейшее сотрудничество.</p>'
        . '<p style="margin:0">С уважением,<br>оргкомитет Культурного центра «Музыкальный Мир»</p>';

    return [
        'subject' => 'Благодарим за поддержку всероссийских творческих конкурсов'
                   . ($number !== '' ? ' (к исх. №' . $number . ')' : ''),
        'html'    => mrep_wrap('Благодарность за поддержку', $body),
    ];
}

/**
 * ОТВЕТ НА ОТКАЗ.
 *
 * Коротко и без уговоров: решение принято, спорить с ведомством в переписке
 * бессмысленно и невежливо. Дверь при этом оставляем открытой — состав
 * конкурсов меняется, через год разговор может быть другим.
 */
function mrep_reply_refusal(array $m, string $number = ''): array {
    $salut = mrep_salut((string) ($m['person'] ?? ''));
    $body  = '<p style="margin:0 0 14px">' . h($salut) . '</p>'
        . '<p style="margin:0 0 14px">Благодарим за рассмотрение нашего обращения'
        . ($number !== '' ? ' (исх. №' . h($number) . ')' : '') . ' и за ответ по существу. '
        . 'Ваше решение принято к сведению.</p>'
        . '<p style="margin:0 0 14px">Повторных обращений по этому вопросу мы направлять не будем. '
        . 'Если в дальнейшем у ведомства появится интерес к участию детей и педагогов вашего региона '
        . 'в наших конкурсах, будем рады возобновить диалог — написать можно на '
        . h(function_exists('ol_reply_email') ? ol_reply_email() : (string) cfgv('org_email', '')) . '.</p>'
        . '<p style="margin:0">С уважением,<br>оргкомитет Культурного центра «Музыкальный Мир»</p>';

    return [
        'subject' => 'Ответ на ваше письмо' . ($number !== '' ? ' (к исх. №' . $number . ')' : ''),
        'html'    => mrep_wrap('Благодарим за ответ', $body),
    ];
}

/**
 * ОТВЕТ, КОГДА ПРОСЯТ ИСПРАВИТЬ.
 *
 * Самый важный из трёх. Ошибка в адресате — не мелочь: документ в таком виде
 * не регистрируют. Поэтому центр извиняется, исправляет запись в базе и
 * направляет обращение заново, уже на верное имя, с новым исходящим номером.
 */
function mrep_reply_fix(array $m, string $newFio = '', string $number = ''): array {
    $salut = mrep_salut($newFio !== '' ? $newFio : (string) ($m['person'] ?? ''));
    $body  = '<p style="margin:0 0 14px">' . h($salut) . '</p>'
        . '<p style="margin:0 0 14px">Приносим извинения за неточность в нашем обращении'
        . ($number !== '' ? ' (исх. №' . h($number) . ')' : '') . '. Сведения об адресате исправлены '
        . 'в реестре центра.</p>'
        . '<p style="margin:0 0 14px">Обращение направляем повторно — на верное имя и с новым исходящим '
        . 'номером. Прежний документ просим считать недействительным.</p>'
        . '<p style="margin:0 0 14px">Благодарим за то, что нашли время указать на ошибку.</p>'
        . '<p style="margin:0">С уважением,<br>оргкомитет Культурного центра «Музыкальный Мир»</p>';

    return [
        'subject' => 'Исправленное обращение об информационной поддержке'
                   . ($number !== '' ? ' (взамен исх. №' . $number . ')' : ''),
        'html'    => mrep_wrap('Обращение направлено повторно', $body),
    ];
}

/* =====================================================================
 *  3. Благодарность на бланке
 * ===================================================================== */

/** Номер благодарности: по нему документ находится в реестре и проверяется. */
function mrep_thanks_number(int $ministryId): string {
    return 'БЛГ-ВД-' . date('Y') . '-' . str_pad((string) max(1, $ministryId), 5, '0', STR_PAD_LEFT);
}

/**
 * БЛАГОДАРНОСТЬ ВЕДОМСТВУ — ЗОЛОТОЙ БЛАНК В PDF.
 *
 * Лист рисует headless-браузер на бастионе (тот же, что печатает дипломы) и
 * отдаёт готовый PDF обратно на сервер. Своей вёрстки здесь нет: страница
 * /tests/ministry-thanks.php повторяет утверждённый бланк благодарности,
 * поменяны только адресат и текст.
 *
 * @return string|null путь к PDF или null, если бастион недоступен
 */
function mrep_thanks_pdf(array $m, bool $regen = false): ?string {
    $number = mrep_thanks_number((int) ($m['id'] ?? 0));
    $out    = BASE_PATH . '/public/diplomas/ministry_thanks_'
            . preg_replace('~[^0-9A-Za-zА-Яа-я-]~u', '-', $number) . '.pdf';
    if (!$regen && is_file($out) && filesize($out) > 20000) return $out;

    $poster = rtrim((string) cfgv('poster_url', ''), '/');
    $token  = (string) cfgv('poster_token', '');
    $sshPas = (string) cfgv('vps_ssh_pass', '');
    if ($poster === '' || $token === '' || $sshPas === '') return null;

    if (!function_exists('diploma_render_key')) require_once BASE_PATH . '/core/diploma_render.php';
    $url = rtrim((string) cfgv('base_url', ''), '/') . '/tests/ministry-thanks.php'
         . '?key='   . rawurlencode(diploma_render_key())
         . '&org='   . rawurlencode((string) ($m['org'] ?? ''))
         . '&reg='   . rawurlencode((string) ($m['region'] ?? ''))
         . '&fio='   . rawurlencode((string) ($m['person'] ?? ''))
         . '&docno=' . rawurlencode($number);

    @mkdir(dirname($out), 0775, true);
    $tmp = '/tmp/mthanks_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.pdf';
    $cmd = 'cd /opt/oko-poster && NODE_PATH=/opt/oko-poster/node_modules node render_diploma.js '
         . escapeshellarg($url) . ' ' . escapeshellarg($tmp) . ' 297mm 210mm'
         . ' && export SSHPASS=' . escapeshellarg($sshPas)
         . '; sshpass -e scp -o StrictHostKeyChecking=no ' . escapeshellarg($tmp)
         . ' root@' . (string) cfgv('vps_host', '176.124.200.169') . ':' . escapeshellarg($out)
         . ' && rm -f ' . escapeshellarg($tmp) . ' && echo RENDER_OK';

    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 150,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    if (!is_string($resp) || !str_contains($resp, 'RENDER_OK')) return null;

    clearstatcache(true, $out);
    return (is_file($out) && filesize($out) > 20000) ? $out : null;
}

/* =====================================================================
 *  4. Правка базы по итогам ответа
 * ===================================================================== */

/**
 * АДРЕС НЕ СУЩЕСТВУЕТ.
 *
 * Физически строку не удаляем, а помечаем: сборщик базы ходит по открытым
 * источникам регулярно и вернёт удалённый адрес обратно через месяц. Пометка же
 * переживает любой пересбор, и min_recipients() такие строки не берёт —
 * результат тот же, что от удаления, только необратимой потери истории нет.
 */
function mrep_mark_bounced(string $email, string $why = ''): bool {
    min_migrate();
    $e = mb_strtolower(trim($email));
    if ($e === '') return false;
    try {
        q("UPDATE ministries SET status='bounced', note=TRIM(COALESCE(note,'')||' | адрес не принимает почту: '||?) WHERE lower(email)=?",
          [$why !== '' ? $why : date('d.m.Y'), $e]);
        return true;
    } catch (\Throwable $e2) { return false; }
}

/**
 * ЧЕЙ АДРЕС НЕ ПРИНЯЛ ПИСЬМО.
 *
 * Уведомление о недоставке приходит не от ведомства, а от почтового сервера —
 * MAILER-DAEMON, postmaster, mail delivery subsystem. Разбор входящих отбирает
 * письма по адресу отправителя из базы, и такое уведомление он просто не
 * заметит: адрес ведомства спрятан ВНУТРИ текста. Поэтому вытаскиваем его
 * оттуда и сверяем со списком известных.
 *
 * @param array<string,mixed> $known адреса ведомств в нижнем регистре как ключи
 * @return string[] адреса, которые в этом уведомлении названы недоставленными
 */
function mrep_bounced_addresses(string $raw, array $known): array {
    $out = [];
    if (!preg_match_all('~[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}~', $raw, $m)) return $out;
    foreach (array_unique($m[0]) as $addr) {
        $a = mb_strtolower($addr);
        if (isset($known[$a])) $out[$a] = true;
    }
    return array_keys($out);
}

/** Письмо написал почтовый сервер, а не человек? */
function mrep_is_daemon(string $from, string $subject): bool {
    $f = mb_strtolower($from) . ' ' . mb_strtolower($subject);
    return (bool) preg_match('~mailer-daemon|postmaster|mail delivery|delivery status|undelivered|returned to sender|failure notice~u', $f);
}

/** ОТКАЗ. Тот же принцип: помечаем, и рассылка больше эту строку не видит. */
function mrep_mark_declined(string $email, string $why = ''): bool {
    min_migrate();
    $e = mb_strtolower(trim($email));
    if ($e === '') return false;
    try {
        q("UPDATE ministries SET status='declined', replied_at=datetime('now'),
                  note=TRIM(COALESCE(note,'')||' | отказ от "
            . "поддержки: '||?) WHERE lower(email)=?", [$why !== '' ? $why : date('d.m.Y'), $e]);
        return true;
    } catch (\Throwable $e2) { return false; }
}

/**
 * ИСПРАВЛЕНИЕ АДРЕСАТА.
 *
 * Меняем ФИО и сбрасываем след сверки: новое имя пришло из письма самого
 * ведомства — источник надёжнее сайта, поэтому сверку считаем свежей и ставим
 * ссылкой сам ответ.
 */
function mrep_fix_person(string $email, string $fio, string $role = ''): bool {
    min_migrate();
    $e = mb_strtolower(trim($email));
    $w = preg_split('~\s+~u', trim($fio)) ?: [];
    if ($e === '' || count($w) !== 3) return false;
    $data = [
        'person'      => trim($fio),
        'verified_at' => date('Y-m-d H:i:s'),
        'verify_url'  => 'ответ ведомства на обращение',
        'verify_conf' => 'high',
        'status'      => 'new',           // адресат исправлен — можно писать заново
    ];
    if ($role !== '') $data['person_role'] = min_role_dative($role);
    try {
        $row = one("SELECT id FROM ministries WHERE lower(email)=?", [$e]);
        if (!$row) return false;
        update('ministries', $data, 'id=:id', ['id' => (int) $row['id']]);
        return true;
    } catch (\Throwable $e2) { return false; }
}
