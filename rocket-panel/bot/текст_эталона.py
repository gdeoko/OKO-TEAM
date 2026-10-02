# -*- coding: utf-8 -*-
"""Текст принятого эталона кнопки, пересказанный под клиента.

## Зачем

Замер 30.09.2026 на «Крупном плане» с Юки, одни и те же зёрна:

    наш собранный промпт     поза 0.27   кожа в разводах, спальня, руки не там
    текст эталона как есть   поза 0.23   Юки стала блондинкой, лицо 0.20
    текст эталона, своё      поза 0.13   лицо 0.44, кожа чище всех прошлых

Эталон владелец принял глазами, и его текст держит позу, ракурс и руки
лучше нашего собранного. Но он писался под Нику: «her light-blonde
hair», «petite young body with a small almost flat chest». Слова про
внешность у Qwen сильнее референса - темноволосая клиентка выходила
блондинкой. Поэтому внешность вычёркивается и заменяется словами «как на
снимке», а сцена, поза и свет остаются эталонными.

Только одиночные кнопки. У пар в эталонах порядок людей «блондинка
первая», а у заказа свой порядок снимков (см. catalog.полы), и
пересказ там надо сверять кадрами, а не заменой слов.
"""
import os
import re
import sys

_ТУЛЗЫ = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools")
if _ТУЛЗЫ not in sys.path:
    sys.path.insert(0, _ТУЛЗЫ)

СВОЯ_ВНЕШНОСТЬ = ("her own hair exactly as in the reference photo - the same colour, "
                  "length and fringe - her own skin tone, and her own body and "
                  "breast size exactly as in the reference photo")

# Порядок важен: сперва длинные обороты, потом остатки.
_ЗАМЕНЫ = [
    (r"her light-blonde hair,\s*her petite young body with a small almost flat chest",
     СВОЯ_ВНЕШНОСТЬ),
    (r"her light-blonde hair,\s*her petite young body", СВОЯ_ВНЕШНОСТЬ),
    (r"her light-blonde hair", "her own hair exactly as in the reference photo"),
    (r"\blight-blonde\b", ""),
    (r"\bthe blonde\b", "the woman"),
    (r"\bThe blonde\b", "The woman"),
    # ВОЗРАСТ. Эталоны писались словами «petite young body, almost flat
    # chest», и на героине 20 лет «Крупный план» вышел с лицом заметно
    # моложе референса. Ни одного слова, которое модель может прочитать
    # как юность, в тексте не остаётся; грудь и сложение - как на снимке.
    (r"\b(small )?almost flat chest", "her own breast size as in the reference photo"),
    (r"\bpetite young\b", "adult"),
    (r"\byoung\b", "adult"),
    (r"\bpetite\b", ""),
]

ВЗРОСЛАЯ = ("She is an adult woman of about twenty-five with a mature adult face "
            "and a fully developed adult woman's body with womanly hips and "
            "natural adult breasts; she is not skinny and her ribs do not show.")

_КЭШ = {}

# КНОПКИ БЕЗ ПРИНЯТОГО ЭТАЛОНА. Их собранный текст - полторы страницы
# общих правил, и строка позы тонет в нём: на прогоне 30.09.2026 шесть
# кнопок (на коленях, снизу, сверху, опираясь, от первого лица, общий
# план) нарисовали одну и ту же позу «лёжа, руки за головой». Здесь
# текст сложен так же, как у принятых эталонов: сперва план и поза
# словами, которые нельзя прочитать двояко, потом кто она, потом тело
# одним куском, потом место. Место то же, что у эталонов.
_ОБЩЕЕ = ("This is the woman from the reference photo: her face unchanged, "
          + СВОЯ_ВНЕШНОСТЬ + ". Her whole face is inside the frame. She is "
          "completely nude. ONE single continuous body: one head on her own neck, "
          "one torso, two arms growing from her own shoulders, two legs growing "
          "from her own hips - two hands and two feet in all, every one traceable "
          "back along its own limb. Only one person in the frame. Black studio set "
          "with hot pink neon tubes glowing on the wall behind her, glossy black "
          "floor, soft white light from the front.")
