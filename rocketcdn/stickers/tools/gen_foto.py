# -*- coding: utf-8 -*-
"""Прогон всех кадров пака через ChatGPT в браузере агента.

Идём строго по одному. Причина не в вежливости к сервису, а в правиле
владельца «1 проект = 1 вкладка = 1 чат»: драйвер ловит новую картинку
по тому, сколько их было в чате до отправки, и два запуска разом сбили
бы этот счёт - один забрал бы чужую картинку.

Уже снятое не переснимается: прогон можно остановить и продолжить.

    python3 gen_foto.py [ключ ...]     без ключей - все, каких нет
"""

import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import prompts_foto as P

ДОМ = "/opt/oko-poster/rocketpack"
ДРАЙВЕР = "/opt/oko-poster/chatgpt_web.mjs"
CDP = "http://127.0.0.1:9334"     # профиль gpt_us, кабинет ChatGPT
ЗНАК = "/opt/oko-poster/ref/rocketcdn_mark.png"


def снять(ключ, абзац, образец):
    dest = os.path.join(ДОМ, ключ + ".png")
    if os.path.exists(dest) and os.path.getsize(dest) > 50000:
        print("%-10s уже есть" % ключ)
        return True

    ссылки = []
    if образец == "mark":
        ссылки.append(ЗНАК)
    elif образец:
        ссылки.append(os.path.join(ДОМ, образец + ".png"))
    for s in ссылки:
        if not os.path.exists(s):
            print("%-10s нет образца %s" % (ключ, s))
            return False

    текст = P.промпт(абзац, bool(ссылки))
    зад = os.path.join(ДОМ, "p_" + ключ + ".txt")
    with open(зад, "w", encoding="utf-8") as f:
        f.write(текст)

    среда = dict(os.environ)
    среда.update({"CDP": CDP, "РАЗМЕР": "1:1", "ЖДАТЬ": "600",
                  "ПРОЕКТ": "rocketpack",
                  "ССЫЛКИ": ",".join(ссылки)})

    # Браузер иногда отказывает мгновенно: занят чужим проектом, пересоздаёт
    # вкладку, перезапускается службой. Один такой отказ сжёг тринадцать
    # сюжетов подряд за десять секунд - список просто пролетел насквозь.
    # Поэтому быстрый отказ это повод подождать, а не потерять сюжет.
    for заход in range(3):
        начало = time.time()
        r = subprocess.run(["node", ДРАЙВЕР, текст, dest], env=среда,
                           capture_output=True, text=True)
        ок = os.path.exists(dest) and os.path.getsize(dest) > 50000
        хвост = (r.stdout or r.stderr).strip().splitlines()[-1:]
        if ок:
            print("%-10s снято  %s" % (ключ, хвост))
            sys.stdout.flush()
            return True
        ушло = int(time.time() - начало)
        print("%-10s осечка за %d с (заход %d)  %s" % (ключ, ушло, заход + 1,
                                                       хвост))
        sys.stdout.flush()
        time.sleep(45 if ушло < 30 else 10)
    print("%-10s СОРВАЛОСЬ" % ключ)
    sys.stdout.flush()
    return False


def main():
    только = set(sys.argv[1:])
    беда = []
    for ключ, эмодзи, подпись, движение, образец, абзац in P.СЮЖЕТЫ:
        if только and ключ not in только:
            continue
        if not снять(ключ, абзац, образец):
            беда.append(ключ)
        time.sleep(4)   # не встаём в очередь вплотную к своему же запросу
    print("\nне снято: %s" % (", ".join(беда) if беда else "всё на месте"))
    return 1 if беда else 0


if __name__ == "__main__":
    sys.exit(main())
