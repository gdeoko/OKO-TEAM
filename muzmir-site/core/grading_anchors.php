<?php
/**
 * ЭТАЛОНЫ КОНКУРСА: как живое жюри оценивало работы такого же рода.
 *
 * Рубрика говорит, за что ставить балл. Паспорт направления говорит, что в этом
 * направлении хорошо, а что плохо. Оба знания книжные и одинаковые для любого
 * конкурса. Не хватало третьего: где на этой шкале стоит планка ИМЕННО НАШЕГО
 * состава жюри. Отсюда и брался главный перекос: машина разбирала работу верно,
 * но звание выдавала не то, потому что не знала, что у нас ЛАУРЕАТ II это самое
 * частое звание, а ЛАУРЕАТ III почти не выдаётся.
 *
 * Здесь из уже оценённых человеком работ собирается короткий блок: разбор машины
 * рядом со званием, которое поставил человек. Модель видит соответствие
 * «такие наблюдения — такое звание» на своих же формулировках.
 *
 * Эталоны берутся по убыванию близости: то же направление → та же номинация →
 * весь конкурс. Своя заявка из выборки исключается всегда, иначе модель просто
 * спишет ответ.
 */
declare(strict_types=1);

/** Порядок званий от высшего к низшему: по нему сортируются эталоны. */
function ga_rank(string $title): int {
    $order = ['ГРАН-ПРИ' => 8, 'ЛАУРЕАТ I СТЕПЕНИ' => 7, 'ЛАУРЕАТ II СТЕПЕНИ' => 6,
              'ЛАУРЕАТ III СТЕПЕНИ' => 5, 'ДИПЛОМАНТ I СТЕПЕНИ' => 4, 'ДИПЛОМАНТ II СТЕПЕНИ' => 3,
              'ДИПЛОМАНТ III СТЕПЕНИ' => 2, 'УЧАСТНИК КОНКУРСА' => 1];
    return $order[mb_strtoupper(trim($title))] ?? 0;
}

/**
 * Выжимка из разбора: два самых слабых и самый сильный критерий.
 * Полный разбор в эталон класть нельзя — пять эталонов раздули бы промпт втрое.
 */
function ga_digest(string $scoresJson, int $limit = 320): string {
    $rows = json_decode($scoresJson, true);
    if (!is_array($rows) || !$rows) return '';
    $list = [];
    foreach ($rows as $c) {
        if (!is_array($c)) continue;
        $list[] = ['t' => (string) ($c['title'] ?? ''), 's' => (float) ($c['score'] ?? 0), 'n' => (string) ($c['note'] ?? '')];
    }
    if (!$list) return '';
    usort($list, static fn(array $a, array $b): int => $a['s'] <=> $b['s']);
    $take = [];
    foreach ([$list[0], $list[1] ?? null, $list[count($list) - 1]] as $c) {
        if ($c === null) continue;
        $note = trim(preg_replace('~\s+~u', ' ', $c['n']));
        // Из обоснования берём первое наблюдение: оно самое конкретное.
        $note = preg_split('~(?<=[.;])\s~u', $note)[0] ?? $note;
        $take[] = sprintf('%s %.0f (%s)', $c['t'], $c['s'], mb_substr($note, 0, 110));
    }
    return mb_substr(implode('; ', $take), 0, $limit);
}

/**
 * Эталоны для заявки. По одному примеру на звание, от высшего к низшему.
 * @return array<int,array{title:string,work:string,age:string,form:string,sub:string,digest:string,same:bool}>
 */
