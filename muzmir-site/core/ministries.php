<?php
/**
 * БАЗА ВЕДОМСТВ И ОРГАНИЗАЦИЙ, У КОТОРЫХ МЫ ПРОСИМ ИНФОРМАЦИОННУЮ ПОДДЕРЖКУ.
 *
 * Это не рассылочная база. Здесь несколько сотен адресов, и каждый попал сюда
 * после проверки на официальном сайте ведомства — с сохранённой ссылкой на
 * страницу, откуда адрес взят. Письмо уходит на бланке, за подписью, с печатью
 * и исходящим номером; ответ ведомства мы вешаем в раздел «Письма поддержки».
 *
 * ЧЕМ ЭТО ОТЛИЧАЕТСЯ ОТ БАЗЫ УЧРЕЖДЕНИЙ (core/institutions.php):
 * учреждениям мы предлагаем участие, ведомствам — сообщаем о конкурсах и просим
 * разместить анонс. Тексты, тон и периодичность разные, поэтому и таблицы разные.
 *
 * ВАЖНАЯ ОГОВОРКА ПРО ЯЩИКИ ПРЕСС-СЛУЖБ. У части ведомств на сайте прямо
 * написано, что обращения организаций по адресу пресс-службы НЕ рассматриваются
 * (например, у Минпросвещения). Поэтому у каждой записи есть ветка: main —
 * канцелярия, туда идёт официальное обращение; press — пресс-служба, туда идёт
 * просьба разместить анонс. Слать обращение в пресс-службу бессмысленно, а слать
 * анонс в канцелярию — невежливо.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

/* =====================================================================
 *  Хранилище
 * ===================================================================== */

function min_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;

    db()->exec("
    CREATE TABLE IF NOT EXISTS ministries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org         TEXT NOT NULL,
        short       TEXT DEFAULT '',
        region      TEXT DEFAULT '',
        kind        TEXT DEFAULT 'culture',   -- federal|culture|education|union|media|other
        branch      TEXT DEFAULT 'main',      -- main (канцелярия) | press (пресс-служба)
        email       TEXT DEFAULT '',
        person      TEXT DEFAULT '',          -- ФИО руководителя, если известно
        person_role TEXT DEFAULT '',          -- «Министру культуры ... области»
        site        TEXT DEFAULT '',
        source_url  TEXT DEFAULT '',          -- где именно взят адрес
        note        TEXT DEFAULT '',
        status      TEXT DEFAULT 'new',       -- new|sent|replied|supported|declined|bounced|unsub
        checked_at  TEXT DEFAULT '',
        last_sent_at TEXT DEFAULT '',
        last_number TEXT DEFAULT '',
        sent_count  INTEGER DEFAULT 0,
        replied_at  TEXT DEFAULT '',
        created_at  TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_min_email ON ministries(email);
    CREATE INDEX IF NOT EXISTS idx_min_kind   ON ministries(kind);
    CREATE INDEX IF NOT EXISTS idx_min_status ON ministries(status);
    ");

    // СЛЕД СВЕРКИ. Реестр Минкультуры — снимок, а не живые данные: руководители
    // меняются, ведомственные ящики умирают. Именно поэтому обращение ушло на
    // «Майер Е. В.», которую сменили полтора года назад, и на ящик Удмуртии,
    // отключённый в 2019-м. Теперь у каждой записи видно, когда её последний раз
    // сверяли с официальным сайтом, по какой ссылке и насколько уверенно.
    foreach ([
        ['verified_at',      "TEXT DEFAULT ''"],   // дата последней сверки с сайтом ведомства
        ['verify_url',       "TEXT DEFAULT ''"],   // конкретная страница, где увидены ФИО и должность
        ['verify_conf',      "TEXT DEFAULT ''"],   // high | medium | low
        ['e_reception_url',  "TEXT DEFAULT ''"],   // электронная приёмная (форма обращения граждан)
        ['phone',            "TEXT DEFAULT ''"],
        ['post_address',     "TEXT DEFAULT ''"],
        ['appointed',        "TEXT DEFAULT ''"],   // с какой даты руководитель в должности
        // Должность в ИМЕНИТЕЛЬНОМ падеже, как она написана на сайте ведомства.
        // В person_role она лежит в дательном — этого требует реквизит «адресат»
        // по ГОСТ. Но в благодарственном письме нужен именительный: «Награждается
        // Иванова Ольга Петровна, министр культуры области». Склонять дательный
        // обратно — плодить ошибки на ровном месте, поэтому исходную форму просто
        // храним рядом: сверка её и так приносит.
        ['person_role_nom',  "TEXT DEFAULT ''"],
        // ЭТОМУ ВЕДОМСТВУ НУЖНО СОПРОВОДИТЕЛЬНОЕ ПИСЬМО ОТДЕЛЬНЫМ ФАЙЛОМ.
        // Система электронного документооборота части ведомств не принимает
        // документ, пришедший без сопроводительного: «Культура.РФ» дважды
        // вернула обращение с формулировкой «Документ к рассмотрению не
        // принимается – отсутствует сопроводительное письмо». Ставится вручную
        // и автоматически — по такому ответу (см. min_reply_apply()).
        ['needs_cover',      "INTEGER DEFAULT 0"],
        // ВЕДОМСТВО ПРИНИМАЕТ ОБРАЩЕНИЯ ТОЛЬКО ЧЕРЕЗ ЭЛЕКТРОННУЮ ПРИЁМНУЮ.
        // После 547-ФЗ таких всё больше: письмо на ящик они не регистрируют
        // вовсе. Слать им почтой бессмысленно и невежливо — адрес закрываем и
        // показываем владельцу ссылку на приёмную (подача руками).
        ['portal_only',      "INTEGER DEFAULT 0"],
    ] as [$col, $type]) {
        try { db()->exec("ALTER TABLE ministries ADD COLUMN $col $type"); } catch (\Throwable $e) {}
    }
}

