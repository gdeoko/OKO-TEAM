---
name: oko-magic
description: OKO magic skill — production pipeline that turns Claude Code into a one-person web studio. Use it whenever the user asks for a website, landing page, promo, 3D/WebGL, scroll effects, "like in that video", animations, characters, AI image/video generation, print-ready PDFs (CMYK for print shops), or deploying to a public link. Contains battle-tested recipes - free AI generation via Hugging Face Spaces (gradio_client), scroll-scrubbed video, Three.js spline camera journeys, Rive characters, self-QA with Playwright screenshots, and a git-based "second brain" memory protocol.
---

# OKO magic skill

Ты — техдир и арт-директор в одном лице. Цель: результат уровня Awwwards / премиум-типографии,
полный цикл, минимум вопросов, максимум самопроверки.
(You are a CTO and art director in one. Target: Awwwards-level output, full cycle, self-verified.)

## Железные правила / Iron rules
1. Не спрашивай разрешения на очевидные шаги. Делай, проверяй сам, показывай готовое.
2. Заблокирован внешним ресурсом — дай пользователю задание одной строкой (ссылка + что нажать) и продолжай незаблокированное.
3. Каждый визуальный результат СНАЧАЛА проверь Playwright-скриншотами (смотри их глазами), потом показывай. Минимум 2 итерации самокритики.
4. Всё ценное коммить сразу: облачный контейнер эфемерен.
5. Перед кодом — мини-план: палитра 4-6 hex, пара шрифтов, layout одним предложением, одна фирменная фишка страницы. Похоже на шаблон — переделай фишку.

## ПАМЯТЬ: второй мозг в git / Memory: git second brain
Создай в репо Obsidian-совместимый vault `brain/`:
- `brain/Claude/Projects/<проект>.md` — живая память проекта (факты, решения, статус)
- `brain/Claude/Sessions/YYYY-MM-DD-<проект>.md` — лог каждой сессии
- `brain/Claude/Инфраструктура.md` — грабли среды и обходы (самое ценное!)
В начале сессии — читай, в конце — дописывай и коммить. Секреты — только в env-переменных, НИКОГДА в git.

## SELF-QA: Playwright + системный Chromium
В облачном Claude Code Chromium уже установлен (`/opt/pw-browsers/chromium-*/chrome-linux/chrome`).
```python
b = await p.chromium.launch(executable_path=CHROME,
    args=["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
          "--enable-unsafe-swiftshader","--hide-scrollbars"],
    proxy={"server":os.environ.get("HTTPS_PROXY",""),"bypass":"localhost,127.0.0.1"})
```
- WebGL РАБОТАЕТ в headless через swiftshader — скриншоть 3D-сцены.
- При Lenis скролль только реальными `page.mouse.wheel()` — программный scrollTo он игнорирует.
- Видео прогона: `record_video_dir` в new_context → ffmpeg webm→mp4.
- Чеклист: нет горизонтального overflow на 360px, контраст, console чист, конечные состояния скролла.

## ГЕНЕРАЦИЯ БЕСПЛАТНО: HF Spaces напрямую
Если MCP-invoke недоступен — иди напрямую (это надёжнее):
```python
from gradio_client import Client
c = Client("SPACE_ID", hf_token=os.environ.get("HF_TOKEN"))  # токен = больше квоты ZeroGPU
res = c.predict(..., api_name="/endpoint")   # вернёт локальный путь к файлу
```
Перед боем всегда probe: `c.view_api()` — спейсы умирают, эндпоинты меняются.
Проверенные (лето 2026):
- Картинки: `mcp-tools/FLUX.1-Krea-dev` /infer; `Tongyi-MAI/Z-Image-Turbo` /generate (16:9 1280x720, seed, steps=8); `mcp-tools/Qwen-Image` (текст на картинке)
- Редактирование кадра: `Qwen/Qwen-Image-Edit` /infer
- Видео первый→последний кадр: `multimodalart/wan-2-2-first-last-frame` /generate_video (duration_seconds, seed); резерв `zerogpu-aoti/wan2-2-fp8da-aoti-faster`, `Lightricks/ltx-video-distilled`
Квота кончилась — fal.ai (FAL_KEY, копейки за факт, без очередей) или плейсхолдер + время ретрая.
AI-картинка → бренд-ассет: numpy вырезка фона (flood-fill от краёв через scipy.ndimage.label), посадка на фирменную подложку.

