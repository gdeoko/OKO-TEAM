<?php
/**
 * V.LIONOFF · админ-API.
 *
 * Два входа: админ Телеграма (id в настройках) и пароль панели. Пароль нужен,
 * чтобы владелец мог зайти с компьютера, где Телеграма нет.
 */
declare(strict_types=1);

function vc_admin_guard(): array {
  $cfg = vc_cfg();
  $u = vc_current_user();
  if ($u && vc_is_admin($u)) { return $u; }
  $pass = (string)($_SERVER['HTTP_X_VCODE_ADMIN'] ?? vc_in('admin_pass', ''));
  if ($cfg['admin_pass'] !== '' && hash_equals((string)$cfg['admin_pass'], $pass)) {
    return ['id' => 0, 'first_name' => 'Панель', 'last_name' => '', 'role' => 'admin',
            'tg_id' => 0, 'is_admin' => true];
  }
  vc_fail('нужен доступ администратора', 403);
}

function vc_admin_route(string $route): void {
  $route = trim($route, '/');
  $me = vc_admin_guard();
  $cfg = vc_cfg();

  switch ($route) {

  case '':
  case 'ping':
    vc_out(['ok' => true, 'admin' => true, 'name' => $me['first_name']]);

  case 'stats': {
    $day = date('Y-m-d');
    $since7 = date('Y-m-d', strtotime('-7 day'));
    vc_out(['ok' => true, 'stats' => [
      'users'        => (int) vc_val('SELECT COUNT(*) FROM users'),
      'users_today'  => (int) vc_val('SELECT COUNT(*) FROM users WHERE date(created_at)=?', [$day]),
      'users_week'   => (int) vc_val('SELECT COUNT(*) FROM users WHERE date(created_at)>=?', [$since7]),
      'active_today' => (int) vc_val('SELECT COUNT(*) FROM users WHERE date(last_seen_at)=?', [$day]),
      'pro'          => (int) vc_val("SELECT COUNT(*) FROM users WHERE plan!='free'"),
      'lessons_done' => (int) vc_val("SELECT COUNT(*) FROM progress WHERE state='done'"),
      'certificates' => (int) vc_val('SELECT COUNT(*) FROM certificates'),
      'orders'       => (int) vc_val('SELECT COUNT(*) FROM orders'),
      'orders_new'   => (int) vc_val("SELECT COUNT(*) FROM orders WHERE status='moderation'"),
      'responses'    => (int) vc_val('SELECT COUNT(*) FROM responses'),
      'revenue'      => (int) vc_val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='paid'"),
      'revenue_month'=> (int) vc_val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='paid' AND paid_at>=?",
                                     [date('Y-m-01')]),
      'leads'        => (int) vc_val('SELECT COUNT(*) FROM leads'),
    ],
    'by_day' => vc_all("SELECT date(created_at) AS d, COUNT(*) AS n FROM users
                        WHERE date(created_at)>=? GROUP BY d ORDER BY d", [date('Y-m-d', strtotime('-14 day'))]),
    'funnel' => [
      'открыли'    => (int) vc_val("SELECT COUNT(DISTINCT user_id) FROM events WHERE kind='open_app'"),
      'начали'     => (int) vc_val("SELECT COUNT(DISTINCT user_id) FROM progress"),
      'прошли урок'=> (int) vc_val("SELECT COUNT(DISTINCT user_id) FROM progress WHERE state='done'"),
      'оплатили'   => (int) vc_val("SELECT COUNT(DISTINCT user_id) FROM payments WHERE status='paid'"),
    ]]);
  }

  case 'users': {
    $q = trim((string) vc_in('q', ''));
    $sql = 'SELECT * FROM users WHERE 1=1'; $args = [];
    if ($q !== '') {
      $sql .= ' AND (username LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR CAST(tg_id AS TEXT) LIKE ?)';
      array_push($args, "%$q%", "%$q%", "%$q%", "%$q%");
    }
    $sql .= ' ORDER BY id DESC LIMIT 300';
    $rows = array_map(function ($u) {
      return ['id' => (int)$u['id'], 'tg_id' => (int)$u['tg_id'], 'username' => $u['username'],
              'name' => trim($u['first_name'] . ' ' . $u['last_name']), 'role' => $u['role'],
              'city' => $u['city'], 'plan' => $u['plan'], 'plan_until' => $u['plan_until'],
              'xp' => (int)$u['xp'], 'streak' => (int)$u['streak'],
              'blocked' => (int)$u['is_blocked'], 'verified' => (int)$u['is_verified'],
              'created_at' => $u['created_at'], 'last_seen_at' => $u['last_seen_at'],
              'done' => (int) vc_val("SELECT COUNT(*) FROM progress WHERE user_id=? AND state='done'", [$u['id']])];
    }, vc_all($sql, $args));
    vc_out(['ok' => true, 'items' => $rows]);
  }

  case 'user/save': {
    $id = (int) vc_in('id', 0);
    $fields = [];
    foreach (['role', 'plan', 'plan_until', 'city'] as $k) {
      $v = vc_in($k, null);
      if ($v !== null) { $fields[$k] = (string)$v; }
    }
    foreach (['is_blocked', 'is_verified'] as $k) {
      $v = vc_in($k, null);
      if ($v !== null) { $fields[$k] = (int)(bool)$v; }
    }
    if ($fields && $id) { vc_update('users', $fields, 'id=?', [$id]); }
    vc_out(['ok' => true]);
  }

  case 'courses': {
    $items = [];
    foreach (vc_all('SELECT * FROM courses ORDER BY sort, id') as $c) {
      $c['lessons'] = (int) vc_val('SELECT COUNT(*) FROM lessons WHERE course_id=?', [$c['id']]);
      $c['blocks'] = vc_all('SELECT id,slug,title,sort FROM blocks WHERE course_id=? ORDER BY sort,id', [$c['id']]);
      $items[] = $c;
    }
    vc_out(['ok' => true, 'items' => $items]);
  }

  case 'course/save': {
    $id = (int) vc_in('id', 0);
    $data = [];
    foreach (['slug','title','subtitle','descr','cover','accent','access','level','duration','author','status'] as $k) {
      $v = vc_in($k, null);
      if ($v !== null) { $data[$k] = (string)$v; }
    }
    foreach (['price','sort','cert'] as $k) {
      $v = vc_in($k, null);
      if ($v !== null) { $data[$k] = (int)$v; }
    }
    if ($id) { vc_update('courses', $data, 'id=?', [$id]); }
    else { $id = vc_insert('courses', $data + ['slug' => $data['slug'] ?? ('course-' . time())]); }
    vc_out(['ok' => true, 'id' => $id]);
  }

  case 'lessons': {
    $courseId = (int) vc_in('course_id', 0);
    vc_out(['ok' => true, 'items' => vc_all(
      'SELECT l.id,l.title,l.slug,l.summary,l.minutes,l.xp,l.free,l.sort,l.status,l.block_id,b.title AS block
       FROM lessons l JOIN blocks b ON b.id=l.block_id WHERE l.course_id=? ORDER BY b.sort,l.sort', [$courseId])]);
  }

  case 'lesson': {
    vc_out(['ok' => true, 'lesson' => vc_one('SELECT * FROM lessons WHERE id=?', [(int) vc_in('id', 0)])]);
  }

  case 'lesson/save': {
    $id = (int) vc_in('id', 0);
    $data = [];
    foreach (['title','slug','summary','notes','practice','audio','status'] as $k) {
      $v = vc_in($k, null);
      if ($v !== null) { $data[$k] = (string)$v; }
    }
    foreach (['minutes','xp','free','sort','block_id','course_id'] as $k) {
      $v = vc_in($k, null);
      if ($v !== null) { $data[$k] = (int)$v; }
    }
    foreach (['slides','quiz'] as $k) {
      $v = vc_in($k, null);
      if ($v !== null) { $data[$k] = is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE); }
    }
    if ($id) { vc_update('lessons', $data, 'id=?', [$id]); }
    else { $id = vc_insert('lessons', $data); }
    vc_out(['ok' => true, 'id' => $id]);
  }

  case 'orders': {
    vc_out(['ok' => true, 'items' => vc_all(
      'SELECT o.*, (SELECT COUNT(*) FROM responses r WHERE r.order_id=o.id) AS responses,
              u.username AS client_username
       FROM orders o LEFT JOIN users u ON u.id=o.client_id ORDER BY o.id DESC LIMIT 200')]);
  }

  case 'order/save': {
    $id = (int) vc_in('id', 0);
    $status = (string) vc_in('status', '');
    if ($id && $status) {
      vc_update('orders', ['status' => $status], 'id=?', [$id]);
      $o = vc_one('SELECT * FROM orders WHERE id=?', [$id]);
      if ($status === 'open' && $o && $o['client_id']) {
        $cu = vc_one('SELECT tg_id FROM users WHERE id=?', [$o['client_id']]);
        if ($cu) { vc_tg_send((int)$cu['tg_id'], 'Ваша заявка «' . $o['title'] . '» опубликована на бирже V.LIONOFF.'); }
      }
    }
    vc_out(['ok' => true]);
  }

  case 'payments': {
    vc_out(['ok' => true, 'items' => vc_all(
      'SELECT p.*, u.username, u.first_name FROM payments p LEFT JOIN users u ON u.id=p.user_id
       ORDER BY p.id DESC LIMIT 200')]);
  }

  case 'payment/mark': {
    $id = (int) vc_in('id', 0);
    $pay = vc_one('SELECT * FROM payments WHERE id=?', [$id]);
    if (!$pay) { vc_fail('платёж не найден', 404); }
    if ($pay['status'] !== 'paid') { vc_pay_apply($pay, 'отмечено вручную'); }
    vc_out(['ok' => true]);
  }

  case 'promos': {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      $code = strtoupper(trim((string) vc_in('code', '')));
      if ($code) {
        vc_q('INSERT INTO promos(code,percent,fixed,limit_count,until,active) VALUES(?,?,?,?,?,1)
              ON CONFLICT(code) DO UPDATE SET percent=excluded.percent, fixed=excluded.fixed,
              limit_count=excluded.limit_count, until=excluded.until, active=excluded.active',
             [$code, (int) vc_in('percent', 0), (int) vc_in('fixed', 0),
              (int) vc_in('limit_count', 0), (string) vc_in('until', '')]);
      }
    }
    vc_out(['ok' => true, 'items' => vc_all('SELECT * FROM promos ORDER BY id DESC')]);
  }

  case 'posts': {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      $id = (int) vc_in('id', 0);
      $data = ['title' => (string) vc_in('title', ''), 'text' => (string) vc_in('text', ''),
               'cover' => (string) vc_in('cover', ''), 'link' => (string) vc_in('link', ''),
               'pinned' => (int) vc_in('pinned', 0), 'status' => (string) vc_in('status', 'published')];
      if ($id) { vc_update('posts', $data, 'id=?', [$id]); } else { vc_insert('posts', $data); }
    }
    vc_out(['ok' => true, 'items' => vc_all('SELECT * FROM posts ORDER BY pinned DESC, id DESC LIMIT 100')]);
  }

  case 'broadcast': {
    $text = trim((string) vc_in('text', ''));
    $audience = (string) vc_in('audience', 'all');
    if ($text === '') { vc_fail('пустая рассылка'); }
    $sql = 'SELECT tg_id FROM users WHERE notify=1 AND is_blocked=0 AND tg_id IS NOT NULL';
    if ($audience === 'free')     { $sql .= " AND plan='free'"; }
    if ($audience === 'pro')      { $sql .= " AND plan!='free'"; }
    if ($audience === 'creators') { $sql .= " AND role='creator'"; }
    if ($audience === 'clients')  { $sql .= " AND role='client'"; }
    $rows = vc_all($sql);
    $bid = vc_insert('broadcasts', ['text' => $text, 'audience' => $audience,
                                    'total' => count($rows), 'status' => 'sending']);
    $sent = 0;
    foreach ($rows as $i => $r) {
      $res = vc_tg_send((int)$r['tg_id'], $text, vc_tg_app_button());
      if ($res && !empty($res['ok'])) { $sent++; }
      if ($i % 25 === 24) { usleep(900000); }   // темп: Телеграм не любит пачки
    }
    vc_update('broadcasts', ['sent' => $sent, 'status' => 'done'], 'id=?', [$bid]);
    vc_out(['ok' => true, 'sent' => $sent, 'total' => count($rows)]);
  }

  case 'settings': {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
      foreach ((array) vc_in('values', []) as $k => $v) {
        vc_setting_set((string)$k, (string)$v);
      }
    }
    $rows = [];
    foreach (vc_all('SELECT key,value FROM settings') as $r) { $rows[$r['key']] = $r['value']; }
    vc_out(['ok' => true, 'values' => $rows, 'bot' => $cfg['bot'],
            'payments' => ['lava' => $cfg['lava']['key'] !== '', 'yookassa' => $cfg['yookassa']['shop'] !== '']]);
  }

  case 'leads': {
    vc_out(['ok' => true, 'items' => vc_all('SELECT * FROM leads ORDER BY updated_at DESC LIMIT 200')]);
  }

  default:
    vc_fail('нет такого раздела админки: ' . $route, 404);
  }
}