/**
 * ДОЛЖНОСТЬ В ДАТЕЛЬНЫЙ ПАДЕЖ — «Министр культуры» → «Министру культуры».
 *
 * В реквизите «адресат» по ГОСТ Р 7.0.97-2016 должность стоит в дательном, и
 * в базе она хранится уже в нём. Сверка приносит должность так, как она
 * написана на сайте ведомства, — в именительном.
 *
 * ПОЧЕМУ ЗДЕСЬ НЕ ОДНО СЛОВО. Прежняя версия склоняла только первое слово и
 * меняла в нём последнюю букву: «Руководитель» → «Руководителю». На
 * прилагательных это давало брак прямо в первой строке документа —
 * «Генеральныю директор», «Главныю редактор», «Первыю заместитель». Ошибка в
 * реквизите «адресат» — основание не регистрировать обращение, а обращение
 * отправляется один раз.
 *
 * Что склоняется, а что нет:
 *   Генеральный директор            → Генеральному директору   (прилагательное + существительное)
 *   Первый заместитель министра     → Первому заместителю министра
 *   Заведующий отделом рекламы      → Заведующему отделом рекламы (дальше творительный, не трогаем)
 *   Исполняющий обязанности министра→ Исполняющему обязанности министра
 *   Временно исполняющая обязанности→ Временно исполняющей обязанности
 *   Член Правительства — руководитель Департамента
 *                                   → Члену Правительства — руководителю Департамента
 * Хвост в родительном («культуры Республики Карелия») не меняется никогда.
 */
function min_role_dative(string $role): string {
    $role = trim(preg_replace('~\s+~u', ' ', $role) ?? '');
    if ($role === '') return '';

    // Составная должность: «Член Правительства области — руководитель Департамента».
    // Обе половины — самостоятельные адресаты, склонять надо каждую.
    if (preg_match('~\s[—–-]\s~u', $role)) {
        $out = preg_split('~(\s[—–-]\s)~u', $role, -1, PREG_SPLIT_DELIM_CAPTURE) ?: [$role];
        foreach ($out as $i => $piece) {
            if ($i % 2 === 0) $out[$i] = min_role_dative($piece);
        }
        return implode('', $out);
    }

    $parts = explode(' ', $role);
    $i = 0;

    // «Временно», «Постоянно» — наречия, они не склоняются и стоят впереди.
    while (isset($parts[$i]) && preg_match('~^(временно|постоянно)$~ui', $parts[$i])) $i++;

    // «Врио» и «И.о.» не склоняются — за ними сразу родительный падеж.
    if (isset($parts[$i]) && preg_match('~^(врио|и\.?\s?о\.?)$~ui', $parts[$i])) return $role;

    if (!isset($parts[$i])) return $role;

    $word  = $parts[$i];
    $lower = mb_strtolower($word);

    // Причастие: «Исполняющий», «Заведующий», «Управляющий». Оно само и есть
    // адресат, а следующее слово стоит в родительном или творительном
    // («обязанности министра», «отделом рекламы») и меняться не должно.
    if (preg_match('~(ущ|ющ|ащ|ящ)(ий|ая|ей|ему)$~u', $lower)) {
        $parts[$i] = min_word_dative_adj($word);
        return implode(' ', $parts);
    }

    // Прилагательное перед должностью: «Генеральный директор», «Первый
    // заместитель», «Главный редактор». Склоняются оба слова.
    if (preg_match('~(ый|ий|ой|ая|яя)$~u', $lower)) {
        $parts[$i] = min_word_dative_adj($word);
        if (isset($parts[$i + 1])) $parts[$i + 1] = min_word_dative_noun($parts[$i + 1]);
        return implode(' ', $parts);
    }

    $parts[$i] = min_word_dative_noun($word);
    return implode(' ', $parts);
}

/** Прилагательное или причастие в дательный: Генеральный → Генеральному, Исполняющая → Исполняющей. */
function min_word_dative_adj(string $w): string {
    $l = mb_strtolower($w);
    // Уже в дательном — второй раз не склоняем.
    if (preg_match('~(ому|ему|ой|ей)$~u', $l)) return $w;
    if (preg_match('~(ая|яя)$~u', $l)) {
        // Женский род: «Главная» → «Главной», но после шипящей — «ей»:
        // «Исполняющая» → «Исполняющей», а не «Исполняющой».
        $stem = mb_substr($w, 0, -2);
        return $stem . (mb_substr($l, -2) === 'яя' || preg_match('~[жчшщц]$~u', mb_strtolower($stem)) ? 'ей' : 'ой');
    }
    if (preg_match('~(ый|ой)$~u', $l))  return mb_substr($w, 0, -2) . 'ому';
    if (preg_match('~ий$~u', $l)) {
        // После шипящей и мягкой основы — «ему»: Исполняющий → Исполняющему,
        // Средний → Среднему. После твёрдой — «ому»: Второй → Второму.
        $stem = mb_substr($w, 0, -2);
        return $stem . (preg_match('~[жчшщнлр]$~u', mb_strtolower($stem)) ? 'ему' : 'ому');
    }
    return $w;
}

