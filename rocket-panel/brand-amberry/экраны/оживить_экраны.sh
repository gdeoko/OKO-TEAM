#!/usr/bin/env bash
#
# ОЖИВИТЬ ОБЛОЖКИ РАЗДЕЛОВ. Запускается НА СЕРВЕРЕ БОТА.
#
#   оживить_экраны.sh buy unlim fr ref cab
#
# Берёт /srv/amberry/экраны/<ключ>.jpg, отдаёт карте по туннелю
# панели, ждёт ролик, замыкает его в петлю и кладёт рядом как
# <ключ>.mp4. Бот показывает mp4, если он есть, и jpg, если нет, -
# поэтому падение на любом шаге оставляет раздел с картинкой, а не
# пустым.
#
# По туннелю, а не по ssh на под: подовые порты Vast меняются от
# пересоздания к пересозданию, а туннель держится сам.
#
# Имена переменных латиницей: bash читает `ОТВЕТ=...` как имя команды
# и идёт дальше с пустой переменной, не падая.
set -u

. /etc/amberry.env
AUTH="$ROCKET_GPU_USER:$ROCKET_GPU_PASS"
BASE="$ROCKET_GPU_URL"
DIR=/srv/amberry/экраны

# Движение нарочно скучное и одинаковое для всех карточек: обложку
# видят при каждом заходе в раздел. Всё, что бросается в глаза, на
# третий раз раздражает. Предметы раздела живут, героиня дышит,
# надпись и логотип стоят намертво.
MOTION="cinematic looping motion of a neon night studio scene. The vertical neon tubes in the background pulse and flicker very gently, their magenta glow breathing slowly brighter and dimmer. Thin haze drifts slowly through the light beams. On the wet mirror floor the reflections shimmer and fine concentric ripples spread outward and fade. The glowing objects and particles around the woman drift and float slowly and continuously. The woman stays exactly where she is and keeps her pose and her gesture: only a soft natural breath, a slow blink of her heavily made up lashes, a few strands of her long blonde hair stirring slightly, and the faintest shift of her glossy smile. Her makeup stays exactly as it is. The neon sign text and the berry logo stay perfectly still, sharp and unchanged. Camera locked off, no zoom, no pan. Photorealistic, stable facial features, smooth continuous motion"

NEG="text changing, letters morphing, garbled text, logo deforming, camera movement, zoom, pan, person walking, large body movement, changing pose, blurry, distorted face, makeup smearing, melting eyeliner, extra limbs, deformed hands, morphing, flickering artifacts, duplicate person, warped anatomy"

for KEY in "$@"; do
  SRC="$DIR/$KEY.jpg"
  if [ ! -f "$SRC" ]; then echo "$KEY: нет кадра, пропускаю"; continue; fi

  NAME=$(curl -s --max-time 180 -u "$AUTH" \
    -F "file=@$SRC;filename=$KEY.jpg" "$BASE/api/upload" |
    python3 -c "import sys,json;print(json.load(sys.stdin).get('name',''))" 2>/dev/null)
  if [ -z "$NAME" ]; then echo "$KEY: кадр не залился"; continue; fi

  python3 - "$NAME" "$MOTION" "$NEG" > /tmp/z_$KEY.json <<'P'
import json, sys
print(json.dumps({"mode": "video", "secs": 5, "size": "horiz",
                  "seed": 202509, "images": [sys.argv[1]],
                  "сэмплер": "euler_ancestral", "планировщик": "beta",
                  "prompt": sys.argv[2], "neg": sys.argv[3]},
                 ensure_ascii=False))
P

  JID=$(curl -s --max-time 180 -u "$AUTH" -H 'Content-Type: application/json' \
    --data-binary @/tmp/z_$KEY.json "$BASE/api/gen" |
    python3 -c "import sys,json;print(json.load(sys.stdin).get('job',''))" 2>/dev/null)
  if [ -z "$JID" ]; then echo "$KEY: задание не создалось"; continue; fi
  echo "$KEY: задание $JID"

  VID=""
  N=0
  while [ $N -lt 100 ]; do
    sleep 10; N=$((N+1))
    R=$(curl -s --max-time 40 -u "$AUTH" "$BASE/api/job/$JID" 2>/dev/null)
    # Туннель иногда отдаёт пустоту - это повод спросить ещё раз, а не
    # падать.
    case "$R" in '{'*) : ;; *) continue ;; esac
    ST=$(printf '%s' "$R" | python3 -c "
import sys,json
try: print(json.load(sys.stdin).get('state',''))
except Exception: print('')")
    if [ "$ST" = "ok" ]; then
      VID=$(printf '%s' "$R" | python3 -c "
import sys,json;print((json.load(sys.stdin).get('files') or [''])[0])")
      break
    fi
    if [ "$ST" = "err" ] || [ "$ST" = "error" ]; then
      echo "$KEY: ОШИБКА карты"; break
    fi
  done
  [ -n "$VID" ] || { echo "$KEY: ролик не получен"; continue; }

  curl -s --max-time 300 -u "$AUTH" -o "/tmp/$KEY.raw.mp4" "$BASE/file/$VID"

  # Петля сборкой, а не моделью: Wan не умеет замкнуть ролик сам, и
  # просьба словами даёт рывок на стыке. Копия задом наперёд клеится
  # следом - последний кадр петли он же первый.
  #
  # -nostdin ОБЯЗАТЕЛЕН: иначе ffmpeg вычитывает остаток этого скрипта
  # как свой вход, и следующие строки молча исчезают.
  ffmpeg -nostdin -y -v error -i "/tmp/$KEY.raw.mp4" \
    -filter_complex "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]" \
    -map "[v]" -an -c:v libx264 -pix_fmt yuv420p -crf 20 \
    -movflags +faststart "$DIR/$KEY.mp4"
  chown amberry:amberry "$DIR/$KEY.mp4"
  echo "$KEY: готово, $(stat -c%s "$DIR/$KEY.mp4") байт"
done
