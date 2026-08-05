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
jury_ensure_schema();

/** Пытается собрать embed-URL для видео. Иначе null (покажем кнопку «Открыть»). */
function grading_embed(string $url): ?string {
    if (preg_match('#rutube\.ru/(?:video|shorts|play/embed)/([a-z0-9]+)#i', $url, $m)) return 'https://rutube.ru/play/embed/' . $m[1];
    if (preg_match('#drive\.google\.com/file/d/([^/]+)#', $url, $m)) return 'https://drive.google.com/file/d/' . $m[1] . '/preview';
    if (preg_match('#vkvideo\.ru/video(-?\d+_\d+)#', $url, $m) || preg_match('#vk\.com/video(-?\d+_\d+)#', $url, $m)) {
        [$oid, $vid] = explode('_', $m[1]);
        return 'https://vk.com/video_ext.php?oid=' . $oid . '&id=' . $vid;
    }
    return null;
}

/* Мягкие миграции: итог, комментарий, проверка ссылки, отклонение, ручной срок отправки. */
foreach (['extra_diploma' => "TEXT DEFAULT ''", 'jury_comment' => "TEXT DEFAULT ''", 'graded_at' => "TEXT",
          'link_check' => "TEXT", 'reject_reason' => "TEXT DEFAULT ''", 'send_at_override' => "TEXT"] as $col => $def) {
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

/**
 * Реальные основания отклонения заявки — пункты эталонных положений
 * (docs/polozheniya/etalon_2.docx, etalon_4.docx). Ключ = номер пункта.
 */
function REJECT_REASONS(): array {
    return [
        'п. 8.11' => 'Конкурсный материал старше 1 года с момента исполнения (п. 8.11 положения).',
        'п. 8.10' => 'Ссылка на конкурсный материал недействительна или неактуальна (п. 8.10 положения).',
        'п. 8.8'  => 'Ссылка не на разрешённый интернет-ресурс. Принимаются только: RuTube, Google Диск, Яндекс Диск, ОК видео, ВК видео, Дзен видео (п. 8.8 положения).',
        'п. 8.9'  => 'Материал размещён на запрещённом интернет-ресурсе (Instagram, Facebook, TikTok, YouTube, иностранные мессенджеры) (п. 8.9 положения).',
        'п. 8.5'  => 'Видеоматериал содержит элементы монтажа, склейки, стоп-кадры или наложение видеоэффектов/аудиодорожек (п. 8.5 положения).',
        'п. 8.6'  => 'Низкое качество видеозаписи: разрешение менее 480 пикселей (п. 8.6 положения).',
        'п. 8.7'  => 'Использование фонограммы, не соответствующей заявленной номинации (п. 8.7 положения).',
        'п. 8.3'  => 'В конкурсном номере чётко не видны руки, ноги и лицо исполнителя (п. 8.3 положения).',
        'п. 8.2'  => 'Видеозапись не соответствует требованиям к съёмке: сцена (импровизированная сцена), домашние условия, статичная камера (п. 8.2 положения).',
        'п. 9'    => 'Конкурсный номер не соответствует заявленной номинации (пп. 8.5 и 9 положения).',
        'п. 4.2'  => 'Неверно заполнена заявка на участие (п. 4.2 положения).',
        'п. 4.1'  => 'Невыполнение требований, условий или правил, прописанных в положении конкурса (п. 4.1 положения).',
        'Пункт №1' => 'Материал содержит запрещённый контент: нецензурная брань, сцены насилия, экстремизм и иные материалы, нарушающие законодательство РФ (Пункт №1 положения).',
        'критерии' => 'Плагиат / отсутствие самостоятельности исполнения (критерии аттестации положения).',
    ];
}

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
function grading_queue_rows(int $comp = 0, string $order = 'old'): array {
    $w = "a.status IN ('new','submitted','pending','paid','judging')"; $args = [];
    if ($comp) { $w .= " AND a.competition_id=?"; $args[] = $comp; }
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

/** HTTP GET -> JSON (короткие таймауты, тихо null при любой ошибке). */
function _lc_http_json(string $url): ?array {
    if (!function_exists('curl_init')) return null;
    try {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 4, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => 7,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (MuzMirLinkCheck)']);
        $body = curl_exec($ch);
        curl_close($ch);
        if (!is_string($body) || $body === '') return null;
        $j = json_decode($body, true);
        return is_array($j) ? $j : null;
    } catch (\Throwable $e) { return null; }
}

/**
 * Проверка ссылки по 3 пунктам: платформа / доступность / дата публикации не старше 1 года.
 * true|false|null (null = «не проверено / проверьте вручную» — сеть с VPS может врать, не блокируем).
 * Кэш — applications.link_check (JSON).
 */
function grading_link_check(array $a, bool $force = false): array {
    $empty = ['platform' => null, 'platform_label' => '', 'reachable' => null,
              'fresh' => null, 'published' => '', 'checked_at' => ''];
    $url = trim((string)($a['video_url'] ?? ''));
    if ($url === '') return $empty;
    if (!$force && !empty($a['link_check'])) {
        $c = json_decode((string)$a['link_check'], true);
        if (is_array($c) && !empty($c['checked_at'])) return $c + $empty;
    }
    $res = $empty;
    $res['checked_at'] = date('Y-m-d H:i:s');

    // 1) Платформа (справочники core/data.php).
    $host = mb_strtolower((string)(parse_url($url, PHP_URL_HOST) ?: ''));
    foreach (BLOCKED_PLATFORMS() as $b) {
        if ($host !== '' && str_contains($host, $b)) { $res['platform'] = false; $res['platform_label'] = $b; break; }
    }
    if ($res['platform'] === null) {
        foreach (ALLOWED_PLATFORMS() as $dom => $label) {
            if (str_contains($host, $dom) || str_contains($url, $dom)) { $res['platform'] = true; $res['platform_label'] = $label; break; }
        }
    }
    if ($res['platform'] === null) $res['platform'] = false;

    // 2) Доступность (HEAD; при сетевой ошибке — «не проверено», не блокируем).
    if (function_exists('curl_init')) {
        try {
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_NOBODY => true, CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 4,
                CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => 7,
                CURLOPT_USERAGENT => 'Mozilla/5.0 (MuzMirLinkCheck)']);
            curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            $errno = curl_errno($ch);
            curl_close($ch);
            if ($errno) $res['reachable'] = null;
            elseif (in_array($code, [403, 405, 429], true)) $res['reachable'] = null; // HEAD не разрешён — не проверено
            elseif ($code >= 200 && $code < 400) $res['reachable'] = true;
            else $res['reachable'] = false;
        } catch (\Throwable $e) { $res['reachable'] = null; }
    }

    // 3) Дата публикации: RuTube API / VK video.get (иначе — «проверьте вручную»).
    $ts = null;
    try {
        if (preg_match('#rutube\.ru/(?:video|shorts|play/embed)/([a-z0-9]+)#i', $url, $m)) {
            $j = _lc_http_json('https://rutube.ru/api/video/' . $m[1] . '/');
            if ($j && !empty($j['created_ts'])) $ts = strtotime((string)$j['created_ts']) ?: null;
        } elseif (preg_match('#(?:vk\.com|vkvideo\.ru)/video(-?\d+_\d+)#', $url, $m)) {
            $tok = (string) cfgv('vk_token', '');
            if ($tok !== '') {
                $j = _lc_http_json('https://api.vk.com/method/video.get?videos=' . $m[1]
                    . '&access_token=' . rawurlencode($tok) . '&v=5.199');
                $item = $j['response']['items'][0] ?? null;
                if ($item && !empty($item['date'])) $ts = (int)$item['date'];
            }
        }
    } catch (\Throwable $e) { $ts = null; }
    if ($ts) {
        $res['published'] = date('d.m.Y', $ts);
        $res['fresh'] = $ts >= strtotime('-1 year');
    }

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
    if ($appId && in_array($result, RESULT_PRESETS(), true)) {
        $cur = one("SELECT * FROM applications WHERE id=?", [$appId]);
        if (!$cur) { flash('Заявка не найдена.', 'error'); admin_redirect('grading'); }
        // Балльная система убрана — итог задаётся только званием, без числового балла.
        $score = null;
        // Срок отправки диплома:
        //   auto_send=1 (галочка вкл) → пусто: cron отправит автоматически по сроку
        //     (короткий платный — 5 раб.дней, ВИП — 3; длинный/бесплатный — пакетом в дату публикации);
        //   галочка ВЫКЛ + дата задана → ручной override на дату;
        //   галочка ВЫКЛ + дата пустая → МОМЕНТАЛЬНО (сейчас).
        $override = '';
        $sendAtRaw = trim(input('send_at'));
        if (input('auto_send') !== '1') {
            if ($sendAtRaw !== '') {
                try { $override = (new DateTime($sendAtRaw))->format('Y-m-d H:i:s'); } catch (\Throwable $e) { $override = ''; }
            }
            if ($override === '') $override = date('Y-m-d H:i:s'); // моментальная отправка
        }
        update('applications', [
            'result' => $result, 'score' => $score,
            'extra_diploma' => $extra, 'jury_comment' => $jcomment,
            'status' => 'graded', 'send_at_override' => $override,
        ], 'id=:wid', ['wid' => $appId]);
        // Момент проставления результата — стартовая точка цепочки напоминаний
        // о заказе наград (cron/award_order_reminders.php). Ставим один раз.
        q("UPDATE applications SET graded_at=? WHERE id=? AND (graded_at IS NULL OR graded_at='')",
          [date('Y-m-d H:i:s'), $appId]);
        q("UPDATE jury_assignments SET done=1 WHERE application_id=?", [$appId]);

        // Результат можно редактировать до отправки: если итог изменился, а диплом
        // ещё НЕ отправлен — сносим запланированный диплом, cron пересоздаст его
        // с новым результатом и свежим PDF по тому же сроку.
        $changed = ((string)$cur['result'] !== $result)
            || ((string)($cur['extra_diploma'] ?? '') !== $extra)
            || ($score !== null && (string)$cur['score'] !== (string)$score);
        if ($changed) {
            q("DELETE FROM diplomas WHERE application_id=? AND sent_at IS NULL", [$appId]);
        }
        if ($override !== '') {
            q("UPDATE diplomas SET scheduled_at=? WHERE application_id=? AND sent_at IS NULL", [$override, $appId]);
        }
        // Результат готов → участнику письмо + уведомление в личный кабинет.
        // Только при ПЕРВОЙ аттестации и для КОРОТКИХ конкурсов (results_mode!='list').
        // Длинные (list) публикуются пакетом 28-го (cron/publish_results_vk) — здесь молчим.
        $firstGrade = trim((string)($cur['result'] ?? '')) === '';
        $compRow = one("SELECT results_mode FROM competitions WHERE id=?", [(int)$cur['competition_id']]) ?: [];
        if ($firstGrade && (string)($compRow['results_mode'] ?? 'email') !== 'list') {
            if (is_file(BASE_PATH.'/core/result_mail.php'))   require_once BASE_PATH.'/core/result_mail.php';
            if (is_file(BASE_PATH.'/core/notifications.php')) require_once BASE_PATH.'/core/notifications.php';
            if (!empty($cur['user_id']) && function_exists('notify_user')) {
                notify_user((int)$cur['user_id'], 'Ваш результат готов',
                    'Жюри подвело итоги: ' . $result . '. Письмо с результатом отправлено на почту из заявки.',
                    url('/cabinet'), 'award');
            }
            if (function_exists('result_mail_send')) { try { result_mail_send($appId); } catch (\Throwable $e) {} }
        }
        audit('grade_result', 'application', $appId, ['result'=>$result,'score'=>$score,'extra'=>$extra,'send_at'=>$override]);
        flash('Итог сохранён: ' . $result . ($score !== null ? ' · ' . number_format($score,1,'.','') : '')
            . ($extra !== '' ? ' · доп: ' . $extra : '')
            . ($override !== '' ? ' · отправка ' . date('d.m.Y H:i', strtotime($override)) : ' · отправка автоматически по сроку') . '.', 'success');
        $next = grading_next_id($cur, $comp, $order);
        if ($next) admin_redirect('grading', array_filter(['id'=>$next,'competition'=>$comp,'order'=>$order]));
        admin_redirect('grading', array_filter(['competition'=>$comp,'order'=>$order]));
    }
    flash('Выберите итоговый результат из списка.', 'error');
    admin_redirect('grading', array_filter(['id'=>$appId,'competition'=>$comp,'order'=>$order]));
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
    update('applications', ['status' => 'rejected', 'reject_reason' => $reason], 'id=:wid', ['wid' => $appId]);
    q("DELETE FROM diplomas WHERE application_id=? AND sent_at IS NULL", [$appId]);
    audit('application_reject', 'application', $appId, ['reason' => $reason]);

    // Письмо участнику: причина + предложение исправить и подать заново.
    $mailed = false;
    if (trim((string)$a['email']) !== '' && is_file(BASE_PATH . '/core/result_mail.php')) {
        require_once BASE_PATH . '/core/result_mail.php';
        try {
            $name  = trim((string)$a['full_name']);
            $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
            $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:24px;line-height:1.3;font-weight:700;color:' . RM_NAVY . ';">Заявка №' . h((string)$a['number']) . ' не принята к участию</h1>'
                . '<p style="margin:0 0 14px;">' . $hello . '</p>'
                . '<p style="margin:0 0 18px;">К сожалению, Оргкомитет не может допустить Вашу заявку на конкурс «' . h((string)$a['comp']) . '» по следующей причине:</p>'
                . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#FDF1F1;border:1px solid #EBC7C7;border-radius:14px;">'
                . '<tr><td style="padding:16px 22px;"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#A0403E;margin-bottom:6px;">Причина отклонения</div>'
                . '<div style="font-size:14px;line-height:1.7;color:' . RM_INK . ';">' . nl2br(h($reason)) . '</div></td></tr></table>'
                . '<p style="margin:0 0 14px;">Это не отказ навсегда: пожалуйста, устраните замечание (например, замените видеозапись или скорректируйте данные) и <b style="color:' . RM_NAVY . ';">подайте заявку заново</b> — мы с радостью примем её к аттестации.</p>'
                . '<p style="margin:0 0 4px;color:' . RM_MUTED . ';font-size:13px;">Если был внесён оргвзнос, он возвращается в полном объёме (п. 7.6.1 положения).</p>'
                . rm_mail_btn(url('/apply'), 'Подать заявку заново');
            $html = rm_mail_layout($inner, 'Заявка №' . (string)$a['number'] . ': требуется исправление. Причина внутри — исправьте и подайте заново.');
            $mailed = mail_queue((string)$a['email'], $name, 'Заявка №' . (string)$a['number'] . ' — требуется исправление', $html) > 0;
        } catch (\Throwable $e) { /* письмо не должно ломать отклонение */ }
    }
    flash('Заявка отклонена.' . ($mailed ? ' Участнику отправлено письмо с причиной и предложением подать заново.' : ''), 'success');
    $next = grading_next_id($a, $comp, $order);
    if ($next) admin_redirect('grading', array_filter(['id'=>$next,'competition'=>$comp,'order'=>$order]));
    admin_redirect('grading', array_filter(['competition'=>$comp,'order'=>$order]));
}

