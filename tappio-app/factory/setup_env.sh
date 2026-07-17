#!/usr/bin/env bash
# Холодный старт контейнера для контент-завода Tappio — идемпотентно, с таймаутами, без зависаний.
# Возвращает 0 если среда готова к сборке. Печатает READY/NOT-READY по каждому пункту.
set -uo pipefail
cd "$(dirname "$0")" || exit 1
FACT="$(pwd)"
ok=1

# 1) секреты
if [ -f ../../secrets.env.b64 ]; then source <(base64 -d ../../secrets.env.b64) 2>/dev/null && echo "secrets READY"; else echo "secrets MISSING"; ok=0; fi

# 2) агент-CA в certifi (для python https через прокси: gradio_client/boto3/requests)
CA=/root/.ccr/ca-bundle.crt
if [ -f "$CA" ]; then
  CB="$(python3 -m certifi 2>/dev/null)"
  if [ -n "$CB" ] && ! grep -q "$(head -c 60 "$CA" | tail -c 40)" "$CB" 2>/dev/null; then cat "$CA" >> "$CB" 2>/dev/null; fi
  echo "ca READY"
fi

# 3) python-зависимости (ставим только если нет; с таймаутом, чтобы не висло)
need_pip=""
python3 -c "import edge_tts" 2>/dev/null || need_pip="$need_pip edge-tts"
python3 -c "import PIL" 2>/dev/null || need_pip="$need_pip pillow"
python3 -c "import playwright" 2>/dev/null || need_pip="$need_pip playwright"
python3 -c "import yt_dlp" 2>/dev/null || need_pip="$need_pip yt-dlp"
python3 -c "import gradio_client" 2>/dev/null || need_pip="$need_pip gradio_client"
if [ -n "$need_pip" ]; then
  echo "pip installing:$need_pip"
  timeout 360 pip3 install -q --break-system-packages $need_pip 2>&1 | tail -1 || echo "pip WARN (частично)"
fi
python3 -c "import edge_tts,PIL,playwright,yt_dlp" 2>/dev/null && echo "pydeps READY" || { echo "pydeps NOT-READY"; ok=0; }

# 4) ffmpeg
command -v ffmpeg >/dev/null 2>&1 && echo "ffmpeg READY" || { echo "ffmpeg MISSING"; ok=0; }

# 5) chromium (предустановлен; НЕ качать через playwright install)
CHROME="$(ls /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)"
if [ -n "$CHROME" ]; then echo "chromium READY $CHROME"; else echo "chromium MISSING"; ok=0; fi

# 6) ассеты в репо (шрифты/формы/sfx/демо/обложки) — должны прийти с git pull
[ -d assets/fonts ] && echo "fonts READY" || echo "fonts MISSING"
[ -d assets/shapes/spy ] && echo "shapes READY" || echo "shapes MISSING(сгенерю make_shapes при сборке)"
[ -f aud_sfx/_pool.json ] && echo "sfx READY" || echo "sfx MISSING(fetch_sfx при сборке)"

echo "ENV $([ $ok -eq 1 ] && echo READY || echo NOT-READY)"
[ $ok -eq 1 ]
