# ⚠️ РЕФЕРЕНСЫ ВЛАДИМИРА — ТРЕБУЕТСЯ ПЕРЕЗАЛИВ
Инстанс-контейнер потерял исходные ogg (подмена снапшота). Нужно от Даниэля 3 ogg
записи голоса Владимира → пересобрать:
  NORM="highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=11"
  ffmpeg -ss 1 -t 15 -i src.ogg -af "$NORM" -ar 24000 -ac 1 vladimir_ref_15s.wav
  ffmpeg -ss 1 -t 30 -i src.ogg -af "$NORM" -ar 24000 -ac 1 vladimir_ref_30s.wav
После заливки — удалить этот файл.
