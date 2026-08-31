# -*- coding: utf-8 -*-
"""Отправка писем кредиторам с okoteam.top@gmail.com.
Доступ берёт из конфига агентов, в файле паролей нет.
Каждое письмо уходит один раз: отправленные помечаются в otpravleno.json.

  python3 otpravit.py spisok      — показать что уйдёт
  python3 otpravit.py poehali     — отправить всё неотправленное
  python3 otpravit.py poehali ID  — отправить одно письмо
"""
import sys, os, json, ssl, smtplib, datetime
from email.message import EmailMessage

sys.path.insert(0, "/opt/oko-agents")
BAZA = "/opt/oko-agents/data_runtime/dolgi"
PISMA = os.path.join(BAZA, "pisma.json")
LOG = os.path.join(BAZA, "otpravleno.json")
OT = "okoteam.top@gmail.com"
IMYA = "Ильясов Даниэль Альбертович"


def dostup():
    from config import config
    g = config.GMAIL_ACCOUNTS or {}
    p = g.get(OT)
    if isinstance(p, dict):
        p = p.get("pass") or p.get("password")
    if not p:
        raise SystemExit("нет доступа к ящику " + OT)
    return p


def uzhe():
    if os.path.exists(LOG):
        return json.load(open(LOG, encoding="utf-8"))
    return {}


def okno():
    """Наружу пишем только пн-сб с 09:00 до 19:00 МСК (правило 7)."""
    m = datetime.datetime.utcnow() + datetime.timedelta(hours=3)
    return m.isoweekday() <= 6 and 9 <= m.hour < 19, m


def main():
    rezhim = sys.argv[1] if len(sys.argv) > 1 else "spisok"
    odin = sys.argv[2] if len(sys.argv) > 2 else None
    pisma = json.load(open(PISMA, encoding="utf-8"))
    log = uzhe()

    if rezhim not in ("poehali", "poehali_seychas"):
        for p in pisma:
            m = "УЖЕ ОТПРАВЛЕНО " + log[p["id"]]["kogda"] if p["id"] in log else "ждёт"
            print(f'{p["id"]:<12} {p["komu"]:<32} {m}')
        return

    mozhno, seychas = okno()
    if rezhim == "poehali_seychas":
        mozhno = True
    if not mozhno:
        print("Окно закрыто (", seychas.strftime("%a %H:%M"), "МСК ). "
              "Наружу пишем пн-сб 09:00-19:00. Ничего не отправлено.")
        return

    parol = dostup()
    ctx = ssl.create_default_context()
    poslano = 0
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx, timeout=60) as s:
        s.login(OT, parol)
        for p in pisma:
            if odin and p["id"] != odin:
                continue
            if p["id"] in log:
                print("пропуск, уже отправлено:", p["id"])
                continue
            m = EmailMessage()
            m["From"] = f"{IMYA} <{OT}>"
            m["To"] = p["komu"]
            if p.get("kopiya"):
                m["Cc"] = p["kopiya"]
            m["Subject"] = p["tema"]
            m.set_content(p["text"])
            poluchateli = [p["komu"]] + ([p["kopiya"]] if p.get("kopiya") else [])
            s.send_message(m, from_addr=OT, to_addrs=poluchateli)
            log[p["id"]] = {"kogda": seychas.strftime("%d.%m.%Y %H:%M"),
                            "komu": p["komu"], "tema": p["tema"]}
            json.dump(log, open(LOG, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            print("ушло:", p["id"], "->", p["komu"])
            poslano += 1
    print("отправлено писем:", poslano)

if __name__ == "__main__":
    main()
