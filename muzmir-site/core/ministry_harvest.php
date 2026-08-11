<?php
/**
 * ПОИСК АДРЕСОВ РЕГИОНАЛЬНЫХ ОРГАНОВ КУЛЬТУРЫ И ОБРАЗОВАНИЯ.
 *
 * Единого справочника с почтой министерств культуры не существует: у каждого
 * региона свой сайт, свой движок и своя выдумка насчёт того, где прятать адрес.
 * Единственная устойчивая точка входа — официальный портал правительства
 * региона: он есть у всех, домен не меняется годами, и с него всегда есть
 * ссылка на органы власти.
 *
 * ПОРЯДОК РАБОТЫ ПО РЕГИОНУ:
 *   1) берём портал правительства;
 *   2) собираем со страницы ссылки, в тексте которых есть «культур» или
 *      «образован» — это карточка или сайт ведомства;
 *   3) заходим по ним и берём адреса, отдавая предпочтение почте на домене
 *      региона (mkbo@belgov.ru надёжнее, чем чей-то ящик из новости);
 *   4) записываем вместе со ссылкой, откуда взяли, и статусом «new».
 *
 * ОТПРАВЛЯТЬ ПО НАЙДЕННОМУ АВТОМАТИЧЕСКИ НЕЛЬЗЯ. Автомат ошибается: возьмёт
 * ящик пресс-центра подведомственного музея и выдаст за министерство. Поэтому
 * найденное садится в базу со статусом «new» и ждёт глазной проверки в админке —
 * ровно так же, как проверялись первые полсотни адресов.
 *
 * ПРО ВЕЖЛИВОСТЬ. Один регион за прогон, не больше восьми запросов, пауза между
 * ними. Государственные сайты живут на слабом железе, и лишняя нагрузка нам
 * ничего не даст, а вот в чёрный список попасть можно (уже проверено на школах).
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/ministries.php';
require_once __DIR__ . '/inst_harvest.php';   // ih_get(), ih_extract_emails()

/**
 * ГЛАВНЫЙ ИСТОЧНИК: реестр органов управления культурой Минкультуры России.
 *
 * В наборе organizations на opendata.mkrf.ru есть отдельный тип карточки —
 * «Органы управления культуры». Это восемь с лишним десятков записей: все
 * региональные министерства и департаменты культуры, каждое с официальной
 * почтой и ФИО руководителя. Ровно то, что нужно для именного обращения, и
 * ровно то, что обходом порталов собиралось бы неделю и с ошибками.
 *
 * Обход порталов правительств (ниже) остаётся, но уже как добор: там ищутся
 * органы образования, которых в реестре Минкультуры нет по определению.
 */
function mh_import_mkrf(): array {
    require_once __DIR__ . '/inst_harvest.php';
    min_migrate();

    $filter = rawurlencode(json_encode(['data.orgkind' => 'Органы управления культуры'], JSON_UNESCAPED_UNICODE));
    $url    = 'https://opendata.mkrf.ru/v2/organizations/$?l=200&f=' . $filter;

    $added = 0; $seen = 0; $noMail = 0;
    while ($url !== '') {
        $d = ih_mkrf_get($url);
        if (!$d) return ['added' => $added, 'seen' => $seen, 'error' => 'портал не ответил'];

        foreach ((array) ($d['data'] ?? []) as $r) {
            $g = (array) ($r['data'] ?? []);
            $seen++;

            $org = trim((string) ($g['adesc'] ?? ''));
            $mails = ih_extract_emails((string) ($g['E-mail'] ?? ''));
            if ($org === '' || !$mails) { $noMail++; continue; }

            $site = trim((string) ($g['website'] ?? ''));
            if ($site !== '' && !preg_match('~^https?://~i', $site)) $site = 'https://' . $site;

            $person = function_exists('inst_clean_fio')
                ? inst_clean_fio((string) ($g['director'] ?? ''))
                : trim((string) ($g['director'] ?? ''));

            foreach (array_slice($mails, 0, 2) as $m) {
                $added += min_add([
                    'org'         => $org,
                    'region'      => trim((string) ($g['territory'] ?? '')),
                    'kind'        => 'culture',
                    'branch'      => 'main',
                    'email'       => $m,
                    'person'      => $person,
                    'person_role' => mh_role_from_org($org),
                    'site'        => $site,
                    'source_url'  => 'https://opendata.mkrf.ru/opendata (реестр организаций культуры, тип «Органы управления культуры»)',
                    'note'        => 'официальный реестр Минкультуры России',
                ]);
            }
        }

        $url = (string) ($d['nextPage'] ?? '');
        if ($url !== '') usleep(400000);
    }

    return ['added' => $added, 'seen' => $seen, 'no_mail' => $noMail];
}

