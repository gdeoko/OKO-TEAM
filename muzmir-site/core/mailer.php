<?php
/**
 * Почтовый модуль Культурного центра «Музыкальный Мир».
 * Отправка через Gmail SMTP по cURL (smtps://smtp.gmail.com:465), очередь писем,
 * рендер премиум HTML-шаблонов. Все ошибки — тихие, наружу только bool/int.
 * Контракт: см. docs/CONTRACTS.md (раздел mailer).
 */
declare(strict_types=1);

/* ================= Единый фирменный стиль писем (имперская палитра) =================
 * Синий #17307A, золото #C79322, айвори #FAF4E6. Georgia/Playfair для заголовков,
 * table-вёрстка, все ссылки — только кнопками. Использовать ВЕЗДЕ, где собирается письмо.
 */
const MM_NAVY   = '#17307A';
const MM_NAVY2  = '#24499F';
const MM_GOLD   = '#C79322';
const MM_GOLD2  = '#E3B94F';
const MM_IVORY  = '#FAF4E6';
const MM_INK    = '#1D2B55';
const MM_MUTED  = '#6B7699';
const MM_CARD   = '#F4F6FC';
const MM_LINE   = '#DCE3F3';

/** Абсолютный URL логотипа центра для писем (почтовики режут data:-URI). */
function mm_logo_url(): string {
    $base = rtrim((string) cfgv('base_url', ''), '/');
    if ($base === '' || stripos($base, 'localhost') !== false || stripos($base, '127.0.0.1') !== false) {
        $base = 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai';
    }
    return $base . '/assets/img/logo_muzmir_256.png';
}

/**
 * Фирменная кнопка письма (table-обёртка — стабильно во всех почтовиках).
 * $variant: 'gold' (золотой градиент, синий текст) | 'navy' (синий градиент, золотой текст).
 */
function mm_email_btn(string $href, string $label, string $variant = 'gold'): string {
    if ($variant === 'navy') {
        $bg = 'background:' . MM_NAVY . ';background:linear-gradient(135deg,' . MM_NAVY . ',' . MM_NAVY2 . ');';
        $color = MM_GOLD2;
    } else {
        $bg = 'background:' . MM_GOLD . ';background:linear-gradient(135deg,' . MM_GOLD . ',' . MM_GOLD2 . ');';
        $color = MM_NAVY;
    }
    return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">'
        . '<tr><td style="border-radius:12px;' . $bg . '">'
        . '<a href="' . h($href) . '" style="display:inline-block;padding:14px 36px;color:' . $color . ';'
        . 'text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.02em;border-radius:12px;">'
        . h($label) . '</a></td></tr></table>';
}

/**
 * Единый фирменный лейаут письма: шапка с логотипом на синем градиенте,
 * белая карточка контента, подвал с контактами. Все письма сайта — только через него.
 * $opt: preheader, unsubscribe_url (ссылка отписки в подвале, иначе строка без ссылки),
 *       pixel (HTML пикселя открытия), audience_note (пояснение в подвале).
 */
function mm_email_layout(string $inner, array $opt = []): string {
    $navy = MM_NAVY; $navy2 = MM_NAVY2; $gold = MM_GOLD; $ink = MM_INK;
    $muted = MM_MUTED; $ivory = MM_IVORY; $line = MM_LINE;

    $logo  = h(mm_logo_url());
    $org   = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
    $addr  = h((string) cfgv('org_address', ''));
    $phone = h((string) cfgv('org_phone', '+7 (999) 504-88-99'));
    $email = h((string) cfgv('org_email', ''));
    $hours = h((string) cfgv('org_hours', ''));
    $year  = (int) cfgv('year', (int) date('Y'));
    $pre   = h((string) ($opt['preheader'] ?? ''));
    $pixel = (string) ($opt['pixel'] ?? '');
    $note  = h((string) ($opt['audience_note'] ?? 'Вы получили это письмо, так как оставили заявку или подписку на сайте центра.'));

    $contacts = '';
    if ($addr  !== '') $contacts .= '<div style="margin-top:2px;">' . $addr . '</div>';
    if ($phone !== '') $contacts .= '<div style="margin-top:2px;">Телефон: ' . $phone . '</div>';
    if ($email !== '') $contacts .= '<div style="margin-top:2px;">Почта: ' . $email . '</div>';
    if ($hours !== '') $contacts .= '<div style="margin-top:2px;">Режим работы: ' . $hours . '</div>';

    // Карточка ВИП-клуба — в каждом письме (отключается явным ['vip'=>false]).
    $vipCard = (($opt['vip'] ?? true) && function_exists('mm_vip_card')) ? mm_vip_card() : '';

    $unsubUrl = trim((string) ($opt['unsubscribe_url'] ?? ''));
    $unsubLine = $unsubUrl !== '' && $unsubUrl !== '{{unsubscribe_url}}'
        ? $note . ' <a href="' . h($unsubUrl) . '" style="color:' . $gold . ';text-decoration:underline;">Отписаться от рассылки</a>.'
        : $note;

    // Подписка на наши каналы — ВКонтакте и MAX (в каждом письме).
    $vkUrl  = h((string) cfgv('org_vk', 'https://vk.com/music_world.online'));
    $maxUrl = h((string) cfgv('org_max', 'https://max.ru/join/v4SJluLzTAMWm4r5ldJ-JyA2rS5InmPYjaP6drn3F8I'));
    $social = '<div style="margin-top:18px;">'
        . '<div style="font-size:12px;color:' . $muted . ';margin-bottom:8px;">Подпишитесь на наши каналы - анонсы конкурсов, результаты и полезное:</div>'
        . '<a href="' . $vkUrl . '" style="display:inline-block;margin:0 8px 8px 0;padding:9px 18px;background:' . $navy . ';color:#FFFFFF;text-decoration:none;border-radius:9px;font-size:13px;font-weight:700;">ВКонтакте</a>'
        . '<a href="' . $maxUrl . '" style="display:inline-block;margin:0 8px 8px 0;padding:9px 18px;background:' . $gold . ';color:' . $navy . ';text-decoration:none;border-radius:9px;font-size:13px;font-weight:700;">Канал в MAX</a>'
        . '</div>';

    return <<<HTML
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>{$org}</title>
</head>
<body style="margin:0;padding:0;background:{$ivory};font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:{$ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{$pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{$ivory};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(23,48,122,.16);">

  <tr>
    <td style="background:{$navy};background:linear-gradient(135deg,{$navy} 0%,{$navy2} 100%);padding:32px 40px 28px;text-align:center;">
      <img src="{$logo}" alt="{$org}" width="96" height="96"
           style="display:inline-block;width:96px;height:96px;border-radius:50%;background:#FFFFFF;border:2px solid {$gold};">
      <div style="margin-top:14px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:{$gold};letter-spacing:.04em;line-height:1.35;">Культурный центр<br>«Музыкальный Мир»</div>
      <div style="margin-top:8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.78);">Конкурсы · Фестивали · Концерты</div>
    </td>
  </tr>

  <tr>
    <td style="padding:38px 42px 28px;font-size:15px;line-height:1.7;color:{$ink};">
      {$inner}
    </td>
  </tr>

  <tr><td style="padding:0 38px 4px;">{$vipCard}</td></tr>

  <tr><td style="padding:0 42px;"><div style="height:1px;background:{$line};"></div></td></tr>

  <tr>
    <td style="padding:24px 42px 32px;font-size:13px;line-height:1.65;color:{$muted};">
      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;color:{$navy};font-size:14px;margin-bottom:6px;">{$org}</div>
      {$contacts}
      {$social}
      <div style="margin-top:16px;font-size:12px;color:#96A0BE;">{$unsubLine}</div>
      <div style="margin-top:8px;font-size:12px;color:#A9B2CC;">© {$year} {$org}</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
{$pixel}
</body>
</html>
HTML;
}

/**
 * Крупная выделенная ПЕРВИЧНАЯ кнопка-CTA (ставится вверху письма — главное действие).
 * $variant: 'gold' | 'navy'.
 */
function mm_cta_primary(string $href, string $label, string $sub = '', string $variant = 'gold'): string {
    $bg = $variant === 'navy'
        ? 'background:' . MM_NAVY . ';background:linear-gradient(135deg,' . MM_NAVY . ',' . MM_NAVY2 . ');'
        : 'background:' . MM_GOLD . ';background:linear-gradient(135deg,' . MM_GOLD . ',' . MM_GOLD2 . ');';
    $color = $variant === 'navy' ? MM_GOLD2 : MM_NAVY;
    $s = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;"><tr>'
        . '<td style="border-radius:14px;' . $bg . 'padding:18px 22px;text-align:center;">';
    if ($sub !== '') $s .= '<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:' . ($variant === 'navy' ? 'rgba(255,233,168,.85)' : 'rgba(23,48,122,.75)') . ';margin-bottom:8px;font-weight:700;">' . h($sub) . '</div>';
    $s .= '<a href="' . h($href) . '" style="display:inline-block;padding:13px 34px;border-radius:11px;background:' . ($variant === 'navy' ? MM_GOLD : MM_NAVY) . ';color:' . ($variant === 'navy' ? MM_NAVY : MM_GOLD2) . ';text-decoration:none;font-weight:700;font-size:16px;">' . h($label) . '</a>'
        . '</td></tr></table>';
    return $s;
}

