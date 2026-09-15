<?php
/**
 * ПОЧТА РОССИИ: ГДЕ СЕЙЧАС ПОСЫЛКИ УЧАСТНИКОВ.
 *
 * Наградные материалы уходят посылками, трек-номер админ вбивает руками, и на
 * этом всё заканчивалось: заказ навсегда оставался «отправлен». Никто не знал,
 * дошла ли посылка, лежит ли она в отделении, поехала ли обратно. Участник
 * спрашивал в чате «где мои награды», и ответить было нечем, кроме ссылки на
 * сайт Почты.
 *
 * Здесь ходим в API Почты России и приносим настоящий статус по каждому
 * трек-номеру. Дальше его показывают админка, кабинет и чат-бот, а сводка
 * считает сроки доставки и находит застрявшие отправления.
 *
 * ДВА ЗАГОЛОВКА ОДНОВРЕМЕННО. У Почты редкая схема: токен приложения и логин
 * пользователя передаются РАЗНЫМИ заголовками, и без любого из них ответ 401.
 *   Authorization:        AccessToken <токен из кабинета «Отправка»>
 *   X-User-Authorization: Basic <base64(логин:пароль от кабинета)>
 *
 * Доступы лежат в переменных окружения (secrets.env), в коде их нет.
 */
declare(strict_types=1);

if (!function_exists('pochta_cfg')) {

/** Доступы к API. Пусто — значит интеграция не настроена, и это не ошибка. */
function pochta_cfg(): array {
    // Порядок такой же, как у остальных секретов сайта: сначала окружение, затем
    // config.local.php (он не в git). Функция cfg() из config.php умеет оба.
    $get = static function (string $k) {
        $v = getenv($k);
        if (($v === false || $v === '') && function_exists('cfg')) $v = cfg($k, '');
        if (($v === false || $v === '') && function_exists('cfgv')) $v = cfgv(strtolower($k), '');
        return trim((string) $v);
    };
    return [
        'url'   => rtrim($get('POCHTA_API_URL') ?: 'https://otpravka-api.pochta.ru', '/'),
        'token' => $get('POCHTA_TOKEN'),
        'login' => $get('POCHTA_LOGIN'),
        'pass'  => $get('POCHTA_PASSWORD'),
    ];
}

function pochta_ready(): bool {
    $c = pochta_cfg();
    return $c['token'] !== '' && $c['login'] !== '' && $c['pass'] !== '';
}

/**
 * Запрос к API. Возвращает ['code'=>HTTP, 'data'=>разобранный JSON, 'raw'=>тело].
 *
 * @param string     $path  путь вида '/1.0/settings'
 * @param array|null $body  тело POST; null — обычный GET
 */
function pochta_api(string $path, ?array $body = null, int $timeout = 30): array {
    $c = pochta_cfg();
    if (!pochta_ready()) return ['code' => 0, 'data' => null, 'raw' => 'доступы к Почте России не заданы'];

    $ch = curl_init($c['url'] . $path);
    $headers = [
        'Authorization: AccessToken ' . $c['token'],
        'X-User-Authorization: Basic ' . base64_encode($c['login'] . ':' . $c['pass']),
        'Accept: application/json;charset=UTF-8',
        'Content-Type: application/json;charset=UTF-8',
    ];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE));
    }
    $raw  = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($raw === '' && $err !== '') return ['code' => 0, 'data' => null, 'raw' => 'связь не установлена: ' . $err];
    return ['code' => $code, 'data' => json_decode($raw, true), 'raw' => $raw];
}

/**
 * ЧЕЛОВЕЧЕСКОЕ СОСТОЯНИЕ ПОСЫЛКИ.
 *
 * У Почты сотни кодов операций; участнику и оператору нужны пять состояний.
 * Всё остальное сводим к «в пути»: точная формулировка есть в истории, а на
 * плитке важно, идёт посылка, ждёт получателя или вернулась.
 */
function pochta_state(string $operation, string $attr = ''): string {
    $s = mb_strtolower($operation . ' ' . $attr);
    if (mb_strpos($s, 'вручен') !== false)                       return 'delivered';
    if (mb_strpos($s, 'возврат') !== false
        || mb_strpos($s, 'досыл') !== false)                     return 'returning';
    if (mb_strpos($s, 'неудачная попытка') !== false
        || mb_strpos($s, 'хранение') !== false
        || mb_strpos($s, 'прибыло в место вручения') !== false)  return 'waiting';
    if (mb_strpos($s, 'утрачен') !== false
        || mb_strpos($s, 'уничтожен') !== false)                 return 'lost';
    return 'in_transit';
}

/** Как называть состояние людям. */
function pochta_state_ru(string $state): string {
    return [
        'delivered'  => 'вручена получателю',
        'waiting'    => 'ждёт получателя в отделении',
        'returning'  => 'возвращается отправителю',
        'lost'       => 'утрачена, нужен розыск',
        'in_transit' => 'в пути',
        ''           => 'нет данных',
    ][$state] ?? 'в пути';
}

