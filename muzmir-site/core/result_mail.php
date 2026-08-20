<?php
/**
 * Фирменные транзакционные письма Культурного центра «Музыкальный Мир»:
 *  - application_mail_send() — письмо «Заявка принята» (вызов из api/v1/apply.php);
 *  - result_mail_send()      — письмо с результатом конкурса + in-app уведомление
 *                              (вызов из admin/grading.php для платных конкурсов).
 * Дизайн: единый фирменный лейаут mm_email_layout() (core/mailer.php) — логотип
 * центра на синем градиенте #17307A→#24499F, золотые кнопки, подвал с контактами
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

/** Золотая кнопка (таблица — стабильно в почтовых клиентах). Единый стиль — mm_email_btn(). */
function rm_mail_btn(string $href, string $label): string {
    return mm_email_btn($href, $label, 'gold');
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
    return mm_email_layout($inner, [
        'preheader'     => $preheader,
        'audience_note' => 'Вы получили это письмо, так как участвуете в конкурсах центра.',
    ]);
}

/* ========================= Письмо «Заявка принята» ========================= */

/**
 * Ставит в очередь письмо о принятии заявки №{номер}.
 * $paid=true — заявка принята ПОСЛЕ подтверждения оплаты (платный конкурс): в письме
 * добавляется зелёная плашка «Оплата получена» (вызывается из core/payments.php).
 * $paid=false — бесплатная заявка, принимается сразу (вызов из api/v1/apply.php).
 * Возвращает true, если письмо поставлено в очередь.
 */
function application_mail_send(int $appId, bool $paid = false): bool {
    $a = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$a || trim((string) $a['email']) === '') return false;
    $c = one("SELECT * FROM competitions WHERE id=?", [(int) $a['competition_id']]) ?: [];

    $name  = trim((string) $a['full_name']);
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $num   = (string) $a['number'];
    $navy = RM_NAVY; $muted = RM_MUTED;

    // Плашка «Оплата получена» — только для платной заявки, принятой после оплаты.
    $paidBadge = $paid
        ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#EAF7EE;border:1px solid #BFE6C9;border-radius:14px;">'
          . '<tr><td style="width:4px;background:#2E9E4F;border-radius:14px 0 0 14px;"></td>'
          . '<td style="padding:13px 20px;font-size:13.5px;line-height:1.6;color:#1E6B36;">'
          . '<b style="color:#2E9E4F;letter-spacing:.03em;">ЗАЯВКА НА УЧАСТИЕ ПРИНЯТА.</b> Оргвзнос зачислен, заявка передана жюри. '
          . 'Спасибо за участие!</td></tr></table>'
        : '';

    $lead = $paid
        ? 'Ваша заявка <b style="color:' . $navy . ';">№' . h($num) . '</b> на конкурс «' . h((string) ($c['name'] ?? '')) . '» '
          . 'оплачена, принята и передана жюри. О результатах мы сообщим письмом на этот адрес.'
        : 'Ваша заявка <b style="color:' . $navy . ';">№' . h($num) . '</b> на конкурс «' . h((string) ($c['name'] ?? '')) . '» '
          . 'зарегистрирована и передана оргкомитету. О результатах мы сообщим письмом на этот адрес.';

    $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:26px;line-height:1.25;font-weight:700;color:' . $navy . ';">Заявка принята</h1>'
        . '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . $paidBadge
        . '<p style="margin:0 0 20px;">' . $lead . '</p>'
        . rm_mail_app_card($a, $c)
        . '<p style="margin:0 0 4px;color:' . $muted . ';font-size:14px;">Статус заявки, оплата и дипломы - в Вашем личном кабинете. '
        . 'Вы можете принять участие и в других конкурсах центра - заявки объединяются в одну оплату.</p>';

    $subject = 'Заявка №' . $num . ' принята - Культурный центр «Музыкальный Мир»';

    // Если конкурс платный, а взнос ещё не поступил — главная кнопка письма ведёт
    // ПРЯМО на оплату этой заявки (форма ЮKassa), а не в общий кабинет: искать свой
    // счёт руками человек не должен.
    $needsPay = !$paid && (int) ($c['is_paid'] ?? 0) === 1 && (int) ($a['is_paid'] ?? 0) !== 1;
    if ($needsPay && !function_exists('pay_link_app')) require_once BASE_PATH . '/core/paylink.php';
    $hero = $needsPay
        ? mm_cta_primary(pay_link_app($appId), 'Оплатить участие', 'Заявка №' . $num . ' · ' . (int) ($c['price'] ?? 0) . ' ₽')
        : mm_cta_primary(url('/cabinet'), 'Открыть личный кабинет', 'Статус заявки · оплата · дипломы');

    $html = mm_email_tx($inner, [
        'preheader' => 'Заявка №' . $num . ($paid ? ' оплачена и принята.' : ' зарегистрирована.') . ' Детали и статус - в личном кабинете.',
        'hero'      => $hero,
        // «Другие конкурсы» убрана — в подвале письма уже есть кнопка «Другие конкурсы центра».
        'actions'   => $needsPay
            ? [['Личный кабинет', url('/cabinet')], ['Оставить отзыв', url('/reviews')]]
            : [['Оставить отзыв', url('/reviews')]],
    ]);
    return mail_queue((string) $a['email'], $name, $subject, $html) > 0;
}

