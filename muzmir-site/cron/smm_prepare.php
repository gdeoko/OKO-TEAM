<?php
/**
 * cron/smm_prepare.php — набивает очередь постов на ближайшие дни.
 *
 * ПОЧЕМУ ЗАРАНЕЕ, А НЕ В МОМЕНТ ПУБЛИКАЦИИ. Картинка генерируется несколько
 * минут, модель иногда отвечает отказом по квоте, тема с первой попытки часто
 * повторяет вышедшую. Если собирать пост в 10:00 ради публикации в 10:00, то
 * первый же отказ оставляет день пустым — а владелец просил, чтобы публиковалось
 * без пропусков. Поэтому конвейер смотрит на три дня вперёд и держит очередь
 * заполненной: к моменту публикации пост уже лежит готовый, с картинкой.
 *
 * Запуск: раз в час. php cron/smm_prepare.php [--days=3] [--limit=2]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/smm_make.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'smm_prepare';

$opts  = getopt('', ['days::', 'limit::', 'dry']);
$days  = isset($opts['days'])  ? max(0, (int) $opts['days'])  : 3;
$limit = isset($opts['limit']) ? max(1, (int) $opts['limit']) : 2;
$dry   = isset($opts['dry']);

/* Полчаса, не час: подготовка трёх постов укладывается в пятнадцать минут, а
   замок с часовым сроком после упавшего процесса держит конвейер мёртвым до
   следующего часа и съедает слот. */
if (!cron_lock(JOB, 1800)) { cron_log(JOB, 'предыдущий запуск ещё идёт — выход'); exit(0); }

