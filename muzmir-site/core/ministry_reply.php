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
        created_at  TEXT DEFAULT (datetime('now','localtime'))
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
function mrep_classify(string $subject, string $text, array $attachments = []): array {
    /* РЕШЕНИЕ ВЕДОМСТВА ЖИВЁТ В ДОКУМЕНТЕ, А НЕ В ПИСЬМЕ.
     *
     * Так устроено делопроизводство: ответ органа власти — это документ на
     * фирменном бланке, с исходящим номером и подписью, приложенный к письму
     * файлом. В самом письме бывает «направляем ответ на Ваше обращение», а
     * бывает и вовсе пусто. Текстом в теле письма ведомства не отказывают и не
     * соглашаются — там сидит либо сопроводительная строка, либо автоответчик.
     *
     * Отсюда жёсткое правило: одобрение и отказ признаём ТОЛЬКО по тексту
     * приложенного документа. Нет документа — нет решения, сколько бы обещаний
     * ни было в теле письма. Иначе автоответ «Ваше письмо получено, спасибо»
     * однажды будет принят за согласие, центр опубликует несуществующую
     * поддержку и вышлет благодарность за то, чего не было.
     */
    $docText = $attachments ? mrep_attachments_text($attachments) : '';
    $body    = trim(preg_replace('~\s+~u', ' ', $subject . "\n" . $text) ?? '');

    if ($body === '' && $docText === '') {
        return ['verdict' => 'other', 'reason' => 'пустое письмо', 'fio' => '', 'by' => 'нет текста'];
    }

    // СЛУЖЕБНЫЕ ПИСЬМА РАЗБИРАЕМ ПО ТЕЛУ И ПРАВИЛАМИ. Уведомление о недоставке
    // пишет почтовый сервер: там всегда «550», «user unknown», «Undelivered Mail
    // Returned to Sender». Регулярка узнаёт такое письмо безошибочно, а модель —
    // как повезёт: на одном и том же тексте она отвечала то «bounce», то «other,
    // письмо не доставлено из-за ошибки сервера». Спрашивать её тут не о чем.
    $sys = mrep_classify_rules($body);
    if (in_array($sys['verdict'], ['bounce', 'receipt'], true)) return $sys;

    // ТРЕБОВАНИЕ ЭЛЕКТРОННОЙ ПРИЁМНОЙ РЕШАЕТСЯ ПО ТЕЛУ ПИСЬМА.
    // Это единственное исключение из правила «решение только в документе», и оно
    // вынужденное: канцелярия, которая не принимает почту, отвечает как раз
    // письмом без вложений — «Ваше обращение не может быть рассмотрено, подайте
    // через форму». Требуй мы здесь документ, такой ответ уходил бы в «ждём
    // настоящий», ведомство оставалось бы в рассылке и получало письмо каждый
    // месяц — с тем же результатом.
    if ($sys['verdict'] === 'eform') return $sys;

    // Документа нет — значит решения нет. Письмо не теряем: «receipt» означает
    // «ждём настоящий ответ», такие ведомства остаются в работе и в следующем
    // месяце получат обращение как ни в чём не бывало.
    if ($docText === '') {
        return [
            'verdict' => 'receipt',
            'reason'  => $attachments
                ? 'к письму приложены файлы, но прочитать документ не удалось — решение не признаём'
                : 'в письме нет приложенного документа, а решение ведомство выносит только документом',
            'fio' => '', 'by' => 'правило',
        ];
    }

    // Дальше разбираем ДОКУМЕНТ. Тело письма идёт следом и только как пояснение:
    // если в нём «направляем ответ», это ничего не добавляет, а если там
    // автоответчик — он не перебьёт того, что написано на бланке.
    $text    = $docText . "\n\n[сопроводительное письмо]\n" . mb_substr($body, 0, 800);
    $byModel = mrep_classify_model($subject, mb_substr($text, 0, 6000));
    // Модель могла не ответить или честно сказать «не понял» — тогда пробуем
    // правила: они беднее, но на прямых формулировках работают.
    // Страховка на случай молчания модели считается ПО ДОКУМЕНТУ, а не по телу
    // письма: $sys выше разбирал сопроводиловку, и решения в ней быть не может.
    $sysDoc = mrep_classify_rules($docText);

    $res = null;
    if ($byModel && $byModel['verdict'] !== 'other')      $res = $byModel;
    elseif ($sysDoc['verdict'] !== 'other')               $res = $sysDoc;
    else                                                  $res = $byModel ?: $sysDoc;

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
- eform    — обращение по электронной почте не рассматривают в принципе и требуют
             подать его через электронную приёмную, форму на сайте или портал
             госуслуг. Это не отказ по существу, а отказ принимать письмо.
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
        if (!in_array($v, ['support', 'eform', 'refusal', 'fix', 'receipt', 'other'], true)) continue;
        return [
            'verdict' => $v,
            'reason'  => trim((string) ($d['reason'] ?? '')),
            'fio'     => trim((string) ($d['fio'] ?? '')),
            'by'      => 'модель',
        ];
    }
    return null;
}