/** Существительное-должность в дательный: Министр → Министру, Глава → Главе. */
function min_word_dative_noun(string $w): string {
    $l = mb_strtolower($w);
    if (preg_match('~(у|ю|е)$~u', $l) && !preg_match('~(бюро|депо)$~u', $l)) return $w; // уже дательный
    $last = mb_substr($w, -1);
    if ($last === 'ь' || $last === 'й') return mb_substr($w, 0, -1) . 'ю';   // Руководитель → Руководителю
    if ($last === 'а' || $last === 'я') return mb_substr($w, 0, -1) . 'е';   // Глава → Главе
    if (preg_match('~[бвгджзклмнпрстфхцчшщ]$~u', $l)) return $w . 'у';       // Министр → Министру
    return $w;
}

/** Сколько дней сверка считается свежей. Полгода: руководителей меняют не чаще. */
function min_verify_ttl_days(): int {
    return max(1, (int) setting('ministry_verify_ttl_days', '180'));
}

/**
 * Сверена ли запись достаточно недавно и достаточно уверенно, чтобы слать письмо.
 *
 * Обращение именное и отправляется один раз. Ошибка в фамилии — отказ в
 * регистрации обращения, как ответил департамент культуры Тюменской области.
 * Поэтому «не сверено» и «сверено давно» здесь равны «не отправлять».
 */
function min_is_verified(array $m): bool {
    if ((string) ($m['verify_conf'] ?? '') !== 'high') return false;
    $at = trim((string) ($m['verified_at'] ?? ''));
    if ($at === '') return false;
    $ts = strtotime($at);
    return $ts > 0 && $ts >= strtotime('-' . min_verify_ttl_days() . ' days');
}

/**
 * Черновики постов о поддержке.
 *
 * Когда ведомство отвечает, готовится пост во ВКонтакте — «наши конкурсы
 * поддерживает такое-то министерство». Автоматически он НЕ публикуется:
 * заявление от чужого имени должно уходить с ведома владельца, поэтому пост
 * ждёт кнопки в админке.
 */
function min_posts_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS ministry_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            letter_email TEXT DEFAULT '',
            org TEXT DEFAULT '',
            text TEXT DEFAULT '',
            image_path TEXT DEFAULT '',
            status TEXT DEFAULT 'draft',      -- draft|published|skipped
            vk_post_id TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            published_at TEXT DEFAULT ''
        )");
    } catch (\Throwable $e) {}
}

/** Адрес выглядит рабочим. Заглушки вроде info@example.com сюда не пройдут. */
function min_email_ok(string $e): bool {
    $e = mb_strtolower(trim($e));
    if ($e === '' || !filter_var($e, FILTER_VALIDATE_EMAIL)) return false;
    if (preg_match('~^(no-?reply|noreply|donotreply|postmaster|abuse|webmaster|test)@~i', $e)) return false;
    if (preg_match('~@(example|test|localhost|mail\.ru\.com)~i', $e)) return false;
    return true;
}

/**
 * Кириллический домен → punycode.
 *
 * У «Русского Музыкального Общества» ящик на домене рмо.рф. Почтовые библиотеки
 * такой адрес принимают не всегда, а сервер — почти никогда. Храним оба вида:
 * в базе человеческий, при отправке подставляем машинный.
 */
