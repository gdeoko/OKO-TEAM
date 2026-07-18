# V.CODE голос — F5-TTS Russian на Kaggle free-GPU

Топ-качество, бесплатно, безлимит (30 ч GPU/нед), клон по референсу, ударения ruaccent.

## Рабочий рецепт (проверено, итерация 8 — out.wav, ASR ru p=1.00)
- Ядро: `okoteam/vcode-tts` (kernel_type=script, enable_gpu, enable_internet).
- Датасет с референсом: `okoteam/vcode-voice` (ref_vladimir.wav). Путь монтирования:
  `/kaggle/input/datasets/okoteam/vcode-voice/` — искать через glob `**/ref_vladimir.wav`.
- Модель: `Misha24-10/F5-TTS_RUSSIAN` → `F5TTS_v1_Base_v2/model_last_inference.safetensors`
  + `F5TTS_v1_Base/vocab.txt` (публичные, HF_HUB_DISABLE_XET=1).
- Ударения: ruaccent `process_all` — символ `+` перед ударной гласной (НЕ U+0301!).

## ГРАБЛИ (важно)
1. Свежий torch Kaggle (2.10+/2.13+ cu128/cu130) НЕ поддерживает P100 (sm_60) — «CUDA no kernel image».
   Ставить torch==2.4.1 + torchvision==0.19.1 + torchaudio==2.4.1 (cu121) — держит и P100, и T4.
2. torch ставить ПОСЛЕДНИМ (--force-reinstall --no-deps), иначе transformers/accelerate тянут torch обратно.
3. f5-tts ставить СО всеми зависимостями (rjieba, hydra, ...), иначе ModuleNotFound по очереди.
4. Датасет должен быть в статусе `ready` ДО запуска ядра (иначе монтируется пустым).

## Запуск
export KAGGLE_API_TOKEN=... (в secrets.env.b64)
kaggle kernels push -p vcode/daily/kaggle_tts   # или через run.py с lines.json
kaggle kernels status okoteam/vcode-tts
kaggle kernels output okoteam/vcode-tts -p <out>
