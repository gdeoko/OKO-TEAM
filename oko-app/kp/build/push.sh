#!/bin/bash
set -u
cd /home/user/oko-agents; source <(base64 -d secrets.env.b64) 2>/dev/null
SB=/tmp/claude-0/-home-user-OKO-TEAM/6128eb90-b8e0-5d74-8a3a-298c6d212b0e/scratchpad
ctl(){ curl -s -m 60 -X POST "$CONTROL_URL/x" -H "X-Token: $CONTROL_TOKEN" --data-binary "$1"; }
ctl 'rm -f /tmp/dep.b64; echo reset' >/dev/null
CD=$SB/chunks; rm -rf $CD; mkdir -p $CD; split -b 90000 -d -a 3 $SB/dep.b64 $CD/c
N=$(ls $CD/c*|wc -l); TOTAL=$(wc -c <$SB/dep.b64); echo "chunks $N total $TOTAL"
exp=0; i=0
for f in $(ls $CD/c*); do
  data=$(cat "$f"); exp=$((exp+$(wc -c <"$f")))
  rs=""
  for try in 1 2 3 4 5; do
    r=$(ctl "printf %s '$data' >> /tmp/dep.b64 && wc -c < /tmp/dep.b64"); rs=$(echo "$r"|grep -oE '[0-9]+'|tail -1)
    [ "$rs" = "$exp" ] && break; sleep $((try*2))
  done
  [ "$rs" != "$exp" ] && { echo "FAIL chunk $i got=$rs want=$exp"; exit 1; }
  i=$((i+1)); echo "  $i/$N"
done
echo "UPLOADED $exp expect $TOTAL"
ctl "cd /tmp && base64 -d dep.b64 > dep.tgz && echo MD5 \$(md5sum dep.tgz|cut -d' ' -f1) WANT 19fcf7cc18d4e9ec8804686131a884f5"
ctl "cd /var/www/okoteam && cp -f kp/index.html kp/index_v8_backup.html; tar xzf /tmp/dep.tgz && chown -R www-data:www-data kp kp-dmitry kp-speto && echo EXTRACTED && for d in kp kp-dmitry kp-speto; do echo \$d \$(wc -c < \$d/index.html) \$(wc -c < \$d/js/holo.js); done"
echo PUSHDONE
