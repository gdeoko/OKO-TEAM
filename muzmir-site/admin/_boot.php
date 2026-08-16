<?php
/**
 * Загрузчик админ-панели Культурного центра «Музыкальный Мир».
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
// ПОЧТОВЫЙ СЛОЙ ПОДКЛЮЧАЕМ ВСЕГДА.
//
// Половина кода спрашивает function_exists('mail_queue') и молча пропускает
// отправку, если ответ «нет». Ни один из трёх входов в приложение почту не
// подключал, и каждая такая ветка была миной: кнопка «Подтвердить почту» в
// кабинете именно так и не работала — редирект без письма и без ошибки.
// Файл только объявляет функции и цвета, ничего не выполняет, поэтому платить
// за него можно везде.
require_once BASE_PATH . '/core/mailer.php';
// Расшифровка денег по заявке (app_payment_view) нужна и спискам, и карточке заявки.
if (is_file(BASE_PATH . '/core/loyalty.php')) require_once BASE_PATH . '/core/loyalty.php';
// Клуб: членство и галочки участников (vip_kind/vip_mark) — их зовут почти все разделы.
if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
if (is_file(BASE_PATH . '/core/telegram.php')) require_once BASE_PATH . '/core/telegram.php';

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
        'trophy'       => '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
        'truck'        => '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18.5 21a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>',
        'search'       => '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
        'rocket'       => '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
        'chat'         => '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
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
        'grading'      => ['Оценка коротких', 'jury',    'grading'],
        'longcomp'     => ['Оценка длинных', 'jury',    'chart'],
        'dispatch'     => ['Отправки',     'moderator', 'send'],
        'chats'        => ['Чат-бот',      'moderator', 'chat'],
        // Пульт запуска — не в сайдбаре (4-й флаг true): открывается из раздела «Конкурсы» снизу.
        'launch'       => ['Запуск',       'admin',     'rocket', true],
        'diploma_editor' => ['Редактор наград', 'moderator', 'edit'],
        // Скрыты из сайдбара (4-й флаг true), но доступны по ссылке из «Редактора наград».
        'diplomas'     => ['Дипломы',      'moderator', 'diplomas', true],
        'orders'       => ['Заказы оригиналов', 'moderator', 'trophy'],
        'digital'      => ['Заказы электронных', 'moderator', 'diplomas'],
        'newsletter'   => ['Рассылки',     'moderator', 'newsletter'],
        // База учреждений — школы искусств, дома культуры, центры творчества.
        // Отсюда идут приглашения педагогам: именно они приводят детей на конкурсы.
        'institutions' => ['База учреждений', 'admin',  'users'],
        'partners'     => ['Партнёры',        'admin',  'trophy'],
        // Ведомства — министерства, союзы, порталы. Отсюда уходят официальные
        // обращения об информационной поддержке и сюда же приходят ответы.
        'ministries'   => ['Ведомства и обращения', 'admin', 'newsletter'],
        'inbox'        => ['Входящие письма', 'admin', 'newsletter'],
        'analytics'    => ['Аналитика',    'moderator', 'chart'],
        'cms'          => ['Контент',      'moderator', 'cms'],
        'users'        => ['Пользователи', 'admin',     'users'],
        'settings'     => ['Настройки',    'admin',     'settings'],
    ];
}

/* Галочки ВИП/команды (vip_kind, vip_badge, vip_mark, is_vip_user) переехали в
   core/club.php: ими пользуются не только админ-разделы, но и аудиты и сайт. */

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

/**
 * Русское название статуса заявки — В АДМИНСКОЙ ФОРМУЛИРОВКЕ.
 *
 * Эта функция обслуживает админку, поэтому и названия здесь админские: «Дипломы
 * готовы» вместо «На изготовлении», «Дипломы отправлены» вместо «Изготовлена».
 * Иначе фильтр «Статус» предлагал бы одни слова, а бейджи в той же таблице
 * показывали другие — и админ искал бы статус, которого в списке нет.
 */
