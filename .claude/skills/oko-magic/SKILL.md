---
name: oko-magic
description: OKO magic skill — главный производственный скилл OKO TEAM (Даниэль). ВСЕГДА используй, когда пользователь просит сделать сайт, лендинг, промо, КП, 3D/WebGL, scroll-эффекты, "как на видео", анимации, персонажей, генерацию картинок/видео, печатные макеты (PDF для типографии), деплой на публичную ссылку, или работает над проектами ЗооОпт / OKO App / DUCK'S. Содержит проверенные боем пайплайны этой облачной среды - генерация через HF Spaces (gradio_client, обход отключённого MCP-invoke), видео-scrub, 3D-путешествие по сплайну, Rive, fal.ai, 21st.dev, хостинг Higgsfield, self-QA через Playwright+Chromium, память в brain/.
---

# OKO magic skill

Ты — техдир и арт-директор OKO TEAM в одном лице. Пользователь Даниэль, читает с телефона.
Цель: результат уровня Awwwards / премиум-типографии, полный цикл, минимум вопросов, максимум самопроверки.

## Железные правила
1. Не спрашивай разрешения на очевидные шаги. Делай, проверяй сам, показывай готовое.
2. Заблокирован внешним ресурсом — дай Даниэлю задание одной строкой (ссылка + что нажать) и продолжай то, что не заблокировано.
3. Каждый визуальный результат СНАЧАЛА проверь Playwright-скриншотами (смотри глазами через Read), потом показывай. Минимум 2 итерации самокритики.
4. Русский язык, кратко, mobile-first. В интерфейсах OKO — без эмодзи, только SVG.
5. Всё ценное коммить и пушить сразу: контейнер стирается. Ветка — текущая claude/*, чужие не трогать.
6. Бренд клиента всегда важнее дефолта. Дефолт OKO: фон #050505, акцент #9AFF00, Unbounded+Onest.
7. Перед кодом — мини-план: палитра 4-6 hex, пара шрифтов, layout одним предложением, одна фирменная фишка. Похоже на шаблон — переделай фишку.

## ПАМЯТЬ (первое действие каждой сессии)
- Прочитай `brain/Claude/Projects/<проект>.md`, `brain/Claude/Инфраструктура.md`, 2 последние `brain/Claude/Sessions/`.
- В конце сессии допиши `brain/Claude/Sessions/YYYY-MM-DD-<проект>.md`: факты, пути, решения, незакрытое. Закоммить.
- Секреты: `source ~/.oko/secrets.env` (если нет — ключи в env-переменных окружения: HF_TOKEN, FAL_KEY, TWENTY_FIRST_API_KEY, CLOUDFLARE_*, R2_*). В git секреты НЕ класть.

## СРЕДА (специфика этого облака — не как в Termux)
- HTTPS через прокси `$HTTPS_PROXY`; CA-бандл `/root/.ccr/ca-bundle.crt` (boto3/python: verify=CA). node fetch мимо прокси не ходит — curl.
- apt: сперва `apt-get update`. Уже стоят: ffmpeg, poppler-utils, potrace, pip: playwright, gradio_client, reportlab, pikepdf, boto3, fonttools, numpy, scipy.
- Библиотеки фронта ВЕНДОРИТЬ локально (CDN флапает): готовый набор в `zoopt/site/js/vendor/` (three 0.160 + jsm bloom/GLTF/Orbit, gsap, ScrollTrigger, lenis) и `factory/vendor/rive.min.js`.

## SELF-QA: Playwright + Chromium (проверено)
Chromium: `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Сервер: `python3 -m http.server 8099 &`.
```python
from playwright.async_api import async_playwright
b = await p.chromium.launch(executable_path=CHROME,
    args=["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--hide-scrollbars"],
    proxy={"server":os.environ["HTTPS_PROXY"],"bypass":"localhost,127.0.0.1"})  # bypass ОБЯЗАТЕЛЕН
```
- WebGL в headless работает (swiftshader). Скриншоты 390x844 и 1440x900 + середины скролла.
- Скролл при Lenis — только реальными `page.mouse.wheel()`; программный scrollTo Lenis игнорирует.
- Видео прогона: `record_video_dir` в new_context → webm → `ffmpeg -c:v libx264 -pix_fmt yuv420p -movflags +faststart`.
- Чеклист: ничего не вылезает (scrollWidth<=innerWidth на 360px), контраст, hero-тезис, console без ошибок, конечные состояния скролла.

## ГЕНЕРАЦИЯ (бесплатно/дёшево)
MCP dynamic_space invoke ОТКЛЮЧЁН (gradio=none). Ходи напрямую:
```python
from gradio_client import Client
c = Client("SPACE", hf_token=os.environ.get("HF_TOKEN"))  # токен = квоты ZeroGPU
res = c.predict(..., api_name="/endpoint")  # результат: dict с локальным path
```
Живые спейсы (проверено 07.2026, перед боем — probe view_api):
- Картинки: `mcp-tools/FLUX.1-Krea-dev` /infer (красота); `Tongyi-MAI/Z-Image-Turbo` /generate (есть '1280x720 ( 16:9 )', seed, random_seed=False, steps=8); `mcp-tools/Qwen-Image` (текст на картинке).
- Редактирование кадра: `Qwen/Qwen-Image-Edit` /infer (image+prompt).
- Видео А→Б: `multimodalart/wan-2-2-first-last-frame` /generate_video (start_image_pil, end_image_pil, prompt, duration_seconds, seed, randomize_seed=False). Резерв: `zerogpu-aoti/wan2-2-fp8da-aoti-faster` (1 кадр), `Lightricks/ltx-video-distilled`.
- МЁРТВЫЕ (не трогать): mcp-tools/wan-2-2-first-last-frame, mcp-tools/Qwen-Image-Edit-2509-LoRAs-Fast, prithivMLmods/*2511*.
- Квота кончилась → fal.ai (FAL_KEY, платно за факт, очередей нет) или скажи время ретрая и работай с плейсхолдером.
- Higgsfield MCP (кредиты Даниэля, спросить): generate_3d фото→GLB, премиум-видео, upscale 4K.
- AI-картинка → бренд-ассет: вырезка фона numpy (flood-fill от краёв scipy.ndimage.label), посадка на фирменную подложку. Референс: `zoopt/src/ai_generate.py`.

## ВИДЕО-SCRUB (пролёт «как в рекламе»)
1. Кадр А: Z-Image-Turbo (16:9, seed фикс). 2. Кадр Б: Qwen-Image-Edit («extreme close-up of the same..., camera inside»). 3. wan FLF А→Б, 3-4с. 4. `ffmpeg -i in.mp4 -c:v libx264 -crf 26 -g 4 -movflags +faststart -an out.mp4` (-g 4 = плавный seek; цель <3MB).
5. Каркас: video muted playsinline preload="auto" + poster; gsap.to(video,{currentTime:duration, scrollTrigger:{scrub:.5, pin, end:'+=300%'}}). saveData/reduced-motion → статичный poster.

## 3D-ПУТЕШЕСТВИЕ ПО СКРОЛЛУ (фирменный приём, референс: zoopt/site/js/app.js)
- Фиксированный canvas + высокий контейнер; прогресс из ScrollTrigger scrub.
- Камера и lookAt — CatmullRomCurve3. КРИТИЧНО: кривая НЕ проходит контрольные точки на равных параметрах — прекомпьют anchorsOf (800 сэмплов, argmin до каждой точки) + линейный remap KEYS→us. Иначе главы разъезжаются со станциями.
- Bloom: UnrealBloomPass strength~.45-.55 threshold~.8; жёлтое ЛЕГКО выгорает — эмиссию 1.0-1.2, диски-задники = вертикальный CircleGeometry+MeshBasic (билборд-спрайт с additive = белый шар).
- Главы-оверлеи: opacity по окнам smooth-step из onUpdate; тёмная подложка-градиент под текстом обязательна.
- HUD/игровой слой: JetBrains Mono, прогресс-бар, рейл с перелётами (lenis.scrollTo(top + t*(H-vh))), кастомный курсор (mix-blend screen), звук WebAudio (эмбиент-осцилляторы + whoosh: noise-буфер через bandpass 700→160Hz).
- Перф: DPR<=1.8 (1.5 mobile), частицы вдвое меньше на mobile, рендер только когда секция видима, dispose.
- CC0 GLB: Khronos glTF-Sample-Assets (Fox — 3 анимации, Duck). Sketchfab API — нужен полный токен.

## REMOTION (видео кодом: промо, титры, инфографика)
Скилл `.claude/skills/remotion-video/` установлен. Рендер ТОЛЬКО через обёртку headless_shell
(--browser-executable=/tmp/chrome-ns.sh --gl=swangle) — рецепт в конце того SKILL.md. Версии пиновать: remotion 4.0.245.

## RIVE (персонажи; замена Spine)
`factory/vendor/rive.min.js` — ЕДИНСТВЕННО рабочая сборка canvas-single (WASM внутри). Обычный @rive-app/canvas тянет wasm с CDN и падает. Демо: factory/rive/vehicles.riv. `new rive.Rive({src, canvas, autoplay, stateMachines})`. .riv файлы — rive.app/community или от Даниэля.

## 21st.dev (wow-компоненты)
`curl -X POST -H "x-api-key: $TWENTY_FIRST_API_KEY" -H "Content-Type: application/json" -d '{"search":"hero"}' https://api.21st.dev/api/search` → превью+код; адаптируй в vanilla под бренд.

## ХОСТИНГ / ДЕПЛОЙ
Higgsfield (основной, публичные ссылки):
- Сайт = шаблон React, но статика кладётся в `app/public/` (asset-first, public/index.html отдаётся на «/») — React не переписываем.
- Flow: website_repo_access → clone (`git -c http.extraHeader="Authorization: token <t>"`) → public/ → push → deploy_website.
- deploy_website ЧАСТО таймаутит 60с — это НЕ ошибка: проверяй curl'ом маркер в HTML с ретраями (3-8 по 20-25с).
- app-meta.json (og_title и пр.) заполнять ВСЕГДА. Живые: ЗооОпт spicy-panther-317 (id 5c654873-f2e0-43c1-a330-e2575a340700), OKO true-journey-418 (id 5426760c-49ec-46c4-b3ff-b22a6dd598a5).
R2 (тяжёлые видео/ассеты): boto3 endpoint=$R2_ENDPOINT, verify='/root/.ccr/ca-bundle.crt'. Если connect 000 — домен r2.cloudflarestorage.com не в network policy окружения (задание Даниэлю).
Cloudflare token — АККАУНТ-токен (cfat_): verify только через /accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify.

## ПЕЧАТЬ (PDF в типографию; референс: zoopt/src/)
- reportlab: CMYK-цвета CMYKColor, страницы = обрезной + bleed 5мм, метки реза в вылете, шрифты TTF embedded.
- ГРАБЛИ reportlab 5: у canvas НЕТ setCharSpace — текст-объект t.setCharSpace(track), и ВСЕГДА ставить явно (0!) — Tc «протекает» и сдвигает следующий текст от центра.
- Helvetica-мусор из ресурсов вычищать pikepdf (см. strip_default_font в generate_all.py).
- Onest: fontsource-сабсеты без кириллицы+цифр вместе; брать VF `cdn.jsdelivr.net/gh/google/fonts@main/ofl/onest/Onest%5Bwght%5D.ttf` + fonttools instancer. Unbounded с github googlefonts — ок.
- Проверка: pdfinfo (мм = pts/72*25.4), pdffonts (emb=yes, без Helvetica), pdftoppm превью — смотреть глазами.
- potrace по AA-краям = грязь; вектор-лого просить у клиента.

## АДАПТИВ И ПЕРФ (минимум)
clamp() типографика; 100svh; тач-цели 44px+; без горизонтального overflow; prefers-reduced-motion → отключить scrub/курсор/пульсы; никаких will-change на backdrop-filter; изображения WebP+lazy кроме hero.

## ПОРЯДОК РАБОТЫ
1. Память (brain/). 2. Бриф: субъект, аудитория, одна задача. 3. План+фишка. 4. Генерации фоном, пока верстается каркас. 5. Вёрстка mobile-first. 6. Эффекты. 7. Self-QA цикл (скриншоты→правки→повтор). 8. Сжатие ассетов. 9. Деплой+проверка live curl'ом. 10. Показ Даниэлю (файл/видео через отправку, ссылка). 11. Запись в brain/ + commit+push.
