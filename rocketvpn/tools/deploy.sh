#!/bin/bash
# Выкладка файлов сайта Rocket VPN на боевой сервер через мост VPS.
#
#   bash tools/deploy.sh assets/gen/корабль.glb assets/rv.css
#
# Тот же ход, что у соседнего сайта, и отдельный файл намеренно: корень
# на боевом другой, и одна общая выкладка с ключом «куда» ошибётся
# ровно один раз, зато дорого - файлы одного сайта уедут в другой.
#
# Почему не одной командой scp: из облачной сессии боевой хост
# напрямую недоступен, всё идёт через мост vexec на VPS. Мост
# принимает только текст, поэтому архив едет кусками в base64.
#
# ГЛАВНОЕ: после сборки кусков сверяется контрольная сумма. Один раз
# архив приехал ПОБИТЫМ при совпадающем размере, tar на боевом
# сервере не распаковался, а выкладка отрапортовала успех - правка
# просто не доехала. Молчаливую порчу ловит только сумма.
set -e
cd "$(dirname "$0")/.."
[ $# -gt 0 ] || { echo "нечего выкладывать"; exit 1; }

V=/tmp/cab/v.sh
[ -x "$V" ] || { echo "нет моста $V"; exit 1; }

STAMP=$(date +%s)
ARC=/tmp/cab/dep-$STAMP.tgz
tar czf "$ARC" "$@"
MINE=$(md5sum "$ARC" | awk '{print $1}')
echo "архив $(wc -c < "$ARC") байт, сумма $MINE"

DST=/opt/oko-poster/cab/dep-$STAMP.tgz
CH=/tmp/cab/chunks-$STAMP
mkdir -p "$CH"

python3 - "$ARC" "$CH" <<'PY'
import base64, sys, os
b = base64.b64encode(open(sys.argv[1], "rb").read()).decode()
for i in range(0, len(b), 30000):
    open(os.path.join(sys.argv[2], "%04d" % (i // 30000)), "w").write(b[i:i + 30000])
PY

ok=0
for try_n in 1 2 3; do
  "$V" "rm -f $DST.b64" >/dev/null
  for c in $(ls "$CH"/* | sort); do
    "$V" "printf '%s' '$(cat "$c")' >> $DST.b64" >/dev/null
  done
  THERE=$("$V" "base64 -d $DST.b64 > $DST && md5sum $DST" | awk '{print $1}' | tr -d ' \n')
  if [ "$MINE" = "$THERE" ]; then ok=1; echo "сумма сошлась с попытки $try_n"; break; fi
  echo "попытка $try_n: сумма разошлась ($THERE), заливаю заново"
done
[ "$ok" = 1 ] || { echo "НЕ ВЫЛОЖЕНО: архив не доехал целым"; exit 1; }

# Пароль боевого сервера живёт в хранилище на VPS и НИКОГДА не попадает
# в этот файл: репозиторий открытый, и однажды он тут уже лежал открытым
# текстом. Мост читает строку "Вход | ubuntu / ..." из мастер-хранилища
# прямо в момент выкладки.
"$V" 'VAULT=/opt/oko-poster/cfg/OKO_MASTER_VAULT.md; PW=$(grep -m1 -E "^\| *Вход *\| *ubuntu */" "$VAULT" | sed -E "s#.*ubuntu */ *([^ (|]+).*#\\1#"); [ -n "$PW" ] || { echo "НЕ ВЫЛОЖЕНО: пароль не найден в хранилище"; exit 1; }; cd /opt/oko-poster/cab && sshpass -p "$PW" scp -o StrictHostKeyChecking=no dep-'"$STAMP"'.tgz ubuntu@217.19.122.132:/tmp/ 2>&1 | tail -1; sshpass -p "$PW" ssh -o StrictHostKeyChecking=no ubuntu@217.19.122.132 "sudo tar xzf /tmp/dep-'"$STAMP"'.tgz -C /var/www/rocketvpn && ls -la /var/www/rocketvpn/assets/gen 2>&1 | tail -3" 2>&1 | tail -2'
"$V" "rm -f $DST $DST.b64" >/dev/null
rm -rf "$CH" "$ARC"
echo "выложено: $*"
