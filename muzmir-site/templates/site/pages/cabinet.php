<?php
/** Личный кабинет участника. Разделы: заявки, дипломы, награды, настройки, реферальная программа. */
require_login();
$user = current_user();
$uid = (int)$user['id'];
$isTeacher = in_array($user['role'], ['teacher','jury','moderator','admin','owner'], true);

// --- Обработка POST (настройки уведомлений, профиль, пароль, пересылка диплома, реф-код) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = input('action');
    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif ($action === 'notify') {
        update('users', [
            'notify_email' => isset($_POST['notify_email']) ? 1 : 0,
            'notify_tg'    => isset($_POST['notify_tg']) ? 1 : 0,
        ], 'id=:id', ['id' => $uid]);
        flash('Настройки уведомлений сохранены.', 'success');
        redirect('/cabinet');
    } elseif ($action === 'profile') {
        $fio = input('full_name');
        $avatar = trim(input('avatar'));
        $nickname = trim(input('nickname'));
        $category = trim(input('category'));
        if (function_exists('v_fio') && $fio !== '') $fio = v_fio($fio);
        $upd = ['full_name' => $fio, 'nickname' => $nickname];
        // Телефон из формы профиля больше не правится (привязка — через SMS-код в «Способах входа»),
        // но поле обновляем, если форма его прислала (обратная совместимость).
        if (array_key_exists('phone', $_POST)) $upd['phone'] = input('phone');
        // Город — мягкий ALTER users.city (идемпотентно).
        ensure_user_column('city');
        $upd['city'] = mb_substr(trim(input('city')), 0, 80);
        $allowedCats = ['participant','teacher','parent'];
        if (in_array($category, $allowedCats, true)) $upd['category'] = $category;
        if ($avatar === '' || preg_match('~^https?://~i', $avatar) || str_starts_with($avatar, 'data:image/')) $upd['avatar'] = $avatar;
        // Категория «Педагог» — если пользователь ещё не teacher/jury/moderator, поднимаем роль до teacher
        if ($category === 'teacher' && !in_array((string)($user['role'] ?? ''), ['teacher','jury','moderator','admin','owner'], true)) {
            $upd['role'] = 'teacher';
        }
        update('users', $upd, 'id=:id', ['id' => $uid]);
        audit('profile_update', 'user', $uid);
        flash('Профиль обновлён.', 'success');
        redirect('/cabinet#settings');
    } elseif ($action === 'music_toggle') {
        $off = (int) !empty($_POST['music_off']);
        update('users', ['music_off' => $off], 'id=:id', ['id' => $uid]);
        flash($off ? 'Фоновая музыка выключена.' : 'Фоновая музыка включена.', 'success');
        redirect('/cabinet#settings');
    } elseif ($action === 'unlink') {
        $prov = input('provider');
        $col = ['vk'=>'vk_id','max'=>'max_id','tg'=>'tg_id','phone'=>'phone'][$prov] ?? '';
        if ($col) {
            update('users', [$col => ''], 'id=:id', ['id' => $uid]);
            if ($prov === 'phone') update('users', ['phone_verified' => 0], 'id=:id', ['id' => $uid]);
            flash('Метод входа отвязан.', 'success');
        }
        redirect('/cabinet#settings');
    } elseif ($action === 'password') {
        $cur = (string)($_POST['current_password'] ?? '');
        $new = (string)($_POST['new_password'] ?? '');
        $fresh = one("SELECT password_hash FROM users WHERE id=?", [$uid]);
        if (!$fresh['password_hash'] || !password_verify($cur, $fresh['password_hash'])) {
            flash('Текущий пароль указан неверно.', 'error');
        } elseif (mb_strlen($new) < 6) {
            flash('Новый пароль должен быть не короче 6 символов.', 'error');
        } else {
            update('users', ['password_hash' => password_hash($new, PASSWORD_DEFAULT)], 'id=:id', ['id' => $uid]);
            audit('password_change', 'user', $uid);
            flash('Пароль изменён.', 'success');
        }
        redirect('/cabinet');
    } elseif ($action === 'privacy') {
        // Конфиденциальность: users.privacy JSON (мягкий ALTER) + notify_email (существующая колонка).
        ensure_user_column('privacy', "TEXT DEFAULT ''");
        $priv = [
            'name_public'  => input('name_public') === 'initials' ? 'initials' : 'full',
            'notify_inapp' => isset($_POST['notify_inapp']) ? 1 : 0,
        ];
        update('users', [
            'privacy'      => json_encode($priv, JSON_UNESCAPED_UNICODE),
            'notify_email' => isset($_POST['notify_email']) ? 1 : 0,
        ], 'id=:id', ['id' => $uid]);
        audit('privacy_update', 'user', $uid, $priv);
        flash('Настройки конфиденциальности сохранены.', 'success');
        redirect('/cabinet#settings');
    } elseif ($action === 'phone_request') {
        // Привязка телефона: шаг 1 — SMS-код на номер. Без SMS-провайдера честно сообщаем.
        $phoneIn = input('phone');
        $digits = preg_replace('/\D+/', '', $phoneIn);
        if (strlen($digits) === 11 && ($digits[0] === '8' || $digits[0] === '7')) $digits = '7' . substr($digits, 1);
        elseif (strlen($digits) === 10) $digits = '7' . $digits;
        $vp = function_exists('v_phone') ? v_phone($phoneIn) : ['ok' => strlen($digits) === 11, 'formatted' => $phoneIn];
        if (!($vp['ok'] ?? false) || strlen($digits) !== 11 || $digits[0] !== '7') {
            flash('Проверьте номер телефона — нужен российский номер из 11 цифр.', 'error');
        } elseif (one("SELECT id FROM users WHERE (phone=? OR phone=?) AND phone_verified=1 AND id<>?",
                      [(string)($vp['formatted'] ?? ('+' . $digits)), $digits, $uid])) {
            flash('Этот номер уже привязан к другому аккаунту.', 'error');
        } elseif (!rate_ok('phone_bind:' . $uid, 5, 900)) {
            flash('Слишком часто. Подождите пару минут и попробуйте снова.', 'error');
        } else {
            $code = auth_gen_code(5);
            auth_store_code('phone_bind', $digits, $code, 600); // TTL 10 минут
            $sent = auth_send_sms($digits, 'Код привязки телефона на сайте Музыкальный Мир: ' . $code);
            if ($sent || cfgv('debug')) {
                $_SESSION['phone_bind'] = ['digits' => $digits, 'formatted' => (string)($vp['formatted'] ?? ('+' . $digits))];
                flash($sent ? 'Код отправлен по SMS на ' . ($vp['formatted'] ?? $phoneIn) . '. Введите его ниже.'
                            : 'SMS-провайдер не настроен (режим отладки). Код: ' . $code, $sent ? 'success' : 'info');
            } else {
                flash('SMS временно недоступна. Попробуйте позже или привяжите вход через ВКонтакте.', 'error');
            }
        }
        redirect('/cabinet#settings');
    } elseif ($action === 'phone_verify') {
        // Привязка телефона: шаг 2 — проверка кода, номер закрепляется за текущим аккаунтом.
        $pb = $_SESSION['phone_bind'] ?? null;
        $code = trim((string)($_POST['code'] ?? ''));
        if (!is_array($pb) || ($pb['digits'] ?? '') === '') {
            flash('Сначала запросите код на номер телефона.', 'error');
        } elseif ($code === '' || !auth_check_code('phone_bind', (string)$pb['digits'], $code)) {
            flash('Неверный или просроченный код. Запросите новый.', 'error');
        } elseif (one("SELECT id FROM users WHERE (phone=? OR phone=?) AND phone_verified=1 AND id<>?",
                      [(string)$pb['formatted'], (string)$pb['digits'], $uid])) {
            flash('Этот номер уже привязан к другому аккаунту.', 'error');
        } else {
            update('users', ['phone' => (string)$pb['formatted'], 'phone_verified' => 1], 'id=:id', ['id' => $uid]);
            unset($_SESSION['phone_bind']);
            audit('phone_bind', 'user', $uid, ['phone' => (string)$pb['formatted']]);
            flash('Телефон привязан к Вашему аккаунту.', 'success');
        }
        redirect('/cabinet#settings');
    } elseif ($action === 'phone_cancel') {
        unset($_SESSION['phone_bind']);
        redirect('/cabinet#settings');
    } elseif ($action === 'resend_verify') {
        // Повторное письмо подтверждения почты (для аккаунтов с email_verified=0).
        if ((int)($user['email_verified'] ?? 0) === 1) {
            flash('Почта уже подтверждена.', 'info');
        } elseif (trim((string)($user['email'] ?? '')) === '') {
            flash('У аккаунта не указана почта.', 'error');
        } elseif (!rate_ok('verify_mail:' . $uid, 3, 3600)) {
            flash('Письмо уже отправляли недавно. Проверьте почту и папку «Спам».', 'info');
        } elseif (function_exists('mail_queue')) {
            $tok = trim((string)($user['verify_token'] ?? ''));
            if ($tok === '') { $tok = bin2hex(random_bytes(16)); update('users', ['verify_token' => $tok], 'id=:id', ['id' => $uid]); }
            $link = url('/verify-email') . '?token=' . urlencode($tok);
            if (function_exists('mm_email_layout') && function_exists('mm_email_btn')) {
                $inner = '<p style="margin:0 0 14px;font-size:15px;color:#2a2a3a;">Здравствуйте'
                    . (trim((string)($user['full_name'] ?? '')) !== '' ? ', ' . h($user['full_name']) : '')
                    . '! Подтвердите адрес электронной почты в личном кабинете — нажмите кнопку ниже.</p>'
                    . mm_email_btn($link, 'Подтвердить почту')
                    . '<p style="margin:14px 0 0;font-size:12px;color:#8a7b58;">Если кнопка не открывается, скопируйте ссылку: ' . h($link) . '</p>';
                $html = mm_email_layout($inner, ['title' => 'Подтверждение почты']);
            } else {
                $html = '<p>Подтвердите почту: <a href="' . h($link) . '">' . h($link) . '</a></p>';
            }
            mail_queue((string)$user['email'], (string)($user['full_name'] ?? ''), 'Подтвердите почту — Культурного центра «Музыкальный Мир»', $html);
            audit('verify_resend', 'user', $uid);
            flash('Письмо со ссылкой подтверждения отправлено на ' . $user['email'] . '.', 'success');
        }
        redirect('/cabinet#settings');
    } elseif ($action === 'resend_diploma') {
        $dn = input('number');
        // Гарантируем загрузку почтового слоя (mail_queue) — иначе отправка «молча» не срабатывала.
        if (!function_exists('mail_queue') && is_file(BASE_PATH . '/core/mailer.php')) require_once BASE_PATH . '/core/mailer.php';
        $d = one("SELECT d.*, a.full_name AS a_name, a.email AS a_email, c.name AS comp_name
                    FROM diplomas d JOIN applications a ON a.id=d.application_id
                    JOIN competitions c ON c.id=a.competition_id
                   WHERE d.number=? AND a.user_id=?", [$dn, $uid]);
        if ($d && function_exists('mail_queue')) {
            // Тот же rich-шаблон и та же сборка PDF, что и при авто-отправке (библиотечный режим крона).
            if (!function_exists('_diploma_email_html')) {
                if (!defined('MM_EMAIL_TEST_LIB')) define('MM_EMAIL_TEST_LIB', 1);
                if (is_file(BASE_PATH . '/cron/send_diplomas.php')) require_once BASE_PATH . '/cron/send_diplomas.php';
            }
            $appRow = one("SELECT * FROM applications WHERE id=?", [(int) $d['application_id']]);
            $row = array_merge((array) $appRow, [
                'number'    => $d['number'],
                'type'      => (string) ($d['type'] ?? 'main'),
                'result'    => (string) ($d['result'] ?? ($appRow['result'] ?? '')),
                'comp_name' => (string) $d['comp_name'],
            ]);
            // Абсолютный путь PDF (собираем при необходимости) + фото для тела письма.
            $pdfAbs = ''; $imgUrl = '';
            if (function_exists('_diploma_files')) { [$pdfAbs, $imgUrl] = _diploma_files($row); $row['_img_url'] = $imgUrl; }
            if ($pdfAbs === '') {
                // Фолбэк: собрать PDF нашим HTML-рендером.
                if (is_file(BASE_PATH . '/core/diploma_render.php')) require_once BASE_PATH . '/core/diploma_render.php';
                if ($appRow && function_exists('diploma_pdf_html')) {
                    $rp = diploma_pdf_html($appRow, ['thanks' => (($d['type'] ?? '') === 'thanks')]);
                    if ($rp && is_file($rp)) $pdfAbs = $rp;
                }
            }
            $html = function_exists('_diploma_email_html')
                ? _diploma_email_html($row)
                : ('<p>Здравствуйте! Ваш диплом № ' . h($dn) . ' — <a href="' . h(url('/diploma/' . $dn . '.pdf')) . '">скачать PDF</a>.</p>');
            // На e-mail из заявки (фолбэк — почта аккаунта).
            $toMail = filter_var((string) $d['a_email'], FILTER_VALIDATE_EMAIL) ? (string) $d['a_email'] : (string) ($user['email'] ?? '');
            $subj   = 'Ваш диплом конкурса «' . (string) $d['comp_name'] . '» — № ' . $dn;
            $name   = (string) ($d['a_name'] ?: ($user['full_name'] ?? 'участник'));
            $attach = ($pdfAbs !== '' && is_file($pdfAbs)) ? $pdfAbs : '';

            // МОМЕНТАЛЬНО: участник нажал «отправить на почту» — письмо уходит сразу,
            // а не встаёт в очередь на минуты. Шаблон и отправитель те же, что при
            // штатной рассылке дипломов (наградный отдел), т.е. это точный дубль.
            $opt = [];
            if (function_exists('mail_senders')) {
                $nagradi = mail_senders()['nagradi'] ?? [];
                if ($nagradi) { $opt['account'] = $nagradi; $opt['from_name'] = 'Наградный отдел «Музыкальный Мир»'; }
            }
            if ($attach !== '') $opt['attach'] = $attach;
            $sentNow = false;
            if (function_exists('mail_send_failover')) {
                try { $sentNow = (bool) mail_send_failover($toMail, $subj, $html, $opt); } catch (\Throwable $e) { $sentNow = false; }
            } elseif (function_exists('mail_send')) {
                try { $sentNow = (bool) mail_send($toMail, $subj, $html, $opt); } catch (\Throwable $e) { $sentNow = false; }
            }
            // Если моментальная отправка не удалась (SMTP недоступен) — кладём в очередь
            // приоритетным письмом, чтобы оно ушло ближайшим тиком крона, а не потерялось.
            if (!$sentNow) mail_queue($toMail, $name, $subj, $html, $attach);
            audit('diploma_resend', 'diploma', (int) $d['id'], ['instant' => $sentNow, 'email' => $toMail]);

            $msg = $sentNow
                ? 'Диплом отправлен на ' . $toMail . ' — письмо уже в почте.'
                : 'Диплом поставлен в приоритетную отправку на ' . $toMail . ' — придёт в течение минуты.';
            if (input('ajax') === '1') json_out(['ok' => true, 'instant' => $sentNow, 'email' => $toMail, 'number' => (string) $dn, 'msg' => $msg]);
            flash($msg, 'success');
        } elseif ($d) {
            if (input('ajax') === '1') json_out(['ok' => false, 'msg' => 'Диплом готов к скачиванию в разделе «Дипломы».']);
            flash('Диплом готов к скачиванию в разделе «Дипломы».', 'info');
        } else {
            if (input('ajax') === '1') json_out(['ok' => false, 'msg' => 'Диплом не найден.']);
            flash('Диплом не найден.', 'error');
        }
        redirect('/cabinet');
    } elseif ($action === 'referral_create' && $isTeacher && user_can('teacher')) {
        if (is_file(BASE_PATH . '/core/loyalty.php')) require_once BASE_PATH . '/core/loyalty.php';
        if (function_exists('referral_create')) {
            // Проценты фиксированы правилами программы: 5% приглашённому, 5% пригласившему.
            $ref = referral_create($uid, trim(input('code')), REFERRAL_MAX_PCT, REFERRAL_REWARD_MAX_PCT);
            audit('referral_create', 'referrals', (int)($ref['id'] ?? 0), ['code' => $ref['code'] ?? '']);
            flash('Промокод «' . ($ref['code'] ?? '') . '» создан.', 'success');
        }
        redirect('/cabinet');
    } elseif ($action === 'edit_app') {
        // Редактирование своей заявки — ТОЛЬКО два рабочих дня со дня подачи
        // (core/app_status.php: app_edit_window). Дальше материал у жюри, и данные
        // обязаны совпадать с тем, что оценивалось и будет напечатано в дипломе.
        require_once BASE_PATH . '/core/app_status.php';
        require_once BASE_PATH . '/core/send_timing.php';
        require_once BASE_PATH . '/core/data.php';
        $appId = (int) input('app_id');
        $app = one("SELECT * FROM applications WHERE id=? AND user_id=?", [$appId, $uid]);
        if (!$app) {
            flash('Заявка не найдена.', 'error');
            redirect('/cabinet#apps');
        }
        $win = app_edit_window((array) $app);
        if (!$win['can']) {
            flash($win['reason'] !== '' ? $win['reason'] : 'Эту заявку уже нельзя изменить.', 'warning');
            redirect('/cabinet#apps');
        }

        // Собираем ВСЕ поля, которые участник заполняет при подаче (кроме галочек согласия).
        $isGroup = input('is_group') === '1' ? 1 : 0;
        $nomination = mb_substr(trim((string) input('nomination')), 0, 120);
        $subgroup   = mb_substr(trim((string) input('subgroup')), 0, 120);
        $formation  = mb_substr(trim((string) input('formation')), 0, 120);

        // Справочники — источник истины тот же, что и на подаче: чужие значения не принимаем.
        $noms = NOMINATIONS();
        if ($nomination !== '' && !isset($noms[$nomination])) $nomination = (string) $app['nomination'];
        $subOk = $nomination !== '' ? ($noms[$nomination] ?? []) : [];
        if ($subgroup !== '' && $subOk && !in_array($subgroup, $subOk, true)) $subgroup = '';
        $formOk = FORMATIONS_FOR($nomination);
        if ($formation !== '' && !in_array($formation, $formOk, true)) $formation = (string) $app['formation'];
        $age = mb_substr(trim((string) input('age_category')), 0, 60);
        if ($age !== '' && !in_array($age, AGE_CATEGORIES(), true)) $age = (string) $app['age_category'];

        $email = mb_strtolower(trim((string) input('email')));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) $email = (string) $app['email'];
        $city = trim((string) input('city'));
        if (function_exists('city_normalize') && ($cn = city_normalize($city)) !== '') $city = $cn;

        $data = [
            'is_group'     => $isGroup,
            'full_name'    => mb_substr(function_exists('v_fio') ? v_fio(input('full_name')) : trim((string) input('full_name')), 0, 200),
            'group_name'   => mb_substr(trim((string) input('group_name')), 0, 200),
            'birth_date'   => mb_substr(trim((string) input('birth_date')), 0, 20),
            'age_category' => $age,
            'nomination'   => $nomination,
            'subgroup'     => $subgroup,
            'formation'    => $formation,
            'work_title'   => mb_substr(function_exists('quote_title') ? quote_title((string) input('work_title')) : trim((string) input('work_title')), 0, 200),
            'teacher'      => mb_substr(function_exists('v_fio') ? v_fio(input('teacher')) : trim((string) input('teacher')), 0, 200),
            'institution'  => mb_substr(trim((string) input('institution')), 0, 200),
            'city'         => mb_substr($city, 0, 120),
            'email'        => mb_substr($email, 0, 190),
            'phone'        => mb_substr(trim((string) input('phone')), 0, 40),
            'address'      => mb_substr(trim((string) input('address')), 0, 300),
            'postal_index' => mb_substr(trim((string) input('postal_index')), 0, 20),
            'video_url'    => mb_substr(trim((string) input('video_url')), 0, 500),
        ];
        // Солист или коллектив: пустое имя не затираем — оставляем прежнее.
        if ($isGroup === 1 && $data['group_name'] === '') $data['group_name'] = (string) $app['group_name'];
        if ($isGroup === 0 && $data['full_name'] === '')  $data['full_name']  = (string) $app['full_name'];

        update('applications', $data, 'id=:wid', ['wid' => $appId]);
        // Правки участника обязаны попасть в диплом: сносим ещё не отправленные
        // наградные документы — крон соберёт их заново из обновлённой заявки.
        q("DELETE FROM diplomas WHERE application_id=? AND (sent_at IS NULL OR sent_at='')", [$appId]);
        audit('application_edit', 'application', $appId, ['fields' => array_keys($data)]);
        flash('Заявка обновлена. Изменения учтены во всех наградных документах.', 'success');
        redirect('/cabinet#apps');
    }
}

