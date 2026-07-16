# IMPLEMENTATION — рабочий боевой движок (v4), проверено на Tappio

Этот файл — мост между абстрактным SKILL.md и РЕАЛЬНЫМ кодом, который уже собирает
эталонные ролики. Код живёт в репозитории OKO-TEAM: `tappio-app/factory/`. Копии ключевых
скриптов — в `pipeline/` этого скилла. Ниже — что работает, как запускать, и проверенные
боем рецепты (2026-07-16).

## Быстрый запуск одного ролика (v4)
```bash
cd tappio-app/factory
bash make_reel4.sh <script_id>       # scripts/<script_id>.json -> output/<script_id>.mp4
```
Конвейер: `gen_vo → fetch_stock3 → fetch_music → make_shapes → render_ov3 → build4`.

## Файлы движка (в tappio-app/factory/, копии в pipeline/)
| Файл | Роль |
|---|---|
| `gen_vo.py` | edge-tts озвучка + тайминги слов (SentenceBoundary → распределение по словам) |
| `fetch_stock3.py` | Pexels: МНОГО уникальных вертикальных клипов, дедуп по video_id, кэш |
| `fetch_music.py` | уникальная музыка на ролик: Jamendo (полные треки) → Freesound (беды), выбор по mood+seed |
| `make_shapes.py` | генератор 8 форм-масок (feather ЧБ) + акцентных колец (свечение) под цвет бренда |
| `render_ov3.py` | АНИМИРОВАННЫЕ наложения-инфографика → прозрачный ProRes4444 mov (альфа) |
| `build4.py` | сборка: shots+xfade, формы-вставки, ИИ-обложка, инфографики, SFX-по-смыслу, караоке |
| `make_reel4.sh` | оркестратор одного ролика |

## Модель сценария (scripts/<id>.json) — SHOT-LIST
```jsonc
{
  "id":"spy_v4", "app":"spy",
  "voice":"en-US-AndrewNeural", "rate":"+6%", "grade":"teal_orange",
  "brand":{"accent":"#00D9FF","accent2":"#7CFCFF","code":"PRIVACY","logo":"spy.png","name":"SPY CAMERA FINDER"},
  "music":{"queries":["dark tension cinematic","suspense pulse electronic"]},   // mood → уникальный трек
  "cover":{"ai":"assets/ai_covers/spy_cover_1080.png","kicker":"...","top":"...","big":"IS WATCHING\nYOU"},
  "segments":[ {"id":"b1","text":"..."}, ... ],          // 5-7 битов озвучки → голос + караоке
  "shots":[                                              // 12-18 визуальных кадров (~2с каждый)
    {"q":["hidden spy camera macro lens"],"motion":"zin"},        // фулл-скрин с движением
    {"q":["smoke alarm ceiling white"],"insert":"hexagon","pos":"center"},  // форма-вставка
    {"visual":"DEMO:spy_scan"}                                    // app-демо
  ],
  "overlays":[                                           // 12-24 наложения, at=доля 0..1 контента
    {"at":0.09,"dur":1.7,"type":"stat_count","to":12,"prefix":"$","label":"COST","pos":"center"},
    {"at":0.23,"dur":2.0,"type":"bars","title":"WHERE THEY HIDE","items":[["Smoke detector",41],...]},
    {"at":0.40,"dur":1.7,"type":"ring","pct":83,"label":"RENTALS NEVER SCANNED"}
  ],
  "cta":{"text":"...","code":"PRIVACY"}
}
```

### Типы наложений (render_ov3.py, все анимированы)
`kicker` (чип), `stat_count` (счётчик count-up), `bars` (растущий бар-чарт со значениями),
`ring` (кольцо прогресса + %), `chips` (стаггер-появление пилюль), `lowerthird` (титр с wipe),
`kinetic` (крупная типографика scale-pop, авто-подбор кегля), `callout` (аннотация-кольцо),
`ticker` (метрика со стрелкой). Каждое — своя анимация под цифру/смысл (Закон 1).

### Формы-вставки (build4.render_insert + make_shapes)
`insert`: `circle, hexagon, phone, tv, tilt, diamond, rrect, arch`. Клип кладётся в форму
(alphamerge с feather-маской) + акцентное кольцо со свечением ПОВЕРХ затемнённого+размытого
фона (контраст затемнением, НЕ плашкой — Закон MOTION ARSENAL). Лёгкий дрейф `sin(t)`.
МИКС обязателен: часть кадров фулл-скрин с пан/зумом, часть — в формах. Не всё в формах.

## Проверенные боем рецепты (2026-07-16)

### ИИ-обложка — Nano Banana Pro (Higgsfield Ultra)
```
mcp__Higgsfield__balance                       # проверить subscription=ultra
mcp__Higgsfield__generate_image(model="nano_banana_pro",
  params={model:"nano_banana_pro", aspect_ratio:"9:16", count:1, prompt:"<богатый промпт,
    бренд-цвета, крупный АНГЛ/РУС заголовок в кавычках, NEGATIVE: watermark, gibberish>"})
# ВАЖНО: model дублировать И в params (иначе validation error). Модель отдаётся как nano_banana_2 — это ок.
mcp__Higgsfield__job_display(id)               # забрать rawUrl (cloudfront), curl --cacert /root/.ccr/ca-bundle.crt
ffmpeg scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920  # нормализовать
```
Прописать путь в `cover.ai`. Обложка идёт кадром 0 (thumbnail) + плавно уходит в бед.
HTML-обложка (render_ov3 cover_ov.png) — только аварийный фолбэк.

