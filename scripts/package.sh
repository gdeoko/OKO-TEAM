#!/usr/bin/env bash
# ============================================================
# DUCK'S — сборка финального деплой-архива.
# Делает: vite build → dist/, кладёт PHP-бэкенд в корень dist/, пакует в zip.
# Итог: ducks-deploy.zip — распаковать в корень хостинга (public_html).
# Запуск:  bash scripts/package.sh
# ============================================================
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "▶ 1/4  Сборка фронтенда (vite build)…"
npm run build

echo "▶ 2/4  Копирование бэкенда (PHP/SQLite/cron) в корень dist/…"
# PHP-файлы и админка ложатся РЯДОМ с index.html
cp backend/config.php   dist/
cp backend/db.php       dist/
cp backend/mailer.php   dist/
cp backend/templates.php dist/
cp backend/api.php      dist/
cp backend/cron.php     dist/
mkdir -p dist/admin
cp -r backend/admin/*   dist/admin/
mkdir -p dist/data
# seed content.json (если на хостинге ещё нет своего отредактированного)
cp backend/data/content.json dist/data/content.json
# .gitkeep чтобы папка data/ создалась с правами на запись
touch dist/data/.gitkeep

echo "▶ 3/4  Проверка красивых ссылок (.htaccess, magnets, system)…"
test -f dist/.htaccess           && echo "  ✓ .htaccess"
test -f dist/system.html         && echo "  ✓ system.html  (→ /system)"
test -d dist/magnets             && echo "  ✓ magnets/     (→ /poker-pravila, /chitat-lyudey, /igry-dlya-mozga, /10-shagov)"

echo "▶ 4/4  Упаковка в ducks-deploy.zip…"
cd dist
rm -f ../ducks-deploy.zip
zip -rq ../ducks-deploy.zip . -x ".gitkeep"
cd "$ROOT"
echo "✅ Готово: ducks-deploy.zip ($(du -h ducks-deploy.zip | cut -f1))"
echo "   Распакуй в корень хостинга (public_html) и настрой cron на cron.php."