/** Таблица состояний посылок. Создаётся лениво, повторный вызов безопасен. */
function pochta_migrate(): void {
    static $done = false;
    if ($done) return;
    db()->exec("CREATE TABLE IF NOT EXISTS pochta_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track TEXT NOT NULL,
        order_id INTEGER DEFAULT 0,
        state TEXT DEFAULT '',
        operation TEXT DEFAULT '',
        place TEXT DEFAULT '',
        happened_at TEXT DEFAULT '',
        checked_at TEXT DEFAULT '',
        history TEXT DEFAULT '',
        error TEXT DEFAULT ''
    )");
    db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_pochta_track ON pochta_tracks(track)");
    $done = true;
}

/**
 * История одной посылки. Возвращает список шагов от старого к новому:
 * [['at'=>дата, 'operation'=>что произошло, 'place'=>где, 'index'=>индекс], …]
 */
function pochta_history(string $track): array {
    $track = strtoupper(preg_replace('~\s+~', '', $track) ?? '');
    if ($track === '') return [];

    /* ОТСЛЕЖИВАНИЕ — ОТДЕЛЬНАЯ СЛУЖБА, А НЕ «ОТПРАВКА».
     *
     * Здесь стоял вызов `/1.0/tracking/<номер>` на otpravka-api, и он не
     * существует: Почта отвечает 407 «Error namespace or mask or method not
     * found». То есть история не приходила НИКОГДА, а таблица состояний
     * заполнялась пустыми строками с пометкой «Почта не отдала историю».
     *
     * Настоящий адрес — SOAP `tracking.russianpost.ru/rtm34`, и доступ к нему
     * выдаётся ОТДЕЛЬНО от «Отправки»: своя пара логин-пароль. Пока её нет,
     * честно возвращаем пусто — пусть в админке будет видно «нет данных», а не
     * выдуманный статус. */
    $h = pochta_track_soap($track);
    if ($h) return $h;

    $r = pochta_api('/1.0/tracking/' . rawurlencode($track));
    if ($r['code'] !== 200 || !is_array($r['data'])) return [];

    $out = [];
    // Формат ответа у Почты менялся, поэтому не разбираем структуру по именам
    // уровней, а обходим её и берём всё, что похоже на шаг доставки.
    $walk = static function ($node) use (&$walk, &$out): void {
        if (!is_array($node)) return;
        $op = (string) ($node['OperationAttribute']['Name'] ?? $node['operationAttribute']['name'] ?? '');
        $tp = (string) ($node['OperationType']['Name'] ?? $node['operationType']['name'] ?? '');
        if ($op !== '' || $tp !== '') {
            $out[] = [
                'at'        => (string) ($node['OperationDate'] ?? $node['operationDate'] ?? ''),
                'operation' => trim($tp . ($op !== '' ? ', ' . $op : '')),
                'place'     => (string) ($node['AddressParameters']['OperationAddress']['Description']
                                         ?? $node['address']['description'] ?? ''),
                'index'     => (string) ($node['AddressParameters']['OperationAddress']['Index']
                                         ?? $node['address']['index'] ?? ''),
            ];
        }
        foreach ($node as $v) if (is_array($v)) $walk($v);
    };
    $walk($r['data']);
    usort($out, static fn($a, $b) => strtotime((string) $a['at']) <=> strtotime((string) $b['at']));
    return $out;
}

/**
 * Обновляет состояние одной посылки в базе и возвращает его.
 * Ошибку не прячем: она видна в админке рядом с треком.
 */
function pochta_refresh(string $track, int $orderId = 0): array {
    pochta_migrate();
    $track = strtoupper(preg_replace('~\s+~', '', $track) ?? '');
    if ($track === '') return [];

    $hist = pochta_history($track);
    $last = $hist ? $hist[count($hist) - 1] : null;
    $row = [
        'track'       => $track,
        'order_id'    => $orderId,
        'state'       => $last ? pochta_state((string) $last['operation']) : '',
        'operation'   => $last ? mb_substr((string) $last['operation'], 0, 200) : '',
        'place'       => $last ? mb_substr((string) $last['place'], 0, 200) : '',
        'happened_at' => $last ? (string) $last['at'] : '',
        'checked_at'  => date('Y-m-d H:i:s'),
        'history'     => json_encode($hist, JSON_UNESCAPED_UNICODE),
        'error'       => $hist ? '' : 'Почта не отдала историю по этому номеру',
    ];
    $exists = one("SELECT id FROM pochta_tracks WHERE track=?", [$track]);
    if ($exists) {
        $id = (int) $exists['id'];
        $upd = $row; unset($upd['track']);
        if ($orderId === 0) unset($upd['order_id']);   // не затираем привязку
        update('pochta_tracks', $upd, 'id=:id', ['id' => $id]);
    } else {
        insert('pochta_tracks', $row);
    }
    return $row;
}

/**
 * ИСТОРИЯ ПОСЫЛКИ ЧЕРЕЗ СЛУЖБУ ОТСЛЕЖИВАНИЯ (SOAP rtm34).
 *
 * Доступ: POCHTA_TRACK_LOGIN / POCHTA_TRACK_PASSWORD. Их выдаёт Почта после
 * подключения услуги «Сервис отслеживания» на tracking.pochta.ru — это НЕ те
 * же логин и пароль, что у кабинета «Отправка». Нет доступа — возвращаем
 * пустой массив, и вызывающий сам решает, что делать.
 *
 * Бесплатный тариф службы — 100 запросов в сутки на один номер и ограничение
 * по частоте, поэтому вызывать её надо из крона по расписанию, а не на каждый
 * показ страницы.
 */
