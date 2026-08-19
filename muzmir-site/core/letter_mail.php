<?php
/**
 * ПИСЬМА, В КОТОРЫХ ЛЕЖИТ ОФИЦИАЛЬНЫЙ ДОКУМЕНТ.
 *
 * Первая версия вставляла бланк в тело письма разметкой — и это было ошибкой.
 * Почтовые клиенты не поддерживают ни grid, ни flex, ни миллиметры, ни фоновые
 * градиенты: аккуратный лист А4 в Gmail разваливается в ленту из огромных
 * картинок, печать растягивается на весь экран, QR-код занимает половину
 * письма. Документ, который должен внушать доверие, выглядит как поломка.
 *
 * РЕШЕНИЕ — ТО ЖЕ, ЧТО С ДИПЛОМАМИ. Бланк рисуется картинкой (лист целиком,
 * как он выйдет на печать), и картинка вставляется в письмо одним изображением
 * фиксированной ширины. Что бы ни делал почтовый клиент с разметкой, документ
 * останется ровным листом. Рядом — кнопка «Скачать PDF» для делопроизводителя.
 *
 * ТЕКСТ ДУБЛИРУЕТСЯ ПОД КАРТИНКОЙ. На телефоне лист А4 мелкий, и читать его
 * никто не станет: суть письма, сроки и кнопка действия обязаны быть обычным
 * текстом, который почта умеет масштабировать.
 */
declare(strict_types=1);

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/official_letter.php';
require_once __DIR__ . '/letter_texts.php';
require_once __DIR__ . '/pdf_letter.php';

/**
 * Рисует бланк картинкой и возвращает [URL картинки, путь к PDF].
 *
 * Картинка кладётся в public — её тянет почтовый клиент получателя. PDF лежит
 * рядом: он нужен вложением и по кнопке «скачать».
 *
 * @return array{img:string, img_abs:string, pdf:string}
 */
function lm_render(string $number, array $o): array {
    $dir = BASE_PATH . '/public/uploads/letters';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);

    $stem = 'ol-' . preg_replace('~[^0-9a-zA-Z]~', '-', $number);
    $jpg  = $dir . '/' . $stem . '.jpg';
    $pdf  = '';

    try {
        $pdf = pdf_official_letter($o + ['number' => $number, 'preview' => $jpg]);
    } catch (\Throwable $e) {
        return ['img' => '', 'img_abs' => '', 'pdf' => ''];
    }
    if (is_file($jpg)) @chmod($jpg, 0664);

    $base = rtrim((string) cfgv('base_url', ''), '/');
    return [
        'img'     => is_file($jpg) ? $base . '/uploads/letters/' . basename($jpg) : '',
        'img_abs' => is_file($jpg) ? $jpg : '',
        'pdf'     => $pdf,
    ];
}

/**
 * Карточка с изображением документа — общий блок для всех писем с обращением.
 *
 * Ширина жёсткая, 560 точек: столько занимает колонка письма в почтовом
 * клиенте. Картинка отдаётся в два раза крупнее и ужимается — иначе на экране
 * телефона с плотностью 3x лист выглядит мыльным.
 */
function lm_document_card(string $imgUrl, string $number, string $pdfUrl = ''): string {
    if ($imgUrl === '') return '';

    $navy = MM_NAVY; $muted = MM_MUTED; $line = MM_LINE; $ivory = MM_IVORY;
    $verify = ol_verify_url($number);

    $out = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 22px">'
         . '<tr><td align="center" style="background:' . $ivory . ';border:1px solid ' . $line . ';'
         . 'border-radius:14px;padding:14px">'
         . '<img src="' . h($imgUrl) . '" width="560" alt="Официальное обращение №' . h($number) . '" '
         . 'style="display:block;width:100%;max-width:560px;height:auto;border:1px solid ' . $line . ';'
         . 'border-radius:8px;background:#fff">'
         . '<div style="font:12px/1.5 Arial,sans-serif;color:' . $muted . ';padding-top:10px">'
         . 'Исходящий <b style="color:' . $navy . '">№' . h($number) . '</b> · '
         . '<a href="' . h($verify) . '" style="color:' . $muted . '">проверить подлинность</a>'
         . '</div>';

    if ($pdfUrl !== '') {
        $out .= '<div style="padding-top:4px">' . mm_email_btn($pdfUrl, 'Скачать документ (PDF)', 'navy') . '</div>';
    }

    return $out . '</td></tr></table>';
}

/** Заголовок письма: крупная строка и подзаголовок под ней. */
function lm_head(string $title, string $sub = ''): string {
    $navy = MM_NAVY; $muted = MM_MUTED;
    $out = '<h1 style="margin:0 0 6px;font:700 23px/1.3 Georgia,\'Times New Roman\',serif;color:' . $navy . '">'
         . h($title) . '</h1>';
    if ($sub !== '') {
        $out .= '<div style="font:15px/1.6 Arial,sans-serif;color:' . $muted . ';margin:0 0 18px">' . $sub . '</div>';
    }
    return $out;
}

