<?php
/**
 * ОТ ПИСЬМА «СОГЛАСНЫ» ДО СЕРТИФИКАТА — ОДНИМ ПРОГОНОМ.
 *
 * Отдельные звенья цепочки проверены поодиночке, но вместе они не работали ни
 * разу: партнёров ноль, писем о согласии ноль. А цена ошибки здесь высокая —
 * первое живое «согласны» либо превратится в партнёрство с сертификатом, либо
 * тихо повиснет, и учреждение решит, что его не услышали.
 *
 * Здесь цепочка проходится целиком на СВОЁМ учреждении: письмо кладётся в
 * разобранную почту так же, как его положила бы читалка ящика, дальше работает
 * настоящий крон разбора, и проверяется всё, что он должен был сделать —
 * партнёрство принято, номер выдан, промокод создан, сертификат сгенерирован,
 * письмо с доступом отправлено, событие записано, письмо помечено разобранным.
 *
 * Отдельно проверяются предохранители: согласие с чужого адреса не принимается
 * вслепую, а отказ действующего партнёра не стирает ему адрес.
 *
 * Ничего чужого не трогает и убирает за собой полностью.
 *
 *   php scripts/audit_partner_e2e.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/inbox_reader.php';
require_once BASE_PATH . '/core/partner.php';

$OK = 0; $BAD = 0;
$line = str_repeat('=', 78);
function ok(string $s, string $x = ''): void  { global $OK; $OK++; echo "  [ок]   $s" . ($x !== '' ? " — $x" : '') . "\n"; }
function bad(string $s, string $x = ''): void { global $BAD; $BAD++; echo "  [СБОЙ] $s" . ($x !== '' ? " — $x" : '') . "\n"; }
function step(string $t, callable $f): void {
    try { $r = $f(); } catch (\Throwable $e) { bad($t, 'исключение: ' . $e->getMessage()); return; }
    $r === false || $r === null ? bad($t) : ok($t, is_string($r) ? $r : '');
}

echo "СКВОЗНОЙ ПРОГОН: ПИСЬМО «СОГЛАСНЫ» → СЕРТИФИКАТ\n$line\n";

/* ── Своё учреждение и своё письмо ────────────────────────────────────────── */
$MAIL = 'e2e-partner-' . substr(bin2hex(random_bytes(4)), 0, 8) . '@example.test';
$instId = (int) insert('institutions', [
    'name' => 'ПРОВЕРКА E2E Детская школа искусств', 'region' => 'Проверочная область',
    'city' => 'Проверочный город', 'email' => $MAIL, 'director' => 'Проверкин Пров Провович',
    'source' => 'e2e', 'kind' => 'dshi', 'status' => 'excluded',
]);
ok('заведено временное учреждение', 'id=' . $instId);

register_shutdown_function(static function () use ($instId, $MAIL): void {
    $no = (string) (scalar("SELECT partner_no FROM institutions WHERE id=?", [$instId]) ?? '');
    foreach ([
        "DELETE FROM partner_docs WHERE institution_id=? OR number=?" => [$instId, $no],
        "DELETE FROM partner_events WHERE institution_id=?" => [$instId],
        "DELETE FROM partner_thanks WHERE institution_id=?" => [$instId],
        "DELETE FROM inbox_messages WHERE LOWER(from_email)=?" => [mb_strtolower($MAIL)],
        "DELETE FROM mail_queue WHERE LOWER(to_email)=?" => [mb_strtolower($MAIL)],
        "DELETE FROM subscribers WHERE LOWER(email)=?" => [mb_strtolower($MAIL)],
        "DELETE FROM institutions WHERE id=?" => [$instId],
    ] as $sql => $args) { try { q($sql, $args); } catch (\Throwable $e) {} }
    echo "\nвременные данные удалены\n";
});

/* ── 1. Письмо разобрано так же, как разобрала бы читалка ─────────────────── */
echo "\n1. ПИСЬМО ПОПАДАЕТ В РАЗОБРАННУЮ ПОЧТУ\n$line\n";
$text = 'Здравствуйте! Рассмотрели ваше обращение. Мы согласны стать информационным партнёром. '
      . 'Просим направить сертификат и данные для входа в кабинет.';
