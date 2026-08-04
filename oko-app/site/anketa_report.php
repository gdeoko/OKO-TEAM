<?php
// ═══════════════════════════════════════════════════════════════
// OKO — HTML/PDF-отчёт по анкете клиента.
// Открывается через api.php?action=downloadAnketaPdf&id=...&key=admin
// Печать-friendly (A4), с медиа-приложениями, брендированный.
// Отдельный action=anketaFile отдаёт файлы вложений с mime.
// ═══════════════════════════════════════════════════════════════

require_once __DIR__ . '/db.php';

// ── Секции + метки вопросов (полные, из формы /anketa) ──
function ar_sections(): array {
    return [
        'client' => [
            'title' => 'Клиент',
            'items' => [
                'nm'      => 'Имя',
                'company' => 'Компания / бренд',
                'tg'      => 'Telegram',
                'email'   => 'Email',
                'phone'   => 'Телефон',
                'niche'   => 'Ниша · направление',
                'exp'     => 'Опыт в теме',
                'region'  => 'Регион работы',
            ],
        ],
        'service' => [
            'title' => 'Услуга',
            'items' => [
                'service' => 'Выбранная услуга',
            ],
        ],
        'web' => [
            'title' => 'Проект · сайт / бот / приложение',
            'items' => [
                'w_type'         => 'Тип проекта',
                'w_goal'         => 'Основная цель',
                'w_audience'     => 'Целевая аудитория',
                'w_refs'         => 'Референсы',
                'w_content'      => 'Готовые тексты / фото',
                'w_tz'           => 'Готовое ТЗ',
                'w_domain'       => 'Домен',
                'w_integrations' => 'Интеграции',
                'w_mobile'       => 'Мобильная версия',
                'w_multilang'    => 'Многоязычность',
                'w_budget'       => 'Бюджет',
                'w_deadline'     => 'Срок',
            ],
        ],
        'sistema' => [
            'title' => 'Проект · Система Роста',
            'items' => [
                's_audience' => 'Целевая аудитория',
                's_unique'   => 'Уникальность / отличие',
                's_socials'  => 'Соцсети сейчас',
                's_activity' => 'Активность в соцсетях',
                's_income'   => 'Доход в месяц',
                's_goal'     => 'Цель по доходу (3–6 мес)',
                's_tried'    => 'Что уже пробовали',
                's_blockers' => 'Блокеры',
                's_invest'   => 'Готовы инвестировать в мес.',
                's_deadline' => 'Когда нужен результат',
                's_style'    => 'Стиль',
                's_team'     => 'Команда',
            ],
        ],
        'zavod' => [
            'title' => 'Проект · Контент-завод',
            'items' => [
                'z_niche'     => 'Ниша',
                'z_tone'      => 'Тон общения',
                'z_socials'   => 'Соцсети сейчас',
                'z_refs'      => 'Референсы',
                'z_selfshoot' => 'Сниматься сами / нейро',
                'z_count'     => 'Роликов в месяц',
                'z_platforms' => 'Платформы для постинга',
                'z_style'     => 'Фирменный стиль',
                'z_brandtype' => 'Что продвигаем',
                'z_offer'     => 'Основной оффер',
                'z_budget'    => 'Бюджет',
                'z_deadline'  => 'Старт',
            ],
        ],
        'complex' => [
            'title' => 'Проект · Комплекс',
            'items' => [
                'c_services'    => 'Нужные услуги',
                'c_priority'    => 'Что важнее',
                'c_state'       => 'Текущее состояние',
                'c_niche'       => 'Ниша и продукт',
                'c_audience'    => 'Целевая аудитория',
                'c_resources'   => 'Текущие ресурсы',
                'c_competitors' => 'Конкуренты',
                'c_tried'       => 'Что пробовали',
                'c_goal'        => 'Цель',
                'c_process'     => 'Готовность к процессу',
                'c_budget'      => 'Бюджет на проект',
                'c_deadline'    => 'Срок',
            ],
        ],
        'final' => [
            'title' => 'Финал',
            'items' => [
                'extra'    => 'Что ещё важно',
                'contact'  => 'Как удобнее связаться',
                'calltime' => 'Когда удобно созвониться',
                'consent'  => 'Согласие на обработку данных',
            ],
        ],
        // Старый флоу (76 вопросов) — по мотивам anketa_download.php
        'legacy' => [
            'title' => 'Дополнительно (legacy-вопросы)',
            'items' => [
                'q1'=>'Имя','q2'=>'Имя в контенте / псевдоним','q3'=>'Чем занимаешься',
                'q4'=>'Ниша','q4b'=>'Ниша (своя)','q5'=>'Опыт в теме','q6'=>'История',
                'q7'=>'Город и страна','q7b'=>'Email','q7c'=>'Телефон','q7d'=>'Telegram',
                'q8'=>'Уникальность','q9'=>'Что продаёшь','q10'=>'Продукты в планах',
                'q11'=>'Доход сейчас','q12'=>'Цель через 3 мес','q13'=>'Цель через год',
                'q14'=>'Откуда клиенты','q15'=>'Новых клиентов/мес','q16'=>'Средний чек',
                'q17'=>'Подписочная модель','q18-ig'=>'Instagram','q18-tg'=>'Telegram канал',
                'q18-yt'=>'YouTube','q18-tt'=>'TikTok','q18-site'=>'Сайт','q18-vk'=>'ВКонтакте',
                'q19'=>'Подписчики','q20'=>'Приоритетная платформа','q21'=>'Частота публикаций',
                'q22'=>'Что публикуешь','q23'=>'Съёмка','q24'=>'Что заходило','q25'=>'Что не работало',
                'q26'=>'ИИ-инструменты','q27'=>'Язык контента','q28'=>'Логотип','q29'=>'Фирменные цвета',
                'q30'=>'Стиль визуала','q31'=>'Референсы аккаунтов','q32'=>'Стиль общения',
                'q33'=>'Фото/видео качество','q34'=>'Фото для аватара','q35'=>'Идеальный клиент',
                'q36'=>'Проблема клиента','q37'=>'Конкуренты','q38'=>'Отличие','q39'=>'Возражения',
                'q40'=>'Что говорят клиенты','q41'=>'Цифры результатов','q42'=>'Команда',
                'q43'=>'Менеджер продаж','q44'=>'Бюджет продвижения','q45'=>'Часов в день',
                'q46'=>'Сервисы','q46b'=>'Съёмка пакетами','q47'=>'Период системы','q48'=>'Главная цель',
                'q49'=>'Что мешало','q50'=>'Что не сработало','q51'=>'Мечта 1–3 года','q52'=>'Что важно',
                'q53'=>'Способы оплаты','q54'=>'Telegram для клиентов','q55'=>'Время публикаций',
                'q56'=>'Типичное время','q57'=>'Отзывы','q58'=>'Сильные цифры','q59'=>'Частые вопросы',
                'q60'=>'ФИО для договора','q61'=>'Город регистрации','q62'=>'Гарантии','q63'=>'Лид-магниты',
                'q64'=>'Ограничения по местам',
                'qX1'=>'Название проекта','qX1b'=>'Название (своё)','qX2'=>'Стиль общения (ты/вы)',
                'qX3'=>'Фирменные фразы','qX4'=>'Входной продукт','qX5'=>'Правовая форма',
                'qX5b'=>'Правовая форма (своя)','qX6'=>'HeyGen','qX7'=>'Часовой пояс','qX8'=>'Готовый контент',
                'qFINAL-text'=>'Дополнение клиента',
            ],
        ],
    ];
}