/**
 * «Министерство культуры Республики Карелия» → «Министру культуры Республики Карелия».
 *
 * В шапке официального письма адресат пишется в дательном падеже, и это первое,
 * что видит делопроизводитель. «В Министерство культуры» вместо «Министру»
 * читается как письмо от того, кто с ведомствами дела не имел.
 */
function mh_role_from_org(string $org): string {
    $o = trim($org);
    if ($o === '') return '';
    $rules = [
        '~^Министерство\s+~ui'  => 'Министру ',
        '~^Департамент\s+~ui'   => 'Директору департамента ',
        '~^Комитет\s+~ui'       => 'Председателю комитета ',
        '~^Управление\s+~ui'    => 'Начальнику управления ',
        '~^Отдел\s+~ui'         => 'Начальнику отдела ',
        '~^Агентство\s+~ui'     => 'Руководителю агентства ',
        '~^Служба\s+~ui'        => 'Руководителю службы ',
    ];
    foreach ($rules as $re => $to) {
        if (preg_match($re, $o)) return preg_replace($re, $to, $o) ?? $o;
    }
    return 'Руководителю: ' . $o;
}

/**
 * Регион → официальный портал правительства.
 *
 * Домены брались не из памяти: каждый проверен запросом с боевого сервера, и
 * список пересматривается, когда регион переезжает на новый портал (такое
 * бывает раз в несколько лет).
 */
