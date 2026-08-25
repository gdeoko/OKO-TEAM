<?php
/**
 * Оценивание: автоматическая очередь (все неоценённые заявки сразу видны),
 * страница оценки одной заявки (видео + карточка + итог + отклонение),
 * проверка ссылки на видео, группировка заявок участника, итоги длинных
 * бесплатных конкурсов (CSV/HTML). Статус-цепочка автоматическая:
 * подана -> оценена (grade_result) -> исполнена (cron/send_diplomas).
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/jury.php';
require_once BASE_PATH . '/core/app_status.php';
require_once BASE_PATH . '/core/link_check.php';
// Звания, спец-номинации и основания для отклонения — один общий список на всю
// админку: тот же набор нужен карточке заявки, где правится вынесенное решение.
require_once BASE_PATH . '/core/presets.php';
jury_ensure_schema();

/** Прямая ссылка на файл Яндекс.Диска (для HTML5-плеера). null при ошибке. */
function _yadisk_direct(string $url): ?string {
    try {
        $j = _lc_http_json('https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' . rawurlencode($url));
        $href = is_array($j) ? (string)($j['href'] ?? '') : '';
        return $href !== '' ? $href : null;
    } catch (\Throwable $e) { return null; }
}

/**
 * Пытается собрать превью видео для карточки оценки на ВСЕХ разрешённых площадках.
 * Возвращает ['type'=>'iframe'|'video','src'=>...] либо null (покажем кнопку «Открыть»).
 */
function grading_embed(string $url): ?array {
    $url = trim($url);
    // RuTube
    if (preg_match('#rutube\.ru/(?:video|shorts|play/embed)/([a-z0-9]+)#i', $url, $m))
        return ['type'=>'iframe','src'=>'https://rutube.ru/play/embed/' . $m[1]];
    // Google Диск (file/d/… или ?id=…)
    if (preg_match('#drive\.google\.com/file/d/([a-zA-Z0-9_-]{10,})#', $url, $m)
        || preg_match('#[?&]id=([a-zA-Z0-9_-]{10,})#', $url, $m))
        return ['type'=>'iframe','src'=>'https://drive.google.com/file/d/' . $m[1] . '/preview'];
    // VK Видео
    if (preg_match('#(?:vkvideo\.ru|vk\.com)/video(-?\d+_\d+)#', $url, $m)) {
        [$oid, $vid] = explode('_', $m[1]);
        return ['type'=>'iframe','src'=>'https://vk.com/video_ext.php?oid=' . $oid . '&id=' . $vid];
    }
    // ОК Видео
    if (preg_match('#ok\.ru/(?:video|videoembed|live)/(\d+)#i', $url, $m))
        return ['type'=>'iframe','src'=>'https://ok.ru/videoembed/' . $m[1]];
    // Дзен Видео
    if (preg_match('#dzen\.ru/(?:video/watch/|embed/|video/)([a-z0-9]+)#i', $url, $m))
        return ['type'=>'iframe','src'=>'https://dzen.ru/embed/' . $m[1]];
    // Яндекс.Диск — тянем прямую ссылку и играем HTML5-плеером
    if (preg_match('#(?:disk\.yandex|yadi\.sk)#i', $url)) {
        $href = _yadisk_direct($url);
        if ($href) return ['type'=>'video','src'=>$href];
    }
    return null;
}

/* Мягкие миграции: итог, комментарий, проверка ссылки, отклонение, ручной срок отправки. */
foreach (['extra_diploma' => "TEXT DEFAULT ''", 'jury_comment' => "TEXT DEFAULT ''", 'graded_at' => "TEXT",
          'link_check' => "TEXT", 'reject_reason' => "TEXT DEFAULT ''", 'send_at_override' => "TEXT",
          'result_send_at' => "TEXT DEFAULT ''", 'result_sent_at' => "TEXT DEFAULT ''"] as $col => $def) {
    try { q("ALTER TABLE applications ADD COLUMN $col $def"); } catch (\Throwable $e) { /* уже есть */ }
}
try { q("ALTER TABLE diplomas ADD COLUMN scheduled_at TEXT"); } catch (\Throwable $e) { /* уже есть */ }

/** Заготовки итоговых результатов (порядок = порядок кнопок). */
function RESULT_PRESETS(): array {
    return ['ГРАН-ПРИ','ЛАУРЕАТ I СТЕПЕНИ','ЛАУРЕАТ II СТЕПЕНИ','ЛАУРЕАТ III СТЕПЕНИ',
            'ДИПЛОМАНТ I СТЕПЕНИ','ДИПЛОМАНТ II СТЕПЕНИ','ДИПЛОМАНТ III СТЕПЕНИ','УЧАСТНИК КОНКУРСА'];
}
/** Заготовки дополнительных дипломов. */
function EXTRA_PRESETS(): array {
    return ['ЗА АРТИСТИЗМ','ЗА ПАТРИОТИЗМ','ЗА ОРИГИНАЛЬНОЕ ИСПОЛНЕНИЕ','ЗА ВЫРАЗИТЕЛЬНОСТЬ','ЗА ВИРТУОЗНОЕ ИСПОЛНЕНИЕ'];
}

// Основания для отклонения (REJECT_REASONS) переехали в core/presets.php:
// тем же списком пользуется карточка заявки, где правится уже вынесенное отклонение.

/** Нормализация телефона для сравнения (8XXX... == +7XXX...). */
function grading_norm_phone(?string $p): string {
    $d = preg_replace('/\D+/', '', (string)$p);
    if (strlen($d) === 11 && $d[0] === '8') $d = '7' . substr($d, 1);
    return $d;
}

/** Пересчёт итогового балла заявки как среднего оценок жюри. */
function recalc_score(int $appId): void {
    $avg = scalar("SELECT AVG(score) FROM jury_grades WHERE application_id=?", [$appId]);
    if ($avg === null) return;
    $avg = round((float)$avg, 2);
    // graded_at — момент ПЕРВОГО проставления результата (метка для цепочки
    // напоминаний о заказе наград, cron/award_order_reminders.php); не сдвигаем.
    q("UPDATE applications SET score=?, result=?, status='graded',
              graded_at=COALESCE(NULLIF(graded_at,''), ?) WHERE id=?",
      [$avg, score_to_result($avg), date('Y-m-d H:i:s'), $appId]);
}

/**
 * Очередь оценивания: ВСЕ неоценённые заявки автоматически (без ручных переносов
 * статусов), старые -> новые, заявки одного участника (email ИЛИ телефон) — подряд.
 */
