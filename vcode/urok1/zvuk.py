# -*- coding: utf-8 -*-
"""Единая дорожка урока из сцен, без пустых пауз.

Старая дорожка держала между сценами до шести секунд тишины: на разборах
графика доигрывала, а зритель слушал пустоту. Суммарно 68 секунд на урок.
Теперь между сценами ровно один вдох, а картинка успевает за счёт монтажа.

    python3 zvuk.py [пауза]
"""
import json
import os
import subprocess
import sys

КОРЕНЬ = os.path.dirname(os.path.abspath(__file__))
ГОЛОС = os.path.join(КОРЕНЬ, "golos2")
ВЫХОД = os.path.join(КОРЕНЬ, "remotion", "public", "zvuk_urok_bez_pauz.mp3")
ПАУЗА = float(sys.argv[1]) if len(sys.argv) > 1 else 0.6


def главное() -> int:
    сценарий = json.load(open(os.path.join(КОРЕНЬ, "scenario2.json"), encoding="utf-8"))
    голос = json.load(open(os.path.join(ГОЛОС, "golos.json"), encoding="utf-8"))
    куски, фильтры, входы = [], [], []
    н = 0
    for сц in сценарий["сцены"]:
        путь = os.path.join(ГОЛОС, сц["id"] + ".wav")
        if not os.path.exists(путь) or сц["id"] not in голос:
            continue
        куски += ["-i", путь]
        фильтры.append("[%d:a]aresample=44100[s%d]" % (н, н))
        входы.append("[s%d]" % н)
        н += 1
    # Пауза делается отдельным молчанием, а не задержкой: так длина сцены
    # считается ровно и картинка не разъезжается со словами.
    тишина = os.path.join(КОРЕНЬ, "golos2", "_pause.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i",
                    "anullsrc=r=44100:cl=mono", "-t", str(ПАУЗА), тишина], check=True)
    цепь, вх = [], []
    for i in range(н):
        цепь.append("[%d:a]aresample=44100[s%d]" % (i, i))
        вх.append("[s%d]" % i)
        if i < н - 1:
            цепь.append("[%d:a]aresample=44100[p%d]" % (н, i))
            вх.append("[p%d]" % i)
    цепь.append("%sconcat=n=%d:v=0:a=1[out]" % ("".join(вх), len(вх)))
    cmd = (["ffmpeg", "-v", "error", "-y"] + куски + ["-i", тишина,
           "-filter_complex", ";".join(цепь), "-map", "[out]",
           "-c:a", "libmp3lame", "-b:a", "192k", ВЫХОД])
    subprocess.run(cmd, check=True)
    длина = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                  "-of", "csv=p=0", ВЫХОД], capture_output=True,
                                 text=True).stdout.strip())
    речь = sum(голос[с["id"]]["длительность"] for с in сценарий["сцены"] if с["id"] in голос)
    print("дорожка: %.1f с (речь %.1f + паузы %.1f)" % (длина, речь, (н - 1) * ПАУЗА))
    os.remove(тишина)
    return 0


if __name__ == "__main__":
    raise SystemExit(главное())
