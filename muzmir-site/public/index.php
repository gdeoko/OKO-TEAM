<?php
/** Единая точка входа публичного сайта + фронт-контроллер. */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$CFG = require BASE_PATH . '/config.php';
$GLOBALS['CFG'] = $CFG;

require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/countdown.php';
require_once BASE_PATH . '/core/auth.php';
// ПОЧТОВЫЙ СЛОЙ ПОДКЛЮЧАЕМ ВСЕГДА.
//
// Половина кода спрашивает function_exists('mail_queue') и молча пропускает
// отправку, если ответ «нет». Ни один из трёх входов в приложение почту не
// подключал, и каждая такая ветка была миной: кнопка «Подтвердить почту» в
// кабинете именно так и не работала — редирект без письма и без ошибки.
// Файл только объявляет функции и цвета, ничего не выполняет, поэтому платить
// за него можно везде.
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/security.php';
require_once BASE_PATH . '/core/traffic.php';

session_start();
traffic_capture();   // метка канала из ссылки — до любой выдачи страницы
csrf_boot();  // токен формы живёт столько же, сколько вход, а не 24 минуты
db(); // инициализация/миграции

// Маршрут
$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$base = parse_url($CFG['base_url'], PHP_URL_PATH) ?: '';
if ($base && $base !== '/' && str_starts_with($uri, $base)) $uri = substr($uri, strlen($base)) ?: '/';
$route = '/' . trim($uri, '/');
$route = $route === '' ? '/' : $route;

// Заголовки безопасности (CSP/HSTS/anti-clickjacking) — на все ответы, кроме встраиваемого виджета.
security_headers($route);

// REST API и админ-панель обслуживаются через фронт-контроллер
// (в проде nginx try_files отдаёт эти пути в index.php, т.к. web-root = public/).
if (preg_match('#^/api/v1/([a-z0-9_]+)(?:\.php)?$#', $route, $m)) {
    $f = BASE_PATH . '/api/v1/' . $m[1] . '.php';
    if (is_file($f)) { require $f; exit; }
    json_out(['ok' => false, 'error' => 'not_found'], 404);
}
if ($route === '/admin' || str_starts_with($route, '/admin/')) {
    $_GET['__route'] = $route;
    require BASE_PATH . '/admin/index.php';
    exit;
}

// Алиасы русских слагов старого сайта → 301 на канонические URL.
$aliases = [
    '/obrazci'     => '/awards',           // образцы наград
    '/oplata-sayt' => '/awards',     // оплата наградного материала
    '/voprosi'     => '/faq',              // справка/вопросы
    '/konkursi'    => '/competitions',     // список конкурсов
    '/podderjka'   => '/ministry-support', // поддержка Минкультуры
    '/comment'     => '/reviews',          // отзывы
    '/documents'   => '/competitions',     // положения конкурсов
    '/video'       => '/concerts',         // онлайн-концерты
    '/onas'        => '/about',            // о нас
    '/instrukciya' => '/awards',     // инструкция по заказу наград
    '/zadachi'     => '/goals',            // цели/задачи центра
    '/prays'       => '/awards',     // прайс наградного материала
    '/novosti'      => '/blog',            // Блог/Новости (русский слаг)
];
// /order-awards — СТАРЫЙ адрес плоской формы заказа. Настоящий раздел наград (образцы
// + корзина) живёт на /awards?comp=<id>, поэтому старые ссылки уводим туда, сохраняя
// привязку к заявке: /order-awards?app=N → /awards?comp=<конкурс заявки>&app=N.
if ($route === '/order-awards') {
    $__oaApp  = (int) input('app', '');
    $__oaComp = trim((string) input('competition', ''));
    $__to = '/awards';
    if ($__oaApp > 0) {
        $__c = one("SELECT competition_id FROM applications WHERE id=?", [$__oaApp]);
        if ($__c) $__to = '/awards?comp=' . (int) $__c['competition_id'] . '&app=' . $__oaApp;
    } elseif ($__oaComp !== '') {
        $__c = one("SELECT id FROM competitions WHERE slug=? OR code=? OR id=?",
                   [$__oaComp, $__oaComp, ctype_digit($__oaComp) ? (int) $__oaComp : 0]);
        if ($__c) $__to = '/awards?comp=' . (int) $__c['id'];
    }
    header('Location: ' . url($__to), true, 302); exit;
}
if (isset($aliases[$route])) { header('Location: ' . url($aliases[$route]), true, 301); exit; }

