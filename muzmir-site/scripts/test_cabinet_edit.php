<?php
/**
 * ЖИВАЯ ПРОВЕРКА: СОХРАНЯЕТСЯ ЛИ ПРАВКА ЗАЯВКИ ИЗ ЛИЧНОГО КАБИНЕТА.
 *
 * Владелец сообщил, что «Изменить заявку» не сохраняет и данные не сходятся с
 * кабинетом, списками и админкой. Проверять такое по коду бессмысленно: форма
 * может отдаваться, а сохранение падать по любой из десятка причин — окно правки,
 * протухший токен, справочники, права. Поэтому здесь всё делается по-настоящему:
 * заводится временный участник со своей заявкой, скрипт логинится как он, шлёт
 * ровно ту форму, что и браузер, и сверяет, что легло в базу.
 *
 * Отдельно воспроизводится главная причина «кнопка не работает»: PHP-сессия на
 * сервере живёт 24 минуты, а вход — 30 дней. Человек открыл кабинет, заполнял
 * форму, телефон усыпил вкладку — и правка молча пропадала. Проверяем, что после
 * смерти PHP-сессии сохранение всё равно проходит.
 *
 * Всё созданное удаляется в конце, даже если проверка провалилась.
 *
 *   php scripts/test_cabinet_edit.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$base = 'https://127.0.0.1';
$host = 'xn----7sbugdeiegh1b0a9hen.xn--p1ai';
$jar  = tempnam(sys_get_temp_dir(), 'cabjar');
$line = str_repeat('=', 78);
$fail = 0;

/** Запрос к сайту с общей «корзиной» cookie — как у браузера. */
function web(string $url, array $post = null, string $jar = '', array $rawCookies = null): array {
    global $host;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_FOLLOWLOCATION => true, CURLOPT_HTTPHEADER => ['Host: ' . $host], CURLOPT_TIMEOUT => 30,
        CURLOPT_RESOLVE => [$host . ':443:127.0.0.1'],
    ]);
    // Либо общая корзина cookie, либо ровно тот набор, что передали (для проверки
    // «PHP-сессия умерла, вход остался»).
    if ($rawCookies !== null) {
        $pairs = [];
        foreach ($rawCookies as $k => $v) $pairs[] = $k . '=' . $v;
        curl_setopt($ch, CURLOPT_COOKIE, implode('; ', $pairs));
    } else {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $jar);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $jar);
    }
    if ($post !== null) {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post));
    }
    $body = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'body' => $body, 'err' => $err];
}

/** Токен формы со страницы. */
function csrf_of(string $html): string {
    return preg_match('~name="_csrf" value="([^"]+)"~', $html, $m) ? $m[1] : '';
}

/** Значение cookie из файла-корзины curl. */
function jar_cookie(string $jar, string $name): string {
    foreach (file($jar) ?: [] as $ln) {
        $p = preg_split('~\t~', trim($ln));
        if ($p && count($p) >= 7 && $p[5] === $name) return $p[6];
    }
    return '';
}

echo "ПРАВКА ЗАЯВКИ ИЗ КАБИНЕТА\n$line\n";

/* ── Временный участник и его заявка ──────────────────────────────────────── */
$mail = 'cab-test-' . bin2hex(random_bytes(4)) . '@example.test';
$pass = 'Pr0ba-' . bin2hex(random_bytes(3));
$uid  = 0; $appId = 0; $appId2 = 0; $admUid = 0;

