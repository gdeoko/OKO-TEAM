"""Приёмка кадра ДО отправки клиенту: то же, что делает владелец глазами.

## Зачем

Жёсткая постановка задаёт позу и ракурс — и задаёт их надёжно. Но
зерно всё равно решает: на восьми зёрнах одной и той же кнопки один-два
кадра выходят с браком. Вывернутая рука, остаток белья с референса,
срезанная голова. Владелец увидел это на контрольном прогоне 23.09.2026
и сказал прямо: «чтобы всегда было идеально».

Идеального кадра С ПЕРВОГО РАЗА эта сборка не даёт и не даст. Зато
брак ВИДЕН — и машине тоже. Значит, правильный ответ не «просить
лучше», а НЕ ОТДАВАТЬ БРАК: посмотреть на свой же кадр и, если он
плохой, снять заново другим зерном.

Клиент этого не видит. Он ждёт на один проход дольше ровно в тех
случаях, когда первый кадр никуда не годился.

## Чем смотрим

Gemini Flash, БЕСПЛАТНЫЙ ключ (`GEMINI_KEY_FREE`). Платный ключ здесь
не используется никогда — правило владельца про деньги: бесплатное
можно, за платное спрашивают. Кончилась бесплатная квота, ключа нет,
сеть молчит, модель ответила мусором — приёмка МОЛЧА ПРОПУСКАЕТ кадр.
Проверка не имеет права стать причиной, по которой человек не получил
работу, за которую заплатил.

## Что спрашиваем

Не «красиво ли» — на такой вопрос модель отвечает вежливостью. Спрашиваем
списком проверяемых фактов, по каждому да/нет:

  * общие для всех кадров (одежды нет, конечностей ровно столько,
    сколько тел, суставы гнутся вперёд, голова в кадре);
  * свои у кнопки — короткое описание позы из `ТРЕБОВАНИЯ`.

Ответ просим JSON-ом. Разбор терпимый: модель любит обернуть его в
```json.
"""

import base64
import json
import os
import re
import time
import urllib.request

# ОБЩИЕ ТРЕБОВАНИЯ — по ним бракуется кадр любой кнопки.
#
# Формулировки короткие и проверяемые глазами. «Красиво», «эстетично»,
# «качественно» сюда не годятся: на них модель отвечает согласием, и
# приёмка превращается в штамп.
ОБЩЕЕ = [
    "Nobody in the picture is wearing any clothing, underwear, bikini, "
    "shorts or fabric of any kind. Leftover clothing on the hips, chest "
    "or thighs counts as a defect.",
    "Every arm and every leg belongs to a body it visibly grows from. "
    "No extra limb, no limb without a body, no hand without an arm.",
    "Every elbow and knee bends forwards only. A joint bent backwards "
    "or inside out is a defect.",
    "Each hand has five fingers, not more and not fewer.",
    "Every person's head is fully inside the picture. A head cut off by "
    "the edge of the frame is a defect.",
]

