# CONTENT_PLAN_BLUEPRINT — Как построить HTML контент-план на 60 дней

## ЭТАЛОН

Открой файл **`07_REFERENCE_PANDAGO/panda_content_plan_EXAMPLE.html`** в браузере. Это готовый контент-план другого проекта (Cargo PandaGo — карго из Китая). Изучи:

- Структуру навигации (по дням, по типам, по приложениям)
- Дизайн карточек каждого ролика
- Как показаны хук/сценарий/визуал/CTA
- Систему тегов и фильтров
- Прогресс-бар и статистику вверху

**Твой контент-план для Tappio должен работать по такому же принципу**, но с адаптацией:

1. Цветовая схема — Tappio (cyan + purple + gold), не PandaGo зелёный
2. Три приложения-фильтра, не одно карго
3. 500 роликов, не 250
4. Другие форматы (Ф1-Ф6 по нашей матрице)
5. Другие хуки (утилитарные, не про доставку)

---

## СТРУКТУРА HTML-ФАЙЛА

### Основные разделы (табы):

```
┌─ HEADER ──────────────────────────────────────────────┐
│  🎬 TAPPIO CONTENT PLAN · 60 DAYS · 500 REELS         │
│  День 1 из 60 · Ролик 47 из 500 · TikTok 5.2M views  │
└───────────────────────────────────────────────────────┘

┌─ NAVIGATION TABS ─────────────────────────────────────┐
│  [Обзор] [По дням] [Spy] [Brain] [Tape] [Cross] [Меню]│
└───────────────────────────────────────────────────────┘

┌─ ОБЗОР (главная страница) ────────────────────────────┐
│  · Прогресс 60 дней                                   │
│  · Прогресс 500 роликов                               │
│  · Прогресс по приложениям (140/120/140/100)          │
│  · Статистика: views, ER, installs (когда появится)   │
│  · Топ-10 роликов недели                              │
│  · Красные флаги (провальные форматы)                 │
└───────────────────────────────────────────────────────┘

┌─ ПО ДНЯМ (главный рабочий вид) ───────────────────────┐
│  День 1 (пн 22 июля 2026)                             │
│  ┌────────┬────────┬────────┬────────┬────────┐       │
│  │Spy #001│Spy #002│Brain#01│Tape#001│Tappio#1│       │
│  │ Ф2     │ Ф3     │ Ф1     │ Ф3     │ Ф2     │       │
│  │[carta] │[carta] │[carta] │[carta] │[carta] │       │
│  └────────┴────────┴────────┴────────┴────────┘       │
│  День 2 (вт 23 июля)                                  │
│  ... и так далее до Дня 60                            │
└───────────────────────────────────────────────────────┘

┌─ КАРТОЧКА РОЛИКА (модалка при клике) ─────────────────┐
│  [Заголовок: Ролик #047 · Spy · Ф2]                   │
│  ┌───────────────────────────────────────┐            │
│  │ ХУК                                   │            │
│  │ 1 in 8 rentals has a hidden camera.   │            │
│  │ Here's how to check yours.            │            │
│  └───────────────────────────────────────┘            │
│  ┌───────────────────────────────────────┐            │
│  │ СЦЕНАРИЙ                              │            │
│  │ [0-3]  Hook                           │            │
│  │ [3-10] Setup                          │            │
│  │ [10-25] Payoff                        │            │
│  │ [25-30] CTA                           │            │
│  └───────────────────────────────────────┘            │
│  ┌───────────────────────────────────────┐            │
│  │ ВИЗУАЛ                                │            │
│  │ · Список сцен + промпты               │            │
│  └───────────────────────────────────────┘            │
│  ┌───────────────────────────────────────┐            │
│  │ OVERLAYS                              │            │
│  │ · Список текстовых накладок           │            │
│  └───────────────────────────────────────┘            │
│  ┌───────────────────────────────────────┐            │
│  │ CAPTION + ХЭШТЕГИ                     │            │
│  └───────────────────────────────────────┘            │
│  ┌───────────────────────────────────────┐            │
│  │ ГОЛОС                                 │            │
│  │ · voice_id, стиль, темп               │            │
│  └───────────────────────────────────────┘            │
│  ┌───────────────────────────────────────┐            │
│  │ АУДИО                                 │            │
│  │ · Music track, SFX list               │            │
│  └───────────────────────────────────────┘            │
│  [Кнопка: Скопировать JSON]                           │
│  [Кнопка: Отправить в сборку]                         │
└───────────────────────────────────────────────────────┘
```

