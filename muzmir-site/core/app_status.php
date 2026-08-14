<?php
/**
 * ЕДИНАЯ система статусов заявки (Даниэль, август 2026).
 *
 * Проблема, которую это решает: статус хранился в applications.status и разъезжался
 * с фактами — крон ставил 'done', админка знала 'graded'/'sent', кабинет не знал ни
 * 'done', ни 'submitted'. Из-за этого заявка «пропадала» из фильтров и статистики,
 * а участник видел «Оценена» раньше, чем письмо реально уходило.
 *
 * Решение: статус ВЫЧИСЛЯЕТСЯ из фактов, которые уже есть в базе:
 *   applications.result / result_send_at / result_sent_at  — оценка и её отправка;
 *   diplomas.scheduled_at / sent_at                        — наградные документы;
 *   awards_orders                                          — дополнительные заказы;
 *   applications.is_paid                                   — оплата участия.
 *
 * Лестница статусов:
 *   new       Новая           заявка подана (для платного — ждёт оплаты/принята)
 *   judging   На оценке       результат проставлен, письмо участнику ЕЩЁ НЕ ушло
 *   graded    Оценена         письмо с результатом ПОСТУПИЛО участнику
 *   making    На изготовлении дипломы созданы и запланированы, ещё не отправлены
 *   made      Изготовлена     дипломы ПОСТУПИЛИ участнику на почту
 *   extra     Доп. заказ      есть дополнительный заказ в работе
 *   done      Исполнена       результат, награды и все доп. заказы выполнены
 *   rejected  Отклонена
 *
 * ВАЖНО про участника: он видит ровно то, что реально дошло до его почты.
 * Признак «дошло» — result_sent_at / diplomas.sent_at, а не факт оценки.
 */
declare(strict_types=1);

/** Порядок лестницы (для прогресс-баров и сортировок). */
function app_state_pipeline(): array {
    return ['new', 'judging', 'graded', 'making', 'made', 'done'];
}

/**
 * ТО ЖЕ ВЫЧИСЛЕНИЕ СТАТУСА, НО НА SQL.
 *
 * Бейдж в списке заявок строился функцией app_state() (по фактам), а фильтр «Статус»
 * в той же таблице — по хранимой колонке applications.status. Два разных источника,
 * которые ничем не синхронизировались: админ видел «Оценена», выбирал в фильтре
 * «Оценена» и получал пустой список. Тем же расхождением болел пончик на дашборде.
 *
 * Выражение ниже повторяет лестницу app_state() слово в слово, поэтому фильтр,
 * группировка и бейдж всегда показывают одно и то же. Правило про длинные конкурсы
 * (results_mode='list') здесь не применяется намеренно: оно скрывает результат от
 * УЧАСТНИКА, а в админке результат виден всегда.
 *
 * @param string $a алиас таблицы applications в запросе
 */
function app_state_sql(string $a = 'a', bool $forAdmin = true): string {
    if (!preg_match('/^[a-z_][a-z0-9_]*$/i', $a)) $a = 'a';
    $dipT = "(SELECT COUNT(*) FROM diplomas d WHERE d.application_id=$a.id)";
    $dipS = "(SELECT COUNT(*) FROM diplomas d WHERE d.application_id=$a.id AND COALESCE(d.sent_at,'')<>'')";
    $ordT = "(SELECT COUNT(*) FROM awards_orders o WHERE o.application_id=$a.id)";
    $ordO = "(SELECT COUNT(*) FROM awards_orders o WHERE o.application_id=$a.id AND o.status IN ('paid','made','shipped'))";
    // В админке заявка становится «Оценена» сразу после оценки, у участника —
    // только когда письмо дошло. Это условие обязано совпадать с развилкой в
    // app_state(), иначе фильтр «Статус» снова начнёт расходиться с бейджем:
    // админ выберет «Оценена» и получит пустой список.
    $judging = $forAdmin ? "1=0" : "COALESCE($a.result_sent_at,'')=''";
    return "CASE
        WHEN $a.status='rejected' THEN 'rejected'
        WHEN COALESCE($a.state_override,'')<>'' THEN $a.state_override
        WHEN COALESCE($a.result,'')='' THEN 'new'
        WHEN $judging THEN 'judging'
        WHEN $dipT>0 AND $dipS=$dipT AND $ordT>0 AND $ordO=0 THEN 'done'
        WHEN $ordO>0 THEN 'extra'
        WHEN $dipT>0 AND $dipS=$dipT THEN 'made'
        WHEN $dipT>0 AND $dipS<$dipT THEN 'making'
        ELSE 'graded' END";
}

