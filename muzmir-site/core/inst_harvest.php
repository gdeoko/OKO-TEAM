<?php
/**
 * СБОРЩИК БАЗЫ УЧРЕЖДЕНИЙ.
 *
 * Работает ТОЛЬКО из CLI и ТОЛЬКО с российского сервера: почти все нужные источники
 * (открытые данные ведомств, сайты школ на *.gosuslugi.ru, каталоги культуры) из-за
 * рубежа не открываются вовсе. Запуск: php cron/harvest_institutions.php <источник>
 *
 * ЧТО СОБИРАЕМ И ОТКУДА:
 *   1. Сообщества ВКонтакте (groups.search) — у школ искусств и домов культуры почти
 *      всегда есть группа, а в её карточке указан сайт. Это самый широкий вход.
 *   2. Сайты учреждений — со страницы «Контакты» берём e-mail. Это официальный
 *      контакт организации, опубликованный ею самой для обращений.
 *   3. OpenStreetMap (Overpass API) — открытые данные, у части объектов проставлены
 *      contact:email и contact:website.
 *
 * ЧЕГО НЕ ДЕЛАЕМ. Не обходим капчи, не подбираем адреса перебором, не покупаем базы,
 * не выкачиваем персональные данные людей. Берём только то, что организация сама
 * опубликовала как способ связи с ней.
 *
 * ТЕМП. Источники — чужие серверы, и валить их запросами нельзя. Между обращениями
 * пауза, за прогон — ограниченная порция. Сбор идёт неделями фоном, и это нормально:
 * база нужна постоянная, а не разовая.
 */
declare(strict_types=1);

if (!function_exists('inst_add')) require_once __DIR__ . '/institutions.php';

/** Пауза между обращениями к чужому серверу, микросекунды. */
function ih_sleep(int $ms = 700): void { usleep($ms * 1000); }

/** Короткий лог сборщика (виден в консоли и в data/logs). */
function ih_log(string $line): void {
    $s = '[' . date('Y-m-d H:i:s') . '] harvest: ' . $line;
    if (PHP_SAPI === 'cli') echo $s . "\n";
    $dir = BASE_PATH . '/data/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    @file_put_contents($dir . '/harvest.log', $s . "\n", FILE_APPEND);
}

/* =====================================================================
 *  1. Сообщества ВКонтакте
 * ===================================================================== */

/**
 * Формулировки для поиска сообществ. Разные регионы называют одно и то же
 * по-своему, поэтому запросов много и они пересекаются — дедуп на стороне базы.
 */
function ih_vk_queries(): array {
    return [
        'детская школа искусств', 'школа искусств', 'ДШИ',
        'детская музыкальная школа', 'музыкальная школа', 'ДМШ',
        'детская художественная школа', 'художественная школа',
        'дом культуры', 'дворец культуры', 'культурно-досуговый центр',
        'центр культуры и досуга', 'сельский дом культуры',
        'центр детского творчества', 'дом детского творчества',
        'дворец творчества', 'центр развития творчества',
        'училище культуры', 'колледж культуры', 'музыкальное училище',
        'хореографическая школа', 'студия танца', 'вокальная студия',
    ];
}

/**
 * Крупные города — чтобы обойти потолок выдачи groups.search.
 * ВК отдаёт максимум около тысячи сообществ на запрос; добавляя город, получаем
 * из одной формулировки десятки разных срезов.
 */
