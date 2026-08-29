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

# ОБЛОЖКА/картинки (бесплатно, Pollinations FLUX, без ключа/квоты) — pipeline/cover_free.py
python3 КОНТЕНТ-ЗАВОД/factory/pipeline/cover_free.py "<storybook prompt, no text>" work/cover_base.jpg 1080 1920 <seed>
#   затем композитить заголовок Playfair+Soyuz + ПРОЗРАЧНЫЙ лого brand/metanoia/png (без квадрата).

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

## 5. Инфографика кодом (Playwright → alpha webm)
- Опиши 8+ сцен в overlays_lib.mjs (jobs.json) + 2-3 новые под тему (jobs2). Рендер:
```
cd scratchpad/reel01v2/work && node ovgen.mjs <WD>/jobs.json    # → WD/ov/o*.webm (yuva420p vp9)
node outro_gen.mjs                                              # анимированный аутро (маяк/свет+лого)
```
ГРАБЛЯ: при наложении webm в ffmpeg декодить ЯВНО `-c:v libvpx-vp9 -i o.webm`, иначе чёрный фон.

## 6. Субтитры (синхрон по голосу!)
```
python3 align.py            # faster-whisper → work/words.json (word timestamps)
#   ГРАБЛЯ: transcribe(..., vad_filter=False) — с VAD склеенная озвучка режется до пары слов!
python3 subs_karaoke.py     # Союз Гротеск, 2 слова, караоке \kf, РЕЗКИЕ (без \blur), без обводки,
                            # MarginV~610, НЕ на обложке (<2.4с skip). fontsdir=fonts/
```

## 7. Свод
```
python3 composite.py        # intro(обложка)+montage_b+outro2 xfade → 9 оверлеев (libvpx-vp9!) →
                            # прогресс-бар drawbox → субтитры → аудио36 (VO+музыка дакинг+fade). 36с.
```
QA: снять 5-6 кадров, глазами проверить (видеоряд виден под инфографикой, субтитры резкие/по голосу).

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
