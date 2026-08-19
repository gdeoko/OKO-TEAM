<?php
/**
 * БАЗА УЧРЕЖДЕНИЙ — ТУДА, ГДЕ ЖИВУТ ПЕДАГОГИ.
 *
 * Заявку в конкурс приносит не ребёнок и не родитель, а преподаватель: одна
 * учительница ДШИ подаёт десять-пятнадцать работ своего класса. Значит, чтобы
 * получить тысячу заявок, нужно достучаться не до тысячи семей, а до нескольких
 * сотен педагогов — то есть до школ искусств, домов культуры и центров творчества.
 *
 * Здесь хранится и ведётся эта база: кого нашли, где нашли, писали ли уже,
 * ответили ли, не отписался ли адресат. Отдельно от subscribers намеренно:
 *   • subscribers — это ЛЮДИ, которые сами подписались на новости центра;
 *   • institutions — это ОРГАНИЗАЦИИ с официальных открытых источников, которым
 *     мы пишем информационное приглашение.
 * Смешивать их нельзя ни по смыслу, ни по правилам рассылки: у писем разный тон,
 * разная периодичность и разные основания.
 *
 * ПРАВИЛА, КОТОРЫЕ ЗАШИТЫ В КОД, А НЕ В ГОЛОВУ:
 *   1. Адрес берётся только из открытого официального источника, и источник
 *      записывается рядом — всегда видно, откуда он взялся.
 *   2. Одному учреждению — одно письмо за волну. Повтор считается и ограничен.
 *   3. Отказ от рассылки — окончательный: статус 'unsubscribed', больше не пишем.
 *   4. Жёсткий отказ почтовика дважды — адрес выводится, чтобы не бить репутацию.
 */
declare(strict_types=1);

/** Мягко создаёт таблицу и индексы. Зовётся всеми функциями модуля. */
function inst_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS institutions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            kind TEXT DEFAULT 'other',      -- dshi|dk|school|college|center|kindergarten|other
            region TEXT DEFAULT '',
            city TEXT DEFAULT '',
            email TEXT DEFAULT '',
            emails TEXT DEFAULT '',         -- JSON: все найденные адреса
            site TEXT DEFAULT '',
            vk TEXT DEFAULT '',             -- screen_name или id сообщества
            vk_id INTEGER DEFAULT 0,
            phone TEXT DEFAULT '',
            address TEXT DEFAULT '',
            director TEXT DEFAULT '',       -- ФИО руководителя (для обращения по имени)
            source TEXT DEFAULT '',         -- откуда взято
            source_id TEXT DEFAULT '',      -- идентификатор в источнике
            status TEXT DEFAULT 'new',      -- new|invited|replied|bounced|unsubscribed|banned
            invited_at TEXT DEFAULT '',
            invited_count INTEGER DEFAULT 0,
            replied_at TEXT DEFAULT '',
            bounce_count INTEGER DEFAULT 0,
            note TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')),
            updated_at TEXT DEFAULT (datetime('now','localtime'))
        )");
        // Один адрес — одна запись. Пустой email не мешает: в SQLite NULL/'' в
        // уникальном индексе повторяться нельзя, поэтому индекс частичный.
        db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_inst_email
                    ON institutions(email) WHERE email <> ''");
        db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_inst_vk
                    ON institutions(vk_id) WHERE vk_id > 0");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_inst_status ON institutions(status)");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_inst_kind   ON institutions(kind)");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_inst_region ON institutions(region)");
    } catch (\Throwable $e) { /* уже есть */ }
    // Колонка появилась позже таблицы — добавляем мягко, чтобы старые базы ожили.
    try { db()->exec("ALTER TABLE institutions ADD COLUMN director TEXT DEFAULT ''"); } catch (\Throwable $e) {}
}

/* =====================================================================
 *  Нормализация и распознавание
 * ===================================================================== */

/**
 * Годится ли адрес для базы.
 *
 * Отсеиваем то, что регулярно попадается в HTML страниц и НЕ является почтой
 * учреждения: примеры из документации, технические ящики хостера, обрезки имён
 * файлов (image@2x.png), адреса разработчиков сайта.
 */
