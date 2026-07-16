#!/usr/bin/env bash
# OKO · SessionStart bootstrap — работает во ВСЕХ чатах (лежит в репо, коммитится).
# 1) распаковывает секреты, 2) ставит Higgsfield CLI если нет, 3) восстанавливает
#    авторизацию Higgsfield CLI из секрета (чтобы CLI работал БЕЗ MCP-коннектора,
#    в т.ч. в Routine-сессиях). Скиллы higgsfield-* лежат в .claude/skills.
set +e
ROOT="${CLAUDE_PROJECT_DIR:-/home/user/OKO-TEAM}"
cd "$ROOT" 2>/dev/null || cd /home/user/OKO-TEAM

# --- 1. секреты ---
[ -f secrets.env.b64 ] && base64 -d secrets.env.b64 > secrets.env 2>/dev/null
for f in ~/.bashrc ~/.profile; do
  grep -q '# oko-secrets' "$f" 2>/dev/null || \
    echo 'source /home/user/OKO-TEAM/secrets.env 2>/dev/null # oko-secrets' >> "$f"
done
# подхватить секреты в текущий процесс хука
[ -f secrets.env ] && source secrets.env 2>/dev/null

# --- 2. Higgsfield CLI (npm -g). Ставим в фоне, если бинаря нет ---
HF_STATE=""
if command -v higgsfield >/dev/null 2>&1 || command -v hf >/dev/null 2>&1; then
  HF_STATE="CLI ✓"
else
  # неблокирующая установка, чтобы не тормозить старт сессии
  ( npm install -g @higgsfield/cli >/tmp/hf-cli-install.log 2>&1 ) &
  HF_STATE="CLI ставится…"
fi

# --- 3. авторизация Higgsfield CLI из секрета (одноразовый логин Даниэля) ---
# HIGGSFIELD_CREDENTIALS_B64 — base64 файла ~/.config/higgsfield/credentials.json
# (получается после `higgsfield auth login`; refresh_token обновляет access сам).
CREDS_DIR="${HIGGSFIELD_CREDENTIALS_PATH:-$HOME/.config/higgsfield/credentials.json}"
if [ -n "$HIGGSFIELD_CREDENTIALS_B64" ]; then
  mkdir -p "$(dirname "$CREDS_DIR")" 2>/dev/null
  echo "$HIGGSFIELD_CREDENTIALS_B64" | base64 -d > "$CREDS_DIR" 2>/dev/null && \
    chmod 600 "$CREDS_DIR" 2>/dev/null && HF_STATE="$HF_STATE, auth ✓"
else
  HF_STATE="$HF_STATE, auth ✗ (нужен higgsfield auth login → в secrets)"
fi

echo "OKO: ключи загружены (secrets.env), паспорт INTEGRATIONS.md · Higgsfield $HF_STATE"
exit 0
