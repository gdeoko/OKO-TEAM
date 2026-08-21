<?php
/**
 * ОДНА ССЫЛКА — ОДНА ЗАЯВКА В КОНКУРСЕ. И ССЫЛКА НА РАБОТУ, А НЕ НА ПАПКУ.
 *
 * Школа искусств прислала 37 заявок на разных детей и с разными названиями работ,
 * а ссылка во всех одна: общая папка облака со всеми рисунками сразу. Для жюри
 * это значит, что «Натюрморт» Ансимовой и «Дракон» Сощенко невозможно различить:
 * по ссылке открывается один и тот же список файлов, и какая работа чья —
 * непонятно. Оценить такое нельзя, а отклонять тридцать семь заявок руками и
 * объяснять каждому — работа на день.
 *
 * Здесь два правила, оба из положения (п. 8.1: одна заявка — один конкурсный
 * материал):
 *
 *   1. В одном конкурсе одна и та же ссылка принимается ОДИН раз. На другой
 *      конкурс ту же работу подать можно — это другое соревнование, и правило
 *      «одна заявка — один материал» там не нарушено.
 *   2. Ссылка ведёт на саму работу — файл или страницу с этим видео, — а не на
 *      папку с десятком файлов.
 *
 * ЧЕГО ЗДЕСЬ НАМЕРЕННО НЕТ, чтобы не запретить лишнего:
 *   • отклонённая заявка ссылку не занимает: человек исправляет причину и подаёт
 *     ту же работу заново — это ровно то, о чём мы сами просим в письме;
 *   • черновики не в счёт;
 *   • ссылка на видеохостинг (RuTube, ВК, ОК, Дзен) — это страница с плеером, и
 *     она законна: файла там не бывает в принципе. Запрет папок касается
 *     облачных хранилищ, где выбор между файлом и папкой есть;
 *   • папка, в которой лежит ровно один файл, принимается: участник просто
 *     поделился не тем видом ссылки, работа при этом одна и понятно какая.
 */
declare(strict_types=1);

/**
 * Ссылка к сравнимому виду.
 *
 * Один и тот же адрес участник пришлёт то с «?list=...», то с utm-метками, то со
 * слэшем в конце. Без приведения к общему виду дубль не поймать: строки разные,
 * работа одна.
 */
function lu_norm(string $url): string {
    $u = trim($url);
    if ($u === '') return '';
    $u = preg_replace('~^https?://~i', '', $u) ?? $u;
    $u = preg_replace('~^www\.~i', '', $u) ?? $u;
    // Служебные параметры выкидываем, значимые (id видео у ОК, ключ доступа) — нет.
    $p = explode('?', $u, 2);
    $base = rtrim($p[0], '/');
    $keep = [];
    if (isset($p[1])) {
        parse_str($p[1], $q);
        foreach ($q as $k => $v) {
            $lk = mb_strtolower((string) $k);
            if (in_array($lk, ['list', 'from', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
                               'utm_content', 'ref', 'ref_src', 'share', 't', 'si', 'feature'], true)) continue;
            $keep[$lk] = is_array($v) ? implode(',', $v) : (string) $v;
        }
        ksort($keep);
    }
    return mb_strtolower($base . ($keep ? '?' . http_build_query($keep) : ''));
}

/**
 * Занята ли ссылка в этом конкурсе.
 *
 * @return array{busy:bool, app:array|null}
 */
