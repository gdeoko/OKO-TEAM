<?php
/**
 * ЧТО ДЕЛАЕМ С ПРОЧИТАННЫМИ ПИСЬМАМИ.
 *
 * Читалка (cron/inbox_read.php) только раскладывает письма по полкам. Здесь
 * начинаются действия, и потому здесь же собраны все предохранители: на каждое
 * письмо приходится либо одно действие, либо ни одного, и ни одно действие не
 * повторяется дважды.
 *
 *   согласие учреждения  → partner_accept(): сертификат и доступ в кабинет
 *                          уходят сами, без участия оргкомитета;
 *   отказ учреждения     → адрес удаляется навсегда, больше не пишем;
 *   вопрос               → отвечает помощник центра тем же мозгом, что и в чате
 *                          на сайте, с тем же запретом называть результаты
 *                          раньше срока (core/chat_gate.php);
 *   ведомства            → не трогаем: ими занимается cron/ministry_replies.php,
 *                          и два разборщика на один ящик означали бы два ответа
 *                          одному ведомству.
 *
 * Рубильники в настройках (settings), оба по умолчанию включены:
 *   inbox_auto_partner = 0 — не принимать и не удалять учреждения автоматически;
 *   inbox_auto_reply   = 0 — помощник не отвечает на письма.
 *
 * Крон: раз в две минуты, строка в scripts/crontab.txt.
 *   php cron/inbox_actions.php        — рабочий прогон
 *   php cron/inbox_actions.php dry    — показать, что сделал бы, и ничего не делать
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/inbox_reader.php';
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/chat_gate.php';
require_once BASE_PATH . '/core/chat_brain.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'inbox_actions';

$dry = in_array('dry', $argv, true);
if (!$dry && !cron_lock(JOB, 600)) { exit(0); }

$autoPartner = (string) setting('inbox_auto_partner', '1') === '1';
$autoReply   = (string) setting('inbox_auto_reply', '1') === '1';

function ia_log(string $s): void { cron_log(JOB, $s); echo $s . "\n"; }

/** Ответ помощника уходит с того же ящика, куда написал человек. */
function ia_account(string $mailbox): array {
    $name = inbox_boxes()[$mailbox] ?? 'news';
    $acc  = mail_account_by_name($name);
    if (!is_array($acc)) $acc = [];

    // С ЯЩИКА, КОТОРЫЙ ТОЛЬКО ЧИТАЕМ, ОТВЕЧАТЬ НЕЛЬЗЯ.
    //
    // Исторический адрес центра на mail.ru подключён для чтения: туда ведомства
    // пишут по старым бланкам. Отправка с него не наш канал, и ответ помощника
    // уходил бы с адреса, которого нет ни на сайте, ни в подписи. Отвечаем с
    // рабочей почты центра — как на письмо сайта.
    if (!empty($acc['read_only'])) {
        $work = mail_account_by_name('kc');
        if (is_array($work) && !empty($work['user'])) return $work;
    }
    return $acc;
}

/** Простое письмо от центра: без рекламной обвязки и без кнопки отписки. */
function ia_wrap(string $text): string {
    $tel  = h((string) cfgv('org_phone', ''));
    $mail = h((string) cfgv('org_email', ''));
    $site = h((string) cfgv('domain', 'музыкальный-мир.рф'));
    $body = '';
    foreach (preg_split('~\n{1,}~u', trim($text)) ?: [] as $p) {
        $p = trim($p);
        if ($p !== '') $body .= '<p style="margin:0 0 12px">' . nl2br(h($p)) . '</p>';
    }
    return '<div style="font-family:Georgia,serif;font-size:15px;line-height:1.65;color:#222;max-width:600px">'
         . $body
         . '<p style="margin:18px 0 0;color:#555;font-size:13px">С уважением,<br>'
         . 'Оргкомитет Культурного центра «Музыкальный Мир»<br>'
         . $tel . ' · ' . $mail . ' · ' . $site . '</p></div>';
}

