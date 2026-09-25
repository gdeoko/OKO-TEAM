#!/bin/bash
# Ежедневная копия AMBERRY. Ставится в /usr/local/sbin/amberry-backup.sh,
# запускает amberry-backup.timer (03:00).
#
# ТОЛЬКО НА СВОЁМ СЕРВЕРЕ: в базах персональные данные клиентов и их
# оплаты, наружу копии не уходят.
#
# НА ДРУГОМ ДИСКЕ. До 25.09.2026 копии лежали на том же NVMe, что и
# сама база: отказ одного диска уносил и базу, и все её копии. Теперь
# они на втором NVMe (/data). Второй диск не смонтирован - пишем по
# старинке на первый и громко жалуемся: копия лучше, чем никакой.
#
# Что копируется:
#   базы        основная и каждой копии партнёра, через sqlite3 .backup
#               (cp горячей базы может выйти нецелостным), сжатые, 30 дней
#   снимки      весь /srv/amberry (работы, каталог, документы, опоры) -
#               rsync с --link-dest: неизменившийся файл в новом снимке -
#               жёсткая ссылка, место занимает только разница; 14 дней
#   настройки   /etc/amberry.env и env партнёров - только root, 30 дней
set -u
# ИМЕНА ПЕРЕМЕННЫХ ЛАТИНИЦЕЙ: bash не считает кириллицу
# идентификатором и молча идёт дальше с пустым значением (25.09.2026
# первая версия этого скрипта «успешно» не сняла ни одной базы).
SRC=/srv/amberry
if mountpoint -q /data; then
  DIR=/data/backups
else
  DIR=/srv/amberry/backups
  logger -t amberry-backup "ВНИМАНИЕ: /data не смонтирован, копия на системный диск"
fi
DAY=$(date +%Y-%m-%d)
mkdir -p "$DIR/базы" "$DIR/снимки" "$DIR/настройки"

# Место проверяем ДО: копия не имеет права остановить бота, а на
# системном диске при переполнении SQLite перестаёт писать.
FREE=$(df --output=avail -m "$DIR" | tail -1 | tr -d " ")
if [ "$FREE" -lt 4096 ]; then
  logger -t amberry-backup "мало места (${FREE}М) - копия не снимается"
  exit 0
fi

ERRS=0
backup_db() {  # $1 - база, $2 - имя копии
  [ -f "$1" ] || return 0
  if sqlite3 "$1" ".backup '$DIR/базы/$2-$DAY.db'" && gzip -f "$DIR/базы/$2-$DAY.db"; then
    return 0
  fi
  ERRS=$((ERRS+1)); logger -t amberry-backup "не снялась база $1"
}
backup_db "$SRC/amberry.db" amberry
for P in "$SRC"/partners/*/amberry.db; do
  [ -f "$P" ] || continue
  ID=$(basename "$(dirname "$P")")
  backup_db "$P" "partner-$ID"
done

# Снимок всего каталога данных. Базы в нём - горячие и могут быть
# нецелостны, поэтому выше они сняты отдельно и правильно.
PREV=$(ls -1d "$DIR"/снимки/20* 2>/dev/null | tail -1)
rsync -a --delete ${PREV:+--link-dest="$PREV"} \
      --exclude 'backups/' --exclude '*.db-wal' --exclude '*.db-shm' \
      "$SRC/" "$DIR/снимки/$DAY/" || { ERRS=$((ERRS+1)); logger -t amberry-backup "снимок не снялся"; }

# Настройки с ключами: только root.
tar -czf "$DIR/настройки/env-$DAY.tgz" /etc/amberry.env /etc/amberry /etc/amberry-card.env 2>/dev/null
chmod 600 "$DIR/настройки/env-$DAY.tgz"

find "$DIR/базы" -name "*.db.gz" -mtime +30 -delete
find "$DIR/настройки" -name "env-*.tgz" -mtime +30 -delete
find "$DIR/снимки" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
chown -R amberry:amberry "$DIR/базы" "$DIR/снимки"
chown -R root:root "$DIR/настройки"; chmod 700 "$DIR/настройки"

if [ "$ERRS" -gt 0 ]; then
  logger -t amberry-backup "копия за $DAY снята с ошибками: $ERRS"
  exit 1
fi
logger -t amberry-backup "копия за $DAY снята в $DIR"