_НАЧАЛО = "Photorealistic explicit photograph, matte dry skin, correct hands. "
СВОИ = {
    "un_kneel": "FULL-LENGTH SHOT, camera level with her chest. She KNEELS upright "
                "on the floor facing the camera, her knees wide apart, sitting back "
                "on her heels, back straight, both hands resting flat on her own "
                "thighs. Her bare breasts and her bare vulva between her open knees "
                "are both in plain view. Her face is to the lens. ",
    "un_low": "LOW-ANGLE SHOT: the camera is low, just above her knees, tilted up "
              "at her. She STANDS facing the camera, feet apart, both hands on her "
              "own hips. Her bare vulva, belly, breasts and face are all in view, "
              "and she looks down into the lens. ",
    "un_over": "HIGH-ANGLE SHOT: the camera looks DOWN at her from above at about "
               "sixty degrees. She SITS on the floor with her legs bent to one side, "
               "leaning back on one straight arm, one shoulder forward, her face "
               "turned UP to the lens. Her bare breasts and her bare vulva are in "
               "view. ",
    "un_lean": "FRONT VIEW, THREE-QUARTER SHOT from her head to her knees, camera "
               "straight in front of her at chest height. She FACES THE CAMERA "
               "SQUARELY with her back flat against the black wall behind her, "
               "shoulder blades and hips touching it, one foot raised flat against "
               "the wall so that knee comes forward and her thighs open, both arms "
               "down along the wall. Her bare breasts and her bare vulva face the "
               "lens, her eyes to the lens. Not in profile. ",
    "ph_pov": "POINT-OF-VIEW SHOT: the camera is the eyes of someone standing at her "
              "feet and looking down at her. She LIES ON HER BACK on the floor with "
              "her legs spread wide towards the camera, one hand between her thighs "
              "with two fingers on her own vulva, the other hand on her own breast, "
              "looking straight into the lens. No other person and no other hands. ",
    "ph_pull": "WIDE SHOT: the whole of her body and a good part of the studio are "
               "in the frame, camera at hip height. She SITS on the floor leaning "
               "back on one hand, knees up and wide apart, the other hand between "
               "her thighs touching her own vulva. Her face is to the lens. ",
    "ph_mirror": "FULL-LENGTH SHOT. She STANDS facing the camera, feet apart, one "
                 "hand between her thighs on her own vulva, the other hand on her hip. "
                 "Directly BEHIND her stands a tall mirror that shows her bare back, "
                 "buttocks and legs from behind in EXACTLY THE SAME STANDING POSE - "
                 "the true reflection of the same one woman, standing, with the same "
                 "arms. Her face, her bare breasts and her vulva face the lens. Exactly "
                 "ONE woman; no second face anywhere, no phone. ",
    "ph_slow": "CLOSE SHOT from her face down to her hips, 85mm, one large soft "
               "light, camera above her chest looking down along her body. She "
               "LIES ON HER BACK with her knees up and apart, one hand between her "
               "thighs with her fingers on her own vulva, the other hand resting "
               "on her belly. Her bare breasts are in view, eyes half closed "
               "towards the lens. ",
}


def _одиночная(ключ):
    return str(ключ or "").startswith(("un_", "ph_", "ac_"))


def _пара(ключ):
    """Пары МЖ и ЖЖ. У МM принятых эталонов нет вовсе."""
    return str(ключ or "").startswith(("pf_mf_", "pf_ff_", "pr_mf_", "pr_ff_"))


def _поддержана(ключ):
    return _одиночная(ключ) or _пара(ключ)


def _эталон(ключ):
    import промпты_эталонов as ПЭ
    з = ПЭ.загрузить()
    к = str(ключ or "")
    # Ролик и его фотография - одна кнопка (catalog._ЖЁСТКО_ДЛЯ), и сюда
    # приходит текст ПЕРВОГО прохода ролика, то есть фотографии. Поэтому
    # у ролика берётся эталон его фото, а не его собственный: тот писался
    # под движение.
    if к.startswith("ac_"):
        return з.get("ph_" + к[3:])
    if к.startswith("pr_"):
        return з.get("pf_" + к[3:])
    return з.get(к)


