<?php
/**
 * ЖИВОЙ ПУЛЬТ АВТОМАТИЗАЦИИ («Отправки»).
 *
 * ЕДИНЫЙ список всего, что стоит в очереди авто-отправки (дипломы, письма, заказы
 * оригиналов), + ЕДИНЫЙ архив отправленного. Сверху — фильтр по типу и поисковая
 * строка (ФИО / почта / телефон / конкурс / номер / тема / любой текст письма).
 * Все действия идут по AJAX — страница НЕ перезагружается и НЕ прыгает вниз.
 *
 * По каждой строке очереди: изменить дату/время, отправить сейчас, отменить,
 * отредактировать письмо (тема, адрес, дата, тело, кнопки со ссылками — с «Отмена»
 * и «Сохранить»). В архиве: просмотр, дублировать, отредактировать-и-дублировать.
 *
 * Источники (реальные механизмы):
 *   1) diplomas.scheduled_at   — крон send_diplomas.php шлёт по времени;
 *   2) mail_queue              — крон process_newsletter_queue; scheduled_at держит/откладывает;
 *   3) awards_orders           — оплачено→изготовить→отправить (раб. дни от оплаты/диспетча).
 */
declare(strict_types=1);

if (is_file(BASE_PATH . '/core/mailer.php')) require_once BASE_PATH . '/core/mailer.php';

/* --------- мягкие миграции нужных колонок (идемпотентно) --------- */
try { db()->exec("ALTER TABLE mail_queue ADD COLUMN scheduled_at TEXT"); } catch (\Throwable $e) {}
try { db()->exec("ALTER TABLE diplomas ADD COLUMN scheduled_at TEXT"); } catch (\Throwable $e) {}

/** Прибавить N рабочих дней (вс — выходной) к дате-времени. */
function disp_add_workdays(string $from, int $days): string {
    try { $t = new DateTime($from ?: 'now'); } catch (\Throwable $e) { $t = new DateTime('now'); }
    $added = 0;
    while ($added < $days) {
        $t->modify('+1 day');
        if ((int) $t->format('N') !== 7) $added++; // 7 = воскресенье
    }
    return $t->format('Y-m-d H:i:s');
}

/** Русская дата-время коротко. */
function disp_dt(string $s): string {
    $s = trim($s);
    if ($s === '') return '—';
    $ts = strtotime($s);
    return $ts ? date('d.m.Y H:i', $ts) : $s;
}

/** Просрочено/скоро — цвет плашки времени. */
function disp_when_badge(string $s): array {
    $ts = strtotime($s ?: '');
    if (!$ts) return ['#8892B0', 'без времени'];
    $now = time();
    if ($ts <= $now) return ['#C0392B', 'уходит сейчас'];
    if ($ts - $now < 3600 * 24) return ['#C79322', disp_dt($s)];
    return ['#2C7BE5', disp_dt($s)];
}

/* --------- Классификация письма по типу (для фильтра «Отправки») --------- */
function disp_mail_type(array $m): string {
    $s = mb_strtolower((string) ($m['subject'] ?? ''));
    if ((int) ($m['newsletter_id'] ?? 0) > 0) return 'newsletter';
    if (str_contains($s, 'диплом') || str_contains($s, 'наград')) return 'diploma';
    if (str_contains($s, 'результат')) return 'result';
    if (str_contains($s, 'оплатите') || str_contains($s, 'ждёт оплаты') || str_contains($s, 'будет удален') || str_contains($s, 'удалена')) return 'dunning';
    if (str_contains($s, '[оплаты]') || str_contains($s, '[заявки]') || str_contains($s, 'принята') || str_contains($s, 'уведомл')) return 'notify';
    if (str_contains($s, 'новост') || str_contains($s, 'конкурс') || str_contains($s, 'приглаша')) return 'news';
    return 'other';
}
const DISP_MAIL_TYPES = ['all'=>'Все','diploma'=>'Дипломы','newsletter'=>'Рассылки','result'=>'Результаты','notify'=>'Уведомления','dunning'=>'Дожимы','news'=>'Новости','other'=>'Прочее'];

/** Единый список фильтров для сводной очереди/архива. */
function disp_filters(): array {
    return [
        'all'          => 'Все',
        'result_sched' => 'Результаты по расписанию',
        'diploma'      => 'Дипломы к отправке',
        'mail'         => 'Все письма',
        'newsletter'   => 'Письма · рассылки',
        'result'       => 'Письма · результаты',
        'notify'       => 'Письма · уведомления',
        'dunning'      => 'Письма · дожимы',
        'news'         => 'Письма · новости',
        'other'        => 'Письма · прочее',
        'order'        => 'Заказы в производстве',
    ];
}

$dTypeLbl = ['main' => 'Основной диплом', 'named' => 'Именной диплом', 'extra' => 'Спец-награда', 'thanks' => 'Благодарность педагогу'];

/** Ответ AJAX или обычный редирект (для форм без JS). */
function disp_done(bool $ok, string $msg, array $extra = []): void {
    if (input('ajax') === '1') { json_out(['ok' => $ok, 'msg' => $msg] + $extra); }
    flash($msg, $ok ? 'success' : 'error');
    admin_redirect('dispatch');
}

/* --------- Просмотр реального письма (GET) — открывает тело письма как есть --------- */
if (input('do') === 'view' && input('kind') === 'mail') {
    $m = one("SELECT * FROM mail_queue WHERE id=?", [(int) input('id')]);
    if ($m) {
        header('Content-Type: text/html; charset=utf-8');
        echo (string) ($m['body'] ?? '<p>Пусто</p>');
        exit;
    }
    http_response_code(404); echo 'Письмо не найдено'; exit;
}

/* --------- JSON-данные письма для редактора (тема/адрес/дата/тело/вложение) --------- */
if (input('do') === 'get' && input('kind') === 'mail') {
    $m = one("SELECT * FROM mail_queue WHERE id=?", [(int) input('id')]);
    if (!$m) json_out(['ok' => false, 'error' => 'Письмо не найдено'], 404);
    $sched = trim((string) ($m['scheduled_at'] ?? ''));
    json_out([
        'ok'           => true,
        'to_email'     => (string) $m['to_email'],
        'to_name'      => (string) ($m['to_name'] ?? ''),
        'subject'      => (string) $m['subject'],
        'body'         => (string) ($m['body'] ?? ''),
        'attach'       => (string) ($m['attach'] ?? ''),
        'scheduled_at' => $sched !== '' ? date('Y-m-d\TH:i', strtotime($sched)) : '',
        'status'       => (string) ($m['status'] ?? ''),
    ]);
}

/* --------- JSON-данные ДИПЛОМА для редактора (данные заявки + превью) --------- */
if (input('do') === 'dip_get' && input('kind') === 'diploma') {
    $d = one("SELECT * FROM diplomas WHERE id=?", [(int) input('id')]);
    if (!$d) json_out(['ok' => false, 'error' => 'Диплом не найден'], 404);
    $a = one("SELECT * FROM applications WHERE id=?", [(int) $d['application_id']]) ?: [];
    $s = trim((string) ($d['scheduled_at'] ?? ''));
    json_out([
        'ok'           => true,
        'number'       => (string) $d['number'],
        'type'         => (string) $d['type'],
        'preview'      => url('/diploma-view/' . rawurlencode((string) $d['number'])),
        'pdf'          => url('/diploma/' . rawurlencode((string) $d['number']) . '.pdf'),
        'is_group'     => (int) ($a['is_group'] ?? 0),
        'group_name'   => (string) ($a['group_name'] ?? ''),
        'full_name'    => (string) ($a['full_name'] ?? ''),
        'teacher'      => (string) ($a['teacher'] ?? ''),
        'nomination'   => (string) ($a['nomination'] ?? ''),
        'age_category' => (string) ($a['age_category'] ?? ''),
        'work_title'   => (string) ($a['work_title'] ?? ''),
        'result'       => (string) ($a['result'] ?? ''),
        'extra_diploma'=> (string) ($a['extra_diploma'] ?? ''),
        'scheduled_at' => $s !== '' ? date('Y-m-d\TH:i', strtotime($s)) : '',
    ]);
}

