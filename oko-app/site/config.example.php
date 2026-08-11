<?php
// Пример конфига. Реальный config.php лежит ТОЛЬКО на VPS (секреты в git не хранятся).
// Полный live-config всегда доступен агенту через control-эндпоинт
// (CONTROL_URL/CONTROL_TOKEN + cat /var/www/okoteam/config.php).
return [
    // Ядро
    'tg_bot_token' => 'PUT_ON_VPS',                       // @okoappbot
    'daniel_tg'    => '1966985736',
    'team_chat_id' => '-1002971919136',
    'admin_password' => 'PUT_ON_VPS',                     // /admin
    'agent_token'    => 'PUT_ON_VPS',                     // агент↔сайт (X-Agent-Token)
    'queue_token'    => 'PUT_ON_VPS',                     // ТОЛЬКО очередь задач мини-аппов
    //   (oko_task_pull/oko_task_result). Наименьшие права: ни диалогов, ни денег,
    //   ни админки — можно раздать всем сессиям-сливщикам Claude Code. Сгенерировать:
    //   openssl rand -hex 24  → вписать сюда (или в config-pay.php оверлеем).
    'control_url'    => 'https://okoagents.okoteam.top',
    'control_token'  => 'PUT_ON_VPS',
    'gmail'      => 'daniel.okoteam@gmail.com',
    'gmail_pass' => 'PUT_ON_VPS',                         // app-password (16 симв.)
    'gmail_name' => 'OKO TEAM · Даниэль Ильясов',
    'daniel_fio' => 'Ильясов Даниэль Альбертович',
    'daniel_inn' => '682016634349',
    // ЮKassa. Реальные значения — ТОЛЬКО на VPS в отдельном файле
    // config-pay.php (оверлей в cfg()), чтобы добавлять их одной командой:
    //   cat > /var/www/okoteam/config-pay.php <<'EOF'
    //   <?php
    //   return ['yk_shop_id'=>'<shop_id>','yk_secret'=>'<live_secret>'];
    //   EOF
    'yk_shop_id' => 'PUT_ON_VPS',                         // идентификатор магазина
    'yk_secret'  => 'PUT_ON_VPS',                         // секретный ключ live_
    // Оплаты Lava.top (готовые продукты)
    'lava' => ['sistema'=>'PUT_ON_VPS','zavod'=>'PUT_ON_VPS','consult'=>'PUT_ON_VPS'],
    'lava_api_key'      => 'PUT_ON_VPS',                  // динамические счета
    'lava_webhook_user' => 'PUT_ON_VPS',                  // Basic auth для /api.php?action=lava_webhook (пример: 'oko')
    'lava_webhook_pass' => 'PUT_ON_VPS',                  // (пример: 'oko2026' — как настроил Даниэль)
    'partner_percent'   => 15,                            // % партнёру с оплаты (L8)
    // Помощник OKO (L5): Anthropic Claude через Cloudflare-прокси
    'anthropic_key'   => 'PUT_ON_VPS',                    // sk-ant-api03-...
    'anthropic_base'  => 'https://anthropic-proxy.okoteam.workers.dev',
    'anthropic_model' => 'claude-haiku-4-5-20250929',
    // Проверка видео (L6): Gemini через Cloudflare-прокси, ротация ключей
    'gemini_keys' => ['PUT_ON_VPS'],
    'gemini_base'  => 'https://gemini-proxy.okoteam.workers.dev',
    'gemini_model' => 'gemini-flash-latest',
    // Web Push (VAPID) — уведомления браузер-native. Реальные ключи только на VPS.
    // Сгенерировать: npx web-push generate-vapid-keys --json
    'vapid_public'  => 'PUT_ON_VPS',
    'vapid_private' => 'PUT_ON_VPS',
    'vapid_subject' => 'mailto:okoteam.top@gmail.com',
    'site_url' => 'https://okoteam.top',
    // Аналитика фронта: три сервиса, единый вызов window.okoTrack(event, props).
    // Реальные ID/ключи только на VPS. Build.py вписывает плейсхолдеры в index.html,
    // а сервер должен подменить YOUR_YMK_ID / YOUR_AMPLITUDE_API_KEY / YOUR_SENTRY_DSN
    // на реальные значения при отдаче (или заинжектить <script> с window.OKO_ANALYTICS
    // перед основным аналитическим блоком).
    'ymk_id'         => 'PUT_ON_VPS',   // Yandex Metrika counter ID (число)
    'amplitude_key'  => 'PUT_ON_VPS',   // Amplitude API key
    'sentry_dsn'     => 'PUT_ON_VPS',   // Sentry DSN (https://...@sentry.io/...)
];
