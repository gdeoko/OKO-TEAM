<?php
/**
 * ВХОДЯЩАЯ ПОЧТА ЦЕНТРА — ЧИТАЕМ ВСЁ И НИЧЕГО НЕ ТЕРЯЕМ.
 *
 * Повод железный. Разослали шесть тысяч писем и получили ноль ответов, чего не
 * бывает. Разбор показал три независимые дыры, и все три ведут к одному: письмо
 * человека приходит и молча пропадает.
 *
 *   1. У ВСЕХ писем прямого SMTP стоит Reply-To: kc@ (config mail_reply_to).
 *      Участник жмёт «Ответить» на письмо о личном кабинете или о дипломе — и
 *      попадает в ящик ведомств. Там его читает только разборщик обращений,
 *      который всё, что не из базы ведомств, выбрасывает. В kc@ так и лежат
 *      «Спасибо, я обязательно Вам отвечу» от живых людей.
 *   2. Массовые письма идут через сервис рассылок без Reply-To, значит ответ
 *      уходит на адрес отправителя: news@ и novosti@. Эти ящики не читал никто.
 *   3. В приложенном к обращению PDF написано «согласие направляйте на kc@» —
 *      то есть согласия учреждений на партнёрство по замыслу должны падать
 *      ровно в тот ящик, где их выбрасывают.
 *
 * Этот модуль закрывает все три: читает четыре ящика (и папку «Спам» тоже —
 * туда Яндекс кладёт даже наши собственные письма), раскладывает письма в
 * таблицу inbox_messages, отличает автоответчик от живого человека и понимает,
 * о чём письмо. Он ТОЛЬКО ЧИТАЕТ: ни одного ответа, ни одного удаления. Всё,
 * что делает автоматика, живёт отдельно (cron/inbox_actions.php) — чтобы
 * ошибка разбора не превратилась в разосланную глупость.
 */
declare(strict_types=1);

require_once __DIR__ . '/imap_read.php';

/** Ящики, которые читаем. Ключ — как зовём мы, значение — имя аккаунта в конфиге. */
function inbox_boxes(): array {
    // novosti@ в конфиге исторически называется news2 — прямой поиск по имени
    // «novosti» возвращает пустоту, на этом уже спотыкались.
    // mailru — исторический публичный адрес центра kulturniy.centr.mir@mail.ru.
    // Он напечатан на старых бланках и разошёлся по справочникам, поэтому
    // ведомства и учреждения отвечают именно туда. Читаем наравне с остальными:
    // ответ, который никто не открыл, — это потерянная поддержка региона.
    return ['news' => 'news', 'novosti' => 'news2', 'kc' => 'kc',
            'nagradi' => 'nagradi', 'mailru' => 'mailru'];
}

/** Наши собственные адреса — сами себе не отвечаем и в разбор их не берём. */
function inbox_own_emails(): array {
    $out = [];
    foreach (inbox_boxes() as $acc) {
        $a = function_exists('mail_account_by_name') ? mail_account_by_name($acc) : [];
        foreach (['user', 'from_addr'] as $k) {
            $v = mb_strtolower(trim((string) ($a[$k] ?? '')));
            if ($v !== '') $out[$v] = 1;
        }
    }
    foreach (['org_email', 'owner_email', 'mail_reply_to'] as $k) {
        $v = mb_strtolower(trim((string) cfgv($k, '')));
        if ($v !== '') $out[$v] = 1;
    }
    // Личные адреса владельца: на его пересланные письма бот отвечать не должен.
    foreach (['okoteam.top@gmail.com', 'kulturniy.centr.mir@gmail.com', 'kulturniy.centr.mir@mail.ru'] as $v) {
        $out[$v] = 1;
    }
    return array_keys($out);
}

