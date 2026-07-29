<?php
/**
 * Multi-channel broadcast: сопровождение newsletter рассылки трансляцией в ВК-сообщество
 * и Telegram-канал (или админ-чат). Работает поверх существующих модулей vk.php + telegram.php.
 */
declare(strict_types=1);

/**
 * Отправляет краткий анонс newsletter в дополнительные каналы.
 * Возвращает ['vk' => bool, 'tg' => bool, 'tg_users' => int] — что отправлено.
 * Каналы (bitmap): бит 1=VK, бит 2=TG-канал (публикация), бит 4=TG-пользователям (по tg_id).
 */
function broadcast_newsletter_fanout(array $newsletter, int $channels = 0): array {
    $res = ['vk' => false, 'tg_channel' => false, 'tg_users' => 0];
    if ($channels <= 0) return $res;

    $subject = trim((string)($newsletter['subject'] ?? ''));
    $body    = (string)($newsletter['body'] ?? '');
    // Text-only preview (стрипаем HTML для соц-сетей).
    $preview = strip_tags(preg_replace('~<br\s*/?>~i', "\n", $body));
    $preview = preg_replace("/\n{3,}/", "\n\n", $preview);
    $baseUrl = rtrim((string) cfgv('base_url'), '/');

    $msg = ($subject !== '' ? "📌 $subject\n\n" : '') . mb_substr($preview, 0, 900);
    if (mb_strlen($preview) > 900) $msg .= '…';
    $msg .= "\n\n🌐 " . $baseUrl . '/';

    // VK community post
    if (($channels & 1) && function_exists('vk_wall_post') && (string) cfgv('vk_token') !== '') {
        try {
            $r = vk_wall_post($msg);
            $res['vk'] = !empty($r) && empty($r['error']);
        } catch (\Throwable $e) { /* лог внутри vk_api */ }
    }

    // Telegram-канал (org_tg_channel = @channel_username или -100xxx id)
    if (($channels & 2) && function_exists('tg_send')) {
        $ch = trim((string) cfgv('org_tg_channel', ''));
        if ($ch !== '') {
            // org_tg_channel может быть URL «https://t.me/xxx» — извлечём хвост
            if (preg_match('~t\.me/([^/?#]+)~i', $ch, $m)) $ch = '@' . $m[1];
            elseif ($ch !== '' && $ch[0] !== '@' && !ctype_digit(ltrim($ch, '-'))) $ch = '@' . $ch;
            try {
                $ok = tg_send($ch, $msg);
                $res['tg_channel'] = (bool) $ok;
            } catch (\Throwable $e) { /* ignore */ }
        }
    }

    // Telegram — рассылка привязавшим бота пользователям (notify_tg=1 && tg_id!='')
    if (($channels & 4) && function_exists('tg_send')) {
        try {
            $rows = all("SELECT id, tg_id, full_name FROM users WHERE tg_id<>'' AND (notify_tg IS NULL OR notify_tg=1)");
            $sent = 0;
            foreach ($rows as $u) {
                $tg = (string) ($u['tg_id'] ?? '');
                if ($tg === '') continue;
                try { if (tg_send($tg, $msg)) $sent++; } catch (\Throwable $e) {}
                // Мягкая пауза, чтобы не выйти за лимиты Bot API (~30 msg/сек)
                usleep(60000);
            }
            $res['tg_users'] = $sent;
        } catch (\Throwable $e) { /* ignore */ }
    }

    if (function_exists('audit')) {
        audit('broadcast_fanout', 'newsletter', (int)($newsletter['id'] ?? 0), array_merge(['channels' => $channels], $res));
    }
    return $res;
}
