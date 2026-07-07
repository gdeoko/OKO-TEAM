#!/usr/bin/env bash
# БЕСПЛАТНАЯ генерация картинок через Pollinations (модели Flux, без ключа).
# Использование: gen-image-free.sh "промпт на английском" [выход.jpg] [ШИРИНА] [ВЫСОТА]
set -euo pipefail
PROMPT="${1:?Нужен промпт (лучше на английском) первым аргументом}"
OUT="${2:-image.jpg}"
W="${3:-1280}"; H="${4:-720}"
python3 - "$PROMPT" "$OUT" "$W" "$H" <<'PY'
import urllib.parse, urllib.request, sys, random
prompt, out, w, h = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
seed = random.randint(1, 10**6)
url = (f"https://image.pollinations.ai/prompt/{urllib.parse.quote(prompt)}"
       f"?width={w}&height={h}&model=flux&nologo=true&seed={seed}")
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
data = urllib.request.urlopen(req, timeout=180).read()
open(out, 'wb').write(data)
print(f"OK: {out} ({len(data)//1024} KB, seed={seed})")
PY
