#!/bin/bash
set -e
ID=$1; SC=scripts/$ID.json; WD=work/$ID
mkdir -p $WD/vo $WD/aud
echo "[$ID] VO"; python3 gen_vo.py $SC $WD/vo >/dev/null
echo "[$ID] stock"; python3 fetch_stock2.py $SC $WD >/dev/null
echo "[$ID] overlays"; python3 render_overlays2.py $SC $WD >/dev/null
# audio assets: reuse shared music/sfx pool by app if exists, else fetch
APP=$(python3 -c "import json;print(json.load(open('$SC'))['app'])")
if [ ! -f $WD/aud/music.mp3 ]; then
  if [ -f assets/music/$APP.mp3 ]; then cp assets/music/$APP.mp3 $WD/aud/music.mp3; else cp work/spy_001/aud/music.mp3 $WD/aud/music.mp3; fi
  cp work/spy_001/aud/whoosh.mp3 $WD/aud/whoosh.mp3
  cp work/spy_001/aud/impact.mp3 $WD/aud/impact.mp3
fi
echo "[$ID] build"; python3 build2.py $SC $WD output/$ID.mp4
