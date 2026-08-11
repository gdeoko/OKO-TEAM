<?php
/**
 * ПРИГЛАШЕНИЯ УЧРЕЖДЕНИЯМ — ПОСТАНОВКА В ОЧЕРЕДЬ.
 *
 * Здесь письма только ГОТОВЯТСЯ. Ни одно не отправляется: они ложатся в mail_queue
 * как массовые (priority = 5), а наружу их выпускает общий воркер — по дневной норме,
 * ровным темпом, в окно 09:00–18:00 и только при поднятом стоп-кране. Разделение
 * намеренное: подготовить тысячу писем должно быть безопасно и обратимо, а решение
 * «отправляем» принимается один раз и в другом месте.
 *
 * ЧТО ДЕЛАЕТ ЭТО ПИСЬМО ЗАКОННЫМ И НЕ СПАМОМ:
 *   • адрес взят с официального сайта учреждения или из его открытой карточки —
 *     то есть опубликован самой организацией как способ связи;
 *   • адресат — организация, а не человек; в письме нет персональных обращений;
 *   • отписка в один клик, ссылка в подвале и в заголовке List-Unsubscribe;
 *   • одно письмо на учреждение за волну, повторы считаются;
 *   • отказ — окончательный: статус 'unsubscribed', больше не пишем никогда.
 */
declare(strict_types=1);

if (!function_exists('inst_pick_for_invite')) require_once __DIR__ . '/institutions.php';

/**
 * Конкурсы, которые предлагаем в письме: открытые, с приёмом заявок.
 * Бесплатный ставится первым — учреждению важно видеть, что участие возможно
 * и без бюджета (сортировка внутри invite_institution_body).
 */
function invite_open_comps(): array {
    try {
        return all("SELECT name, is_paid, price, slug, end_date
                      FROM competitions
                     WHERE status='open'
                     ORDER BY sort ASC, id ASC");
    } catch (\Throwable $e) { return []; }
}

/**
 * Ставит приглашения в очередь для учреждений со статусом «Новое».
 *
 * @return array ['queued'=>int, 'skipped'=>int, 'comps'=>int]
 */
function invite_queue_institutions(int $limit = 500): array {
    inst_migrate();

    $comps = invite_open_comps();
    if (!$comps) return ['queued' => 0, 'skipped' => 0, 'comps' => 0, 'error' => 'нет открытых конкурсов'];

    if (!function_exists('invite_institution_email')) require_once __DIR__ . '/invite_institution.php';
    if (!function_exists('nl_ensure_subscriber'))     require_once __DIR__ . '/newsletter.php';
    if (!function_exists('nl_ensure_campaign_type_col')) require_once __DIR__ . '/newsletter.php';
    nl_ensure_campaign_type_col();

    // Срок приёма — по самому раннему закрытию среди открытых конкурсов: обещать
    // больше, чем есть, нельзя.
    $deadline = '';
    foreach ($comps as $c) {
        $d = trim((string) ($c['end_date'] ?? ''));
        if ($d === '') continue;
        if ($deadline === '' || $d < $deadline) $deadline = $d;
    }
    $deadlineHuman = $deadline !== '' ? date('d.m.Y', strtotime($deadline)) : date('d.m.Y', strtotime('last day of this month'));

    $base    = rtrim((string) cfgv('base_url'), '/');
    $rows    = inst_pick_for_invite($limit);
    $queued  = 0;
    $skipped = 0;

    foreach ($rows as $r) {
        $email = trim((string) $r['email']);
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) { $skipped++; continue; }

        // Отписка обязательна и обязана работать. Токен заводим через тот же
        // механизм, что и для обычных подписчиков: тогда переход по ссылке
        // отпишет адрес и в subscribers, и в базе учреждений.
        [$token, $active] = nl_ensure_subscriber($email, (string) $r['name'], 'institution');
        if (!$active) {                      // уже отписывались — не трогаем
            try { update('institutions', ['status' => 'unsubscribed'], 'id=:id', ['id' => (int) $r['id']]); } catch (\Throwable $e) {}
            $skipped++;
            continue;
        }
        $unsub = $base . '/api/v1/unsubscribe.php?token=' . urlencode($token);

        $mail = invite_institution_email($comps, $unsub, ['deadline' => $deadlineHuman]);

        try {
            insert('mail_queue', [
                'to_email'      => mb_strtolower($email),
                'to_name'       => (string) $r['name'],
                'subject'       => (string) $mail['subject'],
                'body'          => (string) $mail['html'],
                'status'        => 'queued',
                'priority'      => 5,          // МАССОВОЕ: пойдёт через bulk-пул по норме
                'campaign_type' => 'konkurs',
            ]);
            inst_mark_invited((int) $r['id']);
            $queued++;
        } catch (\Throwable $e) {
            $skipped++;
        }
    }

    return ['queued' => $queued, 'skipped' => $skipped, 'comps' => count($comps)];
}
