<?php
/**
 * Админ-раздел «Чат-бот»: единый контроль всех диалогов — и на сайте, и во ВКонтакте.
 * Видны АБСОЛЮТНО все диалоги (включая старые). По каждому: полная переписка, ответ от
 * своего имени (уходит участнику: на сайте — в чат, во ВК — сообщением сообщества),
 * редактирование и удаление любых сообщений бота, очистка диалога, блокировка,
 * включение/выключение бота, снятие ручного перехвата, создание нового диалога.
 *
 * Когда оператор отвечает сам — бот замолкает на 30 минут (ручной перехват) и его
 * уже подготовленный, но не отправленный ответ снимается — см. core/chat_ops.php
 * (chat_operator_touch). Функционал одинаков для ВК и сайта.
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/chat_ops.php';
require_once BASE_PATH . '/core/chat_brain.php';
require_once BASE_PATH . '/core/chat_learn.php';
if (is_file(BASE_PATH . '/core/vk.php')) require_once BASE_PATH . '/core/vk.php';
chat_ops_boot();

/** Отображаемое имя участника по диалогу. */
function chats_title(array $d): string {
    $t = trim((string) ($d['title'] ?? ''));
    if ($t !== '') return $t;
    $sk = (string) ($d['session_key'] ?? '');
    if (str_starts_with($sk, 'vk_')) {
        $peer = (int) substr($sk, 3);
        if (function_exists('vk_user_name')) { try { $n = vk_user_name($peer); if ($n !== '') return $n; } catch (\Throwable $e) {} }
        return 'ВК · id ' . $peer;
    }
    // Веб: пробуем имя привязанного пользователя.
    try {
        $uid = (int) (scalar("SELECT user_id FROM chat_messages WHERE session_key=? AND user_id IS NOT NULL ORDER BY id DESC LIMIT 1", [$sk]) ?: 0);
        if ($uid > 0) { $fn = trim((string) (scalar("SELECT full_name FROM users WHERE id=?", [$uid]) ?: '')); if ($fn !== '') return $fn; }
    } catch (\Throwable $e) {}
    return 'Гость сайта';
}

/** Канал диалога (vk|web) по session_key. */
function chats_channel(string $sk): string { return str_starts_with($sk, 'vk_') ? 'vk' : 'web'; }

