<?php
/**
 * ТЕСТ ВСЕХ ПОЧТОВЫХ ШАБЛОНОВ. Отправляет по одному реальному письму каждого типа
 * на указанный адрес (по умолчанию okoteam.top@gmail.com), используя БОЕВЫЕ функции
 * рендера. Транзакционные — с nagradi@, кампании-рассылки — с news@.
 * Пауза между письмами, чтобы Яндекс не троттлил.
 *
 * Запуск: php scripts/test_all_emails.php [email]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
define('MM_EMAIL_TEST_LIB', 1);              // библиотечный режим для cron-файлов
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/result_mail.php';
require_once BASE_PATH . '/core/mail_campaigns.php';
require_once BASE_PATH . '/core/diploma_render.php';
require_once BASE_PATH . '/cron/send_diplomas.php';          // _diploma_email_html (lib-режим)
require_once BASE_PATH . '/cron/award_order_reminders.php';  // award_reminder_html (lib-режим)
db();

$TO      = $argv[1] ?? 'okoteam.top@gmail.com';
$base    = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
$senders = mail_senders();
$nagradi = $senders['nagradi'] ?? [];
$news    = $senders['news'] ?? $nagradi;
if (!$nagradi) { fwrite(STDERR, "нет отправителя nagradi\n"); exit(1); }

$comps = all("SELECT * FROM competitions WHERE status='open' ORDER BY sort, id");
$paid  = null; $free = null;
foreach ($comps as $c) { if (!$paid && (int)$c['is_paid'] === 1) $paid = $c; if (!$free && (int)$c['is_paid'] !== 1) $free = $c; }
$anyComp = $comps[0] ?? ['id'=>0,'name'=>'Величие России','slug'=>'velichie-rossii'];
$paid = $paid ?: $anyComp; $free = $free ?: $anyComp;

$N = 0; $log = [];
$unsub = $base . '/unsubscribe?e=' . rawurlencode($TO);

// Фильтр «слать только эти номера» и пауза между письмами (для докидки упавших).
$ONLY = [];
$GAP  = 11;
foreach ($argv as $a) {
    if (str_starts_with($a, '--only=')) $ONLY = array_filter(array_map('intval', explode(',', substr($a, 7))));
    if (str_starts_with($a, '--gap='))  $GAP  = max(3, (int) substr($a, 6));
}

/**
 * Отправка БОЕВЫМ путём: mail_send_failover — та же цепочка ящиков и карантин, что
 * и на проде. Раньше тест бил в один жёстко заданный ящик, поэтому не проверял
 * главное — что письмо всё равно уходит, если основная почта не отвечает.
 * В отчёт пишем, с какого ящика ушло (и была ли автозамена).
 */
function tsend(string $to, string $subject, string $html, array $acc, string $fromName, array &$log, int &$N): void {
    global $ONLY, $GAP;
    $N++;
    if ($ONLY && !in_array($N, $ONLY, true)) return;   // докидываем только выбранные
    static $first = true;
    if (!$first) sleep($GAP);
    $first = false;
    $subj = '[ТЕСТ ' . $N . '] ' . $subject;
    $opt = ['account' => $acc, 'from_name' => $fromName];
    if (function_exists('mail_switched')) mail_switched('');
    $ok = function_exists('mail_send_failover')
        ? mail_send_failover($to, $subj, $html, $opt)
        : mail_send($to, $subj, $html, $opt);
    if (!$ok) {
        sleep($GAP + 6);
        $ok = function_exists('mail_send_failover')
            ? mail_send_failover($to, $subj, $html, $opt)
            : mail_send($to, $subj, $html, $opt);
    }
    $via = function_exists('mail_switched') ? mail_switched() : '';
    $why = (!$ok && function_exists('mail_last_error')) ? mail_last_error() : '';
    $log[] = sprintf("%2d. %-46s %s%s", $N, mb_substr($subject, 0, 46),
                     $ok ? 'OK' : 'FAIL',
                     $ok ? ($via !== '' ? '  (резервная почта: ' . $via . ')' : '')
                         : ('  ' . mb_substr($why, 0, 90)));
}

