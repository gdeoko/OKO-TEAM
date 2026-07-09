# Обложка через Nano Banana Pro (Higgsfield MCP) + реальный лого — рецепт

Правило: обложка генерируется ЦЕЛИКОМ нейросетью (фон + текст), в БРЕНД-ЦВЕТАХ логотипа
(оранж `#EA5920` + белый + чёрный, БЕЗ зелёного), затем поверх композитится РЕАЛЬНЫЙ
`logo_hd.png`. Модель `nano_banana_pro` (Google) — держит текст и 9:16. Нужна Ultra-подписка
Higgsfield с безлимитом на картинки.

## Шаги
1. `balance` → `subscription_plan_type: ultra`.
2. Сгенерировать 1–2 варианта детальным промптом (шаблон ниже):
```
generate_image(params={ model:'nano_banana_pro', aspect_ratio:'9:16', count:1, prompt:"…" })
```
   (Опционально можно передать лого как референс стиля через medias role:'image', но
   финальный крисп-лого всё равно ставим композитингом — так надёжнее.)
3. Забрать результат: `show_generations(type:'image', size:3)` → взять `results.rawUrl`,
   скачать: `curl -s --cacert /root/.ccr/ca-bundle.crt -o cover_ai.jpg '<rawUrl>'`.
4. **Композит реального лого** поверх (PIL): вписать `logo_hd.png` — либо аккуратный бейдж
   в углу/снизу, либо крупный по центру низа, с лёгкой тенью/свечением, вписанным в
   композицию. Сохранить `cover.jpg`.
5. Проверить глазами: текст читаемый и без ошибок, гамма оранж/бел/чёрн, лого целый.
   Не ок → перегенерить/переставить лого.
6. `cover.jpg` — первым кадром ролика (0.30 с).

## Детальный промпт-шаблон (делать промпты БОГАТЫМИ — от этого крутость обложки)
Заполнять под тему; описывать сцену, свет, объектив, глубину, фактуру, эмоцию, цвета:
```
Vertical 9:16 premium cinematic Instagram Reel cover for a high-end video production
studio brand. <ГЛАВНАЯ СЦЕНА ПО ТЕМЕ: e.g. a filmmaker's hand holding a smartphone that
shows a glowing video-editing timeline, dramatic studio behind>. Mood: <эмоция: bold,
confident, scroll-stopping>. Lighting: dramatic low-key studio lighting, strong orange
(#EA5920) rim light and warm practical highlights, deep near-black background (#0d0d0d),
subtle atmospheric haze / volumetric light. Lens: 35mm cinematic, shallow depth of field,
crisp foreground, softly blurred background, filmic grain, high dynamic range. Composition:
leave clean negative space at the TOP for a big headline. Typography baked in: large bold
CONDENSED SANS-SERIF Russian headline at the top, pure white, tight tracking:
«<ЗАГОЛОВОК-ХУК>». Directly below, a shorter accent line in vivid ORANGE (#EA5920):
«<ПОДЗАГОЛОВОК>». Colors strictly orange + white + black, NO green. Ultra sharp, 4k,
editorial, award-winning ad poster. Text must be crisp, correctly spelled Russian,
perfectly legible, no gibberish letters.
```
Правила крутого промпта: 1 главный субъект + внятная эмоция; конкретный свет и объектив;
негативное пространство под заголовок; строго бренд-цвета; требование «correctly spelled
Russian, no gibberish». Генерить 2 варианта, брать лучший.

## Композит лого (PIL, пример)
```python
from PIL import Image
cov=Image.open('cover_ai.jpg').convert('RGBA')          # 9:16
logo=Image.open('logo_hd.png').convert('RGBA')
W,H=cov.size; lw=int(W*0.32); lh=int(lw*logo.height/logo.width)
logo=logo.resize((lw,lh))
cov.alpha_composite(logo,((W-lw)//2, H-lh-90))          # низ по центру (или угол)
cov.convert('RGB').save('cover.jpg',quality=92)
```

## Карусели (контент-план, ~1/нед, 4:5)
Тот же `nano_banana_pro`, `aspect_ratio:'4:5'`, оранж-бренд-гамма, реальный лого композитом.
Крючок на слайде 1, польза/шаги 2–4, оффер+CTA на последнем.

## Грабли
- Коннектор Higgsfield флапает: если `job_display`/`show_generations` не отдал — подождать,
  забрать по id позже (`show_generations`).
- Ответ иногда помечает модель `nano_banana_2` — это ок.
- Только обложка и карусели. Кредиты на контент роликов НЕ тратим.
