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

/**
 * Каноническая формулировка поддержки (единая для ВСЕХ писем/материалов).
 * ВАЖНО (правило Даниэля): пишем ТОЛЬКО так, «при поддержке органов культуры» — нельзя.
 */
function mmc_support_line(): string {
    return 'при информационной поддержке Министерства культуры и образования субъектов '
         . 'Российской Федерации и государственного портала «Pro Культура»';
}

/** Плашка официальной информационной поддержки. */
function mmc_ministry_badge(): string {
    $n = mmc_ministry_count();
    $navy = MM_NAVY; $gold = MM_GOLD; $ivory = MM_IVORY;
    $link = mmc_base() . '/ministry-support';
    $cnt  = $n > 0 ? ($n . '+ благодарственных писем от учреждений культуры регионов России') : 'Официальные благодарственные письма от учреждений культуры регионов России';
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;">'
        . '<tr><td style="background:' . $ivory . ';border:1px solid ' . MM_LINE . ';border-radius:14px;padding:16px 18px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        . '<td style="padding-right:14px;vertical-align:middle;width:44px;">'
        . '<div style="width:40px;height:40px;border-radius:50%;background:' . $navy . ';color:' . MM_GOLD2 . ';font-family:Georgia,serif;font-weight:700;font-size:20px;text-align:center;line-height:40px;">✦</div></td>'
        . '<td style="vertical-align:middle;">'
        . '<div style="font-weight:700;color:' . $navy . ';font-size:14px;">Официально · при информационной поддержке Министерства культуры</div>'
        . '<div style="font-size:13px;color:' . MM_MUTED . ';margin-top:3px;line-height:1.5;">и образования субъектов РФ и государственного портала «Pro Культура». ' . h($cnt) . '.</div>'
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
    // Цены в письмах НЕ показываем (правило владельца) — оргвзнос участник увидит на сайте.
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
        // Эмодзи в письмах центра не используем: часть почтовых клиентов рисует
        // их чёрно-белым квадратом, а на бланке официального центра это выглядит
        // несерьёзно. Дату выделяем шрифтом, а не картинкой.
        . ($endL !== '' ? '<div style="font-size:13px;color:' . $muted . ';margin-top:6px;font-weight:600;">' . h($endL) . '</div>' : '')
        . $btns
        . '</td></tr></table>';
}

/**
 * Кнопка на страницу образцов наград.
 *
 * Раньше здесь была целая полоса: заголовок «Настоящие награды победителям»,
 * подзаголовок и ряд картинок-образцов. По решению владельца в общем письме
 * запуска этот блок убран — остаётся только кнопка внизу, а сами образцы
 * участник смотрит на сайте.
 */
function mmc_awards_strip(int $cid = 0): string {
    return mm_email_btn(mmc_base() . '/awards', 'Образцы наград', 'gold');
}

/**
 * Блок ВИП-клуба в теле письма.
 *
 * Раньше здесь был свой золотой блок с четырьмя общими фразами. Теперь единственный
 * источник — mm_vip_card() из core/mailer.php: она стоит в КАЖДОМ письме центра,
 * содержит актуальную скидку и сроки. Функция оставлена для совместимости и
 * возвращает пустую строку, чтобы карточка не дублировалась в одном письме дважды.
 */
function mmc_vip_block(): string {
    return '';
}

