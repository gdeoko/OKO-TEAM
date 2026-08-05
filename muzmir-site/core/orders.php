<?php
/**
 * core/orders.php — фулфилмент заказов ОРИГИНАЛОВ наград.
 *
 * Поток: заказ оплачен → сразу собираем производственный пакет (что/сколько/фото,
 * адрес, телефон + ЧИСТЫЕ дипломы без подписи/печати, но с номером+QR) → в Telegram
 * ветку @zakaznagrad И в админку (раздел «Заказы оригиналов»). Центр печатает/подписывает/
 * отправляет сам; в админке вводит трек-номер → участнику красивое письмо «Отправлено
 * Почтой России + отследить» и статусы в личном кабинете.
 */
declare(strict_types=1);

require_once __DIR__ . '/mailer.php';

/** Мягкие миграции: таймстемпы этапов исполнения заказа + кэш чистых PDF. */
function orders_migrate(): void {
    foreach (['made_at', 'shipped_at', 'delivered_at', 'dispatched_at'] as $col) {
        try { db()->exec("ALTER TABLE awards_orders ADD COLUMN $col TEXT"); } catch (\Throwable $e) {}
    }
    try { db()->exec("ALTER TABLE awards_orders ADD COLUMN clean_pdfs TEXT DEFAULT ''"); } catch (\Throwable $e) {}
}

/** Кэшированные чистые дипломы заказа (для админки): читает сохранённые, иначе генерит и кэширует. */
function order_clean_pdfs(array $order, bool $regen = false): array {
    $oid = (int)($order['id'] ?? 0);
    $cached = json_decode((string)($order['clean_pdfs'] ?? ''), true);
    if (!$regen && is_array($cached) && $cached) {
        // проверяем, что файлы на месте
        $ok = true;
        foreach ($cached as $c) { if (empty($c['url'])) { $ok = false; break; } }
        if ($ok) return $cached;
    }
    $pdfs = order_generate_clean_pdfs($order);
    $store = array_map(fn($p) => ['label' => $p['label'], 'url' => $p['url'], 'type' => $p['type']], $pdfs);
    if ($oid > 0) update('awards_orders', ['clean_pdfs' => json_encode($store, JSON_UNESCAPED_UNICODE)], 'id=:id', ['id' => $oid]);
    return $store;
}

/** Ссылка на отслеживание Почты России по трек-номеру. */
function order_pochta_url(string $track): string {
    $track = trim($track);
    return $track !== '' ? 'https://www.pochta.ru/tracking#' . rawurlencode($track) : '';
}

/** Позиция заказа → фото награды (slug файла в assets/img/awards/<cid>/). */
function order_item_photo_slug(string $item): string {
    $i = mb_strtolower($item);
    if (mb_strpos($i, 'кубок') !== false)      return 'cup';
    if (mb_strpos($i, 'статуэт') !== false)    return 'statuette';
    if (mb_strpos($i, 'медал') !== false)      return 'medal';
    if (mb_strpos($i, 'именн') !== false)      return 'diploma-name';
    if (mb_strpos($i, 'дополнит') !== false)   return 'diploma2';
    if (mb_strpos($i, 'благодар') !== false)   return 'thanks';
    if (mb_strpos($i, 'диплом') !== false)     return 'diploma';
    return 'diploma';
}

/** Позиция заказа → тип диплома для рендера (main/extra/named/thanks) или '' если это физическая награда. */
function order_item_diploma_type(string $item): string {
    $i = mb_strtolower($item);
    if (mb_strpos($i, 'кубок') !== false || mb_strpos($i, 'статуэт') !== false || mb_strpos($i, 'медал') !== false) return '';
    if (mb_strpos($i, 'доставк') !== false) return '';
    if (mb_strpos($i, 'именн') !== false)    return 'named';
    if (mb_strpos($i, 'дополнит') !== false) return 'extra';
    if (mb_strpos($i, 'благодар') !== false) return 'thanks';
    if (mb_strpos($i, 'диплом') !== false)   return 'main';
    return '';
}

