<?php
/* ══════════════════════════════════════════════════════════
   Rocket CDN · API сайта и админки
   Публичное: lead, callback, track, content
   По ключу:  stats, leads, lead_status, lead_delete, content_save,
              nodes_save, export, errors, settings
   ══════════════════════════════════════════════════════════ */

require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');

/* ── Чужой домен пускаем ПОИМЕННО ──────────────────────────
   Панель и счётчик теперь общие на два сайта, и страница с
   rocketvpn.top обращается сюда, на rocketcdn.ru. Браузер такой
   запрос без разрешения не пустит.

   Список закрытый, звёздочки нет. Открытый доступ означал бы, что
   любая страница в интернете может дёргать наш счётчик и наши
   заявки от имени человека, зашедшего к нам. */
$СВОИ = ['https://rocketvpn.top', 'https://www.rocketvpn.top',
         'https://rocketcdn.ru', 'https://www.rocketcdn.ru'];
$откуда = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($откуда !== '' && in_array($откуда, $СВОИ, true)) {
    header('Access-Control-Allow-Origin: ' . $откуда);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Max-Age: 86400');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$raw    = file_get_contents('php://input');
$body   = $raw ? (json_decode($raw, true) ?: []) : [];

function out($d) { echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }

/* Ответить человеку сейчас, а долгие дела доделать после ответа.

   Заявка уходит в Телеграм и двумя письмами, и всё это человек ждал
   стоя у формы. Телеграм с этой площадки отвечает через раз, письма
   идут через сторонний SMTP - в плохую минуту «Заявка принята»
   появлялось почти через минуту, и люди жали кнопку второй раз.
   Заявка к этому моменту уже сохранена, ответ честный.

   fastcgi_finish_request закрывает ответ браузеру и оставляет php
   доработать. Там, где её нет (встроенный сервер php на стенде),
   возвращаем false: тогда ответ уже отдан echo, и второй раз писать
   его нельзя. */
function rc_ответить_и_продолжить($d) {
    ignore_user_abort(true);
    echo json_encode($d, JSON_UNESCAPED_UNICODE);
    if (function_exists('fastcgi_finish_request')) { @fastcgi_finish_request(); return true; }
    if (function_exists('litespeed_finish_request')) { @litespeed_finish_request(); return true; }
    @ob_flush(); @flush();
    return false;
}
function inp($k, $d = '') {
    global $body;
    $v = $body[$k] ?? $_POST[$k] ?? $_GET[$k] ?? $d;
    return is_string($v) ? trim($v) : $v;
}
/* Пропуск панели: временный, выдаётся на вход и живёт две недели.

   Раньше в браузере лежал сам пароль от админки, открытым текстом в
   localStorage: чужой скрипт на странице, чужие руки на ноутбуке или
   расширение читали его целиком, и отозвать его можно было только
   сменой пароля на сервере. Теперь браузер держит пропуск: он ничего
   не говорит о пароле, протухает сам и отзывается по кнопке «выйти».

   Файл пропусков лежит в папке данных, выше корня сайта. Если писать
   туда не выходит, вход всё равно работает по паролю - панель просто
   спросит его снова после перезагрузки. Молча отказать во входе
   из-за прав на папку было бы хуже. */
function rc_pass_file() { return RC_DATA . '/admin_pass.json'; }

function rc_pass_new() {
    try {
        $t = bin2hex(random_bytes(24));
    } catch (Throwable $e) {
        return '';
    }
    $ok = rc_json_update(rc_pass_file(), function ($d) use ($t) {
        $сейчас = time();
        $чисто = [];
        /* Заодно выметаем протухшие: файл не должен расти вечно. */
        foreach ((array)$d as $х => $до) {
            if (is_int($до) && $до > $сейчас) $чисто[$х] = $до;
        }
        $чисто[hash('sha256', $t)] = $сейчас + 14 * 86400;
        return $чисто;
    });
    return $ok === false ? '' : $t;
}

function rc_pass_ok($t) {
    if (!is_string($t) || strlen($t) !== 48) return false;
    $d = rc_json_read(rc_pass_file(), []);
    $до = $d[hash('sha256', $t)] ?? 0;
    return is_int($до) && $до > time();
}

function rc_pass_drop($t) {
    if (!is_string($t) || $t === '') return;
    rc_json_update(rc_pass_file(), function ($d) use ($t) {
        unset($d[hash('sha256', $t)]);
        return $d;
    });
}

/* Секрет приходит телом запроса или заголовком, но НЕ адресом.

   inp() смотрит и в $_GET, а всё, что попало в адрес, оседает в
   журнале nginx открытым текстом и живёт там месяцами. Панель и так
   шлёт пароль телом, поэтому запрет ничего не ломает, но закрывает
   дорогу любой будущей ссылке вида api.php?action=leads&key=... */
function rc_secret($k) {
    global $body;
    $v = $body[$k] ?? $_POST[$k] ?? '';
    if ($v === '' && $k === 'pass') {
        $v = $_SERVER['HTTP_X_RC_PASS'] ?? '';
    }
    return is_string($v) ? trim($v) : '';
}

function need_key() {
    $real = (string)rc_cfg('admin_key');
    /* Пока пароль не сменили, закрытые разделы не работают вовсе:
       иначе заявки с персональными данными открыты всему интернету. */
    if ($real === '' || $real === 'rocket2026') {
        out(['ok' => false, 'error' => 'default_key',
             'message' => 'Смените admin_key в config.local.php, пароль по умолчанию заблокирован.']);
    }
    if (rc_pass_ok(rc_secret('pass'))) return;
    $k = rc_secret('key');
    if ($k === '' || !hash_equals($real, $k)) out(['ok' => false, 'error' => 'auth']);
}
/* Заголовки пересылки подделываются одной строкой в curl, поэтому
   доверяем им только когда запрос действительно пришёл от нашего
   прокси (список задаётся ключом trusted_proxies в config.local.php). */
function client_ip() {
    $remote = $_SERVER['REMOTE_ADDR'] ?? '';
    $trusted = (array)rc_cfg('trusted_proxies', []);
    if ($remote !== '' && in_array($remote, $trusted, true)) {
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR'] as $h) {
            if (!empty($_SERVER[$h])) return trim(explode(',', $_SERVER[$h])[0]);
        }
    }
    return $remote;
}
function device_of($ua) {
    $ua = strtolower($ua);
    if (strpos($ua, 'ipad') !== false || strpos($ua, 'tablet') !== false) return 'tablet';
    if (preg_match('~iphone|android|mobile|phone~', $ua)) return 'mobile';
    return 'desktop';
}
function os_of($ua) {
    $ua = strtolower($ua);
    if (strpos($ua, 'iphone') !== false || strpos($ua, 'ipad') !== false) return 'iOS';
    if (strpos($ua, 'android') !== false) return 'Android';
    if (strpos($ua, 'windows') !== false) return 'Windows';
    if (strpos($ua, 'mac os') !== false)  return 'macOS';
    if (strpos($ua, 'linux') !== false)   return 'Linux';
    return 'другое';
}
/* Разрез по сайту берётся из запроса, поэтому rc_site живёт здесь,
   рядом с inp(). Имена сайтов и путь к файлу статистики нужны ещё и
   отчётам в Телеграм, они лежат в config.php. */
