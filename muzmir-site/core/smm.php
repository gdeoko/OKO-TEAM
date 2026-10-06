<?php
/**
 * core/smm.php — ежедневный конвейер постов в соцсети центра.
 *
 * ЗАЧЕМ. Посты в сообщество и канал собирались руками: тема придумывалась в
 * переписке, текст писался отдельно, картинка генерировалась отдельно, публикация
 * шла третьим инструментом. Пропуск одного дня никто не замечал, пока владелец сам
 * не открывал ленту. Здесь весь путь собран в один конвейер: тема -> текст ->
 * картинка -> очередь -> публикация, и каждый шаг виден в админке.
 *
 * ГЛАВНОЕ ПРАВИЛО ВЛАДЕЛЬЦА: ТЕМА НЕ ПОВТОРЯЕТСЯ НИКОГДА. Не «редко», не «не чаще
 * раза в квартал» — никогда, даже если конвейер работает полгода и выдал три сотни
 * постов. Поэтому банк тем здесь не список, а генератор: модель предлагает тему,
 * а smm_topic_is_fresh() сверяет её с ВСЕМИ вышедшими за всё время — по теме, по
 * факту и по источнику отдельно. Совпало хоть одно — тема отбрасывается и просится
 * следующая. Список из 64 тем был бы исчерпан за полтора месяца.
 *
 * ОКНО. Наружу уходит только пн–сб 09:00–19:00 МСК (правило владельца, общее для
 * всех наружных каналов, core/outreach_window.php). Два поста в день, 10:00 и
 * 17:00. Воскресенье пропускается целиком — это не сбой конвейера, а правило.
 *
 * ДЕНЬГИ. Картинка генерируется платно (apimodels, ~0.04 кредита за 2K). Расход
 * ограничен сверху настройкой smm_image_budget_day: конвейер не имеет права
 * потратить больше, чем разрешил владелец, даже если его попросить руками.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
if (is_file(__DIR__ . '/outreach_window.php')) require_once __DIR__ . '/outreach_window.php';

/* ------------------------------------------------------------------ *
 *  Постоянные части поста
 * ------------------------------------------------------------------ */

/**
 * Футер стоит в КОНЦЕ КАЖДОГО поста и не меняется. Это не украшение: читатель,
 * пришедший с любого поста, должен за один экран найти конкурсы, кабинет и телефон,
 * не листая ленту. Меняется только тело поста выше.
 *
 * Почты разведены по назначению (правило владельца): kc@ — заявки и вопросы,
 * news@ — рассылки, nagradi.on@ — награды. Телефон один на весь центр.
 * Telegram в постах не упоминается вовсе — решение владельца от 02.10.2026.
 */
const SMM_FOOTER = <<<'TXT'
━━━━━━━━━━━━━━━━━━
🔗 РЕСУРСЫ И КОНТАКТЫ
🎼 Все конкурсы: музыкальный-мир.рф/konkursi
👤 Личный кабинет: музыкальный-мир.рф/cabinet
🏆 Элитный клуб (награды, бонусы, комментарии жюри): музыкальный-мир.рф/club
📝 Оставить отзыв: музыкальный-мир.рф/reviews
🏛 Поддержка Министерства культуры: музыкальный-мир.рф/ministry-support

💬 Мы на связи:
ВКонтакте: vk.ru/music_world.online
МАКС: max.ru/channel_muzmir
📞 Колл-центр: +7 (999) 504-88-99

📧 Почты для обращений:
• Общие вопросы и заявки: kc@музыкальный-мир.рф
• Новости и рассылки: news@музыкальный-мир.рф
• Награды и дипломы: nagradi.on@музыкальный-мир.рф

🕑 График (МСК): Пн–Пт 09:00–18:00, Сб 10:00–16:00, Вс — выходной.

🌍 С уважением, Оргкомитет Культурного центра «Музыкальный Мир» 🌍
TXT;

