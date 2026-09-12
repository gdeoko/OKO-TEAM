#!/bin/bash
cd /home/user/OKO-TEAM/rocketcdn
export HTTPS_PROXY=
export TMPDIR=/home/user/OKO-TEAM/rocketcdn/tools/audit/tmpx
scr=${1:-телефон}
lim=${2:-40}
for i in $(seq 1 20); do
  la=$(cut -d' ' -f1 /proc/loadavg | cut -d. -f1)
  if [ "$la" -gt "$lim" ]; then sleep 45; continue; fi
  echo "try $i la=$la $(date +%H:%M:%S)"
  timeout 520 node tools/audit/числа.mjs "$scr" 0 1 1000 >> "tools/audit/out/sw-$scr.log" 2>&1
  n=$(grep -c '"y"' "tools/audit/out/ч-$scr-0.ndjson" 2>/dev/null)
  echo "rows=$n"
  if [ "${n:-0}" -gt 40 ]; then echo OK; break; fi
  sleep 20
done
