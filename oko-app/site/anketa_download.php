<?php
// ═══════════════════════════════════════════════════════════════
// Скачивание анкеты как ZIP: answers.json (по порядку флоу),
// answers.txt (читаемо), files/ (вложения клиента), metadata.json.
// Фикс из ТЗ: файлы попадают в архив, вопросы в правильном порядке.
// ═══════════════════════════════════════════════════════════════
require_once __DIR__ . '/db.php';

// Метки вопросов в порядке флоу (старые 76 + новые ключи). Порядок = порядок вывода.
function anketa_qlabels(): array {
    return [
        'q1'=>'Имя','q2'=>'Имя в контенте / псевдоним','q3'=>'Чем занимаешься',
        'q4'=>'Ниша','q4b'=>'Ниша (своя)','q5'=>'Опыт в теме','q6'=>'История',
        'q7'=>'Город и страна','q7b'=>'Email','q7c'=>'Телефон','q7d'=>'Telegram',
        'q8'=>'Уникальность как эксперта','q9'=>'Что продаёшь сейчас','q10'=>'Продукты в планах',
        'q11'=>'Доход сейчас','q12'=>'Цель через 3 месяца','q13'=>'Цель через год',
        'q14'=>'Откуда приходят клиенты','q15'=>'Новых клиентов в месяц','q16'=>'Средний чек (₽)',
        'q17'=>'Подписочная модель / клуб','q18-ig'=>'Instagram','q18-tg'=>'Telegram канал',
        'q18-yt'=>'YouTube','q18-tt'=>'TikTok','q18-site'=>'Сайт','q18-vk'=>'ВКонтакте',
        'q19'=>'Подписчики по платформам','q20'=>'Приоритетная платформа','q21'=>'Частота публикаций',
        'q22'=>'Что публикуешь','q23'=>'Съёмка','q24'=>'Контент который заходил','q25'=>'Что не работало',
        'q26'=>'ИИ-инструменты','q27'=>'Язык контента','q28'=>'Логотип','q29'=>'Фирменные цвета',
        'q30'=>'Стиль визуала','q31'=>'Референсы аккаунтов','q32'=>'Стиль общения','q33'=>'Фото/видео качество',
        'q34'=>'Фото для аватара','q35'=>'Идеальный клиент','q36'=>'Проблема и желание клиента',
        'q37'=>'Конкуренты','q38'=>'Отличие от конкурентов','q39'=>'Возражения','q40'=>'Что говорят клиенты',
        'q41'=>'Цифры результатов','q42'=>'Команда','q43'=>'Менеджер продаж','q44'=>'Бюджет на продвижение',
        'q45'=>'Часов в день на контент','q46'=>'Сервисы','q46b'=>'Съёмка пакетами','q47'=>'Период системы',
        'q48'=>'Главная цель','q49'=>'Что мешало расти','q50'=>'Что не сработало','q51'=>'Мечта на 1-3 года',
        'q52'=>'Что ещё важно','q53'=>'Способы оплаты','q54'=>'Telegram для клиентов','q55'=>'Время публикаций',
        'q56'=>'Типичное время','q57'=>'Отзывы','q58'=>'Сильные цифры','q59'=>'Частые вопросы',
        'q60'=>'ФИО для договора','q61'=>'Город регистрации','q62'=>'Гарантии','q63'=>'Идеи лид-магнитов',
        'q64'=>'Ограничения по местам',
        'qX1'=>'Название проекта','qX1b'=>'Название (своё)','qX2'=>'Стиль общения (ты/вы)','qX3'=>'Фирменные фразы',
        'qX4'=>'Входной продукт','qX5'=>'Правовая форма','qX5b'=>'Правовая форма (своя)','qX6'=>'HeyGen',
        'qX7'=>'Часовой пояс','qX8'=>'Готовый контент','qFINAL-text'=>'Дополнение клиента',
        // Поля текущего флоу анкеты: без них ответы уезжали в конец без названий.
        'nm'=>'Имя','email'=>'Email','service'=>'Услуга','links'=>'Ссылки клиента',
        'extra'=>'Что ещё важно','contact'=>'Как связаться','calltime'=>'Удобное время',
        'files_uploaded'=>'Файлы в архиве',
    ];
}