/** Рендер транзакционного письма через боевую функцию enqueue → достаём HTML из очереди. */
function render_via_queue(callable $enqueue): array {
    $before = (int) scalar("SELECT COALESCE(MAX(id),0) FROM mail_queue");
    $enqueue();
    $row = one("SELECT * FROM mail_queue WHERE id > ? ORDER BY id DESC LIMIT 1", [$before]);
    if ($row) { q("DELETE FROM mail_queue WHERE id=?", [(int)$row['id']]); return [(string)$row['subject'], (string)$row['body']]; }
    return ['', ''];
}

// ---- Временная заявка (для «Заявка принята» и «Результат») ----
function make_temp_app(array $comp, string $to, array $extra = []): int {
    $row = array_merge([
        'number'         => 'MM-' . date('Y') . '-' . strtoupper(substr(md5(uniqid('', true)), 0, 6)),
        'competition_id' => (int) ($comp['id'] ?? 0),
        'user_id'        => null,
        'email'          => $to,
        'full_name'      => 'Смирнова Екатерина Александровна',
        'nomination'     => 'Вокал (эстрадный)',
        'work_title'     => '«Я люблю тебя, Россия»',
        'teacher'        => 'Петрова Ольга Ивановна',
        'institution'    => 'ДШИ №1',
        'city'           => 'Казань',
        'age_category'   => '10–12 лет',
        'status'         => 'new',
        'is_paid'        => 0,
        'created_at'     => date('Y-m-d H:i:s'),
    ], $extra);
    return insert('applications', $row);
}

/* ============================ 1. ТРАНЗАКЦИОННЫЕ ============================ */

// 1) Заявка принята
$aid = make_temp_app($paid, $TO);
[$s, $h] = render_via_queue(fn() => application_mail_send($aid));
if ($h) tsend($TO, $s ?: 'Заявка принята', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);
q("DELETE FROM applications WHERE id=?", [$aid]);

// 2) Результат — ПЛАТНЫЙ конкурс (звание + заказ наград)
$aid = make_temp_app($paid, $TO, ['status'=>'graded','result'=>'ЛАУРЕАТ I СТЕПЕНИ','extra_diploma'=>'ЗА АРТИСТИЗМ','score'=>9.6,'jury_comment'=>'Яркое, artистичное исполнение, чистый вокал и отличная сценическая подача.','graded_at'=>date('Y-m-d H:i:s')]);
[$s, $h] = render_via_queue(fn() => result_mail_send($aid));
if ($h) tsend($TO, $s ?: 'Ваш результат (платный)', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);
q("DELETE FROM applications WHERE id=?", [$aid]);

// 3) Результат — БЕСПЛАТНЫЙ конкурс (страница результатов)
$aid = make_temp_app($free, $TO, ['status'=>'graded','result'=>'ДИПЛОМАНТ II СТЕПЕНИ','score'=>8.4,'graded_at'=>date('Y-m-d H:i:s')]);
[$s, $h] = render_via_queue(fn() => result_mail_send($aid));
if ($h) tsend($TO, $s ?: 'Ваш результат (бесплатный)', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);
q("DELETE FROM applications WHERE id=?", [$aid]);

// 4) Оплата получена
$h = mail_template('payment_success', [
    'name'=>'Даниэль','full_name'=>'Даниэль','amount'=>'1 200 ₽','payment_id'=>'test-pay-001','cabinet_url'=>$base.'/cabinet',
    '_tx'=>['preheader'=>'Оплата участия получена. Работа передана жюри.',
        'hero'=>mm_cta_primary($base.'/cabinet','Перейти в личный кабинет','Оплата подтверждена'),
        'actions'=>[['Другие конкурсы',$base.'/competitions'],['Оставить отзыв',$base.'/reviews']],'thanks'=>true]]);
