<?php
/**
 * cron/smm_perepisat.php — ПЕРЕПИСАТЬ УЖЕ ГОТОВУЮ ОЧЕРЕДЬ ПОД НОВЫЙ ПОРЯДОК ТЕМ.
 *
 * Слово владельца 15.10.2026: «Переписать и тексты восьми постов очереди под
 * новый порядок». Порядок задан правилом 70б: совет и история через один, у
 * истории три сюжета по кругу (человек, прошлое музыки, сегодняшний день).
 *
 * ПОЧЕМУ НА МЕСТЕ, А НЕ «УДАЛИТЬ И ДАТЬ ПОДГОТОВКЕ ПЕРЕСОБРАТЬ».
 * `smm_pending_slots()` смотрит ТОЛЬКО ВПЕРЁД от сегодняшнего дня, а очередь
 * центра отстаёт на двое суток: четыре поста из восьми стоят на прошедших
 * слотах. Удали их - и подготовка эти слоты не заполнит НИКОГДА, лента разом
 * потеряет два дня, а завтра в 10:00 может оказаться нечего публиковать.
 * Поэтому строка заменяется ОДНИМ `update` и только после того, как новый
 * текст прошёл все проверки и кадр собрался. Мозг молчит или упёрся в квоту -
 * пост остаётся прежним, и в ленту уходит он: пустого слота не бывает.
 *
 * ОПУБЛИКОВАННОЕ НЕ ТРОГАЕМ НИКОГДА: пост уже у людей, переписать его значит
 * переписать историю (тот же запрет, что у переноса слотов, правило 43).
 *
 * ПОЧЕМУ СПИСОК ЛЕЖИТ В НАСТРОЙКАХ. Доводчик кадров (`smm_keyart_refresh`)
 * берёт посты без `keyart` и платит $0.04 за кадр. Пока пост ждёт
 * переписывания, его кадр не нужен вовсе: новый текст придёт со своим кадром.
 * Список `smm_perepisat_ochered` - это и очередь работы, и знак доводчику
 * «сюда не ходи»; иначе за один вечер мы заплатили бы за кадры дважды.
 *
 * Правила текста, проверки и сборка кадра НЕ дублируются: зовутся те же
 * функции, что и у подготовки (`smm_make_topic`, `smm_make_body`,
 * `smm_validate`, `smm_make_image_prompt`, `smm_make_image`).
 *
 * Запуск: php cron/smm_perepisat.php [--сколько=1] [--сухой]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/smm_make.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'smm_perepisat';

$сколько = 1;
$сухой   = false;
foreach ($argv as $a) {
    if (preg_match('~^--сколько=(\d+)$~u', $a, $m)) $сколько = max(1, (int) $m[1]);
    if ($a === '--сухой') $сухой = true;
}

if (!cron_lock(JOB, 3600)) { cron_log(JOB, 'предыдущий запуск ещё идёт — выход'); exit(0); }

try {
    if ((int) setting('smm_enabled', '0') !== 1) { cron_unlock(JOB); exit(0); }

    /* НЕ РАНЬШЕ НАЗНАЧЕННОГО ЧАСА. Слово владельца 15.10.2026: «начнём после
       полуночи, когда обнулится норма мозга». Крон стоит ежечасно, и без этой
       проверки первый же заход сегодня вечером сжёг бы остаток дневной нормы
       на полпоста. Дата лежит настройкой, а не вписана в код: перенести начало
       это одна строка в базе. */
    $неРанее = trim((string) setting('smm_perepisat_ne_ranee', ''));
    if ($неРанее !== '' && time() < (int) strtotime($неРанее)) { cron_unlock(JOB); exit(0); }

    $список = json_decode((string) setting('smm_perepisat_ochered', '[]'), true);
    if (!is_array($список) || !$список) { cron_unlock(JOB); exit(0); }   // зелёное молчит

    smm_migrate();
    $сделано = 0;

    foreach (array_values($список) as $id) {
        if ($сделано >= $сколько) break;
        $id = (int) $id;
        $p  = one("SELECT * FROM smm_posts WHERE id = ?", [$id]);

        /* Поста нет, он уже вышел или снят человеком - просто выбывает из
           списка: это не беда и не повод останавливать работу. */
        if (!$p || (string) $p['status'] === 'published' || trim((string) ($p['error'] ?? '')) !== ''
            || (string) ($p['kind'] ?? '') === 'афиша') {
            $список = array_values(array_diff($список, [$id]));
            set_setting('smm_perepisat_ochered', (string) json_encode($список));
            cron_log(JOB, "#{$id} пропущен (опубликован, снят или афиша) — выбыл из списка");
            continue;
        }

        $date  = (string) $p['slot_date'];
        $hour  = (int) $p['slot_hour'];
        $age   = (string) ($p['age_group'] ?? '');
        $layer = (string) ($p['layer'] ?? '');
        $stage = (int) ($p['stage'] ?? 1);
        $ratio = (string) ($p['ratio'] ?? '1:1');

        /* Вид считает ОДИН источник на весь конвейер - `smm_vid_po_slotu()`,
           и считает он по соседям ЭТОГО слота, а не по самым свежим записям:
           переписываем мы прошлые слоты, и «последний заведённый пост» для них
           не сосед вовсе. Себя из счёта исключаем, иначе пост спорит сам с
           собой. */
        $кв    = smm_vid_po_slotu($date, $hour, $id);
        $вид   = (string) $кв['вид'];
        $сюжет = (string) ($кв['подвид'] ?? '');

        cron_log(JOB, "переписываю #{$id} {$date} {$hour}:00 — было «"
            . mb_substr((string) $p['topic'], 0, 60) . "», станет {$вид}"
            . ($сюжет !== '' ? (' · ' . $сюжет) : ''));

        /* ОСИ ТЕМЫ те же, что у подготовки, и с тем же исключением себя из
           памяти: иначе пост видит свою же ось соседом и не меняется никогда. */
        $напр    = smm_pick_os('napravlenie', SMM_NAPRAVLENIYA, $date, $hour, $id);
        $сторона = $вид === 'совет' ? smm_pick_os('storona', SMM_SOVET_STORONY, $date, $hour, $id, 5) : '';

        $topic = smm_make_topic($layer, $stage, $age, 6, $вид, [], $сюжет, $напр, $сторона);
        if (!$topic) {
            $why = array_slice((array) ($GLOBALS['SMM_TOPIC_REJECTS'] ?? []), 0, 4);
            cron_log(JOB, '  тема не нашлась: ' . ($why ? implode(' | ', $why) : 'не записаны')
                . ' — пост оставлен прежним, вернусь позже');
            break;   // мозг молчит: следующий пост тем более не выйдет
        }

        $body = smm_make_body($topic, $layer, $stage, '', $age, $вид, [], $сюжет);
        if (!$body) { cron_log(JOB, '  текст не собрался — пост оставлен прежним'); break; }

        $full = smm_compose($body);
        $err  = smm_validate($body, $full, $вид);
        for ($try = 0; $try < 3 && $err; $try++) {
            $retry = smm_make_body($topic, $layer, $stage, implode('; ', $err), $age, $вид, [], $сюжет);
            if (!$retry) break;
            $body = $retry;
            $full = smm_compose($body);
            $err  = smm_validate($body, $full, $вид);
        }
        if ($err) {
            cron_log(JOB, '  текст не прошёл проверку (' . implode('; ', $err)
                . ') — пост оставлен прежним');
            continue;
        }

        if ($сухой) {
            cron_log(JOB, "  [сухой] тема: {$topic['topic']}, тело " . mb_strlen($body, 'UTF-8') . ' знаков');
            $сделано++;
            continue;
        }

        /* Портрет ищем только там, где пост о человеке: у истории про премьеру
           или инструмент героя-человека нет вовсе (правило 70б). */
        $персона = trim((string) ($topic['person'] ?? ''));
        $портрет = '';
        if ($персона !== '') {
            $пп = smm_portret(trim((string) ($topic['wiki'] ?? '')) ?: $персона);
            $портрет = (string) ($пп['url'] ?? '');
            cron_log(JOB, '  портрет: ' . $персона . ' — '
                . ($портрет !== '' ? (string) $пп['лицензия'] : ('нет (' . (string) ($пп['нет'] ?? '?') . ')')));
        }

        $prompt = smm_make_image_prompt(
            $topic, $ratio,
            (string) ($topic['title'] ?? ''),
            (string) ($topic['subtitle'] ?? ''),
            $age, $date . '_' . $hour,
            $портрет !== '' ? $персона : '',
            $вид,
            $сюжет,
            $персона          // герой рассказа и без портрета: эпоха берётся у него
        );
        if (!$prompt) {
            cron_log(JOB, '  плакат не собрался: '
                . ((string) ($GLOBALS['SMM_KA_ALARM'] ?? 'мозг молчит'))
                . ' — пост оставлен прежним');
            break;
        }
        $ka  = (array) ($GLOBALS['SMM_KA_LAST'] ?? []);
        $оси = trim(($ka['монтаж'] ?? '') . ' / ' . ($ka['типографика'] ?? '') . ' / '
             . ($ka['цвет'] ?? '') . ' / ' . ($ka['приём'] ?? ''));

        /* Картинка пишется в СВОЙ файл поста (номер не меняется никогда,
           правило 57), и только после удачи заменяется строка. */
        $path = smm_image_path($id);
        [$ok, $imgErr, $cost] = smm_make_image($prompt, $ratio, $path, $портрет);
        if (!$ok) {
            cron_log(JOB, "  картинка не вышла: {$imgErr} — пост оставлен прежним");
            break;
        }

        update('smm_posts', [
            'topic'        => (string) $topic['topic'],
            'topic_key'    => smm_key((string) $topic['topic']),
            'fact'         => (string) ($topic['fact'] ?? ''),
            'fact_key'     => smm_key((string) ($topic['fact'] ?? '')),
            'source'       => (string) ($topic['source'] ?? ''),
            'kind'         => $вид,
            'napravlenie'  => $напр,
            'storona'      => $сторона,
            'person'       => $персона,
            'portret'      => $портрет,
            'title'        => (string) ($topic['title'] ?? ''),
            'subtitle'     => (string) ($topic['subtitle'] ?? ''),
            'body'         => $body,
            'text_full'    => $full,
            'keyart'       => $оси,
            'image_prompt' => $prompt,
            'image_path'   => $path,
            'image_cost'   => $cost,
            'status'       => 'ready',
            'error'        => '',
        ], 'id=:id', ['id' => $id]);

        $список = array_values(array_diff($список, [$id]));
        set_setting('smm_perepisat_ochered', (string) json_encode($список));

        cron_log(JOB, "  готово #{$id}: {$вид}"
            . ($сюжет !== '' ? (' · ' . $сюжет) : '')
            . " — «{$topic['topic']}», плакат {$оси}");
        $сделано++;
    }

    if ($сделано) cron_log(JOB, "переписано постов: {$сделано}, осталось в списке: " . count($список));
} catch (\Throwable $e) {
    cron_log(JOB, 'сбой: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