function ih_vk_cities(): array {
    return [
        'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
        'Нижний Новгород', 'Челябинск', 'Самара', 'Уфа', 'Ростов-на-Дону',
        'Краснодар', 'Омск', 'Воронеж', 'Пермь', 'Волгоград', 'Саратов',
        'Тюмень', 'Тольятти', 'Ижевск', 'Барнаул', 'Ульяновск', 'Иркутск',
        'Хабаровск', 'Ярославль', 'Владивосток', 'Махачкала', 'Томск',
        'Оренбург', 'Кемерово', 'Новокузнецк', 'Рязань', 'Астрахань',
        'Пенза', 'Липецк', 'Киров', 'Чебоксары', 'Тула', 'Калининград',
        'Курск', 'Ставрополь', 'Сочи', 'Тверь', 'Магнитогорск', 'Брянск',
        'Белгород', 'Архангельск', 'Владимир', 'Чита', 'Калуга', 'Смоленск',
        'Волжский', 'Курган', 'Орёл', 'Череповец', 'Вологда', 'Мурманск',
        'Тамбов', 'Стерлитамак', 'Грозный', 'Кострома', 'Петрозаводск',
        'Нижневартовск', 'Йошкар-Ола', 'Новороссийск', 'Сургут', 'Псков',
        'Великий Новгород', 'Саранск', 'Якутск', 'Сыктывкар', 'Нижний Тагил',
    ];
}

/**
 * Собирает сообщества ВК по одной формулировке (при желании — с городом).
 *
 * Из карточки берём: название, город, сайт и, если есть, e-mail из описания.
 * Сообщества-магазины и явно посторонние отсеиваем по названию.
 *
 * ПОЧЕМУ СЕТКА «ЗАПРОС × ГОРОД», А НЕ ЛИСТАНИЕ. ВКонтакте показывает, что по запросу
 * «детская школа искусств» есть 5506 сообществ, но отдаёт только первую тысячу:
 * offset свыше 1000 возвращает пустой список. Единственный законный способ достать
 * остальные — сузить запрос. Поэтому каждая формулировка обходится ещё и по городам:
 * «детская школа искусств Казань», «… Пермь» и так далее. Дубли снимает база.
 *
 * @return array ['found'=>int, 'added'=>int]
 */
function ih_harvest_vk(string $query, string $city = '', int $count = 1000): array {
    if (!function_exists('vk_api')) require_once BASE_PATH . '/core/vk.php';
    $q = trim($query . ($city !== '' ? ' ' . $city : ''));

    $r = vk_api('groups.search', [
        'q'      => $q,
        'count'  => max(1, min(1000, $count)),
        'sort'   => 0,
        // ВАЖНО: без fields ВК не отдаёт ни город, ни сайт — а без них запись
        // бесполезна. type не указываем намеренно: там допустимо ровно одно
        // значение, а перечисление через запятую молча возвращает пустой список.
        'fields' => 'members_count,city,description,site,contacts,activity',
    ]);

    $items = $r['response']['items'] ?? [];
    if (!is_array($items)) $items = [];

    $added = 0;
    foreach ($items as $g) {
        $name = trim((string) ($g['name'] ?? ''));
        if ($name === '') continue;

        // Отсекаем то, что заведомо не учреждение.
        $ln = mb_strtolower($name);
        foreach (['магазин', 'купить', 'доставка', 'барахолка', 'объявлен',
                  'знакомств', 'ремонт', 'такси', 'ставк', 'казино'] as $bad) {
            if (mb_strpos($ln, $bad) !== false) continue 2;
        }
        // Название должно быть похоже на учреждение культуры или образования.
        if (inst_kind_detect($name) === 'other') continue;

        $site = trim((string) ($g['site'] ?? ''));
        if ($site !== '' && !preg_match('~^https?://~i', $site)) $site = 'https://' . $site;

        // E-mail иногда лежит прямо в описании или в контактах сообщества.
        $emails = [];
        $blob = (string) ($g['description'] ?? '');
        foreach ((array) ($g['contacts'] ?? []) as $c) {
            if (is_array($c)) $blob .= ' ' . implode(' ', array_map('strval', $c));
        }
        foreach (ih_extract_emails($blob) as $e) $emails[] = $e;

        $added += inst_add([
            'name'      => $name,
            'city'      => trim((string) ($g['city']['title'] ?? '')),
            'site'      => $site,
            'vk'        => trim((string) ($g['screen_name'] ?? '')),
            'vk_id'     => (int) ($g['id'] ?? 0),
            'emails'    => $emails,
            'source'    => 'vk',
            'source_id' => (string) ($g['id'] ?? ''),
        ]) > 0 ? 1 : 0;
    }

    return ['found' => count($items), 'added' => $added];
}

