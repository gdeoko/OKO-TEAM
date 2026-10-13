<?php
/**
 * V.LIONOFF · API мини-приложения.
 *
 * Один вход: /api/<маршрут>. Ответ всегда JSON. Авторизация — initData
 * Телеграма (разово) и подписанный токен сессии дальше.
 */
declare(strict_types=1);

require_once __DIR__ . '/../../core/db.php';
require_once __DIR__ . '/../../core/auth.php';
require_once __DIR__ . '/../../core/telegram.php';
require_once __DIR__ . '/../../core/lessons.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$cfg = vc_cfg();

function vc_out($data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function vc_fail(string $why, int $code = 400): void { vc_out(['ok' => false, 'error' => $why], $code); }

function vc_body(): array {
  static $b = null;
  if ($b !== null) { return $b; }
  $raw = file_get_contents('php://input');
  $b = $raw ? (json_decode($raw, true) ?: []) : [];
  if (!$b && $_POST) { $b = $_POST; }
  return $b;
}
function vc_in(string $key, $default = null) {
  $b = vc_body();
  return $b[$key] ?? ($_GET[$key] ?? $default);
}
function vc_need_user(): array {
  $u = vc_current_user();
  if (!$u) { vc_fail('нужен вход через Телеграм', 401); }
  return $u;
}
function vc_need_admin(): array {
  $u = vc_need_user();
  if (empty($u['is_admin'])) { vc_fail('только для администратора', 403); }
  return $u;
}
function vc_j($v, $default = []) {
  if (is_array($v)) { return $v; }
  $d = json_decode((string)$v, true);
  return is_array($d) ? $d : $default;
}

/** Публичная карточка пользователя. */
function vc_user_public(array $u): array {
  return [
    'id' => (int)$u['id'],
    'name' => trim($u['first_name'] . ' ' . $u['last_name']) ?: ($u['username'] ?: 'Креатор'),
    'username' => $u['username'],
    'photo' => $u['photo_url'],
    'city' => $u['city'],
    'about' => $u['about'],
    'services' => vc_j($u['services']),
    'price_from' => $u['price_from'] ? (int)$u['price_from'] : null,
    'links' => vc_j($u['links'], []),
    'portfolio' => vc_j($u['portfolio']),
    'rating' => (float)$u['rating'],
    'deals' => (int)$u['deals_done'],
    'level' => (int)$u['level'],
    'verified' => (int)$u['is_verified'] === 1,
  ];
}

// Счёт уровня и серии живёт в core/lessons.php: там же его берёт бот.
function vc_level_of(int $xp): array { return vc_levels($xp); }

function vc_touch_streak(array $u, int $xp = 0): array { return vc_streak_touch($u, $xp); }

function vc_course_row(array $c, ?array $u): array {
  $total = (int) vc_val('SELECT COUNT(*) FROM lessons WHERE course_id=? AND status="published"', [$c['id']]);
  $done = $u ? (int) vc_val('SELECT COUNT(*) FROM progress WHERE user_id=? AND course_id=? AND state="done"',
                            [$u['id'], $c['id']]) : 0;
  $blocks = (int) vc_val('SELECT COUNT(*) FROM blocks WHERE course_id=?', [$c['id']]);
  return [
    'id' => (int)$c['id'], 'slug' => $c['slug'], 'title' => $c['title'],
    'subtitle' => $c['subtitle'], 'descr' => $c['descr'], 'cover' => $c['cover'],
    'accent' => $c['accent'], 'access' => $c['access'], 'price' => (int)$c['price'],
    'level' => $c['level'], 'duration' => $c['duration'], 'author' => $c['author'],
    'cert' => (int)$c['cert'] === 1, 'status' => $c['status'],
    'lessons' => $total, 'blocks' => $blocks, 'done' => $done,
    'free_lessons' => (int) vc_val("SELECT COUNT(*) FROM lessons WHERE course_id=? AND free=1 AND status='published'", [$c['id']]),
    'percent' => $total ? (int) round($done * 100 / $total) : 0,
    'opened' => vc_has_access($u, $c),
  ];
}

// ─────────────────────────── МАРШРУТИЗАЦИЯ ───────────────────────────

$route = trim((string)($_GET['r'] ?? ''), '/');
if ($route === '') {
  $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
  $route = trim(preg_replace('#^.*/api/?#', '', $uri), '/');
}
$route = preg_replace('/[^a-z0-9_\/-]/i', '', $route);

try {

switch ($route) {

// ── вход ──────────────────────────────────────────────────────────────
case 'auth': {
  $init = (string) vc_in('initData', '');
  $data = vc_check_init_data($init, $cfg['bot_token']);
  if (!$data || empty($data['user'])) {
    // Режим сайта: без Телеграма пускаем в демо-чтение, без прогресса.
    vc_out(['ok' => true, 'guest' => true, 'user' => null,
            'app' => ['name' => $cfg['name'], 'bot' => $cfg['bot'],
                      'support' => $cfg['support'], 'fee' => $cfg['fee_percent'],
                      'plan_price' => $cfg['plan_price']]]);
  }
  $start = (string) vc_in('start', '');
  $u = vc_user_upsert($data['user'], $start);
  if ($start && str_starts_with($start, 'ref') && !$u['ref_by']) {
    $code = strtoupper(substr($start, 3));
    $inviter = vc_one('SELECT id FROM users WHERE ref_code=?', [$code]);
    if ($inviter && (int)$inviter['id'] !== (int)$u['id']) {
      vc_update('users', ['ref_by' => $inviter['id']], 'id=?', [$u['id']]);
    }
  }
  vc_event((int)$u['id'], 'open_app');
  $u['is_admin'] = vc_is_admin($u);
  vc_out(['ok' => true, 'token' => vc_token_make((int)$u['id']),
          'user' => vc_me($u),
          'app' => ['name' => $cfg['name'], 'bot' => $cfg['bot'],
                    'support' => $cfg['support'], 'fee' => $cfg['fee_percent'],
                    'plan_price' => $cfg['plan_price'],
                    'base_url' => $cfg['base_url']]]);
}

// ── главная ───────────────────────────────────────────────────────────
case 'home': {
  $u = vc_current_user();
  $courses = array_map(fn($c) => vc_course_row($c, $u),
    vc_all("SELECT * FROM courses WHERE status!='draft' ORDER BY sort, id"));
  $continue = null;
  if ($u) {
    $row = vc_one("SELECT l.*, c.slug AS cslug, c.title AS ctitle FROM progress p
                   JOIN lessons l ON l.id=p.lesson_id JOIN courses c ON c.id=l.course_id
                   WHERE p.user_id=? ORDER BY p.updated_at DESC LIMIT 1", [$u['id']]);
    if ($row) {
      $continue = ['lesson_id' => (int)$row['id'], 'title' => $row['title'],
                   'course' => $row['ctitle'], 'course_slug' => $row['cslug']];
    } else {
      $first = vc_one("SELECT l.*, c.slug AS cslug, c.title AS ctitle FROM lessons l
                       JOIN courses c ON c.id=l.course_id WHERE c.status='published'
                       ORDER BY c.sort, l.sort LIMIT 1");
      if ($first) {
        $continue = ['lesson_id' => (int)$first['id'], 'title' => $first['title'],
                     'course' => $first['ctitle'], 'course_slug' => $first['cslug']];
      }
    }
  }
  $feed = vc_all("SELECT id,title,text,cover,link,pinned,created_at FROM posts
                  WHERE status='published' ORDER BY pinned DESC, id DESC LIMIT 12");
  $orders = vc_all("SELECT id,title,kind,city,budget,created_at FROM orders
                    WHERE status='open' ORDER BY id DESC LIMIT 5");
  vc_out(['ok' => true, 'courses' => $courses, 'continue' => $continue,
          'feed' => $feed, 'orders' => $orders,
          'me' => $u ? vc_me($u) : null,
          'stats' => [
            'creators' => (int) vc_val("SELECT COUNT(*) FROM users WHERE role='creator'"),
            'orders'   => (int) vc_val("SELECT COUNT(*) FROM orders WHERE status IN ('open','in_work','done')"),
            'lessons'  => (int) vc_val("SELECT COUNT(*) FROM lessons WHERE status='published'"),
          ]]);
}

// ── академия ──────────────────────────────────────────────────────────
case 'courses': {
  $u = vc_current_user();
  vc_out(['ok' => true, 'courses' => array_map(fn($c) => vc_course_row($c, $u),
    vc_all("SELECT * FROM courses WHERE status!='draft' ORDER BY sort, id"))]);
}

case 'course': {
  $u = vc_current_user();
  $slug = (string) vc_in('slug', '');
  $c = vc_one('SELECT * FROM courses WHERE slug=?', [$slug]);
  if (!$c) { vc_fail('курс не найден', 404); }
  $prog = [];
  if ($u) {
    foreach (vc_all('SELECT lesson_id,state,score,slide FROM progress WHERE user_id=? AND course_id=?',
                    [$u['id'], $c['id']]) as $p) { $prog[(int)$p['lesson_id']] = $p; }
  }
  $blocks = [];
  foreach (vc_all('SELECT * FROM blocks WHERE course_id=? ORDER BY sort, id', [$c['id']]) as $b) {
    $lessons = [];
    foreach (vc_all("SELECT * FROM lessons WHERE block_id=? AND status='published' ORDER BY sort, id",
                    [$b['id']]) as $l) {
      $p = $prog[(int)$l['id']] ?? null;
      $lessons[] = [
        'id' => (int)$l['id'], 'slug' => $l['slug'], 'title' => $l['title'],
        'summary' => $l['summary'], 'minutes' => (int)$l['minutes'], 'xp' => (int)$l['xp'],
        'slides' => count(vc_j($l['slides'])), 'quiz' => count(vc_j($l['quiz'])),
        'free' => (int)$l['free'] === 1,
        'opened' => vc_has_access($u, $c, $l),
        'state' => $p['state'] ?? 'new', 'score' => (int)($p['score'] ?? 0),
      ];
    }
    $blocks[] = ['id' => (int)$b['id'], 'slug' => $b['slug'], 'title' => $b['title'],
                 'descr' => $b['descr'], 'cover' => $b['cover'] ?? '', 'lessons' => $lessons];
  }
  $cert = $u ? vc_one('SELECT * FROM certificates WHERE user_id=? AND course_id=?',
                      [$u['id'], $c['id']]) : null;
  vc_out(['ok' => true, 'course' => vc_course_row($c, $u), 'blocks' => $blocks,
          'certificate' => $cert]);
}

case 'lesson': {
  $u = vc_current_user();
  $id = (int) vc_in('id', 0);
  $l = vc_one("SELECT * FROM lessons WHERE id=? AND status='published'", [$id]);
  if (!$l) { vc_fail('урок не найден', 404); }
  $c = vc_one('SELECT * FROM courses WHERE id=?', [$l['course_id']]);
  $open = vc_has_access($u, $c, $l);
  if (!$open) {
    vc_out(['ok' => true, 'locked' => true, 'course' => vc_course_row($c, $u),
            'lesson' => ['id' => (int)$l['id'], 'title' => $l['title'],
                         'summary' => $l['summary']]]);
  }
  if ($u) {
    vc_q('INSERT INTO progress(user_id,lesson_id,course_id,state) VALUES(?,?,?,?)
          ON CONFLICT(user_id,lesson_id) DO UPDATE SET updated_at=datetime("now")',
         [$u['id'], $l['id'], $l['course_id'], 'opened']);
    vc_event((int)$u['id'], 'lesson_open', ['id' => (int)$l['id']]);
  }
  $nav = vc_all("SELECT id,title FROM lessons WHERE course_id=? AND status='published' ORDER BY sort,id",
                [$l['course_id']]);
  $pos = 0;
  foreach ($nav as $i => $n) { if ((int)$n['id'] === (int)$l['id']) { $pos = $i; } }
  $p = $u ? vc_one('SELECT * FROM progress WHERE user_id=? AND lesson_id=?', [$u['id'], $l['id']]) : null;
  vc_out(['ok' => true, 'locked' => false,
    'course' => ['slug' => $c['slug'], 'title' => $c['title'], 'accent' => $c['accent']],
    'lesson' => [
      'id' => (int)$l['id'], 'title' => $l['title'], 'summary' => $l['summary'],
      'minutes' => (int)$l['minutes'], 'xp' => (int)$l['xp'],
      'slides' => vc_j($l['slides']), 'notes' => $l['notes'],
      'practice' => $l['practice'], 'quiz' => vc_j($l['quiz']), 'audio' => $l['audio'],
      'video' => $l['video'] ?? '',
      'state' => $p['state'] ?? 'new', 'slide' => (int)($p['slide'] ?? 0),
      'score' => (int)($p['score'] ?? 0),
    ],
    'prev' => $pos > 0 ? ['id' => (int)$nav[$pos-1]['id'], 'title' => $nav[$pos-1]['title']] : null,
    'next' => isset($nav[$pos+1]) ? ['id' => (int)$nav[$pos+1]['id'], 'title' => $nav[$pos+1]['title']] : null,
  ]);
}

case 'lesson/slide': {
  $u = vc_need_user();
  $id = (int) vc_in('id', 0); $slide = (int) vc_in('slide', 0);
  $l = vc_one('SELECT * FROM lessons WHERE id=?', [$id]);
  if (!$l) { vc_fail('урок не найден', 404); }
  vc_q('INSERT INTO progress(user_id,lesson_id,course_id,slide) VALUES(?,?,?,?)
        ON CONFLICT(user_id,lesson_id) DO UPDATE SET slide=excluded.slide, updated_at=datetime("now")',
       [$u['id'], $id, $l['course_id'], $slide]);
  vc_out(['ok' => true]);
}

case 'lesson/quiz': {
  $u = vc_need_user();
  $id = (int) vc_in('id', 0);
  $answers = vc_in('answers', []);
  $полный = vc_lesson_full($id, $u);
  if (!$полный) { vc_fail('урок не найден', 404); }
  if (!$полный['open']) { vc_fail('урок закрыт тарифом', 403); }
  $итог = vc_quiz_apply($u, $полный['lesson'], (array)$answers);
  vc_out(['ok' => true] + $итог);
}

case 'certificates': {
  $u = vc_need_user();
  vc_out(['ok' => true, 'items' => vc_all(
    'SELECT c.number, c.issued_at, k.title, k.slug FROM certificates c
     JOIN courses k ON k.id=c.course_id WHERE c.user_id=? ORDER BY c.id DESC', [$u['id']])]);
}

// ── биржа ─────────────────────────────────────────────────────────────
case 'orders': {
  $u = vc_current_user();
  $kind = (string) vc_in('kind', ''); $city = (string) vc_in('city', '');
  $sql = "SELECT o.*, (SELECT COUNT(*) FROM responses r WHERE r.order_id=o.id) AS responses
          FROM o_view o WHERE 1=1";
  $sql = str_replace('o_view', 'orders', $sql);
  $args = [];
  $sql .= " AND o.status IN ('open','in_work')";
  if ($kind) { $sql .= ' AND o.kind=?'; $args[] = $kind; }
  if ($city) { $sql .= ' AND (o.city=? OR o.remote=1)'; $args[] = $city; }
  $sql .= ' ORDER BY o.id DESC LIMIT 100';
  $rows = vc_all($sql, $args);
  $mine = [];
  if ($u) {
    foreach (vc_all('SELECT order_id,status FROM responses WHERE user_id=?', [$u['id']]) as $r) {
      $mine[(int)$r['order_id']] = $r['status'];
    }
  }
  foreach ($rows as &$r) { $r['my_response'] = $mine[(int)$r['id']] ?? null; }
  vc_out(['ok' => true, 'items' => $rows, 'fee' => $cfg['fee_percent']]);
}

case 'orders/create': {
  $u = vc_need_user();
  $title = trim((string) vc_in('title', ''));
  if (mb_strlen($title) < 5) { vc_fail('опишите задачу в заголовке'); }
  $id = vc_insert('orders', [
    'client_id' => $u['id'], 'title' => mb_substr($title, 0, 160),
    'descr' => mb_substr(trim((string) vc_in('descr', '')), 0, 4000),
    'kind' => (string) vc_in('kind', 'reels'),
    'city' => mb_substr(trim((string) vc_in('city', '')), 0, 80),
    'remote' => (int) vc_in('remote', 1),
    'budget' => (int) vc_in('budget', 0),
    'deadline' => mb_substr((string) vc_in('deadline', ''), 0, 60),
    'contact' => mb_substr((string) vc_in('contact', ''), 0, 120),
    'status' => 'moderation', 'fee_percent' => $cfg['fee_percent'],
  ]);
  vc_event((int)$u['id'], 'order_create', ['id' => $id]);
  vc_tg_notify_admins("Новая заявка №$id: $title\nБюджет: " . (int) vc_in('budget', 0) . " ₽");
  vc_out(['ok' => true, 'id' => $id, 'status' => 'moderation']);
}

case 'orders/respond': {
  $u = vc_need_user();
  $orderId = (int) vc_in('order_id', 0);
  $o = vc_one('SELECT * FROM orders WHERE id=?', [$orderId]);
  if (!$o || !in_array($o['status'], ['open', 'in_work'], true)) { vc_fail('заявка закрыта'); }
  $done = (int) vc_val("SELECT COUNT(*) FROM progress WHERE user_id=? AND state='done'", [$u['id']]);
  if ($done < 3 && !vc_is_admin($u)) {
    vc_fail('откликаться можно после трёх пройденных уроков: так заказчик видит обученных', 403);
  }
  try {
    vc_insert('responses', ['order_id' => $orderId, 'user_id' => $u['id'],
      'text' => mb_substr(trim((string) vc_in('text', '')), 0, 1500),
      'price' => (int) vc_in('price', 0)]);
  } catch (Throwable $e) { vc_fail('отклик уже отправлен'); }
  vc_tg_notify_admins("Отклик на заявку №$orderId от @" . ($u['username'] ?: $u['tg_id']));
  vc_out(['ok' => true]);
}

case 'order': {
  $u = vc_current_user();
  $o = vc_one('SELECT * FROM orders WHERE id=?', [(int) vc_in('id', 0)]);
  if (!$o) { vc_fail('заявка не найдена', 404); }
  $resp = [];
  if ($u && ((int)$o['client_id'] === (int)$u['id'] || vc_is_admin($u))) {
    foreach (vc_all('SELECT r.*, u.* FROM responses r JOIN users u ON u.id=r.user_id
                     WHERE r.order_id=? ORDER BY r.id', [$o['id']]) as $r) {
      $resp[] = ['text' => $r['text'], 'price' => (int)$r['price'], 'status' => $r['status'],
                 'user' => vc_user_public($r)];
    }
  }
  vc_out(['ok' => true, 'order' => $o, 'responses' => $resp]);
}

case 'catalog': {
  $city = (string) vc_in('city', '');
  $sql = "SELECT * FROM users WHERE role='creator' AND is_blocked=0";
  $args = [];
  if ($city) { $sql .= ' AND city=?'; $args[] = $city; }
  $sql .= ' ORDER BY is_verified DESC, deals_done DESC, xp DESC LIMIT 100';
  vc_out(['ok' => true, 'items' => array_map('vc_user_public', vc_all($sql, $args))]);
}

// ── профиль и кошелёк ─────────────────────────────────────────────────
case 'profile': {
  $u = vc_need_user();
  if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $fields = [];
    foreach (['city' => 80, 'about' => 600] as $k => $max) {
      $v = vc_in($k, null);
      if ($v !== null) { $fields[$k] = mb_substr(trim((string)$v), 0, $max); }
    }
    if (($r = vc_in('role', null)) && in_array($r, ['creator', 'client'], true)) { $fields['role'] = $r; }
    if (($t = vc_in('theme', null)) && in_array($t, ['dark', 'light'], true)) { $fields['theme'] = $t; }
    if (($n = vc_in('notify', null)) !== null) { $fields['notify'] = (int)(bool)$n; }
    if (($p = vc_in('price_from', null)) !== null) { $fields['price_from'] = (int)$p; }
    foreach (['services', 'links', 'portfolio'] as $k) {
      $v = vc_in($k, null);
      if ($v !== null) { $fields[$k] = json_encode($v, JSON_UNESCAPED_UNICODE); }
    }
    if ($fields) { vc_update('users', $fields, 'id=?', [$u['id']]); }
    $u = vc_one('SELECT * FROM users WHERE id=?', [$u['id']]);
    $u['is_admin'] = vc_is_admin($u);
  }
  vc_out(['ok' => true, 'user' => vc_me($u), 'public' => vc_user_public($u)]);
}

case 'wallet': {
  $u = vc_need_user();
  $refs = vc_all('SELECT id,first_name,username,created_at,plan FROM users WHERE ref_by=? ORDER BY id DESC', [$u['id']]);
  $pays = vc_all('SELECT product,amount,status,created_at,paid_at FROM payments WHERE user_id=? ORDER BY id DESC LIMIT 30', [$u['id']]);
  vc_out(['ok' => true,
    'plan' => ['name' => $u['plan'], 'until' => $u['plan_until'], 'price' => $cfg['plan_price']],
    'balance' => (int)$u['balance'],
    'ref' => ['code' => $u['ref_code'], 'count' => count($refs), 'items' => $refs,
              'link' => 'https://t.me/' . $cfg['bot'] . '?start=ref' . $u['ref_code']],
    'payments' => $pays]);
}

case 'pay': {
  $u = vc_need_user();
  $product = (string) vc_in('product', 'plan:pro');
  $promo = strtoupper(trim((string) vc_in('promo', '')));
  $amount = 0;
  if (str_starts_with($product, 'plan:')) {
    $plan = substr($product, 5);
    $amount = (int)($cfg['plan_price'][$plan] ?? 0);
  } elseif (str_starts_with($product, 'course:')) {
    $c = vc_one('SELECT * FROM courses WHERE slug=?', [substr($product, 7)]);
    if (!$c) { vc_fail('курс не найден', 404); }
    $amount = (int)$c['price'];
  }
  if ($amount <= 0) { vc_fail('неизвестный продукт'); }
  $discount = 0;
  if ($promo) {
    $p = vc_one("SELECT * FROM promos WHERE code=? AND active=1", [$promo]);
    if ($p && ((int)$p['limit_count'] === 0 || (int)$p['used'] < (int)$p['limit_count'])
        && (!$p['until'] || strtotime($p['until']) > time())) {
      $discount = (int)$p['fixed'] + (int) round($amount * (int)$p['percent'] / 100);
    } else { $promo = ''; }
  }
  $amount = max(0, $amount - $discount);
  $payId = vc_insert('payments', ['user_id' => $u['id'], 'product' => $product,
    'amount' => $amount, 'promo' => $promo, 'status' => 'created',
    'provider' => $cfg['lava']['key'] ? 'lava' : 'manual']);
  $url = '';
  if ($cfg['lava']['key']) {
    $url = vc_lava_invoice($payId, $amount, $product, $u);
  }
  vc_out(['ok' => true, 'payment_id' => $payId, 'amount' => $amount,
          'discount' => $discount, 'url' => $url,
          'manual' => $url === '' ? ['support' => $cfg['support']] : null]);
}

case 'pay/webhook': {
  $raw = file_get_contents('php://input');
  $data = json_decode($raw, true) ?: [];
  $payId = (int)($data['orderId'] ?? $data['order_id'] ?? ($_GET['id'] ?? 0));
  $status = strtolower((string)($data['status'] ?? ''));
  $pay = $payId ? vc_one('SELECT * FROM payments WHERE id=?', [$payId]) : null;
  if (!$pay) { vc_out(['ok' => false], 404); }
  if (in_array($status, ['success', 'paid', 'completed', 'succeeded'], true)
      && $pay['status'] !== 'paid') {
    vc_pay_apply($pay, $raw);
  }
  vc_out(['ok' => true]);
}

case 'feed': {
  vc_out(['ok' => true, 'items' => vc_all(
    "SELECT id,title,text,cover,link,pinned,created_at FROM posts WHERE status='published'
     ORDER BY pinned DESC, id DESC LIMIT 50")]);
}

default:
  // Всё, что начинается с admin/, уходит в свой файл.
  if (str_starts_with($route, 'admin')) {
    require __DIR__ . '/admin.php';
    vc_admin_route(substr($route, 5) ?: '');
    exit;
  }
  vc_fail('маршрут не найден: ' . $route, 404);
}

} catch (Throwable $e) {
  if (!empty($cfg['debug'])) {
    vc_fail('сбой: ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine(), 500);
  }
  error_log('[vcode] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
  vc_fail('внутренняя ошибка', 500);
}

// ───────────────────────── вспомогательное ─────────────────────────

/** Карточка себя: всё, что нужно приложению на старте. */
function vc_me(array $u): array {
  $lvl = vc_level_of((int)$u['xp']);
  $done = (int) vc_val("SELECT COUNT(*) FROM progress WHERE user_id=? AND state='done'", [$u['id']]);
  return [
    'id' => (int)$u['id'], 'tg_id' => (int)$u['tg_id'],
    'name' => trim($u['first_name'] . ' ' . $u['last_name']) ?: ($u['username'] ?: 'Креатор'),
    'username' => $u['username'], 'photo' => $u['photo_url'],
    'role' => $u['role'], 'city' => $u['city'], 'about' => $u['about'],
    'services' => vc_j($u['services']), 'links' => vc_j($u['links'], []),
    'portfolio' => vc_j($u['portfolio']), 'price_from' => $u['price_from'],
    'plan' => $u['plan'], 'plan_until' => $u['plan_until'],
    'xp' => (int)$u['xp'], 'level' => $lvl, 'streak' => (int)$u['streak'],
    'lessons_done' => $done, 'balance' => (int)$u['balance'],
    'ref_code' => $u['ref_code'], 'theme' => $u['theme'], 'notify' => (int)$u['notify'],
    'is_admin' => !empty($u['is_admin']) || vc_is_admin($u),
    'verified' => (int)$u['is_verified'] === 1,
  ];
}

/** Платёж прошёл: включаем тариф или открываем курс. */
function vc_pay_apply(array $pay, string $raw = ''): void {
  vc_update('payments', ['status' => 'paid', 'paid_at' => date('Y-m-d H:i:s'),
                         'raw' => mb_substr($raw, 0, 4000)], 'id=?', [$pay['id']]);
  $u = vc_one('SELECT * FROM users WHERE id=?', [$pay['user_id']]);
  if (!$u) { return; }
  if (str_starts_with($pay['product'], 'plan:')) {
    $plan = substr($pay['product'], 5);
    $base = ($u['plan_until'] && strtotime($u['plan_until']) > time())
            ? strtotime($u['plan_until']) : time();
    vc_update('users', ['plan' => $plan, 'plan_until' => date('Y-m-d H:i:s', strtotime('+1 month', $base))],
              'id=?', [$u['id']]);
  }
  if ($pay['promo']) { vc_q('UPDATE promos SET used=used+1 WHERE code=?', [$pay['promo']]); }
  // Реферальное вознаграждение: 30% от платежа на внутренний счёт пригласившего.
  if ($u['ref_by']) {
    $bonus = (int) round((int)$pay['amount'] * 0.30);
    vc_q('UPDATE users SET balance=balance+? WHERE id=?', [$bonus, $u['ref_by']]);
  }
  vc_event((int)$u['id'], 'paid', ['product' => $pay['product'], 'amount' => (int)$pay['amount']]);
  vc_tg_notify_admins("Оплата: " . $pay['product'] . " — " . (int)$pay['amount'] . " ₽, "
                      . ($u['username'] ? '@' . $u['username'] : $u['tg_id']));
  vc_tg_send((int)$u['tg_id'], "Оплата прошла. Доступ открыт — заходите в приложение.");
}

/** Счёт в Lava.top. Без ключа возвращает пустую строку: платим вручную. */
function vc_lava_invoice(int $payId, int $amount, string $product, array $u): string {
  $cfg = vc_cfg();
  $offer = str_starts_with($product, 'plan:') ? $cfg['lava']['offer_pro'] : $cfg['lava']['offer_course'];
  if (!$offer) { return ''; }
  $body = json_encode([
    'email' => $u['email'] ?: ($u['tg_id'] . '@telegram.user'),
    'offerId' => $offer,
    'periodicity' => 'ONE_TIME',
    'currency' => 'RUB',
    'buyerLanguage' => 'RU',
    'clientUtm' => ['utm_source' => 'vcode_app', 'utm_content' => (string)$payId],
  ], JSON_UNESCAPED_UNICODE);
  $ch = curl_init('https://gate.lava.top/api/v2/invoice');
  curl_setopt_array($ch, [
    CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_TIMEOUT => 20,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Api-Key: ' . $cfg['lava']['key']],
  ]);
  $res = curl_exec($ch);
  curl_close($ch);
  $data = json_decode((string)$res, true) ?: [];
  $url = $data['paymentUrl'] ?? ($data['data']['url'] ?? '');
  if ($url) { vc_update('payments', ['ext_id' => (string)($data['id'] ?? ''), 'provider' => 'lava'], 'id=?', [$payId]); }
  return (string) $url;
}
