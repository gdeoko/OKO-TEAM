#!/bin/bash
# Вернуть вход из бэкапа. Бэкап без проверенного восстановления это не бэкап.
#
#   vhody_vosstanovit.sh                       что лежит и чем можно вернуть
#   vhody_vosstanovit.sh tiktok                вернуть свежее поколение (сухо)
#   vhody_vosstanovit.sh tiktok 1 делай        вернуть вчерашнее, по-настоящему
#
# Без слова "делай" ничего не трогается: печатается, что было бы сделано.
# Текущий профиль перед заменой уходит в сторону, а не удаляется: если бэкап
# окажется старше слёта входа, вернуть назад будет нечем.
set -u
B=/opt/oko-poster
D=$B/cfg/vhody
WHAT=${1:-}
GEN=${2:-}
GO=${3:-}

case "$WHAT" in
  tiktok)    NAME=tiktok_diesel;    PROF=$B/cfg/tt_diesel_prof ;;
  instagram) NAME=instagram_diesel; PROF=$B/browser/ig_dsnew ;;
  "")        echo "поколения в $D:"; ls -lh "$D"/*.tgz 2>/dev/null | awk '{print "  "$5, $9}'
             echo
             echo "площадки: tiktok, instagram"
             echo "YouTube сессии не имеет: там refresh-токен, возвращать нечего"
             exit 0 ;;
  *) echo "не знаю площадку: $WHAT (есть tiktok, instagram)"; exit 2 ;;
esac

SRC=$D/$NAME.tgz
[ -n "$GEN" ] && SRC=$D/$NAME.$GEN.tgz
[ -f "$SRC" ] || { echo "нет такого бэкапа: $SRC"; exit 2; }

if ! tar tzf "$SRC" >/dev/null 2>&1; then
  echo "архив битый, восстанавливать из него нельзя: $SRC"; exit 3
fi
FILES=$(tar tzf "$SRC" 2>/dev/null | wc -l)
echo "бэкап: $SRC ($(du -h "$SRC" | cut -f1), файлов $FILES, снят $(stat -c %y "$SRC" | cut -d. -f1))"
echo "профиль: $PROF"

if [ "$GO" != "делай" ]; then
  echo
  echo "СУХО. Ничего не менялось. Чтобы вернуть по-настоящему, добавь слово: делай"
  exit 0
fi

PIDS=$(ps -eo pid=,args= | grep -F "$(basename "$PROF")" | grep -v ' grep ' | awk -v s=$$ '$1 != s {print $1}')
if [ -n "$PIDS" ]; then
  echo "снимаю открытые окна профиля: $(echo $PIDS | tr '\n' ' ')"
  for P in $PIDS; do kill "$P" 2>/dev/null; done
  sleep 4
  for P in $PIDS; do kill -9 "$P" 2>/dev/null; done
  sleep 2
fi

STAMP=$(date -u +%Y%m%d%H%M%S)
if [ -d "$PROF" ]; then
  mv "$PROF" "$PROF.dosmeny.$STAMP"
  echo "прежний профиль отложен: $PROF.dosmeny.$STAMP"
fi
tar xzf "$SRC" -C "$(dirname "$PROF")"
if [ -d "$PROF" ]; then
  echo "восстановлено. Проверь вход: bash $B/vhody_proverka.sh"
else
  echo "распаковка не дала профиля, возвращаю прежний"
  mv "$PROF.dosmeny.$STAMP" "$PROF" 2>/dev/null
  exit 4
fi