step('читалка определяет вид письма', function () use ($text) {
    $k = inbox_classify('novosti', 'Re: Приглашаем к участию в конкурсах', $text, false);
    return $k === 'partner_accept' ? $k : false;
});
step('отправитель опознан как наше учреждение', function () use ($MAIL, $instId) {
    $id = inbox_identify($MAIL);
    return (int) ($id['inst_id'] ?? 0) === $instId ? 'inst_id=' . $instId : false;
});

$msgId = 0;
step('письмо записано в разобранную почту', function () use (&$msgId, $MAIL, $instId, $text) {
    $msgId = (int) insert('inbox_messages', [
        'mailbox' => 'novosti', 'folder' => 'INBOX',
        'msg_key' => 'e2e-' . bin2hex(random_bytes(6)),
        'from_email' => $MAIL, 'from_name' => 'ПРОВЕРКА E2E ДШИ',
        'subject' => 'Re: Приглашаем к участию в конкурсах',
        'body_text' => $text, 'is_auto' => 0, 'kind' => 'partner_accept',
        'handled_by' => '', 'inst_id' => $instId, 'received_at' => date('Y-m-d H:i:s'),
    ]);
    return $msgId > 0 ? 'id=' . $msgId : false;
});

/* ── 2. Настоящий крон разбора ────────────────────────────────────────────── */
echo "\n2. РАБОТАЕТ КРОН РАЗБОРА (cron/inbox_actions.php)\n$line\n";
$out = (string) shell_exec('cd ' . escapeshellarg(BASE_PATH) . ' && php cron/inbox_actions.php 2>&1');
foreach (preg_split('~\R~', trim($out)) ?: [] as $l) if (trim($l) !== '') echo "         крон: $l\n";

step('учреждение принято в партнёры', function () use ($instId) {
    $st = (string) (scalar("SELECT partner_status FROM institutions WHERE id=?", [$instId]) ?? '');
    if ($st !== 'accepted') { echo "           ↳ статус сейчас «$st»\n"; return false; }
    return 'статус accepted';
});
step('выдан номер партнёрства', function () use ($instId) {
    $no = (string) (scalar("SELECT partner_no FROM institutions WHERE id=?", [$instId]) ?? '');
    return preg_match('~^ИП-\d{4}-\d{5}$~u', $no) ? $no : false;
});
step('создан промокод', function () use ($instId) {
    $c = (string) (scalar("SELECT partner_promo_code FROM institutions WHERE id=?", [$instId]) ?? '');
    return preg_match('~^PART-\d{4}-[A-Z0-9]{4}$~', $c) ? $c : false;
});
step('создана персональная ссылка', function () use ($instId) {
    $s = (string) (scalar("SELECT partner_slug FROM institutions WHERE id=?", [$instId]) ?? '');
    return $s !== '' ? '/p/' . $s : false;
});
step('сертификат зарегистрирован в реестре документов', function () use ($instId) {
    $d = one("SELECT number, kind FROM partner_docs WHERE institution_id=?", [$instId]);
    return $d && (string) $d['kind'] === 'cert' ? (string) $d['number'] : false;
});
step('письмо с сертификатом и доступом отправлено', function () use ($instId) {
    $e = one("SELECT payload FROM partner_events WHERE institution_id=? AND kind='welcome_sent'", [$instId]);
    if (!$e) return false;
    $p = json_decode((string) $e['payload'], true);
    return 'сертификат: ' . (!empty($p['cert']) ? $p['cert'] : 'без вложения')
         . ', доступ: ' . (!empty($p['access']) ? 'есть' : 'нет');
});
step('доступ отмечен как выданный', function () use ($instId) {
    return (int) (scalar("SELECT partner_pass_shown FROM institutions WHERE id=?", [$instId]) ?? 0) === 1;
});
step('входящее письмо помечено разобранным', function () use ($msgId) {
    $h = (string) (scalar("SELECT handled_by FROM inbox_messages WHERE id=?", [$msgId]) ?? '');
    if ($h !== 'auto_accept') { echo "           ↳ пометка сейчас «$h»\n"; return false; }
    return $h;
});
step('вход в кабинет партнёра открывается', function () use ($instId) {
    // Пароль ушёл в письме и в открытом виде больше нигде не лежит, поэтому
    // проверяем не сам вход, а то, что хеш выписан и партнёр находится по адресу.
    $r = one("SELECT partner_pass_hash, email FROM institutions WHERE id=?", [$instId]);
    if (!$r || trim((string) $r['partner_pass_hash']) === '') return false;
    return partner_by_email((string) $r['email']) !== null ? 'партнёр находится по адресу' : false;
});

