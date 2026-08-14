#!/bin/bash
# Рендер JS-страницы headless-Chrome'ом на мосту, трафик — через SOCKS до
# российского VPS. Нужно для mos.ru и прочих SPA, которые без JS отдают пустышку.
#   rufetch3.sh https://www.mos.ru/donm/contacts/
set -u
URL="${1:?нужен URL}"
REPO="/home/user/OKO-TEAM"
source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null

CMD=$(python3 - "$URL" "$MUZMIR_VPS_ROOT_PASS" <<'PY'
import sys, shlex
url, pwd = sys.argv[1], sys.argv[2]
clean = ("import sys,re,html\n"
         "t=sys.stdin.read()\n"
         "t=re.sub(r'<(script|style)[^>]*>.*?</\\1>',' ',t,flags=re.S|re.I)\n"
         "t=re.sub(r'<[^>]+>','\\n',t)\n"
         "t=html.unescape(t)\n"
         "t=re.sub(r'[ \\t\\xa0]+',' ',t)\n"
         "t=re.sub(r'\\n\\s*\\n+','\\n',t)\n"
         "print(t[:40000])\n")
chrome = ("google-chrome --headless=new --no-sandbox --disable-gpu "
          "--ignore-certificate-errors --virtual-time-budget=25000 --proxy-server='socks5://127.0.0.1:1080' "
          "--dump-dom " + shlex.quote(url) + " 2>/dev/null | python3 -c " + shlex.quote(clean))
print("sshpass -p %s ssh -N -D 1080 -o StrictHostKeyChecking=no root@176.124.200.169 & "
      "SSHPID=$!; sleep 6; %s; kill $SSHPID" % (shlex.quote(pwd), chrome))
PY
)

curl -s --cacert /root/.ccr/ca-bundle.crt -m 180 -X POST "$OKO_POSTER_URL" \
  -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$CMD")" \
| python3 -c 'import sys,json
d=json.load(sys.stdin)
print(d.get("stdout",""),end="")'
