# OKO.MOTION.SKILL — Как ты сам собираешь ролики

> Этот скилл — твой pipeline производства. Без Fliki UI, без HeyGen UI. Ты — режиссёр + продюсер + пост-продакшн в одном лице.

---

## АРХИТЕКТУРА PIPELINE

```
┌─────────────────────────────────────────────────────────────┐
│  СЦЕНАРИЙ (JSON)                                            │
│  { hook, setup, payoff, cta, overlays, timing, voice, ... } │
└────────────────────┬────────────────────────────────────────┘
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
┌──────────┐   ┌──────────┐   ┌──────────┐
│  VOICE   │   │  VIDEO   │   │ OVERLAYS │
│  (TTS)   │   │  (gen +  │   │  (text + │
│          │   │  stock)  │   │  motion) │
└────┬─────┘   └────┬─────┘   └────┬─────┘
     │              │              │
     └──────┬───────┴──────┬───────┘
            ▼              ▼
      ┌──────────────────────────┐
      │  FFMPEG COMPOSER         │
      │  (Python moviepy /       │
      │   Remotion / bash)       │
      └────────────┬─────────────┘
                   ▼
        ┌───────────────────┐
        │  1080×1920 MP4    │
        │  H.264 + AAC      │
        │  <10 MB / 30 sec  │
        └───────────────────┘
```

---

## СТРУКТУРА JSON-СЦЕНАРИЯ

Каждый ролик описывается одним JSON. Формат:

```json
{
  "id": "spy_047",
  "app": "spy",
  "format": "F2",
  "duration": 28,
  "hook": {
    "text": "1 in 8 rentals has a hidden camera. Here's how to check yours.",
    "start": 0,
    "end": 3,
    "visual_prompt": "close-up of a suspicious smoke detector on a hotel ceiling, cinematic, moody lighting, 9:16 vertical"
  },
  "scenes": [
    {
      "id": "s1",
      "start": 3,
      "end": 10,
      "voice": "Every phone already has four sensors that detect them: Wi-Fi, Bluetooth, magnetic field, and infrared.",
      "visual": {
        "type": "generated",
        "prompt": "iPhone screen showing 4 sensor icons appearing one by one, dark background, cyan neon glow, vertical 9:16",
        "duration": 7
      },
      "overlay": {
        "text": "4 SENSORS",
        "font": "Orbitron",
        "size": 72,
        "color": "#00D9FF",
        "position": "center",
        "animation": "fade_in"
      }
    },
    {
      "id": "s2",
      "start": 10,
      "end": 25,
      "voice": "Spy Camera Finder uses all four at once. Any room. Under 60 seconds. No internet needed.",
      "visual": {
        "type": "screen_recording",
        "source": "/mnt/assets/screen_recordings/spy_scan_60sec.mp4",
        "start_offset": 5,
        "duration": 15
      },
      "overlay": {
        "text": "60 SECONDS",
        "font": "Orbitron",
        "size": 72,
        "color": "#00D9FF",
        "position": "center",
        "animation": "scale_pop"
      }
    }
  ],
  "cta": {
    "start": 25,
    "end": 28,
    "voice": "Link in bio to try it before your next trip.",
    "visual": {
      "type": "end_card",
      "icon": "/mnt/assets/logos/icon_spy_camera_finder_1024.png",
      "background": "#050507"
    },
    "overlay": {
      "text": "LINK IN BIO",
      "font": "Orbitron",
      "size": 60,
      "color": "#FFFFFF"
    }
  },
  "audio": {
    "voice": {
      "engine": "elevenlabs",
      "voice_id": "female_us_warm_25_35",
      "speed": 1.0,
      "pitch": 0
    },
    "music": {
      "file": "/mnt/assets/music/chill_electronic_120bpm.mp3",
      "volume": 0.2,
      "fade_in": 0.5,
      "fade_out": 1.0
    },
    "sfx": [
      {"time": 3.0, "file": "whoosh_soft.mp3", "volume": 0.4},
      {"time": 15.0, "file": "ding_detect.mp3", "volume": 0.5}
    ]
  },
  "captions": {
    "enabled": true,
    "font": "Inter-Bold",
    "size": 42,
    "color": "#FFFFFF",
    "outline": "#000000",
    "position": "bottom_safe_zone",
    "animation": "word_by_word"
  },
  "output": {
    "resolution": "1080x1920",
    "fps": 30,
    "codec": "h264",
    "bitrate": "6M",
    "audio_codec": "aac",
    "audio_bitrate": "128k"
  }
}
```

---

## ШАГ 1: ГЕНЕРАЦИЯ ГОЛОСА

### Основной сервис: ElevenLabs API