function rc_site($имя = null) {
    $s = $имя === null ? (string)inp('site', 'cdn') : (string)$имя;
    return isset(rc_sites()[$s]) ? $s : 'cdn';
}


/* Ограничение частоты: не более N обращений с адреса за окно */
function rate_ok($bucket, $limit, $window) {
    $f = RC_DATA . '/rate_' . $bucket . '.json';
    $ip = client_ip() ?: 'na';
    $now = time();
    $hit = false;
    rc_json_update($f, function ($d) use ($ip, $now, $limit, $window, &$hit) {
        foreach ($d as $k => $v) if ($v['t'] < $now - $window) unset($d[$k]);
        $rec = $d[$ip] ?? ['t' => $now, 'n' => 0];
        if ($rec['t'] < $now - $window) $rec = ['t' => $now, 'n' => 0];
        $rec['n']++;
        $hit = $rec['n'] <= $limit;
        $d[$ip] = $rec;
        return $d;
    });
    return $hit;
}

/* Общий предел, без привязки к адресу */
function rate_global($bucket, $limit, $window) {
    $f = RC_DATA . '/rate_' . $bucket . '.json';
    $now = time();
    $ok = false;
    rc_json_update($f, function ($d) use ($now, $limit, $window, &$ok) {
        if (($d['t'] ?? 0) < $now - $window) $d = ['t' => $now, 'n' => 0];
        $d['n'] = ($d['n'] ?? 0) + 1;
        $ok = $d['n'] <= $limit;
        return $d;
    });
    return $ok;
}

