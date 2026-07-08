# Tappio Reel Factory (движок сборки роликов)

Порт скилла reels-machine под бренд Tappio, адаптирован под English VO и облачную среду OKO. Внешние расходы: $0.

## Пайплайн (проверен: output/spy_001.mp4)
1. `scripts/<id>.json` - сценарий ролика (хук, сегменты, overlays, cta, бренд, грейд, голос)
2. `gen_vo.py <script> <workdir>/vo` - English нейроголос edge-tts через прокси + тайминги слов (из SentenceBoundary, распределение по длине)
3. `fetch_stock.py` - вертикальные 4K стоки Pexels по сценам (несколько запросов-кандидатов на сцену)
4. `render_overlays.py` / `render_cards.py` - брендовые overlays, обложка, endcard (Playwright, Orbitron/Syne/DM Mono, цвет приложения)
5. Freesound - музыка (drone/tension) + SFX (whoosh, impact, click), ротация на каждый ролик
6. `build.py <script> <workdir> <out.mp4>` - сборка: движение сцен (zoom/pan чередуются) + глитч-склейки + грейд + overlays с фейдами + endcard + караоке-ASS (активное слово цветом бренда) + аудиомикс с дакингом музыки под голос + loudnorm -14 LUFS (Instagram)

## Голоса по приложениям
- Spy: en-US-AndrewNeural (драм-нарратив) / en-US-AvaNeural (личные истории)
- Brain: en-US-MichelleNeural (спокойный science)
- Tape: en-US-ChristopherNeural (уверенный DIY)

## Грейды: teal_orange (Spy/драма), clean_ad (демо/B2B). Реестр приёмов - reference/USED_EFFECTS.md.

## Что дальше в движок (по мере батчей)
- gl-transitions (шейдерные переходы, 125 шт) - npm-модули, для «дорогих» склеек
- UI-симуляция экранов приложений (Playwright record_video) для demo-роликов
- HF-генерация уникальных кадров (карвед-орёл, устройство-жучок) где стока не хватает
- Запись реальных страниц App Store и tappio.pro для sell-роликов