function anketa_ordered(array $answers): array {
    $labels = anketa_qlabels();
    $ordered = [];
    foreach ($labels as $k => $label) {
        if (isset($answers[$k]) && $answers[$k] !== '' && $answers[$k] !== null) {
            $ordered[$k] = ['question' => $label, 'answer' => $answers[$k]];
        }
    }
    // Ключи, которых нет в карте — в конец (кроме служебных __)
    foreach ($answers as $k => $v) {
        if (strpos($k, '__') === 0) continue;
        if (!isset($ordered[$k]) && $v !== '' && $v !== null) {
            $ordered[$k] = ['question' => $k, 'answer' => $v];
        }
    }
    return $ordered;
}

// Windows открывает .txt в cp1251, если в начале нет метки кодировки, и русский
// текст превращается в набор символов — именно это владелец и видел, скачав
// анкету. Метка UTF-8 (BOM) в начале файла лечит это во всех редакторах.
const UTF8_BOM = "\xEF\xBB\xBF";

function anketa_txt(array $ordered, array $meta): string {
    $t = "АНКЕТА OKO — {$meta['client_name']}\n";
    $t .= "Услуга: {$meta['service_type']} · {$meta['created_at']}\n";
    $t .= str_repeat('=', 50) . "\n\n";
    foreach ($ordered as $row) {
        $ans = is_array($row['answer']) ? implode(', ', $row['answer']) : (string)$row['answer'];
        $ans = str_replace('|||', ' · ', $ans);
        $t .= $row['question'] . ":\n" . trim($ans) . "\n\n";
    }
    return $t;
}

function human_size(int $b): string {
    if ($b >= 1048576) return round($b / 1048576, 1) . ' МБ';
    return max(1, (int)round($b / 1024)) . ' КБ';
}

// Читаемая анкета: открывается двойным кликом, ничего не устанавливая.
// Фото видно, видео и голосовые играют — раньше вложения лежали мёртвым грузом
// в папке, и владелец не понимал, пришли они вообще или нет.
function anketa_html(array $ordered, array $meta, array $files): string {
    $esc = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
    $rows = '';
    foreach ($ordered as $row) {
        $ans = is_array($row['answer']) ? implode(', ', $row['answer']) : (string)$row['answer'];
        $ans = str_replace('|||', ' · ', trim($ans));
        if ($ans === '') continue;
        $val = nl2br($esc($ans));
        $val = preg_replace('#(https?://[^\s<]+)#u', '<a href="$1">$1</a>', $val);
        $rows .= '<div class="r"><div class="q">' . $esc($row['question']) . '</div>'
               . '<div class="a">' . $val . '</div></div>';
    }
    $media = '';
    foreach ($files as $f) {
        $n = $esc($f['name']);
        $src = 'files/' . rawurlencode($f['name']);
        $ext = strtolower(pathinfo($f['name'], PATHINFO_EXTENSION));
        if (in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'])) {
            $body = '<img src="' . $src . '" alt="' . $n . '">';
        // .webm бывает и видео, и голосовым — различаем по имени, которое даёт
        // диктофон анкеты, иначе голосовое открывается чёрным прямоугольником.
        } elseif (in_array($ext, ['mp3', 'ogg', 'oga', 'wav', 'm4a', 'opus'])
                  || ($ext === 'webm' && preg_match('/golosov|voice|audio/i', $f['name']))) {
            $body = '<audio src="' . $src . '" controls></audio>';
        } elseif (in_array($ext, ['mp4', 'mov', 'webm', 'm4v'])) {
            $body = '<video src="' . $src . '" controls preload="metadata"></video>';
        } else {
            $body = '<a class="dl" href="' . $src . '">скачать файл</a>';
        }
        $media .= '<figure><figcaption>' . $n . ' · ' . human_size((int)$f['size'])
                . '</figcaption>' . $body . '</figure>';
    }
    $mediaBlock = $files
        ? '<h2>Вложения — ' . count($files) . '</h2><div class="media">' . $media . '</div>'
        : '<h2>Вложения</h2><p class="none">Клиент ничего не прикрепил.</p>';
    return '<!doctype html><html lang="ru"><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>Анкета — ' . $esc($meta['client_name']) . '</title><style>'
        . 'body{margin:0;padding:28px 18px;background:#0d0d0d;color:#eaeaea;'
        . 'font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}'
        . '.w{max-width:820px;margin:0 auto}h1{font-size:24px;margin:0 0 4px}'
        . '.sub{color:#9a9a9a;margin-bottom:26px}h2{font-size:17px;margin:34px 0 12px;color:#9AFF00}'
        . '.r{padding:11px 0;border-bottom:1px solid #1f1f1f}'
        . '.q{color:#8f8f8f;font-size:13px;margin-bottom:3px}.a{white-space:normal}'
        . 'a{color:#9AFF00}.none{color:#8f8f8f}'
        . '.media{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}'
        . 'figure{margin:0;background:#151515;border-radius:10px;padding:10px}'
        . 'figcaption{font-size:12px;color:#9a9a9a;margin-bottom:8px;word-break:break-all}'
        . 'img,video{width:100%;border-radius:6px;display:block}audio{width:100%}'
        . '.dl{display:inline-block;padding:8px 12px;background:#1f1f1f;border-radius:6px}'
        . '</style><div class="w"><h1>' . $esc($meta['client_name'] ?: 'Анкета') . '</h1>'
        . '<div class="sub">' . $esc($meta['service_type']) . ' · ' . $esc($meta['created_at'])
        . ' · ' . $esc($meta['submission_id']) . '</div>'
        . '<h2>Ответы</h2>' . $rows . $mediaBlock . '</div></html>';
}