# ПАРЫ. Эталоны пар писались под Нику-блондинку, мужчину и
# темноволосую Алессу, и люди в них названы по внешности: «the blonde»,
# «the dark-haired one». У клиента внешность своя, поэтому люди
# называются по номеру снимка, а внешность - «как на снимке».
_ЗАМЕНЫ_ПАРЫ = [
    (r"is the blonde from", "is the woman from"),
    (r"her light-blonde hair,\s*her petite body(,| with a)? small almost flat chest",
     "her own hair exactly as in that photo, her own body and breast size as in that photo"),
    (r"long light-blonde hair, petite, small almost flat chest",
     "her own hair and body exactly as in that photo"),
    (r"her light-blonde hair", "her own hair exactly as in that photo"),
    (r"(her )?long dark( brown)? hair", "her own hair exactly as in that photo"),
    (r"his short hair", "his own hair as in that photo"),
    (r"his (lean )?athletic build", "his own build as in that photo"),
    (r"\bTHE BLONDE\b", "THE FIRST WOMAN"),
    (r"\bThe blonde\b", "The first woman"),
    (r"\bthe blonde\b", "the first woman"),
    (r"\bTHE DARK-HAIRED ONE\b", "THE SECOND WOMAN"),
    (r"\bThe dark-haired one\b", "The second woman"),
    (r"\bthe dark-haired one\b", "the second woman"),
    (r"\blight-blonde\b", ""),
    (r"\bpetite\b", ""),
    (r"\byoung\b", "adult"),
]
ВЗРОСЛЫЕ = ("Both people are adults in their twenties with mature adult faces and "
            "fully developed adult bodies.")


# ПАРЫ БЕЗ ПРИНЯТОГО ЭТАЛОНА. Их собранный текст на прогоне 01.10.2026
# дал «Крупный план» МЖ с двумя мужскими головами по краям кадра и
# девушкой между ними. Тексты сложены как у эталонов; порядок снимков
# здесь сразу наш (catalog.полы: у МЖ мужчина первый).
_ПАРА_МЖ = ("The man is the man from the first reference photo — his face, his own "
            "hair and his own build as in that photo. The woman is the woman from the "
            "second reference photo — her face, her own hair exactly as in that photo, "
            "her own body and breast size as in that photo. Exactly one man and one "
            "woman, nobody else, no extra heads. ")
_ПАРА_ЖЖ = ("The first woman is the woman from the first reference photo and the second "
            "woman is the woman from the second reference photo — each with her own "
            "face, her own hair and her own body exactly as in her photo. Exactly two "
            "women, nobody else, no extra heads. ")
_ПАРА_КОНЕЦ = ("Two separate whole bodies, four arms and four legs in all, every limb "
               "traceable to the one body it grows from. Both completely naked. Black "
               "studio with hot pink neon tubes on the wall behind them. "
               "Photorealistic explicit photograph, matte skin, correct hands.")
СВОИ_ПАРЫ = {
    "pf_mf_above": "TOP-DOWN SHOT from directly above the bed, both whole bodies inside "
                   "the frame, both faces turned UP to the lens. THE WOMAN lies on her "
                   "back with her knees up and apart, her bare breasts and her vulva in "
                   "view. THE MAN lies on his side close beside her, his head next to hers "
                   "on the same end of the bed, one of his hands between her thighs with "
                   "his fingers on her vulva. ",
    "pf_mf_close": "CLOSE SHOT of their two heads and upper bodies, camera at their eye "
                   "level: they kiss, his face and her face side by side and both clearly "
                   "visible, filling the upper half of the frame. Her bare breasts are in "
                   "view below, his hand cups one of her breasts. Only these two heads in "
                   "the picture. ",
    "pf_ff_above": "TOP-DOWN SHOT from directly above the bed, both whole bodies inside "
                   "the frame. THE TWO WOMEN lie on their backs side by side, heads at the "
                   "same end, both faces turned UP to the lens; each one's hand rests "
                   "between the other's thighs on her vulva; their bare breasts are in "
                   "view. ",
}


