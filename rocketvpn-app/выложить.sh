#!/bin/bash
# Выкладка экрана приложения Rocket VPN на боевой сервер.
#
#   bash выложить.sh
#
# Кладёт содержимое каталога «планета» в /var/www/rocketvpn-app на
# 217.19.122.132, откуда nginx отдаёт его по адресу /app/.
#
# Дорога та же, что у выкладки сайта, и по той же причине: из облачной
# сессии боевой хост напрямую недоступен, всё идёт через мост VPS, а
# мост принимает только текст. Архив едет кусками в base64.
#
# ГЛАВНОЕ: после сборки кусков сверяется контрольная сумма. Однажды
# архив приехал ПОБИТЫМ при совпадающем размере, tar на той стороне не
# распаковался, а выкладка отрапортовала успех. Молчаливую порчу ловит
# только сумма.
set -e
cd "$(dirname "$0")"

V=/tmp/cab/v.sh
[ -x "$V" ] || { echo "нет моста $V"; exit 1; }

STAMP=$(date +%s)
ARC=/tmp/rvapp-$STAMP.tgz
# Пакуем СОДЕРЖИМОЕ каталога, а не сам каталог: на той стороне он
# распаковывается прямо в корень приложения.
tar czf "$ARC" -C планета .
MINE=$(md5sum "$ARC" | awk '{print $1}')
echo "архив $(wc -c < "$ARC") байт, сумма $MINE"

DST=/tmp/rvapp-$STAMP.tgz
CH=/tmp/cab/appchunks-$STAMP
mkdir -p "$CH"

# Размер куска 8000 замерен, а не взят с потолка: на 12000 мост отдаёт
# пятисотую от nginx, тело запроса перестаёт пролезать.
python3 - "$ARC" "$CH" <<'PY'
import base64, sys, os
b = base64.b64encode(open(sys.argv[1], "rb").read()).decode()
ШАГ = 8000
for i in range(0, len(b), ШАГ):
    open(os.path.join(sys.argv[2], "%04d" % (i // ШАГ)), "w").write(b[i:i + ШАГ])
PY
echo "кусков: $(ls "$CH" | wc -l)"

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

# Пароль боевого сервера живёт в хранилище на VPS и в этот файл НИКОГДА
# не попадает: репозиторий открытый.
"$V" 'VAULT=/opt/oko-poster/cfg/OKO_MASTER_VAULT.md
PW=$(grep -m1 -E "^\| *Вход *\| *ubuntu */" "$VAULT" | sed -E "s#.*ubuntu */ *([^ (|]+).*#\1#")
[ -n "$PW" ] || { echo "НЕ ВЫЛОЖЕНО: пароль не найден в хранилище"; exit 1; }
cd /tmp && sshpass -p "$PW" scp -o StrictHostKeyChecking=no rvapp-'"$STAMP"'.tgz ubuntu@217.19.122.132:/tmp/app-'"$STAMP"'.tgz 2>&1 | tail -1
sshpass -p "$PW" ssh -o StrictHostKeyChecking=no ubuntu@217.19.122.132 "sudo mkdir -p /var/www/rocketvpn-app && sudo tar xzf /tmp/app-'"$STAMP"'.tgz -C /var/www/rocketvpn-app && sudo chown -R www-data:www-data /var/www/rocketvpn-app && rm -f /tmp/app-'"$STAMP"'.tgz && ls /var/www/rocketvpn-app" 2>&1 | tail -6'

"$V" "rm -f $DST $DST.b64" >/dev/null
rm -rf "$CH" "$ARC"
echo "выложено в /var/www/rocketvpn-app"
