# OKO — сборка десктоп-приложения (Windows / macOS / Linux)

Два варианта. **Tauri** — рекомендуемый (лёгкий, ~3–10 МБ, использует системный WebView).
**Electron** — запасной (тяжелее, ~80–150 МБ, но проще и одинаково на всех ОС).

Оба по умолчанию грузят живой сайт `https://true-journey-418.higgsfield.app`
(REMOTE-режим). Есть OFFLINE-режим — упаковать копию `prototype/index.html` внутрь.

Продукт: **OKO**, окно **1280×800**, минимум **380×640**, тёмный фон `#000000`,
identifier `com.oko.app`.

---

## Вариант 1 — Tauri (рекомендуется)

Конфиги: `desktop/tauri/tauri.conf.json`, `Cargo.toml`, `build.rs`, `src/main.rs`,
иконки уже разложены в `desktop/tauri/icons/`.

### Предпосылки
```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Системные зависимости WebView:
#  Windows: WebView2 (обычно уже есть) + Visual Studio Build Tools
#  macOS:   Xcode Command Line Tools
#  Linux:   libwebkit2gtk-4.1-dev build-essential libssl-dev libayatana-appindicator3-dev librsvg2-dev
cargo install create-tauri-app   # (опц.)
npm i -g @tauri-apps/cli         # или cargo install tauri-cli
```

### Сборка
```bash
# Развернуть Tauri-проект вокруг наших конфигов:
#   поместить tauri.conf.json, Cargo.toml, build.rs, src/, icons/ в src-tauri/
#   (структура: <проект>/src-tauri/{tauri.conf.json,Cargo.toml,build.rs,src/main.rs,icons/})
#   frontendDist = "./dist" уже содержит loader (desktop/tauri/dist/index.html).

cd <проект>/src-tauri
tauri build
# Артефакты (target/release/bundle/):
#   Windows: *.msi (WiX) и *-setup.exe (NSIS)
#   macOS:   *.dmg и OKO.app
#   Linux:   *.AppImage и *.deb
```

> Иконки Tauri можно перегенерировать из одного PNG: `tauri icon path/to/icon-1024.png`
> (создаст ico/icns/png). У нас они уже готовы в `icons/`.

### OFFLINE-режим (Tauri)
1. Скопировать `oko-app/prototype/index.html` → `src-tauri/dist/index.html` (заменив loader).
2. В `tauri.conf.json` заменить `app.windows[0].url` c URL на `"index.html"`.
3. `tauri build`.

### Подпись/нотаризация (для распространения без предупреждений)
- **Windows:** code-signing сертификат (EV/OV). Подписать `signtool` или задать в
  tauri.conf `bundle.windows.certificateThumbprint`. Без подписи SmartScreen ругается.
- **macOS:** Apple Developer ($99) → Developer ID Application сертификат → подпись + notarize:
  `xcrun notarytool submit ...`. Без нотаризации Gatekeeper блокирует .dmg.
- **Linux:** подпись не обязательна.

---

## Вариант 2 — Electron (запасной)

Конфиги: `desktop/electron/{main.js, preload.js, package.json, electron-builder.yml}`,
иконки в `desktop/electron/build/{icon.ico,icon.icns,icon.png}` (уже разложены),
offline-заглушка `desktop/electron/app/index.html`.

```bash
cd oko-app/packaging/desktop/electron
npm install
npm start                 # запуск в dev (REMOTE)

# Сборка инсталляторов:
npm run dist:win          # -> release/*.exe (NSIS) + portable
npm run dist:mac          # -> release/*.dmg (только на macOS)
npm run dist:linux        # -> release/*.AppImage + *.deb
npm run dist              # текущая ОС
```

### OFFLINE-режим (Electron)
1. Скопировать `oko-app/prototype/index.html` → `desktop/electron/app/index.html`.
2. Запуск/сборка с переменной `OKO_OFFLINE=1` (main.js уже читает её):
   ```bash
   OKO_OFFLINE=1 npm start
   ```
   Для инсталлятора зашить флаг (напр. хардкодом `const OFFLINE = true` в main.js).

### Подпись
- Windows: `electron-builder` → `win.certificateFile`/`certificatePassword` в env.
- macOS: `CSC_LINK`/`CSC_KEYSTORE` + `mac.notarize` (нужен Apple Developer).

---

## Что где публиковать (десктоп)
- Просто раздача с сайта/GitHub Releases: `.exe`/`.msi` (Win), `.dmg` (Mac), `.AppImage`/`.deb` (Linux).
- **Microsoft Store:** можно завернуть .msi в MSIX (партнёрский аккаунт $19 однократно).
- **Mac App Store:** отдельная подпись (Mac App Distribution) + сэндбокс — сложнее, обычно
  достаточно нотаризованного .dmg вне стора.

## Чек-лист десктоп
- [ ] выбран Tauri (лёгкий) или Electron (простой)
- [ ] иконки на месте (готовы в `icons/desktop/` и в проектных папках)
- [ ] REMOTE или OFFLINE режим выбран
- [ ] сертификаты подписи (Win code-sign, Apple Developer для mac) — для «чистого» запуска