// Короткие ссылки из постов ВК: /konkurs-<slug> -> подача, /obrazci-<slug> -> награды конкурса.
if (preg_match('#^/konkurs-([a-z0-9\-]+)$#', $route, $m)) {
    header('Location: ' . url('/apply?competition=' . rawurlencode($m[1])), true, 301); exit;
}
if (preg_match('#^/obrazci-([a-z0-9\-]+)$#', $route, $m)) {
    $c = one("SELECT id FROM competitions WHERE slug=?", [$m[1]]);
    header('Location: ' . url($c ? '/awards?comp=' . (int)$c['id'] : '/awards'), true, 301); exit;
}
if (preg_match('#^/polozhenie-([a-z0-9\-]+)$#', $route, $m)) {   // положение КОНКРЕТНОГО конкурса (PDF инлайн)
    header('Location: ' . url('/competition/' . $m[1] . '/regulation.pdf'), true, 301); exit;
}

// Карта сайта: статические маршруты + конкурсы по slug.
if ($route === '/sitemap.xml') {
    header('Content-Type: application/xml; charset=utf-8');
    $baseUrl = rtrim($CFG['base_url'], '/');
    $static = ['/', '/competitions', '/apply', '/awards', '/order-awards', '/regulations', '/concerts',
        '/about', '/goals', '/ministry-support', '/faq', '/contacts', '/reviews',
        '/blog', '/privacy', '/agreement'];
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    foreach ($static as $p) {
        echo '  <url><loc>' . htmlspecialchars($baseUrl . $p, ENT_XML1) . '</loc></url>' . "\n";
    }
    $slugs = [];
    try { $slugs = all("SELECT slug FROM competitions"); } catch (\Throwable $e) { $slugs = []; }
    foreach ($slugs as $row) {
        $s = is_array($row) ? ($row['slug'] ?? '') : (string) $row;
        if ($s === '') continue;
        echo '  <url><loc>' . htmlspecialchars($baseUrl . '/awards/' . $s, ENT_XML1) . '</loc></url>' . "\n";
    }
    // Статьи блога (pages со слагом blog-*).
    try {
        foreach (all("SELECT slug FROM pages WHERE slug LIKE 'blog-%'") as $row) {
            $s = is_array($row) ? ($row['slug'] ?? '') : (string) $row;
            if ($s === '') continue;
            echo '  <url><loc>' . htmlspecialchars($baseUrl . '/blog/' . $s, ENT_XML1) . '</loc></url>' . "\n";
        }
    } catch (\Throwable $e) {}
    echo '</urlset>';
    exit;
}

$pagesDir = BASE_PATH . '/templates/site/pages';

/** Запуск файла-страницы: он должен вызвать render_page(...). */
function serve(string $file, array $vars = []): void {
    global $pagesDir;
    $path = $pagesDir . '/' . $file . '.php';
    if (!is_file($path)) return;   // страница ещё не создана — пусть отработает 404 ниже
    extract($vars);
    require $path;
    exit;
}

// Динамические маршруты
// Проверка подлинности официального обращения — сюда ведёт QR с бланка.
// Номер вида 11082026/001, поэтому в шаблоне допускаем цифры и косую черту.
if ($route === '/letter') serve('letter', ['number' => (string) input('n')]);
if (preg_match('#^/letter/([0-9]{6,8})/([0-9]{1,6})$#', $route, $m)) {
    serve('letter', ['number' => $m[1] . '/' . $m[2]]);
}

// КАБИНЕТ ПАРТНЁРА НА ТОМ ЖЕ АДРЕСЕ, ЧТО И СТРАНИЦА ПРОГРАММЫ.
//
// По /partner живёт публичная страница партнёрской программы, а кабинет —
// отдельный контроллер public/partner.php, и до него не вело ничего: письма
// звали на /partner?a=thanks, а человек попадал на рекламную страницу. Развилка
// простая: если это запрос кабинета (раздел в ?a=, отправка формы или уже
// выполненный вход) — показываем кабинет, иначе страницу программы.
if ($route === '/partner' || $route === '/partner/') {
    require_once BASE_PATH . '/core/partner.php';
    // ЗАЯВКА В ПАРТНЁРСКУЮ ПРОГРАММУ И ВХОД В КАБИНЕТ — РАЗНЫЕ ФОРМЫ НА ОДНОМ АДРЕСЕ.
    //
    // Любой POST уходил в кабинет партнёра, поэтому форма заявки со страницы
    // /partner не срабатывала ни разу: человек заполнял её, видел страницу входа
    // и уходил, а в partner_requests не появлялось ничего. Кабинет узнаём по его
    // собственным полям, всё остальное отдаём странице с формой.
    $isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
    $cabinetPost = $isPost && (
           isset($_POST['password']) || isset($_POST['auto']) || isset($_POST['teachers_manual'])
        || isset($_POST['managers'])  || isset($_POST['act'])  || isset($_POST['logout'])
    );
    $wantsCabinet = trim((string) ($_GET['a'] ?? '')) !== ''
        || $cabinetPost
        || partner_current() !== null;
    if ($wantsCabinet) { require BASE_PATH . '/public/partner.php'; exit; }
}