/* ══ Приём события аналитики ══════════════════════════════ */
if ($action === 'track') {
    $events = $body['events'] ?? [];
    if (!is_array($events) || !count($events)) out(['ok' => true]);
    /* Пачку режем: иначе одним запросом можно накрутить счётчики
       и завалить чат уведомлениями об ошибках. */
    if (count($events) > 25) $events = array_slice($events, 0, 25);
    if (!rate_ok('track', 400, 300)) out(['ok' => true]);

    $ua  = substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 300);
    $sid = substr((string)($body['sid'] ?? ''), 0, 40);
    $ref = substr((string)($body['ref'] ?? ''), 0, 200);
    $refHost = $ref ? (parse_url($ref, PHP_URL_HOST) ?: '') : '';
    $self = parse_url(rc_cfg('site_url'), PHP_URL_HOST);
    if ($refHost === $self) $refHost = '';

    $сайт = rc_site();
    $fresh = [];
    rc_json_update(stat_file(null, $сайт), function ($d) use ($events, $ua, $sid, $refHost, &$fresh, $сайт) {
        $d['site'] = $сайт;
        $d['day']      = $d['day']      ?? date('Y-m-d');
        $d['views']    = $d['views']    ?? 0;
        $d['uniq']     = $d['uniq']     ?? [];
        $d['events']   = $d['events']   ?? [];
        $d['hours']    = $d['hours']    ?? [];
        $d['devices']  = $d['devices']  ?? [];
        $d['os']       = $d['os']       ?? [];
        $d['refs']     = $d['refs']     ?? [];
        $d['scroll']   = $d['scroll']   ?? [];
        $d['акты']     = $d['акты']     ?? [];
        $d['nodes']    = $d['nodes']    ?? [];
        $d['searches'] = $d['searches'] ?? [];
        $d['errors']   = $d['errors']   ?? [];

        $isNew = $sid && !isset($d['uniq'][$sid]);
        if ($isNew) $d['uniq'][$sid] = 1;

        foreach ($events as $e) {
            $type  = substr((string)($e['t'] ?? ''), 0, 20);
            /* Ошибке нужно больше места, чем метке перехода. Восьмидесяти
               байт хватало ровно на текст исключения, а имя файла и номер
               строки обрезались: в журнале оставалось «@ rc-fl», то есть
               именно то, ради чего ошибку и собирают. Двести байт возвращают
               адрес. Остальным типам восьмидесяти по-прежнему довольно, и
               защита от раздувания файла (сорок разных за сутки) на месте.

               Режем по символам, а не по байтам: в метках поиска и
               источника бывает кириллица, и substr рвал её пополам. */
            $предел = ($type === 'jserr') ? 200 : 80;
            $сырое = (string)($e['l'] ?? '');
            $label = function_exists('mb_substr')
                ? mb_substr($сырое, 0, $предел, 'UTF-8')
                : substr($сырое, 0, $предел);
            if ($type === '') continue;
            $d['events'][$type] = ($d['events'][$type] ?? 0) + 1;

            if ($type === 'view') {
                $d['views']++;
                $h = date('H');
                $d['hours'][$h] = ($d['hours'][$h] ?? 0) + 1;
                if ($isNew) {
                    $dev = device_of($ua);
                    $d['devices'][$dev] = ($d['devices'][$dev] ?? 0) + 1;
                    $o = os_of($ua);
                    $d['os'][$o] = ($d['os'][$o] ?? 0) + 1;
                    $r = $refHost ?: 'прямой заход';
                    $d['refs'][$r] = ($d['refs'][$r] ?? 0) + 1;
                }
            }
            if ($type === 'scroll') $d['scroll'][$label] = ($d['scroll'][$label] ?? 0) + 1;
            /* Акты фильма VPN держим поимённо. Общего счётчика мало:
               по нему видно «сто событий акта» и не видно, на каком
               именно акте люди уходят, а весь смысл фильма в том, где
               обрывается путь. Разных имён восемь, файл от этого не
               растёт. */
            if ($type === 'акт' && $label !== '') $d['акты'][$label] = ($d['акты'][$label] ?? 0) + 1;
            if ($type === 'node')   $d['nodes'][$label]  = ($d['nodes'][$label] ?? 0) + 1;
            if ($type === 'search' && $label !== '') $d['searches'][$label] = ($d['searches'][$label] ?? 0) + 1;
            if ($type === 'jserr') {
                /* Разных текстов ошибок за сутки держим не больше сорока,
                   иначе подделанным потоком раздувается файл статистики. */
                if (!isset($d['errors'][$label]) && count($d['errors']) >= 40) continue;
                $d['errors'][$label] = ($d['errors'][$label] ?? 0) + 1;
                if ($d['errors'][$label] === 1) $fresh[] = $label;
            }
        }
        /* Список уникальных не должен разрастаться бесконечно */
        if (count($d['uniq']) > 20000) $d['uniq'] = array_slice($d['uniq'], -12000, null, true);
        return $d;
    });

    /* Уведомление шлём уже вне блокировки файла и не чаще пяти раз в час,
       чтобы всплеск ошибок не превратился в поток сообщений. */
    if ($fresh && rate_ok('errnotify', 5, 3600)) {
        $list = array_slice($fresh, 0, 5);
        $имяС = rc_sites()[$сайт] ?? $сайт;
        rc_notify("<b>Ошибка · " . htmlspecialchars($имяС) . "</b>\n<code>"
            . htmlspecialchars(implode("\n", $list)) . "</code>", null, 'tg_topic_error');
    }
    out(['ok' => true]);
}

