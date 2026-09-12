#!/bin/bash
# Полная сборка рубки из двух выбранных кадров: ПК и телефон.
#
#   bash tools/cabbuild.sh assets/gen/cab/cand10/пк-9.png assets/gen/cab/cand10/моб-1.png
#
# Шаги: удвоение резкости через ZeroGPU -> разбор на слои -> глубина ->
# паспорт. После этого рама собирается сценой из assets/gen/cab/.
set -e
cd "$(dirname "$0")/.."
PK="$1"; MOB="$2"
[ -f "$PK" ] && [ -f "$MOB" ] || { echo "нужно два кадра: пк и моб"; exit 1; }

echo "── удвоение ──"
python3 tools/cabup.py "$PK" assets/gen/cab/wide-src.png 2
python3 tools/cabup.py "$MOB" assets/gen/cab/tall-src.png 2

echo "── слои ──"
python3 tools/cabgen.py assets/gen/cab/wide-src.png assets/gen/cab/wide
python3 tools/cabgen.py assets/gen/cab/tall-src.png assets/gen/cab/tall

echo "── глубина ──"
DEPTH_MODEL="${DEPTH_MODEL:-/home/user/models/depth_v2_small.onnx}" \
  python3 tools/cabdepth.py assets/gen/cab/wide-src.png assets/gen/cab/wide
DEPTH_MODEL="${DEPTH_MODEL:-/home/user/models/depth_v2_small.onnx}" \
  python3 tools/cabdepth.py assets/gen/cab/tall-src.png assets/gen/cab/tall

echo "── паспорт ──"
python3 tools/cabmeta.py assets/gen/cab/wide assets/gen/cab/tall > assets/gen/cab/meta.js
node --check assets/gen/cab/meta.js
echo "СБОРКА ГОТОВА"
