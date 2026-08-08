<?php
/**
 * АУДИТ ЛОГИКИ (unit-уровень): статусы, скидки, награды, сроки, почтовые пулы, клуб.
 * Гоняется на ОТДЕЛЬНОЙ тестовой базе: MUZMIR_DB_PATH=/tmp/... php scripts/audit_logic.php
 * Ничего наружу не отправляет — только проверяет расчёты.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db','helpers','app_status','loyalty','orders','send_timing','club','mailer','newsletter','data'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}
db();

$FAIL = 0; $OK = 0; $section = '';
function sec(string $s): void { global $section; $section = $s; echo "\n=== $s ===\n"; }
function ok(string $what, $got = null): void { global $OK; $OK++; echo "  ok   $what" . ($got !== null ? "  [$got]" : '') . "\n"; }
function bad(string $what, $got = '', $exp = ''): void {
    global $FAIL; $FAIL++;
    echo "  FAIL $what" . ($got !== '' ? "  получено: $got" : '') . ($exp !== '' ? " ожидалось: $exp" : '') . "\n";
}
function is_eq(string $what, $got, $exp): void { (string)$got === (string)$exp ? ok($what, (string)$got) : bad($what, (string)$got, (string)$exp); }
function is_true(string $what, $cond, $info = ''): void { $cond ? ok($what, $info ?: null) : bad($what, (string)$info); }

/* ───────────────────────── 1. СКИДКИ И ЛОЯЛЬНОСТЬ ───────────────────────── */
sec('Скидки: потолки 5 / 5 / 10 / клуб');
is_eq('LOYALTY_MAX_PCT = 5', LOYALTY_MAX_PCT, 5);
is_eq('REFERRAL_MAX_PCT = 5', REFERRAL_MAX_PCT, 5);
is_eq('REFERRAL_REWARD_MAX_PCT = 5', REFERRAL_REWARD_MAX_PCT, 5);
is_eq('DISCOUNT_CAP_NO_CLUB = 10', DISCOUNT_CAP_NO_CLUB, 10);

$b = discount_breakdown(5, 5, 0);
is_eq('5% достижения + 5% промокод без клуба = 10%', $b['total'], 10);
$b = discount_breakdown(50, 50, 0);
is_eq('завышенные значения режутся до 10%', $b['total'], 10);
$b = discount_breakdown(5, 5, 20);
is_true('с клубом 20% сумма больше 10%', (int)$b['total'] > 10, (string)$b['total']);
$b = discount_breakdown(0, 0, 20);
is_eq('только клуб = 20%', $b['total'], 20);
$b = discount_breakdown(3, 0, 0);
is_eq('только достижения 3% = 3%', $b['total'], 3);

is_eq('loyalty_apply(500, 10) = 450', loyalty_apply(500, 10), 450);
is_eq('loyalty_apply(500, 0) = 500', loyalty_apply(500, 0), 500);
is_eq('сезон лояльности = текущий год', loyalty_season(), date('Y'));

$tiers = loyalty_tiers();
$max = 0; foreach ($tiers as $t) { $max = max($max, (int)($t['pct'] ?? $t[1] ?? 0)); }
is_true('максимальная ступень достижений <= 5%', $max <= 5, "макс $max%");

/* ───────────────────────── 2. СРОКИ ОТПРАВКИ ───────────────────────── */
sec('Сроки: рабочие дни, окно 09:00–18:00, воскресенье');
is_true('воскресенье не рабочий', !st_is_workday(new DateTime('2026-08-09')));   // вс
is_true('суббота рабочая',       st_is_workday(new DateTime('2026-08-08')));      // сб
is_true('понедельник рабочий',   st_is_workday(new DateTime('2026-08-10')));

// пятница 07.08.2026 + 3 рабочих = пн 10.08 (сб 08 = 1, вс 09 пропуск, пн 10 = 2, вт 11 = 3)
$d = working_days_add('2026-08-07 12:00:00', 3);
is_eq('пт + 3 рабочих дня = вт 11.08', $d->format('Y-m-d'), '2026-08-11');
$d = working_days_add('2026-08-07 12:00:00', 5);
is_eq('пт + 5 рабочих дней = чт 13.08', $d->format('Y-m-d'), '2026-08-13');
is_true('время попадает в утреннее окно 09:0x', (int)$d->format('G') === 9, $d->format('H:i'));

