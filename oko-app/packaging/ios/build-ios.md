# OKO — сборка под iOS (App Store)

iOS-обёртка строится тем же Capacitor-проектом, что и Android
(`packaging/capacitor/capacitor.config.ts`, appId `com.oko.app`, appName `OKO`).

> ⚠️ **Нужен Mac** (Xcode) и **Apple Developer Program — $99/год**. Собрать/подписать/
> залить в App Store Connect можно только с macOS. В облачной Linux-среде — только
> подготовка конфигов (сделано), финал — на Mac владельца или через mac-CI
> (Codemagic / GitHub Actions macOS runner / EAS).

---

## Шаги (на Mac)

```bash
cd oko-app/packaging/capacitor
npm install
npx cap add ios              # создаст ./ios (Xcode workspace)
npx cap sync ios

# Иконки/сплэш:
npm i -D @capacitor/assets
# resources/icon.png (1024, лого на чёрном, БЕЗ альфы) + resources/splash.png (2732x2732)
npx capacitor-assets generate --ios
# либо вручную скопировать наш готовый набор:
#   packaging/icons/ios/AppIcon.appiconset/*  -> ios/App/App/Assets.xcassets/AppIcon.appiconset/
#   (уже opaque RGB, без альфа-канала — как требует Apple)

npx cap open ios             # откроет Xcode
```

В Xcode:
1. **Signing & Capabilities** → выбрать Team (Apple Developer), Bundle ID `com.oko.app`.
   Xcode создаст provisioning profile автоматически (Automatically manage signing).
2. **Capabilities** — добавить по необходимости:
   - Push Notifications (если будут пуши в чатах),
   - Associated Domains (`applinks:true-journey-418.higgsfield.app`) для universal links,
   - Background Modes (только если реально нужно; лишнее → замечания ревью).
3. **Info.plist** — добавить строки-разрешения ТОЛЬКО под реально используемые функции
   (см. `Info.plist.snippet.xml`): камера/микрофон (звонки/сторис), фото (вложения),
   `NSAppTransportSecurity` не ослаблять (сайт по HTTPS — ок).
4. **Deployment target** iOS 14+.
5. Product → Archive → Distribute App → App Store Connect.

---

## App Store Connect (метаданные)
- Создать приложение: имя **OKO**, primary language Russian, Bundle ID `com.oko.app`,
  SKU `oko-app`.
- Категория: **Social Networking** (primary), Secondary — Productivity или Education.
- Возрастной рейтинг: заполнить анкету честно. Наличие игр/ставок и UGC → **17+**.
- Скриншоты: обязательны 6.7" (1290×2796) и 6.5" (1242×2688); iPad 12.9" (2048×2732)
  если поддерживаете iPad. См. `store-listing/screenshots-spec.md`.
- Privacy: App Privacy («Nutrition label») — задекларировать сбор (сообщения, контактные
  данные, идентификаторы). Ссылка на политику: см. `store-listing/privacy-policy.md`.
- Описание RU/EN, ключевые слова — `store-listing/`.

---

## ⚠️ РИСК РЕВЬЮ: игры на деньги / крипто / биржа

App Store жёстко ограничивает:
- **Guideline 5.3 (Gaming, gambling)** — «настоящие деньги» азартные игры разрешены только
  лицензированным операторам, с geo-ограничением, только нативно (не в вебвью), и НЕ через
  IAP. Обёртка-вебвью с играми на реальные деньги → **почти гарантированный reject**.
- **Guideline 3.1.1 / 3.1.5(b)** — крипто-обмен/кошельки и «биржа» с реальными платежами
  вне Apple IAP → ограничения и проверки; продажа цифрового контента должна идти через IAP.
- **Guideline 4.2** — «просто сайт в обёртке» может получить reject как «minimum
  functionality». Поэтому для iOS собирать **offline-bundle** (нативный опыт, сплэш, иконки,
  пуши) — не голый вебвью на remote URL.

### Рекомендация для iOS-сборки — ФЛАГ `IOS_TICKETS_MODE`
Собирать iOS-версию в режиме **«игры на внутренние билеты/очки, НЕ на реальные деньги»**:
- вывод реальных денег и крипто-функции скрыты/выключены на iOS;
- игры используют внутриигровую валюту (билеты), которая **не конвертируется в деньги**;
- при желании продавать билеты — только через **Apple In-App Purchase**.

Как прокинуть флаг в web-приложение (prototype читает его):
- REMOTE-режим: добавить query/hash при загрузке, напр. `server.url` →
  `https://true-journey-418.higgsfield.app/?platform=ios&mode=tickets`,
  и в приложении по этому флагу отключать денежные/крипто-разделы.
- BUNDLED-режим: собрать отдельную сборку prototype с выключенными разделами
  (флаг сборки), затем `npm run bundle:www`.
> Договориться с владельцем, какие именно разделы гейтить на iOS. Это единственный
> реалистичный путь пройти ревью Apple для приложения с игровой/биржевой механикой.

---

## Offline-bundle для iOS (рекомендуется для ревью)
```bash
cd oko-app/packaging/capacitor
npm run bundle:www                 # копирует prototype в ./www (или сборку с ios-флагом)
# закомментировать блок `server` в capacitor.config.ts
npx cap sync ios
```

## Чек-лист iOS
- [ ] Mac + Xcode + Apple Developer ($99)
- [ ] Bundle ID `com.oko.app` зарегистрирован
- [ ] AppIcon.appiconset вставлен (opaque, без альфы)
- [ ] Info.plist — только нужные разрешения
- [ ] режим `tickets` (без реальных денег/крипто) для прохождения 5.3/3.1
- [ ] offline-bundle (не голый вебвью — против 4.2)
- [ ] App Privacy заполнен, политика конфиденциальности доступна
- [ ] скриншоты 6.7"/6.5" (+iPad при поддержке)
