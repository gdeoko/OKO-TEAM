<?php
/**
 * scripts/audit_outreach.php — НАРУЖУ УХОДИТ ТОЛЬКО ПО ДЕЙСТВУЮЩЕМУ КОНКУРСУ
 * И ТОЛЬКО В РАБОЧЕЕ ОКНО.
 *
 * Заведён 14.10.2026 после срочной правки владельца: «Идут рассылки и
 * публикация в ВК и по почтам о конкурсе „Мировые таланты", который уже
 * закрыт». Проверка держит три вещи, каждая из которых в тот день подвела.
 *
 *   1. ЗАПИСИ РОТАЦИИ ВК не зовут на конкурс с кончившимся приёмом. В наборе
 *      стояли четыре августовских конкурса, и крон разносил их по чужим
 *      сообществам: 176 публикаций за неделю.
 *   2. ВОЛНЫ РАССЫЛКИ не бывают по закрытому конкурсу. 14.10 по всей базе ушло
 *      5943 письма «Открыт приём заявок: Мировые Таланты» (приём кончился
 *      25.08), ещё 1847 стояли в очереди.
 *   3. У КАЖДОГО НАРУЖНОГО КРОНА есть проверка рабочего окна. У трёх её не
 *      было вовсе: личные сообщения ВК, отложенные афиши и письма в ведомства.
 *
 * Запуск: php scripts/audit_outreach.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'comp_now', 'outreach_window'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';
db();

$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, string $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, string $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, bool $c, string $i = ''): void { $c ? ok($w, $i) : bad($w, $i); }

sec('Действующие конкурсы (один источник: core/comp_now.php)');
$open = comps_open_now();
chk('приём идёт хотя бы по одному конкурсу', count($open) > 0, count($open) . ' шт.');
foreach ($open as $c) ok('идёт: ' . (string) $c['name'], (string) $c['start_date'] . '..' . (string) $c['end_date']);
$закрытыеOpen = all("SELECT id,name,end_date FROM competitions
                      WHERE status='open' AND COALESCE(end_date,'')<>''
                        AND date(end_date) < date('now','localtime')");
foreach ($закрытыеOpen as $c)
    bad('конкурс в статусе open, а приём кончился', '#' . (int) $c['id'] . ' «' . (string) $c['name']
        . '», до ' . (string) $c['end_date'] . ' - ночной крон статус ещё не переключил, наружу его звать нельзя');
if (!$закрытыеOpen) ok('ни один конкурс с кончившимся приёмом не стоит в статусе open');

sec('Записи ротации ВКонтакте не зовут на закрытый конкурс');
$ротация = [];
try { $ротация = all("SELECT slot,kind,title,text,active FROM vk_posts ORDER BY slot"); } catch (\Throwable $e) {}
if (!$ротация) { ok('набор ротации пуст — звать нечем'); }
foreach ($ротация as $p) {
    $закр = comp_closed_slugs_in((string) $p['text']);
    $имя = 'слот ' . (int) $p['slot'] . ' «' . (string) $p['title'] . '»';
    if (!$закр) { ok($имя . ' — годен'); continue; }
    /* Выключенная запись беды не делает, но и в наборе ей не место: следующий
       месяц принесёт новые конкурсы, а эта так и будет лежать «на всякий». */
    if ((int) $p['active'] === 1) bad($имя . ' ВКЛЮЧЁН и зовёт на закрытый конкурс', implode(', ', $закр));
    else ok($имя . ' выключен (конкурс закрыт)', implode(', ', $закр));
}
/* Главное: что код ПРАВДА возьмёт в ротацию. Галочка `active` ручная, заслон
   постоянный - проверяем заслон, а не галочку. */
if (is_file(BASE_PATH . '/core/vk_promo.php')) {
    require_once BASE_PATH . '/core/vk_promo.php';
    $возьмёт = function_exists('vkp_posts') ? vkp_posts() : [];
    $плохо = 0;
    foreach ($возьмёт as $p) if (comp_closed_slugs_in((string) $p['text'])) $плохо++;
    chk('заслон не пускает закрытые конкурсы в ротацию', $плохо === 0,
        'в ротации ' . count($возьмёт) . ', с закрытыми ' . $плохо);
}

sec('Волны рассылки: ни одной по конкурсу с кончившимся приёмом');
$волны = all("SELECT id,subject,status,stats_sent,created_at FROM newsletters ORDER BY id DESC LIMIT 40");
$беды = 0;
foreach ($волны as $n) {
    /* Волна зовёт на конкурс названием в теме: «Открыт приём заявок: <имя>».
       Сверяем имя с действующими - так ловится ровно то, что случилось 14.10. */
    if (!preg_match('~Открыт приём заявок:\s*(.+)$~u', (string) $n['subject'], $m)) continue;
    $имя = trim($m[1]);
    $идёт = false;
    foreach ($open as $c) if (mb_strtolower((string) $c['name']) === mb_strtolower($имя)) $идёт = true;
    if ($идёт) { ok('волна #' . (int) $n['id'] . ' зовёт на идущий конкурс', $имя); continue; }

    /* ЖИВАЯ БЕДА И СЛЕД ПРОШЕДШЕЙ — РАЗНЫЕ ВЕЩИ.
     *
     * Волна #5 от 14.10.2026 («Мировые Таланты») останется в базе навсегда: это
     * запись о том, что случилось, и стирать её нельзя. Но краснеть на ней
     * каждый прогон значит приучить к красному и не заметить следующую. Опасна
     * волна, которая ещё МОЖЕТ отправить: не дошла до `sent` или держит письма
     * в очереди. Остальное - след, он называется замечанием. */
    $живая = in_array((string) $n['status'], ['sending', 'draft', ''], true);
    $вОчереди = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                                WHERE newsletter_id=? AND status IN ('queued','paused')",
                              [(int) $n['id']]) ?? 0);
    if ($живая || $вОчереди > 0) {
        $беды++;
        bad('волна #' . (int) $n['id'] . ' ЖИВАЯ и зовёт на конкурс с кончившимся приёмом',
            '«' . $имя . '», статус ' . (string) $n['status'] . ', в очереди ' . $вОчереди
            . ' — остановить: отменить её письма в mail_queue');
    } else {
        ok('волна #' . (int) $n['id'] . ' — след прошедшего (остановлена, очередь пуста)',
            '«' . $имя . '», ушло ' . (int) $n['stats_sent'] . ', создана ' . (string) $n['created_at']);
    }
}
if (!$беды) ok('волн по закрытым конкурсам нет');
$ждут = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued'
                        AND (COALESCE(newsletter_id,0)<>0 OR COALESCE(campaign_type,'')<>'')") ?? 0);
