<?php
/**
 * СРОКИ ОТПРАВКИ НАГРАДНЫХ МАТЕРИАЛОВ: ПРОВЕРКА И ВОССТАНОВЛЕНИЕ.
 *
 *   php scripts/diploma_sched_fix.php            — показать, ничего не меняя
 *   php scripts/diploma_sched_fix.php --apply    — проставить правильные сроки
 *   php scripts/diploma_sched_fix.php --apply --hold=2026-09-08 09:00
 *                                                — проставить, но не раньше даты
 *
 * Зачем. Срок выдачи наградных документов — пять рабочих дней (участникам клуба
 * три, участникам от партнёрского учреждения четыре), и считается он тем же
 * кодом, что и при обычной выдаче: cron/send_diplomas::_plan_send_at(). Но у
 * части дипломов в поле срока стояла дата 2027-01-01 — заглушка, поставленная
 * руками, чтобы придержать отправку. В админке и в кабинете это читается как
 * «награда придёт через год».
 *
 * Скрипт пересчитывает срок по правилу и, по желанию, не даёт ему оказаться
 * раньше указанного момента: так можно вернуть верные даты, не выбросив разом
 * сотню писем.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/send_timing.php';
if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';

$opt = [];
foreach (array_slice($argv, 1) as $arg)
    if (preg_match('~^--([a-z-]+)(?:=(.*))?$~', $arg, $m)) $opt[$m[1]] = $m[2] ?? '1';
$apply = isset($opt['apply']);
$hold  = trim((string) ($opt['hold'] ?? ''));
$holdTs = $hold !== '' ? (strtotime($hold) ?: 0) : 0;

/**
 * СРОК СЧИТАЕТСЯ ОТ ДАТЫ ЗАКАЗА, А НЕ ОТ ОЦЕНКИ ЗАЯВКИ.
 *
 * Правило владельца: наградной материал приходит в течение пяти рабочих дней
 * СО ДНЯ ЗАКАЗА (участникам клуба три; у учреждения-партнёра срок ОБЩИЙ -
 * слово владельца 16.10.2026, его четвёрка только на аттестацию).
 * Здесь база бралась от результата — и дозаказ, оплаченный 4 сентября,
 * оказывался «просрочен» и уходил 5-го, на четыре дня раньше обещанного.
 *
 * Точка отсчёта у обоих путей одна и та же — момент, когда обязательство
 * возникло, и он записан в самой строке наградного документа:
 *   • дозаказ электронных наград — строка заводится при оплате заказа
 *     (core/orders.php::order_digital_fulfil), created_at = оплата;
 *   • основной и дополнительный по оргвзносу — строка заводится при выдаче
 *     результата, created_at = результат.
 * Поэтому считаем от created_at документа, а не от полей заявки.
 */
function dsf_plan(array $a): DateTime {
    $base = trim((string) ($a['dcreated'] ?? '')) !== '' ? (string) $a['dcreated']
          : (trim((string) ($a['result_send_at'] ?? '')) !== '' ? (string) $a['result_send_at']
          : (trim((string) ($a['graded_at'] ?? '')) !== '' ? (string) $a['graded_at']
          : (string) ($a['created_at'] ?? 'now')));
    /* СРОК БЕРЁТ ЕДИНЫЙ ИСТОЧНИК, А НЕ СВОЯ КОПИЯ ЛЕСТНИЦЫ.
     *
     * Здесь стоял свой счёт: 5, клубу 3, партнёру его `partner_priority_days`
     * (4). Со словом владельца 16.10.2026 партнёрская четвёрка касается ТОЛЬКО
     * аттестационного результата, а изготовление наградного материала у него
     * общее, 5 рабочих дней. Копия условий расходится молча, поэтому счёт
     * спрашивается у `prioritet_zayavki()` - того же, что считает срок в
     * `cron/send_diplomas.php` и в `core/orders.php` (правила 33, 35, 45, 47). */
    require_once BASE_PATH . '/core/prioritet.php';
    $wDays = (int) prioritet_zayavki($a)['дней_изготовление'];
    if ($wDays <= 0) $wDays = PRIORITET_SROK_OBSHIY;
    $planned = working_days_add($base, $wDays);
    $soonest = next_working_slot(new DateTime('now'));
    return $planned > $soonest ? $planned : $soonest;
}

/* ПОЛЯ ДИПЛОМА — ПОД СВОИМИ ИМЕНАМИ.
 *
 * Здесь стояло «SELECT d.id, …, a.*»: звёздочка заявки шла последней и своим
 * полем id затирала id диплома. Обновление уходило по номеру ЗАЯВКИ, то есть в
 * чужие строки, а отчёт при этом бодро печатал 82 исправленных срока. Ошибка
 * тихая: совпали всего четыре номера, и два из них — у уже выданных документов.
 * Поэтому поля диплома берём под отдельными именами и никогда не смешиваем. */
$rows = all("SELECT d.id AS did, d.number AS dnum, d.type AS dtype, d.scheduled_at AS dsched,
                    d.created_at AS dcreated, a.*
             FROM diplomas d JOIN applications a ON a.id = d.application_id
             WHERE COALESCE(d.sent_at,'') = '' ORDER BY d.id");

printf("Наградных материалов без отправки: %d%s\n\n", count($rows), $apply ? '' : ' (только показ)');
if ($holdTs) printf("Не раньше: %s\n\n", date('Y-m-d H:i', $holdTs));

$byDay = []; $changed = 0;
foreach ($rows as $r) {
    $plan = dsf_plan((array) $r);
    $ts   = $plan->getTimestamp();
    if ($holdTs && $ts < $holdTs) $ts = $holdTs;
    $new  = date('Y-m-d H:i:s', $ts);
    $old  = (string) ($r['dsched'] ?? '');
    $byDay[substr($new, 0, 10)] = ($byDay[substr($new, 0, 10)] ?? 0) + 1;
    if ($old === $new) continue;
    $changed++;
    if (count($byDay) <= 40 && $changed <= 12)
        printf("  #%-5s %-20s %-7s  было %-19s станет %s\n",
               $r['did'], (string) $r['dnum'], (string) $r['dtype'], $old ?: '—', $new);
    if ($apply) update('diplomas', ['scheduled_at' => $new], 'id=:id', ['id' => (int) $r['did']]);
}
printf("\nК изменению: %d\n\nРаспределение по дням:\n", $changed);
ksort($byDay);
foreach ($byDay as $d => $n) printf("  %-12s %d\n", $d, $n);
echo $apply ? "\nСроки проставлены.\n" : "\n(ничего не изменено — нужен ключ --apply)\n";
