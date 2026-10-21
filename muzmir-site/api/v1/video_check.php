<?php
/**
 * Живая проверка конкурсной видео-ссылки на шаге подачи заявки.
 * Форма зовёт этот эндпоинт при переходе с шага «Номер», чтобы НЕ пропустить
 * дальше заведомо неверную ссылку: несуществующую, закрытую, не видео или
 * старше 1 года. Ответ: { ok, state, platform, stale, reason }.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/link_check.php';

// ОГРАНИЧЕНИЕ ЧАСТОТЫ И ИСТОЧНИКА.
// Ручка не требовала ни входа, ни лимита, ни даже POST — и при этом заставляла наш
// сервер ходить curl'ом по любому переданному адресу. Это и разведка внутренней сети
// чужими руками (ответ отличается по времени и коду), и готовый усилитель флуда:
// один HTTP-запрос к нам превращался в наш запрос к жертве, без счётчика.
if (!request_same_origin_vc()) {
    json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Недопустимый источник запроса'], 403);
}
if (!rate_ok('video_check:' . client_ip(), 30, 3600)) {
    json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Слишком много проверок. Подождите немного.'], 429);
}

$url = trim((string) input('url'));
if ($url === '') json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Пустая ссылка']);
if (mb_strlen($url) > 500) json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Слишком длинная ссылка']);

// НОМИНАЦИЮ ПЕРЕДАЁМ В ПРОВЕРКУ.
//
// video_verify() умеет отличать художника от музыканта и не требовать видео там,
// где работа — картина или фотография. Но эта ручка звала её БЕЗ номинации, и
// живая проверка в форме отвергала снимок работы ещё до того, как участник
// доходил до отправки: «этот файл не является видео». Художница так и не смогла
// подать заявку — 21 августа написала об этом. Итоговая проверка при отправке
// номинацию получала, а проверка в форме — нет, и до отправки дело не доходило.
$nomination = trim((string) input('nomination'));
$r = video_verify($url, $nomination);

/* ЖИВАЯ ПРОВЕРКА ОБЯЗАНА СУДИТЬ ПО ТЕМ ЖЕ ПРАВИЛАМ, ЧТО И ОТПРАВКА.
 *
 * Здесь вызывалась только video_verify, а при отправке заявку судит ещё и
 * lu_check: ссылка не должна вести на папку облака и не должна быть уже подана
 * на этот конкурс. Из-за этого расхождения форма на шаге «Номер» писала зелёным
 * «Ссылка принята», человек доходил до конца и получал «Проверьте заполнение
 * формы» — без единого указания, что не так, потому что виновато поле осталось
 * на три шага позади.
 *
 * 20 октября так вышло у Павлецовой: шестнадцать отправок подряд со ссылкой на
 * папку Google Диска, все отклонены сервером, и каждый раз форма до этого
 * подтверждала ссылку зелёным. В чат в тот день написали ещё четверо с тем же
 * «ссылку зелёным отмечает, пишет, что принята, а заявка не уходит».
 *
 * Конкурсы передаёт форма: без них проверяем только папку (она от конкурса не
 * зависит), с ними — и занятость ссылки. */
if (($r['ok'] ?? false) && is_file(BASE_PATH . '/core/link_unique.php')) {
    require_once BASE_PATH . '/core/link_unique.php';
    /* СПИСОК КОНКУРСОВ ЧИТАЕМ НАПРЯМУЮ, А НЕ ЧЕРЕЗ input().
     *
     * input() объявлен как возвращающий строку и приводит к ней что угодно:
     * массив competition_ids[] превращался в слово «Array» (с предупреждением
     * «Array to string conversion» на каждой проверке ссылки в журнале), номера
     * конкурсов терялись, и занятость ссылки живая проверка не проверяла вовсе.
     * Папку облака она при этом ловила — та от конкурса не зависит, — поэтому
     * снаружи поломка была не видна. */
    $raw = $_POST['competition_ids'] ?? $_GET['competition_ids'] ?? [];
    if (!is_array($raw)) $raw = $raw !== '' ? preg_split('~[^0-9]+~', (string) $raw) ?: [] : [];
    $ids = array_values(array_filter(array_map('intval', $raw)));
    if (function_exists('lu_check')) {
        foreach ($ids ?: [0] as $cid) {
            $lu = lu_check($url, (int) $cid, 0, $nomination);
            if (!($lu['ok'] ?? true)) {
                $r['ok']     = false;
                $r['state']  = 'bad';
                $r['reason'] = (string) ($lu['reason'] ?? 'Ссылка не прошла проверку.');
                break;
            }
        }
    }
}

json_out([
    'ok'       => (bool)($r['ok'] ?? false),
    'state'    => (string)($r['state'] ?? 'bad'),
    'platform' => (string)($r['platform'] ?? ''),
    'stale'    => $r['stale'] ?? null,
    'reason'   => (string)($r['reason'] ?? ''),
]);

/** Проверка Origin/Referer своего домена — ручкой пользуется только форма подачи. */
function request_same_origin_vc(): bool {
    $hosts = [];
    if ($bu = cfgv('base_url')) { $h = parse_url((string) $bu, PHP_URL_HOST); if ($h) $hosts[] = strtolower($h); }
    foreach (['domain', 'domain_puny'] as $k) { if ($d = cfgv($k)) $hosts[] = strtolower((string) $d); }
    $hosts = array_values(array_unique(array_filter($hosts)));
    if (!$hosts) return true;
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') return false;
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    return $srcHost !== '' && in_array($srcHost, $hosts, true);
}
