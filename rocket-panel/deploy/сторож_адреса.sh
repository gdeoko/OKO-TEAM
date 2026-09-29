#!/bin/bash
# Держит /srv/amberry/карта_адрес.txt живым.
#
# ЗАЧЕМ. Туннель `trycloudflare` выдаёт НОВЫЙ адрес при каждом подъёме,
# а файл адреса писался руками. 29.09.2026 это стоило боевой генерации:
# карту 53161920 сняли, адрес в файле остался её, и бот на каждый заказ
# отвечал «Name or service not known». Снаружи это выглядит как поломка
# бота, а не как устаревшая строчка в файле, и найти её без замера
# нечем: журнал показывает отказ карты, а карта жива.
#
# КАК. Адрес спрашивается у САМОЙ карты: cloudflared держит его в своих
# метриках (`userHostname`). Спросить сервер бота нечем - он знает
# только то, что ему записали, а это и есть сломанное место.
#
# Имена переменных латиницей: bash не умеет кириллицу в именах.
set -u
FILE=/srv/amberry/карта_адрес.txt
KEY=${VAST_KEY:-/root/.ssh/vast_amberry}
HOST=${VAST_HOST:-ssh5.vast.ai}
PORT=${VAST_PORT:-10404}
USER_PASS=${ROCKET_GPU_USER:-rocket}:${ROCKET_GPU_PASS:-}

alive () {   # адрес -> 0, если панель отвечает
  [ -n "$1" ] || return 1
  code=$(curl -s -o /dev/null -w "%{http_code}" -u "$USER_PASS" \
         --max-time 15 "$1/api/stats" 2>/dev/null)
  [ "$code" = "200" ]
}

cur=$(head -1 "$FILE" 2>/dev/null | tr -d '\r\n ')
if alive "$cur"; then exit 0; fi
echo "$(date -Is) адрес $cur не отвечает, спрашиваю карту" >&2

# Метрики cloudflared слушают на своём диапазоне 20241-20245. Искать
# порт через `ss -lntp` не выходит: в контейнере карты он этой строки
# не показывает вовсе, и первый заход вернул пустоту при живом туннеле.
new=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 -i "$KEY" \
        -p "$PORT" "root@$HOST" '
for p in 20241 20242 20243 20244 20245; do
  curl -s --max-time 5 "http://127.0.0.1:$p/metrics" \
    | grep -o "userHostname=\"https://[^\"]*\"" | head -1 \
    | sed "s/.*\"\\(https:[^\"]*\\)\"/\\1/" && break
done' 2>/dev/null | tr -d '\r\n ')

if alive "$new"; then
  echo "$new" > "$FILE"
  echo "$(date -Is) адрес обновлён: $new" >&2
  exit 0
fi
echo "$(date -Is) карта не назвала рабочий адрес (вернула «$new»)" >&2
exit 1