function mh_regions(): array {
    return [
        ['Республика Адыгея',                    'adygheya.ru'],
        ['Республика Алтай',                     'altai-republic.ru'],
        ['Республика Башкортостан',              'bashkortostan.ru'],
        ['Республика Бурятия',                   'egov-buryatia.ru'],
        ['Республика Дагестан',                  'e-dag.ru'],
        ['Республика Ингушетия',                 'ingushetia.ru'],
        ['Кабардино-Балкарская Республика',      'pravitelstvo.kbr.ru'],
        ['Республика Калмыкия',                  'kalmregion.ru'],
        ['Карачаево-Черкесская Республика',      'kchr.ru'],
        ['Республика Марий Эл',                  'mari-el.gov.ru'],
        ['Республика Мордовия',                  'e-mordovia.ru'],
        ['Республика Саха (Якутия)',             'sakha.gov.ru'],
        ['Республика Северная Осетия — Алания',  'alania.gov.ru'],
        ['Республика Татарстан',                 'tatarstan.ru'],
        ['Республика Тыва',                      'rtyva.ru'],
        ['Удмуртская Республика',                'udmurt.ru'],
        ['Республика Хакасия',                   'r-19.ru'],
        ['Чеченская Республика',                 'chechnya.gov.ru'],
        ['Чувашская Республика',                 'cap.ru'],
        ['Республика Крым',                      'rk.gov.ru'],
        ['Алтайский край',                       'altairegion22.ru'],
        ['Забайкальский край',                   '75.ru'],
        ['Камчатский край',                      'kamgov.ru'],
        ['Краснодарский край',                   'admkrai.krasnodar.ru'],
        ['Красноярский край',                    'krskstate.ru'],
        ['Пермский край',                        'permkrai.ru'],
        ['Приморский край',                      'primorsky.ru'],
        ['Ставропольский край',                  'stavregion.ru'],
        ['Хабаровский край',                     'khabkrai.ru'],
        ['Амурская область',                     'amurobl.ru'],
        ['Астраханская область',                 'astrobl.ru'],
        ['Владимирская область',                 'avo.ru'],
        ['Волгоградская область',                'volgograd.ru'],
        ['Воронежская область',                  'govvrn.ru'],
        ['Иркутская область',                    'irkobl.ru'],
        ['Калининградская область',              'gov39.ru'],
        ['Кемеровская область',                  'ako.ru'],
        ['Кировская область',                    'kirovreg.ru'],
        ['Курганская область',                   'kurganobl.ru'],
        ['Курская область',                      'adm.rkursk.ru'],
        ['Ленинградская область',                'lenobl.ru'],
        ['Магаданская область',                  '49gov.ru'],
        ['Московская область',                   'mosreg.ru'],
        ['Нижегородская область',                'nobl.ru'],
        ['Новосибирская область',                'nso.ru'],
        ['Омская область',                       'omskportal.ru'],
        ['Оренбургская область',                 'orb.ru'],
        ['Орловская область',                    'orel-region.ru'],
        ['Пензенская область',                   'pnzreg.ru'],
        ['Псковская область',                    'pskov.ru'],
        ['Ростовская область',                   'donland.ru'],
        ['Рязанская область',                    'ryazangov.ru'],
        ['Самарская область',                    'samregion.ru'],
        ['Саратовская область',                  'saratov.gov.ru'],
        ['Сахалинская область',                  'sakhalin.gov.ru'],
        ['Свердловская область',                 'midural.ru'],
        ['Тамбовская область',                   'tambov.gov.ru'],
        ['Тверская область',                     'tverreg.ru'],
        ['Томская область',                      'tomsk.gov.ru'],
        ['Тюменская область',                    'admtyumen.ru'],
        ['Ульяновская область',                  'ulgov.ru'],
        ['Челябинская область',                  'gubernator74.ru'],
        ['Ярославская область',                  'yarregion.ru'],
        ['Москва',                               'mos.ru'],
        ['Санкт-Петербург',                      'gov.spb.ru'],
        ['Севастополь',                          'sev.gov.ru'],
        ['Еврейская автономная область',         'eao.ru'],
        ['Ненецкий автономный округ',            'adm-nao.ru'],
        ['Ханты-Мансийский автономный округ — Югра', 'admhmao.ru'],
        ['Чукотский автономный округ',           'chukotka.gov.ru'],
        ['Ямало-Ненецкий автономный округ',      'yanao.ru'],
    ];
}

/** Ссылка ведёт на орган культуры или образования? Судим по тексту ссылки. */
function mh_link_is_target(string $text): string {
    $t = mb_strtolower($text);
    $isBody = preg_match('~министерств|департамент|комитет|управлени~u', $t);
    if (!$isBody) return '';
    if (preg_match('~культур~u', $t))    return 'culture';
    if (preg_match('~образован|просвещ~u', $t)) return 'education';
    return '';
}

/** Вытаскивает из HTML пары [текст ссылки => абсолютный URL]. */
function mh_links(string $html, string $base): array {
    $out = [];
    if (!preg_match_all('~<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>~isu', $html, $m, PREG_SET_ORDER)) {
        return $out;
    }
    foreach ($m as $x) {
        $href = trim(html_entity_decode($x[1], ENT_QUOTES, 'UTF-8'));
        $text = trim(preg_replace('~\s+~u', ' ', strip_tags($x[2])));
        if ($text === '' || $href === '' || $href[0] === '#') continue;
        if (preg_match('~^(mailto|tel|javascript):~i', $href)) continue;

        if (preg_match('~^//~', $href))            $href = 'https:' . $href;
        elseif (preg_match('~^/~', $href))         $href = rtrim($base, '/') . $href;
        elseif (!preg_match('~^https?://~i', $href)) $href = rtrim($base, '/') . '/' . ltrim($href, '/');

        $out[$href] = $text;
    }
    return $out;
}