function app_status_ru(string $s): string {
    // Единая лестница (core/app_status.php): new → judging → graded → making → made → done.
    // Старые значения submitted/pending/paid/sent оставлены для исторических записей.
    if (function_exists('app_state_labels')) {
        $l = app_state_labels(true);
        if (isset($l[$s])) return $l[$s][0];
    }
    return ['new'=>'Новая','submitted'=>'Подана','pending'=>'Ожидает оплаты','paid'=>'Оплачена',
            'judging'=>'На оценке','graded'=>'Оценена','making'=>'Дипломы готовы',
            'made'=>'Дипломы отправлены','extra'=>'Доп. заказ','sent'=>'Отправлена',
            'done'=>'Исполнена','rejected'=>'Отклонена'][$s] ?? $s;
}
function comp_status_ru(string $s): string {
    return ['draft'=>'Черновик','open'=>'Открыт','closed'=>'Закрыт','judging'=>'Оценивание','finished'=>'Завершён'][$s] ?? $s;
}

/* ---------- Шаблон диплома: темы, превью, гейт подтверждения ---------- */

/** Допустимые темы фона диплома. */
function diploma_themes(): array {
    return [
        'black_gold'    => 'Чёрный с золотом',
        'white_baroque' => 'Белое барокко',
        'patriotic'     => 'Патриотическая',
    ];
}
function diploma_theme_label(string $key): string {
    return diploma_themes()[$key] ?? 'По умолчанию';
}

/** Абсолютный путь к фону-подложке из относительного пути/URL, если это локальный файл. */
function diploma_bg_path(string $ref): string {
    $ref = trim($ref);
    if ($ref === '' || str_starts_with($ref, 'http')) return $ref;
    if (is_file($ref)) return $ref;
    $abs = BASE_PATH . '/public/' . ltrim($ref, '/');
    return is_file($abs) ? $abs : $ref;
}

/**
 * Генерирует тестовый диплом по данным конкурса на фейковом участнике.
 * Возвращает ['ok'=>bool,'pdf_url'=>string,'png_url'=>string,'error'=>string].
 * PDF→PNG — через pdftoppm, если доступен; иначе показываем сам PDF.
 */
function diploma_preview_generate(array $comp): array {
    $out = ['ok' => false, 'pdf_url' => '', 'png_url' => '', 'error' => ''];
    if (is_file(BASE_PATH . '/core/pdf_diploma.php')) require_once BASE_PATH . '/core/pdf_diploma.php';
    if (!function_exists('pdf_diploma')) {
        $out['error'] = 'Генератор диплома пока не подключён.';
        return $out;
    }
    // diploma_template нынче хранит JSON визуального редактора — как путь к фону не используем.
    $legacyTpl = trim((string)($comp['diploma_template'] ?? ''));
    if ($legacyTpl !== '' && $legacyTpl[0] === '{') $legacyTpl = '';
    $bg = trim((string)($comp['diploma_bg'] ?: $legacyTpl));
    $fake = [
        'is_group'     => 0,
        'full_name'    => 'Иванова Анна Сергеевна',
        'result'       => 'Лауреат I степени',
        'score'        => 9.2,
        'nomination'   => 'Вокальное искусство',
        'subgroup'     => 'Эстрадный вокал',
        'age_category' => '13-15 лет',
        'teacher'      => 'Петрова Мария Ивановна',
        'institution'  => 'Детская школа искусств №1',
        'city'         => 'Москва',
        'competition_id'   => (int)$comp['id'],
        'competition'      => (string)$comp['name'],
        'number'           => 'PREVIEW-' . date('Y') . '-' . str_pad((string)$comp['id'], 5, '0', STR_PAD_LEFT),
        'created_at'       => date('Y-m-d'),
        'diploma_theme'    => (string)$comp['diploma_theme'],
        'diploma_bg'       => $bg ? diploma_bg_path($bg) : '',
        'diploma_template' => $bg ? diploma_bg_path($bg) : '',
    ];
    try {
        $pdf = pdf_diploma($fake, 'main');
    } catch (\Throwable $e) {
        $out['error'] = 'Не удалось собрать превью: ' . $e->getMessage();
        return $out;
    }
    if (!$pdf || !is_file($pdf)) {
        $out['error'] = 'Генератор вернул пустой результат.';
        return $out;
    }
    $rel = str_replace(BASE_PATH . '/public', '', $pdf);
    $out['ok'] = true;
    $out['pdf_url'] = url($rel);

    // PDF → PNG, если доступен растеризатор (не обязателен).
    $bin = trim((string)@shell_exec('command -v pdftoppm 2>/dev/null'));
    if ($bin !== '') {
        $pngBase = preg_replace('/\.pdf$/i', '', $pdf);
        @shell_exec(escapeshellarg($bin) . ' -png -singlefile -r 110 '
            . escapeshellarg($pdf) . ' ' . escapeshellarg($pngBase) . ' 2>/dev/null');
        if (is_file($pngBase . '.png')) {
            $out['png_url'] = url(str_replace(BASE_PATH . '/public', '', $pngBase . '.png'));
        }
    }
    return $out;
}

