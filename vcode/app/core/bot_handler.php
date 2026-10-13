<?php
/**
 * V.LIONOFF · мозг бота. Один и тот же код обслуживает и вебхук
 * (public_html/api/bot.php), иlong-poll (bot/poll.php): у московского
 * сервера входящие от Телеграма не проходят, поэтому боевой путь, опрос.
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/telegram.php';

// ───────────────────────────────────────────────────────────────────────

function vc_bot_update(array $u): void {
  if (!empty($u['message'])) { vc_bot_message($u['message']); return; }
  if (!empty($u['callback_query'])) { vc_bot_callback($u['callback_query']); return; }
  if (!empty($u['pre_checkout_query'])) {
    vc_tg('answerPreCheckoutQuery', ['pre_checkout_query_id' => $u['pre_checkout_query']['id'], 'ok' => true]);
  }
}

function vc_bot_lead(array $from, string $source = ''): array {
  $tgId = (int)($from['id'] ?? 0);
  $lead = vc_one('SELECT * FROM leads WHERE tg_id=?', [$tgId]);
  if (!$lead) {
    vc_insert('leads', ['tg_id' => $tgId, 'username' => (string)($from['username'] ?? ''),
      'name' => trim(($from['first_name'] ?? '') . ' ' . ($from['last_name'] ?? '')),
      'source' => $source, 'stage' => 'new', 'step' => 0,
      'next_at' => date('Y-m-d H:i:s', strtotime('+2 hour'))]);
    $lead = vc_one('SELECT * FROM leads WHERE tg_id=?', [$tgId]);
  }
  return $lead;
}

function vc_bot_message(array $m): void {
  $cfg = vc_cfg();
  $chat = (int)($m['chat']['id'] ?? 0);
  $from = $m['from'] ?? [];
  $text = trim((string)($m['text'] ?? ''));
  if (!$chat || empty($from['id'])) { return; }
  if (($m['chat']['type'] ?? 'private') !== 'private') { return; }

  $cmd = strtolower(explode(' ', $text)[0] ?? '');
  $payload = trim(substr($text, strlen($cmd)));
  $isAdmin = in_array((int)$from['id'], $cfg['admin_ids'], true);

  if (str_starts_with($cmd, '/start')) {
    $lead = vc_bot_lead($from, $payload);
    vc_user_upsert($from, $payload);
    vc_bot_welcome($chat);
    return;
  }
  if ($cmd === '/app' || $cmd === '/open') { vc_bot_open($chat); return; }
  if ($cmd === '/course' || $cmd === '/kurs') { vc_bot_course($chat); return; }
  if ($cmd === '/orders' || $cmd === '/birzha') { vc_bot_orders($chat); return; }
  if ($cmd === '/price' || $cmd === '/tarif') { vc_bot_price($chat); return; }
  if ($cmd === '/help') { vc_bot_help($chat); return; }
  if ($cmd === '/my' || $cmd === '/me') { vc_bot_my($chat, (int)$from['id']); return; }

  if ($isAdmin && $cmd === '/stats') { vc_bot_stats($chat); return; }
  if ($isAdmin && str_starts_with($cmd, '/say')) {
    $sent = 0;
    foreach (vc_all('SELECT tg_id FROM users WHERE notify=1 AND tg_id IS NOT NULL') as $r) {
      if (vc_tg_send((int)$r['tg_id'], $payload, vc_tg_app_button())) { $sent++; }
      usleep(60000);
    }
    vc_tg_send($chat, "Разослано: $sent");
    return;
  }

  // Любой другой текст: короткий ответ по делу и кнопка приложения.
  vc_bot_lead($from);
  vc_tg_send($chat,
    "Я бот V.LIONOFF. Обучение, заявки от заказчиков и тариф живут в приложении, "
    . "откройте кнопкой ниже.\n\nЕсли вопрос живой, напишите " . $cfg['support'] . ".",
    array_merge(vc_tg_app_button(), [[['text' => 'Что внутри', 'callback_data' => 'about']]]));
}

function vc_bot_welcome(int $chat): void {
  $text = "<b>V.LIONOFF</b>, школа контент-креаторов и биржа заказов.\n\n"
    . "Здесь вы учитесь снимать и монтировать ролики, которые приносят заявки, "
    . "а потом берёте заказы прямо в приложении.\n\n"
    . "• Курс полного формата: слайды, конспект, тест, практика\n"
    . "• Сертификат за направление\n"
    . "• Биржа: заказчики ищут исполнителей по городам\n"
    . "• Партнёрка: приводите людей и получаете долю\n\n"
    . "Первые уроки открыты бесплатно.";
  vc_tg_send($chat, $text, array_merge(
    vc_tg_app_button('Открыть приложение'),
    [[['text' => 'Программа курса', 'callback_data' => 'course'],
      ['text' => 'Тарифы', 'callback_data' => 'price']]]));
}

function vc_bot_open(int $chat): void {
  vc_tg_send($chat, "Приложение открывается кнопкой:", vc_tg_app_button());
}

function vc_bot_course(int $chat): void {
  $rows = vc_all("SELECT title, subtitle, access, price FROM courses WHERE status='published' ORDER BY sort,id");
  $t = "<b>Программа V.LIONOFF</b>\n\n";
  foreach ($rows as $c) {
    $cena = $c['access'] === 'free' ? 'бесплатно'
          : ($c['access'] === 'pro' ? 'по подписке' : (int)$c['price'] . ' ₽');
    $t .= "• <b>" . htmlspecialchars($c['title']) . "</b>, " . htmlspecialchars($c['subtitle'])
       . " (" . $cena . ")\n";
  }
  $t .= "\nУроки идут блоками: слайды, конспект, тест и практика. В конце, сертификат.";
  vc_tg_send($chat, $t, vc_tg_app_button('Начать учиться'));
}

function vc_bot_orders(int $chat): void {
  $rows = vc_all("SELECT title, city, budget FROM orders WHERE status='open' ORDER BY id DESC LIMIT 5");
  if (!$rows) {
    vc_tg_send($chat, "Сейчас открытых заявок нет. Как появятся, пришлю.", vc_tg_app_button('Биржа'));
    return;
  }
  $t = "<b>Свежие заявки</b>\n\n";
  foreach ($rows as $o) {
    $t .= "• " . htmlspecialchars($o['title'])
       . ($o['city'] ? ', ' . htmlspecialchars($o['city']) : '')
       . ($o['budget'] ? ', ' . (int)$o['budget'] . ' ₽' : '') . "\n";
  }
  vc_tg_send($chat, $t, vc_tg_app_button('Откликнуться'));
}

function vc_bot_price(int $chat): void {
  $cfg = vc_cfg();
  $t = "<b>Тарифы V.LIONOFF</b>\n\n"
    . "• <b>Старт</b>, бесплатно. Первый блок курса, биржа на просмотр.\n"
    . "• <b>PRO</b>, " . $cfg['plan_price']['pro'] . " ₽ в месяц. Весь курс, сертификат, "
    . "отклики на заявки, место в каталоге исполнителей.\n"
    . "• <b>Наставник</b>, " . $cfg['plan_price']['mentor'] . " ₽ в месяц. PRO плюс разбор ваших роликов и ведение.\n\n"
    . "Оплата внутри приложения, картой РФ и зарубежной.";
  vc_tg_send($chat, $t, vc_tg_app_button('Оформить'));
}

function vc_bot_help(int $chat): void {
  $cfg = vc_cfg();
  vc_tg_send($chat, "Команды:\n/app, приложение\n/course, программа\n/orders, заявки\n"
    . "/price, тарифы\n/my, мой прогресс\n\nЖивой человек: " . $cfg['support'],
    vc_tg_app_button());
}

function vc_bot_my(int $chat, int $tgId): void {
  $u = vc_one('SELECT * FROM users WHERE tg_id=?', [$tgId]);
  if (!$u) { vc_bot_welcome($chat); return; }
  $done = (int) vc_val("SELECT COUNT(*) FROM progress WHERE user_id=? AND state='done'", [$u['id']]);
  $cert = (int) vc_val('SELECT COUNT(*) FROM certificates WHERE user_id=?', [$u['id']]);
  vc_tg_send($chat, "<b>Ваш прогресс</b>\nУроков пройдено: $done\nСерия дней: " . (int)$u['streak']
    . "\nОпыт: " . (int)$u['xp'] . " XP\nСертификатов: $cert\nТариф: " . $u['plan'],
    vc_tg_app_button('Продолжить'));
}

function vc_bot_stats(int $chat): void {
  $t = "<b>V.LIONOFF · сводка</b>\n"
    . "Пользователей: " . (int) vc_val('SELECT COUNT(*) FROM users') . "\n"
    . "Сегодня пришли: " . (int) vc_val('SELECT COUNT(*) FROM users WHERE date(created_at)=?', [date('Y-m-d')]) . "\n"
    . "Уроков пройдено: " . (int) vc_val("SELECT COUNT(*) FROM progress WHERE state='done'") . "\n"
    . "Заявок: " . (int) vc_val('SELECT COUNT(*) FROM orders') . "\n"
    . "Оплат: " . (int) vc_val("SELECT COUNT(*) FROM payments WHERE status='paid'")
    . " на " . (int) vc_val("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status='paid'") . " ₽";
  vc_tg_send($chat, $t);
}

function vc_bot_callback(array $q): void {
  $chat = (int)($q['message']['chat']['id'] ?? 0);
  $data = (string)($q['data'] ?? '');
  vc_tg('answerCallbackQuery', ['callback_query_id' => $q['id']]);
  if (!$chat) { return; }
  if ($data === 'course') { vc_bot_course($chat); return; }
  if ($data === 'price') { vc_bot_price($chat); return; }
  if ($data === 'orders') { vc_bot_orders($chat); return; }
  if ($data === 'about') {
    vc_tg_send($chat,
      "Внутри приложения:\n\n1. Академия, курс по съёмке, монтажу, сценарию и продвижению.\n"
      . "2. Биржа, заявки от бизнеса: обзоры, рилс, продакшн.\n"
      . "3. Профиль, ваша витрина для заказчика: город, услуги, цена, портфолио.\n"
      . "4. Партнёрка, своя ссылка и доля с тех, кого привели.",
      vc_tg_app_button());
  }
}