```python
import requests

def generate_voice(text: str, voice_id: str, output_path: str):
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": os.getenv("ELEVENLABS_API_KEY"),
        "Content-Type": "application/json"
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "style": 0.2,
            "use_speaker_boost": True
        }
    }
    r = requests.post(url, json=payload, headers=headers)
    with open(output_path, "wb") as f:
        f.write(r.content)
```

### Голоса для каждого приложения:

| App | Voice ID | Характеристика |
|-----|----------|----------------|
| Spy | `EXAVITQu4vr4xnSDxMaL` (Bella) | Female, US, warm, 25-35, приватность = personal |
| Brain | `21m00Tcm4TlvDq8ikWAM` (Rachel) | Female, US, calm/thoughtful, 30-40 |
| Tape | `29vD33N1CtxCmqQRPOHJ` (Drew) | Male, US, confident, 25-35, DIY-vibes |

### Fallback: OpenAI TTS (дешевле, чуть хуже)
```python
from openai import OpenAI
client = OpenAI()
response = client.audio.speech.create(
    model="tts-1-hd",
    voice="nova",  # для Spy / Brain
    input=text
)
response.stream_to_file(output_path)
```

### Fallback #2: Google Cloud TTS (если бюджет исчерпан)

---

## ШАГ 2: ГЕНЕРАЦИЯ ВИДЕО

### Тип 1: Generated (AI видео)

**Основной сервис: Runway ML Gen-3**
```python
import requests

def generate_video(prompt: str, duration: int, output_path: str):
    url = "https://api.runwayml.com/v1/image_to_video"
    headers = {"Authorization": f"Bearer {os.getenv('RUNWAY_API_KEY')}"}
    payload = {
        "prompt": prompt,
        "duration": duration,
        "aspect_ratio": "9:16",
        "seed": random.randint(0, 999999)
    }
    r = requests.post(url, json=payload, headers=headers)
    task_id = r.json()["id"]
    # Poll for result
    while True:
        status = requests.get(f"{url}/{task_id}", headers=headers).json()
        if status["status"] == "SUCCEEDED":
            video_url = status["output"][0]
            download(video_url, output_path)
            break
        time.sleep(5)
```

**Альтернативы (по возрастанию цены):**
- **Higgsfield** — https://higgsfield.ai (в MCP есть tool)
- **Kling AI** — https://kling.kuaishou.com
- **Luma Dream Machine** — https://lumalabs.ai
- **Google Veo 3** — если доступ есть
- **Pika Labs** — https://pika.art

### Тип 2: Stock (готовое)

**Основной: Pexels API (бесплатно)**
```python
import requests

def search_pexels(query: str, per_page: int = 5):
    url = "https://api.pexels.com/videos/search"
    headers = {"Authorization": os.getenv("PEXELS_API_KEY")}
    params = {"query": query, "orientation": "portrait", "per_page": per_page}
    r = requests.get(url, headers=headers, params=params)
    videos = r.json()["videos"]
    # Filter for 9:16 vertical and download best quality
    for v in videos:
        for file in v["video_files"]:
            if file["width"] == 1080 and file["height"] == 1920:
                return file["link"]
```

**Альтернативы:**
- Unsplash (только фото, но можно сделать panning-timelapse)
- Pixabay
- Coverr.co

### Тип 3: Screen recording

**Заранее записанные screen-recording'и приложений хранятся в:**
```
/mnt/assets/screen_recordings/
├── spy_scan_60sec.mp4          # полный цикл сканирования
├── spy_wifi_detect.mp4          # моментальное обнаружение
├── spy_bluetooth_scan.mp4       # bluetooth сканирование
├── spy_infrared_reveal.mp4      # ик-подсветка
├── brain_score_test.mp4         # прохождение теста
├── brain_score_result.mp4       # получение результата
├── brain_daily_training.mp4     # тренировка дня
├── tape_measure_room.mp4        # замер комнаты
├── tape_multi_room.mp4          # библиотека комнат
└── tape_pdf_export.mp4          # экспорт в PDF
```

Если их ещё нет — сгенерируй mock'и через генератор UI (см. mockups в `06_APP_SCREENSHOTS/`) + запиши симуляцию курсора через `ffmpeg`.

---

## ШАГ 3: OVERLAYS (текст на видео)

### Инструмент: FFmpeg drawtext + Python moviepy

```python
from moviepy.editor import VideoFileClip, TextClip, CompositeVideoClip

def add_overlay(video_path, text, start, duration, color, font_size, output_path):
    video = VideoFileClip(video_path)
    txt_clip = (TextClip(text, 
                         fontsize=font_size, 
                         color=color, 
                         font='Orbitron-Bold',
                         stroke_color='#000000',
                         stroke_width=2)
                .set_position('center')
                .set_start(start)
                .set_duration(duration)
                .crossfadein(0.2)
                .crossfadeout(0.2))
    final = CompositeVideoClip([video, txt_clip])
    final.write_videofile(output_path, codec='libx264', audio_codec='aac')
```

