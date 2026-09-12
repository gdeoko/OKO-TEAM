# Rocket CDN — media inventory

Контрольные суммы всех файлов находятся в `MEDIA_MANIFEST.sha256`.

## 1. Audio/video в репозитории

| Path | Bytes | Duration | Назначение/заметка |
|---|---:|---:|---|
| `rocketcdn/assets/audio/theme.m4a` | 593 334 | 72.000 s | музыкальная тема, AAC/M4A |
| `rocketcdn/assets/audio/theme.webm` | 525 529 | 72.008 s | музыкальная тема, WebM |
| `rocketcdn/assets/gen/cockpit-flight-mobile-v2.mp4` | 721 582 | 10.042 s | mobile cockpit flight |
| `rocketcdn/assets/gen/cockpit-flight-mobile-v2.webm` | 405 447 | 10.042 s | mobile cockpit flight |
| `rocketcdn/assets/gen/cockpit-flight-wide-v2.mp4` | 707 805 | 10.042 s | wide cockpit flight |
| `rocketcdn/assets/gen/cockpit-flight-wide-v2.webm` | 456 078 | 10.042 s | wide cockpit flight |
| `rocketcdn/assets/gen/console-640.mp4` | 373 176 | 6.133 s | compact console clip |
| `rocketcdn/assets/gen/console-640.webm` | 384 669 | 6.134 s | compact console clip |
| `rocketcdn/assets/gen/console-960.mp4` | 522 147 | 6.133 s | large console clip |
| `rocketcdn/assets/gen/space-earth.mp4` | 449 160 | 8.111 s | Earth background/fallback |
| `rocketcdn/assets/gen/space-earth.webm` | 379 321 | 8.112 s | Earth background/fallback |
| `rocketcdn/assets/gen/space-nebula.mp4` | 1 132 342 | 8.111 s | nebula background/fallback |
| `rocketcdn/assets/gen/space-nebula.webm` | 1 147 982 | 8.112 s | nebula background/fallback |

Все container headers прочитаны `ffprobe` без ошибки. Декодирование каждого полного кадра и browser playback всё равно входят в release QA.

## 2. Generated/runtime stills в репозитории

| Path | Dimensions | Bytes |
|---|---:|---:|
| `assets/gen/cockpit-flight-mobile-v2-poster.webp` | 720×1280 | 96 690 |
| `assets/gen/cockpit-flight-wide-v2-poster.webp` | 1280×720 | 107 828 |
| `assets/gen/cockpit-tall-v2.webp` | 941×1672 | 237 916 |
| `assets/gen/cockpit-tall.webp` | 768×1344 | 46 262 |
| `assets/gen/cockpit-wide-v2.webp` | 1672×941 | 263 988 |
| `assets/gen/cockpit-wide.webp` | 1344×768 | 155 292 |
| `assets/gen/console.webp` | 1344×768 | 32 246 |
| `assets/gen/dc-almaty.webp` | 1600×900 | 64 290 |
| `assets/gen/dc-moscow.webp` | 1600×900 | 59 078 |
| `assets/gen/dc-prague.webp` | 1600×900 | 83 434 |
| `assets/gen/og.jpg` | 1200×630 | 89 315 |
| `assets/gen/og.webp` | 1200×630 | 52 498 |

## 3. Space texture maps

| Path | Dimensions | Bytes |
|---|---:|---:|
| `assets/space/earth-day.jpg` | 4096×2048 | 1 461 877 |
| `assets/space/earth-day.webp` | 4096×2048 | 663 160 |
| `assets/space/earth-night.jpg` | 4096×2048 | 715 000 |
| `assets/space/earth-night.webp` | 4096×2048 | 270 284 |
| `assets/space/clouds.png` | 1024×512 | 260 222 |
| `assets/space/clouds.webp` | 1024×512 | 215 356 |
| `assets/space/moon.jpg` | 1024×512 | 238 093 |
| `assets/space/moon.webp` | 1024×512 | 227 430 |

## 4. Storyboard fallback

В `rocketcdn/assets/storyboard/` лежат `01.webp`–`08.webp`, каждый 1344×768. Суммарно они представляют восемь актов fallback: площадка, разгон, облака, орбита, продукты/спутники, вход в атмосферу, посадка, рубка.

## 5. Model-generated Library references

Folder: `references/generated-library/`.

- `Инженерная панель космического кокпита.png`
- `Кабина Rocket CDN: макросъёмка панели.png`
- `Кокпит звездолёта с Землёй и голограммами.png`
- `Панорамный кокпит ракеты над Землёй.png`
- `Панорамный космический кокпит над Землёй.png`
- `Подход к открытому люку космолёта.png`
- `Портретный кокпит с Землёй и Млечным Путём.png`
- `Финальный подход к креслу пилота.png`
- `Шаг в звёздную кабину.png`

Это production references. Они фиксируют physical gunmetal cabin, Earth/Milky Way view, аппаратные кнопки, recessed panels, люк/коридор и continuity камеры. Они не должны просто накладываться поверх основного 3D мира.

Contact sheet: `reports/generated-reference-contact-sheet.jpg`.

## 6. Mobile screenshots

Folder: `references/screenshots/`.

Включены пятнадцать снимков `Screenshot_20260822_14*.jpg`, показывающих:

- star systems/navigation menus;
- cockpit HUD и Earth/Milky Way target;
- mission/progress views;
- planet/map views;
- physical cabin transitions;
- landing/site CTA path;
- Rocket CDN main hero.

Contact sheet: `reports/live-screenshot-contact-sheet.jpg`.

## 7. Provenance gaps

Текущий repo не содержит надёжного production registry, который связывает каждый asset с prompt/model/seed/account/license. До новой генерации создать `ASSET_REGISTRY_TEMPLATE.md` → рабочий `ASSET_REGISTRY.md` и заполнять его при каждом accepted output.

