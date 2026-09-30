# -*- coding: utf-8 -*-
"""Проверка _wata_состояние на выдуманных ответах кассы.

Главное, что проверяется: протухшая ссылка (Closed, без единой удачной
транзакции) НЕ считается оплаченной. Первая редакция считала, и это
стоило бы коинов даром.
"""
import os, sys
os.environ["AMBERRY_PAY_PROVIDER"] = "wata"
os.environ["AMBERRY_PAY_SHOP"] = "wata"
os.environ["AMBERRY_PAY_SECRET"] = "проба"
sys.path.insert(0, ".")
import счёт

случаи = [
    ("оплачено", {"items": [{"status": "Paid", "kind": "Payment"}]}, None, "оплачен"),
    ("ждём, транзакций нет, ссылка жива", {"items": []}, {"status": "Opened"}, "ждём"),
    ("ПРОТУХЛА: нет транзакций, ссылка Closed", {"items": []}, {"status": "Closed"}, "отменён"),
    ("платёж в процессе", {"items": [{"status": "Pending", "kind": "Payment"}]}, None, "ждём"),
    ("карта отклонена", {"items": [{"status": "Declined", "kind": "Payment"}]}, None, "ждём"),
    ("отклонили, потом оплатили", {"items": [{"status": "Declined", "kind": "Payment"},
                                             {"status": "Paid", "kind": "Payment"}]}, None, "оплачен"),
    ("ВОЗВРАТ не считается оплатой", {"items": [{"status": "Paid", "kind": "Refund"}]},
     {"status": "Opened"}, "ждём"),
]

плохо = 0
for имя, сделки, ссылка, ждём in случаи:
    ответы = [сделки] + ([ссылка] if ссылка else [])
    счёт._зов = lambda *а, **к: ответы.pop(0)
    вышло = счёт._wata_состояние("id-1")
    знак = "ок  " if вышло == ждём else "МИМО"
    if вышло != ждём:
        плохо += 1
    print("%s %-38s ждали %-9s вышло %s" % (знак, имя, ждём, вышло))
print("\nпровалов:", плохо)
sys.exit(1 if плохо else 0)