// ПЕРСОНАЛЬНАЯ ССЫЛКА ПАРТНЁРА /p/<slug>.
//
// По ней учреждение зовёт своих участников, и по ней же их заявки засчитываются
// учреждению — без этого партнёрская программа не считает ничего: ни порога в
// пять заявок для благодарностей, ни десяти для промокода. Метку кладём в cookie
// на 90 дней и уводим человека сразу на подачу заявки.
if (preg_match('#^/p/([A-Za-z0-9\-]{2,120})$#', $route, $m)) {
    require_once BASE_PATH . '/core/partner.php';
    $p = partner_by_slug(strtolower($m[1]));
    if ($p) {
        partner_set_cookie((int) $p['id']);
        header('Location: ' . url('/apply?src=partner'), true, 302);
    } else {
        // Ссылка устарела или партнёрство закрыто — не показываем ошибку,
        // просто отправляем человека на главную.
        header('Location: ' . url('/'), true, 302);
    }
    exit;
}

if ($route === '/verify') serve('verify', ['number' => '']);
if (preg_match('#^/verify/([A-Za-zА-Яа-я0-9\-]+)$#u', $route, $m)) serve('verify', ['number' => $m[1]]);
// Внутренняя страница конкурса упразднена: вся информация — на афише в календаре,
// клик по конкурсу ведёт сразу на подачу заявки с предвыбором.
if (preg_match('#^/competition/([a-z0-9\-]+)$#', $route, $m)) {
    header('Location: ' . url('/apply?competition=' . rawurlencode($m[1])), true, 301); exit;
}
// Скачивание положения конкурса (DOCX 1:1 из эталона; генерирует при первом запросе).
// Старые ссылки .../regulation.pdf продолжают работать и отдают актуальный файл.
if (preg_match('#^/competition/([a-z0-9\-]+)/regulation\.(pdf|docx)$#', $route, $m)) {
    $c = one("SELECT * FROM competitions WHERE slug=?", [$m[1]]);
    if ($c) {
        try {
            $reqExt = strtolower($m[2]);
            // PDF-запрос (по умолчанию для «Открыть положение») — отдаём ИНЛАЙН,
            // чтобы положение ОТКРЫВАЛОСЬ в браузере, а не скачивалось.
            if ($reqExt === 'pdf') {
                // 1:1 с эталоном DOCX через LibreOffice (шапка, печать, подпись, гербы).
                $pdfData = '';
                try {
                    require_once BASE_PATH . '/core/regulation_pdf.php';
                    $pdfPath = regulation_pdf($c);
                    if (is_file($pdfPath)) $pdfData = (string) file_get_contents($pdfPath);
                } catch (\Throwable $ePdf) {
                    error_log('regulation_pdf (soffice) failed: ' . $ePdf->getMessage());
                }
                /* ПРЕЖНИЙ ФАЙЛ ЛУЧШЕ САМОДЕЛЬНОГО.
                 *
                 * Здесь стоял фолбэк на старый рисованный генератор
                 * (core/pdf_regulation.php) — «чтобы ссылка не падала». Цена
                 * этой страховки выяснилась 25.08.2026: файлы положений
                 * оказались с чужим владельцем, пересобрать их php-fpm не мог,
                 * и участники вместо утверждённого документа получали
                 * самодельный PDF с наложениями текста и гербов. Владелец
                 * увидел его на боевом конкурсе и назвал отсебятиной — и был
                 * прав: официальный документ подменялся молча.
                 *
                 * Порядок теперь такой: не собралось — отдаём ПРЕЖНИЙ готовый
                 * файл, он утверждён и лежит рядом. Нет и его — честная ошибка,
                 * а не выдуманный документ. */
                if ($pdfData === '' || strncmp($pdfData, '%PDF', 4) !== 0) {
                    $prev = BASE_PATH . '/public/uploads/regulations/' . $c['slug'] . '.pdf';
                    if (is_file($prev) && filesize($prev) > 1000) {
                        $prevData = (string) file_get_contents($prev);
                        if (strncmp($prevData, '%PDF', 4) === 0) {
                            $pdfData = $prevData;
                            error_log('regulation: отдан прежний PDF, пересобрать не удалось — ' . $c['slug']);
                        }
                    }
                }
                if ($pdfData === '' || strncmp($pdfData, '%PDF', 4) !== 0) {
                    throw new \RuntimeException('Не удалось сформировать PDF положения.');
                }
                header('Content-Type: application/pdf');
                header('Content-Disposition: inline; filename="Polozhenie_' . $c['slug'] . '.pdf"');
                header('Content-Length: ' . (string) strlen($pdfData));
                // ПОЛОЖЕНИЕ НЕ КЭШИРУЕМ.
                //
                // Адрес у документа постоянный, а содержимое меняется: оргвзнос,
                // сроки приёма, пункты правил. Браузер и промежуточные прокси
                // держали прежний файл, и владелец, открыв ссылку после смены цены
                // с 500 на 1000 ₽, снова видел 500 — при том, что сервер отдавал
                // уже новый документ. Участник в этот момент читает сумму, по
                // которой платит, поэтому свежесть здесь важнее экономии трафика.
                header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
                header('Pragma: no-cache');
                header('ETag: "' . md5($pdfData) . '"');
                echo $pdfData;
                exit;
            }
            // Явный .docx-запрос — по-прежнему отдаём файлом (для редактирования).
            $path = !empty($c['regulation_pdf']) && is_file($c['regulation_pdf'])
                ? $c['regulation_pdf']
                : null;
            // ЭТАЛОН НОВЕЕ ФАЙЛА — СОБИРАЕМ ЗАНОВО.
            // Иначе после правки правил PDF показывал новый пункт, а скачанный
            // DOCX — старый текст, и два документа одного конкурса расходились.
            $etalonTs = 0;
            foreach (glob(BASE_PATH . '/docs/polozheniya/etalon_*.docx') ?: [] as $eFile) {
                $etalonTs = max($etalonTs, (int) @filemtime($eFile));
            }
            if ($path === null || strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'docx'
                || (int) @filemtime($path) < $etalonTs) {
                require_once BASE_PATH . '/core/regulation_gen.php';
                $path = regulation_generate((int)$c['id']);
            }
            header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            header('Content-Disposition: attachment; filename="Polozhenie_' . $c['slug'] . '.docx"');
            header('Content-Length: ' . (string) filesize($path));
            readfile($path);
            exit;
        } catch (\Throwable $e) {
            http_response_code(500);
            echo 'Не удалось сформировать положение: ' . htmlspecialchars($e->getMessage());
            exit;
        }
    }
    http_response_code(404); echo 'Конкурс не найден'; exit;
}
// Скачивание PDF диплома по номеру. Всегда отдаёт боевой PDF по НАШЕМУ HTML-шаблону:
// если файла нет — рендерит через бастион (diploma_pdf_html), фолбэк — GD-генератор.
if (preg_match('#^/diploma/([A-Za-z0-9\-]+)\.pdf$#', $route, $m)) {
    $d = one("SELECT * FROM diplomas WHERE number=?", [$m[1]]);
    if (!$d) { http_response_code(404); echo 'Диплом не найден'; exit; }
    $app = one("SELECT * FROM applications WHERE id=?", [(int) $d['application_id']]);

    // ЧУЖОЙ ДИПЛОМ ПО ССЫЛКЕ НЕ СКАЧИВАЕТСЯ.
    // Номера идут строго подряд (MM-2026-00001, -00002, …), а свой номер участник
    // узнаёт сразу при подаче. Значит, перебором соседних номеров можно было выкачать
    // дипломы всех детей центра: ФИО, учреждение, город, педагог, звание. Открытым
    // маршрут остаётся только для владельца заявки, оргкомитета и обладателя
    // подписанной ссылки из письма (по ней диплом и приходит участнику).
    $__me   = function_exists('current_user') ? current_user() : null;
    $__mine = $app && $__me && (int) ($app['user_id'] ?? 0) === (int) $__me['id'];
    $__staff = function_exists('user_can') && $__me && user_can('jury');
    require_once BASE_PATH . '/core/paylink.php';   // diploma_sign_ok()
    $__sig   = (string) ($_GET['s'] ?? '');
    $__sigOk = $__sig !== '' && diploma_sign_ok((string) $d['number'], $__sig);
    if (!$__mine && !$__staff && !$__sigOk) {
        http_response_code(403);
        echo 'Этот документ доступен только участнику. Войдите в личный кабинет — все Ваши дипломы там.';
        exit;
    }
    // НАГРАДНЫЙ МАТЕРИАЛ ОТКРЫВАЕТСЯ НЕ РАНЬШЕ, ЧЕМ УХОДИТ НА ПОЧТУ.
    //
    // Номер диплома известен участнику с момента изготовления, а изготавливается
    // он за несколько дней до отправки. По прямой ссылке звание можно было узнать
    // заранее — в том числе по конкурсу, итоги которого ещё не объявлены.
    if ($__mine && !$__staff && !$__sigOk && trim((string) ($d['sent_at'] ?? '')) === '') {
        http_response_code(403);
        echo 'Наградный материал ещё готовится. Он придёт на почту из заявки и появится в личном кабинете.';
        exit;
    }
    require_once BASE_PATH . '/core/diploma_render.php';

    $file = '';
    $stored = trim((string) ($d['pdf_path'] ?? ''));
    if ($stored !== '' && !str_starts_with($stored, 'http')) {
        $abs = $stored[0] === '/' && str_starts_with($stored, '/var') ? $stored
             : BASE_PATH . '/public/' . ltrim($stored, '/');
        if (is_file($abs) && filesize($abs) > 20000) $file = $abs;
    }
    // Рендер боевого шаблона (кэшируем: сохраняем веб-путь в pdf_path)
    if ($file === '' && $app) {
        // Тип диплома → правильная награда (основной/доп/именной/благодарность).
        $dt   = (string) ($d['type'] ?? 'main');
        $rOpt = ['thanks' => $dt === 'thanks', 'extra' => $dt === 'extra', 'named' => $dt === 'named'];
        $rendered = diploma_pdf_html($app, $rOpt);
        if ($rendered && is_file($rendered)) {
            $file = $rendered;
            update('diplomas', ['pdf_path' => '/diplomas/' . basename($rendered)], 'id=:id', ['id' => (int) $d['id']]);
        }
    }
    // Фолбэк — GD-генератор (если бастион недоступен)
    if ($file === '' && $app && function_exists('pdf_diploma')) {
        try { $gd = pdf_diploma($app, (string) ($d['type'] ?: 'main')); if ($gd && is_file($gd)) $file = $gd; }
        catch (\Throwable $e) { /* ниже 404 */ }
    }
    if ($file === '') { http_response_code(404); echo 'Диплом ещё формируется, попробуйте через минуту'; exit; }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="Diploma_' . $d['number'] . '.pdf"');
    header('Content-Length: ' . (string) filesize($file));
    readfile($file);
    exit;
}
// Визуальный просмотр диплома (реальный HTML-шаблон, для реестра и кабинета).
if (preg_match('#^/diploma-view/([A-Za-z0-9\-]+)$#', $route, $m)) {
    $d = one("SELECT * FROM diplomas WHERE number=?", [$m[1]]);
    if (!$d) { http_response_code(404); echo 'Диплом не найден'; exit; }
    $app = one("SELECT * FROM applications WHERE id=?", [(int) $d['application_id']]);

    // Тот же замок, что и на PDF: это полный бланк с ФИО, учреждением и городом,
    // а номера перебираются подряд. Открыт владельцу, сотруднику и подписанной
    // ссылке из письма.
    require_once BASE_PATH . '/core/paylink.php';
    $__me    = function_exists('current_user') ? current_user() : null;
    $__mine  = $app && $__me && (int) ($app['user_id'] ?? 0) === (int) $__me['id'];
    $__staff = function_exists('user_can') && $__me && user_can('jury');
    $__sig   = (string) ($_GET['s'] ?? '');
    $__sigOk2 = $__sig !== '' && diploma_sign_ok((string) $d['number'], $__sig);
    if (!$__mine && !$__staff && !$__sigOk2) {
        http_response_code(403);
        echo 'Этот документ доступен только участнику. Проверить подлинность диплома по номеру можно на странице «Проверка документа».';
        exit;
    }
    // До отправки бланк не показываем даже владельцу: см. соседний маршрут.
    if ($__mine && !$__staff && !$__sigOk2 && trim((string) ($d['sent_at'] ?? '')) === '') {
        http_response_code(403);
        echo 'Наградный материал ещё готовится. Он придёт на почту из заявки и появится в личном кабинете.';
        exit;
    }
    $c   = $app ? one("SELECT * FROM competitions WHERE id=?", [(int) $app['competition_id']]) : null;
    require_once BASE_PATH . '/core/diploma_html.php';
    // Тип диплома → правильная награда: основной=result, доп=спец-номинация,
    // именной=ФИО участника, благодарность=ФИО педагога.
    $opt = [];
    $dtype = (string) ($d['type'] ?? 'main');
    if ($dtype === 'thanks') { $opt['thanks'] = true; if (!empty($app['teacher'])) $app['full_name'] = $app['teacher']; }
    elseif ($dtype === 'extra') { $opt['extra'] = true; }
    elseif ($dtype === 'named') { $opt['named'] = true; }
    echo diploma_html($c ?: [], $app ?: [], $opt);
    exit;
}
// ОФИЦИАЛЬНОЕ ОБРАЩЕНИЕ: просмотр и приватный рендер под печать.
//
// /letter-view/<номер>?s=<подпись> — готовый документ на бланке. Подпись обязательна:
// в обращении есть ФИО и должность адресата, а номера идут подряд — без замка
// весь реестр выгружался бы перебором. Ссылку с подписью несёт письмо адресату.
// Страница /letter/<номер> (проверка подлинности) остаётся открытой всем: там
// только факт выдачи, дата и название организации.
if (preg_match('#^/letter-view/([0-9]{6,8})/([0-9]{1,6})$#', $route, $m)) {
    require_once BASE_PATH . '/core/letter_texts.php';
    ol_migrate();
    $__num = $m[1] . '/' . $m[2];
    $__row = one("SELECT * FROM official_letters WHERE number=?", [$__num]);
    if (!$__row) { http_response_code(404); echo 'Документ не найден'; exit; }

    $__me    = function_exists('current_user') ? current_user() : null;
    $__staff = function_exists('user_can') && $__me && user_can('moderator');
    $__sig   = (string) ($_GET['s'] ?? '');
    if (!$__staff && !($__sig !== '' && hash_equals(ol_sign($__num), $__sig))) {
        http_response_code(403);
        echo 'Документ доступен по ссылке из письма. Проверить его подлинность по номеру можно на странице «Проверка документа».';
        exit;
    }
    $__html = ol_html_for($__num, [
        'kind'        => (string) $__row['kind'],
        'org'         => (string) $__row['org'],
        'person'      => (string) $__row['person'],
        'person_role' => (string) $__row['person_role'],
        'region'      => (string) $__row['region'],
    ]);
    render_page('Обращение № ' . $__num,
        '<section class="section"><div class="container" style="max-width:900px">'
        . '<div class="ol-actions" style="display:flex;gap:10px;justify-content:center;margin-bottom:16px">'
        . '<button type="button" class="btn btn--primary" onclick="window.print()">Распечатать</button>'
        . '<a class="btn btn--ghost" href="' . h(url('/apply')) . '">Подать заявку</a>'
        . '</div>' . $__html . '</div></section>',
        ['active' => '/contacts', 'meta' => 'Официальное обращение Культурного центра «Музыкальный Мир».']);
    exit;
}

