#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Повторить принятый кадр его же рецептом и сверить, что вышло.

## Зачем эта проверка отдельно от прогона кнопок

Прогон кнопок отвечает на вопрос «что получит КЛИЕНТ»: он берёт
клиентский снимок, наш собранный промпт и наши настройки. Когда его
кадр расходится с эталоном, причин сразу три - снимок другой, текст
другой, числа другие, - и какая из них виновата, по одному кадру не
понять.

Здесь причина ровно одна или ни одной. Берётся ВСЁ из самого эталона:
его промпт, его зерно, его снимки, его шаги, CFG, denoise и лист.
Если кадр не повторился - сломано что-то у нас (модель подменили, узел
обновился, VAE другой), и чинить надо это, а не промпты. Если
повторился - рецепт цел, и дальше можно менять ровно одну вещь за раз:
сперва снимок на клиентский, потом текст на собранный.

Порядок именно такой, потому что 30.09.2026 я поменяла всё сразу и
получила расхождение позы 0.37-1.00 на шести кнопках, не зная, чьё оно.

    python3 -m tools.воспроизвести_эталон             все кнопки
    python3 -m tools.воспроизвести_эталон un_close    одну
    SNIMOK=/путь/клиент.jpg python3 -m tools.воспроизвести_эталон un_close
        то же, но на клиентском снимке: меняется ровно одна вещь