def _порядок_эталона(ключ):
    """Полы людей в порядке снимков, на которых считался эталон."""
    try:
        import промпты_эталонов as ПЭ
        з = _эталон(ключ) or {}
        г = ПЭ.граф(os.path.join(ПЭ.ЭТАЛОНЫ, з.get("файл", ""))) or {}
        энк = next((у for у in г.values()
                    if у.get("class_type") == "TextEncodeQwenImageEditPlus"), None)
        полы = []
        for и in range(1, 4):
            ссылка = (энк or {}).get("inputs", {}).get(f"image{и}")
            if not ссылка:
                continue
            имя = ((г.get(str(ссылка[0])) or {}).get("inputs", {}).get("image") or "")
            полы.append("м" if "muzh" in имя or "_м" in имя else "ж")
        return tuple(полы)
    except Exception:                                   # noqa: BLE001
        return ()


def порядок(ключ):
    """Полы людей в порядке снимков эталона пары, или () если эталона нет."""
    if not _пара(ключ):
        return ()
    return _порядок_эталона(ключ)


def _текст_пары(ключ, т):
    # В паре МЖ женщина одна, и «the blonde» там значит просто «она».
    if "_mf_" in ключ:
        т = re.sub(r"\bTHE BLONDE\b", "THE WOMAN", т)
        т = re.sub(r"\b[Tt]he blonde is the woman", "The woman is the woman", т)
        т = re.sub(r"\bThe blonde\b", "The woman", т)
        т = re.sub(r"\bthe blonde\b", "the woman", т)
    for было, стало in _ЗАМЕНЫ_ПАРЫ:
        т = re.sub(было, стало, т)
    # Номера снимков в тексте НЕ меняются: снимки сами переставляются в
    # порядок эталона (см. `порядок` и run_job). Рецепт эталона с героиней
    # на месте Ники дал верное действие во всех МЖ, а перестановка слов в
    # тексте при нашем порядке «мужчина первый» - нет (01.10.2026).
    т = re.sub(r"\s{2,}", " ", т).strip()
    return т + " " + ВЗРОСЛЫЕ


# ФОН ЭТАЛОНА ВЫРЕЗАЕТСЯ, А НЕ ПЕРЕБИВАЕТСЯ.
#
# Правило владельца 02.10.2026: «фон берётся либо с референса, если не
# выбрали фон, либо по кнопкам фонов — другого не может быть». Наша
# студия в этот список не входит, а описана она была во ВСЕХ 34
# эталонах прямым текстом: «Black studio set with hot pink neon tubes
# glowing on the wall behind her, glossy black floor». Приказ «эта
# комната перебивает названную выше» слабее подробного описания: модель
# видит неон словами и рисует неон.
#
# Поэтому фон вырезается из текста, и в промпте остаётся ровно одна
# комната — со снимка или выбранная.
#
# МЕБЕЛЬ ПОД ПОЗОЙ — НЕ ФОН. «Вдвоём раком» это поза НА КРОВАТИ, и без
# кровати её не существует. Кровать остаётся, цвет белья и стена с
# неоном уходят.
_БЕЗ_ФОНА = [
    # Отдельные фразы, которые целиком про нашу студию.
    (r"Black studio set[^.]*?glossy black floor[^.]*\.\s*", ""),
    (r"Black studio set[^.]*?neon[^.]*\.\s*", ""),
    (r"Black studio with hot pink neon tubes[^.]*\.\s*", ""),
    # Фразы, где вместе со студией названа кровать: кровать оставляем.
    (r"Black studio, hot pink neon tubes glowing on the wall behind them, "
     r"DARK bedding[^.]*\.\s*", "A wide bed with bedding and pillows. "),
    (r"Black studio, hot pink neon tubes glowing behind them, dark bedding\.\s*",
     "A wide bed with bedding. "),
    (r"A white bed with white sheets and pillows; behind it a black wall "
     r"with hot pink neon tubes glowing\.\s*",
     "A wide bed with sheets and pillows. "),
    # Пол назван внутри фразы о позе — вырезать фразу нельзя, поза в ней.
    (r"\bthe black floor\b", "the floor"),
    (r"\bthe glossy black floor\b", "the floor"),
    (r"\bdark bedding\b", "the bedding"),
    (r"\bblack sheets\b", "the sheets"),
    # Подстраховка: что угодно оставшееся со словом neon — это фон.
    (r"[^.]*\bneon\b[^.]*\.\s*", ""),
    (r"[^.]*\bblack studio\b[^.]*\.\s*", ""),
]


