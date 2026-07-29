# PIPELINE — детерминированный runbook дневного ролика МЕТАНОЙА

Проверено на ролике 02 (все 3 соцсети). Следуй ПО ШАГАМ — не импровизируй механику,
импровизируй только КРЕАТИВ (тема/сценарий/тексты оверлеев). Все скрипты рядом в этой папке.
Рабочая папка: `WD=/tmp/.../scratchpad/reelNN` (создать), внутри `clips/ work/ seg/ ov/`.

## 0. Окружение (быстро, не тяжёлое)
```
source /home/user/OKO-TEAM/secrets.env
export HTTPS_PROXY="${HTTPS_PROXY}" SSL_CERT_FILE=/root/.ccr/ca-bundle.crt
higgsfield account status   # должно быть ultra; авторизация — из VPS-брокера (SessionStart-хук)
pip install --break-system-packages -q faster-whisper   # для синхрона субтитров
# playwright + chromium уже в облачном образе: /opt/pw-browsers/chromium-1194/chrome-linux/chrome
# node_modules с playwright: scratchpad/reel01v2/work (запускать .mjs оттуда)
```

## 1. Креатив (единственное, что меняется каждый день)
- Выбери рубрику/тему (чередуй, сверься с SCENARIOS.md/WINNERS.md — не повторять вчера).
- Разведка конкурентов+миллионников с РЕАЛЬНЫМИ цифрами и КРАСИВЫМ документом в бота:
  `python3 КОНТЕНТ-ЗАВОД/factory/pipeline/competitor_analysis.py NN` — ОБЯЗАТЕЛЬНО перед КАЖДЫМ роликом.
  Пишет ФАЙЛ-ОСНОВУ factory/briefs/brief_NN.md (только 1M+, ВСЕГДА разные ролики — дедуп, ссылки, просмотры/лайки/комменты/ER, почему залетел, воронка) + красивый PNG в бота.
  СОБИРАЙ ролик НА ОСНОВЕ этого брифа (приёмы/боли/хуки — не копируя). Дополни разбором в COMPETITORS.md.
- Напиши VO-текст (тёплый, хук-утверждение первым, 30-35с ≈ 800-900 симв, микс 50/30/20).
- Придумай 8+ оверлеев кодом под ЭТУ тему (НОВЫЕ механики, не набор прошлого — см. USED_ANIM).

## 2. Кадры (Pexels, свежие, без повторов)
Запросы из темы (portrait, size medium, per_page 4). Дедуп по USED_FOOTAGE.md. Скачать 12 в 4K
(`videos.pexels.com/...uhd...`) через `curl --cacert $SSL_CERT_FILE`. Проверить freezedetect —
без статики. (Эталон отбора/скачивания — как в build_segments.py вход.)

## 3. Голос + музыка + обложка — ТОЛЬКО БЕСПЛАТНО (Higgsfield НЕ использовать для голоса/обложек!)
Даниэль запретил тратить Higgsfield на голос и картинки. Голос — КЛОН Екатерины бесплатно
через HF (Higgs Audio v3), обложки — бесплатно Pollinations FLUX.
```
# ГОЛОС (клон Екатерины, бесплатно, HF ZeroGPU) — pipeline/tts_free.py
python3 КОНТЕНТ-ЗАВОД/factory/pipeline/tts_free.py "<VO текст>" work/vo.mp3 1.0   # speed 1.0 (или 1.4)
#   движок Higgs Audio v3 (patriotyk/higgs-audio-v3-tts), запасной OmniVoice; студийная обработка внутри.
#   референс голоса: factory/voice/ekat_ref.mp3 (+ ekat_ref_text.txt). Требует HF_TOKEN.
#   ВАЖНО: русский текст писать с Ё где нужно; проверить распознаванием (whisper) что слова не искажены.

# ОБЛОЖКА — ВСЕГДА красивая РИСОВАННАЯ (закон 0-АЛЬФА). НИКОГДА плоские CSS-карточки!
# 1) FLUX-иллюстрация фон (тёплая акварель/gouache storybook, мама/ребёнок по теме, no text):
python3 КОНТЕНТ-ЗАВОД/factory/pipeline/cover_free.py "soft watercolor gouache children book illustration, warm cream and honey light, tender storybook, orthodox christian family, <сцена по теме>, no text, no words" work/cover_base.png 1080 1920 <seed>
# 2) заголовок+лого одним скриптом (эталон): scratchpad/reel01v2/work/cover_ill.mjs
#    config JSON: {"wd":"<WD>","rubric":"<РУБРИКА>","title":"строка1<br>слово2 <b>акцент</b>","accent":"#C4703F"}
node cover_ill.mjs <WD>/covcfg.json   # → work/cover.jpg (ПОСТЕР-ПРЕВЬЮ, прикрепляется при публикации)
# ⚠️ ЗАКОН 0-АЛЬФА-2 (24.07): intro.mp4 НЕ используем! Обложка — НЕ часть ролика, а превью.
# Ролик стартует с 1 кадра сразу с ХУКА. cover.jpg кладём в очередь как <NN>.jpg рядом с <NN>.mp4;
# публикатор цепляет её: IG нативно, YT thumbnails.set (нужен верифиц. канал youtube.com/verify), TT — первый кадр.

# МУЗЫКА (бесплатно, РАЗНАЯ каждый раз по НАСТРОЕНИЮ темы) — pipeline/music_free.py
python3 КОНТЕНТ-ЗАВОД/factory/pipeline/music_free.py "<mood ВЫВЕДИ из темы/эмоции ЭТОГО ролика — не из списка>" work/music.m4a <dur> NN
#   Freesound CC0/CC-BY, дедуп по used_music.txt, нормализовано под фон, фолбэк — синтез-пад. НЕ Higgsfield.
#   Настроение выбирай ПОД тему/сценарий/анализ конкурентов (грустная тема → мягкое пиано; сильная → струнные и т.д.).
#   Если лицензия CC-BY (by/by-nc) — добавь короткий credit автора трека в описание ролика.
# Затем audio-mix: VO(delay 0.4) + music (ducking под голос, тихо ~0.2, fade). Музыка НЕ повторяется между роликами.
```

