# -*- coding: utf-8 -*-
"""Длинное тире в опубликованных роликах DIESEL.

Правило владельца: длинного тире у нас не бывает нигде. Оно первый признак
машины, и стоит оно в заголовках, которые видит покупатель.
  без аргументов - только посчитать;  правь - заменить на дефис.
"""
import json, os, sys, urllib.parse, urllib.request

ТИРЕ = "\u2014"   # длинное тире, самим символом его в репозиторий нельзя
ПРАВИМ = len(sys.argv) > 1 and sys.argv[1] == "правь"


def нужен(*имена):
    for и in имена:
        v = os.environ.get(и)
        if v:
            return v
    raise SystemExit("нет ни одного из: " + ", ".join(имена))


тело = urllib.parse.urlencode({
    "client_id": нужен("CLIENT_YT_CLIENT_ID", "YT_CLIENT_ID"),
    "client_secret": нужен("CLIENT_YT_CLIENT_SECRET", "YT_CLIENT_SECRET"),
    "refresh_token": нужен("CLIENT_DIESEL_YT_REFRESH_TOKEN", "YT_REFRESH_TOKEN"),
    "grant_type": "refresh_token"}).encode()
Т = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", тело, timeout=40))["access_token"]


def зов(путь, метод="GET", данные=None):
    з = urllib.request.Request(
        "https://www.googleapis.com/youtube/v3/" + путь,
        data=json.dumps(данные).encode() if данные is not None else None,
        headers={"Authorization": "Bearer " + Т, "Content-Type": "application/json"},
        method=метод)
    return json.load(urllib.request.urlopen(з, timeout=60))


def чисто(т):
    """Тире меняем на дефис, а двойные пробелы вокруг не плодим."""
    return (т or "").replace(ТИРЕ + " ", "- ").replace(" " + ТИРЕ, " -").replace(ТИРЕ, "-")


канал = зов("channels?part=contentDetails&mine=true")["items"][0]
загрузки = канал["contentDetails"]["relatedPlaylists"]["uploads"]
ролики, стр = [], None
while True:
    д = зов("playlistItems?part=contentDetails&maxResults=50&playlistId=" + загрузки + (("&pageToken=" + стр) if стр else ""))
    ролики += [э["contentDetails"]["videoId"] for э in д["items"]]
    стр = д.get("nextPageToken")
    if not стр:
        break

грязные = []
for i in range(0, len(ролики), 50):
    for в in зов("videos?part=snippet,status&id=" + ",".join(ролики[i:i + 50]))["items"]:
        с = в["snippet"]
        if ТИРЕ in (с.get("title") or "") or ТИРЕ in (с.get("description") or ""):
            грязные.append(в)

print("роликов всего:", len(ролики), "| с длинным тире:", len(грязные))
for в in грязные[:60]:
    с = в["snippet"]
    где = ("заголовок" if ТИРЕ in (с.get("title") or "") else "") + (" описание" if ТИРЕ in (с.get("description") or "") else "")
    print("  ", в["id"], "|", где.strip(), "|", (с.get("title") or "")[:72])

if not ПРАВИМ or not грязные:
    sys.exit(0)

сделано, беда = 0, 0
for в in грязные:
    с = в["snippet"]
    нов = {"categoryId": с.get("categoryId", "22"), "title": чисто(с.get("title")),
           "description": чисто(с.get("description"))}
    if с.get("tags"):
        нов["tags"] = [чисто(t) for t in с["tags"]]
    if с.get("defaultLanguage"):
        нов["defaultLanguage"] = с["defaultLanguage"]
    try:
        зов("videos?part=snippet", "PUT", {"id": в["id"], "snippet": нов})
        сделано += 1
    except Exception as e:
        беда += 1
        print("   не вышло", в["id"], str(e)[:120])

# проверяем по ЖИВОЙ выдаче, а не по коду ответа
осталось = 0
ид = [в["id"] for в in грязные]
for i in range(0, len(ид), 50):
    for в in зов("videos?part=snippet&id=" + ",".join(ид[i:i + 50]))["items"]:
        с = в["snippet"]
        if ТИРЕ in (с.get("title") or "") or ТИРЕ in (с.get("description") or ""):
            осталось += 1
print("правлено:", сделано, "| отказов:", беда, "| осталось с тире:", осталось)
print("RESULT OK тире нет" if осталось == 0 else "RESULT FAIL тире осталось")
sys.exit(0 if осталось == 0 else 1)
