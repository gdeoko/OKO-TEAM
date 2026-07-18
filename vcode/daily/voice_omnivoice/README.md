# V.CODE голос — ОСНОВНОЙ движок: OmniVoice (метод Даниэля)

Зафиксировано Даниэлем 18.07.2026: **все ролики — этим голосом, скорость 1.8×.**

Движок: HF Space `k2-fsa/OmniVoice` через `gradio_client`, zero-shot клон Владимира.
Бесплатно, безлимитно, русский, качество.

## Продакшн (одна команда — уже с 1.8× и авто-обрезкой призвука)
```bash
pip install gradio_client faster-whisper
export HF_TOKEN=hf_...   # из secrets.env.b64
python vcode_voice.py "Текст ролика" out.mp3
```
`vcode_voice.py` — канон: OmniVoice(30с-референс, ns48) → обрезка стартового призвука → 1.8× + мастер.

## Референсы Владимира
`reference/vladimir_ref_15s.wav` и `vladimir_ref_30s.wav` — из 3 ogg Даниэля
(highpass=70 + loudnorm, 24кГц моно, 30с обычно живее). **Сид клонирования — не терять.**

## Грабли
1. Стартовый призвук OmniVoice (~1.2–1.4с, слово-стиль) → авто-обрезка в vcode_voice.py по
   whisper word_timestamps (первое слово != входу → режем до второго).
2. HF_TOKEN — из секретов, снимает лимиты ZeroGPU.
3. Скорость 1.8× — atempo в пост (тембр сохраняется). Заблокирована по просьбе Даниэля.

## Запас
- VoxCPM (openbmb/VoxCPM-Demo), Qwen3-TTS — тоже бесплатные клоны.
- Kaggle F5-TTS Russian: `vcode/daily/kaggle_tts` (KAGGLE_API_TOKEN).