// Приватный рендер обращения для печати в PDF бастионом (тот же ключ, что у дипломов).
// Отдаём голый документ без шапки сайта и меню: на лист попадает только бланк.
if (preg_match('#^/letter-render/([0-9]{6,8})/([0-9]{1,6})$#', $route, $m)) {
    $key  = (string) ($_GET['key'] ?? '');
    $good = (string) setting('diploma_render_key', '');
    if ($good === '' || $key === '' || !hash_equals($good, $key)) { http_response_code(404); echo 'Не найдено'; exit; }

    require_once BASE_PATH . '/core/letter_texts.php';
    ol_migrate();
    $__num = $m[1] . '/' . $m[2];
    $__row = one("SELECT * FROM official_letters WHERE number=?", [$__num]);
    if (!$__row) { http_response_code(404); echo 'Не найдено'; exit; }

    $__html = ol_html_for($__num, [
        'kind'        => (string) $__row['kind'],
        'org'         => (string) $__row['org'],
        'person'      => (string) $__row['person'],
        'person_role' => (string) $__row['person_role'],
        'region'      => (string) $__row['region'],
        // ?light=1 — картинки ссылками, а не base64. Нужно, чтобы документ можно
        // было быстро посмотреть или переслать: со встроенными картинками файл
        // весит под мегабайт, и это оправдано только при печати в PDF.
        'embed'       => empty($_GET['light']),
    ]);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
       . '<title>Обращение № ' . h($__num) . '</title>'
       . '<style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}'
       . '.ol-sheet{border:0 !important;box-shadow:none !important;border-radius:0 !important;'
       . 'max-width:none !important;margin:0 !important}</style></head><body>'
       . $__html . '</body></html>';
    exit;
}

