<?php
/**
 * V.LIONOFF · мозг бота. Один и тот же код обслуживает и вебхук
 * (public_html/api/bot.php), иlong-poll (bot/poll.php): у московского
 * сервера входящие от Телеграма не проходят, поэтому боевой путь, опрос.
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/telegram.php';
require_once __DIR__ . '/lessons.php';

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
  if ($cmd === '/uroki' || $cmd === '/learn' || $cmd === '/study') {
    vc_bot_courses($chat, (int)$from['id']); return;
  }
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
    [[['text' => 'Учиться прямо здесь', 'callback_data' => 'uroki']],
     [['text' => 'Программа курса', 'callback_data' => 'course'],
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
  vc_tg_send($chat, $t, array_merge([[['text' => 'Учиться в чате', 'callback_data' => 'uroki']]],
                                    vc_tg_app_button('Открыть приложение')));
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
  $from = $q['from'] ?? [];
  $tgId = (int)($from['id'] ?? 0);
  vc_tg('answerCallbackQuery', ['callback_query_id' => $q['id']]);
  if (!$chat) { return; }
  // Обучение: курс, блок, урок, слайд, конспект, вопрос, ответ.
  $части = explode(':', $data);
  switch ($части[0]) {
    case 'uroki': vc_bot_courses($chat, $tgId); return;
    case 'c': vc_bot_blocks($chat, $tgId, (int)($части[1] ?? 0)); return;
    case 'b': vc_bot_lessons($chat, $tgId, (int)($части[1] ?? 0)); return;
    case 'l': vc_bot_slide($chat, $tgId, (int)($части[1] ?? 0), 0, $from); return;
    case 's': vc_bot_slide($chat, $tgId, (int)($части[1] ?? 0), (int)($части[2] ?? 0), $from); return;
    case 'n': vc_bot_notes($chat, $tgId, (int)($части[1] ?? 0)); return;
    case 'q': vc_bot_quiz($chat, $tgId, (int)($части[1] ?? 0), (int)($части[2] ?? 0)); return;
    case 'a': vc_bot_answer($chat, $tgId, (int)($части[1] ?? 0), (int)($части[2] ?? 0),
                            (int)($части[3] ?? 0)); return;
  }
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

// ═══════════════════════════════════════════════════════════════════
//  ОБУЧЕНИЕ ПРЯМО В БОТЕ
//  Те же уроки, что в приложении, и тот же прогресс: считает
//  core/lessons.php. Человеку не нужно открывать мини-приложение,
//  чтобы пройти урок, но кнопка туда есть на каждом шаге.
// ═══════════════════════════════════════════════════════════════════

/** Пользователь бота как участник обучения. */
function vc_bot_user(int $tgId, array $from = []): ?array {
  $u = vc_one('SELECT * FROM users WHERE tg_id=?', [$tgId]);
  if (!$u && $from) { $u = vc_user_upsert($from, 'bot'); }
  return $u ?: null;
}

function vc_bot_courses(int $chat, int $tgId): void {
  $u = vc_bot_user($tgId);
  $курсы = vc_all("SELECT * FROM courses WHERE status='published' ORDER BY sort, id");
  $кнопки = [];
  foreach ($курсы as $c) {
    $всего = (int) vc_val("SELECT COUNT(*) FROM lessons WHERE course_id=? AND status='published'", [$c['id']]);
    $готово = $u ? (int) vc_val("SELECT COUNT(*) FROM progress WHERE user_id=? AND course_id=? AND state='done'",
                                [$u['id'], $c['id']]) : 0;
    $кнопки[] = [['text' => sprintf('%s (%d/%d)', $c['title'], $готово, $всего),
                  'callback_data' => 'c:' . $c['id']]];
  }
  $кнопки[] = [['text' => 'Открыть приложение', 'web_app' => ['url' => rtrim(vc_cfg()['base_url'], '/') . '/']]];
  vc_tg_send($chat, "<b>Академия V.LIONOFF</b>\n\nВыберите курс. Уроки идут прямо здесь: "
    . "слайды, конспект, озвучка и тест. Прогресс общий с приложением.", $кнопки);
}

