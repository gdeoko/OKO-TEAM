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
        created_at  TEXT DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_min_email ON ministries(email);
    CREATE INDEX IF NOT EXISTS idx_min_kind   ON ministries(kind);
    CREATE INDEX IF NOT EXISTS idx_min_status ON ministries(status);
    ");
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
            created_at TEXT DEFAULT (datetime('now')),
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
    // БЕЗ ФИО И ДОЛЖНОСТИ АДРЕСАТА ОБРАЩЕНИЕ НЕ УХОДИТ.
    //
    // Обращение в ведомство именное: реквизит «адресат» по ГОСТ Р 7.0.97-2016 и
    // «Уважаемый Иван Иванович!» в тексте. Без имени остаётся безличное письмо,
    // которое в ведомстве кладут в общую папку. Первое обращение отправляется один
    // раз и переделать его нельзя, поэтому адресат без ФИО ждёт, пока имя найдут,
    // — это не потеря, а отложенная отправка.
    //
    // Исключение — пресс-службы и редакции (branch='press'): там адресат по
    // должности не подразумевается, письмо идёт на редакционный ящик.
    $sql = "SELECT * FROM ministries
             WHERE email<>'' AND status NOT IN ('unsub','bounced','declined','excluded')
               AND (branch = 'press'
                    OR (TRIM(COALESCE(person,'')) <> '' AND TRIM(COALESCE(person_role,'')) <> ''))";
    $a = [];
    if ($branch !== '') { $sql .= " AND branch=?"; $a[] = $branch; }
    $sql .= " ORDER BY CASE kind WHEN 'federal' THEN 0 WHEN 'union' THEN 1 WHEN 'media' THEN 2 ELSE 3 END, org";
    return all($sql, $a);
}

function min_mark_sent(int $id, string $number): void {
    min_migrate();
    try {
        q("UPDATE ministries SET status=CASE WHEN status='new' THEN 'sent' ELSE status END,
             last_sent_at=datetime('now'), last_number=?, sent_count=sent_count+1 WHERE id=?",
          [$number, $id]);
    } catch (\Throwable $e) {}
}

function min_mark_replied(string $email, string $status = 'replied'): void {
    min_migrate();
    $ok = ['replied', 'supported', 'declined'];
    if (!in_array($status, $ok, true)) $status = 'replied';
    try {
        q("UPDATE ministries SET status=?, replied_at=datetime('now') WHERE email=?",
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
