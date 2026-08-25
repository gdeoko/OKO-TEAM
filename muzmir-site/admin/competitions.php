<?php
/** Конкурсы: премиум-CRUD, черновики, копирование, прайс наград, номинации,
 *  обложка, тема/фон диплома, генерация положения-PDF, статусы, предпросмотр. */
declare(strict_types=1);

/* Мягкая миграция: формат конкурса (длинный/короткий) — влияет на автодаты результатов. */
try { q("ALTER TABLE competitions ADD COLUMN duration TEXT DEFAULT 'long'"); } catch (\Throwable $e) {}

require_once BASE_PATH . '/core/launch_run.php';

/* ===== Пуск-пульт (AJAX): текст волны, сохранение правки, предпросмотр, запуск ===== */
if (in_array(input('do'), ['launch_text', 'launch_save', 'launch_preview', 'launch_fire'], true)) {
    $cid  = (int) input('id');
    $wave = (string) input('wave');
    if (input('do') !== 'launch_text' && !csrf_check()) json_out(['ok' => false, 'msg' => 'Сессия устарела. Обновите страницу.'], 403);
    $c = $cid ? one("SELECT * FROM competitions WHERE id=?", [$cid]) : null;
    if (!$c) json_out(['ok' => false, 'msg' => 'Конкурс не найден'], 404);
    if (!isset(launch_waves()[$wave])) json_out(['ok' => false, 'msg' => 'Неизвестная волна'], 400);
    $siblings = in_array($wave, ['d3', 'last', 'closed'], true) ? launch_open_comps() : [launch_norm_comp($c)];

    if (input('do') === 'launch_text') {           // текущий текст (override или эталон) для редактора
        json_out(['ok' => true, 'text' => launch_wave_text($c, $wave, $siblings),
                  'is_custom' => trim((string) setting('launch_txt:' . $cid . ':' . $wave, '')) !== '']);
    }
    if (input('do') === 'launch_save') {           // сохранить ручную правку (или сбросить к эталону, если пусто)
        $txt = trim((string) input('text'));
        if ($txt === '' || $txt === trim(launch_wave_default($c, $wave, $siblings))) {
            set_setting('launch_txt:' . $cid . ':' . $wave, '');
            json_out(['ok' => true, 'msg' => 'Возвращён эталонный текст.', 'is_custom' => false]);
        }
        set_setting('launch_txt:' . $cid . ':' . $wave, $txt);
        audit('launch_text_save', 'competition', $cid, ['wave' => $wave]);
        json_out(['ok' => true, 'msg' => 'Текст сохранён.', 'is_custom' => true]);
    }
    if (input('do') === 'launch_preview') {         // dry-run: что и куда уйдёт, без отправки
        $channels = array_filter(array_map('trim', explode(',', (string) input('channels'))));
        $res = launch_fire($cid, $wave, $channels, '', true);
        $res['email_html'] = launch_email_html($c, $wave, $siblings);
        json_out($res);
    }
    if (input('do') === 'launch_fire') {            // ОТКЛЮЧЕНО: моментальный запуск из карточки конкурса
        // Запуск/постинг в ВК теперь ТОЛЬКО через общий пульт (админка → «Запуск»),
        // где всё планируется на рабочее время и защищено от случайного ночного постинга.
        json_out(['ok' => false, 'msg' => 'Запуск отсюда отключён. Используйте общий пульт запуска: Админка → «Запуск». Там можно выбрать дату/время и запустить сразу все конкурсы (по умолчанию 1 число месяца, в рабочее время).'], 400);
    }
}

/** Сохранение загруженного изображения конкурса в public/uploads/comp/{id}/.
 *  Возвращает относительный путь (uploads/comp/...) или '' если файла нет/ошибка. */
function comp_upload_image(string $field, int $compId, string $baseName, int $maxMb = 15): string {
    $f = $_FILES[$field] ?? null;
    if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) return '';
    $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
    if ($ext === 'jpeg') $ext = 'jpg';
    $mime = function_exists('mime_content_type') ? (string) mime_content_type($f['tmp_name']) : '';
    if (!in_array($ext, ['png','jpg','webp'], true) || ($mime !== '' && !str_starts_with($mime, 'image/'))) {
        flash('Файл «' . $baseName . '» должен быть изображением png/jpg/webp.', 'error');
        return '';
    }
    if ((int)$f['size'] > $maxMb * 1024 * 1024) {
        flash('Файл «' . $baseName . '» больше ' . $maxMb . ' МБ.', 'error');
        return '';
    }
    // Защита от подмены полей: афиша — горизонтальная картинка (для писем и ВК),
    // фон диплома — вертикальный лист A4. Если в афишу кладут вертикальный файл,
    // в рассылке вместо афиши оказывался фон диплома — предупреждаем сразу.
    $sz = @getimagesize($f['tmp_name']);
    if ($sz && $sz[0] > 0 && $sz[1] > 0) {
        $ratio = $sz[0] / $sz[1];
        if ($baseName === 'afisha' && $ratio < 0.95) {
            flash('Похоже, в «Афишу» загружен вертикальный файл (' . $sz[0] . '×' . $sz[1] . ') — это формат фона диплома. '
                . 'Афиша должна быть горизонтальной (примерно 16:9): именно она идёт в письма и посты ВК.', 'error');
            return '';
        }
        if ($baseName === 'diploma_bg' && $ratio > 1.05) {
            flash('В «Фон диплома» загружен горизонтальный файл (' . $sz[0] . '×' . $sz[1] . ') — фон диплома должен быть вертикальным (A4).', 'error');
            return '';
        }
    }

    $dir = BASE_PATH . '/public/uploads/comp/' . $compId . '/';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    // Старые версии с другим расширением убираем, чтобы не путались.
    foreach (['png','jpg','webp'] as $e2) @unlink($dir . $baseName . '.' . $e2);
    if (!@move_uploaded_file($f['tmp_name'], $dir . $baseName . '.' . $ext)) {
        flash('Не удалось сохранить файл «' . $baseName . '».', 'error');
        return '';
    }
    return 'uploads/comp/' . $compId . '/' . $baseName . '.' . $ext;
}

/** Сдвиг даты на ближайший РАБОЧИЙ день: сб/вс → следующий понедельник.
 *  Принимает и возвращает строку формата 'Y-m-d'. Некорректный вход — без изменений. */
function comp_shift_workday(string $ymd): string {
    try { $d = new DateTimeImmutable($ymd); } catch (\Throwable $e) { return $ymd; }
    $dow = (int) $d->format('N'); // 1=пн … 6=сб, 7=вс
    if ($dow === 6)      $d = $d->modify('+2 days'); // суббота → понедельник
    elseif ($dow === 7)  $d = $d->modify('+1 day');  // воскресенье → понедельник
    return $d->format('Y-m-d');
}

/** Авто-описание конкурса по шаблону — из названия, типа и направления.
 *  Используется только когда админ оставил поле «описание» пустым. */
function comp_auto_description(string $name, string $type, string $direction): string {
    $name   = trim($name) ?: 'Конкурс';
    $typeRu = $type === 'national' ? 'всероссийский' : 'международный';
    $dirRu  = ['multi' => 'многожанровый', 'patriotic' => 'патриотический',
               'thematic' => 'тематический'][$direction] ?? 'многожанровый';
    return $name . ' — ' . $typeRu . ' ' . $dirRu
        . ' конкурс культуры и искусства при информационной поддержке органов культуры. '
        . 'Приём заявок онлайн, аттестация компетентным жюри, дипломы и наградной материал '
        . 'для лауреатов и дипломантов.';
}