$slot = next_working_slot(new DateTime('2026-08-09 12:00:00'));   // воскресенье
is_eq('вс 12:00 → понедельник', $slot->format('Y-m-d'), '2026-08-10');
is_eq('вс → утро 09',           $slot->format('G'), '9');
$slot = next_working_slot(new DateTime('2026-08-10 06:00:00'));   // пн рано
is_eq('пн 06:00 → сегодня 09',  $slot->format('Y-m-d G'), '2026-08-10 9');
$slot = next_working_slot(new DateTime('2026-08-10 20:00:00'));   // пн поздно
is_eq('пн 20:00 → вторник 09',  $slot->format('Y-m-d G'), '2026-08-11 9');
$slot = next_working_slot(new DateTime('2026-08-10 11:00:00'));   // пн рабочее
is_eq('пн 11:00 → сейчас',      $slot->format('Y-m-d H'), '2026-08-10 11');
$slot = next_working_slot(new DateTime('2026-08-08 17:59:00'));   // сб конец окна
is_eq('сб 17:59 → сейчас',      $slot->format('Y-m-d H'), '2026-08-08 17');

// ВИП 3 дня против обычных 5 — награды строго быстрее
$vip = working_days_add('2026-08-03 10:00:00', 3);
$reg = working_days_add('2026-08-03 10:00:00', 5);
is_true('ВИП (3 дн) раньше обычного (5 дн)', $vip < $reg, $vip->format('d.m') . ' < ' . $reg->format('d.m'));

// result_plan_at
$p = result_plan_at('2026-08-03 10:00:00', false, '', 5);
is_true('без авто и без даты — моментально', abs($p->getTimestamp() - time()) < 5, $p->format('H:i:s'));
$p = result_plan_at('2026-08-03 10:00:00', false, '2027-01-15 14:30:00', 5);
is_eq('ручная дата соблюдается', $p->format('Y-m-d H:i'), '2027-01-15 14:30');
$p = result_plan_at(date('Y-m-d H:i:s'), true, '', 5);
is_true('авто: план не в прошлом', $p->getTimestamp() >= time() - 5, $p->format('d.m H:i'));
is_true('авто: план не ночью', (int)$p->format('G') >= 9 && (int)$p->format('G') < 18, $p->format('H:i'));

/* ───────────────────────── 3. НАГРАДЫ: ПРАВИЛА СОСТАВА ───────────────────────── */
sec('Награды: трофей строго по аттестационному результату');
is_eq('ГРАН-ПРИ → Кубок',    award_trophy_for_result('ГРАН-ПРИ'), 'Кубок');
is_eq('ЛАУРЕАТ I → Статуэтка', award_trophy_for_result('ЛАУРЕАТ I степени'), 'Статуэтка');
is_eq('ДИПЛОМАНТ → Медаль',  award_trophy_for_result('ДИПЛОМАНТ II степени'), 'Медаль');

foreach ([
    ['Кубок',     'ГРАН-ПРИ',             true,  'кубок при гран-при'],
    ['Статуэтка', 'ЛАУРЕАТ I степени',    true,  'статуэтка при лауреате'],
    ['Медаль',    'ДИПЛОМАНТ I степени',  true,  'медаль при дипломанте'],
    ['Кубок',     'ЛАУРЕАТ I степени',    false, 'кубок НЕ при лауреате'],
    ['Статуэтка', 'ДИПЛОМАНТ I степени',  false, 'статуэтка НЕ при дипломанте'],
    ['Медаль',    'ГРАН-ПРИ',             false, 'медаль НЕ при гран-при'],
] as [$item, $res, $expect, $label]) {
    [$allowed, $why] = award_item_allowed($item, 'original', $res, false);
    is_true($label, $allowed === $expect, $why);
}

sec('Награды: платный конкурс — оригиналы доступны, электронные осн./доп. нет');
foreach ([
    ['Основной диплом',       'original', true,  'платный: оригинал основного — можно'],
    ['Дополнительный диплом', 'original', true,  'платный: оригинал доп. — можно'],
    ['Именной диплом',        'original', true,  'платный: оригинал именного — можно'],
    ['Благодарность',         'original', true,  'платный: оригинал благодарности — можно'],
    ['Основной диплом',       'digital',  false, 'платный: электронный основной — НЕЛЬЗЯ (входит во взнос)'],
    ['Дополнительный диплом', 'digital',  false, 'платный: электронный доп. — НЕЛЬЗЯ (входит во взнос)'],
    ['Именной диплом',        'digital',  true,  'платный: электронный именной — можно (не входит)'],
    ['Благодарность',         'digital',  true,  'платный: электронная благодарность — можно'],
] as [$it, $k, $expect, $label]) {
    [$allowed, $why] = award_item_allowed($it, $k, 'ЛАУРЕАТ I степени', true);
    is_true($label, $allowed === $expect, $why);
}

