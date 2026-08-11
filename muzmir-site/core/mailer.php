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
    $vkUrl  = h((string) cfgv('org_vk', 'https://vk.com/muzmir_kc'));
    $maxUrl = h((string) cfgv('org_max', 'https://max.ru/join/v4SJluLzTAMWm4r5ldJ-JyA2rS5InmPYjaP6drn3F8I'));
    $social = '<div style="margin-top:18px;">'
        . '<div style="font-size:12px;color:' . $muted . ';margin-bottom:8px;">Подпишитесь на наши каналы — анонсы конкурсов, результаты и полезное:</div>'
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
    $cells = '';
    foreach ($buttons as $b) {
        $label = (string) ($b[0] ?? ''); $url = (string) ($b[1] ?? '');
        if ($label === '' || $url === '') continue;
        $cells .= '<td style="padding:5px;"><a href="' . h($url) . '" style="display:block;text-align:center;padding:11px 10px;border:1.5px solid ' . MM_LINE . ';border-radius:11px;color:' . MM_NAVY . ';text-decoration:none;font-weight:700;font-size:13px;background:' . MM_CARD . ';">' . h($label) . '</a></td>';
    }
    if ($cells === '') return '';
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 14px;"><tr>' . $cells . '</tr></table>';
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
    $thanks = !empty($opt['thanks']) ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;background:' . MM_CARD . ';border:1px solid ' . $line . ';border-radius:12px;"><tr><td style="width:4px;background:' . $gold . ';border-radius:12px 0 0 12px;"></td><td style="padding:14px 20px;font-size:14px;color:' . $ink . ';line-height:1.6;">Благодарим Вас за участие. Желаем новых творческих побед — и ждём Вас на конкурсах центра!</td></tr></table>' : '';

    $vkUrl  = h((string) cfgv('org_vk', 'https://vk.com/music_world.online'));
    $maxUrl = h((string) cfgv('org_max', 'https://max.ru/join/v4SJluLzTAMWm4r5ldJ-JyA2rS5InmPYjaP6drn3F8I'));
    $social = (($opt['social'] ?? true)) ? ('<div style="margin-top:16px;padding-top:14px;border-top:1px solid ' . $line . ';">'
        . '<div style="font-size:12px;color:' . $muted . ';margin-bottom:8px;">Мы в соцсетях — анонсы конкурсов, результаты, полезное:</div>'
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

    // ЗОЛОТАЯ карточка клуба — как просил владелец. Главное требование: она должна
    // оставаться КОМПАКТНОЙ и на телефоне. Раньше её растягивало в узкую «простыню»
    // из-за длинных описаний: на 390 px каждое уезжало в три-четыре строки. Поэтому
    // подписи короткие — одна строка на любой ширине.
    $perks = [
        ['−' . $pct . '%', 'Скидка ' . $pct . '% на всё',   'Участие и награды'],
        [$days . ' дня',   'Ускоренные сроки',              $days . ' рабочих дня вместо 5'],
        ['1/мес',          'Бесплатный конкурс',            'Одна заявка ежемесячно'],
        ['VIP',            'Закрытые конкурсы',             'Только для членов Клуба'],
        ['24ч',            'Приоритетная поддержка',        'Ответ в течение суток'],
        ['★',              'Рекомендации жюри',             'Комментарий и именная карта'],
    ];
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
    return match ($pool) {
        'bulk'   => ['unisender'],                         // рассылки своей базе
        'cold'   => ['unisender'],                         // первое письмо в школу/сад/ДК
        'awards' => ['nagradi', 'main'],                   // наградной, резерв — официальная почта
        default  => ['main', 'nagradi'],                   // официальная почта, резерв — наградной
    };
}

