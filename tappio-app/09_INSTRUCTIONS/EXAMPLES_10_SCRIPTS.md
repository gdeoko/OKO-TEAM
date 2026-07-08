# 10 EXAMPLE SCRIPTS — Эталоны сценариев роликов

Ниже — 10 полностью написанных сценариев (по одному каждого типа × 3 приложения + 1 cross-brand). Используй их как **эталон стиля**, не как шаблон для копирования. Каждый новый ролик должен быть уникальным по хуку и подаче.

---

## 1. SPY · Ф2 shocking stat

```json
{
  "id": "spy_001",
  "app": "spy",
  "format": "F2",
  "duration": 27,
  "publish_day": 1,
  "publish_platforms": ["tiktok", "instagram_reels", "youtube_shorts"],
  "hook": {
    "text": "1 in 8 rentals has a hidden camera. Most guests never check.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 10,
      "voice": "The most common spot? Smoke detectors. Screws. Alarm clocks. Anywhere with a lens the size of a pinhead.",
      "visual_prompt": "close-up shots of smoke detector, alarm clock, screw with hidden lens, cinematic dim lighting, 9:16 vertical",
      "overlay": {"text": "PINHOLE SIZE", "position": "top_third", "color": "#00D9FF"}
    },
    {
      "start": 10,
      "end": 23,
      "voice": "Your phone has four sensors that can detect them. Wi-Fi. Bluetooth. Magnetic field. Infrared. Spy Camera Finder runs all four in sixty seconds.",
      "visual_type": "screen_recording",
      "visual_source": "spy_scan_60sec.mp4",
      "overlay": {"text": "4 SENSORS · 60 SECONDS", "position": "bottom_third", "color": "#00D9FF"}
    }
  ],
  "cta": {
    "start": 23,
    "end": 27,
    "voice": "Try it before your next trip. Link in bio.",
    "visual_type": "end_card"
  },
  "caption": "Every 3 seconds someone finds a hidden camera. Don't be the one who missed it.",
  "hashtags": ["#airbnb", "#hiddencamera", "#travelsafety", "#privacy", "#hotelsafety"],
  "voice": {"engine": "elevenlabs", "voice_id": "EXAVITQu4vr4xnSDxMaL", "speed": 1.0},
  "music": "chill_electronic_120bpm.mp3",
  "music_volume": 0.15
}
```

---

## 2. SPY · Ф3 demo

```json
{
  "id": "spy_002",
  "app": "spy",
  "format": "F3",
  "duration": 32,
  "publish_day": 1,
  "hook": {
    "text": "This looks like a smoke detector. Watch what my phone finds.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 8,
      "voice": "I'm in a rental in Barcelona. This smoke detector is right above the bed. Feels off.",
      "visual_type": "b-roll",
      "visual_source": "hotel_room_smoke_detector.mp4",
      "overlay": {"text": "BARCELONA · AIRBNB", "position": "top", "color": "#FFFFFF"}
    },
    {
      "start": 8,
      "end": 23,
      "voice": "Opening Spy Camera Finder. Wi-Fi scan first. There's a device on the private network that shouldn't be there. Bluetooth next. Confirmed. Infrared last. There's the lens.",
      "visual_type": "screen_recording",
      "visual_source": "spy_full_detection.mp4"
    },
    {
      "start": 23,
      "end": 28,
      "voice": "I moved rooms. Reported the host. Got my refund.",
      "visual_prompt": "hands packing suitcase, moving out of hotel, discreet, 9:16",
      "overlay": {"text": "MOVED · REPORTED · REFUNDED", "position": "center", "color": "#00D9FF"}
    }
  ],
  "cta": {
    "start": 28,
    "end": 32,
    "voice": "Spy Camera Finder. Link in bio.",
    "visual_type": "end_card"
  },
  "caption": "This is why I always scan before I unpack. Even $500/night places aren't safe.",
  "hashtags": ["#solotravel", "#airbnbhorrorstory", "#hiddencamera", "#travel", "#safetytip"]
}
```

---

## 3. SPY · Ф1 personal story