try {
    $rows = all("SELECT * FROM inbox_messages
                  WHERE handled_by='' AND is_auto=0
                    AND kind NOT IN ('service','bounce','auto')
               ORDER BY id ASC LIMIT 40");
    if (!$rows) { echo "разбирать нечего\n"; if (!$dry) cron_unlock(JOB); exit(0); }

    $own = inbox_own_emails();
    $did = ['accept' => 0, 'decline' => 0, 'bot' => 0, 'skip' => 0];

    foreach ($rows as $r) {
        $id    = (int) $r['id'];
        $from  = mb_strtolower(trim((string) $r['from_email']));
        $kind  = (string) $r['kind'];
        $box   = (string) $r['mailbox'];
        $mark  = static function (string $how, string $reply = '') use ($id, $dry): void {
            if ($dry) return;
            q("UPDATE inbox_messages SET handled_by=?, reply_text=?, reply_sent_at=? WHERE id=?",
              [$how, $reply, $reply !== '' ? date('Y-m-d H:i:s') : '', $id]);
        };

        if ($from === '' || in_array($from, $own, true)) { $mark('skip'); $did['skip']++; continue; }

        /* ── Ведомства: их ведёт отдельный крон, здесь только помечаем ── */
        if (str_starts_with($kind, 'ministry')) {
            $mark('skip');
            $did['skip']++;
            continue;
        }

        /* ── «Удалите мой адрес» — исполняем сразу, без вопросов и без ответа ──
         *
         * Отвечать на такую просьбу нельзя: ответ — это ещё одно письмо тому,
         * кто попросил больше не писать. Молча закрываем адрес везде, где он
         * может всплыть: подписка, учреждение, очередь, стоп-лист.
         */
        if ($kind === 'optout') {
            if ($dry) { ia_log('ЗАКРЫЛ БЫ адрес по просьбе: ' . $from); $did['decline']++; continue; }
            try {
                q("INSERT OR IGNORE INTO mail_stop (email, reason) VALUES (?, 'отказался от рассылки')", [$from]);
                q("UPDATE subscribers SET active=0 WHERE LOWER(email)=?", [$from]);
                q("UPDATE institutions SET status='unsubscribed', updated_at=datetime('now','localtime')
                    WHERE LOWER(email)=?", [$from]);
                q("UPDATE mail_queue SET status='cancelled', error='человек попросил удалить адрес'
                    WHERE status='queued' AND LOWER(to_email)=?", [$from]);
                ia_log('адрес закрыт по просьбе человека: ' . $from);
                $mark('auto_decline');
                $did['decline']++;
            } catch (\Throwable $e) {
                ia_log('не удалось закрыть адрес ' . $from . ': ' . $e->getMessage());
                $mark('human');
            }
            continue;
        }

        /* ── Согласие учреждения на партнёрство ── */
        if ($kind === 'partner_accept') {
            $instId = (int) $r['inst_id'];
            if ($instId <= 0) {
                // Адрес не нашёлся в базе учреждений: принимать вслепую нельзя,
                // сертификат уйдёт неизвестно кому. Отдаём оператору.
                ia_log('согласие с неизвестного адреса, нужен оператор: ' . $from);
                $mark('human');
                continue;
            }
            if (!$autoPartner) { ia_log('автоприём выключен, оставляю оператору: ' . $from); $mark('human'); continue; }
            // Название учреждения лежит в колонке name (в таблице ведомств — в org,
            // и на этом различии здесь однажды всё падало: запрос к несуществующей
            // колонке обрывал разбор всей пачки писем, и почта переставала разбираться).
            $inst = one("SELECT id, name, partner_status FROM institutions WHERE id=?", [$instId]);
            // Принятый партнёр помечается статусом accepted (так его ставит
            // partner_accept). Сверять надо именно с ним.
            if ($inst && (string) ($inst['partner_status'] ?? '') === 'accepted') {
                ia_log('уже партнёр, повторное согласие: ' . $from);
                $mark('auto_accept');
                continue;
            }
            if ($dry) { ia_log('ПРИНЯЛ БЫ партнёром: ' . $from . ' (' . (string) ($inst['name'] ?? '') . ')'); $did['accept']++; continue; }
            try {
                $res = partner_accept($instId);
                // Сертификат и доступ в кабинет уходят сразу: пароль существует
                // в открытом виде только здесь, в ответе partner_accept. Не отправить
                // его сейчас — значит не отправить никогда.
                partner_send_welcome($instId, (string) ($res['password_plain'] ?? ''));
                ia_log('принят партнёром: ' . $from . ' (' . (string) ($inst['name'] ?? '') . ')');
                $mark('auto_accept');
                $did['accept']++;
            } catch (\Throwable $e) {
                ia_log('не удалось принять ' . $from . ': ' . $e->getMessage());
                $mark('human');
            }
            continue;
        }

        /* ── Отказ учреждения: адрес удаляем навсегда ── */
        if ($kind === 'partner_decline') {
            $instId = (int) $r['inst_id'];
            if (!$autoPartner) { $mark('human'); continue; }
            if ($dry) { ia_log('УДАЛИЛ БЫ адрес: ' . $from); $did['decline']++; continue; }
            try {
                // Партнёра, который уже принят, не выбрасываем по одному письму:
                // у него на руках сертификат и доступ в кабинет, тут нужен человек.
                $st = $instId > 0 ? (string) (scalar("SELECT partner_status FROM institutions WHERE id=?", [$instId]) ?? '') : '';
                if ($st === 'accepted') { ia_log('отказ от действующего партнёра, нужен оператор: ' . $from); $mark('human'); continue; }
                if ($instId > 0) {
                    partner_decline($instId, 'отказ письмом ' . date('d.m.Y'));
                    q("UPDATE institutions SET email='' WHERE id=?", [$instId]);
                }
                q("UPDATE subscribers SET active=0 WHERE LOWER(email)=?", [$from]);
                ia_log('отказ, адрес удалён навсегда: ' . $from);
                $mark('auto_decline');
                $did['decline']++;
            } catch (\Throwable $e) {
                ia_log('не удалось обработать отказ ' . $from . ': ' . $e->getMessage());
                $mark('human');
            }
            continue;
        }

        /* ── Вопрос: отвечает помощник ── */
        if (!$autoReply) { $mark('human'); continue; }

        // ПОМОЩНИК ОТВЕЧАЕТ ТОЛЬКО СВОИМ.
        //
        // На почту центра идёт поток служебных писем от сервисов: регистратор
        // домена, оператор фискальных данных, сам сервис рассылок, рекламные
        // письма площадок. Формально это «вопрос» с живого адреса, и помощник
        // честно отвечал регистратору домена рассказом о сроках приёма заявок.
        // Отвечаем, только если адрес есть в наших базах: участник, пользователь
        // кабинета, учреждение, ведомство или подписчик. Остальное — оператору.
        $known = false;
        foreach ([
            "SELECT 1 FROM applications WHERE LOWER(email)=? LIMIT 1",
            "SELECT 1 FROM users        WHERE LOWER(email)=? LIMIT 1",
            "SELECT 1 FROM institutions WHERE LOWER(email)=? LIMIT 1",
            "SELECT 1 FROM ministries   WHERE LOWER(email)=? LIMIT 1",
            "SELECT 1 FROM subscribers  WHERE LOWER(email)=? LIMIT 1",
        ] as $sql) {
            try { if (scalar($sql, [$from])) { $known = true; break; } } catch (\Throwable $e) {}
        }
        if (!$known) {
            ia_log('адрес не из наших баз, помощник не отвечает: ' . $from);
            $mark('human');
            $did['skip']++;
            continue;
        }

        // Один ответ на адрес в полчаса: без этого переписка с чужим
        // автоответчиком превращается в бесконечную петлю, а домен — в спамера.
        $last = (string) (scalar("SELECT MAX(reply_sent_at) FROM inbox_messages WHERE from_email=? AND reply_sent_at<>''", [$from]) ?? '');
        if ($last !== '' && strtotime($last) > time() - 1800) { $mark('dedup'); $did['skip']++; continue; }

        // Контекст участника — по адресу письма. Через него же работает запрет
        // называть результат раньше, чем он ушёл человеку на почту.
        $uid = (int) $r['user_id'] ?: null;
        $GLOBALS['chat_gates']    = [];
        $GLOBALS['chat_user_ctx'] = $uid ? chat_user_context($uid) : '';
        $ask = 'Письмо на ящик ' . $box . '@музыкальный-мир.рф. Тема: ' . (string) $r['subject']
             . "\nТекст письма:\n" . (string) $r['body_text'];
        $reply = chat_brain_reply($ask, 'inbox:' . md5($from), $uid, 'vk');

        if (trim($reply) === '' || !empty($GLOBALS['chat_fell_back'])) {
            ia_log('помощник не смог ответить, нужен оператор: ' . $from);
            $mark('human');
            continue;
        }
        if ($dry) { ia_log('ОТВЕТИЛ БЫ ' . $from . ': ' . mb_substr($reply, 0, 90)); $did['bot']++; continue; }

        $ok = mail_send($from, 'Re: ' . ((string) $r['subject'] ?: 'Ваше обращение'), ia_wrap($reply),
                        ['account' => ia_account($box)]);
        if ($ok) {
            ia_log('ответ отправлен: ' . $from);
            $mark('bot', $reply);
            $did['bot']++;
        } else {
            ia_log('ответ не ушёл (' . mail_last_error() . '), нужен оператор: ' . $from);
            $mark('human');
        }
    }

    $sum = sprintf('итог: принято партнёров %d, удалено отказников %d, ответов помощника %d, отложено %d',
        $did['accept'], $did['decline'], $did['bot'], $did['skip']);
    echo $sum . "\n";
    if (!$dry && array_sum($did) > 0) cron_log(JOB, $sum);
} catch (\Throwable $e) {
    ia_log('ОШИБКА: ' . $e->getMessage());
} finally {
    if (!$dry) cron_unlock(JOB);
}