/**
 * Из набора найденных адресов выбирает те, что похожи на официальные.
 *
 * Правило простое и проверенное на первых пятидесяти регионах: адрес на домене
 * ведомства или на домене портала региона — почти всегда настоящий; ящик на
 * mail.ru или yandex.ru тоже бывает настоящим (Брянск), но требует проверки
 * глазами, поэтому мы его берём, но помечаем.
 */
function mh_pick_emails(array $emails, string $host, string $portal): array {
    $good = []; $maybe = [];
    foreach ($emails as $e) {
        $e = mb_strtolower(trim($e));
        if (!min_email_ok($e)) continue;
        $dom = substr(strrchr($e, '@') ?: '', 1);
        if ($dom === '') continue;
        // Явно чужие: разработчики сайта, техподдержка платформы, банки.
        if (preg_match('~(support|help|hosting|bitrix|1c|sber|gosuslugi)~i', $e)) continue;
        if (str_contains($host, $dom) || str_contains($dom, $portal) || str_contains($portal, $dom)) $good[] = $e;
        else $maybe[] = $e;
    }
    return $good ?: array_slice($maybe, 0, 2);
}

/**
 * Один регион: находит и записывает адреса органов культуры и образования.
 *
 * @return array ['region'=>.., 'added'=>int, 'found'=>[..], 'note'=>string]
 */
function mh_harvest_region(string $region, string $portal, int $maxPages = 6): array {
    $base = 'https://' . $portal;
    [$code, $html] = ih_get($base, 20);
    if ($code !== 200 || $html === '') {
        return ['region' => $region, 'added' => 0, 'found' => [], 'note' => "портал не открылся (код $code)"];
    }

    // Сначала ссылки на карточки органов, потом — на разделы «Контакты» самих
    // ведомств. Больше шести страниц на регион не берём: не тот случай, когда
    // упорство окупается.
    $targets = [];
    foreach (mh_links($html, $base) as $url => $text) {
        $kind = mh_link_is_target($text);
        if ($kind === '') continue;
        if (isset($targets[$url])) continue;
        $targets[$url] = ['kind' => $kind, 'text' => $text];
        if (count($targets) >= $maxPages) break;
    }

    if (!$targets) {
        return ['region' => $region, 'added' => 0, 'found' => [],
                'note' => 'на портале нет ссылок с «культура»/«образование» в тексте'];
    }

    $added = 0; $found = [];
    foreach ($targets as $url => $t) {
        usleep(900000);                       // почти секунда между запросами
        [$c, $page] = ih_get($url, 20);
        if ($c !== 200 || $page === '') continue;

        $host = parse_url($url, PHP_URL_HOST) ?: '';
        $mails = mh_pick_emails(ih_extract_emails($page), $host, $portal);
        if (!$mails) {
            // Карточка органа часто только ссылается на его собственный сайт —
            // тогда идём на один шаг глубже, но не дальше.
            foreach (mh_links($page, 'https://' . $host) as $u2 => $txt2) {
                if (!preg_match('~контакт|contact~iu', $txt2)) continue;
                usleep(900000);
                [$c2, $p2] = ih_get($u2, 20);
                if ($c2 === 200 && $p2 !== '') {
                    $mails = mh_pick_emails(ih_extract_emails($p2), parse_url($u2, PHP_URL_HOST) ?: '', $portal);
                    if ($mails) { $url = $u2; }
                }
                break;
            }
        }

        foreach (array_slice($mails, 0, 2) as $m) {
            $found[] = $m;
            $added += min_add([
                'org'        => $t['text'] . ' (' . $region . ')',
                'region'     => $region,
                'kind'       => $t['kind'],
                'branch'     => 'main',
                'email'      => $m,
                'site'       => 'https://' . $host,
                'source_url' => $url,
                'note'       => 'найдено обходом портала региона, адрес глазами не проверен',
            ]);
        }
    }

    return ['region' => $region, 'added' => $added, 'found' => $found, 'note' => ''];
}