/* ══ Заявка с сайта или обратный звонок ═══════════════════ */
if ($action === 'lead' || $action === 'callback') {
    $kind    = inp('kind', $action === 'callback' ? 'callback' : 'lead');
    $name    = mb_substr(inp('name'), 0, 80);
    $contact = mb_substr(inp('contact'), 0, 120);
    $company = mb_substr(inp('company'), 0, 120);
    $topic   = mb_substr(inp('topic'), 0, 60);
    $task    = mb_substr(inp('task'), 0, 2000);
    $consent = (int)inp('consent', 0);
    $trap    = inp('website');           /* ловушка для ботов */

    if ($trap !== '')            out(['ok' => true]);
    if ($name === '')            out(['ok' => false, 'error' => 'name']);
    $isMail  = (bool)filter_var($contact, FILTER_VALIDATE_EMAIL);
    $isPhone = strlen(preg_replace('~\D~', '', $contact)) >= 10;
    /* Ник в Телеграме тоже контакт, и в мини-приложении он основной:
       оно подставляет ник человека само. Раньше сервер такую заявку
       отвергал, и человек внутри Телеграма получал «проверьте телефон
       или почту» на поле, которое заполнил не он. */
    $isTg    = (bool)preg_match('~^(?:@|(?:https?://)?t\.me/)[A-Za-z0-9_]{4,32}$~', $contact);
    if (!$isMail && !$isPhone && !$isTg) out(['ok' => false, 'error' => 'contact']);
    if (!$consent)               out(['ok' => false, 'error' => 'consent']);

    /* Пределы считаем после разбора, а не до него. Счётчик тратит
       только заявка, дошедшая до записи: раньше восемь опечаток в
       телефоне запирали человека на час вместе с ботами. */
    if (!rate_ok('lead', 8, 3600)) out(['ok' => false, 'error' => 'too_many']);
    /* Предел на весь сайт, а не только на адрес: с ботнета адреса разные,
       а письма и сообщения уходят с нашего ящика. */
    if (!rate_global('lead_total', 120, 86400)) out(['ok' => false, 'error' => 'too_many']);

    $lead = [
        'id'      => substr(md5($contact . microtime(true)), 0, 10),
        /* С какого сайта пришла. Без этого в общей панели заявки двух
           сайтов сливаются в одну кучу, и по ним нельзя ни отвечать
           по адресу, ни считать воронку каждого. */
        'site'    => rc_site(),
        'kind'    => $kind === 'callback' ? 'callback' : 'lead',
        'name'    => $name,
        'contact' => $contact,
        'company' => $company,
        'topic'   => $topic,
        'task'    => $task,
        'lang'    => inp('lang', 'ru'),
        'status'  => 'new',
        'ts'      => date('Y-m-d H:i:s'),
        'ip'      => client_ip(),
        'ua'      => substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200),
        'page'    => mb_substr(inp('page'), 0, 120),
    ];

    rc_json_update(RC_LEADS, function ($d) use ($lead) {
        $d['items'] = $d['items'] ?? [];
        $d['items'][] = $lead;
        return $d;
    });
    rc_json_update(stat_file(null, $lead['site']), function ($d) use ($lead) {
        /* Заявки с формы и заявки на звонок считаем раздельно, чтобы не задваивать */
        if ($lead['kind'] === 'callback') $d['callbacks'] = ($d['callbacks'] ?? 0) + 1;
        else                              $d['leads']     = ($d['leads'] ?? 0) + 1;
        return $d;
    });

    /* Заявка записана - человеку больше ждать нечего. Отбивки в
       Телеграм и письма идут уже после ответа. */
    rc_ответить_и_продолжить(['ok' => true, 'id' => $lead['id']]);

    /* В Телеграм */
    $имяСайта = rc_sites()[$lead['site']] ?? 'Rocket CDN';
    $title = ($lead['kind'] === 'callback' ? 'Заявка на звонок' : 'Новая заявка')
           . ' · ' . $имяСайта;
    $txt = "<b>{$title}</b>\n\n"
         . "Имя: <b>" . htmlspecialchars($name) . "</b>\n"
         . "Контакт: <code>" . htmlspecialchars($contact) . "</code>\n"
         . ($company ? "Компания: " . htmlspecialchars($company) . "\n" : '')
         . ($topic   ? "Направление: " . htmlspecialchars($topic) . "\n" : '')
         . ($task    ? "\n" . htmlspecialchars($task) . "\n" : '')
         . "\nВремя: " . date('d.m.Y H:i');

    /* Кнопок «Позвонить» и «Ответить письмом» здесь больше нет.

       Телеграм принимает в кнопке-ссылке только http, https и tg://.
       На tel: и mailto: он отвечает «Bad Request: inline keyboard
       button URL is invalid» и НЕ отправляет сообщение целиком. Форма
       требует телефон или почту, значит одна из этих кнопок была в
       каждой заявке - и отбивка не уходила ни разу. Человек оставлял
       заявку, видел «Заявка принята», а в чате команды было пусто.

       Контакт и так стоит в тексте кодом: Телеграм сам делает номер
       нажимаемым, а по длинному нажатию строка копируется целиком. */
    $kb = [];
    $kb[] = [['text' => 'В работе', 'callback_data' => 'lead_work_' . $lead['id']],
             ['text' => 'Закрыть',  'callback_data' => 'lead_done_' . $lead['id']]];
    rc_notify($txt, ['inline_keyboard' => $kb], 'tg_topic_form');

    /* Письмо себе */
    $rows = [
        'Имя'         => $name,
        'Контакт'     => $contact,
        'Компания'    => $company,
        'Направление' => $topic,
        'Задача'      => $task,
        'Страница'    => $lead['page'],
    ];
    rc_mail(rc_cfg('mail_to'), $title . ': ' . $name, rc_mail_tpl($title, $rows));

    /* Письмо клиенту, если оставил почту */
    if ($isMail) {
        $hi = $lead['lang'] === 'en'
            ? ['Request received', 'We have your request and will reply shortly. Meanwhile you can create an account and look around the dashboard.', 'Open the dashboard']
            : ['Заявка принята', 'Мы получили обращение и скоро свяжемся. Пока можно завести аккаунт и осмотреться в личном кабинете.', 'Открыть личный кабинет'];
        rc_mail($contact, $hi[0] . ' · Rocket CDN', rc_mail_tpl(
            $hi[0],
            ['Имя' => $name, 'Контакт' => $contact, 'Направление' => $topic],
            $hi[1],
            ['text' => $hi[2], 'url' => rc_cfg('lk_url')]
        ));
    }

    exit;
}