function inst_email_ok(string $email): bool {
    $e = mb_strtolower(trim($email));
    if ($e === '' || mb_strlen($e) > 120) return false;
    if (!filter_var($e, FILTER_VALIDATE_EMAIL)) return false;

    // Кусок имени файла, а не адрес.
    if (preg_match('~\.(png|jpe?g|gif|svg|webp|css|js|ico|woff2?|ttf)$~i', $e)) return false;

    [$local, $domain] = array_pad(explode('@', $e, 2), 2, '');
    if ($local === '' || $domain === '' || !str_contains($domain, '.')) return false;

    // Заведомо не наши адресаты.
    foreach (['example', 'test@', 'mail@mail', 'noreply', 'no-reply', 'donotreply',
              'sentry', 'wixpress', 'ucoz', 'sitemaker', 'webmaster@localhost'] as $bad) {
        if (str_contains($e, $bad)) return false;
    }
    // Домены-заглушки.
    foreach (['example.com', 'example.ru', 'domain.ru', 'site.ru', 'yoursite.ru',
              'localhost', 'sentry.io', 'w3.org', 'schema.org'] as $bad) {
        if ($domain === $bad || str_ends_with($domain, '.' . $bad)) return false;
    }
    return true;
}

/**
 * ФИО руководителя из открытых реестров — в человеческий вид.
 *
 * В выгрузках оно приходит как попало: «ИВАНОВА МАРИЯ ПЕТРОВНА», «Иванова М.П.»,
 * «и.о. директора Иванова Мария Петровна», иногда с должностью и запятыми.
 * Обращение в официальном письме строится по отчеству, поэтому капслок и мусор
 * надо снять: «Уважаемая МАРИЯ ПЕТРОВНА!» выглядит как крик, а не как обращение.
 */
function inst_clean_fio(string $fio): string {
    $t = trim($fio);
    if ($t === '') return '';
    // Должности и приставки — прочь.
    $t = preg_replace('~\b(и\.?о\.?|врио|директор[а]?|руководител[ья]|заведующ(ий|ая|ей)|начальник[а]?|г-?н|г-?жа)\b~ui', ' ', $t) ?? $t;
    $t = trim(preg_replace('~[,;()"«»]+~u', ' ', $t) ?? $t);
    // Точки и тире, оставшиеся от вычеркнутой должности («и.о. директора Петров»
    // после вырезания приставок превращается в «. Петров»).
    $t = trim(preg_replace('~^[\s.\-–—]+|[\s.\-–—]+$~u', '', $t) ?? $t);
    $t = trim(preg_replace('~\s+~u', ' ', $t) ?? $t);
    if ($t === '' || mb_strlen($t) > 90) return '';

    // Сплошной капслок приводим к «Фамилия Имя Отчество».
    if ($t === mb_strtoupper($t)) {
        $t = implode(' ', array_map(
            fn($w) => mb_strtoupper(mb_substr($w, 0, 1)) . mb_strtolower(mb_substr($w, 1)),
            preg_split('~\s+~u', $t) ?: []
        ));
    }
    // Инициалы вместо имени («Иванова М.П.») для обращения не годятся: по ним
    // нельзя ни назвать человека по имени, ни определить род.
    if (preg_match('~[А-ЯЁ]\.\s*[А-ЯЁ]?\.?~u', $t)) return '';
    // Нужны минимум три слова — фамилия, имя, отчество.
    $parts = preg_split('~\s+~u', $t) ?: [];
    if (count($parts) < 3) return '';
    return $t;
}

/** Приводит адрес к каноническому виду для дедупа. */
function inst_email_norm(string $email): string {
    return mb_strtolower(trim($email));
}

/**
 * Тип учреждения по названию.
 *
 * Нужен не для красоты: письмо в детский сад и письмо в училище — разные письма,
 * и порядок обхода базы тоже разный (сначала ДШИ, там педагогов больше всего).
 */