/* Приватный рендер афиши конкурса — бастион снимает с этой страницы картинку.
 *
 * Ключ тот же, что у диплома: страница служебная, в поиске ей делать нечего, а
 * заводить второй секрет ради того же самого бастиона — лишняя сущность,
 * которую однажды забудут обновить. */
/* ЗАПИСЬ ДЛЯ РАЗБОРА — МОСТУ, НА ПОЛЧАСА И ПО НЕУГАДЫВАЕМОМУ АДРЕСУ.
 *
 * Аттестация идёт через браузер агента на мосту (см. ag_ask_bridge), и мосту
 * нужно откуда-то взять конкурсную запись. Гнать её в теле команды нельзя —
 * это десятки мегабайт, поэтому мост забирает файл сам вот отсюда.
 *
 * Почему это безопасно: имя файла — 32 случайных знака, угадать нельзя;
 * каталог лежит вне веб-корня и наружу иначе не отдаётся; файл живёт полчаса
 * и стирается сразу после разбора. Ничего, кроме этого каталога, маршрут не
 * отдаёт: имя проверяется шаблоном, никаких «..» в путь не попадёт.
 */
if (preg_match('#^/grade-media/([0-9a-f]{32})/(\d+)$#', $route, $m)) {
    /* БЕЗ РАСШИРЕНИЯ В АДРЕСЕ. Сначала маршрут был вида «…/0.png», и наружу он
       отдавал 404 от nginx: запросы с расширением картинки уходят в статику и
       до PHP не доходят вовсе. Поэтому расширение не в адресе, а ищется на
       диске по имени — тип отдаём заголовком. */
    $base = BASE_PATH . '/data/grade_share/' . strtolower($m[1]) . '_' . (int) $m[2] . '.';
    $file = '';
    foreach (glob($base . '*') ?: [] as $cand) { $file = $cand; break; }
    if ($file === '' || !is_file($file) || (time() - (int) @filemtime($file)) > 1800) {
        http_response_code(404); echo 'Не найдено'; exit;
    }
    $mime = ['mp4' => 'video/mp4', 'mp3' => 'audio/mpeg', 'm4a' => 'audio/mp4', 'wav' => 'audio/wav',
             'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp']
            [strtolower(pathinfo($file, PATHINFO_EXTENSION))] ?? 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . (string) filesize($file));
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store');
    readfile($file);
    exit;
}

