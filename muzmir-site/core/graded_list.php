<?php
/**
 * СПИСОК ОЦЕНЁННЫХ ЗАЯВОК — ОБЩИЙ ДЛЯ КОРОТКИХ И ДЛИННЫХ КОНКУРСОВ.
 *
 * В обоих разделах оценки список устроен одинаково: сверху очередь на аттестацию,
 * снизу — всё, что администратор уже разобрал. «Разобрал» включает ОТКЛОНЁННЫЕ
 * заявки: отклонение — такое же решение по заявке, как и звание, и пропадать из
 * поля зрения оно не должно. Раньше отклонённая заявка исчезала отовсюду, и
 * проверить своё же решение было негде.
 *
 * Здесь только данные и вычисления. Разметку строит admin_graded_table() в
 * admin/_boot.php — она общая для обоих разделов.
 */
declare(strict_types=1);

/**
 * Оценённые и отклонённые заявки конкурса.
 *
 * @param int    $comp  конкурс; 0 — все
 * @param string $q     поисковая строка (многословная, регистронезависимая)
 * @param string $order 'new' — новые сверху, иначе старые сверху
 * @param string $scope 'short' — только короткие, 'long' — только длинные, '' — любые
 */
function graded_rows(int $comp = 0, string $q = '', string $order = 'new', string $scope = ''): array {
    // Разобранная заявка — это либо выставленный результат, либо отклонение.
    $w = "(COALESCE(a.result,'') <> '' OR a.status = 'rejected')";
    $args = [];
    if ($comp) { $w .= " AND a.competition_id = ?"; $args[] = $comp; }
    if ($scope === 'long')  $w .= " AND COALESCE(c.results_mode,'email') = 'list'";
    if ($scope === 'short') $w .= " AND COALESCE(c.results_mode,'email') <> 'list'";

    $q = trim($q);
    if ($q !== '' && function_exists('search_like')) {
        [$sq, $sa] = search_like(['a.full_name','a.group_name','a.number','a.email','a.phone',
                                  'a.work_title','a.teacher','a.institution','a.city','a.result',
                                  'a.extra_diploma','c.name'], $q);
        if ($sq !== '') { $w .= " AND ($sq)"; $args = array_merge($args, $sa); }
    }

    // Сортируем по МОМЕНТУ РАЗБОРА, а не по подаче: администратор ищет здесь то,
    // что оценил только что, — «новые оценённые» сверху. Отклонённые метки времени
    // не имеют, для них берём дату подачи.
    $dir = $order === 'old' ? 'ASC' : 'DESC';
    return all(
        "SELECT a.*, c.name comp, c.results_mode, c.results_date, c.results_published_at,
                c.is_paid comp_is_paid, c.slug comp_slug
           FROM applications a
           LEFT JOIN competitions c ON c.id = a.competition_id
          WHERE $w
          ORDER BY COALESCE(NULLIF(a.graded_at,''), a.created_at) $dir, a.id $dir
          LIMIT 500", $args);
}

/**
 * КОГДА УЧАСТНИК УЗНАЕТ РЕЗУЛЬТАТ И ПОЛУЧИТ ДИПЛОМЫ.
 *
 * Возвращает две строки для колонки «Отправка»: про результат и про наградные
 * документы. Слово «отправлено» ставим только там, где письмо действительно ушло,
 * — по этой колонке администратор отвечает участнику на вопрос «когда придёт».
 *
 * @return array{result:string, result_done:bool, docs:string, docs_done:bool}
 */
function graded_send_info(array $a): array {
    $isLong = (string) ($a['results_mode'] ?? 'email') === 'list';
    $fmt = static fn(string $dt): string => $dt === '' ? '' : date('d.m.Y H:i', strtotime($dt));

    /* --- Результат --- */
    if ((string) $a['status'] === 'rejected') {
        $res = 'письмо об отклонении отправлено';
        $resDone = true;
    } elseif (($sent = trim((string) ($a['result_sent_at'] ?? ''))) !== '') {
        $res = 'отправлен ' . $fmt($sent);
        $resDone = true;
    } elseif ($isLong) {
        // У длинного конкурса персональных писем нет: итоги публикуются пакетом.
        $pub = trim((string) ($a['results_published_at'] ?? ''));
        if ($pub !== '')      { $res = 'итоги опубликованы ' . $fmt($pub); $resDone = true; }
        else {
            $d = trim((string) ($a['results_date'] ?? ''));
            $res = 'в списке итогов' . ($d !== '' ? ' ' . date('d.m.Y', strtotime($d)) : ' 28-го числа');
            $resDone = false;
        }
    } elseif (($plan = trim((string) ($a['result_send_at'] ?? ''))) !== '') {
        $res = 'уйдёт ' . $fmt($plan);
        $resDone = false;
    } else {
        $res = 'срок не назначен';
        $resDone = false;
    }

    /* --- Наградные документы --- */
    $dips = function_exists('all') ? all(
        "SELECT type, scheduled_at, sent_at FROM diplomas WHERE application_id = ? ORDER BY id", [(int) $a['id']]
    ) : [];
    if (!$dips) {
        // Для длинного и бесплатного это норма: диплом делается только по оплаченному заказу.
        $docs = $isLong || (int) ($a['comp_is_paid'] ?? 1) === 0 ? 'по заказу участника' : 'ещё не изготовлены';
        $docsDone = false;
    } else {
        $sentAt = ''; $planAt = ''; $nSent = 0;
        foreach ($dips as $d) {
            $s = trim((string) ($d['sent_at'] ?? ''));
            if ($s !== '') { $nSent++; if ($sentAt === '' || $s > $sentAt) $sentAt = $s; }
            else {
                $p = trim((string) ($d['scheduled_at'] ?? ''));
                if ($p !== '' && ($planAt === '' || $p < $planAt)) $planAt = $p;
            }
        }
        if ($nSent === count($dips)) { $docs = 'отправлены ' . $fmt($sentAt); $docsDone = true; }
        elseif ($planAt !== '')      { $docs = 'уйдут ' . $fmt($planAt) . ' (' . count($dips) . ' шт.)'; $docsDone = false; }
        else                         { $docs = 'готовы, срок не назначен'; $docsDone = false; }
    }

    return ['result' => $res, 'result_done' => $resDone, 'docs' => $docs, 'docs_done' => $docsDone];
}

/**
 * Следующий свободный номер заявки конкурса — «КОД-ГОД-00042».
 *
 * Тот же формат, что и при подаче с сайта (gen_application_number в api/v1/_boot.php),
 * но без загрузки API-бутстрапа: он поднимает авторизацию и заголовки, которым в
 * админке делать нечего. Счётчик — количество заявок конкурса; если номер занят
 * (заявку удаляли), берём следующий.
 */
function app_next_number(array $comp): string {
    $code = trim((string) ($comp['code'] ?? '')) !== '' ? (string) $comp['code'] : 'MM';
    $year = date('Y');
    $base = (int) scalar("SELECT COUNT(*) FROM applications WHERE competition_id=?", [(int) $comp['id']]);
    for ($i = 1; $i <= 50; $i++) {
        $n = sprintf('%s-%s-%05d', $code, $year, $base + $i);
        if (!one("SELECT id FROM applications WHERE number=?", [$n])) return $n;
    }
    return sprintf('%s-%s-%05d', $code, $year, time() % 100000);
}

/**
 * ДУБЛИРОВАНИЕ ЗАЯВКИ.
 *
 * Копия нужна, когда один участник идёт тем же номером на второй конкурс или
 * подал работу с ошибкой в данных: переписывать десять полей руками дольше, чем
 * поправить одно в копии.
 *
 * Копируем только СОДЕРЖАНИЕ заявки. Решение жюри, отправки, оплата и метки
 * времени не переносятся: копия — это новая заявка, а не копия её судьбы.
 *
 * @param int $id  что копируем
 * @param int $toCompetition  в какой конкурс (0 — в тот же)
 * @return array{ok:bool, msg:string, id:int}
 */
function app_duplicate(int $id, int $toCompetition = 0): array {
    $src = one("SELECT * FROM applications WHERE id = ?", [$id]);
    if (!$src) return ['ok' => false, 'msg' => 'Заявка не найдена.', 'id' => 0];

    $cid  = $toCompetition ?: (int) $src['competition_id'];
    $comp = one("SELECT * FROM competitions WHERE id = ?", [$cid]);
    if (!$comp) return ['ok' => false, 'msg' => 'Конкурс не найден.', 'id' => 0];

    // Поля-содержание. Всё, чего здесь нет, у копии начинается с нуля.
    $carry = ['user_id','full_name','is_group','group_name','age_category','nomination','subgroup',
              'formation','work_title','teacher','institution','city','email','phone',
              'video_url','video_platform','address','postal_index'];
    $data = [];
    foreach ($carry as $f) if (array_key_exists($f, $src)) $data[$f] = $src[$f];

    $data['competition_id'] = $cid;
    $data['number']         = app_next_number($comp);
    // Бесплатный конкурс — заявка сразу принята; платный ждёт оплаты.
    $data['is_paid']    = (int) ($comp['is_paid'] ?? 0) ? 0 : 1;
    $data['status']     = 'new';
    $data['created_at'] = date('Y-m-d H:i:s');

    try { $newId = (int) insert('applications', $data); }
    catch (\Throwable $e) { return ['ok' => false, 'msg' => 'Не удалось создать копию: ' . $e->getMessage(), 'id' => 0]; }

    if (function_exists('audit')) audit('application_duplicate', 'application', $newId, ['from' => $id, 'competition' => $cid]);
    return ['ok' => true, 'id' => $newId,
            'msg' => 'Создана копия заявки — №' . $data['number'] . ' в конкурсе «' . (string) $comp['name'] . '».'
                   . ((int) $data['is_paid'] === 0 ? ' Копия ждёт оплаты.' : '')];
}