/**
 * Длина ТЕЛА поста без футера. Образцы владельца укладываются в 1833–2112, но
 * предел стоит шире: модель мажет в обе стороны — то 1100, то 3300, — и слишком
 * узкая рамка отправляет в брак текст, который читателю ничем не плох. Снизу
 * держим жёстче: короткий пост действительно выглядит обрывком.
 */
const SMM_BODY_MIN = 1500;
const SMM_BODY_MAX = 2700;

/** Часы публикации, МСК. Утро и вечер обязаны бить в разные слои аудитории. */
const SMM_SLOT_MORNING = 10;
const SMM_SLOT_EVENING = 17;

/* ------------------------------------------------------------------ *
 *  Таблицы
 * ------------------------------------------------------------------ */

function smm_migrate(): void {
    $pdo = db();
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS smm_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slot_date TEXT NOT NULL,              -- дата публикации, ГГГГ-ММ-ДД
        slot_hour INTEGER NOT NULL,           -- 10 или 17
        status TEXT DEFAULT 'draft',          -- draft|ready|published|failed|skipped
        topic TEXT DEFAULT '',                -- тема одной строкой
        topic_key TEXT DEFAULT '',            -- нормализованная тема для антиповтора
        fact TEXT DEFAULT '',                 -- факт, на котором держится пост
        fact_key TEXT DEFAULT '',             -- нормализованный факт
        source TEXT DEFAULT '',               -- источник факта
        layer TEXT DEFAULT '',                -- родитель|педагог|участник|учреждение
        stage INTEGER DEFAULT 1,              -- ступень воронки 1..7
        ratio TEXT DEFAULT '16:9',
        title TEXT DEFAULT '',                -- заголовок на картинке
        subtitle TEXT DEFAULT '',             -- подзаголовок на картинке
        body TEXT DEFAULT '',                 -- тело поста без футера
        text_full TEXT DEFAULT '',            -- тело + футер, то что уходит
        image_prompt TEXT DEFAULT '',
        image_path TEXT DEFAULT '',           -- локальный файл картинки
        image_cost REAL DEFAULT 0,
        hooppy_post_id INTEGER DEFAULT 0,
        vk_link TEXT DEFAULT '',
        error TEXT DEFAULT '',
        attempts INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        published_at TEXT,
        UNIQUE(slot_date, slot_hour)
    );
    CREATE INDEX IF NOT EXISTS idx_smm_posts_status ON smm_posts(status, slot_date);
    CREATE INDEX IF NOT EXISTS idx_smm_posts_topickey ON smm_posts(topic_key);
    CREATE INDEX IF NOT EXISTS idx_smm_posts_factkey ON smm_posts(fact_key);
    ");
}

/* ------------------------------------------------------------------ *
 *  Антиповтор тем
 * ------------------------------------------------------------------ */

/**
 * Ключ для сравнения тем. Сравнивать сырые строки бесполезно: «Волнение перед
 * сценой» и «Как справиться с волнением на сцене» — одна и та же тема, записанная
 * по-разному. Поэтому строка приводится к набору значимых корней: нижний регистр,
 * без пунктуации, без служебных слов, слова обрезаются до шести букв (русская
 * морфология даёт расхождение в окончаниях), результат сортируется.
 */
function smm_key(string $s): string {
    $s = mb_strtolower(trim($s), 'UTF-8');
    $s = preg_replace('~[^\p{L}\p{N}\s]+~u', ' ', $s) ?? '';
    $stop = ['и','в','на','с','по','для','как','что','это','не','от','за','из','у','о','об',
             'а','но','к','до','же','ли','бы','при','во','со','the','a','of'];
    $out = [];
    foreach (preg_split('~\s+~u', $s, -1, PREG_SPLIT_NO_EMPTY) ?: [] as $w) {
        if (in_array($w, $stop, true)) continue;
        if (mb_strlen($w, 'UTF-8') < 3) continue;
        $out[] = mb_substr($w, 0, 6, 'UTF-8');
    }
    $out = array_values(array_unique($out));
    sort($out);
    return implode(' ', $out);
}

