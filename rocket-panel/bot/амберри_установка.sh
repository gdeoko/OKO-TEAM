#!/usr/bin/env bash
# Разворачивание новой цепочки кадра там, где живёт бот.
#
# Два шага цепочки считаются НА МАШИНЕ БОТА, а не в облаке: подмена
# лица (`inswapper`) и возврат резкости (`GPEN-512`). Без этого скрипта
# они молча пропускаются, и человек получает кадр с чужим лицом - бот
# при этом работает и ничем не ругается, поэтому проверять надо глазами
# или этим скриптом.
#
#   bash амберри_установка.sh
#   # дальше в окружение службы:
#   OKO_FACE_PY=/usr/bin/python3
#   OKO_SWAP=1
#   APIMODELS_KEY=<ключ>
set -e

ПИТОН="${OKO_FACE_PY:-$(command -v python3)}"
ВЕСА_ЛИЦО="$HOME/.insightface/models"
ВЕСА_РЕЗКОСТЬ="$HOME/.face"

echo "== библиотеки"
"$ПИТОН" -m pip install --quiet --break-system-packages \
    insightface onnxruntime opencv-python-headless "protobuf>=5.28" || \
    "$ПИТОН" -m pip install --quiet \
    insightface onnxruntime opencv-python-headless "protobuf>=5.28"

echo "== веса распознавателя (buffalo_l качается сам при первом запуске)"
mkdir -p "$ВЕСА_ЛИЦО" "$ВЕСА_РЕЗКОСТЬ"

echo "== inswapper_128 (подмена лица)"
if [ ! -s "$ВЕСА_ЛИЦО/inswapper_128.onnx" ]; then
  curl -sSL -o "$ВЕСА_ЛИЦО/inswapper_128.onnx" \
    "https://huggingface.co/facefusion/models-3.0.0/resolve/main/inswapper_128.onnx"
fi

echo "== gpen_bfr_512 (возврат резкости)"
if [ ! -s "$ВЕСА_РЕЗКОСТЬ/gpen_bfr_512.onnx" ]; then
  curl -sSL -o "$ВЕСА_РЕЗКОСТЬ/gpen_bfr_512.onnx" \
    "https://huggingface.co/facefusion/models-3.0.0/resolve/main/gpen_bfr_512.onnx"
fi

echo "== проверка"
OKO_FACE_PY="$ПИТОН" "$ПИТОН" - <<'PY'
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath("амберри_лицо.py")))
import амберри_лицо as Л
print("питон:   ", Л.ПИТОН or "НЕ ЗАДАН (OKO_FACE_PY)")
print("подмена: ", Л.СВОП, os.path.exists(Л.СВОП))
print("резкость:", Л.GPEN, os.path.exists(Л.GPEN))
print("доступен:", Л.доступен())
PY
echo "готово. Не забудь OKO_FACE_PY, OKO_SWAP=1 и APIMODELS_KEY в окружении службы."
