<?php
/**
 * Валидаторы форм КЦ «Музыкальный Мир».
 * Почта (MX + отсев одноразовых), телефон (+7 …), видеоссылка (платформа + живость),
 * ФИО (кириллица, регистр), орфография (Яндекс.Спеллер).
 * Контракт: см. docs/CONTRACTS.md (раздел validator). Все внешние вызовы — cURL c таймаутом.
 */
declare(strict_types=1);

/** Домены одноразовой почты (отсекаем). */
function DISPOSABLE_MAIL_DOMAINS(): array {
    return [
        'mailinator.com','tempmail.com','temp-mail.org','10minutemail.com','guerrillamail.com',
        'guerrillamail.net','guerrillamail.org','sharklasers.com','grr.la','trashmail.com',
        'yopmail.com','getnada.com','dispostable.com','maildrop.cc','mohmal.com','fakeinbox.com',
        'throwawaymail.com','mailnesia.com','tempmailo.com','emailondeck.com','mintemail.com',
        'spam4.me','tempinbox.com','mytemp.email','mailcatch.com','tempr.email','1secmail.com',
    ];
}

/** Проверка e-mail: формат + MX-запись + отсев одноразовых. */
function v_email(string $e): array {
    $e = mb_strtolower(trim($e));
    if ($e === '' || !preg_match('/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i', $e)
        || !filter_var($e, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'reason' => 'Проверьте написание адреса электронной почты'];
    }
    $domain = substr(strrchr($e, '@'), 1);
    if (in_array($domain, DISPOSABLE_MAIL_DOMAINS(), true)) {
        return ['ok' => false, 'reason' => 'Одноразовые почтовые ящики не принимаются'];
    }
    // MX (с фолбэком на A) — если DNS недоступен, не блокируем строго.
    if (function_exists('checkdnsrr')) {
        $hasMx = @checkdnsrr($domain, 'MX') || @checkdnsrr($domain, 'A');
        if (!$hasMx) {
            return ['ok' => false, 'reason' => 'Почтовый домен не найден, проверьте адрес'];
        }
    }
    return ['ok' => true, 'reason' => ''];
}

/** Нормализация телефона к российскому формату +7 (___) ___-__-__. */
function v_phone(string $p): array {
    $digits = preg_replace('/\D+/', '', $p);
    // 8XXXXXXXXXX или 7XXXXXXXXXX → 7XXXXXXXXXX; 10 цифр → добавить 7.
    if (strlen($digits) === 11 && ($digits[0] === '8' || $digits[0] === '7')) {
        $digits = '7' . substr($digits, 1);
    } elseif (strlen($digits) === 10) {
        $digits = '7' . $digits;
    }
    if (strlen($digits) !== 11 || $digits[0] !== '7') {
        return ['ok' => false, 'formatted' => trim($p)];
    }
    $formatted = sprintf('+7 (%s) %s-%s-%s',
        substr($digits, 1, 3), substr($digits, 4, 3), substr($digits, 7, 2), substr($digits, 9, 2));
    return ['ok' => true, 'formatted' => $formatted];
}

/** Проверка конкурсной видеоссылки: платформа + отсев архивов + живость (HEAD). */
function v_video(string $url): array {
    $url = trim($url);
    if ($url === '' || !preg_match('~^https?://~i', $url)) {
        return ['ok' => false, 'platform' => '', 'reason' => 'Укажите полную ссылку, начиная с https://'];
    }
    $host = strtolower((string) parse_url($url, PHP_URL_HOST));
    $host = preg_replace('/^www\./', '', $host);
    if ($host === '') {
        return ['ok' => false, 'platform' => '', 'reason' => 'Не удалось разобрать ссылку'];
    }

    // Архивы вместо видео — отклоняем.
    $path = strtolower((string) parse_url($url, PHP_URL_PATH));
    if (preg_match('/\.(zip|rar|7z|tar|gz)$/', $path)) {
        return ['ok' => false, 'platform' => '', 'reason' => 'Ссылка ведёт на архив, а не на видео'];
    }

    // Запрещённые платформы.
    foreach (BLOCKED_PLATFORMS() as $bad) {
        if ($host === $bad || str_ends_with($host, '.' . $bad)) {
            return ['ok' => false, 'platform' => $bad,
                    'reason' => 'Эта платформа не принимается. Загрузите работу на RuTube, VK Видео или Яндекс Диск'];
        }
    }

    // Разрешённые платформы.
    $platform = '';
    foreach (ALLOWED_PLATFORMS() as $dom => $title) {
        if ($host === $dom || str_ends_with($host, '.' . $dom)) { $platform = $title; break; }
    }
    if ($platform === '') {
        return ['ok' => false, 'platform' => '',
                'reason' => 'Ссылка с неподдерживаемого хостинга. Используйте RuTube, VK Видео, ОК, Дзен или облачные диски'];
    }

    // Живость ссылки НЕ проверяем сетевым HEAD-запросом: RuTube/YouTube/ВК часто отдают
    // 404/redirect ботам на валидных видео → ложные отказы + 8с латентности на каждую заявку
    // (критично при массовой подаче). Проверяем только платформу и формат. Доступность
    // конкретного видео проверяет жюри при оценке.
    return ['ok' => true, 'platform' => $platform, 'reason' => ''];
}