/* =====================================================================
 *  2. Сайты учреждений — вытаскиваем официальный e-mail
 * ===================================================================== */

/** Достаёт адреса из произвольного текста/HTML. */
function ih_extract_emails(string $html): array {
    if ($html === '') return [];
    // Раскрываем частые способы «спрятать» адрес от роботов, которыми пользуются
    // сами учреждения: «имя (собака) домен», «имя [at] домен».
    $t = str_ireplace([' (собака) ', '(собака)', ' [at] ', '[at]', ' (at) ', '&#64;', '&commat;'],
                      '@', $html);
    $t = preg_replace('~mailto:\s*~i', ' ', $t) ?? $t;

    $out = [];
    if (preg_match_all('~[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,10}~u', $t, $m)) {
        foreach ($m[0] as $e) {
            $e = inst_email_norm($e);
            if (inst_email_ok($e)) $out[$e] = true;
        }
    }
    return array_keys($out);
}

/**
 * Несколько страниц ОДНОВРЕМЕННО (curl_multi).
 *
 * Сайты школ отвечают медленно — от секунды до десяти, а иные не отвечают вовсе.
 * Последовательный обход упирался в это намертво: шестьдесят сайтов занимали
 * четверть часа. Здесь они тянутся пачкой, и прогон укладывается в минуту.
 *
 * @param array $urls  [ключ => url]
 * @return array [ключ => [код, тело]]
 */
function ih_get_many(array $urls, int $timeout = 12, int $parallel = 12): array {
    if (!function_exists('curl_multi_init') || !$urls) return [];
    $out = [];
    foreach (array_chunk($urls, max(1, $parallel), true) as $chunk) {
        $mh = curl_multi_init();
        $handles = [];
        $bufs = [];
        foreach ($chunk as $k => $u) {
            $ch = curl_init($u);
            $bufs[$k] = '';
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_MAXREDIRS      => 5,
                CURLOPT_CONNECTTIMEOUT => 6,
                CURLOPT_TIMEOUT        => $timeout,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; MuzMirBot/1.0; +https://музыкальный-мир.рф/contacts)',
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => 0,
                CURLOPT_ENCODING       => '',
                CURLOPT_HTTPHEADER     => ['Accept-Language: ru,en;q=0.8'],
                CURLOPT_WRITEFUNCTION  => function ($c, $chunkData) use (&$bufs, $k) {
                    $bufs[$k] .= $chunkData;
                    return (strlen($bufs[$k]) > 300000) ? 0 : strlen($chunkData);
                },
            ]);
            curl_multi_add_handle($mh, $ch);
            $handles[$k] = $ch;
        }
        do {
            $status = curl_multi_exec($mh, $running);
            if ($running) curl_multi_select($mh, 1.0);
        } while ($running && $status === CURLM_OK);

        foreach ($handles as $k => $ch) {
            $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $body = $bufs[$k] ?? '';
            if ($body !== '' && !mb_check_encoding($body, 'UTF-8')) {
                $conv = @mb_convert_encoding($body, 'UTF-8', 'Windows-1251');
                if (is_string($conv)) $body = $conv;
            }
            $out[$k] = [$code, $body];
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }
        curl_multi_close($mh);
    }
    return $out;
}

/** Одна страница. Возвращает [код, тело]. Тело ограничено 300 КБ. */
function ih_get(string $url, int $timeout = 12): array {
    if (!function_exists('curl_init')) return [0, ''];
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; MuzMirBot/1.0; +https://музыкальный-мир.рф/contacts)',
        CURLOPT_SSL_VERIFYPEER => false,   // у школьных сайтов часто просроченные сертификаты
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_ENCODING       => '',
        CURLOPT_HTTPHEADER     => ['Accept-Language: ru,en;q=0.8'],
    ]);
    $buf = '';
    curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $chunk) use (&$buf) {
        $buf .= $chunk;
        return (strlen($buf) > 300000) ? 0 : strlen($chunk);
    });
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $errno = curl_errno($ch);
    curl_close($ch);
    if ($errno && $errno !== CURLE_WRITE_ERROR) return [0, ''];

    // Сайты школ нередко отдают windows-1251 — иначе кириллица в мусор.
    if ($buf !== '' && !mb_check_encoding($buf, 'UTF-8')) {
        $conv = @mb_convert_encoding($buf, 'UTF-8', 'Windows-1251');
        if (is_string($conv)) $buf = $conv;
    }
    return [$code, $buf];
}

