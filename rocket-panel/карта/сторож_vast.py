#!/usr/bin/env python3
"""Сторож баланса Vast: чтобы карта не встала молча.

На Vast карта работает, пока на счёте есть деньги. Кончились - машина
останавливается, бот перестаёт генерировать, а люди, заплатившие за
коины, получают осечки. 25.09.2026 на счёте было $7-14 при расходе
$28,5 в сутки: до остановки оставались часы, и никто этого не видел.

Раз в 15 минут (крон root):
  1. спрашивает у Vast остаток и что сейчас запущено;
  2. считает, на сколько часов хватит при нынешнем расходе;
  3. пишет /srv/amberry/vast.json - его показывает админка;
  4. ведёт историю остатка /srv/amberry/vast_история.json - из неё
     считается реальный расход за сутки и за месяц (падение остатка,
     пополнения не в счёт);
  5. когда остатка меньше чем на 72, 24 и 6 часов - пишет владельцам в
     Телеграм основным ботом. Каждый порог - один раз, пока остаток
     снова не поднимется выше него (пополнили - счётчик порогов сброшен).

Ключ - VAST_API_KEY в /etc/amberry-card.env, в git его нет.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

API = "https://console.vast.ai/api/v0"
СЕЙЧАС_ФАЙЛ = os.environ.get("VAST_NOW_FILE", "/srv/amberry/vast.json")
ИСТОРИЯ = os.environ.get("VAST_HISTORY_FILE", "/srv/amberry/vast_история.json")
ПОРОГИ = (72, 24, 6)                 # часов до остановки
ХРАНИТЬ = 40 * 86400                 # сколько держать историю


def env(путь):
    д = {}
    try:
        for строка in open(путь, encoding="utf-8"):
            if "=" in строка and not строка.lstrip().startswith("#"):
                к, _, з = строка.strip().partition("=")
                д[к] = з.strip().strip('"')
    except OSError:
        pass
    return д


def vast(путь, ключ):
    адрес = urllib.parse.urljoin(API + "/", путь.lstrip("/"))
    зап = urllib.request.Request(адрес,
                                 headers={"Authorization": "Bearer " + ключ})
    with urllib.request.urlopen(зап, timeout=30) as о:
        return json.loads(о.read())


def снять(ключ):
    """Остаток и запущенные машины."""
    кто = vast("/users/current/", ключ)
    машины = []
    # v0/instances/ объявлен устаревшим и отдаёт пустой список - только v1.
    спис = vast("/../v1/instances/", ключ)
    for м in спис.get("instances") or []:
        машины.append({
            "id": м.get("id"), "карта": м.get("gpu_name"),
            "метка": м.get("label"), "состояние": м.get("actual_status"),
            "в_час": round(float(м.get("dph_total") or 0), 4),
        })
    return float(кто.get("credit") or 0), машины


def расход_по_истории(ист, сейчас):
    """Падение остатка за сутки и с начала месяца. Рост - пополнение,
    его не считаем: иначе пополнение на $900 выглядело бы как минус."""
    def за(с):
        точки = [т for т in ист if т["t"] >= с]
        итого = 0.0
        for а, б in zip(точки, точки[1:]):
            if б["credit"] < а["credit"]:
                итого += а["credit"] - б["credit"]
        return round(итого, 2)
    лок = time.localtime(сейчас)
    начало_месяца = time.mktime((лок.tm_year, лок.tm_mon, 1, 0, 0, 0, 0, 0, -1))
    return за(сейчас - 86400), за(начало_месяца)


def известить(текст, конф):
    токен = конф.get("ROCKET_BOT_TOKEN", "")
    кому = [x for x in конф.get("ROCKET_ADMINS", "").replace(" ", "").split(",") if x]
    for к in кому:
        данные = urllib.parse.urlencode({"chat_id": к, "text": текст,
                                         "parse_mode": "HTML"}).encode()
        try:
            urllib.request.urlopen(
                f"https://api.telegram.org/bot{токен}/sendMessage",
                data=данные, timeout=20).read()
        except Exception as e:                      # noqa: BLE001
            print("не ушло", к, str(e)[:120], file=sys.stderr)


def главное():
    карта = env("/etc/amberry-card.env")
    бот = env("/etc/amberry.env")
    ключ = карта.get("VAST_API_KEY") or os.environ.get("VAST_API_KEY", "")
    if not ключ:
        raise SystemExit("нет VAST_API_KEY в /etc/amberry-card.env")
    сейчас = time.time()
    остаток, машины = снять(ключ)
    в_час = sum(м["в_час"] for м in машины if м["состояние"] == "running")
    часов = round(остаток / в_час, 1) if в_час else None

    try:
        ист = json.load(open(ИСТОРИЯ))
    except (OSError, ValueError):
        ист = []
    ист.append({"t": int(сейчас), "credit": round(остаток, 4), "dph": в_час})
    ист = [т for т in ист if т["t"] >= сейчас - ХРАНИТЬ]
    за_сутки, за_месяц = расход_по_истории(ист, сейчас)

    try:
        было = json.load(open(СЕЙЧАС_ФАЙЛ))
    except (OSError, ValueError):
        было = {}
    сказано = set(было.get("сказано") or [])
    # Пополнили - пороги выше нового запаса снова в силе.
    if часов is not None:
        сказано = {п for п in сказано if часов < п}
        # Самый срочный порог из пройденных; те, что выше, считаем уже
        # сказанными - «меньше 3 суток» после «меньше суток» не нужно.
        for п in sorted(ПОРОГИ):
            if часов < п:
                if п not in сказано:
                    известить(
                        "<b>Vast: деньги на карте кончаются</b>\n\n"
                        f"Остаток <b>${остаток:.2f}</b>, карта ест ${в_час:.2f}/ч "
                        f"(${в_час*24:.1f} в сутки).\n"
                        f"Хватит на <b>{часов:.0f} ч</b>. Кончится - карта "
                        "остановится и бот перестанет генерировать.\n\n"
                        "Пополнить: https://cloud.vast.ai/billing/", бот)
                сказано |= {x for x in ПОРОГИ if x >= п}
                break

    json.dump({
        "остаток": round(остаток, 2), "в_час": round(в_час, 4),
        "в_сутки": round(в_час * 24, 2), "часов": часов,
        "за_сутки": за_сутки, "за_месяц": за_месяц,
        "машины": машины, "когда": int(сейчас), "сказано": sorted(сказано),
    }, open(СЕЙЧАС_ФАЙЛ + ".tmp", "w"), ensure_ascii=False)
    os.replace(СЕЙЧАС_ФАЙЛ + ".tmp", СЕЙЧАС_ФАЙЛ)
    json.dump(ист, open(ИСТОРИЯ + ".tmp", "w"))
    os.replace(ИСТОРИЯ + ".tmp", ИСТОРИЯ)
    for ф in (СЕЙЧАС_ФАЙЛ, ИСТОРИЯ):
        os.chmod(ф, 0o644)
    print(f"остаток ${остаток:.2f}, ${в_час:.3f}/ч, хватит на {часов} ч")


if __name__ == "__main__":
    главное()
