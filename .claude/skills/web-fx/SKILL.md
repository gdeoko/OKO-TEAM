---
name: web-fx
description: Арсенал БЕСПЛАТНЫХ инструментов для крутых сайтов OKO TEAM — 3D (Three.js/GLB/WebGL), анимации (GSAP/Lottie/Anime.js), эффекты, частицы, конвертация медиа (webp/gif/png/mp4), источники бесплатных ассетов. Используй при сборке любого сайта или лендинга, когда нужны анимации, 3D-сцены, спецэффекты, оптимизация картинок или готовые визуальные приёмы.
---

# WEB-FX — бесплатный арсенал эффектов для сайтов

Всё в этом списке — бесплатное и открытое. Референс рабочего применения
прямо в этом репозитории: сайт DUCK'S (src/three/*) — Three.js + GSAP +
Lenis, частицы, GLB-модели, синтез звука.

## 1. 3D / WebGL

| Библиотека | Для чего | Подключение |
|---|---|---|
| **Three.js** | Полноценный 3D: GLB-модели, частицы, шейдеры | npm `three` или CDN |
| **@react-three/fiber + drei** | Тот же Three, но для React-проектов | npm |
| **Vanta.js** | Готовые живые WebGL-фоны (волны, сети, туман) — 1 строка | CDN |
| **Spline** (spline.design) | 3D-сцены в визуальном редакторе → embed на сайт | free tier |

Приёмы из DUCK'S, которые можно переиспользовать: облако частиц,
перетекающее между GLB-формами; DRACO-сжатие моделей (public/draco);
камера по скроллу.

## 2. Анимации и скролл

| Библиотека | Для чего |
|---|---|
| **GSAP + ScrollTrigger** | Главный инструмент: таймлайны, скролл-анимации. Теперь ПОЛНОСТЬЮ бесплатен, включая все плагины (SplitText, MorphSVG и др.) |
| **Lenis** | Плавный скролл (используется в DUCK'S) |
| **Anime.js v4** | Лёгкие анимации без зависимостей |
| **Motion (Framer Motion)** | Анимации в React-проектах |
| **Lottie (lottie-web)** | Анимации из After Effects в JSON; тысячи бесплатных на lottiefiles.com |
| **tsParticles** | Частицы, конфетти, снег, звёзды |
| **Rive** | Интерактивные анимации (реагируют на курсор/состояния), free tier |

## 3. Готовые блоки и UI (для «сайт за вечер»)

- **shadcn/ui** — компоненты (см. скилл ui-styling)
- **Magic UI / Aceternity UI** — готовые АНИМИРОВАННЫЕ блоки для
  лендингов (герои, карточки, марки, bento-сетки) — копируешь код
- **uiverse.io** — тысячи бесплатных CSS-кнопок/лоадеров/карточек
- Скилл **ui-ux-pro-max** — стили, палитры, шрифтовые пары
- **reactbits.dev** — анимированные React-компоненты

## 4. Генерация медиа (бесплатно)

- **Картинки**: `.claude/skills/gemini-media/scripts/gen-image-free.sh`
  (Pollinations/Flux, без ключа). Gemini nano banana — когда включат биллинг.
- **3D из картинки (GLB)**: Higgsfield `generate_3d` (MCP, кредиты) или
  бесплатные модели: **poly.pizza**, **Kenney.nl**, Sketchfab (фильтр CC).
- **Видео**: бесплатных API уровня продакшена нет. Варианты: Higgsfield
  (MCP, кредиты), CSS/JS-анимация вместо видео (часто выглядит лучше и
  весит меньше), Lottie.
- **Звук/музыка**: синтез Web Audio API (пример в DUCK'S
  src/audio/sound-system.js), бесплатные сэмплы freesound.org.

## 5. Конвертация и оптимизация (локально, в песочнице)

ffmpeg НЕ предустановлен — ставить при необходимости: `apt install -y ffmpeg`
(окружение позволяет, root). Также доступны npm-инструменты.

```bash
# webp из png/jpg (лучшее сжатие для сайтов)
npx sharp-cli -i in.png -o out.webp

# gif из видео (или наоборот) — после apt install ffmpeg
ffmpeg -i in.mp4 -vf "fps=15,scale=480:-1" out.gif
ffmpeg -i in.mp4 -c:v libwebp -q:v 70 -loop 0 out.webp   # анимированный webp (легче gif)

# оптимизация svg
npx svgo icon.svg

# сжать png
npx @squoosh/cli --oxipng auto in.png
```

Правило: на сайт — webp/avif вместо png/jpg, анимированный webp вместо
gif, Lottie/CSS вместо видео, где возможно. GLB — через DRACO.

## 6. Рецепт «крутой сайт быстро» (проверенная связка)

1. Скилл **ui-ux-pro-max** → стиль, палитра, шрифты под нишу клиента.
2. Каркас: чистый HTML/CSS/JS или React (по проекту).
3. Блоки: Magic UI / Aceternity / свои по референсам.
4. Анимации: GSAP + ScrollTrigger (+ Lenis для плавного скролла).
5. Wow-элемент: ОДИН на сайт — 3D-сцена Three.js, частицы или
   Vanta-фон. Не перегружать.
6. Ассеты: gen-image-free.sh + poly.pizza + lottiefiles.
7. Оптимизация: webp, lazy-loading, preload шрифтов.
8. Тест: скилл webapp-testing (Playwright есть в песочнице).
