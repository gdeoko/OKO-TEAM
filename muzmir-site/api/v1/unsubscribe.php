<?php
/**
 * Отписка от рассылки: GET ?token=<unsub_token> → subscribers.active=0.
 * Отдаёт HTML-страницу подтверждения (тексты по правилам КЦ: «Вы», короткие
 * тире, «ёлочки», без эмодзи). Идемпотентно.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

// _boot ставит JSON — здесь отдаём HTML-страницу.
header('Content-Type: text/html; charset=utf-8');

$token = trim(input('token'));
$state = 'invalid'; // invalid | done | already

/**
 * ОТКАЗ ЗАПИСЫВАЕМ В СТОП-ЛИСТ, А НЕ ТОЛЬКО В ФЛАЖОК.
 *
 * Раньше кнопка ставила subscribers.active=0 и на этом всё. Флажок легко
 * перебивается (сборка учреждений, повторная заливка, вход в кабинет), а
 * mail_stop проверяется в единственной точке отправки — mail_send_failover().
 * Отказ письмом давно пишет туда же (cron/inbox_actions.php), кнопка на сайте
 * должна вести себя так же. Причина «отписался» распознаётся mail_stop_kind()
 * как optout, поэтому дипломы, результаты и коды входа продолжают уходить —
 * закрывается только массовая рассылка.
 */
function unsub_mail_stop(string $email): void {
    $email = mb_strtolower(trim($email));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return;
    try {
        // Таблицу заводит scripts/purge_negative.php — на свежей базе её может не быть.
        db()->exec("CREATE TABLE IF NOT EXISTS mail_stop (
            email TEXT PRIMARY KEY,
            reason TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT '',
            added_at TEXT DEFAULT (datetime('now','localtime')))");
        q("INSERT OR IGNORE INTO mail_stop (email, reason, source) VALUES (?, 'отписался', 'кнопка отписки')", [$email]);
    } catch (\Throwable $e) { /* стоп-лист недоступен — отписка всё равно засчитана */ }
}

// ОТПИСКА УЧРЕЖДЕНИЯ — ПО СВОЕМУ ТОКЕНУ.
//
// Учреждения больше не заводятся в базу участников (списки разные), поэтому их
// ссылка «Отписаться» несёт токен из таблицы institutions. Он начинается с «i»,
// но проверяем по базе, а не по букве.
if ($token !== '' && is_file(BASE_PATH . '/core/institutions.php')) {
    require_once BASE_PATH . '/core/institutions.php';
    $inst = function_exists('inst_by_unsub_token') ? inst_by_unsub_token($token) : null;
    if ($inst) {
        $email = mb_strtolower(trim((string) $inst['email']));
        $state = (string) ($inst['status'] ?? '') === 'unsubscribed' ? 'already' : 'done';
        if ($state === 'done') {
            try { inst_unsubscribe($email); } catch (\Throwable $e) {}
            try {
                q("UPDATE mail_queue SET status='cancelled', error='снято: учреждение отписалось'
                    WHERE LOWER(to_email) = ? AND status IN ('queued','paused') AND COALESCE(priority,0) > 0",
                  [$email]);
            } catch (\Throwable $e) {}
            // Если этот же адрес есть и в базе участников — снимаем и там: человек
            // просил не писать ему, а не «не писать с одного из списков».
            try { q("UPDATE subscribers SET active=0 WHERE LOWER(email)=?", [$email]); } catch (\Throwable $e) {}
            unsub_mail_stop($email);
            if (function_exists('audit')) audit('unsubscribe', 'institutions', (int) $inst['id'], ['email' => $email]);
        }
        $token = '';   // дальше по базе участников не ищем
    }
}