```json
{
  "id": "spy_003",
  "app": "spy",
  "format": "F1",
  "duration": 30,
  "publish_day": 2,
  "hook": {
    "text": "Last month I found a camera in a rental. I'm still processing it.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 12,
      "voice": "I was in Bali. Long solo trip. Third night in a nice villa. Something about the alarm clock felt weird. It was pointed at the bed at a strange angle.",
      "visual_prompt": "young woman looking uneasy in bedroom, moody lighting, Bali villa aesthetic, 9:16",
      "overlay": {"text": "BALI · NIGHT 3", "position": "top", "color": "#FFFFFF"}
    },
    {
      "start": 12,
      "end": 22,
      "voice": "I downloaded Spy Camera Finder that night. Wi-Fi scan showed a hidden device. Infrared confirmed there was a lens in the clock. I couldn't sleep. Packed and left at four AM.",
      "visual_type": "screen_recording",
      "visual_source": "spy_wifi_detect_dramatic.mp4"
    },
    {
      "start": 22,
      "end": 26,
      "voice": "I don't travel without this app anymore. Every room. Sixty seconds. Every time.",
      "visual_prompt": "phone in hand scanning room, calm face, sunrise light, 9:16",
      "overlay": {"text": "EVERY ROOM · EVERY TIME", "position": "center", "color": "#00D9FF"}
    }
  ],
  "cta": {
    "start": 26,
    "end": 30,
    "voice": "Link in bio if you travel alone.",
    "visual_type": "end_card"
  },
  "caption": "Solo female travelers, this one's for you. Please scan.",
  "hashtags": ["#solofemaletraveler", "#solotravel", "#airbnb", "#safety", "#travelalone"]
}
```

---

## 4. BRAIN · Ф1 personal story

```json
{
  "id": "brain_001",
  "app": "brain",
  "format": "F1",
  "duration": 28,
  "publish_day": 1,
  "hook": {
    "text": "Six months ago I couldn't remember why I opened the fridge.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 12,
      "voice": "I'm thirty four. Not fifty. I googled 'am I getting dementia' at two AM. Then I did the smart thing. I stopped panicking.",
      "visual_prompt": "man in his 30s looking anxious at phone at night in dark room, 9:16",
      "overlay": {"text": "AGE 34", "position": "top", "color": "#9B5DE5"}
    },
    {
      "start": 12,
      "end": 22,
      "voice": "I took a Brain Score test on Brainova. Memory: below average. Focus: bad. Speed: not great. I started ten minutes a day. Just ten.",
      "visual_type": "screen_recording",
      "visual_source": "brain_score_test_and_result.mp4"
    },
    {
      "start": 22,
      "end": 25,
      "voice": "Six months later my score is up forty seven percent.",
      "visual_type": "screen_recording",
      "visual_source": "brain_score_progress_chart.mp4",
      "overlay": {"text": "SCORE +47%", "position": "center", "color": "#9B5DE5"}
    }
  ],
  "cta": {
    "start": 25,
    "end": 28,
    "voice": "Take the free test. Link in bio.",
    "visual_type": "end_card"
  },
  "caption": "Ten minutes a day. That's it. I finally finish thoughts again.",
  "hashtags": ["#brainhealth", "#focus", "#adhd", "#memory", "#brainova"]
}
```

---

## 5. BRAIN · Ф2 shocking stat

```json
{
  "id": "brain_002",
  "app": "brain",
  "format": "F2",
  "duration": 26,
  "publish_day": 2,
  "hook": {
    "text": "Your brain age is not your real age. Most people's brain is older.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 11,
      "voice": "Studies from Stanford show adults over twenty five lose about zero point five percent of cognitive speed every year. That's compounding. That's why remembering names gets harder.",
      "visual_prompt": "brain illustration with declining line graph, purple neon glow, dark background, 9:16",
      "overlay": {"text": "-0.5%/YEAR", "position": "top_third", "color": "#9B5DE5"}
    },
    {
      "start": 11,
      "end": 22,
      "voice": "Ten minutes of the right training reverses it. Dual n-back. Task switching. Working memory. Brainova runs all three, personalized to your baseline score.",
      "visual_type": "screen_recording",
      "visual_source": "brain_daily_training.mp4"
    }
  ],
  "cta": {
    "start": 22,
    "end": 26,
    "voice": "Free Brain Score test. Link in bio.",
    "visual_type": "end_card"
  },
  "caption": "Ten minutes. That's cheaper than one coffee a day.",
  "hashtags": ["#neuroscience", "#brain", "#focus", "#memory", "#cognition"]
}
```

---