/** Таблица входящих. Создаётся лениво, повторный вызов безопасен. */
function inbox_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS inbox_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mailbox      TEXT NOT NULL,          -- news|novosti|kc|nagradi
            folder       TEXT DEFAULT 'INBOX',   -- INBOX|Spam
            msg_key      TEXT NOT NULL,          -- отпечаток письма (от+тема+дата)
            from_email   TEXT NOT NULL,
            from_name    TEXT DEFAULT '',
            subject      TEXT DEFAULT '',
            body_text    TEXT DEFAULT '',
            attachments  TEXT DEFAULT '',        -- JSON: [{name,size,mime}]
            is_auto      INTEGER DEFAULT 0,      -- автоответчик/квитанция/робот
            kind         TEXT DEFAULT '',        -- partner_accept|partner_decline|ministry|question|bounce|service
            handled_by   TEXT DEFAULT '',        -- '' пока не разобрано; bot|auto_accept|auto_decline|dedup|human|skip
            reply_text   TEXT DEFAULT '',
            reply_sent_at TEXT DEFAULT '',
            inst_id      INTEGER DEFAULT 0,      -- учреждение, если узнали
            ministry_id  INTEGER DEFAULT 0,      -- ведомство, если узнали
            user_id      INTEGER DEFAULT 0,      -- участник, если узнали
            received_at  TEXT NOT NULL,
            created_at   TEXT DEFAULT (datetime('now','localtime'))
        )");
        // Текст из вложения хранится ОТДЕЛЬНО от тела письма. Смешивать нельзя:
        // в теле лежит цитата нашего же обращения, и разбор по ней принимает
        // наши собственные обороты за ответ ведомства. Во вложении такого не
        // бывает — там бланк ведомства и только он.
        try { db()->exec("ALTER TABLE inbox_messages ADD COLUMN attach_text TEXT DEFAULT ''"); }
        catch (\Throwable $e) { /* колонка уже есть */ }
        db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_key ON inbox_messages(msg_key)");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_inbox_box  ON inbox_messages(mailbox, received_at DESC)");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_inbox_kind ON inbox_messages(kind, handled_by)");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_inbox_from ON inbox_messages(from_email)");
    } catch (\Throwable $e) { /* best-effort */ }
}

/**
 * АВТООТВЕТЧИК ИЛИ ЖИВОЙ ЧЕЛОВЕК.
 *
 * Отвечать роботу нельзя: он ответит нам, мы ему, и так до бесконечности —
 * а почтовые службы считают такую переписку спамом и банят домен. Признак
 * достаточен любой один.
 */
function inbox_is_auto(string $subject, string $body, string $raw = ''): bool {
    $head = mb_substr($raw, 0, 4000);
    if (preg_match('~^(Auto-Submitted:\s*auto|X-Autoreply:|X-Autorespond|Precedence:\s*(bulk|auto)|X-Auto-Response-Suppress)~im', $head)) return true;

    $t = mb_strtolower($subject . ' ' . mb_substr($body, 0, 700));
    $marks = ['автоответ', 'автоматический ответ', 'сформировано автоматически',
              'отвечать на него не нужно', 'не требует ответа', 'отсутствую',
              'в отпуске', 'не в офисе', 'out of office', 'out-of-office',
              'automatic reply', 'autoreply', 'on vacation', 'ваше письмо получено',
              'обращение зарегистрировано', 'письмо зарегистрировано', 'зарегистрировано. вх'];
    foreach ($marks as $m) if (mb_strpos($t, $m) !== false) return true;
    return false;
}

/** Служебный отправитель: робот почтовой службы, отвечать некому. */
function inbox_is_service(string $from): bool {
    $f = mb_strtolower(trim($from));
    if ($f === '') return true;
    // Поддержка почтовых служб — тоже не адресат помощника: на обращение о
    // блокировке домена нельзя отвечать рассказом о сроках приёма заявок.
    foreach (['@corp.mail.ru', '@help.mail.ru', '@yandex-team.ru', '@support.yandex.ru',
              '@unisender.com', '@go1.unisender.ru', '@team.unisender.com'] as $s) {
        if (str_contains($f, $s)) return true;
    }
    return (bool) preg_match('~^(noreply|no-reply|postmaster|mailer-daemon|mailer_daemon|bounce|notify|notification|robot|support@|abuse@|feedback@)~i', $f)
        || str_contains($f, 'mailer-daemon');
}

