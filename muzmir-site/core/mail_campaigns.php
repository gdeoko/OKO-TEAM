<?php
/**
 * Конструктор МАРКЕТИНГОВЫХ писем-кампаний Культурного центра «Музыкальный Мир».
 *
 * Строит готовое «внутреннее» тело письма (вставляется в mm_email_layout из core/mailer.php):
 * афиши конкурсов с обложками, полосу образцов наград, блок ВИП-клуба, плашку поддержки
 * органов культуры и рабочие кнопки-CTA (Подать заявку, Положение, Образцы наград,
 * Поддержка Минкульта, Вступить в ВИП-клуб). Все картинки — абсолютными URL (почтовики
 * режут data:-URI и относительные пути). Палитра — имперская (navy/gold/ivory), как во всех письмах.
 *
 * Точки входа:
 *   campaign_build(string $type, array $opt=[]): array{subject,body}  — тема + внутреннее тело.
 *   campaign_inner(string $type, array $opt=[]): string               — только внутреннее тело.
 *   campaign_types(): array                                          — список пресетов для админки.
 *
 * Типы: new_competitions | vip | launch | deadline | news.
 */
declare(strict_types=1);

if (!function_exists('mm_email_layout')) require_once __DIR__ . '/mailer.php';

/* ------------------------------------------------------------------ */
/*  Абсолютные URL картинок/страниц                                    */
/* ------------------------------------------------------------------ */

/** Базовый абсолютный URL сайта (тот же, что для логотипа писем). */
function mmc_base(): string {
    $base = rtrim((string) cfgv('base_url', ''), '/');
    if ($base === '' || stripos($base, 'localhost') !== false || stripos($base, '127.0.0.1') !== false) {
        $base = 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai';
    }
    return $base;
}

/** Абсолютный URL для пути-ассета ('uploads/..' | '/assets/..' | 'https://..'). */
function mmc_url(string $path): string {
    $path = trim($path);
    if ($path === '') return '';
    if (preg_match('#^https?://#i', $path)) return $path;
    return mmc_base() . '/' . ltrim($path, '/');
}

/** Существует ли файл в public/ по web-пути ('/assets/..' | 'uploads/..'). */
function mmc_public_exists(string $webPath): bool {
    $rel = ltrim(trim($webPath), '/');
    if ($rel === '') return false;
    return is_file(BASE_PATH . '/public/' . $rel);
}

/* ------------------------------------------------------------------ */
/*  Данные                                                             */
/* ------------------------------------------------------------------ */

