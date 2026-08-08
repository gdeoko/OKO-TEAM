<?php
/**
 * ГЛУБОКИЙ АУДИТ СТРАНИЦ И БЛОКОВ.
 *
 * Проверяет не «страница отдала 200», а что на ней ЕСТЬ то, ради чего она нужна:
 * ключевые блоки, заголовки, формы и кнопки. Отдельно обходит ВСЕ внутренние
 * ссылки сайта (битые ссылки), картинки (битые картинки) и все разделы админки
 * с их управляющими элементами.
 *
 *   BASE=http://127.0.0.1:8099 php scripts/audit_blocks.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

$BASE = rtrim((string) (getenv('BASE') ?: 'http://127.0.0.1:8099'), '/');
$JAR  = sys_get_temp_dir() . '/muzmir_blocks.txt';
@unlink($JAR);

$FAIL = 0; $OK = 0; $WARN = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, string $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, string $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function warn(string $w, string $i = ''): void { global $WARN; $WARN++; echo "  warn $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, string $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }

function req(string $url, array $post = null, bool $follow = true): array {
    global $JAR, $BASE;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => $follow, CURLOPT_MAXREDIRS => 5,
        CURLOPT_COOKIEJAR => $JAR, CURLOPT_COOKIEFILE => $JAR, CURLOPT_TIMEOUT => 40,
        CURLOPT_HEADER => true, CURLOPT_PROXY => '',
        CURLOPT_HTTPHEADER => ['Origin: ' . $BASE, 'Referer: ' . $BASE . '/'],
    ]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $raw = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hlen = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return ['code' => $code, 'body' => substr($raw, $hlen)];
}

/** Есть ли на странице все перечисленные признаки блоков. */
function blocks(string $path, array $need, string $label = ''): string {
    global $BASE;
    $label = $label ?: $path;
    $r = req($BASE . $path);
    if ($r['code'] !== 200) { bad("$label — код", (string) $r['code']); return ''; }
    $miss = [];
    foreach ($need as $what => $needle) {
        // ВАЖНО: stripos не понимает регистр кириллицы («Результаты» ≠ «результат»),
        // поэтому ищем через mb_stripos — тем же способом, что и поиск в админке.
        $has = static fn(string $n): bool => mb_stripos($r['body'], $n, 0, 'UTF-8') !== false;
        $found = is_array($needle)
            ? (bool) array_filter($needle, static fn($n) => $has((string) $n))
            : $has((string) $needle);
        if (!$found) $miss[] = $what;
    }
    $miss ? bad("$label — нет блоков", implode(', ', $miss)) : ok($label, count($need) . ' блоков');
    return $r['body'];
}

/* ═════════════ ПУБЛИЧНЫЕ СТРАНИЦЫ: блоки по существу ═════════════ */
sec('Главная и витрины');
blocks('/', [
    'шапка с меню'      => ['<header', 'nav'],
    'ближайшие конкурсы' => ['конкурс'],
    'призыв подать заявку' => ['/apply'],
    'подвал с контактами'  => ['Солянка'],
    'телефон в schema.org' => ['telephone', '79995048899'],
], 'главная');

blocks('/competitions', [
    'фильтр по типу'   => ['type='],
    'карточки конкурсов' => ['comp-card', 'cf-grid', 'конкурс'],
    'ссылка на подачу'   => ['/apply'],
], 'каталог конкурсов');

blocks('/awards', [
    'заголовок образцов' => ['Образцы наград'],
    'выбор конкурса'     => ['comp='],
], 'награды — витрина');

blocks('/calendar', ['календарь' => ['календар', 'Календарь']], 'календарь');
blocks('/concerts', ['онлайн-концерты' => ['концерт']], 'концерты');
blocks('/blog',     ['статьи' => ['blog', 'Новости', 'статья']], 'блог');
blocks('/reviews',  ['отзывы' => ['отзыв'], 'форма отзыва' => ['form']], 'отзывы');
blocks('/faq',      ['вопросы' => ['вопрос', 'details', 'summary']], 'вопросы и ответы');
blocks('/contacts', ['адрес' => ['Солянка'], 'почта' => ['@'], 'телефон' => ['504-88-99']], 'контакты');
blocks('/about',    ['о центре' => ['центр', 'Роскомнадзор']], 'о центре');
blocks('/goals',    ['цели' => ['цел', 'задач']], 'цели и задачи');
blocks('/ministry-support', ['поддержка министерств' => ['Министерств', 'министерств']], 'поддержка');
blocks('/gala',     ['гала' => ['гала', 'Гала']], 'гала-концерт');
blocks('/partner',  ['партнёрство' => ['партн']], 'партнёрам');
// Кабинет педагога — только для входа; гостя уводит на /login, это норма.
$r = req($BASE . '/teacher', null, false);
chk('кабинет педагога закрыт для гостя', in_array($r['code'], [302, 200], true), (string) $r['code']);
blocks('/results',  ['результаты' => ['результат']], 'результаты');

