<?php
/**
 * Фирменные транзакционные письма КЦ «Музыкальный Мир»:
 *  - application_mail_send() — письмо «Заявка принята» (вызов из api/v1/apply.php);
 *  - result_mail_send()      — письмо с результатом конкурса + in-app уведомление
 *                              (вызов из admin/grading.php для платных конкурсов).
 * Дизайн: шапка — золото #C79322 на синем градиенте #17307A→#24499F, текстовая
 * монограмма «ММ» (без картинок-вложений), золотые кнопки, подвал с контактами
 * из cfgv(). Вся вёрстка — таблицы + инлайн-CSS (совместимость с почтовиками).
 * Отправка — через существующую очередь mail_queue (core/mailer.php).
 */
declare(strict_types=1);

require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/notifications.php';

/* ============================== Палитра писем ============================== */

const RM_NAVY       = '#17307A';
const RM_NAVY_2     = '#24499F';
const RM_GOLD       = '#C79322';
const RM_GOLD_LIGHT = '#E3B94F';
const RM_INK        = '#1D2B55';
const RM_MUTED      = '#6B7699';
const RM_BG         = '#EEF1F8';
const RM_CARD       = '#F4F6FC';
const RM_LINE       = '#DCE3F3';

/* ============================== Кирпичики ================================= */

/** Золотая кнопка (таблица — стабильно в почтовых клиентах). */
function rm_mail_btn(string $href, string $label): string {
    return '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 8px;">'
        . '<tr><td style="border-radius:12px;background:' . RM_GOLD . ';background:linear-gradient(135deg,' . RM_GOLD . ',' . RM_GOLD_LIGHT . ');">'
        . '<a href="' . h($href) . '" style="display:inline-block;padding:14px 36px;color:' . RM_NAVY . ';'
        . 'text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.02em;border-radius:12px;">'
        . h($label) . '</a></td></tr></table>';
}

/** Строка «метка — значение» для карточки заявки. Пустые значения пропускаются. */
function rm_card_row(string $label, string $value): string {
    if (trim($value) === '') return '';
    return '<tr>'
        . '<td style="padding:6px 0;font-size:13px;color:' . RM_MUTED . ';vertical-align:top;white-space:nowrap;padding-right:18px;">' . h($label) . '</td>'
        . '<td style="padding:6px 0;font-size:14px;color:' . RM_INK . ';font-weight:600;vertical-align:top;">' . h($value) . '</td>'
        . '</tr>';
}

/**
 * Карточка данных заявки: ФИО, коллектив, возрастная категория, номинация,
 * преподаватель, учреждение, конкурсный номер. Шапка карточки — номер и дата.
 */
function rm_mail_app_card(array $a, array $c): string {
    $date = $a['created_at'] ? date('d.m.Y', strtotime((string) $a['created_at'])) : date('d.m.Y');
    $rows =
          rm_card_row('Конкурс', (string) ($c['name'] ?? ''))
        . rm_card_row('ФИО', (string) $a['full_name'])
        . rm_card_row('Название коллектива', (string) ($a['group_name'] ?? ''))
        . rm_card_row('Возрастная категория', (string) ($a['age_category'] ?? ''))
        . rm_card_row('Номинация', (string) ($a['nomination'] ?? ''))
        . rm_card_row('Преподаватель', (string) ($a['teacher'] ?? ''))
        . rm_card_row('Название учреждения', (string) ($a['institution'] ?? ''))
        . rm_card_row('Конкурсный номер', (string) ($a['work_title'] ?? ''));

    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
        . 'style="margin:0 0 22px;background:' . RM_CARD . ';border:1px solid ' . RM_LINE . ';border-radius:14px;">'
        . '<tr><td style="padding:20px 24px;">'
        . '<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' . RM_MUTED . ';margin-bottom:2px;">Данные заявки</div>'
        . '<div style="font-size:16px;font-weight:700;color:' . RM_NAVY . ';margin-bottom:12px;">'
        . 'Заявка №' . h((string) $a['number']) . ' <span style="font-weight:400;color:' . RM_MUTED . ';font-size:13px;">от ' . h($date) . '</span></div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table>'
        . '</td></tr></table>';
}