function inst_kind_detect(string $name): string {
    $n = mb_strtolower($name);
    $has = fn(array $w) => (function () use ($w, $n) {
        foreach ($w as $x) if (mb_strpos($n, $x) !== false) return true;
        return false;
    })();

    if ($has(['школа искусств', 'дши', 'детская музыкальная', 'дмш', 'художественная школа', 'дхш'])) return 'dshi';
    if ($has(['училищ', 'колледж', 'техникум', 'консерватор'])) return 'college';
    if ($has(['дом культуры', 'дворец культуры', 'дк ', 'культурно-досуг', 'кдц', 'клуб', 'дом народн'])) return 'dk';
    if ($has(['детский сад', 'доу ', 'дошкольн', 'ясли'])) return 'kindergarten';
    if ($has(['центр творчества', 'детского творчества', 'ддт', 'цдт', 'дом творчества',
              'центр развития', 'центр культуры', 'студия', 'ансамбл'])) return 'center';
    if ($has(['школа', 'гимназия', 'лицей', 'сош'])) return 'school';
    return 'other';
}

/** Человеческое название типа. */
function inst_kind_ru(string $kind): string {
    return [
        'dshi'         => 'Школа искусств',
        'dk'           => 'Дом культуры',
        'center'       => 'Центр творчества',
        'college'      => 'Училище, колледж',
        'school'       => 'Общеобразовательная школа',
        'kindergarten' => 'Детский сад',
        'other'        => 'Другое',
    ][$kind] ?? $kind;
}

/** Человеческое название статуса. */
function inst_status_ru(string $s): string {
    return [
        'new'          => 'Новое',
        'invited'      => 'Приглашение отправлено',
        'replied'      => 'Ответили',
        'bounced'      => 'Адрес не принимает',
        'unsubscribed' => 'Отказались от рассылки',
        'banned'       => 'Исключено вручную',
    ][$s] ?? $s;
}

/* =====================================================================
 *  Запись в базу
 * ===================================================================== */

/**
 * Добавляет или обновляет учреждение. Дедуп по e-mail, затем по сообществу ВК,
 * затем по паре «название + город».
 *
 * Обновление намеренно ОСТОРОЖНОЕ: заполняем только пустые поля. Данные из
 * второго источника не должны затирать то, что уже проверено первым.
 *
 * @return int id записи (0 — не записали)
 */
/**
 * ВЕДОМСТВЕННЫЕ УЧРЕЖДЕНИЯ СИЛОВЫХ СТРУКТУР — НЕ НАША АУДИТОРИЯ.
 *
 * Дома офицеров, окружные ансамбли, санатории МВД, училища при ведомствах — по
 * форме это учреждения культуры, и кружки там есть. Но переписка с ними идёт по
 * ведомственным каналам: письмо от стороннего центра там либо ложится под
 * согласование, либо регистрируется как обращение. Заявок это не приносит,
 * а хлопот добавляет — владелец решил такие адреса не трогать.
 *
 * Топонимы под правило не подпадают: «Суворовский район» Тульской области,
 * станица Суворовская и Кончанско-Суворовское — это места, а не училища.
 * Поэтому «суворовск» ловится только вместе со словом «училище».
 */
function inst_is_forbidden(string $name, string $email = ''): bool {
    $hay = mb_strtolower(trim($name) . ' ' . mb_strtolower(trim($email)));

    // Ведомственная почта — признак сам по себе.
    if (preg_match('~@(mvd|mil|fsin|fsb|rosgvard)\.~u', $hay)) return true;

    static $stop = [
        'минобороны', 'министерства обороны', 'дом офицеров', 'офицерский клуб',
        'военного округа', 'воинская часть', 'российской армии', 'военных художников',
        'мвд россии', 'мвд рф', 'фсин', 'фсб россии', 'росгвард',
        'военное училище', 'военно-морское училище', 'военно-морского училища',
        'колледж полиции', 'институт мвд', 'университет мвд', 'академия мвд',
        'школа-интернат полиции', 'воспитательной колонии', 'исправительной колонии',
    ];
    foreach ($stop as $s) if (mb_strpos($hay, $s) !== false) return true;

    // Суворовское и нахимовское — только как училища, не как названия мест.
    if (preg_match('~(суворовск\w*|нахимовск\w*)[^.]{0,30}(училищ|корпус)~u', $hay)) return true;

    return false;
}

