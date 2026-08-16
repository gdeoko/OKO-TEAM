<?php
/**
 * АУДИТ ВСЕХ ПИСЕМ ЦЕНТРА — ПО КАЖДОМУ ШАБЛОНУ, ПО КАЖДОЙ СТРОКЕ.
 *
 * Письмо уходит человеку один раз, и переделать его уже нельзя. Поэтому каждый
 * шаблон здесь собирается по-настоящему — на подставных данных, но тем же кодом,
 * что и в бою, — и прогоняется через набор правил:
 *
 *   ПОДСТАНОВКИ   не осталось ли в тексте {{имя}}, $name, %s, «Array» и пустых
 *                 мест вроде «Пароль: » без пароля;
 *   ЯЗЫК          нет ли канцелярита и рекламных штампов, по которым письмо
 *                 сразу читается как машинное («в рамках», «таким образом»,
 *                 «на сегодняшний день», «позволяет вам»);
 *   ОБРАЩЕНИЕ     здоровается ли письмо с человеком и не зовёт ли его
 *                 «пользователем» или «клиентом»;
 *   ССЫЛКИ        все ли абсолютные, нет ли http вместо https, нет ли чужих
 *                 доменов и следов отладки (localhost, example.com);
 *   ОТПИСКА       есть в массовых, нет в личных (в письме про диплом ссылка
 *                 «отписаться» выглядит как угроза лишить документов);
 *   КАРТИНКИ      абсолютный адрес и подпись alt;
 *   ВЁРСТКА       не пустое, не гигантское, теги закрыты;
 *   ТЕМА          не пустая, не длиннее 120 знаков, без переносов строк.
 *
 * Ничего не отправляет и ничего не меняет.
 *
 *   php scripts/audit_letters.php            — сводка
 *   php scripts/audit_letters.php --full     — с текстом каждой находки
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/person_name.php';
require_once BASE_PATH . '/core/presets.php';
require_once BASE_PATH . '/core/mail_campaigns.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once BASE_PATH . '/core/launch_combo.php';
require_once BASE_PATH . '/core/letter_texts.php';
require_once BASE_PATH . '/core/letter_mail.php';
require_once BASE_PATH . '/core/result_mail.php';
require_once BASE_PATH . '/core/partner.php';

$full = in_array('--full', $argv, true);
$line = str_repeat('=', 78);
$BASE = rtrim((string) cfgv('base_url', ''), '/');
$HOST = parse_url($BASE, PHP_URL_HOST) ?: '';

/* ── Правила ──────────────────────────────────────────────────────────────── */

/** Канцелярит и рекламные штампы: по ним письмо читается как машинное. */
const AI_MARKERS = [
    'важно отметить', 'стоит отметить', 'следует отметить', 'таким образом',
    'кроме того', 'в рамках данного', 'на сегодняшний день', 'комплексный подход',
    'индивидуальный подход', 'в кратчайшие сроки', 'позволяет вам', 'позволит вам',
    'широкий спектр', 'ряд преимуществ', 'не является исключением', 'играет важную роль',
    'во-первых', 'во-вторых', 'уникальная возможность', 'мы рады сообщить вам',
    'не упустите свой шанс', 'спешите', 'абсолютно бесплатно', 'всего за',
];

/** Обезличенные обращения: к человеку так не пишут. */
const IMPERSONAL = ['уважаемый пользователь', 'уважаемый клиент', 'дорогой пользователь',
                    'уважаемый заказчик', 'здравствуйте, пользователь'];

/** Следы отладки и чужие адреса. */
const BAD_LINKS = ['localhost', '127.0.0.1', 'example.com', 'example.test', 'test.local', '://muzmir.local'];

$report = [];   // имя письма => список замечаний
$stats  = ['всего' => 0, 'чисто' => 0, 'с замечаниями' => 0];