/** true, если у конкурса подтверждён шаблон диплома. */
function diploma_is_approved(int $cid): bool {
    return (int) scalar("SELECT diploma_approved FROM competitions WHERE id=?", [$cid]) === 1;
}

/**
 * БЛОК «ЭТОТ ЖЕ НОМЕР УЖЕ ОЦЕНИВАЛИ НА ДРУГОМ КОНКУРСЕ».
 *
 * Показывается только когда совпадение реально есть, и только по оценённым
 * заявкам. Смысл блока — не статистика, а предупреждение жюри: если тому же
 * коллективу за этот же номер месяц назад присудили «Лауреат II степени», а
 * сегодня поставить «Гран-при», участник сравнит два диплома и придёт с
 * вопросом, на который отвечать будет нечего.
 *
 * @param array<int, array{id:int,number:string,who:string,work:string,comp:string,result:string,extra:string,graded_at:string}> $rows
 */
function admin_same_work_box(array $rows): string {
    if (!$rows) return '';

    $items = '';
    foreach ($rows as $r) {
        $when = trim((string) $r['graded_at']) !== ''
            ? ' <span class="muted">· ' . h(date('d.m.Y H:i', strtotime((string) $r['graded_at']))) . '</span>'
            : '';
        $extra = trim((string) $r['extra']) !== ''
            ? ' <span class="badge badge--extra">' . h($r['extra']) . '</span>'
            : '';
        // Название номера участники часто вписывают уже в кавычках. Оборачивать
        // его ещё раз нельзя — получается «„Румяная история“».
        $work = trim((string) $r['work']);
        $quoted = preg_match('~^[«"„\'].*[»"“\']$~u', $work) ? $work : '«' . $work . '»';
        $items .= '<div style="padding:8px 0;border-top:1px solid var(--a-line)">'
                . '<b>' . h($r['who']) . '</b> — ' . h($quoted) . '<br>'
                . '<span class="small muted">' . h($r['comp']) . '</span>'
                . ' <a class="small" href="' . a_link('applications', ['id' => (int) $r['id']]) . '">'
                . h($r['number'] ?: ('#' . (int) $r['id'])) . '</a>' . $when
                . '<div style="margin-top:4px"><span class="badge badge--gold">' . h($r['result']) . '</span>' . $extra . '</div>'
                . '</div>';
    }

    $title = count($rows) === 1
        ? 'Этот же номер уже оценивали на другом конкурсе'
        : 'Этот же номер уже оценивали на других конкурсах (' . count($rows) . ')';

    return '<div style="border:1px solid #E2B93B;background:#FFFBEF;border-radius:12px;padding:12px 16px;margin-bottom:14px">'
         . '<b>' . $title . '</b>'
         . '<div class="small muted" style="margin:4px 0 2px">Тот же исполнитель и то же название номера. '
         . 'Учтите при выставлении оценки.</div>'
         . $items . '</div>';
}

