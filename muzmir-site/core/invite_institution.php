<?php
/**
 * ПИСЬМО-ПРИГЛАШЕНИЕ В УЧРЕЖДЕНИЕ.
 *
 * Это не рекламная рассылка, и написано оно намеренно иначе. Адресат — не человек,
 * а организация: школа искусств, дом культуры, детский сад. Читать письмо будет
 * секретарь или завуч, и решать он будет один вопрос — стоит ли показывать это
 * педагогам. Поэтому:
 *
 *   — обращение к учреждению, а не «Здравствуйте, Имя»;
 *   — сначала что получат дети и педагоги, и только потом условия;
 *   — оргвзнос назван прямо и в самом письме, без «подробности на сайте»: письмо,
 *     умалчивающее о деньгах, вскрывается на второй минуте и портит впечатление;
 *   — есть бесплатный конкурс, и он назван первым: учреждению нужно понимать, что
 *     участие возможно и без бюджета;
 *   — отписка работает в один клик и написана по-человечески.
 *
 * Педагог здесь — главный адресат: одна преподавательница приводит группу учеников,
 * поэтому отдельным блоком идёт то, что нужно лично ей — благодарственное письмо и
 * диплом куратора для аттестационного портфолио.
 */
declare(strict_types=1);

/**
 * Тело письма в учреждение.
 *
 * @param array $comps  конкурсы месяца: [['name'=>..,'is_paid'=>..,'price'=>..,'slug'=>..], ...]
 * @param array $opt    ['deadline' => 'd.m.Y'] — до какого числа принимаются заявки
 */