### Анимированные наложения → webm/mov с альфой
Playwright покадрово: `page.set_content` → `add_script_tag` (JS в IIFE, иначе `const` в глобале
конфликтует между наложениями) → цикл кадров `window.frame(p)` p:0..1 → screenshot
`omit_background=True` → `ffmpeg prores_ks -profile 4444 -pix_fmt yuva444p10le` (надёжная альфа;
vp9 `yuva420p` в этой сборке терял альфу → чёрный прямоугольник). Композит: overlay читает
альфу mov напрямую, сдвиг во времени `setpts=PTS+at/TB` + `enable='between(t,a,b)'`.

### Уникальная музыка на ролик
Jamendo API (публичный client_id-фолбэк `2c9a11b9`, свой в env лучше) `fuzzytags=<mood>` +
`audiodownload`. Freesound (`FREESOUND_API_KEY`) как беды. Выбор трека = `seed(id) % len`,
чтобы между роликами не повторялось. Проверено: Jamendo даёт полные royalty-free треки.

### Переходы
`xfade` 24 типа, ротация по seed: `offset_k = k*(D-XD)`, где D=длина кадра, XD=0.45.
Итоговая длина беда = `N*D-(N-1)*XD` = длине контента. (gl-transitions 125 — апгрейд на будущее.)

### Разнообразные SFX по смыслу (fetch_sfx.py + build4)
`fetch_sfx.py` качает библиотеку с Freesound: 9 категорий × 3 = 27 РАЗНЫХ звуков
(pop/tick/sweep/riser/impact/ding/swish/data/whoosh), ГЛОБАЛЬНЫЙ дедуп по id (иначе разные
запросы возвращают один топ-звук), loudnorm выравнивает громкость. Freesound: `sort` ломает
запрос — НЕ использовать; фильтр `duration:[0.2 TO 3.5]` энкодить. Маппинг в build4:
`SFX_MAP` тип наложения → категория (stat_count→pop, ring→sweep, bars→data, kinetic→impact,
callout→ding, lowerthird→swish, linechart→riser, donut/gauge→sweep, chips/kicker→tick).
Переходы ротуют `whoosh/swish/sweep` по индексу — НЕ один звук. Звук играет НАТУРАЛЬНО
(никакого `atrim=0:0.5` — это давало «обрубки»). Вариант в категории выбирается по индексу
наложения → соседние отличаются.

### Музыка — плавно, БЕЗ обрыва (важно)
`fetch_music.py`: 3 ретрая по источникам (транзиентный таймаут Jamendo не должен ронять в
общий трек). build4: `afade in 1.8с / out 2.8с`. КРИТИЧНО: `sidechaincompress` обрезает
музыку по длине голоса → сайдчейн-голос паддить на полную длину
(`[voice1]apad,atrim=0:total`), а финал закрыть `,apad,atrim=0:total`, иначе аудио короче
видео на ~2с и музыка обрывается в эндкарде. Проверять: `ffprobe` audio dur ≈ video dur;
хвостовые окна volumedetect должны монотонно падать (фейд, а не обрыв). volumedetect печатает
на уровне info — НЕ гасить `-v error`.

### Код-инфографика (render_ov3) — её должно быть БОЛЬШЕ
Все типы рисуются кодом и анимированы: `stat_count, bars, ring, ticker, chips, lowerthird,
kinetic, callout, kicker` + новые `linechart` (линия пробивает пунктирный «потолок» —
самый заходящий приём), `donut` (сегменты + легенда + % ), `gauge` (полукруг + стрелка).
Баланс сценария смещать в сторону инфографики (donut/linechart/gauge/ring/bars/stat), а не
голого текста (kinetic/kicker).

### Длина и темп
20-45с (проверено: spy 39с, brain 43с, tape 45с). Кадр ~2.3с. Наложение почти непрерывно.
Если ролик >45с — подрезать текст `segments`.

## Что ещё НЕ внедрено (backlog апгрейдов из MOTION_ARSENAL)
- 3D-GLB фигуры (three.js локально, крутятся всю сцену) — движок не написан.
- gl-transitions (125) вместо 24 xfade.
- Lottie / WebGL-шейдеры / Spine-Rive как источники наложений.
- 2.5D-параллакс (Depth-Anything).
- Реестры USED_FOOTAGE/USED_ANIM автозапись (сейчас дедуп только внутри ролика).
- Разные состояния app-демо в одном ролике (сейчас два одинаковых DEMO).
- Gemini-аудит готового ролика (gemwatch) + virality_predictor.

## ПУБЛИКАЦИЯ в 3 соцсети (рабочие рецепты, проверено 2026-07-16 на spy_real)