/**
 * Общий лейаут письма: синий градиент в шапке, золотая текстовая монограмма «ММ»,
 * название центра золотом, подвал с контактами из настроек.
 */
function rm_mail_layout(string $inner, string $preheader = ''): string {
    $org   = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
    $addr  = h((string) cfgv('org_address', ''));
    $phone = h((string) cfgv('org_phone', ''));
    $email = h((string) cfgv('org_email', ''));
    $hours = h((string) cfgv('org_hours', ''));
    $year  = (int) cfgv('year', (int) date('Y'));
    $pre   = h($preheader);
    $navy = RM_NAVY; $navy2 = RM_NAVY_2; $gold = RM_GOLD; $ink = RM_INK; $muted = RM_MUTED; $bg = RM_BG; $line = RM_LINE;

    $contacts = '';
    if ($addr  !== '') $contacts .= '<div style="margin-top:2px;">' . $addr . '</div>';
    if ($phone !== '') $contacts .= '<div style="margin-top:2px;">Телефон: ' . $phone . '</div>';
    if ($email !== '') $contacts .= '<div style="margin-top:2px;">Почта: ' . $email . '</div>';
    if ($hours !== '') $contacts .= '<div style="margin-top:2px;">Режим работы: ' . $hours . '</div>';

    return <<<HTML
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="x-apple-disable-message-reformatting">
<title>{$org}</title>
</head>
<body style="margin:0;padding:0;background:{$bg};font-family:'Segoe UI',Arial,Helvetica,sans-serif;color:{$ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{$pre}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{$bg};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#fdfdff;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(23,48,122,.16);">

  <tr>
    <td style="background:{$navy};background:linear-gradient(135deg,{$navy} 0%,{$navy2} 100%);padding:34px 40px 30px;text-align:center;">
      <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;">
        <tr><td align="center" style="width:64px;height:64px;border-radius:50%;border:2px solid {$gold};background:rgba(255,255,255,.07);text-align:center;vertical-align:middle;">
          <span style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:700;color:{$gold};letter-spacing:.04em;line-height:64px;">ММ</span>
        </td></tr>
      </table>
      <div style="margin-top:14px;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:700;color:{$gold};letter-spacing:.04em;line-height:1.35;">Культурный центр<br>«Музыкальный Мир»</div>
      <div style="margin-top:8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.75);">Конкурсы · Фестивали · Концерты</div>
    </td>
  </tr>

  <tr>
    <td style="padding:38px 42px 28px;font-size:15px;line-height:1.7;color:{$ink};">
      {$inner}
    </td>
  </tr>

  <tr><td style="padding:0 42px;"><div style="height:1px;background:{$line};"></div></td></tr>

  <tr>
    <td style="padding:24px 42px 32px;font-size:13px;line-height:1.65;color:{$muted};">
      <div style="font-weight:700;color:{$navy};font-size:14px;margin-bottom:6px;">{$org}</div>
      {$contacts}
      <div style="margin-top:16px;font-size:12px;color:#96A0BE;">Вы получили это письмо, так как участвуете в конкурсах центра.</div>
      <div style="margin-top:8px;font-size:12px;color:#A9B2CC;">© {$year} {$org}</div>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body>
</html>
HTML;
}

/* ========================= Письмо «Заявка принята» ========================= */

/**
 * Ставит в очередь письмо о принятии заявки №{номер}.
 * Возвращает true, если письмо поставлено в очередь.
 */
