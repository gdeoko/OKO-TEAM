#!/bin/bash
# Снять осиротевшие браузеры профиля DIESEL. Бьём по PID, а не по образцу:
# образец в строке команды убивает сам вызывающий shell (проверено на pkill).
# Имена переменных латиницей: bash не принимает кириллические идентификаторы.
PAT='tt_diesel_prof'
SELF=$$
PIDS=$(ps -eo pid=,args= | grep -F "$PAT" | grep -v ' grep ' | awk -v s="$SELF" '$1 != s {print $1}')
if [ -z "$PIDS" ]; then echo "чужих окон нет"; else
  echo "снимаю: $(echo $PIDS | tr '\n' ' ')"
  for P in $PIDS; do kill "$P" 2>/dev/null; done
  sleep 4
  for P in $PIDS; do kill -9 "$P" 2>/dev/null; done
  sleep 2
fi
rm -f /opt/oko-poster/cfg/tt_diesel_prof/SingletonLock \
      /opt/oko-poster/cfg/tt_diesel_prof/SingletonCookie \
      /opt/oko-poster/cfg/tt_diesel_prof/SingletonSocket 2>/dev/null
LEFT=$(ps -eo pid=,args= | grep -F "$PAT" | grep -v ' grep ' | awk -v s="$SELF" '$1 != s' | wc -l)
echo "осталось окон: $LEFT"