/** Открытые конкурсы (для афиш в письме). */
function mmc_open_competitions(): array {
    return all("SELECT id, slug, name, type, is_paid, price, cover, end_date, description
                  FROM competitions WHERE status='open' ORDER BY sort, id");
}

/** Кол-во благодарственных писем от органов культуры (соц-доказательство). */
function mmc_ministry_count(): int {
    return (int) scalar("SELECT COUNT(*) FROM ministry_letters");
}

/**
 * Полоса образцов наград для конкурса: до 4 плиток (кубок/статуэтка/медаль/диплом),
 * берём реально загруженные фото awards/<cid>/<slug>.jpg, иначе — общий набор с любого конкурса.
 * @return array<int,array{label:string,img:string}>
 */
function mmc_award_samples(int $cid = 0): array {
    $slots = [
        'cup'       => 'Кубок',
        'statuette' => 'Статуэтка',
        'medal'     => 'Медаль',
        'diploma'   => 'Диплом',
    ];
    $ids = [];
    if ($cid > 0) $ids[] = $cid;
    // добираем любые конкурсы, у которых есть фото
    foreach (all("SELECT id FROM competitions WHERE status='open' ORDER BY sort, id") as $r) {
        $ids[] = (int) $r['id'];
    }
    $out = [];
    foreach ($slots as $slug => $label) {
        foreach (array_unique($ids) as $id) {
            $web = '/assets/img/awards/' . $id . '/' . $slug . '.jpg';
            if (mmc_public_exists($web)) { $out[] = ['label' => $label, 'img' => mmc_url($web)]; break; }
        }
    }
    return $out;
}

/** Человеческий бейдж типа конкурса. */
function mmc_type_label(string $type): string {
    return [
        'international' => 'Международный',
        'national'      => 'Всероссийский',
        'regional'      => 'Региональный',
    ][$type] ?? 'Конкурс';
}

/* ------------------------------------------------------------------ */
/*  Строительные блоки (table-вёрстка, инлайн-стили)                   */
/* ------------------------------------------------------------------ */

/** Заголовок-эягол секции письма. */
function mmc_h(string $text, string $sub = ''): string {
    $navy = MM_NAVY; $gold = MM_GOLD; $muted = MM_MUTED;
    $s = '<h2 style="margin:0 0 6px;font-family:Georgia,\'Times New Roman\',serif;font-size:22px;line-height:1.25;color:' . $navy . ';font-weight:700;">' . h($text) . '</h2>';
    if ($sub !== '') $s .= '<p style="margin:0 0 18px;font-size:14px;color:' . $muted . ';line-height:1.6;">' . h($sub) . '</p>';
    return $s;
}

/** Плашка «При поддержке органов культуры». */
function mmc_ministry_badge(): string {
    $n = mmc_ministry_count();
    $navy = MM_NAVY; $gold = MM_GOLD; $ivory = MM_IVORY;
    $link = mmc_base() . '/ministry-support';
    $cnt  = $n > 0 ? ($n . '+ благодарственных писем от органов культуры регионов России') : 'Официальная поддержка органов культуры регионов России';
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;">'
        . '<tr><td style="background:' . $ivory . ';border:1px solid ' . MM_LINE . ';border-radius:14px;padding:16px 18px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        . '<td style="padding-right:14px;vertical-align:middle;width:44px;">'
        . '<div style="width:40px;height:40px;border-radius:50%;background:' . $navy . ';color:' . MM_GOLD2 . ';font-family:Georgia,serif;font-weight:700;font-size:20px;text-align:center;line-height:40px;">✦</div></td>'
        . '<td style="vertical-align:middle;">'
        . '<div style="font-weight:700;color:' . $navy . ';font-size:14px;">Официально · при поддержке органов культуры</div>'
        . '<div style="font-size:13px;color:' . MM_MUTED . ';margin-top:2px;">' . h($cnt) . '</div>'
        . '<a href="' . h($link) . '" style="display:inline-block;margin-top:8px;color:' . $gold . ';font-weight:700;font-size:13px;text-decoration:underline;">Смотреть письма поддержки →</a>'
        . '</td></tr></table></td></tr></table>';
}

/** Карточка одного конкурса: обложка + название + даты/взнос + кнопки. */
function mmc_competition_card(array $c): string {
    $navy = MM_NAVY; $gold = MM_GOLD; $ink = MM_INK; $muted = MM_MUTED; $card = MM_CARD; $line = MM_LINE;
    $base = mmc_base();
    $slug = (string) ($c['slug'] ?? '');
    $name = (string) ($c['name'] ?? 'Конкурс');
    $cover = mmc_url((string) ($c['cover'] ?? ''));
    $typeL = mmc_type_label((string) ($c['type'] ?? ''));
    $paid  = (int) ($c['is_paid'] ?? 0) === 1;
    $price = (int) ($c['price'] ?? 0);
    $priceL = $paid && $price > 0 ? ('Оргвзнос ' . number_format($price, 0, ',', ' ') . ' ₽') : 'Бесплатное участие';
    $end   = trim((string) ($c['end_date'] ?? ''));
    $endL  = $end !== '' ? ('Приём заявок до ' . date('d.m.Y', strtotime($end))) : '';

    $applyUrl = $base . '/apply?comp=' . (int) ($c['id'] ?? 0);
    $regUrl   = $base . '/competition/' . rawurlencode($slug) . '/regulation.pdf';

    $img = $cover !== ''
        ? '<img src="' . h($cover) . '" alt="' . h($name) . '" width="516" style="display:block;width:100%;max-width:516px;height:auto;border-radius:14px 14px 0 0;">'
        : '';

    // Кнопки в одну строку (table для стабильности в почтовиках).
    $btns = '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:6px;"><tr>'
        . '<td style="padding-right:10px;"><a href="' . h($applyUrl) . '" style="display:inline-block;padding:12px 26px;border-radius:11px;background:' . $navy . ';background:linear-gradient(135deg,' . $navy . ',' . MM_NAVY2 . ');color:' . MM_GOLD2 . ';text-decoration:none;font-weight:700;font-size:14px;">Подать заявку</a></td>'
        . '<td><a href="' . h($regUrl) . '" style="display:inline-block;padding:12px 24px;border-radius:11px;border:1.5px solid ' . $gold . ';color:' . $navy . ';text-decoration:none;font-weight:700;font-size:14px;">Положение</a></td>'
        . '</tr></table>';

    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid ' . $line . ';border-radius:14px;overflow:hidden;background:#FFFFFF;box-shadow:0 6px 22px rgba(23,48,122,.08);">'
        . '<tr><td style="padding:0;">' . $img . '</td></tr>'
        . '<tr><td style="padding:16px 18px 18px;">'
        . '<div style="display:inline-block;background:' . $card . ';color:' . $navy . ';font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:8px;">' . h($typeL) . '</div>'
        . '<div style="font-family:Georgia,serif;font-size:19px;font-weight:700;color:' . $navy . ';line-height:1.25;">' . h($name) . '</div>'
        . ($endL !== '' ? '<div style="font-size:13px;color:' . $muted . ';margin-top:6px;">📅 ' . h($endL) . '</div>' : '')
        . '<div style="font-size:13px;color:' . ($paid ? $ink : '#1E7F43') . ';font-weight:700;margin-top:3px;">' . ($paid ? '💳 ' : '🎁 ') . h($priceL) . '</div>'
        . $btns
        . '</td></tr></table>';
}

/** Полоса образцов наград + кнопка на страницу образцов. */
function mmc_awards_strip(int $cid = 0): string {
    $samples = mmc_award_samples($cid);
    if (!$samples) return '';
    $navy = MM_NAVY; $muted = MM_MUTED;
    $cells = '';
    $w = (int) floor(100 / max(1, count($samples)));
    foreach ($samples as $s) {
        $cells .= '<td width="' . $w . '%" style="padding:5px;text-align:center;vertical-align:top;">'
            . '<img src="' . h($s['img']) . '" alt="' . h($s['label']) . '" width="120" style="display:block;width:100%;max-width:130px;height:auto;border-radius:10px;border:1px solid ' . MM_LINE . ';margin:0 auto;">'
            . '<div style="font-size:12px;color:' . $muted . ';margin-top:6px;font-weight:600;">' . h($s['label']) . '</div>'
            . '</td>';
    }
    return mmc_h('Настоящие награды победителям', 'Кубки, статуэтки, медали и дипломы — с бесплатным электронным дипломом каждому участнику.')
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;"><tr>' . $cells . '</tr></table>'
        . mm_email_btn(mmc_base() . '/awards', 'Смотреть образцы наград', 'gold');
}

/** Блок ВИП-клуба. */
function mmc_vip_block(): string {
    $navy = MM_NAVY; $gold = MM_GOLD; $gold2 = MM_GOLD2;
    $perks = [
        'Безлимитное участие во всех конкурсах сезона',
        'Приоритетная проверка жюри и ранние результаты',
        'Эксклюзивные именные награды и статус ВИП',
        'Персональный менеджер и закрытые мероприятия',
    ];
    $list = '';
    foreach ($perks as $p) {
        $list .= '<tr><td style="padding:5px 0;font-size:14px;color:#3A2E10;line-height:1.5;">✦ ' . h($p) . '</td></tr>';
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;">'
        . '<tr><td style="border-radius:16px;padding:24px 22px;background:' . $gold . ';background:linear-gradient(135deg,' . $gold . ' 0%,' . $gold2 . ' 100%);">'
        . '<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:' . $navy . ';font-weight:700;opacity:.8;">Закрытый клуб</div>'
        . '<div style="font-family:Georgia,serif;font-size:23px;font-weight:700;color:' . $navy . ';margin:4px 0 12px;">ВИП-клуб «Музыкальный Мир»</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $list . '</table>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr><td style="border-radius:11px;background:' . $navy . ';">'
        . '<a href="' . h(mmc_base() . '/club') . '" style="display:inline-block;padding:13px 32px;color:' . $gold2 . ';text-decoration:none;font-weight:700;font-size:15px;border-radius:11px;">Вступить в ВИП-клуб →</a>'
        . '</td></tr></table>'
        . '</td></tr></table>';
}

/** Крупный финальный CTA. */
function mmc_cta(string $label, string $href, string $variant = 'navy'): string {
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td align="center">'
        . mm_email_btn($href, $label, $variant)
        . '</td></tr></table>';
}

/* ------------------------------------------------------------------ */
/*  Кампании                                                           */
/* ------------------------------------------------------------------ */

/** Список пресетов кампаний для админки: ключ => подпись. */
function campaign_types(): array {
    return [
        'new_competitions' => 'Новые конкурсы (приглашение)',
        'vip'              => 'ВИП-клуб (приглашение)',
        'launch'           => 'Запуск сайта / большой анонс',
        'deadline'         => 'Осталось 3 дня до конца приёма',
        'news'             => 'Новость / дайджест',
    ];
}

/** Тема письма по типу кампании. */
function campaign_subject(string $type, array $opt = []): string {
    $comps = mmc_open_competitions();
    $n = count($comps);
    switch ($type) {
        case 'vip':
            return 'Приглашение в ВИП-клуб «Музыкальный Мир» — участвуйте без ограничений';
        case 'launch':
            return 'Мы открылись! Конкурсы, награды и дипломы — Культурный центр «Музыкальный Мир»';
        case 'deadline':
            return 'Осталось 3 дня — успейте подать заявку на конкурс';
        case 'news':
            return (string) ($opt['subject'] ?? 'Новости Культурного центра «Музыкальный Мир»');
        case 'new_competitions':
        default:
            return $n > 0
                ? ('Открыт приём заявок — ' . $n . ' ' . mmc_plural($n, 'конкурс', 'конкурса', 'конкурсов') . ' с наградами и дипломами')
                : 'Открыт приём заявок на конкурсы «Музыкальный Мир»';
    }
}

/** Склонение существительного по числу. */
function mmc_plural(int $n, string $one, string $few, string $many): string {
    $n = abs($n) % 100; $n1 = $n % 10;
    if ($n > 10 && $n < 20) return $many;
    if ($n1 > 1 && $n1 < 5) return $few;
    if ($n1 === 1) return $one;
    return $many;
}

/** Внутреннее тело письма (для mm_email_layout). */
function campaign_inner(string $type, array $opt = []): string {
    $navy = MM_NAVY; $ink = MM_INK; $muted = MM_MUTED;
    $base = mmc_base();
    $greet = '<p style="margin:0 0 6px;font-size:16px;color:' . $ink . ';">Здравствуйте, {{name}}!</p>';

    $comps = mmc_open_competitions();
    $firstCid = $comps ? (int) $comps[0]['id'] : 0;

    $compCards = '';
    foreach ($comps as $c) $compCards .= mmc_competition_card($c);

    // Почему мы (соц-доказательство).
    $why = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 22px;">'
        . '<tr><td style="padding:6px 0;font-size:14px;color:' . $ink . ';">✓ Официально · при поддержке органов культуры регионов России</td></tr>'
        . '<tr><td style="padding:6px 0;font-size:14px;color:' . $ink . ';">✓ Аттестационные дипломы — учитываются в портфолио педагога и ученика</td></tr>'
        . '<tr><td style="padding:6px 0;font-size:14px;color:' . $ink . ';">✓ Участники из 85 регионов России и зарубежья</td></tr>'
        . '<tr><td style="padding:6px 0;font-size:14px;color:' . $ink . ';">✓ Быстрые результаты и электронный диплом каждому участнику — бесплатно</td></tr>'
        . '</table>';

    switch ($type) {

        case 'vip':
            return $greet
                . mmc_h('Ваше приглашение в ВИП-клуб', 'Для педагогов и активных участников — участие во всех конкурсах сезона без ограничений.')
                . mmc_vip_block()
                . mmc_ministry_badge()
                . mmc_cta('Узнать больше о ВИП-клубе', $base . '/club', 'gold');

        case 'launch':
            return $greet
                . mmc_h('Культурный центр «Музыкальный Мир» открыт!', 'Международные и всероссийские конкурсы, настоящие награды и официальные дипломы — теперь на новом сайте.')
                . mmc_ministry_badge()
                . ($compCards !== '' ? mmc_h('Идёт приём заявок') . $compCards : '')
                . mmc_awards_strip($firstCid)
                . mmc_vip_block()
                . $why
                . mmc_cta('Открыть сайт и подать заявку', $base . '/', 'navy');

        case 'deadline':
            $endL = $comps && !empty($comps[0]['end_date']) ? date('d.m.Y', strtotime((string) $comps[0]['end_date'])) : '';
            return $greet
                . mmc_h('⏳ Осталось всего 3 дня', ($endL !== '' ? ('Приём заявок закрывается ' . $endL . '. Успейте принять участие и получить награду.') : 'Приём заявок скоро закроется. Успейте принять участие.'))
                . ($compCards !== '' ? $compCards : '')
                . mmc_awards_strip($firstCid)
                . mmc_cta('Подать заявку сейчас', $base . '/apply', 'navy');

        case 'news':
            $body = (string) ($opt['body'] ?? '<p>Свежие новости центра.</p>');
            return $greet
                . '<div style="font-size:15px;line-height:1.7;color:' . $ink . ';">' . $body . '</div>'
                . mmc_cta('Перейти на сайт', $base . '/', 'gold');

        case 'new_competitions':
        default:
            return $greet
                . mmc_h('Открыт приём заявок на конкурсы', 'Международные и всероссийские творческие конкурсы с настоящими наградами, официальными и аттестационными дипломами.')
                . mmc_ministry_badge()
                . ($compCards !== '' ? $compCards : '<p style="color:' . $muted . '">Скоро откроются новые конкурсы.</p>')
                . mmc_awards_strip($firstCid)
                . $why
                . mmc_vip_block()
                . mmc_cta('Подать заявку сейчас', $base . '/apply', 'navy');
    }
}

/**
 * Готовая кампания: тема + внутреннее тело (тело ещё оборачивается брендовым лейаутом
 * на этапе постановки в очередь — там добавятся логотип, подвал, соцкнопки и отписка).
 * @return array{subject:string,body:string}
 */
function campaign_build(string $type, array $opt = []): array {
    return [
        'subject' => campaign_subject($type, $opt),
        'body'    => campaign_inner($type, $opt),
    ];
}