function download_anketa_zip(string $sid) {
    $a = db_one("SELECT * FROM anketa_submissions WHERE submission_id=? OR id=?", [$sid, (int)$sid]);
    if (!$a) { http_response_code(404); echo 'Анкета не найдена'; return; }
    $sid = $a['submission_id'];
    $answers = json_decode($a['answers'] ?? '[]', true) ?: [];
    $ordered = anketa_ordered($answers);
    $meta = ['submission_id'=>$sid,'client_name'=>$a['client_name'],'service_type'=>$a['service_type'],
             'email'=>$a['email'],'created_at'=>$a['created_at'],'completed_at'=>$a['completed_at']];

    // Если на сервере нет расширения zip, архив не собрать. Раньше в этом случае
    // уходил сырой JSON — владелец видел «просто символы» и ни одного вложения,
    // и выглядело это как сломанная анкета. Теперь отдаём читаемую страницу со
    // ссылками на файлы: она открывается, даже когда собрать архив нечем.
    if (!class_exists('ZipArchive')) {
        $dir = __DIR__ . "/uploads/$sid";
        $files = [];
        if (is_dir($dir)) foreach (glob("$dir/*") as $f) {
            if (is_file($f)) $files[] = ['path'=>$f, 'name'=>basename($f), 'size'=>filesize($f)];
        }
        $html = anketa_html($ordered, $meta, $files);
        // файлы лежат на сайте, а не рядом со страницей — чиним пути
        $html = str_replace('"files/', '"/uploads/' . rawurlencode($sid) . '/', $html);
        header('Content-Type: text/html; charset=utf-8');
        echo $html;
        return;
    }

    // Файлы клиента собираем ДО архива: их список нужен и в HTML, и в описи.
    $dir = __DIR__ . "/uploads/$sid";
    $files = [];
    if (is_dir($dir)) {
        foreach (glob("$dir/*") as $f) {
            if (is_file($f)) $files[] = ['path' => $f, 'name' => basename($f),
                                         'size' => filesize($f)];
        }
    }

    $zipPath = tempnam(sys_get_temp_dir(), 'anketa_') . '.zip';
    $zip = new ZipArchive();
    $zip->open($zipPath, ZipArchive::CREATE);
    // Главный файл архива — HTML: он открывается двойным кликом в любой системе,
    // показывает фото, проигрывает видео и голосовые прямо из папки files/.
    $zip->addFromString('АНКЕТА.html', anketa_html($ordered, $meta, $files));
    $zip->addFromString('answers.json', json_encode($ordered, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
    $zip->addFromString('answers.txt', UTF8_BOM . anketa_txt($ordered, $meta));
    $zip->addFromString('metadata.json', json_encode($meta, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
    foreach ($files as $f) $zip->addFile($f['path'], 'files/' . $f['name']);
    $zip->close();

    $safeName = preg_replace('/[^\w\-]+/u', '_', $a['client_name'] ?: 'client');
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="anketa_'.$safeName.'.zip"');
    header('Content-Length: ' . filesize($zipPath));
    readfile($zipPath);
    unlink($zipPath);
}
