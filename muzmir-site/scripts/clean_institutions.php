<?php
/**
 * ЧИСТКА БАЗЫ УЧРЕЖДЕНИЙ — ОПЕЧАТКИ В ДОМЕНАХ И НЕПРИГОДНЫЕ ЯЩИКИ.
 *
 * База собрана из открытых источников, где адреса набивали руками, поэтому в
 * ней лежит характерный мусор: «mail.ri» вместо «mail.ru», ящики вида
 * postmaster@ и root@, домены давно закрытых сервисов. Всё это не просто
 * бесполезно — каждый такой адрес даёт отлуп почтовика, а доля отлупов прямо
 * влияет на то, попадут ли остальные письма во «Входящие».
 *
 * ЧТО ДЕЛАЕТ СКРИПТ
 *   1. Чинит опечатки доменов по ЯВНОМУ списку — не по «похожести».
 *      Автоподбор по расстоянию Левенштейна пробовали: он уверенно предлагает
 *      «cap.ru → ya.ru» (а cap.ru — рабочий домен Чувашии) и «vk.ru → bk.ru».
 *      Цена ошибки здесь — письмо чужому человеку, поэтому список ручной.
 *   2. Помечает непригодные адреса статусом invalid: служебные ящики и домены,
 *      у которых в DNS нет ни MX, ни A — письмо туда не уйдёт физически.
 *
 * НИЧЕГО НЕ УДАЛЯЕТ. Запись остаётся в базе с историей; выборка на рассылку
 * просто перестаёт её брать. Удалить всегда успеем, вернуть — уже нет.
 *
 * Ролевые ящики (info@, office@, director@) НЕ трогаем: для обращения в
 * учреждение это и есть правильный адрес, часто единственный.
 *
 * Запуск:
 *   php scripts/clean_institutions.php            — показать, что будет сделано
 *   php scripts/clean_institutions.php apply      — применить
 *   php scripts/clean_institutions.php dead-doms  — список мёртвых доменов из DNS
 */

declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
require_once BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

/**
 * Опечатки доменов — только те, где замена однозначна.
 *
 * Критерий попадания в список: домен не существует в DNS, и ошибка читается
 * как промах по клавише в имени известного почтовика. Всё, что можно понять
 * двояко («mail.ua», «tut.by» — закрытые сервисы, а не опечатки), сюда не
 * входит: такие адреса просто помечаются непригодными.
 */
const INST_DOMAIN_FIX = [
    // mail.ru
    'mail.ri'    => 'mail.ru',
    'mail.tu'    => 'mail.ru',
    'mail.ry'    => 'mail.ru',
    'mail.uu'    => 'mail.ru',
    'mail.ruu'   => 'mail.ru',
    'mail.ruru'  => 'mail.ru',
    'mail.ru.ru' => 'mail.ru',
    'mal.ru'     => 'mail.ru',
    'maii.ru'    => 'mail.ru',
    'mali.ru'    => 'mail.ru',
    'amil.ru'    => 'mail.ru',
    // yandex.ru
    'yandex.ry'   => 'yandex.ru',
    'yandex.ruhi' => 'yandex.ru',
    'yandexd.ru'  => 'yandex.ru',
    'yanlex.ru'   => 'yandex.ru',
    'jandex.ru'   => 'yandex.ru',
    'yadnex.ru'   => 'yandex.ru',
    // gmail.com — «gmail.ru» это промах по домену верхнего уровня, а не mail.ru
    'gmail.cjm' => 'gmail.com',
    'gmail.ru'  => 'gmail.com',
    'gmail.con' => 'gmail.com',
    'gmail.cim' => 'gmail.com',
    // прочие
    'list.ry'    => 'list.ru',
    'ramrler.ru' => 'rambler.ru',
];

/** Ящики, которые не читает человек. */
const INST_JUNK_LOCAL = [
    'noreply', 'no-reply', 'donotreply', 'do-not-reply',
    'postmaster', 'hostmaster', 'abuse', 'webmaster', 'root', 'www',
];

/** Домен адреса, в нижнем регистре. */
function ic_domain(string $email): string {
    $p = strrpos($email, '@');
    return $p === false ? '' : mb_strtolower(substr($email, $p + 1));
}

/** Имя ящика до собаки, в нижнем регистре. */
function ic_local(string $email): string {
    $p = strrpos($email, '@');
    return $p === false ? '' : mb_strtolower(substr($email, 0, $p));
}