if (preg_match('#^/afisha-render/(\d+)$#', $route, $m)) {
    $key  = (string) ($_GET['key'] ?? '');
    $good = (string) setting('diploma_render_key', '');
    $c    = one("SELECT * FROM competitions WHERE id=?", [(int) $m[1]]);
    if (!$c || $good === '' || $key === '' || !hash_equals($good, $key)) {
        http_response_code(404); echo 'Не найдено'; exit;
    }
    require_once BASE_PATH . '/core/afisha_html.php';
    $opt = [];
    $bg = trim((string) ($_GET['bg'] ?? ''));
    // Путь к фону приходит из админки и от сборщика. Пускаем только внутрь
    // каталога загрузок: иначе параметром можно было бы затащить в афишу любой
    // файл сервера, включая чужой диплом или бланк.
    if ($bg !== '' && preg_match('~^uploads/[a-z0-9/_.-]+\.(jpe?g|png|webp)$~i', $bg) && !str_contains($bg, '..')) {
        $opt['bg'] = $bg;
    }
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex, nofollow');
    echo afisha_html($c, $opt);
    exit;
}

// Приватный рендер боевого диплома для PDF-печати бастионом (ключ в settings).
if (preg_match('#^/diploma-render/(\d+)$#', $route, $m)) {
    $key  = (string)($_GET['key'] ?? '');
    $good = (string) setting('diploma_render_key', '');
    $app  = one("SELECT * FROM applications WHERE id=?", [(int)$m[1]]);
    if (!$app || $good === '' || $key === '' || !hash_equals($good, $key)) {
        http_response_code(404); echo 'Не найдено'; exit;
    }
    $c = one("SELECT * FROM competitions WHERE id=?", [(int)$app['competition_id']]);
    require_once BASE_PATH . '/core/diploma_html.php';
    require_once BASE_PATH . '/core/pdf_diploma.php';   // diploma_make_number()
    $opt = [];
    $rtype = (string)($_GET['type'] ?? '');
    if ($rtype === 'thanks') {
        $opt['thanks'] = true;
        // Благодарность — ОДНОМУ педагогу. ФИО берём из заказа (person), иначе
        // одного педагога из заявки; двух имён на бланке быть не может.
        $opt['person']     = trim((string) ($_GET['person'] ?? ''));
        $opt['person_idx'] = (int) ($_GET['pidx'] ?? 0);
    } elseif ($rtype === 'extra') {
        $opt['extra'] = true;  // отдельный дополнительный диплом (спецноминация)
    } elseif ($rtype === 'named') {
        $opt['named'] = true;  // именной диплом (участник в составе коллектива)
    }
    // ЧИСТЫЙ оригинал (без подписи/печати) — для типографии/изготовления. Номер+QR остаются.
    if (!empty($_GET['clean'])) $opt['clean'] = true;
    // ЖЁСТКОЕ ПРАВИЛО: номер диплома всегда корректный (по типу), совпадает с реестром /verify.
    if (function_exists('diploma_make_number')) {
        // Благодарность второму руководителю коллектива получает свой номер:
        // на бланке и в реестре он должен совпадать, иначе проверка подлинности
        // приведёт к бланку коллеги.
        // Индекс получателя считается ОДНОЙ функцией на печать и на реестр
        // (core/pdf_diploma.php): разъедься эти два расчёта, и QR снова поведёт
        // в «диплом не найден».
        $tIdx = $rtype === 'thanks'
            ? diploma_person_index((string) ($app['teacher'] ?? ''),
                                   (string) ($opt['person'] ?? ''),
                                   (int) ($opt['person_idx'] ?? 0))
            : 0;
        $opt['number'] = diploma_make_number((string)($app['number'] ?? ''), $rtype ?: 'main', $tIdx);
    }
    echo diploma_html($c ?: [], $app, $opt);
    exit;
}

