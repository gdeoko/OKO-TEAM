# TAPPIO PRODUCTION PLAN v1.0 (08.07.2026)

Сборка роликов прямо в этой облачной среде, по скиллу oko-magic. Внешние расходы: $0 (все узлы бесплатные, FAL_KEY как платный буст по необходимости).

## 1. Микс контента (директива Даниэля, 08.07.2026)
Заменяет матрицу Ф1-Ф6 из контекста v3.6 как верхний уровень:
• 50% VIRAL (250 роликов) - цель миллионные охваты: страх, шок-истории, «проверь сам», челленджи восприятия
• 30% VALUE (150 роликов) - польза/важное/шок-факты, которые сохраняют и шлют друзьям: чек-листы, гайды, разоблачения
• 20% SELL (100 роликов) - продающие: demo, before/after, оффер, кодовые слова

Распределение по приложениям (из контекста v3.6, согласовано клиентом):
• Spy 250 (125 viral / 75 value / 50 sell)
• Brain 175 (88 / 52 / 35)
• Tape 75 (37 / 23 / 15)

Правила из v3.6 сохраняем: кодовые слова SPY/PRIVACY, BRAIN/FOCUS, TAPE/MEASURE; CTA 50/50 (видео/описание); никакого бренда в хуке; тёплое окружение (продающий ролик всегда между вирусными); 500 роликов = 500 разных хуков, реестр хуков ведём.

## 2. Темы и хуки (основано на анализе 51 конкурента)

### SPY (паттерны: Pauline 20M серия Airbnb-ужаса, malwaretech 33M how-to)
VIRAL:
• «I found this in my Airbnb at 2am» - личная история ужаса, серийная (5-7 частей)
• «This looks like a smoke detector. It is not.» - предмет-обманка, серия по предметам (часы, USB-зарядка, розетка, рамка, лампочка)
• «Hotel staff will never tell you this» - инсайдер
• «Only 3 percent spot the camera in this room» - челлендж-скан комнаты
• «Your hotel mirror test takes five seconds» - палец к зеркалу, у всех руки чешутся повторить
VALUE (сохраняют):
• «7 places to check in every rental» - чек-лист за 30 сек
• «What a hidden camera lens looks like on your phone flashlight»
• «Renters rights: what hosts can and cannot record» - юр-факты по штатам
SELL:
• Demo 4 сенсоров за 60 сек, before/after «room feels off - room verified», отзыв-кейс

### BRAIN (паттерны: Huberman-протоколы, riddle-геймшоу theezzshow, тревога когнитивного спада)
VIRAL:
• Тесты на экране: «If you read this aloud without mistakes your focus is top 10 percent» - интерактив, миллионники ниши
• «Your brain started aging at 25. Here is what that means» - bold claim + science
• «Name 3 things you walked into a room for» - узнавание себя
• Оптические/когнитивные иллюзии с таймером - челлендж «сколько за 10 сек»
VALUE:
• «5 habits quietly killing your memory» (телефон утром, мультитаскинг...)
• «The 10 minute rule neuroscientists actually use»
• «Why you forget names in 5 seconds and how to stop»
SELL:
• Brain Score gameplay demo, 30-дневный before/after график, «10 minutes a day» оффер

### TAPE (паттерны: Kristy 25M before/after, DIY-фейлы, экономия денег)
VIRAL:
• «This couch cost me 900 dollars because of one wrong number» - фейл-история
• «Measure your whole room in 60 seconds. No tape.» - wow-demo
• «IKEA returns exist because of this mistake»
VALUE:
• «Standard sizes you should know before buying furniture» - шпаргалка
• «How pros measure a room with just a phone»
• «5 measuring mistakes that cost renovators thousands»
SELL:
• AR demo проекта с метками, экспорт PDF, «measure in the store before you pay»

## 3. Пайплайн сборки (проверено в этой среде 08.07.2026)

```
scripts/*.json (сценарий: хук, сцены, voice, overlays, cta)
  │
  ├─ ГОЛОС: edge-tts через прокси (en-US Neural) ✓ проверено
  │   Spy: en-US-AvaNeural (тёплая, personal)
  │   Brain: en-US-MichelleNeural (спокойная, science)
  │   Tape: en-US-ChristopherNeural (уверенный, DIY)
  │   + субтитры с таймингами из того же вызова ✓
  │
  ├─ ВИЗУАЛ (3 источника):
  │   1. Pexels/Pixabay вертикальные 4K стоки ✓ (5060 hotel room portrait) ~50%
  │   2. UI-симуляция: экраны приложений пересобраны в HTML по mockup'ам,
  │      анимируются JS, записываются Playwright record_video = "screen recording"
  │      без доступа к реальным приложениям ~30%
  │   3. HF Spaces генерация (Z-Image-Turbo кадры, Wan FLF видео А-Б,
  │      Qwen-Image-Edit правка кадров) ~20%; буст: FAL_KEY
  │
  ├─ OVERLAYS: HTML-рендер (Orbitron/Syne, цвет бренда app) → PNG через
  │   Playwright → наложение ffmpeg. Типографика уровня бренда, не drawtext.
  │
  ├─ СУБТИТРЫ: word-by-word ASS из таймингов edge-tts, Inter Bold, safe zone
  │
  ├─ ЗВУК: музыкальная подложка + SFX (Freesound CC0 ✓, Pixabay), voice -14 LUFS
  │
  └─ ffmpeg 6.1 ✓: concat сцен → 1080x1920 30fps H.264+AAC, <10 MB
       └─ QA: чек-лист v3.6 (хук 0-3с, длина, safe zones, табу-слова) +
          Playwright-просмотр кадров глазами перед сдачей
```

Батч = 10 роликов. Выход батча: MP4 x10 + captions/хэштеги + обновление контент-плана.

## 4. Контент-план HTML (этап 8)
Отдельный самодостаточный файл `tappio_content_plan.html`:
• Палитра tappio: фон #050507, cyan #00D9FF / purple #9B5DE5 / gold #F4C430, Orbitron/Syne/DM Mono
• L1 календарь 60 дней (Вариант А: разгон 1/день → 15/день) → L2 список дня → L3 карточка ролика (хук, voiceover, промпты, overlays, caption, CTA)
• Фильтры: приложение / категория (viral, value, sell) / кодовое слово / статус
• Данные из reels_500.json, статусы обновляются после каждого батча

## 5. Очерёдность
1. Батч 01 - 10 роликов ДЛЯ ПРОВЕРКИ КАЧЕСТВА: 5 viral + 3 value + 2 sell (4 Spy, 3 Brain, 3 Tape) - показать Даниэлю
2. Параллельно скелет контент-плана HTML с первыми 50 роликами
3. После аппрува тона/качества: генерация всех 500 сценариев в reels_500.json
4. Производство батчами по 10, публикация по Варианту А

## 6. Честно про миллионники
Гарантировать 1M+ на 50% роликов нельзя - решает алгоритм. Что максимизирует шанс: серийность историй (алгоритм тянет части), хук до 3 сек без бренда, повторяемые челленджи (зеркальный тест, тесты на экране), 500 уникальных хуков без шаблона, аналитика в цикле (провалившийся формат меняем на неделе). Реалистичная модель: 2-5 взлётов на сотню при системной подаче - на 500 роликов это 10-25 кандидатов в миллионники.

## 7. Блокеры (не мешают батчу 01)
• Доступы к TikTok/IG/YT аккаунтам - для публикации (сборка идёт без них)
• Apphud read-only - для второй половины оплаты и аналитики
• Реальные записи экрана приложений - повысят доверие sell-роликов (пока UI-симуляция)