## 6. BRAIN · Ф4 before/after

```json
{
  "id": "brain_003",
  "app": "brain",
  "format": "F4",
  "duration": 24,
  "publish_day": 3,
  "hook": {
    "text": "Day 1 vs Day 30 on Brainova. Watch my Brain Score.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 12,
      "voice": "Day one. Baseline score fifty eight. Memory game: seventeen seconds average. Focus test: I bombed it. Speed test: median for my age.",
      "visual_type": "screen_recording",
      "visual_source": "brain_day1_baseline.mp4",
      "overlay": {"text": "DAY 1 · SCORE 58", "position": "center", "color": "#9B5DE5"}
    },
    {
      "start": 12,
      "end": 20,
      "voice": "Day thirty. Score seventy nine. Memory: eleven seconds. Focus: top decile. Speed: above age median. Ten minutes a day. Nothing crazy.",
      "visual_type": "screen_recording",
      "visual_source": "brain_day30_result.mp4",
      "overlay": {"text": "DAY 30 · SCORE 79", "position": "center", "color": "#9B5DE5"}
    }
  ],
  "cta": {
    "start": 20,
    "end": 24,
    "voice": "Take the baseline test. Link in bio.",
    "visual_type": "end_card"
  },
  "caption": "Ten minutes. Every day. Non negotiable. Results speak.",
  "hashtags": ["#30daychallenge", "#brainhealth", "#selfimprovement", "#focus"]
}
```

---

## 7. TAPE · Ф3 demo

```json
{
  "id": "tape_001",
  "app": "tape",
  "format": "F3",
  "duration": 30,
  "publish_day": 1,
  "hook": {
    "text": "Watch me measure a whole apartment with just my phone.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 25,
      "voice": "Point. Tap. Save. Living room done. Kitchen done. Bedroom done. Bathroom done. Hallway done. Every wall. Every corner. Every distance from window to outlet.",
      "visual_type": "time_lapse",
      "visual_source": "tape_full_apartment_60sec.mp4",
      "overlay": {"text": "5 ROOMS · 60 SECONDS", "position": "top", "color": "#F4C430"}
    },
    {
      "start": 25,
      "end": 28,
      "voice": "All exported to PDF for my contractor.",
      "visual_type": "screen_recording",
      "visual_source": "tape_pdf_export.mp4",
      "overlay": {"text": "PDF READY", "position": "center", "color": "#F4C430"}
    }
  ],
  "cta": {
    "start": 28,
    "end": 30,
    "voice": "3D Tape Measure. Link in bio.",
    "visual_type": "end_card"
  },
  "caption": "One time purchase. Lifetime access. Zero tape measures.",
  "hashtags": ["#homerenovation", "#diy", "#interiordesign", "#ar", "#homehacks"]
}
```

---

## 8. TAPE · Ф4 before/after

```json
{
  "id": "tape_002",
  "app": "tape",
  "format": "F4",
  "duration": 28,
  "publish_day": 2,
  "hook": {
    "text": "I bought a $2000 rug that didn't fit. Never again.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 10,
      "voice": "The rug was gorgeous. And two inches too wide. Returning it cost me shipping plus a fifteen percent restocking fee. That's over three hundred dollars gone.",
      "visual_prompt": "large rug half-unrolled in modern living room, doesn't fit, homeowner looking frustrated, 9:16",
      "overlay": {"text": "$300 GONE", "position": "center", "color": "#F4C430"}
    },
    {
      "start": 10,
      "end": 24,
      "voice": "Now before I buy anything, I measure the space in AR. Rug. Sofa. Coffee table. Everything visualized to the exact centimeter. Every purchase fits.",
      "visual_type": "screen_recording",
      "visual_source": "tape_ar_furniture_preview.mp4",
      "overlay": {"text": "MEASURE FIRST", "position": "top", "color": "#F4C430"}
    }
  ],
  "cta": {
    "start": 24,
    "end": 28,
    "voice": "3D Tape Measure. Link in bio.",
    "visual_type": "end_card"
  },
  "caption": "Every wrong purchase costs 3-15% in restocking. Measure first.",
  "hashtags": ["#homehacks", "#interiordesign", "#shopping", "#save", "#ar"]
}
```

---

## 9. TAPE · Ф6 POV

