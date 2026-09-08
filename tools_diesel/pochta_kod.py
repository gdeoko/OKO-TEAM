# -*- coding: utf-8 -*-
"""Достать код подтверждения из почты аккаунта.

Ящики аккаунтов живут на своих доменах продавца, IMAP у них на mail.<домен>.
Берём только СВЕЖИЕ письма: старый код из прошлой проверки выглядит так же,
и вставив его, человек получает отказ и тратит попытку.

  IG_ACC=TOP python3 pochta_kod.py [сколько_минут_назад]
"""
import email, imaplib, os, re, sys
from email.header import decode_header, make_header

АКК = (os.environ.get("IG_ACC") or "TOP").upper()
ЯЩИК = os.environ.get(f"IG_DS_{АКК}_EMAIL", "")
ПАРОЛЬ = os.environ.get(f"IG_DS_{АКК}_EMAIL_PASS", "")
МИНУТ = int(sys.argv[1]) if len(sys.argv) > 1 else 30

if not ЯЩИК or not ПАРОЛЬ:
    raise SystemExit("нет ящика или пароля для " + АКК)

ХОСТ = "mail." + ЯЩИК.split("@", 1)[1]
print("ящик:", ЯЩИК, "| хост:", ХОСТ)

м = imaplib.IMAP4_SSL(ХОСТ, 993, timeout=40)
м.login(ЯЩИК, ПАРОЛЬ)

def текстом(письмо):
    куски = []
    if письмо.is_multipart():
        for ч in письмо.walk():
            if ч.get_content_type() in ("text/plain", "text/html"):
                try:
                    куски.append(ч.get_payload(decode=True).decode(ч.get_content_charset() or "utf-8", "ignore"))
                except Exception:
                    pass
    else:
        try:
            куски.append(письмо.get_payload(decode=True).decode(письмо.get_content_charset() or "utf-8", "ignore"))
        except Exception:
            pass
    return "\n".join(куски)

найдено = []
for папка in ("INBOX", "Junk", "Spam"):
    try:
        код, _ = м.select(папка)
        if код != "OK":
            continue
    except Exception:
        continue
    код, данные = м.search(None, "ALL")
    ид = (данные[0].split() or [])[-15:]          # последние пятнадцать писем
    for i in reversed(ид):
        код, сырое = м.fetch(i, "(RFC822)")
        if код != "OK":
            continue
        п = email.message_from_bytes(сырое[0][1])
        тема = str(make_header(decode_header(п.get("Subject") or "")))
        когда = п.get("Date") or ""
        тело = текстом(п)
        цифры = re.findall(r"(?<!\d)(\d{6})(?!\d)", тема + "\n" + тело)
        найдено.append({"папка": папка, "когда": когда, "от": п.get("From", "")[:60],
                        "тема": тема[:90], "коды": цифры[:3]})

м.logout()

print("писем просмотрено:", len(найдено))
for з in найдено[:8]:
    print(" ", з["когда"][:31], "|", з["папка"], "|", з["от"])
    print("   ", з["тема"])
    if з["коды"]:
        print("    КОД:", ", ".join(з["коды"]))
