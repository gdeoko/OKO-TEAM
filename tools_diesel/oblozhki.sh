#!/bin/bash
# Обложка это ПЕРВЫЙ КАДР ролика, в его же размере.
# В очереди лежали уменьшенные копии со страницы клиента (941x1672 вместо
# 1080x1920). Площадкам это не отказ, но обложка обязана совпадать с роликом
# кадр в кадр, иначе превью и первый кадр расходятся.
set -u
B=/opt/oko-poster
for N in "$@"; do
  D=$B/queue/$N
  [ -f "$D/reel.mp4" ] || { echo "$N: ролика нет"; continue; }
  ffmpeg -y -v error -i "$D/reel.mp4" -vf "select=eq(n\,0)" -frames:v 1 -q:v 2 "$D/.cover.tmp.jpg" 2>/dev/null
  if [ -s "$D/.cover.tmp.jpg" ]; then
    [ -f "$D/cover.jpg" ] && mv -f "$D/cover.jpg" "$D/cover.prezhnyaya.jpg"
    mv -f "$D/.cover.tmp.jpg" "$D/cover.jpg"
    echo "$N: обложка из первого кадра, $(identify -format '%wx%h' "$D/cover.jpg" 2>/dev/null), $(du -h "$D/cover.jpg" | cut -f1)"
  else
    rm -f "$D/.cover.tmp.jpg"
    echo "$N: кадр не вынулся, прежняя обложка оставлена"
  fi
done