function lu_taken(string $url, int $compId, int $exceptAppId = 0): array {
    $norm = lu_norm($url);
    if ($norm === '' || $compId <= 0) return ['busy' => false, 'app' => null];
    try {
        // Сравниваем нормализованные адреса, поэтому тянем кандидатов конкурса и
        // сверяем в коде: в базе лежат исходные ссылки, как их прислал участник.
        $rows = all("SELECT id, number, full_name, group_name, work_title, video_url, status
                       FROM applications
                      WHERE competition_id = ? AND COALESCE(video_url,'') <> ''
                        AND status NOT IN ('rejected','draft')
                        AND id <> ?", [$compId, $exceptAppId]);
    } catch (\Throwable $e) { return ['busy' => false, 'app' => null]; }
    foreach ($rows as $r) {
        if (lu_norm((string) $r['video_url']) === $norm) return ['busy' => true, 'app' => $r];
    }
    return ['busy' => false, 'app' => null];
}

/**
 * Ссылка ведёт на папку, а не на работу?
 *
 * Проверяем только там, где у участника есть выбор: облачные хранилища. У
 * видеохостингов ссылка всегда ведёт на страницу с плеером, и требовать от них
 * «файл» бессмысленно.
 *
 * @return array{folder:bool, files:int, why:string}
 */
function lu_is_folder(string $url): array {
    $no = ['folder' => false, 'files' => 0, 'why' => ''];
    $u  = mb_strtolower(trim($url));
    if ($u === '') return $no;

    try {
        if (str_contains($u, 'cloud.mail.ru')) {
            if (!preg_match('~cloud\.mail\.ru/public/([^/?#]+)/([^?#]+)~i', $url, $m)) return $no;
            $weblink = $m[1] . '/' . ltrim($m[2], '/');
            $info = json_decode((string) @file_get_contents(
                'https://cloud.mail.ru/api/v2/file?weblink=' . rawurlencode($weblink) . '&api=2'), true);
            $kind = (string) ($info['body']['kind'] ?? '');
            if ($kind === 'file') return $no;
            if ($kind === 'folder') {
                $files = 0;
                foreach ((array) ($info['body']['list'] ?? []) as $it) {
                    if (($it['kind'] ?? '') === 'file') $files++;
                }
                // Папка с одним файлом — это та же работа, просто ссылка другого
                // вида. Придираться незачем.
                if ($files === 1) return $no;
                return ['folder' => true, 'files' => $files,
                        'why' => 'Ссылка ведёт на папку' . ($files > 1 ? ' с ' . $files . ' файлами' : '') . ', а не на саму работу.'];
            }
            return $no;
        }
        if (str_contains($u, 'disk.yandex') || str_contains($u, 'yadi.sk')) {
            $meta = json_decode((string) @file_get_contents(
                'https://cloud-api.yandex.net/v1/disk/public/resources?public_key=' . rawurlencode($url) . '&limit=50'), true);
            $type = (string) ($meta['type'] ?? '');
            if ($type === 'file') return $no;
            if ($type === 'dir') {
                $files = 0;
                foreach ((array) ($meta['_embedded']['items'] ?? []) as $it) {
                    if (($it['type'] ?? '') === 'file') $files++;
                }
                if ($files === 1) return $no;
                return ['folder' => true, 'files' => $files,
                        'why' => 'Ссылка ведёт на папку' . ($files > 1 ? ' с ' . $files . ' файлами' : '') . ', а не на саму работу.'];
            }
            return $no;
        }
        if (str_contains($u, 'drive.google')) {
            // У Google папка отличается от файла прямо в адресе.
            if (preg_match('~drive\.google\.com/drive/(u/\d+/)?folders/~i', $url)) {
                return ['folder' => true, 'files' => 0,
                        'why' => 'Ссылка ведёт на папку Google Диска, а не на саму работу.'];
            }
            return $no;
        }
    } catch (\Throwable $e) { return $no; }
    return $no;
}

/**
 * Полная проверка ссылки для формы подачи.
 *
 * @return array{ok:bool, reason:string}
 */
function lu_check(string $url, int $compId, int $exceptAppId = 0): array {
    $f = lu_is_folder($url);
    if ($f['folder']) {
        return ['ok' => false, 'reason' => $f['why']
            . ' Откройте нужный файл и скопируйте ссылку именно на него: по одной работе на каждую заявку '
            . '(п. 8.1 положения). Если работ несколько, для каждой нужна своя заявка и своя ссылка.'];
    }
    $t = lu_taken($url, $compId, $exceptAppId);
    if ($t['busy']) {
        $who = trim((string) ($t['app']['group_name'] ?? '')) !== ''
            ? (string) $t['app']['group_name'] : (string) ($t['app']['full_name'] ?? '');
        return ['ok' => false, 'reason' => 'Эта ссылка уже подана на этот конкурс'
            . (trim((string) ($t['app']['work_title'] ?? '')) !== ''
                ? ' — работа «' . (string) $t['app']['work_title'] . '»' . ($who !== '' ? ', ' . $who : '') : '')
            . '. Одна заявка — один конкурсный материал (п. 8.1 положения): для каждой работы нужна отдельная ссылка. '
            . 'На другой конкурс эту же работу подать можно.'];
    }
    return ['ok' => true, 'reason' => ''];
}
