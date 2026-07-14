# Tappio (контракт №005/2026, ИМПЕРИЯ)
Ветка: `tappio.app`. Материалы: `tappio-app/` (пакет клиента 01-09 + README + PRODUCTION_PLAN.md).
Клиент: Александр Мурашко @a_trafico. 3 iOS-app: Spy (cyan #00D9FF), Brainova (purple #9B5DE5), Tape (gold #F4C430). Контент English/USA.
Задача: 500 роликов + 16 каруселей за 60 дней + контент-план HTML.
Микс (директива Даниэля 08.07): 50% viral / 30% value / 20% sell. По app: Spy 250 / Brain 175 / Tape 75 (v3.6).
Источник правды: TAPPIO_SISTEMA_CONTEXT_v3.6_FINAL.txt (не 09_INSTRUCTIONS - там противоречия, разбор в tappio-app/README.md).
Пайплайн (проверен 08.07 в облаке): edge-tts через $HTTPS_PROXY (голос+тайминги) → Pexels/Pixabay стоки + UI-симуляция Playwright + HF Spaces → overlays HTML→PNG → ffmpeg 6.1 (apt ставить: apt-get install -y ffmpeg; репо PHP ppa ругается - игнорить). Ключи из secrets.env.b64 сорсить В ТОМ ЖЕ shell-вызове. GEMINI_API_KEY в env НЕТ.
Статус: план утверждается, дальше батч 01 (10 роликов) + скелет контент-плана.

## Хостинг Системы (09.07.2026)
Система Роста на Higgsfield: https://tappio-sistema.higgsfield.app/sistema
website_id: 5a124749-fdad-486a-9d43-02eb585af9b1, slug: tappio-sistema
Файл лежит как app/public/sistema.html (фреймворк редиректит /sistema.html -> /sistema).
Обновление: website_repo_access -> заменить app/public/sistema.html -> push -> deploy_website.
CF-токен в env - user-scoped (cfut_), Pages недоступны. HF-токен read-only (Spaces создавать нельзя). Higgsfield - рабочий хост.

## v6 + автоматизация (09.07.2026)
Скилл reels-machine обновлён до v6 (3 закона разнообразия + ИИ-обложка). Вендорнут в tappio-app/factory (fx_engine, lottie_render, three_render, инфографика, реестры USED_FOOTAGE/USED_ANIM, BRAND_PROFILE).
ДИАГНОЗ 10 роликов батча 01: нарушены все 3 закона (5-6 клипов вместо 10-14, шаблон-оверлеи с подменой цифр, один переход везде, нет бренд-кадров, нет обложек). Пересобрать по v6.
BRAND_PROFILE Tappio заполнен (3 идентичности, голоса, кодовые слова, бренд-кадры, кинетик Brain).
Решения клиента 09.07:
- Higgsfield ОТМЕНЁН (платно, 2 кредита/фото). Карусели НЕ делаем. Обложки — бесплатная генерация + мой текст, первым кадром.
- Демки разнообразить (не штамп). Бренд-кадры: App Store скриншоты (тянутся), превью-видео (amp-api токен), мои демки, записи клиента.
- Постинг: выбран Zernio (per-account, безлимит посты) для TikTok+IG+YouTube. Ждём ключ от клиента + IG перевести в Business.
- График 1→15/день = 500 за 60 дней (Вариант А). Кросс-пост в 3 соцсети.
- Ежедневное обучение: аналитика соцсетей+тренды+конкуренты, дашборд на бесплатном хостинге (отдельная ссылка), память в git, усиливать залетевшее.
- Автозапуск: CCR Routine (cron будит сессию ежедневно).
Нужно от клиента: ключ Zernio, IG Business+FB page, (позже) записи экрана приложений, дата старта.

## YouTube Tappio ПОДКЛЮЧЁН (14.07.2026)
Канал TAPPIO (id UChJNuqMcytBhNfR5vsw49HQ, аккаунт tappio.app@gmail.com), свежий (0 видео).
OAuth через приложение oko-claude2 (client 532707229456-q607..., проект oko-youtube). Scope: youtube.upload + force-ssl.
Токены в secrets.env.b64: TAPPIO_YT_CLIENT_ID/SECRET/REFRESH_TOKEN/CHANNEL_ID. Личные данные из OKO_KEYS в git НЕ клал.
Постинг ПРОВЕРЕН: resumable upload spy_001.mp4 -> videoId jpu5aNkSWwo (private). Работает end-to-end.
Грабли OAuth: redirect_uri должен быть в "Authorized redirect URIs" (не в JavaScript origins!). Для клиента добавляли http://localhost. Client в статусе — проверить Testing/Prod (токен может протухать 7 дней если Testing -> перевести в Production).
Загрузка: POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status, потом PUT байты по Location.
Осталось: Instagram + TikTok подключить, построить страницу-коннектор (one-click для клиентов ОКО АПП).
