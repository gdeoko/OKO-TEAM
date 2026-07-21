#!/usr/bin/env bash
# v4 конвейер: озвучка -> уникальные клипы -> уникальная музыка -> формы-маски ->
# анимированные наложения -> сборка (ИИ-обложка + формы-вставки + осмысленные SFX).
set -e
ID="$1"; S="scripts/$ID.json"; WD="work/$ID"
[ -f "$S" ] || { echo "no script $S"; exit 1; }
[ -f ../../secrets.env.b64 ] && source <(base64 -d ../../secrets.env.b64) 2>/dev/null || true
APP=$(python3 -c "import json;print(json.load(open('$S')).get('app','spy'))")
ACC=$(python3 -c "import json;print(json.load(open('$S'))['brand']['accent'])")
mkdir -p "$WD/vo"
[ -f "assets/shapes/$APP/_boxes.json" ] || { echo "== SHAPES =="; python3 make_shapes.py "$ACC" "assets/shapes/$APP"; }
echo "== VO =="       ; python3 gen_vo.py       "$S" "$WD/vo"
echo "== STOCK =="    ; python3 fetch_stock3.py "$S" "$WD"
echo "== MUSIC =="    ; python3 fetch_music.py  "$S" "$WD"
echo "== OVERLAYS ==" ; python3 render_ov3.py   "$S" "$WD"
echo "== AI COVER ==" ; timeout 200 python3 gen_cover_ai.py "$S" "$WD" || echo "cover_ai skip (fallback HTML)"
echo "== BUILD =="    ; python3 build4.py       "$S" "$WD" "output/$ID.mp4"
echo "DONE output/$ID.mp4"
