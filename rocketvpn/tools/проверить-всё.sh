#!/bin/bash
# Все живые проверки Rocket VPN подряд, одной командой.
#
# ЗАЧЕМ. Проверок стало под два десятка, и запускать их по одной значит
# рано или поздно забыть ту, которую сегодня как раз и сломали.
# Каждая печатает ЧИСТО или ГРЯЗНО и отдаёт код возврата, здесь они
# просто собираются в один список с итогом.
#
# ИМЕНА ПЕРЕМЕННЫХ ЗДЕСЬ ЛАТИНСКИЕ, и это не отступление от правила
# «идентификаторы по-русски». Оболочка имя переменной кириллицей не
# принимает вовсе: `ПОРТ=8170` она читает как команду с таким именем и
# отвечает «command not found». Скрипт при этом завершался кодом ноль,
# то есть докладывал «всё чисто», не запустив НИ ОДНОЙ проверки.
# Кириллица остаётся во всём, что человек читает: в выводе и в путях.
#
#   bash tools/проверить-всё.sh          все проверки
#   bash tools/проверить-всё.sh ход      только те, чьё имя содержит «ход»
set -u
cd "$(dirname "$0")/.."

filter="${1:-}"
port=8170
base="http://127.0.0.1:$port"
own=0

if ! curl -s -o /dev/null -m 5 "$base/" 2>/dev/null; then
  echo "поднимаю стенд на $port"
  RV_SITE_SECRET=стенд RV_SITE_OPEN=1 RV_SITE_URL=/ PHP_CLI_SERVER_WORKERS=64 \
    php -S 127.0.0.1:$port tools/стенд.php >/tmp/стенд-$port.log 2>&1 &
  own=$!
  for i in 1 2 3 4 5 6 7 8 9 10; do
    curl -s -o /dev/null -m 3 "$base/" 2>/dev/null && break
    sleep 1
  done
fi

# ── Закрытый стенд для проверки створа ─────────────────────────────
# Боевой сайт открытая витрина, и обычный стенд поднимается таким же.
# Створ при этом никуда не делся: им закрывается предпоказ. Проверять
# его надо там, где он включён, значит нужен второй стенд БЕЗ
# RV_SITE_OPEN. Проверка сама пропустит себя, если этого адреса нет.
closed_port=8172
closed="http://127.0.0.1:$closed_port"
own_closed=0
if ! curl -s -o /dev/null -m 5 "$closed/" 2>/dev/null; then
  RV_SITE_SECRET=стенд RV_SITE_URL=/ \
    php -S 127.0.0.1:$closed_port tools/стенд.php >/tmp/стенд-$closed_port.log 2>&1 &
  own_closed=$!
  for i in 1 2 3 4 5; do
    curl -s -o /dev/null -m 3 "$closed/" 2>/dev/null && break
    sleep 1
  done
fi
export RV_CLOSED_URL="$closed"

clean=0
dirty=0
list=""

for file in tools/checks/*.mjs; do
  name=$(basename "$file" .mjs)
  # общее.mjs это не проверка, а общая часть остальных
  [ "$name" = "общее" ] && continue
  if [ -n "$filter" ]; then
    case "$name" in
      *"$filter"*) ;;
      *) continue ;;
    esac
  fi
  printf '── %-16s ' "$name"
  out=$(HTTPS_PROXY= https_proxy= RV_URL="$base" node "$file" 2>&1)
  code=$?
  if [ $code -eq 0 ]; then
    echo "ЧИСТО"
    clean=$((clean + 1))
  else
    echo "ГРЯЗНО"
    echo "$out" | tail -20 | sed 's/^/      /'
    dirty=$((dirty + 1))
    list="$list $name"
  fi
done

[ "$own" != "0" ] && kill "$own" 2>/dev/null
[ "$own_closed" != "0" ] && kill "$own_closed" 2>/dev/null

echo
echo "чистых $clean, грязных $dirty"
if [ $dirty -gt 0 ]; then
  echo "грязные:$list"
  exit 1
fi
exit 0
