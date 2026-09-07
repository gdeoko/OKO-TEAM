#!/bin/bash
# Прогон всех проверок приложения подряд. Пишем одну строку на проверку.
cd "$(dirname "$0")"
LIST="full pravki svoi svyazka semya glavy plitki kolokol istorii lavka wipe3 badges rating cert cert2 exam task5 unread chat chat3 voice circle photo safety book docs lang espanol offline onboard reg kids deti child pin settings search searchopen home verse audio3 games3 narrow uzko dostup tema tema2 tema3 nagrada escape xss xss2 podderzhka chatnote kvest albom predel imya zamok gorod versiya"
bad=0
for t in $LIST; do
  [ -f "$t.mjs" ] || { printf '%-12s нет файла\n' "$t"; continue; }
  out=$(timeout 150 node "$t.mjs" 2>&1)
  line=$(printf '%s' "$out" | grep -E 'ОШИБОК|ОШИБКИ' | tail -1)
  [ -z "$line" ] && line=$(printf '%s' "$out" | tail -1 | cut -c1-60)
  case "$line" in
    *"(0)"*|*": 0"*) printf '%-12s ok\n' "$t" ;;
    *) printf '%-12s %s\n' "$t" "$line"; bad=$((bad+1)) ;;
  esac
done
echo "--- проверок с замечаниями: $bad"