/** Абзац письма. */
function lm_p(string $html, string $style = ''): string {
    return '<p style="margin:0 0 14px;font:16px/1.65 Arial,sans-serif;color:' . MM_INK . ';' . $style . '">'
         . $html . '</p>';
}

/**
 * Выделенная плашка — то, ради чего письмо написано.
 * Одна на письмо: если выделено всё, не выделено ничего.
 */
function lm_callout(string $html): string {
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px">'
         . '<tr><td style="background:' . MM_CARD . ';border-left:4px solid ' . MM_GOLD . ';'
         . 'border-radius:0 10px 10px 0;padding:14px 18px;font:15px/1.6 Arial,sans-serif;color:' . MM_INK . '">'
         . $html . '</td></tr></table>';
}

/** Список конкурсов сезона таблицей: название слева, условие справа. */
function lm_comps_table(array $comps): string {
    if (!$comps) return '';
    usort($comps, fn($a, $b) => ((int) ($a['is_paid'] ?? 0)) <=> ((int) ($b['is_paid'] ?? 0)));

    $rows = '';
    foreach ($comps as $c) {
        $name = trim((string) ($c['name'] ?? ''));
        if ($name === '') continue;
        $paid = (int) ($c['is_paid'] ?? 0) === 1;
        $rows .= '<tr>'
              . '<td style="padding:11px 0;border-bottom:1px solid ' . MM_LINE . ';'
              . 'font:600 15px/1.4 Arial,sans-serif;color:' . MM_INK . '">' . h($name) . '</td>'
              . '<td align="right" style="padding:11px 0;border-bottom:1px solid ' . MM_LINE . ';'
              . 'font:14px/1.4 Arial,sans-serif;white-space:nowrap;color:'
              . ($paid ? MM_MUTED . '">взнос ' . (int) ($c['price'] ?? 0) . ' ₽'
                       : '#1E7A46;font-weight:700">бесплатно')
              . '</td></tr>';
    }
    if ($rows === '') return '';

    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 20px">'
         . '<tr><td colspan="2" style="padding-bottom:6px;border-bottom:2px solid ' . MM_GOLD . ';'
         . 'font:700 12px/1.4 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:' . MM_NAVY . '">'
         . 'Конкурсы сезона</td></tr>' . $rows . '</table>';
}

/**
 * Блок «реквизиты обращения»: номер, дата, кому. Ставится в начале письма,
 * сразу под обращением по имени, и заменяет собой картинку бланка.
 *
 * Картинку листа отсюда убрали намеренно. Фотография документа в письме
 * выглядит хуже самого документа: почта пережимает её, на телефоне текст
 * нечитаем, а качество портит впечатление. Документ теперь идёт вложением
 * файлом, а в письме то же содержание набрано нормальным текстом.
 */
function lm_docline(string $number, string $to = ''): string {
    $navy = MM_NAVY; $muted = MM_MUTED; $line = MM_LINE;
    $date = function_exists('ru_date') ? ru_date(date('Y-m-d')) : date('d.m.Y');

    $rows = '<tr><td style="padding:2px 0;font:13px/1.6 Arial,sans-serif;color:' . $muted . '">Исходящий</td>'
          . '<td align="right" style="padding:2px 0;font:700 13px/1.6 Arial,sans-serif;color:' . $navy . '">№'
          . h($number) . '</td></tr>'
          . '<tr><td style="padding:2px 0;font:13px/1.6 Arial,sans-serif;color:' . $muted . '">Дата</td>'
          . '<td align="right" style="padding:2px 0;font:13px/1.6 Arial,sans-serif;color:' . $navy . '">'
          . h($date) . '</td></tr>';
    if ($to !== '') {
        $rows .= '<tr><td style="padding:2px 0;font:13px/1.6 Arial,sans-serif;color:' . $muted . '">Кому</td>'
               . '<td align="right" style="padding:2px 0;font:13px/1.6 Arial,sans-serif;color:' . $navy . '">'
               . h($to) . '</td></tr>';
    }

    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
         . 'style="margin:0 0 20px;border-top:2px solid ' . MM_GOLD . ';border-bottom:1px solid ' . $line . '">'
         . '<tr><td style="padding:10px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">'
         . $rows . '</table></td></tr></table>';
}

/**
 * Подпись под письмом: должность, фамилия и приписка про вложение.
 * Формулировка «за подписью и печатью» вынесена сюда один раз, вместо трёх
 * повторов в теле каждого письма.
 */
