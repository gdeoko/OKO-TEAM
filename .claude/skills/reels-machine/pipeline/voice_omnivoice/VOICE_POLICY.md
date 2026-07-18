# ПОЛИТИКА ГОЛОСА V.CODE (ЗАФИКСИРОВАНО ДАНИЭЛЕМ 18.07.2026 — НЕ МЕНЯТЬ)

**ВСЕ ролики озвучиваются ТОЛЬКО этим движком. Скорость строго 1.8×.**

Движок: OmniVoice (k2-fsa) — бесплатный клон голоса Владимира.
Команда (готовый mp3 сразу с 1.8× и авто-обрезкой призвука):
```bash
export HF_TOKEN=<из secrets.env.b64>
python pipeline/voice_omnivoice/vcode_voice.py "Текст сегмента" seg.mp3
```
Референс — `reference/vladimir_ref_30s.wav` (30с, живее). ns=48. Скорость 1.8× зашита.

## ЗАПРЕЩЕНО
- ❌ silero (`tts_silero.py`), ❌ XTTS (`xtts_voice.py`), ❌ любые другие TTS.
- ❌ Менять скорость с 1.8× или референс — только по прямой просьбе Даниэля.

Запасной путь при сбое OmniVoice: Kaggle F5-TTS Russian (`vcode/daily/kaggle_tts`).
