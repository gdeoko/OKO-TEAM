#!/bin/bash
# ВЫКЛАДКА ОДНОГО ФАЙЛА НА БОЕВОЙ СЕРВЕР.
#
# Точечно и осознанно: на сервере может работать другая сессия, поэтому целиком
# каталоги не синхронизируем. Перед заменой скрипт сверяет, совпадает ли то, что
# лежит на сервере, с тем, от чего мы отталкивались (git HEAD), и делает копию.
#
#   scripts/push_file.sh core/ministries.php
#   scripts/push_file.sh core/ministries.php force   — заменить, даже если на
#                                                      сервере файл кто-то менял
set -eu
REL="${1:?путь относительно muzmir-site, например core/ministries.php}"
FORCE="${2:-}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$REPO/.." && pwd)"
source <(base64 -d "$ROOT/secrets.env.b64") 2>/dev/null

vexec() {
  curl -s --cacert /root/.ccr/ca-bundle.crt -m 180 -X POST "$OKO_POSTER_URL" \
    -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
    --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1")" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""),end="");sys.stderr.write(d.get("stderr",""))'
}
mm() {
  vexec "sshpass -p '$MUZMIR_ROOT_PW' ssh -T -o StrictHostKeyChecking=no -o LogLevel=ERROR -o ConnectTimeout=20 root@$MUZMIR_SERVER_IP $(python3 -c 'import shlex,sys;print(shlex.quote("cd /var/www/muzmir && "+sys.argv[1]))' "$1")"
}

BASE=$(cd "$ROOT" && git show "HEAD:muzmir-site/$REL" 2>/dev/null | md5sum | cut -d' ' -f1 || echo none)
NOW=$(mm "md5sum $REL 2>/dev/null | cut -d' ' -f1" | tr -d '\r\n ')
if [ "$NOW" != "$BASE" ] && [ "$FORCE" != "force" ]; then
  echo "СТОП: на сервере $REL отличается от того, от чего мы отталкивались."
  echo "  на сервере: $NOW"
  echo "  ожидали:    $BASE"
  echo "Скорее всего файл правила другая сессия. Разберитесь и запустите с 'force'."
  exit 1
fi

# ИМЯ ВРЕМЕННОГО ФАЙЛА — РАЗНОЕ ДЛЯ КАЖДОЙ ВЫКЛАДКИ.
#
# Здесь стояло общее /tmp/push_one.tmp — и на мосту, и на боевом сервере. Пока
# выкладка одна, это работает; стоит двум пойти внахлёст (или одной подвиснуть на
# минуту), и второй файл затирает первый ровно между «положили» и «скопировали».
# Так личный кабинет получил содержимое консольного скрипта проверки рассылки:
# страница /cabinet падала с «Undefined constant STDERR», а участник видел
# «страница недоступна». Уникальное имя убирает саму возможность такой подмены,
# а проверка md5 после доставки ловит порчу файла в пути.
TMP="/tmp/push_$$_$(date +%s%N | tail -c 7).tmp"
WANT=$(md5sum "$REPO/$REL" | cut -d' ' -f1)

# ПЕРЕДАЁМ ЧАСТЯМИ. Файл едет на мост аргументом команды, а длина аргументов
# ограничена: на файле в 60 КБ python на той стороне падает с «Argument list too
# long», и раньше это выглядело как молчаливо неудавшаяся выкладка. Режем base64
# на куски по 24 000 символов и дописываем — размер файла перестаёт быть преградой.
B64FILE="$TMP.b64"
base64 -w0 "$REPO/$REL" > "$B64FILE"
vexec "rm -f $TMP.part" >/dev/null
split -b 24000 "$B64FILE" "$B64FILE.chunk."
for CH in "$B64FILE".chunk.*; do
  vexec "printf %s '$(cat "$CH")' >> $TMP.part" >/dev/null
done
rm -f "$B64FILE" "$B64FILE".chunk.*
vexec "base64 -d $TMP.part > $TMP && rm -f $TMP.part && md5sum $TMP | cut -d' ' -f1"
echo "  ожидали md5: $WANT"
vexec "sshpass -p '$MUZMIR_ROOT_PW' scp -o StrictHostKeyChecking=no -o LogLevel=ERROR $TMP root@$MUZMIR_SERVER_IP:$TMP >/dev/null && echo доставлен"
GOT=$(mm "md5sum $TMP | cut -d' ' -f1" | tr -d '\r\n ')
if [ "$GOT" != "$WANT" ]; then
  echo "СТОП: на сервер доехал не тот файл (md5 $GOT вместо $WANT). Ничего не заменяем."
  vexec "rm -f $TMP" >/dev/null 2>&1 || true
  exit 1
fi
# Копию делаем только если там уже что-то лежит: новый файл копировать не с чего.
mm "mkdir -p \$(dirname $REL); [ -f $REL ] && cp -p $REL $REL.bak-\$(date +%Y%m%d-%H%M%S); cp $TMP $REL && chown www-data:www-data $REL && rm -f $TMP && php -l $REL"
vexec "rm -f $TMP" >/dev/null 2>&1 || true