function lm_sign(string $number, bool $withDoc = true): string {
    $navy = MM_NAVY; $muted = MM_MUTED; $line = MM_LINE;
    $out = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 0;'
         . 'border-top:1px solid ' . $line . '">'
         . '<tr><td style="padding:16px 0 0;font:15px/1.6 Arial,sans-serif;color:' . MM_INK . '">'
         . 'Генеральный директор<br>Культурного центра «Музыкальный Мир»<br>'
         . '<b style="color:' . $navy . '">А. И. Ильясов</b>'
         . '</td></tr></table>';
    if ($withDoc) {
        $out .= '<div style="margin:14px 0 0;font:13px/1.6 Arial,sans-serif;color:' . $muted . '">'
              . 'Подписанный документ с печатью приложен к письму файлом. Подлинность можно '
              . 'проверить по номеру: <a href="' . h(ol_verify_url($number)) . '" style="color:' . $muted . '">'
              . h((string) cfgv('domain', 'музыкальный-мир.рф')) . '/letter/' . h($number) . '</a>.'
              . '</div>';
    }
    return $out;
}

/** Нумерованный список приложений к письму. */
function lm_attachments_list(array $items): string {
    $items = array_values(array_filter($items));
    if (!$items) return '';
    $li = '';
    foreach ($items as $i => $t) {
        $li .= '<tr><td width="26" valign="top" style="padding:3px 0;font:700 14px/1.6 Arial,sans-serif;color:'
             . MM_GOLD . '">' . ($i + 1) . '.</td>'
             . '<td style="padding:3px 0;font:14px/1.6 Arial,sans-serif;color:' . MM_INK . '">' . h($t) . '</td></tr>';
    }
    return '<div style="margin:18px 0 4px;font:700 13px/1.4 Arial,sans-serif;letter-spacing:.06em;'
         . 'text-transform:uppercase;color:' . MM_NAVY . '">Приложения</div>'
         . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px">'
         . $li . '</table>';
}

/**
 * ПИСЬМО В ВЕДОМСТВО. Обращение об информационной поддержке.
 *
 * @return array{subject:string, html:string, pdf:string}
 */
function lm_mail_support(array $r, string $number, array $free): array {
    $org  = (string) ($r['org'] ?? '');
    $role = (string) ($r['person_role'] ?? '');
    $fio  = (string) ($r['person'] ?? '');
    $base = rtrim((string) cfgv('base_url', ''), '/');
    $press = ((string) ($r['branch'] ?? 'main')) === 'press';

    $o = ['kind' => 'support', 'org' => $org, 'person' => $fio, 'person_role' => $role,
          'region' => (string) ($r['region'] ?? ''), 'email' => (string) ($r['email'] ?? '')];

    $att = ['Положение о конкурсе (бесплатное участие).', 'Афиша конкурса.',
            'Логотип Культурного центра «Музыкальный Мир».'];

    // Документ собираем файлом: он уходит вложением и его же скачивают по кнопке.
    // Бланк строгий: белая бумага, без рамки и выделенных плашек — в ведомстве
    // документ читают как документ.
    $doc = lm_render($number, [
        'kind'        => 'support',
        'plain'       => true,
        'title'       => 'Об информационной поддержке всероссийского творческого конкурса',
        'addressee'   => lm_addressee($role, $org, $fio),
        'salutation'  => lm_salut($fio),
        'body'        => ol_body_support($free, $o),
        'attachments' => $att,
    ]);

    $names = [];
    foreach ($free as $c) {
        $n = trim((string) ($c['name'] ?? ''));
        if ($n !== '') $names[] = '«' . $n . '»';
    }
    $list = $names ? implode(', ', $names) : 'всероссийского творческого конкурса';
    $one  = count($names) === 1;
    $dl   = ol_deadline($free);
    $dlRu = $dl !== '' ? (function_exists('ru_date') ? ru_date($dl) : date('d.m.Y', strtotime($dl))) : '';

    $inner  = lm_head('ОБРАЩЕНИЕ', $press
        ? 'об информационном освещении всероссийского творческого конкурса для детей и молодёжи'
        : 'об информационной поддержке всероссийского творческого конкурса для детей и молодёжи');

    $inner .= lm_docline($number, $role !== '' ? $role : $org);

    $inner .= lm_p('<b>' . h(lm_salut($fio)) . '</b>', 'font-size:17px;margin-bottom:16px');

    $inner .= lm_p('Прошу Вас оказать информационную поддержку ' . ($one ? 'конкурса ' : 'конкурсов ')
        . '<b>' . h($list) . '</b>, ' . ($one ? 'проводимого' : 'проводимых')
        . ' Культурным центром «Музыкальный Мир» в ' . date('Y') . ' году. '
        . '<b>Участие в ' . ($one ? 'конкурсе' : 'конкурсах') . ' бесплатное.</b>');

    $inner .= lm_p('Конкурс проводится в целях укрепления традиционных российских духовно-нравственных '
        . 'ценностей у детей и молодёжи через патриотическое воспитание, выявления и поддержки талантливой '
        . 'молодёжи, популяризации искусства в его исполнительском и педагогическом аспектах.');

    $inner .= lm_p('Участие дистанционное: конкурсная работа принимается видеозаписью или изображением по '
        . 'ссылке, выезд участников не требуется. Это делает конкурс доступным для детей из малых городов '
        . 'и сельских территорий, для обучающихся с ограниченными возможностями здоровья и для семей, '
        . 'которым поездка на очный конкурс недоступна по стоимости.'
        . ($dlRu !== '' ? ' Приём работ текущего сезона до <b>' . h($dlRu) . '</b>.' : ''));

    $inner .= lm_callout('<b>О чём просим.</b> Разместить информацию о конкурсе на официальном сайте и в '
        . 'информационных ресурсах Вашего ведомства либо направить её в подведомственные учреждения '
        . 'культуры и образования.');

    // Про публикацию полученных писем на сайте центра здесь не пишем — см. пояснение
    // в ol_body_support(): в официальном обращении это читается как навязанное условие.
    $inner .= lm_p('Прошу предоставить ответ по данному обращению на фирменном бланке Вашего ведомства.');

    $inner .= lm_attachments_list(array_merge(['Обращение на бланке центра (PDF).'], $att));
    $inner .= lm_sign($number);
    $inner .= mm_email_btn($base . '/ministry-support', 'Раздел «Поддержка» на сайте', 'gold');

    $html = mm_email_layout($inner, [
        'vip'           => false,
        'preheader'     => 'Обращение об информационной поддержке. Участие в конкурсе бесплатное.',
        'audience_note' => 'Письмо направлено на официальный адрес ведомства, опубликованный на его сайте. '
                         . 'Если такие письма не нужны, ответьте одним словом «отписать».',
    ]);

    return [
        'subject' => 'Обращение об информационной поддержке всероссийского конкурса (исх. №' . $number . ')',
        'html'    => $html,
        'pdf'     => (string) $doc['pdf'],
    ];
}