"""
import json
import os
import sys
import time

КОРЕНЬ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for п in (os.path.join(КОРЕНЬ, "bot"), os.path.join(КОРЕНЬ, "tools")):
    if п not in sys.path:
        sys.path.insert(0, п)

import gpu                                              # noqa: E402
import промпты_эталонов as ПЭ                           # noqa: E402

ЭТАЛОНЫ = os.environ.get("AMBERRY_ETALONS_DIR", "/srv/amberry/эталоны")
# Снимки, на которых эталоны и делались. Забраны с тома Hyperstack
# 30.09.2026 вместе с папкой `input` ComfyUI.
ВХОДЫ = os.environ.get("AMBERRY_ET_INPUT", "/srv/amberry/с_тома/input")
КУДА = os.environ.get("KUDA", "/srv/amberry/повтор_эталона")


def _снимки_эталона(ключ):
    """Имена файлов referenсов в том порядке, в каком их брал эталон.

    ПОРЯДОК ЗДЕСЬ ФАКТ, А НЕ ПРАВИЛО. В коде записано, что у пары МЖ
    первым обязан идти мужчина, а три принятых кадра МЖ из четырёх
    сделаны женщиной первой. Спорить с принятым кадром нельзя: он и
    есть то, что владелец утвердил.
    """
    з = ПЭ.загрузить().get(ключ)
    if not з:
        return []
    from PIL import Image                               # noqa: F401
    г = ПЭ.граф(os.path.join(ЭТАЛОНЫ, з["файл"]))
    # Узлы LoadImage нумерованы, и порядок слотов энкодера задаётся не
    # ими, а ссылками image1/image2 у TextEncodeQwenImageEditPlus.
    энк = next((у for у in (г or {}).values()
                if у.get("class_type") == "TextEncodeQwenImageEditPlus"), None)
    if not энк:
        return []
    имена = []
    for и in range(1, 4):
        ссылка = энк.get("inputs", {}).get(f"image{и}")
        if not ссылка:
            continue
        узел = (г.get(str(ссылка[0])) or {}).get("inputs", {})
        имя = узел.get("image")
        if имя:
            имена.append(имя)
    return имена


def _зерно(ключ):
    з = ПЭ.загрузить().get(ключ)
    if not з:
        return None
    г = ПЭ.граф(os.path.join(ЭТАЛОНЫ, з["файл"]))
    for у in (г or {}).values():
        if у.get("class_type") == "KSampler":
            return у.get("inputs", {}).get("seed")
    return None


def _негатив(ключ):
    """Негатив эталона: он там свой и длинный, наш с ним не совпадает."""
    з = ПЭ.загрузить().get(ключ)
    if not з:
        return None
    г = ПЭ.граф(os.path.join(ЭТАЛОНЫ, з["файл"]))
    for у in (г or {}).values():
        if у.get("class_type") != "KSampler":
            continue
        ид = (у.get("inputs", {}).get("negative") or [None])[0]
        вх = (г.get(str(ид)) or {}).get("inputs", {})
        return вх.get("text") or вх.get("prompt")
    return None


def повторить(карта, ключ, свой_снимок=None):
    """Один кадр рецептом эталона. (файл, секунды, беда)."""
    з = ПЭ.загрузить().get(ключ)
    if not з:
        return None, 0, "нет эталонного рецепта"
    как = з.get("как_считался", {})
    имена = _снимки_эталона(ключ)
    if not имена:
        return None, 0, "в эталоне нет референсов"
    на_карте = []
    for и, имя in enumerate(имена):
        # Свой снимок подменяет ПЕРВЫЙ референс: у пары второй человек
        # остаётся эталонным, иначе меняются две вещи разом.
        путь = (свой_снимок if (и == 0 and свой_снимок)
                else os.path.join(ВХОДЫ, имя))
        if not os.path.exists(путь):
            return None, 0, "нет снимка " + os.path.basename(путь)
        на_карте.append(карта.upload(os.path.basename(путь),
                                     open(путь, "rb").read()))
    л = как.get("лист") or [768, 1344]
    т = time.time()
    try:
        jid, _ = карта.start(
            mode="photo", эталон=1, prompt=з["промпт"], neg=_негатив(ключ),
            images=на_карте, seed=_зерно(ключ) or 4242,
            denoise=как.get("denoise", 1.0), шаги=как.get("шаги"),
            cfg_свой=как.get("cfg"), _лист=[int(л[0]), int(л[1])])
        готово = карта.wait(jid, limit=600)
        файлы = готово.get("files") or []
        if not файлы:
            return None, time.time() - т, "карта не вернула файл"
        данные = карта.fetch(файлы[0])
    except Exception as e:                              # noqa: BLE001
        return None, time.time() - т, str(e)[:200]
    os.makedirs(КУДА, exist_ok=True)
    хвост = "_свой" if свой_снимок else ""
    путь = os.path.join(КУДА, ключ + хвост + ".png")
    open(путь, "wb").write(данные)
    return путь, time.time() - т, None


def главное():
    только = set(sys.argv[1:])
    свой = os.environ.get("SNIMOK") or None
    рецепты = {к: з for к, з in ПЭ.загрузить().items()
               if not к.startswith(("ac_", "pr_"))}
    ключи = [к for к in рецепты if not только or к in только]
    if not ключи:
        sys.exit("нет таких кнопок среди эталонных рецептов")
    карта = gpu.Gpu(os.environ.get("ROCKET_GPU_URL", ""),
                    os.environ.get("ROCKET_GPU_USER", "rocket"),
                    os.environ.get("ROCKET_GPU_PASS", ""))
    карта.выбрать("фото")
    if свой:
        print("свой снимок первым референсом:", свой)
    print("кнопок:", len(ключи), "| кадры в", КУДА, "\n")
    import поза_сверка
    итог = []
    for к in sorted(ключи):
        путь, сек, беда = повторить(карта, к, свой)
        о = поза_сверка.сверить(к, путь) if путь else {"беда": беда}
        з = о.get("расхождение")
        строка = ("поза %5.3f%s" % (з, "" if о.get("совпала") else " УШЛА")
                  if з is not None else "поза  ?  ")
        print("%-4s %-14s %5.1fс  %s  %s" % (
            "ок" if путь else "МИМО", к, сек, строка,
            беда or ", ".join(о.get("ушли") or []) or ""))
        итог.append({"ключ": к, "файл": путь, "секунд": round(сек, 1),
                     "поза": з, "совпала": bool(о.get("совпала")),
                     "ушли": о.get("ушли"), "беда": беда})
    os.makedirs(КУДА, exist_ok=True)
    json.dump(итог, open(os.path.join(КУДА, "повтор.json"), "w",
                         encoding="utf-8"), ensure_ascii=False, indent=1)
    сошлось = sum(1 for з in итог if з["совпала"])
    print("\nпоза совпала: %d из %d" % (сошлось, len(итог)))


if __name__ == "__main__":
    главное()