/**
 * О ЧЁМ ПИСЬМО.
 *
 * Согласие и отказ учреждения решают судьбу адреса, поэтому ищем их не по
 * одному слову, а по обороту: «да» в середине письма ничего не значит, а
 * «подтверждаем согласие» значит. Всё, что не опознано, идёт вопросом к
 * оператору — лучше лишний раз спросить человека, чем удалить не того.
 */
/**
 * ОТРЕЗАТЬ ЦИТАТУ НАШЕГО ЖЕ ПИСЬМА.
 *
 * Ведомство отвечает поверх исходного обращения, и в теле письма наш текст
 * занимает девять десятых объёма. Разбирать его вместе с ответом опасно вдвойне:
 * собственные обороты («прошу оказать информационную поддержку», «направляем
 * положение») читаются как ответ ведомства, а настоящий ответ — две строки
 * сверху — теряется среди цитаты.
 */
function inbox_strip_quote(string $body): string {
    // Якоря строк здесь не работают: тело письма хранится одной строкой, все
    // переносы схлопнуты при разборе. Поэтому ищем сами обороты, где бы они ни
    // стояли, — начало цитаты всё равно однозначно.
    // «Перенаправленное сообщение» НЕ режем: ведомство часто пересылает свой же
    // ответ целиком, и всё содержательное лежит именно там.
    // Длинная линия подчёркиваний — это разделитель цитаты в почтовых клиентах,
    // но ТОЛЬКО в письме. На бланке ведомства ровно так выглядят пустые графы:
    // «На №__________ от ______________», и по этой линии разбор отрезал весь
    // текст письма Минкультнаца Мордовии, оставив шапку с гербом. Поэтому линия
    // считается началом цитаты, лишь если сразу за ней идёт заголовок письма.
    $marks = ['~(?:^|\s)От:\s~u', '~(?:^|\s)From:\s~u',
              '~-{3,}\s*Original Message~ui',
              '~_{10,}\s*(?=.{0,200}(От:|From:|Кому:|To:|Тема:|Subject:|Дата:|Sent:))~us',
              '~(?:^|\s)>\s~u',
              '~писал[а]?\s+\d{4}-\d{2}-\d{2}~u',
              '~\d{1,2}\s+\p{Cyrillic}+\s+\d{4}[^.]{0,60}(написал|пишет)~u',
              '~(?:^|\s)Отправлено:\s~u', '~(?:^|\s)Sent:\s~u'];
    $cut = mb_strlen($body);
    foreach ($marks as $re) {
        if (preg_match($re, $body, $m, PREG_OFFSET_CAPTURE)) {
            $pos = mb_strlen(substr($body, 0, $m[0][1]));
            if ($pos > 0 && $pos < $cut) $cut = $pos;
        }
    }
    $head = trim(mb_substr($body, 0, $cut));

    // ОТВЕТ БЫВАЕТ И ПОД ЦИТАТОЙ.
    //
    // Союз композиторов России ответил отказом, дописав его ПОСЛЕ нашего письма:
    // «Многожанровые конкурсы... поэтому их поддержка со стороны Союза
    // невозможна». Сверху — пусто, и письмо ушло человеку как непонятное, хотя
    // это прямой и внятный отказ. Поэтому смотрим и в хвост: всё, что идёт после
    // последней процитированной строки, — тоже слова отвечающего.
    $tail = '';
    if (preg_match_all('~(?:^|\s)>\s~u', $body, $mm, PREG_OFFSET_CAPTURE)) {
        $last = end($mm[0]);
        $rest = trim(mb_substr($body, mb_strlen(substr($body, 0, $last[1] + strlen($last[0])))));
        // Первый кусок хвоста — это остаток самой цитаты (ссылка, сноска вида
        // «[4] https://...»). Свой текст начинается с обычного предложения.
        $rest = preg_replace('~^\s*(\[\d+\]\s*)?\S*https?://\S+\s*~u', '', $rest) ?? $rest;
        $rest = preg_replace('~^[^\p{L}]+~u', '', $rest) ?? $rest;
        if (mb_strlen($rest) >= 40) $tail = trim($rest);
    }
    if ($tail !== '' && mb_strlen($tail) > mb_strlen($head)) {
        return $head !== '' ? $head . "\n" . $tail : $tail;
    }

    // Короткий ответ — это ответ, а не пустота.
    //
    // Требование «не меньше сорока знаков» защищает от разбора нашей же цитаты,
    // и работает оно только там, где цитата есть. Если резать было нечего,
    // письмо целиком написано человеком: «Отпишите нас от рассылки.» — тридцать
    // знаков, и это самое важное письмо дня.
    if ($cut >= mb_strlen($body)) return $head;

    // Пусто сверху — значит своего текста в письме нет, только наша цитата.
    // Разбирать её нельзя: собственные обороты обращения («прошу оказать
    // информационную поддержку») читаются как согласие ведомства, и мы отправим
    // благодарность тому, кто ничего не ответил. Возвращаем пустоту — такое
    // письмо уходит человеку.
    return mb_strlen($head) >= 40 ? $head : '';
}