/* ══ Контент сайта для фронта ═════════════════════════════ */
if ($action === 'content') {
    $c = rc_json_read(RC_CONTENT, []);
    out(['ok' => true, 'content' => $c ?: null]);
}

/* ══════════ Дальше только с ключом администратора ════════ */

if ($action === 'login') {
    need_key();
    /* Вход прошёл - выдаём пропуск на две недели. Пустая строка тут
       значит, что папка данных не пишется: панель тогда работает по
       паролю, как раньше, и просто спросит его после перезагрузки. */
    out(['ok' => true, 'brand' => rc_cfg('brand'), 'pass' => rc_pass_new()]);
}

/* Выход: пропуск гасим на сервере, а не только в браузере. Иначе
   «выйти» на чужом ноутбуке ничего не значило бы. */
if ($action === 'logout') {
    rc_pass_drop(rc_secret('pass'));
    out(['ok' => true]);
}

/* ── Сводка по ВСЕМ сайтам разом ───────────────────────────
   Дашборд общей панели показывает три сайта рядом, и просить у
   сервера три отдельные сводки ради этого незачем: три запроса вместо
   одного, три чтения одних и тех же файлов и три разных момента
   времени в одном кадре. Здесь считается коротко - только то, что
   стоит на плитках дашборда, - а подробности каждый сайт отдаёт по
   своему запросу stats. */
if ($action === 'обзор') {
    need_key();
    $days = max(1, min(90, (int)inp('days', 14)));
    $из = [];
    foreach (rc_sites() as $код => $имя) {
        $ряд = []; $сум = ['views' => 0, 'uniq' => 0, 'leads' => 0, 'callbacks' => 0];
        for ($i = $days - 1; $i >= 0; $i--) {
            $день = date('Y-m-d', strtotime("-{$i} day"));
            $d = rc_json_read(stat_file($день, $код), []);
            $с = [
                'day'       => $день,
                'views'     => (int)($d['views'] ?? 0),
                'uniq'      => count($d['uniq'] ?? []),
                'leads'     => (int)($d['leads'] ?? 0),
                'callbacks' => (int)($d['callbacks'] ?? 0),
            ];
            foreach ($сум as $k => $v) $сум[$k] += $с[$k];
            $ряд[] = $с;
        }
        $из[$код] = [
            'имя'   => $имя,
            'ряд'   => $ряд,
            'сумма' => $сум,
            'конв'  => $сум['uniq'] > 0
                ? round(($сум['leads'] + $сум['callbacks']) / $сум['uniq'] * 100, 2) : 0,
        ];
    }
    /* Заявки лежат общим списком: у них свой разрез по сайту внутри. */
    $заявки = rc_json_read(RC_LEADS, []);
    $поСайтам = []; $новых = 0;
    foreach (($заявки['items'] ?? []) as $з) {
        $с = isset(rc_sites()[$з['site'] ?? '']) ? $з['site'] : 'cdn';
        $поСайтам[$с] = ($поСайтам[$с] ?? 0) + 1;
        if (($з['status'] ?? 'new') === 'new') $новых++;
    }
    out(['ok' => true, 'days' => $days, 'сайты' => $из,
         'заявок' => count($заявки['items'] ?? []), 'новых' => $новых,
         'заявкиПоСайтам' => $поСайтам]);
}

/* Сводка аналитики за N дней */
if ($action === 'stats') {
    need_key();
    $сайт = rc_site();
    $days = max(1, min(90, (int)inp('days', 14)));
    $series = [];
    $tot = ['views' => 0, 'uniq' => 0, 'leads' => 0, 'callbacks' => 0, 'register' => 0, 'connect' => 0];
    $devices = []; $os = []; $refs = []; $nodes = []; $searches = []; $scroll = []; $hours = []; $errors = [];
    $акты = [];
    $события = [];

    for ($i = $days - 1; $i >= 0; $i--) {
        $day = date('Y-m-d', strtotime("-{$i} day"));
        $d = rc_json_read(stat_file($day, $сайт), []);
        $ev = $d['events'] ?? [];
        $row = [
            'day'       => $day,
            'views'     => (int)($d['views'] ?? 0),
            'uniq'      => count($d['uniq'] ?? []),
            'leads'     => (int)($d['leads'] ?? 0),
            'callbacks' => (int)($d['callbacks'] ?? 0),
            'register'  => (int)($ev['register'] ?? 0),
            'connect'   => (int)($ev['connect'] ?? 0),
        ];
        foreach ($tot as $k => $v) $tot[$k] += $row[$k];
        $series[] = $row;

        foreach (($d['events'] ?? []) as $kk => $vv) $события[$kk] = ($события[$kk] ?? 0) + $vv;

        foreach (['devices' => &$devices, 'os' => &$os, 'refs' => &$refs, 'nodes' => &$nodes,
                  'searches' => &$searches, 'scroll' => &$scroll, 'hours' => &$hours,
                  'errors' => &$errors, 'акты' => &$акты] as $k => &$acc) {
            foreach (($d[$k] ?? []) as $kk => $vv) $acc[$kk] = ($acc[$kk] ?? 0) + $vv;
        }
        unset($acc);
    }
    arsort($refs); arsort($nodes); arsort($searches); arsort($errors); arsort($os); arsort($события);
    ksort($hours); ksort($scroll);

    $conv = $tot['uniq'] > 0 ? round(($tot['leads'] + $tot['callbacks']) / $tot['uniq'] * 100, 2) : 0;
    $ctr  = $tot['uniq'] > 0 ? round($tot['register'] / $tot['uniq'] * 100, 2) : 0;

    out([
        'ok' => true, 'сайт' => $сайт, 'days' => $days, 'series' => $series, 'total' => $tot,
        'conv' => $conv, 'ctr' => $ctr,
        'devices' => $devices, 'os' => $os,
        'refs' => array_slice($refs, 0, 12, true),
        'nodes' => array_slice($nodes, 0, 12, true),
        'searches' => array_slice($searches, 0, 12, true),
        'errors' => array_slice($errors, 0, 12, true),
        'scroll' => $scroll, 'hours' => $hours, 'акты' => $акты,
        /* Событий у каждого сайта свой набор: у CDN регистрация и
           подключение, у VPN проход по актам, у игры полёт и тела.
           Отдаём как есть, панель разберёт по названиям. */
        'события' => $события,
    ]);
}