/**
 * ПИСЬМО В УЧРЕЖДЕНИЕ. Приглашение педагогов и обучающихся.
 *
 * @return array{subject:string, html:string, pdf:string}
 */
function lm_mail_institution(array $inst, string $number, array $comps, string $unsubUrl = ''): array {
    if (!function_exists('partner_join_url') && is_file(BASE_PATH . '/core/partner.php')) {
        require_once BASE_PATH . '/core/partner.php';
    }
    $fio  = trim((string) ($inst['director'] ?? ''));
    $org  = (string) ($inst['name'] ?? '');
    $base = rtrim((string) cfgv('base_url', ''), '/');
    $site = (string) cfgv('domain', 'музыкальный-мир.рф');

    $doc = lm_render($number, [
        'title'       => 'Обращение',
        'addressee'   => array_values(array_filter(['Руководителю ' . $org, $fio])),
        'salutation'  => lm_salut($fio),
        'body'        => ol_body_institution($comps, ['org' => $org, 'person' => $fio]),
        'attachments' => ['Положения конкурсов сезона (по ссылке на официальном сайте).'],
    ]);

    $dl   = ol_deadline($comps);
    $dlRu = $dl !== '' ? (function_exists('ru_date') ? ru_date($dl) : date('d.m.Y', strtotime($dl))) : '';

    $inner  = lm_head('ОБРАЩЕНИЕ', 'о приглашении обучающихся и педагогов учреждения '
        . 'к участию во всероссийских и международных творческих конкурсах');

    $inner .= lm_docline($number, $org !== '' ? 'Руководителю ' . $org : '');

    $inner .= lm_p('<b>' . h(lm_salut($fio)) . '</b>', 'font-size:17px;margin-bottom:16px');

    $inner .= lm_p('Культурный центр «Музыкальный Мир» приглашает обучающихся и педагогов Вашего '
        . 'учреждения принять участие в дистанционных конкурсах культуры и искусства по направлениям: '
        . 'вокал, хореография, инструментальное исполнительство, изобразительное и '
        . 'декоративно-прикладное творчество, художественное слово, театральное искусство.');

    $inner .= lm_p('Участие дистанционное: конкурсная работа принимается видеозаписью или изображением '
        . 'по ссылке, приезжать никуда не нужно.'
        . ($dlRu !== '' ? ' Приём заявок текущего сезона до <b>' . h($dlRu) . '</b>.' : ''));

    // ЧТО УЧРЕЖДЕНИЕ ПОЛУЧАЕТ — ДО ПЕРЕЧНЯ КОНКУРСОВ, А НЕ ПОСЛЕ ВОСЬМИ ССЫЛОК.
    //
    // Письмо читают на бегу, и решение принимается по первому экрану. Раньше
    // главное для педагога (благодарственное письмо и диплом куратора бесплатно)
    // стояло в середине, а согласие на партнёрство в самом конце, после четырёх
    // конкурсов и восьми ссылок на положения. Открывали письмо охотно, а до
    // кнопки не доходили: за трое суток из девяти с половиной тысяч отправленных
    // приглашений согласие не подтвердил никто.
    $inner .= lm_callout('<b>Педагогам-кураторам — бесплатно.</b> Преподаватель, подготовивший '
        . 'участников, получает благодарственное письмо центра и диплом куратора: <b>без заказа и '
        . 'без оплаты</b>, отдельным документом на каждого ученика. Документы принимаются в '
        . 'аттестационное портфолио.');

    $inner .= lm_comps_table($comps);

    $inner .= lm_p('Каждый участник получает электронный диплом с результатом аттестации жюри на '
        . 'указанную в заявке почту. Наградные материалы в оригинале по желанию и отдельно, '
        . 'обязательным условием участия они не являются.');

    // ЗАЯВКА ИДЁТ ПО ССЫЛКЕ УЧРЕЖДЕНИЯ, А НЕ ЧЕРЕЗ ОБЩУЮ ФОРМУ.
    //
    // Кнопка вела на /apply, и заявка приходила «ниоткуда»: учреждению она не
    // засчитывалась, счётчик до пяти заявок (после которых положены благодарности
    // педагогам) не двигался, и партнёрство выглядело обещанием без содержания.
    // Постоянная ссылка /p/<slug> ведёт на ту же форму, но помнит, кто привёл.
    $instId  = (int) ($inst['id'] ?? 0);
    $pSlug   = trim((string) ($inst['partner_slug'] ?? ''));
    $applyUrl = $pSlug !== '' ? $base . '/p/' . $pSlug : $base . '/apply';
    $inner .= mm_email_btn($applyUrl, 'Подать заявку', 'gold');
    if ($pSlug !== '') {
        $inner .= lm_p('Это персональная ссылка Вашего учреждения: поданные по ней заявки '
            . 'засчитываются ему автоматически. Её можно разослать преподавателям или разместить '
            . 'на сайте учреждения.', 'font-size:13.5px;color:#6b6b75;margin-top:-6px');
    }

    $boxPartner = function_exists('ol_box_email') ? ol_box_email('partner') : 'novosti@музыкальный-мир.рф';
    // СОГЛАСИЕ НА ПАРТНЁРСТВО — КНОПКОЙ, А НЕ ОТВЕТНЫМ ПИСЬМОМ.
    //
    // Раньше единственным способом было ответить на письмо словом «согласны»:
    // ответ разбирал почтовый робот и только тогда включал всю цепочку. На
    // тысячах отправленных приглашений это не сработало ни разу — писать ответ
    // долго, и в школе этим обычно некому заняться. Именная подписанная ссылка
    // делает то же самое одним нажатием, а ответ письмом остаётся как запасной путь.
    if ($instId > 0 && function_exists('partner_join_url')) {
        // АККАУНТ УЧРЕЖДЕНИЯ УЖЕ ЗАВЕДЁН — ОБ ЭТОМ И ГОВОРИМ.
        //
        // Раньше письмо предлагало «стать партнёром», то есть подать заявку и
        // ждать. Теперь партнёрский аккаунт создаётся до отправки письма
        // (partner_prepare), и у учреждения уже есть постоянная ссылка для своих
        // участников и номер в реестре. Показываем их прямо в письме: согласие
        // сводится к одному нажатию, а ссылку можно ставить на свой сайт сразу.
        $slug = trim((string) ($inst['partner_slug'] ?? ''));
        $no   = trim((string) ($inst['partner_no'] ?? ''));
        // ЧТО ИМЕННО ПОЛУЧАЕТ УЧРЕЖДЕНИЕ И ЧТО ОТ НЕГО ТРЕБУЕТСЯ.
        // Прежний текст перечислял выгоды общими словами и не снимал главный
        // вопрос делопроизводителя: что подписывать и чем это обязывает. Отсюда
        // и результат: письма открывали, кнопку не нажимали.
        $inner .= lm_callout('<b>Информационное партнёрство — уже оформлено на Ваше учреждение'
            . ($no !== '' ? ', номер <b>' . h($no) . '</b>' : '') . '.</b> Остаётся подтвердить. '
            . 'Учреждение получает именной сертификат партнёра для сайта и стенда, кабинет со '
            . 'списком своих заявок, скидку 10% участникам по своей ссылке, а с пятой заявки — '
            . 'благодарственные письма педагогам за подписью оргкомитета.');
        $inner .= lm_p('<b>Что требуется от учреждения:</b> ничего, кроме одного нажатия. '
            . 'Договор не подписывается, отчётность не ведётся, платежей нет, отказаться можно '
            . 'в любой момент одним письмом.', 'font-size:14px;color:#4a4a55');
        $inner .= mm_email_btn(partner_join_url($instId), 'Подтвердить партнёрство', 'navy');
        if ($slug !== '') {
            $link = rtrim((string) cfgv('base_url'), '/') . '/p/' . $slug;
            $inner .= lm_p('После подтверждения начинает работать постоянная ссылка учреждения '
                . '<a href="' . h($link) . '" style="color:#8B6F1F">' . h($link) . '</a> — её можно '
                . 'разместить на сайте или разослать преподавателям.',
                'font-size:13.5px;color:#6b6b75;margin-top:-6px');
        }
    }


    $inner .= lm_p('Положения конкурсов, образцы дипломов и форма заявки размещены на официальном сайте '
        . '<b>' . h($site) . '</b>. Будем признательны, если Вы доведёте настоящее обращение до сведения '
        . 'преподавателей Вашего учреждения и разместите его на информационном стенде.');

    // АФИШИ И ПОЛОЖЕНИЯ — ССЫЛКАМИ.
    // Раньше они ехали вложениями: девять файлов на 3,5 МБ в каждом холодном
    // письме. Почтовые службы читают такое как спам — проба от нашего же домена
    // легла в папку «Спам». Ссылки на сайт дают ровно то же самое и ничего не весят.
    $links = '';
    foreach ((array) $comps as $c) {
        $slug = trim((string) ($c['slug'] ?? ''));
        $nm   = trim((string) ($c['name'] ?? ''));
        if ($slug === '' || $nm === '') continue;
        $links .= '<tr><td style="padding:4px 0;font-size:14px;line-height:1.5">'
                . '<b>' . h($nm) . '</b> — '
                . '<a href="' . h($base . '/competition/' . $slug) . '" style="color:#8B6F1F">афиша и условия</a>'
                . ' · <a href="' . h($base . '/competition/' . $slug . '/regulation.pdf') . '" style="color:#8B6F1F">положение (PDF)</a>'
                . '</td></tr>';
    }
    if ($links !== '') {
        $inner .= lm_p('<b>Афиши и положения конкурсов:</b>', 'margin-bottom:6px');
        $inner .= '<table style="width:100%;border-collapse:collapse;margin:0 0 14px">' . $links . '</table>';
    }

    // КОНТАКТЫ В САМОМ ПИСЬМЕ.
    // Их тут не было вовсе: адрес для ответа стоял только внутри приложенного PDF.
    // Человек, решивший написать, не видел куда, и письмо уходило в никуда либо
    // не уходило вовсе.
    // Адрес партнёрского отдела, а не общий официальный: ответ должен прийти туда,
    // где его читают. Стоял kc@ — ящик ведомств, и согласие учреждения попадало в
    // разбор обращений к министерствам, который чужие письма не берёт.
    $inner .= lm_p('По вопросам участия и партнёрства: <b>' . h((string) cfgv('org_phone', '')) . '</b>, '
        . '<a href="mailto:' . h($boxPartner) . '" style="color:#8B6F1F">' . h($boxPartner) . '</a>. '
        . 'Согласие на информационное партнёрство можно также направить ответным письмом.',
        'font-size:14px;color:#4a4a55');

    $inner .= lm_attachments_list(['Обращение на бланке центра (PDF).']);
    $inner .= lm_sign($number);

    $html = mm_email_layout($inner, [
        'vip'             => false,
        // Предпросмотр в списке писем: то, что видно рядом с темой до открытия.
        // Здесь место главной выгоде для школы, а не повтору темы.
        'preheader'       => 'Благодарственные письма педагогам бесплатно, есть конкурс с бесплатным участием.',
        'unsubscribe_url' => $unsubUrl,
        'audience_note'   => 'Письмо направлено на официальный адрес учреждения, опубликованный в открытых источниках.',
    ]);

    // ТЕМА ГОВОРИТ, ЧТО ВНУТРИ И ДО КОГДА.
    //
    // Прежняя тема «Приглашаем учреждение к участию в конкурсах (исх. №...)» верна
    // для делопроизводства, но не даёт ни одной причины открыть письмо сегодня, а
    // не через неделю, когда приём уже закрыт. Номер исходящего оставляем: по нему
    // учреждение регистрирует входящее, и без него письмо читается как реклама.
    $subj = ($fio !== '' ? lm_name_only($fio) . ', п' : 'П') . 'риглашаем учреждение к участию в конкурсах';
    if ($dlRu !== '') $subj .= ', приём заявок до ' . $dlRu;
    $subj .= ' (исх. №' . $number . ')';

    return [
        'subject' => $subj,
        'html'    => $html,
        'pdf'     => (string) $doc['pdf'],
    ];
}

