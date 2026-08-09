#!/usr/bin/env bash
# ============================================================================
# OKO · включить сжатие статики в nginx на VPS
#
# ЗАЧЕМ. Замер 09.08 (probe-prod.mjs): первая загрузка okoteam.top весит
# 10,5 МБ, из них 12 файлов едут БЕЗ СЖАТИЯ — app.js 3955 КБ, app.css 1109 КБ,
# three.module.min.js 655 КБ, oko-eye.glb 484 КБ и крупные слои из media/app.
# Под gzip те же исходники сжимаются с 5858 КБ до 1814 КБ — минус 69%.
#
# Диагноз точный: gzip в nginx включён, но с типами по умолчанию, а это
# только text/html. Поэтому index.html приезжает сжатым, а весь JS и CSS —
# нет. Лечится добавлением gzip_types.
#
# (Прежняя версия этой шапки утверждала, что oko-v2.js и oko-social.js едут
# сжатыми. Это было враньё SPA-фолбэка: файлов на сервере не было вовсе,
# nginx отдавал вместо них index.html — сжатый и со статусом 200.)
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
for f in app.js app.css index.html service-worker.js \
         media/app/oko-wallet2.js media/app/oko-v2.css media/vendor/three.module.min.js; do
  printf '  %-20s' "$f"
  curl -sI -H 'Accept-Encoding: gzip' "https://okoteam.top/$f" \
    | grep -iE 'content-encoding|content-length' | tr -d '\r' | paste -sd' ' || echo '—'
done
