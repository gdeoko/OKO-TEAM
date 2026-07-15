#!/usr/bin/env python3
# Humanized narration for OKO Academy lesson "Карта нейросетей 2026".
# edge-tts ru-RU-DmitryNeural via agent proxy, per-segment, natural gaps,
# stress marks (U+0301) + phonetic transliteration of tool names to kill bot errors.
import edge_tts, asyncio, os, json, subprocess

VOICE = "ru-RU-DmitryNeural"
PROXY = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
OUT = "vo"
os.makedirs(OUT, exist_ok=True)

A = "́"  # combining acute accent (place AFTER stressed vowel)

# Each segment: (id, text, rate, gap_after_seconds)
SEGMENTS = [
    ("s1",
     "Слушай. Нейросе"+A+"тей сейчас — со"+A+"тни, и но"+A+"веньких выкидывают чуть ли не каждую неделю. "
     "Потеряться легко. Но есть хорошая новость: чтобы работать быстро, тебе не нужно знать их все. "
     "Нужна ка"+A+"рта. Одна простая схема: зада"+A+"ча, катего"+A+"рия, моде"+A+"ль. "
     "Давай построим её вместе — и к концу урока ты будешь выбирать инструмент за пару секунд.",
     "-2%", 0.55),

    ("s2",
     "Запомни главное правило. Сначала ты называешь зада"+A+"чу, а не модель. "
     "Все нейросети делятся всего на семь больших семей. "
     "Текст. Изображе"+A+"ния. Видео. Код. Озву"+A+"чка. Му"+A+"зыка. И автоматиза"+A+"ция. "
     "Понял, к какой семье относится твоя задача — считай, полдела сделано.",
     "+0%", 0.5),

    ("s3",
     "Начнём с те"+A+"кста — это твой рабочий конь. Здесь три лидера. "
     "Чат Джи Пи Ти — универсальный солдат, хорош почти во всём. "
     "Кло"+A+"д — король больших текстов и ко"+A+"да, держит ко"+A+"нтекст на десятки страниц. "
     "Дже"+A+"минай — когда нужен свежий поиск и связка с гуглом. "
     "Правило простое: пишешь код или длинный докуме"+A+"нт — зови Клода. Нужен факт из сети — Джеминай. Всё остальное — Чат Джи Пи Ти.",
     "+0%", 0.5),

    ("s4",
     "Дальше — карти"+A+"нки, и вот тут кру"+A+"тятся деньги. "
     "Миджо"+A+"рни — про красоту и арт, лучшая эсте"+A+"тика. "
     "Флакс — фотореали"+A+"зм почти бесплатно, около пяти центов за кадр. "
     "На"+A+"но Бана"+A+"на — правки и текст прямо на картинке, без перегенерации. "
     "А Хи"+A+"гсфилд собирает их все в одном окне. "
     "Хочешь ва"+A+"у-визуал — Миджорни. Нужен объём и дёшево — Флакс.",
     "+0%", 0.5),

    ("s5",
     "Ви"+A+"део — самое дорогое и самое зре"+A+"лищное. "
     "Ве"+A+"о — лучшее качество и родно"+A+"й звук, почти как настоящий продакшн. "
     "Клинг — кино за копейки, примерно десять центов за секунду. "
     "Ра"+A+"нвей — заточен под маркетинг и монтаж. "
     "Тестируешь идею — бери Клинг, он не разорит. Финалку для клиента — на Вео.",
     "+0%", 0.5),

    ("s6",
     "Три быстрых семьи́. "
     "Код без программиста — Ку"+A+"рсор, Лова"+A+"бл, Клод Код: описываешь словами, получаешь рабочее приложение. "
     "Озву"+A+"чка — Иле"+A+"вен Лабс для премиума или бесплатный эдж-ти-ти-эс, которым, кстати, озвучен этот урок. "
     "Му"+A+"зыка под ролик — Су"+A+"но: один запрос — и готовый трек у тебя в руках.",
     "+0%", 0.5),

    ("s7",
     "А теперь — лазе"+A+"йка, ради которой стоило досмотреть. "
     "Не плати каждой модели по отдельности. "
     "Один Хи"+A+"гсфилд Ультра — это почти безлими"+A+"т десятков топовых моделей из одного окна. "
     "Посчитай: пять подписок по двадцать долларов против одно"+A+"й. Экономия — в ра"+A+"зы. "
     "Плюс эдж-ти-ти-эс бесплатно и эн-восемь-эн на своём сервере бесплатно — и себесто"+A+"имость уже копейки.",
     "+0%", 0.5),

    ("s8",
     "Собираем всю карту в одну фо"+A+"рмулу. "
     "Зада"+A+"ча. Катего"+A+"рия. Моде"+A+"ль. Три шага — и ты больше не тыкаешься вслепу"+A+"ю. "
     "Текст — Клод и компания. Картинки — Флакс и Миджорни. Видео — Клинг и Вео. "
     "А связка через Хигсфилд бережёт твой бюджет.",
     "+0%", 0.5),

    ("s9",
     "На следующем уроке разберём промпти"+A+"нг — навык, который умножа"+A+"ет всё, что ты узнал сегодня. "
     "Сохрани эту карту и возвращайся. Это была Академия О"+A+"КО.",
     "-2%", 0.2),
]

async def synth():
    for sid, text, rate, gap in SEGMENTS:
        for attempt in range(6):
            try:
                c = edge_tts.Communicate(text, VOICE, rate=rate, proxy=PROXY)
                await c.save(f"{OUT}/{sid}.mp3")
                sz = os.path.getsize(f"{OUT}/{sid}.mp3")
                if sz > 2000:
                    print(f"{sid}: ok {sz} bytes")
                    break
                raise RuntimeError("too small")
            except Exception as e:
                print(f"{sid} attempt {attempt}: {e}")
                await asyncio.sleep(1.5*(attempt+1))

def dur(path):
    out = subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration",
                                   "-of","csv=p=0", path]).decode().strip()
    return float(out)

def build():
    # build silence pads and concat, tracking each segment start
    timings = []
    t = 0.0
    concat_parts = []
    for i,(sid, text, rate, gap) in enumerate(SEGMENTS):
        d = dur(f"{OUT}/{sid}.mp3")
        timings.append({"id": sid, "start": round(t,3), "dur": round(d,3), "end": round(t+d,3)})
        concat_parts.append(f"{OUT}/{sid}.mp3")
        t += d
        if gap > 0:
            sil = f"{OUT}/sil_{i}.mp3"
            subprocess.run(["ffmpeg","-y","-f","lavfi","-i",f"anullsrc=r=48000:cl=mono",
                            "-t",str(gap),"-q:a","9","-acodec","libmp3lame", sil],
                           check=True, capture_output=True)
            concat_parts.append(sil)
            t += gap
    # concat list with absolute paths
    base = os.getcwd()
    with open("vo/list.txt","w") as f:
        for p in concat_parts:
            f.write(f"file '{base}/{p}'\n")
    subprocess.run(["ffmpeg","-y","-f","concat","-safe","0","-i","vo/list.txt",
                    "-ar","48000","-ac","1","vo/full.mp3"], check=True, capture_output=True)
    total = dur("vo/full.mp3")
    json.dump({"total": round(total,3), "segments": timings}, open("timings.json","w"),
              ensure_ascii=False, indent=2)
    print(f"\nTOTAL: {total:.2f}s")
    for s in timings:
        print(f"  {s['id']}: {s['start']:.2f} -> {s['end']:.2f}  ({s['dur']:.2f}s)")

asyncio.run(synth())
build()
