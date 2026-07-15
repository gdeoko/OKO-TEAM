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

## Hoopy (hooppy.ru) API подключён (14.07.2026)
Токен в secrets: HOOPPY_API_TOKEN, HOOPPY_API_BASE=https://api.hooppy.ru/api (JWT Passport, user 20086, exp 2027). hooppy.ru/openapi.yaml - спека.
Домен api.hooppy.ru через прокси работает (root /accounts 500 без пути, с путём ок).
Эндпоинты: GET /accounts (соцаккаунты), GET /accounts/pages (цели постинга, page_ids), GET /posts/projects (папки-проекты), GET /posts/schedules, POST /files/media/upload (видео/фото), POST /posts (создать/опубликовать), DELETE /posts/{id}.
POST /posts: publication_when_type 1=сейчас/2=в дату/3=расписание; publication_how_type 1=ручной выбор соцсетей(page_ids)/2=через проект(project_id). Видео сначала /files/media/upload -> id -> в пост с title/description.
source_id (по факту подключённых аккаунтов Даниэля): 1=VK, 3=Facebook, 9=Telegram-канал, 14=YouTube, +17/18/29 (Dzen/OK/Threads/TenChat?). IG/TikTok source_id определю когда подключит.
СЕЙЧАС в Hoopy: только личные OKO-аккаунты Даниэля (VK, FB, Telegram, YouTube и др.), проект "OKO" (id 19421). Tappio НЕ подключён.
НУЖНО: Даниэль подключает в кабинете Hoopy аккаунты Tappio - Instagram (tappio_app) + TikTok (по логину), лучше в отдельном проекте "Tappio". YouTube Tappio делаю напрямую (официально, уже готово).
Архитектура постинга финальная: YouTube - напрямую я (официально); IG/TikTok/Telegram/VK - через Hoopy API по логину (без Facebook, анти-бан на Hoopy). Один токен Hoopy = все РФ-совместимые соцсети + папки-проекты по клиентам = решение и для ОКО АПП.

## VPS браузер-агент + Hoopy кабинет РАБОТАЮТ (14.07.2026)
VPS okoagents.okoteam.top, control /exec (HTTPS, OKO_VPS_CTRL_URL/TOKEN в secrets). Хелпер: factory/vps/vps_exec.py.
Окружение VPS: Node 22, Python 3.14, ffmpeg 8, Docker 29, Playwright 1.49 + Chromium (pw-browsers/, headless, --no-sandbox). /opt/oko-poster (user okoposter).
Браузер-агент ЛОГИН В HOOPPY: hooppy.ru/auth/login, креды HOOPPY_LOGIN/PASSWORD. Скрипт factory/vps/hooppy_login.mjs -> сессия /opt/oko-poster/cfg/hooppy_session.json (переиспользуется, проверено hooppy_verify.mjs: /accounts "Мои аккаунты" держится). Полный доступ в кабинет = подключать аккаунты/проекты (чего нет в API).
ВНИМАНИЕ КООРДИНАЦИЯ: второй агент перезаписывает secrets.env.b64 целиком и затирает мои ключи. Восстановил TAPPIO_YT_* (из git b24ff11) и HOOPPY_API_TOKEN. НАДО: договориться, что Tappio-ключи не трогать / append-only, иначе будут пропадать.
Hoopy source_id: 1=VK,3=Facebook,9=Telegram-канал,11=Telegram-юзер,14=YouTube,17/18/29=прочее(Dzen/OK/TenChat). IG/TikTok source_id определю при подключении Tappio.
СЕЙЧАС в Hoopy - только OKO-аккаунты Даниэля, проект "OKO". Tappio IG/TikTok НЕ подключены.
Чтобы постить в Tappio IG/TikTok: нужны их логины/пароли -> браузер-агент подключит в Hoopy автоматически (или Даниэль в кабинете). YouTube Tappio - напрямую (готово).

