# API KEYS SETUP

Файл `config/api_keys.env` (не коммить в git!):

```env
# ─── Voice ─────────────────────────────────────
ELEVENLABS_API_KEY=sk_your_key_here
OPENAI_API_KEY=sk-proj-your_key_here     # fallback TTS + Whisper

# ─── Video ─────────────────────────────────────
RUNWAY_API_KEY=your_runway_key
HIGGSFIELD_API_KEY=your_higgsfield_key    # альтернатива
LUMA_API_KEY=your_luma_key                # альтернатива

# ─── Stock ─────────────────────────────────────
PEXELS_API_KEY=your_pexels_key            # бесплатно
UNSPLASH_ACCESS_KEY=your_unsplash_key

# ─── Music ─────────────────────────────────────
EPIDEMIC_SOUND_API_KEY=your_epidemic_key  # если платная подписка

# ─── Analytics (для UTM tracking) ──────────────
BRANCH_IO_KEY=your_branch_key             # deep links
APPSFLYER_API_KEY=your_appsflyer_key      # attribution

# ─── App Store ─────────────────────────────────
APP_STORE_CONNECT_KEY_ID=xxx
APP_STORE_CONNECT_ISSUER_ID=xxx
APP_STORE_CONNECT_KEY_FILE=/secure/apple_key.p8

# ─── Apphud ────────────────────────────────────
APPHUD_API_KEY=your_apphud_key            # ⚠️ ЖДЁМ от клиента
```

## Где брать ключи

| Сервис | Как получить | Тариф |
|--------|--------------|-------|
| ElevenLabs | elevenlabs.io → Profile → API | Starter $5/mo (30K chars) |
| OpenAI | platform.openai.com → API keys | Pay-as-you-go |
| Runway ML | runwayml.com/api | Business $95/mo |
| Higgsfield | higgsfield.ai (MCP-интеграция уже есть) | Credits-based |
| Pexels | pexels.com/api | Бесплатно |
| Unsplash | unsplash.com/developers | Бесплатно |

## Проверка ключей

```bash
python -c "
import os
from dotenv import load_dotenv
load_dotenv('config/api_keys.env')
required = ['ELEVENLABS_API_KEY', 'OPENAI_API_KEY', 'RUNWAY_API_KEY', 'PEXELS_API_KEY']
for key in required:
    val = os.getenv(key)
    print(f'{key}: {\"✅\" if val else \"❌\"}')"
```

## Ежедневный лимит трат

Хардкодь в `config/budget.json`:

```json
{
  "daily_limit_usd": 15,
  "monthly_limit_usd": 250,
  "alert_at_percent": 80,
  "hard_stop_at_percent": 95,
  "notification_channel": "telegram",
  "telegram_chat_id": "your_chat_id"
}
```

Если суточный лимит превышен — pipeline автоматически переключается на fallback (stock video + OpenAI TTS) до следующего дня.
