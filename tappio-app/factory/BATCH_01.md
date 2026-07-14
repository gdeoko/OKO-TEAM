# BATCH 01 - план (10 роликов)

Флоу: тренды -> сценарии -> скиллы/virality -> обложки -> сборка -> обложка 1 кадром -> описания. 15-45с, кадр 3-5с, эффект через 1-2 кадра, единый стиль, уникальный контент.

## Тренд-брифинг (web search, июль 2026)
- SPY: тренд живой (Airbnb/hotel камеры, Япония/Франция кейсы, "pin-sized camera above shower"). Конкурент Peak сканит только Wi-Fi -> наш козырь 4 метода. Хуки: личный ужас, предмет-обманка, зеркальный тест (шеринг-механика).
- BRAIN: СВЕЖИЙ мета-угол - fMRI-исследование (июль 2026): короткие видео физически мешают формированию памяти. "Brainmaxing" = вирусный тренд (уход за мозгом как looksmaxing). "Brain rot" - слово года. Ирония: ты скроллишь прямо сейчас -> вот антидот. Сильный шеринг.
- TAPE: "1 из 5 не может представить результат до ремонта", LiDAR мгновенно, before/after креаторы 10x вовлечение. Хуки: возвраты мебели, DIY-фейл, замер до покупки.

## Лайнап (Spy 4 / Brain 4 / Tape 2; viral 5 / value 2 / sell 3)
| # | id | app | категория | формат | хук | демо/фишка |
|---|----|-----|-----------|--------|-----|-----------|
| 1 | spy_001 | spy | viral | absurd | жучок КГБ "The Thing" -> камера $30 | готов, база |
| 2 | spy_002 | spy | viral | challenge | "The 5-second mirror test everyone should know" | интерактив-челлендж, зеркало+палец |
| 3 | spy_003 | spy | value | checklist | "7 spots hiding a camera in every rental" | инфографика-чеклист, сохраняют |
| 4 | spy_004 | spy | sell | demo | "One scan. Four sensors. Sixty seconds." | ДЕМО UI сканера (радар) |
| 5 | brain_001 | brain | viral | meta/absurd | "This video is deleting your memory right now" | fMRI 2026, кинетик-шрифт, антидот |
| 6 | brain_002 | brain | viral | test | "Name 3 reasons you walked into the room" | тест на экране, узнавание |
| 7 | brain_003 | brain | value | list | "5 habits quietly rotting your memory" | инфографика, brain rot |
| 8 | tape_001 | tape | viral | fail-story | "This couch cost me $900. One wrong number." | фейл + AR-демо спасение |
| 9 | tape_002 | tape | sell | demo | "Measure a whole room in 60 seconds. No tape." | ДЕМО UI AR-линии, before/after |
| 10 | brain_004 | brain | sell | before/after | "My Brain Score in 30 days" | ДЕМО счётчик + график роста |

## Типографика (4b - по ситуации)
- Spy: Orbitron техно (жёсткий, приватность/угроза)
- Brain: КИНЕТИК двойной шрифт (верх Orbitron/DM, низ крупный прописной Syne) - мягче, human, модно
- Tape: инженерный (Orbitron + DM Mono размеры/цифры)
Кинетик-двойной применяю где по сценарию заходит (в первую очередь Brain, точечно у других).

## Кодовые слова (v3.6): SPY/PRIVACY, BRAIN/FOCUS, TAPE/MEASURE. CTA 50/50 видео/описание.

## Постинг: Zapier (1b) - настрою связки. Запуск: вручную (2a). Отдаю все 10 (3b) с обложками+описаниями.

## Апгрейд движка под батч (монтаж на максимум)
- Анимированные overlays (PNG-секвенции Playwright, CSS-анимация) - плавно, без наложений (планировщик окон + QA-сетка)
- Демо UI приложений: Spy радар-скан, Brain Score счётчик, Tape AR-линии - анимирую, накладываю поверх стоков
- gl-transitions (шейдерные переходы) между сценами
- Инфографика (счётчики, бар, before/after) HTML+Playwright
- Реальные кадры App Store + сайт tappio.pro (запись Playwright) для sell
- Обложки: сейчас бесплатно (HF/Playwright дизайн), потом Nano Banana Pro 4K
- Реестр registry.json: антиповтор хуков/приёмов + статус публикации

## Обложки — бесплатный путь ПОДТВЕРЖДЁН (14.07)
Gemini image (nano-banana) через прокси = 429 (нужен биллинг, free-tier=0). Путь: HF Z-Image-Turbo (gradio_client, анонимно) - 9:16 фон бесплатно, ~2.8MB, /generate(prompt, "1152x2048 ( 9:16 )", seed, steps=8, shift=3, random_seed, []).
Обложка = AI-фон (HF) + брендовый текст (Playwright, Orbitron/cyan) + иконка. Пример: covers/spy_001_cover.png (готово, премиум-вид).
ГРАБЛЯ: Z-Image иногда дорисовывает мусорный текст (иероглифы) несмотря на "no text" - добавить negative prompt / затемняющий градиент сверху / кроп. Для FLUX.1-Krea-dev текста меньше.
