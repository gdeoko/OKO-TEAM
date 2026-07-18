# OKO — сборка под Android (Google Play + RuStore)

Два независимых пути. Можно собрать оба и публиковать один и тот же продукт в обоих
сторах (разными артефактами).

- **Путь A — TWA (Bubblewrap):** тонкая обёртка над уже работающим PWA. Лучший вариант
  для Google Play (Play любит TWA/PWA). Требует Digital Asset Links.
- **Путь B — Capacitor:** нативный WebView-контейнер. Основной путь для **RuStore**
  (там TWA-проверка ссылок не нужна) и запасной для Play. Умеет remote-URL и offline-bundle.

Идентификаторы (одинаковы в обоих путях):
- applicationId / packageId: `com.oko.app`
- Имя: `OKO`
- themeColor / backgroundColor: `#000000`
- Хост PWA: `true-journey-418.higgsfield.app`, manifest `/oko-manifest.json`, SW `/sw.js`

---

## Предпосылки (один раз)

```bash
# JDK 17 + Android SDK (или Android Studio). Проверка:
java -version            # нужен 17
sdkmanager --version

# Node 18+ (в этой среде node 22 — ок)
node -v
```

Bubblewrap сам скачает JDK/Android SDK, если их нет, — согласиться при первом `init`.

---

## Путь A — TWA через Bubblewrap (Google Play)

Готовый конфиг: `android/twa/twa-manifest.json` (host, name OKO, цвета #000, startUrl `/`,
иконки с сайта, shortcuts «Чаты»/«Лента»).

```bash
npm i -g @bubblewrap/cli

# Рабочая папка сборки (вне git-репозитория проекта):
mkdir -p ~/oko-twa && cd ~/oko-twa

# Вариант 1: инициализация из живого web-манифеста (Bubblewrap задаст вопросы —
# ответы уже отражены в нашем twa-manifest.json, можно сверяться):
bubblewrap init --manifest https://true-journey-418.higgsfield.app/oko-manifest.json

# Вариант 2 (предпочтительно, детерминированно): скопировать наш конфиг и обновить.
cp /path/to/oko-app/packaging/android/twa/twa-manifest.json ./twa-manifest.json
bubblewrap update            # подтянет параметры из twa-manifest.json

# Сборка (создаст keystore при первом запуске — СОХРАНИТЬ пароль и файл!):
bubblewrap build
# -> ./app-release-signed.apk  и  ./app-release-bundle.aab (для Play заливать .aab)
```

### Digital Asset Links (обязательно для TWA без адресной строки)
1. Получить SHA-256 отпечаток ключа подписи:
   ```bash
   keytool -list -v -keystore ./android.keystore -alias oko | grep SHA256
   ```
   (Если публикуешь через Play App Signing — брать отпечаток из
   Play Console → Setup → App integrity → App signing key certificate.)
2. Вписать его в `android/twa/assetlinks.json` вместо
   `REPLACE_WITH_YOUR_SIGNING_KEY_SHA256_FINGERPRINT`.
3. Выложить файл на сайт по пути:
   `https://true-journey-418.higgsfield.app/.well-known/assetlinks.json`
   (положить в репозиторий сайта Higgsfield → `app/public/.well-known/` → redeploy).
4. Проверить: `https://developers.google.com/digital-asset-links/tools/generator`
   Без валидного assetlinks TWA откроется в Custom Tab с адресной строкой.

---

## Путь B — Capacitor (RuStore + запасной Play)

Готовый конфиг: `packaging/capacitor/capacitor.config.ts` (appId `com.oko.app`, appName OKO,
`server.url` = публичная ссылка — REMOTE-режим по умолчанию; есть и offline-bundle режим).

```bash
cd /path/to/oko-app/packaging/capacitor
npm install
npx cap add android          # создаст ./android (Gradle-проект)
npx cap sync android

# Иконки/сплэши: скопировать сгенерированные ресурсы в Android-проект.
# Adaptive-иконки:
#   packaging/icons/android/adaptive/ic_launcher_foreground.png  -> res/mipmap-*/  (см. ниже)
#   packaging/icons/android/adaptive/ic_launcher_background.png
# Проще — плагином @capacitor/assets:
npm i -D @capacitor/assets
# положить исходники: resources/icon.png (1024, лого на чёрном) и resources/splash.png (2732x2732)
npx capacitor-assets generate --android    # разложит все mipmap-* и splash автоматически

# Сборка релизного APK (для RuStore) и AAB (для Play):
cd android
./gradlew assembleRelease      # -> app/build/outputs/apk/release/app-release-unsigned.apk
./gradlew bundleRelease        # -> app/build/outputs/bundle/release/app-release.aab
```

