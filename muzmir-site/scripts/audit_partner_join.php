<?php
/**
 * ПРОВЕРКА СОГЛАСИЯ НА ПАРТНЁРСТВО ОДНИМ НАЖАТИЕМ.
 *
 * Проходит весь путь на временном учреждении: подписанная ссылка из письма →
 * страница → нажатие кнопки → приём в программу → сертификат и письмо с доступом.
 * Настоящих учреждений не касается и настоящим адресатам ничего не шлёт: временная
 * запись заводится на собственный ящик центра и удаляется в конце, что бы ни
 * случилось по дороге.
 *
 *   php scripts/audit_partner_join.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/partner.php';

$line = str_repeat('=', 78);
$ok = $bad = 0;
$say = function (bool $good, string $what, string $note = '') use (&$ok, &$bad): void {
    if ($good) { $ok++;  printf("  [ок]   %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
    else       { $bad++; printf("  [СБОЙ] %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
};

echo "СОГЛАСИЕ НА ПАРТНЁРСТВО ОДНИМ НАЖАТИЕМ\n$line\n";

$box = (string) cfgv('org_email', 'kulturniy.centr.mir@gmail.com');
$id  = (int) insert('institutions', [
    'name'   => 'ПРОВЕРКА Детская школа искусств (временная запись)',
    'kind'   => 'dshi',
    'region' => 'Тестовый край',
    'city'   => 'Тестовск',
    'email'  => $box,
    'source' => 'audit',
    'status' => 'new',
]);

try {
    /* 1. Ссылка и подпись */
    $url = partner_join_url($id);
    $say(str_contains($url, '/partner-join?i=' . $id), 'ссылка собирается', $url);

    parse_str((string) parse_url($url, PHP_URL_QUERY), $qs);
    $sig = (string) ($qs['s'] ?? '');
    $say(partner_join_check($id, $sig) !== null, 'своя подпись принимается');
    $say(partner_join_check($id, 'deadbeef') === null, 'чужая подпись отклоняется');
    $say(partner_join_check($id + 1, $sig) === null, 'подпись не подходит другому учреждению');

    /* 2. Приём в программу */
    $res  = partner_accept($id);
    $inst = $res['inst'];
    $say(($inst['partner_status'] ?? '') === 'accepted', 'статус партнёра выставлен');
    $say(trim((string) $inst['partner_no']) !== '', 'номер соглашения выдан', (string) $inst['partner_no']);
    $say(trim((string) $inst['partner_slug']) !== '', 'персональная ссылка выдана', '/p/' . (string) $inst['partner_slug']);
    $say(trim((string) $inst['partner_promo_code']) !== '', 'промокод выдан', (string) $inst['partner_promo_code']);
    $say(strlen((string) $res['password_plain']) >= 6, 'пароль кабинета сгенерирован');
    $say(password_verify((string) $res['password_plain'], (string) $inst['partner_pass_hash']), 'пароль подходит к хешу');

    /* 3. Вход в кабинет тем самым паролем */
    $login = partner_login((string) $inst['email'], (string) $res['password_plain']);
    $say($login !== null && (int) $login['id'] === $id, 'вход в кабинет партнёра работает');

    /* 4. Сертификат в реестре */
    $doc = one("SELECT * FROM partner_docs WHERE number=?", [(string) $inst['partner_no']]);
    $say($doc !== null, 'сертификат зарегистрирован в реестре');

    /* 5. Повторное нажатие ничего не ломает */
    $again = partner_accept($id);
    $say((string) $again['inst']['partner_no'] === (string) $inst['partner_no'], 'повторное нажатие не выдаёт второй номер');
    $say((string) $again['password_plain'] === '', 'повторное нажатие не показывает пароль снова');

    /* 6. Приветственное письмо с сертификатом */
    $sent = partner_send_welcome($id, (string) $res['password_plain']);
    $say($sent, 'приветственное письмо с сертификатом отправлено на ' . (string) $inst['email'],
         $sent ? '' : (function_exists('mail_last_error') ? mail_last_error() : 'причина неизвестна'));
    $ev = one("SELECT * FROM partner_events WHERE institution_id=? AND kind='welcome_sent'", [$id]);
    $say($ev !== null, 'отправка отмечена в событиях партнёра');
    $sent2 = partner_send_welcome($id, '');
    $say($sent2 === true || $sent2 === false, 'повторная отправка не падает');
    $cnt = (int) (scalar("SELECT COUNT(*) FROM partner_events WHERE institution_id=? AND kind='welcome_sent'", [$id]) ?? 0);
    $say($cnt === 1, 'второе письмо тому же партнёру не уходит');

    /* 7. Заявка по персональной ссылке засчитывается */
    $aid = (int) insert('applications', [
        'number' => 'AUDIT-JOIN-' . $id, 'competition_id' => (int) (scalar("SELECT id FROM competitions ORDER BY id LIMIT 1") ?? 0),
        'full_name' => 'Проверка Партнёрской Цепочки', 'email' => $box, 'status' => 'new',
    ]);
    partner_attach_application($aid, $id);
    $app = one("SELECT institution_id FROM applications WHERE id=?", [$aid]);
    $say((int) ($app['institution_id'] ?? 0) === $id, 'заявка засчитана учреждению');
    q("DELETE FROM applications WHERE id=?", [$aid]);

} catch (\Throwable $e) {
    $say(false, 'проверка прервана', $e->getMessage());
} finally {
    /* Уборка: временная запись и всё, что к ней приросло. */
    q("DELETE FROM partner_docs WHERE institution_id=?", [$id]);
    q("DELETE FROM partner_events WHERE institution_id=?", [$id]);
    q("DELETE FROM applications WHERE institution_id=?", [$id]);
    q("DELETE FROM institutions WHERE id=?", [$id]);
    $left = (int) (scalar("SELECT COUNT(*) FROM institutions WHERE id=?", [$id]) ?? 0);
    $say($left === 0, 'временная запись удалена');
}

echo "\n$line\nПРОЙДЕНО: $ok · СБОЕВ: $bad\n";
exit($bad > 0 ? 1 : 0);
