#!/bin/bash
# Полный конвейер одного видео-урока: урок → нарратив → XTTS-клон → сцена → захват → музыка+SFX+VO → mp4.
# env: BLOCK IDX GIDX KICK  [VOREUSE=path]
set -u
ROOT=/home/user/OKO-TEAM; APP=$ROOT/oko-app/app; M=$ROOT/oko-app/academy/motion
LV=/tmp/claude-0/-home-user-OKO-TEAM/1e302e81-cfb3-54d9-9e3e-3f0368f4c654/scratchpad/lvideo
OUT=$ROOT/oko-app/site/media; W=$M/work; mkdir -p "$W" "$OUT"
BLOCK=${BLOCK:?}; IDX=${IDX:?}; GIDX=${GIDX:-0}; KICK=${KICK:-"АКАДЕМИЯ OKO"}
OUTMP4="$OUT/oko_${BLOCK}_${IDX}.mp4"
[ -s "$OUTMP4" ] && { echo "[skip] $OUTMP4"; exit 0; }
ln -sfn /opt/node22/lib/node_modules "$M/node_modules"
PORT=$((8850 + (GIDX % 40)))

# 1. lesson json
node -e 'global.window={};require("'$APP'/modules/academy-content/script.js");require("fs").writeFileSync("'$W'/L_'$BLOCK'_'$IDX'.json",JSON.stringify(window.AC_PACK["'$BLOCK'"]['$IDX']))' || exit 1
LJSON="$W/L_${BLOCK}_${IDX}.json"

# 2. нарратив (хуманизированный, от первого лица)
node -e '
const L=JSON.parse(require("fs").readFileSync("'$LJSON'"));
const clean=s=>s.replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim().replace(/[.!?]*$/,"");
const parts=["Привет! Это Даниэль. Разберём тему: "+clean(L.title)+"."];
(L.slides||[]).forEach(s=>{ parts.push(clean(s.t)+"."); (s.pts||[]).forEach(p=>parts.push(clean(p)+".")); });
parts.push("Дальше тебя ждут тест, игра и практика. Применяй сразу — и переходи к следующему уроку.");
require("fs").writeFileSync("'$W'/vo_'$BLOCK'_'$IDX'.txt",parts.join(" "));
'
VOTXT="$W/vo_${BLOCK}_${IDX}.txt"; VOWAV="$W/vo_${BLOCK}_${IDX}.wav"

# 3. VO (клон) — с переиспользованием
if [ -n "${VOREUSE:-}" ] && [ -s "${VOREUSE:-}" ]; then cp "$VOREUSE" "$VOWAV"; fi
if [ ! -s "$VOWAV" ]; then
  python3 $ROOT/.claude/skills/oko-voice/scripts/oko_voice_pro.py --textfile "$VOTXT" --out "$VOWAV" > "$W/vo_${BLOCK}_${IDX}.log" 2>&1
fi
[ -s "$VOWAV" ] || { echo "[VO FAIL $BLOCK/$IDX]"; tail -3 "$W/vo_${BLOCK}_${IDX}.log"; exit 1; }
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VOWAV")

# 4. сцена
SCENE="$W/scene_${BLOCK}_${IDX}.json"
( cd "$M" && LESSON="$LJSON" GIDX=$GIDX DUR=$DUR KICK="$KICK" VOTEXT="$VOTXT" OUT="$SCENE" node scene_gen.mjs ) || exit 1

# 5. захват (real-time)
CAP="$W/cap_${BLOCK}_${IDX}"; rm -rf "$CAP"
( cd "$M" && python3 -m http.server $PORT >/dev/null 2>&1 & echo $! > "$W/srv_${BLOCK}_${IDX}.pid" )
sleep 1
( cd "$M" && SCENE="$SCENE" OUTDIR="$CAP" PORT=$PORT node capture_rt.mjs > "$W/cap_${BLOCK}_${IDX}.log" 2>&1 )
kill $(cat "$W/srv_${BLOCK}_${IDX}.pid") 2>/dev/null
WEBM=$(node -e "console.log(require('$CAP/meta.json').webm)" 2>/dev/null)
OFF=$(node -e "console.log(require('$CAP/meta.json').offset)" 2>/dev/null)
[ -s "$WEBM" ] || { echo "[CAP FAIL $BLOCK/$IDX]"; tail -4 "$W/cap_${BLOCK}_${IDX}.log"; exit 1; }

