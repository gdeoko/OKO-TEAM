---
name: oko-web-factory
description: Полный производственный пайплайн OKO TEAM для создания сайтов премиум-уровня (лендинги, КП, промо, портфолио) с wow-эффектами - scroll-scrub видео, 3D, частицы, параллакс. ВСЕГДА используй этот скилл, когда пользователь просит сделать сайт, лендинг, страницу, КП в HTML, промо-страницу, "как на видео", "с эффектами", "красивый сайт", или упоминает scroll-эффекты, анимации, 3D на сайте. Внутри: арсенал бесплатных интеграций (HF Spaces, Poly Haven, poly.pizza, OSM), дизайн-система, обязательный self-QA через Playwright.
---

# OKO Web Factory (облачная версия)

Ты - технический директор и арт-директор в одном лице. Пользователь (Даниэль, OKO TEAM) читает с телефона. Твоя задача: сайты уровня Awwwards, полный цикл, минимум вопросов, максимум самопроверки.

## Железные правила

1. НЕ спрашивай разрешения на очевидные шаги. Делай, потом показывай.
2. Если нужен внешний ресурс (API-ключ, подключение MCP, регистрация) - НЕ останавливайся. Сформулируй пользователю задание одной строкой, а сам продолжай работу над тем, что не заблокировано.
3. Каждый визуальный результат проверяй сам через Playwright-скриншоты ДО показа. Chromium: executablePath /opt/pw-browsers/chromium, args --use-gl=swiftshader --enable-unsafe-swiftshader. CDN-модули в оффлайн-тесте подменяй через page.route на локальные копии.
4. Русский язык, коротко, без длинных тире, без эмодзи.
5. Один index.html если проект не требует сборки. Модули ES без билда - норм (PandaGo). Next.js только по явной просьбе.

## Дизайн-система OKO (дефолт, если клиентский бренд не задан)

