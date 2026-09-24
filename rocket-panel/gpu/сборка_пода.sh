#!/bin/bash
# Полная сборка карты одним заходом: пакеты, ComfyUI, модели, службы.
#
# Отдельными шагами это заняло полтора часа, и почти всё время ушло не
# на работу, а на то, чтобы заметить, что очередной шаг молча не
# сработал. Здесь каждый шаг ОБЪЯВЛЯЕТ о себе в журнал, и журнал один.
#
# Скрипт можно запускать повторно: скачанное не качается заново,
# поставленное не ставится.
set -u
PY=/usr/bin/python3
export ROCKET_HOME=/root
BASE=/root/ComfyUI
exec > >(tee -a /root/sborka.log) 2>&1
echo "=== СБОРКА НАЧАЛАСЬ $(date -u +%H:%M:%S)"
nvidia-smi --query-gpu=name,power.limit,memory.total,clocks.max.sm --format=csv,noheader

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq git ffmpeg curl supervisor gnupg debian-keyring debian-archive-keyring apt-transport-https >/dev/null 2>&1
echo "=== пакеты $(date -u +%H:%M:%S)"

[ -d $BASE ] || git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git $BASE
cd $BASE
$PY -m pip install -q --break-system-packages -r requirements.txt >/dev/null 2>&1
$PY -m pip install -q --break-system-packages --ignore-installed blinker flask >/dev/null 2>&1
$PY -m pip install -q --break-system-packages huggingface_hub gguf sentencepiece protobuf >/dev/null 2>&1
$PY -c "import flask, torch; print('flask и torch на месте:', torch.__version__)"
cd $BASE/custom_nodes
[ -d ComfyUI-GGUF ] || git clone --depth 1 https://github.com/city96/ComfyUI-GGUF.git >/dev/null 2>&1
cd $BASE
echo "=== ComfyUI $(date -u +%H:%M:%S)"

$PY /root/weights.py 2>&1 | grep -viE "warning|warnings.warn"
echo "=== модели $(date -u +%H:%M:%S)"

if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null
  echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq >/dev/null 2>&1
  apt-get install -y -qq caddy >/dev/null 2>&1
fi
if ! command -v cloudflared >/dev/null; then
  curl -fsSL -o /usr/local/bin/cloudflared \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x /usr/local/bin/cloudflared
fi
echo "=== caddy и туннель $(date -u +%H:%M:%S)"

HASH=$(caddy hash-password --plaintext "$GPU_PASS" 2>/dev/null)
cat > /etc/caddy/Caddyfile <<CADDY
:8080 {
	basic_auth {
		$GPU_USER $HASH
	}
	request_body {
		max_size 64MB
	}
	reverse_proxy 127.0.0.1:8090 {
		transport http {
			read_timeout 45m
			write_timeout 45m
		}
	}
}
CADDY

mkdir -p /var/log/supervisor
cat > /etc/supervisor/conf.d/amberry.conf <<SUP
[program:comfy]
command=$PY $BASE/main.py --listen 127.0.0.1 --port 8188 --highvram
directory=$BASE
autostart=true
autorestart=true
startsecs=20
stdout_logfile=/var/log/comfy.log
stderr_logfile=/var/log/comfy.log
environment=ROCKET_HOME="/root"

[program:panel]
command=$PY /root/panel.py
directory=/root
autostart=true
autorestart=true
startsecs=5
stdout_logfile=/var/log/panel.log
stderr_logfile=/var/log/panel.log
environment=ROCKET_HOME="/root"

[program:caddy]
command=/usr/bin/caddy run --config /etc/caddy/Caddyfile
autostart=true
autorestart=true
startsecs=5
stdout_logfile=/var/log/caddy.log
stderr_logfile=/var/log/caddy.log

[program:tunnel]
command=/usr/local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8080
autostart=true
autorestart=true
startsecs=5
stdout_logfile=/var/log/tunnel.log
stderr_logfile=/var/log/tunnel.log
SUP

pkill -f supervisord 2>/dev/null
sleep 2
supervisord -c /etc/supervisor/supervisord.conf 2>/dev/null
sleep 10
supervisorctl reread >/dev/null 2>&1
supervisorctl update >/dev/null 2>&1
sleep 5
supervisorctl status
echo "=== СБОРКА ГОТОВА $(date -u +%H:%M:%S)"
df -h / | tail -1
