#!/bin/bash
# Выкладка приложения Rocket VPN на боевой сервер.
#
#   bash выложить.sh           выложить только изменённые файлы
#   bash выложить.sh --всё     выложить весь каталог заново
#   bash выложить.sh --проверить  только показать, что поедет
#   bash выложить.sh --только vendor ассеты
#                              выложить заранее только файлы из этих
#                              папок (тяжёлые текстуры и библиотеку):
#                              страница на сервере их не трогает, пока
#                              не приедет новый index.html
#
# Кладёт содержимое каталога «планета» в /var/www/rocketvpn-app на
# 217.19.122.132, откуда nginx отдаёт его по адресу /app/.
#
# Дорога та же, что у выкладки сайта, и по той же причине: из облачной
# сессии боевой хост напрямую недоступен, всё идёт через мост VPS, а
# мост принимает только текст. Архив едет кусками в base64.
#
# ── ЕДЕТ ТОЛЬКО РАЗНИЦА ─────────────────────────────────────────────
# С 3D-миром каталог вырос до четырёх мегабайт: three.js, небо, космос,
# облака, карты Земли. Мост берёт куски по 8 КБ, и полный архив шёл
# бы десять минут на каждую правку одной строки стиля. Поэтому сначала
# сверяются суммы файлов здесь и на сервере, и в архив идёт только то,
# что отличается. Правка стиля едет за секунды, текстуры - один раз.
#
# ── КУСКИ ЕДУТ ПАРАЛЛЕЛЬНО ──────────────────────────────────────────
# Каждый кусок пишется в свой файл, шесть сразу, и склеивается на месте
# по порядку имён. Дописывание в один файл требовало строгой очереди.
#
# ГЛАВНОЕ: после сборки кусков сверяется контрольная сумма. Однажды
# архив приехал ПОБИТЫМ при совпадающем размере, tar на той стороне не
# распаковался, а выкладка отрапортовала успех. Молчаливую порчу ловит
# только сумма.
set -e
cd "$(dirname "$0")"
# Имена переменных оболочки латиницей: bash не принимает кириллицу в
# именах и молча читает «ВСЁ=0» как вызов несуществующей команды.

V=/tmp/cab/v.sh
[ -x "$V" ] || { echo "нет моста $V"; exit 1; }
ALL=0; [ "${1:-}" = "--всё" ] && ALL=1
DRY=0; [ "${1:-}" = "--проверить" ] && DRY=1
ONLY=""; if [ "${1:-}" = "--только" ]; then shift; ONLY="$*"; fi

STAMP=$(date +%s)
WORK=/tmp/rvapp-$STAMP
mkdir -p "$WORK"

# Суммы здесь.
( cd планета && find . -type f ! -name '.*' -print0 | sort -z | xargs -0 md5sum ) > "$WORK/здесь.txt"

# Суммы там.
if [ "$ALL" = 0 ]; then
  bash вэб.sh 'cd /var/www/rocketvpn-app 2>/dev/null && find . -type f -print0 | sort -z | xargs -0 md5sum' \
    > "$WORK/там.txt" 2>/dev/null || true
else
  : > "$WORK/там.txt"
fi

ONLY="$ONLY" python3 - "$WORK/здесь.txt" "$WORK/там.txt" "$WORK/список.txt" <<'PY'
import sys, os
def читать(п):
    д = {}
    for стр in open(п, encoding="utf-8", errors="replace"):
        стр = стр.rstrip("\n")
        if len(стр) > 34 and стр[32:34] == "  ":
            д[стр[34:]] = стр[:32]
    return д
здесь, там = читать(sys.argv[1]), читать(sys.argv[2])
иначе = [ф for ф, с in здесь.items() if там.get(ф) != с]
только = os.environ.get("ONLY", "").split()
if только:
    иначе = [ф for ф in иначе if any(ф.startswith("./" + п.strip("./") + "/") for п in только)]
open(sys.argv[3], "w", encoding="utf-8").write("\n".join(иначе) + ("\n" if иначе else ""))
print("файлов здесь %d, на сервере %d, поедет %d" % (len(здесь), len(там), len(иначе)))
for ф in иначе[:40]:
    print("  ", ф)
if len(иначе) > 40:
    print("   ... и ещё", len(иначе) - 40)
PY

if [ "$DRY" = 1 ]; then rm -rf "$WORK"; echo "сухой прогон: ничего не выложено"; exit 0; fi

if [ ! -s "$WORK/список.txt" ]; then
  echo "на сервере всё то же самое, выкладывать нечего"
  rm -rf "$WORK"; exit 0
fi

ARC=$WORK/пакет.tgz
tar czf "$ARC" -C планета -T "$WORK/список.txt"
MINE=$(md5sum "$ARC" | awk '{print $1}')
echo "архив $(wc -c < "$ARC") байт, сумма $MINE"

DST=/tmp/rvapp-$STAMP.tgz
CH=$WORK/куски
mkdir -p "$CH"

# Размер куска 8000 замерен, а не взят с потолка: на 12000 мост отдаёт
# пятисотую от nginx, тело запроса перестаёт пролезать.
python3 - "$ARC" "$CH" <<'PY'
import base64, sys, os
b = base64.b64encode(open(sys.argv[1], "rb").read()).decode()
ШАГ = 8000
for i in range(0, len(b), ШАГ):
    open(os.path.join(sys.argv[2], "%05d" % (i // ШАГ)), "w").write(b[i:i + ШАГ])
PY
N=$(ls "$CH" | wc -l)
echo "кусков: $N"

ok=0
for try_n in 1 2 3; do
  "$V" "rm -rf $DST.d && mkdir -p $DST.d" >/dev/null
  ls "$CH" | xargs -P 6 -I{} bash -c '"$0" "printf %s '"'"'$(cat "$1/{}")'"'"' > $2.d/{}" >/dev/null' "$V" "$CH" "$DST"
  THERE=$("$V" "cat $DST.d/* | base64 -d > $DST && md5sum $DST" | awk '{print $1}' | tr -d ' \n')
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
sshpass -p "$PW" ssh -o StrictHostKeyChecking=no ubuntu@217.19.122.132 "sudo mkdir -p /var/www/rocketvpn-app && sudo tar xzf /tmp/app-'"$STAMP"'.tgz -C /var/www/rocketvpn-app && sudo chown -R www-data:www-data /var/www/rocketvpn-app && rm -f /tmp/app-'"$STAMP"'.tgz && echo распаковано" 2>&1 | tail -3'

"$V" "rm -rf $DST $DST.d" >/dev/null
rm -rf "$WORK"
echo "выложено в /var/www/rocketvpn-app"