function grading_queue_rows(int $comp = 0, string $order = 'old', string $q = ''): array {
    // ГЕЙТ ПО ОПЛАТЕ: в очередь оценивания попадают только принятые заявки —
    // бесплатные (is_paid=1 сразу) и оплаченные платные (is_paid=1 после оплаты).
    // Неоплаченная платная заявка «не существует» и не оценивается.
    // ДЛИННЫЕ КОНКУРСЫ (results_mode='list') сюда НЕ попадают — они оцениваются
    // в отдельном разделе «Длинные конкурсы» (admin/longcomp.php).
    // Признак «ещё не оценена» — ПУСТОЙ result, а не колонка status: после введения
    // единой лестницы статусов 'judging' означает «оценена, результат в пути», и по
    // одному лишь статусу оценённые заявки возвращались бы в очередь на оценку.
    $w = "a.status NOT IN ('rejected') AND (a.result IS NULL OR a.result='') AND a.is_paid=1
          AND (c.results_mode IS NULL OR c.results_mode <> 'list')"; $args = [];
    if ($comp) { $w .= " AND a.competition_id=?"; $args[] = $comp; }
    $q = trim($q);
    if ($q !== '') {
        // Регистронезависимо и по кириллице (search_like → mb_lower в SQLite).
        [$sq, $sa] = search_like(['a.full_name','a.group_name','a.number','a.email','a.phone',
                                  'a.work_title','a.teacher','a.institution','a.city','c.name'], $q);
        if ($sq !== '') { $w .= " AND ($sq)"; $args = array_merge($args, $sa); }
    }
    $rows = all("SELECT a.*, c.name comp FROM applications a
                 LEFT JOIN competitions c ON c.id=a.competition_id
                 WHERE $w ORDER BY a.created_at ASC, a.id ASC LIMIT 500", $args);
    // Ключ участника: email; заявки без email связываем по телефону.
    $phone2email = [];
    foreach ($rows as $r) {
        $e = mb_strtolower(trim((string)$r['email']));
        $p = grading_norm_phone((string)$r['phone']);
        if ($e !== '' && $p !== '' && !isset($phone2email[$p])) $phone2email[$p] = $e;
    }
    $groups = []; $orderKeys = [];
    foreach ($rows as $r) {
        $e = mb_strtolower(trim((string)$r['email']));
        $p = grading_norm_phone((string)$r['phone']);
        $key = $e !== '' ? 'e:' . $e
             : ($p !== '' ? (isset($phone2email[$p]) ? 'e:' . $phone2email[$p] : 'p:' . $p) : 'id:' . $r['id']);
        if (!isset($groups[$key])) { $groups[$key] = []; $orderKeys[] = $key; }
        $groups[$key][] = $r;
    }
    if ($order === 'new') $orderKeys = array_reverse($orderKeys);
    $out = [];
    foreach ($orderKeys as $k) {
        $n = count($groups[$k]);
        foreach ($groups[$k] as $i => $r) { $r['grp_count'] = $n; $r['grp_pos'] = $i; $out[] = $r; }
    }
    return $out;
}

/** id-шники очереди (для навигации по заявкам). */
function grading_queue(int $comp = 0, string $order = 'old'): array {
    return array_map(fn($r) => ['id' => (int)$r['id']], grading_queue_rows($comp, $order));
}

/** Следующая заявка после оценки: сперва другие заявки того же участника, затем первая в очереди. */
function grading_next_id(array $cur, int $comp, string $order): ?int {
    $rows = grading_queue_rows($comp, $order);
    $e = mb_strtolower(trim((string)($cur['email'] ?? '')));
    $p = grading_norm_phone((string)($cur['phone'] ?? ''));
    foreach ($rows as $r) {
        if ((int)$r['id'] === (int)$cur['id']) continue;
        $re = mb_strtolower(trim((string)$r['email']));
        $rp = grading_norm_phone((string)$r['phone']);
        if (($e !== '' && $re === $e) || ($p !== '' && $rp === $p)) return (int)$r['id'];
    }
    foreach ($rows as $r) if ((int)$r['id'] !== (int)$cur['id']) return (int)$r['id'];
    return null;
}

/* ---------------- Проверка ссылки на конкурсное видео (с кэшем) ---------------- */

/**
 * Проверка ссылки: платформа / доступность (существует и открыто) / дата не старше года.
 * Работает через единый video_verify() (core/link_check.php) — тот же движок, что и при
 * подаче заявки, поэтому «Ссылка НЕ отвечает» больше не показывается ложно для площадок,
 * которые не отвечают на HEAD. Кэш — applications.link_check (JSON).
 * reachable: true — открыто; false — реально не найдено/закрыто; null — вопрос неприменим.
 */
function grading_link_check(array $a, bool $force = false): array {
    $empty = ['platform' => null, 'platform_label' => '', 'reachable' => null,
              'fresh' => null, 'published' => '', 'checked_at' => '', 'reason' => ''];
    $url = trim((string)($a['video_url'] ?? ''));
    if ($url === '') return $empty;
    if (!$force && !empty($a['link_check'])) {
        $c = json_decode((string)$a['link_check'], true);
        if (is_array($c) && !empty($c['checked_at'])) return $c + $empty;
    }
    if (!function_exists('video_verify')) require_once BASE_PATH . '/core/link_check.php';
    $v = video_verify($url);

    $res = $empty;
    $res['checked_at']     = date('Y-m-d H:i:s');
    $res['reason']         = (string)($v['reason'] ?? '');
    $label                 = (string)($v['platform'] ?? '');
    $res['platform_label'] = $label;
    $res['platform']       = ($label !== '');   // площадка распознана среди разрешённых

    $ts = $v['ts'] ?? null;
    if ($ts) $res['published'] = date('d.m.Y', (int)$ts);

    $stale = $v['stale'] ?? null;
    if ($stale === true)       $res['fresh'] = false;
    elseif ($stale === false)  $res['fresh'] = true;
    else                       $res['fresh'] = null; // дату определить не удалось — вручную

    if (!empty($v['ok']))          $res['reachable'] = true;   // открыто и доступно
    elseif ($stale === true)       $res['reachable'] = true;   // ссылка рабочая, просто старше года
    elseif ($label === '')         $res['reachable'] = null;   // не наша площадка — доступность неприменима
    else                           $res['reachable'] = false;  // реально не найдено/закрыто/приватно

    try { q("UPDATE applications SET link_check=? WHERE id=?", [json_encode($res, JSON_UNESCAPED_UNICODE), (int)$a['id']]); } catch (\Throwable $e) {}
    return $res;
}

$comp  = (int) input('competition');
$order = input('order') === 'new' ? 'new' : 'old';

/* ---------- Итоги конкурса: выгрузка CSV / печатный HTML (до любого вывода) ---------- */
if (in_array(input('action'), ['results_csv', 'results_html'], true)) {
    $cid = (int) input('competition');
    $c = $cid ? one("SELECT * FROM competitions WHERE id=?", [$cid]) : null;
    if (!$c) { flash('Выберите конкурс.', 'error'); admin_redirect('grading'); }
    $rows = all("SELECT * FROM applications WHERE competition_id=? AND status<>'rejected'
                 ORDER BY created_at ASC, id ASC", [$cid]);
    audit('grading_results_export', 'competition', $cid, ['fmt' => input('action'), 'count' => count($rows)]);
    $head = ['ФИО','Коллектив','Возрастная категория','Номинация','Преподаватель','Учреждение','Конкурсный номер','РЕЗУЛЬТАТ','Доп. диплом'];
    $line = fn(array $r) => [
        (string)$r['full_name'], (string)$r['group_name'], (string)$r['age_category'],
        (string)$r['nomination'], (string)$r['teacher'], (string)$r['institution'],
        (string)$r['work_title'], (string)($r['result'] ?: '— не оценено —'), (string)($r['extra_diploma'] ?? ''),
    ];
    if (input('action') === 'results_csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="results-' . $cid . '-' . date('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w');
        fprintf($out, "\xEF\xBB\xBF");
        fputcsv($out, $head, ';');
        foreach ($rows as $r) fputcsv($out, $line($r), ';');
        fclose($out);
        exit;
    }
    // Красивый печатный HTML.
    header('Content-Type: text/html; charset=utf-8');
    $title = h((string)$c['name']);
    echo '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Итоги — ' . $title . '</title><style>
    body{font-family:Georgia,"Times New Roman",serif;color:#1B2340;margin:32px;background:#fff}
    h1{font-size:24px;color:#17307A;margin:0 0 4px}
    .sub{color:#6B7699;font-size:14px;margin-bottom:20px}
    table{border-collapse:collapse;width:100%;font-size:13px}
    th{background:#17307A;color:#E3B94F;padding:8px 10px;text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
    td{border-bottom:1px solid #DCE3F3;padding:7px 10px;vertical-align:top}
    tr:nth-child(even) td{background:#F4F6FC}
    .res{font-weight:700;color:#8B6F1F;white-space:nowrap}
    .noresult{color:#b33;font-style:italic}
    @media print{.noprint{display:none}}
    .noprint{margin:18px 0}
    .noprint button{padding:10px 22px;font-size:14px;cursor:pointer}
    </style></head><body>';
    echo '<h1>Итоги конкурса «' . $title . '»</h1><div class="sub">Культурный центр «Музыкальный Мир» · сформировано ' . date('d.m.Y H:i') . ' · участников: ' . count($rows) . '</div>';
    echo '<div class="noprint"><button onclick="window.print()">Печать</button></div>';
    echo '<table><thead><tr>';
    foreach ($head as $hcol) echo '<th>' . h($hcol) . '</th>';
    echo '</tr></thead><tbody>';
    foreach ($rows as $r) {
        $vals = $line($r);
        echo '<tr>';
        foreach ($vals as $i => $v) {
            $cls = $i === 7 ? ($r['result'] ? ' class="res"' : ' class="noresult"') : '';
            echo '<td' . $cls . '>' . h($v) . '</td>';
        }
        echo '</tr>';
    }
    echo '</tbody></table></body></html>';
    exit;
}

/* ---------- Приватная заметка жюри (без баллов — балльная система убрана) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'grade') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('grading'); }
    $appId = (int) input('id');
    $note  = trim(input('note'));
    $jid   = (int) (current_user()['id'] ?? 0);
    if ($appId) {
        // Балльная шкала отключена — сохраняем только приватную заметку жюри.
        $ex = one("SELECT id FROM jury_grades WHERE application_id=? AND jury_id=?", [$appId, $jid]);
        if ($ex) {
            update('jury_grades', ['note'=>$note], 'id=:wid', ['wid'=>$ex['id']]);
        } else {
            insert('jury_grades', ['application_id'=>$appId,'jury_id'=>$jid,'note'=>$note]);
        }
        audit('grade_note', 'application', $appId);
        flash('Заметка сохранена.', 'success');
    }
    admin_redirect('grading', array_filter(['id'=>$appId,'competition'=>$comp,'order'=>$order]));
}

/* ---------- Итоговый результат (заготовки: Гран-при/Лауреат/Дипломант/Участник) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'grade_result') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('grading'); }
    $appId  = (int) input('id');
    $result = trim(input('result'));
    $extra  = trim(input('extra_diploma'));
    if ($extra === '__custom__') $extra = trim(input('extra_custom'));
    $jcomment = trim(input('jury_comment'));

    /* ФОНОГРАММА СНИЖАЕТ ЗВАНИЕ ДО ДИПЛОМАНТА — П. 8.7 ПОЛОЖЕНИЯ.
     *
     * Правило одинаково во всех конкурсах и записано в документе, который читает
     * участник, поэтому оно исполняется здесь, а не остаётся на память жюри:
     * отмеченная фонограмма опускает лауреатское звание до дипломанта первой
     * степени. Дипломантские звания и «участник» не трогаем — они и так ниже. */
    // Снижение выполняет grade_apply_result: там же, где оно выполняется для
    // автоматической аттестации, и там же дописывается причина в комментарий
    // участнику — иначе звание опускалось молча и человек не понимал, за что.
    $phonogram = input('phonogram') === '1';

    if ($appId && in_array($result, RESULT_PRESETS(), true)) {
        $cur = one("SELECT * FROM applications WHERE id=?", [$appId]);
        if (!$cur) { flash('Заявка не найдена.', 'error'); admin_redirect('grading'); }
        $curMode = one("SELECT results_mode, is_paid FROM competitions WHERE id=?", [(int) $cur['competition_id']]);
        $isLongComp = (string) ($curMode['results_mode'] ?? '') === 'list';
        $compPaid   = (int) ($curMode['is_paid'] ?? 0) === 1;
        if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
        $wdays = (!empty($cur['user_id']) && function_exists('club_is_active') && club_is_active((int) $cur['user_id'])) ? 3 : 5;

        /* СОХРАНЕНИЕ ИТОГА ЖИВЁТ В ОДНОМ МЕСТЕ — core/grade_apply.php.
         *
         * Тот же порядок выполняет автоматическая аттестация, и это единственный
         * способ добиться, чтобы «полный автомат» работал ровно так же, как рука
         * жюри: те же сроки, то же письмо, та же переделка наградных документов,
         * тот же статус в кабинете. Пока код был написан дважды, автомат забывал
         * половину шагов, и работы копились без единого письма участнику. */
        require_once BASE_PATH . '/core/grade_apply.php';
        $sendMode = input('send_now') === '1' ? 'now' : (input('auto_send') === '1' ? 'auto' : 'at');
        $ap = grade_apply_result($appId, $result, [
            'extra_diploma' => $extra,
            'jury_comment'  => $jcomment,
            'send_mode'     => $sendMode,
            'send_at'       => trim(input('send_at')),
            'source'        => 'jury',
            'phonogram'     => $phonogram,
        ]);
        if (!$ap['ok']) {
            flash('Не удалось сохранить итог: ' . $ap['msg'], 'error');
            admin_redirect('grading', array_filter(['id' => $appId, 'competition' => $comp, 'order' => $order]));
        }
        $result       = $ap['result'];           // могло снизиться из-за фонограммы
        $resultSendAt = $ap['send_at'];
        $dsyncMsg     = $ap['dsync'];

        // Журнал ведёт сама grade_apply_result — второй записи не нужно.
        $flashWhen = $isLongComp ? 'публикуется пакетом'
            : ($ap['sent'] ? 'результат отправлен сейчас'
                           : ('результат ' . ($resultSendAt !== '' ? date('d.m.Y H:i', strtotime($resultSendAt)) : 'по расписанию')));
        // Обещаем наградные дипломы только там, где центр действительно выдаёт их
        // сам: у длинного и бесплатного конкурса их заказывает участник.
        $dipWhen = (!$isLongComp && $compPaid)
            ? ' Наградные дипломы — через ' . $wdays . ' раб. дней от подачи.'
            : ' Наградные материалы участник заказывает сам после оглашения итогов — центр их не рассылает.';
        // Именной диплом теперь переделывается вместе с остальными, вручную
        // перевыпускать его не надо: об этом говорит сообщение синхронизации.
        $warnNamed = '';
        flash('Итог сохранён: ' . $result . ($extra !== '' ? ' · доп: ' . $extra : '')
            . ' · ' . $flashWhen . '.' . $dipWhen . ($dsyncMsg !== '' ? ' ' . $dsyncMsg : ''), 'success');
        // Правку итога можно начать из карточки заявки — тогда и возвращаемся туда,
        // а не в очередь оценки: администратор пришёл поправить одну заявку, а не
        // судить следующую.
        if ((string) input('back') === 'applications') {
            admin_redirect('applications', ['id' => $appId]);
        }
        // Правку могли начать из архива оценённых — короткого или длинного.
        // Возвращаемся туда же: администратор пришёл поправить одно решение,
        // а не судить следующую заявку.
        if ((string) input('back') === 'archive') {
            admin_redirect($isLongComp ? 'longcomp' : 'grading',
                array_filter(['competition' => (int) $cur['competition_id']]));
        }
        // Длинный конкурс — возвращаемся в его раздел (список аттестации/оценённых).
        if (!empty($isLongComp)) {
            admin_redirect('longcomp', ['competition' => (int) $cur['competition_id']]);
        }
        $next = grading_next_id($cur, $comp, $order);
        if ($next) admin_redirect('grading', array_filter(['id'=>$next,'competition'=>$comp,'order'=>$order]));
        admin_redirect('grading', array_filter(['competition'=>$comp,'order'=>$order]));
    }
    flash('Выберите итоговый результат из списка.', 'error');
    if ((string) input('back') === 'applications') admin_redirect('applications', ['id' => $appId]);
    admin_redirect('grading', array_filter(['id'=>$appId,'competition'=>$comp,'order'=>$order]));
}

/* ---------- ПРАВКА УЖЕ ВЫНЕСЕННОГО ОТКЛОНЕНИЯ ---------------------------------
 * Отклонение — такое же решение, как звание, и ошибиться в нём так же легко:
 * не тот пункт положения, опечатка, слишком резкая формулировка. Раньше
 * поправить его было нечем: единственная кнопка запускала отклонение заново, а
 * значит второе письмо участнику и вторую попытку возврата денег. Люди получали
 * два отказа подряд по одной заявке.
 *
 * Здесь причина правится отдельно от самого отклонения. Письмо уходит, только
 * если администратор попросил: участнику, который уже получил отказ, полезно
 * узнать про уточнённую формулировку, но навязывать это письмо нельзя.
 */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'reject_edit') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('grading'); }
    $appId  = (int) input('id');
    $reason = trim(input('reject_reason'));
    $notify = input('notify') === '1';
    $backTo = (string) input('back');

    $a = $appId ? one("SELECT a.*, c.name comp, c.slug comp_slug FROM applications a
                        LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$appId]) : null;
    $goBack = static function () use ($backTo, $appId, $a, $comp, $order): void {
        if ($backTo === 'applications') admin_redirect('applications', ['id' => $appId]);
        if ($backTo === 'archive') {
            $long = $a && (string) (scalar("SELECT results_mode FROM competitions WHERE id=?",
                                           [(int) $a['competition_id']]) ?? '') === 'list';
            admin_redirect($long ? 'longcomp' : 'grading',
                array_filter(['competition' => (int) ($a['competition_id'] ?? 0)]));
        }
        admin_redirect('grading', array_filter(['id' => $appId, 'competition' => $comp, 'order' => $order]));
    };

    if (!$a) { flash('Заявка не найдена.', 'error'); admin_redirect('grading'); }
    if ((string) $a['status'] !== 'rejected') {
        flash('Эта заявка не отклонена — правьте её решение в разделе итога.', 'error');
        $goBack();
    }
    if ($reason === '') { flash('Причина отклонения не может быть пустой.', 'error'); $goBack(); }

    $was = trim((string) ($a['reject_reason'] ?? ''));
    if ($was === $reason && !$notify) { flash('Причина не изменилась.', 'info'); $goBack(); }

    update('applications', ['reject_reason' => $reason], 'id=:wid', ['wid' => $appId]);
    audit('application_reject_edit', 'application', $appId, ['было' => $was, 'стало' => $reason]);

    // Возврат оргвзноса здесь не трогаем: он уже выполнен при самом отклонении,
    // а повторный вызов — это вторая попытка вернуть одни и те же деньги.
    $mailed = false;
    if ($notify && trim((string) $a['email']) !== '' && is_file(BASE_PATH . '/core/result_mail.php')) {
        require_once BASE_PATH . '/core/result_mail.php';
        try {
            $name  = trim((string) $a['full_name']);
            $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
            $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:24px;line-height:1.3;font-weight:700;color:' . RM_NAVY . ';">Заявка №' . h((string) $a['number']) . ': уточнение причины</h1>'
                . '<p style="margin:0 0 14px;">' . $hello . '</p>'
                . '<p style="margin:0 0 18px;">Оргкомитет уточнил основание, по которому Ваша заявка на конкурс «' . h((string) $a['comp']) . '» не была принята к участию. Верной считается формулировка ниже.</p>'
                . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#FDF1F1;border:1px solid #EBC7C7;border-radius:14px;">'
                . '<tr><td style="padding:16px 22px;"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#A0403E;margin-bottom:6px;">Причина отклонения (пункт положения 1:1)</div>'
                . '<div style="font-size:14px;line-height:1.7;color:' . RM_INK . ';">' . nl2br(h($reason)) . '</div></td></tr></table>'
                . '<p style="margin:0 0 14px;">Это не отказ навсегда: устраните причину и <b style="color:' . RM_NAVY . ';">подайте заявку заново</b> — мы с радостью примем её к аттестации.</p>'
                . rm_mail_btn(url('/apply?competition=' . rawurlencode((string) ($a['comp_slug'] ?? ''))), 'Подать заявку заново');
            $html = rm_mail_layout($inner, 'Заявка №' . (string) $a['number'] . ': уточнили причину отклонения.');
            $mailed = mail_queue((string) $a['email'], $name,
                'Заявка №' . (string) $a['number'] . ' — уточнение причины отклонения', $html) > 0;
        } catch (\Throwable $e) { /* письмо не должно ломать правку */ }
    }

    flash('Причина отклонения обновлена.' . ($notify ? ($mailed ? ' Участнику отправлено уточнение.' : ' Уведомление отправить не удалось.') : ' Участнику ничего не отправляли.'),
        $notify && !$mailed ? 'error' : 'success');
    $goBack();
}

/* ---------- Отклонение заявки по пункту положения + письмо участнику ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'reject') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('grading'); }
    $appId  = (int) input('id');
    $reason = trim(input('reject_reason'));
    $a = $appId ? one("SELECT a.*, c.name comp FROM applications a
                       LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$appId]) : null;
    if (!$a) { flash('Заявка не найдена.', 'error'); admin_redirect('grading'); }
    if ($reason === '') {
        flash('Укажите причину отклонения (пункт положения).', 'error');
        admin_redirect('grading', array_filter(['id'=>$appId,'competition'=>$comp,'order'=>$order]));
    }
    /* ОТКЛОНЕНИЕ ЖИВЁТ В ОДНОМ МЕСТЕ — core/grade_apply.php.
     *
     * За отклонением тянется цепочка: снять наградные документы, вернуть
     * учреждению партнёрскую скидку, вернуть оргвзнос, написать участнику, что
     * нарушено и как подать заново. Тот же порядок выполняет автоматическая
     * аттестация, когда снимает работу за нарушение положения, и разойтись они
     * не должны: участнику всё равно, кто принял решение. */
    require_once BASE_PATH . '/core/grade_apply.php';
    $rj = grade_reject_application($appId, $reason, 'jury');
    if (!$rj['ok']) {
        flash('Не удалось отклонить заявку: ' . $rj['msg'], 'error');
        admin_redirect('grading', array_filter(['id'=>$appId,'competition'=>$comp,'order'=>$order]));
    }
    flash($rj['msg'], $rj['refund_error'] === '' ? 'success' : 'error');

    $next = grading_next_id($a, $comp, $order);
    if ($next) admin_redirect('grading', array_filter(['id'=>$next,'competition'=>$comp,'order'=>$order]));
    admin_redirect('grading', array_filter(['competition'=>$comp,'order'=>$order]));
}

/* ---------- Действия нижнего списка «Оценённые» (перенос, снятие отклонения, копия) ---------- */
require_once BASE_PATH . '/core/graded_list.php';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    admin_graded_actions('grading', array_filter(['competition' => $comp, 'order' => $order, 'q' => trim(input('q'))]));
}

/* ---------- Редактирование полей заявки ПРЯМО В ОЦЕНКЕ (короткие/длинные) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'edit_app') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('grading'); }
    $appId = (int) input('id');
    $cur = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$cur) { flash('Заявка не найдена.', 'error'); admin_redirect('grading'); }
    $back = array_filter(['id'=>$appId, 'competition'=>$comp, 'order'=>$order]);

    // Обновляем ТОЛЬКО реально присланные поля (защита от затирания при частичной
    // отправке), а приводим их к единому виду там же, где кабинет и админка —
    // core/app_fields.php. Иначе поправленное жюри название номера отличалось бы
    // от того же названия, поправленного участником.
    require_once BASE_PATH . '/core/app_fields.php';
    $fields = ['full_name','group_name','teacher','nomination','subgroup','work_title',
               'institution','city','age_category','formation','email','phone','video_url'];
    $in = [];
    foreach ($fields as $fld) if (array_key_exists($fld, $_POST)) $in[$fld] = (string) $_POST[$fld];
    if (!$in) { flash('Изменений нет.', 'info'); admin_redirect('grading', $back); }
    $res = app_fields_normalize($in, (array) $cur);
    if ($res['errors']) {
        flash(implode(' ', $res['errors']) . ' Заявка не сохранена.', 'error');
        admin_redirect('grading', $back);
    }
    $data = $res['data'];
    if (!$data) { flash('Изменений нет.', 'info'); admin_redirect('grading', $back); }

    // Смена видео-ссылки — сбрасываем кэш проверки, чтобы перепроверилась.
    if (isset($data['video_url']) && (string)($cur['video_url'] ?? '') !== $data['video_url']) $data['link_check'] = '';
    update('applications', $data, 'id=:wid', ['wid' => $appId]);
    $changed = [];
    foreach ($data as $k => $v) if ((string)($cur[$k] ?? '') !== (string)$v) $changed[$k] = $v;
    audit('application_edit', 'application', $appId, ['from' => 'grading', 'changed' => array_keys($changed)]);
    // Правка ФИО, номера, номинации или педагога меняет то, что напечатано в
    // бланке: диплом переделывается под новые данные.
    require_once BASE_PATH . '/core/diploma_sync.php';
    $dmsg = dsync_apply($appId, (array) $cur, $data);
    flash(($changed ? 'Данные заявки обновлены (' . count($changed) . ' пол.).' : 'Изменений нет.')
          . ($dmsg !== '' ? ' ' . $dmsg : ''), $changed ? 'success' : 'info');
    admin_redirect('grading', $back);
}

/* ================= РЕЖИМ ОЦЕНКИ ОДНОЙ ЗАЯВКИ ================= */
if ($id = (int) input('id')) {
    $a = one("SELECT a.*, c.name comp, c.is_paid comp_paid, c.results_mode FROM applications a
              LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$id]);
    if (!$a) { flash('Заявка не найдена.', 'error'); admin_redirect('grading'); }
    // Длинный конкурс оценивается той же карточкой; результат не уходит моментально (копится в список).
    $isLongView = (string) ($a['results_mode'] ?? '') === 'list';
    $jid = (int) (current_user()['id'] ?? 0);
    $my = one("SELECT * FROM jury_grades WHERE application_id=? AND jury_id=?", [$id, $jid]);
    $embed = $a['video_url'] ? grading_embed($a['video_url']) : null;

    // Проверка ссылки (3 пункта, кэш в link_check; ?recheck=1 — принудительно).
    $lc = grading_link_check($a, input('recheck') === '1');

    // Другие заявки этого участника (email ИЛИ телефон, телефон — с нормализацией 8/+7).
    $email = trim((string)$a['email']);
    $pn = grading_norm_phone((string)$a['phone']);
    $sel = "SELECT a.id, a.number, a.work_title, a.status, a.result, a.created_at, a.phone, c.name comp
            FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id";
    $othersMap = [];
    if ($email !== '') {
        foreach (all("$sel WHERE a.id<>? AND a.email=? COLLATE NOCASE LIMIT 50", [$id, $email]) as $o) $othersMap[(int)$o['id']] = $o;
    }
    if ($pn !== '') {
        foreach (all("$sel WHERE a.id<>? AND a.phone<>'' LIMIT 2000", [$id]) as $o) {
            if (grading_norm_phone((string)$o['phone']) === $pn) $othersMap[(int)$o['id']] = $o;
        }
    }
    $others = array_values($othersMap);
    usort($others, fn($x, $y) => strcmp((string)$x['created_at'], (string)$y['created_at']));

    $queue = grading_queue($comp, $order);
    $pos = 0; $total = count($queue); $nextId = null; $prevId = null;
    foreach ($queue as $i => $row) {
        if ((int)$row['id'] === $id) {
            $pos = $i + 1;
            $nextId = isset($queue[$i+1]) ? (int)$queue[$i+1]['id'] : null;
            $prevId = isset($queue[$i-1]) ? (int)$queue[$i-1]['id'] : null;
        }
    }
    if (!$pos && $total) $nextId = (int)$queue[0]['id']; // заявка уже вне очереди (редактирование)

    // Легенда «балл → звание» (внутренняя шкала).
    $legend = []; for ($n = 1; $n <= 10; $n++) $legend[$n] = score_to_result((float)$n);
    $legendGroups = []; $prevTitle = null;
    for ($n = 1; $n <= 10; $n++) {
        $t = $legend[$n];
        if ($t !== $prevTitle) { $legendGroups[] = ['from'=>$n,'to'=>$n,'title'=>$t]; $prevTitle = $t; }
        else { $legendGroups[count($legendGroups)-1]['to'] = $n; }
    }

    $nextUrl = $nextId ? a_link('grading', array_filter(['id'=>$nextId,'competition'=>$comp,'order'=>$order])) : '';
    $prevUrl = $prevId ? a_link('grading', array_filter(['id'=>$prevId,'competition'=>$comp,'order'=>$order])) : '';

    /** Чип проверки: [текст, класс бейджа]. */
    $lcChip = function (?bool $ok, string $okTxt, string $badTxt, string $unkTxt): array {
        if ($ok === true)  return [$okTxt,  'badge--paid'];
        if ($ok === false) return [$badTxt, 'badge--rejected'];
        return [$unkTxt, 'badge--muted'];
    };
    $chipPlatform = $lcChip($lc['platform'],
        'Платформа: ' . ($lc['platform_label'] ?: 'разрешена'),
        'Платформа недопустима' . ($lc['platform_label'] ? ': ' . $lc['platform_label'] : ''),
        'Платформа: не определена');
    $chipReach = $lcChip($lc['reachable'], 'Ссылка отвечает', 'Ссылка НЕ отвечает', 'Доступность: не проверено');
    $chipFresh = $lcChip($lc['fresh'],
        'Запись свежая' . ($lc['published'] ? ' (' . $lc['published'] . ')' : ''),
        'СТАРШЕ 1 ГОДА' . ($lc['published'] ? ' (' . $lc['published'] . ')' : ''),
        'Дата публикации: проверьте вручную');

    ob_start(); ?>
    <style>
    .jury-fast .jf-topbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}
    .jury-fast .jf-topbar .sp{flex:1}
    .jury-fast .pill-scale button{width:56px;height:56px;font-size:1.35rem;font-weight:800}
    .jury-fast .jf-verdict{margin-top:14px;min-height:30px;font-family:var(--ff-display,Georgia,serif);font-size:1.15rem;font-weight:800;
      color:var(--a-gold,#8B6F1F);opacity:0;transform:translateY(4px);transition:.18s}
    .jury-fast .jf-verdict.show{opacity:1;transform:none}
    .jury-fast .jf-legend{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
    .jury-fast .jf-legend .lg{display:inline-flex;align-items:center;gap:6px;font-size:.76rem;padding:4px 9px;border-radius:999px;
      background:#faf6ea;border:1px solid var(--a-line);color:var(--a-ink)}
    .jury-fast .jf-legend .lg i{font-style:normal;font-weight:800;color:var(--a-gold,#8B6F1F);min-width:30px;text-align:center}
    .jury-fast kbd{font-family:ui-monospace,Menlo,monospace;font-size:.72rem;line-height:1;padding:4px 7px;border-radius:6px;
      background:#fff;border:1px solid var(--a-line);box-shadow:0 1px 0 var(--a-line);color:var(--a-ink);min-width:16px;text-align:center}
    .jury-fast .jf-overlay{position:fixed;inset:0;background:rgba(12,10,13,.55);display:none;align-items:center;justify-content:center;z-index:120}
    .jury-fast .jf-overlay.show{display:flex}
    .jury-fast .jf-overlay .box{background:#fff;border-radius:18px;padding:26px 34px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35);min-width:220px}
    .jury-fast .jf-overlay .num{font-family:var(--ff-display,Georgia,serif);font-size:3.4rem;font-weight:900;line-height:1;color:var(--a-gold,#8B6F1F)}
    .jury-fast .jf-overlay .ttl{margin-top:6px;font-weight:800;color:var(--a-ink)}
    .jury-fast .lc-badges{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 2px}
    .jury-fast .lc-badges .badge{font-size:.74rem}
    .jury-fast .reject-panel{display:none;margin-top:14px;padding:14px;border:1.5px solid #d99;border-radius:12px;background:#fdf3f3}
    .jury-fast .reject-panel.show{display:block}
    .jury-fast .rr-chips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}
    .jury-fast .rr-chips button{font-size:.74rem;padding:5px 10px;border-radius:999px;border:1px solid #d9b5b5;background:#fff;cursor:pointer;color:#8b2f2f;text-align:left}
    .jury-fast .rr-chips button:hover{background:#f7e0e0}
    @media (max-width:640px){ .jury-fast .pill-scale button{width:48px;height:48px;font-size:1.2rem} }
    @media (prefers-reduced-motion:reduce){ .jury-fast .jf-verdict{transition:none} }
    </style>
    <div class="jury-fast">
    <div class="jf-topbar">
      <?php if (!empty($isLongView)): ?>
        <a class="btn btn--ghost btn--sm" href="<?= a_link('longcomp', ['competition'=>(int)$a['competition_id']]) ?>"><?= admin_icon('back') ?>К списку длинного конкурса</a>
        <span class="small muted">Длинный конкурс — результат сохранится в список (без моментальной отправки).</span>
      <?php else: ?>
        <a class="btn btn--ghost btn--sm" href="<?= a_link('grading', array_filter(['competition'=>$comp,'order'=>$order])) ?>"><?= admin_icon('back') ?>К очереди</a>
        <span class="small muted"><?= $pos ? 'Заявка ' . $pos . ' из ' . $total . ' в очереди' : 'Заявка вне очереди (редактирование итога)' ?></span>
        <span class="sp"></span>
        <?php if ($prevId): ?><a class="btn btn--ghost btn--sm" href="<?= $prevUrl ?>">← Назад</a><?php endif; ?>
        <?php if ($nextId): ?><a class="btn btn--navy btn--sm" href="<?= $nextUrl ?>">Пропустить →</a><?php endif; ?>
      <?php endif; ?>
    </div>

    <div class="grid grid-2">
      <div class="card card--pad0" style="padding:14px">
        <?php if ($embed && ($embed['type'] ?? '') === 'video'): ?>
          <div class="video-frame"><video src="<?= h($embed['src']) ?>" controls preload="metadata" style="width:100%;height:100%;background:#000"></video></div>
        <?php elseif ($embed): ?>
          <div class="video-frame"><iframe src="<?= h($embed['src']) ?>" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>
        <?php elseif ($a['video_url']): ?>
          <div class="empty"><?= admin_icon('eye') ?><p>Это видео нельзя встроить напрямую.</p>
            <a class="btn btn--navy" href="<?= h($a['video_url']) ?>" target="_blank" rel="noopener">Открыть видео в новой вкладке</a></div>
        <?php else: ?>
          <div class="empty"><p class="muted">Ссылка на видео отсутствует.</p></div>
        <?php endif; ?>
        <div class="lc-badges">
          <span class="badge <?= $chipPlatform[1] ?>"><?= h($chipPlatform[0]) ?></span>
          <span class="badge <?= $chipReach[1] ?>"><?= h($chipReach[0]) ?></span>
          <span class="badge <?= $chipFresh[1] ?>"><?= h($chipFresh[0]) ?></span>
          <a class="badge badge--muted" style="text-decoration:none"
             href="<?= a_link('grading', array_filter(['id'=>$id,'competition'=>$comp,'order'=>$order,'recheck'=>1])) ?>">перепроверить</a>
        </div>
        <?php if ($a['video_url']): ?>
          <p class="small" style="margin:6px 0 4px"><a href="<?= h($a['video_url']) ?>" target="_blank" rel="noopener"><?= h($a['video_url']) ?></a></p>
        <?php endif; ?>
      </div>

      <div class="card">
        <div class="section-title"><h3><?= h($a['number'] ?: '#'.$a['id']) ?></h3>
          <span class="badge badge--<?= h($a['status']) ?>"><?= h(app_status_ru($a['status'])) ?></span></div>
        <dl class="kv">
          <dt>Конкурс</dt><dd><?= h($a['comp']) ?></dd>
          <dt><?= $a['is_group'] ? 'Коллектив' : 'Участник' ?></dt><dd><b><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></b><?= vip_mark((int)($a['user_id'] ?? 0), '', (string)($a['email'] ?? '')) ?></dd>
          <?php if ($a['is_group']): ?><dt>Контактное лицо</dt><dd><?= h($a['full_name']) ?></dd><?php endif; ?>
          <dt>Конкурсный номер</dt><dd><b><?= h($a['work_title']) ?></b></dd>
          <dt>Номинация</dt><dd><?= h($a['nomination']) ?><?= $a['subgroup'] ? ' · '.h($a['subgroup']) : '' ?></dd>
          <dt>Форма</dt><dd><?= h($a['formation'] ?: '—') ?></dd>
          <dt>Категория</dt><dd><?= h($a['age_category'] ?: '—') ?></dd>
          <dt>Педагог</dt><dd><?= h($a['teacher'] ?: '—') ?></dd>
          <dt>Учреждение</dt><dd><?= h($a['institution'] ?: '—') ?></dd>
          <dt>Город</dt><dd><?= h($a['city'] ?: '—') ?></dd>
          <dt>Email</dt><dd><a href="mailto:<?= h($a['email']) ?>"><?= h($a['email']) ?></a></dd>
          <dt>Телефон</dt><dd><?= h($a['phone'] ?: '—') ?></dd>
          <dt>Оплата</dt><dd><?= $a['is_paid'] ? '<span class="badge badge--paid">Оплачено</span>' : '<span class="badge badge--muted">Не оплачено</span>' ?></dd>
          <dt>Подана</dt><dd><?= h(date('d.m.Y H:i', strtotime((string)$a['created_at']))) ?></dd>
          <?php if ($a['result']): ?><dt>Текущий итог</dt><dd><span class="badge badge--gold"><?= h($a['result']) ?></span><?= $a['score']!==null ? ' · '.h((string)$a['score']) : '' ?></dd><?php endif; ?>
          <?php if (!empty($a['reject_reason'])): ?><dt>Причина отклонения</dt><dd class="small"><?= h($a['reject_reason']) ?></dd><?php endif; ?>
        </dl>

        <button type="button" class="btn btn--ghost btn--sm" onclick="var f=document.getElementById('appEdit');f.style.display=f.style.display==='none'?'block':'none';" style="margin-bottom:4px"><?= admin_icon('edit') ?>Редактировать заявку</button>
        <form id="appEdit" method="post" action="<?= url('/admin/?p=grading') ?>" style="display:none;margin-top:8px;padding:14px;border:1.5px solid var(--a-line);border-radius:12px;background:var(--a-soft,#f7f8fc)">
          <?= csrf_field() ?><input type="hidden" name="do" value="edit_app">
          <input type="hidden" name="id" value="<?= $id ?>"><input type="hidden" name="competition" value="<?= $comp ?>"><input type="hidden" name="order" value="<?= h($order) ?>">
          <div class="ae-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <label style="grid-column:1/-1">ФИО (участник / контактное лицо)<input type="text" name="full_name" value="<?= h((string)$a['full_name']) ?>"></label>
            <label style="grid-column:1/-1">Название коллектива<input type="text" name="group_name" value="<?= h((string)($a['group_name'] ?? '')) ?>" placeholder="Если коллектив"></label>
            <label style="grid-column:1/-1">Конкурсный номер<input type="text" name="work_title" value="<?= h((string)$a['work_title']) ?>"></label>
            <label>Номинация<select name="nomination"><option value="">—</option>
              <?php foreach (array_keys(NOMINATIONS()) as $n): ?><option value="<?= h($n) ?>" <?= (string)$a['nomination']===$n?'selected':'' ?>><?= h($n) ?></option><?php endforeach; ?>
            </select></label>
            <label>Возрастная категория<select name="age_category"><option value="">—</option>
              <?php foreach (AGE_CATEGORIES() as $cat): ?><option value="<?= h($cat) ?>" <?= (string)$a['age_category']===$cat?'selected':'' ?>><?= h($cat) ?></option><?php endforeach; ?>
            </select></label>
            <label>Педагог<input type="text" name="teacher" value="<?= h((string)($a['teacher'] ?? '')) ?>"></label>
            <label>Учреждение<input type="text" name="institution" value="<?= h((string)($a['institution'] ?? '')) ?>"></label>
            <label>Город<input type="text" name="city" value="<?= h((string)($a['city'] ?? '')) ?>"></label>
            <label>Email<input type="email" name="email" value="<?= h((string)$a['email']) ?>"></label>
            <label>Телефон<input type="text" name="phone" value="<?= h((string)($a['phone'] ?? '')) ?>"></label>
            <label style="grid-column:1/-1">Ссылка на видео<input type="text" name="video_url" value="<?= h((string)($a['video_url'] ?? '')) ?>"></label>
          </div>
          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn--navy btn--sm" type="submit"><?= admin_icon('check') ?>Сохранить заявку</button>
            <button class="btn btn--ghost btn--sm" type="button" onclick="document.getElementById('appEdit').style.display='none'">Отмена</button>
          </div>
        </form>
        <style>#appEdit label{display:flex;flex-direction:column;gap:4px;font-size:.8rem;color:var(--a-muted,#6b7699)}
        #appEdit input,#appEdit select{padding:8px 10px;border:1px solid var(--a-line);border-radius:8px;font-size:.9rem}
        @media(max-width:640px){#appEdit .ae-grid{grid-template-columns:1fr}}</style>

        <?php if ($others): ?>
          <hr>
          <h4>Другие заявки этого участника <span class="badge badge--gold">участник <?= count($others)+1 ?> заявок</span></h4>
          <div class="table-wrap"><table class="tbl">
            <tbody>
            <?php foreach ($others as $o): ?>
              <tr>
                <td class="small"><?= h($o['number'] ?: '#'.$o['id']) ?></td>
                <td class="small"><?= h($o['comp']) ?></td>
                <td class="small"><?= h($o['work_title']) ?></td>
                <td><span class="badge badge--<?= h($o['status']) ?>"><?= h(app_status_ru($o['status'])) ?></span><?= $o['result'] ? ' <span class="small muted">'.h($o['result']).'</span>' : '' ?></td>
                <td><a class="btn btn--ghost btn--sm" href="<?= a_link('grading', array_filter(['id'=>$o['id'],'competition'=>$comp,'order'=>$order])) ?>">Оценить</a></td>
              </tr>
            <?php endforeach; ?>
            </tbody>
          </table></div>
        <?php endif; ?>
      </div>

      <div class="card" id="resultCard">
        <h3>Итоговый результат</h3>
        <?= admin_same_work_box(app_same_work_graded($a)) ?>
        <?php
        /* ПОДСКАЗКА АТТЕСТАЦИИ — ТАМ, ГДЕ СУДЯТ.
         *
         * Разбор лежал в отдельном разделе «Автооценка», и жюри его при
         * судействе не видело: чтобы свериться, надо было уйти со страницы,
         * найти заявку в другом списке и вернуться. Смысл подсказки от этого
         * пропадал. Теперь предложенное звание и обоснование стоят прямо над
         * выбором, а кнопка ставит его в форму — решение всё равно за человеком. */
        $agRun = null;
        try {
            $agRun = one("SELECT * FROM grading_runs WHERE application_id=? AND status='ok'
                           ORDER BY id DESC LIMIT 1", [$id]);
        } catch (\Throwable $e) { $agRun = null; }
        if ($agRun):
            $agFlags = (array) json_decode((string) ($agRun['red_flags'] ?? '[]'), true);
            $agConf  = (float) ($agRun['confidence'] ?? 0);
        ?>
          <?php $agRej = trim((string) ($agRun['reject_hint'] ?? '')); ?>
          <?php if ($agRej !== ''): ?>
            <?php /* НАРУШЕНИЕ ПОЛОЖЕНИЯ — ОТКАЗ, А НЕ ЗВАНИЕ.
                     Причина уже написана словами положения и с номером пункта:
                     кнопка переносит её в форму отклонения ниже, чтобы человеку
                     осталось только согласиться или поправить. */ ?>
            <div style="margin:0 0 14px;padding:13px 15px;border:1px solid #EBC7C7;background:#FDF1F1;border-radius:12px">
              <div class="small" style="text-transform:uppercase;letter-spacing:.06em;color:#8B2F2F;margin-bottom:6px">
                Рекомендация: отклонить · нарушение положения
              </div>
              <div style="font-size:14px;line-height:1.6;color:#3a2a2a;white-space:pre-line"><?= h($agRej) ?></div>
              <button type="button" class="btn btn--ghost btn--sm" style="margin-top:10px;border-color:#c98b8b;color:#8B2F2F"
                      data-ag-reject="<?= h($agRej) ?>" onclick="agReject(this)">Подставить причину в отклонение</button>
            </div>
            <script>
            function agReject(b){
              var t=b.getAttribute('data-ag-reject');
              var ta=document.querySelector('textarea[name=reject_reason]');
              if(ta){ ta.value=t; ta.focus();
                var box=ta.closest('form')||ta.closest('.card');
                if(box&&box.scrollIntoView) box.scrollIntoView({behavior:'smooth',block:'center'}); }
            }
            </script>
          <?php endif; ?>
          <div style="margin:0 0 14px;padding:13px 15px;border:1px solid #cfe0f5;background:#f4f8fd;border-radius:12px">
            <div class="small" style="text-transform:uppercase;letter-spacing:.06em;color:#39618f;margin-bottom:6px">
              Подсказка аттестации · разбор от <?= h(date('d.m.Y H:i', strtotime((string) $agRun['created_at']))) ?>
              <?= (int) ($agRun['applied'] ?? 0) === 1 ? ' · применена автоматически' : '' ?>
            </div>
            <div style="font-size:17px;font-weight:700;color:#17307A">
              <?= h((string) $agRun['title']) ?>
              <span class="small muted" style="font-weight:400"> · <?= number_format((float) $agRun['total'], 1, ',', ' ') ?> балла ·
                уверенность <?= number_format($agConf, 2, ',', ' ') ?></span>
            </div>
            <?php if (trim((string) ($agRun['extra_award'] ?? '')) !== ''): ?>
              <div class="small" style="margin-top:4px">Предложен доп. диплом: <b><?= h((string) $agRun['extra_award']) ?></b>
                <?= trim((string) ($agRun['extra_award_why'] ?? '')) !== '' ? ' — ' . h((string) $agRun['extra_award_why']) : '' ?></div>
            <?php endif; ?>
            <?php if ($agFlags): ?>
              <div class="small" style="margin-top:6px;color:#8B2F2F">Требует внимания: <?= h(implode('; ', array_map('strval', $agFlags))) ?></div>
            <?php endif; ?>
            <?php if (trim((string) ($agRun['internal_note'] ?? '')) !== ''): ?>
              <div class="small muted" style="margin-top:6px"><?= h(mb_substr((string) $agRun['internal_note'], 0, 400)) ?></div>
            <?php endif; ?>
            <?php if (trim((string) ($agRun['jury_comment'] ?? '')) !== ''): ?>
              <details style="margin-top:8px"><summary class="small" style="cursor:pointer">Готовый комментарий участнику</summary>
                <div class="small" style="margin-top:6px;white-space:pre-line"><?= h((string) $agRun['jury_comment']) ?></div></details>
            <?php endif; ?>
            <button type="button" class="btn btn--ghost btn--sm" style="margin-top:10px"
                    data-ag-title="<?= h((string) $agRun['title']) ?>"
                    data-ag-extra="<?= h((string) ($agRun['extra_award'] ?? '')) ?>"
                    data-ag-comment="<?= h((string) ($agRun['jury_comment'] ?? '')) ?>"
                    onclick="agTake(this)">Подставить в форму</button>
          </div>
          <script>
          function agTake(b){
            var t=b.getAttribute('data-ag-title');
            document.querySelectorAll('#resultCard input[name=result]').forEach(function(r){
              if(r.value===t){ r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true}));
                var l=r.closest('.rp-item'); if(l){ document.querySelectorAll('#resultCard .rp-item').forEach(function(x){x.classList.remove('on')}); l.classList.add('on'); } }
            });
            var e=b.getAttribute('data-ag-extra'), sel=document.getElementById('extraSel');
            if(sel&&e){ for(var i=0;i<sel.options.length;i++){ if(sel.options[i].value===e){ sel.selectedIndex=i; break; } } }
            var c=b.getAttribute('data-ag-comment'), ta=document.querySelector('#resultCard textarea[name=jury_comment]');
            if(ta&&c&&!ta.value.trim()) ta.value=c;
          }
          </script>
        <?php endif; ?>
        <p class="small muted">Выберите звание. Доп. диплом и комментарий — по желанию. До момента отправки результат можно менять — повторное сохранение перезапишет итог.</p>
        <form method="post" action="<?= url('/admin/?p=grading') ?>">
          <?= csrf_field() ?><input type="hidden" name="p" value="grading"><input type="hidden" name="do" value="grade_result">
          <input type="hidden" name="id" value="<?= $id ?>"><input type="hidden" name="competition" value="<?= $comp ?>"><input type="hidden" name="order" value="<?= h($order) ?>">
          <div class="rp-grid">
            <?php foreach (RESULT_PRESETS() as $rp): ?>
              <label class="rp-item<?= $a['result']===$rp?' on':'' ?>">
                <input type="radio" name="result" value="<?= h($rp) ?>" <?= $a['result']===$rp?'checked':'' ?>>
                <span><?= h($rp) ?></span>
              </label>
            <?php endforeach; ?>
          </div>
          <?php /* ФОНОГРАММА — ПОТОЛОК ДИПЛОМАНТА (п. 8.7 положения).
                   Правило записано в положении всех конкурсов, значит решение не
                   на усмотрение: лауреатское звание под фонограмму участник вправе
                   оспорить нашим же документом. Отметка ставится здесь, а звание
                   опускается при сохранении.

                   ПОДПИСЬ — СЛОВО В СЛОВО КАК У ВЛАДЕЛЬЦА, БЕЗ ДОБАВЛЕНИЙ.
                   Здесь стояли свои пояснения про минусовку и «согласно номинации».
                   Формулировка утверждена одна и та же везде: у галочки, в
                   сообщении после сохранения и в комментарии, который читает
                   участник, — чтобы жюри отмечало ровно то, что потом увидит
                   человек в письме. Менять её без слова владельца нельзя. */ ?>
          <label style="display:flex;gap:9px;align-items:flex-start;margin-top:12px;padding:11px 13px;
                        border:1px solid #f0dfae;background:#fff8e6;border-radius:11px;cursor:pointer">
            <input type="checkbox" name="phonogram" value="1" style="margin-top:3px">
            <span class="small" style="color:#8B6F1F"><?= h(PHONOGRAM_NOTE) ?></span>
          </label>
          <div class="field" style="margin-top:10px">
            <label>Дополнительный диплом (необязательно)</label>
            <select name="extra_diploma" id="extraSel">
              <option value="">— без дополнительного диплома —</option>
              <?php foreach (EXTRA_PRESETS() as $ep): ?>
                <option value="<?= h($ep) ?>" <?= ($a['extra_diploma']??'')===$ep?'selected':'' ?>><?= h($ep) ?></option>
              <?php endforeach; ?>
              <option value="__custom__" <?= ($a['extra_diploma']??'')!=='' && !in_array($a['extra_diploma'],EXTRA_PRESETS(),true)?'selected':'' ?>>Другое (вписать)…</option>
            </select>
            <input type="text" name="extra_custom" id="extraCustom" placeholder="Свой вариант, например: ЗА ЛУЧШИЙ ДЕБЮТ"
                   value="<?= ($a['extra_diploma']??'')!=='' && !in_array($a['extra_diploma'],EXTRA_PRESETS(),true) ? h($a['extra_diploma']) : '' ?>"
                   style="margin-top:8px;display:<?= ($a['extra_diploma']??'')!=='' && !in_array($a['extra_diploma'],EXTRA_PRESETS(),true)?'block':'none' ?>">
          </div>
          <div class="field" style="margin-top:10px">
            <label>Комментарий жюри (необязательно, попадает участнику)</label>
            <textarea name="jury_comment" placeholder="Например: яркое, эмоциональное выступление"><?= h($a['jury_comment'] ?? '') ?></textarea>
          </div>
          <?php $ovr = trim((string)($a['send_at_override'] ?? '')); ?>
          <?php if (empty($isLongView)): ?>
          <div class="field" style="margin-top:10px;padding:10px 12px;border:1px dashed var(--a-line);border-radius:10px">
            <div style="font-weight:700;margin-bottom:6px">Когда отправить результат участнику?</div>
            <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-bottom:8px">
              <input type="checkbox" name="auto_send" id="autoSendChk" value="1" checked style="margin-top:3px">
              <span>Автоматически по сроку <b>(по умолчанию)</b><br><span class="small muted">5 рабочих дней от даты подачи (ВИП — 3; вс — нерабочий), окно 9:00–18:00 МСК. Если срок вышел — ближайшее рабочее утро.</span></span>
            </label>
            <!-- Появляется только когда снята галочка «авто» -->
            <div id="manualBox" style="display:none;padding-left:26px;border-left:2px solid var(--a-line)">
              <div class="small muted" style="margin-bottom:6px">Галочка снята — выберите один из вариантов:</div>
              <button class="btn btn--navy btn--sm" type="submit" name="send_now" value="1" onclick="return confirm('Отправить результат участнику ПРЯМО СЕЙЧАС?')" style="margin-bottom:8px"><?= admin_icon('send') ?>Отправить сейчас (моментально)</button>
              <label style="display:flex;align-items:center;gap:8px">
                <input type="datetime-local" name="send_at" id="sendAtInp" value="<?= $ovr !== '' ? h(date('Y-m-d\TH:i', strtotime($ovr))) : '' ?>" style="max-width:220px">
                <span class="small muted">— или запрограммировать на дату/время</span>
              </label>
            </div>
          </div>
          <?php else: ?>
          <div class="field" style="margin-top:10px;padding:10px 12px;border:1px dashed var(--a-line);border-radius:10px">
            <span class="small muted">Длинный конкурс: результат сохраняется в общий список и публикуется пакетом в дату публикации. Персональных писем «в течение 5 рабочих дней» здесь нет — участники увидят звания после публикации итогов.</span>
          </div>
          <?php endif; ?>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;align-items:center">
            <button class="btn btn--primary" type="submit"><?= admin_icon('check') ?>Сохранить итог</button>
          </div>
          <script>(function(){
            var c=document.getElementById('autoSendChk'),box=document.getElementById('manualBox'),d=document.getElementById('sendAtInp');
            if(!c) return;
            function sync(){ if(box) box.style.display = c.checked ? 'none':'block'; if(c.checked && d) d.value=''; }
            c.addEventListener('change',sync); sync();
          })();</script>
          <?php if ($a['result']): ?>
            <span class="badge badge--gold" style="margin-left:8px"><?= h($a['result']) ?></span>
          <?php endif; ?>
        </form>

        <?php $isRejected = (string) $a['status'] === 'rejected'; ?>
        <button type="button" class="btn btn--ghost btn--sm" id="rejectToggle" style="margin-top:14px;color:#8b2f2f;border-color:#d99"><?= admin_icon('x') ?><?= $isRejected ? 'Изменить отклонение…' : 'Отклонить заявку…' ?></button>
        <div class="reject-panel<?= $isRejected ? ' show' : '' ?>" id="rejectPanel">
          <b><?= $isRejected ? 'Заявка отклонена — можно поправить основание' : 'Отклонение заявки по пункту положения' ?></b>
          <p class="small muted" style="margin:4px 0 0">
            <?php if ($isRejected): ?>
              Не тот пункт или неточная формулировка — поправьте текст и сохраните. Повторное письмо
              участнику НЕ уходит, пока Вы сами не поставите галочку: он уже получил отказ, и второе
              такое же письмо выглядит как новый отказ по той же заявке.
            <?php else: ?>
              Выберите готовое основание или впишите своё. Участник получит письмо с причиной и предложением исправить и подать заявку заново.
            <?php endif; ?><br>
            Пункты приведены по положению этого конкурса — <b><?= (int) ($a['comp_paid'] ?? 1) === 1 ? 'платного, эталон «Эврика»' : 'бесплатного, эталон «Слава России»' ?></b>.</p>
          <div class="rr-chips" id="rrChips"></div>
          <form method="post" action="<?= url('/admin/?p=grading') ?>">
            <?= csrf_field() ?><input type="hidden" name="p" value="grading">
            <input type="hidden" name="do" value="<?= $isRejected ? 'reject_edit' : 'reject' ?>">
            <input type="hidden" name="id" value="<?= $id ?>"><input type="hidden" name="competition" value="<?= $comp ?>"><input type="hidden" name="order" value="<?= h($order) ?>">
            <div class="field">
              <textarea name="reject_reason" id="rejectReason" rows="3" placeholder="Причина отклонения (пункт положения)"><?= h((string)($a['reject_reason'] ?? '')) ?></textarea>
            </div>
            <?php if ($isRejected): ?>
              <label class="small" style="display:block;margin:0 0 8px">
                <input type="checkbox" name="notify" value="1"> сообщить участнику об уточнении причины
              </label>
              <button class="btn btn--sm" style="background:#8b2f2f;color:#fff"><?= admin_icon('edit') ?>Сохранить причину</button>
            <?php else: ?>
              <button class="btn btn--sm" style="background:#8b2f2f;color:#fff" onclick="return confirm('Отклонить заявку и отправить участнику письмо с причиной?')"><?= admin_icon('x') ?>Отклонить и отправить письмо</button>
            <?php endif; ?>
          </form>
          <?php if ($isRejected): ?>
            <form method="post" action="<?= url('/admin/?p=grading') ?>" style="margin-top:10px"
                  onsubmit="return confirm('Снять отклонение? Заявка вернётся в работу, и её можно будет оценить.')">
              <?= csrf_field() ?><input type="hidden" name="p" value="grading">
              <input type="hidden" name="do" value="gl_unreject"><input type="hidden" name="id" value="<?= $id ?>">
              <input type="hidden" name="competition" value="<?= $comp ?>"><input type="hidden" name="order" value="<?= h($order) ?>">
              <button class="btn btn--ghost btn--sm">Снять отклонение и вернуть в работу</button>
            </form>
          <?php endif; ?>
        </div>
        <script>
          (function(){
            // Пункты берём из положения ИМЕННО ЭТОГО конкурса: у платного и
            // бесплатного эталонов нумерация разная, и подставить чужой номер в
            // отказ — значит дать участнику законный повод его оспорить.
            var REJECT_REASONS = <?= json_encode(REJECT_REASONS(['is_paid' => (int) ($a['comp_paid'] ?? 1)]), JSON_UNESCAPED_UNICODE) ?>;
            var chips=document.getElementById('rrChips'), ta=document.getElementById('rejectReason');
            Object.keys(REJECT_REASONS).forEach(function(k){
              var b=document.createElement('button'); b.type='button'; b.textContent=k+' — '+REJECT_REASONS[k].slice(0,60)+(REJECT_REASONS[k].length>60?'…':'');
              b.title=REJECT_REASONS[k];
              b.addEventListener('click',function(){ ta.value = REJECT_REASONS[k]; ta.focus(); });
              chips.appendChild(b);
            });
            var tog=document.getElementById('rejectToggle'), panel=document.getElementById('rejectPanel');
            tog.addEventListener('click',function(){ panel.classList.toggle('show'); });
            var chk=document.getElementById('autoSendChk'), box=document.getElementById('sendAtBox');
            if(chk) chk.addEventListener('change',function(){ box.style.display = chk.checked ? 'none' : 'block'; });
          })();
        </script>
        <style>
          .rp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
          .rp-item{display:flex;align-items:center;justify-content:center;text-align:center;padding:10px 8px;border-radius:12px;cursor:pointer;position:relative;
            border:1.5px solid var(--a-line);background:#fdfaf2;font-weight:800;font-size:.78rem;line-height:1.2;transition:border-color .15s,background .15s}
          .rp-item input{position:absolute;opacity:0;width:0;height:0}
          .rp-item.on,.rp-item:has(input:checked){border-color:var(--a-gold,#8B6F1F);background:#f7edd2;color:var(--a-gold,#8B6F1F)}
          @media(max-width:640px){.rp-grid{grid-template-columns:1fr 1fr}}
        </style>
        <script>
        (function(){
          document.querySelectorAll('.rp-item input').forEach(function(r){
            r.addEventListener('change',function(){
              document.querySelectorAll('.rp-item').forEach(function(l){l.classList.toggle('on',l.querySelector('input').checked);});
            });
          });
          var sel=document.getElementById('extraSel'), cust=document.getElementById('extraCustom');
          if(sel) sel.addEventListener('change',function(){ cust.style.display = sel.value==='__custom__' ? 'block' : 'none'; });
        })();
        </script>
      </div>

      <div class="card">
        <h3>Приватная заметка жюри</h3>
        <p class="small muted">Внутренний комментарий по заявке — виден только жюри, участнику не показывается.</p>
        <form method="post" action="<?= url('/admin/?p=grading') ?>" id="gradeForm">
          <?= csrf_field() ?><input type="hidden" name="p" value="grading"><input type="hidden" name="do" value="grade"><input type="hidden" name="id" value="<?= $id ?>">
          <input type="hidden" name="competition" value="<?= $comp ?>"><input type="hidden" name="order" value="<?= h($order) ?>">
          <div class="field">
            <textarea name="note" placeholder="Комментарий для внутренней работы"><?= h($my['note'] ?? '') ?></textarea>
          </div>
          <div class="field--inline">
            <button class="btn btn--ghost btn--sm"><?= admin_icon('check') ?>Сохранить заметку</button>
          </div>
        </form>
        <hr>
        <h4>Текущий итог заявки</h4>
        <div class="kv">
          <dt>Результат</dt><dd><?= $a['result'] ? '<span class="badge badge--gold">'.h($a['result']).'</span>' : '— не выставлен —' ?></dd>
        </div>
      </div>
    </div>

    </div><!-- /.jury-fast -->
    <script>
    (function(){
      // Навигация по заявкам стрелками (балльная система убрана).
      var nextUrl=<?= json_encode($nextUrl) ?>, prevUrl=<?= json_encode($prevUrl) ?>;
      document.addEventListener('keydown', function(e){
        var typing = e.target.tagName==='TEXTAREA' || e.target.tagName==='INPUT' || e.target.tagName==='SELECT';
        if(typing) return;
        if((e.key===' '||e.key==='ArrowRight') && nextUrl){ e.preventDefault(); location.href=nextUrl; return; }
        if(e.key==='ArrowLeft' && prevUrl){ e.preventDefault(); location.href=prevUrl; return; }
      });
    })();
    </script>
    <?php
    $content = ob_get_clean();
    // Длинный конкурс: карточка та же, но раздел в меню — «Оценка длинных», не «коротких».
    if (!empty($isLongView)) admin_layout('Оценка длинного конкурса — ' . h($a['comp']), $content, 'longcomp');
    else admin_layout('Оценивание', $content, 'grading');
    exit;
}

/* ================= ОЧЕРЕДЬ ОЦЕНИВАНИЯ (СПИСОК) ================= */

/* ДВА РАЗДЕЛА — ДВА РАЗНЫХ НАБОРА КОНКУРСОВ.
 *
 * Очередь и архив здесь всегда были только по коротким конкурсам, а вот
 * выпадающий список предлагал ВСЕ, включая длинные. Выбрав в «Оценке коротких»
 * длинный конкурс, администратор получал пустую очередь, пустой архив и при этом
 * панель «Итоги конкурса» с кнопками длинного — то есть длинный конкурс жил
 * сразу в двух разделах, и понять, где его на самом деле оценивают, было нельзя.
 * Теперь в списке только короткие, а ссылка на длинный уводит в свой раздел. */
$comps = all("SELECT id,name,is_paid,results_mode,results_date FROM competitions
               WHERE COALESCE(results_mode,'email') <> 'list' ORDER BY sort,name");
$compRow = null;
foreach ($comps as $c) if ((int)$c['id'] === $comp) { $compRow = $c; break; }

// Пришли по старой ссылке с длинным конкурсом — отправляем в «Оценку длинных».
if ($comp && !$compRow) {
    $isLongComp = (string) (scalar("SELECT results_mode FROM competitions WHERE id=?", [$comp]) ?? '') === 'list';
    if ($isLongComp) admin_redirect('longcomp', ['competition' => $comp]);
}

$qSearch = trim(input('q'));

// ДВА СПИСКА НА ОДНОЙ СТРАНИЦЕ. Сверху очередь на аттестацию, снизу — всё, что
// уже разобрано, включая отклонённые. Раньше это был переключатель: оценённые
// ПОДМЕНЯЛИ очередь, поэтому увидеть своё вчерашнее решение, не потеряв из виду
// сегодняшнюю очередь, было нельзя. Поиск общий — ищем по обоим спискам сразу.
$rows       = grading_queue_rows($comp, $order, $qSearch);
$qTotal     = count($rows);
$gradedRows = graded_rows($comp, $qSearch, input('gorder') === 'old' ? 'old' : 'new', 'short');

/* Панель «Итоги конкурса» отсюда убрана: она про длинный конкурс и живёт в
   разделе «Оценка длинных» (admin/longcomp.php), где есть и прогресс оценки, и
   выгрузка списка, и кнопка публикации итогов. Здесь она только путала. */

$firstId = null;
foreach ($rows as $r) { $firstId = (int)$r['id']; break; }

ob_start(); ?>
<div class="section-title">
  <h2>Оценка коротких <span class="small muted">(в очереди: <?= $qTotal ?> · разобрано: <?= count($gradedRows) ?>)</span></h2>
  <?php if ($firstId): ?>
    <a class="btn btn--primary" href="<?= a_link('grading', array_filter(['id'=>$firstId,'competition'=>$comp,'order'=>$order])) ?>"><?= admin_icon('grading') ?>Начать оценку</a>
  <?php endif; ?>
</div>
<p class="small muted" style="margin:-6px 0 14px">Сверху — очередь на аттестацию, снизу — всё, что уже разобрано, вместе с отклонёнными. Новые заявки попадают в очередь автоматически, ручные переносы статусов не нужны.</p>

<form method="get" class="filters">
  <input type="hidden" name="p" value="grading">
  <div class="field"><label>Поиск по обоим спискам</label><input name="q" value="<?= h($qSearch) ?>" placeholder="ФИО, коллектив, №, email, телефон, номер, звание"></div>
  <div class="field"><label>Конкурс</label><select name="competition" onchange="this.form.submit()"><option value="">Все конкурсы</option>
    <?php foreach ($comps as $c): ?><option value="<?= $c['id'] ?>" <?= $comp===(int)$c['id']?'selected':'' ?>><?= h($c['name']) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>Очередь</label><select name="order" onchange="this.form.submit()">
    <option value="old" <?= $order==='old'?'selected':'' ?>>Старые → новые</option>
    <option value="new" <?= $order==='new'?'selected':'' ?>>Новые → старые</option>
  </select></div>
  <div class="field"><label>Разобранные</label><select name="gorder" onchange="this.form.submit()">
    <option value="new" <?= input('gorder')!=='old'?'selected':'' ?>>Новые оценённые сверху</option>
    <option value="old" <?= input('gorder')==='old'?'selected':'' ?>>Старые оценённые сверху</option>
  </select></div>
  <button class="btn btn--primary btn--sm"><?= admin_icon('search') ?? '' ?>Поиск</button>
  <?php if ($qSearch !== ''): ?><a class="btn btn--ghost btn--sm" href="<?= a_link('grading', array_filter(['competition'=>$comp,'order'=>$order])) ?>">Сброс</a><?php endif; ?>
</form>



<style>
.gq-tbl td{vertical-align:middle}
.gq-tbl .gq-grp{border-left:3px solid var(--a-gold,#8B6F1F)}
.gq-tbl .gq-badge{font-size:.7rem}
</style>

<!-- СПИСОК 1: ОЧЕРЕДЬ НА АТТЕСТАЦИЮ -->
<div class="section-title" style="margin:18px 0 8px">
  <h3>На аттестации <span class="badge badge--muted"><?= $qTotal ?></span></h3>
</div>
<?php
/* ПОДСКАЗКА АТТЕСТАЦИИ ВИДНА ПРЯМО В ОЧЕРЕДИ.
   Иначе о том, что работа уже разобрана машиной, узнаёшь только открыв её. Один
   запрос на весь список: разборы берём пачкой, а не по строке. */
$agHints = [];
$agFails = [];
if ($rows) {
    $ids = implode(',', array_map(static fn($r) => (int) $r['id'], $rows));
    try {
        foreach (all("SELECT application_id, title, total, confidence, reject_hint FROM grading_runs
                       WHERE status='ok' AND application_id IN ($ids)
                    ORDER BY id ASC") as $g) {
            $agHints[(int) $g['application_id']] = $g;      // последний разбор перекрывает ранний
        }
    } catch (\Throwable $e) { $agHints = []; }
    /* ЗАПИСЬ НЕ ОТКРЫВАЕТСЯ — ЭТО ТОЖЕ РЕЗУЛЬТАТ.
       Работы, чью запись не удалось получить (закрытый доступ, удалённое видео,
       мёртвая ссылка), в списке выглядели как необработанные: подсказки нет, и
       непонятно, ждать её или уже разбираться руками. Показываем прямо: запись
       недоступна и по какой причине — дальше это работа человека, он напишет
       участнику или отклонит по пункту положения. */
    try {
        foreach (all("SELECT application_id, COUNT(*) n, MAX(error) err FROM grading_runs
                       WHERE status='failed' AND application_id IN ($ids)
                    GROUP BY application_id") as $g) {
            $aid = (int) $g['application_id'];
            if (isset($agHints[$aid])) continue;      // разбор всё-таки удался позже
            $agFails[$aid] = $g;
        }
    } catch (\Throwable $e) { $agFails = []; }
}
?>
<div class="table-wrap">
  <table class="tbl gq-tbl">
    <thead><tr>
      <th>Участник</th><th>Конкурс</th><th>Конкурсный номер</th><th>Подана</th><th>Подсказка</th><th>Статус</th><th></th>
    </tr></thead>
    <tbody>
      <?php if (!$rows): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:28px">Очередь пуста — все заявки разобраны</td></tr><?php endif; ?>
      <?php foreach ($rows as $a): ?>
        <tr class="<?= (int)$a['grp_count'] > 1 ? 'gq-grp' : '' ?>">
          <td><b><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></b><?= vip_mark((int)($a['user_id'] ?? 0), '', (string)($a['email'] ?? '')) ?>
            <?php if ((int)$a['grp_count'] > 1 && (int)$a['grp_pos'] === 0): ?>
              <span class="badge badge--gold gq-badge">участник <?= (int)$a['grp_count'] ?> заявок</span>
            <?php elseif ((int)$a['grp_count'] > 1): ?>
              <span class="badge badge--muted gq-badge"><?= (int)$a['grp_pos']+1 ?>/<?= (int)$a['grp_count'] ?></span>
            <?php endif; ?>
            <div class="small muted"><?= h($a['number'] ?: '#'.$a['id']) ?></div>
          </td>
          <td class="small"><?= h($a['comp']) ?></td>
          <td class="small"><?= h($a['work_title']) ?></td>
          <td class="small"><?= h(date('d.m.y H:i', strtotime((string)$a['created_at']))) ?></td>
          <td class="small">
            <?php
            /* Нарушение положения — это отказ, а не низкая оценка, и в списке
               оно должно читаться именно так. Раньше здесь стояло «ТРЕБУЕТ
               ПРОВЕРКИ»: жюри видело, что что-то не так, но шло разбираться
               заново. Теперь сразу видно, что рекомендуется отклонить и по
               какому пункту. */
            $hint = $agHints[(int) $a['id']] ?? null;
            $rej  = $hint ? trim((string) ($hint['reject_hint'] ?? '')) : '';
            if ($rej !== ''): ?>
              <span style="color:#8B2F2F;font-weight:700">Отклонить</span>
              <div class="small" style="color:#8B2F2F;opacity:.85;line-height:1.3"><?= h(mb_substr(strtok($rej, "\n"), 0, 64)) ?></div>
            <?php elseif ($hint): ?>
              <span style="color:#39618f;font-weight:600"><?= h((string) $hint['title']) ?></span>
              <span class="muted"> · <?= number_format((float) $hint['total'], 1, ',', ' ') ?></span>
            <?php elseif (!empty($agFails[(int) $a['id']])): $f = $agFails[(int) $a['id']]; ?>
              <span style="color:#8B6F1F;font-weight:600">Запись недоступна</span>
              <div class="small" style="color:#8B6F1F;opacity:.85;line-height:1.3">
                <?= h(mb_substr(preg_replace('~^запись не получена:\s*~u', '', (string) $f['err']) ?: '', 0, 58)) ?>
                <?= (int) $f['n'] > 1 ? ' · попыток ' . (int) $f['n'] : '' ?>
              </div>
            <?php else: ?>
              <span class="muted">—</span>
            <?php endif; ?>
          </td>
          <td><span class="badge badge--<?= h($a['status']) ?>"><?= h(app_status_ru($a['status'])) ?></span></td>
          <td><a class="btn btn--primary" href="<?= a_link('grading', array_filter(['id'=>$a['id'],'competition'=>$comp,'order'=>$order])) ?>"><?= admin_icon('grading') ?>ОЦЕНИТЬ</a></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<!-- СПИСОК 2: РАЗОБРАННЫЕ (оценённые + отклонённые) -->
<div class="section-title" id="graded" style="margin:26px 0 8px">
  <h3>Оценённые и отклонённые <span class="badge badge--gold"><?= count($gradedRows) ?></span></h3>
</div>
<p class="small muted" style="margin:-4px 0 12px">
  Всё, что уже разобрано. Видно, когда участник узнает результат и когда получит наградные документы.
  «Изменить» открывает ту же карточку оценки — там правится и результат, и сама заявка.
</p>
<?= admin_graded_table($gradedRows, 'grading',
      array_filter(['competition' => $comp, 'order' => $order, 'q' => $qSearch])) ?>
<?php
$content = ob_get_clean();
admin_layout('Оценка коротких', $content, 'grading');
