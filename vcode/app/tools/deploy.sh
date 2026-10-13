#!/usr/bin/env bash
# V.LIONOFF · раскладка приложения на сервер.
#
#   bash tools/deploy.sh            # залить код и накатить контент
#   bash tools/deploy.sh --nginx    # то же плюс конфиг nginx и перезапуск
#
# Запускается НА сервере из папки репозитория. Боевой каталог: /var/www/vcode.
# База, загрузки и config.local.php при раскладке не трогаются.
set -euo pipefail

ЦЕЛЬ=${VCODE_ROOT:-/var/www/vcode}
ОТКУДА="$(cd "$(dirname "$0")/.." && pwd)"
PHP=${PHP_BIN:-/usr/bin/php}

echo "== раскладка $ОТКУДА -> $ЦЕЛЬ"
mkdir -p "$ЦЕЛЬ"/{public_html,core,db,content,bot,tools,data}

rsync -a --delete \
  --exclude 'data/' --exclude 'public_html/uploads/' --exclude 'core/config.local.php' \
  "$ОТКУДА"/public_html "$ОТКУДА"/core "$ОТКУДА"/db "$ОТКУДА"/content \
  "$ОТКУДА"/bot "$ОТКУДА"/tools "$ЦЕЛЬ"/

mkdir -p "$ЦЕЛЬ/data" "$ЦЕЛЬ/public_html/uploads"
chown -R www-data:www-data "$ЦЕЛЬ/data" "$ЦЕЛЬ/public_html/uploads"
chmod 775 "$ЦЕЛЬ/data" "$ЦЕЛЬ/public_html/uploads"

if [ ! -f "$ЦЕЛЬ/core/config.local.php" ]; then
  echo "!! нет core/config.local.php — токен бота и пароль админки не заданы"
  echo "   пример: tools/config.local.example.php"
fi

echo "== контент курсов"
cd "$ЦЕЛЬ" && $PHP tools/import_content.php

echo "== права на базу"
chown -R www-data:www-data "$ЦЕЛЬ/data"

if [ "${1:-}" = "--nginx" ]; then
  echo "== nginx"
  cp "$ЦЕЛЬ/tools/nginx-vcode.conf" /etc/nginx/sites-available/vcode
  ln -sf /etc/nginx/sites-available/vcode /etc/nginx/sites-enabled/vcode
  nginx -t && systemctl reload nginx
fi

echo "== крон воронки"
КРОН="*/15 * * * * $PHP $ЦЕЛЬ/bot/funnel.php >> /var/log/vcode-funnel.log 2>&1"
( crontab -l 2>/dev/null | grep -v 'vcode/bot/funnel.php'; echo "$КРОН" ) | crontab -
echo "готово"