ok('массовых писем ждёт в очереди', (string) $ждут);

sec('Рабочее окно: у каждого наружного крона есть проверка');
/* Список наружных отправщиков. Канал наружу - это письмо человеку, запись в
   чужое сообщество или личное сообщение. Сбор данных и подготовка контента
   сюда не входят: они наружу не пишут. */
$наружу = [
    'cron/process_newsletter_queue.php' => 'очередь писем',
    'cron/vk_promo.php'                 => 'записи в чужие сообщества',
    'cron/vk_admin_dm.php'              => 'сообщения администраторам сообществ',
    'cron/vk_dm_worker.php'             => 'личные сообщения участникам',
    'cron/smm_publish.php'              => 'лента центра',
    'cron/publish_results_vk.php'       => 'итоги конкурса в ВК',
    'cron/publish_scheduled_posts.php'  => 'отложенные афиши',
    'cron/send_reminders.php'           => 'напоминания о приёме',
    'cron/drip.php'                     => 'цепочка касаний',
    'cron/engagement.php'               => 'вовлечение',
    'cron/teacher_invite.php'           => 'приглашения педагогам',
    'cron/order_unpaid_reminder.php'    => 'дожим неоплаченных',
    'cron/award_order_reminders.php'    => 'напоминания по наградам',
    'cron/order_address_request.php'    => 'запрос адреса',
    'cron/calendar_reminders.php'       => 'календарные напоминания',
    // 14.10.2026: в списке его не было вовсе, а блок «запуск конкурсов» работает
    // в любой час и постит на стену сообщества плюс рассылку подписчикам ВК.
    'cron/mailings.php'                 => 'почасовые волны кампании месяца',
];
foreach ($наружу as $файл => $что) {
    $src = (string) @file_get_contents(BASE_PATH . '/' . $файл);
    if ($src === '') { bad("$файл ($что) — файла нет"); continue; }
    chk("$что ($файл) держит окно", strpos($src, 'outreach_window') !== false);
}
/* Пульт запуска — особый случай: окно стоит не в кроне, а в ядре волны
   (launch_run_due), и проверять надо именно там. Крон launch_scheduler.php
   идёт каждую минуту круглосуточно и сам по себе ничего не знает про окно. */
$lr = (string) @file_get_contents(BASE_PATH . '/core/launch_run.php');
chk('волны пульта запуска (core/launch_run.php) держат окно',
    strpos($lr, 'outreach_window_ok') !== false);
ok('окно наружу', 'пн-сб ' . OUTREACH_HOUR_FROM . ':00-' . OUTREACH_HOUR_TO . ':00 МСК; сейчас '
    . (outreach_window_ok() ? 'открыто' : 'закрыто: ' . outreach_window_reason()));

sec('Рубильник массовых останавливает и то, что уже в очереди');
$src = (string) @file_get_contents(BASE_PATH . '/cron/process_newsletter_queue.php');
chk('отправщик очереди смотрит рубильник', strpos($src, 'mass_sending_enabled') !== false);
require_once BASE_PATH . '/core/newsletter.php';
ok('рубильник сейчас', mass_sending_enabled() ? 'поднят (массовые идут)' : 'опущен (массовые стоят)');

sec('Анонс запуска не уходит по конкурсу с кончившимся приёмом');
$adm = (string) @file_get_contents(BASE_PATH . '/admin/competitions.php');
chk('в админке стоит заслон по дате приёма',
    strpos($adm, 'competition_launch_blast_skipped') !== false);
$сегодня = date('Y-m-d');
$разрешён = 0; $заблокирован = 0;
foreach (all("SELECT id,end_date FROM competitions") as $c) {
    $к = trim((string) $c['end_date']);
    if ($к === '' || substr($к, 0, 10) < $сегодня) $заблокирован++; else $разрешён++;
}
ok('анонс разрешён конкурсам', (string) $разрешён);
ok('анонс заблокирован конкурсам', (string) $заблокирован);

sec('Почасовые волны кампании отбирают конкурсы по срокам');
/* До 14.10.2026 три блока из четырёх брали конкурсы по одному status='open':
   блок запуска — без launched и без end_date, «осталось 3 дня» 22 числа и
   «последний день» 25 числа — без сверки с датой приёма вообще. Пост и письмо
   уходили бы по конкурсу, приём которого кончился два месяца назад. */
$ml = (string) @file_get_contents(BASE_PATH . '/cron/mailings.php');
chk('блок запуска требует launched = 1', substr_count($ml, 'COALESCE(launched, 0) = 1') >= 4);
chk('«осталось 3 дня» сверяет дату приёма', strpos($ml, "date(end_date) <= date(?, '+5 days')") !== false);
chk('«последний день» сверяет дату приёма', strpos($ml, "date(end_date) <= date(?, '+1 day')") !== false);
chk('«приём закрыт» не объявляет прошлое', strpos($ml, "date(end_date) >= date(?, '-7 days')") !== false);
/* Живая арифметика: ни один конкурс с кончившимся приёмом не должен попасть
   в волны «осталось 3 дня» и «последний день» ни в один день месяца. */
$сегодня = date('Y-m-d');
$база = "status = 'open' AND COALESCE(launched, 0) = 1
          AND end_date IS NOT NULL AND end_date <> '' AND date(end_date) >= ?";