/**
 * БЛАГОДАРСТВЕННОЕ ПИСЬМО УЧРЕЖДЕНИЮ.
 *
 * @return array{subject:string, html:string, pdf:string}
 */
function lm_mail_thanks(array $inst, string $number, int $works = 0, array $teachers = []): array {
    $fio  = trim((string) ($inst['director'] ?? ''));
    $org  = (string) ($inst['name'] ?? '');
    $base = rtrim((string) cfgv('base_url', ''), '/');
    $year = date('Y');

    $doc = lm_render($number, [
        'kind'       => 'thanks',
        'title'      => 'Благодарственное письмо',
        'addressee'  => array_values(array_filter(['Руководителю ' . $org, $fio])),
        'salutation' => lm_salut($fio),
        'body'       => ol_body_thanks(['org' => $org, 'person' => $fio, 'works' => $works,
                                        'season' => $year, 'teachers' => $teachers]),
        'no_approve' => true,
    ]);

    $inner  = lm_head('БЛАГОДАРСТВЕННОЕ ПИСЬМО', 'за поддержку творческих конкурсов центра в ' . $year . ' году');
    $inner .= lm_docline($number, $org !== '' ? 'Руководителю ' . $org : '');
    $inner .= lm_p('<b>' . h(lm_salut($fio)) . '</b>', 'font-size:17px;margin-bottom:16px');

    $inner .= lm_p('Культурный центр «Музыкальный Мир» выражает искреннюю благодарность коллективу '
        . '<b>' . h($org) . '</b> за поддержку творческих конкурсов центра и внимание к дистанционным '
        . 'формам работы с одарёнными детьми в ' . $year . ' году.');

    if ($works > 0) {
        $inner .= lm_callout('Обучающиеся Вашего учреждения представили на аттестацию жюри <b>' . $works
            . '</b> ' . ol_plural($works, 'конкурсную работу', 'конкурсные работы', 'конкурсных работ')
            . '. Каждая получила профессиональную оценку и наградной документ.');
    }

    if ($teachers) {
        $li = '';
        foreach ($teachers as $t) {
            $n = trim((string) (is_array($t) ? ($t['name'] ?? '') : $t));
            if ($n === '') continue;
            $li .= '<tr><td style="padding:6px 0;border-bottom:1px solid ' . MM_LINE
                 . ';font:15px/1.5 Arial,sans-serif;color:' . MM_INK . '">' . h($n) . '</td></tr>';
        }
        if ($li !== '') {
            $inner .= '<div style="margin:18px 0 6px;font:700 13px/1.4 Arial,sans-serif;letter-spacing:.06em;'
                    . 'text-transform:uppercase;color:' . MM_NAVY . '">Персональные благодарности педагогам</div>'
                    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
                    . 'style="margin:0 0 16px">' . $li . '</table>'
                    . lm_p('Благодарственные письма на имя каждого из них приложены к настоящему письму '
                    . 'отдельными файлами и могут быть вручены на педагогическом совете.');
        }
    }

    $inner .= lm_p('Отдельно благодарим за содействие в информировании педагогов и родителей. Именно '
        . 'позиция учреждения делает участие в конкурсах доступным для детей, которым поездка на очный '
        . 'конкурс не по силам или не по средствам.');

    $inner .= lm_p('Надеемся на продолжение сотрудничества.');
    $inner .= lm_attachments_list(array_merge(
        ['Благодарственное письмо учреждению на бланке центра (PDF).'],
        $teachers ? ['Благодарственные письма педагогам, по одному файлу на каждого (PDF).'] : []
    ));
    $inner .= lm_sign($number);
    $inner .= mm_email_btn($base . '/competitions', 'Конкурсы нового сезона', 'gold');

    $html = mm_email_layout($inner, [
        'vip'           => false,
        'preheader'     => 'Благодарственное письмо Культурного центра «Музыкальный Мир».',
        'audience_note' => 'Письмо направлено на официальный адрес учреждения в связи с участием его '
                         . 'обучающихся в конкурсах центра.',
    ]);

    return [
        'subject' => 'Благодарственное письмо Культурного центра «Музыкальный Мир» (исх. №' . $number . ')',
        'html'    => $html,
        'pdf'     => (string) $doc['pdf'],
    ];
}