sec('Юридические и служебные');
blocks('/agreement', ['текст соглашения' => ['соглашени', 'оферт', 'услови']], 'пользовательское соглашение');
blocks('/privacy',   ['политика ПД' => ['персональн']], 'политика конфиденциальности');
blocks('/menu',      ['разделы' => ['/awards', '/apply']], 'меню разделов');

sec('Формы: подача, вход, регистрация, клуб');
blocks('/apply', [
    'выбор конкурса'      => ['competition'],
    'ФИО участника'       => ['full_name'],
    'возрастная категория' => ['age_category'],
    'номинация'           => ['nomination'],
    'форма исполнения'    => ['formation'],
    'конкурсный номер'    => ['work_title'],
    'ссылка на материал'  => ['video_url'],
    'согласия'            => ['agree_'],
    'защита CSRF'         => ['_csrf'],
    'без всплывашек'      => ['data-nopopup="1"'],
], 'подача заявки');

blocks('/login', ['почта' => ['email'], 'пароль' => ['password'], 'CSRF' => ['_csrf'],
                  'восстановление' => ['/forgot']], 'вход');
blocks('/register', ['почта' => ['email'], 'пароль' => ['password'], 'CSRF' => ['_csrf']], 'регистрация');
blocks('/forgot', ['почта' => ['email'], 'CSRF' => ['_csrf']], 'восстановление пароля');
blocks('/club', [
    'привилегии клуба' => ['скидк', 'Скидк'],
    'цена membership'  => ['₽'],
    'кнопка вступления' => ['клуб', 'Клуб'],
], 'страница ВИП-клуба');
blocks('/verify', ['поле номера' => ['number', 'номер']], 'проверка подлинности');

/* ═════════════ ССЫЛКИ И КАРТИНКИ ═════════════ */
sec('Внутренние ссылки не битые');
$seen = []; $queue = ['/', '/competitions', '/awards', '/menu', '/about', '/faq', '/contacts', '/club'];
$links = [];
foreach ($queue as $p) {
    $r = req($BASE . $p);
    if (preg_match_all('~href="' . preg_quote($BASE, '~') . '([^"#?]*)~', $r['body'], $m)) {
        foreach ($m[1] as $l) {
            $l = '/' . ltrim($l, '/');
            if ($l === '' || isset($links[$l])) continue;
            if (preg_match('~\.(pdf|docx|png|jpg|svg|ico|css|js|xml|txt|webmanifest)$~i', $l)) continue;
            if (str_starts_with($l, '/admin')) continue;
            $links[$l] = true;
        }
    }
}
ksort($links);
$broken = [];
foreach (array_keys($links) as $l) {
    $r = req($BASE . $l, null, false);
    if (!in_array($r['code'], [200, 301, 302], true)) $broken[] = $l . ' → ' . $r['code'];
}
chk('все внутренние ссылки живые (' . count($links) . ' шт.)', !$broken, implode('; ', array_slice($broken, 0, 6)));

sec('Картинки на месте');
$imgBad = [];
foreach (['/', '/awards', '/competitions', '/club', '/about'] as $p) {
    $r = req($BASE . $p);
    if (preg_match_all('~<img[^>]+src="([^"]+)"~', $r['body'], $m)) {
        foreach (array_unique($m[1]) as $src) {
            if (str_starts_with($src, 'data:')) continue;
            $u = str_starts_with($src, 'http') ? $src : $BASE . '/' . ltrim($src, '/');
            if (!str_contains($u, parse_url($BASE, PHP_URL_HOST) ?: '')) continue;   // только своё
            $rr = req($u, null, false);
            if ($rr['code'] !== 200) $imgBad[] = basename($src) . ' → ' . $rr['code'];
        }
    }
}
chk('битых картинок нет', !$imgBad, implode('; ', array_slice($imgBad, 0, 6)));

/* ═════════════ АДМИНКА: разделы и их блоки ═════════════ */
sec('Админка: вход');
$r = req($BASE . '/admin/');
$adminIn = false;
if (preg_match('~name="_csrf"\s+value="([^"]+)"~', $r['body'], $m)) {
    $r = req($BASE . '/admin/', ['_csrf' => $m[1], 'do' => 'login',
        'email' => getenv('ADMIN_LOGIN') ?: 'admin@test.local',
        'password' => getenv('ADMIN_PASS') ?: 'Test_12345']);
    $adminIn = stripos($r['body'], 'p=logout') !== false;
}
chk('вход выполнен', $adminIn);