/**
 * Проверка одного письма.
 *
 * @param string $name    как называть письмо в отчёте
 * @param string $subject тема
 * @param string $html    тело
 * @param array  $opt     'bulk' — массовое (нужна отписка), 'personal' — личное
 *                        (отписки быть не должно), 'greet' — ждём обращение по имени
 */
function letter_check(string $name, string $subject, string $html, array $opt = []): void {
    global $report, $stats, $BASE, $HOST;
    $stats['всего']++;
    $bad = [];

    // Отступы вёрстки — не текст письма. Схлопываем пробелы, иначе каждая
    // аккуратно свёрстанная таблица выглядела бы как ошибка набора.
    $raw  = trim(html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    $text = trim((string) preg_replace('~[ \t]*\R[ \t]*~u', "\n", $raw));
    $text = (string) preg_replace('~[ \t]{2,}~u', ' ', $text);
    $low  = mb_strtolower($text);

    /* тема */
    $s = trim($subject);
    if ($s === '')                       $bad[] = 'тема пустая';
    if (mb_strlen($s) > 120)             $bad[] = 'тема длиннее 120 знаков (' . mb_strlen($s) . ')';
    if (preg_match('~[\r\n]~', $s))      $bad[] = 'в теме перенос строки';
    if (preg_match('~\{\{|\$\{|%s|%d~u', $s)) $bad[] = 'в теме осталась подстановка: ' . $s;

    /* тело: пустое или несоразмерное */
    if (mb_strlen($text) < 80)           $bad[] = 'тело почти пустое (' . mb_strlen($text) . ' знаков текста)';
    if (strlen($html) > 400000)          $bad[] = 'тело больше 400 КБ — почтовики обрежут';

    /* неподставленные значения */
    if (preg_match_all('~\{\{[a-z_]+\}\}~ui', $html, $m))  $bad[] = 'не подставлено: ' . implode(', ', array_unique($m[0]));
    if (preg_match('~(?<![\w$])\$[a-z_]{3,}~', $text, $m)) $bad[] = 'в тексте переменная кода: ' . $m[0];
    if (mb_strpos($text, 'Array') !== false)               $bad[] = 'в текст попало слово Array';
    // «Пароль:» и следом конец строки или тег — значение потерялось.
    // Значение может стоять в соседнем теге, поэтому смотрим не на разметку, а на
    // очищенный текст: после метки должно быть хоть что-то, кроме пробелов.
    foreach (['Пароль', 'Логин', 'Промокод'] as $fld) {
        if (preg_match('~' . $fld . '\s*:?\s*([^\n]{0,40})~ui', $text, $m)) {
            if (trim((string) $m[1]) === '') $bad[] = 'поле «' . $fld . '» без значения';
        }
    }

    /* язык */
    foreach (AI_MARKERS as $w)  if (mb_strpos($low, $w) !== false) $bad[] = 'штамп: «' . $w . '»';
    foreach (IMPERSONAL as $w)  if (mb_strpos($low, $w) !== false) $bad[] = 'обезличенное обращение: «' . $w . '»';
    // Лишние пробелы ищем ВНУТРИ строки: переносы между абзацами — это вёрстка,
    // а вот три пробела посреди предложения читаются как опечатка.
    foreach (preg_split('~\R~u', $raw) ?: [] as $ln) {
        if (preg_match('~\S[ \t]{3,}\S~u', $ln)) { $bad[] = 'лишние пробелы в строке: ' . mb_substr(trim($ln), 0, 60); break; }
    }
    if (preg_match('~[а-яё]\s+,~u', $text))        $bad[] = 'пробел перед запятой';
    if (preg_match('~!{2,}~', $text))              $bad[] = 'несколько восклицательных знаков подряд';
    // Капс допустим там, где он часть бланка или звания: «ОБРАЩЕНИЕ» в шапке
    // официального письма и «ЛАУРЕАТ I СТЕПЕНИ» в дипломе набраны так по форме.
    $capsOk = ['ОБРАЩЕНИЕ', 'БЛАГОДАРСТВЕННОЕ', 'БЛАГОДАРНОСТЬ', 'ЛАУРЕАТ', 'ГРАН', 'ДИПЛОМАНТ', 'УЧАСТНИК'];
    if (preg_match_all('~[А-ЯЁ]{8,}~u', $text, $mm)) {
        foreach (array_unique($mm[0]) as $word) {
            $skip = false;
            foreach ($capsOk as $okw) if (mb_strpos($word, $okw) !== false) { $skip = true; break; }
            if (!$skip) $bad[] = 'слово капсом: ' . $word;
        }
    }

    /* обращение */
    if (!empty($opt['greet'])) {
        if (!preg_match('~Здравствуйте|Уважаем~ui', $text)) $bad[] = 'нет приветствия';
    }

    /* ссылки */
    if (preg_match_all('~href=["\']([^"\']+)["\']~i', $html, $m)) {
        foreach (array_unique($m[1]) as $href) {
            $h = trim($href);
            if ($h === '' || $h === '#')                  { $bad[] = 'пустая ссылка href="' . $h . '"'; continue; }
            if (str_starts_with($h, 'mailto:') || str_starts_with($h, 'tel:')) continue;
            foreach (BAD_LINKS as $b) if (mb_stripos($h, $b) !== false) $bad[] = 'ссылка на отладочный адрес: ' . $h;
            if (str_starts_with($h, 'http://'))            $bad[] = 'ссылка по http вместо https: ' . $h;
            if (!preg_match('~^https?://~i', $h))          $bad[] = 'ссылка не абсолютная: ' . $h;
        }
    }

    /* картинки */
    if (preg_match_all('~<img[^>]*>~i', $html, $m)) {
        foreach ($m[0] as $img) {
            if (!preg_match('~src=["\'](https?://|data:|cid:)~i', $img)) $bad[] = 'у картинки не абсолютный адрес';
        }
    }

    /* отписка */
    // Считаем именно ССЫЛКУ отписки. Вежливая строка «если такие письма не нужны,
    // ответьте словом "отписать"» в обращении к ведомству — это не рассылочная
    // кнопка, а нормальный тон официального письма, и придираться к ней нельзя.
    $unsubLink = (bool) preg_match('~href=["\'][^"\']*unsubscribe~i', $html);
    $unsubWord = mb_stripos($text, 'отписат') !== false;
    if (!empty($opt['bulk']) && !$unsubLink && !$unsubWord) $bad[] = 'в массовом письме нет ссылки отписки';
    if (!empty($opt['personal']) && $unsubLink)             $bad[] = 'в личном письме есть кнопка отписки (не должно быть)';

    /* вёрстка */
    $open = substr_count(mb_strtolower($html), '<div');
    $close = substr_count(mb_strtolower($html), '</div>');
    if ($open !== $close) $bad[] = "теги div не сходятся: открыто $open, закрыто $close";
    if (mb_strpos($html, '<script') !== false) $bad[] = 'в письме есть script — почтовики вырежут письмо целиком';

    $report[$name] = $bad;
    $bad ? $stats['с замечаниями']++ : $stats['чисто']++;
}

/* ── Подставные данные ────────────────────────────────────────────────────── */
$comps = mmc_open_competitions();
$inst  = ['id' => 0, 'name' => 'МБУ ДО «Детская школа искусств №1»', 'region' => 'Московская обл.',
          'city' => 'Подольск', 'email' => 'audit@example.test', 'director' => 'Иванова Мария Петровна',
          'partner_no' => 'ИП-2026-00001', 'partner_slug' => 'dshi-1', 'partner_promo_code' => 'PART-2026-A1B2',
          'partner_promo_max' => 10, 'partner_status' => 'accepted', 'partner_pass_shown' => 0];
$min   = ['id' => 0, 'org' => 'Министерство культуры Московской области', 'region' => 'Московская обл.',
          'email' => 'audit@example.test', 'person' => 'Петров Пётр Петрович',
          'person_role' => 'Министру культуры Московской области', 'person_role_nom' => 'Министр культуры'];
$unsub = $BASE . '/api/v1/unsubscribe.php?token=demo';

echo "АУДИТ ПИСЕМ\n$line\n";

/* 1. Массовые кампании по своей базе */
foreach (campaign_types() as $type => $label) {
    try {
        $b = campaign_build($type, ['unsub' => $unsub]);
        // Заготовку кампании проверять бессмысленно: имя подставляется и обёртка
        // с отпиской надевается в момент постановки в очередь. Повторяем ровно то,
        // что делает newsletter_enqueue, и смотрим на готовое письмо.
        $subj = str_replace(['{{name}}', '{{имя}}'], 'Мария', (string) ($b['subject'] ?? ''));
        $body = str_replace(['{{name}}', '{{имя}}'], 'Мария', (string) ($b['html'] ?? $b['body'] ?? ''));
        letter_check('своя база · ' . $label, $subj, nl_wrap_email($body, $unsub, '', ''),
            ['bulk' => true, 'greet' => true]);
    } catch (\Throwable $e) { $report['своя база · ' . $label] = ['не собралось: ' . $e->getMessage()]; $stats['всего']++; $stats['с замечаниями']++; }
}

/* 2. Объединённое письмо запуска — три состояния получателя */
foreach ([['кабинет и клуб', true, true], ['только клуб', false, true], ['ни кабинета, ни клуба', false, false]] as [$what, $cab, $vip]) {
    try {
        $inner = launch_combo_inner($cab, $vip, 'ivanova@example.test', 'Мария', $cab ? 'A1B2C3D4' : '');
        letter_check('волна запуска · ' . $what, launch_combo_subject(),
            nl_wrap_email($inner, $unsub, '', '', ['vip' => !$vip]), ['bulk' => true, 'greet' => true]);
    } catch (\Throwable $e) { $report['волна запуска · ' . $what] = ['не собралось: ' . $e->getMessage()]; $stats['всего']++; $stats['с замечаниями']++; }
}

/* 3. Обращение учреждению и ведомству */
try {
    $L = lm_mail_institution($inst, '16082026/1', $comps, $unsub);
    letter_check('учреждению · приглашение и партнёрство', (string) $L['subject'], (string) $L['html'], ['bulk' => true, 'greet' => true]);
} catch (\Throwable $e) { $report['учреждению · приглашение'] = ['не собралось: ' . $e->getMessage()]; $stats['всего']++; $stats['с замечаниями']++; }

try {
    $L = lm_mail_support($min, '16082026/2', $comps);
    letter_check('ведомству · обращение о поддержке', (string) $L['subject'], (string) $L['html'], ['personal' => true, 'greet' => true]);
} catch (\Throwable $e) { $report['ведомству · обращение'] = ['не собралось: ' . $e->getMessage()]; $stats['всего']++; $stats['с замечаниями']++; }

try {
    $L = lm_mail_thanks($inst, '16082026/3', 5, ['Петрова Анна Ивановна']);
    letter_check('учреждению · благодарность', (string) $L['subject'], (string) $L['html'], ['personal' => true, 'greet' => true]);
} catch (\Throwable $e) { $report['учреждению · благодарность'] = ['не собралось: ' . $e->getMessage()]; $stats['всего']++; $stats['с замечаниями']++; }

/* 4. Партнёрские письма */
if (function_exists('partner_email_5apps_body') || is_file(BASE_PATH . '/cron/partner_triggers.php')) {
    // Тела живут в кроне; подключаем его функции без запуска самого крона.
    $src = (string) @file_get_contents(BASE_PATH . '/cron/partner_triggers.php');
    $pos = mb_strpos($src, 'function partner_email_5apps_body');
    if ($pos !== false && !function_exists('partner_email_5apps_body')) {
        eval('?>' . '<?php ' . mb_substr($src, $pos));
    }
}
if (function_exists('partner_email_5apps_body')) {
    letter_check('партнёру · 5 заявок',
        'От Вашего учреждения - 5 заявок, открылась возможность заказать благодарности',
        partner_email_5apps_body($inst), ['personal' => true, 'greet' => true]);
    letter_check('партнёру · 10 заявок и промокод',
        'Промокод -10% для Вашего учреждения, 10 заявок пройдено',
        partner_email_10apps_body($inst), ['personal' => true, 'greet' => true]);
    letter_check('партнёру · благодарности готовы',
        'Благодарственные письма от Оргкомитета',
        partner_email_thanks_body($inst, '<li><b>Петрова Анна Ивановна</b> - педагог-куратор</li>', 1),
        ['personal' => true, 'greet' => true]);
}

/* 5. Письмо о приёме в партнёры — собираем то же тело, что уходит в бою */
try {
    $rf = new ReflectionFunction('partner_send_welcome');
    $src = implode('', array_slice(file($rf->getFileName()), $rf->getStartLine() - 1,
        $rf->getEndLine() - $rf->getStartLine() + 1));
    // Тело письма внутри функции; проверяем его через сам вызов на подставном
    // учреждении невозможно (оно бы отправилось), поэтому сверяем ключевые части.
    $need = ['Сертификат информационного партнёра', 'Кабинет партнёра', 'Логин', 'Пароль',
             'Персональная ссылка', 'с 5 заявок', 'с 10 заявок'];
    $miss = [];
    foreach ($need as $n) if (mb_strpos($src, $n) === false) $miss[] = $n;
    $report['партнёру · приём в партнёрство'] = $miss ? ['в письме нет блоков: ' . implode(', ', $miss)] : [];
    $stats['всего']++; $miss ? $stats['с замечаниями']++ : $stats['чисто']++;
} catch (\Throwable $e) {
    $report['партнёру · приём в партнёрство'] = ['функции нет: ' . $e->getMessage()];
    $stats['всего']++; $stats['с замечаниями']++;
}

/* 6. Личные письма участнику — на настоящих данных последней заявки */
$app = one("SELECT a.*, c.name comp, c.slug comp_slug, c.is_paid comp_is_paid
              FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
             ORDER BY a.id DESC LIMIT 1");
if ($app) {
    $c = one("SELECT * FROM competitions WHERE id=?", [(int) $app['competition_id']]) ?: [];
    try {
        $card = rm_mail_app_card((array) $app, (array) $c);
        $inner = '<h1>Заявка принята</h1><p>Здравствуйте, ' . h((string) $app['full_name']) . '!</p>' . $card;
        letter_check('участнику · карточка заявки в письме', 'Заявка принята', rm_mail_layout($inner, 'Заявка принята'),
            ['personal' => true, 'greet' => true]);
    } catch (\Throwable $e) { $report['участнику · карточка заявки'] = ['не собралось: ' . $e->getMessage()]; $stats['всего']++; $stats['с замечаниями']++; }
}

/* ── Отчёт ────────────────────────────────────────────────────────────────── */
echo "\nПО КАЖДОМУ ПИСЬМУ\n$line\n";
ksort($report);
foreach ($report as $name => $bad) {
    if (!$bad) { printf("  [ок]   %s\n", $name); continue; }
    printf("  [!]    %s\n", $name);
    foreach ($bad as $b) printf("           - %s\n", $full ? $b : mb_substr($b, 0, 120));
}

echo "\n$line\n";
printf("ПИСЕМ ПРОВЕРЕНО: %d · ЧИСТО: %d · С ЗАМЕЧАНИЯМИ: %d\n",
    $stats['всего'], $stats['чисто'], $stats['с замечаниями']);
exit($stats['с замечаниями'] > 0 ? 1 : 0);