/* ========================= Письмо с результатом =========================== */

/** Короткое название рекомендованного оригинала награды по результату. */
function rm_award_name(string $result): string {
    $r = mb_strtoupper($result);
    if (str_contains($r, 'ГРАН-ПРИ'))  return 'кубок Гран-при';
    if (str_contains($r, 'ЛАУРЕАТ'))   return 'статуэтка лауреата';
    if (str_contains($r, 'ДИПЛОМАНТ')) return 'медаль дипломанта';
    return 'наградные материалы';
}

/** Подсказка по наградам в зависимости от результата (для платных конкурсов). */
require_once BASE_PATH . '/core/award_offer.php';   // снимки и цены наград по званию

function rm_award_hint(string $result): string {
    $r = mb_strtoupper($result);
    if (str_contains($r, 'ГРАН-ПРИ'))  return 'Обладателям Гран-при - наградной кубок в честь высшей награды конкурса.';
    if (str_contains($r, 'ЛАУРЕАТ'))   return 'Лауреатам конкурса - памятная статуэтка в честь Вашего звания.';
    if (str_contains($r, 'ДИПЛОМАНТ')) return 'Дипломантам конкурса - наградная медаль в честь Вашего звания.';
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
        . '<p style="margin:0 0 18px;">Жюри подвело итоги конкурса «' . h((string) ($c['name'] ?? '')) . '». '
        . 'С радостью объявляем Ваш результат.</p>';

    // Блок ВНИМАНИЕ (как в ручных письмах центра) — про наградной материал в стоимости участия.
    if ($isPaid) {
        $inner .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#FFF6F4;border:1px solid #F0C9C0;border-radius:14px;">'
            . '<tr><td style="width:4px;background:#C0392B;border-radius:14px 0 0 14px;"></td>'
            . '<td style="padding:14px 20px;font-size:13.5px;line-height:1.6;color:#7A2E22;">'
            . '<b style="color:#C0392B;letter-spacing:.04em;">ВНИМАНИЕ.</b> Рассылка наградного материала (электронный основной диплом, '
            . 'электронный дополнительный - при наличии), включённого в стоимость участия (оргвзнос), осуществляется в течение '
            . '<b>5 рабочих дней</b> на электронную почту, указанную в заявке. По желанию - оригиналы наград (кубок/статуэтка/медаль, '
            . 'диплом и благодарность педагогу) Почтой России.</td></tr></table>';
    }

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

    $reviewsUrl = url('/reviews');
    $cabinetUrl = url('/cabinet');
    if ($isPaid) {
        // Платный конкурс: сроки наградных дипломов + блок заказа оригиналов наград.
        $awardsUrl = url('/awards') . '?comp=' . (int) $a['competition_id'] . '&app=' . $appId;
        $inner .= '<p style="margin:0 0 14px;">Наградные дипломы придут на эту почту в течение '
            . '<b style="color:' . $navy . ';">5 рабочих дней</b> и появятся в личном кабинете.</p>'
            . '<p style="margin:0 0 8px;font-size:14px;color:' . RM_INK . ';line-height:1.65;">' . h(rm_award_hint($result))
            . ' Награда с Вашим именем - памятное подтверждение успеха для дома, сцены и портфолио.</p>'
            // Дальше не описание словами, а сами награды: снимки того, что придёт
            // по почте, и цены по этому званию.
            . ao_block((int) $a['competition_id'], $result, $awardsUrl);
        $hero = mm_cta_primary($awardsUrl, 'Заказать награды', 'По результату: ' . rm_award_name($result));
        // Кнопки как в ручном письме центра: Образцы наград ЭТОГО конкурса / Сроки / Отзыв.
        $awardsSamplesUrl = url('/awards') . '?comp=' . (int) $a['competition_id'];
        $actions = [['Образцы наград конкурса', $awardsSamplesUrl], ['Сроки изготовления', $awardsSamplesUrl], ['Оставить отзыв', $reviewsUrl]];
    } else {
        // Бесплатный конкурс: страница результатов.
        $resultsUrl = url('/results/' . (string) ($c['slug'] ?? ''));
        $inner .= '<p style="margin:0 0 4px;color:' . $muted . ';font-size:14px;">Полный протокол конкурса - на странице результатов.</p>';
        $hero = mm_cta_primary($resultsUrl, 'Посмотреть результаты конкурса', 'Протокол и звания участников');
        $actions = [['Личный кабинет', $cabinetUrl], ['Оставить отзыв', $reviewsUrl]];
    }

    $subject = 'Ваш результат - ' . $result;
    $pre  = 'Итоги конкурса «' . (string) ($c['name'] ?? '') . '»: ' . $result
        . ($extra !== '' ? ' + ' . $extra : '') . '.';
    $html = mm_email_tx($inner, [
        'preheader' => $pre,
        'hero'      => $hero,
        'actions'   => $actions,
        'thanks'    => true,
    ]);

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
        notify_user($uid, 'Ваш результат - ' . $result, $nBody, $nUrl, 'diploma');
    }

    return $queued;
}