/** Разбор позиций заказа с агрегацией по количеству + фото + тип. */
function order_items_parse(array $order): array {
    $raw = json_decode((string)($order['items'] ?? ''), true);
    if (!is_array($raw)) $raw = [];
    $cid = 0;
    if (!empty($order['application_id'])) {
        $cid = (int) scalar("SELECT competition_id FROM applications WHERE id=?", [(int)$order['application_id']]);
    }
    if (!$cid) $cid = (int) scalar("SELECT id FROM competitions WHERE status='open' ORDER BY sort,id LIMIT 1");
    $base = rtrim((string) cfgv('base_url', ''), '/');
    $agg = [];
    foreach ($raw as $it) {
        if (!is_array($it)) continue;
        $name = trim((string)($it['item'] ?? ''));
        $kind = trim((string)($it['kind'] ?? 'original'));
        if ($name === '' || $kind === 'club') continue;
        $key = $kind . '|' . $name;
        if (!isset($agg[$key])) {
            $slug = order_item_photo_slug($name);
            $photo = '';
            foreach ([$cid] as $c) {
                $web = '/assets/img/awards/' . $c . '/' . $slug . '.jpg';
                if (is_file(BASE_PATH . '/public' . $web)) { $photo = $base . $web; break; }
            }
            $agg[$key] = [
                'item' => $name, 'kind' => $kind, 'count' => 0,
                'price' => (int)($it['price'] ?? 0),
                'photo' => $photo,
                'dtype' => $kind === 'original' ? order_item_diploma_type($name) : '',
                'physical' => $kind === 'original' && order_item_diploma_type($name) === '' && mb_strpos(mb_strtolower($name), 'доставк') === false,
            ];
        }
        $agg[$key]['count']++;
    }
    return array_values($agg);
}

/** В заказе есть оригиналы (kind=original, кроме доставки)? — тогда нужен производственный пакет. */
function order_has_originals(array $order): bool {
    foreach (order_items_parse($order) as $p) {
        if ($p['kind'] === 'original' && mb_strpos(mb_strtolower($p['item']), 'доставк') === false) return true;
    }
    return false;
}

/**
 * Генерирует ЧИСТЫЕ дипломы (без подписи/печати, с номером+QR) для заказа — по типам
 * дипломов из позиций. Возвращает [[label,absPath,webUrl], ...].
 */
function order_generate_clean_pdfs(array $order): array {
    $appId = (int)($order['application_id'] ?? 0);
    if ($appId <= 0) return [];
    $app = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$app) return [];
    if (!function_exists('diploma_pdf_html')) require_once BASE_PATH . '/core/diploma_render.php';

    // Какие типы дипломов заказаны (оригиналы).
    $types = [];
    foreach (order_items_parse($order) as $p) {
        if ($p['kind'] === 'original' && $p['dtype'] !== '') $types[$p['dtype']] = $p['item'];
    }
    // Если оригиналы (кубок/статуэтка/медаль) без явного диплома — всё равно кладём основной.
    if (!$types && order_has_originals($order)) $types['main'] = 'Основной диплом';

    $labels = ['main' => 'Основной диплом', 'extra' => 'Дополнительный диплом', 'named' => 'Именной диплом', 'thanks' => 'Благодарность'];
    $out = [];
    $base = rtrim((string) cfgv('base_url', ''), '/');
    foreach ($types as $t => $itemName) {
        $opt = ['clean' => true];
        if ($t === 'extra')  $opt['extra']  = true;
        if ($t === 'named')  $opt['named']  = true;
        if ($t === 'thanks') $opt['thanks'] = true;
        $pdf = null;
        try { $pdf = diploma_pdf_html((array)$app, $opt); } catch (\Throwable $e) { $pdf = null; }
        if ($pdf && is_file($pdf)) {
            $out[] = ['label' => $labels[$t] ?? $itemName, 'path' => $pdf, 'url' => $base . '/diplomas/' . basename($pdf), 'type' => $t];
        }
    }
    return $out;
}

/** Текстовая сводка состава заказа (кол-во × позиция). */
function order_items_summary(array $order): string {
    $lines = [];
    foreach (order_items_parse($order) as $p) {
        $lines[] = '• ' . $p['item'] . ' × ' . $p['count'];
    }
    return implode("\n", $lines);
}