function application_mail_send(int $appId): bool {
    $a = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$a || trim((string) $a['email']) === '') return false;
    $c = one("SELECT * FROM competitions WHERE id=?", [(int) $a['competition_id']]) ?: [];

    $name  = trim((string) $a['full_name']);
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $num   = (string) $a['number'];
    $navy = RM_NAVY; $muted = RM_MUTED;

    $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.25;font-weight:700;color:' . $navy . ';">Заявка принята</h1>'
        . '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . '<p style="margin:0 0 20px;">Ваша заявка <b style="color:' . $navy . ';">№' . h($num) . '</b> на конкурс '
        . '«' . h((string) ($c['name'] ?? '')) . '» зарегистрирована и передана оргкомитету. '
        . 'О результатах мы сообщим письмом на этот адрес.</p>'
        . rm_mail_app_card($a, $c)
        . '<p style="margin:0 0 4px;color:' . $muted . ';font-size:14px;">Статус заявки, оплата и дипломы — в Вашем личном кабинете.</p>'
        . rm_mail_btn(url('/cabinet'), 'Личный кабинет');

    $subject = 'Заявка №' . $num . ' принята — КЦ «Музыкальный Мир»';
    $html = rm_mail_layout($inner, 'Заявка №' . $num . ' зарегистрирована. Детали и статус — в личном кабинете.');
    return mail_queue((string) $a['email'], $name, $subject, $html) > 0;
}

/* ========================= Письмо с результатом =========================== */

/** Подсказка по наградам в зависимости от результата (для платных конкурсов). */
function rm_award_hint(string $result): string {
    $r = mb_strtoupper($result);
    if (str_contains($r, 'ГРАН-ПРИ'))  return 'Обладателям Гран-при — наградной кубок в честь высшей награды конкурса.';
    if (str_contains($r, 'ЛАУРЕАТ'))   return 'Лауреатам конкурса — памятная статуэтка в честь Вашего звания.';
    if (str_contains($r, 'ДИПЛОМАНТ')) return 'Дипломантам конкурса — наградная медаль в честь Вашего звания.';
    return 'Для участников доступны памятные наградные материалы конкурса.';
}

/**
 * Строит и ставит в очередь письмо с результатом конкурса по заявке,
 * плюс создаёт in-app уведомление участнику.
 * Платный конкурс: срок наградных дипломов + блок заказа оригиналов наград.
 * Бесплатный: кнопка «Посмотреть результаты» на /results/{slug}.
 * Возвращает true, если письмо поставлено в очередь.
 */
