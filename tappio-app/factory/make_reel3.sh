#!/usr/bin/env bash
# v3 конвейер одного ролика: озвучка -> много уникальных клипов -> уникальная музыка
# -> анимированные наложения -> сборка с переходами.
set -e
ID="$1"; S="scripts/$ID.json"; WD="work/$ID"
[ -f "$S" ] || { echo "no script $S"; exit 1; }
[ -f ../../secrets.env.b64 ] && source <(base64 -d ../../secrets.env.b64) 2>/dev/null || true
mkdir -p "$WD/vo"
echo "== VO =="        ; python3 gen_vo.py       "$S" "$WD/vo"
echo "== STOCK =="     ; python3 fetch_stock3.py "$S" "$WD"
echo "== MUSIC =="     ; python3 fetch_music.py  "$S" "$WD"
echo "== OVERLAYS =="  ; python3 render_ov3.py   "$S" "$WD"
echo "== BUILD =="     ; python3 build3.py       "$S" "$WD" "output/$ID.mp4"
echo "DONE output/$ID.mp4"
