<?php
/**
 * V.LIONOFF · опрос Телеграма (long-poll). Боевой путь бота.
 *
 * Почему не вебхук: к московскому серверу Телеграм достучаться не может,
 * `getWebhookInfo` честно показывает «Connection timed out» на каждую
 * доставку. Наружу тот же сервер ходит свободно, поэтому бот сам спрашивает
 * обновления. Так же работают остальные боты OKO.
 *
 *   php bot/poll.php            # в переднем плане, для проверки
 *   systemctl start vlionoff-bot
 */
declare(strict_types=1);

require_once __DIR__ . '/../core/bot_handler.php';

$cfg = vc_cfg();
if (empty($cfg['bot_token'])) {
  fwrite(STDERR, "нет токена бота: core/config.local.php\n");
  exit(1);
}

// Вебхук и опрос вместе не живут: Телеграм отдаёт обновления чему-то одному.
vc_tg('deleteWebhook', ['drop_pending_updates' => false]);

$смещение = (int) vc_setting('bot_offset', '0');
$тишина = 0;
echo date('H:i:s') . " опрос запущен, смещение $смещение\n";

while (true) {
  $ответ = vc_tg('getUpdates', [
    'offset' => $смещение,
    'timeout' => 30,
    'allowed_updates' => ['message', 'callback_query', 'pre_checkout_query'],
  ]);
  if (!$ответ || empty($ответ['ok'])) {
    // Сеть мигает: ждём и пробуем снова, молча, но не чаще раза в пять секунд.
    $тишина++;
    if ($тишина % 12 === 1) { error_log('[vlionoff bot] опрос не ответил'); }
    sleep(5);
    continue;
  }
  $тишина = 0;
  foreach (($ответ['result'] ?? []) as $u) {
    $смещение = max($смещение, (int)$u['update_id'] + 1);
    try {
      vc_bot_update($u);
    } catch (Throwable $e) {
      error_log('[vlionoff bot] ' . $e->getMessage());
    }
  }
  if (!empty($ответ['result'])) {
    vc_setting_set('bot_offset', (string)$смещение);
  }
}