function inbox_classify(string $mailbox, string $subject, string $body, bool $isAuto): string {
    if ($isAuto) return 'auto';
    // Окно большое: у ведомств рабочая фраза стоит после длинной преамбулы —
    // у Минобразования Ставропольского края «направлено письмо в адрес
    // руководителей... с информацией о Конкурсе» начинается на 1 400-м знаке.
    // $body сюда может прийти уже вместе с текстом вложения (так его собирает
    // чтение почты) — для разбора это и нужно: бланк ведомства важнее письма.
    $own = inbox_strip_quote($body);
    if (trim($own) === '') {
        // Своего текста нет: письмо переслано целиком или ответ пустой.
        return $mailbox === 'kc' ? 'ministry_question' : 'question';
    }
    $t = mb_strtolower(preg_replace('~\s+~u', ' ', $subject . ' ' . mb_substr($own, 0, 2500)) ?? '');

    // Отчёт о недоставке приходит и по-русски, и по-английски, и слитно, и
    // раздельно. Не узнать его — значит попытаться ответить почтовому роботу.
    if (preg_match('~не\s?доставлен\w*|недоставлен|доставка не удалась|ящик\w* не (существует|найден)'
                 . '|адрес\w* не (существует|найден)|получатель не найден'
                 . '|undelivered|undeliverable|delivery status|delivery has failed'
                 . '|mail delivery (failed|subsystem)|returned to sender|failure notice~ui', $t)) return 'bounce';

    // Согласие на партнёрство — только явные обороты.
    // «Согласно» — ещё и предлог («согласно положению»), поэтому одного корня мало:
    // берём его только рядом со словами, которые бывают в согласии на партнёрство.
    $yes = '~(подтвержда\w+ соглас|выража\w+ соглас|соглас(ны|ен|на)\b'
         . '|соглас\w*\s+(стать|принять|на\s+(участие|партн|информацион|сотруднич))'
         . '|принима\w+ [^.!?]{0,30}(предложени|услови|партнёрств|партнерств)'
         . '|готовы (стать|принять участие|сотруднича)|заинтересован\w* в (сотрудничеств|партнёрств|партнерств)'
         . '|просим (присвоить|оформить) статус|хотим стать (информационным )?партн'
         . '|поддержива\w+|информация .{0,40}доведена|доведена до (сведени|подведомствен))~ui';
    // Отказ — тоже оборотом, не словом «нет».
    $no  = '~(отказыва\w+|не заинтересован\w*|не планиру\w+ участ|участвовать не будем|не намерен\w* участ'
         . '|просим (более )?не (направлять|присылать|беспокоить)|исключите нас|отпишите нас'
         . '|не поддержива\w+|не находим оснований|не имеется оснований|не считаем возможным'
         . '|основани\w* [^.!?]{0,40}не (имеется|усматрива\w+|найдено|установлено)'
         . '|не усматрива\w+ основани'
         // Союз композиторов России отказал так: «поддержка со стороны Союза
         // невозможна», «не относится к уставной деятельности». Ни одного слова
         // из прежнего списка — а это отказ, и притом окончательный.
         . '|поддержк\w* [^.!?]{0,60}невозможн'
         . '|невозможн\w* [^.!?]{0,40}поддержк'
         . '|не (относится|относятся|соответству\w+) [^.!?]{0,40}уставн'
         . '|(вне|за рамками) [^.!?]{0,40}(уставн|профил|компетенц))~ui';

    // ПРОСЬБА УБРАТЬ АДРЕС ИСПОЛНЯЕТСЯ БУКВАЛЬНО И РАНЬШЕ ВСЕГО ОСТАЛЬНОГО.
    //
    // 14 августа человек написал: «Эта эл. почта не Валентины Викторовны.
    // Удалите у себя её пожалуйста!» Ни одного оборота из списка отказов там
    // нет, поэтому письмо ушло в «вопросы», помощник вежливо ответил — а адрес
    // остался в базе, и следующее письмо ему уже стояло в очереди. Так теряют
    // не подписчика, а право писать вообще: человек, которого просили дважды,
    // жмёт «спам».
    //
    // Проверяется ДО согласия и отказа: «удалите мой адрес, участвовать не
    // будем» — это в первую очередь удаление.
    if (preg_match('~(удалит\w+|убер\w+|уберите|исключит\w+|снимит\w+)\s+'
                 . '[^.!?]{0,40}(адрес|почт|рассылк|из базы|у себя)'
                 . '|удалите у себя|отпишите( нас| меня)?|отписаться от рассылки'
                 . '|(больше )?не (пишите|присылайте|направляйте|беспокойте)( нам| мне)?'
                 . '|(более |больше )?не (направлять|присылать|высылать|писать|беспокоить)'
                 . '|это не (моя|наша) почта|(эта|это) (эл\.? )?(почта|адрес) не '
                 . '|чужой адрес|адрес указан ошибочно|ошиблись адресом~ui', $t)) return 'optout';

    // ВЕДОМСТВО ГОВОРИТ «ДА» СВОИМИ СЛОВАМИ.
    //
    // Министерство не пишет «согласны стать партнёром» — оно пишет, что сделало:
    // «информация доведена до сведения учреждений культуры региона», «направлена
    // в адрес муниципальных учреждений», «размещена на культурном портале».
    // Именно это нам и нужно: región разослал наш конкурс по своим школам.
    // Департамент культуры Брянской области распознался по обороту «доведена до
    // сведения», а Минкультнац Мордовии тем же ответом — нет, потому что написал
    // «направлена в адрес» и «размещена на портале».
    // ОТКАЗ ЧИТАЕТСЯ ПЕРВЫМ.
    //
    // «Не находим оснований для размещения информации на официальном портале» —
    // это отказ, в котором есть все слова согласия. Кто проверяется первым, тот
    // и прав: сначала прямой отказ, и только потом дела ведомства.
    if (preg_match($no, $t))  return $mailbox === 'kc' ? 'ministry_decline' : 'partner_decline';

    // «Перенаправлено по подведомственности» — это не рассылка по учреждениям, а
    // передача обращения дальше по инстанции: ответа по существу ещё не было.
    if (preg_match('~(информаци\w+|сведени\w+|письмо|материал\w*)[^.!?]{0,160}'
                 . '(доведен\w+|(?<!пере)направлен\w+|разослан\w+|размещен\w+|опубликован\w+)'
                 . '|(доведен\w+|(?<!пере)направлен\w+|разослан\w+|размещен\w+|опубликован\w+)[^.!?]{0,160}'
                 . '(учреждени|подведомствен|муниципальн|образовательн|органов управлени|портал|сайт|социальн|информаци)'
                 . '|размести\w+ информаци|информаци\w+ размещен'
                 . '|проинформирован\w+|информирован\w+ (учреждени|организаци)~ui', $t)
        && !preg_match('~обращени\w+ (перенаправлен|направлен)|по подведомственности~ui', $t)) {
        return $mailbox === 'kc' ? 'ministry_approve' : 'partner_accept';
    }

    if (preg_match($yes, $t)) return $mailbox === 'kc' ? 'ministry_approve' : 'partner_accept';
    if ($mailbox === 'kc') return 'ministry_question';
    return 'question';
}

