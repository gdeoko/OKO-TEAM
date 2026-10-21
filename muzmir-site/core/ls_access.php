<?php
/**
 * ВХОД В ЛИЧНЫЙ КАБИНЕТ УЧАСТНИКА — ТОЛЬКО С ЕГО СОГЛАСИЯ.
 *
 * Решение владельца от 22.10.2026. Бывает, что человек сам не может оформить
 * заявку или заказ: путается в форме, пишет с телефона, плохо видит. Тогда
 * администратор помогает ему В РЕАЛЬНОМ ВРЕМЕНИ, пока тот сидит в своём
 * кабинете: просит доступ, участник жмёт «Согласен», и администратор работает
 * в его кабинете как он сам.
 *
 * ЧТО ЗДЕСЬ ПРИНЦИПИАЛЬНО.
 *   • Согласие даёт сам участник из СВОЕЙ сессии. Ни писем, ни сообщений во
 *     ВКонтакте — слово владельца: всё происходит, пока человек в кабинете.
 *     Запрос висит LS_PENDING_MIN минут и гаснет сам.
 *   • Доступ — на LS_GRANT_MIN минут (30, слово владельца). Участник видит,
 *     до какого времени он открыт, и закрывает его одной кнопкой.
 *   • Админская сессия НЕ подменяется. Вход в кабинет участника — отдельная
 *     кука LS_COOKIE поверх обычной. Она действует только вместе с живой
 *     сессией того самого администратора, который получил согласие: украденная
 *     кука без неё ничего не открывает. В админке (/admin) кука не действует
 *     вовсе — там администратор остаётся собой.
 *   • Деньги — только действие участника. Под администратором платёж не
 *     создаётся (yukassa_create_payment), заказ остаётся «ожидает оплаты»,
 *     и участник оплачивает его сам из своего кабинета.
 *   • Почта, пароль, способы входа, профиль, голосование, отзывы, чат, клуб —
 *     закрыты (ls_api_allowed, ls_cabinet_action_allowed).
 *   • Каждое действие пишется в журнал запроса; участник видит его в своём
 *     кабинете, владелец — в разделе «ВХОД В ЛС». Центр — оператор ПД
 *     (свидетельство № 094084): согласие хранится с временем, адресом и
 *     браузером, с которого оно дано.
 */
declare(strict_types=1);

const LS_GRANT_MIN   = 30;   // сколько открыт кабинет после согласия
const LS_PENDING_MIN = 5;    // сколько ждём ответа участника
const LS_COOKIE      = 'muzmir_ls';
const LS_MIN_ROLE    = 'admin';

function ls_boot(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("CREATE TABLE IF NOT EXISTS ls_access (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      INTEGER NOT NULL,
        admin_id     INTEGER NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending',   -- pending | granted | denied | expired | closed
        created_at   TEXT DEFAULT (datetime('now','localtime')),
        pending_until TEXT DEFAULT '',
        answered_at  TEXT DEFAULT '',
        granted_until TEXT DEFAULT '',
        consent_ip   TEXT DEFAULT '',
        consent_ua   TEXT DEFAULT '',
        enter_hash   TEXT DEFAULT '',
        entered_at   TEXT DEFAULT '',
        closed_at    TEXT DEFAULT '',
        closed_by    TEXT DEFAULT '',                    -- user | admin | timeout
        actions      INTEGER DEFAULT 0,
        log          TEXT DEFAULT '[]'
    )");
    db()->exec("CREATE INDEX IF NOT EXISTS ls_access_user ON ls_access(user_id, status)");
}

function ls_now(): string { return date('Y-m-d H:i:s'); }