function inst_add(array $row): int {
    inst_migrate();

    $name = trim((string) ($row['name'] ?? ''));
    if ($name === '' || mb_strlen($name) < 3) return 0;
    if (inst_is_forbidden($name, (string) ($row['email'] ?? ''))) return 0;
    if (mb_strlen($name) > 240) $name = mb_substr($name, 0, 240);

    $email = inst_email_norm((string) ($row['email'] ?? ''));
    if ($email !== '' && !inst_email_ok($email)) $email = '';

    $vkId = (int) ($row['vk_id'] ?? 0);

    // Все найденные адреса — списком, вдруг основной не примет.
    $emails = [];
    foreach ((array) ($row['emails'] ?? []) as $e) {
        $e = inst_email_norm((string) $e);
        if ($e !== '' && inst_email_ok($e)) $emails[$e] = true;
    }
    if ($email !== '') $emails[$email] = true;
    $emails = array_keys($emails);
    if ($email === '' && $emails) $email = $emails[0];

    // Совсем пустая запись бесполезна: писать некуда.
    if ($email === '' && $vkId <= 0 && trim((string) ($row['site'] ?? '')) === '') return 0;

    $data = [
        'name'      => $name,
        'kind'      => (string) ($row['kind'] ?? '') ?: inst_kind_detect($name),
        'region'    => trim((string) ($row['region'] ?? '')),
        'city'      => trim((string) ($row['city'] ?? '')),
        'email'     => $email,
        'emails'    => $emails ? json_encode($emails, JSON_UNESCAPED_UNICODE) : '',
        'site'      => trim((string) ($row['site'] ?? '')),
        'vk'        => trim((string) ($row['vk'] ?? '')),
        'vk_id'     => $vkId,
        'phone'     => trim((string) ($row['phone'] ?? '')),
        'address'   => trim((string) ($row['address'] ?? '')),
        'director'  => inst_clean_fio((string) ($row['director'] ?? '')),
        'source'    => trim((string) ($row['source'] ?? '')),
        'source_id' => trim((string) ($row['source_id'] ?? '')),
    ];

    // Ищем, не знаем ли мы это учреждение уже.
    $exist = null;
    try {
        if ($email !== '')  $exist = one("SELECT * FROM institutions WHERE email=?", [$email]);
        if (!$exist && $vkId > 0) $exist = one("SELECT * FROM institutions WHERE vk_id=?", [$vkId]);
        if (!$exist && $data['city'] !== '') {
            $exist = one("SELECT * FROM institutions WHERE mb_lower(name)=mb_lower(?) AND mb_lower(city)=mb_lower(?)",
                         [$name, $data['city']]);
        }
    } catch (\Throwable $e) { $exist = null; }

    if ($exist) {
        // Дополняем пустые поля, ничего не затирая.
        $upd = [];
        foreach (['region', 'city', 'email', 'site', 'vk', 'phone', 'address', 'director'] as $f) {
            if ($data[$f] !== '' && trim((string) ($exist[$f] ?? '')) === '') $upd[$f] = $data[$f];
        }
        if ($vkId > 0 && (int) ($exist['vk_id'] ?? 0) === 0) $upd['vk_id'] = $vkId;
        // Источники копим через запятую — видно, что запись подтверждена дважды.
        $src = trim((string) ($exist['source'] ?? ''));
        if ($data['source'] !== '' && !str_contains($src, $data['source'])) {
            $upd['source'] = $src === '' ? $data['source'] : ($src . ',' . $data['source']);
        }
        // Список адресов объединяем.
        $old = json_decode((string) ($exist['emails'] ?? ''), true);
        $merged = array_values(array_unique(array_merge(is_array($old) ? $old : [], $emails)));
        if ($merged && count($merged) !== count(is_array($old) ? $old : [])) {
            $upd['emails'] = json_encode($merged, JSON_UNESCAPED_UNICODE);
        }
        if ($upd) {
            $upd['updated_at'] = date('Y-m-d H:i:s');
            try { update('institutions', $upd, 'id=:id', ['id' => (int) $exist['id']]); } catch (\Throwable $e) {}
        }
        return (int) $exist['id'];
    }

    try { return (int) insert('institutions', $data); }
    catch (\Throwable $e) { return 0; }
}

