<?php
/**
 * ПРИМЕНЕНИЕ СВЕРКИ ВЕДОМСТВ К БАЗЕ.
 *
 * Читает куски сверки из data/verify/part-*.json — их пишут агенты, проверявшие
 * каждое ведомство по его официальному сайту, — и переносит подтверждённые данные
 * в таблицу ministries вместе со следом проверки: когда сверяли, по какой ссылке,
 * с какой уверенностью.
 *
 * Правило одно и жёсткое: В БАЗУ ПОПАДАЕТ ТОЛЬКО ПОДТВЕРЖДЁННОЕ. Запись с
 * confidence ниже 'high' или без ссылки на источник не перезаписывает ничего —
 * ведомство просто остаётся несверенным и письма не получит. Обращение именное и
 * отправляется один раз: ошибка в фамилии означает отказ в регистрации обращения.
 *
 *   php scripts/apply_ministry_verify.php            — показать, что изменится
 *   php scripts/apply_ministry_verify.php apply      — применить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ministries.php';

$apply = (($argv[1] ?? '') === 'apply');
min_migrate();

/* ── Читаем куски сверки ─────────────────────────────────────────────────── */

$dir   = BASE_PATH . '/data/verify';
$files = glob($dir . '/part-*.json') ?: [];
if (!$files) { echo "Нет файлов сверки в $dir\n"; exit(1); }

$recs = [];
foreach ($files as $f) {
    $j = json_decode((string) file_get_contents($f), true);
    if (!is_array($j)) { echo "  пропущен нечитаемый файл: " . basename($f) . "\n"; continue; }
    // Агент мог обернуть массив в объект — принимаем оба вида.
    foreach ((isset($j['results']) && is_array($j['results']) ? $j['results'] : $j) as $r) {
        if (is_array($r) && isset($r['idx'])) $recs[(int) $r['idx']] = $r;
    }
}
echo "Файлов сверки: " . count($files) . ", записей: " . count($recs) . "\n\n";

/* ── Соответствие idx → строки ministries ────────────────────────────────── */

$src = json_decode((string) file_get_contents(BASE_PATH . '/data/ministries_to_verify.json'), true) ?: [];
$byIdx = [];
foreach ($src as $s) if (isset($s['idx'])) $byIdx[(int) $s['idx']] = $s;

/** Адрес выглядит рабочим? Пустые и явно ломаные не пишем. */
$okEmail = static fn(string $e): bool => $e !== '' && (bool) filter_var($e, FILTER_VALIDATE_EMAIL);

/** ФИО из трёх слов — Фамилия Имя Отчество. Иначе именное обращение не построить. */
$okFio = static function (string $f): bool {
    $w = preg_split('~\s+~u', trim($f)) ?: [];
    return count($w) === 3 && mb_strlen(trim($f)) >= 10;
};

$stat = ['применено' => 0, 'без подтверждения' => 0, 'без ссылки' => 0,
         'кривое ФИО' => 0, 'нет в базе' => 0, 'сменился руководитель' => 0, 'сменился адрес' => 0];
$now = date('Y-m-d H:i:s');

foreach ($recs as $idx => $r) {
    $s = $byIdx[$idx] ?? null;
    if (!$s) { $stat['нет в базе']++; continue; }

    $conf = (string) ($r['confidence'] ?? 'low');
    $urls = array_values(array_filter(array_map('trim', (array) ($r['source_urls'] ?? []))));
    $fio  = trim((string) ($r['person'] ?? ''));
    $role = trim((string) ($r['person_role_nominative'] ?? ''));
    $mail = mb_strtolower(trim((string) ($r['email'] ?? '')));

    if ($conf !== 'high') { $stat['без подтверждения']++; continue; }
    if (!$urls)           { $stat['без ссылки']++;        continue; }
    if ($fio !== '' && !$okFio($fio)) { $stat['кривое ФИО']++; continue; }

    // Одна организация — несколько строк в ministries (канцелярия, пресс-служба).
    // Руководитель и приёмная у них общие, а адрес у каждой свой.
    foreach ((array) ($s['ids'] ?? []) as $mid) {
        $cur = one("SELECT * FROM ministries WHERE id=?", [(int) $mid]);
        if (!$cur) continue;

        $data = [
            'verified_at' => $now,
            'verify_url'  => $urls[0],
            'verify_conf' => 'high',
        ];
        // Пресс-службе именной адресат не нужен — там письмо идёт на редакционный ящик.
        if ($fio !== '' && (string) ($cur['branch'] ?? 'main') !== 'press') {
            if (mb_strtolower(trim((string) $cur['person'])) !== mb_strtolower($fio)) $stat['сменился руководитель']++;
            $data['person'] = $fio;
            // В базе должность хранится в дательном падеже — так она печатается в
            // реквизите «адресат» по ГОСТ. Агент возвращает именительный, и его
            // тоже сохраняем: благодарственному письму нужна исходная форма.
            if ($role !== '') {
                $data['person_role']     = min_role_dative($role);
                $data['person_role_nom'] = $role;
            }
        }
        // Адрес меняем только у главной строки: у пресс-службы он свой и правильный.
        if ($okEmail($mail) && (string) ($cur['branch'] ?? 'main') !== 'press'
            && mb_strtolower(trim((string) $cur['email'])) !== $mail) {
            // Уникальный индекс по email: занятый другим ведомством адрес не трогаем.
            $busy = one("SELECT id FROM ministries WHERE email=? AND id<>?", [$mail, (int) $mid]);
            if (!$busy) { $data['email'] = $mail; $stat['сменился адрес']++; }
        }
        foreach ([['official_site', 'site'], ['e_reception_url', 'e_reception_url'],
                  ['phone', 'phone'], ['address', 'post_address'], ['appointed', 'appointed']] as [$from, $to]) {
            $v = trim((string) ($r[$from] ?? ''));
            if ($v !== '') $data[$to] = $v;
        }

        if ($apply) { try { update('ministries', $data, 'id=:id', ['id' => (int) $mid]); } catch (\Throwable $e) {} }
        $stat['применено']++;
    }
}

echo ($apply ? "ПРИМЕНЕНО" : "ПРЕДПРОСМОТР (запуск с 'apply' запишет в базу)") . "\n";
foreach ($stat as $k => $v) printf("  %-26s %d\n", $k, $v);

if ($apply) {
    $ready = count(min_recipients());
    echo "\nГотовых к отправке адресатов (сверены, ФИО есть): $ready\n";
}
