#!/bin/bash
cd /home/user/OKO-TEAM/rocketcdn
export HTTPS_PROXY=
export TMPDIR=/home/user/OKO-TEAM/rocketcdn/tools/audit/tmpx
export RC_DPR=1
for i in $(seq 1 60); do
  la=$(cut -d' ' -f1 /proc/loadavg | cut -d. -f1)
  echo "$(date +%H:%M:%S) la=$la"
  if [ "$la" -lt 20 ]; then
    timeout 520 node tools/audit/числа.mjs телефон 0 1 900 >> tools/audit/out/sw.log 2>&1
    n=$(grep -c '"y"' tools/audit/out/ч-телефон-0.ndjson 2>/dev/null)
    echo "rows=$n"
    [ "${n:-0}" -gt 40 ] && { echo DONE; break; }
  fi
  sleep 60
done