tsend($TO, 'Оплата получена', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

// 5) Дожим: напоминание об оплате
$h = mail_template('reminder_payment', ['name'=>'Даниэль','competition'=>$paid['name'],'number'=>'MM-'.date('Y').'-AB12CD','cabinet_url'=>$base.'/cabinet',
    '_tx'=>['hero'=>mm_cta_primary($base.'/cabinet','Оплатить участие','Заявка ждёт оплаты'),'actions'=>[['Личный кабинет',$base.'/cabinet'],['Другие конкурсы',$base.'/competitions']]]]);
tsend($TO, 'Дожим: заявка ждёт оплаты', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

// 6) Дожим: заказ награды (short)
$h = mail_template('reminder_award', ['name'=>'Даниэль','competition'=>$paid['name'],'result'=>'ЛАУРЕАТ I СТЕПЕНИ','order_url'=>$base.'/awards?app=1',
    '_tx'=>['hero'=>mm_cta_primary($base.'/awards','Заказать наградной материал','По результату: ЛАУРЕАТ I СТЕПЕНИ'),'actions'=>[['Личный кабинет',$base.'/cabinet'],['Оставить отзыв',$base.'/reviews']]]]);
tsend($TO, 'Дожим: оформите награду', $h, $nagradi, 'Наградный отдел «Музыкальный Мир»', $log, $N);

// 7) Дожим: цепочка заказа наград (award_order_reminders — боевая функция)
$sampleA = ['full_name'=>'Смирнова Екатерина Александровна','result'=>'ГРАН-ПРИ','comp_name'=>$paid['name'],'graded_at'=>date('Y-m-d H:i:s', time()-3*86400),'created_at'=>date('Y-m-d H:i:s', time()-3*86400)];
if (function_exists('award_reminder_html')) {
    $h = award_reminder_html($sampleA, 57, $base.'/awards?app=1');
    tsend($TO, 'Дожим: не забудьте заказать награды', $h, $nagradi, 'Наградный отдел «Музыкальный Мир»', $log, $N);
}

// 8) Дожим: дедлайн приёма (массовый — маркет-лейаут с отпиской)
$h = mail_template('reminder_deadline', ['name'=>'Даниэль','competition'=>$paid['name'],'end_date'=>date('d.m.Y', time()+3*86400),'apply_url'=>$base.'/apply','preheader'=>'Приём заявок скоро закроется','unsubscribe_url'=>$unsub]);
tsend($TO, 'Дожим: осталось 3 дня (дедлайн)', $h, $news, 'Культурный центр «Музыкальный Мир»', $log, $N);

// 9) Напоминание о старте конкурса (календарь)
$h = mail_template('calendar_reminder', ['name'=>'Даниэль','competition'=>$paid['name'],'start_date'=>date('d.m.Y', time()+7*86400),'countdown'=>'стартует через 7 дней','comp_url'=>$base.'/competition/'.($paid['slug']??''),
    '_tx'=>['hero'=>mm_cta_primary($base.'/competition/'.($paid['slug']??''),'Открыть страницу конкурса','Приём заявок стартует через 7 дней'),'actions'=>[['Все конкурсы',$base.'/competitions'],['Календарь',$base.'/calendar']]]]);
tsend($TO, 'Напоминание: конкурс скоро стартует', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

/* ============================ 2. ДИПЛОМЫ ============================ */

// 10) Диплом основной
$h = _diploma_email_html(['comp_name'=>$paid['name'],'full_name'=>'Смирнова Екатерина Александровна','number'=>'MM-'.date('Y').'-D1PL0M','result'=>'ЛАУРЕАТ I СТЕПЕНИ','type'=>'main']);
tsend($TO, 'Ваш диплом (основной)', $h, $nagradi, 'Наградный отдел «Музыкальный Мир»', $log, $N);

// 11) Диплом дополнительный (спецноминация)
$h = _diploma_email_html(['comp_name'=>$paid['name'],'full_name'=>'Смирнова Екатерина Александровна','number'=>'MM-'.date('Y').'-D2PL0M','result'=>'ЗА АРТИСТИЗМ','type'=>'extra']);
tsend($TO, 'Ваш дополнительный диплом', $h, $nagradi, 'Наградный отдел «Музыкальный Мир»', $log, $N);

/* ============================ 3. АУТЕНТИФИКАЦИЯ / СЕРВИСНЫЕ ============================ */

// 12) Код подтверждения (OTP)
$h = mail_template('otp_code', ['name'=>'Даниэль','code'=>'482913','ttl_minutes'=>10]);
tsend($TO, 'Код подтверждения', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

// 13) Регистрация (подтверждение почты)
$h = mail_template('registration', ['name'=>'Даниэль','verify_url'=>$base.'/verify-email?token=demo']);
tsend($TO, 'Подтверждение регистрации', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

// 14) Приветствие
$h = mail_template('welcome', ['name'=>'Даниэль','full_name'=>'Даниэль','cta_url'=>$base.'/competitions']);
tsend($TO, 'Добро пожаловать', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

// 15) Подтверждение заявки (шаблон application_confirm)
$h = mail_template('application_confirm', ['name'=>'Даниэль','competition'=>$paid['name'],'number'=>'MM-'.date('Y').'-CONF01','nomination'=>'Вокал (эстрадный)','work_title'=>'«Я люблю тебя, Россия»','cabinet_url'=>$base.'/cabinet']);
tsend($TO, 'Подтверждение заявки (шаблон)', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

// 16) Результаты (шаблон results)
$h = mail_template('results', ['name'=>'Даниэль','competition'=>$paid['name'],'result'=>'ЛАУРЕАТ I СТЕПЕНИ','score'=>'9.6','results_url'=>$base.'/results/'.($paid['slug']??'')]);
tsend($TO, 'Результаты (шаблон)', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

// 17) Диплом (шаблон diploma)
$h = mail_template('diploma', ['name'=>'Даниэль','competition'=>$paid['name'],'result'=>'ЛАУРЕАТ I СТЕПЕНИ','diploma_number'=>'MM-'.date('Y').'-TPL777','diploma_url'=>$base.'/diploma/MM-'.date('Y').'-TPL777.pdf']);
tsend($TO, 'Диплом (шаблон)', $h, $nagradi, 'Наградный отдел «Музыкальный Мир»', $log, $N);

// 18) Универсальное уведомление (generic)
$h = mail_template('generic', ['name'=>'Даниэль','full_name'=>'Даниэль','title'=>'Важное уведомление','message'=>'Это пример универсального уведомления центра с кнопкой действия.','cta_text'=>'Перейти на сайт','cta_url'=>$base.'/']);
tsend($TO, 'Универсальное уведомление', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

// 19) Новый конкурс (шаблон new_competition)
$h = mail_template('new_competition', ['name'=>'Даниэль','competition'=>$paid['name'],'description'=>'Международный творческий конкурс с настоящими наградами и официальными дипломами.','start_date'=>date('d.m.Y'),'end_date'=>date('d.m.Y', time()+20*86400),'competition_url'=>$base.'/competition/'.($paid['slug']??'')]);
tsend($TO, 'Новый конкурс (шаблон)', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

/* ============================ 4. РАССЫЛКИ-КАМПАНИИ (news@) ============================ */
foreach (campaign_types() as $type => $label) {
    $c = campaign_build($type, ['subject'=>'Новости центра — свежий дайджест','body'=>'<p>Открыт приём заявок на новые конкурсы сезона. Успейте принять участие и получить награду.</p>']);
    $inner = str_replace('{{name}}', 'Даниэль', $c['body']);
    $h = mm_email_layout($inner, ['preheader'=>$c['subject'],'unsubscribe_url'=>$unsub,'audience_note'=>'Вы получили это письмо как участник/подписчик центра.']);
    tsend($TO, 'Рассылка: ' . $label, $h, $news, 'Культурный центр «Музыкальный Мир»', $log, $N);
}

/* ============================ 5. ОТЧЁТЫ (админ/владелец) ============================ */
// 20+) Месячный и годовой отчёты
$h = mail_template('monthly_report', ['month_title'=>'Август 2026','message'=>'Заявок: 1240 · Оплат: 890 · Новых участников: 760. Полный отчёт — в админке.','admin_url'=>$base.'/admin/']);
tsend($TO, 'Отчёт за месяц (админ)', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

$h = mail_template('annual_report', ['year'=>'2026','message'=>'Итоги года: 12 конкурсов, 15 400 участников, 9 800 дипломов.','report_url'=>$base.'/admin/']);
tsend($TO, 'Годовой отчёт (админ)', $h, $nagradi, 'Культурный центр «Музыкальный Мир»', $log, $N);

echo "Отправлено на $TO: $N писем\n" . implode("\n", $log) . "\n";
