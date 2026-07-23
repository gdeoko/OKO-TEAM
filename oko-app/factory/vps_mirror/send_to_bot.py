#!/usr/bin/env python3
# send_to_bot.py <file> [caption]  — шлёт файл-документ в DIESEL-бот (аналитика/рекон).
# Токен CLIENT_DIESEL_BOT_TOKEN, chat из cfg/diesel_bot_chat.txt. Фолбэк: sendMessage если документ не прошёл.
import os,sys,subprocess
TOK=(os.environ.get("CLIENT_DIESEL_BOT_TOKEN") or os.environ.get("DIESEL_BOT_TOKEN","")).replace("export ","").strip()
CA="/root/.ccr/ca-bundle.crt"; CAF=["--cacert",CA] if os.path.exists(CA) else []
chat=open("/opt/oko-poster/cfg/diesel_bot_chat.txt").read().strip()
f=sys.argv[1]; cap=sys.argv[2] if len(sys.argv)>2 else ""
API=f"https://api.telegram.org/bot{TOK}"
r=subprocess.run(["curl","-s","-m","60",*CAF,f"{API}/sendDocument",
  "-F","chat_id="+chat,"-F",f"document=@{f};type=text/plain","-F","caption="+cap[:1000]],
  capture_output=True,text=True)
out=r.stdout or ""
if '"ok":true' in out: print("DOC_SENT", out[:120]); sys.exit(0)
# fallback: message (chunked to 4000)
txt=open(f,encoding="utf-8").read()
for i in range(0,len(txt),4000):
    subprocess.run(["curl","-s","-m","30",*CAF,f"{API}/sendMessage",
      "--data-urlencode","chat_id="+chat,"--data-urlencode","text="+txt[i:i+4000],
      "--data-urlencode","disable_web_page_preview=true"],capture_output=True,text=True)
print("MSG_SENT (doc fallback) len",len(txt),"docresp",out[:80])