### Правила overlay (из Системы Роста):
- Максимум 6-8 слов на overlay
- Размер: 60-80px на 1080×1920
- Цвет: белый на dark bg, brand color для accent
- Shadow: 4px blur, 40% opacity
- Position: center-bottom third
- Animation: fade in 0.2s → hold → fade out 0.2s

### Font pack (положи в `/mnt/assets/fonts/`):
- `Orbitron-Regular.ttf` (400)
- `Orbitron-SemiBold.ttf` (600)
- `Orbitron-Bold.ttf` (700)
- `Syne-Regular.ttf` (400)
- `Syne-Medium.ttf` (500)
- `Syne-SemiBold.ttf` (600)
- `DMMono-Regular.ttf` (400)
- `DMMono-Medium.ttf` (500)
- `Inter-Bold.ttf` (для subtitles)

---

## ШАГ 4: СУБТИТРЫ

**Основной сервис: OpenAI Whisper API (для сверки)**
```python
from openai import OpenAI
client = OpenAI()

# 1. Прогоняем voice-over через Whisper для получения точных таймингов слов
transcript = client.audio.transcriptions.create(
    model="whisper-1",
    file=open("voice.mp3", "rb"),
    response_format="verbose_json",
    timestamp_granularities=["word"]
)

# 2. Рендерим субтитры word-by-word через moviepy
def render_subtitles(video, words_with_times):
    clips = [video]
    for word in words_with_times:
        txt = (TextClip(word["word"].upper(),
                        fontsize=42,
                        color='#FFFFFF',
                        font='Inter-Bold',
                        stroke_color='#000000',
                        stroke_width=3)
               .set_position(('center', 1500))  # safe zone
               .set_start(word["start"])
               .set_duration(word["end"] - word["start"]))
        clips.append(txt)
    return CompositeVideoClip(clips)
```

**Обязательно word-by-word (не строками)** — так делают все viral-ролики.

---

## ШАГ 5: СБОРКА ЧЕРЕЗ FFMPEG

**Финальный скрипт (Python):**

```python
#!/usr/bin/env python3
"""oko_motion_compose.py — финальная сборка ролика из JSON-сценария"""

import json
import subprocess
import sys
from pathlib import Path
from moviepy.editor import (VideoFileClip, AudioFileClip, TextClip,
                            CompositeVideoClip, CompositeAudioClip,
                            concatenate_videoclips, ImageClip)

def compose(script_json: dict, output_path: str):
    scenes_clips = []
    
    # 1. Hook + scenes + CTA — собираем каждый scene
    for scene in [script_json["hook"]] + script_json["scenes"] + [script_json["cta"]]:
        video = load_visual(scene["visual"])
        video = video.subclip(0, scene["end"] - scene["start"])
        video = video.resize((1080, 1920))
        
        # Добавляем overlay если есть
        if "overlay" in scene:
            overlay = make_text_clip(scene["overlay"], video.duration)
            video = CompositeVideoClip([video, overlay])
        
        scenes_clips.append(video)
    
    # 2. Конкатенируем сцены
    full_video = concatenate_videoclips(scenes_clips)
    
    # 3. Собираем аудио
    voice_clips = []
    for scene in [script_json["hook"]] + script_json["scenes"] + [script_json["cta"]]:
        voice = AudioFileClip(scene["voice_file"])
        voice = voice.set_start(scene["start"])
        voice_clips.append(voice)
    
    music = AudioFileClip(script_json["audio"]["music"]["file"])
    music = music.volumex(script_json["audio"]["music"]["volume"])
    music = music.subclip(0, full_video.duration)
    
    audio = CompositeAudioClip(voice_clips + [music])
    full_video = full_video.set_audio(audio)
    
    # 4. Добавляем субтитры (word-by-word)
    if script_json["captions"]["enabled"]:
        full_video = add_word_by_word_subtitles(full_video, script_json)
    
    # 5. Экспорт
    full_video.write_videofile(
        output_path,
        codec="libx264",
        audio_codec="aac",
        bitrate="6M",
        audio_bitrate="128k",
        fps=30,
        preset="medium",
        threads=4
    )

if __name__ == "__main__":
    script = json.loads(Path(sys.argv[1]).read_text())
    output = sys.argv[2]
    compose(script, output)
```

---

## СТРУКТУРА ПАПОК ПРОИЗВОДСТВА