/* ============================ POST-обработчики ============================ */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { disp_done(false, 'Сессия устарела. Обновите страницу.'); }
    $do   = input('do');
    $kind = input('kind');           // diploma | mail | order
    $id   = (int) input('id');

    /* ---- ДИПЛОМ ---- */
    // Действия применяются ко ВСЕЙ заявке (одна заявка = одно письмо): если передан
    // app — берём все её неотправленные дипломы (основной+доп+именной+благодарность),
    // иначе одиночный id (обратная совместимость).
    $appG = (int) input('app');
    if ($kind === 'diploma' && ($id || $appG)) {
        $ids = [];
        if ($appG > 0) {
            $ids = array_map('intval', array_column(all("SELECT id FROM diplomas WHERE application_id=? AND sent_at IS NULL", [$appG]), 'id'));
        } elseif ($id) { $ids = [$id]; }
        if (!$ids && !in_array($do, ['dip_save'], true)) disp_done(false, 'Дипломы заявки не найдены.');
        $inHolder = $ids ? implode(',', array_fill(0, count($ids), '?')) : '0';

        if ($do === 'resched') {
            $dt = trim(input('scheduled_at'));
            if ($dt === '') disp_done(false, 'Укажите дату и время.');
            $norm = date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time());
            q("UPDATE diplomas SET scheduled_at=? WHERE id IN ($inHolder)", array_merge([$norm], $ids));
            audit('dispatch_resched', 'diploma', $ids[0] ?? 0, ['at' => $norm, 'app' => $appG, 'count' => count($ids)]);
            disp_done(true, 'Дата отправки письма с дипломами изменена на ' . disp_dt($norm) . '.', ['when' => disp_dt($norm)]);
        } elseif ($do === 'sendnow') {
            q("UPDATE diplomas SET scheduled_at='2000-01-01 00:00:00' WHERE id IN ($inHolder)", $ids);
            @exec('cd ' . escapeshellarg(BASE_PATH) . ' && php cron/send_diplomas.php > /dev/null 2>&1 &');
            audit('dispatch_sendnow', 'diploma', $ids[0] ?? 0, ['app' => $appG, 'count' => count($ids)]);
            disp_done(true, 'Письмо с дипломами (все по заявке) поставлено на моментальную отправку — уйдёт одним письмом в течение минуты.', ['remove' => true]);
        } elseif ($do === 'cancel') {
            q("DELETE FROM diplomas WHERE id IN ($inHolder) AND sent_at IS NULL", $ids);
            audit('dispatch_cancel', 'diploma', $ids[0] ?? 0, ['app' => $appG, 'count' => count($ids)]);
            disp_done(true, 'Плановая отправка дипломов заявки отменена.', ['remove' => true]);
        } elseif ($do === 'dip_save') {
            // Редактирование ДИПЛОМА прямо в «Отправках»: правим данные заявки (диплом
            // собирается строго из неё), кэш PDF чистим — пересоберётся с правками.
            $d = one("SELECT * FROM diplomas WHERE id=?", [$id]);
            if (!$d) disp_done(false, 'Диплом не найден.');
            $aid = (int) $d['application_id'];
            $data = [];
            foreach (['group_name','full_name','teacher','nomination','age_category','work_title','result','extra_diploma'] as $f) {
                if (input($f) !== null) $data[$f] = trim((string) input($f));
            }
            if (input('is_group') !== null) $data['is_group'] = input('is_group') === '1' ? 1 : 0;
            if ($data && $aid) update('applications', $data, 'id=:id', ['id' => $aid]);
            // Пересобрать все дипломы этой заявки с новыми данными.
            if ($aid) q("UPDATE diplomas SET pdf_path='' WHERE application_id=?", [$aid]);
            // Дату отправки меняем только если поле трогали.
            if (input('sched_touched') === '1') {
                $dt = trim(input('scheduled_at'));
                $norm = $dt !== '' ? date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time()) : null;
                update('diplomas', ['scheduled_at' => $norm], 'id=:id', ['id' => $id]);
            }
            audit('dispatch_dip_edit', 'diploma', $id, ['app' => $aid, 'fields' => array_keys($data)]);
            disp_done(true, 'Диплом обновлён — данные сохранены, PDF пересоберётся. Проверьте предпросмотром.');
        }
        disp_done(false, 'Неизвестное действие.');
    }

    /* ---- ПИСЬМО ---- */
    if ($kind === 'mail' && $id) {
        if ($do === 'resched') {
            $dt = trim(input('scheduled_at'));
            $norm = $dt !== '' ? date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time()) : null;
            update('mail_queue', ['scheduled_at' => $norm], 'id=:id', ['id' => $id]);
            audit('dispatch_resched', 'mail', $id, ['at' => $norm]);
            disp_done(true, 'Время письма изменено' . ($norm ? ' на ' . disp_dt($norm) : '') . '.', ['when' => $norm ? disp_dt($norm) : 'сразу']);
        } elseif ($do === 'sendnow') {
            $m = one("SELECT * FROM mail_queue WHERE id=? AND status='queued'", [$id]);
            if ($m && function_exists('mail_send')) {
                $opt = [];
                if (!empty($m['attach'])) $opt['attach'] = (string) $m['attach'];
                if (function_exists('mail_route_account')) { $acc = mail_route_account($m); if ($acc) $opt['account'] = $acc; }
                $ok = false;
                try { $ok = (bool) mail_send((string) $m['to_email'], (string) $m['subject'], (string) $m['body'], $opt); } catch (\Throwable $e) {}
                if ($ok) {
                    update('mail_queue', ['status' => 'sent', 'sent_at' => date('Y-m-d H:i:s'), 'scheduled_at' => null], 'id=:id', ['id' => $id]);
                    audit('dispatch_sendnow', 'mail', $id, ['ok' => true]);
                    disp_done(true, 'Письмо отправлено сейчас.', ['remove' => true]);
                }
                update('mail_queue', ['scheduled_at' => null, 'priority' => 0], 'id=:id', ['id' => $id]);
                audit('dispatch_sendnow', 'mail', $id, ['ok' => false]);
                disp_done(true, 'Мгновенная отправка не удалась — письмо в приоритетной очереди (уйдёт в течение минуты).', ['remove' => true]);
            }
            disp_done(false, 'Письмо не найдено или уже обработано.');
        } elseif ($do === 'cancel') {
            update('mail_queue', ['status' => 'cancelled'], 'id=:id', ['id' => $id]);
            audit('dispatch_cancel', 'mail', $id, []);
            disp_done(true, 'Письмо отменено — отправлено не будет.', ['remove' => true]);
        } elseif ($do === 'duplicate') {
            $m = one("SELECT * FROM mail_queue WHERE id=?", [$id]);
            if (!$m) disp_done(false, 'Письмо не найдено.');
            insert('mail_queue', [
                'to_email' => (string) $m['to_email'], 'to_name' => (string) ($m['to_name'] ?? ''),
                'subject' => (string) $m['subject'], 'body' => (string) $m['body'],
                'attach' => (string) ($m['attach'] ?? ''), 'status' => 'queued', 'priority' => 0,
            ]);
            audit('dispatch_duplicate', 'mail', $id, []);
            disp_done(true, 'Копия письма поставлена в очередь (уйдёт заново).');
        } elseif ($do === 'duplicate_edit') {
            // Редактировать-и-дублировать: создаём НОВОЕ письмо из архивного с правками.
            $to   = mb_strtolower(trim(input('to_email')));
            $subj = trim(input('subject'));
            $body = (string) input('body');
            $attach = trim(input('attach'));
            $dt   = trim(input('scheduled_at'));
            if (!filter_var($to, FILTER_VALIDATE_EMAIL)) disp_done(false, 'Укажите корректный email получателя.');
            if ($subj === '' || $body === '') disp_done(false, 'Тема и текст письма не должны быть пустыми.');
            $sched = $dt !== '' ? date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time()) : null;
            insert('mail_queue', [
                'to_email' => $to, 'to_name' => trim(input('to_name')),
                'subject' => $subj, 'body' => $body, 'attach' => $attach,
                'status' => 'queued', 'priority' => 0, 'scheduled_at' => $sched,
            ]);
            audit('dispatch_duplicate_edit', 'mail', $id, []);
            disp_done(true, 'Новое письмо с правками поставлено в очередь' . ($sched ? ' на ' . disp_dt($sched) : ' (уйдёт сразу)') . '.');
        } elseif ($do === 'edit') {
            // Редактирование письма В ОЧЕРЕДИ: сохраняем только по кнопке «Сохранить».
            $m = one("SELECT * FROM mail_queue WHERE id=?", [$id]);
            if (!$m) disp_done(false, 'Письмо не найдено.');
            if ((string) ($m['status'] ?? '') !== 'queued') disp_done(false, 'Это письмо уже отправлено — редактировать нельзя (используйте «дублировать»).');
            $subj = trim(input('subject'));
            $to   = mb_strtolower(trim(input('to_email')));
            $body = (string) input('body');
            $attach = trim(input('attach'));
            $data = [];
            if ($subj !== '') $data['subject'] = $subj;
            if ($to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) $data['to_email'] = $to;
            if (input('body') !== '' && $body !== '') $data['body'] = $body;
            if (input('attach') !== null) $data['attach'] = $attach; // пусто = удалить вложение
            // Дату/время меняем ТОЛЬКО если поле присутствует в запросе; пусто = держим/сразу.
            if (input('sched_touched') === '1') {
                $dt = trim(input('scheduled_at'));
                $data['scheduled_at'] = $dt !== '' ? date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time()) : null;
            }
            if ($data) { update('mail_queue', $data, 'id=:id', ['id' => $id]); }
            audit('dispatch_edit', 'mail', $id, array_keys($data));
            $whenLbl = array_key_exists('scheduled_at', $data)
                ? ($data['scheduled_at'] ? disp_dt((string) $data['scheduled_at']) : 'сразу')
                : null;
            disp_done(true, 'Письмо отредактировано и сохранено.', array_filter([
                'subject' => $data['subject'] ?? null,
                'to_email' => $data['to_email'] ?? null,
                'when' => $whenLbl,
            ], fn($v) => $v !== null));
        }
        disp_done(false, 'Неизвестное действие.');
    }

    /* ---- ЗАКАЗ ---- */
    if ($kind === 'order' && $id) {
        require_once BASE_PATH . '/core/orders.php';
        if ($do === 'made') {
            update('awards_orders', ['status' => 'made', 'made_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $id]);
            disp_done(true, 'Заказ №' . $id . ' отмечен изготовленным.', ['status' => 'made']);
        } elseif ($do === 'ship') {
            $track = trim(input('tracking'));
            if ($track === '') disp_done(false, 'Введите трек-номер.');
            $ok = function_exists('order_mark_shipped') ? order_mark_shipped($id, $track) : false;
            disp_done($ok, $ok ? ('Заказ №' . $id . ' отправлен, участнику ушло письмо с трек-номером.') : 'Статус обновлён, письмо не ушло.', ['remove' => $ok]);
        } elseif ($do === 'redispatch') {
            update('awards_orders', ['dispatched_at' => ''], 'id=:id', ['id' => $id]);
            $ok = function_exists('order_dispatch_production') ? order_dispatch_production($id) : false;
            disp_done($ok, $ok ? ('Пакет заказа №' . $id . ' переотправлен в производство (Telegram).') : 'Не удалось отправить в Telegram.');
        } elseif ($do === 'resched') {
            $dt = trim(input('scheduled_at'));
            if ($dt === '') disp_done(false, 'Укажите дату.');
            $norm = date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time());
            update('awards_orders', ['dispatched_at' => $norm], 'id=:id', ['id' => $id]);
            disp_done(true, 'Точка отсчёта сроков заказа №' . $id . ' изменена на ' . disp_dt($norm) . '.', ['when' => disp_dt($norm)]);
        }
        disp_done(false, 'Неизвестное действие.');
    }

    /* ---- РЕЗУЛЬТАТ по расписанию ---- */
    if ($kind === 'result' && $id) {
        $a = one("SELECT * FROM applications WHERE id=?", [$id]);
        if (!$a) disp_done(false, 'Заявка не найдена.');
        if (trim((string) ($a['result_sent_at'] ?? '')) !== '') disp_done(false, 'Результат уже отправлен.');
        if ($do === 'resched') {
            $dt = trim(input('scheduled_at'));
            if ($dt === '') disp_done(false, 'Укажите дату и время.');
            $norm = date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time());
            update('applications', ['result_send_at' => $norm], 'id=:id', ['id' => $id]);
            audit('dispatch_result_resched', 'application', $id, ['at' => $norm]);
            disp_done(true, 'Отправка результата перенесена на ' . disp_dt($norm) . '.', ['when' => disp_dt($norm)]);
        } elseif ($do === 'sendnow') {
            require_once BASE_PATH . '/core/result_mail.php';
            if (is_file(BASE_PATH . '/core/notifications.php')) require_once BASE_PATH . '/core/notifications.php';
            $ok = false;
            try { $ok = function_exists('result_mail_send') ? (bool) result_mail_send($id) : false; } catch (\Throwable $e) {}
            update('applications', ['result_sent_at' => date('Y-m-d H:i:s'), 'result_send_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $id]);
            if (!empty($a['user_id']) && function_exists('notify_user')) {
                notify_user((int) $a['user_id'], 'Ваш результат готов', 'Жюри подвело итоги: ' . (string) $a['result'] . '.', url('/cabinet'), 'award');
            }
            audit('dispatch_result_sendnow', 'application', $id, ['ok' => $ok]);
            disp_done(true, $ok ? 'Результат отправлен сейчас.' : 'Результат помечен отправленным (письмо могло не уйти).', ['remove' => true]);
        } elseif ($do === 'cancel') {
            update('applications', ['result_send_at' => ''], 'id=:id', ['id' => $id]);
            audit('dispatch_result_cancel', 'application', $id, []);
            disp_done(true, 'Плановая отправка результата отменена (заявка осталась оценённой).', ['remove' => true]);
        }
        disp_done(false, 'Неизвестное действие.');
    }

    disp_done(false, 'Неизвестный объект.');
}

/* ================================ ДАННЫЕ ================================= */
$now = date('Y-m-d H:i:s');
$makeDays = (int) (function_exists('setting') ? setting('order_make_days', '7') : 7);
$shipDays = (int) (function_exists('setting') ? setting('order_ship_days', '14') : 14);

$filters = disp_filters();
$f = input('f') ?: 'all';
if (!isset($filters[$f])) $f = 'all';
$q = trim(input('q'));
$ql = mb_strtolower($q);

/** Отфильтровать элемент по типу и поисковой строке. */
$matchType = function (array $it) use ($f): bool {
    if ($f === 'all')          return true;
    if ($f === 'result_sched') return $it['kind'] === 'result';
    if ($f === 'diploma')      return $it['kind'] === 'diploma';
    if ($f === 'order')        return $it['kind'] === 'order';
    if ($f === 'mail')         return $it['kind'] === 'mail';
    return $it['kind'] === 'mail' && ($it['mtype'] ?? '') === $f;   // подтип письма
};
$matchSearch = function (array $it) use ($ql): bool {
    if ($ql === '') return true;
    return str_contains($it['search'], $ql);
};

/* ---- 1) Дипломы к отправке ---- */
$diplomasRaw = all("SELECT d.*, a.full_name, a.group_name, a.is_group, a.email, a.phone, a.number app_number,
                           c.name comp_name
                    FROM diplomas d
                    JOIN applications a ON a.id=d.application_id
                    LEFT JOIN competitions c ON c.id=a.competition_id
                    WHERE d.sent_at IS NULL
                    ORDER BY (d.scheduled_at IS NULL) ASC, d.scheduled_at ASC, d.id ASC LIMIT 500");
/* ---- 2) Письма в очереди ---- */
$mailsRaw = all("SELECT * FROM mail_queue WHERE status='queued' ORDER BY
                 (scheduled_at IS NULL OR scheduled_at='') DESC, scheduled_at ASC, id ASC LIMIT 500");
/* ---- 3) Заказы в производстве ---- */
$ordersRaw = all("SELECT * FROM awards_orders
                  WHERE status IN ('paid','made','shipped') AND items NOT LIKE '%\"kind\":\"club\"%'
                  ORDER BY (status='paid') DESC, id DESC LIMIT 300");
/* ---- 4) Результаты по расписанию (оценены, письмо-результат ещё не ушло) ---- */
$resultsRaw = all("SELECT a.id, a.number, a.full_name, a.group_name, a.is_group, a.email, a.phone,
                          a.result, a.result_send_at, c.name comp_name
                   FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                   WHERE a.result <> '' AND COALESCE(a.result_send_at,'') <> ''
                     AND COALESCE(a.result_sent_at,'') = ''
                     AND COALESCE(c.results_mode,'') <> 'list'
                   ORDER BY a.result_send_at ASC LIMIT 400");
/* ---- Архив отправленных писем ---- */
$sentRaw = all("SELECT * FROM mail_queue WHERE status='sent' ORDER BY sent_at DESC, id DESC LIMIT 300");

/* ---- Нормализация в единый список ---- */
$queue = [];
// Группируем дипломы ПО ЗАЯВКЕ: одна заявка = одна карточка = одно письмо (основной +
// доп + именной + благодарность уходят вместе). Разные заявки никогда не объединяются.
$dipGroups = [];
foreach ($diplomasRaw as $d) { $dipGroups[(int) $d['application_id']][] = $d; }
foreach ($dipGroups as $appId => $items) {
    $first = $items[0];
    $who = $first['is_group'] ? (string) $first['group_name'] : (string) $first['full_name'];
    // Список типов диплома в письме («Основной · ЛАУРЕАТ II», «Спец-награда · …» и т.д.).
    $parts = [];
    $when = null;
    foreach ($items as $it) {
        $lbl = $dTypeLbl[(string) $it['type']] ?? (string) $it['type'];
        $res = trim((string) $it['result']);
        $parts[] = $lbl . ($res !== '' ? ' · ' . $res : '');
        $sc = trim((string) ($it['scheduled_at'] ?? ''));
        if ($sc !== '' && ($when === null || $sc < $when)) $when = $sc;
    }
    $primaryId = (int) $first['id'];
    $title = 'Дипломы по заявке (' . count($items) . ' в одном письме): ' . implode(' + ', $parts);
    $queue[] = [
        'kind' => 'diploma', 'id' => $primaryId, 'app' => (int) $appId, 'mtype' => '',
        'type_label' => 'Письмо с дипломами',
        'who' => $who, 'email' => (string) $first['email'], 'phone' => (string) ($first['phone'] ?? ''),
        'comp' => (string) $first['comp_name'], 'number' => (string) $first['app_number'],
        'title' => $title,
        'dip_ids' => implode(',', array_map(fn($x) => (int) $x['id'], $items)),
        'when' => (string) ($when ?? ''),
        'search' => mb_strtolower(trim("$who {$first['email']} {$first['phone']} {$first['comp_name']} {$first['app_number']} " . implode(' ', array_column($items, 'result')))),
        'raw' => $first,
    ];
}
foreach ($resultsRaw as $r) {
    $who = $r['is_group'] ? (string) $r['group_name'] : (string) $r['full_name'];
    $queue[] = [
        'kind' => 'result', 'id' => (int) $r['id'], 'mtype' => '',
        'type_label' => 'Результат',
        'who' => $who, 'email' => (string) $r['email'], 'phone' => (string) ($r['phone'] ?? ''),
        'comp' => (string) $r['comp_name'], 'number' => (string) $r['number'],
        'title' => 'Результат: ' . (string) $r['result'],
        'when' => (string) ($r['result_send_at'] ?? ''),
        'search' => mb_strtolower(trim("$who {$r['email']} {$r['phone']} {$r['comp_name']} {$r['number']} {$r['result']} результат")),
        'raw' => $r,
    ];
}
foreach ($mailsRaw as $m) {
    $mt = disp_mail_type($m);
    $bodyText = trim(preg_replace('~\s+~u', ' ', strip_tags((string) ($m['body'] ?? ''))));
    $queue[] = [
        'kind' => 'mail', 'id' => (int) $m['id'], 'mtype' => $mt,
        'type_label' => DISP_MAIL_TYPES[$mt] ?? $mt,
        'who' => (string) ($m['to_name'] ?? ''), 'email' => (string) $m['to_email'], 'phone' => '',
        'comp' => '', 'number' => '',
        'title' => (string) $m['subject'],
        'when' => (string) ($m['scheduled_at'] ?? ''),
        'priority' => (int) ($m['priority'] ?? 0),
        'search' => mb_strtolower(trim("{$m['to_email']} {$m['to_name']} {$m['subject']} " . mb_substr($bodyText, 0, 600))),
        'raw' => $m,
    ];
}
foreach ($ordersRaw as $o) {
    $anchor = trim((string) ($o['dispatched_at'] ?? '')) ?: trim((string) ($o['created_at'] ?? $now));
    $itemsText = '';
    $decoded = json_decode((string) ($o['items'] ?? '[]'), true);
    if (is_array($decoded)) $itemsText = implode(', ', array_map(fn($it) => (string) ($it['item'] ?? ''), $decoded));
    $queue[] = [
        'kind' => 'order', 'id' => (int) $o['id'], 'mtype' => '',
        'type_label' => 'Заказ оригиналов',
        'who' => (string) $o['full_name'], 'email' => (string) ($o['email'] ?? ''), 'phone' => (string) ($o['phone'] ?? ''),
        'comp' => (string) ($o['competition'] ?? ''), 'number' => (string) $o['id'],
        'title' => (string) ($o['result'] ?? '') . ($itemsText !== '' ? ' · ' . $itemsText : ''),
        'when' => disp_add_workdays($anchor, $shipDays),
        'status' => (string) $o['status'],
        'search' => mb_strtolower(trim("{$o['full_name']} {$o['email']} {$o['phone']} {$o['competition']} {$o['result']} {$itemsText} №{$o['id']}")),
        'raw' => $o + ['_anchor' => $anchor],
    ];
}

/* ---- Применяем фильтр + поиск ---- */
$queueF = array_values(array_filter($queue, fn($it) => $matchType($it) && $matchSearch($it)));
/* Сортировка очереди по плановому времени (просроченные и «сразу» — вверху). */
usort($queueF, function ($a, $b) {
    $ta = strtotime($a['when'] ?: '') ?: 0;
    $tb = strtotime($b['when'] ?: '') ?: 0;
    if ($ta === 0 && $tb !== 0) return -1;
    if ($tb === 0 && $ta !== 0) return 1;
    return $ta <=> $tb;
});

/* ---- Архив: нормализация + фильтр/поиск ---- */
$archive = [];
foreach ($sentRaw as $m) {
    $mt = disp_mail_type($m);
    $bodyText = trim(preg_replace('~\s+~u', ' ', strip_tags((string) ($m['body'] ?? ''))));
    $archive[] = [
        'kind' => 'mail', 'id' => (int) $m['id'], 'mtype' => $mt,
        'type_label' => DISP_MAIL_TYPES[$mt] ?? $mt,
        'who' => (string) ($m['to_name'] ?? ''), 'email' => (string) $m['to_email'],
        'title' => (string) $m['subject'], 'sent_at' => (string) ($m['sent_at'] ?? ''),
        'search' => mb_strtolower(trim("{$m['to_email']} {$m['to_name']} {$m['subject']} " . mb_substr($bodyText, 0, 600))),
    ];
}
$archiveKeep = function (array $it) use ($f): bool {
    // Архив — только письма. Фильтры «дипломы к отправке»/«заказы» его не касаются.
    if ($f === 'all' || $f === 'mail') return true;
    if (in_array($f, ['diploma', 'order'], true)) return false;
    return ($it['mtype'] ?? '') === $f; // подтип письма
};
$archiveF = array_values(array_filter($archive, fn($it) => $archiveKeep($it) && $matchSearch($it)));

$countQueue = count($queueF);
$countArch  = count($archiveF);

/* ---- Хелперы рендера строки очереди ---- */
$rowWhen = function (array $it): string {
    if ($it['kind'] === 'mail') {
        $prio = (int) ($it['priority'] ?? 0);
        [$wc, $wl] = $it['when'] !== '' ? disp_when_badge($it['when']) : ['#1E9E5A', $prio === 0 ? 'сразу' : 'по плану'];
    } else {
        [$wc, $wl] = disp_when_badge($it['when']);
    }
    return '<span class="disp-when" style="background:' . $wc . '">' . h($wl) . '</span>';
};

ob_start(); ?>
<style>
.disp-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:16px}
.disp-toolbar .field{margin:0}
.disp-when{display:inline-block;padding:4px 10px;border-radius:999px;color:#fff;font-size:12px;font-weight:700;white-space:nowrap}
.disp-typechip{display:inline-block;padding:3px 9px;border-radius:8px;font-size:11px;font-weight:700;letter-spacing:.02em;white-space:nowrap}
.disp-typechip.k-result{background:#E7F7EE;color:#1E7A44}
.disp-typechip.k-diploma{background:#EAF1FF;color:#17307A}
.disp-typechip.k-mail{background:#F0EAFE;color:#5B36B0}
.disp-typechip.k-order{background:#FBF1DA;color:#8B6F1F}
.disp-acts{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.disp-acts input[type=datetime-local],.disp-acts input[type=text]{padding:5px 8px;border:1px solid var(--a-line);border-radius:8px;font-size:12px}
tr.disp-row.gone{opacity:0;transition:.4s}
/* Тост */
#dispToast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(30px);z-index:300;
  background:#17307A;color:#fff;padding:12px 22px;border-radius:12px;font-size:14px;font-weight:600;
  box-shadow:0 14px 40px rgba(0,0,0,.35);opacity:0;pointer-events:none;transition:.28s;max-width:90vw;text-align:center}
#dispToast.show{opacity:1;transform:translateX(-50%) translateY(0)}
#dispToast.err{background:#C0392B}
/* Модал редактора письма */
#mailEditor,#dipEditor{position:fixed;inset:0;z-index:280;display:none;align-items:flex-start;justify-content:center;
  background:rgba(12,10,20,.55);padding:24px 12px;overflow:auto}
#mailEditor.show,#dipEditor.show{display:flex}
#mailEditor .box,#dipEditor .box{background:#fff;color:#111;border-radius:18px;max-width:720px;width:100%;box-shadow:0 24px 70px rgba(0,0,0,.4);
  overflow:hidden;animation:meIn .24s cubic-bezier(.2,.9,.3,1.15)}
@keyframes meIn{from{transform:translateY(14px) scale(.98);opacity:0}to{transform:none;opacity:1}}
#mailEditor .box-head,#dipEditor .box-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #E6E9F2}
#mailEditor .box-head h3,#dipEditor .box-head h3{margin:0;font-size:17px;color:#17307A}
#mailEditor .box-body,#dipEditor .box-body{padding:18px 20px;max-height:70vh;overflow:auto}
#mailEditor label,#dipEditor label{display:block;font-size:12px;color:#6B7699;margin:12px 0 4px;font-weight:600}
#mailEditor input[type=text],#mailEditor input[type=email],#mailEditor input[type=datetime-local],
#dipEditor input[type=text],#dipEditor input[type=datetime-local]{
  width:100%;padding:9px 12px;border:1px solid #D6DCEC;border-radius:10px;font-size:14px}
#meToolbar{display:flex;gap:5px;flex-wrap:wrap;margin:4px 0 6px}
#meToolbar button{padding:6px 11px;border:1px solid #D6DCEC;border-radius:8px;background:#F7F8FC;cursor:pointer;font-size:13px;font-weight:700}
#meToolbar button:hover{background:#ECEFF8}
#meBody{min-height:200px;max-height:360px;overflow:auto;padding:12px 14px;border:1px solid #D6DCEC;border-radius:10px;
  background:#fff;color:#111;font-size:14px;line-height:1.6}
#meBody a{color:#17307A}
#mailEditor .box-foot,#dipEditor .box-foot{display:flex;gap:10px;justify-content:flex-end;padding:14px 20px;border-top:1px solid #E6E9F2;background:#FAFBFF}
.me-hint{font-size:12px;color:#8892B0;margin-top:4px}
@media (max-width:640px){#mailEditor .box-foot,#dipEditor .box-foot{position:sticky;bottom:0}}
</style>

<div class="page-head">
  <h1>Отправки · живой пульт</h1>
  <p class="muted small">Единый список всего, что уходит автоматически: дипломы после оценки, письма из очереди, оригиналы наград после оплаты. Фильтр и поиск — сверху. Действия применяются без перезагрузки страницы.</p>
</div>

<form method="get" class="filters disp-toolbar" id="dispFilter">
  <input type="hidden" name="p" value="dispatch">
  <div class="field"><label>Поиск</label>
    <input name="q" value="<?= h($q) ?>" placeholder="ФИО, почта, телефон, конкурс, №, тема или текст письма" style="min-width:280px">
  </div>
  <div class="field"><label>Тип</label>
    <select name="f" onchange="this.form.submit()">
      <?php foreach ($filters as $fk => $fl): ?>
        <option value="<?= h($fk) ?>" <?= $f === $fk ? 'selected' : '' ?>><?= h($fl) ?></option>
      <?php endforeach; ?>
    </select>
  </div>
  <button class="btn btn--primary btn--sm"><?= admin_icon('search') ?>Поиск</button>
  <?php if ($q !== '' || $f !== 'all'): ?><a class="btn btn--ghost btn--sm" href="<?= a_link('dispatch') ?>">Сброс</a><?php endif; ?>
</form>

<div class="tabs" style="margin-bottom:14px;display:flex;gap:6px;flex-wrap:wrap;">
  <a class="tag active" href="#queue" style="padding:7px 13px;border-radius:10px;">В очереди · <?= $countQueue ?></a>
  <a class="tag" href="#arch" style="padding:7px 13px;border-radius:10px;">Архив отправленных · <?= $countArch ?></a>
</div>

<!-- ============ ЕДИНАЯ ОЧЕРЕДЬ ============ -->
<div class="card" id="queue" style="margin-bottom:20px;">
  <div class="section-title" style="margin-bottom:8px"><h3>В очереди</h3></div>
  <p class="small muted" style="margin:-4px 0 12px">По каждой строке: изменить дату/время, отправить сейчас, отменить, а письма — отредактировать (кнопка «✎»). Всё сохраняется на месте.</p>
  <?php if (!$queueF): ?>
    <p class="muted">По этому фильтру в очереди пусто.</p>
  <?php else: ?>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Тип</th><th>Кому</th><th>Что</th><th>Когда</th><th>Действия</th></tr></thead>
    <tbody>
    <?php foreach ($queueF as $it): $k = $it['kind']; $iid = $it['id']; $rid = "row-$k-$iid"; ?>
      <tr class="disp-row" id="<?= $rid ?>">
        <td>
          <span class="disp-typechip k-<?= $k ?>"><?= h($it['type_label']) ?></span>
          <?php if ($k === 'mail'): ?><br><span class="badge <?= ($it['priority']??0)===0?'badge--paid':'badge--muted' ?> small" style="margin-top:4px"><?= ($it['priority']??0)===0?'транз.':'массов.' ?></span><?php endif; ?>
        </td>
        <td class="small">
          <b><?= h($it['who'] ?: '—') ?></b>
          <?php if ($it['email']): ?><br><span class="muted"><?= h($it['email']) ?></span><?php endif; ?>
          <?php if (!empty($it['number']) && $k !== 'order'): ?><br><span class="muted">№<?= h($it['number']) ?></span><?php endif; ?>
          <?php if ($k === 'order'): ?><br><span class="muted">Заказ №<?= h($it['number']) ?></span><?php endif; ?>
        </td>
        <td class="small"><?= h(mb_strimwidth($it['title'], 0, 70, '…')) ?><?php if ($it['comp']): ?><br><span class="muted"><?= h($it['comp']) ?></span><?php endif; ?></td>
        <td><span class="disp-when-cell"><?= $rowWhen($it) ?></span></td>
        <td>
          <div class="disp-acts">
          <?php if ($k === 'result'): ?>
            <input type="datetime-local" id="w-<?= $rid ?>" value="<?= h($it['when'] ? date('Y-m-d\TH:i', strtotime($it['when'])) : '') ?>">
            <button class="btn btn--ghost btn--sm" data-act="resched" data-kind="result" data-id="<?= $iid ?>" data-when="w-<?= $rid ?>" data-row="<?= $rid ?>" title="Перенести отправку результата">OK</button>
            <button class="btn btn--primary btn--sm" data-act="sendnow" data-kind="result" data-id="<?= $iid ?>" data-row="<?= $rid ?>" data-confirm="Отправить результат участнику сейчас?"><?= admin_icon('send') ?>Сейчас</button>
            <button class="btn btn--ghost btn--sm" data-act="cancel" data-kind="result" data-id="<?= $iid ?>" data-row="<?= $rid ?>" data-confirm="Отменить плановую отправку результата?" style="color:#C0392B;border-color:#C0392B"><?= admin_icon('trash') ?></button>
          <?php elseif ($k === 'diploma'): $appId = (int)($it['app'] ?? 0); ?>
            <input type="datetime-local" id="w-<?= $rid ?>" value="<?= h($it['when'] ? date('Y-m-d\TH:i', strtotime($it['when'])) : '') ?>">
            <button class="btn btn--ghost btn--sm" data-act="resched" data-kind="diploma" data-id="<?= $iid ?>" data-app="<?= $appId ?>" data-when="w-<?= $rid ?>" data-row="<?= $rid ?>" title="Изменить дату/время (всё письмо)">OK</button>
            <button class="btn btn--primary btn--sm" data-act="sendnow" data-kind="diploma" data-id="<?= $iid ?>" data-app="<?= $appId ?>" data-row="<?= $rid ?>" data-confirm="Отправить письмо со всеми дипломами этой заявки сейчас?"><?= admin_icon('send') ?>Сейчас</button>
            <button class="btn btn--ghost btn--sm" data-act="editdip" data-id="<?= $iid ?>" data-row="<?= $rid ?>" title="Редактировать дипломы заявки (данные + предпросмотр)"><?= admin_icon('edit') ?></button>
            <a class="btn btn--ghost btn--sm" href="<?= h(url('/diploma-view/'.rawurlencode((string)$it['number']))) ?>" target="_blank" rel="noopener" title="Предпросмотр диплома"><?= admin_icon('eye') ?></a>
            <button class="btn btn--ghost btn--sm" data-act="cancel" data-kind="diploma" data-id="<?= $iid ?>" data-app="<?= $appId ?>" data-row="<?= $rid ?>" data-confirm="Отменить отправку письма со всеми дипломами этой заявки?" style="color:#C0392B;border-color:#C0392B"><?= admin_icon('trash') ?></button>
          <?php elseif ($k === 'mail'): ?>
            <input type="datetime-local" id="w-<?= $rid ?>" value="<?= h($it['when'] ? date('Y-m-d\TH:i', strtotime($it['when'])) : '') ?>">
            <button class="btn btn--ghost btn--sm" data-act="resched" data-kind="mail" data-id="<?= $iid ?>" data-when="w-<?= $rid ?>" data-row="<?= $rid ?>" title="Изменить/держать">OK</button>
            <button class="btn btn--primary btn--sm" data-act="sendnow" data-kind="mail" data-id="<?= $iid ?>" data-row="<?= $rid ?>"><?= admin_icon('send') ?>Сейчас</button>
            <button class="btn btn--ghost btn--sm" data-act="editmail" data-id="<?= $iid ?>" data-row="<?= $rid ?>" title="Редактировать письмо"><?= admin_icon('edit') ?></button>
            <a class="btn btn--ghost btn--sm" href="<?= a_link('dispatch', ['do'=>'view','kind'=>'mail','id'=>$iid]) ?>" target="_blank" rel="noopener" title="Открыть письмо"><?= admin_icon('eye') ?></a>
            <button class="btn btn--ghost btn--sm" data-act="cancel" data-kind="mail" data-id="<?= $iid ?>" data-row="<?= $rid ?>" data-confirm="Отменить письмо?" style="color:#C0392B;border-color:#C0392B"><?= admin_icon('trash') ?></button>
          <?php elseif ($k === 'order'): $st = $it['status'] ?? 'paid'; ?>
            <?php if ($st === 'paid'): ?>
              <button class="btn btn--navy btn--sm" data-act="made" data-kind="order" data-id="<?= $iid ?>" data-row="<?= $rid ?>"><?= admin_icon('check') ?>Изготовлено</button>
            <?php endif; ?>
            <?php if (in_array($st, ['paid','made'], true)): ?>
              <input type="text" id="trk-<?= $rid ?>" placeholder="Трек-номер" style="min-width:150px">
              <button class="btn btn--primary btn--sm" data-act="ship" data-kind="order" data-id="<?= $iid ?>" data-track="trk-<?= $rid ?>" data-row="<?= $rid ?>"><?= admin_icon('truck') ?>Отправить</button>
            <?php endif; ?>
            <button class="btn btn--ghost btn--sm" data-act="redispatch" data-kind="order" data-id="<?= $iid ?>" data-row="<?= $rid ?>"><?= admin_icon('send') ?>В производство</button>
          <?php endif; ?>
          </div>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
  <?php endif; ?>
</div>

<!-- ============ АРХИВ ОТПРАВЛЕННЫХ ============ -->
<div class="card" id="arch" style="margin-bottom:20px;">
  <div class="section-title" style="margin-bottom:8px"><h3>Архив отправленных · <?= $countArch ?></h3></div>
  <p class="small muted" style="margin:-4px 0 12px">Что реально ушло. «Просмотр» — открыть письмо; «Дублировать» — отправить как есть; «Изменить и дублировать» — открыть в редакторе, поправить и отправить новой копией.</p>
  <?php if (!$archiveF): ?>
    <p class="muted">По этому фильтру в архиве пусто.</p>
  <?php else: ?>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Тип</th><th>Кому</th><th>Тема</th><th>Отправлено</th><th>Действия</th></tr></thead>
    <tbody>
    <?php foreach ($archiveF as $it): $iid = $it['id']; $rid = "arch-$iid"; ?>
      <tr class="disp-row" id="<?= $rid ?>">
        <td><span class="disp-typechip k-mail"><?= h($it['type_label']) ?></span></td>
        <td class="small"><?= h($it['email']) ?><?= $it['who'] ? '<br><span class="muted">'.h($it['who']).'</span>' : '' ?></td>
        <td class="small"><?= h(mb_strimwidth($it['title'], 0, 66, '…')) ?></td>
        <td class="small muted"><?= h($it['sent_at']) ?></td>
        <td>
          <div class="disp-acts">
            <a class="btn btn--ghost btn--sm" href="<?= a_link('dispatch', ['do'=>'view','kind'=>'mail','id'=>$iid]) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Просмотр</a>
            <button class="btn btn--navy btn--sm" data-act="editdup" data-id="<?= $iid ?>"><?= admin_icon('edit') ?>Изменить и дублировать</button>
            <button class="btn btn--ghost btn--sm" data-act="dup" data-kind="mail" data-id="<?= $iid ?>" data-confirm="Отправить это письмо ещё раз как есть?"><?= admin_icon('copy') ?>Дублировать</button>
          </div>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
  <?php endif; ?>
</div>

<!-- ============ ТОСТ + МОДАЛ РЕДАКТОРА ПИСЬМА ============ -->
<div id="dispToast"></div>

<div id="mailEditor" aria-hidden="true">
  <div class="box" role="dialog" aria-modal="true" aria-labelledby="meTitle">
    <div class="box-head">
      <h3 id="meTitle">Редактирование письма</h3>
      <button type="button" class="btn btn--ghost btn--sm" data-me="close" aria-label="Закрыть"><?= admin_icon('x') ?></button>
    </div>
    <div class="box-body">
      <input type="hidden" id="meId"><input type="hidden" id="meMode">
      <label>Кому (email)</label>
      <input type="email" id="meTo" placeholder="participant@example.com">
      <label>Имя получателя</label>
      <input type="text" id="meName" placeholder="Необязательно">
      <label>Тема письма</label>
      <input type="text" id="meSubject" placeholder="Тема">
      <label>Дата и время отправки <span class="me-hint" style="display:inline">— пусто = уйдёт сразу; не трогайте, чтобы оставить запланированное</span></label>
      <input type="datetime-local" id="meSched" data-touched="0">
      <label>Текст письма</label>
      <div id="meToolbar">
        <button type="button" data-cmd="bold" title="Жирный">Ж</button>
        <button type="button" data-cmd="italic" title="Курсив" style="font-style:italic">К</button>
        <button type="button" data-cmd="underline" title="Подчёркнутый" style="text-decoration:underline">П</button>
        <button type="button" data-cmd="insertUnorderedList" title="Список">•</button>
        <button type="button" data-cmd="link" title="Текстовая ссылка">Ссылка</button>
        <button type="button" data-cmd="button" title="Кнопка со ссылкой">Кнопка</button>
        <button type="button" data-cmd="editlink" title="Изменить ссылку/кнопку под курсором">Изменить ссылку</button>
      </div>
      <div id="meBody" contenteditable="true"></div>
      <label>Вложение (ссылка/путь; пусто = без вложения)</label>
      <input type="text" id="meAttach" placeholder="https://…">
    </div>
    <div class="box-foot">
      <button type="button" class="btn btn--ghost" data-me="close">Отмена</button>
      <button type="button" class="btn btn--primary" id="meSave"><?= admin_icon('check') ?>Сохранить</button>
    </div>
  </div>
</div>

<!-- ============ МОДАЛ РЕДАКТОРА ДИПЛОМА ============ -->
<div id="dipEditor" aria-hidden="true">
  <div class="box" role="dialog" aria-modal="true" aria-labelledby="deTitle">
    <div class="box-head">
      <h3 id="deTitle">Редактирование диплома</h3>
      <button type="button" class="btn btn--ghost btn--sm" data-de="close" aria-label="Закрыть"><?= admin_icon('x') ?></button>
    </div>
    <div class="box-body">
      <input type="hidden" id="deId">
      <p class="small muted" style="margin:0 0 10px">Диплом собирается строго из заявки. Правьте данные ниже — PDF пересоберётся. Проверяйте предпросмотром. Изменения затрагивают все дипломы этой заявки.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <a id="dePreview" class="btn btn--navy btn--sm" href="#" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Предпросмотр диплома</a>
        <a id="dePdf" class="btn btn--ghost btn--sm" href="#" target="_blank" rel="noopener"><?= admin_icon('download') ?>PDF</a>
      </div>
      <label style="display:flex;align-items:center;gap:8px;font-weight:600"><input type="checkbox" id="deGroup" style="width:auto"> Коллектив (ансамбль/хор)</label>
      <div id="deGroupRow"><label>Название коллектива (в шапке диплома)</label><input type="text" id="deGroupName" placeholder="Например: Образцовый ансамбль…"></div>
      <label>ФИО участника / контактное лицо (для соло — идёт в шапку; для коллектива на диплом не выводится)</label>
      <input type="text" id="deFullName" placeholder="Фамилия Имя Отчество">
      <label>Педагог(и) — если несколько, через запятую (станет «Педагоги: …»)</label>
      <input type="text" id="deTeacher" placeholder="Иванов И.И., Петров П.П.">
      <label>Номинация</label><input type="text" id="deNomination">
      <label>Возрастная категория</label><input type="text" id="deAge">
      <label>Конкурсный номер</label><input type="text" id="deWork">
      <label>Итог (степень) — для основного диплома</label><input type="text" id="deResult" placeholder="ЛАУРЕАТ I СТЕПЕНИ">
      <label>Спец-номинация — для дополнительного диплома</label><input type="text" id="deExtra" placeholder="ЗА АРТИСТИЗМ">
      <label>Дата и время отправки <span class="me-hint" style="display:inline">— не трогайте, чтобы оставить запланированное</span></label>
      <input type="datetime-local" id="deSched" data-touched="0">
    </div>
    <div class="box-foot">
      <button type="button" class="btn btn--ghost" data-de="close">Отмена</button>
      <button type="button" class="btn btn--primary" id="deSave"><?= admin_icon('check') ?>Сохранить диплом</button>
    </div>
  </div>
</div>

<script>
(function(){
  var CSRF = <?= json_encode(csrf_token()) ?>;
  var POST_URL = <?= json_encode(url('/admin/?p=dispatch')) ?>;
  var GET_URL  = <?= json_encode(a_link('dispatch')) ?>;

  function toast(msg, isErr){
    var t=document.getElementById('dispToast'); t.textContent=msg;
    t.className = isErr ? 'show err' : 'show';
    clearTimeout(t._h); t._h=setTimeout(function(){ t.className=''; }, 3600);
  }
  function post(data){
    var fd=new FormData();
    fd.append('ajax','1'); fd.append('_csrf',CSRF);
    for(var k in data){ if(data[k]!==undefined && data[k]!==null) fd.append(k,data[k]); }
    return fetch(POST_URL,{method:'POST',credentials:'same-origin',body:fd})
      .then(function(r){return r.json();});
  }
  function removeRow(id){
    var row=document.getElementById(id); if(!row) return;
    row.classList.add('gone'); setTimeout(function(){ if(row&&row.parentNode) row.parentNode.removeChild(row); },400);
  }
  function setWhen(rowId, label){
    var row=document.getElementById(rowId); if(!row) return;
    var cell=row.querySelector('.disp-when-cell'); if(!cell) return;
    var col = /сейчас|уход/i.test(label) ? '#C0392B' : (/сразу/i.test(label)?'#1E9E5A':'#2C7BE5');
    cell.innerHTML='<span class="disp-when" style="background:'+col+'">'+label.replace(/</g,'&lt;')+'</span>';
  }

  /* ---- Делегированные действия по строкам ---- */
  document.addEventListener('click', function(e){
    var b=e.target.closest('[data-act]'); if(!b) return;
    var act=b.getAttribute('data-act');

    if(act==='editmail'){ e.preventDefault(); openEditor(b.getAttribute('data-id'),'edit'); return; }
    if(act==='editdup'){ e.preventDefault(); openEditor(b.getAttribute('data-id'),'duplicate'); return; }
    if(act==='editdip'){ e.preventDefault(); openDip(b.getAttribute('data-id')); return; }

    var kind=b.getAttribute('data-kind'), id=b.getAttribute('data-id'), row=b.getAttribute('data-row');
    var conf=b.getAttribute('data-confirm');
    if(conf && !confirm(conf)) return;
    e.preventDefault();

    var doMap={sendnow:'sendnow',cancel:'cancel',resched:'resched',dup:'duplicate',
               made:'made',ship:'ship',redispatch:'redispatch'};
    var payload={kind:kind,id:id,do:doMap[act]};
    // Дипломы: действие применяется ко всей заявке (одно письмо) — передаём app.
    var appAttr=b.getAttribute('data-app'); if(appAttr && appAttr!=='0') payload.app=appAttr;

    if(act==='resched'){ var wi=document.getElementById(b.getAttribute('data-when')); payload.scheduled_at = wi?wi.value:''; }
    if(act==='ship'){ var ti=document.getElementById(b.getAttribute('data-track')); if(!ti||!ti.value.trim()){toast('Введите трек-номер',true);return;} payload.tracking=ti.value.trim(); }

    b.disabled=true;
    post(payload).then(function(res){
      b.disabled=false;
      toast(res.msg||(res.ok?'Готово':'Ошибка'), !res.ok);
      if(!res.ok) return;
      if(res.remove && row){ removeRow(row); return; }
      if(res.when && row){ setWhen(row, res.when); }
      if(act==='made' && row){ var chip=document.querySelector('#'+row+' .disp-typechip'); /* статус обновится при перезагрузке */ }
      if(act==='dup'){ /* остаётся в архиве, копия ушла в очередь */ }
    }).catch(function(){ b.disabled=false; toast('Сеть недоступна, повторите',true); });
  });

  /* ================= РЕДАКТОР ПИСЬМА ================= */
  var M={ov:document.getElementById('mailEditor'),id:document.getElementById('meId'),mode:document.getElementById('meMode'),
    to:document.getElementById('meTo'),name:document.getElementById('meName'),subject:document.getElementById('meSubject'),
    sched:document.getElementById('meSched'),body:document.getElementById('meBody'),attach:document.getElementById('meAttach'),
    title:document.getElementById('meTitle'),save:document.getElementById('meSave')};

  function closeEditor(){ M.ov.classList.remove('show'); M.ov.setAttribute('aria-hidden','true'); }
  function openEditor(id, mode){
    M.id.value=id; M.mode.value=mode;
    M.title.textContent = mode==='duplicate' ? 'Изменить и дублировать письмо' : 'Редактирование письма в очереди';
    M.sched.setAttribute('data-touched','0');
    M.to.value='';M.name.value='';M.subject.value='';M.sched.value='';M.body.innerHTML='<p>Загрузка…</p>';M.attach.value='';
    M.ov.classList.add('show'); M.ov.setAttribute('aria-hidden','false');
    fetch(GET_URL+'&do=get&kind=mail&id='+encodeURIComponent(id),{credentials:'same-origin'})
      .then(function(r){return r.json();}).then(function(d){
        if(!d.ok){ toast(d.error||'Не удалось загрузить письмо',true); closeEditor(); return; }
        M.to.value=d.to_email||''; M.name.value=d.to_name||''; M.subject.value=d.subject||'';
        M.sched.value=d.scheduled_at||''; M.body.innerHTML=d.body||''; M.attach.value=d.attach||'';
      }).catch(function(){ toast('Сеть недоступна',true); closeEditor(); });
  }
  M.sched.addEventListener('input', function(){ this.setAttribute('data-touched','1'); });

  M.ov.addEventListener('click', function(e){
    if(e.target===M.ov || e.target.closest('[data-me="close"]')) closeEditor();
  });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && M.ov.classList.contains('show')) closeEditor(); });

  /* ================= РЕДАКТОР ДИПЛОМА ================= */
  var D={ov:document.getElementById('dipEditor'),id:document.getElementById('deId'),
    group:document.getElementById('deGroup'),groupRow:document.getElementById('deGroupRow'),groupName:document.getElementById('deGroupName'),
    fullName:document.getElementById('deFullName'),teacher:document.getElementById('deTeacher'),nomination:document.getElementById('deNomination'),
    age:document.getElementById('deAge'),work:document.getElementById('deWork'),result:document.getElementById('deResult'),extra:document.getElementById('deExtra'),
    sched:document.getElementById('deSched'),preview:document.getElementById('dePreview'),pdf:document.getElementById('dePdf'),save:document.getElementById('deSave')};
  function closeDip(){ D.ov.classList.remove('show'); D.ov.setAttribute('aria-hidden','true'); }
  function syncGroup(){ D.groupRow.style.display = D.group.checked ? 'block' : 'none'; }
  function openDip(id){
    D.id.value=id; D.sched.setAttribute('data-touched','0');
    ['groupName','fullName','teacher','nomination','age','work','result','extra'].forEach(function(k){ D[k].value=''; });
    D.group.checked=false; syncGroup(); D.sched.value='';
    D.ov.classList.add('show'); D.ov.setAttribute('aria-hidden','false');
    fetch(GET_URL+'&do=dip_get&kind=diploma&id='+encodeURIComponent(id),{credentials:'same-origin'})
      .then(function(r){return r.json();}).then(function(d){
        if(!d.ok){ toast(d.error||'Не удалось загрузить диплом',true); closeDip(); return; }
        D.group.checked = d.is_group==1; syncGroup();
        D.groupName.value=d.group_name||''; D.fullName.value=d.full_name||''; D.teacher.value=d.teacher||'';
        D.nomination.value=d.nomination||''; D.age.value=d.age_category||''; D.work.value=d.work_title||'';
        D.result.value=d.result||''; D.extra.value=d.extra_diploma||''; D.sched.value=d.scheduled_at||'';
        D.preview.href=d.preview||'#'; D.pdf.href=d.pdf||'#';
      }).catch(function(){ toast('Сеть недоступна',true); closeDip(); });
  }
  D.group.addEventListener('change', syncGroup);
  D.sched.addEventListener('input', function(){ this.setAttribute('data-touched','1'); });
  D.ov.addEventListener('click', function(e){ if(e.target===D.ov || e.target.closest('[data-de="close"]')) closeDip(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape' && D.ov.classList.contains('show')) closeDip(); });
  D.save.addEventListener('click', function(){
    var payload={kind:'diploma',do:'dip_save',id:D.id.value,
      is_group:D.group.checked?'1':'0',group_name:D.groupName.value.trim(),full_name:D.fullName.value.trim(),
      teacher:D.teacher.value.trim(),nomination:D.nomination.value.trim(),age_category:D.age.value.trim(),
      work_title:D.work.value.trim(),result:D.result.value.trim(),extra_diploma:D.extra.value.trim()};
    if(D.sched.getAttribute('data-touched')==='1'){ payload.sched_touched='1'; payload.scheduled_at=D.sched.value; }
    D.save.disabled=true;
    post(payload).then(function(res){ D.save.disabled=false; toast(res.msg||(res.ok?'Готово':'Ошибка'),!res.ok);
      if(res.ok){ closeDip(); } }).catch(function(){ D.save.disabled=false; toast('Сеть недоступна, повторите',true); });
  });

  /* Панель форматирования */
  function anchorUnder(){
    var s=window.getSelection(); if(!s.rangeCount) return null;
    var n=s.anchorNode; while(n && n!==M.body){ if(n.nodeType===1 && n.tagName==='A') return n; n=n.parentNode; }
    return null;
  }
  var BTN_STYLE="display:inline-block;background:#17307A;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700";
  document.getElementById('meToolbar').addEventListener('click', function(e){
    var b=e.target.closest('[data-cmd]'); if(!b) return; e.preventDefault();
    var cmd=b.getAttribute('data-cmd'); M.body.focus();
    if(cmd==='link' || cmd==='editlink'){
      var a=anchorUnder(); var sel=window.getSelection().toString();
      var text=prompt('Текст ссылки:', a?a.textContent:(sel||'ссылка')); if(text===null) return;
      var url=prompt('Адрес (URL):', a?a.getAttribute('href'):'https://'); if(url===null) return;
      if(a){ a.textContent=text; a.setAttribute('href',url); }
      else { document.execCommand('insertHTML',false,'<a href="'+esc(url)+'">'+esc(text)+'</a>'); }
    } else if(cmd==='button'){
      var a2=anchorUnder(); var sel2=window.getSelection().toString();
      var t2=prompt('Текст кнопки:', a2?a2.textContent:(sel2||'Кнопка')); if(t2===null) return;
      var u2=prompt('Ссылка кнопки (URL):', a2?a2.getAttribute('href'):'https://'); if(u2===null) return;
      if(a2){ a2.textContent=t2; a2.setAttribute('href',u2); a2.setAttribute('style',BTN_STYLE); }
      else { document.execCommand('insertHTML',false,'<a href="'+esc(u2)+'" style="'+BTN_STYLE+'">'+esc(t2)+'</a>'); }
    } else {
      document.execCommand(cmd,false,null);
    }
    M.body.focus();
  });
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* Сохранить */
  M.save.addEventListener('click', function(){
    var mode=M.mode.value, id=M.id.value;
    if(!M.to.value.trim()){ toast('Укажите email получателя',true); M.to.focus(); return; }
    if(!M.subject.value.trim()){ toast('Укажите тему',true); M.subject.focus(); return; }
    var payload={kind:'mail',id:id,to_email:M.to.value.trim(),to_name:M.name.value.trim(),
      subject:M.subject.value.trim(),body:M.body.innerHTML,attach:M.attach.value.trim()};
    if(mode==='duplicate'){
      payload.do='duplicate_edit'; payload.scheduled_at=M.sched.value;
    } else {
      payload.do='edit';
      if(M.sched.getAttribute('data-touched')==='1'){ payload.sched_touched='1'; payload.scheduled_at=M.sched.value; }
    }
    M.save.disabled=true;
    post(payload).then(function(res){
      M.save.disabled=false;
      toast(res.msg||(res.ok?'Сохранено':'Ошибка'), !res.ok);
      if(!res.ok) return;
      if(mode==='edit'){
        var row=document.getElementById('row-mail-'+id);
        if(row){
          if(res.subject){ var c=row.children[2]; if(c) c.innerHTML=res.subject.replace(/</g,'&lt;'); }
          if(res.to_email){ var e0=row.children[1]; if(e0){ var mm=e0.querySelector('.muted'); } }
          if(res.when){ setWhen('row-mail-'+id, res.when); }
        }
      }
      closeEditor();
    }).catch(function(){ M.save.disabled=false; toast('Сеть недоступна',true); });
  });
})();
</script>
<?php
$content = ob_get_clean();
admin_layout('Отправки', $content, 'dispatch');
