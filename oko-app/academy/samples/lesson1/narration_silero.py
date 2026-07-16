#!/usr/bin/env python3
# OKO lesson 1 narration — Silero v4_ru "eugene" + RUAccent (правильные ударения, без ручной расстановки).
import os, json, subprocess, wave
import numpy as np, torch
from ruaccent import RUAccent

CACHE=os.path.expanduser("~/.cache/oko-voice"); os.makedirs(CACHE,exist_ok=True)
PT=os.path.join(CACHE,"v4_ru.pt")
if not os.path.exists(PT):
    if os.path.exists("v4_ru.pt"): os.replace("v4_ru.pt",PT)
    else: subprocess.run(["curl","-sSL","--cacert","/root/.ccr/ca-bundle.crt","-o",PT,
                          "https://models.silero.ai/models/tts/ru/v4_ru.pt"],check=True)
torch.set_num_threads(6)
acc=RUAccent(); acc.load(omograph_model_size='turbo', use_dictionary=True)
model=torch.package.PackageImporter(PT).load_pickle("tts_models","model"); model.to("cpu")
SR=48000; VOICE="eugene"; os.makedirs("vo",exist_ok=True)

# Clean text (NO manual accents — RUAccent ставит их сам). Англицизмы — фонетикой по-русски.
SEG=[
("s1","Слушай. Нейросетей сейчас сотни, и новенькие выходят чуть ли не каждую неделю. "
      "Потеряться легко. Но есть хорошая новость: чтобы работать быстро, тебе не нужно знать их все. "
      "Нужна карта. Одна простая схема: задача, категория, модель. "
      "Давай построим её вместе, и к концу урока ты будешь выбирать инструмент за пару секунд.",0.5),
("s2","Запомни главное правило. Сначала ты называешь задачу, а не модель. "
      "Все нейросети делятся всего на семь больших семей. "
      "Текст. Картинки. Видео. Код. Озвучка. Музыка. И автоматизация. "
      "Понял, к какой семье относится твоя задача, считай, полдела сделано.",0.45),
("s3","Начнём с текста, это твой рабочий конь. Здесь три лидера. "
      "Чат Джи Пи Ти, универсальный солдат, хорош почти во всём. "
      "Клод, король больших текстов и кода, держит контекст на десятки страниц. "
      "Джемини, когда нужен свежий поиск и связка с Гуглом. "
      "Правило простое: пишешь код или длинный документ, зови Клода. "
      "Нужен факт из сети, Джемини. Всё остальное, Чат Джи Пи Ти.",0.45),
("s4","Дальше картинки, и вот тут крутятся деньги. "
      "Мидджорни, про красоту и арт, лучшая эстетика. "
      "Флакс, фотореализм почти бесплатно, около пяти центов за кадр. "
      "Нано Банана, правки и текст прямо на картинке, без перегенерации. "
      "А Хигсфилд собирает их все в одном окне. "
      "Хочешь вау-визуал, Мидджорни. Нужен объём и дёшево, Флакс.",0.45),
("s5","Видео, самое дорогое и самое зрелищное. "
      "Вео, лучшее качество и родной звук, почти как настоящий продакшн. "
      "Клинг, кино за копейки, примерно десять центов за секунду. "
      "Рэнвей заточен под маркетинг и монтаж. "
      "Тестируешь идею, бери Клинг, он не разорит. Финалку для клиента, на Вео.",0.45),
("s6","Три быстрых семьи. Код без программиста, Курсор, Ловэбл, Клод Код: "
      "описываешь словами, получаешь рабочее приложение. "
      "Озвучка, Элевен Лабс для премиума или бесплатные локальные нейрослова, "
      "одним из которых, кстати, озвучен этот урок. "
      "Музыка под ролик, Суно: один запрос, и готовый трек у тебя в руках.",0.45),
("s7","А теперь лазейка, ради которой стоило досмотреть. "
      "Не плати каждой модели по отдельности. "
      "Один Хигсфилд Ультра, это почти безлимит десятков топовых моделей из одного окна. "
      "Но главная бесплатная связка, локальные голоса и n8n на своём сервере: "
      "себестоимость падает до копеек.",0.45),
("s8","Собираем всю карту в одну формулу. Задача. Категория. Модель. "
      "Три шага, и ты больше не тыкаешься вслепую. "
      "Текст, Клод и компания. Картинки, Флакс и Мидджорни. Видео, Клинг и Вео. "
      "А связка через Хигсфилд бережёт твой бюджет.",0.45),
("s9","На следующем уроке разберём промптинг, навык, который умножает всё, что ты узнал сегодня. "
      "Сохрани эту карту и возвращайся. Это была Академия ОКО.",0.2),
]

def synth(text):
    acc_text=acc.process_all(text)          # правильные ударения
    return model.apply_tts(text=acc_text,speaker=VOICE,sample_rate=SR,put_accent=False,put_yo=True).numpy()

timings=[]; t=0.0; parts=[]
for sid,text,gap in SEG:
    a=synth(text); d=len(a)/SR
    w=wave.open(f"vo/{sid}.wav",'w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(a,-1,1)*32767).astype('int16').tobytes()); w.close()
    timings.append({"id":sid,"start":round(t,3),"dur":round(d,3),"end":round(t+d,3)})
    parts.append(a); parts.append(np.zeros(int(SR*gap),dtype=a.dtype)); t+=d+gap
    print(f"{sid}: {d:.2f}s")
full=np.concatenate(parts)
w=wave.open("vo/full.wav",'w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((np.clip(full,-1,1)*32767).astype('int16').tobytes()); w.close()
subprocess.run(["ffmpeg","-y","-i","vo/full.wav","-ar","48000","-ac","1","vo/full.mp3"],capture_output=True)
json.dump({"total":round(len(full)/SR,3),"segments":timings},open("timings.json","w"),ensure_ascii=False,indent=2)
print("TOTAL",round(len(full)/SR,2),"s")