---

## РАСПРЕДЕЛЕНИЕ РОЛИКОВ ПО ДНЯМ

### Дневная нагрузка:

- **Понедельник-пятница** (44 дня): по 9-10 роликов/день = ~440 роликов
- **Суббота-воскресенье** (16 дней): по 4 ролика/день = 64 ролика
- **Итого: 504 ролика** (с запасом 4)

### Внутри дня — по приложениям:

**Будний день (9 роликов):**
- 3 × Spy (TikTok primary)
- 2 × Brain
- 2 × Tape
- 2 × Cross-brand / Tappio

**Выходной (4 ролика):**
- 1 × Spy
- 1 × Brain
- 1 × Tape
- 1 × Cross-brand

### Внутри недели — карусели:

- **Среда:** 1 карусель (обычно Spy или Brain)
- **Суббота:** 1 карусель (обычно Brain или Tape)

Итого: 8 недель × 2 = 16 каруселей.

---

## ЦВЕТОВАЯ СХЕМА КОНТЕНТ-ПЛАНА

Возьми **точно ту же палитру, что в основной Системе Роста**:

```css
:root {
  --bg-dark: #050507;
  --bg-second: #0F0F14;
  --white: #FFFFFF;
  --w8: rgba(255,255,255,0.8);
  --w6: rgba(255,255,255,0.6);
  --w4: rgba(255,255,255,0.4);
  
  --cyan: #00D9FF;      /* Spy Camera Finder */
  --cyan-deep: #00A8CC;
  --purple: #9B5DE5;    /* Brainova */
  --purple-deep: #7C3AED;
  --gold: #F4C430;      /* 3D Tape Measure */
  --gold-deep: #D4A017;
  
  --border: rgba(255,255,255,0.08);
  --success: #10B981;
  --warning: #F59E0B;
  --danger: #EF4444;
}

/* Fonts */
--fh: 'Orbitron', sans-serif;      /* Headings */
--fb: 'Syne', sans-serif;          /* Body */
--fm: 'DM Mono', monospace;        /* Labels/numbers */
```

## КАЖДАЯ КАРТОЧКА РОЛИКА — ЦВЕТ БОРДЕРА ПО ПРИЛОЖЕНИЮ

```css
.card-spy    { border-left: 3px solid var(--cyan); }
.card-brain  { border-left: 3px solid var(--purple); }
.card-tape   { border-left: 3px solid var(--gold); }
.card-tappio { border-left: 3px solid transparent;
               border-image: linear-gradient(180deg, var(--cyan), var(--purple), var(--gold)) 1;
             }
```

---

## СТАТИСТИКА (верхняя панель)

Показывай в реальном времени:

```
┌───────────────────────────────────────────────────────┐
│  День 12 из 60           ⏱ Осталось 48 дней           │
│  Ролик 108 из 504         📈 21.4% выполнено          │
│  Опубликовано: 96         🎬 В сборке: 12             │
│                                                       │
│  Views total: 2,340,000   🚀 Топ-ролик: 890K (Spy)   │
│  Engagement avg: 8.2%     ⭐ Целевой ER: 6%+          │
└───────────────────────────────────────────────────────┘
```

Данные берутся из отдельного JSON (`stats.json`) — его обновляем вручную или через Zapier.

---

## ФИЛЬТРЫ И ПОИСК

Должны работать через нативный JavaScript:

- **По приложению:** Spy / Brain / Tape / Tappio / All
- **По формату:** Ф1 / Ф2 / Ф3 / Ф4 / Ф5 / Ф6 / All
- **По статусу:** Draft / Ready / Published / Analyzing
- **По неделе:** W1 / W2 / ... / W8
- **По ER:** > 10% / 5-10% / < 5%
- **Поиск по хуку:** input search field

---

## ПРИМЕР КАРТОЧКИ (готовая HTML-разметка)