/* ── Мелочи обращения по имени ─────────────────────────────────────────── */

/**
 * РЕКВИЗИТ «АДРЕСАТ» ПО ПРАВИЛАМ ДЕЛОПРОИЗВОДСТВА (ГОСТ Р 7.0.97-2016).
 *
 * Должность с наименованием организации — в дательном падеже, ниже отдельной
 * строкой фамилия с инициалами, инициалы ПЕРЕД фамилией. «Иванова Мария
 * Петровна» в реквизите адресата не пишут: там «Ивановой М. П.».
 *
 * Когда должность неизвестна, остаётся одна организация — это допустимо, а вот
 * выдумывать должность нельзя: письмо уйдёт не тому и вернётся с отказом.
 *
 * @return array<int,string> строки реквизита сверху вниз
 */
function lm_addressee(string $role, string $org, string $fio): array {
    $out = [];
    $head = trim($role) !== '' ? trim($role) : trim($org);
    if ($head !== '') $out[] = $head;

    $parts = array_values(array_filter(preg_split('~\s+~u', trim($fio)) ?: []));
    if (count($parts) >= 2) {
        // Фамилия в дательном падеже уже приходит из реестра в именительном,
        // поэтому склоняем только окончание — этого достаточно для «Ивановой».
        $ini = mb_substr($parts[1], 0, 1) . '.';
        if (isset($parts[2])) $ini .= ' ' . mb_substr($parts[2], 0, 1) . '.';
        $out[] = ol_surname_dative($parts[0], $fio) . ' ' . $ini;
    } elseif (count($parts) === 1) {
        $out[] = $parts[0];
    }
    return $out;
}