function ar_service_label(string $svc): string {
    $map = [
        'sistema'=>'Система Роста', 'web'=>'Сайт / Бот / Приложение',
        'zavod'=>'Контент-завод', 'complex'=>'Комплексное продвижение',
    ];
    return $map[$svc] ?? $svc;
}

// Fallback-словарь для «сиротских» ключей: пытаемся понять «Вопрос N» → человек.
function ar_guess_label(string $key): string {
    // прямое соответствие с q-номерами уже вернёт секция legacy; сюда попадают экзотика.
    if (preg_match('/^q(\d+)([a-z]*)$/i', $key, $m)) {
        return 'Вопрос ' . $m[1] . ($m[2] ? ' · ' . strtolower($m[2]) : '');
    }
    $guess = [
        'nm'=>'Имя','name'=>'Имя','company'=>'Компания','tg'=>'Telegram','email'=>'Email',
        'phone'=>'Телефон','niche'=>'Ниша','exp'=>'Опыт','region'=>'Регион','service'=>'Услуга',
        'files'=>'Файлы','extra'=>'Дополнительно','contact'=>'Способ связи',
        'calltime'=>'Время созвона','consent'=>'Согласие',
    ];
    if (isset($guess[$key])) return $guess[$key];
    return $key; // как есть
}