function ga_examples(array $app, int $max = 5): array {
    $nom  = (string) ($app['nomination'] ?? '');
    $sub  = (string) ($app['subgroup'] ?? '');
    $self = (int) ($app['id'] ?? 0);

    $sql = "SELECT a.id, a.result, a.work_title, a.age_category, a.formation, a.subgroup, a.nomination,
                   r.scores, r.confidence
              FROM grading_runs r
              JOIN applications a ON a.id = r.application_id
             WHERE r.status = 'ok' AND r.scores <> '' AND a.result <> '' AND a.id <> ?
               AND a.nomination = ?
          ORDER BY r.confidence DESC, r.id DESC
             LIMIT 200";
    $rows = all($sql, [$self, $nom]);
    if (count($rows) < 3) {
        // Номинация ещё не набрала истории: добираем по всему конкурсу.
        $rows = array_merge($rows, all(
            "SELECT a.id, a.result, a.work_title, a.age_category, a.formation, a.subgroup, a.nomination,
                    r.scores, r.confidence
               FROM grading_runs r
               JOIN applications a ON a.id = r.application_id
              WHERE r.status = 'ok' AND r.scores <> '' AND a.result <> '' AND a.id <> ? AND a.nomination <> ?
           ORDER BY r.confidence DESC, r.id DESC
              LIMIT 200", [$self, $nom]));
    }

    // По одному эталону на звание: пять примеров одного и того же звания
    // ничему не учат, а разброс по ступеням как раз показывает границы.
    $byTitle = [];
    foreach ($rows as $r) {
        $t = mb_strtoupper(trim((string) $r['result']));
        if (ga_rank($t) === 0) continue;
        $same = $sub !== '' && (string) $r['subgroup'] === $sub;
        // Из одного звания оставляем пример своего направления, если он есть.
        if (isset($byTitle[$t]) && !($same && !$byTitle[$t]['same'])) continue;
        $d = ga_digest((string) $r['scores']);
        if ($d === '') continue;
        $byTitle[$t] = [
            'title'  => $t,
            'work'   => (string) $r['work_title'],
            'age'    => (string) $r['age_category'],
            'form'   => (string) $r['formation'],
            'sub'    => (string) $r['subgroup'],
            'digest' => $d,
            'same'   => $same,
        ];
    }
    uasort($byTitle, static fn(array $a, array $b): int => ga_rank($b['title']) <=> ga_rank($a['title']));
    return array_slice(array_values($byTitle), 0, $max);
}

/** Доли званий у живого жюри: сколько работ какого уровня в этом потоке. */
function ga_distribution(string $nomination = ''): array {
    $rows = $nomination !== ''
        ? all("SELECT result, COUNT(*) n FROM applications WHERE result <> '' AND nomination = ? GROUP BY result", [$nomination])
        : [];
    $total = 0;
    foreach ($rows as $r) $total += (int) $r['n'];
    if ($total < 12) {                      // мало истории по номинации — берём весь конкурс
        $rows = all("SELECT result, COUNT(*) n FROM applications WHERE result <> '' GROUP BY result");
        $total = 0;
        foreach ($rows as $r) $total += (int) $r['n'];
    }
    if ($total < 12) return [];
    $out = [];
    foreach ($rows as $r) {
        $t = mb_strtoupper(trim((string) $r['result']));
        if (ga_rank($t) === 0) continue;
        $out[$t] = (int) round((int) $r['n'] * 100 / $total);
    }
    uksort($out, static fn(string $a, string $b): int => ga_rank($b) <=> ga_rank($a));
    return $out;
}

/** Готовый блок для промпта. Пустая строка, если истории ещё нет. */
function ga_block(array $app): string {
    if ((string) setting('grade_anchors', '1') !== '1') return '';
    try {
        $ex   = ga_examples($app);
        $dist = ga_distribution((string) ($app['nomination'] ?? ''));
    } catch (\Throwable $e) { return ''; }
    if (!$ex && !$dist) return '';

    $L = [];
    $L[] = 'ПЛАНКА НАШЕГО КОНКУРСА (это не теория, это решения живого жюри)';
    if ($dist) {
        $parts = [];
        foreach ($dist as $t => $p) $parts[] = $t . ' ' . $p . '%';
        $L[] = '  Как распределяются звания у нас: ' . implode(', ', $parts) . '.';
        $L[] = '  ВНИМАНИЕ: это ориентир для выбора ЗВАНИЯ, а не для балла. Баллы ставь по абсолютным якорям выше: 90 и больше означает уровень, который показывают без скидок на возраст и любительский статус, независимо от того, как часто у нас выдаются звания. Знание того, что лауреатов у нас много, не делает работу сильнее.';
    }
    if ($ex) {
        $L[] = '  Работы, которые уже разобрала ты и оценил человек. Слева наблюдения из разбора, справа звание от жюри:';
        foreach ($ex as $e) {
            $head = trim(($e['sub'] !== '' ? $e['sub'] . ', ' : '') . ($e['age'] !== '' ? $e['age'] . ', ' : '') . $e['form'], ', ');
            $L[] = sprintf('    • %s — %s', $e['title'], $head !== '' ? $head : 'состав не указан');
            $L[] = '      ' . $e['digest'];
        }
        $L[] = '  Сопоставь свою работу с этими: если наблюдения по ней слабее, чем у примера с более низким званием, звание должно быть ниже.';
    }
    return implode("\n", $L);
}