# 6. аудио: музыка (уникальный трансформ по GIDX) + SFX на переходах + VO ducking
NBED=$(ls "$M/audio/music"/bed_*.mp3 2>/dev/null | wc -l); NBED=$((NBED>0?NBED:1))
BED="$M/audio/music/bed_$((GIDX % NBED)).mp3"
# уникальность музыки: старт-офсет и лёгкий питч/темп по seed
BOFF=$(node -e "console.log((( $GIDX *13)%40))")
RATE=$(node -e "console.log((0.94 + (($GIDX%9)*0.015)).toFixed(3))")
# SFX-строки на старте каждого сегмента
SFXARGS=$(node -e '
const sc=JSON.parse(require("fs").readFileSync("'$SCENE'"));const fs=require("fs");
const pool=fs.readdirSync("'$M'/audio/sfx").filter(f=>f.endsWith(".mp3"));
const pick=["whoosh.mp3","snap.mp3","click.mp3","success.mp3","print.mp3","type.mp3"].filter(f=>pool.includes(f));
let inp=[],fl=[],k=0;
sc.segs.forEach((s,i)=>{ if(i===0)return; const f=pick[(i+'"$GIDX"')%pick.length]; if(!f)return; const t=(s.at).toFixed(2);
  inp.push("-i","'$M'/audio/sfx/"+f); fl.push("[a"+k+":a]adelay="+Math.round(t*1000)+"|"+Math.round(t*1000)+",volume=0.35[s"+k+"]"); k++; });
fs.writeFileSync("'$W'/sfxmap_'$BLOCK'_'$IDX'.txt", JSON.stringify({inp,fl,k}));
console.log(k);
')
SM=$(cat "$W/sfxmap_${BLOCK}_${IDX}.txt")
mapfile -t SFX_IN < <(node -e "const m=$SM;m.inp.forEach(x=>console.log(x))")
SFX_FL=$(node -e "const m=$SM;console.log(m.fl.join(';'))")
SFX_K=$(node -e "const m=$SM;console.log(m.k)")

# музыкальная ветка: [1] = VO, [2] = музыка bed
MUSFILT="[2:a]atrim=$BOFF,asetrate=44100*$RATE,aresample=44100,volume=0.14,aloop=loop=-1:size=2e9,atrim=0:$DUR,afade=t=in:d=1,afade=t=out:st=$(node -e "console.log(($DUR-1.5).toFixed(2))"):d=1.5[mus]"
VOFILT="[1:a]loudnorm=I=-15:TP=-1.5[vo0];[vo0][mus]sidechaincompress=threshold=0.05:ratio=6:attack=20:release=300[voduck]"
if [ "$SFX_K" -gt 0 ]; then
  SIDX=(); n=3; for ((j=0;j<SFX_K;j++)); do SIDX+=("[s$j]"); done
  AMIX="[voduck]${SIDX[*]}amix=inputs=$((SFX_K+1)):normalize=0:duration=first[aout]"
  FC="[0:v]fps=30,format=yuv420p[v];$MUSFILT;$VOFILT;$SFX_FL;$AMIX"
  # переиндексировать sfx входы: они идут после 0(video)1(vo)2(music) → индексы 3..
  # переписать [aN:a] на [(3+N):a]
  FC=$(node -e 'let f=process.argv[1];f=f.replace(/\[a(\d+):a\]/g,(m,n)=>"["+(3+ +n)+":a]");console.log(f)' "$FC")
  ffmpeg -y -ss "$OFF" -i "$WEBM" -i "$VOWAV" -i "$BED" "${SFX_IN[@]}" -t "$DUR" -filter_complex "$FC" -map "[v]" -map "[aout]" -c:v libx264 -preset veryfast -crf 24 -c:a aac -b:a 160k -movflags +faststart "$OUTMP4" > "$W/mux_${BLOCK}_${IDX}.log" 2>&1
else
  FC="[0:v]fps=30,format=yuv420p[v];$MUSFILT;$VOFILT"
  ffmpeg -y -ss "$OFF" -i "$WEBM" -i "$VOWAV" -i "$BED" -t "$DUR" -filter_complex "$FC" -map "[v]" -map "[voduck]" -c:v libx264 -preset veryfast -crf 24 -c:a aac -b:a 160k -movflags +faststart "$OUTMP4" > "$W/mux_${BLOCK}_${IDX}.log" 2>&1
fi
[ -s "$OUTMP4" ] && echo "[OK $BLOCK/$IDX] $(du -h "$OUTMP4"|cut -f1) ~$(printf '%.0f' "$DUR")s bed$((GIDX%NBED)) sfx$SFX_K" || { echo "[MUX FAIL $BLOCK/$IDX]"; tail -8 "$W/mux_${BLOCK}_${IDX}.log"; exit 1; }
# чистим временные тяжёлые файлы
rm -rf "$CAP"