// Приватная страница сертификата участника Клуба — её печатает бастион (альбомный А4).
if (preg_match('#^/club-cert-render/(\d+)$#', $route, $m)) {
    $key  = (string) ($_GET['key'] ?? '');
    $good = (string) setting('diploma_render_key', '');
    $usr  = one("SELECT id, full_name, email FROM users WHERE id=?", [(int) $m[1]]);
    if (!$usr || $good === '' || $key === '' || !hash_equals($good, $key)) {
        http_response_code(404); echo 'Не найдено'; exit;
    }
    require_once BASE_PATH . '/core/club_cert.php';
    echo club_cert_html($usr, club_status((int) $usr['id']));
    exit;
}

// Сертификат участника Клуба (PDF) — только самому активному участнику Клуба.
if ($route === '/club/certificate.pdf') {
    $usr = current_user();
    require_once BASE_PATH . '/core/club_cert.php';
    if (!$usr || !club_is_active((int) $usr['id'])) {
        header('Location: ' . url('/club')); exit;
    }
    $pdf = club_cert_pdf((int) $usr['id'], isset($_GET['regen']));
    if (!$pdf || !is_file($pdf)) {
        http_response_code(503);
        echo 'Сертификат сейчас не удалось изготовить. Попробуйте через несколько минут.';
        exit;
    }
    header('Content-Type: application/pdf');
    header('Content-Length: ' . filesize($pdf));
    header('Content-Disposition: inline; filename="sertifikat-kluba.pdf"');
    readfile($pdf);
    exit;
}

