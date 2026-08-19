<?php
/**
 * ОБУЧЕНИЕ АССИСТЕНТА НА ЖИВЫХ ДИАЛОГАХ.
 *
 * Модель мы не дообучаем — это дорого и медленно. Растёт не модель, а то, что она
 * видит перед каждым ответом. Материал берётся из двух мест, и оба появляются сами
 * собой, пока люди работают:
 *
 *   ЭТАЛОНЫ СТИЛЯ. Когда оператор отвечает участнику из админки, это образец того,
 *   как в центре разговаривают на самом деле. Такие ответы помечаются и потом
 *   показываются модели как «вот так у нас принято».
 *
 *   УРОКИ. Когда оператор правит фразу бота, он молча говорит: «так — неправильно,
 *   а вот так — правильно». Обе версии сохраняются вместе с вопросом, и в следующий
 *   раз на похожий вопрос модель увидит исправленный вариант.
 *
 * Чем дольше работает центр, тем больше эталонов и уроков — и тем меньше ассистент
 * похож на робота, который отвечает шаблонами.
 */
declare(strict_types=1);

/** Колонка-метка и таблица уроков. Вызывается лениво, безопасно повторно. */
function chat_learn_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try { db()->exec("ALTER TABLE chat_messages ADD COLUMN by_operator INTEGER DEFAULT 0"); } catch (\Throwable $e) {}
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS chat_lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT DEFAULT '',
            bad TEXT DEFAULT '',
            good TEXT DEFAULT '',
            session_key TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_lessons_created ON chat_lessons(created_at DESC)");
    } catch (\Throwable $e) {}
}

/** Пометить сообщение как написанное живым оператором. */
function chat_learn_mark_operator(int $messageId): void {
    if ($messageId <= 0) return;
    chat_learn_migrate();
    try { q("UPDATE chat_messages SET by_operator=1 WHERE id=?", [$messageId]); } catch (\Throwable $e) {}
}

