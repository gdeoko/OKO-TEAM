#!/usr/bin/env bash
# OKO · SessionStart bootstrap — во ВСЕХ чатах (в репо, коммитится).
# 1) секреты, 2) Higgsfield CLI (ставит если нет), 3) авторизация CLI через
#    VPS-брокер hf_token.sh (ротация refresh-токена централизованно на VPS) —
#    CLI работает БЕЗ MCP-коннектора, в т.ч. в Routine-сессиях.
set +e
ROOT="${CLAUDE_PROJECT_DIR:-/home/user/OKO-TEAM}"
cd "$ROOT" 2>/dev/null || cd /home/user/OKO-TEAM

# --- 1. секреты ---
[ -f secrets.env.b64 ] && base64 -d secrets.env.b64 > secrets.env 2>/dev/null
for f in ~/.bashrc ~/.profile; do
  grep -q '# oko-secrets' "$f" 2>/dev/null || \
    echo 'source /home/user/OKO-TEAM/secrets.env 2>/dev/null # oko-secrets' >> "$f"
done
[ -f secrets.env ] && source secrets.env 2>/dev/null

# --- 2. Higgsfield CLI (npm -g), фоном если нет ---
if command -v higgsfield >/dev/null 2>&1 || command -v hf >/dev/null 2>&1; then HF="CLI ✓"
else ( npm install -g @higgsfield/cli >/tmp/hf-cli-install.log 2>&1 & ); HF="CLI ставится…"; fi

# --- 3. авторизация через VPS-брокер (свежий access-токен на сессию) ---
CP="${HIGGSFIELD_CREDENTIALS_PATH:-$HOME/.config/higgsfield/credentials.json}"
WS="${HIGGSFIELD_WORKSPACE_ID:-d7fe59d5-af19-4d33-9753-2735901d0da3}"
if [ -n "${OKO_VPS_CTRL_URL:-}" ] && [ -n "${OKO_VPS_CTRL_TOKEN:-}" ]; then
  CAf=$([ -f /root/.ccr/ca-bundle.crt ] && echo "--cacert /root/.ccr/ca-bundle.crt")
  RESP=$(curl -s $CAf -m 30 -X POST "$OKO_VPS_CTRL_URL/exec" \
    -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN" -H 'Content-Type: application/json' \
    --data-binary '{"cmd":"/opt/oko-poster/hf_token.sh"}' \
    | python3 -c 'import sys,json;print(json.load(sys.stdin).get("stdout",""))' 2>/dev/null)
  AT=$(printf '%s' "$RESP" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("access_token",""))' 2>/dev/null)
  if [ -n "$AT" ]; then
    mkdir -p "$(dirname "$CP")"
    NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    # refresh_token пустой — локальный CLI не ротирует токен VPS
    printf '{"auth_version":2,"access_token":"%s","refresh_token":"","token_type":"bearer","expires_in":86400,"scope":"email profile offline_access user:org:read","created_at":"%s","created_from":"cli","email":"okoteam.top@gmail.com"}' "$AT" "$NOW" > "$CP"
    printf '{"workspace_id":"%s"}' "$WS" > "$(dirname "$CP")/config.json"
    chmod 600 "$CP" "$(dirname "$CP")/config.json" 2>/dev/null
    HF="$HF, auth ✓ (ultra)"
  else HF="$HF, auth ✗ (брокер не ответил)"; fi
else HF="$HF, auth ✗ (нет OKO_VPS_CTRL_*)"; fi

echo "OKO: секреты + паспорт INTEGRATIONS.md · Higgsfield $HF"
exit 0