```html
<div class="reel-card card-spy" data-format="F2" data-app="spy" data-status="ready">
  <div class="reel-card__head">
    <div class="reel-card__num">#047</div>
    <div class="reel-card__tags">
      <span class="tag tag-spy">SPY</span>
      <span class="tag tag-format">Ф2 Shocking Stat</span>
      <span class="tag tag-day">День 8</span>
    </div>
  </div>
  
  <div class="reel-card__hook">
    <div class="reel-card__label">HOOK · 0-3 сек</div>
    <div class="reel-card__hook-text">
      1 in 8 rentals has a hidden camera. Here's how to check yours.
    </div>
  </div>
  
  <div class="reel-card__meta">
    <span>⏱ 28 сек</span>
    <span>🎙 Female US warm</span>
    <span>🎵 chill_electronic_120bpm</span>
    <span>📱 TikTok · IG · YT</span>
  </div>
  
  <div class="reel-card__actions">
    <button onclick="openReel('047')">Открыть</button>
    <button onclick="copyJSON('047')">Копировать JSON</button>
    <button onclick="sendToCompose('047')">В сборку →</button>
  </div>
</div>
```

---

## АНИМАЦИИ И UX

**Правила** (из Системы Роста, раздел «Motion»):
- Duration: 200-400 ms для интеракций, 600-1000 ms для entrance
- Easing: `ease-out` для entrance, `ease-in` для exit
- Никаких linear
- Никаких дешёвых VHS effects

**Reveal on scroll:**
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('revealed');
    }
  });
}, { threshold: 0.15 });

document.querySelectorAll('.reel-card').forEach(card => {
  observer.observe(card);
});
```

```css
.reel-card {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 600ms ease-out, transform 600ms ease-out;
}
.reel-card.revealed {
  opacity: 1;
  transform: translateY(0);
}
```

---

## ТЕХНИЧЕСКИЕ ТРЕБОВАНИЯ К ФАЙЛУ

- **Один HTML-файл**, self-contained, никаких внешних зависимостей кроме шрифтов Google Fonts
- **Mobile-first**, работает на iPhone SE и Pixel 5
- **Overflow-x: hidden не ставить на body** (ломает position:sticky — известная проблема из истории проекта)
- **Никакого горизонтального скролла** нигде
- **Все данные роликов** — в одном большом `<script>const REELS = [...]</script>` в head
- **Рендер карточек** — динамически через JS из массива REELS
- **Размер файла** — под 5 МБ (500 карточек × 10 КБ данных = 5 МБ, приемлемо)

## ГЕНЕРАЦИЯ МАССИВА REELS

Отдельным скриптом Python — генерируешь 500 JSON-объектов роликов (по правилам из `CONTENT_RULES.md`), потом вставляешь в HTML:

```python
# generate_reels.py
import json
from datetime import datetime, timedelta

REELS = []
day = 1
current_date = datetime(2026, 7, 22)

# ... логика распределения 500 роликов по 60 дням, форматам, приложениям ...

# Вставляем в HTML:
html_content = open('content_plan_template.html').read()
html_content = html_content.replace(
    'const REELS = [];',
    f'const REELS = {json.dumps(REELS, ensure_ascii=False)};'
)
open('tappio_content_plan.html', 'w').write(html_content)
```

---

## ЧТО ВЫДАТЬ КЛИЕНТУ ПО ЗАВЕРШЕНИИ ЭТАПА 8

1. **`tappio_content_plan.html`** — интерактивный HTML-файл
2. **`reels_500.json`** — сырые данные всех 500 роликов
3. **`stats.json`** — начальный (пустой) файл статистики
4. **Скриншот главного экрана** — для клиентского Telegram
5. **Обновлённый контекст** `TAPPIO_SISTEMA_CONTEXT.txt` до v3.7 с записью о завершении этапа 8

---

## ЧТО НЕ ДЕЛАТЬ

- Не встраивай контент-план в основную Систему Роста — это **отдельный** файл
- Не пиши сценарии на русском (только на английском)
- Не смешивай цвета приложений (Spy строго cyan и т.д.)
- Не делай меньше 500 роликов (это KPI контракта)
- Не выкатывай план целиком без review — сначала первый батч из 30-50, показать клиенту, потом полный