try {
    if ((int) setting('smm_enabled', '0') !== 1) {
        cron_log(JOB, 'конвейер выключен (smm_enabled=0) — выход');
        cron_unlock(JOB); exit(0);
    }

    smm_migrate();

    /* МЕСТО ПОД ПОВОД ОСВОБОЖДАЕМ ДО НАБОРА СЛОТОВ, А НЕ ПОСЛЕ.
     *
     * Слот в базе уникален, и забитый советами день с поводом не оставляет
     * афише ни одной щели. Освободить его надо раньше, чем smm_pending_slots
     * пересчитает свободные слоты, иначе афиша встанет в очередь только через
     * час, а при близком поводе этого часа может не быть. */
    foreach (smm_osvobodit_pod_povod() as $шаг) cron_log(JOB, $шаг);

    $slots = smm_pending_slots($days);
    if (!$slots) { cron_log(JOB, 'очередь заполнена, свободных слотов нет'); cron_unlock(JOB); exit(0); }

    $done = 0;
    foreach ($slots as $slot) {
        if ($done >= $limit) break;

        $date  = $slot['date'];
        $hour  = $slot['hour'];
        /* ВОЗРАСТ ВЫБИРАЕТСЯ ПЕРВЫМ, И РОЛЬ ПОДЧИНЯЕТСЯ ЕМУ (правка владельца
           13.10.2026). Два поста одного дня - из разных половин: один детский
           или подростковый, другой взрослый или старшего поколения. */
        /* ВИД ПОСТА ВЫБИРАЕТСЯ ПЕРВЫМ: афиша привязана к дате и отменить её
           нельзя, а совет и история подстраиваются. */
        $кв     = smm_pick_kind($date, $hour);
        $вид    = (string) $кв['вид'];
        $повод  = (array) $кв['повод'];
        $сюжет  = (string) ($кв['подвид'] ?? '');

        /* ДАТА АФИШИ СВЕРЯЕТСЯ ДО ВСЯКОЙ ТРАТЫ. Календарь собран руками, а
           поздравление не с тем числом - публичная ошибка центра. Не сошлось
           или мозг молчит - слот спокойно забирает обычный пост. */
        if ($вид === 'афиша') {
            $св = smm_kal_проверить($повод);
            if (empty($св['ок'])) {
                cron_log(JOB, '  афиша «' . smm_kal_строка($повод) . '» отменена: '
                    /* ПРИЧИНУ ПИШЕМ НАСТОЯЩУЮ. Здесь на любое «молчит» стояла
                       одна строка «мозг молчит, дату не сверить», и под ней
                       прятались два разных случая: мозг правда не ответил и
                       заслон не стал переспрашивать (отдых четыре часа, правило
                       52). В ночь на 15.10 по журналу было не различить, и час
                       ушёл на поиск там, где причина названа в самой мерке. */
                    . (!empty($св['молчит'])
                        ? ((string) ($св['почему'] ?? '') !== ''
                            ? (string) $св['почему'] : 'мозг молчит, дату не сверить')
                        : (string) $св['почему']));
                /* ВИД ПОСЛЕ ОТМЕНЫ АФИШИ СЧИТАЕТ ТОТ ЖЕ ИСТОЧНИК, а не строка
                   «совет» на месте: с 19.10.2026 утренний слот принадлежит
                   истории, и жёсткое «совет» подменило бы правило владельца
                   молча - ровно в том случае, когда афиша сорвалась. */
                $квОтмена = smm_vid_po_slotu($date, $hour);
                $вид   = (string) $квОтмена['вид'];
                $сюжет = (string) ($квОтмена['подвид'] ?? '');
                $повод = [];
            }
        }

        $age   = smm_pick_age($date, $hour);
        $layer = smm_pick_layer($date, $hour, $age);
        $stage = smm_pick_stage($hour);
        $ratio = smm_pick_ratio();

        /* ОСИ ТЕМЫ (правка владельца 19.10.2026): направление центра у совета и
           у истории, сторона - только у совета. У афиши своей темы нет вовсе:
           её задаёт повод календаря. */
        $напр    = $вид === 'афиша' ? '' : smm_pick_os('napravlenie', SMM_NAPRAVLENIYA, $date, $hour);
        $сторона = $вид === 'совет' ? smm_pick_os('storona', SMM_SOVET_STORONY, $date, $hour, 0, 5) : '';

        cron_log(JOB, "готовлю {$date} {$hour}:00 — {$вид}"
                    . ($сюжет !== '' ? (' · ' . $сюжет) : '')
                    . ($повод ? (' («' . smm_kal_строка($повод) . '»)') : '')
                    . ($напр !== '' ? (' · ' . $напр) : '')
                    . ($сторона !== '' ? (' · ' . $сторона) : '')
                    . ", возраст {$age}, слой {$layer}, ступень {$stage}, формат {$ratio}");

        $topic = smm_make_topic($layer, $stage, $age, 6, $вид, $повод, $сюжет, $напр, $сторона);
        if (!$topic) {
            $why = array_slice((array) ($GLOBALS['SMM_TOPIC_REJECTS'] ?? []), 0, 6);
            cron_log(JOB, '  тема не нашлась, причины по заходам: '
                . ($why ? implode(' | ', $why) : 'не записаны') . ' — пропуск');
            continue;
        }

        $body = smm_make_body($topic, $layer, $stage, '', $age, $вид, $повод, $сюжет);
        if (!$body) { cron_log(JOB, "  текст не собрался — пропуск"); continue; }

        $full = smm_compose($body);
        $err  = smm_validate($body, $full, $вид);
        if ($err) {
            /* Одна попытка переписать: модель часто промахивается по длине, и это
               чинится повтором, а не ручной правкой. */
            cron_log(JOB, '  текст не прошёл проверку: ' . implode('; ', $err) . ' — переписываю');

            /* Три захода, и каждому говорится, чем плох предыдущий. Без этого
               модель повторяет ту же ошибку слово в слово: на требование длины
               она устойчиво отдаёт 1100–1300 знаков, пока ей прямо не скажешь,
               что вышло коротко и насколько. */
            /* Перелёт по длине чиним сокращением, а не переписыванием: на просьбу
               написать заново модель сочиняет новый текст и снова мажет мимо. */
            $tooLong = (bool) preg_grep('~длинн~u', $err);
            if ($tooLong) {
                $short = smm_shrink($body, SMM_BODY_MAX);
                if ($short !== null) {
                    $body = $short;
                    $full = smm_compose($body);
                    $err  = smm_validate($body, $full, $вид);
                    cron_log(JOB, '  сокращено до ' . mb_strlen($body, 'UTF-8') . ' знаков');
                }
            }

            for ($try = 0; $try < 3 && $err; $try++) {
                $retry = smm_make_body($topic, $layer, $stage, implode('; ', $err), $age, $вид, $повод, $сюжет);
                if (!$retry) continue;
                $body = $retry;
                $full = smm_compose($body);
                $err  = smm_validate($body, $full, $вид);
            }
            if ($err) { cron_log(JOB, '  текст так и не прошёл: ' . implode('; ', $err) . ' — пропуск'); continue; }
        }

        /* Текст написан и прошёл правила центра — теперь проверяем, не дописала ли
           модель собственных «исследований» поверх проверенного факта. */
        $factProblems = smm_text_fact_check($body);
        if ($factProblems) {
            cron_log(JOB, '  в тексте сомнительные факты: ' . implode('; ', array_slice($factProblems, 0, 2)) . ' — переписываю');
            $hint = 'в тексте недостоверные утверждения: ' . implode('; ', $factProblems)
                  . '. Убери их совсем или замени на проверяемые. Не выдумывай замену.';
            /* Две попытки, и длина по пути чинится сокращением: одного захода мало,
               а бросать тему из-за одной неудачной формулировки расточительно —
               слот тогда остаётся пустым. */
            $fixed = false;
            for ($t = 0; $t < 2 && !$fixed; $t++) {
                $retry = smm_make_body($topic, $layer, $stage, $hint, $age, $вид, $повод, $сюжет);
                if (!$retry) continue;

                if (mb_strlen($retry, 'UTF-8') > SMM_BODY_MAX) {
                    $short = smm_shrink($retry, SMM_BODY_MAX);
                    if ($short !== null) $retry = $short;
                }
                $full2 = smm_compose($retry);
                if (!smm_validate($retry, $full2, $вид) && !smm_text_fact_check($retry)) {
                    $body = $retry; $full = $full2; $fixed = true;
                }
            }
            if (!$fixed) { cron_log(JOB, '  текст не удалось очистить от выдумок — пропуск'); continue; }
        }

        if ($dry) {
            cron_log(JOB, "  [сухой прогон] тема: {$topic['topic']}, тело " . mb_strlen($body, 'UTF-8') . ' знаков');
            $done++;
            continue;
        }

        /* ПОРТРЕТ ИЩЕМ ОДИН РАЗ И ТОЛЬКО ТАМ, ГДЕ ПОСТ О ЧЕЛОВЕКЕ. Нет
           свободного портрета - это не беда: кадр соберётся без лица. */
        $персона = trim((string) ($topic['person'] ?? ''));
        $портрет = '';
        if ($персона !== '') {
            $п = smm_portret(trim((string) ($topic['wiki'] ?? '')) ?: $персона);
            if (!empty($п['url'])) {
                $портрет = (string) $п['url'];
                cron_log(JOB, '  портрет: ' . $персона . ' — ' . (string) $п['лицензия']);
            } else {
                cron_log(JOB, '  портрета нет (' . (string) ($п['нет'] ?? '?') . '), кадр без лица');
            }
        }

        $id = insert('smm_posts', [
            'slot_date' => $date,
            'slot_hour' => $hour,
            'status'    => 'draft',
            'topic'     => (string) $topic['topic'],
            'topic_key' => smm_key((string) $topic['topic']),
            'fact'      => (string) ($topic['fact'] ?? ''),
            'fact_key'  => smm_key((string) ($topic['fact'] ?? '')),
            'source'    => (string) ($topic['source'] ?? ''),
            'layer'     => $layer,
            'age_group' => $age,
            'kind'      => $вид,
            'napravlenie' => $напр,
            'storona'     => $сторона,
            'povod'     => $повод ? smm_kal_строка($повод) : '',
            'person'    => $персона,
            'portret'   => $портрет,
            'stage'     => $stage,
            'ratio'     => $ratio,
            'title'     => (string) ($topic['title'] ?? ''),
            'subtitle'  => (string) ($topic['subtitle'] ?? ''),
            'body'      => $body,
            'text_full' => $full,
        ]);

        /* Картинка — последней: она платная, и тратиться имеет смысл только на
           пост, который уже прошёл все проверки текста. */
        /* Заголовок и подзаголовок уходят в ту же генерацию: они часть кадра,
           а не подпись поверх него. */
        $prompt = smm_make_image_prompt(
            $topic, $ratio,
            (string) ($topic['title'] ?? ''),
            (string) ($topic['subtitle'] ?? ''),
            $age,
            $date . '_' . $hour,
            $портрет !== '' ? $персона : '',
            $вид,
            $сюжет ?? '',
            $персона          // герой рассказа и без портрета: эпоха берётся у него
        );
        if (!$prompt && (string) ($GLOBALS['SMM_KA_ALARM'] ?? '') !== '') {
            cron_log(JOB, '  плакат не собрался: ' . (string) $GLOBALS['SMM_KA_ALARM']);
        }
        $ka = (array) ($GLOBALS['SMM_KA_LAST'] ?? []);
        if ($ka) {
            cron_log(JOB, '  плакат: ' . ($ka['монтаж'] ?? '') . ' / ' . ($ka['типографика'] ?? '')
                        . ' / ' . ($ka['цвет'] ?? '') . ' / ' . ($ka['приём'] ?? '')
                        . ', промпт ' . (int) ($ka['знаков'] ?? 0)
                        . ' знаков' . ((string) ($ka['вне_коридора'] ?? '') !== ''
                            ? (' — ВНЕ КОРИДОРА: ' . $ka['вне_коридора']) : ''));
            update('smm_posts', ['keyart' => trim(($ka['монтаж'] ?? '') . ' / '
                . ($ka['типографика'] ?? '') . ' / ' . ($ka['цвет'] ?? '')
                . ' / ' . ($ka['приём'] ?? ''))], 'id=:id', ['id' => $id]);
        }
        $imgOk  = false;
        if ($prompt) {
            // Имя по НОМЕРУ поста: слот переносится, и имя по слоту затирало
            // картинку чужого поста (см. smm_image_path).
            $path = smm_image_path($id);
            [$imgOk, $imgErr, $cost] = smm_make_image($prompt, $ratio, $path, $портрет);
            update('smm_posts', [
                'image_prompt' => $prompt,
                'image_path'   => $imgOk ? $path : '',
                'image_cost'   => $imgOk ? $cost : 0,
                'error'        => $imgOk ? '' : (string) $imgErr,
            ], 'id=:id', ['id' => $id]);
            if (!$imgOk) cron_log(JOB, "  картинка не вышла: {$imgErr}");
        }

        /* Пост без картинки в очередь не ставим: текстовая простыня без
           изображения в ленте проигрывает и читается как объявление. Он остаётся
           черновиком, виден в админке, и его можно доснять руками. */
        update('smm_posts', ['status' => $imgOk ? 'ready' : 'draft'], 'id=:id', ['id' => $id]);

        cron_log(JOB, "  готово: {$topic['topic']}" . ($imgOk ? '' : ' (без картинки, остаётся черновиком)'));
        $done++;
    }

    cron_log(JOB, "подготовлено постов: {$done}");
} catch (\Throwable $e) {
    cron_log(JOB, 'сбой: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