if ($token !== '') {
    $sub = one("SELECT id, email, active FROM subscribers WHERE unsub_token = ?", [$token]);
    if ($sub) {
        if ((int) $sub['active'] === 0) {
            $state = 'already';
        } else {
            update('subscribers', ['active' => 0], 'id=:id', ['id' => $sub['id']]);

            // Отписка должна останавливать письма СЕЙЧАС, а не со следующей рассылки.
            // В очереди у человека может лежать несколько сотен писем текущей волны
            // (массовые уходят неделями по дневной норме) — раньше они спокойно
            // доходили уже после того, как он нажал «Отказаться», и это выглядело
            // издевательством. Снимаем всё массовое, что ещё не ушло.
            // Личные письма (priority = 0: коды входа, дипломы, чеки) не трогаем —
            // отписка от рассылки не отменяет ответов на его же действия.
            $email = mb_strtolower(trim((string) $sub['email']));
            try {
                q("UPDATE mail_queue SET status='cancelled', error='снято: получатель отписался'
                    WHERE LOWER(to_email) = ? AND status IN ('queued','paused') AND COALESCE(priority,0) > 0",
                  [$email]);
            } catch (\Throwable $e) {}

            // И в профиль сайта: иначе адрес возвращается в базу рассылки через users.
            try { q("UPDATE users SET notify_email = 0 WHERE LOWER(email) = ?", [$email]); } catch (\Throwable $e) {}

            // И в стоп-лист: флажок active переживает не всякую заливку и не всякий
            // вход, а mail_stop проверяется прямо в точке отправки.
            unsub_mail_stop($email);

            // И в базу учреждений: приглашения шлются оттуда отдельным списком, и
            // без этой строки учреждение, нажавшее «Отказаться», получило бы
            // приглашение снова в следующую волну.
            if (is_file(BASE_PATH . '/core/institutions.php')) {
                require_once BASE_PATH . '/core/institutions.php';
                try { inst_unsubscribe($email); } catch (\Throwable $e) {}
            }

            if (function_exists('audit')) audit('unsubscribe', 'subscribers', (int) $sub['id'], ['email' => $sub['email']]);
            $state = 'done';
        }
    }
}

$org      = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
$siteUrl  = rtrim((string) cfgv('base_url'), '/') . '/';
$logo     = h(logo_data_uri());

$heading = 'Вы отписались';
$message = 'Вы отписались от рассылки. Новые письма от центра приходить не будут. Если передумаете - подписку можно оформить снова на сайте.';
if ($state === 'already') {
    $heading = 'Вы уже отписаны';
    $message = 'Этот адрес уже исключён из рассылки. Дополнительных действий не требуется.';
} elseif ($state === 'invalid') {
    $heading = 'Ссылка недействительна';
    $message = 'Ссылка отписки не распознана или устарела. Если письма продолжают приходить, напишите нам, и мы исключим Ваш адрес вручную.';
}

$heading = h($heading);
$message = h($message);
$siteUrlH = h($siteUrl);
?><!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title><?= $heading ?> - <?= $org ?></title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: #f0e6d6; padding: 24px;
    font-family: 'Segoe UI', Arial, sans-serif; color: #3a2e22;
  }
  .card {
    width: 100%; max-width: 520px; background: #fbf6ef;
    border-radius: 18px; overflow: hidden;
    box-shadow: 0 12px 40px rgba(90,50,20,.14);
  }
  .card__top {
    background: linear-gradient(135deg,#7a2e1e 0%,#a0522d 55%,#b8860b 100%);
    padding: 32px 28px; text-align: center;
  }
  .card__top img {
    width: 84px; height: 84px; border-radius: 14px;
    background: #fff; padding: 6px; display: inline-block;
  }
  .card__top .org {
    margin-top: 12px; color: #fff; font-size: 13px;
    letter-spacing: .14em; text-transform: uppercase; font-weight: 600;
  }
  .card__body { padding: 34px 34px 38px; text-align: center; }
  .card__body h1 { margin: 0 0 14px; font-size: 22px; color: #7a2e1e; font-weight: 700; }
  .card__body p { margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: #5a4632; }
  .btn {
    display: inline-block; padding: 13px 30px; border-radius: 10px;
    background: linear-gradient(135deg,#a0522d,#b8860b);
    color: #fff; text-decoration: none; font-weight: 600; font-size: 15px;
  }
</style>
</head>
<body>
  <main class="card">
    <div class="card__top">
      <img src="<?= $logo ?>" alt="<?= $org ?>">
      <div class="org">Культурный центр «Музыкальный Мир»</div>
    </div>
    <div class="card__body">
      <h1><?= $heading ?></h1>
      <p><?= $message ?></p>
      <a class="btn" href="<?= $siteUrlH ?>">Вернуться на сайт</a>
    </div>
  </main>
</body>
</html>
<?php
exit;
