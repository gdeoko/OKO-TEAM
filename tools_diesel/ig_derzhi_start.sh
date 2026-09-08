#!/bin/bash
# Поднять окно Instagram и держать, пока человек проходит проверку.
cd /opt/oko-poster || exit 1
mkdir -p logs
: > logs/ig_derzhi.log
set -a; . cfg/secrets.env 2>/dev/null; set +a
setsid env DISPLAY=:99 IG_PROF="${IG_PROF:-browser/ig_dsnew}" IG_NICK="${IG_NICK:-diesel_cargo_top}" \
  IG_WAIT="${IG_WAIT:-180}" node ig_derzhi.mjs > logs/ig_derzhi_run.log 2>&1 < /dev/null &
disown
echo "запущено pid $!"