/**
 * Домены без MX и без A — письмо туда не уйдёт.
 *
 * Список готовится отдельно (см. режим dead-doms) и лежит рядом файлом:
 * проверять полторы тысячи доменов на каждом запуске незачем, DNS меняется
 * куда медленнее, чем база.
 */
function ic_dead_domains(): array {
    $f = BASE_PATH . '/data/dead_domains.txt';
    if (!is_file($f)) return [];
    $out = [];
    foreach (file($f, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $L) {
        $L = mb_strtolower(trim($L));
        if ($L !== '' && $L[0] !== '#') $out[$L] = true;
    }
    return $out;
}

/** Собирает план: что починить, что пометить непригодным. */
function ic_plan(): array {
    $dead = ic_dead_domains();
    $fix = [];      // id => новый адрес
    $invalid = [];  // id => причина
    $stat = ['typo' => 0, 'junk' => 0, 'dead' => 0, 'dup' => 0];

    foreach (all("SELECT id, email FROM institutions WHERE email <> '' AND status <> 'invalid'") as $r) {
        $email = trim((string) $r['email']);
        $id    = (int) $r['id'];
        $dom   = ic_domain($email);
        $loc   = ic_local($email);

        if (isset(INST_DOMAIN_FIX[$dom])) {
            $to = $loc . '@' . INST_DOMAIN_FIX[$dom];
            // Исправленный адрес нередко уже есть в базе: одно и то же
            // учреждение попало в сбор дважды, один раз с опечаткой. На email
            // висит уникальный индекс, поэтому такую запись не правим, а
            // гасим — иначе весь проход падает на первой же коллизии.
            if (scalar("SELECT COUNT(*) FROM institutions WHERE LOWER(email) = ? AND id <> ?", [$to, $id])) {
                $invalid[$id] = 'дубль записи с исправленным доменом';
                $stat['dup']++;
            } else {
                $fix[$id] = $to;
                $stat['typo']++;
            }
            continue;
        }
        if (in_array($loc, INST_JUNK_LOCAL, true)) {
            $invalid[$id] = 'служебный ящик';
            $stat['junk']++;
            continue;
        }
        if (isset($dead[$dom])) {
            $invalid[$id] = 'домен без MX и A';
            $stat['dead']++;
        }
    }
    return ['fix' => $fix, 'invalid' => $invalid, 'stat' => $stat];
}

/* ── Запуск ────────────────────────────────────────────────────────────── */

$mode = $argv[1] ?? 'dry';

if ($mode === 'dead-doms') {
    // Печатает домены базы, чтобы их можно было прогнать через dig снаружи.
    foreach (all("SELECT DISTINCT LOWER(SUBSTR(email, INSTR(email,'@')+1)) d
                  FROM institutions WHERE email <> ''") as $r) {
        if ($r['d'] !== '') echo $r['d'], "\n";
    }
    exit(0);
}

$plan = ic_plan();
printf("Опечатка в домене : %d\n", $plan['stat']['typo']);
printf("Служебный ящик    : %d\n", $plan['stat']['junk']);
printf("Мёртвый домен     : %d\n", $plan['stat']['dead']);
printf("Дубль после правки: %d\n", $plan['stat']['dup']);
printf("Всего под правку  : %d\n\n", count($plan['fix']) + count($plan['invalid']));

if ($mode !== 'apply') {
    echo "Это сухой прогон. Примеры замен:\n";
    $i = 0;
    foreach ($plan['fix'] as $id => $to) {
        $was = one("SELECT email FROM institutions WHERE id = ?", [$id]);
        printf("  %-38s → %s\n", $was['email'], $to);
        if (++$i >= 12) break;
    }
    echo "\nПрименить: php scripts/clean_institutions.php apply\n";
    exit(0);
}

$db = db();
$db->beginTransaction();
foreach ($plan['fix'] as $id => $to) {
    q("UPDATE institutions SET email = ?, note = TRIM(COALESCE(note,'') || ' [домен исправлен]'),
              updated_at = datetime('now') WHERE id = ?", [$to, $id]);
}
foreach ($plan['invalid'] as $id => $why) {
    q("UPDATE institutions SET status = 'invalid', note = TRIM(COALESCE(note,'') || ' [' || ? || ']'),
              updated_at = datetime('now') WHERE id = ?", [$why, $id]);
}
$db->commit();

printf("Готово. Исправлено адресов: %d, помечено непригодными: %d\n",
    count($plan['fix']), count($plan['invalid']));
