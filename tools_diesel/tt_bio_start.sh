#!/bin/bash
# Запуск правки био в фоне: окно живёт на :99, человек проходит капчу через noVNC.
cd /opt/oko-poster || exit 1
mkdir -p logs
: > logs/tt_bio.log
setsid env DISPLAY=:99 TT_PORT="${TT_PORT:-10850}" TT_WAIT="${TT_WAIT:-180}" TT_HANDS="${TT_HANDS:-0}" \
  node tt_bio_zhdu.mjs > logs/tt_bio_run.log 2>&1 < /dev/null &
disown
echo "запущено pid $!"