function vc_bot_blocks(int $chat, int $tgId, int $courseId): void {
  $u = vc_bot_user($tgId);
  $c = vc_one('SELECT * FROM courses WHERE id=?', [$courseId]);
  if (!$c) { return; }
  $кнопки = [];
  foreach (vc_all('SELECT * FROM blocks WHERE course_id=? ORDER BY sort, id', [$courseId]) as $i => $b) {
    $всего = (int) vc_val("SELECT COUNT(*) FROM lessons WHERE block_id=? AND status='published'", [$b['id']]);
    $готово = $u ? (int) vc_val("SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id=p.lesson_id
                                 WHERE p.user_id=? AND l.block_id=? AND p.state='done'",
                                [$u['id'], $b['id']]) : 0;
    $кнопки[] = [['text' => sprintf('%d. %s (%d/%d)', $i + 1, $b['title'], $готово, $всего),
                  'callback_data' => 'b:' . $b['id']]];
  }
  $кнопки[] = [['text' => 'К курсам', 'callback_data' => 'uroki']];
  vc_tg_send($chat, "<b>" . htmlspecialchars($c['title']) . "</b>\n"
    . htmlspecialchars($c['subtitle']) . "\n\nВыберите блок.", $кнопки);
}

function vc_bot_lessons(int $chat, int $tgId, int $blockId): void {
  $u = vc_bot_user($tgId);
  $b = vc_one('SELECT * FROM blocks WHERE id=?', [$blockId]);
  if (!$b) { return; }
  $c = vc_one('SELECT * FROM courses WHERE id=?', [$b['course_id']]);
  $кнопки = [];
  foreach (vc_all("SELECT * FROM lessons WHERE block_id=? AND status='published' ORDER BY sort, id",
                  [$blockId]) as $i => $l) {
    $готов = $u ? vc_val("SELECT state FROM progress WHERE user_id=? AND lesson_id=?", [$u['id'], $l['id']]) : '';
    $метка = $готов === 'done' ? ' ✓' : (vc_has_access($u, $c, $l) ? '' : ' (по тарифу)');
    $кнопки[] = [['text' => ($i + 1) . '. ' . $l['title'] . $метка, 'callback_data' => 'l:' . $l['id']]];
  }
  $кнопки[] = [['text' => 'К блокам', 'callback_data' => 'c:' . $b['course_id']]];
  vc_tg_send($chat, "<b>" . htmlspecialchars($b['title']) . "</b>\n"
    . htmlspecialchars($b['descr']), $кнопки);
}

/** Один слайд урока. Листается кнопками, как в приложении. */
function vc_bot_slide(int $chat, int $tgId, int $lessonId, int $idx, array $from = []): void {
  $u = vc_bot_user($tgId, $from);
  $полный = vc_lesson_full($lessonId, $u);
  if (!$полный) { return; }
  $l = $полный['lesson'];
  if (!$полный['open']) {
    vc_tg_send($chat, "<b>" . htmlspecialchars($l['title']) . "</b>\n\n"
      . "Этот урок входит в полный курс. Первые уроки открыты бесплатно, "
      . "а дальше нужен тариф PRO.",
      [[['text' => 'Тарифы', 'callback_data' => 'price']],
       [['text' => 'К урокам', 'callback_data' => 'b:' . $l['block_id']]]]);
    return;
  }
  if ($u && $idx === 0) { vc_lesson_opened($u, $l); }
  $слайды = vc_json($l['slides']);
  $всего = count($слайды);
  if ($idx >= $всего) { vc_bot_notes($chat, $tgId, $lessonId); return; }
  $s = $слайды[$idx];
  $текст = "<b>" . htmlspecialchars($l['title']) . "</b>\n"
    . "<i>слайд " . ($idx + 1) . " из " . $всего . "</i>\n\n"
    . "<b>" . htmlspecialchars($s['title'] ?? '') . "</b>\n"
    . htmlspecialchars($s['text'] ?? '') . "\n";
  foreach (($s['list'] ?? []) as $пункт) { $текст .= "\n• " . htmlspecialchars($пункт); }
  if (!empty($s['note'])) { $текст .= "\n\n<i>" . htmlspecialchars($s['note']) . "</i>"; }
  $ряд = [];
  if ($idx > 0) { $ряд[] = ['text' => 'Назад', 'callback_data' => "s:$lessonId:" . ($idx - 1)]; }
  $ряд[] = ['text' => $idx + 1 >= $всего ? 'К конспекту' : 'Дальше',
            'callback_data' => "s:$lessonId:" . ($idx + 1)];
  vc_tg_send($chat, $текст, [$ряд, [['text' => 'К урокам', 'callback_data' => 'b:' . $l['block_id']]]]);
}

