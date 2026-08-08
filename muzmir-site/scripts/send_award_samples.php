<?php
/**
 * ОБРАЗЦЫ НАГРАДНЫХ ПИСЕМ для владельца — тремя письмами, боевыми шаблонами:
 *
 *   1) ЭЛЕКТРОННЫЕ: основной + дополнительный + именной + благодарность
 *      ОДНИМ письмом (шаблон _diploma_group_html из cron/send_diplomas.php),
 *      четыре PDF во вложении. Ровно то, что получает участник.
 *
 *   2) ОРИГИНАЛЫ (без подписей и печатей) — СЛУЖЕБНОЕ письмо оргкомитету.
 *      ПРАВИЛО: оригиналы участнику на почту не отправляются НИКОГДА. Это
 *      печатный комплект: скачать → распечатать → подписать → отправить почтой.
 *
 *   3) ОТПРАВКА ОРИГИНАЛОВ с трек-номером (шаблон order_ship_email) — письмо,
 *      которое получает участник после ввода трека в админке.
 *
 * Запуск: php scripts/send_award_samples.php [email] [id_заявки_электронные] [id_заявки_оригиналы]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
define('MM_EMAIL_TEST_LIB', 1);                 // библиотечный режим крона
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/diploma_html.php';
require_once BASE_PATH . '/core/diploma_render.php';
require_once BASE_PATH . '/core/orders.php';
require_once BASE_PATH . '/cron/send_diplomas.php';     // _diploma_group_html, _diploma_files
db();

$TO      = $argv[1] ?? 'okoteam.top@gmail.com';
$APP_EL  = (int) ($argv[2] ?? 0);
$APP_ORIG= (int) ($argv[3] ?? 0);
$base    = rtrim((string) cfgv('base_url', ''), '/');

/** Заявка + конкурс. */
function sa_app(int $id): ?array {
    return one("SELECT a.*, c.name AS comp_name, c.slug AS comp_slug, c.type AS comp_type,
                       c.diploma_bg, c.diploma_template, c.is_paid AS comp_is_paid
                  FROM applications a JOIN competitions c ON c.id=a.competition_id
                 WHERE a.id=?", [$id]);
}
/** Конкурс в том виде, какой ждёт diploma_html(). */
function sa_comp(array $a): array {
    return ['id' => (int) $a['competition_id'], 'name' => (string) $a['comp_name'],
            'type' => (string) $a['comp_type'], 'diploma_bg' => (string) ($a['diploma_bg'] ?? ''),
            'diploma_template' => (string) ($a['diploma_template'] ?? '')];
}

/** Четыре типа наградных документов одной заявки. */
const SA_TYPES = [
    'main'   => ['Основной диплом',        []],
    'extra'  => ['Дополнительный диплом',  ['extra'  => true]],
    'named'  => ['Именной диплом',         ['named'  => true]],
    'thanks' => ['Благодарность педагогу', ['thanks' => true]],
];

/**
 * Собирает PDF всех четырёх документов заявки.
 * @param bool $clean true — оригинал БЕЗ подписей и печатей (для печати)
 * @return array<string, array{label:string, pdf:string, img:string, number:string}>
 */
function sa_build(array $a, bool $clean = false): array {
    $out = [];
    foreach (SA_TYPES as $type => [$label, $opt]) {
        // Номер у каждого документа свой — он же в QR проверки подлинности.
        $num = (string) $a['number'] . '-' . mb_strtoupper(substr($type, 0, 1));
        $row = array_merge($a, ['number' => $num]);
        $pdf = diploma_pdf_html($row, $opt + ['clean' => $clean]);
        if (!$pdf || !is_file($pdf)) { echo "   ! не собрался: $label\n"; continue; }
        // Превью первой страницы для тела письма (как в боевой рассылке).
        [, $img] = _diploma_files(['pdf_path' => $pdf, 'number' => $num]);
        $out[$type] = ['label' => $label, 'pdf' => $pdf, 'img' => (string) $img, 'number' => $num];
        printf("   собрано: %-24s %s\n", $label, basename($pdf));
    }
    return $out;
}

/** Отправка боевым путём с автозаменой ящика. */
function sa_send(string $to, string $subject, string $html, array $files, string $fromName): bool {
    $acc = mail_senders()['nagradi'] ?? [];
    $opt = ['from_name' => $fromName, 'attachments' => array_values($files)];
    if ($acc) $opt['account'] = $acc;
    if (function_exists('mail_switched')) mail_switched('');
    $ok = mail_send_failover($to, $subject, $html, $opt);
    $via = function_exists('mail_switched') ? mail_switched() : '';
    printf("   отправка: %s%s\n", $ok ? 'OK' : ('ОШИБКА — ' . (function_exists('mail_last_error') ? mail_last_error() : '')),
           $ok && $via !== '' ? " (резервная почта: $via)" : '');
    return $ok;
}

/* ─────────── 1. ЭЛЕКТРОННЫЕ — одним письмом ─────────── */
$a = $APP_EL > 0 ? sa_app($APP_EL) : null;
if (!$a) { fwrite(STDERR, "заявка для электронных не найдена\n"); exit(1); }
$comp = sa_comp($a);
$who  = ((int) $a['is_group'] === 1 && trim((string) $a['group_name']) !== '') ? (string) $a['group_name'] : (string) $a['full_name'];
echo "1) ЭЛЕКТРОННЫЕ — заявка {$a['number']} · {$a['comp_name']} · {$a['result']}\n";
$el = sa_build((array) $a, false);

if ($el) {
    // Блоки в том же виде, что и в боевой рассылке дипломов.
    $blocks = [];
    foreach ($el as $type => $d) {
        $blocks[] = [
            'type'   => $type,
            'number' => $d['number'],
            'img'    => $d['img'],
            'result' => $type === 'extra' ? (string) ($a['extra_diploma'] ?: 'ЗА ТВОРЧЕСКИЕ ДОСТИЖЕНИЯ') : (string) $a['result'],
        ];
    }
    $html = _diploma_group_html($blocks, $who, (string) $a['comp_name']);
    sa_send($TO, 'Ваши наградные документы — «' . (string) $a['comp_name'] . '»', $html,
            array_column($el, 'pdf'), 'Наградный отдел «Музыкальный Мир»');
}

/* ─────────── 2. ОРИГИНАЛЫ — служебное письмо оргкомитету ─────────── */
$b = $APP_ORIG > 0 ? sa_app($APP_ORIG) : $a;
echo "\n2) ОРИГИНАЛЫ (без подписей и печатей) — заявка {$b['number']} · {$b['result']}\n";
$or = sa_build((array) $b, true);

if ($or) {
    $whoB = ((int) $b['is_group'] === 1 && trim((string) $b['group_name']) !== '') ? (string) $b['group_name'] : (string) $b['full_name'];
    $rows = '';
    foreach ($or as $d) {
        $rows .= '<tr><td style="padding:7px 0;font-size:14px;color:' . MM_INK . ';border-bottom:1px solid ' . MM_LINE . ';">'
              . h($d['label']) . '</td>'
              . '<td style="padding:7px 0;font-size:13px;color:' . MM_MUTED . ';text-align:right;border-bottom:1px solid ' . MM_LINE . ';">№ '
              . h($d['number']) . '</td></tr>';
    }
    $inner = '<h1 style="margin:0 0 14px;font-family:Georgia,serif;font-size:24px;color:' . MM_NAVY . ';font-weight:700;">Комплект оригиналов к печати</h1>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#FFF6F4;border:1px solid #F0C9C0;border-radius:14px;"><tr>'
        . '<td style="width:4px;background:#C0392B;border-radius:14px 0 0 14px;"></td>'
        . '<td style="padding:13px 20px;font-size:13.5px;line-height:1.6;color:#7A2E22;">'
        . '<b style="color:#C0392B;">СЛУЖЕБНОЕ ПИСЬМО.</b> Оригиналы участнику на почту не отправляются никогда — '
        . 'только Почтой России после печати, подписей и печатей.</td></tr></table>'
        . '<p style="margin:0 0 16px;">Заказ по заявке <b style="color:' . MM_NAVY . ';">№' . h((string) $b['number']) . '</b> — '
        . h($whoB) . ', конкурс «' . h((string) $b['comp_name']) . '», результат: <b>' . h((string) $b['result']) . '</b>.</p>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:' . MM_CARD . ';border:1px solid ' . MM_LINE . ';border-radius:12px;"><tr><td style="padding:14px 20px;">'
        . '<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' . MM_MUTED . ';margin-bottom:6px;">Файлы к печати (во вложении)</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table></td></tr></table>'
        . '<p style="margin:14px 0 0;font-size:14px;color:' . MM_MUTED . ';line-height:1.6;">Печать на дизайнерской бумаге, '
        . 'живые подписи и печати ставятся вручную. После отправки — внести трек-номер в админке: '
        . 'заказ уйдёт в архив, участнику автоматически придёт письмо с отслеживанием.</p>';

    $html = mm_email_tx($inner, [
        'preheader' => 'Оригиналы к печати по заявке №' . (string) $b['number'] . ' — служебное письмо',
        'hero'      => mm_cta_primary($base . '/admin/?p=orders', 'Открыть заказы оригиналов', 'Печать · отправка · трек-номер'),
        'vip'       => false,
    ]);
    sa_send($TO, 'СЛУЖЕБНОЕ · Оригиналы к печати — заявка ' . (string) $b['number'], $html,
            array_column($or, 'pdf'), 'Оргкомитет «Музыкальный Мир»');
}

/* ─────────── 3. ОТПРАВКА ОРИГИНАЛОВ С ТРЕК-НОМЕРОМ ─────────── */
echo "\n3) ПИСЬМО ОБ ОТПРАВКЕ с трек-номером\n";
$order = [
    'id'        => 'ОБРАЗЕЦ',
    'full_name' => (string) $b['full_name'],
    'tracking'  => '80083502345678',
    'items'     => json_encode([
        ['item' => 'Кубок Гран-при',   'kind' => 'original', 'count' => 1],
        ['item' => 'Основной диплом',  'kind' => 'original', 'count' => 1],
        ['item' => 'Именной диплом',   'kind' => 'original', 'count' => 1],
        ['item' => 'Благодарность',    'kind' => 'original', 'count' => 1],
    ], JSON_UNESCAPED_UNICODE),
];
sa_send($TO, 'Ваши награды отправлены — трек 80083502345678', order_ship_email($order), [],
        'Наградный отдел «Музыкальный Мир»');

echo "\nГотово. Все письма — на " . $TO . "\n";