/**
 * ТАБЛИЦА «ОЦЕНЁННЫЕ» — ОДНА И ТА ЖЕ В ОБОИХ РАЗДЕЛАХ ОЦЕНКИ.
 *
 * Показывает всё, что администратор уже разобрал: и звания, и отклонения. По
 * каждой строке видно, когда участник узнает результат и когда получит наградные
 * документы, и отсюда же можно поправить решение, перенести отправку, снять
 * отклонение или сделать копию заявки.
 *
 * @param array  $rows строки graded_rows()
 * @param string $back раздел, куда возвращаться после действия ('grading' | 'longcomp')
 * @param array  $keep параметры адреса, которые надо сохранить при возврате
 */
function admin_graded_table(array $rows, string $back = 'grading', array $keep = []): string {
    if (!$rows) {
        return '<p class="muted small">Пока ничего не оценено и не отклонено.</p>';
    }
    if (!function_exists('graded_send_info')) require_once BASE_PATH . '/core/graded_list.php';
    // Списки званий и спец-номинаций нужны прямо в таблице: решение меняется здесь же,
    // без захода в карточку оценки.
    if (!function_exists('RESULT_PRESETS')) require_once BASE_PATH . '/core/presets.php';
    $glExtra = function_exists('EXTRA_PRESETS') ? EXTRA_PRESETS() : [];

    ob_start(); ?>
<div class="table-wrap"><table class="tbl gl-tbl">
  <thead><tr>
    <th>Участник</th><th>Конкурсный номер</th><th>Разобрана</th>
    <th>Решение</th><th>Отправка</th><th style="width:230px"></th>
  </tr></thead>
  <tbody>
  <?php foreach ($rows as $a):
      $aid  = (int) $a['id'];
      $rej  = (string) $a['status'] === 'rejected';
      $who  = trim((string) ($a['group_name'] ?? '')) !== '' && (int) ($a['is_group'] ?? 0)
                ? (string) $a['group_name'] : (string) $a['full_name'];
      $when = trim((string) ($a['graded_at'] ?? '')) !== '' ? (string) $a['graded_at'] : (string) $a['created_at'];
      $info = graded_send_info($a);
      $link = a_link('grading', ['id' => $aid] + $keep);
  ?>
    <tr<?= $rej ? ' class="gl-rej"' : '' ?>>
      <td>
        <b><?= h($who) ?></b><?= vip_mark((int) ($a['user_id'] ?? 0), '', (string) ($a['email'] ?? '')) ?>
        <div class="small muted"><?= h((string) ($a['number'] ?: '#' . $aid)) ?> · <?= h((string) $a['comp']) ?></div>
      </td>
      <td class="small"><?= h((string) $a['work_title']) ?></td>
      <td class="small"><?= h(date('d.m.y H:i', strtotime($when))) ?></td>
      <td>
        <?php if ($rej): ?>
          <span class="badge badge--rejected">Отклонена</span>
          <?php if (trim((string) ($a['reject_reason'] ?? '')) !== ''): ?>
            <div class="small muted" style="max-width:280px"><?= h(mb_substr((string) $a['reject_reason'], 0, 120)) ?></div>
          <?php endif; ?>
        <?php else: ?>
          <span class="badge badge--gold"><?= h((string) $a['result']) ?></span>
          <?php if (trim((string) ($a['extra_diploma'] ?? '')) !== ''): ?>
            <div class="small muted">доп: <?= h((string) $a['extra_diploma']) ?></div>
          <?php endif; ?>
        <?php endif; ?>
      </td>
      <td class="small">
        <div<?= $info['result_done'] ? ' style="color:var(--a-navy)"' : ' class="muted"' ?>>
          Результат: <?= h($info['result']) ?>
        </div>
        <?php if (!$rej): ?>
          <div<?= $info['docs_done'] ? ' style="color:var(--a-navy)"' : ' class="muted"' ?>>
            Дипломы: <?= h($info['docs']) ?>
          </div>
        <?php endif; ?>
      </td>
      <td style="white-space:nowrap">
        <a class="btn btn--primary btn--sm" href="<?= $link ?>"><?= admin_icon('grading') ?><?= $rej ? 'Открыть' : 'Изменить' ?></a>
        <a class="btn btn--ghost btn--sm" href="<?= a_link('applications', ['id' => $aid]) ?>">Заявка</a>
        <details class="gl-more"><summary class="btn btn--ghost btn--sm">Ещё</summary>
          <div class="gl-menu">
            <?php if (!$rej): ?>
              <?php /* СМЕНА ЗВАНИЯ ПРЯМО В АРХИВЕ. Форма уходит в раздел оценки тем же
                        действием grade_result: там вся логика переоценки — пересоздание
                        неотправленного диплома, пересчёт срока, повторная отправка
                        результата. Вторую такую же логику здесь заводить нельзя. */ ?>
              <form method="post" action="<?= url('/admin/?p=grading') ?>" class="gl-f"><?= csrf_field() ?>
                <input type="hidden" name="p" value="grading">
                <input type="hidden" name="do" value="grade_result"><input type="hidden" name="id" value="<?= $aid ?>">
                <input type="hidden" name="back" value="archive">
                <input type="hidden" name="jury_comment" value="<?= h((string) ($a['jury_comment'] ?? '')) ?>">
                <label class="small muted">Изменить решение</label>
                <select name="result">
                  <?php foreach (RESULT_PRESETS() as $rp): ?>
                    <option value="<?= h($rp) ?>" <?= (string) $a['result'] === $rp ? 'selected' : '' ?>><?= h($rp) ?></option>
                  <?php endforeach; ?>
                </select>
                <select name="extra_diploma">
                  <option value="">— без доп. диплома —</option>
                  <?php foreach ($glExtra as $ep): ?>
                    <option value="<?= h($ep) ?>" <?= (string) ($a['extra_diploma'] ?? '') === $ep ? 'selected' : '' ?>><?= h($ep) ?></option>
                  <?php endforeach; ?>
                  <?php $ce = trim((string) ($a['extra_diploma'] ?? '')); if ($ce !== '' && !in_array($ce, $glExtra, true)): ?>
                    <option value="<?= h($ce) ?>" selected><?= h($ce) ?></option>
                  <?php endif; ?>
                </select>
                <label class="small"><input type="checkbox" name="auto_send" value="1" checked> отправить по сроку</label>
                <button class="btn btn--navy btn--sm" name="save" value="1">Сохранить решение</button>
              </form>
              <form method="post" action="<?= url('/admin/') ?>" class="gl-f"><?= csrf_field() ?>
                <input type="hidden" name="do" value="gl_resched"><input type="hidden" name="id" value="<?= $aid ?>">
                <?php foreach ($keep as $k => $v): ?><input type="hidden" name="<?= h((string) $k) ?>" value="<?= h((string) $v) ?>"><?php endforeach; ?>
                <label class="small muted">Перенести отправку наград</label>
                <input type="datetime-local" name="at" required>
                <button class="btn btn--navy btn--sm">Перенести</button>
              </form>
            <?php else: ?>
              <?php /* ПРАВКА ОСНОВАНИЯ ОТКЛОНЕНИЯ. Ошибиться пунктом положения так же
                        легко, как званием, а поправить это было нечем: единственная
                        кнопка отклоняла заново и слала участнику второй отказ. */ ?>
              <form method="post" action="<?= url('/admin/?p=grading') ?>" class="gl-f"><?= csrf_field() ?>
                <input type="hidden" name="p" value="grading">
                <input type="hidden" name="do" value="reject_edit"><input type="hidden" name="id" value="<?= $aid ?>">
                <input type="hidden" name="back" value="archive">
                <label class="small muted">Изменить причину отклонения</label>
                <textarea name="reject_reason" rows="3"><?= h((string) ($a['reject_reason'] ?? '')) ?></textarea>
                <label class="small"><input type="checkbox" name="notify" value="1"> сообщить участнику</label>
                <button class="btn btn--navy btn--sm">Сохранить причину</button>
              </form>
              <form method="post" action="<?= url('/admin/') ?>" class="gl-f"
                    onsubmit="return confirm('Снять отклонение? Заявка вернётся в очередь на оценку.')"><?= csrf_field() ?>
                <input type="hidden" name="do" value="gl_unreject"><input type="hidden" name="id" value="<?= $aid ?>">
                <?php foreach ($keep as $k => $v): ?><input type="hidden" name="<?= h((string) $k) ?>" value="<?= h((string) $v) ?>"><?php endforeach; ?>
                <button class="btn btn--ghost btn--sm">Снять отклонение</button>
              </form>
            <?php endif; ?>
            <form method="post" action="<?= url('/admin/') ?>" class="gl-f"
                  onsubmit="return confirm('Создать копию заявки? Копия будет без результата и без оплаты.')"><?= csrf_field() ?>
              <input type="hidden" name="do" value="gl_duplicate"><input type="hidden" name="id" value="<?= $aid ?>">
              <?php foreach ($keep as $k => $v): ?><input type="hidden" name="<?= h((string) $k) ?>" value="<?= h((string) $v) ?>"><?php endforeach; ?>
              <button class="btn btn--ghost btn--sm">Дублировать заявку</button>
            </form>
          </div>
        </details>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table></div>
<style>
.gl-tbl td{vertical-align:top}
.gl-tbl .gl-rej{background:rgba(190,60,60,.05)}
.gl-more{position:relative;display:inline-block}
.gl-more summary{list-style:none;cursor:pointer}
.gl-more summary::-webkit-details-marker{display:none}
.gl-menu{position:absolute;right:0;top:calc(100% + 4px);z-index:30;min-width:250px;padding:12px;
         background:var(--a-card,#fff);border:1px solid var(--a-line);border-radius:12px;
         box-shadow:0 12px 32px rgba(0,0,0,.16)}
.gl-menu .gl-f{display:flex;flex-direction:column;gap:6px;padding:8px 0}
.gl-menu .gl-f + .gl-f{border-top:1px solid var(--a-line)}
.gl-menu input[type=datetime-local],.gl-menu select,.gl-menu textarea{
         padding:7px 9px;border:1px solid var(--a-line);border-radius:8px;font-size:.86rem;
         width:100%;box-sizing:border-box;font-family:inherit}
.gl-menu textarea{resize:vertical;min-height:64px}
.gl-menu{min-width:290px}
@media (max-width:820px){.gl-menu{position:static;box-shadow:none;min-width:0}}
</style>
<?php
    return (string) ob_get_clean();
}

/**
 * Обработчик действий таблицы «Оценённые». Общий для обоих разделов оценки,
 * поэтому и живёт здесь, а не в каждом из них по копии.
 *
 * @return bool обработал ли действие (тогда вызывающий уже сделал редирект)
 */
function admin_graded_actions(string $back, array $keep = []): bool {
    $do = (string) input('do');
    if (!in_array($do, ['gl_resched', 'gl_unreject', 'gl_duplicate'], true)) return false;
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect($back, $keep); }

    $aid = (int) input('id');
    $a   = $aid ? one("SELECT * FROM applications WHERE id=?", [$aid]) : null;
    if (!$a) { flash('Заявка не найдена.', 'error'); admin_redirect($back, $keep); }

    // Снять отклонение можно и из карточки заявки — тогда и возвращаемся туда,
    // а не в раздел оценки: администратор разбирался с этой заявкой, а не судил.
    if ((string) input('back') === 'applications') { $back = 'applications'; $keep = ['id' => $aid]; }

    if ($do === 'gl_resched') {
        require_once BASE_PATH . '/core/dispatch_ops.php';
        $r = dops_diplomas_resched($aid, (string) input('at'));
        flash($r['msg'], $r['ok'] ? 'success' : 'error');
    } elseif ($do === 'gl_unreject') {
        // Возвращаем в очередь: результат не трогаем — если он был, заявка снова
        // окажется в «оценённых», а если нет, вернётся на аттестацию.
        update('applications', ['status' => 'new', 'reject_reason' => ''], 'id=:id', ['id' => $aid]);
        if (function_exists('app_status_sync')) app_status_sync($aid);
        audit('application_unreject', 'application', $aid, ['from' => $back]);
        flash('Отклонение снято — заявка вернулась в работу.', 'success');
    } else {
        require_once BASE_PATH . '/core/graded_list.php';
        $r = app_duplicate($aid, (int) input('to_competition'));
        flash($r['msg'], $r['ok'] ? 'success' : 'error');
    }
    admin_redirect($back, $keep);
    return true;
}

