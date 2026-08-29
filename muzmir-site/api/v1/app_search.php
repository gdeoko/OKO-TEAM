<?php
/**
 * ПОИСК СВОЕЙ ЗАЯВКИ ДЛЯ ЗАКАЗА НАГРАД.
 *
 * Заказать наградной материал можно только по конкретной заявке, и до сих пор
 * гостю предлагалось вписать её номер руками. Номер лежит в письме месячной
 * давности, руководитель коллектива подавал двадцать заявок и не помнит ни одной,
 * а форма на пустое поле отвечала «заказать награды можно только по оценённой
 * заявке» — человек читал это как «нашу работу не оценили» и уходил. Именно на
 * этом застряла Морозова Светлана Викторовна: заявка оценена, лауреат II степени,
 * а заказать награды она не смогла.
 *
 * Теперь заявку можно найти по тому, что человек точно помнит: фамилии участника,
 * названию коллектива, фамилии педагога, учреждению, номеру заявки, названию
 * конкурсного номера или почте, с которой подавали. Фамилия руководителя здесь
 * не роскошь: заявку на коллектив подаёт он, а в поле участника стоит название
 * ансамбля — искать себя по нему человек не догадается.
 *
 * ЧТО ОТДАЁМ. Только то, что и так опубликовано в разделе «Результаты»: номер
 * заявки, участника, конкурс, номинацию, конкурсный номер и звание. Почту
 * показываем закрытой (ива***@mail.ru) — по ней человек узнаёт свою заявку, но
 * чужой адрес из поиска не достанешь.
 *
 * ЧЕГО НЕ ОТДАЁМ: заявки без результата и те, чьи итоги ещё не объявлены. Пока
 * участник не знает своего звания, показывать его в поиске нельзя.
 *
 * GET /api/v1/app_search?q=<строка>[&comp=<id конкурса>]
 * Ответ: {ok:true, items:[{id, number, who, comp, nomination, work, result, email_masked}]}
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

$q = trim((string) input('q'));
if (mb_strlen($q) < 3) json_out(['ok' => true, 'items' => [], 'reason' => 'short']);

// Перебор чужих фамилий пачками — не то, ради чего это сделано.
if (function_exists('rate_ok') && !rate_ok('appsearch:' . client_ip(), 40, 60)) {
    json_out(['ok' => true, 'items' => [], 'reason' => 'rate']);
}

$compId = (int) input('comp', '0');
$like   = '%' . mb_strtolower($q) . '%';

/* Номер участник переписывает из письма и путает: строчные буквы, пробелы,
 * «№» впереди, тире вместо дефиса. Ищем и по очищенному виду тоже. */
$clean = mb_strtoupper(preg_replace('~[^\p{L}\p{N}]+~u', '', $q) ?? '');

$sql = "SELECT a.id, a.number, a.full_name, a.group_name, a.nomination, a.work_title,
               a.result, a.email, a.teacher, a.institution, c.name AS comp_name, c.id AS comp_id,
               c.results_mode, c.results_published_at, a.result_sent_at
          FROM applications a JOIN competitions c ON c.id = a.competition_id
         WHERE a.status <> 'rejected' AND COALESCE(a.result,'') <> ''
           AND ( mb_lower(COALESCE(a.full_name,''))   LIKE ?
              OR mb_lower(COALESCE(a.group_name,''))  LIKE ?
              OR mb_lower(COALESCE(a.work_title,''))  LIKE ?
              OR mb_lower(COALESCE(a.teacher,''))     LIKE ?
              OR mb_lower(COALESCE(a.institution,'')) LIKE ?
              OR mb_lower(COALESCE(a.email,''))       LIKE ?
              OR UPPER(REPLACE(REPLACE(a.number,'-',''),' ','')) = ?
              OR mb_lower(a.number) LIKE ? )";
$args = [$like, $like, $like, $like, $like, $like, $clean, $like];
if ($compId > 0) { $sql .= " AND c.id = ?"; $args[] = $compId; }
$sql .= " ORDER BY a.id DESC LIMIT 25";

try { $rows = all($sql, $args); } catch (\Throwable $e) { $rows = []; }

/** ива***@mail.ru — узнать свой адрес можно, чужой не выпишешь. */
$mask = static function (string $mail): string {
    $mail = trim($mail);
    $at = mb_strpos($mail, '@');
    if ($at === false || $at < 1) return '';
    $name = mb_substr($mail, 0, $at);
    $keep = mb_substr($name, 0, min(3, mb_strlen($name)));
    return $keep . str_repeat('*', max(2, mb_strlen($name) - mb_strlen($keep))) . mb_substr($mail, $at);
};

$items = [];
foreach ($rows as $r) {
    // Итоги должны быть объявлены: длинный конкурс — публикацией, короткий — письмом.
    $delivered = (string) ($r['results_mode'] ?? '') === 'list'
        ? trim((string) ($r['results_published_at'] ?? '')) !== ''
        : trim((string) ($r['result_sent_at'] ?? '')) !== '';
    if (!$delivered) continue;

    $who = trim((string) ($r['group_name'] ?? '')) !== ''
        ? (string) $r['group_name']
        : (string) ($r['full_name'] ?? '');
    $items[] = [
        'id'         => (int) $r['id'],
        'number'     => (string) $r['number'],
        'who'        => $who,
        'comp'       => (string) $r['comp_name'],
        'comp_id'    => (int) $r['comp_id'],
        'nomination' => (string) ($r['nomination'] ?? ''),
        'work'       => (string) ($r['work_title'] ?? ''),
        'result'     => (string) ($r['result'] ?? ''),
        'teacher'    => (string) ($r['teacher'] ?? ''),
        'email'      => $mask((string) ($r['email'] ?? '')),
    ];
}

json_out(['ok' => true, 'items' => $items]);
