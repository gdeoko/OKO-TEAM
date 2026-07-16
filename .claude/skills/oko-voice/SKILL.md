---
name: oko-voice
description: >
  Голос OKO — БЕСПЛАТНАЯ локальная озвучка для всего OKO TEAM (без кредитов, без
  платных API). Используй ВСЕГДА, когда нужна речь: озвучка видео-уроков Академии
  и роликов (reels-machine, montage, motion), голосовые ответы ИИ-агента/бота OKO,
  VPS-озвучка, любые TTS. Бренд-голос: Silero «eugene» (мужской, утверждён Даниэлем).
  Премиум/клон голоса: XTTS-v2. НЕ использовать edge-tts (робот) и платные
  ElevenLabs/Higgsfield-кредиты для рядовой озвучки.
---

# OKO Voice — канонический голос бренда (бесплатно, локально)

**Решение Даниэля (закреплено навсегда, для всех чатов и агента):**
озвучка OKO делается **бесплатными локальными нейро-TTS**, НЕ платными кредитами.

**Почему именно эти движки — БЕЗЛИМИТ.** Silero и XTTS работают локально (ни API, ни ключей,
ни квот, ни оплаты за символ) → можно гнать **любой объём** (у Даниэля поток огромный).
Ставим ТОЛЬКО безлимитные локальные движки; платные кредитные (ElevenLabs/Higgsfield) — нельзя.

**Голос — ПОД ПРОЕКТ, не всегда один.** Движок фиксирован (Silero/XTTS), а конкретный голос
подбирается под проект: муж/жен/характер/клон. `eugene` — дефолт бренд-озвучки OKO, не единственный.

| Движок | Когда | Голос | Цена |
|---|---|---|---|
| **Silero v4_ru** | по умолчанию: уроки, ролики, агент, бот, VPS | **eugene** (муж, БРЕНД) | **$0** |
| **XTTS-v2 (Coqui)** | когда нужно «ещё живее» или клон голоса по образцу | клон из ref-wav / студийный | **$0** |
| ~~edge-tts~~ | НЕ использовать — звучит как робот, ошибки ударений | — | $0 |
| ~~ElevenLabs / Higgsfield-голос~~ | НЕ использовать для рядовой озвучки — платно (кредит ≈ $0.066, ~$1/урок) | — | $$ |

Silero держит ударения (`put_accent`), быстрый на CPU, модель ~40МБ.
XTTS-v2 ближе к ElevenLabs по «живости», умеет клонировать голос по 6–20с образца.

## Быстрый старт
```bash
# один раз за сессию (torch уже может стоять):
pip3 install -q torch torchaudio --index-url https://download.pytorch.org/whl/cpu
# для XTTS дополнительно:  pip3 install -q coqui-tts "transformers<4.50"

# бренд-голос OKO (Silero eugene):
python3 .claude/skills/oko-voice/scripts/oko_tts.py --textfile script.txt --out vo.wav --mp3
# явно:
python3 .claude/skills/oko-voice/scripts/oko_tts.py --engine silero --voice eugene --text "Привет, это ОКО." --out vo.wav
# премиум/клон (XTTS-v2):
python3 .claude/skills/oko-voice/scripts/oko_tts.py --engine xtts --ref ref_voice.wav --text "..." --out vo.wav
```
Env-переключатели: `OKO_TTS_ENGINE=silero|xtts`, `OKO_TTS_VOICE=eugene`, `OKO_XTTS_SPEAKER`.

## Голоса Silero v4_ru
- **eugene** — мужской, БРЕНД OKO (спокойный, живой). ← дефолт
- aidar — мужской, поэнергичнее.
- kseniya / xenia / baya — женские.

## XTTS-v2 (премиум/клон) — РАБОЧИЙ рецепт клона голоса
- Модель `tts_models/multilingual/multi-dataset/xtts_v2` (~1.8ГБ, качается coqui-tts).
- **Клон голоса по образцу** (лучший «живой» результат): `speaker_wav="ref.wav"` (15–30с
  чистой речи одного человека, 22050 моно PCM), `language="ru"`. Это буквально голос
  человека → звучит живо. Пример — клон голоса Даниэля по его двум ~55с записям.
- **ГРАБЛЯ torchcodec (обязательно!):** torch≥2.9/torchaudio требует torchcodec для
  `torchaudio.load`, а он тянет CUDA-либы (`libnvrtc`) → падает на CPU. Обход: torchcodec
  должен быть УСТАНОВЛЕН (иначе `import TTS` падает), НО подменить загрузчик на soundfile:
  ```python
  import torch, torchaudio, soundfile as sf
  def _sf_load(p,*a,**k):
      d,sr=sf.read(p,dtype='float32',always_2d=True); return torch.from_numpy(d.T.copy()),sr
  torchaudio.load=_sf_load          # ДО import TTS
  from TTS.api import TTS
  ```
- Ставить: `pip install coqui-tts "transformers==4.57" torchcodec soundfile`.
- **Ускорение/темп:** генерить в натуральном темпе → `ffmpeg atempo=1.5` (сохраняет питч).
  XTTS-клон часто читает медленно — 1.3–1.5× выводит в нормальный дикторский темп.
- **Ударения:** XTTS свой g2p (RUAccent-метки `+` НЕ передавать — читает как артефакт).
  Стресс-ошибки править точечно фонетикой по слуху владельца (я аудио не слышу).

## Пайплайн озвучки урока/ролика (как делать правильно)
1. Текст сценария → числа прописью, сложные ударения через `+` перед гласной (`догово+р`).
2. `oko_tts.py` (Silero eugene) → `vo.wav` (48кГц). Длинный текст скрипт сам бьёт по предложениям.
3. Тайм-коды слов для караоке — faster-whisper (`small`, `word_timestamps`) по готовому wav.
4. Мастеринг: `loudnorm I=-14:TP=-1.5` (видео) / `-16` (голос-ассистент).

## Грабли
- Silero лимит ~1000 симв/вызов — скрипт бьёт автоматически.
- Сеть только `curl --cacert /root/.ccr/ca-bundle.crt` (urllib мимо прокси; модель качается curl'ом).
- XTTS + transformers 5.x = `isin_mps_friendly` ImportError → ставить `transformers<4.50`.
- torch — CPU-колесо (`--index-url .../whl/cpu`), иначе тянет CUDA.

## Куда это внесено (чтобы знал любой чат)
`CLAUDE.md`, `INTEGRATIONS.md`, `secrets.env` (config), скиллы `reels-machine`, `oko-magic`,
`remotion-video`. Правило: для ЛЮБОЙ озвучки OKO — этот скилл, голос **eugene**, бесплатно.