sec('Награды: бесплатный конкурс — заказывается всё');
foreach ([['Основной диплом','digital'],['Дополнительный диплом','digital'],['Именной диплом','digital'],
          ['Благодарность','digital'],['Основной диплом','original'],['Именной диплом','original']] as [$it,$k]) {
    [$allowed, $why] = award_item_allowed($it, $k, 'ЛАУРЕАТ I степени', false);
    is_true("бесплатный: $it ($k) — можно", $allowed, $why);
}

sec('Награды: без аттестационного результата трофеи недоступны');
foreach (['Кубок','Статуэтка','Медаль'] as $it) {
    [$allowed, $why] = award_item_allowed($it, 'original', 'УЧАСТНИК', false);
    is_true("$it недоступен участнику без степени", !$allowed, $why);
}

sec('Награды: фильтр прайса (ключи «Позиция||вид»)');
$prices = [
    'Кубок||original'            => 3500,
    'Статуэтка||original'        => 2500,
    'Медаль||original'           => 1500,
    'Основной диплом||original'  => 900,
    'Основной диплом||digital'   => 300,
    'Именной диплом||digital'    => 300,
];
$f = array_keys(award_filter_prices($prices, 'ЛАУРЕАТ I степени', true));
is_true('платный+лауреат: нет кубка',               !in_array('Кубок||original', $f, true), implode(', ', $f));
is_true('платный+лауреат: нет медали',              !in_array('Медаль||original', $f, true));
is_true('платный+лауреат: есть статуэтка',           in_array('Статуэтка||original', $f, true));
is_true('платный+лауреат: нет электр. основного',   !in_array('Основной диплом||digital', $f, true));
is_true('платный+лауреат: есть оригинал основного',  in_array('Основной диплом||original', $f, true));
is_true('платный+лауреат: есть электр. именной',     in_array('Именной диплом||digital', $f, true));
$f2 = array_keys(award_filter_prices($prices, 'ГРАН-ПРИ', false));
is_true('бесплатный+гран-при: есть кубок',           in_array('Кубок||original', $f2, true), implode(', ', $f2));
is_true('бесплатный+гран-при: есть электр. основной', in_array('Основной диплом||digital', $f2, true));

/* ───────────────────────── 4. ПОЧТОВЫЕ ПУЛЫ ───────────────────────── */
sec('Почта: разделение пулов (массовые ≠ личные)');
$bulk = mail_pool_names('bulk');
$awd  = mail_pool_names('awards');
$tx   = mail_pool_names('tx');
is_true('массовые: только news/news2', $bulk === ['news', 'news2'], implode(',', $bulk));
is_true('массовые: НЕТ основного ящика (kulturniy.centr)', !in_array('main', $bulk, true), implode(',', $bulk));
is_true('массовые: НЕТ ящика наград (nagradi@домен)', !in_array('nagradi', $bulk, true), implode(',', $bulk));
is_true('награды: цепочка из 3 ящиков', count($awd) >= 3, implode(',', $awd));
is_true('транзакционные: основной первым', ($tx[0] ?? '') === 'main', implode(',', $tx));

is_eq('массовая рассылка → пул bulk',  mail_pool_for(['priority' => 5, 'subject' => 'Стартовал конкурс']), 'bulk');
is_eq('диплом → пул awards',           mail_pool_for(['priority' => 0, 'subject' => 'Ваш диплом победителя']), 'awards');
is_eq('регистрация → пул tx',          mail_pool_for(['priority' => 0, 'subject' => 'Подтверждение регистрации']), 'tx');
is_eq('результат → пул tx (личное, официальная почта)',
      mail_pool_for(['priority' => 0, 'subject' => 'Результаты конкурса']), 'tx');
is_eq('наградные документы → пул awards',
      mail_pool_for(['priority' => 0, 'subject' => 'Наградные документы готовы']), 'awards');

/* ───────────────────────── 5. СТОП-КРАН МАССОВЫХ ───────────────────────── */
sec('Стоп-кран массовых рассылок');
$was = mass_sending_enabled();
mass_sending_set(false);
is_true('выключено → mass_sending_enabled() = false', !mass_sending_enabled());
mass_sending_set(true);
is_true('включено → mass_sending_enabled() = true', mass_sending_enabled());
mass_sending_set($was);
is_true('исходное состояние восстановлено', mass_sending_enabled() === $was, $was ? 'вкл' : 'выкл');