/**
 * Фамилия в дательном падеже: «Иванов» → «Иванову», «Иванова» → «Ивановой».
 *
 * Полного склонения тут не нужно и опасно: несклоняемые фамилии («Шевченко»,
 * «Дюма») портятся любой попыткой их согнуть. Меняем окончание только у явных
 * русских форм, остальное оставляем как есть — это всегда безопасно.
 */
function ol_surname_dative(string $surname, string $fio = ''): string {
    $s = trim($surname);
    if ($s === '') return $s;
    $female = ol_gender($fio !== '' ? $fio : $s) === 'f';

    if ($female) {
        if (preg_match('~(ова|ева|ёва|ина|ына|ская|цкая|ая|яя)$~u', $s)) {
            return preg_replace('~ая$~u', 'ой', preg_replace('~а$~u', 'ой', $s));
        }
        return $s;                                   // «Ким», «Гурулёв оглы» — не склоняем
    }
    if (preg_match('~(ий|ый|ой)$~u', $s)) return preg_replace('~(ий|ый|ой)$~u', 'ому', $s);
    if (preg_match('~(ов|ев|ёв|ин|ын)$~u', $s))  return $s . 'у';
    if (preg_match('~[бвгдджзклмнпрстфхцчшщ]$~u', $s)) return $s . 'у';
    return $s;
}