/**
 * УСЛОВИЕ «РЕЗУЛЬТАТ УЖЕ РАСКРЫТ» — ДЛЯ ВСЕГО ПУБЛИЧНОГО.
 *
 * Оценка в базе и оценка, о которой можно говорить вслух, — разные вещи. Участник
 * узнаёт свой результат из письма (короткий конкурс) или из опубликованного списка
 * (длинный), и до этого момента звание не должно всплыть НИГДЕ: ни в кабинете, ни в
 * чате, ни на публичной странице результатов, ни в реестре дипломов.
 *
 * Публичные страницы отбирали заявки по applications.status IN ('graded','sent') —
 * а этот статус выставляется сразу после работы жюри, задолго до писем. То есть
 * человек мог прочитать своё звание на сайте раньше, чем получил его от центра, а по
 * длинному конкурсу — раньше общего оглашения, ради которого всё и затевается.
 *
 * Условие ниже повторяет правило кабинета и чат-бота (core/chat_gate.php) на языке
 * SQL, чтобы во всех трёх местах оно было буквально одним и тем же.
 *
 * @param string $a алиас applications, $c — алиас competitions в запросе
 */
function app_result_public_sql(string $a = 'a', string $c = 'c'): string {
    if (!preg_match('/^[a-z_][a-z0-9_]*$/i', $a)) $a = 'a';
    if (!preg_match('/^[a-z_][a-z0-9_]*$/i', $c)) $c = 'c';
    return "(COALESCE($a.result,'') <> '' AND COALESCE($a.status,'') <> 'rejected' AND (
                 (COALESCE($c.results_mode,'') =  'list' AND COALESCE($c.results_published_at,'') <> '')
              OR (COALESCE($c.results_mode,'') <> 'list' AND COALESCE($a.result_sent_at,'')      <> '')
            ))";
}

/**
 * Человеческие метки + тон бейджа (gold|blue|bord|success|warning|error|info).
 *
 * Названия зависят от того, кто смотрит. Участнику важно, что он получил:
 * «Изготовлена» — документы у него на почте. Оргкомитету важно, что сделано и
 * что осталось: «Дипломы готовы» значит собраны, но ещё не ушли, «Дипломы
 * отправлены» — ушли. Одно и то же состояние, разный вопрос к нему.
 *
 * Метки обязаны быть общими для бейджа и для фильтра «Статус»: иначе в списке
 * одно слово, в выпадающем списке другое, и админ ищет несуществующее.
 */
function app_state_labels(bool $forAdmin = false): array {
    $l = [
        'new'      => ['Новая',           'blue'],
        'judging'  => ['На оценке',       'bord'],
        'graded'   => ['Оценена',         'gold'],
        'making'   => ['На изготовлении', 'bord'],
        'made'     => ['Изготовлена',     'gold'],
        'extra'    => ['Доп. заказ',      'blue'],
        'done'     => ['Исполнена',       'gold'],
        'rejected' => ['Отклонена',       'bord'],
    ];
    if ($forAdmin) {
        $l['making'] = ['Дипломы готовы',     'bord'];
        $l['made']   = ['Дипломы отправлены', 'gold'];
    }
    return $l;
}

/** Русское название вычисленного состояния. */
function app_state_ru(string $code, bool $forAdmin = false): string {
    return app_state_labels($forAdmin)[$code][0] ?? $code;
}

