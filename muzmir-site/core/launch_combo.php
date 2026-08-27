<?php
/**
 * ОБЪЕДИНЁННОЕ ПИСЬМО ЗАПУСКА (правило владельца, август 2026).
 *
 * Вместо трёх отдельных волн — одно письмо на человека, тремя блоками:
 *   1. Открыт приём заявок — все конкурсы месяца с афишами.
 *   2. Личный кабинет — ЛОГИН и ВРЕМЕННЫЙ ПАРОЛЬ (персонально, только тем, кто
 *      ни разу не входил).
 *   3. Клуб постоянных участников — приглашение (только тем, кто ещё не в клубе).
 *
 * ЗАЧЕМ. Раздельно это было 3 × 8200 = 24 600 писем: при квоте 400/день и двух
 * ящиках база проходилась бы больше двух месяцев. Одним письмом — 8200, то есть
 * ~21 рабочий день при 400/день. Плюс человек получает один конверт вместо трёх.
 *
 * ПОЧЕМУ НЕЛЬЗЯ БЫЛО ПРОСТО СКЛЕИТЬ ШАБЛОНЫ. Массовая рассылка
 * (newsletter_enqueue) строит тело ОДИН раз и кладёт всем одинаковое — персональный
 * пароль туда не подставить. Поэтому здесь письмо собирается ПОД КАЖДОГО получателя,
 * как в kabinet_onboarding_enqueue().
 *
 * ГЛАВНАЯ ОСТОРОЖНОСТЬ. Блок с паролем идёт ТОЛЬКО тем, у кого users.last_login IS NULL.
 * У действующих участников свой пароль: выдать им новый — значит выкинуть их из
 * аккаунта прямо в день запуска. Таким людям блок кабинета не добавляется вовсе.
 *
 * Идемпотентность: письма привязаны к одной строке newsletters (кампания месяца).
 * Повторный вызов не поставит второе письмо тому же адресу.
 */
declare(strict_types=1);

require_once __DIR__ . '/newsletter.php';
require_once __DIR__ . '/mail_campaigns.php';
require_once __DIR__ . '/kabinet_onboarding.php';
// Список собственных ящиков центра — чтобы не слать массовое самим себе.
if (is_file(__DIR__ . '/inbox_reader.php')) require_once __DIR__ . '/inbox_reader.php';

// Метки условных блоков письма. Нужны, чтобы «кому что показывать» решалось
// при отправке КАЖДОМУ человеку, а не при сборке эталона: тогда логика переживает
// и шаблон, отредактированный в пульте запуска.
const LC_CAB_OPEN  = '<!--БЛОК:КАБИНЕТ-->';
const LC_CAB_CLOSE = '<!--/БЛОК:КАБИНЕТ-->';
const LC_VIP_OPEN  = '<!--БЛОК:КЛУБ-->';
const LC_VIP_CLOSE = '<!--/БЛОК:КЛУБ-->';

/**
 * Оставить или вырезать помеченный блок письма.
 * Метки убираются в любом случае — в письмо они не попадают.
 * Если меток нет (старый сохранённый шаблон) — тело возвращается как есть.
 */
function lc_block(string $html, string $open, string $close, bool $keep): string {
    $i = mb_strpos($html, $open);
    if ($i === false) return $html;
    $j = mb_strpos($html, $close, $i);
    if ($j === false) return str_replace($open, '', $html);
    $body = mb_substr($html, $i + mb_strlen($open), $j - $i - mb_strlen($open));
    return mb_substr($html, 0, $i) . ($keep ? $body : '') . mb_substr($html, $j + mb_strlen($close));
}

/** Тема объединённого письма (переопределяется в пульте: launch_mail_subject:combo). */
function launch_combo_subject(): string {
    $ov = trim((string) setting('launch_mail_subject:combo', ''));
    if ($ov !== '') return $ov;
    $s = campaign_subject('new_competitions');
    return $s !== '' ? $s : 'Открыт приём заявок - конкурсы месяца';
}