/** Блок «Личный кабинет» — возможности зарегистрированного пользователя (2×2 плитки). */
function mmc_kabinet_block(): string {
    $navy = MM_NAVY; $gold = MM_GOLD; $ink = MM_INK; $muted = MM_MUTED; $card = MM_CARD; $line = MM_LINE;
    $base = mmc_base();
    $tiles = [
        ['✦', 'Заявки и результаты', 'Все ваши заявки, статусы проверки и итоги жюри — на одном экране.'],
        ['✦', 'Дипломы под рукой', 'Электронные дипломы с номером и QR — скачать и переслать в один клик.'],
        ['✦', 'Заказ наград', 'Кубки, статуэтки и медали победителям — прямо из кабинета, с доставкой.'],
        ['✦', 'Приглашайте друзей', 'Реферальная программа: делитесь ссылкой и получайте бонусы.'],
    ];
    $cells = '';
    $i = 0;
    foreach ($tiles as $t) {
        if ($i % 2 === 0) $cells .= '<tr>';
        $cells .= '<td width="50%" style="padding:8px;vertical-align:top;">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' . $card . ';border:1px solid ' . $line . ';border-radius:14px;height:100%;">'
            . '<tr><td style="padding:16px 16px 18px;">'
            . '<div style="width:34px;height:34px;border-radius:9px;background:' . $navy . ';color:' . MM_GOLD2 . ';font-family:Georgia,serif;font-weight:700;font-size:17px;text-align:center;line-height:34px;margin-bottom:10px;">' . $t[0] . '</div>'
            . '<div style="font-weight:700;color:' . $navy . ';font-size:15px;margin-bottom:5px;">' . h($t[1]) . '</div>'
            . '<div style="font-size:13px;color:' . $muted . ';line-height:1.55;">' . h($t[2]) . '</div>'
            . '</td></tr></table></td>';
        $i++;
        if ($i % 2 === 0) $cells .= '</tr>';
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;">' . $cells . '</table>';
}

/** Сетка привилегий ВИП-клуба (как раздел «Что даёт членство» на сайте) — плитки без цен. */
function mmc_vip_perks_grid(): string {
    $navy = MM_NAVY; $muted = MM_MUTED; $card = MM_CARD; $line = MM_LINE;
    // Порядок — строго по важности, как в карточке клуба во всех письмах:
    // скидка и сроки идут первыми (раньше их в этой сетке не было вообще).
    $pct  = function_exists('mm_vip_discount') ? mm_vip_discount() : 20;
    $days = function_exists('mm_vip_days') ? mm_vip_days() : 3;
    $perks = [
        ['%',  'Скидка ' . $pct . '% на всё', 'Постоянная скидка на любые заявки на участие и на весь наградной материал.'],
        ['⏱',  'Результаты за ' . $days . ' рабочих дня', 'Итоги и изготовление наград — за ' . $days . ' рабочих дня вместо обычных 5.'],
        ['★', 'Бесплатный конкурс каждый месяц', '1 заявка с 1 номером в месяц — бесплатно, плюс бесплатный электронный диплом.'],
        ['✦', 'Закрытые конкурсы Клуба', 'Отдельные конкурсы, доступные только членам Клуба.'],
        ['◆', 'Ранний доступ к результатам', 'Заявки членов Клуба проверяются вне общей очереди — итоги узнаёте раньше.'],
        ['✚', 'Приоритетная поддержка', 'Ответ в течение 24 часов: помощь с заявками, документами и наградами — в первую очередь.'],
        ['❖', 'Спецпредложения на награды', 'Особые условия на медали, кубки и наградную атрибутику — только для членов Клуба.'],
        ['✎', 'Комментарии и рекомендации жюри', 'Персональные рекомендации аттестационного жюри по Вашему номеру — для роста учеников.'],
        ['❋', 'Именная карта участника', 'Электронная карта члена Клуба — подтверждает статус и привилегии постоянного участника.'],
        ['✧', 'Клубный чат участников', 'Закрытое сообщество участников и педагогов: встречи с жюри, обмен опытом.'],
    ];
    $cells = ''; $i = 0;
    foreach ($perks as $p) {
        if ($i % 2 === 0) $cells .= '<tr>';
        $cells .= '<td width="50%" style="padding:7px;vertical-align:top;">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' . $card . ';border:1px solid ' . $line . ';border-radius:14px;height:100%;">'
            . '<tr><td style="padding:15px 15px 16px;">'
            . '<div style="width:34px;height:34px;border-radius:9px;background:' . $navy . ';color:' . MM_GOLD2 . ';font-family:Georgia,serif;font-weight:700;font-size:17px;text-align:center;line-height:34px;margin-bottom:9px;">' . $p[0] . '</div>'
            . '<div style="font-weight:700;color:' . $navy . ';font-size:14.5px;margin-bottom:4px;line-height:1.3;">' . h($p[1]) . '</div>'
            . '<div style="font-size:12.5px;color:' . $muted . ';line-height:1.5;">' . h($p[2]) . '</div>'
            . '</td></tr></table></td>';
        $i++;
        if ($i % 2 === 0) $cells .= '</tr>';
    }
    if ($i % 2 === 1) $cells .= '<td width="50%"></td></tr>';
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 16px;">' . $cells . '</table>';
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
        'kabinet'          => 'Личный кабинет (возможности)',
        'launch'           => 'Запуск сайта / большой анонс',
        'deadline'         => 'Осталось 3 дня до конца приёма',
        'news'             => 'Новость / дайджест',
    ];
}

