# -*- coding: utf-8 -*-
"""Трейлер канала для новых зрителей: лучший ролик по просмотрам.

Без трейлера новый человек попадает на пустую шапку и уходит. Берём не свежий,
а САМЫЙ СМОТРИМЫЙ: он уже доказал, что удерживает.
  YT_DRY=1 - показать выбор и не сохранять.
"""
import json, os, sys, urllib.parse, urllib.request


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


канал = зов("channels?part=contentDetails,brandingSettings&mine=true")["items"][0]
загрузки = канал["contentDetails"]["relatedPlaylists"]["uploads"]

ролики, стр = [], None
while True:
    п = "playlistItems?part=contentDetails&maxResults=50&playlistId=" + загрузки + (("&pageToken=" + стр) if стр else "")
    д = зов(п)
    ролики += [э["contentDetails"]["videoId"] for э in д["items"]]
    стр = д.get("nextPageToken")
    if not стр:
        break

лучшие = []
for i in range(0, len(ролики), 50):
    д = зов("videos?part=snippet,statistics&id=" + ",".join(ролики[i:i + 50]))
    for в in д["items"]:
        лучшие.append((int(в["statistics"].get("viewCount", 0)), в["id"], в["snippet"]["title"]))
лучшие.sort(reverse=True)

print("роликов:", len(лучшие))
for п, ид, наз in лучшие[:5]:
    print("  ", п, "просмотров |", ид, "|", наз[:70])

если_нет = канал.get("brandingSettings", {}).get("channel", {}).get("unsubscribedTrailer")
print("трейлер сейчас:", если_нет or "(нет)")
if not лучшие:
    print("RESULT FAIL роликов нет")
    sys.exit(1)
выбран = лучшие[0][1]
if os.environ.get("YT_DRY") == "1":
    print("СУХО. поставила бы", выбран)
    sys.exit(0)

канал_н = dict(канал.get("brandingSettings", {}).get("channel", {}))
канал_н["unsubscribedTrailer"] = выбран
зов("channels?part=brandingSettings", "PUT",
    {"id": канал["id"], "brandingSettings": dict(канал.get("brandingSettings", {}), channel=канал_н)})

стало = зов("channels?part=brandingSettings&mine=true")["items"][0]["brandingSettings"]["channel"].get("unsubscribedTrailer")
print("стало:", стало)
print("RESULT OK трейлер встал" if стало == выбран else "RESULT FAIL канал отдаёт другое")
sys.exit(0 if стало == выбран else 1)