/* =====================================================================
 *  1б. Ответ во вложении
 * ===================================================================== */

/**
 * ПРОЧИТАТЬ ВЛОЖЕНИЯ ОТВЕТА.
 *
 * Канцелярия отвечает не текстом в письме, а документом: в теле стоит «во
 * вложении» или вовсе пусто, а решение — на бланке в PDF. Разбор одного лишь
 * тела письма в таком случае честно скажет «не понял» и позовёт человека, хотя
 * в приложенном документе прямым текстом написано «поддерживаем».
 *
 * Порядок такой:
 *   PDF с текстовым слоем  → pdftotext, это точно и бесплатно;
 *   PDF-скан без слоя      → первая страница в картинку и в модель со зрением;
 *   фотография или скан    → сразу в модель;
 *   DOCX                   → распаковываем document.xml.
 *
 * Читаем не больше трёх вложений и первые две страницы: решение ведомства
 * всегда в начале, а остальное — приложения к их же письму.
 *
 * @param array<int,array{name:string,data:string}> $attachments
 */
function mrep_attachments_text(array $attachments): string {
    $out = [];
    $done = 0;
    foreach ($attachments as $a) {
        if ($done >= 3) break;
        $name = (string) ($a['name'] ?? '');
        $data = (string) ($a['data'] ?? '');
        $ext  = strtolower((string) pathinfo($name, PATHINFO_EXTENSION));
        if ($data === '' || strlen($data) > 25 * 1024 * 1024) continue;

        $txt = '';
        if ($ext === 'pdf')                                  $txt = mrep_pdf_text($data);
        elseif (in_array($ext, ['jpg','jpeg','png'], true))  $txt = mrep_image_text($data, $ext === 'png' ? 'image/png' : 'image/jpeg');
        elseif ($ext === 'docx')                             $txt = mrep_docx_text($data);
        elseif (in_array($ext, ['txt','rtf'], true))         $txt = mb_substr(strip_tags($data), 0, 4000);

        $txt = trim(preg_replace('~\s+~u', ' ', $txt) ?? '');
        if ($txt !== '') { $out[] = "[вложение: $name]\n" . mb_substr($txt, 0, 4000); $done++; }
    }
    return implode("\n\n", $out);
}