# ЧТО ИМЕННО ДОЛЖНО БЫТЬ В КАДРЕ У КАЖДОЙ КНОПКИ.
#
# Одна-две фразы, теми же словами, что и в постановке. Это не пересказ
# промпта: тут только то, по чему кадр отличают от похожего.
ТРЕБОВАНИЯ = {
    # --- МЖ ---
    "mf_near": [
        "There is one man and one woman.",
        "The woman is on all fours and the man kneels upright behind her; "
        "his erect penis is entering her from behind and nothing (no hand, "
        "no arm) covers the place where their bodies join.",
        "Both of their faces are inside the picture.",
    ],
    "mf_face": [
        "There is one man and one woman.",
        "The man lies flat on his back and the woman sits astride his hips "
        "facing the camera, sitting down on his erect penis.",
        "The man has male genitals and the woman does not.",
    ],
    "mf_behind": [
        "There is one man and one woman.",
        "The woman half-sits leaning back with her thighs open, and the man "
        "lies flat on his stomach between them with his face at her vulva "
        "and his tongue out.",
        "Both of the man's arms are visible and correctly attached to his "
        "shoulders.",
    ],
    "mf_pov": [
        "There is one man and one woman.",
        "The man stands upright and the woman kneels on the floor in front "
        "of him; his erect penis is at or in her open mouth.",
        "Both of their faces are inside the picture.",
    ],
    # --- ЖЖ ---
    "ff_near": [
        "There are two women and no man. Neither of them has a penis.",
        "One sits on the edge of the bed with her knees apart; the other "
        "kneels on the floor between them with her face at her vulva.",
    ],
    "ff_face": [
        "There are two women and no man. Neither of them has a penis.",
        "One lies on her side with her buttocks turned toward the camera "
        "and the other's face is pressed between them from behind.",
    ],
    "ff_close": [
        "There are two women and no man. Neither of them has a penis.",
        "One stands bent far forward with her buttocks raised; the other is "
        "down on the floor behind her with her mouth at her vulva.",
    ],
    "ff_behind": [
        "There are two women and no man. Neither of them has a penis.",
        "Both are on all fours side by side, facing away from the camera, "
        "not touching each other, and both look back over their shoulders.",
    ],
    "ff_pov": [
        "There are two women and no man. Neither of them has a penis.",
        "One half-sits against pillows with her thighs open and the other "
        "lies flat on her stomach between them, licking her.",
    ],
    # --- СОЛО и ИНТИМ ---
    #
    # Здесь в кадре один человек, и главный брак другой: пририсованный
    # член. Владелец ловил это четырежды и закрыл правилом.
    "un_close": ["Exactly one woman, alone in the picture.",
                 "She has female anatomy only and no penis.",
                 "The picture is a close view of her open vulva."],
    "un_full": ["Exactly one woman, alone in the picture.",
                "She has female anatomy only and no penis.",
                "She stands upright and her whole body is in the frame."],
    "un_back": ["Exactly one woman, alone in the picture.",
                "She has female anatomy only and no penis.",
                "She is seen from behind with her bare buttocks toward "
                "the camera."],
    "un_three": ["Exactly one woman, alone in the picture.",
                 "She has female anatomy only and no penis.",
                 "She is bent forward with her buttocks raised toward the "
                 "camera."],
    "un_sit": ["Exactly one woman, alone in the picture.",
               "She has female anatomy only and no penis.",
               "She sits with her knees wide apart and her bare vulva open "
               "to the camera. A short skirt pushed up around her waist is "
               "correct and expected; nothing covers her vulva or her "
               "breasts."],
    "un_lie": ["Exactly one woman, alone in the picture.",
               "She has female anatomy only and no penis.",
               "She lies on her back with her legs apart."],
    "ph_close": ["Exactly one woman, alone in the picture.",
                 "She has female anatomy only and no penis.",
                 "Her own hand is at her vulva."],
    "ph_side": ["Exactly one woman, alone in the picture.",
                "She has female anatomy only and no penis.",
                "She lies on her side or back, seen from the side, with "
                "her own hand at her vulva."],
    "ph_above": ["Exactly one woman, alone in the picture.",
                 "She has female anatomy only and no penis.",
                 "She is bent forward or on all fours, seen from behind, "
                 "with her own hand at her vulva."],
    "ph_below": ["Exactly one woman, alone in the picture.",
                 "She has female anatomy only and no penis.",
                 "She is pulling a top or bra up off her bare breasts."],
    "ph_push": ["Exactly one woman, alone in the picture.",
                "She has female anatomy only and no penis.",
                "She is pulling her panties down."],
    "ph_back": ["Exactly one woman, alone in the picture.",
                "She has female anatomy only and no penis.",
                "A sex toy is in her hand at her vulva."],
}