/** «Уважаемая Мария Петровна!» по полному ФИО; без ФИО — нейтрально. */
function lm_salut(string $fio): string {
    return ol_salutation($fio);
}

/** «Иванова Мария Петровна» → «Мария Петровна» (для темы письма). */
function lm_name_only(string $fio): string {
    $parts = preg_split('~\s+~u', trim($fio)) ?: [];
    return count($parts) >= 3 ? ($parts[1] . ' ' . $parts[2]) : trim($fio);
}

/**
 * Уборка картинок и PDF отправленных обращений.
 *
 * Каждое письмо получает свой лист с личным номером, и на тридцати пяти тысячах
 * писем это гигабайты. Держать их вечно незачем: адресат письмо уже получил, а
 * подлинность подтверждается записью в реестре, а не файлом. Оставляем месяц —
 * на случай, если понадобится показать, что именно ушло.
 *
 * @return array{files:int, bytes:int}
 */
function lm_cleanup(int $days = 30, int $pdfDays = 7): array {
    $n = 0; $b = 0;
    // РАЗНЫЕ СРОКИ ДЛЯ РАЗНОГО.
    //
    // PDF — самое тяжёлое: 700 КБ на письмо. Он нужен ровно один раз, в момент
    // отправки, вложением; дальше документ лежит у адресата. Картинка легче и
    // живёт дольше: её показывает страница проверки подлинности, куда ведёт QR
    // с бланка, и делопроизводитель может прийти туда через месяц.
    //
    // Сроки пришлось развести после того, как диск сервера кончился: рассылка по
    // учреждениям делает тысячи писем в день, за трое суток набежало семь
    // гигабайт, а впереди тридцать семь тысяч адресов. При хранении в тридцать
    // дней это двадцать пять гигабайт на диске в тридцать восемь.
    foreach ([[BASE_PATH . '/data/letters', $pdfDays],
              [BASE_PATH . '/public/uploads/letters', $days]] as [$dir, $keep]) {
        if (!is_dir($dir)) continue;
        $edge = time() - max(1, $keep) * 86400;
        foreach (glob($dir . '/*') ?: [] as $f) {
            if (!is_file($f) || filemtime($f) > $edge) continue;
            $b += (int) filesize($f);
            if (@unlink($f)) $n++;
        }
    }
    return ['files' => $n, 'bytes' => $b];
}

