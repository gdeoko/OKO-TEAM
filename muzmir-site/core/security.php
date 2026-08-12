<?php
/**
 * Заголовки безопасности на уровне PHP — применяются ко ВСЕМ ответам
 * (и HTTP, и HTTPS), не зависят от того, каким nginx-блоком отдан запрос
 * (443-блок на проде управляется certbot отдельно). Вызывается в public/index.php
 * сразу после определения маршрута.
 *
 * Виджет (/widget, ?embed=1) намеренно разрешён к встраиванию на сторонних сайтах —
 * для него framing-защита ослаблена.
 */

function security_headers(string $route = '/'): void
{
    if (headers_sent()) return;

    // Встраиваемый виджет — можно фреймить где угодно; всё остальное — только со своего домена.
    $embeddable = ($route === '/widget') || (($_GET['embed'] ?? '') !== '');

    // Базовые безопасные заголовки (не ломают сторонние интеграции).
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(self), interest-cohort=()');
    header('Cross-Origin-Opener-Policy: same-origin-allow-popups');

    // HSTS — только по HTTPS (за certbot HTTPS='on'; учитываем и прокси-заголовок).
    $https = (($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || ((int) ($_SERVER['SERVER_PORT'] ?? 0) === 443);
    if ($https) {
        header('Strict-Transport-Security: max-age=15768000; includeSubDomains');
    }

    // Защита от кликджекинга — кроме встраиваемого виджета.
    if (!$embeddable) {
        header('X-Frame-Options: SAMEORIGIN');
    }

    /*
     * Content-Security-Policy — прагматичная политика: жёстко закрываем плагины,
     * base-uri и mixed-content (только https:), но оставляем 'unsafe-inline'
     * (в проекте много инлайновых стилей/скриптов) и широкий https: для сторонних
     * интеграций (Яндекс.Метрика/Карты, VK Video, RuTube, ЮKassa, Google Fonts),
     * чтобы ничего рабочего не сломать.
     */
    $csp = [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
        "style-src 'self' 'unsafe-inline' https:",
        "img-src 'self' data: blob: https:",
        "font-src 'self' data: https:",
        "connect-src 'self' https:",
        "frame-src 'self' https:",
        "media-src 'self' https:",
        "form-action 'self' https:",
    ];
    // frame-ancestors: свой домен для всего, кроме встраиваемого виджета.
    $csp[] = $embeddable ? "frame-ancestors *" : "frame-ancestors 'self'";

    header('Content-Security-Policy: ' . implode('; ', $csp));
}
