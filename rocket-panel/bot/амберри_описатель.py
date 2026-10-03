# -*- coding: utf-8 -*-
"""Описатель: фото клиентки -> текст для промпта.

## Зачем он вообще

`z-image-spicy-pro` не принимает ни референса, ни маски, ни адаптера: у
него на входе ОДИН текст. Значит всё, что должно прийти с фото
клиентки - лицо, волосы, тон кожи, телосложение, возраст, - обязано
стать словами. Это и делает описатель.

## Почему спрашиваем именно эту модель

Claude в этой роли отказывает через раз, и его отказ однажды уехал
прямо в промпт генерации вместо внешности. `gpt-5-5` отвечает
описанием устойчиво. Цена около цента за фото, и платится она ОДИН
раз на клиентку, а не на каждый кадр: описание живёт в её карточке.

## Почему так подробно

Коротким списком из шести слов движок рисует «девушку вообще».
Владелец 03.10.2026: «проси очень точно описывать внешность детали
волосы возраст прям очень детально». Поэтому задание разбито на
именованные части, и у каждой сказано, что в ней назвать. Волосам
отдана отдельная часть: `inswapper` ставит только лицо, а волосы
целиком на совести текста, и «long brown hair» даёт чужую причёску.

## Отказ не уезжает в промпт

Ответ проверяется на слова отказа. Нашлось - описание считается
несостоявшимся, и наверх уходит пустое, а не извинение модели.
"""
import base64
import json
import os
import re
import urllib.request

БАЗА = os.environ.get("APIMODELS_BASE", "https://api.apimodels.app/v1")
МОДЕЛЬ = os.environ.get("AMBERRY_OPISATEL", "gpt-5-5")
ЗАПАС = os.environ.get("AMBERRY_OPISATEL_ZAPAS", "gemini-3.1-flash-lite")
ПРЕДЕЛ = 1000

ОТКАЗЫ = ("can't help", "cannot help", "can't assist", "cannot assist",
          "i'm unable", "i am unable", "not able to", "i won't",
          "i'm sorry", "i am sorry", "unable to provide")

ЗАДАНИЕ = (
    "Describe this person's appearance for a photorealistic image "
    "generator. Write ENGLISH, one single line of comma separated "
    "phrases, no sentences, no preamble, at most 110 words. Be exact "
    "and concrete: this description is the ONLY thing the generator "
    "will know about the person, so a vague word costs a different "
    "face. Cover these in this order and skip nothing:\n"
    "1. AGE: a number of years, not a decade.\n"
    "2. FACE: face shape, forehead, cheekbones, jaw and chin shape.\n"
    "3. EYES: colour, shape, how deep set, eyelid type, eyebrow shape "
    "and thickness and colour.\n"
    "4. NOSE AND MOUTH: nose bridge and tip, lip fullness, lip colour, "
    "shape of the upper lip.\n"
    "5. SKIN: tone with its undertone, and any freckles, moles or "
    "marks you can actually see.\n"
    "6. HAIR, in detail: exact colour with its shade and any roots or "
    "highlights, length measured against the body (to the chin, the "
    "collarbone, the mid back), texture (straight, wavy, curly, "
    "coiled), thickness, the parting, a fringe or none, and how it "
    "falls around the face.\n"
    "7. BUILD: overall build, shoulders, waist, hips, belly, thighs, "
    "and how tall and heavy the person looks.\n"
    "8. %s\n"
    "Describe only the person. Say nothing about the clothes, the "
    "background, the pose or the photograph itself. Output only the "
    "description.")
ХВОСТ_Ж = ("CHEST: breast size, shape, how they sit and how far apart "
           "they are; and the shape of the buttocks and the legs.")
ХВОСТ_М = ("BODY: chest and shoulder muscle, arm and leg muscle, body "
           "hair, and the shape of the buttocks.")


def _ключ():
    return (os.environ.get("APIMODELS_KEY")
            or os.environ.get("ROCKET_API_KEY") or "")


def _спросить(модель, снимок, задание, таймаут=120):
    тело = {"model": модель, "max_tokens": 600, "messages": [
        {"role": "user", "content": [
            {"type": "image_url", "image_url": {
                "url": "data:image/jpeg;base64," + base64.b64encode(
                    снимок).decode()}},
            {"type": "text", "text": задание}]}]}
    req = urllib.request.Request(
        БАЗА + "/chat/completions", data=json.dumps(тело).encode(),
        headers={"Authorization": "Bearer " + _ключ(),
                 "Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=таймаут) as о:
        д = json.loads(о.read().decode())
    т = (д.get("choices") or [{}])[0].get("message", {}).get("content", "")
    if isinstance(т, list):
        т = " ".join(x.get("text", "") for x in т)
    return " ".join(str(т).split())


def описать(снимок, пол="ж"):
    """Снимок (байты jpeg/png) -> строка для промпта. Пустая при отказе.

    Пол решает последнюю часть задания: у женщины спрашиваем грудь и
    ягодицы, у мужчины мускулатуру. Без этого модель про грудь мужчины
    пишет «flat chest» и движок рисует подростка.
    """
    задание = ЗАДАНИЕ % (ХВОСТ_М if str(пол).lower().startswith(("м", "m"))
                         else ХВОСТ_Ж)
    for модель in (МОДЕЛЬ, ЗАПАС):
        try:
            т = _спросить(модель, снимок, задание)
        except Exception as e:                              # noqa: BLE001
            print("ОПИСАТЕЛЬ %s: %s" % (модель, str(e)[:120]), flush=True)
            continue
        if not т:
            continue
        if any(x in т.lower() for x in ОТКАЗЫ):
            print("ОПИСАТЕЛЬ %s отказал: %s" % (модель, т[:90]), flush=True)
            continue
        # Нумерация задания иногда уезжает в ответ: движку она мусор.
        т = re.sub(r"\b[1-8]\s*[.):]\s*", "", т)
        т = re.sub(r"\s*\n+\s*", ", ", т).strip(" ,.")
        return т[:ПРЕДЕЛ]
    return ""


def коротко(описание, слов=28):
    """Укороченное описание, когда полное не влезает в предел промпта."""
    куски = [к.strip() for к in str(описание).split(",") if к.strip()]
    итог, всего = [], 0
    for к in куски:
        н = len(к.split())
        if всего + н > слов:
            break
        итог.append(к)
        всего += н
    return ", ".join(итог)
