# -*- coding: utf-8 -*-
"""Опрос почт на письма кредиторов. Ничего не отправляет, только читает.
Пароли берёт из конфига агентов и из мастер-хранилища на этом же сервере,
в сам файл ничего не вписано."""
import imaplib, email, json, os, re, sys, datetime
from email.header import decode_header, make_header

sys.path.insert(0, "/opt/oko-agents")
BAZA = "/opt/oko-agents/data_runtime/dolgi"
VAULT = "/opt/oko-poster/cfg/OKO_MASTER_VAULT.md"

# По каким отправителям узнаём кредитора
METKI = {
 "idcollect":   ["idcollect", "idfeurasia", "nebusfinance", "nebus", "ооо «луна»", "луна"],
 "ekapusta":    ["ekapusta", "rusinterfinance"],
 "pvonline":    ["pvonline", "ykky"],
 "microklad":   ["microklad"],
 "oneclick":    ["oneclickmoney", "dengisrazu"],
 "finterra":    ["fterra", "finterra"],
 "moneyman":    ["moneyman", "svoi.ru"],
 "zaymer":      ["zaymer", "msrb021", "sudrf", "mos-sud"],
 "korona":      ["stranaexpress", "koronamkk"],
 "mba":         ["mbafin", "tbank"],
 "triumvirat":  ["privsosed"],
}
SLOVA = ["задолженност", "микрозайм", "договор займа", "цессия", "уступк",
         "судебн приказ", "судебный приказ", "пристав", "фссп", "коллекторск",
         "коллектор", "дисконт", "реструктуриз", "справка об отсутствии",
         "закрытии договора", "об отсутствии задолженности"]
# Свои же адреса: их письма к долгам отношения не имеют
SVOI = ["kulturniy.centr.mir@", "okoteam.top@gmail", "daniel.okoteam@",
        "@музыкальный-мир", "nagradi", "novosti@", "news@музык", "kc@музык"]


def yashiki():
    """Список (адрес, пароль). Берём из конфига агентов и из хранилища."""
    out = []
    try:
        from config import config
        for user, pwd in (config.GMAIL_ACCOUNTS or {}).items():
            if isinstance(pwd, dict):
                pwd = pwd.get("pass") or pwd.get("password") or ""
            if user and pwd:
                out.append((user, pwd))
    except Exception as ex:
        print("конфиг агентов не прочитался:", ex)
    # Личные ящики владельца из мастер-хранилища: строки вида
    # "почта: адрес, пароль приложения: xxxx" либо таблица | адрес | пароль |
    try:
        t = open(VAULT, encoding="utf-8", errors="ignore").read()
        for adr in re.findall(r"[\w.+-]+@gmail\.com", t):
            if not adr.startswith("daniel."):
                continue
            if any(adr == u for u, _ in out):
                continue
            # ищем пароль приложения рядом с адресом (16 букв без пробелов
            # или четыре группы по 4)
            okno = t[max(0, t.find(adr) - 400): t.find(adr) + 400]
            m = re.search(r"\b([a-z]{16})\b", okno)
            if not m:
                m = re.search(r"\b([a-z]{4}(?:\s[a-z]{4}){3})\b", okno)
            if m:
                out.append((adr, m.group(1).replace(" ", "")))
    except Exception as ex:
        print("хранилище не прочиталось:", ex)
    return out


def razobrat(user, pwd, s_daty):
    naydeno = []
    M = imaplib.IMAP4_SSL("imap.gmail.com", 993, timeout=40)
    M.login(user, pwd)
    M.select('"[Gmail]/All Mail"', readonly=True)
    typ, data = M.search(None, "SINCE", s_daty)
    ids = data[0].split()
    for i in ids[-800:]:
        typ, raw = M.fetch(i, "(BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])")
        if typ != "OK" or not raw or not raw[0]:
            continue
        h = email.message_from_bytes(raw[0][1])
        ot = str(make_header(decode_header(h.get("From", ""))))
        tema = str(make_header(decode_header(h.get("Subject", ""))))
        kogda = h.get("Date", "")
        nizhe = (ot + " " + tema).lower()
        if any(sv in ot.lower() for sv in SVOI):
            continue
        kto = None
        for cid, klyuchi in METKI.items():
            if any(k in nizhe for k in klyuchi):
                kto = cid
                break
        if not kto and not any(w in tema.lower() for w in SLOVA):
            continue
        # тело для куска
        typ, raw2 = M.fetch(i, "(BODY.PEEK[TEXT])")
        kusok = ""
        try:
            body = raw2[0][1].decode("utf-8", "ignore")
            body = re.sub(r"<[^>]+>", " ", body)
            body = re.sub(r"\s+", " ", body)
            kusok = body[:400]
        except Exception:
            pass
        naydeno.append({"yashik": user, "ot": ot, "tema": tema, "data": kogda,
                        "kto": kto, "kusok": kusok})
    M.logout()
    return naydeno


def main():
    put = os.path.join(BAZA, "dolgi.json")
    d = json.load(open(put, encoding="utf-8"))
    s_daty = (datetime.date.today() - datetime.timedelta(days=75)).strftime("%d-%b-%Y")
    vse, oshibki = [], []
    for user, pwd in yashiki():
        try:
            n = razobrat(user, pwd, s_daty)
            print(f"{user}: писем по теме {len(n)}")
            vse += n
        except Exception as ex:
            print(f"{user}: НЕ ЗАШЛИ - {type(ex).__name__}: {ex}")
            oshibki.append({"yashik": user, "oshibka": f"{type(ex).__name__}: {ex}"})
    vse.sort(key=lambda x: x.get("data", ""), reverse=True)
    d["pisma"] = vse[:40]
    d["yashiki_oshibki"] = oshibki
    d["pochta_proverena"] = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")
    json.dump(d, open(put, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("всего писем по теме:", len(vse))

if __name__ == "__main__":
    main()