/** Ряд вторичных кнопок-ссылок. $buttons = [[label,url,emoji?], ...]. */
function mm_actions_row(array $buttons): string {
    /* КНОПКИ РОВНЫМИ ПАРАМИ, А НЕ ЛЕСЕНКОЙ.
     *
     * Раньше все кнопки вставали в одну строку таблицы, и ширину каждой почта
     * считала по длине подписи: «Оставить отзыв» получал узкую клетку в одну
     * строку, «Скачать список результатов (DOCX)» — широкую в две, и ряд ехал
     * ступеньками с рваными переносами. На телефоне это выглядит как сбой вёрстки.
     *
     * Теперь по две кнопки в ряд, каждая ровно половина ширины, у всех одинаковая
     * высота (задана явно) и подпись по центру в две строки. Нечётная последняя
     * кнопка занимает ряд целиком — так ряд остаётся симметричным. */
    $btns = [];
    foreach ($buttons as $b) {
        $label = trim((string) ($b[0] ?? '')); $url = trim((string) ($b[1] ?? ''));
        if ($label !== '' && $url !== '') $btns[] = [$label, $url];
    }
    if (!$btns) return '';

    $cell = static function (array $b, string $width): string {
        return '<td width="' . $width . '" style="width:' . $width . ';padding:5px;" valign="top">'
             . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
             . 'style="border:1.5px solid ' . MM_LINE . ';border-radius:11px;background:' . MM_CARD . ';">'
             . '<tr><td height="52" style="height:52px;text-align:center;padding:8px 10px;">'
             . '<a href="' . h($b[1]) . '" style="display:block;color:' . MM_NAVY . ';text-decoration:none;'
             . 'font-weight:700;font-size:13px;line-height:1.35;">' . h($b[0]) . '</a>'
             . '</td></tr></table></td>';
    };

    $rows = '';
    for ($i = 0; $i < count($btns); $i += 2) {
        $left  = $cell($btns[$i], '50%');
        $right = isset($btns[$i + 1])
            ? $cell($btns[$i + 1], '50%')
            : '<td width="50%" style="width:50%;padding:5px;"></td>';
        $rows .= '<tr>' . $left . $right . '</tr>';
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
         . 'style="margin:6px 0 14px;table-layout:fixed;">' . $rows . '</table>';
}

/**
 * Промо-блок: другие конкурсы центра.
 * Кнопка ВИП-клуба отсюда убрана — она дублировала бы полноценную карточку клуба
 * (mm_vip_card), которая теперь стоит в каждом письме перед подвалом.
 */
function mm_promo_block(): string {
    $base = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 8px;"><tr>'
        . '<td style="padding:5px;"><a href="' . h($base . '/competitions') . '" style="display:block;text-align:center;padding:14px 10px;border-radius:12px;background:' . MM_NAVY . ';background:linear-gradient(135deg,' . MM_NAVY . ',' . MM_NAVY2 . ');color:' . MM_GOLD2 . ';text-decoration:none;font-weight:700;font-size:14px;">Другие конкурсы центра</a></td>'
        . '</tr></table>';
}

/**
 * Богатый ТРАНЗАКЦИОННЫЙ лейаут письма (результаты, дипломы, заказы, дожимы):
 * логотип, выделенная первичная CTA вверху, контент, ряд вторичных кнопок,
 * промо (ВИП/другие конкурсы), соцканалы (ВК/MAX) и контакты. БЕЗ «отписаться»
 * (это транзакционные письма — булк-подпись провоцирует спам-фильтр Яндекса).
 * $opt: preheader, hero (HTML первичной CTA, напр. mm_cta_primary(...)),
 *       actions ([[label,url],...]), promo(bool, по умолч. true), social(bool, по умолч. true),
 *       thanks(bool — добавить «Благодарим за участие»).
 */
function mm_email_tx(string $inner, array $opt = []): string {
    $navy = MM_NAVY; $navy2 = MM_NAVY2; $gold = MM_GOLD; $ink = MM_INK; $muted = MM_MUTED; $line = MM_LINE;
    $logo  = h(mm_logo_url());
    $org   = 'Культурный центр «Музыкальный Мир»';
    $phone = h((string) cfgv('org_phone', '+7 (999) 504-88-99'));
    $email = h((string) cfgv('org_email', ''));
    $addr  = h((string) cfgv('org_address', ''));
    $year  = (int) cfgv('year', (int) date('Y'));
    $pre   = h((string) ($opt['preheader'] ?? ''));
    $hero  = (string) ($opt['hero'] ?? '');
    $actions = mm_actions_row((array) ($opt['actions'] ?? []));
    $promo = (($opt['promo'] ?? true)) ? mm_promo_block() : '';
    $thanks = !empty($opt['thanks']) ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;background:' . MM_CARD . ';border:1px solid ' . $line . ';border-radius:12px;"><tr><td style="width:4px;background:' . $gold . ';border-radius:12px 0 0 12px;"></td><td style="padding:14px 20px;font-size:14px;color:' . $ink . ';line-height:1.6;">Благодарим Вас за участие. Желаем новых творческих побед - и ждём Вас на конкурсах центра!</td></tr></table>' : '';

    $vkUrl  = h((string) cfgv('org_vk', 'https://vk.com/music_world.online'));
    $maxUrl = h((string) cfgv('org_max', 'https://max.ru/join/v4SJluLzTAMWm4r5ldJ-JyA2rS5InmPYjaP6drn3F8I'));
    $social = (($opt['social'] ?? true)) ? ('<div style="margin-top:16px;padding-top:14px;border-top:1px solid ' . $line . ';">'
        . '<div style="font-size:12px;color:' . $muted . ';margin-bottom:8px;">Мы в соцсетях - анонсы конкурсов, результаты, полезное:</div>'
        . '<a href="' . $vkUrl . '" style="display:inline-block;margin:0 8px 6px 0;padding:9px 18px;background:' . $navy . ';color:#fff;text-decoration:none;border-radius:9px;font-size:13px;font-weight:700;">ВКонтакте</a>'
        . '<a href="' . $maxUrl . '" style="display:inline-block;margin:0 8px 6px 0;padding:9px 18px;background:' . $gold . ';color:' . $navy . ';text-decoration:none;border-radius:9px;font-size:13px;font-weight:700;">Канал в MAX</a>'
        . '</div>') : '';

    return '<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"></head>'
        . '<body style="margin:0;padding:0;background:#EEF1F8;font-family:\'Segoe UI\',Arial,Helvetica,sans-serif;color:' . $ink . ';">'
        . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' . $pre . '</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF1F8;padding:26px 12px;"><tr><td align="center">'
        . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 10px 34px rgba(23,48,122,.14);">'
        . '<tr><td style="background:' . $navy . ';background:linear-gradient(135deg,' . $navy . ' 0%,' . $navy2 . ' 100%);padding:26px 32px;text-align:center;">'
        . '<img src="' . $logo . '" alt="" width="76" height="76" style="width:76px;height:76px;border-radius:50%;background:#fff;border:2px solid ' . $gold . ';">'
        . '<div style="margin-top:10px;font-family:Georgia,serif;color:' . $gold . ';font-weight:700;font-size:17px;line-height:1.3;">Культурный центр<br>«Музыкальный Мир»</div>'
        . '<div style="margin-top:6px;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72);">Конкурсы · Фестивали · Награды</div></td></tr>'
        . '<tr><td style="padding:30px 32px 22px;font-size:15px;line-height:1.7;">' . $hero . $inner . $thanks . '</td></tr>'
        . ($actions !== '' ? '<tr><td style="padding:0 28px 6px;">' . $actions . '</td></tr>' : '')
        . ($promo !== '' ? '<tr><td style="padding:0 28px 8px;">' . $promo . '</td></tr>' : '')
        // Карточка ВИП-клуба — в каждом письме центра, перед подвалом.
        // Отключается только явным ['vip'=>false] (например, в самом письме про клуб).
        . ((($opt['vip'] ?? true) && function_exists('mm_vip_card'))
              ? '<tr><td style="padding:0 28px 10px;">' . mm_vip_card() . '</td></tr>' : '')
        . '<tr><td style="padding:16px 32px 26px;border-top:1px solid ' . $line . ';font-size:13px;color:' . $muted . ';line-height:1.6;">'
        . '<div style="font-family:Georgia,serif;font-weight:700;color:' . $navy . ';font-size:14px;margin-bottom:6px;">' . $org . '</div>'
        . ($addr !== '' ? '<div>' . $addr . '</div>' : '')
        . '<div>Телефон: ' . $phone . ($email !== '' ? ' · Почта: ' . $email : '') . '</div>'
        . $social
        . '<div style="margin-top:12px;font-size:12px;color:#A9B2CC;">© ' . $year . ' ' . $org . '</div>'
        . '</td></tr></table></td></tr></table></body></html>';
}

/**
 * Скидка члена ВИП-клуба, % — единственный источник правды для сайта, писем,
 * подачи заявки и заказа наград. Меняется настройкой settings.club_discount.
 */
function mm_vip_discount(): int {
    $pct = 0;
    if (function_exists('setting')) $pct = (int) setting('club_discount', '20');
    return $pct > 0 ? $pct : 20;
}

/** Срок для членов клуба (рабочих дней) против обычных 5. */
function mm_vip_days(): int { return 3; }

/**
 * КАРТОЧКА ВИП-КЛУБА — компактный золотой блок, который ставится в КАЖДОЕ письмо
 * центра (как контакты в подвале). Привилегии перечислены по убыванию важности:
 * скидка 20% на всё → ускоренные сроки → бесплатный конкурс ежемесячно → далее.
 * Вёрстка — только таблицы и инлайн-стили (стабильно во всех почтовиках).
 */
function mm_vip_card(array $opt = []): string {
    $base  = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
    if (stripos($base, 'localhost') !== false) $base = 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai';
    $url   = $base . '/club';
    $pct   = mm_vip_discount();
    $days  = mm_vip_days();
    $navy  = MM_NAVY; $gold = MM_GOLD; $gold2 = MM_GOLD2;

    /* ПУНКТЫ БЕРЁМ ИЗ ОБЩЕГО СПИСКА, А НЕ ПИШЕМ ЗДЕСЬ ЗАНОВО.
     *
     * Раньше здесь стоял свой набор из шести строк, набранный руками, и он
     * разошёлся со страницей клуба: участнику обещали «ответ в течение суток»,
     * тогда как на сайте написано «моментально, вне очереди», а «рекомендации
     * жюри» и «именная карта» были слеплены в одну строку. Эта карточка стоит
     * почти в каждом письме центра — неверное обещание уходило тысячами.
     * Единственный источник — club_perks() в core/club_perks.php.
     *
     * Карточка обязана оставаться КОМПАКТНОЙ и на телефоне, поэтому берём только
     * помеченные для письма пункты и короткие подписи в одну строку. */
    if (!function_exists('club_perks_mail') && is_file(BASE_PATH . '/core/club_perks.php')) {
        require_once BASE_PATH . '/core/club_perks.php';
    }
    $perks = [];
    foreach (function_exists('club_perks_mail') ? club_perks_mail($pct, $days) : [] as $p) {
        $perks[] = [(string) $p['badge'], (string) $p['t'], (string) $p['short']];
    }
    $rows = '';
    foreach ($perks as [$badge, $title, $desc]) {
        $rows .= '<tr>'
            . '<td width="52" valign="top" style="padding:4px 9px 4px 0;">'
            . '<div style="background:' . $navy . ';color:' . $gold2 . ';border-radius:7px;font-size:10.5px;font-weight:700;'
            . 'text-align:center;padding:5px 3px;line-height:1.1;white-space:nowrap;">' . h($badge) . '</div></td>'
            . '<td valign="top" style="padding:4px 0;">'
            . '<div style="font-size:13px;font-weight:700;color:#2A2005;line-height:1.3;">' . h($title) . '</div>'
            . '<div style="font-size:11.5px;color:#5A4A18;line-height:1.35;">' . h($desc) . '</div></td>'
            . '</tr>';
    }

    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;">'
        . '<tr><td style="border-radius:16px;padding:18px 18px 16px;'
        . 'background:' . $gold . ';background:linear-gradient(135deg,' . $gold2 . ' 0%,' . $gold . ' 55%,#B8892B 100%);">'
        . '<div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:' . $navy . ';font-weight:700;opacity:.75;">Закрытый клуб центра</div>'
        . '<div style="font-family:Georgia,serif;font-size:19px;font-weight:700;color:' . $navy . ';margin:3px 0 0;line-height:1.25;">ВИП-клуб «Музыкальный&nbsp;Мир»</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:11px 0 0;">' . $rows . '</table>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:13px 0 0;"><tr>'
        . '<td style="border-radius:10px;background:' . $navy . ';">'
        . '<a href="' . h($url) . '" style="display:inline-block;padding:11px 26px;color:' . $gold2 . ';text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;">Вступить в ВИП-клуб →</a>'
        . '</td></tr></table>'
        . '</td></tr></table>';
}

/** Тихий лог почты в data/logs/mail.log. */
function mail_log(string $msg): void {
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
    @file_put_contents(BASE_PATH . '/data/logs/mail.log', $line, FILE_APPEND | LOCK_EX);
}

/** MIME encoded-word для не-ASCII заголовков (Subject, имя отправителя). */
function mail_encode_header(string $s): string {
    if (preg_match('/^[\x20-\x7E]*$/', $s)) return $s;         // чистый ASCII — как есть
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

/** Собирает готовое MIME-письмо (multipart) с HTML и вложением(ями).
 *  $attach — путь (строка) ИЛИ массив путей (несколько вложений). */
function mail_build_mime(string $fromName, string $fromEmail, string $to, string $replyTo,
                         string $subject, string $html, $attach = '', string $unsubUrl = ''): string {
    $eol = "\r\n";
    $boundary = 'mm_' . bin2hex(random_bytes(12));
    $fromH = mail_encode_header($fromName) . ' <' . $fromEmail . '>';

    $headers  = 'From: ' . $fromH . $eol;
    $headers .= 'To: ' . $to . $eol;
    if ($replyTo !== '') $headers .= 'Reply-To: ' . $replyTo . $eol;
    $headers .= 'Subject: ' . mail_encode_header($subject) . $eol;
    $headers .= 'Date: ' . date('r') . $eol;
    // Message-ID должен нести реальный домен, а не строку 'musmir' — иначе
    // gmail и yandex понижают репутацию письма и часто отправляют его в спам.
    // Берём домен из адреса отправителя, если он не пуст, иначе — из HTTP_HOST.
    $midHost = 'muzmir.local';
    if ($fromEmail !== '' && ($atPos = strrpos($fromEmail, '@')) !== false) {
        $midHost = substr($fromEmail, $atPos + 1);
    } elseif (!empty($_SERVER['HTTP_HOST'])) {
        $midHost = (string) $_SERVER['HTTP_HOST'];
    }
    $headers .= 'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $midHost . '>' . $eol;

    // ОТПИСКА КНОПКОЙ ПОЧТОВОГО КЛИЕНТА.
    // Ссылка отписки была только в подвале письма. Gmail, Mail.ru и Яндекс рисуют
    // штатную кнопку «Отписаться» рядом с отправителем лишь при этих заголовках.
    // Без неё человек, которому надоела рассылка, жмёт «Спам» — и это бьёт по
    // репутации домена сильнее, чем сама отписка.
    if ($unsubUrl !== '') {
        $mailto = trim((string) cfgv('org_email', ''));
        $headers .= 'List-Unsubscribe: <' . $unsubUrl . '>'
                  . ($mailto !== '' ? ', <mailto:' . $mailto . '?subject=unsubscribe>' : '') . $eol;
        $headers .= 'List-Unsubscribe-Post: List-Unsubscribe=One-Click' . $eol;
    }

    $headers .= 'MIME-Version: 1.0' . $eol;

    // Текстовая версия — грубый фолбэк из HTML.
    $plain = trim(preg_replace('/\s+/u', ' ', html_entity_decode(
        strip_tags(preg_replace('/<(br|\/p|\/div|\/tr|\/h[1-6])>/i', "\n", $html)),
        ENT_QUOTES, 'UTF-8')));

    // Нормализуем вложения к списку существующих читаемых файлов.
    $attList = is_array($attach) ? $attach : ($attach !== '' ? [$attach] : []);
    $attList = array_values(array_filter($attList, fn($p) => is_string($p) && $p !== '' && is_file($p) && is_readable($p)));

    if ($attList) {
        $altBoundary = 'alt_' . bin2hex(random_bytes(8));
        $headers .= 'Content-Type: multipart/mixed; boundary="' . $boundary . '"' . $eol;

        $body  = '--' . $boundary . $eol;
        $body .= 'Content-Type: multipart/alternative; boundary="' . $altBoundary . '"' . $eol . $eol;
        $body .= mail_mime_part($altBoundary, 'text/plain; charset=UTF-8', $plain);
        $body .= mail_mime_part($altBoundary, 'text/html; charset=UTF-8', $html);
        $body .= '--' . $altBoundary . '--' . $eol . $eol;

        foreach ($attList as $ap) {
            $data = (string) @file_get_contents($ap);
            $fname = mail_encode_header(basename($ap));
            $mime  = function_exists('finfo_open')
                ? (finfo_file(finfo_open(FILEINFO_MIME_TYPE), $ap) ?: 'application/octet-stream')
                : 'application/octet-stream';
            $body .= '--' . $boundary . $eol;
            $body .= 'Content-Type: ' . $mime . '; name="' . $fname . '"' . $eol;
            $body .= 'Content-Transfer-Encoding: base64' . $eol;
            $body .= 'Content-Disposition: attachment; filename="' . $fname . '"' . $eol . $eol;
            $body .= chunk_split(base64_encode($data)) . $eol;
        }
        $body .= '--' . $boundary . '--' . $eol;
    } else {
        $headers .= 'Content-Type: multipart/alternative; boundary="' . $boundary . '"' . $eol;
        $body  = mail_mime_part($boundary, 'text/plain; charset=UTF-8', $plain);
        $body .= mail_mime_part($boundary, 'text/html; charset=UTF-8', $html);
        $body .= '--' . $boundary . '--' . $eol;
    }

    return $headers . $eol . $body;
}

/** Одна MIME-часть (base64). */
function mail_mime_part(string $boundary, string $ctype, string $content): string {
    $eol = "\r\n";
    return '--' . $boundary . $eol
        . 'Content-Type: ' . $ctype . $eol
        . 'Content-Transfer-Encoding: base64' . $eol . $eol
        . chunk_split(base64_encode($content)) . $eol;
}

/**
 * Отправка письма через Gmail SMTP (cURL, smtps://…:465).
 * @param array $opt ['attach'=>путь, 'reply_to'=>адрес, 'from_name'=>имя]
 */
/**
 * Пул почтовых аккаунтов для МАССОВЫХ рассылок (round-robin).
 * Читается из cfgv('smtp_bulk_accounts') — JSON-массив объектов:
 *   [{"host":"smtp.gmail.com","port":465,"user":"...","pass":"...","from_name":"..."}, ...]
 * Если пул пуст — вернётся пустой массив, и рассылка пойдёт с основной почты.
 * Так транзакционные письма (подтверждения/результаты) не зависят от репутации
 * рассыльных ящиков, а массовая рассылка размазывается по нескольким аккаунтам.
 *
 * @return array<int,array{host:string,port:int,user:string,pass:string,from_name:string}>
 */
function mail_bulk_accounts(): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = [];
    $raw = trim((string) cfgv('smtp_bulk_accounts', ''));
    if ($raw !== '') {
        $j = json_decode($raw, true);
        if (is_array($j)) {
            foreach ($j as $a) {
                if (!is_array($a) || empty($a['user']) || empty($a['pass'])) continue;
                $cache[] = [
                    'host'      => (string) ($a['host'] ?? 'smtp.gmail.com'),
                    'port'      => (int) ($a['port'] ?? 465),
                    'user'      => (string) $a['user'],
                    'pass'      => (string) $a['pass'],
                    'from_addr' => (string) ($a['from_addr'] ?? $a['user']),
                    'from_name' => (string) ($a['from_name'] ?? cfgv('mail_from_name', 'Культурного центра «Музыкальный Мир»')),
                ];
            }
        }
    }
    return $cache;
}

/**
 * Именованные почтовые отправители (маршрутизация по категориям писем).
 * Читается из cfgv('smtp_senders') — JSON-объект {ключ: {host,port,user,pass,from_addr,from_name}}.
 * Ключи: 'nagradi' (награды/дипломы), 'news' (массовые рассылки).
 * Официальная Gmail-почта — это отправитель по умолчанию (пустой аккаунт).
 */
function mail_senders(): array {
    static $cache = null;
    if ($cache !== null) return $cache;
    $cache = [];
    $raw = trim((string) cfgv('smtp_senders', ''));
    if ($raw !== '') {
        $j = json_decode($raw, true);
        if (is_array($j)) {
            foreach ($j as $key => $a) {
                if (!is_array($a) || empty($a['user']) || empty($a['pass'])) continue;
                $cache[(string) $key] = [
                    'host'      => (string) ($a['host'] ?? 'smtp.yandex.ru'),
                    'port'      => (int) ($a['port'] ?? 465),
                    'user'      => (string) $a['user'],
                    'pass'      => (string) $a['pass'],
                    'from_addr' => (string) ($a['from_addr'] ?? $a['user']),
                    'from_name' => (string) ($a['from_name'] ?? cfgv('mail_from_name', 'Культурный центр «Музыкальный Мир»')),
                    // Почта центра живёт не только на Яндексе: исторический
                    // публичный адрес на mail.ru читают ведомства и учреждения.
                    // У такого ящика свой IMAP-хост и он ТОЛЬКО ДЛЯ ЧТЕНИЯ —
                    // отправлять с него мы ничего не собираемся.
                    'imap_host' => (string) ($a['imap_host'] ?? ''),
                    'imap_port' => (int) ($a['imap_port'] ?? 0),
                    'read_only' => !empty($a['read_only']),
                ];
            }
        }
    }
    return $cache;
}

/**
 * Выбор аккаунта-отправителя по письму очереди (категория):
 *   массовые (priority>0)          → 'news'  (рассылки);
 *   награды/дипломы (по теме)       → 'nagradi';
 *   всё остальное (заявки/результаты)→ [] (официальная Gmail по умолчанию).
 * Мягкие фолбэки, если нужный отправитель не настроен.
 */
function mail_route_account(array $row): array {
    // Первый ящик — согласно пулу письма (массовые/награды/личные).
    $pool = mail_pool_for($row);
    $chain = mail_fallback_accounts([], $pool);
    return $chain[0] ?? [];
}

/**
 * Причина последней неудачной отправки — чтобы админка могла показать её человеку,
 * а не молча «письмо не ушло». Читается через mail_last_error().
 */
function mail_last_error(?string $set = null): string {
    static $err = '';
    if ($set !== null) $err = $set;
    return $err;
}

/**
 * РАЗДЕЛЕНИЕ ПОЧТОВЫХ ПУЛОВ (правило владельца, август 2026).
 *
 *   bulk   — МАССОВЫЕ рассылки (запуск конкурсов, ВИП-клуб, личный кабинет).
 *            Только news@ и novosti@музыкальный-мир.рф — рассылочные ящики.
 *            В контактах они не публикуются: людям для связи даём
 *            kulturniy.centr.mir@gmail.com и nagradi.on@музыкальный-мир.рф.
 *            С официальной почты центра и наградного ящика массовые не уходят
 *            никогда: их репутация нужна письмам, которые обязаны доходить.
 *   awards — наградные документы и заказы: сначала наградный ящик, далее любые
 *            рабочие почты центра — эти письма не должны вставать ни при каких условиях.
 *   tx     — остальное личное (регистрация, результаты, оплаты, уведомления):
 *            официальная почта центра, далее любые рабочие ящики.
 */
function mail_pool_names(string $pool): array {
    // Рассылочные ящики НЕ участвуют в личных письмах и наградах: их адреса
    // не публикуются в контактах, и человек не должен получать диплом или счёт
    // с ящика, на который потом некуда ответить.
    //
    // Холодные письма в учреждения вынесены на отдельные ящики намеренно. По
    // незнакомому адресу всегда прилетают жалобы — и пусть они прилетают туда,
    // где нечего терять. Ящики, которыми мы пишем своим участникам, от этого
    // отгорожены: их доставляемость нужна дипломам и результатам.
    // Массовые идут только через Unisender. Свои ящики Яндекс забанил за спам
    // после первой же большой рассылки (554 «Message rejected under suspicion of
    // SPAM»), и держать их в резерве бессмысленно: каждая попытка — гарантированный
    // отказ и мусор в журнале. Если сервис однажды встанет, письма просто дождутся
    // его в очереди — это лучше, чем биться в закрытую дверь.
    // ВЕДОМСТВАМ — ТОЛЬКО С РОССИЙСКОГО ДОМЕНА, БЕЗ ЗАПАСНОГО ВАРИАНТА.
    //
    // 12.08.2026 обращения ушли с Gmail и их отбили: «Ваше сообщение заблокировано
    // в связи с ограничением сообщений, отправляемых через почтовую службу Gmail,
    // Proton, Onionmail, Megamail, Hotmail, Courvix» (Представление СУ МВД России
    // по Республике Саха), «принимаем письма только с доменов .RU и .SU» (Курск),
    // «отправлено с зарубежного почтового сервиса» (Томск).
    //
    // Поэтому у официальных обращений резерва НЕТ: упасть обратно на Gmail — значит
    // снова отправить письмо, которое не дойдёт, и сжечь исходящий номер. Если
    // kc@ недоступен, письмо ждёт в очереди.
    // ВРЕМЕННО: письма сайта уходят с Gmail центра.
    //
    // Яндекс закрыл ящику kc@ отправку наружу после того, как через него ошибочно
    // прошла партия массовых писем. Пока ограничение не снято, подтверждения
    // заявок, пароли от кабинетов и результаты идут с kulturniy.centr.mir@gmail.com
    // — это распоряжение владельца и мера на время разбирательства. Обратно
    // возвращается одной настройкой: mail_tx_via_gmail = 0.
    $gmailFirst = function_exists('setting')
        && (string) setting('mail_tx_via_gmail', '0') === '1'
        && !empty(mail_account_by_name('main'));

    return match ($pool) {
        'bulk'     => ['unisender'],                       // рассылки своей базе
        'cold'     => ['unisender-cold'],                  // первое письмо в школу/сад/ДК
        // ЗАПАСНОЙ ПУТЬ ДЛЯ ЛИЧНЫХ ПИСЕМ — ТОТ ЖЕ АДРЕС, ДРУГОЙ ТРАНСПОРТ.
        //
        // 17 августа Яндекс закрыл kc@ отправку на внешние адреса: 554 на каждое
        // письмо, внутри домена при этом всё ходит. За двое суток так не ушло 232
        // письма — пароли от личных кабинетов, подтверждения оплат, результаты,
        // благодарности ведомствам. Для участника это выглядит как «подал заявку и
        // тишина», и никакая рассылка этого не компенсирует.
        //
        // Поэтому у личных писем есть последний рубеж: 'unisender-kc' — тот же
        // обратный адрес kc@музыкальный-мир.рф, но через сервис, а не через SMTP
        // Яндекса. Получатель видит ту же почту центра. Это НЕ рассылка: сюда
        // попадают только письма с приоритетом 0, поштучно, и только когда
        // собственный ящик отказал (пул перебирается по порядку).
        'awards'   => $gmailFirst ? ['nagradi', 'main', 'kc'] : ['nagradi', 'kc', 'unisender-kc'],
        // Обращения в ведомства — ТОЛЬКО с российского домена. Gmail сюда не
        // ставим ни при каких условиях: 12.08.2026 ведомства отбили письма с
        // формулировками «принимаем письма только с доменов .RU и .SU» и
        // «отправлено с зарубежного почтового сервиса».
        /* СНАЧАЛА СЕРВИС, ПОТОМ СВОЙ ЯЩИК. Обращения уходят разом по всей базе
           ведомств (200+ писем за час), и такой залп с обычного почтового ящика —
           ровно то, за что 17.08 закрыли kc@ наружу. Сервис рассылок держит объём
           штатно, а обратный адрес остаётся тем же российским kc@, которого
           требуют ведомства. Свой ящик остаётся запасным. */
        'official' => ['unisender-kc', 'kc'],
        // Разовая новость на широкий круг — это рассылка, и уходит она с
        // рассылочного ящика своей базы. Раньше здесь стоял unisender-kc, то есть
        // обратный адрес kc@: широкая рассылка от имени рабочего ящика центра,
        // ровно то, что запрещено правилом владельца.
        'news'     => ['unisender'],
        // Личное письмо не уходит с наградного ящика: у наград свой пул и свой
        // обратный адрес, а смешение адресов путает получателя и тратит
        // репутацию наградной почты на переписку.
        default    => $gmailFirst ? ['main', 'kc', 'unisender-kc'] : ['kc', 'unisender-kc'],
    };
}

/**
 * КУДА ДОЛЖЕН ПРИЙТИ ОТВЕТ НА ПИСЬМО (правило владельца, август 2026).
 *
 *   партнёрка и учреждения — novosti@
 *   своя база участников   — news@
 *   ведомства и министерства — kc@
 *   награды и заказы       — nagradi.on@
 *
 * Раньше обратный адрес был один на всё (mail_reply_to = kc@), а массовые письма
 * через Unisender не имели его вовсе: ответ уходил на адрес отправителя, и никто
 * не знал, в каком ящике его искать. Отсюда и ощущение, что на шесть тысяч писем
 * нет ни одного ответа. Теперь ящик ответа задаётся типом письма и совпадает с
 * тем, что мы пишем в самом тексте письма (letter_texts: ol_box_email).
 */
/**
 * АДРЕС ДЛЯ ЗАГОЛОВКА ПИСЬМА — ДОМЕН ТОЛЬКО ЛАТИНИЦЕЙ.
 *
 * Наш домен кириллический, и в тексте письма он так и должен выглядеть. Но в
 * заголовках (From, Reply-To) кириллица недопустима: почтовые программы кладут
 * туда сырые байты, и адрес превращается в мусор — в проверочном письме вместо
 * kc@музыкальный-мир.рф стояло <"8@."@D>. Ответить на такое письмо нельзя, а
 * спам-фильтр видит битый заголовок. Поэтому в заголовки домен идёт в punycode.
 */
function mail_addr_ascii(string $email): string {
    $email = trim($email);
    $at = mb_strrpos($email, '@');
    if ($at === false) return $email;
    $box = mb_substr($email, 0, $at);
    $dom = mb_substr($email, $at + 1);
    if (preg_match('~^[\x20-\x7E]+$~', $dom)) return $email;   // уже латиница
    if (function_exists('idn_to_ascii')) {
        $a = idn_to_ascii($dom, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
        if (is_string($a) && $a !== '') return $box . '@' . $a;
    }
    // Запасной вариант для сервера без расширения intl: наш единственный домен.
    if ($dom === 'музыкальный-мир.рф') return $box . '@xn----7sbugdeiegh1b0a9hen.xn--p1ai';
    return $email;
}

function mail_reply_box(string $pool): string {
    $dom = 'музыкальный-мир.рф';
    $box = match ($pool) {
        'cold'     => 'novosti',     // первое письмо в школу, сад, ДК — партнёрка
        'bulk'     => 'news',        // рассылка своей базе
        'official' => 'kc',          // обращения в ведомства
        'awards'   => 'nagradi.on',  // наградные документы и заказы
        default    => 'kc',          // личные письма центра
    };
    return mail_addr_ascii($box . '@' . $dom);
}

/** Ящик по имени из smtp_senders ('main' — основной из config). */
function mail_account_by_name(string $name): array {
    // Unisender — не почтовый ящик, а сервис рассылок: письма уходят по HTTP API
    // с его серверов, от нашего адреса и с нашей подписью DKIM. Для остального
    // кода он выглядит обычным отправителем, поэтому и живёт в общем списке.
    // Именно он вытянул массовые рассылки, когда Яндекс забанил news@ и novosti@
    // за спам: репутация наших ящиков на его доставку не влияет.
    // Сервис рассылок заводится ДВАЖДЫ, под разными обратными адресами.
    //
    //   unisender      — своя база: люди сами подписались, и отвечают они на
    //                    рассылочный адрес центра;
    //   unisender-cold — холодный охват учреждений (семьдесят тысяч адресов).
    //                    По незнакомому адресу всегда прилетают жалобы, и пусть
    //                    они прилетают на отдельный ящик. Репутация адреса,
    //                    которым мы пишем своим участникам, от этого отгорожена.
    //
    // Канал у них общий — другого для массовых нет: Яндекс забанил наши ящики
    // после первой же большой рассылки. Разделён именно ОБРАТНЫЙ АДРЕС, и
    // разделены суточные нормы: поле user у них разное, а по нему считается темп.
    //   unisender-kc   — разовые новости и уведомления сайта от официального ящика.
    //                    Когда адресатов больше двух сотен, рассылать с личного SMTP
    //                    нельзя: это уже рассылка, ей положены сервис, отписка и
    //                    учёт жалоб. Домен музыкальный-мир.рф в сервисе подтверждён,
    //                    DKIM активен, поэтому письмо идёт от нашего адреса.
    if ($name === 'unisender' || $name === 'unisender-cold' || $name === 'unisender-kc') {
        $cold = $name === 'unisender-cold';
        $key = trim((string) cfgv('unisender_api_key', ''));
        if ($key === '') return [];
        if ($name === 'unisender-kc') {
            return [
                'transport' => 'unisender',
                'host'      => 'go2.unisender.ru',
                'port'      => 443,
                'user'      => $name,
                'pass'      => $key,
                'from_addr' => 'kc@музыкальный-мир.рф',
                'from_name' => (string) cfgv('mail_from_name', 'Культурный центр «Музыкальный Мир»'),
            ];
        }
        $from = trim((string) cfgv($cold ? 'unisender_from_cold' : 'unisender_from', ''));
        // Отдельного адреса для холодной базы может ещё не быть — тогда честнее
        // не слать вовсе, чем подставить рассылочный адрес своей базы.
        if ($from === '') return [];
        // user здесь — не почтовый логин, а опознавательный знак отправителя: по нему
        // считаются дневная норма и темп. Он НАМЕРЕННО не равен адресу «от кого»:
        // иначе сервис слился бы с одноимённым SMTP-ящиком, они дедуплицируются по
        // этому полю, и норма сервиса досталась бы забаненному ящику.
        return [
            'transport'  => 'unisender',
            'host'       => 'go2.unisender.ru',
            'port'       => 443,
            'user'       => $name,
            'pass'       => $key,
            'from_addr'  => $from,
            'from_name'  => (string) cfgv($cold ? 'mail_from_name_cold' : 'mail_from_name',
                                          'Культурный центр «Музыкальный Мир»'),
        ];
    }
    if ($name === 'main') {
        $u = (string) cfgv('smtp_user', ''); $p = (string) cfgv('smtp_pass', '');
        if ($u === '' || $p === '') return [];
        return [
            'host' => (string) cfgv('smtp_host', 'smtp.gmail.com'),
            'port' => (int) cfgv('smtp_port', 465),
            'user' => $u, 'pass' => $p, 'from_addr' => $u,
            'from_name' => (string) cfgv('mail_from_name', 'Культурный центр «Музыкальный Мир»'),
        ];
    }
    $s = mail_senders();
    return is_array($s[$name] ?? null) ? $s[$name] : [];
}

/**
 * Пул письма по его типу: массовые (priority>0) — bulk, письма о наградах — awards,
 * остальные — tx.
 */
function mail_pool_for(array $row): string {
    // Холодный охват учреждений помечается типом кампании при постановке в очередь.
    // 'inst' — тот же холодный охват; тип появился позже, когда письмам
    // учреждениям понадобилась отдельная суточная доля, и он ОБЯЗАН попадать в
    // тот же пул: иначе семьдесят тысяч холодных писем пошли бы с обратного
    // адреса, которым мы пишем своим участникам, и жалобы прилетели бы туда же.
    $ct = (string) ($row['campaign_type'] ?? '');
    if ($ct === 'cold' || $ct === 'inst') return 'cold';
    // Официальные обращения в ведомства идут ТОЛЬКО с официальной почты центра на
    // российском домене — у них свой пул без запасного Gmail, см. mail_pool_names().
    if ($ct === 'official') return 'official';
    // Разовая новость или уведомление сайта на широкий круг: от официального ящика,
    // но через сервис рассылок — с отпиской и учётом жалоб, как положено рассылке.
    if ($ct === 'news') return 'news';
    if ((int) ($row['priority'] ?? 0) > 0) return 'bulk';
    $subj = mb_strtolower((string) ($row['subject'] ?? ''));
    foreach (['диплом', 'наград', 'кубок', 'статуэт', 'медал', 'благодарн'] as $w) {
        if (mb_strpos($subj, $w) !== false) return 'awards';
    }
    return 'tx';
}

/**
 * Цепочка ящиков для письма с учётом пула и карантина.
 * Массовое письмо никогда не выходит за пределы своего пула — даже если все его
 * ящики отказали: письмо останется в очереди до восстановления канала.
 */
function mail_fallback_accounts(array $primary = [], string $pool = 'tx'): array {
    $out = [];
    $key = fn(array $a) => mb_strtolower((string) ($a['user'] ?? ''));

    foreach (mail_pool_names($pool) as $name) {
        $a = mail_account_by_name($name);
        if ($a && !empty($a['user'])) $out[$key($a)] = $a;
    }
    // Явно переданный ящик — первым, но только если он разрешён для этого пула.
    if (!empty($primary['user']) && isset($out[$key($primary)])) {
        $out = [$key($primary) => $primary] + $out;
    }
    // Ящики в карантине уходят в конец: не тратим на них время каждого письма.
    uasort($out, fn(array $a, array $b) => mail_account_penalty($a) <=> mail_account_penalty($b));
    return array_values($out);
}

/**
 * Карантин почтового ящика.
 *
 * Если ящик подряд отказывает (например, почтовик режет домен как спам), держать его
 * первым в очереди бессмысленно: каждое письмо теряет секунды на заведомо неудачные
 * попытки. Ящик с 3+ отказами подряд уходит в конец очереди на час; первый успешный
 * ответ обнуляет счётчик, и ящик снова становится основным.
 */
function mail_account_fail(string $user): void {
    $user = mb_strtolower(trim($user));
    if ($user === '' || !function_exists('set_setting')) return;
    $k = 'mailfail:' . $user;
    $n = (int) setting($k, '0') + 1;
    set_setting($k, (string) $n);
    set_setting('mailfail_at:' . $user, date('Y-m-d H:i:s'));
}

/** Сбрасывает счётчик отказов — ящик снова здоров. */
function mail_account_ok(string $user): void {
    $user = mb_strtolower(trim($user));
    if ($user === '' || !function_exists('set_setting')) return;
    if ((int) setting('mailfail:' . $user, '0') > 0) set_setting('mailfail:' . $user, '0');
}

/** Штраф ящика для сортировки: 0 — здоров, 1 — в карантине. */
function mail_account_penalty(array $acc): int {
    $user = mb_strtolower((string) ($acc['user'] ?? ''));
    if ($user === '' || !function_exists('setting')) return 0;
    if ((int) setting('mailfail:' . $user, '0') < 3) return 0;
    // Карантин действует час с момента последнего отказа.
    $at = strtotime((string) setting('mailfail_at:' . $user, '')) ?: 0;
    return (time() - $at) < 3600 ? 1 : 0;
}

/**
 * Отправка с АВТОЗАМЕНОЙ ящика: перебирает доступные почты, пока письмо не уйдёт.
 * Если сработал не первый ящик — пишет об этом в лог и в mail_switched(), чтобы
 * админка показала «отправлено с резервной почты», а не молчала.
 * Возвращает true, если письмо ушло хоть с какого-то ящика.
 */
/**
 * АДРЕС В СТОП-ЛИСТЕ?
 *
 * Стоп-лист (таблица mail_stop) собирается чисткой базы: несуществующие ящики,
 * отказы, жалобы на спам. Одной чистки мало — сбор учреждений идёт постоянно и
 * вернул бы те же адреса обратно через неделю. Поэтому проверка стоит здесь, в
 * точке отправки: что бы ни попало в очередь, письмо в мёртвый ящик не уйдёт.
 *
 * Ответ кэшируется на прогон: очередь идёт пачками, и спрашивать базу на каждое
 * письмо ни к чему.
 */
function mail_is_stopped(string $email): bool {
    static $cache = [];
    static $has = null;
    static $own = null;
    $e = mb_strtolower(trim($email));
    if ($e === '') return false;

    // СВОИ ЯЩИКИ НЕ БЛОКИРУЕМ НИКОГДА. Один такой адрес уже попал в стоп-лист по
    // старой метке «отказ», оставшейся от давней проверки, и центр перестал
    // получать собственные письма: и проверочные, и копии наградных. Ошибка в
    // метке не должна отрезать центр от его же почты.
    if ($own === null) {
        $own = [];
        if (!function_exists('inbox_own_emails') && is_file(BASE_PATH . '/core/inbox_reader.php')) {
            require_once BASE_PATH . '/core/inbox_reader.php';
        }
        $list = function_exists('inbox_own_emails') ? inbox_own_emails() : [];
        foreach (array_merge($list, [(string) cfgv('org_email', '')]) as $o) {
            $o = mb_strtolower(trim((string) $o));
            if ($o === '') continue;
            $own[$o] = true;
            $own[mb_strtolower(mail_addr_ascii($o))] = true;
        }
    }
    if (isset($own[$e])) return false;
    if ($has === null) {
        try { $has = (bool) one("SELECT name FROM sqlite_master WHERE type='table' AND name='mail_stop'"); }
        catch (\Throwable $ex) { $has = false; }
    }
    if (!$has) return false;
    if (isset($cache[$e])) return $cache[$e];
    try { $cache[$e] = (bool) one("SELECT email FROM mail_stop WHERE email=?", [$e]); }
    catch (\Throwable $ex) { $cache[$e] = false; }
    return $cache[$e];
}

/**
 * ПОЧЕМУ АДРЕС В СТОП-ЛИСТЕ: 'dead' (ящика нет), 'optout' (человек не хочет
 * рассылку) или '' (адреса в списке нет).
 *
 * Разница решает судьбу наградного письма. Отказ от рассылки — это про рекламу
 * конкурсов, а не про диплом, который человек оплатил и ждёт: 19 августа
 * участница, оплатившая два конкурса, попала в стоп-лист по ошибке разбора
 * почты, и вместе с рассылкой ей перестали уходить наградные материалы и
 * результаты. Несуществующий ящик — другое дело: туда бессмысленно слать что
 * угодно, почтовик всё равно отобьёт.
 */
function mail_stop_kind(string $email): string {
    static $cache = [];
    $e = mb_strtolower(trim($email));
    if ($e === '' || !mail_is_stopped($e)) return '';
    if (isset($cache[$e])) return $cache[$e];

    $r = '';
    try { $r = (string) (scalar("SELECT reason FROM mail_stop WHERE email=?", [$e]) ?? ''); }
    catch (\Throwable $ex) { $r = ''; }
    $r = mb_strtolower($r);

    foreach (['отказался от рассылки', 'отписал', 'пожаловал', 'жалоба',
              'unsubscrib', 'complain'] as $w) {
        if (mb_strpos($r, $w) !== false) return $cache[$e] = 'optout';
    }
    return $cache[$e] = 'dead';
}

function mail_send_failover(string $to, string $subject, string $html, array $opt = []): bool {
    // На адреса зоны .test письма не отправляем НИКОГДА: она не маршрутизируется,
    // и каждая попытка вернулась бы отказом, а отказы бьют по репутации домена и
    // по доставке дипломов. Такие адреса бывают только у сквозных проверок.
    if (preg_match('~\.test$~i', trim($to))) {
        mail_log('SKIP .test ' . $to . ' | ' . mb_substr($subject, 0, 60));
        return true;
    }
    // Пул определяется типом письма: массовые — только рассылочные ящики,
    // награды и личные письма — рабочие почты центра.
    $pool = (string) ($opt['pool'] ?? mail_pool_for(['priority' => $opt['priority'] ?? 0, 'subject' => $subject]));

    // ОТКАЗ ОТ РАССЫЛКИ НЕ ОТМЕНЯЕТ ДИПЛОМ.
    //
    // Стоп-лист собран из двух разных вещей. «Ящика не существует» — стена: туда
    // не уйдёт ничего и никогда. «Отписался», «пожаловался» — решение человека
    // про РАССЫЛКУ, и оно не отменяет наградной материал, результат конкурса и
    // код входа в кабинет: это письма, которых он сам ждёт и за которые заплатил.
    // Пока разницы не было, одна ошибка разбора почты отрезала участницу от её
    // собственных дипломов, и ни одна кнопка «отправить» не помогала.
    $stop = mail_stop_kind($to);
    $mass = (int) ($opt['priority'] ?? 0) > 0 || in_array($pool, ['bulk', 'cold', 'news'], true);
    if ($stop !== '' && $mass) {
        mail_log('SKIP стоп-лист (' . $stop . ') ' . $to . ' | ' . mb_substr($subject, 0, 60));
        mail_last_error($stop === 'dead'
            ? 'адрес в стоп-листе: ящика не существует'
            : 'человек отказался от рассылки — массовые письма ему не отправляются');
        return false;
    }
    if ($stop !== '') {
        // Стоп-лист закрывает РАССЫЛКУ, а не переписку. Правило владельца:
        // уведомления сайта, результаты, наградные материалы и дожимы уходят даже
        // тому, кто отписался или чей ящик однажды отбил письмо. Отказ мог быть
        // разовым, а диплом человек оплатил и ждёт; отправку рассудит почтовик.
        mail_log('стоп-лист (' . $stop . ') не мешает личному письму — ' . $to
                 . ' | ' . mb_substr($subject, 0, 60));
    }
    $accounts = mail_fallback_accounts(is_array($opt['account'] ?? null) ? $opt['account'] : [], $pool);

    // МАССОВОЕ ПИСЬМО НИКОГДА НЕ УХОДИТ С РАБОЧИХ ЯЩИКОВ ЦЕНТРА.
    //
    // Правило владельца, и оно не обсуждается: kc@ — заявки, результаты, письма
    // сайта и переписка с ведомствами; nagradi.on@ — наградные материалы. Обе
    // почты обязаны доходить всегда, и рассылка их репутацию тратить не должна.
    // Для массовых есть свои два ящика: news@ (своя база) и novosti@ (учреждения).
    //
    // Проверка стоит здесь, в единственной точке, через которую проходит любая
    // отправка: пул можно задать ошибочно, аккаунт передать руками, тип кампании
    // перепутать — а сюда всё равно придут все. Если после отсева ящиков не
    // осталось, письмо ждёт в очереди: это лучше, чем уйти не с той почты.
    if ((int) ($opt['priority'] ?? 0) > 0) {
        $before = count($accounts);
        $accounts = array_values(array_filter($accounts, static function (array $a): bool {
            $u = mb_strtolower((string) ($a['user'] ?? ''));
            return !str_starts_with($u, 'kc@') && !str_starts_with($u, 'nagradi')
                && $u !== 'unisender-kc';
        }));
        if (count($accounts) < $before) {
            mail_log('массовое письмо: рабочие ящики центра (kc@, nagradi@) исключены из отправки');
        }
    }

    // ВОЛНА ОБРАЩЕНИЙ В ВЕДОМСТВА ИДЁТ ТОЛЬКО ЧЕРЕЗ СЕРВИС РАССЫЛОК.
    //
    // Двести с лишним обращений за час — по объёму это рассылка, хотя каждое
    // письмо именное и приоритет у него нулевой (потому старший замок на массовые
    // их и не поймал). Уходят они все с одного ящика kc@, у которого нет запасного:
    // 17 августа его закрыли наружу ровно за такой всплеск, и центр двое суток
    // остался без подтверждений заявок и паролей от кабинетов.
    //
    // 01.09 сервис отбил письмо из-за одинаковых имён вложений — и failover
    // спокойно увёл волну на прямой SMTP kc@. Такого пути быть не должно: если
    // сервис не принял письмо, оно ждёт в очереди и чинится, а не уходит с
    // рабочей почты центра. Личная переписка с ведомством сюда не попадает — у
    // неё нет типа кампании.
    if ((string) ($opt['campaign_type'] ?? '') === 'official') {
        $before = count($accounts);
        $accounts = array_values(array_filter($accounts, static fn(array $a): bool
            => (string) ($a['transport'] ?? '') !== ''));
        if (count($accounts) < $before) {
            mail_log('волна обращений в ведомства: прямые ящики центра исключены, только сервис рассылок');
        }
    }

    if (!$accounts) {
        mail_last_error('Для этого типа писем не настроен ни один почтовый ящик (пул «' . $pool . '»).');
        mail_log('POOL EMPTY (' . $pool . ') для ' . $to);
        return false;
    }
    // Обратный адрес — по типу письма, а не один на всё. Если вызывающий код
    // задал его явно (например, персональный ответ), не перебиваем.
    if (trim((string) ($opt['reply_to'] ?? '')) === '') $opt['reply_to'] = mail_reply_box($pool);

    // КНОПКА «ОТПИСАТЬСЯ» ОБЯЗАНА БЫТЬ В КАЖДОМ МАССОВОМ ПИСЬМЕ.
    //
    // Заголовок отписки ставился только там, где вызывающий код не забыл передать
    // ссылку. А почта показывает штатную кнопку рядом с адресом отправителя лишь
    // при наличии заголовка; без неё человек, которому надоела рассылка, жмёт
    // «Спам» — и это бьёт по репутации домена сильнее, чем сама отписка, портя
    // доставку уже и дипломам. Поэтому для массовых пулов ссылку добираем сами.
    //
    // Холодные письма учреждениям сюда НЕ входят намеренно: им ссылку собирает
    // свой код (core/invite_institution.php), и заводить каждое учреждение в
    // таблицу подписчиков нельзя — это разные списки и разный учёт.
    if (in_array($pool, ['bulk', 'news'], true) && trim((string) ($opt['unsubscribe_url'] ?? '')) === '') {
        try {
            if (!function_exists('nl_ensure_subscriber') && is_file(BASE_PATH . '/core/newsletter.php')) {
                require_once BASE_PATH . '/core/newsletter.php';
            }
            // Свои же служебные ящики в список подписчиков не заводим.
            $__own = ['kc', 'news', 'novosti', 'nagradi.on'];
            $__isOwn = false;
            foreach ($__own as $__b) {
                if (stripos($to, $__b . '@') === 0) { $__isOwn = true; break; }
            }
            if (!$__isOwn && function_exists('nl_ensure_subscriber')) {
                [$__tok] = nl_ensure_subscriber($to, (string) ($opt['to_name'] ?? ''), 'mail');
                if ($__tok !== '') {
                    $opt['unsubscribe_url'] = rtrim((string) cfgv('base_url'), '/')
                                            . '/api/v1/unsubscribe?token=' . rawurlencode($__tok);
                }
            }
        } catch (\Throwable $e) { /* без ссылки письмо всё равно уйдёт */ }
    }
    $errors = [];
    foreach ($accounts as $i => $acc) {
        $try = $opt;
        if ($acc) $try['account'] = $acc;
        if ($acc && empty($opt['from_name']) && !empty($acc['from_name'])) $try['from_name'] = $acc['from_name'];
        $ok = false;
        try { $ok = mail_send($to, $subject, $html, $try); } catch (\Throwable $e) { $ok = false; }
        if ($ok) {
            mail_account_ok((string) ($acc['user'] ?? ''));   // ящик здоров
            if ($i > 0) {
                $used = (string) ($acc['user'] ?? 'резервный ящик');
                mail_switched($used);
                mail_log('FAILOVER: письмо для ' . $to . ' ушло с резервной почты ' . $used
                         . ' (предыдущие: ' . implode(' | ', $errors) . ')');
            } else {
                mail_switched('');
            }
            return true;
        }
        // ЧЕЙ ЭТО ОТКАЗ. Если почтовик отверг ПОЛУЧАТЕЛЯ (нет такого ящика,
        // 5.1.x), наш ящик ни при чём: штрафовать его нельзя и перебирать
        // остальные бессмысленно — они получат тот же ответ. Раньше каждый
        // битый адрес из базы накручивал счётчик отказов ВСЕМ ящикам пула,
        // и через полсотни таких адресов оба здоровых ящика уезжали
        // в карантин, а рассылка вставала.
        $lastErr = mail_last_error();
        $recipientFault = function_exists('nl_failure_kind') && nl_failure_kind($lastErr) === 'hard';

        // ОТКАЗ ПО КОНКРЕТНОМУ АДРЕСУ — НЕ ВИНА ЯЩИКА.
        //
        // Сервис рассылок отвечает «отклонил адрес: temporary_unavailable» на один
        // адрес из тысячи. Три таких ответа подряд — и ящик уходил в часовой
        // карантин, а массовая рассылка вставала посреди рабочего окна: 19 августа
        // она встала в 13:11 при открытом окне до 18:00, с обоими ящиками в
        // карантине и тридцатью тысячами писем в очереди. Пул тут ни при чём:
        // следующий ящик получит от сервиса тот же ответ по тому же адресу.
        if (!$recipientFault) {
            foreach (['отклонил адрес', 'failed_emails', 'no valid recipients',
                      'temporary_unavailable', 'permanent_unavailable', 'unreachable',
                      'skip_dup', 'err_spam_skipped'] as $w) {
                if (mb_stripos($lastErr, $w) !== false) { $recipientFault = true; break; }
            }
        }
        if ($recipientFault) {
            mail_log('RCPT REJECT ' . $to . ' - ' . $lastErr . ' (ящик не виноват, перебор прекращён)');
            return false;
        }
        mail_account_fail((string) ($acc['user'] ?? ''));      // наш отказ — ближе к карантину
        $errors[] = (string) ($acc['user'] ?? 'основной') . ': ' . $lastErr;
    }
    mail_last_error('Ни один из ' . count($accounts) . ' ящиков пула «' . $pool . '» не принял письмо. ' . implode(' | ', $errors));
    mail_switched('');
    return false;
}

/** Ящик, которым письмо ушло вместо основного (пусто — замены не было). */
function mail_switched(?string $set = null): string {
    static $acc = '';
    if ($set !== null) $acc = $set;
    return $acc;
}

/**
 * ОТПРАВКА ЧЕРЕЗ UNISENDER GO (HTTP API).
 *
 * Почему не SMTP: хостер сайта режет исходящие 25/465/587 на чужие хосты —
 * с сервера не открывается ни один порт Unisender. Их Web API работает по 443
 * и проходит без вопросов.
 *
 * Зачем вообще сервис: собственный домен на Яндексе отдаёт около сотни писем
 * в сутки и дальше отвечает отказом на всё подряд. Для рассылки по базе из
 * тысяч адресов нужна прогретая инфраструктура.
 *
 * Вложения поддерживаются (base64). Возвращает true, если письмо принято.
 */
function mail_send_unisender(string $to, string $subject, string $html, array $opt = []): bool {
    $key = trim((string) cfgv('unisender_api_key', ''));
    if ($key === '') { mail_last_error('Не задан ключ Unisender Go (unisender_api_key).'); return false; }

    $fromAddr = (string) ($opt['from_addr'] ?? cfgv('unisender_from', ''));
    if ($fromAddr === '') $fromAddr = (string) cfgv('smtp_user', '');
    $fromName = (string) ($opt['from_name'] ?? cfgv('mail_from_name', 'Культурный центр «Музыкальный Мир»'));

    $msg = [
        'recipients' => [['email' => $to]],
        'body'       => ['html' => $html, 'plaintext' => trim(strip_tags(str_replace(['<br>', '</p>'], "\n", $html)))],
        'subject'    => $subject,
        'from_email' => $fromAddr,
        'from_name'  => $fromName,
    ];

    // ОБРАТНЫЙ АДРЕС В МАССОВЫХ ПИСЬМАХ. Его здесь не было вовсе: человек жал
    // «Ответить», письмо уходило на адрес отправителя, и ответы расползались по
    // ящикам, в которые никто не смотрел. Теперь адрес ответа проставляется явно
    // и совпадает с тем, что назван в тексте письма.
    $replyTo = mail_addr_ascii((string) ($opt['reply_to'] ?? ''));
    if ($replyTo !== '') {
        $msg['reply_to'] = $replyTo;
        $msg['reply_to_name'] = $fromName;
    }

    // ОДНОКЛИКОВАЯ ОТПИСКА В ИНТЕРФЕЙСЕ ПОЧТЫ.
    // Ссылка отписки была только в подвале письма. Gmail и Mail.ru показывают
    // штатную кнопку «Отписаться» рядом с адресом отправителя лишь при наличии
    // этих заголовков; без них человек, которому надоела рассылка, жмёт «Спам» —
    // а это бьёт по репутации домена куда сильнее, чем сама отписка.
    $unsub = trim((string) ($opt['unsubscribe_url'] ?? ''));
    if ($unsub !== '') {
        $mailto = trim((string) cfgv('org_email', ''));
        $msg['headers'] = [
            'List-Unsubscribe' => '<' . $unsub . '>' . ($mailto !== '' ? ', <mailto:' . $mailto . '?subject=unsubscribe>' : ''),
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ];
    }
    // Вложения (дипломы) — файлами в base64.
    if (!empty($opt['attach'])) {
        $files = is_array($opt['attach']) ? $opt['attach'] : [$opt['attach']];
        $att = [];
        // ИМЕНА ВЛОЖЕНИЙ ОБЯЗАНЫ РАЗЛИЧАТЬСЯ.
        // Афиши четырёх конкурсов лежат по своим папкам, но зовутся одинаково —
        // afisha.jpg. Сервис рассылок такое письмо не принимает вовсе:
        // «Error in attachments field. Duplicated filename: afisha.jpg», HTTP 400.
        // Обращения в ведомства 01.09 падали на этой ошибке и уходили ЗАПАСНЫМ
        // путём — прямым SMTP с kc@, то есть массовой волной с ящика, которому
        // массовые запрещены: ровно за это 17 августа Яндекс закрыл его наружу.
        // Второму и следующим файлам с тем же именем добавляем номер.
        $used = [];
        foreach ($files as $f) {
            $f = (string) $f;
            if ($f === '' || !is_file($f)) continue;
            $name = basename($f);
            if (isset($used[mb_strtolower($name)])) {
                $ext  = pathinfo($name, PATHINFO_EXTENSION);
                $stem = pathinfo($name, PATHINFO_FILENAME);
                $n    = 1;
                do { $try = $stem . '-' . (++$n) . ($ext !== '' ? '.' . $ext : ''); }
                while (isset($used[mb_strtolower($try)]));
                $name = $try;
            }
            $used[mb_strtolower($name)] = true;
            $att[] = ['type' => mail_mime_type($f), 'name' => $name, 'content' => base64_encode((string) file_get_contents($f))];
        }
        if ($att) $msg['attachments'] = $att;
    }

    $payload = json_encode(['api_key' => $key, 'message' => $msg], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $url = rtrim((string) cfgv('unisender_api_url', 'https://go2.unisender.ru/ru/transactional/api/v1'), '/') . '/email/send.json';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $raw  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($raw === false) { mail_last_error('Unisender: связь не установлена - ' . $err); mail_log('FAIL(uni) to ' . $to . ' | ' . $err); return false; }
    $d = json_decode((string) $raw, true);

    if ($code >= 400) {
        $why = 'Unisender: HTTP ' . $code . ' ' . mb_substr(trim((string) $raw), 0, 200);
        mail_last_error($why);
        mail_log('FAIL(uni) to ' . $to . ' | ' . $why);
        return false;
    }

    if (is_array($d) && (string) ($d['status'] ?? '') === 'success') {
        // «success» относится к ЗАПРОСУ, а не к письму. Unisender возвращает рядом
        // failed_emails — карту «адрес → причина», и раз получатель здесь ровно один,
        // попадание его в этот список означает, что письмо не ушло вообще. Раньше
        // такие письма отмечались как доставленные: у массового канала не было
        // обратной связи по недоставке ни в каком виде, и мёртвые адреса копились
        // в базе, продолжая тянуть репутацию вниз.
        $failed = (array) ($d['failed_emails'] ?? []);
        $reason = '';
        foreach ($failed as $addr => $r) {
            if (mb_strtolower(trim((string) $addr)) === mb_strtolower(trim($to))) { $reason = (string) $r; break; }
        }
        if ($reason !== '') {
            // Причины в формате, который понимает разбор отказов (nl_failure_kind):
            // invalid / permanent_unavailable / blocked / complained / unsubscribed —
            // жёсткие, адрес выводится из базы; temporary_unavailable — мягкая.
            $why = 'Unisender отклонил адрес: ' . $reason;
            mail_last_error($why);
            mail_log('FAIL(uni) to ' . $to . ' | ' . $why);
            return false;
        }
        mail_log('SENT(uni) to ' . $to . ' | ' . $subject
                 . (!empty($d['job_id']) ? ' | job=' . (string) $d['job_id'] : ''));
        return true;
    }
    $why = is_array($d) ? trim(((string) ($d['code'] ?? '')) . ' ' . (string) ($d['message'] ?? '')) : mb_substr((string) $raw, 0, 200);
    mail_last_error('Unisender: ' . $why);
    mail_log('FAIL(uni) to ' . $to . ' | ' . $why);
    return false;
}

/** MIME-тип файла вложения (для Unisender API). */
function mail_mime_type(string $path): string {
    $ext = mb_strtolower(pathinfo($path, PATHINFO_EXTENSION));
    return [
        'pdf' => 'application/pdf', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png', 'zip' => 'application/zip', 'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ][$ext] ?? 'application/octet-stream';
}

function mail_send(string $to, string $subject, string $html, array $opt = []): bool {
    mail_last_error('');
    // Ящик может быть «виртуальным»: не SMTP, а сервис рассылок. Тогда письмо
    // уходит по HTTP API, а не через почтовый порт.
    $accT = is_array($opt['account'] ?? null) ? $opt['account'] : [];
    if ((string) ($accT['transport'] ?? '') === 'unisender') {
        return mail_send_unisender($to, $subject, $html, [
            'attach'          => $opt['attach'] ?? null,
            'from_addr'       => $accT['from_addr'] ?? null,
            'from_name'       => $opt['from_name'] ?? ($accT['from_name'] ?? null),
            'unsubscribe_url' => $opt['unsubscribe_url'] ?? '',
            'reply_to'        => $opt['reply_to'] ?? '',
        ]);
    }
    $to = mail_addr_ascii(trim($to));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        mail_log('SKIP bad recipient: ' . $to);
        mail_last_error('Некорректный адрес получателя: ' . $to);
        return false;
    }

    // Аккаунт-отправитель: по умолчанию основная (транзакционная) почта.
    // Для МАССОВЫХ рассылок воркер передаёт $opt['account'] из пула smtp_bulk_accounts.
    $acc  = is_array($opt['account'] ?? null) ? $opt['account'] : [];
    $user = (string) ($acc['user'] ?? cfgv('smtp_user'));
    $pass = (string) ($acc['pass'] ?? cfgv('smtp_pass'));
    $host = (string) ($acc['host'] ?? cfgv('smtp_host', 'smtp.gmail.com'));
    $port = (int) ($acc['port'] ?? cfgv('smtp_port', 465));
    if ($user === '' || $pass === '') {
        mail_log('SKIP no SMTP credentials for ' . $to);
        mail_last_error('Не настроены доступы SMTP (MUZMIR_SMTP_USER / MUZMIR_SMTP_PASS) - письма не отправляются.');
        return false;
    }

    $fromName = (string) ($opt['from_name'] ?? $acc['from_name'] ?? cfgv('mail_from_name', 'Культурного центра «Музыкальный Мир»'));
    $replyTo  = mail_addr_ascii((string) ($opt['reply_to'] ?? cfgv('mail_reply_to', '')));
    // Вложения: 'attachments' (массив путей) имеет приоритет, иначе 'attach'.
    // В 'attach' может прийти И строка (одно вложение), И массив: очередь хранит
    // несколько путей строкой JSON и разворачивает её перед отправкой. Раньше
    // массив здесь молча приводился к строке — PHP отдавал «Array», и к письму
    // не прикреплялось НИЧЕГО: официальное обращение уходило без документа,
    // положения, афиши и логотипа, то есть пустым по смыслу.
    if (isset($opt['attachments']) && is_array($opt['attachments'])) {
        $attach = $opt['attachments'];
    } else {
        $a = $opt['attach'] ?? '';
        $attach = is_array($a) ? array_values(array_filter($a, 'is_string')) : (string) $a;
    }
    // Адрес в заголовке From. ВАЖНО: домен обязан быть в PUNYCODE (ASCII).
    // Сырой кириллический адрес (news@музыкальный-мир.рф) RFC-невалиден
    // (нет SMTPUTF8/EAI) и Яндекс метит письмо как СПАМ (554 5.7.1). Поэтому
    // IDN-домен приводим к punycode; красивое кириллическое имя даёт from_name.
    $fromAddr = (string) ($acc['from_addr'] ?? $user);
    if (preg_match('/[^\x20-\x7E]/', $fromAddr)) {           // есть не-ASCII (кириллица)
        if (str_contains($fromAddr, '@') && function_exists('idn_to_ascii')) {
            [$lp, $dom] = explode('@', $fromAddr, 2);
            $asc = @idn_to_ascii($dom, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
            $fromAddr = $asc ? ($lp . '@' . $asc) : $user;
        } else {
            $fromAddr = $user;                                // фолбэк: punycode-логин
        }
    }

    // Envelope-from (SMTP MAIL FROM) тоже обязан быть ASCII: если логин кириллический —
    // приводим домен к punycode, иначе Яндекс/сервер отвергнет (SMTPUTF8 не гарантирован).
    $envelopeFrom = $user;
    if (preg_match('/[^\x20-\x7E]/', $envelopeFrom) && str_contains($envelopeFrom, '@') && function_exists('idn_to_ascii')) {
        [$elp, $edom] = explode('@', $envelopeFrom, 2);
        $easc = @idn_to_ascii($edom, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
        if ($easc) $envelopeFrom = $elp . '@' . $easc;
    }

    $mime = mail_build_mime($fromName, $fromAddr, $to, $replyTo, $subject, $html, $attach,
                            (string) ($opt['unsubscribe_url'] ?? ''));

    // Тело письма читаем cURL'ом из потока в памяти.
    $stream = fopen('php://temp', 'r+');
    fwrite($stream, $mime);
    rewind($stream);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => 'smtps://' . $host . ':' . $port,
        CURLOPT_USE_SSL        => CURLUSESSL_ALL,
        CURLOPT_USERNAME       => $user,
        CURLOPT_PASSWORD       => $pass,
        CURLOPT_MAIL_FROM      => '<' . $envelopeFrom . '>',
        CURLOPT_MAIL_RCPT      => ['<' . $to . '>'],
        CURLOPT_UPLOAD         => true,
        CURLOPT_INFILE         => $stream,
        CURLOPT_INFILESIZE     => strlen($mime),
        CURLOPT_READFUNCTION   => function ($ch, $fd, $len) use ($stream) {
            return fread($stream, $len);
        },
        CURLOPT_TIMEOUT        => 180,   // дипломы с фоном тяжёлые (до ~5 МБ); аплоуд нескольких вложений может быть долгим
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);

    $ok   = curl_exec($ch) !== false;
    $err  = curl_error($ch);
    // КОД ОТВЕТА SMTP-СЕРВЕРА. Без него причина отказа терялась: curl_error()
    // на отвергнутом получателе часто пуст, и в лог шло голое «FAIL to …| »,
    // а разобрать «ящика не существует» и «нас не пускают» было нечем.
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if (is_resource($stream)) fclose($stream);

    $whyFail = '';
    if ($ok) {
        mail_log('SENT to ' . $to . ' | ' . $subject);
    } else {
        $why = trim(($code ? $code . ' ' : '') . $err);
        if ($why === '') $why = 'сервер отклонил письмо без объяснения';
        $whyFail = $why;
        mail_log('FAIL to ' . $to . ' | ' . $subject . ' | ' . $why);
        mail_last_error('SMTP ' . $host . ':' . $port . ' - ' . $why);
    }

    /* ПИСЬМО ОСТАЁТСЯ В ЖУРНАЛЕ.
     *
     * Личное письмо уходит прямой отправкой, минуя очередь, и раньше от него
     * не оставалось ничего, кроме строки в логе. Владелец вводил трек-номер,
     * нажимал «Отправить» — и посмотреть, что получил участник, было негде.
     * Письма из очереди не пишем: их тело и так лежит в mail_queue. */
    if (empty($opt['from_queue'])) {
        if (!function_exists('mail_archive_store') && is_file(BASE_PATH . '/core/mail_archive.php')) {
            require_once BASE_PATH . '/core/mail_archive.php';
        }
        if (function_exists('mail_archive_store')) mail_archive_store($to, $subject, $html, $opt, $ok, $whyFail);
    }
    // Дублируем письмо в приложение как уведомление — но НЕ для писем из очереди
    // (у них уведомление уже создано в mail_queue(), иначе был бы дубль).
    if ($ok && empty($opt['from_queue'])) {
        if (!function_exists('notify_from_email') && is_file(BASE_PATH . '/core/notifications.php')) require_once BASE_PATH . '/core/notifications.php';
        if (function_exists('notify_from_email')) {
            try { notify_from_email($to, $subject, $html, ['url' => (string)($opt['inapp_url'] ?? '/cabinet')]); } catch (\Throwable $e) {}
        }
    }
    return $ok;
}

/** Кладёт письмо в очередь mail_queue (реальная отправка — воркером). */
/**
 * @param string $scheduledAt 'Y-m-d H:i:s' — не отправлять раньше этого времени.
 *        Пусто (обычный случай) — уйдёт ближайшим заходом отправщика. Нужно это
 *        письмам, которые человеку незачем получать среди ночи: отказ по заявке
 *        в час сорок ночи он всё равно прочитает утром, а тревогу вызовет сразу.
 */
function mail_queue(string $to, string $name, string $subject, string $html, string $attach = '', string $scheduledAt = '', bool $inapp = true): int {
    // В очередь мёртвый адрес не кладём вовсе: иначе он копится там неделями и
    // портит и отчёты, и суточную квоту.
    // Отказ от рассылки сюда не относится: в очередь попадают личные письма —
    // результат, наградной материал, код входа. Не кладём только мёртвый ящик.
    // В очередь кладём и адреса из стоп-листа: через неё идут личные письма —
    // результат, наградный материал, код входа. Массовое письмо отсеется в момент
    // отправки (mail_send_failover), а мёртвый адрес отбракует почтовик.
    try {
        $id = insert('mail_queue', [
            'to_email' => trim($to),
            'to_name'  => $name,
            'subject'  => $subject,
            'body'     => $html,
            'attach'   => $attach,
            'status'   => 'queued',
            'scheduled_at' => trim($scheduledAt),
        ]);
        /* Сразу дублируем в приложение как уведомление (письмо уйдёт воркером позже).
         *
         * $inapp = false ставит тот, кто создаёт уведомление сам и лучше знает, куда
         * оно должно вести. Так у итогов конкурса: общее уведомление привело бы в
         * кабинет, а участнику нужна страница заказа наград с его заявкой — и два
         * уведомления об одном событии выглядят как сбой. */
        if ($id && $inapp) {
            if (!function_exists('notify_from_email') && is_file(BASE_PATH . '/core/notifications.php')) require_once BASE_PATH . '/core/notifications.php';
            if (function_exists('notify_from_email')) { try { notify_from_email($to, $subject, $html); } catch (\Throwable $e) {} }
        }
        return $id;
    } catch (\Throwable $e) {
        mail_log('QUEUE FAIL ' . $to . ' | ' . $e->getMessage());
        return 0;
    }
}

/**
 * Рендер фрагмента templates/emails/$name.php в скоупе $vars и обёртка
 * в премиум HTML-лейаут письма (тёплая палитра, логотип, подвал, unsubscribe).
 */
function mail_template(string $name, array $vars = []): string {
    $file = BASE_PATH . '/templates/emails/' . preg_replace('/[^a-z0-9_]/', '', $name) . '.php';
    $inner = '';
    if (is_file($file)) {
        extract($vars, EXTR_SKIP);
        ob_start();
        include $file;
        $inner = (string) ob_get_clean();
    } else {
        mail_log('TEMPLATE MISSING: ' . $name);
        $inner = '<p style="margin:0">' . h((string)($vars['message'] ?? '')) . '</p>';
    }

    // Богатый транзакционный лейаут (hero + вторичные кнопки + промо + соцсети),
    // если вызывающий передал $vars['_tx'] (участнику-адресованные письма).
    if (isset($vars['_tx']) && is_array($vars['_tx'])) {
        $tx = $vars['_tx'];
        if (!isset($tx['preheader'])) $tx['preheader'] = (string) ($vars['preheader'] ?? '');
        return mm_email_tx($inner, $tx);
    }

    return mm_email_layout($inner, [
        'preheader'       => (string) ($vars['preheader'] ?? ''),
        'unsubscribe_url' => (string) ($vars['unsubscribe_url'] ?? ''),
    ]);
}