function invite_institution_body(array $comps, array $opt = []): string {
    $site     = rtrim((string) cfgv('base_url', 'https://музыкальный-мир.рф'), '/');
    // В ссылках адрес технический, а глазами человек должен видеть кириллицу:
    // «xn----7sbugdeiegh1b0a9hen.xn--p1ai» в письме от учреждения культуры выглядит
    // как подделка, и до сути письма читатель уже не доходит.
    $siteHuman = h((string) cfgv('domain', 'музыкальный-мир.рф'));
    $phone    = h((string) cfgv('org_phone', ''));
    $email    = h((string) cfgv('org_email', ''));
    $reg      = h((string) cfgv('org_reg', ''));
    $deadline = h((string) ($opt['deadline'] ?? date('d.m.Y', strtotime('last day of this month'))));

    $gold = defined('MM_GOLD') ? MM_GOLD : '#C79322';
    $navy = defined('MM_NAVY') ? MM_NAVY : '#15224C';
    $ink  = defined('MM_INK')  ? MM_INK  : '#22283F';

    // Бесплатные конкурсы идут первыми: учреждению важно знать, что участие
    // возможно и без расходов, иначе письмо закрывают на строке про оргвзнос.
    usort($comps, fn($a, $b) => ((int) ($a['is_paid'] ?? 0)) <=> ((int) ($b['is_paid'] ?? 0)));

    $rows = '';
    foreach ($comps as $c) {
        $name = h((string) ($c['name'] ?? ''));
        if ($name === '') continue;
        $paid = (int) ($c['is_paid'] ?? 0) === 1;
        $cost = $paid
            ? ('организационный взнос ' . (int) ($c['price'] ?? 0) . ' ₽ за заявку')
            : '<b style="color:' . $gold . '">участие бесплатное</b>';
        $rows .= '<tr>'
              . '<td style="padding:9px 0;border-bottom:1px solid #ece7db;font-size:15px;color:' . $ink . '">'
              . '<b>' . $name . '</b></td>'
              . '<td style="padding:9px 0;border-bottom:1px solid #ece7db;font-size:14px;color:#6a7096;text-align:right;white-space:nowrap">'
              . $cost . '</td></tr>';
    }

    return '
<p style="margin:0 0 14px;font-size:16px;color:' . $ink . '">Уважаемые коллеги!</p>

<p style="margin:0 0 14px;font-size:15px;line-height:1.62;color:' . $ink . '">
Культурный центр «Музыкальный Мир» приглашает обучающихся и педагогов Вашего учреждения
принять участие в международных и всероссийских дистанционных конкурсах культуры
и искусства. Конкурсы проводятся при информационной поддержке профильных ведомств,
свидетельство о регистрации СМИ - ' . $reg . '.
</p>

<p style="margin:0 0 10px;font-size:15px;line-height:1.62;color:' . $ink . '">
Участие дистанционное: конкурсная работа принимается видеозаписью, приезжать никуда
не нужно. Приём заявок текущего сезона - до ' . $deadline . '.
</p>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%"
       style="margin:18px 0 20px;border-collapse:collapse">
  <tr><td colspan="2" style="padding-bottom:6px;font-size:13px;letter-spacing:.06em;
      text-transform:uppercase;color:' . $navy . '"><b>Конкурсы сезона</b></td></tr>
  ' . $rows . '
</table>

<div style="margin:0 0 20px;padding:16px 18px;background:#faf6ec;border-left:3px solid ' . $gold . '">
  <div style="font-size:15px;color:' . $navy . ';margin-bottom:8px"><b>Педагогам-кураторам</b></div>
  <div style="font-size:14px;line-height:1.6;color:' . $ink . '">
    Преподаватель, подготовивший участников, получает <b>благодарственное письмо центра</b>
    и <b>диплом куратора</b> - документы принимаются в аттестационное портфолио.
    Оформляются на каждого педагога и высылаются вместе с дипломами учеников.
  </div>
</div>

<p style="margin:0 0 14px;font-size:15px;line-height:1.62;color:' . $ink . '">
Каждый участник получает электронный диплом с результатом аттестации жюри на указанную
в заявке почту. Наградные материалы в оригинале - по желанию и отдельно, обязательным
условием участия они не являются.
</p>

<div style="margin:22px 0 8px;text-align:center">
  <a href="' . h($site) . '/competitions?utm_source=email&utm_campaign=invite-inst"
     style="display:inline-block;padding:14px 34px;background:' . $gold . ';color:#1B1533;
            text-decoration:none;border-radius:999px;font-weight:700;font-size:15px">
    Посмотреть положения конкурсов
  </a>
</div>

<p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#6a7096">
Положения, образцы дипломов и форма заявки - на сайте ' . $siteHuman . '.
Будем признательны, если Вы передадите эту информацию преподавателям Вашего учреждения.
</p>

<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#6a7096">
По любым вопросам: ' . $phone . ', ' . $email . '.
</p>

<p style="margin:18px 0 0;font-size:15px;color:' . $ink . '">
С уважением,<br>оргкомитет Культурного центра «Музыкальный Мир»
</p>';
}

/**
 * Готовое письмо целиком: тело в фирменной обёртке.
 * $unsubUrl обязателен — без работающей отписки такие письма не отправляем.
 */
function invite_institution_email(array $comps, string $unsubUrl, array $opt = []): array {
    if (!function_exists('mm_email_layout')) require_once __DIR__ . '/mailer.php';

    $subject = (string) ($opt['subject'] ?? 'Приглашение к участию в конкурсах культуры и искусства');
    $html = mm_email_layout(invite_institution_body($comps, $opt), [
        'preheader'       => 'Дистанционные конкурсы для обучающихся и педагогов, приём заявок открыт',
        'unsubscribe_url' => $unsubUrl,
        'pixel'           => (string) ($opt['pixel'] ?? ''),
        'vip'             => false,   // учреждению карточка клуба ни к чему
        'audience_note'   => 'Письмо направлено на официальный адрес учреждения как информационное '
                           . 'приглашение к участию в конкурсах. Если оно Вам не нужно - откажитесь одним нажатием, '
                           . 'и мы больше не побеспокоим.',
    ]);
    return ['subject' => $subject, 'html' => $html];
}