/**
 * Внутренний HTML письма под конкретного получателя.
 *
 * @param bool   $withCabinet добавлять ли блок логина/пароля
 * @param bool   $withVip     добавлять ли приглашение в клуб
 * @param string $email       логин (он же адрес)
 * @param string $name        имя для обращения
 * @param string $pass        временный пароль (только если $withCabinet)
 */
function launch_combo_inner(bool $withCabinet, bool $withVip, string $email, string $name, string $pass): string {
    // Тело, отредактированное в пульте запуска, важнее эталона. Оно хранится
    // с токенами {{name}} {{login}} {{password}} — подстановка ниже общая для
    // обоих путей, поэтому оверрайд не ломает персонализацию.
    $ov = trim((string) setting('launch_mail_html:combo', ''));
    if ($ov !== '') {
        $inner = $ov;
    } else {
        // Единое письмо, а не три склеенных: см. launch_combo_body().
        $inner = launch_combo_body($name, $email, $pass);
    }

    // УСЛОВНЫЕ БЛОКИ ВЫРЕЗАЮТСЯ ЗДЕСЬ, А НЕ ПРИ СБОРКЕ.
    // Так персонализация переживает шаблон, сохранённый в пульте запуска: раньше
    // сохранённый оверрайд шёл всем целиком, и человек с рабочим паролем получал
    // блок «ваш пароль: » с пустым местом, а член клуба — приглашение вступить в клуб.
    // Метки — HTML-комментарии: в почтовом клиенте их не видно, при правке текста
    // в пульте они сохраняются вместе с разметкой.
    $inner = lc_block($inner, LC_CAB_OPEN, LC_CAB_CLOSE, $withCabinet);
    $inner = lc_block($inner, LC_VIP_OPEN, LC_VIP_CLOSE, $withVip);

    return str_replace(
        ['{{name}}', '{{login}}', '{{password}}'],
        // Токены оставляем как есть, если их передали токенами (режим редактора пульта).
        [
            $name === '{{name}}'         ? '{{name}}'     : h($name !== '' ? $name : 'участник'),
            $email === '{{login}}'       ? '{{login}}'    : h($email),
            $pass === '{{password}}'     ? '{{password}}' : h($pass),
        ],
        $inner
    );
}