/**
 * Ищет официальный e-mail на сайте учреждения.
 *
 * Порядок обхода: главная, затем типовые адреса страницы контактов. Останавливаемся
 * на первой странице, где адрес нашёлся, — лишние запросы к чужому серверу ни к чему.
 *
 * @return array найденные адреса
 */
function ih_site_emails(string $site): array {
    $site = trim($site);
    if ($site === '') return [];
    if (!preg_match('~^https?://~i', $site)) $site = 'https://' . $site;
    $base = rtrim($site, '/');

    // Отсеиваем соцсети и агрегаторы — там не контакт учреждения, а страница платформы.
    $host = mb_strtolower((string) (parse_url($base, PHP_URL_HOST) ?: ''));
    foreach (['vk.com', 'ok.ru', 'instagram.com', 'facebook.com', 't.me', 'youtube.com',
              'wa.me', 'telegram.me'] as $skip) {
        if ($host === $skip || str_ends_with($host, '.' . $skip)) return [];
    }

    $paths = ['', '/contacts', '/kontakty', '/kontakti', '/contact', '/about',
              '/o-nas', '/svedeniya-ob-obrazovatelnoy-organizacii', '/sveden/common'];
    $found = [];
    foreach ($paths as $p) {
        [$code, $html] = ih_get($base . $p);
        if ($code === 0) break;                  // сайт не отвечает — дальше не долбим
        if ($code >= 400) { ih_sleep(300); continue; }
        foreach (ih_extract_emails($html) as $e) $found[$e] = true;
        if ($found) break;                       // нашли — хватит
        ih_sleep(400);
    }
    return array_keys($found);
}

/**
 * Проходит по записям, у которых есть сайт, но нет почты, и добирает адреса.
 * @return array ['checked'=>int,'filled'=>int]
 */