## IG подключение - попытки автоматизации (14.07, ВАЖНЫЕ ВЫВОДЫ)
Браузер-агент на VPS РАБОТАЕТ: заходит в Hoopy, кликает Instagram (Hoopy IG-connect = официальный OAuth instagram.com, scope instagram_business_content_publish, client_id 784434260665293, redirect hooppy.ru/oauth/29 - БЕЗ Facebook). Прямой вход instagram.com/accounts/login: поля name="email"/"pass" (НЕ username/password - то в OAuth-версии). Кнопка submit.
Дошли до email-кода (auth_platform/codeentry). Код в почте okoteam.top@gmail.com виден через Gmail-коннектор (mcp__Gmail__search_threads from:security@mail.instagram.com). Код IG ПЕРЕИСПОЛЬЗУЕТ (628884 45 мин, новых не шлёт в рамках одного thread).
Поле кода на codeentry - защищённое ($$eval('input')=[] в OAuth-версии; в persistent-context прямого входа УДАЛОСЬ заполнить getByRole/pressSequentially, code_typed len=6). НО код 628884 истёк -> не пропустило. После ~10 логинов IG включил анти-бот кулдаун (вход не проходит, страница логина без ошибки). Аккаунт НЕ забанен.
ВЫВОД: авто-вход в IG из дата-центра (VPS US IP) хрупкий из-за анти-бота Meta. Для надёжности нужен резидентный/мобильный прокси на аккаунт (для ОКО АПП на масштабе - обязательно). 
РЕКОМЕНДАЦИЯ сейчас: (1) дать аккаунту остыть ~сутки; (2) Даниэль логинится в tappio_app С ТЕЛЕФОНА один раз (доверенное устройство/мобильный IP - снимает подозрение IG), ПОТОМ авто-сессия агента проходит; ИЛИ (3) Даниэль подключает tappio_app в кабинете Hoopy с телефона (2 мин) - дальше постинг через Hoopy API полностью на мне.
Скрипты: factory/vps/ig_direct_login.mjs (persistent context, email/pass, file-code injection). Сессия сохраняется в /opt/oko-poster/cfg/ig_profile.

## IG: ТЕСТ "дело не в прокси" — patchright стелс (14.07 вечер, ПРОРЫВ + уточнение)
Гипотеза Даниэля ("Dolphin{anty} - вдруг дело не в прокси") ПОДТВЕРЖДЕНА для гейта логина.
- Поставил patchright (стелс-форк Playwright, тот же принцип что Dolphin: спуф отпечатка) на VPS, БЕЗ прокси, тот же дата-центр US IP.
- Скрипт factory/vps/ig_patchright.mjs: launchPersistentContext channel:chromium, mobile UA Pixel7, viewport 412x915, locale en-US, tz Europe/Rome. Вход instagram.com/accounts/login поля name="username"/"password", клик кнопки "Log in".
- РЕЗУЛЬТАТ: КАЖДЫЙ раз доходим до "Check your email" / auth_platform/codeentry — т.е. IG принял пару логин/пароль и просто просит e-mail код. Письмо IG: "New login ... Device Chrome Mobile, Claymont DE US" — IG видит как обычный вход с нового устройства, НЕ хардблок.
- ЗНАЧИТ: бот-блок на ЛОГИНЕ пробивается отпечатком (patchright/Dolphin), IP/прокси на этом гейте НИ ПРИ ЧЁМ. Ранее "страница логина без ошибки" была из-за НЕ-стелс Playwright (AutomationControlled палился), а не из-за IP.
- ЕДИНСТВЕННЫЙ оставшийся блок: e-mail код. Поле — один input (fill len=6 ок), submit кнопкой "Continue". На codeentry есть таймер "We can send a new code in 00:XX" -> кнопка "Get a new code" (клик работает).
- НО: после ~15 попыток за 1.5ч IG ЗАТРОТТЛИЛ выдачу новых кодов — залип на старом 628884 (истёк), новых писем не шлёт даже по "Get a new code". Троттл временный (обычно часы/сутки), аккаунт НЕ забанен.
- ig_patchright.mjs сохраняет cookies в /opt/oko-poster/cfg/ig_state.json при успехе -> после ОДНОГО входа сессия переиспользуется, повторный логин не нужен.
ЧИСТЫЙ ПЛАН: дать аккаунту остыть (~сутки), затем ОДНА спокойная попытка -> поймать ОДИН свежий код из Gmail -> сохранить сессию. Прокси для базовой связки НЕ обязателен; нужен только на масштабе ОКО АПП (много аккаунтов с одного IP = подозрительно).

