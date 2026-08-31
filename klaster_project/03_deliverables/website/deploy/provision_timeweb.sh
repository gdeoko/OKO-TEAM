#!/usr/bin/env bash
# ============================================================================
# Создание сервера в Timeweb Cloud под сайт «Кластер» (ООО «Активити»)
# Конфигурация: 2 vCPU / 4 ГБ RAM / 30 ГБ NVMe / Ubuntu 24.04 LTS / Москва (ru-3)
# Ориентировочная стоимость: ~1580 ₽/мес (CPU 210₽×2 + RAM 200₽×4 + диск 12₽×30)
#
# ЗАПУСК:
#   export TW_TOKEN='<API-токен Timeweb Cloud>'
#   bash provision_timeweb.sh
#
# ТРЕБОВАНИЕ: на балансе Timeweb должны быть средства, иначе API вернёт отказ.
# ============================================================================
set -euo pipefail

API="https://api.timeweb.cloud/api/v1"
TOKEN="${TW_TOKEN:?Задайте TW_TOKEN — API-токен Timeweb Cloud}"
AUTH="Authorization: Bearer ${TOKEN}"
JSON="Content-Type: application/json"

SERVER_NAME="${SERVER_NAME:-klaster-oko}"
PROJECT_ID="${PROJECT_ID:-2799661}"   # проект «АКТИВИТИ»
CONFIGURATOR_ID=31                    # ru-3 Москва, NVMe, 3.3 ГГц
OS_ID=99                              # Ubuntu 24.04 noble
CPU=2
RAM=4096                              # МБ
DISK=30720                            # МБ = 30 ГБ
BANDWIDTH=1000

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# --- 0. Проверка баланса -----------------------------------------------------
say "Проверяю баланс…"
BAL=$(curl -sS -H "$AUTH" "$API/account/finances")
echo "$BAL" | grep -oE '"balance":[0-9.-]+' || true
if echo "$BAL" | grep -qE '"balance":0(\.0+)?,'; then
  echo "ВНИМАНИЕ: баланс нулевой. Пополните счёт, иначе создание сервера будет отклонено."
  read -r -p "Продолжить всё равно? [y/N] " a; [ "$a" = "y" ] || exit 1
fi

# --- 1. SSH-ключ -------------------------------------------------------------
KEY_PATH="${KEY_PATH:-$HOME/.ssh/klaster_ed25519}"
if [ ! -f "$KEY_PATH" ]; then
  say "Генерирую SSH-ключ ${KEY_PATH}…"
  ssh-keygen -t ed25519 -N "" -C "oko-klaster-deploy" -f "$KEY_PATH"
fi
PUBKEY=$(cat "${KEY_PATH}.pub")

say "Загружаю SSH-ключ в Timeweb…"
KEY_RESP=$(curl -sS -X POST -H "$AUTH" -H "$JSON" \
  -d "$(printf '{"name":"oko-klaster-deploy","body":%s,"is_default":true}' "$(printf '%s' "$PUBKEY" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read().strip()))')")" \
  "$API/ssh-keys")
SSH_KEY_ID=$(echo "$KEY_RESP" | grep -oE '"id":[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
echo "ssh_key_id=${SSH_KEY_ID:-<не создан, возможно уже существует>}"

# --- 2. Создание сервера -----------------------------------------------------
say "Создаю сервер ${SERVER_NAME} (${CPU} vCPU / $((RAM/1024)) ГБ / $((DISK/1024)) ГБ, Москва)…"
CREATE_BODY=$(cat <<EOF
{
  "name": "${SERVER_NAME}",
  "comment": "Bizness-park Klaster / OOO Aktiviti — sait + bot + avtomatizacii (OKO TEAM)",
  "os_id": ${OS_ID},
  "project_id": ${PROJECT_ID},
  "configuration": {
    "configurator_id": ${CONFIGURATOR_ID},
    "cpu": ${CPU},
    "ram": ${RAM},
    "disk": ${DISK}
  },
  "bandwidth": ${BANDWIDTH},
  "is_ddos_guard": false,
  "is_local_network": false$( [ -n "${SSH_KEY_ID:-}" ] && printf ',\n  "ssh_keys_ids": [%s]' "$SSH_KEY_ID" )
}
EOF
)
RESP=$(curl -sS -X POST -H "$AUTH" -H "$JSON" -d "$CREATE_BODY" "$API/servers")
echo "$RESP" | head -c 900; echo

SERVER_ID=$(echo "$RESP" | grep -oE '"id":[0-9]+' | head -1 | grep -oE '[0-9]+' || true)
if [ -z "$SERVER_ID" ]; then
  echo "Сервер не создан. Ответ API выше — чаще всего причина в нулевом балансе."
  exit 1
fi
echo "server_id=${SERVER_ID}"

# --- 3. Ожидание готовности и получение IP -----------------------------------
say "Жду, пока сервер поднимется…"
IP=""
for i in $(seq 1 60); do
  S=$(curl -sS -H "$AUTH" "$API/servers/${SERVER_ID}")
  ST=$(echo "$S" | grep -oE '"status":"[a-z_]+"' | head -1 | cut -d'"' -f4)
  IP=$(echo "$S" | grep -oE '"ip":"[0-9.]+"' | head -1 | cut -d'"' -f4 || true)
  printf '  [%02d] статус=%s ip=%s\n' "$i" "${ST:-?}" "${IP:-—}"
  [ "$ST" = "on" ] && [ -n "$IP" ] && break
  sleep 10
done
[ -n "$IP" ] || { echo "IP не получен, проверьте панель Timeweb."; exit 1; }

say "ГОТОВО"
cat <<EOF
  server_id : ${SERVER_ID}
  IP        : ${IP}
  SSH       : ssh -i ${KEY_PATH} root@${IP}

СЛЕДУЮЩИЕ ШАГИ
  1) DNS у регистратора домена clusterspace.ru (nic.ru):
       A   @     ${IP}
       A   www   ${IP}
  2) Настройка сервера (nginx + PHP + SSL + сайт):
       scp -i ${KEY_PATH} bootstrap_server.sh root@${IP}:/root/
       ssh -i ${KEY_PATH} root@${IP} 'bash /root/bootstrap_server.sh clusterspace.ru'
  3) Залить сайт:
       bash push_site.sh ${IP}
EOF