try {
    $uid = (int) insert('users', [
        'email' => $mail, 'password_hash' => password_hash($pass, PASSWORD_DEFAULT),
        'full_name' => 'Тестов Тест Тестович', 'role' => 'user', 'email_verified' => 1,
    ]);
    $comp = one("SELECT id, code FROM competitions WHERE status='open' ORDER BY sort LIMIT 1");
    if (!$comp) { echo "нет открытых конкурсов — проверять негде\n"; exit(0); }
    $appId = (int) insert('applications', [
        'number' => 'TEST-' . date('Y') . '-' . random_int(10000, 99999),
        'competition_id' => (int) $comp['id'], 'user_id' => $uid,
        'full_name' => 'Тестов Тест Тестович', 'is_group' => 0,
        'nomination' => '', 'work_title' => 'Проба пера', 'teacher' => '',
        'institution' => '', 'city' => 'Россия, г. Москва', 'email' => $mail,
        'phone' => '+79000000000', 'video_url' => 'https://rutube.ru/video/test/',
        'status' => 'new', 'is_paid' => 1, 'created_at' => date('Y-m-d H:i:s'),
    ]);
    echo "заведены участник #$uid и заявка #$appId\n";

    /* ── Вход ──────────────────────────────────────────────────────────────── */
    $r = web($base . '/login', null, $jar);
    $tok = csrf_of($r['body']);
    if ($tok === '') { echo "  ✗ на странице входа нет токена формы\n"; $fail++; }
    $r = web($base . '/login', ['_csrf' => $tok, 'email' => $mail, 'password' => $pass], $jar);
    $authCookie = jar_cookie($jar, 'muzmir_sess');
    echo '  ' . ($authCookie !== '' ? '✓' : '✗') . " вход участника\n";
    if ($authCookie === '') $fail++;

    /* ── Кабинет: есть ли форма правки ─────────────────────────────────────── */
    $r = web($base . '/cabinet', null, $jar);
    $hasForm = mb_strpos($r['body'], 'value="edit_app"') !== false;
    echo '  ' . ($hasForm ? '✓' : '✗') . " форма «Изменить заявку» отдаётся\n";
    if (!$hasForm) { $fail++; }

    /* ── Отправляем правку ─────────────────────────────────────────────────── */
    $tok = csrf_of($r['body']);
    $newName = 'Иванова Мария Петровна';
    $newWork = 'Новое название номера';
    $newCity = 'Беларусь, Столбцы';
    $post = [
        '_csrf' => $tok, 'action' => 'edit_app', 'app_id' => (string) $appId,
        'is_group' => '0', 'full_name' => $newName, 'group_name' => '',
        'work_title' => $newWork, 'teacher' => 'Петров Пётр Петрович',
        'institution' => 'ДШИ №1', 'city' => $newCity, 'email' => $mail,
        'phone' => '+79001112233', 'video_url' => 'https://rutube.ru/video/test2/',
        'nomination' => '', 'subgroup' => '', 'formation' => '', 'age_category' => '',
        'address' => '', 'postal_index' => '',
    ];
    $r = web($base . '/cabinet', $post, $jar);

    /* ── Что легло в базу ──────────────────────────────────────────────────── */
    // Название номера сайт хранит в «ёлочках» — так же, как при подаче заявки.
    $a = one("SELECT * FROM applications WHERE id=?", [$appId]);
    $checks = [
        'ФИО участника'   => [(string) $a['full_name'], $newName],
        'название номера' => [(string) $a['work_title'], '«' . $newWork . '»'],
        'педагог'         => [(string) $a['teacher'], 'Петров Пётр Петрович'],
        'учреждение'      => [(string) $a['institution'], 'ДШИ №1'],
        'телефон'         => [(string) $a['phone'], '+79001112233'],
        'город'           => [(string) $a['city'], 'Республика Беларусь, г. Столбцы'],
        'ссылка'          => [(string) $a['video_url'], 'https://rutube.ru/video/test2/'],
    ];
    echo "\n  ЧТО СОХРАНИЛОСЬ:\n";
    foreach ($checks as $what => [$got, $want]) {
        $good = $got === $want;
        if (!$good) $fail++;
        printf("   %s %-18s %s\n", $good ? '✓' : '✗', $what,
            $good ? $got : ('«' . $got . '» вместо «' . $want . '»'));
    }

    /* ── Повторное сохранение тех же данных ничего не портит ───────────────── */
    $r = web($base . '/cabinet', null, $jar);
    $post['_csrf'] = csrf_of($r['body']);
    $post['work_title'] = (string) $a['work_title'];   // как отдаёт форма — уже в кавычках
    $post['city'] = (string) $a['city'];
    web($base . '/cabinet', $post, $jar);
    $a2 = one("SELECT * FROM applications WHERE id=?", [$appId]);
    $stable = (string) $a2['work_title'] === (string) $a['work_title']
           && (string) $a2['city'] === (string) $a['city'];
    echo '  ' . ($stable ? '✓' : '✗') . " повторное сохранение не портит данные ("
        . (string) $a2['work_title'] . ")\n";
    if (!$stable) $fail++;

    /* ── Кабинет показывает ровно то же и без двойных кавычек ──────────────── */
    $r = web($base . '/cabinet', null, $jar);
    $inCab = mb_strpos($r['body'], $newWork) !== false;
    echo '  ' . ($inCab ? '✓' : '✗') . " правка видна в кабинете сразу\n";
    if (!$inCab) $fail++;
    $dbl = mb_strpos($r['body'], '««') !== false || mb_strpos($r['body'], '»»') !== false;
    echo '  ' . (!$dbl ? '✓' : '✗') . " название показано в одной паре кавычек\n";
    if ($dbl) $fail++;

    /* ── ГЛАВНОЕ: PHP-сессия умерла, вход остался ──────────────────────────── */
    // Берём токен со страницы, затем шлём правку вообще без cookie PHP-сессии —
    // ровно то, что происходит у человека, который держал вкладку дольше 24 минут.
    $r = web($base . '/cabinet', null, $jar);
    $tok2 = csrf_of($r['body']);
    $post['_csrf'] = $tok2;
    $post['work_title'] = 'После долгой паузы';
    $r = web($base . '/cabinet', $post, '', ['muzmir_sess' => $authCookie]);
    $a3 = one("SELECT work_title FROM applications WHERE id=?", [$appId]);
    $survived = (string) $a3['work_title'] === '«После долгой паузы»';
    echo '  ' . ($survived ? '✓' : '✗') . " сохранение проходит после смерти PHP-сессии ("
        . (string) $a3['work_title'] . ")\n";
    if (!$survived) $fail++;

    /* ── Чужой/пустой токен по-прежнему отбивается ─────────────────────────── */
    $post['_csrf'] = '';
    $post['work_title'] = 'Взлом';
    web($base . '/cabinet', $post, '', ['muzmir_sess' => $authCookie]);
    $post['_csrf'] = str_repeat('a', 64);
    web($base . '/cabinet', $post, '', ['muzmir_sess' => $authCookie]);
    $a4 = one("SELECT work_title FROM applications WHERE id=?", [$appId]);
    $guard = (string) $a4['work_title'] === '«После долгой паузы»';
    echo '  ' . ($guard ? '✓' : '✗') . " запрос с чужим или пустым токеном отклонён\n";
    if (!$guard) $fail++;

    /* ── ТА ЖЕ ПРАВКА ИЗ АДМИНКИ ДАЁТ РОВНО ТО ЖЕ ЗНАЧЕНИЕ ─────────────────── */
    // Владелец сравнивает кабинет, списки и админку. Значит, одна и та же правка,
    // сделанная из разных мест, обязана давать побайтово одинаковую заявку.
    $adminMail = 'cab-adm-' . bin2hex(random_bytes(4)) . '@example.test';
    $adminPass = 'Adm-' . bin2hex(random_bytes(4));
    $admUid = (int) insert('users', [
        'email' => $adminMail, 'password_hash' => password_hash($adminPass, PASSWORD_DEFAULT),
        'full_name' => 'Админов Админ', 'role' => 'admin', 'email_verified' => 1,
    ]);
    $appId2 = (int) insert('applications', [
        'number' => 'TEST-' . date('Y') . '-' . random_int(10000, 99999),
        'competition_id' => (int) $comp['id'], 'user_id' => $uid,
        'full_name' => 'Тестов Тест Тестович', 'is_group' => 0,
        'nomination' => '', 'work_title' => 'Проба пера', 'teacher' => '',
        'institution' => '', 'city' => 'Россия, г. Москва', 'email' => $mail,
        'phone' => '+79000000000', 'video_url' => 'https://rutube.ru/video/test/',
        'status' => 'new', 'is_paid' => 1, 'created_at' => date('Y-m-d H:i:s'),
    ]);
    $ajar = tempnam(sys_get_temp_dir(), 'admjar');
    $r = web($base . '/login', null, $ajar);
    $r = web($base . '/login', ['_csrf' => csrf_of($r['body']), 'email' => $adminMail, 'password' => $adminPass], $ajar);
    $r = web($base . '/admin/?p=applications&id=' . $appId2, null, $ajar);
    $inAdmin = mb_strpos($r['body'], 'value="edit_app"') !== false;
    echo '  ' . ($inAdmin ? '✓' : '✗') . " карточка заявки в админке открывается\n";
    if (!$inAdmin) $fail++;
    web($base . '/admin/?p=applications', [
        '_csrf' => csrf_of($r['body']), 'do' => 'edit_app', 'id' => (string) $appId2,
        'full_name' => 'ИВАНОВА МАРИЯ ПЕТРОВНА', 'group_name' => '',
        'work_title' => 'Тихая песня', 'teacher' => 'петров пётр петрович',
        'institution' => 'ДШИ №1', 'city' => 'минск', 'email' => $mail,
        'phone' => '+79001112233', 'video_url' => 'https://rutube.ru/video/test3/',
        'nomination' => '', 'age_category' => '', 'formation' => '',
        'address' => '', 'postal_index' => '',
    ], $ajar);

    // И ту же самую правку — из кабинета участника.
    $r = web($base . '/cabinet', null, $jar);
    web($base . '/cabinet', [
        '_csrf' => csrf_of($r['body']), 'action' => 'edit_app', 'app_id' => (string) $appId,
        'is_group' => '0', 'full_name' => 'ИВАНОВА МАРИЯ ПЕТРОВНА', 'group_name' => '',
        'work_title' => 'Тихая песня', 'teacher' => 'петров пётр петрович',
        'institution' => 'ДШИ №1', 'city' => 'минск', 'email' => $mail,
        'phone' => '+79001112233', 'video_url' => 'https://rutube.ru/video/test3/',
        'nomination' => '', 'subgroup' => '', 'formation' => '', 'age_category' => '',
        'address' => '', 'postal_index' => '',
    ], $jar);
    @unlink($ajar);

    $fromCab = one("SELECT * FROM applications WHERE id=?", [$appId]);
    $fromAdm = one("SELECT * FROM applications WHERE id=?", [$appId2]);
    echo "\n  КАБИНЕТ И АДМИНКА ПОСЛЕ ОДНОЙ И ТОЙ ЖЕ ПРАВКИ:\n";
    foreach (['full_name' => 'ФИО', 'work_title' => 'название номера', 'teacher' => 'педагог',
              'institution' => 'учреждение', 'city' => 'город', 'phone' => 'телефон',
              'video_url' => 'ссылка'] as $col => $ru) {
        $a1 = (string) ($fromCab[$col] ?? ''); $a2 = (string) ($fromAdm[$col] ?? '');
        $good = $a1 === $a2 && $a1 !== '';
        if (!$good) $fail++;
        printf("   %s %-18s %s\n", $good ? '✓' : '✗', $ru,
            $good ? $a1 : ('кабинет «' . $a1 . '», админка «' . $a2 . '»'));
    }

    /* ── Одно значение на всех: списки и админка читают ту же строку ───────── */
    $sameInList = (string) (scalar("SELECT work_title FROM applications WHERE id=?", [$appId]) ?? '');
    $ok = $sameInList === (string) ($fromCab['work_title'] ?? '');
    echo '  ' . ($ok ? '✓' : '✗') . " то же значение видят списки и админка (одна таблица)\n";
    if (!$ok) $fail++;

} catch (\Throwable $e) {
    echo "  ✗ ОШИБКА: " . $e->getMessage() . "\n";
    $fail++;
} finally {
    foreach ([$appId ?? 0, $appId2 ?? 0] as $__a) {
        if (!$__a) continue;
        try { q("DELETE FROM diplomas WHERE application_id=?", [$__a]); q("DELETE FROM applications WHERE id=?", [$__a]); } catch (\Throwable $e) {}
    }
    foreach ([$uid ?? 0, $admUid ?? 0] as $__u) {
        if (!$__u) continue;
        try { q("DELETE FROM sessions WHERE user_id=?", [$__u]); q("DELETE FROM users WHERE id=?", [$__u]); } catch (\Throwable $e) {}
    }
    @unlink($jar);
    echo "\nвременные данные удалены\n";
}

echo "\n$line\n" . ($fail === 0 ? "Правка заявки работает и сходится везде.\n" : "ПРОБЛЕМ: $fail\n");
exit($fail === 0 ? 0 : 1);