### 0. Доставка ролика на VPS (для IG). /exec НЕ годится для больших файлов
Тело `$OKO_VPS_CTRL_URL/exec` имеет мелкий лимит (~10КБ) — чанкинг base64 непрактичен, R2
блокируется SSL из этой среды, HF S3 требует repo-формат. РАБОЧИЙ путь — Higgsfield CDN:
```
mcp__Higgsfield__media_upload(filename="reel.mp4", content_type="video/mp4")  # -> upload_url + CDN url + media_id
curl -X PUT -H "Content-Type: video/mp4" --data-binary @reel.mp4 "<upload_url>"  # с --cacert агент-CA
mcp__Higgsfield__media_confirm(media_id, type="video")
# VPS скачивает: vexec "curl -s -o /opt/oko-poster/cfg/reel.mp4 '<cdn_url d2ol7oe51mr4n9...>'"
```
Мелкие файлы (скрипты .mjs ≤6КБ) — можно `echo <base64> | base64 -d > file` через один /exec.

### 1. TikTok — Hooppy API (из контейнера, CURL_CA=агент-CA)
```
CURL_CA=/root/.ccr/ca-bundle.crt python3 vps/hooppy_post_api.py <page_id> <video.mp4> "<caption>"
# page_id Tappio=2350868, source_id=14. Возвращает post id. (Проверять, что Hooppy реально выложил.)
```

### 2. YouTube Shorts — Data API (из контейнера)
```
CURL_CA=/root/.ccr/ca-bundle.crt python3 vps/yt_upload.py \
  <CLIENT_ID_env> <CLIENT_SECRET_env> <REFRESH_env> <video.mp4> "<title #shorts>" "<desc>" "tag1,tag2"
# Tappio: TAPPIO_YT_CLIENT_ID/SECRET/REFRESH_TOKEN. Refresh->access token->resumable upload. Отдаёт shorts URL.
```

### 3. Instagram Reels — stealth storageState (на VPS)
КЛЮЧЕВОЕ: постить через **storageState живой сессии** (`ig_state.json` = tappio.app.pro),
а НЕ персистентный профиль `ig_profile` (он показывал /popular/, файл не прикреплялся).
Скрипт `vps/ig_reel_state.mjs` (универсальный, env: IG_STATE/IG_VIDEO/CAPB64/IG_TAG):
```
# на VPS, видео уже в /opt/oko-poster/cfg/<video>.mp4:
cd /opt/oko-poster && CAPB64=<base64 caption> IG_TAG=igt IG_VIDEO=/opt/oko-poster/cfg/reel.mp4 \
  timeout 300 node ig_reel_state.mjs
```
Поток: goto instagram → проверить WHO == нужный аккаунт → New post → Post → filechooser(setFiles) →
OK-reel → crop icon → **Original (9:16, иначе IG режет в 1:1)** → Next×2 → caption → Share →
ждать «reel has been shared» (16МБ обрабатывается ~40с). Сессии клиентов: Tappio `ig_state.json`,
DIESEL `ig_diesel_state.json`/`ig_diesel_profile`, EKAT `ig_ekat_*`. Если WHO=login/challenge —
сессия протухла, нужна переавторизация (ig_login_multi + код). Скрины: `/opt/oko-poster/cfg/igt_*.png`.

## Ежедневная АКТИВНОСТЬ в IG/YouTube (обязательно, каждый день перед созданием роликов)
Правило Даниэля (постоянное): каждый день во время фазы анализа конкурентов, ПЕРЕД сборкой
ролика, проявлять живую активность аккаунта бренда в Instagram и YouTube — «без фанатизма»
(лимиты, чтобы не словить бан):
- Зайти в аккаунт бренда (stealth-сессия на VPS: ig_login_multi / сохранённый профиль; YouTube — залогиненная сессия или Data API для поиска).
- Поиск по нише и бренду (2-4 запроса: ключевые слова ниши + название бренда).
- Подписаться на 2-3 релевантных аккаунта в нише (разные каждый день, дедуп в реестре follows).
- Лайкнуть 5-10 роликов конкурентов/ниши.
- Осмысленно прокомментировать 2-3 ролика (по теме, не спам, живой человеческий тон).
Дневные лимиты (без фанатизма): подписки ≤3, лайки ≤10, комменты ≤3 на платформу.
Реестр `reference/ENGAGEMENT_LOG.md` (дата, платформа, кого лайкнул/подписался/прокомментил) —
чтобы не повторяться и держать лимиты. Активность = часть ежедневного competitor_scan, один
проход и там, и там. Технически: VPS stealth-браузер (patchright) с сохранёнными сессиями
брендовых аккаунтов; действия по одному с человеческими задержками.

## Ключи (из OKO_MASTER_VAULT / secrets.env)
PEXELS_API_KEY, FREESOUND_API_KEY, JAMENDO_CLIENT_ID(опц.), HF_TOKEN, Higgsfield (MCP Ultra),
Hooppy (постинг TikTok, page_id по клиенту), YT refresh-токены по клиенту. Пароли — только в
VAULT, не в код.