/** Ящик по имени из smtp_senders ('main' — основной из config). */
function mail_account_by_name(string $name): array {
    // Unisender — не почтовый ящик, а сервис рассылок: письма уходят по HTTP API
    // с его серверов, от нашего адреса и с нашей подписью DKIM. Для остального
    // кода он выглядит обычным отправителем, поэтому и живёт в общем списке.
    // Именно он вытянул массовые рассылки, когда Яндекс забанил news@ и novosti@
    // за спам: репутация наших ящиков на его доставку не влияет.
    if ($name === 'unisender') {
        $key = trim((string) cfgv('unisender_api_key', ''));
        if ($key === '') return [];
        $from = trim((string) cfgv('unisender_from', ''));
        if ($from === '') return [];
        // user здесь — не почтовый логин, а опознавательный знак отправителя: по нему
        // считаются дневная норма и темп. Он НАМЕРЕННО не равен адресу «от кого»:
        // иначе сервис слился бы с одноимённым SMTP-ящиком, они дедуплицируются по
        // этому полю, и норма сервиса досталась бы забаненному ящику.
        return [
            'transport'  => 'unisender',
            'host'       => 'go2.unisender.ru',
            'port'       => 443,
            'user'       => 'unisender',
            'pass'       => $key,
            'from_addr'  => $from,
            'from_name'  => (string) cfgv('mail_from_name', 'Культурный центр «Музыкальный Мир»'),
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
    if ((string) ($row['campaign_type'] ?? '') === 'cold') return 'cold';
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
function mail_send_failover(string $to, string $subject, string $html, array $opt = []): bool {
    // Пул определяется типом письма: массовые — только рассылочные ящики,
    // награды и личные письма — рабочие почты центра.
    $pool = (string) ($opt['pool'] ?? mail_pool_for(['priority' => $opt['priority'] ?? 0, 'subject' => $subject]));
    $accounts = mail_fallback_accounts(is_array($opt['account'] ?? null) ? $opt['account'] : [], $pool);
    if (!$accounts) {
        mail_last_error('Для этого типа писем не настроен ни один почтовый ящик (пул «' . $pool . '»).');
        mail_log('POOL EMPTY (' . $pool . ') для ' . $to);
        return false;
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
        if ($recipientFault) {
            mail_log('RCPT REJECT ' . $to . ' — ' . $lastErr . ' (ящик не виноват, перебор прекращён)');
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
        foreach ($files as $f) {
            $f = (string) $f;
            if ($f === '' || !is_file($f)) continue;
            $att[] = ['type' => mail_mime_type($f), 'name' => basename($f), 'content' => base64_encode((string) file_get_contents($f))];
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

    if ($raw === false) { mail_last_error('Unisender: связь не установлена — ' . $err); mail_log('FAIL(uni) to ' . $to . ' | ' . $err); return false; }
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
        ]);
    }
    $to = trim($to);
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
        mail_last_error('Не настроены доступы SMTP (MUZMIR_SMTP_USER / MUZMIR_SMTP_PASS) — письма не отправляются.');
        return false;
    }

    $fromName = (string) ($opt['from_name'] ?? $acc['from_name'] ?? cfgv('mail_from_name', 'Культурного центра «Музыкальный Мир»'));
    $replyTo  = (string) ($opt['reply_to'] ?? cfgv('mail_reply_to', ''));
    // Вложения: 'attachments' (массив путей) имеет приоритет, иначе одиночный 'attach'.
    $attach   = isset($opt['attachments']) && is_array($opt['attachments'])
                  ? $opt['attachments']
                  : (string) ($opt['attach'] ?? '');
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

    if ($ok) {
        mail_log('SENT to ' . $to . ' | ' . $subject);
    } else {
        $why = trim(($code ? $code . ' ' : '') . $err);
        if ($why === '') $why = 'сервер отклонил письмо без объяснения';
        mail_log('FAIL to ' . $to . ' | ' . $subject . ' | ' . $why);
        mail_last_error('SMTP ' . $host . ':' . $port . ' — ' . $why);
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
function mail_queue(string $to, string $name, string $subject, string $html, string $attach = ''): int {
    try {
        $id = insert('mail_queue', [
            'to_email' => trim($to),
            'to_name'  => $name,
            'subject'  => $subject,
            'body'     => $html,
            'attach'   => $attach,
            'status'   => 'queued',
        ]);
        // Сразу дублируем в приложение как уведомление (письмо уйдёт воркером позже).
        if ($id) {
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