// --- Данные ---
// Колонка results_published_at может отсутствовать на старой БД — добавляем мягко,
// чтобы запрос ниже не падал 500 (создаётся также в admin/longcomp.php).
try { db()->exec("ALTER TABLE competitions ADD COLUMN results_published_at TEXT"); } catch (\Throwable $e) {}
require_once BASE_PATH . '/core/app_status.php';
require_once BASE_PATH . '/core/mailer.php';   // mm_vip_discount — единый размер скидки клуба
$apps = all("SELECT a.*, c.name AS comp_name, c.slug AS comp_slug, c.is_paid AS comp_paid,
                    c.results_mode AS comp_results_mode, c.results_date AS comp_results_date,
                    c.results_published_at AS comp_results_pub
             FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
             WHERE a.user_id=? ORDER BY a.created_at DESC", [$uid]);
// ГЛАВНОЕ ПРАВИЛО КАБИНЕТА: участник видит ровно то, что уже пришло к нему на почту.
// Пока письмо с результатом не отправлено (result_sent_at пуст) — ни звания, ни
// «Оценена» в кабинете нет, даже если жюри уже проставило оценку в админке.
foreach ($apps as &$_a) {
    $_longHidden = ((string)($_a['comp_results_mode'] ?? '') === 'list')
        && trim((string)($_a['comp_results_pub'] ?? '')) === '';
    // Результат ещё не доставлен участнику — прячем так же, как длинный до публикации.
    $_notDelivered = trim((string)($_a['result_sent_at'] ?? '')) === '';
    $_hide = $_longHidden || $_notDelivered;

    $_a['_state'] = app_state((array)$_a, false);        // состояние глазами участника
    $_a['_long_hidden'] = $_longHidden;
    if ($_hide) { $_a['result'] = ''; $_a['extra_diploma'] = ''; }
    $_a['_disp_status'] = (string) $_a['_state']['code'];
}
unset($_a);
// Дипломы в кабинете — ТОЛЬКО реально отправленные на почту (d.sent_at заполнен).
// Раньше показывались сразу после генерации: участник платного короткого конкурса
// видел дипломы в кабинете, пока они ещё стояли в очереди на отправку.
$diplomas = all("SELECT d.*, a.full_name, a.result AS app_result, c.name AS comp_name
                 FROM diplomas d
                 JOIN applications a ON a.id=d.application_id
                 LEFT JOIN competitions c ON c.id=a.competition_id
                 WHERE a.user_id=? AND d.sent_at IS NOT NULL AND d.sent_at <> ''
                 ORDER BY d.sent_at DESC, d.created_at DESC", [$uid]);
// Сколько наградных документов уже в пути (для честной подписи в кабинете).
$diplomasPending = (int) scalar(
    "SELECT COUNT(*) FROM diplomas d JOIN applications a ON a.id=d.application_id
      WHERE a.user_id=? AND (d.sent_at IS NULL OR d.sent_at='')", [$uid]);
$orders = all("SELECT * FROM awards_orders WHERE user_id=? ORDER BY created_at DESC", [$uid]);
$students = [];
$refCodes = []; $refUses = 0; $refReward = 0;
if ($isTeacher && ($user['full_name'] ?? '') !== '') {
    $students = all("SELECT a.*, c.name AS comp_name FROM applications a
                     LEFT JOIN competitions c ON c.id=a.competition_id
                     WHERE a.teacher=? ORDER BY a.created_at DESC", [$user['full_name']]);
}
if ($isTeacher) {
    if (is_file(BASE_PATH . '/core/loyalty.php')) require_once BASE_PATH . '/core/loyalty.php';
    if (function_exists('referral_stats')) {
        $refCodes = referral_stats($uid);
        foreach ($refCodes as $c) { $refUses += (int)$c['uses']; $refReward += (int)$c['reward_total']; }
    }
}

// Карты статусов покрывают ВСЮ лестницу core/app_status.php — иначе заявка со
// статусом making/made/extra/done рендерилась сырым кодом и выпадала из статистики.
$appStatus = ['new'=>['Новая','info'],'paid'=>['Оплачена','info'],'judging'=>['На оценке','warning'],
              'graded'=>['Оценена','success'],'making'=>['На изготовлении','warning'],
              'made'=>['Изготовлена','success'],'extra'=>['Доп. заказ','info'],
              'done'=>['Исполнена','success'],'sent'=>['Диплом отправлен','success'],
              'submitted'=>['Подана','info'],'pending'=>['Ожидает оплаты','warning'],
              'rejected'=>['Отклонена','error']];
// Стеклянные статус-бейджи раздела «Мои заявки и результаты»: label + цвет рамки (gold|blue|bord).
$appBadge = ['new'=>['Подана','blue'],'paid'=>['Оплачена','gold'],'judging'=>['На оценке','bord'],
             'graded'=>['Оценена','gold'],'making'=>['На изготовлении','bord'],
             'made'=>['Изготовлена','gold'],'extra'=>['Доп. заказ','blue'],
             'done'=>['Исполнена','gold'],'sent'=>['Диплом отправлен','gold'],
             'submitted'=>['Подана','blue'],'pending'=>['Ожидает оплаты','bord'],
             'rejected'=>['Отклонена','bord']];
// Окно заказа наград: 60 дней от graded_at — только если такая колонка реально есть в БД.
$hasGradedAt = $apps && array_key_exists('graded_at', $apps[0]);
// ОРИГИНАЛЫ (правило владельца): участнику на почту они не отправляются никогда —
// в кабинете видны ТОЛЬКО стадии изготовления и доставки: изготовление → отправка →
// прибыло. Файлы оригиналов участнику не показываются и не скачиваются.
$orderStatus = ['new'=>['Ожидает оплаты','warning'],'paid'=>['Изготовление','info'],'made'=>['Изготовление','info'],
                'shipped'=>['Отправка','warning'],'delivered'=>['Прибыло','success']];
// Конвейер статуса заказа оригиналов.
// Три стадии, как просил владелец. 'paid' и 'made' — одна стадия «Изготовление»:
// для участника разницы нет, заказ в работе.
$orderPipe   = ['paid', 'shipped', 'delivered'];
$orderPipeL  = ['Изготовление', 'Отправка', 'Прибыло'];
// Конвейер статуса заявки для инфографики-прогресса — единая лестница статусов.
$pipeline = ['new','judging','graded','making','made'];
$pipeLabels = ['Подана','На оценке','Оценена','Изготовление','Награды'];
$roleLabels = ['user'=>'Участник','teacher'=>'Педагог','jury'=>'Член жюри','designer'=>'Дизайнер',
               'accountant'=>'Бухгалтер','moderator'=>'Модератор','admin'=>'Администратор','owner'=>'Владелец'];

$icon = fn(string $p) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" style="flex:none">' . $p . '</svg>';
$icons = [
  'apps'    => $icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>'),
  'diploma' => $icon('<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'),
  'diplomas' => $icon('<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'),
  'students' => $icon('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11l2 2 4-4"/>'),
  'awards'  => $icon('<path d="M3 3h18v4H3zM4 7l1 13h14l1-13"/><path d="M9 12h6"/>'),
  'settings'=> $icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  'students'=> $icon('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11l2 2 4-4"/>'),
  'ref'     => $icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  'qr'      => $icon('<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3z"/><path d="M15 15h2v2h-2zM19 15h2M15 19h2v2M19 19h2v2"/>'),
  'dl'      => $icon('<path d="M12 3v12M7 11l5 4 5-4M4 21h16"/>'),
  'mail'    => $icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  'stats'   => $icon('<path d="M4 20V10M10 20V4M16 20v-6M22 20H2"/>'),
  'achievements' => $icon('<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'),
  'theme'   => $icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
];
$badgeMap = ['success'=>'open','error'=>'closed','warning'=>'judging','info'=>'intl'];
$badge = fn(string $label, string $type) => '<span class="badge badge--' . ($badgeMap[$type] ?? 'intl') . '">' . h($label) . '</span>';

// Инициалы для монограммы (если нет фото).
$initials = '';
$nameSrc = trim((string)($user['full_name'] ?? ''));
if ($nameSrc !== '') {
    foreach (preg_split('~\s+~u', $nameSrc) as $w) { if ($w !== '') $initials .= mb_substr($w, 0, 1); if (mb_strlen($initials) >= 2) break; }
} else {
    $initials = mb_substr((string)$user['email'], 0, 1);
}
$initials = mb_strtoupper($initials);
$avatar = trim((string)($user['avatar'] ?? ''));

/* --- Клуб постоянных участников: ВИП-галочка и строка статуса в настройках --- */
if (!function_exists('club_status') && is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
$club = function_exists('club_status') ? club_status($uid) : ['active' => false, 'expires_at' => null];
$isVip = !empty($club['active']);
// Показываем местное время: expires_at хранится в UTC (см. core/club.php).
$clubUntil = $isVip && !empty($club['expires_local']) ? ru_date(substr((string)$club['expires_local'], 0, 10)) : '';
// Золотая SVG-галочка верификации (круглый бейдж) — рядом с именем в шапке кабинета.
$vipBadge = '<span class="cab-vip" title="Участник Клуба"><svg viewBox="0 0 24 24" role="img" aria-label="Участник Клуба">'
    . '<circle cx="12" cy="12" r="11" fill="#C79322"/><circle cx="12" cy="12" r="11" fill="url(#mmVipG)"/>'
    . '<path d="M7.4 12.4l3 3.1 6.2-6.6" fill="none" stroke="#FFFDF6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
    . '<defs><linearGradient id="mmVipG" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">'
    . '<stop offset="0" stop-color="#EED27C"/><stop offset="1" stop-color="#B07E14"/></linearGradient></defs></svg></span>';

/* --- Конфиденциальность (users.privacy JSON): имя в результатах, письма, in-app --- */
$priv = json_decode((string)($user['privacy'] ?? ''), true);
if (!is_array($priv)) $priv = [];
$privNameFull = (($priv['name_public'] ?? 'full') !== 'initials');
$privInapp    = (int)($priv['notify_inapp'] ?? 1) === 1;

/* --- Привязка телефона: ожидание кода из SMS (шаг 2) --- */
$phonePending = is_array($_SESSION['phone_bind'] ?? null) ? (string)($_SESSION['phone_bind']['formatted'] ?? '') : '';

// Меню кабинета ($menuGroups) собирается ниже — после подсчёта достижений и статистики.

/* --- Достижения СЕЗОНА (сброс 1 января — каждый год новый сезон) --- */
require_once BASE_PATH . '/core/loyalty.php';
$season      = loyalty_season();
$seasonStart = loyalty_season_start();
$countApps    = count($apps);                                   // всего за всё время
$countDiplomas = count($diplomas);                              // получено на почту, всего
// Сезонные срезы — по ним и считаются достижения.
$seasonApps = array_values(array_filter($apps, fn($a) => (string)($a['created_at'] ?? '') >= $seasonStart));
$seasonDiplomas = array_values(array_filter($diplomas, fn($d) => (string)($d['sent_at'] ?? '') >= $seasonStart));
$countAppsS = count($seasonApps);
$countDipS  = count($seasonDiplomas);
$countGP = 0; $countL1 = 0;
foreach ($seasonApps as $a) {
    $r = mb_strtolower((string)($a['result'] ?? ''));
    if (str_contains($r, 'гран')) $countGP++;
    elseif (str_contains($r, 'i степ') || str_contains($r, '1 степ')) $countL1++;
}
// Скидка за достижения — максимум 5% и только в рамках сезона (core/loyalty.php).
$achDiscount = loyalty_discount($uid, (string)($user['email'] ?? ''));
$achTiers    = loyalty_tiers();
$achNextTier = null;
foreach ($achTiers as $t) { if ($countAppsS < $t['apps']) { $achNextTier = $t; break; } }

$achievements = [
  ['id'=>'first_step',  'title'=>'Первый шаг',        'desc'=>'Первая заявка в сезоне ' . $season,   'done'=> $countAppsS >= 1,  'ic'=>'star'],
  ['id'=>'first_prize', 'title'=>'Первая награда',    'desc'=>'Первый диплом получен в сезоне',      'done'=> $countDipS >= 1,   'ic'=>'medal'],
  ['id'=>'active_3',    'title'=>'Активный участник', 'desc'=>'3 заявки в сезоне — скидка 3%',       'done'=> $countAppsS >= 3,  'ic'=>'flame'],
  ['id'=>'active_5',    'title'=>'Постоянный участник','desc'=>'5 заявок в сезоне — скидка 5%',      'done'=> $countAppsS >= 5,  'ic'=>'flame'],
  ['id'=>'top_1',       'title'=>'Лауреат I',         'desc'=>'Диплом Лауреата I степени',           'done'=> $countL1 >= 1,    'ic'=>'trophy'],
  ['id'=>'grand_prix',  'title'=>'Гран-При',          'desc'=>'Абсолютная победа',                   'done'=> $countGP >= 1,    'ic'=>'crown'],
  ['id'=>'legend',      'title'=>'Легенда сезона',    'desc'=>'3+ Гран-При за сезон',                'done'=> $countGP >= 3,    'ic'=>'crown'],
  ['id'=>'reg',         'title'=>'Регистрация',       'desc'=>'Аккаунт создан — Добро пожаловать!', 'done'=> true,             'ic'=>'star'],
];
$achDoneCount = 0; foreach ($achievements as $a) if ($a['done']) $achDoneCount++;

// Уровень участника — тоже по сезону, чтобы прогресс сбрасывался вместе с достижениями.
$levelPoints = $countAppsS * 5 + $countDipS * 10 + $countGP * 50 + $countL1 * 30;
$level = min(20, 1 + intdiv($levelPoints, 100));
$nextLevelAt = $level * 100;
$prevLevelAt = ($level - 1) * 100;
$levelPct = max(0, min(100, ($levelPoints - $prevLevelAt) * 100 / max(1, $nextLevelAt - $prevLevelAt)));

$achIcons = [
  'star'   => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
  'medal'  => '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="14" r="7"/><path d="M8 2h8l-2 6H10z" opacity=".8"/></svg>',
  'flame'  => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s6 4 6 10a6 6 0 0 1-12 0c0-3 2-4 2-4s0 2 2 3c0-3 1-5 2-6 0-1 0-2 0-3z"/></svg>',
  'trophy' => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h12v4a6 6 0 0 1-12 0zM4 6h2v2a3 3 0 0 1-2 0zm14 0h2v2a3 3 0 0 1-2 0zM9 15h6v3H9z"/><rect x="7" y="18" width="10" height="3" rx="1"/></svg>',
  'crown'  => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 8l4 5 6-9 6 9 4-5v10H2z"/></svg>',
];

/* --- Данные для панели «Статистика» (мини-аналитика по заявкам) ---
   Считаем по ВЫЧИСЛЕННОМУ состоянию ($a['_state']['code']), а не по сырой колонке
   status: раньше коды making/made/extra/done/submitted в счётчик не попадали вовсе,
   и сумма по статусам не сходилась с числом заявок. */
$byMonth = [];
$byStatus = [];
foreach (array_keys($appStatus) as $_k) $byStatus[$_k] = 0;
$byResult = ['gp'=>0,'laur1'=>0,'laur2'=>0,'laur3'=>0,'dipl'=>0,'other'=>0];
$totalPaid = 0;
$cntGraded = 0;      // результат уже получен на почту
$cntJudging = 0;     // оценка проставлена, письмо с результатом в пути
$cntNew = 0;         // подана, жюри ещё не подвело итог
$cntRejected = 0;
foreach ($apps as $a) {
    $m = substr((string)($a['created_at'] ?? ''), 0, 7);
    if ($m !== '') $byMonth[$m] = ($byMonth[$m] ?? 0) + 1;
    $st = (string)($a['_state']['code'] ?? $a['status'] ?? 'new');
    if (!array_key_exists($st, $byStatus)) $byStatus[$st] = 0;
    $byStatus[$st]++;
    if (in_array($st, ['graded','making','made','extra','done'], true)) $cntGraded++;
    elseif ($st === 'rejected') $cntRejected++;
    elseif ($st === 'judging') $cntJudging++;
    elseif (in_array($st, ['new','paid','submitted','pending'], true)) $cntNew++;
    $r = mb_strtolower((string)($a['result'] ?? ''));
    if     (str_contains($r, 'гран')) $byResult['gp']++;
    elseif (str_contains($r, 'i степ') || str_contains($r, '1 степ')) $byResult['laur1']++;
    elseif (str_contains($r, 'ii степ') || str_contains($r, '2 степ')) $byResult['laur2']++;
    elseif (str_contains($r, 'iii степ') || str_contains($r, '3 степ')) $byResult['laur3']++;
    elseif ($r !== '' && str_contains($r, 'дипл')) $byResult['dipl']++;
    elseif ($r !== '') $byResult['other']++;
}
// Деньги участника: подтверждённые платежи за участие + оплаченные заказы наград.
// Колонка applications.amount_paid не заполняется платёжным потоком, поэтому
// раньше в кабинете всегда показывалось «0 ₽».
$totalPaid = (int) (scalar("SELECT COALESCE(SUM(p.amount),0) FROM payments p
                             JOIN applications a ON a.id=p.application_id
                            WHERE a.user_id=? AND p.status IN ('succeeded','paid')", [$uid]) ?? 0);
$totalPaid += (int) (scalar("SELECT COALESCE(SUM(amount),0) FROM awards_orders
                              WHERE user_id=? AND status IN ('paid','made','shipped','delivered')", [$uid]) ?? 0);
// Пустые статусы в разбивке не показываем — иначе колонки-нули засоряют график.
$byStatus = array_filter($byStatus, fn($v) => $v > 0);
ksort($byMonth);
$monthLabels = array_slice(array_keys($byMonth), -6);
$monthVals = array_values(array_intersect_key($byMonth, array_flip($monthLabels)));
$maxMonth = max([1, ...($monthVals ?: [0])]);

/* --- Меню кабинета в стиле настроек Telegram: группы → компактные строки-пункты.
       Формат пункта: [id, название, значение справа, цвет квадратика иконки] --- */
$menuGroups = [
  ['Конкурсы', [
    ['apps',     'Мои заявки',       (string)count($apps),     '#17307A'],
    ['diplomas', 'Мои дипломы',      (string)count($diplomas), '#C79322'],
    ['awards',   'Награды и заказы', (string)count($orders),   '#8E2438'],
  ]],
  ['Прогресс', [
    ['achievements', 'Достижения', $achDoneCount . ' из ' . count($achievements), '#2E7D4F'],
    ['stats',        'Статистика', 'Ур. ' . (int)$level,                          '#5B3A8E'],
  ]],
];
if ($isTeacher) {
    $menuGroups[] = ['Педагогу', [
      ['students', 'Мои ученики',            (string)count($students), '#1B6F7A'],
      ['ref',      'Реферальная программа',  $refCodes ? (string)count($refCodes) : '', '#B5651D'],
    ]];
}
$menuGroups[] = ['Аккаунт', [
  ['settings', 'Настройки', '', '#64748B'],
]];

ob_start(); ?>
<style>
.cab{max-width:960px;margin:0 auto}
/* --- Шапка профиля (компактная, в стиле настроек Telegram) --- */
.cab-hero{position:relative;overflow:hidden;border-radius:var(--radius-lg);padding:18px 20px;margin-bottom:18px;
  background:
    radial-gradient(680px 320px at 100% -30%,var(--gold-soft),transparent 62%),
    radial-gradient(520px 300px at -10% 130%,var(--gold-soft),transparent 60%),
    var(--panel);
  border:1px solid var(--glass-brd);box-shadow:var(--shadow-3d);backdrop-filter:blur(18px)}
.cab-hero::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background:repeating-linear-gradient(180deg,transparent 0 13px,var(--line) 13px 14px);
  -webkit-mask:radial-gradient(120% 90% at 88% -10%,#000,transparent 62%);
  mask:radial-gradient(120% 90% at 88% -10%,#000,transparent 62%)}
.cab-hero::after{content:"";position:absolute;left:0;right:0;top:0;height:3px;z-index:2;background:var(--grad-gold);opacity:.9}
.cab-hero-note{position:absolute;top:-14px;right:-6px;width:110px;height:110px;z-index:0;color:var(--gold);opacity:.09;pointer-events:none}
.cab-hero-top{position:relative;z-index:1;display:flex;gap:14px;align-items:center}
.cab-ava{width:60px;height:60px;border-radius:18px;flex:none;position:relative;overflow:hidden;
  background:var(--grad-gold);color:var(--gold-fg);display:flex;align-items:center;justify-content:center;
  font-family:var(--ff-display);font-weight:800;font-size:1.5rem;
  box-shadow:0 12px 30px -8px rgba(139,111,31,.5),inset 0 0 24px color-mix(in srgb,var(--gold-fg) 16%,transparent),0 0 0 1px var(--glass-brd)}
.cab-ava::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.4);background:linear-gradient(160deg,rgba(255,255,255,.28),transparent 45%)}
.cab-ava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cab-id{min-width:0;flex:1}
.cab-id h1{font-family:var(--ff-display);font-size:clamp(1.2rem,4vw,1.6rem);line-height:1.1;margin:0 0 4px;overflow-wrap:anywhere}
.cab-role{display:inline-flex;align-items:center;gap:6px;font-size:.62rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
  padding:3px 10px;border-radius:999px;background:var(--gold-soft);color:var(--gold-2);border:1px solid var(--glass-brd);
  box-shadow:inset 0 0 12px var(--gold-soft)}
.cab-role::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--grad-gold);box-shadow:0 0 8px var(--gold)}
.cab-email{display:block;color:var(--muted);font-size:.82rem;margin-top:5px;overflow-wrap:anywhere}
/* --- Меню кабинета в стиле настроек Telegram: группы стеклянных карточек, компактные строки-пункты --- */
.cab-menu{display:flex;flex-direction:column;gap:16px;margin-bottom:20px}
.cab-group-ttl{font-size:.7rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:0 0 6px;padding:0 16px}
.cab-group-card{background:var(--glass-card,var(--panel));border:1px solid var(--glass-brd);border-radius:var(--radius);
  overflow:hidden;box-shadow:var(--shadow-card);backdrop-filter:blur(14px)}
.cab-item{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:46px;padding:6px 14px;
  background:none;border:none;cursor:pointer;color:var(--text);text-align:left;font:inherit;text-decoration:none;
  transition:background .15s;-webkit-tap-highlight-color:transparent}
.cab-item:hover{background:var(--glass)}
.cab-item + .cab-item::before{content:"";position:absolute;left:56px;right:0;top:0;height:1px;background:var(--line)}
.cab-item-ic{width:30px;height:30px;border-radius:8px;flex:none;display:flex;align-items:center;justify-content:center;
  background:var(--ic,#64748B);color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
.cab-item-ic svg{width:17px;height:17px;stroke:#fff}
.cab-item-lbl{flex:1;min-width:0;font-weight:600;font-size:.93rem;overflow-wrap:anywhere}
.cab-item-val{flex:none;color:var(--muted);font-size:.84rem;font-weight:700}
.cab-item-chev{flex:none;color:var(--muted);opacity:.55;width:16px;height:16px}
.cab-item--danger .cab-item-lbl{color:var(--error,#B3261E);font-weight:700}
.cab-item--danger .cab-item-ic{background:#B3392E}
.cab-item--danger:hover{background:color-mix(in srgb,#B3392E 8%,transparent)}
/* --- ВИП-галочка члена Клуба (в шапке, рядом с именем) --- */
.cab-vip{display:inline-flex;vertical-align:-2px;margin-left:6px;width:20px;height:20px;flex:none;
  filter:drop-shadow(0 2px 5px rgba(199,147,34,.55))}
.cab-vip svg{width:100%;height:100%}
/* --- Настройки в стиле Telegram: группы строк, раскрывающиеся секции --- */
.cab-sets{display:flex;flex-direction:column;gap:16px}
.cab-sub{display:block;font-weight:500;font-size:.76rem;color:var(--muted);margin-top:1px;overflow-wrap:anywhere}
.cab-set{border:none;margin:0}
.cab-set + .cab-set,.cab-set + .cab-srow,.cab-srow + .cab-set,.cab-srow + .cab-srow{border-top:1px solid var(--line)}
.cab-set > summary{list-style:none;display:flex;align-items:center;gap:12px;min-height:48px;padding:7px 14px;
  cursor:pointer;transition:background .15s;-webkit-tap-highlight-color:transparent}
.cab-set > summary::-webkit-details-marker{display:none}
.cab-set > summary:hover{background:var(--glass)}
.cab-set > summary .cab-item-chev{transition:transform .2s}
.cab-set[open] > summary .cab-item-chev{transform:rotate(90deg)}
.cab-set-body{padding:6px 16px 20px}
.cab-set-body .field:last-of-type{margin-bottom:14px}
.cab-srow{display:flex;align-items:center;gap:12px;min-height:48px;padding:7px 14px}
.cab-srow form{margin:0}
.cab-link-ok{display:inline-flex;align-items:center;gap:5px;color:var(--gold-2);font-size:.8rem;font-weight:800}
.cab-link-ok svg{width:14px;height:14px}
.cab-link-no{color:var(--muted);font-size:.8rem;font-weight:600}
:root:not([data-theme="dark"]) .cab-link-ok{color:var(--gold-ink)}
.cab-set-body .switch{padding:13px 0}
/* --- Кнопка «Назад» из раздела в меню --- */
.cab-back{display:none;align-items:center;gap:6px;margin:0 0 12px;background:none;border:none;cursor:pointer;
  color:var(--gold-2);font-weight:700;font-size:.93rem;padding:8px 4px;min-height:44px;font-family:inherit}
.cab-back svg{width:18px;height:18px;flex:none}
.cab.is-section .cab-back{display:inline-flex}
.cab.is-section .cab-menu{display:none}
:root:not([data-theme="dark"]) .cab-back{color:var(--gold-ink)}
/* --- Панели / карточки --- */
.cab-vip-hint{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap;
  margin:0 0 16px;padding:14px 18px;border-radius:var(--radius-sm);
  background:linear-gradient(135deg,color-mix(in srgb,var(--gold) 16%,transparent),transparent 70%),var(--panel);
  border:1px solid color-mix(in srgb,var(--gold) 40%,transparent)}
.cab-vip-hint--on{background:linear-gradient(135deg,color-mix(in srgb,var(--gold) 24%,transparent),transparent 70%),var(--panel)}
.cab-vip-hint__txt{min-width:0;flex:1 1 260px}
.cab-vip-hint__txt b{display:block;font-family:var(--ff-display);font-size:1.05rem;letter-spacing:.01em}
.cab-vip-hint__txt span{display:block;margin-top:3px;color:var(--muted);font-size:.86rem;line-height:1.45}
@media (max-width:560px){.cab-vip-hint{padding:13px 15px}.cab-vip-hint .btn{width:100%}}
.cab-panel{display:none}
.cab-panel.active{display:block;animation:cabFade .45s cubic-bezier(.2,.8,.2,1)}
@keyframes cabFade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.cab-panel h2{font-family:var(--ff-display);font-size:clamp(1.4rem,4vw,1.9rem);margin:0 0 16px}
.cab-card{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:20px 22px;
  box-shadow:var(--shadow-card);margin-bottom:16px;backdrop-filter:blur(14px);transition:transform .25s,box-shadow .25s}
.cab-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--grad-gold);opacity:0;transition:opacity .25s}
.cab-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-card),var(--shadow-glow)}
.cab-card:hover::before{opacity:.85}
.cab-card.cab-empty::before,.cab-card.cab-empty:hover{transform:none}
.cab-row{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}
.cab-ttl{font-family:var(--ff-serif);font-size:1.12rem;font-weight:700;overflow-wrap:anywhere}
.cab-meta{color:var(--muted);font-size:.9rem;margin:6px 0 0;overflow-wrap:anywhere}
.cab-result{color:var(--gold-2);font-weight:800;margin-top:6px}
/* --- Статус-бейджи заявок: стекло + цветная рамка (золото / синий / бордо) --- */
.cab{--cab-bord:#8E2438}
[data-theme="dark"] .cab{--cab-bord:#E08A9B}
.cab-status{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border-radius:999px;white-space:nowrap;
  font-size:.7rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
  background:var(--glass);backdrop-filter:blur(8px);border:1.5px solid var(--glass-brd);box-shadow:var(--shadow-soft)}
.cab-status::before{content:"";width:7px;height:7px;border-radius:50%;flex:none;background:currentColor;box-shadow:0 0 8px currentColor}
.cab-status--gold{color:var(--gold-ink);border-color:color-mix(in srgb,var(--gold) 55%,transparent);
  background:linear-gradient(180deg,var(--gold-soft),transparent 80%),var(--glass)}
.cab-status--blue{color:var(--info);border-color:color-mix(in srgb,var(--info) 45%,transparent);
  background:linear-gradient(180deg,color-mix(in srgb,var(--info) 10%,transparent),transparent 80%),var(--glass)}
.cab-status--bord{color:var(--cab-bord);border-color:color-mix(in srgb,var(--cab-bord) 50%,transparent);
  background:linear-gradient(180deg,color-mix(in srgb,var(--cab-bord) 10%,transparent),transparent 80%),var(--glass)}
/* --- Данные заявки: компактная стеклянная сетка «метка — значение» --- */
.cab-info{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;margin:12px 0 0;padding:12px 15px;
  border-radius:var(--radius-sm);background:var(--glass);border:1px solid var(--glass-brd);
  backdrop-filter:blur(8px);font-size:.85rem;line-height:1.4}
.cab-info dt{color:var(--muted);white-space:nowrap;font-weight:500}
.cab-info dd{margin:0;color:var(--text);font-weight:600;min-width:0;hyphens:none;word-break:normal;overflow-wrap:break-word}
/* --- Результат: крупно золотом + доп. диплом + комментарий жюри --- */
.cab-result-big{margin:16px 0 0;font-family:var(--ff-display);font-weight:800;line-height:1.12;
  font-size:clamp(1.35rem,4.5vw,1.85rem);letter-spacing:.02em;display:inline-block;hyphens:none;word-break:normal;
  background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
.cab-extra{margin:8px 0 0;font-size:.92rem;font-weight:700;color:var(--gold-2);hyphens:none;word-break:normal}
.cab-extra span{color:var(--muted);font-weight:500}
.cab-jury{margin:8px 0 0;font-size:.9rem;font-style:italic;color:var(--text-dim);hyphens:none;word-break:normal}
.cab-order-gone{margin:12px 0 0;font-size:.85rem;color:var(--muted)}
:root:not([data-theme="dark"]) .cab-extra{color:var(--gold-ink)}
@media(max-width:560px){
  .cab-info{grid-template-columns:1fr;gap:2px}
  .cab-info dt{margin-top:7px}
  .cab-info dt:first-child{margin-top:0}
}
.cab-empty{text-align:center;color:var(--muted);padding:44px 20px}
.cab-empty svg{width:40px;height:40px;opacity:.5;margin:0 auto 12px;display:block}
.cab-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
/* --- Прогресс-конвейер заявки --- */
.cab-steps{display:flex;align-items:flex-start;gap:0;margin-top:18px}
.cab-step{flex:1;text-align:center;position:relative;min-width:0}
.cab-step::before{content:"";position:absolute;top:9px;left:-50%;width:100%;height:2px;background:var(--line)}
.cab-step:first-child::before{display:none}
.cab-step.done::before{background:var(--grad-gold)}
.cab-dot{width:22px;height:22px;border-radius:50%;margin:0 auto;position:relative;z-index:1;
  background:var(--panel-solid);border:2px solid var(--line);transition:.3s}
.cab-step.done .cab-dot{background:var(--grad-gold);border-color:transparent;box-shadow:0 4px 12px -3px rgba(139,111,31,.5)}
.cab-step.done .cab-dot::after{content:"";position:absolute;left:7px;top:4px;width:5px;height:9px;
  border:solid var(--gold-fg);border-width:0 2px 2px 0;transform:rotate(42deg)}
.cab-step.here .cab-dot{box-shadow:0 0 0 5px var(--gold-soft)}
.cab-step.here .cab-dot::after{opacity:.55}
.cab-step small{display:block;font-size:.68rem;color:var(--muted);margin-top:7px;overflow-wrap:anywhere}
.cab-step.done small{color:var(--text-dim);font-weight:700}
.cab-bar{height:8px;border-radius:999px;background:var(--gold-soft);overflow:hidden;margin-top:16px}
.cab-bar i{display:block;height:100%;border-radius:999px;background:var(--grad-gold);width:0;transition:width 1s cubic-bezier(.2,.8,.2,1)}
.cab-reject{margin-top:14px;color:var(--error);font-weight:700;font-size:.9rem}
/* --- Тумблер --- */
.switch{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--line)}
.switch:last-of-type{border-bottom:none}
.switch-txt strong{display:block;font-weight:700;font-size:.98rem}
.switch-txt span{display:block;color:var(--muted);font-size:.82rem;margin-top:3px}
.switch input{position:absolute;opacity:0;width:0;height:0}
.switch-ui{flex:none;width:52px;height:30px;border-radius:999px;background:var(--line);position:relative;cursor:pointer;transition:.3s;border:1px solid var(--glass-brd)}
.switch-ui::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--panel-solid);box-shadow:0 2px 6px rgba(0,0,0,.2);transition:.3s}
.switch input:checked + .switch-ui{background:var(--grad-gold)}
.switch input:checked + .switch-ui::after{transform:translateX(22px)}
.switch input:focus-visible + .switch-ui{box-shadow:0 0 0 3px var(--gold-soft)}
/* --- Аватар-редактор в настройках --- */
.cab-avaedit{display:flex;gap:16px;align-items:center;margin-bottom:18px}
.cab-avaedit .cab-ava{width:60px;height:60px;border-radius:18px;font-size:1.5rem}
/* --- Реферальные KPI --- */
.cab-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:18px}
.cab-kpi{position:relative;overflow:hidden;padding:20px 18px;border-radius:var(--radius-sm);
  background:radial-gradient(200px 120px at 100% 0,var(--gold-soft),transparent 70%),var(--panel);
  border:1px solid var(--glass-brd);text-align:center;backdrop-filter:blur(10px);box-shadow:var(--shadow-soft)}
.cab-kpi::before{content:"";position:absolute;left:0;top:0;right:0;height:2px;background:var(--grad-gold);opacity:.7}
.cab-kpi b{display:block;font-family:var(--ff-display);font-size:2.1rem;line-height:1;
  background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.cab-kpi span{display:block;color:var(--muted);font-size:.8rem;margin-top:7px}
.cab-code{display:inline-flex;align-items:center;gap:10px;font-family:var(--ff-body);font-weight:800;letter-spacing:.08em;
  font-size:1.05rem;padding:8px 16px;border-radius:var(--radius-sm);background:var(--gold-soft);color:var(--gold);border:1px dashed var(--glass-brd)}
.cab-copy{cursor:pointer;background:none;border:none;color:var(--gold-2);display:inline-flex;padding:4px}
.cab-logout{display:inline-flex;align-items:center;gap:8px;margin-top:8px;color:var(--muted);font-size:.9rem;font-weight:600}
.cab-logout:hover{color:var(--error)}
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch}
/* Контраст: золотой ТЕКСТ на светлой теме тускнеет — затемняем до gold-ink (как в style.css) */
:root:not([data-theme="dark"]) .cab-role,
:root:not([data-theme="dark"]) .cab-result,
:root:not([data-theme="dark"]) .cab-code{color:var(--gold-ink)}
/* --- Кнопка «Паспорт участника» --- */
.cab-passport{margin-bottom:16px}
@media(max-width:560px){
  .cab-ava{width:52px;height:52px;border-radius:15px;font-size:1.3rem}
  .cab-hero{padding:15px 16px}
  .cab-step small{font-size:.6rem}
}
/* --- Форма правки заявки (окно 2 рабочих дня) --- */
.cab-edit-note{margin:0 0 4px;padding:10px 12px;border-radius:12px;background:var(--gold-soft,#FFF6E9);
  border:1px solid var(--glass-brd,#F0D9A8);color:var(--gold-ink,#8B6F1F);font-size:.85rem;line-height:1.5}
.cab-edit-form .field label{display:block;font-size:.8rem;color:var(--muted);margin-bottom:4px}
.cab-edit-form .field input,.cab-edit-form .field select{width:100%}
.cab-seg{display:flex;gap:6px;padding:4px;border-radius:12px;background:var(--panel-solid,#fff);border:1px solid var(--line)}
.cab-seg label{flex:1;text-align:center;padding:8px 10px;border-radius:9px;cursor:pointer;font-size:.88rem;font-weight:600;transition:.15s}
.cab-seg label.on{background:var(--grad-gold);color:var(--gold-fg,#fff)}
.cab-seg input{position:absolute;opacity:0;width:0;height:0}
@media(prefers-reduced-motion:reduce){
  .cab-panel.active{animation:none}
  .cab-card,.cab-item,.cab-step,.cab-step::before,.cab-dot,.switch-ui,.switch-ui::after{transition:none}
  .cab-card:hover{transform:none}
  .cab-bar i{transition:none}
}
</style>
<section class="section">
  <div class="container">
    <div class="cab">

      <!-- Шапка профиля -->
      <div class="cab-hero reveal">
        <svg class="cab-hero-note" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <div class="cab-hero-top">
          <div class="cab-ava">
            <?php if ($avatar !== ''): ?><img src="<?= h($avatar) ?>" alt="Фото профиля: <?= h($user['full_name'] ?: 'участник') ?>" loading="lazy"><?php else: ?><?= h($initials) ?><?php endif; ?>
          </div>
          <div class="cab-id">
            <h1><?= h($user['full_name'] ?: 'Участник') ?><?= $isVip ? $vipBadge : '' ?></h1>
            <span class="cab-role"><?= h($roleLabels[$user['role']] ?? 'Участник') ?></span>
            <span class="cab-email"><?= h($user['email']) ?><?php if (trim((string)($user['phone'] ?? '')) !== ''): ?> &middot; <?= h($user['phone']) ?><?php endif; ?></span>
          </div>
        </div>
      </div>

      <!-- Меню кабинета (вертикальные группы, как в настройках Telegram) -->
      <nav class="cab-menu" id="cabMenu" aria-label="Разделы кабинета">
        <?php foreach ($menuGroups as [$gTitle, $gItems]): ?>
        <div class="cab-group reveal">
          <div class="cab-group-ttl"><?= h($gTitle) ?></div>
          <div class="cab-group-card">
            <?php foreach ($gItems as [$id, $label, $val, $col]): ?>
            <button type="button" class="cab-item" data-tab="<?= h($id) ?>" style="--ic:<?= h($col) ?>">
              <span class="cab-item-ic"><?= $icons[$id] ?? $icons['settings'] ?></span>
              <span class="cab-item-lbl"><?= h($label) ?></span>
              <?php if ($val !== ''): ?><span class="cab-item-val"><?= h($val) ?></span><?php endif; ?>
              <svg class="cab-item-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
            </button>
            <?php endforeach; ?>
          </div>
        </div>
        <?php endforeach; ?>
        <div class="cab-group reveal">
          <div class="cab-group-card">
            <a class="cab-item cab-item--danger" href="<?= url('/logout') ?>">
              <span class="cab-item-ic"><?= $icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>') ?></span>
              <span class="cab-item-lbl">Выйти из аккаунта</span>
              <svg class="cab-item-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
            </a>
          </div>
        </div>
      </nav>

      <!-- Кнопка возврата из раздела в меню -->
      <button type="button" class="cab-back" id="cabBack">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>
        Личный кабинет
      </button>

      <div class="cab-main">

        <!-- Мои заявки -->
        <div class="cab-panel" id="tab-apps" role="tabpanel">
          <h2>Мои заявки и результаты</h2>

          <?php /* Напоминание о ВИП-клубе: встроенная полоса в потоке страницы —
                    НЕ всплывающее окно, ничего не перекрывает. Тем, кто уже в клубе,
                    вместо неё показывается статус членства. */ ?>
          <?php if (empty($club['active'])): ?>
            <div class="cab-vip-hint">
              <div class="cab-vip-hint__txt">
                <b>ВИП-клуб — выгоднее на <?= (int) mm_vip_discount() ?>%</b>
                <span>Скидка <?= (int) mm_vip_discount() ?>% на участие и награды, результаты и дипломы за 3 рабочих дня вместо 5, бесплатный конкурс каждый месяц.</span>
              </div>
              <a class="btn btn--primary btn--sm" href="<?= url('/club') ?>">Подробнее</a>
            </div>
          <?php else: ?>
            <div class="cab-vip-hint cab-vip-hint--on">
              <div class="cab-vip-hint__txt">
                <b>Вы участник ВИП-клуба</b>
                <span>Скидка <?= (int) ($club['discount'] ?? mm_vip_discount()) ?>% применяется автоматически, сроки — 3 рабочих дня.
                  <?= !empty($club['staff']) ? 'Доступ оргкомитета — бессрочно.'
                      : (!empty($club['expires_local']) ? 'Действует до ' . h(ru_date(substr((string)$club['expires_local'],0,10))) . '.' : '') ?></span>
              </div>
              <a class="btn btn--ghost btn--sm" href="<?= url('/club') ?>">Мои привилегии</a>
            </div>
          <?php endif; ?>
          <?php if (!$apps): ?>
            <div class="cab-card cab-empty">
              <?= $icons['apps'] ?>
              <p>У Вас пока нет заявок.</p>
              <a class="btn btn--primary" href="<?= url('/apply') ?>">Подать заявку</a>
            </div>
          <?php else: foreach ($apps as $k => $a):
            $dispStatus = (string)($a['_disp_status'] ?? $a['status']);   // маскированный для показа (длинные до публикации)
            [$bl,$bc] = $appBadge[$dispStatus] ?? [(string)$dispStatus,'blue'];
            $isRej = $a['status'] === 'rejected';
            // Бесплатный конкурс — БЕЗ шага «Оплата» (её нет, статус не может быть выполнен).
            $isFreeComp = isset($a['comp_paid']) && (int)$a['comp_paid'] !== 1;
            $pipe    = $isFreeComp ? ['new','judging','graded','sent'] : $pipeline;
            $pLabels = $isFreeComp ? ['Подана','Оценка','Оценена','Диплом'] : $pipeLabels;
            $cur = array_search($dispStatus, $pipe, true);
            if ($cur === false) $cur = 0;
            $pct = $isRej ? 100 : (int)round(($cur + 1) / count($pipe) * 100);
            // ФИО / Коллектив / Возрастная категория / Номинация / Преподаватель / Учреждение / Конкурсный номер
            $info = [];
            if (trim((string)($a['full_name'] ?? '')) !== '')    $info[] = ['ФИО', $a['full_name']];
            if (trim((string)($a['group_name'] ?? '')) !== '')   $info[] = ['Коллектив', $a['group_name']];
            if (trim((string)($a['age_category'] ?? '')) !== '') $info[] = ['Возрастная категория', $a['age_category']];
            if (trim((string)($a['nomination'] ?? '')) !== '')   $info[] = ['Номинация', $a['nomination']];
            if (trim((string)($a['teacher'] ?? '')) !== '')      $info[] = ['Преподаватель', $a['teacher']];
            if (trim((string)($a['institution'] ?? '')) !== '')  $info[] = ['Учреждение', $a['institution']];
            if (trim((string)($a['number'] ?? '')) !== '')       $info[] = ['Конкурсный номер', $a['number']];
            // Кнопка «Заказать награды»: результат есть и не прошло 60 дней от graded_at (если колонка есть).
            $canOrder = !empty($a['result']);
            if ($canOrder && $hasGradedAt && trim((string)($a['graded_at'] ?? '')) !== '') {
                $gts = strtotime((string)$a['graded_at']);
                if ($gts !== false && (time() - $gts) > 60 * 86400) $canOrder = false;
            } ?>
            <div class="cab-card reveal" style="--i:<?= $k ?>">
              <div class="cab-row">
                <div style="min-width:0">
                  <span class="cab-ttl"><?= h($a['comp_name'] ?: 'Конкурс') ?></span>
                  <?php if (!empty($a['work_title'])): ?><p class="cab-meta">«<?= h($a['work_title']) ?>»</p><?php endif; ?>
                  <p class="cab-meta">Подана <?= h(ru_date(substr((string)$a['created_at'],0,10))) ?></p>
                </div>
                <div style="text-align:right"><span class="cab-status cab-status--<?= h($bc) ?>"><?= h($bl) ?></span></div>
              </div>
              <?php if ($info): ?>
                <dl class="cab-info">
                  <?php foreach ($info as [$il,$iv]): ?><dt><?= h($il) ?></dt><dd><?= h($iv) ?></dd><?php endforeach; ?>
                </dl>
              <?php endif; ?>
              <?php // Неоплаченная заявка на ПЛАТНЫЙ конкурс — кнопка «Оплатить заявку».
                    $needsPay = (int)($a['comp_paid'] ?? 0) === 1 && (int)($a['is_paid'] ?? 0) !== 1 && !$isRej;
                    if ($needsPay): ?>
                <div class="cab-pay-note" style="margin-top:12px;background:#FFF6E9;border:1px solid #F0D9A8;border-radius:12px;padding:12px 16px">
                  <p style="margin:0 0 10px;font-size:.9rem;color:#8B6F1F">Заявка не оплачена. Оплатите оргвзнос, чтобы она была принята и передана жюри.</p>
                  <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <button type="button" class="btn btn--primary btn--sm" data-app-pay="<?= (int)$a['id'] ?>">Оплатить заявку</button>
                    <button type="button" class="btn btn--ghost btn--sm" data-app-del="<?= (int)$a['id'] ?>">Удалить</button>
                  </div>
                </div>
              <?php endif; ?>
              <?php
                /* Окно правки — ДВА РАБОЧИХ ДНЯ со дня подачи (core/app_status.php).
                   Показываем и когда можно, и когда уже нельзя — чтобы человек понимал
                   правило, а не гадал, куда делась кнопка. */
                $win = app_edit_window((array)$a);
                $winUntil = $win['until'] !== '' ? app_state_dt($win['until']) : '';
                $editGroup = (int)($a['is_group'] ?? 0) === 1;
                $eNom = (string)($a['nomination'] ?? '');
                $eSubs = NOMINATIONS()[$eNom] ?? [];
              ?>
              <?php if ($win['can']): ?>
                <details class="cab-edit" style="margin-top:8px">
                  <summary style="cursor:pointer;color:var(--gold-ink,#8B6F1F);font-weight:700;font-size:.9rem;list-style:none">Изменить заявку</summary>
                  <form method="post" action="<?= url('/cabinet') ?>" class="cab-edit-form" data-edit-form style="margin-top:12px;display:grid;gap:10px">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="edit_app">
                    <input type="hidden" name="app_id" value="<?= (int)$a['id'] ?>">

                    <p class="cab-edit-note">Изменить заявку можно только в течение <b>двух рабочих дней</b> со дня подачи<?= $winUntil !== '' ? ' — до <b>' . h($winUntil) . '</b>' : '' ?>. Дальше материал уходит жюри, и данные должны совпадать с тем, что будет напечатано в дипломе.</p>

                    <div class="cab-seg">
                      <label class="<?= $editGroup ? '' : 'on' ?>"><input type="radio" name="is_group" value="0" <?= $editGroup ? '' : 'checked' ?>>Солист</label>
                      <label class="<?= $editGroup ? 'on' : '' ?>"><input type="radio" name="is_group" value="1" <?= $editGroup ? 'checked' : '' ?>>Коллектив</label>
                    </div>

                    <div class="field" style="margin:0" data-when="solo" <?= $editGroup ? 'hidden' : '' ?>><label>Фамилия Имя Отчество участника</label><input type="text" name="full_name" value="<?= h($a['full_name'] ?? '') ?>"></div>
                    <div class="field" style="margin:0" data-when="group" <?= $editGroup ? '' : 'hidden' ?>><label>Название коллектива</label><input type="text" name="group_name" value="<?= h($a['group_name'] ?? '') ?>"></div>

                    <div class="field" style="margin:0"><label>Дата рождения</label><input type="date" name="birth_date" value="<?= h(substr((string)($a['birth_date'] ?? ''), 0, 10)) ?>"></div>
                    <div class="field" style="margin:0"><label>Возрастная категория</label>
                      <select name="age_category">
                        <option value="">Выберите категорию</option>
                        <?php foreach (AGE_CATEGORIES() as $ac): ?>
                          <option value="<?= h($ac) ?>" <?= (string)($a['age_category'] ?? '') === $ac ? 'selected' : '' ?>><?= h($ac) ?></option>
                        <?php endforeach; ?>
                      </select>
                    </div>

                    <div class="field" style="margin:0"><label>Номинация</label>
                      <select name="nomination" data-edit-nom>
                        <option value="">Выберите номинацию</option>
                        <?php foreach (array_keys(NOMINATIONS()) as $n): ?>
                          <option value="<?= h($n) ?>" <?= $eNom === $n ? 'selected' : '' ?>><?= h($n) ?></option>
                        <?php endforeach; ?>
                      </select>
                    </div>
                    <div class="field" style="margin:0" data-edit-subwrap <?= $eSubs ? '' : 'hidden' ?>><label>Подраздел</label>
                      <select name="subgroup" data-edit-sub>
                        <option value="">Выберите подраздел</option>
                        <?php foreach ($eSubs as $sg): ?>
                          <option value="<?= h($sg) ?>" <?= (string)($a['subgroup'] ?? '') === $sg ? 'selected' : '' ?>><?= h($sg) ?></option>
                        <?php endforeach; ?>
                      </select>
                    </div>
                    <div class="field" style="margin:0"><label>Форма исполнения</label>
                      <select name="formation" data-edit-form-sel>
                        <option value="">Выберите форму</option>
                        <?php foreach (FORMATIONS_FOR($eNom) as $fm): ?>
                          <option value="<?= h($fm) ?>" <?= (string)($a['formation'] ?? '') === $fm ? 'selected' : '' ?>><?= h($fm) ?></option>
                        <?php endforeach; ?>
                      </select>
                    </div>

                    <div class="field" style="margin:0"><label>Название конкурсного номера</label><input type="text" name="work_title" value="<?= h($a['work_title'] ?? '') ?>"></div>
                    <div class="field" style="margin:0"><label>ФИО руководителя или педагога</label><input type="text" name="teacher" value="<?= h($a['teacher'] ?? '') ?>"></div>
                    <div class="field" style="margin:0"><label>Учреждение</label><input type="text" name="institution" value="<?= h($a['institution'] ?? '') ?>"></div>
                    <div class="field" style="margin:0"><label>Город / населённый пункт</label><input type="text" name="city" value="<?= h($a['city'] ?? '') ?>"></div>

                    <div class="field" style="margin:0"><label>E-mail для результатов</label><input type="email" name="email" value="<?= h($a['email'] ?? '') ?>"></div>
                    <div class="field" style="margin:0"><label>Телефон</label><input type="tel" name="phone" value="<?= h($a['phone'] ?? '') ?>"></div>
                    <div class="field" style="margin:0"><label>Почтовый адрес (для оригиналов)</label><input type="text" name="address" data-address-suggest value="<?= h($a['address'] ?? '') ?>"></div>
                    <div class="field" style="margin:0"><label>Почтовый индекс</label><input type="text" name="postal_index" value="<?= h($a['postal_index'] ?? '') ?>"></div>
                    <div class="field" style="margin:0"><label>Ссылка на конкурсный материал</label><input type="url" name="video_url" value="<?= h($a['video_url'] ?? '') ?>" placeholder="https://..."></div>

                    <button type="submit" class="btn btn--primary btn--sm">Сохранить изменения</button>
                  </form>
                </details>
              <?php elseif ($win['reason'] !== '' && empty($a['result']) && !$isRej): ?>
                <p class="cab-meta" style="margin-top:8px;opacity:.85"><?= h($win['reason']) ?></p>
              <?php endif; ?>
              <?php if ($isRej): ?>
                <p class="cab-reject">Заявка отклонена. Свяжитесь с нами для уточнения.</p>
              <?php else: ?>
                <div class="cab-steps">
                  <?php foreach ($pLabels as $pi => $pl): ?>
                    <div class="cab-step <?= $pi <= $cur ? 'done' : '' ?> <?= $pi === $cur ? 'here' : '' ?>"><span class="cab-dot"></span><small><?= h($pl) ?></small></div>
                  <?php endforeach; ?>
                </div>
                <div class="cab-bar"><i data-w="<?= $pct ?>"></i></div>
              <?php endif; ?>
              <?php if (!empty($a['result'])): ?>
                <div class="cab-result-big"><?= h($a['result']) ?></div>
                <?php if (trim((string)($a['extra_diploma'] ?? '')) !== ''): ?>
                  <p class="cab-extra"><span>Дополнительный диплом:</span> <?= h($a['extra_diploma']) ?></p>
                <?php endif; ?>
                <?php // Комментарий и рекомендация жюри — ТОЛЬКО для участников ВИП-клуба.
                  if ($isVip): ?>
                  <?php if (trim((string)($a['jury_comment'] ?? '')) !== ''): ?>
                    <p class="cab-jury">Комментарий жюри: «<?= h($a['jury_comment']) ?>»</p>
                  <?php else: ?>
                    <div style="margin-top:10px">
                      <button type="button" class="btn btn--ghost btn--sm" data-jury-req="<?= (int)$a['id'] ?>">Запросить комментарий и рекомендацию жюри</button>
                    </div>
                  <?php endif; ?>
                <?php elseif (trim((string)($a['jury_comment'] ?? '')) !== ''): ?>
                  <p class="cab-meta" style="margin-top:8px;color:var(--gold-ink,#8B6F1F)">Комментарий и рекомендация жюри доступны участникам <a href="<?= url('/club') ?>">ВИП-клуба</a>.</p>
                <?php endif; ?>
                <?php if ($canOrder): ?>
                  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
                    <!-- Заказ строго по этой заявке: состав наград ограничивается её
                         аттестационным результатом (кубок/статуэтка/медаль). -->
                    <!-- Ведём в НАСТОЯЩИЙ раздел наград (образцы + корзина), но с привязкой
                         к этой заявке: состав ограничен её аттестационным результатом. -->
                    <a class="btn btn--primary" href="<?= url('/awards') ?>?comp=<?= (int)$a['competition_id'] ?>&app=<?= (int)$a['id'] ?>">Заказать награды</a>
                    <span class="hint" style="align-self:center">Данные подставятся из заявки — вводить заново не нужно.</span>
                  </div>
                <?php else: ?>
                  <p class="cab-order-gone">Срок заказа наград по этой заявке истёк (60 дней после оценки).</p>
                <?php endif; ?>
              <?php elseif (!empty($a['_long_hidden'])): ?>
                <?php $ld = trim((string)($a['comp_results_date'] ?? '')); ?>
                <p class="cab-meta" style="margin-top:10px;opacity:.85">Результаты этого конкурса будут опубликованы<?= $ld !== '' ? ' ' . h(ru_date(substr($ld,0,10))) : '' ?>. После публикации здесь появится звание, и можно будет заказать награды.</p>
              <?php elseif (!$isRej): ?>
                <p class="cab-meta" style="margin-top:10px;opacity:.85">Награды можно будет заказать после оглашения результата.</p>
              <?php endif; ?>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Мои дипломы -->
        <div class="cab-panel" id="tab-diplomas" role="tabpanel">
          <h2>Мои дипломы</h2>
          <?php if (!$diplomas): ?>
            <div class="cab-card cab-empty"><?= $icons['diploma'] ?><p>Дипломы появятся здесь после оценки Ваших работ жюри.</p></div>
          <?php else: foreach ($diplomas as $k => $d): ?>
            <div class="cab-card cab-dip reveal" style="--i:<?= $k ?>">
              <a class="cab-dip-thumb" href="<?= url('/diploma-view/'.$d['number']) ?>" target="_blank" rel="noopener" aria-label="Посмотреть диплом целиком">
                <iframe src="<?= url('/diploma-view/'.$d['number']) ?>" loading="lazy" tabindex="-1" title="Образец диплома № <?= h($d['number']) ?>"></iframe>
                <span class="cab-dip-zoom"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg></span>
              </a>
              <div class="cab-dip-body">
                <div class="cab-row">
                  <div style="min-width:0">
                    <span class="cab-ttl"><?= h($d['result'] ?: $d['app_result'] ?: 'Диплом') ?></span>
                    <p class="cab-meta"><?= h($d['comp_name'] ?: 'Конкурс') ?> - <?= h($d['full_name']) ?></p>
                    <p class="cab-meta">Диплом № <?= h($d['number']) ?> - <?= h(ru_date(substr((string)$d['created_at'],0,10))) ?></p>
                  </div>
                  <div><?= $badge('Готов','success') ?></div>
                </div>
                <div class="cab-actions" style="margin-top:14px">
                  <a class="btn btn--primary" href="<?= url('/diploma/'.$d['number'].'.pdf') ?>" target="_blank" rel="noopener"><?= $icons['dl'] ?> Скачать PDF</a>
                  <button type="button" class="btn btn--ghost" data-dip-resend="<?= h($d['number']) ?>"><?= $icons['mail'] ?> На почту</button>
                  <a class="btn btn--ghost" href="<?= url('/verify/'.$d['number']) ?>" target="_blank" rel="noopener"><?= $icons['qr'] ?> Проверка QR</a>
                </div>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Награды и заказы -->
        <div class="cab-panel" id="tab-awards" role="tabpanel">
          <h2>Награды и заказы</h2>
          <?php if (!$orders): ?>
            <div class="cab-card cab-empty">
              <?= $icons['awards'] ?>
              <p>У Вас пока нет заказов наградной продукции.</p>
              <a class="btn btn--primary" href="<?= url('/awards') ?>">Заказать награды</a>
            </div>
          <?php else: foreach ($orders as $k => $o):
            [$sl,$st] = $orderStatus[$o['status']] ?? [$o['status'],'info'];
            // 'made' показываем на той же стадии, что и 'paid' — «Изготовление».
            $ostat = (string)$o['status'] === 'made' ? 'paid' : (string)$o['status'];
            $ocur = array_search($ostat, $orderPipe, true);
            if ($ocur === false) $ocur = ((string)$o['status'] === 'new') ? -1 : 0;
            $track = trim((string)($o['tracking'] ?? ''));
            $trackUrl = $track !== '' ? 'https://www.pochta.ru/tracking#' . rawurlencode($track) : '';
            $isClubOrder = strpos((string)($o['items'] ?? ''), '"kind":"club"') !== false; ?>
            <div class="cab-card reveal" style="--i:<?= $k ?>">
              <div class="cab-row">
                <div style="min-width:0">
                  <span class="cab-ttl"><?= h(order_items_label($o['items'] ?? '')) ?></span>
                  <p class="cab-meta"><?= h($o['competition'] ?: '') ?><?php if ($o['result']): ?> - <?= h($o['result']) ?><?php endif; ?></p>
                  <p class="cab-meta">Заказ от <?= h(ru_date(substr((string)$o['created_at'],0,10))) ?><?php if ($o['amount']): ?> - <?= h(money((int)$o['amount'])) ?><?php endif; ?></p>
                  <?php if ($track !== ''): ?><p class="cab-meta">Трек-номер: <strong><?= h($track) ?></strong></p><?php endif; ?>
                </div>
                <div style="text-align:right"><?= $badge($sl,$st) ?></div>
              </div>
              <?php if (!$isClubOrder): ?>
                <div class="cab-steps" style="margin-top:14px">
                  <?php foreach ($orderPipeL as $pi => $pl): ?>
                    <div class="cab-step <?= $pi <= $ocur ? 'done' : '' ?> <?= $pi === $ocur ? 'here' : '' ?>"><span class="cab-dot"></span><small><?= h($pl) ?></small></div>
                  <?php endforeach; ?>
                </div>
                <div class="cab-bar"><i data-w="<?= (int)round((($ocur+1)/count($orderPipe))*100) ?>"></i></div>
                <?php if ($trackUrl !== ''): ?>
                  <a class="btn btn--primary btn--sm" href="<?= h($trackUrl) ?>" target="_blank" rel="noopener" style="margin-top:12px">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" style="vertical-align:-3px;margin-right:5px"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>Отследить посылку</a>
                <?php endif; ?>
                <?php if ((string)$o['status'] === 'new'): ?>
                  <div class="cab-order-actions" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                    <button type="button" class="btn btn--primary btn--sm" data-order-pay="<?= (int)$o['id'] ?>">Оплатить заказ</button>
                    <button type="button" class="btn btn--ghost btn--sm" data-order-del="<?= (int)$o['id'] ?>" style="color:var(--error,#c0392b)">Удалить заказ</button>
                  </div>
                <?php endif; ?>
              <?php endif; ?>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Достижения (OKO-style) -->
        <div class="cab-panel" id="tab-achievements" role="tabpanel">
          <h2>Достижения · сезон <?= h($season) ?></h2>
          <p class="cab-meta" style="margin:-6px 0 14px">
            Достижения считаются в рамках сезона (календарный год) и обнуляются 1 января —
            каждый год открываются заново.
          </p>

          <div class="cab-card" style="margin-bottom:14px">
            <div class="cab-row">
              <div style="min-width:0">
                <span class="cab-ttl">Скидка за достижения</span>
                <p class="cab-meta" style="margin:4px 0 0">
                  <?php if ($achNextTier): ?>
                    Ещё <?= (int)($achNextTier['apps'] - $countAppsS) ?> заявки в сезоне — и скидка станет <?= (int)$achNextTier['pct'] ?>%.
                  <?php else: ?>
                    Максимум сезона достигнут.
                  <?php endif; ?>
                </p>
              </div>
              <div style="text-align:right">
                <span class="cab-status cab-status--gold">&minus;<?= (int)$achDiscount ?>%</span>
              </div>
            </div>
            <p class="cab-meta" style="margin:12px 0 0">
              Скидка за достижения — не более <?= (int)LOYALTY_MAX_PCT ?>%. Вместе с реферальной
              суммарная скидка на аккаунт не превышает <?= (int)DISCOUNT_CAP_NO_CLUB ?>%
              (участники ВИП-клуба — по условиям клуба).
            </p>
          </div>

          <div class="cab-card cab-level">
            <div class="cab-level-head">
              <div>
                <p class="eyebrow" style="margin:0">Уровень участника</p>
                <b class="cab-level-num">Уровень <?= (int)$level ?></b>
              </div>
              <div class="cab-level-count"><?= (int)$achDoneCount ?> / <?= count($achievements) ?> открыто</div>
            </div>
            <div class="cab-level-bar"><i style="width:<?= (int)$levelPct ?>%"></i></div>
            <div class="cab-level-hint">
              <?php if ($level < 20): ?>
                До уровня <?= (int)$level + 1 ?>: <?= max(0, $nextLevelAt - $levelPoints) ?> очков (за заявку +5, диплом +10, Лауреат I +30, Гран-При +50)
              <?php else: ?>
                Максимальный уровень — Легенда центра.
              <?php endif; ?>
            </div>
          </div>

          <div class="ach-grid">
            <?php foreach ($achievements as $ach): ?>
              <div class="ach-tile<?= $ach['done'] ? ' done' : '' ?>">
                <div class="ach-ic"><?= $achIcons[$ach['ic']] ?? $achIcons['star'] ?></div>
                <div class="ach-body">
                  <b><?= h($ach['title']) ?></b>
                  <span><?= h($ach['desc']) ?></span>
                </div>
                <?php if ($ach['done']): ?>
                  <span class="ach-check" aria-label="Открыто">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </span>
                <?php else: ?>
                  <span class="ach-lock" aria-label="Закрыто">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                  </span>
                <?php endif; ?>
              </div>
            <?php endforeach; ?>
          </div>
        </div>

        <!-- Статистика -->
        <div class="cab-panel" id="tab-stats" role="tabpanel">
          <h2>Статистика и аналитика</h2>
          <div class="cab-kpis">
            <div class="cab-kpi"><b><?= (int)count($apps) ?></b><span>Всего заявок</span></div>
            <?php if ($cntNew > 0): ?>
              <div class="cab-kpi"><b><?= (int)$cntNew ?></b><span>Ждут жюри</span></div>
            <?php endif; ?>
            <div class="cab-kpi"><b><?= (int)$cntJudging ?></b><span>На оценке</span></div>
            <div class="cab-kpi"><b><?= (int)$cntGraded ?></b><span>Оценено</span></div>
            <div class="cab-kpi"><b><?= (int)count($diplomas) ?></b><span>Дипломов получено</span></div>
            <?php if ($diplomasPending > 0): ?>
              <div class="cab-kpi"><b><?= (int)$diplomasPending ?></b><span>Наград в пути</span></div>
            <?php endif; ?>
            <div class="cab-kpi"><b><?= (int)$byResult['gp'] + (int)$byResult['laur1'] ?></b><span>Гран-При и I ст.</span></div>
            <div class="cab-kpi"><b><?= (int)$totalPaid ?> ₽</b><span>Оплачено всего</span></div>
            <?php if ($cntRejected > 0): ?>
              <div class="cab-kpi"><b><?= (int)$cntRejected ?></b><span>Отклонено</span></div>
            <?php endif; ?>
          </div>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Активность по месяцам</h3>
            <?php if (!$monthVals): ?>
              <p style="color:var(--muted);margin:0">Данных пока нет — подайте первую заявку.</p>
            <?php else: ?>
            <div class="cab-bars">
              <?php foreach ($monthVals as $i => $v):
                $pct = round($v * 100 / $maxMonth);
                $ml = $monthLabels[$i] ?? '';
                $mm = ['01'=>'Янв','02'=>'Фев','03'=>'Мар','04'=>'Апр','05'=>'Май','06'=>'Июн','07'=>'Июл','08'=>'Авг','09'=>'Сен','10'=>'Окт','11'=>'Ноя','12'=>'Дек'][substr($ml,5,2)] ?? substr($ml,5,2);
              ?>
              <div class="cab-bar-col" style="--h:<?= $pct ?>%" title="<?= h($ml) ?>: <?= (int)$v ?>">
                <div class="cab-bar-fill"><span><?= (int)$v ?></span></div>
                <small><?= h($mm) ?></small>
              </div>
              <?php endforeach; ?>
            </div>
            <?php endif; ?>
          </div>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Распределение результатов</h3>
            <?php
              $rTot = array_sum($byResult);
              $rLabels = ['gp'=>'Гран-При','laur1'=>'Лауреат I','laur2'=>'Лауреат II','laur3'=>'Лауреат III','dipl'=>'Дипломант','other'=>'Другое'];
            ?>
            <?php if (!$rTot): ?>
              <p style="color:var(--muted);margin:0">Результаты появятся после оценки заявок жюри.</p>
            <?php else: ?>
              <div class="cab-legend">
                <?php foreach ($byResult as $k => $v): if(!$v) continue; $pct = round($v*100/$rTot); ?>
                  <div class="cab-legend-row">
                    <span class="cab-legend-lbl"><?= h($rLabels[$k]) ?></span>
                    <span class="cab-legend-bar"><i style="width:<?= $pct ?>%"></i></span>
                    <span class="cab-legend-num"><?= (int)$v ?> <small>(<?= $pct ?>%)</small></span>
                  </div>
                <?php endforeach; ?>
              </div>
            <?php endif; ?>
          </div>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Статусы заявок</h3>
            <div class="cab-legend">
              <?php foreach ($byStatus as $k => $v): $lbl = $appStatus[$k][0] ?? $k; $t = $appStatus[$k][1] ?? 'info'; ?>
                <div class="cab-legend-row">
                  <span class="cab-legend-lbl"><?= h($lbl) ?></span>
                  <span class="cab-legend-bar"><i style="width:<?= (int)count($apps) ? round($v*100/count($apps)) : 0 ?>%;background:var(--<?= $t==='success'?'grad-gold':($t==='error'?'error':'gold-2') ?>,var(--grad-gold))"></i></span>
                  <span class="cab-legend-num"><?= (int)$v ?></span>
                </div>
              <?php endforeach; ?>
            </div>
          </div>
        </div>

        <!-- Настройки (в стиле настроек Telegram: группы строк) -->
        <div class="cab-panel" id="tab-settings" role="tabpanel">
          <h2>Настройки</h2>
          <div class="cab-sets">

            <!-- Клуб постоянных участников -->
            <div class="cab-group">
              <div class="cab-group-ttl">Клуб постоянных участников</div>
              <div class="cab-group-card">
                <?php if ($isVip): ?>
                <a class="cab-item" href="<?= url('/club') ?>" style="--ic:#C79322">
                  <span class="cab-item-ic"><?= $icon('<path d="M20 6L9 17l-5-5"/>') ?></span>
                  <span class="cab-item-lbl">Членство активно<span class="cab-sub">Клуб постоянных участников — активен до <?= h($clubUntil ?: 'бессрочно') ?></span></span>
                  <span class="cab-item-val">&minus;<?= (int)($club['discount'] ?? 20) ?>%</span>
                  <svg class="cab-item-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
                </a>
                <?php else: ?>
                <a class="cab-item" href="<?= url('/club') ?>" style="--ic:#17307A">
                  <span class="cab-item-ic"><?= $icon('<path d="M2 8l4 5 6-9 6 9 4-5v10H2z"/>') ?></span>
                  <span class="cab-item-lbl">Вступить в клуб<span class="cab-sub">Скидка на конкурсы, приоритет и галочка участника Клуба</span></span>
                  <svg class="cab-item-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
                </a>
                <?php endif; ?>
              </div>
            </div>

            <!-- Профиль -->
            <div class="cab-group">
              <div class="cab-group-ttl">Профиль</div>
              <div class="cab-group-card">
                <details class="cab-set" id="setProfile">
                  <summary style="--ic:#17307A">
                    <span class="cab-item-ic"><?= $icon('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') ?></span>
                    <span class="cab-item-lbl">Данные профиля<span class="cab-sub"><?= h($user['full_name'] ?: 'Имя не указано') ?><?= trim((string)($user['city'] ?? '')) !== '' ? ' · ' . h($user['city']) : '' ?></span></span>
                    <svg class="cab-item-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
                  </summary>
                  <div class="cab-set-body">
                    <form method="post" action="<?= url('/cabinet') ?>" enctype="multipart/form-data" id="profileForm">
                      <?= csrf_field() ?>
                      <input type="hidden" name="action" value="profile">
                      <input type="hidden" id="p_ava_hidden" name="avatar" value="<?= h($avatar) ?>">
                      <div class="cab-avaedit">
                        <div class="cab-ava" id="cabAvaPreview">
                          <?php if ($avatar !== ''): ?><img src="<?= h($avatar) ?>" alt="Текущее фото профиля" loading="lazy"><?php else: ?><?= h($initials) ?><?php endif; ?>
                        </div>
                        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
                          <label class="btn btn--ghost btn--sm" for="p_ava_file" style="cursor:pointer;text-align:center">Загрузить фото</label>
                          <input type="file" id="p_ava_file" accept="image/*" hidden>
                          <button type="button" class="btn btn--ghost btn--sm" id="p_ava_clear" style="min-height:36px;font-size:.82rem">Удалить фото</button>
                          <div class="hint" style="font-size:.72rem;margin:0">JPG/PNG до 3 МБ. Сохранится в профиль.</div>
                        </div>
                      </div>

                      <div class="field">
                        <label>Категория</label>
                        <div class="cat-picker">
                          <?php
                            $curCat = (string)($user['category'] ?? '');
                            if ($curCat === '') $curCat = $isTeacher ? 'teacher' : 'participant';
                            $cats = [
                              'participant' => ['Участник', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'],
                              'teacher'     => ['Педагог',  '<path d="M12 3l10 5-10 5L2 8z"/><path d="M6 10v6a6 6 0 0 0 12 0v-6"/>'],
                              'parent'      => ['Родитель', '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2 21a7 7 0 0 1 14 0M13 21a5 5 0 0 1 9 0"/>'],
                            ];
                            foreach ($cats as $key => [$lbl, $svg]):
                          ?>
                            <label class="cat-opt <?= $curCat===$key?'is-on':'' ?>">
                              <input type="radio" name="category" value="<?= h($key) ?>" <?= $curCat===$key?'checked':'' ?>>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><?= $svg ?></svg>
                              <span><?= h($lbl) ?></span>
                            </label>
                          <?php endforeach; ?>
                        </div>
                      </div>

                      <div class="field">
                        <label for="p_fio">Фамилия, имя, отчество</label>
                        <input type="text" id="p_fio" name="full_name" value="<?= h($user['full_name']) ?>" placeholder="Иванова Мария Петровна">
                      </div>
                      <div class="field">
                        <label for="p_nick">Никнейм</label>
                        <input type="text" id="p_nick" name="nickname" value="<?= h($user['nickname'] ?? '') ?>" placeholder="как обращаться" maxlength="30">
                        <div class="hint">Короткое имя для приветствия. Не отображается в дипломе.</div>
                      </div>
                      <div class="field">
                        <label for="p_city">Город</label>
                        <input type="text" id="p_city" name="city" value="<?= h($user['city'] ?? '') ?>" placeholder="Москва" maxlength="80">
                        <div class="hint">Помогает нам приглашать Вас на очные события Вашего региона.</div>
                      </div>
                      <div class="field">
                        <label>Электронная почта</label>
                        <input type="email" value="<?= h($user['email']) ?>" disabled>
                        <div class="hint">Почта используется для входа и наградных документов.</div>
                      </div>
                      <button class="btn btn--primary" type="submit">Сохранить профиль</button>
                    </form>
                  </div>
                </details>
              </div>
            </div>

            <!-- Способы входа -->
            <div class="cab-group">
              <div class="cab-group-ttl">Способы входа</div>
              <div class="cab-group-card">

                <!-- Почта -->
                <div class="cab-srow" style="--ic:#17307A">
                  <span class="cab-item-ic"><?= $icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>') ?></span>
                  <span class="cab-item-lbl">Почта<span class="cab-sub"><?= h($user['email'] ?: 'Не указана') ?></span></span>
                  <?php if ((int)($user['email_verified'] ?? 0) === 1): ?>
                    <span class="cab-link-ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Подтверждена</span>
                  <?php elseif (trim((string)($user['email'] ?? '')) !== ''): ?>
                    <form method="post" action="<?= url('/cabinet') ?>">
                      <?= csrf_field() ?>
                      <input type="hidden" name="action" value="resend_verify">
                      <button type="submit" class="btn btn--ghost btn--sm" style="min-height:34px">Подтвердить</button>
                    </form>
                  <?php else: ?>
                    <span class="cab-link-no">Не указана</span>
                  <?php endif; ?>
                </div>

                <!-- Телефон -->
                <?php $phoneLinked = trim((string)($user['phone'] ?? '')) !== '' && !empty($user['phone_verified']); ?>
                <?php if ($phoneLinked): ?>
                <div class="cab-srow" style="--ic:#2E7D4F">
                  <span class="cab-item-ic"><?= $icon('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a1 1 0 0 1-1 1A17 17 0 0 1 4 5a1 1 0 0 1 1-1z"/>') ?></span>
                  <span class="cab-item-lbl">Телефон<span class="cab-sub"><?= h($user['phone']) ?></span></span>
                  <form method="post" action="<?= url('/cabinet') ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="unlink">
                    <input type="hidden" name="provider" value="phone">
                    <button type="submit" class="btn btn--ghost btn--sm" style="min-height:34px">Отвязать</button>
                  </form>
                </div>
                <?php else: ?>
                <details class="cab-set" <?= $phonePending !== '' ? 'open' : '' ?>>
                  <summary style="--ic:#2E7D4F">
                    <span class="cab-item-ic"><?= $icon('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 13l5 2v4a1 1 0 0 1-1 1A17 17 0 0 1 4 5a1 1 0 0 1 1-1z"/>') ?></span>
                    <span class="cab-item-lbl">Телефон<span class="cab-sub"><?= trim((string)($user['phone'] ?? '')) !== '' ? h($user['phone']) . ' — не подтверждён' : 'Не привязан' ?></span></span>
                    <span class="cab-link-no">Привязать</span>
                    <svg class="cab-item-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
                  </summary>
                  <div class="cab-set-body">
                    <?php if ($phonePending !== ''): ?>
                      <p class="hint" style="margin:0 0 12px">Код из SMS отправлен на <strong><?= h($phonePending) ?></strong>. Введите его в течение 10 минут.</p>
                      <form method="post" action="<?= url('/cabinet') ?>">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="phone_verify">
                        <div class="field">
                          <label for="ph_code">Код из SMS</label>
                          <input type="text" id="ph_code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="•••••" required>
                        </div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                          <button class="btn btn--primary" type="submit">Подтвердить</button>
                        </div>
                      </form>
                      <form method="post" action="<?= url('/cabinet') ?>" style="margin-top:10px">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="phone_cancel">
                        <button type="submit" class="btn btn--ghost btn--sm" style="min-height:34px">Изменить номер</button>
                      </form>
                    <?php else: ?>
                      <form method="post" action="<?= url('/cabinet') ?>">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="phone_request">
                        <div class="field">
                          <label for="ph_num">Номер телефона</label>
                          <input type="tel" id="ph_num" name="phone" value="<?= h($user['phone'] ?? '') ?>" placeholder="+7 (___) ___-__-__" required>
                        </div>
                        <button class="btn btn--primary" type="submit">Получить код по SMS</button>
                        <p class="hint" style="margin:10px 0 0">Пришлём SMS с кодом подтверждения. После привязки сможете входить по номеру телефона.</p>
                      </form>
                    <?php endif; ?>
                  </div>
                </details>
                <?php endif; ?>

                <!-- ВКонтакте -->
                <div class="cab-srow" style="--ic:#0077FF">
                  <span class="cab-item-ic"><svg viewBox="0 0 24 24" width="17" height="17" fill="#fff" style="flex:none"><path d="M13.2 17.4c-5.5 0-8.9-3.8-9-10.1h2.8c.1 4.6 2.2 6.6 3.8 7V7.3h2.6v4c1.6-.2 3.3-2 3.9-4h2.6c-.5 2.5-2.2 4.3-3.4 5 1.2.6 3.2 2.2 3.9 5.1h-2.9c-.6-1.9-2.1-3.4-4.1-3.6v3.6h-.2z"/></svg></span>
                  <span class="cab-item-lbl">ВКонтакте<span class="cab-sub"><?= !empty($user['vk_id']) ? 'Привязан' : 'Вход в 1 клик через VK ID' ?></span></span>
                  <?php if (!empty($user['vk_id'])): ?>
                    <form method="post" action="<?= url('/cabinet') ?>">
                      <?= csrf_field() ?>
                      <input type="hidden" name="action" value="unlink">
                      <input type="hidden" name="provider" value="vk">
                      <button type="submit" class="btn btn--ghost btn--sm" style="min-height:34px">Отвязать</button>
                    </form>
                  <?php else: ?>
                    <a class="btn btn--primary btn--sm" href="<?= url('/api/v1/oauth_vk?bind=1') ?>" style="min-height:34px">Привязать ВК</a>
                  <?php endif; ?>
                </div>

                <!-- Пароль -->
                <details class="cab-set">
                  <summary style="--ic:#5B3A8E">
                    <span class="cab-item-ic"><?= $icon('<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>') ?></span>
                    <span class="cab-item-lbl">Пароль<span class="cab-sub"><?= trim((string)($user['password_hash'] ?? '')) !== '' ? 'Сменить пароль входа' : 'Пароль не задан' ?></span></span>
                    <svg class="cab-item-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>
                  </summary>
                  <div class="cab-set-body">
                    <form method="post" action="<?= url('/cabinet') ?>">
                      <?= csrf_field() ?>
                      <input type="hidden" name="action" value="password">
                      <div class="field">
                        <label for="cur_pw">Текущий пароль</label>
                        <input type="password" id="cur_pw" name="current_password" autocomplete="current-password" required>
                      </div>
                      <div class="field">
                        <label for="new_pw">Новый пароль</label>
                        <input type="password" id="new_pw" name="new_password" autocomplete="new-password" minlength="6" required>
                      </div>
                      <button class="btn btn--primary" type="submit">Изменить пароль</button>
                    </form>
                  </div>
                </details>
              </div>
            </div>

            <!-- Конфиденциальность -->
            <div class="cab-group">
              <div class="cab-group-ttl">Конфиденциальность и уведомления</div>
              <div class="cab-group-card">
                <form method="post" action="<?= url('/cabinet') ?>" class="cab-set-body" style="padding-top:6px">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="privacy">
                  <input type="hidden" name="name_public" value="initials">
                  <label class="switch">
                    <span class="switch-txt"><strong>Полное имя в публичных результатах</strong><span>Выключено — в итогах конкурсов покажем «Фамилия И. О.» вместо полного имени</span></span>
                    <input type="checkbox" name="name_public" value="full" <?= $privNameFull ? 'checked' : '' ?>>
                    <span class="switch-ui" aria-hidden="true"></span>
                  </label>
                  <label class="switch">
                    <span class="switch-txt"><strong>Письма на почту</strong><span>Статусы заявок, результаты, готовность дипломов</span></span>
                    <input type="checkbox" name="notify_email" value="1" <?= (int)($user['notify_email'] ?? 1) ? 'checked' : '' ?>>
                    <span class="switch-ui" aria-hidden="true"></span>
                  </label>
                  <label class="switch">
                    <span class="switch-txt"><strong>Уведомления в приложении</strong><span>Колокольчик в шапке: события по заявкам и наградам</span></span>
                    <input type="checkbox" name="notify_inapp" value="1" <?= $privInapp ? 'checked' : '' ?>>
                    <span class="switch-ui" aria-hidden="true"></span>
                  </label>
                  <button class="btn btn--primary" type="submit" style="margin-top:16px">Сохранить</button>
                </form>
              </div>
            </div>

            <!-- Приложение -->
            <div class="cab-group">
              <div class="cab-group-ttl">Приложение</div>
              <div class="cab-group-card">
                <div class="cab-set-body" style="padding-top:16px">
                  <strong style="display:block;margin-bottom:10px;font-size:.95rem">Тема</strong>
                  <div class="theme-picker">
                    <button type="button" class="theme-opt" data-theme-set="light" aria-pressed="false">
                      <span class="theme-preview theme-preview--light"><i></i><i></i><i></i></span>
                      <span>Светлая</span>
                    </button>
                    <button type="button" class="theme-opt" data-theme-set="dark" aria-pressed="false">
                      <span class="theme-preview theme-preview--dark"><i></i><i></i><i></i></span>
                      <span>Тёмная</span>
                    </button>
                  </div>
                  <p class="hint" style="margin:12px 0 0">Тема сохраняется на устройстве. По умолчанию — светлая.</p>
                </div>
                <div class="cab-set-body" style="border-top:1px solid var(--line);padding-top:4px;padding-bottom:8px">
                  <form method="post" action="<?= url('/cabinet') ?>">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="music_toggle">
                    <label class="switch" style="border-bottom:none">
                      <span class="switch-txt"><strong>Отключить фоновую музыку</strong><span>Классика в приложении (Вивальди, Моцарт, Бах, Шопен). Сохраняется автоматически</span></span>
                      <input type="checkbox" name="music_off" value="1" <?= !empty($user['music_off']) ? 'checked' : '' ?> onchange="this.form.submit()">
                      <span class="switch-ui" aria-hidden="true"></span>
                    </label>
                  </form>
                </div>
              </div>
            </div>

          </div>

          <a class="cab-logout" href="<?= url('/logout') ?>"><?= $icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>') ?> Выйти из аккаунта</a>
        </div>

        <?php if ($isTeacher): ?>
        <!-- Мои ученики -->
        <div class="cab-panel" id="tab-students" role="tabpanel">
          <h2>Мои ученики</h2>
          <?php if (!$students): ?>
            <div class="cab-card cab-empty"><?= $icons['students'] ?><p>Заявки, где Вы указаны педагогом, появятся здесь.</p></div>
          <?php else: foreach ($students as $k => $s):
            [$sl,$st] = $appStatus[$s['status']] ?? [$s['status'],'info']; ?>
            <div class="cab-card reveal" style="--i:<?= $k ?>">
              <div class="cab-row">
                <div style="min-width:0">
                  <span class="cab-ttl"><?= h($s['full_name']) ?></span>
                  <p class="cab-meta"><?= h($s['comp_name'] ?: 'Конкурс') ?> - <?= h($s['nomination'] ?: '') ?></p>
                </div>
                <div style="text-align:right">
                  <?= $badge($sl,$st) ?>
                  <?php if (!empty($s['result'])): ?><p class="cab-result"><?= h($s['result']) ?></p><?php endif; ?>
                </div>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Реферальная программа -->
        <div class="cab-panel" id="tab-ref" role="tabpanel">
          <h2>Реферальная программа</h2>
          <div class="cab-kpis">
            <div class="cab-kpi"><b><?= (int)$refUses ?></b><span>Оплаченных применений</span></div>
            <div class="cab-kpi"><b><?= h(money((int)$refReward)) ?></b><span>Начислено вознаграждений</span></div>
          </div>

          <?php if ($refCodes): foreach ($refCodes as $k => $c):
            $refLink = rtrim((string)cfgv('base_url'), '/') . '/apply?promo=' . rawurlencode((string)$c['code']); ?>
            <div class="cab-card reveal" style="--i:<?= $k ?>">
              <div class="cab-row">
                <div>
                  <span class="cab-code" data-code="<?= h($c['code']) ?>"><?= h($c['code']) ?>
                    <button type="button" class="cab-copy" title="Скопировать код"><?= $icon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>') ?></button>
                  </span>
                  <p class="cab-meta">Скидка ученику <?= (int)$c['percent'] ?>% - Ваше вознаграждение <?= (int)$c['reward_percent'] ?>%</p>
                </div>
                <div style="text-align:right">
                  <?= $badge($c['active'] ? 'Активен' : 'Выключен', $c['active'] ? 'success' : 'error') ?>
                  <p class="cab-meta">Применений: <strong><?= (int)$c['uses'] ?></strong></p>
                </div>
              </div>
              <div class="cab-share" style="margin-top:12px;padding-top:12px;border-top:1px solid var(--glass-brd)">
                <label class="cab-meta" style="display:block;margin-bottom:6px">Ссылка-приглашение — промокод подставится автоматически:</label>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <input type="text" class="ref-link-input" readonly value="<?= h($refLink) ?>" data-link="<?= h($refLink) ?>"
                         style="flex:1;min-width:200px;font-size:.82rem;padding:9px 12px;border:1px solid var(--glass-brd);border-radius:10px;background:var(--surface,#fff);color:var(--text)">
                  <button type="button" class="btn btn--primary btn--sm ref-link-copy" data-link="<?= h($refLink) ?>">Скопировать ссылку</button>
                </div>
              </div>
            </div>
          <?php endforeach; else: ?>
            <div class="cab-card">
              <h3 style="margin-top:0;font-family:var(--ff-serif)">Ваш промокод</h3>
              <p class="cab-meta" style="margin:0 0 14px">Получите персональную ссылку-приглашение. Ученики переходят по ней — промокод подставляется сам, они получают скидку, а Вам начисляется вознаграждение после оплаты.</p>
              <form method="post" action="<?= url('/cabinet') ?>">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="referral_create">
                <button class="btn btn--primary" type="submit">Получить мой промокод и ссылку</button>
              </form>
            </div>
          <?php endif; ?>
        </div>
        <?php endif; ?>
        <script>
        (function(){
          document.addEventListener('click',function(e){
            var b=e.target.closest('.ref-link-copy'); if(!b)return;
            var link=b.getAttribute('data-link')||'';
            if(navigator.clipboard){navigator.clipboard.writeText(link).then(function(){var o=b.textContent;b.textContent='Скопировано';setTimeout(function(){b.textContent=o;},1600);});}
          });
          // Оплата / удаление неоплаченного заказа наград из кабинета.
          function csrf(){var i=document.querySelector('input[name="_csrf"]');return i?i.value:'';}
          function post(action,id){
            var fd=new FormData();fd.append('action',action);fd.append('order_id',id);fd.append('_csrf',csrf());
            return fetch('<?= url('/api/v1/order_manage') ?>',{method:'POST',body:fd,headers:{'X-Requested-With':'fetch'}})
              .then(function(r){return r.json().catch(function(){return{};});});
          }
          document.addEventListener('click',function(e){
            var pay=e.target.closest('[data-order-pay]');
            if(pay){e.preventDefault();var id=pay.getAttribute('data-order-pay');pay.disabled=true;pay.textContent='Готовим оплату…';
              post('pay',id).then(function(d){
                if(d&&d.ok&&d.confirmation_url){location.href=d.confirmation_url;}
                else{pay.disabled=false;pay.textContent='Оплатить заказ';alert((d&&d.error)||'Не удалось создать оплату.');}
              });return;}
            var del=e.target.closest('[data-order-del]');
            if(del){e.preventDefault();if(!confirm('Удалить неоплаченный заказ?'))return;var id=del.getAttribute('data-order-del');del.disabled=true;
              post('delete',id).then(function(d){
                if(d&&d.ok&&d.deleted){var card=del.closest('.cab-card');if(card)card.remove();}
                else{del.disabled=false;alert((d&&d.error)||'Не удалось удалить заказ.');}
              });return;}
            // Оплата / удаление неоплаченной заявки на участие.
            function appPost(action,id){
              var fd=new FormData();fd.append('action',action);fd.append('application_id',id);fd.append('_csrf',csrf());
              return fetch('<?= url('/api/v1/app_pay') ?>',{method:'POST',body:fd,headers:{'X-Requested-With':'fetch'}})
                .then(function(r){return r.json().catch(function(){return{};});});
            }
            var apay=e.target.closest('[data-app-pay]');
            if(apay){e.preventDefault();var aid=apay.getAttribute('data-app-pay');apay.disabled=true;apay.textContent='Готовим оплату…';
              appPost('pay',aid).then(function(d){
                if(d&&d.ok&&d.confirmation_url){location.href=d.confirmation_url;}
                else{apay.disabled=false;apay.textContent='Оплатить заявку';alert((d&&d.error)||'Не удалось создать оплату.');}
              });return;}
            var adel=e.target.closest('[data-app-del]');
            if(adel){e.preventDefault();if(!confirm('Удалить неоплаченную заявку?'))return;var aid2=adel.getAttribute('data-app-del');adel.disabled=true;
              appPost('delete',aid2).then(function(d){
                if(d&&d.ok&&d.deleted){var card=adel.closest('.cab-card');if(card)card.remove();}
                else{adel.disabled=false;alert((d&&d.error)||'Не удалось удалить заявку.');}
              });return;}
            // Запрос комментария и рекомендации жюри (только ВИП-клуб).
            var jreq=e.target.closest('[data-jury-req]');
            if(jreq){e.preventDefault();var jid=jreq.getAttribute('data-jury-req');jreq.disabled=true;jreq.textContent='Отправляем…';
              var fd=new FormData();fd.append('application_id',jid);fd.append('_csrf',csrf());
              fetch('<?= url('/api/v1/jury_request') ?>',{method:'POST',body:fd,headers:{'X-Requested-With':'fetch'},credentials:'same-origin'})
                .then(function(r){return r.json().catch(function(){return{};});})
                .then(function(d){
                  if(d&&d.ok){jreq.textContent='Запрос отправлен';jreq.disabled=true;alert(d.message||'Запрос отправлен.');}
                  else{jreq.disabled=false;jreq.textContent='Запросить комментарий и рекомендацию жюри';alert((d&&d.error)||'Не удалось отправить запрос.');}
                });return;}
          });
        })();
        </script>

      </div>
    </div>
  </div>
</section>
<script>
(function(){
  var menu=document.getElementById('cabMenu');
  var back=document.getElementById('cabBack');
  var wrap=document.querySelector('.cab');
  if(!menu||!wrap)return;
  var btns=menu.querySelectorAll('.cab-item[data-tab]');
  function fillBars(id){
    document.querySelectorAll('#tab-'+id+' .cab-bar i').forEach(function(el){
      requestAnimationFrame(function(){el.style.width=(el.getAttribute('data-w')||0)+'%';});
    });
  }
  function show(id){
    wrap.classList.add('is-section');
    document.querySelectorAll('.cab-panel').forEach(function(p){p.classList.toggle('active',p.id==='tab-'+id);});
    fillBars(id);
    window.scrollTo({top:0,behavior:'auto'});
  }
  function showMenu(){
    wrap.classList.remove('is-section');
    document.querySelectorAll('.cab-panel').forEach(function(p){p.classList.remove('active');});
    history.replaceState(null,'',location.pathname);
  }
  btns.forEach(function(b){b.addEventListener('click',function(){var id=b.getAttribute('data-tab');show(id);history.replaceState(null,'','#'+id);});});
  if(back)back.addEventListener('click',showMenu);
  var h=(location.hash||'').replace('#','');
  if(h&&document.getElementById('tab-'+h))show(h);
  // Копирование реф-кода
  document.querySelectorAll('.cab-copy').forEach(function(btn){
    btn.addEventListener('click',function(){
      var code=btn.closest('.cab-code').getAttribute('data-code')||'';
      if(navigator.clipboard)navigator.clipboard.writeText(code);
      if(window.toast)window.toast('Промокод скопирован','success');
    });
  });
  // Category picker — визуальный тумблер (aria-pressed)
  document.querySelectorAll('.cat-opt input[type=radio]').forEach(function(inp){
    inp.addEventListener('change', function(){
      document.querySelectorAll('.cat-opt').forEach(function(l){ l.classList.remove('is-on'); });
      inp.closest('.cat-opt').classList.add('is-on');
    });
  });
  // Аватар: загрузка файла → base64 → hidden input + предпросмотр
  var avaFile = document.getElementById('p_ava_file');
  var avaHidden = document.getElementById('p_ava_hidden');
  var avaPrev = document.getElementById('cabAvaPreview');
  var avaClear = document.getElementById('p_ava_clear');
  if (avaFile) avaFile.addEventListener('change', function(){
    var f = avaFile.files && avaFile.files[0]; if (!f) return;
    if (f.size > 3*1024*1024) { alert('Файл слишком большой (макс 3 МБ)'); return; }
    var fr = new FileReader();
    fr.onload = function(){
      // Сожмём через canvas до 512×512 max
      var img = new Image();
      img.onload = function(){
        var c = document.createElement('canvas');
        var s = Math.min(512, Math.max(img.width, img.height));
        var scale = s / Math.max(img.width, img.height);
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var b64 = c.toDataURL('image/jpeg', .85);
        avaHidden.value = b64;
        avaPrev.innerHTML = '<img src="' + b64 + '" alt="Новое фото" loading="lazy">';
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
  });
  if (avaClear) avaClear.addEventListener('click', function(){
    if (!confirm('Удалить фото профиля?')) return;
    avaHidden.value = '';
    var initials = (document.getElementById('p_fio').value || '').split(/\s+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase() || '?';
    avaPrev.innerHTML = initials;
  });
  // Theme-picker: тумблер темы в настройках профиля
  function applyTheme(t){
    try{ localStorage.setItem('muzmir-theme', t); }catch(e){}
    document.documentElement.dataset.theme = t;
    document.querySelectorAll('.theme-opt').forEach(function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-set')===t ? 'true':'false');
    });
    var mtc = document.getElementById('metaThemeColor');
    if (mtc) mtc.setAttribute('content', t==='dark' ? '#0b0a0d' : '#FFFCF5');
  }
  var curT = (document.documentElement.dataset.theme || 'light');
  applyTheme(curT);
  document.querySelectorAll('.theme-opt').forEach(function(b){
    b.addEventListener('click', function(){ applyTheme(b.getAttribute('data-theme-set')); });
  });
})();
</script>

<!-- Диплом «На почту»: AJAX + красивое окно подтверждения (без ухода из раздела) -->
<div id="dipModal" class="dip-modal" hidden aria-hidden="true">
  <div class="dip-modal__backdrop" data-dip-close></div>
  <div class="dip-modal__card" role="dialog" aria-modal="true" aria-labelledby="dipModalTitle">
    <div class="dip-modal__ic" id="dipModalIc">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>
    </div>
    <h3 id="dipModalTitle">Диплом отправлен</h3>
    <p id="dipModalText">Письмо с дипломом отправлено на Вашу электронную почту.</p>
    <button type="button" class="btn btn--primary btn--block" data-dip-close>Хорошо</button>
  </div>
</div>
<style>
.dip-modal{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}
.dip-modal[hidden]{display:none}
.dip-modal__backdrop{position:absolute;inset:0;background:rgba(10,14,30,.55);backdrop-filter:blur(4px);animation:dipFade .2s ease}
.dip-modal__card{position:relative;max-width:380px;width:100%;background:var(--panel-solid,#fff);border:1px solid var(--glass-brd,#e6e9f2);
  border-radius:20px;padding:28px 26px 22px;text-align:center;box-shadow:0 24px 60px rgba(10,14,30,.28);animation:dipPop .24s cubic-bezier(.2,.8,.3,1.2)}
.dip-modal__ic{width:64px;height:64px;margin:0 auto 14px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft,#f7f0dc);color:var(--gold-ink,#a9822f)}
.dip-modal__ic svg{width:32px;height:32px}
.dip-modal__ic.err{background:#FDECEC;color:#C0392B}
.dip-modal__card h3{margin:0 0 8px;font-size:1.2rem}
.dip-modal__card p{margin:0 0 18px;color:var(--muted,#667);line-height:1.55;font-size:.95rem}
.dip-modal__card p b{color:var(--text,#223)}
[data-theme=dark] .dip-modal__card{background:#171b2b;border-color:#2b3350}
@keyframes dipFade{from{opacity:0}to{opacity:1}}
@keyframes dipPop{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:none}}
</style>
<script>
/* Правка заявки в кабинете: те же зависимости полей, что и на подаче —
   подраздел и форма исполнения строго по выбранной номинации, чтобы в
   «Хореографии» нельзя было выбрать «Хор». Справочники приходят с сервера. */
(function(){
  var NOMS = <?= json_encode(NOMINATIONS(), JSON_UNESCAPED_UNICODE) ?>;
  var FORMS = <?= json_encode(FORMATIONS_MAP(), JSON_UNESCAPED_UNICODE) ?>;
  var FORMS_DEFAULT = <?= json_encode(FORMATIONS_FOR(''), JSON_UNESCAPED_UNICODE) ?>;

  function fill(sel, list, keep, placeholder) {
    if (!sel) return;
    var cur = keep || sel.value;
    sel.innerHTML = '<option value="">' + placeholder + '</option>';
    (list || []).forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v;
      if (v === cur) o.selected = true;
      sel.appendChild(o);
    });
  }

  document.querySelectorAll('[data-edit-form]').forEach(function (form) {
    var nom  = form.querySelector('[data-edit-nom]');
    var sub  = form.querySelector('[data-edit-sub]');
    var subW = form.querySelector('[data-edit-subwrap]');
    var frm  = form.querySelector('[data-edit-form-sel]');

    function sync(resetChild) {
      var n = nom ? nom.value : '';
      var subs = NOMS[n] || [];
      if (subW) subW.hidden = subs.length === 0;
      if (sub)  fill(sub, subs, resetChild ? '' : sub.value, 'Выберите подраздел');
      if (frm)  fill(frm, FORMS[n] || FORMS_DEFAULT, resetChild ? '' : frm.value, 'Выберите форму');
    }
    if (nom) nom.addEventListener('change', function () { sync(true); });

    // Переключатель «Солист / Коллектив»: показываем только нужное поле имени.
    form.querySelectorAll('.cab-seg input[name="is_group"]').forEach(function (r) {
      r.addEventListener('change', function () {
        var group = form.querySelector('.cab-seg input[name="is_group"]:checked').value === '1';
        form.querySelectorAll('.cab-seg label').forEach(function (l) {
          l.classList.toggle('on', l.querySelector('input').checked);
        });
        var solo = form.querySelector('[data-when="solo"]');
        var grp  = form.querySelector('[data-when="group"]');
        if (solo) solo.hidden = group;
        if (grp)  grp.hidden  = !group;
      });
    });
  });
})();
</script>
<script>
(function(){
  var modal=document.getElementById('dipModal'); if(!modal) return;
  var ic=document.getElementById('dipModalIc'), title=document.getElementById('dipModalTitle'), text=document.getElementById('dipModalText');
  var CSRF=<?= json_encode(csrf_token()) ?>, URL=<?= json_encode(url('/cabinet')) ?>;
  function openModal(ok,msg){
    ic.className='dip-modal__ic'+(ok?'':' err');
    title.textContent=ok?'Диплом отправлен':'Не удалось отправить';
    text.innerHTML=msg; modal.hidden=false; document.body.style.overflow='hidden';
  }
  function closeModal(){ modal.hidden=true; document.body.style.overflow=''; }
  modal.addEventListener('click',function(e){ if(e.target.closest('[data-dip-close]')) closeModal(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!modal.hidden) closeModal(); });
  document.addEventListener('click',function(e){
    var btn=e.target.closest('[data-dip-resend]'); if(!btn) return;
    e.preventDefault();
    var num=btn.getAttribute('data-dip-resend'), old=btn.innerHTML;
    btn.disabled=true; btn.style.opacity='.6';
    var body=new URLSearchParams({action:'resend_diploma',number:num,ajax:'1',_csrf:CSRF});
    fetch(URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},credentials:'same-origin',body:body})
      .then(function(r){return r.json();})
      .then(function(d){
        if(d&&d.ok){ openModal(true,'Письмо с дипломом № <b>'+num+'</b> отправлено на Вашу электронную почту <b>'+(d.email||'')+'</b>. Проверьте входящие и папку «Спам».'); }
        else{ openModal(false, (d&&d.msg)||'Попробуйте ещё раз позже.'); }
      })
      .catch(function(){ openModal(false,'Ошибка сети. Попробуйте ещё раз.'); })
      .finally(function(){ btn.disabled=false; btn.style.opacity=''; btn.innerHTML=old; });
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Личный кабинет', $content, ['active' => '/cabinet', 'meta' => 'Личный кабинет участника Культурного центра «Музыкальный Мир»: заявки, дипломы, награды, настройки.']);
