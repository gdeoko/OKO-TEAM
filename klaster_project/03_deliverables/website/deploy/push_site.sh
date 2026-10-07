#!/usr/bin/env bash
# ============================================================================
# Заливка сайта «Кластер» на сервер
#   bash push_site.sh <IP-сервера> [домен]
# ============================================================================
set -euo pipefail

IP="${1:?Укажите IP сервера}"
DOMAIN="${2:-clusterspace.ru}"
KEY_PATH="${KEY_PATH:-$HOME/.ssh/klaster_ed25519}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"     # каталог website/
WEBROOT="/var/www/${DOMAIN}"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

say "Синхронизация ${SRC} -> ${IP}:${WEBROOT}"
rsync -avz --delete \
  -e "ssh -i ${KEY_PATH} -o StrictHostKeyChecking=accept-new" \
  --exclude 'deploy/' \
  --exclude '*.md' \
  --exclude 'preview-standalone.html' \
  "${SRC}/" "root@${IP}:${WEBROOT}/"

say "Права и каталоги под логи заявок"
ssh -i "${KEY_PATH}" "root@${IP}" bash -s <<EOF
set -e
mkdir -p ${WEBROOT}/data ${WEBROOT}/logs
chown -R www-data:www-data ${WEBROOT}
chmod -R 755 ${WEBROOT}
chmod 770 ${WEBROOT}/data ${WEBROOT}/logs
nginx -t && systemctl reload nginx
EOF

say "Проверка"
curl -sS -o /dev/null -w "http://${DOMAIN}  -> %{http_code}\n"  "http://${IP}/"  || true
curl -sS -o /dev/null -w "https://${DOMAIN} -> %{http_code}\n" "https://${DOMAIN}/" || true

say "ГОТОВО. Проверьте форму заявки — она должна прислать сообщение в Telegram."