/**
 * СОХРАНИТЬ ВЛОЖЕНИЕ ПИСЬМА. Возвращает путь относительно корня сайта или ''.
 *
 * Имя файла берём не из письма: там бывает что угодно, вплоть до путей с точками.
 * Оставляем только буквы, цифры и расширение, остальное режем.
 */
function inbox_save_attachment(string $mailbox, string $key, string $name, string $data): string {
    if ($data === '' || strlen($data) > 25 * 1024 * 1024) return '';
    $ext  = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    $ext  = preg_match('~^[a-z0-9]{1,5}$~', $ext) ? $ext : 'bin';
    $base = preg_replace('~[^a-zA-Zа-яА-Я0-9._-]+~u', '_', pathinfo($name, PATHINFO_FILENAME)) ?: 'file';
    $dir  = 'data/inbox/' . preg_replace('~[^a-z0-9]~', '', $mailbox) . '/' . $key;
    $abs  = BASE_PATH . '/' . $dir;
    if (!is_dir($abs) && !@mkdir($abs, 0775, true) && !is_dir($abs)) return '';
    $rel  = $dir . '/' . mb_substr($base, 0, 60) . '.' . $ext;
    return @file_put_contents(BASE_PATH . '/' . $rel, $data) !== false ? $rel : '';
}