/** Адреса действующих членов клуба — им приглашение в клуб не нужно. */
function launch_combo_club_emails(): array {
    $out = [];
    try {
        $rows = all("SELECT LOWER(u.email) e FROM club_members m JOIN users u ON u.id = m.user_id
                      WHERE COALESCE(m.active,1) = 1
                        AND (m.expires_at IS NULL OR m.expires_at = '' OR m.expires_at > datetime('now','localtime'))
                        AND COALESCE(u.email,'') <> ''");
        foreach ($rows as $r) $out[(string) $r['e']] = true;
    } catch (\Throwable $e) {}
    if (!function_exists('club_staff_emails') && is_file(__DIR__ . '/club.php')) require_once __DIR__ . '/club.php';
    if (function_exists('club_staff_emails')) {
        foreach (club_staff_emails() as $e) {
            $e = mb_strtolower(trim((string) $e));
            if ($e !== '') $out[$e] = true;
        }
    }
    return $out;
}

/**
 * Ставит в очередь объединённую волну запуска.
 * @param bool $dry true — ничего не пишем, только считаем.
 * @return array ['queued'=>int,'with_cabinet'=>int,'with_vip'=>int,'newsletter_id'=>int]
 */
function launch_combo_enqueue(bool $dry = false, int $limit = 20000): array {
    nl_ensure_campaign_type_col();
    try { db()->exec("ALTER TABLE mail_queue ADD COLUMN priority INTEGER DEFAULT 0"); } catch (\Throwable $e) {}

    // ИНДЕКСЫ ГОРЯЧЕГО ПУТИ ВОЛНЫ. На каждого из 8200 получателей делается два поиска:
    // проверка дубля в mail_queue и поиск учётной записи по адресу. Без индексов оба
    // шли полным сканом таблиц — это десятки миллионов чтений и волна длиной в полчаса
    // вместо нескольких минут. С индексами оба поиска мгновенные.
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_queue_nl_email ON mail_queue(newsletter_id, to_email)"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_users_email_lc ON users(LOWER(email))"); } catch (\Throwable $e) {}
    try { db()->exec("CREATE INDEX IF NOT EXISTS idx_subs_email_active ON subscribers(email, active)"); } catch (\Throwable $e) {}

    $subject = launch_combo_subject();

    // Одна строка кампании на месяц — она же ключ идемпотентности.
    // ИЩЕМ ТОЛЬКО ПО ТЕГУ МЕСЯЦА, БЕЗ ТЕМЫ. Тема считается из числа открытых конкурсов
    // («…4 конкурса…»), и стоило закрыть или добавить один — она менялась, старая
    // кампания переставала находиться, заводилась новая, и вся база проходилась
    // ВТОРОЙ раз: второе письмо каждому и второй сброс восьми тысяч паролей.
    $tag = 'combo:' . date('Y-m');
    $nl  = one("SELECT * FROM newsletters WHERE audience = ? ORDER BY id ASC LIMIT 1", [$tag]);
    $nid = (int) ($nl['id'] ?? 0);
    // Если кампания уже заведена — держимся её темы, чтобы письма одной волны
    // не разъезжались по теме и попадали в один тред у получателя.
    if ($nid && trim((string) ($nl['subject'] ?? '')) !== '') $subject = (string) $nl['subject'];
    if (!$nid && !$dry) {
        $nid = (int) insert('newsletters', [
            'subject'       => $subject,
            'body'          => '(персональное письмо: собирается под каждого получателя)',
            'audience'      => $tag,
            'campaign_type' => 'konkurs',
            'status'        => 'sending',
        ]);
    }

    // Аудитория: активные подписчики + зарегистрированные с включёнными уведомлениями.
    // Отписавшихся и подавленных отсекает nl_ensure_subscriber ниже.
    $recips = all(
        "SELECT email, name FROM (
             SELECT LOWER(s.email) AS email, s.name AS name FROM subscribers s WHERE s.active = 1
             UNION
             SELECT LOWER(u.email) AS email, u.full_name AS name FROM users u
              WHERE COALESCE(u.email,'') <> '' AND COALESCE(u.blocked,0) = 0
                AND COALESCE(u.notify_email,1) = 1
                AND COALESCE(u.role,'user') NOT IN ('owner','admin','orgcom')
         ) ORDER BY email LIMIT ?",
        [max(1, $limit)]
    );

    $clubEmails = launch_combo_club_emails();

    $queued = 0; $withCab = 0; $withVip = 0; $skipped = 0;
    $pixel = $nid ? nl_open_pixel(nl_track_token($nid)) : '';
    $base  = rtrim((string) cfgv('base_url'), '/');

    foreach ($recips as $r) {
        $email = mb_strtolower(trim((string) $r['email']));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) continue;

        // Отписавшиеся и подавленные (bounced/invalid/alias/role) — мимо.
        [$unsubToken, $active] = nl_ensure_subscriber($email, (string) ($r['name'] ?? ''), 'newsletter');
        if (!$active) { $skipped++; continue; }
        // Имя: что человек указал сам, иначе — распознанное по адресу («Светлана»
        // из nelaeva.svetlana@…). Кладём его и в подписку, и в учётную запись,
        // чтобы обращение было одинаковым в письме, в кабинете и в админке.
        $name = person_greeting_name($email, (string) ($r['name'] ?? ''));
        if ($name !== '' && trim((string) ($r['name'] ?? '')) === '') {
            try { q("UPDATE subscribers SET name=? WHERE LOWER(email)=? AND COALESCE(name,'')=''", [$name, $email]); } catch (\Throwable $e) {}
            try { q("UPDATE users SET full_name=? WHERE LOWER(email)=? AND COALESCE(full_name,'')=''", [$name, $email]); } catch (\Throwable $e) {}
        }

        // Свои же ящики в массовую волну не берём. Они есть и в подписчиках, и в
        // учётных записях, и письмо «Открыт приём заявок» с чужим логином и паролем
        // приходило бы самому центру, засоряя рабочую почту и портя статистику.
        if (function_exists('inbox_own_emails')) {
            static $own = null;
            if ($own === null) {
                $own = [];
                foreach (inbox_own_emails() as $o) {
                    $o = mb_strtolower(trim((string) $o));
                    if ($o === '') continue;
                    $own[$o] = true;
                    // Адрес на кириллическом домене хранится в очереди в punycode,
                    // поэтому держим обе записи.
                    if (function_exists('mail_addr_ascii')) $own[mb_strtolower(mail_addr_ascii($o))] = true;
                }
            }
            if (isset($own[$email])) { $skipped++; continue; }
        }

        // Идемпотентность: одному адресу — одно письмо кампании месяца.
        if ($nid) {
            $dup = one("SELECT id FROM mail_queue WHERE newsletter_id = ? AND to_email = ?", [$nid, $email]);
            if ($dup) { $skipped++; continue; }
        }

        // Прикидка для отчёта волны: кому в письме будут блоки кабинета и клуба.
        // Окончательное решение примет сборщик в момент отправки — за неделю
        // человек мог и войти в кабинет, и вступить в клуб.
        $uGuess = one("SELECT last_login FROM users
                        WHERE LOWER(email) = ? AND COALESCE(blocked,0) = 0
                          AND COALESCE(role,'user') NOT IN ('owner','admin','orgcom','moderator','jury','designer')",
                      [$email]);
        $needCabinetGuess = $uGuess && trim((string) ($uGuess['last_login'] ?? '')) === '';
        $needVipGuess     = !isset($clubEmails[$email]);

        // ТЕЛО ПИСЬМА ЗДЕСЬ НЕ СОБИРАЕТСЯ.
        //
        // В очередь кладётся только «рецепт»: кому и какой волной. Само письмо
        // собирается в момент отправки (nl_build_body в core/newsletter.php).
        // Три причины, и все важные:
        //
        //   1. Правки текста в пульте применяются к тем, кому ещё не ушло. Раньше
        //      тело фиксировалось при постановке, и правка догоняла бы базу только
        //      в следующем месяце.
        //   2. Временный пароль не лежит в очереди неделями. Он выдаётся в секунду
        //      отправки — значит человек до самого письма спокойно пользуется своим
        //      прежним паролем, а не теряет доступ заранее.
        //   3. Очередь перестала весить 200 МБ: вместо 24 КБ вёрстки на каждого —
        //      строчка рецепта.
        if ($dry) { $queued++; if ($needCabinetGuess) $withCab++; if ($needVipGuess) $withVip++; continue; }

        try {
            insert('mail_queue', [
                'to_email'      => $email,
                'to_name'       => $name,
                'subject'       => $subject,
                'body'          => '',
                'build'         => json_encode(['kind' => 'combo', 'nlid' => $nid], JSON_UNESCAPED_UNICODE),
                'newsletter_id' => $nid,
                'campaign_type' => 'konkurs',   // одна квота на всю объединённую волну
                'status'        => 'queued',
                'priority'      => 5,
            ]);
            $queued++;
            if ($needCabinetGuess) $withCab++;
            if ($needVipGuess)     $withVip++;
        } catch (\Throwable $e) { /* сбойную строку пропускаем, волну не роняем */ }
    }

    if (!$dry && $queued && function_exists('audit')) {
        audit('launch_combo_enqueue', 'newsletter', $nid,
              ['queued' => $queued, 'with_cabinet' => $withCab, 'with_vip' => $withVip, 'skipped' => $skipped]);
    }

    return ['queued' => $queued, 'with_cabinet' => $withCab, 'with_vip' => $withVip,
            'skipped' => $skipped, 'newsletter_id' => $nid];
}