/* =====================================================================
 *  Выборки и отчёты
 * ===================================================================== */

/** Сводка по базе: сколько всего, по типам, по статусам, сколько с почтой. */
function inst_stats(): array {
    inst_migrate();
    $out = ['total' => 0, 'with_email' => 0, 'with_vk' => 0, 'ready' => 0,
            'by_kind' => [], 'by_status' => [], 'by_region' => []];
    try {
        $out['total']      = (int) scalar("SELECT COUNT(*) FROM institutions");
        $out['with_email'] = (int) scalar("SELECT COUNT(*) FROM institutions WHERE email<>''");
        $out['with_vk']    = (int) scalar("SELECT COUNT(*) FROM institutions WHERE vk_id>0");
        $out['ready']      = (int) scalar("SELECT COUNT(*) FROM institutions
                                            WHERE email<>'' AND status IN ('new')");
        foreach (all("SELECT kind, COUNT(*) n FROM institutions GROUP BY kind ORDER BY n DESC") as $r) {
            $out['by_kind'][(string) $r['kind']] = (int) $r['n'];
        }
        foreach (all("SELECT status, COUNT(*) n FROM institutions GROUP BY status ORDER BY n DESC") as $r) {
            $out['by_status'][(string) $r['status']] = (int) $r['n'];
        }
        foreach (all("SELECT region, COUNT(*) n FROM institutions
                       WHERE region<>'' GROUP BY region ORDER BY n DESC LIMIT 30") as $r) {
            $out['by_region'][(string) $r['region']] = (int) $r['n'];
        }
    } catch (\Throwable $e) {}
    return $out;
}

/**
 * Кому пора отправить приглашение.
 *
 * Порядок обхода не случаен: сначала школы искусств и центры творчества — там
 * педагог ведёт класс и приводит сразу группу. Дома культуры следом. Детские
 * сады и обычные школы — в последнюю очередь, оттуда заявок единицы.
 *
 * Исключаем: отписавшихся, заблокированных, тех, чей адрес уже отказал дважды,
 * и тех, кому в эту волну уже писали.
 */
function inst_pick_for_invite(int $limit = 500): array {
    inst_migrate();
    $limit = max(1, min(5000, $limit));
    try {
        return all(
            // НАШИХ ЛЮДЕЙ ХОЛОДНЫМ ПИСЬМОМ НЕ БЕСПОКОИМ.
            // Триста с лишним адресов есть и в базе учреждений, и в списке
            // подписчиков: педагог подписался сам, а его школа попала в выгрузку
            // Минкультуры. Такой человек получил бы в один день и рассылку, и
            // «здравствуйте, приглашаем ваше учреждение» — как будто мы не знаем,
            // с кем уже общаемся. Ему идёт обычная рассылка, холодное обращение — нет.
            //
            // Оговорка про source='institution': такого подписчика заводим мы сами
            // при постановке холодного письма, ради рабочей ссылки отписки. Он не
            // признак знакомства и учреждение из выборки не убирает — иначе после
            // первой же волны база опустела бы целиком.
            "SELECT * FROM institutions i
              WHERE i.email <> ''
                AND i.status = 'new'
                AND COALESCE(i.bounce_count,0) < 2
                AND NOT EXISTS (SELECT 1 FROM subscribers s
                                 WHERE LOWER(s.email) = LOWER(i.email)
                                   AND COALESCE(s.active,1) = 1
                                   AND COALESCE(s.source,'') <> 'institution')
              ORDER BY CASE WHEN COALESCE(director,'') <> '' THEN 0 ELSE 1 END,
                       CASE kind
                         WHEN 'dshi'   THEN 1
                         WHEN 'center' THEN 2
                         WHEN 'college' THEN 3
                         WHEN 'dk'     THEN 4
                         WHEN 'school' THEN 5
                         ELSE 6 END,
                       id ASC
              LIMIT ?", [$limit]
        );
    } catch (\Throwable $e) { return []; }
}

/**
 * КОМУ ПИСАТЬ ПОВТОРНО.
 *
 * Владелец спрашивал, как правильно: один раз, каждый месяц или как-то ещё.
 * Правильно — раз в квартал и не больше четырёх писем за всё время.
 *
 * Почему не каждый месяц. Холодный адрес, который двенадцать раз в год получает
 * письмо от одного отправителя, начинает помечаться как спам — сначала людьми,
 * потом автоматикой почтовой службы. Репутация домена общая: за холодную базу
 * расплачиваются письма участникам с дипломами и результатами. Три месяца —
 * интервал, при котором письмо воспринимается как напоминание о новом сезоне,
 * а не как назойливость.
 *
 * Почему вообще повторять. Первое письмо в сентябре могло прийти в день, когда
 * директору было не до конкурсов. Второе, с новыми конкурсами и живыми итогами
 * прошлого сезона, попадает в другой момент — и это единственная причина писать
 * снова. Поэтому повтор идёт только если с прошлого письма сменился сезон.
 *
 * Тех, кто отказался или чей адрес дважды отверг почтовик, здесь нет никогда.
 */
function inst_pick_for_reinvite(int $limit = 500, int $months = 3, int $maxLetters = 4): array {
    inst_migrate();
    $limit = max(1, min(5000, $limit));
    try {
        return all(
            "SELECT * FROM institutions
              WHERE email <> ''
                AND status = 'invited'
                AND COALESCE(bounce_count,0) < 2
                AND COALESCE(invited_count,1) < ?
                AND invited_at <> ''
                AND invited_at < datetime('now', 'localtime', ?)
              ORDER BY CASE WHEN COALESCE(director,'') <> '' THEN 0 ELSE 1 END,
                       invited_at ASC
              LIMIT ?",
            [$maxLetters, '-' . max(1, $months) . ' months', $limit]
        );
    } catch (\Throwable $e) { return []; }
}

/** Отмечает, что приглашение поставлено в очередь. */
function inst_mark_invited(int $id): void {
    inst_migrate();
    try {
        q("UPDATE institutions
             SET status='invited', invited_at=?, invited_count=COALESCE(invited_count,0)+1, updated_at=?
           WHERE id=?", [date('Y-m-d H:i:s'), date('Y-m-d H:i:s'), $id]);
    } catch (\Throwable $e) {}
}

/**
 * ВОЗВРАЩАЕТ В ОЧЕРЕДЬ ТЕХ, КОГО ПОМЕТИЛИ ПРИГЛАШЁННЫМИ, А ПИСЬМА НЕТ.
 *
 * Отметка «приглашено» ставится сразу после постановки письма в очередь. Если
 * письмо из очереди потом исчезает (перезалив базы, ручная чистка, сбой), метка
 * остаётся — и учреждение навсегда выпадает из выборки: она берёт только тех, у
 * кого статус «новый». Так десять с половиной тысяч адресов оказались отмечены
 * как обработанные, не получив ни одного письма.
 *
 * Здесь мы возвращаем таким учреждениям статус «новый». История не теряется:
 * invited_at и invited_count остаются как были, и повторную волну по ним видно.
 *
 * @return int сколько записей вернули в работу
 */
function inst_reset_ghost_invites(bool $apply = true): int {
    inst_migrate();
    try {
        $n = (int) (scalar("SELECT COUNT(*) FROM institutions i
                             WHERE i.status='invited'
                               AND TRIM(COALESCE(i.email,''))<>''
                               AND NOT EXISTS (SELECT 1 FROM mail_queue q
                                                WHERE LOWER(q.to_email)=LOWER(i.email))") ?? 0);
        if ($apply && $n > 0) {
            q("UPDATE institutions SET status='new', updated_at=datetime('now','localtime')
                WHERE status='invited'
                  AND TRIM(COALESCE(email,''))<>''
                  AND NOT EXISTS (SELECT 1 FROM mail_queue q
                                   WHERE LOWER(q.to_email)=LOWER(institutions.email))");
        }
        return $n;
    } catch (\Throwable $e) { return 0; }
}

/**
 * Учреждение отказалось от рассылки — больше не пишем НИКОГДА.
 * Зовётся из api/v1/unsubscribe.php по адресу.
 */
/**
 * ТОКЕН ОТПИСКИ УЧРЕЖДЕНИЯ — СВОЙ, НЕ ЧЕРЕЗ БАЗУ ПОДПИСЧИКОВ.
 *
 * Раньше ради ссылки «Отписаться» каждое учреждение заводилось в subscribers.
 * Списки от этого слиплись: в базе участников оказалось двадцать тысяч школ и
 * отделов культуры, и «своя база» из восьми тысяч человек превратилась в
 * двадцать восемь. Участники и учреждения — разные списки: первые пришли сами,
 * вторым мы пишем по официальному адресу. Токен теперь хранится у самого
 * учреждения.
 */
function inst_unsub_token(int $instId): string {
    inst_migrate();
    try { db()->exec("ALTER TABLE institutions ADD COLUMN unsub_token TEXT DEFAULT ''"); } catch (\Throwable $e) {}
    $row = one("SELECT unsub_token FROM institutions WHERE id=?", [$instId]);
    if (!$row) return '';
    $t = trim((string) ($row['unsub_token'] ?? ''));
    if ($t !== '') return $t;
    $t = 'i' . bin2hex(random_bytes(16));
    try { q("UPDATE institutions SET unsub_token=? WHERE id=?", [$t, $instId]); }
    catch (\Throwable $e) { return ''; }
    return $t;
}

/** Учреждение по токену отписки ('' → null). */
function inst_by_unsub_token(string $token): ?array {
    $t = trim($token);
    if ($t === '') return null;
    try { return one("SELECT * FROM institutions WHERE unsub_token=?", [$t]) ?: null; }
    catch (\Throwable $e) { return null; }
}

function inst_unsubscribe(string $email): bool {
    inst_migrate();
    $e = inst_email_norm($email);
    if ($e === '') return false;
    try {
        q("UPDATE institutions SET status='unsubscribed', updated_at=? WHERE email=?",
          [date('Y-m-d H:i:s'), $e]);
        return true;
    } catch (\Throwable $e2) { return false; }
}

/** Почтовик отказал по адресу учреждения. Дважды — выводим из рассылки. */
function inst_bounce(string $email, string $why = ''): void {
    inst_migrate();
    $e = inst_email_norm($email);
    if ($e === '') return;
    try {
        q("UPDATE institutions
             SET bounce_count = COALESCE(bounce_count,0)+1,
                 note = CASE WHEN ?<>'' THEN substr(COALESCE(note,'')||' | '||?, 1, 500) ELSE note END,
                 status = CASE WHEN COALESCE(bounce_count,0)+1 >= 2 THEN 'bounced' ELSE status END,
                 updated_at = ?
           WHERE email = ?", [$why, $why, date('Y-m-d H:i:s'), $e]);
    } catch (\Throwable $e2) {}
}

/** Выгрузка базы в CSV (для админки). */
function inst_export_csv($fh, string $where = '', array $args = []): int {
    inst_migrate();
    fprintf($fh, "\xEF\xBB\xBF");
    fputcsv($fh, ['Название', 'Тип', 'Регион', 'Город', 'E-mail', 'Сайт', 'ВК', 'Телефон',
                  'Источник', 'Статус', 'Приглашений', 'Добавлено'], ';');
    $n = 0;
    try {
        foreach (all("SELECT * FROM institutions " . ($where !== '' ? "WHERE $where " : '')
                     . "ORDER BY id ASC", $args) as $r) {
            fputcsv($fh, [
                $r['name'], inst_kind_ru((string) $r['kind']), $r['region'], $r['city'],
                $r['email'], $r['site'], $r['vk'], $r['phone'],
                $r['source'], inst_status_ru((string) $r['status']),
                (int) $r['invited_count'], $r['created_at'],
            ], ';');
            $n++;
        }
    } catch (\Throwable $e) {}
    return $n;
}
