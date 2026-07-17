# -*- coding: utf-8 -*- Доставка готового ролика ФАЙЛОМ обоим админам в @vcodemedia_bot.
#   python3 deliver.py <DAY_DIR> [<extra_note>]
import os, sys, json, subprocess
CA='/root/.ccr/ca-bundle.crt'
DAY=sys.argv[1]; NOTE=sys.argv[2] if len(sys.argv)>2 else ''
TOK=os.environ['VCODE_MEDIA_BOT_TOKEN']; API=f"https://api.telegram.org/bot{TOK}"
ADMINS=[a.strip() for a in os.environ['VCODE_ADMIN_IDS'].split(',') if a.strip()]
reel=f'{DAY}/reel.mp4'; cover=f'{DAY}/cover.jpg'; thumb=f'{DAY}/thumb.jpg'
post=open(f'{DAY}/POST.txt').read() if os.path.exists(f'{DAY}/POST.txt') else ''
subprocess.run(['ffmpeg','-y','-v','error','-i',cover,'-vf','scale=320:-1','-q:v','6',thumb])
title=post.strip().split('\n',1)[0] if post.strip() else 'Ролик дня'
cap=f"🎬 Ролик дня — «{title}»\n\nФайл без сжатия ниже. Описание для публикации — отдельным сообщением. Публикуете со своего аккаунта."
if NOTE: cap+=f"\n\n{NOTE}"
def tg(method, **fields):
    cmd=['curl','-s','--max-time','180','--cacert',CA]
    for k,v in fields.items(): cmd+=['--form-string' if isinstance(v,str) else '-F', f"{k}={v}"]
    cmd.append(f"{API}/{method}")
    try: return json.loads(subprocess.run(cmd,capture_output=True,timeout=200).stdout.decode() or '{}')
    except Exception as e: return {'ok':False,'err':str(e)[:120]}
ok_all=True
for a in ADMINS:
    r=tg('sendDocument', chat_id=a, document=f"@{reel}", thumbnail=f"@{thumb}", caption=cap)
    print('doc',a,r.get('ok'),r.get('description') or '')
    ok_all=ok_all and r.get('ok')
    if post.strip():
        r2=tg('sendMessage', chat_id=a, text=post); print('msg',a,r2.get('ok'),r2.get('description') or '')
        ok_all=ok_all and r2.get('ok')
print('DELIVER_OK' if ok_all else 'DELIVER_FAIL')
sys.exit(0 if ok_all else 3)