/** Конспект и озвучка. */
function vc_bot_notes(int $chat, int $tgId, int $lessonId): void {
  $u = vc_bot_user($tgId);
  $полный = vc_lesson_full($lessonId, $u);
  if (!$полный || !$полный['open']) { return; }
  $l = $полный['lesson'];
  $текст = "<b>" . htmlspecialchars($l['title']) . "</b>\n<i>конспект</i>\n\n";
  foreach (explode("\n", $l['notes']) as $строка) {
    $t = trim($строка);
    if ($t === '') { $текст .= "\n"; continue; }
    if (str_starts_with($t, '## ')) { $текст .= "\n<b>" . htmlspecialchars(substr($t, 3)) . "</b>\n"; continue; }
    $текст .= htmlspecialchars(str_replace('**', '', $t)) . "\n";
  }
  if ($l['practice']) {
    $текст .= "\n<b>Практика</b>\n" . htmlspecialchars($l['practice']);
  }
  $кнопки = [];
  $quiz = vc_json($l['quiz']);
  if ($quiz) { $кнопки[] = [['text' => 'Пройти тест', 'callback_data' => "q:$lessonId:0"]]; }
  $кнопки[] = [['text' => 'Слайды заново', 'callback_data' => "s:$lessonId:0"],
               ['text' => 'К урокам', 'callback_data' => 'b:' . $l['block_id']]];
  vc_tg_send($chat, mb_substr($текст, 0, 3800), $кнопки);
  if ($l['audio']) {
    $url = rtrim(vc_cfg()['base_url'], '/') . '/' . ltrim($l['audio'], '/');
    vc_tg('sendAudio', ['chat_id' => $chat, 'audio' => $url,
                        'title' => mb_substr($l['title'], 0, 60),
                        'performer' => 'V.LIONOFF',
                        'caption' => 'Конспект голосом автора']);
  }
}

/** Вопрос теста. */
function vc_bot_quiz(int $chat, int $tgId, int $lessonId, int $qidx): void {
  $u = vc_bot_user($tgId);
  $полный = vc_lesson_full($lessonId, $u);
  if (!$полный || !$полный['open'] || !$u) { return; }
  $l = $полный['lesson'];
  $quiz = vc_json($l['quiz']);
  if ($qidx === 0) { vc_bot_state($tgId, 'quiz' . $lessonId, []); }
  if ($qidx >= count($quiz)) { vc_bot_quiz_done($chat, $tgId, $lessonId); return; }
  $q = $quiz[$qidx];
  $кнопки = [];
  foreach (($q['options'] ?? []) as $i => $вариант) {
    $кнопки[] = [['text' => $вариант, 'callback_data' => "a:$lessonId:$qidx:$i"]];
  }
  vc_tg_send($chat, "<b>Вопрос " . ($qidx + 1) . " из " . count($quiz) . "</b>\n\n"
    . htmlspecialchars($q['q']), $кнопки);
}