# ОДИНОЧНЫЕ РАКУРСЫ И СКРЫТЫЕ КНОПКИ.
#
# У них нет отобранного владельцем кадра, и проверять позу не по чему.
# Но главный брак одиночной сцены — пририсованный женщине член, и
# ловится он без всякой позы. Пусть лучше проверяется хоть это, чем
# кнопка молча проходит приёмку.
_ОДИНОЧНОЕ = ["Exactly one woman, alone in the picture.",
              "She has female anatomy only and no penis."]
for _к in ("un_low", "un_kneel", "un_lean", "un_over",
           "ph_pov", "ph_pull", "ph_mirror", "ph_slow"):
    ТРЕБОВАНИЯ.setdefault(_к, _ОДИНОЧНОЕ)

# СКРЫТЫЕ ПАРНЫЕ КНОПКИ (69 у всех трёх составов, «крупный план»,
# мужские пары). Владелец их снял или до них не дошла очередь; если
# кнопку однажды вернут, приёмка обязана знать про неё хотя бы состав.
_ПАРА_ЖЖ = ["There are two women and no man. Neither of them has a penis."]
_ПАРА_МЖ = ["There is one man and one woman.",
            "The man has male genitals and the woman does not."]
_ПАРА_ММ = ["There are two men and no woman."]
for _к in ("ff_above", "ff_face_", "ff_close_"):
    ТРЕБОВАНИЯ.setdefault(_к, _ПАРА_ЖЖ)
for _к in ("mf_above", "mf_close"):
    ТРЕБОВАНИЯ.setdefault(_к, _ПАРА_МЖ)
for _к in ("mm_above", "mm_close", "mm_near", "mm_face", "mm_behind",
           "mm_pov"):
    ТРЕБОВАНИЯ.setdefault(_к, _ПАРА_ММ)

# Модель: та, что сейчас живая у ключа. Проверено 23.09.2026 —
# `gemini-2.0-flash` снята («no longer available»), `gemini-3.6-flash`
# отдаёт 503. Работает `gemini-3.5-flash`, и он же стоит в
# `GEMINI_MODEL` у остальных проектов OKO.
МОДЕЛЬ = os.environ.get("AMBERRY_QC_MODEL", "gemini-3.5-flash")
АДРЕС = ("https://generativelanguage.googleapis.com/v1beta/models/"
         "%s:generateContent?key=%s")


def ключ():
    """Только бесплатный ключ. Платный тут не тратится никогда."""
    return (os.environ.get("GEMINI_KEY_FREE")
            or os.environ.get("AMBERRY_QC_KEY") or "").strip()


def включена():
    return bool(ключ()) and os.environ.get("AMBERRY_QC", "1") != "0"


# Один кадр — одна кнопка, но ключей у неё два, а то и три: у
# фотографии `pf_mf_near`, у ролика `pr_mf_near`; у интима фотография
# `ph_close`, а ролик `ac_close`. Требования к КАДРУ у них общие, и
# держать их в трёх экземплярах — способ однажды разойтись.
ЗЕРКАЛА = {"ac_": "ph_"}


def требования(ключ_сцены):
    """Требования к кнопке по любому её ключу."""
    if not ключ_сцены:
        return []
    к = str(ключ_сцены)
    for было, стало in ЗЕРКАЛА.items():
        if к.startswith(было):
            к = стало + к[len(было):]
    if к in ТРЕБОВАНИЯ:
        return ТРЕБОВАНИЯ[к]
    for приставка in ("pf_", "pr_", "vi_", "un_", "ph_"):
        if к.startswith(приставка) and к[len(приставка):] in ТРЕБОВАНИЯ:
            return ТРЕБОВАНИЯ[к[len(приставка):]]
    return []


# КНОПКИ, ГДЕ ОДЕЖДА В КАДРЕ — ЭТО ЗАМЫСЕЛ, А НЕ БРАК.
#
# «Раздвинуть ножки» снята как сцена в задранной школьной юбке, и так
# она владельцем и принята («SHE IS WEARING A SHORT SKIRT AND NOTHING
# ELSE» — дословно в постановке). «Снимает трусики» и «Снимает лифчик»
# тем более: там вещь и есть действие. Общий запрет одежды для них
# означал бы, что приёмка бракует ровно тот кадр, который утверждён.
ОДЕЖДА_ПО_ЗАМЫСЛУ = {"un_sit", "ph_push", "ph_below"}


