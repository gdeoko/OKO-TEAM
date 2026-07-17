# -*- coding: utf-8 -*- Доставка готового ролика ФАЙЛОМ с цепочкой каналов (никогда не молчит).
#   python3 deliver.py <DAY_DIR> [<extra_note>]
# Каналы по приоритету:
#   1) @vcodemedia_bot обоим админам (VCODE_MEDIA_BOT_TOKEN + VCODE_ADMIN_IDS) — штатный.
#   2) ФОЛБЭК-бот Даниэлю (VCODE_FALLBACK_BOT_TOKEN -> VCODE_FALLBACK_CHAT) — если токена нет/не дошло.
#   3) E-mail SMTP (GMAIL_USER/GMAIL_PASS) с вложением — крайний резерв.
# Успех (exit 0), если ролик доставлен ХОТЯ БЫ ОДНИМ каналом.
import os, sys, json, subprocess, smtplib, ssl
from email.message import EmailMessage

CA='/root/.ccr/ca-bundle.crt'
DAY=sys.argv[1]; NOTE=sys.argv[2] if len(sys.argv)>2 else ''
reel=f'{DAY}/reel.mp4'; cover=f'{DAY}/cover.jpg'; thumb=f'{DAY}/thumb.jpg'
post=open(f'{DAY}/POST.txt').read() if os.path.exists(f'{DAY}/POST.txt') else ''
if os.path.exists(cover):
    subprocess.run(['ffmpeg','-y','-v','error','-i',cover,'-vf','scale=320:-1','-q:v','6',thumb])
title=post.strip().split('\n',1)[0] if post.strip() else 'Ролик дня'
cap=f"🎬 Ролик дня — «{title}»\n\nФайл без сжатия ниже. Описание для публикации — отдельным сообщением. Публикуете со своего аккаунта."
if NOTE: cap+=f"\n\n{NOTE}"

def tg(tok, method, **fields):
    api=f"https://api.telegram.org/bot{tok}"
    cmd=['curl','-s','--max-time','180','--cacert',CA]
    for k,v in fields.items(): cmd+=['--form-string' if isinstance(v,str) else '-F', f"{k}={v}"]
    cmd.append(f"{api}/{method}")
    try: return json.loads(subprocess.run(cmd,capture_output=True,timeout=200).stdout.decode() or '{}')
    except Exception as e: return {'ok':False,'err':str(e)[:120]}

def send_via_bot(tok, chats, thumb_ok):
    ok=False
    for a in chats:
        f={'chat_id':a,'document':f"@{reel}",'caption':cap}
        if thumb_ok and os.path.exists(thumb): f['thumbnail']=f"@{thumb}"
        r=tg(tok,'sendDocument', **f)
        print('  doc',a,r.get('ok'),r.get('description') or '')
        if r.get('ok'):
            ok=True
            if post.strip():
                r2=tg(tok,'sendMessage', chat_id=a, text=post); print('  msg',a,r2.get('ok'),r2.get('description') or '')
    return ok

def send_email():
    user=os.environ.get('GMAIL_USER',''); pw=os.environ.get('GMAIL_PASS','')
    if not user or not pw: return False
    to=os.environ.get('VCODE_MAIL_TO', user)
    try:
        m=EmailMessage()
        m['Subject']=f"V.CODE — ролик дня: {title}"
        m['From']=user; m['To']=to
        m.set_content((post or cap)+"\n\n(видео во вложении)")
        with open(reel,'rb') as fh:
            m.add_attachment(fh.read(), maintype='video', subtype='mp4', filename='reel.mp4')
        ctx=ssl.create_default_context()
        with smtplib.SMTP_SSL('smtp.gmail.com',465,context=ctx,timeout=90) as s:
            s.login(user, pw.replace(' ',''))
            s.send_message(m)
        print('  email -> ',to,'OK')
        return True
    except Exception as e:
        print('  email FAIL', str(e)[:140]); return False

delivered=False
# 1) штатный бот обоим админам
tok=os.environ.get('VCODE_MEDIA_BOT_TOKEN','')
admins=[a.strip() for a in os.environ.get('VCODE_ADMIN_IDS','').split(',') if a.strip()]
if tok and admins:
    print('[1] @vcodemedia_bot -> admins', admins)
    if send_via_bot(tok, admins, True): delivered=True
else:
    print('[1] пропуск: нет VCODE_MEDIA_BOT_TOKEN/ADMIN_IDS')

# 2) фолбэк-бот Даниэлю (если штатный не сработал)
if not delivered:
    ftok=os.environ.get('VCODE_FALLBACK_BOT_TOKEN',''); fchat=os.environ.get('VCODE_FALLBACK_CHAT','')
    if ftok and fchat:
        print('[2] фолбэк-бот -> Даниэль', fchat)
        if send_via_bot(ftok, [fchat], False): delivered=True
    else:
        print('[2] пропуск: нет фолбэк-бота')

# 3) e-mail (крайний резерв)
if not delivered:
    print('[3] e-mail резерв')
    if send_email(): delivered=True

print('DELIVER_OK' if delivered else 'DELIVER_FAIL')
sys.exit(0 if delivered else 3)