/** Тема письма по типу кампании. */
function campaign_subject(string $type, array $opt = []): string {
    $comps = mmc_open_competitions();
    $n = count($comps);
    // A/B: две темы на тип; вариант выбирается $opt['ab'] (0/1) — можно чередовать по получателю.
    $ab = (int) ($opt['ab'] ?? 0) % 2;
    $variants = [
        'vip'      => ['Приглашение в ВИП-клуб «Музыкальный Мир» — участвуйте без ограничений',
                       'ВИП-клуб «Музыкальный Мир»: все конкурсы сезона по одной подписке'],
        'kabinet'  => ['Ваш личный кабинет «Музыкальный Мир» — заявки, дипломы и награды в одном месте',
                       'Личный кабинет «Музыкальный Мир»: следите за результатами и скачивайте дипломы'],
        'launch'   => ['Мы открылись! Конкурсы, награды и дипломы — Культурный центр «Музыкальный Мир»',
                       'Культурный центр «Музыкальный Мир» открыт: конкурсы, награды, официальные дипломы'],
        'deadline' => ['Осталось 3 дня — успейте подать заявку на конкурс',
                       'Приём заявок закрывается через 3 дня — не упустите'],
        'new_competitions' => [
            $n > 0 ? ('Открыт приём заявок — ' . $n . ' ' . mmc_plural($n, 'конкурс', 'конкурса', 'конкурсов') . ' с наградами и дипломами')
                   : 'Открыт приём заявок на конкурсы «Музыкальный Мир»',
            $n > 0 ? ('Новые конкурсы с наградами и дипломами — успейте подать заявку')
                   : 'Творческие конкурсы «Музыкальный Мир» — открыт приём заявок'],
    ];
    // Явное переопределение темы (редактирование из пульта запуска) — приоритетнее пресетов.
    if (trim((string) ($opt['subject'] ?? '')) !== '') return (string) $opt['subject'];
    if ($type === 'news') return 'Новости Культурного центра «Музыкальный Мир»';
    $set = $variants[$type] ?? $variants['new_competitions'];
    return $set[$ab] ?? $set[0];
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
    // Редактируемый вводный абзац из пульта (если задан) — идёт сразу после приветствия.
    $lead = trim((string) ($opt['lead'] ?? ''));
    if ($lead !== '') $greet .= '<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:' . $ink . ';">' . nl2br(h($lead)) . '</p>';

    $comps = mmc_open_competitions();
    $firstCid = $comps ? (int) $comps[0]['id'] : 0;

    $compCards = '';
    foreach ($comps as $c) $compCards .= mmc_competition_card($c);

    // Почему мы (соц-доказательство).
    $why = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 22px;">'
        . '<tr><td style="padding:6px 0;font-size:14px;color:' . $ink . ';">✓ Официально · ' . mmc_support_line() . '</td></tr>'
        . '<tr><td style="padding:6px 0;font-size:14px;color:' . $ink . ';">✓ Аттестационные дипломы — учитываются в портфолио педагога и ученика</td></tr>'
        . '<tr><td style="padding:6px 0;font-size:14px;color:' . $ink . ';">✓ Участники из 85 регионов России и зарубежья</td></tr>'
        . '<tr><td style="padding:6px 0;font-size:14px;color:' . $ink . ';">✓ Быстрые результаты и электронный диплом каждому участнику — бесплатно</td></tr>'
        . '</table>';

    switch ($type) {

        case 'vip':
            // Красиво, как раздел «ВИП-клуб» на сайте: CTA вверху и внизу, все привилегии,
            // БЕЗ ЦЕН — стоимость участник увидит на сайте.
            return $greet
                . mmc_h('Клуб постоянных участников «Музыкальный Мир»', 'Для педагогов и активных участников — привилегии, ранние результаты и особые условия. Стоимость и периоды подписки — на сайте.')
                . mmc_cta('Вступить в Клуб', $base . '/club', 'gold')
                . mmc_vip_perks_grid()
                . mmc_ministry_badge()
                . mmc_cta('Вступить в Клуб', $base . '/club', 'navy');

        case 'kabinet':
            return $greet
                . mmc_h('Ваш личный кабинет уже готов', 'Вход по вашей почте — все конкурсы, дипломы, награды и результаты собраны в одном месте.')
                . mmc_kabinet_block()
                . ($compCards !== '' ? mmc_h('Идёт приём заявок') . $compCards : '')
                . mmc_ministry_badge()
                . mmc_cta('Войти в личный кабинет', $base . '/cabinet', 'navy');

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