/* ---------------------------- POST-обработчики ---------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('chats'); }
    $do = input('do');
    $sk = trim((string) input('session_key'));
    $back = ['s' => $sk];

    if ($do === 'reply' && $sk !== '') {
        $text = trim((string) input('text'));
        if ($text === '') { flash('Пустой ответ.', 'error'); admin_redirect('chats', $back); }
        if (mb_strlen($text) > 4000) $text = mb_substr($text, 0, 4000);
        // Кладём в историю как сообщение ассистента (участник видит его как ответ центра).
        // И помечаем как написанное человеком: такие ответы потом служат ассистенту
        // образцом того, как в центре разговаривают на самом деле.
        try {
            $mid = (int) insert('chat_messages', ['user_id' => null, 'session_key' => $sk,
                                                  'role' => 'assistant', 'text' => $text, 'file' => '']);
            if (function_exists('chat_learn_mark_operator')) chat_learn_mark_operator($mid);
        } catch (\Throwable $e) {}
        // Доставка в канал: ВК — сразу сообщением; сайт — участник подхватит опросом истории.
        $sent = chat_channel_send($sk, $text);
        /* Ручной перехват: бот молчит полчаса И снимает то, что уже собрался
           сказать. Иначе через пару минут поверх живого ответа прилетал ещё и
           ботовский — по тому же вопросу, другими словами. */
        $cancelled = chat_operator_touch($sk);
        chat_dialog_set($sk, ['pending_offhours' => 0]);
        audit('chat_admin_reply', 'chat', 0, ['session' => $sk]);
        $mins = function_exists('chat_takeover_minutes') ? chat_takeover_minutes() : 30;
        $tail = ' Бот в этот диалог не заходит ' . $mins . ' минут.'
              . ($cancelled > 0 ? ' Снят подготовленный ответ бота (' . $cancelled . ').' : '');
        flash(chats_channel($sk) === 'vk'
            ? ($sent ? 'Ответ отправлен участнику во ВКонтакте.' . $tail : 'Ответ сохранён, но не ушёл во ВК (проверьте токен сообщества).')
            : 'Ответ отправлен — участник увидит его в чате сайта.' . $tail,
            $sent || chats_channel($sk) === 'web' ? 'success' : 'error');
        admin_redirect('chats', $back);
    }

    if ($do === 'edit_msg') {
        $mid = (int) input('mid');
        $text = trim((string) input('text'));
        if ($mid > 0) {
            $row = one("SELECT session_key, text, role FROM chat_messages WHERE id=?", [$mid]);
            if ($row) {
                $before = (string) $row['text'];
                $new    = mb_substr($text, 0, 4000);
                update('chat_messages', ['text' => $new], 'id=:id', ['id' => $mid]);
                // Правка ответа бота — это указание «так неправильно, а так правильно».
                // Запоминаем обе версии: в следующий раз ассистент увидит исправленную.
                if ((string) $row['role'] === 'assistant' && function_exists('chat_learn_lesson')) {
                    chat_learn_lesson($mid, $before, $new);
                }
                flash('Сообщение изменено.', 'success');
                $back['s'] = $row['session_key'];
            }
        }
        admin_redirect('chats', $back);
    }

    if ($do === 'del_msg') {
        $mid = (int) input('mid');
        if ($mid > 0) {
            $row = one("SELECT session_key FROM chat_messages WHERE id=?", [$mid]);
            q("DELETE FROM chat_messages WHERE id=?", [$mid]);
            flash('Сообщение удалено.', 'success');
            if ($row) $back['s'] = $row['session_key'];
        }
        admin_redirect('chats', $back);
    }

    if ($do === 'clear' && $sk !== '') {
        q("DELETE FROM chat_messages WHERE session_key=?", [$sk]);
        flash('Диалог очищен.', 'success');
        admin_redirect('chats', $back);
    }

    if ($do === 'del_dialog' && $sk !== '') {
        q("DELETE FROM chat_messages WHERE session_key=?", [$sk]);
        try { q("DELETE FROM chat_dialogs WHERE session_key=?", [$sk]); } catch (\Throwable $e) {}
        flash('Диалог удалён.', 'success');
        admin_redirect('chats');
    }

    /* ОБЩИЙ РУБИЛЬНИК: выключить бота во всех каналах разом.
     * В дни оглашения итогов ответ машины дороже молчания — переписку ведёт
     * оператор, вопросы никуда не теряются (сообщения людей сохраняются). */
    if ($do === 'bot_all') {
        $new = chat_bot_enabled() ? '0' : '1';
        set_setting('chat_bot_enabled', $new);
        flash($new === '1'
            ? 'Бот включён — отвечает на сайте и во ВКонтакте.'
            : 'Бот выключен везде: на сайте и во ВКонтакте молчит, вопросы участников сохраняются здесь.', 'success');
        admin_redirect('chats', $back);
    }

    if ($do === 'toggle_bot' && $sk !== '') {
        $d = chat_dialog_get($sk);
        $new = (int) ($d['bot_enabled'] ?? 1) === 1 ? 0 : 1;
        chat_dialog_set($sk, ['bot_enabled' => $new]);
        flash($new ? 'Бот включён для этого диалога.' : 'Бот выключен — отвечать будете только Вы.', 'success');
        admin_redirect('chats', $back);
    }

    if ($do === 'block' && $sk !== '') {
        $d = chat_dialog_get($sk);
        $new = (int) ($d['blocked'] ?? 0) === 1 ? 0 : 1;
        chat_dialog_set($sk, ['blocked' => $new]);
        flash($new ? 'Диалог заблокирован — бот не отвечает.' : 'Блокировка снята.', 'success');
        admin_redirect('chats', $back);
    }

    if ($do === 'release' && $sk !== '') {
        chat_dialog_set($sk, ['operator_until' => '']);
        flash('Ручной перехват снят — бот снова отвечает.', 'success');
        admin_redirect('chats', $back);
    }

    if ($do === 'create') {
        $peer = trim((string) input('peer_id'));
        if ($peer !== '' && ctype_digit($peer)) {
            $nsk = 'vk_' . $peer;
            chat_dialog_set($nsk, ['channel' => 'vk', 'peer_id' => $peer]);
            flash('Диалог ВК создан — можно писать участнику.', 'success');
            admin_redirect('chats', ['s' => $nsk]);
        }
        flash('Укажите числовой ВК id участника (peer_id).', 'error');
        admin_redirect('chats');
    }

    admin_redirect('chats');
}

