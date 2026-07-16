# -*- coding: utf-8 -*-
"""V.CODE media-bot handler — один проход опроса.
Делает бот «живым» без постоянного сервера: вызывается из триггеров
(9:00 / 10:00 / ежечасный) и по требованию.
- показывает нижнюю клавиатуру на /start;
- принимает ССЫЛКИ (instagram/youtube/tiktok) → кладёт в очередь + подтверждает;
- отвечает на кнопки (Аналитика/Цели/Что залетело/Как работает);
- состояние (offset + очередь ссылок) в vcode/bot_state.json (коммитит сессия).
Постинг НЕ делает — готовые ролики Владимир публикует сам.
Запуск: python3 vcode/bot_poll.py   (нужен VCODE_MEDIA_BOT_TOKEN)
"""
import os, sys, json, subprocess, re

CA=os.environ.get("CA_BUNDLE","/root/.ccr/ca-bundle.crt")
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATE=os.path.join(ROOT,"vcode","bot_state.json")
TOK=os.environ.get("VCODE_MEDIA_BOT_TOKEN","")
API=f"https://api.telegram.org/bot{TOK}"
URL_RE=re.compile(r'https?://\S+', re.I)
SOC_RE=re.compile(r'(instagram\.com|instagr\.am|youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok)', re.I)

KB=json.dumps({"keyboard":[[{"text":"📹 Ролик дня"},{"text":"📊 Аналитика"}],
    [{"text":"🔗 Прислать ссылку"},{"text":"🏆 Что залетело"}],
    [{"text":"🎯 Цели"},{"text":"❓ Как работает"}]],
    "resize_keyboard":True,"is_persistent":True,
    "input_field_placeholder":"Пришлите ссылку на ролик или выберите кнопку"}, ensure_ascii=False)

def tg(method, **fields):
    cmd=["curl","-s","--cacert",CA]
    for k,v in fields.items(): cmd+=["--form-string" if isinstance(v,str) else "-F", f"{k}={v}"]
    cmd.append(f"{API}/{method}")
    try: return json.loads(subprocess.run(cmd,capture_output=True,timeout=60).stdout.decode() or "{}")
    except Exception as e: return {"ok":False,"err":str(e)[:120]}

def load():
    try:
        with open(STATE) as f: return json.load(f)
    except Exception: return {"offset":0,"queue":[]}

def save(st):
    os.makedirs(os.path.dirname(STATE),exist_ok=True)
    with open(STATE,"w") as f: json.dump(st,f,ensure_ascii=False,indent=1)

def send(chat, text): tg("sendMessage", chat_id=str(chat), parse_mode="HTML", text=text, reply_markup=KB)

REPLIES={
 "🎯 цели":"<b>Цель программы</b>\n100 000 000 просмотров на 500 роликов и минимум 20 000 подписчиков.\nСтарт 1 ролик/день с наращиванием к концу августа.",
 "🏆 что залетело":"Слежу за аналитикой: выстреливший формат дорабатываю и повторяю, пока заходит; слабое режу.",
 "❓ как работает":"Каждый день в 9:00 МСК кидаю сюда готовый ролик (файл + обложка + описание) — Вы публикуете.\nКидайте ссылки на залётные ролики — соберу похожие под бренд. Нет ссылок — беру тренды конкурентов от 1М.\nАналитику собираю по ссылке аккаунта.",
 "🔗 прислать ссылку":"Пришлите ссылку на ролик (Instagram / YouTube / TikTok) одним сообщением — заберу, разберу покадрово и соберу похожий.",
 "📊 аналитика":"Принял — собираю аналитику по ссылке аккаунта за вчера, пришлю отчёт.",
 "📹 ролик дня":"Готовлю ролик дня — пришлю сюда файлом с обложкой и описанием.",
}

def main():
    if not TOK: print("NO VCODE_MEDIA_BOT_TOKEN"); return
    st=load(); off=st.get("offset",0); q=st.get("queue",[])
    r=tg("getUpdates", offset=off, timeout=0)
    ups=r.get("result",[]) if r.get("ok") else []
    new_links=0
    for u in ups:
        off=max(off,u["update_id"]+1)
        m=u.get("message") or u.get("edited_message")
        if not m: continue
        chat=m["chat"]["id"]; txt=(m.get("text") or "").strip(); low=txt.lower()
        # голосовые/аудио → сохраняем в vcode/voice/ для клона голоса (XTTS)
        media=m.get("voice") or m.get("audio")
        if media and media.get("file_id"):
            try:
                fr=tg("getFile", file_id=media["file_id"])
                fp=fr.get("result",{}).get("file_path")
                if fp:
                    vdir=os.path.join(ROOT,"vcode","voice"); os.makedirs(vdir,exist_ok=True)
                    ext=os.path.splitext(fp)[1] or ".ogg"
                    n=len([f for f in os.listdir(vdir) if not f.startswith('.')])+1
                    out=os.path.join(vdir,f"sample_{n}{ext}")
                    subprocess.run(["curl","-s","--cacert",CA,"-o",out,
                        f"https://api.telegram.org/file/bot{TOK}/{fp}"],check=True)
                    send(chat,f"Принял голосовой образец #{n}. Как будет ≥3 — сделаю клон Вашего голоса и озвучу им ролики.")
            except Exception as e:
                send(chat,"Голосовой пришёл, но не смог сохранить — пришлите ещё раз, пожалуйста.")
            continue
        if low in ("/start","start","/help"):
            send(chat,"Бот V.CODE на связи. Выберите кнопку снизу или пришлите ссылку на ролик."); continue
        urls=[x for x in URL_RE.findall(txt) if SOC_RE.search(x)]
        if urls:
            for x in urls:
                q.append({"url":x,"from":m.get("from",{}).get("first_name"),"chat":chat,"date":m.get("date")}); new_links+=1
            send(chat,f"Принял ссылк{'у' if len(urls)==1 else 'и'} ({len(urls)}). Заберу, разберу покадрово и соберу похожий ролик под бренд."); continue
        if low in REPLIES: send(chat,REPLIES[low]); continue
        if txt: send(chat,"Принял. Пришлите ссылку на ролик или выберите кнопку снизу.")
    st["offset"]=off; st["queue"]=q; save(st)
    print(json.dumps({"processed":len(ups),"new_links":new_links,"queue_len":len(q)},ensure_ascii=False))

if __name__=="__main__": main()