if ($adminIn) {
    sec('Админка: каждый раздел и его управление');
    $sections = [
        'dashboard' => ['Обзор' => ['Обзор'], 'сводка цифр' => ['заяв', 'Заяв']],
        'competitions' => ['список конкурсов' => ['конкурс'], 'создание' => ['action=', 'Добавить', 'Создать']],
        'applications' => ['колонка ФИО' => ['ФИО', 'коллектив'], 'колонка конкурса' => ['Конкурс'],
                           'колонка статуса' => ['Статус'], 'колонка суммы' => ['Сумма'], 'поиск' => ['name="q"']],
        'grading'      => ['очередь оценки' => ['Оцен', 'оцен'], 'поиск' => ['name="q"']],
        'longcomp'     => ['длинные конкурсы' => ['длин', 'Длин', 'публик']],
        'dispatch'     => ['очередь отправок' => ['Отправ', 'отправ'], 'поиск' => ['name="q"'],
                           'состояние почты' => ['почт', 'SMTP', 'ящик']],
        'digital'      => ['заказы электронных' => ['электрон'], 'поиск' => ['name="q"']],
        'orders'       => ['вкладка в работе' => ['В работе'], 'архив' => ['Архив'],
                           'поиск' => ['name="q"'], 'трек-номер' => ['трек', 'Трек', 'tracking']],
        'diplomas'     => ['реестр дипломов' => ['диплом']],
        'diploma_editor' => ['редактор наград' => ['редактор', 'Редактор', 'шаблон']],
        'users'        => ['список пользователей' => ['@'], 'поиск' => ['name="q"'], 'роли' => ['роль', 'Роль', 'role']],
        'newsletter'   => ['рассылки' => ['рассылк', 'Рассылк'], 'аудитория' => ['аудитор', 'подписчик']],
        'launch'       => ['волны запуска' => ['3 дня', 'Последний день', 'волн'],
                           'рубильник массовых' => ['массов'], 'почтовые ящики' => ['ящик', 'почт']],
        'analytics'    => ['аналитика' => ['Аналитик', 'аналитик']],
        'cms'          => ['контент' => ['страниц', 'Контент']],
        'settings'     => ['настройки' => ['Настройк', 'настройк']],
        'chats'        => ['чаты' => ['чат', 'Чат']],
    ];
    foreach ($sections as $p => $need) {
        blocks('/admin/?p=' . $p, $need, 'админка: ' . $p);
    }

    sec('Админка: карточка конкурса — редактирование и прайс наград');
    $cid = 0;
    $rc = req($BASE . '/admin/?p=competitions');
    if (preg_match('~p=competitions[^"]*action=edit[^"]*id=(\d+)~', $rc['body'], $mc)) $cid = (int) $mc[1];
    if ($cid > 0) {
        blocks('/admin/?p=competitions&action=edit&id=' . $cid, [
            'название'      => ['name="name"'],
            'даты приёма'   => ['start_date', 'end_date'],
            'дата итогов'   => ['results_date'],
            'платность'     => ['is_paid'],
            'прайс наград'  => ['pi_kind', 'pi_item', 'прайс', 'Прайс'],
            'фон диплома'   => ['diploma_bg'],
        ], 'админка: карточка конкурса');
    } else { warn('не нашёл ссылку на карточку конкурса'); }

    sec('Админка: PHP-шум по всем разделам');
    $noisy = [];
    foreach (array_keys($sections) as $p) {
        $r = req($BASE . '/admin/?p=' . $p);
        if (preg_match('~(Warning:|Notice:|Deprecated:|Fatal error|Undefined variable|Undefined array key|SQLSTATE)~', $r['body'], $mm)) {
            $noisy[] = $p . ' (' . $mm[1] . ')';
        }
    }
    chk('во всех разделах чисто', !$noisy, implode('; ', $noisy));

    sec('Админка: списки открываются с фильтрами и пагинацией');
    foreach (['applications' => ['status' => 'graded'], 'orders' => ['status' => 'archive'],
              'dispatch' => ['f' => 'diploma'], 'digital' => ['f' => 'sent'],
              'users' => ['role' => 'user'], 'competitions' => []] as $p => $qs) {
        $url = '/admin/?p=' . $p . ($qs ? '&' . http_build_query($qs) : '') . '&page=2';
        $r = req($BASE . $url);
        chk("раздел $p с фильтром и 2-й страницей", $r['code'] === 200
            && !preg_match('~(Fatal error|SQLSTATE)~', $r['body']), (string) $r['code']);
    }
}

echo "\n" . str_repeat('─', 60) . "\n";
echo ($FAIL === 0 ? "БЛОКИ И СТРАНИЦЫ ЧИСТО" : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK, предупреждений: $WARN\n";
exit($FAIL === 0 ? 0 : 1);
