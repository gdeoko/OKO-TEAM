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

function download_anketa_zip(string $sid) {
    // По умолчанию — красивый HTML/PDF-отчёт (открывается в браузере, печатается в PDF).
    // Для отладки / машинной обработки — старый ZIP+JSON включается флагом ?raw=1.
    if (empty($_GET['raw'])) {
        $key = $_GET['key'] ?? '';
        $qs = 'action=downloadAnketaPdf&id=' . rawurlencode($sid) . '&key=' . rawurlencode((string)$key);
        header('Location: /api.php?' . $qs, true, 302);
        return;
    }
    $a = db_one("SELECT * FROM anketa_submissions WHERE submission_id=? OR id=?", [$sid, (int)$sid]);
    if (!$a) { http_response_code(404); echo 'Анкета не найдена'; return; }
    $sid = $a['submission_id'];
    $answers = json_decode($a['answers'] ?? '[]', true) ?: [];
    $ordered = anketa_ordered($answers);
    $meta = ['submission_id'=>$sid,'client_name'=>$a['client_name'],'service_type'=>$a['service_type'],
             'email'=>$a['email'],'created_at'=>$a['created_at'],'completed_at'=>$a['completed_at']];

    if (!class_exists('ZipArchive')) {   // fallback — отдаём JSON, если zip недоступен
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="anketa_'.$sid.'.json"');
        echo json_encode(['meta'=>$meta,'answers'=>$ordered], JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
        return;
    }

    $zipPath = tempnam(sys_get_temp_dir(), 'anketa_') . '.zip';
    $zip = new ZipArchive();
    $zip->open($zipPath, ZipArchive::CREATE);
    $zip->addFromString('answers.json', json_encode($ordered, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
    $zip->addFromString('answers.txt', anketa_txt($ordered, $meta));
    $zip->addFromString('metadata.json', json_encode($meta, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT));
    // Файлы клиента
    $dir = __DIR__ . "/uploads/$sid";
    if (is_dir($dir)) {
        foreach (glob("$dir/*") as $f) {
            if (is_file($f)) $zip->addFile($f, 'files/' . basename($f));
        }
    }
    $zip->close();

    $safeName = preg_replace('/[^\w\-]+/u', '_', $a['client_name'] ?: 'client');
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="anketa_'.$safeName.'.zip"');
    header('Content-Length: ' . filesize($zipPath));
    readfile($zipPath);
    unlink($zipPath);
}