function ih_fill_emails_from_sites(int $limit = 40): array {
    inst_migrate();
    $rows = [];
    try {
        $rows = all("SELECT id, name, site, source FROM institutions
                      WHERE email='' AND site<>'' AND COALESCE(note,'') NOT LIKE '%сайт без почты%'
                      ORDER BY id ASC LIMIT ?", [max(1, min(200, $limit))]);
    } catch (\Throwable $e) { $rows = []; }
    if (!$rows) return ['checked' => 0, 'filled' => 0, 'refused' => 0];

    // Соцсети и агрегаторы отсеиваем сразу: там страница платформы, а не контакт школы.
    $skipHost = function (string $u): bool {
        $h = mb_strtolower((string) (parse_url($u, PHP_URL_HOST) ?: ''));
        foreach (['vk.com', 'ok.ru', 'instagram.com', 'facebook.com', 't.me', 'youtube.com',
                  'wa.me', 'telegram.me'] as $s) {
            if ($h === $s || str_ends_with($h, '.' . $s)) return true;
        }
        return $h === '';
    };

    $bases = [];
    foreach ($rows as $r) {
        $site = trim((string) $r['site']);
        if ($site === '') continue;
        if (!preg_match('~^https?://~i', $site)) $site = 'https://' . $site;
        if ($skipHost($site)) continue;
        $bases[(int) $r['id']] = rtrim($site, '/');
    }
    if (!$bases) return ['checked' => count($rows), 'filled' => 0, 'refused' => 0];

    // ХОДИМ ВЕЖЛИВО.
    // Первая версия тянула по двенадцать сайтов разом и по четыре страницы у каждого,
    // без пауз. Через несколько минут такой работы наш адрес перестали пускать: сайты
    // школ, включая целую платформу muzkult.ru, начали отвечать 403 всем подряд. Это
    // не «защита от роботов, которую надо обойти» — это мы вели себя как нападающий.
    // Теперь: по четыре запроса разом, пауза между заходами, и главное — не больше
    // ОДНОЙ страницы у сайта за прогон. Не нашли адрес на главной — вернёмся к нему
    // в другой раз, а не будем добивать сервер ещё тремя запросами.
    $found   = [];
    $status  = [];      // id => http-код последней попытки
    $pages   = $bases;

    foreach (['', '/kontakty', '/contacts'] as $pi => $path) {
        if (!$pages) break;
        $urls = [];
        foreach ($pages as $id => $b) $urls[$id] = $b . $path;

        foreach (ih_get_many($urls, 12, 4) as $id => [$code, $html]) {
            $status[$id] = $code;
            if ($code !== 200 || $html === '') {
                // Сервер не пустил или не ответил — этот сайт в этом прогоне больше
                // не трогаем совсем.
                unset($pages[$id]);
                continue;
            }
            $em = ih_extract_emails($html);
            if ($em) { $found[$id] = $em; unset($pages[$id]); }
        }
        if ($pages) ih_sleep(2500);   // пауза между заходами на вторую и третью страницу
    }

    $filled = 0; $refused = 0;
    foreach ($rows as $r) {
        $id   = (int) $r['id'];
        $code = (int) ($status[$id] ?? 0);

        if (!empty($found[$id])) {
            $em = $found[$id];
            try {
                update('institutions', [
                    'email'      => $em[0],
                    'emails'     => json_encode($em, JSON_UNESCAPED_UNICODE),
                    'source'     => trim((string) ($r['source'] ?? '')) . ',site',
                    'note'       => '',
                    'updated_at' => date('Y-m-d H:i:s'),
                ], 'id=:id', ['id' => $id]);
                $filled++;
            } catch (\Throwable $e) {
                try { update('institutions', ['note' => 'адрес уже в базе у другой записи'], 'id=:id', ['id' => $id]); } catch (\Throwable $e2) {}
            }
            continue;
        }

        // ОТКАЗ СЕРВЕРА — ЭТО НЕ «НА САЙТЕ НЕТ ПОЧТЫ».
        // Раньше любая неудача помечала запись как безнадёжную, и сайт больше
        // никогда не проверялся. Из-за этого 403, выданный по нашей же вине,
        // навсегда вычёркивал сотни живых школ. Теперь помечаем ТОЛЬКО когда
        // сайт честно ответил 200 и адреса на странице действительно нет.
        if ($code === 200) {
            try { update('institutions', ['note' => 'сайт без почты'], 'id=:id', ['id' => $id]); } catch (\Throwable $e) {}
        } else {
            $refused++;
        }
    }
    return ['checked' => count($rows), 'filled' => $filled, 'refused' => $refused];
}

/* =====================================================================
 *  3. OpenStreetMap (Overpass API) — полностью открытые данные
 * ===================================================================== */

/**
 * Тянет из OSM объекты культуры и образования с проставленным contact:email.
 *
 * Overpass бесплатен и открыт, но общий для всех — поэтому запрос узкий, по одному
 * региону за раз, и с паузой. Полей с почтой там немного, зато они точны: их
 * заполняли сами учреждения или волонтёры по их сайтам.
 *
 * @param string $area название региона по-русски, как в OSM (например «Республика Татарстан»)
 */
function ih_harvest_osm(string $area, int $timeout = 90): array {
    $q = 'https://overpass-api.de/api/interpreter';
    $ql = '[out:json][timeout:' . (int) $timeout . '];'
        . 'area["name"="' . str_replace('"', '', $area) . '"]["boundary"="administrative"]->.a;'
        . '('
        . 'nwr["amenity"="community_centre"](area.a);'
        . 'nwr["amenity"="arts_centre"](area.a);'
        . 'nwr["amenity"="music_school"](area.a);'
        . 'nwr["amenity"="school"]["school:type"~"art|music",i](area.a);'
        . ');out center tags;';

    $ch = curl_init($q);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => 'data=' . rawurlencode($ql),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout + 20,
        CURLOPT_USERAGENT      => 'MuzMirBot/1.0 (+https://музыкальный-мир.рф/contacts)',
    ]);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($code !== 200 || !is_string($raw)) return ['found' => 0, 'added' => 0, 'error' => 'HTTP ' . $code];

    $d = json_decode($raw, true);
    $els = is_array($d) ? ($d['elements'] ?? []) : [];
    $added = 0;
    foreach ($els as $el) {
        $t = $el['tags'] ?? [];
        if (!is_array($t)) continue;
        $name = trim((string) ($t['name'] ?? ''));
        if ($name === '') continue;

        $email = (string) ($t['contact:email'] ?? $t['email'] ?? '');
        $site  = (string) ($t['contact:website'] ?? $t['website'] ?? '');
        if ($email === '' && $site === '') continue;

        $added += inst_add([
            'name'      => $name,
            'region'    => $area,
            'city'      => (string) ($t['addr:city'] ?? ''),
            'email'     => $email,
            'site'      => $site,
            'phone'     => (string) ($t['contact:phone'] ?? $t['phone'] ?? ''),
            'address'   => trim((string) ($t['addr:street'] ?? '') . ' ' . (string) ($t['addr:housenumber'] ?? '')),
            'source'    => 'osm',
            'source_id' => (string) ($el['type'] ?? '') . '/' . (string) ($el['id'] ?? ''),
        ]) > 0 ? 1 : 0;
    }
    return ['found' => count($els), 'added' => $added];
}