if ($action === 'leads') {
    need_key();
    $d = rc_json_read(RC_LEADS, []);
    $items = array_reverse($d['items'] ?? []);
    out(['ok' => true, 'items' => $items, 'count' => count($items)]);
}

if ($action === 'lead_status') {
    need_key();
    $id = inp('id'); $st = inp('status', 'new');
    if (!in_array($st, ['new', 'work', 'done', 'spam'], true)) out(['ok' => false, 'error' => 'status']);
    $found = false;
    rc_json_update(RC_LEADS, function ($d) use ($id, $st, &$found) {
        foreach (($d['items'] ?? []) as $i => $it) {
            if (($it['id'] ?? '') === $id) { $d['items'][$i]['status'] = $st; $found = true; }
        }
        return $d;
    });
    out(['ok' => $found]);
}

/* Заметка по заявке. Владелец ведёт клиента руками, и до сих пор
   ему негде было записать «перезвонил, ждёт счёт» - статус этого не
   вмещает. Пишем прямо в заявку, отдельного хранилища не заводим. */
if ($action === 'lead_note') {
    need_key();
    $id = inp('id');
    $note = mb_substr(trim((string)inp('note', '')), 0, 2000);
    $found = false;
    rc_json_update(RC_LEADS, function ($d) use ($id, $note, &$found) {
        foreach (($d['items'] ?? []) as $i => $it) {
            if (($it['id'] ?? '') === $id) {
                $d['items'][$i]['note'] = $note;
                $d['items'][$i]['note_ts'] = date('c');
                $found = true;
            }
        }
        return $d;
    });
    out(['ok' => $found]);
}

if ($action === 'lead_delete') {
    need_key();
    $id = inp('id');
    rc_json_update(RC_LEADS, function ($d) use ($id) {
        $d['items'] = array_values(array_filter($d['items'] ?? [], fn($x) => ($x['id'] ?? '') !== $id));
        return $d;
    });
    out(['ok' => true]);
}

if ($action === 'export') {
    /* Пароль принимаем только телом запроса: в адресной строке он
       оседает в журналах сервера и в истории браузера. */
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') out(['ok' => false, 'error' => 'post_only']);
    need_key();
    $d = rc_json_read(RC_LEADS, []);
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="rocketcdn-leads-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    fputcsv($out, ['Дата', 'Тип', 'Имя', 'Контакт', 'Компания', 'Направление', 'Задача', 'Статус'], ';');
    foreach (array_reverse($d['items'] ?? []) as $x) {
        fputcsv($out, [$x['ts'] ?? '', $x['kind'] ?? '', $x['name'] ?? '', $x['contact'] ?? '',
                       $x['company'] ?? '', $x['topic'] ?? '', $x['task'] ?? '', $x['status'] ?? ''], ';');
    }
    fclose($out);
    exit;
}

/* Правка текстов сайта из админки */
if ($action === 'content_save') {
    need_key();
    $c = $body['content'] ?? null;
    if (!is_array($c)) out(['ok' => false, 'error' => 'content']);
    rc_json_write(RC_CONTENT, $c);
    out(['ok' => true]);
}

if ($action === 'content_reset') {
    need_key();
    @unlink(RC_CONTENT);
    out(['ok' => true]);
}

/* ── Узлы сети из админки ─────────────────────────────────────
   Реестр точек лежит в assets/rc-geo.js плоским массивом. Править его
   руками владелец не может и не должен: до сих пор в админке висела
   подсказка «допишите строку в файл» - для панели управления это
   расписка в бессилии.

   Правки храним отдельно, в data/nodes.json, и базовый реестр НЕ
   трогаем: перевыкладка сайта их не затирает, а откатить можно одной
   кнопкой. Папка data закрыта от веба (см. .htaccess), поэтому наружу
   правки отдаёт сам api отдельным действием.

   Формат узла ровно тот же, что в реестре:
     [название RU, широта, долгота, регион, маска меток, название EN] */
