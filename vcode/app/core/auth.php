<?php
/**
 * V.LIONOFF · вход.
 *
 * Телеграм отдаёт мини-приложению подписанную строку initData. Проверяем её
 * ключом бота (HMAC по документации Telegram), и только после этого заводим
 * или поднимаем пользователя. Своего пароля у креатора нет и не нужно.
 */
require_once __DIR__ . '/db.php';

/** Проверка подписи initData. Возвращает массив полей или null. */
function vc_check_init_data(string $initData, string $botToken, int $maxAge = 86400): ?array {
  if ($initData === '' || $botToken === '') { return null; }
  parse_str($initData, $fields);
  if (empty($fields['hash'])) { return null; }
  $hash = $fields['hash'];
  unset($fields['hash'], $fields['signature']);
  ksort($fields);
  $pairs = [];
  foreach ($fields as $k => $v) { $pairs[] = $k . '=' . $v; }
  $checkString = implode("\n", $pairs);
  $secret = hash_hmac('sha256', $botToken, 'WebAppData', true);
  $calc = bin2hex(hash_hmac('sha256', $checkString, $secret, true));
  if (!hash_equals($calc, $hash)) { return null; }
  if ($maxAge > 0 && !empty($fields['auth_date']) && time() - (int)$fields['auth_date'] > $maxAge) {
    return null;
  }
  if (!empty($fields['user'])) {
    $fields['user'] = json_decode($fields['user'], true) ?: [];
  }
  return $fields;
}

function vc_token_make(int $userId): string {
  $cfg = vc_cfg();
  $payload = base64_encode(json_encode(['u' => $userId, 't' => time()]));
  $sig = hash_hmac('sha256', $payload, $cfg['session_key']);
  return $payload . '.' . $sig;
}

function vc_token_read(string $token): ?int {
  $cfg = vc_cfg();
  $parts = explode('.', $token);
  if (count($parts) !== 2) { return null; }
  [$payload, $sig] = $parts;
  if (!hash_equals(hash_hmac('sha256', $payload, $cfg['session_key']), $sig)) { return null; }
  $data = json_decode(base64_decode($payload), true);
  if (!is_array($data) || empty($data['u'])) { return null; }
  if (time() - (int)($data['t'] ?? 0) > 60 * 60 * 24 * 30) { return null; }
  return (int) $data['u'];
}

function vc_ref_code(int $id): string {
  return 'VC' . strtoupper(base_convert((string)($id * 7919 + 1337), 10, 36));
}

/** Завести или поднять пользователя по данным Телеграма. */
function vc_user_upsert(array $tgUser, string $source = ''): array {
  $tgId = (int) ($tgUser['id'] ?? 0);
  if (!$tgId) { throw new RuntimeException('нет telegram id'); }
  $row = vc_one('SELECT * FROM users WHERE tg_id=?', [$tgId]);
  $fields = [
    'username'   => (string)($tgUser['username'] ?? ''),
    'first_name' => (string)($tgUser['first_name'] ?? ''),
    'last_name'  => (string)($tgUser['last_name'] ?? ''),
    'photo_url'  => (string)($tgUser['photo_url'] ?? ''),
    'last_seen_at' => date('Y-m-d H:i:s'),
  ];
  if (!$row) {
    $id = vc_insert('users', $fields + ['tg_id' => $tgId, 'source' => $source]);
    vc_update('users', ['ref_code' => vc_ref_code($id)], 'id=?', [$id]);
    vc_event($id, 'signup', ['source' => $source]);
    $row = vc_one('SELECT * FROM users WHERE id=?', [$id]);
  } else {
    vc_update('users', $fields, 'id=?', [$row['id']]);
    $row = array_merge($row, $fields);
  }
  return $row;
}

/** Текущий пользователь по заголовку Authorization или initData. */
function vc_current_user(): ?array {
  static $cached = false;
  if ($cached !== false) { return $cached; }
  $cfg = vc_cfg();
  $hdr = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['HTTP_X_VCODE_TOKEN'] ?? '');
  $hdr = trim(str_replace('Bearer', '', $hdr));
  $user = null;
  if ($hdr !== '') {
    $id = vc_token_read($hdr);
    if ($id) { $user = vc_one('SELECT * FROM users WHERE id=?', [$id]); }
  }
  if (!$user) {
    $init = $_SERVER['HTTP_X_TG_INIT'] ?? ($_POST['initData'] ?? '');
    if ($init) {
      $data = vc_check_init_data($init, $cfg['bot_token']);
      if ($data && !empty($data['user'])) { $user = vc_user_upsert($data['user']); }
    }
  }
  if ($user && (int)$user['is_blocked'] === 1) { $user = null; }
  if ($user) {
    vc_update('users', ['last_seen_at' => date('Y-m-d H:i:s')], 'id=?', [$user['id']]);
    $user['is_admin'] = vc_is_admin($user);
  }
  $cached = $user;
  return $user;
}

function vc_is_admin(array $user): bool {
  $cfg = vc_cfg();
  return $user['role'] === 'admin' || in_array((int)$user['tg_id'], $cfg['admin_ids'], true);
}

/** Пускает ли тариф к платному уроку. */
function vc_has_access(?array $user, array $course, array $lesson = []): bool {
  if (!empty($lesson['free'])) { return true; }
  if ($course['access'] === 'free') { return true; }
  if (!$user) { return false; }
  if (vc_is_admin($user)) { return true; }
  $planOk = in_array($user['plan'], ['pro', 'mentor'], true)
    && (!$user['plan_until'] || strtotime($user['plan_until']) > time());
  if ($course['access'] === 'pro') { return $planOk; }
  if ($course['access'] === 'paid') {
    if ($planOk) { return true; }
    $paid = vc_val("SELECT 1 FROM payments WHERE user_id=? AND status='paid' AND product=?",
                   [$user['id'], 'course:' . $course['slug']]);
    return (bool) $paid;
  }
  return false;
}