/** Регионы России для обхода OSM (список полный — 85 субъектов). */
function ih_osm_regions(): array {
    return [
        'Республика Адыгея', 'Республика Алтай', 'Республика Башкортостан', 'Республика Бурятия',
        'Республика Дагестан', 'Республика Ингушетия', 'Кабардино-Балкарская Республика',
        'Республика Калмыкия', 'Карачаево-Черкесская Республика', 'Республика Карелия',
        'Республика Коми', 'Республика Крым', 'Республика Марий Эл', 'Республика Мордовия',
        'Республика Саха (Якутия)', 'Республика Северная Осетия — Алания', 'Республика Татарстан',
        'Республика Тыва', 'Удмуртская Республика', 'Республика Хакасия', 'Чеченская Республика',
        'Чувашская Республика', 'Алтайский край', 'Забайкальский край', 'Камчатский край',
        'Краснодарский край', 'Красноярский край', 'Пермский край', 'Приморский край',
        'Ставропольский край', 'Хабаровский край', 'Амурская область', 'Архангельская область',
        'Астраханская область', 'Белгородская область', 'Брянская область', 'Владимирская область',
        'Волгоградская область', 'Вологодская область', 'Воронежская область', 'Ивановская область',
        'Иркутская область', 'Калининградская область', 'Калужская область', 'Кемеровская область',
        'Кировская область', 'Костромская область', 'Курганская область', 'Курская область',
        'Ленинградская область', 'Липецкая область', 'Магаданская область', 'Московская область',
        'Мурманская область', 'Нижегородская область', 'Новгородская область', 'Новосибирская область',
        'Омская область', 'Оренбургская область', 'Орловская область', 'Пензенская область',
        'Псковская область', 'Ростовская область', 'Рязанская область', 'Самарская область',
        'Саратовская область', 'Сахалинская область', 'Свердловская область', 'Смоленская область',
        'Тамбовская область', 'Тверская область', 'Томская область', 'Тульская область',
        'Тюменская область', 'Ульяновская область', 'Челябинская область', 'Ярославская область',
        'Москва', 'Санкт-Петербург', 'Севастополь',
        'Еврейская автономная область', 'Ненецкий автономный округ',
        'Ханты-Мансийский автономный округ — Югра', 'Чукотский автономный округ',
        'Ямало-Ненецкий автономный округ',
    ];
}
