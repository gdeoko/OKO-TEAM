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
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$raw    = file_get_contents('php://input');
$body   = $raw ? (json_decode($raw, true) ?: []) : [];

function out($d) { echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function inp($k, $d = '') {
    global $body;
    $v = $body[$k] ?? $_POST[$k] ?? $_GET[$k] ?? $d;
    return is_string($v) ? trim($v) : $v;
}
function need_key() {
    $real = (string)rc_cfg('admin_key');
    /* Пока пароль не сменили, закрытые разделы не работают вовсе:
       иначе заявки с персональными данными открыты всему интернету. */
    if ($real === '' || $real === 'rocket2026') {
        out(['ok' => false, 'error' => 'default_key',
             'message' => 'Смените admin_key в config.local.php, пароль по умолчанию заблокирован.']);
    }
    $k = inp('key');
    if (!hash_equals($real, (string)$k)) out(['ok' => false, 'error' => 'auth']);
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
function stat_file($day = null) { return RC_STATS . '/' . ($day ?: date('Y-m-d')) . '.json'; }

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

    $fresh = [];
    rc_json_update(stat_file(), function ($d) use ($events, $ua, $sid, $refHost, &$fresh) {
        $d['day']      = $d['day']      ?? date('Y-m-d');
        $d['views']    = $d['views']    ?? 0;
        $d['uniq']     = $d['uniq']     ?? [];
        $d['events']   = $d['events']   ?? [];
        $d['hours']    = $d['hours']    ?? [];
        $d['devices']  = $d['devices']  ?? [];
        $d['os']       = $d['os']       ?? [];
        $d['refs']     = $d['refs']     ?? [];
        $d['scroll']   = $d['scroll']   ?? [];
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
        rc_notify("<b>Ошибка на сайте</b>\n<code>" . htmlspecialchars(implode("\n", $list)) . "</code>", null, 'tg_topic_error');
    }
    out(['ok' => true]);
}

/* ══ Заявка с сайта или обратный звонок ═══════════════════ */
if ($action === 'lead' || $action === 'callback') {
    if (!rate_ok('lead', 8, 3600)) out(['ok' => false, 'error' => 'too_many']);
    /* Предел на весь сайт, а не только на адрес: с ботнета адреса разные,
       а письма и сообщения уходят с нашего ящика. */
    if (!rate_global('lead_total', 120, 86400)) out(['ok' => false, 'error' => 'too_many']);

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
    if (!$isMail && !$isPhone)   out(['ok' => false, 'error' => 'contact']);
    if (!$consent)               out(['ok' => false, 'error' => 'consent']);

    $lead = [
        'id'      => substr(md5($contact . microtime(true)), 0, 10),
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
    rc_json_update(stat_file(), function ($d) use ($lead) {
        /* Заявки с формы и заявки на звонок считаем раздельно, чтобы не задваивать */
        if ($lead['kind'] === 'callback') $d['callbacks'] = ($d['callbacks'] ?? 0) + 1;
        else                              $d['leads']     = ($d['leads'] ?? 0) + 1;
        return $d;
    });

    /* В Телеграм */
    $title = $lead['kind'] === 'callback' ? 'Заявка на звонок' : 'Новая заявка с сайта';
    $txt = "<b>{$title}</b>\n\n"
         . "Имя: <b>" . htmlspecialchars($name) . "</b>\n"
         . "Контакт: <code>" . htmlspecialchars($contact) . "</code>\n"
         . ($company ? "Компания: " . htmlspecialchars($company) . "\n" : '')
         . ($topic   ? "Направление: " . htmlspecialchars($topic) . "\n" : '')
         . ($task    ? "\n" . htmlspecialchars($task) . "\n" : '')
         . "\nВремя: " . date('d.m.Y H:i');

    $kb = [];
    if ($isPhone) $kb[] = [['text' => 'Позвонить', 'url' => 'tel:' . preg_replace('~[^\d+]~', '', $contact)]];
    if ($isMail)  $kb[] = [['text' => 'Ответить письмом', 'url' => 'mailto:' . $contact]];
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

    out(['ok' => true, 'id' => $lead['id']]);
}

/* ══ Контент сайта для фронта ═════════════════════════════ */
if ($action === 'content') {
    $c = rc_json_read(RC_CONTENT, []);
    out(['ok' => true, 'content' => $c ?: null]);
}

/* ══════════ Дальше только с ключом администратора ════════ */

if ($action === 'login') {
    need_key();
    out(['ok' => true, 'brand' => rc_cfg('brand')]);
}

/* Сводка аналитики за N дней */
if ($action === 'stats') {
    need_key();
    $days = max(1, min(90, (int)inp('days', 14)));
    $series = [];
    $tot = ['views' => 0, 'uniq' => 0, 'leads' => 0, 'callbacks' => 0, 'register' => 0, 'connect' => 0];
    $devices = []; $os = []; $refs = []; $nodes = []; $searches = []; $scroll = []; $hours = []; $errors = [];

    for ($i = $days - 1; $i >= 0; $i--) {
        $day = date('Y-m-d', strtotime("-{$i} day"));
        $d = rc_json_read(stat_file($day), []);
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

        foreach (['devices' => &$devices, 'os' => &$os, 'refs' => &$refs, 'nodes' => &$nodes,
                  'searches' => &$searches, 'scroll' => &$scroll, 'hours' => &$hours, 'errors' => &$errors] as $k => &$acc) {
            foreach (($d[$k] ?? []) as $kk => $vv) $acc[$kk] = ($acc[$kk] ?? 0) + $vv;
        }
        unset($acc);
    }
    arsort($refs); arsort($nodes); arsort($searches); arsort($errors); arsort($os);
    ksort($hours); ksort($scroll);

    $conv = $tot['uniq'] > 0 ? round(($tot['leads'] + $tot['callbacks']) / $tot['uniq'] * 100, 2) : 0;
    $ctr  = $tot['uniq'] > 0 ? round($tot['register'] / $tot['uniq'] * 100, 2) : 0;

    out([
        'ok' => true, 'days' => $days, 'series' => $series, 'total' => $tot,
        'conv' => $conv, 'ctr' => $ctr,
        'devices' => $devices, 'os' => $os,
        'refs' => array_slice($refs, 0, 12, true),
        'nodes' => array_slice($nodes, 0, 12, true),
        'searches' => array_slice($searches, 0, 12, true),
        'errors' => array_slice($errors, 0, 12, true),
        'scroll' => $scroll, 'hours' => $hours,
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
        if ($имя === '' || mb_strlen($имя) > 60) continue;
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
    header('Cache-Control: public, max-age=300');
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

out(['ok' => false, 'error' => 'unknown_action']);