/**
 * ЕДИНОЕ ПИСЬМО ЗАПУСКА — конкурсы, кабинет и клуб одним текстом.
 *
 * Первая версия склеивала три готовых письма подряд, и получалось ровно то, что
 * склеено: три приветствия «Здравствуйте, Мария Петровна!», дважды одна и та же
 * плашка про информационную поддержку, три кнопки «Вступить в Клуб» и девять
 * тысяч точек длины. Человек до конца такого письма не доходит.
 *
 * Здесь письмо написано как одно письмо: одно приветствие, одна плашка, конкурсы,
 * одно действие. Доступ в кабинет и приглашение в клуб — короткими блоками в
 * конце, и только тем, кому они нужны (метки LC_CAB_* и LC_VIP_* вырезаются
 * вызывающим кодом).
 */
function launch_combo_body(string $name, string $email, string $pass): string {
    $navy = MM_NAVY; $ink = MM_INK; $muted = MM_MUTED; $line = MM_LINE; $card = MM_CARD;
    $base = mmc_base();

    try {
        $comps = all("SELECT id, name, slug, cover, type, is_paid, price, end_date
                        FROM competitions WHERE status='open' ORDER BY is_paid ASC, sort ASC, id ASC");
    } catch (\Throwable $e) { $comps = []; }

    $free = array_values(array_filter($comps, fn($c) => (int) ($c['is_paid'] ?? 0) !== 1));
    $end  = '';
    foreach ($comps as $c) {
        $e = trim((string) ($c['end_date'] ?? ''));
        if ($e !== '' && ($end === '' || $e < $end)) $end = $e;
    }
    $endRu = $end !== '' ? (function_exists('ru_date') ? ru_date($end) : date('d.m.Y', strtotime($end))) : '';

    $p = fn(string $t) => '<p style="margin:0 0 14px;font:16px/1.65 Arial,sans-serif;color:' . $ink . '">' . $t . '</p>';

    /* Приветствие — ровно одно на письмо. */
    // Склонение живёт в core/chat_priority.php; письмо может собираться и без него.
    if (!function_exists('plural_ru') && is_file(BASE_PATH . '/core/chat_priority.php')) {
        require_once BASE_PATH . '/core/chat_priority.php';
    }
    // СКОЛЬКО ОСТАЛОСЬ — ЦИФРОЙ, А НЕ ДАТОЙ.
    // «До 25 августа» человек откладывает и забывает, «осталось 5 дней» заставляет
    // открыть форму сегодня. Дата рядом остаётся: она нужна, чтобы посчитать самому.
    $daysLeft = $end !== '' ? (int) floor((strtotime($end . ' 23:59:59') - time()) / 86400) : -1;
    $left = '';
    if ($daysLeft > 1)       $left = 'осталось ' . $daysLeft . ' ' . plural_ru($daysLeft, 'день', 'дня', 'дней');
    elseif ($daysLeft === 1) $left = 'остался последний день';
    elseif ($daysLeft === 0) $left = 'сегодня последний день';

    $out = '<h1 style="margin:0 0 6px;font:700 24px/1.3 Georgia,\'Times New Roman\',serif;color:' . $navy . '">'
         . 'Здравствуйте, {{name}}!</h1>'
         . '<div style="font:15px/1.6 Arial,sans-serif;color:' . $muted . ';margin:0 0 18px">'
         . 'Открыт приём заявок на конкурсы' . ($endRu !== '' ? ' - до ' . h($endRu) : '')
         . ($left !== '' ? ', <b style="color:' . $navy . '">' . h($left) . '</b>' : '') . '</div>';

    $out .= $p('Международные и всероссийские творческие конкурсы с настоящими наградами, '
        . 'официальными и аттестационными дипломами. Участие дистанционное: работа принимается '
        . 'видеозаписью или изображением по ссылке, приезжать никуда не нужно.');

    if ($free) {
        $names = array_map(fn($c) => '«' . (string) $c['name'] . '»', $free);
        $out .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px">'
             . '<tr><td style="background:' . $card . ';border-left:4px solid ' . MM_GOLD . ';'
             . 'border-radius:0 10px 10px 0;padding:14px 18px;font:15px/1.6 Arial,sans-serif;color:' . $ink . '">'
             . '<b>Участие в ' . h(implode(', ', $names)) . ' - бесплатное.</b> '
             . 'Диплом с результатом аттестации жюри приходит на почту всем участникам.'
             . '</td></tr></table>';
    }

    // КНОПКА ДО СПИСКА, А НЕ ТОЛЬКО ПОСЛЕ НЕГО.
    // Единственная кнопка стояла под карточками всех четырёх конкурсов, то есть на
    // втором-третьем экране. Кто решил участвовать сразу, должен иметь возможность
    // нажать сразу, а не листать афиши до конца.
    $out .= mm_email_btn($base . '/apply', 'Подать заявку', 'gold');

    /* Конкурсы карточками — по одной, без повторов вокруг. */
    foreach ($comps as $c) $out .= mmc_competition_card($c);

    $out .= mm_email_btn($base . '/apply', 'Подать заявку', 'gold');

    /* Кабинет — только тем, кто ещё не заходил. */
    $out .= LC_CAB_OPEN
         . '<div style="height:1px;background:' . $line . ';margin:26px 0"></div>'
         . '<h2 style="margin:0 0 10px;font:700 19px/1.3 Georgia,serif;color:' . $navy . '">Личный кабинет открыт</h2>'
         . $p('Заявки, результаты, электронные дипломы и заказ наград - в одном месте.')
         . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">'
         . '<tr><td style="background:' . MM_IVORY . ';border:1px solid ' . $line . ';border-radius:12px;padding:16px 18px">'
         . '<div style="font:12px/1.4 Arial,sans-serif;color:' . $muted . ';text-transform:uppercase;letter-spacing:.06em">Логин</div>'
         . '<div style="font:700 15px/1.5 Arial,sans-serif;color:' . $navy . ';margin-bottom:10px">{{login}}</div>'
         . '<div style="font:12px/1.4 Arial,sans-serif;color:' . $muted . ';text-transform:uppercase;letter-spacing:.06em">Временный пароль</div>'
         . '<div style="font:700 20px/1.4 \'Courier New\',monospace;color:' . $navy . ';letter-spacing:.06em">{{password}}</div>'
         . '<div style="font:12px/1.5 Arial,sans-serif;color:' . $muted . ';margin-top:8px">Пароль можно сменить в настройках кабинета.</div>'
         . '</td></tr></table>'
         . mm_email_btn($base . '/cabinet', 'Войти в кабинет', 'navy')
         . LC_CAB_CLOSE;

    /* Клуб — только тем, кто ещё не состоит. Коротко: четыре причины и одна кнопка. */
    // Процент берём из настройки напрямую: club_discount_percent() считает скидку
    // КОНКРЕТНОГО человека и требует его id, а здесь речь о размере скидки вообще.
    $disc = max(1, (int) setting('club_discount', '20'));
    $out .= LC_VIP_OPEN
         . '<div style="height:1px;background:' . $line . ';margin:26px 0"></div>'
         . '<h2 style="margin:0 0 10px;font:700 19px/1.3 Georgia,serif;color:' . $navy . '">Клуб постоянных участников</h2>'
         . $p('Для педагогов и активных участников - привилегии, ранние результаты и особые условия.')
         /* ПУНКТЫ — ИЗ ОБЩЕГО СПИСКА (core/club_perks.php).
          * Здесь стоял свой набор, набранный руками, и он разошёлся со страницей
          * клуба: обещали «ответ в течение суток», тогда как на сайте написано
          * «моментально, вне очереди». Письмо запуска уходит по всей базе. */
         . (static function () use ($disc): string {
               if (!function_exists('club_perks_mail') && is_file(BASE_PATH . '/core/club_perks.php')) {
                   require_once BASE_PATH . '/core/club_perks.php';
               }
               $rows = '';
               foreach (array_slice(function_exists('club_perks_mail') ? club_perks_mail($disc) : [], 0, 4) as $p) {
                   $rows .= lc_perk((string) $p['t'], mb_strtolower(mb_substr((string) $p['short'], 0, 1)) . mb_substr((string) $p['short'], 1));
               }
               return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px">'
                    . $rows . '</table>';
           })()
         . mm_email_btn($base . '/club', 'Вступить в Клуб', 'navy')
         . LC_VIP_CLOSE;

    return $out;
}

/** Строка списка привилегий клуба: название и пояснение под ним. */
function lc_perk(string $title, string $note): string {
    return '<tr><td style="padding:9px 0;border-bottom:1px solid ' . MM_LINE . '">'
         . '<div style="font:700 15px/1.4 Arial,sans-serif;color:' . MM_INK . '">' . h($title) . '</div>'
         . '<div style="font:13px/1.5 Arial,sans-serif;color:' . MM_MUTED . '">' . h($note) . '</div>'
         . '</td></tr>';
}