/** Гасит просроченное: неотвеченные запросы и истёкший доступ. */
function ls_expire(): void {
    ls_boot();
    $now = ls_now();
    q("UPDATE ls_access SET status='expired', closed_at=?, closed_by='timeout'
        WHERE status='pending' AND pending_until<>'' AND pending_until<=?", [$now, $now]);
    q("UPDATE ls_access SET status='closed', closed_at=?, closed_by='timeout'
        WHERE status='granted' AND granted_until<>'' AND granted_until<=?", [$now, $now]);
}

function ls_row(int $id): ?array {
    ls_boot();
    return one("SELECT * FROM ls_access WHERE id=?", [$id]) ?: null;
}

/** Администратор просит доступ. Прежние открытые запросы к этому человеку гасятся. */
function ls_request(int $adminId, int $userId): int {
    ls_expire();
    $now = ls_now();
    q("UPDATE ls_access SET status='expired', closed_at=?, closed_by='admin'
        WHERE user_id=? AND status='pending'", [$now, $userId]);
    return (int) insert('ls_access', [
        'user_id' => $userId, 'admin_id' => $adminId, 'status' => 'pending',
        'created_at' => $now,
        'pending_until' => date('Y-m-d H:i:s', time() + LS_PENDING_MIN * 60),
        'log' => '[]',
    ]);
}

/** Ждущий ответа запрос к участнику (для окна в кабинете). */
function ls_pending_for(int $userId): ?array {
    ls_expire();
    return one("SELECT * FROM ls_access WHERE user_id=? AND status='pending' ORDER BY id DESC LIMIT 1", [$userId]) ?: null;
}

/** Открытый доступ к кабинету участника (для полосы «доступ открыт до …»). */
function ls_granted_for(int $userId): ?array {
    ls_expire();
    return one("SELECT * FROM ls_access WHERE user_id=? AND status='granted' ORDER BY id DESC LIMIT 1", [$userId]) ?: null;
}

/** Ответ участника. Принимается только по своему запросу и только пока он не погас. */
function ls_answer(int $id, int $userId, bool $agree): bool {
    ls_expire();
    $r = ls_row($id);
    if (!$r || (int) $r['user_id'] !== $userId || (string) $r['status'] !== 'pending') return false;
    $now = ls_now();
    update('ls_access', [
        'status'        => $agree ? 'granted' : 'denied',
        'answered_at'   => $now,
        'granted_until' => $agree ? date('Y-m-d H:i:s', time() + LS_GRANT_MIN * 60) : '',
        'consent_ip'    => client_ip(),
        'consent_ua'    => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255),
        'closed_at'     => $agree ? '' : $now,
        'closed_by'     => $agree ? '' : 'user',
    ], 'id=:id', ['id' => $id]);
    return true;
}

/** Закрыть доступ: участником (из кабинета) или администратором (кнопка «Выйти»). */
function ls_close(int $id, string $by): void {
    ls_boot();
    q("UPDATE ls_access SET status='closed', closed_at=?, closed_by=?
        WHERE id=? AND status IN ('granted','pending')", [ls_now(), $by, $id]);
}

/** Админская сессия этого браузера — напрямую из sessions, мимо current_user(). */
function ls_admin_from_cookie(): ?array {
    $tok = (string) ($_COOKIE['muzmir_sess'] ?? '');
    if ($tok === '') return null;
    $u = one("SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
               WHERE s.token=? AND (s.expires_at IS NULL OR s.expires_at > datetime('now','localtime'))
                 AND COALESCE(u.blocked,0)=0", [$tok]);
    if (!$u) return null;
    return (ROLE_RANK[(string) $u['role']] ?? 0) >= ROLE_RANK[LS_MIN_ROLE] ? $u : null;
}

/** Ставит куку входа в кабинет участника. Только тому администратору, кто просил. */
function ls_enter(int $id, int $adminId): bool {
    ls_expire();
    $r = ls_row($id);
    if (!$r || (string) $r['status'] !== 'granted' || (int) $r['admin_id'] !== $adminId) return false;
    $until = (int) strtotime((string) $r['granted_until']);
    if ($until <= time()) return false;
    // Один браузер — один чужой кабинет: прежний доступ этого администратора закрываем.
    q("UPDATE ls_access SET status='closed', closed_at=?, closed_by='admin'
        WHERE admin_id=? AND status='granted' AND id<>?", [ls_now(), $adminId, $id]);
    $tok = bin2hex(random_bytes(32));
    update('ls_access', ['enter_hash' => hash('sha256', $tok), 'entered_at' => ls_now()], 'id=:id', ['id' => $id]);
    setcookie(LS_COOKIE, $tok, [
        'expires' => $until, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
        'secure' => (($_SERVER['HTTPS'] ?? '') === 'on'),
    ]);
    $_COOKIE[LS_COOKIE] = $tok;
    ls_log_for($id, 'Вход в кабинет');
    return true;
}

function ls_drop_cookie(): void {
    setcookie(LS_COOKIE, '', ['expires' => time() - 3600, 'path' => '/']);
    unset($_COOKIE[LS_COOKIE]);
}

/** Админка — всегда от своего имени: кука входа там не действует. */
function ls_route_is_admin(): bool {
    $p = (string) (parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?: '/');
    return $p === '/admin' || str_starts_with($p, '/admin/');
}

/**
 * Действующий вход в чужой кабинет в этом браузере — или null.
 * ['row' => строка ls_access, 'admin' => администратор, 'user' => участник].
 */
function ls_current(): ?array {
    static $c = false;
    if ($c !== false) return $c;
    $c = null;
    if (PHP_SAPI === 'cli') return $c;
    $tok = (string) ($_COOKIE[LS_COOKIE] ?? '');
    if ($tok === '' || ls_route_is_admin()) return $c;
    ls_expire();
    $r = one("SELECT * FROM ls_access WHERE enter_hash=? AND status='granted'", [hash('sha256', $tok)]);
    if (!$r || (int) strtotime((string) $r['granted_until']) <= time()) return $c;
    $admin = ls_admin_from_cookie();
    if (!$admin || (int) $admin['id'] !== (int) $r['admin_id']) return $c;
    $user = one("SELECT * FROM users WHERE id=? AND COALESCE(blocked,0)=0", [(int) $r['user_id']]);
    if (!$user) return $c;
    $c = ['row' => $r, 'admin' => $admin, 'user' => $user];
    return $c;
}

function ls_active(): bool { return ls_current() !== null; }

/** Запись в журнал запроса — что сделано в кабинете участника. */
function ls_log_for(int $id, string $what): void {
    ls_boot();
    $r = one("SELECT log FROM ls_access WHERE id=?", [$id]);
    if (!$r) return;
    $log = json_decode((string) $r['log'], true);
    if (!is_array($log)) $log = [];
    $log[] = ['t' => date('H:i'), 'a' => mb_substr($what, 0, 200)];
    if (count($log) > 200) $log = array_slice($log, -200);
    q("UPDATE ls_access SET log=?, actions=actions+1 WHERE id=?", [json_encode($log, JSON_UNESCAPED_UNICODE), $id]);
}

function ls_log(string $what): void {
    $c = ls_current();
    if ($c) ls_log_for((int) $c['row']['id'], $what);
}

/**
 * Что можно делать в API под администратором. Список разрешённого, а не
 * запрещённого: новый эндпоинт не должен открыться сам собой.
 */
function ls_api_allowed(string $endpoint): bool {
    return in_array($endpoint, [
        'apply', 'app_search', 'address_suggest', 'order', 'order_manage', 'pay_status',
        'video_check', 'teacher_group', 'teacher_import', 'track', 'verify', 'vk_sub_check',
        'ls_access',
    ], true);
}

/** Понятные названия действий для журнала. */
function ls_api_label(string $endpoint): string {
    return [
        'apply' => 'Подача заявки на участие', 'order' => 'Оформление заказа наград',
        'order_manage' => 'Действие с заказом', 'teacher_group' => 'Групповая заявка педагога',
        'teacher_import' => 'Загрузка списка участников', 'app_search' => 'Поиск заявки',
        'video_check' => 'Проверка ссылки на видео', 'address_suggest' => 'Подсказка адреса',
    ][$endpoint] ?? '';
}

/** Формы кабинета под администратором: только правка заявки и повтор диплома на почту. */
function ls_cabinet_action_allowed(string $action): bool {
    return in_array($action, ['edit_app', 'resend_diploma'], true);
}

/** Короткое имя участника: «Иванова А. С.». */
function ls_short_name(array $u): string {
    $n = trim((string) ($u['full_name'] ?? ''));
    if ($n === '') return (string) ($u['email'] ?? 'участник');
    $p = preg_split('/\s+/u', $n);
    $s = $p[0];
    foreach (array_slice($p, 1, 2) as $x) $s .= ' ' . mb_substr($x, 0, 1) . '.';
    return $s;
}

/** Полоса на каждой странице сайта, пока администратор в чужом кабинете. */
function ls_banner_html(): string {
    $c = ls_current();
    if (!$c) return '';
    $left = max(0, (int) ceil(((int) strtotime((string) $c['row']['granted_until']) - time()) / 60));
    return '<div id="lsBar" style="position:sticky;top:0;z-index:10000;display:flex;flex-wrap:wrap;align-items:center;'
        . 'justify-content:center;gap:8px 14px;padding:9px 16px;background:#B3261E;color:#fff;font:600 13px/1.35 Montserrat,system-ui,sans-serif;text-align:center">'
        . '<span>Вы в кабинете участника <b>' . h(ls_short_name($c['user'])) . '</b> от имени администратора · '
        . 'осталось <b id="lsLeft">' . $left . '</b> мин. Оплата, почта и пароль здесь недоступны.</span>'
        . '<a href="' . h(url('/ls-exit')) . '" style="color:#B3261E;background:#fff;border-radius:8px;padding:5px 12px;text-decoration:none">Выйти из кабинета участника</a>'
        . '</div>'
        . '<script>(function(){var u=' . (int) strtotime((string) $c['row']['granted_until']) . '*1000,e=document.getElementById("lsLeft");'
        . 'setInterval(function(){var m=Math.ceil((u-Date.now())/60000);if(m<=0){location.href=' . json_encode(url('/ls-exit')) . ';return;}if(e)e.textContent=m;},15000);})();</script>';
}
