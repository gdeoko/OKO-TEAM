# -*- coding: utf-8 -*-
"""Оформление канала YouTube DIESEL по паспорту фактов.

Правится описание (в старом стояли необеспеченные обещания "ниже рынка" и
"за 24 часа": такого числа в паспорте нет, а выдуманное число это обещание от
имени клиента), пустые ключевые слова и пустая страна.
Проверка идёт по ЖИВОМУ каналу после сохранения, а не по коду ответа.
  YT_DRY=1 - показать и не сохранять.
"""
import json, os, sys, urllib.parse, urllib.request

СТРАНА = "RU"

ОПИСАНИЕ = """Техника из Китая под ключ.

Квадроциклы, мотоциклы, гидроциклы, снегоходы и оборудование напрямую от поставщиков.

Цена собирается открыто: закупка, логистика, таможня. Доставка 3.5$ за кг фиксом, срок 30-35 дней, гарантия карго-компании 1 год.

Из работы: квадроцикл LONCIN xwolf 1000 MUD вышел клиенту в 11 310$ под ключ с доставкой до Москвы.

Напишите модель, которую хотите привезти, и мы посчитаем её под ваш запрос.

Подписывайтесь: показываем, из чего складывается цена и где теряют деньги на логистике."""

# Площадка режет поле примерно на 300 знаках и сама оборачивает фразы в кавычки,
# поэтому список идёт по убыванию ценности, а не по алфавиту. Питбайк убран:
# дешёвые мотоциклы у клиента под запретом.
СЛОВА = ("техника из китая, квадроцикл из китая, мотоцикл из китая, гидроцикл из китая, "
         "снегоход из китая, спецтехника из китая, мототехника из китая, "
         "доставка техники из китая, карго из китая, поставка техники из китая, "
         "растаможка техники, таможенное оформление техники, закупка техники в китае")

ТИРЕ = "\u2014"   # длинное тире, самим символом его в репозиторий нельзя


def нужен(*имена):
    for и in имена:
        v = os.environ.get(и)
        if v:
            return v
    raise SystemExit("нет ни одного из: " + ", ".join(имена))


def токен():
    тело = urllib.parse.urlencode({
        "client_id": нужен("CLIENT_YT_CLIENT_ID", "YT_CLIENT_ID"),
        "client_secret": нужен("CLIENT_YT_CLIENT_SECRET", "YT_CLIENT_SECRET"),
        "refresh_token": нужен("CLIENT_DIESEL_YT_REFRESH_TOKEN", "YT_REFRESH_TOKEN"),
        "grant_type": "refresh_token"}).encode()
    return json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token", тело, timeout=40))["access_token"]


def зов(т, путь, метод="GET", данные=None):
    з = urllib.request.Request(
        "https://www.googleapis.com/youtube/v3/" + путь,
        data=json.dumps(данные).encode() if данные is not None else None,
        headers={"Authorization": "Bearer " + т, "Content-Type": "application/json"},
        method=метод)
    return json.load(urllib.request.urlopen(з, timeout=60))


def главное():
    if ТИРЕ in ОПИСАНИЕ or ТИРЕ in СЛОВА:
        print("RESULT FAIL длинное тире в тексте")
        return 2
    if len(СЛОВА) > 500:
        print("RESULT FAIL ключевых слов больше 500 знаков:", len(СЛОВА))
        return 2

    т = токен()
    д = зов(т, "channels?part=snippet,brandingSettings&mine=true")
    к = д["items"][0]
    было = к.get("brandingSettings", {}).get("channel", {})
    print("канал:", к["snippet"]["title"], "| было слов:", len(было.get("keywords") or ""),
          "| страна:", было.get("country") or "(пусто)", "| описание:", len(было.get("description") or ""))

    канал = dict(было)
    канал["description"] = ОПИСАНИЕ
    канал["keywords"] = СЛОВА
    канал["country"] = СТРАНА
    тело = {"id": к["id"], "brandingSettings": dict(к.get("brandingSettings", {}), channel=канал)}

    if os.environ.get("YT_DRY") == "1":
        print("СУХО. описание", len(ОПИСАНИЕ), "знаков, слов", len(СЛОВА), "знаков, страна", СТРАНА)
        print(ОПИСАНИЕ)
        return 0

    зов(т, "channels?part=brandingSettings", "PUT", тело)
    # смотрим ЖИВОЙ канал, а не код ответа
    п = зов(т, "channels?part=brandingSettings&mine=true")["items"][0]["brandingSettings"]["channel"]
    # Площадка сама переписывает список в кавычки и режет хвост, поэтому сверяем СОСТАВ фраз,
    # а не строку: строковое равенство тут даёт ложную тревогу на успешной правке.
    import re
    встали = set(re.findall(r'"([^"]+)"', п.get("keywords") or "")) or set(
        x.strip() for x in (п.get("keywords") or "").split() if x.strip())
    хотели = set(x.strip() for x in СЛОВА.split(",") if x.strip())
    нет = sorted(хотели - встали)
    if нет:
        print("площадка не взяла:", ", ".join(нет))
    ок = (п.get("description") == ОПИСАНИЕ and п.get("country") == СТРАНА and not нет)
    print("стало: описание", len(п.get("description") or ""), "| слова", len(п.get("keywords") or ""),
          "| страна", п.get("country") or "(пусто)")
    print("RESULT OK оформление встало" if ок else "RESULT FAIL канал отдаёт другое")
    return 0 if ок else 1


sys.exit(главное())