def без_фона(текст):
    """Текст эталона без НАШЕЙ комнаты. Поза и мебель под ней целы."""
    т = текст or ""
    for было, стало in _БЕЗ_ФОНА:
        т = re.sub(было, стало, т, flags=re.I)
    return re.sub(r"\s{2,}", " ", т).strip()


def промпт(ключ):
    """Текст эталона под клиента или None, если эталона нет."""
    if not _поддержана(ключ):
        return None
    try:
        з = _эталон(ключ)
    except Exception:                                   # noqa: BLE001
        return None
    if _пара(ключ):
        # ЧЕРЕЗ `без_фона` ТОЖЕ. Парная ветка возвращается раньше общей,
        # и забыть её значит оставить неон ровно на тех кнопках, где
        # людей двое и описание комнаты самое подробное.
        if з and з.get("промпт"):
            return без_фона(_текст_пары(str(ключ), з["промпт"]))
        к = str(ключ).replace("pr_", "pf_", 1)
        if к in СВОИ_ПАРЫ:
            кто = _ПАРА_МЖ if "_mf_" in к else _ПАРА_ЖЖ
            return без_фона("Explicit photograph. " + СВОИ_ПАРЫ[к] + кто
                            + _ПАРА_КОНЕЦ + " " + ВЗРОСЛЫЕ)
        return None
    if not з or not з.get("промпт"):
        к = str(ключ)
        свой = СВОИ.get(к) or (СВОИ.get("ph_" + к[3:]) if к.startswith("ac_") else None)
        if not свой:
            return None
        з = {"промпт": _НАЧАЛО + свой + _ОБЩЕЕ}
    т = з["промпт"]
    for было, стало in _ЗАМЕНЫ:
        т = re.sub(было, стало, т)
    т = re.sub(r"\s{2,}", " ", т).strip()
    # Сразу после первой фразы (про фотореализм), до описания сцены.
    т = re.sub(r"^([^.]*\.)", r"\1 " + ВЗРОСЛАЯ, т, count=1)
    return без_фона(т)


def негатив(ключ):
    """Негатив из графа эталона. Он там свой, длинный и проверенный."""
    if not _поддержана(ключ):
        return None
    if ключ in _КЭШ:
        return _КЭШ[ключ]
    н = None
    try:
        import промпты_эталонов as ПЭ
        з = _эталон(ключ)
        if not (з and з.get("файл")):
            # Своим текстам - негатив самого проверенного эталона того же
            # состава: у пары МЖ одиночный запрещал бы мужские органы.
            к = str(ключ)
            з = _эталон("pf_mf_near" if "_mf_" in к else
                        "pf_ff_near" if "_ff_" in к else "un_close")
        if з and з.get("файл"):
            г = ПЭ.граф(os.path.join(ПЭ.ЭТАЛОНЫ, з["файл"])) or {}
            for у in г.values():
                if у.get("class_type") == "KSampler":
                    ид = (у.get("inputs", {}).get("negative") or [None])[0]
                    вх = (г.get(str(ид)) or {}).get("inputs", {})
                    н = вх.get("text") or вх.get("prompt")
                    break
    except Exception:                                   # noqa: BLE001
        н = None
    # Татуировки: на «На коленях» у героини без единой татуировки на
    # предплечье появился рисунок. Эталонный негатив их не называл.
    if н and "tattoo" not in н:
        н = н + ", tattoos, tattoo, ink drawings on skin"
    # На «Сверху вниз» в промежности женщины вырос отросток, а на полу
    # валялась сброшенная одежда. Оба запрета называются прямо.
    if н and "discarded clothes" not in н and "_mf_" not in str(ключ):
        н = н + (", penis, testicles, male genitals on a woman, extra genitals, "
                 "discarded clothes, underwear lying on the floor")
    _КЭШ[ключ] = н
    return н