/** Вопрос участника, на который отвечало сообщение $messageId. */
function chat_learn_question_before(int $messageId): string {
    try {
        $r = one("SELECT session_key FROM chat_messages WHERE id=?", [$messageId]);
        if (!$r) return '';
        return trim((string) (scalar(
            "SELECT text FROM chat_messages
              WHERE session_key=? AND role='user' AND id<? AND text<>''
           ORDER BY id DESC LIMIT 1", [$r['session_key'], $messageId]) ?: ''));
    } catch (\Throwable $e) { return ''; }
}

/**
 * Записать урок: оператор исправил формулировку бота.
 * Пустые и косметические правки не сохраняем — учиться на них нечему.
 */
function chat_learn_lesson(int $messageId, string $before, string $after): void {
    chat_learn_migrate();
    $before = trim($before); $after = trim($after);
    if ($after === '' || $before === $after) return;
    if (mb_strlen($after) < 12) return;
    // Правка в пару символов — опечатка, а не урок.
    if (mb_strlen($before) > 0 && abs(mb_strlen($before) - mb_strlen($after)) < 6
        && mb_substr($before, 0, 20) === mb_substr($after, 0, 20)) return;
    $q = chat_learn_question_before($messageId);
    try {
        $sk = (string) (scalar("SELECT session_key FROM chat_messages WHERE id=?", [$messageId]) ?: '');
        insert('chat_lessons', ['question' => mb_substr($q, 0, 500), 'bad' => mb_substr($before, 0, 800),
                                'good' => mb_substr($after, 0, 800), 'session_key' => $sk]);
    } catch (\Throwable $e) {}
}

/**
 * Живые примеры стиля: пары «вопрос участника → ответ оператора».
 *
 * Берём последние ответы, написанные человеком, и к каждому — вопрос, на который он
 * отвечал. Короткие реплики вроде «да» или «спасибо» отбрасываем: стилю по ним не
 * научишься. Это и есть голос центра — не придуманный, а тот, которым здесь говорят.
 */
function chat_style_examples(int $limit = 6): string {
    chat_learn_migrate();
    $out = [];
    try {
        $rows = all("SELECT id, session_key, text FROM chat_messages
                      WHERE by_operator=1 AND role='assistant' AND LENGTH(text)>60
                   ORDER BY id DESC LIMIT ?", [$limit * 3]);
        foreach ($rows as $r) {
            $q = trim((string) (scalar(
                "SELECT text FROM chat_messages
                  WHERE session_key=? AND role='user' AND id<? AND text<>''
               ORDER BY id DESC LIMIT 1", [$r['session_key'], (int) $r['id']]) ?: ''));
            if (mb_strlen($q) < 10) continue;
            $out[] = 'Участник: ' . mb_substr($q, 0, 260) . "\nОтвет центра: " . mb_substr(trim((string) $r['text']), 0, 420);
            if (count($out) >= $limit) break;
        }
    } catch (\Throwable $e) {}
    // ПЯТЬ ЛЕТ ПЕРЕПИСКИ СООБЩЕСТВА — тоже наши ответы, просто данные раньше.
    // Операторских ответов в новом чате пока десятки, а в сообществе их тысячи,
    // и именно там видно, как центр разговаривает: короткими репликами, без
    // канцелярита, с уточняющими вопросами вместо догадок. Образцы подбираются
    // под тему текущего вопроса (scripts/vk_style_learn.php раскладывает их по темам).
    if (count($out) < $limit) {
        $topic = chat_topic_of((string) ($GLOBALS['chat_last_question'] ?? ''));
        try {
            $rows = $topic !== ''
                ? all("SELECT question, answer FROM chat_style_samples WHERE topic=? ORDER BY RANDOM() LIMIT ?",
                      [$topic, $limit - count($out)])
                : [];
            if (count($rows) < $limit - count($out)) {
                foreach (all("SELECT question, answer FROM chat_style_samples ORDER BY RANDOM() LIMIT ?",
                             [$limit - count($out) - count($rows)]) as $extra) $rows[] = $extra;
            }
            foreach ($rows as $r) {
                $out[] = 'Участник: ' . mb_substr(trim((string) $r['question']), 0, 260)
                       . "\nОтвет центра: " . mb_substr(trim((string) $r['answer']), 0, 420);
            }
        } catch (\Throwable $e) { /* образцов ещё нет — не беда */ }
    }

    if (!$out) return '';
    return "ТАК В ЦЕНТРЕ РАЗГОВАРИВАЮТ НА САМОМ ДЕЛЕ — живые ответы наших сотрудников из переписки "
         . "сообщества и чата. Держи эту интонацию, длину и манеру: коротко, по делу, без канцелярита, "
         . "с уточняющим вопросом вместо догадки. НЕ копируй дословно и НЕ повторяй чужую подпись — "
         . "говори так же, но своими словами:\n\n"
         . implode("\n\n", $out);
}

/**
 * Тема вопроса — теми же словами, что и в разборе переписки.
 * Нужна, чтобы подсунуть образцы по делу: на вопрос о доставке показывать, как
 * центр отвечает про доставку, а не про оргвзнос.
 */
function chat_topic_of(string $q): string {
    $t = mb_strtolower(trim($q));
    if ($t === '') return '';
    $has = static fn(array $w): bool => (bool) array_filter($w, static fn($x) => mb_strpos($t, $x) !== false);
    if ($has(['возврат', 'вернуть деньги', 'верните']))                            return 'возврат';
    if ($has(['трек', 'посылк', 'почта росс', 'наложен', 'доставк', 'отправил']))  return 'доставка';
    if ($has(['благодарност', 'куратор', 'педагог', 'преподавател']))              return 'педагогу';
    if ($has(['партнёр', 'партнер', 'сотрудничеств']))                             return 'партнёрство';
    if ($has(['кубок', 'медал', 'статуэтк', 'оригинал', 'изготовлен']))            return 'заказ наград';
    if ($has(['диплом', 'наградн', 'результат', 'итог', 'звание', 'лауреат']))     return 'результаты';
    if ($has(['оплат', 'взнос', 'счёт', 'счет', 'квитанц', 'чек']))                return 'оплата';
    if ($has(['заявк', 'подать', 'участв', 'участие', 'номинац']))                 return 'заявка';
    if ($has(['положени', 'правил', 'требован', 'видео']))                         return 'положение';
    return '';
}

/**
 * Уроки, подходящие к текущему вопросу.
 *
 * Совпадение ищем по редким словам вопроса: короткие и служебные слова есть почти
 * везде и притянули бы случайные уроки. Если ничего похожего нет — отдаём несколько
 * свежих: даже общий урок полезнее пустоты.
 */
function chat_lessons_for(string $text, int $limit = 3): string {
    chat_learn_migrate();
    $words = [];
    foreach (preg_split('~[^\p{L}\d]+~u', mb_strtolower($text)) ?: [] as $w) {
        if (mb_strlen($w) >= 5) $words[] = $w;
    }
    $rows = [];
    try {
        if ($words) {
            $words = array_slice(array_unique($words), 0, 6);
            $cond = implode(' OR ', array_fill(0, count($words), 'LOWER(question) LIKE ?'));
            $args = array_map(fn($w) => '%' . $w . '%', $words);
            $args[] = $limit;
            $rows = all("SELECT question, good FROM chat_lessons WHERE ($cond)
                      ORDER BY id DESC LIMIT ?", $args);
        }
        if (!$rows) $rows = all("SELECT question, good FROM chat_lessons ORDER BY id DESC LIMIT ?", [$limit]);
    } catch (\Throwable $e) { return ''; }
    if (!$rows) return '';
    $out = [];
    foreach ($rows as $r) {
        $q = trim((string) $r['question']); $g = trim((string) $r['good']);
        if ($g === '') continue;
        $out[] = ($q !== '' ? 'На вопрос «' . mb_substr($q, 0, 180) . '» ' : '')
               . 'правильный ответ такой: ' . mb_substr($g, 0, 400);
    }
    if (!$out) return '';
    return "РАНЬШЕ ЗДЕСЬ ОШИБАЛИСЬ, И СТАРШИЙ ОПЕРАТОР ПОПРАВИЛ. Не повторяй те ошибки:\n"
         . implode("\n", $out);
}

/**
 * Признаки машинного текста, которых быть не должно.
 *
 * Человека выдаёт не содержание, а обороты: канцелярит, дежурные «важно отметить»,
 * бесконечные тире и списки из трёх пунктов. Участник таких слов от девушки из
 * колл-центра не слышит — и как только они появляются, разговор начинает звучать
 * как переписка с автоответчиком.
 */
function chat_human_rules(): string {
    return 'ЖИВАЯ РЕЧЬ, А НЕ МАШИННАЯ. Запрещены обороты, по которым сразу узнают робота: '
         . '«важно отметить», «стоит подчеркнуть», «в современном мире», «играет важную роль», '
         . '«является ключевым», «не только… но и», «данный», «осуществляется», «необходимо отметить», '
         . '«в рамках», «с целью», «таким образом», «подводя итог». '
         . 'Не строй фразы из трёх однородных частей подряд — это машинный ритм. '
         . 'Не используй длинное тире как украшение и не разбивай короткий ответ на списки. '
         . 'Пиши простыми предложениями, как говоришь вслух: «Проверила — заявка принята, '
         . 'результат придёт на почту до пятницы». Обращайся на «Вы», но без канцелярита. '
         . 'Не начинай ответ с «Конечно!», «Отлично!», «Разумеется!» — живые люди так не пишут '
         . 'в каждой реплике. Лучше сразу к сути.';
}
