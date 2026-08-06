<?php
/**
 * Проверка конкурсной видео-ссылки для ПОДАЧИ заявки (то же, что жюри видит при оценке):
 * определение даты публикации (RuTube / VK) и «свежести» — не старше 1 года.
 * Используется в api/v1/apply.php, чтобы НЕ пропускать заведомо нарушающее положение видео
 * (п. 8.11 — материал старше 1 года). Если дату определить нельзя — не блокируем (сеть может врать).
 */
declare(strict_types=1);

if (!function_exists('_lc_http_json')) {
    /** GET JSON с коротким таймаутом; null при любой ошибке. */
    function _lc_http_json(string $url): ?array {
        if (!function_exists('curl_init')) return null;
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 4,
            CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => 8,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (MuzMirLinkCheck)',
        ]);
        $body = curl_exec($ch);
        $err = curl_errno($ch);
        curl_close($ch);
        if ($err || !is_string($body) || $body === '') return null;
        $j = json_decode($body, true);
        return is_array($j) ? $j : null;
    }
}

if (!function_exists('video_publish_ts')) {
    /** Unix-время публикации конкурсного видео (RuTube / VK), либо null если не определить. */
    function video_publish_ts(string $url): ?int {
        $url = trim($url);
        if ($url === '') return null;
        try {
            if (preg_match('#rutube\.ru/(?:video|shorts|play/embed)/([a-z0-9]+)#i', $url, $m)) {
                $j = _lc_http_json('https://rutube.ru/api/video/' . $m[1] . '/');
                if ($j && !empty($j['created_ts'])) return strtotime((string) $j['created_ts']) ?: null;
            } elseif (preg_match('#(?:vk\.com|vkvideo\.ru)/video(-?\d+_\d+)#', $url, $m)) {
                $tok = function_exists('cfgv') ? (string) cfgv('vk_token', '') : '';
                if ($tok !== '') {
                    $j = _lc_http_json('https://api.vk.com/method/video.get?videos=' . $m[1]
                        . '&access_token=' . rawurlencode($tok) . '&v=5.199');
                    $item = $j['response']['items'][0] ?? null;
                    if ($item && !empty($item['date'])) return (int) $item['date'];
                }
            }
        } catch (\Throwable $e) { /* тихо */ }
        return null;
    }
}

if (!function_exists('video_is_stale')) {
    /**
     * true  — видео СТАРШЕ 1 года (нарушение положения, блокируем подачу);
     * false — свежее (в пределах года);
     * null  — дату определить не удалось (не блокируем).
     */
    function video_is_stale(string $url): ?bool {
        $ts = video_publish_ts($url);
        if ($ts === null) return null;
        return $ts < strtotime('-1 year');
    }
}
