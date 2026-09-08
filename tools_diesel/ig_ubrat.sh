#!/bin/bash
# Снять окна профилей Instagram по PID. Образец в строке команды убил бы shell.
PAT='ig_dsnew'
SELF=$$
PIDS=$(ps -eo pid=,args= | grep -F "$PAT" | grep -v ' grep ' | awk -v s="$SELF" '$1 != s {print $1}')
if [ -z "$PIDS" ]; then echo "окон нет"; else
  echo "снимаю: $(echo $PIDS | tr '\n' ' ')"
  for P in $PIDS; do kill "$P" 2>/dev/null; done
  sleep 4
  for P in $PIDS; do kill -9 "$P" 2>/dev/null; done
  sleep 2
fi
for D in browser/ig_dsnew browser/ig_dsnew2; do
  rm -f "/opt/oko-poster/$D/SingletonLock" "/opt/oko-poster/$D/SingletonCookie" "/opt/oko-poster/$D/SingletonSocket" 2>/dev/null
done
echo "готово"