## IG: ВОШЛИ УСПЕШНО (15.07 08:33 UTC) — ГОТОВО
После ~12ч остывания: чистый профиль + ig_patchright.mjs (стелс, БЕЗ прокси, тот же VPS US IP) -> submit логин/пароль -> IG ПРОПУСТИЛ БЕЗ КОДА, сразу на ленту instagram.com/?deoia=1. RESULT=LOGGED_IN.
Верификация identity (ig_verify.mjs -> /accounts/edit/): username = tappio.app.pro. ПОДТВЕРЖДЕНО.
- Сессия: persistent profile /opt/oko-poster/cfg/ig_patchright_profile (30 cookies). Сохранена: cfg/ig_state.json + бэкапы cfg/ig_state.backup.json, cfg/ig_profile_backup.tgz (21MB).
- Способ входа: patchright launchPersistentContext (channel:chromium, mobile UA Pixel7, 412x915, tz Europe/Rome). Стелс-отпечаток пробивает бот-блок. Email-код был затроттлен, но при этой попытке IG вообще не запросил верификацию.
- Резерв на будущее (если IG снова спросит верификацию): "Try another way" даёт методы — Email(глушится) / Notification-on-another-device(Approve с телефона) / WhatsApp(код на +39...92). Скрипт умеет IG_WHATSAPP=1 (выбор WhatsApp) и IG_RESEND=1. Для WhatsApp код присылает Даниэль.
ИТОГ: агент владеет реальной IG-сессией tappio.app.pro на VPS. Повторный логин не нужен — работа по сохранённой сессии (постинг/аналитика/комменты). Прокси НЕ понадобился.
Скрипты: factory/vps/ig_patchright.mjs (вход+challenge+WhatsApp), factory/vps/ig_verify.mjs (проверка identity).

## IG: ЖИВОЙ ПОСТИНГ РАБОТАЕТ (15.07 08:55) — ПРОВЕРКА БЕЗ БЛОКА ПРОЙДЕНА
Опубликовали реальный пост через сохранённую сессию. Мобильная веб-IG НЕ даёт создание поста (нет "+"), поэтому постим через ДЕСКТОП-контекст: newContext(storageState:ig_state.json, desktop UA Win/Chrome) — cookies работают при любом UA, ре-челленджа НЕ было.
Флоу (ig_post_desktop.mjs): Create(лев.меню) -> "Post" подменю -> filechooser setFiles картинку -> Next -> Next -> caption (div[role=textbox]) -> Share -> "Your post has been shared". ПОДТВЕРЖДЕНО скрином + профиль стал "1 post".
Пост: https://www.instagram.com/tappio.app.pro/p/Dazr3-IDEx8/ (тестовый бренд-тизер TAPPIO "coming soon", 1080x1350, render_post.mjs — HTML+chromium, БЕЗ эмодзи).
Профиль tappio.app.pro: bio клиента "Spot cams/Sharpen brain/Measure all, tappio.pro", 1 post, 1 follower, 6 following.
ВЫВОД: агент имеет ПОЛНЫЙ доступ — вход + постинг напрямую, без API/Hoopy/прокси. Модель ОКО АПП подтверждена end-to-end.
Скрипты: ig_post_desktop.mjs (постинг), render_post.mjs (бренд-картинка), ig_check_profile.mjs (проверка профиля/URL постов), ig_explore_create.mjs.

## TikTok подключение (15.07 09:07) — КУЛДАУН, ждём
Аккаунт: email tappio.app@gmail.com / pass tappio.app_(@)8. Код придёт на tappio.app@gmail.com — Gmail-коннектор его НЕ читает (читает только okoteam.top). Решение по коду: Даниэль говорит код вручную (выбрал вариант 3); в продукте — поле "введи код" в UI или делегированный доступ к почте.
Скрипт tk_login.mjs (patchright стелс, desktop UA, БЕЗ прокси): форма входа tiktok.com/login/phone-or-email/email загрузилась БЕЗ капчи (отпечаток прошёл), логин/пароль встали в верные поля. НО на сабмит -> "Maximum number of attempts reached. Try again later." = лимит попыток (были прежние попытки до сессии). Капчи/кода не было — упёрлись в rate-limit раньше.
ВЫВОД: подход рабочий (как IG), нужен КУЛДАУН -> одна чистая попытка, Даниэль наготове с кодом из tappio.app@gmail.com. НЕ долбить (продлевает блок). Скрипт умеет ждать код из файла cfg/tk_code.txt (TK_LOGIN/TK_PASSWORD в env).