```json
{
  "id": "tape_003",
  "app": "tape",
  "format": "F6",
  "duration": 22,
  "publish_day": 4,
  "hook": {
    "text": "POV: you're at IKEA and don't know if the sofa fits.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 14,
      "voice": "You could guess. You could measure with your hand. Or you could open 3D Tape Measure. It remembers every wall of your living room. The AR overlay shows if the sofa fits before you buy.",
      "visual_prompt": "person at IKEA showroom looking at sofa, holding phone up with AR overlay, 9:16",
      "overlay": {"text": "AR PREVIEW", "position": "top", "color": "#F4C430"}
    },
    {
      "start": 14,
      "end": 18,
      "voice": "No tape measure. No returns. No stress.",
      "visual_prompt": "person leaving IKEA with confident smile, receipt in hand, 9:16",
      "overlay": {"text": "NO RETURNS", "position": "center", "color": "#F4C430"}
    }
  ],
  "cta": {
    "start": 18,
    "end": 22,
    "voice": "3D Tape Measure. Link in bio.",
    "visual_type": "end_card"
  },
  "caption": "This should be built into every furniture app. Until then, we have this.",
  "hashtags": ["#ikea", "#homedecor", "#furniture", "#ar", "#homehacks"]
}
```

---

## 10. TAPPIO CROSS-BRAND · Ф2

```json
{
  "id": "tappio_001",
  "app": "tappio",
  "format": "F2",
  "duration": 24,
  "publish_day": 3,
  "hook": {
    "text": "Three apps. Sixty seconds each. Zero excuses.",
    "start": 0,
    "end": 3
  },
  "scenes": [
    {
      "start": 3,
      "end": 9,
      "voice": "Spy Camera Finder. Any rental. Any hotel. Four sensor scan. Sixty seconds.",
      "visual_type": "screen_recording",
      "visual_source": "spy_quick_demo_5sec.mp4",
      "overlay": {"text": "SPOT CAMS", "position": "center", "color": "#00D9FF"}
    },
    {
      "start": 9,
      "end": 15,
      "voice": "Brainova. Daily brain training. Track focus, memory, speed. Ten minutes.",
      "visual_type": "screen_recording",
      "visual_source": "brain_quick_demo_5sec.mp4",
      "overlay": {"text": "SHARPEN BRAIN", "position": "center", "color": "#9B5DE5"}
    },
    {
      "start": 15,
      "end": 21,
      "voice": "3D Tape Measure. AR precision. Any room. Any distance. Save. Share.",
      "visual_type": "screen_recording",
      "visual_source": "tape_quick_demo_5sec.mp4",
      "overlay": {"text": "MEASURE ALL", "position": "center", "color": "#F4C430"}
    }
  ],
  "cta": {
    "start": 21,
    "end": 24,
    "voice": "Tappio dot pro. Link in bio.",
    "visual_type": "end_card"
  },
  "caption": "Three iOS apps. One brand. Real problems solved in 60 seconds.",
  "hashtags": ["#iosapps", "#appstore", "#productivity", "#lifehack", "#tech"]
}
```

---

## ЧТО ЗАМЕТИТЬ В ЭТИХ ПРИМЕРАХ

1. **Hook — всегда конкретен** (`1 in 8`, `Six months ago`, `Last month`), никогда абстрактен
2. **Voice-over — короткие предложения** максимум 15 слов (для устной речи)
3. **Overlays — не более 6 слов**, всегда в brand color
4. **CTA — тихий**, без «Download now!!!»
5. **Caption — не повторяет voice-over**, добавляет ещё один слой
6. **Хэштеги 5 штук**: 3 нишевых + 2 широких
7. **Voice engines** и **voice_id** явно указаны (для скрипта сборки)
8. **Duration 22-32 секунды** — все ролики в этом окне

## ГЕНЕРИРУЙ 500 ТАКИХ ЖЕ

- 140 для Spy (Ф2 × 40, Ф3 × 30, Ф1 × 25, Ф5 × 20, Ф6 × 15, Ф4 × 10)
- 120 для Brain (Ф1 × 40, Ф2 × 25, Ф3 × 20, Ф4 × 20, Ф5 × 10, Ф6 × 5)
- 140 для Tape (Ф3 × 50, Ф4 × 30, Ф2 × 20, Ф1 × 20, Ф6 × 15, Ф5 × 5)
- 100 для Tappio cross-brand

Итого: 500.