Создай эту структуру в рабочей директории:

```
tappio-content-factory/
├── scripts/                          # JSON-сценарии всех 500 роликов
│   ├── spy/
│   │   ├── spy_001.json
│   │   ├── spy_002.json
│   │   └── ...
│   ├── brain/
│   ├── tape/
│   └── tappio/                       # cross-brand ролики
├── assets/
│   ├── logos/                        # из 02_LOGO_ICONS/
│   ├── screen_recordings/            # запиши сам через симулятор
│   ├── generated_video/              # AI-сгенерированные клипы
│   ├── stock_video/                  # с Pexels
│   ├── voice_takes/                  # ElevenLabs выходы
│   ├── music/                        # background tracks
│   ├── sfx/                          # звуковые эффекты
│   └── fonts/                        # шрифты
├── output/
│   ├── final_videos/                 # готовые MP4
│   │   ├── batch_001/                # первые 10 роликов
│   │   ├── batch_002/                # следующие 10
│   │   └── ...
│   └── posts/                        # captions, hashtags, publishing schedule
├── logs/
│   ├── production.log
│   ├── api_costs.log                 # трекинг бюджета API
│   └── errors.log
└── config/
    ├── voices.json                   # маппинг app → voice_id
    ├── api_keys.env                  # ELEVENLABS_API_KEY=... (gitignore!)
    └── budget.json                   # текущие расходы
```

---

## БЮДЖЕТНЫЕ ОГРАНИЧЕНИЯ

Общий бюджет на 500 роликов — **не более $500 внешних API-расходов** (иначе экономика не работает).

**Разбивка бюджета:**
- ElevenLabs: ~$100 (500 роликов × 30 сек × $0.006/сек)
- Runway ML: ~$200 (300 генераций × $0.67/10 сек)
- OpenAI (Whisper + fallback TTS): ~$50
- Pexels: $0 (бесплатно, но с атрибуцией)
- Music library: $50 (Envato subscription или Epidemic Sound)
- Total: ~$400 + $100 buffer

**Оптимизации:**
- 60% роликов на stock video (Pexels) — бесплатно
- 30% на screen recording — бесплатно
- Только 10% на generated AI video — 50 роликов × $2 = $100

---

## ЧЕК-ЛИСТ ПЕРЕД ПУБЛИКАЦИЕЙ КАЖДОГО РОЛИКА

- [ ] MP4 файл < 10 МБ
- [ ] Разрешение 1080×1920, 30 fps
- [ ] H.264 codec, AAC audio
- [ ] Voice-over разборчиво (проверь Whisper transcript)
- [ ] Субтитры word-by-word появляются на нужных таймингах
- [ ] Overlays не выходят за safe zone (60px от краёв)
- [ ] End card 2-3 секунды с иконкой приложения
- [ ] Музыка не глушит voice-over (проверка на слух)
- [ ] Caption и хэштеги подготовлены в `output/posts/`
- [ ] Дата и время публикации в расписании
- [ ] UTM link в bio на сайт (уникальный для этого ролика)

---

## РАБОЧИЙ ПРОЦЕСС (production loop)

```bash
# 1. Генерируешь JSON-сценарии для батча из 10 роликов
python generate_scripts.py --batch 001 --count 10 --app spy

# 2. Для каждого сценария — озвучка
python generate_voices.py --batch 001

# 3. Генерируешь/скачиваешь видео-ассеты
python fetch_visuals.py --batch 001

# 4. Собираешь ролики через moviepy + ffmpeg
python compose_videos.py --batch 001

# 5. Валидируешь
python validate_batch.py --batch 001

# 6. Пакуешь в ZIP для клиента
zip -r batch_001.zip output/final_videos/batch_001/

# 7. Обновляешь контент-план (HTML) с новыми роликами
python update_content_plan.py --batch 001
```

Каждый батч из 10 роликов — примерно **2-3 часа работы pipeline**.

За 60 дней: 50 батчей × 3 часа = 150 часов чистого производства.

---

## ЕСЛИ ЧТО-ТО СЛОМАЛОСЬ

1. **ElevenLabs квота исчерпана** → переключись на OpenAI TTS (`tts-1-hd`, voice `nova`)
2. **Runway ML недоступен** → используй Pexels stock + panning/zoom
3. **FFmpeg зависает** → упрости — убери сложные transitions, используй `preset=fast`
4. **Ролик > 10 МБ** → снизь bitrate до `4M`, увеличь compression
5. **Whisper не распознаёт speaker** → добавь reference audio к API-вызову
6. **Font не отображается** → moviepy требует установленных шрифтов в системе, не только в `assets/`

Логи всех ошибок пиши в `logs/errors.log` с timestamp и batch ID.