/* ───────────────────────── 6. ВИП-КЛУБ ───────────────────────── */
sec('ВИП-клуб: команда, скидка, привилегии');
$staff = club_staff_emails();
is_true('оргкомитет okoteam.top@gmail.com в команде', club_is_staff_email('okoteam.top@gmail.com'), implode(', ', $staff));
is_true('владелец zamis76@mail.ru в команде',        club_is_staff_email('zamis76@mail.ru'));
is_true('посторонний НЕ в команде',                  !club_is_staff_email('random@example.com'));
is_true('регистр не важен',                          club_is_staff_email('OkoTeam.Top@Gmail.com'));
is_eq('скидка клуба = 20%', mm_vip_discount(), 20);

/* ───────────────────────── 7. СТАТУСЫ ЗАЯВКИ ───────────────────────── */
sec('Статусы: лестница вычисляется из фактов');
$base = ['id' => 0, 'status' => 'new', 'result' => '', 'result_sent_at' => '', 'result_send_at' => ''];
is_eq('нет результата → Новая', app_state($base)['code'], 'new');
is_eq('результат есть, письмо не ушло → На оценке',
      app_state(array_merge($base, ['result' => 'ЛАУРЕАТ I степени', 'result_send_at' => '2026-08-10 09:15:00']))['code'], 'judging');
is_eq('письмо ушло → Оценена',
      app_state(array_merge($base, ['result' => 'ЛАУРЕАТ I степени', 'result_sent_at' => '2026-08-10 09:15:00']))['code'], 'graded');
is_eq('отклонена', app_state(array_merge($base, ['status' => 'rejected']))['code'], 'rejected');
$st = app_state(array_merge($base, ['result' => 'ЛАУРЕАТ I степени', 'result_send_at' => '2026-08-10 09:15:00']));
is_true('в подписи «На оценке» указана дата отправки', str_contains($st['detail'], '10.08.2026'), $st['detail']);

// Длинный конкурс: до публикации участник результата не видит, админ видит
$long = array_merge($base, ['result' => 'ЛАУРЕАТ I степени', 'result_sent_at' => '2026-08-28 09:00:00',
                            'comp_results_mode' => 'list', 'comp_results_pub' => '']);
is_eq('длинный до публикации: участник видит «Новая»', app_state($long, false)['code'], 'new');
is_eq('длинный до публикации: админ видит «Оценена»',  app_state($long, true)['code'], 'graded');
$long['comp_results_pub'] = '2026-08-28 12:00:00';
is_eq('длинный после публикации: участник видит «Оценена»', app_state($long, false)['code'], 'graded');

$labels = app_state_labels();
foreach (['new','judging','graded','making','made','extra','done','rejected'] as $c) {
    is_true('метка статуса «' . $c . '» задана', isset($labels[$c]) && $labels[$c][0] !== '', $labels[$c][0] ?? '');
}

/* ───────────────────────── 8. ФОРМЫ ИСПОЛНЕНИЯ ПО НОМИНАЦИЯМ ───────────────────────── */
sec('Формы исполнения строго по номинации');
$map = FORMATIONS_MAP();
is_true('карта форм не пуста', count($map) > 0, count($map) . ' номинаций');
$hor = FORMATIONS_FOR('Хореография');
is_true('Хореография: есть Соло', in_array('Соло', $hor, true), implode(', ', $hor));
is_true('Хореография: НЕТ «Хор»', !in_array('Хор', $hor, true), implode(', ', $hor));
$voc = FORMATIONS_FOR('Вокальное искусство');
is_true('Вокальное искусство: есть Хор', in_array('Хор', $voc, true), implode(', ', $voc));
is_true('Изобразительное: нет Соло',
        !in_array('Соло', FORMATIONS_FOR('Изобразительное искусство'), true),
        implode(', ', FORMATIONS_FOR('Изобразительное искусство')));
foreach (array_keys($map) as $nom) {
    is_true('«' . $nom . '»: список форм не пуст', count(FORMATIONS_FOR($nom)) > 0,
            implode(', ', array_slice(FORMATIONS_FOR($nom), 0, 3)) . '…');
}
is_true('неизвестная номинация — универсальный набор', count(FORMATIONS_FOR('Чего-то нет')) > 0);

/* ───────────────────────── ИТОГ ───────────────────────── */
echo "\n" . str_repeat('─', 60) . "\n";
echo $FAIL === 0 ? "ВСЁ ЧИСТО: $OK проверок пройдено\n" : "ПРОВАЛОВ: $FAIL, пройдено: $OK\n";
exit($FAIL === 0 ? 0 : 1);