if ($action === 'nodes') {
    need_key();
    $d = rc_json_read(RC_NODES, []);
    out(['ok' => true, 'add' => $d['add'] ?? [], 'hide' => $d['hide'] ?? [], 'ts' => $d['ts'] ?? '']);
}

if ($action === 'nodes_save') {
    need_key();
    $add  = json_decode((string)inp('add', '[]'), true);
    $hide = json_decode((string)inp('hide', '[]'), true);
    if (!is_array($add) || !is_array($hide)) out(['ok' => false, 'error' => 'json']);
    /* Проверяем КАЖДУЮ строку: в глобус уходит этот же массив, и одна
       кривая широта роняет первый кадр сайта у всех посетителей. */
    $чисто = [];
    $видели = [];
    foreach ($add as $n) {
        if (!is_array($n) || count($n) < 5) continue;
        $имя = trim((string)$n[0]);
        $ш = (float)$n[1]; $д = (float)$n[2];
        $р = (int)$n[3];   $м = (int)$n[4];
        $en = isset($n[5]) ? trim((string)$n[5]) : '';
        /* Раньше длинное имя выбрасывалось молча, а панель показывала
           «Город добавлен» и чистила поля: набранное пропадало без
           следа. Теперь сервер отвечает отказом и называет город. */
        if ($имя !== '' && mb_strlen($имя) > 60) out(['ok' => false, 'error' => 'name_long', 'имя' => mb_substr($имя, 0, 20)]);
        if ($имя === '') continue;
        if ($ш < -90 || $ш > 90 || $д < -180 || $д > 180) continue;
        if ($р < 0 || $р > 4) continue;
        if ($м < 0 || $м > 7) continue;
        /* Дубли режем и здесь: панель проверяет для скорости ответа, а
           сервер - потому что он единственный, кто отвечает за файл. */
        $ключ = mb_strtolower($имя);
        if (isset($видели[$ключ])) continue;
        $видели[$ключ] = 1;
        $чисто[] = [$имя, round($ш, 4), round($д, 4), $р, $м, mb_substr($en, 0, 60)];
        if (count($чисто) >= 400) break;
    }
    $скрыт = [];
    foreach ($hide as $h) {
        $h = trim((string)$h);
        if ($h !== '' && mb_strlen($h) <= 60) $скрыт[] = $h;
        if (count($скрыт) >= 400) break;
    }
    rc_json_write(RC_NODES, ['add' => $чисто, 'hide' => $скрыт, 'ts' => date('c')]);
    out(['ok' => true, 'add' => count($чисто), 'hide' => count($скрыт)]);
}

/* Правки для самого сайта, отдельным скриптом. Отдаём javascript, а не
   json: тег script выполняется по порядку, сразу после rc-geo.js, и
   глобус успевает увидеть готовый реестр до первого кадра. Ключ тут не
   нужен - это публичные данные о точках присутствия. */
if ($action === 'nodes_js') {
    $d = rc_json_read(RC_NODES, []);
    $add = $d['add'] ?? []; $hide = $d['hide'] ?? [];
    header('Content-Type: application/javascript; charset=utf-8');
    /* Пять минут хранения здесь стоили доверия к панели: владелец
       сохранял город, перезагружал сайт по подсказке из самой панели
       и не видел ничего. Теперь браузер спрашивает каждый раз, а
       отпечаток отдаёт ответ пустым, если ничего не менялось. Слово
       public убрано: правки узлов чужим кэшам отдавать незачем. */
    $отпечаток = '"' . md5(json_encode([$add, $hide], JSON_UNESCAPED_UNICODE)) . '"';
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('ETag: ' . $отпечаток);
    $было = trim((string)($_SERVER['HTTP_IF_NONE_MATCH'] ?? ''));
    if ($было !== '' && $было === $отпечаток) { http_response_code(304); exit; }
    if (!$add && !$hide) { echo "/* правок узлов нет */\n"; exit; }
    echo "/* Правки реестра узлов из админки. Файл собирает api.php, руками не трогать. */\n";
    echo "(function(g){var G=g.RC_GEO;if(!G||!G.NODES)return;\n";
    echo "var скрыть=" . json_encode($hide, JSON_UNESCAPED_UNICODE) . ";\n";
    echo "var добавить=" . json_encode($add, JSON_UNESCAPED_UNICODE) . ";\n";
    echo "if(скрыть.length){var s={};for(var i=0;i<скрыть.length;i++)s[скрыть[i]]=1;\n";
    echo "  for(var j=G.NODES.length-1;j>=0;j--) if(s[G.NODES[j][0]]) G.NODES.splice(j,1);}\n";
    echo "for(var k=0;k<добавить.length;k++) G.NODES.push(добавить[k]);\n";
    echo "G.COUNT=G.NODES.length;})(window);\n";
    exit;
}

if ($action === 'errors') {
    need_key();
    $log = is_file(RC_LOG) ? array_slice(file(RC_LOG), -200) : [];
    out(['ok' => true, 'log' => array_reverse($log)]);
}

