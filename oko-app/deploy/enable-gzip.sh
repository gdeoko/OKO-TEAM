#!/usr/bin/env bash
# ============================================================================
# OKO · включить сжатие статики в nginx на VPS
#
# ЗАЧЕМ. Замер 09.08: okoteam.top отдаёт app.js РАЗЖАТЫМ — 4 885 578 байт.
# app.css — ещё 1 135 409 байт. При этом index.html, oko-v2.js, oko-v2.css и
# oko-social.js отдаются с Content-Encoding: gzip, то есть gzip в конфиге
# включён, но именно на эти файлы не распространяется.
# На телефоне это ~6 МБ вместо ~800 КБ: первая загрузка в Telegram занимает
# секунды, и это главная причина ощущения «всё лагает».
#
# ЧТО ДЕЛАЕТ. Дописывает в vhost директивы gzip для текстовых типов, проверяет
# конфиг через `nginx -t` и только после успешной проверки перезагружает nginx.
# Перед правкой кладёт бэкап рядом с конфигом. Повторный запуск безопасен:
# если блок уже стоит, скрипт ничего не меняет.
#
# ЗАПУСК на VPS (root):
#   bash enable-gzip.sh
# или через control-эндпоинт, одной строкой:
#   curl -X POST https://okoagents.okoteam.top/x -H "X-Token: $CONTROL_TOKEN" \
#        --data "$(cat enable-gzip.sh)"
# ============================================================================
set -euo pipefail

VHOST=/etc/nginx/sites-enabled/okoteam
MARK='# --- OKO gzip (добавлено автоматически) ---'

if [ ! -f "$VHOST" ]; then
  echo "Не нашёл vhost: $VHOST" >&2
  exit 1
fi

if grep -qF "$MARK" "$VHOST"; then
  echo "Сжатие уже настроено — ничего не меняю."
  exit 0
fi

BACKUP="${VHOST}.bak.$(date +%Y%m%d-%H%M%S)"
cp -a "$VHOST" "$BACKUP"
echo "Бэкап: $BACKUP"

# Вставляем директивы внутрь первого блока server { ... }
python3 - "$VHOST" "$MARK" <<'PY'
import sys, re
path, mark = sys.argv[1], sys.argv[2]
src = open(path, encoding='utf-8').read()
block = f"""
    {mark}
    gzip              on;
    gzip_vary         on;
    gzip_comp_level   6;
    gzip_min_length   1024;
    gzip_proxied      any;
    gzip_types
        text/plain text/css text/xml text/javascript
        application/javascript application/x-javascript
        application/json application/xml application/manifest+json
        image/svg+xml;
    # Отдаём заранее сжатый файл, если он лежит рядом (app.js.gz и т.п.)
    gzip_static       on;
    # --- конец блока OKO gzip ---
"""
i = src.find('server {')
if i < 0:
    sys.exit('в конфиге нет блока server {')
j = src.index('\n', i) + 1
open(path, 'w', encoding='utf-8').write(src[:j] + block + src[j:])
print('директивы добавлены')
PY

if nginx -t; then
  systemctl reload nginx || service nginx reload
  echo "nginx перезагружен."
else
  echo "nginx -t не прошёл — откатываю." >&2
  cp -a "$BACKUP" "$VHOST"
  exit 1
fi

echo
echo "Проверка (должно появиться Content-Encoding: gzip):"
for f in app.js app.css index.html service-worker.js; do
  printf '  %-20s' "$f"
  curl -sI -H 'Accept-Encoding: gzip' "https://okoteam.top/$f" \
    | grep -iE 'content-encoding|content-length' | tr -d '\r' | paste -sd' ' || echo '—'
done
