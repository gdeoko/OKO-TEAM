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

/** Человеческие метки + тон бейджа (gold|blue|bord|success|warning|error|info). */
function app_state_labels(): array {
    return [
        'new'      => ['Новая',           'blue'],
        'judging'  => ['На оценке',       'bord'],
        'graded'   => ['Оценена',         'gold'],
        'making'   => ['На изготовлении', 'bord'],
        'made'     => ['Изготовлена',     'gold'],
        'extra'    => ['Доп. заказ',      'blue'],
        'done'     => ['Исполнена',       'gold'],
        'rejected' => ['Отклонена',       'bord'],
    ];
}

/** Русское название вычисленного состояния. */
function app_state_ru(string $code): string {
    return app_state_labels()[$code][0] ?? $code;
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

    // --- Определение состояния (сверху вниз, первое совпадение) ---
    $hasResult   = trim((string) $out['result']) !== '' && !$listHidden;
    $resultSent  = $out['result_sent_at'] !== '' && !$listHidden;
    $dipAllSent  = $out['diplomas_total'] > 0 && $out['diplomas_sent'] === $out['diplomas_total'];
    $dipPlanned  = $out['diplomas_total'] > 0 && $out['diplomas_sent'] < $out['diplomas_total'];
    $ordersDone  = $out['orders'] && $out['orders_open'] === 0;

    if (!$hasResult) {
        $out['code'] = 'new';
        $out['detail'] = 'Заявка принята, ожидает аттестации жюри.';
    } elseif (!$resultSent) {
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
        $out['detail'] = 'Результат отправлен ' . app_state_dt($out['result_sent_at']) . '. Наградные документы готовятся.';
    }

    [$lbl, $tone] = app_state_labels()[$out['code']] ?? [$out['code'], 'blue'];
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