/**
 * Свежа ли тема. Проверяются ТРИ вещи по отдельности, и любая совпавшая закрывает
 * тему: сама тема, факт и источник. Источник важен не меньше темы — три поста
 * подряд со ссылкой на одну и ту же Кэрол Двек читаются как один пост, даже если
 * темы формально разные.
 *
 * Сравнение не точное, а по доле общих корней: 60 % совпадения уже означает, что
 * читатель узнает текст.
 */
function smm_topic_is_fresh(string $topic, string $fact, string $source): array {
    $tk = smm_key($topic);
    $fk = smm_key($fact);
    $sk = smm_key($source);
    if ($tk === '') return [false, 'пустая тема'];

    $rows = all("SELECT topic, topic_key, fact, fact_key, source FROM smm_posts
                  WHERE status IN ('ready','published','draft')");
    foreach ($rows as $r) {
        if (smm_keys_close($tk, (string) $r['topic_key'])) return [false, 'тема повторяет: ' . $r['topic']];
        if ($fk !== '' && smm_keys_close($fk, (string) $r['fact_key'])) return [false, 'факт повторяет: ' . $r['fact']];
        if ($sk !== '' && $sk === smm_key((string) $r['source'])) return [false, 'источник уже был: ' . $r['source']];
    }
    return [true, ''];
}

/** Доля общих корней двух ключей. 0.6 и выше — считаем одним и тем же. */
function smm_keys_close(string $a, string $b): bool {
    if ($a === '' || $b === '') return false;
    if ($a === $b) return true;
    $wa = explode(' ', $a);
    $wb = explode(' ', $b);
    $common = count(array_intersect($wa, $wb));
    $min = min(count($wa), count($wb));
    if ($min === 0) return false;
    return ($common / $min) >= 0.6;
}

/* ------------------------------------------------------------------ *
 *  Живой контекст центра — чтобы темы росли из дела, а не из воздуха
 * ------------------------------------------------------------------ */

/**
 * Что сейчас происходит в центре. Модель, которой дали только «придумай тему про
 * музыку», выдаёт общие места и быстро начинает повторяться. Поэтому ей передаётся
 * живой срез: какие конкурсы открыты, сколько дней до закрытия приёма, какие
 * номинации заявлены, о чём спрашивают участники. Тема, выросшая из этого, не
 * повторяется сама собой — дело каждый месяц разное.
 */
function smm_context(): array {
    $ctx = ['competitions' => [], 'nominations' => [], 'questions' => []];

    $ctx['competitions'] = all(
        "SELECT name, type, is_paid, price, end_date, results_date, duration
           FROM competitions
          WHERE status = 'open' AND COALESCE(launched,0) = 1
          ORDER BY sort LIMIT 6"
    );

    if (tbl_exists('applications')) {
        $ctx['nominations'] = array_column(all(
            "SELECT nomination, COUNT(*) c FROM applications
              WHERE created_at >= date('now','-45 days') AND COALESCE(nomination,'') <> ''
           GROUP BY nomination ORDER BY c DESC LIMIT 12"
        ), 'nomination');
    }

    /* Вопросы участников — самый честный источник тем: человек спросил, значит
       это его болит. Берём из переписки чат-бота за последние недели. */
    if (tbl_exists('chat_messages')) {
        $ctx['questions'] = array_column(all(
            "SELECT text FROM chat_messages
              WHERE role = 'user' AND length(text) BETWEEN 25 AND 220
                AND created_at >= date('now','-30 days')
           ORDER BY RANDOM() LIMIT 25"
        ), 'text');
    }

    return $ctx;
}

/** Темы, которые уже вышли — передаются модели как прямой запрет. */
function smm_used_topics(int $limit = 400): array {
    return array_column(
        all("SELECT topic FROM smm_posts WHERE topic <> '' ORDER BY id DESC LIMIT " . $limit),
        'topic'
    );
}

/* ------------------------------------------------------------------ *
 *  Слой аудитории и ступень воронки
 * ------------------------------------------------------------------ */

/**
 * Какому слою адресован следующий пост. Утренний и вечерний пост одного дня
 * обязаны бить в разные слои: иначе лента целый день говорит с одним человеком,
 * а остальные три её пролистывают.
 */
function smm_pick_layer(string $slotDate, int $slotHour): string {
    $layers = ['родитель', 'педагог', 'участник', 'учреждение'];

    $recent = array_column(
        all("SELECT layer FROM smm_posts WHERE layer <> '' ORDER BY slot_date DESC, slot_hour DESC LIMIT 5"),
        'layer'
    );
    $sameDay = (string) (scalar(
        "SELECT layer FROM smm_posts WHERE slot_date = ? AND slot_hour <> ? LIMIT 1",
        [$slotDate, $slotHour]
    ) ?? '');

    $fresh = array_values(array_filter($layers, static function (string $l) use ($recent, $sameDay): bool {
        return $l !== $sameDay && !in_array($l, array_slice($recent, 0, 2), true);
    }));
    if (!$fresh) $fresh = array_values(array_filter($layers, static fn($l) => $l !== $sameDay));
    if (!$fresh) $fresh = $layers;

    return $fresh[array_rand($fresh)];
}

/**
 * Ступень воронки. Утро — знакомство и польза (1–3), вечер — ближе к действию
 * (4–7): человек вечером дочитывает и успевает подать заявку до ночи.
 */
function smm_pick_stage(int $slotHour): int {
    return $slotHour < 13 ? random_int(1, 3) : random_int(4, 7);
}

/** Формат картинки. Подряд один и тот же не ставим — лента становится однообразной. */
function smm_pick_ratio(): string {
    $last = (string) (scalar("SELECT ratio FROM smm_posts ORDER BY id DESC LIMIT 1") ?? '');
    $all  = ['16:9', '1:1', '4:3'];
    $free = array_values(array_filter($all, static fn($r) => $r !== $last));
    return $free[array_rand($free)];
}

/* ------------------------------------------------------------------ *
 *  Проверка готового текста
 * ------------------------------------------------------------------ */

/**
 * Последний рубеж перед очередью. Проверяются те правила, нарушение которых
 * участник увидит и которые стоят центру доверия.
 *
 * Запрет на обещание бесплатных благодарностей — не придирка: 02.10.2026 пост
 * «Концертмейстер» обещал бесплатную выдачу благодарственных писем и дипломов
 * куратора, а на сайте эта выдача выключена (curator_free_enabled=0, только
 * партнёрам от 5 заявок). Педагог пришёл бы за документом, которого нет.
 */
function smm_validate(string $body, string $textFull): array {
    $err = [];
    $len = mb_strlen($body, 'UTF-8');

    if ($len < SMM_BODY_MIN) $err[] = "тело поста короткое: {$len} знаков, нужно от " . SMM_BODY_MIN;
    if ($len > SMM_BODY_MAX) $err[] = "тело поста длинное: {$len} знаков, предел " . SMM_BODY_MAX;

    if (!str_contains($textFull, 'РЕСУРСЫ И КОНТАКТЫ')) $err[] = 'потерян футер';
    if (!str_contains($textFull, '+7 (999) 504-88-99')) $err[] = 'нет телефона центра';

    /* Телефон центра один. Любой другой номер в теле — чужой или устаревший. */
    if (preg_match_all('~\+7\s*\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}~u', $body, $m)) {
        foreach ($m[0] as $phone) {
            if (preg_replace('~\D~', '', $phone) !== '79995048899') $err[] = 'чужой телефон в тексте: ' . $phone;
        }
    }

    $lower = mb_strtolower($body, 'UTF-8');

    /* Telegram в постах не упоминаем — решение владельца. */
    foreach (['telegram', 'телеграм', 't.me'] as $w) {
        if (str_contains($lower, $w)) { $err[] = 'упоминание Telegram'; break; }
    }

    /* Обещание бесплатных благодарностей педагогам — только если выдача включена. */
    $freeOn = (int) setting('curator_free_enabled', '0') === 1;
    if (!$freeOn) {
        $hasThanks = str_contains($lower, 'благодарствен') || str_contains($lower, 'диплом куратора');
        $hasFree   = str_contains($lower, 'бесплатно') || str_contains($lower, 'без заказа');
        if ($hasThanks && $hasFree) {
            $err[] = 'обещание бесплатных благодарностей педагогам, а выдача выключена (curator_free_enabled=0)';
        }
    }

    /* ДИПЛОМ САМ НЕ ПРИХОДИТ — ОБЕЩАТЬ ЭТО НЕЛЬЗЯ.
     *
     * Автовыдача документов включена только у платных конкурсов
     * (cron/send_diplomas.php: c.is_paid=1). В бесплатных участник получает
     * РЕЗУЛЬТАТ — звание, — а сам диплом оформляет отдельно. Модель устойчиво
     * дописывает «официальный диплом придёт на указанную почту»: так вышло в
     * посте на 8 октября. Человек пришёл бы за документом, которого не получит, —
     * ровно та же история, что с бесплатными благодарностями педагогам. */
    $promisesDoc = preg_match('~(диплом|благодарност)\w*[^.]{0,80}(придёт|придет|приходит|поступит|отправим|пришлём|пришлем|получите)~ui', $body)
                || preg_match('~(придёт|придет|приходит|поступит)[^.]{0,60}(диплом|благодарност)~ui', $body);
    if ($promisesDoc && preg_match('~(почт|email|e-mail|кабинет)~ui', $body)) {
        $err[] = 'обещание, что документ придёт сам: в бесплатных конкурсах диплом оформляется отдельно';
    }

    /* Цена клуба в постах не пишется — решение владельца от 02.10.2026. */
    if (preg_match('~клуб~ui', $body) && preg_match('~\b\d{3,5}\s*(₽|руб)~ui', $body)) {
        $err[] = 'цена клуба в тексте поста';
    }

    /* КОНКУРСЫ ОНЛАЙН. Модель дописывает «приезжайте на площадку», «пройдите отбор»,
       «выступите на сцене перед жюри» — у центра ничего этого нет, участник
       записывает номер дома. Такой пост приводит человека не туда. */
    /* Слово ловится только без отрицания рядом: «без отборочного тура» и «никакого
       отбора нет» — правда про центр и писать так можно, а «пройдите отборочный
       тур» — выдумка. Первая версия проверки браковала как раз честные фразы. */
    foreach (['отборочн', 'отбор', 'приезжайт', 'очный тур', 'очного тура'] as $w) {
        $pos = mb_strpos($lower, $w, 0, 'UTF-8');
        if ($pos === false) continue;
        /* Окно берём по обе стороны одной строкой: отрицание стоит то перед словом
           («без отборочного тура»), то после («отбора нет»), а у слова в самом
           начале текста левого окна попросту не существует. */
        $from   = max(0, $pos - 45);
        $window = mb_substr($lower, $from, ($pos - $from) + mb_strlen($w, 'UTF-8') + 45, 'UTF-8');
        $denied = (bool) preg_match('~(без|нет|не\s|никак|минуя|не\s+нужн|не\s+требу|не\s+провод|не\s+предусмотр)~u', $window);
        if (!$denied) { $err[] = 'обещание того, чего у центра нет: ' . $w; break; }
    }

    /* Бот не гадает — пост тоже. Догадки о причинах запрещены (правило от 03.09). */
    foreach (['возможно, задержка', 'скорее всего банк', 'иногда бывает', 'проверим вручную'] as $w) {
        if (str_contains($lower, $w)) { $err[] = 'догадка вместо факта: ' . $w; break; }
    }

    return $err;
}

/* ------------------------------------------------------------------ *
 *  Сборка готового текста
 * ------------------------------------------------------------------ */

function smm_compose(string $body): string {
    return rtrim($body) . "\n\n" . SMM_FOOTER;
}

/* ------------------------------------------------------------------ *
 *  Очередь слотов
 * ------------------------------------------------------------------ */

/**
 * Рабочий ли это день для публикации. Воскресенье закрыто правилом владельца:
 * запись в чужой ленте в выходной читается как рассылка робота.
 */
function smm_is_work_day(string $date): bool {
    return (int) (new DateTime($date))->format('w') !== 0;
}

/**
 * Слоты, которые нужно заполнить на ближайшие дни. Конвейер смотрит вперёд, а не
 * в текущий час: картинка генерируется несколько минут, и готовить пост в момент
 * публикации — значит однажды опоздать и оставить день пустым.
 */
function smm_pending_slots(int $daysAhead = 3): array {
    $slots = [];
    $now   = new DateTime('now');
    for ($d = 0; $d <= $daysAhead; $d++) {
        $day = (clone $now)->modify("+{$d} day");
        $date = $day->format('Y-m-d');
        if (!smm_is_work_day($date)) continue;
        foreach ([SMM_SLOT_MORNING, SMM_SLOT_EVENING] as $h) {
            if ($d === 0 && (int) $now->format('G') >= $h) continue;   // час уже прошёл
            $exists = scalar("SELECT id FROM smm_posts WHERE slot_date = ? AND slot_hour = ?", [$date, $h]);
            if (!$exists) $slots[] = ['date' => $date, 'hour' => $h];
        }
    }
    return $slots;
}

/** Пост, который пора публиковать прямо сейчас. */
function smm_due_post(): ?array {
    $now  = new DateTime('now');
    $date = $now->format('Y-m-d');
    $hour = (int) $now->format('G');

    /* ПРОСРОЧЕННЫЙ ПОСТ НЕ ПРОПАДАЕТ, А УХОДИТ СЛЕДУЮЩИМ.
     *
     * Выборка смотрела только на сегодняшний день, и пост, чей час прошёл не по
     * своей вине — выключенная автопубликация, нерабочее воскресенье, лежачий
     * сервер, — назавтра уже никто не подбирал: он оставался в «готов» навсегда,
     * а труд и деньги на картинку пропадали. Два поста 6 октября так и повисли.
     *
     * Берём самый старый невыпущенный: лента идёт по порядку, и вчерашний текст
     * не устаревает — темы у нас не новостные. Один за раз, чтобы накопившийся
     * хвост не вывалился в ленту пачкой: по два поста в день он разойдётся сам. */
    $row = one(
        "SELECT * FROM smm_posts
          WHERE status = 'ready' AND attempts < 5
            AND (slot_date < ? OR (slot_date = ? AND slot_hour <= ?))
       ORDER BY slot_date, slot_hour LIMIT 1",
        [$date, $date, $hour]
    );
    return $row ?: null;
}

/* ------------------------------------------------------------------ *
 *  Расход на картинки
 * ------------------------------------------------------------------ */

/** Сколько потрачено на картинки за сегодня. */
function smm_spent_today(): float {
    return (float) (scalar(
        "SELECT COALESCE(SUM(image_cost),0) FROM smm_posts WHERE date(created_at) = date('now','localtime')"
    ) ?? 0);
}

/**
 * Можно ли потратить ещё. Предел задаёт владелец настройкой smm_image_budget_day.
 * Ноль означает «генерация картинок выключена» — конвейер тогда собирает текст и
 * оставляет пост без картинки, но не тратит ни копейки молча.
 */
function smm_budget_ok(float $cost): bool {
    $limit = (float) setting('smm_image_budget_day', '0.5');
    return (smm_spent_today() + $cost) <= $limit;
}