/** Текст из PDF: сперва текстовый слой, если его нет — страница как картинка. */
function mrep_pdf_text(string $data): string {
    $tmp = tempnam(sys_get_temp_dir(), 'mrep') . '.pdf';
    if (@file_put_contents($tmp, $data) === false) return '';
    $txt = '';
    $out = $tmp . '.txt';
    @exec('pdftotext -f 1 -l 2 -enc UTF-8 ' . escapeshellarg($tmp) . ' ' . escapeshellarg($out) . ' 2>/dev/null');
    if (is_file($out)) { $txt = (string) file_get_contents($out); @unlink($out); }

    // Меньше двухсот знаков на двух страницах — это скан, а не документ.
    if (mb_strlen(trim($txt)) < 200) {
        $stem = $tmp . '-page';
        @exec('pdftoppm -jpeg -r 150 -f 1 -l 1 -singlefile ' . escapeshellarg($tmp) . ' ' . escapeshellarg($stem) . ' 2>/dev/null');
        if (is_file($stem . '.jpg')) {
            $img = (string) file_get_contents($stem . '.jpg');
            @unlink($stem . '.jpg');
            $seen = mrep_image_text($img, 'image/jpeg');
            if (mb_strlen($seen) > mb_strlen(trim($txt))) $txt = $seen;
        }
    }
    @unlink($tmp);
    return $txt;
}

/** Текст с картинки — читает модель со зрением. */
function mrep_image_text(string $bytes, string $mime): string {
    if (!function_exists('chat_gemini_keys')) {
        if (!is_file(BASE_PATH . '/core/chat_brain.php')) return '';
        require_once BASE_PATH . '/core/chat_brain.php';
    }
    if (!function_exists('chat_gemini_keys')) return '';

    $model = (string) (cfgv('gemini_model') ?: 'gemini-flash-latest');
    $base  = rtrim((string) (cfgv('gemini_base_url') ?: 'https://generativelanguage.googleapis.com'), '/');
    $payload = json_encode([
        'contents' => [['role' => 'user', 'parts' => [
            ['text' => 'Это скан официального письма российского органа власти. Перепиши его текст '
                     . 'дословно, сохраняя формулировки решения. Без пояснений и без пересказа.'],
            ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode($bytes)]],
        ]]],
        'generationConfig' => ['maxOutputTokens' => 1200, 'temperature' => 0],
    ], JSON_UNESCAPED_UNICODE);

    foreach (chat_gemini_keys() as $key) {
        if (function_exists('chat_gemini_is_exhausted') && chat_gemini_is_exhausted($key)) continue;
        $ch = curl_init($base . '/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($key));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_TIMEOUT => 60, CURLOPT_CONNECTTIMEOUT => 8,
        ]);
        $resp = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);
        if ($code === 429 && function_exists('chat_gemini_mark_exhausted')) { chat_gemini_mark_exhausted($key); continue; }
        if (!is_string($resp) || $code >= 400) continue;
        $d = json_decode($resp, true);
        $t = '';
        foreach ($d['candidates'][0]['content']['parts'] ?? [] as $p) $t .= (string) ($p['text'] ?? '');
        if (trim($t) !== '') return trim($t);
    }
    return '';
}

