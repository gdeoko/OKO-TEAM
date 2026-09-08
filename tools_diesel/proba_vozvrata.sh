#!/bin/bash
# Проба разворачивания бэкапа В СТОРОНУ: живой профиль не трогаем.
# Проверяем, что внутри настоящий профиль браузера с куками, а не пустая папка.
set -u
B=/opt/oko-poster
T=$(mktemp -d /tmp/probavozvrat.XXXXXX)
for PAIR in "instagram_diesel ig_dsnew" "tiktok_diesel tt_diesel_prof"; do
  set -- $PAIR
  SRC=$B/cfg/vhody/$1.tgz
  [ -f "$SRC" ] || { echo "$1: бэкапа нет"; continue; }
  rm -rf "$T/$2"
  tar xzf "$SRC" -C "$T" 2>/dev/null
  if [ -d "$T/$2" ]; then
    COOK=$(find "$T/$2" -name "Cookies" -o -name "Cookies-journal" 2>/dev/null | wc -l)
    PREF=$([ -f "$T/$2/Default/Preferences" ] && echo да || echo нет)
    SIZE=$(du -sh "$T/$2" 2>/dev/null | cut -f1)
    echo "$1: развернулся, $SIZE, файлов кук $COOK, Preferences $PREF"
  else
    echo "$1: НЕ развернулся в профиль"
  fi
done
rm -rf "$T"
echo "прибрано, живые профили не тронуты"