/**
 * Полная картина по заявке: что сделано, что запланировано и на когда.
 *
 * @param array $app строка applications (желательно с полями конкурса comp_*)
 * @param bool  $forAdmin true — админский вид (видно всё сразу, включая запланированное);
 *                        false — вид участника (только то, что реально дошло на почту)
 * @return array{
 *   code:string, label:string, tone:string, step:int,
 *   result:string, result_sent_at:string, result_plan_at:string,
 *   diplomas:array, diplomas_sent:int, diplomas_total:int,
 *   diploma_sent_at:string, diploma_plan_at:string,
 *   orders:array, orders_open:int, amount_paid:int, detail:string
 * }
 */
function app_state(array $app, bool $forAdmin = false): array {
    $appId = (int) ($app['id'] ?? 0);
    $raw   = (string) ($app['status'] ?? 'new');

    $out = [
        'code' => 'new', 'label' => 'Новая', 'tone' => 'blue', 'step' => 0,
        'result' => (string) ($app['result'] ?? ''),
        'result_sent_at' => trim((string) ($app['result_sent_at'] ?? '')),
        'result_plan_at' => trim((string) ($app['result_send_at'] ?? '')),
        'diplomas' => [], 'diplomas_sent' => 0, 'diplomas_total' => 0,
        'diploma_sent_at' => '', 'diploma_plan_at' => '',
        'orders' => [], 'orders_open' => 0,
        'amount_paid' => 0,
        'detail' => '',
    ];

    if ($raw === 'rejected') {
        return array_merge($out, ['code' => 'rejected', 'label' => 'Отклонена', 'tone' => 'bord', 'step' => 0,
                                  'detail' => 'Заявка отклонена оргкомитетом.']);
    }

    // Длинный конкурс (results_mode='list') до публикации итогов: участник не видит результат.
    $isList     = (string) ($app['comp_results_mode'] ?? $app['results_mode'] ?? '') === 'list';
    $listPub    = trim((string) ($app['comp_results_pub'] ?? $app['results_published_at'] ?? '')) !== '';
    $listHidden = $isList && !$listPub && !$forAdmin;

    // --- Факты по дипломам ---
    if ($appId && function_exists('all')) {
        try {
            $out['diplomas'] = all(
                "SELECT id, number, type, result, pdf_path, scheduled_at, sent_at
                   FROM diplomas WHERE application_id=?
                  ORDER BY CASE type WHEN 'main' THEN 1 WHEN 'extra' THEN 2 WHEN 'named' THEN 3
                                     WHEN 'thanks' THEN 4 ELSE 5 END, id",
                [$appId]
            );
        } catch (\Throwable $e) { $out['diplomas'] = []; }
    }
    $out['diplomas_total'] = count($out['diplomas']);
    foreach ($out['diplomas'] as $d) {
        $s = trim((string) ($d['sent_at'] ?? ''));
        $p = trim((string) ($d['scheduled_at'] ?? ''));
        if ($s !== '') {
            $out['diplomas_sent']++;
            if ($out['diploma_sent_at'] === '' || $s > $out['diploma_sent_at']) $out['diploma_sent_at'] = $s;
        } elseif ($p !== '' && ($out['diploma_plan_at'] === '' || $p < $out['diploma_plan_at'])) {
            $out['diploma_plan_at'] = $p;
        }
    }

    // --- Факты по дополнительным заказам наград ---
    if ($appId && function_exists('all')) {
        try {
            $out['orders'] = all(
                "SELECT id, items, amount, status, created_at, tracking
                   FROM awards_orders WHERE application_id=? ORDER BY id DESC",
                [$appId]
            );
        } catch (\Throwable $e) { $out['orders'] = []; }
    }
    foreach ($out['orders'] as $o) {
        $st = (string) ($o['status'] ?? '');
        if (in_array($st, ['paid', 'made', 'shipped'], true)) $out['orders_open']++;
        if (in_array($st, ['paid', 'made', 'shipped', 'delivered'], true)) $out['amount_paid'] += (int) ($o['amount'] ?? 0);
    }

    // --- Ручное переопределение из админки ---
    // Форма «Статус» в карточке заявки писала applications.status, а бейдж читал
    // только факты — админ жал «Сохранить», получал зелёное «Статус обновлён» и
    // ровно ничего не менялось на экране. Аварийно перевести заявку в нужное
    // состояние было нельзя вообще. Теперь у админки есть отдельное поле, и оно
    // уважается везде: и здесь, и в SQL-выражении app_state_sql().
    $__ovr = trim((string) ($app['state_override'] ?? ''));
    if ($__ovr !== '' && isset(app_state_labels()[$__ovr])) {
        [$lbl, $tone] = app_state_labels()[$__ovr];
        $pipe = app_state_pipeline();
        $idx  = array_search($__ovr === 'extra' ? 'made' : $__ovr, $pipe, true);
        return array_merge($out, [
            'code' => $__ovr, 'label' => $lbl, 'tone' => $tone,
            'step' => $idx === false ? 0 : (int) $idx,
            'detail' => 'Состояние выставлено оргкомитетом вручную.',
            'manual' => true,
        ]);
    }

    // --- Определение состояния (сверху вниз, первое совпадение) ---
    $hasResult   = trim((string) $out['result']) !== '' && !$listHidden;
    $resultSent  = $out['result_sent_at'] !== '' && !$listHidden;
    $dipAllSent  = $out['diplomas_total'] > 0 && $out['diplomas_sent'] === $out['diplomas_total'];
    $dipPlanned  = $out['diplomas_total'] > 0 && $out['diplomas_sent'] < $out['diplomas_total'];
    $ordersDone  = $out['orders'] && $out['orders_open'] === 0;

    // ДВА РАЗНЫХ ВЗГЛЯДА НА ОДНУ ЗАЯВКУ.
    //
    // Админка показывает СДЕЛАННОЕ: жюри проставило оценку — заявка «Оценена»,
    // дипломы созданы — «На изготовлении», ушли — «Изготовлена». Оргкомитету
    // важно видеть свою работу сразу, иначе оценённая утром заявка весь день
    // висит «На оценке» и непонятно, сделана она или забыта.
    //
    // Участник видит ДОШЕДШЕЕ: пока письмо с результатом не легло к нему в почту,
    // для него ничего не произошло. Иначе он увидит «Оценена» в кабинете, полезет
    // в почту, ничего там не найдёт и напишет в поддержку.
    //
    // Отсюда развилка: у админа отправка результата не влияет на статус, у
    // участника она — обязательное условие перехода.
    $resultShown = $forAdmin ? $hasResult : $resultSent;
    $dipAllSent  = $forAdmin
        ? ($out['diplomas_total'] > 0 && $out['diplomas_sent'] === $out['diplomas_total'])
        : $dipAllSent;

    if (!$hasResult) {
        $out['code'] = 'new';
        $out['detail'] = 'Заявка принята, ожидает аттестации жюри.';
    } elseif (!$resultShown) {
        // Оценка есть, но письмо участнику ещё не ушло — участник видит «На оценке».
        $out['code'] = 'judging';
        $out['detail'] = $out['result_plan_at'] !== ''
            ? 'Результат отправится ' . app_state_dt($out['result_plan_at'])
            : 'Результат подведён, готовится отправка.';
    } elseif ($dipAllSent && $out['orders'] && $ordersDone) {
        $out['code'] = 'done';
        $out['detail'] = 'Результат, награды и дополнительные заказы выполнены.';
    } elseif ($out['orders_open'] > 0) {
        $out['code'] = 'extra';
        $out['detail'] = 'Дополнительный заказ наградного материала в работе.';
    } elseif ($dipAllSent) {
        $out['code'] = 'made';
        $out['detail'] = 'Наградные документы отправлены ' . app_state_dt($out['diploma_sent_at']) . '.';
    } elseif ($dipPlanned) {
        $out['code'] = 'making';
        $out['detail'] = $out['diploma_plan_at'] !== ''
            ? 'Наградные документы придут ' . app_state_dt($out['diploma_plan_at'])
            : 'Наградные документы готовятся к отправке.';
    } else {
        $out['code'] = 'graded';
        $out['detail'] = $out['result_sent_at'] !== ''
            ? 'Результат отправлен ' . app_state_dt($out['result_sent_at']) . '. Наградные документы готовятся.'
            : ($out['result_plan_at'] !== ''
                ? 'Оценка проставлена. Результат уйдёт участнику ' . app_state_dt($out['result_plan_at']) . '.'
                : 'Оценка проставлена, отправка результата готовится.');
    }

    // Названия состояний в админке говорят о наших действиях, а у участника —
    // о том, что он получил. «Изготовлена» оргкомитету ничего не сообщает: надо
    // ли ещё что-то делать или всё уже ушло. Поэтому в админке те же состояния
    // называются по факту: дипломы готовы / дипломы отправлены.
    $labels = app_state_labels($forAdmin);
    [$lbl, $tone] = $labels[$out['code']] ?? [$out['code'], 'blue'];
    $out['label'] = $lbl;
    $out['tone']  = $tone;
    $pipe = app_state_pipeline();
    $idx  = array_search($out['code'] === 'extra' ? 'made' : $out['code'], $pipe, true);
    $out['step'] = $idx === false ? 0 : (int) $idx;

    return $out;
}