/* --------------------------- Просмотр одного диалога --------------------------- */
$sk = trim((string) input('s'));

/* Живое обновление: вкладка раз в несколько секунд спрашивает, не появилось ли
   нового, и дорисовывает разницу. Без этого оператор видит переписку такой, какой
   она была на момент загрузки страницы, и отвечает вслепую. */
if ($sk !== '' && input('ajax') === '1') {
    $since = (int) input('since', 0);
    $rows = [];
    try {
        $rows = all("SELECT id, role, text, file, created_at FROM chat_messages
                      WHERE session_key=? AND id>? AND role IN ('user','assistant')
                   ORDER BY id ASC LIMIT 100", [$sk, $since]);
    } catch (\Throwable $e) {}
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => true, 'messages' => $rows], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($sk !== '') {
    $d = chat_dialog_get($sk);
    $title = chats_title($d);
    $chan  = chats_channel($sk);
    // Берём ПОСЛЕДНИЕ 500 сообщений, а не первые: в длинной переписке важен свежий
    // конец, а не то, с чего разговор начинался год назад.
    $msgs = [];
    try {
        /* ВРЕМЯ ДОСТАВКИ, А НЕ ВРЕМЯ СБОРКИ ОТВЕТА.
         *
         * Ответ обычному участнику ложится в базу сразу, а уходит через пять
         * минут (visible_at на сайте, vk_send_at в ВК). Админка печатала
         * created_at — и переписка выглядела так, будто бот отвечает через две
         * секунды: вопрос 13:00:34, ответ 13:00:36. Владелец по этому экрану и
         * судил, что очередь не работает, хотя человек получил ответ в 13:06.
         * Берём оба срока и показываем правду: доставлено или ждёт отправки. */
        $msgs = array_reverse(all(
            "SELECT id, role, text, file, created_at,
                    COALESCE(visible_at,'') AS visible_at,
                    COALESCE(vk_send_at,'') AS vk_send_at,
                    COALESCE(vk_sent,0)     AS vk_sent
               FROM chat_messages
              WHERE session_key=? ORDER BY id DESC LIMIT 500", [$sk]));
    } catch (\Throwable $e) {}
    $botOn   = (int) ($d['bot_enabled'] ?? 1) === 1;
    $blocked = (int) ($d['blocked'] ?? 0) === 1;
    $opUntil = trim((string) ($d['operator_until'] ?? ''));
    $opActive = $opUntil !== '' && strtotime($opUntil) > time();
    $roleRu = ['user' => 'Участник', 'assistant' => 'Центр', 'escalated' => '⚑ эскалация', 'escalated_noanswer' => '⚑ нет ответа', 'dialog_end' => '— конец диалога —', 'review_asked' => '— запрошен отзыв —',
                'bot_cancelled' => '— ответ бота снят: отвечает оператор —'];

    ob_start(); ?>
    <div class="page-head" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <a class="btn btn--ghost" href="<?= a_link('chats') ?>" style="padding:6px 10px"><?= admin_icon('back') ?> К диалогам</a>
      <h1 style="margin:0"><?= h($title) ?></h1>
      <span class="tag" style="background:<?= $chan === 'vk' ? '#4a76a8' : '#0b7' ?>;color:#fff;padding:4px 10px;border-radius:8px"><?= $chan === 'vk' ? 'ВКонтакте' : 'Сайт' ?></span>
      <?php if ($blocked): ?><span class="tag" style="background:#c0392b;color:#fff;padding:4px 10px;border-radius:8px">Заблокирован</span><?php endif; ?>
      <?php if (!$botOn): ?><span class="tag" style="background:#e67e22;color:#fff;padding:4px 10px;border-radius:8px">Бот выключен</span><?php endif; ?>
      <?php if ($opActive): ?><span class="tag" style="background:#8e44ad;color:#fff;padding:4px 10px;border-radius:8px">Перехват до <?= h(date('H:i', strtotime($opUntil))) ?></span><?php endif; ?>
    </div>

    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="toggle_bot"><input type="hidden" name="session_key" value="<?= h($sk) ?>"><button class="btn btn--ghost" style="padding:6px 10px"><?= $botOn ? 'Выключить бота' : 'Включить бота' ?></button></form>
      <?php if ($opActive): ?><form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="release"><input type="hidden" name="session_key" value="<?= h($sk) ?>"><button class="btn btn--ghost" style="padding:6px 10px">Вернуть боту</button></form><?php endif; ?>
      <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="block"><input type="hidden" name="session_key" value="<?= h($sk) ?>"><button class="btn btn--ghost" style="padding:6px 10px"><?= $blocked ? 'Разблокировать' : 'Заблокировать' ?></button></form>
      <form method="post" action="<?= url('/admin/') ?>" style="display:inline" onsubmit="return confirm('Очистить всю переписку этого диалога?')"><?= csrf_field() ?><input type="hidden" name="do" value="clear"><input type="hidden" name="session_key" value="<?= h($sk) ?>"><button class="btn btn--ghost" style="padding:6px 10px;color:#c0392b">Очистить</button></form>
      <form method="post" action="<?= url('/admin/') ?>" style="display:inline" onsubmit="return confirm('Удалить диалог полностью?')"><?= csrf_field() ?><input type="hidden" name="do" value="del_dialog"><input type="hidden" name="session_key" value="<?= h($sk) ?>"><button class="btn btn--ghost" style="padding:6px 10px;color:#c0392b">Удалить диалог</button></form>
    </div>

    <div class="card chat-log" id="chatLog" data-sk="<?= h($sk) ?>"
         style="padding:14px;height:min(62vh,560px);overflow-y:auto;background:var(--a-bg,#f7f8fa)">
      <?php if (!$msgs): ?>
        <p class="muted">Сообщений пока нет.</p>
      <?php else: foreach ($msgs as $m):
          $role = (string) $m['role'];
          if (!in_array($role, ['user', 'assistant'], true)) {
              echo '<div style="text-align:center;color:#999;font-size:12px;margin:8px 0">' . h($roleRu[$role] ?? $role) . '</div>';
              continue;
          }
          $mine = $role === 'assistant';
          $txt  = trim((string) $m['text']);
          $file = trim((string) ($m['file'] ?? ''));
          /* Когда ответ реально у человека. Сайт — visible_at, ВК — vk_send_at.
             Пусто у обоих: ушло сразу (Клуб, оператор, шаблон вне графика). */
          $due     = trim((string) ($m['visible_at'] ?? '')) ?: trim((string) ($m['vk_send_at'] ?? ''));
          $pending = $mine && $due !== '' && strtotime($due) > time();
          $stamp   = $due !== '' ? $due : (string) $m['created_at']; ?>
        <div class="chat-row" data-mid="<?= (int) $m['id'] ?>" style="display:flex;justify-content:<?= $mine ? 'flex-end' : 'flex-start' ?>;margin:8px 0">
          <div style="max-width:78%;padding:9px 12px;border-radius:12px;background:<?= $pending ? '#fdf3e0' : ($mine ? '#d9f0e0' : '#fff') ?>;border:1px solid <?= $pending ? '#f0d9a8' : '#e4e7ec' ?><?= $pending ? ';opacity:.85' : '' ?>">
            <div style="font-size:11px;color:#888;margin-bottom:3px">
              <?= $mine ? 'Центр' : h($title) ?> · <?= h(date('d.m H:i', strtotime($stamp))) ?>
              <?php if ($pending): ?>
                <span style="color:#96601a">· в очереди, уйдёт в <?= h(date('H:i', strtotime($due))) ?></span>
              <?php elseif ($mine && $due !== ''): ?>
                <span style="color:#1c8a72">· доставлено</span>
              <?php endif; ?>
            </div>
            <?php if ($file !== ''): ?><div style="margin:4px 0"><a href="<?= h(url($file)) ?>" target="_blank">📎 вложение</a></div><?php endif; ?>
            <?php if ($txt !== ''): ?><div style="white-space:pre-wrap;word-break:break-word"><?= nl2br(h($txt)) ?></div><?php endif; ?>
            <div class="chat-tools" style="margin-top:5px;display:flex;gap:8px">
              <button type="button" class="lnk" style="font-size:11px;color:#2C7BE5;background:none;border:0;cursor:pointer;padding:0" onclick="chatEdit(<?= (int) $m['id'] ?>, this)">изменить</button>
              <form method="post" action="<?= url('/admin/') ?>" style="display:inline" onsubmit="return confirm('Удалить это сообщение?')"><?= csrf_field() ?><input type="hidden" name="do" value="del_msg"><input type="hidden" name="mid" value="<?= (int) $m['id'] ?>"><button style="font-size:11px;color:#c0392b;background:none;border:0;cursor:pointer;padding:0">удалить</button></form>
            </div>
            <form method="post" action="<?= url('/admin/') ?>" id="edit<?= (int) $m['id'] ?>" style="display:none;margin-top:6px"><?= csrf_field() ?>
              <input type="hidden" name="do" value="edit_msg"><input type="hidden" name="mid" value="<?= (int) $m['id'] ?>">
              <textarea name="text" rows="3" style="width:100%;box-sizing:border-box"><?= h($txt) ?></textarea>
              <div style="display:flex;gap:6px;margin-top:5px">
                <button class="btn btn--primary" style="padding:5px 12px">Сохранить</button>
                <button type="button" class="btn btn--ghost" style="padding:5px 12px" onclick="document.getElementById('edit<?= (int) $m['id'] ?>').style.display='none'">Отмена</button>
              </div>
            </form>
          </div>
        </div>
      <?php endforeach; endif; ?>
    </div>

    <form method="post" action="<?= url('/admin/') ?>" class="chat-reply" style="margin-top:14px"><?= csrf_field() ?>
      <input type="hidden" name="do" value="reply"><input type="hidden" name="session_key" value="<?= h($sk) ?>">
      <textarea name="text" rows="3" placeholder="Ответить участнику от имени центра…" required></textarea>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;flex-wrap:wrap;gap:8px">
        <span class="muted small">Ответ уйдёт участнику <?= $chan === 'vk' ? 'во ВКонтакте сообщением сообщества' : 'в чат на сайте' ?>. Ctrl+Enter — отправить. После вашего ответа бот молчит 5–10 минут.</span>
        <button class="btn btn--primary"><?= admin_icon('send') ?> Отправить</button>
      </div>
    </form>

    <style>
      .chat-log{scroll-behavior:smooth}
      .chat-log .chat-row .chat-tools{opacity:0;transition:opacity .15s}
      .chat-log .chat-row:hover .chat-tools{opacity:1}
      @media (hover:none){.chat-log .chat-row .chat-tools{opacity:1}}
      .chat-reply textarea{width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid #d0d5dd;font:inherit;resize:vertical}
      @media (max-width:640px){
        .chat-log{height:min(54vh,420px)}
        .chat-log .chat-row > div{max-width:92% !important}
      }
    </style>
    <script>
    function chatEdit(id, btn){ var f=document.getElementById('edit'+id); if(f) f.style.display = f.style.display==='none'?'block':'none'; }
    (function(){
      var log = document.getElementById('chatLog');
      if (!log) return;

      // Открываем диалог на последнем сообщении: оператору нужен свежий конец
      // переписки, а не её начало. Первый показ — без анимации, чтобы не мелькало.
      var sb = log.style.scrollBehavior; log.style.scrollBehavior = 'auto';
      log.scrollTop = log.scrollHeight;
      setTimeout(function(){ log.style.scrollBehavior = sb || 'smooth'; }, 60);

      var rows = log.querySelectorAll('.chat-row');
      var lastId = rows.length ? parseInt(rows[rows.length-1].getAttribute('data-mid'), 10) || 0 : 0;
      var sk = log.getAttribute('data-sk') || '';

      // Прокрутил вверх — читает старое; дёргать его вниз при новом сообщении нельзя.
      function atBottom(){ return log.scrollHeight - log.scrollTop - log.clientHeight < 60; }

      function draw(m){
        var mine = m.role === 'assistant';
        var row = document.createElement('div');
        row.className = 'chat-row'; row.setAttribute('data-mid', m.id);
        row.style.cssText = 'display:flex;justify-content:' + (mine?'flex-end':'flex-start') + ';margin:8px 0';
        var b = document.createElement('div');
        b.style.cssText = 'max-width:78%;padding:9px 12px;border-radius:12px;border:1px solid #e4e7ec;background:' +
                          (mine ? '#d9f0e0' : '#fff');
        var head = document.createElement('div');
        head.style.cssText = 'font-size:11px;color:#888;margin-bottom:3px';
        head.textContent = (mine ? 'Центр' : 'Участник') + ' · ' + String(m.created_at || '').slice(5,16).replace('-','.');
        b.appendChild(head);
        if (m.file){
          var a = document.createElement('a');
          a.href = m.file; a.target = '_blank'; a.textContent = 'вложение';
          a.style.cssText = 'display:block;margin:4px 0';
          b.appendChild(a);
        }
        if (m.text){
          var t = document.createElement('div');
          t.style.cssText = 'white-space:pre-wrap;word-break:break-word';
          t.textContent = m.text;
          b.appendChild(t);
        }
        row.appendChild(b); log.appendChild(row);
      }

      setInterval(function(){
        if (document.hidden) return;
        var stick = atBottom();
        fetch(location.pathname + '?p=chats&ajax=1&s=' + encodeURIComponent(sk) + '&since=' + lastId,
              {credentials:'same-origin'})
          .then(function(r){ return r.json(); })
          .then(function(d){
            var list = (d && d.messages) || [];
            if (!list.length) return;
            for (var i=0;i<list.length;i++){ draw(list[i]); lastId = Math.max(lastId, list[i].id|0); }
            if (stick) log.scrollTop = log.scrollHeight;
          }).catch(function(){});
      }, 6000);

      // Ctrl+Enter отправляет ответ — привычно всем, кто много переписывается.
      var ta = document.querySelector('.chat-reply textarea');
      if (ta) ta.addEventListener('keydown', function(e){
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') this.form.requestSubmit();
      });
    })();
    </script>
    <?php
    admin_layout('Чат-бот · ' . $title, ob_get_clean(), 'chats');
    exit;
}

/* ------------------------------- Список диалогов ------------------------------- */
$ch = trim((string) input('ch'));       // '', 'web', 'vk'
$qq = trim((string) input('q'));
$where = ["m.role IN ('user','assistant')"];
$args = [];
if ($ch === 'vk')  $where[] = "m.session_key LIKE 'vk\\_%' ESCAPE '\\'";
if ($ch === 'web') $where[] = "m.session_key NOT LIKE 'vk\\_%' ESCAPE '\\'";
if ($qq !== '') {
    $where[] = "(m.session_key IN (SELECT session_key FROM chat_messages WHERE text LIKE ?)
             OR m.session_key IN (SELECT session_key FROM chat_dialogs WHERE title LIKE ?))";
    $args[] = '%' . $qq . '%'; $args[] = '%' . $qq . '%';
}
$sqlWhere = implode(' AND ', $where);

$dialogs = [];
try {
    $dialogs = all(
        "SELECT m.session_key,
                MAX(m.id) AS last_id, MAX(m.created_at) AS last_at, COUNT(*) AS cnt,
                (SELECT text FROM chat_messages WHERE session_key=m.session_key AND text<>'' ORDER BY id DESC LIMIT 1) AS last_text,
                (SELECT role FROM chat_messages WHERE session_key=m.session_key AND role IN ('user','assistant') ORDER BY id DESC LIMIT 1) AS last_role,
                d.channel, d.title, d.bot_enabled, d.blocked, d.operator_until, d.pending_offhours, d.peer_id
           FROM chat_messages m
      LEFT JOIN chat_dialogs d ON d.session_key = m.session_key
          WHERE $sqlWhere
       GROUP BY m.session_key
       ORDER BY last_id DESC
          LIMIT 120", $args);
} catch (\Throwable $e) { $dialogs = []; }

// Счётчики каналов.
$cVk = 0; $cWeb = 0;
try {
    $cVk  = (int) scalar("SELECT COUNT(DISTINCT session_key) FROM chat_messages WHERE session_key LIKE 'vk\\_%' ESCAPE '\\' AND role IN ('user','assistant')");
    $cWeb = (int) scalar("SELECT COUNT(DISTINCT session_key) FROM chat_messages WHERE session_key NOT LIKE 'vk\\_%' ESCAPE '\\' AND role IN ('user','assistant')");
} catch (\Throwable $e) {}

ob_start(); ?>
<div class="page-head">
  <h1>Чат-бот</h1>
  <p class="muted small">Все диалоги — на сайте и во ВКонтакте. Откройте диалог, чтобы прочитать переписку и ответить самому, отредактировать или удалить сообщения бота, выключить бота или заблокировать. Когда отвечаете сами — бот автоматически молчит 5–10 минут.</p>
</div>

<?php $botAll = chat_bot_enabled(); ?>
<form method="post" action="<?= url('/admin/') ?>" style="margin:0 0 14px"><?= csrf_field() ?>
  <input type="hidden" name="do" value="bot_all">
  <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:12px 14px;border-radius:12px;
              background:<?= $botAll ? '#f2f7ff' : '#fff5f5' ?>;border:1px solid <?= $botAll ? '#cfe0fb' : '#f3c8c8' ?>">
    <div style="flex:1;min-width:200px">
      <b><?= $botAll ? 'Бот отвечает' : 'Бот выключен везде' ?></b>
      <div class="muted small" style="margin-top:2px">
        <?= $botAll
            ? 'Автоответы идут на сайте и во ВКонтакте.'
            : 'На сайте и во ВКонтакте бот молчит. Сообщения участников сохраняются — отвечайте здесь сами.' ?>
      </div>
    </div>
    <button class="btn <?= $botAll ? 'btn--ghost' : 'btn--primary' ?>" style="padding:9px 16px">
      <?= $botAll ? 'Выключить бота везде' : 'Включить бота' ?>
    </button>
  </div>
</form>

<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
  <div class="tabs" style="display:flex;gap:6px">
    <a class="tag <?= $ch === '' ? 'active' : '' ?>" href="<?= a_link('chats') ?>" style="padding:7px 13px;border-radius:10px;<?= $ch===''?'background:var(--a-navy);color:#fff;':'' ?>">Все · <?= $cVk + $cWeb ?></a>
    <a class="tag <?= $ch === 'vk' ? 'active' : '' ?>" href="<?= a_link('chats', ['ch' => 'vk']) ?>" style="padding:7px 13px;border-radius:10px;<?= $ch==='vk'?'background:var(--a-navy);color:#fff;':'' ?>">ВКонтакте · <?= $cVk ?></a>
    <a class="tag <?= $ch === 'web' ? 'active' : '' ?>" href="<?= a_link('chats', ['ch' => 'web']) ?>" style="padding:7px 13px;border-radius:10px;<?= $ch==='web'?'background:var(--a-navy);color:#fff;':'' ?>">Сайт · <?= $cWeb ?></a>
  </div>
  <form method="get" action="<?= url('/admin/') ?>" style="display:flex;gap:6px;margin-left:auto">
    <input type="hidden" name="p" value="chats"><?php if ($ch !== ''): ?><input type="hidden" name="ch" value="<?= h($ch) ?>"><?php endif; ?>
    <input type="search" name="q" value="<?= h($qq) ?>" placeholder="Поиск по имени или тексту" style="padding:7px 11px;border-radius:9px;border:1px solid #d0d5dd;min-width:180px">
    <button class="btn btn--ghost" style="padding:7px 12px"><?= admin_icon('search') ?></button>
  </form>
</div>

<details style="margin-bottom:14px"><summary style="cursor:pointer;color:#2C7BE5">Написать участнику ВК первым (создать диалог)</summary>
  <form method="post" action="<?= url('/admin/') ?>" style="display:flex;gap:6px;margin-top:8px;max-width:420px"><?= csrf_field() ?>
    <input type="hidden" name="do" value="create">
    <input type="text" name="peer_id" placeholder="ВК id участника (например 12345678)" style="flex:1;padding:8px;border-radius:9px;border:1px solid #d0d5dd">
    <button class="btn btn--primary" style="padding:8px 14px">Создать</button>
  </form>
</details>

<?php if (!$dialogs): ?>
  <p class="muted">Диалогов пока нет.</p>
<?php else: ?>
  <div style="display:flex;flex-direction:column;gap:8px">
    <?php foreach ($dialogs as $d):
        $sk = (string) $d['session_key'];
        $chan = chats_channel($sk);
        $title = chats_title($d);
        $last = trim((string) ($d['last_text'] ?? ''));
        $blocked = (int) ($d['blocked'] ?? 0) === 1;
        $botOff  = (int) ($d['bot_enabled'] ?? 1) === 0;
        $opUntil = trim((string) ($d['operator_until'] ?? ''));
        $opActive = $opUntil !== '' && strtotime($opUntil) > time();
        $pending = (int) ($d['pending_offhours'] ?? 0) === 1;
        $needsReply = ((string) ($d['last_role'] ?? '')) === 'user'; ?>
      <a href="<?= a_link('chats', ['s' => $sk]) ?>" class="card" style="display:flex;gap:12px;align-items:center;padding:12px 14px;text-decoration:none;color:inherit;border-left:4px solid <?= $chan==='vk'?'#4a76a8':'#0b7' ?>">
        <div style="flex:1;min-width:0">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <b><?= h($title) ?></b>
            <span style="font-size:11px;color:#fff;background:<?= $chan==='vk'?'#4a76a8':'#0b7' ?>;padding:2px 7px;border-radius:6px"><?= $chan==='vk'?'ВК':'сайт' ?></span>
            <?php if ($needsReply): ?><span style="font-size:11px;color:#fff;background:#e67e22;padding:2px 7px;border-radius:6px">ждёт ответа</span><?php endif; ?>
            <?php if ($pending): ?><span style="font-size:11px;color:#fff;background:#8e44ad;padding:2px 7px;border-radius:6px">вопрос вне графика</span><?php endif; ?>
            <?php if ($opActive): ?><span style="font-size:11px;color:#fff;background:#8e44ad;padding:2px 7px;border-radius:6px">перехват</span><?php endif; ?>
            <?php if ($botOff): ?><span style="font-size:11px;color:#fff;background:#e67e22;padding:2px 7px;border-radius:6px">бот выкл</span><?php endif; ?>
            <?php if ($blocked): ?><span style="font-size:11px;color:#fff;background:#c0392b;padding:2px 7px;border-radius:6px">блок</span><?php endif; ?>
          </div>
          <div class="muted" style="font-size:13px;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><?= h(mb_substr($last, 0, 120)) ?></div>
        </div>
        <div class="muted small" style="white-space:nowrap"><?= h(date('d.m H:i', strtotime((string) $d['last_at']))) ?> · <?= (int) $d['cnt'] ?></div>
      </a>
    <?php endforeach; ?>
  </div>
<?php endif; ?>
<?php
admin_layout('Чат-бот', ob_get_clean(), 'chats');
