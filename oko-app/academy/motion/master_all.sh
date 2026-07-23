#!/bin/bash
# Мастер-марафон: все уроки всех блоков → видео (make_lesson.sh), skip-done. Многочасовой фоновый прогон.
ROOT=/home/user/OKO-TEAM; APP=$ROOT/oko-app/app; M=$ROOT/oko-app/academy/motion
declare -A LBL=(
 [m1]="МЕДИЙНОСТЬ · БЛОК 1" [m2]="МЕДИЙНОСТЬ · БЛОК 2" [m3]="МЕДИЙНОСТЬ · БЛОК 3" [m4]="МЕДИЙНОСТЬ · БЛОК 4" [m5]="МЕДИЙНОСТЬ · БЛОК 5"
 [k1]="МАРКЕТИНГ · БЛОК 1" [k2]="МАРКЕТИНГ · БЛОК 2" [k3]="МАРКЕТИНГ · БЛОК 3" [k4]="МАРКЕТИНГ · БЛОК 4" [k5]="МАРКЕТИНГ · БЛОК 5"
 [a1]="НЕЙРОСЕТИ · БЛОК 1" [a2]="НЕЙРОСЕТИ · БЛОК 2" [a3]="НЕЙРОСЕТИ · БЛОК 3" [a4]="НЕЙРОСЕТИ · БЛОК 4" [a5]="НЕЙРОСЕТИ · БЛОК 5"
)
ORDER=(m1 m2 m3 m4 m5 k1 k2 k3 k4 k5 a1 a2 a3 a4 a5)
# длины блоков
declare -A LEN
eval "$(node -e 'global.window={};require("'$APP'/modules/academy-content/script.js");const p=window.AC_PACK;["m1","m2","m3","m4","m5","k1","k2","k3","k4","k5","a1","a2","a3","a4","a5"].forEach(b=>console.log("LEN["+b+"]="+((p[b]||[]).length)))')"
echo "[master-all] start $(date +%H:%M:%S)"
G=0
for B in "${ORDER[@]}"; do
  N=${LEN[$B]:-0}
  for ((i=0;i<N;i++)); do
    echo "[master-all] $B/$i gidx=$G $(date +%H:%M:%S)"
    BLOCK="$B" IDX=$i GIDX=$G KICK="${LBL[$B]}" bash "$M/make_lesson.sh" >> "$M/work/ml_${B}_${i}.log" 2>&1
    G=$((G+1))
  done
done
echo "[master-all] ALL DONE $(date +%H:%M:%S) videos=$(ls $ROOT/oko-app/site/media/oko_[mka][0-9]_*.mp4 2>/dev/null|wc -l)"
