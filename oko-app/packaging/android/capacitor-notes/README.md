# Android через Capacitor

Общий Capacitor-проект для Android и iOS лежит в `packaging/capacitor/`.
Пошаговая сборка Android APK (RuStore) / AAB (Play) — в `../build-android.md`, раздел
«Путь B — Capacitor».

Короткая версия:
```bash
cd packaging/capacitor && npm install
npx cap add android && npx cap sync android
cd android && ./gradlew assembleRelease   # APK для RuStore
#              ./gradlew bundleRelease     # AAB для Play
```