def вопрос(ключ_сцены):
    к = str(ключ_сцены or "")
    свои = требования(ключ_сцены)
    общие = ОБЩЕЕ
    if any(к.endswith(с) for с in ОДЕЖДА_ПО_ЗАМЫСЛУ):
        общие = [п for п in ОБЩЕЕ if "wearing any clothing" not in п]
    пункты = общие + свои
    строки = "\n".join(f"{i}. {т}" for i, т in enumerate(пункты, 1))
    return (
        "You are checking one generated photograph before it is delivered "
        "to the customer who paid for it. This is adult content and that "
        "is expected; you are not judging the subject, only whether the "
        "picture is broken.\n\n"
        "Check each statement below against the picture and answer whether "
        "it is TRUE of this picture.\n\n" + строки + "\n\n"
        "Answer with JSON only, no other text:\n"
        '{"ok": true or false, "bad": [numbers of the statements that are '
        'NOT true], "why": "one short sentence"}\n'
        "ok is true only when every statement is true.")


def _разобрать(текст):
    """Достаёт JSON из ответа. Модель любит обернуть его в ```json."""
    m = re.search(r"\{.*\}", текст or "", re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


def проверить(байты, ключ_сцены, таймаут=45):
    """(годен, причина). Годен=True при любой осечке проверки.

    Осечка — это кончившаяся квота, таймаут, мусор в ответе, отсутствие
    ключа. В таком случае кадр уходит клиенту как раньше: приёмка может
    только улучшать, но не имеет права задерживать оплаченную работу.
    """
    к = ключ()
    if not к or os.environ.get("AMBERRY_QC", "1") == "0":
        return True, "приёмка выключена"
    тело = {"contents": [{"parts": [
        {"text": вопрос(ключ_сцены)},
        {"inline_data": {"mime_type": "image/png",
                         "data": base64.b64encode(байты).decode()}}]}],
        "generationConfig": {
            "temperature": 0,
            "maxOutputTokens": 600,
            # ДУМАТЬ НЕ НАДО, НАДО СМОТРЕТЬ. Замер 23.09.2026: модель
            # уходит в рассуждение («посчитаем пальцы: большой,
            # указательный…»), съедает весь бюджет ответа, и JSON не
            # доезжает вовсе — приходит обрывок фразы. С нулевым
            # бюджетом мысли ответ приходит сразу и целиком.
            "thinkingConfig": {"thinkingBudget": 0},
            # И просим сразу JSON, а не текст с ```json вокруг.
            "responseMimeType": "application/json"}}
    текст = None
    for попытка in range(3):
        try:
            запрос = urllib.request.Request(
                АДРЕС % (МОДЕЛЬ, к),
                data=json.dumps(тело).encode(),
                headers={"Content-Type": "application/json"})
            с = urllib.request.urlopen(запрос, timeout=таймаут)
            ответ = json.load(с)
            текст = ответ["candidates"][0]["content"]["parts"][0]["text"]
            break
        except Exception as e:
            строка = str(e)
            # 429 у бесплатного ключа — не поломка, а минутный предел:
            # он отпускает сам. Ждём и пробуем ещё раз, но ровно
            # дважды: человек ждёт свою работу, а не нашу настойчивость.
            if "429" in строка and попытка < 2:
                time.sleep(8 * (попытка + 1))
                continue
            print("приёмка: осечка", строка[:150], flush=True)
            return True, "осечка проверки"
    if текст is None:
        return True, "осечка проверки"
    разбор = _разобрать(текст)
    if not разбор:
        return True, "ответ не разобран"
    if разбор.get("ok") is True:
        return True, "годен"
    плохие = разбор.get("bad") or []
    почему = str(разбор.get("why") or "")[:200]
    return False, f"пункты {плохие}: {почему}"