/**
 * ПЕРСОНАЛЬНОЕ письмо результата для ДЛИННОГО конкурса (results_mode='list').
 * Отправляется КАЖДОМУ участнику отдельно (как по короткому), НЕ 1:1 с ВК-постом:
 *   • афиша «РЕЗУЛЬТАТЫ КОНКУРСА» сверху; результат + карточка заявки;
 *   • кнопки: заказать наградной материал (раздел наград конкурса), список результатов
 *     на сайте, список результатов в ВК; вложение — файл списка результатов (DOCX);
 *   • НИКАКОЙ кнопки «Подать заявку»; + in-app/колокол уведомление участнику.
 * @param int    $appId     заявка участника
 * @param string $vkUrl     ссылка на ВК-пост/сообщество с общим списком
 * @param string $docxAbs   абсолютный путь к файлу списка (вложение), '' — без вложения
 * @param string $docxUrl   публичный URL файла списка (для кнопки «Скачать»), '' — без кнопки
 * @param string $posterUrl URL афиши «РЕЗУЛЬТАТЫ КОНКУРСА» (сверху письма), '' — без афиши
 */
function results_long_mail_send(int $appId, string $vkUrl = '', string $docxAbs = '', string $docxUrl = '', string $posterUrl = ''): bool {
    $a = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$a) return false;
    $c = one("SELECT * FROM competitions WHERE id=?", [(int) $a['competition_id']]) ?: [];
    $result = trim((string) ($a['result'] ?? ''));
    if ($result === '') return false;

    [$subject, $html] = results_long_mail_html($a, $c, $vkUrl, $docxUrl, $posterUrl);

    $queued = false;
    $whoName = trim((string) ($a['group_name'] ?? '')) !== '' ? trim((string) $a['group_name']) : trim((string) ($a['full_name'] ?? ''));
    if (trim((string) ($a['email'] ?? '')) !== '') {
        $queued = mail_queue((string) $a['email'], $whoName, $subject, $html, $docxAbs) > 0;
    }
    // In-app + колокол.
    $uid = (int) ($a['user_id'] ?? 0);
    if ($uid > 0) {
        notify_user($uid, 'Результаты конкурса «' . (string) ($c['name'] ?? '') . '» - ' . $result,
            'Заявка №' . (string) $a['number'] . '. Списки результатов - на сайте и в ВК. Можно заказать наградной материал.',
            url('/results/' . (string) ($c['slug'] ?? '')), 'trophy');
    }
    return $queued;
}

