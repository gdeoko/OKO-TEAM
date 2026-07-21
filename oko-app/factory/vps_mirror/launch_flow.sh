#!/bin/bash
cd /opt/oko-poster
PROFILE="$1"; EMAIL="$2"; PB64="$3"; TAG="$4"
pkill -9 -f "ig_flow.mjs $PROFILE" 2>/dev/null
rm -f "cfg/${TAG}_status.txt" "cfg/flow_${TAG}.log" "cfg/${TAG}_code.txt" cfg/flow_${TAG}_*.png
rm -rf "$PROFILE"
setsid bash -c "exec node ig_flow.mjs '$PROFILE' '$EMAIL' '$PB64' '$TAG' >cfg/flow_${TAG}.out 2>&1" </dev/null >/dev/null 2>&1 &
echo "LAUNCHED_DETACHED"
