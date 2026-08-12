#!/usr/bin/env bash
#
# Запуск мозг-агента КЦ «Музыкальный Мир».
#
# Читает секреты из окружения (в git не класть):
#   MUZMIR_AGENT_TOKEN  - токен авторизации (совпадает с agent_token сайта);
#   MUZMIR_AGENT_PORT   - порт сервера (по умолчанию 8090);
#   GEMINI_API_KEY      - ключ(и) Gemini-прокси OKO;
#   GEMINI_PROXY_URL    - база прокси (по умолчанию OKO worker);
#   MUZMIR_VK_*/MUZMIR_TG_*/MUZMIR_YT_* - соц-доступы (опционально).
#
# Если файл agent/.env есть - подхватывается автоматически.
#
# Пример:
#   MUZMIR_AGENT_TOKEN=secret GEMINI_API_KEY=... ./agent/run.sh
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Локальные секреты для разработки (в git не класть, .env в .gitignore).
if [ -f "$DIR/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    . "$DIR/.env"
    set +a
fi

export MUZMIR_AGENT_PORT="${MUZMIR_AGENT_PORT:-8090}"

PY="${PYTHON:-python3}"

echo "muzmir-agent: старт на порту ${MUZMIR_AGENT_PORT} (auth $([ -n "${MUZMIR_AGENT_TOKEN:-}" ] && echo вкл || echo выкл))"
exec "$PY" "$DIR/server.py"