/**
 * Диспетч производственного пакета при ОПЛАТЕ (сразу, не ждём дни): в Telegram-ветку
 * @zakaznagrad + чистые дипломы документами. Идемпотентно (dispatched_at).
 */
function order_dispatch_production(int $orderId): bool {
    orders_migrate();
    $order = one("SELECT * FROM awards_orders WHERE id=?", [$orderId]);
    if (!$order || !order_has_originals($order)) return false;
    if (trim((string)($order['dispatched_at'] ?? '')) !== '') return true; // уже отправляли

    $chat = (string) cfgv('tg_orders_chat', '');
    $pdfs = order_generate_clean_pdfs($order);
    // Кэшируем чистые дипломы в заказ (для админки — скачивание без повторного рендера).
    $store = array_map(fn($p) => ['label' => $p['label'], 'url' => $p['url'], 'type' => $p['type']], $pdfs);
    update('awards_orders', ['clean_pdfs' => json_encode($store, JSON_UNESCAPED_UNICODE)], 'id=:id', ['id' => $orderId]);

    $caption = "🏭 ЗАКАЗ ОРИГИНАЛОВ №{$orderId} — В ПРОИЗВОДСТВО\n"
        . "Конкурс: " . (string)($order['competition'] ?? '') . "\n"
        . "Участник: " . (string)($order['full_name'] ?? '') . "\n"
        . "Результат: " . (string)($order['result'] ?? '') . "\n\n"
        . "СОСТАВ:\n" . order_items_summary($order) . "\n\n"
        . "ПОЛУЧАТЕЛЬ:\n"
        . "ФИО: " . (string)($order['full_name'] ?? '') . "\n"
        . "Адрес: " . ((string)($order['address'] ?? '') ?: '(не указан — уточнить)') . "\n"
        . "Телефон: " . (string)($order['phone'] ?? '') . "\n"
        . "E-mail: " . (string)($order['email'] ?? '') . "\n\n"
        . "Срок изготовления — до 7 раб. дней. Дипломы (чистые, без подписи/печати, с номером+QR) — ниже. "
        . "После отправки введите трек-номер в админке → участник получит письмо.";

    // Основной канал — ветка заказов; фолбэк — админ-чат (если бот не добавлен в @zakaznagrad).
    $targets = array_values(array_unique(array_filter([$chat, (string) cfgv('tg_admin_chat', '')])));
    $okTg = false;
    foreach ($targets as $t) {
        if (!function_exists('tg_send')) break;
        $r = null;
        try { $r = tg_send($t, $caption); } catch (\Throwable $e) {}
        $sent = is_array($r) && !empty($r['ok']);
        if ($sent && function_exists('tg_send_document')) {
            foreach ($pdfs as $p) {
                if (is_file($p['path'])) { try { tg_send_document($t, $p['path'], ['caption' => $p['label'] . ' (оригинал, чистый) — заказ №' . $orderId]); } catch (\Throwable $e) {} }
            }
        }
        if ($sent) { $okTg = true; break; }   // ушло в первый рабочий канал — хватит
    }
    update('awards_orders', ['dispatched_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $orderId]);

    // Уведомление владельца (дублирующий канал).
    if (function_exists('owner_notify')) {
        try {
            owner_notify('ПРОИЗВОДСТВО', 'Заказ №' . $orderId . ' — в изготовление', '', [
                'Участник' => (string)($order['full_name'] ?? ''),
                'Состав'   => str_replace("\n", '; ', order_items_summary($order)),
                'Адрес'    => (string)($order['address'] ?? ''),
                'Телефон'  => (string)($order['phone'] ?? ''),
                '_event'   => 'order_production',
            ]);
        } catch (\Throwable $e) {}
    }
    return $okTg;
}

/**
 * Отметить заказ отправленным: статус shipped + трек + письмо участнику «Отправлено
 * Почтой России» с кнопкой «Отследить посылку» + in-app уведомление.
 */
function order_mark_shipped(int $orderId, string $track): bool {
    orders_migrate();
    $order = one("SELECT * FROM awards_orders WHERE id=?", [$orderId]);
    if (!$order) return false;
    $track = trim($track);
    update('awards_orders', ['status' => 'shipped', 'tracking' => $track, 'shipped_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $orderId]);

    $email = (string)($order['email'] ?? '');
    $name  = (string)($order['full_name'] ?? '');
    $ok = false;
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $html = order_ship_email(array_merge($order, ['tracking' => $track]));
        $nagradi = function_exists('mail_senders') ? (mail_senders()['nagradi'] ?? []) : [];
        $opt = ['from_name' => 'Наградный отдел «Музыкальный Мир»'];
        if ($nagradi) $opt['account'] = $nagradi;
        if (function_exists('mail_send')) $ok = (bool) mail_send($email, 'Ваши награды отправлены Почтой России — заказ №' . $orderId, $html, $opt);
    }
    // In-app уведомление.
    $uid = (int)($order['user_id'] ?? 0);
    if ($uid > 0 && function_exists('notify_user')) {
        $track4 = $track !== '' ? (' Трек: ' . $track . '.') : '';
        notify_user($uid, 'Награды отправлены Почтой России', 'Заказ №' . $orderId . ' отправлен.' . $track4, '/cabinet#orders', 'trophy');
    }
    return $ok;
}

/** Красивое письмо об отправке (rich mm_email_tx) с трек-номером и кнопкой отслеживания. */
function order_ship_email(array $order): string {
    $base  = rtrim((string) cfgv('base_url', 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai'), '/');
    $name  = trim((string)($order['full_name'] ?? ''));
    $track = trim((string)($order['tracking'] ?? ''));
    $oid   = (string)($order['id'] ?? '');
    $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
    $trackUrl = order_pochta_url($track);

    $rows = '';
    foreach (order_items_parse($order) as $p) {
        $rows .= '<tr><td style="padding:6px 0;font-size:14px;color:' . MM_INK . ';">' . h($p['item']) . '</td>'
              . '<td style="padding:6px 0;font-size:14px;color:' . MM_NAVY . ';font-weight:700;text-align:right;">× ' . (int)$p['count'] . '</td></tr>';
    }

    $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:' . MM_NAVY . ';font-weight:700;">Ваши награды отправлены</h1>'
        . '<p style="margin:0 0 14px;">' . $hello . '</p>'
        . '<p style="margin:0 0 18px;">Наградные материалы по заказу <b style="color:' . MM_NAVY . ';">№' . h($oid) . '</b> изготовлены и отправлены <b>Почтой России</b>.</p>'
        . ($track !== '' ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;border-radius:14px;overflow:hidden;"><tr>'
            . '<td style="background:' . MM_NAVY . ';background:linear-gradient(135deg,' . MM_NAVY . ',' . MM_NAVY2 . ');padding:20px 24px;text-align:center;">'
            . '<div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.72);margin-bottom:6px;">Трек-номер для отслеживания</div>'
            . '<div style="font-family:Georgia,serif;font-size:24px;font-weight:800;color:' . MM_GOLD . ';letter-spacing:.06em;">' . h($track) . '</div></td></tr></table>' : '')
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;background:' . MM_CARD . ';border:1px solid ' . MM_LINE . ';border-radius:12px;"><tr><td style="padding:14px 20px;">'
        . '<div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:' . MM_MUTED . ';margin-bottom:6px;">Состав отправления</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table></td></tr></table>'
        . '<p style="margin:14px 0 0;font-size:14px;color:' . MM_MUTED . ';">Доставка Почтой России — обычно до 14 рабочих дней. Отследить посылку можно по кнопке ниже.</p>';

    return mm_email_tx($inner, [
        'preheader' => 'Заказ №' . $oid . ' отправлен Почтой России' . ($track !== '' ? '. Трек: ' . $track : '') . '.',
        'hero'      => $trackUrl !== '' ? mm_cta_primary($trackUrl, 'Отследить посылку', 'Почта России · трек ' . $track) : mm_cta_primary($base . '/cabinet#orders', 'Мои заказы в кабинете'),
        'actions'   => [['Личный кабинет', $base . '/cabinet#orders'], ['Оставить отзыв', $base . '/reviews']],
        'thanks'    => true,
    ]);
}
