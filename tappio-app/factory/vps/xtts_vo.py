#!/usr/bin/env python3
# XTTS-v2 озвучка (клон мужского голоса) через HF Space + edge-tts референс.
# Качество ближе к ElevenLabs, клонирует голос по образцу. Ограничение: HF ZeroGPU-квота
# (общая с генерацией картинок, ~несколько мин/день на аккаунт) — для потока использовать
# точечно (hero-ролики) либо ждать сброса квоты; базовая озвучка — edge-tts (безлимит).
#
# Использование: python3 xtts_vo.py "<текст>" <out.mp3> [ref.wav]
# Референс мужского голоса делаем edge-tts AndrewNeural (male_ref.wav) и клонируем его.
import os, sys, subprocess, glob, asyncio

REF = "/opt/oko-poster/cfg/male_ref.wav"
SPACES = ["coqui/xtts", "tonyassi/voice-clone", "fffiloni/xtts"]

def make_ref():
    import edge_tts
    txt = ("Privacy is not a luxury. It's a right. Four sensors, one scan, sixty seconds "
           "to know your space is truly yours. This is how you take control.")
    async def mk():
        await edge_tts.Communicate(txt, "en-US-AndrewNeural").save("/opt/oko-poster/cfg/male_ref.mp3")
    asyncio.run(mk())
    os.system("ffmpeg -y -loglevel error -i /opt/oko-poster/cfg/male_ref.mp3 -ar 22050 -ac 1 " + REF)

def xtts(text, out, ref=REF):
    from gradio_client import Client, handle_file
    if not os.path.exists(ref): make_ref()
    tok = os.environ.get("HF_TOKEN")
    last = ""
    for sp in SPACES:
        try:
            cl = Client(sp, token=tok, download_files="/opt/oko-poster/cfg/xtts_dl", verbose=False)
        except Exception as e:
            last = f"{sp}: {e}"; continue
        try:
            # coqui/xtts endpoint отличается; tonyassi/voice-clone: /clone(text, audio)
            res = cl.predict(text=text, audio=handle_file(ref), api_name="/clone")
        except Exception as e:
            last = f"{sp}: {e}"; continue
        src = res
        if os.path.isdir(res):
            f = glob.glob(res + "/*"); src = f[0] if f else res
        subprocess.run(["ffmpeg","-y","-loglevel","error","-i",src,"-b:a","128k",out])
        if os.path.exists(out): return True, sp
    return False, last

if __name__ == "__main__":
    text, out = sys.argv[1], sys.argv[2]
    ref = sys.argv[3] if len(sys.argv) > 3 else REF
    ok, info = xtts(text, out, ref)
    print("OK" if ok else "FAIL", info)
