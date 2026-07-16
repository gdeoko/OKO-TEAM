# Голос OKO (утверждён Даниэлем) — клон его голоса, для агента и всех уроков

- **oko_voice_reference.wav** — образец голоса Даниэля (проф. микрофон, очищенный).
  Это РЕФЕРЕНС для клонирования XTTS. Отдавать голосовому ИИ-агенту / использовать во всех озвучках.
- **oko_voice_sample.mp3** — как звучит финальный голос (clean_speed).

## Рецепт (как воспроизвести голос 1:1)
Движок: **XTTS-v2** (локально, бесплатно, безлимит). Скилл `/oko-voice`.
```python
import torch, torchaudio, soundfile as sf
def _sf(p,*a,**k):
    d,sr=sf.read(p,dtype='float32',always_2d=True); return torch.from_numpy(d.T.copy()),sr
torchaudio.load=_sf                      # обход torchcodec (CPU)
from TTS.api import TTS
tts=TTS("tts_models/multilingual/multi-dataset/xtts_v2")
tts.tts_to_file(text=TXT, language="ru", speaker_wav="oko_voice_reference.wav",
    file_path="out.wav", split_sentences=True, temperature=0.5,
    repetition_penalty=6.0, length_penalty=1.0, top_k=40, top_p=0.8)
# затем ускорение (утверждено): ffmpeg -i out.wav -filter:a "atempo=1.5,loudnorm=I=-16:TP=-1.5" final.mp3
```
Настройки утверждены: **clean_speed** = чистый клон + ускорение 1.5×, БЕЗ доп. эффектов/EQ/шумодава.