/** Сколько рабочих дней участник может править поданную заявку. */
const APP_EDIT_WORKDAYS = 2;

/**
 * ОКНО РЕДАКТИРОВАНИЯ ЗАЯВКИ УЧАСТНИКОМ (правило владельца, август 2026).
 *
 * Править свою заявку можно ТОЛЬКО в течение ДВУХ РАБОЧИХ ДНЕЙ со дня подачи —
 * дальше материал уходит жюри, и данные обязаны совпадать с тем, что оценивалось
 * и что будет напечатано в дипломе. Воскресенье не считается (см. send_timing.php).
 *
 * Дополнительно окно закрывается досрочно, если заявку уже оценили или отклонили.
 *
 * @return array{can:bool, until:string, reason:string}
 *   can    — можно ли править прямо сейчас;
 *   until  — момент, до которого окно открыто (Y-m-d H:i:s);
 *   reason — почему нельзя (пустая строка, если можно).
 */
function app_edit_window(array $app): array {
    if (!function_exists('working_days_add')) {
        $st = BASE_PATH . '/core/send_timing.php';
        if (is_file($st)) require_once $st;
    }
    $created = trim((string) ($app['created_at'] ?? ''));
    $until   = '';
    if ($created !== '' && function_exists('working_days_add')) {
        // Конец окна — конец второго рабочего дня (18:00), а не 09:00 утра.
        $d = working_days_add($created, APP_EDIT_WORKDAYS);
        $d->setTime(18, 0);
        $until = $d->format('Y-m-d H:i:s');
    }

    $status = (string) ($app['status'] ?? 'new');
    if ($status === 'rejected') {
        return ['can' => false, 'until' => $until, 'reason' => 'Заявка отклонена — изменения недоступны.'];
    }
    if (trim((string) ($app['result'] ?? '')) !== '') {
        return ['can' => false, 'until' => $until, 'reason' => 'Итоги по заявке уже подведены — изменения недоступны.'];
    }
    if ($until !== '' && time() > strtotime($until)) {
        return ['can' => false, 'until' => $until,
                'reason' => 'Срок изменения истёк ' . app_state_dt($until) . ' — заявку можно править только два рабочих дня со дня подачи.'];
    }
    return ['can' => true, 'until' => $until, 'reason' => ''];
}

