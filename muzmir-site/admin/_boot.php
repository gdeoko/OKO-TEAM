<?php
/**
 * Загрузчик админ-панели КЦ «Музыкальный Мир».
 * Подключает фундамент так же, как public/index.php, и добавляет
 * админ-хелперы: реестр модулей, ссылки, редиректы, иконки.
 */
declare(strict_types=1);

if (!defined('BASE_PATH')) define('BASE_PATH', dirname(__DIR__));

$CFG = require BASE_PATH . '/config.php';
$GLOBALS['CFG'] = $CFG;

require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/auth.php';

if (session_status() !== PHP_SESSION_ACTIVE) session_start();
db(); // инициализация/миграции

/* ---------- Иконки (feather-стиль, только inline SVG) ---------- */
function admin_icon(string $name): string {
    $p = [
        'dashboard'    => '<path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>',
        'competitions' => '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 4h3v2a3 3 0 0 1-3 3M7 4H4v2a3 3 0 0 0 3 3"/>',
        'applications' => '<path d="M9 12h6M9 16h6M9 8h2M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
        'grading'      => '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
        'diplomas'     => '<circle cx="12" cy="8" r="6"/><path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>',
        'users'        => '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
        'newsletter'   => '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="m22 6-10 7L2 6"/>',
        'cms'          => '<path d="M2 3h20v14H2zM8 21h8M12 17v4"/>',
        'settings'     => '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
        'plus'         => '<path d="M12 5v14M5 12h14"/>',
        'edit'         => '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
        'copy'         => '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        'trash'        => '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
        'download'     => '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
        'send'         => '<path d="m22 2-7 20-4-9-9-4 20-7z"/>',
        'check'        => '<path d="M20 6 9 17l-5-5"/>',
        'x'            => '<path d="M18 6 6 18M6 6l12 12"/>',
        'eye'          => '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
        'logout'      => '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
        'back'         => '<path d="M19 12H5M12 19l-7-7 7-7"/>',
        'money'        => '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
        'clock'        => '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        'chart'        => '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    ];
    $body = $p[$name] ?? $p['dashboard'];
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $body . '</svg>';
}

/* ---------- Реестр модулей: ключ => [название, мин.роль, иконка] ---------- */
function admin_modules(): array {
    return [
        'dashboard'    => ['Обзор',        'jury',      'dashboard'],
        'competitions' => ['Конкурсы',     'moderator', 'competitions'],
        'applications' => ['Заявки',       'jury',      'applications'],
        'grading'      => ['Оценивание',   'jury',      'grading'],
        'diplomas'     => ['Дипломы',      'moderator', 'diplomas'],
        'newsletter'   => ['Рассылки',     'moderator', 'newsletter'],
        'cms'          => ['Контент',      'moderator', 'cms'],
        'users'        => ['Пользователи', 'admin',     'users'],
        'settings'     => ['Настройки',    'admin',     'settings'],
    ];
}

/** Проверка доступа к модулю по текущей роли. */
function admin_can(string $module): bool {
    $m = admin_modules();
    if (!isset($m[$module])) return false;
    return user_can($m[$module][1]);
}

/** Ссылка внутри админки (относительная — админка живёт в /admin/). */
function a_link(string $p = 'dashboard', array $q = []): string {
    return '?' . http_build_query(['p' => $p] + $q);
}

/** Редирект внутри админки. */
function admin_redirect(string $p = 'dashboard', array $q = []): void {
    redirect('/admin/' . a_link($p, $q));
}

/** Гейт модуля: если роль не позволяет — 403 внутри лейаута. */
function admin_require(string $module): void {
    if (!admin_can($module)) {
        http_response_code(403);
        admin_layout('Доступ запрещён',
            '<div class="empty"><h2>Недостаточно прав</h2><p class="muted">Этот раздел доступен пользователям с более высокой ролью.</p><a class="btn btn--ghost" href="' . a_link('dashboard') . '">На главную панель</a></div>',
            $module);
        exit;
    }
}

/** Русское название роли. */
function role_ru(string $role): string {
    return [
        'user'=>'Участник','teacher'=>'Педагог','jury'=>'Жюри','designer'=>'Дизайнер',
        'accountant'=>'Бухгалтер','moderator'=>'Модератор','admin'=>'Администратор','owner'=>'Владелец',
    ][$role] ?? $role;
}

/** Русское название статуса заявки. */
function app_status_ru(string $s): string {
    return ['new'=>'Новая','paid'=>'Оплачена','judging'=>'На оценке','graded'=>'Оценена',
            'sent'=>'Отправлена','rejected'=>'Отклонена'][$s] ?? $s;
}
function comp_status_ru(string $s): string {
    return ['draft'=>'Черновик','open'=>'Открыт','closed'=>'Закрыт','judging'=>'Оценивание','finished'=>'Завершён'][$s] ?? $s;
}