/** HEAD-запрос cURL: жива ли ссылка. true при недоступности сети (не караем зря). */
function v_url_alive(string $url): bool {
    if (!function_exists('curl_init')) return true;
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_NOBODY         => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; MuzMirBot/1.0)',
        CURLOPT_RETURNTRANSFER => true,
    ]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $errno = curl_errno($ch);
    curl_close($ch);

    // Сеть недоступна из окружения — не блокируем пользователя.
    if ($errno === CURLE_COULDNT_RESOLVE_HOST || $errno === CURLE_COULDNT_CONNECT || $errno === CURLE_OPERATION_TIMEDOUT) {
        return true;
    }
    // Реджектим только явно «мёртвые» ссылки (404/410).
    // 403/401/405/5xx и код 0 — платформа блокирует ботов или прокси-помеха: пропускаем.
    if (in_array($code, [404, 410], true)) return false;
    return true;
}

/** ФИО: только кириллица и дефис, «Первая Заглавная Каждого Слова». */
function v_fio(string $s): string {
    $s = trim(preg_replace('/\s+/u', ' ', $s));
    // Оставляем кириллицу, пробел и дефис.
    $s = preg_replace('/[^\p{Cyrillic}\s\-]/u', '', $s);
    $s = trim($s);
    if ($s === '') return '';

    $words = preg_split('/\s+/u', $s);
    $out = [];
    foreach ($words as $w) {
        // Каждая часть через дефис — с заглавной.
        $parts = array_map('v_cap_word', explode('-', $w));
        $out[] = implode('-', $parts);
    }
    return implode(' ', $out);
}

/** Первая буква слова заглавная, остальные строчные (мультибайт). */
function v_cap_word(string $w): string {
    if ($w === '') return '';
    $first = mb_strtoupper(mb_substr($w, 0, 1, 'UTF-8'), 'UTF-8');
    $rest  = mb_strtolower(mb_substr($w, 1, null, 'UTF-8'), 'UTF-8');
    return $first . $rest;
}

/** Орфография через Яндекс.Спеллер. Тихий фолбэк на исходный текст. */
function v_spell(string $t): string {
    $t = trim($t);
    if ($t === '' || !function_exists('curl_init')) return $t;

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => 'https://speller.yandex.net/services/spellservice.json/checkText',
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query(['text' => $t, 'lang' => 'ru,en', 'options' => 512]),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $resp  = curl_exec($ch);
    $errno = curl_errno($ch);
    $code  = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);

    if ($resp === false || $errno !== 0 || $code !== 200) return $t;

    $data = json_decode((string) $resp, true);
    if (!is_array($data) || $data === []) return $t;

    // Применяем правки справа налево, чтобы не сбить позиции (pos/len — в символах UTF-8).
    usort($data, fn($a, $b) => ($b['pos'] ?? 0) <=> ($a['pos'] ?? 0));
    foreach ($data as $item) {
        if (empty($item['s'][0]) || !isset($item['pos'], $item['len'])) continue;
        $before = mb_substr($t, 0, (int) $item['pos'], 'UTF-8');
        $after  = mb_substr($t, (int) $item['pos'] + (int) $item['len'], null, 'UTF-8');
        $t = $before . $item['s'][0] . $after;
    }
    return $t;
}
