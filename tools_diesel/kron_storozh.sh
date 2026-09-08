#!/bin/bash
# Поставить сторожа дороги в крон, не тронув остальное расписание.
set -u
LINE="*/20 * * * * flock -n /tmp/vhody_storozh.lock bash /opt/oko-poster/vhody_storozh.sh >/dev/null 2>&1"
CUR=$(crontab -l 2>/dev/null)
if echo "$CUR" | grep -qF "vhody_storozh.sh"; then
  echo "сторож уже в кроне"
else
  printf "%s\n%s\n" "$CUR" "$LINE" | grep -v '^$' | crontab -
  echo "сторож поставлен"
fi
crontab -l 2>/dev/null | grep -c . | xargs echo "строк в кроне:"
crontab -l 2>/dev/null | grep -E "vhody|diesel_publish" 