## TikTok: обход прокси — ТЕСТЫ (15.07) и РЕШЕНИЕ ЧЕРЕЗ HOOPPY
Прямой вход TikTok с сервера невозможен без резидент/мобильного IP:
- Дата-центр IP (Timeweb 104.171.132.45) -> "Maximum attempts" (rate-limit по IP, не по профилю/юзернейму).
- QR-вход -> "попробуйте другой способ" (отклонён).
- Cloudflare WARP (бесплатно, wgcf+wireproxy userspace SOCKS5 :25344, egress 104.28.x Cloudflare) -> лимит попыток УШЁЛ, но TikTok ответил "Internal server error" = Cloudflare IP тоже режет.
- Вывод: TikTok пускает ТОЛЬКО резидентный/мобильный IP (в отличие от IG — там хватило отпечатка). Бесплатный авто-обход с сервера исчерпан.
- Бесплатный рабочий вариант: телефон Даниэля как exit-node (Tailscale userspace на VPS готов: /opt/oko-poster/ts, socks5 :1055; нужен телефон+аккаунт Tailscale+exit node). Не автоматизируется на потоке клиентов (1 IP на много акков = бан).
Инфра VPS: okoposter БЕЗ sudo, но в группе docker; ghcr.io пуллит (docker hub 429). wgcf/wireproxy/tailscale бинарники в /opt/oko-poster/{warp,ts}.

## РЕШЕНИЕ TikTok: через Hooppy (официальный OAuth) — Даниэль авторизует с телефона
Hooppy dashboard (hooppy.ru, вход HOOPPY_LOGIN/PASSWORD, сессия cfg/hooppy_session.json). Страница подключения /accounts/connect.
TikTok connect = ОФИЦИАЛЬНЫЙ OAuth: https://www.tiktok.com/v2/auth/authorize/?redirect_uri=https://hooppy.ru/oauth/14&client_key=aweoatbsettfanq2&response_type=code&scope=user.info.basic,user.info.profile,video.upload,video.publish
- OAuth-ссылка ФИКСИРОВАННАЯ, БЕЗ state -> Hooppy привязывает к аккаунту по СЕССИИ (кукам hooppy), не по ссылке. Голую ссылку клиенту слать нельзя (не привяжется без Hooppy-сессии).
- С нашего сервера OAuth упирается в вход TikTok (IP-блок) -> довершает Даниэль с телефона: hooppy.ru -> Мои аккаунты -> Подключить -> TikTok -> Authorize (в его Hooppy-сессии, TikTok на телефоне залогинен).
- redirect /oauth/14. После подключения найти source_id TikTok через Hooppy API и постить.
Скрипты: hooppy_connect_tt.mjs (логин+探), hooppy_tt_oauth.mjs, hooppy_tt_link.mjs.

## АРХИТЕКТУРА ОКО АПП (решено с Даниэлем 15.07)
Каналы: IG напрямую (вход+постинг+активность, БЕЗ прокси — хватает отпечатка), YouTube напрямую (офиц. API), TikTok через Hooppy (OAuth).
Клиентский поток БЕЗ пароля: OAuth 1 тап (клиент авторизует в окне платформы в своей сессии) -> токен на бэкенд -> постим через API. Пароль+прокси нужны ТОЛЬКО для "полной активности" (лайки/подписки/алгоритм/ДМ) — премиум-слой.
API-потолок: OAuth даёт постинг+аналитику+ответы на комменты. Лайки/подписки/накрутка — только браузер+прокси на аккаунт.
Две архитектуры: (1) Hooppy как бэкенд — быстро, у Даниэля БЕЗЛИМИТ аккаунтов через владельца Hooppy (минус снят); (2) своё OAuth-приложение ОКО (свой client_id у TikTok/Meta/Google, свой state на клиента -> голую ссылку клиенту слать МОЖНО) — независимость, ~0 стоимость, но нужно ревью платформ + построить бэкенд. План: запуск на Hooppy (+спросить владельца про партнёрский/white-label API), своё OAuth — шаг 2.
Прокси на масштабе: 1 IP на 1 аккаунт (много акков с 1 IP = бан). IG дешевле (без прокси), TikTok требует прокси на аккаунт для полной активности; для OAuth-постинга прокси НЕ нужен (официальный API).
YouTube Tappio, Hoopy API, браузер-логин в Hoopy, обложки - всё РАБОТАЕТ. Приоритет вернуть на КОНТЕНТ (пересборка v6).
