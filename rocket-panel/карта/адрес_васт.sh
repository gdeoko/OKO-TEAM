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
# Имена переменных латиницей: bash кириллицу в именах не берёт.
set -u
KEY=/root/.ssh/vast_amberry
HOST=root@ssh1.vast.ai
PORT=14390
FILE=/srv/amberry/карта_адрес.txt
SSHOPT="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=20"

NEW=$(timeout 40 ssh $SSHOPT -i $KEY -p $PORT $HOST \
        "grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /var/log/tunnel.log 2>/dev/null | tail -1" \
      2>/dev/null)

# Пустой ответ — НЕ повод стирать адрес. Под мог на минуту отвалиться,
# а бот без адреса перестанет генерировать вовсе. Старый адрес хотя бы
# может ожить; пустой не оживёт никогда.
[ -n "$NEW" ] || { echo "$(date +%F\ %T) под молчит — оставляю прежний адрес"; exit 0; }

OLD=$(cat "$FILE" 2>/dev/null || true)
if [ "$NEW" != "$OLD" ]; then
  printf '%s' "$NEW" > "$FILE"
  echo "$(date +%F\ %T) новый адрес: $NEW"
fi