/** Текст из DOCX: это zip, внутри которого document.xml. */
function mrep_docx_text(string $data): string {
    $tmp = tempnam(sys_get_temp_dir(), 'mrepd') . '.docx';
    if (@file_put_contents($tmp, $data) === false) return '';
    $txt = '';
    $zip = new ZipArchive();
    if ($zip->open($tmp) === true) {
        $xml = (string) $zip->getFromName('word/document.xml');
        $zip->close();
        // Абзацы и переводы строк — в пробелы, иначе слова слипаются.
        $xml = preg_replace('~</w:p>|<w:br/>~', ' ', $xml) ?? $xml;
        $txt = trim(html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8'));
    }
    @unlink($tmp);
    return $txt;
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
    // «ё» и «е» для делопроизводства одно и то же, а для регулярного выражения —
    // разные буквы: «размещён» мимо правила с «размещен» проходил незамеченным.
    $l = str_replace(['ё', 'Ё'], ['е', 'е'], mb_strtolower($t));

    if (preg_match('~недоставлено|delivery (has )?failed|undelivered mail|mail delivery|адрес(ат)? не (существует|найден)|user unknown|550~u', $l)) {
        return ['verdict' => 'bounce', 'reason' => 'служебное уведомление о недоставке', 'fio' => '', 'by' => 'правило'];
    }
    if (preg_match('~зарегистрирован[оа]? (за |под )?(вх|№)|присвоен (входящий|№)|ваше обращение принято|автоответ~u', $l)) {
        return ['verdict' => 'receipt', 'reason' => 'уведомление о регистрации входящего', 'fio' => '', 'by' => 'правило'];
    }
    // ТРЕБОВАНИЕ ЭЛЕКТРОННОЙ ПРИЁМНОЙ — ПЕРЕД ОТКАЗОМ.
    // Такие письма начинаются со слов «не может быть рассмотрено», и по одному
    // этому обороту они неотличимы от отказа по существу. Разница важная: по
    // существу нам не отказали, просто не принимают почту как канал.
    if (preg_match('~электронн\w* приёмн|электронн\w* приемн|через (электронную )?форму|форму обратной связи'
                 . '|единого портала государственных|госуслуг|gosuslugi|в форме электронного документа'
                 . '|обращени\w* принимаются (только )?через~u', $l)) {
        return ['verdict' => 'eform', 'reason' => 'принимают обращения только через электронную приёмную', 'fio' => '', 'by' => 'правило'];
    }
    // ПРОСЬБУ ПЕРЕОФОРМИТЬ СМОТРИМ РАНЬШЕ ОТКАЗА.
    // «Обращение не будет зарегистрировано: отсутствуют реквизиты» — это не
    // отказ по существу, а просьба прислать документ по форме. Отрицание в
    // нём то же, что в отказе, поэтому порядок правил решает всё.
    if (preg_match('~не (является|тот) адресат|направлено не по адресу|уточнит[ье] (фамилию|должность|адресата)'
                 . '|переоформ|повторно направ|направить .{0,20}повторно|неверно указан|не будет зарегистрирован'
                 . '|с учётом требований|на бланке организации~u', $l)) {
        return ['verdict' => 'fix', 'reason' => 'просят переоформить или уточнить адресата', 'fio' => '', 'by' => 'правило'];
    }
    // ОТКАЗ ИЩЕМ ДО ПОДДЕРЖКИ И ВО ВСЕХ ЛИЦАХ.
    //
    // «Не находим оснований для размещения информации» — это отказ, но глагол
    // стоит в первом лице множественного числа, а правило знало только «не
    // находит». Письмо проваливалось дальше, попадало на слово «размещен» и
    // читалось как ПОДДЕРЖКА: центр отправлял благодарность с наградным
    // документом ведомству, которое ему отказало.
    $refuse = '~не\s+(имеем|имеется|представляется|можем|может|находи\w+|усматрива\w+|считаем|считает'
            . '|планиру\w+|будем|будет|располагаем|вправе|уполномочен\w*)'
            . '|отказ\w*|отклонен\w*|не входит в (компетенц|полномочи|функци)'
            . '|основани\w* [^.!?]{0,40}не\s|не\s[^.!?]{0,20}основани'
            . '|вне компетенц|не относится к (компетенц|полномочи)~u';
    if (preg_match($refuse, $l)) {
        return ['verdict' => 'refusal', 'reason' => 'в тексте прямой отказ', 'fio' => '', 'by' => 'правило'];
    }
    // ПОДДЕРЖКА — ТОЛЬКО БЕЗ ОТРИЦАНИЯ РЯДОМ.
    // Слово «поддержка» одинаково часто встречается и в согласии, и в отказе
    // («не можем оказать поддержку»), поэтому смотрим, не стоит ли перед ним
    // отрицание в пределах нескольких слов. Отказ уже отсеян выше, это второй
    // рубеж на случай оборота, которого нет в списке отказов.
    $supportWord = '(поддерж\w*|размещен\w*|размести\w+|разослан\w*|направлена информация'
                 . '|информация направлена|доведена до сведения|доведена до подведомствен'
                 . '|окажем содействие|благодарим за приглашение|анонс\w* размещ)';
    if (preg_match('~' . $supportWord . '~u', $l, $mm, PREG_OFFSET_CAPTURE)) {
        $at   = (int) $mm[0][1];
        $near = mb_substr($l, max(0, $at - 60), 60 + mb_strlen($mm[0][0]));
        if (!preg_match('~\bне\b|\bнет\b|отказ~u', $near)) {
            return ['verdict' => 'support', 'reason' => 'в тексте согласие поддержать', 'fio' => '', 'by' => 'правило'];
        }
        return ['verdict' => 'other', 'reason' => 'рядом с согласием стоит отрицание, решает человек',
                'fio' => '', 'by' => 'правило'];
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
    // Должность берём в именительном падеже: в базе рядом с дательным, который
    // нужен обращению, лежит исходная форма из сверки. Если её почему-то нет,
    // печатаем без должности — лучше короче, чем с падежом от другого документа.
    $url = rtrim((string) cfgv('base_url', ''), '/') . '/tests/ministry-thanks.php'
         . '?key='   . rawurlencode(diploma_render_key())
         . '&org='   . rawurlencode((string) ($m['org'] ?? ''))
         . '&reg='   . rawurlencode((string) ($m['region'] ?? ''))
         . '&fio='   . rawurlencode((string) ($m['person'] ?? ''))
         . '&role='  . rawurlencode((string) ($m['person_role_nom'] ?? ''))
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

/**
 * НАВСЕГДА ЛИ НЕ ДОШЛО.
 *
 * Вычёркивать ведомство можно только тогда, когда адресата действительно нет.
 * 14.08.2026 отбой от министерства культуры Челябинской области гласил
 * «554 5.4.0 Error: too many hops» — это петля пересылки внутри их собственной
 * почты, ящик при этом живой. Автоматика вычеркнула министерство навсегда, и
 * письма туда больше не пошли бы никогда: чужая временная поломка стоила бы
 * центру целого региона.
 *
 * Постоянный отказ — это «нет такого пользователя» и коды 5.1.1/5.1.10. Всё
 * прочее (переполнен ящик, петля, отказ по политике, любые 4.x.x) значит
 * «сейчас не доставили» — ведомство остаётся в работе, а письмо уйдёт в
 * следующий раз.
 */
function mrep_bounce_is_permanent(string $raw): bool {
    $t = mb_strtolower($raw);

    // Сначала то, что временно, — иначе «5.4.0» ниже спутается с «5.1.1».
    if (preg_match('~too many hops|loops back|mailbox (is )?full|quota exceeded|over quota'
                 . '|try again later|temporar|greylist|4\.\d\.\d|451|452|421~u', $t)) return false;

    return (bool) preg_match('~user unknown|no such user|unknown user|recipient (address )?rejected'
                           . '|does not exist|нет такого (пользователя|адресата)|адресат не (существует|найден)'
                           . '|5\.1\.[01]|550 5\.1|user not found~u', $t);
}

/** Письмо написал почтовый сервер, а не человек? */
function mrep_is_daemon(string $from, string $subject): bool {
    $f = mb_strtolower($from) . ' ' . mb_strtolower($subject);
    return (bool) preg_match('~mailer-daemon|postmaster|mail delivery|delivery status|undelivered|returned to sender|failure notice~u', $f);
}

/**
 * ТРЕБУЮТ ЭЛЕКТРОННУЮ ПРИЁМНУЮ — БОЛЬШЕ НЕ ПИШЕМ.
 *
 * Решение владельца от 14.08.2026: с теми, кто не принимает обращения почтой,
 * центр не работает. Подача через форму или портал госуслуг требует входа под
 * учётной записью организации и делается руками — на двести с лишним ведомств
 * это не масштабируется, а ради одного-двух писем заводить постоянный доступ к
 * госпорталу незачем. Адрес формы сохраняем в карточке: если такие ведомства
 * когда-нибудь понадобятся, будет с чего начать.
 */
function mrep_mark_eform(string $email, string $formUrl = '', string $why = ''): bool {
    min_migrate();
    $e = mb_strtolower(trim($email));
    if ($e === '') return false;
    try {
        $note = ' | ' . date('d.m.Y') . ': почту не принимает, обращения только через электронную приёмную'
              . ($why !== '' ? ' — ' . $why : '') . '. Из рассылки исключено решением владельца.';
        if ($formUrl !== '') {
            q("UPDATE ministries SET status='excluded', e_reception_url=?, note=TRIM(COALESCE(note,'')||?) WHERE lower(email)=?",
              [$formUrl, $note, $e]);
        } else {
            q("UPDATE ministries SET status='excluded', note=TRIM(COALESCE(note,'')||?) WHERE lower(email)=?", [$note, $e]);
        }
        return true;
    } catch (\Throwable $e2) { return false; }
}

/** Адрес электронной приёмной, если ведомство назвало его в письме. */
function mrep_form_url(string $text): string {
    // Первая попавшаяся ссылка не годится: письмо ведомства цитирует наше
    // обращение целиком, и первой в тексте оказывается ссылка на наш же логотип.
    // Именно она и записалась Минкультуры Владимирской области как «электронная
    // приёмная». Берём ссылку на чужой сайт, не на файл, и предпочитаем ту, в
    // адресе которой есть приёмная или обращение.
    $own = mb_strtolower((string) cfgv('domain', 'музыкальный-мир.рф'));
    $ownPuny = 'xn----7sbugdeiegh1b0a9hen';                 // тот же домен в punycode
    if (!preg_match_all('~https?://[^\s<>"\')]+~u', $text, $mm)) return '';

    $best = '';
    foreach ($mm[0] as $u) {
        $u = rtrim($u, '.,;:');
        $l = mb_strtolower($u);
        if ($own !== '' && mb_strpos($l, $own) !== false) continue;      // наш домен
        if (mb_strpos($l, $ownPuny) !== false) continue;
        if (preg_match('~\.(png|jpe?g|gif|svg|webp|ico|css|js|pdf|docx?)($|\?)~u', $l)) continue;
        if (preg_match('~priem|priyom|reception|obrashch|obrasheni|feedback|internet-priem~u', $l)) return $u;
        if ($best === '') $best = $u;
    }
    return $best;
}

/** ОТКАЗ. Тот же принцип: помечаем, и рассылка больше эту строку не видит. */
function mrep_mark_declined(string $email, string $why = ''): bool {
    min_migrate();
    $e = mb_strtolower(trim($email));
    if ($e === '') return false;
    try {
        q("UPDATE ministries SET status='declined', replied_at=datetime('now','localtime'),
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

/**
 * ОДНО ВЕДОМСТВО — ОДНА БЛАГОДАРНОСТЬ.
 *
 * Ответ ведомства приходит по нескольким путям сразу: крон читает kc@ по IMAP, а
 * разбор общей почты берёт то же письмо из ящика на mail.ru, и ведомство нередко
 * присылает два письма подряд. Проверки не было ни в одном пути, кроме разбора
 * общей почты, — за август шесть адресатов получили благодарность по два-три
 * раза. Смотрим очередь писем, а не память прогона: пути разные, очередь одна.
 *
 * Адреса берём все, какие у ведомства известны: канцелярия отвечает то с общего
 * ящика, то с личного адреса сотрудника, и по одному адресу дубль не виден.
 */
function mrep_already_thanked(string $email, int $ministryId = 0, int $days = 60): bool {
    $mails = [];
    $e = mb_strtolower(trim($email));
    if ($e !== '') $mails[$e] = 1;
    if ($ministryId > 0) {
        try {
            $r = one("SELECT email FROM ministries WHERE id=?", [$ministryId]);
            $a = mb_strtolower(trim((string) ($r['email'] ?? '')));
            if ($a !== '') $mails[$a] = 1;
        } catch (\Throwable $ex) {}
        try {
            foreach (all("SELECT DISTINCT email FROM ministry_replies WHERE ministry_id=? AND email<>''",
                         [$ministryId]) as $row) {
                $a = mb_strtolower(trim((string) $row['email']));
                if ($a !== '') $mails[$a] = 1;
            }
        } catch (\Throwable $ex) {}
    }
    if (!$mails) return false;

    $in = implode(',', array_fill(0, count($mails), '?'));
    try {
        // Тема благодарности задана здесь же, в mrep_reply_support(): пока обе
        // строки лежат рядом, проверка не разойдётся с письмом.
        // СЧИТАЕМ ТОЛЬКО ЖИВЫЕ ПИСЬМА. Упавшее (failed) и снятое (cancelled) до
        // ведомства не дошло, и блокировать им повторную постановку значит навсегда
        // оставить учреждение без ответа из-за одной осечки почты.
        $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                             WHERE LOWER(to_email) IN ($in)
                               AND subject LIKE 'Благодарим за поддержку%'
                               AND status IN ('queued','sent','paused')
                               AND created_at >= datetime('now','localtime','-" . max(1, $days) . " days')",
                           array_keys($mails)) ?? 0);
        return $n > 0;
    } catch (\Throwable $ex) { return false; }
}

/**
 * ЭТОТ ОФИЦИАЛЬНЫЙ ОТВЕТ УЖЕ УХОДИЛ?
 *
 * Дедуп стоял только на благодарности за поддержку, а из того же разбора уходят
 * ещё два письма: отказ и просьба переоформить. Ведомство, ответившее дважды (а
 * это обычное дело: сначала секретарь, потом профильный отдел), получало и наш
 * ответ дважды. Правило одно на все три: одно письмо одной темы одному адресату
 * за окно в два месяца.
 *
 * @param string $subjectLike начало темы письма, как оно ставится в очередь
 */
function mrep_already_sent(string $email, int $ministryId, string $subjectLike, int $days = 60): bool {
    $e = mb_strtolower(trim($email));
    $mails = $e !== '' ? [$e => 1] : [];
    if ($ministryId > 0) {
        try {
            $r = one("SELECT email FROM ministries WHERE id=?", [$ministryId]);
            $a = mb_strtolower(trim((string) ($r['email'] ?? '')));
            if ($a !== '') $mails[$a] = 1;
        } catch (\Throwable $ex) {}
    }
    if (!$mails || trim($subjectLike) === '') return false;
    $in = implode(',', array_fill(0, count($mails), '?'));
    try {
        $args = array_keys($mails);
        $args[] = $subjectLike . '%';
        $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                             WHERE LOWER(to_email) IN ($in)
                               AND subject LIKE ?
                               AND status IN ('queued','sent','paused')
                               AND created_at >= datetime('now','localtime','-" . max(1, $days) . " days')",
                           $args) ?? 0);
        return $n > 0;
    } catch (\Throwable $ex) { return false; }
}

/**
 * ПОСТАВИТЬ ОТВЕТ ЦЕНТРА В ОЧЕРЕДЬ.
 *
 * Ответ ведомству — такое же официальное письмо, как и само обращение: уходит с
 * kc@ и тем же неспешным темпом, пять писем в минуту. Поэтому помечаем его
 * campaign_type='official', иначе очередь отправит его в общем потоке личных
 * писем — тридцать штук в минуту с ящика, у которого нет резерва.
 *
 * @param string $files вложения списком абсолютных путей (JSON), если они есть
 */
function mrep_queue_official(string $to, string $name, string $subject, string $html, array $files = []): int {
    $id = 0;
    try {
        $id = (int) insert('mail_queue', [
            'to_email'      => mb_strtolower(trim($to)),
            'to_name'       => $name,
            'subject'       => $subject,
            'body'          => $html,
            'status'        => 'queued',
            'priority'      => 0,
            'campaign_type' => 'official',
            'attach'        => $files ? json_encode(array_values($files), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        ]);
    } catch (\Throwable $e) { $id = 0; }
    return $id;
}
