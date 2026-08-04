<?php
/**
 * Точка входа админ-панели Культурного центра «Музыкальный Мир».
 * Логин по email+паролю, гейт require_role('jury'), роутер по ?p=.
 */
declare(strict_types=1);

require __DIR__ . '/_boot.php';
require __DIR__ . '/layout.php';

/* ---------- Логин ---------- */
if (($_POST['do'] ?? '') === 'login') {
    $email = input('email');
    $pass  = (string)($_POST['password'] ?? '');
    if (!csrf_check()) {
        admin_login_layout('Сессия устарела. Обновите страницу и попробуйте снова.', $email); exit;
    }
    if (!rate_ok('admin-login:' . client_ip(), 15, 900)) {
        admin_login_layout('Слишком много попыток. Подождите немного.', $email); exit;
    }
    $u = attempt_login($email, $pass);
    if (!$u) {
        admin_login_layout('Неверная почта или пароль.', $email); exit;
    }
    if ((ROLE_RANK[$u['role']] ?? 0) < ROLE_RANK['jury']) {
        admin_login_layout('У этого аккаунта нет доступа к панели управления.', $email); exit;
    }
    login_user((int)$u['id']);
    audit('admin_login', 'user', (int)$u['id']);
    admin_redirect('dashboard');
}

/* ---------- Выход ---------- */
if (($_GET['p'] ?? '') === 'logout') {
    if ($u = current_user()) audit('admin_logout', 'user', (int)$u['id']);
    logout_user();
    redirect('/admin/');
}

/* ---------- Гейт: минимум роль jury ---------- */
if (!user_can('jury')) {
    admin_login_layout();
    exit;
}

/* ---------- Роутер ---------- */
$modules = admin_modules();
$p = (string)($_GET['p'] ?? '');
// Формы админки постятся на /admin/ без ?p= — восстанавливаем страницу из Referer,
// иначе POST-обработчики (смена статуса, массовые действия, сохранение) не срабатывали
// и грузился дашборд («вылетало на главную»).
if ($p === '' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    $ref = (string)($_SERVER['HTTP_REFERER'] ?? '');
    if ($ref !== '' && preg_match('~[?&]p=([a-z_]+)~', $ref, $mref)) $p = $mref[1];
}
if ($p === '' || !isset($modules[$p]) || !is_file(__DIR__ . '/' . $p . '.php')) {
    $p = 'dashboard';
}
admin_require($p);
require __DIR__ . '/' . $p . '.php';
