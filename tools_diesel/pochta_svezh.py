# -*- coding: utf-8 -*-
"""Самое свежее письмо Instagram с кодом: показать кусок текста вокруг цифр.

Регулярка ловит в письме несколько шестизначных, и часть из них это не код.
Поэтому печатаем окружение каждой находки: код всегда стоит рядом со словами
про подтверждение.
"""
import email, imaplib, os, re
from email.header import decode_header, make_header
from email.utils import parsedate_to_datetime

АКК = (os.environ.get("IG_ACC") or "TOP").upper()
ЯЩИК = os.environ[f"IG_DS_{АКК}_EMAIL"]
ПАРОЛЬ = os.environ[f"IG_DS_{АКК}_EMAIL_PASS"]
ХОСТ = "mail." + ЯЩИК.split("@", 1)[1]

м = imaplib.IMAP4_SSL(ХОСТ, 993, timeout=40)
м.login(ЯЩИК, ПАРОЛЬ)
м.select("INBOX")
_, данные = м.search(None, "ALL")
ид = (данные[0].split() or [])[-6:]

лучшее = None
for i in reversed(ид):
    _, сырое = м.fetch(i, "(RFC822)")
    п = email.message_from_bytes(сырое[0][1])
    тема = str(make_header(decode_header(п.get("Subject") or "")))
    try:
        когда = parsedate_to_datetime(п.get("Date"))
    except Exception:
        continue
    if "instagram" not in (п.get("From") or "").lower():
        continue
    тело = ""
    for ч in (п.walk() if п.is_multipart() else [п]):
        if ч.get_content_type() == "text/plain":
            try:
                тело = ч.get_payload(decode=True).decode(ч.get_content_charset() or "utf-8", "ignore")
                break
            except Exception:
                pass
    if not тело:
        for ч in (п.walk() if п.is_multipart() else [п]):
            if ч.get_content_type() == "text/html":
                try:
                    сыро = ч.get_payload(decode=True).decode(ч.get_content_charset() or "utf-8", "ignore")
                    тело = re.sub(r"<[^>]+>", " ", сыро)
                    break
                except Exception:
                    pass
    if лучшее is None or когда > лучшее[0]:
        лучшее = (когда, тема, тело)

м.logout()

if not лучшее:
    raise SystemExit("писем от Instagram нет")
когда, тема, тело = лучшее
тело = re.sub(r"[ \t]+", " ", тело)
print("пришло:", когда.astimezone().strftime("%d.%m %H:%M %Z"))
print("тема:", тема)
print("---")
for м_ in re.finditer(r"(?<!\d)(\d{6})(?!\d)", тело):
    н, к = max(0, м_.start() - 90), min(len(тело), м_.end() + 90)
    print("НАЙДЕНО", м_.group(1), "::", " ".join(тело[н:к].split()))
    print()
