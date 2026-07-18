# OKO — упаковка под все площадки (packaging/)

Обёртки и метаданные, чтобы опубликовать OKO как приложение в **Google Play**, **RuStore**,
**App Store**, как **десктоп-установщик** (Win/macOS/Linux) и как **усиленное PWA**.

Приложение — самодостаточный HTML `oko-app/prototype/index.html`, живёт на
`https://true-journey-418.higgsfield.app` (рабочий web-manifest `/oko-manifest.json` и
service worker `/sw.js` уже есть → PWA-обёртки валидны).

> **Код приложения (`app/`, `prototype/`) не трогается — только читается.** Здесь лежат
> конфиги, готовые иконки/сплэши и пошаговые инструкции. Финальные store-сборки требуют
> аккаунтов и ключей владельца (Play/RuStore/Apple, keystore, сертификаты) — их запускает
> владелец по этим README.

---

## Что покрыто и чем

| Площадка | Путь | Артефакт | Конфиг / инструкция |
|---|---|---|---|
| **Google Play** | TWA (Bubblewrap) — обёртка PWA | `.aab` | `android/twa/twa-manifest.json`, `android/build-android.md` |
| **Google Play (запас)** | Capacitor | `.aab` | `capacitor/`, `android/build-android.md` |
| **RuStore** | Capacitor | `.apk` | `capacitor/`, `android/build-android.md` (раздел RuStore) |
| **App Store (iOS)** | Capacitor iOS | `.ipa` | `capacitor/`, `ios/build-ios.md`, `ios/Info.plist.snippet.xml` |
| **Desktop** | Tauri (реком.) | `.msi/.exe/.dmg/.AppImage/.deb` | `desktop/tauri/`, `desktop/build-desktop.md` |
| **Desktop (запас)** | Electron | `.exe/.dmg/.AppImage/.deb` | `desktop/electron/`, `desktop/build-desktop.md` |
| **PWA (усиленное)** | manifest+SW на сайте | — | иконки `icons/pwa/`, уже развёрнуто на хосте |

Единые идентификаторы: **appId `com.oko.app`**, имя **OKO**, цвета **#000/#000**, акцент
лайм **#9AFF00**.

---

## Структура

```
packaging/
├── README.md                     ← этот файл
├── capacitor/                    ← общий Capacitor-проект (Android + iOS)
│   ├── capacitor.config.ts       ← appId com.oko.app, REMOTE(server.url) / offline-bundle
│   ├── package.json
│   ├── www/index.html            ← placeholder webDir (loader)
│   └── scripts/bundle-www.js     ← копирует prototype в www для offline-режима
├── android/
│   ├── twa/twa-manifest.json     ← Bubblewrap: host, name OKO, #000, иконки, shortcuts
│   ├── twa/assetlinks.json       ← Digital Asset Links (вписать SHA-256)
│   ├── build-android.md          ← TWA + Capacitor + RuStore + подпись keystore
│   └── capacitor-notes/
├── ios/
│   ├── build-ios.md              ← Xcode, App Store Connect, риск-игры-на-деньги, режим tickets
│   └── Info.plist.snippet.xml    ← только нужные разрешения
├── desktop/
│   ├── tauri/                    ← tauri.conf.json, Cargo.toml, build.rs, src/main.rs, dist/, icons/
│   ├── electron/                 ← main.js, preload.js, package.json, electron-builder.yml, build/, app/
│   └── build-desktop.md          ← Win/macOS/Linux, подпись/нотаризация
├── icons/                        ← СГЕНЕРИРОВАНЫ из brand/ (см. ниже)
│   ├── pwa/        (72…512 + maskable 192/512)
│   ├── android/    (play 512, adaptive fg/bg/mono, mipmap-*/ square+round)
│   ├── ios/AppIcon.appiconset/  (все размеры + Contents.json, opaque RGB)
│   └── desktop/    (png 16…1024, icon.ico, icon.icns, tauri-имена)
├── splash/                       ← чёрный фон + лого: 2732², 1080×1920, 1920×1080, iOS, android12-icon
├── store-listing/
│   ├── descriptions.md           ← title/short/full RU+EN, keywords, категория, рейтинг, what's new
│   ├── screenshots-spec.md       ← размеры скринов/графики по каждому стору
│   └── privacy-policy.md         ← черновик политики + что заполнить в Data Safety/App Privacy
└── scripts/gen-assets.py         ← генератор всех иконок/сплэшей (идемпотентный)
```