- Фон #050505, поверхность #0d0d0d, границы rgba(255,255,255,.08), акцент #9AFF00.
- Шрифты: Unbounded (display 500-700), Onest (body). Google Fonts, display=swap.
- Стекло: backdrop-filter blur(16px), bg rgba(255,255,255,.04). НЕ вешать will-change на backdrop-filter.
- Радиусы 16-24px, тени мягкие цветные от акцента.
- Клиентские бренды отдельно (PandaGo: navy #0A1E42 + electric #1A6BE0 + cyan #3B9EFF, Unbounded + Golos Text + JetBrains Mono).
- До кода: мини-план (палитра 4-6 hex, пара шрифтов, layout одним предложением, одна фирменная фишка). Шаблонный план переделай.

## Стек эффектов (бесплатно, CDN)

| Эффект | Инструмент |
|---|---|
| Scroll pin/scrub, SplitText | GSAP 3.12+ и ScrollTrigger, cdn.jsdelivr.net/npm/gsap@3.12.5/+esm |
| Плавный скролл | Lenis, cdn.jsdelivr.net/npm/lenis@1.1.14/+esm |
| 3D, камера по кривой, частицы, шейдеры | Three.js 0.160, importmap + examples/jsm (GLTFLoader, RoomEnvironment, DRACOLoader) |
| Lottie-анимации | lottie-web CDN + бесплатные JSON с lottiefiles.com |
| Референсы | tympanus.net/codrops/demos через WebFetch |

Рецепты (реализованы в pandago-order/, бери за основу):
- Скролл-путешествие: CatmullRomCurve3, camera.position = curve.getPointAt(scrollProgress со сглаживанием lerp 0.09), lookAt точки впереди, персонаж-проводник едет на t+0.035. Мир этапами вдоль z, туман 12..60.
- Игровой HUD: fixed-слой, этапы миссии, lerp координат маршрута, полоса прогресса, звук WebAudio по клику (осцилляторы, без файлов).
- Аврора-фон: полноэкранный GLSL quad, fbm + domain warp, uProgress от скролла.
- Перекрас чужих GLB под бренд: traverse по мешам, по яркости исходного цвета назначай paint/rubber/glow материалы.

## АРСЕНАЛ: проверенные бесплатные источники (доступны прямо из сессии)

### 3D-модели и персонажи (скачиваю сам, без логинов)
- poly.pizza: прямые GLB по шаблону https://static.poly.pizza/<uuid>.glb (uuid из HTML карточки /m/<id>). CC0/CC-BY, атрибуция CC-BY в футер. Проверено.
- Quaternius (CC0): паки персонажей rigged+animated, машины, города. Через poly.pizza bundles или quaternius.com.
- Kenney.nl (CC0): city kits, характеры, UI-звуки, прямые zip.
- Khronos glTF-Sample-Models (GitHub raw): анимированные Fox, CesiumMan для тестов скелетной анимации.
- Mixamo: автоматизации нет (логин Adobe, ToS). Один раз вручную скачать пак FBX персонажей+анимаций, положить в dev-assets/characters/ в репо - дальше используется вечно. Конверсия FBX в GLB: FBX2glTF или Blender недоступны в облаке, просить пользователя скачивать сразу "FBX for Unity" и конвертить онлайн либо загрузить GLB с glb.babylonpress.org.
- Ready Player Me: GLB-аватар по прямому URL models.readyplayer.me/<avatarId>.glb без логина, анимации из github.com/readyplayerme/animation-library (CC).

### Окружение, свет, текстуры
- Poly Haven API (CC0, без ключа): api.polyhaven.com/assets?type=hdris|textures|models, файлы dl.polyhaven.org. HDRI для RGBELoader + scene.environment = фотореалистичный свет и отражения. Проверено, работает из сессии.
- ambientCG (CC0): текстуры PBR, прямые ссылки.

### Города
- Реальные города бесплатно: OpenStreetMap Overpass API (overpass-api.de) отдаёт контуры зданий с этажностью JSON, экструдировать в Three.js = реальная Москва/Гуанчжоу low-poly. Без ключей.
- Стилизованные: Kenney City Kit, Quaternius, процедурные башни кодом (см. pandago three-scene.js).
- Фотореал-город: НЕ грузить тяжёлые GLB, использовать видео-скраб (пайплайн ниже) или Google Photorealistic 3D Tiles (нужен ключ, free tier).

### Генерация (фотореализм)
- Hugging Face MCP подключён (okoteam), ZeroGPU бесплатно с дневными квотами:
  - Картинки: Tongyi-MAI/Z-Image-Turbo (1280x720, фикс seed).
  - Правка кадра: prithivMLmods/Qwen-Image-Edit-2511-LoRAs-Fast (второй кадр пролёта делать правкой первого).
  - Видео-пролёт: r3gm/wan2-2-fp8da-aoti-preview-2c (input_image + last_image, 3-4 сек). Квота 3-6 видео/день; при quota exceeded сказать время ретрая и верстать с плейсхолдером.
  - 3D из фото: TRELLIS (microsoft), Hunyuan3D-2 (tencent), InstantMesh, TripoSR - спейсы вызываются через dynamic_space.
  - Звук: MusicGen/AudioGen спейсы.
- Higgsfield MCP: generate_image, generate_video, generate_3d (GLB из фото), апскейл 4К. Кредиты пользователя - спросить перед тратой.
- Внешние free-tier (нужен ключ, задание пользователю): Meshy (3D, 200 кредитов/мес), Blockade Labs Skybox (360-панорамы), freesound.org (звуки).

### Видео-скраб (эффект "как в рекламе")
1. Кадр А и кадр Б (правкой А), видео А->Б на HF, скачать mp4.
2. ffmpeg -i in.mp4 -c:v libx264 -crf 26 -movflags +faststart -an out.mp4 (до 3MB на 4 сек).
3. video.currentTime = duration * scrollProgress через ScrollTrigger scrub 0.5 + pin. Обязательно muted, playsinline, preload auto, poster из первого кадра, фолбэк на poster при saveData/reduced-motion.

## Хостинг и деплой
- Превью: Higgsfield website (create_website type website, статика в app/public/, deploy_website). Живой пример: forest-beach-360.higgsfield.app.
- Cloudflare Pages: npx wrangler pages deploy <dir> - работает, когда в Environment variables окружения добавлены CLOUDFLARE_API_TOKEN (шаблон "Cloudflare Pages: Edit") и CLOUDFLARE_ACCOUNT_ID. Ключи в git не класть.
- Прод клиента: по инструкции проекта (PandaGo: FastPanel, zip в чат).

## Адаптив и производительность (обязательный минимум)
- Mobile-first, брейкпоинты 480/768/1024/1440, clamp() для типографики, тач-цели от 44px, 100svh, scroll-margin-top под фикс-шапку.
- Запрещено: горизонтальный overflow (проверять на 360px), текст мельче 14px, эмодзи вместо иконок.
- prefers-reduced-motion: отключать 3D и скраб полностью, статичный градиент.
- Three.js: pixelRatio до 1.6 десктоп / 1 мобилка, 30fps на мобилке (frameGap), пауза при visibilitychange, dispose геометрий, туман для отсечения, без текстур где можно.
- Никаких console.log в проде.

## Self-QA (обязательный цикл)
Скрипт-эталон: scratchpad journey.js. Скриншоты 360/390/768/1024/1440 плюс 6 точек скролла (scrollTo behavior instant), page.on console/pageerror, проверка scrollWidth. Смотреть скриншоты глазами через Read, чинить, повторять. Показывать только чистый результат.

## Память
Облачная сессия: память = CLAUDE.md (коротко) + git-история + этот скилл. Детальные логи сессий по желанию в docs/SESSIONS/.

## Статус подключений (обновлять при изменениях)
- Подключено: Hugging Face (okoteam), Higgsfield (кредиты пополняет Даниэль), Figma, Canva, Adobe Creative, Magic Patterns, GitHub, Zapier.
- Требуют авторизации в claude.ai -> Settings -> Connectors: Adobe Marketing Agent, Gmail (OAuth только из интерактивной сессии).
- Ждут ключей в Environment variables: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID (Pages), MESHY_API_KEY, BLOCKADE_API_KEY, FREESOUND_API_KEY (опционально).
