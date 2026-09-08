# Оформление канала YouTube DIESEL: название, описание, ключевые слова, ссылки, аватар, шапка.
import json, os, urllib.parse, urllib.request

ТИРЕ = "\u2014"   # длинное тире, самим символом его в репозиторий нельзя

def нужен(*имена):
    """У DIESEL своя пара ключей, у OKO своя. Берём первое непустое имя из списка."""
    for и in имена:
        v = os.environ.get(и)
        if v: return v
    raise SystemExit("нет ни одного из: " + ", ".join(имена))

тело = urllib.parse.urlencode({
    "client_id": нужен("CLIENT_YT_CLIENT_ID", "YT_CLIENT_ID"), "client_secret": нужен("CLIENT_YT_CLIENT_SECRET", "YT_CLIENT_SECRET"),
    "refresh_token": нужен("CLIENT_DIESEL_YT_REFRESH_TOKEN", "YT_REFRESH_TOKEN"), "grant_type": "refresh_token"}).encode()
т = json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", тело, timeout=40))["access_token"]

def зов(путь):
    з = urllib.request.Request("https://www.googleapis.com/youtube/v3/" + путь,
                               headers={"Authorization": "Bearer " + т})
    return json.load(urllib.request.urlopen(з, timeout=40))

д = зов("channels?part=snippet,brandingSettings,statistics,contentDetails&mine=true")
for к in д.get("items", []):
    с, б = к["snippet"], к.get("brandingSettings", {})
    канал = б.get("channel", {})
    print("название:", с.get("title"))
    print("ник:", с.get("customUrl"))
    print("страна:", с.get("country") or "(пусто)")
    print("описание:", json.dumps(с.get("description") or "", ensure_ascii=False))
    print("длина описания:", len(с.get("description") or ""))
    print("ключевые слова:", json.dumps(канал.get("keywords") or "", ensure_ascii=False))
    print("трейлер для новых:", канал.get("unsubscribedTrailer") or "(нет)")
    print("аватар:", "есть" if с.get("thumbnails", {}).get("high", {}).get("url") else "НЕТ")
    print("шапка:", "есть" if б.get("image", {}).get("bannerExternalUrl") else "НЕТ")
    print("подписчиков:", к["statistics"].get("subscriberCount"), "видео:", к["statistics"].get("videoCount"))
    print("длинное тире в описании:", ТИРЕ in (с.get("description") or ""))