function ar_norm_answer($v): string {
    if (is_array($v)) {
        $parts = [];
        foreach ($v as $x) $parts[] = is_scalar($x) ? (string)$x : json_encode($x, JSON_UNESCAPED_UNICODE);
        $v = implode(' · ', $parts);
    }
    $s = (string)$v;
    $s = str_replace('|||', ' · ', $s);
    // Спец-случаи
    if ($s === '1' || $s === 1) $s = 'Да';
    return trim($s);
}

function ar_esc($v): string {
    return htmlspecialchars((string)$v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

// SVG-иконки бренда (лайм / чёрный) — без эмодзи.
function ar_icon(string $name, int $size = 18): string {
    $ico = [
        'user'    => '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-3.3 0-8 1.7-8 5v3h16v-3c0-3.3-4.7-5-8-5Z"/>',
        'company' => '<path d="M4 21V7l7-4 7 4v14h-5v-6H9v6H4Z"/>',
        'target'  => '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a6 6 0 1 1 0 12 6 6 0 0 1 0-12Zm0 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z"/>',
        'money'   => '<path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm.9 14v1.4h-1.8V17c-1.7-.2-3-1.1-3.3-2.6l1.8-.5c.2 1 .9 1.5 1.9 1.5s1.6-.4 1.6-1c0-.6-.5-.9-2-1.3-1.9-.4-3-1.1-3-2.7 0-1.4 1-2.4 2.9-2.7V6.3h1.8v1.4c1.7.3 2.7 1.2 3 2.4l-1.8.5c-.2-.6-.7-1.1-1.7-1.1s-1.6.4-1.6.9c0 .5.5.8 2 1.1 2 .5 3.1 1.2 3.1 2.9 0 1.5-1 2.5-2.9 2.7Z"/>',
        'file'    => '<path d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1v6h6"/>',
        'photo'   => '<path d="M4 5h4l2-2h4l2 2h4v14H4V5Zm8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/>',
        'audio'   => '<path d="M12 3v10.5A3.5 3.5 0 1 1 10 10V6h6V3h-4Z"/>',
        'video'   => '<path d="M3 5h13v14H3V5Zm14 4 4-3v11l-4-3V9Z"/>',
        'stamp'   => '<path d="M12 2 8 8h3v4l-6 3v3h14v-3l-6-3V8h3l-4-6Z"/>',
        'note'    => '<path d="M4 4h16v13l-5 5H4V4Zm11 18v-5h5"/>',
        'clock'   => '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.5 5H11v6l5 3 .8-1.2-4.3-2.6V7Z"/>',
    ];
    $body = $ico[$name] ?? $ico['note'];
    return '<svg class="ico" width="'.$size.'" height="'.$size.'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'.$body.'</svg>';
}

// Возвращает inline data: URI, либо путь через сам сайт с ключом (для тяжёлых видео/аудио).
function ar_file_src(array $file, string $key): string {
    $abs = __DIR__ . ($file['path'] ?? '');
    $mime = $file['mime'] ?? 'application/octet-stream';
    $size = (int)($file['size_bytes'] ?? (is_file($abs) ? filesize($abs) : 0));
    // Инлайним только лёгкие картинки (<= 1.5 МБ) — так PDF из «Сохранить как PDF» не сломается.
    if (strpos($mime, 'image/') === 0 && $size > 0 && $size <= 1500000 && is_file($abs)) {
        $b = file_get_contents($abs);
        if ($b !== false) return 'data:' . $mime . ';base64,' . base64_encode($b);
    }
    // Остальное отдаём через защищённый endpoint (виден в браузере при просмотре отчёта).
    return './api.php?action=anketaFile&id=' . (int)$file['id'] . '&key=' . rawurlencode($key);
}

function ar_render_media(array $files, string $key): string {
    if (!$files) return '';
    $out = '<section class="sec"><div class="sec-h">'.ar_icon('file').'<h2>Приложенные файлы</h2><span class="count">'.count($files).'</span></div><div class="media-grid">';
    foreach ($files as $f) {
        $mime = $f['mime'] ?? '';
        $name = ar_esc($f['filename'] ?? 'файл');
        $size = (int)($f['size_bytes'] ?? 0);
        $kb   = $size ? number_format($size/1024, 1, '.', ' ') . ' КБ' : '';
        $src  = ar_file_src($f, $key);
        $card = '<figure class="media">';
        if (strpos($mime, 'image/') === 0) {
            $card .= '<div class="media-view"><img src="'.$src.'" alt="'.$name.'"></div>';
            $label = ar_icon('photo').' '.$name;
        } elseif (strpos($mime, 'audio/') === 0) {
            $card .= '<div class="media-view audio"><audio controls preload="none" src="'.$src.'"></audio></div>';
            $label = ar_icon('audio').' '.$name;
        } elseif (strpos($mime, 'video/') === 0) {
            $card .= '<div class="media-view"><video controls preload="metadata" src="'.$src.'"></video></div>';
            $label = ar_icon('video').' '.$name;
        } else {
            $card .= '<div class="media-view file-view"><a href="'.$src.'" target="_blank" rel="noopener">Открыть файл</a></div>';
            $label = ar_icon('file').' '.$name;
        }
        $card .= '<figcaption>'.$label.' <span class="sz">'.$kb.'</span></figcaption></figure>';
        $out .= $card;
    }
    $out .= '</div></section>';
    return $out;
}

function ar_kv_row(string $q, string $ans): string {
    $isLong = mb_strlen($ans) > 90;
    $ansHtml = nl2br(ar_esc($ans));
    return '<div class="row'.($isLong?' long':'').'"><div class="q">'.ar_esc($q).'</div><div class="a">'.$ansHtml.'</div></div>';
}

function ar_render_section(string $title, array $labels, array &$answers, string $iconName = 'note'): string {
    $rows = '';
    foreach ($labels as $k => $label) {
        if (!array_key_exists($k, $answers)) continue;
        $val = ar_norm_answer($answers[$k]);
        if ($val === '') continue;
        if ($k === 'service') $val = ar_service_label($val);
        $rows .= ar_kv_row($label, $val);
        unset($answers[$k]); // помечаем как показанный
    }
    if ($rows === '') return '';
    return '<section class="sec"><div class="sec-h">'.ar_icon($iconName).'<h2>'.ar_esc($title).'</h2></div><div class="rows">'.$rows.'</div></section>';
}

function render_anketa_report(string $sid): void {
    $a = db_one("SELECT * FROM anketa_submissions WHERE submission_id=? OR id=?", [$sid, (int)$sid]);
    if (!$a) { http_response_code(404); header('Content-Type: text/html; charset=UTF-8'); echo '<h1>Анкета не найдена</h1>'; return; }
    $sid = $a['submission_id'];
    $answers = json_decode($a['answers'] ?? '[]', true) ?: [];
    // отбрасываем служебные __
    foreach (array_keys($answers) as $k) if (strpos($k, '__') === 0) unset($answers[$k]);

    $files = db_all("SELECT id, filename, path, mime, size_bytes FROM anketa_files WHERE submission_id=? ORDER BY id", [$sid]);
    $C = cfg();
    $key = $_GET['key'] ?? ($_SERVER['HTTP_X_ADMIN_KEY'] ?? '');

    $client = $a['client_name'] ?: '—';
    $service = ar_service_label($a['service_type'] ?? '');
    $created = $a['created_at'] ?? '';
    $completed = $a['completed_at'] ?? '';
    $progress = (int)$a['progress'];
    $total = (int)$a['total'];
    $pct = $total ? round($progress * 100 / $total) : ($a['complete'] ? 100 : 0);

    $sections = ar_sections();
    $body = '';
    $body .= ar_render_section($sections['client']['title'],  $sections['client']['items'],  $answers, 'user');
    $body .= ar_render_section($sections['service']['title'], $sections['service']['items'], $answers, 'target');
    // Показать блок соответствующей услуги, если ключи есть.
    $svc = $a['service_type'] ?: '';
    if (isset($sections[$svc])) {
        $body .= ar_render_section($sections[$svc]['title'], $sections[$svc]['items'], $answers, 'target');
    }
    // Другие ветки — если вдруг есть данные (клиент менял услугу и часть ответов осталась).
    foreach (['web','sistema','zavod','complex'] as $branch) {
        if ($branch === $svc) continue;
        $body .= ar_render_section($sections[$branch]['title'], $sections[$branch]['items'], $answers, 'target');
    }
    $body .= ar_render_section($sections['final']['title'],  $sections['final']['items'],  $answers, 'note');
    $body .= ar_render_section($sections['legacy']['title'], $sections['legacy']['items'], $answers, 'note');
    // остатки (незамапленные ключи) в конец
    if ($answers) {
        $rest = [];
        foreach ($answers as $k => $v) $rest[$k] = ar_guess_label($k);
        $body .= ar_render_section('Прочие ответы', $rest, $answers, 'note');
    }

    $mediaBlock = ar_render_media($files, (string)$key);

    // Верхние KPI-плашки
    $kpiSvc = ar_esc($service ?: '—');
    $kpiProg = $pct.'%';
    $kpiFiles = count($files);
    $completedNice = $completed ? date('d.m.Y H:i', strtotime($completed)) : '—';
    $createdNice = $created ? date('d.m.Y H:i', strtotime($created)) : '—';

    header('Content-Type: text/html; charset=UTF-8');
    header('Content-Disposition: inline; filename="anketa_'.preg_replace('/[^\w\-]+/u','_',$client).'.html"');
    header('X-Content-Type-Options: nosniff');
    ?><!DOCTYPE html>
<html lang="ru" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Бриф · <?=ar_esc($client)?> · OKO TEAM</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --lime:#9AFF00; --ink:#0b0b0b; --paper:#ffffff; --muted:#6b6b6b;
    --line:#e6e6e6; --line-soft:#f2f2f2; --accent:#0b0b0b;
    --serif:'Georgia','Times New Roman',serif;
    --sans:'Montserrat',system-ui,-apple-system,sans-serif;
    --disp:'Bebas Neue','Impact',sans-serif;
  }
  @media (prefers-color-scheme: dark){
    :root[data-theme="auto"]{ --ink:#f4f4f4; --paper:#0b0b0b; --muted:#a9a9a9; --line:#232323; --line-soft:#161616; }
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--paper);color:var(--ink);
    font-family:var(--serif);font-size:12pt;line-height:1.55;-webkit-font-smoothing:antialiased}
  .toolbar{position:sticky;top:0;background:#0b0b0b;color:#fff;padding:10px 20px;display:flex;
    align-items:center;justify-content:space-between;gap:12px;font-family:var(--sans);font-size:12px;z-index:20}
  .toolbar .brand{display:flex;align-items:center;gap:10px}
  .toolbar .brand b{font-family:var(--disp);letter-spacing:1.5px;font-size:16px}
  .toolbar .brand b span{color:var(--lime)}
  .toolbar button{background:var(--lime);color:#000;border:0;padding:8px 16px;border-radius:8px;
    font-family:var(--sans);font-weight:700;font-size:12px;cursor:pointer;letter-spacing:.3px}
  .toolbar button:hover{filter:brightness(.94)}
  .page{max-width:820px;margin:0 auto;padding:32px 40px 60px}
  header.doc{border-bottom:2px solid var(--ink);padding-bottom:22px;margin-bottom:26px;
    display:grid;grid-template-columns:auto 1fr auto;gap:24px;align-items:flex-end}
  header.doc .logo{width:72px;height:72px;display:block;object-fit:contain}
  header.doc .titles{min-width:0}
  header.doc .kicker{font-family:var(--sans);font-size:10px;letter-spacing:2.6px;color:var(--muted);text-transform:uppercase;margin-bottom:6px}
  header.doc h1{font-family:var(--disp);font-weight:400;font-size:44px;line-height:.96;letter-spacing:.5px;margin:0 0 8px}
  header.doc h1 em{font-style:normal;color:var(--lime);background:linear-gradient(180deg,transparent 60%, #eaffb0 60%);padding:0 6px}
  header.doc .sub{font-family:var(--sans);font-size:12px;color:var(--muted);letter-spacing:.4px}
  header.doc .meta{text-align:right;font-family:var(--sans);font-size:11px;color:var(--muted);line-height:1.6}
  header.doc .meta b{color:var(--ink);font-family:var(--disp);font-size:16px;letter-spacing:1px;display:block;margin-top:2px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:22px 0 30px}
  .kpi{border:1px solid var(--line);border-radius:14px;padding:14px 16px}
  .kpi .k{font-family:var(--sans);font-size:9.5px;letter-spacing:1.6px;color:var(--muted);text-transform:uppercase;margin-bottom:6px}
  .kpi .v{font-family:var(--disp);font-size:26px;letter-spacing:.6px;line-height:1;color:var(--ink)}
  .kpi.hi{background:var(--lime);border-color:var(--lime)}
  .kpi.hi .k{color:#000c}
  .kpi.hi .v{color:#000}
  .sec{border:1px solid var(--line);border-radius:16px;padding:18px 22px 6px;margin:0 0 18px;break-inside:avoid}
  .sec-h{display:flex;align-items:center;gap:10px;padding-bottom:12px;border-bottom:1px solid var(--line-soft);margin-bottom:8px}
  .sec-h .ico{color:var(--ink);flex:0 0 auto}
  .sec-h h2{margin:0;font-family:var(--disp);font-size:22px;font-weight:400;letter-spacing:1.2px;color:var(--ink)}
  .sec-h .count{margin-left:auto;background:var(--lime);color:#000;font-family:var(--sans);font-weight:700;
    font-size:11px;padding:3px 10px;border-radius:999px;letter-spacing:.3px}
  .rows{display:grid;grid-template-columns:1fr 2fr;gap:0}
  .row{display:contents}
  .row .q{padding:12px 14px 12px 0;font-family:var(--sans);font-size:11px;color:var(--muted);
    text-transform:uppercase;letter-spacing:1.2px;border-bottom:1px solid var(--line-soft);vertical-align:top}
  .row .a{padding:12px 0;font-family:var(--serif);font-size:12.5pt;color:var(--ink);
    border-bottom:1px solid var(--line-soft);word-wrap:break-word;overflow-wrap:anywhere;white-space:pre-wrap}
  .row.long .a{font-size:12pt;line-height:1.6}
  .rows > .row:last-child .q, .rows > .row:last-child .a{border-bottom:none}
  .media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;padding:6px 0 14px}
  .media{margin:0;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--paper);break-inside:avoid}
  .media .media-view{background:#f6f6f6;display:flex;align-items:center;justify-content:center;min-height:150px;padding:0}
  .media .media-view img{max-width:100%;max-height:280px;display:block;object-fit:contain}
  .media .media-view audio,.media .media-view video{width:100%;max-height:220px;display:block}
  .media .media-view.audio{padding:26px 16px}
  .media .media-view.file-view a{font-family:var(--sans);font-weight:600;color:var(--ink);text-decoration:none;padding:14px 16px;display:inline-block}
  .media figcaption{font-family:var(--sans);font-size:11px;color:var(--muted);padding:8px 12px;
    display:flex;align-items:center;gap:6px;border-top:1px solid var(--line-soft);word-break:break-all}
  .media figcaption .ico{color:var(--ink);flex:0 0 auto}
  .media figcaption .sz{margin-left:auto;color:#999;font-size:10.5px}
  .notes{border:1px dashed var(--line);border-radius:14px;padding:16px 20px;min-height:140px;
    font-family:var(--serif);font-size:12pt;color:var(--muted);line-height:2}
  .notes .lines{background:repeating-linear-gradient(to bottom, transparent 0, transparent 30px, #f2f2f2 30px, #f2f2f2 31px);height:150px;margin-top:6px}
  footer.doc{margin-top:40px;padding-top:22px;border-top:2px solid var(--ink);
    display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center}
  footer.doc .req{font-family:var(--sans);font-size:11px;color:var(--muted);line-height:1.7}
  footer.doc .req b{color:var(--ink);font-family:var(--disp);letter-spacing:1px;font-size:14px;display:block;margin-bottom:4px}
  .stamp{width:120px;height:120px;border-radius:50%;border:2px solid var(--ink);
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    text-align:center;font-family:var(--disp);letter-spacing:1.2px;color:var(--ink);
    transform:rotate(-6deg);opacity:.85;position:relative}
  .stamp b{font-size:20px;line-height:1;display:block}
  .stamp span{font-size:9px;color:var(--muted);letter-spacing:2px;margin-top:6px;font-family:var(--sans);font-weight:700}
  .stamp svg{position:absolute;top:8px;color:var(--ink)}
  .print-note{font-family:var(--sans);font-size:11px;color:#999;margin-top:24px;text-align:center}
  @media print{
    .toolbar,.print-note{display:none !important}
    body{background:#fff}
    .page{max-width:none;padding:12mm 14mm}
    .sec,.media,.kpi{break-inside:avoid;page-break-inside:avoid}
    header.doc{margin-bottom:16px}
    a{color:inherit;text-decoration:none}
  }
  @page{size:A4 portrait;margin:16mm}
</style>
</head>
<body>
  <div class="toolbar">
    <div class="brand">
      <b>ОКО<span>·TEAM</span></b>
      <span style="opacity:.65">Бриф клиента · <?=ar_esc($sid)?></span>
    </div>
    <button onclick="window.print()">Скачать / Печать PDF</button>
  </div>

  <div class="page">
    <header class="doc">
      <img class="logo" src="./oko-logo-256.png" alt="OKO">
      <div class="titles">
        <div class="kicker">OKO TEAM · Client brief</div>
        <h1>Бриф <em>от клиента</em></h1>
        <div class="sub"><?=ar_esc($client)?> · <?=ar_esc($service)?></div>
      </div>
      <div class="meta">
        Отправлено<br><b><?=ar_esc($createdNice)?></b>
      </div>
    </header>

    <div class="kpis">
      <div class="kpi hi">
        <div class="k">Услуга</div>
        <div class="v"><?=$kpiSvc?></div>
      </div>
      <div class="kpi">
        <div class="k">Заполнено</div>
        <div class="v"><?=$kpiProg?></div>
      </div>
      <div class="kpi">
        <div class="k">Ответов</div>
        <div class="v"><?=$progress?>/<?=$total?:'—'?></div>
      </div>
      <div class="kpi">
        <div class="k">Файлов</div>
        <div class="v"><?=$kpiFiles?></div>
      </div>
    </div>

    <?=$body?>

    <?=$mediaBlock?>

    <section class="sec">
      <div class="sec-h"><?=ar_icon('note')?><h2>Комментарии команды OKO</h2></div>
      <div class="notes">
        Место для заметок менеджера: договорённости, сроки, следующий шаг.
        <div class="lines"></div>
      </div>
    </section>

    <footer class="doc">
      <div class="req">
        <b>OKO TEAM</b>
        Даниэль · @ktodaniel · okoteam.top@gmail.com<br>
        okoteam.top · производственная команда полного цикла<br>
        Бриф получен: <?=ar_esc($createdNice)?> · Завершён: <?=ar_esc($completedNice)?>
      </div>
      <div class="stamp">
        <?=ar_icon('stamp', 22)?>
        <b>OKO</b>
        <span>TEAM · <?=date('Y')?></span>
      </div>
    </footer>

    <div class="print-note">Ctrl / Cmd + P → «Сохранить как PDF» — для отправки клиенту.</div>
  </div>
</body>
</html>
    <?php
}

// Отдача файла (image/audio/video) для рендера в отчёте.
function serve_anketa_file(int $id): void {
    $f = db_one("SELECT filename, path, mime, size_bytes FROM anketa_files WHERE id=?", [$id]);
    if (!$f) { http_response_code(404); echo 'File not found'; return; }
    $abs = __DIR__ . ($f['path'] ?? '');
    if (!is_file($abs)) { http_response_code(404); echo 'File missing on disk'; return; }
    $mime = $f['mime'] ?: 'application/octet-stream';
    header('Content-Type: '.$mime);
    header('Content-Length: '.filesize($abs));
    header('Content-Disposition: inline; filename="'.rawurlencode($f['filename'] ?? 'file').'"');
    header('Cache-Control: private, max-age=300');
    header('X-Content-Type-Options: nosniff');
    readfile($abs);
}