/** Ответ на вопрос: сразу говорим, верно ли, и идём дальше. */
function vc_bot_answer(int $chat, int $tgId, int $lessonId, int $qidx, int $выбор): void {
  $u = vc_bot_user($tgId);
  $полный = vc_lesson_full($lessonId, $u);
  if (!$полный || !$u) { return; }
  $quiz = vc_json($полный['lesson']['quiz']);
  $q = $quiz[$qidx] ?? null;
  if (!$q) { return; }
  $ответы = vc_bot_state($tgId, 'quiz' . $lessonId);
  $ответы[(string)$qidx] = $выбор;
  vc_bot_state($tgId, 'quiz' . $lessonId, $ответы);
  $верно = (int)$q['answer'] === $выбор;
  $текст = ($верно ? "Верно." : "Мимо. Верный ответ: " . htmlspecialchars($q['options'][(int)$q['answer']]))
    . (!empty($q['why']) ? "\n\n<i>" . htmlspecialchars($q['why']) . "</i>" : '');
  vc_tg_send($chat, $текст, [[['text' => $qidx + 1 >= count($quiz) ? 'Итог' : 'Следующий вопрос',
                               'callback_data' => "q:$lessonId:" . ($qidx + 1)]]]);
}

/** Итог теста: тот же счёт, что в приложении. */
function vc_bot_quiz_done(int $chat, int $tgId, int $lessonId): void {
  $u = vc_bot_user($tgId);
  $полный = vc_lesson_full($lessonId, $u);
  if (!$полный || !$u) { return; }
  $l = $полный['lesson'];
  $ответы = [];
  foreach (vc_bot_state($tgId, 'quiz' . $lessonId) as $k => $v) { $ответы[(int)$k] = (int)$v; }
  $итог = vc_quiz_apply($u, $l, $ответы);
  $следующий = vc_one("SELECT id, title FROM lessons WHERE course_id=? AND status='published'
                       AND (sort > (SELECT sort FROM lessons WHERE id=?) OR
                            (sort = (SELECT sort FROM lessons WHERE id=?) AND id > ?))
                       ORDER BY sort, id LIMIT 1",
                      [$l['course_id'], $l['id'], $l['id'], $l['id']]);
  if ($итог['passed']) {
    $текст = "<b>Урок пройден</b>\nРезультат: " . $итог['score'] . "%"
      . ($итог['xp_gain'] ? "\nОпыт: +" . $итог['xp_gain'] . " XP" : '')
      . "\nСерия дней: " . $итог['streak']
      . "\nУровень: " . $итог['level']['name'];
    if (!empty($итог['certificate'])) {
      $текст .= "\n\n<b>Курс завершён.</b> Сертификат " . $итог['certificate']['number']
              . " ждёт вас в профиле.";
    }
    $кнопки = [];
    if ($следующий) {
      $кнопки[] = [['text' => 'Следующий урок: ' . mb_substr($следующий['title'], 0, 30),
                    'callback_data' => 'l:' . $следующий['id']]];
    }
    $кнопки[] = [['text' => 'К урокам', 'callback_data' => 'b:' . $l['block_id']],
                 ['text' => 'В приложение', 'web_app' => ['url' => rtrim(vc_cfg()['base_url'], '/') . '/']]];
    vc_tg_send($chat, $текст, $кнопки);
  } else {
    vc_tg_send($chat, "<b>" . $итог['score'] . "%</b>, пока мало.\n\n"
      . "Нужно 70%. Вернитесь к конспекту и пройдите тест снова: это тренировка, а не экзамен.",
      [[['text' => 'Конспект', 'callback_data' => "n:$lessonId"],
        ['text' => 'Тест заново', 'callback_data' => "q:$lessonId:0"]]]);
  }
}