$плохих = 0;
foreach (['-07', '-14', '-22', '-25', '-26'] as $хв) {
    $д = date('Y-m') . $хв;
    foreach (all("SELECT id, end_date FROM competitions
                   WHERE $база AND date(end_date) <= date(?, '+5 days')", [$д, $д]) as $c) {
        if (substr((string) $c['end_date'], 0, 10) < $д) $плохих++;
    }
}
chk('в волнах приёма нет конкурсов с кончившимся приёмом', $плохих === 0, (string) $плохих);

sec('Слоты ротации зовут на идущие конкурсы, и контакты в них свежие');
/* 14.10.2026: слоты заводились руками разовой командой и остались
   августовскими, а конкурсы новые каждый месяц. Заслон vkp_posts() закрытый
   конкурс не выпускает, но тогда ротация молчит и про идущие тоже. */
require_once BASE_PATH . '/core/vk_promo.php';
$идут   = comps_open_now();
$вРаботе = vkp_posts();
$конк    = array_values(array_filter($вРаботе,
    static fn(array $p): bool => (string) ($p['kind'] ?? '') === 'competition'));
chk('в ротации есть записи о конкурсах', $конк !== [] || $идут === [], (string) count($конк));
/* Каждая запись зовёт на конкурс, приём которого правда идёт. */
$слагиИдут = array_map(static fn(array $c): string => (string) $c['slug'], $идут);
$чужих = 0;
foreach ($конк as $p) {
    if (!preg_match_all('~/konkurs-([a-z0-9\-]+)~u', (string) $p['text'], $m)) { $чужих++; continue; }
    foreach ($m[1] as $слаг) if (!in_array($слаг, $слагиИдут, true)) $чужих++;
}
chk('ни одна запись не зовёт на закрытый приём', $чужих === 0, (string) $чужих);
chk('у каждой записи есть афиша',
    count(array_filter($вРаботе, static fn(array $p): bool => trim((string) ($p['attachment'] ?? '')) !== ''))
        === count($вРаботе));
/* ВЛОЖЕНИЕ ДОЛЖНО ПРИНАДЛЕЖАТЬ ТОМУ, КТО ПУБЛИКУЕТ, ИЛИ НАШЕМУ СООБЩЕСТВУ.
   14.10.2026: у слотов «партнёр» и «клуб» лежало фото ПРЕЖНЕГО аккаунта, и обе
   записи полтора месяца уходили в чужие сообщества без картинки — ВКонтакте
   молча выбрасывает недоступное вложение и публикует текст. Ни одной ошибки в
   журнале: видно только сверкой чужих стен. */
require_once BASE_PATH . '/core/vk.php';
$свои = [-(int) cfgv('vk_group_id', 211325055)];
$кто  = vk_api_with('users.get', [], trim((string) cfgv('vk_wall_token', '')), 'vk_flood_until');
$ктоId = (int) ($кто['response'][0]['id'] ?? 0);
if ($ктоId > 0) $свои[] = $ктоId;
chk('известен аккаунт, которым идёт публикация', $ктоId > 0, (string) $ктоId);
$чужиеФото = [];
foreach ($вРаботе as $p) {
    if (!preg_match('~^photo(-?\d+)_~', (string) ($p['attachment'] ?? ''), $m)) continue;
    if (!in_array((int) $m[1], $свои, true)) {
        $чужиеФото[] = 'слот ' . $p['slot'] . ' (владелец ' . $m[1] . ')';
    }
}
chk('афиши принадлежат нам, а не чужой странице', $чужиеФото === [], implode(', ', $чужиеФото));
/* Контактный хвост берётся из настроек центра, а не вписан в текст: график
   сменился 12.10.2026, а записи расходились со вчерашним. */
$устарело = [];
foreach (all("SELECT slot, text FROM vk_posts") as $p) {
    $t = (string) $p['text'];
    if (str_contains($t, 'kulturniy.centr.mir@gmail.com')) $устарело[] = 'слот ' . $p['slot'] . ': Gmail вместо kc@';
    if (str_contains($t, 'Сб 09:00'))                      $устарело[] = 'слот ' . $p['slot'] . ': суббота с 09:00';
    if ($t !== vkp_osvezhit_kontakty($t))                  $устарело[] = 'слот ' . $p['slot'] . ': хвост расходится с настройками';
}
chk('контакты в записях равны настройкам центра', $устарело === [], implode('; ', array_unique($устарело)));
chk('импорт записи освежает контакты',
    str_contains((string) @file_get_contents(BASE_PATH . '/scripts/vk_posts_import.php'), 'vkp_osvezhit_kontakty'));

/* УСЛОВИЕ ПРИЁМА В ЗАПИСЯХ РОТАЦИИ (правило 72, 16.10.2026).
   Платный конкурс может принимать заявки только от членов Клуба, а запись
   каждый день зовёт участвовать всех и называет оргвзнос. Проверяем ФАКТ по
   живым слотам: у записи о таком конкурсе условие обязано стоять, у остальных
   его быть не должно. */
if (!function_exists('club_vhod_tolko_chlenam')) require_once BASE_PATH . '/core/club_free.php';
if (!function_exists('comp_slugs_in_text'))      require_once BASE_PATH . '/core/comp_now.php';
$__услНет = []; $__услЛишнее = [];
foreach (all("SELECT slot, title, text FROM vk_posts WHERE active=1 ORDER BY slot") as $__p) {
    $__t = (string) ($__p['text'] ?? '');
    $__клуб = false;
    foreach (comp_slugs_in_text($__t) as $__s) {
        $__c = one("SELECT * FROM competitions WHERE slug=?", [(string) $__s]);
        if ($__c && club_vhod_tolko_chlenam($__c)) { $__клуб = true; break; }
    }
    $__есть = mb_strpos($__t, 'Приём заявок только от участников Элитного клуба') !== false;
    if ($__клуб && !$__есть)  $__услНет[]    = 'слот ' . (int) $__p['slot'];
    if (!$__клуб && $__есть)  $__услЛишнее[] = 'слот ' . (int) $__p['slot'];
}
chk('записи о конкурсе для членов Клуба называют условие приёма', !$__услНет, implode(', ', $__услНет));
chk('у остальных записей условия приёма нет', !$__услЛишнее, implode(', ', $__услЛишнее));
chk('условие ставит тот же обновитель, что график и телефон',
    str_contains((string) @file_get_contents(BASE_PATH . '/core/vk_promo.php'), 'vkp_uslovie_priyoma($text)'));
chk('суточная сверка слотов стоит в кроне',
    str_contains((string) @shell_exec('crontab -l 2>/dev/null'), 'vk_posts_sync.php'));

sec('Центральным министерствам и департаментам Москвы писем не уходит');
/* Слово владельца 14.10.2026: «письма любого содержания (о поддержке, и т.п.) в
   центральные Министерства культуры и образования города Москвы не отправлять в
   автоматизации никогда». Проверяем ЗАСЛОН, а не галочку в базе: запись могут
   пересоздать, а новый ящик того же министерства должен попасть под запрет сам. */
require_once BASE_PATH . '/core/ministries.php';
$закрыты = ['mail@mkrf.ru', 'cultrf@mkrf.ru', 'mail@culture.gov.ru', 'pressa@culture.gov.ru',
            'info@edu.gov.ru', 'press@edu.gov.ru', 'info@minobrnauki.gov.ru',
            'press@minobrnauki.gov.ru', 'pr@minobrnauki.gov.ru',
            'priemnaja@culture.mos.ru', 'donm@mos.ru', 'donm-press@mos.ru',
            /* новый ящик того же министерства тоже закрыт — проверяем домен */
            'new2027@mkrf.ru', 'press3@culture.gov.ru'];
$прошли = [];
foreach ($закрыты as $e) if (min_send_forbidden($e) === '') $прошли[] = $e;
chk('запрет держит все центральные адреса', $прошли === [], implode(', ', $прошли));

/* И НЕ ЗАДЕВАЕТ УЧРЕЖДЕНИЯ НА ТЕХ ЖЕ ДОМЕНАХ. На culture.mos.ru сидят 129
   московских школ искусств, на mos.ru ещё две: закрой домен целиком — замолчит
   вся партнёрка Москвы. */
$нельзя_трогать = ['dhsh2@culture.mos.ru', 'dshistravinskogo@culture.mos.ru',
                   'minigalinaan@mos.ru', 'serovaam@mos.ru', 'culture@tularegion.ru'];
$зря = [];
foreach ($нельзя_трогать as $e) if (min_send_forbidden($e) !== '') $зря[] = $e;
chk('учреждения на тех же доменах не задеты', $зря === [], implode(', ', $зря));

chk('заслон стоит в двери отправки (mail_send_failover)',
    str_contains((string) @file_get_contents(BASE_PATH . '/core/mailer.php'), 'min_send_forbidden'));
chk('заслон стоит в двери ответов ведомствам',
    str_contains((string) @file_get_contents(BASE_PATH . '/core/ministry_reply.php'), 'min_send_forbidden'));
chk('подготовка обращений пропускает запрещённых',
    str_contains((string) @file_get_contents(BASE_PATH . '/core/ministry_mailing.php'), 'min_send_forbidden'));
$ждут = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                        WHERE status IN ('queued','paused')
                          AND (to_email LIKE '%@mkrf.ru' OR to_email LIKE '%@culture.gov.ru'
                            OR to_email LIKE '%@edu.gov.ru' OR to_email LIKE '%@minobrnauki.gov.ru'
                            OR to_email = 'priemnaja@culture.mos.ru' OR to_email LIKE 'donm%@mos.ru')") ?? 0);
chk('в очереди нет писем запрещённым ведомствам', $ждут === 0, (string) $ждут);
ok('ведомств под запретом', (string) (int) (scalar("SELECT COUNT(*) FROM ministries WHERE COALESCE(no_send,0)=1") ?? 0));

sec('Телефон и график центра - один источник (правка владельца 14.10.2026)');

/* ЗАЧЕМ ЭТОТ РАЗДЕЛ. 14.10.2026 владелец сменил написание телефона на
   +7(999)504-88-99 и велел писать график словами «Вс: (праздничные дни)
   ВЫХОДНОЙ» во всех местах. Замер тогда показал, что обе величины вписаны
   руками в десятке мест: в футере ежедневных постов центра жила суббота
   09:00-16:00 (с 15.10.2026 снята именно она: владелец вернул субботу на
   10:00 и отменил своё же слово от 12.10), а проверка поста требовала старый формат
   телефона - то есть забраковала бы каждый пост в день правки. Копия всегда
   расходится молча, и узнают об этом люди. */

$телНастройка = trim((string) cfgv('org_phone', ''));
$часыНастройка = trim((string) cfgv('org_hours', ''));
chk('телефон центра задан', $телНастройка !== '', $телНастройка);
chk('график центра задан', $часыНастройка !== '', $часыНастройка);
chk('в графике стоит написание владельца',
    str_contains($часыНастройка, 'Вс: (праздничные дни) ВЫХОДНОЙ'),
    'сейчас: ' . $часыНастройка);
chk('в графике суббота с 10:00', str_contains($часыНастройка, 'Сб 10:00-16:00'), $часыНастройка);

/* ПРАВКА В АДМИНКЕ ОБЯЗАНА ПРИМЕНЯТЬСЯ. cfgv() читает config.php раньше базы, и
   у ключей, которые правятся в админке, это делало поле тихой пустышкой: в базе
   лежал новый телефон, а центр печатал старый. Список CFG_IZ_ADMINKI переворачивает
   порядок, и он обязан покрывать ВСЕ поля раздела «Контакты оргкомитета». */
$адм = (string) @file_get_contents(BASE_PATH . '/admin/settings.php');
$поля = [];
if (preg_match('~Контакты оргкомитета.*?\];~su', $адм, $m)) {
    preg_match_all("~'(org_[a-z_]+)'\s*=>~u", $m[0], $mm);
    $поля = array_unique($mm[1] ?? []);
}
chk('поля контактов в админке найдены', $поля !== [], implode(', ', $поля));
$непокрыты = array_values(array_diff($поля, defined('CFG_IZ_ADMINKI') ? CFG_IZ_ADMINKI : []));
chk('каждое поле контактов попадает в CFG_IZ_ADMINKI', $непокрыты === [],
    'не покрыты: ' . implode(', ', $непокрыты) . ' - правка такого поля в админке ничего не сделает');

/* НИ ОДНОЙ ВПИСАННОЙ РУКАМИ КОПИИ В ЖИВОМ КОДЕ.
   Пояснения вырезаем перед поиском: в комментариях этого проекта прежние
   написания названы НАРОЧНО, чтобы следующая сессия не «починила» их обратно, и
   проверка краснела бы на нашем же разборе (та же грабля, что в правилах 40 и 48). */
$чужойТел = []; $чужаяСуббота = [];
$папки = ['core', 'cron', 'admin', 'api', 'templates', 'public', 'scripts'];
$итератор = static function (string $dir) {
    if (!is_dir($dir)) return [];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    $out = [];
    foreach ($it as $f) if ($f->isFile() && in_array(strtolower($f->getExtension()), ['php', 'html'], true)) $out[] = $f->getPathname();
    return $out;
};
foreach ($папки as $d) {
    foreach ($итератор(BASE_PATH . '/' . $d) as $путь) {
        $текст = (string) @file_get_contents($путь);
        $код = (string) preg_replace(['~/\*.*?\*/~su', '~//[^\n]*~u', '~^\s*\*.*$~mu'], '', $текст);
        $короткий = str_replace(BASE_PATH . '/', '', $путь);
        /* САМУ СЕБЯ ПРОВЕРКА НЕ ЧИТАЕТ. В ней эти написания стоят шаблонами
           поиска, то есть кодом, а не комментарием - и первый прогон честно
           покраснел на себе. Третий раз эта грабля в проекте (правила 40, 48). */
        if ($короткий === 'scripts/audit_outreach.php') continue;
        /* Телефон центра с теми же цифрами, но в другом написании - это копия,
           которая завтра соврёт. Сверяем по цифрам, а не по виду.
           ЦИФРЫ БЕЗ РАЗДЕЛИТЕЛЕЙ - НЕ КОПИЯ: +79995048899 это отдельное
           значение `org_phone_raw`, им живут ссылка tel: и разметка schema.org,
           и писаться оно обязано именно так. Им же заполняются подставные
           заявки в проверках сайта. */
        if (preg_match_all('~\+7\s*\(?\s*999\s*\)?[\s\-]*504[\s\-]*88[\s\-]*99~u', $код, $m2)) {
            foreach ($m2[0] as $наход) {
                $н = trim($наход);
                if ($н === $телНастройка) continue;
                if (preg_replace('~\s~u', '', $н) === '+79995048899') continue;   // org_phone_raw
                $чужойТел[] = $короткий . ': ' . $н;
            }
        }
        if (preg_match('~Сб[\s:]*09[:.]00~u', $код)) $чужаяСуббота[] = $короткий;
    }
}
chk('телефон нигде не вписан в другом написании', $чужойТел === [], implode('; ', array_slice($чужойТел, 0, 8)));
chk('снятой субботы 09:00 нет в живом коде', $чужаяСуббота === [], implode('; ', array_slice($чужаяСуббота, 0, 8)));

/* ЖИВЫЕ ВЫХОДЫ: что человек правда прочитает. Проверка исходников мало стоит -
   функция может отдавать верный HTML, а строки в шаблоне не быть вовсе. */
require_once BASE_PATH . '/core/chat_brain.php';
require_once BASE_PATH . '/core/chat_ops.php';
require_once BASE_PATH . '/core/smm.php';
require_once BASE_PATH . '/core/vk_templates.php';

$прощание = chat_closing_message('Проверка', 1, 'audit_' . bin2hex(random_bytes(5)));
chk('в прощании телефон из настроек', str_contains($прощание, $телНастройка));
chk('в прощании строка владельца про воскресенье',
    str_contains($прощание, 'Вс: (праздничные дни) ВЫХОДНОЙ.'));
chk('в прощании нет старого написания номера',
    !preg_match('~\+7\s\(999\)~u', $прощание));

$футер = smm_footer();
chk('в футере поста телефон из настроек', str_contains($футер, $телНастройка));
chk('в футере поста суббота с 10:00', str_contains($футер, 'Сб 10:00-16:00'), '');
chk('в футере поста нет снятой субботы', !str_contains($футер, 'Сб 09:00'));

chk('шаблоны ВК берут график из настроек', str_contains(vkt_hours(), 'Сб 10:00-16:00'), vkt_hours());
chk('ответ вне графика называет настоящий график',
    str_contains(chat_offhours_template(''), 'Вс: (праздничные дни) ВЫХОДНОЙ'));

/* СЛОТЫ РОТАЦИИ. Они живут месяцами, а решения приходят каждую неделю. */
$плохиеСлоты = [];
try {
    foreach (all("SELECT slot, text FROM vk_posts") as $r) {
        $t = (string) $r['text'];
        if ($телНастройка !== '' && str_contains($t, 'Колл-центр') && !str_contains($t, $телНастройка))
            $плохиеСлоты[] = 'слот ' . (int) $r['slot'] . ': телефон не из настроек';
        if ($часыНастройка !== '' && preg_match('~Сб[\s:]*09[:.]00~u', $t))
            $плохиеСлоты[] = 'слот ' . (int) $r['slot'] . ': снятая суббота 09:00';
    }
} catch (\Throwable $e) {}
chk('в слотах ротации телефон и график свежие', $плохиеСлоты === [], implode('; ', $плохиеСлоты));

/* АДРЕС ЦЕНТРА ДЛЯ ОБРАЩЕНИЙ - НЕ GMAIL, И ЭТО СТОИЛО ЗАПИСЕЙ В ЧУЖИХ
   СООБЩЕСТВАХ. kulturniy.centr.mir@gmail.com это ВРЕМЕННЫЙ путь ОТПРАВКИ при
   закрытом SMTP Яндекса (правило 26), а не адрес центра; людям он показываться
   не должен ни в одной записи (правило 50). В шаблонах ВК он был вписан
   постоянной строкой и уезжал в футер каждой записи - слово владельца
   14.10.2026: поставить kc@. Проверяем ЖИВОЙ выход, а не исходник: функция
   может отдавать верное, а в шаблоне строки не быть вовсе. */
$почта = trim((string) cfgv('org_email', ''));
chk('адрес центра для обращений задан', $почта !== '', $почта);
chk('адрес центра не gmail', !str_contains(mb_strtolower($почта), 'gmail.com'), $почта);
$контакты = function_exists('vkt_contacts') ? vkt_contacts() : '';
chk('блок контактов шаблонов ВК собирается', $контакты !== '');
chk('в контактах шаблонов ВК адрес из настроек', str_contains($контакты, $почта));
chk('в контактах шаблонов ВК нет gmail', !str_contains(mb_strtolower($контакты), 'gmail.com'));
$истVkt = (string) @file_get_contents(BASE_PATH . '/core/vk_templates.php');
$истVkt = (string) preg_replace(['~/\*.*?\*/~su', '~//[^\n]*~u'], '', $истVkt);
chk('в шаблонах ВК адрес не вписан строкой',
    !str_contains(mb_strtolower($истVkt), 'gmail.com'),
    'вписанный адрес устаревает молча - берите из cfgv(org_email)');
$слотыGmail = [];
try {
    foreach (all("SELECT slot, text FROM vk_posts") as $r)
        if (str_contains(mb_strtolower((string) $r['text']), 'gmail.com'))
            $слотыGmail[] = 'слот ' . (int) $r['slot'];
} catch (\Throwable $e) {}
chk('в слотах ротации нет gmail', $слотыGmail === [], implode(', ', $слотыGmail));

/* ───────── ПИСЬМО НЕ ЗОВЁТ НА КОНКУРС С КОНЧИВШИМСЯ ПРИЁМОМ ─────────
 *
 * 15.10.2026 в 07:30 крон `requeue_false_bounces` поставил в очередь 98
 * приглашений на «Мировые Таланты» (приём кончился 25.08): волна ушла 14.10 по
 * недосмотру (правило 49), её отбитые адреса попали в «ложные отказы», и повтор
 * честно сделал копию последнего ушедшего письма. Снятые руками письма вернулись
 * бы в очередь на следующее же утро.
 *
 * Прежний заслом `nl_letter_expired` это НЕ ловил: он смотрит одну настройку на
 * весь центр (`intake_closed`), а конкурсы новые каждый месяц, и пока открыт хоть
 * один, настройка стоит нулём. Замерено: на том самом письме он отдавал false. */
sec('Письма не зовут на закрытый приём');
require_once BASE_PATH . '/core/comp_now.php';

chk('мерка на месте', function_exists('comp_pismo_zovet_na_zakrytyi'));

$откр = comps_open_now();
$закр = null;
foreach (all("SELECT name, slug, end_date FROM competitions WHERE COALESCE(launched,0)=1") as $c) {
    $жив = false;
    foreach ($откр as $o) if ((string) $o['slug'] === (string) $c['slug']) $жив = true;
    if (!$жив) { $закр = $c; break; }
}
if ($закр) {
    $имяЗ = (string) $закр['name']; $слагЗ = (string) $закр['slug'];
    $имяО = $откр ? (string) $откр[0]['name'] : '';
    chk('зов на закрытый по названию ловится',
        comp_pismo_zovet_na_zakrytyi('Открыт приём заявок: ' . $имяЗ,
            'Мы открыли приём заявок и приглашаем Вас принять участие') !== '', $имяЗ);
    chk('зов на закрытый по адресу конкурса ловится',
        comp_pismo_zovet_na_zakrytyi('Приглашение',
            'Приглашаем Вас принять участие: /competition/' . $слагЗ) !== '', '/competition/' . $слагЗ);
    /* Адрес в живом письме завёрнут в счётчик переходов, и амперсанд там
       заэкранирован («&amp;u=»). Шаблон с одним «[?&]» на живом теле не нашёл ни
       одного слага - письмо поймало только по названию, то есть вслепую. */
    $зашит = rtrim(strtr(base64_encode('https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/competition/' . $слагЗ), '+/', '-_'), '=');
    chk('адрес внутри счётчика переходов разворачивается',
        in_array($слагЗ, comp_slugs_in_text('<a href="/api/v1/track.php?e=c&amp;t=x&amp;u=' . $зашит . '">тут</a>'), true),
        'u=<base64>');
    if ($имяО !== '') {
        chk('закрытый рядом с идущим письмо не останавливает',
            comp_pismo_zovet_na_zakrytyi('Открыт приём заявок',
                'Открыт приём заявок: «' . $имяЗ . '» и «' . $имяО . '» ждут Вас') === '',
            $имяЗ . ' + ' . $имяО);
    }
    chk('письмо об итогах закрытого конкурса не останавливается',
        comp_pismo_zovet_na_zakrytyi('Итоги конкурса «' . $имяЗ . '»',
            'Опубликованы результаты конкурса «' . $имяЗ . '». Наградные материалы готовятся.') === '');
} else { ok('закрытых запущенных конкурсов нет — пропуск'); }

/* ЗАСЛОН СТОИТ В ТРЁХ МЕСТАХ. Письма в очередь кладут шесть разных мест, и
   проверка в одном отборе оставляет остальные двери открытыми (правила 45, 54).
   Пояснения вырезаем: ниже они называют и беду, и имя мерки. */
$безКом = static function (string $f): string {
    return (string) preg_replace(['~/\*.*?\*/~su', '~//[^\n]*~u', '~^\s*\*.*$~mu'], '',
                                 (string) @file_get_contents(BASE_PATH . '/' . $f));
};
foreach ([
    'core/mail_reputation.php'          => 'повтор после ложного отказа',
    'core/newsletter.php'               => 'дверь отправки очереди',
    'cron/process_newsletter_queue.php' => 'запасная дверь крона',
] as $файл => $где) {
    chk('заслон стоит в «' . $где . '»',
        str_contains($безКом($файл), 'comp_pismo_zovet_na_zakrytyi('), $файл);
}

/* ФАКТ ПО ЖИВОЙ ОЧЕРЕДИ. Личные письма не судим: «Заявка №MZ-2026-00042
   принята» законно называет закрытый конкурс и ни одного идущего. */
$живыеЗовы = [];
try {
    foreach (all("SELECT id, to_email, subject, body, newsletter_id, campaign_type
                    FROM mail_queue WHERE status IN ('queued','paused')") as $r) {
        if ((int) $r['newsletter_id'] <= 0 && trim((string) $r['campaign_type']) === '') continue;
        if (comp_pismo_zovet_na_zakrytyi((string) $r['subject'], (string) $r['body']) !== '') {
            $живыеЗовы[] = '#' . (int) $r['id'] . ' ' . (string) $r['to_email'];
        }
    }
} catch (\Throwable $e) {}
chk('в очереди нет живых массовых писем на закрытый приём', $живыеЗовы === [],
    implode(', ', array_slice($живыеЗовы, 0, 5)) . ' (всего ' . count($живыеЗовы) . ')');

sec('Обращение к педагогу без ярлыка должности');
/* В `applications.teacher` лежит ФИО вместе с должностью, а иногда и несколько
   человек сразу. Поле читают письмо педагогу и письмо о Клубе, и ярлык уезжал
   прямо в обращение: «Уважаемый(ая) Педагог: Матросова Татьяна Сергеевна!».
   Разбирать поле имеет право только `curator_split_teachers()`: своя регулярка
   знает один ярлык из пяти и расходится молча (правила 33, 35, 45, 47). */
$__чисто = static function (string $path): string {
    $src = @file_get_contents($path);
    if ($src === false) return '';
    $out = '';
    foreach (token_get_all($src) as $t) {
        if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
        $out .= is_array($t) ? $t[1] : $t;
    }
    return $out;
};
$__ti = $__чисто(BASE_PATH . '/cron/teacher_invite.php');
$__ce = $__чисто(BASE_PATH . '/core/club_entry_mail.php');
chk('письмо педагогу разбирает поле единым помощником',
    strpos($__ti, 'curator_split_teachers((string) $r[\'teacher\'])') !== false);
chk('письмо о Клубе разбирает поле единым помощником',
    strpos($__ce, 'curator_split_teachers((string) ($a[\'teacher\'] ?? \'\'))') !== false);
/* ОТРИЦАНИЕМ: своя регулярка ярлыка легко возвращается следующей правкой. */
chk('своей регулярки ярлыка в живом коде нет',
    preg_match('~Педагог\\s\*:~u', $__ti . $__ce) === 0);
chk('нескольким педагогам в одном поле письмо здоровается безлично',
    strpos($__ti, 'count($ped) === 1') !== false && strpos($__ce, 'count($__ped) === 1') !== false);
/* ФАКТ: помощник правда снимает каждый живой ярлык и делит составное поле. */
if (!function_exists('curator_split_teachers')) require_once BASE_PATH . '/core/curator_awards.php';
$__плохо = [];
foreach (all("SELECT DISTINCT teacher FROM applications
               WHERE COALESCE(teacher,'') <> '' AND teacher LIKE '%:%' LIMIT 200") as $__r) {
    foreach (curator_split_teachers((string) $__r['teacher']) as $__one) {
        if (str_contains($__one, ':')) { $__плохо[] = mb_substr($__one, 0, 60); break; }
    }
}
chk('у живых заявок помощник не оставляет ярлык в имени', $__плохо === [],
    implode(' | ', array_slice($__плохо, 0, 3)));

/* ВИТРИНА НАГРАД В ПИСЬМЕ И КЛУБНАЯ КАРТОЧКА.
 *
 * Четыре правки владельца 17.10.2026, все про текст, который уходит людям:
 * снять надпись «Закрытый клуб центра», дать медали своё описание, предлагать
 * именной диплом только участникам коллектива и назвать оплату доставки при
 * получении. Три из них это слова, вписанные в код, а четвёртая — признак,
 * который брали на глаз в трёх местах. Поэтому проверка смотрит И исходник, И
 * ФАКТ: что правда соберётся в письме. */
sec('Витрина наград в письме и клубная карточка');
foreach (['data', 'mailer', 'award_offer', 'club_perks'] as $__m) {
    if (is_file(BASE_PATH . '/core/' . $__m . '.php')) require_once BASE_PATH . '/core/' . $__m . '.php';
}
$__ao = $__чисто(BASE_PATH . '/core/award_offer.php');
$__rm = $__чисто(BASE_PATH . '/core/result_mail.php');
$__or = $__чисто(BASE_PATH . '/cron/award_order_reminders.php');
$__ml = $__чисто(BASE_PATH . '/core/mailer.php');

// 2. Медаль: свои слова, и они не достаются кубку со статуэткой.
chk('описание медали лежит одной постоянной', defined('AO_NOTE_MEDAL'));
chk('в описании медали стоят слова владельца',
    defined('AO_NOTE_MEDAL') && str_contains(AO_NOTE_MEDAL, 'Награды нового поколения')
    && str_contains(AO_NOTE_MEDAL, '3D-рельеф') && str_contains(AO_NOTE_MEDAL, 'держать в руках'));
chk('витрина берёт описание у самого предмета',
    str_contains($__ao, '\'note\'  => $noteMain'));
/* Текст трофея лежит ровно в одной постоянной: вторая копия в наборе разойдётся
   молча, и письмо начнёт обещать разное по одному и тому же предмету. */
chk('описание трофея в файле ровно одно',
    substr_count($__ao, 'Приходит в подарочной упаковке') === 1,
    'вхождений: ' . substr_count($__ao, 'Приходит в подарочной упаковке'));
$__med = ao_main_item('ДИПЛОМАНТ I СТЕПЕНИ');
$__lau = ao_main_item('ЛАУРЕАТ I СТЕПЕНИ');
$__cup = ao_main_item('ГРАН-ПРИ');
chk('у медали описание медали', (string) ($__med[3] ?? '') === (defined('AO_NOTE_MEDAL') ? AO_NOTE_MEDAL : 'x'));
chk('у статуэтки и кубка описание НЕ медальное',
    !str_contains((string) ($__lau[3] ?? ''), 'Награды нового поколения')
    && !str_contains((string) ($__cup[3] ?? ''), 'Награды нового поколения'),
    'иначе письмо назвало бы медалью кубок');

// 3. Именной диплом — только участнику коллектива.
chk('примечание именного называет, кому он положен',
    str_contains($__ao, 'Только для участников коллектива'));
chk('признак коллектива узнаёт единый помощник',
    function_exists('ao_is_group') && function_exists('ao_any_group'));
chk('письмо одной заявки передаёт признак коллектива',
    str_contains($__rm, 'ao_block((int) $a[\'competition_id\'], $result, $awardsUrl, ao_is_group($a))'),
    'без него коллективу именной не предлагался вовсе');
chk('письмо пачкой узнаёт коллектив тем же помощником',
    str_contains($__rm, 'ao_any_group($apps)'));
chk('напоминание о заказе зовёт тот же помощник',
    str_contains($__or, 'ao_any_group($apps)'));
/* ОТРИЦАНИЕМ: своя проверка «у заявки есть название коллектива» возвращается
   одной строкой, и тогда три письма начнут судить по-разному. */
chk('своей копии признака в письмах не осталось',
    !str_contains($__rm, '$isGroup = true')
    && !str_contains($__or, '($a[\'group_name\'] ?? \'\')) !== \'\') return true'));
if (function_exists('ao_is_group')) {
    chk('помощник узнаёт коллектив по названию и по признаку заявки',
        ao_is_group(['group_name' => 'Ансамбль «Искорки»']) && ao_is_group(['is_group' => 1])
        && !ao_is_group(['group_name' => '', 'is_group' => 0]));
}

/* ФАКТ по собранной витрине. Нужен конкурс со снимками: без них набор пуст, и
   «именного у солиста нет» зеленело бы вслепую (урок правила 71). */
$__compF = 0;
foreach (glob(BASE_PATH . '/public/assets/img/awards/*/mail/sq/medal.jpg') as $__g) {
    $__id = (int) basename(dirname(dirname(dirname($__g))));
    if (is_file(BASE_PATH . '/public/assets/img/awards/' . $__id . '/mail/sq/diploma-name.jpg')) { $__compF = $__id; break; }
}
if ($__compF === 0) {
    ok('снимков наград для письма нет ни у одного конкурса — витрину собрать не из чего (справка, не провал)');
} else {
    $__заг = static function (array $kit): array {
        $o = []; foreach ($kit as $i) $o[(string) $i['title']] = (string) $i['note']; return $o;
    };
    $__solo = $__заг(ao_kit($__compF, 'ДИПЛОМАНТ I СТЕПЕНИ', false));
    $__grp  = $__заг(ao_kit($__compF, 'ДИПЛОМАНТ I СТЕПЕНИ', true));
    chk('витрина солиста собралась', $__solo !== [], 'конкурс #' . $__compF);
    chk('у солиста именного диплома в письме НЕТ',
        !isset($__solo['Именной диплом участнику']),
        'правило 30: солисту он не положен, сервер такой заказ отбивает');
    chk('у коллектива именной диплом в письме ЕСТЬ',
        isset($__grp['Именной диплом участнику']));
    chk('ФАКТ: у медали в письме стоят слова владельца',
        str_contains((string) ($__solo['Наградная медаль'] ?? ''), 'Награды нового поколения'));
    $__блок = ao_block($__compF, 'ДИПЛОМАНТ I СТЕПЕНИ', '', true);
    chk('ФАКТ: доставка названа оплатой при получении',
        str_contains($__блок, 'Оплата за доставку при получении (наложенный платёж)'));
    chk('ФАКТ: «одной посылкой» в письме не осталось',
        !str_contains($__блок, 'одной посылкой'));
}

// 1. Клубная карточка писем: надписи «закрытый клуб» нет.
chk('надписи «Закрытый клуб» в клубной карточке писем нет',
    !preg_match('~[Зз]акрыт\w* клуб~u', $__ml), 'слово владельца 17.10.2026');
if (function_exists('mm_vip_card')) {
    $__карт = mm_vip_card();
    chk('ФАКТ: в карточке письма нет слова «закрытый»', !preg_match('~[Зз]акрыт~u', $__карт));
    chk('ФАКТ: карточка названа «Элитный клуб «Музыкальный Мир»»',
        str_contains($__карт, 'Элитный клуб «Музыкальный'));
}

/* ───────── Оригиналы названы словом владельца ───────── */
sec('Оригиналы наград: «оригинальная подпись и печать»');
/* Слово владельца 19.10.2026: в письмах участникам не писать «живыми подписями
   и печатями». Падеж согласован по месту (в творительном ряду «с … подписью и
   печатью»), смысл и слово владельца сохранены. Проверка стоит ОТРИЦАНИЕМ:
   прежняя формулировка возвращается одной правкой строки. */
const SIG_STARAYA = '~жив(ая|ой|ые|ыми|ую)\s+(подпис|печат)|(подпис|печат)[а-яё]*\s+жив~u';
const SIG_NOVAYA  = '~оригинальн(ая|ой)\s+подпись?ю?\s+и\s+печать?ю?~u';

/* ФАКТ по СОБРАННЫМ письмам: сборщики чистые, в библиотечном режиме крон не
   запускается (MM_EMAIL_TEST_LIB) и наружу ничего не уходит. */
if (!defined('MM_EMAIL_TEST_LIB')) define('MM_EMAIL_TEST_LIB', 1);
foreach (['mailer', 'app_status', 'award_offer'] as $__sm) {
    if (is_file(BASE_PATH . '/core/' . $__sm . '.php')) require_once BASE_PATH . '/core/' . $__sm . '.php';
}
require_once BASE_PATH . '/cron/send_diplomas.php';
if (!function_exists('_diploma_email_html') || !function_exists('_diploma_group_html')) {
    bad('сборщики писем с дипломами не подключились — проверка писем молча не выполнилась');
} else {
    $__d = ['comp_name' => 'Проверка', 'full_name' => 'Иванова Мария', 'number' => 'XX-2026-00001',
            'result' => 'ДИПЛОМАНТ I СТЕПЕНИ', 'type' => 'main', 'app_result' => 'ДИПЛОМАНТ I СТЕПЕНИ'];
    $__pismo1 = _diploma_email_html($__d);
    $__pismo2 = _diploma_group_html([$__d], 'Иванова Мария', 'Проверка');
    foreach (['письмо с дипломом' => $__pismo1, 'письмо с пачкой наград' => $__pismo2] as $__имя => $__html) {
        chk('ФАКТ: ' . $__имя . ' говорит «оригинальной подписью и печатью»',
            preg_match(SIG_NOVAYA, $__html) === 1);
        chk('ФАКТ: ' . $__имя . ' не говорит про живые подписи',
            preg_match(SIG_STARAYA, $__html) !== 1);
    }
}
/* Витрина наград в письме (правило 74): описание ОРИГИНАЛА ДИПЛОМА.
   Оно лежит у позиции «Диплом на бланке» в ao_kit, а не у ao_main_item:
   там четвёртым полем идёт описание трофея, и проверка по нему зеленела
   бы на чужом тексте. Набор пуст без снимков наград, поэтому конкурс
   выбирается по наличию файла - иначе проверка молчит вслепую. */
$__compD = 0;
foreach (all("SELECT id FROM competitions ORDER BY id DESC") as $__c) {
    if (is_file(BASE_PATH . '/public/assets/img/awards/' . (int) $__c['id'] . '/mail/sq/diploma.jpg')) {
        $__compD = (int) $__c['id']; break;
    }
}
if ($__compD === 0 || !function_exists('ao_kit')) {
    echo "  справка: снимка оригинала диплома нет ни у одного конкурса, витрину проверить не на чем\n";
} else {
    $__blank = '';
    foreach (ao_kit($__compD, 'ДИПЛОМАНТ I СТЕПЕНИ', true) as $__it) {
        if (mb_stripos((string) ($__it['title'] ?? ''), 'Диплом на бланке') !== false) {
            $__blank = (string) ($__it['note'] ?? ''); break;
        }
    }
    chk('ФАКТ: оригинал диплома в витрине письма назван словом владельца',
        $__blank !== '' && preg_match(SIG_NOVAYA, $__blank) === 1
        && preg_match(SIG_STARAYA, $__blank) !== 1,
        $__blank !== '' ? $__blank : 'позиции «Диплом на бланке» в наборе нет');
}
/* ИСХОДНИКИ. Служебное письмо владельцу (scripts/send_award_samples.php) сюда НЕ
   входит намеренно: оно уходит на okoteam.top@gmail.com и говорит цеху, что
   подписи ставятся вручную, — это не текст участнику. */
$__файлы = ['cron/send_diplomas.php', 'core/award_offer.php', 'core/result_mail.php',
            'cron/award_order_reminders.php', 'core/mail_campaigns.php', 'core/mailer.php',
            'templates/site/pages/cabinet.php', 'templates/site/pages/awards.php'];
$__грязь = [];
foreach ($__файлы as $__f) {
    $__p = BASE_PATH . '/' . $__f;
    if (!is_file($__p)) continue;
    if (preg_match(SIG_STARAYA, $__чисто($__p))) $__грязь[] = $__f;
}
chk('в письмах участникам и кабинете прежней формулировки нет', $__грязь === [],
    $__грязь ? implode(', ', $__грязь) : 'проверено ' . count($__файлы) . ' файлов');
echo "\n================ ИТОГ ================\n";
echo "ok: $OK, FAIL: $FAIL\n";
if ($FAIL === 0) echo "Наружу уходит только по идущим конкурсам и только в рабочее окно.\n";
exit($FAIL === 0 ? 0 : 1);
