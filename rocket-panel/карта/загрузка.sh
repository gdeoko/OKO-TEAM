#!/bin/bash
# Поднять карту AMBERRY из голого образа. Запускается НА КАРТЕ, по ssh с моста.
#
# Всё ценное лежит на отдельном томе `rocket-models` (300 ГБ, Cloud-SSD):
# модели, ComfyUI со своим venv, опоры, эталоны, наши скрипты и файлы
# служб. Корневой диск карты — расходник: на нём нет ничего, чего нельзя
# поставить заново за три минуты.
#
# ИМЕНА ПЕРЕМЕННЫХ ЗДЕСЬ ЛАТИНСКИЕ, И ЭТО НЕ НЕБРЕЖНОСТЬ. bash не умеет
# кириллицу в именах: `nuzhny+=(ffmpeg)` работает, `нужны+=(ffmpeg)` —
# синтаксическая ошибка. В остальных наших файлах (python) кириллица
# допустима, здесь нет.
#
# Скрипт обязан быть ПОВТОРЯЕМЫМ: его гоняют и на свежей машине, и на
# живой, и на недоделанной после обрыва связи. Каждый шаг проверяет,
# сделан ли он уже.
set -euo pipefail
PANEL_PASS="${PANEL_PASS:-rocket}"

echo "=== том"
if ! mountpoint -q /data; then
  # Диск тома приезжает под разными именами (vdb/vdc) в зависимости от
  # порядка подключения — ищем по размеру и файловой системе, а не по
  # имени. Ошибиться тут значит отформатировать чужой диск.
  VOL=""
  for d in /dev/vd? /dev/sd?; do
    [ -b "$d" ] || continue
    # sudo ОБЯЗАТЕЛЕН. Без root blkid читает только кэш
    # /run/blkid/blkid.tab, а том, подключённый к уже работающей
    # машине, в этот кэш не попадает: он там появляется, только если
    # диск был на месте при загрузке. Поймано 24.09.2026 на возврате
    # тома: lsblk диск видит, blkid молчит, скрипт говорит «тома нет».
    sudo blkid "$d" 2>/dev/null | grep -q 'TYPE="ext4"' || continue
    [ "$(lsblk -no SIZE "$d" | head -1 | tr -d ' ')" = "300G" ] || continue
    VOL="$d"
  done
  [ -n "$VOL" ] || { echo "ТОМ НЕ НАЙДЕН — подключён ли rocket-models?"; exit 1; }
  sudo mkdir -p /data
  sudo mount "$VOL" /data
  grep -q "^$VOL /data" /etc/fstab || echo "$VOL /data ext4 defaults,nofail 0 2" | sudo tee -a /etc/fstab >/dev/null
fi
mountpoint -q /data || { echo "ТОМ НЕ ПОДНЯЛСЯ"; exit 1; }
df -h /data | tail -1

echo "=== ссылки"
ln -sfn /data/ComfyUI /home/ubuntu/ComfyUI
for d in ПОЗЫ ГЛУБИНА ЭТАЛОНЫ; do ln -sfn "/data/карта/$d" "/home/ubuntu/$d"; done
for f in /data/карта/скрипты/*; do ln -sfn "$f" "/home/ubuntu/$(basename "$f")"; done

echo "=== пакеты"
NEED=()
command -v ffmpeg >/dev/null || NEED+=(ffmpeg)
command -v caddy  >/dev/null || NEED+=(caddy)
if [ ${#NEED[@]} -gt 0 ]; then
  if printf '%s\n' "${NEED[@]}" | grep -qx caddy; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
      | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
      | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  fi
  sudo apt-get update -qq
  sudo apt-get install -y -qq "${NEED[@]}"
fi
if ! command -v cloudflared >/dev/null; then
  curl -sL -o /tmp/cf.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
  sudo dpkg -i /tmp/cf.deb >/dev/null
fi
# ПАКЕТ КЛАДЁТ ДВОИЧНЫЙ ФАЙЛ В /usr/local/bin, А СЛУЖБА ИЩЕТ ЕГО В
# /usr/bin. На нынешней карте он лежит в обоих местах (сложилось
# исторически), поэтому туннель работает и беды не видно. На чистой
# машине есть только /usr/local/bin — служба не стартует, адреса
# наружу нет, бот без генерации. Поймано на пробной машине 24.09.2026.
CF="$(command -v cloudflared)"
[ -x /usr/bin/cloudflared ] || sudo ln -sf "$CF" /usr/bin/cloudflared

echo "=== службы"
sudo mkdir -p /etc/caddy
sudo cp /data/карта/служба/Caddyfile /etc/caddy/Caddyfile
for u in comfyui rocket-panel rocket-tunnel; do
  sudo cp "/data/карта/служба/$u.service" "/etc/systemd/system/$u.service"
done
sudo systemctl daemon-reload
sudo systemctl enable caddy comfyui rocket-panel rocket-tunnel >/dev/null 2>&1 || true
sudo systemctl restart caddy comfyui rocket-panel rocket-tunnel

echo "=== ждём генерацию"
for i in $(seq 1 150); do
  curl -sf -m 2 http://127.0.0.1:8188/system_stats >/dev/null && break
  sleep 2
done
curl -sf -m 2 http://127.0.0.1:8188/system_stats >/dev/null || { echo "COMFYUI НЕ ПОДНЯЛСЯ"; exit 1; }

echo "=== ждём адрес туннеля"
ADDR=""
for i in $(seq 1 60); do
  ADDR=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /home/ubuntu/tunnel.log 2>/dev/null | tail -1 || true)
  [ -n "$ADDR" ] && break
  sleep 2
done
[ -n "$ADDR" ] || { echo "ТУННЕЛЬ НЕ ПОДНЯЛСЯ"; exit 1; }

echo "=== готовность"
curl -s -m 15 -u "rocket:$PANEL_PASS" http://127.0.0.1:8080/api/готовность
echo
echo "АДРЕС=$ADDR"
