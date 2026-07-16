# OKO — библиотека ассетов и источников (веб/3D/motion)

Собрано под стиль OKO: **тёмное (near-black) + лайм/неон #9AFF00**, премиум, интерактив,
глянец, scroll-3D. Отмечено, что **скачано** (лежит в `oko-app/landing/inspo/`) и что —
**только ссылка** (платное/через UI, перезаливать нельзя).

> Дата сбора: 2026-07-16. Собирал сам (headless-браузер + web-поиск). Лицензии проверять
> перед коммерческим использованием — где CC0/MIT указано, можно свободно.

---

## 1. HDRI (отражения/освещение для 3D-глаза и объектов) — CC0
- **Poly Haven — HDRIs** — https://polyhaven.com/hdris — CC0, без логина. Лучший источник карт окружения. ✅
- **Poly Haven — Studio HDRIs** (тёмные студийные, под глянец) — https://polyhaven.com/hdris/studio — CC0.
- **OpenHDRI** — https://openhdri.org/ — CC0, до 29K.
- Скачано (CC0): `inspo/hdri/studio_small_08_1k.hdr`, `inspo/hdri/studio_small_09_1k.hdr` — нейтральные студийные карты для реалистичных отражений на «глазе»/стекле. **[downloaded]**

## 2. 3D-модели (объекты/герой) — CC0/CC-BY
- **Sketchfab — фильтр Downloadable + CC0/CC-BY** — https://sketchfab.com/3d-models?features=downloadable&licenses=322a749bcfa841b29dff1e8a1bb74b0b — GLB/GLTF, много бесплатных. Проверять лицензию у каждой модели.
- **Poly Haven — Models** — https://polyhaven.com/models — CC0 (в основном реалистичные пропсы).
- **Quaternius** — https://quaternius.com/ — CC0 стилизованные паки.
- (Наш GLB-глаз уже есть: `oko-app/landing/assets/oko-eye.glb`.)

## 3. Spline — 3D-сцены/объекты для веба (embed через `<spline-viewer>`)
- **Spline Community** — https://community.spline.design/ — ремикс готовых сцен. Тег free: https://community.spline.design/tag/free
- **Spline 3D Library** (free, в т.ч. commercial) — https://docs.spline.design/doc/3d-library/docGDIEbuh0A
- **Spline Examples** — https://spline.design/examples
- Наш фон уже отсюда: `prod.spline.design/Slk6b8kz3LRlKiyk` (SENTINEL-стиль, тёмные блоки + зелёное свечение). **[в проекте]**
- Как использовать: `<script src=".../spline-viewer.js">` + `<spline-viewer url="...scene.splinecode">`. Лицензия — проверять у автора сцены в Community.

## 4. Lottie-анимации (неон/тех/частицы/лоадеры) — free (через UI)
> Прямой фетч у LottieFiles/IconScout закрыт (403) — качать по кнопке на странице. Многие free
> требуют атрибуции; проверять на карточке.
- **LottieFiles — Neon Green** — https://lottiefiles.com/free-animations/neon-green
- **LottieFiles — Tech Loader** — https://lottiefiles.com/free-animations/tech-loader
- **LottieFiles — Particles** — https://lottiefiles.com/free-animations/particles
- **IconScout — Green Loader (Lottie)** — https://iconscout.com/lottie-animations/green-loader
- **IconScout — Particles (Lottie)** — https://iconscout.com/lottie-animations/particles
- Внедрение: `<lottie-player>` web-component или `lottie-web`. У нас есть vendored `lenis`/`gsap` рядом — Lottie докинуть легко.

## 5. Scroll-motion / WebGL / Three.js — код и стартеры (MIT/free)
- **react-three-fiber** (рендерер Three.js в React) — https://github.com/pmndrs/react-three-fiber — MIT.
- **drei** (хелперы: Environment, Float, MeshTransmissionMaterial, ScrollControls) — https://github.com/pmndrs/drei — MIT.
- **react-three-next** (R3F+Next стартер) — https://github.com/pmndrs/react-three-next — MIT.
- **@react-three/postprocessing** (Bloom и пр.) — https://github.com/pmndrs/postprocessing — MIT.
- **Three.js официальные примеры** — https://threejs.org/examples/ — MIT (наш стек уже на three r169).
- **Codrops** (туториалы/демо: scroll, WebGL, hover) — https://tympanus.net/codrops/ — код обычно свободный, ссылаться.
- **GSAP + ScrollTrigger** — https://gsap.com/scroll/ — бесплатно (у нас уже вендорен gsap+ScrollTrigger).
- **Lenis** (плавный скролл) — https://github.com/darkroomengineering/lenis — MIT (уже вендорен).

## 6. Референсы/вдохновение (галереи — смотреть, не качать)
- **Godly** — https://godly.website/ — топ веб-дизайн.
- **Land-book** — https://land-book.com/
- **Awwwards** — https://www.awwwards.com/
- **Codrops** — https://tympanus.net/codrops/
- **Dark.design / dark-themed galleries** — тёмные сайты-референсы.

---

## Топ-5 под OKO-hero/сайт
1. **Poly Haven studio HDRI (CC0)** — уже скачаны; дать глазу/стеклу настоящие отражения вместо RoomEnvironment. ✅
2. **drei `MeshTransmissionMaterial` + `Environment` + postprocessing Bloom (MIT)** — путь к «дорогому» стеклянному глазу, если переведём hero на R3F.
3. **Spline Community free-сцены (тёмные/неон)** — запасные фоны в том же движке, что текущий (быстрый свап `spline-viewer url`).
4. **LottieFiles Neon/Particles** — лёгкие неон-акценты в секциях (лоадеры, «дышащие» частицы) без нагрузки WebGL.
5. **GSAP ScrollTrigger + Lenis (free, уже вендорены)** — scroll-сцены/пины/reveal для следующих секций сайта.

## Что реально скачано (в репозитории)
- `oko-app/landing/inspo/hdri/studio_small_08_1k.hdr` (CC0, ~1.5 MB)
- `oko-app/landing/inspo/hdri/studio_small_09_1k.hdr` (CC0, ~1.6 MB)
- Итого ~3 MB. Остальное — ссылки (платное/через UI/по лицензии автора не перезаливаю).
