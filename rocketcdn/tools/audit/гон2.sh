#!/bin/bash
S="$1"; L="$2"; N=0
cd /home/user/OKO-TEAM/rocketcdn
H="tools/audit/окна/пульт-$S-$L.txt"
while [ $N -lt 5 ]; do
  N=$((N+1)); echo "--- попытка $N ---" >> "$H"
  HTTPS_PROXY= node tools/audit/пульт.mjs "$S" "$L" >> "tools/audit/окна/сырп-$S-$L.log" 2>&1
  if grep -q "ГОТОВО-ПУЛЬТ" "$H" 2>/dev/null; then break; fi
  sleep 5
done
echo "КОНЕЦ" >> "$H"