### Подпись release (keystore)
```bash
# создать keystore один раз:
keytool -genkey -v -keystore oko-release.keystore -alias oko \
  -keyalg RSA -keysize 2048 -validity 10000

# android/app/build.gradle -> signingConfigs (или через ~/.gradle/gradle.properties):
#   OKO_STORE_FILE=/abs/oko-release.keystore
#   OKO_STORE_PASSWORD=...
#   OKO_KEY_ALIAS=oko
#   OKO_KEY_PASSWORD=...
# подписать вручную (если не через gradle signingConfig):
apksigner sign --ks oko-release.keystore --ks-key-alias oko \
  --out app-release.apk app-release-unsigned.apk
apksigner verify app-release.apk
```

### Offline-режим (если Play отклонит «тонкую обёртку» — редко для Android)
```bash
cd /path/to/oko-app/packaging/capacitor
npm run bundle:www            # копирует prototype/index.html в ./www
# затем закомментировать блок `server` в capacitor.config.ts
npx cap sync android
```

---

## RuStore — особенности (важно для РФ-аудитории)

- **Формат:** RuStore принимает **APK** (не AAB). Использовать `assembleRelease` из Пути B.
- **Аккаунт:** RuStore Консоль разработчика (нужен для публикации), вход по РФ-номеру/Госуслугам
  или как юрлицо/самозанятый. Комиссия для инди — 0% по большинству категорий.
- **Подпись:** свой keystore (RuStore не навязывает свой App Signing, как Play). Хранить ключ.
- **Возрастной рейтинг: 18+** — в приложении есть игры (в т.ч. на ставки/внутренние средства)
  и биржа услуг. Указать 18+ и заполнить анкету контента честно (азартные механики → 18+).
- **Категория:** «Социальные сети» / «Коммуникации» (основная) — OKO это мессенджер + лента.
- **Проверка:** RuStore проверяет на запрещённый контент и работоспособность. Приложение
  должно открываться без обязательного VPN и работать на сети РФ (проверить, что домен
  higgsfield.app доступен из РФ; если нет — рассмотреть свой домен/зеркало для RuStore-сборки).
- **Обязательно:** политика конфиденциальности (ссылка — см. `store-listing/privacy-policy.md`,
  в приложении раздел `/legal`), контакты поддержки, описание на русском.

## Google Play — особенности

- **Формат:** только **AAB** (`bundleRelease` или Bubblewrap `.aab`).
- **Play App Signing:** включён по умолчанию — Google хранит ключ подписи, ты загружаешь
  upload-ключ. Отпечаток для assetlinks брать из Play Console (см. выше).
- **Content rating:** пройти анкету IARC. Наличие азартных/деньги-механик → рейтинг может
  стать «18+/Mature». Для игр «на реальные деньги» Play требует отдельную декларацию и
  географию; безопаснее для Play, как и для iOS, использовать **внутренние билеты/очки**
  (флаг «игры не на реальные деньги»). См. `../ios/build-ios.md` и `store-listing/`.
- **Data safety form:** заполнить (чаты → сбор сообщений, аккаунт, и т.д.).
- **target SDK:** держать актуальным (на 2026 — не ниже требуемого Play; обновлять `targetSdkVersion`).

---

## Чек-лист артефактов Android
- [ ] `.aab` (Play) — Путь A или B
- [ ] `.apk` release-signed (RuStore) — Путь B
- [ ] keystore + пароли сохранены в надёжном месте (потеря = невозможность обновлять!)
- [ ] `.well-known/assetlinks.json` выложен на сайт (только для TWA)
- [ ] иконки/сплэш вставлены (`@capacitor/assets` или вручную)
- [ ] возрастной рейтинг 18+, политика конфиденциальности, описания RU/EN