function pochta_track_soap(string $track): array {
    $get = static function (string $k) {
        $v = getenv($k);
        if (($v === false || $v === '') && function_exists('cfg')) $v = cfg($k, '');
        if (($v === false || $v === '') && function_exists('cfgv')) $v = cfgv(strtolower($k), '');
        return trim((string) $v);
    };
    $login = $get('POCHTA_TRACK_LOGIN');
    $pass  = $get('POCHTA_TRACK_PASSWORD');
    if ($login === '' || $pass === '') return [];

    $xml = '<?xml version="1.0" encoding="UTF-8"?>'
        . '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"'
        . ' xmlns:oper="http://russianpost.org/operationhistory"'
        . ' xmlns:data="http://russianpost.org/operationhistory/data"'
        . ' xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/">'
        . '<soap:Header/><soap:Body><oper:getOperationHistory>'
        . '<data:OperationHistoryRequest>'
        . '<data:Barcode>' . htmlspecialchars($track, ENT_XML1) . '</data:Barcode>'
        . '<data:MessageType>0</data:MessageType><data:Language>RUS</data:Language>'
        . '</data:OperationHistoryRequest>'
        . '<data:AuthorizationHeader soapenc:mustUnderstand="1">'
        . '<data:login>' . htmlspecialchars($login, ENT_XML1) . '</data:login>'
        . '<data:password>' . htmlspecialchars($pass, ENT_XML1) . '</data:password>'
        . '</data:AuthorizationHeader>'
        . '</oper:getOperationHistory></soap:Body></soap:Envelope>';

    $ch = curl_init('https://tracking.russianpost.ru/rtm34');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $xml,
        CURLOPT_HTTPHEADER => ['Content-Type: text/xml; charset=utf-8', 'SOAPAction: ""'],
        CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 12,
    ]);
    $resp = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($code !== 200 || $resp === '') return [];

    $prev = libxml_use_internal_errors(true);
    $doc  = simplexml_load_string($resp);
    libxml_use_internal_errors($prev);
    if (!$doc) return [];

    $out = [];
    foreach ($doc->xpath('//*[local-name()="historyRecord"]') ?: [] as $rec) {
        $pick = static function ($node, string $path): string {
            $r = $node->xpath($path);
            return $r ? trim((string) $r[0]) : '';
        };
        $type = $pick($rec, './/*[local-name()="OperationParameters"]/*[local-name()="OperType"]/*[local-name()="Name"]');
        $attr = $pick($rec, './/*[local-name()="OperationParameters"]/*[local-name()="OperAttr"]/*[local-name()="Name"]');
        $out[] = [
            'at'        => $pick($rec, './/*[local-name()="OperationParameters"]/*[local-name()="OperDate"]'),
            'operation' => trim($type . ($attr !== '' ? ', ' . $attr : '')),
            'place'     => $pick($rec, './/*[local-name()="AddressParameters"]/*[local-name()="OperationAddress"]/*[local-name()="Description"]'),
            'index'     => $pick($rec, './/*[local-name()="AddressParameters"]/*[local-name()="OperationAddress"]/*[local-name()="Index"]'),
        ];
    }
    usort($out, static fn($a, $b) => strtotime((string) $a['at']) <=> strtotime((string) $b['at']));
    return $out;
}

/** Подключена ли служба отслеживания (отдельная от «Отправки»). */
function pochta_track_ready(): bool {
    $get = static function (string $k) {
        $v = getenv($k);
        if (($v === false || $v === '') && function_exists('cfg')) $v = cfg($k, '');
        if (($v === false || $v === '') && function_exists('cfgv')) $v = cfgv(strtolower($k), '');
        return trim((string) $v);
    };
    return $get('POCHTA_TRACK_LOGIN') !== '' && $get('POCHTA_TRACK_PASSWORD') !== '';
}

/** Последнее известное состояние посылки из базы (без обращения к Почте). */
function pochta_known(string $track): array {
    pochta_migrate();
    $track = strtoupper(preg_replace('~\s+~', '', $track) ?? '');
    if ($track === '') return [];
    return (array) (one("SELECT * FROM pochta_tracks WHERE track=?", [$track]) ?: []);
}

/** Короткая строка для участника: «в пути, последнее событие …». */
function pochta_short(string $track): string {
    $k = pochta_known($track);
    if (!$k) return '';
    $st = pochta_state_ru((string) ($k['state'] ?? ''));
    $op = trim((string) ($k['operation'] ?? ''));
    $at = trim((string) ($k['happened_at'] ?? ''));
    $when = $at !== '' && strtotime($at) ? date('d.m.Y', strtotime($at)) : '';
    return $st . ($op !== '' ? ' (' . $op . ($when !== '' ? ', ' . $when : '') . ')' : '');
}

}
