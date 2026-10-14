# -*- coding: utf-8 -*-
"""Озвучка урока голосом Владимира через ElevenLabs, по сценам.

Ключ читается из файла окружения (`--env`), в код и в git он не попадает.
Клон голоса создаётся один раз из образца и дальше берётся по имени.

    python3 ozvuchka_eleven.py --env /путь/oko.env [s01 s02 ...]
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import urllib.request

КОРЕНЬ = os.path.dirname(os.path.abspath(__file__))
ОБРАЗЕЦ = os.path.join(КОРЕНЬ, "..", "daily", "voice_omnivoice", "reference",
                       "vladimir_ref_30s.wav")
КУДА = os.path.join(КОРЕНЬ, "golos2")
БАЗА = "https://api.elevenlabs.io/v1"
ИМЯ_ГОЛОСА = "Vladimir VLIONOFF"
МОДЕЛЬ = "eleven_multilingual_v2"
ТЕМП = 1.35          # слово владельца: 1.3-1.5, чтобы не было муторно
МАСТЕР = "highpass=f=85,loudnorm=I=-16:TP=-1.5"
_модель_слов = None


def ключ() -> str:
    к = os.environ.get("ELEVEN_KEY", "")
    if not к:
        raise SystemExit("нет ELEVEN_KEY в окружении")
    return к


def запрос(путь: str, тело=None, метод="GET"):
    данные = json.dumps(тело).encode() if тело is not None else None
    req = urllib.request.Request(БАЗА + путь, data=данные, method=метод,
                                 headers={"xi-api-key": ключ(),
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


def голос() -> str:
    """Найти клон Владимира, а если его нет, создать из образца."""
    for г in запрос("/voices").get("voices", []):
        if г.get("name") == ИМЯ_ГОЛОСА:
            return г["voice_id"]
    граница = "----oko" + os.urandom(8).hex()
    части = []
    части.append(("--%s\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\n%s\r\n"
                  % (граница, ИМЯ_ГОЛОСА)).encode())
    части.append(("--%s\r\nContent-Disposition: form-data; name=\"files\"; filename=\"ref.wav\"\r\n"
                  "Content-Type: audio/wav\r\n\r\n" % граница).encode())
    части.append(open(ОБРАЗЕЦ, "rb").read())
    части.append(("\r\n--%s--\r\n" % граница).encode())
    тело = b"".join(части)
    req = urllib.request.Request(БАЗА + "/voices/add", data=тело, method="POST",
                                 headers={"xi-api-key": ключ(),
                                          "Content-Type": "multipart/form-data; boundary=" + граница})
    with urllib.request.urlopen(req, timeout=180) as r:
        ответ = json.loads(r.read().decode())
    print("клон голоса создан:", ответ.get("voice_id"))
    return ответ["voice_id"]


def сказать(текст: str, voice_id: str, куда_mp3: str) -> None:
    тело = {"text": текст, "model_id": МОДЕЛЬ,
            "voice_settings": {"stability": 0.42, "similarity_boost": 0.85,
                               "style": 0.25, "use_speaker_boost": True}}
    req = urllib.request.Request(
        БАЗА + "/text-to-speech/" + voice_id + "?output_format=mp3_44100_128",
        data=json.dumps(тело).encode(), method="POST",
        headers={"xi-api-key": ключ(), "Content-Type": "application/json",
                 "Accept": "audio/mpeg"})
    with urllib.request.urlopen(req, timeout=300) as r, open(куда_mp3, "wb") as ф:
        ф.write(r.read())


def ускорить(из_mp3: str, в_wav: str) -> None:
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", из_mp3,
                    "-filter:a", "atempo=%s,%s" % (ТЕМП, МАСТЕР),
                    "-ar", "48000", "-ac", "1", в_wav], check=True)


def длина(путь: str) -> float:
    из = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                         "-of", "default=nw=1:nk=1", путь], capture_output=True, text=True)
    return round(float(из.stdout.strip() or 0), 3)


def слова_файла(wav: str) -> list:
    global _модель_слов
    if _модель_слов is None:
        from faster_whisper import WhisperModel
        _модель_слов = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4)
    куски, _ = _модель_слов.transcribe(wav, language="ru", vad_filter=False, word_timestamps=True)
    return [{"слово": w.word.strip(), "старт": round(w.start, 3), "конец": round(w.end, 3)}
            for к in куски for w in (к.words or [])]


def подхватить_ключ(аргументы: list) -> list:
    if "--env" not in аргументы:
        return аргументы
    i = аргументы.index("--env")
    путь = аргументы[i + 1] if len(аргументы) > i + 1 else ""
    for строка in open(путь, encoding="utf-8"):
        if строка.startswith("ELEVEN_KEY="):
            os.environ["ELEVEN_KEY"] = строка.split("=", 1)[1].strip().strip("\"'")
            break
    return аргументы[:i] + аргументы[i + 2:]


def главное() -> int:
    нужны = set(подхватить_ключ(sys.argv[1:]))
    os.makedirs(КУДА, exist_ok=True)
    сцены = json.load(open(os.path.join(КОРЕНЬ, "scenario2.json"), encoding="utf-8"))["сцены"]
    свод_путь = os.path.join(КУДА, "golos.json")
    свод = json.load(open(свод_путь, encoding="utf-8")) if os.path.exists(свод_путь) else {}
    vid = голос()
    знаков = 0
    for с in сцены:
        ид = с["id"]
        if нужны and ид not in нужны:
            continue
        путь = os.path.join(КУДА, ид + ".wav")
        if os.path.exists(путь) and os.path.getsize(путь) > 20000 and ид in свод:
            print(ид, "уже озвучена")
            continue
        текст = с["текст"]
        знаков += len(текст)
        mp3 = os.path.join(tempfile.gettempdir(), ид + ".mp3")
        print("== %s: %d знаков" % (ид, len(текст)), flush=True)
        try:
            сказать(текст, vid, mp3)
            ускорить(mp3, путь)
        except Exception as e:
            print("  не вышло:", repr(e)[:200], flush=True)
            continue
        finally:
            if os.path.exists(mp3):
                os.unlink(mp3)
        свод[ид] = {"длительность": длина(путь), "слова": слова_файла(путь)}
        json.dump(свод, open(свод_путь, "w", encoding="utf-8"), ensure_ascii=False)
        print("  готово: %.1f с" % свод[ид]["длительность"], flush=True)
    всего = sum(v["длительность"] for v in свод.values())
    print("сцен %d, звука %.1f с (%.1f мин), знаков отправлено %d"
          % (len(свод), всего, всего / 60, знаков))
    return 0


if __name__ == "__main__":
    raise SystemExit(главное())