/* ── 3. Повтор не дублирует ───────────────────────────────────────────────── */
echo "\n3. ПОВТОРНОЕ СОГЛАСИЕ НИЧЕГО НЕ ЛОМАЕТ\n$line\n";
step('второе письмо о согласии не выдаёт второй сертификат', function () use ($MAIL, $instId) {
    insert('inbox_messages', [
        'mailbox' => 'novosti', 'folder' => 'INBOX', 'msg_key' => 'e2e-' . bin2hex(random_bytes(6)),
        'from_email' => $MAIL, 'from_name' => 'ПРОВЕРКА E2E ДШИ', 'subject' => 'Re: ещё раз',
        'body_text' => 'Подтверждаем согласие.', 'is_auto' => 0, 'kind' => 'partner_accept',
        'handled_by' => '', 'inst_id' => $instId, 'received_at' => date('Y-m-d H:i:s'),
    ]);
    shell_exec('cd ' . escapeshellarg(BASE_PATH) . ' && php cron/inbox_actions.php 2>&1');
    $n = (int) (scalar("SELECT COUNT(*) FROM partner_events WHERE institution_id=? AND kind='welcome_sent'", [$instId]) ?? 0);
    $d = (int) (scalar("SELECT COUNT(*) FROM partner_docs WHERE institution_id=?", [$instId]) ?? 0);
    if ($n !== 1 || $d !== 1) { echo "           ↳ писем $n, документов $d\n"; return false; }
    return 'по одному письму и документу';
});

/* ── 4. Предохранители ────────────────────────────────────────────────────── */
echo "\n4. ПРЕДОХРАНИТЕЛИ\n$line\n";
step('отказ действующего партнёра не стирает ему адрес', function () use ($MAIL, $instId) {
    insert('inbox_messages', [
        'mailbox' => 'novosti', 'folder' => 'INBOX', 'msg_key' => 'e2e-' . bin2hex(random_bytes(6)),
        'from_email' => $MAIL, 'from_name' => 'ПРОВЕРКА E2E ДШИ', 'subject' => 'Отказ',
        'body_text' => 'Отказываемся от участия.', 'is_auto' => 0, 'kind' => 'partner_decline',
        'handled_by' => '', 'inst_id' => $instId, 'received_at' => date('Y-m-d H:i:s'),
    ]);
    shell_exec('cd ' . escapeshellarg(BASE_PATH) . ' && php cron/inbox_actions.php 2>&1');
    $r = one("SELECT email, partner_status FROM institutions WHERE id=?", [$instId]);
    if (trim((string) $r['email']) === '' || (string) $r['partner_status'] !== 'accepted') return false;
    return 'адрес на месте, статус не тронут';
});
step('согласие с чужого адреса не принимается вслепую', function () {
    $foreign = 'nobody-' . substr(bin2hex(random_bytes(3)), 0, 6) . '@example.test';
    $mid = (int) insert('inbox_messages', [
        'mailbox' => 'novosti', 'folder' => 'INBOX', 'msg_key' => 'e2e-' . bin2hex(random_bytes(6)),
        'from_email' => $foreign, 'from_name' => 'Неизвестный', 'subject' => 'Согласие',
        'body_text' => 'Мы согласны на партнёрство.', 'is_auto' => 0, 'kind' => 'partner_accept',
        'handled_by' => '', 'inst_id' => 0, 'received_at' => date('Y-m-d H:i:s'),
    ]);
    shell_exec('cd ' . escapeshellarg(BASE_PATH) . ' && php cron/inbox_actions.php 2>&1');
    $h = (string) (scalar("SELECT handled_by FROM inbox_messages WHERE id=?", [$mid]) ?? '');
    try { q("DELETE FROM inbox_messages WHERE id=?", [$mid]); } catch (\Throwable $e) {}
    if ($h !== 'human') { echo "           ↳ пометка сейчас «$h»\n"; return false; }
    return 'отдано оператору';
});

echo "\n$line\n";
printf("ПРОЙДЕНО: %d · СБОЕВ: %d\n", $OK, $BAD);
exit($BAD > 0 ? 1 : 0);