function result_mail_send(int $appId): bool {
    $a = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$a) return false;
    $c = one("SELECT * FROM competitions WHERE id=?", [(int) $a['competition_id']]) ?: [];

    $result = trim((string) ($a['result'] ?? ''));
    if ($result === '') return false;

    $name   = trim((string) $a['full_name']);
    $hello  = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $extra  = trim((string) ($a['extra_diploma'] ?? ''));
    $jcomm  = trim((string) ($a['jury_comment'] ?? ''));
    $isPaid = (int) ($c['is_paid'] ?? 0) === 1;
    $navy = RM_NAVY; $navy2 = RM_NAVY_2; $gold = RM_GOLD; $muted = RM_MUTED; $card = RM_CARD; $line = RM_LINE;

    $inner = '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . '<p style="margin:0 0 20px;">Жюри подвело итоги конкурса «' . h((string) ($c['name'] ?? '')) . '». '
        . 'Благодарим Вас за участие — и с радостью объявляем результат.</p>';

    // Крупно результат — золотом на синем градиенте.
    $scoreLine = ($a['score'] !== null && $a['score'] !== '')
        ? '<div style="margin-top:8px;font-size:14px;color:rgba(255,255,255,.85);">Оценка жюри: '
          . h(number_format((float) $a['score'], 1, '.', '')) . ' из 10</div>'
        : '';
    $inner .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-radius:16px;overflow:hidden;">'
        . '<tr><td style="background:' . $navy . ';background:linear-gradient(135deg,' . $navy . ' 0%,' . $navy2 . ' 100%);padding:28px 26px;text-align:center;">'
        . '<div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:10px;">Ваш результат</div>'
        . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:30px;line-height:1.25;font-weight:800;color:' . $gold . ';letter-spacing:.03em;">' . h($result) . '</div>'
        . $scoreLine
        . '</td></tr></table>';

    // Дополнительный диплом.
    if ($extra !== '') {
        $inner .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            . 'style="margin:0 0 18px;background:#FBF4E1;border:1px solid #EAD9A8;border-radius:14px;">'
            . '<tr><td style="padding:16px 22px;text-align:center;">'
            . '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#A07A1E;margin-bottom:4px;">Дополнительный диплом</div>'
            . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:18px;font-weight:700;color:' . $gold . ';">' . h($extra) . '</div>'
            . '</td></tr></table>';
    }

    // Комментарий жюри.
    if ($jcomm !== '') {
        $inner .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            . 'style="margin:0 0 20px;background:' . $card . ';border-radius:14px;">'
            . '<tr><td style="width:4px;background:' . $gold . ';border-radius:14px 0 0 14px;"></td>'
            . '<td style="padding:16px 22px;">'
            . '<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' . $muted . ';margin-bottom:6px;">Комментарий жюри</div>'
            . '<div style="font-size:14px;line-height:1.7;color:' . RM_INK . ';font-style:italic;">«' . h($jcomm) . '»</div>'
            . '</td></tr></table>';
    }

    // Карточка данных заявки.
    $inner .= rm_mail_app_card($a, $c);

    if ($isPaid) {
        // Платный конкурс: сроки наградных дипломов + блок заказа оригиналов наград.
        $awardsUrl = url('/awards') . '?comp=' . (int) $a['competition_id'] . '&app=' . $appId;
        $inner .= '<p style="margin:0 0 20px;">Наградные дипломы придут на эту почту в течение '
            . '<b style="color:' . $navy . ';">5 рабочих дней</b> и появятся в личном кабинете.</p>'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" '
            . 'style="margin:0 0 8px;background:' . $card . ';border:1px solid ' . $line . ';border-radius:16px;">'
            . '<tr><td style="padding:24px 26px;text-align:center;">'
            . '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:19px;font-weight:700;color:' . $navy . ';margin-bottom:8px;">Закажите оригиналы наград</div>'
            . '<div style="font-size:14px;line-height:1.65;color:' . $muted . ';">' . h(rm_award_hint($result))
            . ' Награда с Вашим именем — памятное подтверждение успеха для дома, сцены и портфолио.</div>'
            . '<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:18px auto 2px;">'
            . '<tr><td style="border-radius:12px;background:' . $gold . ';background:linear-gradient(135deg,' . $gold . ',' . RM_GOLD_LIGHT . ');">'
            . '<a href="' . h($awardsUrl) . '" style="display:inline-block;padding:14px 36px;color:' . $navy . ';text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Заказать награды</a>'
            . '</td></tr></table>'
            . '</td></tr></table>';
    } else {
        // Бесплатный конкурс: страница результатов.
        $resultsUrl = url('/results/' . (string) ($c['slug'] ?? ''));
        $inner .= '<p style="margin:0 0 4px;color:' . $muted . ';font-size:14px;">Полный протокол конкурса — на странице результатов.</p>'
            . rm_mail_btn($resultsUrl, 'Посмотреть результаты');
    }

    $subject = 'Ваш результат — ' . $result;
    $pre  = 'Итоги конкурса «' . (string) ($c['name'] ?? '') . '»: ' . $result
        . ($extra !== '' ? ' + ' . $extra : '') . '.';
    $html = rm_mail_layout($inner, $pre);

    $queued = false;
    if (trim((string) $a['email']) !== '') {
        $queued = mail_queue((string) $a['email'], $name, $subject, $html) > 0;
    }

    // In-app уведомление участнику.
    $uid = (int) ($a['user_id'] ?? 0);
    if ($uid > 0) {
        $nBody = 'Конкурс «' . (string) ($c['name'] ?? '') . '», заявка №' . (string) $a['number'] . '.'
            . ($extra !== '' ? ' Дополнительный диплом: ' . $extra . '.' : '');
        $nUrl = $isPaid ? url('/cabinet#apps') : url('/results/' . (string) ($c['slug'] ?? ''));
        notify_user($uid, 'Ваш результат — ' . $result, $nBody, $nUrl, 'diploma');
    }

    return $queued;
}