/* Проверка почты и телеграма прямо из админки */
if ($action === 'selftest') {
    need_key();
    /* Считает rc_selftest() в config.php: те же цифры видит бот по
       команде /health и ежедневная проверка в cron.php */
    $res = rc_selftest();
    if (inp('send')) {
        $res['mail_sent'] = rc_mail(rc_cfg('mail_to'), 'Проверка связи · Rocket CDN',
            rc_mail_tpl('Проверка связи', ['Статус' => 'Почта настроена и работает'], 'Письмо отправлено из админки сайта.'));
        rc_notify("<b>Проверка связи</b>\nАдминка сайта на связи, уведомления доходят.", null, 'tg_topic_error');
        $res['tg_sent'] = true;
    }
    out(['ok' => true] + $res);
}

/* ── Связка: с чем панель сейчас соединена ─────────────────
   Раздел «Связка» в панели отвечает на один вопрос: доходят ли
   уведомления и куда именно. Без него привязку к чату можно узнать
   только чтением файла на сервере, а «кажется, работает» это не
   ответ. Сам токен наружу не отдаём никогда: панель показывает лишь
   его хвост, чтобы отличить один бот от другого. */
if ($action === 'связка') {
    need_key();
    $чат   = rc_cfg('tg_chat');
    $токен = (string)rc_cfg('tg_token');
    /* Каждому обращению наружу свой короткий предел. Без него раздел
       висит на «спрашиваем сервер» столько, сколько молчит чужая
       сторона: панель не имеет права ждать дольше человека. */
    $ждать = stream_context_create(['http' => ['timeout' => 4, 'ignore_errors' => true]]);

    /* Кто наш бот. Два правила разом.

       ПЕРВОЕ: спрашиваем по той же дороге, что и все отправки - с
       пином рабочего адреса. Прямой file_get_contents по имени
       api.telegram.org отсюда не доходит вовсе: резолвер площадки
       отдаёт адрес, до которого сети нет, и раздел писал «бот не
       задан» про живого бота, который в это же время слал заявки.

       ВТОРОЕ: имя бота не меняется, а связь с телеграмом здесь рвётся
       через раз. Держим ответ сутки в файле и обновляем ОДНИМ коротким
       заходом. Гонять полный перебор адресов ради строчки «кто мы»
       значит держать человека у пустого раздела до минуты. */
    $бот = null;
    if ($токен !== '') {
        $кэш = rc_json_read(RC_DATA . '/tg_me.json', []);
        $свеж = !empty($кэш['ts']) && (time() - (int)$кэш['ts']) < 86400 && !empty($кэш['бот']);
        if ($свеж) {
            $бот = $кэш['бот'];
        } else {
            list($о, $е, ) = rc_tg_call($токен, 'getMe', [], rc_tg_pin_get(), true);
            $j = $е ? null : json_decode((string)$о, true);
            if (!empty($j['ok'])) {
                $бот = $j['result'];
                rc_json_write(RC_DATA . '/tg_me.json', ['ts' => time(), 'бот' => $бот]);
            } elseif (!empty($кэш['бот'])) {
                /* Не ответил сейчас - показываем последнее известное,
                   это честнее пустого места. */
                $бот = $кэш['бот'];
            }
        }
    }
    $сайты = [];
    foreach (['cdn' => rc_cfg('site_url'), 'vpn' => 'https://rocketvpn.top'] as $к => $адрес) {
        $было = ini_set('default_socket_timeout', '4');
        $ч = @get_headers($адрес, true, $ждать);
        if ($было !== false) ini_set('default_socket_timeout', $было);
        $сайты[$к] = ['адрес' => $адрес, 'ответ' => $ч ? substr((string)$ч[0], 0, 20) : 'нет ответа'];
    }
    out([
        'ok' => true,
        'бот' => $бот ? ['имя' => $бот['username'] ?? '', 'id' => $бот['id'] ?? 0] : null,
        'хвостТокена' => $токен === '' ? '' : substr($токен, -6),
        'чат' => (string)$чат,
        'темы' => [
            'формы'    => (string)rc_cfg('tg_topic_form'),
            'ошибки'   => (string)rc_cfg('tg_topic_error'),
            'аналитика'=> (string)rc_cfg('tg_topic_stat'),
        ],
        'админы' => rc_cfg('tg_admins'),
        'сайты' => $сайты,
    ]);
}

/* Проверка связи по кнопке: пишем в каждую тему своё сообщение.
   Одного общего мало - темы привязываются по одной, и молчащая тема
   находится только тем, что в неё написали. */
if ($action === 'связка_проба') {
    need_key();
    $из = [];
    foreach (['tg_topic_form' => 'Формы', 'tg_topic_error' => 'Ошибки', 'tg_topic_stat' => 'Аналитика'] as $к => $имя) {
        $из[$имя] = rc_notify("<b>Проба связи · {$имя}</b>\nОбщая панель на связи, уведомления доходят.", null, $к)
            ? 'дошло' : 'не дошло';
    }
    out(['ok' => true, 'темы' => $из]);
}

out(['ok' => false, 'error' => 'unknown_action']);