function min_email_ascii(string $e): string {
    $e = mb_strtolower(trim($e));
    $at = mb_strrpos($e, '@');
    if ($at === false) return $e;
    $box = mb_substr($e, 0, $at);
    $dom = mb_substr($e, $at + 1);
    if (preg_match('~^[a-z0-9.\-]+$~', $dom)) return $e;
    if (!function_exists('idn_to_ascii')) return $e;
    $p = @idn_to_ascii($dom, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
    return $p ? ($box . '@' . $p) : $e;
}

/**
 * Добавляет или дополняет запись. Дедупликация по адресу.
 *
 * Возвращает 1 если запись новая, 0 если только дополнили существующую.
 * Пустые поля заполняем, заполненные не трогаем: адрес, проверенный руками,
 * не должен затираться результатом автоматического обхода.
 */
/**
 * КУДА ОБРАЩЕНИЕ ПРОСТО НЕ ПИШУТ.
 *
 * Правило владельца: структуры при Президенте, аппараты и приёмные обращений
 * граждан из рассылки исключены. Причина не в вежливости. Письмо туда попадает
 * не в отдел по работе со СМИ, а в реестр обращений по 59-ФЗ: его обязаны
 * зарегистрировать, поставить срок и дать формальный ответ. Информационной
 * поддержки конкурса это не даёт, зато создаёт переписку с госорганом на ровном
 * месте.
 *
 * Профильные министерства культуры и образования сюда НЕ относятся: ради них
 * рассылка и затевалась, и у них есть отделы, которые такие письма как раз ждут.
 *
 * Регистр приводим в PHP: SQLite умеет LOWER() только для латиницы, и проверка
 * прямо в SQL молча пропускала бы «Президентский» с заглавной буквы.
 */
function min_is_forbidden(string $org, string $email = ''): bool {
    static $stop = [
        'президент', 'администрация президента', 'аппарат ', 'полпред', 'полномочн',
        'уполномоч', 'омбудсм', 'общественная палата', 'прокурат', 'следственн',
        'государственная дума', 'совет федерации', 'росгвард',
    ];
    $hay = mb_strtolower($org . ' ' . $email);
    foreach ($stop as $s) if (mb_strpos($hay, $s) !== false) return true;
    return false;
}

function min_add(array $d): int {
    min_migrate();

    $email = mb_strtolower(trim((string) ($d['email'] ?? '')));
    if (!min_email_ok($email)) return 0;

    $org = trim((string) ($d['org'] ?? ''));
    if ($org === '') return 0;
    if (min_is_forbidden($org, $email)) return 0;

    $row = one("SELECT * FROM ministries WHERE email=?", [$email]);

    $map = [
        'org' => $org,
        'short'       => trim((string) ($d['short'] ?? '')),
        'region'      => trim((string) ($d['region'] ?? '')),
        'kind'        => trim((string) ($d['kind'] ?? 'culture')),
        'branch'      => ((string) ($d['branch'] ?? 'main')) === 'press' ? 'press' : 'main',
        'email'       => $email,
        'person'      => trim((string) ($d['person'] ?? '')),
        'person_role' => trim((string) ($d['person_role'] ?? '')),
        'site'        => trim((string) ($d['site'] ?? '')),
        'source_url'  => trim((string) ($d['source_url'] ?? '')),
        'note'        => trim((string) ($d['note'] ?? '')),
    ];

    if (!$row) {
        try { insert('ministries', $map); } catch (\Throwable $e) { return 0; }
        return 1;
    }

    $upd = [];
    foreach ($map as $k => $v) {
        if ($k === 'email' || $v === '') continue;
        if (trim((string) ($row[$k] ?? '')) === '') $upd[$k] = $v;
    }
    if ($upd) { try { update('ministries', $upd, 'id=?', [(int) $row['id']]); } catch (\Throwable $e) {} }
    return 0;
}

/** Кому сейчас можно писать: адрес живой, отписки и отказа не было. */
function min_recipients(string $branch = ''): array {
    min_migrate();
    // excluded — адресат снят владельцем насовсем. Так помечены структуры при
    // Президенте и Общественная палата: это приёмные обращений граждан, а не
    // адресаты информационной поддержки конкурса. Ответа по существу оттуда не
    // будет, а обращение уйдёт в реестр со сроками и последствиями.
    // БЕЗ ФИО И БЕЗ СВЕЖЕЙ СВЕРКИ ОБРАЩЕНИЕ НЕ УХОДИТ.
    //
    // Обращение в ведомство именное: реквизит «адресат» по ГОСТ Р 7.0.97-2016 и
    // «Уважаемый Иван Иванович!» в тексте. Отправляется один раз, переделать
    // нельзя. 12.08.2026 письма ушли по несверенным данным из реестра Минкультуры
    // — департамент культуры Тюменской области ответил отказом в регистрации,
    // потому что названный руководитель сменился ещё в феврале 2025-го, а письмо
    // в Минкультуры Удмуртии ушло на ящик, отключённый в 2019-м.
    //
    // Поэтому адресат должен быть не просто с именем, а с именем, СВЕРЕННЫМ на
    // официальном сайте ведомства не позже полугода назад. Несверенный адресат
    // ждёт сверки — это отложенная отправка, а не потеря.
    //
    // Исключение — пресс-службы и редакции (branch='press'): там адресат по
    // должности не подразумевается, письмо идёт на редакционный ящик.
    // Ведомство, принимающее обращения только через интернет-приёмную, из волны
    // исключено: письмо на его ящик там не регистрируют вовсе, и слать его —
    // напрасно тратить репутацию kc@ на заведомо непрочитанное. Такие подаются
    // руками по ссылке из e_reception_url.
    $sql = "SELECT * FROM ministries
             WHERE email<>'' AND status NOT IN ('unsub','bounced','declined','excluded')
               AND COALESCE(portal_only,0) = 0
               AND (branch = 'press'
                    OR (TRIM(COALESCE(person,'')) <> '' AND TRIM(COALESCE(person_role,'')) <> ''))";
    $a = [];
    if ($branch !== '') { $sql .= " AND branch=?"; $a[] = $branch; }
    $sql .= " ORDER BY CASE kind WHEN 'federal' THEN 0 WHEN 'union' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, org";
    $rows = all($sql, $a);

    // Свежесть сверки проверяем в PHP: условие «не старше N дней» в SQLite пришлось
    // бы дублировать вместе с правилом уверенности, а правило одно — min_is_verified().
    $rows = array_values(array_filter($rows, 'min_is_verified'));

    // ОДНО ВЕДОМСТВО — ОДНО ПИСЬМО.
    return min_dedupe_by_org($rows);
}

/**
 * ОДНО ВЕДОМСТВО — ОДНО ПИСЬМО.
 *
 * В базе у одного ведомства бывает несколько ящиков: у департамента культуры
 * Брянской области их два (dep.kult32@ и upr.kult32@), у Забайкалья тоже два.
 * Реестр собирал все адреса подряд, и обращение уходило в одно ведомство дважды
 * — с разными исходящими номерами. Для делопроизводителя это два разных
 * документа, которые он обязан зарегистрировать оба.
 *
 * Здесь на каждое ведомство остаётся ровно один адресат. Выбираем лучший:
 *
 *   1. адрес на домене ведомства или органа власти (.gov.ru, mos.ru, belgov.ru)
 *      — он переживёт смену подрядчика и точно принимает почту;
 *   2. любой адрес не на бесплатном почтовике;
 *   3. что осталось.
 *
 * Пресс-служба (branch='press') — ОТДЕЛЬНЫЙ адресат, а не дубль: у неё своя
 * задача, своё письмо об освещении и свой ящик редакции. Её мы не схлопываем,
 * но и в счёт «одно письмо ведомству» не берём.
 */
function min_dedupe_by_org(array $rows): array {
    // Регион пишут по-разному: «Брянская область» и «Брянская обл.» — один и тот
    // же субъект, но как ключ это две разные строки, и департамент культуры
    // Брянской области оставался в списке дважды. Сокращения разворачиваем.
    $norm = static function (string $s): string {
        $s = mb_strtolower(trim($s));
        $s = strtr($s, [
            'обл.' => 'область', ' обл ' => ' область ',
            'респ.' => 'республика', 'кр.' => 'край',
            'а.о.' => 'автономный округ', 'ао' => 'автономный округ',
            'г.' => '', 'ё' => 'е',
        ]);
        $s = preg_replace('~[^\p{L}\p{N} ]+~u', ' ', $s) ?? $s;
        return trim(preg_replace('~\s+~u', ' ', $s) ?? $s);
    };
    $key = static function (array $m) use ($norm): string {
        // Отрезаем приписки вида «, пресс-служба» и «— для СМИ»: это одно ведомство.
        $o = (string) ($m['org'] ?? '');
        $o = preg_replace('~\s*[,—–].*$~u', '', $o) ?? $o;
        return $norm($o) . '|' . $norm((string) ($m['region'] ?? ''));
    };
    $rank = static function (array $m): int {
        $e = mb_strtolower((string) ($m['email'] ?? ''));
        $dom = (string) (explode('@', $e)[1] ?? '');
        if ($dom === '') return 9;
        if (preg_match('~\.(gov\.ru|gov\.spb\.ru)$~', $dom)) return 0;
        if (preg_match('~(^|\.)(mos\.ru|nso\.ru|donland\.ru|tatar\.ru|belgov\.ru|kbr\.ru)$~', $dom)) return 0;
        if (preg_match('~\.ru$~', $dom) && !preg_match('~(mail|yandex|list|bk|inbox|rambler|gmail|yahoo)\.~', $dom)) return 1;
        return 2;
    };

    $best = [];
    foreach ($rows as $m) {
        // Пресс-служба идёт своей строкой и в схлопывание не попадает.
        if ((string) ($m['branch'] ?? 'main') === 'press') { $best['press:' . (int) $m['id']] = $m; continue; }
        $k = $key($m);
        if (!isset($best[$k]) || $rank($m) < $rank($best[$k])) $best[$k] = $m;
    }

    // ВТОРОЙ ПРОХОД — ПО РУКОВОДИТЕЛЮ.
    //
    // Схлопывания по названию мало: одно ведомство записано в базе по-разному и
    // расходится по разным ключам. «Министерство культуры Новгородской области» и
    // «Министерство культуры и туризма Новгородской области», «Департамент культуры
    // Костромской области» и он же «(прежний адрес)», «(второй ящик)» у Смоленска.
    // Обращение именное: два письма одному человеку — это два документа, которые
    // делопроизводитель обязан зарегистрировать оба, с разными исходящими номерами.
    //
    // Поэтому решает не строка названия, а адресат: одному руководителю — одно
    // обращение, на лучший из его адресов. Однофамильцы здесь не мешают: ключ —
    // фамилия, имя и отчество целиком.
    $byPerson = [];
    foreach ($best as $k => $m) {
        $fio = $norm((string) ($m['person'] ?? ''));
        if ($fio === '' || (string) ($m['branch'] ?? 'main') === 'press') { $byPerson['k:' . $k] = $m; continue; }
        $p = 'p:' . $fio;
        if (!isset($byPerson[$p]) || $rank($m) < $rank($byPerson[$p])) $byPerson[$p] = $m;
    }
    return array_values($byPerson);
}

function min_mark_sent(int $id, string $number): void {
    min_migrate();
    try {
        q("UPDATE ministries SET status=CASE WHEN status='new' THEN 'sent' ELSE status END,
             last_sent_at=datetime('now','localtime'), last_number=?, sent_count=sent_count+1 WHERE id=?",
          [$number, $id]);
    } catch (\Throwable $e) {}
}

function min_mark_replied(string $email, string $status = 'replied'): void {
    min_migrate();
    $ok = ['replied', 'supported', 'declined'];
    if (!in_array($status, $ok, true)) $status = 'replied';
    try {
        q("UPDATE ministries SET status=?, replied_at=datetime('now','localtime') WHERE email=?",
          [$status, mb_strtolower(trim($email))]);
    } catch (\Throwable $e) {}
}

function min_unsubscribe(string $email): void {
    min_migrate();
    try { q("UPDATE ministries SET status='unsub' WHERE email=?", [mb_strtolower(trim($email))]); }
    catch (\Throwable $e) {}
}

function min_stats(): array {
    min_migrate();
    $s = [
        'total'    => (int) scalar("SELECT COUNT(*) FROM ministries"),
        'ready'    => (int) scalar("SELECT COUNT(*) FROM ministries WHERE email<>'' AND status NOT IN ('unsub','bounced','declined')"),
        'by_kind'  => [], 'by_status' => [], 'regions' => 0,
    ];
    foreach (all("SELECT kind, COUNT(*) n FROM ministries GROUP BY kind ORDER BY n DESC") as $r) {
        $s['by_kind'][(string) $r['kind']] = (int) $r['n'];
    }
    foreach (all("SELECT status, COUNT(*) n FROM ministries GROUP BY status ORDER BY n DESC") as $r) {
        $s['by_status'][(string) $r['status']] = (int) $r['n'];
    }
    $s['regions'] = (int) scalar("SELECT COUNT(DISTINCT region) FROM ministries WHERE region<>'' AND region<>'федеральный'");
    return $s;
}

function min_kind_ru(string $k): string {
    return [
        'federal'   => 'Федеральные ведомства',
        'culture'   => 'Региональная культура',
        'education' => 'Региональное образование',
        'union'     => 'Творческие союзы',
        'media'     => 'Порталы и СМИ',
        'other'     => 'Прочие',
    ][$k] ?? $k;
}

function min_status_ru(string $s): string {
    return [
        'new'       => 'ещё не писали',
        'sent'      => 'письмо отправлено',
        'replied'   => 'ответили',
        'supported' => 'поддержали',
        'declined'  => 'отказали',
        'bounced'   => 'адрес не принимает',
        'unsub'     => 'просили не писать',
    ][$s] ?? $s;
}

/* =====================================================================
 *  Проверенный список
 * ===================================================================== */

/**
 * Заносит проверенные адреса в базу. Повторный вызов безопасен.
 *
 * Каждый адрес взят со страницы «Контакты» официального сайта ведомства —
 * ссылка сохранена в source_url, чтобы через полгода не гадать, откуда он.
 * Агрегаторы (rusprofile и подобные) как источник не использовались: там
 * адреса устаревают и попадают чужие.
 */
function min_seed(): int {
    min_migrate();
    $n = 0;
    foreach (min_seed_rows() as $r) $n += min_add($r);
    return $n;
}

function min_seed_rows(): array {
    return [
        /* ── Федеральные ведомства ─────────────────────────────────────── */
        ['org' => 'Министерство культуры Российской Федерации', 'short' => 'Минкультуры России',
         'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'mail@culture.gov.ru', 'site' => 'https://culture.gov.ru',
         'source_url' => 'https://culture.gov.ru/contacts/',
         'note' => 'Приёмная. На сайте оговорка: ящик только для документов организаций, одно письмо — одно сообщение, ссылки и архивы не принимаются. Наше обращение на бланке одним файлом подходит.'],
        ['org' => 'Министерство культуры Российской Федерации, пресс-служба', 'short' => 'Минкультуры России',
         'kind' => 'federal', 'branch' => 'press', 'region' => 'федеральный',
         'email' => 'pressa@culture.gov.ru', 'source_url' => 'https://culture.gov.ru/press/',
         'note' => 'Для СМИ: запрос информации и аккредитация. Подходит для анонса.'],
        ['org' => 'Министерство просвещения Российской Федерации', 'short' => 'Минпросвещения России',
         'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'info@edu.gov.ru', 'site' => 'https://edu.gov.ru',
         'source_url' => 'https://edu.gov.ru/contact/', 'note' => 'Официальная почта министерства.'],
        ['org' => 'Министерство просвещения Российской Федерации, для СМИ', 'short' => 'Минпросвещения России',
         'kind' => 'federal', 'branch' => 'press', 'region' => 'федеральный',
         'email' => 'press@edu.gov.ru', 'source_url' => 'https://edu.gov.ru/contact/',
         'note' => 'ВНИМАНИЕ: на странице прямо написано, что обращения граждан и организаций по этому адресу НЕ рассматриваются. Только анонс как пресс-запрос; само обращение — на info@edu.gov.ru.'],
        ['org' => 'Министерство науки и высшего образования Российской Федерации', 'short' => 'Минобрнауки России',
         'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'info@minobrnauki.gov.ru', 'site' => 'https://minobrnauki.gov.ru',
         'source_url' => 'https://minobrnauki.gov.ru/contacts/',
         'note' => 'На сайте прямо указано: письма от организаций направлять сюда на официальном бланке.'],
        ['org' => 'Министерство науки и высшего образования Российской Федерации, пресс-служба', 'short' => 'Минобрнауки России',
         'kind' => 'federal', 'branch' => 'press', 'region' => 'федеральный',
         'email' => 'press@minobrnauki.gov.ru', 'source_url' => 'https://minobrnauki.gov.ru/press-center/kontakty-press-tsentra/'],
        ['org' => 'Министерство науки и высшего образования Российской Федерации, для журналистов', 'short' => 'Минобрнауки России',
         'kind' => 'federal', 'branch' => 'press', 'region' => 'федеральный',
         'email' => 'pr@minobrnauki.gov.ru', 'source_url' => 'https://minobrnauki.gov.ru/press-center/kontakty-press-tsentra/'],
        ['org' => 'Федеральное агентство по делам молодёжи (Росмолодёжь)', 'short' => 'Росмолодёжь',
         'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'op@fadm.gov.ru', 'site' => 'https://fadm.gov.ru'],
        ['org' => 'Президентский фонд культурных инициатив', 'short' => 'ПФКИ',
         'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'office@pfci.ru', 'site' => 'https://фондкультурныхинициатив.рф'],
        ['org' => 'Президентский фонд культурных инициатив, пресс-служба', 'short' => 'ПФКИ',
         'kind' => 'federal', 'branch' => 'press', 'region' => 'федеральный', 'email' => 'media@pfci.ru'],
        ['org' => 'Российский фонд культуры', 'short' => 'РФК',
         'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'info@rcfoundation.ru', 'site' => 'https://rcfoundation.ru'],
        ['org' => 'Российский фонд культуры, пресс-служба', 'short' => 'РФК',
         'kind' => 'federal', 'branch' => 'press', 'region' => 'федеральный', 'email' => 'press@rcfoundation.ru'],
        ['org' => 'ФГБУК «Центр культурных стратегий и проектного управления» (РОСКУЛЬТПРОЕКТ)', 'short' => 'РОСКУЛЬТПРОЕКТ',
         'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'office@roskultproekt.ru', 'site' => 'https://www.roskultproekt.ru',
         'note' => 'Сертификат выписан только на www — обращаться по адресу с www.'],
        ['org' => 'ФГБУК «Государственный Российский Дом народного творчества имени В.Д. Поленова»', 'short' => 'ГРДНТ',
         'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'grdnt@rusfolk.ru', 'site' => 'https://rusfolk.ru',
         'note' => 'Профильная организация по любительскому творчеству — прямо наша тема.'],
        ['org' => 'Центр русского фольклора ГРДНТ им. В.Д. Поленова', 'short' => 'Центр русского фольклора',
         'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'info@folkcentr.ru', 'site' => 'https://folkcentr.ru'],

        /* ── Творческие союзы ──────────────────────────────────────────── */
        ['org' => 'Всероссийская общественная организация «Союз композиторов России»', 'short' => 'Союз композиторов России',
         'kind' => 'union', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'uc@unioncomposers.ru', 'site' => 'https://unioncomposers.ru',
         'source_url' => 'https://unioncomposers.ru/contacts'],
        ['org' => 'Всероссийская общественная организация «Союз композиторов России», для СМИ', 'short' => 'Союз композиторов России',
         'kind' => 'union', 'branch' => 'press', 'region' => 'федеральный',
         'email' => 'pressa@unioncomposers.ru', 'source_url' => 'https://unioncomposers.ru/contacts'],
        ['org' => 'Союз театральных деятелей Российской Федерации', 'short' => 'СТД РФ',
         'kind' => 'union', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'stdrf@stdrf.ru', 'site' => 'https://stdrf.ru',
         'source_url' => 'https://stdrf.ru/kontakti/',
         'note' => 'Приёмная председателя, она же вход для входящей корреспонденции.'],
        ['org' => 'Союз театральных деятелей Российской Федерации, пресс-служба', 'short' => 'СТД РФ',
         'kind' => 'union', 'branch' => 'press', 'region' => 'федеральный',
         'email' => 'pr_stdrf@stdrf.ru', 'source_url' => 'https://stdrf.ru/kontakti/'],
        ['org' => 'Союз театральных деятелей Российской Федерации, Кабинет театров для детей и театров кукол',
         'short' => 'СТД РФ', 'kind' => 'union', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'detkuk@stdrf.ru', 'source_url' => 'https://stdrf.ru/kontakti/',
         'note' => 'Детское направление — самый близкий нам адресат в СТД.'],
        ['org' => 'Всероссийская творческая общественная организация «Союз художников России»', 'short' => 'Союз художников России',
         'kind' => 'union', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'sekret-shr@mail.ru', 'site' => 'https://shr.su', 'source_url' => 'https://shr.su/'],
        ['org' => 'Союз писателей России', 'short' => 'СП России',
         'kind' => 'union', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'info@sprf.ru', 'site' => 'https://sprf.ru',
         'note' => 'Имеет смысл продублировать бумажным письмом: Москва, Комсомольский пр-т, 13.'],
        ['org' => 'Общероссийская общественная организация «Союз российских писателей»', 'short' => 'СРП',
         'kind' => 'union', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'info@writers.ru', 'source_url' => 'https://www.writers.ru/contact/'],
        ['org' => 'Межрегиональная общественная организация «Русское Музыкальное Общество»', 'short' => 'РМО',
         'kind' => 'union', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'info@рмо.рф', 'site' => 'https://рмо.рф',
         'note' => 'Домен кириллический — при отправке подставляем punycode.'],
        ['org' => 'Межрегиональная общественная организация «Русское Музыкальное Общество», для СМИ', 'short' => 'РМО',
         'kind' => 'union', 'branch' => 'press', 'region' => 'федеральный', 'email' => 'pr@рмо.рф'],

        /* ── Порталы, площадки анонсов и СМИ ───────────────────────────── */
        ['org' => 'Про.Культура.РФ (АИС ЕИПСК)', 'short' => 'Про.Культура.РФ',
         'kind' => 'media', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'pro@team.culture.ru', 'site' => 'https://pro.culture.ru',
         'note' => 'Площадка, где учреждения культуры публикуют события. Анонс конкурса здесь видят тысячи ДШИ и ДК.'],
        ['org' => 'Портал «Культура.РФ»', 'short' => 'Культура.РФ',
         'kind' => 'media', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'cultrf@mkrf.ru', 'site' => 'https://culture.ru'],
        ['org' => 'Портал «Культура.РФ», пресс-служба', 'short' => 'Культура.РФ',
         'kind' => 'media', 'branch' => 'press', 'region' => 'федеральный', 'email' => 'pr@team.culture.ru'],
        ['org' => 'Портал «Культура.РФ», проект «Культурный стриминг»', 'short' => 'Культура.РФ',
         'kind' => 'media', 'branch' => 'main', 'region' => 'федеральный', 'email' => 'stream@team.culture.ru'],
        ['org' => 'Газета «Музыкальное обозрение»', 'short' => 'Музыкальное обозрение',
         'kind' => 'media', 'branch' => 'press', 'region' => 'федеральный', 'email' => 'muzobozrenie@mail.ru',
         'note' => 'Профильное музыкальное издание, охват — музыкальные школы и училища страны.'],
        ['org' => 'Общественная палата Российской Федерации, пресс-служба', 'short' => 'ОП РФ',
         'kind' => 'federal', 'branch' => 'press', 'region' => 'федеральный', 'email' => 'press@oprf-media.ru'],
        ['org' => 'Общественная палата Российской Федерации, редакция сайта', 'short' => 'ОП РФ',
         'kind' => 'federal', 'branch' => 'press', 'region' => 'федеральный', 'email' => 'oprf22@mail.ru'],
        ['org' => 'Общественная палата Российской Федерации, редакция сайта (второй адрес)', 'short' => 'ОП РФ',
         'kind' => 'federal', 'branch' => 'press', 'region' => 'федеральный', 'email' => 'oprf333@mail.ru'],
        ['org' => 'Секретариат Уполномоченного при Президенте Российской Федерации по правам ребёнка',
         'short' => 'Детский омбудсмен', 'kind' => 'federal', 'branch' => 'main', 'region' => 'федеральный',
         'email' => 'obr@deti.gov.ru', 'site' => 'https://deti.gov.ru'],

        /* ── Региональные органы культуры (проверены поимённо) ─────────── */
        ['org' => 'Министерство культуры Белгородской области', 'kind' => 'culture', 'region' => 'Белгородская область',
         'email' => 'mkbo@belgov.ru', 'site' => 'https://kult.belregion.ru', 'source_url' => 'https://kult.belregion.ru/kontakty'],
        ['org' => 'Департамент культуры Брянской области', 'kind' => 'culture', 'region' => 'Брянская область',
         'email' => 'dep.kult32@yandex.ru', 'site' => 'https://kultura32.ru', 'source_url' => 'https://kultura32.ru/kontakty.html',
         'note' => 'Ящик только для документов организаций: одно письмо — одно сообщение, ссылки не принимаются.'],
        ['org' => 'Департамент культуры и туризма Ивановской области', 'kind' => 'culture', 'region' => 'Ивановская область',
         'email' => 'dkt@ivanovoobl.ru', 'site' => 'https://dkt.ivanovoobl.ru', 'source_url' => 'https://dkt.ivanovoobl.ru/kontakty/'],
        ['org' => 'Департамент культуры и туризма Ивановской области, отдел', 'kind' => 'culture', 'region' => 'Ивановская область',
         'email' => 'kult_org05@ivreg.ru', 'source_url' => 'https://dkt.ivanovoobl.ru/kontakty/'],
        ['org' => 'Министерство культуры и туризма Калужской области', 'kind' => 'culture', 'region' => 'Калужская область',
         'email' => 'minkult@adm.kaluga.ru', 'site' => 'https://minkult.admoblkaluga.ru'],
        ['org' => 'Департамент культуры Костромской области', 'kind' => 'culture', 'region' => 'Костромская область',
         'email' => 'dkko@kostroma.gov.ru', 'site' => 'https://dkko.kostroma.gov.ru', 'source_url' => 'https://dkko.kostroma.gov.ru/kontakty/'],
        ['org' => 'Департамент культуры Костромской области (прежний адрес)', 'kind' => 'culture', 'region' => 'Костромская область',
         'email' => 'dkko@adm44.ru', 'source_url' => 'https://dkko.kostroma.gov.ru/kontakty/'],
        ['org' => 'Министерство культуры Липецкой области', 'kind' => 'culture', 'region' => 'Липецкая область',
         'email' => 'culture@admlr.lipetsk.ru', 'site' => 'https://kultura48.ru', 'source_url' => 'https://kultura48.ru/contact/'],
        ['org' => 'Министерство культуры и туризма Смоленской области', 'kind' => 'culture', 'region' => 'Смоленская область',
         'email' => 'kult@admin-smolensk.ru', 'site' => 'https://kultura.admin-smolensk.ru', 'source_url' => 'https://kultura.admin-smolensk.ru/kontakty/'],
        ['org' => 'Министерство культуры и туризма Смоленской области (второй ящик)', 'kind' => 'culture', 'region' => 'Смоленская область',
         'email' => '1.kult@admin-smolensk.ru', 'source_url' => 'https://kultura.admin-smolensk.ru/kontakty/'],
        ['org' => 'Министерство культуры Тульской области', 'kind' => 'culture', 'region' => 'Тульская область',
         'email' => 'culture@tularegion.ru', 'site' => 'https://culture.tularegion.ru', 'source_url' => 'https://culture.tularegion.ru/about/contacts/'],
        ['org' => 'Министерство культуры Архангельской области', 'kind' => 'culture', 'region' => 'Архангельская область',
         'email' => 'minkultao@dvinaland.ru', 'site' => 'https://culture29.ru', 'source_url' => 'https://culture29.ru/contacts/'],
        ['org' => 'Департамент культуры и туризма Вологодской области', 'kind' => 'culture', 'region' => 'Вологодская область',
         'email' => 'depcult@depcult.gov35.ru', 'source_url' => 'https://vologda-oblast.ru/vlast/ispolnitelnaya_vlast/departament_kultury_i_turizma_vologodskoy_oblasti/o_organe/',
         'note' => 'Собственный сайт ведомства не открывается, адрес взят с портала правительства области.'],
        ['org' => 'Министерство культуры Мурманской области', 'kind' => 'culture', 'region' => 'Мурманская область',
         'email' => 'culture@gov-murman.ru'],
        ['org' => 'Министерство культуры и туризма Новгородской области', 'kind' => 'culture', 'region' => 'Новгородская область',
         'email' => 'minkult@novreg.ru'],
        ['org' => 'Министерство культуры Республики Карелия', 'kind' => 'culture', 'region' => 'Республика Карелия',
         'email' => 'mincult@culture.gov10.ru'],
        ['org' => 'Министерство культуры и архивного дела Республики Коми', 'kind' => 'culture', 'region' => 'Республика Коми',
         'email' => 'adm@mincult.rkomi.ru'],
        ['org' => 'Комитет по сохранению культурного наследия Ленинградской области', 'kind' => 'culture', 'region' => 'Ленинградская область',
         'email' => 'okn@lenreg.ru',
         'note' => 'Это комитет по наследию, не по культуре. Адрес комитета по культуре и туризму области пока не найден.'],
    ];
}
