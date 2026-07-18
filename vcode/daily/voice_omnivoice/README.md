# V.CODE голос — метод Даниэля: OmniVoice (бесплатно, безлимитно)

Движок: HF Space **k2-fsa/OmniVoice** через `gradio_client`, zero-shot клон по референсу.
Выбран Даниэлем как основной (бесплатно + безлимит + русский + качество).

## Запуск
```bash
pip install gradio_client
export HF_TOKEN=hf_...   # из secrets.env.b64 (снимает лимиты ZeroGPU)
python clone_voice_omnivoice.py "Текст" out.wav --ref reference/vladimir_ref_30s.wav --ns 48
```
- `--ns` качество (48 по умолч.), `--du` длительность (авто по словам), `--lang Russian`.
- Референсы Владимира: `vladimir_ref_15s.wav` / `vladimir_ref_30s.wav` (сделаны из 3 ogx Даниэля,
  highpass+loudnorm, 24кГц моно). 30с обычно стабильнее/живее.

## ГРАБЛИ
1. **Стартовый призвук.** OmniVoice иногда вставляет в начало короткое слово-стиль
   («Мягко»/«Говоренно», ~1.2–1.4с). Убирать пост-обработкой: whisper word_timestamps →
   найти старт первого реального слова → `ffmpeg -ss <start>`. См. pipeline.
2. HF_TOKEN необязателен, но без него бывает лимит ZeroGPU — держать токен в секретах.
3. Скорость — atempo в пост (1.8× ок, тембр сохраняется). Либо `--du` для темпа речи.

## Альтернативы (из набора Даниэля)
- VoxCPM (openbmb/VoxCPM-Demo) — живее/эмоциональнее.
- Qwen3-TTS (Qwen/Qwen3-TTS).
- Kaggle F5-TTS Russian (vcode/daily/kaggle_tts) — запасной GPU-путь.