Пересобрать иконки/сплэши: `python3 packaging/scripts/gen-assets.py`
(источник — `oko-app/brand/oko-logo-master-transparent.png`).

---

## Рекомендуемая последовательность (для владельца)

1. **PWA** — уже работает (manifest+SW на хосте). Ничего не требуется.
2. **RuStore (быстрее всего для РФ):** Capacitor → `assembleRelease` → свой keystore →
   загрузить `.apk`. Возраст 18+, политика конфиденциальности. См. `android/build-android.md`.
3. **Google Play:** TWA (Bubblewrap) → `.aab` → выложить `.well-known/assetlinks.json`
   на сайт → загрузить в Play Console. Content rating (IARC), Data safety.
4. **Desktop:** Tauri `tauri build` (или Electron) → раздача с сайта/GitHub Releases.
   Для «чистого» запуска — code-sign (Win) / нотаризация (mac).
5. **App Store (последним, самый строгий):** нужен Mac + Apple Developer $99. Собрать в
   режиме **«игры на внутренние билеты, не реальные деньги»** (см. риск ниже) и
   offline-bundle. См. `ios/build-ios.md`.

---

## Что нужно от владельца (ключи/аккаунты)

| Нужно | Для чего |
|---|---|
| **Android keystore** (создать `keytool`, хранить вечно) | подпись APK/AAB для RuStore и Play. Потеря = нельзя обновлять. |
| **Google Play Console** ($25 однократно) | публикация в Play |
| **RuStore Консоль разработчика** (бесплатно) | публикация в RuStore |
| **Apple Developer Program** ($99/год) + **Mac с Xcode** | сборка и публикация iOS |
| **Доступ к репозиторию сайта Higgsfield** | выложить `.well-known/assetlinks.json` для TWA |
| **Windows code-signing сертификат** (опц.) | чистый запуск .exe без SmartScreen |
| **Apple Developer ID** (тот же $99) | нотаризация macOS .dmg |
| **Реальный текст политики конфиденциальности** по `/legal` | требование всех сторов |
| **Скриншоты + Play feature graphic 1024×500** | карточки магазинов (отрендерить) |
| **Решение по iOS-режиму tickets** (какие разделы гейтить) | пройти ревью Apple 5.3/3.1 |

---

## Риски

- **App Store × игры на деньги/крипто/биржа (высокий).** Guideline 5.3 (азартные игры на
  реальные деньги — только лицензированным, geo, нативно, не через IAP), 3.1.1/3.1.5
  (крипто и продажи вне IAP), 4.2 (голая вебвью-обёртка). Митигация: iOS-сборка в режиме
  **внутренних билетов/очков без вывода в деньги**, крипто/вывод скрыты, offline-bundle,
  продажа билетов только через Apple IAP. Подробно — `ios/build-ios.md`.
- **Google Play × азартные механики (средний).** Нужна декларация, возможен гео-гейт,
  рейтинг 17+/18+. Data safety обязателен.
- **RuStore × доступность домена из РФ (средний).** REMOTE-режим тянет
  `higgsfield.app`; если домен нестабилен из РФ — использовать offline-bundle или своё
  зеркало/домен для RuStore-сборки.
- **Тонкая обёртка (Play 4.2 / RuStore).** Для Android обычно ок (есть PWA-функции),
  но безопаснее offline-bundle + сплэш + нативные иконки (всё готово).
- **Потеря ключа подписи.** Keystore и пароли — в надёжное хранилище; для Play включить
  Play App Signing.
- **Возрастной рейтинг.** Везде честно 17+/18+ (игры + UGC + биржа), иначе снятие с публикации.

---

## Проверка конфигов (сделано)
- JSON (`twa-manifest.json`, `assetlinks.json`, `tauri.conf.json`, `AppIcon Contents.json`) — `jq` OK.
- YAML (`electron-builder.yml`) — OK.
- JS (`main.js`, `preload.js`, `bundle-www.js`) — `node --check` OK.
- Иконки: iOS — opaque RGB (без альфы, как требует Apple); `.ico` мульти-размерный; `.icns` записан.
