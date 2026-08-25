#!/bin/bash
# Проверка перед любой приёмкой: то ли мы вообще меряем.
#
# Контейнер этой сессии дважды откатывал рабочий каталог на старый
# коммит. Файлы, написанные за заход, исчезали, а сайт на диске
# оставался прежним - и приёмка честно мерила ПРОШЛУЮ сборку, выдавая
# результат за нынешнюю. Один раз я из-за этого приняла откат за
# дефект рубки и полезла его чинить.
#
# Ловится это одной строкой: местная голова обязана совпадать с
# серверной, а ключевые файлы захода - лежать на диске.
set -e
cd "$(dirname "$0")/.."
BR=$(git rev-parse --abbrev-ref HEAD)
git fetch origin "$BR" >/dev/null 2>&1 || true
MINE=$(git rev-parse HEAD)
THERE=$(git rev-parse "origin/$BR" 2>/dev/null || echo "")
if [ -n "$THERE" ] && [ "$MINE" != "$THERE" ]; then
  echo "РАСХОЖДЕНИЕ: местная голова $(git log --oneline -1 --format=%h)"
  echo "             серверная      $(git log --oneline -1 --format=%h "origin/$BR")"
  echo "Каталог откатился. Восстановить:"
  echo "  git stash push -u -m otkat && git merge --ff-only origin/$BR"
  exit 1
fi
MISS=0
for f in assets/rc-deck.js assets/gen/cab/deck.js assets/gen/cab/flat.js \
         assets/gen/cockpit-wide-hd.webp assets/gen/cockpit-mid-hd.webp \
         assets/gen/cockpit-tall-hd.webp assets/gen/deep-sky.webp; do
  [ -f "$f" ] || { echo "НЕТ ФАЙЛА: $f"; MISS=1; }
done
[ "$MISS" = 0 ] || exit 1
echo "состояние в порядке: $(git log --oneline -1)"