/**
 * ТЕКСТ ИЗ PDF. Пусто, если распознать нечем или файл оказался картинкой.
 *
 * Сканы без текстового слоя здесь не разбираются намеренно: распознавание
 * картинок это отдельная история, а половина ответов ведомств приходит обычным
 * электронным документом, где текст есть.
 */
function inbox_pdf_text(string $file): string {
    if (!is_file($file)) return '';
    $bin = trim((string) @shell_exec('command -v pdftotext 2>/dev/null'));
    if ($bin === '') return '';
    $out = (string) @shell_exec($bin . ' -q -enc UTF-8 -nopgbrk ' . escapeshellarg($file) . ' - 2>/dev/null');
    return mb_substr(trim(preg_replace('~\s+~u', ' ', $out) ?? ''), 0, 3000);
}

/** Кого мы знаем по адресу: учреждение, ведомство, участника. */
function inbox_identify(string $email): array {
    $e = mb_strtolower(trim($email));
    $out = ['inst_id' => 0, 'ministry_id' => 0, 'user_id' => 0];
    if ($e === '') return $out;
    try {
        $i = one("SELECT id FROM institutions WHERE LOWER(email)=? LIMIT 1", [$e]);
        if ($i) $out['inst_id'] = (int) $i['id'];
        $m = one("SELECT id FROM ministries WHERE LOWER(email)=? LIMIT 1", [$e]);
        if ($m) $out['ministry_id'] = (int) $m['id'];
        $u = one("SELECT id FROM users WHERE LOWER(email)=? LIMIT 1", [$e]);
        if ($u) $out['user_id'] = (int) $u['id'];
    } catch (\Throwable $e2) { /* тихо */ }

    // ОТВЕТ С СОСЕДНЕГО АДРЕСА ТОГО ЖЕ ВЕДОМСТВА.
    // Департамент культуры ЯНАО ответил нам с codify@yanao.ru, хотя письмо
    // уходило на depcul@yanao.ru: у крупных органов регистрацию входящих ведёт
    // отдельная система со своим адресом. Строгое сравнение адреса такой ответ
    // теряет, поэтому при промахе опознаём по домену.
    if (!$out['ministry_id'] && str_contains($e, '@')) {
        $dom = substr($e, strpos($e, '@') + 1);
        if ($dom !== '' && !preg_match('~^(mail|gmail|yandex|bk|list|inbox|rambler|ya)\.~i', $dom)) {
            try {
                $m2 = one("SELECT id FROM ministries WHERE LOWER(email) LIKE ? LIMIT 1", ['%@' . $dom]);
                if ($m2) $out['ministry_id'] = (int) $m2['id'];
            } catch (\Throwable $e3) { /* тихо */ }
        }
    }
    return $out;
}

