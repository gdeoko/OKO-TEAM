#!/bin/bash
cd /home/user/OKO-TEAM/rocketcdn
export HTTPS_PROXY=
export TMPDIR=/home/user/OKO-TEAM/rocketcdn/tools/audit/tmpx
порог=${2:-40}
экран=${1:-телефон}
for попытка in 1 2 3 4 5 6 7 8 9 10 11 12; do
  la=$(cut -d' ' -f1 /proc/loadavg | cut -d. -f1)
  if [ "$la" -gt "$порог" ]; then sleep 45; continue; fi
  echo "попытка $попытка la=$la $(date +%H:%M:%S)"
  timeout 520 node tools/audit/числа.mjs "$экран" 0 1 1000 >> tools/audit/out/св-$экран.log 2>&1
  n=$(grep -c '"y"' tools/audit/out/ч-$экран-0.ndjson 2>/dev/null || echo 0)
  echo "получено строк: $n"
  if [ "$n" -gt 40 ]; then echo УСПЕХ; break; fi
  sleep 20
done
