<?php
/**
 * ОТКАЗ ОТ ПРОДЛЕНИЯ ЭЛИТНОГО КЛУБА — ПО КНОПКЕ ИЗ ПИСЬМА «ЧЕРЕЗ 3 ДНЯ».
 *
 * Слово владельца 22.10.2026: продление вручную, по напоминанию за 3 дня, и
 * у участника должна быть возможность отказаться от продления кнопкой.
 *
 * GET ?u=&t=  — страница с вопросом и кнопкой «Отказаться от продления»;
 * POST        — сам отказ. Одним GET отказ не ставится: почтовые сканеры
 *               (Яндекс, Mail.ru) сами открывают ссылки из писем, и человек
 *               «отказался» бы, не прочитав письма.
 *
 * Отказ не отбирает оплаченное: членство работает до конца срока, снимаются
 * только письма о продлении и «вернитесь в клуб». Подпись ссылки —
 * club_decline_sig(), входа в кабинет не нужно.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow');

if (!function_exists('club_status') && is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';

$uid = (int) input('u');
$sig = trim((string) input('t'));
$ok  = $uid > 0 && $sig !== '' && function_exists('club_decline_sig') && hash_equals(club_decline_sig($uid), $sig);
$st  = $ok ? club_status($uid) : [];

$state = 'invalid';                                   // invalid | ask | done | already | inactive
if ($ok) {
    if (empty($st['active']) || !empty($st['staff'])) $state = 'inactive';
    elseif (!empty($st['declined']))                  $state = 'already';
    elseif (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
        club_cancel_auto_renew($uid);
        if (function_exists('audit')) audit('club_decline_mail', 'club_members', $uid, []);
        $state = 'done';
    } else $state = 'ask';
}

$until = trim((string) ($st['expires_local'] ?? ''));
$untilTxt = $until !== '' && function_exists('ru_date') ? ru_date(substr($until, 0, 10)) : 'конца оплаченного периода';

[$heading, $message] = match ($state) {
    'ask'      => ['Отказаться от продления?',
                   'Членство в Элитном клубе действует до ' . $untilTxt . ' — оплаченный срок сохраняется полностью. '
                   . 'После отказа писем о продлении больше не будет. Передумаете — продлить можно в любой момент на странице клуба.'],
    'done'     => ['Вы отказались от продления',
                   'Членство действует до ' . $untilTxt . ', все привилегии клуба сохраняются до этой даты. '
                   . 'Писем о продлении больше не будет. Передумаете — продлить можно в любой момент на странице клуба.'],
    'already'  => ['Отказ уже сохранён',
                   'Вы уже отказались от продления. Членство действует до ' . $untilTxt . ', писем о продлении не будет.'],
    'inactive' => ['Активного членства нет',
                   'Членство в Элитном клубе сейчас не действует, отказываться не от чего. Вступить снова можно на странице клуба.'],
    default    => ['Ссылка недействительна',
                   'Ссылка не распознана. Отказаться от продления можно в личном кабинете — вкладка «Настройки».'],
};

$org      = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
$logo     = h(logo_data_uri());
$clubUrl  = h(url('/club'));
$selfUrl  = h(url('/api/v1/club_decline.php'));
?><!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title><?= h($heading) ?> - <?= $org ?></title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         background: #f0e6d6; padding: 24px; font-family: 'Segoe UI', Arial, sans-serif; color: #3a2e22; }
  .card { width: 100%; max-width: 520px; background: #fbf6ef; border-radius: 18px; overflow: hidden;
          box-shadow: 0 12px 40px rgba(90,50,20,.14); }
  .card__top { background: linear-gradient(135deg,#7a2e1e 0%,#a0522d 55%,#b8860b 100%); padding: 32px 28px; text-align: center; }
  .card__top img { width: 84px; height: 84px; border-radius: 14px; background: #fff; padding: 6px; display: inline-block; }
  .card__top .org { margin-top: 12px; color: #fff; font-size: 13px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; }
  .card__body { padding: 34px 34px 38px; text-align: center; }
  .card__body h1 { margin: 0 0 14px; font-size: 22px; color: #7a2e1e; font-weight: 700; }
  .card__body p { margin: 0 0 24px; font-size: 15px; line-height: 1.7; color: #5a4632; }
  .btn { display: inline-block; padding: 13px 30px; border-radius: 10px; border: 0; cursor: pointer;
         background: linear-gradient(135deg,#a0522d,#b8860b); color: #fff; text-decoration: none; font-weight: 600; font-size: 15px; }
  .btn--ghost { background: transparent; color: #7a2e1e; border: 1.5px solid #c9a27a; margin-top: 12px; }
  form { margin: 0; }
</style>
</head>
<body>
  <main class="card">
    <div class="card__top">
      <img src="<?= $logo ?>" alt="<?= $org ?>">
      <div class="org">Культурный центр «Музыкальный Мир»</div>
    </div>
    <div class="card__body">
      <h1><?= h($heading) ?></h1>
      <p><?= h($message) ?></p>
      <?php if ($state === 'ask'): ?>
        <form method="post" action="<?= $selfUrl ?>">
          <input type="hidden" name="u" value="<?= $uid ?>">
          <input type="hidden" name="t" value="<?= h($sig) ?>">
          <button class="btn" type="submit">Отказаться от продления</button>
        </form>
        <a class="btn btn--ghost" href="<?= $clubUrl ?>">Нет, хочу продлить</a>
      <?php else: ?>
        <a class="btn" href="<?= $clubUrl ?>">Страница клуба</a>
      <?php endif; ?>
    </div>
  </main>
</body>
</html>
<?php
exit;