/**
 * Прочитать один ящик и разложить письма по полкам.
 *
 * @param string $alias  ключ из inbox_boxes()
 * @param int    $days   за сколько последних дней смотреть
 * @return array{seen:int,new:int,errors:int}
 */
function inbox_scan(string $alias, int $days = 14): array {
    inbox_migrate();
    $res = ['seen' => 0, 'new' => 0, 'errors' => 0];
    $accName = inbox_boxes()[$alias] ?? '';
    if ($accName === '') return $res;

    $acc = function_exists('mail_account_by_name') ? mail_account_by_name($accName) : [];
    if (!$acc || empty($acc['user'])) return $res;
    // IMAP-хост берём у самого ящика: он не обязан быть яндексовым.
    $acc['host'] = trim((string) ($acc['imap_host'] ?? '')) ?: 'imap.yandex.ru';
    $acc['port'] = (int) ($acc['imap_port'] ?? 0) ?: 993;

    $own   = inbox_own_emails();
    $since = date('d-M-Y', time() - $days * 86400);

    // ПАПКУ «СПАМ» ЧИТАЕМ НАРАВНЕ С ВХОДЯЩИМИ.
    // Яндекс кладёт в спам даже наши собственные письма (проверено: X-Yandex-Spam 4
    // на письме от нашего же домена). Ответ учреждения оттуда не заберёт никто, а
    // для нас он ничем не хуже остальных — фильтруем мы сами, по содержанию.
    foreach (['INBOX', 'Spam'] as $folder) {
        $ids = im_search($acc, 'SINCE ' . $since, $folder);
        foreach ($ids as $id) {
            $raw = im_fetch($acc, $id, $folder);
            if (trim($raw) === '') { $res['errors']++; continue; }
            $m = im_parse($raw);
            $res['seen']++;

            $from = mb_strtolower(trim((string) $m['from']));
            if ($from === '' || in_array($from, $own, true)) continue;   // сами себе не пишем

            $key = substr(sha1($alias . '|' . $from . '|' . $m['subject'] . '|' . $m['date']), 0, 24);
            try {
                if ((int) scalar("SELECT COUNT(*) FROM inbox_messages WHERE msg_key=?", [$key]) > 0) continue;
            } catch (\Throwable $e) { $res['errors']++; continue; }

            $isAuto = inbox_is_auto((string) $m['subject'], (string) $m['text'], $raw);
            $kind   = inbox_is_service($from) ? 'service'
                    : inbox_classify($alias, (string) $m['subject'], (string) $m['text'], $isAuto);
            $who    = inbox_identify($from);

            // РЕШАЕТ ОТПРАВИТЕЛЬ, А НЕ ЯЩИК.
            // В приложенном к обращению PDF учреждениям написано «согласие
            // направляйте на kc@». То есть согласие на партнёрство приходит в
            // ящик ведомств — и по одному лишь ящику было бы разобрано как ответ
            // ведомства, а разбор ответов ведомств чужие письма не берёт.
            // Согласие снова потерялось бы, теперь уже внутри нашей же системы.
            if ($who['ministry_id'] === 0 && $who['inst_id'] > 0) {
                $kind = ['ministry_approve' => 'partner_accept', 'ministry_decline' => 'partner_decline',
                         'ministry_question' => 'question'][$kind] ?? $kind;
            } elseif ($who['ministry_id'] > 0) {
                $kind = ['partner_accept' => 'ministry_approve', 'partner_decline' => 'ministry_decline',
                         'question' => 'ministry_question'][$kind] ?? $kind;
            }

            // ВЛОЖЕНИЕ — ЭТО И ЕСТЬ ОТВЕТ. ЕГО НАДО СОХРАНИТЬ И ПРОЧИТАТЬ.
            //
            // Ведомства отвечают официальным письмом на бланке, то есть PDF, а тело
            // письма у них пустое или из одной подписи. Раньше от вложения мы
            // оставляли только имя и размер, и первые же содержательные ответы —
            // Минкультнац Мордовии и Департамент культуры Брянской области —
            // оказались нечитаемыми: разобрать, согласие это или отказ, было нечем.
            //
            // Теперь файл ложится на диск, а из PDF вынимается текст (pdftotext) и
            // приклеивается к телу письма. Дальше он работает как обычный текст:
            // по нему считается тип ответа и его видит человек в админке.
            $att = [];
            $attText = '';
            foreach ((array) $m['attachments'] as $a) {
                $data = (string) ($a['data'] ?? '');
                $name = (string) ($a['name'] ?? '');
                $rel  = inbox_save_attachment($alias, $key, $name, $data);
                if ($rel !== '' && preg_match('~\.pdf$~i', $name)) {
                    $attText .= "\n" . inbox_pdf_text(BASE_PATH . '/' . $rel);
                }
                $att[] = ['name' => $name, 'mime' => (string) ($a['mime'] ?? ''),
                          'size' => strlen($data), 'file' => $rel];
            }
            // Текст из вложения — ГЛАВНЫЙ источник для разбора: в нём бланк
            // ведомства без нашей цитаты. Тело письма идёт вторым.
            if (trim($attText) !== '') {
                $forClass = trim($attText . "\n" . inbox_strip_quote((string) $m['text']));
                $m['text'] = trim((string) $m['text'] . "\n" . $attText);
                $kind = inbox_is_service($from) ? 'service'
                      : inbox_classify($alias, (string) $m['subject'], $forClass, $isAuto);
                if ($who['ministry_id'] === 0 && $who['inst_id'] > 0) {
                    $kind = ['ministry_approve' => 'partner_accept', 'ministry_decline' => 'partner_decline',
                             'ministry_question' => 'question'][$kind] ?? $kind;
                } elseif ($who['ministry_id'] > 0) {
                    $kind = ['partner_accept' => 'ministry_approve', 'partner_decline' => 'ministry_decline',
                             'question' => 'ministry_question'][$kind] ?? $kind;
                }
            }

            try {
                insert('inbox_messages', [
                    'mailbox'     => $alias,
                    'folder'      => $folder,
                    'msg_key'     => $key,
                    'from_email'  => $from,
                    'from_name'   => mb_substr((string) $m['from_name'], 0, 190),
                    'subject'     => mb_substr((string) $m['subject'], 0, 400),
                    // Переносы строк не схлопываем: по ним видно, где кончается
                    // ответ и начинается цитата нашего же письма. Схлопываем
                    // только пробелы внутри строки и пустоту между абзацами.
                    'body_text'   => mb_substr(trim(preg_replace(
                        ['~[ \t\x{00A0}]+~u', '~\r~', '~\n{3,}~'], [' ', '', "\n\n"],
                        (string) $m['text']) ?? ''), 0, 4000),
                    'attachments' => $att ? json_encode($att, JSON_UNESCAPED_UNICODE) : '',
                    'attach_text' => mb_substr(trim($attText), 0, 4000),
                    'is_auto'     => $isAuto ? 1 : 0,
                    'kind'        => $kind,
                    // Служебное и роботов сразу закрываем: отвечать некому и незачем.
                    'handled_by'  => ($kind === 'service' || $kind === 'bounce' || $isAuto) ? 'skip' : '',
                    'inst_id'     => $who['inst_id'],
                    'ministry_id' => $who['ministry_id'],
                    'user_id'     => $who['user_id'],
                    'received_at' => (string) $m['date'],
                ]);
                $res['new']++;
            } catch (\Throwable $e) { $res['errors']++; }
        }
    }
    return $res;
}