/** Короткая русская дата-время для подписей статуса. */
function app_state_dt(string $s): string {
    $s = trim($s);
    if ($s === '') return '';
    $ts = strtotime($s);
    return $ts ? date('d.m.Y', $ts) . ' в ' . date('H:i', $ts) : $s;
}

/**
 * Синхронизирует хранимый applications.status с вычисленным состоянием.
 * Нужен, чтобы фильтры/выборки по колонке status в админке оставались верными.
 * Вызывается после оценки, отправки результата, отправки дипломов и оплаты заказа.
 */
function app_status_sync(int $appId): string {
    if (!$appId) return '';
    $app = one("SELECT a.*, c.results_mode AS comp_results_mode, c.results_published_at AS comp_results_pub
                  FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                 WHERE a.id=?", [$appId]);
    if (!$app) return '';
    if ((string) ($app['status'] ?? '') === 'rejected') return 'rejected';
    $st = app_state((array) $app, true);
    $code = (string) $st['code'];
    if ($code !== (string) ($app['status'] ?? '')) {
        try { update('applications', ['status' => $code], 'id=:id', ['id' => $appId]); } catch (\Throwable $e) {}
    }
    return $code;
}

/**
 * ТОТ ЖЕ НОМЕР НА ДРУГОМ КОНКУРСЕ — УЖЕ ОЦЕНЁННЫЙ.
 *
 * Один и тот же номер участник нередко подаёт сразу в несколько конкурсов
 * сезона. Жюри об этом не знает и может поставить «Гран-при» там, где месяц
 * назад тот же номер получил «Лауреат II степени» — участник сравнит два
 * диплома и придёт с вопросом. Поэтому при оценке показываем, что этому же
 * исполнителю за этот же номер уже присуждали.
 *
 * Совпадением считаем пару «исполнитель + название номера»: у коллектива —
 * название коллектива, у солиста — ФИО. Сравниваем по нормали, без регистра,
 * кавычек и лишних пробелов: участники пишут «Journey» и «„Journey“» вперемешку.
 *
 * @return array<int, array{id:int, number:string, who:string, work:string, comp:string, result:string, extra:string, graded_at:string}>
 */
function app_same_work_graded(array $app): array {
    $work = app_norm_key((string) ($app['work_title'] ?? ''));
    if ($work === '') return [];

    $who = app_norm_key((int) ($app['is_group'] ?? 0) === 1
        ? (string) ($app['group_name'] ?? '')
        : (string) ($app['full_name'] ?? ''));
    if ($who === '') return [];

    $id   = (int) ($app['id'] ?? 0);
    $comp = (int) ($app['competition_id'] ?? 0);

    try {
        $rows = all(
            "SELECT a.id, a.number, a.is_group, a.group_name, a.full_name, a.work_title,
                    a.result, a.extra_diploma, a.graded_at, c.name AS comp
               FROM applications a
               LEFT JOIN competitions c ON c.id = a.competition_id
              WHERE a.id <> ?
                AND a.competition_id <> ?
                AND TRIM(COALESCE(a.result,'')) <> ''
                AND COALESCE(a.status,'') <> 'rejected'
              ORDER BY a.graded_at DESC, a.id DESC",
            [$id, $comp]
        );
    } catch (\Throwable $e) { return []; }

    $out = [];
    foreach ($rows as $r) {
        if (app_norm_key((string) $r['work_title']) !== $work) continue;
        $rWho = app_norm_key((int) $r['is_group'] === 1 ? (string) $r['group_name'] : (string) $r['full_name']);
        if ($rWho !== $who) continue;
        $out[] = [
            'id'        => (int) $r['id'],
            'number'    => (string) $r['number'],
            'who'       => (int) $r['is_group'] === 1 ? (string) $r['group_name'] : (string) $r['full_name'],
            'work'      => (string) $r['work_title'],
            'comp'      => (string) ($r['comp'] ?? ''),
            'result'    => (string) $r['result'],
            'extra'     => (string) ($r['extra_diploma'] ?? ''),
            'graded_at' => (string) ($r['graded_at'] ?? ''),
        ];
    }
    return $out;
}

/**
 * Ключ для сравнения имён и названий.
 *
 * Убирает регистр, кавычки всех видов, дефисы-разделители и повторные пробелы.
 * Букву «ё» приводим к «е»: в заявках она встречается в обоих написаниях, и без
 * этого «Метелица» и «Метёлица» считались бы разными номерами.
 */
function app_norm_key(string $s): string {
    $s = mb_strtolower(trim($s));
    $s = str_replace(['ё', '«', '»', '"', "'", '“', '”', '„', '`'], ['е', '', '', '', '', '', '', '', ''], $s);
    $s = preg_replace('~[\s\-–—_.,;:!?]+~u', ' ', $s) ?? $s;
    return trim($s);
}