// Демо-образец диплома конкурса (HTML-сборщик по эталону, водяной знак «ОБРАЗЕЦ»).
if (preg_match('#^/diploma-sample/([a-z0-9\-]+)$#', $route, $m)) {
    $c = one("SELECT * FROM competitions WHERE slug=?", [$m[1]]);
    if ($c) {
        require_once BASE_PATH . '/core/diploma_html.php';
        $opt = ['sample' => true];
        if (isset($_GET['thanks'])) $opt['thanks'] = true;
        if (isset($_GET['extra']))  $opt['extra']  = true;
        if (isset($_GET['named']))  $opt['named']  = true;
        echo diploma_html($c, diploma_sample_app(), $opt);
        exit;
    }
    http_response_code(404); echo 'Конкурс не найден'; exit;
}
if (preg_match('#^/awards/([a-z0-9\-]+)$#', $route, $m)) serve('awards_competition', ['slug' => $m[1]]);
if (preg_match('#^/artist/([a-z0-9\-]+)$#', $route, $m)) serve('artist', ['slug' => $m[1]]);
if (preg_match('#^/pedagog/([a-z0-9\-]+)$#', $route, $m)) serve('teacher_profile', ['slug' => $m[1]]);
if (preg_match('#^/results/([a-z0-9\-]+)$#', $route, $m)) serve('results', ['slug' => $m[1]]);
if (preg_match('#^/blog/([a-z0-9\-]+)$#', $route, $m)) serve('blog', ['slug' => $m[1]]);

// Статические маршруты → файл страницы
// Прим.: параметр возврата после OAuth (?auth=ok) не требует маршрута —
// роутер работает только по PATH, query-строка проходит на любой маршрут
// (напр. /cabinet?auth=ok). /welcome — необязательная точка входа: рендерит
// главную, где срабатывает глобальная модалка входа .auth-modal.
$map = [
    '/' => 'home',
    '/welcome' => 'home',
    '/menu' => 'menu',
    '/competitions' => 'competitions',
    '/apply' => 'apply',
    '/goals' => 'page_goals',
    '/ministry-support' => 'ministry',
    '/awards' => 'awards',
    '/regulations' => 'regulations',
    '/order-awards' => 'order_awards',
    '/concerts' => 'concerts',
    '/blog' => 'blog',
    '/about' => 'about',
    '/reviews' => 'reviews',
    '/faq' => 'faq',
    '/contacts' => 'contacts',
    '/agreement' => 'legal_agreement',
    '/privacy' => 'legal_privacy',
    '/login' => 'login',
    '/register' => 'register',
    '/logout' => 'logout',
    '/forgot' => 'forgot',
    '/reset-password' => 'reset_password',
    '/verify-email' => 'verify_email',
    '/cabinet' => 'cabinet',
    // Прямая оплата конкретного счёта из письма/уведомления → сразу форма ЮKassa.
    '/pay' => 'pay',
    '/pay-status' => 'pay_status',
    '/notifications' => 'notifications',
    '/chat' => 'chat',
    '/results' => 'results_index',
    '/teacher' => 'teacher',
    '/calendar' => 'calendar',
    '/gala' => 'gala',
    '/partner' => 'partner',
    '/club' => 'club',
    '/widget' => 'widget',
    // Печатное информационное письмо для учреждений: секретарь распечатывает и
    // вешает в учительской. Лист на доске объявлений живёт дольше письма в почте.
    '/invite' => 'invite',
    // Согласие учреждения на партнёрство одним нажатием из письма-приглашения.
    '/partner-join' => 'partner_join',
];

// Telegram Mini App = сам сайт (не отдельная витрина): /tma отдаёт полную главную с TG-адаптацией
// ($_GET['tg'] включает in-tg режим в layout; дальше контекст держит кука mz_tg на всех страницах).
if ($route === '/tma') { $_GET['tg'] = '1'; serve('home'); }

if (isset($map[$route]) && is_file($pagesDir . '/' . $map[$route] . '.php')) {
    serve($map[$route]);
}

// 404
http_response_code(404);
require_once BASE_PATH . '/core/helpers.php';
render_page('Страница не найдена', '<section class="section"><div class="container" style="text-align:center">'
    . '<h1>404</h1><p>Такой страницы нет. Вернитесь на <a href="' . url('/') . '">главную</a>.</p></div></section>');