/* ================= РЕЖИМ ОЦЕНКИ ОДНОЙ ЗАЯВКИ ================= */
if ($id = (int) input('id')) {
    $a = one("SELECT a.*, c.name comp, c.is_paid comp_paid, c.results_mode FROM applications a
              LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$id]);
    if (!$a) { flash('Заявка не найдена.', 'error'); admin_redirect('grading'); }
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
      <a class="btn btn--ghost btn--sm" href="<?= a_link('grading', array_filter(['competition'=>$comp,'order'=>$order])) ?>"><?= admin_icon('back') ?>К очереди</a>
      <span class="small muted"><?= $pos ? 'Заявка ' . $pos . ' из ' . $total . ' в очереди' : 'Заявка вне очереди (редактирование итога)' ?></span>
      <span class="sp"></span>
      <?php if ($prevId): ?><a class="btn btn--ghost btn--sm" href="<?= $prevUrl ?>">← Назад</a><?php endif; ?>
      <?php if ($nextId): ?><a class="btn btn--navy btn--sm" href="<?= $nextUrl ?>">Пропустить →</a><?php endif; ?>
    </div>

    <div class="grid grid-2">
      <div class="card card--pad0" style="padding:14px">
        <?php if ($embed): ?>
          <div class="video-frame"><iframe src="<?= h($embed) ?>" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>
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
          <dt><?= $a['is_group'] ? 'Коллектив' : 'Участник' ?></dt><dd><b><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></b></dd>
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
          <div class="field" style="margin-top:10px;padding:10px 12px;border:1px dashed var(--a-line);border-radius:10px">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
              <input type="checkbox" name="auto_send" id="autoSendChk" value="1" <?= $ovr==='' ? 'checked' : '' ?>>
              <span>Отправить результат автоматически по сроку<br><span class="small muted">3 рабочих дня от даты подачи (вс — нерабочий), окно 9:00–18:00 МСК</span></span>
            </label>
            <div id="sendAtBox" style="margin-top:8px;display:<?= $ovr==='' ? 'none' : 'block' ?>">
              <label class="small muted">Ручная дата и время отправки (override администратора)</label>
              <input type="datetime-local" name="send_at" value="<?= $ovr !== '' ? h(date('Y-m-d\TH:i', strtotime($ovr))) : '' ?>">
            </div>
          </div>
          <button class="btn btn--primary" style="margin-top:8px"><?= admin_icon('check') ?>Сохранить итог и далее</button>
          <?php if ($a['result']): ?>
            <span class="badge badge--gold" style="margin-left:8px"><?= h($a['result']) ?></span>
          <?php endif; ?>
        </form>

        <button type="button" class="btn btn--ghost btn--sm" id="rejectToggle" style="margin-top:14px;color:#8b2f2f;border-color:#d99"><?= admin_icon('x') ?>Отклонить заявку…</button>
        <div class="reject-panel" id="rejectPanel">
          <b>Отклонение заявки по пункту положения</b>
          <p class="small muted" style="margin:4px 0 0">Выберите готовое основание или впишите своё. Участник получит письмо с причиной и предложением исправить и подать заявку заново.</p>
          <div class="rr-chips" id="rrChips"></div>
          <form method="post" action="<?= url('/admin/?p=grading') ?>">
            <?= csrf_field() ?><input type="hidden" name="p" value="grading"><input type="hidden" name="do" value="reject">
            <input type="hidden" name="id" value="<?= $id ?>"><input type="hidden" name="competition" value="<?= $comp ?>"><input type="hidden" name="order" value="<?= h($order) ?>">
            <div class="field">
              <textarea name="reject_reason" id="rejectReason" rows="3" placeholder="Причина отклонения (пункт положения)"><?= h((string)($a['reject_reason'] ?? '')) ?></textarea>
            </div>
            <button class="btn btn--sm" style="background:#8b2f2f;color:#fff" onclick="return confirm('Отклонить заявку и отправить участнику письмо с причиной?')"><?= admin_icon('x') ?>Отклонить и отправить письмо</button>
          </form>
        </div>
        <script>
          (function(){
            // Реальные пункты-основания из эталонных положений (docs/polozheniya).
            var REJECT_REASONS = <?= json_encode(REJECT_REASONS(), JSON_UNESCAPED_UNICODE) ?>;
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

    <?php
      $myVideo = one("SELECT * FROM jury_video WHERE application_id=? AND jury_id=?", [$id, $jid]);
      $allVideos = all("SELECT jv.*, u.full_name jname FROM jury_video jv LEFT JOIN users u ON u.id=jv.jury_id
                        WHERE jv.application_id=? ORDER BY jv.created_at DESC", [$id]);
    ?>
    <div class="card" style="margin-top:18px">
      <h3>Видеорецензия жюри</h3>
      <p class="small muted">Короткий видеокомментарий (30-60 секунд, mp4). Файл прикрепится к диплому участника автоматически.</p>
      <?php if ($myVideo): ?>
        <p class="small"><span class="badge badge--paid">Ваша рецензия загружена</span>
          <a href="<?= h(url($myVideo['path'])) ?>" target="_blank" rel="noopener">открыть видео</a>
          · <?= h(date('d.m.y H:i', strtotime($myVideo['created_at']))) ?> — загрузите новый файл, чтобы заменить.</p>
      <?php endif; ?>
      <form id="videoReviewForm" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <input type="hidden" name="application_id" value="<?= $id ?>">
        <div class="field--inline">
          <input type="file" name="video" accept="video/mp4,.mp4" required>
          <button type="submit" class="btn btn--navy btn--sm"><?= admin_icon('send') ?>Загрузить рецензию</button>
        </div>
        <p class="err-msg" id="videoReviewMsg" style="display:none;margin-top:8px"></p>
      </form>
      <?php if ($allVideos): ?>
        <hr>
        <p class="small muted" style="margin-bottom:6px">Все рецензии по заявке:</p>
        <ul class="small" style="margin:0;padding-left:18px">
          <?php foreach ($allVideos as $v): ?>
            <li><?= h($v['jname'] ?: ('Жюри #' . $v['jury_id'])) ?> —
              <a href="<?= h(url($v['path'])) ?>" target="_blank" rel="noopener">видео</a>
              (<?= h(date('d.m.y H:i', strtotime($v['created_at']))) ?>)</li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>
    </div><!-- /.jury-fast -->
    <script>
    (function(){
      var vform=document.getElementById('videoReviewForm');
      if (vform) {
        vform.addEventListener('submit', function(e){
          e.preventDefault();
          var msg=document.getElementById('videoReviewMsg');
          msg.style.display='none'; msg.textContent='';
          var fd=new FormData(vform);
          fetch('<?= url('/api/v1/jury_video.php') ?>', {method:'POST', body:fd, credentials:'same-origin'})
            .then(function(r){ return r.json(); })
            .then(function(d){
              if (d.ok) { location.reload(); }
              else { msg.textContent = d.error || 'Не удалось загрузить видео.'; msg.style.display='block'; }
            })
            .catch(function(){ msg.textContent='Ошибка сети при загрузке видео.'; msg.style.display='block'; });
        });
      }
    })();
    </script>
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
    admin_layout('Оценивание', $content, 'grading');
    exit;
}

/* ================= ОЧЕРЕДЬ ОЦЕНИВАНИЯ (СПИСОК) ================= */
$comps = all("SELECT id,name,is_paid,results_mode,results_date FROM competitions ORDER BY sort,name");
$compRow = null;
foreach ($comps as $c) if ((int)$c['id'] === $comp) { $compRow = $c; break; }

$show = ($comp && input('show') === 'graded') ? 'graded' : '';
if ($show === 'graded') {
    $rows = all("SELECT a.*, c.name comp, 1 grp_count, 0 grp_pos FROM applications a
                 LEFT JOIN competitions c ON c.id=a.competition_id
                 WHERE a.competition_id=? AND a.result<>'' AND a.status<>'rejected'
                 ORDER BY a.created_at " . ($order === 'new' ? 'DESC' : 'ASC') . ", a.id LIMIT 500", [$comp]);
} else {
    $rows = grading_queue_rows($comp, $order);
}
$qTotal = count($rows);

/* Панель «Итоги конкурса» для длинных бесплатных (results_mode='list' или is_paid=0). */
$isLong = $compRow && (($compRow['results_mode'] ?? '') === 'list' || (int)$compRow['is_paid'] === 0);
$longStats = null;
if ($isLong) {
    $tot = (int) scalar("SELECT COUNT(*) FROM applications WHERE competition_id=? AND status<>'rejected'", [$comp]);
    $done = (int) scalar("SELECT COUNT(*) FROM applications WHERE competition_id=? AND status<>'rejected' AND result<>''", [$comp]);
    $longStats = ['total' => $tot, 'done' => $done, 'pct' => $tot ? (int)round($done / $tot * 100) : 0];
}

$firstId = null;
foreach ($rows as $r) { $firstId = (int)$r['id']; break; }

ob_start(); ?>
<div class="section-title">
  <h2>Оценивание <span class="small muted">(<?= $show === 'graded' ? 'оценено: ' : 'в очереди: ' ?><?= $qTotal ?>)</span></h2>
  <?php if ($firstId && $show === ''): ?>
    <a class="btn btn--primary" href="<?= a_link('grading', array_filter(['id'=>$firstId,'competition'=>$comp,'order'=>$order])) ?>"><?= admin_icon('grading') ?>Начать оценку</a>
  <?php endif; ?>
</div>
<p class="small muted" style="margin:-6px 0 14px">Новые заявки попадают в очередь автоматически. После сохранения итога заявка получает статус «Оценена», после отправки диплома — «Исполнена». Ручные переносы статусов не нужны.</p>

<form method="get" class="filters">
  <input type="hidden" name="p" value="grading"><?php if ($show): ?><input type="hidden" name="show" value="graded"><?php endif; ?>
  <div class="field"><label>Конкурс</label><select name="competition" onchange="this.form.submit()"><option value="">Все конкурсы</option>
    <?php foreach ($comps as $c): ?><option value="<?= $c['id'] ?>" <?= $comp===(int)$c['id']?'selected':'' ?>><?= h($c['name']) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>Порядок</label><select name="order" onchange="this.form.submit()">
    <option value="old" <?= $order==='old'?'selected':'' ?>>Старые → новые</option>
    <option value="new" <?= $order==='new'?'selected':'' ?>>Новые → старые</option>
  </select></div>
</form>

<?php if ($longStats): ?>
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
      <div>
        <h4 style="margin:0 0 4px">Итоги конкурса (бесплатный / длинный)</h4>
        <div class="small">Оценено <b><?= $longStats['done'] ?></b> из <b><?= $longStats['total'] ?></b> <span class="muted">(<?= $longStats['pct'] ?>%)</span>.
          Результаты не рассылаются по одному — копятся до даты публикации<?= !empty($compRow['results_date']) ? ' (' . h(date('d.m.Y', strtotime((string)$compRow['results_date']))) . ')' : ' (28-е число)' ?>. До публикации любой результат можно править.</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn btn--navy btn--sm" href="<?= a_link('grading', ['action'=>'results_csv','competition'=>$comp]) ?>"><?= admin_icon('download') ?>Скачать CSV</a>
        <a class="btn btn--navy btn--sm" target="_blank" href="<?= a_link('grading', ['action'=>'results_html','competition'=>$comp]) ?>"><?= admin_icon('eye') ?>HTML для печати</a>
        <?php if ($show === 'graded'): ?>
          <a class="btn btn--ghost btn--sm" href="<?= a_link('grading', array_filter(['competition'=>$comp,'order'=>$order])) ?>">К очереди неоценённых</a>
        <?php else: ?>
          <a class="btn btn--ghost btn--sm" href="<?= a_link('grading', array_filter(['competition'=>$comp,'order'=>$order,'show'=>'graded'])) ?>"><?= admin_icon('edit') ?>Редактировать результаты</a>
        <?php endif; ?>
      </div>
    </div>
    <div style="height:9px;border-radius:6px;background:var(--a-line);overflow:hidden;margin-top:10px">
      <div style="height:100%;width:<?= $longStats['pct'] ?>%;background:var(--grad-gold);border-radius:6px"></div>
    </div>
  </div>
<?php endif; ?>

<style>
.gq-tbl td{vertical-align:middle}
.gq-tbl .gq-grp{border-left:3px solid var(--a-gold,#8B6F1F)}
.gq-tbl .gq-badge{font-size:.7rem}
</style>
<div class="table-wrap">
  <table class="tbl gq-tbl">
    <thead><tr>
      <th>Участник</th><th>Конкурс</th><th>Конкурсный номер</th><th>Подана</th><th>Статус</th><?php if ($show): ?><th>Результат</th><?php endif; ?><th></th>
    </tr></thead>
    <tbody>
      <?php if (!$rows): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:28px"><?= $show ? 'Оценённых заявок пока нет' : 'Очередь пуста — все заявки оценены' ?></td></tr><?php endif; ?>
      <?php foreach ($rows as $a): ?>
        <tr class="<?= (int)$a['grp_count'] > 1 ? 'gq-grp' : '' ?>">
          <td><b><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></b>
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
          <td><span class="badge badge--<?= h($a['status']) ?>"><?= h(app_status_ru($a['status'])) ?></span></td>
          <?php if ($show): ?><td class="small"><span class="badge badge--gold"><?= h($a['result']) ?></span><?= !empty($a['extra_diploma']) ? '<div class="small muted">'.h($a['extra_diploma']).'</div>' : '' ?></td><?php endif; ?>
          <td><a class="btn btn--primary" href="<?= a_link('grading', array_filter(['id'=>$a['id'],'competition'=>$comp,'order'=>$order])) ?>"><?= admin_icon('grading') ?><?= $show ? 'Изменить' : 'ОЦЕНИТЬ' ?></a></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php
$content = ob_get_clean();
admin_layout('Оценивание', $content, 'grading');