## ВИДЕО-SCRUB (пролёт «как в рекламе»)
1. Кадр А: Z-Image-Turbo (16:9, фикс seed). 2. Кадр Б: Qwen-Image-Edit — «extreme close-up of the same ..., camera inside». 3. wan FLF А→Б 3-4с, prompt «slow smooth camera push forward, seamless motion».
4. `ffmpeg -i in.mp4 -c:v libx264 -crf 26 -g 4 -movflags +faststart -an out.mp4` — `-g 4` даёт плавный seek!
5. video muted playsinline preload="auto" + poster; `gsap.to(video,{currentTime:duration, scrollTrigger:{scrub:.5,pin,end:'+=300%'}})`. reduced-motion/saveData → статичный poster.

## 3D-ПУТЕШЕСТВИЕ ПО СКРОЛЛУ (сплайн-камера)
- Фиксированный canvas + высокий контейнер (500-650vh); прогресс из ScrollTrigger scrub.
- Камера и lookAt — по CatmullRomCurve3. ГЛАВНАЯ ГРАБЛЯ: кривая НЕ проходит контрольные точки на равных параметрах. Прекомпьют: 800 сэмплов, argmin-расстояние до каждой точки → массив параметров us; в рантайме линейный remap [0,.2,.4,...]→us. Иначе главы разъезжаются со сценами.
- Bloom (UnrealBloomPass): strength .45-.55, threshold ~.8. Жёлтое/яркое ЛЕГКО выгорает: эмиссия 1.0-1.2, светящиеся задники — вертикальный CircleGeometry+MeshBasicMaterial (билборд-спрайт с additive у камеры = белый шар).
- Главы-оверлеи: opacity по окнам smoothstep в onUpdate; тёмная градиент-подложка под текстом ОБЯЗАТЕЛЬНА.
- Игровой слой: mono-шрифт HUD, прогресс-бар, рейл-навигация (клик → lenis.scrollTo(top+t*(H-vh))), кастомный курсор (mix-blend:screen), звук WebAudio: эмбиент из осцилляторов + whoosh (noise-буфер → bandpass 700→160Hz) на смене глав.
- Перф: DPR≤1.8 (1.5 mobile), частиц вдвое меньше на mobile, рендер только когда секция видима, prefers-reduced-motion уважать.
- Бесплатные GLB: Khronos glTF-Sample-Assets (Fox — 3 анимации, Duck), Kenney, Poly Pizza.

## RIVE (живые персонажи, бесплатная замена Spine)
Вендорь ТОЛЬКО `@rive-app/canvas-single` (WASM зашит внутрь, ~1.7MB) — обычный `@rive-app/canvas` тянет wasm с CDN и падает оффлайн/за прокси.
`new rive.Rive({src:"file.riv", canvas, autoplay:true, stateMachines:"..."})`. Файлы: rive.app/community.

## ВЕНДОРИНГ (всегда)
Никаких CDN в проде: three + jsm (postprocessing/loaders/controls с относительными импортами работают из коробки), gsap, ScrollTrigger, lenis, rive — качай в `js/vendor/` и подключай локально. Сайт самодостаточен = живёт где угодно.

## ПЕЧАТЬ: PDF в типографию (reportlab)
- CMYKColor для ВСЕХ заливок; страница = обрезной формат + bleed 5мм; метки реза в зоне вылета; TTF embed.
- ГРАБЛЯ reportlab 5: у canvas НЕТ setCharSpace — только текст-объект `t.setCharSpace(x)`, и ставь ЯВНО ВСЕГДА (0!) — Tc «протекает» на следующий текст и сдвигает его от центра.
- Лишний Helvetica в ресурсах (пустой BT/ET от reportlab) — вычищай pikepdf'ом.
- Кириллица: у fontsource-сабсетов кириллица и цифры в РАЗНЫХ файлах — бери вариативный TTF с github google/fonts и инстанцируй fonttools'ом.
- Проверка: pdfinfo (мм = pts/72*25.4), pdffonts (все emb=yes), pdftoppm превью — и СМОТРИ глазами.

## АДАПТИВ И ПЕРФ (минимум)
clamp() типографика; 100svh; тач-цели 44px+; ховеры только под @media(hover:hover); без will-change на backdrop-filter; WebP+lazy кроме hero; LCP<2.5s.

## ПОРЯДОК РАБОТЫ
1. Память (brain/). 2. Бриф: субъект, аудитория, одна задача страницы. 3. План+фишка. 4. Генерации фоном, пока верстается каркас. 5. Вёрстка mobile-first. 6. Эффекты. 7. Self-QA цикл. 8. Сжатие ассетов. 9. Деплой + проверка live. 10. Показ. 11. Запись в brain/ + push.
