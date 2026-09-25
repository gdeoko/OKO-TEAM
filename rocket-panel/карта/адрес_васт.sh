#!/bin/bash
# АДРЕС КАРТЫ VAST -> ФАЙЛ, КОТОРЫЙ ЧИТАЕТ БОТ.
#
# У Hyperstack адрес записывал менеджер карты: он же её и поднимал.
# Карта на Vast постоянная, её никто не поднимает — но туннель
# cloudflared берёт НОВОЕ имя при каждом перезапуске, а перезапускается
# он сам, по своему усмотрению.
#
# Поэтому адрес не «назначается», а ВЫЧИТЫВАЕТСЯ с пода раз в минуту.
# Бот перечитывает файл перед каждым обращением (см. gpu.ФАЙЛ_АДРЕСА),
# так что смена туннеля доезжает до него сама, без перезапуска.
#
# Имена переменных латиницей: bash кириллицу в именах не берёт. За одну
# сессию на этом споткнулись восемь раз: падает не строка объявления, а
# что-то позже и с невнятным «not a valid identifier».
#
# ГДЕ КАРТА — В ОТДЕЛЬНОМ ФАЙЛЕ, А НЕ ЗДЕСЬ.
#
# Хост и порт у Vast меняются при КАЖДОЙ новой машине, и меняются оба:
# прокси может переехать с ssh1 на ssh5, порт всегда новый. Держать их
# в теле скрипта значит править его при каждой смене карты и каждый раз
# рисковать опечаткой в единственном месте, которое связывает бота с
# картой. Теперь они в `/etc/amberry-card.env`, и смена карты — это две
# строки в конфиге.
#
# НЕСКОЛЬКО КАРТ (25.09.2026). Основная - /etc/amberry-card.env, каждая
# дополнительная - свой файл /etc/amberry-cards.d/<имя>.env с теми же
# VAST_HOST и VAST_PORT. Добавить карту на день рекламы = положить файл;
# убрать = удалить файл. У каждой карты свой адрес в
# /srv/amberry/карты/<имя>.txt, а в общий файл бота они ложатся по
# строке: основная первой. Бот раздаёт задания между строками сам
# (bot/gpu.py).
set -u
KEY_DEFAULT=/root/.ssh/vast_amberry
FILE=/srv/amberry/карта_адрес.txt
DIR=/srv/amberry/карты
SSHOPT="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=20"
mkdir -p "$DIR"

# Список карт: «имя файл-настроек». Основная всегда первая.
CARDS="main /etc/amberry-card.env"
for F in /etc/amberry-cards.d/*.env; do
  [ -r "$F" ] || continue
  CARDS="$CARDS
$(basename "$F" .env) $F"
done

LIVE=""
while read -r NAME CONF; do
  [ -n "$NAME" ] || continue
  VAST_HOST=""; VAST_PORT=""; VAST_KEY=""; VAST_ADDR_FILE=""
  [ -r "$CONF" ] && . "$CONF"
  [ -n "$VAST_HOST" ] && [ -n "$VAST_PORT" ] || continue
  [ "$NAME" = main ] && [ -n "$VAST_ADDR_FILE" ] && FILE=$VAST_ADDR_FILE
  NEW=$(timeout 40 ssh -n $SSHOPT -i "${VAST_KEY:-$KEY_DEFAULT}" -p "$VAST_PORT" "$VAST_HOST" \
          "grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /var/log/tunnel.log 2>/dev/null | tail -1" \
        2>/dev/null)
  # Пустой ответ - НЕ повод стирать адрес: под мог на минуту
  # отвалиться, старый адрес хотя бы может ожить, пустой - никогда.
  if [ -n "$NEW" ]; then
    OLD=$(cat "$DIR/$NAME.txt" 2>/dev/null || true)
    if [ "$NEW" != "$OLD" ]; then
      printf '%s' "$NEW" > "$DIR/$NAME.txt"
      echo "$(date +%F\ %T) $NAME: новый адрес $NEW"
    fi
  else
    echo "$(date +%F\ %T) $NAME: под молчит - оставляю прежний адрес"
  fi
  [ -s "$DIR/$NAME.txt" ] && LIVE="$LIVE$(cat "$DIR/$NAME.txt")
"
done <<LIST
$CARDS
LIST

# Пусто - общий файл не трогаем по той же причине.
[ -n "$LIVE" ] || exit 0
NEWALL=$(printf '%s' "$LIVE" | sed '/^$/d')
OLDALL=$(cat "$FILE" 2>/dev/null || true)
if [ "$NEWALL" != "$OLDALL" ]; then
  printf '%s\n' "$NEWALL" > "$FILE.tmp" && mv -f "$FILE.tmp" "$FILE"
  chmod 644 "$FILE"
  echo "$(date +%F\ %T) карт в работе: $(printf '%s\n' "$NEWALL" | wc -l)"
fi