/**
 * Чистая сборка HTML персонального письма результата длинного конкурса (для отправки И
 * для предпросмотра). Возвращает [subject, html]. Без «Подать заявку».
 */
function results_long_mail_html(array $a, array $c, string $vkUrl = '', string $docxUrl = '', string $posterUrl = ''): array {
    $result = trim((string) ($a['result'] ?? '')) ?: 'ЛАУРЕАТ I СТЕПЕНИ';
    $navy = RM_NAVY; $navy2 = RM_NAVY_2; $gold = RM_GOLD;
    $whoName = trim((string) ($a['group_name'] ?? '')) !== '' ? trim((string) $a['group_name']) : trim((string) ($a['full_name'] ?? ''));
    $hello = $whoName !== '' ? 'Здравствуйте, ' . h($whoName) . '!' : 'Здравствуйте!';
    $extra = trim((string) ($a['extra_diploma'] ?? ''));

    $inner = '';
    // Афиша «РЕЗУЛЬТАТЫ КОНКУРСА» сверху.
    if ($posterUrl !== '') {
        $inner .= '<div style="margin:0 0 20px;text-align:center;"><img src="' . h($posterUrl) . '" alt="Результаты конкурса" style="max-width:100%;border-radius:14px;border:1px solid ' . RM_LINE . ';"></div>';
    }
    $inner .= '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . '<p style="margin:0 0 18px;">Культурный центр «Музыкальный Мир» подвёл итоги конкурса «' . h((string) ($c['name'] ?? '')) . '». '
        . 'С радостью объявляем Ваш результат.</p>';
    // Крупно результат.
    $inner .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-radius:16px;overflow:hidden;">'
        . '<tr><td style="background:' . $navy . ';background:linear-gradient(135deg,' . $navy . ' 0%,' . $navy2 . ' 100%);padding:28px 26px;text-align:center;">'
        . '<div style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:10px;">Ваш результат</div>'
        . '<div style="font-family:Georgia,serif;font-size:30px;line-height:1.25;font-weight:800;color:' . $gold . ';letter-spacing:.03em;">' . h($result) . '</div>'
        . '</td></tr></table>';
    if ($extra !== '') {
        $inner .= '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#FBF4E1;border:1px solid #EAD9A8;border-radius:14px;">'
            . '<tr><td style="padding:16px 22px;text-align:center;">'
            . '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#A07A1E;margin-bottom:4px;">Дополнительный диплом</div>'
            . '<div style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:' . $gold . ';">' . h($extra) . '</div>'
            . '</td></tr></table>';
    }
    $inner .= rm_mail_app_card($a, $c);
    $inner .= '<p style="margin:14px 0 0;color:' . RM_MUTED . ';font-size:14px;">Полный список результатов конкурса - на сайте, в нашем сообществе ВКонтакте и во вложении к этому письму.</p>';

    // Кнопки: заказать награды (hero) + список на сайте + список в ВК + скачать файл.
    $awardsUrl  = url('/awards') . '?comp=' . (int) $a['competition_id'];
    $resultsUrl = url('/results/' . (string) ($c['slug'] ?? ''));
    $hero = mm_cta_primary($awardsUrl, 'Заказать наградной материал', 'Кубки, медали, оригиналы дипломов по результату');
    $actions = [['Список результатов на сайте', $resultsUrl]];
    if ($vkUrl !== '')  $actions[] = ['Список результатов в ВКонтакте', $vkUrl];
    if ($docxUrl !== '') $actions[] = ['Скачать список результатов (DOCX)', $docxUrl];
    $actions[] = ['Оставить отзыв', url('/reviews')];

    $subject = 'Результаты конкурса «' . (string) ($c['name'] ?? '') . '» - ' . $result;
    $html = mm_email_tx($inner, [
        'preheader' => 'Итоги конкурса «' . (string) ($c['name'] ?? '') . '»: ' . $result . '.',
        'hero'      => $hero,
        'actions'   => $actions,
        'thanks'    => true,
    ]);
    return [$subject, $html];
}