## 4. Монтаж база
```
python3 build_segments.py   # 12 сегментов, РАЗНЫЕ движения (push/pan/pull/drift) + вечерний грейд
                            # поднять тени тёмных клипов: curves shadow-lift + eq gamma~1.18
python3 xfade.py            # склейка РАЗНЫМИ переходами (fade/slide/wipe/circle/dissolve)
```

## 5. Инфографика/анимации/наложения кодом — ОБЯЗАТЕЛЬНО (без них ролик = БРАК!)
ДВИЖОК (переиспользуемый, механики по смыслу): `ov_build.mjs` (библиотека анимаций) + `ovgen.mjs` (рендер) +
`composite_ov.py` (свод с наложениями). На ролик — маленький конфиг ДАННЫМИ `ovcfgNN.json`:
```
# 1) конфиг ≥7 сцен ПО СМЫСЛУ сценария. Механики (дедуп USED_ANIM): strike/list/quote/transform/chips/statement/ctaword/counter
#    формат: [{"kind":"strike","start":0.3,"dur":4.6,"word":"...","sub":"..."}, {"kind":"list","start":5.3,...}, ...]
cp brand/metanoia/png/metanoia-logo-1024.png <WD>/work/logo_t.png       # лого для оверлеев (ГРАБЛЯ: без него падает)
OVWD=<WD> node pipeline/ov_build.mjs <WD>/ovcfgNN.json                  # → jobs.json + schedule.json
OVWD=<WD> NODE_PATH=/opt/node22/lib/node_modules PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
  node pipeline/ovgen.mjs <WD>/jobs.json                               # → WD/ov/o*.webm (в фоне, дождись DONE)
```
Инфографика/наложения строятся С НУЛЯ ПО СМЫСЛУ, ≥7 сцен, каждые ~3-5с смена, НОВЫЕ механики (дедуп USED_ANIM).
ГРАБЛЯ: при наложении webm в ffmpeg декодить ЯВНО `-c:v libvpx-vp9 -i o.webm`, иначе чёрный фон (composite_ov.py уже так делает).

## 6. Субтитры (синхрон по голосу!)
```
python3 align.py            # faster-whisper → work/words.json (word timestamps)
#   ГРАБЛЯ: transcribe(..., vad_filter=False) — с VAD склеенная озвучка режется до пары слов!
python3 subs_std.py         # ЕДИНЫЙ ФИРМЕННЫЙ СТИЛЬ (закон 0-АЛЬФА, НЕ менять): 2 слова, НИЗ-центр
                            # (Alignment 2, MarginV 430), Soyuz Grotesk 82, тёплое ЗОЛОТО-караоке
                            # (Primary &H0082C8E8), чёткая тёмная обводка (Outline 3), без box.
                            # НЕ таскать субтитры по верху/центру, НЕ менять цвет ради разнообразия.
```

## 7. Свод С НАЛОЖЕНИЯМИ (обязательно!)
```
python3 pipeline/composite_ov.py <WD> <TOTAL> <CTA> <OUT.mp4>
# montage.mp4 → наложить каждый ov/o*.webm в окне schedule.json (libvpx-vp9) → субтитры →
# CTA-эндкард (лого y1000 + okoteam.top y1215) → аудио (VO+фоновая музыка дакинг+fade). БЕЗ intro (0-АЛЬФА-2).
```
QA: снять 5-6 кадров, ГЛАЗАМИ проверить: видеоряд + ИНФОГРАФИКА/анимации видны, субтитры резкие/по голосу,
и слышна ФОНОВАЯ МУЗЫКА. Если наложений/музыки нет — БРАК, не публиковать. QA ДО пуша (без пересборок).

## 8. Публикация во ВСЕ 3 (см. PROJECT_CONFIG «Публикация — проверенные команды»)
```
URL=$(higgsfield upload create <reel.mp4> --json | jq -r .url)   # хостинг на CDN
# YouTube: Data API resumable upload + status.privacyStatus=public (или publishAt 16:00 UTC)
# на VPS: скачать URL → cfg/metanoia_reel1.mp4 ; подпись → cfg/metanoia_caption1.txt
# TikTok:  rm -f cfg/tt_post1.done && bash /opt/oko-poster/metanoia_post1.sh
# IG:      python3 /opt/oko-poster/ig_post_reel.py cfg/metanoia_reel1.mp4 cfg/metanoia_caption1.txt
```
Проверить факт публикации на каждой площадке.

## 9. Реестры + отчёт
Допиши USED_FOOTAGE (id), USED_ANIM (механики), SCENARIOS, COMPETITORS. commit+push
в ветку claude/metanoya-content-factory-9s9uju. Отчёт: тема + 3 ссылки.

---
Аналитика — ОТДЕЛЬНО и НАДЁЖНО на VPS (cron 10:00 МСК, `metanoia_analytics.py`), сборку не трогает.
Страховка постинга — триггер 19:40 МСК (досабирает, если плановый прогон упал).