/* ---------- POST-экшены ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела, повторите.', 'error'); admin_redirect('competitions'); }
    $do = input('do');

    if ($do === 'save') {
        $id = (int) input('id');
        $slug = strtolower(trim(input('slug')));
        $slug = preg_replace('/[^a-z0-9\-]+/', '-', $slug);
        $slug = trim($slug, '-');
        if ($slug === '') $slug = 'competition-' . time();

        $diplomaTheme = input('diploma_theme');
        if (!function_exists('diploma_themes') || !array_key_exists($diplomaTheme, diploma_themes())) $diplomaTheme = '';

        $duration = input('duration') === 'short' ? 'short' : 'long';
        $data = [
            'slug'          => $slug,
            'code'          => mb_strtoupper(trim(input('code'))),
            'name'          => trim(input('name')),
            'type'          => in_array(input('type'), ['international','national'], true) ? input('type') : 'international',
            'direction'     => in_array(input('direction'), ['multi','patriotic','thematic'], true) ? input('direction') : 'multi',
            'duration'      => $duration,
            'is_paid'       => isset($_POST['is_paid']) ? 1 : 0,
            /* Конкурс Клуба всегда бесплатный по оргвзносу: участие входит в
             * членство. Если галочку поставили вместе с платным участием —
             * побеждает Клуб, иначе человек заплатит дважды за одно и то же. */
            'club_only'     => isset($_POST['club_only']) ? 1 : 0,
            'price'         => (int) input('price'),
            'cover'         => trim(input('cover')),
            'description'   => trim(input('description')),
            'start_date'    => input('start_date') ?: null,
            'end_date'      => input('end_date') ?: null,
            'results_date'  => input('results_date') ?: null,
            // Белый список: что не из него — 'email'. Раньше сюда попадало любое
            // значение из формы, а форма про режим 'list' не знала вовсе.
            'results_mode'  => in_array(input('results_mode'), ['email', 'list'], true) ? input('results_mode') : 'email',
            'status'        => in_array(input('status'), ['draft','open','closed','judging','finished'], true) ? input('status') : 'draft',
            'nominations'   => json_encode(array_values($_POST['noms'] ?? []), JSON_UNESCAPED_UNICODE),
            'diploma_theme' => $diplomaTheme,
            'diploma_bg'    => trim(input('diploma_bg')),
            'sort'          => (int) input('sort'),
        ];

        /* Авто-описание по шаблону: только если поле пустое (ручной текст не затираем). */
        if ($data['description'] === '') {
            $data['description'] = comp_auto_description($data['name'], $data['type'], $data['direction']);
        }

        /* Автосроки нового конкурса: приём 1–25 следующего месяца.
         * Результаты: длинный формат — 28 числа того же месяца, со сдвигом на
         * ближайший рабочий день, если 28-е выпадает на сб/вс;
         * короткий — «в течение 5 рабочих дней» после подачи (конкретную дату
         * не фиксируем, режим выдачи — на почту, планирует cron по каждой заявке).
         * Даты проставляются только по пустым полям — админ может задать вручную. */
        if (!$id) {
            $nextM = new DateTimeImmutable('first day of next month');
            if (empty($data['start_date'])) $data['start_date'] = $nextM->format('Y-m-01');
            if (empty($data['end_date']))   $data['end_date']   = $nextM->format('Y-m-25');
            if ($duration === 'long') {
                if (empty($data['results_date'])) {
                    $data['results_date'] = comp_shift_workday($nextM->format('Y-m-28'));
                }
            } else {
                // Короткий формат: дату результатов не ставим, выдача — на почту.
                if (empty($data['results_date'])) $data['results_mode'] = 'email';
            }
        }

        // Снимок ДО изменений — чтобы отчитаться, что реально поменялось, и записать в
        // журнал старую и новую цену. Тогда откат «внезапно снова 500 ₽» невозможно
        // проглядеть: в audit_log видно кто и когда её сдвинул.
        $oldRow = $id ? (one("SELECT status, price, is_paid FROM competitions WHERE id=?", [$id]) ?: []) : [];
        $oldStatus = (string) ($oldRow['status'] ?? '');

        /* НЕПОЛНАЯ ФОРМА НЕ ИМЕЕТ ПРАВА СТИРАТЬ ПОЛЯ.
         *
         * Здесь всегда записывался ПОЛНЫЙ набор колонок, собранный из запроса.
         * Значит любой запрос, где часть полей отсутствует, обнулял их молча: у
         * «Мировых Талантов» так пропали афиша, даты приёма, дата итогов, фон
         * диплома и порядок вывода — конкурс исчез с главной, из календаря и из
         * раздела конкурсов, хотя «сохранение» отработало без ошибок.
         *
         * Настоящая форма редактирования помечает себя полем full_form и по-прежнему
         * перезаписывает всё (иначе снятую галочку «платный» было бы не сохранить).
         * Любой другой запрос меняет только те поля, которые прислал; остальные
         * берутся из текущей строки, чтобы дальнейшие уведомления говорили правду. */
        $dbData = $data;
        if ($id && !isset($_POST['full_form'])) {
            $partial = [];
            foreach ($data as $k => $v) {
                // 'nominations' приходит из массива noms, 'is_paid' — галочкой.
                if (array_key_exists($k, $_POST)
                    || ($k === 'nominations' && array_key_exists('noms', $_POST))) {
                    $partial[$k] = $v;
                }
            }
            $dbData = $partial;
            $cur = one("SELECT * FROM competitions WHERE id=?", [$id]) ?: [];
            $data = array_merge($cur, $partial);
        }
        if ($id && !$dbData) {
            flash('В запросе нет ни одного поля для сохранения — конкурс не изменён.', 'warning');
            admin_redirect('competitions', ['id' => $id]);
        }

        if ($id) {
            update('competitions', $dbData, 'id=:wid', ['wid' => $id]);
            audit('competition_update', 'competition', $id, [
                'name'        => (string) $data['name'],
                'price_from'  => (int) ($oldRow['price'] ?? 0),
                'price_to'    => (int) $data['price'],
                'is_paid_from' => (int) ($oldRow['is_paid'] ?? 0),
                'is_paid_to'   => (int) $data['is_paid'],
            ]);
        } else {
            $id = insert('competitions', $data);
            audit('competition_create', 'competition', $id, ['name' => $data['name']]);
        }
        // Явное подтверждение того, что цена действительно сохранена именно такая.
        $__price  = (int) $data['price'];
        $__isPaid = (int) $data['is_paid'];
        $__pInfo = $__isPaid
            ? number_format($__price, 0, '.', ' ') . ' ₽ за заявку'
            : 'бесплатное участие';
        $__changed = ($oldRow && ((int) ($oldRow['price'] ?? 0) !== $__price
                                 || (int) ($oldRow['is_paid'] ?? 0) !== $__isPaid));
        if ($__changed) {
            flash('Конкурс «' . $data['name'] . '» сохранён. Стоимость участия теперь — '
                . $__pInfo . '. Скидка Клуба и все места, где показывается цена, обновятся сразу.', 'success');
        }

        /* Загрузка файлов: афиша 16:9 (обложка), фон диплома А4, фото наград.
         * Файлы приоритетнее текстовых полей — перезаписывают пути. */
        $upd = [];
        if ($p = comp_upload_image('afisha_file', $id, 'afisha'))          $upd['cover'] = $p;
        if ($p = comp_upload_image('diploma_bg_file', $id, 'diploma_bg'))  $upd['diploma_bg'] = $p;
        if ($upd) update('competitions', $upd, 'id=:wid', ['wid' => $id]);

        // Фото наград (кубки/статуэтки/медали) — несколько файлов за раз.
        if (!empty($_FILES['award_photos']) && is_array($_FILES['award_photos']['name'] ?? null)) {
            $processNice = isset($_POST['award_process']); // обработать: вырезать фон, оформить с тенью
            $rawDir  = BASE_PATH . '/public/uploads/comp/' . $id . '/awards/';
            $liveDir = BASE_PATH . '/public/assets/img/awards/' . $id . '/';
            $saved = 0;
            foreach ($_FILES['award_photos']['name'] as $i => $nm) {
                if (($_FILES['award_photos']['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
                $ext = strtolower(pathinfo((string)$nm, PATHINFO_EXTENSION));
                if ($ext === 'jpeg') $ext = 'jpg';
                if (!in_array($ext, ['png','jpg','webp'], true)) continue;
                if ((int)$_FILES['award_photos']['size'][$i] > 15 * 1024 * 1024) continue;
                $slugName = strtolower(preg_replace('/[^a-z0-9]+/i', '-', pathinfo((string)$nm, PATHINFO_FILENAME)));
                $slugName = trim($slugName, '-') ?: 'award-' . ($i + 1);
                if (!is_dir($rawDir)) @mkdir($rawDir, 0775, true);
                if (@move_uploaded_file($_FILES['award_photos']['tmp_name'][$i], $rawDir . $slugName . '.' . $ext)) {
                    $saved++;
                    if (!$processNice) {
                        // Профессиональное фото — сразу в витрину наград как есть.
                        if (!is_dir($liveDir)) @mkdir($liveDir, 0775, true);
                        @copy($rawDir . $slugName . '.' . $ext, $liveDir . $slugName . '.jpg');
                    }
                }
            }
            if ($saved) {
                if ($processNice) {
                    // Очередь на красивую обработку (вырезать фон, тень, карточка товара).
                    set_setting('award_process_pending:' . $id, date('Y-m-d H:i'));
                    flash($saved . ' фото наград загружено. Поставлены в очередь на обработку (вырез фона + оформление).', 'success');
                } else {
                    flash($saved . ' фото наград загружено и опубликовано в витрине без обработки.', 'success');
                }
                audit('award_photos_upload', 'competition', $id, ['count' => $saved, 'process' => $processNice ? 1 : 0]);
            }
        }

        /* Раздельные ИМЕНОВАННЫЕ слоты фото наград (кубок/статуэтка/медаль) —
         * по образцу admin/diplomas.php: каждый слот → канонический файл
         * public/assets/img/awards/<cid>/{cup,statuette,medal}.jpg.
         * Пустой слот не трогает текущее фото. */
        $awSlots = ['cup' => 'Кубок', 'statuette' => 'Статуэтка', 'medal' => 'Медаль'];
        $slotDir = BASE_PATH . '/public/assets/img/awards/' . $id . '/';
        $slotSaved = 0;
        foreach ($awSlots as $slug => $label) {
            $key = 'award_' . $slug;
            if (empty($_FILES[$key]) || ($_FILES[$key]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) continue;
            if (!is_uploaded_file($_FILES[$key]['tmp_name'])) continue;
            $ext = strtolower(pathinfo((string)$_FILES[$key]['name'], PATHINFO_EXTENSION));
            if ($ext === 'jpeg') $ext = 'jpg';
            if (!in_array($ext, ['png','jpg','webp'], true)) continue;
            if ((int)$_FILES[$key]['size'] > 15 * 1024 * 1024) continue;
            $mime = function_exists('mime_content_type') ? (string) @mime_content_type($_FILES[$key]['tmp_name']) : '';
            if ($mime !== '' && !str_starts_with($mime, 'image/')) continue;
            if (!is_dir($slotDir)) @mkdir($slotDir, 0775, true);
            if (@move_uploaded_file($_FILES[$key]['tmp_name'], $slotDir . $slug . '.jpg')) $slotSaved++;
        }
        if ($slotSaved) {
            audit('award_photos_slots', 'competition', $id, ['count' => $slotSaved]);
            flash($slotSaved . ' фото наград (по слотам) сохранено и опубликовано в витрине.', 'success');
        }

        // Письмо поддержки министерства — в галерею ministry_letters (новые сверху).
        if (!empty($_FILES['ministry_letter']) && ($_FILES['ministry_letter']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK
            && is_uploaded_file($_FILES['ministry_letter']['tmp_name'])) {
            $mlExt = strtolower(pathinfo((string)$_FILES['ministry_letter']['name'], PATHINFO_EXTENSION));
            if ($mlExt === 'jpeg') $mlExt = 'jpg';
            if (in_array($mlExt, ['png','jpg','webp'], true) && (int)$_FILES['ministry_letter']['size'] <= 15*1024*1024) {
                $mlDir = BASE_PATH . '/public/uploads/ministry/';
                if (!is_dir($mlDir)) @mkdir($mlDir, 0775, true);
                $mlName = 'ml_' . $id . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.' . $mlExt;
                if (@move_uploaded_file($_FILES['ministry_letter']['tmp_name'], $mlDir . $mlName)) {
                    try {
                        q("CREATE TABLE IF NOT EXISTS ministry_letters (id INTEGER PRIMARY KEY AUTOINCREMENT, region TEXT, title TEXT, image_path TEXT, sort INTEGER DEFAULT 0)");
                        insert('ministry_letters', [
                            'region'     => mb_substr(trim(input('ministry_region')), 0, 160) ?: 'Министерство культуры',
                            'title'      => mb_substr((string)$data['name'], 0, 200),
                            'image_path' => 'uploads/ministry/' . $mlName,
                            'sort'       => 0,
                        ]);
                        flash('Письмо министерства загружено в галерею.', 'success');
                    } catch (\Throwable $e) { /* тихо */ }
                }
            } else {
                flash('Письмо министерства должно быть изображением (png/jpg/webp) до 15 МБ.', 'error');
            }
        }

        // Событие сайта -> мозг-агент при смене статуса конкурса.
        require_once BASE_PATH . '/core/events.php';
        $newStatus = $data['status'];
        if ($newStatus !== $oldStatus) {
            $competition = [
                'name'      => $data['name'],
                'type'      => $data['type'] === 'national' ? 'всероссийский' : 'международный',
                'end_date'  => $data['end_date'] ? ru_date($data['end_date']) : '',
                'url'       => url('/competition/' . $data['slug']),
                'slug'      => $data['slug'],
                'code'      => $data['code'],
            ];
            if ($newStatus === 'open') {
                emit_event('competition_open', ['competition' => $competition]);
            } elseif ($newStatus === 'closed') {
                emit_event('competition_closed', ['competition' => $competition]);
            } elseif ($newStatus === 'finished') {
                emit_event('results_published', ['competition' => $competition]);
            }

            /* Запуск конкурса -> анонсная рассылка по базе (шаблон new_competition).
             * Только при переходе (draft|closed|новый)->open, идемпотентно:
             * settings-флаг launch_blast_sent:{id} не даёт разослать дважды. */
            if ($newStatus === 'open'
                && in_array($oldStatus, ['', 'draft', 'closed'], true)
                && (string) setting('launch_blast_sent:' . $id, '') === '') {
                try {
                    require_once BASE_PATH . '/core/newsletter.php';

                    $typeRu = $data['type'] === 'national' ? 'Всероссийский' : 'Международный';
                    $dirRu  = ['multi' => 'многожанровый', 'patriotic' => 'патриотический',
                               'thematic' => 'тематический'][$data['direction']] ?? '';
                    $applyUrl = url('/apply');

                    // Внутренний фрагмент письма (обёртку добавит newsletter_enqueue -> nl_wrap_email).
                    $vars = [
                        'name'            => '', // массовая рассылка: обезличенное приветствие
                        'competition'     => $data['name'],
                        'description'     => (string) $data['description'],
                        'start_date'      => $data['start_date'] ? ru_date($data['start_date']) : '',
                        'end_date'        => $data['end_date'] ? ru_date($data['end_date']) : '',
                        'competition_url' => url('/competition/' . $data['slug']),
                    ];
                    ob_start();
                    include BASE_PATH . '/templates/emails/new_competition.php';
                    $blastBody = (string) ob_get_clean();

                    // Тематика конкурса + отдельный CTA на подачу заявки (/apply).
                    $blastBody .= '<p style="margin:22px 0 4px;color:#5a4632;font-size:15px;">'
                        . 'Формат: <b style="color:#7a2e1e;">' . h($typeRu)
                        . ($dirRu !== '' ? ', ' . h($dirRu) . ' конкурс' : ' конкурс') . '</b>.</p>'
                        . '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 4px;">'
                        . '<tr><td style="border-radius:10px;border:1.5px solid #a0522d;">'
                        . '<a href="' . h($applyUrl) . '" style="display:inline-block;padding:13px 32px;'
                        . 'color:#7a2e1e;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">'
                        . 'Подать заявку</a></td></tr></table>';

                    $nid = insert('newsletters', [
                        'subject'  => 'Открыт приём заявок: ' . $data['name'],
                        'body'     => $blastBody,
                        'audience' => 'all',
                        'status'   => 'draft',
                    ]);
                    $queued = newsletter_enqueue((int) $nid);

                    // Флаг ставим всегда после успешной постановки newsletter'а —
                    // чтобы повторный вход (в т.ч. closed->open->closed->open) не разослал снова.
                    set_setting('launch_blast_sent:' . $id, '1');
                    audit('competition_launch_blast', 'competition', $id,
                        ['newsletter' => (int) $nid, 'queued' => $queued]);
                } catch (\Throwable $e) {
                    // Рассылка не должна ронять сохранение конкурса.
                    if (function_exists('error_log')) {
                        error_log('competition_launch_blast(' . $id . ') failed: ' . $e->getMessage());
                    }
                }
            }
        }

        // Прайс наград — перезаписываем набор по конкурсу
        q("DELETE FROM awards_prices WHERE competition_id=?", [$id]);
        $items = $_POST['pi_item'] ?? [];
        $kinds = $_POST['pi_kind'] ?? [];
        $prices = $_POST['pi_price'] ?? [];
        foreach ($items as $i => $it) {
            $it = trim((string)$it);
            if ($it === '') continue;
            insert('awards_prices', [
                'competition_id' => $id,
                'item' => $it,
                'kind' => ($kinds[$i] ?? 'original') === 'digital' ? 'digital' : 'original',
                'price' => (int)($prices[$i] ?? 0),
            ]);
        }

        // Положение (DOCX из эталона) пересобирается автоматически при каждом
        // создании/сохранении конкурса. Ошибка генерации не роняет сохранение.
        //
        // СВОЁ ПОЛОЖЕНИЕ АВТОГЕНЕРАЦИЯ НЕ ТРОГАЕТ. Если владелец загрузил файл
        // вручную, любое сохранение конкурса затирало бы его эталоном — а он для
        // того и загружен, что эталон не подходит.
        $custom = (int) (scalar("SELECT COALESCE(regulation_custom,0) FROM competitions WHERE id=?", [(int) $id]) ?? 0);
        try {
            if ($custom === 1) {
                flash('Положение оставлено как есть — для этого конкурса загружен свой файл.', 'info');
                throw new \DomainException('custom');   // мимо генерации, но без ошибки в журнал
            }
            require_once BASE_PATH . '/core/regulation_gen.php';
            regulation_generate((int) $id);
            audit('regulation_generate', 'competition', $id);
        } catch (\DomainException $e) {
            // своё положение — ничего не делаем
        } catch (\Throwable $e) {
            error_log('regulation_generate(' . $id . ') failed: ' . $e->getMessage());
            flash('Конкурс сохранён, но положение не сгенерировалось: ' . $e->getMessage(), 'warning');
        }

        flash('Конкурс сохранён.', 'success');
        admin_redirect('competitions', ['action' => 'edit', 'id' => $id]);
    }

    if ($do === 'delete') {
        $id = (int) input('id');
        $name = (string) scalar("SELECT name FROM competitions WHERE id=?", [$id]);
        q("DELETE FROM awards_prices WHERE competition_id=?", [$id]);
        q("DELETE FROM competitions WHERE id=?", [$id]);
        audit('competition_delete', 'competition', $id, ['name' => $name]);
        flash('Конкурс удалён.', 'success');
        admin_redirect('competitions');
    }

    if ($do === 'copy') {
        $id = (int) input('id');
        $src = one("SELECT * FROM competitions WHERE id=?", [$id]);
        if ($src) {
            unset($src['id'], $src['created_at']);
            $src['slug']   = $src['slug'] . '-copy-' . substr((string)time(), -4);
            $src['name']   = $src['name'] . ' (копия)';
            $src['status'] = 'draft';
            $newId = insert('competitions', $src);
            foreach (all("SELECT item,kind,price FROM awards_prices WHERE competition_id=?", [$id]) as $pr) {
                insert('awards_prices', ['competition_id' => $newId] + $pr);
            }
            audit('competition_copy', 'competition', $newId, ['from' => $id]);
            flash('Создана копия-черновик.', 'success');
            admin_redirect('competitions', ['action' => 'edit', 'id' => $newId]);
        }
        admin_redirect('competitions');
    }

    if ($do === 'regenerate') {
        $id = (int) input('id');
        try {
            require_once BASE_PATH . '/core/regulation_gen.php';
            // Возврат к эталону снимает признак «своё положение»: владелец сознательно
            // отказывается от загруженного файла в пользу автогенерации.
            try { update('competitions', ['regulation_custom' => 0], 'id=:wid', ['wid' => $id]); } catch (\Throwable $e) {}
            regulation_generate($id);
            audit('regulation_generate', 'competition', $id);
            flash('Положение перегенерировано по эталону.', 'success');
        } catch (Throwable $e) {
            flash('Не удалось сгенерировать положение: ' . $e->getMessage(), 'error');
        }
        admin_redirect('competitions', ['action' => 'edit', 'id' => $id]);
    }

    /* ---------- СВОЁ ПОЛОЖЕНИЕ ФАЙЛОМ ----------
     *
     * Автогенерация закрывает обычный случай, но не все. Положение бывает
     * согласовано с ведомством, свёрстано дизайнером или просто отличается от
     * эталона так, что подстановкой названий и дат не обойтись. Раньше на такой
     * случай оставалось только править эталон — а он общий для всех конкурсов.
     *
     * Загруженный файл ЗАМЕЩАЕТ автогенерацию: положение конкурса — то, что
     * выложил владелец, и перезаписывать его при сохранении нельзя.
     */
    if ($do === 'upload_regulation') {
        $id = (int) input('id');
        $c  = $id ? one("SELECT * FROM competitions WHERE id=?", [$id]) : null;
        if (!$c) { flash('Конкурс не найден.', 'error'); admin_redirect('competitions'); }
        $back = ['action' => 'edit', 'id' => $id];

        $f = $_FILES['regulation_file'] ?? null;
        if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            flash('Выберите файл положения.', 'error'); admin_redirect('competitions', $back);
        }
        if ((int) ($f['error'] ?? 1) !== UPLOAD_ERR_OK) {
            // Самая частая причина — файл больше upload_max_filesize в php.ini.
            flash('Файл не загрузился (код ' . (int) $f['error'] . '). Проверьте размер файла.', 'error');
            admin_redirect('competitions', $back);
        }
        if ((int) $f['size'] > 25 * 1024 * 1024) {
            flash('Файл больше 25 МБ. Сожмите документ.', 'error'); admin_redirect('competitions', $back);
        }

        // Тип берём ПО СОДЕРЖИМОМУ, а не по имени: расширение подделывается, а в
        // публичной папке лежит то, что скачает любой участник.
        $ext  = strtolower(pathinfo((string) $f['name'], PATHINFO_EXTENSION));
        $head = (string) @file_get_contents((string) $f['tmp_name'], false, null, 0, 8);
        $isPdf  = str_starts_with($head, '%PDF');
        $isDocx = str_starts_with($head, "PK\x03\x04");          // docx — это zip
        if (!in_array($ext, ['pdf', 'docx'], true) || (!$isPdf && !$isDocx)
            || ($ext === 'pdf' && !$isPdf) || ($ext === 'docx' && !$isDocx)) {
            flash('Положение принимается только файлом PDF или DOCX.', 'error');
            admin_redirect('competitions', $back);
        }

        $slug = trim((string) ($c['slug'] ?? '')) !== '' ? (string) $c['slug'] : ('competition-' . $id);
        $dir  = BASE_PATH . '/public/uploads/regulations';
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $dest = $dir . '/' . $slug . '.' . $ext;

        if (!@move_uploaded_file((string) $f['tmp_name'], $dest)) {
            flash('Не удалось сохранить файл на сервер.', 'error'); admin_redirect('competitions', $back);
        }
        @chmod($dest, 0664);

        // Старый PDF и его кэш-ключ убираем: иначе участник продолжит скачивать
        // прежний документ — именно так 23.08 положение с ценой 500 ₽ пережило
        // смену цены на 1000 ₽.
        if ($ext === 'docx') { @unlink($dir . '/' . $slug . '.pdf.key'); }
        else                 { @unlink($dir . '/' . $slug . '.pdf.key'); }

        update('competitions', ['regulation_pdf' => $dest, 'regulation_custom' => 1], 'id=:wid', ['wid' => $id]);
        audit('regulation_upload', 'competition', $id, ['file' => basename($dest), 'size' => (int) $f['size']]);
        flash('Положение загружено: ' . basename($dest) . '. Автогенерация для этого конкурса отключена — '
            . 'чтобы вернуть эталон, нажмите «Перегенерировать положение».', 'success');
        admin_redirect('competitions', $back);
    }
}

/* ---------- Общий premium-стиль модуля (scoped, поверх admin.css) ---------- */
$comp_css = <<<'CSS'
<style>
.comp-hero{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:linear-gradient(135deg,var(--a-navy-2),var(--a-navy));
  color:#fff;border-radius:var(--a-radius);padding:20px 24px;margin-bottom:18px;box-shadow:var(--a-shadow-lg);position:relative;overflow:hidden}
.comp-hero::after{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;
  background:radial-gradient(circle,rgba(201,168,76,.35),transparent 70%);pointer-events:none}
.comp-hero__mark{width:52px;height:52px;flex:0 0 52px;border-radius:14px;background:var(--grad-gold);color:#1a1400;
  display:flex;align-items:center;justify-content:center;font-family:var(--ff-head);font-weight:800;font-size:1.35rem;box-shadow:0 6px 16px rgba(201,168,76,.35)}
.comp-hero__body{min-width:0;flex:1}
.comp-hero__body h2{color:#fff;margin:0 0 4px;font-size:1.4rem;line-height:1.15;overflow-wrap:anywhere}
.comp-hero__meta{display:flex;gap:8px 14px;flex-wrap:wrap;font-size:.82rem;color:#cbd0e6;align-items:center}
.comp-hero__meta code{background:rgba(255,255,255,.1);padding:2px 8px;border-radius:6px;font-family:var(--ff-body);letter-spacing:.06em}
.comp-hero__act{display:flex;gap:9px;flex-wrap:wrap;margin-left:auto}
.comp-hero .btn--ghost{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.3);color:#fff}
.comp-hero .btn--ghost:hover{background:rgba(255,255,255,.16)}
.card__head{display:flex;align-items:center;gap:10px;margin:0 0 16px}
.card__head svg{width:20px;height:20px;stroke:var(--a-gold-dark);flex:0 0 20px}
.card__head h3{margin:0}
.card__head .count{margin-left:auto;font-size:.78rem;font-weight:700;color:var(--a-muted);background:var(--a-parchment);
  border:1px solid var(--a-line);border-radius:999px;padding:2px 11px}
.noms-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.noms-grid .check{padding:10px 12px;border:1.5px solid var(--a-line);border-radius:var(--a-radius-sm);transition:.14s;background:#fff;font-size:.86rem}
.noms-grid .check:hover{border-color:var(--a-gold)}
.noms-grid .check:has(input:checked){border-color:var(--a-gold);background:linear-gradient(135deg,rgba(216,188,99,.16),rgba(201,168,76,.08))}
.price-foot{display:flex;justify-content:flex-end;gap:10px;align-items:baseline;padding:12px 4px 0;font-size:.9rem}
.price-foot b{font-family:var(--ff-head);font-size:1.15rem;color:var(--a-navy-2)}
.icon-cell .btn{padding:7px}
.icon-cell .btn svg{margin:0}
.comp-list-stats{margin-bottom:20px}
.paycheck{display:flex;align-items:center;gap:9px;padding:11px 14px;border:1.5px solid var(--a-line);border-radius:var(--a-radius-sm);
  cursor:pointer;transition:.14s;font-weight:600}
.paycheck:has(input:checked){border-color:var(--a-gold);background:linear-gradient(135deg,rgba(216,188,99,.16),rgba(201,168,76,.08))}
.swatch{display:inline-flex;align-items:center;gap:8px}
.swatch i{width:16px;height:16px;border-radius:5px;border:1px solid var(--a-line);flex:0 0 16px}
@media (max-width:960px){.noms-grid{grid-template-columns:1fr}}
@media (max-width:640px){
  .comp-hero{padding:16px}
  .comp-hero__act{margin-left:0;width:100%}
  .comp-hero__act .btn{flex:1;justify-content:center}
}
</style>
CSS;

$action = input('action');

/* ================= ФОРМА РЕДАКТИРОВАНИЯ ================= */
if ($action === 'edit') {
    $id = (int) input('id');
    $c = $id ? one("SELECT * FROM competitions WHERE id=?", [$id]) : null;
    if ($id && !$c) { flash('Конкурс не найден.', 'error'); admin_redirect('competitions'); }
    $c = $c ?: ['id'=>0,'slug'=>'','code'=>'','name'=>'','type'=>'international','direction'=>'multi',
        'is_paid'=>1,'price'=>500,'cover'=>'','description'=>'','start_date'=>'','end_date'=>'',
        'results_date'=>'','results_mode'=>'email','status'=>'draft','nominations'=>'','sort'=>0,
        'regulation_pdf'=>'','diploma_theme'=>'','diploma_bg'=>'','duration'=>'long'];
    $c += ['duration' => 'long'];
    $activeNoms = $c['nominations'] ? (json_decode($c['nominations'], true) ?: []) : [];
    $prices = $id ? all("SELECT item,kind,price FROM awards_prices WHERE competition_id=? ORDER BY id", [$id]) : [];
    // Если прайс пуст — подставляем канонический список наград (как в разделе «Награды»/образцах),
    // чтобы блок не был пустым и админ сразу видел ВСЕ позиции с ценами по умолчанию.
    if (!$prices) {
        // Единый прайс наград (Даниэль): на ВСЕ конкурсы.
        $prices = [
            ['item'=>'Кубок',                 'kind'=>'original', 'price'=>1000],
            ['item'=>'Статуэтка',             'kind'=>'original', 'price'=>800],
            ['item'=>'Медаль',                'kind'=>'original', 'price'=>500],
            ['item'=>'Основной диплом',       'kind'=>'digital',  'price'=>400],
            ['item'=>'Основной диплом',       'kind'=>'original', 'price'=>500],
            ['item'=>'Дополнительный диплом',  'kind'=>'digital',  'price'=>350],
            ['item'=>'Дополнительный диплом',  'kind'=>'original', 'price'=>450],
            ['item'=>'Благодарность',         'kind'=>'digital',  'price'=>300],
            ['item'=>'Благодарность',         'kind'=>'original', 'price'=>400],
            ['item'=>'Именной диплом',        'kind'=>'digital',  'price'=>400],
            ['item'=>'Именной диплом',        'kind'=>'original', 'price'=>500],
        ];
    }
    $appsCount = $id ? (int) scalar("SELECT COUNT(*) FROM applications WHERE competition_id=?", [$id]) : 0;
    $themes = function_exists('diploma_themes') ? diploma_themes() : [];
    $publicUrl = url('/competition/' . ($c['slug'] ?: ''));

    ob_start(); ?>
    <?= $comp_css ?>
    <div class="toolbar">
      <a class="btn btn--ghost btn--sm" href="<?= a_link('competitions') ?>"><?= admin_icon('back') ?>К списку</a>
    </div>

    <?php if ($id): ?>
    <div class="comp-hero">
      <div class="comp-hero__mark"><?= h(mb_substr($c['code'] ?: mb_substr($c['name'],0,2), 0, 2)) ?></div>
      <div class="comp-hero__body">
        <h2><?= h($c['name']) ?></h2>
        <div class="comp-hero__meta">
          <span class="badge badge--<?= h($c['status']) ?>"><?= h(comp_status_ru($c['status'])) ?></span>
          <span><?= $c['type']==='national'?'Всероссийский':'Международный' ?></span>
          <code>/<?= h($c['slug']) ?></code>
          <span><?= (int)$appsCount ?> заявок</span>
          <span><?= $c['is_paid'] ? money((int)$c['price']) : 'Бесплатно' ?></span>
        </div>
      </div>
      <div class="comp-hero__act">
        <a class="btn btn--ghost btn--sm" href="<?= h($publicUrl) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Предпросмотр</a>
        <a class="btn btn--ghost btn--sm" href="<?= a_link('applications', ['competition'=>$id]) ?>"><?= admin_icon('applications') ?>Заявки</a>
      </div>
    </div>
    <?php endif; ?>

    <form method="post" action="<?= url('/admin/') ?>" enctype="multipart/form-data">
      <?= csrf_field() ?>
      <input type="hidden" name="do" value="save">
      <!-- Форма полная: сохраняем все поля, снятые галочки тоже значимы. -->
      <input type="hidden" name="full_form" value="1">
      <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
      <div class="grid grid-2">
        <div class="card">
          <div class="card__head"><?= admin_icon('competitions') ?><h3>Основное</h3></div>
          <div class="field"><label>Название</label><input id="fName" name="name" value="<?= h($c['name']) ?>" required></div>
          <div class="form-row">
            <div class="field"><label>Slug (адрес)</label><input id="fSlug" name="slug" value="<?= h($c['slug']) ?>" placeholder="mirovaya-scena">
              <div class="hint">Публичная ссылка: <span id="slugPreview" class="mask"><?= h($publicUrl) ?></span></div></div>
            <div class="field"><label>Код (для номеров)</label><input name="code" value="<?= h($c['code']) ?>" placeholder="MC" maxlength="4" style="text-transform:uppercase"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Тип</label><select name="type">
              <option value="international" <?= $c['type']==='international'?'selected':'' ?>>Международный</option>
              <option value="national" <?= $c['type']==='national'?'selected':'' ?>>Всероссийский</option>
            </select></div>
            <div class="field"><label>Направление</label><select name="direction">
              <option value="multi" <?= $c['direction']==='multi'?'selected':'' ?>>Многожанровый</option>
              <option value="patriotic" <?= $c['direction']==='patriotic'?'selected':'' ?>>Патриотический</option>
              <option value="thematic" <?= $c['direction']==='thematic'?'selected':'' ?>>Тематический</option>
            </select></div>
          </div>
          <div class="field"><label>Формат</label><select name="duration">
              <option value="long" <?= ($c['duration'] ?? 'long')!=='short'?'selected':'' ?>>Длинный — приём 1–25, результаты 28 числа</option>
              <option value="short" <?= ($c['duration'] ?? '')==='short'?'selected':'' ?>>Короткий — результаты за 5 рабочих дней после подачи</option>
            </select>
            <div class="hint">У нового конкурса сроки заполняются автоматически: приём с 1 по 25 число следующего месяца.</div>
          </div>
          <div class="field"><label>Описание</label><textarea name="description" placeholder="Краткое описание конкурса для карточки на сайте"><?= h($c['description']) ?></textarea></div>
          <div class="field"><label>Афиша конкурса (16:9, png/jpg/webp до 15 МБ)</label>
            <input type="file" name="afisha_file" accept="image/*">
            <?php if (!empty($c['cover'])):
                    // Показываем реальные пропорции файла: так сразу видно, если в афишу
                    // попал вертикальный фон диплома (именно этот файл уходит в рассылку).
                    $_cvAbs = BASE_PATH . '/public/' . ltrim((string)$c['cover'], '/');
                    $_cvSz  = is_file($_cvAbs) ? @getimagesize($_cvAbs) : null;
                    $_vert  = $_cvSz && $_cvSz[1] > $_cvSz[0]; ?>
              <div style="margin-top:8px"><img src="<?= h(url('/' . ltrim((string)$c['cover'], '/'))) ?>" alt="Афиша"
                   style="max-width:260px;width:100%;border-radius:10px;border:1px solid var(--a-line)"></div>
              <div class="small <?= $_vert ? '' : 'muted' ?>" style="margin-top:6px<?= $_vert ? ';color:#C0392B;font-weight:700' : '' ?>">
                <?php if ($_cvSz): ?>
                  Файл: <?= (int)$_cvSz[0] ?>×<?= (int)$_cvSz[1] ?> ·
                  <?= $_vert ? 'ВЕРТИКАЛЬНЫЙ — похоже, это фон диплома, а не афиша. В письме и в ВК уйдёт именно он. Загрузите горизонтальную афишу.' : 'горизонтальная — верно' ?>
                <?php else: ?>
                  Файл афиши не найден на диске: <?= h((string)$c['cover']) ?>
                <?php endif; ?>
              </div>
            <?php endif; ?>
            <div class="hint">Афиша показывается в календаре, на карточке конкурса, в письмах рассылки и в постах ВК.</div>
          </div>
          <input type="hidden" name="cover" value="<?= h($c['cover']) ?>">
          <div class="field"><label>Письмо поддержки министерства (png/jpg/webp до 15 МБ)</label>
            <input type="file" name="ministry_letter" accept="image/*">
            <input type="text" name="ministry_region" placeholder="Регион/ведомство (напр.: Министерство культуры)" value="" style="margin-top:8px">
            <div class="hint">Загруженное письмо появится в разделе «Письма министерств» (новые — сверху).</div>
          </div>
        </div>

        <div class="card">
          <div class="card__head"><?= admin_icon('clock') ?><h3>Статус и сроки</h3></div>
          <div class="form-row">
            <div class="field"><label>Статус</label><select name="status">
              <?php foreach (['draft','open','closed','judging','finished'] as $s): ?>
                <option value="<?= $s ?>" <?= $c['status']===$s?'selected':'' ?>><?= h(comp_status_ru($s)) ?></option>
              <?php endforeach; ?>
            </select>
            <div class="hint">Открыт → Оценивание → Завершён. При смене — уведомление подписчикам.</div></div>
            <div class="field"><label>Порядок</label><input type="number" name="sort" value="<?= (int)$c['sort'] ?>"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Начало приёма</label><input type="date" name="start_date" value="<?= h($c['start_date']) ?>"></div>
            <div class="field"><label>Окончание приёма</label><input type="date" name="end_date" value="<?= h($c['end_date']) ?>"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Дата результатов</label><input type="date" name="results_date" value="<?= h($c['results_date']) ?>"></div>
            <?php /* Варианта «list» в этом списке не было, хотя именно он включает
                     раздел «Оценка длинных»: любое сохранение конкурса молча
                     переводило его в 'email', и очередь оценки длинного конкурса
                     опустевала. Вариант «На сайте» убран — в коде он нигде не
                     обрабатывается и означал ровно то же, что «На почту». */ ?>
            <div class="field"><label>Выдача результатов</label><select name="results_mode">
              <option value="email" <?= $c['results_mode']==='email'?'selected':'' ?>>На почту (по каждой заявке)</option>
              <option value="list"  <?= $c['results_mode']==='list' ?'selected':'' ?>>Списком (длинный конкурс)</option>
            </select></div>
          </div>
          <hr>
          <label class="paycheck"><input type="checkbox" name="is_paid" id="fPaid" <?= $c['is_paid']?'checked':'' ?>> <?= admin_icon('money') ?><span>Платное участие (оргвзнос)</span></label>
          <div class="field" id="priceRow" style="margin-top:14px"><label>Стоимость участия, ₽</label><input type="number" name="price" value="<?= (int)$c['price'] ?>" min="0"></div>
          <label class="paycheck" style="margin-top:14px"><input type="checkbox" name="club_only" id="fClubOnly" <?= !empty($c['club_only'])?'checked':'' ?>> <?= admin_icon('star') ?><span>Только для участников Клуба</span></label>
          <p class="hint" style="margin-top:6px">
            Конкурс виден всем, но подать заявку может только участник Клуба — остальным форма
            предложит вступить. Оргвзнос за такой конкурс не берётся: участие входит в членство.
            Положение собирается по отдельному эталону, с пунктом про призовой фонд 100 000 ₽
            и ежегодный очный гала-концерт.
          </p>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card__head"><?= admin_icon('grading') ?><h3>Номинации конкурса</h3><span class="count"><span id="nomCount"><?= count($activeNoms) ?></span> из <?= count(NOMINATIONS()) ?></span></div>
        <p class="small muted" style="margin-top:-8px">Отметьте активные группы номинаций для этого конкурса.</p>
        <div class="noms-grid" id="nomsGrid">
          <?php foreach (array_keys(NOMINATIONS()) as $nom): ?>
            <label class="check"><input type="checkbox" name="noms[]" value="<?= h($nom) ?>" <?= in_array($nom, $activeNoms, true)?'checked':'' ?>> <?= h($nom) ?></label>
          <?php endforeach; ?>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card__head"><?= admin_icon('money') ?><h3>Прайс наград</h3>
          <button type="button" class="btn btn--ghost btn--sm" style="margin-left:auto" onclick="addPrice()"><?= admin_icon('plus') ?>Строка</button></div>
        <div class="table-wrap">
          <table class="tbl" id="priceTbl">
            <thead><tr><th>Наименование</th><th style="width:170px">Вид</th><th style="width:140px">Цена, ₽</th><th style="width:44px"></th></tr></thead>
            <tbody>
              <?php foreach ($prices as $pr): ?>
                <tr>
                  <td><input name="pi_item[]" value="<?= h($pr['item']) ?>" placeholder="Основной диплом"></td>
                  <td><select name="pi_kind[]">
                    <option value="original" <?= $pr['kind']==='original'?'selected':'' ?>>Оригинал</option>
                    <option value="digital" <?= $pr['kind']==='digital'?'selected':'' ?>>Электронный</option>
                  </select></td>
                  <td><input type="number" name="pi_price[]" class="pi-price" value="<?= (int)$pr['price'] ?>" min="0" oninput="sumPrices()"></td>
                  <td class="icon-cell"><button type="button" class="btn btn--danger btn--sm" title="Удалить" onclick="this.closest('tr').remove();sumPrices()"><?= admin_icon('x') ?></button></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
        <div class="price-foot">Позиций: <b id="priceCount">0</b> · Сумма прайса: <b id="priceSum">0 ₽</b></div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card__head"><?= admin_icon('diplomas') ?><h3>Диплом и положение</h3></div>
        <div class="grid grid-2" style="gap:22px">
          <div>
            <div class="field"><label>Фон диплома (А4 портрет, png/jpg/webp до 15 МБ)</label>
              <input type="file" name="diploma_bg_file" accept="image/*">
              <?php if (!empty($c['diploma_bg'])): ?>
                <div style="margin-top:8px"><img src="<?= h(url('/' . ltrim((string)$c['diploma_bg'], '/'))) ?>" alt="Фон диплома"
                     style="max-width:170px;width:100%;aspect-ratio:210/297;object-fit:cover;border-radius:10px;border:1px solid var(--a-line)"></div>
              <?php endif; ?>
              <div class="hint">Этот же фон показывается квадратом при выборе конкурса в форме подачи и в образце диплома.</div>
            </div>
            <input type="hidden" name="diploma_bg" value="<?= h((string)($c['diploma_bg'] ?? '')) ?>">
            <input type="hidden" name="diploma_theme" value="<?= h((string)($c['diploma_theme'] ?? '')) ?>">
            <?php if ($id): ?>
            <div class="toolbar" style="margin:0 0 14px">
              <a class="btn btn--navy btn--sm" href="<?= a_link('diploma_editor', ['comp' => $id]) ?>"><?= admin_icon('edit') ?>Редактор макета диплома</a>
              <a class="btn btn--ghost btn--sm" href="<?= h(url('/diploma-sample/' . $c['slug'])) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Демо-образец</a>
            </div>
            <?php endif; ?>
            <div class="field"><label>Фото наград по слотам (кубок · статуэтка · медаль)</label>
              <p class="small muted" style="margin:0 0 8px">Загрузите фото под каждый вид отдельно. Пустой слот не меняет текущее фото. Публикуется в витрину наград как есть.</p>
              <div class="form-row" style="flex-wrap:wrap;gap:12px">
                <?php
                  $awSlotDir = '/assets/img/awards/' . $id . '/';
                  foreach (['cup'=>'Кубок','statuette'=>'Статуэтка','medal'=>'Медаль'] as $awSlug => $awLabel):
                    $awExists = $id && is_file(BASE_PATH . '/public' . $awSlotDir . $awSlug . '.jpg'); ?>
                  <div class="field" style="min-width:150px;flex:1">
                    <label><?= h($awLabel) ?></label>
                    <?php if ($awExists): ?>
                      <img src="<?= h(url(ltrim($awSlotDir,'/') . $awSlug . '.jpg')) ?>?v=<?= @filemtime(BASE_PATH.'/public'.$awSlotDir.$awSlug.'.jpg') ?>" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:8px;border:1px solid var(--a-line);margin-bottom:6px;display:block">
                    <?php endif; ?>
                    <input type="file" name="award_<?= h($awSlug) ?>" accept="image/*">
                  </div>
                <?php endforeach; ?>
              </div>
            </div>
            <div class="field"><label>Фото наград пакетом (несколько файлов — по имени файла)</label>
              <input type="file" name="award_photos[]" accept="image/*" multiple>
              <label class="paycheck" style="margin-top:10px"><input type="checkbox" name="award_process" checked>
                <span>Обработать красиво: вырезать фон, добавить тень и оформление. Снимите галочку, если фото уже профессиональные — опубликуются как есть.</span></label>
            </div>
          </div>
          <div>
            <?php if ($id): ?>
              <?php $isCustom = (int) ($c['regulation_custom'] ?? 0) === 1; ?>
              <div class="field"><label>Положение о конкурсе</label>
                <p class="small muted" style="margin:0 0 12px">
                  <?php if ($c['regulation_pdf']): ?>
                    <?= $isCustom ? 'Загружен свой файл' : 'Собрано из эталона' ?>:
                    <b><?= h(basename($c['regulation_pdf'])) ?></b>
                    <?php if ($isCustom): ?>
                      <br><span style="color:var(--a-navy)">Автогенерация для этого конкурса выключена — файл не перезаписывается при сохранении.</span>
                    <?php endif; ?>
                  <?php else: ?>
                    Ещё не сгенерировано (создастся автоматически при сохранении).
                  <?php endif; ?>
                </p>
                <div class="toolbar" style="margin:0">
                  <button class="btn btn--navy btn--sm" formaction="<?= url('/admin/') ?>" name="do" value="regenerate"><?= admin_icon('download') ?><?= $isCustom ? 'Вернуть эталон' : 'Перегенерировать положение' ?></button>
                  <?php if ($c['regulation_pdf']): ?>
                    <a class="btn btn--ghost btn--sm" href="<?= h(url(str_replace(BASE_PATH.'/public','',$c['regulation_pdf']))) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Открыть файл</a>
                  <?php endif; ?>
                </div>
                <div class="hint" style="margin-top:10px">Положение собирается 1:1 из эталона (платный/бесплатный), подставляются название, даты, тематика «Свободная» и сумма оргвзноса из поля «Цена». Пересобирается при каждом сохранении.</div>

                <!-- СВОЙ ФАЙЛ ПОЛОЖЕНИЯ -->
                <div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--a-line)">
                  <label style="display:block;margin-bottom:6px">Загрузить своё положение файлом</label>
                  <input type="file" name="regulation_file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                         style="display:block;margin-bottom:8px">
                  <button class="btn btn--ghost btn--sm" formaction="<?= url('/admin/') ?>" name="do" value="upload_regulation" formnovalidate>
                    <?= admin_icon('upload') ?? admin_icon('download') ?>Загрузить файл
                  </button>
                  <div class="hint" style="margin-top:8px">
                    PDF или DOCX, до 25 МБ. Нужен, когда положение согласовано с ведомством или свёрстано отдельно и эталон не подходит.
                    Загруженный файл заменяет автогенерацию: он не перезапишется при сохранении конкурса.
                    Вернуть эталон — кнопкой выше.
                  </div>
                </div>
              </div>
            <?php else: ?>
              <p class="small muted">Генерация положения станет доступна после первого сохранения конкурса.</p>
            <?php endif; ?>
          </div>
        </div>
      </div>

      <div class="toolbar" style="margin-top:22px">
        <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <?php if ($id): ?>
          <button class="btn btn--ghost" name="do" value="copy" formnovalidate onclick="return confirm('Создать копию-черновик этого конкурса? Появится отдельный конкурс «(копия)».')"><?= admin_icon('copy') ?>Дублировать</button>
          <button class="btn btn--danger" name="do" value="delete" onclick="return confirm('Удалить конкурс безвозвратно? Прайс наград тоже будет удалён.')"><?= admin_icon('trash') ?>Удалить</button>
        <?php endif; ?>
      </div>
    </form>

    <script>
    // Авто-генерация кода конкурса из названия (инициалы слов), если поле пустое.
    (function(){
      var nm=document.getElementById('fName'), code=document.querySelector('input[name="code"]');
      if(!nm||!code) return;
      var translit={а:'A',б:'B',в:'V',г:'G',д:'D',е:'E',ж:'Z',з:'Z',и:'I',й:'I',к:'K',л:'L',м:'M',н:'N',о:'O',п:'P',р:'R',с:'S',т:'T',у:'U',ф:'F',х:'H',ц:'C',ч:'C',ш:'S',щ:'S',э:'E',ю:'U',я:'Y'};
      nm.addEventListener('input',function(){
        if(code.dataset.touched) return;
        var words=nm.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
        var c=words.map(function(w){var ch=w[0]||'';return translit[ch]||(/[a-z0-9]/.test(ch)?ch.toUpperCase():'');}).join('').slice(0,4);
        if(c) code.value=c;
      });
      code.addEventListener('input',function(){code.dataset.touched='1';});
    })();
    var X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    function addPrice(){
      var tb=document.querySelector('#priceTbl tbody');
      var tr=document.createElement('tr');
      tr.innerHTML='<td><input name="pi_item[]" placeholder="Наименование"></td>'+
        '<td><select name="pi_kind[]"><option value="original">Оригинал</option><option value="digital">Электронный</option></select></td>'+
        '<td><input type="number" name="pi_price[]" class="pi-price" value="0" min="0" oninput="sumPrices()"></td>'+
        '<td class="icon-cell"><button type="button" class="btn btn--danger btn--sm" title="Удалить">'+X_SVG+'</button></td>';
      tr.querySelector('button').addEventListener('click',function(){tr.remove();sumPrices();});
      tb.appendChild(tr);
      sumPrices();
    }
    function sumPrices(){
      var rows=document.querySelectorAll('#priceTbl tbody tr'), sum=0, n=0;
      rows.forEach(function(r){
        var it=r.querySelector('input[name="pi_item[]"]');
        var pr=r.querySelector('.pi-price');
        if(it && it.value.trim()!==''){ n++; sum+=parseInt(pr && pr.value||0,10)||0; }
      });
      document.getElementById('priceCount').textContent=n;
      document.getElementById('priceSum').textContent=sum.toLocaleString('ru-RU')+' ₽';
    }
    function nomCount(){
      var n=document.querySelectorAll('#nomsGrid input:checked').length;
      document.getElementById('nomCount').textContent=n;
    }
    function slugify(s){
      var map={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',' ':'-'};
      return s.toLowerCase().split('').map(function(ch){return map[ch]!==undefined?map[ch]:ch;}).join('').replace(/[^a-z0-9\-]+/g,'-').replace(/\-+/g,'-').replace(/^\-|\-$/g,'');
    }
    (function(){
      var base=<?= json_encode(rtrim(url('/competition/'), '/') . '/', JSON_UNESCAPED_SLASHES) ?>;
      var slug=document.getElementById('fSlug'), name=document.getElementById('fName'), prev=document.getElementById('slugPreview');
      var touched=slug.value.trim()!=='';
      function upd(){ prev.textContent=base+(slug.value||'…'); }
      slug.addEventListener('input',function(){touched=true;upd();});
      name.addEventListener('input',function(){ if(!touched){ slug.value=slugify(name.value); upd(); } });
      document.getElementById('nomsGrid').addEventListener('change',nomCount);
      var paid=document.getElementById('fPaid'), pr=document.getElementById('priceRow');
      function togglePay(){ pr.style.opacity=paid.checked?'1':'.5'; }
      paid.addEventListener('change',togglePay); togglePay();
      sumPrices(); upd();
    })();
    </script>

    <?php if ($id):
      $LW = launch_waves(); $LC = launch_channels();
      $isLongComp = (string)($c['results_mode'] ?? '') === 'list';
      // Пост результатов — только для длинных (по коротким результат уходит на почту).
      if (!$isLongComp) unset($LW['results']);
    ?>
    <div class="card" id="launchPult" style="margin-top:22px">
      <div class="section-title"><h3><?= admin_icon('rocket') ?>Запуск конкурса</h3></div>
      <p class="small muted" style="margin:-4px 0 12px">Запуск рекламной кампании (посты в ВК, рассылки по почте и в приложении) вынесен в отдельный <b>общий пульт</b> — один запуск сразу на все конкурсы, с планированием на рабочее время и авто-постами 22/25 числа. Так не будет 4 одинаковых постов и случайных ночных публикаций.</p>
      <a class="btn btn--primary" href="<?= a_link('launch') ?>"><?= admin_icon('rocket') ?>Открыть общий пульт запуска</a>
    </div>
    <?php endif; ?>

    <?php
    $content = ob_get_clean();
    admin_layout($id ? 'Редактирование конкурса' : 'Новый конкурс', $content, 'competitions');
    exit;
}

/* ================= СПИСОК ================= */
$tab = input('tab') ?: 'active';
$where = $tab === 'archive' ? "status IN ('closed','finished')"
       : ($tab === 'draft' ? "status='draft'" : "status IN ('open','judging')");
$rows = all("SELECT c.*,
             (SELECT COUNT(*) FROM applications a WHERE a.competition_id=c.id) apps
             FROM competitions c WHERE $where ORDER BY c.sort, c.id DESC");
$counts = [
    'active'  => (int) scalar("SELECT COUNT(*) FROM competitions WHERE status IN ('open','judging')"),
    'draft'   => (int) scalar("SELECT COUNT(*) FROM competitions WHERE status='draft'"),
    'archive' => (int) scalar("SELECT COUNT(*) FROM competitions WHERE status IN ('closed','finished')"),
];
$totalApps = (int) scalar("SELECT COUNT(*) FROM applications");

ob_start(); ?>
<?= $comp_css ?>
<div class="section-title">
  <h2>Конкурсы</h2>
  <a class="btn btn--primary" href="<?= a_link('competitions', ['action' => 'edit']) ?>"><?= admin_icon('plus') ?>Создать конкурс</a>
</div>

<div class="grid grid-4 comp-list-stats">
  <div class="stat"><span class="stat__label">Активные</span><span class="stat__value"><?= $counts['active'] ?></span><span class="stat__sub">Открыт / Оценивание</span><span class="stat__icon"><?= admin_icon('competitions') ?></span></div>
  <div class="stat"><span class="stat__label">Черновики</span><span class="stat__value"><?= $counts['draft'] ?></span><span class="stat__sub">В подготовке</span><span class="stat__icon"><?= admin_icon('edit') ?></span></div>
  <div class="stat"><span class="stat__label">Архив</span><span class="stat__value"><?= $counts['archive'] ?></span><span class="stat__sub">Закрыт / Завершён</span><span class="stat__icon"><?= admin_icon('diplomas') ?></span></div>
  <div class="stat"><span class="stat__label">Заявок всего</span><span class="stat__value"><?= $totalApps ?></span><span class="stat__sub">По всем конкурсам</span><span class="stat__icon"><?= admin_icon('applications') ?></span></div>
</div>

<div class="tabs">
  <a href="<?= a_link('competitions', ['tab'=>'active']) ?>" class="<?= $tab==='active'?'active':'' ?>">Активные (<?= $counts['active'] ?>)</a>
  <a href="<?= a_link('competitions', ['tab'=>'draft']) ?>" class="<?= $tab==='draft'?'active':'' ?>">Черновики (<?= $counts['draft'] ?>)</a>
  <a href="<?= a_link('competitions', ['tab'=>'archive']) ?>" class="<?= $tab==='archive'?'active':'' ?>">Архив (<?= $counts['archive'] ?>)</a>
</div>

<div class="table-wrap">
  <table class="tbl">
    <thead><tr><th>Название</th><th>Код</th><th>Тип</th><th>Статус</th><th class="num">Заявок</th><th class="num">Цена</th><th style="width:150px"></th></tr></thead>
    <tbody>
      <?php if (!$rows): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:28px">Нет конкурсов в этой вкладке. <a href="<?= a_link('competitions', ['action'=>'edit']) ?>">Создать первый</a>.</td></tr><?php endif; ?>
      <?php foreach ($rows as $c): ?>
        <tr>
          <td><a href="<?= a_link('competitions', ['action'=>'edit','id'=>$c['id']]) ?>"><b><?= h($c['name']) ?></b></a><br><span class="small muted">/<?= h($c['slug']) ?></span></td>
          <td><?= $c['code'] ? '<span class="tag">'.h($c['code']).'</span>' : '<span class="muted">—</span>' ?></td>
          <td class="small"><?= $c['type']==='national'?'Всероссийский':'Международный' ?></td>
          <td><span class="badge badge--<?= h($c['status']) ?>"><?= h(comp_status_ru($c['status'])) ?></span></td>
          <td class="num"><a href="<?= a_link('applications', ['competition'=>$c['id']]) ?>"><?= (int)$c['apps'] ?></a></td>
          <td class="num"><?= $c['is_paid'] ? money((int)$c['price']) : '<span class="badge badge--paid">Бесплатно</span>' ?></td>
          <td class="icon-cell" style="white-space:nowrap;text-align:right">
            <a class="btn btn--ghost btn--sm" href="<?= h(url('/competition/'.$c['slug'])) ?>" target="_blank" rel="noopener" title="Предпросмотр на сайте"><?= admin_icon('eye') ?></a>
            <a class="btn btn--ghost btn--sm" href="<?= a_link('competitions', ['action'=>'edit','id'=>$c['id']]) ?>" title="Редактировать"><?= admin_icon('edit') ?></a>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
              <?= csrf_field() ?><input type="hidden" name="do" value="copy"><input type="hidden" name="id" value="<?= $c['id'] ?>">
              <button class="btn btn--ghost btn--sm" title="Дублировать" onclick="return confirm('Создать копию-черновик этого конкурса?')"><?= admin_icon('copy') ?></button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<!-- ВСТРОЕННЫЙ ПУЛЬТ ЗАПУСКА — прямо внизу раздела «Конкурсы», без всплывающих окон -->
<div style="margin-top:26px"><?= launch_panel_html() ?></div>
<?php
$content = ob_get_clean();
admin_layout('Конкурсы', $content, 'competitions');
