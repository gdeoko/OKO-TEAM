#!/bin/bash
S="$1"; L="$2"; N=0
cd /home/user/OKO-TEAM/rocketcdn
H="tools/audit/окна/ход-$S-$L.txt"
while [ $N -lt 6 ]; do
  N=$((N+1))
  echo "--- попытка $N $S $L ---" >> "$H"
  HTTPS_PROXY= RC_URL="${RC_URL:-http://127.0.0.1:8188/?rcdbg=1}" node tools/audit/панели.mjs "$S" "$L" >> "tools/audit/окна/сыр-$S-$L.log" 2>&1
  if grep -q "ГОТОВО" "$H" 2>/dev/null; then break; fi
  sleep 5
done
echo "КОНЕЦ $S $L" >> "$H"
